import type { PluginHostContext } from "@allinone/plugin-api";

import {
  createTodoItem,
  isTodoFilter,
  isTodoPriority,
  parseAddTodoInput,
  readTodoState,
  TODO_ADD_COMMAND,
  TODO_CHANGED_EVENT,
  TODO_CLEAR_COMPLETED_COMMAND,
  TODO_FILTER_KEY,
  TODO_ITEMS_KEY,
  TODO_SCHEMA_VERSION,
  writeTodoItems,
  type TodoPriority,
} from "./store.js";

/**
 * Host entry for the todo example.
 *
 * The UI plugin could write to `context.storage` directly, but the example
 * routes mutations through host commands so that it exercises the full
 * "manifest command -> host handler -> namespaced storage -> IPC event -> UI"
 * chain. This is also what a command-palette invocation does.
 */

function readDefaultPriority(context: PluginHostContext): TodoPriority {
  const configured = context.config.get<string>("defaultPriority", "normal");
  return isTodoPriority(configured) ? configured : "normal";
}

export async function setup(context: PluginHostContext): Promise<void> {
  const version = await context.storage.getSchemaVersion();

  if (version > TODO_SCHEMA_VERSION) {
    throw new Error(
      `todo storage schema ${version} is newer than supported version ${TODO_SCHEMA_VERSION}`,
    );
  }

  if (version < TODO_SCHEMA_VERSION) {
    const items = await context.storage.get<unknown[]>(TODO_ITEMS_KEY);
    if (!Array.isArray(items)) {
      await context.storage.set(TODO_ITEMS_KEY, []);
    } else if (items.some((entry) => typeof entry === "string")) {
      // v0 stored a string[] of titles; migrate it to the object model.
      const migrated = items.map((entry) =>
        typeof entry === "string" ? createTodoItem(entry, "normal") : entry,
      );
      await context.storage.set(TODO_ITEMS_KEY, migrated);
    }

    const filter = await context.storage.get(TODO_FILTER_KEY);
    if (!isTodoFilter(filter)) {
      await context.storage.set(TODO_FILTER_KEY, "all");
    }

    await context.storage.setSchemaVersion(TODO_SCHEMA_VERSION);
    context.logger.info("todo storage migrated", {
      from: version,
      to: TODO_SCHEMA_VERSION,
    });
  }
}

export async function start(context: PluginHostContext): Promise<void> {
  context.commands.register(TODO_ADD_COMMAND, async (execution) => {
    const input = parseAddTodoInput(execution.payload, readDefaultPriority(context));
    const state = await readTodoState(context.storage);
    const item = createTodoItem(input.title, input.priority);
    const items = [...state.items, item];

    await writeTodoItems(context.storage, items);
    context.ipc.emit(TODO_CHANGED_EVENT, { itemId: item.id });
    context.logger.info("todo added", { id: item.id, priority: item.priority });
    return item;
  });

  context.commands.register(TODO_CLEAR_COMPLETED_COMMAND, async () => {
    const state = await readTodoState(context.storage);
    const remaining = state.items.filter((item) => !item.done);
    const removed = state.items.length - remaining.length;

    if (removed > 0) {
      await writeTodoItems(context.storage, remaining);
    }
    context.ipc.emit(TODO_CHANGED_EVENT, { removed });

    if (removed > 0) {
      await showClearedNotification(context, removed);
    }

    context.logger.info("completed todos cleared", { removed });
    return removed;
  });

  context.logger.info("todo host started");
}

async function showClearedNotification(context: PluginHostContext, removed: number): Promise<void> {
  if (!context.permissions.has("notifications")) {
    context.logger.warn("notifications permission is not granted; skipping notification");
    return;
  }

  try {
    await context.capabilities.notifications.show({
      title: "待办已清理",
      body: `已清除 ${removed} 项已完成待办。`,
      level: "success",
    });
  } catch (error) {
    context.logger.warn("failed to show todo notification", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function stop(context: PluginHostContext): Promise<void> {
  context.logger.info("todo host stopped");
}

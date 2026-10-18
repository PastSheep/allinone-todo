"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  setup: () => setup,
  start: () => start,
  stop: () => stop
});
module.exports = __toCommonJS(main_exports);

// src/store.ts
var TODO_ITEMS_KEY = "items";
var TODO_FILTER_KEY = "lastFilter";
var TODO_SCHEMA_VERSION = 1;
var TODO_ADD_COMMAND = "com.pastsheep.todo.add";
var TODO_CLEAR_COMPLETED_COMMAND = "com.pastsheep.todo.clear-completed";
var TODO_CHANGED_EVENT = "todos-changed";
var TODO_TITLE_MAX_LENGTH = 200;
function isTodoPriority(value) {
  return value === "low" || value === "normal" || value === "high";
}
function isTodoFilter(value) {
  return value === "all" || value === "open" || value === "done";
}
function normalizeTimestamp(value, fallback) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}
function normalizeTodoItem(value) {
  if (typeof value !== "object" || value === null) {
    return void 0;
  }
  const record = value;
  const id = record.id;
  const title = record.title;
  const done = record.done;
  if (typeof id !== "string" || id.length === 0) {
    return void 0;
  }
  if (typeof title !== "string" || title.trim().length === 0) {
    return void 0;
  }
  if (typeof done !== "boolean") {
    return void 0;
  }
  const createdAt = normalizeTimestamp(record.createdAt, (/* @__PURE__ */ new Date(0)).toISOString());
  const completedAt = record.completedAt;
  return {
    id,
    title: title.slice(0, TODO_TITLE_MAX_LENGTH),
    done,
    priority: isTodoPriority(record.priority) ? record.priority : "normal",
    createdAt,
    ...typeof completedAt === "string" ? { completedAt } : {}
  };
}
function normalizeTodoItems(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const items = [];
  for (const entry of value) {
    const item = normalizeTodoItem(entry);
    if (item) {
      items.push(item);
    }
  }
  return items;
}
function createTodoItem(title, priority) {
  return {
    id: crypto.randomUUID(),
    title: title.slice(0, TODO_TITLE_MAX_LENGTH),
    done: false,
    priority,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function readTodoState(storage) {
  const [rawItems, rawFilter] = await Promise.all([
    storage.get(TODO_ITEMS_KEY),
    storage.get(TODO_FILTER_KEY)
  ]);
  return {
    items: normalizeTodoItems(rawItems),
    filter: isTodoFilter(rawFilter) ? rawFilter : "all"
  };
}
async function writeTodoItems(storage, items) {
  await storage.set(TODO_ITEMS_KEY, items);
}
function normalizeTitle(value) {
  if (typeof value !== "string") {
    return void 0;
  }
  const title = value.trim().slice(0, TODO_TITLE_MAX_LENGTH);
  return title.length > 0 ? title : void 0;
}
function parseAddTodoInput(payload, fallbackPriority) {
  if (typeof payload === "string") {
    return {
      title: normalizeTitle(payload) ?? "\u65B0\u5EFA\u5F85\u529E",
      priority: fallbackPriority
    };
  }
  if (typeof payload === "object" && payload !== null) {
    const record = payload;
    return {
      title: normalizeTitle(record.title) ?? "\u65B0\u5EFA\u5F85\u529E",
      priority: isTodoPriority(record.priority) ? record.priority : fallbackPriority
    };
  }
  return { title: "\u65B0\u5EFA\u5F85\u529E", priority: fallbackPriority };
}

// src/main.ts
function readDefaultPriority(context) {
  const configured = context.config.get("defaultPriority", "normal");
  return isTodoPriority(configured) ? configured : "normal";
}
async function setup(context) {
  const version = await context.storage.getSchemaVersion();
  if (version > TODO_SCHEMA_VERSION) {
    throw new Error(
      `todo storage schema ${version} is newer than supported version ${TODO_SCHEMA_VERSION}`
    );
  }
  if (version < TODO_SCHEMA_VERSION) {
    const items = await context.storage.get(TODO_ITEMS_KEY);
    if (!Array.isArray(items)) {
      await context.storage.set(TODO_ITEMS_KEY, []);
    } else if (items.some((entry) => typeof entry === "string")) {
      const migrated = items.map(
        (entry) => typeof entry === "string" ? createTodoItem(entry, "normal") : entry
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
      to: TODO_SCHEMA_VERSION
    });
  }
}
async function start(context) {
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
async function showClearedNotification(context, removed) {
  if (!context.permissions.has("notifications")) {
    context.logger.warn("notifications permission is not granted; skipping notification");
    return;
  }
  try {
    await context.capabilities.notifications.show({
      title: "\u5F85\u529E\u5DF2\u6E05\u7406",
      body: `\u5DF2\u6E05\u9664 ${removed} \u9879\u5DF2\u5B8C\u6210\u5F85\u529E\u3002`,
      level: "success"
    });
  } catch (error) {
    context.logger.warn("failed to show todo notification", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
async function stop(context) {
  context.logger.info("todo host stopped");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  setup,
  start,
  stop
});

import type { PluginStorage } from "@allinone/plugin-api";

export type TodoPriority = "low" | "normal" | "high";
export type TodoFilter = "all" | "open" | "done";

export interface TodoItem {
  readonly id: string;
  readonly title: string;
  readonly done: boolean;
  readonly priority: TodoPriority;
  readonly createdAt: string;
  readonly completedAt?: string;
}

export interface TodoState {
  readonly items: TodoItem[];
  readonly filter: TodoFilter;
}

export interface AddTodoInput {
  readonly title: string;
  readonly priority: TodoPriority;
}

/** Plugin storage keys and the current data schema version. */
export const TODO_ITEMS_KEY = "items";
export const TODO_FILTER_KEY = "lastFilter";
export const TODO_SCHEMA_VERSION = 1;

/** Contract identifiers declared in `allinone.json`. */
export const TODO_ADD_COMMAND = "com.pastsheep.todo.add";
export const TODO_CLEAR_COMPLETED_COMMAND = "com.pastsheep.todo.clear-completed";
export const TODO_PAGE_ID = "com.pastsheep.todo.page";
export const TODO_SIDEBAR_SLOT_ID = "com.pastsheep.todo.sidebar";
export const TODO_STATUSBAR_SLOT_ID = "com.pastsheep.todo.statusbar";

/** Host -> UI event emitted after a command mutates the todo list. */
export const TODO_CHANGED_EVENT = "todos-changed";

export const TODO_TITLE_MAX_LENGTH = 200;

export const TODO_PRIORITIES: readonly TodoPriority[] = ["low", "normal", "high"];

export const TODO_PRIORITY_LABELS: Readonly<Record<TodoPriority, string>> = {
  low: "低",
  normal: "普通",
  high: "高",
};

export function isTodoPriority(value: unknown): value is TodoPriority {
  return value === "low" || value === "normal" || value === "high";
}

export function isTodoFilter(value: unknown): value is TodoFilter {
  return value === "all" || value === "open" || value === "done";
}

function normalizeTimestamp(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function normalizeTodoItem(value: unknown): TodoItem | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const id = record.id;
  const title = record.title;
  const done = record.done;

  if (typeof id !== "string" || id.length === 0) {
    return undefined;
  }
  if (typeof title !== "string" || title.trim().length === 0) {
    return undefined;
  }
  if (typeof done !== "boolean") {
    return undefined;
  }

  const createdAt = normalizeTimestamp(record.createdAt, new Date(0).toISOString());
  const completedAt = record.completedAt;

  return {
    id,
    title: title.slice(0, TODO_TITLE_MAX_LENGTH),
    done,
    priority: isTodoPriority(record.priority) ? record.priority : "normal",
    createdAt,
    ...(typeof completedAt === "string" ? { completedAt } : {}),
  };
}

/** Accepts arbitrary persisted values and keeps only well-formed todo items. */
export function normalizeTodoItems(value: unknown): TodoItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const items: TodoItem[] = [];
  for (const entry of value) {
    const item = normalizeTodoItem(entry);
    if (item) {
      items.push(item);
    }
  }
  return items;
}

export function createTodoItem(title: string, priority: TodoPriority): TodoItem {
  return {
    id: crypto.randomUUID(),
    title: title.slice(0, TODO_TITLE_MAX_LENGTH),
    done: false,
    priority,
    createdAt: new Date().toISOString(),
  };
}

export function setTodoDone(item: TodoItem, done: boolean): TodoItem {
  const next: TodoItem = {
    id: item.id,
    title: item.title,
    done,
    priority: item.priority,
    createdAt: item.createdAt,
  };
  return done ? { ...next, completedAt: new Date().toISOString() } : next;
}

export function filterTodoItems(items: readonly TodoItem[], filter: TodoFilter): TodoItem[] {
  switch (filter) {
    case "open":
      return items.filter((item) => !item.done);
    case "done":
      return items.filter((item) => item.done);
    default:
      return [...items];
  }
}

export async function readTodoState(storage: PluginStorage): Promise<TodoState> {
  const [rawItems, rawFilter] = await Promise.all([
    storage.get(TODO_ITEMS_KEY),
    storage.get(TODO_FILTER_KEY),
  ]);
  return {
    items: normalizeTodoItems(rawItems),
    filter: isTodoFilter(rawFilter) ? rawFilter : "all",
  };
}

export async function writeTodoItems(storage: PluginStorage, items: TodoItem[]): Promise<void> {
  await storage.set(TODO_ITEMS_KEY, items);
}

function normalizeTitle(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const title = value.trim().slice(0, TODO_TITLE_MAX_LENGTH);
  return title.length > 0 ? title : undefined;
}

/**
 * Accepts either a bare title or `{ title, priority }` from the command palette
 * and the UI. Missing values fall back to a default item instead of throwing.
 */
export function parseAddTodoInput(payload: unknown, fallbackPriority: TodoPriority): AddTodoInput {
  if (typeof payload === "string") {
    return {
      title: normalizeTitle(payload) ?? "新建待办",
      priority: fallbackPriority,
    };
  }

  if (typeof payload === "object" && payload !== null) {
    const record = payload as Record<string, unknown>;
    return {
      title: normalizeTitle(record.title) ?? "新建待办",
      priority: isTodoPriority(record.priority) ? record.priority : fallbackPriority,
    };
  }

  return { title: "新建待办", priority: fallbackPriority };
}

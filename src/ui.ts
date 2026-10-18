import type {
  Disposable,
  PageRenderer,
  RegionSlotRenderer,
  UiPluginContext,
} from "@allinone/plugin-api";

import {
  filterTodoItems,
  isTodoPriority,
  readTodoState,
  setTodoDone,
  TODO_ADD_COMMAND,
  TODO_CHANGED_EVENT,
  TODO_CLEAR_COMPLETED_COMMAND,
  TODO_FILTER_KEY,
  TODO_PAGE_ID,
  TODO_PRIORITIES,
  TODO_PRIORITY_LABELS,
  TODO_SIDEBAR_SLOT_ID,
  TODO_STATUSBAR_SLOT_ID,
  writeTodoItems,
  type TodoFilter,
  type TodoItem,
  type TodoPriority,
  type TodoState,
} from "./store.js";

/**
 * UI entry for the todo example.
 *
 * The page and the two slot renderers share one in-memory state so that a
 * mutation made in one place is reflected everywhere immediately. Persisted
 * state is still the source of truth: host commands emit `todos-changed`, and
 * every renderer reloads from `context.storage`.
 */

const TODO_STYLE_ID = "allinone-todo-styles";

const TODO_STYLE = `
[data-allinone-plugin="com.pastsheep.todo"] {
  color: inherit;
  font: inherit;
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 760px;
  padding: 20px;
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-heading {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-summary {
  flex: 1;
  margin: 0;
  font-size: 13px;
  opacity: 0.7;
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-button {
  padding: 6px 10px;
  font: inherit;
  color: inherit;
  cursor: pointer;
  background: rgba(148, 163, 184, 0.18);
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 8px;
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-button:hover:not(:disabled) {
  background: rgba(148, 163, 184, 0.3);
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-button:disabled {
  cursor: default;
  opacity: 0.5;
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-add {
  display: flex;
  gap: 8px;
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-input,
[data-allinone-plugin="com.pastsheep.todo"] .todo-select {
  min-width: 0;
  padding: 8px 10px;
  font: inherit;
  color: inherit;
  background: rgba(148, 163, 184, 0.12);
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 8px;
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-input {
  flex: 1;
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-input:focus,
[data-allinone-plugin="com.pastsheep.todo"] .todo-select:focus {
  outline: 2px solid #2563eb;
  outline-offset: 1px;
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-filters {
  display: flex;
  gap: 6px;
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-filter.is-active {
  color: #ffffff;
  background: #2563eb;
  border-color: #2563eb;
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0;
  margin: 0;
  list-style: none;
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-item {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 10px;
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-item.is-done .todo-item-title {
  text-decoration: line-through;
  opacity: 0.6;
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-check {
  width: 16px;
  height: 16px;
  accent-color: #2563eb;
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-item-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-item-title {
  overflow-wrap: anywhere;
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-item-meta {
  font-size: 12px;
  opacity: 0.65;
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-priority {
  padding: 2px 8px;
  font-size: 12px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.2);
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-priority-low {
  color: #15803d;
  background: rgba(34, 197, 94, 0.16);
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-priority-high {
  color: #b91c1c;
  background: rgba(239, 68, 68, 0.16);
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-empty {
  padding: 20px;
  margin: 0;
  text-align: center;
  opacity: 0.65;
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-error {
  margin: 0;
  font-size: 13px;
  color: #dc2626;
}

[data-allinone-plugin="com.pastsheep.todo"].todo-sidebar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-sidebar-heading {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-sidebar-count {
  margin: 0;
  font-size: 12px;
  opacity: 0.7;
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-sidebar-add {
  display: flex;
  gap: 6px;
}

[data-allinone-plugin="com.pastsheep.todo"] .todo-sidebar-input {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  font: inherit;
  color: inherit;
  background: rgba(148, 163, 184, 0.12);
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 6px;
}

[data-allinone-plugin="com.pastsheep.todo"].todo-statusbar {
  font-size: 12px;
  opacity: 0.85;
}
`;

let state: TodoState = { items: [], filter: "all" };
let loaded = false;
let pendingLoad: Promise<void> | null = null;
let defaultPriority: TodoPriority = "normal";
let styleElement: HTMLStyleElement | undefined;
let ipcSubscription: Disposable | undefined;
let configSubscription: Disposable | undefined;

const redrawers = new Set<() => void>();

function ensureStyles(): void {
  if (document.getElementById(TODO_STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = TODO_STYLE_ID;
  style.textContent = TODO_STYLE;
  document.head.append(style);
  styleElement = style;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function loadState(context: UiPluginContext, force = false): Promise<void> {
  if (pendingLoad) {
    await pendingLoad;
  }
  if (loaded && !force) {
    return;
  }

  pendingLoad = (async () => {
    try {
      state = await readTodoState(context.storage);
    } catch (error) {
      context.logger.error("failed to read todo storage", { error: describeError(error) });
      state = { items: [], filter: "all" };
    } finally {
      loaded = true;
    }
  })();

  const current = pendingLoad;
  try {
    await current;
  } finally {
    if (pendingLoad === current) {
      pendingLoad = null;
    }
  }
}

function notify(): void {
  for (const redraw of redrawers) {
    redraw();
  }
}

async function refresh(context: UiPluginContext, force = false): Promise<void> {
  await loadState(context, force);
  notify();
}

async function commitItems(context: UiPluginContext, items: TodoItem[]): Promise<void> {
  await writeTodoItems(context.storage, items);
  state = { items, filter: state.filter };
  notify();
}

async function toggleTodo(context: UiPluginContext, id: string): Promise<void> {
  const item = state.items.find((entry) => entry.id === id);
  if (!item) {
    return;
  }
  const items = state.items.map((entry) =>
    entry.id === id ? setTodoDone(entry, !entry.done) : entry,
  );
  try {
    await commitItems(context, items);
  } catch (error) {
    context.logger.error("failed to update todo", { error: describeError(error) });
    await refresh(context, true);
  }
}

async function deleteTodo(context: UiPluginContext, id: string): Promise<void> {
  const items = state.items.filter((entry) => entry.id !== id);
  try {
    await commitItems(context, items);
  } catch (error) {
    context.logger.error("failed to delete todo", { error: describeError(error) });
    await refresh(context, true);
  }
}

async function addTodo(
  context: UiPluginContext,
  title: string,
  priority: string,
): Promise<boolean> {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return false;
  }
  const selected = isTodoPriority(priority) ? priority : defaultPriority;
  await context.commands.execute(TODO_ADD_COMMAND, {
    source: "ui",
    payload: { title: trimmed, priority: selected },
  });
  await refresh(context, true);
  return true;
}

async function setFilter(context: UiPluginContext, filter: TodoFilter): Promise<void> {
  if (state.filter === filter) {
    return;
  }
  state = { items: state.items, filter };
  notify();
  try {
    await context.storage.set(TODO_FILTER_KEY, filter);
  } catch (error) {
    context.logger.error("failed to persist todo filter", { error: describeError(error) });
  }
}

function readDefaultPriority(context: UiPluginContext): TodoPriority {
  const configured = context.config.get<string>("defaultPriority", "normal");
  return isTodoPriority(configured) ? configured : "normal";
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("zh-CN", { hour12: false });
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

const FILTERS: readonly { readonly value: TodoFilter; readonly label: string }[] = [
  { value: "all", label: "全部" },
  { value: "open", label: "未完成" },
  { value: "done", label: "已完成" },
];

function createPageRenderer(context: UiPluginContext): PageRenderer {
  return ({ container }) => {
    ensureStyles();

    const root = createElement("div", "todo-page");
    root.dataset.allinonePlugin = "com.pastsheep.todo";

    const header = createElement("header", "todo-header");
    const heading = createElement("h2", "todo-heading", "待办");
    const summary = createElement("p", "todo-summary");
    const clearButton = createElement("button", "todo-button todo-clear", "清除已完成");
    clearButton.type = "button";
    header.append(heading, summary, clearButton);

    const form = document.createElement("form");
    form.className = "todo-add";
    const input = createElement("input", "todo-input");
    input.type = "text";
    input.placeholder = "添加待办，回车确认";
    input.maxLength = 200;
    input.setAttribute("aria-label", "新建待办标题");

    const prioritySelect = createElement("select", "todo-select");
    prioritySelect.setAttribute("aria-label", "优先级");
    for (const priority of TODO_PRIORITIES) {
      const option = document.createElement("option");
      option.value = priority;
      option.textContent = TODO_PRIORITY_LABELS[priority];
      prioritySelect.append(option);
    }
    prioritySelect.value = defaultPriority;

    const addButton = createElement("button", "todo-button", "添加");
    addButton.type = "submit";
    form.append(input, prioritySelect, addButton);

    const errorLine = createElement("p", "todo-error");
    errorLine.hidden = true;

    const filterBar = createElement("div", "todo-filters");
    filterBar.setAttribute("role", "group");
    filterBar.setAttribute("aria-label", "筛选待办");
    const filterButtons = new Map<TodoFilter, HTMLButtonElement>();
    for (const { value, label } of FILTERS) {
      const button = createElement("button", "todo-button todo-filter", label);
      button.type = "button";
      button.addEventListener("click", () => {
        void setFilter(context, value);
      });
      filterBar.append(button);
      filterButtons.set(value, button);
    }

    const list = createElement("ul", "todo-list");
    const empty = createElement("p", "todo-empty");

    root.append(header, form, errorLine, filterBar, list, empty);
    container.append(root);

    const showError = (message?: string): void => {
      errorLine.hidden = message === undefined;
      errorLine.textContent = message ?? "";
    };

    const renderItem = (item: TodoItem): HTMLLIElement => {
      const row = createElement("li", "todo-item");
      row.classList.toggle("is-done", item.done);

      const checkbox = createElement("input", "todo-check");
      checkbox.type = "checkbox";
      checkbox.checked = item.done;
      checkbox.setAttribute(
        "aria-label",
        `标记「${item.title}」为${item.done ? "未完成" : "已完成"}`,
      );
      checkbox.addEventListener("change", () => {
        void toggleTodo(context, item.id);
      });

      const body = createElement("div", "todo-item-body");
      const title = createElement("span", "todo-item-title", item.title);
      const metaParts = [`创建于 ${formatDateTime(item.createdAt)}`];
      if (item.done && item.completedAt) {
        metaParts.push(`完成于 ${formatDateTime(item.completedAt)}`);
      }
      const meta = createElement("span", "todo-item-meta", metaParts.join(" · "));
      body.append(title, meta);

      const priority = createElement(
        "span",
        `todo-priority todo-priority-${item.priority}`,
        TODO_PRIORITY_LABELS[item.priority],
      );

      const removeButton = createElement("button", "todo-button todo-delete", "删除");
      removeButton.type = "button";
      removeButton.addEventListener("click", () => {
        void deleteTodo(context, item.id);
      });

      row.append(checkbox, body, priority, removeButton);
      return row;
    };

    const render = (): void => {
      const openCount = state.items.filter((item) => !item.done).length;
      summary.textContent = `${openCount} 项未完成 · 共 ${state.items.length} 项`;

      for (const [filter, button] of filterButtons) {
        const active = state.filter === filter;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      }

      const visible = filterTodoItems(state.items, state.filter);
      list.replaceChildren(...visible.map(renderItem));
      empty.hidden = visible.length > 0;
      empty.textContent =
        state.filter === "open"
          ? "没有未完成的待办。"
          : state.filter === "done"
            ? "还没有已完成的待办。"
            : "还没有待办，先添加一条。";
      clearButton.disabled = !state.items.some((item) => item.done);
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (input.value.trim().length === 0) {
        input.focus();
        return;
      }
      addButton.disabled = true;
      void (async () => {
        try {
          await addTodo(context, input.value, prioritySelect.value);
          input.value = "";
          showError();
          input.focus();
        } catch (error) {
          context.logger.error("failed to add todo", { error: describeError(error) });
          showError(describeError(error));
        } finally {
          addButton.disabled = false;
        }
      })();
    });

    clearButton.addEventListener("click", () => {
      clearButton.disabled = true;
      void (async () => {
        try {
          const removed = await context.commands.execute<number>(TODO_CLEAR_COMPLETED_COMMAND, {
            source: "ui",
          });
          await refresh(context, true);
          showError(removed > 0 ? undefined : "没有可清除的待办。");
        } catch (error) {
          context.logger.error("failed to clear completed todos", {
            error: describeError(error),
          });
          showError(describeError(error));
          clearButton.disabled = !state.items.some((item) => item.done);
        }
      })();
    });

    redrawers.add(render);
    render();

    return () => {
      redrawers.delete(render);
      root.remove();
    };
  };
}

function createSidebarRenderer(context: UiPluginContext): RegionSlotRenderer {
  return ({ container }) => {
    ensureStyles();

    const root = createElement("div", "todo-sidebar");
    root.dataset.allinonePlugin = "com.pastsheep.todo";

    const heading = createElement("h3", "todo-sidebar-heading", "待办");
    const count = createElement("p", "todo-sidebar-count");

    const form = document.createElement("form");
    form.className = "todo-sidebar-add";
    const input = createElement("input", "todo-sidebar-input");
    input.type = "text";
    input.placeholder = "快速添加";
    input.maxLength = 200;
    input.setAttribute("aria-label", "快速添加待办");
    const addButton = createElement("button", "todo-button", "添加");
    addButton.type = "submit";
    form.append(input, addButton);

    root.append(heading, count, form);
    container.append(root);

    const render = (): void => {
      const openCount = state.items.filter((item) => !item.done).length;
      count.textContent = openCount === 0 ? "全部完成" : `${openCount} 项未完成`;
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const title = input.value;
      if (title.trim().length === 0) {
        return;
      }
      addButton.disabled = true;
      void (async () => {
        try {
          await addTodo(context, title, defaultPriority);
          input.value = "";
        } catch (error) {
          context.logger.error("failed to add todo from sidebar", {
            error: describeError(error),
          });
        } finally {
          addButton.disabled = false;
        }
      })();
    });

    redrawers.add(render);
    render();

    return () => {
      redrawers.delete(render);
      root.remove();
    };
  };
}

function createStatusbarRenderer(): RegionSlotRenderer {
  return ({ container }) => {
    ensureStyles();

    const root = createElement("span", "todo-statusbar");
    root.dataset.allinonePlugin = "com.pastsheep.todo";
    container.append(root);

    const render = (): void => {
      const openCount = state.items.filter((item) => !item.done).length;
      root.textContent = openCount === 0 ? "待办 · 全部完成" : `待办 · ${openCount} 项未完成`;
    };

    redrawers.add(render);
    render();

    return () => {
      redrawers.delete(render);
      root.remove();
    };
  };
}

export async function activate(context: UiPluginContext): Promise<void> {
  ensureStyles();
  defaultPriority = readDefaultPriority(context);
  configSubscription = context.config.onChange((event) => {
    if (event.key === "defaultPriority") {
      defaultPriority = readDefaultPriority(context);
    }
  });

  await refresh(context);

  context.ui.registerPage(TODO_PAGE_ID, createPageRenderer(context));
  context.ui.registerSlotRenderer(TODO_SIDEBAR_SLOT_ID, createSidebarRenderer(context));
  context.ui.registerSlotRenderer(TODO_STATUSBAR_SLOT_ID, createStatusbarRenderer());

  ipcSubscription = context.ipc.on(TODO_CHANGED_EVENT, () => {
    void refresh(context, true);
  });

  context.logger.info("todo ui activated", { items: state.items.length });
}

export async function deactivate(): Promise<void> {
  ipcSubscription?.dispose();
  ipcSubscription = undefined;
  configSubscription?.dispose();
  configSubscription = undefined;
  redrawers.clear();
  styleElement?.remove();
  styleElement = undefined;
  loaded = false;
}

// src/store.ts
var TODO_ITEMS_KEY = "items";
var TODO_FILTER_KEY = "lastFilter";
var TODO_ADD_COMMAND = "com.pastsheep.todo.add";
var TODO_CLEAR_COMPLETED_COMMAND = "com.pastsheep.todo.clear-completed";
var TODO_PAGE_ID = "com.pastsheep.todo.page";
var TODO_SIDEBAR_SLOT_ID = "com.pastsheep.todo.sidebar";
var TODO_STATUSBAR_SLOT_ID = "com.pastsheep.todo.statusbar";
var TODO_CHANGED_EVENT = "todos-changed";
var TODO_TITLE_MAX_LENGTH = 200;
var TODO_PRIORITIES = ["low", "normal", "high"];
var TODO_PRIORITY_LABELS = {
  low: "\u4F4E",
  normal: "\u666E\u901A",
  high: "\u9AD8"
};
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
function setTodoDone(item, done) {
  const next = {
    id: item.id,
    title: item.title,
    done,
    priority: item.priority,
    createdAt: item.createdAt
  };
  return done ? { ...next, completedAt: (/* @__PURE__ */ new Date()).toISOString() } : next;
}
function filterTodoItems(items, filter) {
  switch (filter) {
    case "open":
      return items.filter((item) => !item.done);
    case "done":
      return items.filter((item) => item.done);
    default:
      return [...items];
  }
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

// src/ui.ts
var TODO_STYLE_ID = "allinone-todo-styles";
var TODO_STYLE = `
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
var state = { items: [], filter: "all" };
var loaded = false;
var pendingLoad = null;
var defaultPriority = "normal";
var styleElement;
var ipcSubscription;
var configSubscription;
var redrawers = /* @__PURE__ */ new Set();
function ensureStyles() {
  if (document.getElementById(TODO_STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = TODO_STYLE_ID;
  style.textContent = TODO_STYLE;
  document.head.append(style);
  styleElement = style;
}
function describeError(error) {
  return error instanceof Error ? error.message : String(error);
}
async function loadState(context, force = false) {
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
function notify() {
  for (const redraw of redrawers) {
    redraw();
  }
}
async function refresh(context, force = false) {
  await loadState(context, force);
  notify();
}
async function commitItems(context, items) {
  await writeTodoItems(context.storage, items);
  state = { items, filter: state.filter };
  notify();
}
async function toggleTodo(context, id) {
  const item = state.items.find((entry) => entry.id === id);
  if (!item) {
    return;
  }
  const items = state.items.map(
    (entry) => entry.id === id ? setTodoDone(entry, !entry.done) : entry
  );
  try {
    await commitItems(context, items);
  } catch (error) {
    context.logger.error("failed to update todo", { error: describeError(error) });
    await refresh(context, true);
  }
}
async function deleteTodo(context, id) {
  const items = state.items.filter((entry) => entry.id !== id);
  try {
    await commitItems(context, items);
  } catch (error) {
    context.logger.error("failed to delete todo", { error: describeError(error) });
    await refresh(context, true);
  }
}
async function addTodo(context, title, priority) {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return false;
  }
  const selected = isTodoPriority(priority) ? priority : defaultPriority;
  await context.commands.execute(TODO_ADD_COMMAND, {
    source: "ui",
    payload: { title: trimmed, priority: selected }
  });
  await refresh(context, true);
  return true;
}
async function setFilter(context, filter) {
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
function readDefaultPriority(context) {
  const configured = context.config.get("defaultPriority", "normal");
  return isTodoPriority(configured) ? configured : "normal";
}
function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("zh-CN", { hour12: false });
}
function createElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== void 0) {
    element.textContent = text;
  }
  return element;
}
var FILTERS = [
  { value: "all", label: "\u5168\u90E8" },
  { value: "open", label: "\u672A\u5B8C\u6210" },
  { value: "done", label: "\u5DF2\u5B8C\u6210" }
];
function createPageRenderer(context) {
  return ({ container }) => {
    ensureStyles();
    const root = createElement("div", "todo-page");
    root.dataset.allinonePlugin = "com.pastsheep.todo";
    const header = createElement("header", "todo-header");
    const heading = createElement("h2", "todo-heading", "\u5F85\u529E");
    const summary = createElement("p", "todo-summary");
    const clearButton = createElement("button", "todo-button todo-clear", "\u6E05\u9664\u5DF2\u5B8C\u6210");
    clearButton.type = "button";
    header.append(heading, summary, clearButton);
    const form = document.createElement("form");
    form.className = "todo-add";
    const input = createElement("input", "todo-input");
    input.type = "text";
    input.placeholder = "\u6DFB\u52A0\u5F85\u529E\uFF0C\u56DE\u8F66\u786E\u8BA4";
    input.maxLength = 200;
    input.setAttribute("aria-label", "\u65B0\u5EFA\u5F85\u529E\u6807\u9898");
    const prioritySelect = createElement("select", "todo-select");
    prioritySelect.setAttribute("aria-label", "\u4F18\u5148\u7EA7");
    for (const priority of TODO_PRIORITIES) {
      const option = document.createElement("option");
      option.value = priority;
      option.textContent = TODO_PRIORITY_LABELS[priority];
      prioritySelect.append(option);
    }
    prioritySelect.value = defaultPriority;
    const addButton = createElement("button", "todo-button", "\u6DFB\u52A0");
    addButton.type = "submit";
    form.append(input, prioritySelect, addButton);
    const errorLine = createElement("p", "todo-error");
    errorLine.hidden = true;
    const filterBar = createElement("div", "todo-filters");
    filterBar.setAttribute("role", "group");
    filterBar.setAttribute("aria-label", "\u7B5B\u9009\u5F85\u529E");
    const filterButtons = /* @__PURE__ */ new Map();
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
    const showError = (message) => {
      errorLine.hidden = message === void 0;
      errorLine.textContent = message ?? "";
    };
    const renderItem = (item) => {
      const row = createElement("li", "todo-item");
      row.classList.toggle("is-done", item.done);
      const checkbox = createElement("input", "todo-check");
      checkbox.type = "checkbox";
      checkbox.checked = item.done;
      checkbox.setAttribute(
        "aria-label",
        `\u6807\u8BB0\u300C${item.title}\u300D\u4E3A${item.done ? "\u672A\u5B8C\u6210" : "\u5DF2\u5B8C\u6210"}`
      );
      checkbox.addEventListener("change", () => {
        void toggleTodo(context, item.id);
      });
      const body = createElement("div", "todo-item-body");
      const title = createElement("span", "todo-item-title", item.title);
      const metaParts = [`\u521B\u5EFA\u4E8E ${formatDateTime(item.createdAt)}`];
      if (item.done && item.completedAt) {
        metaParts.push(`\u5B8C\u6210\u4E8E ${formatDateTime(item.completedAt)}`);
      }
      const meta = createElement("span", "todo-item-meta", metaParts.join(" \xB7 "));
      body.append(title, meta);
      const priority = createElement(
        "span",
        `todo-priority todo-priority-${item.priority}`,
        TODO_PRIORITY_LABELS[item.priority]
      );
      const removeButton = createElement("button", "todo-button todo-delete", "\u5220\u9664");
      removeButton.type = "button";
      removeButton.addEventListener("click", () => {
        void deleteTodo(context, item.id);
      });
      row.append(checkbox, body, priority, removeButton);
      return row;
    };
    const render = () => {
      const openCount = state.items.filter((item) => !item.done).length;
      summary.textContent = `${openCount} \u9879\u672A\u5B8C\u6210 \xB7 \u5171 ${state.items.length} \u9879`;
      for (const [filter, button] of filterButtons) {
        const active = state.filter === filter;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      }
      const visible = filterTodoItems(state.items, state.filter);
      list.replaceChildren(...visible.map(renderItem));
      empty.hidden = visible.length > 0;
      empty.textContent = state.filter === "open" ? "\u6CA1\u6709\u672A\u5B8C\u6210\u7684\u5F85\u529E\u3002" : state.filter === "done" ? "\u8FD8\u6CA1\u6709\u5DF2\u5B8C\u6210\u7684\u5F85\u529E\u3002" : "\u8FD8\u6CA1\u6709\u5F85\u529E\uFF0C\u5148\u6DFB\u52A0\u4E00\u6761\u3002";
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
          const removed = await context.commands.execute(TODO_CLEAR_COMPLETED_COMMAND, {
            source: "ui"
          });
          await refresh(context, true);
          showError(removed > 0 ? void 0 : "\u6CA1\u6709\u53EF\u6E05\u9664\u7684\u5F85\u529E\u3002");
        } catch (error) {
          context.logger.error("failed to clear completed todos", {
            error: describeError(error)
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
function createSidebarRenderer(context) {
  return ({ container }) => {
    ensureStyles();
    const root = createElement("div", "todo-sidebar");
    root.dataset.allinonePlugin = "com.pastsheep.todo";
    const heading = createElement("h3", "todo-sidebar-heading", "\u5F85\u529E");
    const count = createElement("p", "todo-sidebar-count");
    const form = document.createElement("form");
    form.className = "todo-sidebar-add";
    const input = createElement("input", "todo-sidebar-input");
    input.type = "text";
    input.placeholder = "\u5FEB\u901F\u6DFB\u52A0";
    input.maxLength = 200;
    input.setAttribute("aria-label", "\u5FEB\u901F\u6DFB\u52A0\u5F85\u529E");
    const addButton = createElement("button", "todo-button", "\u6DFB\u52A0");
    addButton.type = "submit";
    form.append(input, addButton);
    root.append(heading, count, form);
    container.append(root);
    const render = () => {
      const openCount = state.items.filter((item) => !item.done).length;
      count.textContent = openCount === 0 ? "\u5168\u90E8\u5B8C\u6210" : `${openCount} \u9879\u672A\u5B8C\u6210`;
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
            error: describeError(error)
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
function createStatusbarRenderer() {
  return ({ container }) => {
    ensureStyles();
    const root = createElement("span", "todo-statusbar");
    root.dataset.allinonePlugin = "com.pastsheep.todo";
    container.append(root);
    const render = () => {
      const openCount = state.items.filter((item) => !item.done).length;
      root.textContent = openCount === 0 ? "\u5F85\u529E \xB7 \u5168\u90E8\u5B8C\u6210" : `\u5F85\u529E \xB7 ${openCount} \u9879\u672A\u5B8C\u6210`;
    };
    redrawers.add(render);
    render();
    return () => {
      redrawers.delete(render);
      root.remove();
    };
  };
}
async function activate(context) {
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
async function deactivate() {
  ipcSubscription?.dispose();
  ipcSubscription = void 0;
  configSubscription?.dispose();
  configSubscription = void 0;
  redrawers.clear();
  styleElement?.remove();
  styleElement = void 0;
  loaded = false;
}
export {
  activate,
  deactivate
};

const STORAGE_KEY = "home-dashboard-notes-v1";

const defaultState = {
  watch: [],
  cactus: [],
};

const formatDate = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

const todayFormatter = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const telegram = window.Telegram?.WebApp;
const config = await loadConfig();
const hasTelegramSession = Boolean(telegram?.initData);
const useSecureApi = Boolean(config?.secureApi && hasTelegramSession);
const state = useSecureApi ? { ...defaultState } : loadLocalState();

setupTelegram();
setupHeader();
await loadInitialNotes();

document.querySelectorAll("[data-widget-id]").forEach((widget) => {
  const widgetId = widget.dataset.widgetId;
  const form = widget.querySelector("[data-note-form]");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const text = String(formData.get("note") || "").trim();

    if (!text) {
      return;
    }

    try {
      form.querySelector("button").disabled = true;
      const note = await createNote(widgetId, text);

      state[widgetId].unshift(note);

      if (!useSecureApi) {
        saveLocalState();
      }

      form.reset();
      renderWidget(widget);
      telegram?.HapticFeedback?.notificationOccurred?.("success");
    } catch (error) {
      showAccessError(error);
    } finally {
      form.querySelector("button").disabled = false;
    }
  });

  renderWidget(widget);
});

async function loadConfig() {
  try {
    const module = await import("./config.js");
    return module.APP_CONFIG;
  } catch {
    return null;
  }
}

function setupTelegram() {
  if (!telegram) {
    return;
  }

  document.body.classList.add("telegram-mini-app");
  telegram.ready();
  telegram.expand();

  const backgroundColor = telegram.themeParams?.bg_color || "#f7f2ea";
  telegram.setHeaderColor(backgroundColor);
  telegram.setBackgroundColor(backgroundColor);
}

function setupHeader() {
  document.querySelector("#today").textContent = todayFormatter.format(new Date());

  const status = document.querySelector("#app-status");
  const userName = telegram?.initDataUnsafe?.user?.first_name;

  if (useSecureApi) {
    status.textContent = userName ? `Telegram: ${userName}` : "Telegram";
    status.classList.add("is-online");
    return;
  }

  status.textContent = telegram ? "Telegram, демо" : "Локальный демо";
}

async function loadInitialNotes() {
  if (!useSecureApi) {
    return;
  }

  try {
    const notes = await apiRequest("/api/notes");

    Object.keys(defaultState).forEach((widgetId) => {
      state[widgetId] = [];
    });

    notes.forEach((note) => {
      if (!state[note.widgetId]) {
        state[note.widgetId] = [];
      }

      state[note.widgetId].push(note);
    });
  } catch (error) {
    showAccessError(error);
  }
}

function loadLocalState() {
  try {
    const savedState = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      ...defaultState,
      ...(savedState && typeof savedState === "object" ? savedState : {}),
    };
  } catch {
    return { ...defaultState };
  }
}

function saveLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function createNote(widgetId, text) {
  const fallbackNote = {
    id: crypto.randomUUID(),
    widgetId,
    text,
    createdAt: new Date().toISOString(),
  };

  if (!useSecureApi) {
    return fallbackNote;
  }

  return apiRequest("/api/notes", {
    method: "POST",
    body: JSON.stringify({
      widgetId,
      text,
    }),
  });
}

async function deleteNote(widgetId, noteId) {
  if (useSecureApi) {
    await apiRequest(`/api/notes?id=${encodeURIComponent(noteId)}`, {
      method: "DELETE",
    });
  }

  state[widgetId] = state[widgetId].filter((item) => item.id !== noteId);

  if (!useSecureApi) {
    saveLocalState();
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": telegram.initData,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function showAccessError(error) {
  console.error(error);

  const status = document.querySelector("#app-status");
  const userId = telegram?.initDataUnsafe?.user?.id;

  status.textContent = userId ? `Нет доступа: ${userId}` : "Нет доступа";
  status.classList.remove("is-online");
  status.classList.add("is-error");
  document.querySelectorAll(".note-form button").forEach((button) => {
    button.disabled = true;
  });
}

function renderWidget(widget) {
  const widgetId = widget.dataset.widgetId;
  const notes = state[widgetId] || [];
  const list = widget.querySelector("[data-notes-list]");
  const counter = widget.querySelector("[data-counter]");
  const template = document.querySelector("#note-template");

  counter.textContent = String(notes.length);
  list.replaceChildren();

  if (!notes.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = useSecureApi
      ? "Пока пусто. Добавьте первую семейную заметку."
      : "Демо-режим: заметки сохраняются только в этом браузере.";
    list.append(empty);
    return;
  }

  notes.forEach((note) => {
    const noteElement = template.content.firstElementChild.cloneNode(true);
    const noteText = noteElement.querySelector(".note-text");
    const noteTime = noteElement.querySelector("time");
    const deleteButton = noteElement.querySelector("[data-delete]");

    noteText.textContent = note.text;
    noteTime.dateTime = note.createdAt;
    noteTime.textContent = note.author
      ? `${note.author}, ${formatDate.format(new Date(note.createdAt))}`
      : formatDate.format(new Date(note.createdAt));

    deleteButton.addEventListener("click", async () => {
      try {
        deleteButton.disabled = true;
        await deleteNote(widgetId, note.id);
        renderWidget(widget);
        telegram?.HapticFeedback?.impactOccurred?.("light");
      } catch (error) {
        showAccessError(error);
      }
    });

    list.append(noteElement);
  });
}

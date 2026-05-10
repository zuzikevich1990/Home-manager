const STORAGE_KEY = "home-dashboard-notes-v1";

const defaultState = {
  watch: [],
  cactus: [],
};

const widgetLabels = {
  watch: "Что смотрим",
  cactus: "Кактус",
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
const hasSupabase = Boolean(config?.supabaseUrl && config?.supabaseAnonKey);
const state = hasSupabase ? { ...defaultState } : loadLocalState();

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

    const note = await createNote(widgetId, text);

    state[widgetId].unshift(note);
    if (!hasSupabase) {
      saveLocalState();
    }
    form.reset();
    renderWidget(widget);
    telegram?.HapticFeedback?.notificationOccurred?.("success");
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
  telegram.setHeaderColor("#f7f2ea");
  telegram.setBackgroundColor("#f7f2ea");
}

function setupHeader() {
  document.querySelector("#today").textContent = todayFormatter.format(new Date());

  const status = document.querySelector("#app-status");
  const userName = telegram?.initDataUnsafe?.user?.first_name;

  if (hasSupabase) {
    status.textContent = userName ? `Telegram: ${userName}` : "Общая база";
    status.classList.add("is-online");
    return;
  }

  status.textContent = telegram ? "Telegram, локально" : "Локальный режим";
}

async function loadInitialNotes() {
  if (!hasSupabase) {
    return;
  }

  try {
    const notes = await supabaseRequest("/rest/v1/notes?select=*&order=created_at.desc");

    Object.keys(defaultState).forEach((widgetId) => {
      state[widgetId] = [];
    });

    notes.forEach((note) => {
      if (!state[note.widget_id]) {
        state[note.widget_id] = [];
      }

      state[note.widget_id].push(mapRemoteNote(note));
    });
  } catch (error) {
    console.error(error);
    Object.assign(state, loadLocalState());
    document.querySelector("#app-status").textContent = "База недоступна";
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

  if (!hasSupabase) {
    return fallbackNote;
  }

  const telegramUser = telegram?.initDataUnsafe?.user;
  const [remoteNote] = await supabaseRequest("/rest/v1/notes?select=*", {
    method: "POST",
    body: JSON.stringify({
      widget_id: widgetId,
      widget_label: widgetLabels[widgetId],
      text,
      telegram_user_id: telegramUser?.id || null,
      telegram_first_name: telegramUser?.first_name || null,
    }),
    headers: {
      Prefer: "return=representation",
    },
  });

  return mapRemoteNote(remoteNote);
}

async function deleteNote(widgetId, noteId) {
  if (hasSupabase) {
    await supabaseRequest(`/rest/v1/notes?id=eq.${noteId}`, {
      method: "DELETE",
    });
  }

  state[widgetId] = state[widgetId].filter((item) => item.id !== noteId);

  if (!hasSupabase) {
    saveLocalState();
  }
}

async function supabaseRequest(path, options = {}) {
  const headers = {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`,
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const response = await fetch(`${config.supabaseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function mapRemoteNote(note) {
  return {
    id: note.id,
    widgetId: note.widget_id,
    text: note.text,
    createdAt: note.created_at,
    author: note.telegram_first_name,
  };
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
    empty.textContent = "Пока пусто. Добавьте первую заметку.";
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
      deleteButton.disabled = true;
      await deleteNote(widgetId, note.id);
      renderWidget(widget);
      telegram?.HapticFeedback?.impactOccurred?.("light");
    });

    list.append(noteElement);
  });
}

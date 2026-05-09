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

const state = loadState();

document.querySelector("#today").textContent = todayFormatter.format(new Date());

document.querySelectorAll("[data-widget-id]").forEach((widget) => {
  const widgetId = widget.dataset.widgetId;
  const form = widget.querySelector("[data-note-form]");

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const text = String(formData.get("note") || "").trim();

    if (!text) {
      return;
    }

    state[widgetId].unshift({
      id: crypto.randomUUID(),
      text,
      createdAt: new Date().toISOString(),
    });

    saveState();
    form.reset();
    renderWidget(widget);
  });

  renderWidget(widget);
});

function loadState() {
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

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderWidget(widget) {
  const widgetId = widget.dataset.widgetId;
  const notes = state[widgetId] || [];
  const list = widget.querySelector("[data-notes-list]");
  const counter = widget.querySelector("[data-counter]");
  const template = document.querySelector("#note-template");

  counter.textContent = String(notes.length);
  list.replaceChildren();

  notes.forEach((note) => {
    const noteElement = template.content.firstElementChild.cloneNode(true);
    const noteText = noteElement.querySelector(".note-text");
    const noteTime = noteElement.querySelector("time");
    const deleteButton = noteElement.querySelector("[data-delete]");

    noteText.textContent = note.text;
    noteTime.dateTime = note.createdAt;
    noteTime.textContent = formatDate.format(new Date(note.createdAt));
    deleteButton.addEventListener("click", () => {
      state[widgetId] = state[widgetId].filter((item) => item.id !== note.id);
      saveState();
      renderWidget(widget);
    });

    list.append(noteElement);
  });
}

const { registerTool } = require("./index");
const { listTasks, addTask, completeTask } = require("./tasks");

function friendlyError(e) {
  if (e.message === "NOT_CONNECTED") {
    return "Konto Google nie jest jeszcze polaczone. Poproszmy uzytkownika, zeby wszedl na /auth/google i sie zalogowal.";
  }
  throw e;
}

registerTool(
  {
    name: "get_tasks",
    description: "Pobiera aktualna zawartosc listy zadan lub listy zakupow uzytkownika.",
    input_schema: {
      type: "object",
      properties: {
        list: {
          type: "string",
          enum: ["zakupy", "zadania"],
          description: "Ktora lista: zakupy albo zadania.",
        },
      },
      required: ["list"],
    },
  },
  async ({ list }) => {
    try {
      const items = await listTasks(list);
      if (items.length === 0) return `Lista "${list}" jest teraz pusta.`;
      return items.map((i) => i.title).join(", ");
    } catch (e) {
      return friendlyError(e);
    }
  }
);

registerTool(
  {
    name: "add_task",
    description: "Dodaje nowa pozycje do listy zadan lub listy zakupow.",
    input_schema: {
      type: "object",
      properties: {
        list: { type: "string", enum: ["zakupy", "zadania"] },
        title: { type: "string", description: "Tresc zadania albo nazwa produktu do dodania." },
      },
      required: ["list", "title"],
    },
  },
  async ({ list, title }) => {
    try {
      const created = await addTask(list, title);
      return `Dodano "${created.title}" do listy ${list}.`;
    } catch (e) {
      return friendlyError(e);
    }
  }
);

registerTool(
  {
    name: "complete_task",
    description: "Oznacza pozycje na liscie zadan lub zakupow jako zrobiona/kupiona (odhacza ja).",
    input_schema: {
      type: "object",
      properties: {
        list: { type: "string", enum: ["zakupy", "zadania"] },
        item: { type: "string", description: "Nazwa lub fragment nazwy pozycji do odhaczenia." },
      },
      required: ["list", "item"],
    },
  },
  async ({ list, item }) => {
    try {
      const result = await completeTask(list, item);
      return result.ok ? `Odhaczono "${result.title}".` : result.message;
    } catch (e) {
      return friendlyError(e);
    }
  }
);

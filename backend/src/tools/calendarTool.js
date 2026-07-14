const { registerTool } = require("./index");
const { listUpcomingEvents, createEvent } = require("./calendar");

registerTool(
  {
    name: "get_calendar_events",
    description: "Pobiera nadchodzace wydarzenia z kalendarza Google uzytkownika.",
    input_schema: {
      type: "object",
      properties: {
        max_results: {
          type: "integer",
          description: "Ile najblizszych wydarzen pobrac (domyslnie 5).",
        },
      },
    },
  },
  async ({ max_results }) => {
    try {
      const events = await listUpcomingEvents(max_results || 5);
      if (events.length === 0) return "Brak nadchodzacych wydarzen w kalendarzu.";
      return events
        .map((e) => `${e.title} (${e.allDay ? "caly dzien" : e.start})`)
        .join("; ");
    } catch (e) {
      if (e.message === "NOT_CONNECTED") return "Konto Google nie jest jeszcze polaczone.";
      throw e;
    }
  }
);

registerTool(
  {
    name: "add_calendar_event",
    description:
      "Dodaje nowe wydarzenie do kalendarza Google uzytkownika. Uzyj biezacej daty i godziny z kontekstu systemowego, zeby poprawnie obliczyc daty wzgledne typu 'jutro' czy 'w piatek'.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Tytul wydarzenia." },
        start: {
          type: "string",
          description:
            "Data i godzina rozpoczecia w formacie ISO 8601 ze strefa czasowa, np. 2026-07-15T15:00:00+02:00. Dla wydarzenia calodniowego: sama data YYYY-MM-DD.",
        },
        end: {
          type: "string",
          description:
            "Data i godzina zakonczenia w tym samym formacie co start. Jesli pominiete dla wydarzenia niecalodniowego, przyjmij 1 godzine po starcie.",
        },
        all_day: { type: "boolean", description: "Czy wydarzenie trwa caly dzien." },
      },
      required: ["title", "start"],
    },
  },
  async ({ title, start, end, all_day }) => {
    try {
      let computedEnd = end;
      if (!all_day && !end) {
        const d = new Date(start);
        d.setHours(d.getHours() + 1);
        computedEnd = d.toISOString();
      }
      const created = await createEvent({ title, start, end: computedEnd, allDay: all_day });
      return `Dodano wydarzenie "${created.summary}" do kalendarza.`;
    } catch (e) {
      if (e.message === "NOT_CONNECTED") return "Konto Google nie jest jeszcze polaczone.";
      return `Nie udalo sie dodac wydarzenia: ${e.message}`;
    }
  }
);

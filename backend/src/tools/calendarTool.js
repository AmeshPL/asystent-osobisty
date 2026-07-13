const { registerTool } = require("./index");
const { listUpcomingEvents } = require("./calendar");

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

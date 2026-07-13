const { registerTool } = require("./index");
const { listUnreadEmails } = require("./gmail");

registerTool(
  {
    name: "get_unread_emails",
    description: "Pobiera nieprzeczytane wiadomosci z glownej skrzynki Gmail uzytkownika (nadawca, temat, krotki fragment).",
    input_schema: {
      type: "object",
      properties: {
        max_results: {
          type: "integer",
          description: "Ile ostatnich nieprzeczytanych maili pobrac (domyslnie 5).",
        },
      },
    },
  },
  async ({ max_results }) => {
    try {
      const emails = await listUnreadEmails(max_results || 5);
      if (emails.length === 0) return "Brak nieprzeczytanych wiadomosci w skrzynce odbiorczej.";
      return emails
        .map((e) => `Od ${e.from}, temat: ${e.subject} - ${e.snippet}`)
        .join(" | ");
    } catch (e) {
      if (e.message === "NOT_CONNECTED") return "Konto Google nie jest jeszcze polaczone.";
      throw e;
    }
  }
);

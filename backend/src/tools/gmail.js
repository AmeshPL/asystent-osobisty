const { google } = require("googleapis");
const { getAuthorizedClient } = require("../googleAuth");

async function getGmailApi() {
  const auth = getAuthorizedClient();
  if (!auth) throw new Error("NOT_CONNECTED");
  return google.gmail({ version: "v1", auth });
}

async function listUnreadEmails(maxResults = 5) {
  const gmailApi = await getGmailApi();
  const { data } = await gmailApi.users.messages.list({
    userId: "me",
    maxResults,
    q: "is:unread in:inbox",
  });

  const messages = data.messages || [];
  return Promise.all(
    messages.map(async (m) => {
      const { data: msg } = await gmailApi.users.messages.get({
        userId: "me",
        id: m.id,
        format: "metadata",
        metadataHeaders: ["From", "Subject"],
      });
      const headers = msg.payload?.headers || [];
      const from = headers.find((h) => h.name === "From")?.value || "nieznany nadawca";
      const subject = headers.find((h) => h.name === "Subject")?.value || "(bez tematu)";
      return { from, subject, snippet: msg.snippet };
    })
  );
}

module.exports = { listUnreadEmails };

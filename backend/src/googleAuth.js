const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const TOKENS_PATH = path.join(__dirname, "..", "tokens.json");

const SCOPES = [
  "https://www.googleapis.com/auth/tasks",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.readonly",
];

function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function loadTokens() {
  if (!fs.existsSync(TOKENS_PATH)) return null;
  return JSON.parse(fs.readFileSync(TOKENS_PATH, "utf8"));
}

function saveTokens(tokens) {
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
}

function getAuthUrl() {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

async function handleCallback(code) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  const existing = loadTokens() || {};
  saveTokens({ ...existing, ...tokens });
  return tokens;
}

function getAuthorizedClient() {
  // Na hostingu z ulotnym dyskiem (np. darmowy Render) tokens.json znika przy
  // restarcie, wiec w produkcji trzymamy refresh token w zmiennej srodowiskowej.
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    const client = createOAuthClient();
    client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return client;
  }

  const tokens = loadTokens();
  if (!tokens) return null;
  const client = createOAuthClient();
  client.setCredentials(tokens);
  client.on("tokens", (newTokens) => {
    saveTokens({ ...loadTokens(), ...newTokens });
  });
  return client;
}

function isConnected() {
  return !!process.env.GOOGLE_REFRESH_TOKEN || !!loadTokens();
}

module.exports = { getAuthUrl, handleCallback, getAuthorizedClient, isConnected };

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const { chat } = require("./src/claude");
const { getAuthUrl, handleCallback, isConnected } = require("./src/googleAuth");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "frontend")));

function requirePin(req, res, next) {
  const expected = process.env.ASSISTANT_PIN;
  if (!expected) return next();
  const provided = req.header("x-assistant-pin") || req.query.pin;
  if (provided !== expected) return res.status(401).json({ error: "Nieprawidlowy PIN." });
  next();
}

app.get("/auth/google", requirePin, (req, res) => {
  res.redirect(getAuthUrl());
});

function statusPage({ title, message, ok }) {
  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  body { margin:0; min-height:100dvh; display:flex; align-items:center; justify-content:center;
    background:#0f1115; color:#eef0f4; font-family:-apple-system,"Segoe UI",Roboto,sans-serif; text-align:center; }
  main { padding:2rem; max-width:320px; }
  p { color:#8a8f99; margin-bottom:1.75rem; }
  a { display:inline-block; background:${ok ? "#5b8cff" : "#333947"}; color:white; text-decoration:none;
    padding:0.75rem 1.5rem; border-radius:999px; font-weight:600; }
</style></head>
<body><main>
  <h1>${title}</h1>
  <p>${message}</p>
  <a href="/">Wroc do asystenta</a>
</main></body></html>`;
}

app.get("/auth/google/callback", async (req, res) => {
  try {
    await handleCallback(req.query.code);
    res.send(statusPage({ title: "Konto Google polaczone", message: "Mozesz wrocic do asystenta.", ok: true }));
  } catch (err) {
    console.error(err);
    res.status(500).send(statusPage({ title: "Blad polaczenia", message: "Nie udalo sie polaczyc konta Google. Sprobuj ponownie.", ok: false }));
  }
});

app.get("/api/google/status", requirePin, (req, res) => {
  res.json({ connected: isConnected() });
});

// Historia rozmowy trzymana w pamieci procesu (jeden uzytkownik, jedna sesja na raz).
let conversation = [];

app.post("/api/chat", requirePin, async (req, res) => {
  try {
    const { message, reset } = req.body;
    if (reset) conversation = [];

    conversation.push({ role: "user", content: message });
    const { text, messages } = await chat(conversation);
    conversation = messages;

    res.json({ reply: text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Blad po stronie serwera." });
  }
});

app.post("/api/reset", requirePin, (req, res) => {
  conversation = [];
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Asystent dziala na http://localhost:${PORT}`));

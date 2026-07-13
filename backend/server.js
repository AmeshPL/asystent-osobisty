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

app.get("/auth/google/callback", async (req, res) => {
  try {
    await handleCallback(req.query.code);
    res.send("Konto Google polaczone. Mozesz zamknac ta karte i wrocic do asystenta.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Blad podczas laczenia z kontem Google.");
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

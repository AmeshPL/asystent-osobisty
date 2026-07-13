const talkBtn = document.getElementById("talkBtn");
const resetBtn = document.getElementById("resetBtn");
const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");
const pinOverlay = document.getElementById("pinOverlay");
const pinInput = document.getElementById("pinInput");
const pinSubmit = document.getElementById("pinSubmit");
const pinError = document.getElementById("pinError");
const googleBanner = document.getElementById("googleBanner");
const waveformEl = document.getElementById("waveform");
const waveformBars = [...waveformEl.children];

const PIN_KEY = "assistantPin";
const getPin = () => localStorage.getItem(PIN_KEY) || "";
const setPin = (v) => localStorage.setItem(PIN_KEY, v);
const clearPin = () => localStorage.removeItem(PIN_KEY);

function authFetch(url, options = {}) {
  const headers = { ...(options.headers || {}), "X-Assistant-Pin": getPin() };
  return fetch(url, { ...options, headers });
}

function showPinOverlay(message) {
  pinOverlay.hidden = false;
  pinError.hidden = !message;
  if (message) pinError.textContent = message;
  pinInput.value = "";
  pinInput.focus();
}

function hidePinOverlay() {
  pinOverlay.hidden = true;
}

async function tryUnlock() {
  const pin = pinInput.value.trim();
  if (!pin) return;
  const res = await authFetch("/api/google/status");
  if (res.status === 401) {
    showPinOverlay("Nieprawidlowy PIN, sprobuj ponownie.");
    return;
  }
  setPin(pin);
  hidePinOverlay();
  initAfterUnlock();
}

pinSubmit.addEventListener("click", () => {
  setPin(pinInput.value.trim());
  tryUnlock();
});
pinInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    setPin(pinInput.value.trim());
    tryUnlock();
  }
});

const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let busy = false;

if (SpeechRecognitionCtor) {
  recognition = new SpeechRecognitionCtor();
  recognition.lang = "pl-PL";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
} else {
  statusEl.textContent = "Ta przegladarka nie wspiera rozpoznawania mowy. Uzyj Chrome na Androidzie.";
  talkBtn.disabled = true;
}

let polishVoice = null;
function pickPolishVoice() {
  const voices = speechSynthesis.getVoices();
  polishVoice = voices.find((v) => v.lang === "pl-PL") || voices.find((v) => v.lang?.startsWith("pl")) || null;
}
speechSynthesis.onvoiceschanged = pickPolishVoice;
pickPolishVoice();

let audioCtx = null;
let analyser = null;
let micStream = null;
let waveformRAF = null;

async function ensureMicStream() {
  if (micStream) return micStream;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    audioCtx.createMediaStreamSource(micStream).connect(analyser);
  } catch (err) {
    console.error("Brak dostepu do mikrofonu dla wizualizacji:", err);
  }
  return micStream;
}

function setBarHeight(bar, ratio) {
  bar.style.height = `${6 + Math.max(0, Math.min(1, ratio)) * 34}px`;
}

function animateListeningBars() {
  if (!analyser) return;
  const data = new Uint8Array(analyser.frequencyBinCount);
  const loop = () => {
    analyser.getByteFrequencyData(data);
    waveformBars.forEach((bar, i) => {
      const v = data[Math.floor((i * data.length) / waveformBars.length)] / 255;
      setBarHeight(bar, v);
    });
    waveformRAF = requestAnimationFrame(loop);
  };
  loop();
}

function animateSpeakingBars() {
  const start = performance.now();
  const loop = (t) => {
    const elapsed = (t - start) / 1000;
    waveformBars.forEach((bar, i) => {
      const v = ((Math.sin(elapsed * 7 + i * 0.9) + 1) / 2) * (0.55 + Math.random() * 0.45);
      setBarHeight(bar, v);
    });
    waveformRAF = requestAnimationFrame(loop);
  };
  waveformRAF = requestAnimationFrame(loop);
}

function stopWaveform() {
  if (waveformRAF) cancelAnimationFrame(waveformRAF);
  waveformRAF = null;
  waveformEl.classList.remove("active", "speaking");
  waveformBars.forEach((bar) => setBarHeight(bar, 0));
}

function addBubble(role, text) {
  const div = document.createElement("div");
  div.className = `bubble ${role}`;
  div.textContent = text;
  logEl.appendChild(div);
  div.scrollIntoView({ behavior: "smooth", block: "end" });
}

function setState(state, message) {
  talkBtn.classList.remove("listening", "speaking");
  if (state) talkBtn.classList.add(state);
  statusEl.textContent = message;
}

function speak(text) {
  return new Promise((resolve) => {
    if (!text) return resolve();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "pl-PL";
    if (polishVoice) utter.voice = polishVoice;
    utter.rate = 1.02;
    utter.onend = () => {
      stopWaveform();
      resolve();
    };
    utter.onerror = () => {
      stopWaveform();
      resolve();
    };
    setState("speaking", "Asystent mowi...");
    waveformEl.classList.add("speaking");
    animateSpeakingBars();
    speechSynthesis.speak(utter);
  });
}

async function sendMessage(text) {
  stopWaveform();
  addBubble("user", text);
  setState(null, "Myslenie...");
  try {
    const res = await authFetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });
    if (res.status === 401) {
      clearPin();
      showPinOverlay("Sesja wygasla, podaj PIN ponownie.");
      return;
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    addBubble("assistant", data.reply);
    await speak(data.reply);
  } catch (err) {
    console.error(err);
    addBubble("assistant", "Przepraszam, mam problem z polaczeniem.");
    await speak("Przepraszam, mam problem z polaczeniem.");
  } finally {
    setState(null, "Stuknij, zeby mowic");
    busy = false;
  }
}

async function startListening() {
  if (busy || !recognition) return;
  busy = true;
  setState("listening", "Sluchani...");

  await ensureMicStream();
  waveformEl.classList.add("active");
  animateListeningBars();

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    sendMessage(transcript);
  };

  recognition.onerror = () => {
    stopWaveform();
    setState(null, "Nie udalo sie uslyszec. Sprobuj ponownie.");
    busy = false;
  };

  recognition.onend = () => {
    if (statusEl.textContent === "Sluchani...") {
      stopWaveform();
      setState(null, "Stuknij, zeby mowic");
      busy = false;
    }
  };

  recognition.start();
}

talkBtn.addEventListener("click", startListening);

resetBtn.addEventListener("click", async () => {
  await authFetch("/api/reset", { method: "POST" });
  logEl.innerHTML = "";
  setState(null, "Nowa rozmowa. Stuknij, zeby mowic");
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

function initAfterUnlock() {
  googleBanner.href = `/auth/google?pin=${encodeURIComponent(getPin())}`;
  authFetch("/api/google/status")
    .then((r) => r.json())
    .then((data) => {
      if (!data.connected) googleBanner.hidden = false;
    })
    .catch(() => {});
}

const storedPin = getPin();
if (storedPin) {
  authFetch("/api/google/status").then((res) => {
    if (res.status === 401) {
      clearPin();
      showPinOverlay();
    } else {
      hidePinOverlay();
      initAfterUnlock();
    }
  });
} else {
  showPinOverlay();
}

/*
 * ScamSense · Screen basics
 * Shared screen helpers: levels (scam/suspicious/safe), read aloud, small building blocks.
 */
"use strict";

const view = document.getElementById("view");
const esc = s =>
  String(s == null ? "" : s).replace(
    /[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
const LVB = {
  scam: { pill: "p-scam", dot: "d-scam", icon: "!" },
  warn: { pill: "p-warn", dot: "d-warn", icon: "?" },
  safe: { pill: "p-safe", dot: "d-safe", icon: "✓" }
};
const LV = new Proxy({}, { get: (o, k) => Object.assign({ word: t(k), title: t("t_" + k) }, LVB[k]) });
const ADVICE = {
  scam: [
    "Don't click links, open attachments, call numbers, or reply.",
    "Don't send money, gift cards, or codes.",
    "If you're worried, contact the company or person yourself using a number you already trust.",
    'Report it: in Gmail tap ⋮ then "Report phishing". Forward scam texts to 7726. Report at ReportFraud.ftc.gov.'
  ],
  warn: [
    "Slow down. Don't click links or call numbers in the message yet.",
    "Check it yourself: open the company's app or call the number on your card.",
    "Ask a family member or helper to look at it."
  ],
  safe: ["No scam signs found.", "Still, never share codes or passwords, even if a message looks normal."]
};
function toast(m) {
  let box = document.getElementById("toasts");
  if (!box) {
    box = document.createElement("div");
    box.id = "toasts";
    document.body.appendChild(box);
  }
  const x = document.createElement("div");
  x.className = "toast";
  x.setAttribute("role", "status");
  x.textContent = m;
  box.appendChild(x);
  while (box.children.length > 2) box.firstChild.remove();
  setTimeout(() => x.remove(), 3500);
}
function setStatus() {
  const el = document.getElementById("status");
  const on = S.get("connected", false);
  el.textContent = on ? t("connected") : "";
  el.hidden = !on;
  el.classList.toggle("on", !!on);
}
function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString(LANGS[langCode()].speech, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

/* Read aloud with Pause / Resume / Stop. Text is read in short pieces so long reports don't cut off. */
const Reader = { queue: [], i: 0, paused: false, active: false };
function playerBar() {
  let el = document.getElementById("player");
  if (!el) {
    el = document.createElement("div");
    el.id = "player";
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", "Read aloud");
    el.innerHTML =
      '<span class="pl-label" aria-live="polite"></span><button class="pl-pause" type="button"></button><button class="pl-stop" type="button"></button>';
    document.body.appendChild(el);
    el.querySelector(".pl-pause").onclick = togglePause;
    el.querySelector(".pl-stop").onclick = stopSpeaking;
  }
  return el;
}
function updatePlayer() {
  const el = playerBar();
  el.hidden = !Reader.active;
  el.querySelector(".pl-pause").textContent = Reader.paused ? t("resume") : t("pause");
  el.querySelector(".pl-stop").textContent = t("stop");
  el.querySelector(".pl-label").textContent = Reader.paused ? t("paused") : t("reading");
}
function speakNext() {
  if (!Reader.active) return;
  if (Reader.i >= Reader.queue.length) {
    stopSpeaking();
    return;
  }
  const u = new SpeechSynthesisUtterance(Reader.queue[Reader.i++]);
  u.rate = 0.92;
  u.lang = LANGS[langCode()].speech;
  u.onend = () => {
    if (Reader.active && !Reader.paused) speakNext();
  };
  u.onerror = () => {
    if (Reader.active && !Reader.paused) speakNext();
  };
  speechSynthesis.speak(u);
}
function speak(text) {
  try {
    if (!("speechSynthesis" in window)) throw 0;
    speechSynthesis.cancel();
    Reader.queue = (
      String(text)
        .replace(/\s+/g, " ")
        .match(/[^.!?。！？]+[.!?。！？]*\s*/g) || [text]
    )
      .map(x => x.trim())
      .filter(Boolean);
    Reader.i = 0;
    Reader.paused = false;
    Reader.active = true;
    updatePlayer();
    speakNext();
  } catch (e) {
    toast(t("read_na"));
  }
}
function togglePause() {
  if (!Reader.active) return;
  if (Reader.paused) {
    Reader.paused = false;
    Reader.i = Math.max(0, Reader.i - 1);
    speechSynthesis.cancel();
    updatePlayer();
    speakNext();
  } else {
    Reader.paused = true;
    speechSynthesis.cancel();
    updatePlayer();
  }
}
function stopSpeaking() {
  Reader.active = false;
  Reader.paused = false;
  Reader.queue = [];
  try {
    speechSynthesis.cancel();
  } catch (e) {}
  updatePlayer();
}

/* ----- Speech to text ("Say it"): fills a text box with what the person says, in the app's language ----- */
let listening = null;
const canListenHere = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);
function stopListening() {
  if (listening) listening.stop();
}
/* boxId: the text box to fill. btnId: the mic button (its <span> shows "Say it" / "Listening…"). onText: called with the new text. */
function toggleListening(boxId, btnId, onText, onDone) {
  const btn = document.getElementById(btnId);
  if (listening) {
    listening.stop();
    return;
  }
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new R();
  rec.lang = LANGS[langCode()].speech;
  rec.interimResults = true;
  rec.continuous = true;
  const box = document.getElementById(boxId);
  const before = box.value ? box.value.trim() + " " : "";
  const label = btn.querySelector("span");
  const idle = label.textContent;
  rec.onresult = e => {
    let txt = "";
    for (const r of e.results) txt += r[0].transcript;
    box.value = before + txt;
    if (onText) onText(box.value);
  };
  rec.onend = () => {
    listening = null;
    btn.classList.remove("on");
    btn.setAttribute("aria-pressed", "false");
    label.textContent = idle;
    if (onDone && box.value.trim()) onDone(box.value);
  };
  rec.onerror = e => {
    if (e.error === "not-allowed")
      toast(tr("Please allow the microphone to use Say it.", "Permita el micrófono para usar Dígalo."));
  };
  try {
    rec.start();
    listening = rec;
    btn.classList.add("on");
    btn.setAttribute("aria-pressed", "true");
    label.textContent = tr("Listening… tap to stop", "Escuchando… toque para parar");
  } catch (e) {
    toast(tr("The microphone isn't available right now.", "El micrófono no está disponible ahora."));
  }
}

/*
 * ScamSense · Daily report link
 * Sends a tiny note to your own Daily Report script each time you check something,
 * pause a payment, or open "I was scammed", so the morning report includes it.
 * Only the kind, the result, and the time are sent. Never the message itself.
 * Setup: daily-report/Code.gs → showAppLink, then paste into Settings → Advanced.
 */
"use strict";

const reportUrl = () => {
  const u = String(cfg().reportUrl || "").trim();
  return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec\?key=\w+$/.test(u) ? u : "";
};
const channelKey = c =>
  /call|phone/i.test(c || "")
    ? "call"
    : /text|message|sms/i.test(c || "")
      ? "text"
      : /mail/i.test(c || "")
        ? "email"
        : /web|site|link/i.test(c || "")
          ? "web"
          : "other";

/* Adds one event to the queue and tries to send it. */
function reportSync(ev) {
  if (typeof serverEvent === "function") serverEvent(ev); // the ScamSense server (daily report for every user)
  if (!reportUrl()) return;
  const q = S.get("syncq", []);
  q.push(Object.assign({ id: randomText(9), at: Date.now() }, ev));
  S.set("syncq", q.slice(-50));
  flushReportSync();
}

let reportSyncing = false;
async function flushReportSync() {
  const url = reportUrl(),
    q = S.get("syncq", []);
  if (!url || !q.length || reportSyncing || !navigator.onLine) return;
  reportSyncing = true;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ events: q })
    });
    const j = await r.json();
    if (j.ok) {
      const sent = new Set(q.map(e => e.id));
      S.set(
        "syncq",
        S.get("syncq", []).filter(e => !sent.has(e.id))
      );
    }
  } catch (e) {
    /* offline or not deployed yet; try again later */
  } finally {
    reportSyncing = false;
  }
}

/* Checks a pasted link and tells the person if it works. */
async function testReportLink(raw) {
  const u = String(raw || "").trim();
  if (!u) return;
  if (!reportUrl()) {
    toast(
      tr(
        "That link doesn't look right. It should end in /exec?key=…",
        "Ese enlace no parece correcto. Debe terminar en /exec?key=…"
      )
    );
    return;
  }
  try {
    const j = await (await fetch(u)).json();
    toast(
      j.ok
        ? tr("Daily report linked.", "Reporte diario vinculado.")
        : tr("The key in that link is wrong.", "La clave de ese enlace es incorrecta.")
    );
    if (j.ok) flushReportSync();
  } catch (e) {
    toast(
      tr("Couldn't reach the daily report script.", "No se pudo conectar con el script del reporte diario.")
    );
  }
}

addEventListener("online", flushReportSync);
document.addEventListener("DOMContentLoaded", () => setTimeout(flushReportSync, 4000));

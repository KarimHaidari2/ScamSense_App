/*
 * ScamSense · Your account (on the ScamSense server)
 * Signs the person up on the ScamSense server with their name and email, so they get a daily report,
 * danger alerts can reach their trusted people, and Mahi can email them. Then it sends short notes about
 * what ScamSense saw: the kind of check, the result, and the time. Never the message itself.
 * The email is confirmed by Google or Microsoft (the app's existing sign-in), so nobody can use someone else's.
 */
"use strict";

/* A random ID for this device. It's how the server knows it's you (no password needed). */
function myUid() {
  let id = S.get("uid", "");
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(id)) {
    id = randomText(18);
    S.set("uid", id);
  }
  return id;
}
const serverOn = () => !!cfg().mahiUrl && cfg().account !== false;

async function serverPost(body) {
  const r = await fetch(cfg().mahiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(Object.assign({ uid: myUid() }, body))
  });
  const j = await r.json();
  if (j && j.blocked) showBlocked(j.error);
  else if (j && j.ok) hideBlocked();
  return j;
}

/* If the ScamSense team turned this account off, say so plainly at the top of every screen. */
function showBlocked(msg) {
  S.set("suspended", true);
  let b = document.getElementById("suspended");
  if (!b) {
    b = document.createElement("div");
    b.id = "suspended";
    b.setAttribute("role", "alert");
    document.querySelector(".app").prepend(b);
  }
  b.textContent =
    msg ||
    tr(
      "ScamSense is turned off for this account. Please contact the ScamSense team.",
      "ScamSense está desactivado para esta cuenta. Comuníquese con el equipo de ScamSense."
    );
}
function hideBlocked() {
  if (!S.get("suspended", false)) return;
  S.set("suspended", false);
  const b = document.getElementById("suspended");
  if (b) b.remove();
}

/* Signs up or updates this person. Uses Google's or Microsoft's sign-in, if there is one, to confirm the email. */
async function registerUser() {
  if (!serverOn()) return null;
  const c = cfg();
  const body = {
    mode: "register",
    name: c.name || "",
    lastName: c.lastName || "",
    email: c.email || "",
    lang: langCode(),
    reports: c.dailyReport !== false,
    alerts: c.dangerAlerts !== false,
    family: S.get("helpers", []).map(h => ({ name: h.name, email: h.email, phone: h.phone }))
  };
  try {
    if (typeof token !== "undefined" && token && Date.now() < tokenExp - 60000) body.gtoken = token;
  } catch (e) {}
  if (!body.gtoken && typeof outlookConnected === "function" && outlookConnected()) {
    try {
      body.mstoken = await msTokenNow();
    } catch (e) {}
  }
  // Nothing to sign up with yet (no name, no connected email): wait.
  if (!body.name && !body.lastName && !body.gtoken && !body.mstoken && !S.get("acct", null)) return null;
  try {
    const j = await serverPost(body);
    if (j && j.ok && !j.waiting) {
      S.set("acct", { email: j.email, verified: j.verified, at: Date.now() });
      flushServerEvents();
    }
    return j;
  } catch (e) {
    return null;
  }
}
/* Once a day, or when something changed. */
function registerSoon() {
  clearTimeout(registerSoon.t);
  registerSoon.t = setTimeout(registerUser, 800);
}

/* ----- Activity notes for the server (same notes as the daily report link) ----- */
function serverEvent(ev) {
  if (!serverOn()) return;
  const q = S.get("srvq", []);
  q.push(Object.assign({ id: randomText(9), at: Date.now() }, ev));
  S.set("srvq", q.slice(-80));
  flushServerEvents();
}
let srvSending = false;
async function flushServerEvents() {
  const q = S.get("srvq", []);
  if (!serverOn() || !q.length || srvSending || !navigator.onLine) return;
  srvSending = true;
  try {
    const j = await serverPost({ mode: "events", events: q });
    if (j && j.ok) {
      const sent = new Set(q.map(e => e.id));
      S.set(
        "srvq",
        S.get("srvq", []).filter(e => !sent.has(e.id))
      );
    } else if (j && j.register && !flushServerEvents.tried) {
      // The server doesn't know this device yet: sign up once, then try again.
      flushServerEvents.tried = true;
      srvSending = false;
      await registerUser();
      return;
    }
  } catch (e) {
  } finally {
    srvSending = false;
  }
}

/* After an email scan: only the counts (how many emails, how many scams), for the daily report. */
function serverScanEvent(items, source) {
  const n = { scam: 0, warn: 0 };
  items.forEach(i => (n[i.level] = (n[i.level] || 0) + 1));
  serverEvent({ t: "scan", src: source, n: items.length, s: n.scam || 0, w: n.warn || 0 });
}

/* Mahi's "email me": sends a draft or summary to the person's own inbox. */
async function emailMe(subject, body) {
  if (!serverOn())
    throw new Error(
      tr("The ScamSense server isn't set up.", "El servidor de ScamSense no está configurado.")
    );
  const acct = S.get("acct", null);
  if (!acct || !acct.verified) await registerUser();
  const j = await serverPost({ mode: "email_me", subject, body });
  if (!j || !j.ok)
    throw new Error((j && j.error) || tr("Couldn't send the email.", "No se pudo enviar el correo."));
  return j.sentTo;
}

/* ----- Settings: "Your account" ----- */
function accountHTML() {
  const c = cfg();
  const acct = S.get("acct", null);
  const lead = (icn, cls) => `<span class="lead-ic ${cls}">${ic(icn)}</span>`;
  const emailLine =
    acct && acct.email
      ? `${esc(acct.email)} · ${acct.verified ? tr("confirmed", "confirmado") : tr("not confirmed yet", "aún sin confirmar")}`
      : tr(
          "Connect Gmail or Outlook above to confirm your email.",
          "Conecte Gmail u Outlook arriba para confirmar su correo."
        );
  return `<section class="sect"><h2 class="sect-h">${tr("Your account", "Su cuenta")}</h2><div class="group">
    <div class="grow col"><label for="uname" class="gl"><b>${tr("Your name", "Su nombre")}</b><span>${tr("Home says hello to you by first name. Your full name is shown to your trusted people in alerts.", "Inicio le saluda por su nombre. Su nombre completo aparece en las alertas a sus personas de confianza.")}</span></label><div class="namerow"><input id="uname" type="text" autocomplete="given-name" maxlength="30" placeholder="${esc(tr("First name", "Nombre"))}" aria-label="${esc(tr("First name", "Nombre"))}" value="${esc(c.name || "")}"><input id="ulname" type="text" autocomplete="family-name" maxlength="30" placeholder="${esc(tr("Last name", "Apellido"))}" aria-label="${esc(tr("Last name", "Apellido"))}" value="${esc(c.lastName || "")}"></div></div>
    <div class="grow">${lead("mail", "l-blue")}<span class="gl"><b>${tr("Your email", "Su correo")}</b><span>${emailLine}</span></span></div>
    <div class="grow">${lead("bell", "l-amber")}<span class="gl"><b>${tr("Daily report email", "Reporte diario por correo")}</b><span>${tr("Every morning: what ScamSense caught for you.", "Cada mañana: lo que ScamSense detectó para usted.")}</span></span>${switchHTML("drep", c.dailyReport !== false, "")}</div>
    <div class="grow">${lead("alert", "l-red")}<span class="gl"><b>${tr("Danger alerts", "Alertas de peligro")}</b><span>${tr("If you say you were scammed or already paid, your trusted people get an email right away.", "Si dice que le estafaron o que ya pagó, sus personas de confianza reciben un correo enseguida.")}</span></span>${switchHTML("dalert", c.dangerAlerts !== false, "")}</div>
  </div><p class="footnote">${ic("lock")}<span>${tr('ScamSense saves your name, email, and what it finds (like "text message: scam"), never your messages. ', 'ScamSense guarda su nombre, correo y lo que encuentra (como "texto: estafa"), nunca sus mensajes. ')}<a href="privacy.html" target="_blank" rel="noopener">${tr("Privacy Policy", "Política de privacidad")}</a></span></p></section>`;
}
function bindAccount() {
  const on = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", fn);
  };
  on("uname", registerSoon);
  on("ulname", e => {
    saveCfg(Object.assign(cfg(), { lastName: e.target.value.trim().slice(0, 30) }));
    registerSoon();
  });
  on("drep", e => {
    saveCfg(Object.assign(cfg(), { dailyReport: e.target.checked }));
    registerSoon();
  });
  on("dalert", e => {
    saveCfg(Object.assign(cfg(), { dangerAlerts: e.target.checked }));
    registerSoon();
  });
}

document.addEventListener("DOMContentLoaded", () =>
  setTimeout(() => {
    const a = S.get("acct", null);
    if (!a || Date.now() - a.at > 864e5) registerUser();
    else flushServerEvents();
  }, 3000)
);
addEventListener("online", flushServerEvents);

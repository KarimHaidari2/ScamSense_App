/*
 * ScamSense · Sign-in and security
 * - After signing in: remember until when this device stays signed in (60 days with
 *   "Keep me signed in", otherwise 1 day). After that, the welcome screen asks again.
 * - Settings → Sign-in and security: change password (or make one), change email (code to the new
 *   email), sign out, sign out of all devices, delete my account (code by email).
 * - Signing out removes this person's information from this device. Language and the ScamSense
 *   server address stay, so the next person sees the right language.
 */
"use strict";

/* After any successful sign-in (email + password, or Google/Outlook through the server). */
function signedIn(j) {
  S.set("onboarded", true);
  if (j.expires) S.set("session", { exp: j.expires, email: j.email || "" });
  const old = S.get("acct", null) || {};
  S.set(
    "acct",
    Object.assign(old, {
      email: j.email || old.email || "",
      verified: true,
      hasPassword: j.hasPassword !== undefined ? !!j.hasPassword : old.hasPassword !== false,
      at: Date.now()
    })
  );
  if (j.email) saveCfg(Object.assign(cfg(), { email: j.email }));
  if (typeof aboutYouCheck === "function") aboutYouCheck({ profile: j.profile });
  registerSoon();
}

/* Clears this person's information from this device, then shows the welcome screen. */
function signOutLocal(reason) {
  // Hand back the mailbox keys first, so the next person on this phone can't read this person's email.
  let hadKey = false;
  try {
    hadKey = !!((typeof token !== "undefined" && token) || (typeof wtoken !== "undefined" && wtoken));
  } catch (e) {}
  try {
    if (window.google && google.accounts && google.accounts.oauth2) {
      if (typeof token !== "undefined" && token) google.accounts.oauth2.revoke(token, () => {});
      if (typeof wtoken !== "undefined" && wtoken) google.accounts.oauth2.revoke(wtoken, () => {});
    }
  } catch (e) {}
  try {
    token = null;
    wtoken = null;
    if (typeof msAccess !== "undefined") msAccess = null;
  } catch (e) {}
  const c = cfg();
  const keep = { lang: c.lang, mahiUrl: c.mahiUrl, theme: c.theme, textSize: c.textSize };
  try {
    Object.keys(localStorage)
      .filter(k => k.indexOf("ss_") === 0)
      .forEach(k => localStorage.removeItem(k));
    Object.keys(sessionStorage)
      .filter(k => k.indexOf("ss_") === 0)
      .forEach(k => sessionStorage.removeItem(k));
  } catch (e) {}
  saveCfg(keep);
  S.set("signout_note", reason || "");
  location.hash = "";
  // A moment for Google to take the key back, if there was one.
  if (hadKey) setTimeout(() => location.reload(), 400);
  else location.reload();
}

/* ----- Whose mailbox is this? -----
   A ScamSense account only ever scans mailboxes its owner says are theirs. If the Gmail or Outlook that
   connects has a different address than the account (say, a family member's phone that still remembers
   someone else's Google sign-in), we ask first. "No" disconnects it right away. */
function myAcctEmail() {
  const a = S.get("acct", null) || {};
  const s = S.get("session", null) || {};
  return String(a.email || s.email || "").toLowerCase();
}
function mailboxAllowed(box, kind) {
  box = String(box || "").toLowerCase();
  const me = myAcctEmail();
  const okList = S.get("mailbox_ok", []) || [];
  if (!box || !me || box === me || okList.indexOf(box) >= 0) return Promise.resolve(true);
  return new Promise(resolve => {
    const m = document.createElement("div");
    m.className = "onb onb-gate onb-about";
    m.id = "mbox-ask";
    m.innerHTML = `<div class="gate-box about-box" role="dialog" aria-modal="true" aria-labelledby="mb-h"><section class="gate-body">
      <h1 id="mb-h">${tr("Is this your mailbox?", "¿Es su correo?")}</h1>
      <p class="about-lead">${tr(
        `You're signed in to ScamSense as <b>${esc(me)}</b>, but this ${esc(kind)} is <b>${esc(box)}</b>.`,
        `Inició sesión en ScamSense como <b>${esc(me)}</b>, pero este ${esc(kind)} es <b>${esc(box)}</b>.`
      )}</p>
      <p class="about-lead">${tr(
        'Only connect a mailbox that belongs to you. If this is someone else\'s, tap "No" and then choose your own account.',
        'Conecte solo un correo que sea suyo. Si es de otra persona, toque "No" y elija su propia cuenta.'
      )}</p>
      <button class="gate-btn primary-btn" type="button" id="mb-yes">${tr("Yes, this mailbox is mine", "Sí, este correo es mío")}</button>
      <button class="gate-demo" type="button" id="mb-no">${tr("No, disconnect it", "No, desconectarlo")}</button>
    </section></div>`;
    document.body.appendChild(m);
    const done = yes => {
      m.remove();
      if (yes) S.set("mailbox_ok", okList.concat(box).slice(-5));
      resolve(yes);
    };
    m.querySelector("#mb-yes").onclick = () => done(true);
    m.querySelector("#mb-no").onclick = () => done(false);
    setTimeout(() => m.querySelector("#mb-no").focus(), 30);
  });
}
async function gmailAddress(tok) {
  try {
    const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: "Bearer " + tok }
    });
    if (!r.ok) return "";
    return String((await r.json()).emailAddress || "").toLowerCase();
  } catch (e) {
    return "";
  }
}
const SIGNOUT_NOTES = {
  out: () => tr("You're signed out.", "Cerró su sesión."),
  all: () => tr("You're signed out on every device.", "Cerró su sesión en todos los dispositivos."),
  expired: () =>
    tr(
      "For your safety, please sign in again. ScamSense asks every 60 days.",
      "Por su seguridad, inicie sesión de nuevo. ScamSense lo pide cada 60 días."
    ),
  deleted: () =>
    tr(
      "Your account was deleted. You're welcome back anytime.",
      "Su cuenta fue eliminada. Puede volver cuando quiera."
    )
};
/* Shown once on the welcome screen after signing out. */
function signoutNote() {
  const k = S.get("signout_note", "");
  S.del("signout_note");
  return k && SIGNOUT_NOTES[k] ? SIGNOUT_NOTES[k]() : "";
}

/* When the 60 days (or 1 day) are over, sign in again. */
function sessionCheck() {
  const s = S.get("session", null);
  if (S.get("onboarded", false) && s && s.exp && new Date(s.exp) < new Date()) signOutLocal("expired");
}
sessionCheck();
setInterval(sessionCheck, 10 * 60000);

/* ----- Settings → Sign-in and security ----- */
function securityHTML() {
  const acct = S.get("acct", null);
  if (!serverOn() || !acct) return "";
  const lead = (icn, cls) => `<span class="lead-ic ${cls}">${ic(icn)}</span>`;
  const s = S.get("session", null);
  const until =
    s && s.exp
      ? tr("Signed in until ", "Sesión abierta hasta ") +
        new Date(s.exp).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
      : tr("Signed in", "Sesión abierta");
  const row = (id, icon, cls, title, sub) =>
    `<button class="grow linkrow" id="${id}">${lead(icon, cls)}<span class="gl"><b>${title}</b><span>${sub}</span></span>${ic("chev", "chev")}</button>`;
  return `<section class="sect"><h2 class="sect-h">${tr("Sign-in and security", "Inicio de sesión y seguridad")}</h2><div class="group">
    <div class="grow">${lead("lock", "l-green")}<span class="gl"><b>${esc(acct.email || "")}</b><span>${esc(until)}</span></span></div>
    ${row("sec-pw", "lock", "l-blue", acct.hasPassword === false ? tr("Make a password", "Crear una contraseña") : tr("Change password", "Cambiar contraseña"), tr("At least 10 characters, a capital letter, and a number", "Al menos 10 caracteres, una mayúscula y un número"))}
    ${row("sec-email", "mail", "l-blue", tr("Change email", "Cambiar correo"), tr("We'll send a code to the new email", "Enviaremos un código al nuevo correo"))}
    ${row("sec-out", "user", "l-amber", tr("Sign out", "Cerrar sesión"), tr("Removes your information from this device", "Quita su información de este dispositivo"))}
    ${row("sec-outall", "shield", "l-amber", tr("Sign out of all devices", "Cerrar sesión en todos los dispositivos"), tr("For a lost or shared phone", "Para un teléfono perdido o compartido"))}
    ${row("sec-delete", "alert", "l-red", tr("Delete my account", "Eliminar mi cuenta"), tr("Deletes your account and your information", "Elimina su cuenta y su información"))}
  </div></section>`;
}
function bindSecurity() {
  const on = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.onclick = fn;
  };
  on("sec-pw", changePassword);
  on("sec-email", changeEmail);
  on("sec-out", () => confirmSignOut(false));
  on("sec-outall", () => confirmSignOut(true));
  on("sec-delete", deleteAccountFlow);
}

/* A small dialog in the same style as "About you". */
function acctDialog(title, bodyHTML, onSubmit, button, danger) {
  const m = document.createElement("div");
  m.className = "onb onb-gate onb-about";
  m.innerHTML = `<div class="gate-box about-box" role="dialog" aria-modal="true" aria-labelledby="ad-h"><section class="gate-body">
    <h1 id="ad-h">${title}</h1>
    <form id="ad-form" novalidate>${bodyHTML}
      <p class="about-err" id="ad-err" role="alert"></p>
      <button class="gate-btn ${danger ? "danger-btn" : "primary-btn"}" type="submit">${button}</button>
      <button class="gate-demo" type="button" id="ad-cancel">${tr("Cancel", "Cancelar")}</button>
    </form></section></div>`;
  document.body.appendChild(m);
  const err = t => (m.querySelector("#ad-err").textContent = t || "");
  m.querySelector("#ad-cancel").onclick = () => m.remove();
  m.querySelectorAll(".pwshow").forEach(
    b =>
      (b.onclick = () => {
        const i = m.querySelector("#" + b.dataset.for);
        i.type = i.type === "password" ? "text" : "password";
        b.textContent = i.type === "text" ? tr("Hide", "Ocultar") : tr("Show", "Mostrar");
      })
  );
  m.querySelector("#ad-form").onsubmit = async e => {
    e.preventDefault();
    const b = m.querySelector("#ad-form [type=submit]");
    b.disabled = true;
    err("");
    try {
      await onSubmit(m, err);
    } catch (x) {
      err(x.message || tr("That didn't work. Try again.", "No funcionó. Intente de nuevo."));
    }
    if (b.isConnected) b.disabled = false;
  };
  const f = m.querySelector("input");
  if (f) setTimeout(() => f.focus(), 30);
  return m;
}
const authCall = async body => {
  const j = await serverPost(Object.assign({ mode: "auth", device: deviceLabel() }, body));
  if (!j || j.error) throw new Error((j && j.error) || "");
  return j;
};
const pwInput = (id, label, auto) =>
  `<label>${label}<span class="pwwrap"><input id="${id}" type="password" autocomplete="${auto}" maxlength="128"><button type="button" class="pwshow" data-for="${id}">${tr("Show", "Mostrar")}</button></span></label>`;

function changePassword() {
  const has = (S.get("acct", null) || {}).hasPassword !== false;
  acctDialog(
    has ? tr("Change password", "Cambiar contraseña") : tr("Make a password", "Crear una contraseña"),
    `${has ? pwInput("cp-old", tr("Current password", "Contraseña actual"), "current-password") : ""}
     ${pwInput("cp-new", tr("New password", "Nueva contraseña"), "new-password")}
     <ul class="pwrules">${PW_RULES()
       .map(([, t]) => `<li>${esc(t)}</li>`)
       .join("")}</ul>`,
    async (m, err) => {
      const p = m.querySelector("#cp-new").value;
      const miss = PW_RULES().find(([t]) => !t(p));
      if (miss)
        return err(tr("Your password needs: ", "Su contraseña necesita: ") + miss[1].toLowerCase() + ".");
      await authCall({
        action: "change_password",
        old: has ? m.querySelector("#cp-old").value : "",
        password: p
      });
      S.set("acct", Object.assign(S.get("acct", {}), { hasPassword: true }));
      m.remove();
      toast(tr("Your password was changed.", "Su contraseña fue cambiada."));
      if (typeof renderSettings === "function" && document.getElementById("sec-pw")) renderSettings();
    },
    tr("Save password", "Guardar contraseña")
  );
  const d = document.querySelector("#cp-new");
  const list = d.closest("form").querySelector(".pwrules");
  d.oninput = () => PW_RULES().forEach(([t], i) => list.children[i].classList.toggle("met", t(d.value)));
}

function changeEmail() {
  let email = "";
  const m = acctDialog(
    tr("Change email", "Cambiar correo"),
    `<label>${tr("New email", "Nuevo correo")}<input id="ce-email" type="email" autocomplete="email" inputmode="email" maxlength="100"></label>
     <div id="ce-code" hidden><label>${tr("6-digit code from the new email", "Código de 6 dígitos del nuevo correo")}<input id="ce-c" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></label></div>`,
    async (m, err) => {
      if (!email) {
        const v = m.querySelector("#ce-email").value.trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(v))
          return err(tr("Please type the full email address.", "Escriba el correo completo."));
        await authCall({ action: "email_change_start", email: v });
        email = v;
        m.querySelector("#ce-email").disabled = true;
        m.querySelector("#ce-code").hidden = false;
        m.querySelector("#ad-form [type=submit]").textContent = tr(
          "Confirm new email",
          "Confirmar nuevo correo"
        );
        m.querySelector("#ce-c").focus();
        return;
      }
      const j = await authCall({
        action: "email_change_finish",
        email,
        code: m.querySelector("#ce-c").value.trim()
      });
      S.set("acct", Object.assign(S.get("acct", {}), { email: j.email }));
      saveCfg(Object.assign(cfg(), { email: j.email }));
      m.remove();
      toast(tr("Your email was changed.", "Su correo fue cambiado."));
      if (typeof renderSettings === "function") renderSettings();
    },
    tr("Send me a code", "Envíenme un código")
  );
  return m;
}

function confirmSignOut(all) {
  acctDialog(
    all
      ? tr("Sign out of all devices?", "¿Cerrar sesión en todos los dispositivos?")
      : tr("Sign out?", "¿Cerrar sesión?"),
    `<p>${
      all
        ? tr(
            "Every phone and computer signed in to your account will be signed out, including this one. Your account and your information stay safe.",
            "Se cerrará la sesión en todos los teléfonos y computadoras con su cuenta, incluido este. Su cuenta y su información quedan seguras."
          )
        : tr(
            "Your information will be removed from this device. Your account stays, and signing in again brings everything back.",
            "Su información se quitará de este dispositivo. Su cuenta se queda, y al iniciar sesión de nuevo todo vuelve."
          )
    }</p>`,
    async () => {
      try {
        await authCall({ action: all ? "logout_all" : "logout" });
      } catch (e) {} // sign out on this device either way
      signOutLocal(all ? "all" : "out");
    },
    all ? tr("Sign out everywhere", "Cerrar sesión en todos") : tr("Sign out", "Cerrar sesión")
  );
}

function deleteAccountFlow() {
  let sent = false;
  acctDialog(
    tr("Delete your account?", "¿Eliminar su cuenta?"),
    `<p>${tr("This deletes your account, your details, your activity, and your conversations with the ScamSense team. It can't be undone.", "Esto elimina su cuenta, sus datos, su actividad y sus conversaciones con el equipo de ScamSense. No se puede deshacer.")}</p>
     <p class="small muted">${tr("To be sure it's you, we'll email you a code.", "Para confirmar que es usted, le enviaremos un código por correo.")}</p>
     <div id="dl-code" hidden><label>${tr("6-digit code from the email", "Código de 6 dígitos del correo")}<input id="dl-c" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></label></div>`,
    async (m, err) => {
      if (!sent) {
        await authCall({ action: "delete_start" });
        sent = true;
        m.querySelector("#dl-code").hidden = false;
        m.querySelector("#ad-form [type=submit]").textContent = tr(
          "Delete my account forever",
          "Eliminar mi cuenta para siempre"
        );
        m.querySelector("#dl-c").focus();
        return;
      }
      await authCall({ action: "delete_finish", code: m.querySelector("#dl-c").value.trim() });
      signOutLocal("deleted");
    },
    tr("Email me a code", "Envíenme un código"),
    true
  );
}

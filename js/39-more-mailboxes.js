/*
 * ScamSense · More than one mailbox
 * Someone with two Gmail addresses and a work Outlook can connect all of them. Every scan checks
 * each one, and the email list shows which mailbox each email came from.
 *
 *   Main Gmail / main Outlook   connected the usual way (04-gmail.js, 28-outlook.js)
 *   Extra mailboxes             saved in "xboxes": [{ kind: "gmail" | "outlook", email, ms }]
 *
 * Gmail keys last an hour and Google only renews one from a tap, so a scan renews the extra
 * Gmail keys it can; any it can't are listed on Home with a one-tap "Check" button.
 * Outlook keeps a renewal key, so extra Outlook mailboxes scan without a tap.
 */
"use strict";

const MAX_EXTRA_BOXES = 4;
const XTOK = {}; // extra Gmail keys, kept in memory only: email → { t, exp }

const extraBoxes = () => S.get("xboxes", []) || [];
function saveExtraBoxes(list) {
  S.set("xboxes", list.slice(0, MAX_EXTRA_BOXES));
}
/* Which mailbox an email came from: "" for the main Gmail/Outlook, else the extra mailbox's address. */
const boxOf = it => it.box || "";
function mainBoxEmail(source) {
  if (source === "gmail") return S.get("gmail_box", "") || "";
  if (source === "outlook") return (S.get("ms", null) || {}).email || "";
  return "";
}
const mailboxKey = it => (it.source || "") + ":" + (boxOf(it) || mainBoxEmail(it.source) || "main");
function mailboxLabel(it) {
  const email = boxOf(it) || mainBoxEmail(it.source);
  return email || SRC_NAME[it.source] || "";
}
const hasExtraBoxes = () => extraBoxes().length > 0;

/* ----- Adding another Gmail ----- */
function addGmailBox() {
  return new Promise((resolve, reject) => {
    const c = cfg();
    if (!(window.google && google.accounts && google.accounts.oauth2))
      return reject(
        new Error(
          tr(
            "Google sign-in is still loading. Try again in a moment.",
            "El inicio de sesión de Google aún está cargando. Intente en un momento."
          )
        )
      );
    if (extraBoxes().length >= MAX_EXTRA_BOXES)
      return reject(
        new Error(
          tr(
            `You can add up to ${MAX_EXTRA_BOXES} more mailboxes.`,
            `Puede agregar hasta ${MAX_EXTRA_BOXES} buzones más.`
          )
        )
      );
    const tc = google.accounts.oauth2.initTokenClient({
      client_id: c.clientId,
      scope: "https://www.googleapis.com/auth/gmail.readonly",
      callback: async r => {
        if (r.error)
          return reject(
            new Error(tr("Google sign-in was cancelled.", "Se canceló el inicio de sesión de Google."))
          );
        const box = await gmailAddress(r.access_token);
        const drop = msg => {
          try {
            google.accounts.oauth2.revoke(r.access_token, () => {});
          } catch (e) {}
          reject(new Error(msg));
        };
        if (!box)
          return drop(
            tr(
              "Couldn't read that Gmail address. Please try again.",
              "No se pudo leer esa dirección de Gmail. Intente de nuevo."
            )
          );
        if (box === mainBoxEmail("gmail") || extraBoxes().some(b => b.email === box))
          return reject(new Error(tr(`${box} is already connected.`, `${box} ya está conectado.`)));
        if (typeof mailboxAllowed === "function" && !(await mailboxAllowed(box, "Gmail")))
          return drop(tr("That Gmail wasn't added.", "Ese Gmail no se agregó."));
        XTOK[box] = { t: r.access_token, exp: Date.now() + (r.expires_in || 3600) * 1000 };
        saveExtraBoxes(extraBoxes().concat({ kind: "gmail", email: box, at: Date.now() }));
        resolve(box);
      },
      error_callback: () =>
        reject(
          new Error(
            tr(
              "Google's window didn't finish. Allow pop-ups for this site and try again.",
              "La ventana de Google no terminó. Permita ventanas emergentes e intente de nuevo."
            )
          )
        )
    });
    // Always show the account chooser: this is a different Google account than the main one.
    tc.requestAccessToken({ prompt: "select_account consent" });
  });
}
/* A fresh key for one extra Gmail. Without a tap, Google may refuse to open its window. */
function extraGmailToken(email, interactive) {
  const k = XTOK[email];
  if (k && Date.now() < k.exp - 60000) return Promise.resolve(k.t);
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = interactive ? null : setTimeout(() => !done && reject(new Error("needs a tap")), 8000);
    try {
      const tc = google.accounts.oauth2.initTokenClient({
        client_id: cfg().clientId,
        scope: "https://www.googleapis.com/auth/gmail.readonly",
        callback: async r => {
          done = true;
          clearTimeout(timer);
          if (r.error) return reject(new Error(r.error));
          // Google can hand back whichever account is signed in: make sure it's this mailbox.
          const box = await gmailAddress(r.access_token);
          if (box && box !== email)
            return reject(new Error(tr(`Please choose ${email}.`, `Elija ${email}.`)));
          XTOK[email] = { t: r.access_token, exp: Date.now() + (r.expires_in || 3600) * 1000 };
          resolve(r.access_token);
        },
        error_callback: () => {
          done = true;
          clearTimeout(timer);
          reject(new Error("needs a tap"));
        }
      });
      tc.requestAccessToken({ prompt: "", hint: email });
    } catch (e) {
      reject(e);
    }
  });
}
/* Runs fn with the main Gmail key swapped for an extra mailbox's key, then puts it back. */
async function withGmailBox(email, interactive, fn) {
  const t = await extraGmailToken(email, interactive);
  const saved = [token, tokenExp];
  token = t;
  tokenExp = XTOK[email].exp;
  try {
    return await fn();
  } finally {
    token = saved[0];
    tokenExp = saved[1];
  }
}

/* ----- Adding another Outlook (Microsoft sends people back to the app, see finishOutlookSignIn) ----- */
function addOutlookBox() {
  if (extraBoxes().length >= MAX_EXTRA_BOXES) {
    toast(
      tr(
        `You can add up to ${MAX_EXTRA_BOXES} more mailboxes.`,
        `Puede agregar hasta ${MAX_EXTRA_BOXES} buzones más.`
      )
    );
    return;
  }
  connectOutlook(false, true);
}
/* Called by finishOutlookSignIn when the sign-in was for an extra mailbox: the main Outlook record
   is set aside while Microsoft's answer is stored, then the new one is moved to "xboxes". */
async function finishExtraOutlook(exchange) {
  const main = S.get("ms", null);
  const mainAccess = msAccess;
  S.del("ms");
  msAccess = null;
  let rec = null,
    email = "";
  try {
    await exchange();
    const me = await msGet("me?$select=mail,userPrincipalName").catch(() => ({}));
    email = String(me.mail || me.userPrincipalName || "").toLowerCase();
    rec = S.get("ms", null);
  } finally {
    if (main) S.set("ms", main);
    else S.del("ms");
    msAccess = mainAccess;
  }
  if (!rec || !email)
    throw new Error(
      tr("Couldn't add that Outlook. Please try again.", "No se pudo agregar ese Outlook. Intente de nuevo.")
    );
  if (email === String(mainBoxEmail("outlook")).toLowerCase() || extraBoxes().some(b => b.email === email))
    throw new Error(tr(`${email} is already connected.`, `${email} ya está conectado.`));
  if (typeof mailboxAllowed === "function" && !(await mailboxAllowed(email, "Outlook")))
    throw new Error(tr("That Outlook wasn't added.", "Ese Outlook no se agregó."));
  rec.email = email;
  saveExtraBoxes(extraBoxes().concat({ kind: "outlook", email, ms: rec, at: Date.now() }));
  return email;
}
/* Runs fn with an extra Outlook mailbox in place of the main one, then puts the main one back. */
const XMSA = {}; // extra Outlook access keys, memory only
async function withOutlookBox(box, fn) {
  const main = S.get("ms", null);
  const mainAccess = msAccess;
  S.set("ms", box.ms);
  msAccess = XMSA[box.email] || null;
  try {
    return await fn();
  } finally {
    // Microsoft hands out a new renewal key each time: keep it with this mailbox.
    const now = S.get("ms", null);
    XMSA[box.email] = msAccess;
    const list = extraBoxes();
    const i = list.findIndex(b => b.email === box.email);
    if (i >= 0) {
      if (now && now.refresh) list[i].ms = now;
      else list[i].expired = true;
      saveExtraBoxes(list);
    }
    if (main) S.set("ms", main);
    else S.del("ms");
    msAccess = mainAccess;
  }
}

/* ----- Scanning the extra mailboxes (called from scanEmail) ----- */
async function collectExtraBoxes() {
  const items = [];
  const waiting = [];
  let skipped = 0;
  for (const box of extraBoxes()) {
    try {
      let got;
      if (box.kind === "gmail") got = await withGmailBox(box.email, false, () => collectGmail(box.email));
      else if (box.kind === "outlook") {
        if (box.expired) throw new Error("expired");
        got = await withOutlookBox(box, () => collectOutlook(box.email));
      } else continue;
      skipped += got._skipped || 0;
      got.forEach(it => (it.box = box.email));
      items.push(...got);
    } catch (e) {
      waiting.push(box.email);
      // Keep what was found last time, so this mailbox's emails don't disappear from the list.
      const rep = S.get("report", null);
      if (rep && rep.source !== "demo")
        rep.items
          .filter(it => it.box === box.email)
          .forEach(it => items.push(Object.assign({}, it, { _cached: true })));
    }
  }
  S.set("xwaiting", waiting);
  items._skipped = skipped;
  return items;
}
/* One tap on Home: renew that mailbox's key, then scan everything again. */
async function checkWaitingBox(email) {
  const box = extraBoxes().find(b => b.email === email);
  if (!box) return;
  try {
    if (box.kind === "gmail") await extraGmailToken(email, true);
    else {
      // Outlook needs a fresh sign-in: remove the stale one and add it again.
      saveExtraBoxes(extraBoxes().filter(b => b.email !== email));
      addOutlookBox();
      return;
    }
    scanEmail();
  } catch (e) {
    toast(
      e.message === "needs a tap"
        ? tr(
            "Google's window didn't open. Allow pop-ups and try again.",
            "La ventana de Google no se abrió. Permita ventanas emergentes e intente de nuevo."
          )
        : e.message
    );
  }
}
function waitingBoxesHTML() {
  const w = (S.get("xwaiting", []) || []).filter(e => extraBoxes().some(b => b.email === e));
  if (!w.length) return "";
  return `<section class="card xwait" aria-live="polite"><p class="small" style="margin:0 0 8px"><b>${tr(
    w.length === 1
      ? "One more mailbox needs a tap to be checked"
      : `${w.length} more mailboxes need a tap to be checked`,
    w.length === 1
      ? "Un buzón más necesita un toque para revisarse"
      : `${w.length} buzones más necesitan un toque para revisarse`
  )}</b></p>${w
    .map(
      e =>
        `<button class="btn sm ghost" data-xcheck="${esc(e)}">${ic("refresh")} ${tr("Check", "Revisar")} ${esc(e)}</button>`
    )
    .join(" ")}</section>`;
}
function bindWaitingBoxes(root) {
  (root || document)
    .querySelectorAll("[data-xcheck]")
    .forEach(b => (b.onclick = () => checkWaitingBox(b.dataset.xcheck)));
}

/* ----- Settings / connections list ----- */
function extraBoxesHTML() {
  const gmailOn = !!S.get("connected", false),
    outlookOn = outlookConnected();
  const rows = extraBoxes()
    .map(
      b =>
        `<div class="grow"><span class="lead-ic ${b.kind === "gmail" ? "l-red" : "l-blue"}">${ic("mail")}</span><span class="gl"><b>${esc(b.email)}</b><span>${b.kind === "gmail" ? "Gmail" : "Outlook"} · ${b.expired ? tr("Sign-in expired", "Sesión vencida") : tr("Also checked", "También se revisa")}</span></span><button class="btn sm ghost" data-xrm="${esc(b.email)}">${tr("Remove", "Quitar")}</button></div>`
    )
    .join("");
  const room = extraBoxes().length < MAX_EXTRA_BOXES;
  const adds =
    room && (gmailOn || outlookOn)
      ? `<div class="grow xadd"><span class="lead-ic l-gray">${ic("plus")}</span><span class="gl"><b>${tr("Another email address?", "¿Otra dirección de correo?")}</b><span>${tr("Add it, and every scan checks all of them.", "Agréguela y cada revisión las revisa todas.")}</span></span><span class="xbtns">${gmailOn ? `<button class="btn sm primary" id="xaddg">${tr("Add Gmail", "Agregar Gmail")}</button>` : ""}${outlookOn ? `<button class="btn sm primary" id="xaddo">${tr("Add Outlook", "Agregar Outlook")}</button>` : ""}</span></div>`
      : "";
  return rows + adds;
}
function bindExtraBoxes(rerender) {
  const on = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.onclick = fn;
  };
  on("xaddg", async () => {
    try {
      const box = await addGmailBox();
      toast(tr(`${box} added. Checking it now…`, `${box} agregado. Revisándolo ahora…`));
      go("today");
      scanEmail();
    } catch (e) {
      toast(e.message);
    }
  });
  on("xaddo", () => addOutlookBox());
  document.querySelectorAll("[data-xrm]").forEach(
    b =>
      (b.onclick = () => {
        const email = b.dataset.xrm;
        const k = XTOK[email];
        if (k)
          try {
            google.accounts.oauth2.revoke(k.t, () => {});
          } catch (e) {}
        delete XTOK[email];
        saveExtraBoxes(extraBoxes().filter(x => x.email !== email));
        // Take that mailbox's emails off the list too.
        const rep = S.get("report", null);
        if (rep) S.set("report", Object.assign(rep, { items: rep.items.filter(it => it.box !== email) }));
        toast(tr(`${email} removed.`, `${email} quitado.`));
        rerender();
      })
  );
}
/* On sign-out: hand the extra Gmail keys back too. */
function revokeExtraBoxes() {
  Object.keys(XTOK).forEach(e => {
    try {
      google.accounts.oauth2.revoke(XTOK[e].t, () => {});
    } catch (err) {}
    delete XTOK[e];
  });
}

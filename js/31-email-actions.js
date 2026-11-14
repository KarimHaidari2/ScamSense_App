/*
 * ScamSense · Move to Spam and Block sender (Gmail and Outlook)
 * Reading email only needs read permission. These two buttons need permission to organize mail,
 * so ScamSense asks for it the first time someone uses them (Google or Microsoft asks once).
 *   Move to Spam   moves this one email to Spam / Junk (and tells Google it's spam).
 *   Block sender   moves it, and sends every future email from that address straight to Trash / Junk.
 * Blocked senders are listed in Settings → Email, with an Unblock button.
 */
"use strict";

/* ----- Gmail: a second, stronger permission, asked for only when needed ----- */
const G_WRITE_SCOPES =
  "https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.settings.basic";
let wtoken = null,
  wtokenExp = 0;
function getWriteToken() {
  return new Promise((resolve, reject) => {
    const c = cfg();
    if (wtoken && Date.now() < wtokenExp - 60000) return resolve(wtoken);
    if (!c.clientId || !(window.google && google.accounts && google.accounts.oauth2))
      return reject(new Error(tr("Connect Gmail first.", "Conecte Gmail primero.")));
    const tc = google.accounts.oauth2.initTokenClient({
      client_id: c.clientId,
      scope: G_WRITE_SCOPES,
      include_granted_scopes: true,
      callback: r => {
        if (r.error || !google.accounts.oauth2.hasGrantedAllScopes(r, ...G_WRITE_SCOPES.split(" ")))
          return reject(
            new Error(
              tr(
                "Google didn't give permission to move emails. Please try again and check every box.",
                "Google no dio permiso para mover correos. Intente de nuevo y marque todas las casillas."
              )
            )
          );
        wtoken = r.access_token;
        wtokenExp = Date.now() + (r.expires_in || 3600) * 1000;
        S.set("gwrite", true);
        resolve(wtoken);
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
    tc.requestAccessToken({ prompt: S.get("gwrite", false) ? "" : "consent" });
  });
}
async function gsend(path, method, body) {
  const tok = await getWriteToken();
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/" + path, {
    method,
    headers: Object.assign(
      { Authorization: "Bearer " + tok },
      body ? { "Content-Type": "application/json" } : {}
    ),
    body: body ? JSON.stringify(body) : undefined
  });
  if (r.status === 401) wtoken = null;
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error((j.error && j.error.message) || "Gmail error " + r.status);
  }
  return r.status === 204 ? {} : r.json().catch(() => ({}));
}

/* ----- Outlook: if it can only read, sign in once more with permission to organize ----- */
function outlookCanWrite() {
  return !!(S.get("ms", null) || {}).write;
}
function outlookNeedsWrite(action, it) {
  if (outlookCanWrite()) return false;
  sessionStorage.setItem(
    "ss_ms_pending",
    JSON.stringify({ action, id: it.id, email: it.fromEmail, name: it.fromName || "" })
  );
  toast(
    tr(
      "Microsoft will ask once for permission to move Outlook emails…",
      "Microsoft pedirá una vez permiso para mover correos de Outlook…"
    )
  );
  setTimeout(() => connectOutlook(true), 900);
  return true;
}
/* After Microsoft sends them back, finish what they tapped. */
async function runOutlookPending() {
  const p = JSON.parse(sessionStorage.getItem("ss_ms_pending") || "null");
  sessionStorage.removeItem("ss_ms_pending");
  if (!p || !outlookCanWrite()) return false;
  const it = { id: p.id, fromEmail: p.email, fromName: p.name, source: "outlook" };
  try {
    if (p.action === "block") await blockSender(it);
    else await moveToSpam(it);
  } catch (e) {
    toast(e.message);
  }
  scanEmail();
  return true;
}
let junkId = null;
async function outlookJunkId() {
  if (!junkId) junkId = (await msGet("me/mailFolders/junkemail?$select=id")).id;
  return junkId;
}

/* ----- The two actions ----- */
async function moveToSpam(it, quiet) {
  if (it.source === "gmail") {
    await gsend(`messages/${encodeURIComponent(it.id)}/modify`, "POST", {
      addLabelIds: ["SPAM"],
      removeLabelIds: ["INBOX"]
    });
  } else if (it.source === "outlook") {
    if (outlookNeedsWrite("spam", it)) return false;
    await msGet(`me/messages/${encodeURIComponent(it.id)}/move`, "POST", { destinationId: "junkemail" });
  } else return false;
  markMoved(it.id, "Spam");
  if (quiet !== true) toast(tr("Moved to Spam.", "Movido a Spam."));
  return true;
}

async function blockSender(it) {
  const email = (it.fromEmail || "").toLowerCase();
  if (!email) return false;
  let ref;
  if (it.source === "gmail") {
    // Gmail filters can't send to Spam, so future emails from this address go to Trash.
    const f = await gsend("settings/filters", "POST", {
      criteria: { from: email },
      action: { addLabelIds: ["TRASH"], removeLabelIds: ["INBOX"] }
    });
    ref = f.id;
    await moveToSpam(it, true).catch(() => {});
  } else if (it.source === "outlook") {
    if (outlookNeedsWrite("block", it)) return false;
    const rule = await msGet("me/mailFolders/inbox/messageRules", "POST", {
      displayName: "ScamSense: block " + email,
      sequence: 1,
      isEnabled: true,
      conditions: { senderContains: [email] },
      actions: { moveToFolder: await outlookJunkId(), stopProcessingRules: true }
    });
    ref = rule.id;
    await msGet(`me/messages/${encodeURIComponent(it.id)}/move`, "POST", {
      destinationId: "junkemail"
    }).catch(() => {});
    markMoved(it.id, "Spam");
  } else return false;
  const list = S.get("blockedSenders", []).filter(b => !(b.email === email && b.source === it.source));
  list.unshift({ email, name: it.fromName || "", source: it.source, ref, at: Date.now() });
  S.set("blockedSenders", list.slice(0, 200));
  reportSync({ t: "block", c: "email" });
  toast(tr(`Blocked ${email}.`, `Bloqueado ${email}.`));
  return true;
}

async function unblockSender(email, source) {
  const list = S.get("blockedSenders", []);
  const b = list.find(x => x.email === email && x.source === source);
  if (!b) return;
  if (source === "gmail")
    await gsend(`settings/filters/${encodeURIComponent(b.ref)}`, "DELETE").catch(e => {
      if (!/not found/i.test(e.message)) throw e;
    });
  else
    await msGet(`me/mailFolders/inbox/messageRules/${encodeURIComponent(b.ref)}`, "DELETE").catch(e => {
      if (e.status !== 404) throw e;
    });
  S.set(
    "blockedSenders",
    list.filter(x => x !== b && !(x.email === email && x.source === source))
  );
  toast(tr(`Unblocked ${email}.`, `Desbloqueado ${email}.`));
}

const isBlocked = it =>
  S.get("blockedSenders", []).some(
    b => b.email === (it.fromEmail || "").toLowerCase() && b.source === it.source
  );

/* Updates the saved email list so the screen shows where the email went. */
function markMoved(id, folder) {
  const rep = S.get("report", null);
  if (!rep) return;
  rep.items.forEach(x => {
    if (x.id === id) {
      x.folder = folder;
      x.inSpam = folder === "Spam";
    }
  });
  S.set("report", rep);
}

/* ----- Buttons inside an email's details ----- */
function emailActionsHTML(it) {
  if (!["gmail", "outlook"].includes(it.source) || !it.fromEmail) return "";
  const risky = it.level !== "safe";
  const cls = risky ? "btn danger" : "btn ghost";
  let h = `<div class="row email-acts">`;
  if (!it.inSpam && it.folder !== "Trash")
    h += `<button class="${cls}" data-tospam>${tr("Move to Spam", "Mover a Spam")}</button>`;
  h += isBlocked(it)
    ? `<span class="pill" style="align-self:center">${tr("Sender blocked", "Remitente bloqueado")}</span>`
    : `<button class="${cls}" data-block>${tr("Block sender", "Bloquear remitente")}</button>`;
  h += `</div><div class="confirm-block card" hidden>
    <p style="margin:0"><b>${tr("Block", "¿Bloquear")} ${esc(it.fromEmail)}${tr("?", "?")}</b></p>
    <p class="small muted" style="margin:6px 0 10px">${
      it.source === "gmail"
        ? tr(
            "Future emails from this address will go straight to Trash. You can unblock it in Settings.",
            "Los correos futuros de esta dirección irán directo a la Papelera. Puede desbloquearla en Ajustes."
          )
        : tr(
            "Future emails from this address will go straight to Junk. You can unblock it in Settings.",
            "Los correos futuros de esta dirección irán directo a Correo no deseado. Puede desbloquearla en Ajustes."
          )
    }</p>
    <div class="row"><button class="btn danger" data-blockyes>${tr("Yes, block", "Sí, bloquear")}</button><button class="btn ghost" data-blockno>${tr("Cancel", "Cancelar")}</button></div></div>`;
  return h;
}
function bindEmailActions(d, it, rerender) {
  const run = async (btn, fn) => {
    btn.disabled = true;
    try {
      if (await fn(it)) rerender();
    } catch (e) {
      toast(e.message);
    } finally {
      btn.disabled = false;
    }
  };
  const sp = d.querySelector("[data-tospam]");
  if (sp) sp.onclick = () => run(sp, moveToSpam);
  const bl = d.querySelector("[data-block]"),
    box = d.querySelector(".confirm-block");
  if (bl)
    bl.onclick = () => {
      box.hidden = false;
      box.querySelector("[data-blockyes]").focus();
    };
  if (box) {
    box.querySelector("[data-blockno]").onclick = () => (box.hidden = true);
    const yes = box.querySelector("[data-blockyes]");
    yes.onclick = () => run(yes, blockSender);
  }
}

/* ----- Settings: the list of blocked senders ----- */
function blockedSendersHTML() {
  const list = S.get("blockedSenders", []);
  if (!list.length)
    return `<p class="small muted" style="margin:0">${tr("No blocked senders.", "No hay remitentes bloqueados.")}</p>`;
  return `<ul class="blocked-list">${list
    .map(
      (b, i) =>
        `<li><span style="min-width:0"><b>${esc(b.name || b.email)}</b><br><span class="small muted">${esc(b.email)} · ${b.source === "gmail" ? "Gmail" : "Outlook"}</span></span><button class="btn ghost" data-unblock="${i}">${tr("Unblock", "Desbloquear")}</button></li>`
    )
    .join("")}</ul>`;
}
function bindBlockedSenders(root, rerender) {
  const list = S.get("blockedSenders", []);
  root.querySelectorAll("[data-unblock]").forEach(
    b =>
      (b.onclick = async () => {
        const x = list[+b.dataset.unblock];
        b.disabled = true;
        try {
          await unblockSender(x.email, x.source);
          rerender();
        } catch (e) {
          toast(e.message);
          b.disabled = false;
        }
      })
  );
}

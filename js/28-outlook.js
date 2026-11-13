/*
 * ScamSense · Outlook email (Outlook.com, Hotmail, Live, Microsoft 365)
 * Connects with Microsoft's own sign-in page (OAuth with PKCE). ScamSense never sees the password,
 * and asks only to READ mail (Mail.Read). It can't send, delete, or change anything.
 *
 * Setup (one time): register a free app in Microsoft Entra and paste its "Application (client) ID"
 * into Settings → Advanced → Microsoft app ID, or put it in DEFAULT_MS_CLIENT_ID below.
 * Step-by-step guide: docs/outlook-setup.md
 */
"use strict";

const DEFAULT_MS_CLIENT_ID = "1187ff8b-fa16-43d4-acb6-788bb696c627";
const MS_LOGIN = "https://login.microsoftonline.com/common/oauth2/v2.0";
const MS_GRAPH = "https://graph.microsoft.com/v1.0/";
const MS_SCOPES = "openid offline_access User.Read Mail.Read";

const msClientId = () => String(cfg().msClientId || DEFAULT_MS_CLIENT_ID).trim();
const outlookReady = () => !!msClientId();
const outlookConnected = () => !!S.get("ms", null);
/* The page Microsoft sends people back to. It must match the Redirect URI in the Entra app exactly. */
const msRedirect = () => location.origin + location.pathname.replace(/index\.html$/, "");

/* ----- small helpers for the secure sign-in (PKCE) ----- */
const b64url = buf =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
function randomText(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return b64url(a);
}
const sha256 = txt => crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));

/* ----- 1. Send the person to Microsoft's sign-in page ----- */
async function connectOutlook() {
  if (!outlookReady()) {
    toast(
      tr(
        "Outlook isn't set up yet. Add the Microsoft app ID in Settings → Advanced.",
        "Outlook aún no está configurado. Agregue el ID de app de Microsoft en Ajustes → Avanzado."
      )
    );
    return;
  }
  const verifier = randomText(48),
    state = randomText(16);
  sessionStorage.setItem("ss_ms_pkce", JSON.stringify({ verifier, state }));
  const q = new URLSearchParams({
    client_id: msClientId(),
    response_type: "code",
    redirect_uri: msRedirect(),
    response_mode: "query",
    scope: MS_SCOPES,
    state,
    code_challenge: b64url(await sha256(verifier)),
    code_challenge_method: "S256",
    prompt: "select_account"
  });
  location.href = `${MS_LOGIN}/authorize?${q}`;
}

/* ----- 2. Microsoft sends them back with a one-time code; trade it for a token ----- */
let msAccess = null; // { value, exp } — kept in memory only
async function msTokenRequest(params) {
  const r = await fetch(`${MS_LOGIN}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(Object.assign({ client_id: msClientId(), scope: MS_SCOPES }, params))
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token)
    throw new Error(j.error_description ? j.error_description.split("\r\n")[0] : "Microsoft sign-in failed.");
  msAccess = { value: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  // Microsoft gives a new refresh token each time; keep the newest one.
  if (j.refresh_token) S.set("ms", Object.assign(S.get("ms", {}) || {}, { refresh: j.refresh_token }));
  return msAccess.value;
}
async function finishOutlookSignIn() {
  const q = new URLSearchParams(location.search);
  if (!q.has("code") && !q.has("error")) return;
  const saved = JSON.parse(sessionStorage.getItem("ss_ms_pkce") || "null");
  sessionStorage.removeItem("ss_ms_pkce");
  history.replaceState(null, "", msRedirect() + location.hash);
  if (q.has("error")) {
    toast(
      q.get("error_description") ||
        tr("Outlook sign-in was cancelled.", "Se canceló el inicio de sesión de Outlook.")
    );
    return;
  }
  if (!saved || saved.state !== q.get("state")) {
    toast(
      tr(
        "That sign-in link didn't match. Please try again.",
        "Ese inicio de sesión no coincide. Intente de nuevo."
      )
    );
    return;
  }
  try {
    await msTokenRequest({
      grant_type: "authorization_code",
      code: q.get("code"),
      redirect_uri: msRedirect(),
      code_verifier: saved.verifier
    });
    const me = await msGet("me?$select=mail,userPrincipalName").catch(() => ({}));
    S.set("ms", Object.assign(S.get("ms", {}), { email: me.mail || me.userPrincipalName || "" }));
    setStatus();
    toast(tr("Outlook connected.", "Outlook conectado."));
    go("today");
    scanEmail();
  } catch (e) {
    S.del("ms");
    toast(e.message);
  }
}
function disconnectOutlook() {
  S.del("ms");
  msAccess = null;
  setStatus();
  toast(
    tr(
      "Outlook disconnected. To fully remove access, visit account.live.com/consent/Manage.",
      "Outlook desconectado. Para quitar todo el acceso, visite account.live.com/consent/Manage."
    )
  );
}

/* ----- 3. Read mail with Microsoft Graph ----- */
async function msTokenNow() {
  if (msAccess && msAccess.exp > Date.now() + 60000) return msAccess.value;
  const st = S.get("ms", null);
  if (!st || !st.refresh) throw new Error(tr("Please connect Outlook again.", "Conecte Outlook otra vez."));
  try {
    return await msTokenRequest({ grant_type: "refresh_token", refresh_token: st.refresh });
  } catch (e) {
    S.del("ms");
    throw new Error(
      tr(
        "Outlook sign-in expired. Please connect Outlook again in Settings.",
        "El inicio de Outlook venció. Conéctelo otra vez en Ajustes."
      )
    );
  }
}
async function msGet(path) {
  const tok = await msTokenNow();
  const r = await fetch(MS_GRAPH + path, {
    headers: { Authorization: "Bearer " + tok, Prefer: 'outlook.body-content-type="html"' }
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    const err = new Error((j.error && j.error.message) || `Outlook error ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return r.json();
}
/* Outlook folder names → the names ScamSense shows (and translates). */
const MS_FOLDER = {
  inbox: "Inbox",
  junkemail: "Spam",
  "junk email": "Spam",
  deleteditems: "Trash",
  "deleted items": "Trash",
  archive: "Archived"
};
const MS_SELECT =
  "id,subject,from,replyTo,receivedDateTime,body,bodyPreview,hasAttachments,parentFolderId,webLink";
/* Turns one Graph message into the same shape ScamSense uses for Gmail. */
function parseOutlook(m, folders) {
  const H = {};
  (m.internetMessageHeaders || []).forEach(h => {
    const k = h.name.toLowerCase();
    H[k] = H[k] ? H[k] + " ; " + h.value : h.value;
  });
  const body = (m.body && m.body.content) || "";
  let text = "",
    links = [];
  if (m.body && m.body.contentType === "html") {
    const h = htmlToParts(body);
    text = h.text;
    links = h.links;
  } else text = body;
  const from = (m.from && m.from.emailAddress) || {};
  const rt = ((m.replyTo || [])[0] || {}).emailAddress || {};
  const fname = folders[m.parentFolderId] || "";
  const folder = MS_FOLDER[fname.toLowerCase()] || fname || "Inbox";
  return {
    id: m.id,
    folder,
    inSpam: folder === "Spam",
    channel: "email",
    source: "outlook",
    fromName: from.name || "",
    fromEmail: (from.address || "").toLowerCase(),
    replyTo: rt.address || "",
    subject: m.subject || "(no subject)",
    date: Date.parse(m.receivedDateTime) || Date.now(),
    text: (text || m.bodyPreview || "").replace(/\s+/g, " ").slice(0, 6000),
    snippet: m.bodyPreview || "",
    links,
    attachments: m._attachments || [],
    auth: H["authentication-results"] || "",
    listUnsub: !!H["list-unsubscribe"],
    link: m.webLink || ""
  };
}
async function outlookFolders() {
  const map = {},
    skip = new Set();
  const list = await msGet("me/mailFolders?$top=100&$select=id,displayName");
  (list.value || []).forEach(f => (map[f.id] = f.displayName));
  for (const wk of ["sentitems", "drafts", "outbox"]) {
    try {
      skip.add((await msGet(`me/mailFolders/${wk}?$select=id`)).id);
    } catch (e) {}
  }
  for (const wk of ["inbox", "junkemail", "deleteditems", "archive"]) {
    try {
      map[(await msGet(`me/mailFolders/${wk}?$select=id`)).id] = wk;
    } catch (e) {}
  }
  return { map, skip };
}
/* Reads recent mail from every folder except Sent, Drafts, and Outbox. */
async function collectOutlook() {
  const c = cfg();
  renderToday({ progress: { label: tr("Connecting to Outlook…", "Conectando con Outlook…"), pct: 5 } });
  const { map, skip } = await outlookFolders();
  const since = new Date(Date.now() - c.days * 864e5).toISOString();
  const base = `me/messages?$top=${Math.min(100, c.max)}&$filter=receivedDateTime ge ${since}&$orderby=receivedDateTime desc`;
  let page;
  try {
    page = await msGet(`${base}&$select=${MS_SELECT},internetMessageHeaders`);
  } catch (e) {
    if (e.status !== 400) throw e;
    page = await msGet(`${base}&$select=${MS_SELECT}`); // some accounts don't allow headers in a list
  }
  let msgs = (page.value || []).filter(m => !skip.has(m.parentFolderId));
  while (page["@odata.nextLink"] && msgs.length < c.max) {
    page = await msGet(page["@odata.nextLink"].replace(MS_GRAPH, ""));
    msgs = msgs.concat((page.value || []).filter(m => !skip.has(m.parentFolderId)));
  }
  msgs = msgs.slice(0, c.max);
  let done = 0;
  await pool(msgs, 4, async m => {
    if (m.hasAttachments) {
      try {
        const a = await msGet(`me/messages/${m.id}/attachments?$select=name`);
        m._attachments = (a.value || []).map(x => x.name);
      } catch (e) {}
    }
    done++;
    renderToday({
      progress: {
        label: t("prog_read", { d: done, n: msgs.length }),
        pct: 10 + (40 * done) / Math.max(1, msgs.length)
      }
    });
  });
  return msgs.map(m => parseOutlook(m, map));
}
/* One email, in full (used when Mahi reads an email for someone). */
async function outlookFullItem(id) {
  const m = await msGet(`me/messages/${encodeURIComponent(id)}?$select=${MS_SELECT},internetMessageHeaders`);
  if (m.hasAttachments) {
    try {
      m._attachments = ((await msGet(`me/messages/${m.id}/attachments?$select=name`)).value || []).map(
        x => x.name
      );
    } catch (e) {}
  }
  const f = {};
  if (m.parentFolderId) {
    try {
      f[m.parentFolderId] = (
        await msGet(`me/mailFolders/${m.parentFolderId}?$select=displayName`)
      ).displayName;
    } catch (e) {}
  }
  return parseOutlook(m, f);
}

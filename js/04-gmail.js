/*
 * ScamSense · Gmail
 * Signs in to Gmail (read-only) and reads messages from every folder.
 */
"use strict";

let token = null,
  tokenExp = 0;
function getToken(interactive) {
  return new Promise((resolve, reject) => {
    const c = cfg();
    if (!c.clientId) return reject(new Error("Add your Google Client ID in Settings first."));
    if (!/\.apps\.googleusercontent\.com$/.test(c.clientId))
      return reject(
        new Error(
          "That's not a Google Client ID. It's a long code from Google Cloud that ends in .apps.googleusercontent.com, not your email."
        )
      );
    if (location.protocol === "file:")
      return reject(
        new Error(
          "Gmail can't connect when the app is opened from a file. Open it at http://localhost:8000 or your GitHub Pages link."
        )
      );
    if (!(window.google && google.accounts && google.accounts.oauth2))
      return reject(new Error("Google sign-in is still loading. Try again in a moment."));
    if (token && Date.now() < tokenExp - 60000) return resolve(token);
    const tc = google.accounts.oauth2.initTokenClient({
      client_id: c.clientId,
      scope: "https://www.googleapis.com/auth/gmail.readonly",
      callback: r => {
        if (r.error) return reject(new Error("Google sign-in was cancelled or failed: " + r.error));
        token = r.access_token;
        tokenExp = Date.now() + (r.expires_in || 3600) * 1000;
        S.set("connected", true);
        setStatus();
        resolve(token);
      },
      error_callback: e =>
        reject(
          new Error(
            e && e.type === "popup_closed"
              ? "The Google window was closed before finishing."
              : "Google sign-in didn't open. Allow pop-ups for this site and try again."
          )
        )
    });
    tc.requestAccessToken({ prompt: S.get("connected", false) && !interactive ? "" : "consent" });
  });
}
async function gfetch(path) {
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/" + path, {
    headers: { Authorization: "Bearer " + token }
  });
  if (r.status === 401) {
    token = null;
    throw new Error("Google sign-in expired. Tap Scan again.");
  }
  if (!r.ok) throw new Error("Gmail error " + r.status);
  return r.json();
}
function b64(s) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}
function htmlToParts(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("style,script,head,title").forEach(n => n.remove());
  const links = [...doc.querySelectorAll("a[href]")]
    .map(a => ({ href: a.getAttribute("href"), text: (a.textContent || "").trim().slice(0, 140) }))
    .filter(l => /^https?:/i.test(l.href))
    .map(l => Object.assign(l, { host: hostOf(l.href) }));
  doc.querySelectorAll("br,p,div,tr,li").forEach(n => n.append(" "));
  return { text: (doc.body ? doc.body.textContent : "").replace(/\s+/g, " ").trim(), links };
}
/* Gets one message in full. Gmail doesn't include the content of parts that have a file name
   (some companies send their whole email body that way, e.g. "sapwebform.htm"), so for
   text parts like that we download them too, then the parser can treat them as the body. */
async function getGmailMessage(id) {
  const m = await gfetch(`messages/${id}?format=full`);
  const named = [];
  (function walk(p) {
    if (!p) return;
    if (p.parts) p.parts.forEach(walk);
    else if (
      p.filename &&
      /^text\/(html|plain)$/i.test(p.mimeType || "") &&
      p.body &&
      !p.body.data &&
      p.body.attachmentId &&
      (p.body.size || 0) < 400000
    )
      named.push(p);
  })(m.payload);
  for (const p of named.slice(0, 3)) {
    try {
      const a = await gfetch(`messages/${id}/attachments/${p.body.attachmentId}`);
      if (a && a.data) p.body.data = a.data;
    } catch (e) {}
  }
  return m;
}

function parseGmail(m) {
  const H = {};
  (m.payload.headers || []).forEach(h => {
    const k = h.name.toLowerCase();
    H[k] = H[k] ? H[k] + " ; " + h.value : h.value;
  });
  const acc = { plain: "", html: "", attachments: [], namedBodies: [] };
  const disposition = p =>
    ((p.headers || []).find(h => h.name.toLowerCase() === "content-disposition") || {}).value || "";
  (function walk(p) {
    if (!p) return;
    if (p.parts) p.parts.forEach(walk);
    else if (p.filename) {
      // Some company mailers (Salesforce, SAP…) send the email's own body as a named part,
      // like "sapwebform.htm". If it's text shown inline, it's the body, not an attachment.
      const isText = /^text\/(html|plain)$/i.test(p.mimeType || "");
      if (isText && p.body && p.body.data) acc.namedBodies.push(p);
      else acc.attachments.push(p.filename);
    } else if (p.body && p.body.data) {
      if (p.mimeType === "text/plain") acc.plain += b64(p.body.data) + "\n";
      else if (p.mimeType === "text/html") acc.html += b64(p.body.data);
    }
  })(m.payload);
  // A named text part is the body when the email has no other body, or when it's shown inline.
  const noBody = !acc.plain.trim() && !acc.html.trim();
  acc.namedBodies.forEach(p => {
    if (noBody || !/^\s*attachment/i.test(disposition(p))) {
      if (/html/i.test(p.mimeType)) acc.html += b64(p.body.data);
      else acc.plain += b64(p.body.data) + "\n";
    } else acc.attachments.push(p.filename);
  });
  let text = acc.plain.trim(),
    links = [];
  if (acc.html) {
    const h = htmlToParts(acc.html);
    links = h.links;
    if (!text) text = h.text;
  }
  const from = H["from"] || "";
  const fm = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
  const fromName = fm ? fm[1].trim() : "",
    fromEmail = (fm ? fm[2] : from).trim().toLowerCase();
  const rt = H["reply-to"] || "";
  const rtm = rt.match(/<([^>]+)>/);
  const lb = m.labelIds || [];
  const folder = lb.includes("SPAM")
    ? "Spam"
    : lb.includes("TRASH")
      ? "Trash"
      : lb.includes("CATEGORY_PROMOTIONS")
        ? "Promotions"
        : lb.includes("CATEGORY_SOCIAL")
          ? "Social"
          : lb.includes("CATEGORY_UPDATES")
            ? "Updates"
            : lb.includes("CATEGORY_FORUMS")
              ? "Forums"
              : lb.includes("INBOX")
                ? "Inbox"
                : "Archived";
  return {
    id: m.id,
    folder,
    inSpam: folder === "Spam",
    channel: "email",
    source: "gmail",
    fromName,
    fromEmail,
    replyTo: rtm ? rtm[1] : rt.trim(),
    subject: H["subject"] || "(no subject)",
    date: Number(m.internalDate) || Date.now(),
    text: (text || m.snippet || "").replace(/\s+/g, " ").slice(0, 6000),
    snippet: m.snippet || "",
    links,
    attachments: acc.attachments,
    auth: (H["authentication-results"] || "") + " " + (H["arc-authentication-results"] || ""),
    listUnsub: !!H["list-unsubscribe"]
  };
}
async function pool(items, n, fn) {
  let i = 0;
  const run = async () => {
    while (i < items.length) {
      const k = i++;
      await fn(items[k], k);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, run));
}

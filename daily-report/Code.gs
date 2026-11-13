/* ========================================================================
   ScamSense · Daily Safety Report and Automatic Blocking
   (Google Apps Script. Runs inside your own Google account.)

   WHAT IT DOES
   - Every morning: emails you ONE report about everything from the last day:
       • Gmail      every email, in every folder
       • Outlook    every email, in every folder (after connectOutlook)
       • The app    texts, calls, emails and websites you checked in ScamSense,
                    payments you paused, and "I was scammed" (after linking the app)
   - Every 15 minutes: moves clear Gmail scams to Spam and sends you a short
     note saying what was blocked and why.

   HOW TO USE
   - First time: choose "setup" in the menu above and click Run.
   - Add Outlook: run "connectOutlook" and follow the steps in the log.
   - Link the app: Deploy > New deployment > Web app, then run "showAppLink".
   - Test now: run "sendReportNow".  Stop: "stopDailyReport" / "stopBlocking".

   PARTS OF THIS FILE
     1. Settings              you can change these
     2. Start and stop        setup, sendReportNow, stopDailyReport, stopBlocking
     3. Daily report          collects everything and sends the report
     3a. Outlook              connectOutlook, finishOutlook, disconnectOutlook
     3b. App activity         what the ScamSense app sends here (no message text)
     4. Automatic blocking    moves clear scams to Spam and tells you why
     5. Reading an email      turns a Gmail message into something we can check
     6. AI explanations       optional, only if you add an AI key
     7. Writing the emails    the report and the "blocked" note
     8. Scam rules            the warning signs (copied from the app)
     9. Scam checker          scores each email: scam, suspicious, or safe
   ======================================================================== */

/* ========================================================================
   1. SETTINGS
   Change these numbers or words if you want. Then run setup again.
   ======================================================================== */

const CONFIG = {
  HOUR: 8, // time of day to send (in the project's time zone)
  DAYS: 1, // how many days to include
  MAX_EMAILS: 150, // safety limit per inbox
  APP_URL: "https://karimhaidari2.github.io/ScamSense_App/",
  AI_MODEL: "claude-haiku-5-5",
  BLOCK_SCAMS: true, // move Gmail scam emails to Spam automatically
  BLOCK_EVERY_MIN: 15, // how often to check for new scams (5, 10, 15 or 30)
  BLOCK_LABEL: "ScamSense/Blocked",
  MS_CLIENT_ID: "1187ff8b-fa16-43d4-acb6-788bb696c627", // the "scamsense" app in Microsoft Entra
  // Smart AI double-check of risky emails. Uses your Mahi server, so no key is needed here.
  MAHI_URL:
    "https://script.google.com/macros/s/AKfycbwXjtRfbMG2_8y8R9Wje6ddxmZDuPMnsDsFfHlqjw5n_v1-_ey2I4B3URS8cw04QpYn/exec",
  ALSO_SEND_TO: "" // also send the report here, e.g. "me@outlook.com" (comma between several)
};

/* ========================================================================
   2. START AND STOP
   Run these from the menu at the top of the editor.
   ======================================================================== */

// Run ONCE. Turns on the daily report (and blocking), then sends a first report.
function setup() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (["sendDailyReport", "blockScams"].includes(t.getHandlerFunction())) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("sendDailyReport").timeBased().everyDays(1).atHour(CONFIG.HOUR).create();
  if (CONFIG.BLOCK_SCAMS)
    ScriptApp.newTrigger("blockScams").timeBased().everyMinutes(CONFIG.BLOCK_EVERY_MIN).create();
  reportKey(); // makes the secret key the app uses
  if (CONFIG.BLOCK_SCAMS) blockScams();
  sendDailyReport();
}

// Sends a report right now. Good for testing.
function sendReportNow() {
  sendDailyReport();
}

// Turns the daily report off.
function stopDailyReport() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "sendDailyReport") ScriptApp.deleteTrigger(t);
  });
}

// Turns automatic blocking off. The daily report keeps working.
function stopBlocking() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "blockScams") ScriptApp.deleteTrigger(t);
  });
}

/* ========================================================================
   3. DAILY REPORT
   Gmail + Outlook + what you checked in the app, in one email.
   ======================================================================== */

const props = () => PropertiesService.getScriptProperties();
const myEmail = () => Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();

// Collects everything from the last day, checks it, and emails you the report.
function sendDailyReport() {
  const me = myEmail();
  const since = new Date(Date.now() - CONFIG.DAYS * 86400000);

  // 1) Gmail
  const gmail = readGmail(me, since);

  // 2) Outlook (only if connected)
  const out = { connected: outlookConnected(), email: props().getProperty("MS_EMAIL") || "", error: "" };
  let outlook = [];
  if (out.connected) {
    try {
      outlook = readOutlook(since);
    } catch (e) {
      out.error = e.message;
    }
  }

  // 3) What was checked in the app
  const app = { linked: !!props().getProperty("APP_LINKED"), events: appEvents(since) };

  const items = gmail.concat(outlook);
  const order = { scam: 0, warn: 1, safe: 2 };
  items.sort((a, b) => order[a.level] - order[b.level] || b.date - a.date);

  // Optional AI: explain the risky ones in plain words
  const key = props().getProperty("ANTHROPIC_API_KEY");
  let aiUsed = false;
  if (key || CONFIG.MAHI_URL) {
    items
      .filter(i => i.level !== "safe")
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .forEach(it => {
        try {
          const a = aiExplain(key, it);
          if (a) {
            it.ai = a;
            aiUsed = true;
            it.level = aiLevel(it, a.verdict);
          }
        } catch (e) {
          /* keep the built-in result */
        }
      });
    items.sort((a, b) => order[a.level] - order[b.level] || b.date - a.date);
  }

  const d = summarize(items, gmail, outlook, app, out, aiUsed);
  const to = [me]
    .concat(
      String(CONFIG.ALSO_SEND_TO || "")
        .split(",")
        .map(s => s.trim())
    )
    .filter(Boolean);
  GmailApp.sendEmail([...new Set(to)].join(","), reportSubject(d), plainReport(d), {
    htmlBody: htmlReport(d),
    name: "ScamSense Daily Report"
  });
}

// Reads Gmail: every folder except Sent, Drafts, and Chats.
function readGmail(me, since) {
  const threads = GmailApp.search(
    `in:anywhere newer_than:${CONFIG.DAYS}d -in:sent -in:drafts -in:chats`,
    0,
    CONFIG.MAX_EMAILS
  );
  const items = [];
  threads.forEach(th => {
    const folder = th.isInSpam() ? "Spam" : th.isInTrash() ? "Trash" : th.isInInbox() ? "Inbox" : "Archived";
    const wasBlocked = th.getLabels().some(l => l.getName() === CONFIG.BLOCK_LABEL);
    th.getMessages().forEach(m => {
      if (m.getDate() < since || m.isDraft()) return;
      const from = parseFrom(m.getFrom());
      if (me && from.email.toLowerCase() === me.toLowerCase()) return;
      items.push(checkEmail(toMsg(m, from), {
        id: m.getId(),
        source: "gmail",
        date: m.getDate(),
        folder,
        blocked: wasBlocked,
        link: `https://mail.google.com/mail/u/0/#all/${th.getId()}`
      }));
    });
  });
  return items;
}

// Runs the scam checker on one email and returns what the report needs.
function checkEmail(msg, extra) {
  const r = analyze(msg);
  return Object.assign(
    {
      subject: msg.subject,
      fromName: msg.fromName,
      fromEmail: msg.fromEmail,
      level: r.level,
      score: r.score,
      kind: r.kind,
      reasons: r.reasons,
      trusted: r.trusted,
      msg
    },
    extra
  );
}

// Counts everything once, so the email and its subject line always agree.
function summarize(items, gmail, outlook, app, out, aiUsed) {
  const n = { scam: 0, warn: 0, safe: 0 };
  items.forEach(i => n[i.level]++);
  const ev = app.events;
  const checks = ev.filter(e => e.t === "check");
  const risky = checks.filter(e => e.l !== "safe");
  return {
    items,
    n,
    gmail: { count: gmail.length, scams: gmail.filter(i => i.level !== "safe").length },
    outlook: Object.assign({ count: outlook.length, scams: outlook.filter(i => i.level !== "safe").length }, out),
    app,
    checks,
    appRisky: risky.length,
    paused: ev.filter(e => e.t === "pause" && e.o !== "paid").length,
    paid: ev.filter(e => e.t === "pause" && e.o === "paid").length,
    scammed: ev.some(e => e.t === "scammed"),
    blocked: items.filter(i => i.blocked).length,
    caught: n.scam + n.warn + risky.length,
    scams: n.scam + checks.filter(e => e.l === "scam").length,
    aiUsed
  };
}

/* ========================================================================
   3a. OUTLOOK
   Reads Outlook mail with Microsoft's own sign-in (read only: it can't send,
   delete, or change anything). The sign-in is saved in this script only.

   One-time setup in Azure (portal.azure.com):
     App registrations > scamsense > Authentication >
     "Allow public client flows" = Yes > Save
   Then run connectOutlook and follow the steps in the log.
   ======================================================================== */

const MS_LOGIN = "https://login.microsoftonline.com/common/oauth2/v2.0";
const MS_GRAPH = "https://graph.microsoft.com/v1.0/";
const MS_SCOPE = "offline_access User.Read Mail.Read";

// Step 1: shows a code to type at microsoft.com/devicelogin, then waits for you.
function connectOutlook() {
  const r = msPost("/devicecode", { client_id: CONFIG.MS_CLIENT_ID, scope: MS_SCOPE });
  if (!r.device_code) {
    console.log("Microsoft said: " + msError(r));
    return;
  }
  props().setProperty(
    "MS_DEVICE",
    JSON.stringify({ code: r.device_code, every: r.interval || 5, until: Date.now() + r.expires_in * 1000 })
  );
  console.log(
    [
      "Connect Outlook:",
      `  1. Open ${r.verification_uri}`,
      `  2. Type this code:  ${r.user_code}`,
      "  3. Sign in with your Outlook email and click Accept.",
      'Then come back here. This log will say "Outlook connected" (wait up to 4 minutes).'
    ].join("\n")
  );
  waitForOutlook(240);
}

// Step 2 (only if connectOutlook stopped waiting before you finished).
function finishOutlook() {
  waitForOutlook(300);
}

// Removes the saved Outlook sign-in from this script.
function disconnectOutlook() {
  ["MS_REFRESH", "MS_EMAIL", "MS_DEVICE"].forEach(k => props().deleteProperty(k));
  console.log("Outlook disconnected. To remove access fully, visit account.live.com/consent/Manage.");
}

function outlookConnected() {
  return !!props().getProperty("MS_REFRESH");
}

function waitForOutlook(seconds) {
  const d = JSON.parse(props().getProperty("MS_DEVICE") || "null");
  if (!d || d.until < Date.now()) {
    console.log("That code expired. Run connectOutlook again.");
    return;
  }
  const stop = Math.min(d.until, Date.now() + seconds * 1000);
  while (Date.now() < stop) {
    Utilities.sleep(d.every * 1000);
    const r = msPost("/token", {
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      client_id: CONFIG.MS_CLIENT_ID,
      device_code: d.code
    });
    if (r.access_token) {
      props().setProperty("MS_REFRESH", r.refresh_token);
      props().deleteProperty("MS_DEVICE");
      let email = "";
      try {
        const meInfo = msGraph("me?$select=mail,userPrincipalName", r.access_token);
        email = meInfo.mail || meInfo.userPrincipalName || "";
      } catch (e) {}
      props().setProperty("MS_EMAIL", email);
      console.log(`✅ Outlook connected${email ? ": " + email : ""}. Your daily report now includes it.`);
      return;
    }
    if (r.error === "authorization_pending") continue;
    if (r.error === "slow_down") {
      d.every += 5;
      continue;
    }
    console.log("Microsoft said: " + msError(r));
    return;
  }
  console.log("Still waiting. If you already typed the code, run finishOutlook. (The code works for 15 minutes.)");
}

// Plain-words version of a Microsoft error, with the fix when we know it.
function msError(r) {
  const m = String(r.error_description || r.error || JSON.stringify(r)).split("\r\n")[0];
  if (/7000218|70002|client_assertion|client_secret|marked as .mobile/i.test(m))
    return (
      m +
      '\nFIX: In Azure open App registrations > scamsense > Authentication, set "Allow public client flows" to Yes, click Save, then run connectOutlook again.'
    );
  return m;
}

function msPost(path, form) {
  const res = UrlFetchApp.fetch(MS_LOGIN + path, { method: "post", payload: form, muteHttpExceptions: true });
  try {
    return JSON.parse(res.getContentText());
  } catch (e) {
    return { error: "HTTP " + res.getResponseCode() };
  }
}

// A fresh access token from the saved sign-in. Microsoft gives a new sign-in each time; keep it.
function msToken() {
  const refresh = props().getProperty("MS_REFRESH");
  if (!refresh) throw new Error("Outlook is not connected.");
  const r = msPost("/token", {
    grant_type: "refresh_token",
    client_id: CONFIG.MS_CLIENT_ID,
    refresh_token: refresh,
    scope: MS_SCOPE
  });
  if (!r.access_token) {
    if (r.error === "invalid_grant") props().deleteProperty("MS_REFRESH");
    throw new Error("Outlook sign-in expired. Run connectOutlook again. (" + msError(r).split("\n")[0] + ")");
  }
  if (r.refresh_token) props().setProperty("MS_REFRESH", r.refresh_token);
  return r.access_token;
}

function msGraph(path, token) {
  const url = /^https:/.test(path) ? path : MS_GRAPH + path;
  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: "Bearer " + token, Prefer: 'outlook.body-content-type="html"' },
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  const j = JSON.parse(res.getContentText() || "{}");
  if (code >= 400) {
    const e = new Error((j.error && j.error.message) || "Outlook error " + code);
    e.status = code;
    throw e;
  }
  return j;
}

// Reads Outlook: every folder except Sent, Drafts, and Outbox.
function readOutlook(since) {
  const tok = msToken();
  const g = p => msGraph(p, tok);
  const me = (props().getProperty("MS_EMAIL") || "").toLowerCase();
  const folders = {},
    skip = {};
  (g("me/mailFolders?$top=100&$select=id,displayName").value || []).forEach(f => (folders[f.id] = f.displayName));
  ["sentitems", "drafts", "outbox"].forEach(wk => {
    try {
      skip[g(`me/mailFolders/${wk}?$select=id`).id] = true;
    } catch (e) {}
  });
  const NAMES = { inbox: "Inbox", junkemail: "Spam", deleteditems: "Trash", archive: "Archived" };
  Object.keys(NAMES).forEach(wk => {
    try {
      folders[g(`me/mailFolders/${wk}?$select=id`).id] = NAMES[wk];
    } catch (e) {}
  });
  const sel = "id,subject,from,replyTo,receivedDateTime,body,bodyPreview,hasAttachments,parentFolderId,webLink";
  const base =
    "me/messages?$top=50&$orderby=receivedDateTime%20desc&$filter=" +
    encodeURIComponent("receivedDateTime ge " + since.toISOString());
  let page;
  try {
    page = g(`${base}&$select=${sel},internetMessageHeaders`);
  } catch (e) {
    if (e.status !== 400) throw e;
    page = g(`${base}&$select=${sel}`); // some accounts don't allow headers in a list
  }
  let msgs = (page.value || []).filter(m => !skip[m.parentFolderId]);
  while (page["@odata.nextLink"] && msgs.length < CONFIG.MAX_EMAILS) {
    page = g(page["@odata.nextLink"]);
    msgs = msgs.concat((page.value || []).filter(m => !skip[m.parentFolderId]));
  }
  return msgs
    .slice(0, CONFIG.MAX_EMAILS)
    .map(m => outlookItem(m, folders, g))
    .filter(it => it.fromEmail && it.fromEmail !== me);
}

// Turns one Outlook message into the same shape as a Gmail one.
function outlookItem(m, folders, g) {
  const H = {};
  (m.internetMessageHeaders || []).forEach(h => {
    const k = h.name.toLowerCase();
    H[k] = H[k] ? H[k] + " ; " + h.value : h.value;
  });
  const html = (m.body && m.body.content) || "";
  const isHtml = !m.body || m.body.contentType !== "text";
  let attachments = [];
  if (m.hasAttachments) {
    try {
      attachments = (g(`me/messages/${encodeURIComponent(m.id)}/attachments?$select=name`).value || []).map(
        a => a.name
      );
    } catch (e) {}
  }
  const from = (m.from && m.from.emailAddress) || {};
  const rt = ((m.replyTo || [])[0] || {}).emailAddress || {};
  const folder = folders[m.parentFolderId] || "Inbox";
  const msg = {
    subject: (m.subject || "(no subject)").replace(/\uFFFD+/g, "").trim(),
    text: (isHtml ? htmlText(html) : html).slice(0, 6000) || m.bodyPreview || "",
    fromName: from.name || "",
    fromEmail: (from.address || "").toLowerCase(),
    replyTo: rt.address || "",
    auth: H["authentication-results"] || "",
    listUnsub: !!H["list-unsubscribe"],
    links: isHtml ? linksFromHtml(html) : [],
    attachments
  };
  return checkEmail(msg, {
    id: m.id,
    source: "outlook",
    date: new Date(m.receivedDateTime),
    folder,
    blocked: false,
    link: m.webLink || "https://outlook.live.com/mail/"
  });
}

// Email HTML → plain text.
function htmlText(html) {
  return String(html || "")
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/* ========================================================================
   3b. APP ACTIVITY
   The ScamSense app sends a short note here each time you check a text,
   call, email or website, pause a payment, or open "I was scammed".
   It sends only the kind, the result, and the time. Never the message itself.

   To link the app:
     1. Deploy > New deployment > type "Web app"
        Execute as: Me · Who has access: Anyone > Deploy
     2. Run showAppLink and copy the link from the log.
     3. In ScamSense: Settings > Advanced > Daily report link > paste.
   ======================================================================== */

// The secret key the app must send. Made once by setup (or here).
function reportKey() {
  let k = props().getProperty("REPORT_KEY");
  if (!k) {
    k = Utilities.getUuid().replace(/-/g, "");
    props().setProperty("REPORT_KEY", k);
  }
  return k;
}

// Prints the link to paste into the app.
function showAppLink() {
  let url = "";
  try {
    url = ScriptApp.getService().getUrl() || "";
  } catch (e) {}
  const key = reportKey();
  if (!url || /\/dev$/.test(url)) {
    console.log(
      [
        "Copy the Web app URL from Deploy > Manage deployments (it ends in /exec).",
        "Then add this to the end of it:",
        `   ?key=${key}`,
        "Paste the whole thing into ScamSense > Settings > Advanced > Daily report link."
      ].join("\n")
    );
    return;
  }
  console.log(
    "Paste this into ScamSense > Settings > Advanced > Daily report link:\n\n" + url + "?key=" + key
  );
}

// Lets the app check that the link works.
function doGet(e) {
  const ok = !!(e && e.parameter && e.parameter.key === reportKey());
  return json(ok ? { ok, app: "ScamSense Daily Report", outlook: outlookConnected() } : { ok: false });
}

// Receives events from the app.
function doPost(e) {
  let body = {};
  try {
    body = JSON.parse((e.postData && e.postData.contents) || "{}");
  } catch (x) {}
  const key = (e.parameter && e.parameter.key) || body.key;
  if (!key || key !== reportKey()) return json({ ok: false, error: "wrong key" });
  const evs = [].concat(body.events || []).slice(0, 50).map(cleanEvent).filter(Boolean);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    props().setProperty("APP_LINKED", "1");
    if (evs.length) {
      let list = [];
      try {
        list = JSON.parse(props().getProperty("APP_EVENTS") || "[]");
      } catch (x) {}
      const have = {};
      list.forEach(x => (have[x.id] = true));
      const cutoff = Date.now() - 3 * 86400000;
      list = list
        .concat(evs.filter(x => !have[x.id] && (have[x.id] = true)))
        .filter(x => x.at > cutoff)
        .slice(-120); // stays well under Google's size limit
      props().setProperty("APP_EVENTS", JSON.stringify(list));
    }
  } finally {
    lock.releaseLock();
  }
  return json({ ok: true, saved: evs.length });
}

// Keeps only the few safe fields we expect.
function cleanEvent(x) {
  if (!x || typeof x !== "object") return null;
  const t = { check: "check", pause: "pause", scammed: "scammed" }[x.t];
  if (!t) return null;
  const at = +x.at;
  return {
    id: String(x.id || "").slice(0, 24) || Utilities.getUuid().slice(0, 12),
    t,
    c: ["email", "text", "call", "web", "other"].includes(x.c) ? x.c : "other",
    l: ["scam", "warn", "safe"].includes(x.l) ? x.l : "",
    k: /^[a-z_]{1,20}$/.test(x.k || "") ? x.k : "",
    o: x.o === "paid" ? "paid" : "",
    at: at > Date.now() - 7 * 86400000 && at <= Date.now() + 60000 ? at : Date.now()
  };
}

function appEvents(since) {
  try {
    return JSON.parse(props().getProperty("APP_EVENTS") || "[]")
      .filter(x => x.at >= since.getTime())
      .sort((a, b) => b.at - a.at);
  } catch (e) {
    return [];
  }
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ========================================================================
   4. AUTOMATIC BLOCKING
   Clear scams go to Spam. Never blocks a verified company or someone you've emailed.
   ======================================================================== */

// Runs every few minutes. Moves clear scams to Spam and labels them ScamSense/Blocked.
function blockScams() {
  const me = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();
  const props = PropertiesService.getScriptProperties();
  let seen = [];
  try {
    seen = JSON.parse(props.getProperty("SEEN_IDS") || "[]");
  } catch (e) {
    seen = [];
  }
  const seenSet = new Set(seen);
  const label = GmailApp.getUserLabelByName(CONFIG.BLOCK_LABEL) || GmailApp.createLabel(CONFIG.BLOCK_LABEL);
  const threads = GmailApp.search("newer_than:1d -in:spam -in:trash -in:sent -in:drafts -in:chats", 0, 60);
  const blocked = [];
  threads.forEach(th => {
    th.getMessages().forEach(m => {
      const id = m.getId();
      if (seenSet.has(id) || m.isDraft()) return;
      seenSet.add(id);
      seen.push(id);
      const from = parseFrom(m.getFrom());
      if (!from.email || (me && from.email.toLowerCase() === me.toLowerCase())) return;
      const msg = toMsg(m, from);
      const r = analyze(msg);
      if (r.level !== "scam" || r.trusted) return;
      if (knownContact(from.email)) return;
      th.moveToSpam();
      th.addLabel(label);
      blocked.push({
        fromName: from.name,
        fromEmail: from.email,
        subject: msg.subject,
        kind: r.kind,
        why: bestWhy({ reasons: r.reasons })
      });
    });
  });
  props.setProperty("SEEN_IDS", JSON.stringify(seen.slice(-800)));
  if (blocked.length) sendBlockedNotice(me, blocked);
}

// True if you have ever emailed this person (we never block them).
function knownContact(email) {
  try {
    return GmailApp.search(`in:sent to:${email}`, 0, 1).length > 0;
  } catch (e) {
    return false;
  }
}

// The short email: what was blocked and why.
function sendBlockedNotice(me, blocked) {
  const n = blocked.length;
  const subject = `ScamSense blocked ${n} scam email${n > 1 ? "s" : ""}`;
  const plain = [
    `ScamSense blocked ${n} scam email${n > 1 ? "s" : ""} and moved ${n > 1 ? "them" : "it"} to Spam.`,
    ""
  ]
    .concat(blocked.map(b => `• ${b.fromName || b.fromEmail} — "${b.subject}"\n  Why: ${b.why}`))
    .concat([
      "",
      `You don't need to do anything. Don't open ${n > 1 ? "them" : "it"}.`,
      'If one was a real email, open Spam in Gmail and tap "Not spam".'
    ])
    .join("\n");
  const rows = blocked
    .map(
      b => `<div style="border-left:4px solid #B42318;background:#fff;border-radius:10px;padding:12px 14px;margin:0 0 10px">
      <div style="font-weight:700;font-size:16px">${esc(b.fromName || b.fromEmail)}</div>
      <div style="color:#5B6B6E;font-size:13px">${esc(b.fromEmail)}</div>
      <div style="font-size:15px;margin-top:4px">"${esc(b.subject)}"</div>
      <div style="font-size:15px;margin-top:8px"><b style="color:#B42318">Why:</b> ${esc(b.why)}</div></div>`
    )
    .join("");
  const html = `<!doctype html><html><body style="margin:0;background:#F3F6F5;font-family:Arial,Helvetica,sans-serif;color:#0E3B43">
    <div style="max-width:560px;margin:0 auto;padding:20px 14px">
      <div style="font-size:20px;font-weight:800;margin:0 0 12px">🦉 ScamSense</div>
      <div style="background:#fff;border-radius:16px;border-top:6px solid #B42318;padding:16px 18px;margin-bottom:14px">
        <div style="font-size:22px;font-weight:800;line-height:1.25">🛡️ Blocked ${n} scam email${n > 1 ? "s" : ""}</div>
        <p style="font-size:15px;margin:8px 0 0">${n > 1 ? "They were" : "It was"} moved to Spam. You don't need to do anything. Don't open ${n > 1 ? "them" : "it"}.</p></div>
      ${rows}
      <p style="color:#5B6B6E;font-size:13px;margin:12px 4px 0">If one was a real email, open <b>Spam</b> in Gmail and tap <b>Not spam</b>.</p>
    </div></body></html>`;
  GmailApp.sendEmail(me, subject, plain, { htmlBody: html, name: "ScamSense" });
}

/* ========================================================================
   5. READING AN EMAIL
   Turns a Gmail message into the details the scam checker needs.
   ======================================================================== */

// Collects sender, subject, text, links, attachments, and Gmail's sender checks.
function toMsg(m, from) {
  const html = m.getBody() || "";
  return {
    subject: (m.getSubject() || "").replace(/\uFFFD+/g, "").trim(),
    text: (m.getPlainBody() || "").slice(0, 6000),
    fromName: from.name,
    fromEmail: from.email,
    replyTo: (m.getReplyTo() || "").replace(/^.*</, "").replace(/>.*$/, ""),
    auth: safeHeader(m, "Authentication-Results") + " " + safeHeader(m, "ARC-Authentication-Results"),
    listUnsub: !!safeHeader(m, "List-Unsubscribe"),
    links: linksFromHtml(html),
    attachments: realAttachments(m, html)
  };
}

// Attachment names, skipping an .htm part that is just the email's own body
// (some company mailers send the body that way, e.g. "sapwebform.htm").
function realAttachments(m, html) {
  return m
    .getAttachments({ includeInlineImages: false })
    .filter(a => {
      if (!/\.html?$/i.test(a.getName())) return true;
      const start = a
        .getDataAsString()
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
      const body = String(html || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ");
      return !(start && body.includes(start));
    })
    .map(a => a.getName());
}

// Reads one email header without failing.
function safeHeader(m, h) {
  try {
    return m.getHeader(h) || "";
  } catch (e) {
    return "";
  }
}

// "Name <email>" → { name, email }
function parseFrom(f) {
  f = f || "";
  const mm = f.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/);
  return mm ? { name: mm[1].trim(), email: mm[2].trim() } : { name: "", email: f.trim() };
}

// Finds the links in the email and what text they show.
function linksFromHtml(html) {
  const out = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let x;
  while ((x = re.exec(html)) && out.length < 60) {
    const href = x[1];
    if (!/^https?:/i.test(href)) continue;
    const text = x[2]
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();
    out.push({ href, host: hostOf(href), text });
  }
  return out;
}

// https://www.example.com/page → www.example.com
function hostOf(u) {
  const m = String(u).match(/^(?:https?:\/\/)?([^\/?#:]+)/i);
  return m ? m[1].toLowerCase() : "";
}

/* ========================================================================
   6. AI EXPLANATIONS (OPTIONAL)
   Only used if you add ANTHROPIC_API_KEY in Project Settings > Script Properties.
   ======================================================================== */

// Combines the AI's answer with the built-in score (same rules as the app).
function aiLevel(it, verdict) {
  let v = { safe: "safe", suspicious: "warn", scam: "scam" }[verdict] || "warn";
  if (v === "safe" && it.score >= 12) v = "warn"; // very strong warning signs: still be careful
  if (it.trusted && it.score < 8 && v === "scam") v = "warn";
  if (it.score >= 14 && v === "warn") v = "scam";
  return v;
}

// Asks Anthropic's AI to explain one risky email in plain words.
function aiExplain(key, it) {
  const sys =
    'You are ScamSense, protecting older adults from scams. Judge the email. Reply with ONLY JSON: {"verdict":"safe"|"suspicious"|"scam","explanation":"2 short, plain sentences a 75-year-old can follow","what_to_do":["2-3 short steps"]}';
  const user = [
    `From: ${it.fromName} <${it.fromEmail}>`,
    `Subject: ${it.subject}`,
    `Link destinations: ${[...new Set(it.msg.links.map(l => l.host))].slice(0, 10).join(", ") || "none"}`,
    `Sender checks: ${(it.msg.auth.match(/(spf|dkim|dmarc)=\w+/gi) || []).join(", ") || "unknown"}`,
    it.msg.replyTo ? `Reply-To: ${it.msg.replyTo}` : "",
    it.msg.listUnsub ? "Has an unsubscribe link (bulk mailing)." : "",
    `Warning signs found: ${it.reasons.join(" | ") || "none"}`,
    `Email text:\n${it.msg.text.slice(0, 3000)}`
  ]
    .filter(Boolean)
    .join("\n");
  if (!key) {
    // No key in this script: ask the Mahi server (it keeps the key hidden).
    const r = UrlFetchApp.fetch(CONFIG.MAHI_URL, {
      method: "post",
      contentType: "text/plain",
      muteHttpExceptions: true,
      payload: JSON.stringify({
        mode: "check",
        lang: "English",
        check: `Channel: email\n${user.replace("Email text:", 'Message text:\n"""')}\n"""`
      })
    });
    const out = JSON.parse(r.getContentText() || "{}");
    const m = String(out.text || "").match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  }
  const res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    payload: JSON.stringify({
      model: CONFIG.AI_MODEL,
      max_tokens: 400,
      system: sys,
      messages: [{ role: "user", content: user }]
    })
  });
  if (res.getResponseCode() !== 200) return null;
  const txt = (JSON.parse(res.getContentText()).content || []).map(c => c.text || "").join("");
  const j = txt.match(/\{[\s\S]*\}/);
  return j ? JSON.parse(j[0]) : null;
}

/* ========================================================================
   7. WRITING THE EMAILS
   What the report and the blocked note look like.
   ======================================================================== */

// What to do, by level and by inbox.
const ADVICE = {
  scam: [
    "Don't click links, open attachments, call numbers, or reply.",
    "Don't send money, gift cards, or codes.",
    "If you're worried, contact the company yourself using a number you already trust."
  ],
  warn: [
    "Slow down. Don't click links or call numbers in it yet.",
    "Check it yourself: open the company's app or call the number on your card.",
    "Ask a family member or helper to take a look."
  ]
};
const REPORT_HOW = {
  gmail: 'Report it: in Gmail tap ⋮ then "Report phishing".',
  outlook: 'Report it: in Outlook choose Report, then "Report phishing".'
};

// Short tips. One a day, in turn.
const TIPS = [
  "Real companies never ask you to pay with gift cards, crypto, or a wire transfer.",
  "If someone says “don't tell anyone,” that's a scam sign. Tell someone you trust.",
  "Your bank will never ask for the code they text you. Never read it to anyone.",
  "A call from “your grandson” asking for bail? Hang up and call him on his usual number.",
  "Got a scary pop-up saying your computer has a virus? Don't call the number. Just close it.",
  "The IRS, Medicare, and Social Security don't call to demand payment or threaten arrest.",
  "Check a link before you tap: the real name comes right before .com.",
  "A text about an unpaid toll or package fee is almost always fake. Check the official app.",
  "Pressure to act “right now” is the scammer's best tool. You can always take a day.",
  "Never let a stranger remote into your computer, even if they say they're from Microsoft or your bank."
];

const COL = { scam: "#B42318", warn: "#A15C00", safe: "#1F7A3E" };
const TINT = { scam: "#FDECEA", warn: "#FFF3DF", safe: "#E6F4EA" };
const WORD = { scam: "Scam", warn: "Be careful", safe: "Safe" };
const INBOX = {
  gmail: { name: "Gmail", fg: "#B3261E", bg: "#FCE8E6" },
  outlook: { name: "Outlook", fg: "#0F5CB5", bg: "#E3EEFB" },
  app: { name: "ScamSense app", fg: "#0B6E6D", bg: "#E0F2F1" }
};
const CHANNEL = { email: "Email", text: "Text message", call: "Phone call", web: "Website", other: "Message" };
const INK = "#0E2A30",
  MUTED = "#5B6B6E",
  LINE = "#E3EAE8",
  BRAND = "#0E7C7B";

// Picks the clearest reason to show first.
// The AI's words are used only when the AI agrees with the final result.
const aiAgrees = i =>
  !!(i.ai && ({ safe: "safe", suspicious: "warn", scam: "scam" }[i.ai.verdict] || "warn") === i.level);
function bestWhy(i) {
  if (aiAgrees(i) && i.ai.explanation) return i.ai.explanation;
  const pri = [
    /says it's from|sender's address|temporary \(throwaway\)/i,
    /a link (goes|says|is)/i,
    /gift card|crypto|code|remote access|withdraw/i,
    /arrest|secret|family|won something/i
  ];
  for (const re of pri) {
    const r = i.reasons.find(x => re.test(x));
    if (r) return r;
  }
  return i.reasons[0] || "";
}

// Makes text safe to put inside the email's HTML.
function esc(s) {
  return String(s == null ? "" : s).replace(
    /[&<>"]/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
  );
}

// Date like "Tue Nov 10, 8:00 AM".
function fmt(d) {
  return Utilities.formatDate(new Date(d), Session.getScriptTimeZone(), "EEE MMM d, h:mm a");
}
function fmtTime(d) {
  return Utilities.formatDate(new Date(d), Session.getScriptTimeZone(), "h:mm a");
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + "s"}`;

// The headline everyone sees first.
function headline(d) {
  if (d.scammed)
    return {
      tone: "scam",
      icon: "!",
      head: "You started the “I was scammed” steps.",
      sub: "Keep going, one step at a time: call your bank using the number on your card, then follow your recovery plan in ScamSense."
    };
  if (d.scams)
    return {
      tone: "scam",
      icon: "!",
      head: `${plural(d.scams, "scam")} caught. Don't open ${d.scams === 1 ? "it" : "them"}.`,
      sub: "Each one is explained below, with what to do."
    };
  if (d.caught)
    return {
      tone: "warn",
      icon: "?",
      head: `${plural(d.caught, "thing")} need${d.caught === 1 ? "s" : ""} a careful look.`,
      sub: "Nothing is clearly a scam, but slow down with these."
    };
  return { tone: "safe", icon: "✓", head: "All clear. No scams found.", sub: "Everything we checked looked safe." };
}

// "We checked 41 emails in Gmail and Outlook, and 3 things in the app."
function coverage(d) {
  const inboxes = ["Gmail"].concat(d.outlook.connected && !d.outlook.error ? ["Outlook"] : []).join(" and ");
  const emails = d.gmail.count + d.outlook.count;
  let s = `We checked ${plural(emails, "email")} in ${inboxes}`;
  if (d.checks.length) s += `, and ${plural(d.checks.length, "thing")} you checked in the app`;
  return s + ` from the last ${CONFIG.DAYS === 1 ? "24 hours" : CONFIG.DAYS + " days"}.`;
}

function reportSubject(d) {
  if (d.scammed) return "ScamSense: your next steps after a scam";
  if (d.scams) return `ScamSense: ${plural(d.scams, "scam")} caught today — don't open ${d.scams === 1 ? "it" : "them"}`;
  if (d.caught) return `ScamSense: ${plural(d.caught, "thing")} need${d.caught === 1 ? "s" : ""} a careful look`;
  const emails = d.gmail.count + d.outlook.count;
  return `ScamSense: all clear today (${plural(emails, "email")}${d.checks.length ? `, ${plural(d.checks.length, "check")}` : ""})`;
}

// Plain-text version of the report (for email apps that don't show HTML).
function plainReport(d) {
  const h = headline(d);
  const L = [`ScamSense Daily Safety Report — ${fmt(new Date())}`, "", h.head, coverage(d), ""];
  L.push(
    `Gmail: ${plural(d.gmail.count, "email")}` +
      ` · Outlook: ${d.outlook.connected ? plural(d.outlook.count, "email") : "not connected"}` +
      ` · Checked in the app: ${d.checks.length}` +
      ` · Blocked: ${d.blocked} · Payments paused: ${d.paused}`,
    ""
  );
  const risky = d.items.filter(i => i.level !== "safe");
  if (risky.length) L.push("NEEDS YOUR ATTENTION");
  risky.forEach(i => {
    L.push(
      `${i.level === "scam" ? "SCAM" : "BE CAREFUL"} [${INBOX[i.source].name} · ${i.folder}] ${i.fromName || i.fromEmail} — ${i.subject}`
    );
    L.push("  " + bestWhy(i));
  });
  const appRows = appRowsData(d);
  if (appRows.length) {
    L.push("", "CHECKED IN THE APP");
    appRows.forEach(r => L.push(`${fmtTime(r.at)}  ${r.what} — ${r.result}${r.detail ? " (" + r.detail + ")" : ""}`));
  }
  L.push("", "Tip of the day: " + tipOfDay(), "", `Open ScamSense: ${CONFIG.APP_URL}`);
  return L.join("\n");
}

function tipOfDay() {
  const day = Math.floor(Date.now() / 86400000);
  return TIPS[day % TIPS.length];
}

// Rows for "Checked in the app".
function appRowsData(d) {
  return d.app.events.map(e => {
    if (e.t === "scammed")
      return { at: e.at, lv: "scam", what: "Opened “I was scammed”", result: "Recovery plan", detail: "" };
    if (e.t === "pause")
      return e.o === "paid"
        ? { at: e.at, lv: "scam", what: "Pause before you pay", result: "Already paid", detail: "" }
        : {
            at: e.at,
            lv: "safe", // stopping a payment is a good outcome
            what: "Pause before you pay",
            result: "Payment stopped",
            detail: e.l === "scam" ? "it looked like a scam" : e.l === "warn" ? "it looked risky" : ""
          };
    return {
      at: e.at,
      lv: e.l || "safe",
      what: CHANNEL[e.c] || "Message",
      result: WORD[e.l || "safe"],
      detail: e.l !== "safe" && e.k && TYPES[e.k] ? "looks like a " + TYPES[e.k] : ""
    };
  });
}

/* ----- small HTML pieces (email-safe: tables and inline styles only) ----- */
const pill = (lv, text) =>
  `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${TINT[lv]};color:${COL[lv]};font-weight:700;font-size:12px;letter-spacing:.02em">${esc(text)}</span>`;
const badge = src =>
  `<span style="display:inline-block;padding:3px 9px;border-radius:6px;background:${INBOX[src].bg};color:${INBOX[src].fg};font-weight:700;font-size:12px">${INBOX[src].name}</span>`;
const sectionTitle = (title, note) =>
  `<tr><td style="padding:26px 6px 10px"><div style="font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${MUTED}">${esc(title)}${note ? `<span style="font-weight:600;letter-spacing:0;text-transform:none"> · ${esc(note)}</span>` : ""}</div></td></tr>`;
const box = (inner, extra) =>
  `<tr><td style="padding:0 0 12px"><div style="background:#ffffff;border:1px solid ${LINE};border-radius:14px;${extra || ""}">${inner}</div></td></tr>`;

function tile(label, value, sub, color) {
  return `<td width="33%" valign="top" style="padding:5px"><div style="background:#ffffff;border:1px solid ${LINE};border-radius:12px;padding:12px 12px 11px">
    <div style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${MUTED}">${esc(label)}</div>
    <div style="font-size:28px;line-height:1.1;font-weight:800;color:${color || INK};margin-top:6px">${esc(value)}</div>
    <div style="font-size:12px;color:${MUTED};margin-top:2px">${esc(sub)}</div></div></td>`;
}

// Green / amber / red bar showing how everything came out.
function safetyBar(d) {
  const c = { safe: d.n.safe, warn: d.n.warn, scam: d.n.scam };
  d.checks.forEach(e => c[e.l || "safe"]++);
  const total = c.safe + c.warn + c.scam;
  if (!total) return "";
  const cells = ["safe", "warn", "scam"]
    .filter(k => c[k])
    .map(k => `<td width="${Math.max(4, Math.round((100 * c[k]) / total))}%" style="background:${COL[k]};height:10px;font-size:0;line-height:0">&nbsp;</td>`)
    .join("");
  const key = ["safe", "warn", "scam"]
    .map(
      k =>
        `<span style="white-space:nowrap;margin-right:14px"><span style="display:inline-block;width:9px;height:9px;border-radius:9px;background:${COL[k]};vertical-align:middle"></span> <b style="color:${INK}">${c[k]}</b> ${k === "safe" ? "safe" : k === "warn" ? "be careful" : c[k] === 1 ? "scam" : "scams"}</span>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-radius:6px;overflow:hidden;margin-top:16px"><tr>${cells}</tr></table>
    <div style="font-size:13px;color:${MUTED};margin-top:8px">${key}</div>`;
}

// One risky email.
function emailCard(i) {
  const why = bestWhy(i);
  const signs = i.reasons
    .filter(r => r !== why)
    .slice(0, 3)
    .map(r => `<li style="margin:3px 0">${esc(r)}</li>`)
    .join("");
  const todo = ((aiAgrees(i) && i.ai.what_to_do) || ADVICE[i.level].concat(i.level === "scam" ? [REPORT_HOW[i.source]] : []))
    .slice(0, 4)
    .map(t => `<li style="margin:3px 0">${esc(t)}</li>`)
    .join("");
  const where = i.blocked ? `<b style="color:${COL.scam}">Blocked → moved to Spam</b>` : esc(i.folder);
  const label = s =>
    `<div style="font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:${MUTED};margin-top:14px">${s}</div>`;
  return box(
    `<div style="border-top:5px solid ${COL[i.level]};border-radius:14px 14px 0 0"></div>
    <div style="padding:14px 18px 16px">
      <div>${pill(i.level, i.level === "scam" ? "SCAM" : "BE CAREFUL")} ${badge(i.source)} <span style="font-size:12px;color:${MUTED}">${where} · ${esc(fmt(i.date))}</span></div>
      <div style="font-size:17px;font-weight:800;margin-top:10px;color:${INK}">${esc(i.fromName || i.fromEmail)}</div>
      <div style="font-size:13px;color:${MUTED}">${esc(i.fromEmail)}</div>
      <div style="font-size:15px;margin-top:6px;color:${INK}">“${esc(i.subject)}”</div>
      ${i.kind ? `<div style="font-size:14px;font-weight:700;color:${COL[i.level]};margin-top:10px">Looks like: ${esc(i.kind)}</div>` : ""}
      <div style="background:${TINT[i.level]};border-radius:10px;padding:10px 12px;margin-top:10px;font-size:15px;line-height:1.45;color:${INK}">${esc(why)}</div>
      ${signs ? `${label("Other warning signs")}<ul style="margin:6px 0 0 18px;padding:0;font-size:14px;line-height:1.4;color:${INK}">${signs}</ul>` : ""}
      ${label("What to do")}<ol style="margin:6px 0 0 18px;padding:0;font-size:14px;line-height:1.4;color:${INK}">${todo}</ol>
      <a href="${esc(i.link)}" style="display:inline-block;margin-top:14px;padding:9px 14px;border-radius:9px;border:1px solid ${LINE};color:${BRAND};font-weight:700;font-size:14px;text-decoration:none">View in ${INBOX[i.source].name} →</a>
      <span style="font-size:12px;color:${MUTED}">&nbsp; Don't click links inside it.</span>
    </div>`
  );
}

// The designed report email.
function htmlReport(d) {
  const h = headline(d);
  const risky = d.items.filter(i => i.level !== "safe"),
    safe = d.items.filter(i => i.level === "safe");
  const day = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "EEEE, MMMM d");

  const tiles =
    `<tr>${tile("Gmail", d.gmail.count, d.gmail.scams ? `${d.gmail.scams} need a look` : "emails · all clean")}` +
    tile(
      "Outlook",
      d.outlook.connected ? (d.outlook.error ? "!" : d.outlook.count) : "—",
      !d.outlook.connected
        ? "not connected"
        : d.outlook.error
          ? "couldn't read"
          : d.outlook.scams
            ? `${d.outlook.scams} need a look`
            : "emails · all clean"
    ) +
    tile("In the app", d.checks.length, d.app.linked ? "texts, calls & more" : "not linked yet") +
    `</tr><tr>${tile("Scams caught", d.scams, d.caught > d.scams ? `+${d.caught - d.scams} be careful` : "today", d.scams ? COL.scam : COL.safe)}` +
    tile("Blocked", d.blocked, "moved to Spam for you", d.blocked ? BRAND : INK) +
    tile("Paused", d.paused, d.paused === 1 ? "payment stopped" : "payments stopped", d.paused ? BRAND : INK) +
    "</tr>";

  const appRows = appRowsData(d)
    .map(
      (r, k) => `<tr>
      <td style="padding:11px 0 11px 16px;${k ? `border-top:1px solid ${LINE};` : ""}vertical-align:top;width:12px"><span style="display:inline-block;width:10px;height:10px;border-radius:10px;background:${COL[r.lv]};margin-top:5px"></span></td>
      <td style="padding:11px 10px;${k ? `border-top:1px solid ${LINE};` : ""}font-size:15px;color:${INK}"><b>${esc(r.what)}</b>${r.detail ? `<br><span style="font-size:13px;color:${MUTED}">${esc(r.detail)}</span>` : ""}</td>
      <td style="padding:11px 16px 11px 0;${k ? `border-top:1px solid ${LINE};` : ""}text-align:right;white-space:nowrap;vertical-align:top">${pill(r.lv, r.result)}<div style="font-size:12px;color:${MUTED};margin-top:4px">${esc(fmtTime(r.at))}</div></td></tr>`
    )
    .join("");
  const appSection = d.app.events.length
    ? sectionTitle("Checked in the app", "texts, calls, payments") +
      box(`<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${appRows}</table>`)
    : d.app.linked
      ? sectionTitle("Checked in the app") +
        box(
          `<div style="padding:14px 18px;font-size:14px;color:${MUTED}">Nothing was checked in the app today. Got a strange text or call? Open ScamSense and tap <b>Check something</b>.</div>`
        )
      : "";

  const safeRows = safe
    .slice(0, 30)
    .map(
      (i, k) => `<tr><td style="padding:9px 0 9px 16px;${k ? `border-top:1px solid ${LINE};` : ""}font-size:14px;color:${INK}"><b>${esc(i.fromName || i.fromEmail)}</b>${i.trusted ? ` <span style="color:${COL.safe};font-size:12px">✓ verified</span>` : ""}<br><span style="color:${MUTED}">${esc(i.subject)}</span></td>
      <td style="padding:9px 16px 9px 8px;${k ? `border-top:1px solid ${LINE};` : ""}text-align:right;white-space:nowrap;vertical-align:top">${badge(i.source)}<div style="font-size:12px;color:${MUTED};margin-top:4px">${esc(i.folder)}</div></td></tr>`
    )
    .join("");

  const notes = [];
  if (d.outlook.error) notes.push(`Outlook couldn't be read: ${d.outlook.error}`);
  if (!d.outlook.connected)
    notes.push("Outlook isn't connected. In the ScamSense script, run connectOutlook to add it.");
  if (!d.app.linked)
    notes.push("Want your checked texts and calls here too? Link the app: run showAppLink in the ScamSense script.");

  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#EEF3F2;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK}">
<div style="display:none;max-height:0;overflow:hidden">${esc(h.head)} ${esc(coverage(d))}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#EEF3F2"><tr><td align="center" style="padding:18px 10px 28px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px">

  <tr><td style="background:#0B2A30;border-radius:18px 18px 0 0;padding:18px 22px">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
      <td style="font-size:20px;font-weight:800;color:#ffffff">🦉 ScamSense</td>
      <td align="right" style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9CC9C6">Daily Safety Report</td>
    </tr></table>
    <div style="font-size:14px;color:#CFE3E1;margin-top:4px">${esc(day)}</div>
  </td></tr>

  <tr><td style="background:#ffffff;border-radius:0 0 18px 18px;border-top:6px solid ${COL[h.tone]};padding:22px 22px 20px">
    <table role="presentation" cellspacing="0" cellpadding="0"><tr>
      <td valign="top" style="padding-right:14px"><div style="width:46px;height:46px;border-radius:46px;background:${TINT[h.tone]};color:${COL[h.tone]};font-size:26px;font-weight:800;line-height:46px;text-align:center">${h.icon}</div></td>
      <td valign="top"><div style="font-size:24px;line-height:1.2;font-weight:800;color:${INK}">${esc(h.head)}</div>
        <div style="font-size:15px;line-height:1.45;color:${INK};margin-top:6px">${esc(h.sub)}</div></td>
    </tr></table>
    <div style="font-size:14px;line-height:1.45;color:${MUTED};margin-top:14px">${esc(coverage(d))}${d.aiUsed ? " AI double-checked the risky ones." : ""}</div>
    ${safetyBar(d)}
  </td></tr>

  <tr><td style="padding:12px 0 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed">${tiles}</table></td></tr>

  <tr><td><table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    ${risky.length ? sectionTitle("Needs your attention", plural(risky.length, "email")) + risky.map(emailCard).join("") : ""}
    ${appSection}
    ${safe.length ? sectionTitle("Looked safe", plural(safe.length, "email")) + box(`<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${safeRows}</table>${safe.length > 30 ? `<div style="padding:4px 16px 12px;font-size:13px;color:${MUTED}">…and ${safe.length - 30} more.</div>` : ""}`) : ""}
    ${sectionTitle("Tip of the day")}
    ${box(`<div style="padding:16px 18px;font-size:16px;line-height:1.5;color:${INK}"><span style="color:${BRAND};font-weight:800">💡</span> ${esc(tipOfDay())}</div>`, `background:#E6F2F1;border-color:#CFE5E3`)}
    ${notes.length ? `<tr><td style="padding:4px 6px 0;font-size:13px;line-height:1.5;color:${MUTED}">${notes.map(esc).join("<br>")}</td></tr>` : ""}
  </table></td></tr>

  <tr><td align="center" style="padding:22px 0 0">
    <a href="${CONFIG.APP_URL}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:800;font-size:16px;padding:14px 28px;border-radius:12px">Open ScamSense</a>
  </td></tr>
  <tr><td align="center" style="padding:18px 16px 0;font-size:12px;line-height:1.55;color:${MUTED}">
    Made inside your own Google account. ScamSense never stores or sells your email, and the app never sends your messages here, only what kind they were.<br>
    To stop this report, open the ScamSense script and run <b>stopDailyReport</b>.
  </td></tr>

</table></td></tr></table></body></html>`;
}

/* ========================================================================
   8. SCAM RULES
   Each rule: words to look for, how many points they add, and the plain-English reason.
   Copied from the app (js/02-scam-rules.js). Keep both the same.
   ======================================================================== */

// The app has translations; the email report is in English.
const tr = en => en;

// The warning signs. Each one adds points when its words are found.
const RULES = [
  {
    re: /gift ?cards?|itunes card|google play card|steam card|apple card balance/i,
    pts: 5,
    why: "Asks for payment by gift card. Real companies, police, and the government never ask for gift cards.",
    type: "payment"
  },
  {
    re: /bitcoin|crypto(currency)?|\busdt\b|btc atm|bitcoin atm|wire transfer|western union|moneygram/i,
    pts: 4,
    why: "Mentions crypto or a wire transfer. Money sent this way is almost impossible to get back.",
    type: "payment"
  },
  {
    re: /\b(zelle|venmo|cash ?app)\b/i,
    pts: 1,
    why: "Mentions an instant payment app, which scammers like because payments can't be undone.",
    type: "payment"
  },
  {
    re: /verification code|one[- ]time (pass)?code|6[- ]digit code|security code|\bOTP\b|pin number/i,
    pts: 5,
    why: "Asks for a code. Never share a code sent to your phone, even with your bank.",
    type: "account"
  },
  {
    re: /(enter|confirm|verify|update|provide|send)( your)? (password|social security|ssn|account number|routing number|medicare number|card number|billing information|payment information)/i,
    pts: 5,
    why: "Asks you to give private information like a password, card, or Social Security number.",
    type: "account"
  },
  {
    re: /within 24 hours|within 48 hours|immediately|right away|act now|urgent|final notice|final warning|as soon as possible/i,
    pts: 2,
    why: "Uses pressure to rush you. Scammers want you to act before you think.",
    type: "pressure"
  },
  {
    re: /suspend|suspension|will be locked|has been locked|frozen|deactivat|closed permanently|late fee|unusual (sign[- ]in|activity)/i,
    pts: 2,
    why: "Threatens to lock or close something, or says there was unusual activity, to scare you.",
    type: "pressure"
  },
  {
    re: /\barrest|warrant|lawsuit|legal action|deport|\bjail\b|\bbail\b/i,
    pts: 3,
    why: "Mentions arrest, legal action, or bail. This is a common way to scare people into paying.",
    type: "threat"
  },
  {
    re: /don'?t tell|do not tell|keep (this|it) (a )?secret|between (us|you and me)/i,
    pts: 4,
    why: "Asks you to keep it secret. Scammers don't want family to stop you.",
    type: "family"
  },
  {
    re: /\bgrand(ma|pa|mother|father)\b|\bit'?s me\b|this is your (grand)?(son|daughter)|my new number/i,
    pts: 2,
    why: "Claims to be a family member, maybe from a new number. Call them on the number you already have.",
    type: "family"
  },
  {
    re: /you('ve| have)? won|\bwinner\b|lottery|sweepstakes|claim your (prize|reward)|unclaimed (funds|inheritance)/i,
    pts: 4,
    why: "Says you won something. You can't win a contest you didn't enter.",
    type: "prize"
  },
  {
    re: /refund department|call (us|our|this number|now)|call .{0,30}\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}|1-8(00|88|77|66|55|44|33)/i,
    pts: 2,
    why: "Gives you a phone number to call. Use the number on your card or the company's real website instead.",
    type: "callback"
  },
  {
    re: /anydesk|teamviewer|ultraviewer|remote access|screen ?share/i,
    pts: 5,
    why: "Asks you to install remote access software. That gives a stranger control of your device.",
    type: "tech"
  },
  {
    re: /unpaid toll|toll (balance|payment|violation)|package (could not|can'?t|cannot) be delivered|redelivery|customs fee|incomplete (address|shipping)/i,
    pts: 3,
    why: "Unpaid toll or missed delivery. These fake messages are very common right now.",
    type: "toll"
  },
  {
    re: /guaranteed (returns?|profits?)|daily (profits?|returns?|income)|\d+(\.\d+)?% (daily|per day|a day)|risk[- ]free invest/i,
    pts: 5,
    why: "Promises guaranteed or daily profits. Real investments never guarantee returns.",
    type: "crypto"
  },
  {
    re: /withdraw(al)?.{0,40}(fee|tax|deposit|unlock)|pay (a |the )?(tax|fee) to (withdraw|release|unlock)/i,
    pts: 6,
    why: "Asks you to pay a fee or tax before you can withdraw. That's how crypto investment scams take more money.",
    type: "crypto"
  },
  {
    re: /mining pool|liquidity mining|cloud mining|trading bot|arbitrage bot|\busdt\b|tether/i,
    pts: 2,
    why: "Talks about crypto mining, trading bots, or USDT, which are common in crypto investment scams.",
    type: "crypto"
  },
  {
    re: /(talk|chat|message|text|add me) (on|to|in) (whatsapp|telegram|signal|line)|(move|switch) to (whatsapp|telegram)/i,
    pts: 3,
    why: "Asks to move the chat to WhatsApp or Telegram, a common step in investment and romance scams.",
    type: "crypto"
  },
  {
    re: /wrong number/i,
    pts: 2,
    why: 'Starts as a "wrong number" message. Scammers use this to start friendly chats that later turn to investing.',
    type: "crypto"
  },
  {
    re: /auto[- ]?renew(al|ed)? .{0,40}\$\d|subscription (has been )?renewed|invoice #|charged \$\d|purchase of \$\d|did not (make|authorize) this/i,
    pts: 2,
    why: "Claims a charge or renewal you may not recognize, to get you to call or click.",
    type: "callback"
  }
];

// Names for each kind of scam.
const TYPES_EN = {
  payment: "payment scam",
  account: "account takeover scam",
  pressure: "pressure scam",
  threat: "fake police or government scam",
  family: "family emergency scam",
  prize: "fake prize scam",
  callback: "fake refund or support scam",
  tech: "tech support scam",
  toll: "fake toll or delivery scam",
  sender: "fake sender (impersonation)",
  link: "fake link (phishing)",
  crypto: "crypto investment scam"
};

const TYPES = TYPES_EN;

// Real website addresses for companies scammers often pretend to be.
const BRANDS = {
  amazon: ["amazon.com", "amazon.co.uk", "amazon.ca", "amazonses.com", "amazonaws.com"],
  paypal: ["paypal.com", "paypal.co.uk"],
  apple: ["apple.com", "icloud.com", "itunes.com", "me.com"],
  microsoft: [
    "microsoft.com",
    "outlook.com",
    "live.com",
    "office.com",
    "office365.com",
    "microsoftonline.com",
    "hotmail.com"
  ],
  netflix: ["netflix.com"],
  chase: ["chase.com", "jpmorgan.com", "jpmchase.com"],
  "wells fargo": ["wellsfargo.com"],
  "bank of america": ["bankofamerica.com", "bofa.com", "ealerts.bankofamerica.com"],
  usps: ["usps.com", "usps.gov"],
  fedex: ["fedex.com"],
  ups: ["ups.com"],
  irs: ["irs.gov", "treasury.gov"],
  "social security": ["ssa.gov"],
  medicare: ["medicare.gov", "cms.gov", "hhs.gov"],
  "geek squad": ["bestbuy.com", "geeksquad.com"],
  norton: ["norton.com", "nortonlifelock.com", "gen.digital"],
  mcafee: ["mcafee.com"],
  coinbase: ["coinbase.com"],
  venmo: ["venmo.com"],
  walmart: ["walmart.com"],
  costco: ["costco.com"],
  docusign: ["docusign.com", "docusign.net"],
  facebook: ["facebook.com", "facebookmail.com", "meta.com"],
  instagram: ["instagram.com", "mail.instagram.com"],
  google: ["google.com", "accounts.google.com", "youtube.com"],
  txtag: ["txtag.org"],
  "e-zpass": ["e-zpassny.com", "ezpassnj.com", "e-zpass.com"],
  pikepass: ["pikepass.com", "oktollpay.com"],
  "illinois tollway": ["getipass.com", "illinoistollway.com"],
  "i-pass": ["getipass.com", "illinoistollway.com"],
  sunpass: ["sunpass.com"],
  fastrak: ["bayareafastrak.org", "thetollroads.com"],
  ntta: ["ntta.org"],
  "peach pass": ["peachpass.com"],
  "nc quick pass": ["ncquickpass.com"],
  "good to go": ["mygoodtogo.com"],
  "e-zpass md": ["ezpassmd.com"],
  "e-zpass va": ["ezpassva.com"],
  "e-zpass pa": ["paturnpike.com"]
};

// Free personal email services (real companies don't send from these).
const FREE_MAIL =
  /^(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|aol|icloud|me|proton|protonmail|gmx|mail|zoho)\.(com|net|me|org)$/;

// Web address endings often used by scam sites.
const BAD_TLD =
  /\.(xyz|top|info|click|live|shop|online|site|icu|ru|cn|buzz|cyou|rest|sbs|cfd|monster|zip|mov)$/;

// Link shorteners that hide where a link really goes.
const SHORT = /^(bit\.ly|tinyurl\.com|t\.co|rb\.gy|is\.gd|cutt\.ly|ow\.ly|shorturl\.at|tiny\.cc|s\.id)$/;

// Attachment types often used to hide harmful files.
const RISKY_FILE = /\.(html?|shtml|zip|rar|7z|exe|scr|iso|img|js|vbs|bat|cmd|msi|lnk|svg)$/i;

const BNAME = {
  paypal: "PayPal",
  usps: "USPS",
  ups: "UPS",
  fedex: "FedEx",
  irs: "IRS",
  txtag: "TxTag",
  "e-zpass": "E-ZPass",
  mcafee: "McAfee",
  docusign: "DocuSign",
  pikepass: "PikePass"
};

/* ========================================================================
   9. SCAM CHECKER
   Adds up points: 8 or more = scam, 4 to 7 = suspicious, under 4 = safe.
   ======================================================================== */

function baseDomain(h) {
  h = (h || "").toLowerCase().replace(/^www\./, "");
  const p = h.split(".");
  if (p.length <= 2) return h;
  const two = p.slice(-2).join(".");
  if (/^(co|com|org|net|gov|ac)\.[a-z]{2}$/.test(two)) return p.slice(-3).join(".");
  return two;
}

function legitFor(brand, host) {
  host = (host || "").toLowerCase();
  return BRANDS[brand].some(d => host === d || host.endsWith("." + d));
}

function unleet(s) {
  return s
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/1/g, "l")
    .replace(/3/g, "e")
    .replace(/5/g, "s")
    .replace(/rn/g, "m")
    .replace(/vv/g, "w");
}

// Finds fake addresses like paypa1-security.com that copy a real brand.
function lookalikeBrand(host) {
  const label = unleet(host.replace(/\.[a-z.]+$/, "").replace(/[^a-z0-9.-]/g, ""));
  const flat = label.replace(/[^a-z]/g, "");
  for (const b of Object.keys(BRANDS)) {
    const key = b.replace(/[^a-z]/g, "");
    if (key.length < 4) continue;
    if (flat.includes(key) && !legitFor(b, host)) return b;
  }
  return null;
}

function cap(s) {
  return BNAME[s] || s.replace(/\b\w/g, c => c.toUpperCase());
}

// Looks for the warning-sign words in the email text.
function textSignals(t) {
  const reasons = [],
    types = {};
  let score = 0;
  RULES.forEach(r => {
    if (r.re.test(t)) {
      score += r.pts;
      reasons.push(tr(r.why, r.es));
      types[r.type] = (types[r.type] || 0) + r.pts;
    }
  });
  const urls =
    t.match(
      /\b(?:https?:\/\/|www\.)[^\s)<>"']+|\b[a-z0-9-]+\.(?:xyz|top|info|click|live|shop|online|site|icu|ru|cn|buzz|cyou|sbs|cfd)(?:\/[^\s]*)?/gi
    ) || [];
  return { score, reasons, types, urls };
}

// Checks each link: strange endings, shorteners, lookalike sites, hidden destinations.
function linkSignals(links, add) {
  const seen = new Set();
  links.forEach(l => {
    const host = l.host || hostOf(l.href);
    if (!host || seen.has(host)) return;
    seen.add(host);
    const lb = lookalikeBrand(host);
    if (BAD_TLD.test(host))
      add(
        4,
        tr(
          `A link goes to "${host}", an unusual web address real companies don't use.`,
          `Un enlace va a "${host}", una dirección rara que las empresas reales no usan.`
        ),
        "link"
      );
    else if (SHORT.test(host))
      add(
        3,
        tr(
          `A link is shortened ("${host}"), so you can't see where it really goes.`,
          `Un enlace está acortado ("${host}"), así que no se ve a dónde va.`
        ),
        "link"
      );
    else if (/^\d+\.\d+\.\d+\.\d+$/.test(host))
      add(
        4,
        tr(
          "A link is a string of numbers, not a real company website.",
          "Un enlace es una serie de números, no un sitio real."
        ),
        "link"
      );
    else if (lb)
      add(
        5,
        tr(
          `A link goes to "${host}". It looks like ${cap(lb)}, but it isn't ${cap(lb)}'s real website.`,
          `Un enlace va a "${host}". Parece ${cap(lb)}, pero no es su sitio real.`
        ),
        "link"
      );
    // link text shows one website but actually goes to another
    const shown = (l.text || "").match(/^(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:\/|$)/i);
    if (shown && baseDomain(shown[1]) !== baseDomain(host))
      add(
        4,
        tr(
          `A link says "${shown[1]}" but really goes to "${host}".`,
          `Un enlace dice "${shown[1]}" pero en realidad va a "${host}".`
        ),
        "link"
      );
  });
}

// THE MAIN CHECK: scores one email and returns { level, kind, reasons }.
function analyze(msg) {
  const text = [msg.subject || "", msg.text || ""].join("\n");
  const base = textSignals(text);
  let score = base.score;
  const reasons = base.reasons.slice();
  const types = Object.assign({}, base.types);
  const add = (p, w, t) => {
    score += p;
    reasons.push(w);
    types[t] = (types[t] || 0) + p;
  };
  const links = (msg.links || []).slice();
  base.urls.forEach(u => links.push({ href: u, host: hostOf(u), text: "" }));
  linkSignals(links, add);

  let trusted = false;
  if (msg.fromEmail) {
    const dom = (msg.fromEmail.split("@")[1] || "").toLowerCase();
    const name = (msg.fromName || "").toLowerCase();
    const auth = (msg.auth || "").toLowerCase();
    for (const b of Object.keys(BRANDS)) {
      const re = new RegExp("\\b" + b.replace(/[-]/g, "[- ]?") + "\\b", "i");
      if (re.test(name) && !legitFor(b, dom)) {
        add(
          5,
          FREE_MAIL.test(dom)
            ? tr(
                `Says it's from ${cap(b)}, but it was sent from a personal ${dom} address.`,
                `Dice ser de ${cap(b)}, pero se envió desde una cuenta personal de ${dom}.`
              )
            : tr(
                `Says it's from ${cap(b)}, but it was sent from "${dom}", which is not ${cap(b)}.`,
                `Dice ser de ${cap(b)}, pero se envió desde "${dom}", que no es ${cap(b)}.`
              ),
          "sender"
        );
        break;
      }
    }
    if (typeof isDisposable === "function" && isDisposable(dom))
      add(
        6,
        tr(
          `Sent from a temporary (throwaway) email service, ${dom}. Anyone can make one in seconds. Real companies never use these.`,
          `Enviado desde un servicio de correo temporal, ${dom}. Cualquiera lo crea en segundos. Las empresas reales nunca lo usan.`
        ),
        "sender"
      );
    const lb = lookalikeBrand(dom);
    if (lb && !FREE_MAIL.test(dom))
      add(
        5,
        tr(
          `The sender's address "${dom}" looks like ${cap(lb)}, but it's a fake copy.`,
          `La dirección "${dom}" parece de ${cap(lb)}, pero es una copia falsa.`
        ),
        "sender"
      );
    if (/dmarc=fail/.test(auth))
      add(
        4,
        tr(
          "The email failed Gmail's sender check (DMARC). The sender's name may be faked.",
          "El correo no pasó la verificación de remitente de Gmail (DMARC). El nombre puede ser falso."
        ),
        "sender"
      );
    else if (/spf=(fail|softfail)/.test(auth) && /dkim=(fail|none)/.test(auth))
      add(
        3,
        tr(
          "The email failed Gmail's sender checks, so the sender may be faked.",
          "El correo no pasó las verificaciones de Gmail; el remitente puede ser falso."
        ),
        "sender"
      );
    if (msg.replyTo) {
      const rd = (msg.replyTo.split("@")[1] || "").toLowerCase().replace(/>.*$/, "");
      if (rd && baseDomain(rd) !== baseDomain(dom))
        add(
          2,
          tr(
            `Replies would go to a different address (${rd}) than the sender.`,
            `Las respuestas irían a otra dirección (${rd}), no al remitente.`
          ),
          "sender"
        );
    }
    const legitBrand = Object.keys(BRANDS).some(b => legitFor(b, dom));
    if (legitBrand && /dmarc=pass|dkim=pass/.test(auth)) trusted = true;
    if (trusted) score = Math.max(0, score - 5);
    else if (msg.listUnsub && /dmarc=pass/.test(auth) && score < 8) score = Math.max(0, score - 2);
  }
  (msg.attachments || []).forEach(f => {
    if (RISKY_FILE.test(f))
      add(
        4,
        tr(
          `Has an attachment "${f}" of a type often used to hide harmful files.`,
          `Tiene un archivo adjunto "${f}" de un tipo usado para esconder virus.`
        ),
        "tech"
      );
  });

  const ranked = Object.entries(types)
    .filter(([k]) => k !== "pressure")
    .sort((a, b) => b[1] - a[1]);
  let kind = ranked.length ? TYPES[ranked[0][0]] : types.pressure ? TYPES.pressure : "";
  if (types.family && types.payment) kind = TYPES.family;
  if (types.toll) kind = TYPES.toll;
  let kindKey = ranked.length ? ranked[0][0] : types.pressure ? "pressure" : "";
  if (types.family && types.payment) kindKey = "family";
  if (types.toll) kindKey = "toll";
  const level = score >= 8 ? "scam" : score >= 4 ? "warn" : "safe";
  return { score, reasons: [...new Set(reasons)], kind, kindKey, level, trusted };
}

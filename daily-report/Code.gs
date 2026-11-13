/* ========================================================================
   ScamSense · Daily Email Report and Automatic Blocking
   (Google Apps Script. Runs inside your own Google account.)

   WHAT IT DOES
   - Every morning: emails you a report of every email from the last day,
     explaining each scam and what to do.
   - Every 15 minutes: moves clear scams to Spam and sends you a short
     note saying what was blocked and why.

   HOW TO USE
   - First time: choose "setup" in the menu above and click Run.
   - Test now: run "sendReportNow".  Stop: "stopDailyReport" / "stopBlocking".

   PARTS OF THIS FILE
     1. Settings              you can change these
     2. Start and stop        setup, sendReportNow, stopDailyReport, stopBlocking
     3. Daily report          checks the last day's email and sends the report
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
  DAYS: 1, // how many days of email to check
  MAX_EMAILS: 150, // safety limit per report
  APP_URL: "https://karimhaidari2.github.io/ScamSense_App/",
  AI_MODEL: "claude-haiku-5-5",
  BLOCK_SCAMS: true, // move scam emails to Spam automatically
  BLOCK_EVERY_MIN: 15, // how often to check for new scams (5, 10, 15 or 30)
  BLOCK_LABEL: "ScamSense/Blocked"
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
   Checks every folder for the last day and emails you the report.
   ======================================================================== */

// Reads the last day's email, checks each one, and emails you the report.
function sendDailyReport() {
  const me = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();
  const threads = GmailApp.search(
    `in:anywhere newer_than:${CONFIG.DAYS}d -in:sent -in:drafts -in:chats`,
    0,
    CONFIG.MAX_EMAILS
  );
  const since = new Date(Date.now() - CONFIG.DAYS * 86400000);
  const items = [];
  threads.forEach(th => {
    const folder = th.isInSpam() ? "Spam" : th.isInTrash() ? "Trash" : th.isInInbox() ? "Inbox" : "Archived";
    th.getMessages().forEach(m => {
      if (m.getDate() < since) return;
      if (m.isDraft()) return;
      const from = parseFrom(m.getFrom());
      if (me && from.email.toLowerCase() === me.toLowerCase()) return;
      const msg = toMsg(m, from);
      const r = analyze(msg);
      const wasBlocked = th.getLabels().some(l => l.getName() === CONFIG.BLOCK_LABEL);
      items.push({
        id: m.getId(),
        threadId: th.getId(),
        date: m.getDate(),
        folder,
        blocked: wasBlocked,
        subject: msg.subject,
        fromName: from.name,
        fromEmail: from.email,
        level: r.level,
        kind: r.kind,
        reasons: r.reasons,
        trusted: r.trusted,
        msg
      });
    });
  });

  const order = { scam: 0, warn: 1, safe: 2 };
  items.sort((a, b) => order[a.level] - order[b.level] || b.date - a.date);
  const risky = items.filter(i => i.level !== "safe");

  // Optional AI: explain the risky ones in plain words
  const key = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
  let aiUsed = false;
  if (key && risky.length) {
    risky.slice(0, 10).forEach(it => {
      try {
        const a = aiExplain(key, it);
        if (a) {
          it.ai = a;
          aiUsed = true;
          if (a.verdict === "scam") it.level = "scam";
        }
      } catch (e) {
        /* keep on-device result */
      }
    });
  }

  const n = { scam: 0, warn: 0, safe: 0 };
  items.forEach(i => n[i.level]++);
  const subject = n.scam
    ? `ScamSense: ${n.scam} scam${n.scam > 1 ? "s" : ""} caught today — don't open ${n.scam > 1 ? "them" : "it"}`
    : n.warn
      ? `ScamSense: ${n.warn} email${n.warn > 1 ? "s" : ""} need a careful look`
      : `ScamSense: all clear today (${items.length} emails checked)`;
  GmailApp.sendEmail(me, subject, plainReport(items, n), {
    htmlBody: htmlReport(items, n, aiUsed),
    name: "ScamSense Daily Report"
  });
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
    subject: m.getSubject() || "",
    text: (m.getPlainBody() || "").slice(0, 6000),
    fromName: from.name,
    fromEmail: from.email,
    replyTo: (m.getReplyTo() || "").replace(/^.*</, "").replace(/>.*$/, ""),
    auth: safeHeader(m, "Authentication-Results") + " " + safeHeader(m, "ARC-Authentication-Results"),
    listUnsub: !!safeHeader(m, "List-Unsubscribe"),
    links: linksFromHtml(html),
    attachments: m.getAttachments({ includeInlineImages: false }).map(a => a.getName())
  };
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

// Asks Anthropic's AI to explain one risky email in plain words.
function aiExplain(key, it) {
  const sys =
    'You are ScamSense, protecting older adults from scams. Judge the email. Reply with ONLY JSON: {"verdict":"safe"|"suspicious"|"scam","explanation":"2 short, plain sentences a 75-year-old can follow","what_to_do":["2-3 short steps"]}';
  const user = [
    `From: ${it.fromName} <${it.fromEmail}>`,
    `Subject: ${it.subject}`,
    `Link destinations: ${[...new Set(it.msg.links.map(l => l.host))].slice(0, 10).join(", ") || "none"}`,
    `Warning signs found: ${it.reasons.join(" | ") || "none"}`,
    `Email text:\n${it.msg.text.slice(0, 3000)}`
  ].join("\n");
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

// What to do, by level.
const ADVICE = {
  scam: [
    "Don't click links, open attachments, call numbers, or reply.",
    "Don't send money, gift cards, or codes.",
    "If you're worried, contact the company yourself using a number you already trust.",
    'Report it: in Gmail tap ⋮ then "Report phishing", or at ReportFraud.ftc.gov.'
  ],
  warn: [
    "Slow down. Don't click links or call numbers in it yet.",
    "Check it yourself: open the company's app or call the number on your card.",
    "Ask a family member or helper to take a look."
  ]
};

// Picks the clearest reason to show first.
function bestWhy(i) {
  if (i.ai && i.ai.explanation) return i.ai.explanation;
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
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "EEE MMM d, h:mm a");
}

// Plain-text version of the report (for email apps that don't show HTML).
function plainReport(items, n) {
  const lines = [
    `ScamSense Daily Safety Report — ${fmt(new Date())}`,
    `Checked ${items.length} emails from the last ${CONFIG.DAYS === 1 ? "24 hours" : CONFIG.DAYS + " days"} in every folder.`,
    `Scams: ${n.scam} · Suspicious: ${n.warn} · Safe: ${n.safe}`,
    ""
  ];
  items
    .filter(i => i.level !== "safe")
    .forEach(i => {
      lines.push(
        `${i.level === "scam" ? "SCAM" : "SUSPICIOUS"}: ${i.fromName || i.fromEmail} — ${i.subject} (${i.folder})`
      );
      lines.push("  " + bestWhy(i));
    });
  lines.push("", `Open ScamSense: ${CONFIG.APP_URL}`);
  return lines.join("\n");
}

// The designed report email.
function htmlReport(items, n, aiUsed) {
  const C = { scam: "#B42318", warn: "#9A5B00", safe: "#1F7A3E" },
    BG = { scam: "#FDE7E4", warn: "#FFF2DC", safe: "#E4F4E9" };
  const lv = n.scam ? "scam" : n.warn ? "warn" : "safe";
  const head = n.scam
    ? `${n.scam} scam${n.scam > 1 ? "s" : ""} caught. Don't open ${n.scam > 1 ? "them" : "it"}.`
    : n.warn
      ? `${n.warn} email${n.warn > 1 ? "s" : ""} need a careful look.`
      : "All clear. No scams found.";
  const pill = (l, t) =>
    `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${BG[l]};color:${C[l]};font-weight:700;font-size:13px;margin-right:6px">${t}</span>`;
  const folders = {};
  items.forEach(i => (folders[i.folder] = (folders[i.folder] || 0) + 1));
  const fsum = Object.keys(folders)
    .map(k => `${k} ${folders[k]}`)
    .join(", ");
  const card = i => {
    const why = bestWhy(i);
    const signs = i.reasons
      .filter(r => r !== why)
      .slice(0, 3)
      .map(r => `<li style="margin:2px 0">${esc(r)}</li>`)
      .join("");
    const todo = ((i.ai && i.ai.what_to_do) || ADVICE[i.level])
      .slice(0, 3)
      .map(t => `<li style="margin:2px 0">${esc(t)}</li>`)
      .join("");
    return `<div style="border:1px solid #DDE5E3;border-left:5px solid ${C[i.level]};border-radius:12px;padding:14px 16px;margin:0 0 12px;background:#fff">
      <div>${pill(i.level, i.level === "scam" ? "SCAM" : "SUSPICIOUS")}<span style="color:#5B6B6E;font-size:13px">${i.blocked ? '<b style="color:#B42318">Blocked → Spam</b>' : esc(i.folder)} · ${esc(fmt(i.date))}</span></div>
      <div style="font-weight:700;font-size:16px;margin-top:8px">${esc(i.fromName || i.fromEmail)}</div>
      <div style="color:#5B6B6E;font-size:13px">${esc(i.fromEmail)}</div>
      <div style="font-size:15px;margin-top:4px">${esc(i.subject)}</div>
      ${i.kind ? `<div style="color:${C[i.level]};font-weight:700;font-size:14px;margin-top:8px">Looks like: ${esc(i.kind)}</div>` : ""}
      <p style="margin:8px 0 0;font-size:15px;line-height:1.45">${esc(why)}</p>
      ${signs ? `<div style="font-size:13px;font-weight:700;color:#5B6B6E;margin-top:10px;text-transform:uppercase;letter-spacing:.05em">Warning signs</div><ul style="margin:4px 0 0 18px;padding:0;font-size:14px">${signs}</ul>` : ""}
      <div style="font-size:13px;font-weight:700;color:#5B6B6E;margin-top:10px;text-transform:uppercase;letter-spacing:.05em">What to do</div><ol style="margin:4px 0 0 18px;padding:0;font-size:14px">${todo}</ol>
      <a href="https://mail.google.com/mail/u/0/#all/${i.threadId}" style="display:inline-block;margin-top:10px;color:#0E7C7B;font-weight:700;font-size:14px">View in Gmail (don't click links inside)</a></div>`;
  };
  const risky = items.filter(i => i.level !== "safe"),
    safe = items.filter(i => i.level === "safe");
  const safeList = safe
    .slice(0, 40)
    .map(
      i =>
        `<tr><td style="padding:6px 0;border-top:1px solid #EEF2F1;font-size:14px"><b>${esc(i.fromName || i.fromEmail)}</b><br><span style="color:#5B6B6E">${esc(i.subject)}</span></td><td style="padding:6px 0 6px 10px;border-top:1px solid #EEF2F1;font-size:12px;color:#5B6B6E;white-space:nowrap;text-align:right">${esc(i.folder)}${i.trusted ? "<br>✓ verified sender" : ""}</td></tr>`
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#F3F6F5;font-family:Arial,Helvetica,sans-serif;color:#0E3B43">
  <div style="max-width:620px;margin:0 auto;padding:20px 14px">
    <div style="font-size:20px;font-weight:800;margin:0 0 12px">🦉 ScamSense</div>
    <div style="background:#fff;border-radius:16px;border-top:6px solid ${C[lv]};padding:18px 18px 16px">
      <div style="font-size:12px;font-weight:700;letter-spacing:.07em;color:#5B6B6E;text-transform:uppercase">Daily Safety Report · ${esc(fmt(new Date()))}</div>
      <div style="font-size:24px;font-weight:800;line-height:1.2;margin:8px 0 12px">${head}</div>
      <div>${pill("scam", `${n.scam} Scam`)}${pill("warn", `${n.warn} Suspicious`)}${pill("safe", `${n.safe} Safe`)}</div>
      ${items.filter(i => i.blocked).length ? `<p style="font-size:15px;margin:12px 0 0">🛡️ <b>ScamSense blocked ${items.filter(i => i.blocked).length}</b> of them and moved them to Spam.</p>` : ""}
      <p style="color:#5B6B6E;font-size:14px;margin:12px 0 0">Checked ${items.length} emails from the last ${CONFIG.DAYS === 1 ? "24 hours" : CONFIG.DAYS + " days"} across all folders${fsum ? ` (${esc(fsum)})` : ""}. ${aiUsed ? "AI double-checked the risky ones." : "Checked with ScamSense's built-in rules."}</p>
    </div>
    ${risky.length ? `<h2 style="font-size:13px;letter-spacing:.07em;text-transform:uppercase;color:#5B6B6E;margin:22px 4px 10px">Needs your attention</h2>${risky.map(card).join("")}` : ""}
    ${safe.length ? `<h2 style="font-size:13px;letter-spacing:.07em;text-transform:uppercase;color:#5B6B6E;margin:22px 4px 10px">Looked safe (${safe.length})</h2><div style="background:#fff;border-radius:12px;padding:6px 16px"><table style="width:100%;border-collapse:collapse">${safeList}</table>${safe.length > 40 ? `<p style="font-size:13px;color:#5B6B6E">…and ${safe.length - 40} more.</p>` : ""}</div>` : ""}
    <div style="background:#E6F2F1;border-radius:12px;padding:14px 16px;margin-top:18px;font-size:14px;line-height:1.45">
      <b>Remember:</b> real companies never ask for gift cards, crypto, or codes. If in doubt, call them back using the number on your card.</div>
    <p style="text-align:center;margin:18px 0 0"><a href="${CONFIG.APP_URL}" style="display:inline-block;background:#0E7C7B;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:12px">Open ScamSense</a></p>
    <p style="color:#5B6B6E;font-size:12px;text-align:center;margin:16px 0 0">This report was made inside your own Google account. ScamSense never stores or sells your email.<br>To stop it, open the ScamSense script and run <b>stopDailyReport</b>.</p>
  </div></body></html>`;
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

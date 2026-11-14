/* ========================================================================
   ScamSense · Server (Mahi + users + reports + alerts)
   Google Apps Script web app, running in the owner's Google account.

   WHAT IT DOES
   - Mahi: answers ANY question with AI, with the AI key hidden here.
   - Smart checks: tells the app if a message is a scam.
   - Users: keeps a list of who uses ScamSense (name, email) in a private
     Google Sheet, the "ScamSense Owner Dashboard", with their activity.
   - Daily reports: emails every user a report each morning.
   - Danger alerts: when someone says they were scammed or already paid,
     emails the owner and the trusted people they added right away.
   - "Email me": Mahi can email a draft or summary to the person's own inbox.

   SET UP (once) — see README.md in this folder
   1. Project Settings > Script Properties: ANTHROPIC_API_KEY = your sk-ant- key
   2. Run setupServer (makes the dashboard Sheet and the 8 AM report timer)
   3. Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone
   4. Copy the Web app URL into ScamSense > Settings > Advanced > Mahi server

   PARTS OF THIS FILE
     1. Settings      daily limit, model, answer length
     2. Web app       doGet (health check) and doPost (answer a chat)
     3. Safety        checks the request and counts today's answers
     4. AI call       asks Anthropic's AI (with web search)
     5. Mahi's rules  how Mahi talks
     6. Users         the owner dashboard, sign-up, activity
     7. Alerts        danger emails to the owner and family
     8. Reports       the daily email to every user, and "email me"
   ======================================================================== */

/* ========================================================================
   1. SETTINGS
   ======================================================================== */

const MAHI = {
  MODEL: "claude-haiku-5-5",
  MAX_TOKENS: 900, // length of each answer
  MAX_PER_DAY: 300, // answers per day for everyone together (protects your bill)
  MAX_MESSAGES: 12, // how much of the chat is sent each time (tool steps count double)
  MAX_CHARS: 2500, // longest single message accepted
  WEB_SEARCHES: 2 // web searches Mahi may run per answer (about $0.01 each)
};

/* ========================================================================
   2. WEB APP
   ======================================================================== */

// Open the web app URL in a browser to check it's working.
function doGet() {
  return json({ ok: true, name: "Mahi", answersToday: countToday() });
}

// The app sends { messages, lang, tools? } and gets back { text, content, stop_reason }.
// "tools" lets Mahi take actions in the app (check a number, build a report...). The app runs them.
function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (req.mode === "check") return json(checkMessage(req));
    if (req.mode === "register") return json(registerUser(req));
    if (req.mode === "events") return json(saveEvents(req));
    if (req.mode === "email_me") return json(emailMe(req));
    const messages = cleanMessages(req.messages);
    if (!messages.length) return json({ error: "No question received." });
    if (!takeOne()) return json({ error: "Mahi has answered a lot today. Please try again tomorrow." });
    const key = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
    if (!key) return json({ error: "The Mahi server has no AI key yet." });
    const lang = String(req.lang || "English").slice(0, 40);
    const tools = cleanTools(req.tools);
    const extra = typeof req.system_extra === "string" ? " " + req.system_extra.slice(0, 1200) : "";
    const r = askWithSearch(key, mahiRules(lang) + extra, messages, tools);
    const text = r.content
      .filter(c => c.type === "text")
      .map(c => c.text)
      .join("\n")
      .trim();
    return json({ text, content: r.content, stop_reason: r.stop_reason });
  } catch (err) {
    return json({ error: "Mahi couldn't answer right now. Please try again." });
  }
}

// "Check something": the app sends the message details and gets back a scam verdict (JSON text).
// Used so the app can get the smart AI check without keeping any key on the device.
function checkMessage(req) {
  const details = String(req.check || "").slice(0, 6000).trim();
  if (!details) return { error: "Nothing to check." };
  if (!takeOne()) return { error: "ScamSense has checked a lot today. Please try again tomorrow." };
  const key = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
  if (!key) return { error: "The Mahi server has no AI key yet." };
  const lang = String(req.lang || "English").slice(0, 40);
  const r = askAI(key, CHECK_RULES.replace("{LANG}", lang), [{ role: "user", content: details }]);
  const text = (r.content || [])
    .filter(c => c.type === "text")
    .map(c => c.text)
    .join("")
    .trim();
  return { text };
}
const CHECK_RULES = `You are ScamSense, a scam detector that protects people, especially older adults, from scams in email, text messages, and phone calls.
Judge the message you are given. Consider who really sent it, what it asks the reader to do (click, call, pay, share a code, install software, keep a secret), pressure or threats, payment methods (gift cards, crypto, wire, Zelle), lookalike websites, and whether the story makes sense.
Unpaid toll, package fee, or redelivery texts that link to a website that is not the real company's own website are SCAM.
Normal newsletters, receipts, account notices and payment reminders from real companies (sent from their official domain, with passing sender checks, pointing to their own website) are SAFE. Do not call something a scam just because it is marketing.
Reply with ONLY a JSON object, no other text:
{"verdict":"safe"|"suspicious"|"scam","scam_type":"short name or empty","confidence":0-100,"explanation":"2 short sentences in plain, friendly language a 75-year-old can follow","red_flags":["up to 4 short items"],"what_to_do":["2-4 short steps"]}
Keep the JSON keys and the verdict word in English, but write scam_type, explanation, red_flags and what_to_do in {LANG}.`;

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ========================================================================
   3. SAFETY
   ======================================================================== */

// Keeps only real chat turns (text, or tool steps), trims long ones, starts with the person.
function cleanMessages(list) {
  if (!Array.isArray(list)) return [];
  const okBlock = b =>
    b &&
    ["text", "tool_use", "tool_result"].includes(b.type) &&
    JSON.stringify(b).length <= MAHI.MAX_CHARS * 3;
  let out = list
    .filter(m => m && (m.role === "user" || m.role === "assistant"))
    .map(m =>
      typeof m.content === "string"
        ? { role: m.role, content: m.content.slice(0, MAHI.MAX_CHARS) }
        : Array.isArray(m.content)
          ? { role: m.role, content: m.content.filter(okBlock) }
          : null
    )
    .filter(m => m && (typeof m.content === "string" ? m.content : m.content.length))
    .slice(-MAHI.MAX_MESSAGES * 2);
  while (out.length && (out[0].role !== "user" || typeof out[0].content !== "string")) out.shift();
  return out;
}

// Accepts the app's list of actions (tools), with a size limit.
function cleanTools(list) {
  if (!Array.isArray(list) || !list.length) return undefined;
  const t = list.slice(0, 20).filter(x => x && typeof x.name === "string" && x.input_schema);
  return JSON.stringify(t).length <= 20000 ? t : undefined;
}

// Counts answers per day. Returns false when today's limit is reached.
function takeOne() {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const p = PropertiesService.getScriptProperties();
    const k = "COUNT_" + Utilities.formatDate(new Date(), "UTC", "yyyyMMdd");
    const n = Number(p.getProperty(k) || 0);
    if (n >= MAHI.MAX_PER_DAY) return false;
    p.setProperty(k, String(n + 1));
    return true;
  } finally {
    lock.releaseLock();
  }
}
function countToday() {
  const k = "COUNT_" + Utilities.formatDate(new Date(), "UTC", "yyyyMMdd");
  return Number(PropertiesService.getScriptProperties().getProperty(k) || 0);
}

/* ========================================================================
   4. AI CALL
   ======================================================================== */

function askAI(key, system, messages, tools) {
  const res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    payload: JSON.stringify(
      Object.assign(
        { model: MAHI.MODEL, max_tokens: MAHI.MAX_TOKENS, system, messages },
        tools ? { tools } : {}
      )
    )
  });
  if (res.getResponseCode() !== 200) throw new Error("AI error " + res.getResponseCode());
  return JSON.parse(res.getContentText());
}

// Asks the AI with web search turned on, finishes long searches (pause_turn), and returns a
// simple answer: text and app actions only, with the web sources listed at the end.
function askWithSearch(key, system, messages, tools) {
  const all = (tools || []).concat([
    { type: "web_search_20250305", name: "web_search", max_uses: MAHI.WEB_SEARCHES, user_location: { type: "approximate", country: "US" } }
  ]);
  let convo = messages.slice(),
    blocks = [],
    r;
  for (let i = 0; i < 3; i++) {
    r = askAI(key, system, convo, all);
    blocks = blocks.concat(r.content || []);
    if (r.stop_reason !== "pause_turn") break;
    convo = convo.concat([{ role: "assistant", content: r.content }]);
  }
  return { content: simplify(blocks, r.stop_reason), stop_reason: r.stop_reason === "pause_turn" ? "end_turn" : r.stop_reason };
}
// Joins the answer's text pieces, keeps app actions (tool_use), drops raw search data,
// and adds "Sources" with the web pages the answer used.
function simplify(blocks, stop) {
  const out = [],
    sources = [];
  blocks.forEach(b => {
    if (b.type === "text") {
      (b.citations || []).forEach(c => {
        if (c.url && !sources.some(s => s.url === c.url)) sources.push({ url: c.url, title: c.title || c.url });
      });
      const last = out[out.length - 1];
      if (last && last.type === "text") last.text += b.text;
      else out.push({ type: "text", text: b.text });
    } else if (b.type === "tool_use") out.push({ type: "tool_use", id: b.id, name: b.name, input: b.input });
  });
  if (sources.length && stop !== "tool_use") {
    const list = sources.slice(0, 4).map(s => "• " + s.title + " — " + s.url).join("\n");
    const last = out.filter(b => b.type === "text").pop();
    if (last) last.text = last.text.trim() + "\n\nSources:\n" + list;
  }
  return out;
}

/* ========================================================================
   5. MAHI'S RULES
   ======================================================================== */

function mahiRules(lang) {
  return `You are Mahi, the friendly assistant inside ScamSense, an app that protects people (especially older adults) from scams.
Answer ANY question the person asks, helpfully and honestly, not only scam questions. Your specialty is staying safe from scams, fraud, and identity theft.
Answer in ${lang}. Use short, plain sentences a 75-year-old can follow. Keep answers under 8 short lines unless they ask for more.
Never ask for passwords, codes, card numbers, or Social Security numbers, and remind people never to share them.
If they may have lost money or shared private details: tell them to call their bank right away and to use the "I was scammed" button on the Home screen.
If they want a real person: suggest a trusted family member, the AARP Fraud Watch Network Helpline 877-908-3360, or (age 60+) the National Elder Fraud Hotline 1-833-372-8311.
You can search the web. Use it for anything current or that you don't know for sure: news, recent scams, scam alerts, statistics, prices, laws, company or agency phone numbers, and whether a website or business is real. Say briefly what you found; the app lists your sources.
If someone is in danger, tell them to call 911. If you're not sure, say so.`;
}

/* ========================================================================
   6. USERS — the owner dashboard (a private Google Sheet in your account)
   ======================================================================== */

const OWNER = {
  DASHBOARD: "ScamSense Owner Dashboard",
  REPORT_HOUR: 8, // daily reports go out around this hour (the script's time zone)
  APP_URL: "https://karimhaidari2.github.io/ScamSense_App/",
  MAX_EMAILS_PER_USER: 10, // "email me" emails per person per day
  MAX_ALERTS_PER_USER: 3 // danger alerts per person per day
};
const USER_COLS = [
  "User ID",
  "Name",
  "Email",
  "Email verified",
  "Language",
  "Daily report",
  "Danger alerts",
  "Trusted people",
  "First seen",
  "Last active",
  "Emails scanned",
  "Scams caught",
  "Checks",
  "Alerts",
  "Devices"
];
const ACT_COLS = ["Time", "User ID", "Name", "What", "Channel", "Result", "Scam type", "Details"];
const ALERT_COLS = ["Time", "Name", "Email", "What happened", "Emailed to"];

// Run ONCE: makes the dashboard Sheet and the daily report timer, and prints the Sheet's link.
function setupServer() {
  const db = getDb();
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "sendAllReports") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("sendAllReports").timeBased().everyDays(1).atHour(OWNER.REPORT_HOUR).create();
  console.log("Owner dashboard: " + db.getUrl());
}

function getDb() {
  const p = PropertiesService.getScriptProperties();
  let id = p.getProperty("DB_ID");
  if (id) {
    try {
      const ss = SpreadsheetApp.openById(id);
      const users = ss.getSheetByName("Users");
      // Newer columns added after the Sheet was made
      if (users && users.getRange(1, USER_COLS.length).getValue() !== USER_COLS[USER_COLS.length - 1])
        users
          .getRange(1, 1, 1, USER_COLS.length)
          .setValues([USER_COLS])
          .setFontWeight("bold")
          .setBackground("#14213D")
          .setFontColor("#FFFFFF");
      return ss;
    } catch (e) {}
  }
  const ss = SpreadsheetApp.create(OWNER.DASHBOARD);
  const first = ss.getSheets()[0].setName("Users");
  [
    [first, USER_COLS],
    [ss.insertSheet("Activity"), ACT_COLS],
    [ss.insertSheet("Alerts"), ALERT_COLS]
  ].forEach(([sh, cols]) => {
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight("bold").setBackground("#14213D").setFontColor("#FFFFFF");
    sh.setFrozenRows(1);
  });
  p.setProperty("DB_ID", ss.getId());
  return ss;
}
const sheet = name => getDb().getSheetByName(name);

// Finds a person by this device's ID (their first device in column A, other devices in "Devices").
function findUser(uid) {
  const sh = sheet("Users");
  let hit = sh.getRange("A:A").createTextFinder(uid).matchEntireCell(true).findNext();
  if (!hit) {
    const col = USER_COLS.indexOf("Devices") + 1;
    hit = sh.getRange(1, col, Math.max(1, sh.getLastRow()), 1).createTextFinder(uid).findNext();
  }
  if (!hit) return null;
  return userAt(hit.getRow());
}
function findUserByEmail(email) {
  if (!email) return null;
  const sh = sheet("Users");
  const hit = sh.getRange("C:C").createTextFinder(email).matchEntireCell(true).findNext();
  return hit && hit.getRow() > 1 ? userAt(hit.getRow()) : null;
}
function userAt(row) {
  const sh = sheet("Users");
  const v = sh.getRange(row, 1, 1, USER_COLS.length).getValues()[0];
  const u = {};
  USER_COLS.forEach((c, i) => (u[c] = v[i]));
  u.row = row;
  return u;
}
function writeUser(u) {
  const sh = sheet("Users");
  const vals = [USER_COLS.map(c => (u[c] === undefined ? "" : u[c]))];
  if (u.row) sh.getRange(u.row, 1, 1, USER_COLS.length).setValues(vals);
  else sh.appendRow(vals[0]);
}
const okUid = id => /^[A-Za-z0-9_-]{16,40}$/.test(String(id || ""));
const cleanText = (s, n) =>
  String(s || "")
    .replace(/[\u0000-\u001f<>]/g, " ")
    .trim()
    .slice(0, n);

// Asks Google or Microsoft whose email this is, using the sign-in the app already has (used once, never saved).
function verifiedEmail(req) {
  try {
    if (req.gtoken) {
      const r = UrlFetchApp.fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
        headers: { Authorization: "Bearer " + req.gtoken },
        muteHttpExceptions: true
      });
      if (r.getResponseCode() === 200) return String(JSON.parse(r.getContentText()).emailAddress || "").toLowerCase();
    }
    if (req.mstoken) {
      const r = UrlFetchApp.fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
        headers: { Authorization: "Bearer " + req.mstoken },
        muteHttpExceptions: true
      });
      if (r.getResponseCode() === 200) {
        const j = JSON.parse(r.getContentText());
        return String(j.mail || j.userPrincipalName || "").toLowerCase();
      }
    }
  } catch (e) {}
  return "";
}

// The app signs a person up (or updates them). Their email is only trusted when Google or Microsoft confirm it.
function registerUser(req) {
  if (!okUid(req.uid)) return { error: "bad id" };
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const now = new Date();
    let u = findUser(req.uid);
    const ve = verifiedEmail(req);
    // Same person on another device: use their existing row and remember this device too.
    const same = ve && findUserByEmail(ve);
    if (same && (!u || same.row !== u.row)) {
      if (u && u.row) {
        sheet("Users").deleteRow(u.row); // the extra row this device made earlier
        if (u.row < same.row) same.row--;
      }
      const devs = String(same.Devices || "").split(/\s+/).filter(Boolean);
      if (same["User ID"] !== req.uid && devs.indexOf(req.uid) < 0) devs.push(req.uid);
      same.Devices = devs.join(" ");
      u = same;
    }
    if (!u) {
      // Don't list a device until it has a name or a confirmed email.
      if (!ve && !cleanText(req.name, 40)) return { ok: true, waiting: true };
      u = { "User ID": req.uid, "First seen": now, "Emails scanned": 0, "Scams caught": 0, Checks: 0, Alerts: 0 };
    }
    if (req.name !== undefined && cleanText(req.name, 40)) u.Name = cleanText(req.name, 40);
    if (ve) {
      u.Email = ve;
      u["Email verified"] = "yes";
    } else if (!u.Email && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(req.email || "")) {
      u.Email = String(req.email).toLowerCase().slice(0, 80);
      u["Email verified"] = "no";
    }
    if (req.lang) u.Language = cleanText(req.lang, 20);
    if (req.reports !== undefined) u["Daily report"] = req.reports ? "on" : "off";
    if (req.alerts !== undefined) u["Danger alerts"] = req.alerts ? "on" : "off";
    if (Array.isArray(req.family))
      u["Trusted people"] = req.family
        .slice(0, 5)
        .map(f => [cleanText(f.name, 40), cleanText(f.email, 80), cleanText(f.phone, 30)].filter(Boolean).join(" | "))
        .join("\n");
    u["Last active"] = now;
    writeUser(u);
    return { ok: true, verified: u["Email verified"] === "yes", email: u.Email || "" };
  } finally {
    lock.releaseLock();
  }
}

// What the app tells the server: the kind of thing checked, the result, and the time. Never the message itself.
function cleanEv(x) {
  if (!x || typeof x !== "object") return null;
  const t = { check: 1, pause: 1, scammed: 1, block: 1, scan: 1 }[x.t] ? x.t : null;
  if (!t) return null;
  const at = +x.at;
  return {
    t,
    c: cleanText(x.c, 12),
    l: ["scam", "warn", "safe"].includes(x.l) ? x.l : "",
    k: cleanText(x.k, 40),
    o: x.o === "paid" ? "paid" : "",
    n: Math.max(0, Math.min(5000, +x.n || 0)),
    s: Math.max(0, Math.min(5000, +x.s || 0)),
    w: Math.max(0, Math.min(5000, +x.w || 0)),
    src: cleanText(x.src, 12),
    at: at > Date.now() - 7 * 864e5 && at <= Date.now() + 60000 ? at : Date.now()
  };
}
const WHAT = {
  check: "Checked something",
  pause: "Pause before you pay",
  scammed: "Opened \"I was scammed\"",
  block: "Blocked a sender",
  scan: "Scanned email"
};

function saveEvents(req) {
  if (!okUid(req.uid)) return { error: "bad id" };
  const evs = [].concat(req.events || []).slice(0, 50).map(cleanEv).filter(Boolean);
  if (!evs.length) return { ok: true, saved: 0 };
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  let u;
  try {
    u = findUser(req.uid);
    if (!u) return { error: "unknown user", register: true };
    const rows = evs.map(e => [
      new Date(e.at),
      req.uid,
      u.Name || "",
      WHAT[e.t] + (e.o === "paid" ? " (already paid)" : ""),
      e.t === "scan" ? e.src : e.c,
      e.t === "scan" ? `${e.n} emails, ${e.s} scams, ${e.w} careful` : e.l,
      e.k,
      ""
    ]);
    const sh = sheet("Activity");
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, ACT_COLS.length).setValues(rows);
    evs.forEach(e => {
      if (e.t === "scan") {
        u["Emails scanned"] = (+u["Emails scanned"] || 0) + e.n;
        u["Scams caught"] = (+u["Scams caught"] || 0) + e.s;
      }
      if (e.t === "check") {
        u.Checks = (+u.Checks || 0) + 1;
        if (e.l === "scam") u["Scams caught"] = (+u["Scams caught"] || 0) + 1;
      }
    });
    u["Last active"] = new Date();
    writeUser(u);
  } finally {
    lock.releaseLock();
  }
  evs.forEach(e => {
    const danger =
      e.t === "scammed"
        ? "said they were scammed and opened the recovery steps"
        : e.t === "pause" && e.o === "paid"
          ? "said they already paid someone who may be a scammer"
          : e.t === "pause" && e.l === "scam"
            ? "was about to pay a scammer. ScamSense told them to stop"
            : "";
    if (danger) dangerAlert(u, danger);
  });
  return { ok: true, saved: evs.length };
}

/* ========================================================================
   7. ALERTS — emails the owner and the person's trusted people right away
   ======================================================================== */

function dangerAlert(u, what) {
  if (!takeQuota("alert:" + u["User ID"], OWNER.MAX_ALERTS_PER_USER)) return;
  const owner = Session.getEffectiveUser().getEmail();
  const name = u.Name || "A ScamSense user";
  const family = String(u["Trusted people"] || "")
    .split("\n")
    .map(l => (l.split(" | ").find(x => /@/.test(x)) || "").trim())
    .filter(Boolean);
  const familyOk = u["Danger alerts"] !== "off" && u["Email verified"] === "yes";
  const to = [owner].concat(familyOk ? family : []);
  const subject = `ScamSense alert: ${name} may need help`;
  const html = alertHTML(name, what, u);
  to.forEach(addr => {
    try {
      MailApp.sendEmail({ to: addr, subject, htmlBody: html, body: `${name} ${what}. Please call them now.`, name: "ScamSense Alerts" });
    } catch (e) {}
  });
  sheet("Alerts").appendRow([new Date(), name, u.Email || "", `${name} ${what}`, to.join(", ")]);
  u.Alerts = (+u.Alerts || 0) + 1;
  writeUser(u);
}

function alertHTML(name, what, u) {
  return mailShell(
    `<div style="border-top:6px solid #B42318;padding:22px">
      <div style="font-size:22px;font-weight:800;color:#111827">${esc(name)} may need help</div>
      <p style="font-size:16px;line-height:1.5;color:#111827">${esc(name)} ${esc(what)}.</p>
      <div style="background:#FDECEA;border-radius:12px;padding:14px 16px;font-size:15px;line-height:1.5;color:#7A1A12">
        <b>What to do now</b><br>1. Call ${esc(name)} on the number you already have.<br>2. If money was sent, help them call their bank right away.<br>3. Open ScamSense together and follow the "I was scammed" steps.
      </div>
      ${u.Email ? `<p style="font-size:13px;color:#5F6673">Their email: ${esc(u.Email)}</p>` : ""}
    </div>`
  );
}

// Counts something per person per day; false once the limit is reached.
function takeQuota(key, max) {
  const c = CacheService.getScriptCache();
  const k = key + ":" + Utilities.formatDate(new Date(), "UTC", "yyyyMMdd");
  const n = +(c.get(k) || 0);
  if (n >= max) return false;
  c.put(k, String(n + 1), 21600);
  return true;
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
}

/* ========================================================================
   8. REPORTS — a daily email for every user, and "email me" from Mahi
   ======================================================================== */

// Mahi's "email me": sends a draft or summary to the person's own (verified) email.
function emailMe(req) {
  if (!okUid(req.uid)) return { error: "bad id" };
  const u = findUser(req.uid);
  if (!u || !u.Email || u["Email verified"] !== "yes")
    return { error: "Connect your Gmail or Outlook in ScamSense first, so we know where to send it." };
  if (!takeQuota("mail:" + req.uid, OWNER.MAX_EMAILS_PER_USER))
    return { error: "That's the most emails for today. Please try again tomorrow." };
  const subject = cleanText(req.subject, 150) || "From Mahi";
  const body = String(req.body || "").slice(0, 8000);
  MailApp.sendEmail({
    to: u.Email,
    subject,
    body,
    htmlBody: mailShell(
      `<div style="padding:22px"><div style="font-size:13px;color:#5F6673;margin-bottom:8px">Mahi sent this at your request.</div><div style="font-size:16px;line-height:1.55;color:#111827;white-space:pre-wrap">${esc(body)}</div></div>`
    ),
    name: "Mahi from ScamSense"
  });
  return { ok: true, sentTo: u.Email };
}

// Runs every morning: one report per user who has an email and reports turned on.
function sendAllReports() {
  const users = sheet("Users").getDataRange().getValues();
  const head = users.shift();
  const since = Date.now() - 864e5;
  const act = sheet("Activity").getDataRange().getValues().slice(1).filter(r => new Date(r[0]).getTime() >= since);
  users.forEach(v => {
    const u = {};
    head.forEach((c, i) => (u[c] = v[i]));
    if (!u.Email || u["Email verified"] !== "yes" || u["Daily report"] === "off") return;
    const mine = act.filter(r => r[1] === u["User ID"]);
    try {
      MailApp.sendEmail({
        to: u.Email,
        subject: reportSubject(mine),
        htmlBody: userReportHTML(u, mine),
        body: `Your ScamSense report: ${mine.length} things happened in the last day. Open ScamSense: ${OWNER.APP_URL}`,
        name: "ScamSense Daily Report"
      });
    } catch (e) {}
  });
}
// For testing: sends the report to every user now.
function sendReportsNow() {
  sendAllReports();
}

function reportSubject(rows) {
  const scams = rows.reduce(
    (n, r) =>
      n +
      (r[3] === "Scanned email"
        ? +String(r[5]).split(",")[1].trim().split(" ")[0] || 0
        : r[3] === "Checked something" && r[5] === "scam"
          ? 1
          : 0),
    0
  );
  return scams ? `ScamSense: ${scams} scam${scams === 1 ? "" : "s"} caught — here's your report` : "ScamSense: all clear today";
}

function userReportHTML(u, rows) {
  const scans = rows.filter(r => r[3] === "Scanned email");
  const checks = rows.filter(r => r[3] === "Checked something");
  const pauses = rows.filter(r => r[3] === "Pause before you pay");
  const emails = scans.reduce((n, r) => n + (+String(r[5]).split(" ")[0] || 0), 0);
  const scams = scans.reduce((n, r) => n + (+String(r[5]).split(",")[1].trim().split(" ")[0] || 0), 0) + checks.filter(r => r[5] === "scam").length;
  const tile = (label, val) =>
    `<td width="33%" style="padding:5px"><div style="background:#fff;border:1px solid #E3E5EA;border-radius:12px;padding:12px"><div style="font-size:11px;font-weight:800;color:#5F6673;text-transform:uppercase">${label}</div><div style="font-size:26px;font-weight:800;color:#111827">${val}</div></div></td>`;
  const list = rows
    .filter(r => r[3] !== "Scanned email")
    .slice(-12)
    .map(
      r =>
        `<tr><td style="padding:8px 0;border-top:1px solid #E3E5EA;font-size:14px;color:#111827">${esc(r[3])}${r[4] ? " · " + esc(r[4]) : ""}</td><td style="padding:8px 0;border-top:1px solid #E3E5EA;font-size:14px;text-align:right;color:${r[5] === "scam" ? "#B42318" : r[5] === "warn" ? "#8A5300" : "#1F7A3E"}">${esc(r[5] === "warn" ? "be careful" : r[5] || "")}</td></tr>`
    )
    .join("");
  const head = scams ? `${scams} scam${scams === 1 ? "" : "s"} caught. Don't open ${scams === 1 ? "it" : "them"}.` : "All clear. No scams found.";
  return mailShell(
    `<div style="padding:22px">
      <div style="font-size:15px;color:#5F6673">Good morning${u.Name ? ", " + esc(u.Name) : ""}</div>
      <div style="font-size:24px;font-weight:800;color:#111827;margin-top:4px">${head}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;table-layout:fixed"><tr>${tile("Emails checked", emails)}${tile("Scams caught", scams)}${tile("Payments paused", pauses.length)}</tr></table>
      ${scams ? `<div style="background:#FDECEA;border-radius:12px;padding:12px 14px;margin-top:16px;font-size:15px;color:#7A1A12">Open ScamSense to see which emails and messages were scams, and what to do.</div>` : ""}
      ${list ? `<div style="font-size:13px;font-weight:800;color:#5F6673;margin-top:18px">IN THE APP</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${list}</table>` : ""}
      ${!rows.length ? `<p style="font-size:15px;color:#111827">ScamSense didn't see anything new yesterday. Open the app to scan your email.</p>` : ""}
      <div style="text-align:center;margin-top:22px"><a href="${OWNER.APP_URL}" style="display:inline-block;background:#14213D;color:#fff;text-decoration:none;font-weight:800;padding:13px 26px;border-radius:12px">Open ScamSense</a></div>
    </div>`
  );
}

// The shared look of every email: navy header with the owl, white card, small footer.
function mailShell(inner) {
  return `<!doctype html><html><body style="margin:0;background:#F5F5F2;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:18px 10px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #E3E5EA">
<tr><td style="background:#14213D;padding:16px 22px;font-size:19px;font-weight:800;color:#fff">&#129417; ScamSense</td></tr>
<tr><td>${inner}</td></tr></table>
<div style="font-size:12px;color:#5F6673;margin-top:12px">You get this because you use ScamSense. Turn emails off in ScamSense › Settings › Your account.</div>
</td></tr></table></body></html>`;
}


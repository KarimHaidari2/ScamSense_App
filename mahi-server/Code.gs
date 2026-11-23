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
     9. Owner         weekly summary, welcome email, follow-up, blocking
    11. Support       live help: cases, messages, photos, quick replies
    12. Phone alerts  push notifications to the Owner app
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
    if (isBlocked(req.uid)) return json(BLOCKED);
    if (req.mode === "auth") return json(authApi(req));
    // A device that signed out (or whose 60 days ran out) must sign in again before using the account.
    if (/^(events|support|email_me)$/.test(req.mode) && okUid(req.uid) && sessionState(req.uid) === false)
      return json({ error: "Please sign in again.", signin: true });
    if (req.mode === "check") return json(checkMessage(req));
    if (req.mode === "intel") return json({ ok: true, ages: domainAges(req.domains) });
    if (req.mode === "register") return json(registerUser(req));
    if (req.mode === "events") return json(saveEvents(req));
    if (req.mode === "email_me") return json(emailMe(req));
    if (req.mode === "breach") return json(breachCheck(req));
    if (req.mode === "exposure") return json(exposureScan(req));
    if (req.mode === "phone_start") return json(phoneStart(req));
    if (req.mode === "phone_confirm") return json(phoneConfirm(req));
    if (req.mode === "owner") return json(ownerApi(req));
    if (req.mode === "support") return json(supportApi(req));
    if (req.mode === "push_peek") return json(pushPeek(req));
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
  const details = String(req.check || "")
    .slice(0, 6000)
    .trim();
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
Unpaid toll, package fee, or redelivery texts that link to a website that is not the real company's own website are SCAM. Weigh the evidence lines: earlier emails from the same address and a web address registered years ago are strong signs of a real sender; a web address registered in the last 30 days is a strong scam sign. Do not call something a scam only because of a brand name, a sweepstakes, or a marketing tone when the sender is signed and has history.
Real, signed mail from a company's own domain (for example pay, delivery-route, or account notices from gig apps like Spark Driver, DoorDash, or Uber) is SAFE even when it mentions accounts, payments, or deadlines. Normal newsletters, receipts, account notices and payment reminders from real companies (sent from their official domain, with passing sender checks, pointing to their own website) are SAFE. Do not call something a scam just because it is marketing.
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
    {
      type: "web_search_20250305",
      name: "web_search",
      max_uses: MAHI.WEB_SEARCHES,
      user_location: { type: "approximate", country: "US" }
    }
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
  return {
    content: simplify(blocks, r.stop_reason),
    stop_reason: r.stop_reason === "pause_turn" ? "end_turn" : r.stop_reason
  };
}
// Joins the answer's text pieces, keeps app actions (tool_use), drops raw search data,
// and adds "Sources" with the web pages the answer used.
function simplify(blocks, stop) {
  const out = [],
    sources = [];
  blocks.forEach(b => {
    if (b.type === "text") {
      (b.citations || []).forEach(c => {
        if (c.url && !sources.some(s => s.url === c.url))
          sources.push({ url: c.url, title: c.title || c.url });
      });
      const last = out[out.length - 1];
      if (last && last.type === "text") last.text += b.text;
      else out.push({ type: "text", text: b.text });
    } else if (b.type === "tool_use") out.push({ type: "tool_use", id: b.id, name: b.name, input: b.input });
  });
  if (sources.length && stop !== "tool_use") {
    const list = sources
      .slice(0, 4)
      .map(s => "• " + s.title + " — " + s.url)
      .join("\n");
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
  EMAIL: "scamsense.karim@outlook.com", // the ScamSense owner: gets alerts and the weekly summary; replies go here
  DASHBOARD: "ScamSense Owner Dashboard",
  REPORT_HOUR: 8, // daily reports go out around this hour (the script's time zone)
  APP_URL: "https://karimhaidari2.github.io/ScamSense_App/",
  MAX_EMAILS_PER_USER: 10, // "email me" emails per person per day
  MAX_ALERTS_PER_USER: 3 // danger alerts per person per day
};
const USER_COLS = [
  "User ID",
  "First name",
  "Last name",
  "Date of birth", // YYYY-MM-DD, from "About you" in the app
  "Country",
  "State",
  "ZIP",
  "Email",
  "Email verified",
  "Gmail",
  "Outlook",
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
  "Devices",
  "Follow-up", // "needs follow-up" after a danger alert; type "done" when you've reached them
  "Blocked", // type "yes" to stop ScamSense for this person
  "Status", // "active" or "quiet 7+ days", updated every morning
  "Owner notes", // your own notes about this person (from the Owner dashboard)
  "Password" // never the password itself: a salted, scrambled fingerprint (see 13. Accounts)
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
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "sendOwnerWeekly") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("sendOwnerWeekly")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(OWNER.REPORT_HOUR)
    .create();
  writeServicesTab();
  console.log("Owner dashboard: " + db.getUrl());
}

// A "Services" tab in the Owner Dashboard: every outside service ScamSense uses, what it does,
// why we chose it, what it costs, and where its key lives. Run writeServicesTab to refresh it.
// (No keys or passwords are written here.)
const SERVICES = [
  ["Service", "What it does in ScamSense", "Why we chose it", "Cost", "Account", "Where the key lives", "Limits we set", "Link"],
  ["Anthropic Claude (AI)", "Mahi's answers and the smart scam check for emails, texts, calls, and links", "Strong at judging scams in plain language; API data isn't used to train its models", "Pay per use; set a monthly spending limit in Claude Console", "Claude Console", "Script Properties: ANTHROPIC_API_KEY", "300 answers a day for everyone", "https://console.anthropic.com"],
  ["Google Apps Script + Sheets", "Runs this server (Mahi, accounts, reports, alerts) and keeps this dashboard", "Free, no servers to manage, keeps keys off the phone", "Free", "Owner Google account", "-", "-", "https://script.google.com"],
  ["GitHub Pages", "Hosts the ScamSense app itself", "Free, fast, and the code is public and easy to review", "Free", "KarimHaidari2 on GitHub", "-", "-", "https://github.com/KarimHaidari2/ScamSense_App"],
  ["Google Cloud (Gmail sign-in)", "Lets people connect Gmail so ScamSense can scan it, move scams to Spam, and block senders", "The official, safe way to read Gmail with the person's permission", "Free", "Google Cloud project", "Public client ID in the app", "Testing mode: approved test users only (100 max)", "https://console.cloud.google.com"],
  ["Microsoft Azure (Outlook sign-in)", "Lets people connect Outlook and Hotmail the same way", "The official Microsoft sign-in; no password ever reaches ScamSense", "Free", "Azure app 'scamsense'", "Public client ID in the app", "-", "https://portal.azure.com"],
  ["XposedOrNot", "Email leak check: was this email in a known data breach, what leaked, and when", "Free, no key needed, public breach lists", "Free (low use)", "None", "-", "10 checks per device per day; results cached 1 day", "https://xposedornot.com"],
  ["Have I Been Pwned (optional)", "Same leak check, used instead of XposedOrNot if a key is added", "The best-known breach database, made for apps", "About $4-5/month", "Not set up yet", "Script Properties: HIBP_API_KEY", "-", "https://haveibeenpwned.com/API/Key"],
  ["Twilio Verify (TEXT)", "Texts a 6-digit code to the phone number first, so people can only look up THEIR OWN number", "Reliable, used by big companies for login codes; handles phone-company rules (no 10DLC registration needed)", "About $0.06 per code; $20 prepaid, auto-recharge OFF", "scamsense.karim@outlook.com", "Script Properties: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SID", "5 sent codes per device per day; Fraud Guard on", "https://console.twilio.com"],
  ["Trestle Reverse Phone API (PHONE LOOKUP)", "After the code: shows the name, age range, home address, and phone company that data companies sell about the number", "Real identity data (built by the former Whitepages Pro team); simple pay-per-use pricing", "$0.07 per lookup; 14-day trial", "kah3271@utulsa.edu", "Script Properties: TRESTLE_API_KEY", "3 lookups per device per month; only shows names matching the user's last name (hides past owners)", "https://trestleiq.com"],
  ["RDAP (domain records)", "Checks how old a sender's website is; brand-new websites are a strong scam sign", "Free official internet registry data", "Free", "None", "-", "Results cached", "https://about.rdap.org"],
  ["Optery (planned)", "Automatic removal from 600+ data broker sites with one tap", "Sells this as an API to other apps; would replace the manual site list", "Ask for a quote", "Not set up yet", "-", "-", "https://www.optery.com/api"]
];
function writeServicesTab() {
  const db = getDb();
  const sh = db.getSheetByName("Services") || db.insertSheet("Services");
  sh.clear();
  sh.getRange(1, 1, SERVICES.length, SERVICES[0].length).setValues(SERVICES).setWrap(true).setVerticalAlignment("top");
  sh.getRange(1, 1, 1, SERVICES[0].length).setFontWeight("bold").setBackground("#14213D").setFontColor("#FFFFFF");
  sh.setFrozenRows(1);
  [210, 300, 280, 190, 190, 230, 230, 230].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  console.log("Services tab updated: " + db.getUrl() + "#gid=" + sh.getSheetId());
}

function getDb() {
  const p = PropertiesService.getScriptProperties();
  let id = p.getProperty("DB_ID");
  if (id) {
    try {
      const ss = SpreadsheetApp.openById(id);
      const users = ss.getSheetByName("Users");
      if (users) addNewColumns(users);
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
    sh.getRange(1, 1, 1, cols.length)
      .setValues([cols])
      .setFontWeight("bold")
      .setBackground("#14213D")
      .setFontColor("#FFFFFF");
    sh.setFrozenRows(1);
  });
  p.setProperty("DB_ID", ss.getId());
  return ss;
}
const sheet = name => getDb().getSheetByName(name);

// When a newer version adds columns, they're inserted in the right place and old rows keep their data.
function addNewColumns(sh) {
  const head = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
  const nameAt = head.indexOf("Name");
  if (nameAt >= 0 && head.indexOf("First name") < 0) head[nameAt] = "First name";
  let changed = nameAt >= 0;
  USER_COLS.forEach((c, i) => {
    if (head.indexOf(c) < 0) {
      if (i < head.length && head[i] !== "") sh.insertColumnBefore(i + 1);
      head.splice(i, 0, c);
      changed = true;
    }
  });
  if (changed)
    sh.getRange(1, 1, 1, USER_COLS.length)
      .setValues([USER_COLS])
      .setFontWeight("bold")
      .setBackground("#14213D")
      .setFontColor("#FFFFFF");
}
const fullName = u => [u["First name"], u["Last name"]].filter(Boolean).join(" ");
// Date of birth as YYYY-MM-DD, even if Sheets turned it into a date.
const dobText = v =>
  v instanceof Date
    ? Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd")
    : String(v || "")
        .replace(/^'/, "")
        .slice(0, 10);

// Finds a person by this device's ID. A device that signed in belongs to whoever it signed in as
// (the Sessions sheet), even if it was once someone else's phone. Otherwise: their first device in
// column A, other devices in "Devices".
function findUser(uid) {
  const sh = sheet("Users");
  try {
    const s = sessionRows().find(x => x.device === uid);
    if (s && s.uid && s.uid !== uid) {
      const own = sh.getRange("A:A").createTextFinder(String(s.uid)).matchEntireCell(true).findNext();
      if (own && own.getRow() > 1) return userAt(own.getRow());
    }
  } catch (e) {}
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
  const col = USER_COLS.indexOf("Email") + 1;
  const hit = sh
    .getRange(1, col, Math.max(1, sh.getLastRow()), 1)
    .createTextFinder(email)
    .matchEntireCell(true)
    .findNext();
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
      if (r.getResponseCode() === 200)
        return String(JSON.parse(r.getContentText()).emailAddress || "").toLowerCase();
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
    let ve = verifiedEmail(req);
    // This phone is signed in to an account with a different email, and connected someone else's
    // (or a second) mailbox: that mailbox is only something to scan. It never changes who this
    // account is, and it never moves the phone into another person's account.
    if (
      ve &&
      u &&
      u["Email verified"] === "yes" &&
      u.Email &&
      String(u.Email).toLowerCase() !== ve &&
      sessionState(req.uid) !== false
    ) {
      if (findUserByEmail(ve)) acctEvent(u, req.uid, "Connected a mailbox that belongs to another ScamSense account (" + ve + ")", true);
      ve = "";
    }
    // Same person on another device: use their existing row and remember this device too.
    const same = ve && findUserByEmail(ve);
    if (same && (!u || same.row !== u.row)) {
      if (u && u.row && u["Email verified"] !== "yes") {
        sheet("Users").deleteRow(u.row); // the extra row this device made earlier
        if (u.row < same.row) same.row--;
      }
      const devs = String(same.Devices || "")
        .split(/\s+/)
        .filter(Boolean);
      if (same["User ID"] !== req.uid && devs.indexOf(req.uid) < 0) devs.push(req.uid);
      same.Devices = devs.join(" ");
      u = same;
    }
    if (!u) {
      // Don't list a device until it has a name or a confirmed email.
      if (!ve && !cleanText(req.name, 40) && !cleanText(req.lastName, 40)) return { ok: true, waiting: true };
      u = {
        "User ID": req.uid,
        "First seen": now,
        "Emails scanned": 0,
        "Scams caught": 0,
        Checks: 0,
        Alerts: 0
      };
    }
    if (cleanText(req.name, 40)) u["First name"] = cleanText(req.name, 40);
    if (cleanText(req.lastName, 40)) u["Last name"] = cleanText(req.lastName, 40);
    // About you: date of birth, country, state, ZIP (never a street address).
    const dob = String(req.dob || "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      const d = new Date(dob + "T12:00:00Z");
      const age = (Date.now() - d) / (365.25 * 864e5);
      if (!isNaN(d) && d.toISOString().slice(0, 10) === dob && age >= 13 && age < 120) u["Date of birth"] = "'" + dob;
    }
    if (cleanText(req.country, 60)) u.Country = cleanText(req.country, 60);
    if (req.state !== undefined && cleanText(req.state, 40)) u.State = cleanText(req.state, 40);
    if (/^[A-Za-z0-9 -]{3,10}$/.test(String(req.zip || "").trim())) u.ZIP = "'" + String(req.zip).trim();
    if (ve) {
      const firstTime = u["Email verified"] !== "yes";
      u.Email = ve;
      u["Email verified"] = "yes";
      if (firstTime) u._welcome = true;
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
        .map(f =>
          [cleanText(f.name, 40), cleanText(f.email, 80), cleanText(f.phone, 30)].filter(Boolean).join(" | ")
        )
        .join("\n");
    // A signed-out device can only come back with a real sign-in (Google, Outlook, or email + password).
    if (!ve && sessionState(req.uid) === false) return { error: "Please sign in again.", signin: true };
    u["Last active"] = now;
    u.Status = "active";
    const welcome = u._welcome;
    delete u._welcome;
    writeUser(u);
    if (welcome) sendWelcome(u);
    const fresh = findUser(req.uid) || u;
    if (ve && sessionState(req.uid) !== true) {
      sessionStart(fresh, req.uid, true, cleanText(req.device, 60) || "Google or Outlook sign-in");
      if (!welcome) acctEvent(fresh, req.uid, "Signed in with " + (req.gtoken ? "Google" : "Outlook"), false);
      else acctEvent(fresh, req.uid, "Created an account with " + (req.gtoken ? "Google" : "Outlook"), true);
    } else if (fresh.row) sessionAdopt(fresh, req.uid);
    const isOwner = u["Email verified"] === "yes" && ownerEmails().indexOf(String(u.Email).toLowerCase()) >= 0;
    const dobOut = dobText(u["Date of birth"]);
    return {
      ok: true,
      verified: u["Email verified"] === "yes",
      email: u.Email || "",
      owner: isOwner,
      expires: sessionExpires(req.uid),
      hasPassword: !!u.Password,
      // So a second device doesn't have to ask again.
      profile: {
        first: u["First name"] || "",
        last: u["Last name"] || "",
        dob: dobOut,
        country: u.Country || "",
        state: u.State || "",
        zip: String(u.ZIP || "").replace(/^'/, "")
      }
    };
  } finally {
    lock.releaseLock();
  }
}

// What the app tells the server: the kind of thing checked, the result, and the time. Never the message itself.
function cleanEv(x) {
  if (!x || typeof x !== "object") return null;
  const t = { check: 1, pause: 1, scammed: 1, block: 1, scan: 1, account: 1, leak: 1, phone_lookup: 1 }[x.t] ? x.t : null;
  if (!t) return null;
  const at = +x.at;
  return {
    t,
    c: cleanText(x.c, 12),
    l: ["scam", "warn", "safe"].includes(x.l) ? x.l : "",
    k: cleanText(x.k, 40),
    o: ["paid", "gmail_on", "gmail_off", "outlook_on", "outlook_off"].indexOf(x.o) >= 0 ? x.o : "",
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
  scammed: 'Opened "I was scammed"',
  block: "Blocked a sender",
  scan: "Scanned email",
  account: "",
  leak: "Checked an email for data leaks",
  phone_lookup: "Checked their phone number"
};
const ACCOUNT = {
  gmail_on: "Connected Gmail",
  gmail_off: "Disconnected Gmail",
  outlook_on: "Connected Outlook",
  outlook_off: "Disconnected Outlook"
};

function saveEvents(req) {
  if (!okUid(req.uid)) return { error: "bad id" };
  const evs = []
    .concat(req.events || [])
    .slice(0, 50)
    .map(cleanEv)
    .filter(Boolean);
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
      fullName(u),
      e.t === "account" ? ACCOUNT[e.o] || "Account" : WHAT[e.t] + (e.o === "paid" ? " (already paid)" : ""),
      e.t === "scan" ? e.src : e.c,
      e.t === "scan"
        ? `${e.n} emails, ${e.s} scams, ${e.w} careful`
        : e.t === "leak"
          ? `${e.n} leaks`
          : e.t === "phone_lookup"
            ? (e.n ? "name and address public" : "nothing confirmed")
            : e.l,
      e.k,
      ""
    ]);
    const sh = sheet("Activity");
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, ACT_COLS.length).setValues(rows);
    const when = d => Utilities.formatDate(new Date(d), Session.getScriptTimeZone(), "MMM d, h:mm a");
    evs.forEach(e => {
      if (e.t === "account" && ACCOUNT[e.o]) {
        const which = e.o.indexOf("gmail") === 0 ? "Gmail" : "Outlook";
        u[which] = (e.o.slice(-2) === "on" ? "connected " : "disconnected ") + when(e.at);
      }
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
    u.Status = "active";
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
    const kind = e.t === "scammed" ? "scammed" : e.t === "pause" && e.o === "paid" ? "paid" : e.t === "pause" && e.l === "scam" ? "stop" : "";
    if (kind)
      try {
        supportFromDanger(u, kind);
      } catch (err) {}
  });
  return { ok: true, saved: evs.length };
}

/* ========================================================================
   7. ALERTS — emails the owner and the person's trusted people right away
   ======================================================================== */

function dangerAlert(u, what) {
  if (!takeQuota("alert:" + u["User ID"], OWNER.MAX_ALERTS_PER_USER)) return;
  const owner = OWNER.EMAIL || Session.getEffectiveUser().getEmail();
  const name = fullName(u) || "A ScamSense user";
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
      MailApp.sendEmail({
        replyTo: OWNER.EMAIL,
        to: addr,
        subject,
        htmlBody: html,
        body: `${name} ${what}. Please call them now.`,
        name: "ScamSense Alerts"
      });
    } catch (e) {}
  });
  sheet("Alerts").appendRow([new Date(), name, u.Email || "", `${name} ${what}`, to.join(", ")]);
  u.Alerts = (+u.Alerts || 0) + 1;
  u["Follow-up"] = "needs follow-up";
  writeUser(u);
  try {
    if (u.row)
      sheet("Users")
        .getRange(u.row, USER_COLS.indexOf("Follow-up") + 1)
        .setBackground("#FDECEA");
  } catch (e) {}
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

// How many times something was counted today (without counting it again).
function quotaUsed(key) {
  return +(CacheService.getScriptCache().get(key + ":" + Utilities.formatDate(new Date(), "UTC", "yyyyMMdd")) || 0);
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
  return String(s == null ? "" : s).replace(
    /[&<>"]/g,
    ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]
  );
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
    replyTo: OWNER.EMAIL,
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

/* ========================================================================
   8b. CLEAN UP MY INFO — data leak check and (later) automatic removal
   ======================================================================== */

// "Was my email in a data leak?" The person types an email; we look it up in public breach lists
// (the same lists anyone can search on haveibeenpwned.com). Uses Have I Been Pwned if you add a
// HIBP_API_KEY (paid, made for apps like this), otherwise the free XposedOrNot service (low use only).
// Results are kept for a day so we don't ask twice. Limited to 10 checks per device per day.
function breachCheck(req) {
  if (!okUid(req.uid)) return { error: "bad id" };
  const email = String(req.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(email) || email.length > 120)
    return { error: "That doesn't look like an email address." };
  const cache = CacheService.getScriptCache();
  const ck = "breach:" + Utilities.base64EncodeWebSafe(email).slice(0, 200);
  const hit = cache.get(ck);
  if (hit) return JSON.parse(hit);
  if (!takeQuota("breach:" + req.uid, 10)) return { error: "That's the most checks for today. Please try again tomorrow." };
  const hibp = PropertiesService.getScriptProperties().getProperty("HIBP_API_KEY");
  let out;
  try {
    out = hibp ? breachesHIBP(email, hibp) : breachesXON(email);
  } catch (err) {
    return { error: "The leak check isn't answering right now. Please try again later." };
  }
  bump("LEAK");
  out.ok = true;
  out.email = email;
  out.checked = new Date().toISOString();
  cache.put(ck, JSON.stringify(out), 86400);
  return out;
}
function breachesHIBP(email, key) {
  const r = UrlFetchApp.fetch(
    "https://haveibeenpwned.com/api/v3/breachedaccount/" + encodeURIComponent(email) + "?truncateResponse=false",
    { headers: { "hibp-api-key": key, "user-agent": "ScamSense" }, muteHttpExceptions: true }
  );
  if (r.getResponseCode() === 404) return { source: "Have I Been Pwned", breaches: [] };
  if (r.getResponseCode() !== 200) throw new Error("hibp " + r.getResponseCode());
  const list = JSON.parse(r.getContentText()) || [];
  return {
    source: "Have I Been Pwned",
    breaches: list.slice(0, 40).map(b => ({
      name: String(b.Title || b.Name || ""),
      domain: String(b.Domain || ""),
      date: String(b.BreachDate || ""),
      data: (b.DataClasses || []).slice(0, 8).map(String)
    }))
  };
}
function breachesXON(email) {
  const r = UrlFetchApp.fetch(
    "https://api.xposedornot.com/v1/breach-analytics?email=" + encodeURIComponent(email),
    { muteHttpExceptions: true }
  );
  const code = r.getResponseCode();
  if (code === 404) return { source: "XposedOrNot", breaches: [] };
  if (code !== 200) throw new Error("xon " + code);
  const j = JSON.parse(r.getContentText() || "{}");
  const list = (j.ExposedBreaches && j.ExposedBreaches.breaches_details) || [];
  const risk = j.BreachMetrics && j.BreachMetrics.risk && j.BreachMetrics.risk[0];
  return {
    source: "XposedOrNot",
    risk: (risk && risk.risk_label) || "",
    breaches: list.slice(0, 40).map(b => ({
      name: String(b.breach || ""),
      domain: String(b.domain || ""),
      date: String(b.xposed_date || ""),
      data: String(b.xposed_data || "")
        .split(";")
        .map(x => x.trim())
        .filter(Boolean)
        .slice(0, 8)
    }))
  };
}

// "What's public about my phone number?" Like the paid sites, but only for YOUR OWN number:
// 1. phoneStart texts a 6-digit code to the number (Twilio Verify).
// 2. phoneConfirm checks the code, then looks the number up (Trestle Reverse Phone API) and returns
//    the name, age range, address, and phone company linked to it. Nothing is saved on the server.
// Limits: 3 lookups per person per month, 5 codes per person per day (each costs a few cents).
// Script Properties needed: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SID, TRESTLE_API_KEY.
const PHONE_LOOKUPS_PER_MONTH = 3;
function phoneKeys() {
  const p = PropertiesService.getScriptProperties();
  const k = {
    sid: p.getProperty("TWILIO_ACCOUNT_SID"),
    token: p.getProperty("TWILIO_AUTH_TOKEN"),
    verify: p.getProperty("TWILIO_VERIFY_SID"),
    trestle: p.getProperty("TRESTLE_API_KEY")
  };
  return k.sid && k.token && k.verify && k.trestle ? k : null;
}
function usPhone(v) {
  let d = String(v || "").replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") d = d.slice(1);
  return /^[2-9]\d{9}$/.test(d) ? "+1" + d : "";
}
function monthKey(uid) {
  return "phq:" + uid + ":" + Utilities.formatDate(new Date(), "UTC", "yyyyMM");
}
function lookupsLeft(uid) {
  const used = +(PropertiesService.getScriptProperties().getProperty(monthKey(uid)) || 0);
  return Math.max(0, PHONE_LOOKUPS_PER_MONTH - used);
}
function twilio(k, path, form) {
  const r = UrlFetchApp.fetch("https://verify.twilio.com/v2/Services/" + k.verify + path, {
    method: "post",
    payload: form,
    headers: { Authorization: "Basic " + Utilities.base64Encode(k.sid + ":" + k.token) },
    muteHttpExceptions: true
  });
  return { code: r.getResponseCode(), body: JSON.parse(r.getContentText() || "{}") };
}
function phoneStart(req) {
  if (!okUid(req.uid)) return { error: "bad id" };
  const k = phoneKeys();
  if (!k) return { ok: true, available: false };
  const to = usPhone(req.phone);
  if (!to) return { error: "Please type a US phone number with its area code." };
  if (!lookupsLeft(req.uid))
    return { error: "You've used this month's " + PHONE_LOOKUPS_PER_MONTH + " phone checks. Please try again next month." };
  if (quotaUsed("phcode:" + req.uid) >= 5)
    return { error: "That's 5 codes today, the daily limit. You can try again after 6 PM Central time." };
  const r = twilio(k, "/Verifications", { To: to, Channel: "sms" });
  if (r.code >= 300) {
    const why = "Twilio " + (r.body.code || r.code) + ": " + String(r.body.message || "").slice(0, 160);
    console.log("phone_start failed. " + why);
    return { error: "We couldn't text that number. (" + why + ")" };
  }
  takeQuota("phcode:" + req.uid, 5); // only texts that were really sent count toward the limit
  bump("SMS");
  return { ok: true, available: true, sentTo: to, left: lookupsLeft(req.uid) };
}
function phoneConfirm(req) {
  if (!okUid(req.uid)) return { error: "bad id" };
  const k = phoneKeys();
  if (!k) return { ok: true, available: false };
  const to = usPhone(req.phone);
  const code = String(req.code || "").replace(/\D/g, "");
  if (!to || !/^\d{4,10}$/.test(code)) return { error: "Please type the code from the text." };
  if (!takeQuota("phtry:" + req.uid, 10)) return { error: "Too many tries today. Please try again tomorrow." };
  const v = twilio(k, "/VerificationCheck", { To: to, Code: code });
  if (v.code >= 300 || v.body.status !== "approved") return { error: "That code didn't work. Please check it, or ask for a new one." };
  if (!lookupsLeft(req.uid)) return { error: "You've used this month's phone checks." };
  // Safety filter: we only show a name and address if they match the person's own last name,
  // so a past owner of the number (a stranger) is never shown.
  const u = findUser(req.uid);
  const myFirst = String((u && u["First name"]) || req.name || "").trim();
  const myLast = String((u && u["Last name"]) || req.lastName || "").trim();
  const hint = myFirst || myLast ? "&phone.name_hint=" + encodeURIComponent((myFirst + " " + myLast).trim()) : "";
  const r = UrlFetchApp.fetch("https://api.trestleiq.com/3.2/phone?phone=" + encodeURIComponent(to.slice(2)) + "&phone.country_hint=US" + hint, {
    headers: { "x-api-key": k.trestle },
    muteHttpExceptions: true
  });
  if (r.getResponseCode() !== 200) return { error: "The phone lookup isn't answering right now. Please try again later." };
  const props = PropertiesService.getScriptProperties();
  props.setProperty(monthKey(req.uid), String(PHONE_LOOKUPS_PER_MONTH - lookupsLeft(req.uid) + 1));
  bump("LOOKUP");
  const j = JSON.parse(r.getContentText() || "{}");
  const norm = s => String(s || "").toLowerCase().replace(/[^a-z]/g, "");
  const mine = o =>
    !!norm(myLast) &&
    [o.lastname, o.name].concat(o.alternate_names || []).some(n => norm(n).indexOf(norm(myLast)) !== -1);
  const all = j.owners || [];
  const hidden = all.filter(o => !mine(o)).length;
  const owners = all.filter(mine).slice(0, 3).map(o => ({
    name: String(o.name || [o.firstname, o.lastname].filter(Boolean).join(" ")),
    other: (o.alternate_names || []).slice(0, 4).map(String),
    age: String(o.age_range || ""),
    type: String(o.type || ""),
    since: String(o.link_to_phone_start_date || "").slice(0, 10),
    addresses: (o.current_addresses || []).slice(0, 2).map(a =>
      [a.street_line_1, a.street_line_2, a.city, [a.state_code, a.postal_code].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ")
    )
  }));
  return {
    ok: true,
    phone: to,
    valid: !!j.is_valid,
    carrier: String(j.carrier || ""),
    lineType: String(j.line_type || ""),
    prepaid: !!j.is_prepaid,
    owners,
    hidden,
    needName: !norm(myLast),
    left: lookupsLeft(req.uid),
    source: "Trestle"
  };
}

// Automatic removal from data broker sites. This needs a removal partner (for example Optery's
// partner API). Until a partner key is added in Script Properties, the app shows "coming soon".
function exposureScan(req) {
  const key = PropertiesService.getScriptProperties().getProperty("REMOVAL_PARTNER_KEY");
  if (!key) return { ok: true, available: false };
  // A partner is set up but not wired in yet: the partner's API details go here.
  return { ok: true, available: false, note: "partner key saved, connection not built yet" };
}

/* ========================================================================
   10. OWNER DASHBOARD — the private owner.html page talks to these
   Only the owner can use them: the page signs in with Google or Microsoft, and the
   email must be OWNER.EMAIL or one listed in Script Property OWNER_LOGINS (comma-separated).
   Never returns anyone's messages, only what the dashboard already keeps.
   ======================================================================== */

const GOOGLE_CLIENT_ID = "848599932394-4vcu5c7lgkdbmlculansl4ae6u76k0ug.apps.googleusercontent.com";

// Counts something per month in Script Properties (texts sent, phone lookups, leak checks).
function bump(what) {
  const p = PropertiesService.getScriptProperties();
  const k = what + "_" + Utilities.formatDate(new Date(), "UTC", "yyyyMM");
  p.setProperty(k, String(+(p.getProperty(k) || 0) + 1));
}
function monthCount(what, ym) {
  return +(PropertiesService.getScriptProperties().getProperty(what + "_" + ym) || 0);
}

function ownerEmails() {
  const extra = String(PropertiesService.getScriptProperties().getProperty("OWNER_LOGINS") || "");
  return [OWNER.EMAIL]
    .concat(extra.split(","))
    .map(x => String(x || "").trim().toLowerCase())
    .filter(Boolean);
}
// Who is signed in on the Owner page? Google (an "email" sign-in made for ScamSense) or Microsoft.
function ownerWho(req) {
  try {
    if (req.gtoken) {
      const r = UrlFetchApp.fetch(
        "https://oauth2.googleapis.com/tokeninfo?access_token=" + encodeURIComponent(req.gtoken),
        { muteHttpExceptions: true }
      );
      if (r.getResponseCode() === 200) {
        const j = JSON.parse(r.getContentText());
        // The sign-in must be one made for ScamSense, not some other app's.
        if ((j.azp === GOOGLE_CLIENT_ID || j.aud === GOOGLE_CLIENT_ID) && String(j.email_verified) === "true")
          return String(j.email || "").toLowerCase();
      }
    }
    if (req.mstoken) return verifiedEmail({ mstoken: req.mstoken });
  } catch (e) {}
  return "";
}

function ownerApi(req) {
  const who = ownerWho(req);
  if (!who) return { error: "Please sign in again.", signin: true };
  const a = String(req.action || "overview");
  // Who is this? The owner, or a team member the owner added (Admin or Viewer).
  let role = ownerEmails().indexOf(who) >= 0 ? "owner" : "";
  if (!role) {
    const m = teamFind(who);
    if (!m) {
      if (a === "team_request") return teamRequest(who, req.note);
      return { error: "This account isn't on the ScamSense team: " + who, notOwner: true, email: who };
    }
    if (m.Status === "requested")
      return { ok: false, pending: true, email: who, error: "Your request is waiting for the owner's approval." };
    if (m.Status !== "active") {
      if (a !== "join") return { ok: false, needCode: true, email: who, error: "Enter the code from your invite email." };
      return teamJoin(m, req.code, who);
    }
    role = m.Role === "Admin" ? "admin" : "viewer";
  }
  if (a === "join") return { ok: true, joined: true };
  if (a === "overview") return Object.assign(ownerOverview(who), { role, team: role === "owner" ? teamList() : [] });
  if (a === "person") return Object.assign(ownerPerson(req.uid), { role });
  if (/^team_(add|remove|approve|deny)$/.test(a)) {
    if (role !== "owner") return { error: "Only the owner can change the team." };
    if (a === "team_approve") return teamApprove(who, req.email, req.role);
    if (a === "team_deny") return teamDeny(who, req.email);
    return a === "team_add" ? teamAdd(who, req.email, req.role) : teamRemove(who, req.email);
  }
  if (/^(cases|case|case_photo|quick_list|reply|case_note|case_status|case_priority|case_email)$/.test(a))
    return ownerSupport(who, role, req);
  if (a === "push_key") return { ok: true, key: vapidKeys().pub };
  if (a === "push_save") return pushSave(who, req.sub, req.label);
  if (a === "push_off") return pushRemove(who, req.endpoint);
  if (a === "push_test") {
    const n = pushTeam();
    return n ? { ok: true, done: "Sent a test alert to " + n + (n === 1 ? " phone." : " phones.") } : { error: "No phones are signed up yet." };
  }
  if (a === "quick_save") return role === "viewer" ? { error: "Viewers can't change quick replies." } : quickSave(req.quick);
  if (role === "viewer") return { error: "Viewers can look, but can't make changes." };
  const u = findUser(req.uid);
  if (!u) return { error: "Couldn't find that person." };
  let did = "";
  if (a === "block") {
    u.Blocked = "yes";
    did = "Blocked";
  } else if (a === "unblock") {
    u.Blocked = "";
    did = "Unblocked";
  } else if (a === "followup_done") {
    u["Follow-up"] = "done";
    did = "Follow-up marked done";
  } else if (a === "note") {
    u["Owner notes"] = cleanText(req.note, 1000);
    did = "Saved a note";
  } else if (a === "reset_phone") {
    const p = PropertiesService.getScriptProperties();
    devicesOf(u).forEach(id => p.deleteProperty(monthKey(id)));
    did = "Reset phone checks for this month";
  } else if (a === "send_report") {
    if (!u.Email || u["Email verified"] !== "yes") return { error: "This person's email isn't confirmed yet." };
    sendReportTo(u);
    did = "Sent the daily report now";
  } else if (a === "email") {
    if (!u.Email || u["Email verified"] !== "yes") return { error: "This person's email isn't confirmed yet." };
    const subject = cleanText(req.subject, 150) || "A message from ScamSense";
    const body = String(req.body || "").slice(0, 5000);
    if (!body.trim()) return { error: "Write a message first." };
    MailApp.sendEmail({
      to: u.Email,
      replyTo: OWNER.EMAIL,
      subject,
      body,
      htmlBody: mailShell(
        `<div style="padding:22px"><div style="font-size:16px;line-height:1.55;color:#111827;white-space:pre-wrap">${esc(body)}</div></div>`
      ),
      name: "ScamSense"
    });
    did = "Emailed: " + subject;
  } else return { error: "Unknown action." };
  if (a !== "reset_phone" && a !== "send_report" && a !== "email") writeUser(u);
  ownerLog(who, did, u);
  return Object.assign({ ok: true, done: did }, ownerPerson(u["User ID"]));
}

function devicesOf(u) {
  return [u["User ID"]].concat(String(u.Devices || "").split(/\s+/)).filter(Boolean);
}
function ownerLog(who, action, u) {
  const db = getDb();
  let sh = db.getSheetByName("Owner log");
  if (!sh) {
    sh = db.insertSheet("Owner log");
    sh.appendRow(["Time", "Owner", "Action", "Person", "Person email"]);
    sh.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#14213D").setFontColor("#FFFFFF");
    sh.setFrozenRows(1);
  }
  sh.appendRow([new Date(), who, action, u ? fullName(u) : "", u ? u.Email || "" : ""]);
}
function rowsOf(name, max) {
  const sh = sheet(name);
  if (!sh || sh.getLastRow() < 2) return { head: [], rows: [] };
  const n = Math.min(max, sh.getLastRow() - 1);
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const rows = sh.getRange(sh.getLastRow() - n + 1, 1, n, head.length).getValues();
  return { head, rows };
}
const iso = v => (v instanceof Date ? v.toISOString() : v);
function userObj(head, r) {
  const o = {};
  head.forEach((c, i) => {
    if (c !== "Password") o[c] = iso(r[i]); // the password fingerprint never leaves the server
  });
  return o;
}

function ownerOverview(who) {
  const U = rowsOf("Users", 2000);
  const users = U.rows.map(r => userObj(U.head, r)).filter(u => u["User ID"]);
  const A = rowsOf("Activity", 400);
  const activity = A.rows.map(r => userObj(A.head, r)).reverse();
  const L = rowsOf("Alerts", 100);
  const alerts = L.rows.map(r => userObj(L.head, r)).reverse();
  const G = rowsOf("Owner log", 50);
  const log = G.rows.map(r => userObj(G.head, r)).reverse();
  const ym = Utilities.formatDate(new Date(), "UTC", "yyyyMM");
  const props = PropertiesService.getScriptProperties().getProperties();
  let aiMonth = 0;
  Object.keys(props).forEach(k => {
    if (k.indexOf("COUNT_" + ym) === 0) aiMonth += +props[k] || 0;
  });
  const sms = monthCount("SMS", ym),
    lookups = monthCount("LOOKUP", ym),
    leaks = monthCount("LEAK", ym);
  const has = k => !!props[k];
  return {
    ok: true,
    owner: who,
    users,
    activity,
    alerts,
    log,
    usage: {
      aiToday: countToday(),
      aiMonth,
      aiDailyLimit: MAHI.MAX_PER_DAY,
      sms,
      lookups,
      leaks,
      estCost: Math.round((sms * 0.0583 + lookups * 0.07) * 100) / 100
    },
    services: [
      { name: "Anthropic AI (Mahi + smart checks)", ok: has("ANTHROPIC_API_KEY"), link: "https://console.anthropic.com" },
      { name: "Twilio Verify (text codes)", ok: has("TWILIO_ACCOUNT_SID") && has("TWILIO_AUTH_TOKEN") && has("TWILIO_VERIFY_SID"), link: "https://console.twilio.com" },
      { name: "Trestle (phone lookup)", ok: has("TRESTLE_API_KEY"), link: "https://trestleiq.com" },
      { name: "Email leak check", ok: true, note: has("HIBP_API_KEY") ? "Have I Been Pwned" : "XposedOrNot (free)", link: "https://xposedornot.com" },
      { name: "Owner Dashboard spreadsheet", ok: true, link: getDb().getUrl() },
      { name: "Automatic removal (Optery)", ok: has("REMOVAL_PARTNER_KEY"), note: "planned", link: "https://www.optery.com/api" }
    ],
    sheetUrl: getDb().getUrl(),
    support: supportCounts()
  };
}

function ownerPerson(uid) {
  const u = findUser(uid);
  if (!u) return { error: "Couldn't find that person." };
  const ids = devicesOf(u);
  const A = rowsOf("Activity", 3000);
  const uidAt = A.head.indexOf("User ID");
  const activity = A.rows
    .filter(r => ids.indexOf(r[uidAt]) >= 0)
    .map(r => userObj(A.head, r))
    .reverse()
    .slice(0, 300);
  const L = rowsOf("Alerts", 500);
  const alerts = L.rows
    .map(r => userObj(L.head, r))
    .filter(x => (u.Email && x.Email === u.Email) || (fullName(u) && x.Name === fullName(u)))
    .reverse();
  const person = {};
  USER_COLS.forEach(c => (person[c] = iso(u[c])));
  const used = ids.reduce((n, id) => n + (PHONE_LOOKUPS_PER_MONTH - lookupsLeft(id)), 0);
  return { ok: true, person, activity, alerts, phoneChecksUsed: used, phoneChecksMax: PHONE_LOOKUPS_PER_MONTH };
}

/* ----- The team: people the owner lets into the Owner dashboard ----- */
const TEAM_COLS = ["Email", "Role", "Status", "Added", "Added by", "Code", "Code expires", "Tries", "Joined"];
function teamSheet() {
  const db = getDb();
  let sh = db.getSheetByName("Team");
  if (!sh) {
    sh = db.insertSheet("Team");
    sh.appendRow(TEAM_COLS);
    sh.getRange(1, 1, 1, TEAM_COLS.length).setFontWeight("bold").setBackground("#14213D").setFontColor("#FFFFFF");
    sh.setFrozenRows(1);
  }
  return sh;
}
function teamRows() {
  const sh = teamSheet();
  if (sh.getLastRow() < 2) return [];
  return sh
    .getRange(2, 1, sh.getLastRow() - 1, TEAM_COLS.length)
    .getValues()
    .map((r, i) => {
      const o = { row: i + 2 };
      TEAM_COLS.forEach((c, j) => (o[c] = r[j]));
      return o;
    })
    .filter(o => o.Email);
}
const teamFind = email => teamRows().find(m => String(m.Email).toLowerCase() === email);
function teamSave(m) {
  teamSheet()
    .getRange(m.row, 1, 1, TEAM_COLS.length)
    .setValues([TEAM_COLS.map(c => (m[c] === undefined ? "" : m[c]))]);
}
function teamList() {
  return [{ email: OWNER.EMAIL, role: "Owner", status: "active" }].concat(
    teamRows().map(m => ({
      email: m.Email,
      role: m.Role,
      status: m.Status,
      added: iso(m.Added),
      joined: iso(m.Joined),
      note: String(m["Added by"] || "").indexOf("asked: ") === 0 ? String(m["Added by"]).slice(7) : ""
    }))
  );
}
const sha = t =>
  Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(t))
    .map(b => ("0" + (b & 255).toString(16)).slice(-2))
    .join("");
function teamAdd(who, email, role) {
  email = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(email)) return { error: "That doesn't look like an email address." };
  if (ownerEmails().indexOf(email) >= 0) return { error: "That's already the owner." };
  role = role === "Admin" ? "Admin" : "Viewer";
  const code = String(Math.floor(100000 + Math.random() * 900000));
  let m = teamFind(email);
  const now = new Date();
  const fields = { Email: email, Role: role, Status: "invited", Added: now, "Added by": who, Code: sha(code), "Code expires": new Date(now.getTime() + 7 * 864e5), Tries: 0, Joined: "" };
  if (m) {
    Object.assign(m, fields);
    teamSave(m);
  } else teamSheet().appendRow(TEAM_COLS.map(c => fields[c]));
  const link = OWNER.APP_URL + "owner.html";
  MailApp.sendEmail({
    to: email,
    replyTo: OWNER.EMAIL,
    subject: "You're invited to the ScamSense team",
    body: `You've been added to the ScamSense team as ${role}.\n\n1. Open ${link}\n2. Sign in with this email (${email}) using Outlook or Google.\n3. Enter this code: ${code}\n\nThe code works for 7 days.`,
    htmlBody: mailShell(
      `<div style="padding:22px"><div style="font-size:22px;font-weight:800;color:#111827">You're invited to the ScamSense team</div>
      <p style="font-size:16px;color:#111827;line-height:1.5">You've been added as <b>${role}</b>${role === "Viewer" ? " (you can see the dashboard, but not make changes)" : " (you can see everything and help customers)"}.</p>
      <p style="font-size:16px;color:#111827;line-height:1.5">1. Open the ScamSense team dashboard.<br>2. Sign in with <b>${esc(email)}</b> using Outlook or Google.<br>3. Enter this code:</p>
      <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#14213D;background:#ECEEF3;border-radius:12px;padding:14px;text-align:center">${code}</div>
      <p style="font-size:13px;color:#5F6673">The code works for 7 days. If you weren't expecting this, you can ignore this email.</p>
      <div style="text-align:center;margin-top:18px"><a href="${link}" style="display:inline-block;background:#14213D;color:#fff;text-decoration:none;font-weight:800;padding:13px 26px;border-radius:12px">Open the dashboard</a></div></div>`
    ),
    name: "ScamSense"
  });
  ownerLog(who, "Invited " + email + " as " + role, null);
  return { ok: true, done: "Invite sent to " + email, team: teamList() };
}
// Someone signed in to the Owner page (Google or Outlook already proved their email) asks to join.
function teamRequest(email, note) {
  if (!takeQuota("teamreq:" + email, 3)) return { error: "You already asked today. The owner will get back to you." };
  const now = new Date();
  teamSheet().appendRow(
    TEAM_COLS.map(c => ({ Email: email, Role: "", Status: "requested", Added: now, "Added by": "asked: " + cleanText(note, 200) })[c] || "")
  );
  const link = OWNER.APP_URL + "owner.html#team";
  ownerEmails()
    .slice(0, 5)
    .forEach(to =>
      acctMail(
        to,
        "Approve " + email + " for the ScamSense team?",
        `${email} signed in to the ScamSense team dashboard and asked for access.${note ? ' They wrote: "' + cleanText(note, 200) + '"' : ""} Open the Team tab to approve them as Admin or Viewer, or decline. They can't see anything until you approve.`,
        `<div style="text-align:center;margin-top:16px"><a href="${link}" style="display:inline-block;background:#14213D;color:#fff;text-decoration:none;font-weight:800;padding:13px 26px;border-radius:12px">Review the request</a></div>`
      )
    );
  ownerPush("Team request · " + email, "Wants access to the ScamSense dashboard. Tap to approve or decline.", "owner.html#team");
  ownerLog(email, "Asked to join the team", null);
  return { ok: false, pending: true, email, error: "Your request was sent. You'll get an email when the owner answers." };
}
function teamApprove(who, email, role) {
  email = String(email || "").trim().toLowerCase();
  const m = teamFind(email);
  if (!m || m.Status !== "requested") return { error: "There's no request from that email." };
  m.Role = role === "Admin" ? "Admin" : "Viewer";
  m.Status = "active";
  m.Joined = new Date();
  m["Added by"] = who;
  teamSave(m);
  acctMail(
    email,
    "You're on the ScamSense team",
    `The owner approved you as ${m.Role}. Open the dashboard and sign in with this email.`,
    `<div style="text-align:center;margin-top:16px"><a href="${OWNER.APP_URL}owner.html" style="display:inline-block;background:#14213D;color:#fff;text-decoration:none;font-weight:800;padding:13px 26px;border-radius:12px">Open the dashboard</a></div>`
  );
  ownerLog(who, "Approved " + email + " as " + m.Role, null);
  return { ok: true, done: "Approved " + email + " as " + m.Role, team: teamList() };
}
function teamDeny(who, email) {
  email = String(email || "").trim().toLowerCase();
  const m = teamFind(email);
  if (!m || m.Status !== "requested") return { error: "There's no request from that email." };
  teamSheet().deleteRow(m.row);
  acctMail(email, "About your ScamSense team request", "The owner didn't approve access to the ScamSense team dashboard this time. If you think this is a mistake, reply to this email.");
  ownerLog(who, "Declined " + email + "'s team request", null);
  return { ok: true, done: "Declined " + email, team: teamList() };
}
function teamRemove(who, email) {
  email = String(email || "").trim().toLowerCase();
  const m = teamFind(email);
  if (!m) return { error: "That person isn't on the team." };
  teamSheet().deleteRow(m.row);
  ownerLog(who, "Removed " + email + " from the team", null);
  return { ok: true, done: "Removed " + email, team: teamList() };
}
function teamJoin(m, code, who) {
  if (+m.Tries >= 5) return { error: "Too many wrong codes. Ask the owner to send a new invite." };
  if (new Date(m["Code expires"]).getTime() < Date.now()) return { error: "This code has expired. Ask the owner to send a new invite." };
  if (sha(String(code || "").replace(/\D/g, "")) !== m.Code) {
    m.Tries = (+m.Tries || 0) + 1;
    teamSave(m);
    return { ok: false, needCode: true, email: who, error: "That code didn't work. Please check it and try again." };
  }
  m.Status = "active";
  m.Code = "";
  m.Joined = new Date();
  teamSave(m);
  ownerLog(who, "Joined the team", null);
  return { ok: true, joined: true };
}

// One person's daily report, right now (used by the Owner dashboard).
function sendReportTo(u) {
  const ids = devicesOf(u);
  const since = Date.now() - 864e5;
  const mine = sheet("Activity")
    .getDataRange()
    .getValues()
    .slice(1)
    .filter(r => new Date(r[0]).getTime() >= since && ids.indexOf(r[1]) >= 0);
  MailApp.sendEmail({
    replyTo: OWNER.EMAIL,
    to: u.Email,
    subject: reportSubject(mine),
    htmlBody: userReportHTML(u, mine),
    body: `Your ScamSense report: ${mine.length} things happened in the last day. Open ScamSense: ${OWNER.APP_URL}`,
    name: "ScamSense Daily Report"
  });
}

// Runs every morning: one report per user who has an email and reports turned on.
function sendAllReports() {
  markQuietUsers();
  const users = sheet("Users").getDataRange().getValues();
  const head = users.shift();
  const since = Date.now() - 864e5;
  const act = sheet("Activity")
    .getDataRange()
    .getValues()
    .slice(1)
    .filter(r => new Date(r[0]).getTime() >= since);
  users.forEach(v => {
    const u = {};
    head.forEach((c, i) => (u[c] = v[i]));
    if (!u.Email || u["Email verified"] !== "yes" || u["Daily report"] === "off" || isYes(u.Blocked)) return;
    const mine = act.filter(r => r[1] === u["User ID"]);
    try {
      MailApp.sendEmail({
        replyTo: OWNER.EMAIL,
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
  return scams
    ? `ScamSense: ${scams} scam${scams === 1 ? "" : "s"} caught — here's your report`
    : "ScamSense: all clear today";
}

function userReportHTML(u, rows) {
  const scans = rows.filter(r => r[3] === "Scanned email");
  const checks = rows.filter(r => r[3] === "Checked something");
  const pauses = rows.filter(r => r[3] === "Pause before you pay");
  const emails = scans.reduce((n, r) => n + (+String(r[5]).split(" ")[0] || 0), 0);
  const scams =
    scans.reduce((n, r) => n + (+String(r[5]).split(",")[1].trim().split(" ")[0] || 0), 0) +
    checks.filter(r => r[5] === "scam").length;
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
  const head = scams
    ? `${scams} scam${scams === 1 ? "" : "s"} caught. Don't open ${scams === 1 ? "it" : "them"}.`
    : "All clear. No scams found.";
  return mailShell(
    `<div style="padding:22px">
      <div style="font-size:15px;color:#5F6673">Good morning${u["First name"] ? ", " + esc(u["First name"]) : ""}</div>
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
function mailShell(inner, footer) {
  return `<!doctype html><html><body style="margin:0;background:#F5F5F2;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:18px 10px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #E3E5EA">
<tr><td style="background:#14213D;padding:16px 22px;font-size:19px;font-weight:800;color:#fff">&#129417; ScamSense</td></tr>
<tr><td>${inner}</td></tr></table>
<div style="font-size:12px;color:#5F6673;margin-top:12px">${footer || "You get this because you use ScamSense. Turn emails off in ScamSense › Settings › Your account."}</div>
</td></tr></table></body></html>`;
}

/* ========================================================================
   9. OWNER — blocking, welcome email, quiet users, weekly summary
   ======================================================================== */

const isYes = v => /^\s*(yes|y|true|blocked)\s*$/i.test(String(v || ""));
const BLOCKED = {
  blocked: true,
  error: "ScamSense is turned off for this account. Please contact the ScamSense team."
};
function isBlocked(uid) {
  if (!okUid(uid)) return false;
  try {
    const u = findUser(uid);
    return !!(u && isYes(u.Blocked));
  } catch (e) {
    return false;
  }
}

// Sent once, when someone's email is first confirmed.
function sendWelcome(u) {
  try {
    MailApp.sendEmail({
      replyTo: OWNER.EMAIL,
      to: u.Email,
      subject: "Welcome to ScamSense",
      body: `Welcome to ScamSense${u["First name"] ? ", " + u["First name"] : ""}! Open the app: ${OWNER.APP_URL}`,
      htmlBody: mailShell(`<div style="padding:22px">
        <div style="font-size:24px;font-weight:800;color:#111827">Welcome${u["First name"] ? ", " + esc(u["First name"]) : ""}!</div>
        <p style="font-size:16px;line-height:1.55;color:#111827">ScamSense is now watching out for you. Here's how it helps:</p>
        <ol style="font-size:15px;line-height:1.6;color:#111827;padding-left:20px">
          <li><b>Check something:</b> paste or say any text, email, call, or link, and ScamSense tells you if it's a scam.</li>
          <li><b>Someone wants my money:</b> check before you pay anyone.</li>
          <li><b>I was scammed:</b> step-by-step help, right away.</li>
          <li><b>Every morning</b> you'll get a short report like this one.</li>
        </ol>
        <p style="font-size:15px;line-height:1.55;color:#111827">Add a family member in <b>Family</b>, so they can help if something goes wrong.</p>
        <p style="font-size:15px;line-height:1.55;color:#111827">Questions? Just reply to this email.</p>
        <div style="text-align:center;margin-top:18px"><a href="${OWNER.APP_URL}" style="display:inline-block;background:#14213D;color:#fff;text-decoration:none;font-weight:800;padding:13px 26px;border-radius:12px">Open ScamSense</a></div>
      </div>`),
      name: "ScamSense"
    });
  } catch (e) {}
}

// Marks people who haven't used ScamSense for 7 days, so you can check on them.
function markQuietUsers() {
  const sh = sheet("Users");
  const rows = sh.getDataRange().getValues();
  const head = rows[0];
  const la = head.indexOf("Last active"),
    st = head.indexOf("Status");
  if (la < 0 || st < 0 || rows.length < 2) return;
  const cutoff = Date.now() - 7 * 864e5;
  const out = rows.slice(1).map(r => {
    const t = new Date(r[la]).getTime();
    return [t && t < cutoff ? "quiet 7+ days" : "active"];
  });
  sh.getRange(2, st + 1, out.length, 1).setValues(out);
}

// Every Monday: one email to you with the week at a glance.
function sendOwnerWeekly() {
  markQuietUsers();
  const owner = OWNER.EMAIL || Session.getEffectiveUser().getEmail();
  const since = Date.now() - 7 * 864e5;
  const users = sheet("Users").getDataRange().getValues();
  const head = users.shift();
  const col = c => head.indexOf(c);
  const act = sheet("Activity")
    .getDataRange()
    .getValues()
    .slice(1)
    .filter(r => new Date(r[0]).getTime() >= since);
  const alerts = sheet("Alerts")
    .getDataRange()
    .getValues()
    .slice(1)
    .filter(r => new Date(r[0]).getTime() >= since);
  const name = r =>
    [r[col("First name")], r[col("Last name")]].filter(Boolean).join(" ") || r[col("Email")] || "(no name)";
  const newUsers = users.filter(r => new Date(r[col("First seen")]).getTime() >= since);
  const active = { size: users.filter(r => new Date(r[col("Last active")]).getTime() >= since).length };
  const quiet = users.filter(r => r[col("Status")] === "quiet 7+ days");
  const follow = users.filter(r => r[col("Follow-up")] === "needs follow-up");
  const scams = act.reduce(
    (n, r) =>
      n +
      (r[3] === "Scanned email"
        ? +String(r[5]).split(",")[1].trim().split(" ")[0] || 0
        : r[3] === "Checked something" && r[5] === "scam"
          ? 1
          : 0),
    0
  );
  const tile = (label, val, color) =>
    `<td width="25%" style="padding:4px"><div style="background:#fff;border:1px solid #E3E5EA;border-radius:12px;padding:10px"><div style="font-size:10px;font-weight:800;color:#5F6673;text-transform:uppercase">${label}</div><div style="font-size:24px;font-weight:800;color:${color || "#111827"}">${val}</div></div></td>`;
  const list = (title, rows, f) =>
    rows.length
      ? `<div style="font-size:14px;font-weight:800;color:#111827;margin-top:18px">${title}</div><ul style="padding-left:18px;font-size:14px;line-height:1.5;color:#111827;margin:6px 0">${rows
          .slice(0, 15)
          .map(r => `<li>${esc(f(r))}</li>`)
          .join("")}</ul>`
      : "";
  MailApp.sendEmail({
    replyTo: OWNER.EMAIL,
    to: owner,
    subject: `ScamSense weekly: ${users.length} ${users.length === 1 ? "user" : "users"}, ${active.size} active, ${scams} ${scams === 1 ? "scam" : "scams"} caught`,
    body: `Users: ${users.length}. New this week: ${newUsers.length}. Active: ${active.size}. Scams caught: ${scams}. Alerts: ${alerts.length}. Dashboard: ${getDb().getUrl()}`,
    htmlBody: mailShell(
      `<div style="padding:22px">
      <div style="font-size:15px;color:#5F6673">Your week at a glance</div>
      <div style="font-size:24px;font-weight:800;color:#111827;margin-top:4px">${active.size} of ${users.length} ${users.length === 1 ? "person" : "people"} used ScamSense this week</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;table-layout:fixed"><tr>${tile("Users", users.length)}${tile("New", newUsers.length)}${tile("Scams caught", scams, scams ? "#B42318" : "")}${tile("Alerts", alerts.length, alerts.length ? "#B42318" : "")}</tr></table>
      ${list("Needs follow-up", follow, r => `${name(r)} — ${r[col("Email")] || ""}`)}
      ${list("New this week", newUsers, r => `${name(r)} — ${r[col("Email")] || "no email yet"}`)}
      ${list("Quiet for 7+ days", quiet, r => `${name(r)} — last active ${Utilities.formatDate(new Date(r[col("Last active")]), Session.getScriptTimeZone(), "MMM d")}`)}
      <div style="text-align:center;margin-top:20px"><a href="${getDb().getUrl()}" style="display:inline-block;background:#14213D;color:#fff;text-decoration:none;font-weight:800;padding:12px 24px;border-radius:12px">Open the dashboard</a></div>
    </div>`,
      "Only you get this summary, because you run ScamSense. It comes every Monday."
    ),
    name: "ScamSense Owner"
  });
}
// For testing: sends this week's summary to you now.
function sendWeeklyNow() {
  sendOwnerWeekly();
}

/* ========================================================================
   10. DOMAIN AGE — how long ago a web address was registered
   Scammers use brand-new addresses; real companies have had theirs for years.
   Uses the public RDAP registry (rdap.org). Results are remembered for 6 hours.
   ======================================================================== */

function domainAges(list) {
  const out = {};
  const cache = CacheService.getScriptCache();
  [].concat(list || [])
    .map(d => String(d || "").toLowerCase().replace(/[^a-z0-9.-]/g, ""))
    .filter(d => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d))
    .slice(0, 12)
    .forEach(d => {
      const hit = cache.get("age:" + d);
      if (hit !== null) {
        out[d] = hit === "" ? null : +hit;
        return;
      }
      let age = null;
      try {
        const r = UrlFetchApp.fetch("https://rdap.org/domain/" + d, { muteHttpExceptions: true, followRedirects: true });
        if (r.getResponseCode() === 200) {
          const ev = (JSON.parse(r.getContentText()).events || []).find(e => e.eventAction === "registration");
          if (ev && ev.eventDate) age = Math.floor((Date.now() - Date.parse(ev.eventDate)) / 864e5);
        }
      } catch (e) {}
      cache.put("age:" + d, age === null ? "" : String(age), 21600);
      out[d] = age;
    });
  return out;
}


/* ========================================================================
   11. SUPPORT — live help between a person and the ScamSense team
   A "case" is one conversation. The person writes from the app (Talk to the ScamSense team);
   the team answers from the Owner page. Messages live in the Owner Dashboard spreadsheet
   ("Cases" and "Messages" tabs); photos live in a private Google Drive folder.
   A case opens by itself when someone says they were scammed or already paid.
   Team notes ("note") and shared emails are kept with the case, so every step is on record.
   Run setupSupport once after pasting this code (it asks for Google Drive permission).
   ======================================================================== */

const SUPPORT = {
  MAX_MESSAGES_PER_DAY: 120, // per person
  MAX_PHOTOS_PER_DAY: 20, // per person
  MAX_NEW_CASES_PER_DAY: 5, // per person
  PHOTO_MAX_BYTES: 4000000,
  TEAM_EMAIL_EVERY_MIN: 10, // at most one "new message" email per case this often (new cases always email)
  PERSON_EMAIL_EVERY_MIN: 20 // at most one "the team answered" email to the person this often
};
const CASE_COLS = [
  "Case ID",
  "Opened",
  "User ID",
  "Name",
  "Email",
  "Reason",
  "Priority",
  "Status", // new, open, waiting (for the person), closed
  "Last update",
  "Last message",
  "Team unread",
  "Person unread",
  "Closed",
  "Outcome"
];
const MSG_COLS = ["Time", "Case ID", "From", "Who", "Text", "Photo", "Email"];
const REASONS = {
  person: "Asked to talk to a person",
  scammed: "Said they were scammed",
  paid: "Said they already paid someone who may be a scammer",
  stop: "Was about to pay a scammer",
  email: "Shared an email for help",
  other: "Needs help"
};
const URGENT_REASONS = ["scammed", "paid", "stop"];
const QUICK_DEFAULT = [
  [
    "Hello",
    "Hi, this is the ScamSense team. I'm here to help. Can you tell me what happened, in your own words?"
  ],
  [
    "Don't pay, don't reply",
    "Please don't pay anything, don't click any links, and don't reply to them. Real companies and the government never rush you or ask for gift cards, crypto, or wire transfers."
  ],
  [
    "Call your bank now",
    "If you sent money or shared card details, please call your bank now. Use the number on the back of your card, not a number from the message. Ask them to stop the payment and to watch your account."
  ],
  [
    "Change your password",
    "Please change your password for that account now, and turn on 2-step verification. If you used the same password anywhere else, change it there too."
  ],
  [
    "Send a screenshot",
    "Can you send me a screenshot or a photo of the message? Tap the photo button next to the message box."
  ],
  [
    "Report to the FTC",
    "Please report it to the FTC at ReportFraud.ftc.gov. It's free and takes about 10 minutes. ScamSense's \"I was scammed\" page can fill in most of it for you."
  ],
  [
    "Gift cards",
    "If you paid with gift cards, call the number on the back of each card right away and tell them it was a scam. Keep the cards and the receipts."
  ],
  [
    "Freeze your credit",
    "To be safe, you can freeze your credit for free at Equifax, Experian, and TransUnion. It stops anyone from opening new accounts in your name."
  ],
  ["It's safe", "Good news: I checked it and it's real, not a scam. You can go ahead."],
  [
    "Closing",
    "I'm glad we could help. If anything else comes up, just write here anytime. Stay safe!"
  ]
];

// Run once: makes the Cases, Messages, and Quick replies tabs and the private photo folder.
function setupSupport() {
  casesSheet();
  msgsSheet();
  quickSheet();
  console.log("Support is ready. Photo folder: " + photoFolder().getUrl());
}
function supportSheet(name, cols) {
  const db = getDb();
  let sh = db.getSheetByName(name);
  if (!sh) {
    sh = db.insertSheet(name);
    sh.appendRow(cols);
    sh.getRange(1, 1, 1, cols.length).setFontWeight("bold").setBackground("#14213D").setFontColor("#FFFFFF");
    sh.setFrozenRows(1);
  }
  return sh;
}
const casesSheet = () => supportSheet("Cases", CASE_COLS);
const msgsSheet = () => supportSheet("Messages", MSG_COLS);
function quickSheet() {
  const sh = supportSheet("Quick replies", ["Title", "Message"]);
  if (sh.getLastRow() < 2) sh.getRange(2, 1, QUICK_DEFAULT.length, 2).setValues(QUICK_DEFAULT);
  return sh;
}
function photoFolder() {
  const p = PropertiesService.getScriptProperties();
  const id = p.getProperty("SUPPORT_FOLDER");
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (e) {}
  }
  const f = DriveApp.createFolder("ScamSense Support Photos (private)");
  p.setProperty("SUPPORT_FOLDER", f.getId());
  return f;
}

function allCases() {
  const sh = casesSheet();
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh
    .getRange(2, 1, n, CASE_COLS.length)
    .getValues()
    .map((r, i) => {
      const c = { row: i + 2 };
      CASE_COLS.forEach((k, j) => (c[k] = r[j]));
      return c;
    });
}
function saveCase(c) {
  casesSheet()
    .getRange(c.row, 1, 1, CASE_COLS.length)
    .setValues([CASE_COLS.map(k => (c[k] === undefined ? "" : c[k]))]);
}
const caseById = id => allCases().find(c => c["Case ID"] === id);
const casesOf = key => allCases().filter(c => c["User ID"] === key);
const openCaseOf = key =>
  casesOf(key)
    .reverse()
    .find(c => c.Status !== "closed");

function caseMessages(id, withNotes) {
  const sh = msgsSheet();
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh
    .getRange(2, 1, n, MSG_COLS.length)
    .getValues()
    .filter(r => r[1] === id && (withNotes || r[2] !== "note"))
    .map(r => {
      let email = null;
      try {
        email = r[6] ? JSON.parse(r[6]) : null;
      } catch (e) {}
      return { t: iso(r[0]), from: r[2], who: r[3], text: r[4], photo: r[5], email };
    });
}

function newCase(key, u, reason, name) {
  const c = {
    "Case ID":
      "C" + Utilities.formatDate(new Date(), "UTC", "yyMMdd") + "-" + Utilities.getUuid().slice(0, 4).toUpperCase(),
    Opened: new Date(),
    "User ID": key,
    Name: (u && fullName(u)) || cleanText(name, 60) || "Someone (not signed in)",
    Email: (u && u.Email) || "",
    Reason: REASONS[reason] || REASONS.other,
    Priority: URGENT_REASONS.indexOf(reason) >= 0 ? "urgent" : "normal",
    Status: "new",
    "Team unread": 0,
    "Person unread": 0
  };
  const sh = casesSheet();
  sh.appendRow(CASE_COLS.map(k => (c[k] === undefined ? "" : c[k])));
  c.row = sh.getLastRow();
  return c;
}

// Adds one message. from: user | owner | system | note | email
function addMessage(c, from, who, text, photo, email) {
  msgsSheet().appendRow([
    new Date(),
    c["Case ID"],
    from,
    who || "",
    String(text || "").slice(0, 4000),
    photo || "",
    email ? JSON.stringify(email) : ""
  ]);
  c["Last update"] = new Date();
  if (from !== "note")
    c["Last message"] =
      (from === "owner" ? "Team: " : "") +
      (text ? String(text).slice(0, 140) : photo ? "(photo)" : email ? "(shared an email: " + email.subject + ")" : "");
  if (from === "user" || from === "email") c["Team unread"] = (+c["Team unread"] || 0) + 1;
  if (from === "owner") c["Person unread"] = (+c["Person unread"] || 0) + 1;
  saveCase(c);
}

function savePhoto(c, dataUrl) {
  const m = /^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!m) return { error: "That photo couldn't be read. Please try another one." };
  const bytes = Utilities.base64Decode(m[3]);
  if (bytes.length > SUPPORT.PHOTO_MAX_BYTES) return { error: "That photo is too big. Please try a smaller one." };
  const ext = m[2] === "jpeg" ? "jpg" : m[2];
  const f = photoFolder().createFile(
    Utilities.newBlob(bytes, m[1], c["Case ID"] + "-" + Date.now() + "." + ext)
  );
  return { id: f.getId() };
}
function photoData(id) {
  const b = DriveApp.getFileById(id).getBlob();
  return "data:" + b.getContentType() + ";base64," + Utilities.base64Encode(b.getBytes());
}
// Which case a photo belongs to (so people can only see photos from their own case).
function caseOfPhoto(id) {
  const sh = msgsSheet();
  const n = sh.getLastRow() - 1;
  if (n < 1 || !/^[A-Za-z0-9_-]{10,80}$/.test(String(id || ""))) return "";
  const r = sh
    .getRange(2, 1, n, MSG_COLS.length)
    .getValues()
    .find(x => x[5] === id);
  return r ? r[1] : "";
}

function cleanSharedEmail(e) {
  if (!e || typeof e !== "object") return null;
  const o = {
    from: cleanText(e.from, 200),
    subject: cleanText(e.subject, 300),
    date: cleanText(e.date, 60),
    verdict: cleanText(e.verdict, 40),
    reasons: [].concat(e.reasons || []).slice(0, 6).map(x => cleanText(x, 300)),
    text: String(e.text || "").replace(/\u0000/g, "").slice(0, 8000)
  };
  return o.subject || o.text ? o : null;
}
const pubCase = c => ({
  id: c["Case ID"],
  status: c.Status,
  opened: iso(c.Opened),
  reason: c.Reason,
  priority: c.Priority
});
// What the person sees: the team's name is "ScamSense team", and team-only notes are never sent.
const pubMsg = m => ({
  t: m.t,
  from: m.from,
  who: m.from === "owner" ? "ScamSense team" : "",
  text: m.text,
  photo: m.photo,
  email: m.email
});

/* ----- the person's side (from the app) ----- */
function supportApi(req) {
  if (!okUid(req.uid)) return { error: "bad id" };
  const u = findUser(req.uid);
  const key = u ? u["User ID"] : req.uid;
  if (u && key !== req.uid) linkCases(req.uid, u);
  const a = String(req.action || "poll");
  if (a === "poll") return supportPoll(key);
  if (a === "photo") {
    const cid = caseOfPhoto(req.id);
    const c = cid && caseById(cid);
    if (!c || c["User ID"] !== key) return { error: "That photo isn't available." };
    return { ok: true, data: photoData(req.id) };
  }
  // The person's own case numbers, newest first (for "Your past cases").
  if (a === "history")
    return {
      ok: true,
      cases: casesOf(key)
        .reverse()
        .slice(0, 30)
        .map(pubCase)
    };
  // Look at one of their own cases by its number.
  if (a === "view") return supportPoll(key, String(req.caseId || ""));
  // The person ends the chat (the case closes; they keep the case number).
  if (a === "end") {
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      const c = openCaseOf(key);
      if (c) {
        c.Status = "closed";
        c.Closed = new Date();
        c.Outcome = c.Outcome || "Ended by the person";
        c["Team unread"] = 0;
        addMessage(c, "system", "", "The person ended the chat.");
      }
    } finally {
      lock.releaseLock();
    }
    return supportPoll(key);
  }
  // The person comes back to an old case: it opens again, with all its history.
  if (a === "reopen") {
    const c = caseById(String(req.caseId || ""));
    if (!c || c["User ID"] !== key) return { error: "That case number isn't one of yours." };
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      const open = openCaseOf(key);
      if (open && open["Case ID"] !== c["Case ID"]) {
        open.Status = "closed";
        open.Closed = new Date();
        open.Outcome = open.Outcome || "Moved to case " + c["Case ID"];
        addMessage(open, "system", "", "The person went back to case " + c["Case ID"] + ".");
      }
      if (c.Status === "closed") {
        c.Status = "open";
        c.Closed = "";
        addMessage(c, "system", "", "The person came back to this case.");
      }
    } finally {
      lock.releaseLock();
    }
    notifyTeam(c, false, c.Name + " came back to case " + c["Case ID"]);
    return supportPoll(key, c["Case ID"]);
  }
  if (a !== "send" && a !== "open") return { error: "Unknown action." };
  const text = String(req.text || "").slice(0, 4000).trim();
  const email = cleanSharedEmail(req.email);
  if (!text && !req.photo && !email && a === "send") return { error: "Write a message first." };
  if (!takeQuota("sup:" + key, SUPPORT.MAX_MESSAGES_PER_DAY))
    return { error: "You've sent a lot of messages today. The team will read them and answer soon." };
  if (req.photo && !takeQuota("supph:" + key, SUPPORT.MAX_PHOTOS_PER_DAY))
    return { error: "That's the most photos for today. Please describe it in words, or try again tomorrow." };
  const reason = REASONS[req.reason] ? req.reason : email ? "email" : "person";
  let c,
    isNew = false;
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    c = openCaseOf(key);
    if (!c) {
      if (!takeQuota("supopen:" + key, SUPPORT.MAX_NEW_CASES_PER_DAY))
        return { error: "Please write in your open conversation." };
      c = newCase(key, u, reason, [req.name, req.lastName].join(" "));
      isNew = true;
      addMessage(c, "system", "", REASONS[reason]);
    } else if (URGENT_REASONS.indexOf(reason) >= 0 && c.Priority !== "urgent") {
      c.Priority = "urgent";
      addMessage(c, "system", "", REASONS[reason]);
    }
    // A case that started before we knew who this is gets their real name as soon as we do.
    const known = (u && fullName(u)) || cleanText([req.name, req.lastName].join(" "), 60);
    if (known && (!c.Name || c.Name === "Someone (not signed in)")) {
      c.Name = known;
      if (u && u.Email) c.Email = u.Email;
      saveCase(c);
    }
    if (c.Status === "waiting") c.Status = "open";
    let photo = "";
    if (req.photo) {
      const p = savePhoto(c, req.photo);
      if (p.error) return p;
      photo = p.id;
    }
    if (email) addMessage(c, "email", c.Name, "", "", email);
    if (text || photo) addMessage(c, "user", c.Name, text, photo);
  } finally {
    lock.releaseLock();
  }
  notifyTeam(c, isNew, text || (email ? "Shared an email: " + email.subject : photo ? "Sent a photo" : c.Reason));
  return supportPoll(key);
}
// Cases this phone started before it was linked to the person's account move onto that person.
function linkCases(deviceId, u) {
  allCases()
    .filter(c => c["User ID"] === deviceId)
    .forEach(c => {
      c["User ID"] = u["User ID"];
      if (!c.Name || c.Name === "Someone (not signed in)") c.Name = fullName(u) || c.Name;
      if (!c.Email) c.Email = u.Email || "";
      saveCase(c);
    });
}
function supportPoll(key, caseId) {
  const list = casesOf(key);
  const c = caseId
    ? list.find(x => x["Case ID"] === caseId)
    : list.reverse().find(x => x.Status !== "closed") || list[0];
  if (caseId && !c) return { error: "That case number isn't one of yours." };
  if (!c) return { ok: true, case: null, messages: [] };
  if (+c["Person unread"]) {
    c["Person unread"] = 0;
    saveCase(c);
  }
  return { ok: true, case: pubCase(c), messages: caseMessages(c["Case ID"], false).map(pubMsg) };
}

// A danger event (scammed, already paid, about to pay) opens an urgent case by itself.
function supportFromDanger(u, kind) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  let c,
    isNew = false;
  try {
    const key = u["User ID"];
    c = openCaseOf(key);
    if (!c) {
      c = newCase(key, u, kind);
      isNew = true;
    }
    c.Priority = "urgent";
    if (c.Status === "waiting") c.Status = "open";
    addMessage(c, "system", "", REASONS[kind] + " (ScamSense opened this case by itself)");
  } finally {
    lock.releaseLock();
  }
  notifyTeam(c, isNew, REASONS[kind], { noEmail: true }); // the danger alert email already went out
}

/* ----- telling people ----- */
function notifyTeam(c, isNew, preview, opt) {
  opt = opt || {};
  const cache = CacheService.getScriptCache();
  // Phone alerts first: every new case and message (at most one every 20 seconds per case).
  let pushed = 0;
  const kp = "suppush:" + c["Case ID"];
  if (isNew || !cache.get(kp)) {
    cache.put(kp, "1", 20);
    try {
      pushed = pushTeam();
    } catch (e) {
      console.log("Phone alert error: " + e);
    }
  }
  // Email only when no phone has alerts on (so you don't get both).
  if (pushed) return;
  const k = "supnote:" + c["Case ID"];
  if (!isNew && cache.get(k)) return;
  cache.put(k, "1", SUPPORT.TEAM_EMAIL_EVERY_MIN * 60);
  const urgent = c.Priority === "urgent";
  const link = OWNER.APP_URL + "owner.html#case/" + encodeURIComponent(c["Case ID"]);
  const subject = (urgent ? "URGENT: " : "") + (isNew ? "New case: " : "New message: ") + c.Name + " — " + c.Reason;
  if (!opt.noEmail)
    ownerEmails()
      .slice(0, 5)
      .forEach(to => {
        try {
          MailApp.sendEmail({
            to,
            subject,
            body: `${c.Name}: ${preview}\n\nOpen the case: ${link}`,
            htmlBody: mailShell(
              `<div style="border-top:6px solid ${urgent ? "#B42318" : "#14213D"};padding:22px">
                <div style="font-size:20px;font-weight:800;color:#111827">${esc(c.Name)}${urgent ? " may be in danger" : " needs help"}</div>
                <p style="font-size:15px;color:#5F6673;margin:6px 0 14px">${esc(c.Reason)} · case ${esc(c["Case ID"])}</p>
                <div style="background:#F4F5F8;border-radius:12px;padding:14px 16px;font-size:16px;line-height:1.5;color:#111827;white-space:pre-wrap">${esc(preview)}</div>
                <div style="text-align:center;margin-top:18px"><a href="${link}" style="display:inline-block;background:#14213D;color:#fff;text-decoration:none;font-weight:800;padding:13px 26px;border-radius:12px">Open the case</a></div>
              </div>`,
              "You get this because you're on the ScamSense team."
            ),
            name: "ScamSense Cases"
          });
        } catch (e) {}
      });
  if (isNew || urgent) textOwner((urgent ? "URGENT " : "") + "ScamSense: " + c.Name + " — " + c.Reason + ". " + link);
}
// A text to the owner's phone, when Script Properties OWNER_PHONE and TWILIO_FROM (a Twilio number) are set.
function textOwner(msg) {
  const p = PropertiesService.getScriptProperties();
  const to = usPhone(p.getProperty("OWNER_PHONE")),
    from = p.getProperty("TWILIO_FROM"),
    sid = p.getProperty("TWILIO_ACCOUNT_SID"),
    tok = p.getProperty("TWILIO_AUTH_TOKEN");
  if (!to || !from || !sid || !tok) return;
  try {
    const r = UrlFetchApp.fetch("https://api.twilio.com/2010-04-01/Accounts/" + sid + "/Messages.json", {
      method: "post",
      payload: { To: to, From: from, Body: msg.slice(0, 300) },
      headers: { Authorization: "Basic " + Utilities.base64Encode(sid + ":" + tok) },
      muteHttpExceptions: true
    });
    if (r.getResponseCode() < 300) bump("SMS");
    else console.log("Owner text failed: " + r.getContentText().slice(0, 200));
  } catch (e) {}
}
function notifyPerson(c, preview) {
  if (!c.Email) return;
  const u = findUser(c["User ID"]);
  if (!u || u["Email verified"] !== "yes") return;
  const cache = CacheService.getScriptCache();
  const k = "supperson:" + c["Case ID"];
  if (cache.get(k)) return;
  cache.put(k, "1", SUPPORT.PERSON_EMAIL_EVERY_MIN * 60);
  const link = OWNER.APP_URL + "#support";
  try {
    MailApp.sendEmail({
      to: u.Email,
      replyTo: OWNER.EMAIL,
      subject: "The ScamSense team answered you",
      body: `${preview}\n\nOpen ScamSense to answer: ${link}`,
      htmlBody: mailShell(
        `<div style="padding:22px">
          <div style="font-size:20px;font-weight:800;color:#111827">The ScamSense team answered you</div>
          <div style="background:#F4F5F8;border-radius:12px;padding:14px 16px;margin-top:12px;font-size:16px;line-height:1.5;color:#111827;white-space:pre-wrap">${esc(preview)}</div>
          <div style="text-align:center;margin-top:18px"><a href="${link}" style="display:inline-block;background:#14213D;color:#fff;text-decoration:none;font-weight:800;padding:13px 26px;border-radius:12px">Open ScamSense to answer</a></div>
        </div>`
      ),
      name: "ScamSense"
    });
  } catch (e) {}
}

/* ----- the team's side (from the Owner page) ----- */
function supportCounts() {
  const open = allCases().filter(c => c.Status !== "closed");
  return {
    open: open.length,
    unread: open.filter(c => +c["Team unread"] > 0).length,
    urgent: open.filter(c => c.Priority === "urgent").length
  };
}
function ownerSupport(who, role, req) {
  const a = req.action;
  if (a === "cases") {
    allCases()
      .filter(c => !c.Name || c.Name === "Someone (not signed in)")
      .forEach(c => {
        const u = findUser(c["User ID"]);
        if (u && fullName(u)) {
          c.Name = fullName(u);
          c.Email = c.Email || u.Email || "";
          saveCase(c);
        }
      });
    return {
      ok: true,
      cases: allCases()
        .reverse()
        .slice(0, 400)
        .map(c => {
          const o = {};
          CASE_COLS.forEach(k => (o[k] = iso(c[k])));
          return o;
        }),
      counts: supportCounts()
    };
  }
  if (a === "quick_list") return { ok: true, quick: quickList() };
  if (a === "case_photo") {
    if (!caseOfPhoto(req.id)) return { error: "That photo isn't available." };
    return { ok: true, data: photoData(req.id) };
  }
  const c = caseById(String(req.caseId || ""));
  if (!c) return { error: "Couldn't find that case." };
  if (a === "case") {
    if (+c["Team unread"] && role !== "viewer") {
      c["Team unread"] = 0;
      saveCase(c);
    }
    return caseView(c);
  }
  if (role === "viewer") return { error: "Viewers can read cases, but can't answer." };
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  let did = "";
  try {
    if (a === "reply") {
      const text = String(req.text || "").slice(0, 4000).trim();
      let photo = "";
      if (req.photo) {
        const p = savePhoto(c, req.photo);
        if (p.error) return p;
        photo = p.id;
      }
      if (!text && !photo) return { error: "Write a message first." };
      if (c.Status === "new") c.Status = "open";
      addMessage(c, "owner", who, text, photo);
      did = "Answered case " + c["Case ID"];
      notifyPerson(c, text || "The ScamSense team sent you a photo.");
    } else if (a === "case_note") {
      const text = String(req.text || "").slice(0, 4000).trim();
      if (!text) return { error: "Write the note first." };
      addMessage(c, "note", who, text);
      did = "Added a note to case " + c["Case ID"];
    } else if (a === "case_status") {
      const s = String(req.status || "");
      if (["open", "waiting", "closed"].indexOf(s) < 0) return { error: "Unknown status." };
      c.Status = s;
      if (s === "closed") {
        c.Closed = new Date();
        c.Outcome = cleanText(req.outcome, 500);
        c["Team unread"] = 0;
        addMessage(c, "note", who, "Closed the case" + (c.Outcome ? ": " + c.Outcome : ""));
        addMessage(
          c,
          "system",
          "",
          "The ScamSense team closed this conversation. If you need anything else, just write here."
        );
      } else {
        c.Closed = "";
        addMessage(c, "note", who, s === "waiting" ? "Waiting for the person to answer" : "Opened the case again");
      }
      did = "Case " + c["Case ID"] + ": " + s;
    } else if (a === "case_email") {
      const r = emailCase(c, req.to === "person" ? "person" : "me", who);
      if (r.error) return r;
      did = r.done;
    } else if (a === "case_priority") {
      c.Priority = req.priority === "urgent" ? "urgent" : "normal";
      addMessage(c, "note", who, "Marked " + c.Priority);
      did = "Case " + c["Case ID"] + ": " + c.Priority;
    } else return { error: "Unknown action." };
  } finally {
    lock.releaseLock();
  }
  ownerLog(who, did, findUser(c["User ID"]) || { "First name": c.Name, Email: c.Email });
  return Object.assign({ done: did }, caseView(caseById(c["Case ID"])));
}
// Emails the whole conversation. To the team: with team notes. To the person: without notes.
function emailCase(c, to, who) {
  const forPerson = to === "person";
  let addr = who;
  if (forPerson) {
    const u = findUser(c["User ID"]);
    if (!u || u["Email verified"] !== "yes" || !u.Email) return { error: "This person has no confirmed email." };
    addr = u.Email;
  }
  const msgs = caseMessages(c["Case ID"], !forPerson);
  const name1 = String(c.Name || "").split(" ")[0] || "Them";
  const rows = msgs
    .map(m => {
      const t = Utilities.formatDate(new Date(m.t), Session.getScriptTimeZone(), "MMM d, h:mm a");
      let who2 =
        m.from === "owner"
          ? "ScamSense team"
          : m.from === "note"
            ? "Team note"
            : m.from === "system"
              ? ""
              : forPerson
                ? "You"
                : name1;
      let body = esc(m.text || "");
      if (m.from === "email" && m.email)
        body = `<i>Shared an email</i><br>From: ${esc(m.email.from)}<br>Subject: ${esc(m.email.subject)}`;
      if (m.photo) body += (body ? "<br>" : "") + "<i>(photo)</i>";
      if (m.from === "system") return `<tr><td colspan="2" style="padding:6px 0;color:#5F6673;font-size:13px;text-align:center">${body} · ${t}</td></tr>`;
      return `<tr><td style="padding:8px 10px 8px 0;vertical-align:top;font-weight:700;color:${m.from === "note" ? "#9A5B00" : "#111827"};white-space:nowrap">${esc(who2)}<div style="font-weight:400;font-size:12px;color:#5F6673">${t}</div></td><td style="padding:8px 0;vertical-align:top;font-size:15px;line-height:1.5;white-space:pre-wrap;color:#111827">${body}</td></tr>`;
    })
    .join("");
  const head = forPerson ? "Your conversation with the ScamSense team" : "Case " + c["Case ID"] + ": " + c.Name;
  MailApp.sendEmail({
    to: addr,
    replyTo: OWNER.EMAIL,
    subject: (forPerson ? "Your ScamSense conversation, case " : "ScamSense case ") + c["Case ID"],
    body: msgs.map(m => (m.from === "owner" ? "ScamSense team" : m.from) + ": " + (m.text || "")).join("\n"),
    htmlBody: mailShell(
      `<div style="padding:22px">
        <div style="font-size:20px;font-weight:800;color:#111827">${esc(head)}</div>
        <p style="font-size:14px;color:#5F6673;margin:6px 0 14px">Case number <b>${esc(c["Case ID"])}</b> · ${esc(c.Reason)}${c.Outcome && !forPerson ? " · " + esc(c.Outcome) : ""}</p>
        <table style="width:100%;border-collapse:collapse">${rows}</table>
        ${forPerson ? `<p style="font-size:14px;color:#5F6673;margin-top:16px">If you need help with this again, open ScamSense and give us your case number: <b>${esc(c["Case ID"])}</b>.</p>` : ""}
      </div>`
    ),
    name: "ScamSense"
  });
  return { done: "Emailed case " + c["Case ID"] + (forPerson ? " to " + name1 : " to you") };
}
function caseView(c) {
  const o = {};
  CASE_COLS.forEach(k => (o[k] = iso(c[k])));
  const u = findUser(c["User ID"]);
  const person = u
    ? {
        uid: u["User ID"],
        name: fullName(u),
        email: u.Email || "",
        verified: u["Email verified"] === "yes",
        family: String(u["Trusted people"] || ""),
        language: u.Language || "",
        lastActive: iso(u["Last active"]),
        scams: +u["Scams caught"] || 0,
        dob: dobText(u["Date of birth"]),
        place: [u.State, String(u.ZIP || "").replace(/^'/, ""), u.Country].filter(Boolean).join(" ")
      }
    : null;
  const others = casesOf(c["User ID"])
    .filter(x => x["Case ID"] !== c["Case ID"])
    .map(x => ({ id: x["Case ID"], opened: iso(x.Opened), reason: x.Reason, status: x.Status }));
  return { ok: true, case: o, messages: caseMessages(c["Case ID"], true), person, others };
}
function quickList() {
  const sh = quickSheet();
  return sh
    .getRange(2, 1, sh.getLastRow() - 1, 2)
    .getValues()
    .filter(r => r[0] && r[1])
    .map(r => ({ title: String(r[0]), text: String(r[1]) }));
}
function quickSave(list) {
  const rows = []
    .concat(list || [])
    .slice(0, 40)
    .map(q => [cleanText(q.title, 60), String(q.text || "").slice(0, 2000).trim()])
    .filter(r => r[0] && r[1]);
  if (!rows.length) return { error: "Add at least one quick reply." };
  const sh = quickSheet();
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).clearContent();
  sh.getRange(2, 1, rows.length, 2).setValues(rows);
  return { ok: true, quick: quickList(), done: "Saved quick replies" };
}

/* ========================================================================
   12. PHONE ALERTS — push notifications to the Owner app
   The team taps "Turn on phone alerts" in the Owner app (on iPhone: from the home-screen app).
   When a case comes in, the server "taps" each phone through Apple's or Google's push service
   (no message inside). The phone then asks this server, with its own secret device key, what's new,
   and shows "URGENT · Maria — Said they were scammed". Tapping it opens the case.
   Web Push needs an ES256 signature; Apps Script has no built-in one, so the P-256 math is below.
   Run setupPush once (or it sets itself up the first time someone turns alerts on).
   ======================================================================== */

const PUSH_COLS = ["Email", "Device key", "Endpoint", "Added", "Last alert", "Device"];
const pushSheet = () => supportSheet("Phone alerts", PUSH_COLS);

function setupPush() {
  const k = vapidKeys();
  pushSheet();
  console.log("Phone alerts are ready. Public key: " + k.pub);
}

/* ----- P-256 math (only for signing; keys never leave Script Properties) ----- */
// Big numbers are written as BigInt(1) instead of 1n so the Apps Script editor can read the file.
const B0 = BigInt(0),
  B1 = BigInt(1),
  B2 = BigInt(2),
  B3 = BigInt(3);
const P256 = {
  p: BigInt("0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff"),
  n: BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551"),
  G: [
    BigInt("0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296"),
    BigInt("0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5")
  ]
};
const u8 = b => Array.prototype.map.call(b, x => x & 255);
const s8 = b => b.map(x => (x > 127 ? x - 256 : x));
const bigOf = b => BigInt("0x" + (u8(b).map(x => x.toString(16).padStart(2, "0")).join("") || "0"));
function bytesOf(x, len) {
  const h = x.toString(16).padStart(len * 2, "0");
  const out = [];
  for (let i = 0; i < len; i++) out.push(parseInt(h.substr(i * 2, 2), 16));
  return out;
}
const b64u = bytes => Utilities.base64EncodeWebSafe(s8(bytes)).replace(/=+$/, "");
const strBytes = s => u8(Utilities.newBlob(s).getBytes());
const sha256 = b => u8(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s8(b)));
const hmac256 = (key, msg) =>
  u8(Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_256, s8(msg), s8(key)));
const modp = a => {
  a %= P256.p;
  return a < B0 ? a + P256.p : a;
};
function inv(a, m) {
  let r0 = ((a % m) + m) % m,
    r1 = m,
    s0 = B1,
    s1 = B0;
  while (r1) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
  }
  return ((s0 % m) + m) % m;
}
function ecAdd(P, Q) {
  if (!P) return Q;
  if (!Q) return P;
  let l;
  if (P[0] === Q[0]) {
    if (modp(P[1] + Q[1]) === B0) return null;
    l = modp((B3 * P[0] * P[0] - B3) * inv(B2 * P[1], P256.p));
  } else l = modp((Q[1] - P[1]) * inv(Q[0] - P[0], P256.p));
  const x = modp(l * l - P[0] - Q[0]);
  return [x, modp(l * (P[0] - x) - P[1])];
}
function ecMul(k, P) {
  let R = null,
    A = P;
  while (k > B0) {
    if (k & B1) R = ecAdd(R, A);
    A = ecAdd(A, A);
    k >>= B1;
  }
  return R;
}
// RFC 6979: the signing number comes from the key and the message, so no randomness is needed.
function rfc6979(d, h) {
  const n = P256.n;
  const x = bytesOf(d, 32),
    hb = bytesOf(bigOf(h) % n, 32);
  let V = new Array(32).fill(1),
    K = new Array(32).fill(0);
  K = hmac256(K, V.concat([0], x, hb));
  V = hmac256(K, V);
  K = hmac256(K, V.concat([1], x, hb));
  V = hmac256(K, V);
  for (;;) {
    V = hmac256(K, V);
    const k = bigOf(V);
    if (k >= B1 && k < n) return k;
    K = hmac256(K, V.concat([0]));
    V = hmac256(K, V);
  }
}
function es256(msgBytes, d) {
  const n = P256.n;
  const h = sha256(msgBytes);
  const k = rfc6979(d, h);
  const r = ecMul(k, P256.G)[0] % n;
  const s = (inv(k, n) * ((bigOf(h) + r * d) % n)) % n;
  return bytesOf(r, 32).concat(bytesOf(s, 32));
}
function vapidKeys() {
  const p = PropertiesService.getScriptProperties();
  let d = p.getProperty("VAPID_PRIVATE"),
    pub = p.getProperty("VAPID_PUBLIC");
  if (!d || !pub) {
    const seed = strBytes([1, 2, 3, 4].map(() => Utilities.getUuid()).join("") + Date.now());
    const k = (bigOf(sha256(seed)) % (P256.n - B1)) + B1;
    const Q = ecMul(k, P256.G);
    d = k.toString(16);
    pub = b64u([4].concat(bytesOf(Q[0], 32), bytesOf(Q[1], 32)));
    p.setProperty("VAPID_PRIVATE", d);
    p.setProperty("VAPID_PUBLIC", pub);
  }
  return { d: BigInt("0x" + d), pub };
}
function vapidHeader(endpoint, keys) {
  const aud = endpoint.match(/^https:\/\/[^/]+/)[0];
  const enc = o => b64u(strBytes(JSON.stringify(o)));
  const body =
    enc({ typ: "JWT", alg: "ES256" }) +
    "." +
    enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:" + OWNER.EMAIL });
  return "vapid t=" + body + "." + b64u(es256(strBytes(body), keys.d)) + ", k=" + keys.pub;
}

/* ----- phones on the team ----- */
function pushDevices() {
  const sh = pushSheet();
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh
    .getRange(2, 1, n, PUSH_COLS.length)
    .getValues()
    .map((r, i) => ({ row: i + 2, email: r[0], key: r[1], endpoint: r[2] }))
    .filter(x => x.endpoint);
}
// Sends a "tap" to every phone. Returns how many phones got it.
function pushTeam() {
  const devs = pushDevices();
  if (!devs.length) return 0;
  const keys = vapidKeys();
  const ok = /^https:\/\/([a-z0-9-]+\.)*(push\.apple\.com|googleapis\.com|mozilla\.com|notify\.windows\.com|push\.services\.mozilla\.com)\//;
  const list = devs.filter(x => ok.test(x.endpoint));
  if (!list.length) return 0;
  const res = UrlFetchApp.fetchAll(
    list.map(x => ({
      url: x.endpoint,
      method: "post",
      headers: { Authorization: vapidHeader(x.endpoint, keys), TTL: "86400", Urgency: "high" },
      payload: "",
      muteHttpExceptions: true
    }))
  );
  let sent = 0;
  const sh = pushSheet();
  const gone = [];
  res.forEach((r, i) => {
    const c = r.getResponseCode();
    if (c < 300) {
      sent++;
      sh.getRange(list[i].row, 5).setValue(new Date());
    } else if (c === 404 || c === 410) gone.push(list[i].row);
    else console.log("Phone alert failed (" + c + "): " + r.getContentText().slice(0, 200));
  });
  gone.sort((a, b) => b - a).forEach(row => sh.deleteRow(row));
  return sent;
}
function pushSave(who, sub, label) {
  const ep = String((sub && sub.endpoint) || "");
  if (!/^https:\/\//.test(ep) || ep.length > 1000) return { error: "This phone didn't give a push address." };
  const sh = pushSheet();
  const key = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  const old = pushDevices().find(x => x.endpoint === ep);
  const row = [who, key, ep, new Date(), "", cleanText(label, 80)];
  if (old) sh.getRange(old.row, 1, 1, PUSH_COLS.length).setValues([row]);
  else sh.appendRow(row);
  return { ok: true, device: key, done: "Phone alerts are on for this device." };
}
function pushRemove(who, ep) {
  const d = pushDevices().find(x => x.endpoint === String(ep || ""));
  if (d) pushSheet().deleteRow(d.row);
  return { ok: true, done: "Phone alerts are off for this device." };
}
// The phone asks what's new (it only has its own device key, not a sign-in).
function pushPeek(req) {
  const key = String(req.device || "");
  if (!/^[a-f0-9]{64}$/.test(key)) return { error: "bad device" };
  const note = CacheService.getScriptCache().get("pushmsg"); // an account alert, not a case
  const dev = pushDevices().find(x => x.key === key);
  if (!dev) return { error: "This phone isn't signed up for alerts." };
  const email = String(dev.email).toLowerCase();
  const isOwner = ownerEmails().indexOf(email) >= 0;
  const t = isOwner ? null : teamFind(email);
  if (!isOwner && !(t && t.Status === "active")) return { error: "Not on the team." };
  if (note) return Object.assign({ ok: true }, JSON.parse(note));
  const waiting = allCases()
    .filter(c => c.Status !== "closed" && +c["Team unread"] > 0)
    .sort((a, b) => new Date(b["Last update"]) - new Date(a["Last update"]));
  const c = waiting[0];
  if (!c)
    return { ok: true, title: "ScamSense", body: "No new messages right now.", url: "owner.html#cases", tag: "ss-none" };
  const more = waiting.length > 1 ? ` (+${waiting.length - 1} more)` : "";
  return {
    ok: true,
    title: (c.Priority === "urgent" ? "🚨 URGENT · " : "") + c.Name + more,
    body: String(c["Last message"] || c.Reason).slice(0, 180),
    url: "owner.html#case/" + encodeURIComponent(c["Case ID"]),
    tag: c["Case ID"]
  };
}

/* ========================================================================
   13. ACCOUNTS — create an account, sign in, sign out, forgot password
   - Create an account: email → 6-digit code by email → password → About you.
   - Sign in: email + password, then a code by email on a new device or after 60 days.
     "Keep me signed in" keeps a device signed in for 60 days; otherwise 1 day.
   - Passwords: at least 10 characters, one capital letter, one number. Passwords that showed up
     in data leaks are refused (checked without sending the password anywhere).
   - Passwords are never saved: only a salted, scrambled fingerprint, mixed with a secret kept in
     Script Properties (PW_PEPPER), so the spreadsheet alone can't reveal them.
   - 5 wrong passwords lock the account for 15 minutes.
   - The person gets an email for a new sign-in, a password change, an email change, and deletion.
   - The owner sees every account event in the Owner app, and a phone alert for the important ones.
   "Continue with Google / Outlook" still works and needs no password.
   ======================================================================== */

const ACCT = {
  CODE_MIN: 10, // a code works for 10 minutes
  CODE_TRIES: 5,
  CODES_PER_DAY: 8, // per email
  LOCK_AFTER: 5, // wrong passwords
  LOCK_MIN: 15,
  KEEP_DAYS: 60, // "Keep me signed in"
  SHORT_DAYS: 1,
  PW_ITER: 2000 // scrambling rounds (raise later; old passwords keep their own number)
};
const SESSION_COLS = ["Device", "User ID", "Started", "Expires", "Kept signed in", "Device name", "Last used"];
const sessionSheet = () => supportSheet("Sessions", SESSION_COLS);

/* ----- sessions: which device is signed in to which person, until when ----- */
let SESS = null; // read once per request
function sessionRows() {
  if (SESS) return SESS;
  const sh = sessionSheet();
  const n = sh.getLastRow() - 1;
  SESS =
    n < 1
      ? []
      : sh
          .getRange(2, 1, n, SESSION_COLS.length)
          .getValues()
          .map((r, i) => ({ row: i + 2, device: r[0], uid: r[1], expires: r[3] }));
  return SESS;
}
// null: never had a session (older devices) · true: signed in · false: signed out or expired
function sessionState(device) {
  const s = sessionRows().find(x => x.device === device);
  if (!s) return null;
  return new Date(s.expires) > new Date();
}
function sessionStart(u, device, keep, label) {
  const sh = sessionSheet();
  const now = new Date();
  const exp = new Date(now.getTime() + (keep ? ACCT.KEEP_DAYS : ACCT.SHORT_DAYS) * 864e5);
  const row = [device, u["User ID"], now, exp, keep ? "yes" : "no", cleanText(label, 60), now];
  const old = sessionRows().find(x => x.device === device);
  if (old) sh.getRange(old.row, 1, 1, SESSION_COLS.length).setValues([row]);
  else sh.appendRow(row);
  SESS = null;
  // This device now belongs to this person. If it had its own (unnamed) row before, that row goes.
  if (device !== u["User ID"]) {
    const sh2 = sheet("Users");
    const own = sh2.getRange("A:A").createTextFinder(device).matchEntireCell(true).findNext();
    if (own && own.getRow() > 1 && own.getRow() !== u.row && userAt(own.getRow())["Email verified"] !== "yes") {
      sh2.deleteRow(own.getRow());
      if (u.row > own.getRow()) u.row--;
    }
    const devs = String(u.Devices || "")
      .split(/\s+/)
      .filter(Boolean);
    if (devs.indexOf(device) < 0) devs.push(device);
    u.Devices = devs.join(" ");
    writeUser(u);
  }
  return exp.toISOString();
}
function sessionEnd(device) {
  const s = sessionRows().find(x => x.device === device);
  if (s) sessionSheet().getRange(s.row, 4).setValue(new Date(Date.now() - 1000));
  SESS = null;
}
function sessionEndAll(userId) {
  const sh = sessionSheet();
  const past = new Date(Date.now() - 1000);
  sessionRows()
    .filter(x => x.uid === userId)
    .forEach(x => sh.getRange(x.row, 4).setValue(past));
  SESS = null;
}
// Devices that signed in before accounts had sessions get one now, so nobody is thrown out.
function sessionAdopt(u, device) {
  if (sessionState(device) === null) sessionStart(u, device, true, "signed in before sessions");
}

/* ----- passwords ----- */
function pwRules(pw) {
  pw = String(pw || "");
  if (pw.length < 10) return "Your password needs at least 10 characters.";
  if (pw.length > 128) return "That password is too long.";
  if (!/[A-Z]/.test(pw)) return "Your password needs at least one capital letter.";
  if (!/[0-9]/.test(pw)) return "Your password needs at least one number.";
  return "";
}
// Has this password shown up in a data leak? Only the first 5 characters of its SHA-1 fingerprint
// are sent (Have I Been Pwned "range" check), so the password itself never leaves this server.
function pwLeaked(pw) {
  try {
    const h = u8(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, s8(strBytes(pw))))
      .map(x => x.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    const r = UrlFetchApp.fetch("https://api.pwnedpasswords.com/range/" + h.slice(0, 5), {
      headers: { "Add-Padding": "true" },
      muteHttpExceptions: true
    });
    if (r.getResponseCode() !== 200) return false;
    return r
      .getContentText()
      .split("\n")
      .some(line => {
        const [suf, n] = line.trim().split(":");
        return suf === h.slice(5) && +n > 0;
      });
  } catch (e) {
    return false; // if the check can't run, don't stop the person
  }
}
function pwPepper() {
  const p = PropertiesService.getScriptProperties();
  let v = p.getProperty("PW_PEPPER");
  if (!v) {
    v = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "");
    p.setProperty("PW_PEPPER", v);
  }
  return v;
}
const hexOf = b => u8(b).map(x => x.toString(16).padStart(2, "0")).join("");
const bytesOfHex = h => (String(h).match(/../g) || []).map(x => parseInt(x, 16));
// PBKDF2-HMAC-SHA256 (one block), keyed with the secret pepper + the password.
function pwHash(pw, saltHex, iter) {
  const P = strBytes(pwPepper() + "\u0000" + String(pw));
  let u = hmac256(P, bytesOfHex(saltHex).concat([0, 0, 0, 1]));
  const t = u.slice();
  for (let i = 1; i < iter; i++) {
    u = hmac256(P, u);
    for (let j = 0; j < t.length; j++) t[j] ^= u[j];
  }
  return hexOf(t);
}
function pwMake(pw) {
  const salt = Utilities.getUuid().replace(/-/g, "");
  return "v1$" + ACCT.PW_ITER + "$" + salt + "$" + pwHash(pw, salt, ACCT.PW_ITER);
}
function pwCheck(pw, stored) {
  const p = String(stored || "").split("$");
  if (p.length !== 4 || p[0] !== "v1") return false;
  const a = pwHash(pw, p[2], +p[1]),
    b = p[3];
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ----- 6-digit codes by email ----- */
const PURPOSE_WORDS = {
  signup: ["Your ScamSense code", "Use this code to create your ScamSense account."],
  login: ["Your ScamSense sign-in code", "Use this code to finish signing in to ScamSense."],
  reset: ["Reset your ScamSense password", "Use this code to set a new password."],
  delete: ["Confirm deleting your ScamSense account", "Use this code only if you want to delete your account."],
  email_change: ["Confirm your new email for ScamSense", "Use this code to change your ScamSense email to this address."]
};
const cleanEmail = e => {
  const v = String(e || "")
    .trim()
    .toLowerCase()
    .slice(0, 100);
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(v) ? v : "";
};
function codeSend(email, purpose, extra) {
  if (!takeQuota("acode:" + email, ACCT.CODES_PER_DAY))
    return { error: "We've sent a lot of codes to this email today. Please try again tomorrow." };
  const code = String(parseInt(Utilities.getUuid().replace(/-/g, "").slice(0, 12), 16) % 1000000).padStart(6, "0");
  CacheService.getScriptCache().put(
    "acode:" + purpose + ":" + email,
    JSON.stringify(Object.assign({ h: hexOf(sha256(strBytes(code + "|" + email))), tries: 0 }, extra || {})),
    ACCT.CODE_MIN * 60
  );
  const [subject, line] = PURPOSE_WORDS[purpose];
  MailApp.sendEmail({
    to: email,
    subject: subject + ": " + code,
    body: `${line}\n\n${code}\n\nIt works for ${ACCT.CODE_MIN} minutes. If you didn't ask for this, you can ignore this email.`,
    htmlBody: mailShell(
      `<div style="padding:24px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:#111827">${esc(subject)}</div>
        <p style="font-size:15px;color:#5F6673;margin:8px 0 18px">${esc(line)}</p>
        <div style="display:inline-block;font-size:34px;font-weight:800;letter-spacing:8px;color:#14213D;background:#F4F5F8;border-radius:14px;padding:14px 22px">${code}</div>
        <p style="font-size:14px;color:#5F6673;margin-top:18px">It works for ${ACCT.CODE_MIN} minutes. ScamSense will never call you or text you to ask for this code. If you didn't ask for it, ignore this email.</p>
      </div>`
    ),
    name: "ScamSense"
  });
  return { ok: true, sent: true };
}
// Checks a code. Returns its saved extras, or { error }.
function codeCheck(email, purpose, code) {
  const c = CacheService.getScriptCache();
  const k = "acode:" + purpose + ":" + email;
  const v = c.get(k);
  if (!v) return { error: "That code expired. Tap \"Send a new code\"." };
  const o = JSON.parse(v);
  if (o.tries >= ACCT.CODE_TRIES) return { error: "Too many wrong codes. Tap \"Send a new code\"." };
  if (hexOf(sha256(strBytes(String(code || "").trim() + "|" + email))) !== o.h) {
    o.tries++;
    c.put(k, JSON.stringify(o), ACCT.CODE_MIN * 60);
    return { error: "That code isn't right. Please check the email and try again." };
  }
  c.remove(k);
  return { ok: true, extra: o };
}

// After the code is right, the app gets a one-time pass (15 minutes) for the next screen: the password.
function ticketMake(purpose, email) {
  const t = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "");
  CacheService.getScriptCache().put("aticket:" + purpose + ":" + email, hexOf(sha256(strBytes(t))), 900);
  return t;
}
function ticketCheck(purpose, email, ticket) {
  const c = CacheService.getScriptCache();
  const k = "aticket:" + purpose + ":" + email;
  const v = c.get(k);
  if (!v || !ticket || hexOf(sha256(strBytes(String(ticket)))) !== v)
    return { error: "That took too long. Please start again and we'll send a new code.", restart: true };
  return { ok: true, done: () => c.remove(k) };
}
// The code alone (step 2), or the pass from step 2 with the password (step 3).
function codeOrTicket(req, email, purpose) {
  if (req.ticket) return ticketCheck(purpose, email, req.ticket);
  const ok = codeCheck(email, purpose, req.code);
  return ok.error ? ok : { ok: true, done: () => {} };
}

/* ----- telling the person and the owner ----- */
function acctMail(to, subject, line, button) {
  try {
    MailApp.sendEmail({
      to,
      replyTo: OWNER.EMAIL,
      subject,
      body: line,
      htmlBody: mailShell(
        `<div style="padding:22px"><div style="font-size:19px;font-weight:800;color:#111827">${esc(subject)}</div>
        <p style="font-size:15px;line-height:1.55;color:#111827">${esc(line)}</p>${button || ""}</div>`
      ),
      name: "ScamSense"
    });
  } catch (e) {}
}
// One line in the Activity tab (the Owner app shows it); a phone alert for important ones.
function acctEvent(u, uid, what, important) {
  try {
    sheet("Activity").appendRow([new Date(), uid || (u && u["User ID"]) || "", (u && fullName(u)) || "", "Account", "", what, "", ""]);
    if (important) ownerPush("ScamSense · " + ((u && fullName(u)) || "Someone"), what, "owner.html#overview");
  } catch (e) {}
}
// A phone alert that isn't about a case (the phone shows it for 2 minutes after the tap).
function ownerPush(title, body, url) {
  try {
    CacheService.getScriptCache().put("pushmsg", JSON.stringify({ title, body, url, tag: "ss-acct" }), 120);
    pushTeam();
  } catch (e) {}
}
const deviceName = req => cleanText(req.device, 60) || "a device";

/* ----- the account actions the app sends (mode "auth") ----- */
function authApi(req) {
  if (!okUid(req.uid)) return { error: "bad id" };
  const a = String(req.action || "");
  const email = cleanEmail(req.email);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    // Create an account, step 1: email a code.
    if (a === "signup_start") {
      if (!email) return { error: "Please type a real email address." };
      const u = findUserByEmail(email);
      if (u && u.Password) return { error: "You already have an account with this email. Tap \"I already have an account\".", existing: true };
      return codeSend(email, "signup");
    }
    // Create an account, step 2: the code (the password comes on the next screen).
    if (a === "signup_verify" || a === "reset_verify") {
      if (!email) return { error: "Please type a real email address." };
      const purpose = a === "signup_verify" ? "signup" : "reset";
      const ok = codeCheck(email, purpose, req.code);
      if (ok.error) return ok;
      return { ok: true, verified: true, ticket: ticketMake(purpose, email) };
    }
    // Create an account, step 3: the password.
    if (a === "signup_finish") {
      if (!email) return { error: "Please type a real email address." };
      const bad = pwRules(req.password);
      if (bad) return { error: bad };
      if (pwLeaked(req.password))
        return { error: "That password has shown up in a data leak, so scammers may know it. Please choose a different one." };
      const ok = codeOrTicket(req, email, "signup");
      if (ok.error) return ok;
      ok.done();
      let u = findUserByEmail(email);
      if (!u) {
        // This phone's earlier row is reused only if it isn't somebody else's real account.
        const mine = findUser(req.uid);
        if (mine && !(mine["Email verified"] === "yes" && mine.Email && String(mine.Email).toLowerCase() !== email))
          u = mine;
      }
      const isNew = !u;
      if (!u) {
        const taken = !!sheet("Users").getRange("A:A").createTextFinder(req.uid).matchEntireCell(true).findNext();
        u = {
          "User ID": taken ? Utilities.getUuid().replace(/-/g, "") : req.uid,
          "First seen": new Date(),
          "Emails scanned": 0,
          "Scams caught": 0,
          Checks: 0,
          Alerts: 0
        };
      }
      u.Email = email;
      const firstTime = u["Email verified"] !== "yes";
      u["Email verified"] = "yes";
      u.Password = pwMake(req.password);
      u["Last active"] = new Date();
      u.Status = "active";
      writeUser(u);
      u = findUserByEmail(email);
      const exp = sessionStart(u, req.uid, req.keep !== false, deviceName(req));
      if (firstTime) sendWelcome(u);
      acctEvent(u, req.uid, isNew ? "Created an account" : "Added a password to their account", isNew);
      return { ok: true, signedIn: true, expires: exp, email, profile: profileOf(u) };
    }
    // Sign in, step 1: email + password.
    if (a === "login") {
      if (!email) return { error: "Please type your email address." };
      const lockKey = "alock:" + email;
      const cache = CacheService.getScriptCache();
      if (cache.get(lockKey))
        return { error: `This account is locked for ${ACCT.LOCK_MIN} minutes after too many wrong passwords. You can also tap "Forgot password".` };
      const u = findUserByEmail(email);
      if (!u) return { error: "We couldn't find an account with that email. Tap \"Create an account\".", noAccount: true };
      if (!u.Password)
        return { error: "This account signs in with Google or Outlook. Use that button, or tap \"Forgot password\" to make a password.", noPassword: true };
      if (isYes(u.Blocked)) return BLOCKED;
      if (!pwCheck(req.password, u.Password)) {
        const n = +(cache.get("afail:" + email) || 0) + 1;
        cache.put("afail:" + email, String(n), ACCT.LOCK_MIN * 60);
        if (n >= ACCT.LOCK_AFTER) {
          cache.put(lockKey, "1", ACCT.LOCK_MIN * 60);
          cache.remove("afail:" + email);
          acctMail(u.Email, "Someone tried to sign in to your ScamSense account", `There were ${ACCT.LOCK_AFTER} wrong passwords for your account, so we locked it for ${ACCT.LOCK_MIN} minutes. If this was you, wait and try again, or reset your password. If it wasn't you, nobody got in, and you don't need to do anything.`);
          acctEvent(u, req.uid, `Locked out after ${ACCT.LOCK_AFTER} wrong passwords`, true);
          return { error: `Too many wrong passwords. The account is locked for ${ACCT.LOCK_MIN} minutes. You can tap "Forgot password".` };
        }
        return { error: `That password isn't right. ${ACCT.LOCK_AFTER - n} ${ACCT.LOCK_AFTER - n === 1 ? "try" : "tries"} left before a ${ACCT.LOCK_MIN}-minute lock.` };
      }
      cache.remove("afail:" + email);
      // Right password. A code by email proves it's really them on this device.
      const sent = codeSend(email, "login", { keep: req.keep !== false });
      if (sent.error) return sent;
      return { ok: true, needCode: true };
    }
    // Sign in, step 2: the code.
    if (a === "login_finish") {
      const ok = codeCheck(email, "login", req.code);
      if (ok.error) return ok;
      const u = findUserByEmail(email);
      if (!u) return { error: "We couldn't find that account." };
      const exp = sessionStart(u, req.uid, ok.extra.keep !== false, deviceName(req));
      u["Last active"] = new Date();
      writeUser(findUserByEmail(email) || u);
      acctMail(u.Email, "New sign-in to your ScamSense account", `Your account was just signed in on ${deviceName(req)}, ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMM d 'at' h:mm a")}. If this was you, you're all set. If it wasn't, open ScamSense, tap Forgot password to set a new one, and we'll sign out every device.`);
      acctEvent(u, req.uid, "Signed in on " + deviceName(req), false);
      return { ok: true, signedIn: true, expires: exp, email, profile: profileOf(u) };
    }
    // Forgot password, step 1.
    if (a === "reset_start") {
      if (!email) return { error: "Please type your email address." };
      if (!findUserByEmail(email)) return { ok: true, sent: true }; // don't tell strangers who has an account
      return codeSend(email, "reset");
    }
    // Forgot password, step 2: code + new password. Every device is signed out, then this one signs in.
    if (a === "reset_finish") {
      const bad = pwRules(req.password);
      if (bad) return { error: bad };
      if (pwLeaked(req.password))
        return { error: "That password has shown up in a data leak, so scammers may know it. Please choose a different one." };
      const ok = codeOrTicket(req, email, "reset");
      if (ok.error) return ok;
      const u = findUserByEmail(email);
      if (!u) return { error: "We couldn't find that account." };
      ok.done();
      u.Password = pwMake(req.password);
      u["Email verified"] = "yes";
      writeUser(u);
      CacheService.getScriptCache().remove("alock:" + email);
      sessionEndAll(u["User ID"]);
      const exp = sessionStart(findUserByEmail(email), req.uid, req.keep !== false, deviceName(req));
      acctMail(u.Email, "Your ScamSense password was changed", "Your password was just changed, and every other device was signed out. If this wasn't you, reply to this email right away.");
      acctEvent(u, req.uid, "Reset their password (all devices signed out)", true);
      return { ok: true, signedIn: true, expires: exp, email, profile: profileOf(u) };
    }

    // Everything below needs a signed-in device.
    const u = findUser(req.uid);
    const st = sessionState(req.uid);
    if (!u || st === false) return { error: "Please sign in again.", signin: true };
    if (st === null) sessionAdopt(u, req.uid); // signed in before sessions existed
    if (a === "status")
      return { ok: true, email: u.Email || "", hasPassword: !!u.Password, expires: sessionExpires(req.uid), profile: profileOf(u) };
    if (a === "logout") {
      sessionEnd(req.uid);
      acctEvent(u, req.uid, "Signed out", false);
      return { ok: true };
    }
    if (a === "logout_all") {
      sessionEndAll(u["User ID"]);
      acctEvent(u, req.uid, "Signed out of all devices", false);
      return { ok: true };
    }
    if (a === "change_password") {
      if (u.Password && !pwCheck(req.old, u.Password)) return { error: "Your current password isn't right." };
      const bad = pwRules(req.password);
      if (bad) return { error: bad };
      if (pwLeaked(req.password))
        return { error: "That password has shown up in a data leak, so scammers may know it. Please choose a different one." };
      u.Password = pwMake(req.password);
      writeUser(u);
      acctMail(u.Email, "Your ScamSense password was changed", "Your password was just changed in ScamSense. If this wasn't you, reply to this email right away.");
      acctEvent(u, req.uid, u.Password ? "Changed their password" : "Made a password", false);
      return { ok: true };
    }
    if (a === "email_change_start") {
      if (!email) return { error: "Please type a real email address." };
      if (findUserByEmail(email)) return { error: "Another account already uses that email." };
      return codeSend(email, "email_change", { uid: u["User ID"] });
    }
    if (a === "email_change_finish") {
      const ok = codeCheck(email, "email_change", req.code);
      if (ok.error) return ok;
      if (ok.extra.uid !== u["User ID"]) return { error: "Please start again." };
      const old = u.Email;
      u.Email = email;
      u["Email verified"] = "yes";
      writeUser(u);
      if (old) acctMail(old, "Your ScamSense email was changed", `Your ScamSense account now uses ${email}. If this wasn't you, reply to this email right away.`);
      acctEvent(u, req.uid, "Changed their email to " + email, true);
      return { ok: true, email };
    }
    if (a === "delete_start") {
      if (!u.Email) return { error: "This account has no email to confirm with. Please email us to delete it." };
      return codeSend(String(u.Email).toLowerCase(), "delete");
    }
    if (a === "delete_finish") {
      const ok = codeCheck(String(u.Email).toLowerCase(), "delete", req.code);
      if (ok.error) return ok;
      deleteAccount(u);
      acctMail(u.Email, "Your ScamSense account was deleted", "Your ScamSense account and its information were deleted. You're welcome back anytime.");
      acctEvent(null, req.uid, `${fullName(u) || u.Email} deleted their account`, true);
      return { ok: true, deleted: true };
    }
    return { error: "Unknown action." };
  } finally {
    lock.releaseLock();
  }
}
function sessionExpires(device) {
  const s = sessionRows().find(x => x.device === device);
  return s ? iso(s.expires) : "";
}
function profileOf(u) {
  return {
    first: u["First name"] || "",
    last: u["Last name"] || "",
    dob: dobText(u["Date of birth"]),
    country: u.Country || "",
    state: u.State || "",
    zip: String(u.ZIP || "").replace(/^'/, "")
  };
}
// Removes the person's row, their activity, their help cases, and their sessions.
function deleteAccount(u) {
  const id = u["User ID"];
  const devs = [id].concat(String(u.Devices || "").split(/\s+/).filter(Boolean));
  const wipe = (name, col, match) => {
    const sh = sheet(name);
    if (!sh || sh.getLastRow() < 2) return;
    const vals = sh.getRange(2, col, sh.getLastRow() - 1, 1).getValues();
    for (let i = vals.length - 1; i >= 0; i--) if (match(vals[i][0])) sh.deleteRow(i + 2);
  };
  const caseIds = allCases()
    .filter(c => devs.indexOf(c["User ID"]) >= 0)
    .map(c => c["Case ID"]);
  wipe("Activity", 2, v => devs.indexOf(v) >= 0);
  wipe("Messages", 2, v => caseIds.indexOf(v) >= 0);
  wipe("Cases", 1, v => caseIds.indexOf(v) >= 0);
  wipe("Sessions", 2, v => v === id);
  SESS = null;
  const again = findUserByEmail(u.Email) || u;
  if (again.row) sheet("Users").deleteRow(again.row);
}

/* ========================================================================
   ScamSense · Mahi Server (Google Apps Script web app)

   WHAT IT DOES
   Lets Mahi answer ANY question with AI, without putting your AI key in the
   app. The app sends the chat here; this script adds your hidden key, asks
   Anthropic's AI, and sends back Mahi's answer.

   SET UP (once) — see README.md in this folder
   1. Project Settings > Script Properties: ANTHROPIC_API_KEY = your sk-ant- key
   2. Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone
   3. Copy the Web app URL into ScamSense > Settings > Advanced > Mahi server

   PARTS OF THIS FILE
     1. Settings      daily limit, model, answer length
     2. Web app       doGet (health check) and doPost (answer a chat)
     3. Safety        checks the request and counts today's answers
     4. AI call       asks Anthropic's AI
     5. Mahi's rules  how Mahi talks
   ======================================================================== */

/* ========================================================================
   1. SETTINGS
   ======================================================================== */

const MAHI = {
  MODEL: "claude-haiku-5-5",
  MAX_TOKENS: 600, // length of each answer
  MAX_PER_DAY: 300, // answers per day for everyone together (protects your bill)
  MAX_MESSAGES: 12, // how much of the chat is sent each time
  MAX_CHARS: 2500 // longest single message accepted
};

/* ========================================================================
   2. WEB APP
   ======================================================================== */

// Open the web app URL in a browser to check it's working.
function doGet() {
  return json({ ok: true, name: "Mahi", answersToday: countToday() });
}

// The app sends { messages: [...], lang: "English" } and gets back { text }.
function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const messages = cleanMessages(req.messages);
    if (!messages.length) return json({ error: "No question received." });
    if (!takeOne()) return json({ error: "Mahi has answered a lot today. Please try again tomorrow." });
    const key = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
    if (!key) return json({ error: "The Mahi server has no AI key yet." });
    const lang = String(req.lang || "English").slice(0, 40);
    return json({ text: askAI(key, mahiRules(lang), messages) });
  } catch (err) {
    return json({ error: "Mahi couldn't answer right now. Please try again." });
  }
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ========================================================================
   3. SAFETY
   ======================================================================== */

// Keeps only real chat turns, trims long ones, and makes sure it starts with the person.
function cleanMessages(list) {
  if (!Array.isArray(list)) return [];
  let out = list
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map(m => ({ role: m.role, content: m.content.slice(0, MAHI.MAX_CHARS) }))
    .slice(-MAHI.MAX_MESSAGES);
  while (out.length && out[0].role !== "user") out.shift();
  return out;
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

function askAI(key, system, messages) {
  const res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    payload: JSON.stringify({ model: MAHI.MODEL, max_tokens: MAHI.MAX_TOKENS, system, messages })
  });
  if (res.getResponseCode() !== 200) throw new Error("AI error " + res.getResponseCode());
  return (JSON.parse(res.getContentText()).content || [])
    .map(c => c.text || "")
    .join("")
    .trim();
}

/* ========================================================================
   5. MAHI'S RULES
   ======================================================================== */

function mahiRules(lang) {
  return `You are Mahi, the friendly assistant inside ScamSense, an app that protects people (especially older adults) from scams.
Answer ANY question the person asks, helpfully and honestly, not only scam questions. Your specialty is staying safe from scams, fraud, and identity theft.
Answer in ${lang}. Use short, plain sentences a 75-year-old can follow. Keep answers under 8 short lines unless they ask for more.
Never ask for passwords, codes, card numbers, or Social Security numbers, and remind people never to share them.
If they may have lost money or shared private details: tell them to call their bank right away and to use "I was scammed" in the Help tab.
If they want a real person: suggest a trusted family member, the AARP Fraud Watch Network Helpline 877-908-3360, or (age 60+) the National Elder Fraud Hotline 1-833-372-8311.
If someone is in danger, tell them to call 911. If you're not sure, say so.`;
}

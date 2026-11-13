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
     4. AI call       asks Anthropic's AI (with web search)
     5. Mahi's rules  how Mahi talks
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
If they may have lost money or shared private details: tell them to call their bank right away and to use "I was scammed" in the Help tab.
If they want a real person: suggest a trusted family member, the AARP Fraud Watch Network Helpline 877-908-3360, or (age 60+) the National Elder Fraud Hotline 1-833-372-8311.
You can search the web. Use it for anything current or that you don't know for sure: news, recent scams, scam alerts, statistics, prices, laws, company or agency phone numbers, and whether a website or business is real. Say briefly what you found; the app lists your sources.
If someone is in danger, tell them to call 911. If you're not sure, say so.`;
}

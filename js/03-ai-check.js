/*
 * ScamSense · AI check
 * Asks Anthropic's AI (Claude) for a second opinion on risky messages, when an AI key is set.
 */
"use strict";

const AI_SYSTEM = `You are ScamSense, a scam detector that protects people, especially older adults, from scams in email, text messages, and phone calls.
Judge the message you are given. Consider who really sent it, what it asks the reader to do (click, call, pay, share a code, install software, keep a secret), pressure or threats, payment methods (gift cards, crypto, wire, Zelle), lookalike websites, and whether the story makes sense.
Unpaid toll, package fee, or redelivery texts that link to a website that is not the real company's own website are SCAM.
Normal newsletters, receipts, account notices and payment reminders from real companies (sent from their official domain, with passing sender checks, pointing to their own website) are SAFE. Do not call something a scam just because it is marketing.
Reply with ONLY a JSON object, no other text:
{"verdict":"safe"|"suspicious"|"scam","scam_type":"short name or empty","confidence":0-100,"explanation":"2 short sentences in plain, friendly language a 75-year-old can follow","red_flags":["up to 4 short items"],"what_to_do":["2-4 short steps"]}
Keep the JSON keys and the verdict word in English, but write scam_type, explanation, red_flags and what_to_do in {LANG}.`;

/* The smart AI check is on when there's a key in the app OR a Mahi server (which keeps the key hidden). */
const aiViaServer = () => {
  const c = cfg();
  return !c.apiKey && !!c.mahiUrl;
};
const aiOn = () => {
  const c = cfg();
  return !!(c.apiKey || c.mahiUrl) && c.aiMode !== "off";
};
/* Asks the Mahi server to check a message. Any problem → quiet error, so the built-in result is used. */
async function serverCheck(details) {
  const quiet = msg => Object.assign(new Error(msg), { quiet: true });
  let j;
  try {
    const r = await fetch(cfg().mahiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        mode: "check",
        uid: typeof myUid === "function" ? myUid() : undefined,
        check: details,
        lang: LANGS[langCode()].ai
      })
    });
    j = await r.json();
  } catch (e) {
    throw quiet("server unreachable");
  }
  if (j && j.blocked && typeof showBlocked === "function") showBlocked(j.error);
  if (!j || j.error || !j.text) throw quiet((j && j.error) || "no answer");
  return j.text;
}
async function aiCheck(item) {
  const c = cfg();
  if (!c.apiKey && !c.mahiUrl) throw new Error("no-key");
  const parts = [];
  parts.push(`Channel: ${item.channel}`);
  if (item.fromName || item.fromEmail) parts.push(`From: ${item.fromName || ""} <${item.fromEmail || ""}>`);
  if (item.replyTo) parts.push(`Reply-To: ${item.replyTo}`);
  if (item.auth)
    parts.push(`Sender checks: ${(item.auth.match(/(spf|dkim|dmarc)=\w+/gi) || []).join(", ") || "unknown"}`);
  if (item.local && item.local.trusted)
    parts.push(
      "Note: the sender's domain is the company's real, official domain and Gmail's sender checks passed. Treat it as genuine unless the text clearly asks for something a real company never would."
    );
  if (!(item.text || "").trim())
    parts.push("Note: ScamSense couldn't read the message text. Do not treat a missing body as a scam sign.");
  if (item.phone) parts.push(`Caller number: ${item.phone}`);
  if (item.subject) parts.push(`Subject: ${item.subject}`);
  const hosts = [...new Set((item.links || []).map(l => l.host).filter(Boolean))].slice(0, 12);
  if (hosts.length) parts.push(`Link destinations: ${hosts.join(", ")}`);
  if (item.attachments && item.attachments.length) parts.push(`Attachments: ${item.attachments.join(", ")}`);
  parts.push(
    `Warning signs found by on-device checks: ${item.local.reasons.length ? item.local.reasons.join(" | ") : "none"}`
  );
  parts.push(`Message text:\n"""\n${(item.text || "").slice(0, 3500)}\n"""`);
  const txt = aiViaServer()
    ? await serverCheck(parts.join("\n"))
    : await callClaude(AI_SYSTEM.replace("{LANG}", LANGS[langCode()].ai), parts.join("\n"), 700);
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m && aiViaServer()) throw Object.assign(new Error("unreadable"), { quiet: true });
  if (!m)
    throw new Error(
      tr(
        "The AI gave an answer ScamSense couldn't read.",
        "La IA dio una respuesta que ScamSense no pudo leer."
      )
    );
  const j = JSON.parse(m[0]);
  j.verdict = { safe: "safe", suspicious: "warn", scam: "scam" }[j.verdict] || "warn";
  return j;
}
async function callClaude(system, user, maxTokens) {
  const c = cfg();
  if (!c.apiKey) throw new Error("no-key");
  const body = {
    model: c.model,
    max_tokens: maxTokens || 700,
    system,
    messages: Array.isArray(user) ? user : [{ role: "user", content: user }]
  };
  let res,
    tries = 0;
  while (true) {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": c.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify(body)
    });
    if ((res.status === 429 || res.status === 529 || res.status >= 500) && tries < 2) {
      tries++;
      await new Promise(r => setTimeout(r, 2000 * tries));
      continue;
    }
    break;
  }
  if (!res.ok) {
    let msg = "";
    try {
      msg = (await res.json()).error.message;
    } catch (e) {}
    if (res.status === 401) throw new Error("The AI key wasn't accepted. Check it in Settings.");
    if (res.status === 404)
      throw new Error(`The AI model "${c.model}" wasn't found. Pick another model in Settings.`);
    if (res.status === 400 && /credit/i.test(msg))
      throw new Error("Your AI account is out of credit. Add credit at console.anthropic.com.");
    throw new Error(`AI check failed (${res.status}). ${msg}`);
  }
  const data = await res.json();
  return (data.content || [])
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("");
}
function finalLevel(item) {
  if (item.ai) {
    let v = item.ai.verdict;
    if (item.local.score >= 8 && v === "safe") v = "warn";
    // A verified official sender (real company domain + Gmail's sender checks pass) is at most "suspicious"
    // unless the on-device rules also found strong scam signs.
    if (item.local.trusted && item.local.score < 8 && v === "scam") v = "warn";
    if (item.local.score >= 14 && v === "warn") v = "scam";
    return v;
  }
  return item.local.level;
}

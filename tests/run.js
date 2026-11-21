/* ScamSense accuracy test: node tests/run.js
   Runs every email in tests/emails.json through the same checks the app and the daily report use
   (without the AI, the hardest case) and shows which ones it gets wrong. */
const fs = require("fs"), path = require("path");
const code = fs.readFileSync(path.join(__dirname, "../daily-report/Code.gs"), "utf8");
const stub = { Session: {}, PropertiesService: {}, GmailApp: {}, UrlFetchApp: {}, CacheService: {}, Utilities: {}, ScriptApp: {}, LockService: {}, ContentService: {} };
const R = new Function(...Object.keys(stub), code + ";return {analyze,applyEvidence,decideLevel,hardEvidence,parseFrom};")(...Object.values(stub));
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, "emails.json"), "utf8"));
let fp = 0, missed = 0, weak = 0, careful = 0;
cases.forEach(c => {
  const f = R.parseFrom(c.from);
  const urls = (c.text.match(/https?:\/\/[^\s]+/g) || []).map(u => ({ href: u, host: u.replace(/^https?:\/\//, "").split("/")[0].toLowerCase(), text: "" }));
  const msg = { subject: c.subject, text: c.text, fromName: f.name, fromEmail: f.email, replyTo: c.replyTo || "", auth: c.auth, listUnsub: !!c.unsub, links: urls, attachments: [] };
  const local = R.applyEvidence(R.analyze(msg), { history: c.history || 0, age: c.age == null ? null : c.age }, c.auth);
  let level = R.decideLevel(local, null, c.auth);
  if (level === "scam" && local.trusted && !R.hardEvidence(local, c.auth)) level = "warn";
  let mark = "ok ";
  if (c.label === "real" && level !== "safe") { mark = level === "scam" ? "FALSE ALARM" : "warn"; if (level === "scam") fp++; else careful++; }
  if (c.label === "scam" && level === "safe") { mark = "MISSED"; missed++; }
  if (c.label === "scam" && level === "warn") { mark = "weak"; weak++; }
  console.log(`${mark.padEnd(11)} ${c.label.padEnd(4)} → ${level.padEnd(4)}  ${c.name}`);
});
const real = cases.filter(c => c.label === "real").length, scam = cases.length - real;
console.log(`\nReal emails called scam: ${fp}/${real}   Real emails called "be careful": ${careful}/${real}   Scams missed: ${missed}/${scam}   Scams only "be careful": ${weak}/${scam}`);
process.exitCode = fp || missed ? 1 : 0;

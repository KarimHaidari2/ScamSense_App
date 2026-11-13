/*
 * ScamSense · Scanning
 * Runs a full scan: reads emails, checks each one, saves the daily report.
 */
"use strict";

let scanning = false;
/* Scans every connected email account (Gmail, Outlook) and makes one Daily Safety Report.
   With nothing connected yet, it starts the Gmail sign-in. */
async function scanEmail() {
  if (scanning) return;
  scanning = true;
  try {
    const useOutlook = outlookConnected();
    const useGmail = S.get("connected", false) || !useOutlook;
    let items = [];
    if (useGmail) items = items.concat(await collectGmail());
    if (useOutlook) items = items.concat(await collectOutlook());
    await finishScan(items, useGmail && useOutlook ? "mixed" : useOutlook ? "outlook" : "gmail");
  } catch (e) {
    toast(e.message);
    renderToday();
  } finally {
    scanning = false;
  }
}
/* Reads recent Gmail from every folder: Inbox, Promotions, Social, Updates, Forums, archived, Spam and Trash.
   Skips only mail you sent and drafts. */
async function collectGmail() {
  const c = cfg();
  renderToday({ progress: { label: t("prog_connect"), pct: 5 } });
  await getToken(false);
  renderToday({ progress: { label: t("prog_find"), pct: 10 } });
  const list = await gfetch(
    `messages?maxResults=${Math.min(500, c.max)}&includeSpamTrash=true&q=${encodeURIComponent(`newer_than:${c.days}d -in:sent -in:drafts -in:chats`)}`
  );
  const ids = (list.messages || []).map(m => m.id);
  const items = [];
  let done = 0;
  await pool(ids, 5, async id => {
    const m = await getGmailMessage(id);
    items.push(parseGmail(m));
    done++;
    renderToday({
      progress: {
        label: t("prog_read", { d: done, n: ids.length }),
        pct: 10 + (40 * done) / Math.max(1, ids.length)
      }
    });
  });
  return items;
}
async function finishScan(items, source) {
  const c = cfg();
  await loadDisposable();
  items.forEach(it => {
    it.local = analyze(it);
  });
  const wantsAI = aiOn();
  let aiList = wantsAI
    ? items.filter(it => c.aiMode === "all" || it.local.score >= 2 || it.local.reasons.length)
    : [];
  // Through the Mahi server, check the riskiest 10 only (it has a daily limit for everyone).
  if (aiViaServer()) aiList = aiList.sort((a, b) => b.local.score - a.local.score).slice(0, 10);
  let done = 0,
    aiErr = null;
  await pool(aiList, 3, async it => {
    try {
      it.ai = await aiCheck(it);
    } catch (e) {
      if (!e.quiet) {
        it.aiError = e.message;
        aiErr = e.message;
      }
    }
    done++;
    renderToday({
      progress: {
        label: t("prog_ai", { d: done, n: aiList.length }),
        pct: 50 + (50 * done) / Math.max(1, aiList.length)
      }
    });
  });
  items.forEach(it => {
    if (!it.ai && it._demoAI) {
      it.ai = JSON.parse(JSON.stringify(pickDemoAI(it._demoAI)));
      it.ai.verdict = { safe: "safe", suspicious: "warn", scam: "scam" }[it.ai.verdict] || it.ai.verdict;
    }
  });
  items.forEach(it => {
    it.level = finalLevel(it);
  });
  const order = { scam: 0, warn: 1, safe: 2 };
  items.sort((a, b) => order[a.level] - order[b.level] || b.date - a.date);
  const report = { at: Date.now(), source, days: c.days, ai: !!wantsAI, aiChecked: aiList.length, items };
  S.set("report", Object.assign({}, report, { items: report.items.map(slimItem) }));
  const hist = S.get("history", []);
  const kinds = {};
  items
    .filter(i => i.level !== "safe")
    .forEach(i => {
      const k = i.local.kindKey;
      if (k) kinds[k] = (kinds[k] || 0) + 1;
    });
  hist.push({
    at: report.at,
    checked: items.length,
    scam: items.filter(i => i.level === "scam").length,
    warn: items.filter(i => i.level === "warn").length,
    kinds
  });
  S.set("history", hist.slice(-90));
  if (aiErr) toast(aiErr);
  renderToday();
}

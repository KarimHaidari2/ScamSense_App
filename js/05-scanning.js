/*
 * ScamSense · Scanning
 * Runs a full scan: reads emails, checks each one, saves the daily report.
 */
"use strict";

let scanning = false;
/* Scans every connected email account (Gmail, Outlook) and makes one Daily Safety Report.
   With nothing connected yet, it starts the Gmail sign-in. */
/* Results are kept for a week, so the next scan only reads emails it hasn't seen. After a week
   an email is checked again from scratch (that's the regular "full" re-check). */
const RESULT_KEEP_DAYS = 7;
function cachedResults(source, box) {
  const rep = S.get("report", null);
  const map = {};
  if (!rep || rep.source === "demo") return map;
  (rep.items || []).forEach(it => {
    if (
      it.id &&
      it.source === source &&
      (it.box || "") === (box || "") &&
      it.checkedAt &&
      Date.now() - it.checkedAt < RESULT_KEEP_DAYS * 864e5 &&
      // ScamSense's own emails are always checked again (an older version could flag the new sender).
      !OWN_SENDERS.includes(String(it.fromEmail || "").toLowerCase())
    )
      map[it.id] = it;
  });
  return map;
}
/* Ads and newsletters: still checked (fake "you won" ads are a common scam), but the safe ones are
   grouped out of the way so real mail and real dangers stand out. Bills, receipts and bank notices
   ("Updates") are not ads. */
function isAdMail(it) {
  if (it.level !== "safe") return false;
  return ["Promotions", "Social", "Forums"].includes(it.folder) || !!it.listUnsub;
}
/* Progress shows at most a few times a second; redrawing for every email slows phones down. */
let lastProgress = 0;
function showProgress(label, pct, force) {
  const now = Date.now();
  if (!force && now - lastProgress < 250) return;
  lastProgress = now;
  renderToday({ progress: { label, pct } });
}
/* Keep the phone's screen on during a long scan (a locked phone pauses the scan). */
let scanWake = null;
async function holdScreen(on) {
  try {
    if (on && navigator.wakeLock && !scanWake) scanWake = await navigator.wakeLock.request("screen");
    if (!on && scanWake) {
      await scanWake.release();
      scanWake = null;
    }
  } catch (e) {
    scanWake = null;
  }
}
/* How many days back a scan reads: the setting, or longer if the last check was longer ago than that
   (up to 7 days), so nothing that came in while the app was closed is missed. */
function scanDays() {
  const c = cfg();
  const rep = S.get("report", null);
  const last = rep && rep.source !== "demo" ? +rep.at || 0 : 0;
  const since = last ? Math.ceil((Date.now() - last) / 864e5) : 0;
  return Math.min(7, Math.max(c.days || 1, since));
}
async function scanEmail() {
  if (scanning) return;
  scanning = true;
  holdScreen(true);
  try {
    const useOutlook = outlookConnected();
    const useGmail = S.get("connected", false) || !useOutlook;
    const g = useGmail ? await collectGmail() : [];
    const o = useOutlook ? await collectOutlook() : [];
    // Any other email addresses they added (39-more-mailboxes.js).
    const x =
      typeof collectExtraBoxes === "function" && (useGmail || useOutlook) ? await collectExtraBoxes() : [];
    const items = g.concat(o, x);
    items._skipped = (g._skipped || 0) + (o._skipped || 0) + (x._skipped || 0);
    await finishScan(items, useGmail && useOutlook ? "mixed" : useOutlook ? "outlook" : "gmail");
  } catch (e) {
    toast(e.message);
    renderToday();
  } finally {
    scanning = false;
    holdScreen(false);
  }
}
/* Reads recent Gmail from every folder: Inbox, Promotions, Social, Updates, Forums, archived, Spam and Trash.
   Skips only mail you sent and drafts. */
async function collectGmail(box) {
  const c = cfg();
  // box: an extra Gmail address (its key is already swapped in by withGmailBox).
  if (!box) {
    renderToday({ progress: { label: t("prog_connect"), pct: 5 } });
    await getToken(false);
  }
  renderToday({
    progress: { label: box ? tr(`Checking ${box}…`, `Revisando ${box}…`) : t("prog_find"), pct: 10 }
  });
  const q = encodeURIComponent(`newer_than:${scanDays()}d -in:sent -in:drafts -in:chats`);
  let ids = [];
  let pageToken = "";
  do {
    const list = await gfetch(
      `messages?maxResults=${Math.min(500, c.max - ids.length)}&includeSpamTrash=true&q=${q}${pageToken ? "&pageToken=" + pageToken : ""}`
    );
    ids = ids.concat((list.messages || []).map(m => m.id));
    pageToken = list.nextPageToken || "";
  } while (pageToken && ids.length < c.max);
  ids = ids.slice(0, c.max);
  // Emails already checked this week keep their result; only new ones are read.
  const seen = cachedResults("gmail", box);
  const items = ids.filter(id => seen[id]).map(id => Object.assign({}, seen[id], { _cached: true }));
  const fresh = ids.filter(id => !seen[id]);
  let done = items.length,
    skipped = 0;
  await pool(fresh, 4, async id => {
    try {
      items.push(parseGmail(await getGmailMessage(id)));
    } catch (e) {
      if (/sign-in expired|vencí/i.test(e.message)) throw e;
      skipped++; // one email Gmail wouldn't give us doesn't stop the scan
    }
    done++;
    showProgress(t("prog_read", { d: done, n: ids.length }), 10 + (40 * done) / Math.max(1, ids.length));
  });
  if (skipped) items._skipped = skipped;
  return items;
}
async function finishScan(items, source) {
  const c = cfg();
  await loadDisposable();
  const skipped = items._skipped || 0;
  const now = Date.now();
  // Emails checked earlier this week already have their answer.
  const fresh = items.filter(it => !it._cached);
  fresh.forEach(it => {
    try {
      it.local = analyze(it);
    } catch (e) {
      // An email the rules can't read is shown as "be careful" rather than stopping the scan.
      it.local = {
        level: "warn",
        score: 4,
        reasons: [
          tr("ScamSense couldn't read this email fully.", "ScamSense no pudo leer este correo por completo.")
        ],
        kind: ""
      };
    }
    it.checkedAt = now;
  });
  // Proof that's hard to fake: sender history and how old the sender's address is.
  renderToday({ progress: { label: tr("Checking the senders…", "Revisando los remitentes…"), pct: 50 } });
  await gatherEvidence(fresh);
  const wantsAI = aiOn();
  let aiList = wantsAI
    ? fresh.filter(it => c.aiMode === "all" || it.local.score >= 2 || it.local.reasons.length)
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
    showProgress(t("prog_ai", { d: done, n: aiList.length }), 50 + (50 * done) / Math.max(1, aiList.length));
  });
  items.forEach(it => {
    if (!it.ai && it._demoAI) {
      it.ai = JSON.parse(JSON.stringify(pickDemoAI(it._demoAI)));
      it.ai.verdict = { safe: "safe", suspicious: "warn", scam: "scam" }[it.ai.verdict] || it.ai.verdict;
    }
  });
  fresh.forEach(it => {
    it.level = finalLevel(it);
    it.ad = isAdMail(it);
  });
  const order = { scam: 0, warn: 1, safe: 2 };
  items.sort((a, b) => order[a.level] - order[b.level] || b.date - a.date);
  const report = { at: Date.now(), source, days: scanDays(), ai: !!wantsAI, aiChecked: aiList.length, items };
  S.set("report", Object.assign({}, report, { items: report.items.map(slimItem) }));
  // The team's numbers count each email once, not again on every scan.
  if (source !== "demo" && typeof serverScanEvent === "function" && fresh.length)
    serverScanEvent(fresh, source);
  if (skipped)
    toast(
      tr(
        `${skipped} email${skipped === 1 ? "" : "s"} couldn't be read this time. They'll be checked on the next scan.`,
        `${skipped} correo${skipped === 1 ? "" : "s"} no se pudo leer esta vez. Se revisará${skipped === 1 ? "" : "n"} en la próxima revisión.`
      )
    );
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
  // "Move scams to Spam for me" (40-auto-protect.js)
  if (source !== "demo" && typeof autoMoveScams === "function")
    autoMoveScams(fresh).then(n => n && renderToday());
}

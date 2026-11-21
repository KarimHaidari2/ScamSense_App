/*
 * ScamSense · Evidence
 * Before calling anything a scam, ScamSense gathers proof that's hard for scammers to fake:
 *   1. Sender history: have you received real email from this exact address before (2+ weeks ago)?
 *   2. Address age: when was the sender's (or link's) web address created? Scammers use brand-new ones.
 * The AI then makes the final call with this evidence (see decideLevel in 02-scam-rules.js).
 */
"use strict";

/* Asks the ScamSense server how many days old each web address is. */
async function domainAgesFor(domains) {
  const list = [...new Set(domains.filter(Boolean))].slice(0, 12);
  if (!list.length || !cfg().mahiUrl) return {};
  try {
    const r = await fetch(cfg().mahiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ mode: "intel", domains: list })
    });
    const j = await r.json();
    return (j && j.ages) || {};
  } catch (e) {
    return {};
  }
}

/* How many earlier emails (2+ weeks old) came from this exact address. */
async function senderHistory(it) {
  const addr = (it.fromEmail || "").toLowerCase();
  if (!addr) return 0;
  try {
    if (it.source === "gmail" && typeof token !== "undefined" && token) {
      const q = encodeURIComponent(`from:${addr} older_than:14d`);
      const j = await gfetch(`messages?maxResults=3&q=${q}`);
      return (j.messages || []).length;
    }
    if (it.source === "outlook" && typeof outlookConnected === "function" && outlookConnected()) {
      const j = await msGet(`me/messages?$top=5&$select=receivedDateTime&$search="from:${addr}"`);
      const cutoff = Date.now() - 14 * 864e5;
      return (j.value || []).filter(m => Date.parse(m.receivedDateTime) < cutoff).length;
    }
  } catch (e) {}
  return 0;
}

const senderDomain = it => baseDomain(((it.fromEmail || "").split("@")[1] || "").toLowerCase());

/* For an email scan: check the evidence for every email that isn't clearly safe. */
async function gatherEvidence(items) {
  const risky = items.filter(it => it.local && it.local.level !== "safe").slice(0, 25);
  if (!risky.length) return;
  const ages = await domainAgesFor(risky.map(senderDomain));
  await pool(risky, 4, async it => {
    const ev = {
      history: await senderHistory(it),
      age: ages[senderDomain(it)],
      category: ["Promotions", "Updates", "Social"].includes(it.folder) // Gmail sorted it as normal bulk mail
    };
    if (ev.age === undefined) ev.age = null;
    it.local = applyEvidence(it.local, ev, it.auth);
  });
}

/* For "Check something": how old are the websites the message links to? */
async function linkEvidence(it) {
  const hosts = [];
  (it.links || []).forEach(l => l.host && hosts.push(l.host));
  (String(it.text || "").match(/\b(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:\/\S*)?/gi) || []).forEach(
    u => hosts.push(hostOf(/^https?:/i.test(u) ? u : "http://" + u))
  );
  const doms = [...new Set(hosts.filter(Boolean).map(baseDomain))].slice(0, 6);
  if (!doms.length) return;
  const ages = await domainAgesFor(doms);
  const known = Object.values(ages).filter(a => a != null);
  if (!known.length) return;
  it.local = applyEvidence(it.local, { history: 0, age: Math.min(...known) }, it.auth);
}

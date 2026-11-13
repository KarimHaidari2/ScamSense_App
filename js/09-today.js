/*
 * ScamSense · Today screen
 * The Today tab: summary card, the Your emails screen, and each email's details.
 */
"use strict";

/* ----- Today ----- */
let filter = "all",
  acctFilter = "all";
function plural(s, n) {
  return s.replace(/\((s|es|n|a\(s\))\)/g, (m, x) => (n === 1 ? "" : x));
}
function headlineOf(n) {
  return n.scam
    ? plural(t("h_scams", { n: n.scam }), n.scam)
    : n.warn
      ? plural(t("h_warn", { n: n.warn }), n.warn)
      : t("h_clear");
}
function renderToday(opt) {
  opt = opt || {};
  const c = cfg();
  const rep = S.get("report", null);
  let h = "";
  if (opt.progress) {
    view.innerHTML = `<section class="card" aria-live="polite"><h2>${t("scanning")}</h2><p class="muted" style="margin:0">${esc(opt.progress.label)}</p><div class="progress"><i style="width:${Math.round(opt.progress.pct)}%"></i></div>
        <div class="privacy"><span aria-hidden="true">🔒</span><div>${t("scanning_note")}</div></div></section>`;
    return;
  }
  if (!rep) {
    h += `<div class="today"><section class="sc sv-new"><div class="sc-main"><span class="sc-badge">${ic("shield")}</span><p class="big">${t("welcome_big")}</p></div>
      <p class="meta">${t("welcome_sub")}</p>
      <div class="btnrow"><button class="btn primary" id="demo">${t("try_demo")}</button><button class="btn ghost" id="scan">${t("scan_my")}</button></div></section>
      ${homeActionsHTML()}
      <p class="footnote">${ic("lock")}<span><b>${t("private_title")}</b> ${t("private_body")}</span></p></div>`;
    view.innerHTML = h;
    document.getElementById("scan").onclick = scanEmail;
    document.getElementById("demo").onclick = loadDemo;
    bindGo();
    return;
  }
  const n = { scam: 0, warn: 0, safe: 0 };
  rep.items.forEach(i => n[i.level]++);
  const headline = headlineOf(n);
  const lv = n.scam ? "scam" : n.warn ? "warn" : "safe";
  const dtxt = rep.days === 1 ? t("d24") : t("ddays", { n: rep.days });
  const aiNote =
    rep.source === "demo" && !rep.ai
      ? t("ai_demo")
      : rep.ai
        ? t("ai_checked", { n: rep.aiChecked })
        : t("ai_off");
  h += `<div class="today"><section class="sc sv-${lv}">
    <div class="sc-top"><p class="label">${rep.source === "demo" ? t("demo_label") : t("daily")} · ${esc(fmtTime(rep.at))}</p><button class="iconbtn" id="readsum" aria-label="${esc(t("read_aloud"))}" title="${esc(t("read_aloud"))}">${ic("speaker")}</button></div>
    <div class="sc-main"><span class="sc-badge">${ic(lv === "safe" ? "shield" : "alert")}</span><p class="big">${esc(headline)}</p></div>
    <div class="tally"><button class="ts" data-ef="scam"><b>${n.scam}</b>${t("scam")}</button><button class="tw" data-ef="warn"><b>${n.warn}</b>${t("warn")}</button><button class="tk" data-ef="safe"><b>${n.safe}</b>${t("safe")}</button></div>
    <p class="meta">${t("checked", { n: rep.items.length, d: dtxt })}${folderSummary(rep.items)}.${accountSummary(rep.items) ? `<br><b>${accountSummary(rep.items)}</b>` : ""}</p>`;
  h += `<div class="btnrow"><button class="btn primary" data-ef="all">${tr(`See all ${rep.items.length} emails`, `Ver los ${rep.items.length} correos`)}</button><button class="btn ghost" id="scan">${rep.source === "demo" ? t("scan_my") : rep.source === "gmail" ? t("scan_again") : tr("Scan email again", "Revisar el correo otra vez")}</button></div></section>
    ${homeActionsHTML()}</div>`;
  view.innerHTML = h;
  document.getElementById("scan").onclick = scanEmail;
  document.getElementById("readsum").onclick = () =>
    speak(
      `${headline} ` +
        rep.items
          .filter(i => i.level !== "safe")
          .map(i => ` ${LV[i.level].word}: ${i.fromName || i.fromEmail}, ${i.subject}.`)
          .join("")
    );
  view.querySelectorAll("[data-ef]").forEach(
    b =>
      (b.onclick = () => {
        filter = b.dataset.ef;
        go("emails");
      })
  );
  bindGo();
}
function renderEmails() {
  const rep = S.get("report", null);
  if (!rep) {
    go("today");
    return;
  }
  // With more than one inbox, people can look at one inbox at a time.
  const srcs = [...new Set(rep.items.map(i => i.source).filter(x => SRC_NAME[x]))];
  if (!srcs.includes(acctFilter)) acctFilter = "all";
  const A =
    srcs.length > 1
      ? [
          ["all", tr("All inboxes", "Todos los buzones"), rep.items.length],
          ...srcs.map(k => [k, SRC_NAME[k], rep.items.filter(i => i.source === k).length])
        ]
      : [];
  const base = rep.items.filter(i => acctFilter === "all" || i.source === acctFilter);
  const n = { scam: 0, warn: 0, safe: 0 };
  base.forEach(i => n[i.level]++);
  if (!["all", "scam", "warn", "safe"].includes(filter)) filter = "all";
  const F = [
    ["all", tr("All", "Todos"), base.length],
    ["scam", t("scam"), n.scam],
    ["warn", t("warn"), n.warn],
    ["safe", t("safe"), n.safe]
  ].filter(f => f[0] === "all" || f[2] > 0 || filter === f[0]);
  const rank = { scam: 0, warn: 1, safe: 2 };
  const shown = base
    .filter(i => filter === "all" || i.level === filter)
    .sort((a, b) => rank[a.level] - rank[b.level]);
  const dtxt = rep.days === 1 ? t("d24") : t("ddays", { n: rep.days });
  const aiNote =
    rep.source === "demo" && !rep.ai
      ? t("ai_demo")
      : rep.ai
        ? t("ai_checked", { n: rep.aiChecked })
        : t("ai_off");
  view.innerHTML = `${pageHead(tr("Your emails", "Sus correos"), t("checked", { n: rep.items.length, d: dtxt }) + ".", "today")}
    ${A.length ? `<div class="seg wide acct" role="group" aria-label="${esc(tr("Inbox", "Buzón"))}">${A.map(([k, l, c]) => `<button data-a="${k}" aria-pressed="${acctFilter === k}">${l} <span class="segn">${c}</span></button>`).join("")}</div>` : ""}
    <div class="seg wide" role="group">${F.map(([k, l, c]) => `<button data-f="${k}" aria-pressed="${filter === k}">${l} <span class="segn">${c}</span></button>`).join("")}</div>
    <div class="list" style="margin-top:12px">${shown.length ? shown.map((it, idx) => itemHTML(it, idx)).join("") : `<div class="empty card">${tr("Nothing here.", "Nada aquí.")}</div>`}</div>
    <p class="footnote" style="margin-top:12px">${ic("info")}<span>${aiNote}</span></p>`;
  bindBack();
  view.querySelectorAll("[data-f]").forEach(
    b =>
      (b.onclick = () => {
        filter = b.dataset.f;
        renderEmails();
      })
  );
  view.querySelectorAll("[data-a]").forEach(
    b =>
      (b.onclick = () => {
        acctFilter = b.dataset.a;
        renderEmails();
      })
  );
  bindItems(shown);
}
const FOLDER_ES = {
  Inbox: "Recibidos",
  Promotions: "Promociones",
  Social: "Social",
  Updates: "Notificaciones",
  Forums: "Foros",
  Archived: "Archivados",
  Spam: "Spam",
  Trash: "Papelera"
};
const fname = f => (uiLang() === "es" ? FOLDER_ES[f] || f : xl(f));
function folderSummary(items) {
  const n = {};
  items.forEach(i => {
    if (i.folder) n[i.folder] = (n[i.folder] || 0) + 1;
  });
  const order = ["Inbox", "Promotions", "Social", "Updates", "Forums", "Archived", "Spam", "Trash"].filter(
    k => n[k]
  );
  return order.length
    ? ` ${tr("across all folders", "en todas las carpetas")} (${order.map(k => `${fname(k)} ${n[k]}`).join({ fa: "، ", ar: "، ", zh: "、" }[langCode()] || ", ")})`
    : "";
}
/* Which inbox an email came from: a small Gmail or Outlook label. */
const SRC_NAME = { gmail: "Gmail", outlook: "Outlook" };
function srcPill(it) {
  return SRC_NAME[it.source] ? `<span class="pill src src-${it.source}">${SRC_NAME[it.source]}</span>` : "";
}
/* "Gmail 48 · Outlook 4" when more than one inbox was checked. */
function accountSummary(items) {
  const n = {};
  items.forEach(i => SRC_NAME[i.source] && (n[i.source] = (n[i.source] || 0) + 1));
  const keys = Object.keys(n);
  return keys.length > 1 ? keys.map(k => `${SRC_NAME[k]} ${n[k]}`).join(" · ") : "";
}
function explanation(it) {
  if (it.ai && it.ai.explanation) return it.ai.explanation;
  if (it.level === "safe") return it.local.trusted ? t("ex_trusted") : t("ex_none");
  return it.local.reasons[0] || t("ex_some");
}
function itemHTML(it, idx) {
  const L = LV[it.level];
  const kind = (it.ai && it.ai.scam_type) || cap(it.local.kind || "");
  return `<article class="item"><button aria-expanded="false" data-i="${idx}">
    <span class="dot ${L.dot}" aria-hidden="true">${L.icon}</span>
    <span style="min-width:0"><span class="who">${esc(it.fromName || it.fromEmail || "")}</span>
      <span class="subj" style="display:block">${esc(it.subject || "")}</span>
      <span class="why" style="display:block"><span class="pill ${L.pill}">${L.word}</span>${srcPill(it)}${it.folder ? `<span class="pill" style="background:var(--line);color:var(--muted)">${esc(fname(it.folder))}</span>` : ""}<span dir="auto">${it.level !== "safe" && kind ? esc(kind) : ""}</span></span></span>
  </button><div class="detail" hidden id="d${idx}"></div></article>`;
}
function detailHTML(it) {
  const ai = it.ai;
  const todo = ai && ai.what_to_do && ai.what_to_do.length ? ai.what_to_do : advice(it.level);
  let h = "";
  if (it.inSpam) h += `<p class="small" style="margin:0">${t("in_spam")}</p>`;
  else if (it.folder === "Trash") h += `<p class="small" style="margin:0">${t("in_trash")}</p>`;
  if (it.fromEmail)
    h += `<p class="small muted" style="margin:0">${t("from")} <b>${esc(it.fromEmail)}</b>${it.date ? ` · ${esc(fmtTime(it.date))}` : ""}</p>`;
  h += `<div class="ai-box"><p class="label">${ai ? t("ai_expl") : t("ss_says")}</p><p dir="auto">${esc(explanation(it))}</p>${ai ? `<p class="small muted">${t("ai_conf", { n: esc(ai.confidence) })}</p>` : ""}</div>`;
  const flags =
    ai && ai.red_flags && ai.red_flags.length
      ? [...ai.red_flags, ...it.local.reasons.slice(0, 2)]
      : it.local.reasons;
  if (ai && ai.verdict === "safe" && it.level !== "safe")
    h += `<p class="small" style="margin:0">${t("ai_overruled")}</p>`;
  if (it.level !== "safe" && flags.length)
    h += `<div><p class="label">${t("signs")}</p><ul dir="auto">${[...new Set(flags)]
      .slice(0, 6)
      .map(r => `<li>${esc(r)}</li>`)
      .join("")}</ul></div>`;
  h += `<div><p class="label">${t("todo")}</p><ol dir="auto">${todo.map(r => `<li>${esc(r)}</li>`).join("")}</ol></div>`;
  if (it.aiError && it.aiError !== "no-key")
    h += `<p class="small muted" style="margin:0">${t("ai_failed", { e: esc(it.aiError) })}</p>`;
  h += `<div class="row">`;
  if (it.source === "gmail")
    h += `<a class="btn ghost" href="https://mail.google.com/mail/u/0/#all/${encodeURIComponent(it.id)}" target="_blank" rel="noopener">${t("open_gmail")}</a>`;
  if (it.source === "outlook" && /^https:\/\/outlook\./.test(it.link || ""))
    h += `<a class="btn ghost" href="${esc(it.link)}" target="_blank" rel="noopener">${tr("Open in Outlook", "Abrir en Outlook")}</a>`;
  h += `<button class="btn ghost" data-speak>${t("read_aloud")}</button></div>`;
  if (it.level !== "safe" && it.source !== "paste")
    h += `<div class="row"><button class="btn ghost" data-real>${tr("This email is real", "Este correo es real")}</button><button class="btn ghost" data-askmahi>${tr("Ask Mahi about it", "Preguntarle a Mahi")}</button></div>`;
  return h;
}
function speakItem(it) {
  speak(
    `${LV[it.level].title}. ${it.fromName || ""} ${it.subject || ""}. ${explanation(it)} ${t("todo")}: ${((it.ai && it.ai.what_to_do) || advice(it.level)).join(". ")}`
  );
}
function bindItems(list) {
  view.querySelectorAll(".item>button").forEach(
    b =>
      (b.onclick = () => {
        const i = +b.dataset.i;
        const d = document.getElementById("d" + i);
        const open = b.getAttribute("aria-expanded") === "true";
        b.setAttribute("aria-expanded", String(!open));
        d.hidden = open;
        if (!open) {
          const it = list[i];
          d.innerHTML = detailHTML(it);
          d.querySelector("[data-speak]").onclick = () => speakItem(it);
          const real = d.querySelector("[data-real]");
          if (real)
            real.onclick = () => {
              // Remember this sender as real, and fix the label in the saved report.
              const dom = baseDomain((it.fromEmail || "").split("@")[1] || "");
              if (dom) S.set("mysenders", [...new Set([...S.get("mysenders", []), dom])]);
              const rep = S.get("report", null);
              if (rep) {
                rep.items.forEach(x => {
                  if (x.id === it.id) {
                    x.level = "safe";
                    x.ai = null;
                    x.local = Object.assign({}, x.local, {
                      level: "safe",
                      kind: "",
                      kindKey: "",
                      reasons: [
                        tr("You marked this sender as real.", "Usted marcó este remitente como real.")
                      ]
                    });
                  }
                });
                S.set("report", rep);
              }
              toast(
                tr(
                  `Marked as real. Emails from ${dom} will be trusted when Gmail's sender checks pass.`,
                  `Marcado como real. Los correos de ${dom} serán de confianza si pasan las verificaciones de Gmail.`
                )
              );
              go("emails");
            };
          const ask = d.querySelector("[data-askmahi]");
          if (ask)
            ask.onclick = () => {
              go("helper");
              const inp = document.getElementById("chatin");
              if (inp) {
                inp.value = tr(
                  `Is this email real or a scam? From ${it.fromName || ""} <${it.fromEmail || ""}>, subject "${it.subject || ""}"`,
                  `¿Este correo es real o una estafa? De ${it.fromName || ""} <${it.fromEmail || ""}>, asunto "${it.subject || ""}"`
                );
                document.getElementById("chatgo").click();
              }
            };
        }
      })
  );
}

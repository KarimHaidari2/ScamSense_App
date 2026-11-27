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
/* A risky email Gmail or Outlook already put in Spam or Trash on its own: nothing for them to do. */
function awayAlready(it) {
  return it.level !== "safe" && !it.autoMoved && (it.folder === "Spam" || it.folder === "Trash");
}
const FIRST_ITEMS = 40;
let listRender = 0;
function renderToday(opt) {
  opt = opt || {};
  const c = cfg();
  const rep = S.get("report", null);
  let h = "";
  if (opt.progress) {
    useHero(false);
    view.innerHTML = `<section class="card" aria-live="polite"><h2>${t("scanning")}</h2><p class="muted" style="margin:0">${esc(opt.progress.label)}</p><div class="progress"><i style="width:${Math.round(opt.progress.pct)}%"></i></div>
        <div class="privacy"><span aria-hidden="true">🔒</span><div>${t("scanning_note")}</div></div></section>`;
    return;
  }
  view.innerHTML = homeHTML(rep);
  bindHome();
}
function renderEmails() {
  const rep = S.get("report", null);
  if (!rep) {
    go("today");
    return;
  }
  // With more than one inbox, people can look at one inbox at a time.
  const keyOf = i => (typeof mailboxKey === "function" ? mailboxKey(i) : i.source);
  const nameOf = i => (typeof mailboxLabel === "function" ? mailboxLabel(i) : SRC_NAME[i.source]);
  const mine = rep.items.filter(i => SRC_NAME[i.source]);
  const srcs = [...new Set(mine.map(keyOf))];
  if (!srcs.includes(acctFilter)) acctFilter = "all";
  const A =
    srcs.length > 1
      ? [
          ["all", tr("All inboxes", "Todos los buzones"), rep.items.length],
          ...srcs.map(k => [
            k,
            esc(nameOf(mine.find(i => keyOf(i) === k))),
            mine.filter(i => keyOf(i) === k).length
          ])
        ]
      : [];
  const base = rep.items.filter(i => acctFilter === "all" || keyOf(i) === acctFilter);
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
  const picked = base
    .filter(i => filter === "all" || i.level === filter)
    .sort((a, b) => rank[a.level] - rank[b.level]);
  // Safe ads and newsletters go in their own folded group at the end.
  // Scams already sitting in Spam or Trash go in their own folded group, so the list starts with what matters.
  const away = picked.filter(awayAlready);
  const real = picked.filter(i => !i.ad && !awayAlready(i));
  const ads = picked.filter(i => i.ad && !awayAlready(i));
  const shown = real.concat(away, ads);
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
    <div class="list" id="mainlist" style="margin-top:12px">${
      real.length
        ? real
            .slice(0, FIRST_ITEMS)
            .map((it, idx) => itemHTML(it, idx))
            .join("")
        : ads.length || away.length
          ? ""
          : `<div class="empty card">${tr("Nothing here.", "Nada aquí.")}</div>`
    }</div>
    ${
      away.length
        ? `<details class="adgroup awaygroup"${real.length ? "" : " open"}><summary><span class="adg-ic">${ic("shield")}</span><span class="gl"><b>${tr(`Already in Spam or Trash (${away.length})`, `Ya en Spam o Papelera (${away.length})`)}</b><span>${tr("Your email already caught these. Don't open them. Nothing else to do.", "Su correo ya las atrapó. No las abra. No tiene que hacer nada más.")}</span></span>${ic("chev", "chev")}</summary><div class="list">${away.map((it, k) => itemHTML(it, real.length + k)).join("")}</div></details>`
        : ""
    }
    ${
      ads.length
        ? `<details class="adgroup"${real.length || away.length ? "" : " open"}><summary><span class="adg-ic">${ic("mail")}</span><span class="gl"><b>${tr(`Ads and newsletters (${ads.length})`, `Anuncios y boletines (${ads.length})`)}</b><span>${tr("Checked too. Nothing risky found.", "También revisados. No se encontró nada riesgoso.")}</span></span>${ic("chev", "chev")}</summary><div class="list">${ads.map((it, k) => itemHTML(it, real.length + away.length + k)).join("")}</div></details>`
        : ""
    }
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
  // Long lists: show the first emails right away, add the rest just after the screen appears.
  if (real.length > FIRST_ITEMS) {
    const myRender = ++listRender;
    setTimeout(() => {
      const box = document.getElementById("mainlist");
      if (!box || myRender !== listRender) return;
      box.insertAdjacentHTML(
        "beforeend",
        real
          .slice(FIRST_ITEMS)
          .map((it, k) => itemHTML(it, FIRST_ITEMS + k))
          .join("")
      );
      bindItems(shown);
    }, 60);
  }
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
  if (!SRC_NAME[it.source]) return "";
  // With more than one mailbox, name the address; otherwise just "Gmail" or "Outlook".
  const many = typeof hasExtraBoxes === "function" && hasExtraBoxes();
  const label = many && typeof mailboxLabel === "function" ? mailboxLabel(it) : SRC_NAME[it.source];
  return `<span class="pill src src-${it.source}" title="${esc(SRC_NAME[it.source])}">${esc(label)}</span>`;
}
/* "Gmail 48 · Outlook 4" when more than one inbox was checked. */
function accountSummary(items) {
  const n = {};
  const many = typeof hasExtraBoxes === "function" && hasExtraBoxes();
  items.forEach(i => {
    if (!SRC_NAME[i.source]) return;
    const k = many && typeof mailboxLabel === "function" ? mailboxLabel(i) : SRC_NAME[i.source];
    n[k] = (n[k] || 0) + 1;
  });
  const keys = Object.keys(n);
  if (keys.length > 3) return tr(`${keys.length} mailboxes`, `${keys.length} buzones`);
  return keys.length > 1 ? keys.map(k => `${k} ${n[k]}`).join(" · ") : "";
}
function explanation(it) {
  if (it.ai && it.ai.explanation) return it.ai.explanation;
  if (it.level === "safe") return it.local.trusted ? t("ex_trusted") : t("ex_none");
  return it.local.reasons[0] || t("ex_some");
}
/* Scam risk as a percentage, so people see how sure ScamSense is, not just a label.
   It always sits inside the label's own range (Scam 75–99%, Be careful 40–74%, Safe 1–25%):
   the AI's confidence places it within that range when the AI checked it; otherwise the rules' score does. */
const RISK_BAND = { scam: [75, 99], warn: [40, 74], safe: [1, 25] };
function riskPct(it) {
  const band = RISK_BAND[it.level] || RISK_BAND.warn;
  const clamp = x => Math.max(0, Math.min(1, x));
  let f;
  const ai = it.ai;
  const aiLevel = ai && ({ safe: "safe", suspicious: "warn", scam: "scam" }[ai.verdict] || ai.verdict);
  if (ai && aiLevel === it.level && ai.confidence != null) {
    const c = clamp(Number(ai.confidence) / 100);
    f = it.level === "safe" ? 1 - c : c;
  } else {
    const sc = Number((it.local && it.local.score) || 0);
    f = it.level === "scam" ? clamp((sc - 8) / 8) : it.level === "warn" ? clamp((sc - 4) / 4) : clamp(sc / 4);
  }
  return Math.round(band[0] + f * (band[1] - band[0]));
}
const riskPill = it =>
  `<span class="pill risk risk-${it.level}" title="${esc(tr("Scam risk", "Riesgo de estafa"))}">${tr(`${riskPct(it)}% risk`, `${riskPct(it)}% riesgo`)}</span>`;
function itemHTML(it, idx) {
  const L = LV[it.level];
  const kind = (it.ai && it.ai.scam_type) || cap(it.local.kind || "");
  return `<article class="item"><button aria-expanded="false" data-i="${idx}">
    <span class="dot ${L.dot}" aria-hidden="true">${L.icon}</span>
    <span style="min-width:0"><span class="who">${esc(it.fromName || it.fromEmail || "")}</span>
      <span class="subj" style="display:block">${esc(it.subject || "")}</span>
      <span class="why" style="display:block"><span class="pill ${L.pill}">${L.word}</span>${riskPill(it)}${it.autoMoved ? `<span class="pill moved">${tr("Moved to Spam for you", "Movido a Spam")}</span>` : ""}${srcPill(it)}${it.folder ? `<span class="pill" style="background:var(--line);color:var(--muted)">${esc(fname(it.folder))}</span>` : ""}<span dir="auto">${it.level !== "safe" && kind ? esc(kind) : ""}</span></span></span>
  </button><div class="detail" hidden id="d${idx}"></div></article>`;
}
function detailHTML(it) {
  const ai = it.ai;
  const todo = ai && ai.what_to_do && ai.what_to_do.length ? ai.what_to_do : advice(it.level);
  let h = "";
  if (it.inSpam && !it.autoMoved) h += `<p class="small" style="margin:0">${t("in_spam")}</p>`;
  else if (it.folder === "Trash") h += `<p class="small" style="margin:0">${t("in_trash")}</p>`;
  if (it.fromEmail)
    h += `<p class="small muted" style="margin:0">${t("from")} <b>${esc(it.fromEmail)}</b>${it.date ? ` · ${esc(fmtTime(it.date))}` : ""}</p>`;
  h += `<div class="ai-box"><p class="label">${ai ? t("ai_expl") : t("ss_says")}</p><p dir="auto">${esc(explanation(it))}</p><p class="small muted">${tr(`Scam risk: ${riskPct(it)}%`, `Riesgo de estafa: ${riskPct(it)}%`)}${ai && ai.confidence != null ? ` · ${t("ai_conf", { n: esc(ai.confidence) })}` : ` · ${tr("from ScamSense's built-in checks", "según las revisiones de ScamSense")}`}</p></div>`;
  // AI warning signs first, then built-in ones the AI didn't already mention (same link or address).
  const quoted = r => ((r.match(/"([^"]+)"|\(([^)]+)\)/) || [])[1] || "").toLowerCase();
  const aiText = ((ai && ai.red_flags) || []).join(" ").toLowerCase();
  const flags =
    ai && ai.red_flags && ai.red_flags.length
      ? [
          ...ai.red_flags,
          ...it.local.reasons.filter(r => !(quoted(r) && aiText.includes(quoted(r)))).slice(0, 2)
        ]
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
  h += emailActionsHTML(it);
  if (it.level !== "safe" && it.source !== "paste")
    h += `<div class="row"><button class="btn ghost" data-real>${tr("This email is real", "Este correo es real")}</button><button class="btn ghost" data-askmahi>${tr("Ask Mahi about it", "Preguntarle a Mahi")}</button></div>`;
  if (it.source !== "paste" && serverOn())
    h += `<div class="row"><button class="btn ghost" data-team>${ic("user")} ${tr("Send to the ScamSense team", "Enviar al equipo de ScamSense")}</button></div>`;
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
          bindEmailActions(d, it, () => {
            // Show where the email went, then redraw this email's details.
            const x = ((S.get("report", null) || {}).items || []).find(y => y.id === it.id);
            if (x) Object.assign(it, { folder: x.folder, inSpam: x.inSpam });
            b.click();
            b.click();
          });
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
          const team = d.querySelector("[data-team]");
          if (team) team.onclick = () => openSupport("email", emailForTeam(it));
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

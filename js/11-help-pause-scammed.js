/*
 * ScamSense · Help: Pause and I was scammed
 * Pause before you pay, and the I was scammed recovery plan with trusted contacts.
 */
"use strict";

/* ----- Help: Pause before you pay + I was scammed ----- */
function helpCardsHTML() {
  return `<div class="help-cards">
    <button class="help-card hc-pause" data-h="pause"><span class="hc-icon" aria-hidden="true">${ic("hand")}</span><span><b>${t("pause_card")}</b><span>${t("pause_card_sub")}</span></span></button>
    <button class="help-card hc-sos" data-h="scammed"><span class="hc-icon" aria-hidden="true">${ic("sos")}</span><span><b>${t("scammed_card")}</b><span>${t("scammed_card_sub")}</span></span></button></div>`;
}
function bindHelpCards() {
  view
    .querySelectorAll("[data-h]")
    .forEach(b => (b.onclick = () => go(b.dataset.h === "pause" ? "pause" : "scammed")));
}
function renderHelp() {
  const tile = (go, icn, cls, title, sub) =>
    `<button class="tile" data-go="${go}"><span class="tile-ic ${cls}">${ic(icn)}</span><span class="tile-tx"><b>${title}</b><span>${sub}</span></span>${ic("chev", "chev")}</button>`;
  view.innerHTML = `${pageHead(t("help_title"), tr("Stop a payment, or recover after a scam.", "Detenga un pago o recupérese de una estafa."))}
  <div class="tiles">
    ${tile("pause", "hand", "t-call", t("pause_card"), t("pause_card_sub"))}
    ${tile("scammed", "sos", "t-sos", t("scammed_card"), t("scammed_card_sub"))}</div>
  <section class="sect"><h2 class="sect-h">${tr("Stay sharp", "Manténgase alerta")}</h2><div class="tiles">
    ${tile("learn", "spark", "t-dev", tr("Learn about scams", "Aprenda sobre estafas"), tr("Short lessons, one minute each.", "Lecciones cortas, de un minuto."))}
    ${tile("monthly", "bell", "t-mail", tr("Your monthly report", "Su reporte mensual"), tr("What reached you, and lessons picked for you.", "Qué le llegó y lecciones para usted."))}</div></section>`;
  bindGo();
}
const opt = (v, key, sel) => `<option value="${v}" ${sel === v ? "selected" : ""}>${t(key)}</option>`;
let pauseState = { who: "", how: "", amt: "", note: "" };
function renderPause() {
  const p = pauseState;
  view.innerHTML = `${pageHead(t("p_title"), t("p_sub"), "help")}
  <section class="card">
    <div class="field"><label for="pw">${t("p_who")}</label><select id="pw"><option value=""></option>${["gov", "tech", "family", "online", "prize", "company", "seller", "other"].map(k => opt(k, "who_" + k, p.who)).join("")}</select></div>
    <div class="field"><label for="ph">${t("p_how")}</label><select id="ph"><option value=""></option>${["gift", "crypto", "wire", "p2p", "cash", "card", "check", "other"].map(k => opt(k, "how_" + k, p.how)).join("")}</select></div>
    <div class="field"><label for="pa">${t("p_amt")}</label><input id="pa" inputmode="decimal" placeholder="$500" value="${esc(p.amt)}"></div>
    <div class="field"><label for="pn">${t("p_note")}</label><textarea id="pn" dir="auto" placeholder="${esc(t("p_note_ph"))}">${esc(p.note)}</textarea></div>
    <button class="btn primary" id="pgo">${t("p_go")}</button></section><section id="presult" aria-live="polite"></section>`;
  bindBack();
  document.getElementById("pgo").onclick = runPause;
}
function assessPayment(p) {
  let score = 0;
  const reasons = [];
  const add = (n, k) => {
    score += n;
    reasons.push(t(k));
  };
  (
    ({
      gift: () => add(10, "r_gift"),
      crypto: () => add(9, "r_crypto"),
      wire: () => add(6, "r_wire"),
      p2p: () => add(4, "r_p2p"),
      cash: () => add(9, "r_cash"),
      check: () => add(2, "r_check")
    })[p.how] || (() => {})
  )();
  (
    ({
      gov: () => add(8, "r_gov"),
      tech: () => add(8, "r_tech"),
      family: () => add(4, "r_family"),
      online: () => add(8, "r_online"),
      prize: () => add(8, "r_prize"),
      company: () => add(3, "r_company"),
      seller: () => add(2, "r_seller")
    })[p.who] || (() => {})
  )();
  if (p.note) {
    const s = textSignals(p.note);
    score += s.score;
    s.reasons.forEach(r => {
      if (!reasons.includes(r)) reasons.push(r);
    });
  }
  const amt = parseFloat(String(p.amt).replace(/[^\d.]/g, ""));
  if (amt >= 1000) {
    score += 1;
    reasons.push(t("r_big"));
  }
  return { score, reasons, level: score >= 8 ? "scam" : score >= 4 ? "warn" : "safe" };
}
let stillTimer = null;
async function runPause() {
  pauseState = {
    who: document.getElementById("pw").value,
    how: document.getElementById("ph").value,
    amt: document.getElementById("pa").value.trim(),
    note: document.getElementById("pn").value.trim()
  };
  const out = document.getElementById("presult");
  const btn = document.getElementById("pgo");
  const r = assessPayment(pauseState);
  let ai = null;
  const c = cfg();
  if (c.apiKey && c.aiMode !== "off" && (pauseState.note || pauseState.who)) {
    btn.disabled = true;
    btn.textContent = t("checking");
    const story = `Someone is asking me to pay. Who: ${pauseState.who ? STR.en["who_" + pauseState.who] : "unknown"}. How: ${pauseState.how ? STR.en["how_" + pauseState.how] : "unknown"}. Amount: ${pauseState.amt || "unknown"}. What they said: ${pauseState.note || "(not given)"}`;
    try {
      ai = await aiCheck({
        channel: "payment request",
        text: story,
        links: [],
        attachments: [],
        local: { reasons: r.reasons }
      });
    } catch (e) {
      if (e.message !== "no-key") toast(e.message);
    }
    btn.disabled = false;
    btn.textContent = t("p_go");
  }
  let level = r.level;
  if (ai) {
    level = ai.verdict;
    if (r.score >= 8 && level !== "scam") level = "scam";
  }
  const head = { scam: ["p_stop", "p_stop_sub"], warn: ["p_wait", "p_wait_sub"], safe: ["p_ok", "p_ok_sub"] }[
    level
  ];
  const reasons = ai && ai.red_flags ? [...ai.red_flags, ...r.reasons] : r.reasons;
  out.innerHTML = `<div class="card pause-card pc-${level}">
    <div class="pause-head"><span class="pause-hand" aria-hidden="true">${level === "safe" ? ic("check") : ic("hand")}</span><div><h3>${t(head[0])}</h3><p>${t(head[1])}</p></div></div>
    ${ai && ai.explanation ? `<div class="ai-box"><p class="label">${t("ai_expl")}</p><p dir="auto">${esc(ai.explanation)}</p></div>` : ""}
    ${
      reasons.length
        ? `<div><p class="label">${t("p_why")}</p><ul dir="auto">${[...new Set(reasons)]
            .slice(0, 6)
            .map(x => `<li>${esc(x)}</li>`)
            .join("")}</ul></div>`
        : ""
    }
    <div><p class="label">${t("p_before")}</p><ol><li>${t("p_b1")}</li><li>${t("p_b2")}</li><li>${t("p_b3")}</li><li>${t("p_b4")}</li></ol></div>
    ${(() => {
      const h = S.get("helpers", []).find(x => x.phone);
      return h && famPrefs().callBeforePay && level !== "safe"
        ? `<a class="btn callhelper" href="tel:${esc(h.phone.replace(/[^\d+]/g, ""))}">${ic("phone")}<span>${tr(`Call ${h.name} before you pay`, `Llame a ${h.name} antes de pagar`)}</span></a>`
        : "";
    })()}
    <div class="row"><button class="btn primary" id="pwont">${t("p_wont")}</button><button class="btn ghost" id="ppaid">${t("p_paid")}</button></div>
    <button class="btn ghost" id="pstill" disabled>${t("p_still", { n: 10 })}</button>
    <p id="pmsg" class="small" style="margin:0" hidden></p>
    <button class="btn ghost" id="pread">${t("read_aloud")}</button></div>`;
  const pmsg = document.getElementById("pmsg");
  document.getElementById("pwont").onclick = () => {
    pmsg.hidden = false;
    pmsg.textContent = t("p_good");
    const h = S.get("paused", []);
    h.push({ at: Date.now(), level });
    S.set("paused", h.slice(-50));
  };
  document.getElementById("ppaid").onclick = () => {
    scamState = Object.assign(scamState, {
      what: ["paid"],
      method:
        { gift: "gift", crypto: "crypto", wire: "wire", p2p: "bank", cash: "courier", card: "credit" }[
          pauseState.how
        ] || "",
      amt: pauseState.amt,
      story: pauseState.note
    });
    go("scammed");
  };
  document.getElementById("pread").onclick = () =>
    speak(
      `${t(head[0])} ${t(head[1])} ${ai && ai.explanation ? ai.explanation : ""} ${reasons.slice(0, 4).join(" ")} ${t("p_before")}: ${t("p_b1")} ${t("p_b2")} ${t("p_b3")}`
    );
  // the "I still want to pay" button unlocks only after a 10-second pause
  clearInterval(stillTimer);
  let left = 10;
  const still = document.getElementById("pstill");
  stillTimer = setInterval(() => {
    left--;
    if (!document.body.contains(still)) {
      clearInterval(stillTimer);
      return;
    }
    if (left <= 0) {
      clearInterval(stillTimer);
      still.disabled = false;
      still.textContent = t("p_still_ready");
    } else still.textContent = t("p_still", { n: left });
  }, 1000);
  still.onclick = () => {
    pmsg.hidden = false;
    pmsg.textContent = t("p_still_msg");
  };
  out.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* I was scammed: a recovery plan built from the FTC's guidance (consumer.ftc.gov/articles/what-do-if-you-were-scammed) */
let scamState = {
  how: "",
  what: [],
  method: "",
  amt: "",
  date: "",
  pretend: "",
  org: "",
  bank: "",
  bankName: "",
  last4: "",
  contact: "",
  story: ""
};
const CONTACTS = {
  ftc: {
    n: "FTC: ReportFraud.ftc.gov",
    w: "https://reportfraud.ftc.gov",
    en: "Report any scam. The FTC shares reports with law enforcement.",
    es: "Reporte cualquier estafa. La FTC comparte los reportes con las autoridades."
  },
  ic3: {
    n: "FBI: IC3.gov",
    w: "https://www.ic3.gov",
    en: "Report online, email, text, and crypto scams to the FBI.",
    es: "Reporte al FBI estafas por internet, correo, texto y criptomonedas."
  },
  elder: {
    n: "National Elder Fraud Hotline",
    p: "1-833-372-8311",
    en: "For ages 60+. A case manager helps you report and recover.",
    es: "Para mayores de 60. Un especialista le ayuda a reportar y recuperarse."
  },
  aarp: {
    n: "AARP Fraud Watch Helpline",
    p: "877-908-3360",
    en: "Free help from trained volunteers. Mon–Fri, 8 AM–8 PM ET.",
    es: "Ayuda de voluntarios capacitados. Lun–Vie, 8 AM–8 PM ET."
  },
  usps: {
    n: "U.S. Postal Inspection Service",
    p: "1-877-876-2455",
    en: "Call right away if you mailed cash. They may stop the package.",
    es: "Llame de inmediato si envió efectivo por correo. Pueden detener el paquete."
  },
  idt: {
    n: "IdentityTheft.gov",
    w: "https://www.identitytheft.gov",
    en: "Get a personal recovery plan if your Social Security number was taken.",
    es: "Reciba un plan de recuperación si le robaron su número de Seguro Social."
  },
  equifax: {
    n: "Equifax credit freeze",
    p: "1-800-685-1111",
    w: "https://www.equifax.com/personal/credit-report-services/credit-freeze/",
    en: "Free. Stops new accounts in your name.",
    es: "Gratis. Impide abrir cuentas nuevas a su nombre."
  },
  experian: {
    n: "Experian credit freeze",
    p: "1-888-397-3742",
    w: "https://www.experian.com/freeze/center.html",
    en: "Free. Do all three bureaus.",
    es: "Gratis. Hágalo en las tres agencias."
  },
  transunion: {
    n: "TransUnion credit freeze",
    p: "1-888-909-8872",
    w: "https://www.transunion.com/credit-freeze",
    en: "Free. Do all three bureaus.",
    es: "Gratis. Hágalo en las tres agencias."
  }
};
/* Fraud contacts checked on each organization's official website on Nov 7, 2026. */
const ORGS = {
  chase: {
    n: "Chase",
    kind: "bank",
    re: /\bchase\b|jp ?morgan/i,
    lines: [
      ["Checking, savings, debit card", "Cuenta de cheques, ahorros, débito", "1-800-935-9935", "option 8"],
      ["Credit card", "Tarjeta de crédito", "1-800-955-9060", "option 2"]
    ],
    w: "https://www.chase.com/digital/resources/privacy-security/security/report-fraud"
  },
  bofa: {
    n: "Bank of America",
    kind: "bank",
    re: /bank of america|\bbofa\b/i,
    lines: [
      ["ATM, debit, check, Zelle", "Cajero, débito, cheque, Zelle", "800-432-1000"],
      ["Credit card", "Tarjeta de crédito", "800-732-9194"],
      ["Wire transfer", "Transferencia", "877-337-8357"]
    ],
    w: "https://web.bankofamerica.com/en/security/report-suspicious-activity"
  },
  wells: {
    n: "Wells Fargo",
    kind: "bank",
    re: /wells ?fargo/i,
    lines: [
      [
        "Checking, savings, debit, identity theft",
        "Cheques, ahorros, débito, robo de identidad",
        "1-800-869-3557"
      ],
      [
        "Zelle, online transfers, clicked a link or shared a code",
        "Zelle, transferencias, hizo clic en un enlace o dio un código",
        "1-866-867-5568"
      ]
    ],
    w: "https://www.wellsfargo.com/privacy-security/fraud/report/"
  },
  capone: {
    n: "Capital One",
    kind: "bank",
    re: /capital ?one/i,
    lines: [],
    w: "https://www.capitalone.com/help-center/fraud-disputes/report-fraud/",
    en: "Report fraud in the Capital One app or website, or call the number on the back of your card.",
    es: "Reporte el fraude en la app o sitio de Capital One, o llame al número del reverso de su tarjeta."
  },
  bankother: {
    n: "",
    kind: "bank",
    re: /credit union|\bbank\b/i,
    lines: [],
    en: "Call the fraud number on the back of your card, on your bank statement, or on your bank's official website. Never use a number the scammer gave you.",
    es: "Llame al número de fraude en el reverso de su tarjeta, en su estado de cuenta o en el sitio oficial de su banco. Nunca use un número que le dio el estafador."
  },
  amazon: {
    n: "Amazon",
    kind: "company",
    re: /amazon/i,
    lines: [],
    w: "https://www.amazon.com/reportascam",
    mail: "reportascam@amazon.com",
    en: "Amazon says it will never ask for payment over the phone or email. Report the scam at amazon.com/reportascam. If you paid, also call your bank or card company.",
    es: "Amazon dice que nunca pide pagos por teléfono ni correo. Reporte la estafa en amazon.com/reportascam. Si pagó, llame también a su banco o tarjeta."
  },
  apple: {
    n: "Apple",
    kind: "company",
    re: /apple|icloud|itunes/i,
    lines: [],
    w: "https://support.apple.com/102568",
    mail: "reportphishing@apple.com",
    en: "Forward scam emails (or screenshots of scam texts) to reportphishing@apple.com. Apple says never use Apple Gift Cards to pay other people.",
    es: "Reenvíe correos de estafa (o capturas de textos) a reportphishing@apple.com. Apple dice que nunca use tarjetas de regalo de Apple para pagarle a otras personas."
  },
  microsoft: {
    n: "Microsoft",
    kind: "company",
    re: /microsoft|windows|outlook support/i,
    lines: [],
    w: "https://microsoft.com/reportascam",
    en: "Microsoft says it won't call you to offer tech support unless you contacted it first. Report the scam at microsoft.com/reportascam.",
    es: "Microsoft dice que no le llama para ofrecer soporte técnico a menos que usted lo haya contactado primero. Reporte la estafa en microsoft.com/reportascam."
  },
  paymentapp: {
    n: "PayPal, Venmo, or Cash App",
    kind: "company",
    re: /paypal|venmo|cash ?app/i,
    lines: [],
    en: "Report the payment inside the app (open Help or the payment, then report it) and ask them to reverse it. Don't call a number from a search ad or from the scammer.",
    es: "Reporte el pago dentro de la app (abra Ayuda o el pago y repórtelo) y pida revertirlo. No llame a números de anuncios ni del estafador."
  },
  ssa: {
    n: "Social Security (SSA)",
    kind: "gov",
    re: /social security|\bssa\b/i,
    lines: [
      [
        "Social Security Fraud Hotline (OIG), Mon–Fri 10 AM–2 PM ET",
        "Línea de fraude del Seguro Social (OIG), lun–vie 10 AM–2 PM ET",
        "1-800-269-0271"
      ]
    ],
    w: "https://oig.ssa.gov",
    en: "Report Social Security impersonators to the Office of the Inspector General.",
    es: "Reporte a quienes se hacen pasar por el Seguro Social a la Oficina del Inspector General."
  },
  medicare: {
    n: "Medicare",
    kind: "gov",
    re: /medicare|medicaid/i,
    lines: [
      ["1-800-MEDICARE", "1-800-MEDICARE", "1-800-633-4227"],
      ["HHS fraud hotline (1-800-HHS-TIPS)", "Línea de fraude de HHS (1-800-HHS-TIPS)", "1-800-447-8477"]
    ],
    w: "https://tips.oig.hhs.gov",
    en: "If someone asked for your Medicare number, report it to 1-800-MEDICARE.",
    es: "Si alguien le pidió su número de Medicare, repórtelo al 1-800-MEDICARE."
  },
  irs: {
    n: "IRS (report to TIGTA)",
    kind: "gov",
    re: /\birs\b|internal revenue|tax/i,
    lines: [["TIGTA (IRS impersonation)", "TIGTA (suplantación del IRS)", "800-366-4484"]],
    w: "https://www.tigta.gov",
    en: "Report IRS impersonators to the Treasury Inspector General for Tax Administration (TIGTA).",
    es: "Reporte a quienes se hacen pasar por el IRS al Inspector General del Tesoro (TIGTA)."
  },
  insurance: {
    n: "",
    kind: "insurance",
    re: /insurance|state farm|geico|progressive|allstate|aetna|humana|united ?health|blue cross/i,
    lines: [],
    en: "Call the number on your insurance card or policy, or your own agent. Tell them someone pretended to be them, and ask them to note your account.",
    es: "Llame al número de su tarjeta o póliza de seguro, o a su agente. Diga que alguien se hizo pasar por ellos y pida que lo anoten en su cuenta."
  },
  other: {
    n: "",
    kind: "company",
    re: null,
    lines: [],
    en: "Contact the real company using a number or website you find yourself (on a bill, your account, or the official website). Tell them someone is pretending to be them.",
    es: "Contacte a la empresa real con un número o sitio que usted mismo encuentre (en una factura, su cuenta o el sitio oficial). Dígales que alguien se hace pasar por ellos."
  }
};
const ORG_LABEL = {
  chase: "Chase",
  bofa: "Bank of America",
  wells: "Wells Fargo",
  capone: "Capital One",
  bankother: ["Another bank or credit union", "Otro banco o cooperativa"],
  amazon: "Amazon",
  apple: "Apple",
  microsoft: "Microsoft",
  paymentapp: "PayPal, Venmo, or Cash App",
  ssa: ["Social Security", "Seguro Social"],
  medicare: "Medicare",
  irs: "IRS",
  insurance: ["An insurance company", "Una compañía de seguros"],
  other: ["Another company or person", "Otra empresa o persona"]
};
const orgLabel = k => {
  const l = ORG_LABEL[k];
  return Array.isArray(l) ? tr(l[0], l[1]) : l;
};
function detectOrg(txt) {
  if (!txt) return "";
  for (const k of Object.keys(ORGS)) {
    if (ORGS[k].re && ORGS[k].re.test(txt)) return k;
  }
  return "";
}
function orgName(k, custom) {
  return (ORGS[k] && ORGS[k].n) || custom || orgLabel(k) || "";
}
function orgCardHTML(k, custom, role) {
  const o = ORGS[k];
  if (!o) return "";
  const nm = orgName(k, custom);
  return `<div class="org-card"><div class="org-head"><span class="org-role">${esc(role)}</span><b>${esc(nm)}</b></div>
    ${o.lines.map(l => `<a class="org-line" href="tel:${l[2].replace(/[^\d]/g, "")}"><span>${esc(tr(l[0], l[1]))}${l[3] ? ` <span class="muted">(${esc(l[3])})</span>` : ""}</span><b>📞 ${esc(l[2])}</b></a>`).join("")}
    ${o.en ? `<p class="small" style="margin:0">${esc(tr(o.en, o.es))}</p>` : ""}
    <div class="contact-acts">${o.w ? `<a class="btn ghost sm" href="${o.w}" target="_blank" rel="noopener">${tr("Official website", "Sitio oficial")} ↗</a>` : ""}${o.mail ? `<span class="btn ghost sm" style="cursor:text;user-select:all">✉ ${esc(o.mail)}</span>` : ""}</div></div>`;
}
function contactHTML(k) {
  const c = CONTACTS[k];
  return `<div class="contact"><div><b>${esc(c.n)}</b><span class="small muted">${esc(tr(c.en, c.es))}</span></div>
  <div class="contact-acts">${c.p ? `<a class="btn ghost sm" href="tel:${c.p.replace(/[^\d]/g, "")}">📞 ${esc(c.p)}</a>` : ""}${c.w ? `<a class="btn ghost sm" href="${c.w}" target="_blank" rel="noopener">${tr("Website", "Sitio web")} ↗</a>` : ""}</div></div>`;
}
function renderScammed() {
  const s = scamState;
  const today = new Date().toISOString().slice(0, 10);
  const chk = k =>
    `<label class="checkrow"><input type="checkbox" value="${k}" ${s.what.includes(k) ? "checked" : ""}> ${t("w_" + k)}</label>`;
  view.innerHTML = `${pageHead(t("s_title"), t("s_sub"), "help")}
  <section class="card">
    <div class="example-box"><div><b>${tr("See how it works", "Vea cómo funciona")}</b><span class="small">${tr('Fill in a made-up case: a fake "Chase Fraud Department" call, with sample screenshots.', 'Llene un caso inventado: una llamada falsa del "Departamento de Fraude de Chase", con capturas de ejemplo.')}</span></div>
      <button class="btn ghost sm" id="sexample">${tr("Try an example", "Probar un ejemplo")}</button></div>
    ${scamExample ? `<p class="small examplenote">${tr("This is an example case. Change anything, or tap Clear to start your own.", "Este es un caso de ejemplo. Cambie lo que quiera, o toque Borrar para empezar el suyo.")} <button class="linkbtn" id="sclear">${tr("Clear", "Borrar")}</button></p>` : ""}
    <div class="field"><label for="sh">${t("s_how")}</label><select id="sh"><option value=""></option>${["email", "text", "call", "web", "social", "person"].map(k => opt(k, "c_" + k, s.how)).join("")}</select></div>
    <fieldset class="field checks"><legend>${t("s_what")}</legend>${["paid", "bank", "ssn", "pass", "remote"].map(chk).join("")}</fieldset>
    <div class="field"><label for="sm">${t("s_method")}</label><select id="sm"><option value=""></option>${["credit", "debit", "bank", "wire", "app", "gift", "crypto", "cashmail", "courier", "none"].map(k => opt(k, "m_" + k, s.method)).join("")}</select></div>
    <div class="two"><div class="field"><label for="sa">${t("s_amt")}</label><input id="sa" inputmode="decimal" placeholder="$500" value="${esc(s.amt)}"></div>
      <div class="field"><label for="sd">${t("s_date")}</label><input id="sd" type="date" value="${esc(s.date || today)}"></div></div>
    <div class="field"><label for="so">${t("s_pretend")}</label><select id="so"><option value=""></option>${Object.keys(
      ORGS
    )
      .map(k => `<option value="${k}" ${s.org === k ? "selected" : ""}>${esc(orgLabel(k))}</option>`)
      .join("")}</select></div>
    <div class="field" id="spwrap"><label for="sp">${tr("Name they used (optional)", "Nombre que usaron (opcional)")}</label><input id="sp" placeholder="${esc(t("s_pretend_ph"))}" value="${esc(s.pretend)}"></div>
    <div class="field"><label for="sb">${tr("Your bank or card company (where the money or details came from)", "Su banco o tarjeta (de donde salió el dinero o los datos)")}</label><select id="sb"><option value="">${tr("Not needed / I didn't pay", "No aplica / no pagué")}</option>${["chase", "bofa", "wells", "capone", "bankother", "paymentapp"].map(k => `<option value="${k}" ${s.bank === k ? "selected" : ""}>${esc(orgLabel(k))}</option>`).join("")}</select></div>
    <div class="two"><div class="field"><label for="sbn">${tr("Bank name (if other)", "Nombre del banco (si es otro)")}</label><input id="sbn" value="${esc(s.bankName || "")}"></div>
      <div class="field"><label for="sl4">${tr("Last 4 digits of card or account", "Últimos 4 dígitos de tarjeta o cuenta")}</label><input id="sl4" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" placeholder="1234" value="${esc(s.last4 || "")}"></div></div>
    <p class="small muted" style="margin:0">🔒 ${tr("Only the last 4 digits. Never type a full card or account number into any app.", "Solo los últimos 4 dígitos. Nunca escriba el número completo en ninguna app.")}</p>
    <div class="field"><label for="sc">${t("s_contact")}</label><input id="sc" value="${esc(s.contact)}"></div>
    <div class="field"><label for="sx">${tr("Crypto details (if you paid with crypto)", "Datos cripto (si pagó con cripto)")}</label><textarea id="sx" class="short" dir="ltr" spellcheck="false" placeholder="${esc(tr("Wallet addresses, transaction IDs, and the website", "Billeteras, IDs de transacción y el sitio web"))}">${esc(s.crypto || "")}</textarea></div>
    <div class="field"><label for="ss">${t("s_story")}</label><textarea id="ss" dir="auto" placeholder="${esc(t("s_story_ph"))}">${esc(s.story)}</textarea></div>
    <div class="field"><label for="sf">${tr("Screenshots or photos (optional)", "Capturas o fotos (opcional)")}</label>
      <input id="sf" type="file" accept="image/*" multiple>
      <span class="small muted">${tr("Add texts, call logs, emails, receipts, or gift cards. They stay on this device and go into your PDF report.", "Agregue textos, llamadas, correos, recibos o tarjetas. Se quedan en este dispositivo y van en su reporte PDF.")}</span>
      <div class="thumbs" id="thumbs"></div></div>
    <button class="btn primary" id="sgo">${tr("Make my plan and documents", "Crear mi plan y documentos")}</button></section><section id="splan" aria-live="polite"></section>`;
  bindBack();
  document.getElementById("sgo").onclick = () => buildPlan(true);
  document.getElementById("sexample").onclick = loadExample;
  const sclr = document.getElementById("sclear");
  if (sclr)
    sclr.onclick = () => {
      scamExample = false;
      evidence = [];
      scamState = {
        how: "",
        what: [],
        method: "",
        amt: "",
        date: "",
        pretend: "",
        org: "",
        bank: "",
        bankName: "",
        last4: "",
        contact: "",
        story: ""
      };
      renderScammed();
    };
  document.getElementById("sf").onchange = e => {
    addEvidenceFiles([...e.target.files]);
    e.target.value = "";
  };
  renderThumbs();
  document.getElementById("sp").addEventListener("input", e => {
    const so = document.getElementById("so");
    const k = detectOrg(e.target.value);
    if (k && !so.value) so.value = k;
  });
  document.getElementById("sl4").addEventListener("input", e => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
  });
}

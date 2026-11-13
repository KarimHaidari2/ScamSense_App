/*
 * ScamSense · Check something
 * One box for everything: paste or say a text, an email, a phone number, a website, or a wallet address.
 * ScamSense works out what it is and checks it the right way.
 */
"use strict";

/* ----- What did the person paste? ----- */
const WALLET_RE =
  /^(0x[a-fA-F0-9]{40}|T[1-9A-HJ-NP-Za-km-z]{33}|bc1[a-z0-9]{20,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|[LM][a-km-zA-HJ-NP-Z1-9]{26,33}|r[1-9A-HJ-NP-Za-km-z]{24,34}|[1-9A-HJ-NP-Za-km-z]{32,44})$/;
function detectKind(raw) {
  const s = raw.trim();
  const oneWord = s.replace(/\s+/g, "");
  if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(s)) return "email";
  if (/^[+()\d\s.-]{7,}$/.test(s) && (s.match(/\d/g) || []).length >= 7) return "phone";
  if (!/\s/.test(s) && WALLET_RE.test(oneWord) && /\d/.test(oneWord)) return "wallet";
  if (!/\s/.test(s) && /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(oneWord)) return "website";
  return "message";
}
/* A phone number or email address written inside a message, so we can say who sent it. */
function senderIn(text) {
  const em = text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/);
  if (em) return { kind: "email", value: em[0] };
  const ph = text.match(/(\+?\d[\d\s().-]{8,}\d)/);
  if (ph && (ph[0].match(/\d/g) || []).length >= 10) return { kind: "phone", value: ph[0] };
  return null;
}

/* ----- Examples people can tap ----- */
const CHECK_EXAMPLES = [
  ["toll", () => t("ex_toll")],
  ["grand", () => t("ex_grand")],
  ["irs", () => t("ex_irs")],
  ["+1 (800) 555-0144", () => tr("Phone number", "Número de teléfono")],
  ["coinbase-pro-wallet.vip", () => tr("Website", "Sitio web")],
  ["TQ5kW8xZ3vN7pR2mY9bL4cF6hJ1aD8eS3u", () => tr("Wallet address", "Dirección de billetera")]
];

/* ----- Email accounts: Gmail, Outlook, and the ones coming next (used here and in Settings) ----- */
function emailAccountsHTML() {
  const lead = (icn, cls) => `<span class="lead-ic ${cls}">${ic(icn)}</span>`;
  const gmailOn = !!S.get("connected", false),
    outlookOn = outlookConnected();
  const anyOn = gmailOn || outlookOn;
  return `<div class="grow">${lead("mail", "l-red")}<span class="gl"><b>Gmail</b><span>${gmailOn ? tr("Connected · checks every folder", "Conectado · revisa todas las carpetas") : tr("Not connected", "No conectado")}</span></span>${gmailOn ? `<button class="btn sm ghost" id="gdisc">${tr("Disconnect", "Desconectar")}</button>` : `<button class="btn sm primary" id="gconn">${tr("Connect", "Conectar")}</button>`}</div>
    <div class="grow">${lead("mail", "l-blue")}<span class="gl"><b>Outlook, Hotmail, Live</b><span>${outlookOn ? tr("Connected · read-only", "Conectado · solo lectura") : outlookReady() ? tr("Not connected", "No conectado") : tr("Coming soon", "Próximamente")}</span></span>${outlookOn ? `<button class="btn sm ghost" id="odisc">${tr("Disconnect", "Desconectar")}</button>` : outlookReady() ? `<button class="btn sm primary" id="oconn">${tr("Connect", "Conectar")}</button>` : `<span class="badge">${tr("Soon", "Pronto")}</span>`}</div>
    <div class="grow">${lead("mail", "l-gray")}<span class="gl"><b>Yahoo, iCloud, AOL</b><span>${tr("Coming soon. For now, paste those emails into Check something.", "Próximamente. Por ahora, pegue esos correos en Revisar algo.")}</span></span><span class="badge">${tr("Soon", "Pronto")}</span></div>
    ${anyOn ? `<div class="grow"><button class="btn primary" id="escan">${tr("Scan my email now", "Revisar mi correo ahora")}</button></div>` : ""}`;
}
function bindEmailAccounts(rerender) {
  const on = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.onclick = fn;
  };
  on("gconn", async () => {
    try {
      await getToken(true);
      toast(t("gmail_ok"));
      go("today");
      scanEmail();
    } catch (e) {
      toast(e.message);
    }
  });
  on("gdisc", () => {
    try {
      if (token) google.accounts.oauth2.revoke(token, () => {});
    } catch (e) {}
    token = null;
    S.set("connected", false);
    setStatus();
    toast(t("gmail_off"));
    rerender();
  });
  on("oconn", () => connectOutlook());
  on("odisc", () => {
    disconnectOutlook();
    rerender();
  });
  on("escan", () => {
    go("today");
    scanEmail();
  });
}

/* ----- What kind of thing? Optional: each choice explains what to paste. Detection stays automatic. ----- */
const CHECK_KINDS = () => [
  [
    "email",
    "mail",
    "t-mail",
    tr("Email", "Correo"),
    tr("Connect your inbox, or paste one email below.", "Conecte su correo, o pegue un correo abajo."),
    tr(
      "Paste the email here, with the sender's address…",
      "Pegue el correo aquí, con la dirección del remitente…"
    )
  ],
  [
    "text",
    "msg",
    "t-msg",
    tr("Text message", "Mensaje de texto"),
    tr("Paste the text and the number it came from.", "Pegue el texto y el número del que vino."),
    tr("Paste the text message here…", "Pegue el mensaje de texto aquí…")
  ],
  [
    "call",
    "phone",
    "t-call",
    tr("Phone call", "Llamada"),
    tr("Type the phone number, or what the caller said.", "Escriba el número, o lo que dijo quien llamó."),
    tr(
      "Example: (800) 555-0144, or: A man said he was from my bank…",
      "Ejemplo: (800) 555-0144, o: Un hombre dijo que era de mi banco…"
    )
  ],
  [
    "web",
    "globe",
    "t-crypto",
    tr("Website or crypto", "Sitio web o cripto"),
    tr(
      "Paste a website, a crypto wallet address, or an investment offer.",
      "Pegue un sitio web, una billetera cripto o una oferta de inversión."
    ),
    tr("Example: coinbase-pro-wallet.vip", "Ejemplo: coinbase-pro-wallet.vip")
  ]
];
let checkDraft = "",
  checkKind = "";
function renderCheck() {
  const canListen = canListenHere();
  const kinds = CHECK_KINDS();
  const k = kinds.find(x => x.at(0) === checkKind);
  view.innerHTML = `${pageHead(tr("Check something", "Revisar algo"), tr("Paste or type anything: a text, an email, a phone number, a website, or a wallet address. You can also tell us what a caller said.", "Pegue o escriba cualquier cosa: un texto, un correo, un número, un sitio web o una billetera. También puede contar qué dijo quien llamó."), "today")}
  <div class="kindrow" role="group" aria-label="${esc(tr("What do you want to check?", "¿Qué quiere revisar?"))}">${kinds
    .map(
      ([id, icn, cls, label]) =>
        `<button class="kind ${checkKind === id ? "on" : ""}" data-kind="${id}" aria-pressed="${checkKind === id}"><span class="tile-ic sm ${cls}">${ic(icn)}</span><span>${label}</span></button>`
    )
    .join("")}</div>
  ${k ? `<p class="kindhint">${k.at(4)}</p>` : ""}
  ${checkKind === "email" ? `<section class="sect"><h2 class="sect-h">${tr("Your email accounts", "Sus cuentas de correo")}</h2><div class="group">${emailAccountsHTML()}</div></section>` : ""}
  ${checkKind === "text" ? `<button class="tile" data-go="share"><span class="tile-ic t-msg">${ic("msg")}</span><span class="tile-tx"><b>${tr("Send a text to ScamSense", "Enviar un texto a ScamSense")}</b><span>${tr("Check a suspicious text in 2 taps, on iPhone or Android.", "Revise un texto sospechoso en 2 toques, en iPhone o Android.")}</span></span>${ic("chev", "chev")}</button>` : ""}
  <section class="card checkbox">
    <label for="cx" class="sr">${tr("What do you want to check?", "¿Qué quiere revisar?")}</label>
    <textarea id="cx" dir="auto" placeholder="${esc(k ? k.at(5) : tr("Paste or type it here…", "Péguelo o escríbalo aquí…"))}">${esc(checkDraft)}</textarea>
    <div class="btnrow"><button class="btn primary" id="cgo">${tr("Check it", "Revisar")}</button>${canListen ? `<button class="btn ghost" id="cmic" aria-pressed="false">${ic("mic")}<span>${tr("Say it", "Dígalo")}</span></button>` : ""}</div>
    <div class="samples"><span class="small muted">${t("try_example")}</span>${CHECK_EXAMPLES.map(([v, label]) => `<button class="chip" data-cx="${esc(v)}">${esc(label())}</button>`).join("")}</div>
  </section>
  <div id="result" aria-live="polite"></div>
  <p class="footnote">${ic("lock")}${tr("Checks run on this device. Nothing you type is saved.", "Las revisiones se hacen en este dispositivo. No se guarda lo que escribe.")}</p>
  <button class="textlink soon" data-go="preview">${tr("Coming soon: iPhone catches scam texts and calls for you", "Pronto: el iPhone atrapará textos y llamadas de estafa por usted")} ${ic("chev", "chev")}</button>`;
  bindBack();
  bindEmailAccounts(renderCheck);
  view.querySelectorAll("[data-kind]").forEach(
    b =>
      (b.onclick = () => {
        checkKind = checkKind === b.dataset.kind ? "" : b.dataset.kind;
        renderCheck();
      })
  );
  const share = view.querySelector("[data-go=share]");
  if (share) share.onclick = () => go("share");
  const box = document.getElementById("cx");
  box.oninput = () => (checkDraft = box.value);
  document.getElementById("cgo").onclick = () => runCheck();
  view.querySelectorAll("[data-cx]").forEach(
    b =>
      (b.onclick = () => {
        const v = b.dataset.cx;
        const sample = SAMPLES[v];
        box.value = checkDraft = sample ? (sample.num ? sample.num + "\n" : "") + sample.text : v;
        runCheck(sample ? v : null);
      })
  );
  view.querySelector("[data-go=preview]").onclick = () => {
    previewMode = "text";
    go("preview");
  };
  if (canListen)
    document.getElementById("cmic").onclick = () => toggleListening("cx", "cmic", v => (checkDraft = v));
}

/* ----- Run the right check for what was pasted ----- */
async function runCheck(sampleKey) {
  stopListening();
  const v = document.getElementById("cx").value.trim();
  const out = document.getElementById("result");
  if (!v) {
    toast(t("paste_first"));
    return;
  }
  const kind = detectKind(v);
  const box = html => {
    out.innerHTML = `<div class="card result">${html}</div>`;
    out.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  if (kind === "phone") return box(intelHTML(numberInfo(v), "phone"));
  if (kind === "email") return box(intelHTML(await emailInfo(v), "email"));
  if (kind === "wallet")
    return box(cryptoIntelHTML(walletInfo(v), tr("About this wallet", "Sobre esta billetera")));
  if (kind === "website")
    return box(cryptoIntelHTML(cryptoSiteInfo(v), tr("About this website", "Sobre este sitio")));
  const who = senderIn(v);
  const info = who ? (who.kind === "email" ? await emailInfo(who.value) : numberInfo(who.value)) : null;
  const isCall =
    (sampleKey && SAMPLES[sampleKey].mode === "call") ||
    /\b(call(ed|er|ing)?|phoned|on the phone|said (he|she) (was|is) from)\b|llam/i.test(v);
  await showVerdict(
    {
      id: "paste",
      channel: isCall ? "phone call" : "message",
      source: "paste",
      text: v,
      phone: who && who.kind === "phone" ? who.value : "",
      fromEmail: who && who.kind === "email" ? who.value.toLowerCase() : "",
      fromName: "",
      links: [],
      attachments: [],
      subject: ""
    },
    info,
    who ? who.kind : "phone",
    sampleKey ? SAMPLES[sampleKey].ai : null
  );
}
async function showVerdict(it, info, kind, sample) {
  const out = document.getElementById("result");
  it.local = analyze(it);
  if (info && info.level === "scam") {
    it.local.score += 6;
    it.local.reasons.unshift(info.title);
  } else if (info && info.level === "warn") {
    it.local.score += 2;
    it.local.reasons.unshift(info.title);
  }
  if (
    it.channel === "phone call" &&
    /(irs|social security|medicare|police|sheriff|microsoft|apple|amazon|bank)/i.test(it.text) &&
    /(pay|card|code|install|account|warrant|arrest)/i.test(it.text)
  ) {
    it.local.score += 3;
    it.local.reasons.push(t("call_rule"));
  }
  it.local.level = it.local.score >= 8 ? "scam" : it.local.score >= 4 ? "warn" : "safe";
  const c = cfg();
  if (c.apiKey && c.aiMode !== "off") {
    out.innerHTML = `<div class="card loading">${ic("spark")} ${t("checking")}</div>`;
    try {
      it.ai = await aiCheck(it);
    } catch (e) {
      it.aiError = e.message;
      toast(e.message);
    }
  } else if (sample) {
    it.ai = JSON.parse(JSON.stringify(pickDemoAI(sample)));
    it.ai.verdict = { safe: "safe", suspicious: "warn", scam: "scam" }[it.ai.verdict] || it.ai.verdict;
  }
  it.level = finalLevel(it);
  const L = LV[it.level];
  const k = (it.ai && it.ai.scam_type) || it.local.kind;
  out.innerHTML = `<div class="card result"><div class="verdict v-${it.level}"><span class="dot ${L.dot}" aria-hidden="true">${L.icon}</span><div><h3>${L.title}</h3>${it.level !== "safe" && k ? `<p dir="auto">${t("looks_like", { k: esc(cap(k)) })}</p>` : ""}</div></div>
    ${intelHTML(info, kind)}${detailHTML(it)}</div>`;
  out.querySelector("[data-speak]").onclick = () => speakItem(it);
  const hist = S.get("checks", []);
  hist.push({ at: Date.now(), channel: it.channel, level: it.level, kind: it.local.kindKey });
  S.set("checks", hist.slice(-200));
  out.scrollIntoView({ behavior: "smooth", block: "start" });
}
let previewMode = "text";

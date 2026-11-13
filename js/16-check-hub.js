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

/* ----- The screen ----- */
let checkDraft = "";
function renderCheck() {
  const canListen = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  view.innerHTML = `${pageHead(tr("Check something", "Revisar algo"), tr("Paste or type anything: a text, an email, a phone number, a website, or a wallet address. You can also tell us what a caller said.", "Pegue o escriba cualquier cosa: un texto, un correo, un número, un sitio web o una billetera. También puede contar qué dijo quien llamó."), "today")}
  <section class="card checkbox">
    <label for="cx" class="sr">${tr("What do you want to check?", "¿Qué quiere revisar?")}</label>
    <textarea id="cx" dir="auto" placeholder="${esc(tr("Paste or type it here…", "Péguelo o escríbalo aquí…"))}">${esc(checkDraft)}</textarea>
    <div class="btnrow"><button class="btn primary" id="cgo">${tr("Check it", "Revisar")}</button>${canListen ? `<button class="btn ghost" id="cmic" aria-pressed="false">${ic("mic")}<span>${tr("Say it", "Dígalo")}</span></button>` : ""}</div>
    <div class="samples"><span class="small muted">${t("try_example")}</span>${CHECK_EXAMPLES.map(([v, label]) => `<button class="chip" data-cx="${esc(v)}">${esc(label())}</button>`).join("")}</div>
  </section>
  <div id="result" aria-live="polite"></div>
  <p class="footnote">${ic("lock")}${tr("Checks run on this device. Nothing you type is saved.", "Las revisiones se hacen en este dispositivo. No se guarda lo que escribe.")}</p>
  <button class="textlink soon" data-go="preview">${tr("Coming soon: iPhone catches scam texts and calls for you", "Pronto: el iPhone atrapará textos y llamadas de estafa por usted")} ${ic("chev", "chev")}</button>`;
  bindBack();
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
  if (canListen) document.getElementById("cmic").onclick = listenInto;
}

/* ----- "Say it": turn speech into text in the box (in the app's language) ----- */
let listening = null;
function listenInto() {
  const btn = document.getElementById("cmic");
  if (listening) {
    listening.stop();
    return;
  }
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new R();
  rec.lang = LANGS[langCode()].speech;
  rec.interimResults = true;
  rec.continuous = true;
  const box = document.getElementById("cx");
  const before = box.value ? box.value.trim() + " " : "";
  rec.onresult = e => {
    let txt = "";
    for (const r of e.results) txt += r[0].transcript;
    box.value = checkDraft = before + txt;
  };
  rec.onend = () => {
    listening = null;
    btn.classList.remove("on");
    btn.setAttribute("aria-pressed", "false");
    btn.querySelector("span").textContent = tr("Say it", "Dígalo");
  };
  rec.onerror = e => {
    if (e.error === "not-allowed")
      toast(tr("Please allow the microphone to use Say it.", "Permita el micrófono para usar Dígalo."));
  };
  try {
    rec.start();
    listening = rec;
    btn.classList.add("on");
    btn.setAttribute("aria-pressed", "true");
    btn.querySelector("span").textContent = tr("Listening… tap to stop", "Escuchando… toque para parar");
  } catch (e) {
    toast(tr("The microphone isn't available right now.", "El micrófono no está disponible ahora."));
  }
}

/* ----- Run the right check for what was pasted ----- */
async function runCheck(sampleKey) {
  if (listening) listening.stop();
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

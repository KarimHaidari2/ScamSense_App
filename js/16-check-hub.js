/*
 * ScamSense · Check tab
 * The Check tab: Email, Text messages, Phone calls, and their check forms.
 */
"use strict";

function renderCheck() {
  const conn = S.get("connected", false);
  view.innerHTML = `${pageHead(tr("Check something", "Revisar algo"), tr("Choose what you want to check. ScamSense tells you if it's safe, and why.", "Elija qué quiere revisar. ScamSense le dice si es seguro y por qué."))}
  <div class="tiles">
    <button class="tile" data-go="checkEmail"><span class="tile-ic t-mail">${ic("mail")}</span><span class="tile-tx"><b>${tr("Email", "Correo")}</b><span>${tr("Gmail, Outlook, Yahoo, and more", "Gmail, Outlook, Yahoo y más")}</span></span>${conn ? `<span class="badge ok">${tr("Gmail on", "Gmail activo")}</span>` : ""}${ic("chev", "chev")}</button>
    <button class="tile" data-go="checkText"><span class="tile-ic t-msg">${ic("msg")}</span><span class="tile-tx"><b>${tr("Text messages", "Mensajes de texto")}</b><span>${tr("Check a text and who sent it", "Revise un texto y quién lo envió")}</span></span>${ic("chev", "chev")}</button>
    <button class="tile" data-go="checkCall"><span class="tile-ic t-call">${ic("phone")}</span><span class="tile-tx"><b>${tr("Phone calls", "Llamadas")}</b><span>${tr("Look up a number or describe a call", "Busque un número o describa una llamada")}</span></span>${ic("chev", "chev")}</button>
    <button class="tile" data-go="checkCrypto"><span class="tile-ic t-crypto">${ic("spark")}</span><span class="tile-tx"><b>${tr("Crypto", "Cripto")}</b><span>${tr("Websites, wallets, and investment offers", "Sitios, billeteras y ofertas de inversión")}</span></span>${ic("chev", "chev")}</button>
  </div>
  <p class="footnote">${ic("lock")}${tr("Checks run on this device. Nothing you type is saved.", "Las revisiones se hacen en este dispositivo. No se guarda lo que escribe.")}</p>`;
  view.querySelectorAll("[data-go]").forEach(b => (b.onclick = () => go(b.dataset.go)));
}
const PROVIDERS = [
  ["gmail", "Gmail", "#D93025"],
  ["outlook", "Outlook / Hotmail", "#0F6CBD"],
  ["yahoo", "Yahoo Mail", "#6001D2"],
  ["icloud", "iCloud Mail", "#1E88E5"],
  ["aol", "AOL Mail", "#31459B"],
  ["other", tr("Work, school, or other", "Trabajo, escuela u otro"), "#4F6B70"]
];
const EMAIL_SAMPLES = {
  paypal: {
    from: "service@paypa1-security.com",
    subject: "Your account has been limited",
    text: "We noticed unusual sign-in activity on your PayPal account. Your account will be locked within 24 hours unless you verify your billing information."
  },
  temp: {
    from: "claims.dept@mailinator.com",
    subject: "You've won a $500 Walmart gift card",
    text: "Congratulations! Claim your reward today. Reply with your name, address, and phone number to receive your prize."
  }
};
function renderCheckEmail() {
  const conn = S.get("connected", false);
  view.innerHTML = `${pageHead(tr("Email", "Correo"), tr("Connect your inbox for a daily report, or check one email.", "Conecte su correo para un reporte diario, o revise un correo."), "check")}
  <section class="sect"><h2 class="sect-h">${tr("Your email accounts", "Sus cuentas de correo")}</h2>
    <div class="group">${PROVIDERS.map(
      ([
        k,
        n,
        c
      ]) => `<div class="grow"><span class="pv" style="--pv:${c}">${esc(n[0])}</span><span class="gl"><b>${esc(n)}</b><span>${k === "gmail" ? (conn ? tr("Connected · checks every folder", "Conectado · revisa todas las carpetas") + ` · <button class="textlink" id="gdisc">${t("disconnect")}</button>` : tr("Read-only. Never sends or deletes.", "Solo lectura. Nunca envía ni borra.")) : tr("Coming soon", "Próximamente")}</span></span>
      ${k === "gmail" ? (conn ? `<button class="btn sm primary" id="gscan">${tr("Scan now", "Revisar")}</button>` : `<button class="btn sm primary" id="gconn">${tr("Connect", "Conectar")}</button>`) : `<span class="badge">${tr("Soon", "Pronto")}</span>`}</div>`
    ).join("")}</div>
    <p class="footnote">${tr("Outlook, Yahoo, iCloud, and AOL need their own sign-in setup and are next. Until then, paste those emails below.", "Outlook, Yahoo, iCloud y AOL necesitan su propia conexión y vienen después. Mientras, pegue esos correos abajo.")}</p></section>
  <section class="sect"><h2 class="sect-h">${tr("Check one email", "Revisar un correo")}</h2>
    <div class="card">
      <div class="field"><label for="ef">${tr("Sender's email address", "Dirección del remitente")}</label><input id="ef" type="email" autocomplete="off" spellcheck="false" placeholder="name@example.com"></div>
      <div class="field"><label for="es">${tr("Subject (optional)", "Asunto (opcional)")}</label><input id="es" autocomplete="off"></div>
      <div class="field"><label for="eb">${tr("Message", "Mensaje")}</label><textarea id="eb" dir="auto" placeholder="${esc(tr("Paste the email here…", "Pegue el correo aquí…"))}"></textarea></div>
      <div class="samples"><span class="small muted">${t("try_example")}</span><button class="chip" data-es="paypal">${tr("Fake PayPal", "PayPal falso")}</button><button class="chip" data-es="temp">${tr("Throwaway address", "Dirección desechable")}</button></div>
      <button class="btn primary" id="ego">${tr("Check this email", "Revisar este correo")}</button></div>
    <div id="result" aria-live="polite"></div></section>`;
  bindBack();
  const gc = document.getElementById("gconn");
  if (gc)
    gc.onclick = async () => {
      try {
        await getToken(true);
        toast(t("gmail_ok"));
        go("today");
        scanGmail();
      } catch (e) {
        toast(e.message);
      }
    };
  const gd = document.getElementById("gdisc");
  if (gd)
    gd.onclick = () => {
      try {
        if (token) google.accounts.oauth2.revoke(token, () => {});
      } catch (e) {}
      token = null;
      S.set("connected", false);
      setStatus();
      toast(t("gmail_off"));
      renderCheckEmail();
    };
  const gs = document.getElementById("gscan");
  if (gs)
    gs.onclick = () => {
      go("today");
      scanGmail();
    };
  view.querySelectorAll("[data-es]").forEach(
    b =>
      (b.onclick = () => {
        const x = EMAIL_SAMPLES[b.dataset.es];
        document.getElementById("ef").value = x.from;
        document.getElementById("es").value = x.subject;
        document.getElementById("eb").value = x.text;
        runEmailCheck();
      })
  );
  document.getElementById("ego").onclick = runEmailCheck;
}
async function runEmailCheck() {
  const from = document.getElementById("ef").value.trim(),
    subject = document.getElementById("es").value.trim(),
    text = document.getElementById("eb").value.trim();
  if (!from && !text) {
    toast(t("paste_first"));
    return;
  }
  const info = from ? await emailInfo(from) : null;
  const it = {
    id: "paste",
    channel: "email",
    source: "paste",
    fromEmail: from.toLowerCase(),
    fromName: "",
    subject,
    text,
    links: [],
    attachments: []
  };
  await showVerdict(it, info, "email");
}
const TEXT_SAMPLES = {
  toll: SAMPLES.toll,
  grand: SAMPLES.grand,
  bank: {
    mode: "text",
    num: "+1 (213) 555-0199",
    text: "Wells Fargo: Unusual sign-in detected. Your account will be locked. Verify now at https://wellsfargo-secure-login.top"
  }
};
function renderCheckText() {
  view.innerHTML = `${pageHead(tr("Text messages", "Mensajes de texto"), tr("Paste a text to see if it's a scam and who's really behind the number.", "Pegue un texto para ver si es estafa y quién está detrás del número."), "check")}
  <section class="sect"><div class="card">
    <div class="field"><label for="tn">${tr("Sender's number", "Número del remitente")}</label><input id="tn" inputmode="tel" autocomplete="off" placeholder="(918) 555-0142"></div>
    <div class="field"><label for="tb">${t("lbl_msg")}</label><textarea id="tb" dir="auto" placeholder="${esc(t("ph_text"))}"></textarea></div>
    <div class="samples"><span class="small muted">${t("try_example")}</span><button class="chip" data-ts="toll">${t("ex_toll")}</button><button class="chip" data-ts="bank">${tr("Fake bank alert", "Alerta falsa de banco")}</button><button class="chip" data-ts="grand">${t("ex_grand")}</button></div>
    <button class="btn primary" id="tgo">${tr("Check this text", "Revisar este texto")}</button></div>
    <div id="result" aria-live="polite"></div></section>
  <section class="sect"><h2 class="sect-h">${tr("Automatic filtering", "Filtrado automático")}</h2>
    <button class="tile" id="tprev"><span class="tile-ic t-dev">${ic("device")}</span><span class="tile-tx"><span class="badge tb">${tr("Soon", "Pronto")}</span><b>${tr("See how texts will be caught", "Vea cómo se atraparán los textos")}</b><span>${tr("iPhone app preview: scam texts go straight to Junk", "Vista previa: los textos de estafa van directo a Basura")}</span></span>${ic("chev", "chev")}</button></section>`;
  bindBack();
  view.querySelectorAll("[data-ts]").forEach(
    b =>
      (b.onclick = () => {
        const x = TEXT_SAMPLES[b.dataset.ts];
        document.getElementById("tn").value = x.num;
        document.getElementById("tb").value = x.text;
        runTextCheck(x.ai);
      })
  );
  document.getElementById("tgo").onclick = () => runTextCheck();
  document.getElementById("tprev").onclick = () => {
    previewMode = "text";
    go("preview");
  };
}
async function runTextCheck(sample) {
  const phone = document.getElementById("tn").value.trim(),
    text = document.getElementById("tb").value.trim();
  if (!text) {
    toast(t("paste_first"));
    return;
  }
  const info = numberInfo(phone);
  await showVerdict(
    {
      id: "paste",
      channel: "text message",
      source: "paste",
      text,
      phone,
      links: [],
      attachments: [],
      subject: ""
    },
    info,
    "phone",
    sample
  );
}
function renderCheckCall() {
  view.innerHTML = `${pageHead(tr("Phone calls", "Llamadas"), tr("Look up a number before you call back, or tell ScamSense what a caller said.", "Busque un número antes de devolver la llamada, o cuéntele a ScamSense qué dijo quien llamó."), "check")}
  <section class="sect"><h2 class="sect-h">${tr("Look up a number", "Buscar un número")}</h2>
    <div class="card"><div class="lookup"><input id="cn" inputmode="tel" autocomplete="off" placeholder="(800) 555-0144" aria-label="${tr("Phone number", "Número de teléfono")}"><button class="btn primary" id="clook">${tr("Look up", "Buscar")}</button></div>
    <div class="samples"><span class="small muted">${t("try_example")}</span><button class="chip" data-cn="+1 (800) 555-0144">${tr("Reported number", "Número reportado")}</button><button class="chip" data-cn="+1 (876) 555-0123">${tr("One-ring area code", "Código de un timbre")}</button><button class="chip" data-cn="+1 (123) 456-7890">${tr("Faked number", "Número falso")}</button></div>
    <div id="lookres" aria-live="polite"></div></div></section>
  <section class="sect"><h2 class="sect-h">${tr("Describe a call", "Describir una llamada")}</h2>
    <div class="card"><div class="field"><label for="cd">${t("lbl_call")}</label><textarea id="cd" dir="auto" placeholder="${esc(t("ph_call"))}"></textarea></div>
    <div class="samples"><span class="small muted">${t("try_example")}</span><button class="chip" data-cs="irs">${t("ex_irs")}</button></div>
    <button class="btn primary" id="cgo">${tr("Check this call", "Revisar esta llamada")}</button></div>
    <div id="result" aria-live="polite"></div></section>
  <section class="sect"><h2 class="sect-h">${tr("Automatic call labels", "Etiquetas automáticas")}</h2>
    <button class="tile" id="cprev"><span class="tile-ic t-dev">${ic("device")}</span><span class="tile-tx"><span class="badge tb">${tr("Soon", "Pronto")}</span><b>${tr("See how calls will be caught", "Vea cómo se atraparán las llamadas")}</b><span>${tr('iPhone app preview: "Scam Likely" labels and blocking', 'Vista previa: etiquetas "Posible estafa" y bloqueo')}</span></span>${ic("chev", "chev")}</button></section>`;
  bindBack();
  const look = () => {
    const v = document.getElementById("cn").value.trim();
    if (!v) {
      toast(tr("Type a phone number first.", "Escriba primero un número."));
      return;
    }
    document.getElementById("lookres").innerHTML = intelHTML(numberInfo(v), "phone");
  };
  document.getElementById("clook").onclick = look;
  document.getElementById("cn").onkeydown = e => {
    if (e.key === "Enter") look();
  };
  view.querySelectorAll("[data-cn]").forEach(
    b =>
      (b.onclick = () => {
        document.getElementById("cn").value = b.dataset.cn;
        look();
      })
  );
  view.querySelectorAll("[data-cs]").forEach(
    b =>
      (b.onclick = () => {
        const x = SAMPLES.irs;
        document.getElementById("cn").value = x.num;
        document.getElementById("cd").value = x.text;
        runCallCheck(x.ai);
      })
  );
  document.getElementById("cgo").onclick = () => runCallCheck();
  document.getElementById("cprev").onclick = () => {
    previewMode = "call";
    go("preview");
  };
}
async function runCallCheck(sample) {
  const phone = document.getElementById("cn").value.trim(),
    text = document.getElementById("cd").value.trim();
  if (!text) {
    toast(t("paste_first"));
    return;
  }
  await showVerdict(
    {
      id: "paste",
      channel: "phone call",
      source: "paste",
      text,
      phone,
      links: [],
      attachments: [],
      subject: ""
    },
    numberInfo(phone),
    "phone",
    sample
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

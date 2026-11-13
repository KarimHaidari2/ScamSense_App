/*
 * ScamSense · Ask Mahi (AI helper)
 * The chat helper: built-in quick answers, plus the AI when a key is set.
 */
"use strict";

let chatLog = [];
const HELPER_SYSTEM = () =>
  `You are Mahi, the friendly assistant inside ScamSense, an app that protects people (especially older adults) from scams. Answer ANY question the person asks, helpfully and honestly, not only scam questions; your specialty is staying safe from scams, fraud, and identity theft. Answer in ${LANGS[langCode()].ai}. Use short, plain sentences a 75-year-old can follow, under 8 short lines unless they ask for more. Never ask for passwords, codes, card numbers, or Social Security numbers, and remind people never to share them. If they may have lost money or shared private details, tell them to call their bank right away and to use "I was scammed" in the Help tab. If they want a real person, suggest a trusted family member, the AARP Fraud Watch Network Helpline 877-908-3360, or (age 60+) the National Elder Fraud Hotline 1-833-372-8311. If someone is in danger, tell them to call 911. If you're not sure, say so.`;

/* Shows Mahi's **bold** words in bold and "- " lines as bullets (everything else stays plain text). */
function fmtMahi(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/^(?:-|\*|•)\s+/gm, "• ")
    .replace(/^#{1,3}\s+/gm, "");
}

/* Mahi server: sends the chat to the Mahi Server web app, which holds the AI key. */
async function callMahiServer(messages) {
  const url = cfg().mahiUrl;
  if (!url) throw new Error("no-server");
  const res = await fetch(url, {
    method: "POST",
    body: JSON.stringify({ messages, lang: LANGS[langCode()].ai })
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error);
  return String(j.text || "");
}
/* Built-in answers so Mahi always replies, even with no AI key or no internet */
const AGENT_FAQ = () => [
  {
    re: /what is scam ?sense|about (this|the) app|what (does|can) (this app|scam ?sense|mahi|you) do|who are you|qué es scam ?sense|scamsense چیست|اسکم‌سنس|ما هو scamsense|什么是 ?scamsense|scamsense(가| 는|는) 뭐|scamsense là gì|ano ang scamsense/i,
    a: tr(
      "ScamSense protects you from scams. It checks your email (Gmail, every folder), text messages, phone numbers, and crypto websites, and tells you in plain words what's safe and what to do. It also has Pause before you pay, a step-by-step plan if you were scammed, short lessons, and a Family tab for people you trust. I'm Mahi, its helper. Your messages are checked on your device and never sold.",
      "ScamSense lo protege de estafas. Revisa su correo (Gmail, todas las carpetas), textos, números de teléfono y sitios de cripto, y le dice en palabras simples qué es seguro y qué hacer. También tiene Pause antes de pagar, un plan paso a paso si lo estafaron, lecciones cortas y una pestaña Familia. Soy Mahi, su asistente. Sus mensajes se revisan en su dispositivo y nunca se venden."
    )
  },
  {
    re: /live (agent|person|chat)|real person|human|talk to (someone|a person|somebody)|speak (to|with) (someone|a person)|customer service|phone support|persona real|hablar con alguien|شخص واقعی|انسان|شخص حقيقي|真人|人工|상담원|사람과|người thật|tổng đài|totoong tao/i,
    a: tr(
      "I'm Mahi, an AI helper, so I'm not a live person. To talk to a real person about a scam: call a family member or friend you trust (see the Family tab), the AARP Fraud Watch Network Helpline at 877-908-3360 (free, Mon–Fri), or, if you're 60 or older, the National Elder Fraud Hotline at 1-833-372-8311. If you already lost money, call your bank now using the number on your card.",
      "Soy Mahi, un asistente de IA, así que no soy una persona. Para hablar con una persona sobre una estafa: llame a un familiar o amigo de confianza (vea Familia), a la línea de AARP al 877-908-3360 (gratis, lun–vie) o, si tiene 60 años o más, a la Línea Nacional de Fraude contra Mayores al 1-833-372-8311. Si ya perdió dinero, llame a su banco ahora con el número de su tarjeta."
    ),
    go: "family"
  },
  {
    re: /scammed|\bi (already |just )?(paid|sent|gave|wired|transferred)\b|already (paid|sent|gave)|sent (them |the )?(\$|money|cash)|lost (my )?money|me estafaron|ya pagu|ya envi|envi[eé] dinero|کلاهبرداری شدم|پول فرستادم|پرداخت کردم|تعرضت للاحتيال|أرسلت المال|دفعت|被骗|已经付|사기를 당|이미 보냈|bị lừa|đã chuyển|na-scam|nagbayad na/i,
    go: "scammed",
    a: tr(
      "I'm sorry this happened. It's not your fault. Act fast: call your bank or card company now using the number on the back of your card, stop all contact with the scammer, and report it at ReportFraud.ftc.gov. Tap below and ScamSense will build your full recovery plan and documents.",
      "Lamento lo ocurrido. No es su culpa. Actúe rápido: llame a su banco con el número al reverso de su tarjeta, corte todo contacto con el estafador y repórtelo en ReportFraud.ftc.gov. Toque abajo y ScamSense hará su plan de recuperación y documentos."
    )
  },
  {
    re: /gift ?cards?|itunes|google play card|steam card|tarjetas? de regalo|کارت هدیه|بطاق(ة|ات) هدايا|礼品卡|기프트 ?카드|thẻ quà|gift card/i,
    go: "pause",
    a: tr(
      "Paying with gift cards is always a scam. No real company, bank, or government office takes gift cards as payment. Don't buy them and don't read the numbers to anyone. If you already gave the numbers, call the number on the back of the card right away.",
      "Pagar con tarjetas de regalo siempre es una estafa. Ninguna empresa, banco ni oficina de gobierno real acepta tarjetas de regalo. No las compre ni lea los números a nadie. Si ya dio los números, llame al número del reverso de la tarjeta de inmediato."
    )
  },
  {
    re: /toll|peaje|usps|package|paquete|deliver|fedex|\bups\b|shipping|عوارض|بسته|مرسوله|رسوم الطريق|طرد|过路费|包裹|통행료|택배|phí cầu đường|gói hàng/i,
    go: "checkText",
    a: tr(
      "Texts about unpaid tolls or missed packages are almost always fake. Don't tap the link. Check your account by typing the official website yourself, or open the official app. You can forward the text to 7726 to report it, then delete it.",
      "Los textos sobre peajes sin pagar o paquetes perdidos casi siempre son falsos. No toque el enlace. Revise su cuenta escribiendo usted mismo el sitio oficial o abriendo la app oficial. Puede reenviar el texto al 7726 para reportarlo y luego borrarlo."
    )
  },
  {
    re: /social security|\bssn\b|seguro social|\birs\b|medicare|\btax(es)?\b|impuesto|arrest|warrant|police|polic[ií]a|arresto|تأمین اجتماعی|مالیات|پلیس|بازداشت|الضمان الاجتماعي|ضرائب|شرطة|اعتقال|税务|警察|逮捕|사회보장|세금|경찰|체포|an sinh xã hội|thuế|công an|buwis|pulis/i,
    a: tr(
      "Government offices like the IRS, Social Security, and Medicare never call to demand money, threaten arrest, or ask for gift cards or crypto. Hang up. If you're worried, call the office yourself using the number on its official website.",
      "Las oficinas de gobierno como el IRS, el Seguro Social y Medicare nunca llaman para exigir dinero, amenazar con arresto ni pedir tarjetas de regalo o cripto. Cuelgue. Si le preocupa, llame usted a la oficina con el número de su sitio oficial."
    )
  },
  {
    re: /bank|banco|zelle|safe account|cuenta segura|fraud dep|wire transfer|transferencia|بانک|بنك|银行|은행|ngân hàng|bangko/i,
    a: tr(
      'Your bank will never ask you to move money to a "safe account" or to send a Zelle payment to protect yourself. Hang up and call the number on the back of your card. Caller ID can be faked, so a call that shows your bank\'s name can still be a scam.',
      'Su banco nunca le pedirá mover dinero a una "cuenta segura" ni enviar un Zelle para protegerse. Cuelgue y llame al número del reverso de su tarjeta. El identificador de llamadas se puede falsificar.'
    )
  },
  {
    re: /\bcode\b|c[oó]digo|\botp\b|verification|password|contrase[ñn]a|passcode|کد|رمز|رمز التحقق|كلمة المرور|验证码|密码|인증 ?번호|비밀번호|mã xác|mật khẩu/i,
    a: tr(
      "Never share a code that was texted to you, not even with someone who says they're your bank. That code lets them into your account. If you already shared it, change your password now and call the company.",
      "Nunca comparta un código que le llegó por texto, ni siquiera con alguien que dice ser su banco. Ese código les da acceso a su cuenta. Si ya lo compartió, cambie su contraseña ahora y llame a la empresa."
    )
  },
  {
    re: /grand(son|daughter|ma|pa|child|kid)|nieto|nieta|abuel|\bbail\b|fianza|jail|c[aá]rcel|hospital|نوه|مادربزرگ|پدربزرگ|وثیقه|حفيد|جدة|كفالة|孙子|孙女|奶奶|保释|손주|할머니|보석금|cháu|bảo lãnh|\bapo\b|lola|piyansa/i,
    a: tr(
      'This sounds like the "grandparent scam." Before you do anything, call your family member at the number you already have, or call their parents. Real emergencies can wait a few minutes. Don\'t send money, gift cards, or cash with a courier.',
      'Esto parece la "estafa del abuelo". Antes de hacer algo, llame a su familiar al número que ya tiene o a sus padres. Las emergencias reales pueden esperar unos minutos. No envíe dinero, tarjetas de regalo ni efectivo con un mensajero.'
    )
  },
  {
    re: /virus|microsoft|apple support|computer|computadora|remote|anydesk|teamviewer|refund|reembolso|geek squad|pop.?up|hacked|hackeado|ویروس|کامپیوتر|هک|فيروس|حاسوب|اختراق|病毒|电脑|被黑|바이러스|컴퓨터|해킹|máy tính|bị hack|na-hack/i,
    a: tr(
      "Real tech companies don't call you or show pop-ups with a phone number. Close the window and don't call. Never let a stranger control your computer, and never pay a \"refund\" back. If you already gave access, disconnect from the internet and get help from someone you trust.",
      'Las empresas de tecnología reales no le llaman ni muestran ventanas con un teléfono. Cierre la ventana y no llame. Nunca deje que un extraño controle su computadora ni devuelva un "reembolso". Si ya dio acceso, desconéctese de internet y pida ayuda a alguien de confianza.'
    )
  },
  {
    re: /\bwon\b|\bwin\b|prize|lottery|loter[ií]a|premio|sweepstake|gan[oó]|inheritance|herencia|برنده|جایزه|لاتاری|جائزة|يانصيب|ربحت|中奖|奖品|彩票|당첨|복권|trúng thưởng|xổ số|nanalo|premyo/i,
    a: tr(
      "You can't win a contest you never entered, and a real prize never makes you pay first. If they ask for a fee, taxes, or your bank details to get your prize, it's a scam.",
      "No puede ganar un concurso en el que no participó, y un premio real nunca le pide pagar primero. Si piden una tarifa, impuestos o datos bancarios para entregar el premio, es una estafa."
    )
  },
  {
    re: /crypto|bitcoin|\busdt\b|tether|invest|inversi|mining|miner[ií]a|trading|whatsapp|telegram|wallet|billetera|کریپتو|بیت‌?کوین|سرمایه‌?گذاری|عملات رقمية|بيتكوين|استثمار|加密货币|比特币|投资|암호화폐|비트코인|투자|tiền điện tử|đầu tư/i,
    go: "checkCrypto",
    a: tr(
      "Be very careful. Guaranteed or daily profits, a stranger who moves the chat to WhatsApp or Telegram, or a fee to withdraw your own money are signs of a crypto scam. Crypto can't be reversed. Paste the website or wallet address here and I'll check it, or open the crypto check.",
      "Tenga mucho cuidado. Ganancias garantizadas o diarias, un extraño que lleva el chat a WhatsApp o Telegram, o una tarifa para retirar su propio dinero son señales de estafa cripto. Las cripto no se pueden revertir. Pegue aquí el sitio o la billetera y la reviso."
    )
  },
  {
    re: /website|web ?site|sitio web|is (this|the) (link|site)|real site|fake site|سایت|وب‌?سایت|موقع|网站|웹사이트|trang web/i,
    a: tr(
      "To check a website: type the address yourself instead of tapping a link, and check the spelling letter by letter (paypa1 is not paypal). Strange endings like .xyz or .top are a warning sign. Paste the address here and I'll check it for you.",
      "Para revisar un sitio: escriba usted la dirección en vez de tocar un enlace y revise la ortografía letra por letra (paypa1 no es paypal). Terminaciones raras como .xyz o .top son una señal de alerta. Pegue la dirección aquí y la reviso."
    )
  },
  {
    re: /^\s*(hi|hello|hey|hola|salam|salaam|سلام|مرحبا|你好|안녕|xin ch[aà]o|kumusta)(?=[\s!.,?؟،]|$)/i,
    a: tr(
      "Hi! I'm Mahi, and I'm here to help. Tell me about a message, call, or payment that worries you, or paste a phone number, email address, or website and I'll check it.",
      "¡Hola! Soy Mahi y estoy aquí para ayudar. Cuénteme sobre un mensaje, llamada o pago que le preocupe, o pegue un teléfono, correo o sitio web y lo reviso."
    )
  }
];
async function localAgent(q) {
  const parts = [];
  let go = null;
  const emails = [...new Set(q.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [])].slice(0, 2);
  for (const e of emails) {
    try {
      await loadDisposable();
    } catch (_) {}
    const r = await emailInfo(e);
    if (r) parts.push(`${e}: ${r.title}. ${(r.lines || [])[0] || ""}`.trim());
  }
  const qNoMail = q.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, " ");
  const wallets =
    qNoMail.match(/\b(0x[a-fA-F0-9]{40}|T[1-9A-HJ-NP-Za-km-z]{33}|bc1[0-9a-z]{25,87})\b/g) || [];
  for (const w of wallets.slice(0, 2)) {
    const r = walletInfo(w);
    if (r) parts.push(`${r.title}. ${r.lines[r.lines.length - 1]}`);
  }
  const urls = (
    qNoMail
      .replace(/\b(0x[a-fA-F0-9]{40}|T[1-9A-HJ-NP-Za-km-z]{33})\b/g, " ")
      .match(/\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/gi) || []
  )
    .filter(u => !/^\d+\.\d+/.test(u))
    .slice(0, 2);
  for (const u of urls) {
    const r = cryptoSiteInfo(u);
    if (r) parts.push(`${u}: ${r.title}. ${(r.lines || [])[0] || ""}`.trim());
  }
  const phones = (qNoMail.match(/(?:\+?\d[\d\s().-]{8,}\d)/g) || [])
    .filter(x => x.replace(/\D/g, "").length >= 10)
    .slice(0, 2);
  for (const ph of phones) {
    const r = numberInfo(ph);
    if (r) parts.push(`${ph.trim()}: ${r.title}. ${(r.lines || [])[0] || ""}`.trim());
  }
  const faq = AGENT_FAQ().find(f => f.re.test(q));
  if (faq) {
    parts.push(faq.a);
    go = faq.go || null;
  }
  if (!faq) {
    const an = analyze({ subject: "", text: q });
    if (an.level === "scam" || an.level === "warn") {
      parts.push(
        an.level === "scam"
          ? tr(`This looks like a ${an.kind || "scam"}.`, `Esto parece una ${an.kind || "estafa"}.`)
          : tr("Be careful. I see some warning signs.", "Tenga cuidado. Veo algunas señales de alerta.")
      );
      an.reasons.slice(0, 3).forEach(r => parts.push("• " + r));
      parts.push(advice(an.level).slice(0, 2).join(" "));
    } else if (!parts.length) {
      go = "settings";
      parts.push(
        tr(
          "Right now I can only answer common scam questions. To answer any question, I need my AI turned on: add an AI key in Settings, or the Mahi server address (Settings → Advanced). Meanwhile, you can paste a message, phone number, email, or website and I'll check it.",
          "Por ahora solo puedo responder preguntas comunes sobre estafas. Para responder cualquier pregunta necesito mi IA: agregue una clave de IA en Ajustes o la dirección del servidor de Mahi (Ajustes → Avanzado). Mientras tanto, pegue un mensaje, teléfono, correo o sitio web y lo reviso."
        )
      );
    }
  }
  return { text: parts.join("\n\n"), go };
}
const AGENT_GO = {
  scammed: () => tr('Open "I was scammed"', 'Abrir "Me estafaron"'),
  pause: () => t("pause_card"),
  checkText: () => tr("Check a text message", "Revisar un texto"),
  checkCrypto: () => tr("Open the crypto check", "Abrir la revisión cripto"),
  family: () => tr("Open Family", "Abrir Familia"),
  settings: () => tr("Turn on Mahi's AI in Settings", "Activar la IA de Mahi en Ajustes")
};
function renderHelper() {
  const c0 = cfg();
  const viaServer = !!c0.mahiUrl;
  const has = viaServer || (!!c0.apiKey && c0.aiMode !== "off");
  const bubble = m =>
    `<div class="bubble ${m.role === "user" ? "me" : "ai"}" dir="auto">${m.role === "user" ? esc(m.content) : fmtMahi(m.content)}${m.go && AGENT_GO[m.go] ? `<button class="btn ghost sm bgo" data-go="${m.go}">${esc(AGENT_GO[m.go]())} ${ic("chev", "chev")}</button>` : ""}${(
      m.actions || []
    )
      .map(
        (a, k) =>
          `<button class="btn ${a.primary ? "primary" : "ghost"} sm bgo" data-act="${m.aid}:${k}">${esc(a.label)} ${ic("chev", "chev")}</button>`
      )
      .join("")}</div>`;
  const hello = {
    role: "assistant",
    content: tr(
      "Hi! I'm Mahi, your ScamSense helper. Ask me about any message, call, or payment, or paste a phone number, email, or website and I'll check it.",
      "¡Hola! Soy Mahi, su asistente de ScamSense. Pregúnteme sobre cualquier mensaje, llamada o pago, o pegue un teléfono, correo o sitio web y lo reviso."
    )
  };
  view.innerHTML = `${pageHead(tr("Ask Mahi", "Pregúntele a Mahi"), "", "help")}
  <section class="chat card"><div class="chatlog" id="chatlog" aria-live="polite">${[hello, ...chatLog].map(bubble).join("")}</div>
    <div class="samples" id="chatsamples" ${chatLog.length ? "hidden" : ""}>${[tr("Is a text about an unpaid toll real?", "¿Es real un texto sobre un peaje sin pagar?"), tr("Someone wants me to pay with gift cards", "Alguien quiere que pague con tarjetas de regalo"), tr("How do I know if a website is real?", "¿Cómo sé si un sitio web es real?")].map(q => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div>
    <div class="composer"><textarea id="chatin" dir="auto" rows="1" placeholder="${esc(tr("Type your question…", "Escriba su pregunta…"))}"></textarea><button class="btn primary sendbtn" id="chatgo" aria-label="${esc(tr("Send", "Enviar"))}">${ic("send")}</button></div>
    <div class="chattools"><button class="ctool" id="chatread">${ic("speaker")}<span>${t("read_aloud").replace(/^\S*🔊\S*\s*/u, "")}</span></button><button class="ctool" id="chatsave" ${chatLog.length ? "" : "disabled"}>${ic("download")}<span>${tr("Save this chat", "Guardar este chat")}</span></button><button class="ctool" id="chatclear" ${chatLog.length ? "" : "disabled"}>${tr("Start over", "Empezar de nuevo")}</button></div>
    <p class="footnote small">${ic(has ? "lock" : "info")}<span>${has ? tr("Answers come from Anthropic's AI. Your chat stays on this device until you close the app.", "Las respuestas vienen de la IA de Anthropic. Su chat se queda en este dispositivo hasta que cierre la app.") : tr("Quick answers work right away, even offline. Add an AI key in Settings for longer, smarter answers.", "Las respuestas rápidas funcionan al instante, incluso sin internet. Agregue una clave de IA en Ajustes para respuestas más completas.")}</span></p></section>`;
  bindBack();
  const log = document.getElementById("chatlog"),
    inp = document.getElementById("chatin");
  const scroll = () => {
    log.scrollTop = log.scrollHeight;
  };
  scroll();
  const grow = () => {
    inp.style.height = "auto";
    inp.style.height = Math.min(inp.scrollHeight, 140) + "px";
  };
  inp.oninput = grow;
  const tools = () => {
    ["chatsave", "chatclear"].forEach(id => (document.getElementById(id).disabled = !chatLog.length));
  };
  const bindActs = () =>
    log.querySelectorAll("[data-act]").forEach(b => {
      if (b.dataset.bound) return;
      b.dataset.bound = "1";
      b.onclick = () => {
        const [aid, k] = b.dataset.act.split(":");
        const m = chatLog.find(x => String(x.aid) === aid);
        if (m && m.actions && m.actions[+k]) m.actions[+k].run();
      };
    });
  const add = m => {
    log.insertAdjacentHTML("beforeend", bubble(m));
    bindGo(log);
    bindActs();
    scroll();
  };
  let busy = false;
  const send = async q => {
    q = (q || inp.value).trim();
    if (!q || busy) return;
    busy = true;
    inp.value = "";
    grow();
    document.getElementById("chatsamples").hidden = true;
    const um = { role: "user", content: q };
    chatLog.push(um);
    add(um);
    tools();
    log.insertAdjacentHTML(
      "beforeend",
      `<div class="bubble ai typing" id="typing" aria-label="${esc(tr("Mahi is typing", "Mahi está escribiendo"))}"><i></i><i></i><i></i></div>`
    );
    scroll();
    const t0 = Date.now();
    let reply;
    const local = await localAgent(q);
    if (has) {
      try {
        const ui = { actions: [], after: null, used: [] };
        const a = await mahiAgentTurn(q, ui);
        reply = { role: "assistant", content: a || "…", actions: ui.actions, aid: Date.now() };
        if (ui.after) setTimeout(ui.after, 1400);
      } catch (e) {
        mahiHistory = [];
        reply =
          local.go === "settings"
            ? {
                role: "assistant",
                content: tr(
                  "I couldn't reach my AI just now. Please check your internet and try again in a moment.",
                  "No pude conectar con mi IA. Revise su internet e intente de nuevo en un momento."
                )
              }
            : {
                role: "assistant",
                content:
                  local.text +
                  "\n\n" +
                  tr(
                    "(The AI couldn't be reached, so this is a quick answer.)",
                    "(No se pudo conectar con la IA, así que esta es una respuesta rápida.)"
                  ),
                go: local.go
              };
      }
    } else {
      await new Promise(r => setTimeout(r, Math.max(0, 650 - (Date.now() - t0))));
      reply = { role: "assistant", content: local.text, go: local.go };
    }
    const ty = document.getElementById("typing");
    if (ty) ty.remove();
    chatLog.push(reply);
    add(reply);
    tools();
    busy = false;
    inp.focus();
  };
  document.getElementById("chatgo").onclick = () => send();
  inp.onkeydown = e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };
  view.querySelectorAll("[data-q]").forEach(b => (b.onclick = () => send(b.dataset.q)));
  bindGo(log);
  document.getElementById("chatread").onclick = () => {
    const last = [hello, ...chatLog].reverse().find(m => m.role === "assistant");
    if (last) speak(last.content);
  };
  document.getElementById("chatclear").onclick = () => {
    chatLog = [];
    mahiHistory = [];
    renderHelper();
  };
  document.getElementById("chatsave").onclick = () => {
    const txt =
      `ScamSense chat · ${new Date().toLocaleString()}\n\n` +
      chatLog.map(m => `${m.role === "user" ? tr("Me", "Yo") : "Mahi"}: ${m.content}`).join("\n\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain;charset=utf-8" }));
    a.download = `ScamSense-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  if (matchMedia("(pointer:fine)").matches) inp.focus();
}

/* =====================================================================
   MAHI'S ACTIONS (tools)
   With AI on, Mahi doesn't just talk: she can check things and do things
   in the app. The AI picks a tool, the app runs it, and Mahi explains.
   ===================================================================== */

const MAHI_SCREENS = {
  today: "Today: daily safety report",
  emails: "List of checked emails",
  check: "Check tab (email, texts, calls, crypto)",
  checkEmail: "Check an email / connect email accounts",
  checkText: "Check a text message",
  checkCall: "Look up a phone number or describe a call",
  checkCrypto: "Check a crypto website, wallet, or offer",
  pause: "Pause before you pay",
  scammed: "I was scammed: recovery plan and reports",
  learn: "Short scam lessons",
  monthly: "Monthly report",
  family: "Family and trusted people",
  settings: "Settings",
  plans: "Plans and prices"
};

const MAHI_TOOLS = [
  {
    name: "check_message",
    description:
      "Check a message the person pasted or described (email, text, call script, social media message) for scam warning signs. Use whenever they share message text.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The message text or what the caller said" },
        sender: { type: "string", description: "Sender email address or phone number, if known" },
        channel: { type: "string", enum: ["email", "text", "call", "other"] }
      },
      required: ["text"]
    }
  },
  {
    name: "lookup_phone",
    description:
      "Look up a phone number: fake format, reported scam number, expensive international or one-ring area code, toll-free.",
    input_schema: { type: "object", properties: { number: { type: "string" } }, required: ["number"] }
  },
  {
    name: "lookup_email",
    description:
      "Check who is behind an email address: throwaway, lookalike/fake brand, real company, or free personal email.",
    input_schema: { type: "object", properties: { email: { type: "string" } }, required: ["email"] }
  },
  {
    name: "check_website",
    description:
      "Check a website address: real brand site, fake lookalike, risky ending, or crypto investment scam site.",
    input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] }
  },
  {
    name: "check_wallet",
    description: "Check a crypto wallet address: what kind it is and whether it has been reported for scams.",
    input_schema: { type: "object", properties: { address: { type: "string" } }, required: ["address"] }
  },
  {
    name: "get_email_report",
    description:
      "Get the person's latest Daily Safety Report from their Gmail scan: counts and the risky emails with reasons. Use when they ask about their email, inbox, or report.",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "read_email",
    description:
      "Read one email from the person's Gmail report in full (sender, Gmail's sender checks, links, attachments, text) so you can judge if it's real or a scam. Use the id from get_email_report, or give from/subject to find it. Always use this instead of asking the person to paste an email from their report.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        from: { type: "string", description: "Sender name or address, if no id" },
        subject: { type: "string", description: "Subject words, if no id" }
      }
    }
  },
  {
    name: "set_email_verdict",
    description:
      "After reading an email with read_email, update its label in the person's report: 'safe' if it's real (official domain, Gmail's checks pass, no scam requests), 'scam' if it's a scam, 'suspicious' if unsure. Give one plain reason.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        verdict: { type: "string", enum: ["safe", "suspicious", "scam"] },
        reason: { type: "string" }
      },
      required: ["id", "verdict", "reason"]
    }
  },
  {
    name: "connect_gmail",
    description:
      "Show a button that connects the person's Gmail (read-only) and scans every folder. Use when they want to connect or scan their email. They must tap the button themselves (Google requires it).",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "start_scam_report",
    description:
      "When someone was scammed (paid, gave bank details, SSN, passwords or codes, or remote access): fill in the 'I was scammed' form with what they told you and build their recovery plan and ready-to-send report documents (bank, FTC, police, FBI IC3, etc.). Ask for missing key details only if needed; it's fine to start with what you have.",
    input_schema: {
      type: "object",
      properties: {
        story: { type: "string", description: "What happened, in the person's words" },
        how_it_started: { type: "string", enum: ["email", "text", "call", "web", "social", "person"] },
        what_happened: {
          type: "array",
          items: { type: "string", enum: ["paid", "bank", "ssn", "pass", "remote"] },
          description:
            "paid=sent money/gift cards, bank=gave bank/card info, ssn=gave SSN, pass=gave password or code, remote=gave computer/phone control"
        },
        payment_method: {
          type: "string",
          enum: ["credit", "debit", "bank", "wire", "app", "gift", "crypto", "cashmail", "courier", "none"]
        },
        amount: { type: "string", description: "Like $500" },
        date: { type: "string", description: "YYYY-MM-DD" },
        pretended_to_be: {
          type: "string",
          enum: [
            "chase",
            "bofa",
            "wells",
            "capone",
            "bankother",
            "amazon",
            "apple",
            "microsoft",
            "paymentapp",
            "ssa",
            "medicare",
            "irs",
            "insurance",
            "other"
          ]
        },
        name_they_used: { type: "string" },
        their_contact: { type: "string", description: "Scammer's phone, email, or website" },
        your_bank: {
          type: "string",
          enum: ["chase", "bofa", "wells", "capone", "bankother", "paymentapp", ""]
        }
      },
      required: ["story"]
    }
  },
  {
    name: "pause_payment",
    description:
      "Someone is asking the person for money and they haven't paid yet: run the 'Pause before you pay' check and show the result.",
    input_schema: {
      type: "object",
      properties: {
        who: {
          type: "string",
          enum: ["gov", "tech", "family", "online", "prize", "company", "seller", "other"]
        },
        how: { type: "string", enum: ["gift", "crypto", "wire", "p2p", "cash", "card", "check", "other"] },
        amount: { type: "string" },
        story: { type: "string" }
      }
    }
  },
  {
    name: "add_trusted_person",
    description: "Add a family member or friend to the person's trusted people (Family tab).",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        relation: {
          type: "string",
          enum: ["daughter", "son", "spouse", "grandchild", "sibling", "friend", "caregiver"]
        }
      },
      required: ["name"]
    }
  },
  {
    name: "start_lesson",
    description: "Open a one-minute scam lesson with a quiz.",
    input_schema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          enum: ["payment", "impostor", "codes", "family", "tech", "texts", "prize", "crypto"]
        }
      },
      required: ["topic"]
    }
  },
  {
    name: "open_screen",
    description:
      "Open a screen in the ScamSense app for the person. Screens: " + JSON.stringify(MAHI_SCREENS),
    input_schema: {
      type: "object",
      properties: { screen: { type: "string", enum: Object.keys(MAHI_SCREENS) } },
      required: ["screen"]
    }
  }
];

/* Runs one tool. `ui` collects buttons to show and a screen to open after Mahi replies. */
async function runMahiTool(name, input, ui) {
  const i = input || {};
  switch (name) {
    case "check_message": {
      const text = String(i.text || "");
      const sender = String(i.sender || "");
      const urls =
        text.match(/\bhttps?:\/\/[^\s<>"']+|\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"']*)?/gi) || [];
      const links = urls
        .slice(0, 20)
        .map(u => ({ href: /^https?:/i.test(u) ? u : "https://" + u, host: hostOf(u), text: "" }));
      const r = analyze({
        subject: "",
        text,
        fromName: "",
        fromEmail: sender.includes("@") ? sender : "",
        replyTo: "",
        auth: "",
        links,
        attachments: []
      });
      const out = {
        verdict: r.level === "warn" ? "suspicious" : r.level,
        kind: r.kind || null,
        warning_signs: r.reasons
      };
      if (sender && !sender.includes("@")) out.sender_number = numberInfo(sender);
      if (sender.includes("@")) out.sender_email = await emailInfo(sender);
      return out;
    }
    case "lookup_phone":
      return numberInfo(i.number) || { error: "Not a phone number" };
    case "lookup_email":
      try {
        await loadDisposable();
      } catch (e) {}
      return (await emailInfo(i.email)) || { error: "Not an email address" };
    case "check_website":
      return cryptoSiteInfo(i.url) || { error: "Not a website address" };
    case "check_wallet":
      return walletInfo(i.address) || { error: "Not a wallet address" };
    case "get_email_report": {
      const rep = S.get("report", null);
      if (!rep) {
        ui.actions.push({
          label: tr("Connect Gmail and scan", "Conectar Gmail y revisar"),
          run: () => scanGmail()
        });
        return { report: null, note: "No scan yet. A Connect Gmail button is shown." };
      }
      const n = { scam: 0, warn: 0, safe: 0 };
      rep.items.forEach(x => n[x.level]++);
      ui.actions.push({ label: tr("See your emails", "Ver sus correos"), run: () => go("emails") });
      return {
        scanned_at: new Date(rep.at).toString(),
        source: rep.source === "demo" ? "demo inbox (made-up emails)" : "Gmail",
        counts: { scam: n.scam, suspicious: n.warn, safe: n.safe },
        risky: rep.items
          .filter(x => x.level !== "safe")
          .slice(0, 12)
          .map(x => ({
            id: x.id,
            level: x.level,
            from: x.fromName || x.fromEmail,
            email: x.fromEmail,
            subject: x.subject,
            folder: x.folder,
            why: ((x.local && x.local.reasons) || x.reasons || []).slice(0, 2)
          })),
        note: "To check one fully, call read_email with its id. Never ask the person to paste it."
      };
    }
    case "read_email": {
      const rep = S.get("report", null);
      if (!rep) return { error: "No email report yet. Use connect_gmail first." };
      const low = v => String(v || "").toLowerCase();
      const item =
        rep.items.find(x => x.id === i.id) ||
        rep.items.find(
          x =>
            i.from &&
            (low(x.fromEmail).includes(low(i.from)) || low(x.fromName).includes(low(i.from))) &&
            (!i.subject || low(x.subject).includes(low(i.subject).slice(0, 25)))
        ) ||
        (i.subject && rep.items.find(x => low(x.subject).includes(low(i.subject).slice(0, 25))));
      if (!item) return { error: "Couldn't find that email in the report." };
      let full = null;
      if (rep.source === "demo") {
        const d = DEMO[+String(item.id).replace("demo", "")];
        full = d
          ? Object.assign(
              { links: [], attachments: [], replyTo: "", auth: "" },
              JSON.parse(JSON.stringify(d))
            )
          : null;
      } else {
        if (!token) {
          ui.actions.push({
            label: tr("Reconnect Gmail so Mahi can read it", "Reconectar Gmail para que Mahi lo lea"),
            primary: true,
            run: async () => {
              try {
                await getToken(true);
                toast(tr("Connected. Ask Mahi again.", "Conectado. Pregúntele a Mahi otra vez."));
              } catch (e) {
                toast(e.message);
              }
            }
          });
          return {
            error:
              "Gmail sign-in has expired (it lasts about an hour). A Reconnect button is shown; ask the person to tap it and ask again."
          };
        }
        full = parseGmail(await getGmailMessage(item.id));
      }
      if (!full) return { error: "Couldn't open that email." };
      const r = analyze(full);
      const auth = String(full.auth || "");
      const pick = k => (auth.match(new RegExp(k + "=(\\w+)", "i")) || [])[1] || "none";
      return {
        id: item.id,
        from: full.fromName,
        email: full.fromEmail,
        reply_to: full.replyTo || null,
        subject: full.subject,
        folder: item.folder,
        gmail_sender_checks: { spf: pick("spf"), dkim: pick("dkim"), dmarc: pick("dmarc") },
        sender_check: await emailInfo(full.fromEmail),
        link_destinations: [...new Set((full.links || []).map(l => l.host))].slice(0, 15),
        attachments: full.attachments || [],
        scamsense_rules: {
          verdict: r.level === "warn" ? "suspicious" : r.level,
          trusted_sender: !!r.trusted,
          warning_signs: r.reasons
        },
        text: String(full.text || "").slice(0, 3500)
      };
    }
    case "set_email_verdict": {
      const rep = S.get("report", null);
      const it = rep && rep.items.find(x => x.id === i.id);
      if (!it) return { error: "Couldn't find that email in the report." };
      const lv = { safe: "safe", suspicious: "warn", scam: "scam" }[i.verdict];
      if (!lv) return { error: "Unknown verdict" };
      it.level = lv;
      it.ai = null;
      it.local = Object.assign({}, it.local, {
        level: lv,
        reasons: [String(i.reason || "").slice(0, 300)],
        kind: lv === "safe" ? "" : (it.local && it.local.kind) || "",
        kindKey: lv === "safe" ? "" : (it.local && it.local.kindKey) || ""
      });
      it.checkedByMahi = true;
      S.set("report", rep);
      ui.actions.push({ label: tr("See your emails", "Ver sus correos"), run: () => go("emails") });
      return { updated: true, verdict: i.verdict };
    }
    case "connect_gmail":
      ui.actions.push({
        label: S.get("connected", false)
          ? tr("Scan my Gmail now", "Revisar mi Gmail ahora")
          : tr("Connect Gmail and scan", "Conectar Gmail y revisar"),
        primary: true,
        run: () => scanGmail()
      });
      return {
        shown: "A button is shown. The person taps it, signs in with Google (read-only), and the scan starts."
      };
    case "start_scam_report": {
      const what = Array.isArray(i.what_happened) ? i.what_happened : [];
      scamState = Object.assign({}, scamState, {
        how: i.how_it_started || scamState.how,
        what: what.length ? what : scamState.what,
        method: i.payment_method || scamState.method,
        amt: i.amount || scamState.amt,
        date: i.date || scamState.date,
        pretend: i.name_they_used || scamState.pretend,
        org: i.pretended_to_be || scamState.org,
        bank: i.your_bank != null ? i.your_bank : scamState.bank,
        contact: i.their_contact || scamState.contact,
        story: i.story || scamState.story
      });
      ui.after = () => {
        go("scammed");
        setTimeout(() => {
          try {
            buildPlan(true);
            document.getElementById("splan").scrollIntoView({ behavior: "smooth" });
          } catch (e) {}
        }, 150);
      };
      ui.actions.push({ label: tr("Open my recovery plan", "Abrir mi plan"), primary: true, run: ui.after });
      return {
        done: "The 'I was scammed' form is filled in. The recovery plan and report documents (case file, bank, FTC, police, IC3) open right after this reply.",
        filled: {
          what_happened: scamState.what,
          payment_method: scamState.method,
          amount: scamState.amt,
          pretended_to_be: scamState.org,
          your_bank: scamState.bank
        }
      };
    }
    case "pause_payment": {
      pauseState = { who: i.who || "", how: i.how || "", amt: i.amount || "", note: i.story || "" };
      const r = assessPayment(pauseState);
      ui.after = () => {
        go("pause");
        setTimeout(() => runPause(), 150);
      };
      ui.actions.push({ label: t("pause_card"), primary: true, run: ui.after });
      return {
        result: r && r.level ? r.level : r,
        reasons: r && r.reasons ? r.reasons : undefined,
        note: "The Pause screen opens after this reply."
      };
    }
    case "add_trusted_person": {
      if (!i.phone && !i.email)
        return { error: "Need a phone number or email for this person. Ask for one." };
      const hs = S.get("helpers", []);
      hs.push({
        name: String(i.name).slice(0, 60),
        rel: i.relation || "",
        phone: i.phone || "",
        email: i.email || ""
      });
      S.set("helpers", hs);
      ui.actions.push({ label: tr("Open Family", "Abrir Familia"), run: () => go("family") });
      return { added: i.name, total_trusted_people: hs.length };
    }
    case "start_lesson":
      currentLesson = i.topic;
      ui.after = () => go("lesson");
      ui.actions.push({ label: tr("Start the lesson", "Empezar la lección"), primary: true, run: ui.after });
      return { opening: i.topic };
    case "open_screen":
      if (!MAHI_SCREENS[i.screen]) return { error: "Unknown screen" };
      ui.after = () => go(i.screen);
      ui.actions.push({ label: tr("Open it", "Abrirlo"), primary: true, run: ui.after });
      return { done: "The " + i.screen + " screen opens right after this reply." };
  }
  return { error: "Unknown tool" };
}

/* One AI turn with tools. Uses the Mahi server if set, otherwise the AI key in Settings. */
async function mahiAI(messages) {
  const c = cfg();
  const system = HELPER_SYSTEM() + " " + MAHI_ACTION_RULES;
  if (c.mahiUrl) {
    const res = await fetch(c.mahiUrl, {
      method: "POST",
      body: JSON.stringify({
        messages,
        tools: MAHI_TOOLS,
        lang: LANGS[langCode()].ai,
        system_extra: MAHI_ACTION_RULES
      })
    });
    const j = await res.json();
    if (j.error) throw new Error(j.error);
    return j.content ? j : { content: [{ type: "text", text: j.text || "" }], stop_reason: "end_turn" };
  }
  if (!c.apiKey) throw new Error("no-key");
  let res,
    tries = 0;
  while (true) {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": c.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({ model: c.model, max_tokens: 900, system, tools: MAHI_TOOLS, messages })
    });
    if ((res.status === 429 || res.status === 529 || res.status >= 500) && tries < 2) {
      tries++;
      await new Promise(r => setTimeout(r, 2000 * tries));
      continue;
    }
    break;
  }
  if (!res.ok) throw new Error("AI error " + res.status);
  return res.json();
}

const MAHI_ACTION_RULES =
  "When the person asks about an email in their report, read it yourself with read_email (never ask them to paste it). Judge it from the sender's real domain, Gmail's SPF/DKIM/DMARC results, the links, and the text, then update its label with set_email_verdict and tell them clearly: real or scam, and why. Official senders include toll agencies like getipass.com (Illinois Tollway I-PASS), pikepass.com, txtag.org, E-ZPass sites, and sunpass.com. You can take actions with your tools. Use them instead of just explaining: check any message, number, email, website, or wallet the person shares; look at their email report; connect Gmail; fill in and build their scam report and recovery plan; run Pause before you pay; add trusted people; open lessons and screens. After using a tool, explain the result simply and say what you did. Never invent tool results.";

/* The full agent loop: ask the AI, run any tools it picks, repeat (up to 6 steps). */
let mahiHistory = [];
async function mahiAgentTurn(question, ui) {
  mahiHistory.push({ role: "user", content: question });
  mahiHistory = mahiHistory.slice(-24);
  while (mahiHistory.length && (mahiHistory[0].role !== "user" || typeof mahiHistory[0].content !== "string"))
    mahiHistory.shift();
  const said = [];
  for (let step = 0; step < 6; step++) {
    const r = await mahiAI(mahiHistory);
    const content = r.content || [];
    mahiHistory.push({ role: "assistant", content });
    content.filter(b => b.type === "text" && b.text.trim()).forEach(b => said.push(b.text.trim()));
    const uses = content.filter(b => b.type === "tool_use");
    if (!uses.length || r.stop_reason !== "tool_use") return said.join("\n\n");
    const results = [];
    for (const u of uses) {
      let out;
      try {
        out = await runMahiTool(u.name, u.input, ui);
      } catch (e) {
        out = { error: String((e && e.message) || e) };
      }
      ui.used.push(u.name);
      results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out).slice(0, 6000) });
    }
    mahiHistory.push({ role: "user", content: results });
  }
  return tr(
    "I've done the steps I could. Tap a button below to continue.",
    "Hice los pasos que pude. Toque un botón abajo para seguir."
  );
}

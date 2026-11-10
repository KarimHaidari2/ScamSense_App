/*
 * ScamSense · Ask Mahi (AI helper)
 * The chat helper: built-in quick answers, plus the AI when a key is set.
 */
"use strict";

let chatLog = [];
const HELPER_SYSTEM = () =>
  `You are Mahi, the friendly assistant inside ScamSense, an app that protects people (especially older adults) from scams. Answer ANY question the person asks, helpfully and honestly, not only scam questions; your specialty is staying safe from scams, fraud, and identity theft. Answer in ${LANGS[langCode()].ai}. Use short, plain sentences a 75-year-old can follow, under 8 short lines unless they ask for more. Never ask for passwords, codes, card numbers, or Social Security numbers, and remind people never to share them. If they may have lost money or shared private details, tell them to call their bank right away and to use "I was scammed" in the Help tab. If they want a real person, suggest a trusted family member, the AARP Fraud Watch Network Helpline 877-908-3360, or (age 60+) the National Elder Fraud Hotline 1-833-372-8311. If someone is in danger, tell them to call 911. If you're not sure, say so.`;

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
    `<div class="bubble ${m.role === "user" ? "me" : "ai"}" dir="auto">${esc(m.content)}${m.go && AGENT_GO[m.go] ? `<button class="btn ghost sm bgo" data-go="${m.go}">${esc(AGENT_GO[m.go]())} ${ic("chev", "chev")}</button>` : ""}</div>`;
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
  const add = m => {
    log.insertAdjacentHTML("beforeend", bubble(m));
    bindGo(log);
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
        const msgs = chatLog
          .filter(m => m.role)
          .map(m => ({ role: m.role, content: m.content }))
          .slice(-12);
        const a = viaServer ? await callMahiServer(msgs) : await callClaude(HELPER_SYSTEM(), msgs, 600);
        reply = { role: "assistant", content: a.trim(), go: local.go === "settings" ? null : local.go };
      } catch (e) {
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

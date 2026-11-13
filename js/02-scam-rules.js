/*
 * ScamSense · Scam rules
 * The warning-sign rules and the analyze() function that scores any message as scam, suspicious, or safe.
 */
"use strict";

const RULES = [
  {
    re: /gift ?cards?|itunes card|google play card|steam card|apple card balance/i,
    pts: 5,
    why: "Asks for payment by gift card. Real companies, police, and the government never ask for gift cards.",
    es: "Pide pago con tarjetas de regalo. Las empresas reales, la policía y el gobierno nunca piden tarjetas de regalo.",
    type: "payment"
  },
  {
    re: /bitcoin|crypto(currency)?|\busdt\b|btc atm|bitcoin atm|wire transfer|western union|moneygram/i,
    pts: 4,
    why: "Mentions crypto or a wire transfer. Money sent this way is almost impossible to get back.",
    es: "Menciona criptomonedas o una transferencia bancaria. El dinero enviado así casi nunca se recupera.",
    type: "payment"
  },
  {
    re: /\b(zelle|venmo|cash ?app)\b/i,
    pts: 1,
    why: "Mentions an instant payment app, which scammers like because payments can't be undone.",
    es: "Menciona una app de pago instantáneo; a los estafadores les gusta porque los pagos no se pueden deshacer.",
    type: "payment"
  },
  {
    re: /verification code|one[- ]time (pass)?code|6[- ]digit code|security code|\bOTP\b|pin number/i,
    pts: 5,
    why: "Asks for a code. Never share a code sent to your phone, even with your bank.",
    es: "Pide un código. Nunca comparta un código enviado a su teléfono, ni siquiera con su banco.",
    type: "account"
  },
  {
    re: /(enter|confirm|verify|update|provide|send)( your)? (password|social security|ssn|account number|routing number|medicare number|card number|billing information|payment information)/i,
    pts: 5,
    why: "Asks you to give private information like a password, card, or Social Security number.",
    es: "Le pide información privada como una contraseña, tarjeta o número de Seguro Social.",
    type: "account"
  },
  {
    re: /within 24 hours|within 48 hours|immediately|right away|act now|urgent|final notice|final warning|as soon as possible/i,
    pts: 2,
    why: "Uses pressure to rush you. Scammers want you to act before you think.",
    es: "Le presiona para que se apure. Los estafadores quieren que actúe antes de pensar.",
    type: "pressure"
  },
  {
    re: /suspend|suspension|will be locked|has been locked|frozen|deactivat|closed permanently|late fee|unusual (sign[- ]in|activity)/i,
    pts: 2,
    why: "Threatens to lock or close something, or says there was unusual activity, to scare you.",
    es: "Amenaza con bloquear o cerrar algo, o dice que hubo actividad inusual, para asustarle.",
    type: "pressure"
  },
  {
    re: /\barrest|warrant|lawsuit|legal action|deport|\bjail\b|\bbail\b/i,
    pts: 3,
    why: "Mentions arrest, legal action, or bail. This is a common way to scare people into paying.",
    es: "Menciona arresto, acción legal o fianza. Es una forma común de asustar a la gente para que pague.",
    type: "threat"
  },
  {
    re: /don'?t tell|do not tell|keep (this|it) (a )?secret|between (us|you and me)/i,
    pts: 4,
    why: "Asks you to keep it secret. Scammers don't want family to stop you.",
    es: "Le pide que lo mantenga en secreto. Los estafadores no quieren que su familia lo detenga.",
    type: "family"
  },
  {
    re: /\bgrand(ma|pa|mother|father)\b|\bit'?s me\b|this is your (grand)?(son|daughter)|my new number/i,
    pts: 2,
    why: "Claims to be a family member, maybe from a new number. Call them on the number you already have.",
    es: "Dice ser un familiar, quizás desde un número nuevo. Llámele al número que usted ya tiene.",
    type: "family"
  },
  {
    re: /you('ve| have)? won|\bwinner\b|lottery|sweepstakes|claim your (prize|reward)|unclaimed (funds|inheritance)/i,
    pts: 4,
    why: "Says you won something. You can't win a contest you didn't enter.",
    es: "Dice que usted ganó algo. No se puede ganar un concurso en el que no participó.",
    type: "prize"
  },
  {
    re: /refund department|call (us|our|this number|now)|call .{0,30}\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}|1-8(00|88|77|66|55|44|33)/i,
    pts: 2,
    why: "Gives you a phone number to call. Use the number on your card or the company's real website instead.",
    es: "Le da un número para llamar. Use el número de su tarjeta o del sitio web real de la empresa.",
    type: "callback"
  },
  {
    re: /anydesk|teamviewer|ultraviewer|remote access|screen ?share/i,
    pts: 5,
    why: "Asks you to install remote access software. That gives a stranger control of your device.",
    es: "Le pide instalar un programa de acceso remoto. Eso le da a un extraño control de su dispositivo.",
    type: "tech"
  },
  {
    re: /unpaid toll|toll (balance|payment|violation)|package (could not|can'?t|cannot) be delivered|redelivery|customs fee|incomplete (address|shipping)/i,
    pts: 3,
    why: "Unpaid toll or missed delivery. These fake messages are very common right now.",
    es: "Peaje sin pagar o paquete no entregado. Estos mensajes falsos son muy comunes ahora.",
    type: "toll"
  },
  {
    re: /guaranteed (returns?|profits?)|daily (profits?|returns?|income)|\d+(\.\d+)?% (daily|per day|a day)|risk[- ]free invest/i,
    pts: 5,
    why: "Promises guaranteed or daily profits. Real investments never guarantee returns.",
    es: "Promete ganancias garantizadas o diarias. Las inversiones reales nunca garantizan ganancias.",
    type: "crypto"
  },
  {
    re: /withdraw(al)?.{0,40}(fee|tax|deposit|unlock)|pay (a |the )?(tax|fee) to (withdraw|release|unlock)/i,
    pts: 6,
    why: "Asks you to pay a fee or tax before you can withdraw. That's how crypto investment scams take more money.",
    es: "Le pide pagar un cargo o impuesto antes de retirar. Así las estafas cripto le quitan más dinero.",
    type: "crypto"
  },
  {
    re: /mining pool|liquidity mining|cloud mining|trading bot|arbitrage bot|\busdt\b|tether/i,
    pts: 2,
    why: "Talks about crypto mining, trading bots, or USDT, which are common in crypto investment scams.",
    es: "Habla de minería cripto, bots de inversión o USDT, comunes en estafas de inversión.",
    type: "crypto"
  },
  {
    re: /(talk|chat|message|text|add me) (on|to|in) (whatsapp|telegram|signal|line)|(move|switch) to (whatsapp|telegram)/i,
    pts: 3,
    why: "Asks to move the chat to WhatsApp or Telegram, a common step in investment and romance scams.",
    es: "Pide pasar la conversación a WhatsApp o Telegram, un paso común en estafas de inversión y romance.",
    type: "crypto"
  },
  {
    re: /wrong number/i,
    pts: 2,
    why: 'Starts as a "wrong number" message. Scammers use this to start friendly chats that later turn to investing.',
    es: 'Empieza como un mensaje de "número equivocado". Los estafadores lo usan para iniciar charlas que luego terminan en inversiones.',
    type: "crypto"
  },
  {
    re: /auto[- ]?renew(al|ed)? .{0,40}\$\d|subscription (has been )?renewed|invoice #|charged \$\d|purchase of \$\d|did not (make|authorize) this/i,
    pts: 2,
    why: "Claims a charge or renewal you may not recognize, to get you to call or click.",
    es: "Dice que hay un cargo o renovación que quizás no reconoce, para que llame o haga clic.",
    type: "callback"
  }
];
const TYPES_EN = {
  payment: "payment scam",
  account: "account takeover scam",
  pressure: "pressure scam",
  threat: "fake police or government scam",
  family: "family emergency scam",
  prize: "fake prize scam",
  callback: "fake refund or support scam",
  tech: "tech support scam",
  toll: "fake toll or delivery scam",
  sender: "fake sender (impersonation)",
  link: "fake link (phishing)",
  crypto: "crypto investment scam"
};
const TYPES_ES = {
  payment: "estafa de pago",
  account: "robo de cuenta",
  pressure: "estafa de presión",
  threat: "falsa policía o gobierno",
  family: "emergencia familiar falsa",
  prize: "premio falso",
  callback: "reembolso o soporte falso",
  tech: "falso soporte técnico",
  toll: "peaje o entrega falsa",
  sender: "remitente falso",
  link: "enlace falso (phishing)",
  crypto: "estafa de inversión cripto"
};
const TYPES = new Proxy({}, { get: (o, k) => (uiLang() === "es" ? TYPES_ES[k] : xl(TYPES_EN[k])) });

const BRANDS = {
  amazon: ["amazon.com", "amazon.co.uk", "amazon.ca", "amazonses.com", "amazonaws.com"],
  paypal: ["paypal.com", "paypal.co.uk"],
  apple: ["apple.com", "icloud.com", "itunes.com", "me.com"],
  microsoft: [
    "microsoft.com",
    "outlook.com",
    "live.com",
    "office.com",
    "office365.com",
    "microsoftonline.com",
    "hotmail.com"
  ],
  netflix: ["netflix.com"],
  chase: ["chase.com", "jpmorgan.com", "jpmchase.com"],
  "wells fargo": ["wellsfargo.com"],
  "bank of america": ["bankofamerica.com", "bofa.com", "ealerts.bankofamerica.com"],
  usps: ["usps.com", "usps.gov"],
  fedex: ["fedex.com"],
  ups: ["ups.com"],
  irs: ["irs.gov", "treasury.gov"],
  "social security": ["ssa.gov"],
  medicare: ["medicare.gov", "cms.gov", "hhs.gov"],
  "geek squad": ["bestbuy.com", "geeksquad.com"],
  norton: ["norton.com", "nortonlifelock.com", "gen.digital"],
  mcafee: ["mcafee.com"],
  coinbase: ["coinbase.com"],
  venmo: ["venmo.com"],
  walmart: ["walmart.com"],
  costco: ["costco.com"],
  docusign: ["docusign.com", "docusign.net"],
  facebook: ["facebook.com", "facebookmail.com", "meta.com"],
  instagram: ["instagram.com", "mail.instagram.com"],
  google: ["google.com", "accounts.google.com", "youtube.com"],
  txtag: ["txtag.org"],
  "e-zpass": ["e-zpassny.com", "ezpassnj.com", "e-zpass.com"],
  pikepass: ["pikepass.com", "oktollpay.com"],
  "illinois tollway": ["getipass.com", "illinoistollway.com"],
  "i-pass": ["getipass.com", "illinoistollway.com"],
  sunpass: ["sunpass.com"],
  fastrak: ["bayareafastrak.org", "thetollroads.com"],
  ntta: ["ntta.org"],
  "peach pass": ["peachpass.com"],
  "nc quick pass": ["ncquickpass.com"],
  "good to go": ["mygoodtogo.com"],
  "e-zpass md": ["ezpassmd.com"],
  "e-zpass va": ["ezpassva.com"],
  "e-zpass pa": ["paturnpike.com"]
};
const FREE_MAIL =
  /^(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|aol|icloud|me|proton|protonmail|gmx|mail|zoho)\.(com|net|me|org)$/;
const BAD_TLD =
  /\.(xyz|top|info|click|live|shop|online|site|icu|ru|cn|buzz|cyou|rest|sbs|cfd|monster|zip|mov)$/;
const SHORT = /^(bit\.ly|tinyurl\.com|t\.co|rb\.gy|is\.gd|cutt\.ly|ow\.ly|shorturl\.at|tiny\.cc|s\.id)$/;
const RISKY_FILE = /\.(html?|shtml|zip|rar|7z|exe|scr|iso|img|js|vbs|bat|cmd|msi|lnk|svg)$/i;

function baseDomain(h) {
  h = (h || "").toLowerCase().replace(/^www\./, "");
  const p = h.split(".");
  if (p.length <= 2) return h;
  const two = p.slice(-2).join(".");
  if (/^(co|com|org|net|gov|ac)\.[a-z]{2}$/.test(two)) return p.slice(-3).join(".");
  return two;
}
function legitFor(brand, host) {
  host = (host || "").toLowerCase();
  return BRANDS[brand].some(d => host === d || host.endsWith("." + d));
}
function unleet(s) {
  return s
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/1/g, "l")
    .replace(/3/g, "e")
    .replace(/5/g, "s")
    .replace(/rn/g, "m")
    .replace(/vv/g, "w");
}
function lookalikeBrand(host) {
  const label = unleet(host.replace(/\.[a-z.]+$/, "").replace(/[^a-z0-9.-]/g, ""));
  const flat = label.replace(/[^a-z]/g, "");
  for (const b of Object.keys(BRANDS)) {
    const key = b.replace(/[^a-z]/g, "");
    if (key.length < 4) continue;
    if (flat.includes(key) && !legitFor(b, host)) return b;
  }
  return null;
}
function hostOf(u) {
  try {
    const x = new URL(u.startsWith("http") ? u : "https://" + u);
    return x.hostname.toLowerCase();
  } catch (e) {
    return "";
  }
}
const BNAME = {
  paypal: "PayPal",
  usps: "USPS",
  ups: "UPS",
  fedex: "FedEx",
  irs: "IRS",
  txtag: "TxTag",
  "e-zpass": "E-ZPass",
  mcafee: "McAfee",
  docusign: "DocuSign",
  pikepass: "PikePass"
};
function cap(s) {
  return BNAME[s] || s.replace(/\b\w/g, c => c.toUpperCase());
}

function textSignals(t) {
  const reasons = [],
    types = {};
  let score = 0;
  RULES.forEach(r => {
    if (r.re.test(t)) {
      score += r.pts;
      reasons.push(tr(r.why, r.es));
      types[r.type] = (types[r.type] || 0) + r.pts;
    }
  });
  const urls =
    t.match(
      /\b(?:https?:\/\/|www\.)[^\s)<>"']+|\b[a-z0-9-]+\.(?:xyz|top|info|click|live|shop|online|site|icu|ru|cn|buzz|cyou|sbs|cfd)(?:\/[^\s]*)?/gi
    ) || [];
  return { score, reasons, types, urls };
}
function linkSignals(links, add) {
  const seen = new Set();
  links.forEach(l => {
    const host = l.host || hostOf(l.href);
    if (!host || seen.has(host)) return;
    seen.add(host);
    const lb = lookalikeBrand(host);
    if (BAD_TLD.test(host))
      add(
        4,
        tr(
          `A link goes to "${host}", an unusual web address real companies don't use.`,
          `Un enlace va a "${host}", una dirección rara que las empresas reales no usan.`
        ),
        "link"
      );
    else if (SHORT.test(host))
      add(
        3,
        tr(
          `A link is shortened ("${host}"), so you can't see where it really goes.`,
          `Un enlace está acortado ("${host}"), así que no se ve a dónde va.`
        ),
        "link"
      );
    else if (/^\d+\.\d+\.\d+\.\d+$/.test(host))
      add(
        4,
        tr(
          "A link is a string of numbers, not a real company website.",
          "Un enlace es una serie de números, no un sitio real."
        ),
        "link"
      );
    else if (lb)
      add(
        5,
        tr(
          `A link goes to "${host}". It looks like ${cap(lb)}, but it isn't ${cap(lb)}'s real website.`,
          `Un enlace va a "${host}". Parece ${cap(lb)}, pero no es su sitio real.`
        ),
        "link"
      );
    // link text shows one website but actually goes to another
    const shown = (l.text || "").match(/^(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:\/|$)/i);
    if (shown && baseDomain(shown[1]) !== baseDomain(host))
      add(
        4,
        tr(
          `A link says "${shown[1]}" but really goes to "${host}".`,
          `Un enlace dice "${shown[1]}" pero en realidad va a "${host}".`
        ),
        "link"
      );
  });
}

/* Score any message. msg: {text, subject, fromName, fromEmail, replyTo, auth, links, attachments, listUnsub} */
function analyze(msg) {
  const text = [msg.subject || "", msg.text || ""].join("\n");
  const base = textSignals(text);
  let score = base.score;
  const reasons = base.reasons.slice();
  const types = Object.assign({}, base.types);
  const add = (p, w, t) => {
    score += p;
    reasons.push(w);
    types[t] = (types[t] || 0) + p;
  };
  const links = (msg.links || []).slice();
  base.urls.forEach(u => links.push({ href: u, host: hostOf(u), text: "" }));
  linkSignals(links, add);

  let trusted = false;
  if (msg.fromEmail) {
    const dom = (msg.fromEmail.split("@")[1] || "").toLowerCase();
    const name = (msg.fromName || "").toLowerCase();
    const auth = (msg.auth || "").toLowerCase();
    for (const b of Object.keys(BRANDS)) {
      const re = new RegExp("\\b" + b.replace(/[-]/g, "[- ]?") + "\\b", "i");
      if (re.test(name) && !legitFor(b, dom)) {
        add(
          5,
          FREE_MAIL.test(dom)
            ? tr(
                `Says it's from ${cap(b)}, but it was sent from a personal ${dom} address.`,
                `Dice ser de ${cap(b)}, pero se envió desde una cuenta personal de ${dom}.`
              )
            : tr(
                `Says it's from ${cap(b)}, but it was sent from "${dom}", which is not ${cap(b)}.`,
                `Dice ser de ${cap(b)}, pero se envió desde "${dom}", que no es ${cap(b)}.`
              ),
          "sender"
        );
        break;
      }
    }
    if (typeof isDisposable === "function" && isDisposable(dom))
      add(
        6,
        tr(
          `Sent from a temporary (throwaway) email service, ${dom}. Anyone can make one in seconds. Real companies never use these.`,
          `Enviado desde un servicio de correo temporal, ${dom}. Cualquiera lo crea en segundos. Las empresas reales nunca lo usan.`
        ),
        "sender"
      );
    const lb = lookalikeBrand(dom);
    if (lb && !FREE_MAIL.test(dom))
      add(
        5,
        tr(
          `The sender's address "${dom}" looks like ${cap(lb)}, but it's a fake copy.`,
          `La dirección "${dom}" parece de ${cap(lb)}, pero es una copia falsa.`
        ),
        "sender"
      );
    if (/dmarc=fail/.test(auth))
      add(
        4,
        tr(
          "The email failed Gmail's sender check (DMARC). The sender's name may be faked.",
          "El correo no pasó la verificación de remitente de Gmail (DMARC). El nombre puede ser falso."
        ),
        "sender"
      );
    else if (/spf=(fail|softfail)/.test(auth) && /dkim=(fail|none)/.test(auth))
      add(
        3,
        tr(
          "The email failed Gmail's sender checks, so the sender may be faked.",
          "El correo no pasó las verificaciones de Gmail; el remitente puede ser falso."
        ),
        "sender"
      );
    if (msg.replyTo) {
      const rd = (msg.replyTo.split("@")[1] || "").toLowerCase().replace(/>.*$/, "");
      if (rd && baseDomain(rd) !== baseDomain(dom))
        add(
          2,
          tr(
            `Replies would go to a different address (${rd}) than the sender.`,
            `Las respuestas irían a otra dirección (${rd}), no al remitente.`
          ),
          "sender"
        );
    }
    const legitBrand = Object.keys(BRANDS).some(b => legitFor(b, dom));
    // Senders the person marked as real ("This email is real") count like a known company.
    const mySenders = typeof S !== "undefined" ? S.get("mysenders", []) : [];
    const markedReal = mySenders.includes(baseDomain(dom));
    if ((legitBrand || markedReal) && /dmarc=pass|dkim=pass/.test(auth)) trusted = true;
    if (trusted) score = Math.max(0, score - 5);
    else if (msg.listUnsub && /dmarc=pass/.test(auth) && score < 8) score = Math.max(0, score - 2);
  }
  (msg.attachments || []).forEach(f => {
    if (RISKY_FILE.test(f))
      add(
        4,
        tr(
          `Has an attachment "${f}" of a type often used to hide harmful files.`,
          `Tiene un archivo adjunto "${f}" de un tipo usado para esconder virus.`
        ),
        "tech"
      );
  });

  const ranked = Object.entries(types)
    .filter(([k]) => k !== "pressure")
    .sort((a, b) => b[1] - a[1]);
  let kind = ranked.length ? TYPES[ranked[0][0]] : types.pressure ? TYPES.pressure : "";
  if (types.family && types.payment) kind = TYPES.family;
  if (types.toll) kind = TYPES.toll;
  let kindKey = ranked.length ? ranked[0][0] : types.pressure ? "pressure" : "";
  if (types.family && types.payment) kindKey = "family";
  if (types.toll) kindKey = "toll";
  const level = score >= 8 ? "scam" : score >= 4 ? "warn" : "safe";
  return { score, reasons: [...new Set(reasons)], kind, kindKey, level, trusted };
}

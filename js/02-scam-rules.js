/*
 * ScamSense · Scam rules
 * The warning-sign rules and the analyze() function that scores any message as scam, suspicious, or safe.
 */
"use strict";

const RULES = [
  {
    // Only when it asks you to PAY with gift cards (winning one in a contest is a different sign)
    re: /\b(pay|paying|payment|buy|buying|purchase|send|sending|pick up|go (to|get)[^.]{0,20}(store|walmart|target|cvs))\b[^.]{0,50}\bgift ?cards?|\bgift ?cards?\b[^.]{0,50}\b(codes?|numbers?|pin|back of|scratch|read (me|us|them))\b|\b(in|with) (\$?\d[\d,]* (in|of) )?gift ?cards\b|itunes card|google play card|steam card|apple card balance/i,
    // Not a store selling its own gift cards ("get $10 for each $50 gift card purchase")
    not: /\b(for (each|every)|with (each|every)|when you (buy|purchase)|bonus|rewards?|star money|promo(tion)?|% off|get \$\d+)\b[^.]{0,60}\bgift ?cards?|\bgift ?cards?\b[^.]{0,30}\b(purchases?|bonus|promo(tion)?|sale|deal|special)\b/i,
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
    re: /suspend|suspension|will be locked|has been locked|(has been|is|was) (limited|restricted)\b|account (limited|restricted|on hold)|frozen|deactivat|closed permanently|late fee|unusual (sign[- ]in|activity)/i,
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
  },
  {
    re: /\b(save|lose|losing|keep|back ?up) your (photos|pictures|videos|files|memories)|storage (space )?(is )?(full|almost full|limit|exceeded|expir)|(cloud|photo) storage.{0,40}(locked|blocked|suspend|expir|full|deleted)|renew (it )?for free/i,
    pts: 4,
    why: "Warns that your photos or files will be lost unless you act. Fake storage-full messages are a common trick to get your card number.",
    es: "Avisa que perderá sus fotos o archivos si no actúa. Los avisos falsos de almacenamiento lleno son un truco común para obtener su tarjeta.",
    type: "storage"
  },
  {
    re: /\bwe (want|would like|wish) to hire you|you('ve| have) been (selected|hired|chosen|shortlisted) for (a|the|this) (job|position|role)|\bfree job\b|(earn|make) (up to )?\$\d[\d,]* (a|per|every) (day|week|hour) (from home|online|part[- ]time)|(no experience|no interview) (needed|required).{0,40}\b(job|hire|hiring|position)/i,
    pts: 4,
    why: "Offers you a job you never applied for. Fake job offers end with asking for money or your personal information.",
    es: "Le ofrece un trabajo que nunca solicitó. Las ofertas de trabajo falsas terminan pidiendo dinero o sus datos personales.",
    type: "job"
  },
  {
    re: /seeking (marr(ia|ai)ge|a (serious |long[- ]term )?relationship|a (life )?partner|a husband|a wife)|\bmarry you\b|marr(ia|ai)ge with you|(looking|searching) for (a |my )?(soul ?mate|true love|life partner)|\bi am (a )?(lonely|widow(er)?)\b|my (dear|sweet)heart/i,
    pts: 4,
    why: "A stranger talks about love or marriage. Romance scammers build trust for weeks, then ask for money.",
    es: "Un desconocido habla de amor o matrimonio. Los estafadores románticos ganan su confianza por semanas y luego piden dinero.",
    type: "romance"
  },
  {
    re: /\$ ?[\d,]+\s*(credit)?[\s-]*limit|credit[\s-]*limit ?card|card could be ?yours|pre-?(approved|qualified)\b.{0,30}\b(card|loan|credit)|guaranteed (approval|loan|credit)/i,
    pts: 4,
    why: "Offers a credit card or loan out of nowhere. Fake offers collect your Social Security and bank details.",
    es: "Le ofrece una tarjeta de crédito o préstamo de la nada. Las ofertas falsas recogen su Seguro Social y datos bancarios.",
    type: "loan"
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
  crypto: "crypto investment scam",
  storage: "fake storage-full scam",
  job: "fake job offer",
  romance: "romance scam",
  loan: "fake credit or loan offer"
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
  crypto: "estafa de inversión cripto",
  storage: "falso aviso de almacenamiento",
  job: "oferta de trabajo falsa",
  romance: "estafa romántica",
  loan: "oferta falsa de crédito o préstamo"
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
  mastercard: ["mastercard.com", "mastercard.us"],
  coinbase: ["coinbase.com"],
  venmo: ["venmo.com"],
  "ace hardware": ["acehardware.com"],
  yeti: ["yeti.com"],
  walmart: ["walmart.com", "sparkdriverapp.com", "ddiwork.com", "branchapp.com", "walmartspark.com"],
  "spark driver": ["walmart.com", "sparkdriverapp.com", "ddiwork.com", "branchapp.com", "walmartspark.com"],
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
// Free website and file hosting. Anyone can put a page here in minutes; real companies don't send from these.
const FREE_HOSTING =
  /(^|\.)(infinityfree\.(io|net|com)|000webhostapp\.com|weebly\.com|wixsite\.com|firebaseapp\.com|web\.app|netlify\.app|github\.io|glitch\.me|herokuapp\.com|blogspot\.com|sites\.google\.com|storage\.googleapis\.com|r2\.dev|pages\.dev|vercel\.app|ngrok(-free)?\.(app|io)|repl\.co|square\.site|godaddysites\.com|webflow\.io|carrd\.co|mystrikingly\.com|jimdosite\.com|framer\.website|ipfs\.io|dweb\.link|blob\.core\.windows\.net|s3\.amazonaws\.com)$/;
// Mailing services that real companies use to send their emails.
const EMAIL_SERVICES =
  /(^|\.)(helloworlddemail|helloworld|sendgrid|mcsv|mcdlv|rsgsv|mailchimpapp|exacttarget|marketingcloudapps|braze|iterable|klaviyomail|klaviyo|customeriomail|mandrillapp|sparkpostmail|amazonses|mktomail|constantcontact|ccsend|hubspotemail|hs-email|pardot|createsend|cmail\d+|mailgun|postmarkapp|salesforce|attentivemobile|bluecore|cheetahmail|epsilon|responsys|emarsys)\.[a-z.]+$/;
const FREE_MAIL =
  /^(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|aol|icloud|me|proton|protonmail|gmx|mail|zoho)\.(com|net|me|org)$/;
// Well-known companies and organizations. Signed email from these (sender checks passed) is trusted:
// only hard proof of a fake can flag it. Universities (.edu) and government (.gov, .mil) count too,
// but their accounts sometimes get hacked, so those can still be "be careful", never "scam" on words alone.
const KNOWN_SENDERS = new Set(
  Object.values(BRANDS)
    .flat()
    .map(d => baseDomain(d))
    .concat(
      (
        "target.com macys.com bestbuy.com ebay.com etsy.com homedepot.com lowes.com kroger.com walgreens.com cvs.com " +
        "uber.com lyft.com doordash.com instacart.com grubhub.com ubereats.com airbnb.com booking.com expedia.com " +
        "delta.com united.com southwest.com aa.com linkedin.com github.com zoom.us spotify.com hulu.com disneyplus.com " +
        "verizon.com att.com t-mobile.com xfinity.com spectrum.com capitalone.com citi.com discover.com americanexpress.com " +
        "usbank.com pnc.com schwab.com fidelity.com vanguard.com intuit.com turbotax.com adobe.com dropbox.com slack.com " +
        "canva.com greendot.com shopify.com squareup.com stripe.com x.com twitter.com tiktok.com snapchat.com pinterest.com " +
        "reddit.com yahoo.com duolingo.com coursera.org khanacademy.org nytimes.com washingtonpost.com wsj.com"
      ).split(" ")
    )
    .filter(d => !FREE_MAIL.test(d))
);
function knownSender(dom) {
  dom = (dom || "").toLowerCase();
  if (/\.(edu|gov|mil)$|\.k12\.[a-z]{2}\.us$|\.(edu|gov|ac)\.[a-z]{2}$/.test(dom)) return "org";
  return KNOWN_SENDERS.has(baseDomain(dom)) ? "company" : "";
}

const BAD_TLD =
  /\.(xyz|top|info|click|live|shop|online|site|icu|ru|cn|buzz|cyou|rest|sbs|cfd|monster|zip|mov)$/;
// ScamSense's own website. It's on GitHub's free hosting, but it's ours.
const OWN_SITE = /^karimhaidari2\.github\.io$/;
// The addresses ScamSense sends its own emails from (welcome, alerts). Only trusted when signed (DMARC pass).
const OWN_SENDERS = ["karimhaidari321@gmail.com", "scamsense.karim@outlook.com"];
// A sender name that's only a role ("Package_Tracking", "MyParcel", "Storage Warning") and no company.
const GENERIC_NAME =
  /^(my ?)?(package|parcel|shipment|shipping|delivery|tracking|order|storage|cloud|photos?|account|security)([\s_-]*(tracking|warning|alert|notice|update|status|center|centre|team|service|confirmation))*[\s\W]*$/iu;
// Filler that scammers add to subjects to beat spam filters.
const JUNK_TAG = /_{3,}|\w\.\.\w+\.\.\w|[*~]{1,2}[a-z0-9]{2,4}\s*$|[a-z]![a-z]{2,}/i;
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
  // Only the part a company actually owns (paypa1-security.com), not the words in front of it.
  const base = baseDomain(host);
  const label = unleet(base.replace(/\.[a-z.]+$/, "").replace(/[^a-z0-9.-]/g, ""));
  const flat = label.replace(/[^a-z]/g, "");
  for (const b of Object.keys(BRANDS)) {
    const key = b.replace(/[^a-z]/g, "");
    if (key.length < 4) continue;
    if (flat.includes(key) && !legitFor(b, host)) return b;
  }
  return null;
}
// A brand name only in the front part, on another company's site (amazonflexalerts.greendot.com,
// amazon.secure-login.com). Real partners do this; so do scammers. A warning sign, not proof.
function subdomainBrand(host) {
  if (lookalikeBrand(host)) return null;
  const sub = host.slice(0, Math.max(0, host.length - baseDomain(host).length));
  const flat = unleet(sub).replace(/[^a-z]/g, "");
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
    if (r.re.test(t) && !(r.not && r.not.test(t))) {
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
    if (!host || seen.has(host) || OWN_SITE.test(host)) return;
    seen.add(host);
    if (FREE_HOSTING.test(host))
      add(
        4,
        tr(
          `A link goes to "${host}", a free website-hosting service often used for fake pages.`,
          `Un enlace va a "${host}", un alojamiento web gratuito que se usa a menudo para páginas falsas.`
        ),
        "link"
      );
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
    else if (subdomainBrand(host))
      add(
        2,
        tr(
          `A link goes to "${host}", which uses the ${cap(subdomainBrand(host))} name on another company's website (${baseDomain(host)}).`,
          `Un enlace va a "${host}", que usa el nombre ${cap(subdomainBrand(host))} en el sitio de otra empresa (${baseDomain(host)}).`
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
  // ScamSense's own emails (welcome, alerts), really sent by us.
  const fromAddr = (msg.fromEmail || "").toLowerCase();
  if (
    OWN_SENDERS.includes(fromAddr) &&
    /dmarc=pass/i.test(msg.auth || "") &&
    !/dmarc=(fail|none)/i.test(msg.auth || "")
  )
    return {
      score: 0,
      reasons: [],
      kind: "",
      kindKey: "",
      level: "safe",
      trusted: true,
      freeMail: true,
      knownSender: "company"
    };
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
  // Random tags in the subject ("___ #8451735", "d!iscounted", "6u8lll..da..ll") are put there to slip past spam filters.
  if (JUNK_TAG.test(msg.subject || ""))
    add(
      2,
      tr(
        "The subject has odd symbols or random letters mixed in. Scammers do this to slip past spam filters.",
        "El asunto tiene símbolos raros o letras al azar. Los estafadores hacen esto para pasar los filtros de spam."
      ),
      "pressure"
    );

  let trusted = false;
  if (msg.fromEmail) {
    const dom = (msg.fromEmail.split("@")[1] || "").toLowerCase();
    const name = (msg.fromName || "").toLowerCase();
    const auth = (msg.auth || "").toLowerCase();
    for (const b of Object.keys(BRANDS)) {
      const re = new RegExp("\\b" + b.replace(/[-]/g, "[- ]?") + "\\b", "i");
      // Also catch names run together, like "MASTER-CARDOFFER".
      const squashed = b.length >= 8 && !b.includes(" ") && name.replace(/[^a-z]/g, "").includes(b);
      if ((re.test(name) || squashed) && !legitFor(b, dom)) {
        // Real companies often send through a mailing service (HelloWorld, SendGrid, Mailchimp...).
        // If the mail is signed and its links go to the company's real site, the name is fine.
        const signed = /dmarc=pass/.test(auth);
        const realLinks = links.some(l => l.host && legitFor(b, l.host));
        if (signed && !FREE_MAIL.test(dom) && (realLinks || EMAIL_SERVICES.test(dom))) break;
        add(
          signed && msg.listUnsub && !FREE_MAIL.test(dom) ? 2 : 5,
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
    if (FREE_HOSTING.test(dom))
      add(
        5,
        tr(
          `Sent from "${dom}", a free website-hosting service. Real companies don't send email from these.`,
          `Enviado desde "${dom}", un servicio gratuito de alojamiento web. Las empresas reales no envían correos desde ahí.`
        ),
        "sender"
      );
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
    else if (!FREE_MAIL.test(dom) && subdomainBrand(dom))
      add(
        2,
        tr(
          `The sender's address "${dom}" uses the ${cap(subdomainBrand(dom))} name, but it belongs to another company (${baseDomain(dom)}).`,
          `La dirección "${dom}" usa el nombre ${cap(subdomainBrand(dom))}, pero pertenece a otra empresa (${baseDomain(dom)}).`
        ),
        "sender"
      );
    // A made-up "role" name like "Package_Tracking" or "Storage Warning" instead of a real store's name.
    const shownName = (msg.fromName || "").trim();
    if (GENERIC_NAME.test(shownName) && !knownSender(dom) && !Object.keys(BRANDS).some(b => legitFor(b, dom)))
      add(
        4,
        tr(
          `The sender calls itself "${shownName}" instead of a real store or company name. Real delivery and storage emails say who they're from.`,
          `El remitente se llama "${shownName}" en vez del nombre de una tienda o empresa real. Los correos reales de envíos y almacenamiento dicen quién los manda.`
        ),
        "toll"
      );
    const localPart = msg.fromEmail.split("@")[0] || "";
    if (localPart.length > 40 && (localPart.match(/\./g) || []).length >= 4)
      add(
        2,
        tr(
          `The sender's address is a long jumble ("${localPart.slice(0, 30)}…") that real companies don't use.`,
          `La dirección del remitente es una mezcla larga ("${localPart.slice(0, 30)}…") que las empresas reales no usan.`
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
    // A personal @outlook.com or @icloud.com address is anyone, not Microsoft or Apple.
    const legitBrand = !FREE_MAIL.test(dom) && Object.keys(BRANDS).some(b => legitFor(b, dom));
    // Senders the person marked as real ("This email is real") count like a known company.
    const mySenders = typeof S !== "undefined" ? S.get("mysenders", []) : [];
    const markedReal = mySenders.includes(baseDomain(dom));
    if ((legitBrand || markedReal) && /dmarc=pass|dkim=pass/.test(auth)) trusted = true;
    if (trusted) score = Math.max(0, score - 5);
    else if (msg.listUnsub && /dmarc=pass/.test(auth) && score < 8) score = Math.max(0, score - 2);
  }
  // A real sweepstakes from a signed company email (official rules, no purchase necessary) isn't a prize scam.
  if (
    types.prize &&
    !types.payment &&
    /dmarc=pass/i.test(msg.auth || "") &&
    /official rules|no purchase necessary|sweepstakes rules|terms apply/i.test(text)
  ) {
    score = Math.max(0, score - types.prize);
    const i = reasons.findIndex(r => /won something|ganó algo/.test(r));
    if (i >= 0) reasons.splice(i, 1);
    delete types.prize;
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
  let level = score >= 8 ? "scam" : score >= 4 ? "warn" : "safe";
  const freeMail = FREE_MAIL.test(((msg.fromEmail || "").split("@")[1] || "").toLowerCase());
  // A verified, well-known sender (Amazon, Spark, a bank, a university...) can't be flagged on words alone.
  const known =
    /dmarc=pass/i.test(msg.auth || "") && !freeMail ? knownSender((msg.fromEmail || "").split("@")[1]) : "";
  if (known && !hardEvidence({ reasons, evidence: {} }, msg.auth)) {
    score = Math.min(score, known === "company" ? 3 : 7);
    level = score >= 8 ? "scam" : score >= 4 ? "warn" : "safe";
  }
  return {
    score,
    reasons: [...new Set(reasons)],
    kind,
    kindKey,
    level,
    trusted,
    freeMail,
    knownSender: known
  };
}

/* ----- Evidence that's hard for scammers to fake -----
   history: how many earlier emails (2+ weeks old) came from this exact address.
   age:     how many days ago the sender's web address was registered (null = unknown).
   Real senders usually have both: a history with you, and an address that's years old. */
function applyEvidence(local, ev, auth) {
  const r = Object.assign({}, local, { reasons: local.reasons.slice(), evidence: ev || {} });
  if (!ev) return r;
  const signed = /dmarc=pass/i.test(auth || "");
  // Earlier mail from this address only fully counts when this email passed the sender check (DMARC).
  // Scammers can fake any "From" address, even your own, but they can't pass that check.
  const spoofable = !signed || /dmarc=(fail|none)/i.test(auth || "");
  if (ev.history > 0) {
    r.score = Math.max(0, r.score - (spoofable ? 2 : 6));
    if (!spoofable) r.known = true;
  }
  if (ev.age != null) {
    if (ev.age < 30) {
      r.score += 6;
      r.reasons.unshift(
        tr(
          `The sender's web address was created only ${ev.age} day${ev.age === 1 ? "" : "s"} ago. Scammers use brand-new addresses; real companies have had theirs for years.`,
          `La dirección web del remitente se creó hace solo ${ev.age} día${ev.age === 1 ? "" : "s"}. Los estafadores usan direcciones nuevas; las empresas reales las tienen desde hace años.`
        )
      );
    } else if (ev.age < 90) {
      r.score += 3;
      r.reasons.push(
        tr(
          `The sender's web address is new (${ev.age} days old).`,
          `La dirección web del remitente es nueva (${ev.age} días).`
        )
      );
    } else if (ev.age >= 365 && signed) r.score = Math.max(0, r.score - 3);
  }
  // A verified sender (signed mail, a company domain, and either years old, mail you've had before, or
  // sorted by Gmail into Promotions/Updates/Social) can't be flagged on words alone. Only hard proof
  // (a fake link, a brand-new website, a look-alike name...) can do that.
  const established =
    signed &&
    !spoofable &&
    !r.freeMail &&
    (ev.history > 0 || ev.category || (ev.age != null && ev.age >= 365));
  if (established && !hardEvidence(r, auth)) {
    r.verifiedSender = true;
    r.score = Math.min(r.score, ev.history > 0 || ev.category ? 3 : 7);
  }
  r.level = r.score >= 8 ? "scam" : r.score >= 4 ? "warn" : "safe";
  return r;
}

/* Proof strong enough to call something a scam without the AI agreeing. */
function hardEvidence(local, auth) {
  if (/dmarc=fail/i.test(auth || "") && local.reasons.some(x => /Says it's from|Dice ser de/.test(x)))
    return true;
  const ev = local.evidence || {};
  if (ev.age != null && ev.age < 30 && !local.known) return true;
  // Asking for gift cards is hard proof, unless it's a signed email from a long-standing company domain
  // (then the AI decides: stores sell their own gift cards).
  const giftAsk = local.reasons.some(x => /gift cards?\b.*never ask|tarjetas de regalo/i.test(x));
  const established =
    /dmarc=pass/i.test(auth || "") && !local.freeMail && (local.known || (ev.age != null && ev.age >= 365));
  if (giftAsk && !established) return true;
  return local.reasons.some(x =>
    /fake copy|copia falsa|free website-hosting|alojamiento web gratuito|temporary \(throwaway\)|correo temporal|personal .* address|cuenta personal|It looks like .* but it isn't|Parece .* pero no es/i.test(
      x
    )
  );
}

/* The final word: the AI decides when it's available; the rules alone only say "scam" with hard proof. */
function decideLevel(local, aiVerdict, auth) {
  const hard = hardEvidence(local, auth);
  if (aiVerdict) {
    let v = { safe: "safe", suspicious: "warn", scam: "scam" }[aiVerdict] || aiVerdict;
    if (v === "scam" && local.known && !hard) v = "warn"; // you've had real mail from them before
    if (v === "safe" && hard) v = "warn";
    return v;
  }
  if (local.level === "scam" && !hard) return "warn";
  return local.level;
}

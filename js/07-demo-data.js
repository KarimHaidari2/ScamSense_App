/*
 * ScamSense · Demo inbox
 * Made-up emails with sample AI answers, so the app can be tried without signing in.
 */
"use strict";

const DEMO = [
  {
    fromName: "PayPal Service",
    fromEmail: "service@paypa1-security.com",
    subject: "Your account has been limited",
    auth: "spf=softfail dkim=none dmarc=fail",
    text: "We noticed unusual sign-in activity on your PayPal account. Your account will be locked within 24 hours unless you verify your billing information.",
    links: [{ text: "www.paypal.com/verify", href: "https://paypa1-security.com/login" }],
    demoAI: {
      en: {
        verdict: "scam",
        scam_type: "Fake PayPal account lock",
        confidence: 98,
        explanation:
          "This email pretends to be PayPal, but it comes from paypa1-security.com, with a number 1 instead of the letter L. The link goes to a fake site built to steal your login and card details.",
        red_flags: [
          "Lookalike address paypa1-security.com",
          "Threatens to lock your account in 24 hours",
          "Link text shows paypal.com but goes somewhere else"
        ],
        what_to_do: [
          "Don't click the link.",
          "Open the PayPal app yourself to check your account.",
          "Report it in Gmail as phishing, then delete it."
        ]
      },
      es: {
        verdict: "scam",
        scam_type: "Bloqueo falso de PayPal",
        confidence: 98,
        explanation:
          "Este correo finge ser PayPal, pero viene de paypa1-security.com, con un número 1 en vez de la letra L. El enlace lleva a un sitio falso para robar su usuario y tarjeta.",
        red_flags: [
          "Dirección falsa paypa1-security.com",
          "Amenaza con bloquear su cuenta en 24 horas",
          "El enlace dice paypal.com pero va a otro lugar"
        ],
        what_to_do: [
          "No haga clic en el enlace.",
          "Abra usted la app de PayPal para revisar su cuenta.",
          "Denúncielo como phishing en Gmail y bórrelo."
        ]
      }
    }
  },
  {
    fromName: "Geek Squad Billing",
    fromEmail: "geeksquad.renewal2026@gmail.com",
    subject: "Invoice #GS-88412 auto-renewal $399.99",
    auth: "spf=pass dkim=pass dmarc=pass",
    text: "Your Geek Squad protection plan auto-renewed for $399.99. If you did not authorize this, call our refund department at 1-888-555-0199 within 24 hours to cancel.",
    links: [],
    attachments: ["Invoice_GS88412.html"],
    demoAI: {
      en: {
        verdict: "scam",
        scam_type: "Fake refund scam",
        confidence: 97,
        explanation:
          "Geek Squad doesn't send bills from a personal Gmail address. The goal is to scare you into calling, where they'll ask for remote access or gift cards to \"refund\" you.",
        red_flags: [
          "Sent from a free Gmail address",
          "Fake charge to make you call",
          "Risky .html attachment"
        ],
        what_to_do: [
          "Don't call the number or open the attachment.",
          "Check your bank or card statement yourself.",
          "Delete the email."
        ]
      },
      es: {
        verdict: "scam",
        scam_type: "Reembolso falso",
        confidence: 97,
        explanation:
          'Geek Squad no envía facturas desde un Gmail personal. Quieren asustarle para que llame; luego le pedirán acceso a su computadora o tarjetas de regalo para un "reembolso".',
        red_flags: [
          "Enviado desde un Gmail gratuito",
          "Cargo falso para que llame",
          "Adjunto .html peligroso"
        ],
        what_to_do: [
          "No llame ni abra el adjunto.",
          "Revise usted el estado de cuenta de su banco o tarjeta.",
          "Borre el correo."
        ]
      }
    }
  },
  {
    fromName: "USPS",
    fromEmail: "track@usps-redelivery.top",
    subject: "Package could not be delivered",
    auth: "spf=fail dkim=none dmarc=fail",
    text: "Your package could not be delivered due to an incomplete address. Update your address and pay a $1.99 redelivery fee today.",
    links: [{ text: "Update address", href: "https://usps-redelivery.top/track" }],
    demoAI: {
      en: {
        verdict: "scam",
        scam_type: "Fake delivery fee",
        confidence: 96,
        explanation:
          "USPS doesn't email asking for a redelivery fee, and its real website is usps.com. The small $1.99 fee is a trick to get your card number.",
        red_flags: ["Fake .top web address", "Failed sender checks", "Asks for a small fee to get your card"],
        what_to_do: ["Don't click or pay.", "Track packages only at usps.com.", "Delete the email."]
      },
      es: {
        verdict: "scam",
        scam_type: "Cargo de entrega falso",
        confidence: 96,
        explanation:
          "USPS no envía correos pidiendo un cargo por reenvío, y su sitio real es usps.com. El cargo de $1.99 es un truco para obtener su tarjeta.",
        red_flags: [
          "Dirección web falsa .top",
          "No pasó verificaciones",
          "Pide un cargo pequeño para robar su tarjeta"
        ],
        what_to_do: ["No haga clic ni pague.", "Rastree paquetes solo en usps.com.", "Borre el correo."]
      }
    }
  },
  {
    fromName: "Grandson Alex",
    fromEmail: "alex.help.now@outlook.com",
    subject: "Grandma please help",
    auth: "spf=pass dkim=pass dmarc=pass",
    text: "Grandma it's me, I lost my phone so this is my new email. I'm in trouble and need $1,500 for bail. Please don't tell Mom. Can you buy Target gift cards and send me the numbers?",
    links: [],
    demoAI: {
      en: {
        verdict: "scam",
        scam_type: "Grandparent scam",
        confidence: 99,
        explanation:
          'This is a classic grandparent scam: a "new" email, an emergency, a request for secrecy, and gift cards. Real bail is never paid with gift cards.',
        red_flags: [
          "Says it's a new email or number",
          "Asks you to keep it secret",
          "Wants gift card numbers"
        ],
        what_to_do: [
          "Call your grandson on the number you already have.",
          "Call his parents too.",
          "Don't buy gift cards or send numbers."
        ]
      },
      es: {
        verdict: "scam",
        scam_type: "Estafa del nieto",
        confidence: 99,
        explanation:
          'Es la típica estafa del nieto: un correo "nuevo", una emergencia, pedir secreto y tarjetas de regalo. Una fianza real nunca se paga con tarjetas de regalo.',
        red_flags: [
          "Dice que es un correo o número nuevo",
          "Pide que lo mantenga en secreto",
          "Quiere números de tarjetas de regalo"
        ],
        what_to_do: [
          "Llame a su nieto al número que ya tiene.",
          "Llame también a sus padres.",
          "No compre tarjetas de regalo."
        ]
      }
    }
  },
  {
    fromName: "Amazon.com",
    fromEmail: "shipment-tracking@amazon.com",
    subject: "Your package was delivered",
    auth: "spf=pass dkim=pass dmarc=pass",
    listUnsub: true,
    text: "Your package with Bounty Paper Towels was delivered to your front door. Track your package in Your Orders.",
    links: [{ text: "Your Orders", href: "https://www.amazon.com/gp/your-account/order-history" }]
  },
  {
    fromName: "Saint Francis Health",
    fromEmail: "reminders@saintfrancis.com",
    subject: "Appointment reminder: Tuesday 9:30 AM",
    auth: "spf=pass dkim=pass dmarc=pass",
    text: "This is a reminder of your appointment with Dr. Patel on Tuesday at 9:30 AM. Please arrive 15 minutes early.",
    links: []
  },
  {
    fromName: "Chase",
    fromEmail: "no.reply.alerts@chase.com",
    subject: "Your monthly statement is ready",
    auth: "spf=pass dkim=pass dmarc=pass",
    listUnsub: true,
    text: "Your statement for your account ending in 4421 is ready. Sign in to chase.com or the Chase Mobile app to view it.",
    links: [{ text: "chase.com", href: "https://www.chase.com/" }]
  }
];
const deepXl = o =>
  typeof o === "string"
    ? xl(o)
    : Array.isArray(o)
      ? o.map(deepXl)
      : o && typeof o === "object"
        ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, k === "verdict" ? v : deepXl(v)]))
        : o;
const pickDemoAI = d => d && (d[uiLang()] || (uiLang() === "en" ? d.en : deepXl(d.en)));
async function loadDemo() {
  const now = Date.now();
  const items = DEMO.map((d, i) => {
    const it = Object.assign(
      {
        id: "demo" + i,
        channel: "email",
        source: "demo",
        folder: i < 2 ? "Inbox" : i === 2 ? "Spam" : i === 3 ? "Inbox" : i === 4 ? "Updates" : "Inbox",
        replyTo: "",
        attachments: [],
        links: [],
        listUnsub: false,
        date: now - i * 3600e3 * 2
      },
      JSON.parse(JSON.stringify(d))
    );
    delete it.demoAI;
    it._demoAI = d.demoAI;
    return it;
  });
  items.forEach(it => it.links.forEach(l => (l.host = hostOf(l.href))));
  renderToday({ progress: { label: t("prog_demo"), pct: 40 } });
  await finishScan(items, "demo");
}
const SAMPLES = {
  toll: {
    mode: "text",
    num: "+1 (469) 555-0137",
    text: "TxTag: You have an unpaid toll of $4.85. To avoid a $50 late fee and suspension of your driver's license, pay within 24 hours: https://txtag-tollpay.xyz/pay",
    ai: {
      en: {
        verdict: "scam",
        scam_type: "Fake toll text",
        confidence: 97,
        explanation:
          "Toll agencies don't text links to pay small fees with threats about your license. The link goes to txtag-tollpay.xyz, which is not the real TxTag site.",
        red_flags: ["Fake .xyz web address", "Threatens your driver's license", "24-hour deadline"],
        what_to_do: [
          "Don't tap the link.",
          "Forward the text to 7726, then delete it.",
          "Check your toll account on the official website."
        ]
      },
      es: {
        verdict: "scam",
        scam_type: "Texto de peaje falso",
        confidence: 97,
        explanation:
          "Las agencias de peaje no envían enlaces por texto con amenazas sobre su licencia. El enlace va a txtag-tollpay.xyz, que no es el sitio real de TxTag.",
        red_flags: ["Dirección falsa .xyz", "Amenaza su licencia de conducir", "Plazo de 24 horas"],
        what_to_do: [
          "No toque el enlace.",
          "Reenvíe el texto al 7726 y bórrelo.",
          "Revise su cuenta de peaje en el sitio oficial."
        ]
      }
    }
  },
  irs: {
    mode: "call",
    num: "+1 (202) 555-0148",
    text: "A man said he was from the IRS and I owe back taxes. He said police would arrest me today unless I pay with Apple gift cards.",
    ai: {
      en: {
        verdict: "scam",
        scam_type: "IRS impostor call",
        confidence: 99,
        explanation:
          "The IRS never calls to demand immediate payment, never threatens arrest, and never takes gift cards. This is an impostor trying to scare you.",
        red_flags: ["Threat of arrest today", "Payment by gift cards", "Unexpected call about taxes"],
        what_to_do: [
          "Hang up.",
          "Don't buy gift cards or share card numbers.",
          "Report it at ReportFraud.ftc.gov."
        ]
      },
      es: {
        verdict: "scam",
        scam_type: "Falso IRS por teléfono",
        confidence: 99,
        explanation:
          "El IRS nunca llama para exigir un pago inmediato, nunca amenaza con arresto y nunca acepta tarjetas de regalo. Es un impostor que quiere asustarle.",
        red_flags: [
          "Amenaza de arresto hoy",
          "Pago con tarjetas de regalo",
          "Llamada inesperada sobre impuestos"
        ],
        what_to_do: ["Cuelgue.", "No compre tarjetas de regalo.", "Repórtelo en ReportFraud.ftc.gov."]
      }
    }
  },
  grand: {
    mode: "text",
    num: "+1 (918) 555-0190",
    text: "Grandma it's me, this is my new number. I got in a car accident and I need $2,000 for bail right away. Please don't tell Mom and Dad.",
    ai: {
      en: {
        verdict: "scam",
        scam_type: "Grandparent scam",
        confidence: 98,
        explanation:
          "A new number, an emergency, and a request to keep it secret are the signs of a grandparent scam. Call your grandchild on the number you already have before doing anything.",
        red_flags: ['"New number"', "Urgent money for bail", "Asks you not to tell family"],
        what_to_do: [
          "Call your grandchild on their usual number.",
          "Call their parents.",
          "Don't send money."
        ]
      },
      es: {
        verdict: "scam",
        scam_type: "Estafa del nieto",
        confidence: 98,
        explanation:
          "Un número nuevo, una emergencia y pedir secreto son señales de la estafa del nieto. Llame a su nieto al número que ya tiene antes de hacer nada.",
        red_flags: ['"Número nuevo"', "Dinero urgente para fianza", "Pide no decirle a la familia"],
        what_to_do: ["Llame a su nieto a su número de siempre.", "Llame a sus padres.", "No envíe dinero."]
      }
    }
  }
};

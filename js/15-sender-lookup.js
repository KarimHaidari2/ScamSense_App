/*
 * ScamSense · Sender lookup
 * Who is really behind an email address or phone number: fake, throwaway, international, reported.
 */
"use strict";

let DISPOSABLE = null,
  DISPOSABLE_WILD = null,
  disposableLoading = null;
function loadDisposable() {
  if (DISPOSABLE) return Promise.resolve();
  if (!disposableLoading)
    disposableLoading = Promise.all([
      fetch("vendor/disposable-domains.txt").then(r => r.text()),
      fetch("vendor/disposable-wildcard.txt").then(r => r.text())
    ])
      .then(([a, b]) => {
        DISPOSABLE = new Set(
          a
            .split("\n")
            .map(x => x.trim())
            .filter(Boolean)
        );
        DISPOSABLE_WILD = b
          .split("\n")
          .map(x => x.trim())
          .filter(Boolean);
      })
      .catch(() => {
        DISPOSABLE = new Set();
        DISPOSABLE_WILD = [];
      });
  return disposableLoading;
}
function isDisposable(dom) {
  if (!DISPOSABLE || !dom) return false;
  dom = dom.toLowerCase();
  if (DISPOSABLE.has(dom)) return true;
  const parts = dom.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    if (DISPOSABLE.has(parts.slice(i).join("."))) return true;
  }
  return DISPOSABLE_WILD.some(w => dom === w || dom.endsWith("." + w));
}
async function emailInfo(raw) {
  const addr = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^.*</, "")
    .replace(/>.*$/, "");
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(addr))
    return {
      level: "warn",
      title: tr("This isn't a complete email address.", "Esta no es una dirección de correo completa."),
      lines: []
    };
  const dom = addr.split("@")[1];
  await loadDisposable();
  if (isDisposable(dom))
    return {
      level: "scam",
      title: tr("Temporary (throwaway) email address", "Correo temporal (desechable)"),
      lines: [
        tr(
          `${dom} is a temporary email service. Anyone can make an address there in seconds, with no name and no account.`,
          `${dom} es un servicio de correo temporal. Cualquiera crea una dirección ahí en segundos, sin nombre ni cuenta.`
        ),
        tr(
          "Real companies, banks, and government agencies never use these. Treat it as fake.",
          "Las empresas, bancos y agencias reales nunca los usan. Trátelo como falso."
        )
      ]
    };
  const lb = lookalikeBrand(dom);
  if (lb)
    return {
      level: "scam",
      title: tr(`Fake ${cap(lb)} address`, `Dirección falsa de ${cap(lb)}`),
      lines: [
        tr(
          `"${dom}" is made to look like ${cap(lb)}, but it isn't ${cap(lb)}'s real address.`,
          `"${dom}" imita a ${cap(lb)}, pero no es su dirección real.`
        )
      ]
    };
  const brand = Object.keys(BRANDS).find(b => legitFor(b, dom));
  if (brand)
    return {
      level: "safe",
      title: tr(`Real ${cap(brand)} address`, `Dirección real de ${cap(brand)}`),
      lines: [
        tr(
          `${dom} belongs to ${cap(brand)}. The name on an email can still be faked, so check the message too.`,
          `${dom} pertenece a ${cap(brand)}. El nombre se puede falsificar, así que revise también el mensaje.`
        )
      ]
    };
  if (FREE_MAIL.test(dom))
    return {
      level: "info",
      title: tr("Personal email account", "Cuenta de correo personal"),
      lines: [
        tr(
          `${dom} is a free personal email service. That's normal for people you know, but companies, banks, and agencies don't send from these.`,
          `${dom} es un servicio gratuito de correo personal. Es normal en personas que conoce, pero empresas, bancos y agencias no escriben desde ahí.`
        )
      ]
    };
  return {
    level: "info",
    title: tr("Company or private address", "Dirección de empresa o privada"),
    lines: [
      tr(
        `ScamSense can't confirm who owns ${dom} yet. If it says it's a company you know, check that company's real website address.`,
        `ScamSense aún no puede confirmar quién es dueño de ${dom}. Si dice ser una empresa conocida, compare con su sitio web real.`
      )
    ]
  };
}
const CARIBBEAN = {
  242: "the Bahamas",
  246: "Barbados",
  264: "Anguilla",
  268: "Antigua and Barbuda",
  284: "the British Virgin Islands",
  345: "the Cayman Islands",
  441: "Bermuda",
  473: "Grenada",
  649: "Turks and Caicos",
  658: "Jamaica",
  876: "Jamaica",
  664: "Montserrat",
  721: "Sint Maarten",
  758: "Saint Lucia",
  767: "Dominica",
  784: "Saint Vincent",
  809: "the Dominican Republic",
  829: "the Dominican Republic",
  849: "the Dominican Republic",
  868: "Trinidad and Tobago",
  869: "Saint Kitts and Nevis"
};
const COUNTRIES = {
  44: "the United Kingdom",
  91: "India",
  234: "Nigeria",
  233: "Ghana",
  232: "Sierra Leone",
  63: "the Philippines",
  52: "Mexico",
  92: "Pakistan",
  880: "Bangladesh",
  7: "Russia",
  86: "China",
  62: "Indonesia",
  225: "Côte d'Ivoire",
  216: "Tunisia",
  254: "Kenya",
  27: "South Africa",
  93: "Afghanistan",
  98: "Iran",
  20: "Egypt",
  90: "Turkey",
  971: "the United Arab Emirates",
  966: "Saudi Arabia",
  84: "Vietnam",
  82: "South Korea",
  81: "Japan",
  49: "Germany",
  33: "France",
  34: "Spain",
  39: "Italy",
  55: "Brazil",
  57: "Colombia",
  58: "Venezuela",
  51: "Peru",
  53: "Cuba",
  509: "Haiti",
  370: "Lithuania",
  371: "Latvia",
  373: "Moldova",
  381: "Serbia",
  40: "Romania",
  48: "Poland",
  380: "Ukraine"
};
/* Sample community reports for this prototype (fictional 555 numbers). Real reports come from the ScamSense server later. */
const REPORTED = {
  8005550144: 132,
  2025550161: 418,
  4695550137: 57,
  4695550182: 88,
  2135550199: 64,
  8885550199: 41
};
function numberInfo(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  let d = s.replace(/[^\d+]/g, "");
  if (d.startsWith("+") && !d.startsWith("+1")) {
    const n = d.slice(1);
    const code = ["3", "2", "1"].map(l => n.slice(0, +l)).find(c => COUNTRIES[c]);
    return {
      level: "warn",
      title: code
        ? tr(`International number from ${COUNTRIES[code]}`, `Número internacional de ${COUNTRIES[code]}`)
        : tr("International number", "Número internacional"),
      lines: [
        tr(
          "If you don't know anyone there, don't call back, don't press any buttons, and don't send money.",
          "Si no conoce a nadie ahí, no devuelva la llamada, no marque nada y no envíe dinero."
        )
      ]
    };
  }
  d = d.replace(/^\+?1/, "").replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") d = d.slice(1);
  if (d.length !== 10)
    return {
      level: "warn",
      title: tr("Not a complete US phone number", "No es un número de EE. UU. completo"),
      lines: [
        tr(
          "US numbers have 10 digits. Short or odd numbers can be texts from companies, or faked caller ID.",
          "Los números de EE. UU. tienen 10 dígitos. Los cortos o raros pueden ser de empresas o identificadores falsos."
        )
      ]
    };
  const a = d.slice(0, 3),
    e = d.slice(3, 6),
    l = d.slice(6),
    pretty = `(${a}) ${e}-${l}`;
  const out = { number: pretty, lines: [] };
  const rep = REPORTED[d];
  if (/^[01]/.test(a) || /^[01]/.test(e))
    return {
      number: pretty,
      level: "scam",
      title: tr("Fake number format", "Formato de número falso"),
      lines: [
        tr(
          `${pretty} can't exist. The caller ID was faked (spoofed).`,
          `${pretty} no puede existir. El identificador fue falsificado.`
        )
      ]
    };
  if (rep) {
    out.level = "scam";
    out.title = tr(`Reported ${rep} times as a scam`, `Reportado ${rep} veces como estafa`);
    out.lines.push(
      tr(
        "People reported this number for scam calls or texts. Don't answer, call back, or reply.",
        "La gente reportó este número por llamadas o textos de estafa. No conteste, no devuelva la llamada ni responda."
      )
    );
    out.sample = true;
  }
  if (CARIBBEAN[a]) {
    out.level = "scam";
    out.title =
      out.title || tr(`International call to ${CARIBBEAN[a]}`, `Llamada internacional a ${CARIBBEAN[a]}`);
    out.lines.push(
      tr(
        `Area code ${a} looks like a US number, but it's ${CARIBBEAN[a]}. Calling back can cost a lot of money. This is common in "one-ring" scams.`,
        `El código ${a} parece de EE. UU., pero es ${CARIBBEAN[a]}. Devolver la llamada puede costar mucho dinero. Es común en estafas de "un timbre".`
      )
    );
  }
  if (e === "555" && +l >= 100 && +l <= 199 && !rep) {
    out.level = out.level || "info";
    out.title = out.title || tr("Example number", "Número de ejemplo");
    out.lines.push(
      tr(
        "555-01xx numbers are reserved for movies and examples. A real call from one means caller ID was faked.",
        "Los números 555-01xx son para películas y ejemplos. Una llamada real desde uno significa identificador falso."
      )
    );
  }
  if (/^8(00|33|44|55|66|77|88)$/.test(a)) {
    out.level = out.level || "info";
    out.title = out.title || tr("Toll-free number", "Número gratuito");
    out.lines.push(
      tr(
        "Real companies use toll-free numbers, but scammers rent them cheaply too. Make sure it matches the number on your card, bill, or the official website.",
        "Las empresas reales los usan, pero los estafadores también los rentan barato. Compare con el número de su tarjeta, factura o sitio oficial."
      )
    );
  }
  if (!out.title) {
    out.level = "info";
    out.title = tr(`US number, area code ${a}`, `Número de EE. UU., código ${a}`);
    out.lines.push(
      tr(
        "No scam reports found for this number. Caller ID can still be faked, so judge what they ask you to do.",
        "No hay reportes de estafa. El identificador se puede falsificar, así que fíjese en lo que le piden."
      )
    );
  }
  return out;
}
function intelHTML(info, kind) {
  if (!info) return "";
  const icon = { scam: "alert", warn: "alert", safe: "check", info: "info" }[info.level] || "info";
  const label =
    kind === "email"
      ? tr("About the sender", "Sobre el remitente")
      : tr("About this number", "Sobre este número");
  return `<div class="intel lv-${info.level}"><div class="intel-h">${ic(icon)}<span>${label}${info.number ? ` · <span class="mono">${esc(info.number)}</span>` : ""}</span></div>
    <p class="intel-t">${esc(info.title)}</p>${info.lines.length ? `<ul>${info.lines.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    ${kind === "phone" ? `<p class="intel-foot">${info.sample ? tr("Reports shown are sample data in this prototype. ", "Los reportes son datos de ejemplo en este prototipo. ") : ""}${tr("Coming with the ScamSense server: checking if a number is an internet or free-app number (often used for fake numbers).", "Próximamente con el servidor: saber si un número es de internet o de una app gratuita (muy usados para números falsos).")}</p>` : ""}</div>`;
}

/*
 * ScamSense · Storage and languages
 * Saves settings on this device (localStorage) and loads translation files from the i18n folder.
 */
"use strict";

const S = {
  get(k, d) {
    try {
      const v = localStorage.getItem("ss_" + k);
      return v === null ? d : JSON.parse(v);
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem("ss_" + k, JSON.stringify(v));
    } catch (e) {}
  },
  del(k) {
    try {
      localStorage.removeItem("ss_" + k);
    } catch (e) {}
  }
};
const SS = {
  get(k) {
    try {
      return sessionStorage.getItem("ss_" + k) || "";
    } catch (e) {
      return "";
    }
  },
  set(k, v) {
    try {
      v ? sessionStorage.setItem("ss_" + k, v) : sessionStorage.removeItem("ss_" + k);
    } catch (e) {}
  }
};
/* Mahi server: a Google Apps Script web app that holds the AI key (see mahi-server/README.md).
   Paste its URL here so Mahi answers any question for everyone, with no key in the app. */
const DEFAULT_MAHI_URL = "";
const DEFAULT_CLIENT_ID = "848599932394-4vcu5c7lgkdbmlculansl4ae6u76k0ug.apps.googleusercontent.com";
const cfg = () => {
  const c = Object.assign(
    {
      clientId: "",
      apiKey: "",
      model: "claude-haiku-5-5",
      aiMode: "risky",
      days: 1,
      max: 50,
      rememberKey: true,
      lang: "en"
    },
    S.get("cfg", {})
  );
  if (!c.clientId) c.clientId = DEFAULT_CLIENT_ID;
  if (!c.mahiUrl) c.mahiUrl = DEFAULT_MAHI_URL;
  if (!c.rememberKey) c.apiKey = SS.get("key");
  return c;
};
const LANGS = {
  en: { name: "English", speech: "en-US", ai: "English" },
  es: { name: "Español", speech: "es-US", ai: "Spanish" },
  zh: { name: "中文", speech: "zh-CN", ai: "Simplified Chinese" },
  tl: { name: "Tagalog", speech: "fil-PH", ai: "Tagalog" },
  vi: { name: "Tiếng Việt", speech: "vi-VN", ai: "Vietnamese" },
  ar: { name: "العربية", speech: "ar-SA", ai: "Arabic", rtl: true },
  fr: { name: "Français", speech: "fr-FR", ai: "French" },
  ko: { name: "한국어", speech: "ko-KR", ai: "Korean" },
  ru: { name: "Русский", speech: "ru-RU", ai: "Russian" },
  ht: { name: "Kreyòl", speech: "fr-HT", ai: "Haitian Creole" },
  pt: { name: "Português", speech: "pt-BR", ai: "Brazilian Portuguese" },
  fa: { name: "فارسی", speech: "fa-IR", ai: "Persian (Farsi)", rtl: true }
};
/* Light or dark look, chosen in Settings → Appearance. "auto" follows the phone or computer setting. */
function applyTheme() {
  const t = cfg().theme;
  const root = document.documentElement;
  if (t === "light" || t === "dark") root.dataset.theme = t;
  else delete root.dataset.theme;
  const dark = t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? "#0B1F23" : "#0E7C7B";
}
applyTheme();
try {
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
} catch (e) {}
const langCode = () => (LANGS[cfg().lang] ? cfg().lang : "en");
const uiLang = () => langCode();
/* Translations for languages other than English and Spanish live in i18n/<lang>.json (loaded on demand).
   Text with changing parts is matched with patterns, so it's translated too. Documents for US offices stay in English. */
let DICT = { lang: "", exact: new Map(), pats: [] };
async function loadDict() {
  const L = langCode();
  if (L === "en" || L === "es") {
    DICT = { lang: L, exact: new Map(), pats: [] };
    return;
  }
  if (DICT.lang === L) return;
  try {
    const [en, tx] = await Promise.all([
      fetch("i18n/en.json").then(r => r.json()),
      fetch(`i18n/${L}.json`).then(r => r.json())
    ]);
    const exact = new Map(),
      pats = [];
    for (const id in en) {
      const src = en[id],
        dst = tx[id];
      if (!dst) continue;
      if (/\{\d+\}/.test(src)) {
        const parts = src.split(/\{(\d+)\}/);
        let re = "^",
          order = [];
        parts.forEach((p, i) => {
          if (i % 2) order.push(+p), (re += "([\\s\\S]*?)");
          else re += p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        });
        pats.push({ re: new RegExp(re + "$"), order, dst });
      } else exact.set(src, dst);
    }
    DICT = { lang: L, exact, pats };
  } catch (e) {
    DICT = { lang: L, exact: new Map(), pats: [] };
  }
}
function xl(en) {
  if (en == null) return en;
  const L = langCode();
  if (L === "en" || L === "es" || DICT.lang !== L) return en;
  const hit = DICT.exact.get(en);
  if (hit) return hit;
  for (const p of DICT.pats) {
    const m = en.match(p.re);
    if (m) {
      let out = p.dst;
      p.order.forEach((n, i) => {
        out = out.split("{" + n + "}").join(xl(m[i + 1]));
      });
      return out;
    }
  }
  return en;
}
const tr = (en, es) => {
  const L = langCode();
  return L === "es" && es ? es : L === "en" ? en : xl(en);
};
function saveCfg(c) {
  const keep = Object.assign({}, c);
  if (!c.rememberKey) {
    SS.set("key", c.apiKey);
    keep.apiKey = "";
  } else SS.set("key", "");
  S.set("cfg", keep);
}
/* Reports keep only the verdicts and reasons, never the email text, and are deleted after 7 days. */
const REPORT_DAYS = 7;
function slimItem(it) {
  return {
    id: it.id,
    source: it.source,
    channel: it.channel,
    folder: it.folder,
    inSpam: it.inSpam,
    fromName: it.fromName,
    fromEmail: it.fromEmail,
    subject: it.subject,
    date: it.date,
    level: it.level,
    attachments: it.attachments,
    link: it.link,
    local: it.local,
    ai: it.ai,
    aiError: it.aiError
  };
}
(function expireOld() {
  const r = S.get("report", null);
  if (r && Date.now() - r.at > REPORT_DAYS * 864e5) S.del("report");
  try {
    localStorage.removeItem("ss_draft");
  } catch (e) {}
})();

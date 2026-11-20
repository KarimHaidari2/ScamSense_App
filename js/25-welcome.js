/*
 * ScamSense · Welcome
 * The first screen: sign in with Google (Gmail) or Microsoft (Outlook, Hotmail).
 * Signing in confirms who you are and lets ScamSense check your email. A small box at the top
 * changes the language. "Try the demo first" shows made-up emails, with no sign-in.
 */
"use strict";

const OWL_WELCOME = `<svg viewBox="0 0 120 130" aria-hidden="true"><polygon points="22,34 28,4 48,22" fill="#F5F5F2"/><polygon points="98,34 92,4 72,22" fill="#F5F5F2"/><rect x="20" y="14" width="80" height="108" rx="40" fill="#F5F5F2"/><path d="M30,70 C30,96 44,112 60,116 C76,112 90,96 90,70 Z" fill="#DADDE5"/><circle cx="45" cy="52" r="16" fill="#14213D"/><circle cx="75" cy="52" r="16" fill="#14213D"/><circle cx="45" cy="52" r="8.5" fill="#E0A93B"/><circle cx="75" cy="52" r="8.5" fill="#E0A93B"/><circle cx="45" cy="52" r="3.8" fill="#14213D"/><circle cx="75" cy="52" r="3.8" fill="#14213D"/><polygon points="54,70 66,70 60,82" fill="#E0A93B"/><polyline points="46,96 56,106 76,86" fill="none" stroke="#14213D" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function showOnboarding() {
  if (S.get("onboarded", false) || document.querySelector(".onb")) return;
  const m = document.createElement("div");
  m.className = "onb onb-gate";
  document.body.appendChild(m);
  const draw = () => {
    m.innerHTML = `<div class="gate-box" role="dialog" aria-modal="true" aria-labelledby="gate-h">
      <section class="gate-hero">
        <div class="gate-top"><span class="gate-brand">ScamSense</span>
          <label class="gate-lang">${ic("globe")}<span class="sr">${tr("Language", "Idioma")}</span>
            <select id="onb-lang">${Object.entries(LANGS)
              .map(
                ([k, v]) => `<option value="${k}" ${langCode() === k ? "selected" : ""}>${v.name}</option>`
              )
              .join("")}</select></label></div>
        <div class="gate-owl">${OWL_WELCOME}</div>
        <h1 id="gate-h">${tr("Welcome to ScamSense", "Bienvenido a ScamSense")}</h1>
        <p>${tr("Sign in so ScamSense can watch your email for scams and keep your account safe.", "Inicie sesión para que ScamSense vigile su correo y proteja su cuenta.")}</p>
      </section>
      <section class="gate-body">
        <button class="gate-btn" id="ob-google"><span class="gate-logo g" aria-hidden="true">G</span><span>${tr("Continue with Google", "Continuar con Google")}</span></button>
        <button class="gate-btn" id="ob-ms"><span class="gate-logo ms" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>${tr("Continue with Outlook", "Continuar con Outlook")}</span></button>
        <p class="gate-note">${ic("lock")}<span>${tr("Google or Microsoft confirm it's you. ScamSense never sees your password and never sells your information.", "Google o Microsoft confirman que es usted. ScamSense nunca ve su contraseña ni vende su información.")}</span></p>
        <button class="gate-demo" id="ob-demo">${tr("Try the demo first", "Probar la demostración primero")}</button>
        <p class="gate-fine">${tr("By continuing, you confirm you're 13 or older and agree to the", "Al continuar, confirma que tiene 13 años o más y acepta los")} <a href="terms.html" target="_blank" rel="noopener">${tr("Terms", "Términos")}</a> ${tr("and", "y la")} <a href="privacy.html" target="_blank" rel="noopener">${tr("Privacy Policy", "Política de privacidad")}</a>.</p>
      </section>
    </div>`;
    const done = () => {
      S.set("onboarded", true);
      m.remove();
      go("today");
    };
    m.querySelector("#onb-lang").onchange = async e => {
      saveCfg(Object.assign(cfg(), { lang: e.target.value }));
      await loadDict();
      applyLang();
      draw();
      m.querySelector("#onb-lang").focus();
    };
    m.querySelector("#ob-google").onclick = () => {
      done();
      scanEmail();
    };
    m.querySelector("#ob-ms").onclick = () => {
      S.set("onboarded", true); // Microsoft's page opens next, then brings them back here
      connectOutlook();
    };
    m.querySelector("#ob-demo").onclick = () => {
      done();
      loadDemo();
    };
  };
  draw();
}

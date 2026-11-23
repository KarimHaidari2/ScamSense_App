/*
 * ScamSense · Welcome and sign-in
 * The first screen: "Create an account" or "I already have an account".
 * - Continue with Google or Outlook: one tap, no password (Google or Microsoft confirm who you are).
 * - Or with an email: a 6-digit code goes to that email, then a password
 *   (at least 10 characters, one capital letter, one number).
 * - Signing in with a password also sends a code to the email, so a stolen password alone isn't enough.
 * - "Keep me signed in" keeps this device signed in for 60 days, then it asks again.
 * - "Forgot password": a code by email, then a new password.
 * A small box at the top changes the language. "Try the demo first" shows made-up emails, no sign-in.
 */
"use strict";

const OWL_WELCOME = `<svg viewBox="0 0 120 130" aria-hidden="true"><polygon points="22,34 28,4 48,22" fill="#F5F5F2"/><polygon points="98,34 92,4 72,22" fill="#F5F5F2"/><rect x="20" y="14" width="80" height="108" rx="40" fill="#F5F5F2"/><path d="M30,70 C30,96 44,112 60,116 C76,112 90,96 90,70 Z" fill="#DADDE5"/><circle cx="45" cy="52" r="16" fill="#14213D"/><circle cx="75" cy="52" r="16" fill="#14213D"/><circle cx="45" cy="52" r="8.5" fill="#E0A93B"/><circle cx="75" cy="52" r="8.5" fill="#E0A93B"/><circle cx="45" cy="52" r="3.8" fill="#14213D"/><circle cx="75" cy="52" r="3.8" fill="#14213D"/><polygon points="54,70 66,70 60,82" fill="#E0A93B"/><polyline points="46,96 56,106 76,86" fill="none" stroke="#14213D" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* What this device is called in "New sign-in" emails. */
function deviceLabel() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "an iPhone";
  if (/iPad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1))
    return "an iPad";
  if (/Android/.test(ua)) return "an Android phone";
  if (/Windows/.test(ua)) return "a Windows computer";
  if (/Mac/.test(ua)) return "a Mac";
  return "a device";
}
/* The password rules, shown as a checklist while typing. */
const PW_RULES = () => [
  [p => p.length >= 10, tr("At least 10 characters", "Al menos 10 caracteres")],
  [p => /[A-Z]/.test(p), tr("At least one capital letter (A–Z)", "Al menos una letra mayúscula (A–Z)")],
  [p => /[0-9]/.test(p), tr("At least one number (0–9)", "Al menos un número (0–9)")]
];

/* step: home | create | create_code | signin | signin_code | forgot | forgot_code */
function showOnboarding(step, note) {
  if (S.get("onboarded", false) && !step) return;
  let m = document.querySelector(".onb-gate:not(.onb-about)");
  if (!m) {
    m = document.createElement("div");
    m.className = "onb onb-gate";
    document.body.appendChild(m);
  }
  const st = {
    step: step || "home",
    email: "",
    pw: "",
    keep: true,
    note: note || (typeof signoutNote === "function" ? signoutNote() : ""),
    busy: false
  };

  const hero = (title, sub) => `<section class="gate-hero">
        <div class="gate-top"><span class="gate-brand">ScamSense</span>
          <label class="gate-lang">${ic("globe")}<span class="sr">${tr("Language", "Idioma")}</span>
            <select id="onb-lang">${Object.entries(LANGS)
              .map(
                ([k, v]) => `<option value="${k}" ${langCode() === k ? "selected" : ""}>${v.name}</option>`
              )
              .join("")}</select></label></div>
        ${st.step === "home" ? `<div class="gate-owl">${OWL_WELCOME}</div>` : ""}
        <h1 id="gate-h">${title}</h1>
        ${sub ? `<p>${sub}</p>` : ""}
      </section>`;
  const sso = () => `
        <button class="gate-btn" id="ob-google"><span class="gate-logo g" aria-hidden="true">G</span><span>${tr("Continue with Google", "Continuar con Google")}</span></button>
        <button class="gate-btn" id="ob-ms"><span class="gate-logo ms" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>${tr("Continue with Outlook", "Continuar con Outlook")}</span></button>
        <p class="gate-or"><span>${tr("or use your email", "o use su correo")}</span></p>`;
  const field = (id, label, type, extra) =>
    `<label class="gate-field">${label}<input id="${id}" type="${type}" ${extra || ""}></label>`;
  const pwField = (id, label, auto) =>
    `<label class="gate-field">${label}<span class="pwwrap"><input id="${id}" type="password" autocomplete="${auto}" maxlength="128"><button type="button" class="pwshow" data-for="${id}" aria-pressed="false">${tr("Show", "Mostrar")}</button></span></label>`;
  const rules = () =>
    `<ul class="pwrules" id="pwrules">${PW_RULES()
      .map(([, t]) => `<li>${esc(t)}</li>`)
      .join("")}</ul>`;
  const keepBox = () =>
    `<label class="gate-check"><input type="checkbox" id="ob-keep" ${st.keep ? "checked" : ""}> ${tr("Keep me signed in for 60 days", "Mantener mi sesión abierta 60 días")}</label>`;
  const codeField = () =>
    field(
      "ob-code",
      tr("6-digit code", "Código de 6 dígitos"),
      "text",
      'inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" class="codein"'
    );
  const err = () => `<p class="gate-err" id="ob-err" role="alert">${esc(st.note)}</p>`;
  const back = `<button class="gate-back" id="ob-back">‹ ${tr("Back", "Atrás")}</button>`;
  const fine = `<p class="gate-fine">${tr("By continuing, you confirm you're 13 or older and agree to the", "Al continuar, confirma que tiene 13 años o más y acepta los")} <a href="terms.html" target="_blank" rel="noopener">${tr("Terms", "Términos")}</a> ${tr("and", "y la")} <a href="privacy.html" target="_blank" rel="noopener">${tr("Privacy Policy", "Política de privacidad")}</a>.</p>`;

  const screens = {
    home: () =>
      hero(
        tr("Welcome to ScamSense", "Bienvenido a ScamSense"),
        tr(
          "ScamSense watches your email for scams and helps you stay safe.",
          "ScamSense vigila su correo y le ayuda a estar seguro."
        )
      ) +
      `<section class="gate-body">${err()}
        <button class="gate-btn primary-btn" id="ob-create">${tr("Create an account", "Crear una cuenta")}</button>
        <button class="gate-btn" id="ob-signin">${tr("I already have an account", "Ya tengo una cuenta")}</button>
        <p class="gate-note">${ic("lock")}<span>${tr("ScamSense never sells your information and will never ask for your password by phone or text.", "ScamSense nunca vende su información y nunca le pedirá su contraseña por teléfono o texto.")}</span></p>
        <button class="gate-demo" id="ob-demo">${tr("Try the demo first", "Probar la demostración primero")}</button>
        ${fine}</section>`,
    create: () =>
      hero(tr("Create your account", "Cree su cuenta"), "") +
      `<section class="gate-body">${back}${sso()}${err()}
        <form id="ob-form" novalidate>
          ${field("ob-email", tr("Your email", "Su correo"), "email", 'autocomplete="email" inputmode="email" maxlength="100"')}
          <button class="gate-btn primary-btn" type="submit">${tr("Send me a code", "Envíenme un código")}</button>
        </form>
        <p class="gate-swap">${tr("Already have an account?", "¿Ya tiene una cuenta?")} <button class="linkbtn" id="ob-to-signin">${tr("Sign in", "Iniciar sesión")}</button></p>
        ${fine}</section>`,
    create_code: () =>
      hero(
        tr("Verify your email", "Verifique su correo"),
        tr(
          `We sent a 6-digit code to <b>${esc(st.email)}</b>. Type it here.`,
          `Enviamos un código de 6 dígitos a <b>${esc(st.email)}</b>. Escríbalo aquí.`
        )
      ) +
      `<section class="gate-body">${back}${err()}
        <form id="ob-form" novalidate>
          ${codeField()}
          <button class="gate-btn primary-btn" type="submit">${tr("Verify my email", "Verificar mi correo")}</button>
        </form>
        <p class="small muted">${tr("Can't find it? Check your Spam or Junk folder.", "¿No lo encuentra? Revise su carpeta de Spam o correo no deseado.")}</p>
        <button class="gate-demo" id="ob-resend">${tr("Send a new code", "Enviar un código nuevo")}</button></section>`,
    // Step 3: the email is verified; now the password.
    create_pw: () =>
      hero(
        tr("Create a password", "Cree una contraseña"),
        tr(
          `✓ Your email <b>${esc(st.email)}</b> is verified.`,
          `✓ Su correo <b>${esc(st.email)}</b> está verificado.`
        )
      ) +
      `<section class="gate-body">${err()}
        <form id="ob-form" novalidate>
          ${pwField("ob-pw", tr("Password", "Contraseña"), "new-password")}
          ${rules()}
          ${keepBox()}
          <button class="gate-btn primary-btn" type="submit">${tr("Create my account", "Crear mi cuenta")}</button>
        </form></section>`,
    signin: () =>
      hero(tr("Welcome back", "Bienvenido de nuevo"), "") +
      `<section class="gate-body">${back}${sso()}${err()}
        <form id="ob-form" novalidate>
          ${field("ob-email", tr("Email", "Correo"), "email", `autocomplete="username" inputmode="email" maxlength="100" value="${esc(st.email)}"`)}
          ${pwField("ob-pw", tr("Password", "Contraseña"), "current-password")}
          ${keepBox()}
          <button class="gate-btn primary-btn" type="submit">${tr("Sign in", "Iniciar sesión")}</button>
        </form>
        <button class="gate-demo" id="ob-forgot">${tr("Forgot password?", "¿Olvidó su contraseña?")}</button>
        <p class="gate-swap">${tr("New to ScamSense?", "¿Nuevo en ScamSense?")} <button class="linkbtn" id="ob-to-create">${tr("Create an account", "Crear una cuenta")}</button></p></section>`,
    signin_code: () =>
      hero(
        tr("One more step", "Un paso más"),
        tr(
          `For your safety, we sent a 6-digit code to <b>${esc(st.email)}</b>.`,
          `Por su seguridad, enviamos un código de 6 dígitos a <b>${esc(st.email)}</b>.`
        )
      ) +
      `<section class="gate-body">${back}${err()}
        <form id="ob-form" novalidate>${codeField()}
          <button class="gate-btn primary-btn" type="submit">${tr("Finish signing in", "Terminar de iniciar sesión")}</button>
        </form>
        <button class="gate-demo" id="ob-resend">${tr("Send a new code", "Enviar un código nuevo")}</button></section>`,
    forgot: () =>
      hero(
        tr("Reset your password", "Restablecer su contraseña"),
        tr("We'll email you a code.", "Le enviaremos un código por correo.")
      ) +
      `<section class="gate-body">${back}${err()}
        <form id="ob-form" novalidate>
          ${field("ob-email", tr("Your email", "Su correo"), "email", `autocomplete="email" inputmode="email" maxlength="100" value="${esc(st.email)}"`)}
          <button class="gate-btn primary-btn" type="submit">${tr("Send me a code", "Envíenme un código")}</button>
        </form></section>`,
    forgot_code: () =>
      hero(
        tr("Check your email", "Revise su correo"),
        tr(
          `If <b>${esc(st.email)}</b> has an account, we sent it a 6-digit code.`,
          `Si <b>${esc(st.email)}</b> tiene una cuenta, le enviamos un código de 6 dígitos.`
        )
      ) +
      `<section class="gate-body">${back}${err()}
        <form id="ob-form" novalidate>
          ${codeField()}
          <button class="gate-btn primary-btn" type="submit">${tr("Continue", "Continuar")}</button>
        </form>
        <p class="small muted">${tr("Can't find it? Check your Spam or Junk folder.", "¿No lo encuentra? Revise su carpeta de Spam o correo no deseado.")}</p>
        <button class="gate-demo" id="ob-resend">${tr("Send a new code", "Enviar un código nuevo")}</button></section>`,
    forgot_pw: () =>
      hero(
        tr("Choose a new password", "Elija una nueva contraseña"),
        tr(
          `✓ Your email <b>${esc(st.email)}</b> is verified.`,
          `✓ Su correo <b>${esc(st.email)}</b> está verificado.`
        )
      ) +
      `<section class="gate-body">${err()}
        <form id="ob-form" novalidate>
          ${pwField("ob-pw", tr("New password", "Nueva contraseña"), "new-password")}
          ${rules()}
          ${keepBox()}
          <button class="gate-btn primary-btn" type="submit">${tr("Save new password", "Guardar nueva contraseña")}</button>
        </form>
        <p class="small muted">${tr("Every other device will be signed out, to keep your account safe.", "Se cerrará la sesión en los demás dispositivos, para proteger su cuenta.")}</p></section>`
  };
  const BACK_TO = {
    create: "home",
    signin: "home",
    create_code: "create",
    signin_code: "signin",
    forgot: "signin",
    forgot_code: "forgot"
  };

  const draw = () => {
    m.innerHTML = `<div class="gate-box" role="dialog" aria-modal="true" aria-labelledby="gate-h">${screens[st.step]()}</div>`;
    bind();
    const first = m.querySelector("#ob-code, #ob-email:not([value]), #ob-email[value=''], #ob-pw");
    if (first && st.step !== "home") setTimeout(() => first.focus(), 30);
  };
  const go2 = (step, note) => {
    st.step = step;
    st.note = note || "";
    draw();
  };
  const say = t => {
    const e = m.querySelector("#ob-err");
    if (e) e.textContent = t || "";
  };
  const val = id => {
    const e = m.querySelector(id);
    return e ? e.value.trim() : "";
  };
  const call = async (body, btn) => {
    if (st.busy) return null;
    st.busy = true;
    const b = btn || m.querySelector("#ob-form [type=submit]");
    const old = b ? b.textContent : "";
    if (b) {
      b.disabled = true;
      b.textContent = tr("One moment…", "Un momento…");
    }
    say("");
    let j = null;
    try {
      if (!serverOn())
        throw new Error(
          tr("Accounts need the ScamSense server.", "Las cuentas necesitan el servidor de ScamSense.")
        );
      j = await serverPost(Object.assign({ mode: "auth", device: deviceLabel() }, body));
      st.last = j;
      if (!j || j.error) throw new Error((j && j.error) || "");
    } catch (e) {
      say(
        e.message ||
          tr(
            "That didn't work. Check your internet and try again.",
            "No funcionó. Revise su internet e intente de nuevo."
          )
      );
      j = null;
    }
    st.busy = false;
    if (b && b.isConnected) {
      b.disabled = false;
      b.textContent = old;
    }
    return j;
  };
  const finish = j => {
    signedIn(j);
    m.remove();
    go("today");
  };

  function bind() {
    m.querySelector("#onb-lang").onchange = async e => {
      saveCfg(Object.assign(cfg(), { lang: e.target.value }));
      await loadDict();
      applyLang();
      draw();
    };
    const on = (id, fn) => {
      const el = m.querySelector(id);
      if (el) el.onclick = fn;
    };
    on("#ob-back", () => go2(BACK_TO[st.step] || "home"));
    on("#ob-create", () => go2("create"));
    on("#ob-signin", () => go2("signin"));
    on("#ob-to-signin", () => go2("signin"));
    on("#ob-to-create", () => go2("create"));
    on("#ob-forgot", () => {
      st.email = val("#ob-email") || st.email;
      go2("forgot");
    });
    on("#ob-demo", () => {
      S.set("onboarded", true);
      m.remove();
      go("today");
      loadDemo();
    });
    on("#ob-google", () => {
      S.set("onboarded", true);
      m.remove();
      go("today");
      scanEmail();
    });
    on("#ob-ms", () => {
      S.set("onboarded", true); // Microsoft's page opens next, then brings them back here
      connectOutlook();
    });
    m.querySelectorAll(".pwshow").forEach(
      b =>
        (b.onclick = () => {
          const i = m.querySelector("#" + b.dataset.for);
          const show = i.type === "password";
          i.type = show ? "text" : "password";
          b.setAttribute("aria-pressed", String(show));
          b.textContent = show ? tr("Hide", "Ocultar") : tr("Show", "Mostrar");
        })
    );
    const pw = m.querySelector("#ob-pw");
    const list = m.querySelector("#pwrules");
    if (pw && list)
      pw.oninput = () => {
        say("");
        PW_RULES().forEach(([test], i) => list.children[i].classList.toggle("met", test(pw.value)));
      };
    const keep = m.querySelector("#ob-keep");
    if (keep) keep.onchange = () => (st.keep = keep.checked);
    on("#ob-resend", async e => {
      const body =
        st.step === "create_code"
          ? { action: "signup_start", email: st.email }
          : st.step === "forgot_code"
            ? { action: "reset_start", email: st.email }
            : { action: "login", email: st.email, password: st.pw, keep: st.keep };
      const j = await call(body, e.currentTarget);
      if (j) say(tr("We sent a new code. Check your email.", "Enviamos un código nuevo. Revise su correo."));
    });
    const form = m.querySelector("#ob-form");
    if (form) form.onsubmit = submit;
  }

  const pwProblem = p => {
    const miss = PW_RULES().find(([test]) => !test(p));
    return miss ? tr("Your password needs: ", "Su contraseña necesita: ") + miss[1].toLowerCase() + "." : "";
  };
  async function submit(e) {
    e.preventDefault();
    if (st.step === "create_pw" || st.step === "forgot_pw") return savePassword();
    if (st.step === "create" || st.step === "forgot") {
      const email = val("#ob-email").toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email))
        return say(tr("Please type your full email address.", "Escriba su correo completo."));
      st.email = email;
      const j = await call({ action: st.step === "create" ? "signup_start" : "reset_start", email });
      if (j) go2(st.step === "create" ? "create_code" : "forgot_code");
      else if (st.step === "create" && /already have an account/.test(m.querySelector("#ob-err").textContent))
        go2(
          "signin",
          tr(
            "You already have an account with this email. Please sign in.",
            "Ya tiene una cuenta con este correo. Inicie sesión."
          )
        );
      return;
    }
    if (st.step === "signin") {
      const email = val("#ob-email").toLowerCase();
      const p = m.querySelector("#ob-pw").value;
      if (!email || !p)
        return say(tr("Please type your email and password.", "Escriba su correo y contraseña."));
      st.email = email;
      st.pw = p;
      st.keep = m.querySelector("#ob-keep").checked;
      st.last = null;
      const j = await call({ action: "login", email, password: p, keep: st.keep });
      if (j && j.needCode) return go2("signin_code");
      // An account made with Google or Outlook has no password yet: send a code right away so they can make one.
      if (!j && st.last && st.last.noPassword) {
        const r = await call({ action: "reset_start", email });
        if (r)
          go2(
            "forgot_code",
            tr(
              `This account doesn't have a password yet. We sent a 6-digit code to ${email}. Type it here, then choose your password.`,
              `Esta cuenta aún no tiene contraseña. Enviamos un código de 6 dígitos a ${email}. Escríbalo aquí y luego elija su contraseña.`
            )
          );
      }
      return;
    }
    const code = val("#ob-code").replace(/\D/g, "");
    if (code.length !== 6)
      return say(
        tr("Please type the 6-digit code from the email.", "Escriba el código de 6 dígitos del correo.")
      );
    if (st.step === "signin_code") {
      const j = await call({ action: "login_finish", email: st.email, code });
      if (j) finish(j);
      return;
    }
    // Step 2: check the code; the password comes on the next screen.
    const j = await call({
      action: st.step === "create_code" ? "signup_verify" : "reset_verify",
      email: st.email,
      code
    });
    if (j) {
      st.ticket = j.ticket;
      go2(st.step === "create_code" ? "create_pw" : "forgot_pw");
    }
  }
  // Step 3: the password.
  async function savePassword() {
    const p = m.querySelector("#ob-pw").value;
    const bad = pwProblem(p);
    if (bad) return say(bad);
    st.keep = m.querySelector("#ob-keep").checked;
    const j = await call({
      action: st.step === "create_pw" ? "signup_finish" : "reset_finish",
      email: st.email,
      ticket: st.ticket,
      password: p,
      keep: st.keep
    });
    if (j) return finish(j);
    if (/start again/.test(m.querySelector("#ob-err").textContent))
      go2(st.step === "create_pw" ? "create" : "forgot", m.querySelector("#ob-err").textContent);
  }

  draw();
}

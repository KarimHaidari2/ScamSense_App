/*
 * ScamSense · Settings tab
 * Gmail, look (light or dark), PIN lock, plan, privacy. AI key and scan options are under Advanced.
 */
"use strict";

function renderSettings() {
  const c = cfg();
  const lead = (icn, cls) => `<span class="lead-ic ${cls}">${ic(icn)}</span>`;
  const gmailOn = !!S.get("connected", false),
    outlookOn = typeof outlookConnected === "function" && outlookConnected(),
    pinOn = !!S.get("lock", null),
    helpersN = S.get("helpers", []).length,
    aiOn = !!(c.apiKey || c.mahiUrl);
  /* "Your protection": four safety steps, each one tap away from being turned on. */
  const steps = [
    [gmailOn || outlookOn, "mail", tr("Your email is checked", "Su correo se revisa"), "connect"],
    [pinOn, "lock", tr("The app is locked with a PIN", "La app tiene un PIN"), "pin"],
    [helpersN > 0, "user", tr("A trusted person is added", "Hay una persona de confianza"), "family"],
    [
      aiOn,
      "spark",
      tr("Mahi's smart answers are on", "Las respuestas inteligentes de Mahi están activas"),
      "ai"
    ]
  ];
  const done = steps.filter(x => x[0]).length;
  view.innerHTML = `${pageHead(t("tab_settings"), "")}
  <section class="protect" aria-label="${esc(tr("Your protection", "Su protección"))}">
    <div class="protect-top"><div class="ring" style="--p:${done / steps.length}"><b>${done}/${steps.length}</b></div>
      <div><h2>${done === steps.length ? tr("You're fully protected", "Está totalmente protegido") : tr("Your protection", "Su protección")}</h2>
      <p>${tr(`${done} of ${steps.length} safety steps are on.`, `${done} de ${steps.length} pasos de seguridad activos.`)}</p></div></div>
    <ul class="protect-list">${steps
      .map(
        ([on, icn, label, fix]) =>
          `<li class="${on ? "on" : ""}"><span class="pl-ic">${ic(on ? "check" : icn)}</span><span class="pl-tx">${label}</span>${on ? "" : `<button class="btn sm primary" data-fix="${fix}">${tr("Turn on", "Activar")}</button>`}</li>`
      )
      .join("")}</ul></section>

  <section class="sect"><h2 class="sect-h">${tr("Email", "Correo")}</h2><div class="group">
    ${emailAccountsHTML()}</div></section>

  <section class="sect"><h2 class="sect-h">${tr("Texts and calls", "Textos y llamadas")}</h2><div class="group">
    <button class="grow linkrow" data-go="share">${lead("msg", "l-green")}<span class="gl"><b>${tr("Send a text to ScamSense", "Enviar un texto a ScamSense")}</b><span>${tr("Check a suspicious text in 2 taps, on iPhone or Android.", "Revise un texto sospechoso en 2 toques, en iPhone o Android.")}</span></span>${ic("chev", "chev")}</button>
    <button class="grow linkrow" data-go="preview">${lead("phone", "l-green")}<span class="gl"><b>${tr("Automatic blocking", "Bloqueo automático")}</b><span>${tr("Coming with the iPhone app.", "Llega con la app de iPhone.")}</span></span>${ic("chev", "chev")}</button></div></section>

  <section class="sect"><h2 class="sect-h">${tr("Look", "Apariencia")}</h2><div class="group">
    <div class="grow">${lead("sun", "l-amber")}<label for="theme" class="gl"><b>${tr("Light or dark", "Claro u oscuro")}</b><span>${tr("Automatic follows your phone: light, or dark teal at night.", "Automático sigue su teléfono: claro, o verde oscuro de noche.")}</span></label><select id="theme" class="inline">${[
      ["auto", tr("Automatic", "Automático")],
      ["light", tr("Light", "Claro")],
      ["dark", tr("Dark (black)", "Oscuro (negro)")]
    ]
      .map(([k, v]) => `<option value="${k}" ${(c.theme || "auto") === k ? "selected" : ""}>${v}</option>`)
      .join("")}</select></div></div></section>

  <section class="sect"><h2 class="sect-h">${tr("Security", "Seguridad")}</h2><div class="group">
    <div class="grow">${lead("lock", "l-teal")}<span class="gl"><b>${tr("Lock ScamSense with a PIN", "Bloquear ScamSense con un PIN")}</b><span>${tr("Asks for your PIN when you open the app or come back after 2 minutes.", "Pide su PIN al abrir la app o al volver después de 2 minutos.")}</span></span>${switchHTML("applock", pinOn, "")}</div>${pinOn ? `<button class="grow linkrow" id="chpin">${lead("key", "l-teal")}<span class="gl"><b>${tr("Change PIN", "Cambiar PIN")}</b><span>${tr("6 numbers. 5 wrong tries makes the app wait.", "6 números. Tras 5 intentos fallidos, la app hace esperar.")}</span></span>${ic("chev", "chev")}</button>` : ""}</div></section>

  <section class="sect"><h2 class="sect-h">${tr("Plan", "Plan")}</h2><div class="group">
    <button class="grow linkrow" data-go="plans">${lead("shield", "l-purple")}<span class="gl"><b>${tr("Plans and pricing", "Planes y precios")}</b><span>${tr("Personal $9.99/month · Family $15.99/month", "Personal $9.99/mes · Familia $15.99/mes")}</span></span>${ic("chev", "chev")}</button></div></section>

  <section class="sect"><h2 class="sect-h">${t("set_priv")}</h2><div class="group">
    <details class="grow col fold"><summary>${lead("info", "l-gray")}<span class="gl"><b>${tr("How ScamSense keeps you private", "Cómo ScamSense protege su privacidad")}</b></span>${ic("chev", "chev")}</summary><p>${t("priv1")}</p><p>${t("priv2")}</p></details>
    <div class="grow">${lead("user", "l-gray")}<a class="gl" href="https://myaccount.google.com/permissions" target="_blank" rel="noopener"><b>${tr("Remove Gmail access in Google", "Quitar el acceso de Gmail en Google")}</b><span>myaccount.google.com/permissions</span></a>${ic("chev", "chev")}</div>
    <button class="grow linkrow danger" id="wipe">${lead("trash", "l-red")}<span class="gl"><b>${t("wipe")}</b></span></button></div></section>

  <section class="sect"><h2 class="sect-h">${tr("Help", "Ayuda")}</h2><div class="group">
    <details class="grow col fold"><summary>${lead("device", "l-blue")}<span class="gl"><b>${t("set_home")}</b></span>${ic("chev", "chev")}</summary><ol class="steps"><li>${t("home1")}</li><li>${t("home2")}</li><li>${t("home3")}</li></ol></details></div></section>

  <details class="sect adv"><summary class="sect-h">${tr("Advanced", "Avanzado")}</summary>
  <div class="subsect"><h3 class="sub-h">${tr("Smart AI checks", "Revisión con IA")}</h3><div class="group">
    <div class="grow col"><label for="key" class="gl"><b>${t("set_key")}</b><span>${tr("Used only to ask Anthropic's AI about risky messages.", "Solo para preguntar a la IA de Anthropic sobre mensajes riesgosos.")}</span></label>
      <div class="lookup"><input id="key" type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-…" value="${esc(c.apiKey)}"><button class="btn sm ghost" id="test">${t("test_key")}</button></div></div>
    <div class="grow"><label for="aim" class="gl"><b>${tr("What the AI checks", "Qué revisa la IA")}</b></label><select id="aim" class="inline">
      <option value="risky" ${c.aiMode === "risky" ? "selected" : ""}>${tr("Only risky messages", "Solo los riesgosos")}</option><option value="all" ${c.aiMode === "all" ? "selected" : ""}>${tr("Every message", "Todos")}</option><option value="off" ${c.aiMode === "off" ? "selected" : ""}>${tr("Off", "Apagado")}</option></select></div>
    <div class="grow"><span class="gl"><b>${tr("Remember my key on this device", "Recordar mi clave en este dispositivo")}</b><span>${tr("Off is safer: you paste it again after closing the tab.", "Apagado es más seguro: la pega de nuevo al cerrar.")}</span></span>${switchHTML("remk", c.rememberKey !== false, "")}</div></div></div>
  <div class="subsect"><h3 class="sub-h">${tr("Daily scan", "Revisión diaria")}</h3><div class="group">
    <div class="grow"><label for="days" class="gl"><b>${t("set_days")}</b></label><select id="days" class="inline">${[1, 3, 7].map(d => `<option value="${d}" ${c.days === d ? "selected" : ""}>${d === 1 ? t("d24") : t("ddays", { n: d })}</option>`).join("")}</select></div>
    <div class="grow"><label for="max" class="gl"><b>${t("set_max")}</b></label><select id="max" class="inline">${[50, 100, 200].map(d => `<option value="${d}" ${c.max === d ? "selected" : ""}>${d}</option>`).join("")}</select></div></div>
    <p class="footnote">${t("set_folders")}</p></div>
<div class="group">
    <div class="grow col"><label for="cid" class="gl"><b>${t("set_cid")}</b></label><input id="cid" autocomplete="off" spellcheck="false" value="${esc(c.clientId)}"></div>
    <div class="grow col"><label for="msid" class="gl"><b>${tr("Microsoft app ID (for Outlook)", "ID de app de Microsoft (para Outlook)")}</b><span>${tr("From Microsoft Entra → App registrations. See docs/outlook-setup.md.", "De Microsoft Entra → Registros de aplicaciones. Vea docs/outlook-setup.md.")}</span></label><input id="msid" autocomplete="off" spellcheck="false" placeholder="00000000-0000-0000-0000-000000000000" value="${esc(c.msClientId || "")}"></div>
    <div class="grow col"><label for="mdl" class="gl"><b>${t("set_model")}</b></label><input id="mdl" autocomplete="off" spellcheck="false" value="${esc(c.model)}"></div>
    <div class="grow col"><label for="murl" class="gl"><b>${tr("Mahi server", "Servidor de Mahi")}</b><span>${tr("Web app URL from the Mahi Server script. Lets Mahi answer anything with no key in the app.", "URL de la app web del script Mahi Server. Permite que Mahi responda todo sin clave en la app.")}</span></label><input id="murl" type="url" autocomplete="off" spellcheck="false" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(c.mahiUrl)}"></div></div></details>
  <p class="footnote center">${t("footer")}</p>`;
  const save = () => {
    saveCfg(
      Object.assign(cfg(), {
        theme: document.getElementById("theme").value,
        rememberKey: document.getElementById("remk").checked,
        clientId: document.getElementById("cid").value.trim() || DEFAULT_CLIENT_ID,
        apiKey: document.getElementById("key").value.trim(),
        aiMode: document.getElementById("aim").value,
        model: document.getElementById("mdl").value.trim() || "claude-haiku-5-5",
        mahiUrl: document.getElementById("murl").value.trim(),
        msClientId: document.getElementById("msid").value.trim(),
        days: +document.getElementById("days").value,
        max: +document.getElementById("max").value
      })
    );
    setStatus();
  };
  view.querySelectorAll("input,select").forEach(x => {
    if (x.id !== "applock") x.onchange = save;
  });
  const chp = document.getElementById("chpin");
  if (chp) chp.onclick = () => setupPin(ok => ok && renderSettings());
  document.getElementById("applock").onchange = e => {
    if (e.target.checked) {
      setupPin(ok => {
        if (!ok) e.target.checked = false;
        else renderSettings();
      });
    } else {
      S.del("lock");
      S.del("lockfail");
      toast(tr("App lock is off.", "El bloqueo está apagado."));
      renderSettings();
    }
  };
  view.querySelectorAll("[data-fix]").forEach(
    b =>
      (b.onclick = () => {
        const f = b.dataset.fix;
        if (f === "connect") document.getElementById("gconn").click();
        else if (f === "pin") setupPin(ok => ok && renderSettings());
        else if (f === "family") go("family");
        else {
          const adv = view.querySelector("details.adv");
          adv.open = true;
          adv.scrollIntoView({ behavior: "smooth", block: "start" });
          document.getElementById("key").focus();
        }
      })
  );
  bindEmailAccounts(renderSettings);
  document.getElementById("msid").onchange = () => {
    save();
    renderSettings();
  };
  document.getElementById("theme").onchange = () => {
    save();
    applyTheme();
  };
  view.querySelectorAll("[data-go]").forEach(b => (b.onclick = () => go(b.dataset.go)));
  document.getElementById("test").onclick = async () => {
    save();
    const b = document.getElementById("test");
    b.disabled = true;
    b.textContent = t("testing");
    try {
      const r = await aiCheck({
        channel: "text message",
        text: "Hi, this is a reminder that your dentist appointment is tomorrow at 10 AM.",
        links: [],
        local: { reasons: [] }
      });
      toast(t("ai_works", { v: t(r.verdict) }));
    } catch (e) {
      toast(e.message === "no-key" ? t("paste_key") : e.message);
    }
    b.disabled = false;
    b.textContent = t("test_key");
  };
  document.getElementById("wipe").onclick = function () {
    if (this.dataset.sure) {
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith("ss_"))
          .forEach(k => localStorage.removeItem(k));
        Object.keys(sessionStorage)
          .filter(k => k.startsWith("ss_"))
          .forEach(k => sessionStorage.removeItem(k));
      } catch (e) {}
      token = null;
      setStatus();
      applyLang();
      toast(t("wiped"));
      go("today");
    } else {
      this.dataset.sure = "1";
      this.querySelector("b").textContent = t("wipe_sure");
    }
  };
}

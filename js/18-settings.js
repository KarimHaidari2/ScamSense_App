/*
 * ScamSense · Settings tab
 * Email accounts, AI key, security, language, privacy, and advanced settings.
 */
"use strict";

function renderSettings() {
  const c = cfg();
  const conn = S.get("connected", false);
  view.innerHTML = `${pageHead(t("tab_settings"), "")}
  <section class="sect"><h2 class="sect-h">${tr("Email accounts", "Cuentas de correo")}</h2><div class="group">
    <div class="grow"><span class="pv" style="--pv:#D93025">G</span><span class="gl"><b>Gmail</b><span>${conn ? tr("Connected", "Conectado") : tr("Not connected", "Sin conectar")}</span></span>
      ${conn ? `<button class="btn sm ghost" id="disc">${t("disconnect")}</button>` : `<button class="btn sm primary" id="conn">${tr("Connect", "Conectar")}</button>`}</div>
    <button class="grow linkrow" data-go="checkEmail"><span class="pv" style="--pv:#4F6B70">+</span><span class="gl"><b>${tr("Other email providers", "Otros proveedores")}</b><span>Outlook, Yahoo, iCloud, AOL</span></span>${ic("chev", "chev")}</button></div></section>
  <section class="sect"><h2 class="sect-h">${tr("Smart AI checks", "Revisión con IA")}</h2><div class="group">
    <div class="grow col"><label for="key" class="gl"><b>${t("set_key")}</b><span>${tr("Used only to ask Anthropic's AI about risky messages.", "Solo para preguntar a la IA de Anthropic sobre mensajes riesgosos.")}</span></label>
      <div class="lookup"><input id="key" type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-…" value="${esc(c.apiKey)}"><button class="btn sm ghost" id="test">${t("test_key")}</button></div></div>
    <div class="grow"><label for="aim" class="gl"><b>${tr("What the AI checks", "Qué revisa la IA")}</b></label><select id="aim" class="inline">
      <option value="risky" ${c.aiMode === "risky" ? "selected" : ""}>${tr("Only risky messages", "Solo los riesgosos")}</option><option value="all" ${c.aiMode === "all" ? "selected" : ""}>${tr("Every message", "Todos")}</option><option value="off" ${c.aiMode === "off" ? "selected" : ""}>${tr("Off", "Apagado")}</option></select></div>
    <div class="grow"><span class="gl"><b>${tr("Remember my key on this device", "Recordar mi clave en este dispositivo")}</b><span>${tr("Off is safer: you paste it again after closing the tab.", "Apagado es más seguro: la pega de nuevo al cerrar.")}</span></span>${switchHTML("remk", c.rememberKey !== false, "")}</div></div></section>
  <section class="sect"><h2 class="sect-h">${tr("Security", "Seguridad")}</h2><div class="group">
    <div class="grow"><span class="gl"><b>${tr("Lock ScamSense with a PIN", "Bloquear ScamSense con un PIN")}</b><span>${tr("Asks for your PIN when you open the app or come back after 2 minutes.", "Pide su PIN al abrir la app o al volver después de 2 minutos.")}</span></span>${switchHTML("applock", !!S.get("lock", null), "")}</div></div></section>
  <section class="sect"><h2 class="sect-h">${tr("Plan", "Plan")}</h2><div class="group">
    <button class="grow linkrow" data-go="plans"><span class="gl"><b>${tr("Plans and pricing", "Planes y precios")}</b><span>${tr("Personal $9.99/month · Family $15.99/month", "Personal $9.99/mes · Familia $15.99/mes")}</span></span>${ic("chev", "chev")}</button></div></section>
  <section class="sect"><h2 class="sect-h">${tr("Language", "Idioma")}</h2><div class="group">
    <div class="grow"><label for="lang" class="gl"><b>${tr("App language", "Idioma de la app")}</b><span>${tr("AI answers and read-aloud use it too.", "Las respuestas de IA y la lectura también.")}</span></label><select id="lang" class="inline">${Object.entries(
      LANGS
    )
      .map(([k, v]) => `<option value="${k}" ${c.lang === k ? "selected" : ""}>${v.name}</option>`)
      .join("")}</select></div></div></section>
  <section class="sect"><h2 class="sect-h">${tr("Daily scan", "Revisión diaria")}</h2><div class="group">
    <div class="grow"><label for="days" class="gl"><b>${t("set_days")}</b></label><select id="days" class="inline">${[1, 3, 7].map(d => `<option value="${d}" ${c.days === d ? "selected" : ""}>${d === 1 ? t("d24") : t("ddays", { n: d })}</option>`).join("")}</select></div>
    <div class="grow"><label for="max" class="gl"><b>${t("set_max")}</b></label><select id="max" class="inline">${[50, 100, 200].map(d => `<option value="${d}" ${c.max === d ? "selected" : ""}>${d}</option>`).join("")}</select></div></div>
    <p class="footnote">${t("set_folders")}</p></section>
  <section class="sect"><h2 class="sect-h">${t("set_priv")}</h2><div class="group">
    <div class="grow col"><span class="gl"><span>${t("priv1")}</span></span></div>
    <div class="grow col"><span class="gl"><span>${t("priv2")}</span></span></div>
    <div class="grow"><a class="gl" href="https://myaccount.google.com/permissions" target="_blank" rel="noopener"><b>${tr("Remove Gmail access in Google", "Quitar el acceso de Gmail en Google")}</b><span>myaccount.google.com/permissions</span></a>${ic("chev", "chev")}</div>
    <button class="grow linkrow danger" id="wipe"><span class="gl"><b>${t("wipe")}</b></span>${ic("trash")}</button></div></section>
  <section class="sect"><h2 class="sect-h">${t("set_home")}</h2><div class="group"><div class="grow col"><ol class="steps"><li>${t("home1")}</li><li>${t("home2")}</li><li>${t("home3")}</li></ol></div></div></section>
  <details class="sect adv"><summary class="sect-h">${tr("Advanced", "Avanzado")}</summary><div class="group">
    <div class="grow col"><label for="cid" class="gl"><b>${t("set_cid")}</b></label><input id="cid" autocomplete="off" spellcheck="false" value="${esc(c.clientId)}"></div>
    <div class="grow col"><label for="mdl" class="gl"><b>${t("set_model")}</b></label><input id="mdl" autocomplete="off" spellcheck="false" value="${esc(c.model)}"></div></div></details>
  <p class="footnote center">${t("footer")}</p>`;
  const save = () => {
    saveCfg(
      Object.assign(cfg(), {
        lang: document.getElementById("lang").value,
        rememberKey: document.getElementById("remk").checked,
        clientId: document.getElementById("cid").value.trim() || DEFAULT_CLIENT_ID,
        apiKey: document.getElementById("key").value.trim(),
        aiMode: document.getElementById("aim").value,
        model: document.getElementById("mdl").value.trim() || "claude-haiku-5-5",
        days: +document.getElementById("days").value,
        max: +document.getElementById("max").value
      })
    );
    setStatus();
  };
  view.querySelectorAll("input,select").forEach(x => {
    if (x.id !== "applock") x.onchange = save;
  });
  document.getElementById("applock").onchange = e => {
    if (e.target.checked) {
      setupPin(ok => {
        if (!ok) e.target.checked = false;
      });
    } else {
      S.del("lock");
      toast(tr("App lock is off.", "El bloqueo está apagado."));
    }
  };
  document.getElementById("lang").onchange = async () => {
    save();
    await loadDict();
    applyLang();
    renderSettings();
  };
  view.querySelectorAll("[data-go]").forEach(b => (b.onclick = () => go(b.dataset.go)));
  const cn = document.getElementById("conn");
  if (cn)
    cn.onclick = async () => {
      save();
      try {
        await getToken(true);
        toast(t("gmail_ok"));
        go("today");
        scanGmail();
      } catch (e) {
        toast(e.message);
      }
    };
  const dc = document.getElementById("disc");
  if (dc)
    dc.onclick = () => {
      try {
        if (token) google.accounts.oauth2.revoke(token, () => {});
      } catch (e) {}
      token = null;
      S.set("connected", false);
      S.del("report");
      setStatus();
      renderSettings();
      toast(t("gmail_off"));
    };
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

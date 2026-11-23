/*
 * ScamSense · Family tab
 * Trusted people: add, call, invite, remove, and what they are told.
 */
"use strict";

const RELS = [
  ["daughter", "Daughter", "Hija"],
  ["son", "Son", "Hijo"],
  ["spouse", "Spouse or partner", "Pareja"],
  ["grandchild", "Grandchild", "Nieto/a"],
  ["sibling", "Brother or sister", "Hermano/a"],
  ["friend", "Friend", "Amigo/a"],
  ["caregiver", "Caregiver", "Cuidador/a"],
  ["other", "Other", "Otro"]
];
const relName = k => {
  const r = RELS.find(x => x[0] === k);
  return r ? tr(r[1], r[2]) : "";
};
const famPrefs = () =>
  Object.assign(
    { scam: true, pause: true, sos: true, weekly: false, callBeforePay: true },
    S.get("famPrefs", {})
  );
function renderFamily() {
  const helpers = S.get("helpers", []);
  const p = famPrefs();
  view.innerHTML = `${heroHead(tr("Family & trusted people", "Familia y personas de confianza"), tr("Pick people you trust. They can help you decide before you pay or reply. They see alerts, never your messages.", "Elija personas de confianza. Pueden ayudarle antes de pagar o responder. Ven alertas, nunca sus mensajes."))}
  <section class="sect"><div class="sect-row"><h2 class="sect-h">${tr("Your trusted people", "Sus personas de confianza")}</h2><button class="btn sm primary" id="addp">${ic("plus")}<span>${tr("Add", "Agregar")}</span></button></div>
    <div id="addform" hidden></div>
    ${
      helpers.length
        ? `<div class="group">${helpers
            .map(
              (
                h,
                i
              ) => `<div class="grow person"><span class="avatar">${esc((h.name || "?")[0].toUpperCase())}</span>
      <span class="gl"><b>${esc(h.name)}</b><span>${esc([relName(h.rel), h.phone, h.email].filter(Boolean).join(" · "))}</span></span>
      <span class="pacts">${h.phone ? `<a class="iconbtn" href="tel:${esc(h.phone.replace(/[^\d+]/g, ""))}" aria-label="${tr("Call", "Llamar")} ${esc(h.name)}">${ic("phone")}</a>` : ""}
      <button class="iconbtn" data-inv="${i}" aria-label="${tr("Invite", "Invitar")} ${esc(h.name)}">${ic("share")}</button>
      <button class="iconbtn danger" data-rm="${i}" aria-label="${tr("Remove", "Quitar")} ${esc(h.name)}">${ic("trash")}</button></span></div>`
            )
            .join("")}</div>`
        : `<div class="emptybox">${ic("user")}<b>${tr("No one added yet", "Aún no hay nadie")}</b><span>${tr("Add a family member or friend you'd call before sending money.", "Agregue a un familiar o amigo a quien llamaría antes de enviar dinero.")}</span></div>`
    }</section>
  ${teamHelpHTML(helpers.length)}
  <section class="sect"><h2 class="sect-h">${tr("Call before you pay", "Llame antes de pagar")}</h2>
    <div class="group"><div class="grow"><span class="gl"><b>${tr('Show a "Call" button when a payment is paused', 'Mostrar botón "Llamar" al pausar un pago')}</b><span>${tr("When ScamSense stops a payment, you can call your trusted person with one tap.", "Cuando ScamSense detiene un pago, puede llamar a su persona de confianza con un toque.")}</span></span>${switchHTML("pcbp", p.callBeforePay, "")}</div></div></section>
  <section class="sect"><h2 class="sect-h">${tr("What they'll be told", "Qué se les avisará")}</h2>
    <div class="group">${[
      ["scam", t("fam_s1")],
      ["pause", t("fam_s2")],
      ["sos", t("fam_s3")],
      ["weekly", t("fam_s4")]
    ]
      .map(
        ([k, l]) =>
          `<div class="grow"><span class="gl"><b>${l}</b></span>${switchHTML("pf_" + k, p[k], l)}</div>`
      )
      .join("")}</div>
    <p class="footnote">${ic("bell")}${
      serverOn()
        ? tr(
            "Trusted people with an email address get an email when ScamSense sees danger.",
            "Las personas de confianza con correo reciben un aviso cuando ScamSense ve peligro."
          )
        : tr(
            "Automatic alerts start when the ScamSense server is ready. For now, use Call or Invite.",
            "Las alertas automáticas empiezan cuando el servidor esté listo. Por ahora use Llamar o Invitar."
          )
    }</p></section>
  <section class="sect"><h2 class="sect-h">${tr("What your trusted person will see", "Lo que verá su persona de confianza")}</h2>
    <div class="lockscreen" aria-label="${esc(tr("Sample alerts on their phone", "Alertas de ejemplo en su teléfono"))}">
      <p class="ls-time" aria-hidden="true">9:41</p>
      <div class="fnotif n-scam"><img src="icon-192.png" alt=""><div><p class="n-top"><b>ScamSense</b><span>${t("fam_t1")}</span></p><p class="n-title">${tr("Scam stopped", "Estafa detenida")}</p><p>${tr("Your mom got a fake PayPal email. ScamSense marked it as a scam. She didn't click it.", "Su mamá recibió un correo falso de PayPal. ScamSense lo marcó como estafa. No hizo clic.")}</p></div></div>
      <div class="fnotif n-warn"><img src="icon-192.png" alt=""><div><p class="n-top"><b>ScamSense</b><span>${t("fam_t2")}</span></p><p class="n-title">${tr("Payment paused. Give her a call", "Pago pausado. Llámela")}</p><p>${tr("Your mom paused a $500 gift card payment. ScamSense explained it was a tech support scam. Give her a call.", "Su mamá pausó un pago de $500 en tarjetas de regalo. ScamSense explicó que era una estafa de soporte técnico. Llámela.")}</p></div></div>
    </div><p class="footnote">${tr("Sample alerts.", "Alertas de ejemplo.")}</p></section>`;
  document.getElementById("addp").onclick = showAddForm;
  view.querySelectorAll("[data-rm]").forEach(
    b =>
      (b.onclick = () => {
        if (b.dataset.sure) {
          const hs = S.get("helpers", []);
          const gone = hs.splice(+b.dataset.rm, 1)[0];
          S.set("helpers", hs);
          if (typeof registerSoon === "function") registerSoon();
          toast(tr(`${gone.name} was removed.`, `Se quitó a ${gone.name}.`));
          renderFamily();
          return;
        }
        b.dataset.sure = "1";
        b.classList.add("confirm");
        b.innerHTML = `<span>${tr("Remove?", "¿Quitar?")}</span>`;
        setTimeout(() => {
          if (document.body.contains(b)) {
            delete b.dataset.sure;
            b.classList.remove("confirm");
            b.innerHTML = ic("trash");
          }
        }, 4000);
      })
  );
  view.querySelectorAll("[data-inv]").forEach(
    b =>
      (b.onclick = async () => {
        const h = S.get("helpers", [])[+b.dataset.inv];
        const msg = tr(
          `Hi ${h.name}, I'm using ScamSense to protect me from scams. I added you as my trusted person, so I may call you before I send money to anyone. Here's the app: https://karimhaidari2.github.io/ScamSense_App/`,
          `Hola ${h.name}, uso ScamSense para protegerme de estafas. Le agregué como mi persona de confianza, así que puedo llamarle antes de enviar dinero a alguien. La app: https://karimhaidari2.github.io/ScamSense_App/`
        );
        try {
          if (navigator.share) {
            await navigator.share({ text: msg });
            return;
          }
        } catch (e) {
          if (e.name === "AbortError") return;
        }
        try {
          await navigator.clipboard.writeText(msg);
          toast(
            tr(
              "Invite message copied. Paste it in a text or email.",
              "Mensaje copiado. Péguelo en un texto o correo."
            )
          );
        } catch (e) {
          toast(msg);
        }
      })
  );
  const save = () => {
    const q = {};
    ["scam", "pause", "sos", "weekly"].forEach(k => (q[k] = document.getElementById("pf_" + k).checked));
    q.callBeforePay = document.getElementById("pcbp").checked;
    S.set("famPrefs", q);
    toast(tr("Saved.", "Guardado."));
  };
  view.querySelectorAll(".switch input").forEach(x => (x.onchange = save));
  bindTeamHelp();
}

/* ----- No one to ask? The ScamSense team can be their helper (only if they turn it on). ----- */
const teamHelp = () => S.get("teamHelp", null) || { on: false, phone: "", time: "" };
const HELP_TIMES = () => [
  ["", tr("Any time", "Cualquier hora")],
  ["morning", tr("Mornings", "Mañanas")],
  ["afternoon", tr("Afternoons", "Tardes")],
  ["evening", tr("Evenings", "Noches")]
];
function teamHelpHTML(hasHelpers) {
  const th = teamHelp();
  const line = (name, num, note) =>
    `<div class="grow"><span class="lead-ic l-blue">${ic("phone")}</span><span class="gl"><b>${name}</b><span>${note}</span></span><a class="btn sm ghost" href="tel:${num.replace(/[^\d+]/g, "")}">${esc(num)}</a></div>`;
  return `<section class="sect" id="teamhelp"><h2 class="sect-h">${hasHelpers ? tr("More help", "Más ayuda") : tr("No one to ask?", "¿No tiene a quién preguntar?")}</h2>
    <div class="group">
      <div class="grow"><span class="lead-ic l-green">${ic("shield")}</span><span class="gl"><b>${tr("Let the ScamSense team be my helper", "Que el equipo de ScamSense sea mi ayuda")}</b><span>${tr("If ScamSense sees danger, like you say you were scammed or you stop a payment, a real person from the team reaches out to you. They see alerts, never your messages.", "Si ScamSense ve peligro, como cuando dice que lo estafaron o detiene un pago, una persona del equipo se comunica con usted. Ven alertas, nunca sus mensajes.")}</span></span>${switchHTML("tmh", th.on, tr("Let the ScamSense team be my helper", "Que el equipo de ScamSense sea mi ayuda"))}</div>
      <div class="tmhform" id="tmhform" ${th.on ? "" : "hidden"}>
        <div class="two"><div class="field"><label for="tmhp">${tr("A phone number we can call (optional)", "Un número al que podamos llamar (opcional)")}</label><input id="tmhp" type="tel" autocomplete="tel" inputmode="tel" maxlength="20" value="${esc(th.phone)}" placeholder="(918) 555-0100"></div>
        <div class="field"><label for="tmht">${tr("Best time to reach you", "Mejor hora para llamarle")}</label><select id="tmht">${HELP_TIMES()
          .map(([k, l]) => `<option value="${k}" ${th.time === k ? "selected" : ""}>${l}</option>`)
          .join("")}</select></div></div>
        <button class="btn primary" id="tmhsave">${tr("Save", "Guardar")}</button>
        <p class="small muted" style="margin:0">${tr("Without a number, the team writes to you in the app and by email.", "Sin número, el equipo le escribe en la app y por correo.")}</p>
      </div>
    </div>
    <p class="sect-h small" style="margin-top:14px">${tr("Free helplines with real people", "Líneas de ayuda gratis con personas reales")}</p>
    <div class="group">
      ${line(tr("National Elder Fraud Hotline", "Línea Nacional de Fraude contra Mayores"), "1-833-372-8311", tr("Ages 60+. Mon–Fri, 10 AM–6 PM Eastern. English, Spanish and more.", "Mayores de 60. Lun–Vie, 10 AM–6 PM hora del Este. Inglés, español y más."))}
      ${line(tr("AARP Fraud Watch Helpline", "Línea de Fraude de AARP"), "877-908-3360", tr("Anyone. Mon–Fri, 8 AM–8 PM Eastern.", "Cualquier persona. Lun–Vie, 8 AM–8 PM hora del Este."))}
    </div></section>`;
}
function bindTeamHelp() {
  const sw = document.getElementById("tmh");
  if (!sw) return;
  const form = document.getElementById("tmhform");
  const store = on => {
    const phone = (document.getElementById("tmhp").value || "").trim();
    if (phone && phone.replace(/\D/g, "").length < 7)
      return toast(tr("Please check the phone number.", "Revise el número de teléfono."));
    S.set("teamHelp", { on, phone: on ? phone : "", time: on ? document.getElementById("tmht").value : "" });
    if (typeof registerSoon === "function") registerSoon();
    return true;
  };
  sw.onchange = () => {
    form.hidden = !sw.checked;
    store(sw.checked);
    toast(
      sw.checked
        ? tr(
            "The ScamSense team will reach out if you're in danger.",
            "El equipo de ScamSense se comunicará si está en peligro."
          )
        : tr("Turned off.", "Desactivado.")
    );
  };
  document.getElementById("tmhsave").onclick = () => {
    if (store(true)) toast(tr("Saved. Thank you.", "Guardado. Gracias."));
  };
}
function showAddForm() {
  const f = document.getElementById("addform");
  f.hidden = false;
  f.innerHTML = `<div class="card addcard"><div class="two"><div class="field"><label for="hn">${t("fam_name")}</label><input id="hn" autocomplete="name"></div>
    <div class="field"><label for="hr">${tr("Relationship", "Relación")}</label><select id="hr">${RELS.map(r => `<option value="${r[0]}">${tr(r[1], r[2])}</option>`).join("")}</select></div></div>
    <div class="two"><div class="field"><label for="hp">${tr("Phone", "Teléfono")}</label><input id="hp" type="tel" inputmode="tel" autocomplete="tel"></div>
    <div class="field"><label for="he">${tr("Email (optional)", "Correo (opcional)")}</label><input id="he" type="email" autocomplete="email"></div></div>
    <div class="row"><button class="btn primary" id="hsave">${tr("Save", "Guardar")}</button><button class="btn ghost" id="hcancel">${tr("Cancel", "Cancelar")}</button></div></div>`;
  document.getElementById("hn").focus();
  document.getElementById("hcancel").onclick = () => {
    f.hidden = true;
    f.innerHTML = "";
  };
  document.getElementById("hsave").onclick = () => {
    const v = id => document.getElementById(id).value.trim();
    if (!v("hn")) {
      toast(tr("Add a name.", "Agregue un nombre."));
      return;
    }
    if (!v("hp") && !v("he")) {
      toast(tr("Add a phone number or email.", "Agregue un teléfono o correo."));
      return;
    }
    const hs = S.get("helpers", []);
    hs.push({ name: v("hn"), rel: v("hr"), phone: v("hp"), email: v("he") });
    S.set("helpers", hs);
    if (typeof registerSoon === "function") registerSoon();
    toast(tr("Added.", "Agregado."));
    renderFamily();
  };
}

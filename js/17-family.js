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
  view.innerHTML = `${pageHead(tr("Family & trusted people", "Familia y personas de confianza"), tr("Pick people you trust. They can help you decide before you pay or reply. They see alerts, never your messages.", "Elija personas de confianza. Pueden ayudarle antes de pagar o responder. Ven alertas, nunca sus mensajes."))}
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
    <p class="footnote">${ic("bell")}${tr("Automatic alerts start when the ScamSense server is ready. For now, use Call or Invite.", "Las alertas automáticas empiezan cuando el servidor esté listo. Por ahora use Llamar o Invitar.")}</p></section>
  <section class="sect"><h2 class="sect-h">${tr("What your trusted person will see", "Lo que verá su persona de confianza")}</h2>
    <div class="phone-preview">
      <div class="alert"><span class="dot d-scam" aria-hidden="true">!</span><div><span class="small muted">${t("fam_t1")}</span><p>${tr("Your mom got a fake PayPal email. ScamSense marked it as a scam. She didn't click it.", "Su mamá recibió un correo falso de PayPal. ScamSense lo marcó como estafa. No hizo clic.")}</p></div></div>
      <div class="alert"><span class="dot d-warn" aria-hidden="true">!</span><div><span class="small muted">${t("fam_t2")}</span><p>${tr("Your mom paused a $500 gift card payment. ScamSense explained it was a tech support scam. Give her a call.", "Su mamá pausó un pago de $500 en tarjetas de regalo. ScamSense explicó que era una estafa de soporte técnico. Llámela.")}</p></div></div>
    </div><p class="footnote">${tr("Sample alerts.", "Alertas de ejemplo.")}</p></section>`;
  document.getElementById("addp").onclick = showAddForm;
  view.querySelectorAll("[data-rm]").forEach(
    b =>
      (b.onclick = () => {
        if (b.dataset.sure) {
          const hs = S.get("helpers", []);
          const gone = hs.splice(+b.dataset.rm, 1)[0];
          S.set("helpers", hs);
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
    toast(tr("Added.", "Agregado."));
    renderFamily();
  };
}

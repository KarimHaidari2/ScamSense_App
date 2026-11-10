/*
 * ScamSense · Plans
 * Plans and prices (no payments in the prototype).
 */
"use strict";

let planYearly = false;
function renderPlans() {
  const p = planYearly
    ? { a: "$99", b: "$159", per: tr("/year", "/año") }
    : { a: "$9.99", b: "$15.99", per: tr("/month", "/mes") };
  const feat = f =>
    `<ul class="ticks ok">${f.map(x => `<li>${ic("check")}<span>${esc(x)}</span></li>`).join("")}</ul>`;
  view.innerHTML = `${pageHead(tr("Plans", "Planes"), tr("First month free. Cancel anytime. Full refund within 30 days.", "Primer mes gratis. Cancele cuando quiera. Reembolso completo en 30 días."), "settings")}
  <div class="seg2" role="group"><button aria-pressed="${!planYearly}" data-y="0">${tr("Monthly", "Mensual")}</button><button aria-pressed="${planYearly}" data-y="1">${tr("Yearly (save 17%)", "Anual (ahorre 17%)")}</button></div>
  <div class="plans">
    <section class="card plan-card"><p class="label">${tr("Personal", "Personal")}</p><p class="price"><b>${p.a}</b><span>${p.per}</span></p>
      ${feat([tr("Daily Safety Report for your email", "Reporte diario de seguridad del correo"), tr("Check texts, calls, and crypto", "Revise textos, llamadas y cripto"), tr("Pause before you pay", "Pause antes de pagar"), tr("I was scammed: recovery plan and documents", "Me estafaron: plan y documentos"), tr("Ask Mahi (AI helper)", "Pregúntele a Mahi (asistente de IA)")])}</section>
    <section class="card plan-card best"><p class="label">${tr("Family", "Familia")} · ${tr("up to 5 people", "hasta 5 personas")}</p><p class="price"><b>${p.b}</b><span>${p.per}</span></p>
      ${feat([tr("Everything in Personal, for each person", "Todo lo de Personal, para cada persona"), tr("Trusted people get alerts", "Las personas de confianza reciben alertas"), tr("Help setting up a parent's phone", "Ayuda para configurar el teléfono de un padre")])}</section>
  </div>
  <p class="footnote">${ic("info")}${tr("This is a prototype. Payments aren't turned on yet.", "Este es un prototipo. Los pagos aún no están activos.")}</p>`;
  bindBack();
  view.querySelectorAll("[data-y]").forEach(
    b =>
      (b.onclick = () => {
        planYearly = b.dataset.y === "1";
        renderPlans();
      })
  );
}

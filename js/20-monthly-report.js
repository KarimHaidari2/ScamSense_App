/*
 * ScamSense · Monthly report
 * The last 30 days on this device and lessons picked for the user.
 */
"use strict";

function monthData() {
  const since = Date.now() - 30 * 864e5;
  const scans = S.get("history", []).filter(h => h.at >= since),
    checks = S.get("checks", []).filter(h => h.at >= since),
    paused = S.get("paused", []).filter(h => h.at >= since);
  const kinds = {};
  const addK = (k, n) => {
    if (k) kinds[k] = (kinds[k] || 0) + (n || 1);
  };
  scans.forEach(h => Object.entries(h.kinds || {}).forEach(([k, n]) => addK(k, n)));
  checks.forEach(c => {
    if (c.level !== "safe") addK(c.kind);
  });
  return {
    scans: scans.length,
    checked: scans.reduce((a, h) => a + h.checked, 0),
    caught: scans.reduce((a, h) => a + h.scam + h.warn, 0) + checks.filter(c => c.level !== "safe").length,
    checks: checks.length,
    paused: paused.length,
    kinds
  };
}
function renderMonthly() {
  const m = monthData();
  const top = Object.entries(m.kinds)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const st = lessonState();
  const L = LESSONS();
  const rec = [
    ...new Set([
      ...top.map(([k]) => KIND_LESSON[k]).filter(Boolean),
      ...L.filter(l => st[l.id] && !st[l.id].correct).map(l => l.id)
    ])
  ]
    .filter(id => !(st[id] && st[id].correct))
    .slice(0, 3);
  view.innerHTML = `${pageHead(tr("Your monthly report", "Su reporte mensual"), tr("The last 30 days on this device.", "Los últimos 30 días en este dispositivo."), "today")}
  <div class="stats">
    <button class="stat" data-st="emails"><b>${m.checked}</b><span>${tr("emails scanned", "correos revisados")}</span>${ic("chev", "chev")}</button>
    <button class="stat" data-st="scams"><b>${m.caught}</b><span>${tr("scams caught", "estafas detectadas")}</span>${ic("chev", "chev")}</button>
    <button class="stat" data-st="check"><b>${m.checks}</b><span>${tr("messages checked", "mensajes revisados")}</span>${ic("chev", "chev")}</button>
    <button class="stat" data-st="pause"><b>${m.paused}</b><span>${tr("payments paused", "pagos detenidos")}</span>${ic("chev", "chev")}</button></div>
  <section class="sect"><h2 class="sect-h">${tr("Scams that reached you most", "Estafas que más le llegaron")}</h2>
    ${top.length ? `<div class="group">${top.map(([k, n]) => `<button class="grow linkrow" data-lesson="${KIND_LESSON[k] || "payment"}"><span class="gl"><b>${esc(cap(TYPES[k] || k))}</b><span>${tr("Learn how to spot it", "Aprenda a reconocerla")}</span></span><span class="badge">${n}</span>${ic("chev", "chev")}</button>`).join("")}</div>` : `<div class="emptybox">${ic("check")}<b>${tr("Nothing yet", "Nada todavía")}</b><span>${tr("Scan your email or check a message, and this fills in.", "Revise su correo o un mensaje y esto se llenará.")}</span></div>`}</section>
  <section class="sect"><h2 class="sect-h">${tr("Your lessons for this month", "Sus lecciones de este mes")}</h2>
    ${
      rec.length
        ? `<div class="group">${rec
            .map(id => {
              const l = L.find(x => x.id === id);
              return `<button class="grow linkrow" data-lesson="${id}"><span class="tile-ic sm t-dev">${ic(l.icon)}</span><span class="gl"><b>${esc(l.title)}</b><span>${tr("Picked for you", "Elegida para usted")}</span></span>${ic("chev", "chev")}</button>`;
            })
            .join("")}</div>`
        : `<button class="tile" data-go="learn"><span class="tile-ic t-dev">${ic("spark")}</span><span class="tile-tx"><b>${tr("All caught up", "Todo al día")}</b><span>${tr("Browse all lessons", "Ver todas las lecciones")}</span></span>${ic("chev", "chev")}</button>`
    }</section>`;
  bindBack();
  view.querySelectorAll("[data-lesson]").forEach(
    b =>
      (b.onclick = () => {
        currentLesson = b.dataset.lesson;
        go("lesson");
      })
  );
  view.querySelectorAll("[data-go]").forEach(b => (b.onclick = () => go(b.dataset.go)));
  // Each number opens what it counts.
  view.querySelectorAll("[data-st]").forEach(
    b =>
      (b.onclick = () => {
        const k = b.dataset.st;
        if (k === "check") return go("check");
        if (k === "pause") return go("pause");
        if (!S.get("report", null)) {
          toast(tr("Scan your email first to see these.", "Primero revise su correo para verlos."));
          return go("today");
        }
        filter = k === "scams" ? "scam" : "all";
        go("emails");
      })
  );
}

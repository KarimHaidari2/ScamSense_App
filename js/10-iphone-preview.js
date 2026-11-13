/*
 * ScamSense · iPhone preview
 * A simulation of how the future iPhone app will catch texts and calls.
 */
"use strict";

/* ----- iPhone preview: shows how the future iPhone app will catch texts and calls (simulation) ----- */
let simTimers = [];
function simClear() {
  simTimers.forEach(clearTimeout);
  simTimers = [];
}
function simAt(ms, fn) {
  simTimers.push(setTimeout(fn, ms));
}
const SIM_TEXTS = {
  toll: {
    from: "+1 (469) 555-0137",
    text: "TxTag: You have an unpaid toll of $4.85. Pay within 24 hours to avoid a $50 fee: https://txtag-tollpay.xyz/pay"
  },
  bank: {
    from: "+1 (213) 555-0199",
    text: "Wells Fargo: Unusual sign-in detected. Your account will be locked. Verify now at https://wellsfargo-secure-login.top"
  },
  safe: {
    from: "+1 (918) 555-0110",
    text: "Hi, this is Dr. Patel's office. Reminder: your appointment is Tuesday at 9:30 AM. Reply C to confirm."
  }
};
const SIM_CALLS = {
  scam: { num: "+1 (800) 555-0144", reports: 132, kind: "label" },
  blocked: { num: "+1 (202) 555-0161", reports: 418, kind: "block" },
  real: { num: "Sara (daughter)", reports: 0, kind: "contact" }
};
function renderPreview() {
  simClear();
  const isText = previewMode !== "call";
  view.innerHTML = `${pageHead(isText ? tr("How texts will be caught", "Cómo se atraparán los textos") : tr("How calls will be caught", "Cómo se atraparán las llamadas"), "", "check")}
  <section class="card"><div class="titlerow"><span class="tag">${tr("iPhone app preview", "Vista previa de la app")}</span></div>
    <p class="muted small" style="margin:0">${tr("This is a simulation of the coming iPhone app. Tap a button and watch what happens on the phone and inside ScamSense.", "Esta es una simulación de la próxima app para iPhone. Toque un botón y vea qué pasa en el teléfono y dentro de ScamSense.")}</p>
    <div class="simbtns">${
      isText
        ? `<button class="chip" data-st="toll">${tr("Scam text: toll", "Texto falso: peaje")}</button><button class="chip" data-st="bank">${tr("Scam text: bank", "Texto falso: banco")}</button><button class="chip" data-st="safe">${tr("Real text: doctor", "Texto real: doctor")}</button>`
        : `<button class="chip" data-sc="scam">${tr("Scam call", "Llamada falsa")}</button><button class="chip" data-sc="blocked">${tr("Known scam number", "Número de estafa conocido")}</button><button class="chip" data-sc="real">${tr("Call from family", "Llamada de familia")}</button>`
    }</div></section>
  <div class="simgrid">
    <div class="phone" aria-live="polite"><div class="notch"></div><div class="screen" id="screen"></div></div>
    <section class="card"><h2>${tr("What ScamSense does", "Qué hace ScamSense")}</h2><ol class="steps2" id="simsteps"><li class="muted">${tr("Tap a button above to start.", "Toque un botón arriba para empezar.")}</li></ol></section>
  </div>
  <section class="card"><h2>${tr("How it works on a real iPhone", "Cómo funciona en un iPhone real")}</h2>
    <ul class="steps">
      ${isText ? `<li><b>${tr("Texts:", "Textos:")}</b> ${tr("Apple lets one app act as a message filter. When a text comes from a number that isn't in your contacts, iPhone asks ScamSense. ScamSense checks it on the phone, and if it isn't sure, asks the AI through the ScamSense server. Scams go to the Junk folder in Messages.", "Apple permite que una app filtre mensajes. Cuando llega un texto de un número que no está en sus contactos, el iPhone le pregunta a ScamSense. ScamSense lo revisa en el teléfono y, si no está seguro, le pregunta a la IA por el servidor de ScamSense. Las estafas van a la carpeta de basura de Mensajes.")}</li>` : ""}
      ${!isText ? `<li><b>${tr("Calls:", "Llamadas:")}</b> ${tr('ScamSense gives iPhone a list of reported scam numbers. iPhone shows "Scam Likely – ScamSense" when one calls, or blocks it. The list updates every day.', 'ScamSense le da al iPhone una lista de números de estafa reportados. El iPhone muestra "Posible estafa – ScamSense" cuando llaman, o los bloquea. La lista se actualiza cada día.')}</li>` : ""}
      <li><b>${tr("Turn it on once:", "Actívelo una vez:")}</b> ${tr("Settings → Apps → Messages → Unknown & Spam → ScamSense, and Settings → Apps → Phone → Call Blocking & Identification → ScamSense.", "Configuración → Apps → Mensajes → Desconocidos y spam → ScamSense, y Configuración → Apps → Teléfono → Bloqueo e identificación → ScamSense.")}</li>
      <li><b>${tr("Apple's limits:", "Límites de Apple:")}</b> ${tr("no app can read texts from your contacts or iMessages, listen to calls, or read call history. For those, use the Check tab.", "ninguna app puede leer textos de sus contactos ni iMessages, escuchar llamadas ni leer el historial. Para eso use la pestaña Revisar.")}</li>
    </ul></section>`;
  bindBack();
  view.querySelectorAll("[data-st]").forEach(b => (b.onclick = () => simText(b.dataset.st)));
  view.querySelectorAll("[data-sc]").forEach(b => (b.onclick = () => simCall(b.dataset.sc)));
  homeScreen();
}
function homeScreen() {
  const sc = document.getElementById("screen");
  if (!sc) return;
  const now = new Date();
  sc.className = "screen home";
  sc.innerHTML = `<div class="sb"><span>${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span><span>▮▮▮ 5G</span></div>
  <div class="lock-time">${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M/i, "")}</div><div class="lock-date">${now.toLocaleDateString(uiLang() === "es" ? "es-US" : "en-US", { weekday: "long", month: "long", day: "numeric" })}</div><div id="notifs" class="notifs"></div>`;
}
function stepsInit(items) {
  const ol = document.getElementById("simsteps");
  ol.innerHTML = items.map((x, i) => `<li id="st${i}" class="pending">${x}</li>`).join("");
}
function stepOn(i, extra, cls) {
  const li = document.getElementById("st" + i);
  if (!li) return;
  li.className = cls || "done";
  if (extra) li.insertAdjacentHTML("beforeend", `<div class="stepx">${extra}</div>`);
}
function simText(k) {
  simClear();
  homeScreen();
  const m = SIM_TEXTS[k];
  const r = analyze({ text: m.text, links: [], attachments: [], subject: "" });
  const lvl = r.level;
  stepsInit([
    tr(
      "A text arrives from a number not in your contacts.",
      "Llega un texto de un número que no está en sus contactos."
    ),
    tr("iPhone asks ScamSense: is this junk?", "El iPhone le pregunta a ScamSense: ¿es basura?"),
    tr("ScamSense checks it on the phone.", "ScamSense lo revisa en el teléfono."),
    tr(
      "If it's not sure, the AI double-checks it through the ScamSense server.",
      "Si no está seguro, la IA lo revisa por el servidor de ScamSense."
    ),
    tr("iPhone puts it in the right place.", "El iPhone lo pone en el lugar correcto.")
  ]);
  const sc = document.getElementById("screen");
  simAt(300, () => {
    stepOn(0, `<span class="mono">${esc(m.from)}</span>`);
    document.getElementById("notifs").innerHTML =
      `<div class="notif in"><b>💬 ${esc(m.from)}</b><span>${tr("Checking with ScamSense…", "Revisando con ScamSense…")}</span></div>`;
  });
  simAt(1100, () => stepOn(1));
  simAt(1900, () =>
    stepOn(
      2,
      r.reasons.length
        ? `<ul>${r.reasons
            .slice(0, 3)
            .map(x => `<li>${esc(x)}</li>`)
            .join("")}</ul>`
        : tr("No warning signs found.", "No se encontraron señales de alerta.")
    )
  );
  simAt(2700, () =>
    stepOn(
      3,
      lvl === "warn"
        ? tr("AI checked it: suspicious.", "La IA lo revisó: sospechoso.")
        : tr(
            "Not needed: the on-device check was sure.",
            "No hizo falta: la revisión en el teléfono estaba segura."
          ),
      lvl === "warn" ? "done" : "skip"
    )
  );
  simAt(3500, () => {
    const junk = lvl !== "safe";
    stepOn(
      4,
      junk
        ? `<b class="red">${tr("Moved to Junk. No sound, no alert.", "Movido a Basura. Sin sonido ni alerta.")}</b>`
        : `<b class="green">${tr("Delivered normally.", "Entregado normalmente.")}</b>`
    );
    sc.className = "screen app";
    sc.innerHTML = `<div class="sb"><span>${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span><span>▮▮▮ 5G</span></div>
      <div class="msg-head"><b>${tr("Messages", "Mensajes")}</b></div>
      <div class="msg-tabs"><span class="${junk ? "" : "on"}">${tr("Known", "Conocidos")}</span><span>${tr("Unknown", "Desconocidos")}</span><span class="${junk ? "on" : ""}">${tr("Junk", "Basura")}${junk ? " · 1" : ""}</span></div>
      <div class="msg-row ${junk ? "junk" : ""}"><div class="av">${junk ? "!" : "✓"}</div><div><b>${esc(m.from)}</b><span>${esc(m.text)}</span>
      ${junk ? `<em class="ss-tag">ScamSense: ${esc(cap(r.kind || tr("scam", "estafa")))}</em>` : `<em class="ss-tag ok">ScamSense: ${tr("looks safe", "parece seguro")}</em>`}</div></div>
      ${junk ? `<div class="msg-note">${tr("Links in Junk are turned off. You can still read it.", "Los enlaces en Basura están desactivados. Aún puede leerlo.")}</div>` : ""}`;
  });
}
function simCall(k) {
  simClear();
  homeScreen();
  const c = SIM_CALLS[k];
  const sc = document.getElementById("screen");
  stepsInit([
    tr("A call is coming in.", "Está entrando una llamada."),
    tr(
      "iPhone looks up the number in ScamSense's list on the phone (no call audio is shared).",
      "El iPhone busca el número en la lista de ScamSense en el teléfono (no se comparte el audio)."
    ) + "",
    tr("iPhone shows a label or blocks the call.", "El iPhone muestra una etiqueta o bloquea la llamada."),
    tr("ScamSense adds it to your Daily Safety Report.", "ScamSense lo agrega a su Reporte diario.")
  ]);
  simAt(300, () => stepOn(0, `<span class="mono">${esc(c.num)}</span>`));
  simAt(1100, () =>
    stepOn(
      1,
      c.kind === "contact"
        ? tr("In your contacts. Not checked.", "En sus contactos. No se revisa.")
        : tr(
            `Found: reported ${c.reports} times as a scam. Line type: internet number from a free calling app (auto-generated, not tied to a real person).`,
            `Encontrado: reportado ${c.reports} veces como estafa. Tipo de línea: número de internet de una app gratuita (generado automáticamente, no pertenece a una persona real).`
          )
    )
  );
  simAt(1900, () => {
    if (c.kind === "block") {
      stepOn(
        2,
        `<b class="red">${tr("Blocked. Your phone didn't ring.", "Bloqueada. Su teléfono no sonó.")}</b>`
      );
      document.getElementById("notifs").innerHTML =
        `<div class="notif in"><b>🚫 ScamSense</b><span>${tr(`Blocked a call from ${c.num} (known scam number).`, `Bloqueó una llamada de ${c.num} (número de estafa conocido).`)}</span></div>`;
      return;
    }
    stepOn(
      2,
      c.kind === "label"
        ? `<b class="red">${tr('Labeled "Scam Likely – ScamSense".', 'Etiquetada "Posible estafa – ScamSense".')}</b>`
        : `<b class="green">${tr("Rings normally.", "Suena normalmente.")}</b>`
    );
    sc.className = "screen call";
    sc.innerHTML = `<div class="sb light"><span>${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span><span>▮▮▮ 5G</span></div>
      <div class="call-top">${c.kind === "label" ? `<div class="call-warn">⚠️ ${tr("Scam Likely – ScamSense", "Posible estafa – ScamSense")}</div>` : ""}<div class="call-num">${esc(c.num)}</div><div class="call-sub">${c.kind === "label" ? tr(`Reported ${c.reports} times`, `Reportado ${c.reports} veces`) : tr("mobile", "móvil")}</div></div>
      <div class="call-btns"><div><span class="cb decline">✕</span><small>${tr("Decline", "Rechazar")}</small></div><div><span class="cb accept">✆</span><small>${tr("Accept", "Aceptar")}</small></div></div>`;
  });
  simAt(2900, () =>
    stepOn(
      3,
      c.kind === "contact"
        ? tr("Not added: it's a contact.", "No se agrega: es un contacto.")
        : tr('"1 scam call caught today."', '"1 llamada de estafa detectada hoy."'),
      c.kind === "contact" ? "skip" : "done"
    )
  );
}

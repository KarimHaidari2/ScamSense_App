/*
 * ScamSense · Talk to the ScamSense team
 * A real person on the ScamSense team answers here, with words and photos. Messages go to the ScamSense
 * server (the team's private spreadsheet and a private Drive folder), never anywhere else.
 * A conversation also opens by itself when someone says they were scammed, so the team can reach out.
 * An email is only shared with the team when the person taps "Send to the ScamSense team" and confirms.
 */
"use strict";

let supportCase = null; // { id, status, reason, priority }
let supportMsgs = [];
let supportTimer = null;
let supportReason = "person"; // why this conversation started: person, scammed, email
let supportEmail = null; // an email the person chose to share (waits for "Share it")
let supportPhoto = ""; // a photo waiting to be sent (data URL)
const supportPhotoCache = {}; // photo id → picture, so each one downloads once
let supportViewId = ""; // looking at one past case (by its case number)
let supportFresh = false; // "Start a new chat": don't show the ended one

/* Opens the conversation, optionally with a reason and an email to share. */
function openSupport(reason, email) {
  supportReason = reason || "person";
  supportEmail = email || null;
  go("support");
}

/* An email from the inbox list, in the shape the team sees (only what's needed to help). */
function emailForTeam(it) {
  return {
    from: [it.fromName, it.fromEmail ? "<" + it.fromEmail + ">" : ""].filter(Boolean).join(" "),
    subject: it.subject || "",
    date: it.date ? new Date(it.date).toLocaleString() : "",
    verdict: it.level || "",
    reasons: ((it.local && it.local.reasons) || []).slice(0, 6),
    text: String(it.text || it.snippet || "").slice(0, 8000)
  };
}

/* What the person sees for the notes ScamSense adds by itself. */
function systemText(s) {
  s = String(s || "").replace(/\s*\(ScamSense opened this case by itself\)/, "");
  const map = [
    [
      /^Asked to talk to a person/,
      tr(
        "You asked to talk to a person. Someone from the ScamSense team will answer here.",
        "Pidió hablar con una persona. Alguien del equipo de ScamSense le responderá aquí."
      )
    ],
    [
      /^Said they were scammed/,
      tr(
        "You said you were scammed. The ScamSense team has been told and will reach out here.",
        "Dijo que le estafaron. El equipo de ScamSense ya lo sabe y le escribirá aquí."
      )
    ],
    [
      /^Said they already paid/,
      tr(
        "You said you already paid someone who may be a scammer. The ScamSense team has been told.",
        "Dijo que ya le pagó a alguien que puede ser un estafador. El equipo de ScamSense ya lo sabe."
      )
    ],
    [
      /^Was about to pay a scammer/,
      tr(
        "ScamSense stopped a payment that looked like a scam. The ScamSense team has been told.",
        "ScamSense detuvo un pago que parecía una estafa. El equipo de ScamSense ya lo sabe."
      )
    ],
    [
      /^Shared an email/,
      tr("You shared an email with the ScamSense team.", "Compartió un correo con el equipo de ScamSense.")
    ],
    [
      /^The person ended the chat/,
      tr(
        "You ended this chat. Keep your case number so the team can find it later.",
        "Usted terminó este chat. Guarde su número de caso para que el equipo lo encuentre después."
      )
    ],
    [
      /^The person came back to this case/,
      tr(
        "You came back to this case. The team can see everything from before.",
        "Volvió a este caso. El equipo puede ver todo lo anterior."
      )
    ],
    [
      /^The person went back to case/,
      s.replace(/^The person went back to case/, tr("You went back to case", "Volvió al caso"))
    ],
    [
      /^The ScamSense team closed/,
      tr(
        "The ScamSense team closed this conversation. If you need anything else, just write here.",
        "El equipo de ScamSense cerró esta conversación. Si necesita algo más, escriba aquí."
      )
    ]
  ];
  const hit = map.find(([re]) => re.test(s));
  return hit ? hit[1] : s;
}

function supportBubble(m) {
  const time = m.t ? `<small class="stime">${esc(fmtTime(m.t))}</small>` : "";
  const photo = m.photo
    ? `<img class="chatimg" data-photo="${esc(m.photo)}" alt="${esc(tr("Photo", "Foto"))}" ${supportPhotoCache[m.photo] ? `src="${supportPhotoCache[m.photo]}"` : ""}>`
    : "";
  if (m.from === "system") return `<p class="sysmsg" dir="auto">${esc(systemText(m.text))}</p>`;
  if (m.from === "email" && m.email)
    return `<div class="bubble me sharedmail"><b>${esc(tr("Email you shared", "Correo que compartió"))}</b><span>${esc(m.email.from || "")}</span><span>${esc(m.email.subject || "")}</span>${time}</div>`;
  if (m.from === "owner")
    return `<div class="bubble ai" dir="auto"><b class="who">${esc(tr("ScamSense team", "Equipo de ScamSense"))}</b>${m.text ? esc(m.text) : ""}${photo}${time}</div>`;
  return `<div class="bubble me" dir="auto">${m.text ? esc(m.text) : ""}${photo}${time}</div>`;
}

function renderSupport() {
  const on = serverOn();
  view.innerHTML = `${pageHead(tr("Talk to the ScamSense team", "Hable con el equipo de ScamSense"), tr("A real person reads every message and answers here.", "Una persona real lee cada mensaje y responde aquí."), "today")}
  <section class="chat card">
    ${
      on
        ? `<div id="supcase"></div>
    <div class="chatlog" id="suplog" aria-live="polite"></div>
    <div id="supshare"></div>
    <div class="samples" id="supstart" hidden>${[
      ["scammed", tr("I think I was scammed", "Creo que me estafaron")],
      ["person", tr("I got a message I'm not sure about", "Recibí un mensaje que me preocupa")],
      ["person", tr("I have a question", "Tengo una pregunta")]
    ]
      .map(([r, q]) => `<button class="chip" data-r="${r}" data-q="${esc(q)}">${esc(q)}</button>`)
      .join("")}</div>
    <div id="suppending" hidden></div>
    <div id="supname"></div>
    <div class="composer">
      <textarea id="supin" dir="auto" rows="1" placeholder="${esc(tr("Write a message…", "Escriba un mensaje…"))}"></textarea>
      <button class="btn primary sendbtn" id="supgo" aria-label="${esc(tr("Send", "Enviar"))}">${ic("send")}</button>
    </div>
    <div class="chattools">
      <label class="ctool">${ic("camera")}<span>${tr("Add a photo", "Agregar una foto")}</span><input id="supfile" type="file" accept="image/*" hidden></label>
      ${canListenHere() ? `<button class="ctool" id="supmic" aria-pressed="false">${ic("mic")}<span>${tr("Say it", "Dígalo")}</span></button>` : ""}
    </div>
    <p class="footnote small">${ic("lock")}<span>${tr("Only the ScamSense team sees this conversation. Never send a password, a full card number, or a code someone texted you.", "Solo el equipo de ScamSense ve esta conversación. Nunca envíe una contraseña, un número de tarjeta completo o un código que le enviaron.")}</span></p>
    <details class="pastcases" id="suppast"><summary>${tr("Your past cases", "Sus casos anteriores")}</summary><div id="suppastlist"><p class="small muted">${tr("Loading…", "Cargando…")}</p></div></details>`
        : `<p>${tr('Talking to the team needs the ScamSense server. Turn on "Your account" in Settings, or ask Mahi for now.', 'Hablar con el equipo necesita el servidor de ScamSense. Active "Su cuenta" en Ajustes, o pregúntele a Mahi por ahora.')}</p><button class="btn primary" data-go="helper">${tr("Ask Mahi", "Pregúntele a Mahi")}</button>`
    }
  </section>`;
  bindBack();
  bindGo(view);
  if (!on) return;
  const inp = document.getElementById("supin");
  const grow = () => {
    inp.style.height = "auto";
    inp.style.height = Math.min(inp.scrollHeight, 140) + "px";
  };
  inp.oninput = grow;
  inp.onkeydown = e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      supportSend();
    }
  };
  document.getElementById("supgo").onclick = () => supportSend();
  const mic = document.getElementById("supmic");
  if (mic) mic.onclick = () => toggleListening("supin", "supmic", grow, () => {});
  document.getElementById("supfile").onchange = async e => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      supportPhoto = await shrinkPhoto(f);
      drawPending();
    } catch (err) {
      toast(
        tr(
          "That photo couldn't be opened. Try a screenshot instead.",
          "No se pudo abrir esa foto. Pruebe con una captura."
        )
      );
    }
  };
  view.querySelectorAll("#supstart [data-q]").forEach(
    b =>
      (b.onclick = () => {
        supportReason = b.dataset.r;
        inp.value = b.dataset.q + ". ";
        grow();
        inp.focus();
      })
  );
  drawNameBox();
  document.getElementById("suppast").ontoggle = e => e.target.open && drawPastCases();
  drawShare();
  drawPending();
  drawSupport();
  drawCaseBar();
  supportPoll();
  clearInterval(supportTimer);
  supportTimer = setInterval(() => {
    if (!document.getElementById("suplog")) return clearInterval(supportTimer);
    if (!document.hidden) supportPoll();
  }, 8000);
}

/* The email waiting to be shared: the person decides. */
function drawShare() {
  const box = document.getElementById("supshare");
  if (!box) return;
  const e = supportEmail;
  box.innerHTML = e
    ? `<div class="sharebox"><p><b>${tr("Share this email with the ScamSense team?", "¿Compartir este correo con el equipo de ScamSense?")}</b></p>
      <p class="small">${esc(e.from)}<br>${esc(e.subject)}</p>
      <p class="small muted">${tr("The team will see who sent it, the subject, and what it says, so they can check it for you.", "El equipo verá quién lo envió, el asunto y lo que dice, para revisarlo por usted.")}</p>
      <div class="row"><button class="btn primary sm" id="shareyes">${tr("Share it", "Compartirlo")}</button><button class="btn ghost sm" id="shareno">${tr("Don't share", "No compartir")}</button></div></div>`
    : "";
  if (!e) return;
  document.getElementById("shareyes").onclick = () => supportSend({ email: e, reason: "email" });
  document.getElementById("shareno").onclick = () => {
    supportEmail = null;
    drawShare();
  };
}
function drawPending() {
  const box = document.getElementById("suppending");
  if (!box) return;
  box.hidden = !supportPhoto;
  box.innerHTML = supportPhoto
    ? `<div class="pendingphoto"><img src="${supportPhoto}" alt="${esc(tr("Photo to send", "Foto para enviar"))}"><button class="linkbtn" id="nophoto">${tr("Remove", "Quitar")}</button></div>`
    : "";
  if (supportPhoto) document.getElementById("nophoto").onclick = () => ((supportPhoto = ""), drawPending());
}
let supportDrawn = "";
function drawSupport() {
  const log = document.getElementById("suplog");
  if (!log) return;
  const hello = {
    from: "owner",
    text: tr(
      "Hi! This is the ScamSense team. Tell us what's going on, and send a photo or screenshot if you have one. We'll answer here.",
      "¡Hola! Somos el equipo de ScamSense. Cuéntenos qué pasa, y envíe una foto o captura si tiene. Le responderemos aquí."
    )
  };
  const list = supportMsgs.length ? supportMsgs : [hello];
  const key = JSON.stringify(list.map(m => [m.t, m.from, m.text, m.photo]));
  document.getElementById("supstart").hidden = !!supportMsgs.length || !!supportEmail;
  if (key === supportDrawn) return;
  supportDrawn = key;
  log.innerHTML = list.map(supportBubble).join("");
  log.querySelectorAll("img[data-photo]:not([src])").forEach(loadSupportPhoto);
  log.scrollTop = log.scrollHeight;
}
async function loadSupportPhoto(img) {
  const id = img.dataset.photo;
  try {
    if (!supportPhotoCache[id]) {
      const j = await serverPost({ mode: "support", action: "photo", id });
      if (!j.ok) return;
      supportPhotoCache[id] = j.data;
    }
    img.src = supportPhotoCache[id];
    img.onclick = () => window.open(img.src, "_blank");
  } catch (e) {}
}

/* The case number, and what the person can do with this conversation. */
function drawCaseBar() {
  const box = document.getElementById("supcase");
  if (!box) return;
  const c = supportCase;
  if (!c || supportFresh) {
    box.innerHTML = "";
    return;
  }
  const open = c.status !== "closed";
  box.innerHTML = `<div class="casebar"><span>${tr("Case number", "Número de caso")} <b>${esc(c.id)}</b> · ${open ? tr("Open", "Abierto") : tr("Ended", "Terminado")}</span><span class="row">${
    open
      ? `<button class="ctool" id="supend">${tr("End chat", "Terminar chat")}</button>`
      : `<button class="ctool" id="supagain">${tr("Continue this case", "Continuar este caso")}</button><button class="ctool" id="supnew">${tr("Start a new chat", "Empezar un chat nuevo")}</button>`
  }</span></div><div id="supconfirm"></div>`;
  if (open)
    document.getElementById("supend").onclick = () => {
      document.getElementById("supconfirm").innerHTML =
        `<div class="sharebox"><p><b>${tr("End this chat?", "¿Terminar este chat?")}</b></p><p class="small">${tr("Your case number is", "Su número de caso es")} <b>${esc(c.id)}</b>. ${tr("If you need help with this again, tap Your past cases, or give the team this number.", "Si necesita ayuda con esto otra vez, toque Sus casos anteriores, o dele este número al equipo.")}</p><div class="row"><button class="btn primary sm" id="supendgo">${tr("End chat", "Terminar chat")}</button><button class="btn ghost sm" id="supendno">${tr("Keep talking", "Seguir hablando")}</button></div></div>`;
      document.getElementById("supendno").onclick = () =>
        (document.getElementById("supconfirm").innerHTML = "");
      document.getElementById("supendgo").onclick = async () => {
        try {
          supportApply(await serverPost({ mode: "support", action: "end" }));
          toast(tr("Chat ended. Your case number is ", "Chat terminado. Su número de caso es ") + c.id);
        } catch (e) {
          toast(tr("That didn't work. Try again.", "No funcionó. Intente de nuevo."));
        }
      };
    };
  else {
    document.getElementById("supagain").onclick = async () => {
      try {
        const j = await serverPost({ mode: "support", action: "reopen", caseId: c.id });
        if (!j.ok) throw new Error(j.error);
        supportViewId = "";
        supportDrawn = "";
        supportApply(j);
        document.getElementById("supin").focus();
      } catch (e) {
        toast(e.message || tr("That didn't work. Try again.", "No funcionó. Intente de nuevo."));
      }
    };
    document.getElementById("supnew").onclick = () => {
      supportFresh = true;
      supportViewId = "";
      supportMsgs = [];
      supportDrawn = "";
      drawSupport();
      drawCaseBar();
      document.getElementById("supin").focus();
    };
  }
}
async function drawPastCases() {
  const box = document.getElementById("suppastlist");
  try {
    const j = await serverPost({ mode: "support", action: "history" });
    if (!j.ok) throw new Error(j.error);
    box.innerHTML = j.cases.length
      ? `<ul class="pastlist">${j.cases
          .map(
            c =>
              `<li><button data-case="${esc(c.id)}"><b>${esc(c.id)}</b><span>${esc(systemText(c.reason).split(".")[0])} · ${esc(new Date(c.opened).toLocaleDateString())} · ${c.status === "closed" ? tr("Ended", "Terminado") : tr("Open", "Abierto")}</span></button></li>`
          )
          .join("")}</ul>`
      : `<p class="small muted">${tr("No past cases yet.", "Aún no hay casos anteriores.")}</p>`;
    box.querySelectorAll("[data-case]").forEach(
      b =>
        (b.onclick = () => {
          supportViewId = b.dataset.case;
          supportFresh = false;
          supportDrawn = "";
          supportPoll();
          document.getElementById("suppast").open = false;
          document.getElementById("supcase").scrollIntoView({ behavior: "smooth", block: "start" });
        })
    );
  } catch (e) {
    box.innerHTML = `<p class="small muted">${tr("Couldn't load your past cases.", "No se pudieron cargar sus casos.")}</p>`;
  }
}

function supportApply(j) {
  if (!j || !j.ok) return;
  if (supportFresh && j.case && j.case.status === "closed") return; // they chose to start a new chat
  supportFresh = false;
  supportCase = j.case;
  supportMsgs = j.messages || [];
  const lastTeam = [...supportMsgs].reverse().find(m => m.from === "owner");
  if (lastTeam && document.getElementById("suplog")) S.set("sup_seen", lastTeam.t);
  if (supportCase) S.set("sup_on", true);
  drawSupport();
  drawCaseBar();
}
async function supportPoll() {
  try {
    supportApply(
      await serverPost(
        supportViewId
          ? { mode: "support", action: "view", caseId: supportViewId }
          : { mode: "support", action: "poll" }
      )
    );
  } catch (e) {}
}
/* No name yet? Ask before the first message, so the team knows who's writing. */
function drawNameBox() {
  const box = document.getElementById("supname");
  if (!box) return;
  const c = cfg();
  box.innerHTML = haveName()
    ? ""
    : `<div class="sharebox"><p><b>${tr("To get started, please type your first and last name.", "Para empezar, escriba su nombre y apellido.")}</b></p><div class="namerow"><input id="supfirst" autocomplete="given-name" maxlength="30" placeholder="${esc(tr("First name", "Nombre"))}" aria-label="${esc(tr("First name", "Nombre"))}" value="${esc(c.name || "")}"><input id="suplast" autocomplete="family-name" maxlength="30" placeholder="${esc(tr("Last name", "Apellido"))}" aria-label="${esc(tr("Last name", "Apellido"))}" value="${esc(c.lastName || "")}"></div></div>`;
}
let supportBusy = false;
async function supportSend(extra) {
  extra = extra || {};
  const inp = document.getElementById("supin");
  const text = (inp ? inp.value : "").trim();
  if (supportBusy || (!text && !supportPhoto && !extra.email)) return;
  if (!haveName()) {
    const f = document.getElementById("supfirst"),
      l = document.getElementById("suplast");
    const fv = f ? f.value.trim() : "",
      lv = l ? l.value.trim() : "";
    if (!fv || !lv) {
      if (!f) drawNameBox();
      toast(tr("Please type your first and last name first.", "Primero escriba su nombre y apellido."));
      const empty = document.getElementById(fv ? "suplast" : "supfirst");
      if (empty) empty.focus();
      return;
    }
    saveCfg(Object.assign(cfg(), { name: fv.slice(0, 30), lastName: lv.slice(0, 30) }));
    drawNameBox();
    await registerUser();
  }
  await knowWho();
  stopListening();
  supportBusy = true;
  const btn = document.getElementById("supgo");
  btn.disabled = true;
  const reason = extra.reason || (supportCase && supportCase.status !== "closed" ? "" : supportReason);
  const body = {
    mode: "support",
    action: "send",
    text,
    reason,
    name: cfg().name || "",
    lastName: cfg().lastName || ""
  };
  if (supportPhoto) body.photo = supportPhoto;
  if (extra.email) body.email = extra.email;
  // Show it right away; the server's copy replaces it.
  supportMsgs = supportMsgs.concat(
    extra.email ? [{ from: "email", email: extra.email }] : [],
    text || supportPhoto ? [{ from: "user", text, t: new Date().toISOString() }] : []
  );
  drawSupport();
  try {
    const j = await serverPost(body);
    if (!j.ok) throw new Error(j.error || "");
    if (inp) inp.value = "";
    supportPhoto = "";
    if (extra.email) supportEmail = null;
    supportReason = "person";
    supportViewId = ""; // the message went to their open (or a new) case
    supportFresh = false;
    drawShare();
    drawPending();
    supportApply(j);
  } catch (e) {
    supportDrawn = "";
    supportMsgs = supportMsgs.filter(m => m.t || m.from !== "email");
    supportPoll();
    toast(
      e.message ||
        tr(
          "That didn't send. Check your internet and try again.",
          "No se envió. Revise su internet e intente de nuevo."
        )
    );
  }
  supportBusy = false;
  btn.disabled = false;
}

/* Makes a photo small enough to send quickly (longest side 1600 px). */
function shrinkPhoto(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rej(new Error("bad image"));
    };
    img.src = url;
  });
}

/* When the team answers while the person is somewhere else in the app, a banner says so. */
async function supportCheck() {
  if (!serverOn() || !S.get("sup_on", false) || document.hidden || document.getElementById("suplog")) return;
  const inMahi = !!S.get("mahi_live", null); // the team is talking inside the Mahi chat
  if (inMahi && document.getElementById("chatlog")) return; // the Mahi chat shows it already
  try {
    const j = await serverPost({ mode: "support", action: "poll" });
    if (!j.ok || !j.case) return;
    const last = [...(j.messages || [])].reverse().find(m => m.from === "owner");
    if (!last || last.t <= S.get("sup_seen", "")) return;
    let b = document.getElementById("supbanner");
    if (!b) {
      b = document.createElement("button");
      b.id = "supbanner";
      b.className = "supbanner";
      document.body.appendChild(b);
    }
    b.innerHTML = `${ic("msg")}<span><b>${tr("The ScamSense team answered you", "El equipo de ScamSense le respondió")}</b><span>${esc(String(last.text || tr("They sent a photo.", "Le enviaron una foto.")).slice(0, 90))}</span></span>`;
    b.onclick = () => {
      b.remove();
      go(inMahi ? "helper" : "support");
    };
  } catch (e) {}
}
setTimeout(supportCheck, 4000);
setInterval(supportCheck, 90000);
document.addEventListener("visibilitychange", () => document.hidden || supportCheck());

/*
 * ScamSense · Clean up my info
 * Scammers get your name, phone, and home address from "people-search" sites and data brokers.
 * This screen helps you find yourself on the biggest ones, ask each one to remove you (always free),
 * check back later (some add you again), check your email for data leaks, and turn on the free
 * protections that cut scam calls and mail. Your checklist stays on this device only.
 */
"use strict";

/* The sites. `search` is where to look yourself up (null: the removal page has its own search).
   `days` is about how long a removal takes. Links checked Nov 2026; sites change them sometimes. */
const CLEANUP_SITES = [
  {
    id: "whitepages",
    name: "Whitepages",
    search: "https://www.whitepages.com/",
    remove: "https://www.whitepages.com/suppression-requests",
    days: 3,
    how: () =>
      tr(
        "Find your listing, copy its web address, paste it on the removal page. Whitepages calls your phone with a code to confirm.",
        "Busque su ficha, copie su dirección web y péguela en la página de eliminación. Whitepages llama a su teléfono con un código para confirmar."
      )
  },
  {
    id: "peopleconnect",
    name: "Intelius, TruthFinder, Instant Checkmate",
    also: () =>
      tr(
        "One request also covers US Search, ZabaSearch, AnyWho, and more sites owned by the same company.",
        "Una solicitud también cubre US Search, ZabaSearch, AnyWho y otros sitios de la misma empresa."
      ),
    search: null,
    remove: "https://suppression.peopleconnect.us/login",
    days: 3,
    how: () =>
      tr(
        "Enter your email to get a link, search your name, and choose each listing that is you.",
        "Escriba su correo para recibir un enlace, busque su nombre y elija cada ficha que sea usted."
      )
  },
  {
    id: "spokeo",
    name: "Spokeo",
    search: "https://www.spokeo.com/",
    remove: "https://www.spokeo.com/optout",
    days: 3,
    how: () =>
      tr(
        "Find your listing, copy its web address, paste it on the removal page with your email, then click the link Spokeo emails you.",
        "Busque su ficha, copie su dirección web, péguela en la página de eliminación con su correo y abra el enlace que Spokeo le envía."
      )
  },
  {
    id: "beenverified",
    name: "BeenVerified",
    search: null,
    remove: "https://www.beenverified.com/app/optout/search",
    days: 3,
    how: () =>
      tr(
        "Search your name and state, pick your listing, and confirm with the link they email you.",
        "Busque su nombre y estado, elija su ficha y confirme con el enlace que le envían por correo."
      )
  },
  {
    id: "truepeoplesearch",
    name: "TruePeopleSearch",
    search: null,
    remove: "https://www.truepeoplesearch.com/removal",
    days: 3,
    how: () =>
      tr(
        "Agree to the terms, search your name and city, open your listing, and press the remove button.",
        "Acepte los términos, busque su nombre y ciudad, abra su ficha y presione el botón para eliminarla."
      )
  },
  {
    id: "fastpeoplesearch",
    name: "FastPeopleSearch",
    search: null,
    remove: "https://www.fastpeoplesearch.com/removal",
    days: 3,
    how: () =>
      tr(
        "Search your name and city, open your listing, and press the remove button. Confirm with the email they send.",
        "Busque su nombre y ciudad, abra su ficha y presione el botón para eliminarla. Confirme con el correo que le envían."
      )
  },
  {
    id: "peoplefinders",
    name: "PeopleFinders",
    search: "https://www.peoplefinders.com/",
    remove: "https://www.peoplefinders.com/opt-out",
    days: 9,
    how: () =>
      tr(
        "Fill in the removal form with the name and address on your listing, then confirm by email.",
        "Llene el formulario con el nombre y la dirección de su ficha y confirme por correo."
      )
  },
  {
    id: "cyberbackgroundchecks",
    name: "CyberBackgroundChecks",
    search: null,
    remove: "https://www.cyberbackgroundchecks.com/removal",
    days: 3,
    how: () =>
      tr(
        "Search your name first, open your listing, then press the remove button.",
        "Primero busque su nombre, abra su ficha y presione el botón para eliminarla."
      )
  },
  {
    id: "thatsthem",
    name: "That'sThem",
    search: "https://thatsthem.com/",
    remove: "https://thatsthem.com/optout",
    days: 7,
    how: () =>
      tr(
        "Fill in the form with the name, address, and phone on your listing.",
        "Llene el formulario con el nombre, la dirección y el teléfono de su ficha."
      )
  },
  {
    id: "searchpeoplefree",
    name: "SearchPeopleFree",
    search: null,
    remove: "https://www.searchpeoplefree.com/opt-out",
    days: 3,
    how: () =>
      tr(
        "Enter your email, search your name, and pick each listing that is you.",
        "Escriba su correo, busque su nombre y elija cada ficha que sea usted."
      )
  },
  {
    id: "familytreenow",
    name: "FamilyTreeNow",
    search: null,
    remove: "https://www.familytreenow.com/optout",
    days: 3,
    how: () =>
      tr(
        "Search your name, open your record, and press the button to opt out.",
        "Busque su nombre, abra su registro y presione el botón para darse de baja."
      )
  },
  {
    id: "acxiom",
    name: "Acxiom",
    direct: true,
    remove: "https://www.acxiom.com/optout/",
    days: 30,
    how: () =>
      tr(
        "A big marketing data company. It has no public listing to find, so just send the opt-out form.",
        "Una gran empresa de datos de mercadeo. No tiene fichas públicas, así que solo envíe el formulario."
      )
  }
];

/* Free steps that cut scam calls, texts, and mail. */
const CLEANUP_STEPS = [
  {
    id: "dnc",
    title: () => tr("Join the Do Not Call list", "Inscríbase en la lista No Llame"),
    body: () =>
      tr(
        "Free, from the government. Real companies must stop sales calls within 31 days. Scammers ignore it, so any sales call after that is a red flag.",
        "Gratis, del gobierno. Las empresas reales deben dejar de llamarle en 31 días. Los estafadores no hacen caso, así que cualquier llamada de ventas después es una alerta."
      ),
    links: [["donotcall.gov", "https://www.donotcall.gov/"]]
  },
  {
    id: "carrier",
    title: () =>
      tr(
        "Turn on your phone company's free scam blocking",
        "Active el bloqueo gratis de su compañía de teléfono"
      ),
    body: () =>
      tr(
        "T-Mobile: Scam Shield app. AT&T: ActiveArmor app. Verizon: Call Filter app. The free version of each blocks known scam numbers.",
        "T-Mobile: app Scam Shield. AT&T: app ActiveArmor. Verizon: app Call Filter. La versión gratis de cada una bloquea números de estafa conocidos."
      ),
    links: []
  },
  {
    id: "silence",
    title: () => tr("Send unknown callers to voicemail", "Mande a buzón las llamadas desconocidas"),
    body: () =>
      tr(
        "iPhone: Settings → Apps → Phone → Silence Unknown Callers. Android: Phone app → ⋮ → Settings → Spam (or Caller ID & spam) → turn on filtering. People in your contacts still ring.",
        "iPhone: Configuración → Apps → Teléfono → Silenciar desconocidos. Android: app Teléfono → ⋮ → Configuración → Spam → active el filtro. Sus contactos siguen sonando."
      ),
    links: []
  },
  {
    id: "prescreen",
    title: () => tr("Stop pre-approved credit card offers", "Detenga las ofertas de tarjetas preaprobadas"),
    body: () =>
      tr(
        "Thieves steal these from mailboxes. One free form stops them from all credit bureaus for 5 years.",
        "Los ladrones las roban de los buzones. Un formulario gratis las detiene en todas las agencias de crédito por 5 años."
      ),
    links: [["optoutprescreen.com", "https://www.optoutprescreen.com/"]]
  },
  {
    id: "freeze",
    title: () => tr("Freeze your credit", "Congele su crédito"),
    body: () =>
      tr(
        "Free. Nobody can open a loan or card in your name. You can unfreeze it any time. Do all three.",
        "Gratis. Nadie puede abrir un préstamo o tarjeta a su nombre. Puede descongelarlo cuando quiera. Haga las tres."
      ),
    links: [
      ["Equifax", "https://www.equifax.com/personal/credit-report-services/credit-freeze/"],
      ["Experian", "https://www.experian.com/freeze/center.html"],
      ["TransUnion", "https://www.transunion.com/credit-freeze"]
    ]
  },
  {
    id: "drop",
    title: () =>
      tr("If you live in California: one request for all", "Si vive en California: una solicitud para todos"),
    body: () =>
      tr(
        "The state's free DROP site asks every registered data broker to delete your info at once.",
        "El sitio gratis DROP del estado pide a todos los vendedores de datos registrados que borren su información a la vez."
      ),
    links: [["DROP", "https://consumer.drop.privacy.ca.gov/"]],
    optional: true
  }
];

/* ----- saved checklist (this device only) ----- */
const RECHECK_DAYS = 90; // sites often add people back, so a "done" site asks to be checked again
const cleanupState = () => S.get("cleanup", { sites: {}, steps: {} });
function saveCleanup(st) {
  S.set("cleanup", st);
}
/* What a site's status is right now: new, found, sent, gone, none (not listed), or recheck. */
function siteStatus(site, st) {
  const r = (st || cleanupState()).sites[site.id];
  if (!r) return "new";
  if ((r.s === "gone" || r.s === "none") && Date.now() - r.at > RECHECK_DAYS * 864e5) return "recheck";
  return r.s;
}
function cleanupProgress() {
  const st = cleanupState();
  const doneSites = CLEANUP_SITES.filter(s => ["gone", "none"].includes(siteStatus(s, st))).length;
  const steps = CLEANUP_STEPS.filter(s => !s.optional);
  const doneSteps = steps.filter(s => st.steps[s.id]).length;
  return { done: doneSites + doneSteps, total: CLEANUP_SITES.length + steps.length };
}
const shortDate = ms => new Date(ms).toLocaleDateString(langCode(), { month: "short", day: "numeric" });

/* ----- screen ----- */
const STATUS_LOOK = {
  new: ["l-gray", "dot", () => tr("Not checked yet", "Sin revisar")],
  found: ["l-red", "alert", () => tr("You're listed. Remove it", "Aparece. Quítelo")],
  sent: ["l-amber", "send", () => tr("Removal requested", "Eliminación pedida")],
  gone: ["l-green", "check", () => tr("Removed", "Eliminado")],
  none: ["l-green", "check", () => tr("Not listed", "No aparece")],
  recheck: ["l-amber", "refresh", () => tr("Time to check again", "Hora de revisar otra vez")]
};

function siteHTML(s, st) {
  const status = siteStatus(s, st);
  const r = st.sites[s.id] || {};
  const [cls, icn, label] = STATUS_LOOK[status];
  const a = (href, text, primary) =>
    `<a class="btn ${primary ? "primary" : "ghost"} sm" href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  const b = (act, text, primary) =>
    `<button class="btn ${primary ? "primary" : "ghost"} sm" data-ci="${act}" data-site="${s.id}">${text}</button>`;
  let body;
  if (s.direct && status !== "sent") {
    body = `<p>${s.how()}</p><div class="btnrow">${a(s.remove, tr("Open the opt-out form", "Abrir el formulario"), true)}${b("sent", tr("I sent it", "Ya lo envié"))}</div>`;
  } else if (status === "new" || status === "recheck") {
    body = `<p class="ci-step"><span>1</span>${s.search ? tr("Open the site and search your name and city.", "Abra el sitio y busque su nombre y ciudad.") : tr("This site's removal page has its own search. Search your name and city.", "La página de eliminación tiene su propia búsqueda. Busque su nombre y ciudad.")}</p>
      <div class="btnrow">${a(s.search || s.remove, tr("Look for me", "Buscarme"), true)}</div>
      <p class="ci-step"><span>2</span>${tr("Did you find yourself?", "¿Se encontró?")}</p>
      <div class="btnrow">${b("found", tr("Yes, I'm listed", "Sí, aparezco"))}${b("none", tr("No, I'm not there", "No, no aparezco"))}</div>`;
  } else if (status === "found") {
    body = `<p>${s.how()}</p><div class="btnrow">${a(s.remove, tr("Remove me", "Quitarme"), true)}${b("sent", tr("I sent the request", "Ya envié la solicitud"))}</div>
      <p class="muted small">${tr("Use an email you check. Most sites send a link you must click. If you're listed more than once, remove each one.", "Use un correo que revise. Casi todos envían un enlace que debe abrir. Si aparece más de una vez, quite cada ficha.")}</p>`;
  } else if (status === "sent") {
    const due = (r.at || Date.now()) + s.days * 864e5;
    const ready = Date.now() >= due;
    body = `<p>${ready ? tr("It's been long enough. Search yourself again. Is your listing gone?", "Ya pasó suficiente tiempo. Búsquese otra vez. ¿Ya no aparece?") : tr(`Sent on ${shortDate(r.at)}. Removals take about ${s.days} days. Check again after ${shortDate(due)}.`, `Enviado el ${shortDate(r.at)}. Tarda unos ${s.days} días. Revise otra vez después del ${shortDate(due)}.`)}</p>
      <div class="btnrow">${s.direct ? "" : a(s.search || s.remove, tr("Look again", "Buscar otra vez"))}${b("gone", s.direct ? tr("Mark as done", "Marcar como listo") : tr("It's gone", "Ya no aparece"), true)}${s.direct ? "" : b("found", tr("Still there", "Sigue ahí"))}</div>`;
  } else {
    body = `<p>${status === "gone" ? tr("Nice work. ", "¡Bien hecho! ") : ""}${tr(`ScamSense will remind you to check again after ${shortDate((r.at || Date.now()) + RECHECK_DAYS * 864e5)}.`, `ScamSense le recordará revisar otra vez después del ${shortDate((r.at || Date.now()) + RECHECK_DAYS * 864e5)}.`)}</p>
      <div class="btnrow">${b("reset", tr("Start over", "Empezar de nuevo"))}</div>`;
  }
  const open = status === "found" || (status === "sent" && Date.now() >= (r.at || 0) + s.days * 864e5);
  return `<details class="ci-site" id="ci-${s.id}" ${open ? "open" : ""}>
    <summary class="grow"><span class="lead-ic ${cls}">${ic(icn)}</span><span class="gl"><b>${esc(s.name)}</b><span>${label()}</span></span>${ic("chev", "chev")}</summary>
    <div class="ci-body">${s.also ? `<p class="muted small">${s.also()}</p>` : ""}${body}</div>
  </details>`;
}

function stepHTML(s, st) {
  const done = !!st.steps[s.id];
  const links = s.links
    .map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${esc(t)}</a>`)
    .join(" · ");
  return `<div class="grow ci-stepitem${done ? " done" : ""}">
    <button class="ci-tick" data-step="${s.id}" role="checkbox" aria-checked="${done}" aria-label="${esc(s.title())}">${ic("check")}</button>
    <span class="gl"><b>${s.title()}</b><span>${s.body()}</span>${links ? `<span class="ci-links">${links}</span>` : ""}</span>
  </div>`;
}

/* ----- screen: one box to check, then two small folds ----- */
function renderCleanup() {
  const st = cleanupState();
  const acct = S.get("acct", null);
  const sitesDone = CLEANUP_SITES.filter(s => ["gone", "none"].includes(siteStatus(s, st))).length;
  const stepsAll = CLEANUP_STEPS.filter(s => !s.optional);
  const stepsDone = stepsAll.filter(s => st.steps[s.id]).length;
  view.innerHTML = `${pageHead(
    tr("Is my info out there?", "¿Mis datos están expuestos?"),
    tr(
      "Type your email or phone number to see if it was leaked. Or paste a text or email you got to check it for scams.",
      "Escriba su correo o teléfono para ver si se filtró. O pegue un texto o correo que recibió para revisarlo."
    ),
    ""
  )}
  <section class="askcard ci-check">
    <p class="ask-h">${ic("shield")}<b>${tr("Check my info", "Revisar mis datos")}</b></p>
    <div class="ci-kind" role="radiogroup" aria-label="${esc(tr("What do you want to check?", "¿Qué quiere revisar?"))}">
      <button class="ci-k" role="radio" aria-checked="true" data-kind="email">${ic("mail")}<span>${tr("Email", "Correo")}</span></button>
      <button class="ci-k" role="radio" aria-checked="false" data-kind="phone">${ic("phone")}<span>${tr("Phone", "Teléfono")}</span></button>
    </div>
    <label class="sr" for="ci-q" id="ci-ql">${tr("Your email", "Su correo")}</label>
    <div class="ci-field"><span class="ci-cc" id="ci-cc" hidden>+1</span><input id="ci-q" type="email" inputmode="email" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(tr("Type your email", "Escriba su correo"))}"><button class="ci-clear" id="ci-clear" type="button" aria-label="${esc(tr("Clear", "Borrar"))}" hidden>×</button></div>
    <div class="btnrow"><button class="btn primary" id="ci-go">${tr("Check", "Revisar")}</button></div>
    ${st.breach ? `<button class="ci-last" id="ci-last">${ic("refresh")}<span>${tr(`Last check: ${esc(st.breach.email)}, ${st.breach.breaches.length} ${st.breach.breaches.length === 1 ? "leak" : "leaks"}. See it again`, `Última revisión: ${esc(st.breach.email)}, ${st.breach.breaches.length} filtraciones. Verla otra vez`)}</span></button>` : ""}
  </section>

  <section class="sect"><div class="group">
    <details class="ci-fold" id="ci-fold-sites">
      <summary class="grow"><span class="lead-ic l-red">${ic("eyeoff")}</span><span class="gl"><b>${tr("Remove me from people-search sites", "Quitarme de sitios de búsqueda de personas")}</b><span>${tr(`${sitesDone} of ${CLEANUP_SITES.length} sites done · always free`, `${sitesDone} de ${CLEANUP_SITES.length} sitios listos · siempre gratis`)}</span></span>${ic("chev", "chev")}</summary>
      <div class="ci-foldbody"><p class="muted small">${tr("These sites show your address and phone to anyone. Tap a site, look yourself up, and ask it to remove you. Never pay anyone to do this.", "Estos sitios muestran su dirección y teléfono a cualquiera. Toque un sitio, búsquese y pida que le quiten. Nunca pague por esto.")}</p>
      <div class="btnrow"><button class="btn primary" id="ci-guide">${ic("eyeoff")}<span>${tr("Remove me, one site at a time", "Quitarme, un sitio a la vez")}</span></button></div>
      <div class="group ci-sites">${CLEANUP_SITES.map(s => siteHTML(s, st)).join("")}</div></div>
    </details>
    <details class="ci-fold">
      <summary class="grow"><span class="lead-ic l-blue">${ic("phone")}</span><span class="gl"><b>${tr("Stop scam calls and mail", "Detener llamadas y correo de estafa")}</b><span>${tr(`${stepsDone} of ${stepsAll.length} free steps done`, `${stepsDone} de ${stepsAll.length} pasos gratis listos`)}</span></span>${ic("chev", "chev")}</summary>
      <div class="ci-foldbody"><div class="group">${CLEANUP_STEPS.map(s => stepHTML(s, st)).join("")}</div></div>
    </details>
  </div></section>

  <p class="footnote">${ic("lock")}<span>${tr("ScamSense only checks the email you type, and never saves the result on our server for more than a day.", "ScamSense solo revisa el correo que escribe y nunca guarda el resultado en el servidor más de un día.")}</span></p>
  <dialog class="ci-pop" id="ci-pop" aria-labelledby="ci-pop-h"></dialog>`;
  bindBack();
  bindCleanup();
}

const isEmail = v => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v);
const isPhone = v => v.replace(/\D/g, "").length >= 10 && /^[\d\s()+.-]+$/.test(v);

function bindCleanup() {
  bindGo();
  const q = document.getElementById("ci-q");
  const goBtn = document.getElementById("ci-go");
  if (goBtn) goBtn.onclick = runInfoCheck;
  if (q) {
    q.onkeydown = e => {
      if (e.key === "Enter") runInfoCheck();
    };
    q.oninput = () => (document.getElementById("ci-clear").hidden = !q.value);
  }
  const clr = document.getElementById("ci-clear");
  if (clr)
    clr.onclick = () => {
      q.value = "";
      clr.hidden = true;
      q.focus();
    };
  view.querySelectorAll(".ci-k").forEach(
    b =>
      (b.onclick = () => {
        view.querySelectorAll(".ci-k").forEach(x => x.setAttribute("aria-checked", String(x === b)));
        const phone = b.dataset.kind === "phone";
        q.type = phone ? "tel" : "email";
        document.getElementById("ci-cc").hidden = !phone;
        q.classList.toggle("ph", phone);
        q.inputMode = phone ? "tel" : "email";
        q.placeholder = phone
          ? tr("Type your phone number", "Escriba su número de teléfono")
          : tr("Type your email", "Escriba su correo");
        document.getElementById("ci-ql").textContent = phone
          ? tr("Your phone number", "Su número de teléfono")
          : tr("Your email", "Su correo");
        q.value = "";
        clr.hidden = true;
        q.focus();
      })
  );
  const guide = document.getElementById("ci-guide");
  if (guide) guide.onclick = () => startRemoval();
  const last = document.getElementById("ci-last");
  if (last) last.onclick = () => showInfoPop(cleanupState().breach);
  view.querySelectorAll("[data-ci]").forEach(
    b =>
      (b.onclick = () => {
        const st = cleanupState();
        const id = b.dataset.site;
        if (b.dataset.ci === "reset") delete st.sites[id];
        else st.sites[id] = { s: b.dataset.ci, at: Date.now() };
        saveCleanup(st);
        const site = CLEANUP_SITES.find(s => s.id === id);
        document.getElementById("ci-" + id).outerHTML = siteHTML(site, st);
        const now = document.getElementById("ci-" + id);
        now.open = b.dataset.ci !== "none" && b.dataset.ci !== "gone";
        bindCleanup();
        if (b.dataset.ci === "gone") toast(tr("Removed. Nice work!", "Eliminado. ¡Bien hecho!"));
        now.querySelector("summary").focus();
      })
  );
  view.querySelectorAll("[data-step]").forEach(
    b =>
      (b.onclick = () => {
        const st = cleanupState();
        st.steps[b.dataset.step] = !st.steps[b.dataset.step];
        saveCleanup(st);
        b.setAttribute("aria-checked", String(!!st.steps[b.dataset.step]));
        b.closest(".ci-stepitem").classList.toggle("done", !!st.steps[b.dataset.step]);
      })
  );
}

async function runInfoCheck() {
  const q = document.getElementById("ci-q");
  const v = (q.value || "").trim();
  if (!v) {
    q.focus();
    toast(tr("Type your email or phone number first.", "Primero escriba su correo o teléfono."));
    return;
  }
  const clearBox = () => {
    q.value = "";
    const c = document.getElementById("ci-clear");
    if (c) c.hidden = true;
  };
  if (isPhone(v)) {
    clearBox();
    return startPhoneCheck(v);
  }
  if (!isEmail(v)) {
    // Anything else (a text message, an email you got, a link): check it for scams instead.
    checkDraft = v;
    go("check");
    setTimeout(() => runCheck(null), 30);
    return;
  }
  const btn = document.getElementById("ci-go");
  btn.disabled = true;
  btn.textContent = tr("Checking…", "Revisando…");
  try {
    if (!serverOn())
      throw new Error(
        tr("The ScamSense server isn't set up.", "El servidor de ScamSense no está configurado.")
      );
    const j = await serverPost({ mode: "breach", email: v });
    if (!j || !j.ok)
      throw new Error((j && j.error) || tr("Couldn't check right now.", "No se pudo revisar ahora."));
    const st = cleanupState();
    if (!st.breach || st.breach.email !== j.email) st.leakDone = {}; // a different email: a fresh plan
    st.breach = {
      email: j.email,
      source: j.source,
      breaches: j.breaches || [],
      risk: j.risk || "",
      at: Date.now()
    };
    saveCleanup(st);
    clearBox();
    showInfoPop(st.breach);
    if (typeof serverEvent === "function") serverEvent({ t: "leak", n: st.breach.breaches.length });
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = tr("Check", "Revisar");
  }
}

/* The pop-up with the result. */
function openPop(html, remove) {
  const d = document.getElementById("ci-pop");
  d.innerHTML =
    html +
    `<div class="btnrow ci-pop-end">${remove ? `<button class="btn primary" id="ci-remove">${ic("eyeoff")}<span>${tr("Remove my info", "Quitar mis datos")}</span></button>` : ""}<button class="btn ghost" id="ci-close">${tr("Close", "Cerrar")}</button></div>`;
  document.getElementById("ci-close").onclick = () => d.close();
  const rm = document.getElementById("ci-remove");
  if (rm) rm.onclick = () => startRemoval();
  d.onclick = e => {
    if (e.target === d) d.close(); // tap outside the pop-up to close it
  };
  if (typeof d.showModal === "function") d.showModal();
  else d.setAttribute("open", "");
  d.scrollTop = 0;
}
function levelOf(res) {
  const n = res.breaches.length;
  const pw = res.breaches.some(b => /password/i.test((b.data || []).join(" ")));
  if (!n) return ["low", tr("Low", "Bajo")];
  if (n >= 4 || (pw && n >= 2)) return ["high", tr("High", "Alto")];
  return ["mid", tr("Medium", "Medio")];
}
/* ----- Email leak result: a short personal plan, not a list of sites -----
   Each leak lists what was exposed. We sort those into the few things a person can actually do,
   most urgent first, with a checkbox for each, and fold the full list of sites away. */
const LEAK_KINDS = [
  {
    id: "money",
    test: /social security|\bssn\b|tax id|credit card|bank account|financial|payment/i,
    title: () => tr("Freeze your credit (free)", "Congele su crédito (gratis)"),
    why: () =>
      tr(
        "Your Social Security or money details were in a leak. A freeze stops anyone opening loans or cards in your name. It's free and you can lift it any time.",
        "Su número de Seguro Social o datos de dinero estuvieron en una filtración. Congelar su crédito impide que abran préstamos o tarjetas a su nombre. Es gratis y puede quitarlo cuando quiera."
      ),
    links: [
      ["Equifax", "https://www.equifax.com/personal/credit-report-services/credit-freeze/"],
      ["Experian", "https://www.experian.com/freeze/center.html"],
      ["TransUnion", "https://www.transunion.com/credit-freeze"]
    ]
  },
  {
    id: "pw",
    test: /password/i,
    title: () => tr("Change these passwords", "Cambie estas contraseñas"),
    why: () =>
      tr(
        "Your password leaked from the sites below. Start with your email and your bank if you ever used the same password there. Skip sites you no longer use.",
        "Su contraseña se filtró en los sitios de abajo. Empiece por su correo y su banco si alguna vez usó la misma contraseña allí. Omita los sitios que ya no usa."
      ),
    sites: true
  },
  {
    id: "contact",
    test: /phone|physical address|home address|\baddress(?!es)|birth|\bages?\b/i,
    title: () => tr("Expect calls that know your details", "Espere llamadas que conocen sus datos"),
    why: () =>
      tr(
        "Your phone number, home address or birthday leaked. Scammers use them to sound real. Knowing your details doesn't prove a caller is real: hang up and call back on a number you trust.",
        "Su teléfono, dirección o cumpleaños se filtraron. Los estafadores los usan para parecer reales. Que sepan sus datos no prueba que sean reales: cuelgue y llame a un número de confianza."
      ),
    remove: true
  },
  {
    id: "secq",
    test: /security question|secret question|security answer/i,
    title: () => tr("Change your security questions", "Cambie sus preguntas de seguridad"),
    why: () =>
      tr(
        "Answers like your mother's maiden name leaked. Change them on your bank and email, or use made-up answers only you know.",
        "Respuestas como el apellido de su madre se filtraron. Cámbielas en su banco y correo, o use respuestas inventadas que solo usted sepa."
      )
  },
  {
    id: "twostep",
    always: true,
    title: () =>
      tr("Turn on 2-step verification for your email", "Active la verificación en 2 pasos en su correo"),
    why: () =>
      tr(
        "Then a leaked password alone can't open your email. Your email is the key to all your other accounts.",
        "Así una contraseña filtrada no basta para abrir su correo. Su correo es la llave de todas sus otras cuentas."
      ),
    links: [
      ["Gmail", "https://myaccount.google.com/signinoptions/twosv"],
      ["Outlook", "https://account.live.com/proofs/manage/additional"]
    ]
  }
];
function leakPlan(res) {
  const all = res.breaches || [];
  const has = re => all.filter(b => re.test((b.data || []).join(" ; ")));
  return LEAK_KINDS.filter(k => k.always || has(k.test).length).map(k => {
    const hits = k.always ? [] : has(k.test);
    // Newest leaks first: those passwords are the most likely to still work.
    const sites = hits
      .slice()
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .map(b => ({ name: b.name, year: String(b.date || "").slice(0, 4) }));
    return Object.assign({}, k, { sites });
  });
}
function leakDone(id) {
  return !!(cleanupState().leakDone || {})[id];
}
function showInfoPop(res) {
  if (!res) return;
  const n = res.breaches.length;
  const [lv, lvText] = levelOf(res);
  const when = shortDate(res.at || Date.now());
  const st = cleanupState();
  if (st.newLeaks) {
    delete st.newLeaks; // they've seen it now
    saveCleanup(st);
  }
  const head = `<div class="ci-pop-head ${lv}">
    <p class="ci-level">${tr("Risk", "Riesgo")}: <b>${lvText}</b></p>
    <div class="ci-meter"><i></i></div>
    <h2 id="ci-pop-h">${n ? tr(`Your email was found in ${n} data ${n === 1 ? "leak" : "leaks"}`, `Su correo aparece en ${n} ${n === 1 ? "filtración" : "filtraciones"}`) : tr("Good news: no leaks found", "Buenas noticias: no hay filtraciones")}</h2>
    <p class="ci-email">${esc(res.email)}</p></div>`;
  const watch = `<label class="ci-watch"><input type="checkbox" id="ci-watchbox" ${st.watch ? "checked" : ""}><span><b>${tr("Watch this email for me", "Vigilar este correo por mí")}</b><span>${tr("ScamSense checks again every month and tells you only if there's a new leak.", "ScamSense revisa cada mes y le avisa solo si hay una filtración nueva.")}</span></span></label>`;
  if (!n) {
    openPop(
      head +
        `<p>${tr("This email isn't in any known data leak. Keep using a different password for each site, and turn on 2-step verification.", "Este correo no está en ninguna filtración conocida. Siga usando una contraseña distinta para cada sitio y active la verificación en 2 pasos.")}</p>${watch}<p class="muted small">${tr(`Checked ${when} with ${esc(res.source)}.`, `Revisado ${when} con ${esc(res.source)}.`)}</p>`
    );
    bindLeakPop(res);
    return;
  }
  const plan = leakPlan(res);
  const done = plan.filter(k => leakDone(k.id)).length;
  const steps = plan
    .map(
      (k, i) => `<li class="ci-pstep ${leakDone(k.id) ? "done" : ""}">
      <label class="ci-pstephead"><input type="checkbox" data-leak="${k.id}" ${leakDone(k.id) ? "checked" : ""}><span class="ci-num">${i + 1}</span><b>${k.title()}</b></label>
      <p>${k.why()}</p>
      ${
        k.sites && k.sites.length
          ? `<ul class="ci-sitelist">${k.sites
              .slice(0, 8)
              .map(x => `<li>${esc(x.name)}${x.year ? ` <span>${esc(x.year)}</span>` : ""}</li>`)
              .join(
                ""
              )}${k.sites.length > 8 ? `<li class="muted">${tr(`and ${k.sites.length - 8} more`, `y ${k.sites.length - 8} más`)}</li>` : ""}</ul>`
          : ""
      }
      ${k.links ? `<div class="ci-links">${k.links.map(([l, u]) => `<a class="btn sm ghost" href="${u}" target="_blank" rel="noopener">${esc(l)}</a>`).join("")}</div>` : ""}
      ${k.remove ? `<div class="ci-links"><button class="btn sm ghost" data-leakremove>${ic("eyeoff")}<span>${tr("Remove me from people-search sites", "Quitarme de sitios de búsqueda")}</span></button></div>` : ""}
    </li>`
    )
    .join("");
  const cards = res.breaches
    .map(
      b =>
        `<li class="ci-bcard"><div class="ci-bline"><b>${esc(b.name)}</b>${b.date ? `<span>${esc(String(b.date).slice(0, 4))}</span>` : ""}</div>${
          b.data && b.data.length
            ? `<div class="ci-chips">${b.data
                .slice(0, 6)
                .map(d => `<span class="${/password/i.test(d) ? "hot" : ""}">${esc(d)}</span>`)
                .join("")}</div>`
            : ""
        }</li>`
    )
    .join("");
  openPop(
    head +
      `<h3>${tr("Your plan", "Su plan")} <span class="ci-progress" id="ci-prog">${tr(`${done} of ${plan.length} done`, `${done} de ${plan.length} listos`)}</span></h3>
      <p class="muted small" style="margin-top:-4px">${tr("Most important first. Tick each one when it's done.", "Lo más importante primero. Marque cada uno al terminarlo.")}</p>
      <ol class="ci-plan">${steps}</ol>
      ${watch}
      <details class="ci-where"><summary>${tr(`See all ${n} leaks and what each one exposed`, `Ver las ${n} filtraciones y qué expuso cada una`)}</summary><ul class="ci-blist">${cards}</ul></details>
      <p class="muted small">${tr(`Checked ${when} with ${esc(res.source)}. A leak means a company was hacked, not that you did anything wrong.`, `Revisado ${when} con ${esc(res.source)}. Una filtración significa que hackearon a una empresa, no que usted hizo algo mal.`)}</p>`
  );
  bindLeakPop(res);
}
function bindLeakPop(res) {
  const d = document.getElementById("ci-pop");
  d.querySelectorAll("[data-leak]").forEach(
    x =>
      (x.onchange = () => {
        const st = cleanupState();
        st.leakDone = Object.assign({}, st.leakDone, { [x.dataset.leak]: x.checked });
        saveCleanup(st);
        x.closest(".ci-pstep").classList.toggle("done", x.checked);
        const plan = leakPlan(res);
        const n = plan.filter(k => leakDone(k.id)).length;
        const pr = document.getElementById("ci-prog");
        if (pr) pr.textContent = tr(`${n} of ${plan.length} done`, `${n} de ${plan.length} listos`);
      })
  );
  const rm = d.querySelector("[data-leakremove]");
  if (rm) rm.onclick = () => startRemoval();
  const w = document.getElementById("ci-watchbox");
  if (w)
    w.onchange = () => {
      const st = cleanupState();
      st.watch = w.checked;
      saveCleanup(st);
      toast(
        w.checked
          ? tr("ScamSense will check this email every month.", "ScamSense revisará este correo cada mes.")
          : tr("Stopped watching this email.", "Dejó de vigilar este correo.")
      );
    };
}
/* Monthly: if they asked us to watch their email, check again quietly and speak up only for new leaks. */
async function leakWatchTick() {
  const st = cleanupState();
  if (!st.watch || !st.breach || !serverOn()) return;
  if (Date.now() - (st.breach.checkedAt || st.breach.at || 0) < 30 * 864e5) return;
  try {
    const j = await serverPost({ mode: "breach", email: st.breach.email });
    if (!j || !j.ok) return;
    const known = new Set((st.breach.breaches || []).map(b => b.name));
    const fresh = (j.breaches || []).filter(b => !known.has(b.name));
    st.breach = {
      email: j.email,
      source: j.source,
      breaches: j.breaches || [],
      risk: j.risk || "",
      at: Date.now()
    };
    if (fresh.length) {
      st.newLeaks = fresh.map(b => b.name);
      // New leaks may need the steps again.
      st.leakDone = {};
    }
    saveCleanup(st);
    if (fresh.length)
      toast(
        tr(
          `New data leak found for ${j.email}: ${fresh.map(b => b.name).join(", ")}. Open "Is my info out there?" to see what to do.`,
          `Nueva filtración para ${j.email}: ${fresh.map(b => b.name).join(", ")}. Abra "¿Mis datos están expuestos?" para ver qué hacer.`
        )
      );
  } catch (e) {}
}
setTimeout(leakWatchTick, 8000);
function showPhonePop(v) {
  openPop(`<div class="ci-pop-head mid"><h2 id="ci-pop-h">${tr("Phone check is coming soon", "La revisión por teléfono llega pronto")}</h2><p class="ci-email">${esc(v)}</p></div>
    <p>${tr("To show what's public about a phone number, ScamSense first has to text you a code, so nobody can look up someone else's number. We're adding this.", "Para mostrar lo que es público sobre un teléfono, ScamSense primero debe enviarle un código por texto, para que nadie busque el número de otra persona. Lo estamos agregando.")}</p>
    <p><b>${tr("What you can do today", "Qué puede hacer hoy")}</b></p>
    <ol class="ci-todo">
      <li>${tr("Check your email above. It's the most common leak.", "Revise su correo arriba. Es la filtración más común.")}</li>
      <li>${tr("Open “Remove me from people-search sites” below. Those sites are where your phone and address show up.", "Abra “Quitarme de sitios de búsqueda” abajo. Ahí aparecen su teléfono y dirección.")}</li>
      <li>${tr("Open “Stop scam calls and mail” for free call blocking.", "Abra “Detener llamadas y correo” para bloquear llamadas gratis.")}</li>
    </ol>`);
}

/* Phone: text a code to the number first, so people can only look up their own. */
async function startPhoneCheck(v) {
  const btn = document.getElementById("ci-go");
  btn.disabled = true;
  btn.textContent = tr("Sending a code…", "Enviando un código…");
  try {
    if (!serverOn()) return showPhonePop(v);
    const j = await Promise.race([
      serverPost({ mode: "phone_start", phone: v }),
      new Promise((_, no) =>
        setTimeout(
          () =>
            no(
              new Error(
                tr(
                  "The server took too long. Please try again in a minute.",
                  "El servidor tardó mucho. Intente otra vez en un minuto."
                )
              )
            ),
          30000
        )
      )
    ]);
    if (j && j.ok && j.available === false) return showPhonePop(v);
    if (!j || !j.ok)
      throw new Error(
        (j && j.error) || tr("Couldn't send a code right now.", "No se pudo enviar un código ahora.")
      );
    showCodePop(v, j.sentTo, j.left);
  } catch (e) {
    openPop(
      `<div class="ci-pop-head mid"><h2 id="ci-pop-h">${tr("We couldn't send the code", "No pudimos enviar el código")}</h2><p class="ci-email">${esc(v)}</p></div><p>${esc(e.message)}</p>`
    );
  } finally {
    btn.disabled = false;
    btn.textContent = tr("Check", "Revisar");
  }
}
function showCodePop(v, sentTo, left) {
  openPop(`<div class="ci-pop-head mid"><h2 id="ci-pop-h">${tr("Enter the code we texted you", "Escriba el código que le enviamos")}</h2><p class="ci-email">${esc(sentTo || v)}</p></div>
    <p>${tr("This makes sure the number is yours. Nobody can look up someone else's number.", "Así sabemos que el número es suyo. Nadie puede buscar el número de otra persona.")}</p>
    <label class="sr" for="ci-code">${tr("Code", "Código")}</label>
    <input id="ci-code" class="ci-code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="123456">
    <div class="btnrow"><button class="btn primary" id="ci-codego">${tr("Show my results", "Ver mis resultados")}</button></div>
    <p class="muted small">${tr(`You have ${left} phone ${left === 1 ? "check" : "checks"} left this month.`, `Le quedan ${left} revisiones de teléfono este mes.`)}</p>`);
  const inp = document.getElementById("ci-code");
  const go = document.getElementById("ci-codego");
  setTimeout(() => inp.focus(), 50);
  const send = async () => {
    const code = inp.value.replace(/\D/g, "");
    if (code.length < 4) {
      inp.focus();
      return;
    }
    go.disabled = true;
    go.textContent = tr("Checking…", "Revisando…");
    try {
      const j = await serverPost({
        mode: "phone_confirm",
        phone: v,
        code,
        name: cfg().name || "",
        lastName: cfg().lastName || ""
      });
      if (!j || !j.ok)
        throw new Error((j && j.error) || tr("Couldn't check right now.", "No se pudo revisar ahora."));
      if (typeof serverEvent === "function") serverEvent({ t: "phone_lookup", n: (j.owners || []).length });
      showPhoneResult(j);
    } catch (e) {
      toast(e.message);
      go.disabled = false;
      go.textContent = tr("Show my results", "Ver mis resultados");
    }
  };
  go.onclick = send;
  inp.onkeydown = e => {
    if (e.key === "Enter") send();
  };
}
const LINE_TYPES = {
  Mobile: () => tr("Cell phone", "Celular"),
  Landline: () => tr("Landline", "Teléfono fijo"),
  FixedVOIP: () => tr("Internet phone", "Teléfono por internet"),
  NonFixedVOIP: () => tr("Internet phone", "Teléfono por internet"),
  TollFree: () => tr("Toll-free", "Línea gratuita")
};
function showPhoneResult(j) {
  const owners = j.owners || [];
  const addrs = owners.reduce((n, o) => n + (o.addresses || []).length, 0);
  const lv = addrs ? "high" : owners.length || j.hidden ? "mid" : "low";
  const lvText = { high: tr("High", "Alto"), mid: tr("Medium", "Medio"), low: tr("Low", "Bajo") }[lv];
  const row = (k, v) => (v ? `<div class="ci-kv"><span>${k}</span><b>${esc(v)}</b></div>` : "");
  const people = owners
    .map(
      o =>
        `<li class="ci-bcard">${row(tr("Name", "Nombre"), o.name)}${row(tr("Also known as", "También como"), (o.other || []).join(", "))}${row(tr("Age", "Edad"), o.age)}${(o.addresses || []).map(a => row(tr("Home address", "Dirección"), a)).join("")}${row(tr("Linked to this number since", "Vinculado a este número desde"), o.since)}</li>`
    )
    .join("");
  openPop(
    `<div class="ci-pop-head ${lv}">
      <p class="ci-level">${tr("Risk", "Riesgo")}: <b>${lvText}</b></p><div class="ci-meter"><i></i></div>
      <h2 id="ci-pop-h">${addrs ? tr("Your name and home address are public", "Su nombre y dirección son públicos") : owners.length ? tr("Your name is linked to this number", "Su nombre está vinculado a este número") : j.hidden || j.needName ? tr("We couldn't confirm it's you", "No pudimos confirmar que es usted") : tr("Good news: little is public", "Buenas noticias: poco es público")}</h2>
      <p class="ci-email">${esc(j.phone)}</p></div>
    <p>${tr("This is what data companies sell about your number. Scammers buy it to sound real when they call or text you.", "Esto es lo que las empresas de datos venden sobre su número. Los estafadores lo compran para parecer reales al llamarle.")}</p>
    ${owners.length ? `<h3>${tr("What anyone can buy", "Lo que cualquiera puede comprar")}</h3><ul class="ci-blist">${people}</ul>` : ""}
    ${j.needName ? `<p class="ci-note">${tr("Add your first and last name in Settings → Your account, then check again. ScamSense only shows names that match yours.", "Agregue su nombre y apellido en Configuración → Su cuenta y revise otra vez. ScamSense solo muestra nombres que coinciden con el suyo.")}</p>` : !owners.length && j.hidden ? `<p class="ci-note">${tr("We couldn't confirm your name on this number. The records may still list a past owner, so we're not showing them.", "No pudimos confirmar su nombre en este número. Los registros pueden mostrar a un dueño anterior, así que no los mostramos.")}</p>` : ""}
    <h3>${tr("Your phone line", "Su línea")}</h3>
    <div class="ci-bcard">${row(tr("Phone company", "Compañía"), j.carrier)}${row(tr("Type", "Tipo"), (LINE_TYPES[j.lineType] || (() => j.lineType))())}</div>
    <h3>${tr("What to do now", "Qué hacer ahora")}</h3>
    <ol class="ci-todo">
      <li>${tr("Open “Remove me from people-search sites” and ask each site to remove you. It's free.", "Abra “Quitarme de sitios de búsqueda” y pida a cada sitio que le quite. Es gratis.")}</li>
      <li>${tr("Freeze your credit (free) so nobody can open accounts in your name.", "Congele su crédito (gratis) para que nadie abra cuentas a su nombre.")}</li>
      <li>${tr("If a caller knows your address, that doesn't prove they're real. Hang up and call back on a number you trust.", "Si quien llama sabe su dirección, eso no prueba que sea real. Cuelgue y llame a un número de confianza.")}</li>
    </ol>
    <p class="ci-note">${tr("Removing your info takes a few weeks and lowers scam calls and texts, but it can't stop them all: some scammers already have your number. Keep using ScamSense to check calls and messages.", "Quitar sus datos toma unas semanas y reduce las llamadas y textos de estafa, pero no los detiene todos: algunos estafadores ya tienen su número. Siga usando ScamSense para revisar llamadas y mensajes.")}</p>
    <p class="muted small">${tr(`Data from ${esc(j.source)}. ScamSense doesn't save it. ${j.left} phone ${j.left === 1 ? "check" : "checks"} left this month.`, `Datos de ${esc(j.source)}. ScamSense no los guarda. Le quedan ${j.left} revisiones este mes.`)}</p>`,
    true
  );
}

/* For Home: a short line about this screen. */
function cleanupLine() {
  const nl = cleanupState().newLeaks;
  if (nl && nl.length)
    return tr(`New leak found: ${nl[0]}. See what to do`, `Nueva filtración: ${nl[0]}. Vea qué hacer`);
  if (CLEANUP_SITES.some(s => siteStatus(s) === "recheck"))
    return tr("Time to check some sites again", "Hora de revisar algunos sitios otra vez");
  return tr("See if your email or phone was leaked", "Vea si su correo o teléfono se filtró");
}

/* ----- Guided removal: one site at a time, in a pop-up ----- */
let removalChanged = false;
function startRemoval() {
  removalChanged = false;
  const d = document.getElementById("ci-pop");
  d.onclose = () => {
    if (removalChanged) renderCleanup();
  };
  removalStep();
}
function removalStep() {
  const st = cleanupState();
  const todo = CLEANUP_SITES.filter(x => !["gone", "none", "sent"].includes(siteStatus(x, st)));
  const doneCount = CLEANUP_SITES.length - todo.length;
  const d = document.getElementById("ci-pop");
  const bar = `<div class="ci-bar"><i style="width:${Math.round((doneCount / CLEANUP_SITES.length) * 100)}%"></i></div>`;
  if (!todo.length) {
    const sent = CLEANUP_SITES.filter(x => siteStatus(x, st) === "sent").length;
    d.innerHTML = `<div class="ci-pop-head low"><h2 id="ci-pop-h">${tr("You went through every site", "Revisó todos los sitios")}</h2><p class="ci-email">${tr(`${CLEANUP_SITES.length} of ${CLEANUP_SITES.length}`, `${CLEANUP_SITES.length} de ${CLEANUP_SITES.length}`)}</p></div>
      ${bar}
      <p>${sent ? tr(`You asked ${sent} ${sent === 1 ? "site" : "sites"} to remove you. Removals take a few days to a few weeks. ScamSense will remind you when it's time to check that they're gone.`, `Pidió a ${sent} sitios que le quiten. Tarda de unos días a unas semanas. ScamSense le recordará cuándo revisar.`) : tr("Nice work. ScamSense will remind you to check again in a few months, because some sites add people back.", "Bien hecho. ScamSense le recordará revisar otra vez en unos meses, porque algunos sitios vuelven a agregar a las personas.")}</p>
      <div class="btnrow ci-pop-end"><button class="btn primary" id="ci-close">${tr("Done", "Listo")}</button></div>`;
    document.getElementById("ci-close").onclick = () => d.close();
  } else {
    const x = todo[0];
    const n = doneCount + 1;
    d.innerHTML = `<div class="ci-pop-head mid"><p class="ci-level">${tr(`Site ${n} of ${CLEANUP_SITES.length}`, `Sitio ${n} de ${CLEANUP_SITES.length}`)}</p><h2 id="ci-pop-h">${esc(x.name)}</h2>${x.also ? `<p class="ci-email">${x.also()}</p>` : ""}</div>
      ${bar}
      <ol class="ci-todo">
        ${x.direct ? "" : `<li>${tr("Tap the button below. The site opens in a new tab.", "Toque el botón de abajo. El sitio se abre en otra pestaña.")}</li><li>${tr("Search your name and city.", "Busque su nombre y ciudad.")}</li>`}
        <li>${x.how()}</li>
        <li>${tr("Come back here and tap what happened.", "Vuelva aquí y toque lo que pasó.")}</li>
      </ol>
      <div class="btnrow ci-pop-end">
        ${x.search ? `<a class="btn ghost" href="${x.search}" target="_blank" rel="noopener noreferrer">${tr(`1. Find myself on ${x.name.split(",")[0]}`, `1. Buscarme en ${x.name.split(",")[0]}`)}</a>` : ""}<a class="btn primary" href="${x.remove}" target="_blank" rel="noopener noreferrer">${x.search ? tr("2. Open the removal page", "2. Abrir la página para quitarme") : tr(`Open ${x.name.split(",")[0]}`, `Abrir ${x.name.split(",")[0]}`)}</a>
        <button class="btn ghost" data-rs="sent">${ic("check")}<span>${tr("I asked them to remove me", "Pedí que me quiten")}</span></button>
        ${x.direct ? "" : `<button class="btn ghost" data-rs="none">${tr("I'm not on this site", "No aparezco en este sitio")}</button>`}
        <button class="ci-skip" data-rs="skip">${tr("Skip for now", "Saltar por ahora")}</button>
        <button class="ci-skip" id="ci-close">${tr("Stop and finish later", "Parar y seguir después")}</button>
      </div>`;
    document.getElementById("ci-close").onclick = () => d.close();
    d.querySelectorAll("[data-rs]").forEach(
      b =>
        (b.onclick = () => {
          const st2 = cleanupState();
          if (b.dataset.rs === "skip") {
            // Move it to the end of this round by marking it, without counting it as done.
            removalSkip.add(x.id);
          } else {
            st2.sites[x.id] = { s: b.dataset.rs, at: Date.now() };
            saveCleanup(st2);
            removalChanged = true;
          }
          removalStepNext();
        })
    );
  }
  if (!d.open) {
    if (typeof d.showModal === "function") d.showModal();
    else d.setAttribute("open", "");
  }
  d.scrollTop = 0;
}
const removalSkip = new Set();
function removalStepNext() {
  // Show the next site that wasn't skipped this time; when only skipped ones are left, finish.
  const st = cleanupState();
  const todo = CLEANUP_SITES.filter(
    x => !["gone", "none", "sent"].includes(siteStatus(x, st)) && !removalSkip.has(x.id)
  );
  if (!todo.length) {
    removalSkip.clear();
    const d = document.getElementById("ci-pop");
    d.close();
    if (removalChanged) renderCleanup();
    toast(
      tr(
        "Saved. You can finish the skipped sites any time.",
        "Guardado. Puede terminar los sitios saltados cuando quiera."
      )
    );
    return;
  }
  const keep = CLEANUP_SITES.slice();
  // Temporarily reorder so removalStep shows the next non-skipped site first.
  CLEANUP_SITES.sort((a, b) => (removalSkip.has(a.id) ? 1 : 0) - (removalSkip.has(b.id) ? 1 : 0));
  removalStep();
  CLEANUP_SITES.splice(0, CLEANUP_SITES.length, ...keep);
}

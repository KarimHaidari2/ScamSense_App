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
      "Type your email or phone number. ScamSense shows if it was leaked, and what to do.",
      "Escriba su correo o número de teléfono. ScamSense le muestra si se filtró y qué hacer."
    ),
    ""
  )}
  <section class="askcard ci-check">
    <p class="ask-h">${ic("shield")}<b>${tr("Check my info", "Revisar mis datos")}</b></p>
    <label class="sr" for="ci-q">${tr("Your email or phone number", "Su correo o número de teléfono")}</label>
    <input id="ci-q" type="text" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="${esc(tr("Your email or phone number", "Su correo o número de teléfono"))}" value="${esc((acct && acct.email) || "")}">
    <div class="btnrow"><button class="btn primary" id="ci-go">${tr("Check", "Revisar")}</button></div>
    ${st.breach ? `<button class="ci-last" id="ci-last">${ic("refresh")}<span>${tr(`Last check: ${esc(st.breach.email)}, ${st.breach.breaches.length} ${st.breach.breaches.length === 1 ? "leak" : "leaks"}. See it again`, `Última revisión: ${esc(st.breach.email)}, ${st.breach.breaches.length} filtraciones. Verla otra vez`)}</span></button>` : ""}
  </section>

  <section class="sect"><div class="group">
    <details class="ci-fold">
      <summary class="grow"><span class="lead-ic l-red">${ic("eyeoff")}</span><span class="gl"><b>${tr("Remove me from people-search sites", "Quitarme de sitios de búsqueda de personas")}</b><span>${tr(`${sitesDone} of ${CLEANUP_SITES.length} sites done · always free`, `${sitesDone} de ${CLEANUP_SITES.length} sitios listos · siempre gratis`)}</span></span>${ic("chev", "chev")}</summary>
      <div class="ci-foldbody"><p class="muted small">${tr("These sites show your address and phone to anyone. Tap a site, look yourself up, and ask it to remove you. Never pay anyone to do this.", "Estos sitios muestran su dirección y teléfono a cualquiera. Toque un sitio, búsquese y pida que le quiten. Nunca pague por esto.")}</p>
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
  if (q) q.onkeydown = e => e.key === "Enter" && runInfoCheck();
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
  if (isPhone(v)) return showPhonePop(v);
  if (!isEmail(v)) {
    toast(tr("That doesn't look like an email or phone number.", "Eso no parece un correo ni un teléfono."));
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
    st.breach = {
      email: j.email,
      source: j.source,
      breaches: j.breaches || [],
      risk: j.risk || "",
      at: Date.now()
    };
    saveCleanup(st);
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
function openPop(html) {
  const d = document.getElementById("ci-pop");
  d.innerHTML =
    html +
    `<div class="btnrow ci-pop-end"><button class="btn primary" id="ci-close">${tr("Close", "Cerrar")}</button></div>`;
  document.getElementById("ci-close").onclick = () => d.close();
  d.onclick = e => e.target === d && d.close();
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
function showInfoPop(res) {
  if (!res) return;
  const n = res.breaches.length;
  const [lv, lvText] = levelOf(res);
  const when = shortDate(res.at || Date.now());
  const head = `<div class="ci-pop-head ${lv}">
    <p class="ci-level">${tr("Risk", "Riesgo")}: <b>${lvText}</b></p>
    <div class="ci-meter"><i></i></div>
    <h2 id="ci-pop-h">${n ? tr(`Your email was found in ${n} data ${n === 1 ? "leak" : "leaks"}`, `Su correo aparece en ${n} ${n === 1 ? "filtración" : "filtraciones"}`) : tr("Good news: no leaks found", "Buenas noticias: no hay filtraciones")}</h2>
    <p class="ci-email">${esc(res.email)}</p></div>`;
  if (!n)
    return openPop(
      head +
        `<p>${tr("This email isn't in any known data leak. Keep using a different password for each site, and turn on 2-step verification.", "Este correo no está en ninguna filtración conocida. Siga usando una contraseña distinta para cada sitio y active la verificación en 2 pasos.")}</p><p class="muted small">${tr(`Checked ${when} with ${esc(res.source)}.`, `Revisado ${when} con ${esc(res.source)}.`)}</p>`
    );
  const types = {};
  res.breaches.forEach(b => (b.data || []).forEach(d => (types[d] = (types[d] || 0) + 1)));
  const topTypes = Object.keys(types)
    .sort((a, b) => types[b] - types[a])
    .slice(0, 8);
  const cards = res.breaches
    .slice(0, 15)
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
      (topTypes.length
        ? `<h3>${tr("What leaked", "Qué se filtró")}</h3><div class="ci-chips big">${topTypes.map(d => `<span class="${/password/i.test(d) ? "hot" : ""}">${esc(d)}</span>`).join("")}</div>`
        : "") +
      `<h3>${tr("Where", "Dónde")}</h3><ul class="ci-blist">${cards}</ul>${n > 15 ? `<p class="muted small">${tr(`And ${n - 15} more.`, `Y ${n - 15} más.`)}</p>` : ""}
      <h3>${tr("What to do now", "Qué hacer ahora")}</h3>
      <ol class="ci-todo">
        <li>${tr("Change your password on those sites, and anywhere you used the same one.", "Cambie su contraseña en esos sitios y donde haya usado la misma.")}</li>
        <li>${tr("Turn on 2-step verification for your email and bank.", "Active la verificación en 2 pasos en su correo y su banco.")}</li>
        <li>${tr("Be extra careful with messages that mention these companies. Scammers use leaked details to sound real.", "Tenga cuidado con mensajes que mencionan estas empresas. Los estafadores usan datos filtrados para parecer reales.")}</li>
      </ol>
      <p class="muted small">${tr(`Checked ${when} with ${esc(res.source)}.`, `Revisado ${when} con ${esc(res.source)}.`)}</p>`
  );
}
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

/* For Home: a short line about this screen. */
function cleanupLine() {
  if (CLEANUP_SITES.some(s => siteStatus(s) === "recheck"))
    return tr("Time to check some sites again", "Hora de revisar algunos sitios otra vez");
  return tr("See if your email or phone was leaked", "Vea si su correo o teléfono se filtró");
}

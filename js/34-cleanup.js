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
function renderCleanup() {
  const st = cleanupState();
  const p = cleanupProgress();
  const pct = Math.round((p.done / p.total) * 100);
  const name = [cfg().name, cfg().lastName].filter(Boolean).join(" ");
  view.innerHTML = `${pageHead(
    tr("Clean up my info", "Limpiar mis datos"),
    tr(
      "Scammers find your name, phone, and home address on people-search sites. Here's how to take them down.",
      "Los estafadores encuentran su nombre, teléfono y dirección en sitios de búsqueda de personas. Así puede quitarlos."
    ),
    "today"
  )}
  <section class="ci-prog" aria-label="${esc(tr("Your progress", "Su progreso"))}">
    <div class="ci-prog-top"><b>${tr(`${p.done} of ${p.total} done`, `${p.done} de ${p.total} listos`)}</b><span>${pct}%</span></div>
    <div class="ci-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${p.total}" aria-valuenow="${p.done}"><i style="width:${pct}%"></i></div>
  </section>

  <section class="sect"><h2 class="sect-h">${tr("How it works", "Cómo funciona")}</h2>
    <ol class="ci-how">
      <li><b>${tr("Look yourself up", "Búsquese")}</b><span>${tr(`Search ${name ? "“" + esc(name) + "”" : "your name"} and your city on each site below.`, `Busque ${name ? "“" + esc(name) + "”" : "su nombre"} y su ciudad en cada sitio.`)}</span></li>
      <li><b>${tr("Ask them to remove you", "Pida que le quiten")}</b><span>${tr("It's always free. Never pay a site, or anyone who contacts you, to remove your info.", "Siempre es gratis. Nunca pague a un sitio, ni a nadie que le contacte, para quitar sus datos.")}</span></li>
      <li><b>${tr("Check back", "Vuelva a revisar")}</b><span>${tr("ScamSense reminds you. Some sites add people back after a few months.", "ScamSense le recuerda. Algunos sitios vuelven a agregar a las personas después de unos meses.")}</span></li>
    </ol>
  </section>

  <section class="sect"><h2 class="sect-h">${tr("People-search sites", "Sitios de búsqueda de personas")}</h2>
    <div class="group ci-sites">${CLEANUP_SITES.map(s => siteHTML(s, st)).join("")}</div>
  </section>

  <section class="sect"><h2 class="sect-h">${tr("Was your email in a data leak?", "¿Su correo estuvo en una filtración?")}</h2>
    <div class="group"><div class="grow col ci-leak" id="ci-leak">${leakHTML(st.breach)}</div></div>
  </section>

  <section class="sect"><h2 class="sect-h">${tr("Free steps that stop scam calls and mail", "Pasos gratis contra llamadas y correo de estafa")}</h2>
    <div class="group">${CLEANUP_STEPS.map(s => stepHTML(s, st)).join("")}</div>
  </section>

  <section class="sect"><h2 class="sect-h">${tr("Let ScamSense do it for you", "Que ScamSense lo haga por usted")}</h2>
    <div class="group"><div class="grow col ci-auto">
      <p class="ci-soon">${ic("spark")}<b>${tr("Coming soon", "Muy pronto")}</b></p>
      <p>${tr("We're working on an automatic scan of 600+ data broker sites that sends the removal requests for you and keeps watching.", "Estamos preparando un escaneo automático de más de 600 sitios que envía las solicitudes por usted y sigue vigilando.")}</p>
      <p class="muted small">${tr("Paid services already do this today, such as Cloaked, DeleteMe, Incogni, and Optery. If you use one, buy it from its own website. Never from someone who calls or emails you first.", "Hoy ya existen servicios pagados que lo hacen, como Cloaked, DeleteMe, Incogni y Optery. Si usa uno, cómprelo en su propio sitio web. Nunca a alguien que le llama o escribe primero.")}</p>
    </div></div>
  </section>

  <p class="footnote">${ic("lock")}<span>${tr("Your checklist stays on this device. ScamSense never sees what these sites show about you.", "Su lista se guarda en este dispositivo. ScamSense nunca ve lo que estos sitios muestran de usted.")}</span></p>`;
  bindBack();
  bindCleanup();
}

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

function leakHTML(res) {
  const btn = (txt, primary) =>
    `<div class="btnrow"><button class="btn ${primary ? "primary" : "ghost"} sm" id="ci-leakgo">${txt}</button></div>`;
  if (!res) {
    const acct = S.get("acct", null);
    return `<p>${tr("Companies get hacked, and lists of emails and passwords end up with scammers. That's how they know your email, and sometimes an old password.", "Las empresas sufren hackeos y las listas de correos y contraseñas terminan con los estafadores. Así saben su correo y a veces una contraseña vieja.")}</p>
      ${acct && acct.verified ? `<p class="muted small">${tr(`ScamSense checks your own email: ${esc(acct.email)}`, `ScamSense revisa su propio correo: ${esc(acct.email)}`)}</p>${btn(tr("Check my email", "Revisar mi correo"), true)}` : `<p class="muted small">${tr("Connect Gmail or Outlook first, so ScamSense knows which email is yours.", "Primero conecte Gmail u Outlook para que ScamSense sepa cuál es su correo.")}</p><div class="btnrow"><button class="btn primary sm" data-go="settings">${tr("Go to Settings", "Ir a Configuración")}</button></div>`}`;
  }
  const n = (res.breaches || []).length;
  const when = res.at ? shortDate(res.at) : "";
  if (!n)
    return `<p class="ci-ok">${ic("check")}<b>${tr("Good news: your email wasn't found in any known data leak.", "Buenas noticias: su correo no está en ninguna filtración conocida.")}</b></p>
      <p class="muted small">${tr(`Checked ${esc(res.email || "")} on ${when}, using ${esc(res.source || "")}.`, `Revisado ${esc(res.email || "")} el ${when}, con ${esc(res.source || "")}.`)}</p>${btn(tr("Check again", "Revisar otra vez"))}`;
  const list = res.breaches
    .slice(0, 12)
    .map(
      b =>
        `<li><b>${esc(b.name)}</b>${b.date ? ` <span class="muted">· ${esc(b.date.slice(0, 4))}</span>` : ""}${b.data && b.data.length ? `<span class="muted small">${esc(b.data.slice(0, 4).join(", "))}</span>` : ""}</li>`
    )
    .join("");
  return `<p class="ci-bad">${ic("alert")}<b>${tr(`Your email was in ${n} data ${n === 1 ? "leak" : "leaks"}.`, `Su correo estuvo en ${n} ${n === 1 ? "filtración" : "filtraciones"}.`)}</b></p>
    <ul class="ci-breaches">${list}</ul>${n > 12 ? `<p class="muted small">${tr(`And ${n - 12} more.`, `Y ${n - 12} más.`)}</p>` : ""}
    <p><b>${tr("What to do", "Qué hacer")}</b></p>
    <ol class="ci-todo">
      <li>${tr("Change your password on those sites, and anywhere you used the same password.", "Cambie su contraseña en esos sitios y en cualquier lugar donde usó la misma.")}</li>
      <li>${tr("Turn on 2-step verification for your email and bank.", "Active la verificación en 2 pasos en su correo y su banco.")}</li>
      <li>${tr("Be extra careful with emails that mention these companies. Scammers use leaked details to sound real.", "Tenga cuidado con correos que mencionan estas empresas. Los estafadores usan datos filtrados para parecer reales.")}</li>
    </ol>
    <p class="muted small">${tr(`Checked ${esc(res.email || "")} on ${when}, using ${esc(res.source || "")}.`, `Revisado ${esc(res.email || "")} el ${when}, con ${esc(res.source || "")}.`)}</p>${btn(tr("Check again", "Revisar otra vez"))}`;
}

function bindCleanup() {
  bindGo();
  view.querySelectorAll("[data-ci]").forEach(
    b =>
      (b.onclick = () => {
        const st = cleanupState();
        const id = b.dataset.site;
        if (b.dataset.ci === "reset") delete st.sites[id];
        else st.sites[id] = { s: b.dataset.ci, at: Date.now() };
        saveCleanup(st);
        const site = CLEANUP_SITES.find(s => s.id === id);
        const el = document.getElementById("ci-" + id);
        el.outerHTML = siteHTML(site, st);
        const now = document.getElementById("ci-" + id);
        now.open = b.dataset.ci !== "none" && b.dataset.ci !== "gone";
        bindCleanup();
        updateCleanupProgress();
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
        updateCleanupProgress();
      })
  );
  const go2 = document.getElementById("ci-leakgo");
  if (go2) go2.onclick = runLeakCheck;
}
function updateCleanupProgress() {
  const p = cleanupProgress();
  const pct = Math.round((p.done / p.total) * 100);
  const box = view.querySelector(".ci-prog");
  if (!box) return;
  box.querySelector(".ci-prog-top b").textContent = tr(
    `${p.done} of ${p.total} done`,
    `${p.done} de ${p.total} listos`
  );
  box.querySelector(".ci-prog-top span").textContent = pct + "%";
  box.querySelector(".ci-bar").setAttribute("aria-valuenow", p.done);
  box.querySelector(".ci-bar i").style.width = pct + "%";
}

async function runLeakCheck() {
  const box = document.getElementById("ci-leak");
  const btn = document.getElementById("ci-leakgo");
  if (btn) {
    btn.disabled = true;
    btn.textContent = tr("Checking…", "Revisando…");
  }
  try {
    if (!serverOn())
      throw new Error(
        tr("The ScamSense server isn't set up.", "El servidor de ScamSense no está configurado.")
      );
    const j = await serverPost({ mode: "breach" });
    if (!j || !j.ok)
      throw new Error((j && j.error) || tr("Couldn't check right now.", "No se pudo revisar ahora."));
    const st = cleanupState();
    st.breach = { email: j.email, source: j.source, breaches: j.breaches || [], at: Date.now() };
    saveCleanup(st);
    box.innerHTML = leakHTML(st.breach);
    bindCleanup();
    if (typeof serverEvent === "function") serverEvent({ t: "leak", n: st.breach.breaches.length });
  } catch (e) {
    toast(e.message);
    if (btn) {
      btn.disabled = false;
      btn.textContent = tr("Check my email", "Revisar mi correo");
    }
  }
}

/* For Home: a short line about progress, or what this is. */
function cleanupLine() {
  const p = cleanupProgress();
  const due = CLEANUP_SITES.some(s => siteStatus(s) === "recheck");
  if (due) return tr("Time to check some sites again", "Hora de revisar algunos sitios otra vez");
  if (!p.done)
    return tr(
      "Remove your address and phone from people-search sites",
      "Quite su dirección y teléfono de sitios de búsqueda"
    );
  return tr(`${p.done} of ${p.total} done`, `${p.done} de ${p.total} listos`);
}

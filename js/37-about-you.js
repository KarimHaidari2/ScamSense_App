/*
 * ScamSense · About you
 * Right after signing in, a person tells ScamSense their name, date of birth, and where they live
 * (country, state, ZIP code, never a street address). The ScamSense team sees this in the Owner app,
 * so every person has a real name and an area. People who signed up before this see it once too.
 * They can change it anytime in Settings → Your account.
 */
"use strict";

const ABOUT_US_STATES = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["DC", "District of Columbia"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
  ["PR", "Puerto Rico"],
  ["GU", "Guam"],
  ["VI", "U.S. Virgin Islands"],
  ["AS", "American Samoa"],
  ["MP", "Northern Mariana Islands"]
];
const ABOUT_COUNTRIES = [
  "United States",
  "Afghanistan",
  "Argentina",
  "Australia",
  "Austria",
  "Bangladesh",
  "Brazil",
  "Canada",
  "China",
  "Colombia",
  "Cuba",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "France",
  "Germany",
  "Ghana",
  "Guatemala",
  "Haiti",
  "Honduras",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Kenya",
  "Mexico",
  "Morocco",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Nigeria",
  "Pakistan",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Puerto Rico",
  "Russia",
  "Saudi Arabia",
  "South Africa",
  "South Korea",
  "Spain",
  "Sweden",
  "Switzerland",
  "Syria",
  "Turkey",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "Venezuela",
  "Vietnam"
];
const isUS = country => /^(united states|usa|us|u\.s\.a?\.?)$/i.test(String(country || "").trim());

/* Every country, its states or provinces, and what its postal codes look like (data/regions.json,
   loaded the first time "About you" opens). c: [code, English name] · s: code → states · p: code → [pattern, flags] */
let REGIONS = null;
function loadRegions() {
  if (REGIONS) return Promise.resolve(REGIONS);
  return fetch("data/regions.json")
    .then(r => (r.ok ? r.json() : null))
    .then(j => (REGIONS = j && j.c ? j : null))
    .catch(() => null);
}
const regionCode = name => {
  if (!REGIONS || !name) return "";
  const n = String(name).trim().toLowerCase();
  const hit = REGIONS.c.find(([, en]) => en.toLowerCase() === n);
  return hit ? hit[0] : isUS(name) ? "US" : "";
};
/* Country names in the app's language (Spanish, etc.), stored in English. */
function countryLabel(code, en) {
  try {
    if (langCode() !== "en" && typeof Intl !== "undefined" && Intl.DisplayNames)
      return new Intl.DisplayNames([langCode()], { type: "region" }).of(code) || en;
  } catch (e) {}
  return en;
}
function postalRule(code) {
  const r = REGIONS && REGIONS.p[code];
  try {
    return r ? new RegExp(r[0], r[1]) : null;
  } catch (e) {
    return null;
  }
}

/* Is anything still missing? */
function aboutYouMissing(c) {
  c = c || cfg();
  return !(
    c.name &&
    c.lastName &&
    /^\d{4}-\d{2}-\d{2}$/.test(c.dob || "") &&
    c.country &&
    (!isUS(c.country) || (c.state && /^\d{5}$/.test(c.zip || "")))
  );
}

/* After the server answers: fill in anything this device doesn't know yet (from another device),
   then ask for whatever is still missing. */
function aboutYouCheck(j) {
  if (!serverOn() || !S.get("onboarded", false)) return;
  const p = j && j.profile;
  if (p) {
    const c = cfg();
    const fill = {};
    [
      ["name", p.first],
      ["lastName", p.last],
      ["dob", p.dob],
      ["country", p.country],
      ["state", p.state],
      ["zip", p.zip]
    ].forEach(([k, v]) => {
      if (!c[k] && v) fill[k] = v;
    });
    if (Object.keys(fill).length) saveCfg(Object.assign(c, fill));
    if (p.setup && typeof applySetup === "function") applySetup(p.setup);
  }
  if (aboutYouMissing() && S.get("acct", null)) showAboutYou(false);
}

function showAboutYou(editing) {
  if (document.querySelector(".onb-about")) return;
  if (!editing && document.querySelector(".onb"))
    return setTimeout(() => aboutYouMissing() && showAboutYou(false), 3000);
  // Never interrupt someone who is getting help: ask after they leave the chat.
  if (
    !editing &&
    (S.get("mahi_live", null) || document.getElementById("suplog") || document.getElementById("chatlog"))
  )
    return setTimeout(() => aboutYouMissing() && showAboutYou(false), 60000);
  const c = cfg();
  const [yy, mm, dd] = (c.dob || "--").split("-");
  const thisYear = new Date().getFullYear();
  const months = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleDateString(langCode() === "es" ? "es" : "en", { month: "long" })
  );
  const m = document.createElement("div");
  m.className = "onb onb-gate onb-about";
  document.body.appendChild(m);
  const country = c.country || "United States";
  m.innerHTML = `<div class="gate-box about-box" role="dialog" aria-modal="true" aria-labelledby="about-h">
    <section class="gate-body">
      <h1 id="about-h">${tr("About you", "Sobre usted")}</h1>
      <p class="muted">${tr("So the ScamSense team knows who you are and can warn you about scams in your area. We never ask for your street address.", "Para que el equipo de ScamSense sepa quién es usted y pueda avisarle de estafas en su zona. Nunca pedimos su dirección.")}</p>
      <form id="aboutform" novalidate>
        <div class="about-row">
          <label>${tr("First name", "Nombre")}<input id="ab-first" autocomplete="given-name" maxlength="30" required value="${esc(c.name || "")}"></label>
          <label>${tr("Last name", "Apellido")}<input id="ab-last" autocomplete="family-name" maxlength="30" required value="${esc(c.lastName || "")}"></label>
        </div>
        <fieldset><legend>${tr("Date of birth", "Fecha de nacimiento")}</legend>
          <div class="about-row three">
            <label><span class="sr">${tr("Month", "Mes")}</span><select id="ab-m" autocomplete="bday-month"><option value="">${tr("Month", "Mes")}</option>${months
              .map(
                (n, i) =>
                  `<option value="${String(i + 1).padStart(2, "0")}" ${mm === String(i + 1).padStart(2, "0") ? "selected" : ""}>${esc(n)}</option>`
              )
              .join("")}</select></label>
            <label><span class="sr">${tr("Day", "Día")}</span><select id="ab-d" autocomplete="bday-day"><option value="">${tr("Day", "Día")}</option>${Array.from(
              { length: 31 },
              (_, i) => String(i + 1).padStart(2, "0")
            )
              .map(d => `<option value="${d}" ${dd === d ? "selected" : ""}>${+d}</option>`)
              .join("")}</select></label>
            <label><span class="sr">${tr("Year", "Año")}</span><select id="ab-y" autocomplete="bday-year"><option value="">${tr("Year", "Año")}</option>${Array.from(
              { length: thisYear - 13 - 1900 + 1 },
              (_, i) => String(thisYear - 13 - i)
            )
              .map(y => `<option value="${y}" ${yy === y ? "selected" : ""}>${y}</option>`)
              .join("")}</select></label>
          </div>
        </fieldset>
        <label>${tr("Country", "País")}<span id="ab-cwrap"><input id="ab-country" list="ab-countries" autocomplete="country-name" maxlength="60" value="${esc(country)}"></span></label>
        <datalist id="ab-countries">${ABOUT_COUNTRIES.map(n => `<option value="${esc(n)}">`).join("")}</datalist>
        <div class="about-row" id="ab-where"></div>
        <p class="about-err" id="ab-err" role="alert"></p>
        <button class="gate-btn primary-btn" type="submit">${tr("Save and continue", "Guardar y continuar")}</button>
        ${editing ? `<button class="gate-demo" type="button" id="ab-cancel">${tr("Cancel", "Cancelar")}</button>` : ""}
        ${
          !editing && typeof myAcctEmail === "function" && myAcctEmail()
            ? `<div class="about-who"><p>${tr("Signed in as", "Sesión iniciada como")} <b>${esc(myAcctEmail())}</b></p>
          <button class="gate-demo" type="button" id="ab-switch">${tr("Not you? Sign in to a different account", "¿No es usted? Inicie sesión con otra cuenta")}</button></div>`
            : ""
        }
        <p class="gate-fine">${ic("lock")} ${tr("Only you and the ScamSense team see this. It's never sold or shared.", "Solo usted y el equipo de ScamSense lo ven. Nunca se vende ni se comparte.")} <a href="privacy.html" target="_blank" rel="noopener">${tr("Privacy Policy", "Política de privacidad")}</a></p>
      </form>
    </section>
  </div>`;
  const where = () => {
    const ctryVal = m.querySelector("#ab-country").value;
    const us = isUS(ctryVal);
    const code = regionCode(ctryVal);
    const st = m.querySelector("#ab-state");
    const zp = m.querySelector("#ab-zip");
    const keepState = st ? st.value : c.state || "";
    const keepZip = zp ? zp.value : c.zip || "";
    const states = (!us && REGIONS && REGIONS.s[code]) || null;
    const hasPostal = us || !REGIONS || !!postalRule(code);
    let stateField;
    if (us)
      stateField = `<label>${tr("State", "Estado")}<select id="ab-state" autocomplete="address-level1"><option value="">${tr("Choose…", "Elija…")}</option>${ABOUT_US_STATES.map(([k, n]) => `<option value="${k}" ${keepState === k ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>`;
    else if (states && states.length <= 80)
      stateField = `<label>${tr("State or province", "Estado o provincia")}<select id="ab-state" autocomplete="address-level1"><option value="">${tr("Choose…", "Elija…")}</option>${(states.indexOf(
        keepState
      ) < 0 && keepState
        ? [keepState]
        : []
      )
        .concat(states)
        .map(n => `<option ${keepState === n ? "selected" : ""}>${esc(n)}</option>`)
        .join("")}</select></label>`;
    else if (states)
      stateField = `<label>${tr("State, province or county", "Estado, provincia o condado")}<input id="ab-state" list="ab-states" autocomplete="address-level1" maxlength="40" value="${esc(keepState)}" placeholder="${esc(tr("Start typing…", "Empiece a escribir…"))}"></label><datalist id="ab-states">${states.map(n => `<option value="${esc(n)}">`).join("")}</datalist>`;
    else
      stateField = `<label>${tr("State or province (if any)", "Estado o provincia (si hay)")}<input id="ab-state" autocomplete="address-level1" maxlength="40" value="${esc(keepState)}"></label>`;
    const zipField = us
      ? `<label>${tr("ZIP code", "Código postal")}<input id="ab-zip" inputmode="numeric" autocomplete="postal-code" maxlength="5" pattern="[0-9]{5}" value="${esc(keepZip)}"></label>`
      : `<label>${hasPostal ? tr("Postal code", "Código postal") : tr("Postal code (if any)", "Código postal (si hay)")}<input id="ab-zip" autocomplete="postal-code" maxlength="10" value="${esc(keepZip)}"></label>`;
    m.querySelector("#ab-where").innerHTML = stateField + zipField;
  };
  where();
  // Once the full country list is here, the country box becomes a dropdown of every country.
  loadRegions().then(R => {
    if (!R || !m.isConnected) return;
    const box = m.querySelector("#ab-country");
    const cur = box.value || "United States";
    let list = R.c.slice().sort((a, b) => countryLabel(a[0], a[1]).localeCompare(countryLabel(b[0], b[1])));
    const us = list.find(x => x[0] === "US");
    list = [us].concat(list.filter(x => x[0] !== "US"));
    const known = list.some(([, en]) => en === cur) || isUS(cur);
    m.querySelector("#ab-cwrap").innerHTML =
      `<select id="ab-country" autocomplete="country-name">${known ? "" : `<option selected>${esc(cur)}</option>`}${list.map(([k, en]) => `<option value="${esc(en)}" ${en === cur || (k === "US" && isUS(cur)) ? "selected" : ""}>${esc(countryLabel(k, en))}</option>`).join("")}</select>`;
    const dl = m.querySelector("#ab-countries");
    if (dl) dl.remove();
    m.querySelector("#ab-country").onchange = () => {
      const s2 = m.querySelector("#ab-state"),
        z2 = m.querySelector("#ab-zip");
      if (s2) s2.value = "";
      if (z2) z2.value = "";
      where();
    };
    where();
  });
  m.querySelector("#ab-country").oninput = where;
  m.querySelector("#aboutform").addEventListener(
    "input",
    () => (m.querySelector("#ab-err").textContent = "")
  );
  const close = () => m.remove();
  if (editing) m.querySelector("#ab-cancel").onclick = close;
  // Someone else's account on this phone: sign out here, then the welcome screen lets them
  // sign in to their own account or create one.
  const sw = m.querySelector("#ab-switch");
  if (sw)
    sw.onclick = async () => {
      sw.disabled = true;
      try {
        await authCall({ action: "logout" });
      } catch (e) {}
      signOutLocal("switch");
    };
  m.querySelector("#aboutform").onsubmit = e => {
    e.preventDefault();
    const v = id => m.querySelector(id).value.trim();
    const err = msg => {
      m.querySelector("#ab-err").textContent = msg;
    };
    const first = v("#ab-first"),
      last = v("#ab-last"),
      y = v("#ab-y"),
      mo = v("#ab-m"),
      d = v("#ab-d"),
      ctry = v("#ab-country"),
      state = v("#ab-state"),
      zip = v("#ab-zip");
    if (!first || !last)
      return err(tr("Please type your first and last name.", "Escriba su nombre y apellido."));
    const dob = `${y}-${mo}-${d}`;
    const dt = new Date(+y, +mo - 1, +d);
    if (!y || !mo || !d || dt.getMonth() !== +mo - 1)
      return err(tr("Please choose your date of birth.", "Elija su fecha de nacimiento."));
    if (!ctry) return err(tr("Please type your country.", "Escriba su país."));
    if (isUS(ctry) && !state) return err(tr("Please choose your state.", "Elija su estado."));
    if (isUS(ctry) && !/^\d{5}$/.test(zip))
      return err(tr("Please type your 5-digit ZIP code.", "Escriba su código postal de 5 dígitos."));
    if (!isUS(ctry)) {
      const code = regionCode(ctry);
      const rule = postalRule(code);
      const hasStates = !!(REGIONS && REGIONS.s[code]);
      if (hasStates && !state)
        return err(tr("Please choose your state or province.", "Elija su estado o provincia."));
      if ((rule || !REGIONS) && !zip)
        return err(tr("Please type your postal code.", "Escriba su código postal."));
      if (rule && !rule.test(zip.toUpperCase()) && !rule.test(zip))
        return err(
          tr(
            "That postal code doesn't look right for this country. Please check it.",
            "Ese código postal no parece correcto para este país. Revíselo."
          )
        );
    }
    saveCfg(
      Object.assign(cfg(), {
        name: first.slice(0, 30),
        lastName: last.slice(0, 30),
        dob,
        country: isUS(ctry) ? "United States" : ctry.slice(0, 60),
        state: state.slice(0, 40),
        zip: (isUS(ctry) ? zip : zip.toUpperCase()).slice(0, 10)
      })
    );
    close();
    registerUser();
    toast(tr("Thank you! Your details are saved.", "¡Gracias! Sus datos están guardados."));
    if (typeof refresh === "function") refresh();
  };
  setTimeout(() => m.querySelector(c.name ? "#ab-m" : "#ab-first").focus(), 50);
}

/* People who already have an account: ask once when the app opens. */
setTimeout(() => {
  if (S.get("acct", null) && aboutYouMissing()) aboutYouCheck(null);
}, 2500);

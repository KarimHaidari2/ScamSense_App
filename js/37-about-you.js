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

/* Is anything still missing? */
function aboutYouMissing(c) {
  c = c || cfg();
  return !(
    c.name &&
    c.lastName &&
    /^\d{4}-\d{2}-\d{2}$/.test(c.dob || "") &&
    c.country &&
    (!isUS(c.country) || (c.state && /^\d{5}$/.test(c.zip || ""))) &&
    (isUS(c.country) || c.zip)
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
  }
  if (aboutYouMissing() && S.get("acct", null)) showAboutYou(false);
}

function showAboutYou(editing) {
  if (document.querySelector(".onb-about")) return;
  if (!editing && document.querySelector(".onb")) return setTimeout(() => showAboutYou(false), 3000);
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
        <label>${tr("Country", "País")}<input id="ab-country" list="ab-countries" autocomplete="country-name" maxlength="60" value="${esc(country)}"></label>
        <datalist id="ab-countries">${ABOUT_COUNTRIES.map(n => `<option value="${esc(n)}">`).join("")}</datalist>
        <div class="about-row" id="ab-where"></div>
        <p class="about-err" id="ab-err" role="alert"></p>
        <button class="gate-btn primary-btn" type="submit">${tr("Save and continue", "Guardar y continuar")}</button>
        ${editing ? `<button class="gate-demo" type="button" id="ab-cancel">${tr("Cancel", "Cancelar")}</button>` : ""}
        <p class="gate-fine">${ic("lock")} ${tr("Only you and the ScamSense team see this. It's never sold or shared.", "Solo usted y el equipo de ScamSense lo ven. Nunca se vende ni se comparte.")} <a href="privacy.html" target="_blank" rel="noopener">${tr("Privacy Policy", "Política de privacidad")}</a></p>
      </form>
    </section>
  </div>`;
  const where = () => {
    const us = isUS(m.querySelector("#ab-country").value);
    const st = m.querySelector("#ab-state");
    const zp = m.querySelector("#ab-zip");
    const keepState = st ? st.value : c.state || "";
    const keepZip = zp ? zp.value : c.zip || "";
    m.querySelector("#ab-where").innerHTML = us
      ? `<label>${tr("State", "Estado")}<select id="ab-state" autocomplete="address-level1"><option value="">${tr("Choose…", "Elija…")}</option>${ABOUT_US_STATES.map(([k, n]) => `<option value="${k}" ${keepState === k ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
         <label>${tr("ZIP code", "Código postal")}<input id="ab-zip" inputmode="numeric" autocomplete="postal-code" maxlength="5" pattern="[0-9]{5}" value="${esc(keepZip)}"></label>`
      : `<label>${tr("State or province", "Estado o provincia")}<input id="ab-state" autocomplete="address-level1" maxlength="40" value="${esc(keepState)}"></label>
         <label>${tr("Postal code", "Código postal")}<input id="ab-zip" autocomplete="postal-code" maxlength="10" value="${esc(keepZip)}"></label>`;
  };
  where();
  m.querySelector("#ab-country").oninput = where;
  const close = () => m.remove();
  if (editing) m.querySelector("#ab-cancel").onclick = close;
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
    if (!isUS(ctry) && !zip) return err(tr("Please type your postal code.", "Escriba su código postal."));
    saveCfg(
      Object.assign(cfg(), {
        name: first.slice(0, 30),
        lastName: last.slice(0, 30),
        dob,
        country: isUS(ctry) ? "United States" : ctry.slice(0, 60),
        state: state.slice(0, 40),
        zip: zip.slice(0, 10)
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

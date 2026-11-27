/*
 * ScamSense · Setting up a new device
 * The server remembers which of the person's own email accounts they connected (addresses only, never
 * any email) and a few settings. On a new phone or computer, Home says "Check your 2 email accounts on
 * this device", and one tap per account connects it, with that account already picked in Google's or
 * Microsoft's window. Scan results themselves stay on each device.
 */
"use strict";

/* This device's email accounts, in the form the server keeps. */
function mySetup() {
  const boxes = [];
  const g = S.get("gmail_box", "");
  if (S.get("connected", false) && g) boxes.push({ k: "gmail", e: g, main: true });
  const ms = S.get("ms", null) || {};
  if (outlookConnected() && ms.email) boxes.push({ k: "outlook", e: ms.email, main: true });
  (typeof extraBoxes === "function" ? extraBoxes() : []).forEach(b => boxes.push({ k: b.kind, e: b.email }));
  return { boxes, days: cfg().days || 1, autoSpam: !!S.get("autoSpam", false) };
}
/* Only a device with at least one account connected updates the list, so a fresh device never wipes it. */
function setupToSend() {
  const s = mySetup();
  return s.boxes.length ? s : undefined;
}
/* The account list from the server (after sign-in, or any time the app talks to the server). */
function applySetup(setup) {
  if (!setup || !Array.isArray(setup.boxes)) return;
  S.set("known_setup", setup);
  // They already said these mailboxes are theirs on their other device.
  const ok = S.get("mailbox_ok", []) || [];
  S.set("mailbox_ok", [...new Set(ok.concat(setup.boxes.map(b => b.e)))].slice(-10));
  // A device with nothing connected yet takes the settings from their other device.
  if (!S.get("connected", false) && !outlookConnected()) {
    if ([1, 3, 7].includes(setup.days)) saveCfg(Object.assign(cfg(), { days: setup.days }));
    if (setup.autoSpam) S.set("autoSpam", true);
  }
}
/* Accounts they use elsewhere that aren't connected on this device. */
function missingBoxes() {
  const known = (S.get("known_setup", null) || {}).boxes || [];
  const here = new Set(mySetup().boxes.map(b => b.k + ":" + b.e));
  return known.filter(b => !here.has(b.k + ":" + b.e)).sort((a, b) => (b.main ? 1 : 0) - (a.main ? 1 : 0));
}
/* Home: the line in the navy panel when nothing is connected here yet. */
function newDeviceStatusHTML() {
  if (anyMailboxOn()) return "";
  const m = missingBoxes();
  if (!m.length) return "";
  return `<button class="nw-status off" data-home="setupdev"><i>${ic("mail")}</i><span><b>${tr(
    m.length === 1
      ? "Check your email on this device"
      : `Check your ${m.length} email accounts on this device`,
    m.length === 1
      ? "Revise su correo en este dispositivo"
      : `Revise sus ${m.length} cuentas de correo en este dispositivo`
  )}</b><small>${tr("One tap each, only the first time", "Un toque cada una, solo la primera vez")}</small></span>${ic("chev", "chev")}</button>`;
}
/* Settings and Home: a row when some accounts are connected here but not all. */
function newDeviceRowHTML() {
  if (!anyMailboxOn()) return "";
  const m = missingBoxes();
  if (!m.length) return "";
  return `<button class="grow linkrow" id="sdrow"><span class="lead-ic l-amber">${ic("mail")}</span><span class="gl"><b>${tr(
    `${m.length} more email account${m.length === 1 ? "" : "s"} to check here`,
    `${m.length} cuenta${m.length === 1 ? "" : "s"} más para revisar aquí`
  )}</b><span>${esc(m.map(b => b.e).join(", "))}</span></span>${ic("chev", "chev")}</button>`;
}

/* The one-time setup: one row per account, each with its own button. */
function showSetupDevice() {
  if (document.getElementById("setupdev")) return;
  const m = document.createElement("div");
  m.className = "onb onb-gate onb-about";
  m.id = "setupdev";
  let connected = 0;
  const draw = msg => {
    const list = missingBoxes();
    m.innerHTML = `<div class="gate-box about-box" role="dialog" aria-modal="true" aria-labelledby="sd-h"><section class="gate-body">
      <h1 id="sd-h">${tr("Your email on this device", "Su correo en este dispositivo")}</h1>
      <p class="about-lead">${tr(
        "You use these email accounts with ScamSense on another device. Tap each one to check it here too. Your emails are still read only on this device.",
        "Usa estas cuentas de correo con ScamSense en otro dispositivo. Toque cada una para revisarla aquí también. Sus correos se siguen leyendo solo en este dispositivo."
      )}</p>
      ${msg ? `<p class="err">${esc(msg)}</p>` : ""}
      <div class="group sd-list">${
        list.length
          ? list
              .map(
                (b, i) =>
                  `<div class="grow"><span class="lead-ic ${b.k === "gmail" ? "l-red" : "l-blue"}">${ic("mail")}</span><span class="gl"><b>${esc(b.e)}</b><span>${b.k === "gmail" ? "Gmail" : "Outlook"}</span></span><button class="btn sm primary" data-sd="${i}">${tr("Connect", "Conectar")}</button></div>`
              )
              .join("")
          : `<p class="about-lead">${tr("All set. Every account is connected here.", "Listo. Todas las cuentas están conectadas aquí.")}</p>`
      }</div>
      <button class="gate-btn primary-btn" type="button" id="sd-done">${connected ? tr("Done, check my email now", "Listo, revisar mi correo ahora") : tr("Not now", "Ahora no")}</button>
    </section></div>`;
    m.querySelectorAll("[data-sd]").forEach(btn => {
      btn.onclick = async () => {
        const b = list[+btn.dataset.sd];
        btn.disabled = true;
        try {
          if (b.k === "gmail" && b.main && !S.get("connected", false)) {
            S.set("gmail_box", b.e); // Google's window opens on this account
            await getToken(true);
          } else if (b.k === "gmail") await addGmailBox(b.e);
          else if (b.main && !outlookConnected())
            return connectOutlook(false, false, b.e); // leaves for Microsoft, then comes back
          else return addOutlookBox(b.e);
          connected++;
          draw();
        } catch (e) {
          draw(e.message);
        }
      };
    });
    m.querySelector("#sd-done").onclick = () => {
      m.remove();
      if (connected) {
        go("today");
        scanEmail();
      } else renderToday();
    };
  };
  document.body.appendChild(m);
  draw();
}

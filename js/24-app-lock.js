/*
 * ScamSense · App lock
 * PIN lock on this device.
 */
"use strict";

/* ----- Scrambling the PIN -----
   New PINs use PBKDF2 (200,000 rounds), so a copied hash is very slow to crack.
   Older PINs (version 1, plain SHA-256) still unlock and are upgraded right away. */
const PIN_LEN = 6;
const PIN_ROUNDS = 200000;
async function pinHash(pin, salt) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + pin));
  return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function pinHashStrong(pin, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, [
    "deriveBits"
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: PIN_ROUNDS, hash: "SHA-256" },
    key,
    256
  );
  return [...new Uint8Array(bits)].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function pinMatches(pin, L) {
  return (L.v === 2 ? await pinHashStrong(pin, L.salt) : await pinHash(pin, L.salt)) === L.hash;
}
async function savePin(pin) {
  const salt = [...crypto.getRandomValues(new Uint8Array(16))]
    .map(x => x.toString(16).padStart(2, "0"))
    .join("");
  S.set("lock", { v: 2, len: pin.length, salt, hash: await pinHashStrong(pin, salt) });
}

/* ----- Wrong-PIN limit -----
   5 wrong tries → wait 30 seconds. Each wrong try after that doubles the wait (up to 15 minutes).
   The count is saved, so refreshing the page doesn't reset it. A right PIN clears it. */
const FREE_TRIES = 5;
function lockFails() {
  return S.get("lockfail", { n: 0, until: 0 });
}
function addFail() {
  const f = lockFails();
  f.n++;
  if (f.n >= FREE_TRIES) f.until = Date.now() + Math.min(30e3 * 2 ** (f.n - FREE_TRIES), 15 * 60e3);
  S.set("lockfail", f);
  return f;
}
function clearFails() {
  S.del("lockfail");
}

function pinPad(title, sub, onDone, extra, needLen) {
  needLen = needLen || PIN_LEN;
  const m = document.createElement("div");
  m.className = "lockscreen";
  let v = "";
  m.innerHTML = `<div class="lockbox" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="lockowl">${ic("lock")}</div><h2>${esc(title)}</h2><p class="muted" id="lsub">${esc(sub)}</p>
    <div class="dots" aria-hidden="true">${"<i></i>".repeat(needLen)}</div>
    <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map(k => (k === "" ? "<span></span>" : `<button class="key" data-k="${k}" aria-label="${k === "⌫" ? tr("Delete", "Borrar") : k}">${k}</button>`)).join("")}</div>
    <button class="btn primary" id="pinok" disabled>${tr("Continue", "Continuar")}</button>${extra || ""}</div>`;
  document.body.appendChild(m);
  const dots = () => {
    m.querySelectorAll(".dots i").forEach((d, i) => d.classList.toggle("on", i < v.length));
    m.querySelector("#pinok").disabled = v.length < needLen || waiting();
  };
  const waiting = () => Number(m.dataset.until || 0) > Date.now();
  const done = async () => {
    if (v.length === needLen && !waiting()) {
      const r = await onDone(v, m);
      if (r === false) {
        v = "";
        dots();
      }
    }
  };
  m.querySelectorAll("[data-k]").forEach(
    b =>
      (b.onclick = () => {
        const k = b.dataset.k;
        if (k === "⌫") v = v.slice(0, -1);
        else if (v.length < needLen && !waiting()) v += k;
        dots();
      })
  );
  m.querySelector("#pinok").onclick = done;
  m.addEventListener("keydown", e => {
    if (/^\d$/.test(e.key) && v.length < needLen && !waiting()) {
      v += e.key;
      dots();
    } else if (e.key === "Backspace") {
      v = v.slice(0, -1);
      dots();
    } else if (e.key === "Enter") done();
  });
  m.tabIndex = -1;
  m.focus();
  m.refresh = dots;
  return m;
}
function showLock() {
  const L = S.get("lock", null);
  if (!L || document.querySelector(".lockscreen")) return;
  let timer = null;
  const startWait = mm => {
    const sub = mm.querySelector("#lsub");
    clearInterval(timer);
    const tick = () => {
      const left = Math.ceil((lockFails().until - Date.now()) / 1000);
      if (left <= 0) {
        clearInterval(timer);
        mm.dataset.until = "";
        sub.textContent = tr("Enter your PIN", "Escriba su PIN");
        mm.refresh();
        return;
      }
      mm.dataset.until = String(lockFails().until);
      sub.textContent = tr(
        `Too many wrong tries. Wait ${left} seconds.`,
        `Demasiados intentos. Espere ${left} segundos.`
      );
      mm.refresh();
    };
    tick();
    timer = setInterval(tick, 1000);
  };
  const m = pinPad(
    tr("ScamSense is locked", "ScamSense está bloqueado"),
    tr("Enter your PIN", "Escriba su PIN"),
    async (pin, mm) => {
      if (lockFails().until > Date.now()) return false;
      if (await pinMatches(pin, L)) {
        clearFails();
        clearInterval(timer);
        if (L.v !== 2) await savePin(pin); // upgrade an older PIN to the stronger scrambling
        mm.remove();
        if ((L.len || pin.length) < PIN_LEN)
          toast(
            tr("Please change to a 6-digit PIN in Settings.", "Cambie a un PIN de 6 dígitos en Ajustes.")
          );
        return true;
      }
      const f = addFail();
      if (f.until > Date.now()) startWait(mm);
      else
        mm.querySelector("#lsub").textContent =
          FREE_TRIES - f.n === 1
            ? tr("Wrong PIN. 1 try left before a wait.", "PIN incorrecto. Queda 1 intento antes de esperar.")
            : tr(
                `Wrong PIN. ${FREE_TRIES - f.n} tries left before a wait.`,
                `PIN incorrecto. Quedan ${FREE_TRIES - f.n} intentos antes de esperar.`
              );
      return false;
    },
    `<button class="linkbtn" id="forgot">${tr("Forgot PIN?", "¿Olvidó su PIN?")}</button>`,
    L.len || (L.v === 2 ? PIN_LEN : 0) || 4
  );
  if (lockFails().until > Date.now()) startWait(m);
  m.querySelector("#forgot").onclick = function () {
    if (this.dataset.sure) {
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith("ss_"))
          .forEach(k => localStorage.removeItem(k));
        Object.keys(sessionStorage)
          .filter(k => k.startsWith("ss_"))
          .forEach(k => sessionStorage.removeItem(k));
      } catch (e) {}
      location.reload();
    } else {
      this.dataset.sure = "1";
      this.textContent = tr(
        "Tap again to delete all ScamSense data on this device and start over",
        "Toque otra vez para borrar todos los datos de ScamSense y empezar de nuevo"
      );
    }
  };
}
function setupPin(onDone) {
  pinPad(
    tr("Choose a PIN", "Elija un PIN"),
    tr("6 numbers. Don't use your birthday or 123456.", "6 números. No use su cumpleaños ni 123456."),
    async (p1, m1) => {
      if (/^(\d)\1+$/.test(p1) || "0123456789".includes(p1) || "9876543210".includes(p1)) {
        m1.querySelector("#lsub").textContent = tr(
          "That PIN is too easy to guess. Try another.",
          "Ese PIN es muy fácil de adivinar. Pruebe otro."
        );
        return false;
      }
      m1.remove();
      pinPad(
        tr("Enter it again", "Escríbalo otra vez"),
        tr("To make sure it's right", "Para confirmar"),
        async (p2, m2) => {
          if (p1 !== p2) {
            m2.querySelector("#lsub").textContent = tr(
              "The PINs didn't match. Try again.",
              "Los PIN no coinciden. Intente de nuevo."
            );
            return false;
          }
          await savePin(p2);
          clearFails();
          m2.remove();
          toast(tr("App lock is on.", "El bloqueo está activo."));
          onDone && onDone(true);
          return true;
        }
      );
    },
    `<button class="linkbtn" id="pincancel">${tr("Cancel", "Cancelar")}</button>`
  ).querySelector("#pincancel").onclick = e => {
    e.target.closest(".lockscreen").remove();
    onDone && onDone(false);
  };
}
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (hiddenAt && Date.now() - hiddenAt > 2 * 60e3) showLock();
});

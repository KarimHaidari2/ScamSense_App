/*
 * ScamSense · App lock
 * PIN lock on this device.
 */
"use strict";

async function pinHash(pin, salt) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + pin));
  return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, "0")).join("");
}
function pinPad(title, sub, onDone, extra) {
  const m = document.createElement("div");
  m.className = "lockscreen";
  let v = "";
  m.innerHTML = `<div class="lockbox" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="lockowl">${ic("lock")}</div><h2>${esc(title)}</h2><p class="muted" id="lsub">${esc(sub)}</p>
    <div class="dots" aria-hidden="true">${"<i></i>".repeat(6)}</div>
    <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map(k => (k === "" ? "<span></span>" : `<button class="key" data-k="${k}" aria-label="${k === "⌫" ? tr("Delete", "Borrar") : k}">${k}</button>`)).join("")}</div>
    <button class="btn primary" id="pinok" disabled>${tr("Continue", "Continuar")}</button>${extra || ""}</div>`;
  document.body.appendChild(m);
  const dots = () => {
    m.querySelectorAll(".dots i").forEach((d, i) => d.classList.toggle("on", i < v.length));
    m.querySelector("#pinok").disabled = v.length < 4;
  };
  const done = async () => {
    if (v.length >= 4) {
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
        else if (v.length < 6) v += k;
        dots();
      })
  );
  m.querySelector("#pinok").onclick = done;
  m.addEventListener("keydown", e => {
    if (/^\d$/.test(e.key) && v.length < 6) {
      v += e.key;
      dots();
    } else if (e.key === "Backspace") {
      v = v.slice(0, -1);
      dots();
    } else if (e.key === "Enter") done();
  });
  m.tabIndex = -1;
  m.focus();
  return m;
}
function showLock() {
  const L = S.get("lock", null);
  if (!L || document.querySelector(".lockscreen")) return;
  const m = pinPad(
    tr("ScamSense is locked", "ScamSense está bloqueado"),
    tr("Enter your PIN", "Escriba su PIN"),
    async (pin, mm) => {
      if ((await pinHash(pin, L.salt)) === L.hash) {
        mm.remove();
        return true;
      }
      mm.querySelector("#lsub").textContent = tr(
        "Wrong PIN. Try again.",
        "PIN incorrecto. Intente de nuevo."
      );
      return false;
    },
    `<button class="linkbtn" id="forgot">${tr("Forgot PIN?", "¿Olvidó su PIN?")}</button>`
  );
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
    tr("4 to 6 numbers", "De 4 a 6 números"),
    async (p1, m1) => {
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
          const salt = [...crypto.getRandomValues(new Uint8Array(12))]
            .map(x => x.toString(16).padStart(2, "0"))
            .join("");
          S.set("lock", { salt, hash: await pinHash(p2, salt) });
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

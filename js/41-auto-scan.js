/*
 * ScamSense · Checks email by itself
 * When the app is opened (or comes back to the screen) and the last check was more than
 * AUTO_SCAN_HOURS ago, ScamSense checks every connected mailbox without anyone tapping.
 *
 * Outlook keeps a renewable sign-in, so it is always checked quietly.
 * Gmail's key from Google lasts about an hour and can only be renewed by a tap (browsers block
 * Google's window without one). So when Gmail's key has run out, Home shows
 * "Check for new emails · last checked 9 hours ago" instead, and one tap checks everything.
 */
"use strict";

const AUTO_SCAN_HOURS = 6;
let autoScanLast = 0;

function lastScanAt() {
  const rep = S.get("report", null);
  return rep && rep.source !== "demo" ? +rep.at || 0 : 0;
}
function anyMailboxOn() {
  return !!S.get("connected", false) || outlookConnected();
}
/* How many mailboxes a scan checks: the main Gmail and Outlook, plus any extra ones. */
function mailboxCount() {
  return (
    (S.get("connected", false) ? 1 : 0) +
    (outlookConnected() ? 1 : 0) +
    (typeof extraBoxes === "function" ? extraBoxes().length : 0)
  );
}
function scanDue() {
  if (!anyMailboxOn()) return false;
  const at = lastScanAt();
  return !at || Date.now() - at > AUTO_SCAN_HOURS * 36e5;
}
/* Can we check without opening Google's window? */
function canScanQuietly() {
  if (S.get("connected", false) && !(token && Date.now() < tokenExp - 60000)) return false;
  if (outlookConnected() && !(S.get("ms", null) || {}).refresh) return false;
  return true;
}
function autoScanTick() {
  if (scanning || !scanDue() || !navigator.onLine) return;
  if (document.visibilityState !== "visible") return;
  // Only from Home, never in the middle of something else, a sign-in, or a locked app.
  if ((location.hash.slice(1) || "today") !== "today") return;
  if (document.querySelector(".lockscreen, .onb, #mbox-ask")) return;
  if (Date.now() - autoScanLast < 10 * 60000) return; // don't try again and again
  if (!canScanQuietly()) {
    renderToday(); // Home shows "Check for new emails" instead
    return;
  }
  autoScanLast = Date.now();
  scanEmail();
}
/* Home: the scan row's words when a check is due. */
function scanRowText() {
  if (!scanDue() || !lastScanAt()) return null;
  const h = Math.floor((Date.now() - lastScanAt()) / 36e5);
  const ago =
    h >= 48
      ? tr(`${Math.floor(h / 24)} days ago`, `hace ${Math.floor(h / 24)} días`)
      : tr(`${h} hours ago`, `hace ${h} horas`);
  const n = mailboxCount();
  return {
    title: tr("Check for new emails", "Revisar correos nuevos"),
    sub:
      tr(`Last checked ${ago}`, `Última revisión ${ago}`) +
      (n > 1 ? tr(` · all ${n} email accounts`, ` · sus ${n} cuentas de correo`) : "")
  };
}

addEventListener("visibilitychange", () => setTimeout(autoScanTick, 800));
addEventListener("online", () => setTimeout(autoScanTick, 1500));
setTimeout(autoScanTick, 2500); // just after the app opens
setInterval(autoScanTick, 30 * 60000); // and while it stays open

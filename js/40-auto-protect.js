/*
 * ScamSense · Automatic protection
 * "Move scams to Spam for me": after each scan, emails ScamSense is very sure are scams
 * (Scam, 90%+ risk, not from a sender they know) are moved out of the inbox to Spam / Junk
 * without anyone tapping. Each one can be put back with one tap, and that sender is then
 * never moved automatically again.
 *
 * Gmail: the one sign-in asks for permission to organize mail (gmail.modify), so the same key
 * reads and moves. Outlook: uses the "organize mail" sign-in (Mail.ReadWrite).
 * Extra mailboxes (39-more-mailboxes.js) are only warned about, not moved, for now.
 */
"use strict";

const G_MODIFY = "https://www.googleapis.com/auth/gmail.modify";
const AUTO_MIN_RISK = 90;
const autoSpamOn = () => !!S.get("autoSpam", false);
const notScamSenders = () => S.get("notScam", []) || [];

function autoProtectHTML() {
  const gmailOn = !!S.get("connected", false),
    outlookOn = outlookConnected();
  if (!gmailOn && !outlookOn) return "";
  return `<div class="grow"><span class="lead-ic l-green">${ic("shield")}</span><span class="gl"><b>${tr("Move scams to Spam for me", "Mover estafas a Spam por mí")}</b><span>${tr("When ScamSense is very sure an email is a scam, it moves it out of your inbox by itself. You can put any one back with one tap.", "Cuando ScamSense está muy seguro de que un correo es estafa, lo saca de su bandeja por sí solo. Puede devolver cualquiera con un toque.")}</span></span>${switchHTML("autosp", autoSpamOn(), tr("Move scams to Spam for me", "Mover estafas a Spam por mí"))}</div>`;
}
function bindAutoProtect(rerender) {
  const sw = document.getElementById("autosp");
  if (!sw) return;
  sw.onchange = async () => {
    if (typeof registerSoon === "function") setTimeout(registerSoon, 1500);
    if (!sw.checked) {
      S.set("autoSpam", false);
      toast(tr("Turned off. ScamSense will only warn you.", "Desactivado. ScamSense solo le avisará."));
      return;
    }
    S.set("autoSpam", true);
    // Gmail: ask Google once for permission to move emails (the same key then reads and moves).
    if (S.get("connected", false)) {
      token = null;
      try {
        await getToken(true);
      } catch (e) {
        S.set("autoSpam", false);
        sw.checked = false;
        toast(e.message);
        return;
      }
      if (!autoSpamOn()) {
        sw.checked = false;
        return; // Google didn't give the permission (getToken already said so)
      }
    }
    // Outlook: needs the "organize mail" sign-in once. Microsoft brings them back here.
    if (outlookConnected() && !outlookCanWrite()) {
      toast(
        tr(
          "Outlook will ask once for permission to move emails.",
          "Outlook pedirá una vez permiso para mover correos."
        )
      );
      setTimeout(() => connectOutlook(true), 900);
      return;
    }
    toast(
      tr(
        "On. ScamSense will move clear scams to Spam for you.",
        "Activado. ScamSense moverá las estafas claras a Spam por usted."
      )
    );
    if (typeof rerender === "function") rerender();
  };
}

/* Which emails get moved: only clear scams, still in the inbox, from the main mailboxes. */
function autoMovable(it) {
  if (it.level !== "scam" || it.inSpam || it.folder === "Spam" || it.folder === "Trash") return false;
  if (it.box || it._cached || it.autoMoved) return false;
  if (it.local && (it.local.trusted || it.local.known)) return false; // real companies and people they write to
  if (notScamSenders().includes(String(it.fromEmail || "").toLowerCase())) return false;
  if (typeof riskPct === "function" && riskPct(it) < AUTO_MIN_RISK) return false;
  if (it.source === "gmail") return !!(wtoken && Date.now() < wtokenExp - 60000);
  if (it.source === "outlook") return outlookCanWrite();
  return false;
}
/* Called after every scan. Moves quietly, then shows one line: "Moved 3 scams to Spam for you". */
async function autoMoveScams(items) {
  if (!autoSpamOn()) return 0;
  const list = items.filter(autoMovable).slice(0, 25);
  let moved = 0;
  for (const it of list) {
    try {
      if (await moveToSpam(it, true)) {
        it.autoMoved = true;
        moved++;
      }
    } catch (e) {}
  }
  if (!moved) return 0;
  // Keep the flag on the saved report so the list and Home can show it.
  const rep = S.get("report", null);
  if (rep) {
    const ids = new Set(list.filter(i => i.autoMoved).map(i => i.id));
    rep.items.forEach(x => ids.has(x.id) && (x.autoMoved = true));
    S.set("report", rep);
  }
  if (typeof serverEvent === "function") serverEvent({ t: "block", c: "email", n: moved, auto: true });
  toast(
    tr(
      `Moved ${moved} scam${moved === 1 ? "" : "s"} to Spam for you.`,
      `Movimos ${moved} estafa${moved === 1 ? "" : "s"} a Spam por usted.`
    )
  );
  return moved;
}
/* "Not a scam? Put it back": back to the inbox, and never move this sender automatically again. */
async function putBack(it) {
  if (it.source === "gmail")
    await gsend(`messages/${encodeURIComponent(it.id)}/modify`, "POST", {
      addLabelIds: ["INBOX"],
      removeLabelIds: ["SPAM"]
    });
  else if (it.source === "outlook")
    await msGet(`me/messages/${encodeURIComponent(it.id)}/move`, "POST", { destinationId: "inbox" });
  else return false;
  const who = String(it.fromEmail || "").toLowerCase();
  if (who) S.set("notScam", [who].concat(notScamSenders().filter(x => x !== who)).slice(0, 200));
  markMoved(it.id, "Inbox");
  const rep = S.get("report", null);
  if (rep) {
    rep.items.forEach(x => x.id === it.id && (x.autoMoved = false));
    S.set("report", rep);
  }
  it.autoMoved = false;
  it.inSpam = false;
  it.folder = "Inbox";
  toast(
    tr(
      "Put back in your inbox. ScamSense won't move this sender again.",
      "Devuelto a su bandeja. ScamSense no moverá a este remitente otra vez."
    )
  );
  return true;
}
/* Home: one line about what was moved in the latest scan. */
function autoMovedHTML(rep) {
  if (!rep || rep.source === "demo") return "";
  const n = rep.items.filter(i => i.autoMoved).length;
  if (!n) return "";
  return `<button class="grow automoved" data-home="emails"><span class="lead-ic l-green">${ic("shield")}</span><span class="gl"><b>${tr(`Moved ${n} scam${n === 1 ? "" : "s"} to Spam for you`, `Movimos ${n} estafa${n === 1 ? "" : "s"} a Spam`)}</b><span>${tr("You don't need to do anything. Tap to see them.", "No necesita hacer nada. Toque para verlas.")}</span></span>${ic("chev", "chev")}</button>`;
}

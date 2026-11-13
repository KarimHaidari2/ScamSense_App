/*
 * ScamSense · Send a text to ScamSense
 * Phones don't let a website read texts. So people send a suspicious text TO ScamSense instead:
 *  - any phone: open ScamSense with a link like ScamSense_App/?check=the text
 *  - Android: Share → ScamSense (after adding ScamSense to the Home Screen)
 *  - iPhone: a one-tap Shortcut that checks whatever you copied
 */
"use strict";

const APP_URL = "https://karimhaidari2.github.io/ScamSense_App/";

/* Opens Check something with shared or linked text already in the box, and checks it. */
function openSharedText() {
  const q = new URLSearchParams(location.search);
  const shared = [q.get("check"), q.get("title"), q.get("text"), q.get("url")]
    .filter(Boolean)
    .join("\n")
    .trim();
  if (!shared) return false;
  history.replaceState(null, "", location.pathname + "#check");
  checkDraft = shared.slice(0, 5000);
  go("check");
  setTimeout(() => runCheck(), 50);
  return true;
}

function renderShare() {
  const step = (n, txt) => `<li><span class="stepn">${n}</span><span>${txt}</span></li>`;
  view.innerHTML = `${pageHead(tr("Send a text to ScamSense", "Enviar un texto a ScamSense"), tr("Phones don't let apps on the web read your texts. Instead, send a text you're unsure about to ScamSense. It takes 2 taps.", "Los teléfonos no dejan que las apps web lean sus textos. En cambio, envíe a ScamSense el texto que le preocupa. Son 2 toques."), "settings")}
  <section class="sect"><h2 class="sect-h">iPhone</h2><div class="card howto">
    <p><b>${tr("Set up once: a ScamSense button for copied text", "Configure una vez: un botón de ScamSense para el texto copiado")}</b></p>
    <ol class="steplist">
      ${step(1, tr("Open the <b>Shortcuts</b> app and tap <b>+</b>.", "Abra la app <b>Atajos</b> y toque <b>+</b>."))}
      ${step(2, tr("Add the action <b>Get Clipboard</b>.", "Agregue la acción <b>Obtener portapapeles</b>."))}
      ${step(3, tr("Add <b>URL Encode</b>.", "Agregue <b>Codificar URL</b>."))}
      ${step(4, tr(`Add <b>Open URLs</b> and type <code>${APP_URL}?check=</code> then insert <b>URL Encoded Text</b> right after it.`, `Agregue <b>Abrir URL</b> y escriba <code>${APP_URL}?check=</code> y luego inserte <b>Texto codificado</b> justo después.`))}
      ${step(5, tr("Name it <b>Check with ScamSense</b>, then tap <b>Share → Add to Home Screen</b>.", "Llámelo <b>Revisar con ScamSense</b> y toque <b>Compartir → Agregar a inicio</b>."))}
    </ol>
    <p><b>${tr("Every time after that", "Desde entonces, cada vez")}</b></p>
    <ol class="steplist">
      ${step(1, tr("In Messages, press and hold the text, then tap <b>Copy</b>.", "En Mensajes, mantenga presionado el texto y toque <b>Copiar</b>."))}
      ${step(2, tr("Tap <b>Check with ScamSense</b> on your Home Screen. The answer shows right away.", "Toque <b>Revisar con ScamSense</b> en su pantalla de inicio. La respuesta aparece enseguida."))}
    </ol></div></section>
  <section class="sect"><h2 class="sect-h">Android</h2><div class="card howto">
    <ol class="steplist">
      ${step(1, tr("Open ScamSense in <b>Chrome</b>, tap <b>⋮ → Add to Home screen → Install</b> (once).", "Abra ScamSense en <b>Chrome</b>, toque <b>⋮ → Agregar a la pantalla principal → Instalar</b> (una vez)."))}
      ${step(2, tr("In Messages, press and hold the text, tap <b>Share</b>, then choose <b>ScamSense</b>.", "En Mensajes, mantenga presionado el texto, toque <b>Compartir</b> y elija <b>ScamSense</b>."))}
    </ol></div></section>
  <section class="sect"><h2 class="sect-h">${tr("Any phone or computer", "Cualquier teléfono o computadora")}</h2><div class="card howto">
    <p>${tr("Copy the text, open ScamSense, tap <b>Check something</b>, and paste it in the box.", "Copie el texto, abra ScamSense, toque <b>Revisar algo</b> y péguelo en el cuadro.")}</p>
    <button class="btn primary" data-go="check">${tr("Open Check something", "Abrir Revisar algo")}</button></div></section>
  <p class="footnote">${ic("lock")}${tr("Only the text you send is checked. ScamSense can't see your other messages.", "Solo se revisa el texto que envía. ScamSense no puede ver sus otros mensajes.")}</p>`;
  bindBack();
  bindGo();
}

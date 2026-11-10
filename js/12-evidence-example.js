/*
 * ScamSense · Evidence and example case
 * Screenshots the user adds, the example case, and where to send each report.
 */
"use strict";

let evidence = []; // [{src:dataURL(jpeg), cap:string, w, h}] kept in memory only, never saved
let scamExample = false;
function wrapLines(ctx, text, maxW) {
  const words = String(text).split(" ");
  const lines = [];
  let cur = "";
  words.forEach(w => {
    const tst = cur ? cur + " " + w : w;
    if (ctx.measureText(tst).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = tst;
  });
  if (cur) lines.push(cur);
  return lines;
}
function stampExample(ctx, W, H) {
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-Math.PI / 7);
  ctx.fillStyle = "rgba(200,30,30,.18)";
  ctx.font = "bold 110px Helvetica,Arial";
  ctx.textAlign = "center";
  ctx.fillText("EXAMPLE", 0, 30);
  ctx.restore();
}
function phoneCanvas(draw) {
  const W = 540,
    H = 960;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = "#ffffff";
  x.fillRect(0, 0, W, H);
  x.fillStyle = "#111";
  x.font = "600 22px Helvetica,Arial";
  x.fillText("3:21", 28, 40);
  x.fillText("▮▮▮ 5G", W - 120, 40);
  draw(x, W, H);
  stampExample(x, W, H);
  return { src: c.toDataURL("image/jpeg", 0.85), w: W, h: H };
}
function sampleShots() {
  const sms = phoneCanvas((x, W) => {
    x.fillStyle = "#f2f2f7";
    x.fillRect(0, 60, W, 110);
    x.fillStyle = "#9aa0a6";
    x.beginPath();
    x.arc(W / 2, 100, 26, 0, 7);
    x.fill();
    x.fillStyle = "#111";
    x.font = "600 22px Helvetica,Arial";
    x.textAlign = "center";
    x.fillText("+1 (469) 555-0182", W / 2, 152);
    x.textAlign = "left";
    x.fillStyle = "#8e8e93";
    x.font = "18px Helvetica,Arial";
    x.textAlign = "center";
    x.fillText("Text Message · Yesterday 2:58 PM", W / 2, 205);
    x.textAlign = "left";
    let y = 230;
    const bubble = (t, me) => {
      x.font = "24px Helvetica,Arial";
      const ls = wrapLines(x, t, 330);
      const h = ls.length * 31 + 26;
      const bw = Math.max(...ls.map(l => x.measureText(l).width)) + 36;
      const bx = me ? W - bw - 24 : 24;
      x.fillStyle = me ? "#0a84ff" : "#e9e9eb";
      x.beginPath();
      x.roundRect(bx, y, bw, h, 22);
      x.fill();
      x.fillStyle = me ? "#fff" : "#111";
      ls.forEach((l, i) => x.fillText(l, bx + 18, y + 36 + i * 31));
      y += h + 18;
    };
    bubble(
      "Chase Fraud Alert: Did you attempt a Zelle payment of $1,250.00 to MARK R? Reply YES or NO.",
      false
    );
    bubble("NO", true);
    bubble(
      "Thank you. A fraud specialist will call you shortly to secure your account. Do not log in until then.",
      false
    );
    bubble("Your verification code is 482915. Do not share this code with anyone.", false);
  });
  const calls = phoneCanvas((x, W) => {
    x.fillStyle = "#111";
    x.font = "bold 40px Helvetica,Arial";
    x.fillText("Recents", 28, 120);
    const row = (y, name, sub, time, red) => {
      x.fillStyle = red ? "#d70015" : "#111";
      x.font = "600 26px Helvetica,Arial";
      x.fillText(name, 28, y);
      x.fillStyle = "#8e8e93";
      x.font = "20px Helvetica,Arial";
      x.fillText(sub, 28, y + 30);
      x.textAlign = "right";
      x.fillText(time, W - 28, y + 12);
      x.textAlign = "left";
      x.fillStyle = "#e5e5ea";
      x.fillRect(28, y + 52, W - 56, 2);
    };
    row(190, "CHASE FRAUD DEPT", "+1 (800) 555-0144 · 23 min", "Yesterday");
    row(280, "CHASE FRAUD DEPT", "+1 (800) 555-0144 · 6 min", "Yesterday");
    row(370, "+1 (469) 555-0182", "Missed", "Yesterday", true);
    row(460, "Sara (daughter)", "mobile", "Monday");
    x.fillStyle = "#fff4e5";
    x.beginPath();
    x.roundRect(28, 560, W - 56, 150, 16);
    x.fill();
    x.fillStyle = "#7a4b00";
    x.font = "20px Helvetica,Arial";
    wrapLines(
      x,
      'Note: caller ID can be faked. The name "CHASE FRAUD DEPT" was shown, but the call did not come from Chase.',
      W - 96
    ).forEach((l, i) => x.fillText(l, 48, 600 + i * 28));
  });
  const pay = phoneCanvas((x, W) => {
    x.fillStyle = "#1f7a3e";
    x.beginPath();
    x.arc(W / 2, 190, 54, 0, 7);
    x.fill();
    x.strokeStyle = "#fff";
    x.lineWidth = 10;
    x.beginPath();
    x.moveTo(W / 2 - 24, 190);
    x.lineTo(W / 2 - 6, 210);
    x.lineTo(W / 2 + 28, 170);
    x.stroke();
    x.fillStyle = "#111";
    x.textAlign = "center";
    x.font = "600 30px Helvetica,Arial";
    x.fillText("Transfer sent", W / 2, 300);
    x.font = "bold 64px Helvetica,Arial";
    x.fillText("$1,250.00", W / 2, 380);
    x.font = "22px Helvetica,Arial";
    x.fillStyle = "#555";
    x.fillText("Yesterday at 3:21 PM", W / 2, 420);
    x.textAlign = "left";
    const kv = (y, k, v) => {
      x.fillStyle = "#8e8e93";
      x.font = "20px Helvetica,Arial";
      x.fillText(k, 40, y);
      x.fillStyle = "#111";
      x.font = "600 22px Helvetica,Arial";
      x.textAlign = "right";
      x.fillText(v, W - 40, y);
      x.textAlign = "left";
      x.fillStyle = "#e5e5ea";
      x.fillRect(40, y + 18, W - 80, 2);
    };
    kv(500, "To", "ACCOUNT PROTECTION");
    kv(560, "Phone", "(469) 555-0182");
    kv(620, "From", "Checking ••4421");
    kv(680, "Method", "Zelle");
    kv(740, "Confirmation", "ZK7Q2M9P1");
  });
  return [
    Object.assign(sms, {
      cap: tr(
        "Text message that started the scam (fake fraud alert, then a real security code).",
        "Texto que inició la estafa (alerta falsa y luego un código real)."
      )
    }),
    Object.assign(calls, {
      cap: tr(
        'Call log: the caller ID showed "CHASE FRAUD DEPT", but caller ID can be faked.',
        'Registro de llamadas: decía "CHASE FRAUD DEPT", pero el identificador se puede falsificar.'
      )
    }),
    Object.assign(pay, {
      cap: tr(
        'Payment receipt: $1,250 sent by Zelle to "ACCOUNT PROTECTION".',
        'Recibo: $1,250 enviados por Zelle a "ACCOUNT PROTECTION".'
      )
    })
  ];
}
function loadExample() {
  const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  scamState = {
    how: "call",
    what: ["paid", "bank", "pass"],
    method: "bank",
    amt: "1,250",
    date: y,
    pretend: "Chase Fraud Department",
    org: "chase",
    bank: "chase",
    bankName: "",
    last4: "4421",
    contact:
      'Text from +1 (469) 555-0182; calls from +1 (800) 555-0144 (caller ID showed "CHASE FRAUD DEPT")',
    story: tr(
      'I got a text that looked like a Chase fraud alert asking if I sent $1,250 by Zelle. I replied NO. A few minutes later a man called. My phone showed "CHASE FRAUD DEPT". He said hackers were in my account and he needed to "verify" me, so I read him the code that was texted to me. He then said I had to move my money to a "protected account" and told me to send $1,250 by Zelle to ACCOUNT PROTECTION. I did. Later I called the number on the back of my card and Chase said they never called me.',
      'Recibí un texto que parecía una alerta de fraude de Chase preguntando si envié $1,250 por Zelle. Respondí NO. Minutos después me llamó un hombre. Mi teléfono decía "CHASE FRAUD DEPT". Dijo que había hackers en mi cuenta y que necesitaba "verificarme", así que le leí el código que me llegó por texto. Luego dijo que debía mover mi dinero a una "cuenta protegida" y me pidió enviar $1,250 por Zelle a ACCOUNT PROTECTION. Lo hice. Después llamé al número del reverso de mi tarjeta y Chase dijo que nunca me llamaron.'
    )
  };
  evidence = sampleShots();
  scamExample = true;
  renderScammed();
  toast(
    tr(
      "Example case filled in. Scroll down and tap the button to make the report.",
      "Caso de ejemplo listo. Baje y toque el botón para crear el reporte."
    )
  );
}
async function addEvidenceFiles(files) {
  for (const f of files) {
    if (!/^image\//.test(f.type)) continue;
    try {
      const url = URL.createObjectURL(f);
      const img = await new Promise((ok, no) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = no;
        i.src = url;
      });
      const sc = Math.min(1, 1100 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * sc);
      c.height = Math.round(img.height * sc);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      evidence.push({ src: c.toDataURL("image/jpeg", 0.82), w: c.width, h: c.height, cap: f.name });
    } catch (e) {
      toast(tr("That picture couldn't be added.", "No se pudo agregar esa imagen."));
    }
  }
  renderThumbs();
}
function renderThumbs() {
  const el = document.getElementById("thumbs");
  if (!el) return;
  el.innerHTML = evidence
    .map(
      (e, i) =>
        `<figure class="thumb"><img src="${e.src}" alt=""><figcaption>${esc(e.cap)}</figcaption><button type="button" class="thumb-x" data-x="${i}" aria-label="${tr("Remove", "Quitar")}">×</button></figure>`
    )
    .join("");
  el.querySelectorAll("[data-x]").forEach(
    b =>
      (b.onclick = () => {
        evidence.splice(+b.dataset.x, 1);
        renderThumbs();
      })
  );
}

/* Where to send the report, best option first */
function sendList(s, bankNm) {
  const L = [];
  const o = ORGS[s.bank];
  if (s.bank || ["credit", "debit", "bank"].includes(s.method))
    L.push({
      type: "bank",
      name: bankNm || tr("Your bank or card company", "Su banco o tarjeta"),
      lines: o ? o.lines : [],
      web: o && o.w,
      note: o && o.en ? tr(o.en, o.es) : "",
      when: tr(
        "Today, right away. This is your best chance to stop or reverse the payment.",
        "Hoy, de inmediato. Es su mejor oportunidad de detener o revertir el pago."
      ),
      how: tr(
        "Call first and tell them it's fraud. If they want it in writing, send their document. Ask for a case number.",
        "Llame primero y diga que es fraude. Si lo piden por escrito, envíe su documento. Pida un número de caso."
      )
    });
  const pm = {
    app: [
      tr("The payment app (PayPal, Venmo, or Cash App)", "La app de pago (PayPal, Venmo o Cash App)"),
      tr(
        "Report the payment inside the app and ask them to reverse it.",
        "Reporte el pago dentro de la app y pida revertirlo."
      )
    ],
    gift: [
      tr("The gift card company", "La compañía de la tarjeta de regalo"),
      tr(
        "Call the number on the back of the card. Say a scammer has the number and PIN. Keep the card and receipt.",
        "Llame al número del reverso. Diga que un estafador tiene el número y el PIN. Guarde la tarjeta y el recibo."
      )
    ],
    wire: [
      tr("Western Union or MoneyGram", "Western Union o MoneyGram"),
      tr("Call right away and ask them to stop the transfer.", "Llame de inmediato y pida detener el envío.")
    ],
    crypto: [
      tr("The crypto exchange or Bitcoin ATM company", "La plataforma de cripto o la empresa del cajero"),
      tr(
        "Report the transaction as fraud and ask them to reverse it.",
        "Reporte la transacción como fraude y pida revertirla."
      )
    ],
    cashmail: [
      "U.S. Postal Inspection Service",
      tr(
        "Call 1-877-876-2455 right away. They may stop the package.",
        "Llame al 1-877-876-2455 de inmediato. Pueden detener el paquete."
      ),
      "1-877-876-2455"
    ],
    courier: [
      tr("The delivery company (FedEx, UPS, or other)", "La empresa de envíos (FedEx, UPS u otra)"),
      tr("Call right away and ask them to stop the package.", "Llame de inmediato y pida detener el paquete.")
    ]
  }[s.method];
  if (pm)
    L.push({
      type: "payment",
      name: pm[0],
      lines: pm[2] ? [["", "", pm[2]]] : [],
      when: tr("Today, right away.", "Hoy, de inmediato."),
      how: pm[1]
    });
  L.push({
    type: "ftc",
    name: tr("Federal Trade Commission (FTC)", "Comisión Federal de Comercio (FTC)"),
    web: "https://reportfraud.ftc.gov",
    when: tr("Today or this week.", "Hoy o esta semana."),
    how: tr(
      "Fill in the online form using page 1 of this report. Save the FTC report number they give you; your bank or police may ask for it.",
      "Llene el formulario en línea con la página 1 de este reporte. Guarde el número de reporte de la FTC; su banco o la policía pueden pedirlo."
    )
  });
  L.push({
    type: "police",
    name: tr("Your local police (non-emergency line)", "Su policía local (línea que no es de emergencia)"),
    when: tr("This week.", "Esta semana."),
    how: tr(
      "Bring a printed copy of this report and your screenshots. Ask for a police report number. Some banks ask for one.",
      "Lleve una copia impresa de este reporte y sus capturas. Pida un número de reporte policial. Algunos bancos lo piden."
    )
  });
  if (
    ["email", "text", "web", "social"].includes(s.how) ||
    ["crypto", "wire"].includes(s.method) ||
    parseFloat(String(s.amt).replace(/[^\d.]/g, "")) >= 1000
  )
    L.push({
      type: "ic3",
      name: tr(
        "FBI Internet Crime Complaint Center (IC3)",
        "Centro de Denuncias de Delitos en Internet del FBI (IC3)"
      ),
      web: "https://www.ic3.gov",
      when: tr("This week.", "Esta semana."),
      how: tr(
        "File online. Include the phone numbers, websites, and payment details from this report.",
        "Presente la denuncia en línea con los números, sitios y datos de pago de este reporte."
      )
    });
  if (s.method === "crypto" || s.crypto)
    L.push({
      type: "company",
      name: tr("Chainabuse (public crypto scam reports)", "Chainabuse (reportes públicos de estafas cripto)"),
      web: "https://www.chainabuse.com/report",
      when: tr("This week.", "Esta semana."),
      how: tr(
        "Report the scammer's wallet addresses and website so others are warned, like the ScamBusters do.",
        "Reporte las billeteras y el sitio del estafador para advertir a otros, como hacen los ScamBusters."
      )
    });
  if (s.org && s.org !== s.bank && ORGS[s.org]) {
    const g = ORGS[s.org];
    L.push({
      type: "company",
      name: orgName(s.org, s.pretend) || tr("The company they pretended to be", "La empresa que suplantaron"),
      lines: g.lines,
      web: g.w,
      mail: g.mail,
      when: tr("This week.", "Esta semana."),
      how: g.en
        ? tr(g.en, g.es)
        : tr("Report that someone is pretending to be them.", "Reporte que alguien se hace pasar por ellos.")
    });
  }
  if (s.what.includes("ssn"))
    L.push({
      type: "idt",
      name: "IdentityTheft.gov",
      web: "https://www.identitytheft.gov",
      when: tr("Today.", "Hoy."),
      how: tr(
        "Get a recovery plan, then freeze your credit for free: Equifax 1-800-685-1111, Experian 1-888-397-3742, TransUnion 1-888-909-8872.",
        "Reciba un plan de recuperación y congele su crédito gratis: Equifax 1-800-685-1111, Experian 1-888-397-3742, TransUnion 1-888-909-8872."
      )
    });
  L.push({
    type: "elder",
    name: tr("National Elder Fraud Hotline (age 60+)", "Línea Nacional de Fraude contra Mayores (60+)"),
    lines: [["", "", "1-833-372-8311"]],
    when: tr("Anytime you want help.", "Cuando necesite ayuda."),
    how: tr(
      "A free case manager can help you file these reports.",
      "Un especialista gratuito le ayuda a presentar estos reportes."
    )
  });
  return L;
}
function sendListHTML(L, withDocs) {
  return `<ol class="sendlist">${L.map(
    (
      x,
      i
    ) => `<li class="${i === 0 ? "best" : ""}">${i === 0 ? `<span class="besttag">${tr("Best first step", "Mejor primer paso")}</span>` : ""}
    <b>${esc(x.name)}</b><span class="small"><b>${tr("When", "Cuándo")}:</b> ${esc(x.when)}</span><span class="small">${esc(x.how)}</span>
    <span class="contact-acts">${(x.lines || []).map(l => `<a class="btn ghost sm" href="tel:${l[2].replace(/[^\d]/g, "")}">📞 ${esc(l[2])}${l[0] ? ` · ${esc(tr(l[0], l[1]))}` : ""}</a>`).join("")}
    ${x.web ? `<a class="btn ghost sm" href="${x.web}" target="_blank" rel="noopener">${esc(x.web.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))} ↗</a>` : ""}${x.mail ? `<span class="btn ghost sm" style="user-select:all">✉ ${esc(x.mail)}</span>` : ""}</span>
    ${withDocs && x.type !== "elder" ? `<button class="btn primary sm docbtn" data-doc="${i}">📄 ${tr("Get the document for", "Obtener el documento para")} ${esc(shortName(x))}</button>` : ""}</li>`
  ).join("")}</ol>`;
}
const shortName = x =>
  ({ ftc: "FTC", ic3: "IC3", police: tr("the police", "la policía"), idt: "IdentityTheft.gov" })[x.type] ||
  x.name;

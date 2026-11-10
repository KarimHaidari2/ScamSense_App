/*
 * ScamSense · PDF documents
 * Makes the case file and one document per office, on this device (jsPDF).
 */
"use strict";

const pdfSafe = s =>
  String(s == null ? "" : s)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[•]/g, "-")
    .replace(/[—–]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ]/g, "");
function pdfKit(title, subtitle, example) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = 612,
    H = 792,
    M = 50,
    CW = W - 2 * M;
  const K = { doc, y: 0, M, CW };
  const teal = [14, 124, 123],
    ink = [14, 59, 67],
    muted = [90, 110, 115],
    red = [180, 35, 24];
  K.c = { teal, ink, muted, red };
  K.newPage = () => {
    doc.addPage();
    K.y = M;
  };
  K.need = h => {
    if (K.y + h > H - 60) K.newPage();
  };
  K.text = (s, { size = 11, bold = false, color = ink, indent = 0, gap = 4 } = {}) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    String(pdfSafe(s))
      .split("\n")
      .forEach(par => {
        const ls = par ? doc.splitTextToSize(par, CW - indent) : [""];
        ls.forEach(l => {
          K.need(size * 1.35);
          doc.text(l, M + indent, K.y + size);
          K.y += size * 1.35;
        });
      });
    K.y += gap;
  };
  K.h2 = s => {
    K.need(40);
    K.y += 8;
    doc.setFillColor(...teal);
    doc.rect(M, K.y, 4, 18, "F");
    K.text(s, { size: 14, bold: true, indent: 12, gap: 6 });
  };
  K.kv = rows =>
    rows.forEach(([k, v]) => {
      K.need(18);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...muted);
      doc.text(doc.splitTextToSize(pdfSafe(k), 160)[0], M, K.y + 10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...ink);
      doc.splitTextToSize(pdfSafe(v || "-"), CW - 170).forEach(l => {
        K.need(14);
        doc.text(l, M + 170, K.y + 10);
        K.y += 14;
      });
      K.y += 4;
      doc.setDrawColor(225, 232, 231);
      doc.line(M, K.y, M + CW, K.y);
      K.y += 6;
    });
  K.box = (lines, { fill = [226, 241, 240], stroke = teal, head = "" } = {}) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const wrapped = lines.map(l => doc.splitTextToSize(pdfSafe(l), CW - 28));
    const h = (head ? 22 : 0) + wrapped.reduce((a, w) => a + w.length * 15 + 4, 0) + 20;
    K.need(h);
    doc.setFillColor(...fill);
    doc.setDrawColor(...stroke);
    doc.setLineWidth(1.5);
    doc.roundedRect(M, K.y, CW, h, 8, 8, "FD");
    doc.setLineWidth(0.5);
    let yy = K.y + 20;
    if (head) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...stroke);
      doc.text(pdfSafe(head), M + 14, yy);
      yy += 20;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...ink);
    wrapped.forEach(w => {
      w.forEach(l => {
        doc.text(l, M + 14, yy);
        yy += 15;
      });
      yy += 4;
    });
    K.y += h + 12;
  };
  K.images = imgs => {
    const colW = (CW - 20) / 2;
    let col = 0,
      rowH = 0;
    imgs.forEach((e, i) => {
      const sc = Math.min(colW / e.w, 300 / e.h);
      const iw = e.w * sc,
        ih = e.h * sc;
      const cap = doc.splitTextToSize(pdfSafe(`${tr("Figure", "Figura")} ${i + 1}. ${e.cap}`), colW);
      const bh = ih + cap.length * 12 + 16;
      if (col === 0) K.need(bh);
      const x = M + col * (colW + 20);
      doc.setDrawColor(213, 226, 224);
      doc.rect(x, K.y, iw, ih);
      doc.addImage(e.src, "JPEG", x, K.y, iw, ih);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...muted);
      cap.forEach((l, j) => doc.text(l, x, K.y + ih + 12 + j * 12));
      rowH = Math.max(rowH, bh);
      col++;
      if (col === 2) {
        col = 0;
        K.y += rowH + 8;
        rowH = 0;
      }
    });
    if (col === 1) K.y += rowH + 8;
  };
  K.evidence = (imgs, n) => {
    if (!imgs.length) return;
    const colW = (CW - 20) / 2;
    const e0 = imgs[0];
    K.need(Math.min(colW / e0.w, 300 / e0.h) * e0.h + 90);
    K.h2(`${n}. ${tr("Evidence (screenshots)", "Pruebas (capturas de pantalla)")}`);
    K.images(imgs);
  };
  // header band
  doc.setFillColor(...teal);
  doc.rect(0, 0, W, 84, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(doc.splitTextToSize(pdfSafe(title), CW)[0], M, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(pdfSafe(subtitle), M, 62);
  K.y = 104;
  if (example) {
    doc.setFillColor(253, 231, 228);
    doc.setDrawColor(...red);
    doc.roundedRect(M, K.y, CW, 36, 6, 6, "FD");
    doc.setTextColor(...red);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(
      pdfSafe(
        tr(
          "EXAMPLE: a made-up case for demonstration. Not a real report.",
          "EJEMPLO: caso inventado para demostración. No es un reporte real."
        )
      ),
      M + 12,
      K.y + 22
    );
    K.y += 50;
  }
  K.finish = () => {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...muted);
      doc.text(
        pdfSafe(
          tr(
            "Prepared with ScamSense. Facts as reported by the person filing.",
            "Preparado con ScamSense. Hechos según la persona que reporta."
          )
        ),
        M,
        H - 28
      );
      doc.text(`${i} / ${pages}`, W - M, H - 28, { align: "right" });
    }
    return doc;
  };
  return K;
}
const stamp = () => new Date().toLocaleString(uiLang() === "es" ? "es-US" : "en-US");

/* 1) My case file: everything, for the person to keep */
function makeCaseFilePDF(P) {
  const K = pdfKit(
    tr("My Scam Case File", "Mi expediente de estafa"),
    `${tr("Keep this copy for yourself. Don't send this one.", "Guarde esta copia. No envíe esta.")} · ${stamp()}`,
    P.example
  );
  K.box(
    [
      tr(
        "This file keeps everything in one place: what happened, your screenshots, where you reported it, and your case numbers.",
        "Este archivo guarda todo en un lugar: qué pasó, sus capturas, dónde lo reportó y sus números de caso."
      ),
      tr(
        "To report to an office, use the separate document made for that office.",
        "Para reportar a una oficina, use el documento separado para esa oficina."
      )
    ],
    { head: tr("Keep this copy", "Guarde esta copia") }
  );
  K.h2(tr("1. Case summary", "1. Resumen del caso"));
  K.kv(P.summary);
  K.h2(tr("2. What happened", "2. Qué pasó"));
  K.text(P.story || "-");
  K.evidence(P.evidence, 3);
  const n = P.evidence.length ? 4 : 3;
  K.h2(`${n}. ${tr("Where I reported it (fill in as you go)", "Dónde lo reporté (anótelo al hacerlo)")}`);
  const cols = [
    tr("Office", "Oficina"),
    tr("Date", "Fecha"),
    tr("Case / report number", "Número de caso"),
    tr("Person you spoke with", "Persona con quien habló")
  ];
  const cw = [170, 70, 140, K.CW - 380];
  const d = K.doc;
  const row = (vals, head) => {
    K.need(26);
    let x = K.M;
    d.setFont("helvetica", head ? "bold" : "normal");
    d.setFontSize(9);
    d.setTextColor(...(head ? K.c.muted : K.c.ink));
    vals.forEach((v, i) => {
      d.setDrawColor(200, 210, 208);
      d.rect(x, K.y, cw[i], 24);
      d.text(d.splitTextToSize(pdfSafe(v), cw[i] - 8)[0] || "", x + 4, K.y + 15);
      x += cw[i];
    });
    K.y += 24;
  };
  row(cols, true);
  P.send.forEach(x => row([x.name, "", "", ""]));
  K.y += 10;
  K.text(
    tr(
      "Never pay anyone who offers to recover your money for a fee. No real agency charges to recover money.",
      "Nunca pague a quien ofrezca recuperar su dinero a cambio de un pago. Ninguna agencia real cobra por eso."
    ),
    { size: 10, bold: true, color: K.c.red }
  );
  return K.finish();
}

/* 2) One document per office, with only what that office needs */
function howToSend(x) {
  const ph = (x.lines || []).map(
    l => `${l[2]}${l[0] ? " (" + tr(l[0], l[1]) + (l[3] ? ", " + l[3] : "") + ")" : ""}`
  );
  const S = {
    bank: [
      ph.length
        ? tr(
            `Call the fraud line first: ${ph.join(" or ")}.`,
            `Llame primero a la línea de fraude: ${ph.join(" o ")}.`
          )
        : tr(
            "Call the fraud number on the back of your card or on your statement.",
            "Llame al número de fraude del reverso de su tarjeta o de su estado de cuenta."
          ),
      tr(
        "Tell them it's fraud and read them page 1. Ask them to lock your card and reverse the payment.",
        "Diga que es fraude y léales la página 1. Pida bloquear su tarjeta y revertir el pago."
      ),
      tr(
        "If they ask for it in writing, send this document through your bank's app (secure message) or bring it to a branch.",
        "Si lo piden por escrito, envíe este documento por la app de su banco (mensaje seguro) o llévelo a una sucursal."
      ),
      tr("Write down the case number they give you.", "Anote el número de caso que le den.")
    ],
    payment: [
      ...(ph.length ? [tr(`Call: ${ph.join(" or ")}.`, `Llame: ${ph.join(" o ")}.`)] : []),
      x.how,
      tr("Read them page 1 and ask for a case number.", "Léales la página 1 y pida un número de caso.")
    ],
    ftc: [
      tr(
        'Go to ReportFraud.ftc.gov and click "Report Now".',
        'Vaya a ReportFraud.ftc.gov y haga clic en "Report Now".'
      ),
      tr(
        "Answer each question using the answers on page 1. You can copy and paste them.",
        "Responda cada pregunta con las respuestas de la página 1. Puede copiarlas y pegarlas."
      ),
      tr(
        "At the end, save or print your FTC report number. Your bank or police may ask for it.",
        "Al final, guarde o imprima su número de reporte de la FTC. Su banco o la policía pueden pedirlo."
      )
    ],
    police: [
      tr(
        "Call your local police non-emergency number, or go to the station. (If you're in danger, call 911.)",
        "Llame al número que no es de emergencia de su policía local, o vaya a la estación. (Si está en peligro, llame al 911.)"
      ),
      tr(
        "Say you want to file a report for fraud. Bring this document printed, with the screenshots.",
        "Diga que quiere hacer un reporte de fraude. Lleve este documento impreso, con las capturas."
      ),
      tr("Ask for a police report number and write it down.", "Pida un número de reporte policial y anótelo.")
    ],
    ic3: [
      tr('Go to IC3.gov and click "File a Complaint".', 'Vaya a IC3.gov y haga clic en "File a Complaint".'),
      tr(
        "Copy the answers on page 1 into the matching parts of the form: the money you lost, the scammer's details, and what happened.",
        "Copie las respuestas de la página 1 en las partes del formulario: el dinero perdido, los datos del estafador y qué pasó."
      ),
      tr(
        "Save the complaint ID you get at the end. Keep your screenshots in case the FBI asks for them.",
        "Guarde el número de denuncia que reciba. Guarde sus capturas por si el FBI las pide."
      )
    ],
    company: [
      ...(ph.length ? [tr(`Call: ${ph.join(" or ")}.`, `Llame: ${ph.join(" o ")}.`)] : []),
      ...(x.mail
        ? [
            tr(
              `Email this document and the screenshots to ${x.mail}.`,
              `Envíe este documento y las capturas a ${x.mail}.`
            )
          ]
        : []),
      ...(x.web
        ? [
            tr(
              `Or report it on their official website: ${x.web}`,
              `O repórtelo en su sitio oficial: ${x.web}`
            )
          ]
        : []),
      tr(
        "Use only the company's real contact details, never ones the scammer gave you.",
        "Use solo los datos reales de la empresa, nunca los que le dio el estafador."
      )
    ],
    idt: [
      tr(
        'Go to IdentityTheft.gov and click "Get Started".',
        'Vaya a IdentityTheft.gov y haga clic en "Get Started".'
      ),
      tr(
        "Use page 1 to answer the questions. You'll get a personal recovery plan.",
        "Use la página 1 para responder. Recibirá un plan de recuperación."
      ),
      tr(
        "Freeze your credit (free): Equifax 1-800-685-1111, Experian 1-888-397-3742, TransUnion 1-888-909-8872.",
        "Congele su crédito (gratis): Equifax 1-800-685-1111, Experian 1-888-397-3742, TransUnion 1-888-909-8872."
      )
    ]
  };
  return (S[x.type] || [x.how]).map((s, i) => `${i + 1}. ${s}`);
}
function makeOfficePDF(P, x) {
  const t1 =
    {
      ftc: tr("Answers for the FTC report", "Respuestas para el reporte de la FTC"),
      ic3: tr("Answers for the FBI (IC3) complaint", "Respuestas para la denuncia al FBI (IC3)"),
      police: tr("Statement for the police", "Declaración para la policía"),
      idt: tr("Answers for IdentityTheft.gov", "Respuestas para IdentityTheft.gov")
    }[x.type] || `${tr("Fraud report for", "Reporte de fraude para")} ${x.name}`;
  const K = pdfKit(t1, `${tr("For", "Para")}: ${x.name} · ${stamp()}`, P.example);
  K.box(howToSend(x), { head: tr("How to send this", "Cómo enviar esto") });
  const s = P.s;
  const base = [
    [tr("Date it happened", "Fecha"), s.date],
    [tr("How they contacted me", "Cómo me contactaron"), s.how ? t("c_" + s.how) : ""],
    [
      tr("They pretended to be", "Se hicieron pasar por"),
      [orgName(s.org, ""), s.pretend].filter(Boolean).join(" / ")
    ],
    [tr("Their phone, email, or website", "Su teléfono, correo o sitio"), s.contact],
    ...(s.crypto ? [[tr("Crypto details", "Datos cripto"), s.crypto]] : [])
  ];
  const money = [
    [tr("Amount lost", "Cantidad perdida"), s.amt ? P.amount : tr("None", "Ninguna")],
    [tr("How I paid", "Cómo pagué"), s.method ? t("m_" + s.method) : ""],
    [
      tr("Paid from", "Pagado desde"),
      P.bankNm + (s.last4 ? ` (${tr("ending in", "termina en")} ${s.last4})` : "")
    ]
  ];
  const gave = [[tr("What I gave them", "Qué les di"), s.what.map(w => t("w_" + w)).join("; ")]];
  const me = [
    [tr("My name", "Mi nombre"), "______________________________"],
    [tr("My phone", "Mi teléfono"), "______________________________"],
    [tr("My email", "Mi correo"), "______________________________"]
  ];
  if (x.type === "bank" || x.type === "payment") {
    K.h2(tr("1. Details", "1. Detalles"));
    K.kv([
      ...me,
      [
        tr("Account or card", "Cuenta o tarjeta"),
        s.last4 ? tr(`ending in ${s.last4}`, `termina en ${s.last4}`) : "__________"
      ],
      ...money,
      ...base,
      ...gave
    ]);
    K.h2(tr("2. Letter", "2. Carta"));
    K.text(x.type === "bank" && P.bankLetter ? P.bankLetter : P.genericLetter(x.name));
    K.evidence(P.evidence, 3);
  } else if (x.type === "ftc" || x.type === "ic3" || x.type === "idt") {
    K.h2(tr("1. Answers to copy into the online form", "1. Respuestas para copiar en el formulario"));
    K.kv([...base, ...money, ...gave]);
    K.h2(
      tr(
        "2. What happened (copy into the description box)",
        "2. Qué pasó (copie en el cuadro de descripción)"
      )
    );
    K.text(P.story || "-");
    K.text(
      tr(
        "You don't need to upload screenshots here. Keep them in case someone asks.",
        "No necesita subir capturas aquí. Guárdelas por si se las piden."
      ),
      { size: 10, color: K.c.muted }
    );
  } else if (x.type === "police") {
    K.h2(tr("1. My information", "1. Mis datos"));
    K.kv([...me, [tr("My address", "Mi dirección"), "______________________________"]]);
    K.h2(tr("2. Details of the crime", "2. Detalles del delito"));
    K.kv([...base, ...money, ...gave]);
    K.h2(tr("3. Statement", "3. Declaración"));
    K.text(P.story || "-");
    K.text(`${tr("Signature", "Firma")}: ______________________     ${tr("Date", "Fecha")}: ____________`, {
      size: 11
    });
    K.evidence(P.evidence, 4);
  } else {
    // company that was impersonated
    K.h2(tr("1. Details", "1. Detalles"));
    K.kv([...base, ...gave]);
    K.h2(tr("2. Report", "2. Reporte"));
    K.text(P.orgLetter || P.genericLetter(x.name));
    K.evidence(P.evidence, 3);
  }
  return K.finish();
}
const fileSlug = s =>
  String(s)
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
let lastUrls = [];
function downloadDoc(doc, name) {
  const url = URL.createObjectURL(doc.output("blob"));
  lastUrls.push(url);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return url;
}
function pdfReady() {
  if (window.jspdf && window.jspdf.jsPDF) return true;
  toast(
    tr(
      "The PDF maker is still loading. Try again in a moment.",
      "El creador de PDF aún está cargando. Intente de nuevo."
    )
  );
  return false;
}
function getCaseFile(P) {
  if (!pdfReady()) return null;
  try {
    return downloadDoc(
      makeCaseFilePDF(P),
      `ScamSense-My-Case-File-${P.s.date || "today"}${P.example ? "-EXAMPLE" : ""}.pdf`
    );
  } catch (e) {
    toast(tr("The PDF couldn't be made on this device.", "No se pudo crear el PDF en este dispositivo."));
    return null;
  }
}
function getOfficeDoc(P, i) {
  if (!pdfReady()) return null;
  const x = P.send[i];
  try {
    return downloadDoc(
      makeOfficePDF(P, x),
      `ScamSense-For-${fileSlug(shortName(x))}-${P.s.date || "today"}${P.example ? "-EXAMPLE" : ""}.pdf`
    );
  } catch (e) {
    toast(tr("The PDF couldn't be made on this device.", "No se pudo crear el PDF en este dispositivo."));
    return null;
  }
}
function bindDocButtons(root, P) {
  root.querySelectorAll("[data-doc]").forEach(
    b =>
      (b.onclick = () => {
        if (getOfficeDoc(P, +b.dataset.doc)) {
          b.textContent = "✓ " + tr("Downloaded", "Descargado");
          b.classList.add("done");
        }
      })
  );
}
function showReportModal(P) {
  const url = getCaseFile(P);
  if (!url) return;
  const m = document.createElement("div");
  m.className = "modal-bg";
  m.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mtitle">
    <div class="modal-ok" aria-hidden="true">✓</div><h2 id="mtitle">${tr("Your case file is ready", "Su expediente está listo")}</h2>
    <p style="margin:0">${tr("<b>Keep this one for yourself.</b> It has everything: what happened, your screenshots, and a place to write your case numbers.", "<b>Guárdelo para usted.</b> Tiene todo: qué pasó, sus capturas y un lugar para anotar sus números de caso.")}${P.example ? " <b>" + tr("(Example case)", "(Caso de ejemplo)") + "</b>" : ""}</p>
    <div class="row"><a class="btn ghost" href="${url}" target="_blank" rel="noopener">${tr("Open my case file", "Abrir mi expediente")}</a></div>
    <hr class="sep">
    <h3 class="modal-h3">${tr("Now choose where to report it", "Ahora elija dónde reportarlo")}</h3>
    <p class="small muted" style="margin:0">${tr("Each office gets its own document with only what it needs and the steps to send it. Start with number 1.", "Cada oficina recibe su propio documento con solo lo que necesita y los pasos para enviarlo. Empiece por el número 1.")}</p>
    ${sendListHTML(P.send, true)}
    <button class="btn ghost" id="mclose">${tr("Close", "Cerrar")}</button></div>`;
  document.body.appendChild(m);
  bindDocButtons(m, P);
  const close = () => {
    m.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = e => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);
  m.onclick = e => {
    if (e.target === m) close();
  };
  m.querySelector("#mclose").onclick = close;
  m.querySelector("h2").setAttribute("tabindex", "-1");
  m.querySelector("h2").focus();
}

function buildPlan(makePdf) {
  const g = id => document.getElementById(id).value.trim();
  scamState = {
    how: g("sh"),
    what: [...view.querySelectorAll(".checks input:checked")].map(x => x.value),
    method: g("sm"),
    amt: g("sa"),
    date: g("sd"),
    pretend: g("sp"),
    org: g("so") || detectOrg(g("sp")),
    bank: g("sb"),
    bankName: g("sbn"),
    last4: g("sl4").replace(/\D/g, "").slice(0, 4),
    contact: g("sc"),
    crypto: g("sx"),
    story: g("ss")
  };
  if (
    !scamState.bank &&
    ORGS[scamState.org] &&
    ORGS[scamState.org].kind === "bank" &&
    (scamState.what.includes("bank") || ["debit", "bank", "credit"].includes(scamState.method))
  )
    scamState.bank = scamState.org;
  const s = scamState;
  const E = uiLang() === "es";
  const now = [],
    protect = [],
    report = ["ftc"],
    extra = [];
  const bankNm = s.bank ? orgName(s.bank, s.bankName) || tr("my bank", "mi banco") : "";
  const acct = s.last4 ? tr(` ending in ${s.last4}`, ` que termina en ${s.last4}`) : "";
  const M = {
    credit: tr(
      "Call your credit card company now using the number on the back of your card. Say a scammer tricked you, ask them to cancel the charge and refund you, and ask for a new card. Federal law protects you from unauthorized credit card charges.",
      "Llame ya a la compañía de su tarjeta de crédito al número en el reverso. Diga que un estafador le engañó, pida cancelar el cargo, un reembolso y una tarjeta nueva. La ley federal le protege de cargos no autorizados."
    ),
    debit: tr(
      "Call your bank now using the number on the back of your card. Ask them to reverse the payment, refund you, and replace your card.",
      "Llame ya a su banco al número en el reverso de su tarjeta. Pida revertir el pago, un reembolso y una tarjeta nueva."
    ),
    bank: tr(
      "Call your bank or credit union now. Report the transfer or Zelle payment as fraud and ask them to reverse it and refund you.",
      "Llame ya a su banco o cooperativa. Reporte la transferencia o el pago de Zelle como fraude y pida revertirlo y un reembolso."
    ),
    wire: tr(
      "Call Western Union or MoneyGram now. Say a scammer tricked you into sending money and ask them to stop the transfer and refund you.",
      "Llame ya a Western Union o MoneyGram. Diga que un estafador le engañó y pida detener el envío y un reembolso."
    ),
    app: tr(
      "Report the payment in the app (Venmo, Cash App, or PayPal) now and ask them to reverse it. Also call your bank if the app is linked to your account.",
      "Reporte el pago en la app (Venmo, Cash App o PayPal) ya y pida revertirlo. Llame también a su banco si la app está conectada a su cuenta."
    ),
    gift: tr(
      "Call the gift card company now, using the number on the back of the card. Say a scammer has the card number and PIN, and ask for a refund. Keep the card and the receipt.",
      "Llame ya a la compañía de la tarjeta de regalo al número del reverso. Diga que un estafador tiene el número y el PIN, y pida un reembolso. Guarde la tarjeta y el recibo."
    ),
    crypto: tr(
      "Contact the crypto exchange or Bitcoin ATM company now. Say the transaction was fraud and ask them to reverse it. Then report it to the FTC and the FBI.",
      "Contacte ya a la plataforma de criptomonedas o a la empresa del cajero de Bitcoin. Diga que fue un fraude y pida revertirlo. Luego repórtelo a la FTC y al FBI."
    ),
    cashmail: tr(
      "Call the U.S. Postal Inspection Service right away at 1-877-876-2455. They may be able to stop a package that hasn't been delivered yet.",
      "Llame de inmediato al Servicio de Inspección Postal al 1-877-876-2455. Pueden detener un paquete que aún no se ha entregado."
    ),
    courier: tr(
      "Call the delivery company (FedEx, UPS, or other) right away and ask them to stop the package. If someone picked up cash at your home, call your local police.",
      "Llame de inmediato a la empresa de envíos (FedEx, UPS u otra) y pida detener el paquete. Si alguien recogió efectivo en su casa, llame a la policía local."
    )
  };
  if (s.bank)
    now.push(
      tr(
        `Call ${bankNm} now using the number above or on the back of your card. Lock your card or account and ask them to stop the payment.`,
        `Llame ya a ${bankNm} al número de arriba o del reverso de su tarjeta. Bloquee su tarjeta o cuenta y pida detener el pago.`
      )
    );
  if (s.what.includes("paid") || (s.method && s.method !== "none")) {
    if (M[s.method] && !(s.bank && ["credit", "debit", "bank"].includes(s.method))) now.push(M[s.method]);
  }
  if (s.method === "cashmail") report.push("usps");
  if (s.what.includes("bank"))
    now.push(
      tr(
        "Call your bank or card company and tell them a scammer has your account or card details. Ask for new numbers and watch your statements.",
        "Llame a su banco o tarjeta y diga que un estafador tiene sus datos. Pida números nuevos y revise sus estados de cuenta."
      )
    );
  if (s.what.includes("remote"))
    protect.push(
      tr(
        "Disconnect the computer or phone from the internet. Update or install security software, run a scan, and delete anything it flags. Then change your passwords from a different device and turn on two-step sign-in.",
        "Desconecte la computadora o el teléfono de internet. Actualice o instale un antivirus, haga un escaneo y borre lo que encuentre. Luego cambie sus contraseñas desde otro dispositivo y active la verificación en dos pasos."
      )
    );
  if (s.what.includes("pass"))
    protect.push(
      tr(
        "Change the password for that account right away, and anywhere else you used it. Turn on two-step sign-in. If you can't log in, use the account's \"forgot password\" or recovery page.",
        "Cambie ya la contraseña de esa cuenta y donde haya usado la misma. Active la verificación en dos pasos. Si no puede entrar, use la opción de recuperar la cuenta."
      )
    );
  if (s.what.includes("ssn")) {
    protect.push(
      tr(
        "Go to IdentityTheft.gov for a recovery plan, and freeze your credit at all three credit bureaus. It's free and stops new accounts in your name.",
        "Vaya a IdentityTheft.gov para un plan de recuperación y congele su crédito en las tres agencias. Es gratis e impide abrir cuentas a su nombre."
      )
    );
    extra.push("idt", "equifax", "experian", "transunion");
  }
  if (["email", "text", "web", "social"].includes(s.how) || s.method === "crypto") report.push("ic3");
  report.push("elder", "aarp");
  if (!now.length)
    now.push(
      tr(
        "Stop all contact with the scammer. Don't answer their calls or messages.",
        "Corte todo contacto con el estafador. No conteste sus llamadas ni mensajes."
      )
    );
  now.push(
    tr(
      "Write down everything while you remember: dates, phone numbers, names they used, and how you paid. Keep receipts and screenshots.",
      "Anote todo mientras lo recuerda: fechas, números, nombres que usaron y cómo pagó. Guarde recibos y capturas de pantalla."
    )
  );
  const methodName = s.method ? t("m_" + s.method) : tr("(how you paid)", "(cómo pagó)");
  const amount = s.amt ? (/^\$/.test(s.amt) ? s.amt : "$" + s.amt) : tr("(amount)", "(cantidad)");
  const who =
    s.pretend || orgName(s.org, "") || tr("(who they pretended to be)", "(de quién se hicieron pasar)");

  const scriptBank = bankNm
    ? E
      ? `Hola, llamo para reportar un fraude en mi cuenta${acct}. El ${s.date || "(fecha)"}, alguien que se hizo pasar por ${who} me engañó${s.what.includes("bank") ? " y obtuvo los datos de mi cuenta o tarjeta" : ""}${s.amt ? ` y envié ${amount} por ${methodName}` : ""}. Por favor, bloqueen mi tarjeta o cuenta, detengan o reviertan cualquier pago no autorizado y emitan una tarjeta nueva. ¿Me puede dar un número de caso?`
      : `Hi, I'm calling to report fraud on my account${acct}. On ${s.date || "(date)"}, someone pretending to be ${who} tricked me${s.what.includes("bank") ? " and got my account or card details" : ""}${s.amt ? `, and I sent ${amount} by ${methodName}` : ""}. Please lock my card or account, stop or reverse any unauthorized payments, and send me a new card. Can I get a case number?`
    : "";
  const script =
    scriptBank ||
    (E
      ? `Hola, llamo para reportar un fraude. El ${s.date || "(fecha)"}, envié ${amount} por ${methodName} a alguien que se hizo pasar por ${who}. Fue una estafa. Quiero reportarlo y pedir que detengan o reviertan el pago y me devuelvan el dinero. ¿Me puede dar un número de caso? ¿Qué más necesito hacer?`
      : `Hi, I'm calling to report fraud. On ${s.date || "(date)"}, I sent ${amount} by ${methodName} to someone pretending to be ${who}. It was a scam. I'd like to report it and ask you to stop or reverse the payment and refund me. Can I get a case or reference number? What else do I need to do?`);
  const letter = (to, subject, body) =>
    [
      `${tr("To", "Para")}: ${to}`,
      `${tr("Subject", "Asunto")}: ${subject}`,
      `${tr("Date", "Fecha")}: ${new Date().toLocaleDateString()}`,
      "",
      ...body,
      "",
      tr("Sincerely,", "Atentamente,"),
      "______________________",
      tr("Phone", "Teléfono") + ": ______________"
    ].join("\n");
  const bankLetter = bankNm
    ? letter(
        `${bankNm} ${tr("Fraud Department", "Departamento de Fraude")}`,
        tr(`Fraud report, account or card${acct}`, `Reporte de fraude, cuenta o tarjeta${acct}`),
        [
          tr(
            `I am reporting fraud on my account or card${acct}.`,
            `Reporto un fraude en mi cuenta o tarjeta${acct}.`
          ),
          tr(
            `On ${s.date || "(date)"}, someone pretending to be ${who} contacted me by ${s.how ? t("c_" + s.how).toLowerCase() : "(how)"}.`,
            `El ${s.date || "(fecha)"}, alguien que se hizo pasar por ${who} me contactó por ${s.how ? t("c_" + s.how).toLowerCase() : "(medio)"}.`
          ),
          s.what.length
            ? tr("What happened: ", "Qué pasó: ") + s.what.map(w => t("w_" + w)).join("; ") + "."
            : "",
          s.amt
            ? tr(
                `Amount: ${amount}, paid by ${methodName}.`,
                `Cantidad: ${amount}, pagada por ${methodName}.`
              )
            : "",
          s.contact ? tr(`The scammer used: ${s.contact}.`, `El estafador usó: ${s.contact}.`) : "",
          "",
          tr("I am asking you to:", "Les pido:"),
          tr(
            "1. Block my card or account and issue new numbers.",
            "1. Bloquear mi tarjeta o cuenta y emitir números nuevos."
          ),
          tr(
            "2. Stop or reverse any unauthorized payments and refund me.",
            "2. Detener o revertir pagos no autorizados y devolverme el dinero."
          ),
          tr("3. Add a fraud alert to my account.", "3. Agregar una alerta de fraude a mi cuenta."),
          tr(
            "4. Give me a case or claim number in writing.",
            "4. Darme un número de caso o reclamo por escrito."
          )
        ].filter(x => x !== "")
      )
    : "";
  const orgLetter =
    s.org && s.org !== s.bank
      ? letter(
          `${orgName(s.org, s.pretend) || tr("The company", "La empresa")}`,
          tr("Someone is pretending to be you", "Alguien se hace pasar por ustedes"),
          [
            tr(
              `On ${s.date || "(date)"}, someone pretending to be ${orgName(s.org, s.pretend) || who} contacted me by ${s.how ? t("c_" + s.how).toLowerCase() : "(how)"}.`,
              `El ${s.date || "(fecha)"}, alguien que se hizo pasar por ${orgName(s.org, s.pretend) || who} me contactó por ${s.how ? t("c_" + s.how).toLowerCase() : "(medio)"}.`
            ),
            s.contact
              ? tr(
                  `They used this phone, email, or website: ${s.contact}.`,
                  `Usaron este teléfono, correo o sitio: ${s.contact}.`
                )
              : "",
            s.story ? tr("What happened: ", "Qué pasó: ") + s.story : "",
            "",
            tr(
              "Please investigate, note my account if I have one with you, and take down the fake contact.",
              "Por favor investiguen, anoten mi cuenta si tengo una con ustedes y eliminen el contacto falso."
            )
          ].filter(x => x !== "")
        )
      : "";
  const reportTxt = [
    tr("SCAM REPORT (case file)", "REPORTE DE ESTAFA (expediente)"),
    `${tr("Prepared", "Preparado")}: ${new Date().toLocaleString()}`,
    "",
    `${tr("Date of scam", "Fecha de la estafa")}: ${s.date || "-"}`,
    `${tr("How it started", "Cómo empezó")}: ${s.how ? t("c_" + s.how) : "-"}`,
    `${tr("Pretended to be", "Se hicieron pasar por")}: ${[orgName(s.org, ""), s.pretend].filter(Boolean).join(" / ") || "-"}`,
    `${tr("My bank or card company", "Mi banco o tarjeta")}: ${bankNm || "-"}${s.last4 ? ` (${tr("ending in", "termina en")} ${s.last4})` : ""}`,
    `${tr("Scammer's contact details", "Datos de contacto del estafador")}: ${s.contact || "-"}`,
    `${tr("What happened", "Qué pasó")}: ${s.what.map(w => t("w_" + w)).join("; ") || "-"}`,
    `${tr("Payment method", "Forma de pago")}: ${s.method ? t("m_" + s.method) : "-"}`,
    `${tr("Amount", "Cantidad")}: ${s.amt || "-"}`,
    "",
    `${tr("Description", "Descripción")}:`,
    s.story || "-",
    "",
    `${tr("Reported to", "Reportado a")}: ______________________   ${tr("Case number", "Número de caso")}: ______________`
  ].join("\n");
  const li = a => a.map(x => `<li>${esc(x)}</li>`).join("");
  const sendL = sendList(s, bankNm);
  const P = {
    s,
    amount,
    genericLetter: to =>
      letter(
        to,
        tr("Fraud report", "Reporte de fraude"),
        [
          tr(
            `On ${s.date || "(date)"}, someone pretending to be ${who} contacted me by ${s.how ? t("c_" + s.how).toLowerCase() : "(how)"}.`,
            `El ${s.date || "(fecha)"}, alguien que se hizo pasar por ${who} me contactó por ${s.how ? t("c_" + s.how).toLowerCase() : "(medio)"}.`
          ),
          s.amt
            ? tr(`I lost ${amount}, paid by ${methodName}.`, `Perdí ${amount}, pagado por ${methodName}.`)
            : "",
          s.contact ? tr(`The scammer used: ${s.contact}.`, `El estafador usó: ${s.contact}.`) : "",
          "",
          tr(
            "Please stop or reverse the payment if possible, refund me, and give me a case number.",
            "Por favor detengan o reviertan el pago si es posible, devuélvanme el dinero y denme un número de caso."
          )
        ].filter(x => x !== "")
      ),
    example: scamExample,
    date: s.date,
    story: s.story,
    bankNm,
    orgNm: orgName(s.org, s.pretend),
    bankLetter,
    orgLetter,
    send: sendL,
    evidence: evidence.slice(),
    summary: [
      [tr("Date of scam", "Fecha"), s.date],
      [tr("How it started", "Cómo empezó"), s.how ? t("c_" + s.how) : ""],
      [
        tr("Pretended to be", "Se hicieron pasar por"),
        [orgName(s.org, ""), s.pretend].filter(Boolean).join(" / ")
      ],
      [
        tr("My bank or card", "Mi banco o tarjeta"),
        bankNm + (s.last4 ? ` (${tr("ending in", "termina en")} ${s.last4})` : "")
      ],
      [tr("What happened", "Qué pasó"), s.what.map(w => t("w_" + w)).join("; ")],
      [tr("Payment method", "Forma de pago"), s.method ? t("m_" + s.method) : ""],
      [tr("Amount", "Cantidad"), s.amt ? amount : ""],
      [tr("Scammer's contact details", "Contacto del estafador"), s.contact],
      [tr("Crypto details", "Datos cripto"), s.crypto],
      [tr("Screenshots attached", "Capturas adjuntas"), String(evidence.length)]
    ]
  };
  document.getElementById("splan").innerHTML = `<div class="card plan">
    <h2>${t("plan_title")}</h2>
    ${
      s.bank || s.org
        ? `<div class="plan-block"><p class="label">${tr("Call these first", "Llame primero a estos")}</p>
      ${s.bank ? orgCardHTML(s.bank, s.bankName, tr("Your bank: report the fraud and lock your card", "Su banco: reporte el fraude y bloquee su tarjeta")) : ""}
      ${s.org && s.org !== s.bank ? orgCardHTML(s.org, s.pretend, tr("Who they pretended to be: report the impersonation", "De quién se hicieron pasar: reporte la suplantación")) : ""}
      <p class="small muted" style="margin:0">${tr("These numbers come from each organization's official website. Always call the real number, never one the scammer gave you.", "Estos números vienen del sitio oficial de cada organización. Llame siempre al número real, nunca a uno que le dio el estafador.")}</p></div>`
        : ""
    }
    <div class="plan-block urgent"><p class="label">${t("plan_now")}</p><ol>${li(now)}</ol></div>
    ${protect.length ? `<div class="plan-block"><p class="label">${t("plan_protect")}</p><ol>${li(protect)}</ol></div>` : ""}
    <div class="plan-block docs-block"><p class="label">${tr("3. Your documents", "3. Sus documentos")}</p>
      <div class="keepdoc"><div><b>📁 ${tr("My case file", "Mi expediente")}</b><span class="small">${tr("Keep this one for yourself: everything in one place, with your screenshots and a log for case numbers.", "Guárdelo para usted: todo en un lugar, con sus capturas y un registro de números de caso.")}</span></div>
        <button class="btn ghost sm" id="pdfagain">${tr("Download", "Descargar")}</button></div>
      <p class="label" style="margin-top:6px">${tr("Where to report it (one document for each office, best option first)", "Dónde reportarlo (un documento por oficina, mejor opción primero)")}</p>${sendListHTML(sendL, true)}</div>
    <p class="small warnline">⚠️ ${t("recovery_warn")}</p>
    <div class="plan-block"><p class="label">${t("plan_script")}</p><div class="script" id="script" dir="auto">${esc(script)}</div>
      <div class="row"><button class="btn ghost" data-copy="script">${t("copy")}</button><button class="btn ghost" id="readscript">${t("read_aloud")}</button></div></div>
    <p class="small muted" style="margin:0">${tr('Source: FTC, "What To Do if You Were Scammed" (consumer.ftc.gov). Phone numbers checked Nov 2026.', 'Fuente: FTC, "What To Do if You Were Scammed" (consumer.ftc.gov). Números verificados en nov. 2026.')}</p></div>`;
  const plan = document.getElementById("splan");
  plan.querySelectorAll("[data-copy]").forEach(
    b =>
      (b.onclick = async () => {
        const el = document.getElementById(b.dataset.copy);
        const txt = el.value !== undefined ? el.value : el.textContent;
        try {
          await navigator.clipboard.writeText(txt);
          toast(t("copied"));
        } catch (e) {
          if (el.select) el.select();
        }
      })
  );
  document.getElementById("readscript").onclick = () => speak(script);
  if (false)
    document.getElementById("savefile").onclick = () => {
      const blob = new Blob([document.getElementById("reporttxt").value], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ScamSense-report-" + (s.date || "today") + ".txt";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };

  const aib = null;
  if (aib)
    aib.onclick = async () => {
      aib.disabled = true;
      aib.textContent = t("ai_writing");
      try {
        const out = await callClaude(
          `You help scam victims write a clear, factual report for their bank, the FTC, the FBI (IC3), and police. Write in ${LANGS[langCode()].ai}. Use short sentences. Include a short timeline. Don't invent facts; write "unknown" where a detail is missing. Plain text only, no markdown.`,
          document.getElementById("reporttxt").value,
          900
        );
        document.getElementById("reporttxt").value +=
          "\n\n" + tr("AI SUMMARY", "RESUMEN DE IA") + ":\n" + out.trim();
      } catch (e) {
        toast(e.message === "no-key" ? t("paste_key") : e.message);
      }
      aib.disabled = false;
      aib.textContent = t("ai_summary");
    };
  document.getElementById("pdfagain").onclick = () => getCaseFile(P);
  bindDocButtons(plan, P);
  plan.scrollIntoView({ behavior: "smooth", block: "start" });
  if (makePdf) showReportModal(P);
}

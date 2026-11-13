/*
 * ScamSense · Lessons
 * Short scam lessons, each with one quiz question.
 */
"use strict";

function LESSONS() {
  return [
    {
      id: "payment",
      icon: "hand",
      title: tr("Gift cards, crypto, and wires", "Tarjetas de regalo, cripto y transferencias"),
      how: tr(
        "Scammers ask you to pay in ways that can't be undone: gift cards, Bitcoin ATMs, wire transfers, or Zelle to a stranger.",
        "Los estafadores piden pagos que no se pueden deshacer: tarjetas de regalo, cajeros de Bitcoin, transferencias o Zelle a un desconocido."
      ),
      flags: [
        tr("They tell you exactly how to pay", "Le dicen exactamente cómo pagar"),
        tr(
          "They want the gift card numbers read out loud",
          "Quieren que lea en voz alta los números de la tarjeta"
        ),
        tr(
          "They stay on the phone while you go to the store",
          "Se quedan en el teléfono mientras va a la tienda"
        )
      ],
      todo: [
        tr(
          "No real company or agency takes gift cards as payment.",
          "Ninguna empresa o agencia real acepta tarjetas de regalo como pago."
        ),
        tr("Hang up and talk to someone you trust.", "Cuelgue y hable con alguien de confianza.")
      ],
      q: {
        q: tr(
          'Someone from "the IRS" says you can settle your taxes with Apple gift cards. What is it?',
          'Alguien del "IRS" dice que puede pagar sus impuestos con tarjetas de regalo de Apple. ¿Qué es?'
        ),
        o: [tr("A scam", "Una estafa"), tr("A real way to pay the IRS", "Una forma real de pagarle al IRS")],
        a: 0
      }
    },
    {
      id: "impostor",
      icon: "user",
      title: tr("Fake bank, government, and company calls", "Llamadas falsas de bancos, gobierno y empresas"),
      how: tr(
        "Scammers pretend to be your bank, Social Security, Medicare, the IRS, or Amazon. Caller ID can be faked to show a real name.",
        "Se hacen pasar por su banco, el Seguro Social, Medicare, el IRS o Amazon. El identificador de llamadas se puede falsificar."
      ),
      flags: [
        tr("Urgent problem with your account", "Un problema urgente con su cuenta"),
        tr("Threats of arrest or losing benefits", "Amenazas de arresto o de perder beneficios"),
        tr('Asks you to move money to a "safe account"', 'Le pide mover dinero a una "cuenta segura"')
      ],
      todo: [
        tr(
          "Hang up. Call the number on your card, bill, or the official website.",
          "Cuelgue. Llame al número de su tarjeta, factura o sitio oficial."
        ),
        tr(
          "Your bank will never ask you to move money to protect it.",
          "Su banco nunca le pedirá mover dinero para protegerlo."
        )
      ],
      q: {
        q: tr(
          'Your phone shows "Chase Fraud Dept" and the caller asks you to move money to a safe account. What do you do?',
          'Su teléfono dice "Chase Fraud Dept" y le piden mover dinero a una cuenta segura. ¿Qué hace?'
        ),
        o: [
          tr("Move the money quickly", "Muevo el dinero rápido"),
          tr("Hang up and call the number on my card", "Cuelgo y llamo al número de mi tarjeta")
        ],
        a: 1
      }
    },
    {
      id: "codes",
      icon: "key",
      title: tr("Codes and passwords", "Códigos y contraseñas"),
      how: tr(
        'A code texted to you lets someone log in to your account. Scammers call pretending to "verify" you and ask you to read it.',
        'Un código que le llega por texto permite entrar a su cuenta. Los estafadores llaman para "verificarle" y le piden leerlo.'
      ),
      flags: [
        tr(
          "Anyone asking for a code sent to your phone",
          "Cualquiera que pida un código enviado a su teléfono"
        ),
        tr(
          "\"I'm sending you a code to confirm it's you\"",
          '"Le envío un código para confirmar que es usted"'
        )
      ],
      todo: [
        tr("Never share a code, not even with your bank.", "Nunca comparta un código, ni con su banco."),
        tr(
          "If you shared one, change your password and call the company.",
          "Si lo compartió, cambie su contraseña y llame a la empresa."
        )
      ],
      q: {
        q: tr(
          "A caller says they're from your bank and asks for the 6-digit code they just texted you. Should you share it?",
          "Alguien dice ser de su banco y pide el código de 6 dígitos que le acaba de llegar. ¿Lo comparte?"
        ),
        o: [tr("Yes, they sent it", "Sí, ellos lo enviaron"), tr("No, never", "No, nunca")],
        a: 1
      }
    },
    {
      id: "family",
      icon: "user",
      title: tr('"Grandma, it\'s me" emergencies', 'Emergencias de "Abuela, soy yo"'),
      how: tr(
        "Someone pretends to be a grandchild or relative in trouble and needs money now, often for bail or a hospital.",
        "Alguien finge ser un nieto o familiar en problemas que necesita dinero ya, a menudo para una fianza o un hospital."
      ),
      flags: [
        tr("A new phone number or email", "Un número o correo nuevo"),
        tr('"Please don\'t tell Mom and Dad"', '"Por favor no le digas a mamá y papá"'),
        tr("Gift cards or cash pickup", "Tarjetas de regalo o recogida de efectivo")
      ],
      todo: [
        tr(
          "Call your family member on the number you already have.",
          "Llame a su familiar al número que ya tiene."
        ),
        tr(
          "Check with another relative before doing anything.",
          "Hable con otro familiar antes de hacer nada."
        )
      ],
      q: {
        q: tr(
          "A text says: \"Grandma it's me, new number. I need $2,000 for bail. Don't tell Mom.\" What's the first step?",
          'Un texto dice: "Abuela soy yo, número nuevo. Necesito $2,000 de fianza. No le digas a mamá." ¿Qué hace primero?'
        ),
        o: [
          tr("Call my grandchild's usual number", "Llamo al número de siempre de mi nieto"),
          tr("Send the money fast", "Envío el dinero rápido")
        ],
        a: 0
      }
    },
    {
      id: "tech",
      icon: "device",
      title: tr("Tech support and refund scams", "Falso soporte técnico y reembolsos"),
      how: tr(
        'A pop-up, call, or email says your computer has a virus or you were charged for a renewal. They want remote access or a "refund" payment.',
        'Un aviso, llamada o correo dice que su computadora tiene un virus o que le cobraron una renovación. Quieren acceso remoto o un pago de "reembolso".'
      ),
      flags: [
        tr("A phone number in a pop-up or invoice email", "Un número en un aviso o correo de factura"),
        tr("Asks you to install AnyDesk or TeamViewer", "Le pide instalar AnyDesk o TeamViewer"),
        tr('They "refund too much" and ask for it back', '"Reembolsan de más" y piden que lo devuelva')
      ],
      todo: [
        tr("Close the pop-up. Don't call the number.", "Cierre el aviso. No llame al número."),
        tr(
          "Microsoft and Apple won't call you to offer tech support.",
          "Microsoft y Apple no le llaman para ofrecer soporte técnico."
        )
      ],
      q: {
        q: tr(
          'A pop-up says "Virus found! Call Microsoft at 1-888…" What do you do?',
          'Un aviso dice "¡Virus! Llame a Microsoft al 1-888…" ¿Qué hace?'
        ),
        o: [
          tr("Close it and don't call", "Lo cierro y no llamo"),
          tr("Call so they can fix it", "Llamo para que lo arreglen")
        ],
        a: 0
      }
    },
    {
      id: "texts",
      icon: "msg",
      title: tr("Fake toll, delivery, and bank texts", "Textos falsos de peaje, envíos y bancos"),
      how: tr(
        "Texts say you owe a toll, missed a package, or have a locked account. The link goes to a fake site that steals your card.",
        "Textos dicen que debe un peaje, perdió un paquete o tiene la cuenta bloqueada. El enlace lleva a un sitio falso que roba su tarjeta."
      ),
      flags: [
        tr("A small fee and a short deadline", "Un cargo pequeño y un plazo corto"),
        tr("Strange web addresses (.xyz, .top)", "Direcciones raras (.xyz, .top)")
      ],
      todo: [
        tr("Don't tap the link. Forward the text to 7726.", "No toque el enlace. Reenvíe el texto al 7726."),
        tr(
          "Check your account on the official app or website.",
          "Revise su cuenta en la app o sitio oficial."
        )
      ],
      q: {
        q: tr(
          "Which web address is most likely real for USPS?",
          "¿Qué dirección es más probable que sea real de USPS?"
        ),
        o: ["usps.com", "usps-redelivery.top"],
        a: 0
      }
    },
    {
      id: "prize",
      icon: "spark",
      title: tr("Prizes, lotteries, and jobs", "Premios, loterías y trabajos"),
      how: tr(
        'You "won" something you never entered, or got a job offer that pays too well. They ask for a fee or your bank details first.',
        'Usted "ganó" algo en lo que no participó, o le ofrecen un trabajo demasiado bueno. Piden un pago o sus datos bancarios primero.'
      ),
      flags: [
        tr("You must pay to get your prize", "Debe pagar para recibir el premio"),
        tr(
          "They send a check and ask you to send part back",
          "Le envían un cheque y piden que devuelva una parte"
        )
      ],
      todo: [
        tr(
          "You can't win a contest you didn't enter.",
          "No se puede ganar un concurso en el que no participó."
        ),
        tr("Real jobs never ask you to pay to start.", "Los trabajos reales nunca piden pagar para empezar.")
      ],
      q: {
        q: tr(
          "You won $50,000 but must pay a $500 processing fee first. What is it?",
          "Ganó $50,000 pero debe pagar $500 de trámite primero. ¿Qué es?"
        ),
        o: [tr("Normal paperwork", "Trámite normal"), tr("A scam", "Una estafa")],
        a: 1
      }
    },
    {
      id: "crypto",
      icon: "spark",
      title: tr("Crypto investment and romance scams", "Estafas de inversión cripto y romance"),
      how: tr(
        'It often starts with a "wrong number" text or a friendly stranger online. They show you big profits on a crypto site, then ask for "taxes" or "fees" before you can withdraw.',
        'Suele empezar con un texto de "número equivocado" o un desconocido amable. Le muestran grandes ganancias en un sitio cripto y luego piden "impuestos" o "cargos" para retirar.'
      ),
      flags: [
        tr("Guaranteed or daily profits", "Ganancias garantizadas o diarias"),
        tr("Moving the chat to WhatsApp or Telegram", "Pasar la conversación a WhatsApp o Telegram"),
        tr("Paying a fee to withdraw your own money", "Pagar un cargo para retirar su propio dinero")
      ],
      todo: [
        tr(
          "Never invest through someone you met online.",
          "Nunca invierta con alguien que conoció en internet."
        ),
        tr(
          "Check the website and wallet in the Crypto section first.",
          "Revise el sitio y la billetera en la sección Cripto primero."
        )
      ],
      q: {
        q: tr(
          "Your crypto account shows $40,000 profit, but you must pay a $3,000 tax to withdraw. What's happening?",
          "Su cuenta cripto muestra $40,000 de ganancia, pero debe pagar $3,000 de impuesto para retirar. ¿Qué pasa?"
        ),
        o: [
          tr("It's a scam; the profit isn't real", "Es una estafa; la ganancia no es real"),
          tr("Pay it so you can withdraw", "Lo pago para poder retirar")
        ],
        a: 0
      }
    }
  ];
}
const KIND_LESSON = {
  payment: "payment",
  account: "codes",
  threat: "impostor",
  family: "family",
  prize: "prize",
  callback: "tech",
  tech: "tech",
  toll: "texts",
  sender: "impostor",
  link: "texts",
  pressure: "impostor",
  crypto: "crypto"
};
let currentLesson = "payment";
function lessonState() {
  return S.get("lessons", {});
}
function renderLearn() {
  const st = lessonState();
  const L = LESSONS();
  const done = L.filter(l => st[l.id]).length;
  view.innerHTML = `${pageHead(tr("Learn about scams", "Aprenda sobre estafas"), tr("Short lessons, about one minute each. Each ends with one question.", "Lecciones cortas, de un minuto. Cada una termina con una pregunta."), "today")}
  <div class="progresscard"><div><b>${done} / ${L.length}</b><span>${tr("lessons done", "lecciones hechas")}</span></div><div class="progress"><i style="width:${Math.round((done / L.length) * 100)}%"></i></div></div>
  <div class="group">${L.map(l => `<button class="grow linkrow" data-lesson="${l.id}"><span class="tile-ic sm t-dev">${ic(l.icon)}</span><span class="gl"><b>${esc(l.title)}</b><span>${st[l.id] ? (st[l.id].correct ? tr("Done ✓", "Hecha ✓") : tr("Done · review it", "Hecha · repásela")) : tr("1 minute", "1 minuto")}</span></span>${ic("chev", "chev")}</button>`).join("")}</div>`;
  bindBack();
  view.querySelectorAll("[data-lesson]").forEach(
    b =>
      (b.onclick = () => {
        currentLesson = b.dataset.lesson;
        go("lesson");
      })
  );
}
function renderLesson() {
  const l = LESSONS().find(x => x.id === currentLesson) || LESSONS()[0];
  view.innerHTML = `${pageHead(esc(l.title), "", "learn")}
  <section class="card"><p class="lead">${esc(l.how)}</p>
    <div><p class="label">${tr("Warning signs", "Señales de alerta")}</p><ul class="ticks">${l.flags.map(x => `<li>${ic("alert")}<span>${esc(x)}</span></li>`).join("")}</ul></div>
    <div><p class="label">${tr("What to do", "Qué hacer")}</p><ul class="ticks ok">${l.todo.map(x => `<li>${ic("check")}<span>${esc(x)}</span></li>`).join("")}</ul></div>
    <button class="btn ghost" id="lread">${t("read_aloud")}</button></section>
  <section class="card"><p class="label">${tr("Quick question", "Pregunta rápida")}</p><p class="qq">${esc(l.q.q)}</p>
    <div class="qopts">${l.q.o.map((o, i) => `<button class="qopt" data-o="${i}">${esc(o)}</button>`).join("")}</div><p id="qres" class="qres" hidden></p></section>`;
  bindBack();
  document.getElementById("lread").onclick = () =>
    speak(`${l.title}. ${l.how} ${l.flags.join(". ")}. ${l.todo.join(" ")}`);
  view.querySelectorAll(".qopt").forEach(
    b =>
      (b.onclick = () => {
        const ok = +b.dataset.o === l.q.a;
        view.querySelectorAll(".qopt").forEach(x => {
          x.disabled = true;
          if (+x.dataset.o === l.q.a) x.classList.add("right");
        });
        if (!ok) b.classList.add("wrong");
        const r = document.getElementById("qres");
        r.hidden = false;
        r.className = "qres " + (ok ? "good" : "bad");
        r.textContent = ok
          ? tr("Right! You'd spot this one.", "¡Correcto! Usted reconocería esta.")
          : tr(
              "Not quite. The highlighted answer is the safe one.",
              "No exactamente. La respuesta resaltada es la segura."
            );
        const st = lessonState();
        st[l.id] = { correct: ok, at: Date.now() };
        S.set("lessons", st);
      })
  );
}

/*
 * ScamSense · Crypto checks
 * Checks crypto websites, wallet addresses, and investment offers.
 */
"use strict";

const CRYPTO_BRANDS = {
  coinbase: ["coinbase.com"],
  binance: ["binance.com", "binance.us"],
  kraken: ["kraken.com"],
  "crypto.com": ["crypto.com"],
  gemini: ["gemini.com"],
  metamask: ["metamask.io"],
  trustwallet: ["trustwallet.com"],
  robinhood: ["robinhood.com"],
  ledger: ["ledger.com"],
  trezor: ["trezor.io"],
  kucoin: ["kucoin.com"],
  okx: ["okx.com"],
  bybit: ["bybit.com"],
  blockchain: ["blockchain.com"],
  uniswap: ["uniswap.org", "app.uniswap.org"],
  opensea: ["opensea.io"]
};
/* Sample reported wallets for this prototype (made-up addresses). Real lookups need the ScamSense server and a reporting-database API. */
const REPORTED_WALLETS = {
  TQ5kW8xZ3vN7pR2mY9bL4cF6hJ1aD8eS3u: {
    n: 27,
    type: tr("Fake investment platform", "Plataforma de inversión falsa")
  },
  "0x9f2c4e1a7b3d5f6e8a0c2b4d6f8e0a1c3e5b7d9f": {
    n: 14,
    type: tr("Pig-butchering (romance and investment)", "Engaño de romance e inversión")
  }
};
function walletInfo(raw) {
  const a = String(raw || "").trim();
  if (!a) return null;
  const lines = [];
  let chain = "",
    level = "info",
    title = "";
  if (/^0x[a-fA-F0-9]{40}$/.test(a)) {
    chain = "eth";
  } else if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) {
    chain = "tron";
  } else if (/^(bc1[0-9a-z]{25,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(a)) {
    chain = "btc";
  } else if (/^[LM][a-km-zA-HJ-NP-Z1-9]{26,33}$/.test(a) || /^ltc1[0-9a-z]{25,}$/.test(a)) {
    chain = "ltc";
  } else if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a)) {
    chain = "xrp";
  } else if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) {
    chain = "sol";
  }
  const name = {
    eth: tr(
      "Ethereum-style address (also used for USDT on Ethereum, BNB Chain, and Polygon)",
      "Dirección tipo Ethereum (también USDT en Ethereum, BNB Chain y Polygon)"
    ),
    tron: tr(
      "TRON address (often used for USDT, very common in crypto scams)",
      "Dirección TRON (usada para USDT, muy común en estafas cripto)"
    ),
    btc: tr("Bitcoin address", "Dirección de Bitcoin"),
    ltc: tr("Litecoin address", "Dirección de Litecoin"),
    xrp: tr("XRP address", "Dirección de XRP"),
    sol: tr("Possibly a Solana address", "Posiblemente una dirección de Solana")
  }[chain];
  if (!chain)
    return {
      level: "warn",
      title: tr(
        "This doesn't look like a crypto wallet address.",
        "No parece una dirección de billetera cripto."
      ),
      lines: [
        tr("Check that you copied all of it, with no spaces.", "Revise que la copió completa y sin espacios.")
      ],
      links: []
    };
  const rep = REPORTED_WALLETS[a];
  if (rep) {
    level = "scam";
    title = tr(`Reported ${rep.n} times: ${rep.type}`, `Reportada ${rep.n} veces: ${rep.type}`);
    lines.push(tr("Don't send anything to this wallet.", "No envíe nada a esta billetera."));
  } else {
    title = name;
    lines.push(
      tr(
        "No reports found in ScamSense's list yet. That doesn't mean it's safe.",
        "Aún no hay reportes en la lista de ScamSense. Eso no significa que sea segura."
      )
    );
  }
  if (rep) lines.unshift(name);
  lines.push(
    tr(
      "Crypto can't be reversed. Never send it to someone who contacted you first or who you only know online.",
      "Las cripto no se pueden revertir. Nunca envíe a quien le contactó primero o a quien solo conoce por internet."
    )
  );
  const enc = encodeURIComponent(a);
  const links = [
    ["Chainabuse", `https://www.chainabuse.com/address/${enc}`],
    ...(chain === "eth"
      ? [["Etherscan", `https://etherscan.io/address/${enc}`]]
      : chain === "tron"
        ? [["Tronscan", `https://tronscan.org/#/address/${enc}`]]
        : chain === "btc"
          ? [["Blockchair", `https://blockchair.com/bitcoin/address/${enc}`]]
          : [])
  ];
  return { level, title, lines, links, sample: !!rep };
}
function cryptoSiteInfo(raw) {
  const host = hostOf(String(raw || "").trim());
  if (!host)
    return {
      level: "warn",
      title: tr("Type a website address, like example.com", "Escriba una dirección web, como example.com"),
      lines: [],
      links: []
    };
  const lines = [];
  let level = "info",
    title = tr("No warning signs in the address", "Sin señales de alerta en la dirección");
  const legit = Object.entries(CRYPTO_BRANDS).find(([b, ds]) =>
    ds.some(d => host === d || host.endsWith("." + d))
  );
  const flat = unleet(host).replace(/[^a-z.]/g, "");
  const fake = !legit && Object.entries(CRYPTO_BRANDS).find(([b]) => flat.includes(b.replace(/[^a-z]/g, "")));
  if (legit) {
    level = "safe";
    title = tr(`This is ${cap(legit[0])}'s real website`, `Este es el sitio real de ${cap(legit[0])}`);
    lines.push(
      tr(
        "Make sure you typed it yourself and didn't follow a link from a stranger.",
        "Asegúrese de haberlo escrito usted y no haber seguido un enlace de un desconocido."
      )
    );
  } else if (fake) {
    level = "scam";
    title = tr(`Fake ${cap(fake[0])} website`, `Sitio falso de ${cap(fake[0])}`);
    lines.push(
      tr(
        `"${host}" uses the ${cap(fake[0])} name, but it isn't ${cap(fake[0])}'s real website.`,
        `"${host}" usa el nombre de ${cap(fake[0])}, pero no es su sitio real.`
      )
    );
  } else {
    if (
      /(mining|miner|invest|profit|yield|earn|trade|trading|fx|capital|finance|wallet|defi|vault|bot|arbitrage|usdt)/.test(
        flat
      )
    ) {
      level = "warn";
      title = tr("Looks like a crypto investment site", "Parece un sitio de inversión cripto");
      lines.push(
        tr(
          "Fake crypto sites often use words like mining, profit, trading, or USDT in their address.",
          "Los sitios cripto falsos suelen usar palabras como mining, profit, trading o USDT en la dirección."
        )
      );
    }
    if (BAD_TLD.test(host) || /\.(vip|cc|pro|app|io|club|finance|exchange|investments?)$/.test(host)) {
      level = level === "warn" ? "scam" : "warn";
      title =
        level === "scam"
          ? tr("Very likely a fake crypto site", "Muy probablemente un sitio cripto falso")
          : tr("Unusual web address", "Dirección web inusual");
      lines.push(
        tr(
          `The ending "${host.split(".").pop()}" is popular with fake investment sites.`,
          `La terminación "${host.split(".").pop()}" es popular en sitios de inversión falsos.`
        )
      );
    }
  }
  lines.push(
    tr(
      "Checking how new a site is needs the ScamSense server (coming). Until then, search it on the trackers below.",
      "Saber qué tan nuevo es un sitio necesita el servidor (próximamente). Mientras, búsquelo en los registros de abajo."
    )
  );
  return {
    level,
    title,
    lines,
    links: [
      [
        tr("California Crypto Scam Tracker", "Registro de estafas cripto de California"),
        "https://dfpi.ca.gov/crypto-scams/"
      ],
      ["Chainabuse", "https://www.chainabuse.com"]
    ]
  };
}
function cryptoIntelHTML(info, label) {
  if (!info) return "";
  const icon = { scam: "alert", warn: "alert", safe: "check", info: "info" }[info.level];
  return `<div class="intel lv-${info.level}"><div class="intel-h">${ic(icon)}<span>${label}</span></div><p class="intel-t">${esc(info.title)}</p>
    ${info.lines.length ? `<ul>${info.lines.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    ${info.links && info.links.length ? `<div class="contact-acts">${info.links.map(([n, u]) => `<a class="btn ghost sm" href="${u}" target="_blank" rel="noopener">${esc(n)} ↗</a>`).join("")}</div>` : ""}
    ${info.sample ? `<p class="intel-foot">${tr("Report counts are sample data in this prototype.", "Los conteos de reportes son datos de ejemplo en este prototipo.")}</p>` : ""}</div>`;
}
const CRYPTO_CHAT =
  "Hi, is this Linda? Oh sorry, wrong number! You seem nice though. Let's talk on WhatsApp. My uncle is a crypto analyst and our AI trading bot gives guaranteed 5% daily returns. You can start with $500 on our platform.";
function renderCheckCrypto() {
  view.innerHTML = `${pageHead(tr("Crypto", "Cripto"), tr("Check a crypto website, a wallet address, or an investment offer before you send anything.", "Revise un sitio cripto, una billetera o una oferta de inversión antes de enviar algo."), "check")}
  <section class="sect"><h2 class="sect-h">${tr("Check a website", "Revisar un sitio web")}</h2><div class="card">
    <div class="lookup"><input id="cw" inputmode="url" autocomplete="off" spellcheck="false" placeholder="example-trade.com" aria-label="${tr("Website", "Sitio web")}"><button class="btn primary" id="cwgo">${tr("Check", "Revisar")}</button></div>
    <div class="samples"><span class="small muted">${t("try_example")}</span><button class="chip" data-cw="coinbase-pro-wallet.vip">coinbase-pro-wallet.vip</button><button class="chip" data-cw="usdt-mining-pool.top">usdt-mining-pool.top</button><button class="chip" data-cw="coinbase.com">coinbase.com</button></div>
    <div id="cwres"></div></div></section>
  <section class="sect"><h2 class="sect-h">${tr("Check a wallet address", "Revisar una billetera")}</h2><div class="card">
    <div class="lookup"><input id="ca" autocomplete="off" spellcheck="false" placeholder="0x… / T… / bc1…" aria-label="${tr("Wallet address", "Dirección de billetera")}"><button class="btn primary" id="cago">${tr("Check", "Revisar")}</button></div>
    <div class="samples"><span class="small muted">${t("try_example")}</span><button class="chip" data-ca="TQ5kW8xZ3vN7pR2mY9bL4cF6hJ1aD8eS3u">${tr("Reported TRON wallet", "Billetera TRON reportada")}</button><button class="chip" data-ca="bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh">${tr("Bitcoin address", "Dirección de Bitcoin")}</button></div>
    <div id="cares"></div></div></section>
  <section class="sect"><h2 class="sect-h">${tr("Check an investment offer or chat", "Revisar una oferta o conversación")}</h2><div class="card">
    <div class="field"><label for="cc">${tr("Paste the message or chat", "Pegue el mensaje o la conversación")}</label><textarea id="cc" dir="auto"></textarea></div>
    <div class="samples"><span class="small muted">${t("try_example")}</span><button class="chip" id="ccex">${tr('"Wrong number" chat', 'Chat de "número equivocado"')}</button></div>
    <button class="btn primary" id="ccgo">${tr("Check this offer", "Revisar esta oferta")}</button></div><div id="result" aria-live="polite"></div></section>
  <section class="sect"><h2 class="sect-h">${tr("Already sent crypto?", "¿Ya envió cripto?")}</h2>
    <button class="tile" data-go="scammed"><span class="tile-ic t-call">${ic("sos")}</span><span class="tile-tx"><b>${t("scammed_card")}</b><span>${tr("Make a report with the wallet addresses and transaction IDs, like the ScamBusters do.", "Haga un reporte con las billeteras e IDs de transacción, como hacen los ScamBusters.")}</span></span>${ic("chev", "chev")}</button></section>`;
  bindBack();
  const site = () => {
    const v = document.getElementById("cw").value;
    if (!v.trim()) return;
    document.getElementById("cwres").innerHTML = cryptoIntelHTML(
      cryptoSiteInfo(v),
      tr("About this website", "Sobre este sitio")
    );
  };
  const wal = () => {
    const v = document.getElementById("ca").value;
    if (!v.trim()) return;
    document.getElementById("cares").innerHTML = cryptoIntelHTML(
      walletInfo(v),
      tr("About this wallet", "Sobre esta billetera")
    );
  };
  document.getElementById("cwgo").onclick = site;
  document.getElementById("cago").onclick = wal;
  view.querySelectorAll("[data-cw]").forEach(
    b =>
      (b.onclick = () => {
        document.getElementById("cw").value = b.dataset.cw;
        site();
      })
  );
  view.querySelectorAll("[data-ca]").forEach(
    b =>
      (b.onclick = () => {
        document.getElementById("ca").value = b.dataset.ca;
        wal();
      })
  );
  document.getElementById("ccex").onclick = () => {
    document.getElementById("cc").value = CRYPTO_CHAT;
  };
  document.getElementById("ccgo").onclick = async () => {
    const v = document.getElementById("cc").value.trim();
    if (!v) {
      toast(t("paste_first"));
      return;
    }
    await showVerdict(
      { id: "paste", channel: "message", source: "paste", text: v, links: [], attachments: [], subject: "" },
      null,
      "phone"
    );
  };
  view.querySelectorAll("[data-go]").forEach(
    b =>
      (b.onclick = () => {
        if (b.dataset.go === "scammed") scamState.method = "crypto";
        go(b.dataset.go);
      })
  );
}

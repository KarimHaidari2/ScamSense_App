/*
 * ScamSense · Owner dashboard (owner.html)
 * A private page for the ScamSense owner: every person, their profile, danger alerts,
 * costs, services, and owner actions (block, email, send report, reset phone checks, notes).
 * Sign-in: Google (openid + email only). The ScamSense server checks the email is an owner
 * (OWNER.EMAIL or Script Property OWNER_LOGINS) before it answers anything.
 * Add ?demo to the link to see it with made-up sample people.
 */
"use strict";

const SERVER_URL =
  (() => {
    try {
      return JSON.parse(localStorage.getItem("ss_cfg") || "{}").mahiUrl || "";
    } catch (e) {
      return "";
    }
  })() ||
  "https://script.google.com/macros/s/AKfycbwXjtRfbMG2_8y8R9Wje6ddxmZDuPMnsDsFfHlqjw5n_v1-_ey2I4B3URS8cw04QpYn/exec";
const CLIENT_ID = "848599932394-4vcu5c7lgkdbmlculansl4ae6u76k0ug.apps.googleusercontent.com";
const DEMO = /[?&]demo\b/.test(location.search);
const MS_CLIENT_ID = "1187ff8b-fa16-43d4-acb6-788bb696c627";
const MS_LOGIN = "https://login.microsoftonline.com/common/oauth2/v2.0";
// Microsoft sends you back to the ScamSense app's address (already allowed in Azure), which passes you on here.
const MS_REDIRECT = location.origin + location.pathname.replace(/owner\.html$/, "");
let provider = "ms"; // "ms" (Outlook) or "google"

const $ = id => document.getElementById(id);
const main = $("main");
const esc = s =>
  String(s == null ? "" : s).replace(
    /[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
const OWL = `<svg viewBox="0 0 120 130" aria-hidden="true"><polygon points="22,34 28,4 48,22" fill="#F5F5F2"/><polygon points="98,34 92,4 72,22" fill="#F5F5F2"/><rect x="20" y="14" width="80" height="108" rx="40" fill="#F5F5F2"/><path d="M30,70 C30,96 44,112 60,116 C76,112 90,96 90,70 Z" fill="#DADDE5"/><circle cx="45" cy="52" r="16" fill="#14213D"/><circle cx="75" cy="52" r="16" fill="#14213D"/><circle cx="45" cy="52" r="8.5" fill="#E0A93B"/><circle cx="75" cy="52" r="8.5" fill="#E0A93B"/><circle cx="45" cy="52" r="3.8" fill="#14213D"/><circle cx="75" cy="52" r="3.8" fill="#14213D"/><polygon points="54,70 66,70 60,82" fill="#E0A93B"/><polyline points="46,96 56,106 76,86" fill="none" stroke="#14213D" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
$("owl").innerHTML = OWL;

let token = "";
let data = null; // the overview
const people = {}; // person details, by user ID

/* ----- small helpers ----- */
function toast(m) {
  const t = $("toast");
  t.textContent = m;
  t.classList.add("on");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("on"), 3500);
}
const name = u => [u["First name"], u["Last name"]].filter(Boolean).join(" ") || "(no name yet)";
const initials = u =>
  (
    ((u["First name"] || "")[0] || "") + ((u["Last name"] || "")[0] || "") ||
    (u.Email || "?")[0] ||
    "?"
  ).toUpperCase();
const yes = v => /^\s*(yes|y|true|blocked)\s*$/i.test(String(v || ""));
const ms = v => (v ? new Date(v).getTime() : 0);
function ago(v) {
  const t = ms(v);
  if (!t) return "never";
  const s = (Date.now() - t) / 1000;
  if (s < 90) return "just now";
  if (s < 3600) return Math.round(s / 60) + " min ago";
  if (s < 86400) return Math.round(s / 3600) + " hr ago";
  if (s < 86400 * 30) {
    const n = Math.round(s / 86400);
    return n + (n === 1 ? " day ago" : " days ago");
  }
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
const when = v =>
  ms(v)
    ? new Date(v).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      })
    : "—";
const needsFollow = u => /needs/i.test(String(u["Follow-up"] || ""));
function statusOf(u) {
  if (yes(u.Blocked)) return ["blocked", "Blocked"];
  if (needsFollow(u)) return ["follow", "Needs follow-up"];
  if (/quiet/i.test(String(u.Status || ""))) return ["quiet", "Quiet 7+ days"];
  return ["active", "Active"];
}
const chip = u => {
  const [c, t] = statusOf(u);
  return `<span class="chip c-${c}">${t}</span>`;
};

/* ----- talking to the server ----- */
async function api(body) {
  if (DEMO) return demoApi(body);
  const r = await fetch(SERVER_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(
      Object.assign({ mode: "owner" }, provider === "ms" ? { mstoken: token } : { gtoken: token }, body)
    )
  });
  const j = await r.json();
  if (j && j.signin) {
    signOut(true);
    throw new Error(j.error);
  }
  if (j && j.needCode && body.action !== "join") {
    showCode(j.email, "");
    throw new Error("");
  }
  if (j && j.notOwner) {
    showNotOwner(j.email);
    throw new Error(j.error);
  }
  if (!j || !j.ok) throw new Error((j && j.error) || "The server didn't answer.");
  return j;
}

/* ----- sign-in ----- */
function showSignIn(msg) {
  $("nav").hidden = true;
  $("who").innerHTML = "";
  main.innerHTML = `<section class="gate">
    <div class="gate-owl">${OWL}</div>
    <h1>ScamSense Owner</h1>
    <p>This page is only for the ScamSense owner. Sign in with your owner account.</p>
    ${msg ? `<p class="err">${esc(msg)}</p>` : ""}
    <button class="btn primary big" id="signinms">Sign in with Outlook (Microsoft)</button>
    <button class="btn big gbtn" id="signin">Sign in with Google</button>
    <p class="small"><a href="?demo">See it with sample data</a></p>
  </section>`;
  $("signin").onclick = signIn;
  $("signinms").onclick = signInMs;
}
function showNotOwner(email) {
  showSignIn(
    `${email} isn't an owner account. Sign in with scamsense.karim@outlook.com, or add this email to OWNER_LOGINS in the ScamSense Server's Script Properties.`
  );
}
function showCode(email, msg) {
  $("nav").hidden = true;
  main.innerHTML = `<section class="gate">
    <div class="gate-owl">${OWL}</div>
    <h1>Welcome to the team</h1>
    <p>You're signed in as <b>${esc(email)}</b>. Enter the 6-digit code from your invite email.</p>
    ${msg ? `<p class="err">${esc(msg)}</p>` : ""}
    <label class="sr" for="jcode">Invite code</label>
    <input id="jcode" class="codebox" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456">
    <button class="btn primary big" id="jgo">Join</button>
    <p class="small"><button class="linkbtn" id="jout">Use a different account</button></p>
  </section>`;
  $("jcode").focus();
  const go2 = async () => {
    const code = $("jcode").value.replace(/\D/g, "");
    if (code.length < 6) return $("jcode").focus();
    $("jgo").disabled = true;
    try {
      const r = await fetch(SERVER_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(
          Object.assign(
            { mode: "owner", action: "join", code },
            provider === "ms" ? { mstoken: token } : { gtoken: token }
          )
        )
      });
      const j = await r.json();
      if (j && j.joined) return load();
      showCode(email, (j && j.error) || "That didn't work.");
    } catch (e) {
      showCode(email, "Couldn't reach the server. Try again.");
    }
  };
  $("jgo").onclick = go2;
  $("jcode").onkeydown = e => {
    if (e.key === "Enter") go2();
  };
  $("jout").onclick = () => signOut();
}
function signIn() {
  if (!window.google || !google.accounts || !google.accounts.oauth2) {
    toast("Google sign-in is still loading. Try again in a moment.");
    return;
  }
  const tc = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: "openid email",
    callback: r => {
      if (!r || !r.access_token) return toast("Sign-in didn't finish.");
      saveToken("google", r.access_token, r.expires_in);
      load();
    }
  });
  tc.requestAccessToken({ prompt: "" });
}
function saveToken(p, t, sec) {
  provider = p;
  token = t;
  try {
    sessionStorage.setItem("own_t", JSON.stringify({ p, t, exp: Date.now() + (sec || 3600) * 1000 - 60000 }));
  } catch (e) {}
}
/* Microsoft (Outlook) sign-in, the secure way for web pages (PKCE). Only asks who you are. */
const b64url = buf =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const rnd = n => b64url(crypto.getRandomValues(new Uint8Array(n)));
async function signInMs() {
  const verifier = rnd(48),
    state = rnd(16);
  sessionStorage.setItem("own_pkce", JSON.stringify({ verifier, state }));
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  location.href =
    MS_LOGIN +
    "/authorize?" +
    new URLSearchParams({
      client_id: MS_CLIENT_ID,
      response_type: "code",
      redirect_uri: MS_REDIRECT,
      response_mode: "query",
      scope: "openid User.Read",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account",
      login_hint: "scamsense.karim@outlook.com"
    });
}
async function finishMs() {
  const q = new URLSearchParams(location.search);
  if (!q.has("code") && !q.has("error")) return false;
  const saved = JSON.parse(sessionStorage.getItem("own_pkce") || "null");
  sessionStorage.removeItem("own_pkce");
  history.replaceState(null, "", location.pathname + location.hash);
  if (q.has("error")) {
    showSignIn(q.get("error_description") || "Microsoft sign-in was cancelled.");
    return true;
  }
  if (!saved || saved.state !== q.get("state")) {
    showSignIn("That sign-in didn't match. Please try again.");
    return true;
  }
  try {
    const r = await fetch(MS_LOGIN + "/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: MS_CLIENT_ID,
        scope: "openid User.Read",
        grant_type: "authorization_code",
        code: q.get("code"),
        redirect_uri: MS_REDIRECT,
        code_verifier: saved.verifier
      })
    });
    const j = await r.json().catch(() => ({}));
    if (!j.access_token)
      throw new Error(
        j.error_description ? j.error_description.split("\r\n")[0] : "Microsoft sign-in failed."
      );
    saveToken("ms", j.access_token, j.expires_in);
    load();
  } catch (e) {
    showSignIn(e.message);
  }
  return true;
}
function signOut(expired) {
  token = "";
  data = null;
  try {
    sessionStorage.removeItem("own_t");
  } catch (e) {}
  showSignIn(expired ? "Your sign-in ended. Please sign in again." : "");
}

/* ----- loading ----- */
async function load(quiet) {
  if (!quiet) main.innerHTML = `<p class="loading">Loading…</p>`;
  try {
    data = await api({ action: "overview" });
    $("nav").hidden = false;
    $("teamtab").hidden = data.role !== "owner";
    document.body.dataset.role = data.role || "owner";
    $("who").innerHTML =
      `${DEMO ? `<span class="chip c-quiet">Sample data</span><a class="exitdemo" href="owner.html">Exit sample · Sign in</a>` : ""}<span class="email">${esc(data.owner)} · ${esc({ owner: "Owner", admin: "Admin", viewer: "Viewer" }[data.role || "owner"])}</span><button class="iconbtn" id="refresh" aria-label="Refresh" title="Refresh"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.9-4M4 4v4h4M4 13a8 8 0 0 0 14.9 4M20 20v-4h-4"/></svg></button>${DEMO ? "" : `<button class="linkbtn" id="signout">Sign out</button>`}`;
    $("refresh").onclick = () => load();
    if ($("signout")) $("signout").onclick = () => signOut();
    const open = data.users.filter(needsFollow).length;
    $("alertbadge").hidden = !open;
    $("alertbadge").textContent = open;
    route();
  } catch (e) {
    if ((token || DEMO) && e.message && !main.querySelector(".gate"))
      main.innerHTML = `<p class="err pad">${esc(e.message)}</p>`;
  }
}

/* ----- navigation ----- */
function go(hash) {
  if (location.hash === "#" + hash) route();
  else location.hash = hash;
}
addEventListener("hashchange", route);
document.querySelectorAll("#nav button").forEach(b => (b.onclick = () => go(b.dataset.tab)));
function route() {
  if (!data) return;
  const h = location.hash.slice(1) || "overview";
  const [tab, arg] = h.split("/");
  document
    .querySelectorAll("#nav button")
    .forEach(b =>
      b.dataset.tab === (tab === "person" ? "people" : tab)
        ? b.setAttribute("aria-current", "page")
        : b.removeAttribute("aria-current")
    );
  (
    ({
      overview,
      people: peopleTab,
      person: personPage,
      alerts: alertsTab,
      costs: costsTab,
      log: logTab,
      team: teamTab
    })[tab] || overview
  )(decodeURIComponent(arg || ""));
  main.focus({ preventScroll: true });
  scrollTo(0, 0);
}
function bindOpen(root) {
  (root || main)
    .querySelectorAll("[data-uid]")
    .forEach(el => (el.onclick = () => go("person/" + el.dataset.uid)));
}

/* ----- What ScamSense checked, for every kind of thing (emails, texts, calls, ...) ----- */
const KINDS = [
  ["email", "📧", "Emails"],
  ["text", "💬", "Text messages"],
  ["call", "📞", "Phone calls"],
  ["web", "🌐", "Websites, links, crypto"],
  ["pay", "✋", "Payments paused"],
  ["leak", "🛡️", "Email leak checks"],
  ["phone", "📱", "Phone number checks"],
  ["scammed", "🚨", '"I was scammed"']
];
function kindOf(r) {
  const w = String(r.What || ""),
    c = String(r.Channel || "").toLowerCase();
  if (/Scanned email/.test(w)) return "email";
  if (/leak/i.test(w)) return "leak";
  if (/phone number/i.test(w)) return "phone";
  if (/Pause/.test(w)) return "pay";
  if (/scammed/.test(w)) return "scammed";
  if (/Checked something/.test(w))
    return c === "call" ? "call" : c === "text" ? "text" : c === "email" ? "email" : "web";
  return "";
}
function kindStats(rows) {
  const st = {};
  KINDS.forEach(([k]) => (st[k] = { n: 0, bad: 0 }));
  rows.forEach(r => {
    const k = kindOf(r);
    if (!k) return;
    const res = String(r.Result || "");
    if (/Scanned email/.test(r.What)) {
      const m = res.match(/(\d+) emails, (\d+) scams/);
      st.email.n += m ? +m[1] : 0;
      st.email.bad += m ? +m[2] : 0;
      return;
    }
    st[k].n++;
    if (res === "scam" || /[1-9]\d* leaks|public|already paid/.test(res + " " + r.What)) st[k].bad++;
  });
  return st;
}
function kindsHTML(rows, title) {
  const st = kindStats(rows);
  return `<section class="card"><h2>${title}</h2><div class="kinds">${KINDS.map(([k, icon, label]) => {
    const x = st[k];
    const badWord =
      k === "leak"
        ? "found leaks"
        : k === "phone"
          ? "info public"
          : k === "pay"
            ? "already paid"
            : k === "scammed"
              ? ""
              : "scams";
    return `<div class="kind${x.n ? "" : " zero"}"><span class="ki" aria-hidden="true">${icon}</span><b>${x.n}</b><span>${label}</span>${x.bad && badWord ? `<small class="r-scam">${x.bad} ${x.bad === 1 && badWord === "scams" ? "scam" : badWord}</small>` : `<small>&nbsp;</small>`}</div>`;
  }).join("")}</div></section>`;
}

/* ----- Charts ----- */
function barChart(title, rows, note) {
  const max = Math.max(1, ...rows.map(r => r[1]));
  const total = rows.reduce((n, r) => n + r[1], 0);
  return `<section class="card"><h2>${title}</h2><div class="bars" role="list">${rows
    .map(
      ([label, n, color]) =>
        `<div class="brow" role="listitem"><span class="bl">${label}</span><span class="bt"><i style="width:${Math.round((n / max) * 100)}%;background:${color}"></i></span><b>${n}</b><small>${total ? Math.round((n / total) * 100) : 0}%</small></div>`
    )
    .join("")}</div>${note ? `<p class="muted small">${note}</p>` : ""}</section>`;
}
function connectChart(U) {
  const g = u => /connected/i.test(String(u.Gmail || "")) && !/disconnected/i.test(String(u.Gmail || ""));
  const o = u => /connected/i.test(String(u.Outlook || "")) && !/disconnected/i.test(String(u.Outlook || ""));
  return barChart(
    "How people connect their email",
    [
      ["Gmail", U.filter(u => g(u) && !o(u)).length, "#4285F4"],
      ["Outlook", U.filter(u => o(u) && !g(u)).length, "#0078D4"],
      ["Both", U.filter(u => g(u) && o(u)).length, "#14213D"],
      ["Not connected yet", U.filter(u => !g(u) && !o(u)).length, "#9AA4B8"]
    ],
    `${U.length} people in total`
  );
}
function checksChart(rows) {
  const st = kindStats(rows);
  const colors = {
    email: "#14213D",
    text: "#C8932A",
    call: "#B42318",
    web: "#1D63C9",
    pay: "#9A5B00",
    leak: "#1F7A3E",
    phone: "#6B3FD4",
    scammed: "#E2553F"
  };
  return barChart(
    "What people check",
    KINDS.map(([k, , label]) => [
      label,
      k === "email" ? rows.filter(r => kindOf(r) === "email").length : st[k].n,
      colors[k]
    ]),
    "From recent activity. Emails = email scans and email checks."
  );
}

/* ----- Overview ----- */
function overview() {
  const U = data.users;
  const week = Date.now() - 7 * 864e5;
  const active = U.filter(u => ms(u["Last active"]) >= week).length;
  const fresh = U.filter(u => ms(u["First seen"]) >= week);
  const scams = U.reduce((n, u) => n + (+u["Scams caught"] || 0), 0);
  const scanned = U.reduce((n, u) => n + (+u["Emails scanned"] || 0), 0);
  const attention = U.filter(u => needsFollow(u) || yes(u.Blocked));
  const stat = (n, label, sub) =>
    `<div class="stat"><b>${n}</b><span>${label}</span>${sub ? `<small>${sub}</small>` : ""}</div>`;
  main.innerHTML = `<h1>Overview</h1>
  <div class="stats">
    ${stat(U.length, "People", `${U.filter(u => u["Email verified"] === "yes").length} with a confirmed email`)}
    ${stat(active, "Active this week", `${fresh.length} new this week`)}
    ${stat(scams, "Scams caught", `${scanned.toLocaleString()} emails scanned`)}
    ${stat(data.alerts.length, "Danger alerts", `${U.filter(needsFollow).length} need follow-up`)}
  </div>
  ${attention.length ? `<section class="card warn"><h2>Needs your attention</h2>${list(attention)}</section>` : ""}
  <div class="cols">${connectChart(U)}${checksChart(data.activity)}</div>
  ${kindsHTML(data.activity, "What people checked (recent activity)")}
  <div class="cols">
    <section class="card"><h2>Newest people</h2>${list(
      U.slice()
        .sort((a, b) => ms(b["First seen"]) - ms(a["First seen"]))
        .slice(0, 6),
      "First seen"
    )}
      <button class="linkbtn" data-go="people">See everyone</button></section>
    <section class="card"><h2>Latest activity</h2>${feed(data.activity.slice(0, 12), true)}</section>
  </div>`;
  bindOpen();
  main.querySelectorAll("[data-go]").forEach(b => (b.onclick = () => go(b.dataset.go)));
}
function list(us, dateCol) {
  if (!us.length) return `<p class="muted">Nobody here.</p>`;
  return `<ul class="plist">${us
    .map(
      u =>
        `<li><button data-uid="${esc(u["User ID"])}"><span class="av">${esc(initials(u))}</span><span class="pl"><b>${esc(name(u))}</b><span>${esc(u.Email || "no email yet")}${u.Email && u["Email verified"] !== "yes" ? " · not confirmed" : ""}</span></span><span class="pr">${chip(u)}<small>${dateCol === "First seen" ? "joined " + ago(u["First seen"]) : ago(u["Last active"])}</small></span></button></li>`
    )
    .join("")}</ul>`;
}
const WHAT_ICON = w =>
  /scam/i.test(w)
    ? "🚨"
    : /pay/i.test(w)
      ? "✋"
      : /connect/i.test(w)
        ? "🔗"
        : /leak/i.test(w)
          ? "🛡️"
          : /phone/i.test(w)
            ? "📱"
            : /scan/i.test(w)
              ? "📬"
              : /block/i.test(w)
                ? "⛔"
                : "🔍";
function feed(rows, withName) {
  if (!rows.length) return `<p class="muted">Nothing yet.</p>`;
  const users = {};
  data.users.forEach(u =>
    [u["User ID"]].concat(String(u.Devices || "").split(/\s+/)).forEach(id => id && (users[id] = u))
  );
  const tone = res =>
    res === "scam" || /\b[1-9]\d* scams?\b/.test(res)
      ? "scam"
      : res === "warn" || /\b[1-9]\d* leaks?\b|public/.test(res)
        ? "warn"
        : res === "safe" || /\b0 leaks\b|nothing confirmed/.test(res)
          ? "ok"
          : "";
  return `<ul class="feed">${rows
    .map(r => {
      const u = users[r["User ID"]];
      const res = String(r.Result || "");
      const bits = [
        r.Channel ? esc(r.Channel) : "",
        res ? `<span class="r-${tone(res)}">${esc(res === "warn" ? "be careful" : res)}</span>` : "",
        r["Scam type"] ? esc(r["Scam type"]) : ""
      ].filter(Boolean);
      const who = withName
        ? `${u ? `<a href="#person/${encodeURIComponent(u["User ID"])}">${esc(name(u))}</a>` : esc(r.Name || "")} · ${ago(r.Time)}`
        : when(r.Time);
      return `<li><span class="fi" aria-hidden="true">${WHAT_ICON(r.What || "")}</span><span class="fl"><span><b>${esc(r.What)}</b>${bits.length ? " · " + bits.join(" · ") : ""}</span><small>${who}</small></span></li>`;
    })
    .join("")}</ul>`;
}

/* ----- People ----- */
let pf = { q: "", f: "all" };
function peopleTab() {
  main.innerHTML = `<h1>People <small>${data.users.length}</small></h1>
  <div class="tools"><label class="sr" for="q">Search people</label><input id="q" type="search" placeholder="Search by name or email" value="${esc(pf.q)}" autocomplete="off">
  <div class="seg" role="group" aria-label="Show">${[
    ["all", "All"],
    ["active", "Active"],
    ["quiet", "Quiet"],
    ["follow", "Follow-up"],
    ["blocked", "Blocked"]
  ]
    .map(([k, t]) => `<button data-f="${k}" aria-pressed="${pf.f === k}">${t}</button>`)
    .join("")}</div></div>
  <section class="card" id="plist"></section>`;
  const draw = () => {
    const q = pf.q.toLowerCase();
    const us = data.users
      .filter(u => !q || (name(u) + " " + (u.Email || "")).toLowerCase().includes(q))
      .filter(u => pf.f === "all" || statusOf(u)[0] === pf.f)
      .sort((a, b) => ms(b["Last active"]) - ms(a["Last active"]));
    $("plist").innerHTML = list(us);
    bindOpen($("plist"));
  };
  $("q").oninput = e => {
    pf.q = e.target.value;
    draw();
  };
  main.querySelectorAll("[data-f]").forEach(
    b =>
      (b.onclick = () => {
        pf.f = b.dataset.f;
        main.querySelectorAll("[data-f]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        draw();
      })
  );
  draw();
}

/* ----- One person: their profile, like a document ----- */
async function personPage(uid) {
  const base = data.users.find(u => u["User ID"] === uid);
  if (!people[uid]) {
    main.innerHTML = `<button class="back" id="back">‹ People</button><p class="loading">Loading ${esc(base ? name(base) : "")}…</p>`;
    $("back").onclick = () => go("people");
    try {
      people[uid] = await api({ action: "person", uid });
    } catch (e) {
      main.innerHTML += `<p class="err">${esc(e.message)}</p>`;
      return;
    }
  }
  drawPerson(people[uid]);
}
function drawPerson(d) {
  const u = d.person;
  const uid = u["User ID"];
  const row = (k, v) => `<div class="kv"><span>${k}</span><b>${v || "—"}</b></div>`;
  const devices = [uid].concat(String(u.Devices || "").split(/\s+/)).filter(Boolean);
  const family = String(u["Trusted people"] || "")
    .split("\n")
    .filter(Boolean);
  const blocked = yes(u.Blocked);
  main.innerHTML = `<button class="back" id="back">‹ People</button>
  <article class="doc">
    <header class="doc-head">
      <span class="av big">${esc(initials(u))}</span>
      <div><h1>${esc(name(u))}</h1><p>${esc(u.Email || "No email yet")} ${u["Email verified"] === "yes" ? `<span class="chip c-active">confirmed</span>` : u.Email ? `<span class="chip c-quiet">not confirmed</span>` : ""} ${chip(u)}</p>
      <p class="muted small">Joined ${when(u["First seen"])} · last active ${ago(u["Last active"])}</p></div>
    </header>

    <div class="actions"${data.role === "viewer" ? " hidden" : ""}>
      <button class="btn" data-act="email" ${u["Email verified"] === "yes" ? "" : "disabled"}>Email ${esc(u["First name"] || "them")}</button>
      <button class="btn" data-act="send_report" ${u["Email verified"] === "yes" ? "" : "disabled"}>Send today's report</button>
      <button class="btn" data-act="reset_phone">Reset phone checks</button>
      ${needsFollow(u) ? `<button class="btn" data-act="followup_done">Mark follow-up done</button>` : ""}
      <button class="btn ${blocked ? "" : "danger"}" data-act="${blocked ? "unblock" : "block"}">${blocked ? "Unblock" : "Block"}</button>
      <button class="btn" id="print">Print / save as PDF</button>
    </div>
    <div id="compose" hidden class="card compose">
      <label for="esub">Subject</label><input id="esub" value="A message from ScamSense">
      <label for="ebody">Message</label><textarea id="ebody" rows="5" placeholder="Hi ${esc(u["First name"] || "")}, …"></textarea>
      <div class="row"><button class="btn primary" id="esend">Send email</button><button class="btn" id="ecancel">Cancel</button></div>
      <p class="muted small">It goes to ${esc(u.Email || "")}. Replies come to your owner email.</p>
    </div>

    ${kindsHTML(d.activity, "What ScamSense checked for " + esc(u["First name"] || "them"))}
    <div class="stats four">
      <div class="stat"><b>${+u["Emails scanned"] || 0}</b><span>Emails scanned</span></div>
      <div class="stat"><b>${+u["Scams caught"] || 0}</b><span>Scams caught</span></div>
      <div class="stat"><b>${+u.Checks || 0}</b><span>Checks</span></div>
      <div class="stat"><b>${d.phoneChecksUsed} / ${d.phoneChecksMax}</b><span>Phone checks this month</span></div>
    </div>

    <div class="cols">
      <section class="card"><h2>Account</h2>
        ${row("First name", esc(u["First name"]))}${row("Last name", esc(u["Last name"]))}${row("Email", esc(u.Email))}
        ${row("Gmail", esc(u.Gmail))}${row("Outlook", esc(u.Outlook))}${row("Language", esc(u.Language))}
        ${row("Daily report email", esc(u["Daily report"]))}${row("Danger alerts", esc(u["Danger alerts"]))}
        ${row("Devices", devices.length + (devices.length === 1 ? " device" : " devices"))}${row("Follow-up", esc(u["Follow-up"]))}
        ${row("User ID", `<code>${esc(uid)}</code>`)}
      </section>
      <section class="card"><h2>Trusted people</h2>
        ${family.length ? `<ul class="fam">${family.map(f => `<li>${esc(f)}</li>`).join("")}</ul>` : `<p class="muted">None added.</p>`}
        <h2 class="mt">Your notes</h2>
        <label class="sr" for="note">Your notes about this person</label>
        <textarea id="note" rows="4" placeholder="Only you see this. For example: called on Nov 20, all good.">${esc(u["Owner notes"] || "")}</textarea>
        ${data.role === "viewer" ? "" : `<button class="btn" id="savenote">Save note</button>`}
      </section>
    </div>

    ${d.alerts.length ? `<section class="card warn"><h2>Danger alerts</h2><ul class="feed">${d.alerts.map(a => `<li><span class="fi" aria-hidden="true">🚨</span><span class="fl"><b>${esc(a["What happened"])}</b><small>${when(a.Time)}${a["Emailed to"] ? " · emailed " + esc(a["Emailed to"]) : ""}</small></span></li>`).join("")}</ul></section>` : ""}

    <section class="card"><h2>Activity <small>${d.activity.length}</small></h2>${feed(d.activity, false)}</section>
    <p class="muted small">ScamSense keeps only what happened (like "text message: scam"), never anyone's messages.</p>
  </article>`;
  $("back").onclick = () => go("people");
  $("print").onclick = () => print();
  const compose = $("compose");
  main.querySelectorAll("[data-act]").forEach(
    b =>
      (b.onclick = () => {
        const a = b.dataset.act;
        if (a === "email") {
          compose.hidden = false;
          $("ebody").focus();
          return;
        }
        if (
          a === "block" &&
          !confirmBox(`Block ${name(u)}? ScamSense will stop working for them until you unblock.`, b)
        )
          return;
        act(uid, { action: a }, b);
      })
  );
  $("ecancel").onclick = () => (compose.hidden = true);
  $("esend").onclick = () =>
    act(uid, { action: "email", subject: $("esub").value, body: $("ebody").value }, $("esend"));
  if ($("savenote"))
    $("savenote").onclick = () => act(uid, { action: "note", note: $("note").value }, $("savenote"));
}
// A second tap confirms (no browser pop-ups).
function confirmBox(msg, btn) {
  if (btn.dataset.sure) return true;
  btn.dataset.sure = "1";
  btn.textContent = "Tap again to confirm";
  toast(msg);
  setTimeout(() => {
    delete btn.dataset.sure;
    btn.textContent = "Block";
  }, 5000);
  return false;
}
async function act(uid, body, btn) {
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Working…";
  try {
    const j = await api(Object.assign({ uid }, body));
    toast(j.done || "Done");
    people[uid] = j;
    const i = data.users.findIndex(u => u["User ID"] === uid);
    if (i >= 0) data.users[i] = Object.assign({}, data.users[i], j.person);
    drawPerson(j);
  } catch (e) {
    toast(e.message);
    btn.disabled = false;
    btn.textContent = old;
  }
}

/* ----- Alerts ----- */
function alertsTab() {
  const follow = data.users.filter(needsFollow);
  main.innerHTML = `<h1>Danger alerts</h1>
  <p class="muted">When someone says they were scammed or already paid, ScamSense emails you and their trusted people right away. Reach out, then mark it done on their page.</p>
  ${follow.length ? `<section class="card warn"><h2>Needs follow-up</h2>${list(follow)}</section>` : `<section class="card ok"><p>Nobody needs follow-up right now.</p></section>`}
  <section class="card"><h2>All alerts</h2>${
    data.alerts.length
      ? `<ul class="feed">${data.alerts
          .map(a => {
            const u = data.users.find(x => (a.Email && x.Email === a.Email) || name(x) === a.Name);
            return `<li><span class="fi" aria-hidden="true">🚨</span><span class="fl"><b>${u ? `<a href="#person/${encodeURIComponent(u["User ID"])}">${esc(a.Name)}</a>` : esc(a.Name)}</b> ${esc(a["What happened"])}<small>${when(a.Time)}</small></span></li>`;
          })
          .join("")}</ul>`
      : `<p class="muted">No alerts yet.</p>`
  }</section>`;
}

/* ----- Costs and services ----- */
function costsTab() {
  const u = data.usage;
  const pct = Math.min(100, Math.round((u.aiToday / u.aiDailyLimit) * 100));
  main.innerHTML = `<h1>Costs and services</h1>
  <div class="stats">
    <div class="stat"><b>${u.aiToday}</b><span>AI answers today</span><div class="bar"><i style="width:${pct}%"></i></div><small>Daily limit ${u.aiDailyLimit} · ${u.aiMonth} this month</small></div>
    <div class="stat"><b>${u.sms}</b><span>Text codes this month</span><small>Twilio · about $${(u.sms * 0.0583).toFixed(2)}</small></div>
    <div class="stat"><b>${u.lookups}</b><span>Phone lookups this month</span><small>Trestle · about $${(u.lookups * 0.07).toFixed(2)}</small></div>
    <div class="stat"><b>${u.leaks}</b><span>Email leak checks</span><small>Free</small></div>
  </div>
  <section class="card"><h2>Estimated this month (texts + lookups)</h2><p class="big">$${u.estCost.toFixed(2)}</p>
  <p class="muted small">AI costs are in the Claude Console. Twilio is prepaid ($20, auto-recharge off).</p></section>
  <section class="card"><h2>Services</h2><ul class="svc">${data.services
    .map(
      s =>
        `<li><span class="dot ${s.ok ? "on" : "off"}" aria-hidden="true"></span><span class="fl"><b>${esc(s.name)}</b><small>${s.ok ? "Set up" : "Not set up"}${s.note ? " · " + esc(s.note) : ""}</small></span><a href="${esc(s.link)}" target="_blank" rel="noopener noreferrer">Open</a></li>`
    )
    .join("")}</ul></section>`;
}

/* ----- Team (only the owner) ----- */
function teamTab() {
  if (data.role !== "owner") return overview();
  const team = data.team || [];
  main.innerHTML = `<h1>Team</h1>
  <p class="muted">Add people who can use this dashboard. They get an email with a code, sign in with that email (Outlook or Google), and enter the code once.</p>
  <section class="card"><h2>Add someone</h2>
    <div class="addrow">
      <label class="sr" for="tmail">Their email</label><input id="tmail" type="email" placeholder="Their email" autocomplete="off">
      <label class="sr" for="trole">Role</label><select id="trole"><option value="Viewer">Viewer: can look</option><option value="Admin">Admin: can look and help customers</option></select>
      <button class="btn primary" id="tadd">Send invite</button>
    </div>
  </section>
  <section class="card"><h2>People on the team <small>${team.length}</small></h2>
    <ul class="svc">${team
      .map(
        m =>
          `<li><span class="av sm">${esc((m.email[0] || "?").toUpperCase())}</span><span class="fl"><b>${esc(m.email)}</b><small>${esc(m.role)} · ${m.status === "active" ? "active" : "invited, waiting for their code"}</small></span>${m.role === "Owner" ? "" : `<button class="linkbtn danger" data-rm="${esc(m.email)}">Remove</button>`}</li>`
      )
      .join("")}</ul>
  </section>
  <p class="muted small">Viewers can see people, alerts, and costs. Admins can also email customers, send reports, block, and reset limits. Only you can change the team.</p>`;
  const send = async (body, btn) => {
    btn.disabled = true;
    try {
      const j = await api(body);
      data.team = j.team;
      toast(j.done);
      teamTab();
    } catch (e) {
      if (e.message) toast(e.message);
      btn.disabled = false;
    }
  };
  $("tadd").onclick = () =>
    send({ action: "team_add", email: $("tmail").value, role: $("trole").value }, $("tadd"));
  main
    .querySelectorAll("[data-rm]")
    .forEach(b => (b.onclick = () => send({ action: "team_remove", email: b.dataset.rm }, b)));
}

/* ----- Owner log ----- */
function logTab() {
  main.innerHTML = `<h1>Owner log</h1><p class="muted">Everything done from this dashboard, newest first.</p>
  <section class="card">${
    data.log.length
      ? `<ul class="feed">${data.log
          .map(
            l =>
              `<li><span class="fi" aria-hidden="true">📝</span><span class="fl"><b>${esc(l.Action)}</b>${l.Person ? " · " + esc(l.Person) : ""}<small>${when(l.Time)} · ${esc(l.Owner)}</small></span></li>`
          )
          .join("")}</ul>`
      : `<p class="muted">Nothing yet.</p>`
  }</section>
  <p><a class="linkbtn" href="${esc(data.sheetUrl)}" target="_blank" rel="noopener noreferrer">Open the spreadsheet</a></p>`;
}

/* ----- sample data (owner.html?demo) ----- */
function demoApi(body) {
  const d = (h, m) => new Date(Date.now() - h * 3600e3 - (m || 0) * 60e3).toISOString();
  if (!demoApi.db) {
    const U = (id, f, l, e, extra) =>
      Object.assign(
        {
          "User ID": id,
          "First name": f,
          "Last name": l,
          Email: e,
          "Email verified": e ? "yes" : "",
          Gmail: e ? "connected Nov 18, 4:10 PM" : "",
          Outlook: "",
          Language: "en",
          "Daily report": "on",
          "Danger alerts": "on",
          "Trusted people": "",
          "First seen": d(200),
          "Last active": d(2),
          "Emails scanned": 40,
          "Scams caught": 3,
          Checks: 4,
          Alerts: 0,
          Devices: "",
          "Follow-up": "",
          Blocked: "",
          Status: "active",
          "Owner notes": ""
        },
        extra
      );
    demoApi.db = {
      users: [
        U("demoA0000000000001", "Maria", "Sample", "maria.sample@example.com", {
          "Trusted people": "Ana Sample | ana@example.com | 555-0101",
          "Follow-up": "needs follow-up",
          Alerts: 1,
          "Last active": d(0, 20),
          "Scams caught": 7,
          "Emails scanned": 212
        }),
        U("demoB0000000000002", "George", "Example", "george@example.com", {
          "First seen": d(30),
          "Emails scanned": 88,
          Checks: 9
        }),
        U("demoC0000000000003", "Linda", "Test", "", {
          "First seen": d(5),
          "Last active": d(5),
          "Emails scanned": 0,
          "Scams caught": 0,
          Checks: 1
        }),
        U("demoD0000000000004", "Sam", "Placeholder", "sam@example.com", {
          Status: "quiet 7+ days",
          "Last active": d(240)
        }),
        U("demoE0000000000005", "Pat", "Demo", "pat@example.com", { Blocked: "yes", "Last active": d(400) })
      ],
      activity: [
        {
          Time: d(0, 20),
          "User ID": "demoA0000000000001",
          Name: "Maria Sample",
          What: 'Opened "I was scammed"',
          Channel: "",
          Result: ""
        },
        {
          Time: d(1),
          "User ID": "demoA0000000000001",
          Name: "Maria Sample",
          What: "Checked something",
          Channel: "text",
          Result: "scam",
          "Scam type": "Toll scam"
        },
        {
          Time: d(3),
          "User ID": "demoB0000000000002",
          Name: "George Example",
          What: "Scanned email",
          Channel: "gmail",
          Result: "25 emails, 2 scams, 1 careful"
        },
        {
          Time: d(5),
          "User ID": "demoC0000000000003",
          Name: "Linda Test",
          What: "Checked their phone number",
          Channel: "",
          Result: "name and address public"
        },
        {
          Time: d(9),
          "User ID": "demoB0000000000002",
          Name: "George Example",
          What: "Checked an email for data leaks",
          Channel: "",
          Result: "2 leaks"
        },
        {
          Time: d(26),
          "User ID": "demoA0000000000001",
          Name: "Maria Sample",
          What: "Connected Gmail",
          Channel: "",
          Result: ""
        },
        {
          Time: d(30),
          "User ID": "demoA0000000000001",
          Name: "Maria Sample",
          What: "Checked something",
          Channel: "call",
          Result: "scam",
          "Scam type": "Grandparent scam"
        },
        {
          Time: d(34),
          "User ID": "demoB0000000000002",
          Name: "George Example",
          What: "Checked something",
          Channel: "web",
          Result: "warn"
        },
        {
          Time: d(40),
          "User ID": "demoB0000000000002",
          Name: "George Example",
          What: "Pause before you pay",
          Channel: "",
          Result: "scam"
        },
        {
          Time: d(52),
          "User ID": "demoA0000000000001",
          Name: "Maria Sample",
          What: "Checked something",
          Channel: "email",
          Result: "safe"
        }
      ],
      alerts: [
        {
          Time: d(0, 20),
          Name: "Maria Sample",
          Email: "maria.sample@example.com",
          "What happened": "said they were scammed and opened the recovery steps",
          "Emailed to": "owner, ana@example.com"
        }
      ],
      log: [
        {
          Time: d(48),
          Owner: "owner@example.com",
          Action: "Blocked",
          Person: "Pat Demo",
          "Person email": "pat@example.com"
        }
      ],
      team: [
        { email: "owner@example.com", role: "Owner", status: "active" },
        { email: "helper@example.com", role: "Admin", status: "active" },
        { email: "advisor@example.com", role: "Viewer", status: "invited" }
      ]
    };
  }
  const db = demoApi.db;
  const find = uid => db.users.find(u => u["User ID"] === uid);
  const person = uid => {
    const u = find(uid);
    return {
      ok: true,
      person: u,
      activity: db.activity.filter(a => a["User ID"] === uid),
      alerts: db.alerts.filter(a => a.Email && a.Email === u.Email),
      phoneChecksUsed: uid === "demoC0000000000003" ? 1 : 0,
      phoneChecksMax: 3
    };
  };
  return new Promise(res =>
    setTimeout(() => {
      if (body.action === "overview")
        return res({
          ok: true,
          owner: "owner@example.com",
          role: "owner",
          team: db.team,
          users: db.users,
          activity: db.activity,
          alerts: db.alerts,
          log: db.log,
          usage: {
            aiToday: 37,
            aiMonth: 412,
            aiDailyLimit: 300,
            sms: 4,
            lookups: 3,
            leaks: 6,
            estCost: 0.44
          },
          services: [
            { name: "Anthropic AI (Mahi + smart checks)", ok: true, link: "https://console.anthropic.com" },
            { name: "Twilio Verify (text codes)", ok: true, link: "https://console.twilio.com" },
            { name: "Trestle (phone lookup)", ok: true, link: "https://trestleiq.com" },
            {
              name: "Email leak check",
              ok: true,
              note: "XposedOrNot (free)",
              link: "https://xposedornot.com"
            },
            {
              name: "Automatic removal (Optery)",
              ok: false,
              note: "planned",
              link: "https://www.optery.com/api"
            }
          ],
          sheetUrl: "#"
        });
      if (body.action === "person") return res(person(body.uid));
      if (body.action === "team_add") {
        if (!/@/.test(body.email || ""))
          return res({ ok: false, error: "That doesn't look like an email address." });
        db.team.push({ email: body.email, role: body.role, status: "invited" });
        return res({ ok: true, done: "Invite sent (sample: nothing was sent)", team: db.team });
      }
      if (body.action === "team_remove") {
        db.team = db.team.filter(m => m.email !== body.email);
        return res({ ok: true, done: "Removed " + body.email, team: db.team });
      }
      const u = find(body.uid);
      const done = {
        block: () => ((u.Blocked = "yes"), "Blocked"),
        unblock: () => ((u.Blocked = ""), "Unblocked"),
        followup_done: () => ((u["Follow-up"] = "done"), "Follow-up marked done"),
        note: () => ((u["Owner notes"] = body.note), "Saved a note"),
        reset_phone: () => "Reset phone checks for this month",
        send_report: () => "Sent the daily report now (sample: nothing was sent)",
        email: () => "Emailed (sample: nothing was sent)"
      }[body.action]();
      db.log.unshift({
        Time: new Date().toISOString(),
        Owner: "owner@example.com",
        Action: done,
        Person: name(u)
      });
      res(Object.assign({ ok: true, done }, person(body.uid)));
    }, 150)
  );
}

/* ----- start ----- */
(function start() {
  if (DEMO) return load();
  try {
    const s = JSON.parse(sessionStorage.getItem("own_t") || "null");
    if (s && s.exp > Date.now()) {
      provider = s.p || "google";
      token = s.t;
      return load();
    }
  } catch (e) {}
  finishMs().then(handled => handled || showSignIn());
})();

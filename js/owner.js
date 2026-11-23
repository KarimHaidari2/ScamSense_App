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
    setCaseBadge(data.support);
    // Opened from a "New case" email link before signing in? Go to that case now.
    let back = "";
    try {
      back = sessionStorage.getItem("own_hash") || "";
      sessionStorage.removeItem("own_hash");
    } catch (e) {}
    if (back && !location.hash) return go(back.slice(1));
    route();
    if (!caseSeen) watchCases();
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
      b.dataset.tab === (tab === "person" ? "people" : tab === "case" ? "cases" : tab)
        ? b.setAttribute("aria-current", "page")
        : b.removeAttribute("aria-current")
    );
  (
    ({
      overview,
      people: peopleTab,
      person: personPage,
      alerts: alertsTab,
      cases: casesTab,
      case: casePage,
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
  ${data.support && data.support.open ? `<section class="card ${data.support.urgent ? "warn" : ""}"><h2>Open cases</h2><p>${data.support.open} open${data.support.urgent ? ` · <b>${data.support.urgent} urgent</b>` : ""}${data.support.unread ? ` · ${data.support.unread} waiting for your answer` : ""}</p><button class="btn primary" data-go="cases">Open cases</button></section>` : ""}
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

/* ----- Cases: live help with people (chat, photos, shared emails, team notes) ----- */
let cases = null; // the latest list from the server
let caseNow = null; // the open case page
let caseFilter = "open";
let casePhoto = ""; // a photo waiting to be sent
let quick = null; // quick replies
const casePhotos = {};
const CASE_STATUS = { new: "New", open: "Open", waiting: "Waiting for them", closed: "Closed" };
const caseChip = c =>
  `${c.Priority === "urgent" ? `<span class="chip c-blocked">Urgent</span>` : ""}<span class="chip ${c.Status === "closed" ? "c-quiet" : c.Status === "new" ? "c-follow" : "c-active"}">${CASE_STATUS[c.Status] || esc(c.Status)}</span>${+c["Team unread"] ? `<span class="chip c-follow">${+c["Team unread"]} new</span>` : ""}`;

function setCaseBadge(counts) {
  const b = $("casebadge");
  if (!b || !counts) return;
  const n = counts.unread || 0;
  b.hidden = !counts.open;
  b.textContent = n || counts.open;
  b.classList.toggle("quiet", !n && !counts.urgent);
  document.title = (n ? `(${n}) ` : "") + "ScamSense Owner";
}

async function casesTab() {
  main.innerHTML = `<h1>Cases</h1><p class="loading">Loading…</p>`;
  try {
    const j = await api({ action: "cases" });
    cases = j.cases;
    setCaseBadge(j.counts);
  } catch (e) {
    main.innerHTML = `<h1>Cases</h1><p class="err">${esc(e.message)}</p>`;
    return;
  }
  drawCases();
}
function drawCases() {
  const C = cases || [];
  const groups = {
    open: C.filter(c => c.Status !== "closed" && c.Status !== "waiting"),
    waiting: C.filter(c => c.Status === "waiting"),
    closed: C.filter(c => c.Status === "closed"),
    all: C
  };
  const list = groups[caseFilter].slice().sort((a, b) => {
    const u = x => (x.Status !== "closed" && x.Priority === "urgent" ? 1 : 0);
    return (
      u(b) - u(a) ||
      +(b["Team unread"] > 0) - +(a["Team unread"] > 0) ||
      ms(b["Last update"]) - ms(a["Last update"])
    );
  });
  main.innerHTML = `<h1>Cases</h1>
  <p class="muted">People who asked for a person, said they were scammed, or sent you an email. Answer here: they see it in the app, and get an email if they're away.</p>
  <div id="pushbox"></div>
  <div class="seg">${[
    ["open", "Open"],
    ["waiting", "Waiting"],
    ["closed", "Closed"],
    ["all", "All"]
  ]
    .map(
      ([k, l]) =>
        `<button data-f="${k}" aria-pressed="${caseFilter === k}">${l} <small>${groups[k].length}</small></button>`
    )
    .join("")}</div>
  <section class="card">${
    list.length
      ? `<ul class="plist">${list
          .map(
            c =>
              `<li><button data-case="${esc(c["Case ID"])}" class="${c.Priority === "urgent" && c.Status !== "closed" ? "urgentrow" : ""}"><span class="av">${esc(
                (String(c.Name || "?").match(/\b\w/g) || ["?"]).slice(0, 2).join("").toUpperCase()
              )}</span><span class="pl"><b>${esc(c.Name)}</b><span>${esc(c["Last message"] || c.Reason)}</span><span class="tags">${caseChip(c)}</span></span><span class="pr">${ago(c["Last update"] || c.Opened)}<small>${esc(c.Reason)}</small></span></button></li>`
          )
          .join("")}</ul>`
      : `<p class="muted">${caseFilter === "open" ? "No open cases. When someone needs help, it shows up here and your phone gets an alert." : "Nothing here."}</p>`
  }</section>
  <details class="card" id="quickcard"><summary><b>Quick replies</b> <span class="muted small">ready-made answers you can send with one tap</span></summary><div id="quickedit"><p class="loading">Loading…</p></div></details>`;
  main
    .querySelectorAll("[data-f]")
    .forEach(b => (b.onclick = () => ((caseFilter = b.dataset.f), drawCases())));
  main.querySelectorAll("[data-case]").forEach(b => (b.onclick = () => go("case/" + b.dataset.case)));
  pushBox($("pushbox"));
  $("quickcard").ontoggle = () => $("quickcard").open && drawQuickEditor();
}

async function loadQuick() {
  if (!quick) quick = (await api({ action: "quick_list" })).quick;
  return quick;
}
async function drawQuickEditor() {
  const box = $("quickedit");
  try {
    await loadQuick();
  } catch (e) {
    box.innerHTML = `<p class="err">${esc(e.message)}</p>`;
    return;
  }
  const ro = data.role === "viewer";
  box.innerHTML = `<div class="qlist">${quick
    .map(
      (q, i) =>
        `<div class="qrow"><input aria-label="Title" data-qt="${i}" value="${esc(q.title)}" ${ro ? "disabled" : ""}><textarea aria-label="Message" rows="2" data-qm="${i}" ${ro ? "disabled" : ""}>${esc(q.text)}</textarea>${ro ? "" : `<button class="linkbtn" data-qd="${i}">Remove</button>`}</div>`
    )
    .join(
      ""
    )}</div>${ro ? "" : `<div class="row"><button class="btn" id="qadd">Add a quick reply</button><button class="btn primary" id="qsave">Save quick replies</button></div>`}`;
  if (ro) return;
  const read = () =>
    quick.map((q, i) => ({
      title: box.querySelector(`[data-qt="${i}"]`).value,
      text: box.querySelector(`[data-qm="${i}"]`).value
    }));
  $("qadd").onclick = () => {
    quick = read().concat([{ title: "", text: "" }]);
    drawQuickEditor();
  };
  box.querySelectorAll("[data-qd]").forEach(
    b =>
      (b.onclick = () => {
        quick = read().filter((x, i) => i !== +b.dataset.qd);
        drawQuickEditor();
      })
  );
  $("qsave").onclick = async () => {
    try {
      const j = await api({ action: "quick_save", quick: read() });
      quick = j.quick;
      toast("Quick replies saved.");
      drawQuickEditor();
    } catch (e) {
      toast(e.message);
    }
  };
}

let casePoll = null;
async function casePage(id) {
  clearInterval(casePoll);
  casePhoto = "";
  main.innerHTML = `<button class="back" id="back">‹ Cases</button><p class="loading">Loading…</p>`;
  $("back").onclick = () => go("cases");
  try {
    caseNow = await api({ action: "case", caseId: id });
  } catch (e) {
    main.insertAdjacentHTML("beforeend", `<p class="err">${esc(e.message)}</p>`);
    return;
  }
  drawCase();
  loadQuick()
    .then(drawQuickChips)
    .catch(() => {});
  casePoll = setInterval(async () => {
    if (!$("thread") || location.hash !== "#case/" + encodeURIComponent(id)) return clearInterval(casePoll);
    if (document.hidden) return;
    try {
      const j = await api({ action: "case", caseId: id });
      if (j.messages.length !== caseNow.messages.length || j.case.Status !== caseNow.case.Status) {
        caseNow = j;
        drawThread();
        drawCaseHead();
      }
    } catch (e) {}
  }, 8000);
}
function drawCase() {
  const p = caseNow.person;
  const ro = data.role === "viewer";
  main.innerHTML = `<button class="back" id="back">‹ Cases</button>
  <article class="doc casepage">
    <header class="doc-head" id="casehead"></header>
    <div class="caselayout">
      <section class="card threadcard">
        <div class="thread" id="thread" aria-live="polite"></div>
        ${
          ro
            ? `<p class="muted small">Viewers can read cases, but can't answer.</p>`
            : `<div class="quickchips" id="quickchips"></div>
        <div id="cpending" hidden></div>
        <label class="sr" for="ctext">Your message</label>
        <textarea id="ctext" rows="3" placeholder="Write to ${esc((p && p.name.split(" ")[0]) || "them")}… or tap a quick reply above"></textarea>
        <div class="row composer-row">
          <label class="btn">📷 Photo<input id="cfile" type="file" accept="image/*" hidden></label>
          <button class="btn" id="cnote" title="Only the ScamSense team sees notes">Save as team note</button>
          <button class="btn primary" id="csend">Send to ${esc((p && p.name.split(" ")[0]) || "them")}</button>
        </div>
        <p class="muted small">Team notes are your investigation record: what you checked, who you called, what you found. The person never sees them.</p>`
        }
      </section>
      <aside class="card personcard">${
        p
          ? `<h2>${esc(p.name || "No name")}</h2>
        <div class="kv"><span>Email</span><b>${esc(p.email || "—")} ${p.verified ? `<span class="chip c-active">confirmed</span>` : ""}</b></div>
        <div class="kv"><span>Language</span><b>${esc(p.language || "—")}</b></div>
        <div class="kv"><span>Last active</span><b>${ago(p.lastActive)}</b></div>
        <div class="kv"><span>Scams caught</span><b>${p.scams}</b></div>
        <h2 class="mt">Trusted people</h2>${
          p.family
            ? `<ul class="fam">${p.family
                .split("\n")
                .map(f => `<li>${esc(f)}</li>`)
                .join("")}</ul>`
            : `<p class="muted">None added.</p>`
        }
        <button class="btn" data-uid="${esc(p.uid)}">Open full profile</button>`
          : `<h2>${esc(caseNow.case.Name)}</h2><p class="muted">Not signed up. You can only answer here in the app.</p>`
      }
        ${caseNow.others.length ? `<h2 class="mt">Other cases</h2><ul class="feed">${caseNow.others.map(o => `<li><span class="fl"><a href="#case/${encodeURIComponent(o.id)}">${esc(o.reason)}</a><small>${when(o.opened)} · ${esc(CASE_STATUS[o.status] || o.status)}</small></span></li>`).join("")}</ul>` : ""}
      </aside>
    </div>
  </article>`;
  $("back").onclick = () => go("cases");
  bindOpen();
  drawCaseHead();
  drawThread();
  if (ro) return;
  const t = $("ctext");
  $("csend").onclick = () =>
    caseAct({ action: "reply", text: t.value, photo: casePhoto || undefined }, $("csend"), true);
  $("cnote").onclick = () => caseAct({ action: "case_note", text: t.value }, $("cnote"), true);
  t.onkeydown = e => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) $("csend").click();
  };
  $("cfile").onchange = async e => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      casePhoto = await shrink(f);
      drawCasePending();
    } catch (err) {
      toast("That photo couldn't be opened.");
    }
  };
  if (quick) drawQuickChips();
}
function drawCaseHead() {
  const c = caseNow.case;
  const ro = data.role === "viewer";
  const closed = c.Status === "closed";
  $("casehead").innerHTML = `<div><h1>${esc(c.Name)}</h1>
    <p>${esc(c.Reason)} ${caseChip(c)}</p>
    <p class="muted small">Case ${esc(c["Case ID"])} · opened ${when(c.Opened)}${c.Closed ? " · closed " + when(c.Closed) : ""}${c.Outcome ? " · " + esc(c.Outcome) : ""}</p></div>
    ${
      ro
        ? ""
        : `<div class="actions">
      ${closed ? `<button class="btn" data-st="open">Open again</button>` : `<button class="btn" data-st="waiting" ${c.Status === "waiting" ? "disabled" : ""}>Waiting for them</button><button class="btn" data-pr="${c.Priority === "urgent" ? "normal" : "urgent"}">${c.Priority === "urgent" ? "Not urgent" : "Mark urgent"}</button><button class="btn primary" id="closebtn">Close case</button>`}
    </div>
    <div id="closebox" class="card compose" hidden>
      <label for="outcome">What happened? (for your records)</label>
      <input id="outcome" placeholder="For example: bank stopped the payment, it was a real email, reported to the FTC">
      <div class="row"><button class="btn primary" id="closego">Close case</button><button class="btn" id="closeno">Cancel</button></div>
      <p class="muted small">${esc(c.Name)} sees "The ScamSense team closed this conversation" and can write again anytime.</p>
    </div>`
    }`;
  if (ro) return;
  main
    .querySelectorAll("[data-st]")
    .forEach(b => (b.onclick = () => caseAct({ action: "case_status", status: b.dataset.st }, b)));
  main
    .querySelectorAll("[data-pr]")
    .forEach(b => (b.onclick = () => caseAct({ action: "case_priority", priority: b.dataset.pr }, b)));
  if ($("closebtn"))
    $("closebtn").onclick = () => {
      $("closebox").hidden = false;
      $("outcome").focus();
    };
  if ($("closego")) {
    $("closego").onclick = () =>
      caseAct({ action: "case_status", status: "closed", outcome: $("outcome").value }, $("closego"));
    $("closeno").onclick = () => ($("closebox").hidden = true);
  }
}
function drawThread() {
  const th = $("thread");
  if (!th) return;
  const name1 = (caseNow.case.Name || "").split(" ")[0] || "Them";
  const time = m => `<small>${when(m.t)}</small>`;
  const photo = m =>
    m.photo
      ? `<img class="cimg" data-photo="${esc(m.photo)}" alt="Photo" ${casePhotos[m.photo] ? `src="${casePhotos[m.photo]}"` : ""}>`
      : "";
  th.innerHTML = caseNow.messages
    .map(m => {
      if (m.from === "system") return `<p class="tsys">${esc(m.text)} · ${when(m.t)}</p>`;
      if (m.from === "note")
        return `<div class="tnote"><b>Team note · ${esc(m.who)}</b><span>${esc(m.text)}</span>${time(m)}</div>`;
      if (m.from === "email" && m.email) {
        const e = m.email;
        return `<div class="temail"><b>📧 ${esc(name1)} shared an email</b>
          <div class="kv"><span>From</span><b>${esc(e.from)}</b></div>
          <div class="kv"><span>Subject</span><b>${esc(e.subject)}</b></div>
          ${e.date ? `<div class="kv"><span>Date</span><b>${esc(e.date)}</b></div>` : ""}
          ${e.verdict ? `<div class="kv"><span>ScamSense said</span><b>${esc({ scam: "Scam", warn: "Be careful", safe: "Safe" }[e.verdict] || e.verdict)}</b></div>` : ""}
          ${e.reasons && e.reasons.length ? `<ul>${e.reasons.map(r => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
          ${e.text ? `<details><summary>Read the email</summary><pre>${esc(e.text)}</pre></details>` : ""}
          ${time(m)}</div>`;
      }
      const mine = m.from === "owner";
      return `<div class="tmsg ${mine ? "mine" : ""}"><b>${mine ? "You" + (m.who ? " · " + esc(m.who) : "") : esc(name1)}</b>${m.text ? `<span>${esc(m.text)}</span>` : ""}${photo(m)}${time(m)}</div>`;
    })
    .join("");
  th.querySelectorAll("img[data-photo]").forEach(async img => {
    const id = img.dataset.photo;
    img.onclick = () => img.src && window.open(img.src, "_blank");
    if (casePhotos[id]) return;
    try {
      casePhotos[id] = (await api({ action: "case_photo", id })).data;
      img.src = casePhotos[id];
    } catch (e) {}
  });
  th.scrollTop = th.scrollHeight;
}
function drawQuickChips() {
  const box = $("quickchips");
  if (!box || !quick) return;
  box.innerHTML = quick
    .map((q, i) => `<button class="qchip" data-q="${i}" title="${esc(q.text)}">${esc(q.title)}</button>`)
    .join("");
  box.querySelectorAll("[data-q]").forEach(
    b =>
      (b.onclick = () => {
        const t = $("ctext");
        const q = quick[+b.dataset.q].text.replace(/\{name\}/g, (caseNow.case.Name || "").split(" ")[0]);
        t.value = t.value.trim() ? t.value.trim() + "\n\n" + q : q;
        t.focus();
      })
  );
}
function drawCasePending() {
  const box = $("cpending");
  box.hidden = !casePhoto;
  box.innerHTML = casePhoto
    ? `<div class="cpend"><img src="${casePhoto}" alt="Photo to send"><button class="linkbtn" id="cnophoto">Remove photo</button></div>`
    : "";
  if (casePhoto) $("cnophoto").onclick = () => ((casePhoto = ""), drawCasePending());
}
async function caseAct(body, btn, clear) {
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Working…";
  try {
    const j = await api(Object.assign({ caseId: caseNow.case["Case ID"] }, body));
    caseNow = j;
    toast(j.done || "Done");
    if (clear) {
      $("ctext").value = "";
      casePhoto = "";
      drawCasePending();
    }
    drawCaseHead();
    drawThread();
  } catch (e) {
    toast(e.message);
  }
  btn.disabled = false;
  btn.textContent = old;
}
function shrink(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rej(new Error("bad image"));
    };
    img.src = url;
  });
}

/* Every 30 seconds: any new case or message? Then a badge, a pop-up, and the page title say so. */
let caseSeen = null;
async function watchCases() {
  if (!data || document.hidden) return;
  try {
    const j = await api({ action: "cases" });
    setCaseBadge(j.counts);
    const fresh = j.cases.filter(c => c.Status !== "closed" && +c["Team unread"] > 0);
    const key = c => c["Case ID"] + ":" + c["Last update"];
    if (caseSeen) {
      const news = fresh.filter(c => !caseSeen.has(key(c)));
      news.forEach(c => {
        toast(`${c.Priority === "urgent" ? "🚨 " : ""}${c.Name}: ${c["Last message"] || c.Reason}`);
        try {
          if ("Notification" in window && Notification.permission === "granted" && !swReg) {
            const n = new Notification((c.Priority === "urgent" ? "URGENT · " : "") + c.Name, {
              body: c["Last message"] || c.Reason,
              tag: c["Case ID"]
            });
            n.onclick = () => {
              focus();
              go("case/" + c["Case ID"]);
            };
          }
        } catch (e) {}
      });
    }
    caseSeen = new Set(fresh.map(key));
    cases = j.cases;
    if (location.hash === "#cases" && main.querySelector("[data-f]")) drawCases();
  } catch (e) {}
}
setInterval(watchCases, 30000);

/* ----- Phone alerts (push notifications to this device) ----- */
const PUSH_OK = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const IS_IOS =
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const STANDALONE = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
let swReg = null;
if (PUSH_OK && !DEMO)
  navigator.serviceWorker
    .register("owner-sw.js", { scope: "./owner.html" })
    .then(r => (swReg = r))
    .catch(() => {});
if ("serviceWorker" in navigator)
  navigator.serviceWorker.addEventListener("message", e => e.data && e.data.go && go(e.data.go));

const keyBytes = b64 => {
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4));
  return Uint8Array.from(s, c => c.charCodeAt(0));
};
async function pushSub() {
  if (!PUSH_OK || DEMO) return null;
  try {
    const reg = swReg || (await navigator.serviceWorker.ready);
    return await reg.pushManager.getSubscription();
  } catch (e) {
    return null;
  }
}
async function pushBox(box) {
  if (!box) return;
  if (DEMO) {
    box.innerHTML = `<p class="muted small">Phone alerts work on the real Owner app (not in the sample).</p>`;
    return;
  }
  if (!PUSH_OK) {
    box.innerHTML =
      IS_IOS && !STANDALONE
        ? `<div class="card warn"><b>Get alerts on this iPhone</b><p>In Safari, tap <b>Share</b> → <b>Add to Home Screen</b>. Then open <b>SS Owner</b> from your home screen and tap <b>Turn on phone alerts</b> here.</p></div>`
        : `<p class="muted small">This browser can't show phone alerts. Try Chrome, or Safari on iPhone from the home screen.</p>`;
    return;
  }
  const sub = await pushSub();
  if (!box.isConnected) return; // the page was redrawn meanwhile
  const on = sub && Notification.permission === "granted";
  box.innerHTML = on
    ? `<div class="pushon"><span>🔔 <b>Phone alerts are on</b> for this device. New cases and messages show up as a notification.</span><span class="row"><button class="btn" id="pushtest">Send a test alert</button><button class="btn" id="pushoff">Turn off</button></span></div>`
    : `<div class="card pushask"><b>Get a notification for every new case</b><p class="muted small">Like a text: it shows on your phone's lock screen. Tap it to open the case and answer.</p><button class="btn primary" id="pushon">Turn on phone alerts</button></div>`;
  if (on) {
    box.querySelector("#pushtest").onclick = async () => {
      try {
        toast((await api({ action: "push_test" })).done);
      } catch (e) {
        toast(e.message);
      }
    };
    box.querySelector("#pushoff").onclick = async () => {
      try {
        await api({ action: "push_off", endpoint: sub.endpoint });
        await sub.unsubscribe();
        toast("Phone alerts are off for this device.");
      } catch (e) {
        toast(e.message);
      }
      pushBox(box);
    };
  } else
    box.querySelector("#pushon").onclick = async () => {
      const b = box.querySelector("#pushon");
      b.disabled = true;
      b.textContent = "Turning on…";
      try {
        const perm = await Notification.requestPermission();
        if (perm !== "granted")
          throw new Error(
            "Notifications weren't allowed. Turn them on in your phone's Settings for SS Owner."
          );
        const reg = swReg || (await navigator.serviceWorker.ready);
        const key = (await api({ action: "push_key" })).key;
        const s = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(key)
        });
        const j = await api({
          action: "push_save",
          sub: s.toJSON(),
          label:
            (IS_IOS ? "iPhone" : /Android/.test(navigator.userAgent) ? "Android" : "Computer") +
            " · " +
            new Date().toLocaleDateString()
        });
        await (
          await caches.open("ss-owner")
        ).put(
          "device",
          new Response(JSON.stringify({ server: SERVER_URL, device: j.device }), {
            headers: { "Content-Type": "application/json" }
          })
        );
        toast(j.done);
      } catch (e) {
        toast(e.message || "Couldn't turn on alerts.");
      }
      pushBox(box);
    };
}

/* ----- sample data (owner.html?demo) ----- */
const DEMO_PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" rx="16" fill="#eceef3"/><rect x="20" y="20" width="260" height="60" rx="12" fill="#fff"/><text x="34" y="46" font-family="sans-serif" font-size="14" fill="#111">USPS: Your package is on hold.</text><text x="34" y="66" font-family="sans-serif" font-size="12" fill="#b42318">usps-redeliver-help.top</text><text x="20" y="120" font-family="sans-serif" font-size="12" fill="#5f6673">(sample screenshot)</text></svg>'
  );
function demoCases(d) {
  if (demoCases.db) return demoCases.db;
  const list = [
    {
      "Case ID": "C261121-A1B2",
      Opened: d(0, 25),
      "User ID": "demoA0000000000001",
      uid: "demoA0000000000001",
      Name: "Maria Sample",
      Email: "maria.sample@example.com",
      Reason: "Said they were scammed",
      Priority: "urgent",
      Status: "new",
      "Last update": d(0, 4),
      "Last message": "They told me to buy gift cards. I already bought $300.",
      "Team unread": 3,
      "Person unread": 0
    },
    {
      "Case ID": "C261120-C3D4",
      Opened: d(20),
      "User ID": "demoB0000000000002",
      uid: "demoB0000000000002",
      Name: "George Example",
      Email: "george@example.com",
      Reason: "Shared an email for help",
      Priority: "normal",
      Status: "open",
      "Last update": d(3),
      "Last message": "Is this email from my bank real?",
      "Team unread": 1,
      "Person unread": 0
    },
    {
      "Case ID": "C261115-E5F6",
      Opened: d(140),
      "User ID": "demoD0000000000004",
      uid: "demoD0000000000004",
      Name: "Sam Placeholder",
      Email: "sam@example.com",
      Reason: "Asked to talk to a person",
      Priority: "normal",
      Status: "closed",
      "Last update": d(130),
      "Last message": "Team: Glad we could help!",
      "Team unread": 0,
      "Person unread": 0,
      Closed: d(130),
      Outcome: "It was a real text from his pharmacy"
    }
  ];
  const msgs = {
    "C261121-A1B2": [
      { t: d(0, 25), from: "system", text: "Said they were scammed (ScamSense opened this case by itself)" },
      {
        t: d(0, 22),
        from: "user",
        text: "Someone called saying they were from Amazon and my account was hacked."
      },
      { t: d(0, 10), from: "user", text: "Here is the text they sent me after.", photo: "demo-photo" },
      { t: d(0, 4), from: "user", text: "They told me to buy gift cards. I already bought $300." }
    ],
    "C261120-C3D4": [
      { t: d(20), from: "system", text: "Shared an email for help" },
      {
        t: d(20),
        from: "email",
        email: {
          from: "Chase Fraud Dept <alerts@chase-secure-verify.com>",
          subject: "Unusual sign-in: verify your account within 24 hours",
          date: "Nov 20, 9:12 AM",
          verdict: "scam",
          reasons: [
            'Says it\'s from Chase, but it was sent from "chase-secure-verify.com", which is not Chase.',
            "Uses pressure to rush you."
          ],
          text: "Dear customer,\n\nWe noticed an unusual sign-in to your account. Verify your identity within 24 hours or your account will be locked.\n\nVerify now: https://chase-secure-verify.com/login"
        }
      },
      { t: d(3), from: "user", text: "Is this email from my bank real?" }
    ],
    "C261115-E5F6": [
      { t: d(140), from: "system", text: "Asked to talk to a person" },
      { t: d(140), from: "user", text: "Is a text from CVS about my prescription real?" },
      {
        t: d(135),
        from: "note",
        who: "owner@example.com",
        text: "Checked the number: it's CVS's real short code."
      },
      { t: d(134), from: "owner", text: "Good news: I checked it and it's real, not a scam." },
      { t: d(130), from: "owner", text: "Glad we could help!" },
      {
        t: d(130),
        from: "system",
        text: "The ScamSense team closed this conversation. If you need anything else, just write here."
      }
    ]
  };
  const quick = [
    {
      title: "Hello",
      text: "Hi, this is the ScamSense team. I'm here to help. Can you tell me what happened, in your own words?"
    },
    {
      title: "Don't pay, don't reply",
      text: "Please don't pay anything, don't click any links, and don't reply to them."
    },
    {
      title: "Gift cards",
      text: "If you paid with gift cards, call the number on the back of each card right away and tell them it was a scam. Keep the cards and the receipts."
    },
    {
      title: "Send a screenshot",
      text: "Can you send me a screenshot or a photo of the message? Tap the photo button next to the message box."
    }
  ];
  return (demoCases.db = { list, msgs, quick });
}
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
          sheetUrl: "#",
          support: { open: 2, unread: 2, urgent: 1 }
        });
      if (body.action === "person") return res(person(body.uid));
      const cs = demoCases(d);
      const counts = () => {
        const o = cs.list.filter(c => c.Status !== "closed");
        return {
          open: o.length,
          unread: o.filter(c => +c["Team unread"]).length,
          urgent: o.filter(c => c.Priority === "urgent").length
        };
      };
      if (body.action === "cases") return res({ ok: true, cases: cs.list, counts: counts() });
      if (body.action === "quick_list") return res({ ok: true, quick: cs.quick });
      if (body.action === "quick_save") {
        cs.quick = body.quick.filter(q => q.title && q.text);
        return res({ ok: true, quick: cs.quick, done: "Saved quick replies" });
      }
      if (body.action === "case_photo") return res({ ok: true, data: DEMO_PHOTO });
      const c = cs.list.find(x => x["Case ID"] === body.caseId);
      const view = () => ({
        ok: true,
        case: c,
        messages: cs.msgs[c["Case ID"]],
        person: c.uid
          ? {
              uid: c.uid,
              name: c.Name,
              email: c.Email,
              verified: true,
              family: "Ana Sample | ana@example.com | 555-0101",
              language: "en",
              lastActive: d(0, 20),
              scams: 7
            }
          : null,
        others: []
      });
      if (c) {
        const now = new Date().toISOString();
        const add = (from, text, photo) => {
          cs.msgs[c["Case ID"]].push({ t: now, from, who: "owner@example.com", text, photo });
          c["Last update"] = now;
          if (from !== "note") c["Last message"] = text;
        };
        if (body.action === "case") return res(((c["Team unread"] = 0), view()));
        if (body.action === "reply") {
          if (!String(body.text || "").trim() && !body.photo)
            return res({ ok: false, error: "Write a message first." });
          if (c.Status === "new") c.Status = "open";
          add("owner", body.text, body.photo ? "demo-photo" : "");
          return res(Object.assign(view(), { done: "Sent (sample: nobody gets it)" }));
        }
        if (body.action === "case_note") {
          if (!String(body.text || "").trim()) return res({ ok: false, error: "Write the note first." });
          add("note", body.text);
          return res(Object.assign(view(), { done: "Note saved" }));
        }
        if (body.action === "case_status") {
          c.Status = body.status;
          if (body.status === "closed") {
            c.Closed = now;
            c.Outcome = body.outcome || "";
            add("note", "Closed the case" + (c.Outcome ? ": " + c.Outcome : ""));
            add(
              "system",
              "The ScamSense team closed this conversation. If you need anything else, just write here."
            );
          } else
            add(
              "note",
              body.status === "waiting" ? "Waiting for the person to answer" : "Opened the case again"
            );
          return res(Object.assign(view(), { done: "Case " + body.status }));
        }
        if (body.action === "case_priority") {
          c.Priority = body.priority;
          add("note", "Marked " + body.priority);
          return res(Object.assign(view(), { done: "Marked " + body.priority }));
        }
      }
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
  // A link to a case (from the "New case" email) is remembered through the sign-in.
  if (/^#case\//.test(location.hash))
    try {
      sessionStorage.setItem("own_hash", location.hash);
    } catch (e) {}
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

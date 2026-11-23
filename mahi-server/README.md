# Mahi Server

Lets Mahi (the AI helper in ScamSense) answer any question, with your AI key hidden
on Google's servers instead of inside the app. Free (Google Apps Script).

## Set up (about 5 minutes)

1. Go to https://script.google.com → **New project** → name it **Mahi Server**.
2. Paste everything from `Code.gs` in this folder. **Save**.
3. **Project Settings** (gear) → **Script Properties** → **Add script property**:
   `ANTHROPIC_API_KEY` = your sk-ant- key → **Save**.
4. **Deploy** → **New deployment** → gear next to "Select type" → **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   → **Deploy** → **Authorize access** (Advanced → Go to Mahi Server → Allow).
5. Copy the **Web app URL** (ends in `/exec`).
6. In ScamSense: **Settings → Advanced → Mahi server**, paste the URL. (Or send it to Claude to build it in.)

Test: open the Web app URL in a browser. It should show `{"ok":true,"name":"Mahi",...}`.

## Live help (Cases)

People can write to the ScamSense team from the app (Settings → Talk to the ScamSense team, Ask Mahi →
Talk to a person, "I was scammed", or "Send to the ScamSense team" on an email). You answer in the
Owner page → **Cases**.

After pasting a new version of `Code.gs` that has this:
1. Pick **setupSupport** in the function menu → **Run** → allow Google Drive (it makes a private
   "ScamSense Support Photos" folder and the Cases, Messages, and Quick replies tabs).
2. Deploy a new version (below).

Alerts to you: open the Owner page (on iPhone, the **SS Owner** home-screen app) → **Cases** →
**Turn on phone alerts**. Every new case and message then shows up as a notification on that phone;
tap it to open the case. The first time, the server makes its own push keys (Script Properties
`VAPID_PUBLIC` and `VAPID_PRIVATE`, and a **Phone alerts** tab). Only while no phone has alerts on,
you get an email instead (at most one every 10 minutes per case).

## Safety

- The key never reaches the app or the browser.
- Mahi answers at most 300 times a day in total (change `MAX_PER_DAY`), so your bill stays small.
  Also keep a monthly spend limit in the Claude Console.
- After editing the code: **Deploy → Manage deployments → Edit → Version: New version → Deploy** (the URL stays the same).

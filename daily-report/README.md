# ScamSense Daily Email Report

Sends you a ScamSense safety report by email every morning, and blocks scam emails automatically.
It runs inside your own Google account with Google Apps Script. No server, no cost.

## Set it up (about 5 minutes, one time)

1. Go to https://script.google.com and click **New project**. Rename it **ScamSense Daily Report**.
2. Delete the sample code. Copy everything in `Code.gs` (this folder) and paste it in. Click **Save** (disk icon).
3. Click **Project Settings** (gear). Check that the time zone is your time zone.
   Optional, for AI explanations: under **Script Properties** add `ANTHROPIC_API_KEY` with your sk-ant- key.
4. Go back to **Editor**. In the function menu at the top choose **setup**, then click **Run**.
5. Google asks for permission: **Review permissions** → pick your Gmail → **Advanced** →
   **Go to ScamSense Daily Report (unsafe)** → **Allow**. ("Unsafe" only means Google hasn't reviewed your own script.)
6. Check your inbox. The first report arrives in about a minute, then every day at 8 AM.

## Automatic blocking

Every 15 minutes the script checks new emails. A clear scam is moved to **Spam**, labeled
**ScamSense/Blocked**, and you get one short email: what was blocked and why.
To keep real mail safe it never blocks a verified company sender or anyone you've emailed before.
Suspicious (not clear) emails are not blocked; they show up in the daily report.
If a real email gets blocked, open Spam in Gmail and tap **Not spam**.

## Change or stop

- Different time: change `HOUR: 8` at the top of the code, save, and run **setup** again.
- Test anytime: run **sendReportNow**.
- Stop the daily report: run **stopDailyReport**.
- Stop blocking (keep the report): run **stopBlocking**. Or set `BLOCK_SCAMS: false` and run **setup** again.
- Remove access completely: myaccount.google.com/permissions → ScamSense Daily Report → Remove access.

## Privacy

The script reads your email only to check it, and only sends one email: the report, to you.
Nothing is stored or sent anywhere else. If you add an AI key, only the risky emails are sent to
Anthropic's AI for a plain-language explanation.

The detection rules at the bottom of `Code.gs` are copied from the app (`index.html`).

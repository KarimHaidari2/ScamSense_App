# ScamSense: All Links in One Place

Everything you need, on one page. Passwords and keys are **not** here. They stay in your private cheat sheet.

## The app

| What | Link |
|---|---|
| ScamSense app (live) | https://karimhaidari2.github.io/ScamSense_App/ |
| GitHub project | https://github.com/KarimHaidari2/ScamSense_App |
| Privacy Policy | https://karimhaidari2.github.io/ScamSense_App/privacy.html |
| Terms of Use | https://karimhaidari2.github.io/ScamSense_App/terms.html |

## The two Google scripts

Open the **Copy the code** link, select all, copy, and paste it into that script on script.google.com.

| Script | Copy the code | See on GitHub |
|---|---|---|
| **ScamSense Daily Report** (morning report + Gmail blocking) | [Copy the code](https://raw.githubusercontent.com/KarimHaidari2/ScamSense_App/main/daily-report/Code.gs) | [daily-report/](https://github.com/KarimHaidari2/ScamSense_App/tree/main/daily-report) |
| **Mahi Server** (lets Mahi answer and search the web) | [Copy the code](https://raw.githubusercontent.com/KarimHaidari2/ScamSense_App/main/mahi-server/Code.gs) | [mahi-server/](https://github.com/KarimHaidari2/ScamSense_App/tree/main/mahi-server) |

Where to paste the code: https://script.google.com (open the script with the matching name).

## Daily Report: what to run

Pick the function from the menu at the top of the script editor and click **Run**.

| Run this | What it does |
|---|---|
| `setup` | Turns on the 8 AM report and blocking every 15 minutes |
| `sendReportNow` | Sends a report right now (for testing) |
| `connectOutlook` | Adds Outlook to the report (follow the steps in the log) |
| `finishOutlook` | Use this only if `connectOutlook` stopped waiting before you were done |
| `showAppLink` | Shows the link to paste into the app: Settings → Advanced → Daily report link |
| `stopDailyReport` / `stopBlocking` | Turns the report or the blocking off |

## Accounts and consoles

| What | Link |
|---|---|
| Google Apps Script (both scripts) | https://script.google.com |
| Google Cloud project (Gmail sign-in) | https://console.cloud.google.com |
| Claude Console (AI key, spending limit) | https://console.anthropic.com |
| Azure portal (Outlook app "scamsense") | https://portal.azure.com |
| Azure app registrations | https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps |
| Microsoft sign-in code page | https://microsoft.com/devicelogin |
| Remove Outlook access | https://account.live.com/consent/Manage |
| Remove Google access | https://myaccount.google.com/permissions |

## Public IDs (safe to share)

| What | Value |
|---|---|
| Microsoft app (client) ID | `1187ff8b-fa16-43d4-acb6-788bb696c627` |
| Mahi server link | https://script.google.com/macros/s/AKfycbwXjtRfbMG2_8y8R9Wje6ddxmZDuPMnsDsFfHlqjw5n_v1-_ey2I4B3URS8cw04QpYn/exec |

## Guides

| Guide | Link |
|---|---|
| Outlook setup (Azure) | [docs/outlook-setup.md](docs/outlook-setup.md) |
| How the app is built (file map) | [README.md](README.md) |

## Never put these on GitHub

- The AI key (it lives only in each script's **Project Settings → Script Properties** as `ANTHROPIC_API_KEY`)
- Any password
- The daily report link with `?key=` at the end

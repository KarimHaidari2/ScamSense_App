# ScamSense

A scam checker for email, texts, calls, and crypto, made for older adults and everyone.
Live: https://karimhaidari2.github.io/ScamSense_App/

**All links in one place (scripts, consoles, setup): [LINKS.md](LINKS.md)**

## Where things are

| Folder / file | What it is |
|---|---|
| `index.html` | The page: header, tab bar, and the list of code files to load |
| `css/app.css` | All the styles (colors at the top, then one section per part) |
| `js/` | The app code, one file per part, loaded in number order (below) |
| `i18n/` | Translations. `en.json` is made from the code; other files match its ids |
| `vendor/` | Outside tools kept in the repo: jsPDF (PDFs), throwaway-email list |
| `daily-report/` | Google Apps Script: one daily safety report (Gmail + Outlook + what was checked in the app) + automatic Gmail scam blocking |
| `mahi-server/` | Google Apps Script web app: lets Mahi answer any question with the AI key hidden |

## The `js/` files

| File | Part of the app |
|---|---|
| 01-storage.js | Saves settings on this device; loads translations |
| 02-scam-rules.js | Warning-sign rules and `analyze()`, which scores a message |
| 03-ai-check.js | Optional second opinion from Anthropic's AI |
| 04-gmail.js | Gmail sign-in (read-only) and reading messages |
| 05-scanning.js | A full scan and the daily report it saves |
| 06-words.js | English and Spanish words on screen |
| 07-demo-data.js | The made-up demo inbox |
| 08-ui-basics.js | Shared screen helpers and read aloud |
| 09-today.js | Home screen (email card) and the Your emails screen |
| 10-iphone-preview.js | Simulation of the future iPhone app |
| 11-help-pause-scammed.js | Pause before you pay, I was scammed |
| 12-evidence-example.js | Screenshots, example case, where to report |
| 13-pdf-documents.js | Case file and one document per office |
| 14-icons.js | Icons and small page helpers |
| 15-sender-lookup.js | Who is behind an email address or phone number |
| 16-check-hub.js | Check something: one box that works out what you pasted or said |
| 17-family.js | Family and trusted people |
| 18-settings.js | Settings (AI key and scan options under Advanced) |
| 19-lessons.js | Short lessons with a quiz |
| 20-monthly-report.js | Monthly report |
| 21-ask-agent.js | Ask Mahi, the AI helper chat |
| 22-crypto.js | Website and wallet checks used by Check something |
| 23-plans.js | Plans and prices |
| 24-app-lock.js | PIN lock |
| 25-welcome.js | First-run welcome |
| 26-today-shortcuts.js | The three big buttons on Home |
| 27-navigation-and-start.js | Moving between screens, Ask Mahi button, start-up |
| 28-outlook.js | Outlook / Hotmail / Microsoft 365 email (read-only, Microsoft sign-in). Setup: docs/outlook-setup.md |
| 29-send-to-scamsense.js | Send a text to ScamSense: ?check= links, Android Share, iPhone Shortcut steps |
| 30-report-sync.js | Daily report link: sends check/pause results (never the message) to the daily report script |
| 32-account.js | Your account on the ScamSense server: name, confirmed email, daily report, danger alerts, Mahi "email me" |
| 31-email-actions.js | Move to Spam and Block sender for Gmail and Outlook, plus the blocked senders list |

Run it on your Mac: `python3 -m http.server 8000`, then open http://localhost:8000

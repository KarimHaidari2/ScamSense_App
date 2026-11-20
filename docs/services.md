# Services ScamSense uses

Every outside service ScamSense depends on: what it does, why we chose it, what it costs, and where its key is kept. No keys or passwords are in this file. The same table is in the **Services** tab of the Owner Dashboard (run `writeServicesTab` in the ScamSense Server to refresh it).

## How a phone check works

1. The person types their number in **My info → Phone**.
2. **Twilio Verify** texts them a 6-digit code, so only the owner of the number can continue.
3. After the code, **Trestle** looks up what data companies sell about that number (name, age range, address, phone company).
4. ScamSense shows a name and address **only if it matches the person's own last name**, so a past owner of the number (a stranger) is never shown.
5. Nothing is saved on the server, only a count for the limits.

## All services

| Service | What it does in ScamSense | Why we chose it | Cost | Account | Where the key lives | Limits we set | Link |
|---|---|---|---|---|---|---|---|
| Anthropic Claude (AI) | Mahi's answers and the smart scam check for emails, texts, calls, and links | Strong at judging scams in plain language; API data isn't used to train its models | Pay per use; set a monthly spending limit in Claude Console | Claude Console | Script Properties: ANTHROPIC_API_KEY | 300 answers a day for everyone | https://console.anthropic.com |
| Google Apps Script + Sheets | Runs this server (Mahi, accounts, reports, alerts) and keeps this dashboard | Free, no servers to manage, keeps keys off the phone | Free | Owner Google account | - | - | https://script.google.com |
| GitHub Pages | Hosts the ScamSense app itself | Free, fast, and the code is public and easy to review | Free | KarimHaidari2 on GitHub | - | - | https://github.com/KarimHaidari2/ScamSense_App |
| Google Cloud (Gmail sign-in) | Lets people connect Gmail so ScamSense can scan it, move scams to Spam, and block senders | The official, safe way to read Gmail with the person's permission | Free | Google Cloud project | Public client ID in the app | Testing mode: approved test users only (100 max) | https://console.cloud.google.com |
| Microsoft Azure (Outlook sign-in) | Lets people connect Outlook and Hotmail the same way | The official Microsoft sign-in; no password ever reaches ScamSense | Free | Azure app 'scamsense' | Public client ID in the app | - | https://portal.azure.com |
| XposedOrNot | Email leak check: was this email in a known data breach, what leaked, and when | Free, no key needed, public breach lists | Free (low use) | None | - | 10 checks per device per day; results cached 1 day | https://xposedornot.com |
| Have I Been Pwned (optional) | Same leak check, used instead of XposedOrNot if a key is added | The best-known breach database, made for apps | About $4-5/month | Not set up yet | Script Properties: HIBP_API_KEY | - | https://haveibeenpwned.com/API/Key |
| Twilio Verify (TEXT) | Texts a 6-digit code to the phone number first, so people can only look up THEIR OWN number | Reliable, used by big companies for login codes; handles phone-company rules (no 10DLC registration needed) | About $0.06 per code; $20 prepaid, auto-recharge OFF | scamsense.karim@outlook.com | Script Properties: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SID | 5 sent codes per device per day; Fraud Guard on | https://console.twilio.com |
| Trestle Reverse Phone API (PHONE LOOKUP) | After the code: shows the name, age range, home address, and phone company that data companies sell about the number | Real identity data (built by the former Whitepages Pro team); simple pay-per-use pricing | $0.07 per lookup; 14-day trial | kah3271@utulsa.edu | Script Properties: TRESTLE_API_KEY | 3 lookups per device per month; only shows names matching the user's last name (hides past owners) | https://trestleiq.com |
| RDAP (domain records) | Checks how old a sender's website is; brand-new websites are a strong scam sign | Free official internet registry data | Free | None | - | Results cached | https://about.rdap.org |
| Optery (planned) | Automatic removal from 600+ data broker sites with one tap | Sells this as an API to other apps; would replace the manual site list | Ask for a quote | Not set up yet | - | - | https://www.optery.com/api |

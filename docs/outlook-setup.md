# Turn on Outlook in ScamSense (one time, about 10 minutes)

ScamSense reads Outlook.com, Hotmail, Live, and Microsoft 365 email with **read-only** access through
Microsoft's own sign-in page. To allow that, Microsoft needs a free "app registration" that says
which website is allowed to ask. You only do this once.

## 1. Create the app

1. Go to **https://entra.microsoft.com** and sign in with your Microsoft account
   (a free Outlook.com account works).
2. Open **Applications → App registrations → New registration**.
3. Fill in:
   - **Name:** `ScamSense`
   - **Supported account types:** *Accounts in any organizational directory and personal Microsoft accounts*
   - **Redirect URI:** choose **Single-page application (SPA)** and enter
     `https://karimhaidari2.github.io/ScamSense_App/` (with the slash at the end)
4. Click **Register**.

## 2. Allow reading mail

1. In the new app, open **API permissions → Add a permission → Microsoft Graph → Delegated permissions**.
2. Tick **Mail.Read**, **User.Read**, **offline_access**, and **openid**. Click **Add permissions**.
   (No admin consent is needed for personal accounts.)

## 3. Put the ID into ScamSense

1. On the app's **Overview** page, copy the **Application (client) ID**. It looks like
   `1a2b3c4d-....`. It is not a secret.
2. In ScamSense: **Settings → Advanced → Microsoft app ID (for Outlook)**, paste it.
   The Outlook row in Settings now shows **Connect**.
3. To turn it on for everyone, send the ID to Claude to put in `DEFAULT_MS_CLIENT_ID` in `js/28-outlook.js`.

## Notes

- Never create or share a **client secret** for this app. A website must not have one.
- People can remove ScamSense's access any time at https://account.live.com/consent/Manage
  (personal accounts) or https://myapps.microsoft.com (work accounts).
- Work or school accounts may need their IT admin to approve the app.

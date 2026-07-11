# OPTOCARE
A patient navigation and appointment management web application.

## SMS notifications (Arkesel)

Bookings and cancellations trigger real SMS via Arkesel through a Netlify Function
(`netlify/functions/notify-booking.js`). Set these in the Netlify dashboard under
Site settings → Environment variables (never commit real values — see `.env.example`):

- `ARKESEL_API_KEY` — from your Arkesel account's SMS API settings.
- `ARKESEL_SENDER_ID` — defaults to `OPTOCARE` for testing; replace once a registered
  sender ID is approved.
- `STAFF_PHONE_NUMBER` — one number, or a comma-separated list, to notify on every
  booking/cancellation.

**Sender ID approval:** Arkesel accepts sends with an unregistered/unapproved sender ID
(the API call succeeds), but the actual text can sit at `PENDING APPROVAL` and never
reach the handset until that sender ID is approved. Register a sender ID in the Arkesel
dashboard (Settings → Sender IDs) as soon as possible — testing before approval may
show "sent" but not actually deliver.

## SMS on/off switch (clinic admin)

There is a live kill-switch so the clinic can pause all patient/staff texts (e.g. before
launch, to stop abuse) without a redeploy. The state lives in Netlify Blobs (store
`optocare-settings`, key `sms-enabled`) and is enforced server-side in
`notify-booking.js`, so pausing genuinely stops sends — it is not just a UI change.

- **To reach it:** open the portal and sign in with the admin email (`ADMIN_EMAIL`) and
  its password. Instead of a patient record you get the SMS console with a single on/off
  switch. Changes take effect immediately.
- **When paused:** bookings still succeed and appear on the clinic schedule; the patient
  simply sees a clear "text confirmations are paused by the clinic" note instead of an SMS.
- **Auth:** the admin password is checked server-side in `netlify/functions/sms-control.js`
  against env vars — it is never present in the browser code.

Set these in the Netlify dashboard (never commit real values):

- `ADMIN_EMAIL` — the clinic admin's sign-in email.
- `ADMIN_PASSWORD` — the clinic admin's password.

Run the function unit tests locally with:

```bash
npm test        # runs node --test over tests/*.test.js
```

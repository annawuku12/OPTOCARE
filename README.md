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

Run the function's unit tests locally with:

```bash
node --test tests/notify-booking.test.js
```

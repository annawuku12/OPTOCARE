# Arkesel SMS Integration — Design

## Context

OPTOCARE currently has two static, client-side-only booking prototypes:

- `ucc-hospital-portal.html` (root, single-file)
- `Entrepreneurship/hospital.html.html` + `hospitalscript.js` + `hospitalstyles.css` (separated-files version)

Both simulate SMS today: `autoSMS(type, appt)` builds a message from a local `SMS` template object and pushes it into an in-memory `smsLogs` array rendered as a fake "SMS log" in the UI. No real text message is ever sent, and no backend exists in this repo at all.

The frontend is deployed on Netlify via a GitHub-connected repo (auto-deploys on push). The user has an Arkesel account (Ghana SMS gateway) with an API key ready to use, and wants real SMS sent whenever a booking is made or cancelled, to both the patient and the optometry department/staff.

## Goal

When `autoSMS('confirmation' | 'cancelled', appt)` runs in either prototype, also send a real SMS via Arkesel to the patient's phone and to a staff/department phone number — without changing the existing (already working) local SMS-log UI/UX, and without blocking or breaking the booking flow if the SMS send fails.

## Architecture

A single Netlify Function, `netlify/functions/notify-booking.js`, is added to the repo. It is the only place the Arkesel API key is used — the key lives in Netlify's environment variables and is never sent to the browser or committed to git.

Both HTML prototypes' `autoSMS()` gains a fire-and-forget `fetch('/.netlify/functions/notify-booking', ...)` call alongside its existing local-log behavior. The call is async and its result/failure is not awaited by the booking flow — the modal, toast, and SMS-log UI behave exactly as they do today regardless of whether the real SMS succeeds.

```
Book/Cancel button
  → autoSMS(type, appt)          [unchanged: local smsLogs push + renderSMSLog()]
      → fetch(/.netlify/functions/notify-booking, {type, patientPhone, patientMessage, appt})
          → notify-booking.js
              → Arkesel: send patientMessage to patientPhone
              → Arkesel: send a staff-facing summary to STAFF_PHONE_NUMBER
```

## Components

### `netlify/functions/notify-booking.js`

Plain Node, **zero npm dependencies** (uses Node's built-in global `fetch`, available on Netlify's Node 18 runtime).

- Accepts `POST` with JSON body:
  ```json
  {
    "type": "confirmation" | "cancelled",
    "patientPhone": "+233 24 123 4567",
    "patientMessage": "UCC Hospital: Your appointment is confirmed...",
    "appt": { "ref": "UCC-ABC123", "name": "...", "dept": "...", "doctor": "...", "dateFormatted": "...", "time": "..." }
  }
  ```
- Normalizes `patientPhone` to Arkesel's expected `233XXXXXXXXX` format (strips `+`, spaces, and a leading `0` after the country code).
- Sends the patient SMS using Arkesel's plain-text GET API (`https://sms.arkesel.com/sms/api?action=send-sms&api_key=...&to=...&from=...&sms=...`) with `patientMessage` verbatim (reuses the exact template text the frontend already generates — single source of truth for patient-facing copy).
- Builds a short staff-facing message server-side from `type` + `appt` fields, e.g.:
  - confirmation: `New booking: {name} with {doctor} ({dept}) on {dateFormatted} at {time}. Ref: {ref}.`
  - cancelled: `Booking cancelled: {name} with {doctor} on {dateFormatted} at {time}. Ref: {ref}.`
- Sends that to `STAFF_PHONE_NUMBER` (env var; supports a comma-separated list — sends to each).
- Returns `200 { patientSmsSent: bool, staffSmsSent: bool }` on completion (both attempts happen even if one fails; failures are logged via `console.error` for Netlify function logs, not surfaced to the client).
- Never throws in a way that would matter to the caller — the frontend ignores the response body.

### `netlify.toml`

```toml
[build]
  publish = "."

[functions]
  directory = "netlify/functions"

[build.environment]
  NODE_VERSION = "18"
```

### `.env.example` (committed, documents required vars — no real values)

```
ARKESEL_API_KEY=
ARKESEL_SENDER_ID=OPTOCARE
STAFF_PHONE_NUMBER=
```

Real values are set in the Netlify dashboard under Site settings → Environment variables. `ARKESEL_SENDER_ID` defaults to `OPTOCARE` (8 chars, fits Arkesel's 11-char limit) as a test sender ID per the user's confirmation; swap once a registered sender ID is approved.

### Frontend changes

In both `ucc-hospital-portal.html` (inline `<script>`) and `Entrepreneurship/hospitalscript.js`, `autoSMS(type, appt)` changes from:

```js
function autoSMS(type, appt) {
  const msg = SMS[type](appt);
  smsLogs.unshift({ to: appt.phone, patient: appt.name, message: msg, sentAt: formatDateTime(), type, ref: appt.ref });
  renderSMSLog();
}
```

to the same body plus a fire-and-forget POST to the function, guarded with `.catch()` so a network failure (e.g. testing before the function is deployed) never throws into the booking flow.

## Error handling

- SMS sending is entirely decoupled from the booking UX. The booking always "succeeds" from the user's point of view exactly as it does today (this is a client-only prototype with no real persistence either way).
- If Arkesel rejects a request (bad number, insufficient balance, unapproved sender ID) or the function errors, this is visible only in Netlify's function logs — not in the UI. This is acceptable for the current prototype stage; revisit if/when this becomes a real booking system with reliability requirements.

## Testing

No local Netlify Functions runtime is set up (out of scope — "quick and simple"). Verification path:
1. Push to the connected GitHub repo → Netlify auto-deploys.
2. Run a manual `curl` against the live function endpoint with a real phone number to confirm an actual SMS arrives (exact command provided at implementation time).
3. Click through a real booking and cancellation on the deployed site and confirm both the patient and staff numbers receive texts.

## Out of scope (flagged for follow-up)

The codev separately requested two additional features tied to the *other* engineer's live Optometry API (`optometryapi-production.up.railway.app`), which requires its own auth/session handling and error-handling design:

1. Patient info lookup by patient ID or phone number, fetching real patient details from that API.
2. The "Upload Reports" section fetching the patient's actual requested lab tests from that API.

These are a distinct subsystem (different API, requires login/JWT flow) and will be scoped as their own design after this SMS work ships.

# Arkesel SMS Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send real SMS via Arkesel to the patient and the optometry department/staff whenever a booking is confirmed or cancelled in either OPTOCARE prototype, via a Netlify Function that keeps the Arkesel API key server-side only.

**Architecture:** One dependency-free Netlify Function (`netlify/functions/notify-booking.js`) receives booking details from the browser and calls Arkesel's plain-text SMS API twice (patient, staff). Both frontend prototypes' existing `autoSMS()` fires a non-blocking `fetch` to this function alongside their current local SMS-log behavior, which is left untouched.

**Tech Stack:** Plain Node.js (Netlify Functions runtime, Node 18, built-in `fetch` and `node:test`), no npm dependencies, static HTML/JS frontend (unchanged tooling).

---

## Reference: full spec

See `docs/superpowers/specs/2026-07-10-arkesel-sms-integration-design.md` for the approved design this plan implements.

## File Structure

- Create: `netlify/functions/notify-booking.js` — the function: `normalizePhone`, `buildStaffMessage`, `sendSms`, `handler`.
- Create: `netlify/functions/notify-booking.test.js` — unit tests (Node's built-in test runner, no framework install needed).
- Create: `netlify.toml` — Netlify build/functions config.
- Create: `.env.example` — documents the 3 required env vars (no real values).
- Modify: `Entrepreneurship/hospitalscript.js` — `autoSMS()` gains the fetch call.
- Modify: `ucc-hospital-portal.html` (inline `<script>`) — `autoSMS()` gains the same fetch call.
- Modify: `README.md` — short section on the 3 env vars to set in Netlify and how to run the unit tests locally.

---

### Task 1: Netlify config and env var documentation

**Files:**
- Create: `netlify.toml`
- Create: `.env.example`

- [ ] **Step 1: Create `netlify.toml`**

```toml
[build]
  publish = "."

[functions]
  directory = "netlify/functions"

[build.environment]
  NODE_VERSION = "18"
```

- [ ] **Step 2: Create `.env.example`**

```
ARKESEL_API_KEY=
ARKESEL_SENDER_ID=OPTOCARE
STAFF_PHONE_NUMBER=
```

- [ ] **Step 3: Verify the files are well-formed**

Run: `cat netlify.toml .env.example`
Expected: both files print their contents exactly as written above, no parse errors.

- [ ] **Step 4: Commit**

```bash
git add netlify.toml .env.example
git commit -m "Add Netlify function config and env var documentation"
```

---

### Task 2: Phone normalization and staff message helpers (TDD)

**Files:**
- Create: `netlify/functions/notify-booking.js`
- Test: `netlify/functions/notify-booking.test.js`

- [ ] **Step 1: Write the failing tests**

Create `netlify/functions/notify-booking.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhone, buildStaffMessage } = require('./notify-booking');

test('normalizePhone converts a leading 0 to the 233 country code', () => {
  assert.equal(normalizePhone('0244123456'), '233244123456');
});

test('normalizePhone strips a leading + and spaces', () => {
  assert.equal(normalizePhone('+233 24 412 3456'), '233244123456');
});

test('normalizePhone leaves an already-233 number unchanged', () => {
  assert.equal(normalizePhone('233244123456'), '233244123456');
});

test('buildStaffMessage builds a confirmation summary', () => {
  const appt = {
    name: 'Ama Serwaa',
    doctor: 'Dr. Ama Asante',
    dept: 'Optometry',
    dateFormatted: 'Mon, 14 Jul 2026',
    time: '10:00 AM',
    ref: 'UCC-ABC123',
  };
  const msg = buildStaffMessage('confirmation', appt);
  assert.match(msg, /New booking/);
  assert.match(msg, /Ama Serwaa/);
  assert.match(msg, /UCC-ABC123/);
});

test('buildStaffMessage builds a cancellation summary', () => {
  const appt = {
    name: 'Ama Serwaa',
    doctor: 'Dr. Ama Asante',
    dept: 'Optometry',
    dateFormatted: 'Mon, 14 Jul 2026',
    time: '10:00 AM',
    ref: 'UCC-ABC123',
  };
  const msg = buildStaffMessage('cancelled', appt);
  assert.match(msg, /Booking cancelled/);
  assert.match(msg, /Ama Serwaa/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test netlify/functions/notify-booking.test.js`
Expected: FAIL — `Cannot find module './notify-booking'` (file doesn't exist yet).

- [ ] **Step 3: Create `netlify/functions/notify-booking.js` with the two helpers**

```js
'use strict';

function normalizePhone(rawPhone) {
  const digits = String(rawPhone).replace(/\D/g, '');
  if (digits.startsWith('233')) return digits;
  if (digits.startsWith('0')) return '233' + digits.slice(1);
  return '233' + digits;
}

function buildStaffMessage(type, appt) {
  if (type === 'cancelled') {
    return `Booking cancelled: ${appt.name} with ${appt.doctor} (${appt.dept}) on ${appt.dateFormatted} at ${appt.time}. Ref: ${appt.ref}.`;
  }
  return `New booking: ${appt.name} with ${appt.doctor} (${appt.dept}) on ${appt.dateFormatted} at ${appt.time}. Ref: ${appt.ref}.`;
}

module.exports = { normalizePhone, buildStaffMessage };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test netlify/functions/notify-booking.test.js`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/notify-booking.js netlify/functions/notify-booking.test.js
git commit -m "Add phone normalization and staff message helpers"
```

---

### Task 3: `sendSms` — the Arkesel API call (TDD)

**Files:**
- Modify: `netlify/functions/notify-booking.js`
- Test: `netlify/functions/notify-booking.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `netlify/functions/notify-booking.test.js` (add this import at the top instead of the existing one):

```js
const { normalizePhone, buildStaffMessage, sendSms } = require('./notify-booking');
```

Add these tests:

```js
test('sendSms returns true when Arkesel responds ok', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    assert.match(url, /^https:\/\/sms\.arkesel\.com\/sms\/api\?action=send-sms/);
    assert.match(url, /to=233244123456/);
    assert.match(url, /from=OPTOCARE/);
    return { ok: true, text: async () => 'ok' };
  };
  try {
    const result = await sendSms('233244123456', 'hello', {
      ARKESEL_API_KEY: 'key123',
      ARKESEL_SENDER_ID: 'OPTOCARE',
    });
    assert.equal(result, true);
  } finally {
    global.fetch = originalFetch;
  }
});

test('sendSms returns false when the request throws', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error('network down');
  };
  try {
    const result = await sendSms('233244123456', 'hello', { ARKESEL_API_KEY: 'key123' });
    assert.equal(result, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('sendSms returns false when Arkesel responds not-ok', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, text: async () => 'error' });
  try {
    const result = await sendSms('233244123456', 'hello', { ARKESEL_API_KEY: 'key123' });
    assert.equal(result, false);
  } finally {
    global.fetch = originalFetch;
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test netlify/functions/notify-booking.test.js`
Expected: FAIL — `sendSms is not a function`.

- [ ] **Step 3: Implement `sendSms` in `netlify/functions/notify-booking.js`**

Add below `buildStaffMessage` and update the `module.exports`:

```js
const ARKESEL_BASE_URL = 'https://sms.arkesel.com/sms/api';

async function sendSms(to, message, env) {
  const apiKey = env.ARKESEL_API_KEY;
  const senderId = env.ARKESEL_SENDER_ID || 'OPTOCARE';
  const url =
    `${ARKESEL_BASE_URL}?action=send-sms` +
    `&api_key=${encodeURIComponent(apiKey)}` +
    `&to=${encodeURIComponent(to)}` +
    `&from=${encodeURIComponent(senderId)}` +
    `&sms=${encodeURIComponent(message)}`;
  try {
    const res = await fetch(url);
    await res.text();
    return res.ok;
  } catch (err) {
    console.error('Arkesel send failed', err);
    return false;
  }
}

module.exports = { normalizePhone, buildStaffMessage, sendSms };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test netlify/functions/notify-booking.test.js`
Expected: PASS — 8 tests passing.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/notify-booking.js netlify/functions/notify-booking.test.js
git commit -m "Add sendSms Arkesel API call"
```

---

### Task 4: `handler` — the Netlify Function entry point (TDD)

**Files:**
- Modify: `netlify/functions/notify-booking.js`
- Test: `netlify/functions/notify-booking.test.js`

- [ ] **Step 1: Write the failing tests**

Update the import line in `netlify/functions/notify-booking.test.js` to:

```js
const { normalizePhone, buildStaffMessage, sendSms, handler } = require('./notify-booking');
```

Add these tests:

```js
test('handler sends to both patient and staff numbers and returns 200', async () => {
  const originalFetch = global.fetch;
  const calledUrls = [];
  global.fetch = async (url) => {
    calledUrls.push(url);
    return { ok: true, text: async () => 'ok' };
  };
  process.env.ARKESEL_API_KEY = 'key123';
  process.env.ARKESEL_SENDER_ID = 'OPTOCARE';
  process.env.STAFF_PHONE_NUMBER = '0201112222';

  const event = {
    httpMethod: 'POST',
    body: JSON.stringify({
      type: 'confirmation',
      patientPhone: '+233 24 412 3456',
      patientMessage: 'UCC Hospital: Your appointment is confirmed...',
      appt: {
        name: 'Ama Serwaa',
        doctor: 'Dr. Ama Asante',
        dept: 'Optometry',
        dateFormatted: 'Mon, 14 Jul 2026',
        time: '10:00 AM',
        ref: 'UCC-ABC123',
      },
    }),
  };

  try {
    const res = await handler(event);
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.patientSmsSent, true);
    assert.equal(body.staffSmsSent, true);
    assert.equal(calledUrls.length, 2);
  } finally {
    global.fetch = originalFetch;
    delete process.env.ARKESEL_API_KEY;
    delete process.env.ARKESEL_SENDER_ID;
    delete process.env.STAFF_PHONE_NUMBER;
  }
});

test('handler supports a comma-separated STAFF_PHONE_NUMBER list', async () => {
  const originalFetch = global.fetch;
  const calledUrls = [];
  global.fetch = async (url) => {
    calledUrls.push(url);
    return { ok: true, text: async () => 'ok' };
  };
  process.env.ARKESEL_API_KEY = 'key123';
  process.env.STAFF_PHONE_NUMBER = '0201112222, 0203334444';

  const event = {
    httpMethod: 'POST',
    body: JSON.stringify({
      type: 'cancelled',
      patientPhone: '+233 24 412 3456',
      patientMessage: 'UCC Hospital: Your appointment has been cancelled.',
      appt: {
        name: 'Ama Serwaa',
        doctor: 'Dr. Ama Asante',
        dept: 'Optometry',
        dateFormatted: 'Mon, 14 Jul 2026',
        time: '10:00 AM',
        ref: 'UCC-ABC123',
      },
    }),
  };

  try {
    const res = await handler(event);
    const body = JSON.parse(res.body);
    assert.equal(body.staffSmsSent, true);
    assert.equal(calledUrls.length, 3); // 1 patient + 2 staff
  } finally {
    global.fetch = originalFetch;
    delete process.env.ARKESEL_API_KEY;
    delete process.env.STAFF_PHONE_NUMBER;
  }
});

test('handler returns 400 when required fields are missing', async () => {
  const event = { httpMethod: 'POST', body: JSON.stringify({ type: 'confirmation' }) };
  const res = await handler(event);
  assert.equal(res.statusCode, 400);
});

test('handler returns 400 for invalid JSON', async () => {
  const event = { httpMethod: 'POST', body: '{not json' };
  const res = await handler(event);
  assert.equal(res.statusCode, 400);
});

test('handler returns 405 for non-POST requests', async () => {
  const res = await handler({ httpMethod: 'GET' });
  assert.equal(res.statusCode, 405);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test netlify/functions/notify-booking.test.js`
Expected: FAIL — `handler is not a function`.

- [ ] **Step 3: Implement `handler` in `netlify/functions/notify-booking.js`**

Add below `sendSms` and update the final `module.exports`:

```js
async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { type, patientPhone, patientMessage, appt } = payload;
  if (!type || !patientPhone || !patientMessage || !appt) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const env = process.env;
  const patientTo = normalizePhone(patientPhone);
  const patientSmsSent = await sendSms(patientTo, patientMessage, env);

  const staffNumbers = (env.STAFF_PHONE_NUMBER || '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);

  const staffMessage = buildStaffMessage(type, appt);
  const staffResults = await Promise.all(
    staffNumbers.map((n) => sendSms(normalizePhone(n), staffMessage, env))
  );
  const staffSmsSent = staffResults.length > 0 && staffResults.every(Boolean);

  return {
    statusCode: 200,
    body: JSON.stringify({ patientSmsSent, staffSmsSent }),
  };
}

module.exports = { normalizePhone, buildStaffMessage, sendSms, handler };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test netlify/functions/notify-booking.test.js`
Expected: PASS — 13 tests passing, 0 failing.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/notify-booking.js netlify/functions/notify-booking.test.js
git commit -m "Add notify-booking Netlify function handler"
```

---

### Task 5: Wire up `Entrepreneurship/hospitalscript.js`

**Files:**
- Modify: `Entrepreneurship/hospitalscript.js:58-70`

- [ ] **Step 1: Replace `autoSMS` to also call the function**

Find:

```js
/* ===== AUTOMATED SMS ENGINE ===== */
function autoSMS(type, appt) {
  const msg = SMS[type](appt);
  smsLogs.unshift({
    to: appt.phone,
    patient: appt.name,
    message: msg,
    sentAt: formatDateTime(),
    type,
    ref: appt.ref,
  });
  renderSMSLog();
}
```

Replace with:

```js
/* ===== AUTOMATED SMS ENGINE ===== */
function autoSMS(type, appt) {
  const msg = SMS[type](appt);
  smsLogs.unshift({
    to: appt.phone,
    patient: appt.name,
    message: msg,
    sentAt: formatDateTime(),
    type,
    ref: appt.ref,
  });
  renderSMSLog();

  fetch('/.netlify/functions/notify-booking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type,
      patientPhone: appt.phone,
      patientMessage: msg,
      appt: {
        name: appt.name,
        doctor: appt.doctor,
        dept: appt.dept,
        dateFormatted: appt.dateFormatted,
        time: appt.time,
        ref: appt.ref,
      },
    }),
  }).catch((err) => console.error('SMS notify failed', err));
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `node --check Entrepreneurship/hospitalscript.js`
Expected: no output (exit code 0).

- [ ] **Step 3: Commit**

```bash
git add Entrepreneurship/hospitalscript.js
git commit -m "Send real SMS notifications from the Entrepreneurship booking prototype"
```

---

### Task 6: Wire up `ucc-hospital-portal.html`

**Files:**
- Modify: `ucc-hospital-portal.html:871-883`

- [ ] **Step 1: Replace `autoSMS` to also call the function**

Find (inside the inline `<script>` block):

```js
/* ===== AUTOMATED SMS ENGINE ===== */
function autoSMS(type, appt) {
  const msg = SMS[type](appt);
  smsLogs.unshift({
    to: appt.phone,
    patient: appt.name,
    message: msg,
    sentAt: formatDateTime(),
    type,
    ref: appt.ref,
  });
  renderSMSLog();
}
```

Replace with the same block used in Task 5:

```js
/* ===== AUTOMATED SMS ENGINE ===== */
function autoSMS(type, appt) {
  const msg = SMS[type](appt);
  smsLogs.unshift({
    to: appt.phone,
    patient: appt.name,
    message: msg,
    sentAt: formatDateTime(),
    type,
    ref: appt.ref,
  });
  renderSMSLog();

  fetch('/.netlify/functions/notify-booking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type,
      patientPhone: appt.phone,
      patientMessage: msg,
      appt: {
        name: appt.name,
        doctor: appt.doctor,
        dept: appt.dept,
        dateFormatted: appt.dateFormatted,
        time: appt.time,
        ref: appt.ref,
      },
    }),
  }).catch((err) => console.error('SMS notify failed', err));
}
```

- [ ] **Step 2: Verify the file still opens/renders**

Run: `node -e "require('fs').readFileSync('ucc-hospital-portal.html','utf8').includes('/.netlify/functions/notify-booking') || process.exit(1)"`
Expected: no output (exit code 0) — confirms the new fetch call is present in the file.

- [ ] **Step 3: Commit**

```bash
git add ucc-hospital-portal.html
git commit -m "Send real SMS notifications from the root booking prototype"
```

---

### Task 7: Document env var setup in README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append a setup section**

Add to the end of `README.md`:

```markdown

## SMS notifications (Arkesel)

Bookings and cancellations trigger real SMS via Arkesel through a Netlify Function
(`netlify/functions/notify-booking.js`). Set these in the Netlify dashboard under
Site settings → Environment variables (never commit real values — see `.env.example`):

- `ARKESEL_API_KEY` — from your Arkesel account's SMS API settings.
- `ARKESEL_SENDER_ID` — defaults to `OPTOCARE` for testing; replace once a registered
  sender ID is approved.
- `STAFF_PHONE_NUMBER` — one number, or a comma-separated list, to notify on every
  booking/cancellation.

Run the function's unit tests locally with:

\`\`\`bash
node --test netlify/functions/notify-booking.test.js
\`\`\`
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Document Arkesel SMS env var setup"
```

---

### Task 8: Push and verify against the live Arkesel account

**Files:** none (verification only)

- [ ] **Step 1: Push to the connected GitHub repo**

```bash
git push
```

Expected: Netlify picks up the push and auto-deploys (check the Netlify dashboard's Deploys tab for a new build).

- [ ] **Step 2: Confirm the 3 env vars are set in Netlify**

In the Netlify dashboard: Site settings → Environment variables → confirm `ARKESEL_API_KEY`,
`ARKESEL_SENDER_ID`, and `STAFF_PHONE_NUMBER` are all set with real values, then trigger a
redeploy if any were just added (env vars only take effect on the next build).

- [ ] **Step 3: Hit the live function directly with a real phone number**

```bash
curl -i -X POST https://<your-site-name>.netlify.app/.netlify/functions/notify-booking \
  -H "Content-Type: application/json" \
  -d '{
    "type": "confirmation",
    "patientPhone": "+233XXXXXXXXX",
    "patientMessage": "Test: this is a real SMS from OPTOCARE.",
    "appt": {"name":"Test Patient","doctor":"Dr. Ama Asante","dept":"Optometry","dateFormatted":"Mon, 14 Jul 2026","time":"10:00 AM","ref":"UCC-TEST01"}
  }'
```

Replace `<your-site-name>` and `+233XXXXXXXXX` with the real Netlify site name and a real phone
number. Expected: `HTTP/2 200` with body `{"patientSmsSent":true,"staffSmsSent":true}`, and both
the patient number and the staff number(s) receive a real text within a few seconds.

- [ ] **Step 4: Click through a real booking and cancellation on the deployed site**

Open the deployed site, complete a booking with a real phone number, confirm the SMS arrives,
then cancel it and confirm the cancellation SMS arrives too.

---

## Self-review notes

- Spec coverage: normalization, patient SMS, staff SMS (with comma-separated list support),
  fire-and-forget frontend wiring in both prototypes, `.env.example`/`netlify.toml` config, and
  live verification are all covered by Tasks 1–8.
- No placeholders: every step has literal code or an exact command.
- Type consistency: `appt` object fields (`name`, `doctor`, `dept`, `dateFormatted`, `time`, `ref`)
  match exactly what `confirmBooking()`/`cancelAppt()` already produce in both frontend files, and
  `handler`'s destructured payload fields match what the frontend now sends.

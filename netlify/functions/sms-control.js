'use strict';

const { getStore } = require('@netlify/blobs');

/* Server-side control for the SMS kill-switch.
   - Reading the current status is public (the booking flow needs to word its notice).
   - Changing it requires the clinic admin's email + password, checked here against
     Netlify env vars (ADMIN_EMAIL / ADMIN_PASSWORD) so no secret ever lives in the
     browser. The flag is stored in Netlify Blobs, shared with notify-booking.js. */
const SETTINGS_STORE = 'optocare-settings';
const SMS_FLAG_KEY = 'sms-enabled';

function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}

/* On Netlify, getStore(name) uses the site's Blobs context automatically. Locally, fall back
   to explicit siteID/token from env. In production these vars are unset → auto context. */
function settingsStore() {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_API_TOKEN;
  if (siteID && token) return getStore({ name: SETTINGS_STORE, siteID, token });
  return getStore(SETTINGS_STORE);
}

async function readEnabled() {
  const store = settingsStore();
  const val = await store.get(SMS_FLAG_KEY);
  return val === null || val === undefined ? true : val === 'true';
}

async function writeEnabled(enabled) {
  const store = settingsStore();
  await store.set(SMS_FLAG_KEY, enabled ? 'true' : 'false');
}

function credentialsMatch(email, password) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  // Refuse to authenticate anyone if the admin account isn't configured.
  if (!adminEmail || !adminPassword) return false;
  const emailOk = String(email || '').trim().toLowerCase() === adminEmail.trim().toLowerCase();
  const passOk = String(password || '') === adminPassword;
  return emailOk && passOk;
}

async function handler(event) {
  // Public read: current status.
  if (event.httpMethod === 'GET') {
    try {
      return json(200, { enabled: await readEnabled() });
    } catch (err) {
      console.error('status read failed', err);
      return json(200, { enabled: true });
    }
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return json(400, { error: 'Invalid JSON' });
  }

  const { action, email, password, enabled } = payload;

  if (action === 'status') {
    try {
      return json(200, { enabled: await readEnabled() });
    } catch (err) {
      console.error('status read failed', err);
      return json(200, { enabled: true });
    }
  }

  // Everything below requires the admin credentials.
  if (!credentialsMatch(email, password)) {
    return json(401, { error: 'invalid_credentials' });
  }

  if (action === 'login') {
    try {
      return json(200, { ok: true, enabled: await readEnabled() });
    } catch (err) {
      console.error('login status read failed', err);
      return json(200, { ok: true, enabled: true });
    }
  }

  if (action === 'set') {
    if (typeof enabled !== 'boolean') {
      return json(400, { error: 'enabled must be true or false' });
    }
    try {
      await writeEnabled(enabled);
      return json(200, { ok: true, enabled });
    } catch (err) {
      console.error('set failed', err);
      return json(500, { error: 'Could not save the setting. Please try again.' });
    }
  }

  return json(400, { error: 'Unknown action' });
}

module.exports = { handler, credentialsMatch };

'use strict';

function normalizePhone(rawPhone) {
  const digits = String(rawPhone).replace(/\D/g, '');
  if (digits.startsWith('233')) return digits;
  if (digits.startsWith('0')) return '233' + digits.slice(1);
  return '233' + digits;
}

function buildStaffMessage(type, appt) {
  // Portal bookings carry no doctor/time — the clinic assigns those later.
  const who = appt.doctor ? `with ${appt.doctor} (${appt.dept})` : `for ${appt.dept}`;
  const when = appt.time ? `${appt.dateFormatted} at ${appt.time}` : appt.dateFormatted;
  if (type === 'cancelled') {
    return `Booking cancelled: ${appt.name} ${who} on ${when}. Ref: ${appt.ref}.`;
  }
  return `New booking: ${appt.name} ${who} on ${when}. Ref: ${appt.ref}.`;
}

const ARKESEL_BASE_URL = 'https://sms.arkesel.com/sms/api';

async function sendSms(to, message, env) {
  const apiKey = env.ARKESEL_API_KEY;
  const senderId = env.ARKESEL_SENDER_ID || 'OPTOCARE';
  const url =
    `${ARKESEL_BASE_URL}?action=send-sms` +
    `&api_key=${encodeURIComponent(apiKey)}` +
    `&to=${encodeURIComponent(to)}` +
    `&from=${encodeURIComponent(senderId)}` +
    `&sms=${encodeURIComponent(message)}` +
    `&response=json`;
  try {
    const res = await fetch(url);
    const body = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (parseErr) {
      console.error('Arkesel response was not valid JSON', parseErr);
      return false;
    }
    return Boolean(parsed) && parsed.code === 'ok';
  } catch (err) {
    console.error('Arkesel send failed', err);
    return false;
  }
}

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

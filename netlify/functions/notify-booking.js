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

module.exports = { normalizePhone, buildStaffMessage, sendSms };

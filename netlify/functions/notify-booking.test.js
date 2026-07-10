const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhone, buildStaffMessage, sendSms } = require('./notify-booking');

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

test('sendSms returns true when Arkesel responds with code "ok"', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    assert.match(url, /^https:\/\/sms\.arkesel\.com\/sms\/api\?action=send-sms/);
    assert.match(url, /to=233244123456/);
    assert.match(url, /from=OPTOCARE/);
    assert.match(url, /response=json/);
    return {
      ok: true,
      text: async () => JSON.stringify({ code: 'ok', message: 'Successfully Sent', balance: 241 }),
    };
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

test('sendSms returns false when Arkesel responds HTTP 200 with a non-ok code (e.g. invalid phone number)', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    text: async () => JSON.stringify({ code: '103', message: '1 invalid Phone Number on your list' }),
  });
  try {
    const result = await sendSms('233244123456', 'hello', { ARKESEL_API_KEY: 'key123' });
    assert.equal(result, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('sendSms returns false without throwing when the response body is not valid JSON', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, text: async () => 'not valid json' });
  try {
    const result = await sendSms('233244123456', 'hello', { ARKESEL_API_KEY: 'key123' });
    assert.equal(result, false);
  } finally {
    global.fetch = originalFetch;
  }
});

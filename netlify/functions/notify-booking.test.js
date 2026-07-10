const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhone, buildStaffMessage, sendSms, handler } = require('./notify-booking');

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

test('handler sends to both patient and staff numbers and returns 200', async () => {
  const originalFetch = global.fetch;
  const calledUrls = [];
  global.fetch = async (url) => {
    calledUrls.push(url);
    return { ok: true, text: async () => JSON.stringify({ code: 'ok', message: 'Successfully Sent' }) };
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
    return { ok: true, text: async () => JSON.stringify({ code: 'ok', message: 'Successfully Sent' }) };
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

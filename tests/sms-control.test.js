const test = require('node:test');
const assert = require('node:assert/strict');
const { handler, credentialsMatch } = require('../netlify/functions/sms-control');

test('credentialsMatch rejects everything when the admin account is not configured', () => {
  const e = process.env.ADMIN_EMAIL, p = process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_EMAIL;
  delete process.env.ADMIN_PASSWORD;
  try {
    assert.equal(credentialsMatch('anyone@x.com', 'anything'), false);
    assert.equal(credentialsMatch('', ''), false);
  } finally {
    if (e) process.env.ADMIN_EMAIL = e;
    if (p) process.env.ADMIN_PASSWORD = p;
  }
});

test('credentialsMatch matches email case-insensitively but the password exactly', () => {
  process.env.ADMIN_EMAIL = 'Admin@Clinic.com';
  process.env.ADMIN_PASSWORD = 'S3cret!';
  try {
    assert.equal(credentialsMatch('admin@clinic.com', 'S3cret!'), true);
    assert.equal(credentialsMatch('  ADMIN@clinic.COM ', 'S3cret!'), true);
    assert.equal(credentialsMatch('admin@clinic.com', 's3cret!'), false); // wrong case password
    assert.equal(credentialsMatch('someone.else@clinic.com', 'S3cret!'), false);
  } finally {
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
  }
});

test('a "set" request with the wrong password is refused with 401', async () => {
  process.env.ADMIN_EMAIL = 'admin@clinic.com';
  process.env.ADMIN_PASSWORD = 'right-pw';
  try {
    const res = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ action: 'set', email: 'admin@clinic.com', password: 'wrong-pw', enabled: false }),
    });
    assert.equal(res.statusCode, 401);
  } finally {
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
  }
});

test('a "status" request needs no credentials and returns an enabled boolean', async () => {
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ action: 'status' }) });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(typeof body.enabled, 'boolean');
});

test('a GET request returns the current status', async () => {
  const res = await handler({ httpMethod: 'GET' });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(typeof body.enabled, 'boolean');
});

test('an unsupported method returns 405', async () => {
  const res = await handler({ httpMethod: 'PUT' });
  assert.equal(res.statusCode, 405);
});

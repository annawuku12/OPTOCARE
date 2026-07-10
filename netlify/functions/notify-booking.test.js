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

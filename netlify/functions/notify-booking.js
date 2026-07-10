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

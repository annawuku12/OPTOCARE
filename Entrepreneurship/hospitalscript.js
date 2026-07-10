/* ===== DATA ===== */
const DEPARTMENTS = [
  { id: 'optometry',   name: 'Optometry',   icon: '👁️', doctors: ['Dr. Ama Asante', 'Dr. Kweku Boateng', 'Dr. Efua Mensah'] },
  { id: 'general',     name: 'General OPD', icon: '🏥', doctors: ['Dr. Yaw Darko', 'Dr. Abena Owusu'] },
  { id: 'cardiology',  name: 'Cardiology',  icon: '❤️', doctors: ['Dr. Kofi Acheampong', 'Dr. Nana Adjoa'] },
  { id: 'dental',      name: 'Dental',      icon: '🦷', doctors: ['Dr. Akua Appiah', 'Dr. Kwame Frimpong'] },
  { id: 'gynecology',  name: 'Gynecology',  icon: '🌸', doctors: ['Dr. Adwoa Sarpong', 'Dr. Esi Amoah'] },
  { id: 'pediatrics',  name: 'Pediatrics',  icon: '👶', doctors: ['Dr. Kwabena Asare', 'Dr. Afia Mensah'] },
  { id: 'orthopedics', name: 'Orthopedics', icon: '🦴', doctors: ['Dr. Nii Adjei', 'Dr. Yaa Bonsu'] },
  { id: 'laboratory',  name: 'Laboratory',  icon: '🔬', doctors: ['Dr. Kojo Antwi', 'Dr. Akosua Dankwa'] },
];

const TIME_SLOTS = [
  '8:00 AM','8:30 AM','9:00 AM','9:30 AM',
  '10:00 AM','10:30 AM','11:00 AM','11:30 AM',
  '2:00 PM','2:30 PM','3:00 PM','3:30 PM','4:00 PM'
];

/* ===== AUTO SMS TEMPLATES ===== */
const SMS = {
  confirmation: (a) =>
    `UCC Hospital: Your appointment is confirmed. Patient: ${a.name} | Dept: ${a.dept} | Doctor: ${a.doctor} | ${a.dateFormatted} at ${a.time}. Ref: ${a.ref}. We look forward to seeing you. Queries: 0332 090 000.`,
  reminder: (a) =>
    `UCC Hospital Reminder: Dear ${a.name}, your appointment with ${a.doctor} (${a.dept}) is on ${a.dateFormatted} at ${a.time}. Please arrive 10 mins early. Ref: ${a.ref}. Queries: 0332 090 000.`,
  cancelled: (a) =>
    `UCC Hospital: Your appointment (Ref: ${a.ref}) with ${a.doctor} on ${a.dateFormatted} at ${a.time} has been cancelled. To rebook, visit ucchosp.edu.gh or call 0332 090 000. We apologise for the inconvenience.`,
};

/* ===== STATE ===== */
let appointments = [];
let reports = [];
let smsLogs = [];
let currentStep = 1;
let selectedDept = null;
let selectedSlot = null;
let selectedFile = null;

/* ===== UTILS ===== */
function genRef() { return 'UCC-' + Date.now().toString(36).toUpperCase().slice(-6); }
function formatDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function formatDateTime() {
  return new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast' + (type ? ' ' + type : '');
  t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3500);
}
function openModal(html) {
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('open');
}
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }

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

/* ===== NAV ===== */
function enterPortal() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-patient').classList.add('active');
  renderDeptGrid();
  initDateInput();
  refreshPatientAppointments();
  refreshUploadApptLink();
  renderSMSLog();
  window.scrollTo(0, 0);
}

function goHome() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-landing').classList.add('active');
  resetBookingForm();
  window.scrollTo(0, 0);
}

function showTab(tab) {
  document.querySelectorAll('#page-patient .tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.querySelectorAll('#page-patient .tab-panel').forEach(p => {
    p.classList.toggle('active', p.id === 'tab-' + tab);
  });
  if (tab === 'my-appointments') refreshPatientAppointments();
  if (tab === 'upload') refreshUploadApptLink();
  if (tab === 'sms-history') renderSMSLog();
}

/* ===== BOOKING ===== */
function renderDeptGrid() {
  document.getElementById('dept-grid').innerHTML = DEPARTMENTS.map(d => `
    <div class="dept-item" id="dept-${d.id}" onclick="selectDept('${d.id}')">
      <span class="dept-icon">${d.icon}</span>
      <span class="dept-name">${d.name}</span>
    </div>`).join('');
}

function selectDept(id) {
  selectedDept = DEPARTMENTS.find(d => d.id === id);
  document.querySelectorAll('.dept-item').forEach(el => el.classList.remove('selected'));
  document.getElementById('dept-' + id).classList.add('selected');
  const docSel = document.getElementById('p-doctor');
  docSel.innerHTML = selectedDept.doctors.map(d => `<option>${d}</option>`).join('');
  document.getElementById('doctor-group').style.display = 'block';
  document.getElementById('reason-group').style.display = 'block';
}

function initDateInput() {
  const today = new Date().toISOString().split('T')[0];
  const el = document.getElementById('p-date');
  el.min = today;
  el.removeEventListener('change', renderTimeSlots);
  el.addEventListener('change', renderTimeSlots);
}

function renderTimeSlots() {
  const dateVal = document.getElementById('p-date').value;
  if (!dateVal) return;
  selectedSlot = null;
  const taken = appointments.filter(a => a.date === dateVal && a.status !== 'cancelled').map(a => a.time);
  const unavail = taken.length > 0 ? [taken[Math.floor(Math.random() * taken.length)]] : [];
  document.getElementById('time-slots').innerHTML = `
    <div class="slots-grid">
      ${TIME_SLOTS.map(t => {
        const u = unavail.includes(t);
        return `<div class="slot${u ? ' unavailable' : ''}" onclick="${u ? '' : `selectSlot('${t}', this)`}">${t}</div>`;
      }).join('')}
    </div>`;
}

function selectSlot(time, el) {
  selectedSlot = time;
  document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
}

function nextStep(step) { if (!validateStep(step)) return; goToStep(step + 1); if (step + 1 === 4) buildConfirmSummary(); }
function prevStep(step) { goToStep(step - 1); }
function goToStep(n) {
  document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
  document.getElementById('step-' + n).classList.add('active');
  document.querySelectorAll('.step').forEach((s, i) => {
    s.classList.remove('active', 'done');
    if (i + 1 === n) s.classList.add('active');
    if (i + 1 < n) s.classList.add('done');
  });
  currentStep = n;
}

function validateStep(step) {
  if (step === 1) {
    if (!document.getElementById('p-name').value.trim()) { showToast('Please enter your full name', 'error'); return false; }
    if (!document.getElementById('p-phone').value.trim()) { showToast('Please enter your phone number', 'error'); return false; }
    if (!document.getElementById('p-gender').value) { showToast('Please select your gender', 'error'); return false; }
    return true;
  }
  if (step === 2) { if (!selectedDept) { showToast('Please select a department', 'error'); return false; } return true; }
  if (step === 3) {
    if (!document.getElementById('p-date').value) { showToast('Please select a date', 'error'); return false; }
    if (!selectedSlot) { showToast('Please select a time slot', 'error'); return false; }
    return true;
  }
  return true;
}

function buildConfirmSummary() {
  const name = document.getElementById('p-name').value.trim();
  const phone = '+233 ' + document.getElementById('p-phone').value.trim();
  const doctor = document.getElementById('p-doctor').value;
  const date = formatDate(document.getElementById('p-date').value);
  const reason = document.getElementById('p-reason').value.trim() || 'Not specified';
  document.getElementById('confirm-summary').innerHTML = `
    <div class="confirm-row"><span class="confirm-label">Patient</span><span class="confirm-value">${name}</span></div>
    <div class="confirm-row"><span class="confirm-label">Phone (SMS)</span><span class="confirm-value">${phone}</span></div>
    <div class="confirm-row"><span class="confirm-label">Department</span><span class="confirm-value">${selectedDept.name}</span></div>
    <div class="confirm-row"><span class="confirm-label">Doctor</span><span class="confirm-value">${doctor}</span></div>
    <div class="confirm-row"><span class="confirm-label">Date</span><span class="confirm-value">${date}</span></div>
    <div class="confirm-row"><span class="confirm-label">Time</span><span class="confirm-value">${selectedSlot}</span></div>
    <div class="confirm-row"><span class="confirm-label">Reason</span><span class="confirm-value">${reason}</span></div>`;
}

function confirmBooking() {
  const ref = genRef();
  const appt = {
    ref,
    name: document.getElementById('p-name').value.trim(),
    age: document.getElementById('p-age').value,
    gender: document.getElementById('p-gender').value,
    phone: '+233 ' + document.getElementById('p-phone').value.trim(),
    patientId: document.getElementById('p-id').value.trim() || ref,
    dept: selectedDept.name, deptId: selectedDept.id,
    doctor: document.getElementById('p-doctor').value,
    date: document.getElementById('p-date').value,
    dateFormatted: formatDate(document.getElementById('p-date').value),
    time: selectedSlot,
    reason: document.getElementById('p-reason').value.trim() || 'Not specified',
    status: 'confirmed',
    bookedAt: formatDateTime(),
  };
  appointments.unshift(appt);

  // 🔔 AUTO SMS: confirmation
  autoSMS('confirmation', appt);
  updateNotifBadge();

  openModal(`
    <div class="modal-success">
      <div class="modal-check">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h2>Appointment Confirmed!</h2>
      <p>Your appointment has been booked successfully.</p>
      <div class="appt-ref">${ref}</div>
      <div class="sms-sent-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        SMS confirmation sent automatically to ${appt.phone}
      </div>
      <div class="confirm-card" style="margin-bottom:1rem">
        <div class="confirm-row"><span class="confirm-label">Department</span><span class="confirm-value">${appt.dept}</span></div>
        <div class="confirm-row"><span class="confirm-label">Doctor</span><span class="confirm-value">${appt.doctor}</span></div>
        <div class="confirm-row"><span class="confirm-label">Date</span><span class="confirm-value">${appt.dateFormatted}</span></div>
        <div class="confirm-row"><span class="confirm-label">Time</span><span class="confirm-value">${appt.time}</span></div>
      </div>
      <button class="btn btn-primary btn-full" onclick="closeModal(); showTab('my-appointments')">View My Appointments</button>
    </div>`);

  resetBookingForm();
}

function resetBookingForm() {
  currentStep = 1; selectedDept = null; selectedSlot = null;
  goToStep(1);
  ['p-name','p-age','p-phone','p-id','p-reason'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['p-gender','p-doctor'].forEach(id => { const el = document.getElementById(id); if (el) el.selectedIndex = 0; });
  document.getElementById('p-date').value = '';
  document.getElementById('time-slots').innerHTML = '<p class="slots-hint">Select a date to see available slots</p>';
  document.getElementById('doctor-group').style.display = 'none';
  document.getElementById('reason-group').style.display = 'none';
  document.querySelectorAll('.dept-item').forEach(el => el.classList.remove('selected'));
  renderDeptGrid();
}

/* ===== APPOINTMENTS LIST ===== */
function refreshPatientAppointments() {
  const list = document.getElementById('patient-appointments-list');
  updateNotifBadge();
  if (!appointments.length) {
    list.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg><p>No appointments yet.<br/>Book your first appointment above.</p></div>`;
    return;
  }
  list.innerHTML = appointments.map(a => renderApptCard(a)).join('');
}

function renderApptCard(a) {
  const statusClass = 'status-' + a.status;
  const statusLabel = a.status.charAt(0).toUpperCase() + a.status.slice(1);
  const canCancel = a.status !== 'cancelled';
  return `
    <div class="appt-card ${a.status}" id="appt-${a.ref}">
      <div class="appt-header">
        <div>
          <div class="appt-name">${a.dept}</div>
          <div class="appt-dept">${a.doctor}</div>
        </div>
        <span class="status-badge ${statusClass}">${statusLabel}</span>
      </div>
      <div class="appt-meta">
        <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>${a.dateFormatted}</span>
        <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${a.time}</span>
        <span>Ref: ${a.ref}</span>
      </div>
      <div class="appt-actions">
        ${canCancel ? `<button class="btn btn-danger" onclick="cancelAppt('${a.ref}')">Cancel Appointment</button>` : '<span style="font-size:0.78rem;color:var(--gray-500)">Cancelled</span>'}
      </div>
    </div>`;
}

function cancelAppt(ref) {
  const a = appointments.find(a => a.ref === ref);
  if (!a) return;
  a.status = 'cancelled';
  // 🔔 AUTO SMS: cancellation
  autoSMS('cancelled', a);
  showToast('Appointment cancelled — SMS sent to your phone.', 'error');
  refreshPatientAppointments();
}

function updateNotifBadge() {
  const count = appointments.filter(a => a.status === 'confirmed').length;
  const badge = document.getElementById('notif-count');
  badge.textContent = count;
  badge.classList.toggle('visible', count > 0);
}

/* ===== SMS LOG ===== */
function renderSMSLog() {
  const log = document.getElementById('sms-log-list');
  if (!log) return;
  if (!smsLogs.length) {
    log.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><p>No messages sent yet.<br/>Book an appointment to receive your first SMS.</p></div>`;
    return;
  }
  log.innerHTML = smsLogs.map(s => {
    const typeKey = s.type;
    const typeClass = typeKey === 'cancelled' ? 'cancel' : typeKey === 'reminder' ? 'reminder' : '';
    const typeLbl = typeKey.charAt(0).toUpperCase() + typeKey.slice(1);
    return `
      <div class="sms-log-item type-${typeKey}">
        <div class="sms-log-meta">
          <span>📱 ${s.to} · <strong>${s.patient}</strong> · <span class="sms-log-type ${typeClass}">${typeLbl}</span></span>
          <span>${s.sentAt}</span>
        </div>
        <div class="sms-log-msg">${s.message}</div>
      </div>`;
  }).join('');
}

/* ===== UPLOAD REPORTS ===== */
function handleFileSelect(input) {
  if (!input.files.length) return;
  selectedFile = input.files[0];
  const size = (selectedFile.size / 1024).toFixed(1) + ' KB';
  const ext = selectedFile.name.split('.').pop().toUpperCase();
  const icon = ext === 'PDF' ? '📄' : '🖼️';
  const fp = document.getElementById('file-preview');
  fp.style.display = 'flex';
  fp.innerHTML = `
    <span class="file-icon">${icon}</span>
    <div class="file-info"><div class="file-name">${selectedFile.name}</div><div class="file-size">${ext} · ${size}</div></div>
    <button class="file-remove" onclick="removeFile()">✕</button>`;
}
function removeFile() {
  selectedFile = null;
  document.getElementById('file-input').value = '';
  document.getElementById('file-preview').style.display = 'none';
}

function submitReport() {
  const type = document.getElementById('report-type').value;
  const hospital = document.getElementById('issuing-hospital').value.trim();
  const date = document.getElementById('report-date').value;
  if (!type) { showToast('Please select a report type', 'error'); return; }
  if (!hospital) { showToast('Please enter the issuing hospital', 'error'); return; }
  if (!date) { showToast('Please enter the report date', 'error'); return; }
  if (!selectedFile) { showToast('Please upload a file', 'error'); return; }

  const report = {
    id: genRef(), type, hospital, date,
    dateFormatted: formatDate(date),
    notes: document.getElementById('report-notes').value.trim(),
    fileName: selectedFile.name,
    fileSize: (selectedFile.size / 1024).toFixed(1) + ' KB',
    apptLink: document.getElementById('upload-appt-link').value,
    uploadedAt: formatDateTime(), status: 'pending',
  };
  reports.unshift(report);
  showToast('Report uploaded successfully!', 'success');
  renderReportsList();
  ['report-type','issuing-hospital','report-date','report-notes','upload-appt-link'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  removeFile();
}

function refreshUploadApptLink() {
  const sel = document.getElementById('upload-appt-link');
  sel.innerHTML = '<option value="">No linked appointment</option>' +
    appointments.filter(a => a.status !== 'cancelled').map(a =>
      `<option value="${a.ref}">${a.ref} — ${a.dept} (${a.dateFormatted})</option>`).join('');
}

function renderReportsList() {
  const list = document.getElementById('reports-list');
  if (!reports.length) {
    list.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg><p>No reports uploaded yet.</p></div>`;
    return;
  }
  list.innerHTML = reports.map(r => `
    <div class="report-card">
      <div class="report-header">
        <div><div class="report-type">${r.type}</div><div class="report-hospital">${r.hospital}</div></div>
        <span class="status-badge status-pending">Pending Review</span>
      </div>
      <div class="appt-meta">
        <span>📅 ${r.dateFormatted}</span>
        <span>📎 ${r.fileName} (${r.fileSize})</span>
      </div>
      ${r.notes ? `<div style="font-size:0.8rem;color:var(--gray-500);margin-top:4px">📝 ${r.notes}</div>` : ''}
    </div>`).join('');
}

/* ===== DRAG & DROP ===== */
const dropZone = document.getElementById('drop-zone');
if (dropZone) {
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleFileSelect({ files: e.dataTransfer.files });
  });
}

/* ===== SEED DEMO DATA ===== */
(function seedDemo() {
  const d1 = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
  const d2 = new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0];
  const demo = [
    {
      ref: 'DEMO01', name: 'Kwame Asante', age: 34, gender: 'Male',
      phone: '+233 24 123 4567', patientId: 'UCC-2024-001',
      dept: 'Optometry', deptId: 'optometry', doctor: 'Dr. Ama Asante',
      date: d1, dateFormatted: formatDate(d1), time: '10:00 AM',
      reason: 'Routine eye check', status: 'confirmed', bookedAt: formatDateTime(),
    },
    {
      ref: 'DEMO02', name: 'Kwame Asante', age: 34, gender: 'Male',
      phone: '+233 24 123 4567', patientId: 'UCC-2024-001',
      dept: 'Cardiology', deptId: 'cardiology', doctor: 'Dr. Kofi Acheampong',
      date: d2, dateFormatted: formatDate(d2), time: '2:30 PM',
      reason: 'Follow-up consultation', status: 'pending', bookedAt: formatDateTime(),
    },
  ];
  appointments.push(...demo);
  // Auto-log demo SMS
  demo.forEach(a => autoSMS('confirmation', a));
})();

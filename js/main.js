'use strict';
/* main.js — shared helpers and the data store used by every page.
   Patients and each day's appointment list are saved in this browser
   (localStorage). They are NOT on a server and other computers cannot see them. */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- Utilities ---------- */
const Utils = {
  pad: n => String(n).padStart(2, '0'),
  iso(d) { return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}`; },
  today() { return this.iso(new Date()); },
  daysFromToday(n) { const d = new Date(); d.setDate(d.getDate() + n); return this.iso(d); },
  parse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); },
  fmtDate(s) { return this.parse(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); },
  fmtLong(s) { return this.parse(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); },
  esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  initials: name => name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase(),
  qs: name => new URLSearchParams(location.search).get(name),
  icons() { if (window.lucide) window.lucide.createIcons(); },
  validPhone(v) { const digits = String(v).replace(/\D/g, ''); return /^[+\d][\d\s-]*$/.test(String(v).trim()) && (digits.length === 10 || (digits.length >= 11 && digits.length <= 13)); },
  empty(icon, title, text, action = '') {
    return `<div class="empty"><i data-lucide="${icon}"></i><h3>${title}</h3><p>${text}</p>${action}</div>`;
  },
  skeletonRows(cols, rows = 5) {
    return Array.from({ length: rows }, () => `<tr class="skeleton">${'<td><div></div></td>'.repeat(cols)}</tr>`).join('');
  },
  toast(msg, type = 'info') {
    let box = $('#toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = `<i data-lucide="${{ success: 'circle-check', error: 'circle-alert', info: 'info' }[type]}"></i><span>${this.esc(msg)}</span>`;
    box.appendChild(t); this.icons();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 250); }, 4200);
  },
  modal(title, body, buttons = []) {
    this.closeModal();
    const o = document.createElement('div');
    o.className = 'modal-overlay'; o.id = 'modal';
    o.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${this.esc(title)}">
      <div class="modal-head"><h3>${this.esc(title)}</h3><button class="icon-btn" data-close aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="modal-body">${body}</div>${buttons.length ? '<div class="modal-foot"></div>' : ''}</div>`;
    const foot = $('.modal-foot', o);
    buttons.forEach(b => {
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'btn ' + (b.cls || 'btn-ghost'); el.textContent = b.label;
      el.onclick = () => (b.fn ? b.fn(o) : this.closeModal());
      foot.appendChild(el);
    });
    o.addEventListener('click', e => { if (e.target === o || e.target.closest('[data-close]')) this.closeModal(); });
    document.body.appendChild(o); this.icons();
    return o;
  },
  closeModal() { const m = $('#modal'); if (m) m.remove(); },
  /* Opening screen: name and slogan fade in; shown once per browser session */
  splash() {
    const html = document.documentElement;
    if (!html.classList.contains('splash-on')) return;
    const s = document.createElement('div');
    s.className = 'splash';
    s.innerHTML = '<h1>Khatod Hospital</h1><p>You are in safe hands.</p>';
    document.body.appendChild(s);
    let closed = false;
    const close = () => {
      if (closed) return; closed = true;
      try { sessionStorage.setItem('kh_splash', '1'); } catch (e) { /* ignore */ }
      html.classList.remove('splash-on'); s.classList.add('hide'); setTimeout(() => s.remove(), 600);
    };
    setTimeout(close, 4500); s.addEventListener('click', close);
  },
  /* Show validation messages under fields; keys are element ids */
  showErrors(form, errs) {
    $$('.err', form).forEach(e => (e.textContent = ''));
    $$('.invalid', form).forEach(e => e.classList.remove('invalid'));
    Object.entries(errs).forEach(([k, m]) => {
      const s = $(`[data-err="${k}"]`, form); if (s) s.textContent = m;
      const i = $('#' + k, form); if (i) i.classList.add('invalid');
    });
    const first = $('.invalid', form); if (first) first.focus();
  }
};

/* ---------- Store ----------
   patients: permanent records.  visits: one row per patient per day = that day's appointment list. */
const Store = (() => {
  const KEY = 'khatod_hospital_v2';
  let db = null;

  /* Sample data so the calendar and PDF reports can be tried. Marked sample:true so Settings can remove it. */
  function seed() {
    const base = [['Aarav Patil', 'Male', 7, 24], ['Isha Rao', 'Female', 9, 28], ['Vihaan Jadhav', 'Male', 5, 18], ['Omkar Wagh', 'Male', 12, 38],
      ['Zoya Khan', 'Female', 3, 14], ['Anaya Kulkarni', 'Female', 2, 12], ['Reyansh Joshi', 'Male', 6, 21], ['Myra Shah', 'Female', 4, 16],
      ['Kabir Sheikh', 'Male', 10, 31], ['Diya Menon', 'Female', 8, 25], ['Arjun Pawar', 'Male', 11, 35], ['Sara Qureshi', 'Female', 1, 9]];
    const reg = [-9, -9, -8, -8, -7, -6, -5, -4, -3, -2, -1, 0];
    const streets = ['Lake View Road', 'Station Road', 'Market Lane', 'Garden Colony', 'Temple Street', 'Hill Park'];
    const patients = base.map((b, i) => ({
      id: 'KH-' + (1001 + i), name: b[0], gender: b[1], age: b[2], weight: b[3],
      phone: '98' + String(10000000 + i * 1234567).slice(0, 8), email: '',
      address: `${10 + i * 3}, ${streets[i % 6]}, Pune, Maharashtra`,
      emergencyName: `${b[0].split(' ')[1]} (parent)`, emergencyPhone: '97' + String(20000000 + i * 2345671).slice(0, 8),
      regDate: Utils.daysFromToday(reg[i]), sample: true
    }));
    const visits = []; let vn = 0;
    for (let d = -9; d <= 0; d++) {
      const date = Utils.daysFromToday(d);
      const news = patients.filter((_, i) => reg[i] === d), known = patients.filter((_, i) => reg[i] < d);
      const want = Math.min(known.length, 2 + ((d + 9) % 3)), picks = [];
      for (let k = 0; picks.length < want && k < known.length * 2; k++) { const p = known[((d + 9) * 3 + k * 5) % known.length]; if (!picks.includes(p)) picks.push(p); }
      const day = [];
      for (let i = 0; i < Math.max(news.length, picks.length); i++) { if (picks[i]) day.push([picks[i], false]); if (news[i]) day.push([news[i], true]); }
      day.forEach(([p, isNew], idx) => {
        vn++;
        visits.push({ id: 'V-' + vn, patientId: p.id, date, isNew, sample: true, done: d < 0 ? !(d === -2 && idx === day.length - 1) : idx < 2 });
      });
    }
    return { patients, visits, seq: { patient: 1000 + patients.length, visit: vn } };
  }
  const blank = () => ({ patients: [], visits: [], seq: { patient: 1000, visit: 0 } });
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* storage blocked: data lasts for this page only */ } }
  function load() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (e) { raw = null; }
    const ok = raw && Array.isArray(raw.patients) && Array.isArray(raw.visits) && raw.seq;
    db = ok ? raw : seed();
    if (!ok) save();
  }
  load();
  window.addEventListener('storage', e => { if (e.key === KEY) load(); });   // another tab changed the data

  const num = id => Number(String(id).split('-')[1]);
  return {
    patients: () => db.patients,
    patient: id => db.patients.find(p => p.id === id),
    peekPatientId: () => 'KH-' + (db.seq.patient + 1),
    /* New patients always get the next unused ID; IDs are never reused */
    addPatient(p) { p.id = 'KH-' + (++db.seq.patient); db.patients.push(p); save(); return p; },
    updatePatient(id, changes) { Object.assign(Store.patient(id), changes); save(); },
    /* Name, ID or phone search used by the registration dropdown */
    searchPatients(q) {
      q = q.trim().toLowerCase(); if (!q) return [];
      const digits = q.replace(/\D/g, '');
      return db.patients.filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || (digits.length >= 3 && p.phone.replace(/\D/g, '').includes(digits)))
        .sort((a, b) => (b.name.toLowerCase().startsWith(q) - a.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name));
    },
    visits: () => db.visits,
    visitsOn: date => db.visits.filter(v => v.date === date).sort((a, b) => num(a.id) - num(b.id)),   // first added stays on top
    visitsOf: pid => db.visits.filter(v => v.patientId === pid).sort((a, b) => b.date.localeCompare(a.date)),
    hasVisit: (pid, date) => db.visits.some(v => v.patientId === pid && v.date === date),
    addVisit({ patientId, date, isNew }) { const v = { id: 'V-' + (++db.seq.visit), patientId, date, isNew, done: false }; db.visits.push(v); save(); return v; },
    setDone(id, done) { db.visits.find(v => v.id === id).done = done; save(); },
    removeSample() {
      db.visits = db.visits.filter(v => !v.sample);
      db.patients = db.patients.filter(p => !p.sample || db.visits.some(v => v.patientId === p.id));
      save();
    },
    reset() { db = blank(); save(); }
  };
})();

/* ---------- Auth (DEMO ONLY) ----------
   This only shows how each role's screens will look. The staff passwords below sit in the page,
   and anyone can edit them in the browser tools. Real accounts, passwords, SMS codes and role
   checks must live on a server (backend stage). */
const Auth = (() => {
  const KEY = 'kh_auth';
  const STAFF = [
    { email: 'desk@khatod.demo', password: 'desk123', role: 'desk', name: 'Anita Deshmukh', title: 'Desk Manager' },
    { email: 'manager@khatod.demo', password: 'manager123', role: 'manager', name: 'Vikram Rane', title: 'Manager' }
  ];
  const ACCESS = {
    manager: ['dashboard', 'registration', 'appointments', 'patients', 'profile', 'calendar', 'reports'],
    desk: ['registration', 'appointments', 'patients', 'profile'],
    patient: ['myinfo']
  };
  const HOME = { manager: 'index.html', desk: 'pages/appointments.html', patient: 'pages/my-info.html' };
  const get = () => { try { return JSON.parse(sessionStorage.getItem(KEY)); } catch (e) { return null; } };
  const set = o => { try { sessionStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* ignore */ } };
  return {
    session: get,
    role: () => (get() || {}).role,
    canOpen: page => { const s = get(); return !!s && ACCESS[s.role].includes(page); },
    home: root => root + HOME[(get() || { role: 'manager' }).role],
    staffLogin(email, password) {
      const u = STAFF.find(x => x.email === String(email).trim().toLowerCase() && x.password === password);
      if (!u) return null;
      set({ role: u.role, name: u.name, title: u.title }); return u;
    },
    patientLogin(ten) { set({ role: 'patient', phone: ten, name: 'Patient family', title: 'Phone ending ' + ten.slice(-4) }); },
    logout() { try { sessionStorage.removeItem(KEY); sessionStorage.removeItem('kh_splash'); } catch (e) { /* ignore */ } },
    demoAccounts: () => STAFF.map(({ email, password, title }) => ({ email, password, title }))
  };
})();

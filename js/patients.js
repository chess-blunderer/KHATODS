'use strict';
/* patients.js — registration (with returning-patient search), directory and profile */
(() => {
  const canEdit = Auth.role() === 'manager';   // desk managers can add patients but not edit existing records
  /* ----- Shared form markup (registration AND profile edit) ----- */
  const req = ' <span class="req" aria-hidden="true">*</span>';
  const field = (label, id, control, required, cls = '') =>
    `<div class="field ${cls}"><label for="${id}">${label}${required ? req : ''}</label>${control}<small class="err" data-err="${id}"></small></div>`;
  const input = (id, type, val, extra = '') => `<input id="${id}" name="${id}" type="${type}" value="${Utils.esc(val ?? '')}" ${extra}>`;
  const select = (id, opts, val, ph) =>
    `<select id="${id}" name="${id}"><option value="">${ph}</option>${opts.map(o => `<option ${o === val ? 'selected' : ''}>${o}</option>`).join('')}</select>`;

  function formHTML(p, mode) {
    const edit = mode === 'edit';
    const nameCtl = edit ? input('name', 'text', p.name, 'autocomplete="off"')
      : `<div class="ac">${input('name', 'text', p.name, 'autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="acList" placeholder="Start typing to find a returning patient"')}<ul class="ac-list" id="acList" role="listbox" hidden></ul></div>`;
    return `<div class="form-stack">
    <div class="card"><h3 class="form-title">Patient details</h3><div class="form-grid">
      ${field('Patient ID (created automatically)', 'patientId', input('patientId', 'text', p.id, 'readonly'), 0, 'span2')}
      ${field('Full name', 'name', nameCtl, 1)}
      ${field('Phone number', 'phone', input('phone', 'tel', p.phone, 'placeholder="10-digit mobile number"'), 1)}
      ${field('Age (years)', 'age', input('age', 'number', p.age, 'min="0" max="120" step="1" inputmode="numeric"'), 1)}
      ${field('Weight (kg)', 'weight', input('weight', 'number', p.weight, 'min="1" max="500" step="0.1" inputmode="decimal"'), 1)}
      ${field('Gender', 'gender', select('gender', ['Female', 'Male', 'Other'], p.gender, 'Select gender'), 1, 'span2')}
    </div></div>
    <div class="card"><h3 class="form-title">Additional details (optional)</h3><div class="form-grid">
      ${field('Address', 'address', `<textarea id="address" name="address" rows="2">${Utils.esc(p.address || '')}</textarea>`, 0, 'span2')}
      ${field('Email', 'email', input('email', 'email', p.email, 'placeholder="name@example.com"'), 0)}
      ${field('Emergency contact name', 'emergencyName', input('emergencyName', 'text', p.emergencyName), 0)}
      ${field('Emergency contact phone', 'emergencyPhone', input('emergencyPhone', 'tel', p.emergencyPhone, 'placeholder="10-digit mobile number"'), 0)}
    </div></div>
    <div class="form-actions">${edit
      ? '<button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button type="submit" class="btn btn-primary" id="submitBtn"><i data-lucide="check"></i>Save changes</button>'
      : '<button type="button" class="btn btn-ghost" data-clear><i data-lucide="rotate-ccw"></i>Clear form</button><button type="submit" class="btn btn-primary" id="submitBtn"><i data-lucide="user-plus"></i>Register patient</button>'}
    </div></div>`;
  }

  const FIELDS = ['name', 'phone', 'age', 'weight', 'address', 'gender', 'email', 'emergencyName', 'emergencyPhone'];
  const REQUIRED = ['name', 'phone', 'age', 'weight', 'gender'];

  function validate(d) {
    const e = {};
    REQUIRED.forEach(k => { if (!String(d[k] || '').trim()) e[k] = 'This field is required.'; });
    if (!e.name && !/^[A-Za-z][A-Za-z .'-]*$/.test(d.name)) e.name = 'Use letters only.';
    if (!e.phone && !Utils.validPhone(d.phone)) e.phone = 'Enter a valid 10-digit phone number.';
    if (!e.age && !(Number.isInteger(Number(d.age)) && Number(d.age) >= 0 && Number(d.age) <= 120)) e.age = 'Enter age in whole years (0–120).';
    if (!e.weight && !(Number(d.weight) >= 1 && Number(d.weight) <= 500)) e.weight = 'Enter weight in kg (1–500).';
    if (!e.gender && !['Female', 'Male', 'Other'].includes(d.gender)) e.gender = 'Select a gender.';
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) e.email = 'Enter a valid email address.';
    if (d.emergencyPhone && !Utils.validPhone(d.emergencyPhone)) e.emergencyPhone = 'Enter a valid 10-digit phone number.';
    return e;
  }
  const collect = form => {
    const d = Object.fromEntries(new FormData(form)), o = {};
    FIELDS.forEach(k => (o[k] = String(d[k] ?? '').trim()));
    return o;
  };
  const toRecord = c => ({ ...c, age: Number(c.age), weight: Number(c.weight) });

  /* ----- Registration page: new patient OR returning patient, both land in today's list ----- */
  function initRegistration() {
    const form = $('#patientForm'), banner = $('#returningBanner'), result = $('#regResult'), today = Utils.today();
    let selected = null, items = [], active = -1;
    const pre = Utils.qs('patient');
    if (pre && Store.patient(pre)) selected = Store.patient(pre);

    function sync() {
      $('#patientId', form).value = selected ? selected.id : Store.peekPatientId();
      $('#submitBtn', form).innerHTML = selected ? '<i data-lucide="calendar-plus"></i>Add to today\'s list' : '<i data-lucide="user-plus"></i>Register patient';
      const inList = selected && Store.hasVisit(selected.id, today);
      banner.innerHTML = selected ? `<div class="notice info"><span><b>Returning patient ${selected.id}.</b> Their details were filled in; any changes you make will update their record.${inList ? ' <b>They are already in today\'s list.</b>' : ''}</span>
        <button type="button" class="linklike" data-asnew>Register as a new patient instead</button></div>` : '';
      Utils.icons();
    }
    const draw = () => { form.innerHTML = formHTML(selected || { id: Store.peekPatientId() }, 'new'); sync(); };
    const setValues = p => FIELDS.forEach(k => { const el = $('#' + k, form); if (el) el.value = p[k] ?? ''; });
    function hideList() { const l = $('#acList', form); if (l) { l.hidden = true; $('#name', form).setAttribute('aria-expanded', 'false'); } items = []; active = -1; }
    function choose(p) { selected = p; setValues(p); hideList(); sync(); $('#submitBtn', form).focus(); }
    function deselect() { selected = null; setValues({ name: $('#name', form).value }); sync(); }
    function showList(q) {
      items = selected ? [] : Store.searchPatients(q).slice(0, 6); active = -1;
      const l = $('#acList', form);
      l.innerHTML = items.map((p, i) => `<li class="ac-item" role="option" data-id="${p.id}" id="ac${i}"><span><b>${Utils.esc(p.name)}</b><small>${p.id}, ${p.age} yrs, ${Utils.esc(p.phone)}</small></span>${Store.hasVisit(p.id, today) ? '<em class="ac-tag">In today\'s list</em>' : ''}</li>`).join('');
      l.hidden = !items.length; $('#name', form).setAttribute('aria-expanded', String(!!items.length));
    }
    const mark = () => $$('.ac-item', form).forEach((li, i) => li.classList.toggle('active', i === active));

    draw();
    form.addEventListener('input', e => {
      if (e.target.id !== 'name') return;
      const v = e.target.value;
      if (selected && v !== selected.name) deselect();
      showList(v.trim());
    });
    form.addEventListener('keydown', e => {
      if (e.target.id !== 'name' || !items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % items.length; mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + items.length) % items.length; mark(); }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(items[active]); }
      else if (e.key === 'Escape') hideList();
    });
    form.addEventListener('mousedown', e => { const li = e.target.closest('.ac-item'); if (li) { e.preventDefault(); choose(Store.patient(li.dataset.id)); } });
    document.addEventListener('click', e => { if (!e.target.closest('.ac')) hideList(); });
    banner.addEventListener('click', e => { if (e.target.closest('[data-asnew]')) { selected = null; draw(); } });
    form.addEventListener('click', e => { if (e.target.closest('[data-clear]')) { selected = null; draw(); result.innerHTML = ''; Utils.toast('Form cleared.', 'info'); } });

    form.addEventListener('submit', e => {
      e.preventDefault();
      const clean = collect(form), errs = validate(clean);
      if (!Object.keys(errs).length && selected && Store.hasVisit(selected.id, today)) errs.name = 'This patient is already in today\'s list.';
      const n = Object.keys(errs).length;
      Utils.showErrors(form, errs);
      if (n) { Utils.toast(selected && errs.name && n === 1 ? errs.name : `Not added. Fix the ${n} highlighted field${n > 1 ? 's' : ''}.`, 'error'); return; }
      let p; const isNew = !selected;
      if (selected) { Store.updatePatient(selected.id, toRecord(clean)); p = Store.patient(selected.id); }
      else p = Store.addPatient({ ...toRecord(clean), regDate: today });
      Store.addVisit({ patientId: p.id, date: today, isNew });
      const pos = Store.visitsOn(today).length;
      result.innerHTML = `<div class="notice" role="status"><span><b>${Utils.esc(p.name)}</b> ${isNew ? `was registered with ID <b>${p.id}</b> and` : `(${p.id})`} added to today's list as No. ${pos}.</span>
        <span><a href="appointments.html">View today's list</a><a href="patient-profile.html?id=${p.id}">View profile</a></span></div>`;
      Utils.toast(`${p.name} is No. ${pos} in today's list.`, 'success');
      selected = null; draw(); window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ----- Patient directory ----- */
  function initDirectory() {
    const PER = 8;
    const st = { q: Utils.qs('q') || '', sort: 'regDate', dir: 'desc', page: 1 };
    const body = $('#patientRows'), search = $('#dirSearch'), sortSel = $('#sortSelect');
    search.value = st.q;
    if (Utils.qs('focus')) search.focus();
    const idNum = p => Number(p.id.split('-')[1]);
    const key = { name: p => p.name.toLowerCase(), id: idNum, age: p => p.age, gender: p => p.gender || '', regDate: p => p.regDate };

    function filtered() {
      const q = st.q.toLowerCase();
      const list = Store.patients().filter(p => !q || `${p.name} ${p.id} ${p.phone}`.toLowerCase().includes(q));
      const k = key[st.sort], m = st.dir === 'asc' ? 1 : -1;
      return list.sort((a, b) => (k(a) > k(b) ? m : k(a) < k(b) ? -m : idNum(b) - idNum(a)));
    }
    function render() {
      const list = filtered(), pages = Math.max(1, Math.ceil(list.length / PER));
      st.page = Math.min(st.page, pages);
      const rows = list.slice((st.page - 1) * PER, st.page * PER);
      body.innerHTML = rows.map(p => `<tr>
        <td>${p.id}</td>
        <td><div class="person"><span class="avatar">${Utils.initials(p.name)}</span><a href="patient-profile.html?id=${p.id}">${Utils.esc(p.name)}</a></div></td>
        <td>${p.age}</td><td>${p.weight} kg</td><td>${p.gender || '—'}</td><td>${Utils.esc(p.phone)}</td><td>${Utils.fmtDate(p.regDate)}</td>
        <td><div class="row-actions">
          <a class="btn btn-ghost btn-sm" href="patient-profile.html?id=${p.id}"><i data-lucide="eye"></i>View profile</a>
          ${canEdit ? `<a class="btn btn-ghost btn-sm" href="patient-profile.html?id=${p.id}&edit=1"><i data-lucide="pencil"></i>Edit</a>` : ''}</div></td></tr>`).join('');
      $('#emptyState').innerHTML = rows.length ? '' : (Store.patients().length
        ? Utils.empty('search-x', 'No patients found', 'Try a different name, ID or phone number.', '<button class="btn btn-ghost" id="clearFilters">Clear search</button>')
        : Utils.empty('users', 'No patients registered yet', 'Registered patients will appear here.', '<a class="btn btn-primary" href="registration.html">Register the first patient</a>'));
      $$('th[data-sort] .arrow').forEach(a => (a.textContent = ''));
      const th = $(`th[data-sort="${st.sort}"] .arrow`); if (th) th.textContent = st.dir === 'asc' ? ' ▲' : ' ▼';
      sortSel.value = st.sort + ':' + st.dir;
      $('#pageInfo').textContent = list.length ? `Showing ${(st.page - 1) * PER + 1}–${(st.page - 1) * PER + rows.length} of ${list.length} patients` : '0 patients';
      $('#pager').innerHTML = list.length ? `<button data-p="${st.page - 1}" ${st.page === 1 ? 'disabled' : ''} aria-label="Previous page"><i data-lucide="chevron-left"></i></button>` +
        Array.from({ length: pages }, (_, i) => `<button data-p="${i + 1}" class="${i + 1 === st.page ? 'active' : ''}">${i + 1}</button>`).join('') +
        `<button data-p="${st.page + 1}" ${st.page === pages ? 'disabled' : ''} aria-label="Next page"><i data-lucide="chevron-right"></i></button>` : '';
      Utils.icons();
    }
    body.innerHTML = Utils.skeletonRows(8);           // loading state
    setTimeout(render, 350);
    search.addEventListener('input', () => { st.q = search.value.trim(); st.page = 1; render(); });
    sortSel.addEventListener('change', () => { [st.sort, st.dir] = sortSel.value.split(':'); st.page = 1; render(); });
    $('#pager').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b && !b.disabled) { st.page = Number(b.dataset.p); render(); } });
    $('#patientTable thead').addEventListener('click', e => {
      const th = e.target.closest('th[data-sort]'); if (!th) return;
      st.dir = st.sort === th.dataset.sort && st.dir === 'asc' ? 'desc' : 'asc'; st.sort = th.dataset.sort; render();
    });
    $('#emptyState').addEventListener('click', e => { if (e.target.closest('#clearFilters')) { st.q = ''; search.value = ''; render(); } });
  }

  /* ----- Patient profile ----- */
  function initProfile() {
    const root = $('#profile'), id = Utils.qs('id'), p = Store.patient(id);
    if (!p) {
      root.innerHTML = `<div class="card">${Utils.empty('user-x', 'Patient not found', `No patient has the ID “${Utils.esc(id || '')}”. Open the directory to pick a patient.`,
        '<a class="btn btn-primary" href="patients.html">Go to patients</a>')}</div>`;
      Utils.icons(); return;
    }
    const row = (l, v) => `<dt>${l}</dt><dd>${v || '—'}</dd>`;
    function view() {
      const visits = Store.visitsOf(p.id);
      root.innerHTML = `
      <div class="card profile-head"><span class="avatar lg">${Utils.initials(p.name)}</span>
        <div class="grow"><h2>${Utils.esc(p.name)}</h2>
          <div class="tags"><span class="badge">${p.id}</span><span class="badge amber">${p.age} years, ${p.weight} kg</span></div></div>
        <div class="actions"><a class="btn btn-ghost" href="registration.html?patient=${p.id}"><i data-lucide="calendar-plus"></i>Register again today</a>
          ${canEdit ? '<button class="btn btn-primary" id="editBtn"><i data-lucide="pencil"></i>Edit information</button>' : ''}</div></div>
      <div class="info-grid">
        <div class="card"><div class="card-head"><h3>Personal details</h3></div><dl class="info">${row('Full name', Utils.esc(p.name))}${row('Age', p.age + ' years')}${row('Weight', p.weight + ' kg')}${row('Gender', p.gender)}</dl></div>
        <div class="card"><div class="card-head"><h3>Contact details</h3></div><dl class="info">${row('Phone', Utils.esc(p.phone))}${row('Email', Utils.esc(p.email))}${row('Address', Utils.esc(p.address))}${row('Emergency contact', Utils.esc(p.emergencyName))}${row('Emergency phone', Utils.esc(p.emergencyPhone))}</dl></div>
        <div class="card"><div class="card-head"><h3>Registration information</h3></div><dl class="info">${row('Patient ID', p.id)}${row('First registered', Utils.fmtDate(p.regDate))}${row('Total visits', visits.length)}</dl></div>
        <div class="card"><div class="card-head"><h3>Visit history</h3></div>
          ${visits.length ? `<ul class="mini-list">${visits.map(v => `<li><span>${Utils.fmtDate(v.date)}</span><span class="badge ${v.done ? 'teal' : 'amber'}">${v.done ? 'Seen' : 'Not seen'}</span></li>`).join('')}</ul>`
            : '<p class="muted">No visits yet.</p>'}</div>
      </div>`;
      if ($('#editBtn')) $('#editBtn').onclick = edit; Utils.icons();
    }
    function edit() {
      root.innerHTML = `<div class="page-head" style="margin-bottom:14px"><div><h2>Edit ${Utils.esc(p.name)}</h2><p>Changes are saved in this browser.</p></div></div><form id="editForm" novalidate>${formHTML(p, 'edit')}</form>`;
      const form = $('#editForm'); Utils.icons();
      form.addEventListener('click', e => { if (e.target.closest('[data-cancel]')) view(); });
      form.addEventListener('submit', e => {
        e.preventDefault();
        const clean = collect(form), errs = validate(clean), n = Object.keys(errs).length;
        Utils.showErrors(form, errs);
        if (n) { Utils.toast(`Changes not saved. Fix the ${n} highlighted field${n > 1 ? 's' : ''}.`, 'error'); return; }
        Store.updatePatient(p.id, toRecord(clean)); Utils.toast('Patient information updated.', 'success'); view();
      });
    }
    if (canEdit && Utils.qs('edit')) edit(); else view();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;
    if (page === 'registration') initRegistration();
    if (page === 'patients') initDirectory();
    if (page === 'profile') initProfile();
  });
})();

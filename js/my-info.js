'use strict';
/* my-info.js — what a patient sees after logging in: only the records linked to their phone number
   and their own place in today's list (other patients' names are never shown). */
(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const sess = Auth.session();
    if (!sess || sess.role !== 'patient') return;
    const ten = sess.phone, today = Utils.today();
    let curId = null;
    const row = (l, v) => `<dt>${l}</dt><dd>${v || '—'}</dd>`;
    const mine = () => Store.patients().filter(p => p.phone.replace(/\D/g, '').slice(-10) === ten);

    function render() {
      const kids = mine();
      $('#myPhone').textContent = `Showing records linked to the number ending ${ten.slice(-4)}.`;
      if (!kids.length) {
        $('#kidTabs').innerHTML = '';
        $('#myInfo').innerHTML = `<div class="card">${Utils.empty('user-x', 'No record found', 'No patient record is linked to this number. Please visit the hospital desk.')}</div>`;
        Utils.icons(); return;
      }
      if (!kids.some(k => k.id === curId)) curId = kids[0].id;
      $('#kidTabs').innerHTML = kids.length > 1 ? kids.map(k => `<button class="chip ${k.id === curId ? 'active' : ''}" data-id="${k.id}">${Utils.esc(k.name)}</button>`).join('') : '';
      const p = kids.find(k => k.id === curId), name = Utils.esc(p.name);
      const list = Store.visitsOn(today), idx = list.findIndex(v => v.patientId === p.id);
      let status;
      if (idx < 0) status = `<h3>${name} is not in today's list</h3><p class="muted">If you are at the hospital, please tell the desk so they can register you for today.</p>`;
      else if (list[idx].done) status = `<h3>${name} has been seen today</h3><p class="muted">Thank you for visiting Khatod Hospital.</p>`;
      else {
        const ahead = list.slice(0, idx).filter(v => !v.done).length;
        status = `<h3>${name} is No. ${idx + 1} in today's list</h3><p class="muted">${ahead === 0 ? 'You are next.' : `${ahead} patient${ahead > 1 ? 's are' : ' is'} ahead of you.`} Press Refresh to see the latest.</p>`;
      }
      const visits = Store.visitsOf(p.id);
      $('#myInfo').innerHTML = `
        <div class="card status-card" style="margin-bottom:18px">${idx >= 0 && !list[idx].done ? `<div class="big-no">${idx + 1}</div>` : ''}<div>${status}</div></div>
        <div class="info-grid">
          <div class="card"><div class="card-head"><h3>Patient information</h3></div><dl class="info">${row('Patient ID', p.id)}${row('Name', name)}${row('Age', p.age + ' years')}${row('Weight', p.weight + ' kg')}${row('Gender', p.gender)}${row('Phone', Utils.esc(p.phone))}${row('Address', Utils.esc(p.address))}</dl></div>
          <div class="card"><div class="card-head"><h3>Visit history</h3></div>
            ${visits.length ? `<ul class="mini-list">${visits.map(v => `<li><span>${Utils.fmtDate(v.date)}</span><span class="badge ${v.done ? 'teal' : 'amber'}">${v.done ? 'Seen' : 'Not seen'}</span></li>`).join('')}</ul>` : '<p class="muted">No visits yet.</p>'}</div>
        </div>`;
      Utils.icons();
    }
    $('#kidTabs').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) { curId = b.dataset.id; render(); } });
    $('#refreshBtn').onclick = () => { render(); Utils.toast('Updated.', 'success'); };
    render();
  });
})();

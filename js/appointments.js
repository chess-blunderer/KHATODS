'use strict';
/* appointments.js — today's appointment list. Patients are added by registering them;
   the first one added stays on top. Ticking a box strikes the name out but keeps the record. */
(() => {
  let q = '';
  const today = Utils.today();

  function render() {
    const all = Store.visitsOn(today), seen = all.filter(v => v.done).length;
    const list = all.filter(v => { const p = Store.patient(v.patientId); return !q || `${p ? p.name : ''} ${v.patientId}`.toLowerCase().includes(q.toLowerCase()); });
    $('#apptRows').innerHTML = list.map(v => {
      const p = Store.patient(v.patientId) || { name: 'Unknown patient', age: '—', weight: '—' };
      return `<tr class="${v.done ? 'done' : ''}">
        <td class="pos">${all.indexOf(v) + 1}</td>
        <td><input type="checkbox" class="strike" data-id="${v.id}" ${v.done ? 'checked' : ''} aria-label="Strike out ${Utils.esc(p.name)}"></td>
        <td><div class="person"><span class="avatar">${Utils.initials(p.name)}</span><a class="pname" href="patient-profile.html?id=${v.patientId}">${Utils.esc(p.name)}</a></div></td>
        <td>${v.patientId}</td><td>${p.age} yrs, ${p.weight} kg</td>
        <td><span class="badge ${v.isNew ? 'teal' : ''}">${v.isNew ? 'New' : 'Returning'}</span></td></tr>`;
    }).join('');
    $('#queueSummary').textContent = all.length ? `${all.length - seen} waiting, ${seen} struck out, ${all.length} in total` : '';
    $('#apptEmpty').innerHTML = list.length ? '' : (all.length
      ? Utils.empty('search-x', 'No match', 'No one in today\'s list matches that search.')
      : Utils.empty('calendar-check', 'Nobody in today\'s list yet', 'Register a patient and they will appear here automatically. The first patient added stays at the top.',
        '<a class="btn btn-primary" href="registration.html">Register a patient</a>'));
    Utils.icons();
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('#dateLabel').textContent = Utils.fmtLong(today);
    $('#apptRows').innerHTML = Utils.skeletonRows(6);   // loading state
    setTimeout(render, 300);
    $('#apptSearch').addEventListener('input', e => { q = e.target.value.trim(); render(); });
    $('#apptRows').addEventListener('change', e => { const c = e.target.closest('.strike'); if (c) { Store.setDone(c.dataset.id, c.checked); render(); } });
    const guard = fn => () => (Store.visitsOn(today).length ? fn(today) : Utils.toast('Today\'s list is empty, so there is nothing to put in a report yet.', 'error'));
    if (Auth.role() === 'manager') { $('#viewPdf').onclick = guard(Report.view); $('#downloadPdf').onclick = guard(Report.download); }
    else { $('#viewPdf').remove(); $('#downloadPdf').remove(); }   // reports are for managers
  });
})();

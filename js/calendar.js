'use strict';
/* calendar.js — month calendar; pick a date to view or download that day's PDF report */
(() => {
  const today = Utils.today(), d0 = Utils.parse(today);
  const st = { y: d0.getFullYear(), m: d0.getMonth(), sel: today };
  const counts = () => Store.visits().reduce((m, v) => { m[v.date] = (m[v.date] || 0) + 1; return m; }, {});

  function renderGrid() {
    const c = counts(), first = new Date(st.y, st.m, 1), days = new Date(st.y, st.m + 1, 0).getDate();
    $('#calTitle').textContent = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    let html = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div class="cal-dow">${d}</div>`).join('') + '<span class="cal-day empty"></span>'.repeat(first.getDay());
    let total = 0;
    for (let d = 1; d <= days; d++) {
      const iso = `${st.y}-${Utils.pad(st.m + 1)}-${Utils.pad(d)}`, n = c[iso] || 0; total += n;
      html += `<button type="button" class="cal-day ${iso === today ? 'today' : ''} ${iso === st.sel ? 'sel' : ''} ${iso > today ? 'future' : ''}" data-date="${iso}" aria-pressed="${iso === st.sel}" aria-label="${Utils.fmtDate(iso)}${n ? ', ' + n + ' patients' : ''}"><span>${d}</span>${n ? `<span class="cal-count">${n}</span>` : ''}</button>`;
    }
    $('#calGrid').innerHTML = html;
    $('#calMonthInfo').textContent = total ? `${total} patient visit${total > 1 ? 's' : ''} this month. The number on a date is how many patients were listed.` : 'No patients were listed this month.';
  }

  function renderDay() {
    const v = Store.visitsOn(st.sel), seen = v.filter(x => x.done).length, fresh = v.filter(x => x.isNew).length;
    let html = `<div class="card-head"><div><h3>${Utils.fmtLong(st.sel)}</h3>${st.sel === today ? '<p>Today. The report shows the list so far.</p>' : ''}</div></div>`;
    if (st.sel > today) html += Utils.empty('calendar', 'This date has not come yet', 'Reports are available for today and earlier dates.');
    else if (!v.length) html += Utils.empty('calendar-x', 'No patients listed', 'Nobody was added to the appointment list on this day, so there is no report.');
    else {
      html += `<div class="day-stats"><div><b>${v.length}</b><span>Patients</span></div><div><b>${seen}</b><span>Seen</span></div><div><b>${fresh}</b><span>New</span></div></div>
        <ol class="day-list">${v.map(x => { const p = Store.patient(x.patientId); return `<li class="${x.done ? 'done' : ''}"><span>${Utils.esc(p ? p.name : 'Unknown patient')}</span><small>${x.patientId}</small></li>`; }).join('')}</ol>
        <div class="actions"><button class="btn btn-primary" data-act="view"><i data-lucide="file-text"></i>View PDF</button>
        <button class="btn btn-ghost" data-act="download"><i data-lucide="download"></i>Download PDF</button></div>`;
    }
    $('#dayPanel').innerHTML = html; Utils.icons();
  }
  const refresh = () => { renderGrid(); renderDay(); };
  const shift = n => { const d = new Date(st.y, st.m + n, 1); st.y = d.getFullYear(); st.m = d.getMonth(); renderGrid(); };

  document.addEventListener('DOMContentLoaded', () => {
    refresh();
    $('#calPrev').onclick = () => shift(-1);
    $('#calNext').onclick = () => shift(1);
    $('#calToday').onclick = () => { st.y = d0.getFullYear(); st.m = d0.getMonth(); st.sel = today; refresh(); };
    $('#calGrid').addEventListener('click', e => { const b = e.target.closest('[data-date]'); if (b) { st.sel = b.dataset.date; refresh(); } });
    $('#dayPanel').addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'view') Report.view(st.sel); else Report.download(st.sel);
    });
  });
})();

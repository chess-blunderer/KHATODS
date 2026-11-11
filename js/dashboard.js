'use strict';
/* dashboard.js — statistics and simple charts for the Dashboard and Reports pages.
   Charts are plain HTML/CSS so no charting library is needed. */
(() => {
  const countBy = (list, fn) => list.reduce((m, x) => { const k = fn(x); m[k] = (m[k] || 0) + 1; return m; }, {});

  function bars(el, labels, values, cls = '') {
    const max = Math.max(1, ...values);
    el.innerHTML = `<div class="bars">${values.map((v, i) => `<div class="bar-col"><span class="val">${v}</span><div class="bar ${cls}" style="height:${Math.round(v / max * 140)}px"></div><span class="lbl">${labels[i]}</span></div>`).join('')}</div>`;
  }
  function donut(el, data, colors, unit) {
    const entries = Object.entries(data), total = entries.reduce((s, [, v]) => s + v, 0);
    let acc = 0;
    const stops = total ? entries.map(([k, v]) => { const a = acc / total * 100; acc += v; return `${colors[k]} ${a}% ${acc / total * 100}%`; }).join(',') : '#E8EEF4 0 100%';
    el.innerHTML = `<div class="donut-wrap"><div class="donut" style="background:conic-gradient(${stops})"><span>${total}<small>${unit}</small></span></div>
      <ul class="legend">${entries.map(([k, v]) => `<li><i style="background:${colors[k]}"></i>${k}<b>${v}</b></li>`).join('')}</ul></div>`;
  }
  const lastDays = n => Array.from({ length: n }, (_, i) => Utils.daysFromToday(i - n + 1));
  const dayLabel = s => { const d = Utils.parse(s); return `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`; };

  function dashboard() {
    const pts = Store.patients(), today = Utils.today(), list = Store.visitsOn(today);
    const todayN = pts.filter(p => p.regDate === today).length, yest = pts.filter(p => p.regDate === Utils.daysFromToday(-1)).length;
    const waiting = list.filter(v => !v.done);
    const stat = (cls, icon, num, lbl, sub) => `<div class="card stat"><span class="ico ${cls}"><i data-lucide="${icon}"></i></span><div><div class="num">${num}</div><div class="lbl">${lbl}</div><div class="sub">${sub}</div></div></div>`;
    $('#stats').innerHTML =
      stat('', 'users', pts.length, 'Total patients', 'All registered patients') +
      stat('teal', 'user-plus', todayN, 'New patients today', `${yest} registered yesterday`) +
      stat('navy', 'calendar-check', list.length, 'In today\'s list', `${list.length - waiting.length} struck out as seen`) +
      stat('amber', 'clock', waiting.length, 'Waiting today', 'Still to be seen');

    const days = lastDays(7), reg = countBy(pts, p => p.regDate);
    bars($('#trendChart'), days.map(dayLabel), days.map(d => reg[d] || 0));

    $('#todayList').innerHTML = waiting.length
      ? `<ul class="mini-list">${waiting.slice(0, 6).map(v => { const p = Store.patient(v.patientId); return `<li><span><span class="pos">${list.indexOf(v) + 1}.</span> ${Utils.esc(p ? p.name : 'Unknown patient')}</span><a href="pages/patient-profile.html?id=${v.patientId}">View</a></li>`; }).join('')}</ul>`
      : Utils.empty('calendar-check', 'Nobody waiting', 'Patients appear here as soon as they are registered.', '<a class="btn btn-ghost btn-sm" href="pages/registration.html">Register a patient</a>');

    const recent = pts.slice().sort((a, b) => b.regDate.localeCompare(a.regDate) || Number(b.id.slice(3)) - Number(a.id.slice(3))).slice(0, 6);
    $('#recentBody').innerHTML = recent.map(p => `<tr>
      <td>${p.id}</td><td><div class="person"><span class="avatar">${Utils.initials(p.name)}</span><a href="pages/patient-profile.html?id=${p.id}">${Utils.esc(p.name)}</a></div></td>
      <td>${p.age}</td><td>${Utils.fmtDate(p.regDate)}</td></tr>`).join('');
    $('#recentEmpty').innerHTML = recent.length ? '' : Utils.empty('users', 'No patients registered yet', 'New registrations will appear here.', '<a class="btn btn-primary btn-sm" href="pages/registration.html">Register a patient</a>');
    $('#todayLabel').textContent = Utils.fmtLong(today);
  }

  function reports() {
    const pts = Store.patients(), vs = Store.visits();
    const days = lastDays(14), reg = countBy(pts, p => p.regDate), perDay = countBy(vs, v => v.date);
    bars($('#dailyChart'), days.map(dayLabel), days.map(d => reg[d] || 0));
    const now = new Date(), months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1));
    const byMonth = countBy(pts, p => p.regDate.slice(0, 7));
    bars($('#monthlyChart'), months.map(m => m.toLocaleDateString('en-GB', { month: 'short' })), months.map(m => byMonth[`${m.getFullYear()}-${Utils.pad(m.getMonth() + 1)}`] || 0), 'teal');
    bars($('#visitDays'), days.map(dayLabel), days.map(d => perDay[d] || 0));
    donut($('#typeChart'), { 'New patients': vs.filter(v => v.isNew).length, 'Returning patients': vs.filter(v => !v.isNew).length }, { 'New patients': '#2A9D8F', 'Returning patients': '#2583C5' }, 'visits');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;
    if (page === 'dashboard') dashboard();
    if (page === 'reports') reports();
    Utils.icons();
  });
})();

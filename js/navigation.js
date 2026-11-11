'use strict';
/* navigation.js — access check, sidebar and header on every page (menus depend on the role) */
(() => {
  const NAV = {
    manager: [['dashboard', 'index.html', 'layout-dashboard', 'Dashboard'], ['registration', 'pages/registration.html', 'user-plus', 'Patient Registration'],
      ['appointments', 'pages/appointments.html', 'calendar-check', 'Appointments'], ['patients', 'pages/patients.html', 'users', 'Patients'],
      ['calendar', 'pages/calendar.html', 'calendar-days', 'Calendar'], ['reports', 'pages/reports.html', 'trending-up', 'Reports']],
    desk: [['registration', 'pages/registration.html', 'user-plus', 'Patient Registration'], ['appointments', 'pages/appointments.html', 'calendar-check', 'Appointments'],
      ['patients', 'pages/patients.html', 'users', 'Patients']],
    patient: [['myinfo', 'pages/my-info.html', 'user-round', 'My information']]
  };

  document.addEventListener('DOMContentLoaded', () => {
    const body = document.body, root = body.dataset.root || '', page = body.dataset.page, title = body.dataset.title;
    const sess = Auth.session();
    if (!sess) { location.replace(root + 'login.html'); return; }          // not logged in
    if (!Auth.canOpen(page)) { location.replace(Auth.home(root)); return; } // this role may not open this page
    const role = sess.role, staff = role !== 'patient';

    const link = ([key, href, icon, label]) => {
      const active = page === key || (key === 'patients' && page === 'profile');
      return `<a href="${root}${href}" class="${active ? 'active' : ''}" ${active ? 'aria-current="page"' : ''}><i data-lucide="${icon}"></i>${label}</a>`;
    };
    $('#sidebar').innerHTML = `
      <div class="brand"><span class="logo"><i data-lucide="heart-pulse"></i></span><div><span class="brand-name">Khatod Hospital</span><small>You are in safe hands.</small></div></div>
      <nav class="nav">${NAV[role].map(link).join('')}</nav>
      <div class="nav-bottom">
        ${role === 'manager' ? '<button id="settingsBtn"><i data-lucide="settings"></i>Settings</button>' : ''}
        <button id="logoutBtn"><i data-lucide="log-out"></i>Logout</button>
      </div>`;

    const [pName, pHref] = (body.dataset.parent || '').split('|');
    $('#topbar').innerHTML = `
      <button class="icon-btn menu-btn" id="menuBtn" aria-label="Open menu"><i data-lucide="menu"></i></button>
      <div class="titles"><h1>${title}</h1>
        <nav class="crumbs" aria-label="Breadcrumb"><a href="${Auth.home(root)}">Home</a> / ${pName ? `<a href="${pHref}">${pName}</a> / ` : ''}<span>${title}</span></nav></div>
      ${staff ? `<form class="search" id="globalSearch" role="search"><i data-lucide="search"></i><input type="search" placeholder="Search patients by name, ID or phone" aria-label="Search patients"></form>
      <button class="icon-btn search-toggle" id="searchToggle" aria-label="Search"><i data-lucide="search"></i></button>
      <div class="notif-wrap"><button class="icon-btn" id="bellBtn" aria-label="Notifications" aria-haspopup="dialog" aria-expanded="false"><i data-lucide="bell"></i><span class="dot"></span></button>
        <div class="notif-pop" id="notifPop" role="dialog" aria-label="Notifications" hidden></div></div>` : ''}
      <div class="user"><div class="avatar">${Utils.initials(sess.name)}</div><div class="user-meta"><b>${Utils.esc(sess.name)}</b><span>${Utils.esc(sess.title)}</span></div></div>`;
    Utils.icons();
    Utils.splash();

    const sidebar = $('#sidebar'), backdrop = $('#backdrop');
    const setMenu = open => { sidebar.classList.toggle('open', open); backdrop.classList.toggle('show', open); };
    $('#menuBtn').onclick = () => setMenu(true);
    backdrop.onclick = () => setMenu(false);

    let closeNotif = () => {};   // set below for staff; also used by the Escape key
    if (staff) {
      $('#searchToggle').onclick = () => { $('#topbar').classList.toggle('search-open'); $('#globalSearch input').focus(); };
      $('#globalSearch').addEventListener('submit', e => {
        e.preventDefault();
        location.href = `${root}pages/patients.html?q=${encodeURIComponent($('input', e.target).value.trim())}`;
      });

      /* Notification pop-up: opens from the bell, closes when you click anywhere outside it */
      const bell = $('#bellBtn'), pop = $('#notifPop');
      const todays = () => Store.visitsOn(Utils.today());
      if (!todays().some(v => !v.done)) { const dot = $('.dot', bell); if (dot) dot.remove(); }
      function notifHTML() {
        const list = todays(), waiting = list.filter(v => !v.done).length, seen = list.length - waiting;
        const fresh = Store.patients().filter(p => p.regDate === Utils.today()).length;
        const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
        const item = (cls, icon, title, sub) => `<li class="notif-item"><span class="n-ico ${cls}"><i data-lucide="${icon}"></i></span><div><b>${title}</b><small>${sub}</small></div></li>`;
        const items = [];
        if (waiting) items.push(item('amber', 'clock', `${plural(waiting, 'patient')} waiting`, 'In today\'s appointment list'));
        if (fresh) items.push(item('teal', 'user-plus', `${plural(fresh, 'new patient')} registered today`, 'Added to today\'s list'));
        if (seen) items.push(item('blue', 'circle-check', `${plural(seen, 'patient')} seen today`, 'Struck out in the list'));
        if (!items.length) items.push(item('blue', 'bell', 'You are all caught up', 'Nothing new in today\'s list'));
        return `<div class="notif-head"><b>Notifications</b><span>Today</span></div><ul class="notif-list">${items.join('')}</ul>
          <a class="notif-foot" href="${root}pages/appointments.html">Open today's list</a>`;
      }
      const setPop = open => {
        pop.hidden = !open; bell.setAttribute('aria-expanded', String(open));
        if (open) { pop.innerHTML = notifHTML(); Utils.icons(); const dot = $('.dot', bell); if (dot) dot.remove(); }
      };
      closeNotif = () => setPop(false);
      bell.addEventListener('click', () => setPop(pop.hidden));                       // bell toggles the pop-up
      document.addEventListener('click', e => {                                        // click anywhere else closes it
        if (!pop.hidden && !pop.contains(e.target) && !bell.contains(e.target)) setPop(false);
      });
    }

    const confirmDo = (title, text, label, fn) => Utils.modal(title, `<p>${text}</p>`,
      [{ label: 'Cancel' }, { label, cls: 'btn-danger', fn: () => { fn(); Utils.closeModal(); setTimeout(() => location.reload(), 700); } }]);
    if (role === 'manager') $('#settingsBtn').onclick = () => Utils.modal('Settings',
      `<p class="muted" style="margin-bottom:12px">Patients and daily lists are saved in this browser on this computer. They are not sent to a server and other computers cannot see them.</p>
       <p style="margin-bottom:8px"><b>Remove sample data</b> deletes only the example patients and visits that came with the system.</p>
       <p><b>Delete all data</b> removes everything, including patients you registered. This cannot be undone.</p>`,
      [{ label: 'Close' },
       { label: 'Remove sample data', fn: () => confirmDo('Remove sample data?', 'The example patients and their visits will be removed. Anything you registered yourself stays.', 'Remove sample data', () => { Store.removeSample(); Utils.toast('Sample data removed.', 'success'); }) },
       { label: 'Delete all data', cls: 'btn-danger', fn: () => confirmDo('Delete all data?', 'Every patient and every daily list will be permanently removed from this browser.', 'Yes, delete everything', () => { Store.reset(); Utils.toast('All data deleted.', 'success'); }) }]);

    $('#logoutBtn').onclick = () => Utils.modal('Log out?', '<p>You will return to the login screen.</p>',
      [{ label: 'Stay signed in' }, { label: 'Log out', cls: 'btn-primary', fn: () => { Auth.logout(); location.href = root + 'login.html'; } }]);

    document.addEventListener('keydown', e => { if (e.key === 'Escape') { Utils.closeModal(); setMenu(false); closeNotif(); } });
  });
})();

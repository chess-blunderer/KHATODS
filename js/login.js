'use strict';
/* login.js — patient login (phone number, then a 6-digit code) and staff login.
   DEMO: the "SMS" is shown on screen. In the real system the server sends it and checks it. */
(() => {
  const TTL = 5 * 60 * 1000, MAX_TRIES = 3, RESEND_SECONDS = 30;
  const last10 = v => String(v).replace(/\D/g, '').slice(-10);
  const masked = ten => `+91 ${ten.slice(0, 2)}XXX XX${ten.slice(-3)}`;

  document.addEventListener('DOMContentLoaded', () => {
    Utils.splash();
    if (Auth.session()) { location.replace(Auth.home('')); return; }       // already logged in

    const phoneForm = $('#phoneForm'), otpForm = $('#otpForm'), staffForm = $('#staffForm');
    let otp = null, timer = null, fails = 0, lockedUntil = 0;

    /* Tabs */
    $$('.tab').forEach(t => t.addEventListener('click', () => {
      $$('.tab').forEach(x => { x.classList.toggle('active', x === t); x.setAttribute('aria-selected', x === t); });
      $('#patientPane').hidden = t.dataset.tab !== 'patient'; $('#staffPane').hidden = t.dataset.tab !== 'staff';
    }));

    /* ----- Patient: step 1, phone number ----- */
    const sample = Store.patients().find(p => p.sample) || Store.patients()[0];
    if (sample) $('#phoneTip').innerHTML = `Demo tip: try <b>${Utils.esc(sample.phone)}</b>, a number on a patient record.`;

    function sendCode(ten) {
      const matches = Store.patients().filter(p => last10(p.phone) === ten);
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000);
      otp = { ten, code: matches.length ? code : null, expires: Date.now() + TTL, tries: 0 };
      $('#demoBox').innerHTML = matches.length
        ? `<b>Demo only.</b> In the real system this text arrives by SMS:<br><span class="demo-sms">Khatod Hospital: your login code is <b>${code}</b>. It is valid for 5 minutes.</span>`
        : '<b>Demo only.</b> This number is not on any patient record, so no SMS would be sent. The real system shows this same screen either way, so nobody can find out which numbers are registered.';
      $('#demoBox').hidden = false;
      let s = RESEND_SECONDS; const btn = $('#resendBtn');
      clearInterval(timer); btn.disabled = true; btn.textContent = `Resend code in ${s}s`;
      timer = setInterval(() => { s--; if (s <= 0) { clearInterval(timer); btn.disabled = false; btn.textContent = 'Resend code'; } else btn.textContent = `Resend code in ${s}s`; }, 1000);
    }
    phoneForm.addEventListener('submit', e => {
      e.preventDefault();
      const v = $('#phone').value, digits = v.replace(/\D/g, '');
      if (!Utils.validPhone(v) || digits.length < 10) { Utils.showErrors(phoneForm, { phone: 'Enter a valid 10-digit mobile number.' }); return; }
      Utils.showErrors(phoneForm, {});
      const ten = last10(v); sendCode(ten);
      $('#otpSub').textContent = `If ${masked(ten)} is registered with the hospital, a 6-digit code has been sent to it.`;
      phoneForm.hidden = true; otpForm.hidden = false; $('#otp').value = ''; Utils.showErrors(otpForm, {}); $('#otp').focus();
    });

    /* ----- Patient: step 2, enter the code ----- */
    otpForm.addEventListener('submit', e => {
      e.preventDefault();
      const v = $('#otp').value.trim();
      if (!otp) { backToPhone('Please request a new code.'); return; }
      if (!/^\d{6}$/.test(v)) { Utils.showErrors(otpForm, { otp: 'Enter the 6-digit code.' }); return; }
      if (Date.now() > otp.expires) { Utils.showErrors(otpForm, { otp: 'This code has expired. Send a new code.' }); return; }
      if (!otp.code || v !== otp.code) {
        otp.tries++;
        if (otp.tries >= MAX_TRIES) { backToPhone('Too many wrong attempts. Please request a new code.'); return; }
        const left = MAX_TRIES - otp.tries;
        Utils.showErrors(otpForm, { otp: `Incorrect code. ${left} attempt${left > 1 ? 's' : ''} left.` }); return;
      }
      Auth.patientLogin(otp.ten);
      location.href = 'pages/my-info.html';
    });
    function backToPhone(msg) {
      clearInterval(timer); otp = null; otpForm.hidden = true; phoneForm.hidden = false; $('#demoBox').hidden = true;
      Utils.showErrors(phoneForm, { phone: msg });
    }
    $('#resendBtn').addEventListener('click', () => { if (otp && !$('#resendBtn').disabled) { sendCode(otp.ten); Utils.showErrors(otpForm, {}); $('#otp').value = ''; $('#otp').focus(); } });
    $('#changeNum').addEventListener('click', () => backToPhone(''));

    /* ----- Staff ----- */
    $('#demoAccounts').innerHTML = Auth.demoAccounts().map(a =>
      `<div><b>${a.title}:</b> ${a.email} / ${a.password} <button type="button" class="linklike" data-email="${a.email}" data-pass="${a.password}">Fill in</button></div>`).join('');
    $('#demoAccounts').addEventListener('click', e => { const b = e.target.closest('[data-email]'); if (b) { $('#email').value = b.dataset.email; $('#password').value = b.dataset.pass; } });
    staffForm.addEventListener('submit', e => {
      e.preventDefault();
      if (Date.now() < lockedUntil) { Utils.showErrors(staffForm, { password: 'Too many attempts. Wait a few seconds and try again.' }); return; }
      const u = Auth.staffLogin($('#email').value, $('#password').value);
      if (!u) {
        fails++; if (fails >= 5) { lockedUntil = Date.now() + 30000; fails = 0; }
        Utils.showErrors(staffForm, { password: 'Email or password is incorrect.' }); return;
      }
      location.href = Auth.home('');
    });
  });
})();

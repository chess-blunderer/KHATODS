'use strict';
/* pdf.js — a very small PDF writer (no libraries needed) and the daily appointment report.
   Reports are built on demand from the saved list for that date, so they are always
   ready: for past days the PDF is the final list; for today it shows the list so far. */
const Report = (() => {
  const W = 595.28, H = 841.89, M = 40;
  const NAVY = [16, 42, 67], BLUE = [37, 131, 197], GREY = [98, 125, 152], LIGHT = [241, 245, 249], WHITE = [255, 255, 255];
  const TEXT = [36, 59, 83], TEAL = [42, 157, 143], AMBER = [185, 122, 18], RULE = [220, 229, 237];
  /* Helvetica character widths for ASCII 32..126 (per 1000 units), used for alignment */
  const HW = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, ...Array(10).fill(556), 278, 278, 584, 584, 584, 556, 1015,
    667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333,
    556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  const clean = s => String(s ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x20-\x7E]/g, '?');
  const esc = s => clean(s).replace(/([\\()])/g, '\\$1');
  const tw = (s, size) => clean(s).split('').reduce((w, c) => w + HW[c.charCodeAt(0) - 32], 0) * size / 1000;
  const fit = (s, maxW, size) => { s = clean(s); if (tw(s, size) <= maxW) return s; while (s.length && tw(s + '...', size) > maxW) s = s.slice(0, -1); return s + '...'; };
  const rgb = c => c.map(v => (v / 255).toFixed(3)).join(' ');

  function makeDoc() {
    const pages = [[]]; let cur = pages[0];
    return {
      pages,
      addPage() { cur = []; pages.push(cur); },
      use(i) { cur = pages[i]; },
      text(x, y, s, o = {}) { const { size = 10, font = 'F1', color = TEXT } = o; cur.push(`${rgb(color)} rg BT /${font} ${size} Tf ${x.toFixed(2)} ${(H - y).toFixed(2)} Td (${esc(s)}) Tj ET`); },
      rect(x, y, w, h, color) { cur.push(`${rgb(color)} rg ${x.toFixed(2)} ${(H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`); },
      line(x1, y1, x2, y2, o = {}) { const { w = 0.6, color = GREY } = o; cur.push(`${rgb(color)} RG ${w} w ${x1.toFixed(2)} ${(H - y1).toFixed(2)} m ${x2.toFixed(2)} ${(H - y2).toFixed(2)} l S`); },
      build() {
        const objs = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${pages.map((_, i) => `${7 + 2 * i} 0 R`).join(' ')}] /Count ${pages.length} >>`];
        ['Helvetica', 'Helvetica-Bold', 'Times-Bold', 'Times-Italic'].forEach(f => objs.push(`<< /Type /Font /Subtype /Type1 /BaseFont /${f} /Encoding /WinAnsiEncoding >>`));
        pages.forEach((p, i) => {
          const content = p.join('\n');
          objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> >> /Contents ${8 + 2 * i} 0 R >>`);
          objs.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
        });
        let out = '%PDF-1.4\n'; const offs = [];
        objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
        const xref = out.length;
        out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
        out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
        return new Blob([out], { type: 'application/pdf' });
      }
    };
  }

  /* Build the report for one date */
  function blob(date) {
    const visits = Store.visitsOn(date), doc = makeDoc();
    const seen = visits.filter(v => v.done).length, fresh = visits.filter(v => v.isNew).length;
    const cols = { no: M, id: M + 28, name: M + 92, age: M + 262, wt: M + 297, phone: M + 347, type: M + 412, status: M + 470 };

    doc.rect(0, 0, W, 92, BLUE);
    doc.text(M, 46, 'Khatod Hospital', { size: 28, font: 'F3', color: WHITE });
    doc.text(M, 68, 'You are in safe hands.', { size: 13, font: 'F4', color: WHITE });
    const tag = 'Daily Appointment Report'; doc.text(W - M - tw(tag, 11) - 8, 46, tag, { size: 11, font: 'F2', color: WHITE });
    doc.text(M, 126, Utils.fmtLong(date), { size: 17, font: 'F2', color: NAVY });
    doc.text(M, 143, 'Generated on ' + new Date().toLocaleString('en-GB'), { size: 9, color: GREY });
    if (date === Utils.today()) doc.text(M, 156, 'Today is still open, so this report shows the list so far.', { size: 9, color: AMBER });

    const stats = [[visits.length, 'Patients listed'], [seen, 'Seen (struck out)'], [visits.length - seen, 'Not seen'], [fresh, 'New registrations']];
    const bw = (W - 2 * M - 30) / 4;
    stats.forEach(([v, l], i) => {
      const x = M + i * (bw + 10);
      doc.rect(x, 170, bw, 54, LIGHT);
      doc.text(x + 12, 196, String(v), { size: 18, font: 'F2', color: NAVY });
      doc.text(x + 12, 213, l, { size: 8, color: GREY });
    });

    const head = y => {
      doc.rect(M, y, W - 2 * M, 22, LIGHT);
      [['no', 'No.'], ['id', 'Patient ID'], ['name', 'Patient name'], ['age', 'Age'], ['wt', 'Weight'], ['phone', 'Phone'], ['type', 'Type'], ['status', 'Status']]
        .forEach(([k, t]) => doc.text(cols[k], y + 15, t, { size: 9, font: 'F2', color: NAVY }));
    };
    let y = 246; head(y); y += 22;
    if (!visits.length) doc.text(M, y + 24, 'No patients were listed on this day.', { size: 11, color: GREY });
    visits.forEach((v, i) => {
      if (y + 22 > H - 64) { doc.addPage(); y = 50; head(y); y += 22; }
      const p = Store.patient(v.patientId) || { id: v.patientId, name: 'Unknown patient', age: '-', weight: '-', phone: '-' };
      if (i % 2) doc.rect(M, y, W - 2 * M, 22, [248, 250, 252]);
      const ty = y + 15, name = fit(p.name, 160, 9.5);
      doc.text(cols.no, ty, String(i + 1), { size: 9.5, color: GREY });
      doc.text(cols.id, ty, p.id, { size: 9.5 });
      doc.text(cols.name, ty, name, { size: 9.5, color: v.done ? GREY : TEXT });
      if (v.done) doc.line(cols.name, ty - 3.6, cols.name + tw(name, 9.5), ty - 3.6, { w: 0.8, color: TEXT });
      doc.text(cols.age, ty, String(p.age), { size: 9.5 });
      doc.text(cols.wt, ty, p.weight + ' kg', { size: 9.5 });
      doc.text(cols.phone, ty, p.phone, { size: 9.5 });
      doc.text(cols.type, ty, v.isNew ? 'New' : 'Returning', { size: 9.5 });
      doc.text(cols.status, ty, v.done ? 'Seen' : 'Not seen', { size: 9.5, font: 'F2', color: v.done ? TEAL : AMBER });
      y += 22;
    });
    if (visits.length) {
      doc.line(M, y, W - M, y, { w: 0.6, color: RULE });
      doc.text(M, y + 18, `Total: ${visits.length} patient${visits.length > 1 ? 's' : ''} listed. Names with a line through them were marked as seen.`, { size: 8.5, color: GREY });
    }
    const n = doc.pages.length;
    doc.pages.forEach((_, i) => {
      doc.use(i);
      doc.line(M, H - 48, W - M, H - 48, { w: 0.5, color: RULE });
      doc.text(M, H - 32, 'Khatod Hospital - You are in safe hands.', { size: 8, color: GREY });
      const s = `Page ${i + 1} of ${n}`; doc.text(W - M - tw(s, 8), H - 32, s, { size: 8, color: GREY });
    });
    return doc.build();
  }

  const fileName = date => `Khatod-Hospital-Appointments-${date}.pdf`;
  function download(date) {
    const url = URL.createObjectURL(blob(date)), a = document.createElement('a');
    a.href = url; a.download = fileName(date); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function view(date) {
    const url = URL.createObjectURL(blob(date));
    const o = Utils.modal(`Appointment report, ${Utils.fmtDate(date)}`,
      `<iframe class="pdf-frame" src="${url}" title="Appointment report PDF"></iframe>
       <p class="muted" style="margin-top:8px">If the report does not appear, your browser may not show PDFs inside a page. Use Download PDF instead.</p>`,
      [{ label: 'Close' }, { label: 'Download PDF', cls: 'btn-primary', fn: () => download(date) }]);
    $('.modal', o).classList.add('wide');
  }
  return { blob, download, view, fileName };
})();

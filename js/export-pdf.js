/**
 * export-pdf.js — สร้าง PDF จาก exportData (V2 — single round)
 *
 * วิธี: html2canvas capture DOM ที่ใช้ Sarabun → jsPDF addImage
 *      (ไม่ต้อง embed .ttf, ไทยใช้ได้ทันที)
 *
 * โครง 3 หน้า:
 *   1. ปก
 *   2. สรุปผู้ได้รับรางวัล (6 รางวัล)
 *   3. Vote Matrix (6×6) + Assignment summary
 */

const PDF_PAGE = { width: 210, height: 297 }; // A4 mm
const PDF_SCALE = 2;

async function exportPDF() {
  let stage;
  try {
    showBlocker('กำลังเตรียมข้อมูล...');
    const data = await api('exportData', { token: getAdminToken() });

    const jsPDF = window.jspdf?.jsPDF;
    if (!jsPDF) throw new Error('jsPDF ไม่พร้อมใช้งาน');
    const pdf = new jsPDF('p', 'mm', 'a4');

    stage = document.createElement('div');
    stage.style.cssText = `
      position: fixed; top: 0; left: -10000px;
      width: 800px; padding: 36px; box-sizing: border-box;
      background: white; color: #1e293b;
      font-family: 'Sarabun', system-ui, sans-serif; font-size: 14px;
    `;
    document.body.appendChild(stage);

    const sections = [
      buildCover(data),
      buildSummary(data),
      buildVoteMatrixSection(data),
    ];

    showBlocker('กำลังสร้างรายงาน...');
    let first = true;
    for (const html of sections) {
      stage.innerHTML = html;
      await waitImages(stage);
      const canvas = await html2canvas(stage, {
        scale: PDF_SCALE,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const imgH = canvas.height * PDF_PAGE.width / canvas.width;
      const drawH = Math.min(imgH, PDF_PAGE.height - 2);
      const drawW = canvas.width * drawH / canvas.height;
      const offsetX = (PDF_PAGE.width - drawW) / 2;
      if (!first) pdf.addPage();
      pdf.addImage(imgData, 'PNG', offsetX, 1, drawW, drawH);
      first = false;
    }

    const fname = `รายงานผล-${ymd()}.pdf`;
    pdf.save(fname);
    showToast('สร้าง PDF เรียบร้อย', 'success');
  } catch (err) {
    showError(err);
  } finally {
    stage?.remove();
    hideBlocker();
  }
}

/* ==================================================================== */

function buildCover(data) {
  const cfg = (data.config || []).reduce((m, r) => (m[r.Key] = r.Value, m), {});
  const event = cfg.eventName || 'การประกวด';
  const date = cfg.eventDate || ymd();
  return `
    <div style="text-align: center; padding: 80px 20px;">
      <div style="font-size: 96px; line-height: 1;">🏆</div>
      <h1 style="font-size: 32px; font-weight: 800; color: #064e3b; margin: 24px 0 8px;">
        รายงานสรุปผลการประกวด
      </h1>
      <p style="font-size: 22px; color: #047857; margin: 0 0 8px;">${escHTML(event)}</p>
      <p style="font-size: 16px; color: #475569;">โรงเรียนบ้านใหม่</p>
      <hr style="margin: 32px auto; width: 50%; border: 0; border-top: 2px solid #d1d5db;">
      <p style="font-size: 14px; color: #64748b;">วันที่จัดงาน</p>
      <p style="font-size: 18px; font-weight: 600; color: #1e293b;">${escHTML(date)}</p>
      <p style="margin-top: 80px; font-size: 12px; color: #94a3b8;">
        สร้างเมื่อ ${escHTML(formatDateThai(new Date()))}
      </p>
    </div>
  `;
}

function buildSummary(data) {
  const results = (data.results || []).sort((a, b) =>
    Number(a.AwardOrder) - Number(b.AwardOrder)
  );
  const teamById = indexBy(data.teams, 'TeamID');

  const rows = results.map((r, i) => {
    const t = teamById[r.TeamID] || {};
    return `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px; text-align: center; color: #94a3b8; font-weight: 700;">${i + 1}</td>
        <td style="padding: 10px;">
          <div style="font-weight: 700; color: #0369a1;">🏆 ${escHTML(r.AwardName)}</div>
        </td>
        <td style="padding: 10px;">
          <div style="font-weight: 600;">#${escHTML(t.TeamNumber || '?')} ${escHTML(r.TeamName)}</div>
          <div style="font-size: 12px; color: #64748b;">${escHTML(r.School || '')}</div>
        </td>
        <td style="padding: 10px; text-align: right; font-weight: 700;">${escHTML(r.VoteCount)}</td>
        <td style="padding: 10px; font-size: 11px; color: ${r.Note ? '#be123c' : '#94a3b8'};">${escHTML(r.Note || '–')}</td>
      </tr>
    `;
  }).join('');

  return `
    <div>
      <h2 style="font-size: 22px; color: #064e3b; margin-bottom: 16px;">🏅 สรุปผู้ได้รับรางวัล</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background: #ecfdf5; color: #065f46;">
            <th style="padding: 10px; text-align: center; width: 40px;">#</th>
            <th style="padding: 10px; text-align: left;">รางวัล</th>
            <th style="padding: 10px; text-align: left;">ทีม</th>
            <th style="padding: 10px; text-align: right; width: 80px;">เสียงโหวต</th>
            <th style="padding: 10px; text-align: left; width: 140px;">หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5" style="padding: 24px; text-align: center; color: #94a3b8;">ยังไม่มีผลที่บันทึก</td></tr>'}</tbody>
      </table>
      <p style="margin-top: 16px; font-size: 11px; color: #94a3b8;">
        การจับคู่ใช้ Hungarian Algorithm (1 ทีม : 1 รางวัล) โดยให้ผลรวมเสียงโหวตสูงสุด
      </p>
    </div>
  `;
}

function buildVoteMatrixSection(data) {
  const teams = (data.teams || [])
    .filter(t => t.Status === 'Active')
    .sort((a, b) => Number(a.Order) - Number(b.Order));
  const awards = (data.awards || [])
    .sort((a, b) => Number(a.Order) - Number(b.Order));
  const votes = data.votes || [];
  const results = (data.results || []);

  if (teams.length === 0 || awards.length === 0) {
    return `<div><h2 style="font-size: 22px; color: #0369a1;">Vote Matrix</h2>
      <p style="color: #94a3b8;">ยังไม่มีข้อมูล</p></div>`;
  }

  // matrix[teamId][awardId] = vote count
  const matrix = {};
  teams.forEach(t => { matrix[t.TeamID] = {}; });
  votes.forEach(v => {
    if (!matrix[v.TeamID]) return;
    matrix[v.TeamID][v.AwardID] = (matrix[v.TeamID][v.AwardID] || 0) + 1;
  });

  // ทีมไหนได้รางวัลอะไร
  const teamAward = {};
  results.forEach(r => { teamAward[r.TeamID] = r.AwardID; });

  const awardCols = awards.map(a =>
    `<th style="padding: 6px; text-align: center; font-weight: 600; font-size: 11px;">${escHTML(a.AwardName)}</th>`
  ).join('');

  const bodyRows = teams.map(t => {
    const cells = awards.map(a => {
      const v = matrix[t.TeamID]?.[a.AwardID] || 0;
      const isPicked = teamAward[t.TeamID] === a.AwardID;
      return `<td style="padding: 6px; text-align: center; ${isPicked ? 'background: #0284c7; color: white; font-weight: 700;' : v > 0 ? 'color: #475569;' : 'color: #cbd5e1;'}">${v}</td>`;
    }).join('');
    return `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 6px;">
          <span style="display: inline-block; background: #dbeafe; color: #1e40af; padding: 1px 6px; border-radius: 9999px; font-size: 10px; margin-right: 4px;">#${escHTML(t.TeamNumber)}</span>
          <span style="font-size: 12px;">${escHTML(t.TeamName)}</span>
        </td>
        ${cells}
      </tr>`;
  }).join('');

  // จำนวนกรรมการที่ส่งคะแนน
  const judgesVoted = (data.judges || []).filter(j => j.Voted === true || j.Voted === 'TRUE').length;
  const judgesTotal = (data.judges || []).filter(j => j.Active === true || j.Active === 'TRUE').length;

  const assignSummary = results.length > 0
    ? `<div style="margin-top: 24px;">
        <h3 style="font-size: 16px; color: #0369a1; margin-bottom: 8px;">🎯 ผลการจับคู่ (Hungarian Assignment)</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #e0f2fe; color: #075985;">
              <th style="padding: 8px; text-align: left;">รางวัล</th>
              <th style="padding: 8px; text-align: left;">ทีมผู้ชนะ</th>
              <th style="padding: 8px; text-align: right;">เสียงโหวต</th>
              <th style="padding: 8px; text-align: left;">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            ${results.sort((a, b) => Number(a.AwardOrder) - Number(b.AwardOrder)).map(r => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px; font-weight: 600;">${escHTML(r.AwardName)}</td>
                <td style="padding: 8px;">${escHTML(r.TeamName)}</td>
                <td style="padding: 8px; text-align: right; font-weight: 700;">${escHTML(r.VoteCount)}</td>
                <td style="padding: 8px; font-size: 11px; color: ${r.Note ? '#be123c' : '#94a3b8'};">${escHTML(r.Note || '–')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
       </div>`
    : '';

  return `
    <div>
      <h2 style="font-size: 22px; color: #0369a1; margin-bottom: 4px;">📊 Vote Matrix</h2>
      <p style="font-size: 12px; color: #64748b; margin-bottom: 16px;">
        จำนวนเสียงโหวต (แถว = ทีม, คอลัมน์ = รางวัล) — เซลล์ฟ้า = ผลการจับคู่ ·
        กรรมการที่ส่งคะแนน <strong>${judgesVoted}/${judgesTotal}</strong>
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background: #e0f2fe; color: #075985;">
            <th style="padding: 6px; text-align: left;">ทีม \\ รางวัล</th>
            ${awardCols}
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
      ${assignSummary}
    </div>
  `;
}

/* ==================================================================== */

function escHTML(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function indexBy(arr, key) {
  const m = {};
  (arr || []).forEach(x => { m[x[key]] = x; });
  return m;
}

function ymd(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function formatDateThai(d) {
  try {
    return d.toLocaleString('th-TH', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return d.toISOString(); }
}

function waitImages(root) {
  const imgs = [...root.querySelectorAll('img')];
  if (imgs.length === 0) return Promise.resolve();
  return Promise.all(imgs.map(img =>
    img.complete && img.naturalWidth > 0
      ? Promise.resolve()
      : new Promise(res => {
          img.addEventListener('load', res, { once: true });
          img.addEventListener('error', res, { once: true });
        })
  ));
}

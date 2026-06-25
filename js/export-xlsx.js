/**
 * export-xlsx.js — สร้าง Excel จาก exportData (V2 — single round)
 *
 * 4 sheets:
 *   1. สรุปผลรางวัล  — 6 รางวัล + ทีมชนะ + คะแนน
 *   2. Vote Matrix    — vote count (ทีม × รางวัล) + คอลัมน์ assignment
 *   3. กรรมการ        — รายชื่อ + ลำดับ + สถานะ + เวลาส่ง
 *   4. ทีม             — รายชื่อ + สถานะ
 */

async function exportXLSX() {
  try {
    showBlocker('กำลังเตรียมข้อมูล...');
    const data = await api('exportData', { token: getAdminToken() });
    if (!window.XLSX) throw new Error('SheetJS ไม่พร้อมใช้งาน');

    showBlocker('กำลังสร้างไฟล์ Excel...');
    const wb = XLSX.utils.book_new();

    appendSheet(wb, 'สรุปผลรางวัล', buildSummarySheet(data));
    appendSheet(wb, 'Vote Matrix',  buildVoteMatrixSheet(data));
    appendSheet(wb, 'กรรมการ',      buildJudgesSheet(data));
    appendSheet(wb, 'ทีม',           buildTeamsSheet(data));

    const fname = `รายงานผล-${xlsxYmd()}.xlsx`;
    XLSX.writeFile(wb, fname);
    showToast('สร้างไฟล์ Excel เรียบร้อย', 'success');
  } catch (err) {
    showError(err);
  } finally {
    hideBlocker();
  }
}

function appendSheet(wb, name, aoa) {
  const safe = name.slice(0, 31);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // auto-fit column widths (หยาบ)
  const colWidths = [];
  aoa.forEach(row => {
    row.forEach((cell, i) => {
      const len = cell == null ? 0 : String(cell).length;
      const cur = colWidths[i]?.wch || 0;
      colWidths[i] = { wch: Math.min(40, Math.max(cur, len + 2)) };
    });
  });
  ws['!cols'] = colWidths;
  XLSX.utils.book_append_sheet(wb, ws, safe);
}

/* ==================================================================== */

function buildSummarySheet(data) {
  const results = (data.results || []).sort((a, b) =>
    Number(a.AwardOrder) - Number(b.AwardOrder)
  );
  const teamById = indexBy(data.teams, 'TeamID');
  const aoa = [
    ['ลำดับ', 'AwardID', 'รางวัล', 'TeamID', 'ทีม', 'หมายเลข', 'โรงเรียน', 'เสียงโหวต', 'หมายเหตุ', 'คำนวณเมื่อ'],
  ];
  results.forEach((r, i) => {
    const t = teamById[r.TeamID] || {};
    aoa.push([
      i + 1,
      r.AwardID,
      r.AwardName,
      r.TeamID,
      r.TeamName,
      t.TeamNumber || '',
      r.School || '',
      Number(r.VoteCount) || 0,
      r.Note || '',
      formatTime(r.ComputedAt),
    ]);
  });
  if (results.length === 0) aoa.push(['(ยังไม่มีผลที่บันทึก)']);
  return aoa;
}

function buildVoteMatrixSheet(data) {
  const teams = (data.teams || [])
    .filter(t => t.Status === 'Active')
    .sort((a, b) => Number(a.Order) - Number(b.Order));
  const awards = (data.awards || [])
    .sort((a, b) => Number(a.Order) - Number(b.Order));
  const votes = data.votes || [];
  const results = data.results || [];

  if (teams.length === 0 || awards.length === 0) return [['ยังไม่มีข้อมูล']];

  // pivot: matrix[teamId][awardId] = count
  const matrix = {};
  teams.forEach(t => { matrix[t.TeamID] = {}; });
  votes.forEach(v => {
    if (!matrix[v.TeamID]) return;
    matrix[v.TeamID][v.AwardID] = (matrix[v.TeamID][v.AwardID] || 0) + 1;
  });

  // ทีมไหนได้รางวัลอะไร
  const teamAward = {};
  results.forEach(r => {
    teamAward[r.TeamID] = {
      awardName: r.AwardName,
      voteCount: Number(r.VoteCount) || 0,
      note: r.Note || '',
    };
  });

  const awardHeaders = awards.map(a => a.AwardName);
  const aoa = [
    ['TeamID', 'หมายเลข', 'ทีม', 'โรงเรียน', ...awardHeaders, 'เสียงรวม', 'รางวัลที่ได้', 'เสียงที่ตรงรางวัล', 'หมายเหตุ'],
  ];

  teams.forEach(t => {
    const counts = awards.map(a => matrix[t.TeamID][a.AwardID] || 0);
    const total = counts.reduce((s, n) => s + n, 0);
    const got = teamAward[t.TeamID];
    aoa.push([
      t.TeamID,
      t.TeamNumber,
      t.TeamName,
      t.School,
      ...counts,
      total,
      got ? got.awardName : '',
      got ? got.voteCount : '',
      got?.note || '',
    ]);
  });

  // แถวสุดท้าย — รวมเสียงต่อรางวัล
  const totalsRow = awards.map(a =>
    teams.reduce((s, t) => s + (matrix[t.TeamID][a.AwardID] || 0), 0)
  );
  const grandTotal = totalsRow.reduce((s, n) => s + n, 0);
  aoa.push(['', '', 'รวมต่อรางวัล', '', ...totalsRow, grandTotal, '', '', '']);

  return aoa;
}

function buildJudgesSheet(data) {
  const judges = (data.judges || [])
    .filter(j => bool(j.Active))
    .sort((a, b) => Number(a.Order) - Number(b.Order));
  const aoa = [
    ['ลำดับ', 'JudgeID', 'ชื่อกรรมการ', 'สถานะ', 'ส่งคะแนนเมื่อ'],
  ];
  judges.forEach(j => {
    aoa.push([
      Number(j.Order),
      j.JudgeID,
      j.JudgeName,
      bool(j.Voted) ? 'ส่งแล้ว' : 'ยังไม่ส่ง',
      formatTime(j.VotedAt),
    ]);
  });
  // สถิติด้านล่าง
  const voted = judges.filter(j => bool(j.Voted)).length;
  aoa.push([]);
  aoa.push(['', '', 'รวม', `${voted} / ${judges.length}`, voted === judges.length ? 'ครบทุกคน' : 'ยังไม่ครบ']);
  return aoa;
}

function buildTeamsSheet(data) {
  const teams = (data.teams || []).filter(t => t.Status !== 'Removed');
  const aoa = [
    ['TeamID', 'หมายเลข', 'ทีม', 'โรงเรียน', 'สถานะ', 'ลำดับ', 'ImageURL', 'สร้างเมื่อ'],
  ];
  teams.forEach(t => {
    aoa.push([
      t.TeamID,
      t.TeamNumber,
      t.TeamName,
      t.School,
      statusLabel(t.Status),
      Number(t.Order),
      t.ImageURL || '',
      formatTime(t.CreatedAt),
    ]);
  });
  return aoa;
}

/* ==================================================================== */

function indexBy(arr, key) {
  const m = {};
  (arr || []).forEach(x => { m[x[key]] = x; });
  return m;
}

function bool(v) {
  return v === true || v === 'TRUE' || v === 'true' || v === 1;
}

function statusLabel(s) {
  if (s === 'Active') return 'เข้าแข่ง';
  if (s === 'Removed') return 'ถูกลบ';
  return s || '';
}

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('th-TH', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return String(iso); }
}

function xlsxYmd() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

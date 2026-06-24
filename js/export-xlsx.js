/**
 * export-xlsx.js — สร้างไฟล์ Excel จาก exportData
 *
 * 5 sheet:
 *   1. สรุปผลรางวัล      — 7 รางวัล + ทีมชนะ + คะแนน
 *   2. คะแนนรอบ 1         — matrix (ทีม × กรรมการ) + รวม + 1/2/3
 *   3. คะแนนรอบ 2         — vote matrix + รางวัลที่ได้
 *   4. กรรมการ            — รายชื่อ + รอบ + สถานะ + เวลาส่ง
 *   5. ทีม                — รายชื่อ + สถานะ
 *
 * ใช้ SheetJS (window.XLSX) — ทำงานบน client ทั้งหมด
 */

async function exportXLSX() {
  try {
    showBlocker('กำลังเตรียมข้อมูล...');
    const data = await api('exportData', { token: getAdminToken() });
    if (!window.XLSX) throw new Error('SheetJS ไม่พร้อมใช้งาน');

    showBlocker('กำลังสร้างไฟล์ Excel...');
    const wb = XLSX.utils.book_new();

    appendSheet(wb, 'สรุปผลรางวัล', buildSummarySheet(data));
    appendSheet(wb, 'คะแนนรอบ 1', buildRound1Sheet(data));
    appendSheet(wb, 'คะแนนรอบ 2', buildRound2Sheet(data));
    appendSheet(wb, 'กรรมการ',     buildJudgesSheet(data));
    appendSheet(wb, 'ทีม',          buildTeamsSheet(data));

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
  // ชื่อ sheet ใน Excel ห้ามเกิน 31 ตัวอักษร
  const safe = name.slice(0, 31);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // คำนวณ column width จากความยาวเนื้อหา (แบบหยาบ)
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
    Number(a.Round) - Number(b.Round) ||
    String(a.AwardID).localeCompare(String(b.AwardID))
  );
  const aoa = [
    ['ลำดับ', 'รอบ', 'รางวัล', 'ทีม', 'หมายเลข', 'โรงเรียน', 'คะแนน', 'หมายเหตุ', 'คำนวณเมื่อ'],
  ];
  const teamById = indexBy(data.teams, 'TeamID');
  results.forEach((r, i) => {
    const t = teamById[r.TeamID] || {};
    aoa.push([
      i + 1,
      Number(r.Round),
      r.AwardName,
      r.TeamName,
      t.TeamNumber || '',
      r.School,
      Number(r.Score),
      r.Note || '',
      formatTime(r.ComputedAt),
    ]);
  });
  if (results.length === 0) aoa.push(['(ยังไม่มีผลที่บันทึก)']);
  return aoa;
}

function buildRound1Sheet(data) {
  const teams = (data.teams || []).filter(t => t.Status !== 'Removed');
  const judges = (data.judges || [])
    .filter(j => Number(j.Round) === 1 && bool(j.Active))
    .sort((a, b) => String(a.JudgeID).localeCompare(String(b.JudgeID)));
  const votes = data.round1Votes || [];

  if (teams.length === 0 || judges.length === 0) return [['ยังไม่มีข้อมูลรอบ 1']];

  // pivot
  const stats = {};
  teams.forEach(t => {
    stats[t.TeamID] = { byJudge: {}, total: 0, r1: 0, r2: 0, r3: 0 };
  });
  votes.forEach(v => {
    const s = stats[v.TeamID]; if (!s) return;
    s.byJudge[v.JudgeID] = Number(v.Points || 0);
    s.total += Number(v.Points || 0);
    if (Number(v.Rank) === 1) s.r1++;
    if (Number(v.Rank) === 2) s.r2++;
    if (Number(v.Rank) === 3) s.r3++;
  });

  const sorted = teams.slice().sort((a, b) =>
    stats[b.TeamID].total - stats[a.TeamID].total ||
    stats[b.TeamID].r1 - stats[a.TeamID].r1 ||
    stats[b.TeamID].r2 - stats[a.TeamID].r2 ||
    stats[b.TeamID].r3 - stats[a.TeamID].r3
  );

  const judgeHeaders = judges.map(j => `${j.JudgeID}: ${j.JudgeName || ''}`.trim());
  const aoa = [
    ['อันดับ', 'TeamID', 'หมายเลข', 'ทีม', 'โรงเรียน', 'สถานะ', ...judgeHeaders, 'รวม', 'อันดับ 1', 'อันดับ 2', 'อันดับ 3'],
  ];
  sorted.forEach((t, i) => {
    const s = stats[t.TeamID];
    const judgeCells = judges.map(j => s.byJudge[j.JudgeID] ?? '');
    aoa.push([
      i + 1,
      t.TeamID,
      t.TeamNumber,
      t.TeamName,
      t.School,
      t.Status,
      ...judgeCells,
      s.total,
      s.r1, s.r2, s.r3,
    ]);
  });
  return aoa;
}

function buildRound2Sheet(data) {
  const teams = (data.teams || []).filter(t => t.Status === 'Active');
  const awards = (data.awards || [])
    .filter(a => Number(a.Round) === 2)
    .sort((a, b) => Number(a.Order) - Number(b.Order));
  const votes = data.round2Votes || [];
  const r2Results = (data.results || []).filter(r => Number(r.Round) === 2);

  if (teams.length === 0 || awards.length === 0) return [['ยังไม่มีข้อมูลรอบ 2']];

  const matrix = {};
  teams.forEach(t => { matrix[t.TeamID] = {}; });
  votes.forEach(v => {
    if (!matrix[v.TeamID]) return;
    matrix[v.TeamID][v.AwardID] = (matrix[v.TeamID][v.AwardID] || 0) + 1;
  });

  const teamAward = {};
  r2Results.forEach(r => { teamAward[r.TeamID] = { awardId: r.AwardID, awardName: r.AwardName, score: r.Score, note: r.Note }; });

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
      got ? Number(got.score) : '',
      got?.note || '',
    ]);
  });
  return aoa;
}

function buildJudgesSheet(data) {
  const judges = (data.judges || []).filter(j => bool(j.Active));
  const aoa = [
    ['JudgeID', 'ชื่อกรรมการ', 'รอบ', 'สถานะ', 'ส่งคะแนนเมื่อ', 'Token (URL ลิงก์)'],
  ];
  judges.forEach(j => {
    aoa.push([
      j.JudgeID,
      j.JudgeName,
      Number(j.Round),
      bool(j.Voted) ? 'ส่งแล้ว' : 'ยังไม่ส่ง',
      formatTime(j.VotedAt),
      j.Token,
    ]);
  });
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
      t.Order,
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
  if (s === 'Winner-Round1') return 'ชนะรอบ 1 (ตัดออกจากรอบ 2)';
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

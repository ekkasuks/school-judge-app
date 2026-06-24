/**
 * Results.gs — Dashboard, คำนวณรอบ 1/2, จัดการ Results sheet, publish
 */

function getDashboard(payload) {
  validateAdmin_(payload.token);
  const teams = getAllRows_('Teams').filter(t => t.Status !== 'Removed');
  const judges = getAllRows_('Judges').filter(j => toBool_(j.Active));

  const r1 = judges.filter(j => Number(j.Round) === 1);
  const r2 = judges.filter(j => Number(j.Round) === 2);

  return {
    teamCount: teams.length,
    activeTeamCount: teams.filter(t => t.Status === 'Active').length,
    winnerRound1: teams.find(t => t.Status === 'Winner-Round1') || null,
    round1: {
      total: r1.length,
      voted: r1.filter(j => toBool_(j.Voted)).length,
    },
    round2: {
      total: r2.length,
      voted: r2.filter(j => toBool_(j.Voted)).length,
    },
    config: getConfigMap_(),
  };
}

/**
 * computeRound1 — รวมคะแนน + ตรวจ tiebreak
 * Tie key: (totalScore, rank1Count, rank2Count, rank3Count) desc
 */
function computeRound1(payload) {
  validateAdmin_(payload.token);
  const votes = getAllRows_('Round1Votes');
  const teams = getAllRows_('Teams').filter(t => t.Status === 'Active');

  const stats = teams.map(t => {
    const tv = votes.filter(v => v.TeamID === t.TeamID);
    return {
      team: t,
      totalScore: tv.reduce((s, v) => s + Number(v.Points || 0), 0),
      rank1Count: tv.filter(v => Number(v.Rank) === 1).length,
      rank2Count: tv.filter(v => Number(v.Rank) === 2).length,
      rank3Count: tv.filter(v => Number(v.Rank) === 3).length,
      voteCount: tv.length,
    };
  });

  stats.sort((a, b) =>
    b.totalScore - a.totalScore ||
    b.rank1Count - a.rank1Count ||
    b.rank2Count - a.rank2Count ||
    b.rank3Count - a.rank3Count
  );

  const top = stats[0] || null;
  const tied = top
    ? stats.filter(s =>
        s.totalScore === top.totalScore &&
        s.rank1Count === top.rank1Count &&
        s.rank2Count === top.rank2Count &&
        s.rank3Count === top.rank3Count
      )
    : [];

  return {
    stats,
    tied: tied.length > 1 ? tied.map(t => t.team) : null,
    winner: tied.length === 1 ? top : null,
  };
}

/**
 * setRound1Winner — admin ยืนยันผู้ชนะ → mark Winner-Round1 + บันทึก Results
 */
function setRound1Winner(payload) {
  validateAdmin_(payload.token);
  const teamId = payload.teamId;
  const note = payload.note || '';

  return withLock_(() => {
    const team = getAllRows_('Teams').find(t => t.TeamID === teamId);
    if (!team) throw new Error('ไม่พบทีม');

    // เคลียร์ Winner-Round1 เก่าก่อน (กรณี admin เปลี่ยนใจ)
    const teamsSheet = getSheet_('Teams');
    const teamHeaders = getHeaders_('Teams');
    const allTeams = getAllRows_('Teams');
    allTeams.forEach(t => {
      if (t.Status === 'Winner-Round1') {
        const idx = findRowIndex_('Teams', 'TeamID', t.TeamID);
        teamsSheet.getRange(idx, teamHeaders.indexOf('Status') + 1).setValue('Active');
      }
    });

    // ตั้ง winner ใหม่
    const rowIdx = findRowIndex_('Teams', 'TeamID', teamId);
    teamsSheet.getRange(rowIdx, teamHeaders.indexOf('Status') + 1).setValue('Winner-Round1');
    teamsSheet.getRange(rowIdx, teamHeaders.indexOf('UpdatedAt') + 1).setValue(nowIso_());

    // คำนวณ score
    const votes = getAllRows_('Round1Votes').filter(v => v.TeamID === teamId);
    const totalScore = votes.reduce((s, v) => s + Number(v.Points || 0), 0);

    const award = getAllRows_('Awards').find(a => Number(a.Round) === 1);
    if (!award) throw new Error('ไม่พบรางวัลรอบ 1 ใน Sheet Awards');

    // เคลียร์ผลเก่ารอบ 1 → บันทึกใหม่
    clearResultsForRound_(1);
    appendResult_({
      round: 1,
      awardId: award.AwardID,
      awardName: award.AwardName,
      teamId: team.TeamID,
      teamName: team.TeamName,
      school: team.School,
      imageUrl: team.ImageURL || '',
      score: totalScore,
      note,
    });

    setConfigKey_('round1Computed', 'TRUE');
    return { winner: team, totalScore };
  });
}

/**
 * computeRound2 — สร้าง vote matrix + run Hungarian → คืนการ assign
 * ยังไม่บันทึก Results — admin ต้องกด setRound2Results ก่อน
 */
function computeRound2(payload) {
  validateAdmin_(payload.token);
  const teams = getAllRows_('Teams')
    .filter(t => t.Status === 'Active')
    .sort((a, b) => Number(a.Order) - Number(b.Order));
  const awards = getAllRows_('Awards')
    .filter(a => Number(a.Round) === 2)
    .sort((a, b) => Number(a.Order) - Number(b.Order));
  const votes = getAllRows_('Round2Votes');

  if (teams.length === 0) throw new Error('ไม่มีทีมที่เข้าแข่งรอบ 2');
  if (teams.length !== awards.length) {
    throw new Error('จำนวนทีม (' + teams.length + ') ต้องเท่ากับจำนวนรางวัล (' + awards.length + ')');
  }

  const n = teams.length;
  // matrix[i][j] = จำนวน vote ของ team i ต่อ award j
  const matrix = teams.map(t =>
    awards.map(a =>
      votes.filter(v => v.TeamID === t.TeamID && v.AwardID === a.AwardID).length
    )
  );

  // แปลงเป็น cost matrix (min cost) สำหรับ Hungarian
  const maxVal = Math.max(1, ...matrix.flat());
  const cost = matrix.map(row => row.map(v => maxVal - v));

  const assignment = hungarian(cost); // assignment[i] = j (team i ได้ award j)

  const result = teams.map((t, i) => ({
    team: t,
    award: awards[assignment[i]],
    voteCount: matrix[i][assignment[i]],
  }));
  const totalVotes = result.reduce((s, r) => s + r.voteCount, 0);

  return { result, matrix, teams, awards, totalVotes };
}

/**
 * setRound2Results — admin ยืนยัน assignment → บันทึก Results
 * payload.assignments = [{ teamId, awardId, voteCount, note? }, ...]
 */
function setRound2Results(payload) {
  validateAdmin_(payload.token);
  const assignments = payload.assignments || [];

  return withLock_(() => {
    clearResultsForRound_(2);

    const teams = getAllRows_('Teams');
    const awards = getAllRows_('Awards');

    assignments.forEach(a => {
      const team = teams.find(t => t.TeamID === a.teamId);
      const award = awards.find(aw => aw.AwardID === a.awardId);
      if (!team || !award) throw new Error('ข้อมูล assignment ไม่ถูกต้อง');
      appendResult_({
        round: 2,
        awardId: award.AwardID,
        awardName: award.AwardName,
        teamId: team.TeamID,
        teamName: team.TeamName,
        school: team.School,
        imageUrl: team.ImageURL || '',
        score: Number(a.voteCount) || 0,
        note: a.note || '',
      });
    });

    setConfigKey_('round2Computed', 'TRUE');
    return {};
  });
}

function getAdminResults(payload) {
  validateAdmin_(payload.token);
  const results = getAllRows_('Results')
    .sort((a, b) => Number(a.Round) - Number(b.Round));
  return { results };
}

function getResults(_payload) {
  const config = getConfigMap_();
  if (!toBool_(config.resultsPublished)) return { published: false };
  const results = getAllRows_('Results')
    .sort((a, b) => Number(a.Round) - Number(b.Round));
  return { published: true, results, eventName: config.eventName || '' };
}

function publishResults(payload) {
  validateAdmin_(payload.token);
  setConfigKey_('resultsPublished', 'TRUE');
  return {};
}

/* ----- internal helpers ----- */

function clearResultsForRound_(round) {
  const sheet = getSheet_('Results');
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return;
  for (let i = values.length - 1; i >= 1; i--) {
    if (Number(values[i][1]) === round) sheet.deleteRow(i + 1);
  }
}

function appendResult_(r) {
  const sheet = getSheet_('Results');
  const existing = getAllRows_('Results');
  const nextNum = existing.length + 1;
  sheet.appendRow([
    'RES' + String(nextNum).padStart(3, '0'),
    r.round,
    r.awardId,
    r.awardName,
    r.teamId,
    r.teamName,
    r.school,
    r.imageUrl,
    r.score,
    nowIso_(),
    r.note || '',
  ]);
}

/* ----- Export ----- */

function exportData(payload) {
  validateAdmin_(payload.token);
  return {
    teams: getAllRows_('Teams'),
    judges: getAllRows_('Judges'), // ส่ง token เต็มสำหรับ admin
    awards: getAllRows_('Awards'),
    round1Votes: getAllRows_('Round1Votes'),
    round2Votes: getAllRows_('Round2Votes'),
    results: getAllRows_('Results'),
    config: getAllRows_('Config'),
  };
}

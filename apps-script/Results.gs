/**
 * Results.gs — Dashboard, คำนวณ Hungarian, TV Reveal state (V2)
 *
 * Flow:
 *   1. Admin set Config.votingOpen=FALSE → Config.gs auto-trigger computeResults
 *   2. Results sheet ได้รับ 6 แถวใหม่ (1 ทีม : 1 รางวัล)
 *   3. Admin (optional) override swap ใน preview
 *   4. Admin set resultsPublished=TRUE + revealIndex=0 → publishResults()
 *   5. TV/Public หน้า results.html poll getRevealState ทุก 2 วินาที
 *   6. Admin คลิก: เปิดผล / รางวัลถัดไป → setRevealState
 */

function getDashboard(payload) {
  validateAdmin_(payload.token);
  const teams = getAllRows_('Teams').filter(t => t.Status !== 'Removed');
  const judges = getAllRows_('Judges').filter(j => toBool_(j.Active));
  const voted = judges.filter(j => toBool_(j.Voted)).length;

  return {
    teamCount: teams.length,
    activeTeamCount: teams.filter(t => t.Status === 'Active').length,
    judgeCount: judges.length,
    votedCount: voted,
    config: getConfigMap_(),
  };
}

/* ====================================================================
 * COMPUTE — Hungarian Assignment
 * ==================================================================== */

function computeResults(payload) {
  validateAdmin_(payload.token);
  return withLock_(() => computeResultsInternal_());
}

/**
 * computeResultsInternal_ — เรียกได้จาก setConfig auto-trigger ด้วย
 * **ต้องเรียกใน lock อยู่แล้ว** (เพราะ setConfig ครอบ lock อีกชั้น)
 */
function computeResultsInternal_() {
  const teams = getAllRows_('Teams')
    .filter(t => t.Status === 'Active')
    .sort((a, b) => Number(a.Order) - Number(b.Order));
  const awards = getAllRows_('Awards')
    .sort((a, b) => Number(a.Order) - Number(b.Order));
  const votes = getAllRows_('Votes');

  if (teams.length === 0) throw new Error('ยังไม่มีทีม');
  if (awards.length === 0) throw new Error('ยังไม่มีรางวัล');
  if (teams.length !== awards.length) {
    throw new Error('จำนวนทีม (' + teams.length + ') ต้องเท่ากับจำนวนรางวัล (' + awards.length + ')');
  }

  const n = teams.length;
  // matrix[i][j] = vote count ของ team i ต่อ award j
  const matrix = teams.map(t =>
    awards.map(a =>
      votes.filter(v => v.TeamID === t.TeamID && v.AwardID === a.AwardID).length
    )
  );
  const maxVal = Math.max(1, ...matrix.flat());
  const cost = matrix.map(row => row.map(v => maxVal - v));
  const assignment = hungarian(cost);

  // เคลียร์ Results เก่า + เขียนใหม่
  clearResultsSheet_();
  const ts = nowIso_();
  const sheet = getSheet_('Results');
  const rows = teams.map((t, i) => {
    const a = awards[assignment[i]];
    const v = matrix[i][assignment[i]];
    return [
      'RES' + String(i + 1).padStart(3, '0'),
      a.AwardID,
      a.AwardName,
      Number(a.Order),
      t.TeamID,
      t.TeamName,
      t.School || '',
      t.ImageURL || '',
      v,
      ts,
      '',
    ];
  });
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }

  setConfigKey_('voteComputed', 'TRUE');
  return {
    count: rows.length,
    matrix,
    teams,
    awards,
    assignment: rows.map(r => ({ awardId: r[1], awardName: r[2], teamId: r[4], teamName: r[5], voteCount: r[8] })),
  };
}

/**
 * setResults — manual override จาก admin หลัง preview (click-to-swap)
 *   payload.assignments = [{ awardId, teamId, voteCount, note }, ...]
 */
function setResults(payload) {
  validateAdmin_(payload.token);
  const assignments = payload.assignments || [];

  return withLock_(() => {
    clearResultsSheet_();
    const teams = getAllRows_('Teams');
    const awards = getAllRows_('Awards');
    const sheet = getSheet_('Results');
    const ts = nowIso_();

    const rows = assignments.map((a, i) => {
      const team = teams.find(t => t.TeamID === a.teamId);
      const award = awards.find(aw => aw.AwardID === a.awardId);
      if (!team || !award) throw new Error('assignment ไม่ถูกต้อง');
      return [
        'RES' + String(i + 1).padStart(3, '0'),
        award.AwardID,
        award.AwardName,
        Number(award.Order),
        team.TeamID,
        team.TeamName,
        team.School || '',
        team.ImageURL || '',
        Number(a.voteCount) || 0,
        ts,
        a.note || '',
      ];
    });
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }

    setConfigKey_('voteComputed', 'TRUE');
    return { count: rows.length };
  });
}

function getAdminResults(payload) {
  validateAdmin_(payload.token);
  const results = getAllRows_('Results').sort((a, b) =>
    Number(a.AwardOrder) - Number(b.AwardOrder)
  );
  return { results };
}

/* ====================================================================
 * PUBLISH + TV REVEAL STATE
 * ==================================================================== */

function publishResults(payload) {
  validateAdmin_(payload.token);
  return withLock_(() => {
    setConfigKey_('resultsPublished', 'TRUE');
    setConfigKey_('revealIndex', '0');
    setConfigKey_('revealedTeam', 'FALSE');
    return {};
  });
}

function unpublishResults(payload) {
  validateAdmin_(payload.token);
  return withLock_(() => {
    setConfigKey_('resultsPublished', 'FALSE');
    setConfigKey_('revealIndex', '0');
    setConfigKey_('revealedTeam', 'FALSE');
    return {};
  });
}

function setRevealState(payload) {
  validateAdmin_(payload.token);
  const ri = payload.revealIndex;
  const rt = payload.revealedTeam;

  return withLock_(() => {
    if (ri !== undefined && ri !== null) {
      setConfigKey_('revealIndex', String(Number(ri)));
    }
    if (rt !== undefined && rt !== null) {
      setConfigKey_('revealedTeam', rt ? 'TRUE' : 'FALSE');
    }
    return {};
  });
}

function getRevealState(_payload) {
  const c = getConfigMap_();
  return {
    published: toBool_(c.resultsPublished),
    revealIndex: Number(c.revealIndex || 0),
    revealedTeam: toBool_(c.revealedTeam),
    totalAwards: getAllRows_('Awards').length,
  };
}

/* ====================================================================
 * PUBLIC RESULTS — filter ตาม revealIndex
 * ==================================================================== */

/**
 * getResults — public
 *
 * คืนเฉพาะรางวัลที่ "ถูกเปิดเผยแล้ว" ตาม revealIndex
 *   - awardOrder > revealIndex                → ซ่อนทั้งใบ
 *   - awardOrder == revealIndex, revealedTeam=FALSE → ส่งเฉพาะ AwardName
 *   - awardOrder == revealIndex, revealedTeam=TRUE  → ส่งทั้งหมด
 *   - awardOrder < revealIndex                → ส่งทั้งหมด (เปิดไปแล้ว)
 */
function getResults(_payload) {
  const c = getConfigMap_();
  const totalAwards = getAllRows_('Awards').length;
  if (!toBool_(c.resultsPublished)) {
    return { published: false, revealIndex: 0, totalAwards };
  }

  const revealIndex = Number(c.revealIndex || 0);
  const revealedTeam = toBool_(c.revealedTeam);
  const all = getAllRows_('Results').sort((a, b) =>
    Number(a.AwardOrder) - Number(b.AwardOrder)
  );

  const visible = all.map(r => {
    const order = Number(r.AwardOrder);
    if (order > revealIndex) return null;
    if (order === revealIndex && !revealedTeam) {
      // เปิดเฉพาะชื่อรางวัล
      return {
        AwardID: r.AwardID,
        AwardName: r.AwardName,
        AwardOrder: order,
        teamRevealed: false,
      };
    }
    // เปิดทั้งใบ
    return {
      AwardID: r.AwardID,
      AwardName: r.AwardName,
      AwardOrder: order,
      TeamID: r.TeamID,
      TeamName: r.TeamName,
      School: r.School,
      ImageURL: r.ImageURL,
      VoteCount: Number(r.VoteCount || 0),
      teamRevealed: true,
    };
  }).filter(Boolean);

  return {
    published: true,
    revealIndex,
    revealedTeam,
    totalAwards,
    results: visible,
    eventName: c.eventName || '',
  };
}

/* ====================================================================
 * HELPERS
 * ==================================================================== */

function clearResultsSheet_() {
  const sheet = getSheet_('Results');
  const last = sheet.getLastRow();
  if (last < 2) return;
  sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).clearContent();
}

/* ====================================================================
 * EXPORT
 * ==================================================================== */

function exportData(payload) {
  validateAdmin_(payload.token);
  return {
    teams: getAllRows_('Teams'),
    judges: getAllRows_('Judges'),
    awards: getAllRows_('Awards'),
    votes: getAllRows_('Votes'),
    results: getAllRows_('Results'),
    config: getAllRows_('Config'),
  };
}

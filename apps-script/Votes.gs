/**
 * Votes.gs — รับคะแนนจากกรรมการรอบ 1 (จัดอันดับ) และรอบ 2 (เลือกรางวัล/ทีม)
 */

function submitRound1Vote(payload) {
  const token = payload.token;
  const rankings = payload.rankings || []; // array ของ TeamID ตามอันดับ 1..N
  const judge = validateJudgeToken_(token);
  if (Number(judge.Round) !== 1) throw new Error('Token นี้ไม่ใช่ของรอบ 1');
  if (toBool_(judge.Voted)) throw new Error('คุณได้ส่งคะแนนแล้ว ไม่สามารถแก้ไขได้');

  const config = getConfigMap_();
  if (!toBool_(config.round1Open)) throw new Error('รอบ 1 ยังไม่เปิดให้ลงคะแนน');

  const activeTeams = getAllRows_('Teams').filter(t => t.Status === 'Active');
  const n = activeTeams.length;
  const teamIds = new Set(activeTeams.map(t => t.TeamID));

  if (!Array.isArray(rankings) || rankings.length !== n) {
    throw new Error('ต้องจัดอันดับครบ ' + n + ' ทีม');
  }
  if (new Set(rankings).size !== n) throw new Error('มีทีมซ้ำในรายการ');
  for (const id of rankings) {
    if (!teamIds.has(id)) throw new Error('ไม่พบทีม: ' + id);
  }

  return withLock_(() => {
    // re-check ภายใน lock กัน race condition (double-submit พร้อมกัน)
    const fresh = getAllRows_('Judges').find(j => String(j.Token) === String(token));
    if (!fresh || toBool_(fresh.Voted)) throw new Error('คุณได้ส่งคะแนนแล้ว');

    deleteJudgeVotes_(judge.JudgeID, 1);

    const sheet = getSheet_('Round1Votes');
    const lastId = getLastVoteIdNum_('Round1Votes', 'R1V');
    const ts = nowIso_();
    const rows = rankings.map((teamId, idx) => {
      const rank = idx + 1;
      const points = n + 1 - rank; // 1→n, 2→n-1, ..., n→1
      return [
        'R1V' + String(lastId + idx + 1).padStart(4, '0'),
        judge.JudgeID,
        teamId,
        rank,
        points,
        ts,
      ];
    });
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);

    markJudgeVoted_(judge.JudgeID);
    return {};
  });
}

function submitRound2Vote(payload) {
  const token = payload.token;
  const votes = payload.votes || {}; // { teamId: awardId, ... }
  const judge = validateJudgeToken_(token);
  if (Number(judge.Round) !== 2) throw new Error('Token นี้ไม่ใช่ของรอบ 2');
  if (toBool_(judge.Voted)) throw new Error('คุณได้ส่งคะแนนแล้ว ไม่สามารถแก้ไขได้');

  const config = getConfigMap_();
  if (!toBool_(config.round2Open)) throw new Error('รอบ 2 ยังไม่เปิดให้ลงคะแนน');

  const activeTeams = getAllRows_('Teams').filter(t => t.Status === 'Active');
  const teamIds = new Set(activeTeams.map(t => t.TeamID));
  const awardIds = new Set(getAllRows_('Awards').filter(a => Number(a.Round) === 2).map(a => a.AwardID));

  const entries = Object.keys(votes).map(k => [k, votes[k]]);
  if (entries.length !== activeTeams.length) {
    throw new Error('ต้องเลือกรางวัลให้ครบทุกทีม (' + activeTeams.length + ' ทีม)');
  }
  for (const [teamId, awardId] of entries) {
    if (!teamIds.has(teamId)) throw new Error('ไม่พบทีม: ' + teamId);
    if (!awardIds.has(awardId)) throw new Error('ไม่พบรางวัล: ' + awardId);
  }

  return withLock_(() => {
    const fresh = getAllRows_('Judges').find(j => String(j.Token) === String(token));
    if (!fresh || toBool_(fresh.Voted)) throw new Error('คุณได้ส่งคะแนนแล้ว');

    deleteJudgeVotes_(judge.JudgeID, 2);

    const sheet = getSheet_('Round2Votes');
    const lastId = getLastVoteIdNum_('Round2Votes', 'R2V');
    const ts = nowIso_();
    const rows = entries.map(([teamId, awardId], idx) => [
      'R2V' + String(lastId + idx + 1).padStart(4, '0'),
      judge.JudgeID,
      teamId,
      awardId,
      ts,
    ]);
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);

    markJudgeVoted_(judge.JudgeID);
    return {};
  });
}

function getLastVoteIdNum_(sheetName, prefix) {
  const rows = getAllRows_(sheetName);
  if (rows.length === 0) return 0;
  return rows.reduce((max, r) => {
    const n = parseInt(String(r.VoteID).replace(prefix, ''), 10) || 0;
    return n > max ? n : max;
  }, 0);
}

function markJudgeVoted_(judgeId) {
  const rowIdx = findRowIndex_('Judges', 'JudgeID', judgeId);
  if (rowIdx === -1) return;
  const sheet = getSheet_('Judges');
  const headers = getHeaders_('Judges');
  sheet.getRange(rowIdx, headers.indexOf('Voted') + 1).setValue(true);
  sheet.getRange(rowIdx, headers.indexOf('VotedAt') + 1).setValue(nowIso_());
}

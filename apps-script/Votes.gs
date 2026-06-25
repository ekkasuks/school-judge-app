/**
 * Votes.gs — รับคะแนนโหวต (V2 — single round, per award)
 *
 * รูปแบบ payload:
 *   { judgeId, votes: [{ awardId, teamId }, ...] }  // ต้องครบทุกรางวัล
 *
 * กฎ:
 *   - 1 กรรมการ โหวต 1 ครั้ง (ทุกรางวัล) → สร้าง N แถวใน Votes
 *   - 1 กรรมการ ต่อ 1 รางวัล = 1 ทีม (unique (JudgeID, AwardID))
 *   - แต่ละกรรมการเลือกทีมเดียวกันให้หลายรางวัลได้ — เป็นเพียง "vote" ไม่ใช่ "assignment"
 *   - Voted=TRUE ล็อกถาวร (ต้องให้ admin ลบ/สร้างใหม่)
 */

function submitVote(payload) {
  const judgeId = payload.judgeId;
  const votes = payload.votes || [];

  if (!judgeId) throw new Error('ไม่ได้ระบุชื่อกรรมการ');

  const judge = getAllRows_('Judges').find(j =>
    j.JudgeID === judgeId && toBool_(j.Active)
  );
  if (!judge) throw new Error('ไม่พบกรรมการ');
  if (toBool_(judge.Voted)) throw new Error('คุณได้ส่งคะแนนแล้ว ไม่สามารถแก้ไขได้');

  const config = getConfigMap_();
  if (!toBool_(config.votingOpen)) throw new Error('ยังไม่เปิดให้ลงคะแนน');

  const awards = getAllRows_('Awards');
  const activeTeams = getAllRows_('Teams').filter(t => t.Status === 'Active');
  const awardIds = new Set(awards.map(a => a.AwardID));
  const teamIds = new Set(activeTeams.map(t => t.TeamID));

  if (!Array.isArray(votes) || votes.length !== awards.length) {
    throw new Error('ต้องโหวตครบทุกรางวัล (' + awards.length + ' รางวัล)');
  }

  const seenAwards = new Set();
  const seenTeams = new Set();
  for (const v of votes) {
    if (!v || !v.awardId || !v.teamId) throw new Error('ข้อมูลโหวตไม่ครบ');
    if (!awardIds.has(v.awardId)) throw new Error('ไม่พบรางวัล: ' + v.awardId);
    if (!teamIds.has(v.teamId)) throw new Error('ไม่พบทีม: ' + v.teamId);
    if (seenAwards.has(v.awardId)) throw new Error('รางวัลซ้ำ: ' + v.awardId);
    if (seenTeams.has(v.teamId)) throw new Error('ทีมซ้ำ: ' + v.teamId + ' — 1 กรรมการเลือก 1 ทีม ต่อ 1 รางวัล');
    seenAwards.add(v.awardId);
    seenTeams.add(v.teamId);
  }

  return withLock_(() => {
    // re-check ภายใน lock กัน race condition
    const fresh = getAllRows_('Judges').find(j => j.JudgeID === judgeId);
    if (!fresh || !toBool_(fresh.Active)) throw new Error('ไม่พบกรรมการ');
    if (toBool_(fresh.Voted)) throw new Error('คุณได้ส่งคะแนนแล้ว');

    const config2 = getConfigMap_();
    if (!toBool_(config2.votingOpen)) throw new Error('โหวตถูกปิดไปแล้ว');

    // ลบ vote เก่า (เผื่อมี partial)
    deleteJudgeVotes_(judgeId);

    const sheet = getSheet_('Votes');
    const lastId = getLastVoteIdNum_();
    const ts = nowIso_();
    const rows = votes.map((v, idx) => [
      'V' + String(lastId + idx + 1).padStart(4, '0'),
      judgeId,
      v.awardId,
      v.teamId,
      ts,
    ]);
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);

    markJudgeVoted_(judgeId);
    return { count: rows.length };
  });
}

function getLastVoteIdNum_() {
  const rows = getAllRows_('Votes');
  if (rows.length === 0) return 0;
  return rows.reduce((max, r) => {
    const n = parseInt(String(r.VoteID).replace('V', ''), 10) || 0;
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

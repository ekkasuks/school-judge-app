/**
 * Judges.gs — CRUD กรรมการ (V2)
 *
 * V2: ลบ Round/Token/resetJudgeToken ทิ้ง
 *     ใช้ Order แทน Round (ลำดับแสดงในรายการเลือกชื่อ)
 *     กรรมการ identify ผ่าน JudgeID (ไม่มี secret)
 */

function getJudges(payload) {
  validateAdmin_(payload.token);
  const judges = getAllRows_('Judges')
    .filter(j => toBool_(j.Active))
    .sort((a, b) => Number(a.Order) - Number(b.Order));
  return { judges };
}

function saveJudge(payload) {
  validateAdmin_(payload.token);
  const judge = payload.judge || {};

  return withLock_(() => {
    const sheet = getSheet_('Judges');
    const headers = getHeaders_('Judges');

    if (judge.JudgeID) {
      // update — อนุญาตเฉพาะชื่อ
      const rowIdx = findRowIndex_('Judges', 'JudgeID', judge.JudgeID);
      if (rowIdx === -1) throw new Error('ไม่พบกรรมการ');
      if (judge.JudgeName !== undefined) {
        sheet.getRange(rowIdx, headers.indexOf('JudgeName') + 1).setValue(judge.JudgeName);
      }
      return { judgeId: judge.JudgeID };
    }

    // สร้างใหม่
    const existing = getAllRows_('Judges');
    // gen JudgeID ตามเลขสูงสุด + 1 (กัน ID ซ้ำเมื่อมีการลบไป)
    const maxNum = existing.reduce((m, j) => {
      const n = parseInt(String(j.JudgeID).replace('J', ''), 10) || 0;
      return n > m ? n : m;
    }, 0);
    const judgeId = 'J' + String(maxNum + 1).padStart(2, '0');
    const order = existing.length === 0
      ? 1
      : Math.max.apply(null, existing.map(j => Number(j.Order) || 0)) + 1;

    sheet.appendRow([
      judgeId,
      judge.JudgeName || '',
      order,
      false,    // Voted
      '',       // VotedAt
      true,     // Active
    ]);
    return { judgeId };
  });
}

function deleteJudge(payload) {
  validateAdmin_(payload.token);
  const judgeId = payload.judgeId;

  return withLock_(() => {
    const rowIdx = findRowIndex_('Judges', 'JudgeID', judgeId);
    if (rowIdx === -1) throw new Error('ไม่พบกรรมการ');
    const sheet = getSheet_('Judges');
    const headers = getHeaders_('Judges');
    sheet.getRange(rowIdx, headers.indexOf('Active') + 1).setValue(false);
    // ลบ vote ที่กรรมการคนนี้ลงไว้
    deleteJudgeVotes_(judgeId);
    // และ reset Voted=FALSE
    sheet.getRange(rowIdx, headers.indexOf('Voted') + 1).setValue(false);
    sheet.getRange(rowIdx, headers.indexOf('VotedAt') + 1).setValue('');
    return {};
  });
}

function reorderJudges(payload) {
  validateAdmin_(payload.token);
  const judgeIds = payload.judgeIds || [];

  return withLock_(() => {
    const sheet = getSheet_('Judges');
    const headers = getHeaders_('Judges');
    const orderCol = headers.indexOf('Order') + 1;
    judgeIds.forEach((id, i) => {
      const rowIdx = findRowIndex_('Judges', 'JudgeID', id);
      if (rowIdx > 0) sheet.getRange(rowIdx, orderCol).setValue(i + 1);
    });
    return {};
  });
}

/* ====================================================================
 * INTERNAL
 * ==================================================================== */

function deleteJudgeVotes_(judgeId) {
  const sheet = getSheet_('Votes');
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return;
  // col B (index 1) = JudgeID
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][1]) === String(judgeId)) sheet.deleteRow(i + 1);
  }
}

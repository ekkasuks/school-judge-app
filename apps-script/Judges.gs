/**
 * Judges.gs — CRUD กรรมการ + token management
 */

function getJudges(payload) {
  validateAdmin_(payload.token);
  const judges = getAllRows_('Judges').filter(j => toBool_(j.Active));
  return { judges };
}

function saveJudge(payload) {
  validateAdmin_(payload.token);
  const judge = payload.judge || {};

  return withLock_(() => {
    const sheet = getSheet_('Judges');
    const headers = getHeaders_('Judges');

    if (judge.JudgeID) {
      const rowIdx = findRowIndex_('Judges', 'JudgeID', judge.JudgeID);
      if (rowIdx === -1) throw new Error('ไม่พบกรรมการ');
      // อนุญาตให้แก้ชื่อเท่านั้น (ไม่ให้แก้ Round เพราะกระทบ token)
      if (judge.JudgeName !== undefined) {
        sheet.getRange(rowIdx, headers.indexOf('JudgeName') + 1).setValue(judge.JudgeName);
      }
      return { judgeId: judge.JudgeID };
    }

    // สร้างใหม่
    const round = Number(judge.Round) || 1;
    if (round !== 1 && round !== 2) throw new Error('Round ต้องเป็น 1 หรือ 2');

    const existing = getAllRows_('Judges');
    const nextNum = existing.length + 1;
    const judgeId = 'J' + String(nextNum).padStart(2, '0');
    const token = generateJudgeToken_(round);

    sheet.appendRow([
      judgeId,
      judge.JudgeName || '',
      round,
      token,
      false,
      '',
      true,
      nowIso_(),
    ]);
    return { judgeId, token };
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
    // ลบคะแนนที่ลงไว้แล้วด้วย
    const judge = getAllRows_('Judges').find(j => j.JudgeID === judgeId);
    if (judge) deleteJudgeVotes_(judgeId, Number(judge.Round));
    return {};
  });
}

function resetJudgeToken(payload) {
  validateAdmin_(payload.token);
  const judgeId = payload.judgeId;

  return withLock_(() => {
    const rowIdx = findRowIndex_('Judges', 'JudgeID', judgeId);
    if (rowIdx === -1) throw new Error('ไม่พบกรรมการ');
    const judge = getAllRows_('Judges').find(j => j.JudgeID === judgeId);
    const round = Number(judge.Round);
    const newToken = generateJudgeToken_(round);

    const sheet = getSheet_('Judges');
    const headers = getHeaders_('Judges');
    sheet.getRange(rowIdx, headers.indexOf('Token') + 1).setValue(newToken);
    sheet.getRange(rowIdx, headers.indexOf('Voted') + 1).setValue(false);
    sheet.getRange(rowIdx, headers.indexOf('VotedAt') + 1).setValue('');

    deleteJudgeVotes_(judgeId, round);
    return { token: newToken };
  });
}

function generateJudgeToken_(round) {
  // 6-hex สั้นพอที่จะจำได้ + พิมพ์ใหม่ได้, ตรวจซ้ำกับฐานเดิม
  const existingTokens = new Set(getAllRows_('Judges').map(j => j.Token));
  for (let attempt = 0; attempt < 20; attempt++) {
    const suffix = Utilities.getUuid().replace(/-/g, '').slice(0, 6);
    const token = 'judge-r' + round + '-' + suffix;
    if (!existingTokens.has(token)) return token;
  }
  throw new Error('สร้าง token ไม่สำเร็จ (ลองใหม่)');
}

function deleteJudgeVotes_(judgeId, round) {
  const sheetName = round === 1 ? 'Round1Votes' : 'Round2Votes';
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return;
  // col B (index 1) = JudgeID — ลบจากล่างขึ้นบน
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][1]) === String(judgeId)) sheet.deleteRow(i + 1);
  }
}

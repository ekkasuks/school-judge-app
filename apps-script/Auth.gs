/**
 * Auth.gs — Admin login + session, Judge listing + context (V2)
 *
 * V2: ลบ judge token system ทิ้ง — กรรมการเลือกชื่อตัวเองในแอป
 *     identity เก็บใน localStorage ฝั่ง client
 *     server กัน double-submit ที่ `Voted` flag ภายใน LockService
 */

/* ====================================================================
 * ADMIN
 * ==================================================================== */

function adminLogin(payload) {
  const password = payload.password;
  const expected = getProp_('ADMIN_PASSWORD');
  if (!expected) throw new Error('ADMIN_PASSWORD ยังไม่ถูกตั้งค่าใน Script Properties');
  if (!password || String(password) !== String(expected)) {
    throw new Error('รหัสผ่านไม่ถูกต้อง');
  }

  return withLock_(() => {
    cleanExpiredSessions_();
    const token = Utilities.getUuid();
    const created = new Date();
    const expires = new Date(created.getTime() + 8 * 3600 * 1000);
    getSheet_('Sessions').appendRow([
      token,
      'admin',
      Utilities.formatDate(created, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"),
      Utilities.formatDate(expires, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"),
    ]);
    return { token };
  });
}

function validateAdmin_(token) {
  if (!token) throw new Error('ต้องเข้าสู่ระบบ admin');
  const session = getAllRows_('Sessions').find(s =>
    String(s.Token) === String(token) && s.Role === 'admin'
  );
  if (!session) throw new Error('Session ไม่ถูกต้อง');
  if (new Date(session.ExpiresAt) < new Date()) {
    throw new Error('Session หมดอายุ');
  }
  return true;
}

function cleanExpiredSessions_() {
  const sheet = getSheet_('Sessions');
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return;
  const now = new Date();
  for (let i = values.length - 1; i >= 1; i--) {
    const exp = values[i][3];
    if (exp && new Date(exp) < now) sheet.deleteRow(i + 1);
  }
}

/* ====================================================================
 * JUDGE — PUBLIC ENDPOINTS
 * ==================================================================== */

/**
 * getJudgesList — public, ไม่ต้องมี token
 *   ส่งรายชื่อกรรมการ + flag ว่าโหวตแล้วหรือยัง
 *   ใช้ในหน้า "เลือกชื่อ" ของกรรมการ
 */
function getJudgesList(_payload) {
  const judges = getAllRows_('Judges')
    .filter(j => toBool_(j.Active))
    .sort((a, b) => Number(a.Order) - Number(b.Order));
  const config = getConfigMap_();
  return {
    judges: judges.map(j => ({
      JudgeID: j.JudgeID,
      JudgeName: j.JudgeName,
      Order: Number(j.Order),
      Voted: toBool_(j.Voted),
    })),
    votingOpen: toBool_(config.votingOpen),
    eventName: config.eventName || '',
  };
}

/**
 * getVoteContext — public, รับ judgeId แล้วส่งข้อมูลทั้งหมดที่ใช้ render หน้าโหวต
 */
function getVoteContext(payload) {
  const judgeId = payload.judgeId;
  if (!judgeId) throw new Error('ไม่ได้ระบุชื่อกรรมการ');

  const judge = getAllRows_('Judges').find(j =>
    j.JudgeID === judgeId && toBool_(j.Active)
  );
  if (!judge) throw new Error('ไม่พบกรรมการ');

  const config = getConfigMap_();

  const teams = getAllRows_('Teams')
    .filter(t => t.Status === 'Active')
    .sort((a, b) => Number(a.Order) - Number(b.Order));

  const awards = getAllRows_('Awards')
    .sort((a, b) => Number(a.Order) - Number(b.Order));

  return {
    judge: {
      JudgeID: judge.JudgeID,
      JudgeName: judge.JudgeName,
      Voted: toBool_(judge.Voted),
      VotedAt: judge.VotedAt,
    },
    votingOpen: toBool_(config.votingOpen),
    teams,
    awards,
    eventName: config.eventName || '',
  };
}

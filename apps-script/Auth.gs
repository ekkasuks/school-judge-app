/**
 * Auth.gs — Admin login, judge token validation, session cleanup
 */

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

function validateJudgeToken_(token) {
  if (!token) throw new Error('ไม่พบ token');
  const judge = getAllRows_('Judges').find(j =>
    String(j.Token) === String(token) && toBool_(j.Active)
  );
  if (!judge) throw new Error('Token กรรมการไม่ถูกต้องหรือถูกยกเลิก');
  return judge;
}

function cleanExpiredSessions_() {
  const sheet = getSheet_('Sessions');
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return;
  const now = new Date();
  for (let i = values.length - 1; i >= 1; i--) {
    const exp = values[i][3]; // col D = ExpiresAt
    if (exp && new Date(exp) < now) sheet.deleteRow(i + 1);
  }
}

/**
 * getJudgeContext — judge เปิดลิงก์ → ส่ง token มา → ได้ข้อมูลทุกอย่างที่ใช้ render หน้า vote
 */
function getJudgeContext(payload) {
  const judge = validateJudgeToken_(payload.token);
  const config = getConfigMap_();
  const round = Number(judge.Round);
  const roundOpenKey = round === 1 ? 'round1Open' : 'round2Open';
  const roundOpen = toBool_(config[roundOpenKey]);

  const teams = getAllRows_('Teams')
    .filter(t => t.Status === 'Active')
    .sort((a, b) => Number(a.Order) - Number(b.Order));

  const awards = round === 2
    ? getAllRows_('Awards')
        .filter(a => Number(a.Round) === 2)
        .sort((a, b) => Number(a.Order) - Number(b.Order))
    : [];

  return {
    judge: {
      JudgeID: judge.JudgeID,
      JudgeName: judge.JudgeName,
      Round: round,
      Voted: toBool_(judge.Voted),
      VotedAt: judge.VotedAt,
    },
    round,
    roundOpen,
    teams,
    awards,
    eventName: config.eventName || '',
  };
}

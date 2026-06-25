/**
 * Init.gs — สร้าง Spreadsheet ให้พร้อมใช้งานในคลิกเดียว (V2)
 *
 * วิธีใช้:
 *   1. สร้าง Google Spreadsheet ใหม่
 *   2. Extensions → Apps Script → paste โค้ดทั้งหมด
 *   3. ตั้ง Script Properties:
 *        SPREADSHEET_ID = id ของ spreadsheet
 *        ADMIN_PASSWORD = รหัสผ่าน admin
 *        DRIVE_FOLDER_ID = folder ของ Drive สำหรับเก็บรูป
 *   4. รัน initSpreadsheet() ครั้งเดียว
 *   5. (ทางเลือก) รัน seedSampleTeams() เพิ่มทีมตัวอย่าง 6 ทีม
 *   6. Deploy → New deployment → Web app
 *        Execute as: Me
 *        Who has access: Anyone
 *   7. คัดลอก Web App URL → ใส่ใน /js/config.js
 *
 * ⚠️ initSpreadsheet() จะ **clear** ทุก sheet — ใช้ตอนเริ่มต้นเท่านั้น
 */

function initSpreadsheet() {
  const ss = getSS_();

  const sheets = [
    { name: 'Teams',    headers: ['TeamID','TeamNumber','TeamName','School','ImageURL','ImageFileID','Order','Status','CreatedAt','UpdatedAt'] },
    { name: 'Judges',   headers: ['JudgeID','JudgeName','Order','Voted','VotedAt','Active'] },
    { name: 'Awards',   headers: ['AwardID','AwardName','Order'] },
    { name: 'Votes',    headers: ['VoteID','JudgeID','AwardID','TeamID','SubmittedAt'] },
    { name: 'Results',  headers: ['ResultID','AwardID','AwardName','AwardOrder','TeamID','TeamName','School','ImageURL','VoteCount','ComputedAt','Note'] },
    { name: 'Config',   headers: ['Key','Value','Description','UpdatedAt'] },
    { name: 'Sessions', headers: ['Token','Role','CreatedAt','ExpiresAt'] },
  ];

  sheets.forEach(s => {
    let sheet = ss.getSheetByName(s.name);
    if (!sheet) {
      sheet = ss.insertSheet(s.name);
    } else {
      sheet.clear();
    }
    sheet.getRange(1, 1, 1, s.headers.length).setValues([s.headers]);
    sheet.getRange(1, 1, 1, s.headers.length).setFontWeight('bold').setBackground('#e8eaf6');
    sheet.setFrozenRows(1);
  });

  // ลบ Sheet1 ที่ Google สร้างให้ตอน new spreadsheet
  const def = ss.getSheetByName('Sheet1') || ss.getSheetByName('ชีต1');
  if (def && ss.getSheets().length > 1) {
    ss.deleteSheet(def);
  }

  // ── Seed: Awards (6 รางวัล) ──
  const awardsSheet = ss.getSheetByName('Awards');
  awardsSheet.getRange(2, 1, 6, 3).setValues([
    ['A1', 'หลอนชุด ไม่หลอนยา',   1],
    ['A2', 'พลังจิ๋วแต่แจ๋ว',      2],
    ['A3', 'เด็กทรงดี ไม่มีทรงยา', 3],
    ['A4', 'โอ้โห ! ทำไปได้',       4],
    ['A5', 'เจ้าหนูพลังบวก',       5],
    ['A6', 'ตัวตึงไม่พึ่งผง',       6],
  ]);

  // ── Seed: Judges (11 คนตามรายชื่อจริง) ──
  const judgesSheet = ss.getSheetByName('Judges');
  const judgeNames = [
    'ครูชมพู่', 'ครูอ้อม', 'ครูอ้อน', 'ครูดาว',
    'ครูแนน', 'ครูน๊อต', 'ครูดิว', 'ครูเอก',
    'ครูเบียร์', 'ครูสา', 'ผอ.',
  ];
  const judgeRows = judgeNames.map((name, i) => [
    'J' + String(i + 1).padStart(2, '0'),
    name,
    i + 1,    // Order
    false,    // Voted
    '',       // VotedAt
    true,     // Active
  ]);
  judgesSheet.getRange(2, 1, judgeRows.length, 6).setValues(judgeRows);

  // ── Seed: Config (7 keys) ──
  const configSheet = ss.getSheetByName('Config');
  const ts = nowIso_();
  configSheet.getRange(2, 1, 7, 4).setValues([
    ['eventName',         'การประกวดชุดต่อต้านยาเสพติด - โรงเรียนบ้านใหม่', 'ชื่องาน',                                                     ts],
    ['eventDate',         '2026-06-26',                                      'วันจัดงาน (yyyy-mm-dd)',                                       ts],
    ['votingOpen',        'FALSE',                                            'เปิดให้กรรมการลงคะแนน (กดปิด = auto-คำนวณ Hungarian)',           ts],
    ['voteComputed',      'FALSE',                                            'คำนวณ Hungarian แล้ว',                                         ts],
    ['resultsPublished',  'FALSE',                                            'เริ่ม TV reveal mode',                                          ts],
    ['revealIndex',       '0',                                                'รางวัลที่ reveal แล้ว (0..N)',                                  ts],
    ['revealedTeam',      'FALSE',                                            'ในรางวัลปัจจุบัน เปิดทีมแล้วหรือยัง',                            ts],
  ]);

  Logger.log('Init complete (V2). Sheets: ' + ss.getSheets().map(s => s.getName()).join(', '));
  Logger.log('Seeded: 6 awards + 11 judges + 7 config keys');
}

/**
 * seedSampleTeams — เพิ่มทีม 6 ทีมตัวอย่างสำหรับทดสอบ
 * เรียกแยกหลัง initSpreadsheet ถ้าต้องการ
 */
function seedSampleTeams() {
  const ts = nowIso_();
  const teamsSheet = getSheet_('Teams');
  const rows = [];
  for (let i = 1; i <= 6; i++) {
    rows.push([
      'T' + i,
      i,
      'ทีมตัวอย่าง ' + i,
      'โรงเรียนบ้านใหม่',
      '',
      '',
      i,
      'Active',
      ts,
      ts,
    ]);
  }
  teamsSheet.getRange(2, 1, rows.length, 10).setValues(rows);
  Logger.log('Seeded ' + rows.length + ' sample teams');
}

/**
 * Init.gs — สร้าง Spreadsheet ทั้งหมดให้พร้อมใช้งานในคลิกเดียว
 *
 * วิธีใช้:
 *   1. สร้าง Google Spreadsheet ใหม่ (เปิดเปล่า ๆ ก็พอ)
 *   2. Extensions → Apps Script → paste โค้ดทั้งหมด
 *   3. ตั้ง Script Properties:
 *        SPREADSHEET_ID = id ของ spreadsheet ที่เพิ่งสร้าง
 *        ADMIN_PASSWORD = รหัสผ่าน admin
 *        DRIVE_FOLDER_ID = folder ของ Drive สำหรับเก็บรูป (สร้างเอง)
 *   4. รัน initSpreadsheet() ครั้งเดียว
 *   5. Deploy → New deployment → Web app
 *        Execute as: Me
 *        Who has access: Anyone
 *   6. copy Web app URL → ใส่ใน /js/config.js
 */

function initSpreadsheet() {
  const ss = getSS_();

  const sheets = [
    { name: 'Teams', headers: ['TeamID','TeamNumber','TeamName','School','ImageURL','ImageFileID','Order','Status','CreatedAt','UpdatedAt'] },
    { name: 'Judges', headers: ['JudgeID','JudgeName','Round','Token','Voted','VotedAt','Active','CreatedAt'] },
    { name: 'Awards', headers: ['AwardID','AwardName','Round','Order'] },
    { name: 'Round1Votes', headers: ['VoteID','JudgeID','TeamID','Rank','Points','SubmittedAt'] },
    { name: 'Round2Votes', headers: ['VoteID','JudgeID','TeamID','AwardID','SubmittedAt'] },
    { name: 'Results', headers: ['ResultID','Round','AwardID','AwardName','TeamID','TeamName','School','ImageURL','Score','ComputedAt','Note'] },
    { name: 'Config', headers: ['Key','Value','Description','UpdatedAt'] },
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

  // ลบ Sheet1 ถ้ายังอยู่
  const def = ss.getSheetByName('Sheet1') || ss.getSheetByName('ชีต1');
  if (def && ss.getSheets().length > 1) {
    ss.deleteSheet(def);
  }

  // Seed: Awards
  const awardsSheet = ss.getSheetByName('Awards');
  awardsSheet.getRange(2, 1, 7, 4).setValues([
    ['A1', 'น่ารักจนกรรมการใจละลาย', 1, 1],
    ['A2', 'หลอนชุด ไม่หลอนยา',      2, 1],
    ['A3', 'พลังจิ๋วแต่แจ๋ว',        2, 2],
    ['A4', 'เด็กทรงดี ไม่มีทรงยา',   2, 3],
    ['A5', 'โอ้โห ! ทำไปได้',         2, 4],
    ['A6', 'เจ้าหนูพลังบวก',         2, 5],
    ['A7', 'ตัวตึงไม่พึ่งผง',         2, 6],
  ]);

  // Seed: Config
  const configSheet = ss.getSheetByName('Config');
  const ts = nowIso_();
  configSheet.getRange(2, 1, 8, 4).setValues([
    ['eventName',         'การประกวดชุดต่อต้านยาเสพติด - โรงเรียนบ้านใหม่', 'ชื่องาน',                ts],
    ['eventDate',         '2026-06-26',                                      'วันจัดงาน (yyyy-mm-dd)', ts],
    ['round1Open',        'FALSE',                                            'เปิดให้กรรมการรอบ 1 ลงคะแนน', ts],
    ['round2Open',        'FALSE',                                            'เปิดให้กรรมการรอบ 2 ลงคะแนน', ts],
    ['round1Computed',    'FALSE',                                            'คำนวณรอบ 1 แล้ว',        ts],
    ['round2Computed',    'FALSE',                                            'คำนวณรอบ 2 แล้ว',        ts],
    ['resultsPublished',  'FALSE',                                            'เผยแพร่ผลในหน้า public', ts],
    ['currentRound',      '1',                                                'รอบปัจจุบัน',             ts],
  ]);

  Logger.log('Init complete. Sheets: ' + ss.getSheets().map(s => s.getName()).join(', '));
}

/**
 * seedSampleData — เพิ่มข้อมูลตัวอย่าง (7 ทีม + 3+7 กรรมการ) สำหรับทดสอบ
 * เรียกหลัง initSpreadsheet() แล้ว
 */
function seedSampleData() {
  const ts = nowIso_();
  const teamsSheet = getSheet_('Teams');
  const sampleTeams = [];
  for (let i = 1; i <= 7; i++) {
    sampleTeams.push([
      'T' + String(i).padStart(2, '0'),
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
  teamsSheet.getRange(2, 1, sampleTeams.length, 10).setValues(sampleTeams);

  const judgesSheet = getSheet_('Judges');
  const sampleJudges = [];
  let n = 1;
  for (let r = 1; r <= 2; r++) {
    const count = r === 1 ? 3 : 7;
    for (let i = 1; i <= count; i++) {
      const id = 'J' + String(n).padStart(2, '0');
      const suffix = Utilities.getUuid().replace(/-/g, '').slice(0, 6);
      sampleJudges.push([
        id,
        'กรรมการรอบ ' + r + ' คนที่ ' + i,
        r,
        'judge-r' + r + '-' + suffix,
        false,
        '',
        true,
        ts,
      ]);
      n++;
    }
  }
  judgesSheet.getRange(2, 1, sampleJudges.length, 8).setValues(sampleJudges);

  Logger.log('Seeded ' + sampleTeams.length + ' teams, ' + sampleJudges.length + ' judges');
}

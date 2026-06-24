/**
 * Code.gs — Entry point + router + helpers
 *
 * Web App endpoint: doPost
 * - รับ JSON body: { action, payload }
 * - ส่ง content-type: text/plain (เลี่ยง CORS preflight)
 * - คืน JSON: { ok, ...data } หรือ { ok: false, error }
 */

const TZ = 'Asia/Bangkok';

function getProp_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function getSS_() {
  const id = getProp_('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_ID property ยังไม่ถูกตั้งค่า');
  return SpreadsheetApp.openById(id);
}

function getSheet_(name) {
  const sheet = getSS_().getSheetByName(name);
  if (!sheet) throw new Error('ไม่พบ sheet: ' + name);
  return sheet;
}

function getAllRows_(sheetName) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function getHeaders_(sheetName) {
  const sheet = getSheet_(sheetName);
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function findRowIndex_(sheetName, key, value) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return -1;
  const colIndex = values[0].indexOf(key);
  if (colIndex === -1) return -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][colIndex]) === String(value)) return i + 1;
  }
  return -1;
}

function nowIso_() {
  return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function toBool_(v) {
  return v === true || v === 'TRUE' || v === 'true' || v === 1;
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('ระบบกำลังบันทึก โปรดลองอีกครั้ง');
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ----- HTTP entry points ----- */

function doGet(_e) {
  return jsonResponse_({ ok: true, message: 'API running', version: '1.0.0' });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const payload = body.payload || {};
    if (!action) throw new Error('ต้องระบุ action');

    const handler = ROUTES[action];
    if (!handler) throw new Error('Unknown action: ' + action);

    const result = handler(payload) || {};
    return jsonResponse_({ ok: true, ...result });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message || String(err) });
  }
}

/* ----- Router ----- */

const ROUTES = {
  // Auth & context
  adminLogin: adminLogin,
  getJudgeContext: getJudgeContext,

  // Teams (admin)
  getTeams: getTeams,
  saveTeam: saveTeam,
  deleteTeam: deleteTeam,
  reorderTeams: reorderTeams,
  uploadImage: uploadImage,

  // Judges (admin)
  getJudges: getJudges,
  saveJudge: saveJudge,
  resetJudgeToken: resetJudgeToken,
  deleteJudge: deleteJudge,

  // Votes (judge)
  submitRound1Vote: submitRound1Vote,
  submitRound2Vote: submitRound2Vote,

  // Results & dashboard (admin)
  getDashboard: getDashboard,
  computeRound1: computeRound1,
  setRound1Winner: setRound1Winner,
  computeRound2: computeRound2,
  setRound2Results: setRound2Results,
  getAdminResults: getAdminResults,
  publishResults: publishResults,

  // Public
  getResults: getResults,
  getConfig: getConfig,

  // Config (admin)
  setConfig: setConfig,

  // Export (admin)
  exportData: exportData,
};

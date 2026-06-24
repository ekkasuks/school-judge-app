/**
 * Config.gs — key-value config + helper
 */

function getConfigMap_() {
  const rows = getAllRows_('Config');
  const map = {};
  rows.forEach(r => { map[r.Key] = r.Value; });
  return map;
}

function getConfig(_payload) {
  // public — กรอง keys ที่ไม่ควรเปิด (ตอนนี้ไม่มี secret ใน Config)
  return { config: getConfigMap_() };
}

function setConfig(payload) {
  validateAdmin_(payload.token);
  return withLock_(() => {
    setConfigKey_(payload.key, payload.value);
    return {};
  });
}

function setConfigKey_(key, value) {
  const sheet = getSheet_('Config');
  const rowIdx = findRowIndex_('Config', 'Key', key);
  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 2).setValue(value);
    sheet.getRange(rowIdx, 4).setValue(nowIso_());
  } else {
    sheet.appendRow([key, value, '', nowIso_()]);
  }
}

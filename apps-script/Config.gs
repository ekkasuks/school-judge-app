/**
 * Config.gs — key-value config + auto-trigger
 *
 * V2 highlights:
 *   - เมื่อ admin set votingOpen=FALSE → auto-เรียก computeResultsInternal_
 *   - เมื่อ admin set votingOpen=TRUE หลังคำนวณแล้ว → reset voteComputed + revealIndex
 */

function getConfigMap_() {
  const rows = getAllRows_('Config');
  const map = {};
  rows.forEach(r => { map[r.Key] = r.Value; });
  return map;
}

function getConfig(_payload) {
  return { config: getConfigMap_() };
}

function setConfig(payload) {
  validateAdmin_(payload.token);
  const { key, value } = payload;
  if (!key) throw new Error('ต้องระบุ key');

  return withLock_(() => {
    const oldValue = getConfigMap_()[key];
    setConfigKey_(key, value);

    // ── auto-trigger: ปิดโหวต → คำนวณ Hungarian ──
    if (key === 'votingOpen' && !toBool_(value) && toBool_(oldValue)) {
      try {
        const result = computeResultsInternal_();
        return { computed: true, count: result.count };
      } catch (err) {
        // ถ้าคำนวณ fail (ทีมยังไม่ครบ, ฯลฯ) — ไม่ throw, แต่แจ้งกลับ
        Logger.log('auto-compute failed: ' + err.message);
        return { computed: false, computeError: err.message };
      }
    }

    // ── auto-trigger: เปิดโหวตใหม่หลังคำนวณแล้ว → reset ──
    if (key === 'votingOpen' && toBool_(value) && !toBool_(oldValue)) {
      // ถ้าเคยคำนวณแล้ว → admin อาจอยากแก้คำตอบ → reset state
      const c = getConfigMap_();
      if (toBool_(c.voteComputed) || toBool_(c.resultsPublished)) {
        setConfigKey_('voteComputed', 'FALSE');
        setConfigKey_('resultsPublished', 'FALSE');
        setConfigKey_('revealIndex', '0');
        setConfigKey_('revealedTeam', 'FALSE');
        clearResultsSheet_();
        return { reset: true };
      }
    }

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

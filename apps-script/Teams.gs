/**
 * Teams.gs — CRUD ทีม + อัปโหลดรูปไป Drive
 */

function getTeams(payload) {
  // public-readable (ไม่ต้อง token) — กรอง Removed ทิ้ง
  const teams = getAllRows_('Teams')
    .filter(t => t.Status !== 'Removed')
    .sort((a, b) => Number(a.Order) - Number(b.Order));
  return { teams };
}

function saveTeam(payload) {
  validateAdmin_(payload.token);
  const team = payload.team || {};

  return withLock_(() => {
    const sheet = getSheet_('Teams');
    const headers = getHeaders_('Teams');

    if (team.TeamID) {
      const rowIdx = findRowIndex_('Teams', 'TeamID', team.TeamID);
      if (rowIdx === -1) throw new Error('ไม่พบทีม ' + team.TeamID);
      // อัปเดตเฉพาะ field ที่อนุญาตให้แก้
      ['TeamNumber', 'TeamName', 'School', 'ImageURL', 'ImageFileID'].forEach(h => {
        if (team[h] !== undefined) {
          sheet.getRange(rowIdx, headers.indexOf(h) + 1).setValue(team[h]);
        }
      });
      sheet.getRange(rowIdx, headers.indexOf('UpdatedAt') + 1).setValue(nowIso_());
      return { teamId: team.TeamID };
    }

    // สร้างใหม่
    const existing = getAllRows_('Teams');
    const nextNum = existing.length + 1;
    const teamId = 'T' + String(nextNum).padStart(2, '0');
    const order = existing.length === 0
      ? 1
      : Math.max.apply(null, existing.map(t => Number(t.Order) || 0)) + 1;

    sheet.appendRow([
      teamId,
      team.TeamNumber || nextNum,
      team.TeamName || '',
      team.School || '',
      team.ImageURL || '',
      team.ImageFileID || '',
      order,
      'Active',
      nowIso_(),
      nowIso_(),
    ]);
    return { teamId };
  });
}

function deleteTeam(payload) {
  validateAdmin_(payload.token);
  const teamId = payload.teamId;

  return withLock_(() => {
    const rowIdx = findRowIndex_('Teams', 'TeamID', teamId);
    if (rowIdx === -1) throw new Error('ไม่พบทีม');
    const sheet = getSheet_('Teams');
    const headers = getHeaders_('Teams');
    sheet.getRange(rowIdx, headers.indexOf('Status') + 1).setValue('Removed');
    sheet.getRange(rowIdx, headers.indexOf('UpdatedAt') + 1).setValue(nowIso_());
    return {};
  });
}

function reorderTeams(payload) {
  validateAdmin_(payload.token);
  const teamIds = payload.teamIds || [];

  return withLock_(() => {
    const sheet = getSheet_('Teams');
    const headers = getHeaders_('Teams');
    const orderCol = headers.indexOf('Order') + 1;
    teamIds.forEach((id, i) => {
      const rowIdx = findRowIndex_('Teams', 'TeamID', id);
      if (rowIdx > 0) sheet.getRange(rowIdx, orderCol).setValue(i + 1);
    });
    return {};
  });
}

/**
 * uploadImage — รับรูป base64 → อัปไป Drive folder → คืน URL
 * payload: { token, filename, base64, mimeType }
 */
function uploadImage(payload) {
  validateAdmin_(payload.token);
  const folderId = getProp_('DRIVE_FOLDER_ID');
  if (!folderId) throw new Error('DRIVE_FOLDER_ID ยังไม่ถูกตั้งค่า');

  const folder = DriveApp.getFolderById(folderId);
  const bytes = Utilities.base64Decode(payload.base64);
  const blob = Utilities.newBlob(bytes, payload.mimeType || 'image/jpeg', payload.filename || 'team.jpg');
  const file = folder.createFile(blob);

  // setSharing อาจ fail ใน Google Workspace ที่ admin ปิด external sharing —
  // ปล่อยผ่าน เพราะ folder ที่ user แชร์เป็น "Anyone with link" อยู่แล้ว
  // จะ inherit permission ให้ไฟล์โดยอัตโนมัติ
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    Logger.log('setSharing fallback to folder inherit: ' + e.message);
  }

  const fileId = file.getId();
  return {
    fileId,
    // ใช้ thumbnail URL — embed ใน <img> ได้เสถียรกว่า uc?export=view
    // (Google บล็อก uc?export ในหลาย account ทำให้รูปไม่โหลด)
    url: 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w800',
  };
}

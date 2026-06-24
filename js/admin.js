/**
 * admin.js — logic ของ Admin Panel
 *
 * โครงสร้าง:
 *   - login()
 *   - boot() → init UI หลัง login
 *   - refreshDashboard() ทุก 5 วินาที
 *   - Tab handlers: teams / judges / controls
 */

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

const state = {
  config: {},
  teams: [],
  judges: [],
  refreshTimer: null,
  currentTab: 'dashboard',
};

/* ====================================================================
 * LOGIN
 * ==================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // ลอง auto-resume
  if (getAdminToken()) {
    boot();
  } else {
    $('#login-screen').hidden = false;
  }

  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const password = $('#login-password').value;
    try {
      showBlocker('กำลังเข้าสู่ระบบ...');
      const data = await api('adminLogin', { password });
      setAdminToken(data.token);
      $('#login-screen').hidden = true;
      boot();
    } catch (err) {
      showError(err);
    } finally {
      hideBlocker();
    }
  });

  $('#logout-btn').addEventListener('click', () => {
    clearAdminToken();
    location.reload();
  });
});

/* ====================================================================
 * BOOT
 * ==================================================================== */

async function boot() {
  $('#app-screen').hidden = false;
  bindTabs();
  bindTeamUI();
  bindJudgeUI();
  bindToggles();
  bindLinkModal();
  bindResultsUI();
  $('#export-pdf-btn')?.addEventListener('click', exportPDF);
  $('#export-xlsx-btn')?.addEventListener('click', exportXLSX);

  try {
    await loadConfig();
    await Promise.all([loadTeams(), loadJudges(), refreshDashboard()]);
  } catch (err) {
    showError(err);
    if (err.message?.includes('Session')) {
      clearAdminToken();
      location.reload();
    }
  }

  // realtime
  state.refreshTimer = setInterval(refreshDashboard, 5000);
}

/* ====================================================================
 * TABS
 * ==================================================================== */

function bindTabs() {
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  switchTab('dashboard');
}

function switchTab(name) {
  state.currentTab = name;
  $$('.tab-btn').forEach(b => {
    if (b.dataset.tab === name) b.classList.add('tab-active');
    else b.classList.remove('tab-active');
  });
  ['dashboard', 'teams', 'judges', 'controls', 'results', 'export'].forEach(t => {
    $('#tab-' + t).hidden = t !== name;
  });
  if (name === 'results') loadResults();
}

/* ====================================================================
 * CONFIG + DASHBOARD
 * ==================================================================== */

async function loadConfig() {
  const data = await api('getConfig');
  state.config = data.config || {};
  $('#event-name').textContent = state.config.eventName || 'ระบบตัดสินการประกวด';
  updateToggleStates();
}

async function refreshDashboard() {
  try {
    const d = await api('getDashboard', { token: getAdminToken() });
    state.config = d.config || {};
    $('#event-name').textContent = state.config.eventName || 'ระบบตัดสินการประกวด';

    $('#stat-teams').textContent = d.teamCount;
    $('#stat-active-teams').textContent = d.activeTeamCount;
    $('#stat-judges').textContent = (d.round1.total + d.round2.total);
    $('#stat-r1-judges').textContent = d.round1.total;
    $('#stat-r2-judges').textContent = d.round2.total;

    setProgress('r1', d.round1.voted, d.round1.total);
    setProgress('r2', d.round2.voted, d.round2.total);

    $('#stat-r1-state').textContent = isTrue(state.config.round1Open) ? 'เปิด' : 'ปิด';
    $('#stat-r1-state').className = 'rounded-full px-2 py-0.5 text-xs ' +
      (isTrue(state.config.round1Open) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600');

    $('#stat-r2-state').textContent = isTrue(state.config.round2Open) ? 'เปิด' : 'ปิด';
    $('#stat-r2-state').className = 'rounded-full px-2 py-0.5 text-xs ' +
      (isTrue(state.config.round2Open) ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600');

    $('#state-r1-open').textContent = isTrue(state.config.round1Open) ? '✅ เปิด' : '🚫 ปิด';
    $('#state-r2-open').textContent = isTrue(state.config.round2Open) ? '✅ เปิด' : '🚫 ปิด';
    $('#state-published').textContent = isTrue(state.config.resultsPublished) ? '✅ เปิด' : '🚫 ปิด';

    updateToggleStates();
  } catch (err) {
    if (err.message?.includes('Session')) {
      clearInterval(state.refreshTimer);
      clearAdminToken();
      location.reload();
    }
  }
}

function setProgress(prefix, voted, total) {
  const pct = total > 0 ? Math.round((voted / total) * 100) : 0;
  $('#' + prefix + '-bar').style.width = pct + '%';
  $('#' + prefix + '-text').textContent = voted + '/' + total;
}

function isTrue(v) {
  return v === true || v === 'TRUE' || v === 'true';
}

/* ====================================================================
 * TEAMS
 * ==================================================================== */

function bindTeamUI() {
  $('#add-team-btn').addEventListener('click', () => openTeamModal(null));
  $('#team-modal-cancel').addEventListener('click', closeTeamModal);
  $('#team-form').addEventListener('submit', submitTeamForm);
  $('#team-image-file').addEventListener('change', handleImagePreview);
}

async function loadTeams() {
  const data = await api('getTeams');
  state.teams = (data.teams || []).filter(t => t.Status !== 'Removed');
  renderTeams();
}

function renderTeams() {
  const list = $('#teams-list');
  if (state.teams.length === 0) {
    list.innerHTML = '<li class="rounded-xl bg-white p-4 text-center text-sm text-slate-500">ยังไม่มีทีม</li>';
    return;
  }
  list.innerHTML = state.teams.map(t => `
    <li data-team-id="${esc(t.TeamID)}" class="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
      <span class="drag-handle text-slate-400 text-xl">☰</span>
      ${t.ImageURL
        ? `<img src="${esc(t.ImageURL)}" class="h-12 w-12 rounded-lg object-cover" loading="lazy">`
        : `<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-400">📷</div>`}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">#${esc(t.TeamNumber)}</span>
          ${t.Status === 'Winner-Round1' ? '<span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">🏆 ชนะรอบ 1</span>' : ''}
        </div>
        <div class="mt-0.5 truncate text-sm font-medium text-slate-800">${esc(t.TeamName)}</div>
        <div class="truncate text-xs text-slate-500">${esc(t.School || '')}</div>
      </div>
      <div class="flex flex-col gap-1">
        <button data-act="edit" class="rounded-lg px-2 py-1 text-xs text-sky-600">แก้ไข</button>
        <button data-act="del" class="rounded-lg px-2 py-1 text-xs text-rose-600">ลบ</button>
      </div>
    </li>
  `).join('');

  list.querySelectorAll('li').forEach(li => {
    const teamId = li.dataset.teamId;
    li.querySelector('[data-act="edit"]').addEventListener('click', () => {
      const t = state.teams.find(x => x.TeamID === teamId);
      openTeamModal(t);
    });
    li.querySelector('[data-act="del"]').addEventListener('click', async () => {
      if (!await confirmDialog('ลบทีมนี้?', { danger: true, confirmText: 'ลบ' })) return;
      try {
        showBlocker('กำลังลบ...');
        await api('deleteTeam', { token: getAdminToken(), teamId });
        await loadTeams();
        showToast('ลบทีมแล้ว', 'success');
      } catch (err) { showError(err); }
      finally { hideBlocker(); }
    });
  });

  // sortable
  Sortable.create(list, {
    handle: '.drag-handle',
    animation: 180,
    onEnd: async () => {
      const ids = [...list.querySelectorAll('li')].map(li => li.dataset.teamId);
      try {
        await api('reorderTeams', { token: getAdminToken(), teamIds: ids });
        showToast('เรียงลำดับใหม่แล้ว', 'success');
        // อัพเดต local order
        ids.forEach((id, i) => {
          const t = state.teams.find(x => x.TeamID === id);
          if (t) t.Order = i + 1;
        });
      } catch (err) { showError(err); loadTeams(); }
    },
  });
}

function openTeamModal(team) {
  $('#team-modal-title').textContent = team ? 'แก้ไขทีม' : 'เพิ่มทีม';
  $('#team-id').value = team?.TeamID || '';
  $('#team-number').value = team?.TeamNumber || (state.teams.length + 1);
  $('#team-name').value = team?.TeamName || '';
  $('#team-school').value = team?.School || 'โรงเรียนบ้านใหม่';
  $('#team-image-url').value = team?.ImageURL || '';
  $('#team-image-fileid').value = team?.ImageFileID || '';
  $('#team-image-file').value = '';
  const preview = $('#team-image-preview');
  if (team?.ImageURL) {
    preview.classList.remove('hidden');
    preview.querySelector('img').src = team.ImageURL;
  } else {
    preview.classList.add('hidden');
  }
  $('#team-modal').hidden = false;
}

function closeTeamModal() { $('#team-modal').hidden = true; }

async function handleImagePreview(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showError('ไฟล์ใหญ่เกิน 5MB');
    e.target.value = '';
    return;
  }
  const url = URL.createObjectURL(file);
  const preview = $('#team-image-preview');
  preview.classList.remove('hidden');
  preview.querySelector('img').src = url;
}

async function submitTeamForm(e) {
  e.preventDefault();
  const file = $('#team-image-file').files[0];
  const team = {
    TeamID: $('#team-id').value || undefined,
    TeamNumber: Number($('#team-number').value),
    TeamName: $('#team-name').value.trim(),
    School: $('#team-school').value.trim(),
    ImageURL: $('#team-image-url').value,
    ImageFileID: $('#team-image-fileid').value,
  };

  try {
    if (file) {
      showBlocker('กำลังอัปโหลดรูป...');
      const fb = await fileToBase64(file);
      const up = await api('uploadImage', { token: getAdminToken(), ...fb });
      team.ImageURL = up.url;
      team.ImageFileID = up.fileId;
    }
    showBlocker('กำลังบันทึก...');
    await api('saveTeam', { token: getAdminToken(), team });
    closeTeamModal();
    await loadTeams();
    showToast('บันทึกแล้ว', 'success');
  } catch (err) {
    showError(err);
  } finally {
    hideBlocker();
  }
}

/* ====================================================================
 * JUDGES
 * ==================================================================== */

function bindJudgeUI() {
  $('#add-judge-btn').addEventListener('click', () => openJudgeModal(null));
  $('#judge-modal-cancel').addEventListener('click', () => $('#judge-modal').hidden = true);
  $('#judge-form').addEventListener('submit', submitJudgeForm);
}

async function loadJudges() {
  const data = await api('getJudges', { token: getAdminToken() });
  state.judges = data.judges || [];
  renderJudges();
}

function renderJudges() {
  ['r1', 'r2'].forEach(key => {
    const round = key === 'r1' ? 1 : 2;
    const list = $('#judges-' + key);
    const judges = state.judges.filter(j => Number(j.Round) === round);
    if (judges.length === 0) {
      list.innerHTML = '<li class="rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-500">ยังไม่มีกรรมการ</li>';
      return;
    }
    list.innerHTML = judges.map(j => `
      <li data-judge-id="${esc(j.JudgeID)}" class="flex items-center gap-2 rounded-lg bg-slate-50 p-2">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="rounded-full ${isTrue(j.Voted) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} px-2 py-0.5 text-xs">
              ${isTrue(j.Voted) ? '✅ ส่งแล้ว' : '⏳ ยังไม่ส่ง'}
            </span>
          </div>
          <div class="mt-0.5 truncate text-sm font-medium text-slate-800">${esc(j.JudgeName)}</div>
          <div class="text-xs text-slate-400">${esc(j.JudgeID)}</div>
        </div>
        <button data-act="link" class="rounded-lg bg-sky-100 px-2 py-1 text-xs text-sky-700">🔗 ลิงก์</button>
        <button data-act="reset" class="rounded-lg bg-amber-100 px-2 py-1 text-xs text-amber-700">↻</button>
        <button data-act="del" class="rounded-lg bg-rose-100 px-2 py-1 text-xs text-rose-700">×</button>
      </li>
    `).join('');

    list.querySelectorAll('li').forEach(li => {
      const judgeId = li.dataset.judgeId;
      const judge = state.judges.find(j => j.JudgeID === judgeId);
      li.querySelector('[data-act="link"]').addEventListener('click', () => showJudgeLink(judge));
      li.querySelector('[data-act="reset"]').addEventListener('click', () => resetJudgeToken(judge));
      li.querySelector('[data-act="del"]').addEventListener('click', () => deleteJudge(judge));
    });
  });
}

function openJudgeModal(judge) {
  $('#judge-id').value = judge?.JudgeID || '';
  $('#judge-name').value = judge?.JudgeName || '';
  $('#judge-round').value = judge?.Round || 1;
  $('#judge-round').disabled = !!judge; // ไม่ให้แก้ Round เมื่อ edit
  $('#judge-modal').hidden = false;
}

async function submitJudgeForm(e) {
  e.preventDefault();
  const judge = {
    JudgeID: $('#judge-id').value || undefined,
    JudgeName: $('#judge-name').value.trim(),
    Round: Number($('#judge-round').value),
  };
  try {
    showBlocker('กำลังบันทึก...');
    const res = await api('saveJudge', { token: getAdminToken(), judge });
    $('#judge-modal').hidden = true;
    await loadJudges();
    showToast('บันทึกแล้ว', 'success');
    // ถ้าเพิ่งสร้างใหม่ → เปิดลิงก์ให้เลย
    if (!judge.JudgeID && res.token) {
      const newJudge = state.judges.find(j => j.JudgeID === res.judgeId);
      if (newJudge) showJudgeLink(newJudge);
    }
  } catch (err) {
    showError(err);
  } finally { hideBlocker(); }
}

async function resetJudgeToken(judge) {
  const ok = await confirmDialog(
    `รีเซ็ตลิงก์ของ ${judge.JudgeName}?\n⚠️ คะแนนที่ลงไว้แล้วจะถูกลบ`,
    { danger: true, confirmText: 'รีเซ็ต' }
  );
  if (!ok) return;
  try {
    showBlocker('กำลังรีเซ็ต...');
    await api('resetJudgeToken', { token: getAdminToken(), judgeId: judge.JudgeID });
    await loadJudges();
    const updated = state.judges.find(j => j.JudgeID === judge.JudgeID);
    showToast('รีเซ็ตแล้ว — ลิงก์ใหม่พร้อมแชร์', 'success');
    if (updated) showJudgeLink(updated);
  } catch (err) {
    showError(err);
  } finally { hideBlocker(); }
}

async function deleteJudge(judge) {
  const ok = await confirmDialog(`ลบกรรมการ ${judge.JudgeName}?`, { danger: true, confirmText: 'ลบ' });
  if (!ok) return;
  try {
    showBlocker('กำลังลบ...');
    await api('deleteJudge', { token: getAdminToken(), judgeId: judge.JudgeID });
    await loadJudges();
    showToast('ลบแล้ว', 'success');
  } catch (err) { showError(err); }
  finally { hideBlocker(); }
}

/* ====================================================================
 * LINK MODAL (QR + copy)
 * ==================================================================== */

function bindLinkModal() {
  $('#link-close').addEventListener('click', () => $('#link-modal').hidden = true);
  $('#link-copy').addEventListener('click', async () => {
    const url = $('#link-url').textContent;
    try {
      await navigator.clipboard.writeText(url);
      showToast('คัดลอกแล้ว', 'success');
    } catch {
      showError('คัดลอกไม่ได้ — กดค้างเพื่อ copy เอง');
    }
  });
}

function showJudgeLink(judge) {
  const base = location.origin + location.pathname.replace(/admin\.html$/, '');
  const url = `${base}judge.html?token=${encodeURIComponent(judge.Token)}`;
  $('#link-judge-name').textContent = `${judge.JudgeName} (รอบ ${judge.Round})`;
  $('#link-url').textContent = url;

  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  $('#link-qr').innerHTML = qr.createImgTag(5, 8);

  $('#link-modal').hidden = false;
}

/* ====================================================================
 * CONFIG TOGGLES
 * ==================================================================== */

function bindToggles() {
  $$('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.toggle;
      const current = isTrue(state.config[key]);
      const next = !current;

      // confirm สำหรับ resultsPublished
      if (key === 'resultsPublished' && next) {
        if (!await confirmDialog('เผยแพร่ผลให้สาธารณะเลยใช่ไหม?', { confirmText: 'เผยแพร่' })) return;
      }

      try {
        showBlocker('กำลังบันทึก...');
        await api('setConfig', { token: getAdminToken(), key, value: next ? 'TRUE' : 'FALSE' });
        state.config[key] = next ? 'TRUE' : 'FALSE';
        updateToggleStates();
        showToast(next ? 'เปิดแล้ว' : 'ปิดแล้ว', 'success');
      } catch (err) {
        showError(err);
      } finally { hideBlocker(); }
    });
  });
}

function updateToggleStates() {
  $$('.toggle-btn').forEach(btn => {
    const key = btn.dataset.toggle;
    const on = isTrue(state.config[key]);
    btn.setAttribute('aria-pressed', on);
    btn.classList.toggle('bg-emerald-500', on);
    btn.classList.toggle('bg-slate-300', !on);
    const dot = btn.querySelector('span');
    dot.classList.toggle('translate-x-6', on);
  });
}

/* ====================================================================
 * RESULTS — Round 1 compute + tie-break
 * ==================================================================== */

const r1Local = {
  preview: null,   // { stats, tied, winner } จาก computeRound1
  saved: null,     // result row จาก Results sheet (ถ้าบันทึกแล้ว)
};

function bindResultsUI() {
  $('#tie-cancel').addEventListener('click', () => $('#tie-modal').hidden = true);
  $('#tie-confirm').addEventListener('click', confirmTieWinner);
}

async function loadResults() {
  try {
    const data = await api('getAdminResults', { token: getAdminToken() });
    const results = data.results || [];
    r1Local.saved = results.find(r => Number(r.Round) === 1) || null;
    r2Local.saved = results.filter(r => Number(r.Round) === 2);
    renderR1Saved();
    renderR2Saved();
    if (!r1Local.preview) renderR1Actions();
    if (!r2Local.preview) renderR2Actions();
  } catch (err) { showError(err); }
}

function renderR1Saved() {
  const box = $('#r1-saved');
  const badge = $('#r1-status-badge');

  if (r1Local.saved) {
    const r = r1Local.saved;
    badge.textContent = '✅ บันทึกแล้ว';
    badge.className = 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700';
    box.classList.remove('hidden');
    box.innerHTML = `
      <div class="flex items-center gap-3 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
        ${r.ImageURL
          ? `<img src="${esc(r.ImageURL)}" class="h-14 w-14 rounded-lg object-cover">`
          : `<div class="flex h-14 w-14 items-center justify-center rounded-lg bg-amber-100 text-2xl">🏆</div>`}
        <div class="flex-1 min-w-0">
          <div class="text-xs text-amber-700">🏆 ผู้ชนะรอบที่ 1</div>
          <div class="truncate text-base font-bold text-amber-900">${esc(r.TeamName)}</div>
          <div class="truncate text-xs text-amber-700">${esc(r.School)} · คะแนนรวม ${esc(r.Score)}</div>
          ${r.Note ? `<div class="mt-1 text-xs text-slate-500">📝 ${esc(r.Note)}</div>` : ''}
        </div>
      </div>
    `;
  } else {
    badge.textContent = '⏳ ยังไม่ได้คำนวณ';
    badge.className = 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600';
    box.classList.add('hidden');
    box.innerHTML = '';
  }
  renderR1Actions();
}

function renderR1Actions() {
  const box = $('#r1-actions');
  box.innerHTML = '';

  const computeBtn = document.createElement('button');
  computeBtn.className = 'rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white';
  computeBtn.textContent = r1Local.saved ? '🔄 คำนวณใหม่' : '🧮 คำนวณผลรอบ 1';
  computeBtn.addEventListener('click', runComputeR1);
  box.appendChild(computeBtn);

  if (r1Local.preview) {
    const clearBtn = document.createElement('button');
    clearBtn.className = 'rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700';
    clearBtn.textContent = 'ล้างผลพรีวิว';
    clearBtn.addEventListener('click', () => {
      r1Local.preview = null;
      $('#r1-preview').classList.add('hidden');
      $('#r1-preview').innerHTML = '';
      renderR1Actions();
    });
    box.appendChild(clearBtn);
  }
}

async function runComputeR1() {
  if (r1Local.saved) {
    const ok = await confirmDialog(
      'มีผู้ชนะรอบ 1 บันทึกไว้แล้ว — คำนวณใหม่จะเขียนทับ ยืนยันไหม?',
      { confirmText: 'คำนวณใหม่', danger: true }
    );
    if (!ok) return;
  }

  try {
    showBlocker('กำลังคำนวณ...');
    const data = await api('computeRound1', { token: getAdminToken() });
    r1Local.preview = data;
    renderR1Preview();
    if (data.tied) {
      openTieModal(data.tied);
    }
  } catch (err) { showError(err); }
  finally { hideBlocker(); }
}

function renderR1Preview() {
  const { stats, tied, winner } = r1Local.preview;
  const box = $('#r1-preview');
  box.classList.remove('hidden');

  const rows = stats.map((s, i) => {
    const isTop = i === 0;
    const isTied = tied && tied.find(t => t.TeamID === s.team.TeamID);
    return `
      <tr class="${isTied ? 'bg-amber-50' : isTop ? 'bg-emerald-50' : ''}">
        <td class="px-2 py-2 text-center font-semibold ${isTop ? 'text-emerald-700' : 'text-slate-500'}">${i + 1}</td>
        <td class="px-2 py-2">
          <div class="flex items-center gap-2">
            <span class="rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700">#${esc(s.team.TeamNumber)}</span>
            <span class="truncate text-sm font-medium text-slate-800">${esc(s.team.TeamName)}</span>
          </div>
        </td>
        <td class="px-2 py-2 text-right font-bold text-slate-800">${s.totalScore}</td>
        <td class="px-2 py-2 text-center text-xs text-slate-500">${s.rank1Count} / ${s.rank2Count} / ${s.rank3Count}</td>
      </tr>`;
  }).join('');

  const banner = tied
    ? `<div class="mb-3 rounded-xl bg-amber-100 p-3 text-sm text-amber-900 ring-1 ring-amber-300">
         ⚖️ มี ${tied.length} ทีมเสมอกัน — เลือกผู้ชนะใน popup
       </div>`
    : winner
      ? `<div class="mb-3 flex items-center gap-3 rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
           ${winner.team.ImageURL
             ? `<img src="${esc(winner.team.ImageURL)}" class="h-12 w-12 rounded-lg object-cover">`
             : `<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-2xl">🏆</div>`}
           <div class="flex-1 min-w-0">
             <div class="text-xs text-emerald-700">ผู้ชนะ (พรีวิว)</div>
             <div class="truncate text-base font-bold text-emerald-900">${esc(winner.team.TeamName)}</div>
             <div class="text-xs text-emerald-700">คะแนนรวม ${winner.totalScore}</div>
           </div>
           <button id="r1-confirm-save" class="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">บันทึก</button>
         </div>`
      : '';

  box.innerHTML = `
    ${banner}
    <div class="overflow-x-auto rounded-xl border border-slate-200">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th class="px-2 py-2">#</th>
            <th class="px-2 py-2 text-left">ทีม</th>
            <th class="px-2 py-2 text-right">คะแนน</th>
            <th class="px-2 py-2 text-center">อันดับ 1/2/3</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">${rows}</tbody>
      </table>
    </div>
  `;

  $('#r1-confirm-save')?.addEventListener('click', () => confirmWinner(winner.team.TeamID, ''));
  renderR1Actions();
}

/* ----- Tie-break modal ----- */

function openTieModal(tiedTeams) {
  const ul = $('#tie-options');
  ul.innerHTML = tiedTeams.map(t => `
    <li>
      <label class="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
        <input type="radio" name="tie-pick" value="${esc(t.TeamID)}" class="h-4 w-4 text-emerald-600">
        ${t.ImageURL
          ? `<img src="${esc(t.ImageURL)}" class="h-10 w-10 rounded-lg object-cover">`
          : `<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400">📷</div>`}
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-slate-800">${esc(t.TeamName)}</div>
          <div class="text-xs text-slate-500">#${esc(t.TeamNumber)} · ${esc(t.School || '')}</div>
        </div>
      </label>
    </li>
  `).join('');
  $('#tie-note').value = '';
  $('#tie-modal').hidden = false;
}

async function confirmTieWinner() {
  const picked = document.querySelector('input[name="tie-pick"]:checked');
  if (!picked) { showToast('โปรดเลือกผู้ชนะ', 'warning'); return; }
  const teamId = picked.value;
  const note = $('#tie-note').value.trim() || 'admin tiebreak';
  $('#tie-modal').hidden = true;
  await confirmWinner(teamId, note);
}

async function confirmWinner(teamId, note) {
  const ok = await confirmDialog('ยืนยันผู้ชนะรอบ 1?\n— ทีมนี้จะถูกตัดออกจากรอบ 2 อัตโนมัติ', {
    confirmText: 'ยืนยัน',
  });
  if (!ok) return;
  try {
    showBlocker('กำลังบันทึก...');
    await api('setRound1Winner', { token: getAdminToken(), teamId, note });
    showToast('บันทึกผู้ชนะรอบ 1 แล้ว', 'success');
    r1Local.preview = null;
    $('#r1-preview').classList.add('hidden');
    $('#r1-preview').innerHTML = '';
    await Promise.all([loadResults(), loadTeams(), refreshDashboard()]);
  } catch (err) { showError(err); }
  finally { hideBlocker(); }
}

/* ====================================================================
 * RESULTS — Round 2 compute (Hungarian) + admin swap override
 * ==================================================================== */

const r2Local = {
  preview: null,    // { result, matrix, teams, awards, totalVotes }
  assignment: [],   // [{ teamId, awardId, voteCount, overridden }]
  saved: [],        // Result rows จาก getAdminResults (Round=2)
  swapPick: null,   // index ของ assignment ที่เลือกไว้รอ swap
};

function renderR2Saved() {
  const box = $('#r2-saved');
  const badge = $('#r2-status-badge');

  if (r2Local.saved && r2Local.saved.length > 0) {
    badge.textContent = '✅ บันทึกแล้ว';
    badge.className = 'rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700';
    box.classList.remove('hidden');
    // เรียงตาม Order ของ Awards
    const awardOrder = {};
    (jstate?.awards || []).forEach((a, i) => awardOrder[a.AwardID] = i);
    const sorted = [...r2Local.saved].sort((a, b) =>
      String(a.AwardID).localeCompare(String(b.AwardID))
    );
    box.innerHTML = `
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        ${sorted.map(r => `
          <div class="rounded-xl bg-sky-50 p-3 ring-1 ring-sky-200">
            <div class="text-xs font-semibold text-sky-700">🏆 ${esc(r.AwardName)}</div>
            <div class="mt-2 flex items-center gap-2">
              ${r.ImageURL
                ? `<img src="${esc(r.ImageURL)}" class="h-10 w-10 rounded-lg object-cover">`
                : `<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-slate-400">📷</div>`}
              <div class="flex-1 min-w-0">
                <div class="truncate text-sm font-bold text-slate-800">${esc(r.TeamName)}</div>
                <div class="text-xs text-slate-500">${esc(r.School)} · ${esc(r.Score)} เสียง</div>
              </div>
            </div>
            ${r.Note ? `<div class="mt-1 text-xs text-amber-700">📝 ${esc(r.Note)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  } else {
    badge.textContent = '⏳ ยังไม่ได้คำนวณ';
    badge.className = 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600';
    box.classList.add('hidden');
    box.innerHTML = '';
  }
  renderR2Actions();
}

function renderR2Actions() {
  const box = $('#r2-actions');
  box.innerHTML = '';

  const computeBtn = document.createElement('button');
  computeBtn.className = 'rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white';
  computeBtn.textContent = r2Local.saved.length > 0 ? '🔄 คำนวณใหม่' : '🧮 คำนวณผลรอบ 2';
  computeBtn.addEventListener('click', runComputeR2);
  box.appendChild(computeBtn);

  if (r2Local.preview) {
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700';
    cancelBtn.textContent = 'ล้างผลพรีวิว';
    cancelBtn.addEventListener('click', () => {
      r2Local.preview = null;
      r2Local.assignment = [];
      r2Local.swapPick = null;
      $('#r2-preview').classList.add('hidden');
      $('#r2-preview').innerHTML = '';
      renderR2Actions();
    });
    box.appendChild(cancelBtn);
  }
}

async function runComputeR2() {
  if (r2Local.saved.length > 0) {
    const ok = await confirmDialog(
      'มีผลรอบ 2 บันทึกไว้แล้ว — คำนวณใหม่จะเขียนทับ ยืนยันไหม?',
      { confirmText: 'คำนวณใหม่', danger: true }
    );
    if (!ok) return;
  }

  try {
    showBlocker('กำลังคำนวณ Hungarian...');
    const data = await api('computeRound2', { token: getAdminToken() });
    r2Local.preview = data;
    // เริ่มต้น assignment จาก optimal solution
    r2Local.assignment = data.result.map(r => ({
      teamId: r.team.TeamID,
      awardId: r.award.AwardID,
      voteCount: r.voteCount,
      overridden: false,
    }));
    r2Local.swapPick = null;
    renderR2Preview();
    renderR2Actions();
  } catch (err) { showError(err); }
  finally { hideBlocker(); }
}

function renderR2Preview() {
  const box = $('#r2-preview');
  box.classList.remove('hidden');

  const { matrix, teams, awards } = r2Local.preview;
  const teamById = {};
  teams.forEach(t => teamById[t.TeamID] = t);
  const awardById = {};
  awards.forEach(a => awardById[a.AwardID] = a);

  // สร้าง set ของ (teamId, awardId) assignment ปัจจุบัน
  const pickedCell = new Set(r2Local.assignment.map(a => `${a.teamId}::${a.awardId}`));
  const totalVotes = r2Local.assignment.reduce((s, a) => s + (a.voteCount || 0), 0);
  const overriddenCount = r2Local.assignment.filter(a => a.overridden).length;

  // matrix table
  const headerRow = awards.map(a =>
    `<th class="px-2 py-1.5 text-center text-xs font-medium text-slate-600">${esc(a.AwardName)}</th>`
  ).join('');
  const bodyRows = teams.map((t, i) => {
    const cells = awards.map((a, j) => {
      const v = matrix[i][j];
      const isPicked = pickedCell.has(`${t.TeamID}::${a.AwardID}`);
      return `<td class="px-2 py-1.5 text-center text-sm ${isPicked ? 'bg-sky-500 font-bold text-white' : v > 0 ? 'text-slate-700' : 'text-slate-300'}">${v}</td>`;
    }).join('');
    return `<tr>
      <th class="sticky left-0 bg-white px-2 py-1.5 text-left text-xs font-medium text-slate-700">
        #${esc(t.TeamNumber)} ${esc(t.TeamName)}
      </th>${cells}
    </tr>`;
  }).join('');

  // assignment cards (เรียงตาม award order)
  const cards = [...r2Local.assignment]
    .sort((a, b) => {
      const oa = awards.findIndex(x => x.AwardID === a.awardId);
      const ob = awards.findIndex(x => x.AwardID === b.awardId);
      return oa - ob;
    })
    .map(a => {
      const t = teamById[a.teamId];
      const aw = awardById[a.awardId];
      const idx = r2Local.assignment.findIndex(x => x.teamId === a.teamId);
      const isPicked = r2Local.swapPick === idx;
      return `
        <button data-idx="${idx}"
                class="r2-swap-btn flex w-full items-center gap-3 rounded-xl p-3 text-left ring-1 active:scale-[0.99]
                       ${isPicked ? 'bg-amber-50 ring-amber-400' : a.overridden ? 'bg-rose-50 ring-rose-200' : 'bg-white ring-slate-200'}">
          ${t.ImageURL
            ? `<img src="${esc(t.ImageURL)}" class="h-12 w-12 rounded-lg object-cover">`
            : `<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-400">📷</div>`}
          <div class="flex-1 min-w-0">
            <div class="truncate text-xs font-semibold text-sky-700">🏆 ${esc(aw.AwardName)}</div>
            <div class="truncate text-sm font-bold text-slate-800">${esc(t.TeamName)}</div>
            <div class="text-xs text-slate-500">
              ${a.voteCount} เสียง
              ${a.overridden ? ' · <span class="text-rose-600">admin override</span>' : ''}
            </div>
          </div>
          ${isPicked ? '<span class="text-xs text-amber-700">รอสลับ…</span>' : '<span class="text-xs text-slate-400">↔ สลับ</span>'}
        </button>
      `;
    }).join('');

  box.innerHTML = `
    <div class="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-sky-50 p-3 text-sm ring-1 ring-sky-200">
      <span class="font-bold text-sky-900">ผลรวมเสียงโหวต: ${totalVotes}</span>
      ${overriddenCount > 0
        ? `<span class="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">admin สลับ ${overriddenCount} คู่</span>`
        : '<span class="text-xs text-sky-700">(Hungarian optimal — ผลรวมสูงสุดที่เป็นไปได้)</span>'}
    </div>

    <details class="mb-3 rounded-xl ring-1 ring-slate-200">
      <summary class="cursor-pointer px-3 py-2 text-sm font-medium text-slate-700">📊 ดูตาราง vote matrix</summary>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="sticky left-0 bg-slate-50 px-2 py-1.5 text-left text-xs font-medium text-slate-600">ทีม \\ รางวัล</th>
              ${headerRow}
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">${bodyRows}</tbody>
        </table>
      </div>
    </details>

    <p class="mb-2 text-xs text-slate-500">คลิกการ์ดสองอันเพื่อสลับทีม → รางวัล หากต้องการ override</p>
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">${cards}</div>

    <div class="mt-4 flex gap-2">
      <button id="r2-save-btn" class="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white">✅ บันทึกผลรอบ 2</button>
    </div>
  `;

  // bind swap clicks
  box.querySelectorAll('.r2-swap-btn').forEach(btn => {
    btn.addEventListener('click', () => onR2SwapClick(Number(btn.dataset.idx)));
  });
  $('#r2-save-btn').addEventListener('click', saveR2Results);
}

function onR2SwapClick(idx) {
  if (r2Local.swapPick === null) {
    r2Local.swapPick = idx;
    renderR2Preview();
    return;
  }
  if (r2Local.swapPick === idx) {
    r2Local.swapPick = null;
    renderR2Preview();
    return;
  }
  // swap awards ระหว่าง 2 cards
  const a = r2Local.assignment[r2Local.swapPick];
  const b = r2Local.assignment[idx];

  const { matrix, teams, awards } = r2Local.preview;
  const teamIdx = id => teams.findIndex(t => t.TeamID === id);
  const awardIdx = id => awards.findIndex(x => x.AwardID === id);

  // หลังสลับ:
  //   ทีม A ได้รางวัลที่ B เคยได้  → vote = matrix[teamIdx(A)][awardIdx(b.awardId)]
  //   ทีม B ได้รางวัลที่ A เคยได้  → vote = matrix[teamIdx(B)][awardIdx(a.awardId)]
  const newAVote = matrix[teamIdx(a.teamId)][awardIdx(b.awardId)];
  const newBVote = matrix[teamIdx(b.teamId)][awardIdx(a.awardId)];
  const tmpAward = a.awardId;
  a.awardId = b.awardId;
  a.voteCount = newAVote;
  a.overridden = true;
  b.awardId = tmpAward;
  b.voteCount = newBVote;
  b.overridden = true;

  r2Local.swapPick = null;
  renderR2Preview();
}

async function saveR2Results() {
  const overriddenCount = r2Local.assignment.filter(a => a.overridden).length;
  const msg = overriddenCount > 0
    ? `บันทึกผลรอบ 2?\n— มี admin override ${overriddenCount} คู่`
    : 'บันทึกผลรอบ 2?';
  const ok = await confirmDialog(msg, { confirmText: 'บันทึก' });
  if (!ok) return;

  const assignments = r2Local.assignment.map(a => ({
    teamId: a.teamId,
    awardId: a.awardId,
    voteCount: a.voteCount,
    note: a.overridden ? 'admin override' : '',
  }));

  try {
    showBlocker('กำลังบันทึก...');
    await api('setRound2Results', { token: getAdminToken(), assignments });
    showToast('บันทึกผลรอบ 2 แล้ว', 'success');
    r2Local.preview = null;
    r2Local.assignment = [];
    r2Local.swapPick = null;
    $('#r2-preview').classList.add('hidden');
    $('#r2-preview').innerHTML = '';
    await Promise.all([loadResults(), refreshDashboard()]);
  } catch (err) { showError(err); }
  finally { hideBlocker(); }
}

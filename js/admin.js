/**
 * admin.js — V2 Admin Panel (single round)
 *
 * Sections:
 *   - login + boot
 *   - tabs
 *   - dashboard refresh (5s)
 *   - teams CRUD (Drive upload + reorder)
 *   - judges CRUD (no token — shared link)
 *   - toggles (votingOpen + resultsPublished)
 *   - results: compute Hungarian + click-to-swap + save
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
 * LOGIN + BOOT
 * ==================================================================== */

document.addEventListener('DOMContentLoaded', () => {
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

async function boot() {
  $('#app-screen').hidden = false;
  bindTabs();
  bindTeamUI();
  bindJudgeUI();
  bindShareLink();
  bindToggles();
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
  $('#event-name').textContent = state.config.eventName || 'ระบบโหวต';
  updateToggleStates();
}

async function refreshDashboard() {
  try {
    const d = await api('getDashboard', { token: getAdminToken() });
    state.config = d.config || {};
    $('#event-name').textContent = state.config.eventName || 'ระบบโหวต';

    $('#stat-teams').textContent = d.teamCount;
    $('#stat-active-teams').textContent = d.activeTeamCount;
    $('#stat-judges').textContent = d.judgeCount;
    $('#stat-voted').textContent = d.votedCount;

    setProgress(d.votedCount, d.judgeCount);

    const votingOn = isTrue(state.config.votingOpen);
    $('#stat-voting-state').textContent = votingOn ? 'เปิดโหวต' : 'ปิดโหวต';
    $('#stat-voting-state').className = 'rounded-full px-2 py-0.5 text-xs ' +
      (votingOn ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600');

    $('#state-voting-open').textContent = votingOn ? '✅ เปิด' : '🚫 ปิด';
    $('#state-computed').textContent = isTrue(state.config.voteComputed) ? '✅ คำนวณแล้ว' : '⏳ ยังไม่คำนวณ';
    $('#state-published').textContent = isTrue(state.config.resultsPublished) ? '✅ ประกาศแล้ว' : '🚫 ยังไม่ประกาศ';
    $('#state-reveal').textContent = `${Number(state.config.revealIndex || 0)} / 6` +
      (isTrue(state.config.revealedTeam) ? ' (ทีมเปิดแล้ว)' : '');

    updateToggleStates();
  } catch (err) {
    if (err.message?.includes('Session')) {
      clearInterval(state.refreshTimer);
      clearAdminToken();
      location.reload();
    }
  }
}

function setProgress(voted, total) {
  const pct = total > 0 ? Math.round((voted / total) * 100) : 0;
  $('#vote-bar').style.width = pct + '%';
  $('#vote-text').textContent = voted + '/' + total;
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
        ? `<img src="${esc(driveImageUrl(t.ImageURL))}" class="h-12 w-12 rounded-lg object-cover" loading="lazy">`
        : `<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-400">📷</div>`}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">#${esc(t.TeamNumber)}</span>
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

  Sortable.create(list, {
    handle: '.drag-handle',
    animation: 180,
    onEnd: async () => {
      const ids = [...list.querySelectorAll('li')].map(li => li.dataset.teamId);
      try {
        await api('reorderTeams', { token: getAdminToken(), teamIds: ids });
        showToast('เรียงลำดับใหม่แล้ว', 'success');
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
    preview.querySelector('img').src = driveImageUrl(team.ImageURL);
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
 * JUDGES (no token — shared link)
 * ==================================================================== */

function bindJudgeUI() {
  $('#add-judge-btn').addEventListener('click', () => openJudgeModal(null));
  $('#judge-modal-cancel').addEventListener('click', () => $('#judge-modal').hidden = true);
  $('#judge-form').addEventListener('submit', submitJudgeForm);
}

async function loadJudges() {
  const data = await api('getJudges', { token: getAdminToken() });
  state.judges = (data.judges || []).sort((a, b) => Number(a.Order) - Number(b.Order));
  renderJudges();
}

function renderJudges() {
  const list = $('#judges-list');
  if (state.judges.length === 0) {
    list.innerHTML = '<li class="rounded-xl bg-white p-4 text-center text-sm text-slate-500">ยังไม่มีกรรมการ</li>';
    return;
  }
  list.innerHTML = state.judges.map(j => `
    <li data-judge-id="${esc(j.JudgeID)}" class="flex items-center gap-2 rounded-lg bg-white p-3 shadow-sm">
      <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">${esc(j.Order)}</span>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="rounded-full ${isTrue(j.Voted) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} px-2 py-0.5 text-xs">
            ${isTrue(j.Voted) ? '✅ ส่งแล้ว' : '⏳ ยังไม่ส่ง'}
          </span>
          <span class="text-xs text-slate-400">${esc(j.JudgeID)}</span>
        </div>
        <div class="mt-0.5 truncate text-sm font-medium text-slate-800">${esc(j.JudgeName)}</div>
      </div>
      <button data-act="edit" class="rounded-lg bg-sky-100 px-2 py-1 text-xs text-sky-700">แก้</button>
      <button data-act="del"  class="rounded-lg bg-rose-100 px-2 py-1 text-xs text-rose-700">×</button>
    </li>
  `).join('');

  list.querySelectorAll('li').forEach(li => {
    const judgeId = li.dataset.judgeId;
    const judge = state.judges.find(j => j.JudgeID === judgeId);
    li.querySelector('[data-act="edit"]').addEventListener('click', () => openJudgeModal(judge));
    li.querySelector('[data-act="del"]').addEventListener('click', () => deleteJudge(judge));
  });
}

function openJudgeModal(judge) {
  $('#judge-modal-title').textContent = judge ? 'แก้ไขกรรมการ' : 'เพิ่มกรรมการ';
  $('#judge-id').value = judge?.JudgeID || '';
  $('#judge-name').value = judge?.JudgeName || '';
  $('#judge-modal').hidden = false;
}

async function submitJudgeForm(e) {
  e.preventDefault();
  const judge = {
    JudgeID: $('#judge-id').value || undefined,
    JudgeName: $('#judge-name').value.trim(),
  };
  try {
    showBlocker('กำลังบันทึก...');
    await api('saveJudge', { token: getAdminToken(), judge });
    $('#judge-modal').hidden = true;
    await loadJudges();
    showToast('บันทึกแล้ว', 'success');
  } catch (err) { showError(err); }
  finally { hideBlocker(); }
}

async function deleteJudge(judge) {
  const ok = await confirmDialog(
    `ลบกรรมการ "${judge.JudgeName}"?\n⚠️ คะแนนที่ลงไว้แล้วจะถูกลบด้วย`,
    { danger: true, confirmText: 'ลบ' }
  );
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
 * SHARE LINK (กรรมการ)
 * ==================================================================== */

function bindShareLink() {
  const base = location.origin + location.pathname.replace(/admin\.html$/, '');
  const url = base + 'judge.html';
  $('#share-link-text').textContent = url;
  $('#share-link-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      showToast('คัดลอกลิงก์แล้ว', 'success');
    } catch {
      showError('คัดลอกไม่สำเร็จ — กด select แล้ว copy เอง');
    }
  });
}

/* ====================================================================
 * CONFIG TOGGLES
 * ==================================================================== */

function bindToggles() {
  $$('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => onToggleClick(btn));
  });
}

async function onToggleClick(btn) {
  const key = btn.dataset.toggle;
  const current = isTrue(state.config[key]);
  const next = !current;

  // confirm สำหรับ action ที่กระทบมาก
  if (key === 'votingOpen' && !next) {
    // ปิดโหวต → จะคำนวณ Hungarian อัตโนมัติ
    if (!await confirmDialog(
      'ปิดการโหวต?\n— ระบบจะคำนวณ Hungarian Assignment อัตโนมัติ',
      { confirmText: 'ปิดโหวต + คำนวณ', danger: false }
    )) return;
  }
  if (key === 'votingOpen' && next && isTrue(state.config.voteComputed)) {
    // เปิดใหม่หลังคำนวณ → จะ reset
    if (!await confirmDialog(
      'เปิดโหวตอีกครั้ง?\n— ผลที่คำนวณไว้และสถานะการประกาศจะถูก reset',
      { confirmText: 'เปิด + Reset', danger: true }
    )) return;
  }
  if (key === 'resultsPublished' && next) {
    if (!isTrue(state.config.voteComputed)) {
      showToast('ต้องคำนวณผลก่อนประกาศ', 'warning');
      return;
    }
    if (!await confirmDialog(
      'ประกาศผลให้สาธารณะ?\n— TV reveal จะเริ่มต้นที่รางวัลแรก',
      { confirmText: 'ประกาศ' }
    )) return;
  }

  try {
    showBlocker('กำลังบันทึก...');
    let res;

    if (key === 'resultsPublished') {
      // ใช้ endpoint เฉพาะ (publishResults รีเซ็ต revealIndex/revealedTeam ให้)
      res = await api(next ? 'publishResults' : 'unpublishResults', { token: getAdminToken() });
      state.config.resultsPublished = next ? 'TRUE' : 'FALSE';
      state.config.revealIndex = '0';
      state.config.revealedTeam = 'FALSE';
    } else {
      res = await api('setConfig', { token: getAdminToken(), key, value: next ? 'TRUE' : 'FALSE' });
      state.config[key] = next ? 'TRUE' : 'FALSE';
    }

    if (key === 'votingOpen' && !next) {
      if (res.computed) {
        state.config.voteComputed = 'TRUE';
        showToast(`คำนวณเสร็จ — บันทึกผล ${res.count} รางวัล`, 'success');
        await loadResults();
      } else if (res.computeError) {
        showToast('ปิดแล้ว แต่คำนวณไม่สำเร็จ: ' + res.computeError, 'warning');
      }
    }
    if (key === 'votingOpen' && next && res.reset) {
      state.config.voteComputed = 'FALSE';
      state.config.resultsPublished = 'FALSE';
      state.config.revealIndex = '0';
      state.config.revealedTeam = 'FALSE';
      showToast('Reset แล้ว — กรรมการเริ่มโหวตได้', 'info');
    }

    updateToggleStates();
    await refreshDashboard();
    if (state.currentTab === 'results') await loadResults();
  } catch (err) {
    showError(err);
  } finally { hideBlocker(); }
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
 * RESULTS — Hungarian preview + click-to-swap + save
 * ==================================================================== */

const resultLocal = {
  preview: null,     // { matrix, teams, awards, assignment, totalVotes }
  assignment: [],    // [{ teamId, awardId, voteCount, overridden }]
  saved: [],         // Result rows from getAdminResults
  swapPick: null,
};

function bindResultsUI() {
  // (no extra binds — buttons สร้างใน renderResultActions)
}

async function loadResults() {
  try {
    const data = await api('getAdminResults', { token: getAdminToken() });
    resultLocal.saved = (data.results || [])
      .sort((a, b) => Number(a.AwardOrder) - Number(b.AwardOrder));
    renderResultSaved();
    if (!resultLocal.preview) renderResultActions();
  } catch (err) { showError(err); }
}

function renderResultSaved() {
  const box = $('#result-saved');
  const badge = $('#result-status-badge');

  if (resultLocal.saved.length > 0) {
    badge.textContent = '✅ บันทึกแล้ว';
    badge.className = 'rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700';
    box.classList.remove('hidden');
    box.innerHTML = `
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        ${resultLocal.saved.map(r => `
          <div class="rounded-xl bg-sky-50 p-3 ring-1 ring-sky-200">
            <div class="text-xs font-semibold text-sky-700">🏆 ${esc(r.AwardName)}</div>
            <div class="mt-2 flex items-center gap-2">
              ${r.ImageURL
                ? `<img src="${esc(driveImageUrl(r.ImageURL))}" class="h-10 w-10 rounded-lg object-cover">`
                : `<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-slate-400">📷</div>`}
              <div class="flex-1 min-w-0">
                <div class="truncate text-sm font-bold text-slate-800">${esc(r.TeamName)}</div>
                <div class="text-xs text-slate-500">${esc(r.School)} · ${esc(r.VoteCount)} เสียง</div>
              </div>
            </div>
            ${r.Note ? `<div class="mt-1 text-xs text-amber-700">📝 ${esc(r.Note)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  } else {
    badge.textContent = isTrue(state.config.votingOpen) ? '🗳 กำลังโหวต' : '⏳ ยังไม่ได้คำนวณ';
    badge.className = 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600';
    box.classList.add('hidden');
    box.innerHTML = '';
  }
  renderResultActions();
}

function renderResultActions() {
  const box = $('#result-actions');
  box.innerHTML = '';

  const computeBtn = document.createElement('button');
  computeBtn.className = 'rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white';
  computeBtn.textContent = resultLocal.saved.length > 0 ? '🔄 คำนวณใหม่' : '🧮 คำนวณ Hungarian';
  computeBtn.addEventListener('click', runCompute);
  box.appendChild(computeBtn);

  if (resultLocal.preview) {
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700';
    cancelBtn.textContent = 'ล้างพรีวิว';
    cancelBtn.addEventListener('click', () => {
      resultLocal.preview = null;
      resultLocal.assignment = [];
      resultLocal.swapPick = null;
      $('#result-preview').classList.add('hidden');
      $('#result-preview').innerHTML = '';
      renderResultActions();
    });
    box.appendChild(cancelBtn);
  }
}

async function runCompute() {
  if (resultLocal.saved.length > 0) {
    const ok = await confirmDialog(
      'มีผลบันทึกไว้แล้ว — คำนวณใหม่จะเขียนทับ ยืนยันไหม?',
      { confirmText: 'คำนวณใหม่', danger: true }
    );
    if (!ok) return;
  }

  try {
    showBlocker('กำลังคำนวณ Hungarian...');
    const data = await api('computeResults', { token: getAdminToken() });
    // backend คืน { count, matrix, teams, awards, assignment: [{ awardId, teamId, voteCount, ... }] }
    resultLocal.preview = data;
    resultLocal.assignment = (data.assignment || []).map(a => ({
      teamId: a.teamId,
      awardId: a.awardId,
      voteCount: Number(a.voteCount) || 0,
      overridden: false,
    }));
    resultLocal.swapPick = null;
    renderResultPreview();
    renderResultActions();
  } catch (err) { showError(err); }
  finally { hideBlocker(); }
}

function renderResultPreview() {
  const box = $('#result-preview');
  box.classList.remove('hidden');

  const { matrix, teams, awards } = resultLocal.preview;
  const teamById = {};
  teams.forEach(t => teamById[t.TeamID] = t);
  const awardById = {};
  awards.forEach(a => awardById[a.AwardID] = a);

  const pickedCell = new Set(resultLocal.assignment.map(a => `${a.teamId}::${a.awardId}`));
  const totalVotes = resultLocal.assignment.reduce((s, a) => s + (a.voteCount || 0), 0);
  const overriddenCount = resultLocal.assignment.filter(a => a.overridden).length;

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
  const cards = [...resultLocal.assignment]
    .sort((a, b) => {
      const oa = awards.findIndex(x => x.AwardID === a.awardId);
      const ob = awards.findIndex(x => x.AwardID === b.awardId);
      return oa - ob;
    })
    .map(a => {
      const t = teamById[a.teamId];
      const aw = awardById[a.awardId];
      const idx = resultLocal.assignment.findIndex(x => x.teamId === a.teamId);
      const isPicked = resultLocal.swapPick === idx;
      return `
        <button data-idx="${idx}"
                class="result-swap-btn flex w-full items-center gap-3 rounded-xl p-3 text-left ring-1 active:scale-[0.99]
                       ${isPicked ? 'bg-amber-50 ring-amber-400' : a.overridden ? 'bg-rose-50 ring-rose-200' : 'bg-white ring-slate-200'}">
          ${t?.ImageURL
            ? `<img src="${esc(driveImageUrl(t.ImageURL))}" class="h-12 w-12 rounded-lg object-cover">`
            : `<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-400">📷</div>`}
          <div class="flex-1 min-w-0">
            <div class="truncate text-xs font-semibold text-sky-700">🏆 ${esc(aw?.AwardName || '?')}</div>
            <div class="truncate text-sm font-bold text-slate-800">${esc(t?.TeamName || '?')}</div>
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
        : '<span class="text-xs text-sky-700">(Hungarian optimal)</span>'}
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
      <button id="result-save-btn" class="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white">✅ บันทึกผล</button>
    </div>
  `;

  box.querySelectorAll('.result-swap-btn').forEach(btn => {
    btn.addEventListener('click', () => onSwapClick(Number(btn.dataset.idx)));
  });
  $('#result-save-btn').addEventListener('click', saveResults);
}

function onSwapClick(idx) {
  if (resultLocal.swapPick === null) {
    resultLocal.swapPick = idx;
    renderResultPreview();
    return;
  }
  if (resultLocal.swapPick === idx) {
    resultLocal.swapPick = null;
    renderResultPreview();
    return;
  }
  const a = resultLocal.assignment[resultLocal.swapPick];
  const b = resultLocal.assignment[idx];
  const { matrix, teams, awards } = resultLocal.preview;
  const teamIdx = id => teams.findIndex(t => t.TeamID === id);
  const awardIdx = id => awards.findIndex(x => x.AwardID === id);

  const newAVote = matrix[teamIdx(a.teamId)][awardIdx(b.awardId)];
  const newBVote = matrix[teamIdx(b.teamId)][awardIdx(a.awardId)];
  const tmpAward = a.awardId;
  a.awardId = b.awardId;
  a.voteCount = newAVote;
  a.overridden = true;
  b.awardId = tmpAward;
  b.voteCount = newBVote;
  b.overridden = true;

  resultLocal.swapPick = null;
  renderResultPreview();
}

async function saveResults() {
  const overriddenCount = resultLocal.assignment.filter(a => a.overridden).length;
  const msg = overriddenCount > 0
    ? `บันทึกผล?\n— มี admin override ${overriddenCount} คู่`
    : 'บันทึกผล?';
  const ok = await confirmDialog(msg, { confirmText: 'บันทึก' });
  if (!ok) return;

  const assignments = resultLocal.assignment.map(a => ({
    teamId: a.teamId,
    awardId: a.awardId,
    voteCount: a.voteCount,
    note: a.overridden ? 'admin override' : '',
  }));

  try {
    showBlocker('กำลังบันทึก...');
    await api('setResults', { token: getAdminToken(), assignments });
    showToast('บันทึกแล้ว', 'success');
    resultLocal.preview = null;
    resultLocal.assignment = [];
    resultLocal.swapPick = null;
    $('#result-preview').classList.add('hidden');
    $('#result-preview').innerHTML = '';
    await Promise.all([loadResults(), refreshDashboard()]);
  } catch (err) { showError(err); }
  finally { hideBlocker(); }
}

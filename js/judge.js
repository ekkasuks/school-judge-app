/**
 * judge.js — logic หน้ากรรมการ
 *
 * State machine:
 *   loading → (error | closed | done | round1 | round2)
 *
 * รอบ 1: drag & drop จัดอันดับ → submitRound1Vote
 * รอบ 2: (อยู่ใน Step 6)
 */

const $ = sel => document.querySelector(sel);
const STATES = ['loading', 'error', 'closed', 'done', 'round1', 'round2'];

const jstate = {
  token: '',
  ctx: null,
  pollTimer: null,
  r2: {
    index: 0,
    votes: {},      // { teamId: awardId }
    reviewing: false,
  },
};

/* ====================================================================
 * BOOT
 * ==================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  jstate.token = new URLSearchParams(location.search).get('token') || '';
  if (!jstate.token) {
    showState('error', 'ไม่พบ token ใน URL — กรุณาใช้ลิงก์ที่ได้รับจากผู้ดูแลระบบ');
    return;
  }
  $('#r1-submit').addEventListener('click', submitRound1);
  $('#r2-back').addEventListener('click', r2Back);
  $('#r2-next').addEventListener('click', r2Next);
  loadContext();
});

function showState(name, errorMsg = '') {
  STATES.forEach(s => { $('#state-' + s).hidden = s !== name; });
  if (name === 'error') $('#error-message').textContent = errorMsg || 'เกิดข้อผิดพลาด';
}

/* ====================================================================
 * LOAD CONTEXT
 * ==================================================================== */

async function loadContext() {
  try {
    const data = await api('getJudgeContext', { token: jstate.token });
    jstate.ctx = data;
    routeFromContext();
  } catch (err) {
    showState('error', err.message);
  }
}

function routeFromContext() {
  const { judge, round, roundOpen, teams } = jstate.ctx;

  if (judge.Voted) {
    $('#done-judge-info').textContent = `${judge.JudgeName} — รอบที่ ${round}`;
    if (judge.VotedAt) {
      $('#done-voted-at').textContent = 'ส่งเมื่อ: ' + formatThaiTime(judge.VotedAt);
    }
    showState('done');
    return;
  }

  if (!roundOpen) {
    $('#closed-judge-info').textContent = `${judge.JudgeName} — รอบที่ ${round}`;
    showState('closed');
    // poll ทุก 10 วินาที — เมื่อ admin เปิดรอบ จะ route ใหม่
    if (!jstate.pollTimer) {
      jstate.pollTimer = setInterval(loadContext, 10000);
    }
    return;
  }

  // เปิดรอบแล้ว → หยุด poll
  if (jstate.pollTimer) {
    clearInterval(jstate.pollTimer);
    jstate.pollTimer = null;
  }

  if (round === 1) {
    if (teams.length < 2) {
      showState('error', 'ยังไม่มีทีมที่เข้าแข่งขัน');
      return;
    }
    renderRound1();
  } else if (round === 2) {
    if (teams.length < 1 || jstate.ctx.awards.length < 1) {
      showState('error', 'ยังไม่มีข้อมูลทีมหรือรางวัล');
      return;
    }
    initRound2();
  } else {
    showState('error', 'รอบไม่ถูกต้อง');
  }
}

/* ====================================================================
 * ROUND 1 — DRAG & DROP RANKING
 * ==================================================================== */

function renderRound1() {
  const { judge, teams } = jstate.ctx;
  $('#r1-judge-name').textContent = judge.JudgeName;

  const list = $('#r1-list');
  list.innerHTML = teams.map((t, i) => renderRankCard(t, i + 1)).join('');

  Sortable.create(list, {
    handle: '.drag-handle',
    animation: 180,
    delay: 80,        // กดค้างเล็กน้อยก่อนลาก กัน scroll พลาด
    delayOnTouchOnly: true,
    touchStartThreshold: 5,
    onEnd: renumberRanks,
  });

  showState('round1');
}

function renderRankCard(team, rank) {
  const img = team.ImageURL
    ? `<img src="${esc(team.ImageURL)}" loading="lazy" class="h-16 w-16 rounded-lg object-cover shadow-sm">`
    : `<div class="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-2xl text-slate-400">📷</div>`;
  return `
    <li data-team-id="${esc(team.TeamID)}"
        class="flex items-center gap-3 rounded-2xl bg-white p-3 shadow ring-1 ring-slate-100">
      <span class="rank-badge flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-base font-bold text-white">${rank}</span>
      ${img}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1">
          <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">#${esc(team.TeamNumber)}</span>
        </div>
        <div class="mt-0.5 truncate text-sm font-bold text-slate-800">${esc(team.TeamName)}</div>
        <div class="truncate text-xs text-slate-500">${esc(team.School || '')}</div>
      </div>
      <span class="drag-handle text-2xl text-slate-300 select-none">☰</span>
    </li>`;
}

function renumberRanks() {
  $('#r1-list').querySelectorAll('li').forEach((li, i) => {
    li.querySelector('.rank-badge').textContent = i + 1;
  });
}

async function submitRound1() {
  const ids = [...$('#r1-list').querySelectorAll('li')].map(li => li.dataset.teamId);
  const ok = await confirmDialog(
    'ส่งคะแนนตามอันดับนี้?\n⚠️ ส่งแล้วไม่สามารถแก้ไขได้',
    { confirmText: 'ส่งคะแนน' }
  );
  if (!ok) return;

  try {
    showBlocker('กำลังส่งคะแนน...');
    await api('submitRound1Vote', { token: jstate.token, rankings: ids });
    showToast('ส่งคะแนนสำเร็จ!', 'success');
    // โหลด context ใหม่ → จะเข้า state 'done' อัตโนมัติ
    await loadContext();
  } catch (err) {
    showError(err);
  } finally {
    hideBlocker();
  }
}

/* ====================================================================
 * HELPERS
 * ==================================================================== */

function formatThaiTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('th-TH', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/* ====================================================================
 * ROUND 2 — เลือกรางวัลทีละทีม
 * ==================================================================== */

const R2_DRAFT_KEY = () => 'r2_draft_' + jstate.token;

function initRound2() {
  const { judge } = jstate.ctx;
  $('#r2-judge-name').textContent = judge.JudgeName;

  // restore draft (กัน user รีเฟรชแล้วเสียงานที่กรอกไปแล้ว)
  try {
    const raw = localStorage.getItem(R2_DRAFT_KEY());
    if (raw) {
      const draft = JSON.parse(raw);
      jstate.r2.votes = draft.votes || {};
      jstate.r2.index = Math.min(draft.index || 0, jstate.ctx.teams.length - 1);
    } else {
      jstate.r2.votes = {};
      jstate.r2.index = 0;
    }
  } catch {
    jstate.r2.votes = {};
    jstate.r2.index = 0;
  }
  jstate.r2.reviewing = false;

  showState('round2');
  renderR2Current();
}

function saveR2Draft() {
  try {
    localStorage.setItem(R2_DRAFT_KEY(), JSON.stringify({
      votes: jstate.r2.votes,
      index: jstate.r2.index,
    }));
  } catch {}
}

function clearR2Draft() {
  try { localStorage.removeItem(R2_DRAFT_KEY()); } catch {}
}

function renderR2Current() {
  const teams = jstate.ctx.teams;
  const awards = jstate.ctx.awards;
  const total = teams.length;

  // progress
  $('#r2-progress-text').textContent = `ทีม ${jstate.r2.index + 1} / ${total}`;
  $('#r2-progress-bar').style.width = `${Math.round(((jstate.r2.index + 1) / total) * 100)}%`;

  $('#r2-form').hidden = false;
  $('#r2-review').hidden = true;

  const team = teams[jstate.r2.index];
  const picked = jstate.r2.votes[team.TeamID] || '';

  $('#r2-team-card').innerHTML = `
    <div class="text-center">
      ${team.ImageURL
        ? `<img src="${esc(team.ImageURL)}" class="mx-auto h-48 w-48 rounded-2xl object-cover shadow">`
        : `<div class="mx-auto flex h-48 w-48 items-center justify-center rounded-2xl bg-slate-100 text-5xl text-slate-300">📷</div>`}
      <div class="mt-3 flex items-center justify-center gap-2">
        <span class="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">#${esc(team.TeamNumber)}</span>
      </div>
      <h2 class="mt-1 text-xl font-bold text-slate-800">${esc(team.TeamName)}</h2>
      <p class="text-sm text-slate-500">${esc(team.School || '')}</p>
    </div>
  `;

  $('#r2-awards').innerHTML = awards.map(a => `
    <li>
      <label class="flex items-center gap-3 rounded-2xl border-2 px-4 py-3 active:scale-[0.99] cursor-pointer ${picked === a.AwardID ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white'}">
        <input type="radio" name="r2-award" value="${esc(a.AwardID)}" ${picked === a.AwardID ? 'checked' : ''}
               class="h-5 w-5 text-sky-600 focus:ring-sky-500">
        <span class="flex-1 text-sm font-medium text-slate-800">${esc(a.AwardName)}</span>
      </label>
    </li>
  `).join('');

  // เลือก award → save + auto-advance ถ้ายังไม่ครบ
  $('#r2-awards').querySelectorAll('input[name="r2-award"]').forEach(input => {
    input.addEventListener('change', e => {
      jstate.r2.votes[team.TeamID] = e.target.value;
      saveR2Draft();
      renderR2Current(); // refresh visual (border highlight)
    });
  });

  // ปุ่ม navigation
  $('#r2-back').textContent = jstate.r2.index === 0 ? '← ย้อนกลับ' : '← ก่อนหน้า';
  $('#r2-back').disabled = jstate.r2.index === 0;
  $('#r2-back').classList.toggle('opacity-40', jstate.r2.index === 0);
  $('#r2-next').textContent = jstate.r2.index === total - 1 ? 'ตรวจสอบ →' : 'ถัดไป →';
}

function r2Back() {
  if (jstate.r2.reviewing) {
    jstate.r2.reviewing = false;
    renderR2Current();
    return;
  }
  if (jstate.r2.index === 0) return;
  jstate.r2.index--;
  saveR2Draft();
  renderR2Current();
}

function r2Next() {
  if (jstate.r2.reviewing) {
    submitRound2();
    return;
  }
  const team = jstate.ctx.teams[jstate.r2.index];
  if (!jstate.r2.votes[team.TeamID]) {
    showToast('โปรดเลือกรางวัลให้ทีมนี้ก่อน', 'warning');
    return;
  }
  if (jstate.r2.index < jstate.ctx.teams.length - 1) {
    jstate.r2.index++;
    saveR2Draft();
    renderR2Current();
  } else {
    renderR2Review();
  }
}

function renderR2Review() {
  jstate.r2.reviewing = true;
  $('#r2-form').hidden = true;
  $('#r2-review').hidden = false;

  const total = jstate.ctx.teams.length;
  $('#r2-progress-text').textContent = `สรุป ${total} / ${total}`;
  $('#r2-progress-bar').style.width = '100%';

  const awardsMap = {};
  jstate.ctx.awards.forEach(a => awardsMap[a.AwardID] = a);

  $('#r2-review-list').innerHTML = jstate.ctx.teams.map((t, i) => {
    const aw = awardsMap[jstate.r2.votes[t.TeamID]];
    return `
      <li>
        <button data-jump="${i}" class="w-full text-left flex items-center gap-3 rounded-2xl bg-white p-3 shadow ring-1 ring-slate-100 active:scale-[0.99]">
          ${t.ImageURL
            ? `<img src="${esc(t.ImageURL)}" class="h-12 w-12 rounded-lg object-cover">`
            : `<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-400">📷</div>`}
          <div class="flex-1 min-w-0">
            <div class="text-xs text-slate-500">#${esc(t.TeamNumber)} ${esc(t.TeamName)}</div>
            <div class="mt-0.5 truncate text-sm font-semibold text-sky-700">🏆 ${esc(aw ? aw.AwardName : '(ยังไม่เลือก)')}</div>
          </div>
          <span class="text-xs text-slate-400">✎</span>
        </button>
      </li>
    `;
  }).join('');

  $('#r2-review-list').querySelectorAll('[data-jump]').forEach(btn => {
    btn.addEventListener('click', () => {
      jstate.r2.index = Number(btn.dataset.jump);
      jstate.r2.reviewing = false;
      saveR2Draft();
      renderR2Current();
    });
  });

  $('#r2-back').textContent = '← แก้ไข';
  $('#r2-back').disabled = false;
  $('#r2-back').classList.remove('opacity-40');
  $('#r2-next').textContent = '✅ ส่งคะแนน';
}

async function submitRound2() {
  const teams = jstate.ctx.teams;
  // verify ครบ
  for (const t of teams) {
    if (!jstate.r2.votes[t.TeamID]) {
      showToast(`ยังไม่ได้เลือกรางวัลของ ${t.TeamName}`, 'warning');
      jstate.r2.index = teams.indexOf(t);
      jstate.r2.reviewing = false;
      renderR2Current();
      return;
    }
  }

  const ok = await confirmDialog(
    'ยืนยันส่งคะแนน?\n⚠️ ส่งแล้วไม่สามารถแก้ไขได้',
    { confirmText: 'ส่งคะแนน' }
  );
  if (!ok) return;

  try {
    showBlocker('กำลังส่งคะแนน...');
    await api('submitRound2Vote', { token: jstate.token, votes: jstate.r2.votes });
    clearR2Draft();
    showToast('ส่งคะแนนสำเร็จ!', 'success');
    await loadContext();
  } catch (err) {
    showError(err);
  } finally {
    hideBlocker();
  }
}

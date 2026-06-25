/**
 * judge.js — Logic หน้ากรรมการ (V2 — single round, per-award)
 *
 * State machine:
 *   loading → (error | pick-name | closed | done | vote)
 *
 * localStorage:
 *   - judge_id          : JudgeID ที่เลือกไว้
 *   - judge_draft_<id>  : { votes: {awardId: teamId}, awardIndex }
 */

const $ = sel => document.querySelector(sel);
const STATES = ['loading', 'error', 'pick-name', 'closed', 'done', 'vote'];

const jstate = {
  judgeId: '',
  ctx: null,            // ผลของ getVoteContext
  judgesList: null,     // ผลของ getJudgesList
  pollTimer: null,
  vote: {
    awardIndex: 0,
    votes: {},          // { awardId: teamId }
    reviewing: false,
  },
};

/* ====================================================================
 * BOOT
 * ==================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // bind buttons ครั้งเดียว
  $('#error-retry').addEventListener('click', start);
  $('#closed-change-name').addEventListener('click', changeName);
  $('#vote-change-name').addEventListener('click', changeName);
  $('#vote-back').addEventListener('click', voteBack);
  $('#vote-next').addEventListener('click', voteNext);

  start();
});

function start() {
  jstate.judgeId = localStorage.getItem('judge_id') || '';
  if (jstate.judgeId) {
    loadContext();
  } else {
    loadJudgesList();
  }
}

function showState(name, errorMsg = '') {
  STATES.forEach(s => { $('#state-' + s).hidden = s !== name; });
  if (name === 'error') $('#error-message').textContent = errorMsg || 'เกิดข้อผิดพลาด';
}

function clearPollTimer() {
  if (jstate.pollTimer) {
    clearInterval(jstate.pollTimer);
    jstate.pollTimer = null;
  }
}

function changeName() {
  if (jstate.judgeId) {
    // ไม่ลบ draft — เผื่อกลับมาเลือกชื่อเดิม
    localStorage.removeItem('judge_id');
  }
  jstate.judgeId = '';
  jstate.ctx = null;
  clearPollTimer();
  loadJudgesList();
}

/* ====================================================================
 * PICK NAME (ไม่มี judge_id ใน localStorage)
 * ==================================================================== */

async function loadJudgesList() {
  showState('loading');
  try {
    const data = await api('getJudgesList');
    jstate.judgesList = data;
    renderPickName();
  } catch (err) {
    showState('error', err.message);
  }
}

function renderPickName() {
  const { judges, votingOpen, eventName } = jstate.judgesList;
  $('#pick-event-name').textContent = eventName || '';
  $('#pick-voting-closed').hidden = votingOpen;

  const list = $('#pick-list');
  if (!judges || judges.length === 0) {
    list.innerHTML = '<li class="col-span-full rounded-xl bg-white p-4 text-center text-sm text-slate-500">ยังไม่มีกรรมการในระบบ</li>';
  } else {
    list.innerHTML = judges.map(j => {
      const done = j.Voted;
      return `
        <li>
          <button data-judge-id="${esc(j.JudgeID)}"
                  ${done ? 'disabled' : ''}
                  class="w-full rounded-2xl border-2 px-3 py-4 text-sm font-semibold transition active:scale-95
                         ${done
                           ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                           : 'border-emerald-300 bg-white text-emerald-800 shadow-sm hover:bg-emerald-50'}">
            ${done ? '✅ ' : ''}${esc(j.JudgeName)}
            ${done ? '<div class="mt-1 text-xs font-normal text-slate-400">ส่งแล้ว</div>' : ''}
          </button>
        </li>`;
    }).join('');

    list.querySelectorAll('button[data-judge-id]').forEach(btn => {
      btn.addEventListener('click', () => pickJudge(btn.dataset.judgeId));
    });
  }

  showState('pick-name');

  // ถ้า voting ยังไม่เปิด ให้ poll ทุก 10 วินาที refresh "Voted" flag + voting state
  clearPollTimer();
  jstate.pollTimer = setInterval(refreshPickList, 10000);
}

async function refreshPickList() {
  try {
    const data = await api('getJudgesList');
    jstate.judgesList = data;
    if (!jstate.judgeId) renderPickName(); // ถ้าไม่ได้เลือก ก็ refresh
  } catch {} // เงียบ
}

async function pickJudge(judgeId) {
  const j = jstate.judgesList?.judges?.find(x => x.JudgeID === judgeId);
  if (!j) return;
  if (j.Voted) {
    showToast('ท่านได้ส่งคะแนนแล้ว', 'warning');
    return;
  }
  localStorage.setItem('judge_id', judgeId);
  jstate.judgeId = judgeId;
  clearPollTimer();
  await loadContext();
}

/* ====================================================================
 * LOAD CONTEXT (มี judge_id แล้ว)
 * ==================================================================== */

async function loadContext() {
  showState('loading');
  try {
    const data = await api('getVoteContext', { judgeId: jstate.judgeId });
    jstate.ctx = data;
    routeFromContext();
  } catch (err) {
    // ถ้าไม่พบกรรมการ → ล้าง localStorage แล้วกลับไป pick-name
    if (err.message?.includes('ไม่พบกรรมการ')) {
      localStorage.removeItem('judge_id');
      jstate.judgeId = '';
      loadJudgesList();
      return;
    }
    showState('error', err.message);
  }
}

function routeFromContext() {
  const { judge, votingOpen, teams, awards } = jstate.ctx;

  if (judge.Voted) {
    $('#done-judge-info').textContent = judge.JudgeName;
    if (judge.VotedAt) {
      $('#done-voted-at').textContent = 'ส่งเมื่อ: ' + formatThaiTime(judge.VotedAt);
    }
    clearPollTimer();
    showState('done');
    return;
  }

  if (!votingOpen) {
    $('#closed-judge-info').textContent = judge.JudgeName;
    showState('closed');
    clearPollTimer();
    jstate.pollTimer = setInterval(loadContext, 10000);
    return;
  }

  // votingOpen + ยังไม่โหวต → เข้าหน้าโหวต
  if (teams.length === 0) {
    showState('error', 'ยังไม่มีทีมในระบบ');
    return;
  }
  if (awards.length === 0) {
    showState('error', 'ยังไม่มีรางวัลในระบบ');
    return;
  }
  if (teams.length !== awards.length) {
    showState('error', `จำนวนทีม (${teams.length}) ต้องเท่ากับจำนวนรางวัล (${awards.length})`);
    return;
  }

  clearPollTimer();
  initVote();
}

/* ====================================================================
 * VOTE — โหวตทีละรางวัล (per award)
 * ==================================================================== */

function draftKey() {
  return 'judge_draft_' + jstate.judgeId;
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(draftKey());
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveDraft() {
  try {
    localStorage.setItem(draftKey(), JSON.stringify({
      votes: jstate.vote.votes,
      awardIndex: jstate.vote.awardIndex,
    }));
  } catch {}
}

function clearDraft() {
  try { localStorage.removeItem(draftKey()); } catch {}
}

function initVote() {
  const draft = loadDraft();
  if (draft) {
    jstate.vote.votes = draft.votes || {};
    jstate.vote.awardIndex = Math.min(draft.awardIndex || 0, jstate.ctx.awards.length - 1);
  } else {
    jstate.vote.votes = {};
    jstate.vote.awardIndex = 0;
  }
  jstate.vote.reviewing = false;

  $('#vote-judge-name').textContent = jstate.ctx.judge.JudgeName;
  renderVoteCurrent();
  showState('vote');
}

function renderVoteCurrent() {
  const awards = jstate.ctx.awards;
  const teams = jstate.ctx.teams;
  const total = awards.length;
  const idx = jstate.vote.awardIndex;
  const award = awards[idx];
  const picked = jstate.vote.votes[award.AwardID] || '';

  // progress
  $('#vote-progress-text').textContent = `รางวัล ${idx + 1} / ${total}`;
  $('#vote-progress-bar').style.width = `${Math.round(((idx + 1) / total) * 100)}%`;

  $('#vote-form').hidden = false;
  $('#vote-review').hidden = true;

  // การ์ดรางวัล
  $('#vote-award-num').textContent = idx + 1;
  $('#vote-award-name').textContent = award.AwardName;

  // list ทีม
  $('#vote-teams').innerHTML = teams.map(t => `
    <li>
      <label class="flex items-center gap-3 rounded-2xl border-2 px-3 py-3 cursor-pointer active:scale-[0.99]
                    ${picked === t.TeamID ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white'}">
        <input type="radio" name="vote-team" value="${esc(t.TeamID)}" ${picked === t.TeamID ? 'checked' : ''}
               class="h-5 w-5 text-sky-600 focus:ring-sky-500">
        ${t.ImageURL
          ? `<img src="${esc(driveImageUrl(t.ImageURL))}" class="h-12 w-12 rounded-lg object-cover" loading="lazy">`
          : `<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-400">📷</div>`}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1">
            <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">#${esc(t.TeamNumber)}</span>
          </div>
          <div class="mt-0.5 truncate text-sm font-bold text-slate-800">${esc(t.TeamName)}</div>
          <div class="truncate text-xs text-slate-500">${esc(t.School || '')}</div>
        </div>
      </label>
    </li>
  `).join('');

  $('#vote-teams').querySelectorAll('input[name="vote-team"]').forEach(input => {
    input.addEventListener('change', e => {
      jstate.vote.votes[award.AwardID] = e.target.value;
      saveDraft();
      renderVoteCurrent(); // refresh visual
    });
  });

  // ปุ่ม navigation
  $('#vote-back').textContent = idx === 0 ? '← ก่อนหน้า' : '← ก่อนหน้า';
  $('#vote-back').disabled = idx === 0;
  $('#vote-back').classList.toggle('opacity-40', idx === 0);
  $('#vote-next').textContent = idx === total - 1 ? 'ตรวจสอบ →' : 'ถัดไป →';
}

function voteBack() {
  if (jstate.vote.reviewing) {
    jstate.vote.reviewing = false;
    renderVoteCurrent();
    return;
  }
  if (jstate.vote.awardIndex === 0) return;
  jstate.vote.awardIndex--;
  saveDraft();
  renderVoteCurrent();
}

function voteNext() {
  if (jstate.vote.reviewing) {
    submitVote();
    return;
  }
  const award = jstate.ctx.awards[jstate.vote.awardIndex];
  if (!jstate.vote.votes[award.AwardID]) {
    showToast('โปรดเลือกทีมก่อน', 'warning');
    return;
  }
  if (jstate.vote.awardIndex < jstate.ctx.awards.length - 1) {
    jstate.vote.awardIndex++;
    saveDraft();
    renderVoteCurrent();
  } else {
    renderVoteReview();
  }
}

function renderVoteReview() {
  jstate.vote.reviewing = true;
  $('#vote-form').hidden = true;
  $('#vote-review').hidden = false;

  const total = jstate.ctx.awards.length;
  $('#vote-progress-text').textContent = `สรุป ${total} / ${total}`;
  $('#vote-progress-bar').style.width = '100%';

  const teamById = {};
  jstate.ctx.teams.forEach(t => teamById[t.TeamID] = t);

  $('#review-list').innerHTML = jstate.ctx.awards.map((a, i) => {
    const team = teamById[jstate.vote.votes[a.AwardID]];
    return `
      <li>
        <button data-jump="${i}" class="w-full text-left flex items-center gap-3 rounded-2xl bg-white p-3 shadow ring-1 ring-slate-100 active:scale-[0.99]">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">${i + 1}</span>
          <div class="flex-1 min-w-0">
            <div class="truncate text-xs font-semibold text-amber-700">🏆 ${esc(a.AwardName)}</div>
            <div class="mt-0.5 truncate text-sm font-bold text-slate-800">
              ${team ? `#${esc(team.TeamNumber)} ${esc(team.TeamName)}` : '<span class="text-rose-600">(ยังไม่เลือก)</span>'}
            </div>
          </div>
          <span class="text-xs text-slate-400">✎</span>
        </button>
      </li>
    `;
  }).join('');

  $('#review-list').querySelectorAll('[data-jump]').forEach(btn => {
    btn.addEventListener('click', () => {
      jstate.vote.awardIndex = Number(btn.dataset.jump);
      jstate.vote.reviewing = false;
      saveDraft();
      renderVoteCurrent();
    });
  });

  $('#vote-back').textContent = '← แก้ไข';
  $('#vote-back').disabled = false;
  $('#vote-back').classList.remove('opacity-40');
  $('#vote-next').textContent = '✅ ส่งคะแนน';
}

async function submitVote() {
  const awards = jstate.ctx.awards;
  // verify ครบ
  for (const a of awards) {
    if (!jstate.vote.votes[a.AwardID]) {
      showToast(`ยังไม่ได้เลือกทีมของรางวัล "${a.AwardName}"`, 'warning');
      jstate.vote.awardIndex = awards.indexOf(a);
      jstate.vote.reviewing = false;
      renderVoteCurrent();
      return;
    }
  }

  const ok = await confirmDialog(
    'ยืนยันส่งคะแนน?\n⚠️ ส่งแล้วไม่สามารถแก้ไขได้',
    { confirmText: 'ส่งคะแนน' }
  );
  if (!ok) return;

  const votes = awards.map(a => ({ awardId: a.AwardID, teamId: jstate.vote.votes[a.AwardID] }));

  try {
    showBlocker('กำลังส่งคะแนน...');
    await api('submitVote', { judgeId: jstate.judgeId, votes });
    clearDraft();
    showToast('ส่งคะแนนสำเร็จ!', 'success');
    await loadContext(); // จะ route ไป "done"
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

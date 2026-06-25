/**
 * results.js — TV Reveal Mode (V2)
 *
 * Flow:
 *   - poll getResults ทุก 2 วินาที
 *   - render state ตาม (published, revealIndex, revealedTeam)
 *   - state changes → trigger animation + confetti + sound (best-effort)
 *   - admin (มี admin_token ใน localStorage) → แสดงแถบควบคุมล่างจอ
 *
 * States:
 *   loading | not-published | intro | award-name | award-team | final
 */

const $ = sel => document.querySelector(sel);

const rstate = {
  pollTimer: null,
  data: null,
  signature: '',     // ตรวจการเปลี่ยน state
  currentState: '',
  isAdmin: false,
};

document.addEventListener('DOMContentLoaded', () => {
  rstate.isAdmin = !!getAdminToken();
  if (rstate.isAdmin) {
    $('#admin-bar').hidden = false;
    bindAdminBar();
  }
  poll();
  rstate.pollTimer = setInterval(poll, 2000);
});

/* ====================================================================
 * POLL + RENDER
 * ==================================================================== */

async function poll() {
  try {
    const data = await api('getResults');
    rstate.data = data;
    applyState();
  } catch (err) {
    console.error('poll error:', err);
  }
}

function applyState() {
  const d = rstate.data;
  let next;
  if (!d.published) {
    next = 'not-published';
  } else if (Number(d.revealIndex || 0) === 0) {
    next = 'intro';
  } else if (Number(d.revealIndex) > Number(d.totalAwards)) {
    next = 'final';
  } else if (!d.revealedTeam) {
    next = 'award-name';
  } else {
    next = 'award-team';
  }

  const sig = `${next}-${d.revealIndex}-${d.revealedTeam}`;
  if (sig === rstate.signature) return;
  const prev = rstate.currentState;
  rstate.signature = sig;
  rstate.currentState = next;

  render(next, prev);
  updateBadge();
  updateAdminBar();
}

function updateBadge() {
  const d = rstate.data;
  if (!d.published || rstate.currentState === 'not-published' || rstate.currentState === 'loading') {
    $('#top-badge').hidden = true;
    return;
  }
  $('#top-badge').hidden = false;
  $('#badge-event').textContent = d.eventName || 'การประกวด';
  const idx = Number(d.revealIndex || 0);
  const total = Number(d.totalAwards || 0);
  if (rstate.currentState === 'final') {
    $('#badge-progress').textContent = `จบการประกาศ — ${total} รางวัล`;
  } else if (rstate.currentState === 'intro') {
    $('#badge-progress').textContent = `รอเริ่ม (${total} รางวัล)`;
  } else {
    $('#badge-progress').textContent = `รางวัลที่ ${idx} / ${total}`;
  }
}

/* ====================================================================
 * RENDER PER STATE
 * ==================================================================== */

function render(stateName, prev) {
  const stage = $('#stage');
  const d = rstate.data;

  switch (stateName) {
    case 'not-published':
      hideConfetti();
      stage.innerHTML = `
        <div class="reveal-in">
          <div class="text-7xl">🤫</div>
          <h1 class="mt-6 text-3xl font-bold sm:text-4xl">ยังไม่ประกาศผล</h1>
          <p class="mt-2 text-slate-300">โปรดติดตามการประกาศผลในช่วงพิธีปิดงาน</p>
          <p class="mt-8 text-xs text-slate-400">หน้านี้จะรีเฟรชอัตโนมัติ</p>
          <a href="index.html" class="mt-6 inline-block text-sm text-amber-300 underline">← กลับหน้าแรก</a>
        </div>`;
      break;

    case 'intro':
      hideConfetti();
      stage.innerHTML = `
        <div class="reveal-in">
          <div class="text-7xl sm:text-8xl">🎉</div>
          <h1 class="mt-4 text-4xl font-extrabold text-amber-200 sm:text-6xl text-glow-gold">ประกาศผลการประกวด</h1>
          <p class="mt-3 text-lg text-amber-100/90 sm:text-2xl">${esc(d.eventName || '')}</p>
          <p class="mt-1 text-sm text-slate-300">โรงเรียนบ้านใหม่</p>
          <p class="mt-12 text-sm text-amber-200/70 pulse-glow">
            ${rstate.isAdmin ? '🛠 กด "เริ่มประกาศ" ที่แถบล่าง' : 'รอผู้ดำเนินรายการ...'}
          </p>
        </div>`;
      break;

    case 'award-name': {
      hideConfetti();
      const current = d.results.find(r => Number(r.AwardOrder) === Number(d.revealIndex));
      if (!current) { stage.innerHTML = ''; return; }
      stage.innerHTML = `
        <div class="scale-in flex flex-col items-center">
          <p class="text-base font-semibold tracking-wide text-amber-200 sm:text-xl">รางวัลที่ ${Number(d.revealIndex)}</p>
          <div class="my-6 text-8xl sm:text-9xl pulse-glow">🏆</div>
          <h1 class="text-4xl font-extrabold text-amber-100 sm:text-7xl text-glow-gold">
            ${esc(current.AwardName)}
          </h1>
          <p class="mt-10 text-sm text-amber-200/70 pulse-glow">
            ${rstate.isAdmin ? '🛠 กด "เปิดผล" เพื่อเปิดเผยทีม' : 'กำลังเปิดผล...'}
          </p>
        </div>`;
      // เสียง drumroll
      playDrumRoll();
      break;
    }

    case 'award-team': {
      const current = d.results.find(r => Number(r.AwardOrder) === Number(d.revealIndex));
      if (!current) { stage.innerHTML = ''; return; }
      stage.innerHTML = `
        <div class="flex flex-col items-center reveal-in">
          <p class="text-sm font-semibold tracking-wide text-amber-200 sm:text-lg">รางวัลที่ ${Number(d.revealIndex)}</p>
          <h2 class="mt-1 text-xl font-bold text-amber-100 sm:text-3xl">🏆 ${esc(current.AwardName)}</h2>
        </div>
        <div class="scale-in mt-6 flex flex-col items-center">
          ${current.ImageURL
            ? `<img src="${esc(current.ImageURL)}" class="h-56 w-56 rounded-3xl object-cover shadow-2xl ring-4 ring-amber-300 sm:h-72 sm:w-72">`
            : `<div class="flex h-56 w-56 items-center justify-center rounded-3xl bg-slate-800 text-7xl ring-4 ring-amber-300 sm:h-72 sm:w-72">📷</div>`}
          <p class="mt-6 text-3xl font-extrabold text-white sm:text-5xl text-glow-gold">${esc(current.TeamName)}</p>
          <p class="mt-2 text-base text-amber-100/80 sm:text-xl">${esc(current.School || '')}</p>
          ${current.VoteCount != null
            ? `<p class="mt-3 inline-block rounded-full bg-amber-400/20 px-4 py-1 text-sm font-bold text-amber-200">${esc(current.VoteCount)} เสียง</p>`
            : ''}
        </div>
        <p class="mt-10 text-sm text-amber-200/70 pulse-glow">
          ${rstate.isAdmin
            ? (Number(d.revealIndex) >= Number(d.totalAwards)
                ? '🛠 กด "ดูสรุป" เพื่อจบการประกาศ'
                : '🛠 กด "รางวัลถัดไป" เพื่อประกาศต่อ')
            : ''}
        </p>`;
      startConfetti();
      playFanfare();
      break;
    }

    case 'final':
      hideConfetti();
      stage.innerHTML = `
        <div class="reveal-in w-full">
          <div class="text-7xl">🎊</div>
          <h1 class="mt-2 text-3xl font-extrabold text-amber-200 sm:text-5xl text-glow-gold">จบการประกาศผล</h1>
          <p class="mt-1 text-sm text-amber-100/80">ขอแสดงความยินดีกับทุกทีม 👏</p>

          <div class="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            ${(d.results || []).map(r => `
              <div class="reveal-in rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur text-left">
                <p class="text-xs font-semibold text-amber-200">🏆 ${esc(r.AwardName)}</p>
                <div class="mt-2 flex items-center gap-3">
                  ${r.ImageURL
                    ? `<img src="${esc(r.ImageURL)}" class="h-14 w-14 rounded-xl object-cover ring-2 ring-amber-300">`
                    : `<div class="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 text-2xl">📷</div>`}
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-base font-bold text-white">${esc(r.TeamName)}</p>
                    <p class="truncate text-xs text-amber-100/70">${esc(r.School || '')}</p>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>`;
      startConfetti();
      playFanfare();
      break;
  }
}

/* ====================================================================
 * ADMIN CONTROL BAR
 * ==================================================================== */

function bindAdminBar() {
  $('#admin-action').addEventListener('click', onAdminAction);
  $('#admin-prev').addEventListener('click', onAdminPrev);
}

function updateAdminBar() {
  if (!rstate.isAdmin) return;
  const d = rstate.data;
  const label = $('#admin-state-text');
  const action = $('#admin-action');
  const prev = $('#admin-prev');

  if (!d.published) {
    label.textContent = 'ยังไม่ประกาศ — เปิด resultsPublished ใน Admin Panel';
    action.textContent = 'ไม่พร้อม';
    action.disabled = true;
    prev.hidden = true;
    return;
  }
  prev.hidden = false;
  action.disabled = false;

  switch (rstate.currentState) {
    case 'intro':
      label.textContent = 'พร้อมเริ่ม';
      action.textContent = '🎤 เริ่มประกาศ';
      prev.hidden = true;
      break;
    case 'award-name':
      label.textContent = `รางวัลที่ ${d.revealIndex}`;
      action.textContent = '🎉 เปิดผล';
      prev.hidden = Number(d.revealIndex) === 1 ? false : false;
      break;
    case 'award-team':
      label.textContent = `รางวัลที่ ${d.revealIndex} (เปิดแล้ว)`;
      action.textContent = Number(d.revealIndex) >= Number(d.totalAwards)
        ? '🎊 ดูสรุป'
        : '➡️ รางวัลถัดไป';
      break;
    case 'final':
      label.textContent = 'จบการประกาศ';
      action.textContent = '↻ เริ่มใหม่';
      prev.hidden = true;
      break;
    default:
      label.textContent = '';
      action.textContent = '—';
      action.disabled = true;
  }
}

async function onAdminAction() {
  const d = rstate.data;
  if (!d.published) return;
  const total = Number(d.totalAwards);

  let payload;
  switch (rstate.currentState) {
    case 'intro':
      payload = { revealIndex: 1, revealedTeam: false };
      break;
    case 'award-name':
      payload = { revealedTeam: true };
      break;
    case 'award-team':
      payload = {
        revealIndex: Number(d.revealIndex) + 1,
        revealedTeam: false,
      };
      // เลย total → ไปหน้า final
      break;
    case 'final':
      payload = { revealIndex: 0, revealedTeam: false };
      break;
    default:
      return;
  }

  try {
    await api('setRevealState', { token: getAdminToken(), ...payload });
    await poll();
  } catch (err) {
    handleAdminError(err);
  }
}

async function onAdminPrev() {
  const d = rstate.data;
  if (!d.published) return;
  let payload;
  if (rstate.currentState === 'award-team') {
    // ถอย team reveal กลับเป็น name only
    payload = { revealedTeam: false };
  } else if (rstate.currentState === 'award-name' && Number(d.revealIndex) > 1) {
    // ถอยกลับ award ก่อนหน้า → แสดงทีมที่เปิดแล้ว
    payload = { revealIndex: Number(d.revealIndex) - 1, revealedTeam: true };
  } else if (rstate.currentState === 'award-name' && Number(d.revealIndex) === 1) {
    // กลับไป intro
    payload = { revealIndex: 0, revealedTeam: false };
  } else {
    return;
  }
  try {
    await api('setRevealState', { token: getAdminToken(), ...payload });
    await poll();
  } catch (err) {
    handleAdminError(err);
  }
}

function handleAdminError(err) {
  showToast(err.message || 'เกิดข้อผิดพลาด', 'error');
  if (err.message?.includes('Session')) {
    clearAdminToken();
    location.reload();
  }
}

/* ====================================================================
 * CONFETTI
 * ==================================================================== */

const CONFETTI_COLORS = ['#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a78bfa', '#fb7185', '#fcd34d'];
let confettiActive = false;

function startConfetti() {
  if (confettiActive) return;
  confettiActive = true;
  const stage = $('#confetti-stage');
  stage.hidden = false;
  stage.innerHTML = '';
  const count = window.innerWidth < 480 ? 30 : 60;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    el.style.animationDuration = (4 + Math.random() * 4) + 's';
    el.style.animationDelay = (Math.random() * 3) + 's';
    el.style.transform = `rotate(${Math.random() * 360}deg)`;
    el.style.width = (8 + Math.random() * 6) + 'px';
    el.style.height = (12 + Math.random() * 10) + 'px';
    stage.appendChild(el);
  }
  // หยุดเล่นใหม่หลัง 10 วินาที (clean up)
  setTimeout(() => { confettiActive = false; }, 10000);
}

function hideConfetti() {
  $('#confetti-stage').hidden = true;
  $('#confetti-stage').innerHTML = '';
  confettiActive = false;
}

/* ====================================================================
 * AUDIO (best-effort — ต้องมี user gesture ก่อนครั้งแรก)
 * ==================================================================== */

let audioCtx = null;
function getAudioCtx() {
  if (audioCtx) return audioCtx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
    return audioCtx;
  } catch { return null; }
}

function playDrumRoll() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(60, ctx.currentTime);
    o.frequency.linearRampToValueAtTime(45, ctx.currentTime + 0.6);
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    o.start();
    o.stop(ctx.currentTime + 0.7);
  } catch {}
}

function playFanfare() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    // C major triad ascending
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const t0 = ctx.currentTime + i * 0.12;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'triangle';
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.12, t0 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
      o.start(t0);
      o.stop(t0 + 0.65);
    });
  } catch {}
}

// บางเบราว์เซอร์ block AudioContext ก่อน user gesture — resume เมื่อ click ครั้งแรก
document.addEventListener('click', () => {
  const ctx = getAudioCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}, { once: true });

/**
 * results.js — หน้าประกาศผลสาธารณะ
 *
 * - poll getResults ทุก 10 วินาที
 * - ถ้า published=false → pending state + keep polling
 * - ถ้า published=true → render hero รอบ 1 + grid รอบ 2 + confetti
 */

const $ = sel => document.querySelector(sel);
const STATES = ['loading', 'pending', 'results'];

const rstate = {
  pollTimer: null,
  rendered: false,           // กัน render ซ้ำเมื่อ poll
  lastSignature: '',         // hash ของผลล่าสุด — เปลี่ยนเมื่อต่างกัน
};

document.addEventListener('DOMContentLoaded', () => {
  poll();
  rstate.pollTimer = setInterval(poll, 10000);
});

function showState(name) {
  STATES.forEach(s => { $('#state-' + s).hidden = s !== name; });
}

async function poll() {
  try {
    const data = await api('getResults');
    if (!data.published) {
      if (!rstate.rendered) showState('pending');
      else showState('pending'); // ถ้า admin ถอด publish ระหว่างทาง — กลับมา pending
      rstate.rendered = false;
      hideConfetti();
      return;
    }
    const signature = JSON.stringify((data.results || []).map(r =>
      [r.Round, r.AwardID, r.TeamID, r.Score]
    ));
    if (signature === rstate.lastSignature && rstate.rendered) return;
    rstate.lastSignature = signature;
    renderResults(data);
    rstate.rendered = true;
  } catch (err) {
    // เงียบไว้ — public ไม่ควรเห็น stack trace; รอ poll รอบหน้า
    console.error(err);
    if (!rstate.rendered) showState('pending');
  }
}

function renderResults(data) {
  $('#event-name').textContent = data.eventName || 'การประกวดชุดต่อต้านยาเสพติด';

  const results = data.results || [];
  const r1 = results.find(r => Number(r.Round) === 1);
  const r2 = results.filter(r => Number(r.Round) === 2);

  // ----- Round 1 hero -----
  const r1box = $('#r1-section');
  r1box.innerHTML = r1 ? renderHero(r1) : '';

  // ----- Round 2 grid -----
  const r2box = $('#r2-section');
  if (r2.length > 0) {
    r2box.innerHTML = `
      <h2 class="mb-4 text-center text-lg font-bold text-sky-800 sm:text-xl">🏅 รางวัล 6 ประเภท</h2>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        ${r2.map((r, i) => renderAwardCard(r, i)).join('')}
      </div>
    `;
  } else {
    r2box.innerHTML = '';
  }

  showState('results');
  startConfetti();
}

function renderHero(r) {
  return `
    <div class="reveal hero-card rounded-3xl p-6 shadow-xl ring-2 ring-amber-200 text-center">
      <div class="text-4xl sm:text-5xl">👑</div>
      <p class="mt-1 text-xs font-semibold uppercase tracking-wide text-amber-700">รางวัลพิเศษ</p>
      <h2 class="mt-1 text-xl font-extrabold text-amber-900 sm:text-2xl">${esc(r.AwardName)}</h2>
      <div class="mt-5 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center">
        ${r.ImageURL
          ? `<img src="${esc(r.ImageURL)}" class="h-40 w-40 rounded-2xl object-cover shadow-lg ring-4 ring-amber-300 sm:h-48 sm:w-48">`
          : `<div class="flex h-40 w-40 items-center justify-center rounded-2xl bg-amber-100 text-5xl text-amber-400 sm:h-48 sm:w-48">📷</div>`}
        <div class="text-center sm:text-left">
          <p class="text-xs text-amber-700">ผู้ชนะ</p>
          <p class="mt-1 text-2xl font-extrabold text-amber-900 sm:text-3xl">${esc(r.TeamName)}</p>
          <p class="text-sm text-amber-700">${esc(r.School || '')}</p>
          <p class="mt-3 inline-block rounded-full bg-amber-200/60 px-3 py-1 text-sm font-bold text-amber-900">
            คะแนนรวม ${esc(r.Score)}
          </p>
        </div>
      </div>
    </div>
  `;
}

function renderAwardCard(r, i) {
  return `
    <div class="reveal rounded-2xl bg-white p-4 shadow-md ring-1 ring-sky-100"
         style="animation-delay: ${i * 90}ms">
      <div class="flex items-center justify-between">
        <p class="text-xs font-semibold uppercase tracking-wide text-sky-600">🏆 รางวัล</p>
      </div>
      <h3 class="mt-1 text-base font-bold text-sky-900 sm:text-lg">${esc(r.AwardName)}</h3>
      <div class="mt-3 flex items-center gap-3">
        ${r.ImageURL
          ? `<img src="${esc(r.ImageURL)}" class="h-20 w-20 rounded-xl object-cover shadow ring-2 ring-sky-200">`
          : `<div class="flex h-20 w-20 items-center justify-center rounded-xl bg-sky-50 text-3xl text-sky-300">📷</div>`}
        <div class="flex-1 min-w-0">
          <p class="text-xs text-slate-500">ทีมผู้ชนะ</p>
          <p class="truncate text-lg font-bold text-slate-800">${esc(r.TeamName)}</p>
          <p class="truncate text-xs text-slate-500">${esc(r.School || '')}</p>
        </div>
      </div>
    </div>
  `;
}

/* ====================================================================
 * CONFETTI
 * ==================================================================== */

const CONFETTI_COLORS = ['#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a78bfa', '#fb7185'];
let confettiStarted = false;

function startConfetti() {
  if (confettiStarted) return;
  confettiStarted = true;
  const stage = $('#confetti-stage');
  stage.hidden = false;
  stage.innerHTML = '';
  const count = window.innerWidth < 480 ? 24 : 40;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    el.style.animationDuration = (4 + Math.random() * 4) + 's';
    el.style.animationDelay = (Math.random() * 6) + 's';
    el.style.transform = `rotate(${Math.random() * 360}deg)`;
    el.style.width = (6 + Math.random() * 6) + 'px';
    el.style.height = (10 + Math.random() * 8) + 'px';
    stage.appendChild(el);
  }
}

function hideConfetti() {
  $('#confetti-stage').hidden = true;
  confettiStarted = false;
}

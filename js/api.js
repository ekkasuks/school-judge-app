/**
 * api.js — fetch wrapper สำหรับเรียก Apps Script Web App
 *
 * รูปแบบ request:
 *   POST <API_URL>
 *   Content-Type: text/plain  (เลี่ยง CORS preflight)
 *   Body: { action, payload }
 *
 * รูปแบบ response:
 *   { ok: true, ...data } หรือ { ok: false, error }
 */

async function api(action, payload = {}) {
  if (!API_URL || API_URL.startsWith('PASTE_')) {
    throw new Error('ยังไม่ได้ตั้งค่า API_URL ใน js/config.js');
  }
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload }),
      redirect: 'follow',
    });
  } catch (err) {
    throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์: ' + err.message);
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('เซิร์ฟเวอร์ตอบกลับไม่ใช่ JSON');
  }
  if (!data.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
  return data;
}

/* ----- token helpers ----- */

function getAdminToken() {
  return localStorage.getItem('admin_token') || '';
}
function setAdminToken(token) {
  localStorage.setItem('admin_token', token);
}
function clearAdminToken() {
  localStorage.removeItem('admin_token');
}

/* ----- UI helpers ----- */

function showToast(message, type = 'info') {
  const colors = {
    info: 'bg-sky-600',
    success: 'bg-emerald-600',
    error: 'bg-rose-600',
    warning: 'bg-amber-600',
  };
  const el = document.createElement('div');
  el.className = `fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-xl ${colors[type]} px-5 py-3 text-sm font-medium text-white shadow-2xl transition-all`;
  el.style.maxWidth = '90vw';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%, -20px)';
    setTimeout(() => el.remove(), 300);
  }, 2500);
}

function showError(err) {
  showToast(err.message || err, 'error');
}

/* ----- file → base64 ----- */

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(',')[1]; // strip data:...;base64,
      resolve({ base64, mimeType: file.type, filename: file.name });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ----- escape HTML ----- */

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ----- simple confirm modal (returns promise) ----- */

function confirmDialog(message, { confirmText = 'ยืนยัน', cancelText = 'ยกเลิก', danger = false } = {}) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4';
    overlay.innerHTML = `
      <div class="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <p class="text-base text-gray-800">${esc(message)}</p>
        <div class="mt-5 flex gap-2">
          <button data-act="cancel" class="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700">${esc(cancelText)}</button>
          <button data-act="ok" class="flex-1 rounded-xl ${danger ? 'bg-rose-600' : 'bg-emerald-600'} px-4 py-3 text-sm font-medium text-white">${esc(confirmText)}</button>
        </div>
      </div>`;
    overlay.addEventListener('click', e => {
      const act = e.target.dataset?.act;
      if (act === 'ok') { overlay.remove(); resolve(true); }
      else if (act === 'cancel' || e.target === overlay) { overlay.remove(); resolve(false); }
    });
    document.body.appendChild(overlay);
  });
}

/* ----- block UI overlay ----- */

let _blockCount = 0;
function showBlocker(text = 'กำลังทำงาน...') {
  _blockCount++;
  let el = document.getElementById('app-blocker');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-blocker';
    el.className = 'fixed inset-0 z-40 flex items-center justify-center bg-black/30';
    el.innerHTML = `
      <div class="rounded-xl bg-white px-6 py-4 shadow-xl">
        <div class="flex items-center gap-3">
          <div class="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent"></div>
          <span id="app-blocker-text" class="text-sm text-gray-700"></span>
        </div>
      </div>`;
    document.body.appendChild(el);
  }
  document.getElementById('app-blocker-text').textContent = text;
}
function hideBlocker() {
  _blockCount = Math.max(0, _blockCount - 1);
  if (_blockCount === 0) {
    document.getElementById('app-blocker')?.remove();
  }
}

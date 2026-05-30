/**
 * admin-core.js — Lógica JS partilhada do Portal Admin 3DZAAP
 * Depende de: supabase.js (expõe _sb, Auth)
 */

// ── Constants ─────────────────────────────────────────────
const PLAN_MRR = {
  trial: 0,
  starter: 9.90, pro: 19.90, business: 39.90,
  starter_ano: 7.90, pro_ano: 15.90, business_ano: 31.90
};
const PLAN_ANNUAL_TOTAL = {
  starter_ano: 7.90 * 12,
  pro_ano:    15.90 * 12,
  business_ano: 31.90 * 12
};

// ── Supabase client helper ────────────────────────────────
function _adminSb() {
  if (typeof _sb !== 'undefined' && _sb && typeof _sb.from === 'function') return _sb;
  return window._adminSbClient || (window._adminSbClient = supabase.createClient(
    typeof SUPABASE_URL  !== 'undefined' ? SUPABASE_URL  : '',
    typeof SUPABASE_ANON !== 'undefined' ? SUPABASE_ANON : ''
  ));
}

// ── Auth guard — redireciona para login.html se não for admin ──
async function checkAdminAccess(onGranted) {
  try {
    const { data: { session: sbSession } } = await _sb.auth.getSession();
    if (!sbSession) {
      window.location.href = 'login.html';
      return;
    }
    const session = await Auth.getSession();
    if (!session || !session.isSuperAdmin) {
      window.location.href = 'login.html';
      return;
    }
    AdminSidebar.setAdminEmail(session.email);
    if (typeof onGranted === 'function') await onGranted(session);
  } catch (e) {
    console.error('[AdminCore] checkAdminAccess error:', e);
    window.location.href = 'login.html';
  }
}

// ── Toast ──────────────────────────────────────────────────
let _toastTimer;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.innerHTML = msg;
  el.className = 'toast show ' + type;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 4500);
}

// ── Escape HTML ────────────────────────────────────────────
function escH(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Set text content safely ────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Relative time ─────────────────────────────────────────
function fmtRelativeTime(date) {
  const now = new Date();
  const d = date instanceof Date ? date : new Date(date);
  const diffMs = now - d;
  const diffMin  = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay  = Math.floor(diffMs / 86400000);
  if (diffMin  <  1)  return 'agora';
  if (diffMin  < 60)  return `${diffMin}min`;
  if (diffHour < 24)  return `${diffHour}h`;
  if (diffDay  < 30)  return `${diffDay}d`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}m`;
  return `${Math.floor(diffMonth / 12)}a`;
}

// ── Theme toggle ───────────────────────────────────────────
function initThemeToggle() {
  const saved = localStorage.getItem('3dzaap_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('topbarThemeToggle');
  if (btn) btn.innerHTML = saved === 'dark' ? '<i class="ph-bold ph-sun"></i>' : '<i class="ph-bold ph-moon"></i>';
}

function toggleTheme() {
  const cur  = document.documentElement.getAttribute('data-theme') || 'light';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('3dzaap_theme', next); } catch(e) {}
  const btn = document.getElementById('topbarThemeToggle');
  if (btn) btn.innerHTML = next === 'dark' ? '<i class="ph-bold ph-sun"></i>' : '<i class="ph-bold ph-moon"></i>';
}

// ── Confirm dialog helper ──────────────────────────────────
function openConfirm(title, msg, onOk, icon = '<i class="ph-bold ph-warning"></i>') {
  const ov = document.getElementById('confirmOverlay');
  if (!ov) return;
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').innerHTML  = msg;
  document.getElementById('confirmIcon').innerHTML = icon;
  const btn = document.getElementById('confirmOkBtn');
  btn.onclick = () => { closeConfirm(); onOk(); };
  ov.style.display = 'flex';
  setTimeout(() => ov.classList.add('open'), 10);
}
function closeConfirm() {
  const ov = document.getElementById('confirmOverlay');
  if (ov) { ov.classList.remove('open'); setTimeout(() => ov.style.display = 'none', 250); }
}

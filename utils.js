// ============================================================
// utils.js — 3DZAAP  v1.0
// Funções utilitárias partilhadas por todas as páginas.
//
// USO EM CADA PÁGINA:
//   Adicionar antes de </body> (depois de supabase.js, antes de sidebar.js):
//     <script src="utils.js"></script>
//
// EXPÕE GLOBALMENTE:
//   escH(s)             — escape HTML
//   escAttr(s)          — escape atributos HTML
//   fmtEur(v)           — formata valor monetário (usa _cfg)
//   fmtDate(s)          — formata data ISO (usa _cfg)
//   showToast(msg,type) — toast de feedback ('ok' | 'err' | '')
//   loadCfg(session)    — inicializa _cfg a partir da sessão
//   toggleTheme()       — alterna dark/light mode
//   initThemeToggle()   — sincroniza ícone do botão de tema
// ============================================================

// ── ESCAPE ───────────────────────────────────────────────────
function escH(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escAttr(s) {
  return String(s || '').replace(/"/g,'&quot;');
}

// ── CONFIG GLOBAL ─────────────────────────────────────────────
// _cfg é partilhado entre loadCfg, fmtEur e fmtDate
// Cada página deve chamar loadCfg(session) após Auth.getSession()
var _cfg = {};

function loadCfg(session) {
  _cfg = (session && session.config) ? session.config : {};
  var currMap = { 'EUR':'€', 'BRL':'R$', 'USD':'$', 'GBP':'£' };
  _cfg._currSymbol = currMap[_cfg.currency] || '€';
  _cfg._currCode   = _cfg.currency || 'EUR';
  var locMap = { 'EUR':'pt-PT', 'BRL':'pt-BR', 'USD':'en-US', 'GBP':'en-GB' };
  _cfg._locale     = locMap[_cfg.currency] || 'pt-PT';
  _cfg._dateFmt    = _cfg.dateFmt    || 'DD/MM/YYYY';
  _cfg._weightUnit = _cfg.weightUnit || 'g';
  _cfg._margin     = parseFloat(_cfg.margin) || 30;
}

// ── FORMATTERS ────────────────────────────────────────────────
function fmtEur(v) {
  var sym = (_cfg && _cfg._currSymbol) || '€';
  var loc = (_cfg && _cfg._locale)     || 'pt-PT';
  return sym + ' ' + parseFloat(v || 0).toLocaleString(loc, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function fmtDate(s) {
  if (!s) return '—';
  var c = String(s).slice(0, 10);
  var d = new Date(c + 'T12:00:00');
  if (isNaN(d.getTime())) return c;
  var fmt  = (_cfg && _cfg._dateFmt) || 'DD/MM/YYYY';
  var dd   = String(d.getDate()).padStart(2, '0');
  var mm   = String(d.getMonth() + 1).padStart(2, '0');
  var yyyy = d.getFullYear();
  if (fmt === 'MM/DD/YYYY') return mm + '/' + dd + '/' + yyyy;
  if (fmt === 'YYYY-MM-DD') return yyyy + '-' + mm + '-' + dd;
  return dd + '/' + mm + '/' + yyyy;
}

// ── TOAST ─────────────────────────────────────────────────────
var _toastTimer;
function showToast(msg, type) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + (type || '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function() { t.classList.remove('show'); }, 3000);
}

// ── THEME SYSTEM ──────────────────────────────────────────────
// Single source of truth for dark/light mode across all pages.
//
// RULES:
//   - Theme is stored in localStorage '3dzaap_theme': 'light' | 'dark'
//   - Default is always 'light' when nothing is stored
//   - Never follows OS preference — only changed by explicit user action:
//       a) Clicking the ☀️/🌙 toggle button (calls toggleTheme)
//       b) Changing in Settings page and saving
//   - Every page <head> must apply theme early to avoid flash:
//       <script>
//         (function(){
//           var t = localStorage.getItem('3dzaap_theme') || 'light';
//           document.documentElement.setAttribute('data-theme', t);
//         })();
//       </script>

function applyTheme(theme) {
  var t = (theme === 'dark') ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('3dzaap_theme', t);
  var b = document.getElementById('themeToggle');
  if (b) b.textContent = t === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

function initThemeToggle() {
  var t = document.documentElement.getAttribute('data-theme') || 'light';
  var b = document.getElementById('themeToggle');
  if (b) b.textContent = t === 'dark' ? '☀️' : '🌙';
}

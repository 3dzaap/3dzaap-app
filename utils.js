// ============================================================
// Safely handle localStorage and document.body for restricted environments (Safari Private/Incognito)
(function() {
  try {
    var testKey = '__test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
  } catch (e) {
    console.warn('[3DZAAP] LocalStorage bloqueado. Usando memória temporária.');
    var _mem = {};
    window.localStorage = {
      getItem: function(k) { return _mem[k] || null; },
      setItem: function(k, v) { _mem[k] = String(v); },
      removeItem: function(k) { delete _mem[k]; },
      clear: function() { _mem = {}; },
      key: function(i) { return Object.keys(_mem)[i] || null; },
      get length() { return Object.keys(_mem).length; }
    };
  }
})();

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
  if (_cfg.currency) {
    var currMap = { 'EUR':'€', 'BRL':'R$', 'USD':'$', 'GBP':'£' };
    _cfg._currSymbol = currMap[_cfg.currency] || '€';
    _cfg._currCode   = _cfg.currency;
    var locMap = { 'EUR':'pt-PT', 'BRL':'pt-BR', 'USD':'en-US', 'GBP':'en-GB' };
    _cfg._locale     = locMap[_cfg.currency] || 'pt-PT';
  } else {
    // Default fallback if no config
    _cfg._currSymbol = '€';
    _cfg._currCode   = 'EUR';
    _cfg._locale     = 'pt-PT';
  }
  _cfg._dateFmt    = _cfg.dateFmt    || 'DD/MM/YYYY';
  _cfg._weightUnit = _cfg.weightUnit || 'g';
  _cfg._margin     = parseFloat(_cfg.margin) || 30;
  window._3dzaap_cfg_ready = true;
}

// ── FORMATTERS ────────────────────────────────────────────────
function getCurrencyConfig() {
  const lang = localStorage.getItem('3dzaap_lang') || 'pt-PT';
  
  // Regras de Símbolo solicitadas:
  // En: $ | PT e ES: € | BR: R$ | UK: £
  const map = {
    'en':    { symbol: '$',  code: 'USD', locale: 'en-US' },
    'pt-PT': { symbol: '€',  code: 'EUR', locale: 'pt-PT' },
    'es':    { symbol: '€',  code: 'EUR', locale: 'es-ES' },
    'pt-BR': { symbol: 'R$', code: 'BRL', locale: 'pt-BR' },
    'en-GB': { symbol: '£',  code: 'GBP', locale: 'en-GB' }
  };
  
  // Fallback para EN base caso não coincida exactamente
  if (map[lang]) return map[lang];
  if (lang.startsWith('en')) return map['en'];
  
  return map['pt-PT']; // Default de segurança
}

function getCurrencySymbol() {
  return getCurrencyConfig().symbol;
}

function getCurrencyCode() {
  return getCurrencyConfig().code;
}

function fmtCurrency(v) {
  var val = parseFloat(v || 0);
  const conf = getCurrencyConfig();

  try {
    return new Intl.NumberFormat(conf.locale, {
      style: 'currency',
      currency: conf.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  } catch (e) {
    return conf.symbol + ' ' + val.toLocaleString(conf.locale, { minimumFractionDigits: 2 });
  }
}

// Alias for backward compatibility
function fmtEur(v) { return fmtCurrency(v); }

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
  t.innerHTML = msg;
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
//       a) Clicking the Sun/Moon toggle button (calls toggleTheme)
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
  if (b) b.innerHTML = t === 'dark' ? '<i class="ph-bold ph-sun"></i>' : '<i class="ph-bold ph-moon"></i>';
}

function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

function initThemeToggle() {
  var t = document.documentElement.getAttribute('data-theme') || 'light';
  var b = document.getElementById('themeToggle');
  if (b) b.innerHTML = t === 'dark' ? '<i class="ph-bold ph-sun"></i>' : '<i class="ph-bold ph-moon"></i>';
}
// ── UI COMPONENTS ─────────────────────────────────────────────
var UI = {
  _gateConfig: {
    orders:     { icon:'<i class="ph-bold ph-shopping-cart"></i>', title:'Gestão de Encomendas', sub:'Controlo total do fluxo de produção e histórico de pedidos.', plans:['pro','business'] },
    financial:  { icon:'<i class="ph-bold ph-money"></i>', title:'Módulo Financeiro', sub:'Análise completa de receitas, relatórios mensais e exportação financeira.', plans:['business'] },
    backoffice: { icon:'<i class="ph-bold ph-layout"></i>', title:'Portal do Cliente', sub:'Área exclusiva para os teus clientes submeterem pedidos e orçamentarem.', plans:['pro','business'] },
    materials:  { icon:'<i class="ph-bold ph-palette"></i>', title:'Gestão de Materiais', sub:'Controle de stock avançado e estatísticas de consumo.', plans:['starter','pro','business'] },
    printers:   { icon:'<i class="ph-bold ph-printer"></i>', title:'Gestão de Impressoras', sub:'Monitorização de horas de uso e alertas de manutenção.', plans:['starter','pro','business'] }
  },

  showFeatureGate: function(moduleKey) {
    var cfg = this._gateConfig[moduleKey] || { icon:'<i class="ph-bold ph-lock"></i>', title:'Módulo Restrito', sub:'Este módulo requer um plano superior.', plans:['pro'] };
    
    // Create overlay if not exists
    var overlay = document.getElementById('gateOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'gateOverlay';
      overlay.className = 'gate-overlay';
      document.body.appendChild(overlay);
    }

    var planLabels = window.PLAN_LABELS || { starter:'Starter', pro:'Pro', business:'Business' };
    var planPrices = window.PLAN_PRICES || { starter: '€ 9.90', pro: '€ 19.90', business: '€ 39.90' };

    var plansHtml = '<div class="gate-plans">' +
      cfg.plans.map(function(p) {
        return '<div class="gate-plan-row required">' +
               '<span class="gate-plan-name"><i class="ph-bold ph-check-circle"></i> ' + (planLabels[p] || p.toUpperCase()) + '</span>' +
               '<span class="gate-plan-price">' + (planPrices[p] || '') + '</span>' +
               '</div>';
      }).join('') +
      '</div>';

    overlay.innerHTML = 
      '<div class="gate-modal">' +
        '<div class="gate-icon">' + cfg.icon + '</div>' +
        '<h2 class="gate-title">' + cfg.title + '</h2>' +
        '<p class="gate-sub">' + cfg.sub + '</p>' +
        '<div class="gate-plans">' + plansHtml + '</div>' +
        '<div class="gate-actions">' +
          '<a href="settings.html?tab=assinatura" class="btn-upgrade-premium">Fazer Upgrade Agora</a>' +
          '<button class="btn-gate-cancel" onclick="UI.closeFeatureGate()">Voltar</button>' +
        '</div>' +
      '</div>';

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  closeFeatureGate: function() {
    var overlay = document.getElementById('gateOverlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
    // If we are in a page that REQUIRES this access, go back
    var path = window.location.pathname;
    if (path.includes('orders.html') || path.includes('financial.html') || path.includes('backoffice.html')) {
      window.location.href = 'dashboard.html';
    }
  }
};
// ── PDF GENERATION ──────────────────────────────────────────
/**
 * Utilitário para gerar PDF de um elemento HTML usando html2pdf.js.
 * @param {string} elementId  ID do elemento a converter
 * @param {string} filename   Nome do ficheiro (ex: 'OS-123.pdf')
 * @param {object} customOpts Opções personalizadas para o html2pdf
 */
async function downloadPDF(elementId, filename, customOpts = {}) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('[3DZAAP] Elemento para PDF não encontrado:', elementId);
    return;
  }

  // Carregar biblioteca via CDN se não estiver carregada
  if (typeof html2pdf === 'undefined') {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.crossOrigin = 'anonymous';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Falha ao carregar biblioteca PDF'));
      document.head.appendChild(script);
    });
  }

  const opt = {
    margin: [10, 5, 10, 5], 
    filename: filename || 'documento.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true, 
      letterRendering: true,
      logging: false,
      scrollY: 0,
      // Se não for especificado, usamos uma janela virtual de 800px para evitar cortes em mobile
      windowWidth: (customOpts && customOpts.html2canvas && customOpts.html2canvas.windowWidth) || 800
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    ...customOpts
  };

  try {
    await html2pdf().set(opt).from(element).save();
  } catch (err) {
    console.error('[3DZAAP] Erro ao gerar PDF:', err);
    throw err;
  }
}

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
    'en-US': { symbol: '$',  code: 'USD', locale: 'en-US' },
    'en':    { symbol: '$',  code: 'USD', locale: 'en-US' },
    'pt-PT': { symbol: '€',  code: 'EUR', locale: 'pt-PT' },
    'es':    { symbol: '€',  code: 'EUR', locale: 'es-ES' },
    'pt-BR': { symbol: 'R$', code: 'BRL', locale: 'pt-BR' },
    'en-GB': { symbol: '£',  code: 'GBP', locale: 'en-GB' },
    'en-EU': { symbol: '€',  code: 'EUR', locale: 'en-EU' }
  };
  
  if (map[lang]) return map[lang];
  if (lang.startsWith('en')) return map['en-US'];
  
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

/**
 * 3DZAAP Duration Parsers & Formatters
 * Used to handle HH:MM format across the platform.
 */
function parseTime(val) {
  if (!val) return 0;
  val = String(val).trim();
  if (val.includes(':')) {
    const parts = val.split(':');
    const h = parseFloat(parts[0]) || 0;
    const m = parseFloat(parts[1]) || 0;
    return h + (m / 60);
  }
  return parseFloat(String(val).replace(',', '.')) || 0;
}

function formatTime(decimalHours) {
  if (!decimalHours || decimalHours <= 0) return "0:00";
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  if (m === 60) return `${h + 1}:00`;
  return `${h}:${m.toString().padStart(2, '0')}`;
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
    
    // Determine if this is a full-page gate (page is completely inaccessible)
    var path = window.location.pathname;
    var isFullPageGate = path.includes('orders.html') || path.includes('financial.html') || path.includes('backoffice.html');
    var backBtnLabel = isFullPageGate ? '<i class="ph-bold ph-house"></i> Ir para o Dashboard' : '<i class="ph-bold ph-x"></i> Fechar';

    // Create overlay if not exists
    var overlay = document.getElementById('gateOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'gateOverlay';
      overlay.className = 'gate-overlay';
      document.body.appendChild(overlay);
    }

    var planLabels = window.PLAN_LABELS || { starter:'Starter', pro:'Pro', business:'Business' };
    var sym = window.getCurrency ? window.getCurrency() : '€';
    var planPrices = window.PLAN_PRICES || { starter: sym + ' 0.00', pro: sym + ' 19.90', business: sym + ' 39.90' };

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
          '<button class="btn-gate-cancel" onclick="UI.closeFeatureGate()">' + backBtnLabel + '</button>' +
        '</div>' +
      '</div>';

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  closeFeatureGate: function() {
    var overlay = document.getElementById('gateOverlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
    // If on a fully-gated page, always redirect to dashboard
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

  // Carrega jsPDF via CDN se necessário
  if (typeof window.jspdf === 'undefined') {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Falha ao carregar biblioteca jsPDF'));
      document.head.appendChild(script);
    });
  }

  // Carrega html2canvas via CDN se necessário
  if (typeof window.html2canvas === 'undefined') {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Falha ao carregar biblioteca html2canvas'));
      document.head.appendChild(script);
    });
  }

  try {
    const canvas = await window.html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      onclone: (clonedDoc) => {
        const clonedElement = clonedDoc.getElementById(elementId);
        if (clonedElement) {
          // Garante largura fixa e tema claro de alto contraste
          clonedElement.style.width = '700px';
          clonedElement.style.background = '#ffffff';
          clonedElement.style.color = '#0f172a';

          const pdfStyle = clonedDoc.createElement('style');
          pdfStyle.innerHTML = `
            :root {
              --dark: #0f172a !important;
              --muted: #475569 !important;
              --subtle: #64748b !important;
            }
            body, #${elementId} {
              background: #ffffff !important;
              color: #0f172a !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            }
            #${elementId} p, #${elementId} span, #${elementId} div, #${elementId} li, #${elementId} td, #${elementId} th {
              color: #0f172a !important;
              letter-spacing: normal !important;
              word-spacing: normal !important;
            }
            #${elementId} h1, #${elementId} h2, #${elementId} h3, #${elementId} h4 {
              color: #4f46e5 !important;
            }
          `;
          clonedDoc.head.appendChild(pdfStyle);

          clonedElement.querySelectorAll('.rcpt-body, .rcpt-card').forEach(el => {
            el.style.background = '#ffffff';
            el.style.color = '#1e293b';
            el.style.flex = 'unset';
          });

          clonedElement.querySelectorAll('*').forEach(el => {
            const bg = el.style.background || '';
            if (bg.includes('rgba(255, 255, 255') || bg.includes('rgba(255,255,255')) {
              el.style.background = '#f8fafc';
              el.style.border = '1px solid #cbd5e1';
            }
          });

          // Previne corte de texto verificando apenas elementos atômicos pequenos (< 300px de altura)
          // Isso evita empurrar blocos gigantes (como listas inteiras) e criar espaços em branco
          const pageBreakPx = 1026; // altura útil por página (267mm de conteúdo para 182mm de largura)
          const atomicBlocks = clonedElement.querySelectorAll('.rcpt-card, h1, h2, h3, h4, p, li, tr');
          atomicBlocks.forEach(block => {
            const h = block.offsetHeight;
            if (h > 0 && h < 300) {
              const top = block.offsetTop;
              const bottom = top + h;
              const pageIdx = Math.floor(top / pageBreakPx);
              const nextBreakY = (pageIdx + 1) * pageBreakPx;
              const safeBottom = nextBreakY - 40;

              if (bottom > safeBottom && top < nextBreakY) {
                const pushDown = (nextBreakY - top) + 20;
                const currentMarginTop = parseInt(block.style.marginTop || '0', 10);
                block.style.marginTop = `${currentMarginTop + pushDown}px`;
              }
            }
          });
        }
      },
      ...(customOpts.html2canvas || {})
    });

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      ...(customOpts.jsPDF || {})
    });

    // Fatiamento com Margens Executivas (14mm topo/esquerda/direita, 16mm rodapé)
    const printWidthMm = 182; // 210mm - 28mm margens laterais
    const printHeightMm = 267; // 297mm - 30mm margens superior/inferior
    const sliceHeight = Math.floor(canvas.width * (printHeightMm / printWidthMm));
    const totalPages = Math.ceil(canvas.height / sliceHeight);

    // Dimensões em pixels do canvas final de folha A4 completa
    const a4WidthPx = Math.floor(canvas.width * (210 / printWidthMm));
    const a4HeightPx = Math.floor(canvas.width * (297 / printWidthMm));
    const leftMarginPx = Math.floor(canvas.width * (14 / printWidthMm));
    const topMarginPx = Math.floor(canvas.width * (14 / printWidthMm));

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage();

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = a4WidthPx;
      pageCanvas.height = a4HeightPx;
      const ctx = pageCanvas.getContext('2d');

      // Fundo 100% branco para toda a folha A4
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, a4WidthPx, a4HeightPx);

      // Desenha o conteúdo fatiado centralizado dentro das margens (esquerda 14mm, topo 14mm)
      ctx.drawImage(
        canvas,
        0, page * sliceHeight, canvas.width, sliceHeight,
        leftMarginPx, topMarginPx, canvas.width, sliceHeight
      );

      // Rodapé executivo na margem inferior
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('3DZAAP — Relatório Executivo & Diagnóstico Operacional', leftMarginPx, a4HeightPx - Math.floor(topMarginPx * 0.55));
      ctx.font = '20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`Página ${page + 1} de ${totalPages}`, a4WidthPx - leftMarginPx - 145, a4HeightPx - Math.floor(topMarginPx * 0.55));

      const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.98);
      pdf.addImage(pageImgData, 'JPEG', 0, 0, 210, 297);
    }

    pdf.save(filename || 'documento.pdf');
  } catch (err) {
    console.error('[3DZAAP] Erro ao gerar PDF:', err);
    throw err;
  }
}

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('[PWA] Service Worker registered!', reg.scope))
      .catch(err => console.log('[PWA] SW registration failed:', err));
  });
}

// Affiliate Tracking
(function trackAffiliate() {
  const urlParams = new URLSearchParams(window.location.search);
  const ref = urlParams.get('ref');
  if (ref) {
    localStorage.setItem('affiliate_ref', ref);
    console.log('[3DZAAP] Affiliate ref saved:', ref);
  }
})();

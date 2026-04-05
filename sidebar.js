// ============================================================
// sidebar.js — 3DZAAP  v1.1
// Sidebar único partilhado por todas as páginas.
// Injeta HTML, preenche dados do utilizador e gere interacções.
//
// USO EM CADA PÁGINA:
//   1. Manter: <button class="mob-toggle" onclick="toggleSidebar()">☰</button>
//              <div class="sidebar-overlay" id="sideOverlay" onclick="toggleSidebar()"></div>
//   2. Adicionar antes de </body>:
//        <script src="utils.js"></script>
//        <script src="i18n.js"></script>
//        <script src="sidebar.js"></script>
//        <script>Sidebar.init();</script>
//
// DADOS DINÂMICOS:
//   Após Auth.getSession(), chamar: Sidebar.setSession(session)
// ============================================================

const Sidebar = (() => {

  // ── NAV ITEMS ─────────────────────────────────────────────
  const NAV = [
    {
      section: 'Principal', i18nKey: 'nav.principal',
      items: [
        { id: 'dashboard',   i18nKey: 'nav.home',       href: 'dashboard.html',  icon: '🏠', label: 'Início',       lockId: 'navLockDashboard' },
        { id: 'calculator',  i18nKey: 'nav.calculator', href: 'calculator.html', icon: '📐', label: 'Calculadora' },
        { id: 'orders',      i18nKey: 'nav.orders',     href: 'orders.html',     icon: '📦', label: 'Pedidos',      lockId: 'navLockOrders' },
        { id: 'financial',   i18nKey: 'nav.financial',  href: 'financial.html',  icon: '💰', label: 'Financeiro',   lockId: 'navLockFinancial' },
      ]
    },
    {
      section: 'Gestão', i18nKey: 'nav.gestao',
      items: [
        { id: 'materials',  i18nKey: 'nav.materials',  href: 'materials.html',  icon: '🎨', label: 'Materiais' },
        { id: 'printers',   i18nKey: 'nav.printers',   href: 'printers.html',   icon: '🖨️', label: 'Impressoras' },
        { id: 'backoffice', i18nKey: 'nav.backoffice', href: 'backoffice.html', icon: '🗄️', label: 'BackOffice',  lockId: 'navLockBackoffice' },
      ]
    },
    {
      section: 'Conta', i18nKey: 'nav.conta',
      items: [
        { id: 'settings', i18nKey: 'nav.settings', href: 'settings.html', icon: '⚙️', label: 'Definições', lockId: 'navLockSettings' },
        { id: 'admin',    i18nKey: 'nav.admin',           href: 'admin.html',    icon: '🛡️', label: 'Admin', superAdmin: true },
      ]
    },
  ];

  // ── DETECT ACTIVE PAGE ────────────────────────────────────
  function _activePage() {
    const file = window.location.pathname.split('/').pop().replace('.html','') || 'dashboard';
    return file;
  }

  // ── BUILD HTML ────────────────────────────────────────────
  function _buildHTML() {
    const active = _activePage();

    const navHTML = NAV.map(section => {
      const items = section.items.map(item => {
        const isActive = item.id === active;
        const lockSpan = item.lockId
          ? `<span class="nav-lock" id="${item.lockId}" style="display:none">—</span>`
          : '';
        const muteStyle   = item.muted       ? ' style="opacity:.6"' : '';
        const onclickAttr = item.onclick      ? ` onclick="${item.onclick}"` : '';
        const superAttr   = item.superAdmin   ? ' data-superadmin="1" style="display:none"' : '';
        const targetAttr  = item.external     ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `<a class="nav-item${isActive ? ' active' : ''}" href="${item.href}"${targetAttr}${onclickAttr}${muteStyle}${superAttr}><span class="nav-icon">${item.icon}</span> <span data-i18n="${item.i18nKey || `nav.${item.id}`}">${item.label}</span>${lockSpan}</a>`;
      }).join('\n        ');

      return `<div class="nav-section">
        <div class="nav-section-label" data-i18n="${section.i18nKey}">${section.section}</div>
        ${items}
      </div>`;
    }).join('\n      ');

    return `
<aside class="sidebar" id="sidebar">
  <div class="sidebar-logo">
    <a href="dashboard.html" class="brand-logo-wrap">
      <img src="logo.jpg" class="brand-nozzle squacircle" alt="3DZAAP">
      <div class="brand-text">
        <span class="b3d">3D</span><span class="bzp">ZAAP</span>
      </div>
    </a>
  </div>

  <div class="sidebar-company">
    <div class="company-pill" onclick="window.location.href='settings.html?tab=assinatura'" title="Gerir Plano" style="cursor:pointer">
      <div class="company-avatar" id="sidebarCompanyAvatar">—</div>
      <span class="company-name" id="sidebarCompanyName">—</span>
      <span class="company-plan" id="sidebarPlanBadge">—</span>
    </div>
  </div>

  <nav class="sidebar-nav">
    ${navHTML}
  </nav>

  <div class="sidebar-footer">
    <div class="user-dropdown" id="sidebarUserDropdown">
      <a class="dd-item" href="settings.html?tab=assinatura">💳 <span data-i18n="nav.manage_subscription">Gerir assinatura</span></a>
      <a class="dd-item" href="index.html">🌐 <span data-i18n="nav.go_to_lander">Ver landing page</span></a>
      <div class="dd-divider"></div>
      <a class="dd-item danger" onclick="Sidebar._doLogout();return false;">🚪 <span data-i18n="nav.logout">Sair</span></a>
    </div>
    <div class="user-row" id="sidebarUserRow" onclick="Sidebar._toggleUserMenu()">
      <div class="user-avatar" id="sidebarUserAvatar">—</div>
      <div class="user-info">
        <div class="user-name" id="sidebarUserName">—</div>
        <div class="user-email" id="sidebarUserEmail">—</div>
      </div>
      <span class="user-chevron" id="sidebarUserChevron">▲</span>
    </div>
  </div>
</aside>`;
  }

  // ── INJECT INTO DOM ───────────────────────────────────────
  function init() {
    const layout = document.querySelector('.layout');
    if (!layout) {
      console.warn('[Sidebar] .layout element not found.');
      return;
    }

    const existing = layout.querySelector('aside.sidebar');
    if (existing) existing.remove();

    layout.insertAdjacentHTML('afterbegin', _buildHTML());

    // Sync theme button icon (button is hardcoded in each page's topbar HTML)
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const btn = document.getElementById('topbarThemeToggle');
    if (btn) btn.innerHTML = isDark ? '☀️' : '🌙';

    // Bind global click to close user menu
    document.addEventListener('click', e => {
      if (!e.target.closest('#sidebarUserRow') && !e.target.closest('#sidebarUserDropdown')) {
        _closeUserMenu();
      }
    });

    if (window.i18n) window.i18n.translatePage();
  }

  // ── POPULATE WITH SESSION DATA ────────────────────────────
  function setSession(session) {
    if (!session) return;

    const fullName = (session.fname && session.lname)
      ? session.fname + ' ' + session.lname
      : session.fname || session.lname
      || session.email.split('@')[0].replace(/[._-]/g,' ').replace(/\b\w/g, c => c.toUpperCase());

    const initials        = fullName.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
    const companyName     = session.companyName || '—';
    const companyInitials = companyName.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '—';
    const planLabels      = { 
      trial: 'Trial', 
      starter: 'Starter', starter_ano: 'Starter (Ano)',
      pro: 'Pro',         pro_ano: 'Pro (Ano)',
      business: 'Business', business_ano: 'Business (Ano)' 
    };
    const plan            = session.plan || 'trial';

    _setText('sidebarUserName',    fullName);
    _setText('sidebarUserEmail',   session.email);
    _setText('sidebarUserAvatar',  initials);
    _setText('sidebarCompanyName', companyName);
    _setText('sidebarPlanBadge',   planLabels[plan] || 'Trial');

    const avatarEl = document.getElementById('sidebarCompanyAvatar');
    if (avatarEl) {
      const logoUrl = session.logo_url || session.config?.logoUrl || '';
      if (logoUrl) {
        avatarEl.innerHTML = `<img src="${logoUrl}" alt="${_esc(companyName)}" style="width:100%;height:100%;object-fit:cover;border-radius:22%">`;
      } else {
        avatarEl.textContent = companyInitials;
      }
    }

    _applyLocks(plan);

    document.querySelectorAll('[data-superadmin]').forEach(el => {
      el.style.display = session.isSuperAdmin ? '' : 'none';
    });
  }

  // ── FEATURE LOCKS ─────────────────────────────────────────
  const PLAN_FEATURES = {
    trial:        { dashboard:true,  calculator:true, materials:true, printers:true, orders:true,  financial:true,  backoffice:true,  settings:true  },
    starter:      { dashboard:false, calculator:true, materials:true, printers:true, orders:false, financial:false, backoffice:false, settings:false },
    starter_ano:  { dashboard:false, calculator:true, materials:true, printers:true, orders:false, financial:false, backoffice:false, settings:false },
    pro:          { dashboard:true,  calculator:true, materials:true, printers:true, orders:true,  financial:false, backoffice:true,  settings:false },
    pro_ano:      { dashboard:true,  calculator:true, materials:true, printers:true, orders:true,  financial:false, backoffice:true,  settings:false },
    business:     { dashboard:true,  calculator:true, materials:true, printers:true, orders:true,  financial:true,  backoffice:true,  settings:true  },
    business_ano: { dashboard:true,  calculator:true, materials:true, printers:true, orders:true,  financial:true,  backoffice:true,  settings:true  },
  };

  const PLAN_LIMITS = {
    trial:        { materials: null, printers: null },
    starter:      { materials: 10,   printers: 1    },
    starter_ano:  { materials: 10,   printers: 1    },
    pro:          { materials: null, printers: null },
    pro_ano:      { materials: null, printers: null },
    business:     { materials: null, printers: null },
    business_ano: { materials: null, printers: null },
  };

  const LOCK_LABELS = { orders:'Pro+', financial:'Business', backoffice:'Pro+', settings:'Pro+', dashboard:'Pro+' };

  function _applyLocks(plan) {
    const features = PLAN_FEATURES[plan] || PLAN_FEATURES.trial;
    Object.entries(features).forEach(([feature, allowed]) => {
      const lockId = `navLock${feature.charAt(0).toUpperCase() + feature.slice(1)}`;
      const el = document.getElementById(lockId);
      if (!el) return;
      el.textContent = LOCK_LABELS[feature] || '—';
      el.style.display = allowed ? 'none' : '';
    });
  }

  // ── THEME ─────────────────────────────────────────────────
  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('3dzaap_theme', next);
    document.querySelectorAll('#topbarThemeToggle').forEach(btn => {
      btn.innerHTML = next === 'dark' ? '☀️' : '🌙';
    });
  }

  // ── HELP POPOVER ──────────────────────────────────────────
  function _toggleHelp(e) {
    e.stopPropagation();
    const pop = document.getElementById('topbarHelpPopover');
    if (pop) pop.style.display = pop.style.display === 'none' ? 'block' : 'none';
  }

  // ── MOBILE SIDEBAR ────────────────────────────────────────
  function toggle() {
    document.getElementById('sidebar')?.classList.toggle('open');
    document.getElementById('sideOverlay')?.classList.toggle('open');
  }

  function close() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sideOverlay')?.classList.remove('open');
  }

  // ── USER MENU ─────────────────────────────────────────────
  function _toggleUserMenu() {
    const dd = document.getElementById('sidebarUserDropdown');
    const ch = document.getElementById('sidebarUserChevron');
    if (!dd) return;
    const open = dd.classList.toggle('open');
    ch?.classList.toggle('up', open);
  }

  function _closeUserMenu() {
    document.getElementById('sidebarUserDropdown')?.classList.remove('open');
    document.getElementById('sidebarUserChevron')?.classList.remove('up');
  }

  async function _doLogout() {
    _closeUserMenu();
    if (typeof showToast === 'function') showToast('Sessão terminada. Até logo! 👋', 'ok');
    setTimeout(() => Auth.logout(), 1000);
  }

  // ── HELPERS ───────────────────────────────────────────────
  function _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── PUBLIC API ────────────────────────────────────────────
  return { init, setSession, toggle, close, toggleTheme, _toggleHelp, _toggleUserMenu, _closeUserMenu, _doLogout, PLAN_FEATURES, PLAN_LIMITS };

})();

// Expose toggleSidebar globally for existing onclick="toggleSidebar()"
function toggleSidebar() { Sidebar.toggle(); }

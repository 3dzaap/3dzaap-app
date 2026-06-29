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
  let _sbBasePath = '';
  try {
    const cs = document.currentScript;
    if (cs && cs.src) _sbBasePath = cs.src.substring(0, cs.src.lastIndexOf('/') + 1);
  } catch (e) {}

  // ── NAV ITEMS ─────────────────────────────────────────────
  const NAV = [
    {
      section: 'Principal', i18nKey: 'nav.principal',
      items: [
        { id: 'dashboard',   i18nKey: 'nav.home',       href: 'dashboard.html',  icon: '<i class="ph-bold ph-house"></i>', label: 'Início',       lockId: 'navLockDashboard' },
        { id: 'calculator',  i18nKey: 'nav.calculator', href: 'calculator.html', icon: '<i class="ph-bold ph-calculator"></i>', label: 'Calculadora' },
        { id: 'orders',      i18nKey: 'nav.orders',     href: 'orders.html',     icon: '<i class="ph-bold ph-package"></i>', label: 'Pedidos',      lockId: 'navLockOrders' },
        { id: 'clients',     i18nKey: 'nav.clients',    href: 'clients.html',    icon: '<i class="ph-bold ph-users"></i>', label: 'Clientes',     lockId: 'navLockClients' },
        { id: 'financial',   i18nKey: 'nav.financial',  href: 'financial.html',  icon: '<i class="ph-bold ph-currency-dollar"></i>', label: 'Financeiro',   lockId: 'navLockFinancial' },
      ]
    },
    {
      section: 'Gestão', i18nKey: 'nav.gestao',
      items: [
        { id: 'products',   i18nKey: 'nav.products',   href: 'products.html',   icon: '<i class="ph-bold ph-folder"></i>', label: 'Produtos',     lockId: 'navLockProducts' },
        { id: 'materials',  i18nKey: 'nav.materials',  href: 'materials.html',  icon: '<i class="ph-bold ph-palette"></i>', label: 'Materiais' },
        { id: 'printers',   i18nKey: 'nav.printers',   href: 'printers.html',   icon: '<i class="ph-bold ph-printer"></i>', label: 'Impressoras' },
        { id: 'backoffice', i18nKey: 'nav.backoffice', href: 'backoffice.html', icon: '<i class="ph-bold ph-archive"></i>', label: 'BackOffice',  lockId: 'navLockBackoffice' },
        { id: 'tools', i18nKey: 'nav.tools', href: 'tools.html', icon: '<i class="ph-bold ph-wrench"></i>', label: 'Ferramentas', superAdmin: true },
        { id: 'wiki',  i18nKey: 'nav.wiki',  href: 'wiki.html',  icon: '<i class="ph-bold ph-book-bookmark"></i>', label: 'Wiki', superAdmin: true },
      ]
    },
    {
      section: 'Conta', i18nKey: 'nav.conta',
      items: [
        { id: 'settings', i18nKey: 'nav.settings_short', href: 'settings.html', icon: '<i class="ph-bold ph-gear"></i>', label: 'Definições', lockId: 'navLockSettings' },
        { id: 'admin',    i18nKey: 'nav.admin',           href: 'admin.html',    icon: '<i class="ph-bold ph-shield-check"></i>', label: 'Admin', superAdmin: true },
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
        const unreadBadge = item.id === 'orders' 
          ? `<span id="sidebarUnreadOrdersBadge" style="display:none;width:8px;height:8px;background:var(--danger);border-radius:50%;margin-left:8px;box-shadow:0 0 0 2px rgba(239,68,68,0.2)"></span>` 
          : item.id === 'admin'
            ? `<span id="sidebarUnreadAdminBadge" style="display:none;padding:2px 6px;font-size:0.65rem;font-weight:800;color:#ffffff;background:var(--success);border-radius:10px;margin-left:8px;box-shadow:0 0 0 2px rgba(34,197,94,0.2)"></span>`
            : '';
        return `<a class="nav-item${isActive ? ' active' : ''}" href="${item.href}"${targetAttr}${onclickAttr}${muteStyle}${superAttr}><span class="nav-icon">${item.icon}</span> <span data-i18n="${item.i18nKey || `nav.${item.id}`}">${item.label}</span>${unreadBadge}${lockSpan}</a>`;
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
      <img src="${_sbBasePath}logo.jpg" class="brand-nozzle squacircle" alt="3DZAAP">
      <div class="brand-text">
        <span class="b3d">3D</span><span class="bzp">ZAAP</span>
      </div>
    </a>
  </div>

  <div class="sidebar-company">
    <div class="company-pill" onclick="window.location.href='settings.html?tab=assinatura'" id="sidebarPlanTooltip" title="Gerir Plano" style="cursor:pointer">
      <div class="company-avatar" id="sidebarCompanyAvatar">—</div>
      <div class="company-info" style="flex-direction:row; align-items:center; justify-content:space-between; gap:4px;">
        <span class="company-name" id="sidebarCompanyName">—</span>
        <i id="sidebarPlanIcon" class="ph-bold ph-seal-check" style="color:var(--blue); font-size:1.15rem; flex-shrink:0;"></i>
        <span id="sidebarPlanBadge" style="display:none;">—</span>
      </div>
    </div>
  </div>

  <nav class="sidebar-nav">
    ${navHTML}
  </nav>

  <div class="sidebar-cta" id="sidebarTrialCTA" style="display:none; padding: 0 16px 14px; flex-shrink:0;">
    <button class="btn btn-orange" style="width:100%; justify-content:center; box-shadow:0 4px 14px rgba(245,148,58,.25);" onclick="window.location.href='settings.html?tab=assinatura'">
      <i class="ph-bold ph-star"></i> <span data-i18n="nav.upgrade_cta">Fazer Upgrade</span>
    </button>
  </div>

  <div class="sidebar-footer">
    <div class="user-dropdown" id="sidebarUserDropdown">
      <a class="dd-item" href="settings.html?tab=assinatura"><i class="ph-bold ph-credit-card"></i> <span data-i18n="nav.manage_subscription">Gerir assinatura</span></a>
      <a class="dd-item" href="index.html"><i class="ph-bold ph-globe"></i> <span data-i18n="nav.go_to_lander">Ver landing page</span></a>
      <div class="dd-divider"></div>
      <a class="dd-item danger" onclick="Sidebar._doLogout();return false;"><i class="ph-bold ph-door-open"></i> <span data-i18n="nav.logout">Sair</span></a>
    </div>
    <div class="user-row" id="sidebarUserRow" onclick="Sidebar._toggleUserMenu()">
      <div class="user-avatar" id="sidebarUserAvatar">—</div>
      <div class="user-info">
        <div class="user-name" id="sidebarUserName">—</div>
        <div class="user-email" id="sidebarUserEmail">—</div>
      </div>
      <span class="user-chevron" id="sidebarUserChevron"><i class="ph-bold ph-caret-up"></i></span>
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
    if (btn) btn.innerHTML = isDark ? '<i class="ph-bold ph-sun"></i>' : '<i class="ph-bold ph-moon"></i>';

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

    const translatedPlan = (window.i18n && typeof i18n.t === 'function') 
      ? i18n.t(`sidebar.plans.${plan}`) 
      : (planLabels[plan] || 'Trial');
    _setText('sidebarPlanBadge', translatedPlan);
    const tooltipEl = document.getElementById('sidebarPlanTooltip');
    if(tooltipEl) tooltipEl.title = `Plano: ${translatedPlan} (Clicar para gerir)`;

    const ctaEl = document.getElementById('sidebarTrialCTA');
    if(ctaEl) ctaEl.style.display = (plan === 'trial') ? 'block' : 'none';

    const planIconEl = document.getElementById('sidebarPlanIcon');
    if(planIconEl) {
      if (plan === 'trial') {
        planIconEl.className = 'ph-bold ph-seal';
        planIconEl.style.color = 'var(--muted)';
      } else {
        planIconEl.className = 'ph-bold ph-seal-check';
        planIconEl.style.color = 'var(--blue)'; // Indicador visual ativo/pago
      }
    }

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
    
    _checkUnreadNotifications(session);

    // ── IMPERSONATE BANNER ────────────────────────────────────
    const adminBackup = localStorage.getItem('3dzaap_admin_backup');
    if (adminBackup) {
      let banner = document.getElementById('impersonateBanner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'impersonateBanner';
        banner.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:var(--danger,#ef4444);color:white;text-align:center;padding:8px;font-size:0.85rem;font-weight:700;z-index:9999;display:flex;justify-content:center;align-items:center;gap:12px;box-shadow:0 2px 10px rgba(0,0,0,0.2)';
        document.body.appendChild(banner);
        
        const layout = document.querySelector('.layout');
        if (layout) layout.style.paddingTop = '36px'; // Empurra a UI para baixo
      }
      banner.innerHTML = `
        <span><i class="ph-bold ph-spy"></i> A atuar como <strong>${_esc(companyName)}</strong></span>
        <button onclick="Sidebar.exitImpersonate()" style="background:white;color:var(--danger,#ef4444);border:none;padding:4px 12px;border-radius:4px;font-weight:800;font-size:0.75rem;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.1)">Terminar Sessão</button>
      `;
    }
  }

  async function _checkUnreadNotifications(session) {
    try {
      if (typeof DB !== 'undefined' && DB.getUnreadOrdersCount) {
        const unreadCount = await DB.getUnreadOrdersCount();
        const badge = document.getElementById('sidebarUnreadOrdersBadge');
        if (badge) badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';

        // Atualizar App Icon Badge (Notificação vermelha no ícone da app no telemóvel/desktop)
        if ('setAppBadge' in navigator) {
          if (unreadCount > 0) {
            navigator.setAppBadge(unreadCount).catch(e => console.warn('[PWA] setAppBadge error:', e));
          } else if ('clearAppBadge' in navigator) {
            navigator.clearAppBadge().catch(e => console.warn('[PWA] clearAppBadge error:', e));
          }
        }
      }

      if (session && session.isSuperAdmin) {
        const lastViewStr = localStorage.getItem('3dzaap_last_admin_view');
        // Default to last 7 days to avoid showing a massive initial count on first load
        const lastView = lastViewStr ? new Date(lastViewStr) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        if (typeof _sb !== 'undefined' && _sb) {
          const { count, error } = await _sb
            .from('companies')
            .select('*', { count: 'exact', head: true })
            .gt('created_at', lastView.toISOString());

          const adminBadge = document.getElementById('sidebarUnreadAdminBadge');
          if (adminBadge) {
            if (!error && count > 0) {
              adminBadge.textContent = count;
              adminBadge.style.display = 'inline-block';
            } else {
              adminBadge.style.display = 'none';
            }
          }
        }
      }
    } catch (e) {
      console.warn('[3DZAAP] Erro ao verificar notificações de admin:', e);
    }
  }

  // ── FEATURE LOCKS ─────────────────────────────────────────
  const PLAN_FEATURES = {
    trial:        { dashboard:true,  calculator:true, materials:true, printers:true, orders:true,  clients:true, products:true, financial:true,  backoffice:true,  settings:true  },
    starter:      { dashboard:false, calculator:true, materials:true, printers:true, orders:false, clients:false, products:false, financial:false, backoffice:false, settings:false },
    starter_ano:  { dashboard:false, calculator:true, materials:true, printers:true, orders:false, clients:false, products:false, financial:false, backoffice:false, settings:false },
    pro:          { dashboard:true,  calculator:true, materials:true, printers:true, orders:true,  clients:true, products:true, financial:true,  backoffice:true,  settings:false },
    pro_ano:      { dashboard:true,  calculator:true, materials:true, printers:true, orders:true,  clients:true, products:true, financial:true,  backoffice:true,  settings:false },
    business:     { dashboard:true,  calculator:true, materials:true, printers:true, orders:true,  clients:true, products:true, financial:true,  backoffice:true,  settings:true  },
    business_ano: { dashboard:true,  calculator:true, materials:true, printers:true, orders:true,  clients:true, products:true, financial:true,  backoffice:true,  settings:true  },
  };

  const PLAN_LIMITS = {
    trial:        { materials: 10,   printers: 1    },
    starter:      { materials: 10,   printers: 1    },
    starter_ano:  { materials: 10,   printers: 1    },
    pro:          { materials: null, printers: null },
    pro_ano:      { materials: null, printers: null },
    business:     { materials: null, printers: null },
    business_ano: { materials: null, printers: null },
  };

  const LOCK_LABELS = { orders:'Pro+', clients:'Pro+', products:'Pro+', financial:'Business', backoffice:'Pro+', settings:'Pro+', dashboard:'Pro+' };

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
    try { localStorage.setItem('3dzaap_theme', next); } catch (e) {}
    document.querySelectorAll('#topbarThemeToggle').forEach(btn => {
      btn.innerHTML = next === 'dark' ? '<i class="ph-bold ph-sun"></i>' : '<i class="ph-bold ph-moon"></i>';
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
    if (typeof showToast === 'function') showToast('Sessão terminada. Até logo!', 'ok');
    setTimeout(() => Auth.logout(), 1000);
  }

  // ── EXIT IMPERSONATE ──────────────────────────────────────
  async function exitImpersonate() {
    const backupStr = localStorage.getItem('3dzaap_admin_backup');
    if (!backupStr) return;
    
    // Mostra um toast rápido se a função showToast existir
    if (typeof showToast === 'function') {
      showToast('<i class="ph-bold ph-arrows-left-right"></i> A restaurar sessão de Admin...', '');
    }

    try {
      const backupSession = JSON.parse(backupStr);
      localStorage.removeItem('3dzaap_admin_backup');
      
      if (typeof _sb !== 'undefined') {
         await _sb.auth.signOut();
         await _sb.auth.setSession(backupSession);
      }
      
      window.location.href = 'admin.html';
    } catch(e) {
      console.error('Erro ao sair do impersonate', e);
      window.location.href = 'auth.html';
    }
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
  return { init, setSession, toggle, close, toggleTheme, _toggleHelp, _toggleUserMenu, _closeUserMenu, _doLogout, exitImpersonate, PLAN_FEATURES, PLAN_LIMITS, updateBadges: _checkUnreadNotifications };

})();

// Expose toggleSidebar globally for existing onclick="toggleSidebar()"
function toggleSidebar() { Sidebar.toggle(); }

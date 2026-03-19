// 3DZAAP - AppSidebar Web Component
// Uso: <app-sidebar active="financial"></app-sidebar>
//
// Injeta sidebar HTML no light DOM da página.
// Compatível com todo o JS/CSS existente nas páginas.
// Requer: supabase.js carregado antes deste ficheiro.

(function () {

  // ── Nav items definition ────────────────────────────────
  const NAV = [
    { section: 'Principal' },
    { href: 'dashboard.html',  icon: '🏠', label: 'Início'         },
    { href: 'calculator.html', icon: '📐', label: 'Calculadora'     },
    { section: 'Gestão' },
    { href: 'filaments.html',  icon: '🎨', label: 'Materiais'       },
    { href: 'orders.html',     icon: '📦', label: 'Pedidos',     lockId: 'ordersLock',    lock: 'Pro+'     },
    { href: 'financial.html',  icon: '💰', label: 'Financeiro',  lockId: 'financialLock', lock: 'Business' },
    { href: 'backoffice.html', icon: '🗄️', label: 'BackOffice'      },
    { section: 'Conta' },
    { href: 'settings.html',   icon: '⚙️', label: 'Configurações'   },
    { href: '#',               icon: '💳', label: 'Assinatura', action: 'billing' },
  ];

  // ── Build nav HTML ──────────────────────────────────────
  function buildNav(active) {
    let html = '';
    let inSection = false;
    for (const item of NAV) {
      if (item.section) {
        if (inSection) html += '</div>';
        html += `<div class="nav-section"><div class="nav-section-label">${item.section}</div>`;
        inSection = true;
      } else {
        const isActive = item.href === active + '.html' || item.href === active;
        const lockHtml = item.lockId
          ? `<span class="nav-lock" id="${item.lockId}" style="display:none">${item.lock}</span>`
          : '';
        const extra = item.action ? ` data-action="${item.action}"` : '';
        html += `<a class="nav-item${isActive ? ' active' : ''}" href="${item.href}"${extra}>`
              + `<span class="nav-icon">${item.icon}</span> ${item.label}${lockHtml}</a>`;
      }
    }
    if (inSection) html += '</div>';
    return html;
  }

  // ── Build full sidebar HTML ─────────────────────────────
  function buildHTML(active) {
    return `
<button class="mob-toggle" id="mobToggle">☰</button>
<div class="sidebar-overlay" id="sideOverlay"></div>
<aside class="sidebar" id="sidebar">
  <div class="sidebar-logo">
    <img src="https://customer-assets.emergentagent.com/job_spool-tracker-3/artifacts/5c5xc7cz_LogoFundoBranco.png"
         alt="3DZAAP" onerror="this.style.display='none'">
    <div class="sidebar-logo-text">Print Manager</div>
  </div>
  <div class="sidebar-company">
    <div class="company-pill">
      <div class="company-avatar" id="companyAvatar">—</div>
      <span class="company-name" id="companyName">—</span>
      <span class="company-plan" id="planBadge">—</span>
    </div>
  </div>
  <nav class="sidebar-nav">${buildNav(active)}</nav>
  <div class="sidebar-footer">
    <div class="user-dropdown" id="userDropdown">
      <a class="dd-item" href="settings.html">⚙️ Configurações</a>
      <div class="dd-divider"></div>
      <a class="dd-item danger" id="ddLogout">🚪 Sair</a>
    </div>
    <div class="user-row" id="userRow">
      <div class="user-avatar" id="userAvatar">—</div>
      <div class="user-info">
        <div class="user-name" id="userName">—</div>
        <div class="user-email" id="userEmail">—</div>
      </div>
      <span class="user-chevron" id="userChevron">▲</span>
    </div>
  </div>
</aside>`;
  }

  // ── Web Component ────────────────────────────────────────
  class AppSidebar extends HTMLElement {
    connectedCallback() {
      const active = this.getAttribute('active') || '';

      // Inject HTML before this element in the light DOM
      const frag = document.createRange().createContextualFragment(buildHTML(active));
      this.parentNode.insertBefore(frag, this);
      this.style.display = 'none'; // placeholder hidden

      this._wireEvents();
    }

    _wireEvents() {
      // Mobile toggle
      document.getElementById('mobToggle')?.addEventListener('click', () => this._toggleSidebar());
      document.getElementById('sideOverlay')?.addEventListener('click', () => this._closeSidebar());

      // User dropdown
      document.getElementById('userRow')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this._toggleMenu();
      });

      // Logout
      document.getElementById('ddLogout')?.addEventListener('click', () => this._logout());

      // Billing toast
      document.querySelectorAll('[data-action="billing"]').forEach(el => {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          if (typeof showToast === 'function') showToast('Assinatura — em breve', '');
        });
      });

      // Close menu on outside click
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#userRow') && !e.target.closest('#userDropdown')) {
          this._closeMenu();
        }
      });
    }

    _toggleSidebar() {
      document.getElementById('sidebar')?.classList.toggle('open');
      document.getElementById('sideOverlay')?.classList.toggle('open');
    }

    _closeSidebar() {
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sideOverlay')?.classList.remove('open');
    }

    _toggleMenu() {
      const dd = document.getElementById('userDropdown');
      const ch = document.getElementById('userChevron');
      const open = dd?.classList.toggle('open');
      ch?.classList.toggle('up', open);
    }

    _closeMenu() {
      document.getElementById('userDropdown')?.classList.remove('open');
      document.getElementById('userChevron')?.classList.remove('up');
    }

    async _logout() {
      this._closeMenu();
      if (typeof showToast === 'function') showToast('Sessão terminada. Até logo! 👋', 'ok');
      setTimeout(() => { if (typeof Auth !== 'undefined') Auth.logout(); }, 1000);
    }
  }

  if (!customElements.get('app-sidebar')) {
    customElements.define('app-sidebar', AppSidebar);
  }

})();

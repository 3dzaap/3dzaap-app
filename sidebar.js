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

      // Inject CSS if not already present (makes component self-contained)
      if (!document.getElementById('_app-sidebar-css')) {
        const st = document.createElement('style');
        st.id = '_app-sidebar-css';
        st.textContent = `.sidebar{ width:var(--sidebar-w);flex-shrink:0; background:#e8f1fb; border-right:1.5px solid var(--border); display:flex;flex-direction:column; position:fixed;top:0;left:0;height:100vh;z-index:250; transition:left .3s var(--ease); }
.sidebar-logo{ padding:20px 22px 16px; border-bottom:1.5px solid var(--border); display:flex;align-items:center;gap:12px; }
.sidebar-logo img{height:36px;width:auto;object-fit:contain}
.sidebar-logo-text{font-size:.78rem;font-weight:700;color:var(--muted);letter-spacing:.04em;text-transform:uppercase}
.sidebar-company{ padding:14px 18px; border-bottom:1.5px solid var(--border); }
.company-pill{ display:flex;align-items:center;gap:9px; background:var(--blue-g);border:1.5px solid rgba(59,143,212,.22); border-radius:40px;padding:7px 14px;cursor:pointer; transition:background .2s,border-color .2s; }
.company-pill:hover{background:rgba(59,143,212,.15);border-color:rgba(59,143,212,.35)}
.company-avatar{ width:28px;height:28px;border-radius:50%; background:linear-gradient(135deg,var(--blue),var(--blue-d)); display:flex;align-items:center;justify-content:center; font-size:.72rem;font-weight:800;color:#fff;flex-shrink:0; }
.company-name{font-size:.84rem;font-weight:700;color:var(--dark);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.company-plan{font-size:.68rem;font-weight:700;color:var(--blue);background:rgba(59,143,212,.12);border:1px solid rgba(59,143,212,.25);border-radius:20px;padding:2px 8px;white-space:nowrap}
.sidebar-nav{flex:1;padding:14px 12px;overflow-y:auto}
.nav-section{margin-bottom:6px}
.nav-section-label{font-size:.66rem;font-weight:800;color:var(--subtle);letter-spacing:.1em;text-transform:uppercase;padding:6px 10px 4px}
.nav-item{ display:flex;align-items:center;gap:11px; padding:9px 12px;border-radius:var(--r); cursor:pointer;transition:background .18s,color .18s; text-decoration:none;color:var(--muted);font-size:.875rem;font-weight:500; position:relative; }
.nav-item:hover{background:rgba(59,143,212,.09);color:var(--dark)}
.nav-item.active{ background:linear-gradient(135deg,rgba(59,143,212,.18),rgba(59,143,212,.08)); color:var(--blue);font-weight:700; border:1px solid rgba(59,143,212,.25); }
.nav-item.active::before{ content:'';position:absolute;left:-12px;top:50%;transform:translateY(-50%); width:3px;height:22px;background:var(--blue);border-radius:0 3px 3px 0; }
.nav-icon{font-size:1.1rem;width:22px;text-align:center;flex-shrink:0}
.nav-lock{ margin-left:auto;font-size:.65rem;font-weight:700; background:rgba(148,163,184,.15);color:var(--subtle); border:1px solid rgba(148,163,184,.25);border-radius:20px;padding:2px 7px; white-space:nowrap; }
.nav-lock.plan-badge{background:rgba(245,148,58,.12);color:var(--orange);border-color:rgba(245,148,58,.3)}
.sidebar-footer{ padding:10px 12px; border-top:1.5px solid var(--border); position:relative; overflow:visible; }
.user-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--r);cursor:pointer;transition:background .18s;user-select:none}
.user-row:hover{background:rgba(59,143,212,.07)}
.user-avatar{ width:32px;height:32px;border-radius:50%; background:linear-gradient(135deg,var(--orange),var(--orange-d)); display:flex;align-items:center;justify-content:center; font-size:.76rem;font-weight:800;color:#fff;flex-shrink:0; }
.user-info{flex:1;min-width:0}
.user-name{font-size:.82rem;font-weight:700;color:var(--dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.user-email{font-size:.70rem;color:var(--subtle);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.user-chevron{font-size:.65rem;color:var(--subtle);transition:transform .22s var(--ease);flex-shrink:0}
.user-chevron.up{transform:rotate(180deg)}
.user-dropdown{ position:absolute;bottom:calc(100% + 4px);left:12px;right:12px; background:var(--glass-s);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur); border:1.5px solid var(--border);border-radius:var(--rm); box-shadow:var(--sh-lg);z-index:200;overflow:hidden; opacity:0;transform:translateY(6px);pointer-events:none; transition:opacity .22s var(--ease),transform .22s var(--ease); }
.user-dropdown.open{opacity:1;transform:none;pointer-events:auto}
.dd-item{ display:flex;align-items:center;gap:10px;padding:10px 14px; cursor:pointer;transition:background .15s;font-size:.84rem;font-weight:500;color:var(--muted); text-decoration:none; }
.dd-item:first-child{border-radius:var(--rm) var(--rm) 0 0}
.dd-item:last-child{border-radius:0 0 var(--rm) var(--rm)}
.dd-item:hover{background:rgba(59,143,212,.08);color:var(--dark)}
.dd-item.danger{color:var(--danger)}
.dd-item.danger:hover{background:rgba(239,68,68,.08);color:var(--danger)}
.dd-divider{height:1px;background:var(--border);margin:4px 0}
.mob-toggle{ display:none;position:fixed;top:14px;left:14px;z-index:200; width:38px;height:38px;border-radius:var(--r); background:rgba(255,255,255,.8);backdrop-filter:var(--blur-sm); border:1.5px solid var(--border);box-shadow:var(--sh); cursor:pointer;align-items:center;justify-content:center;font-size:1.1rem; }
.sidebar-overlay{display:none;position:fixed;inset:0;z-index:90;background:rgba(13,17,23,.35);transform:translateY(14px)}
.sidebar{left:calc(-1 * var(--sidebar-w, 260px))}
.sidebar-overlay.open{display:block}
.mob-toggle{display:flex}
.nav-item, .btn, .btn-icon, .stepper-btn, .tab, .mat-btn, .modal-mat-btn, .plan-card, .user-row, .dd-item, .color-preset, .home-card, .action-card, .stat-card { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.sidebar-nav, .sidebar, .modal, .page { -webkit-overflow-scrolling: touch; }
.sidebar{ transform: none !important; left: calc(-1 * var(--sidebar-w, 260px)); transition: left .3s cubic-bezier(0.22,1,0.36,1); /* Solid background no mobile — evita o bug backdrop-filter+transform */ background: #e8f1fb !important; }
.sidebar-overlay{ }
.sidebar{ z-index: 300 !important; }
.sidebar-overlay{ z-index: 280 !important; }
@media(max-width:680px){
  .mob-toggle{display:flex}
  .sidebar{left:calc(-1 * var(--sidebar-w));z-index:300;background:#e8f1fb !important}
  .sidebar.open{left:0}
  .sidebar-overlay.open{left:var(--sidebar-w)}
}`;
        document.head.appendChild(st);
      }

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

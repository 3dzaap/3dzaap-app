/**
 * admin-sidebar.js — Sidebar exclusivo do Portal Admin 3DZAAP
 * Injeta o sidebar no .adm-layout e gere navegação e logout.
 */

const AdminSidebar = (() => {

  const NAV = [
    { section: 'Visão Geral', items: [
      { id: 'index',         label: 'Dashboard',      icon: 'ph-squares-four',    href: 'index.html' },
    ]},
    { section: 'Gestão', items: [
      { id: 'clientes',      label: 'Clientes',        icon: 'ph-buildings',       href: 'clientes.html' },
      { id: 'utilizadores',  label: 'Utilizadores',    icon: 'ph-users',           href: 'utilizadores.html' },
      { id: 'acordos',       label: 'Acordos',         icon: 'ph-handshake',       href: 'acordos.html' },
    ]},
    { section: 'Análise', items: [
      { id: 'metricas',      label: 'Métricas',        icon: 'ph-chart-line-up',   href: 'metricas.html' },
    ]},
    { section: 'Sistema', items: [
      { id: 'ferramentas',   label: 'Ferramentas',     icon: 'ph-wrench',          href: 'ferramentas.html' },
      { id: 'auditoria',     label: 'Auditoria',       icon: 'ph-eye',             href: 'auditoria.html' },
    ]},
  ];

  function _activePage() {
    return window.location.pathname.split('/').pop().replace('.html', '') || 'index';
  }

  function _buildHTML(email) {
    const active = _activePage();
    const initials = email ? email.slice(0, 2).toUpperCase() : 'AD';

    const navHTML = NAV.map(section => {
      const items = section.items.map(item => {
        const isActive = item.id === active;
        return `<a class="adm-nav-item${isActive ? ' active' : ''}" href="${item.href}" id="admNav_${item.id}">
          <span class="adm-nav-icon"><i class="ph-bold ${item.icon}"></i></span>
          <span>${item.label}</span>
        </a>`;
      }).join('');
      return `<div class="adm-nav-label">${section.section}</div>${items}`;
    }).join('');

    return `
<div class="adm-mob-overlay" id="admSideOverlay" onclick="AdminSidebar.close()"></div>
<aside class="adm-sidebar" id="admSidebar">
  <a class="adm-brand" href="index.html">
    <img src="../logo.jpg" class="adm-brand-img" alt="3DZAAP">
    <div class="adm-brand-text">
      <span class="adm-b3d">3D</span><span class="adm-bzp">ZAAP</span>
    </div>
    <span class="adm-badge">Admin</span>
  </a>

  <nav class="adm-nav">
    ${navHTML}
  </nav>

  <div class="adm-sidebar-footer">
    <div class="adm-user-row">
      <div class="adm-user-avatar" id="admUserAvatar">${initials}</div>
      <div class="adm-user-info">
        <div class="adm-user-role">Super Admin</div>
        <div class="adm-user-email" id="admUserEmail">${email || '—'}</div>
      </div>
    </div>
    <button class="adm-logout-btn" onclick="AdminSidebar.logout()">
      <i class="ph-bold ph-door-open"></i> Terminar Sessão
    </button>
  </div>
</aside>`;
  }

  let _email = '';

  function init() {
    const layout = document.querySelector('.adm-layout');
    if (!layout) { console.warn('[AdminSidebar] .adm-layout not found'); return; }
    layout.insertAdjacentHTML('afterbegin', _buildHTML(_email));
  }

  function setAdminEmail(email) {
    _email = email || '';
    const el = document.getElementById('admUserEmail');
    if (el) el.textContent = _email;
    const av = document.getElementById('admUserAvatar');
    if (av) av.textContent = _email ? _email.slice(0, 2).toUpperCase() : 'AD';
  }

  function toggle() {
    document.getElementById('admSidebar')?.classList.toggle('open');
    document.getElementById('admSideOverlay')?.classList.toggle('open');
  }

  function close() {
    document.getElementById('admSidebar')?.classList.remove('open');
    document.getElementById('admSideOverlay')?.classList.remove('open');
  }

  async function logout() {
    try {
      if (typeof _sb !== 'undefined') await _sb.auth.signOut();
    } catch(e) {}
    window.location.href = 'login.html';
  }

  return { init, setAdminEmail, toggle, close, logout };
})();

// Global hook for mobile toggle button
function toggleAdminSidebar() { AdminSidebar.toggle(); }

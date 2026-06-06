// push.js — 3D Print Flow PWA Push Notifications Manager
// Handles: permission request, subscription, unsubscription, and storage in Supabase.

const PushManager3D = (() => {

  // VAPID public key (must match the one configured in Supabase Secrets)
  const VAPID_PUBLIC_KEY = 'BLTPfTSFiiLAr6dQF8nUlemZnateyrC9Za0g9LzGif_4OdxCmF35iAhR78c7Zz2S5vrF_CCwIhMa8Dcnv-FqpN4';

  function _urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }

  // ── Check if Push is supported ────────────────────────────────────────────
  function isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  // ── Get current permission status ─────────────────────────────────────────
  function getPermissionStatus() {
    if (!isSupported()) return 'unsupported';
    return Notification.permission; // 'default' | 'granted' | 'denied'
  }

  // ── Get the active SW registration ────────────────────────────────────────
  async function _getSWRegistration() {
    const regs = await navigator.serviceWorker.getRegistrations();
    return regs.find(r => r.active) || await navigator.serviceWorker.ready;
  }

  // ── Subscribe ─────────────────────────────────────────────────────────────
  async function subscribe() {
    if (!isSupported()) throw new Error('Push notifications não suportadas neste browser.');

    // 1. Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Permissão negada pelo utilizador.');
    }

    // 2. Get SW and subscribe
    const reg = await _getSWRegistration();
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: _urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    // 3. Extract keys
    const { endpoint } = subscription;
    const p256dh = btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh'))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const auth = btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth'))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    // 4. Save to Supabase
    if (typeof _sb === 'undefined') throw new Error('Supabase não inicializado.');

    const { data: { session } } = await _sb.auth.getSession();
    if (!session) throw new Error('Sessão não encontrada.');

    const companyId = await _getCompanyId();

    // Upsert by endpoint (in case of re-subscription)
    const { error } = await _sb.from('push_subscriptions').upsert(
      { user_id: session.user.id, company_id: companyId, endpoint, p256dh, auth },
      { onConflict: 'endpoint' }
    );
    if (error) throw error;

    console.log('[Push] Subscribed and saved to Supabase.');
    return subscription;
  }

  // ── Unsubscribe ───────────────────────────────────────────────────────────
  async function unsubscribe() {
    if (!isSupported()) return;

    const reg = await _getSWRegistration();
    const subscription = await reg.pushManager.getSubscription();
    if (!subscription) return;

    // Remove from Supabase first
    if (typeof _sb !== 'undefined') {
      await _sb.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    }

    // Unsubscribe from browser
    await subscription.unsubscribe();

    // Clear badge
    if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(() => {});

    console.log('[Push] Unsubscribed.');
  }

  // ── Check if currently subscribed ─────────────────────────────────────────
  async function isSubscribed() {
    if (!isSupported() || Notification.permission !== 'granted') return false;
    try {
      const reg = await _getSWRegistration();
      const sub = await reg.pushManager.getSubscription();
      return !!sub;
    } catch {
      return false;
    }
  }

  // ── Send a test notification (local, no server needed) ────────────────────
  async function sendTestNotification() {
    const reg = await _getSWRegistration();
    await reg.showNotification('🔔 3D Print Flow', {
      body: 'As notificações estão a funcionar! Vai receber alertas de pedidos e da saúde do negócio.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'test-notification',
      vibrate: [200, 100, 200],
    });
  }

  // ── Helper: get company ID from supabase.js ────────────────────────────────
  async function _getCompanyId() {
    // Try to get from Auth session via supabase.js exposed pattern
    if (typeof Auth !== 'undefined' && Auth.getSession) {
      const session = await Auth.getSession();
      if (session?.companyId) return session.companyId;
    }
    throw new Error('Company ID não encontrado.');
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return { isSupported, getPermissionStatus, subscribe, unsubscribe, isSubscribed, sendTestNotification };

})();

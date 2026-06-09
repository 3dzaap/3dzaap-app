// supabase/functions/send-push/index.ts
// Motor central de envio de Web Push Notifications (VAPID).
// Recebe: { companyId, title, body, url, tag, badge? }
// Busca todos os dispositivos inscritos da empresa e envia a notificação.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:suporte@3dzaap.com.br';

webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

async function sendPushToSubscription(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string
): Promise<void> {
  const pushSubscription = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.p256dh,
      auth: sub.auth
    }
  };

  try {
    await webpush.sendNotification(pushSubscription, payload);
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
}

// ── Main handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  }

  try {
    let payloadData = await req.json();

    // Check if this is a Supabase Webhook payload
    if (payloadData.type === 'UPDATE' && payloadData.record) {
      const order = payloadData.record;
      const oldOrder = payloadData.old_record || {};
      
      const unreadChangedToTrue = (oldOrder.has_unread_client_update !== true && order.has_unread_client_update === true);
      
      const newStatus = order.status;
      const oldStatus = oldOrder.status;
      const statusChanged = (oldStatus !== newStatus);
      const isSignificantStatus = ['modelagem', 'aprovado', 'rejeitado', 'declined'].includes(newStatus);
      
      const significantStatusChange = (statusChanged && isSignificantStatus);

      // If nothing relevant changed, abort
      if (!unreadChangedToTrue && !significantStatusChange) {
        return new Response(JSON.stringify({ message: 'No notification needed (condition not met)' }), { status: 200 });
      }

      const isApproved = ['aprovado', 'modelagem'].includes(newStatus);
      const isDeclined = ['rejeitado', 'declined'].includes(newStatus);

      const formattedNum = order.order_numeric ? 'IMP-' + String(order.order_numeric).padStart(4, '0') : '';
      const orderStr = formattedNum ? `${formattedNum} ` : '';
      const orderStrNoSpace = formattedNum ? formattedNum : '';

      let actBody = `O pedido ${orderStr}de ${order.client_name || 'um cliente'} foi atualizado.`;
      if (significantStatusChange && isApproved) actBody = `O cliente ${order.client_name || ''} APROVOU o orçamento ${orderStrNoSpace}! 🎉`;
      if (significantStatusChange && isDeclined) actBody = `O cliente ${order.client_name || ''} REJEITOU o orçamento ${orderStrNoSpace}.`;

      payloadData = {
        companyId: order.company_id,
        title: (significantStatusChange && isApproved) ? 'Orçamento Aprovado!' : 'Atualização do Cliente',
        body: actBody,
        url: `/orders.html?highlight=${order.id}`,
        tag: `order-${order.id}`
      };
    }

    const { companyId, title, body, url = '/orders.html', tag = 'default', badge = 1 } = payloadData;

    if (!companyId || !title || !body) {
      return new Response(JSON.stringify({ error: 'Missing required fields: companyId, title, body' }), { status: 400 });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch all subscriptions for this company
    const { data: subs, error } = await sb
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('company_id', companyId);

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions found' }), { status: 200 });
    }

    const payload = JSON.stringify({ title, body, url, tag, badge });

    const results = await Promise.allSettled(
      subs.map(sub => sendPushToSubscription(sub, payload))
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`[send-push] Sent: ${sent}, Failed: ${failed} for company ${companyId}`);

    return new Response(JSON.stringify({ sent, failed }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) {
    console.error('[send-push] Error:', e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});

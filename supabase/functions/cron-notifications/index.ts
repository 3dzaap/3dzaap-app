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

async function sendPushToSubscription(sub: any, payload: string) {
  try {
    await webpush.sendNotification({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth }
    }, payload);
  } catch (e) {
    console.error('Push error:', e);
  }
}

function getFormattedDate(d: Date) {
  return d.toISOString().split('T')[0];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });

  // Optional: Add simple security token check
  const authHeader = req.headers.get('Authorization') || '';
  if (authHeader !== `Bearer ${SUPABASE_SERVICE_KEY}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  try {
    const { data: companies, error: compErr } = await sb.from('companies').select('id, name, config');
    if (compErr) throw compErr;

    const today = new Date();
    const todayStr = getFormattedDate(today);
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = getFormattedDate(tomorrow);
    
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoStr = threeDaysAgo.toISOString();

    const isFriday = today.getDay() === 5;
    
    let totalSent = 0;

    for (const company of companies || []) {
      const config = company.config || {};
      const companyId = company.id;

      const { data: subs } = await sb.from('push_subscriptions').select('endpoint, p256dh, auth').eq('company_id', companyId);
      if (!subs || subs.length === 0) continue;

      const pushQueue: { title: string, body: string, url: string, tag: string }[] = [];

      // A. Pedidos Atrasados / Prazos
      if (config.notifOverdue !== false) {
        const { data: orders } = await sb.from('orders')
          .select('id, order_numeric, delivery_date')
          .eq('company_id', companyId)
          .in('status', ['aprovado', 'fila', 'printing']);

        const overdue = orders?.filter(o => o.delivery_date && o.delivery_date < todayStr).length || 0;
        const dueToday = orders?.filter(o => o.delivery_date === todayStr).length || 0;

        if (overdue > 0 || dueToday > 0) {
          pushQueue.push({
            title: 'Atenção aos Prazos!',
            body: `Tem ${overdue} pedido(s) em atraso e ${dueToday} para entregar hoje. Não deixe o seu Health Score cair!`,
            url: '/orders.html',
            tag: 'overdue-alert'
          });
        }
      }

      // B. Estoque Crítico
      if (config.notifStockLow !== false) {
        const { data: filaments } = await sb.from('filaments')
          .select('id, name, remaining_weight_g, alerta_g')
          .eq('company_id', companyId)
          .gt('total', 0); // Ignore empty historical entries

        const critical = filaments?.filter(f => {
           const limit = f.alerta_g || 150;
           return (f.remaining_weight_g || 0) <= limit;
        }) || [];

        if (critical.length > 0) {
          pushQueue.push({
            title: 'Estoque de Filamento Crítico',
            body: `${critical.length} filamento(s) estão prestes a acabar. Reponha o estoque para evitar paragens na produção.`,
            url: '/inventory.html',
            tag: 'stock-alert'
          });
        }
      }

      // C. Lembrete de Follow-up
      if (config.notifFollowUp !== false) {
        const { data: followUps } = await sb.from('orders')
          .select('id')
          .eq('company_id', companyId)
          .eq('status', 'orcamento')
          .lt('created_at', threeDaysAgoStr);

        if (followUps && followUps.length > 0) {
          pushQueue.push({
            title: 'Orçamentos Pendentes',
            body: `Tem ${followUps.length} orçamento(s) enviado(s) há mais de 3 dias sem resposta. Faça um follow-up para fechar a venda!`,
            url: '/orders.html?status=orcamento',
            tag: 'followup-alert'
          });
        }
      }

      // D. Resumo Semanal (Sexta-feira)
      if (isFriday && config.notifWeeklyRev !== false) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const { data: revOrders } = await sb.from('orders')
          .select('total_price')
          .eq('company_id', companyId)
          .in('status', ['aprovado', 'fila', 'printing', 'enviado', 'done', 'pago'])
          .gte('updated_at', sevenDaysAgo.toISOString());

        if (revOrders && revOrders.length > 0) {
          const total = revOrders.reduce((acc, curr) => acc + (curr.total_price || 0), 0);
          const currency = config.currency === 'BRL' ? 'R$' : '€';
          pushQueue.push({
            title: 'Fecho da Semana 💸',
            body: `Que semana! Validou ${revOrders.length} pedido(s) gerando um total de ${currency}${total.toFixed(2)}. Bom fim de semana!`,
            url: '/dashboard.html',
            tag: 'weekly-rev'
          });
        }
      }

      for (const msg of pushQueue) {
        const payloadStr = JSON.stringify({ ...msg, badge: 1 });
        await Promise.all(subs.map(sub => sendPushToSubscription(sub, payloadStr)));
        totalSent++;
      }
    }

    return new Response(JSON.stringify({ success: true, sent: totalSent }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('Cron Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});

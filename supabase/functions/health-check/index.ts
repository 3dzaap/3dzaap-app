// supabase/functions/health-check/index.ts
// Cron-driven health check that sends push notifications to companies
// with urgent business alerts: low stock, late orders, pending payments.
// Called daily at 08:00 UTC (daily) and 09:00 UTC on Mondays (weekly).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ── Helpers ─────────────────────────────────────────────────────────────────

async function callSendPush(companyId: string, title: string, body: string, url: string, tag: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ companyId, title, body, url, tag })
    });
    if (!res.ok) {
      const t = await res.text();
      console.warn(`[health-check] send-push failed for ${companyId}:`, t);
    }
  } catch (e) {
    console.warn(`[health-check] Error calling send-push for ${companyId}:`, e.message);
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  }

  try {
    const body = req.method === 'POST' ? await req.json() : {};
    const checkType = body.type || 'daily'; // 'daily' or 'weekly'

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const now = new Date();

    // Get all companies that have at least one push subscription
    const { data: companies, error: cErr } = await sb
      .from('push_subscriptions')
      .select('company_id')
      .limit(500);

    if (cErr) throw cErr;
    if (!companies || companies.length === 0) {
      return new Response(JSON.stringify({ checked: 0, message: 'No subscriptions' }), { status: 200 });
    }

    // Unique company IDs
    const companyIds = [...new Set(companies.map((r: any) => r.company_id))];
    let totalNotifications = 0;

    for (const companyId of companyIds) {
      // ── DAILY CHECKS ──────────────────────────────────────────────────────

      if (checkType === 'daily') {
        // 1. Low stock filaments (below minimum or zero)
        const { data: filaments } = await sb
          .from('filaments')
          .select('name, weight_g, min_stock_g')
          .eq('company_id', companyId)
          .not('min_stock_g', 'is', null);

        if (filaments) {
          const emptyFilaments = filaments.filter((f: any) => f.weight_g <= 0);
          const lowFilaments = filaments.filter((f: any) => f.weight_g > 0 && f.min_stock_g && f.weight_g <= f.min_stock_g);

          for (const f of emptyFilaments) {
            await callSendPush(
              companyId,
              '🔴 Material Esgotado!',
              `${f.name} — stock em zero. Faça a sua encomenda!`,
              '/materials.html',
              `low-stock-${f.name}`
            );
            totalNotifications++;
          }

          // Aggregate low stock into one alert (avoid spam)
          if (lowFilaments.length > 0) {
            const names = lowFilaments.map((f: any) => f.name).slice(0, 3).join(', ');
            const extra = lowFilaments.length > 3 ? ` e mais ${lowFilaments.length - 3}` : '';
            await callSendPush(
              companyId,
              '⚠️ Stock Baixo',
              `${names}${extra} abaixo do mínimo. Verifique os materiais.`,
              '/materials.html',
              'low-stock-batch'
            );
            totalNotifications++;
          }
        }

        // 2. Orders due today or overdue
        const todayStr = now.toISOString().split('T')[0];
        const { data: orders } = await sb
          .from('orders')
          .select('id, order_numeric, client_name, delivery_date, status')
          .eq('company_id', companyId)
          .not('status', 'in', '(done,enviado,declined)')
          .lte('delivery_date', todayStr)
          .not('delivery_date', 'is', null)
          .order('delivery_date', { ascending: true })
          .limit(5);

        if (orders && orders.length > 0) {
          const dueToday = orders.filter((o: any) => o.delivery_date === todayStr);
          const overdue = orders.filter((o: any) => o.delivery_date < todayStr);

          if (overdue.length > 0) {
            const count = overdue.length;
            await callSendPush(
              companyId,
              `🚨 ${count} Pedido${count > 1 ? 's' : ''} em Atraso!`,
              `${overdue[0].order_numeric ? `#${overdue[0].order_numeric}` : 'Pedido'} para ${overdue[0].client_name || 'cliente'} está atrasado. Veja agora!`,
              '/orders.html',
              'orders-overdue'
            );
            totalNotifications++;
          }

          if (dueToday.length > 0) {
            const count = dueToday.length;
            await callSendPush(
              companyId,
              `📦 ${count} Entrega${count > 1 ? 's' : ''} Hoje!`,
              `${dueToday[0].order_numeric ? `Pedido #${dueToday[0].order_numeric}` : 'Um pedido'} para ${dueToday[0].client_name || 'cliente'} deve ser entregue hoje.`,
              '/orders.html',
              'orders-due-today'
            );
            totalNotifications++;
          }
        }
      }

      // ── WEEKLY CHECKS ─────────────────────────────────────────────────────

      if (checkType === 'weekly') {
        // 3. Pending payments
        const { data: pendingOrders } = await sb
          .from('orders')
          .select('id, total_price, currency')
          .eq('company_id', companyId)
          .eq('payment_status', 'pendente')
          .not('status', 'in', '(declined)');

        if (pendingOrders && pendingOrders.length > 0) {
          const total = pendingOrders.reduce((sum: number, o: any) => sum + (o.total_price || 0), 0);
          const currency = pendingOrders[0].currency || 'BRL';
          const formattedTotal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(total);
          await callSendPush(
            companyId,
            `💰 ${pendingOrders.length} Pagamentos Pendentes`,
            `Tens ${pendingOrders.length} pedidos por cobrar no total de ${formattedTotal}. Não se esqueça!`,
            '/financial.html',
            'weekly-payments'
          );
          totalNotifications++;
        }

        // 4. Weekly performance summary (last 7 days revenue)
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentOrders } = await sb
          .from('orders')
          .select('total_price, currency, status')
          .eq('company_id', companyId)
          .in('status', ['done', 'enviado'])
          .gte('updated_at', sevenDaysAgo);

        if (recentOrders && recentOrders.length > 0) {
          const weekTotal = recentOrders.reduce((sum: number, o: any) => sum + (o.total_price || 0), 0);
          const currency = recentOrders[0].currency || 'BRL';
          const formattedWeekTotal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(weekTotal);
          if (weekTotal > 0) {
            await callSendPush(
              companyId,
              `🎉 Semana Resumo`,
              `Esta semana concluíste ${recentOrders.length} pedido${recentOrders.length > 1 ? 's' : ''}, faturando ${formattedWeekTotal}. Bom trabalho!`,
              '/financial.html',
              'weekly-summary'
            );
            totalNotifications++;
          }
        }
      }
    }

    console.log(`[health-check] Type: ${checkType} | Companies: ${companyIds.length} | Notifications sent: ${totalNotifications}`);
    return new Response(JSON.stringify({ type: checkType, companies: companyIds.length, notifications: totalNotifications }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (e) {
    console.error('[health-check] Fatal error:', e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  httpClient: Stripe.createFetchHttpClient(),
});

const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');

  if (!signature || !endpointSecret) {
    return new Response('Webhook Secret or Signature missing', { status: 400 });
  }

  try {
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log(`[Stripe Webhook] Evento recebido: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const companyId = session.subscription_data?.metadata?.companyId || session.metadata?.companyId;
        const subscriptionId = session.subscription;
        
        if (companyId && subscriptionId) {
          // Obter detalhes da subscrição para saber o plano
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0].price.id;
          
          // Mapeamento inverso (Price ID -> Nome do Plano)
          // O ideal é usar metadata no Stripe para isto, mas aqui usamos uma lógica simples
          const planMap: Record<string, string> = {
            'price_starter_eur_monthly': 'starter',
            'price_pro_eur_monthly': 'pro',
            'price_biz_eur_monthly': 'business',
            // ... adicione todos os IDs aqui
          };

          const planName = planMap[priceId] || 'pro'; // Default pro caso não mapeie

          await supabaseAdmin
            .from('companies')
            .update({ 
              stripe_subscription_id: subscriptionId,
              plan: planName,
              is_suspended: false,
              trial_ends_at: new Date(subscription.current_period_end * 1000).toISOString()
            })
            .eq('id', companyId);
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        const companyId = invoice.subscription_details?.metadata?.companyId;
        
        if (companyId) {
          await supabaseAdmin.from('payments').insert({
            company_id: companyId,
            stripe_invoice_id: invoice.id,
            amount: invoice.amount_paid / 100,
            currency: invoice.currency,
            status: 'paid'
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const companyId = subscription.metadata?.companyId;
        
        if (companyId) {
          await supabaseAdmin
            .from('companies')
            .update({ 
              plan: 'trial', // Ou um plano 'free'
              is_suspended: true 
            })
            .eq('id', companyId);
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error(`[Stripe Webhook] Erro: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
})

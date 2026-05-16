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
          
          // Mapeamento inverso: deduzir o plano a partir do produto do preço
          const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
          const productId = typeof price.product === 'string' ? price.product : price.product?.id;

          const PRODUCT_TO_PLAN: Record<string, string> = {
            // STARTER
            'prod_UVxAt7FogW6RA0': 'starter', 'prod_UVxGynxFksQyD5': 'starter',
            'prod_UWAyAOg7lnr8e5': 'starter', 'prod_UWB0bv2BaVqUGj': 'starter',
            'prod_UWHrhBo9fm9WOt': 'starter_ano', 'prod_UWHrTLfPmC4xmj': 'starter_ano',
            'prod_UWHp0pL2xZ6nkU': 'starter_ano', 'prod_UWHsitmrkwvLYd': 'starter_ano',
            // PRO
            'prod_UWB5xLJbtUcGq6': 'pro', 'prod_UWB6Gy2pGMBBVf': 'pro',
            'prod_UWB5pHonKEMbk0': 'pro', 'prod_UWB3njOYnLFsDy': 'pro',
            'prod_UWBIseo3U18k1M': 'pro_ano', 'prod_UWBHK2waPP1VyZ': 'pro_ano',
            'prod_UWBJPD40pzYf1H': 'pro_ano', 'prod_UWBGDHItXw0xzl': 'pro_ano',
            // BUSINESS
            'prod_UWB8tiyOu5arwA': 'business', 'prod_UWB8PByy9wuiYt': 'business',
            'prod_UWB9XbirsqnTtp': 'business', 'prod_UWBACQwxj7cjAz': 'business',
            'prod_UWBEAbilzBxkBe': 'business_ano', 'prod_UWBC21gfNc8A2D': 'business_ano',
            'prod_UWBDTCsfQ33Xeu': 'business_ano', 'prod_UWBFpUFpaHCRXb': 'business_ano',
          };

          const planName = PRODUCT_TO_PLAN[productId || ''] || 'starter';

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

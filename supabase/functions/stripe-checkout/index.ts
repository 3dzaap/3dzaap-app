import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { plan, companyId } = await req.json()

    // 1. Mapeamento de Preços (IDs fictícios - o USER deve substituir pelos reais no Stripe)
    // DICA: No Stripe, crie um preço para EUR e outro para BRL no mesmo produto.
    const PRICES: Record<string, string> = {
      'starter':     'price_starter_eur_monthly', 
      'starter_ano': 'price_starter_eur_annual',
      'pro':         'price_pro_eur_monthly',
      'pro_ano':     'price_pro_eur_annual',
      'business':    'price_biz_eur_monthly',
      'business_ano':'price_biz_eur_annual',
      
      // Versões BRL (Exemplos)
      'starter_br':     'price_starter_brl_monthly', 
      'pro_br':         'price_pro_brl_monthly',
      'business_br':    'price_biz_brl_monthly',
    }

    // 2. Ligar ao Supabase Admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Buscar dados da empresa e determinar localização/moeda
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('name, config, stripe_customer_id')
      .eq('id', companyId)
      .single()

    const isBR = company?.config?.lang === 'pt-BR';
    const planKey = isBR && PRICES[plan + '_br'] ? plan + '_br' : plan;
    const priceId = PRICES[planKey];

    if (!priceId) throw new Error(`Preço não configurado para o plano ${plan} no idioma ${company?.config?.lang}`);

    // 4. Criar ou Obter Cliente no Stripe
    let customerId = company?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: company?.config?.email || '',
        name: company?.name,
        metadata: { companyId }
      })
      customerId = customer.id
      await supabaseAdmin.from('companies').update({ stripe_customer_id: customerId }).eq('id', companyId)
    }

    // 5. Criar Sessão de Checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      allow_promotion_codes: true,
      success_url: `${req.headers.get('origin')}/settings.html?tab=assinatura&status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/settings.html?tab=assinatura&status=cancel`,
      subscription_data: {
        metadata: { companyId }
      }
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

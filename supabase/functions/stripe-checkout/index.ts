import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.0.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Mapeamento de Plano + Moeda → Product ID do Stripe ──────────────────────
// Usamos Product IDs — a função vai buscar o Price ID automaticamente via API
const PRODUCT_MAP: Record<string, string> = {
  // STARTER
  'starter_eur':         'prod_UVxAt7FogW6RA0',
  'starter_usd':         'prod_UVxGynxFksQyD5',
  'starter_gbp':         'prod_UWAyAOg7lnr8e5',
  'starter_brl':         'prod_UWB0bv2BaVqUGj',
  'starter_ano_eur':     'prod_UWHrhBo9fm9WOt',
  'starter_ano_usd':     'prod_UWHrTLfPmC4xmj',
  'starter_ano_gbp':     'prod_UWHp0pL2xZ6nkU',
  'starter_ano_brl':     'prod_UWHsitmrkwvLYd',
  // PRO
  'pro_eur':             'prod_UWB5xLJbtUcGq6',
  'pro_usd':             'prod_UWB6Gy2pGMBBVf',
  'pro_gbp':             'prod_UWB5pHonKEMbk0',
  'pro_brl':             'prod_UWB3njOYnLFsDy',
  'pro_ano_eur':         'prod_UWBIseo3U18k1M',
  'pro_ano_usd':         'prod_UWBHK2waPP1VyZ',
  'pro_ano_gbp':         'prod_UWBJPD40pzYf1H',
  'pro_ano_brl':         'prod_UWBGDHItXw0xzl',
  // BUSINESS
  'business_eur':        'prod_UWB8tiyOu5arwA',
  'business_usd':        'prod_UWB8PByy9wuiYt',
  'business_gbp':        'prod_UWB9XbirsqnTtp',
  'business_brl':        'prod_UWBACQwxj7cjAz',
  'business_ano_eur':    'prod_UWBEAbilzBxkBe',
  'business_ano_usd':    'prod_UWBC21gfNc8A2D',
  'business_ano_gbp':    'prod_UWBDTCsfQ33Xeu',
  'business_ano_brl':    'prod_UWBFpUFpaHCRXb',
}

// Moeda padrão por idioma/localização
function getCurrencyFromLang(lang: string): string {
  if (lang === 'pt-BR') return 'brl';
  if (lang === 'en-GB') return 'gbp';
  if (lang === 'en-US') return 'usd';
  return 'eur'; // pt-PT, es, default
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { plan, companyId, currency: forcedCurrency } = await req.json()

    // 1. Ligar ao Supabase Admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Buscar dados da empresa
    const { data: company, error: companyErr } = await supabaseAdmin
      .from('companies')
      .select('name, config, stripe_customer_id')
      .eq('id', companyId)
      .single()

    if (companyErr || !company) throw new Error('Empresa não encontrada');

    // 3. Determinar moeda com base no idioma da empresa (ou forçada pelo cliente)
    const lang = company?.config?.language || 'pt-PT';
    const currency = forcedCurrency || getCurrencyFromLang(lang);

    // 4. Construir a chave do produto
    const productKey = `${plan}_${currency}`;
    const productId = PRODUCT_MAP[productKey];

    if (!productId) {
      throw new Error(`Produto não encontrado para: ${productKey}`);
    }

    // 5. Buscar o Price ID automaticamente via API do Stripe
    const prices = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 1,
    });

    if (!prices.data.length) {
      throw new Error(`Nenhum preço ativo encontrado para o produto ${productId}`);
    }

    const priceId = prices.data[0].id;
    console.log(`[Checkout] Plano: ${plan} | Moeda: ${currency} | Product: ${productId} | Price: ${priceId}`);

    // 6. Criar ou obter cliente no Stripe
    let customerId = company?.stripe_customer_id;
    
    if (customerId) {
      try {
        const existingCustomer = await stripe.customers.retrieve(customerId);
        if (existingCustomer.deleted) {
           customerId = null; // Cliente apagado no Stripe
        }
      } catch (err) {
        if (err.message && err.message.includes('No such customer')) {
           customerId = null; // Cliente não existe no Stripe
        } else {
           throw err; // Outro erro, por exemplo, de rede ou API
        }
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: company?.config?.email || '',
        name: company?.name,
        metadata: { companyId }
      });
      customerId = customer.id;
      await supabaseAdmin
        .from('companies')
        .update({ stripe_customer_id: customerId })
        .eq('id', companyId);
    }

    // 7. Criar sessão de Checkout
    const origin = req.headers.get('origin') || 'https://3dzaap.com';
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      allow_promotion_codes: true,
      tax_id_collection: { enabled: true },
      customer_update: {
        name: 'auto',
        address: 'auto'
      },
      metadata: { companyId, plan },
      success_url: `${origin}/settings.html?tab=assinatura&status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/settings.html?tab=assinatura&status=cancel`,
      subscription_data: {
        metadata: { companyId, plan }
      }
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[Checkout Error]', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Interfaces
interface Product {
  id: string;
  store_id: string;
  name: string;
  weight_g: number;
  product_url: string;
}

// Simulador de Scraper/API Fetcher
// Num cenário real, esta função faria um fetch ao product_url ou API da loja
// e faria o parse do HTML/JSON para encontrar o preço atual e o stock
async function fetchCurrentPriceFromStore(product: Product): Promise<{ price: number, in_stock: boolean } | null> {
  console.log(`[Mock] A verificar preço para: ${product.name} na URL: ${product.product_url}`);
  
  // Simulando um delay de rede
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Gerando um preço aleatório entre 15 e 30 euros para testar a flutuação
  const randomPrice = (Math.random() * (30 - 15) + 15).toFixed(2);
  const inStock = Math.random() > 0.1; // 90% de chance de ter stock

  return {
    price: parseFloat(randomPrice),
    in_stock: inStock
  };
}

serve(async (req) => {
  try {
    // 1. Inicializar Cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('As variáveis de ambiente do Supabase não estão configuradas.');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 2. Buscar todos os produtos ativos
    const { data: products, error: productsError } = await supabase
      .from('filaments_products')
      .select('id, store_id, name, weight_g, product_url')
      .eq('is_active', true);

    if (productsError) {
      throw productsError;
    }

    if (!products || products.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum produto ativo encontrado." }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    let processedCount = 0;
    let errorCount = 0;

    // 3. Iterar sobre cada produto e verificar o preço
    for (const product of products) {
      try {
        const result = await fetchCurrentPriceFromStore(product);
        
        if (result) {
          // Lógica de Normalização: Calcular Preço por KG
          // Ex: Se o peso é 1000g (1kg) e o preço é 20€, preço por kg é 20€
          // Se o peso é 250g e o preço é 10€, preço por kg é (10 / (250 / 1000)) = 40€
          const weightInKg = product.weight_g / 1000;
          const pricePerKg = result.price / weightInKg;

          // Guardar no histórico de preços
          const { error: insertError } = await supabase
            .from('filaments_price_history')
            .insert({
              product_id: product.id,
              price: result.price,
              price_per_kg: Number(pricePerKg.toFixed(2)),
              in_stock: result.in_stock,
              currency: 'EUR'
            });

          if (insertError) {
            console.error(`Erro ao gravar histórico para ${product.id}:`, insertError);
            errorCount++;
          } else {
            processedCount++;
          }
        }
      } catch (err) {
        console.error(`Erro ao processar produto ${product.id}:`, err);
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Verificação de preços concluída.",
        stats: {
          total_products: products.length,
          processed: processedCount,
          errors: errorCount
        }
      }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    })
  }
})

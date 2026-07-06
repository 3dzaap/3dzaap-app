import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // A API Gateway do Supabase já verifica o JWT automaticamente.
    // Qualquer pedido que chegue aqui já está autorizado.
    
    const body = await req.json()
    let { prompt, model = 'gemini-1.5-flash-latest' } = body
    if (model === 'gemini-1.5-flash') {
      model = 'gemini-1.5-flash-latest'
    }
    
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt é obrigatório' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
       return new Response(JSON.stringify({ error: 'GEMINI_API_KEY não configurada no servidor' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
    }

    // Call Google Gemini API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
    };

    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let data = await response.json();
    
    // Auto-healing: Se o modelo falhar (ex: descontinuado ou nome incorreto), procura o modelo correto na conta da Google
    if (!response.ok) {
      console.log("Modelo inicial falhou. A tentar auto-recuperar com a lista de modelos válidos...")
      try {
        const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
        const listData = await listResp.json()
        
        // Encontrar o primeiro modelo disponível que suporte geração de texto (generateContent)
        const validModel = listData.models?.find((m: any) => 
          m.supportedGenerationMethods?.includes("generateContent") && 
          (m.name.includes("flash") || m.name.includes("pro"))
        )

        if (validModel) {
          const newModelName = validModel.name.replace('models/', '')
          console.log(`Auto-healing: A re-tentar com o modelo válido [${newModelName}]`)
          const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/${newModelName}:generateContent?key=${apiKey}`;
          
          response = await fetch(fallbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          data = await response.json();
        }
      } catch (e) {
        console.error("Falha no auto-healing:", e)
      }
    }

    if (!response.ok) {
      let availableModelsStr = ''
      try {
        const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
        const listData = await listResp.json()
        const names = listData.models?.map((m: any) => m.name.replace('models/', '')) || []
        if (names.length > 0) {
          availableModelsStr = ` | Modelos disponíveis na sua chave: [${names.join(', ')}]`
        }
      } catch(e) {}

      return new Response(JSON.stringify({ 
        error: (data.error?.message || 'Erro do Gemini') + availableModelsStr 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    const resultText = data.candidates[0]?.content?.parts[0]?.text || null;
    return new Response(JSON.stringify({ text: resultText }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

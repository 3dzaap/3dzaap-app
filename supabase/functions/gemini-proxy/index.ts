import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    let { prompt, model = 'gemini-2.5-flash', customApiKey } = body
    
    // Lista de modelos robustos em ordem de preferência (priorizando modelos com maior cota gratuita atual)
    const fallbackModels = [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash'
    ]
    if (!fallbackModels.includes(model)) {
      model = 'gemini-2.5-flash'
    }
    
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt é obrigatório' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    // Chave API armazenada de forma segura nas variáveis de ambiente do servidor Supabase
    const apiKey = customApiKey || Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
       return new Response(JSON.stringify({ error: 'Chave API não configurada no servidor nem fornecida pelo cliente.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
    }

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
    };

    let lastErrorMsg = ''
    let data = null
    let response = null

    for (const testModel of [model, ...fallbackModels.filter(m => m !== model)]) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${apiKey}`;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        data = await response.json();
        
        // Se funcionou, paramos o loop com sucesso!
        if (response.ok) {
          break;
        }

        lastErrorMsg = data.error?.message || 'Erro do Gemini API: ' + testModel;
        console.warn(`[gemini-proxy] Falha no modelo ${testModel}: ${lastErrorMsg}`);
        
        // Se a chave for inválida (401), não adianta tentar outros modelos
        if (response.status === 401 || lastErrorMsg.toLowerCase().includes('api key not valid')) {
          break;
        }
      } catch (e: any) {
        lastErrorMsg = e.message;
      }
    }

    if (!response || !response.ok) {
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
        error: lastErrorMsg + availableModelsStr 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    return new Response(JSON.stringify({ text: resultText }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

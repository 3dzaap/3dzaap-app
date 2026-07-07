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
    let { prompt, model = 'gemini-2.0-flash', customApiKey } = body
    
    // Lista de modelos robustos em ordem de preferência
    const fallbackModels = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-pro', 'gemini-2.0-flash-lite']
    if (!fallbackModels.includes(model)) {
      model = 'gemini-2.0-flash'
    }
    
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt é obrigatório' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    // Se o cliente forneceu uma chave própria, usar essa chave; caso contrário, usar a variável de ambiente do servidor
    const apiKey = customApiKey || Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
       return new Response(JSON.stringify({ error: 'Chave API não configurada no servidor nem fornecida pelo cliente.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
    }

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
    };

    // Tentar chamar com o modelo principal ou percorrer lista de fallbacks se o modelo não existir nessa chave
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
        
        // Se funcionou, paramos o loop!
        if (response.ok) {
          break;
        }

        lastErrorMsg = data.error?.message || 'Erro do Gemini API'
        
        // Se o erro for de billing (ex: créditos esgotados ou chave inválida), não adianta tentar outros modelos
        if (lastErrorMsg.toLowerCase().includes('prepayment') || lastErrorMsg.toLowerCase().includes('billing') || lastErrorMsg.toLowerCase().includes('quota') || response.status === 403 || response.status === 429) {
          break;
        }
      } catch (e) {
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

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

/**
 * AIService: Handles communication with Google Gemini API via Supabase Edge Function.
 * The API key is stored and managed securely on Supabase backend.
 */
const AIService = {
  async callGemini(prompt, model = 'gemini-2.5-flash') {
    try {
      // Tentar preferencialmente através do SDK nativo do Supabase (que injeta headers apikey e auth automaticamente)
      if (window._sb && window._sb.functions && typeof window._sb.functions.invoke === 'function') {
        try {
          const { data, error } = await window._sb.functions.invoke('gemini-proxy', {
            body: { prompt, model }
          });
          if (!error && data) {
            if (data.error) throw new Error(data.error);
            return data.text || null;
          }
          if (error) {
            console.warn("[AIService] Supabase SDK invoke retornou erro, tentando via fetch direto...", error);
          }
        } catch (sdkErr) {
          console.warn("[AIService] Erro no invoke do SDK, tentando via fetch...", sdkErr);
        }
      }

      // Fallback via fetch manual incluindo obrigatoriamente apikey (anon) e Authorization
      const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZ2dzbmR4YXRlemdxbGpsaHhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MjE0MTgsImV4cCI6MjA4OTA5NzQxOH0.zVzA2siKsix8tOK44H5U-cZK1Wdd_4u_sY1g2JgGYUA';
      const { data: { session } } = await (window._sb ? window._sb.auth.getSession() : { data: { session: null } });
      const token = session?.access_token || anonKey;

      const headers = {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': 'Bearer ' + token
      };

      const response = await fetch('https://yjggsndxatezgqljlhxb.supabase.co/functions/v1/gemini-proxy', {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt, model })
      });

      const data = await response.json();

      if (!response.ok) {
        const errMsg = data.error || data.details || 'Erro ao chamar a IA do Supabase';
        throw new Error(errMsg);
      }

      return data ? data.text : null;
    } catch (err) {
      console.error("AIService Error:", err);
      throw err;
    }
  },

  async generateFinancialReport(financialData) {
    const prompt = `
Você é um consultor financeiro especialista em negócios de impressão 3D (makerspaces, fazendas de impressão e gráficas 3D).
Analise os seguintes dados financeiros do período atual da minha empresa gráfica e forneça um relatório curto, direto, estratégico e motivador.

DADOS DO PERÍODO:
- Faturação Total: ${financialData.revenue} €
- Despesas Totais: ${financialData.expenses} €
- Lucro Líquido: ${financialData.profit} €
- Pedidos Concluídos: ${financialData.ordersCompleted}
- Máquinas Ativas: ${financialData.printersActive}

A sua resposta deve ser estritamente em formato HTML simples e bonito. Use tags <strong>, <ul>, <li>, <p>, <br>.
Não use a tag <markdown> nem blocos de código markdown (\`\`\`html). 
Não inclua introduções compridas ou despedidas. Vá direto ao ponto com análises de alto valor.

ESTRUTURA DA RESPOSTA:
1. <p>Um parágrafo curto (1-2 frases) avaliando a saúde financeira atual (Se está Excelente, Razoável ou em Alerta).</p>
2. <h4 style="margin: 12px 0 6px 0; font-size: 0.95rem; color: #a855f7;"><i class="ph-bold ph-lightning"></i> Recomendações Práticas para Gráfica 3D:</h4>
3. Três (3) dicas estratégicas de alto impacto focadas no mercado de impressão 3D (ex: otimização de tempo de máquina no slicer, compra inteligente de filamento em lote, manutenção preventiva de nozzles/resina, ajuste de precificação por hora, etc.). Formate as dicas numa <ul> com estilo limpo.
    `;

    return await this.callGemini(prompt);
  },

  async generateDailyBriefing(data) {
    const prompt = `
Você é a Assistente Executiva de IA de uma gráfica 3D. O seu papel é dar um "Briefing Matinal" motivador, estratégico e focado em ação ao dono da gráfica.
Hoje, os dados da fábrica são:
- Health Score (Saúde Global): ${data.healthScore} de 100
- Pedidos Pendentes Totais: ${data.pendingOrders}
- Pedidos Atrasados: ${data.overdueOrders}
- Impressoras Ativas: ${data.printersActive}

A sua resposta deve ser em formato HTML simples e bonito. Use tags <strong>, <p>, <br>. 
Não use blocos de código nem a tag <markdown>.
A resposta deve ter 2 pequenos parágrafos:
1. Uma saudação motivacional rápida e resumo do estado da fábrica (ex: "Bom dia! A nossa saúde está em X/100 com Y máquinas operacionais!").
2. Uma diretriz executiva de foco para hoje (ex: "O foco prioritário deve ser eliminar os Z pedidos em atraso para blindar a nossa satisfação do cliente. Vamos produzir!").
Mantenha o tom profissional, vibrante e encorajador.
    `;

    return await this.callGemini(prompt);
  }
};

window.AIService = AIService;

/**
 * AIService: Handles communication with the Google Gemini API.
 */
const AIService = {
  // Common generic fetcher for Gemini API via Supabase Edge Function
  async callGemini(prompt, model = 'gemini-1.5-flash') {
    try {
      // Ensure user has an active session before invoking
      const { data: { session } } = await _sb.auth.getSession();
      if (!session) {
        throw new Error('Sessão expirada. Por favor, recarregue a página e faça login novamente.');
      }

      // Use direct fetch to extract the exact error message from the Edge Function JSON response
      const response = await fetch('https://yjggsndxatezgqljlhxb.supabase.co/functions/v1/gemini-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session.access_token
        },
        body: JSON.stringify({ prompt, model })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Gemini Proxy Error Details:", data);
        const errMsg = data.error || data.details || 'Erro desconhecido ao chamar a IA';
        throw new Error(errMsg);
      }

      if (data && data.error) {
        throw new Error(data.error);
      }

      return data ? data.text : null;
    } catch (err) {
      console.error("AIService Error:", err);
      throw err;
    }
  },

  // Generates Financial Health Report
  async generateFinancialReport(financialData) {
    const prompt = `
Você é um consultor financeiro especialista em negócios de impressão 3D (makerspaces e gráficas 3D).
Analise os seguintes dados financeiros do período atual da minha empresa gráfica e forneça um relatório curto, direto e motivador.

DADOS DO PERÍODO:
- Faturação Total: ${financialData.revenue} €
- Despesas Totais: ${financialData.expenses} €
- Lucro Líquido: ${financialData.profit} €
- Pedidos Concluídos: ${financialData.ordersCompleted}
- Máquinas Ativas: ${financialData.printersActive}

A sua resposta deve ser em formato HTML simples e bonito. Use tags <strong>, <ul>, <li>.
Não use a tag <markdown> ou blocos de código. 
Não inclua introduções compridas ou despedidas. Vá direto ao ponto.

ESTRUTURA DA RESPOSTA:
1. Um pequeno parágrafo (1-2 frases) sobre o estado atual (Se é Boa, Razoável ou Perigosa a saúde).
2. Título <h4>Dicas de Melhoria:</h4>
3. Três (3) dicas estritamente focadas em Impressão 3D para aumentar as margens de lucro ou reduzir custos (ex: otimização de slicer, compra de filamento em lote, manutenção de nozzles, precificação da resina, etc.). Formate as dicas como uma <ul>.
    `;

    return await this.callGemini(prompt);
  },

  // Generates Daily Morning Briefing
  async generateDailyBriefing(data) {
    const prompt = `
Você é a Assistente Executiva de uma gráfica 3D. O seu papel é dar um "Briefing Matinal" motivador, direto e focado em ação ao dono da gráfica.
Hoje, a situação da gráfica é a seguinte:
- Health Score (Saúde Global): ${data.healthScore} de 100
- Pedidos Pendentes Totais: ${data.pendingOrders}
- Pedidos Atrasados: ${data.overdueOrders}
- Impressoras Ativas: ${data.printersActive}

A sua resposta deve ser em formato HTML simples e bonito. Use apenas tags como <strong> e <br>. 
Não use blocos de código nem a tag <markdown>.
A resposta deve ter 2 pequenos parágrafos:
1. Uma saudação motivacional e um resumo super rápido do estado (ex: "Bom dia! A saúde da gráfica está a X. Temos Y impressoras prontas para trabalhar!").
2. Uma diretriz de foco para hoje (ex: "O seu foco principal hoje deve ser despachar os Z pedidos atrasados para manter a reputação excelente. Vamos a isso!").
Mantenha o tom profissional mas encorajador e amigável.
    `;

    return await this.callGemini(prompt);
  }
};

window.AIService = AIService;

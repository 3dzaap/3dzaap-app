/**
 * AIService: Handles communication with Google Gemini API via Supabase Edge Function.
 * Includes Weekly Caching to save API tokens (1 report generation per week per user).
 */

function getCurrentWeekKey() {
  const now = new Date();
  const onejan = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil((((now - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${week}`;
}

const AIService = {
  getWeeklyCache(reportType) {
    try {
      const stored = localStorage.getItem(`3dzaap_ai_cache_${reportType}`);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      if (parsed && parsed.week === getCurrentWeekKey() && parsed.html) {
        return parsed;
      }
    } catch (e) {
      console.warn("Error reading AI cache:", e);
    }
    return null;
  },

  setWeeklyCache(reportType, html) {
    try {
      const payload = {
        week: getCurrentWeekKey(),
        timestamp: new Date().toISOString(),
        html
      };
      localStorage.setItem(`3dzaap_ai_cache_${reportType}`, JSON.stringify(payload));
    } catch (e) {
      console.warn("Error saving AI cache:", e);
    }
  },

  async callGemini(prompt, model = 'gemini-2.5-flash') {
    try {
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

  async generateExecutiveDashboardModal(data) {
    const prompt = `
Você é o Chief Operating Officer (COO) e Consultor Executivo Sênior especializado em fazendas de impressão 3D e manufatura digital.
O dono da empresa abriu o Parecer Geral da Empresa no Dashboard. Preciso de um relatório executivo PROFUNDO, ANALÍTICO E ESTRATÉGICO com base nos dados atuais e gerais da gráfica.

DADOS OPERACIONAIS DA EMPRESA:
- Saúde Operacional (Health Score): ${data.healthScore} / 100
- Total de Pedidos Pendentes / Em Produção: ${data.pendingOrders}
- Pedidos Atrasados: ${data.overdueOrders}
- Máquinas Ativas / Operacionais: ${data.printersActive}
- Total de Clientes Cadastrados: ${data.clientsCount || 'N/A'}
- Total de Produtos na Biblioteca: ${data.productsCount || 'N/A'}

A sua resposta deve ser em HTML limpo, moderno e muito bem estruturado, usando cabeçalhos, destaques em negrito (<strong>) e listas (<ul>, <li>).
NÃO use a tag <markdown> ou blocos de código. NÃO inclua saudações clichê.

ESTRUTURA OBRIGATÓRIA DO PARECER:
1. <div style="margin-bottom:18px;"><h4 style="color:#6366f1; margin-bottom:8px; display:flex; align-items:center; gap:6px;"><i class="ph-bold ph-chart-polar"></i> 1. Diagnóstico Global da Operação</h4><p>Análise aprofundada sobre a saúde geral, equilíbrio entre capacidade instalada (${data.printersActive} máquinas) e carga de trabalho (${data.pendingOrders} pedidos).</p></div>
2. <div style="margin-bottom:18px;"><h4 style="color:#a855f7; margin-bottom:8px; display:flex; align-items:center; gap:6px;"><i class="ph-bold ph-warning-circle"></i> 2. Análise de Riscos e Gargalos</h4><p>Avaliação detalhada dos riscos (incluindo impacto dos ${data.overdueOrders} pedidos em atraso) e eficiência de entrega.</p></div>
3. <div><h4 style="color:#10b981; margin-bottom:8px; display:flex; align-items:center; gap:6px;"><i class="ph-bold ph-target"></i> 3. Plano Executivo de Ação Recomendado</h4><ul style="padding-left:18px; line-height:1.7;"> Três (3) estratégias avançadas e detalhadas para escalar produtividade e satisfação do cliente na farm.</ul></div>
    `;

    return await this.callGemini(prompt);
  },

  async generateFinancialComparativeModal(periodLabel, currentMonth, historyMonths) {
    const historyText = historyMonths.map(m => 
      `• ${m.label}: Faturamento € ${m.revenue.toFixed(2)} | Despesas € ${m.expenses.toFixed(2)} | Lucro Líquido € ${m.profit.toFixed(2)}`
    ).join('\n');

    const prompt = `
Você é o Chief Financial Officer (CFO) e Consultor Financeiro Sênior de uma empresa gráfica 3D e fazenda de impressão de alta performance.
Forneça um RELATÓRIO MENSAL COMPARATIVO COMPLETO E PROFUNDO entre o mês selecionado (${periodLabel}) e o histórico dos meses anteriores.

MÊS SELECIONADO (${periodLabel}):
- Faturamento / Receita Paga: € ${currentMonth.revenue.toFixed(2)}
- Custos de Produção e Despesas: € ${currentMonth.expenses.toFixed(2)}
- Lucro Líquido Real: € ${currentMonth.profit.toFixed(2)}
- Pedidos Concluídos: ${currentMonth.ordersCompleted}

HISTÓRICO COMPARATIVO DOS MESES ANTERIORES:
${historyText || 'Sem dados históricos anteriores suficientes para comparar.'}

A sua resposta deve ser em HTML limpo, visualmente elegante e corporativo, utilizando tags <h4>, <p>, <strong>, <ul> e <li>.
NÃO use blocos de código nem <markdown>.

ESTRUTURA OBRIGATÓRIA DO RELATÓRIO FINANCEIRO:
1. <div style="margin-bottom:18px;"><h4 style="color:#a855f7; margin-bottom:8px;"><i class="ph-bold ph-trend-up"></i> 1. Análise Comparativa do Desempenho (${periodLabel})</h4><p>Análise profunda comparando o faturamento, custos e evolução da margem de lucro em relação aos meses anteriores.</p></div>
2. <div style="margin-bottom:18px;"><h4 style="color:#3b82f6; margin-bottom:8px;"><i class="ph-bold ph-scales"></i> 2. Eficiência de Custos e Margem Líquida</h4><p>Avaliação sobre a estrutura de gastos (filamento, resina, manutenção, despesas operacionais) e se a margem líquida está saudável para o setor de impressão 3D.</p></div>
3. <div><h4 style="color:#10b981; margin-bottom:8px;"><i class="ph-bold ph-rocket-launch"></i> 3. Diretrizes de Crescimento e Precificação</h4><ul style="padding-left:18px; line-height:1.7;">Três (3) recomendações estratégicas acionáveis para aumentar o lucro líquido e otimizar preços ou contratos recorrentes.</ul></div>
    `;

    return await this.callGemini(prompt);
  }
};

window.AIService = AIService;

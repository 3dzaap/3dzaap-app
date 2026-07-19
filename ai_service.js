/**
 * AIService: Handles communication with Google Gemini API via Supabase Edge Function.
 * Includes Weekly Caching to save API tokens (1 report generation per week per user).
 */

function getCachePeriodKey() {
  const mode = localStorage.getItem('3dzaap_ai_cache_mode') || 'weekly';
  const now = new Date();
  if (mode === 'daily') {
    return now.toISOString().slice(0, 10);
  }
  const onejan = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil((((now - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${week}`;
}

function cleanAIOutput(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.replace(/```(?:html|xml)?\s*\n?/gi, '').replace(/```/g, '');
  cleaned = cleaned.replace(/<!DOCTYPE[^>]*>/gi, '')
                   .replace(/<\/?html[^>]*>/gi, '')
                   .replace(/<\/?body[^>]*>/gi, '')
                   .replace(/<head>[\s\S]*?<\/head>/gi, '');
  return cleaned.trim();
}

const AIService = {
  getCacheMode() {
    return localStorage.getItem('3dzaap_ai_cache_mode') || 'weekly';
  },

  setCacheMode(mode) {
    localStorage.setItem('3dzaap_ai_cache_mode', mode);
  },

  getWeeklyCache(reportType) {
    if (this.getCacheMode() === 'disabled') return null;
    try {
      const stored = localStorage.getItem(`3dzaap_ai_cache_${reportType}`);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      if (parsed && parsed.version === 'v8_cfo_fidelity' && parsed.period === getCachePeriodKey() && parsed.html && parsed.html.length > 50) {
        return parsed;
      }
    } catch (e) {
      console.warn("Error reading AI cache:", e);
    }
    return null;
  },

  setWeeklyCache(reportType, html) {
    if (this.getCacheMode() === 'disabled') return;
    if (!html || typeof html !== 'string' || html.trim().length < 50) return;
    try {
      const payload = {
        version: 'v8_cfo_fidelity',
        period: getCachePeriodKey(),
        html: html
      };
      localStorage.setItem(`3dzaap_ai_cache_${reportType}`, JSON.stringify(payload));
    } catch (e) {
      console.warn("Error saving AI cache:", e);
    }
  },

  clearWeeklyCache(reportType) {
    try {
      if (reportType) {
        localStorage.removeItem(`3dzaap_ai_cache_${reportType}`);
      } else {
        localStorage.removeItem('3dzaap_ai_cache_dashboard');
        localStorage.removeItem('3dzaap_ai_cache_financial');
      }
    } catch (e) {}
  },

  getCustomApiKey() {
    return localStorage.getItem('3dzaap_gemini_custom_key') || '';
  },

  setCustomApiKey(key) {
    if (key && key.trim()) {
      localStorage.setItem('3dzaap_gemini_custom_key', key.trim());
    } else {
      localStorage.removeItem('3dzaap_gemini_custom_key');
    }
  },

  async callGemini(prompt, model = 'gemini-2.5-flash-lite') {
    try {
      const customApiKey = this.getCustomApiKey();
      if (window._sb && window._sb.functions && typeof window._sb.functions.invoke === 'function') {
        try {
          const { data, error } = await window._sb.functions.invoke('gemini-proxy', {
            body: { prompt, model, customApiKey }
          });
          if (!error && data) {
            if (data.error) throw new Error(data.error);
            const cleaned = cleanAIOutput(data.text);
            if (cleaned) return cleaned;
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
        body: JSON.stringify({ prompt, model, customApiKey })
      });

      const data = await response.json();

      if (!response.ok) {
        const errMsg = data.error || data.details || 'Erro ao chamar a IA do Supabase';
        throw new Error(errMsg);
      }

      return cleanAIOutput(data ? data.text : null);
    } catch (err) {
      console.error("AIService Error:", err);
      throw err;
    }
  },

  async generateExecutiveDashboardModal(data) {
    const healthNum = Number(data.healthScore) || 59;
    const headerHtml = `
      <style>
        .ai-report-body {
          color: var(--dark, #e2e8f0);
          line-height: 1.7;
          font-size: 0.95rem;
        }
        .ai-report-body h3, .ai-report-body h4 {
          color: #a855f7;
          margin-top: 22px;
          margin-bottom: 10px;
          font-weight: 800;
          font-size: 1.08rem;
        }
        .ai-report-body p {
          margin-bottom: 14px;
          color: var(--dark, #e2e8f0);
        }
        .ai-report-body ul {
          margin-bottom: 18px;
          padding-left: 20px;
        }
        .ai-report-body li {
          margin-bottom: 8px;
          color: var(--dark, #e2e8f0);
        }
        .ai-report-body strong {
          color: #6366f1;
        }
        .ai-report-body div[style*="background"] {
          color: var(--dark, #e2e8f0) !important;
        }
      </style>
      <div style="background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.08)); border: 1px solid rgba(168,85,247,0.25); border-radius: 14px; padding: 20px; margin-bottom: 22px;">
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 16px;">
          <div>
            <div style="font-size: 0.75rem; font-weight: 700; color: #a855f7; text-transform: uppercase; letter-spacing: 0.05em;"><i class="ph-bold ph-heartbeat"></i> Saúde Operacional (Health Score)</div>
            <div style="font-size: 2.1rem; font-weight: 800; color: var(--dark); line-height: 1.1;">
              ${healthNum} <span style="font-size: 1rem; color: var(--muted); font-weight: 600;">/ 100</span>
            </div>
          </div>
          <div style="flex: 1; min-width: 180px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 600; color: var(--muted); margin-bottom: 6px;">
              <span>Índice de Saúde Operacional</span>
              <span>${healthNum}%</span>
            </div>
            <div style="height: 10px; background: rgba(0,0,0,0.08); border-radius: 10px; overflow: hidden;">
              <div style="width: ${Math.min(100, Math.max(0, healthNum))}%; background: linear-gradient(90deg, #6366f1, #a855f7); height: 100%; border-radius: 10px;"></div>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; border-top: 1px solid rgba(168,85,247,0.15); padding-top: 14px;">
          <div style="background: rgba(255,255,255,0.05); padding: 10px 12px; border-radius: 10px; text-align: center;">
            <div style="font-size: 0.75rem; color: var(--muted); font-weight: 600;">Total Pedidos</div>
            <div style="font-size: 1.25rem; font-weight: 800; color: #6366f1;">${data.totalOrders !== undefined ? data.totalOrders : (data.pendingOrders || 0)}</div>
          </div>
          <div style="background: rgba(255,255,255,0.05); padding: 10px 12px; border-radius: 10px; text-align: center;">
            <div style="font-size: 0.75rem; color: var(--muted); font-weight: 600;">Em Atraso</div>
            <div style="font-size: 1.25rem; font-weight: 800; color: ${Number(data.overdueOrders) > 0 ? '#ef4444' : '#10b981'};">${data.overdueOrders || 0}</div>
          </div>
          <div style="background: rgba(255,255,255,0.05); padding: 10px 12px; border-radius: 10px; text-align: center;">
            <div style="font-size: 0.75rem; color: var(--muted); font-weight: 600;">Máquinas Ativas</div>
            <div style="font-size: 1.25rem; font-weight: 800; color: #10b981;">${data.printersActive || 1}</div>
          </div>
        </div>
      </div>
      <div class="ai-report-body">
    `;

    const prompt = `
Você é o Chief Operating Officer (COO) e Consultor Executivo Sênior especializado em fazendas de impressão 3D (3D Print Farm).
Escreva um RELATÓRIO EXECUTIVO EXTREMAMENTE COMPLETO, DETALHADO E APROFUNDADO para o proprietário da empresa.

DADOS REAIS DA OPERAÇÃO NO DASHBOARD:
- Plano de Assinatura Atual: ${data.currentPlan ? data.currentPlan.toUpperCase() : 'DESCONHECIDO'}
- Saúde Operacional Atual (Health Score): ${healthNum} / 100
- Total de Pedidos Registrados: ${data.totalOrders !== undefined ? data.totalOrders : (data.pendingOrders || 0)}
- Pedidos Ativos / Em Produção: ${data.pendingOrders || 0}
- Pedidos em Atraso: ${data.overdueOrders || 0}
- Faturamento Atual no Dashboard: ${data.revenueText || '€ 0,00'}
- Máquinas Operacionais na Gráfica: ${data.printersActive || 1}
- Clientes Ativos (Cadastros ou Pedidos): ${data.clientsCount || 0}
- Portfólio / Modelos Impressos: ${data.productsCount || 0}

REGRAS DE FIDELIDADE E ESTRATÉGIA:
- Seja 100% fiel aos números acima. NÃO afirme que o usuário tem "ausência de clientes" ou "0 produtos" ou "operação parada" se os números acima mostrarem que há pedidos, clientes ou faturamento registrados.
- CONTEXTO DO ERP: O utilizador JÁ ESTÁ A USAR o 3DZAAP, um ERP completo que já possui: Calculadora de Orçamentos, Gestão de Pedidos (Pipeline/Funil), CRM (Clientes), Inventário (Materiais/Impressoras) e Financeiro. NUNCA sugira "adotar um sistema de orçamentos", "criar planilhas" ou "implementar um CRM". Em vez disso, aconselhe a UTILIZAR ATIVAMENTE os módulos nativos do 3DZAAP para centralizar a operação.
- UPGRADE STRATEGY (PLG): Se o Plano de Assinatura Atual for 'STARTER' ou 'TRIAL', avalie os limites (ex: 5 pedidos max) e o faturamento para sugerir de forma orgânica e justificada, no Plano Executivo de Ação, um upgrade para o plano 'PRO' ou 'BUSINESS' para escalar a produção sem limites e desbloquear a gestão financeira avançada.
- Responda apenas em HTML limpo utilizando tags <h4>, <p>, <strong>, <ul> e <li>.
- NÃO utilize a tag <markdown> nem blocos de código ou cores de texto fixas brancas.

VOCÊ DEVE OBRIGATORIAMENTE DESENVOLVER TODOS OS 3 TÓPICOS ABAIXO COM PROFUNDIDADE:

<h4>1. Diagnóstico do Health Score (${healthNum}/100) e Desempenho Operacional</h4>
Explique em pelo menos 2 parágrafos detalhados o desempenho da gráfica que reflete a nota ${healthNum}/100. Analise o fluxo de pedidos (${data.totalOrders || data.pendingOrders || 0} pedido(s)), faturamento (${data.revenueText || 'N/A'}), clientes (${data.clientsCount || 0}) e a relação com a capacidade instalada (${data.printersActive} máquina(s)).

<h4>2. Pontos Críticos e Gargalos Operacionais</h4>
Apresente uma lista detalhada com 3 a 4 pontos críticos reais baseados nos dados acima para monitoramento urgente da operação.

<h4>3. Plano Executivo de Ação Recomendado (Com Sugestões Práticas)</h4>
Apresente 4 ações estratégicas concretas e aplicáveis imediatamente para o proprietário escalar a produção e elevar o Health Score acima de 85/100.
    `;

    try {
      const aiResponse = await this.callGemini(prompt);
      return headerHtml + (aiResponse || '<p>Análise em processamento.</p>') + '</div>';
    } catch (err) {
      return headerHtml + `<p style="color:#ef4444;">Não foi possível carregar o parecer analítico (${err.message}).</p></div>`;
    }
  },

  async generateFinancialComparativeModal(periodLabel, currentMonth, historyMonths) {
    const rev = Number(currentMonth.revenue || 0);
    const exp = Number(currentMonth.expenses || 0);
    const profit = Number(currentMonth.profit || 0);
    const margin = rev > 0 ? ((profit / rev) * 100).toFixed(1) : '0.0';

    const maxVal = Math.max(rev, exp, Math.abs(profit), 100);
    const revPct = Math.min(100, Math.round((rev / maxVal) * 100));
    const expPct = Math.min(100, Math.round((exp / maxVal) * 100));
    const profitPct = Math.min(100, Math.round((Math.abs(profit) / maxVal) * 100));

    const headerHtml = `
      <style>
        .ai-report-body {
          color: var(--dark, #e2e8f0);
          line-height: 1.7;
          font-size: 0.95rem;
        }
        .ai-report-body h3, .ai-report-body h4 {
          color: #3b82f6;
          margin-top: 22px;
          margin-bottom: 10px;
          font-weight: 800;
          font-size: 1.08rem;
        }
        .ai-report-body p {
          margin-bottom: 14px;
          color: var(--dark, #e2e8f0);
        }
        .ai-report-body ul {
          margin-bottom: 18px;
          padding-left: 20px;
        }
        .ai-report-body li {
          margin-bottom: 8px;
          color: var(--dark, #e2e8f0);
        }
        .ai-report-body strong {
          color: #10b981;
        }
        .ai-report-body div {
          color: inherit !important;
          background: transparent !important;
        }
      </style>
      <div style="background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(16,185,129,0.08)); border: 1px solid rgba(59,130,246,0.25); border-radius: 14px; padding: 20px; margin-bottom: 22px;">
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px;">
          <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 10px;">
            <div style="font-size: 0.72rem; color: var(--muted); font-weight: 600; text-transform: uppercase;">Receita Paga</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #3b82f6;">€ ${rev.toFixed(2)}</div>
          </div>
          <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 10px;">
            <div style="font-size: 0.72rem; color: var(--muted); font-weight: 600; text-transform: uppercase;">Custos & Despesas</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #ef4444;">€ ${exp.toFixed(2)}</div>
          </div>
          <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 10px;">
            <div style="font-size: 0.72rem; color: var(--muted); font-weight: 600; text-transform: uppercase;">Lucro Líquido</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: ${profit >= 0 ? '#10b981' : '#ef4444'};">€ ${profit.toFixed(2)}</div>
          </div>
          <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 10px;">
            <div style="font-size: 0.72rem; color: var(--muted); font-weight: 600; text-transform: uppercase;">Margem Líquida</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #10b981;">${margin}%</div>
          </div>
        </div>

        <div style="border-top: 1px solid rgba(59,130,246,0.15); padding-top: 14px;">
          <div style="font-size: 0.8rem; font-weight: 700; color: var(--dark); margin-bottom: 10px;"><i class="ph-bold ph-chart-bar"></i> Gráfico Estrutural do Período (${periodLabel})</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--muted); margin-bottom: 2px;">
                <span>Faturamento</span><span>€ ${rev.toFixed(2)}</span>
              </div>
              <div style="height: 8px; background: rgba(0,0,0,0.06); border-radius: 6px; overflow: hidden;">
                <div style="width: ${revPct}%; background: #3b82f6; height: 100%;"></div>
              </div>
            </div>
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--muted); margin-bottom: 2px;">
                <span>Custos</span><span>€ ${exp.toFixed(2)}</span>
              </div>
              <div style="height: 8px; background: rgba(0,0,0,0.06); border-radius: 6px; overflow: hidden;">
                <div style="width: ${expPct}%; background: #ef4444; height: 100%;"></div>
              </div>
            </div>
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--muted); margin-bottom: 2px;">
                <span>Lucro Líquido</span><span>€ ${profit.toFixed(2)}</span>
              </div>
              <div style="height: 8px; background: rgba(0,0,0,0.06); border-radius: 6px; overflow: hidden;">
                <div style="width: ${profitPct}%; background: #10b981; height: 100%;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="ai-report-body">
    `;

    const historyText = historyMonths.map(m => 
      `• ${m.label}: Faturamento € ${m.revenue.toFixed(2)} | Despesas € ${m.expenses.toFixed(2)} | Lucro Líquido € ${m.profit.toFixed(2)}`
    ).join('\n');

    const prompt = `
Você é o Chief Financial Officer (CFO) e Consultor Financeiro de uma empresa gráfica 3D.
Escreva um RELATÓRIO FINANCEIRO COMPLETO E COMPARATIVO para o período (${periodLabel}).

MÊS SELECIONADO (${periodLabel}):
- Faturamento / Receita Paga: € ${rev.toFixed(2)}
- Custos de Produção e Despesas: € ${exp.toFixed(2)}
- Lucro Líquido Real: € ${profit.toFixed(2)}
- Pedidos Concluídos: ${currentMonth.ordersCompleted || 0}

HISTÓRICO COMPARATIVO DOS MESES ANTERIORES:
${historyText || 'Sem dados históricos anteriores suficientes para comparar.'}

REGRAS DE FIDELIDADE AO FATURAMENTO:
- Seja 100% fiel aos números acima. Se o Faturamento / Receita Paga for maior que zero (€ ${rev.toFixed(2)}), NÃO diga que a empresa teve faturamento zero ou ausência de receita.
- Responda em HTML limpo usando <h4>, <p>, <strong>, <ul> e <li>.
- NÃO gere cartões com fundo branco nem texto branco. O texto deve ser legível.
- DESENVOLVA COMPLETAMENTE TODOS OS 3 TÓPICOS ABAIXO:

<h4>1. Análise Comparativa de Faturamento e Receitas (${periodLabel})</h4>
Analise o desempenho da receita (€ ${rev.toFixed(2)}) no período de ${periodLabel}. Compare com os meses anteriores e explique o comportamento do faturamento.

<h4>2. Estrutura de Custos, Despesas e Margem Líquida (${margin}%)</h4>
Faça uma avaliação crítica sobre os custos da farm (filamento, resina, tempo de máquina, energia) e avalie se a margem líquida atual está saudável.

<h4>3. Ações Financeiras Recomendadas e Oportunidades de Lucro</h4>
Liste 4 estratégias financeiras e de precificação práticas para otimizar margens, reduzir custos variáveis e aumentar a lucratividade da empresa.
    `;

    try {
      const aiResponse = await this.callGemini(prompt);
      return headerHtml + (aiResponse || '<p>Análise em processamento.</p>') + '</div>';
    } catch (err) {
      return headerHtml + `<p style="color:#ef4444;">Não foi possível carregar o parecer financeiro (${err.message}).</p></div>`;
    }
  }
};

window.AIService = AIService;

window.exportAIReportToPDF = async function(elementId, filename) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const btn = window.event?.currentTarget;
  const oldHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i> Gerando PDF...';
  }
  try {
    if (typeof downloadPDF === 'function') {
      await downloadPDF(elementId, filename || 'Relatorio_Estrategico_3DZAAP_AI.pdf');
    } else {
      window.print();
    }
  } catch (e) {
    console.error("Erro ao exportar PDF:", e);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = oldHtml;
    }
  }
};

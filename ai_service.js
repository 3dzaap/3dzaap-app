/**
 * AIService: Handles communication with Google Gemini API (via Supabase Proxy or Direct Client Key).
 */
const AIService = {
  // Modelos robustos para tentar em ordem de prioridade
  models: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-pro', 'gemini-2.0-flash-lite'],

  getCustomKey() {
    return localStorage.getItem('3dzaap_custom_gemini_key') || null;
  },

  setCustomKey(key) {
    if (key && key.trim()) {
      localStorage.setItem('3dzaap_custom_gemini_key', key.trim());
    } else {
      localStorage.removeItem('3dzaap_custom_gemini_key');
    }
  },

  async callGeminiDirect(prompt, apiKey) {
    let lastErr = '';
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
    };

    for (const model of this.models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await resp.json();
        if (resp.ok) {
          return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
        }
        lastErr = data.error?.message || 'Erro no modelo ' + model;
        if (lastErr.toLowerCase().includes('prepayment') || lastErr.toLowerCase().includes('billing') || lastErr.toLowerCase().includes('quota') || resp.status === 403) {
          break;
        }
      } catch (e) {
        lastErr = e.message;
      }
    }
    const err = new Error(lastErr || 'Erro ao chamar API do Gemini');
    if (lastErr.toLowerCase().includes('prepayment') || lastErr.toLowerCase().includes('billing') || lastErr.toLowerCase().includes('quota')) {
      err.isBillingError = true;
    }
    throw err;
  },

  async callGemini(prompt, model = 'gemini-2.0-flash') {
    try {
      const customKey = this.getCustomKey();
      if (customKey) {
        return await this.callGeminiDirect(prompt, customKey);
      }

      // Tentar via Edge Function no Supabase
      const { data: { session } } = await (window._sb ? window._sb.auth.getSession() : { data: { session: null } });
      const headers = {
        'Content-Type': 'application/json'
      };
      if (session && session.access_token) {
        headers['Authorization'] = 'Bearer ' + session.access_token;
      }

      const response = await fetch('https://yjggsndxatezgqljlhxb.supabase.co/functions/v1/gemini-proxy', {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt, model })
      });

      const data = await response.json();

      if (!response.ok) {
        const errMsg = data.error || data.details || 'Erro ao chamar a IA do Supabase';
        const err = new Error(errMsg);
        if (errMsg.toLowerCase().includes('prepayment') || errMsg.toLowerCase().includes('billing') || errMsg.toLowerCase().includes('credits') || errMsg.toLowerCase().includes('quota')) {
          err.isBillingError = true;
        }
        throw err;
      }

      return data ? data.text : null;
    } catch (err) {
      console.error("AIService Error:", err);
      throw err;
    }
  },

  renderApiKeyPrompt(containerEl, onRetry) {
    if (!containerEl) return;
    const currentKey = this.getCustomKey() || '';
    containerEl.innerHTML = `
      <div style="background: rgba(239, 68, 68, 0.08); border: 1.5px solid rgba(239, 68, 68, 0.3); border-radius: 10px; padding: 16px; margin-top: 10px;">
        <div style="display: flex; align-items: center; gap: 8px; color: #ef4444; font-weight: 800; font-size: 0.9rem; margin-bottom: 8px;">
          <i class="ph-bold ph-warning-circle" style="font-size: 1.2rem;"></i> Créditos de IA Depletados ou Chave Ausente
        </div>
        <p style="font-size: 0.82rem; color: var(--subtle, #4A5568); margin-bottom: 12px; line-height: 1.4;">
          A chave do servidor (ou a chave atual) esgotou os créditos gratuitos no Google AI Studio. Para continuar usando a Inteligência Artificial gratuitamente agora mesmo, cole abaixo uma nova <strong>API Key gratuita</strong> gerada em <a href="https://aistudio.google.com" target="_blank" style="color: #3b8fd4; font-weight: 700; text-decoration: underline;">aistudio.google.com</a>:
        </p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <input type="password" id="customGeminiKeyInput" value="${currentKey}" placeholder="Cole a sua API Key (AIzaSy...)" style="flex: 1; min-width: 200px; padding: 8px 12px; border: 1.5px solid var(--border, rgba(0,0,0,0.15)); border-radius: 6px; font-size: 0.85rem; background: var(--bg-card, #fff); color: var(--dark, #1a2332);">
          <button class="btn btn-primary" id="saveGeminiKeyBtn" style="padding: 8px 16px; font-size: 0.82rem; font-weight: 700; background: #3b8fd4; color: #fff; border: none; border-radius: 6px; cursor: pointer;">
            <i class="ph-bold ph-check"></i> Salvar & Tentar Novamente
          </button>
        </div>
      </div>
    `;

    const btn = containerEl.querySelector('#saveGeminiKeyBtn');
    const inp = containerEl.querySelector('#customGeminiKeyInput');
    if (btn && inp) {
      btn.onclick = () => {
        const val = inp.value.trim();
        if (!val) {
          alert('Por favor, insira uma API Key válida do Google Gemini.');
          return;
        }
        this.setCustomKey(val);
        if (typeof onRetry === 'function') onRetry();
      };
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

/**
 * xray_modal.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Modal de Análise Financeira (Raio-X) do Pedido
 * Injecta o HTML e calcula os custos dinamicamente com base nas execuções de impressão.
 */

(function () {
  'use strict';

  let _cfg = {
    getFilaments: () => [],
    formatTime: (t) => String(t),
    fmtCurrency: (v) => v + '€'
  };

  window._XRAY_init = function (config) {
    Object.assign(_cfg, config);
    _XRAY_injectHTML();
  };

  function _XRAY_injectHTML() {
    if (document.getElementById('xrayModalOverlay')) return;
    const div = document.createElement('div');
    div.innerHTML = `
    <div class="modal-overlay" id="xrayModalOverlay" style="display:none; align-items:center; justify-content:center; z-index:10002;">
      <div class="xray-modal">
        <div class="xray-header">
          <div class="xray-title"><i class="ph-bold ph-scan"></i> Raio-X do Pedido <span id="xrOrderNum" style="color:var(--blue)"></span></div>
          <button class="modal-close" onclick="closeOrderXRay()"><i class="ph-bold ph-x"></i></button>
        </div>
        
        <div class="xray-body">
          <div class="xray-top-grid">
            <div class="xray-donut-container" id="xrDonut">
              <div class="xray-donut-hole">
                <div class="xray-margin-pct" id="xrMarginPct">0%</div>
                <div class="xray-margin-lbl">Margem</div>
              </div>
            </div>
            <div class="xray-stats-list">
              <div class="xray-stat-row revenue">
                <div class="xray-stat-lbl"><i class="ph-bold ph-money"></i> Receita Bruta</div>
                <div class="xray-stat-val" id="xrValRevenue">0,00 €</div>
              </div>
              <div class="xray-stat-row profit">
                <div class="xray-stat-lbl"><i class="ph-bold ph-piggy-bank" style="color:var(--success)"></i> Lucro Líquido</div>
                <div class="xray-stat-val" id="xrValProfit" style="color:var(--success)">0,00 €</div>
              </div>
            </div>
          </div>

          <div class="xray-breakdown">
            <div class="xray-breakdown-title">Desagregação de Custos</div>
            <div class="xray-stats-list">
              <div class="xray-stat-row material">
                <div class="xray-stat-lbl"><i class="ph-bold ph-palette"></i> Custo de Material <span id="xrMatDetails" style="color:var(--muted); font-size:0.75rem; margin-left:6px; font-weight:normal"></span></div>
                <div class="xray-stat-val" id="xrValMaterial">0,00 €</div>
              </div>
              <div class="xray-stat-row energy">
                <div class="xray-stat-lbl"><i class="ph-bold ph-lightning"></i> Custos Operacionais <span id="xrOpDetails" style="color:var(--muted); font-size:0.75rem; margin-left:6px; font-weight:normal"></span></div>
                <div class="xray-stat-val" id="xrValOp">0,00 €</div>
              </div>
            </div>
          </div>
        </div>

        <div class="xray-footer">
          <button class="btn btn-ghost" onclick="closeOrderXRay()">Fechar</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(div.firstElementChild);
  }

  window.openOrderXRay = function (order) {
    if (!order) return;

    // Retrieve settings from calculator config in localStorage or use defaults
    const elePrice = parseFloat(localStorage.getItem('3dzaap_config_electricityPrice')) || 0.16;
    const pwrCons = parseFloat(localStorage.getItem('3dzaap_config_powerConsumption')) || 150; // Watts
    const hourlyCost = (pwrCons / 1000) * elePrice;

    // Calculate Materials Cost
    let matCost = 0;
    let totalGrams = 0;
    const filaments = _cfg.getFilaments();

    // Calculate Operational Cost
    let totalPrintTime = 0; // in hours

    const items = order.items || [];
    items.forEach(it => {
      // Find printed quantity
      const printedQty = (it.printRuns && it.printRuns.length) 
        ? it.printRuns.reduce((s, r) => s + (parseInt(r.qty) || 0), 0)
        : parseInt(it.quantity || it.qty || 1); // fallback to requested qty if not printed yet

      // Accumulate time
      const timePerHour = parseFloat(String(it.printTime || '0').replace(',', '.')) || 0;
      totalPrintTime += timePerHour * printedQty;

      // Accumulate material
      const mats = it.materials || (it.filamentId ? [{ filamentId: it.filamentId, weightG: it.weightG }] : []);
      mats.forEach(m => {
        const fil = filaments.find(f => String(f.id) === String(m.filamentId));
        const w = parseFloat(m.weightG) || 0;
        if (fil && fil.price && w > 0) {
           const pricePerGram = parseFloat(fil.price) / 1000;
           matCost += pricePerGram * w * printedQty;
           totalGrams += w * printedQty;
        }
      });
    });

    const opCost = totalPrintTime * hourlyCost;
    const revenue = parseFloat(order.total) || 0;
    const shippingCost = (order.items || []).filter(it => it.tech === 'repasse').reduce((s, it) => s + ((parseInt(it.quantity || it.qty) || 1) * (parseFloat(it.unitPrice) || 0)), 0);

    let profit = revenue - matCost - opCost - shippingCost;
    
    // Safety against negative visual percentages or division by zero
    const rPct = revenue > 0 ? revenue : 1; 
    let pctProfit = (profit / rPct) * 100;
    let pctMat = (matCost / rPct) * 100;
    let pctOp = (opCost / rPct) * 100;
    let pctShip = (shippingCost / rPct) * 100;

    // If costs exceed revenue, cap for the chart so it doesn't break
    if (profit < 0) {
      pctProfit = 0;
      const totalCost = matCost + opCost + shippingCost;
      pctMat = (matCost / totalCost) * 100;
      pctOp = (opCost / totalCost) * 100;
      pctShip = (shippingCost / totalCost) * 100;
    }

    // Update UI
    document.getElementById('xrOrderNum').textContent = order.orderNumber || order.id.slice(0,6);
    document.getElementById('xrValRevenue').textContent = _cfg.fmtCurrency(revenue);
    document.getElementById('xrValProfit').textContent = _cfg.fmtCurrency(profit);
    document.getElementById('xrValProfit').style.color = profit >= 0 ? 'var(--success)' : 'var(--danger)';
    document.getElementById('xrValMaterial').textContent = _cfg.fmtCurrency(matCost);
    document.getElementById('xrValOp').textContent = _cfg.fmtCurrency(opCost);
    
    // Handle shipping cost display dynamically (it might not exist in old DOM without recreating it, but we can check or inject it)
    let shipRow = document.getElementById('xrShippingRow');
    if (!shipRow) {
      const statsList = document.querySelector('.xray-breakdown .xray-stats-list');
      if (statsList) {
        statsList.insertAdjacentHTML('beforeend', `
          <div class="xray-stat-row shipping" id="xrShippingRow" style="display:none">
            <div class="xray-stat-lbl"><i class="ph-bold ph-truck"></i> Custo de Transporte</div>
            <div class="xray-stat-val" id="xrValShipping">0,00 €</div>
          </div>
        `);
        shipRow = document.getElementById('xrShippingRow');
      }
    }
    
    if (shipRow) {
      if (shippingCost > 0) {
        shipRow.style.display = 'flex';
        document.getElementById('xrValShipping').textContent = _cfg.fmtCurrency(shippingCost);
      } else {
        shipRow.style.display = 'none';
      }
    }

    document.getElementById('xrMatDetails').textContent = `(${Math.round(totalGrams)}g no total)`;
    document.getElementById('xrOpDetails').textContent = `(${totalPrintTime.toFixed(1)}h a ~${hourlyCost.toFixed(3)}€/h)`;

    const marginEl = document.getElementById('xrMarginPct');
    marginEl.textContent = Math.round((profit / rPct) * 100) + '%';
    marginEl.style.color = profit >= 0 ? 'var(--success)' : 'var(--danger)';

    // Update Donut Chart CSS
    // Colors: success (profit), orange (material), purple (energy), blue (shipping)
    const cProf = profit >= 0 ? '#22c55e' : '#ef4444';
    const cMat = '#f97316';
    const cOp = '#a855f7';
    const cShip = '#3b82f6';
    
    // Build gradient string (e.g. conic-gradient(#22c55e 0% 70%, #f97316 70% 90%, #a855f7 90% 100%))
    const p1 = Math.round(pctProfit);
    const p2 = p1 + Math.round(pctMat);
    const p3 = p2 + Math.round(pctOp);
    
    const grad = `conic-gradient(${cProf} 0% ${p1}%, ${cMat} ${p1}% ${p2}%, ${cOp} ${p2}% ${p3}%, ${cShip} ${p3}% 100%)`;
    document.getElementById('xrDonut').style.background = grad;

    document.getElementById('xrayModalOverlay').style.display = 'flex';
  };

  window.closeOrderXRay = function () {
    const el = document.getElementById('xrayModalOverlay');
    if (el) el.style.display = 'none';
  };

})();

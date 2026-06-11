/*
 * shipping_modal.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Modal de Envios Parciais — Partilhado entre orders.html e orders_kanban.html.
 */

let _SM_onSave = null;
let _SM_order = null;

// Helpers locais baseados na lógica do sistema
function _SM_itemPrintedQty(item) {
  if (!item.printRuns || !item.printRuns.length) return 0;
  return item.printRuns.reduce((s, r) => s + (parseInt(r.qty) || 0), 0);
}

function _SM_itemShippedQty(order, itemId) {
  if (!order.shipments || !order.shipments.length) return 0;
  let count = 0;
  order.shipments.forEach(ship => {
    if (ship.items) {
      ship.items.forEach(sit => {
        if (sit.itemId === itemId) count += (parseInt(sit.qty) || 0);
      });
    }
  });
  return count;
}

// Inicializa ou injeta a modal no body
function initShippingModal() {
  if (document.getElementById('smOverlay')) return;
  const html = `
    <div class="modal-overlay" id="smOverlay" style="display:none; z-index:10001">
      <div class="modal" style="max-width: 500px;">
        <div class="modal-header">
          <div class="modal-title"><i class="ph-bold ph-package"></i> Novo Envio</div>
          <button class="modal-close" onclick="closeShippingModal()"><i class="ph-bold ph-x"></i></button>
        </div>
        <div class="modal-body" style="padding:16px;">
          <p style="font-size:0.85rem; color:var(--muted); margin-bottom:16px;">
            Selecione quais itens farão parte deste envio e indique a Transportadora e Código de Rastreio.
          </p>

          <div id="smItemsContainer" style="display:flex; flex-direction:column; gap:12px; margin-bottom: 20px;">
            <!-- Itens para enviar populados aqui -->
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Transportadora</label>
              <select id="smCarrier" class="form-select">
                <option value="">Sem transportadora</option>
                <option value="ctt">CTT</option>
                <option value="dpd">DPD</option>
                <option value="nacex">Nacex</option>
                <option value="mrw">MRW</option>
                <option value="dhl">DHL</option>
                <option value="ups">UPS</option>
                <option value="gls">GLS</option>
                <option value="fedex">FedEx</option>
                <option value="outra">Outra (Manual)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Código de Rastreio (Tracking)</label>
              <input type="text" id="smTracking" class="form-input" placeholder="Ex: PT123456789">
            </div>
          </div>
        </div>
        <div class="modal-footer" style="padding:16px; border-top:1px solid var(--border); display:flex; justify-content:flex-end; gap:10px;">
          <button class="btn btn-ghost" onclick="closeShippingModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="saveShippingModal()">
            <i class="ph-bold ph-check"></i> Guardar Envio
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
}

// Renderiza a modal
window.openShippingModal = function(order, onSaveCallback) {
  if (!order || !order.items || order.items.length === 0) {
    if (window.showToast) window.showToast("Este pedido não tem itens.", "err");
    return;
  }
  
  _SM_order = JSON.parse(JSON.stringify(order)); // clone
  _SM_onSave = onSaveCallback;

  initShippingModal();
  document.getElementById('smCarrier').value = '';
  document.getElementById('smTracking').value = '';

  const c = document.getElementById('smItemsContainer');
  c.innerHTML = '';

  let hasShippable = false;

  _SM_order.items.forEach((it, idx) => {
    // Serviços (portes, modelagem) não são enviados
    if (it.tech === 'service') return;

    const totalQty = parseInt(it.quantity || it.qty || 1);
    const printedQty = _SM_itemPrintedQty(it);
    const shippedQty = _SM_itemShippedQty(_SM_order, it.id);
    const shippable = totalQty - shippedQty;

    if (shippable <= 0) return; // already fully shipped

    hasShippable = true;
    const suggestedQty = Math.max(0, printedQty - shippedQty); // what is printed but not shipped
    const isChecked = suggestedQty > 0;

    const itemHtml = `
      <div class="sm-item" style="border:1px solid var(--border); padding:10px 14px; border-radius:8px; display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <label style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:0.85rem; cursor:pointer;">
            <input type="checkbox" id="sm_chk_${idx}" ${isChecked ? 'checked' : ''} style="width:16px; height:16px;">
            ${(it.description || 'Item sem nome').replace(/</g, '&lt;')}
          </label>
          <span style="font-size:0.75rem; color:var(--muted)">Prontos: <strong style="color:var(--text)">${printedQty}/${totalQty}</strong></span>
        </div>
        <div style="display:flex; align-items:center; gap:8px; padding-left:24px;">
          <span style="font-size:0.75rem; color:var(--muted);">Qtd. a enviar:</span>
          <input type="number" id="sm_qty_${idx}" class="form-input" value="${suggestedQty || 1}" min="1" max="${shippable}" style="width:70px; padding:4px 8px; font-size:0.8rem;">
          <span style="font-size:0.75rem; color:var(--muted);">(Faltam enviar: ${shippable})</span>
        </div>
      </div>
    `;
    c.insertAdjacentHTML('beforeend', itemHtml);
  });

  if (!hasShippable) {
    c.innerHTML = '<div style="text-align:center; padding:20px; color:var(--muted); font-size:0.85rem;">Todos os itens deste pedido já foram totalmente enviados.</div>';
    document.querySelector('#smOverlay .btn-primary').disabled = true;
  } else {
    document.querySelector('#smOverlay .btn-primary').disabled = false;
  }

  document.getElementById('smOverlay').style.display = 'flex';
};

window.closeShippingModal = function() {
  const ov = document.getElementById('smOverlay');
  if (ov) ov.style.display = 'none';
  _SM_order = null;
  _SM_onSave = null;
};

window.saveShippingModal = function() {
  if (!_SM_order) return;
  const c = document.getElementById('smItemsContainer');
  
  const shipItems = [];
  _SM_order.items.forEach((it, idx) => {
    const chk = document.getElementById(`sm_chk_${idx}`);
    if (chk && chk.checked) {
      const qtyInput = document.getElementById(`sm_qty_${idx}`);
      const val = parseInt(qtyInput.value) || 0;
      if (val > 0) {
        shipItems.push({ itemId: it.id, qty: val });
      }
    }
  });

  if (shipItems.length === 0) {
    if (window.showToast) window.showToast('Selecione pelo menos um item para envio.', 'err');
    return;
  }

  const carrier = document.getElementById('smCarrier').value;
  const tracking = document.getElementById('smTracking').value.trim();

  const newShipment = {
    id: 'shp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    createdAt: new Date().toISOString(),
    shippingService: carrier,
    trackingCode: tracking,
    items: shipItems
  };

  if (!_SM_order.shipments) _SM_order.shipments = [];
  _SM_order.shipments.push(newShipment);

  // Se estivermos em orders.html com "currentOrder" ou em orders_kanban.html
  closeShippingModal();
  
  if (_SM_onSave) {
    _SM_onSave(_SM_order);
  } else {
    // Fallback: se não houver callback, tentamos atualizar o "currentOrder" e dar re-render
    if (window.currentOrder) {
      window.currentOrder.shipments = _SM_order.shipments;
      if (window.renderShipmentsList) window.renderShipmentsList(window.currentOrder);
      // Salva no formulário atual
      window.currentOrder._changed = true; // flag if we wanted to auto-save
    }
  }
};

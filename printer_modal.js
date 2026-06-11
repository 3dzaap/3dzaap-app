/**
 * printer_modal.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Modal de Atribuição de Impressoras — Partilhado entre orders.html e
 * orders_kanban.html.
 *
 * Cada página injeta o HTML da modal no body (via _PM_injectHTML) e regista
 * os seus callbacks de contexto (via _PM_init) antes de chamar openPrinterModal().
 *
 * API pública:
 *   _PM_init(config)         — chamado 1x por página ao carregar
 *   openPrinterModal(order, oldStatus, mode)
 *   closePrinterModal()
 *   advanceWithoutPrinting()
 *   confirmPrinterModal()
 *   createPartialShipment()
 *   pmUpdateStats()          — chamado pelos handlers inline do HTML gerado
 *   pmAddRunToItem(idx, max) — idem
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  /* ── Estado interno ──────────────────────────────────────── */
  let _order        = null;   // pedido activo na modal
  let _oldStatus    = null;   // estado anterior (para reverter)
  let _mode         = 'enter';// 'enter' | 'exit'

  /* Callbacks injectados por cada página */
  let _cfg = {
    getPrinters   : () => [],
    getFilaments  : () => [],
    onSave        : async (order) => {},   // guarda + atualiza UI
    onRevert      : (order, old) => {},    // reverte estado + atualiza UI
    escH          : (s) => s,
    formatTime    : (t) => String(t),
    parseTime     : (t) => parseFloat(t) || 0,
  };

  /* ── Init (chamado por cada página) ────────────────────────── */
  window._PM_init = function (config) {
    Object.assign(_cfg, config);
    _PM_injectHTML();
  };

  /* ── Injectar HTML da modal no body ────────────────────────── */
  function _PM_injectHTML() {
    if (document.getElementById('pmOverlay')) return; // já existe
    const div = document.createElement('div');
    div.innerHTML = `
  <!-- Printer Assignment Modal — Shared -->
  <div class="modal-overlay" id="pmOverlay"
       style="display:none; align-items:center; justify-content:center; z-index:10001;">
    <div class="modal" style="width:100%; max-width:600px; max-height:90vh; display:flex; flex-direction:column;">
      <div class="modal-header">
        <div class="modal-title" id="pmTitle"></div>
        <button class="modal-close" onclick="closePrinterModal()"><i class="ph-bold ph-x"></i></button>
      </div>

      <div class="modal-body" style="padding:0; overflow-y:auto; display:flex; flex-direction:column;">
        <p id="pmDesc" style="color:var(--muted); font-size:0.85rem; padding:16px 20px 0; margin:0;"></p>

        <!-- Barra de progresso -->
        <div style="padding:14px 20px 12px; background:var(--bg-card-s); border-bottom:1px solid var(--border);
                    display:flex; align-items:center; gap:12px; margin-top:16px;">
          <div style="flex:1">
            <div style="font-size:.72rem; font-weight:800; color:var(--muted); text-transform:uppercase;
                        letter-spacing:.5px; margin-bottom:4px">Progresso do Pedido</div>
            <div style="background:var(--bg-input); border-radius:100px; height:6px; overflow:hidden">
              <div id="pmProgressFill" style="height:100%; background:var(--blue); border-radius:100px;
                   transition:width .5s; width:0%"></div>
            </div>
          </div>
          <div id="pmProgressLbl" style="font-family:var(--mono); font-size:.82rem; font-weight:800;
               color:var(--blue); white-space:nowrap">0 / 0</div>
        </div>

        <!-- Estatísticas -->
        <div style="padding:16px 20px 0;">
          <div class="pt-stats-grid">
            <div class="stat-mini" style="padding:10px; gap:8px">
              <div class="stat-mini-icon si-blue" style="width:28px;height:28px;font-size:.8rem">
                <i class="ph-bold ph-package"></i></div>
              <div style="flex:1;min-width:0">
                <div class="stat-mini-val" id="pmStatItems" style="font-size:1rem">0</div>
                <div class="stat-mini-lbl" style="font-size:.65rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Itens escolhidos</div>
              </div>
            </div>
            <div class="stat-mini" style="padding:10px; gap:8px">
              <div class="stat-mini-icon si-purple" style="width:28px;height:28px;font-size:.8rem">
                <i class="ph-bold ph-printer"></i></div>
              <div style="flex:1;min-width:0">
                <div class="stat-mini-val" id="pmStatPrinters" style="font-size:1rem">0</div>
                <div class="stat-mini-lbl" style="font-size:.65rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Impressoras</div>
              </div>
            </div>
            <div class="stat-mini" style="padding:10px; gap:8px">
              <div class="stat-mini-icon si-orange" style="width:28px;height:28px;font-size:.8rem">
                <i class="ph-bold ph-palette"></i></div>
              <div style="flex:1;min-width:0">
                <div class="stat-mini-val" id="pmStatFilament" style="font-size:1rem">0</div>
                <div class="stat-mini-lbl" style="font-size:.65rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Material (g/ml)</div>
              </div>
            </div>
            <div class="stat-mini" style="padding:10px; gap:8px">
              <div class="stat-mini-icon si-green" style="width:28px;height:28px;font-size:.8rem">
                <i class="ph-bold ph-clock"></i></div>
              <div style="flex:1;min-width:0">
                <div class="stat-mini-val" id="pmStatHours" style="font-size:1rem">0</div>
                <div class="stat-mini-lbl" style="font-size:.65rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Horas Estimadas</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Lista de itens -->
        <div style="padding:16px 20px;">
          <div style="font-size:.72rem; font-weight:800; color:var(--muted); text-transform:uppercase;
               letter-spacing:.5px; margin-bottom:8px">Itens a imprimir nesta sessão</div>
          <div id="pmItemList" style="display:flex; flex-direction:column; gap:8px; padding-right:2px"></div>
        </div>
      </div>

      <div class="modal-footer" style="padding:14px; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; gap:8px;">
          <button class="btn btn-ghost" id="pmSkipBtn" onclick="advanceWithoutPrinting()"
                  style="color:var(--muted); font-size:0.82rem; display:none;">
            <i class="ph-bold ph-fast-forward"></i> Avançar sem imprimir
          </button>
          <button class="btn btn-secondary" id="pmPartialShipBtn" onclick="createPartialShipment()"
                  style="color:var(--blue); font-size:0.82rem; display:none; background:rgba(59,143,212,0.1);">
            <i class="ph-bold ph-package"></i> Fazer Envio Parcial
          </button>
        </div>
        <div style="display:flex; gap:8px; margin-left:auto;">
          <button class="btn btn-ghost" onclick="closePrinterModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="confirmPrinterModal()">
            <i class="ph-bold ph-printer"></i> Guardar sessão
          </button>
        </div>
      </div>
    </div>
  </div>`;
    document.body.appendChild(div.firstElementChild);
  }

  /* ── Helpers internos ────────────────────────────────────────── */
  function _itemPrintedQty(it) {
    return (it.printRuns || []).reduce((s, r) => s + (parseInt(r.qty) || 0), 0);
  }

  function _itemFullyPrinted(it) {
    return _itemPrintedQty(it) >= parseInt(it.quantity || it.qty || 1);
  }

  function _hasPendingItems(order) {
    return (order.items || []).some(it => it.tech !== 'service' && !it.printSkipped && !_itemFullyPrinted(it));
  }

  function _buildPrinterOpts(selectedId) {
    const printers = _cfg.getPrinters();
    let opts = `<option value="">-- Sem impressora --</option>`;
    printers.forEach(p => {
      const sel = String(selectedId) === String(p.id) ? 'selected' : '';
      const pname = _cfg.escH(p.customName || (p.brand + ' ' + p.model).trim() || 'Impressora');
      opts += `<option value="${p.id}" ${sel}>${pname}</option>`;
    });
    return opts;
  }

  function _buildRunRow(globalIdx, runIdx, printerId, qty, maxQty) {
    return `
    <div class="pm-run-row" data-global-idx="${globalIdx}" data-run-idx="${runIdx}"
         style="display:flex; align-items:center; gap:8px; width:100%;">
      <select class="form-input" style="flex:1; padding:6px; font-size:0.85rem; height:auto; min-width:120px;"
              onchange="pmUpdateStats()">
        ${_buildPrinterOpts(printerId)}
      </select>
      <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
        <input type="number" min="0" max="${maxQty}" value="${qty}" placeholder="Qtd"
               class="pm-qty-input"
               style="width:70px; padding:6px; font-size:0.9rem; text-align:center;
                      border:1px solid var(--border); border-radius:6px;
                      background:var(--bg-input); color:var(--text); outline:none;"
               onchange="pmUpdateStats()">
        <span style="font-size:0.8rem; color:var(--muted)">un.</span>
      </div>
      <button type="button" class="btn btn-ghost btn-sm" title="Remover"
              style="color:var(--danger); padding:4px; flex-shrink:0;"
              onclick="const r=this.closest('.pm-run-row');r.remove();pmUpdateStats();">
        <i class="ph-bold ph-x"></i>
      </button>
    </div>`;
  }

  function _renderItemBlock(container, it, globalIdx) {
    const filaments   = _cfg.getFilaments();
    const totalQty    = parseInt(it.quantity || it.qty || 1);
    const printed     = _itemPrintedQty(it);
    const remaining   = Math.max(0, totalQty - printed);
    const isDone      = remaining === 0;

    const runs = it.printRuns && it.printRuns.length ? it.printRuns : [{ printerId: '', qty: totalQty }];
    const displayRuns = _mode === 'exit' && remaining > 0 ? [{ printerId: '', qty: remaining }] : runs;

    const mats    = it.materials || (it.filamentId ? [{ filamentId: it.filamentId, weightG: it.weightG }] : []);
    const matsHtml = mats.map(m => {
      const fil = filaments.find(f => String(f.id) === String(m.filamentId));
      if (!fil) return '';
      const dot  = fil.colorHex
        ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${fil.colorHex};border:1px solid rgba(0,0,0,.15);margin-right:4px"></span>` : '';
      const brand = Array.isArray(fil.brand) ? fil.brand.join(' ') : (fil.brand || '');
      const info  = `${_cfg.escH(fil.colorName||fil.color||'')} - ${_cfg.escH(fil.type||'')} - ${_cfg.escH(brand)}`;
      return `<span style="font-size:.72rem;color:var(--muted);display:inline-flex;align-items:center">${dot}${info} ${m.weightG ? '· ' + m.weightG + 'g/ml' : ''}</span>`;
    }).filter(Boolean).join('<span style="margin:0 4px;color:var(--border)">+</span>');

    let runsHtml = '';
    if (!isDone) {
      runsHtml = `
        <div class="pm-runs" style="margin-top:8px;margin-left:24px;padding-top:8px;
             border-top:1px dashed var(--border);display:flex;flex-direction:column;gap:8px;">
          ${displayRuns.map((r, ri) => _buildRunRow(globalIdx, ri, r.printerId, r.qty, totalQty)).join('')}
        </div>
        <button type="button" class="btn btn-ghost btn-sm"
                style="margin-left:24px;margin-top:4px;font-size:0.75rem;"
                onclick="pmAddRunToItem(${globalIdx}, ${totalQty})">
          <i class="ph-bold ph-plus"></i> Adicionar impressora
        </button>`;
    }

    const block       = document.createElement('div');
    block.className   = `pt-item-card ${isDone ? 'pt-item-done' : ''} pm-item-block`;
    block.style.cssText = 'display:flex;flex-direction:column;gap:8px;position:relative;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px;';
    block.dataset.globalIdx = globalIdx;

    block.innerHTML = `
      <label class="pt-item-check ${isDone ? 'pt-check-disabled' : ''}"
             style="align-items:flex-start;display:flex;gap:8px;">
        <input type="checkbox" class="pt-item-cb"
               data-idx="${globalIdx}"
               ${isDone ? 'disabled' : 'checked'}
               style="accent-color:var(--blue);width:16px;height:16px;margin-top:2px"
               onchange="pmUpdateStats()">
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:.9rem;color:${isDone ? 'var(--muted)' : 'var(--text)'}">
            ${_cfg.escH(it.description || 'Item ' + (globalIdx + 1))}
          </div>
          ${!isDone && matsHtml ? `
            <div style="margin-top:4px;margin-bottom:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              ${matsHtml}
            </div>` : ''}
          ${it.printTime ? `<div style="margin-top:4px;font-size:0.65rem;color:var(--subtle)">
            <i class="ph-bold ph-clock"></i> Tempo estimado: ${_cfg.formatTime(it.printTime)} / peça
          </div>` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0;padding-left:8px">
          <div style="font-family:var(--mono);font-size:.78rem;font-weight:800;color:${isDone ? 'var(--success)' : 'var(--blue)'}">
            ${isDone ? '✅ Impresso' : remaining + ' restantes'}
          </div>
          <div style="font-size:.65rem;color:var(--muted);margin-top:2px">Total: ${totalQty} | Impresso: ${printed}</div>
        </div>
      </label>
      ${runsHtml}`;

    container.appendChild(block);
  }

  /* ── API pública ────────────────────────────────────────────── */

  window.openPrinterModal = function (order, oldStatus, mode = 'enter', onSaveOverride = null, onRevertOverride = null) {
    _order     = order;
    _oldStatus = oldStatus;
    _mode      = mode;
    _order._onSaveOverride = onSaveOverride;
    _order._onRevertOverride = onRevertOverride;

    const listEl = document.getElementById('pmItemList');
    listEl.innerHTML = '';

    if (!order.items || order.items.length === 0) {
      _finalize(false);
      return;
    }

    /* Título, descrição e botão "Avançar sem imprimir" */
    const titleEl = document.getElementById('pmTitle');
    const descEl  = document.getElementById('pmDesc');
    const skipBtn = document.getElementById('pmSkipBtn');
    const shipBtn = document.getElementById('pmPartialShipBtn');

    if (mode === 'enter') {
      titleEl.innerHTML  = '<i class="ph-bold ph-printer" style="color:var(--blue)"></i> Iniciar Produção';
      descEl.textContent = 'Atribua impressoras e quantidades a cada item. Pode dividir a quantidade de um item por várias impressoras.';
      skipBtn.style.display = 'none';
      if (shipBtn) shipBtn.style.display = 'none';
    } else {
      titleEl.innerHTML  = '<i class="ph-bold ph-check-circle" style="color:var(--success,#22c55e)"></i> Concluir Impressão';
      descEl.textContent = 'Alguns itens têm quantidade ainda por imprimir. Complete as atribuições ou avance sem imprimir os itens em falta.';
      skipBtn.style.display = 'flex';
      if (shipBtn) shipBtn.style.display = 'flex';
    }

    /* Itens a mostrar */
    const itemsToShow = mode === 'exit'
      ? order.items.filter(it => it.tech !== 'service' && !it.printSkipped && !_itemFullyPrinted(it))
      : order.items.filter(it => it.tech !== 'service');

    if (itemsToShow.length === 0) {
      _finalize(false);
      return;
    }

    itemsToShow.forEach(it => _renderItemBlock(listEl, it, order.items.indexOf(it)));

    pmUpdateStats();
    document.getElementById('pmOverlay').style.display = 'flex';
  };

  window.closePrinterModal = function () {
    const overlay = document.getElementById('pmOverlay');
    if (overlay) overlay.style.display = 'none';
    if (_order && _oldStatus) {
      _cfg.onRevert(_order, _oldStatus);
    }
    _order = _oldStatus = null;
  };

  window.advanceWithoutPrinting = function () {
    if (!_order) return;
    (_order.items || []).forEach(it => {
      if (!_itemFullyPrinted(it)) it.printSkipped = true;
    });
    _finalize(false);
  };

  window.confirmPrinterModal = function () {
    if (!_order) return;
    _collectRuns(_order);

    if (_mode === 'exit' && _hasPendingItems(_order)) {
      if (typeof showToast === 'function')
        showToast('<i class="ph-bold ph-warning"></i> Atribua as impressoras em falta ou avance sem imprimir.', 'err');
      return;
    }

    _finalize(false);
  };

  /* Chamado pelos handlers inline gerados no HTML */
  window.pmUpdateStats = function () {
    if (!_order || !_order.items) return;

    let totalPrinters = 0, totalFil = 0, totalHours = 0, totalAssignedItems = 0;
    const filaments = _cfg.getFilaments();

    document.querySelectorAll('.pm-item-block').forEach(block => {
      const cb = block.querySelector('.pt-item-cb');
      if (cb && !cb.checked) return;

      const gIdx = parseInt(block.dataset.globalIdx);
      const it   = _order.items[gIdx];
      if (!it) return;

      let printers = 0, qty = 0;
      block.querySelectorAll('.pm-run-row').forEach(row => {
        const q = parseInt(row.querySelector('.pm-qty-input')?.value || 0) || 0;
        if (q > 0) { printers++; qty += q; }
      });

      if (qty > 0) {
        totalAssignedItems += qty;
        totalPrinters      += printers;
        if (it.weightG)    totalFil   += parseFloat(it.weightG)       * qty;
        if (it.printTime)  totalHours += _cfg.parseTime(it.printTime) * qty;
      }
    });

    _el('pmStatItems').textContent    = totalAssignedItems;
    _el('pmStatPrinters').textContent = totalPrinters;
    _el('pmStatFilament').textContent = (totalFil / 1000).toFixed(2);
    _el('pmStatHours').textContent    = (totalHours / 60).toFixed(1);

    const totalItems = _order.items.length;
    const doneItems  = _order.items.filter(it => _itemPrintedQty(it) >= parseInt(it.quantity || 1)).length;
    const progress   = totalItems ? (doneItems / totalItems) * 100 : 0;
    _el('pmProgressFill').style.width = progress + '%';
    _el('pmProgressLbl').textContent  = `${doneItems} / ${totalItems}`;
  };

  window.pmAddRunToItem = function (globalIdx, maxQty) {
    const block = document.querySelector(`.pm-item-block[data-global-idx="${globalIdx}"] .pm-runs`);
    if (!block) return;
    const runCount = block.querySelectorAll('.pm-run-row').length;
    block.insertAdjacentHTML('beforeend', _buildRunRow(globalIdx, runCount, '', 0, maxQty));
    pmUpdateStats();
  };

  /* ── Privado ────────────────────────────────────────────────── */
  function _el(id) { return document.getElementById(id); }

  function _collectRuns(order) {
    document.querySelectorAll('.pm-item-block').forEach(block => {
      const cb   = block.querySelector('.pt-item-cb');
      if (cb && !cb.checked) return;

      const gIdx = parseInt(block.dataset.globalIdx);
      const it   = order.items[gIdx];
      if (!it) return;

      const newRuns = [];
      block.querySelectorAll('.pm-run-row').forEach(row => {
        const pid = row.querySelector('select')?.value || '';
        const qty = parseInt(row.querySelector('.pm-qty-input')?.value || 0) || 0;
        if (qty > 0) newRuns.push({ printerId: pid || null, qty });
      });

      if (_mode === 'exit') {
        it.printRuns = [...(it.printRuns || []), ...newRuns];
      } else {
        it.printRuns = newRuns;
      }
      delete it.printSkipped;
    });
  }

  async function _finalize(revert) {
    const overlay = document.getElementById('pmOverlay');
    if (overlay) overlay.style.display = 'none';

    const order     = _order;
    const oldStatus = _oldStatus;
    _order = _oldStatus = null;

    if (revert && order) {
      if (order._onRevertOverride) {
         order._onRevertOverride(order, oldStatus);
      } else {
         _cfg.onRevert(order, oldStatus);
      }
      delete order._onSaveOverride;
      delete order._onRevertOverride;
      return;
    }

    if (order) {
      if (order._onSaveOverride) {
         await order._onSaveOverride(order);
      } else {
         await _cfg.onSave(order);
      }
      delete order._onSaveOverride;
      delete order._onRevertOverride;
    }
  }

  window.createPartialShipment = async function() {
    if (!_order) return;
    
    // Recolher as quantidades introduzidas no modal
    _collectRuns(_order);
    
    const orderCopy = JSON.parse(JSON.stringify(_order));
    const oldStatus = _oldStatus;
    const isEnter = (_mode === 'enter');
    
    // Guardar as funções de callback para usar depois
    const onSaveOverride = _order._onSaveOverride;
    
    // Fechar a modal de impressão
    const overlay = document.getElementById('pmOverlay');
    if (overlay) overlay.style.display = 'none';

    // Chama a modal de envio
    if (window.openShippingModal) {
      window.openShippingModal(orderCopy, async (updatedOrder) => {
        // Se ainda houver itens pendentes para imprimir, garante que o status fica em printing
        const hasPending = updatedOrder.items.some(it => {
          if (it.tech === 'service') return false;
          if (it.printSkipped) return false;
          const tot = parseInt(it.quantity || it.qty || 1);
          const prt = (it.printRuns || []).reduce((s, r) => s + (parseInt(r.qty) || 0), 0);
          return prt < tot;
        });

        if (hasPending) {
          updatedOrder.status = 'printing';
        }
        updatedOrder._partialShipped = true;
        
        // Grava
        if (onSaveOverride) {
           await onSaveOverride(updatedOrder);
        } else {
           await _cfg.onSave(updatedOrder);
        }
        
        _order = _oldStatus = null;
      });
    } else {
      // Fallback
      if (onSaveOverride) {
         await onSaveOverride(orderCopy);
      } else {
         await _cfg.onSave(orderCopy);
      }
      _order = _oldStatus = null;
    }
  };

})();

/**
 * Lógica de gestión de Pedidos y Exportación
 */

window.currentPedidosStatusFilter = window.currentPedidosStatusFilter || 'all';

async function renderPedidos(isBack = false) {
    if (typeof updateHistoryState === 'function') updateHistoryState('pedidos', isBack);
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Pedidos', {
        extraAction: `
            <button class="btn-header-pill" onclick="openExportPedidosModal()" title="Informe Pedidos">
                <span class="material-icons-round">description</span>
                <span>Informe Pedidos</span>
            </button>
        `
    });

    const orders = await dataManager.getOrders();
    // Ordenar por año descendente y luego por ID descendente
    const sortedOrders = orders.sort((a, b) => {
        const yearA = parseInt(String(a.id).split('-')[0]) || 0;
        const yearB = parseInt(String(b.id).split('-')[0]) || 0;
        if (yearB !== yearA) return yearB - yearA;
        return (b.displayId || 0) - (a.displayId || 0);
    });

    let countAlmacen = 0, countTampo = 0;
    sortedOrders.forEach(o => {
        if (!o.facturadoTodo) {
            if (o.noTampo) countTampo++;
            else countAlmacen++;
        }
    });

    const activeFilter = (window.currentPedidosStatusFilter && window.currentPedidosStatusFilter !== 'servido')
        ? window.currentPedidosStatusFilter
        : 'all';
    window.currentPedidosStatusFilter = activeFilter;

    let contentHtml = '<main class="pedidos-view-main">';

    // Parte fija superior bien distribuida: 1) Filtros de Estado -> 2) Buscador -> 3) Cabecera Tabla
    contentHtml += `
        <div class="pedidos-fixed-controls">
            <!-- 1. Pestañas de Filtro Rápido por Estado (3 columnas simétricas) -->
            <div id="pedidosStatusTabs" class="pedidos-status-tabs">
                <button type="button" data-status-tab="all" onclick="setPedidosStatusFilter('all')"
                        class="pedidos-status-pill ${activeFilter === 'all' ? 'is-active' : ''}"
                        style="border-color: ${activeFilter === 'all' ? '#0f172a' : '#cbd5e1'}; background: ${activeFilter === 'all' ? '#0f172a' : '#ffffff'}; color: ${activeFilter === 'all' ? '#ffffff' : '#334155'};">
                    <span class="pedidos-pill-count" style="color: ${activeFilter === 'all' ? '#ffffff' : '#0f172a'};">${sortedOrders.length}</span>
                    <span class="pedidos-pill-top">
                        <span>Todos</span>
                    </span>
                </button>
                <button type="button" data-status-tab="almacen" onclick="setPedidosStatusFilter('almacen')"
                        class="pedidos-status-pill ${activeFilter === 'almacen' ? 'is-active' : ''}"
                        style="border-color: ${activeFilter === 'almacen' ? '#f59e0b' : '#fde68a'}; background: ${activeFilter === 'almacen' ? '#f59e0b' : '#fffbeb'}; color: ${activeFilter === 'almacen' ? '#ffffff' : '#b45309'};">
                    <span class="pedidos-pill-count" style="color: ${activeFilter === 'almacen' ? '#ffffff' : '#d97706'};">${countAlmacen}</span>
                    <span class="pedidos-pill-top">
                        <span class="pedidos-status-dot" style="background: ${activeFilter === 'almacen' ? '#ffffff' : '#f59e0b'};"></span>
                        <span>Almacén</span>
                    </span>
                </button>
                <button type="button" data-status-tab="tampo" onclick="setPedidosStatusFilter('tampo')"
                        class="pedidos-status-pill ${activeFilter === 'tampo' ? 'is-active' : ''}"
                        style="border-color: ${activeFilter === 'tampo' ? '#2563eb' : '#bfdbfe'}; background: ${activeFilter === 'tampo' ? '#2563eb' : '#eff6ff'}; color: ${activeFilter === 'tampo' ? '#ffffff' : '#1d4ed8'};">
                    <span class="pedidos-pill-count" style="color: ${activeFilter === 'tampo' ? '#ffffff' : '#2563eb'};">${countTampo}</span>
                    <span class="pedidos-pill-top">
                        <span class="pedidos-status-dot" style="background: ${activeFilter === 'tampo' ? '#ffffff' : '#2563eb'};"></span>
                        <span>Falta Tampo</span>
                    </span>
                </button>
            </div>

            <!-- 2. Buscador colocado en la zona intermedia con espacio equilibrado -->
            <div class="pedidos-search-wrap">
                <div class="pro-search-bar pedidos-search-bar">
                    <span class="material-icons-round pro-search-icon">search</span>
                    <input type="text" id="searchPedidosInput" class="pro-search-input" placeholder="Buscar por Nº de pedido o Tienda..." oninput="filterPedidos()" onkeyup="filterPedidos()" onkeydown="if(event.key==='Enter') this.blur()">
                    <div class="pro-search-actions">
                        <button type="button" id="clearPedidosSearchBtn" class="pro-search-clear-btn" style="display: none;" onclick="clearPedidosSearch()" title="Borrar búsqueda">
                            <span class="material-icons-round">close</span>
                        </button>
                        <button type="button" class="pro-search-mic-btn" onclick="window.toggleVoiceDictation('searchPedidosInput', this)" title="Buscar por voz">
                            <span class="material-icons-round">mic</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- 3. Cabecera de Columnas unida directamente al listado -->
            <div class="pedidos-table-header">
                <div>Nº</div>
                <div>TIENDA</div>
                <div style="text-align: right;">IMPORTE</div>
            </div>
        </div>
    `;

    contentHtml += '<div id="pedidosFilterSummaryBar" style="display: none; background: #f8fafc; padding: 8px 20px; border-bottom: 1px solid #e2e8f0; font-size: 11.5px; font-weight: 800; color: #334155; justify-content: space-between; align-items: center;"></div>';
    contentHtml += '<div id="pedidosList" class="pedidos-list" style="background: white;">';
    if (sortedOrders.length === 0) {
        contentHtml += '<div class="text-center p-8 text-gray-400">No hay pedidos registrados</div>';
    } else {
        sortedOrders.forEach(order => {
            const rawAmount = Math.round(parseFloat(order.amount) || 0);
            const amount = formatCurrency(rawAmount);
            
            // Reglas de negocio de colores y estados
            let rowClass = '';
            let statusType = 'almacen';
            if (order.facturadoTodo) {
                rowClass = 'row-green';
                statusType = 'servido';
            } else if (order.noTampo) {
                rowClass = 'row-blue';
                statusType = 'tampo';
            }

            contentHtml += `
                <div class="pedido-row ${rowClass}" data-status="${statusType}" data-amount="${rawAmount}" onclick="openEditOrderModal('${order.id}')">
                    <div class="p-id">${order.displayId}</div>
                    <div class="p-shop">${order.shop}</div>
                    <div class="p-amount">${amount}</div>
                </div>
            `;
        });
    }
    contentHtml += '</div>';

    // Inyectar modales necesarios si no existen
    injectPedidoModals();

    contentHtml += `
        <button class="fab-btn shadow-premium" onclick="openNewOrderModal()" style="bottom: 90px; right: 20px; background: #009ee3 !important;">
            <span class="material-icons-round" style="color: #ffffff !important; font-size: 32px;">add</span>
        </button>
    `;

    contentHtml += '</main>';
    contentHtml += renderBottomNav('pedidos');
    app.innerHTML = headerHtml + contentHtml; if(window.restoreScroll) window.restoreScroll();
    
    if (activeFilter !== 'all') {
        filterPedidos();
    }
    if (window.activeCurrentNav) window.activeCurrentNav('pedidos');
}

function setPedidosStatusFilter(status) {
    const safeStatus = (status && status !== 'servido') ? status : 'all';
    window.currentPedidosStatusFilter = safeStatus;
    const tabs = document.querySelectorAll('#pedidosStatusTabs [data-status-tab]');
    tabs.forEach(btn => {
        const tab = btn.getAttribute('data-status-tab');
        const isActive = tab === safeStatus;
        btn.classList.toggle('is-active', isActive);
        const dot = btn.querySelector('.pedidos-status-dot');
        const badge = btn.querySelector('.pedidos-pill-count');

        if (tab === 'all') {
            btn.style.background = isActive ? '#0f172a' : '#ffffff';
            btn.style.color = isActive ? '#ffffff' : '#334155';
            btn.style.borderColor = isActive ? '#0f172a' : '#cbd5e1';
            if (badge) badge.style.color = isActive ? '#ffffff' : '#0f172a';
        } else if (tab === 'almacen') {
            btn.style.background = isActive ? '#f59e0b' : '#fffbeb';
            btn.style.color = isActive ? '#ffffff' : '#b45309';
            btn.style.borderColor = isActive ? '#f59e0b' : '#fde68a';
            if (dot) dot.style.background = isActive ? '#ffffff' : '#f59e0b';
            if (badge) badge.style.color = isActive ? '#ffffff' : '#d97706';
        } else if (tab === 'tampo') {
            btn.style.background = isActive ? '#2563eb' : '#eff6ff';
            btn.style.color = isActive ? '#ffffff' : '#1d4ed8';
            btn.style.borderColor = isActive ? '#2563eb' : '#bfdbfe';
            if (dot) dot.style.background = isActive ? '#ffffff' : '#2563eb';
            if (badge) badge.style.color = isActive ? '#ffffff' : '#2563eb';
        }
    });
    filterPedidos();
}

function filterPedidos() {
    const input = document.getElementById('searchPedidosInput');
    const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const filter = norm(input ? input.value : '');
    const activeStatus = window.currentPedidosStatusFilter || 'all';
    
    // Usar utilidad global para el botón X
    toggleClearSearch('searchPedidosInput', 'clearPedidosSearchBtn');

    let visibleCount = 0;
    let visibleAmount = 0;

    const rows = document.querySelectorAll('.pedido-row');
    rows.forEach(row => {
        const text = norm(row.innerText);
        const rowStatus = row.getAttribute('data-status') || 'almacen';
        const matchText = !filter || text.includes(filter);
        const matchStatus = activeStatus === 'all' || rowStatus === activeStatus;
        const show = matchText && matchStatus;
        row.style.display = show ? '' : 'none';
        if (show) {
            visibleCount++;
            visibleAmount += parseFloat(row.getAttribute('data-amount')) || 0;
        }
    });

    const summaryBar = document.getElementById('pedidosFilterSummaryBar');
    if (summaryBar) {
        if (activeStatus !== 'all' || filter) {
            const labels = {
                all: 'Filtrados',
                almacen: '🟡 En Almacén (Pendientes de servir)',
                tampo: '🔵 Servidos parcial (Falta Tampo)',
                servido: '🟢 Servidos completos'
            };
            summaryBar.style.display = 'flex';
            summaryBar.innerHTML = `
                <span>${labels[activeStatus] || 'Pedidos'}: <strong>${visibleCount}</strong></span>
                <span>Total: <strong style="color: #0284c7;">${formatCurrency(Math.round(visibleAmount))}</strong></span>
            `;
        } else {
            summaryBar.style.display = 'none';
        }
    }
}

function clearPedidosSearch() {
    clearSearchField('searchPedidosInput', 'clearPedidosSearchBtn', filterPedidos);
}

function injectPedidoModals() {
    if (document.getElementById('newOrderModal')) return;
    
    const modalsHtml = `
    <!-- Modal ¿NUEVO?/Editar Pedido -->
    <div id="newOrderModal" class="modal-overlay new-order-modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="text-xl font-bold">¿NUEVO? Pedido</h2>
                <button class="icon-btn text-white" onclick="closeNewOrderModal()"><span class="material-icons-round">close</span></button>
            </div>
            <div class="modal-body">
                <form id="newOrderForm" onsubmit="event.preventDefault(); saveNewOrder();">
                    <div class="flex gap-4 mb-4">
                        <div class="flex-1">
                            <label class="order-form-label">FECHA</label>
                            <input type="date" id="orderDate" class="order-input" onkeydown="handleOrderFormEnter(event, 'orderId')">
                        </div>
                        <div style="width: 140px;">
                            <label class="order-form-label">Nº</label>
                            <div class="order-input-wrapper">
                                <input type="number" id="orderId" class="order-input" placeholder="Auto" onkeydown="handleOrderFormEnter(event, 'orderClient')">
                                <button type="button" class="btn-auto-plus" onclick="autoIncrementOrderNumber()">+1</button>
                            </div>
                        </div>
                    </div>

                    <div class="order-form-group" style="margin-bottom: 0.75rem;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 4px;">
                            <label class="order-form-label" style="margin: 0;">TIENDA / CLIENTE</label>
                            <div class="flex items-center gap-2" style="transform: translateY(4px);">
                                <span class="toggle-label" style="font-size: 10.5px; font-weight: 900; color: #64748b; letter-spacing: 0.5px;">¿NUEVO?</span>
                                <label class="switch" style="transform: scale(0.7); margin: 0; transform-origin: right center;">
                                    <input type="checkbox" id="isNewClientSwitch">
                                    <span class="slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="pro-search-bar" style="margin-bottom: 0;">
                            <span class="material-icons-round pro-search-icon">search</span>
                            <input type="text" id="orderClient" class="pro-search-input" list="clientsListDatalist" placeholder="Buscar cliente o código..." required onkeydown="handleOrderFormEnter(event, 'orderAmount')" onkeyup="toggleClearSearch('orderClient', 'clearOrderClientBtn')" oninput="toggleClearSearch('orderClient', 'clearOrderClientBtn'); handleClientInputJump(this.value)">
                            <input type="hidden" id="orderClientCode" value="">
                            <div class="pro-search-actions">
                                <button type="button" id="clearOrderClientBtn" class="pro-search-clear-btn" style="display: none;" onclick="clearSearchField('orderClient', 'clearOrderClientBtn'); document.getElementById('orderClientCode').value = ''; document.getElementById('orderClient').focus();" title="Borrar texto">
                                    <span class="material-icons-round">close</span>
                                </button>
                                <button type="button" class="pro-search-mic-btn" onclick="window.toggleVoiceDictation('orderClient', this, (val) => handleClientInputJump(val))" title="Dictar cliente">
                                    <span class="material-icons-round">mic</span>
                                </button>
                            </div>
                            <datalist id="clientsListDatalist"></datalist>
                        </div>
                    </div>

                    <div class="order-form-group" style="margin-bottom: 0.75rem;">
                        <label class="order-form-label">IMPORTE (€)</label>
                        <input type="number" step="0.01" id="orderAmount" class="order-input" placeholder="0" required onkeydown="handleOrderFormEnter(event, 'orderNoTampo')">
                    </div>

                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label class="order-form-label">FACTURADO SIN TAMPO</label>
                            <input type="date" id="orderNoTampo" class="order-input" onkeydown="handleOrderFormEnter(event, 'orderFacturadoTodo')">
                        </div>
                        <div>
                            <label class="order-form-label">FACTURADO TODO</label>
                            <input type="date" id="orderFacturadoTodo" class="order-input" onkeydown="handleOrderFormEnter(event, 'orderComments')">
                        </div>
                    </div>

                    <div class="order-form-group" style="margin-bottom: 0.75rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <label class="order-form-label" style="margin: 0;">COMENTARIOS</label>
                            <button type="button" onclick="window.toggleVoiceDictation('orderComments', this)" style="display: inline-flex; align-items: center; gap: 4px; background: #f0f9ff; color: #0284c7; border: 1px solid #bae6fd; border-radius: 999px; padding: 3px 10px; font-size: 11px; font-weight: 800; cursor: pointer;">
                                <span class="material-icons-round" style="font-size: 15px;">mic</span>
                                <span>Dictar</span>
                            </button>
                        </div>
                        <textarea id="orderComments" class="order-input" rows="2" placeholder="Pulsa 'Dictar' o escribe notas sobre el pedido..." onkeydown="handleOrderFormEnter(event, 'isNewClientSwitch')"></textarea>
                    </div>

                    <!-- PREMIUM FOOTER -->
                    <div style="display: flex; gap: 10px; margin-top: 1.25rem;">
                        <div id="btnDeleteOrder" style="display: none; flex: 0.45 !important; width: auto !important;">
                            <button type="button" style="width: 100%; height: 48px; background: #ffffff !important; border: 2px solid #fee2e2 !important; color: #ef4444 !important; border-radius: 14px !important; cursor: pointer !important; display: flex !important; align-items: center !important; justify-content: center !important; box-sizing: border-box !important;" onclick="deleteCurrentOrder()">
                                <span class="material-icons-round" style="font-size: 22px;">delete_outline</span>
                            </button>
                        </div>
                        <button type="button" style="flex: 1 !important; height: 48px; background: #f1f5f9 !important; border: none !important; color: #64748b !important; border-radius: 14px !important; font-weight: 800 !important; font-size: 14.5px !important; cursor: pointer !important; width: auto !important;" onclick="closeNewOrderModal()">
                            Cancelar
                        </button>
                        <button type="submit" style="flex: 1.2 !important; height: 48px; background: #009ee3 !important; border: none !important; color: #ffffff !important; border-radius: 14px !important; font-weight: 800 !important; font-size: 14.5px !important; cursor: pointer !important; box-shadow: 0 6px 16px rgba(0, 158, 227, 0.25) !important; display: flex !important; align-items: center !important; justify-content: center !important; gap: 6px !important; width: auto !important;">
                            <span class="material-icons-round" style="font-size: 20px;">check</span>
                            Guardar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- Modal Exportar -->
    <div id="exportPedidosModal" class="modal-overlay">
        <div class="modal-content" style="max-width: 450px;">
            <div class="modal-header" style="background-color: #009ee3; padding: 1.25rem 1.5rem;">
                <h2 class="text-xl font-bold">Exportar a Excel</h2>
                <button class="icon-btn text-white" onclick="closeExportPedidosModal()"><span class="material-icons-round">close</span></button>
            </div>
            <div class="modal-body" style="padding: 1.5rem;">
                <p class="text-sm text-slate-500 mb-6" style="line-height: 1.6;">Selecciona los filtros para descargar el historial cruzado con provincias.</p>
                
                <div class="flex gap-4 mb-6">
                    <div class="flex-1">
                        <label class="form-label" style="color: #64748b; font-size: 11px;">FECHA INICIO</label>
                        <div style="position: relative;">
                            <input type="date" id="exportStartDate" class="form-input" style="padding-right: 10px;">
                        </div>
                    </div>
                    <div class="flex-1">
                        <label class="form-label" style="color: #64748b; font-size: 11px;">FECHA FIN</label>
                        <div style="position: relative;">
                            <input type="date" id="exportEndDate" class="form-input" style="padding-right: 10px;">
                        </div>
                    </div>
                </div>

                <div class="mb-6">
                    <label class="form-label" style="color: #64748b; font-size: 11px;">CLIENTE / TIENDA</label>
                    <div class="pro-search-bar" style="margin-bottom: 0;">
                        <span class="material-icons-round pro-search-icon">storefront</span>
                        <input type="text" id="exportFilterClient" class="pro-search-input" placeholder="Opcional: Filtrar por tienda" oninput="toggleClearSearch('exportFilterClient', 'clearExportClientBtn')" onkeyup="toggleClearSearch('exportFilterClient', 'clearExportClientBtn')">
                        <div class="pro-search-actions">
                            <button type="button" id="clearExportClientBtn" class="pro-search-clear-btn" style="display: none;" onclick="clearSearchField('exportFilterClient', 'clearExportClientBtn')">
                                <span class="material-icons-round">close</span>
                            </button>
                            <button type="button" class="pro-search-mic-btn" onclick="window.toggleVoiceDictation('exportFilterClient', this)">
                                <span class="material-icons-round">mic</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="mb-8">
                    <label class="form-label" style="color: #64748b; font-size: 11px;">POBLACIÓN / PROVINCIA</label>
                    <div class="pro-search-bar" style="margin-bottom: 0;">
                        <span class="material-icons-round pro-search-icon">place</span>
                        <input type="text" id="exportFilterLocation" class="pro-search-input" placeholder="Opcional: Ej. Asturias, Madrid..." oninput="toggleClearSearch('exportFilterLocation', 'clearExportLocBtn')" onkeyup="toggleClearSearch('exportFilterLocation', 'clearExportLocBtn')">
                        <div class="pro-search-actions">
                            <button type="button" id="clearExportLocBtn" class="pro-search-clear-btn" style="display: none;" onclick="clearSearchField('exportFilterLocation', 'clearExportLocBtn')">
                                <span class="material-icons-round">close</span>
                            </button>
                            <button type="button" class="pro-search-mic-btn" onclick="window.toggleVoiceDictation('exportFilterLocation', this)">
                                <span class="material-icons-round">mic</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="flex gap-3 mt-4" style="padding-bottom: 0.5rem;">
                    <button class="btn-premium-secondary flex-1" onclick="previewPedidosReport()">
                        <span class="material-icons-round">visibility</span>
                        Previsualizar
                    </button>
                    <button class="btn-action-excel flex-1" onclick="executeExportXlsx()">
                        <span class="material-icons-round">file_download</span>
                        Descargar
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal Previsualización Pedidos -->
    <div id="previewPedidosModal" class="modal-overlay">
        <div class="modal-content" style="max-width: 90%; width: 600px;">
            <div class="modal-header">
                <h2 class="text-xl font-bold">Vista Previa Informe</h2>
                <button class="icon-btn text-white" onclick="document.getElementById('previewPedidosModal').classList.remove('open')">
                    <span class="material-icons-round">close</span>
                </button>
            </div>
            <div id="previewPedidosContent" class="modal-body" style="max-height: 70vh; overflow-y: auto;">
            </div>
        </div>
    </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalsHtml);
    
    // Poblar datalist de clientes
    refreshOrderClientsDatalist();
}

async function refreshOrderClientsDatalist() {
    const clients = await dataManager.getClients();
    window._cachedOrderClients = clients;
    const dl = document.getElementById('clientsListDatalist');
    if (dl) {
        dl.innerHTML = clients.map(c => `<option value="${(c.name || '').replace(/"/g, '&quot;')}" data-code="${c.code}">${c.code ? c.code + ' - ' + (c.location || '') : (c.location || '')}</option>`).join('');
    }
}

function openNewOrderModal() {
    injectPedidoModals();
    refreshOrderClientsDatalist();
    const modal = document.getElementById('newOrderModal');
    modal.style.zIndex = '1250';
    const form = document.getElementById('newOrderForm');
    form.reset();
    const codeInput = document.getElementById('orderClientCode');
    if (codeInput) codeInput.value = '';
    
    const btnDelete = document.getElementById('btnDeleteOrder');
    if (btnDelete) btnDelete.style.display = 'none';
    
    const title = modal.querySelector('h2');
    if (title) title.textContent = '¿NUEVO? Pedido';
    
    document.getElementById('orderDate').value = new Date().toISOString().split('T')[0];
    delete document.getElementById('orderId').dataset.originalId;
    
    modal.classList.add('open');
    // Limpiar botón borrar buscador
    const clearBtn = document.getElementById('clearOrderClientBtn');
    if (clearBtn) clearBtn.style.display = 'none';
}

async function openNewOrderForClient(clientCode) {
    injectPedidoModals();
    await refreshOrderClientsDatalist();
    const client = await dataManager.getClientByCode(clientCode);
    if (!client) return alert('Cliente no encontrado');

    if (typeof closeClientDetailModal === 'function') {
        closeClientDetailModal();
    }

    openNewOrderModal();

    const clientInput = document.getElementById('orderClient');
    const codeInput = document.getElementById('orderClientCode');
    const clearBtn = document.getElementById('clearOrderClientBtn');
    if (clientInput) clientInput.value = client.name || '';
    if (codeInput) codeInput.value = client.code || '';
    if (clearBtn) clearBtn.style.display = 'block';

    // Calcular automáticamente el siguiente Nº de pedido de este año
    await autoIncrementOrderNumber();

    setTimeout(() => {
        const amountInput = document.getElementById('orderAmount');
        if (amountInput) amountInput.focus();
    }, 150);
}

function closeNewOrderModal() {
    const modal = document.getElementById('newOrderModal');
    if (modal) modal.classList.remove('open');
}

async function autoIncrementOrderNumber() {
    const orders = await dataManager.getOrders();
    const dateVal = document.getElementById('orderDate')?.value;
    const selectedYear = getYearFromDate(dateVal) || new Date().getFullYear();
    const ordersInYear = orders.filter(o => {
        const y = o.year || getYearFromDate(o.dateISO || o.date);
        return parseInt(y, 10) === selectedYear;
    });
    const ids = ordersInYear.map(o => parseInt(o.displayId, 10) || 0);
    const nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1;
    const input = document.getElementById('orderId');
    input.value = nextId;
    // Saltar automáticamente al siguiente campo
    document.getElementById('orderClient').focus();
}

function handleOrderFormEnter(event, nextId) {
    if (event.key === 'Enter') {
        event.preventDefault();
        const nextEl = document.getElementById(nextId);
        if (nextEl) nextEl.focus();
    }
}

function handleClientInputJump(val) {
    const dl = document.getElementById('clientsListDatalist');
    if (!dl) return;
    const codeInput = document.getElementById('orderClientCode');
    const clients = window._cachedOrderClients || [];
    const lookup = dataManager.buildClientLookup(clients);
    const matched = dataManager.resolveClientForOrder(val, lookup);

    if (matched) {
        if (codeInput) codeInput.value = matched.code || '';
    } else if (codeInput) {
        codeInput.value = '';
    }

    const options = Array.from(dl.options).map(o => o.value);
    if (options.includes(val)) {
        // La selección es válida, saltar a Importe
        setTimeout(() => {
            const amountInput = document.getElementById('orderAmount');
            if (amountInput) amountInput.focus();
        }, 100);
    }
}

async function saveNewOrder() {
    const date = document.getElementById('orderDate').value;
    const rawShop = document.getElementById('orderClient').value.trim();
    const explicitCode = (document.getElementById('orderClientCode')?.value || '').trim();
    const amount = parseFloat(document.getElementById('orderAmount').value);
    const displayId = parseInt(document.getElementById('orderId').value);
    const noTampo = document.getElementById('orderNoTampo').value;
    const facturadoTodo = document.getElementById('orderFacturadoTodo').value;
    const comments = document.getElementById('orderComments').value;
    const isNewClient = document.getElementById('isNewClientSwitch').checked;

    if (!date || !rawShop || isNaN(amount)) {
        alert('Por favor, rellena los campos obligatorios');
        return;
    }

    // Resolver cliente por código o por nombre (tolerante a espacios y tildes)
    const clients = await dataManager.getClients();
    const lookup = dataManager.buildClientLookup(clients);
    let matchedClient = null;
    if (explicitCode && lookup.byCode.has(explicitCode)) {
        matchedClient = lookup.byCode.get(explicitCode);
        // Verificar que el usuario no haya cambiado el texto manualmente a otra tienda distinta tras seleccionar
        if (normalizeTextKey(matchedClient.name) !== normalizeTextKey(rawShop)) {
            matchedClient = dataManager.resolveClientForOrder(rawShop, lookup);
        }
    } else {
        matchedClient = dataManager.resolveClientForOrder(rawShop, lookup);
    }

    const clientCode = matchedClient ? String(matchedClient.code).trim() : null;
    const shop = matchedClient && matchedClient.name ? matchedClient.name.trim() : rawShop;

    const year = new Date(date).getFullYear();
    const compositeId = `${year}-${displayId}`;
    
    const orderData = {
        id: compositeId,
        displayId,
        date,
        dateISO: new Date(date).toISOString(),
        shop,
        clientCode,
        amount,
        noTampo,
        facturadoTodo,
        comments,
        year,
        persistedIsNewClient: isNewClient
    };

    const originalId = document.getElementById('orderId').dataset.originalId;
    if (originalId && originalId !== compositeId) {
        await dataManager.deleteOrder(originalId);
    }

    await dataManager.createOrder(orderData);
    closeNewOrderModal();
    if (window.currentView === 'mapa' && typeof renderMapa === 'function') {
        renderMapa(true);
    } else if (window.currentView === 'clientes' && typeof renderClientes === 'function') {
        renderClientes(true);
    } else {
        renderPedidos();
    }
}

async function openEditOrderModal(orderId) {
    injectPedidoModals();
    refreshOrderClientsDatalist();
    const order = await dataManager.getOrderById(orderId);
    if (!order) return;

    const modal = document.getElementById('newOrderModal');
    modal.classList.add('open');
    
    const title = modal.querySelector('h2');
    if (title) title.textContent = 'Editar Pedido';
    
    const btnDelete = document.getElementById('btnDeleteOrder');
    if (btnDelete) btnDelete.style.display = 'block';

    // Si el pedido tiene clientCode, mostrar siempre el nombre oficial actualizado del cliente
    let currentShopName = order.shop;
    let currentClientCode = order.clientCode || '';
    if (currentClientCode) {
        const clientObj = await dataManager.getClientByCode(currentClientCode);
        if (clientObj && clientObj.name) {
            currentShopName = clientObj.name;
        }
    }

    document.getElementById('orderDate').value = order.date;
    document.getElementById('orderClient').value = currentShopName;
    const codeInput = document.getElementById('orderClientCode');
    if (codeInput) codeInput.value = currentClientCode;
    document.getElementById('orderAmount').value = order.amount;
    document.getElementById('orderId').value = order.displayId;
    document.getElementById('orderId').dataset.originalId = order.id;
    document.getElementById('orderNoTampo').value = order.noTampo || '';
    document.getElementById('orderFacturadoTodo').value = order.facturadoTodo || '';
    document.getElementById('orderComments').value = order.comments || '';
    document.getElementById('isNewClientSwitch').checked = !!order.persistedIsNewClient;
}

async function deleteCurrentOrder() {
    const idToDelete = document.getElementById('orderId').dataset.originalId;
    if (!idToDelete) return;
    if (!confirm('¿Seguro que quieres eliminar este pedido?')) return;
    
    await dataManager.deleteOrder(idToDelete);
    closeNewOrderModal();
    renderPedidos();
}

function openExportPedidosModal() {
    injectPedidoModals();
    document.getElementById('exportPedidosModal').classList.add('open');
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('exportEndDate').value = today;
    // Por defecto, mostrar todo el año actual para evitar confusión (3 pedidos vs 5)
    const firstDay = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    document.getElementById('exportStartDate').value = firstDay;
}

function closeExportPedidosModal() {
    document.getElementById('exportPedidosModal').classList.remove('open');
}

function _filterOrdersForExport(orders, lookup, start, end, shopQuery, locationQuery) {
    const startD = new Date(start); startD.setHours(0, 0, 0, 0);
    const endD = new Date(end); endD.setHours(23, 59, 59, 999);
    const shopFilter = normalizeTextKey(shopQuery);
    const locationFilter = normalizeTextKey(locationQuery);

    return orders.filter(o => {
        const d = new Date(o.dateISO || o.date);
        if (!(d >= startD && d <= endD)) return false;

        const c = dataManager.resolveClientForOrder(o, lookup) || {};
        const displayShop = normalizeTextKey(c.name || o.shop || '');
        const rawShop = normalizeTextKey(o.shop || '');

        if (shopFilter && !displayShop.includes(shopFilter) && !rawShop.includes(shopFilter)) return false;

        if (locationFilter) {
            const loc = normalizeTextKey(c.location || '');
            const prov = normalizeTextKey(c.province || '');
            if (!loc.includes(locationFilter) && !prov.includes(locationFilter)) return false;
        }
        return true;
    });
}

async function previewPedidosReport() {
    try {
        const start = document.getElementById('exportStartDate').value;
        const end = document.getElementById('exportEndDate').value;
        const shopFilter = document.getElementById('exportFilterClient').value;
        const locationFilter = document.getElementById('exportFilterLocation').value;

        if (!start || !end) return alert("Selecciona fechas para previsualizar");

        const orders = await dataManager.getOrders();
        const clients = await dataManager.getClients();
        const lookup = dataManager.buildClientLookup(clients);

        const filtered = _filterOrdersForExport(orders, lookup, start, end, shopFilter, locationFilter)
            .sort((a,b) => (b.displayId || 0) - (a.displayId || 0));

        const content = document.getElementById('previewPedidosContent');
        const modal = document.getElementById('previewPedidosModal');

        let html = `
            <div class="mb-6 flex gap-3">
                <div class="flex-1 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p class="text-[9px] uppercase font-black tracking-widest text-slate-400 mb-1">Cant. Pedidos</p>
                    <h3 class="text-xl font-black text-slate-800">${filtered.length}</h3>
                </div>
                <div class="flex-1 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                    <p class="text-[9px] uppercase font-black tracking-widest text-blue-400 mb-1">Total Periodo</p>
                    <h3 class="text-xl font-black text-blue-700">${formatCurrency(Math.round(filtered.reduce((sum, o) => sum + (o.amount || 0), 0)))}</h3>
                </div>
            </div>
            <div class="overflow-hidden rounded-xl border border-slate-100">
                <table class="w-full text-xs" style="border-collapse: collapse;">
                    <thead>
                        <tr class="bg-slate-800 text-white font-bold uppercase text-[9px] tracking-wider">
                            <th class="p-3 text-left" style="width: 15%;">Nº</th>
                            <th class="p-3 text-left" style="width: 60%;">TIENDA / CLIENTE</th>
                            <th class="p-3 text-right" style="width: 25%;">IMPORTE</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        filtered.slice(0, 100).forEach(o => {
            html += `
                <tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td class="p-3 font-bold text-slate-400" style="padding-right: 20px;">${o.displayId}</td>
                    <td class="p-3 font-black text-slate-700 uppercase tracking-tight" style="padding-right: 20px;">${o.shop}</td>
                    <td class="p-3 text-right font-black text-slate-900">${formatCurrency(Math.round(o.amount || 0))}</td>
                </tr>
            `;
        });

        if (filtered.length > 100) html += `<tr><td colspan="3" class="p-4 text-center text-slate-400 italic">Previsualización limitada a los primeros 100 pedidos.</td></tr>`;
        if (filtered.length === 0) html += `<tr><td colspan="3" class="p-12 text-center text-slate-400 font-bold">No hay pedidos registrados en estas fechas.</td></tr>`;

        html += '</tbody></table></div>';
        content.innerHTML = html;
        modal.classList.add('open');
    } catch (e) {
        console.error(e);
        alert("Error al cargar previsualización");
    }
}

async function executeExportXlsx() {
    try {
        const start = document.getElementById('exportStartDate').value;
        const end = document.getElementById('exportEndDate').value;
        const shopFilter = document.getElementById('exportFilterClient').value;
        const locationFilter = document.getElementById('exportFilterLocation').value;

        if (!start || !end) return alert("Selecciona fechas para exportar");

        const orders = await dataManager.getOrders();
        const clients = await dataManager.getClients();
        const lookup = dataManager.buildClientLookup(clients);

        const filtered = _filterOrdersForExport(orders, lookup, start, end, shopFilter, locationFilter)
            .sort((a,b) => (a.displayId || 0) - (b.displayId || 0));

        if (filtered.length === 0) return alert("No hay pedidos para este filtro");

        const wb = XLSX.utils.book_new();
        const data = filtered.map(o => {
            const c = dataManager.resolveClientForOrder(o, lookup) || {};
            return {
                "Nº": o.displayId || String(o.id).split('-').pop(),
                "FECHA": new Date(o.dateISO || o.date).toLocaleDateString('es-ES'),
                "TIENDA": (c.name || o.shop || '').toUpperCase(),
                "IMPORTE": Math.round(o.amount || 0),
                "PROVINCIA": (c.province || "---").toUpperCase(),
                "POBLACIÓN": (c.location || "---").toUpperCase(),
                "NOTAS": o.comments || ''
            };
        });

        const ws = XLSX.utils.json_to_sheet(data);
        
        // Aplicar formatos profesionales idénticos al informe estratégico
        const range = XLSX.utils.decode_range(ws['!ref']);
        const colWidths = [];

        for (let C = range.s.c; C <= range.e.c; ++C) {
            let maxWidth = 10;
            for (let R = range.s.r; R <= range.e.r; ++R) {
                const addr = XLSX.utils.encode_cell({ r: R, c: C });
                if (!ws[addr]) continue;
                
                // Centrado total
                ws[addr].s = {
                    alignment: { horizontal: "center", vertical: "center" }
                };

                // Formato de número: Separador de miles (#,##0)
                if (ws[addr].t === 'n') {
                    ws[addr].z = '#,##0';
                }

                // Encabezados en negrita y color suave
                if (R === 0) {
                    ws[addr].s.font = { bold: true };
                    ws[addr].s.fill = { fgColor: { rgb: "F1F5F9" } };
                    ws[addr].s.border = { bottom: { style: "thin" } };
                }

                const val = ws[addr].v ? String(ws[addr].v) : "";
                if (val.length > maxWidth) maxWidth = val.length;
            }
            colWidths.push({ wch: maxWidth + 4 });
        }
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, "Base de Datos Pedidos");
        XLSX.writeFile(wb, `Informe_Pedidos_${start}_al_${end}.xlsx`);
        closeExportPedidosModal();
    } catch (e) {
        console.error(e);
        alert("Error exportando a Excel");
    }
}

// Globales
window.renderPedidos = renderPedidos;
window.filterPedidos = filterPedidos;
window.setPedidosStatusFilter = setPedidosStatusFilter;
window.openNewOrderModal = openNewOrderModal;
window.openNewOrderForClient = openNewOrderForClient;
window.closeNewOrderModal = closeNewOrderModal;
window.saveNewOrder = saveNewOrder;
window.deleteCurrentOrder = deleteCurrentOrder;
window.openEditOrderModal = openEditOrderModal;
window.autoFillOrderId = autoFillOrderId;
window.openExportPedidosModal = openExportPedidosModal;
window.closeExportPedidosModal = closeExportPedidosModal;
window.executeExportXlsx = executeExportXlsx;
window.previewPedidosReport = previewPedidosReport;
window.clearPedidosSearch = clearPedidosSearch;
window.injectPedidoModals = injectPedidoModals;







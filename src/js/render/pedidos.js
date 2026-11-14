/**
 * Lógica de gestión de Pedidos y Exportación
 */

window.currentPedidosStatusFilter = window.currentPedidosStatusFilter || 'all';

function escapePedidosHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizePedidosSearch(text) {
    return String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function toInputDateValue(dateValue) {
    if (!dateValue) return '';
    const str = String(dateValue).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    if (str.includes('T') && /^\d{4}-\d{2}-\d{2}/.test(str)) {
        return str.split('T')[0];
    }
    if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3 && parts[2].length === 4) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    }
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
}

function getOrderPendingTampoAmount(order) {
    const total = parseFloat(order && order.amount) || 0;
    const partial = Math.max(0, parseFloat(order && order.noTampoAmount) || 0);
    return Math.max(0, total - partial);
}

function formatPedidoShortDate(dateValue) {
    if (!dateValue) return '';
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
}

function formatPedidoDayMonth(dateValue) {
    if (!dateValue) return '';
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
}

async function renderPedidos(isBack = false) {
    if (typeof updateHistoryState === 'function') updateHistoryState('pedidos', isBack);
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Pedidos', {
        extraAction: `
            <button class="btn-header-pill btn-pedidos-report-pill" onclick="openExportPedidosModal()" title="Informe Pedidos">
                <span class="material-icons-round">description</span>
                <span class="btn-pedidos-report-label">Informe</span>
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

    let countAlmacen = 0, sumAlmacen = 0;
    let countTampo = 0, sumTampo = 0;
    sortedOrders.forEach(o => {
        if (!o.facturadoTodo) {
            if (o.noTampo) {
                countTampo++;
                sumTampo += getOrderPendingTampoAmount(o);
            } else {
                countAlmacen++;
                sumAlmacen += parseFloat(o.amount) || 0;
            }
        }
    });

    let contentHtml = '<main class="pedidos-view-main">';

    // Parte fija superior: 1) Resumen siempre visible (Almacén y Falta Tampo) -> 2) Buscador -> 3) Cabecera del listado
    contentHtml += `
        <div class="pedidos-fixed-controls">
            <div class="pedidos-summary-grid">
                <div class="pedidos-kpi-card is-almacen">
                    <div class="pedidos-kpi-top">
                        <span class="pedidos-kpi-label">
                            <span class="pedidos-status-dot"></span>
                            <span>Almacén</span>
                        </span>
                        <span class="pedidos-kpi-count">${countAlmacen} ${countAlmacen === 1 ? 'ped.' : 'peds.'}</span>
                    </div>
                    <div class="pedidos-kpi-amount">${formatCurrency(Math.round(sumAlmacen))}</div>
                </div>
                <div class="pedidos-kpi-card is-tampo">
                    <div class="pedidos-kpi-top">
                        <span class="pedidos-kpi-label">
                            <span class="pedidos-status-dot"></span>
                            <span>Falta Tampo</span>
                        </span>
                        <span class="pedidos-kpi-count">${countTampo} ${countTampo === 1 ? 'ped.' : 'peds.'}</span>
                    </div>
                    <div class="pedidos-kpi-amount">${formatCurrency(Math.round(sumTampo))}</div>
                </div>
            </div>

            <div class="pedidos-search-wrap">
                <div class="pro-search-bar pedidos-search-bar">
                    <span class="material-icons-round pro-search-icon">search</span>
                    <input type="text" id="searchPedidosInput" class="pro-search-input" placeholder="Buscar por Nº de pedido o Tienda..." oninput="filterPedidos()" onkeydown="if(event.key==='Enter') this.blur()">
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

            <div class="pedidos-table-header">
                <div>Nº · TIENDA / FECHA (${sortedOrders.length})</div>
                <div style="text-align: right;">IMPORTE</div>
            </div>
        </div>
    `;

    contentHtml += '<div id="pedidosFilterSummaryBar" class="pedidos-filter-summary-bar" style="display: none;"></div>';
    contentHtml += '<div id="pedidosList" class="pedidos-list">';
    if (sortedOrders.length === 0) {
        contentHtml += '<div class="text-center p-8 text-gray-400">No hay pedidos registrados</div>';
    } else {
        sortedOrders.forEach(order => {
            const totalFloat = parseFloat(order.amount) || 0;
            const rawAmount = Math.round(totalFloat);
            const amount = formatCurrency(rawAmount);
            const noTampoAmt = Math.max(0, parseFloat(order.noTampoAmount) || 0);
            const pendingTampoAmt = getOrderPendingTampoAmount(order);
            const shortDate = formatPedidoShortDate(order.dateISO || order.date) || '--/--/--';
            const cleanComment = String(order.comments || '').trim();
            const sinTampoFull = formatPedidoShortDate(order.noTampo);
            const sinTampoDM = formatPedidoDayMonth(order.noTampo);
            const todoFull = formatPedidoShortDate(order.facturadoTodo);
            const todoDM = formatPedidoDayMonth(order.facturadoTodo);

            let statusType = 'almacen';
            let statusClass = 'status-almacen';
            let statusHtml = `<span class="pedido-status-badge status-almacen">Almacén</span>`;
            let statusSearchLabel = 'Almacén';
            let amountSubHtml = '';

            if (order.facturadoTodo) {
                statusType = 'servido';
                statusClass = 'status-servido';
                if (order.noTampo && sinTampoDM && todoDM) {
                    statusSearchLabel = `Sin tampo ${sinTampoDM} Tampo ${todoDM}`;
                    statusHtml = `<span class="pedido-status-badge status-servido">Sin tampo ${sinTampoDM} · Tampo ${todoDM}</span>`;
                } else if (todoFull) {
                    statusSearchLabel = `Facturado ${todoFull}`;
                    statusHtml = `<span class="pedido-status-badge status-servido">Facturado · ${todoFull}</span>`;
                } else {
                    statusSearchLabel = 'Facturado';
                    statusHtml = `<span class="pedido-status-badge status-servido">Facturado</span>`;
                }
            } else if (order.noTampo) {
                statusType = 'tampo';
                statusClass = 'status-tampo';
                statusSearchLabel = `Sin Tampo ${sinTampoFull} Falta el Tampo`;
                const sinTampoLabel = sinTampoFull
                    ? (noTampoAmt > 0
                        ? `Sin Tampo ${sinTampoFull} · ${formatCurrency(Math.round(noTampoAmt))}`
                        : `Sin Tampo ${sinTampoFull}`)
                    : '';
                const sinTampoChip = sinTampoLabel
                    ? `<span class="pedido-status-badge status-tampo-soft">${sinTampoLabel}</span>`
                    : '';
                statusHtml = `${sinTampoChip}<span class="pedido-status-badge status-tampo">Falta el Tampo</span>`;
                if (noTampoAmt > 0) {
                    amountSubHtml = `<div class="p-amount-pending">Falta ${formatCurrency(Math.round(pendingTampoAmt))}</div>`;
                }
            }

            const searchIndex = normalizePedidosSearch(
                `${order.displayId || ''} ${order.shop || ''} ${shortDate} ${cleanComment} ${statusSearchLabel} ${rawAmount}`
            );

            contentHtml += `
                <div class="pedido-row ${statusClass}" data-status="${statusType}" data-amount="${rawAmount}" data-search="${escapePedidosHtml(searchIndex)}" onclick="openEditOrderModal('${order.id}')">
                    <div class="pedido-card-main">
                        <div class="pedido-card-top">
                            <span class="pedido-num-pill">${escapePedidosHtml(order.displayId)}</span>
                            <span class="p-shop">${escapePedidosHtml(order.shop)}</span>
                        </div>
                        <div class="pedido-card-meta">
                            <span class="pedido-meta-date">
                                <span class="material-icons-round">calendar_today</span>
                                <span>${shortDate}</span>
                            </span>
                            ${statusHtml}
                        </div>
                        ${cleanComment ? `<div class="pedido-card-note">${escapePedidosHtml(cleanComment)}</div>` : ''}
                    </div>
                    <div class="p-amount-col">
                        <div class="p-amount">${amount}</div>
                        ${amountSubHtml}
                    </div>
                </div>
            `;
        });
    }
    contentHtml += '</div>';

    // Inyectar modales necesarios si no existen
    injectPedidoModals();

    contentHtml += `
        <button class="fab-btn shadow-premium pedidos-fab-add" onclick="openNewOrderModal()" title="Nuevo pedido">
            <span class="material-icons-round">add</span>
        </button>
    `;

    contentHtml += '</main>';
    contentHtml += renderBottomNav('pedidos');
    app.innerHTML = headerHtml + contentHtml; if(window.restoreScroll) window.restoreScroll();
    
    if (window.activeCurrentNav) window.activeCurrentNav('pedidos');
}

function setPedidosStatusFilter() {
    // Mantenido por compatibilidad: la lista completa se muestra siempre sin filtros de estado
    filterPedidos();
}

function filterPedidos() {
    const input = document.getElementById('searchPedidosInput');
    const filter = normalizePedidosSearch(input ? input.value : '');
    
    // Usar utilidad global para el botón X
    toggleClearSearch('searchPedidosInput', 'clearPedidosSearchBtn');

    let visibleCount = 0;
    let visibleAmount = 0;

    const rows = document.querySelectorAll('.pedido-row');
    rows.forEach(row => {
        const searchData = row.dataset.search || '';
        const show = !filter || searchData.includes(filter);
        row.classList.toggle('is-hidden', !show);
        if (show) {
            visibleCount++;
            visibleAmount += parseFloat(row.getAttribute('data-amount')) || 0;
        }
    });

    const summaryBar = document.getElementById('pedidosFilterSummaryBar');
    if (summaryBar) {
        if (filter) {
            summaryBar.style.display = 'flex';
            summaryBar.innerHTML = `
                <span>Resultados: <strong>${visibleCount}</strong></span>
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
    <!-- Modal Nuevo / Editar Pedido -->
    <div id="newOrderModal" class="modal-overlay new-order-modal">
        <div class="modal-content">
            <div class="modal-header order-modal-header">
                <div class="order-modal-head-left">
                    <div class="order-modal-head-icon">
                        <span class="material-icons-round" id="orderModalHeadIcon">receipt_long</span>
                    </div>
                    <div class="order-modal-head-text">
                        <h2 id="orderModalTitle" class="order-modal-title">Nuevo Pedido</h2>
                        <p id="orderModalSubtitle" class="order-modal-subtitle">Completa los datos del pedido</p>
                    </div>
                </div>
                <button type="button" class="order-modal-close-btn" onclick="closeNewOrderModal()" title="Cerrar">
                    <span class="material-icons-round">close</span>
                </button>
            </div>

            <form id="newOrderForm" class="order-modal-form" onsubmit="event.preventDefault(); saveNewOrder();">
                <div class="modal-body order-modal-body">
                    <!-- Sección 1: Datos principales -->
                    <section class="order-section-card">
                        <div class="order-section-header">
                            <span class="order-section-title">
                                <span class="material-icons-round">shopping_bag</span>
                                <span>Datos del Pedido</span>
                            </span>
                        </div>

                        <div class="order-top-grid">
                            <div class="order-field">
                                <label class="order-form-label" for="orderDate">FECHA</label>
                                <input type="date" id="orderDate" class="order-input" onkeydown="handleOrderFormEnter(event, 'orderId')">
                            </div>
                            <div class="order-field">
                                <label class="order-form-label" for="orderId">Nº PEDIDO</label>
                                <div class="order-input-wrapper">
                                    <input type="number" id="orderId" class="order-input" placeholder="Auto" oninput="updateOrderModalSubtitle()" onkeydown="handleOrderFormEnter(event, 'orderClient')">
                                    <button type="button" class="btn-auto-plus" onclick="autoIncrementOrderNumber()" title="Siguiente número">+1</button>
                                </div>
                            </div>
                        </div>

                        <div class="order-field">
                            <div class="order-field-head">
                                <label class="order-form-label" for="orderClient">TIENDA / CLIENTE</label>
                                <label class="order-new-client-pill" title="Marcar si es cliente nuevo">
                                    <span class="order-new-client-text">¿Cliente nuevo?</span>
                                    <span class="switch">
                                        <input type="checkbox" id="isNewClientSwitch">
                                        <span class="slider"></span>
                                    </span>
                                </label>
                            </div>
                            <div class="pro-search-bar" style="margin-bottom: 0;">
                                <span class="material-icons-round pro-search-icon">search</span>
                                <input type="text" id="orderClient" class="pro-search-input" list="clientsListDatalist" placeholder="Buscar cliente o código..." required onkeydown="handleOrderFormEnter(event, 'orderAmount')" onkeyup="toggleClearSearch('orderClient', 'clearOrderClientBtn')" oninput="toggleClearSearch('orderClient', 'clearOrderClientBtn'); handleClientInputJump(this.value); updateOrderModalSubtitle()">
                                <input type="hidden" id="orderClientCode" value="">
                                <div class="pro-search-actions">
                                    <button type="button" id="clearOrderClientBtn" class="pro-search-clear-btn" style="display: none;" onclick="clearSearchField('orderClient', 'clearOrderClientBtn'); document.getElementById('orderClientCode').value = ''; updateOrderModalSubtitle(); document.getElementById('orderClient').focus();" title="Borrar texto">
                                        <span class="material-icons-round">close</span>
                                    </button>
                                    <button type="button" class="pro-search-mic-btn" onclick="window.toggleVoiceDictation('orderClient', this, (val) => { handleClientInputJump(val); updateOrderModalSubtitle(); })" title="Dictar cliente">
                                        <span class="material-icons-round">mic</span>
                                    </button>
                                </div>
                                <datalist id="clientsListDatalist"></datalist>
                            </div>
                        </div>

                        <div class="order-field">
                            <label class="order-form-label" for="orderAmount">IMPORTE TOTAL</label>
                            <div class="order-currency-box">
                                <input type="number" step="0.01" inputmode="decimal" id="orderAmount" class="order-input order-currency-input" placeholder="0" required oninput="syncOrderBillingUI()" onkeydown="handleOrderFormEnter(event, 'orderNoTampo')">
                                <span class="order-currency-unit">€</span>
                            </div>
                        </div>
                    </section>

                    <!-- Sección 2: Estado de facturación -->
                    <section class="order-section-card order-billing-card">
                        <div class="order-section-header">
                            <span class="order-section-title">
                                <span class="material-icons-round">receipt</span>
                                <span>Facturación</span>
                            </span>
                            <span id="orderStatusPreviewBadge" class="order-status-pill is-almacen">En Almacén</span>
                        </div>

                        <!-- Sub-bloque: Facturado sin tampo -->
                        <div id="noTampoBlock" class="order-billing-block">
                            <div class="order-field">
                                <label class="order-form-label" for="orderNoTampo">FACTURADO SIN TAMPO (FECHA)</label>
                                <div class="order-date-row">
                                    <input type="date" id="orderNoTampo" class="order-input" oninput="syncOrderBillingUI()" onchange="syncOrderBillingUI()" onkeydown="handleOrderFormEnter(event, 'orderNoTampoAmount')">
                                    <button type="button" id="clearNoTampoDateBtn" class="order-date-clear-btn" onclick="clearOrderDateField('orderNoTampo')" title="Quitar fecha sin tampo">
                                        <span class="material-icons-round">close</span>
                                    </button>
                                </div>
                            </div>

                            <div id="noTampoAmountGroup" class="order-no-tampo-amount-panel" hidden>
                                <div class="order-field">
                                    <label class="order-form-label" for="orderNoTampoAmount">IMPORTE FACTURADO SIN TAMPO (€)</label>
                                    <div class="order-currency-box">
                                        <input type="number" step="0.01" min="0" inputmode="decimal" id="orderNoTampoAmount" class="order-input order-currency-input" placeholder="0" oninput="syncOrderBillingUI()" onkeydown="handleOrderFormEnter(event, 'orderFacturadoTodo')">
                                        <span class="order-currency-unit">€</span>
                                    </div>
                                </div>
                                <div id="noTampoRemainingPreview" class="order-tampo-calc-bar">
                                    <span>Falta por salir (Tampo):</span>
                                    <strong>0 €</strong>
                                </div>
                            </div>
                        </div>

                        <!-- Sub-bloque: Facturado todo -->
                        <div id="facturadoTodoBlock" class="order-billing-block">
                            <div class="order-field">
                                <label class="order-form-label" for="orderFacturadoTodo">FACTURADO TODO (FECHA)</label>
                                <div class="order-date-row">
                                    <input type="date" id="orderFacturadoTodo" class="order-input" oninput="syncOrderBillingUI()" onchange="syncOrderBillingUI()" onkeydown="handleOrderFormEnter(event, 'orderComments')">
                                    <button type="button" id="clearFacturadoTodoDateBtn" class="order-date-clear-btn" onclick="clearOrderDateField('orderFacturadoTodo')" title="Quitar fecha facturado todo">
                                        <span class="material-icons-round">close</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- Sección 3: Comentarios -->
                    <section class="order-section-card">
                        <div class="order-section-header">
                            <span class="order-section-title">
                                <span class="material-icons-round">notes</span>
                                <span>Comentarios</span>
                            </span>
                            <button type="button" class="order-dictate-btn" onclick="window.toggleVoiceDictation('orderComments', this)">
                                <span class="material-icons-round">mic</span>
                                <span>Dictar</span>
                            </button>
                        </div>
                        <textarea id="orderComments" class="order-input order-textarea" rows="2" placeholder="Pulsa 'Dictar' o escribe notas sobre el pedido..."></textarea>
                    </section>
                </div>

                <!-- Pie fijo de acciones -->
                <div class="order-modal-footer">
                    <div id="btnDeleteOrder" class="order-btn-delete-wrap">
                        <button type="button" class="order-btn-delete" onclick="deleteCurrentOrder()" title="Eliminar pedido">
                            <span class="material-icons-round" style="font-size: 22px;">delete_outline</span>
                        </button>
                    </div>
                    <button type="button" class="order-btn-cancel" onclick="closeNewOrderModal()">
                        Cancelar
                    </button>
                    <button type="submit" class="order-btn-save">
                        <span class="material-icons-round" style="font-size: 20px;">check</span>
                        <span>Guardar</span>
                    </button>
                </div>
            </form>
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

function updateOrderModalSubtitle() {
    const subtitleEl = document.getElementById('orderModalSubtitle');
    if (!subtitleEl) return;
    const idVal = (document.getElementById('orderId')?.value || '').trim();
    const clientVal = (document.getElementById('orderClient')?.value || '').trim();
    if (idVal && clientVal) {
        subtitleEl.textContent = `Pedido #${idVal} · ${clientVal}`;
    } else if (clientVal) {
        subtitleEl.textContent = clientVal;
    } else if (idVal) {
        subtitleEl.textContent = `Pedido #${idVal}`;
    } else {
        subtitleEl.textContent = 'Completa los datos del pedido';
    }
}

function clearOrderDateField(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.value = '';
    if (inputId === 'orderNoTampo') {
        const partialInput = document.getElementById('orderNoTampoAmount');
        if (partialInput) {
            partialInput.value = '';
            if (typeof partialInput._syncClearBtn === 'function') partialInput._syncClearBtn();
        }
    }
    syncOrderBillingUI();
}

function syncOrderBillingUI() {
    const amountEl = document.getElementById('orderAmount');
    const noTampoEl = document.getElementById('orderNoTampo');
    const noTampoAmountEl = document.getElementById('orderNoTampoAmount');
    const facturadoTodoEl = document.getElementById('orderFacturadoTodo');

    const clearNoTampoBtn = document.getElementById('clearNoTampoDateBtn');
    const clearTodoBtn = document.getElementById('clearFacturadoTodoDateBtn');
    const noTampoAmountGroup = document.getElementById('noTampoAmountGroup');
    const noTampoBlock = document.getElementById('noTampoBlock');
    const facturadoTodoBlock = document.getElementById('facturadoTodoBlock');
    const statusBadge = document.getElementById('orderStatusPreviewBadge');
    const remainingBar = document.getElementById('noTampoRemainingPreview');

    const hasNoTampo = !!(noTampoEl && noTampoEl.value);
    const hasFacturadoTodo = !!(facturadoTodoEl && facturadoTodoEl.value);
    const totalAmount = parseFloat(amountEl ? amountEl.value : '') || 0;
    const partialAmount = Math.max(0, parseFloat(noTampoAmountEl ? noTampoAmountEl.value : '') || 0);

    if (clearNoTampoBtn) clearNoTampoBtn.style.display = hasNoTampo ? 'inline-flex' : 'none';
    if (clearTodoBtn) clearTodoBtn.style.display = hasFacturadoTodo ? 'inline-flex' : 'none';

    if (noTampoAmountGroup) {
        noTampoAmountGroup.hidden = !hasNoTampo;
    }

    if (noTampoBlock) {
        noTampoBlock.classList.toggle('is-active-tampo', hasNoTampo && !hasFacturadoTodo);
    }
    if (facturadoTodoBlock) {
        facturadoTodoBlock.classList.toggle('is-active-servido', hasFacturadoTodo);
    }

    if (statusBadge) {
        statusBadge.classList.remove('is-almacen', 'is-tampo', 'is-servido');
        if (hasFacturadoTodo) {
            statusBadge.classList.add('is-servido');
            statusBadge.textContent = 'Facturado Todo';
        } else if (hasNoTampo) {
            statusBadge.classList.add('is-tampo');
            statusBadge.textContent = 'Falta Tampo';
        } else {
            statusBadge.classList.add('is-almacen');
            statusBadge.textContent = 'En Almacén';
        }
    }

    if (remainingBar && hasNoTampo) {
        if (totalAmount > 0 && partialAmount > totalAmount) {
            remainingBar.classList.add('is-warning');
            remainingBar.innerHTML = `
                <span>Supera el total del pedido</span>
                <strong>Máx. ${formatCurrency(Math.round(totalAmount))}</strong>
            `;
        } else {
            remainingBar.classList.remove('is-warning');
            const remaining = Math.max(0, totalAmount - partialAmount);
            remainingBar.innerHTML = `
                <span>Falta por salir (Tampo):</span>
                <strong>${formatCurrency(Math.round(remaining))}</strong>
            `;
        }
    }
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
    const partialInput = document.getElementById('orderNoTampoAmount');
    if (partialInput) partialInput.value = '';
    
    const btnDelete = document.getElementById('btnDeleteOrder');
    if (btnDelete) btnDelete.style.display = 'none';
    
    const title = document.getElementById('orderModalTitle') || modal.querySelector('h2');
    if (title) title.textContent = 'Nuevo Pedido';
    const headIcon = document.getElementById('orderModalHeadIcon');
    if (headIcon) headIcon.textContent = 'add_shopping_cart';
    
    document.getElementById('orderDate').value = new Date().toISOString().split('T')[0];
    delete document.getElementById('orderId').dataset.originalId;
    
    modal.classList.add('open');
    // Limpiar botón borrar buscador y sincronizar UI dinámica
    const clearBtn = document.getElementById('clearOrderClientBtn');
    if (clearBtn) clearBtn.style.display = 'none';
    syncOrderBillingUI();
    updateOrderModalSubtitle();
    if (typeof window.enhanceClearableInputs === 'function') {
        window.enhanceClearableInputs(modal);
    }
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
    if (clearBtn) clearBtn.style.display = 'inline-flex';

    // Calcular automáticamente el siguiente Nº de pedido de este año
    await autoIncrementOrderNumber();
    updateOrderModalSubtitle();

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
    updateOrderModalSubtitle();
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
    const rawNoTampoAmount = parseFloat(document.getElementById('orderNoTampoAmount')?.value);
    const noTampoAmount = (noTampo && !isNaN(rawNoTampoAmount) && rawNoTampoAmount > 0) ? rawNoTampoAmount : 0;
    const facturadoTodo = document.getElementById('orderFacturadoTodo').value;
    const comments = document.getElementById('orderComments').value;
    const isNewClient = document.getElementById('isNewClientSwitch').checked;

    if (!date || !rawShop || isNaN(amount)) {
        alert('Por favor, rellena los campos obligatorios');
        return;
    }

    if (noTampo && noTampoAmount > amount) {
        alert('El importe facturado sin tampo no puede superar el importe total del pedido.');
        const partialEl = document.getElementById('orderNoTampoAmount');
        if (partialEl) partialEl.focus();
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
        noTampoAmount,
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
    modal.style.zIndex = '1250';
    modal.classList.add('open');
    
    const title = document.getElementById('orderModalTitle') || modal.querySelector('h2');
    if (title) title.textContent = 'Editar Pedido';
    const headIcon = document.getElementById('orderModalHeadIcon');
    if (headIcon) headIcon.textContent = 'edit_note';
    
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

    document.getElementById('orderDate').value = toInputDateValue(order.date || order.dateISO);
    document.getElementById('orderClient').value = currentShopName || '';
    const codeInput = document.getElementById('orderClientCode');
    if (codeInput) codeInput.value = currentClientCode;
    document.getElementById('orderAmount').value = order.amount;
    document.getElementById('orderId').value = order.displayId;
    document.getElementById('orderId').dataset.originalId = order.id;
    document.getElementById('orderNoTampo').value = toInputDateValue(order.noTampo);
    const partialVal = parseFloat(order.noTampoAmount) || 0;
    const partialInput = document.getElementById('orderNoTampoAmount');
    if (partialInput) partialInput.value = partialVal > 0 ? partialVal : '';
    document.getElementById('orderFacturadoTodo').value = toInputDateValue(order.facturadoTodo);
    document.getElementById('orderComments').value = order.comments || '';
    document.getElementById('isNewClientSwitch').checked = !!order.persistedIsNewClient;

    toggleClearSearch('orderClient', 'clearOrderClientBtn');
    syncOrderBillingUI();
    updateOrderModalSubtitle();
    if (typeof window.enhanceClearableInputs === 'function') {
        window.enhanceClearableInputs(modal);
    }
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
window.autoIncrementOrderNumber = autoIncrementOrderNumber;
window.syncOrderBillingUI = syncOrderBillingUI;
window.clearOrderDateField = clearOrderDateField;
window.updateOrderModalSubtitle = updateOrderModalSubtitle;
window.openExportPedidosModal = openExportPedidosModal;
window.closeExportPedidosModal = closeExportPedidosModal;
window.executeExportXlsx = executeExportXlsx;
window.previewPedidosReport = previewPedidosReport;
window.clearPedidosSearch = clearPedidosSearch;
window.injectPedidoModals = injectPedidoModals;







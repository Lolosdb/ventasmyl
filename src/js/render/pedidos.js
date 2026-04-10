/**
 * Lógica de gestión de Pedidos y Exportación
 */

async function renderPedidos() {
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Pedidos', {
        extraAction: `
            <button class="btn-header-pill" onclick="openExportPedidosModal()" title="Informe Pedidos">
                <span class="material-icons-round">description</span>
                <span>Informe Pedidos</span>
            </button>
        `
    });

    let contentHtml = '<main style="padding: 1rem 1.5rem; padding-bottom: 100px;">';

    // Buscador
    contentHtml += `
        <div class="search-container mb-4">
            <span class="material-icons-round search-icon">search</span>
            <input type="text" id="searchPedidosInput" class="search-input" placeholder="Buscar por Nº de pedido o Tienda..." onkeyup="filterPedidos()" onkeydown="if(event.key==='Enter') this.blur()">
            <span id="clearPedidosSearchBtn" class="material-icons-round clear-icon" style="display: none;" onclick="clearPedidosSearch()">cancel</span>
        </div>
    `;

    const orders = await dataManager.getOrders();
    // Ordenar por año descendente y luego por ID descendente
    const sortedOrders = orders.sort((a, b) => {
        const yearA = parseInt(String(a.id).split('-')[0]) || 0;
        const yearB = parseInt(String(b.id).split('-')[0]) || 0;
        if (yearB !== yearA) return yearB - yearA;
        return (b.displayId || 0) - (a.displayId || 0);
    });

    contentHtml += `
        <div class="pedidos-table-header">
            <div>Nº</div>
            <div>TIENDA</div>
            <div style="text-align: right;">IMPORTE</div>
        </div>
    `;

    contentHtml += '<div id="pedidosList" class="pedidos-list" style="background: white;">';
    if (sortedOrders.length === 0) {
        contentHtml += '<div class="text-center p-8 text-gray-400">No hay pedidos registrados</div>';
    } else {
        sortedOrders.forEach(order => {
            const amount = formatCurrency(Math.round(order.amount || 0));
            
            // Reglas de negocio de colores
            let rowClass = '';
            if (order.facturadoTodo) rowClass = 'row-green';
            else if (order.noTampo) rowClass = 'row-blue';

            contentHtml += `
                <div class="pedido-row ${rowClass}" onclick="openEditOrderModal('${order.id}')">
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
    app.innerHTML = headerHtml + contentHtml;
    
    if (window.activeCurrentNav) window.activeCurrentNav('pedidos');
}

function filterPedidos() {
    const input = document.getElementById('searchPedidosInput');
    const filter = input.value.toLowerCase();
    
    // Usar utilidad global para el botón X
    toggleClearSearch('searchPedidosInput', 'clearPedidosSearchBtn');

    const rows = document.querySelectorAll('.pedido-row');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(filter) ? '' : 'none';
    });
}

function clearPedidosSearch() {
    clearSearchField('searchPedidosInput', 'clearPedidosSearchBtn', filterPedidos);
}

function injectPedidoModals() {
    if (document.getElementById('newOrderModal')) return;
    
    const modalsHtml = `
    <!-- Modal Nuevo/Editar Pedido -->
    <div id="newOrderModal" class="modal-overlay new-order-modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="text-xl font-bold">Nuevo Pedido</h2>
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

                    <div class="order-form-group">
                        <label class="order-form-label">TIENDA / CLIENTE</label>
                        <div class="client-search-wrapper">
                            <span class="material-icons-round client-search-icon">search</span>
                            <input type="text" id="orderClient" class="order-input client-search-input" list="clientsListDatalist" placeholder="Buscar cliente..." required onkeydown="handleOrderFormEnter(event, 'orderAmount')" onkeyup="toggleClearSearch('orderClient', 'clearOrderClientBtn')" oninput="handleClientInputJump(this.value)">
                            <span id="clearOrderClientBtn" class="material-icons-round clear-icon" style="display: none; top: 50%; transform: translateY(-50%);" onclick="clearSearchField('orderClient', 'clearOrderClientBtn'); document.getElementById('orderClient').focus();">cancel</span>
                            <datalist id="clientsListDatalist"></datalist>
                        </div>
                    </div>

                    <div class="order-form-group">
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

                    <div class="order-form-group">
                        <label class="order-form-label">COMENTARIOS</label>
                        <textarea id="orderComments" class="order-input" rows="2" placeholder="Notas sobre el pedido..." onkeydown="handleOrderFormEnter(event, 'isNewClientSwitch')"></textarea>
                    </div>

                    <div class="toggle-container">
                        <button type="button" class="btn-link-cancel" onclick="closeNewOrderModal()">
                            <span class="material-icons-round">close</span>
                            Cancelar
                        </button>
                        <div class="flex items-center gap-2">
                            <span class="toggle-label">¿Cliente Nuevo?</span>
                            <label class="switch">
                                <input type="checkbox" id="isNewClientSwitch">
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>

                    <div class="modal-footer-custom">
                        <button type="button" id="btnDeleteOrder" class="btn-action-delete" style="display:none;" onclick="deleteCurrentOrder()">
                            <span class="material-icons-round">delete</span>
                            Eliminar
                        </button>
                        <button type="submit" class="btn-save-custom">
                            <span class="material-icons-round">check</span>
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
                    <div class="search-container">
                        <input type="text" id="exportFilterClient" class="search-input" style="padding: 0.8rem 2.5rem 0.8rem 1rem;" placeholder="Opcional: Filtrar por tienda" onkeyup="toggleClearSearch('exportFilterClient', 'clearExportClientBtn')">
                        <span id="clearExportClientBtn" class="material-icons-round clear-icon" style="display: none; right: 0.8rem;" onclick="clearSearchField('exportFilterClient', 'clearExportClientBtn')">cancel</span>
                    </div>
                </div>

                <div class="mb-8">
                    <label class="form-label" style="color: #64748b; font-size: 11px;">POBLACIÓN / PROVINCIA</label>
                    <div class="search-container">
                        <input type="text" id="exportFilterLocation" class="search-input" style="padding: 0.8rem 2.5rem 0.8rem 1rem;" placeholder="Opcional: Ej. Asturias, Madrid..." onkeyup="toggleClearSearch('exportFilterLocation', 'clearExportLocBtn')">
                        <span id="clearExportLocBtn" class="material-icons-round clear-icon" style="display: none; right: 0.8rem;" onclick="clearSearchField('exportFilterLocation', 'clearExportLocBtn')">cancel</span>
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
    dataManager.getClients().then(clients => {
        const dl = document.getElementById('clientsListDatalist');
        if (dl) dl.innerHTML = clients.map(c => `<option value="${c.name}">`).join('');
    });
}

function openNewOrderModal() {
    injectPedidoModals();
    const modal = document.getElementById('newOrderModal');
    const form = document.getElementById('newOrderForm');
    form.reset();
    
    const btnDelete = document.getElementById('btnDeleteOrder');
    if (btnDelete) btnDelete.style.display = 'none';
    
    const title = modal.querySelector('h2');
    if (title) title.textContent = 'Nuevo Pedido';
    
    document.getElementById('orderDate').value = new Date().toISOString().split('T')[0];
    delete document.getElementById('orderId').dataset.originalId;
    
    modal.classList.add('open');
    // Limpiar botón borrar buscador
    const clearBtn = document.getElementById('clearOrderClientBtn');
    if (clearBtn) clearBtn.style.display = 'none';
}

function closeNewOrderModal() {
    const modal = document.getElementById('newOrderModal');
    if (modal) modal.classList.remove('open');
}

async function autoIncrementOrderNumber() {
    const orders = await dataManager.getOrders();
    const ids = orders.map(o => o.displayId || 0);
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
    const shop = document.getElementById('orderClient').value;
    const amount = parseFloat(document.getElementById('orderAmount').value);
    const displayId = parseInt(document.getElementById('orderId').value);
    const noTampo = document.getElementById('orderNoTampo').value;
    const facturadoTodo = document.getElementById('orderFacturadoTodo').value;
    const comments = document.getElementById('orderComments').value;
    const isNewClient = document.getElementById('isNewClientSwitch').checked;

    if (!date || !shop || isNaN(amount)) {
        alert('Por favor, rellena los campos obligatorios');
        return;
    }

    const year = new Date(date).getFullYear();
    const compositeId = `${year}-${displayId}`;
    
    const orderData = {
        id: compositeId,
        displayId,
        date,
        dateISO: new Date(date).toISOString(),
        shop,
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
    renderPedidos();
}

async function openEditOrderModal(orderId) {
    injectPedidoModals();
    const order = await dataManager.getOrderById(orderId);
    if (!order) return;

    const modal = document.getElementById('newOrderModal');
    modal.classList.add('open');
    
    const title = modal.querySelector('h2');
    if (title) title.textContent = 'Editar Pedido';
    
    const btnDelete = document.getElementById('btnDeleteOrder');
    if (btnDelete) btnDelete.style.display = 'block';

    document.getElementById('orderDate').value = order.date;
    document.getElementById('orderClient').value = order.shop;
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

async function previewPedidosReport() {
    try {
        const start = document.getElementById('exportStartDate').value;
        const end = document.getElementById('exportEndDate').value;
        const shopFilter = document.getElementById('exportFilterClient').value.toLowerCase().trim();
        const locationFilter = document.getElementById('exportFilterLocation').value.toLowerCase().trim();

        if (!start || !end) return alert("Selecciona fechas para previsualizar");

        const orders = await dataManager.getOrders();
        const clients = await dataManager.getClients();
        const clientMap = new Map(clients.map(c => [(c.name || '').toLowerCase().trim(), c]));

        const startD = new Date(start); startD.setHours(0,0,0,0);
        const endD = new Date(end); endD.setHours(23,59,59,999);

        const filtered = orders.filter(o => {
            const d = new Date(o.dateISO || o.date);
            const dateMatch = d >= startD && d <= endD;
            if (!dateMatch) return false;

            if (shopFilter && !o.shop.toLowerCase().includes(shopFilter)) return false;

            if (locationFilter) {
                const c = clientMap.get(o.shop.toLowerCase().trim()) || {};
                const loc = (c.location || "").toLowerCase();
                const prov = (c.province || "").toLowerCase();
                if (!loc.includes(locationFilter) && !prov.includes(locationFilter)) return false;
            }
            return true;
        }).sort((a,b) => (b.displayId || 0) - (a.displayId || 0));

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
        const shopFilter = document.getElementById('exportFilterClient').value.toLowerCase().trim();
        const locationFilter = document.getElementById('exportFilterLocation').value.toLowerCase().trim();

        if (!start || !end) return alert("Selecciona fechas para exportar");

        const orders = await dataManager.getOrders();
        const clients = await dataManager.getClients();
        const clientMap = new Map(clients.map(c => [(c.name || '').toLowerCase().trim(), c]));

        const startD = new Date(start); startD.setHours(0,0,0,0);
        const endD = new Date(end); endD.setHours(23,59,59,999);

        const filtered = orders.filter(o => {
            const d = new Date(o.dateISO || o.date);
            const dateMatch = d >= startD && d <= endD;
            if (!dateMatch) return false;

            if (shopFilter && !o.shop.toLowerCase().includes(shopFilter)) return false;

            if (locationFilter) {
                const c = clientMap.get(o.shop.toLowerCase().trim()) || {};
                const loc = (c.location || "").toLowerCase();
                const prov = (c.province || "").toLowerCase();
                if (!loc.includes(locationFilter) && !prov.includes(locationFilter)) return false;
            }
            return true;
        }).sort((a,b) => (a.displayId || 0) - (b.displayId || 0));

        if (filtered.length === 0) return alert("No hay pedidos para este filtro");

        const wb = XLSX.utils.book_new();
        const data = filtered.map(o => {
            const c = clientMap.get(o.shop.toLowerCase().trim()) || {};
            return {
                "Nº": o.displayId || String(o.id).split('-').pop(),
                "FECHA": new Date(o.dateISO || o.date).toLocaleDateString('es-ES'),
                "TIENDA": o.shop.toUpperCase(),
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
window.openNewOrderModal = openNewOrderModal;
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

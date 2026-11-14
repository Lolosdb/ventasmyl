/**
 * Lógica de Vistas Analíticas, Reportes y Objetivos
 */

// --- TOTALES ---
async function renderTotales(isBack = false) {
    if (typeof updateHistoryState === 'function') updateHistoryState('totales', isBack);
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Totales');
    
    const orders = await dataManager.getOrders();
    const clients = await dataManager.getClients();
    const lookup = dataManager.buildClientLookup(clients);
    
    // Facturación Real (del año actual)
    const history = await dataManager.getInvoiceHistory();
    const currentYear = new Date().getFullYear();
    const salesThisYear = history[currentYear] || Array(12).fill(0);
    const facturacionReal = salesThisYear.reduce((a, b) => a + b, 0);
    
    // Objetivos
    const goals = await dataManager.getDetailedGoals();
    const goal3 = goals.data3.reduce((a, b) => a + b, 0);
    const goal4 = goals.data4.reduce((a, b) => a + b, 0);
    const goal5 = goals.data5.reduce((a, b) => a + b, 0);
    
    let target = goal3, label = "3%", activeGoal = 3;
    if (facturacionReal >= goal3) { target = goal4; label = "4%"; activeGoal = 4; }
    if (facturacionReal >= goal4) { target = goal5; label = "5%"; activeGoal = 5; }
    
    const progress = target > 0 ? Math.min(100, (facturacionReal / target) * 100).toFixed(1) : 0;
    const missing = Math.max(0, target - facturacionReal);

    // --- CÁLCULOS ESTADÍSTICAS GENERALES ---
    const ordersThisYear = orders.filter(o => getYearFromDate(o.dateISO || o.date) === currentYear);
    const relevantOrders = ordersThisYear.filter(o => (o.amount !== undefined ? o.amount : o["Importe"] || 0) > 0);
    
    const totalPedidosCount = relevantOrders.length;
    const clientsWithPurchaseCount = new Set(relevantOrders.map(o => {
        const c = dataManager.resolveClientForOrder(o, lookup);
        return c ? `code_${c.code}` : `shop_${normalizeTextKey(o.shop || o["Cliente"])}`;
    })).size;
    const averageInvoice = totalPedidosCount > 0 ? (facturacionReal / totalPedidosCount) : 0;
    
    // Clientes Nuevos
    // Clave de deduplicación: si el pedido tiene nombre de tienda placeholder temporal,
    // usamos el id del pedido para que cada uno cuente por separado.
    // Para tiendas reales, deduplicamos por su código único (o nombre normalizado si no tiene ficha).
    const PLACEHOLDER_NAMES = ['CLIENTE ERROR LOLO ASTURIAS', 'CLIENTE ERROR', 'ERROR CLIENTE'];
    let newClientsCount = 0;
    const countedNewShops = new Set();
    ordersThisYear.forEach(o => {
        const isNew = o.persistedIsNewClient || o["Nuevo Cliente?"] === "SI";
        const shopName = (o.shop || o["Cliente"] || '').trim().toUpperCase();
        if (!isNew || !shopName) return;
        const c = dataManager.resolveClientForOrder(o, lookup);
        const dedupeKey = PLACEHOLDER_NAMES.includes(shopName)
            ? `__placeholder__${o.id}`
            : (c ? `code_${c.code}` : normalizeTextKey(shopName));
        if (!countedNewShops.has(dedupeKey)) {
            newClientsCount++;
            countedNewShops.add(dedupeKey);
        }
    });

    // Por Provincias
    const PROVINCES = ['ASTURIAS', 'CANTABRIA', 'LEÓN', 'GALICIA'];
    const statsProv = {};
    PROVINCES.forEach(p => statsProv[p] = { amount: 0, orders: 0 });

    ordersThisYear.forEach(o => {
        const c = dataManager.resolveClientForOrder(o, lookup);
        if (c && c.province) {
            let p = c.province.trim().toUpperCase();
            if (p === 'LEON') p = 'LEÓN';
            if (p === 'LUGO') p = 'GALICIA';
            if (p === 'PALENCIA') p = 'LEÓN';
            if (statsProv[p]) {
                const amt = o.amount !== undefined ? o.amount : o["Importe"] || 0;
                statsProv[p].amount += amt;
                if (amt > 0) {
                    statsProv[p].orders++;
                }
            }
        }
    });

    let contentHtml = '<main class="totales-main" style="padding: 1rem 1.5rem; padding-bottom: 100px;">';
    
    // Titulo Resumen
    contentHtml += '<h2 class="section-title">Resumen de Ventas</h2>';

    // Tarjeta Azul Destacada
    contentHtml += `
        <div class="sales-summary-card mb-4">
            <div class="card-header">
                <p class="label">Facturación Ventas Real</p>
                <div class="trend-icon">
                    <span class="material-icons-round">trending_up</span>
                </div>
            </div>
            <h2 class="total-amount">${formatCurrency(Math.round(facturacionReal))}</h2>
            
            <div class="goal-details">
                <div class="flex justify-between items-center mb-1">
                    <p class="missing-text">Faltan ${formatCurrency(Math.round(missing))} para el Objetivo ${label}</p>
                    <span class="percentage-badge">${progress}%</span>
                </div>
                <p class="meta-label">META ${label}: ${formatCurrency(Math.round(target))}</p>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width: ${progress}%"></div>
                </div>
            </div>
        </div>
    `;

    // Grid Provincias (Grid 2x2)
    contentHtml += '<div class="grid grid-cols-2 gap-2 mb-4">';
    PROVINCES.forEach(p => {
        let colorClass = '';
        if (p === 'ASTURIAS') colorClass = 'val-blue';
        if (p === 'CANTABRIA') colorClass = 'val-red';
        if (p === 'LEÓN') colorClass = 'val-purple';
        if (p === 'GALICIA') colorClass = 'val-cyan';

        contentHtml += `
            <div class="card glass p-3 shadow-sm border border-slate-100 province-card">
                <p class="province-name">${p}</p>
                <h3 class="province-amount ${colorClass}">${formatCurrency(Math.round(statsProv[p].amount))}</h3>
                <p class="province-orders">${statsProv[p].orders} pedidos</p>
            </div>
        `;
    });
    contentHtml += '</div>';

    // Sección Estadísticas Generales
    contentHtml += '<h2 class="section-title">Estadísticas Generales</h2>';
    contentHtml += `
        <div class="grid grid-cols-2 gap-2 mb-4">
            <div class="metric-card">
                <p class="metric-label">CLIENTES NUEVOS</p>
                <p class="metric-value-line text-green-value">${newClientsCount} <span class="unit">clientes</span></p>
            </div>
            <div class="metric-card">
                <p class="metric-label">CLIENTES CON COMPRA</p>
                <p class="metric-value-line text-orange-value">${clientsWithPurchaseCount} <span class="unit">clientes</span></p>
            </div>
            <div class="metric-card">
                <p class="metric-label">TOTAL PEDIDOS (${currentYear})</p>
                <p class="metric-value-line text-blue-value">${totalPedidosCount} <span class="unit">pedidos</span></p>
            </div>
            <div class="metric-card">
                <p class="metric-label">IMPORTE MEDIO FACTURADO</p>
                <p class="metric-value-line text-purple-value">${formatCurrency(Math.round(averageInvoice))}</p>
            </div>
        </div>
    `;

    contentHtml += '</main>';
    contentHtml += renderBottomNav('totales');
    app.innerHTML = headerHtml + contentHtml; if(window.restoreScroll) window.restoreScroll();
}

// --- ALERTAS ---
let _alertsFilterMode = 'all'; // 'all' | 'overdue' | 'ok'

function _escapeAlertHtml(val) {
    return String(val ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function _formatAlertShortDate(dateISO) {
    if (!dateISO) return '--/--/--';
    const d = new Date(dateISO);
    if (Number.isNaN(d.getTime())) return '--/--/--';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
}

async function renderAlertas(isBack = false) {
    if (typeof updateHistoryState === 'function') updateHistoryState('alertas', isBack);
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Alertas de Clientes');
    
    const orders = await dataManager.getOrders();
    const clients = await dataManager.getClients();
    const lookup = dataManager.buildClientLookup(clients);
    const currentYear = new Date().getFullYear();
    
    const lastPurchase = {};
    orders.forEach(o => {
        if (new Date(o.dateISO).getFullYear() !== currentYear) return;
        const c = dataManager.resolveClientForOrder(o, lookup);
        const key = c ? `code_${c.code}` : `shop_${normalizeTextKey(o.shop)}`;
        if (!lastPurchase[key] || o.dateISO >= lastPurchase[key].dateISO) {
            lastPurchase[key] = {
                dateISO: o.dateISO,
                amount: parseFloat(o.amount) || 0,
                client: c,
                fallbackShop: o.shop
            };
        }
    });

    const now = new Date();
    const entries = Object.values(lastPurchase).map(item => {
        const d = new Date(item.dateISO);
        const days = Math.ceil(Math.abs(now - d) / (1000 * 60 * 60 * 24));
        const c = item.client;
        const primaryPhone = c ? (c.phone || c.phone2 || '') : '';
        return {
            shop: c ? c.name : item.fallbackShop,
            days,
            lastDateISO: item.dateISO,
            lastAmount: item.amount,
            phone: primaryPhone,
            hasNotes: Boolean(c && c.notes && String(c.notes).trim().length > 0),
            location: c ? c.location : '',
            province: c ? c.province : '',
            code: c ? c.code : null
        };
    }).sort((a,b) => b.days - a.days);

    const overdueCount = entries.filter(e => e.days > 45).length;
    const okCount = entries.length - overdueCount;

    let contentHtml = '<main class="alerts-view-main">';
    
    contentHtml += `
        <div class="pro-search-bar alerts-search-bar">
            <span class="material-icons-round pro-search-icon">search</span>
            <input type="text" id="alertSearchInput" class="pro-search-input" placeholder="Buscar por tienda, población o provincia..." 
                   oninput="filterAlerts()"
                   onkeyup="filterAlerts()"
                   onkeydown="if(event.key==='Enter') this.blur()">
            <div class="pro-search-actions">
                <button type="button" id="clearAlertSearchBtn" class="pro-search-clear-btn" 
                        style="display: none;" 
                        onclick="clearAlertSearch()"
                        title="Borrar búsqueda">
                    <span class="material-icons-round">close</span>
                </button>
                <button type="button" class="pro-search-mic-btn"
                        onclick="window.toggleVoiceDictation('alertSearchInput', this)"
                        title="Buscar por voz">
                    <span class="material-icons-round">mic</span>
                </button>
            </div>
        </div>

        <div class="alerts-filter-grid">
            <button type="button" class="alerts-filter-card is-all ${_alertsFilterMode === 'all' ? 'is-active' : ''}" data-filter="all" onclick="setAlertFilterMode('all')">
                <span class="alerts-filter-count">${entries.length}</span>
                <span class="alerts-filter-label">Todos</span>
            </button>
            <button type="button" class="alerts-filter-card is-overdue ${_alertsFilterMode === 'overdue' ? 'is-active' : ''}" data-filter="overdue" onclick="setAlertFilterMode('overdue')">
                <span class="alerts-filter-count">${overdueCount}</span>
                <span class="alerts-filter-label">+45 días</span>
            </button>
            <button type="button" class="alerts-filter-card is-ok ${_alertsFilterMode === 'ok' ? 'is-active' : ''}" data-filter="ok" onclick="setAlertFilterMode('ok')">
                <span class="alerts-filter-count">${okCount}</span>
                <span class="alerts-filter-label">Al día</span>
            </button>
        </div>

        <div id="alertsListContainer">
    `;
    
    if (entries.length === 0) {
        contentHtml += '<div class="alerts-empty-state">Sin actividad de pedidos este año</div>';
    } else {
        entries.forEach(e => {
            const isDanger = e.days > 45;
            const statusKey = isDanger ? 'overdue' : 'ok';
            const searchData = _escapeAlertHtml(`${e.shop} ${e.location} ${e.province}`.toLowerCase());
            const cleanCallPhone = String(e.phone || '').replace(/\s+/g, '');
            const cleanWaPhone = String(e.phone || '').replace(/[^0-9]/g, '');
            const hasPhone = cleanCallPhone.length > 0;
            const lastDateStr = _formatAlertShortDate(e.lastDateISO);
            const lastAmountStr = e.lastAmount > 0 ? ` · ${formatCurrency(Math.round(e.lastAmount))}` : '';
            const safeCodeArg = e.code ? String(e.code).replace(/'/g, "\\'") : '';

            contentHtml += `
                <div class="alert-card ${isDanger ? 'red-theme' : 'green-theme'}" 
                     data-status="${statusKey}"
                     data-search="${searchData}"
                     onclick="${safeCodeArg ? `openClientDetailModal('${safeCodeArg}')` : ''}">
                    
                    <div class="alert-card-info">
                        <div class="alert-card-top">
                            <h3 class="alert-card-title">${_escapeAlertHtml(e.shop)}</h3>
                            ${e.hasNotes ? '<span class="material-icons-round alert-card-pin" title="Tiene nota fija">push_pin</span>' : ''}
                        </div>
                        <div class="alert-card-meta">
                            <span class="alert-card-location">${_escapeAlertHtml(e.location || 'SIN UBICACIÓN')}</span>
                            <span class="alert-card-dot">·</span>
                            <span class="alert-card-last">Últ: ${lastDateStr}${lastAmountStr}</span>
                        </div>
                        <div class="alert-card-status-row">
                            <span class="alert-card-badge">
                                <span class="alert-status-dot"></span>
                                ${isDanger ? `Hace ${e.days} días (+45d)` : `Al día · Hace ${e.days} días`}
                            </span>
                        </div>
                    </div>

                    <div class="alert-card-actions">
                        ${window.renderCorpActionBtn({
                            type: 'phone',
                            onclick: hasPhone ? `window.location.href='tel:${cleanCallPhone}'` : '',
                            label: 'Llamar',
                            title: hasPhone ? 'Llamar' : 'Sin teléfono',
                            disabled: !hasPhone,
                            compact: true,
                            stopPropagation: true
                        })}
                        ${window.renderCorpActionBtn({
                            type: 'whatsapp',
                            onclick: hasPhone ? `window.openAppWhatsApp('${cleanWaPhone}')` : '',
                            label: 'Whatsapp',
                            title: hasPhone ? 'Whatsapp' : 'Sin teléfono',
                            disabled: !hasPhone,
                            compact: true,
                            stopPropagation: true
                        })}
                    </div>
                </div>
            `;
        });
        contentHtml += '<div id="alertsNoMatchMsg" class="alerts-empty-state" style="display: none;">No hay clientes que coincidan con este filtro</div>';
    }

    contentHtml += '</div></main>';
    contentHtml += renderBottomNav('alertas');
    app.innerHTML = headerHtml + contentHtml;
    filterAlerts();
    if (window.restoreScroll) window.restoreScroll();
}

window.setAlertFilterMode = function(mode) {
    _alertsFilterMode = mode || 'all';
    document.querySelectorAll('.alerts-filter-card').forEach(btn => {
        btn.classList.toggle('is-active', btn.getAttribute('data-filter') === _alertsFilterMode);
    });
    filterAlerts();
};

window.filterAlerts = function() {
    const input = document.getElementById('alertSearchInput');
    if (input) toggleClearSearch('alertSearchInput', 'clearAlertSearchBtn');
    
    const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const filter = input ? norm(input.value) : '';
    const cards = document.querySelectorAll('#alertsListContainer .alert-card');
    let visibleCount = 0;
    
    cards.forEach(card => {
        const searchData = norm(card.getAttribute('data-search') || '');
        const status = card.getAttribute('data-status') || '';
        const matchesSearch = !filter || searchData.includes(filter);
        const matchesStatus = _alertsFilterMode === 'all' || status === _alertsFilterMode;
        const show = matchesSearch && matchesStatus;
        card.style.display = show ? '' : 'none';
        if (show) visibleCount++;
    });

    const noMatchEl = document.getElementById('alertsNoMatchMsg');
    if (noMatchEl) {
        noMatchEl.style.display = cards.length > 0 && visibleCount === 0 ? 'block' : 'none';
    }
};

window.clearAlertSearch = function() {
    clearSearchField('alertSearchInput', 'clearAlertSearchBtn', () => filterAlerts());
};

// --- UTILIDADES COMPARTIDAS PARA VENTAS, FACTURACIÓN Y COMISIONES ---
const ANA_MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function anaFormatNoSymbol(val) {
    return formatCurrency(Math.round(val || 0)).replace(' \u20ac', '').replace(' €', '');
}

function getAnalyticsYears(history = {}, extraYears = []) {
    const currentYear = new Date().getFullYear();
    const numericYears = new Set([currentYear]);
    Object.keys(history || {}).forEach(k => {
        const parsed = parseInt(k, 10);
        if (!Number.isNaN(parsed) && parsed >= 2000) numericYears.add(parsed);
    });
    extraYears.forEach(y => {
        const parsed = parseInt(y, 10);
        if (!Number.isNaN(parsed) && parsed >= 2000) numericYears.add(parsed);
    });

    const minYear = Math.min(...numericYears);
    const maxYear = Math.max(currentYear, ...numericYears);
    const years = [];
    for (let y = minYear; y <= maxYear; y++) years.push(y);
    return years;
}

function getMonthlyOrderTotals(allOrders = []) {
    const totals = {};
    allOrders.forEach(o => {
        const rawDate = o.dateISO || o.date;
        if (!rawDate) return;
        const d = new Date(rawDate);
        if (Number.isNaN(d.getTime())) return;
        const y = d.getFullYear();
        const m = d.getMonth();
        if (!totals[y]) totals[y] = Array(12).fill(0);
        totals[y][m] += (parseFloat(o.amount) || 0);
    });
    return totals;
}

function getCommissionTierInfo(value, goals, monthIdx) {
    if (!value || value <= 0 || !goals) return null;
    const g3 = (goals.data3 && parseFloat(goals.data3[monthIdx])) || 0;
    const g4 = (goals.data4 && parseFloat(goals.data4[monthIdx])) || 0;
    const g5 = (goals.data5 && parseFloat(goals.data5[monthIdx])) || 0;

    let pct = 2;
    let tierKey = 't2';
    if (value >= g5) { pct = 5; tierKey = 't5'; }
    else if (value >= g4) { pct = 4; tierKey = 't4'; }
    else if (value >= g3) { pct = 3; tierKey = 't3'; }

    const rawProgress = g5 > 0 ? Math.round((value / g5) * 100) : 0;
    return {
        pct,
        tierKey,
        amount: Math.round(value * (pct / 100)),
        progressPct: Math.max(8, Math.min(100, rawProgress)),
        g3,
        g4,
        g5
    };
}

function getAnnualCommissionTier(totalFacturado, goals) {
    if (!totalFacturado || totalFacturado <= 0 || !goals) return null;
    const sum3 = (goals.data3 || []).reduce((a, b) => a + (parseFloat(b) || 0), 0);
    const sum4 = (goals.data4 || []).reduce((a, b) => a + (parseFloat(b) || 0), 0);
    const sum5 = (goals.data5 || []).reduce((a, b) => a + (parseFloat(b) || 0), 0);

    if (totalFacturado >= sum5) return { pct: 5, tierKey: 't5', sum3, sum4, sum5 };
    if (totalFacturado >= sum4) return { pct: 4, tierKey: 't4', sum3, sum4, sum5 };
    if (totalFacturado >= sum3) return { pct: 3, tierKey: 't3', sum3, sum4, sum5 };
    return { pct: 2, tierKey: 't2', sum3, sum4, sum5 };
}

function renderAnalyticsTableView({ title, isBack, stateKey, scrollId, years, currentYear, buildCellFn, buildTotalCellFn, footerHtml, preserveScrollLeft = null }) {
    if (typeof updateHistoryState === 'function') updateHistoryState(stateKey, isBack);
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml(title);

    let contentHtml = `<main class="ana-wrapper ana-view-${stateKey}">
        <div class="ana-card">
            <div class="ana-scroll" id="${scrollId}">
                <table class="ana-table">
                    <thead>
                        <tr>
                            <th class="ana-sticky-col">MES</th>
                            ${years.map(y => `
                                <th class="ana-year-col ${y === currentYear ? 'is-current' : ''}">
                                    <span class="ana-year-pill ${y === currentYear ? 'is-current' : ''}">${y}</span>
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${ANA_MONTHS.map((m, mIdx) => `
                            <tr class="ana-row">
                                <td class="ana-sticky-col">${m}</td>
                                ${years.map((y, yIdx) => `
                                    <td class="ana-year-col ${y === currentYear ? 'is-current' : ''}">
                                        ${buildCellFn(y, yIdx, mIdx)}
                                    </td>
                                `).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="ana-total-row">
                            <td class="ana-sticky-col">TOTAL</td>
                            ${years.map((y, yIdx) => `
                                <td class="ana-year-col ${y === currentYear ? 'is-current' : ''}">
                                    ${buildTotalCellFn(y, yIdx)}
                                </td>
                            `).join('')}
                        </tr>
                    </tfoot>
                </table>
            </div>
            ${footerHtml || ''}
        </div>
    </main>`;

    contentHtml += renderBottomNav(null);
    app.innerHTML = headerHtml + contentHtml;
    if (window.restoreScroll) window.restoreScroll();

    setTimeout(() => {
        const container = document.getElementById(scrollId);
        if (!container) return;
        container.scrollLeft = preserveScrollLeft !== null ? preserveScrollLeft : container.scrollWidth;
    }, 40);
}

// --- MODAL RÁPIDO DE EDICIÓN (VENTAS Y FACTURACIÓN) ---
let _anaEditState = null;

async function openAnalyticsEditModal(mode, year, monthIdx) {
    let modal = document.getElementById('analyticsEditModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'analyticsEditModal';
        modal.className = 'modal-overlay';
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeAnalyticsEditModal();
        });
        document.body.appendChild(modal);
    }

    const scrollId = mode === 'sales' ? 'salesScrollContainer' : 'facturaScrollContainer';
    const scrollEl = document.getElementById(scrollId);
    const savedScrollLeft = scrollEl ? scrollEl.scrollLeft : null;

    let currentVal = 0;
    let calcVal = 0;
    let goals = null;

    if (mode === 'sales') {
        const [history, allOrders] = await Promise.all([
            dataManager.getSalesHistory(),
            dataManager.getOrders()
        ]);
        const calcTotals = getMonthlyOrderTotals(allOrders);
        const hVal = (history[String(year)] && history[String(year)][monthIdx]) || 0;
        calcVal = (calcTotals[year] && calcTotals[year][monthIdx]) || 0;
        currentVal = Math.max(hVal, calcVal);
    } else {
        const [history, yearGoals] = await Promise.all([
            dataManager.getInvoiceHistory(),
            dataManager.getGoalsForYear(year)
        ]);
        currentVal = (history[String(year)] && history[String(year)][monthIdx]) || 0;
        goals = yearGoals;
    }

    _anaEditState = { mode, year, monthIdx, calcVal, goals, savedScrollLeft };

    const monthName = ANA_MONTHS[monthIdx];
    const modeLabel = mode === 'sales' ? 'Ventas Mensuales' : 'Facturación Real';
    const inputDisplay = currentVal > 0 ? anaFormatNoSymbol(currentVal) : '';

    let contextHtml = '';
    if (mode === 'sales') {
        contextHtml = `
            <div class="ana-modal-context">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <span>Suma de pedidos del mes:</span>
                    <strong>${anaFormatNoSymbol(calcVal)} €</strong>
                </div>
                ${calcVal > 0 ? `
                    <button type="button" class="ana-modal-quick-btn" onclick="applyCalculatedOrderSales()">
                        Usar suma automática (${anaFormatNoSymbol(calcVal)} €)
                    </button>
                ` : ''}
            </div>
        `;
    } else if (goals) {
        const g3 = (goals.data3 && goals.data3[monthIdx]) || 0;
        const g4 = (goals.data4 && goals.data4[monthIdx]) || 0;
        const g5 = (goals.data5 && goals.data5[monthIdx]) || 0;
        contextHtml = `
            <div class="ana-modal-context">
                <span style="font-weight:800; font-size:11px; text-transform:uppercase;">Objetivos ${monthName} ${year}</span>
                <div class="ana-modal-targets">
                    <div class="ana-modal-target-chip"><span>3%</span><strong>${anaFormatNoSymbol(g3)} €</strong></div>
                    <div class="ana-modal-target-chip"><span>4%</span><strong>${anaFormatNoSymbol(g4)} €</strong></div>
                    <div class="ana-modal-target-chip"><span>5%</span><strong>${anaFormatNoSymbol(g5)} €</strong></div>
                </div>
            </div>
        `;
    }

    modal.innerHTML = `
        <div class="ana-modal-card" role="dialog" aria-modal="true" aria-label="Editar ${modeLabel}">
            <div class="ana-modal-head">
                <div>
                    <h3 class="ana-modal-title">${monthName} ${year}</h3>
                    <span class="ana-modal-sub">${modeLabel}</span>
                </div>
                <button type="button" class="ana-modal-close" onclick="closeAnalyticsEditModal()" aria-label="Cerrar">
                    <span class="material-icons-round">close</span>
                </button>
            </div>
            <div class="ana-modal-body">
                <label class="ana-modal-label" for="anaModalAmountInput">Importe del mes</label>
                <div class="ana-modal-input-wrap">
                    <input type="text"
                           id="anaModalAmountInput"
                           class="ana-modal-input"
                           inputmode="decimal"
                           data-no-clear="true"
                           value="${inputDisplay}"
                           placeholder="0"
                           onkeydown="if(event.key==='Enter'){ event.preventDefault(); saveAnalyticsEditModal(); }">
                    <span class="ana-modal-euro">€</span>
                </div>
                ${contextHtml}
            </div>
            <div class="ana-modal-actions">
                <button type="button" class="ana-btn-cancel" onclick="closeAnalyticsEditModal()">Cancelar</button>
                <button type="button" class="ana-btn-save" onclick="saveAnalyticsEditModal()">Guardar</button>
            </div>
        </div>
    `;

    modal.classList.add('open');
    setTimeout(() => {
        const input = document.getElementById('anaModalAmountInput');
        if (input) {
            input.focus();
            input.select();
        }
    }, 60);
}

function applyCalculatedOrderSales() {
    if (!_anaEditState) return;
    const input = document.getElementById('anaModalAmountInput');
    if (input) {
        input.value = _anaEditState.calcVal > 0 ? anaFormatNoSymbol(_anaEditState.calcVal) : '0';
        input.focus();
        input.select();
    }
}

function closeAnalyticsEditModal() {
    const modal = document.getElementById('analyticsEditModal');
    if (modal) modal.classList.remove('open');
}

async function saveAnalyticsEditModal() {
    if (!_anaEditState) return;
    const input = document.getElementById('anaModalAmountInput');
    const raw = input ? input.value : '0';
    const { mode, year, monthIdx, savedScrollLeft } = _anaEditState;
    closeAnalyticsEditModal();

    if (mode === 'sales') {
        await handleSalesUpdate(year, monthIdx, raw, savedScrollLeft);
    } else {
        await handleFacturaUpdate(year, monthIdx, raw, savedScrollLeft);
    }
}

// --- VENTAS MENSUALES ---
async function renderVentas(isBack = false, preserveScrollLeft = null) {
    const [history, allOrders] = await Promise.all([
        dataManager.getSalesHistory(),
        dataManager.getOrders()
    ]);

    const calculatedTotals = getMonthlyOrderTotals(allOrders);
    const orderYears = Object.keys(calculatedTotals).map(Number);
    const years = getAnalyticsYears(history, orderYears);
    const currentYear = new Date().getFullYear();

    // Precalcular valores y totales por año (siempre reflejando la suma de pedidos cuando sea mayor)
    const gridValues = {};
    const totalsByYear = {};
    years.forEach(y => {
        gridValues[y] = Array(12).fill(0);
        let yearTotal = 0;
        for (let mIdx = 0; mIdx < 12; mIdx++) {
            const hVal = (history[String(y)] && history[String(y)][mIdx]) || 0;
            const cVal = (calculatedTotals[y] && calculatedTotals[y][mIdx]) || 0;
            const val = Math.max(hVal, cVal);
            gridValues[y][mIdx] = val;
            yearTotal += val;
        }
        totalsByYear[y] = yearTotal;
    });

    renderAnalyticsTableView({
        title: 'Ventas Mensuales',
        isBack,
        stateKey: 'ventas',
        scrollId: 'salesScrollContainer',
        years,
        currentYear,
        preserveScrollLeft,
        footerHtml: '',
        buildCellFn: (y, yIdx, mIdx) => {
            const val = gridValues[y][mIdx];
            let deltaHtml = '';
            if (yIdx > 0 && val > 0) {
                const prevVal = gridValues[years[yIdx - 1]][mIdx];
                if (prevVal > 0) {
                    const diffPct = Math.round(((val - prevVal) / prevVal) * 100);
                    const cls = diffPct > 0 ? 'is-up' : (diffPct < 0 ? 'is-down' : 'is-flat');
                    deltaHtml = `<span class="ana-delta-chip ${cls}">${diffPct > 0 ? '+' : ''}${diffPct}%</span>`;
                }
            }
            const valHtml = val === 0
                ? `<span class="ana-empty-dash">—</span>`
                : `<span class="ana-val-main ${y === currentYear ? 'is-current-plain' : ''}">${anaFormatNoSymbol(val)}</span>`;
            return `
                <button type="button" class="ana-cell-btn" onclick="openAnalyticsEditModal('sales', ${y}, ${mIdx})">
                    ${valHtml}
                    ${deltaHtml}
                </button>
            `;
        },
        buildTotalCellFn: (y, yIdx) => {
            const total = totalsByYear[y];
            let variationHtml = '';
            if (yIdx > 0) {
                const prevTotal = totalsByYear[years[yIdx - 1]];
                if (prevTotal > 0) {
                    const diff = Math.round(((total - prevTotal) / prevTotal) * 100);
                    const cls = diff > 0 ? 'is-up' : (diff < 0 ? 'is-down' : 'is-flat');
                    variationHtml = `<span class="ana-delta-chip ${cls}">${diff > 0 ? '+' : ''}${diff}%</span>`;
                }
            }
            return `
                <div class="ana-total-stack">
                    <span class="ana-total-num ${y === currentYear ? 'is-current' : ''}">${anaFormatNoSymbol(total)}</span>
                    ${variationHtml}
                </div>
            `;
        }
    });
}

async function handleSalesUpdate(year, monthIdx, value, preserveScrollLeft = null) {
    const clean = (value ?? '').toString().replace(/\./g, '').replace(',', '.').trim();
    const num = parseFloat(clean);
    await dataManager.saveSalesHistory(year, monthIdx, Number.isNaN(num) ? 0 : num);
    renderVentas(false, preserveScrollLeft);
}

// --- MEDIAS MENSUALES ---
async function renderMedias(isBack = false) {
    if (typeof updateHistoryState === 'function') updateHistoryState('medias', isBack);
    const app = document.getElementById('app');
    const history = await dataManager.getSalesHistory();
    const currentYear = new Date().getFullYear();
    const validYears = Object.keys(history || {})
        .map(Number)
        .filter(y => !Number.isNaN(y) && y < currentYear)
        .sort((a, b) => a - b);

    const numYears = validYears.length;
    const yearsLabel = numYears === 1 ? 'año' : 'años';
    const yearsRange = numYears === 0
        ? 'Sin histórico'
        : (numYears === 1
            ? `${validYears[0]} · 1 año`
            : `${validYears[0]}–${validYears[numYears - 1]} · ${numYears} ${yearsLabel}`);

    const headerHtml = getCommonHeaderHtml('Medias Mensuales');

    const averages = ANA_MONTHS.map((_, i) => {
        if (numYears === 0) return 0;
        const sum = validYears.reduce((acc, y) => acc + ((history[y] && history[y][i]) || 0), 0);
        return Math.floor(sum / numYears);
    });

    const totalAvg = Math.floor(averages.reduce((a, b) => a + b, 0));
    const monthlyAvg = Math.round(totalAvg / 12);
    const maxAvg = Math.max(...averages, 0);
    const bestIdx = maxAvg > 0 ? averages.indexOf(maxAvg) : -1;

    const monthsHtml = ANA_MONTHS.map((name, i) => {
        const val = averages[i];
        const sharePct = totalAvg > 0 ? Math.round((val / totalAvg) * 100) : 0;
        const barPct = maxAvg > 0 ? Math.max(val > 0 ? 6 : 0, Math.round((val / maxAvg) * 100)) : 0;
        const isPeak = i === bestIdx;
        const isStrong = totalAvg > 0 && val >= monthlyAvg;
        const stateCls = isPeak ? 'is-peak' : (isStrong ? 'is-strong' : '');

        return `
            <div class="month-card ${stateCls}">
                <div class="month-card-top">
                    <span class="month-card-title">${name}</span>
                    <span class="month-card-pct">${sharePct}%</span>
                </div>
                <div class="month-card-value">${anaFormatNoSymbol(val)} €</div>
                <div class="month-card-bar">
                    <div class="month-card-fill" style="width: ${barPct}%;"></div>
                </div>
            </div>
        `;
    }).join('');

    const contentHtml = `
        <main class="medias-container">
            <section class="annual-media-card">
                <div class="annual-media-top">
                    <span class="annual-title">Media Ventas Anual</span>
                    <span class="annual-years-pill">${yearsRange}</span>
                </div>
                <div class="annual-media-bottom">
                    <h2 class="annual-value">${anaFormatNoSymbol(totalAvg)} <span class="annual-euro">€</span></h2>
                    <div class="annual-sub-stat">
                        <span class="annual-sub-lbl">Media / mes</span>
                        <strong class="annual-sub-val">${anaFormatNoSymbol(monthlyAvg)} €</strong>
                    </div>
                </div>
            </section>

            <section class="medias-panel">
                <div class="medias-panel-head">
                    <span class="medias-panel-title">Desglose mensual</span>
                    ${bestIdx >= 0
                        ? `<span class="medias-peak-pill">Pico: ${ANA_MONTHS[bestIdx]} · ${anaFormatNoSymbol(maxAvg)} €</span>`
                        : `<span class="medias-peak-pill is-empty">Sin datos</span>`}
                </div>
                <div class="months-grid">
                    ${monthsHtml}
                </div>
            </section>
        </main>
    ` + renderBottomNav(null);

    app.innerHTML = headerHtml + contentHtml;
    if (window.restoreScroll) window.restoreScroll();
}

// --- RANKING ---
let _rankingState = null;

function escapeRankingHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getRankingOrderYear(order) {
    if (order && order.year !== undefined && order.year !== null) {
        const y = parseInt(order.year, 10);
        if (!Number.isNaN(y)) return y;
    }
    const raw = order && (order.dateISO || order.date);
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.getFullYear();
}

async function openRankingModal(sortBy = 'sales', searchTerm = '', targetYear = null) {
    let modal = document.getElementById('rankingModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'rankingModal';
        modal.className = 'modal-overlay';
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeRankingModal();
        });
        document.body.appendChild(modal);
    }

    const [orders, clientsData] = await Promise.all([
        dataManager.getOrders(),
        dataManager.getClients()
    ]);
    const lookup = dataManager.buildClientLookup(clientsData);

    const currentYear = new Date().getFullYear();
    const yearSet = new Set([currentYear]);
    orders.forEach(o => {
        const y = getRankingOrderYear(o);
        if (y && y >= 2000) yearSet.add(y);
    });
    const availableYears = Array.from(yearSet).sort((a, b) => a - b);

    const selectedYear = targetYear !== null && targetYear !== undefined
        ? parseInt(targetYear, 10)
        : currentYear;

    const stats = {};
    let totalSales = 0;
    let totalOrders = 0;

    orders.forEach(o => {
        if (getRankingOrderYear(o) !== selectedYear) return;
        const c = dataManager.resolveClientForOrder(o, lookup);
        const key = c ? `code_${c.code}` : `shop_${normalizeTextKey(o.shop)}`;
        const displayName = (c ? c.name : o.shop) || 'Sin nombre';
        const amount = parseFloat(o.amount) || 0;
        if (!stats[key]) {
            stats[key] = {
                name: displayName,
                sales: 0,
                orders: 0,
                code: c ? c.code : (o.clientCode || null)
            };
        }
        stats[key].sales += amount;
        stats[key].orders += 1;
        totalSales += amount;
        totalOrders += 1;
    });

    const list = Object.values(stats);
    _rankingState = {
        year: selectedYear,
        sortBy: sortBy === 'pedidos' ? 'pedidos' : 'sales',
        searchTerm: searchTerm || '',
        list,
        filteredList: [],
        totalSales,
        totalOrders
    };

    const clientCount = list.length;
    const summaryText = clientCount > 0
        ? `${clientCount} ${clientCount === 1 ? 'cliente' : 'clientes'} · ${anaFormatNoSymbol(totalSales)} € · ${totalOrders} ${totalOrders === 1 ? 'pedido' : 'pedidos'}`
        : `Sin pedidos registrados en ${selectedYear}`;

    const yearsHtml = availableYears.length > 1
        ? `<div class="ranking-yearbar">
                ${availableYears.map(y => `
                    <button type="button"
                            class="ranking-year-pill ${y === selectedYear ? 'is-active' : ''}"
                            onclick="openRankingModal(_rankingState?.sortBy || 'sales', document.getElementById('rankSearch')?.value || '', ${y})">${y}</button>
                `).join('')}
           </div>`
        : '';

    modal.innerHTML = `
        <div class="ranking-modal-card" role="dialog" aria-modal="true" aria-label="Ranking Clientes ${selectedYear}">
            <div class="ranking-modal-head">
                <div class="ranking-head-top">
                    <div class="ranking-head-left">
                        <span class="ranking-head-icon">
                            <span class="material-icons-round">emoji_events</span>
                        </span>
                        <div class="ranking-head-titles">
                            <h2 class="ranking-head-title">Ranking ${selectedYear}</h2>
                            <p class="ranking-head-sub">${summaryText}</p>
                        </div>
                    </div>
                    <button type="button" class="ana-modal-close" onclick="closeRankingModal()" aria-label="Cerrar">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                ${yearsHtml}
            </div>

            <div class="ranking-controls">
                <div class="ranking-tabs-container">
                    <button type="button"
                            id="rankTabSales"
                            class="ranking-tab-btn ${_rankingState.sortBy === 'sales' ? 'active' : ''}"
                            onclick="switchRankingSort('sales')">
                        <span class="material-icons-round">euro</span>
                        <span>Por Ventas</span>
                    </button>
                    <button type="button"
                            id="rankTabOrders"
                            class="ranking-tab-btn ${_rankingState.sortBy === 'pedidos' ? 'active' : ''}"
                            onclick="switchRankingSort('pedidos')">
                        <span class="material-icons-round">shopping_bag</span>
                        <span>Por Pedidos</span>
                    </button>
                </div>

                <div class="pro-search-bar ranking-search-bar">
                    <span class="material-icons-round pro-search-icon">search</span>
                    <input type="text"
                           id="rankSearch"
                           class="pro-search-input"
                           placeholder="Buscar tienda..."
                           value="${escapeRankingHtml(_rankingState.searchTerm)}"
                           oninput="filterRankingList(this.value)"
                           autocomplete="off">
                    <div class="pro-search-actions">
                        <button type="button"
                                id="rankSearchClearBtn"
                                class="pro-search-clear-btn"
                                style="display: ${_rankingState.searchTerm ? 'inline-flex' : 'none'};"
                                onclick="clearRankingSearch()"
                                title="Borrar búsqueda">
                            <span class="material-icons-round">close</span>
                        </button>
                        <button type="button"
                                class="pro-search-mic-btn"
                                onclick="window.toggleVoiceDictation('rankSearch', this, (val) => filterRankingList(val))"
                                title="Buscar por voz">
                            <span class="material-icons-round">mic</span>
                        </button>
                    </div>
                </div>
            </div>

            <div class="ranking-list-body" id="rankingListContainer"></div>
        </div>
    `;

    renderRankingList();
    modal.classList.add('open');

    if (_rankingState.searchTerm) {
        const input = document.getElementById('rankSearch');
        if (input) {
            input.focus();
            input.setSelectionRange(_rankingState.searchTerm.length, _rankingState.searchTerm.length);
        }
    }
}

function switchRankingSort(sortBy) {
    if (!_rankingState) return;
    _rankingState.sortBy = sortBy === 'pedidos' ? 'pedidos' : 'sales';
    const salesTab = document.getElementById('rankTabSales');
    const ordersTab = document.getElementById('rankTabOrders');
    if (salesTab) salesTab.classList.toggle('active', _rankingState.sortBy === 'sales');
    if (ordersTab) ordersTab.classList.toggle('active', _rankingState.sortBy === 'pedidos');
    renderRankingList();
}

function filterRankingList(searchTerm) {
    if (!_rankingState) return;
    _rankingState.searchTerm = searchTerm || '';
    const clearBtn = document.getElementById('rankSearchClearBtn');
    if (clearBtn) {
        clearBtn.style.display = _rankingState.searchTerm ? 'inline-flex' : 'none';
    }
    renderRankingList();
}

function clearRankingSearch() {
    const input = document.getElementById('rankSearch');
    if (input) {
        input.value = '';
        input.focus();
    }
    filterRankingList('');
}

function renderRankingList() {
    if (!_rankingState) return;
    const container = document.getElementById('rankingListContainer');
    if (!container) return;

    const { list, sortBy, searchTerm, totalSales, totalOrders, year } = _rankingState;
    const isOrdersMode = sortBy === 'pedidos';

    const sorted = list.map(s => ({ ...s })).sort((a, b) => {
        if (!isOrdersMode) {
            if (b.sales !== a.sales) return b.sales - a.sales;
            return b.orders - a.orders;
        }
        if (b.orders !== a.orders) return b.orders - a.orders;
        return b.sales - a.sales;
    });

    const ranked = sorted.map((r, i) => ({ ...r, originalRank: i + 1 }));
    const maxMetric = ranked.length > 0
        ? (isOrdersMode ? ranked[0].orders : ranked[0].sales)
        : 0;

    let filtered = ranked;
    if (searchTerm) {
        const normSearch = normalizeTextKey(searchTerm);
        if (normSearch) {
            filtered = ranked.filter(r => normalizeTextKey(r.name).includes(normSearch));
        }
    }

    _rankingState.filteredList = filtered;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="ranking-empty-state">
                <span class="material-icons-round">search_off</span>
                <p>${searchTerm
                    ? `No se encontraron clientes para "${escapeRankingHtml(searchTerm)}"`
                    : `No hay pedidos registrados en ${year}`}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map((r, idx) => {
        const rankNum = r.originalRank;
        const topCls = rankNum === 1 ? 'is-top-1' : (rankNum === 2 ? 'is-top-2' : (rankNum === 3 ? 'is-top-3' : ''));
        const badgeCls = rankNum <= 3 ? `rank-badge-${rankNum}` : '';
        const avgTicket = r.orders > 0 ? Math.round(r.sales / r.orders) : 0;
        const metricVal = isOrdersMode ? r.orders : r.sales;
        const barPct = maxMetric > 0 ? Math.max(metricVal > 0 ? 6 : 0, Math.round((metricVal / maxMetric) * 100)) : 0;

        let primaryVal = '';
        let secondaryVal = '';
        let metaText = '';

        if (!isOrdersMode) {
            const sharePct = totalSales > 0 ? Math.round((r.sales / totalSales) * 100) : 0;
            primaryVal = `${anaFormatNoSymbol(r.sales)} <span class="ranking-unit">€</span>`;
            secondaryVal = `${sharePct}% del total`;
            metaText = `${r.orders} ${r.orders === 1 ? 'pedido' : 'pedidos'} · Media ${anaFormatNoSymbol(avgTicket)} €`;
        } else {
            const sharePct = totalOrders > 0 ? Math.round((r.orders / totalOrders) * 100) : 0;
            primaryVal = `${r.orders} <span class="ranking-unit">${r.orders === 1 ? 'ped.' : 'peds.'}</span>`;
            secondaryVal = `${anaFormatNoSymbol(r.sales)} €`;
            metaText = `Media ${anaFormatNoSymbol(avgTicket)} €/ped · ${sharePct}% ped.`;
        }

        return `
            <button type="button" class="ranking-card ${topCls}" onclick="handleRankingCardClick(${idx})">
                <div class="rank-badge ${badgeCls}">${rankNum}</div>
                <div class="ranking-card-info">
                    <div class="ranking-shop-name">${escapeRankingHtml(r.name)}</div>
                    <div class="ranking-order-count">${metaText}</div>
                    <div class="ranking-bar-track">
                        <div class="ranking-bar-fill" style="width: ${barPct}%;"></div>
                    </div>
                </div>
                <div class="ranking-metric-col">
                    <div class="ranking-amount">${primaryVal}</div>
                    <div class="ranking-sub-metric">${secondaryVal}</div>
                </div>
            </button>
        `;
    }).join('');
}

function handleRankingCardClick(idx) {
    if (!_rankingState || !_rankingState.filteredList) return;
    const item = _rankingState.filteredList[idx];
    if (!item) return;
    if (item.code !== null && item.code !== undefined && String(item.code) !== 'null') {
        closeRankingModal();
        openClientDetailModal(item.code);
    } else {
        alert(`No se ha encontrado una ficha para la tienda: ${item.name}`);
    }
}

function closeRankingModal() {
    const modal = document.getElementById('rankingModal');
    if (modal) modal.classList.remove('open');
}

// Globales
window.renderTotales = renderTotales;
window.renderAlertas = renderAlertas;
window.renderVentas = renderVentas;
window.handleSalesUpdate = handleSalesUpdate;
window.renderMedias = renderMedias;
window.openRankingModal = openRankingModal;
window.closeRankingModal = closeRankingModal;
window.switchRankingSort = switchRankingSort;
window.filterRankingList = filterRankingList;
window.clearRankingSearch = clearRankingSearch;
window.handleRankingCardClick = handleRankingCardClick;
// --- OBJETIVOS VIEW (V7 + SOPORTE POR AÑO) ---
async function renderObjetivos(isBack = false, selectedYear = null) {
    if (typeof updateHistoryState === 'function') updateHistoryState('objetivos', isBack);
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Objetivos Mensuales');

    const currentYear = new Date().getFullYear();
    const targetYear = selectedYear !== null && selectedYear !== undefined
        ? parseInt(selectedYear, 10)
        : (window._objSelectedYear || currentYear);
    window._objSelectedYear = targetYear;

    const [goals, goalsHistory] = await Promise.all([
        dataManager.getDetailedGoals(targetYear),
        dataManager.getGoalsHistory()
    ]);

    const yearSet = new Set([currentYear, currentYear + 1, targetYear]);
    Object.keys(goalsHistory || {}).forEach(y => {
        const numY = parseInt(y, 10);
        if (!Number.isNaN(numY) && numY >= 2023) yearSet.add(numY);
    });
    const objYears = Array.from(yearSet).sort((a, b) => a - b);

    // Cálculo de Totales Anuales
    const total3 = (goals.data3 || []).reduce((a, b) => a + (b || 0), 0);
    const total4 = (goals.data4 || []).reduce((a, b) => a + (b || 0), 0);
    const total5 = (goals.data5 || []).reduce((a, b) => a + (b || 0), 0);

    let contentHtml = `<main class="objetivos-v7-wrapper">
        <div class="v7-obj-table card shadow-xl">
            <!-- SELECTOR DE AÑO (Objetivos guardados por año) -->
            <div class="v7-obj-yearbar">
                <span class="v7-obj-yearbar-label">Objetivos año</span>
                <div class="v7-obj-yearbar-pills">
                    ${objYears.map(y => `
                        <button type="button"
                                class="v7-obj-year-btn ${y === targetYear ? 'is-active' : ''}"
                                onclick="renderObjetivos(true, ${y})">${y}</button>
                    `).join('')}
                </div>
            </div>

            <!-- CABECERA -->
            <div class="v7-obj-header">
                <div class="col-label">MES</div>
                <div class="v7-pill p3">3 %</div>
                <div class="v7-pill p4">4 %</div>
                <div class="v7-pill p5">5 %</div>
            </div>

            <!-- CUERPO DE LA TABLA (12 MESES) -->
            <div class="v7-obj-body">
                ${ANA_MONTHS.map((m, i) => `
                    <div class="v7-obj-row">
                        <div class="v7-month-name">${m}</div>
                        <div class="v7-col-val">
                            <input type="text" class="v7-input v7-val-3" value="${anaFormatNoSymbol(goals.data3[i])}" onfocus="this.select()" onchange="handleGoalUpdate(3, ${i}, this.value, ${targetYear})">
                        </div>
                        <div class="v7-col-val">
                            <input type="text" class="v7-input v7-val-4" value="${anaFormatNoSymbol(goals.data4[i])}" onfocus="this.select()" onchange="handleGoalUpdate(4, ${i}, this.value, ${targetYear})">
                        </div>
                        <div class="v7-col-val">
                            <input type="text" class="v7-input v7-val-5" value="${anaFormatNoSymbol(goals.data5[i])}" onfocus="this.select()" onchange="handleGoalUpdate(5, ${i}, this.value, ${targetYear})">
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- FILA DE TOTALES ANUALES -->
            <div class="v7-obj-row total-row">
                <div class="v7-total-label">TOTAL</div>
                <div class="v7-total-val">${anaFormatNoSymbol(total3)}</div>
                <div class="v7-total-val">${anaFormatNoSymbol(total4)}</div>
                <div class="v7-total-val">${anaFormatNoSymbol(total5)}</div>
            </div>
        </div>
    </main>`;

    contentHtml += renderBottomNav(null);
    app.innerHTML = headerHtml + contentHtml;
    if (window.restoreScroll) window.restoreScroll();
}

async function handleGoalUpdate(level, monthIdx, value, year = null) {
    const cleanValue = value.toString().replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleanValue);
    const targetYear = year !== null && year !== undefined ? parseInt(year, 10) : (window._objSelectedYear || new Date().getFullYear());

    await dataManager.updateGoal(level, monthIdx, Number.isNaN(num) ? 0 : num, targetYear);
    renderObjetivos(true, targetYear);
}

// --- FACTURACIÓN REAL ---
async function renderFactura(isBack = false, preserveScrollLeft = null) {
    const history = await dataManager.getInvoiceHistory();
    const currentYear = new Date().getFullYear();
    const years = getAnalyticsYears(history);

    // Sincronizar snapshot del año actual con sus objetivos vigentes
    const currentGoals = await dataManager.getDetailedGoals();
    await dataManager.saveGoalsSnapshot(currentYear, currentGoals);

    const goalsPerYear = {};
    for (const y of years) {
        goalsPerYear[y] = await dataManager.getGoalsForYear(y);
    }

    const annualTotals = {};
    years.forEach(y => {
        const data = history[String(y)] || Array(12).fill(0);
        annualTotals[y] = data.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    });

    renderAnalyticsTableView({
        title: 'Facturación Real',
        isBack,
        stateKey: 'factura',
        scrollId: 'facturaScrollContainer',
        years,
        currentYear,
        preserveScrollLeft,
        footerHtml: '',
        buildCellFn: (y, _yIdx, mIdx) => {
            const yearData = history[String(y)] || Array(12).fill(0);
            const val = parseFloat(yearData[mIdx]) || 0;
            const goals = goalsPerYear[y];
            const tier = getCommissionTierInfo(val, goals, mIdx);

            let innerHtml = '';
            if (val === 0) {
                innerHtml = `<span class="ana-empty-dash">—</span>`;
            } else if (tier) {
                innerHtml = `
                    <div class="ana-tier-box is-${tier.tierKey}">
                        <div class="ana-tier-top">
                            <span class="ana-val-main">${anaFormatNoSymbol(val)}</span>
                            <span class="ana-pct-badge">${tier.pct}%</span>
                        </div>
                        <div class="ana-prog-track">
                            <div class="ana-prog-fill" style="width:${tier.progressPct}%;"></div>
                        </div>
                    </div>
                `;
            } else {
                innerHtml = `<span class="ana-val-main is-plain">${anaFormatNoSymbol(val)}</span>`;
            }

            return `
                <button type="button" class="ana-cell-btn" onclick="openAnalyticsEditModal('factura', ${y}, ${mIdx})">
                    ${innerHtml}
                </button>
            `;
        },
        buildTotalCellFn: (y) => {
            const total = annualTotals[y] || 0;
            const annTier = getAnnualCommissionTier(total, goalsPerYear[y]);
            if (annTier) {
                return `
                    <div class="ana-total-tier-pill is-${annTier.tierKey}">
                        <span class="ana-total-tier-val">${anaFormatNoSymbol(total)}</span>
                        <span class="ana-total-tier-tag">${annTier.pct}%</span>
                    </div>
                `;
            }
            return `<span class="ana-total-num ${y === currentYear ? 'is-current' : ''}">${anaFormatNoSymbol(total)}</span>`;
        }
    });
}

async function handleFacturaUpdate(year, monthIdx, value, preserveScrollLeft = null) {
    const cleanVal = (value ?? '').toString().replace(/\./g, '').replace(',', '.').trim();
    const num = parseFloat(cleanVal);
    await dataManager.saveInvoiceHistory(year, monthIdx, Number.isNaN(num) ? 0 : num);
    renderFactura(false, preserveScrollLeft);
}

window.renderObjetivos = renderObjetivos;
window.handleGoalUpdate = handleGoalUpdate;
window.renderFactura = renderFactura;
window.handleFacturaUpdate = handleFacturaUpdate;
window.openAnalyticsEditModal = openAnalyticsEditModal;
window.closeAnalyticsEditModal = closeAnalyticsEditModal;
window.saveAnalyticsEditModal = saveAnalyticsEditModal;
window.applyCalculatedOrderSales = applyCalculatedOrderSales;

// --- COMISIONES ---
async function renderComisiones(isBack = false) {
    const history = await dataManager.getInvoiceHistory();
    const currentYear = new Date().getFullYear();
    const years = getAnalyticsYears(history);

    // Sincronizar snapshot del año en curso
    const currentGoals = await dataManager.getDetailedGoals();
    await dataManager.saveGoalsSnapshot(currentYear, currentGoals);

    const goalsPerYear = {};
    for (const y of years) {
        goalsPerYear[y] = await dataManager.getGoalsForYear(y);
    }

    const annualCommissions = {};
    const annualFacturado = {};
    years.forEach(y => {
        const data = history[String(y)] || Array(12).fill(0);
        let commTotal = 0;
        let invTotal = 0;
        for (let m = 0; m < 12; m++) {
            const val = parseFloat(data[m]) || 0;
            invTotal += val;
            const tier = getCommissionTierInfo(val, goalsPerYear[y], m);
            if (tier) commTotal += tier.amount;
        }
        annualCommissions[y] = commTotal;
        annualFacturado[y] = invTotal;
    });

    renderAnalyticsTableView({
        title: 'Comisiones',
        isBack,
        stateKey: 'comisiones',
        scrollId: 'comisionesScrollContainer',
        years,
        currentYear,
        footerHtml: '',
        buildCellFn: (y, _yIdx, mIdx) => {
            const goals = goalsPerYear[y];
            if (!goals) {
                return `<div class="ana-cell-static"><span class="ana-empty-dash">—</span></div>`;
            }
            const yearData = history[String(y)] || Array(12).fill(0);
            const val = parseFloat(yearData[mIdx]) || 0;
            const tier = getCommissionTierInfo(val, goals, mIdx);
            if (!tier) {
                return `<div class="ana-cell-static"><span class="ana-empty-dash">—</span></div>`;
            }
            return `
                <div class="ana-cell-static">
                    <div class="ana-tier-box is-${tier.tierKey}">
                        <div class="ana-tier-top">
                            <span class="ana-val-main">${anaFormatNoSymbol(tier.amount)}</span>
                            <span class="ana-pct-badge">${tier.pct}%</span>
                        </div>
                        <span class="ana-base-sub">Base: ${anaFormatNoSymbol(val)}</span>
                    </div>
                </div>
            `;
        },
        buildTotalCellFn: (y) => {
            const goals = goalsPerYear[y];
            if (!goals) {
                return `<span class="ana-empty-dash">—</span>`;
            }
            const totalComm = annualCommissions[y] || 0;
            const totalInv = annualFacturado[y] || 0;
            const annTier = getAnnualCommissionTier(totalInv, goals);
            if (annTier) {
                return `
                    <div class="ana-total-tier-pill is-${annTier.tierKey}">
                        <span class="ana-total-tier-val">${anaFormatNoSymbol(totalComm)}</span>
                        <span class="ana-total-tier-tag">${annTier.pct}%</span>
                    </div>
                `;
            }
            return `<span class="ana-total-num ${y === currentYear ? 'is-current' : ''}">${anaFormatNoSymbol(totalComm)}</span>`;
        }
    });
}

window.renderComisiones = renderComisiones;

// --- OBJETIVOS TRIMESTRALES (V2 COMPACTO POR AÑO) ---
const QUARTERLY_META = [
    { key: 'q1', idx: 0, title: '1er Trimestre', months: 'Ene – Mar' },
    { key: 'q2', idx: 1, title: '2º Trimestre', months: 'Abr – Jun' },
    { key: 'q3', idx: 2, title: '3er Trimestre', months: 'Jul – Sep' },
    { key: 'q4', idx: 3, title: '4º Trimestre', months: 'Oct – Dic' }
];

function getQuarterStatusInfo(targetYear, qIdx, targetVal, actualVal) {
    if (!targetVal || targetVal <= 0) {
        return { key: 'pending', label: 'Sin objetivo', pct: 0 };
    }
    const pct = Math.max(0, Math.round((actualVal / targetVal) * 100));
    if (actualVal >= targetVal) {
        return { key: 'success', label: 'Conseguido', pct };
    }
    const now = new Date();
    const nowYear = now.getFullYear();
    const nowQuarter = Math.floor(now.getMonth() / 3);
    if (targetYear < nowYear || (targetYear === nowYear && qIdx < nowQuarter)) {
        return { key: 'danger', label: 'No conseguido', pct };
    }
    if (targetYear === nowYear && qIdx === nowQuarter) {
        return { key: 'progress', label: 'En curso', pct };
    }
    return { key: 'pending', label: 'Pendiente', pct };
}

async function renderObjetivosTrimestrales(isBack = false, selectedYear = null) {
    if (typeof updateHistoryState === 'function') updateHistoryState('trimestrales', isBack);
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Objetivos Trimestrales');

    const nowYear = new Date().getFullYear();
    const targetYear = selectedYear !== null && selectedYear !== undefined
        ? parseInt(selectedYear, 10)
        : (window._trimSelectedYear || nowYear);
    window._trimSelectedYear = targetYear;

    const [quarterly, invoiceHistory, availableYears] = await Promise.all([
        dataManager.getQuarterlyGoals(targetYear),
        dataManager.getInvoiceHistory(),
        dataManager.getQuarterlyGoalYears()
    ]);

    const yearSet = new Set([...(availableYears || []), targetYear]);
    const trimYears = Array.from(yearSet).sort((a, b) => a - b);

    const yearInvoices = invoiceHistory[String(targetYear)] || Array(12).fill(0);
    const sumRange = (start) =>
        (parseFloat(yearInvoices[start]) || 0) +
        (parseFloat(yearInvoices[start + 1]) || 0) +
        (parseFloat(yearInvoices[start + 2]) || 0);

    const autoValues = {
        q1: sumRange(0),
        q2: sumRange(3),
        q3: sumRange(6),
        q4: sumRange(9)
    };

    const cardsHtml = QUARTERLY_META.map(meta => {
        const qData = quarterly[meta.key] || { target: 0 };
        const targetVal = parseFloat(qData.target) || 0;
        const actualVal = autoValues[meta.key] || 0;
        const status = getQuarterStatusInfo(targetYear, meta.idx, targetVal, actualVal);
        const diff = actualVal - targetVal;
        const barWidth = targetVal > 0 ? Math.min(100, Math.max(actualVal > 0 ? 4 : 0, status.pct)) : 0;

        let diffText = '—';
        if (targetVal > 0) {
            diffText = `${diff >= 0 ? '+' : '-'}${anaFormatNoSymbol(Math.abs(diff))} €`;
        }
        const pctLabel = targetVal > 0 ? `${status.pct}% logrado` : 'Sin definir';
        const targetDisplay = targetVal > 0 ? `${anaFormatNoSymbol(targetVal)} €` : 'Definir';

        return `
            <article class="trim-q-card is-${status.key}">
                <div class="trim-q-head">
                    <div class="trim-q-title-wrap">
                        <span class="trim-q-title">${meta.title}</span>
                        <span class="trim-q-months">${meta.months}</span>
                    </div>
                    <span class="trim-status-pill is-${status.key}">${status.label}</span>
                </div>

                <div class="trim-q-metrics">
                    <div class="trim-metric-col">
                        <span class="trim-metric-lbl">Facturado</span>
                        <span class="trim-metric-val is-facturado">${anaFormatNoSymbol(actualVal)} €</span>
                    </div>

                    <div class="trim-metric-col is-center">
                        <span class="trim-metric-lbl">Objetivo</span>
                        <button type="button" class="trim-target-btn" onclick="openQuarterlyEditModal(${targetYear}, '${meta.key}')">
                            <span>${targetDisplay}</span>
                            <span class="material-icons-round">edit</span>
                        </button>
                    </div>

                    <div class="trim-metric-col is-right">
                        <span class="trim-metric-lbl">${pctLabel}</span>
                        <span class="trim-metric-val is-${status.key}">${diffText}</span>
                    </div>
                </div>

                <div class="trim-prog-track">
                    <div class="trim-prog-fill is-${status.key}" style="width: ${barWidth}%;"></div>
                </div>
            </article>
        `;
    }).join('');

    let contentHtml = `<main class="trim-v2-wrapper">
        <div class="trim-yearbar">
            <span class="trim-yearbar-label">Objetivos año</span>
            <div class="trim-yearbar-pills">
                ${trimYears.map(y => `
                    <button type="button"
                            class="trim-year-pill ${y === targetYear ? 'is-active' : ''}"
                            onclick="renderObjetivosTrimestrales(true, ${y})">${y}</button>
                `).join('')}
            </div>
        </div>
        <div class="trim-grid">
            ${cardsHtml}
        </div>
    </main>`;

    contentHtml += renderBottomNav(null);
    app.innerHTML = headerHtml + contentHtml;
    if (window.restoreScroll) window.restoreScroll();
}

let _quarterlyEditState = null;

async function openQuarterlyEditModal(year, qKey) {
    let modal = document.getElementById('analyticsEditModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'analyticsEditModal';
        modal.className = 'modal-overlay';
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeAnalyticsEditModal();
        });
        document.body.appendChild(modal);
    }

    const [quarterly, invoiceHistory] = await Promise.all([
        dataManager.getQuarterlyGoals(year),
        dataManager.getInvoiceHistory()
    ]);

    const meta = QUARTERLY_META.find(m => m.key === qKey) || QUARTERLY_META[0];
    const currentTarget = (quarterly[qKey] && parseFloat(quarterly[qKey].target)) || 0;
    const invoices = invoiceHistory[String(year)] || Array(12).fill(0);
    const startIdx = meta.idx * 3;
    const actualVal =
        (parseFloat(invoices[startIdx]) || 0) +
        (parseFloat(invoices[startIdx + 1]) || 0) +
        (parseFloat(invoices[startIdx + 2]) || 0);

    _quarterlyEditState = { year, qKey, quarterly };
    const inputDisplay = currentTarget > 0 ? anaFormatNoSymbol(currentTarget) : '';

    modal.innerHTML = `
        <div class="ana-modal-card" role="dialog" aria-modal="true" aria-label="Editar objetivo trimestral">
            <div class="ana-modal-head">
                <div>
                    <h3 class="ana-modal-title">${meta.title} ${year}</h3>
                    <span class="ana-modal-sub">${meta.months} · Objetivos Trimestrales</span>
                </div>
                <button type="button" class="ana-modal-close" onclick="closeAnalyticsEditModal()" aria-label="Cerrar">
                    <span class="material-icons-round">close</span>
                </button>
            </div>
            <div class="ana-modal-body">
                <label class="ana-modal-label" for="quarterlyModalInput">Objetivo del trimestre</label>
                <div class="ana-modal-input-wrap">
                    <input type="text"
                           id="quarterlyModalInput"
                           class="ana-modal-input"
                           inputmode="decimal"
                           data-no-clear="true"
                           value="${inputDisplay}"
                           placeholder="0"
                           onkeydown="if(event.key==='Enter'){ event.preventDefault(); saveQuarterlyEditModal(); }">
                    <span class="ana-modal-euro">€</span>
                </div>
                <div class="ana-modal-context">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                        <span>Facturado real (${meta.months}):</span>
                        <strong>${anaFormatNoSymbol(actualVal)} €</strong>
                    </div>
                </div>
            </div>
            <div class="ana-modal-actions">
                <button type="button" class="ana-btn-cancel" onclick="closeAnalyticsEditModal()">Cancelar</button>
                <button type="button" class="ana-btn-save" onclick="saveQuarterlyEditModal()">Guardar</button>
            </div>
        </div>
    `;

    modal.classList.add('open');
    setTimeout(() => {
        const input = document.getElementById('quarterlyModalInput');
        if (input) {
            input.focus();
            input.select();
        }
    }, 60);
}

async function saveQuarterlyEditModal() {
    if (!_quarterlyEditState) return;
    const { year, qKey, quarterly } = _quarterlyEditState;
    const input = document.getElementById('quarterlyModalInput');
    const clean = (input ? input.value : '0').toString().replace(/\./g, '').replace(',', '.').trim();
    const targetNum = parseFloat(clean);

    const updated = {
        q1: { target: (quarterly.q1 && parseFloat(quarterly.q1.target)) || 0 },
        q2: { target: (quarterly.q2 && parseFloat(quarterly.q2.target)) || 0 },
        q3: { target: (quarterly.q3 && parseFloat(quarterly.q3.target)) || 0 },
        q4: { target: (quarterly.q4 && parseFloat(quarterly.q4.target)) || 0 }
    };
    updated[qKey] = { target: Number.isNaN(targetNum) ? 0 : targetNum };

    closeAnalyticsEditModal();
    await dataManager.saveQuarterlyGoals(year, updated);
    renderObjetivosTrimestrales(true, year);
}

window.renderObjetivosTrimestrales = renderObjetivosTrimestrales;
window.openQuarterlyEditModal = openQuarterlyEditModal;
window.saveQuarterlyEditModal = saveQuarterlyEditModal;













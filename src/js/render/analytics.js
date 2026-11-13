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

    const callSvg = `
        <svg viewBox="0 0 24 24" width="21" height="21" fill="#ffffff" aria-hidden="true">
            <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.46.57 3.58a1 1 0 0 1-.25 1.01l-2.2 2.2z"/>
        </svg>`;

    const whatsappSvg = `
        <svg viewBox="0 0 32 32" width="23" height="23" fill="#ffffff" aria-hidden="true">
            <path d="M16 3C8.82 3 3 8.82 3 16c0 2.48.7 4.8 1.91 6.77L3.4 28.6l6-1.48A12.93 12.93 0 0 0 16 29c7.18 0 13-5.82 13-13S23.18 3 16 3zm7.58 18.23c-.32.9-1.87 1.72-2.6 1.83-.66.1-1.5.14-2.42-.15-.56-.18-1.28-.42-2.2-.82-3.87-1.67-6.4-5.58-6.6-5.84-.2-.26-1.57-2.09-1.57-3.99s.99-2.83 1.35-3.22c.35-.39.77-.49 1.03-.49.26 0 .51 0 .74.01.24.01.56-.09.87.67.32.77 1.09 2.66 1.18 2.86.1.19.16.42.03.68-.13.26-.2.42-.39.64-.19.23-.41.51-.58.68-.19.19-.4.4-.17.79.23.39 1.01 1.66 2.17 2.69 1.49 1.33 2.75 1.74 3.14 1.94.39.19.62.16.85-.1.23-.26.97-1.13 1.23-1.52.26-.39.52-.32.87-.19.35.13 2.25 1.06 2.64 1.25.39.19.64.29.74.45.1.16.1.94-.22 1.84z"/>
        </svg>`;

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
                        <button type="button"
                                class="btn-alert-circle btn-alert-call ${hasPhone ? '' : 'is-disabled'}"
                                onclick="event.stopPropagation(); ${hasPhone ? `window.location.href='tel:${cleanCallPhone}'` : ''}"
                                title="${hasPhone ? 'Llamar' : 'Sin teléfono'}">
                            ${callSvg}
                        </button>
                        <button type="button"
                                class="btn-alert-circle btn-alert-whatsapp ${hasPhone ? '' : 'is-disabled'}"
                                onclick="event.stopPropagation(); ${hasPhone ? `window.openAppWhatsApp('${cleanWaPhone}')` : ''}"
                                title="${hasPhone ? 'WhatsApp' : 'Sin teléfono'}">
                            ${whatsappSvg}
                        </button>
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

// --- VENTAS HISTÓRICAS ---
async function renderVentas(isBack = false) {
    if (typeof updateHistoryState === 'function') updateHistoryState('ventas', isBack);
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Ventas Mensuales');
    const history = await dataManager.getSalesHistory();
    const allOrders = await dataManager.getOrders();

    // Calcular totales de pedidos por año y mes
    const calculatedTotals = {};
    allOrders.forEach(o => {
        const d = new Date(o.dateISO);
        const y = d.getFullYear();
        const m = d.getMonth();
        if (!calculatedTotals[y]) calculatedTotals[y] = Array(12).fill(0);
        calculatedTotals[y][m] += (parseFloat(o.amount) || 0);
    });

    const years = Object.keys(history).map(Number).sort((a,b) => a - b);
    const monthsFull = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    // Cálculo de Totales por Año (considerando el mayor entre manual y calculado)
    const totalsByYear = {};
    years.forEach(y => {
        let yearTotal = 0;
        for (let mIdx = 0; mIdx < 12; mIdx++) {
            const hVal = (history[y] && history[y][mIdx]) || 0;
            const cVal = (calculatedTotals[y] && calculatedTotals[y][mIdx]) || 0;
            yearTotal += Math.max(hVal, cVal);
        }
        totalsByYear[y] = yearTotal;
    });

        const currentYear = new Date().getFullYear();
    let contentHtml = '<main class="analysis-view-container">';
    
    contentHtml += `
        <div class="analysis-premium-card">
            <div class="analysis-table-wrapper" id="analysisTableWrapper">
                <!-- CABECERA -->
                <div class="analysis-header">
                    <div class="analysis-header-cell col-month-fixed">MES</div>
                    ${years.map(y => `
                        <div class="analysis-header-cell col-year-dynamic ${y === currentYear ? 'current-year-col' : ''}">
                            <span class="year-capsule ${y === currentYear ? 'year-capsule-current' : ''}">${y}</span>
                        </div>
                    `).join('')}
                </div>

                <!-- CUERPO DE LA TABLA -->
                <div class="analysis-body">
                    ${monthsFull.map((m, mIdx) => `
                        <div class="analysis-row">
                            <div class="cell-month-label col-month-fixed">${m}</div>
                            ${years.map((y, yIdx) => {
                                const storedVal = (history[y] && history[y][mIdx]) || 0;
                                const calcVal = (calculatedTotals[y] && calculatedTotals[y][mIdx]) || 0;
                                const val = Math.max(storedVal, calcVal);

                                let growthClass = '';
                                if (yIdx > 0 && val > 0) {
                                    const prevY = years[yIdx - 1];
                                    const prevStored = (history[prevY] && history[prevY][mIdx]) || 0;
                                    const prevCalc = (calculatedTotals[prevY] && calculatedTotals[prevY][mIdx]) || 0;
                                    const prevVal = Math.max(prevStored, prevCalc);
                                    
                                    if (prevVal > 0) {
                                        if (val > prevVal) growthClass = 'v-val-up';
                                        else if (val < prevVal) growthClass = 'v-val-down';
                                    }
                                }

                                const isCurrent = y === currentYear ? 'current-year-col' : '';

                                return `
                                    <div class="cell-data-input col-year-dynamic ${isCurrent}">
                                        <input type="text" 
                                               class="v-input-premium ${growthClass} ${y === currentYear ? 'v-input-current' : ''}" 
                                               value="${val === 0 ? '-' : formatCurrency(Math.round(val)).replace(' \u20ac', '')}"
                                               onfocus="this.select()"
                                               onchange="handleSalesUpdate(${y}, ${mIdx}, this.value)">
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `).join('')}
                </div>

                <!-- FILA DE TOTALES -->
                <div class="analysis-total-row">
                    <div class="cell-total-label col-month-fixed">TOTAL</div>
                    ${years.map((y, idx) => {
                        const total = totalsByYear[y];
                        let variationHtml = '';
                        
                        if (idx > 0) {
                            const prevTotal = totalsByYear[years[idx-1]];
                            if (prevTotal > 0) {
                                const diff = ((total - prevTotal) / prevTotal) * 100;
                                const isUp = diff > 0;
                                const isDown = diff < 0;
                                variationHtml = `<span class="variation-badge ${isUp ? 'var-up' : (isDown ? 'var-down' : 'var-neutral')}">
                                    ${isUp ? '+' : ''}${Math.round(diff)}%
                                </span>`;
                            }
                        }
                        
                        const isCurrent = y === currentYear ? 'current-year-col' : '';

                        return `
                            <div class="cell-year-total-complex col-year-dynamic ${isCurrent}">
                                <span class="total-value-main ${y === currentYear ? 'v-input-current' : ''}">${formatCurrency(Math.round(total)).replace(' \u20ac', '')}</span>
                                ${variationHtml}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    </main>`;

    contentHtml += renderBottomNav(null);
    app.innerHTML = headerHtml + contentHtml; if(window.restoreScroll) window.restoreScroll();

    // Autoscroll al final (año actual)
    setTimeout(() => {
        const wrapper = document.getElementById('analysisTableWrapper');
        if (wrapper) wrapper.scrollLeft = wrapper.scrollWidth;
    }, 100);
}

async function handleSalesUpdate(year, monthIdx, value) {
    const num = parseFloat(value.replace(/\./g, '').replace(',', '.'));
    await dataManager.updateSalesHistory(year, monthIdx, isNaN(num) ? 0 : num);
    renderVentas();
}

// --- MEDIAS MENSUALES ---
async function renderMedias(isBack = false) {
    if (typeof updateHistoryState === 'function') updateHistoryState('medias', isBack);
    const app = document.getElementById('app');
    const history = await dataManager.getSalesHistory();
    const currentYear = new Date().getFullYear();
    const validYears = Object.keys(history).map(Number).filter(y => y < currentYear).sort();
    const numYears = validYears.length;
    const yearsLabel = numYears === 1 ? 'año' : 'años';
    
    const headerHtml = getCommonHeaderHtml(`
        <div style="display: flex; flex-direction: column; line-height: 1.2; padding: 2px 0;">
            <span style="font-size: 1.4rem; font-weight: 950; letter-spacing: -0.5px;">Medias Mensuales</span>
            <span style="font-size: 0.95rem; font-weight: 600; font-style: italic; color: #fff; margin-top: 2px;">(${numYears} ${yearsLabel})</span>
        </div>
    `);
    
    const monthsNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const averages = monthsNames.map((_, i) => {
        if (validYears.length === 0) return 0;
        const sum = validYears.reduce((acc, y) => acc + (history[y][i] || 0), 0);
        return Math.floor(sum / validYears.length);
    });

    let contentHtml = '<main class="medias-container" style="padding-top: 1.5rem !important;">';
    
    // Contenedor Cuadrícula 3x4
    contentHtml += '<div class="months-grid">';
    averages.forEach((val, i) => {
        const formattedVal = Math.round(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        contentHtml += `
            <div class="month-card">
                <span class="month-card-title">${monthsNames[i]}</span>
                <span class="month-card-value">${formattedVal}</span>
            </div>
        `;
    });
    contentHtml += '</div>';
    
    // Tarjeta Resumen Anual Premium
    const totalAvg = Math.floor(averages.reduce((a,b) => a+b, 0));
    const formattedTotal = Math.round(totalAvg).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    contentHtml += `
        <div class="annual-media-card">
            <p class="annual-title">Media Ventas Anual</p>
            <h2 class="annual-value">${formattedTotal}</h2>
            <div class="annual-chart-deco">
                <span class="material-icons-round" style="font-size: 60px;">trending_up</span>
            </div>
        </div>
    `;

    contentHtml += '</main>';
    contentHtml += renderBottomNav(null);
    app.innerHTML = headerHtml + contentHtml; if(window.restoreScroll) window.restoreScroll();
}

// --- RANKING ---
async function openRankingModal(sortBy = 'sales', searchTerm = '') {
    let modal = document.getElementById('rankingModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'rankingModal';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }

    const orders = await dataManager.getOrders();
    const clientsData = await dataManager.getClients();
    const lookup = dataManager.buildClientLookup(clientsData);

    const currentYear = new Date().getFullYear();
    const yearOrders = orders.filter(o => o.year === currentYear);
    
    const stats = {};
    yearOrders.forEach(o => {
        const c = dataManager.resolveClientForOrder(o, lookup);
        const key = c ? `code_${c.code}` : `shop_${normalizeTextKey(o.shop)}`;
        const displayName = c ? c.name : o.shop;
        if (!stats[key]) {
            stats[key] = { 
                name: displayName,
                sales: 0, 
                orders: 0, 
                code: c ? c.code : (o.clientCode || null)
            };
        }
        stats[key].sales += (o.amount || 0);
        stats[key].orders++;
    });

    // Lógica de Ordenación COMPLETA para obtener posiciones reales
    let ranking = Object.values(stats).map(s => ({ ...s }));
    
    if (sortBy === 'sales') {
        ranking.sort((a, b) => b.sales - a.sales);
    } else {
        ranking.sort((a, b) => {
            if (b.orders !== a.orders) return b.orders - a.orders;
            return b.sales - a.sales;
        });
    }

    // Asignar posición original antes de filtrar
    ranking = ranking.map((r, i) => ({ ...r, originalRank: i + 1 }));
    
    // Filtrado por buscador (ignorando tildes)
    if (searchTerm) {
        const normSearch = normalizeTextKey(searchTerm);
        if (normSearch) {
            ranking = ranking.filter(r => normalizeTextKey(r.name).includes(normSearch));
        }
    }
    
    modal.innerHTML = `
        <div class="modal-content" style="max-height: 85vh; width: 95%; max-width: 480px; border-radius: 20px; display: flex; flex-direction: column; overflow: hidden;">
            <!-- CABECERA FIJA AZUL -->
            <div class="modal-header" style="background: #009ee3; color: white; padding: 1.25rem 1.5rem; border: none; flex-shrink: 0;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="material-icons-round">emoji_events</span>
                    <h2 class="text-lg font-black" style="letter-spacing: 0.5px;">Ranking ${currentYear}</h2>
                </div>
                <button class="icon-btn" onclick="closeRankingModal()" style="background: rgba(255,255,255,0.2); border-radius: 12px; color: white;">
                    <span class="material-icons-round">close</span>
                </button>
            </div>
            
            <!-- CONTROLES FIJOS (PESTAÑAS Y BUSCADOR) -->
            <div style="padding: 1.25rem 1.5rem 0.5rem 1.5rem; background: #fff; flex-shrink: 0; border-bottom: 1px solid #f1f5f9;">
                <div class="ranking-tabs-container" style="margin-bottom: 1rem;">
                    <button class="ranking-tab-btn ${sortBy === 'sales' ? 'active' : ''}" onclick="openRankingModal('sales', document.getElementById('rankSearch')?.value || '')">
                        Por Ventas
                    </button>
                    <button class="ranking-tab-btn ${sortBy === 'pedidos' ? 'active' : ''}" onclick="openRankingModal('pedidos', document.getElementById('rankSearch')?.value || '')">
                        Por Pedidos
                    </button>
                </div>

                <div class="pro-search-bar" style="margin-bottom: 0.75rem;">
                    <span class="material-icons-round pro-search-icon">search</span>
                    <input type="text" id="rankSearch" class="pro-search-input"
                           placeholder="Buscar tienda..." 
                           value="${searchTerm}"
                           oninput="openRankingModal('${sortBy}', this.value)"
                           autocomplete="off">
                    <div class="pro-search-actions">
                        ${searchTerm ? `
                        <button type="button" class="pro-search-clear-btn" style="display: inline-flex;" onclick="openRankingModal('${sortBy}', '')" title="Borrar búsqueda">
                            <span class="material-icons-round">close</span>
                        </button>
                        ` : ''}
                        <button type="button" class="pro-search-mic-btn" onclick="window.toggleVoiceDictation('rankSearch', this, (val) => openRankingModal('${sortBy}', val))" title="Buscar por voz">
                            <span class="material-icons-round">mic</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- LISTA DESPLAZABLE -->
            <div class="modal-body overflow-y-auto" style="padding: 1rem 1.5rem; flex: 1; background: #fff;">
                <div class="flex flex-col" style="padding-right: 4px;">
                    ${ranking.length > 0 ? ranking.map((r) => {
                        const rankNum = r.originalRank;
                        let badgeClass = '';
                        if (rankNum === 1) badgeClass = 'rank-badge-1';
                        else if (rankNum === 2) badgeClass = 'rank-badge-2';
                        else if (rankNum === 3) badgeClass = 'rank-badge-3';
                        
                        return `
                            <div class="ranking-card" 
                                 style="cursor: pointer;" 
                                 onclick="if('${r.code}' !== 'null') { closeRankingModal(); openClientDetailModal('${r.code}'); } else { alert('No se ha encontrado una ficha para la tienda: ${r.name}'); }">
                                <div class="rank-badge ${badgeClass}">${rankNum}</div>
                                <div style="flex-grow: 1;">
                                    <p class="ranking-shop-name">${r.name}</p>
                                    <p class="ranking-order-count">${r.orders} ${r.orders === 1 ? 'pedido' : 'pedidos'}</p>
                                </div>
                                <div class="ranking-amount">
                                    ${formatCurrency(Math.round(r.sales)).replace(' €', '')}<span style="font-size: 11px; margin-left: 2px;">€</span>
                                </div>
                            </div>
                        `;
                    }).join('') : `
                        <div style="text-align: center; padding: 2rem; color: #94a3b8; font-weight: 700;">
                            No se encontraron clientes para "${searchTerm}"
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
    modal.classList.add('open');

    // Mantener foco si estamos buscando
    if (searchTerm) {
        const input = document.getElementById('rankSearch');
        input.focus();
        input.setSelectionRange(searchTerm.length, searchTerm.length);
    }
}

function closeRankingModal() {
    document.getElementById('rankingModal').classList.remove('open');
}

// Globales
window.renderTotales = renderTotales;
window.renderAlertas = renderAlertas;
window.renderVentas = renderVentas;
window.handleSalesUpdate = handleSalesUpdate;
window.renderMedias = renderMedias;
window.openRankingModal = openRankingModal;
window.closeRankingModal = closeRankingModal;
// --- OBJETIVOS VIEW (REDiseño V7 - SINGLE SCREEN) ---
async function renderObjetivos(isBack = false) {
    if (typeof updateHistoryState === 'function') updateHistoryState('objetivos', isBack);
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Objetivos Mensuales');
    const goals = await dataManager.getDetailedGoals();
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    // Cálculo de Totales Anuales
    const total3 = (goals.data3 || []).reduce((a, b) => a + (b || 0), 0);
    const total4 = (goals.data4 || []).reduce((a, b) => a + (b || 0), 0);
    const total5 = (goals.data5 || []).reduce((a, b) => a + (b || 0), 0);

    let contentHtml = `<main class="objetivos-v7-wrapper">
        <div class="v7-obj-table card shadow-xl">
            <!-- CABECERA PROFESIONAL -->
            <div class="v7-obj-header">
                <div class="col-label">MES</div>
                <div class="v7-pill p3">3 %</div>
                <div class="v7-pill p4">4 %</div>
                <div class="v7-pill p5">5 %</div>
            </div>

            <!-- CUERPO DE LA TABLA (12 MESES) -->
            <div class="v7-obj-body">
                ${months.map((m, i) => `
                    <div class="v7-obj-row">
                        <div class="v7-month-name">${m}</div>
                        <div class="v7-col-val">
                            <input type="text" class="v7-input v7-val-3" value="${formatCurrency(Math.round(goals.data3[i])).replace(' €', '')}" onfocus="this.select()" onchange="handleGoalUpdate(3, ${i}, this.value)">
                        </div>
                        <div class="v7-col-val">
                            <input type="text" class="v7-input v7-val-4" value="${formatCurrency(Math.round(goals.data4[i])).replace(' €', '')}" onfocus="this.select()" onchange="handleGoalUpdate(4, ${i}, this.value)">
                        </div>
                        <div class="v7-col-val">
                            <input type="text" class="v7-input v7-val-5" value="${formatCurrency(Math.round(goals.data5[i])).replace(' €', '')}" onfocus="this.select()" onchange="handleGoalUpdate(5, ${i}, this.value)">
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- FILA DE TOTALES ANUALES -->
            <div class="v7-obj-row total-row">
                <div class="v7-total-label">TOTAL</div>
                <div class="v7-total-val">${formatCurrency(Math.round(total3)).replace(' €', '')}</div>
                <div class="v7-total-val">${formatCurrency(Math.round(total4)).replace(' €', '')}</div>
                <div class="v7-total-val">${formatCurrency(Math.round(total5)).replace(' €', '')}</div>
            </div>
        </div>
    </main>`;
    
    contentHtml += renderBottomNav(null);
    app.innerHTML = headerHtml + contentHtml; if(window.restoreScroll) window.restoreScroll();
}

async function handleGoalUpdate(level, monthIdx, value) {
    // Limpiar cualquier separador de miles (puntos) y tratar la coma como decimal si existiera
    const cleanValue = value.toString().replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleanValue);
    
    // Persistir el cambio
    await dataManager.updateGoal(level, monthIdx, isNaN(num) ? 0 : num);
    
    // Forzar el redibujado de la tabla completa (esto actualizará los totales y formateará el input)
    renderObjetivos();
}

// --- FACTURACIÓN REAL (V7 PREMIUM) ---
async function renderFactura(isBack = false) {
    if (typeof updateHistoryState === 'function') updateHistoryState('factura', isBack);
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Facturación Real');
    const history = await dataManager.getInvoiceHistory();

    const currentYear = new Date().getFullYear();
    const years = [2023, 2024, 2025, 2026];
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    // Auto-guardar snapshot del año en curso con los objetivos actuales.
    // Así, cuando el año termine y se acceda desde el año siguiente,
    // los colores del año pasado quedan congelados con los objetivos que estaban vigentes.
    const currentGoals = await dataManager.getDetailedGoals();
    await dataManager.saveGoalsSnapshot(currentYear, currentGoals);

    // Cargar objetivos para cada año:
    //   - Año actual → objetivos activos (live)
    //   - Año pasado con snapshot → snapshot congelada
    //   - Año pasado sin snapshot → null (sin colores)
    const goalsPerYear = {};
    for (const y of years) {
        goalsPerYear[y] = await dataManager.getGoalsForYear(y);
    }

    // Helper: devuelve el color de fondo según el valor vs los tres objetivos del mes
    function getCellColor(value, goals, monthIdx) {
        if (!value || value === 0) return null;   // Celda vacía → sin color
        if (!goals) return null;                   // Sin snapshot → sin color
        const g3 = goals.data3[monthIdx] || 0;
        const g4 = goals.data4[monthIdx] || 0;
        const g5 = goals.data5[monthIdx] || 0;
        if (value >= g5) return '#22c55e';  // Verde  ≥ 5%
        if (value >= g4) return '#007BFF';  // Azul   ≥ 4%
        if (value >= g3) return '#eab308';  // Morado ≥ 3%
        return '#dc2626';                   // Rojo   < 3%
    }

    // Calcular totales por año
    const annualTotals = years.map(y => {
        const data = history[String(y)] || Array(12).fill(0);
        return data.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    });

    let contentHtml = `<main class="v7-factura-wrapper">
        <div class="v7-factura-card">
            <div class="v7-factura-scroll" id="facturaScrollContainer">
                <table class="v7-factura-table">
                    <thead>
                        <tr>
                            <th class="sticky-col">MES</th>
                            ${years.map(y => `<th><span class="v7-year-pill">${y}</span></th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${months.map((m, mIdx) => `
                            <tr class="v7-factura-row">
                                <td class="sticky-col">${m}</td>
                                ${years.map(y => {
                                    const yearData = history[String(y)] || Array(12).fill(0);
                                    const val = yearData[mIdx] || 0;
                                    const color = getCellColor(val, goalsPerYear[y], mIdx);
                                    const tdStyle = color
                                        ? `style="background-color:${color}; border-radius:10px; padding:4px 8px;"`
                                        : '';
                                    const inputClass = color
                                        ? 'v7-factura-input v7-factura-input--colored'
                                        : 'v7-factura-input';
                                    return `
                                        <td ${tdStyle}>
                                            <input type="text" class="${inputClass}"
                                                   value="${val === 0 ? '-' : formatCurrency(Math.round(val)).replace(' €', '')}"
                                                   placeholder="0"
                                                   onfocus="this.select()"
                                                   onchange="handleFacturaUpdate(${y}, ${mIdx}, this.value)">
                                        </td>
                                    `;
                                }).join('')}
                            </tr>
                        `).join('')}
                        <tr class="v7-factura-total-row">
                            <td class="sticky-col" style="color: #0f172a; font-weight: 900 !important; font-size: 14px;">TOTAL</td>
                            ${annualTotals.map(total => `
                                <td>${formatCurrency(Math.round(total)).replace(' €', '')}</td>
                            `).join('')}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Leyenda de colores -->
        <div style="display: flex; justify-content: space-around; align-items: center; padding: 10px 10px; background: white; border-top: 1px solid #f1f5f9; border-radius: 0 0 16px 16px; margin-top: -8px;">
            <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #dc2626;"></div>
                <span style="font-size: 12px; font-weight: 800; color: #64748b;">2%</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #eab308;"></div>
                <span style="font-size: 12px; font-weight: 800; color: #64748b;">3%</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #007BFF;"></div>
                <span style="font-size: 12px; font-weight: 800; color: #64748b;">4%</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #22c55e;"></div>
                <span style="font-size: 12px; font-weight: 800; color: #64748b;">5%</span>
            </div>
        </div>
    </main>`;

    contentHtml += renderBottomNav(null);
    app.innerHTML = headerHtml + contentHtml; if(window.restoreScroll) window.restoreScroll();

    // Auto-scroll al año más reciente
    setTimeout(() => {
        const container = document.getElementById('facturaScrollContainer');
        if (container) container.scrollLeft = container.scrollWidth;
    }, 50);
}

async function handleFacturaUpdate(year, monthIdx, value) {
    const cleanVal = value.toString().replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleanVal);
    await dataManager.saveInvoiceHistory(year, monthIdx, isNaN(num) ? 0 : num);
    renderFactura();
}

window.renderObjetivos = renderObjetivos;
window.handleGoalUpdate = handleGoalUpdate;
window.renderFactura = renderFactura;
window.handleFacturaUpdate = handleFacturaUpdate;

// --- COMISIONES (V7 PREMIUM) ---
async function renderComisiones(isBack = false) {
    if (typeof updateHistoryState === 'function') updateHistoryState('comisiones', isBack);
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Comisiones');
    const history = await dataManager.getInvoiceHistory();

    const currentYear = new Date().getFullYear();
    // Años dinámicos: desde 2023 hasta el año actual
    const years = [];
    for (let y = 2023; y <= currentYear; y++) years.push(y);
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    // Auto-guardar snapshot del año en curso
    const currentGoals = await dataManager.getDetailedGoals();
    await dataManager.saveGoalsSnapshot(currentYear, currentGoals);

    // Cargar objetivos por año (snapshot congelada para pasados, null si no existe)
    const goalsPerYear = {};
    for (const y of years) {
        goalsPerYear[y] = await dataManager.getGoalsForYear(y);
    }

    // Determinar nivel alcanzado y % comisión
    function getCommissionInfo(value, goals, monthIdx) {
        if (!value || value === 0) return { pct: 0, amount: 0, color: null };
        if (!goals) return { pct: 0, amount: 0, color: null }; // Sin snapshot → sin color
        const g3 = goals.data3[monthIdx] || 0;
        const g4 = goals.data4[monthIdx] || 0;
        const g5 = goals.data5[monthIdx] || 0;
        if (value >= g5) return { pct: 5, amount: Math.round(value * 0.05), color: '#22c55e' };
        if (value >= g4) return { pct: 4, amount: Math.round(value * 0.04), color: '#007BFF' };
        if (value >= g3) return { pct: 3, amount: Math.round(value * 0.03), color: '#eab308' };
        return { pct: 2, amount: Math.round(value * 0.02), color: '#dc2626' };
    }

    // Color para el TOTAL anual: comparar total facturado vs suma de objetivos anuales
    function getTotalColor(totalFacturado, goals) {
        if (!totalFacturado || totalFacturado === 0) return null;
        if (!goals) return null;
        const sumG3 = (goals.data3 || []).reduce((a, b) => a + (b || 0), 0);
        const sumG4 = (goals.data4 || []).reduce((a, b) => a + (b || 0), 0);
        const sumG5 = (goals.data5 || []).reduce((a, b) => a + (b || 0), 0);
        if (totalFacturado >= sumG5) return '#22c55e';
        if (totalFacturado >= sumG4) return '#007BFF';
        if (totalFacturado >= sumG3) return '#eab308';
        return '#dc2626';
    }

    // Calcular totales anuales de comisiones y facturación
    const annualCommissions = years.map(y => {
        const data = history[String(y)] || Array(12).fill(0);
        let total = 0;
        for (let m = 0; m < 12; m++) {
            const val = parseFloat(data[m]) || 0;
            const info = getCommissionInfo(val, goalsPerYear[y], m);
            total += info.amount;
        }
        return total;
    });

    const annualFacturado = years.map(y => {
        const data = history[String(y)] || Array(12).fill(0);
        return data.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    });

    let contentHtml = `<main class="v7-factura-wrapper">
        <div class="v7-factura-card">
            <div class="v7-factura-scroll" id="comisionesScrollContainer">
                <table class="v7-factura-table">
                    <thead>
                        <tr>
                            <th class="sticky-col">MES</th>
                            ${years.map(y => `<th><span class="v7-year-pill">${y}</span></th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${months.map((m, mIdx) => `
                            <tr class="v7-factura-row">
                                <td class="sticky-col">${m}</td>
                                ${years.map(y => {
                                    const yearData = history[String(y)] || Array(12).fill(0);
                                    const val = parseFloat(yearData[mIdx]) || 0;
                                    const info = getCommissionInfo(val, goalsPerYear[y], mIdx);
                                    const color = info.color;
                                    const tdStyle = color
                                        ? `style="background-color:${color}; border-radius:10px; padding:4px 8px;"`
                                        : '';
                                    const textClass = color ? 'v7-comision-val v7-comision-val--colored' : 'v7-comision-val';
                                    const displayVal = val === 0 ? '-' : formatCurrency(info.amount).replace(' €', '');
                                    return `
                                        <td ${tdStyle}>
                                            <span class="${textClass}">${displayVal}</span>
                                        </td>
                                    `;
                                }).join('')}
                            </tr>
                        `).join('')}
                        <tr class="v7-factura-total-row">
                            <td class="sticky-col" style="color: #0f172a; font-weight: 900 !important; font-size: 14px;">TOTAL</td>
                            ${years.map((y, yIdx) => {
                                const totalColor = getTotalColor(annualFacturado[yIdx], goalsPerYear[y]);
                                const tdStyle = totalColor
                                    ? `style="background-color:${totalColor} !important; border-radius:10px; color:#ffffff; font-weight:900;"`
                                    : '';
                                const valStr = formatCurrency(Math.round(annualCommissions[yIdx])).replace(' €', '');
                                return `<td ${tdStyle}>${valStr}</td>`;
                            }).join('')}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        
        <!-- Leyenda de colores -->
        <div style="display: flex; justify-content: space-around; align-items: center; padding: 10px 10px; background: white; border-top: 1px solid #f1f5f9; border-radius: 0 0 16px 16px; margin-top: -8px;">
            <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #dc2626;"></div>
                <span style="font-size: 12px; font-weight: 800; color: #64748b;">2%</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #eab308;"></div>
                <span style="font-size: 12px; font-weight: 800; color: #64748b;">3%</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #007BFF;"></div>
                <span style="font-size: 12px; font-weight: 800; color: #64748b;">4%</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #22c55e;"></div>
                <span style="font-size: 12px; font-weight: 800; color: #64748b;">5%</span>
            </div>
        </div>
    </main>`;

    contentHtml += renderBottomNav(null);
    app.innerHTML = headerHtml + contentHtml; if(window.restoreScroll) window.restoreScroll();

    // Auto-scroll al año más reciente
    setTimeout(() => {
        const container = document.getElementById('comisionesScrollContainer');
        if (container) container.scrollLeft = container.scrollWidth;
    }, 50);
}

window.renderComisiones = renderComisiones;

// --- OBJETIVOS TRIMESTRALES (V7 PREMIUM) ---
async function renderObjetivosTrimestrales(isBack = false) {
    if (typeof updateHistoryState === 'function') updateHistoryState('trimestrales', isBack);
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Objetivos Trimestrales');
    const currentYear = new Date().getFullYear();
    const quarterly = await dataManager.getQuarterlyGoals(currentYear);
    const invoiceHistory = await dataManager.getInvoiceHistory();
    const history2026 = invoiceHistory[String(currentYear)] || Array(12).fill(0);
    
    // Cálculo automático por trimestre (Sincronización Total)
    const autoValues = {
        q1: (parseFloat(history2026[0]) || 0) + (parseFloat(history2026[1]) || 0) + (parseFloat(history2026[2]) || 0),
        q2: (parseFloat(history2026[3]) || 0) + (parseFloat(history2026[4]) || 0) + (parseFloat(history2026[5]) || 0),
        q3: (parseFloat(history2026[6]) || 0) + (parseFloat(history2026[7]) || 0) + (parseFloat(history2026[8]) || 0),
        q4: (parseFloat(history2026[9]) || 0) + (parseFloat(history2026[10]) || 0) + (parseFloat(history2026[11]) || 0)
    };

    // Nombres compactos para ahorrar espacio
    const labels = {
        q1: '1er trimestre',
        q2: '2º trimestre',
        q3: '3er trimestre',
        q4: '4º trimestre'
    };

    let contentHtml = `<main class="trim-container" style="padding: 1rem; overflow-y: auto; padding-bottom: 100px;">
        <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${Object.keys(labels).map(key => {
                const data = quarterly[key] || { target: 0, actual: 0 };
                
                // Sincronizar automáticamente con el valor calculado
                const actualValue = autoValues[key];
                const isMet = actualValue >= data.target && data.target > 0;
                
                return `
                    <div style="background: white; border-radius: 16px; padding: 1.25rem; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                        <div style="font-weight: 900; font-size: 1.1rem; color: #0f172a; margin-bottom: 12px; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; text-transform: uppercase;">
                            ${labels[key]}
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 16px; align-items: center;">
                            <div style="display: flex; align-items: center; justify-content: center; width: 100%; gap: 15px;">
                                <span style="font-size: 0.85rem; font-weight: 800; color: #64748b; text-transform: uppercase; width: 90px; text-align: right;">Objetivo:</span>
                                <div class="trim-input-group" style="width: 140px;">
                                    <input type="text" id="target_${key}" class="trim-input" 
                                           style="padding: 8px 25px 8px 8px; font-size: 1.1rem; text-align: center;"
                                           value="${formatCurrency(Math.round(data.target)).replace(' €', '')}"
                                           onfocus="this.select()" onblur="formatNumericInput(this)">
                                    <span class="trim-currency" style="right: 8px;">€</span>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; justify-content: center; width: 100%; gap: 15px;">
                                <span style="font-size: 0.85rem; font-weight: 800; color: #64748b; text-transform: uppercase; width: 90px; text-align: right;">Facturado:</span>
                                <div class="trim-input-group" style="width: 140px;">
                                    <input type="text" id="actual_${key}" class="trim-input" 
                                           style="padding: 8px 25px 8px 8px; font-size: 1.1rem; color: #009ee3; text-align: center;"
                                           value="${formatCurrency(Math.round(actualValue)).replace(' €', '')}"
                                           onfocus="this.select()" onblur="formatNumericInput(this)">
                                    <span class="trim-currency" style="right: 8px; color: #009ee3;">€</span>
                                </div>
                            </div>
                            <div style="display: flex; justify-content: center; width: 100%; margin-top: 4px;">
                                <span class="trim-status ${isMet ? 'status-success' : 'status-danger'}" style="font-size: 0.8rem; padding: 6px 16px; white-space: nowrap; border-radius: 999px;">
                                    ${isMet ? 'CONSEGUIDO' : 'NO CONSEGUIDO'}
                                </span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>

        <div class="trim-save-container">
            <button class="btn-trim-save" onclick="handleSaveQuarterly()">
                <span class="material-icons-round">save</span>
                <span>Guardar Cambios</span>
            </button>
        </div>
    </main>`;

    contentHtml += renderBottomNav(null);
    app.innerHTML = headerHtml + contentHtml; if(window.restoreScroll) window.restoreScroll();
}

async function handleSaveQuarterly() {
    const quarterly = {};
    const keys = ['q1', 'q2', 'q3', 'q4'];
    
    keys.forEach(key => {
        const targetVal = document.getElementById(`target_${key}`).value;
        const actualVal = document.getElementById(`actual_${key}`).value;
        
        const targetNum = parseFloat(targetVal.replace(/\./g, '').replace(',', '.')) || 0;
        const actualNum = parseFloat(actualVal.replace(/\./g, '').replace(',', '.')) || 0;
        
        quarterly[key] = {
            target: targetNum,
            actual: actualNum
        };
    });

    const currentYear = new Date().getFullYear();
    await dataManager.saveQuarterlyGoals(currentYear, quarterly);
    
    // Feedback visual y recarga
    const btn = document.querySelector('.btn-trim-save');
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<span class="material-icons-round">check_circle</span><span>¡Guardado!</span>';
    btn.style.background = '#16a34a';
    
    setTimeout(() => {
        renderObjetivosTrimestrales();
    }, 1000);
}

window.renderObjetivosTrimestrales = renderObjetivosTrimestrales;
window.handleSaveQuarterly = handleSaveQuarterly;













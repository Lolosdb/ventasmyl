/**
 * Lógica de Vistas Analíticas, Reportes y Objetivos
 */

// --- TOTALES ---
async function renderTotales() {
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Totales');
    
    const orders = await dataManager.getOrders();
    const clients = await dataManager.getClients();
    const clientMap = new Map(clients.map(c => [c.name, c]));
    
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
    const ordersThisYear = orders.filter(o => new Date(o.dateISO).getFullYear() === currentYear);
    const relevantOrders = ordersThisYear.filter(o => (o.amount || 0) > 0);
    
    const totalPedidosCount = relevantOrders.length;
    const clientsWithPurchaseCount = new Set(relevantOrders.map(o => o.shop)).size;
    const averageInvoice = totalPedidosCount > 0 ? (facturacionReal / totalPedidosCount) : 0;
    
    // Clientes Nuevos
    let newClientsCount = 0;
    const countedNewShops = new Set();
    ordersThisYear.forEach(o => {
        if (o.persistedIsNewClient && !countedNewShops.has(o.shop)) {
            newClientsCount++;
            countedNewShops.add(o.shop);
        }
    });

    // Por Provincias
    const PROVINCES = ['ASTURIAS', 'CANTABRIA', 'LEÓN', 'GALICIA'];
    const statsProv = {};
    PROVINCES.forEach(p => statsProv[p] = { amount: 0, orders: 0 });

    ordersThisYear.forEach(o => {
        const c = clientMap.get(o.shop);
        if (c && c.province) {
            let p = c.province.trim().toUpperCase();
            if (p === 'LEON') p = 'LEÓN';
            if (p === 'LUGO') p = 'GALICIA';
            if (p === 'PALENCIA') p = 'LEÓN';
            if (statsProv[p]) {
                statsProv[p].amount += (o.amount || 0);
                if ((o.amount || 0) > 0) {
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
    app.innerHTML = headerHtml + contentHtml;
}

// --- ALERTAS ---
async function renderAlertas() {
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Alertas de Clientes');
    
    const orders = await dataManager.getOrders();
    const clients = await dataManager.getClients();
    const clientMap = new Map(clients.map(c => [c.name, c]));
    const currentYear = new Date().getFullYear();
    
    const lastPurchase = {};
    orders.forEach(o => {
        if (new Date(o.dateISO).getFullYear() !== currentYear) return;
        if (!lastPurchase[o.shop] || o.dateISO > lastPurchase[o.shop]) {
            lastPurchase[o.shop] = o.dateISO;
        }
    });

    const now = new Date();
    const entries = Object.entries(lastPurchase).map(([shop, date]) => {
        const d = new Date(date);
        const days = Math.ceil(Math.abs(now - d) / (1000 * 60 * 60 * 24));
        const c = clientMap.get(shop);
        return { shop, days, phone: c ? c.phone : '', location: c ? c.location : '', code: c ? c.code : null };
    }).sort((a,b) => b.days - a.days);

    let contentHtml = '<main style="padding: 1rem 1.5rem; padding-bottom: 100px;">';
    
    if (entries.length === 0) {
        contentHtml += '<div class="text-center p-12 text-slate-400 italic">Sin actividad de pedidos este año</div>';
    } else {
        entries.forEach(e => {
            const isDanger = e.days > 35;
            contentHtml += `
                <div class="alert-card ${isDanger ? 'red-theme' : 'green-theme'}" 
                     onclick="if('${e.code}' !== 'null') openClientDetailModal('${e.code}')">
                    
                    <div class="alert-card-info">
                        <h3 class="alert-card-title">${e.shop}</h3>
                        <div class="alert-card-details">
                            <p class="alert-card-location">${e.location || 'SIN UBICACIÓN'}</p>
                            <div class="alert-card-badge">Hace ${e.days} días</div>
                        </div>
                    </div>

                    <div class="alert-card-actions">
                        <button class="btn-alert-v7 call shadow-sm"
                                onclick="event.stopPropagation(); window.location.href='tel:${(e.phone || '').replace(/\s+/g, '')}'" title="Llamar">
                            <span class="material-icons-round">call</span> 
                        </button>
                        <button class="btn-alert-v7 whatsapp shadow-sm"
                                onclick="event.stopPropagation(); window.open('https://wa.me/34${(e.phone || '').replace(/[^0-9]/g, '')}', '_blank')" title="WhatsApp">
                            <span class="material-icons-round">chat</span> 
                        </button>
                    </div>
                </div>
            `;
        });
    }

    contentHtml += '</main>';
    contentHtml += renderBottomNav('alertas');
    app.innerHTML = headerHtml + contentHtml;
}

// --- VENTAS HISTÓRICAS ---
async function renderVentas() {
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Ventas Mensuales');
    const history = await dataManager.getSalesHistory();
    const years = Object.keys(history).map(Number).sort((a,b) => a - b);
    const monthsFull = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    // Cálculo de Totales por Año
    const totalsByYear = {};
    years.forEach(y => {
        totalsByYear[y] = (history[y] || []).reduce((a, b) => a + (b || 0), 0);
    });

    let contentHtml = '<main class="analysis-view-container">';
    
    contentHtml += `
        <div class="analysis-premium-card">
            <div class="analysis-table-wrapper" id="analysisTableWrapper">
                <!-- CABECERA -->
                <div class="analysis-header">
                    <div class="analysis-header-cell col-month-fixed">MES</div>
                    ${years.map(y => `
                        <div class="analysis-header-cell col-year-dynamic">
                            <span class="year-capsule">${y}</span>
                        </div>
                    `).join('')}
                </div>

                <!-- CUERPO DE LA TABLA -->
                <div class="analysis-body">
                    ${monthsFull.map((m, mIdx) => `
                        <div class="analysis-row">
                            <div class="cell-month-label col-month-fixed">${m}</div>
                            ${years.map(y => {
                                const val = (history[y] && history[y][mIdx]) || 0;
                                return `
                                    <div class="cell-data-input col-year-dynamic">
                                        <input type="text" 
                                               class="v-input-premium" 
                                               value="${val === 0 ? '-' : formatCurrency(Math.round(val)).replace(' €', '')}"
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

                        return `
                            <div class="cell-year-total-complex col-year-dynamic">
                                <span class="total-value-main">${formatCurrency(Math.round(total))}</span>
                                ${variationHtml}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    </main>`;

    contentHtml += renderBottomNav(null);
    app.innerHTML = headerHtml + contentHtml;

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
async function renderMedias() {
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
    app.innerHTML = headerHtml + contentHtml;
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
    const nameToCodeMap = {};
    clientsData.forEach(c => { 
        if (c.name) nameToCodeMap[c.name.trim().toLowerCase()] = c.code; 
    });

    const currentYear = new Date().getFullYear();
    const yearOrders = orders.filter(o => o.year === currentYear);
    
    const stats = {};
    yearOrders.forEach(o => {
        const shopLower = (o.shop || "").trim().toLowerCase();
        if (!stats[o.shop]) {
            stats[o.shop] = { 
                sales: 0, 
                orders: 0, 
                code: nameToCodeMap[shopLower] || null 
            };
        }
        stats[o.shop].sales += (o.amount || 0);
        stats[o.shop].orders++;
    });

    // Lógica de Ordenación COMPLETA para obtener posiciones reales
    let ranking = Object.entries(stats).map(([name, s]) => ({ name, ...s }));
    
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
    
    // Filtrado por buscador
    if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        ranking = ranking.filter(r => r.name.toLowerCase().includes(lowerSearch));
    }
    
    modal.innerHTML = `
        <div class="modal-content" style="max-height: 85vh; width: 95%; max-width: 480px; border-radius: 20px;">
            <div class="modal-header" style="background: #009ee3; color: white; padding: 1.25rem 1.5rem;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="material-icons-round">emoji_events</span>
                    <h2 class="text-lg font-black" style="letter-spacing: 0.5px;">Ranking ${currentYear}</h2>
                </div>
                <button class="icon-btn" onclick="closeRankingModal()" style="background: rgba(255,255,255,0.2); border-radius: 12px; color: white;">
                    <span class="material-icons-round">close</span>
                </button>
            </div>
            
            <div class="modal-body" style="padding: 1.25rem; background: #fff;">
                <!-- PESTAÑAS -->
                <div class="ranking-tabs-container">
                    <button class="ranking-tab-btn ${sortBy === 'sales' ? 'active' : ''}" onclick="openRankingModal('sales', document.getElementById('rankSearch')?.value || '')">
                        Por Ventas
                    </button>
                    <button class="ranking-tab-btn ${sortBy === 'pedidos' ? 'active' : ''}" onclick="openRankingModal('pedidos', document.getElementById('rankSearch')?.value || '')">
                        Por Pedidos
                    </button>
                </div>

                <!-- BUSCADOR CON ESTILOS INLINE PARA EVITAR CONFLICTOS -->
                <div style="position: relative; width: 100%; display: block; margin-bottom: 1rem;">
                    <span class="material-icons-round" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none;">search</span>
                    <input type="text" id="rankSearch" 
                           placeholder="Buscar tienda..." 
                           value="${searchTerm}"
                           oninput="openRankingModal('${sortBy}', this.value)"
                           autocomplete="off"
                           style="width: 100% !important; padding: 10px 40px 10px 40px !important; box-sizing: border-box !important; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-family: inherit; font-size: 13.5px; font-weight: 700; color: #0f172a;">
                    ${searchTerm ? `
                        <span class="material-icons-round" 
                              onclick="openRankingModal('${sortBy}', '')"
                              style="position: absolute !important; right: 12px !important; top: 50% !important; transform: translateY(-50%) !important; color: #94a3b8; cursor: pointer; z-index: 10; font-size: 18px;">
                            close
                        </span>
                    ` : ''}
                </div>

                <!-- LISTA DE CARDS -->
                <div class="flex flex-col overflow-y-auto" style="max-height: calc(85vh - 240px); padding-right: 4px;">
                    ${ranking.length > 0 ? ranking.map((r) => {
                        const rankNum = r.originalRank;
                        let badgeClass = '';
                        // Las medallas Top 3 se mantienen basadas en la posición real
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
async function renderObjetivos() {
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
                            <input type="text" class="v7-input v7-val-3" value="${formatCurrency(Math.round(goals.data3[i])).replace(' €', '')}" onchange="handleGoalUpdate(3, ${i}, this.value)">
                        </div>
                        <div class="v7-col-val">
                            <input type="text" class="v7-input v7-val-4" value="${formatCurrency(Math.round(goals.data4[i])).replace(' €', '')}" onchange="handleGoalUpdate(4, ${i}, this.value)">
                        </div>
                        <div class="v7-col-val">
                            <input type="text" class="v7-input v7-val-5" value="${formatCurrency(Math.round(goals.data5[i])).replace(' €', '')}" onchange="handleGoalUpdate(5, ${i}, this.value)">
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
    app.innerHTML = headerHtml + contentHtml;
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
async function renderFactura() {
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Facturación Real');
    const history = await dataManager.getInvoiceHistory();
    
    // Definir rango de años (2023 a 2026 según referencia)
    const years = [2023, 2024, 2025, 2026];
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

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
                                    return `
                                        <td>
                                            <input type="text" class="v7-factura-input" 
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
    </main>`;

    contentHtml += renderBottomNav(null);
    app.innerHTML = headerHtml + contentHtml;

    // Auto-scroll al final (año más reciente)
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
// --- OBJETIVOS TRIMESTRALES (V7 PREMIUM) ---
async function renderObjetivosTrimestrales() {
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Objetivos Trimestrales');
    const quarterly = await dataManager.getQuarterlyGoals();
    const invoiceHistory = await dataManager.getInvoiceHistory();
    const currentYear = new Date().getFullYear();
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
        q1: '1T',
        q2: '2T',
        q3: '3T',
        q4: '4T'
    };

    let contentHtml = `<main class="trim-container">
        <div class="trim-card">
            <div class="trim-header">
                <div>TRIMESTRE</div>
                <div>OBJETIVO</div>
                <div>FACTURADO</div>
                <div>ESTADO</div>
            </div>
            <div class="trim-body">
                ${Object.keys(labels).map(key => {
                    const data = quarterly[key] || { target: 0, actual: 0 };
                    
                    // Sincronizar automáticamente con el valor calculado
                    const actualValue = autoValues[key];
                    const isMet = actualValue >= data.target && data.target > 0;
                    
                    return `
                        <div class="trim-row">
                            <div class="trim-label">${labels[key]}</div>
                            <div class="trim-input-group">
                                <input type="text" id="target_${key}" class="trim-input" 
                                       value="${formatCurrency(Math.round(data.target)).replace(' €', '')}"
                                       onfocus="this.select()">
                                <span class="trim-currency">€</span>
                            </div>
                            <div class="trim-input-group">
                                <input type="text" id="actual_${key}" class="trim-input" 
                                       value="${formatCurrency(Math.round(actualValue)).replace(' €', '')}"
                                       onfocus="this.select()">
                                <span class="trim-currency">€</span>
                            </div>
                            <div class="trim-status-col">
                                <span class="trim-status ${isMet ? 'status-success' : 'status-danger'}">
                                    ${isMet ? 'CONSEGUIDO' : 'NO CONSEGUIDO'}
                                </span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>

        <div class="trim-save-container">
            <button class="btn-trim-save" onclick="handleSaveQuarterly()">
                <span class="material-icons-round">save</span>
                <span>Guardar Cambios</span>
            </button>
        </div>
    </main>`;

    contentHtml += renderBottomNav(null);
    app.innerHTML = headerHtml + contentHtml;
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

    await dataManager.saveQuarterlyGoals(quarterly);
    
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

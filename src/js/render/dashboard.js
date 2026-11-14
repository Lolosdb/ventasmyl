/**
 * Lógica de renderizado del Dashboard Principal
 */

let currentDashDate = new Date(); // Estado global para el periodo seleccionado
let _dashChartRange = '6m'; // '6m' | '12m'
let _lastDashStats = null;

function _computeChartNiceScale(maxVal) {
    if (!maxVal || maxVal <= 0) return { max: 1000, stepSize: 250 };
    const rawStep = maxVal / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const norm = rawStep / mag;
    let niceNorm = 10;
    if (norm <= 1) niceNorm = 1;
    else if (norm <= 2) niceNorm = 2;
    else if (norm <= 2.5) niceNorm = 2.5;
    else if (norm <= 5) niceNorm = 5;
    const stepSize = niceNorm * mag;
    const max = Math.ceil(maxVal / stepSize) * stepSize;
    return { max, stepSize };
}

function _formatChartAxisTick(value) {
    if (value === 0) return '0';
    if (value >= 1000) {
        const k = value / 1000;
        return (Number.isInteger(k) ? k : k.toFixed(1)) + 'k';
    }
    return String(Math.round(value));
}

function _buildChartPeriodDeltaHtml(tendencia, range) {
    const slice = range === '6m' ? tendencia.slice(-6) : tendencia;
    const curSum = slice.reduce((acc, t) => acc + (parseFloat(t.ventas) || 0), 0);
    const prevSum = slice.reduce((acc, t) => acc + (parseFloat(t.ventasAnterior) || 0), 0);
    const diffPct = prevSum > 0 ? ((curSum - prevSum) / prevSum) * 100 : (curSum > 0 ? 100 : 0);
    const sign = diffPct >= 0 ? '+' : '';
    const toneClass = diffPct >= 0 ? 'is-pos' : 'is-neg';
    const label = range === '6m' ? 'Últ. 6 meses' : 'Últ. 12 meses';
    return `<span class="dash-chart-delta-pill ${toneClass}">${label}: ${sign}${diffPct.toFixed(1)}%</span>`;
}


function getRemainingBusinessDays(targetDate = new Date()) {
    const today = new Date();
    const isPast = targetDate.getFullYear() < today.getFullYear() || 
                  (targetDate.getFullYear() === today.getFullYear() && targetDate.getMonth() < today.getMonth());
    const isFuture = targetDate.getFullYear() > today.getFullYear() || 
                    (targetDate.getFullYear() === today.getFullYear() && targetDate.getMonth() > today.getMonth());
    
    if (isPast) return 0;
    
    let startCalcDate = new Date(targetDate);
    if (targetDate.getMonth() === today.getMonth() && targetDate.getFullYear() === today.getFullYear()) {
        startCalcDate = new Date(today);
    } else {
        startCalcDate.setDate(1);
    }
    
    startCalcDate.setHours(0, 0, 0, 0);
    const lastDay = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    lastDay.setHours(0, 0, 0, 0);
    
    let count = 0;
    let current = new Date(startCalcDate);
    while (current <= lastDay) {
        const d = current.getDay();
        if (d !== 0 && d !== 6) count++;
        current.setDate(current.getDate() + 1);
    }
    return count;
}

function _buildDashYoyBadgeHtml(monthSales, prevYearSales) {
    const diff = monthSales - prevYearSales;
    const diffPercent = prevYearSales > 0 ? (diff / prevYearSales) * 100 : (monthSales > 0 ? 100 : 0);
    const isPositive = diff >= 0;
    const icon = isPositive ? 'trending_up' : 'trending_down';
    let toneClass = 'is-warn';
    if (diffPercent < 0) toneClass = 'is-neg';
    else if (diffPercent >= 5) toneClass = 'is-pos';

    return `
        <span class="dash-yoy-chip ${toneClass}">
            <span class="material-icons-round">${icon}</span>
            <span>${isPositive ? '+' : ''}${diffPercent.toFixed(1)}% vs año ant.</span>
        </span>
    `;
}

function _buildDashTopClientRowHtml(clientItem, maxAmount) {
    const rankNum = clientItem.rank || 0;
    const badgeClass = rankNum === 1 ? 'is-gold' : (rankNum === 2 ? 'is-silver' : (rankNum === 3 ? 'is-bronze' : ''));
    const barPct = maxAmount > 0 ? Math.max(4, Math.min(100, Math.round((clientItem.amount / maxAmount) * 100))) : 0;
    const safeName = _escapeDashHtml(clientItem.name || '');
    const safeCode = clientItem.code ? String(clientItem.code).replace(/'/g, "\\'") : '';
    const clickAttr = safeCode ? `onclick="openClientDetailModal('${safeCode}')" role="button" tabindex="0"` : '';
    const ordersCount = clientItem.orders || 0;
    const ordersText = ordersCount > 0 ? `${ordersCount} ${ordersCount === 1 ? 'pedido' : 'pedidos'}` : 'Mes actual';

    return `
        <div class="dash-top-client-row ${safeCode ? 'is-clickable' : ''}" ${clickAttr}>
            <div class="dash-rank-badge ${badgeClass}">${String(rankNum).padStart(2, '0')}</div>
            <div class="dash-top-client-info">
                <div class="dash-top-client-name">${safeName}</div>
                <div class="dash-top-client-sub">${ordersText}</div>
                <div class="dash-top-client-bar-track">
                    <div class="dash-top-client-bar-fill" style="width: ${barPct}%;"></div>
                </div>
            </div>
            <div class="dash-top-client-right">
                <span class="dash-top-client-amount">${formatCurrency(Math.round(clientItem.amount))}</span>
                ${safeCode ? '<span class="material-icons-round dash-top-client-chev">chevron_right</span>' : ''}
            </div>
        </div>
    `;
}

async function renderDash(isBack = false) {
    if (typeof updateHistoryState === 'function') updateHistoryState('dash', isBack);
    const app = document.getElementById('app');

    // Usar el periodo seleccionado
    const selectedMonth = currentDashDate.getMonth();
    const selectedYear = currentDashDate.getFullYear();

    const stats = await dataManager.getDashStats(selectedMonth, selectedYear);
    const dueVisitAlerts = typeof dataManager.getDueVisitAlerts === 'function'
        ? await dataManager.getDueVisitAlerts()
        : [];

    const monthSales = stats.ventasMes.total;
    const year = selectedYear;

    const headerHtml = getCommonHeaderHtml('Dash', {
        extraAction: `
            <button type="button" class="btn-header-pill btn-dash-report-pill" onclick="openReportModal()" title="Informe Completo">
                <span class="material-icons-round">analytics</span>
                <span class="btn-dash-report-label">Informe Completo</span>
            </button>
        `
    });

    const rawMonthName = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(currentDashDate);
    const monthLabelCap = rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);
    const isToday = currentDashDate.getMonth() === new Date().getMonth() &&
                    currentDashDate.getFullYear() === new Date().getFullYear();

    const dueAlertPreview = dueVisitAlerts.slice(0, 2).map(n =>
        `${_escapeDashHtml(n.clientName)}: "${_escapeDashHtml(n.note)}"`
    ).join(' · ');

    // --- Lógica de objetivos dinámicos (3% -> 4% -> 5%) ---
    const th = stats.ventasMes.thresholds;
    let activeTarget = th.p3;
    let activeTierPct = 3;
    let activeLabel = 'Meta 3%';

    if (th.p4 > 0 && monthSales >= th.p4) {
        activeTarget = th.p5;
        activeTierPct = 5;
        activeLabel = 'Meta 5%';
    } else if (th.p3 > 0 && monthSales >= th.p3) {
        activeTarget = th.p4;
        activeTierPct = 4;
        activeLabel = 'Meta 4%';
    }

    const rawPct = activeTarget > 0 ? Math.min((monthSales / activeTarget) * 100, 100) : 0;
    const currentProgressPercent = rawPct.toFixed(1);
    const hue = (rawPct / 100) * 120;
    const barColor = `hsl(${hue}, 82%, 44%)`;

    const missingForTarget = Math.max(0, activeTarget - monthSales);
    const goalStatusLine = activeTarget <= 0
        ? 'Sin objetivo configurado para este mes'
        : (activeTierPct === 5 && monthSales >= th.p5)
            ? `¡Meta máxima 5% superada! (+${formatCurrency(Math.round(monthSales - th.p5))})`
            : `Faltan ${formatCurrency(Math.round(missingForTarget))} para alcanzar el ${activeTierPct}%`;

    const remainingDays = getRemainingBusinessDays(currentDashDate);
    const prevYearSales = stats.ventasMes.totalAnterior || 0;
    const yoyChipHtml = _buildDashYoyBadgeHtml(monthSales, prevYearSales);
    const daysText = remainingDays > 0
        ? `Quedan ${remainingDays} ${remainingDays === 1 ? 'día' : 'días'}`
        : (isToday ? 'Último día' : 'Mes cerrado');

    // --- CÁLCULO DE VENTAS SEMANALES ---
    const rawWeeks = [];
    const lastDayOfMonth = new Date(year, selectedMonth + 1, 0);
    const todayDate = new Date();
    const realTodayDay = todayDate.getDate();
    const isCurrentRealMonth = todayDate.getMonth() === selectedMonth && todayDate.getFullYear() === selectedYear;

    let sDate = 1;
    while (sDate <= lastDayOfMonth.getDate()) {
        const curr = new Date(year, selectedMonth, sDate);
        let dw = curr.getDay();
        if (dw === 0) dw = 7;
        let eDate = sDate + (7 - dw);
        if (eDate > lastDayOfMonth.getDate()) eDate = lastDayOfMonth.getDate();
        rawWeeks.push({ start: sDate, end: eDate });
        sDate = eDate + 1;
    }

    const weeksList = rawWeeks.filter(w => {
        for (let d = w.start; d <= w.end; d++) {
            const dayOfWeek = new Date(year, selectedMonth, d).getDay();
            if (dayOfWeek >= 1 && dayOfWeek <= 5) return true;
        }
        return false;
    });

    const mOrders = await dataManager.getOrders();
    const curMonthOrders = mOrders.filter(o => {
        const d = new Date(o.dateISO);
        return d.getMonth() === selectedMonth && d.getFullYear() === year;
    });

    const weeklyHtml = weeksList.map((w, i) => {
        const wTotal = curMonthOrders
            .filter(o => {
                const day = new Date(o.dateISO).getDate();
                return day >= w.start && day <= w.end;
            })
            .reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);

        const isCur = isCurrentRealMonth && realTodayDay >= w.start && realTodayDay <= w.end;
        const rangeLabel = w.start === w.end ? `${w.start}` : `${w.start}–${w.end}`;

        return `
            <div class="weekly-stat-card ${isCur ? 'current-week' : ''}">
                <div class="weekly-card-top">
                    <span class="weekly-label">Sem. ${i + 1}</span>
                    ${isCur ? '<span class="weekly-now-dot" title="Semana actual"></span>' : `<span class="weekly-range">${rangeLabel}</span>`}
                </div>
                <span class="weekly-amount">${formatCurrency(Math.round(wTotal))}</span>
            </div>
        `;
    }).join('');

    const avgOrderMonth = stats.stats.pedidosMes > 0 ? (stats.ventasMes.total / stats.stats.pedidosMes) : 0;
    const topClientes = stats.topClientes || [];
    const maxTopAmount = topClientes.length > 0 ? (topClientes[0].amount || 0) : 0;
    const topClientsHtml = topClientes.length > 0
        ? topClientes.map(c => _buildDashTopClientRowHtml(c, maxTopAmount)).join('')
        : `<div class="dash-empty-box">Sin pedidos registrados en ${monthLabelCap} ${year}</div>`;

    let contentHtml = `<main class="dash-main fade-in-up">`;

    contentHtml += `
        <div class="dash-top-controls-row">
            <div class="dash-period-box">
                <span class="dash-period-kicker">${isToday ? 'Mes en curso' : 'Histórico mensual'}</span>
                <h2 class="dash-period-title">${monthLabelCap} ${year}</h2>
            </div>
            <div class="date-selector-container">
                <button type="button" class="nav-date-btn" onclick="changeDashMonth(-1)" title="Mes anterior" aria-label="Mes anterior">
                    <span class="material-icons-round">chevron_left</span>
                </button>
                <button type="button" onclick="resetDashDate()" class="btn-today-selector ${isToday ? 'is-current' : ''}">HOY</button>
                <button type="button" class="nav-date-btn" onclick="changeDashMonth(1)" title="Mes siguiente" aria-label="Mes siguiente">
                    <span class="material-icons-round">chevron_right</span>
                </button>
            </div>
        </div>

        <div class="dash-quick-actions-grid">
            <button type="button" class="dash-quick-card" onclick="renderDepartamentos()">
                <span class="dash-quick-icon is-blue"><span class="material-icons-round">groups</span></span>
                <span class="dash-quick-label">Departamentos</span>
            </button>
            <button type="button" class="dash-quick-card" onclick="openCalendarModal()">
                <span class="dash-quick-icon is-amber"><span class="material-icons-round">calendar_month</span></span>
                <span class="dash-quick-label">Calendario</span>
            </button>
            <button type="button" class="dash-quick-card" onclick="openVisitNotesModal()">
                ${dueVisitAlerts.length > 0 ? `<span class="dash-quick-badge">${dueVisitAlerts.length}</span>` : ''}
                <span class="dash-quick-icon is-teal"><span class="material-icons-round">edit_note</span></span>
                <span class="dash-quick-label">Notas visita</span>
            </button>
        </div>

        ${dueVisitAlerts.length > 0 ? `
        <div class="dash-visit-alert-banner" onclick="openVisitNotesModal()">
            <div class="dash-visit-alert-icon">
                <span class="material-icons-round">notifications_active</span>
            </div>
            <div class="dash-visit-alert-body">
                <div class="dash-visit-alert-title">
                    ${dueVisitAlerts.length === 1 ? '1 recordatorio de visita para hoy' : `${dueVisitAlerts.length} recordatorios de visita pendientes`}
                </div>
                <div class="dash-visit-alert-sub">${dueAlertPreview}${dueVisitAlerts.length > 2 ? ` (+${dueVisitAlerts.length - 2} más)` : ''}</div>
            </div>
            <span class="dash-visit-alert-cta">Ver</span>
        </div>
        ` : ''}

        <section class="dash-hero-card">
            <div class="dash-hero-top">
                <span class="dash-hero-eyebrow">VENTAS DEL MES</span>
                <button type="button" class="dash-tier-pill" onclick="openGoalsModal()" title="Ver objetivos del mes">
                    <span class="material-icons-round">ads_click</span>
                    <span>${activeLabel}</span>
                </button>
            </div>

            <div class="dash-hero-amount">${formatCurrency(Math.round(monthSales))}</div>

            <div class="dash-hero-goal-box" onclick="openGoalsModal()" role="button" tabindex="0">
                <div class="dash-hero-goal-row">
                    <span class="dash-hero-goal-label">Objetivo ${activeTierPct}%: <strong>${formatCurrency(Math.round(activeTarget))}</strong></span>
                    <span class="dash-hero-goal-pct" style="color: ${barColor};">${currentProgressPercent}%</span>
                </div>
                <div class="dash-progress-track">
                    <div class="dash-progress-fill" style="width: ${currentProgressPercent}%; background-color: ${barColor};"></div>
                </div>
                <div class="dash-hero-goal-sub">${goalStatusLine}</div>
            </div>

            <div class="dash-hero-footer">
                ${yoyChipHtml}
                <span class="dash-days-chip">
                    <span class="material-icons-round">event_repeat</span>
                    <span>${daysText}</span>
                </span>
            </div>
        </section>

        <section class="dash-section-block">
            <div class="dash-section-head">
                <span class="dash-section-title">Desglose semanal</span>
                <span class="dash-section-meta">${weeksList.length} semanas</span>
            </div>
            <div class="weekly-sales-grid">
                ${weeklyHtml}
            </div>
        </section>

        <section class="dash-card dash-chart-card">
            <div class="dash-chart-head">
                <div class="dash-chart-title-wrap">
                    <span class="dash-chart-icon">
                        <span class="material-icons-round">analytics</span>
                    </span>
                    <h3 class="dash-chart-title">Tendencia de Ventas</h3>
                </div>
                <div class="dash-chart-seg" role="group" aria-label="Rango del gráfico">
                    <button type="button" class="dash-chart-seg-btn ${_dashChartRange === '6m' ? 'is-active' : ''}" data-range="6m" onclick="setDashChartRange('6m')">6M</button>
                    <button type="button" class="dash-chart-seg-btn ${_dashChartRange === '12m' ? 'is-active' : ''}" data-range="12m" onclick="setDashChartRange('12m')">12M</button>
                </div>
            </div>
            <div class="dash-chart-subbar">
                <div class="dash-chart-legend">
                    <span class="dash-legend-item"><i class="is-prev"></i>Ant.</span>
                    <span class="dash-legend-item"><i class="is-cur"></i>Actual</span>
                </div>
                <div id="dashChartDeltaWrap">${_buildChartPeriodDeltaHtml(stats.tendencia || [], _dashChartRange)}</div>
            </div>
            <div id="dashChartWrap" class="dash-chart-wrap ${_dashChartRange === '12m' ? 'is-12m' : 'is-6m'}">
                <div class="dash-chart-yaxis">
                    <canvas id="trendChartYAxis"></canvas>
                </div>
                <div id="trendChartScroll" class="dash-chart-scroll">
                    <div class="dash-chart-canvas-box">
                        <canvas id="trendChart"></canvas>
                    </div>
                </div>
            </div>
            <div id="dashChartSwipeHint" class="dash-chart-swipe-hint" style="display: ${_dashChartRange === '12m' ? 'flex' : 'none'};">
                <span class="material-icons-round">swipe</span>
                <span>Desliza horizontalmente para ver los 12 meses</span>
            </div>
        </section>

        <section class="dash-stats-grid-3">
            <div class="dash-kpi-card is-indigo">
                <span class="dash-kpi-icon is-indigo"><span class="material-icons-round">group</span></span>
                <div class="dash-kpi-val">${stats.stats.clientesActivos}</div>
                <div class="dash-kpi-lbl">Clientes Activos</div>
                <div class="dash-kpi-sub">Con pedido</div>
            </div>
            <div class="dash-kpi-card is-green">
                <span class="dash-kpi-icon is-green"><span class="material-icons-round">shopping_cart</span></span>
                <div class="dash-kpi-val">${stats.stats.pedidosMes}</div>
                <div class="dash-kpi-lbl">Pedidos Mes</div>
                <div class="dash-kpi-sub">${stats.stats.pedidosAnio} en ${year}</div>
            </div>
            <div class="dash-kpi-card is-amber">
                <span class="dash-kpi-icon is-amber"><span class="material-icons-round">payments</span></span>
                <div class="dash-kpi-val">${formatCurrency(Math.round(avgOrderMonth))}</div>
                <div class="dash-kpi-lbl">Media Pedido</div>
                <div class="dash-kpi-sub">Ticket medio</div>
            </div>
        </section>

        <section class="dash-top-clients-section">
            <div class="dash-section-head">
                <span class="dash-section-title">
                    <span class="material-icons-round dash-top-trophy">emoji_events</span>
                    Top Clientes Mensual
                </span>
                <span class="dash-section-meta">${topClientes.length} ${topClientes.length === 1 ? 'tienda' : 'tiendas'}</span>
            </div>
            <div class="dash-top-clients-list">
                ${topClientsHtml}
            </div>
        </section>
    `;

    // Modales de Informe
    contentHtml += `
        <div id="reportModal" class="modal-overlay">
            <div class="modal-content" style="max-width: 450px; margin: 0 auto;">
                <div class="modal-header">
                    <h2 class="text-xl font-bold">Informe Estratégico</h2>
                    <button class="icon-btn" onclick="closeReportModal()"><span class="material-icons-round">close</span></button>
                </div>
                <div class="modal-body">
                    <p class="text-sm text-gray mb-4">Descarga un documento Excel de Inteligencia Comercial basado en el periodo elegido frente al año anterior.</p>
                    <div class="flex gap-4 mb-4">
                        <div class="form-group flex-1">
                            <label class="form-label">Desde</label>
                            <input type="date" id="reportStartDate" class="form-input" value="${year}-01-01">
                        </div>
                        <div class="form-group flex-1">
                            <label class="form-label">Hasta</label>
                            <input type="date" id="reportEndDate" class="form-input" value="${new Date().toISOString().split('T')[0]}">
                        </div>
                    </div>
                    <div class="flex gap-3">
                        <button class="btn-premium-secondary flex-1" onclick="previewReport()">
                            <span class="material-icons-round">visibility</span>
                            Previsualizar
                        </button>
                        <button class="btn-action-excel flex-1" onclick="generateStrategicReport()">
                            <span class="material-icons-round">description</span>
                            Excel
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <div id="previewModal" class="modal-overlay">
            <div class="modal-content" style="max-width: 90%; width: 600px;">
                <div class="modal-header">
                    <h2 class="text-xl font-bold">Vista Previa de Ventas</h2>
                    <button class="icon-btn" onclick="document.getElementById('previewModal').classList.remove('open')">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                <div id="previewContent" class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                </div>
            </div>
        </div>
    `;

    contentHtml += '</main>';
    contentHtml += renderBottomNav('dash');

    app.innerHTML = headerHtml + contentHtml; if(window.restoreScroll) window.restoreScroll();
    
    if (typeof initDashCharts === 'function') initDashCharts(stats);
    if (window.activeCurrentNav) window.activeCurrentNav('dash');

    // Ocultar Splash Screen tras un breve retardo para asegurar suavidad
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) splash.classList.add('splash-hidden');

        if (!window._startupVisitAlertsChecked) {
            window._startupVisitAlertsChecked = true;
            if (dueVisitAlerts.length > 0) {
                openStartupVisitAlertsModal(dueVisitAlerts);
            }
        }
    }, 800);

    // Auto-scroll a la semana actual en el carrusel y habilitar arrastre con ratón
    setTimeout(() => {
        const grid = document.querySelector('.weekly-sales-grid');
        const current = document.querySelector('.weekly-stat-card.current-week');
        if (grid && current) {
            const scrollLeft = current.offsetLeft - (grid.offsetWidth / 2) + (current.offsetWidth / 2);
            grid.scrollTo({ left: scrollLeft, behavior: 'smooth' });
        }
        initCarouselDrag('.weekly-sales-grid');
        initCarouselDrag('#trendChartScroll');
        
        // Auto-scroll del gráfico al extremo derecho
        const trendChartScroll = document.getElementById('trendChartScroll');
        if (trendChartScroll) {
            trendChartScroll.scrollLeft = trendChartScroll.scrollWidth;
        }
    }, 500);
}

// Funciones de control del selector de fecha
window.changeDashMonth = function(offset) {
    currentDashDate.setMonth(currentDashDate.getMonth() + offset);
    renderDash();
};

window.resetDashDate = function() {
    currentDashDate = new Date();
    renderDash();
};


function initCarouselDrag(selector) {
    const slider = document.querySelector(selector);
    if (!slider) return;

    let isDown = false;
    let startX;
    let scrollLeft;

    slider.addEventListener('mousedown', (e) => {
        isDown = true;
        slider.style.cursor = 'grabbing';
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });

    slider.addEventListener('mouseleave', () => {
        isDown = false;
        slider.style.cursor = 'grab';
    });

    slider.addEventListener('mouseup', () => {
        isDown = false;
        slider.style.cursor = 'grab';
    });

    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 2; 
        slider.scrollLeft = scrollLeft - walk;
    });
}


window.setDashChartRange = function(range) {
    if (range !== '6m' && range !== '12m') return;
    _dashChartRange = range;
    document.querySelectorAll('.dash-chart-seg-btn').forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.range === range);
    });
    const wrap = document.getElementById('dashChartWrap');
    if (wrap) {
        wrap.classList.toggle('is-6m', range === '6m');
        wrap.classList.toggle('is-12m', range === '12m');
    }
    const hint = document.getElementById('dashChartSwipeHint');
    if (hint) hint.style.display = range === '12m' ? 'flex' : 'none';
    const deltaWrap = document.getElementById('dashChartDeltaWrap');
    if (deltaWrap && _lastDashStats) {
        deltaWrap.innerHTML = _buildChartPeriodDeltaHtml(_lastDashStats.tendencia || [], range);
    }
    if (_lastDashStats) {
        initDashCharts(_lastDashStats);
        if (range === '12m') {
            setTimeout(() => {
                const sc = document.getElementById('trendChartScroll');
                if (sc) sc.scrollLeft = sc.scrollWidth;
            }, 60);
        }
    }
};

async function initDashCharts(stats) {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;
    _lastDashStats = stats;

    // Destruir instancias previas si existen para evitar duplicados y flickering
    if (window.myTrendChart) {
        window.myTrendChart.destroy();
        window.myTrendChart = null;
    }
    if (window.myTrendChartYAxis) {
        window.myTrendChartYAxis.destroy();
        window.myTrendChartYAxis = null;
    }

    const ctx = canvas.getContext('2d');
    const is6m = _dashChartRange === '6m';
    const rawSeries = Array.isArray(stats.tendencia) ? stats.tendencia : [];
    const series = is6m ? rawSeries.slice(-6) : rawSeries;

    const labels = series.map(t => t.mes);
    const currentData = series.map(t => t.ventas);
    const lastYearData = series.map(t => t.ventasAnterior);

    const maxSeriesVal = Math.max(0, ...currentData, ...lastYearData);
    const niceScale = _computeChartNiceScale(maxSeriesVal);

    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.22)';
    const prevBarColor = isDark ? 'rgba(148, 163, 184, 0.38)' : '#cbd5e1';

    const curGrad = ctx.createLinearGradient(0, 10, 0, 185);
    curGrad.addColorStop(0, '#38bdf8');
    curGrad.addColorStop(1, '#0284c7');

    // En modo 12M usamos eje Y fijo alineado exactamente a niceScale; en 6M el canvas principal dibuja su propio eje Y nativo
    const yAxisCanvas = document.getElementById('trendChartYAxis');
    if (!is6m && yAxisCanvas) {
        window.myTrendChartYAxis = new Chart(yAxisCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { data: lastYearData, backgroundColor: 'transparent' },
                    { data: currentData, backgroundColor: 'transparent' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 8, bottom: 0, left: 2, right: 0 } },
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: {
                    x: {
                        grid: { display: false, drawBorder: false },
                        border: { display: false },
                        ticks: { color: 'transparent', font: { size: 10.5, weight: '800' }, padding: 8 }
                    },
                    y: {
                        min: 0,
                        max: niceScale.max,
                        grid: { display: false, drawBorder: false },
                        border: { display: false },
                        ticks: {
                            stepSize: niceScale.stepSize,
                            color: textColor,
                            font: { size: 10.5, weight: '700' },
                            callback: _formatChartAxisTick,
                            padding: 4
                        }
                    }
                },
                animation: false
            }
        });
    }

    window.myTrendChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Año Anterior',
                    data: lastYearData,
                    backgroundColor: prevBarColor,
                    borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 2, bottomRight: 2 },
                    borderSkipped: false,
                    barPercentage: 0.82,
                    categoryPercentage: 0.68
                },
                {
                    label: 'Año Actual',
                    data: currentData,
                    backgroundColor: curGrad,
                    borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 2, bottomRight: 2 },
                    borderSkipped: false,
                    barPercentage: 0.82,
                    categoryPercentage: 0.68
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { top: 8, bottom: 0, left: 0, right: 4 }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    titleColor: isDark ? '#f8fafc' : '#0f172a',
                    titleFont: { size: 13, weight: '800' },
                    bodyColor: isDark ? '#cbd5e1' : '#475569',
                    bodyFont: { size: 12, weight: '600' },
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                    borderWidth: 1,
                    cornerRadius: 12,
                    padding: 10,
                    boxPadding: 6,
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const val = context.parsed.y !== null ? formatCurrency(Math.round(context.parsed.y)) : '0 €';
                            return `${label}: ${val}`;
                        },
                        afterBody: function(items) {
                            if (!items || items.length < 2) return '';
                            const prev = items[0].parsed.y || 0;
                            const cur = items[1].parsed.y || 0;
                            if (prev <= 0 && cur <= 0) return '';
                            const pct = prev > 0 ? ((cur - prev) / prev) * 100 : 100;
                            const sign = pct >= 0 ? '+' : '';
                            return `\nVariación: ${sign}${pct.toFixed(1)}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: niceScale.max,
                    grid: {
                        color: gridColor,
                        drawBorder: false,
                        tickLength: 0
                    },
                    border: { display: false, dash: [4, 4] },
                    ticks: {
                        display: is6m,
                        stepSize: niceScale.stepSize,
                        color: textColor,
                        font: { size: 10.5, weight: '700' },
                        callback: _formatChartAxisTick,
                        padding: 6
                    }
                },
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: {
                        color: textColor,
                        font: { size: 10.5, weight: '800' },
                        autoSkip: false,
                        maxRotation: 0,
                        padding: 8
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

function openReportModal() {
    const modal = document.getElementById('reportModal');
    if (modal) modal.classList.add('open');
}

function closeReportModal() {
    const modal = document.getElementById('reportModal');
    if (modal) modal.classList.remove('open');
}

window.renderDash = renderDash;
window.initDashCharts = initDashCharts;
window.openReportModal = openReportModal;
window.closeReportModal = closeReportModal;

// --- CALENDARIO VISUAL INTERACTIVO ---
let currentCalendarDate = new Date();

async function openCalendarModal(year, month) {
    if (year !== undefined && month !== undefined) {
        currentCalendarDate = new Date(year, month, 1);
    }
    
    let modal = document.getElementById('calendarModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'calendarModal';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h2 class="text-xl font-bold">Calendario de Actividad</h2>
                <button class="icon-btn text-white" onclick="closeCalendarModal()"><span class="material-icons-round">close</span></button>
            </div>
            <div id="calendarContainer" class="modal-body">
                <!-- El calendario se renderiza aquí -->
            </div>
        </div>
    `;
    
    modal.classList.add('open');
    renderCalendar();
}

async function renderCalendar() {
    const container = document.getElementById('calendarContainer');
    if (!container) return;

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const monthName = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(currentCalendarDate);

    // Obtener pedidos del mes para resaltar días
    const orders = await dataManager.getOrders();
    const ordersThisMonth = orders.filter(o => {
        const d = new Date(o.dateISO);
        return d.getFullYear() === year && d.getMonth() === month;
    });

    const activeDays = new Set(ordersThisMonth.map(o => new Date(o.dateISO).getDate()));

    let html = `
        <div class="calendar-nav">
            <button class="icon-btn" style="color: #64748b;" onclick="changeCalendarMonth(-1)">
                <span class="material-icons-round">chevron_left</span>
            </button>
            <div class="calendar-title">${monthName} ${year}</div>
            <button class="icon-btn" style="color: #64748b;" onclick="changeCalendarMonth(1)">
                <span class="material-icons-round">chevron_right</span>
            </button>
        </div>
        
        <div class="calendar-grid">
            <div class="calendar-day-header">Lun</div>
            <div class="calendar-day-header">Mar</div>
            <div class="calendar-day-header">Mié</div>
            <div class="calendar-day-header">Jue</div>
            <div class="calendar-day-header">Vie</div>
            <div class="calendar-day-header">Sáb</div>
            <div class="calendar-day-header">Dom</div>
    `;

    const firstDay = new Date(year, month, 1).getDay();
    // Ajustar a Lunes como primer día (JS: 0=Dom, 1=Lun...)
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    // Espacios vacíos al principio
    for (let i = 0; i < startOffset; i++) {
        html += '<div class="calendar-day empty"></div>';
    }

    // Días del mes
    for (let d = 1; d <= daysInMonth; d++) {
        const hasOrders = activeDays.has(d);
        const isToday = isCurrentMonth && today.getDate() === d;
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        
        html += `
            <div class="calendar-day ${isToday ? 'today' : ''} ${hasOrders ? 'has-orders' : ''}" 
                 onclick="viewDayOrders('${dateKey}', ${d})">
                ${d}
            </div>
        `;
    }

    html += '</div>';
    html += `<div id="dayOrdersContainer" class="day-orders-list" style="display: none;"></div>`;
    
    container.innerHTML = html;
}

function changeCalendarMonth(offset) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + offset);
    renderCalendar();
}

async function viewDayOrders(dateKey, dayNumber) {
    // Resaltar día seleccionado
    document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));
    const dayEls = document.querySelectorAll('.calendar-day:not(.empty)');
    const selectedEl = Array.from(dayEls).find(el => el.textContent.trim() === String(dayNumber));
    if (selectedEl) selectedEl.classList.add('selected');

    const container = document.getElementById('dayOrdersContainer');
    const orders = await dataManager.getOrders();
    const dayOrders = orders.filter(o => o.dateISO === dateKey);

    if (dayOrders.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    
    const dayTotal = dayOrders.reduce((acc, o) => acc + (parseFloat(o.amount) || 0), 0);

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; padding: 0 4px;">
            <p style="margin: 0; font-size: 11px; color: #64748b; letter-spacing: 0.5px; display: flex; align-items: baseline; gap: 5px;">
                <span style="font-weight: 950; text-transform: uppercase; color: #1e293b;">Pedidos del día ${dayNumber}</span>
                <span style="font-weight: 400; font-style: italic; text-transform: none; letter-spacing: normal; color: #94a3b8;">
                    (${dayOrders.length} ${dayOrders.length === 1 ? 'pedido' : 'pedidos'})
                </span>
            </p>
            <div style="background: #f0f9ff; color: #0369a1; font-size: 11px; font-weight: 900; padding: 4px 12px; border-radius: 99px; border: 1px solid #bae6fd;">
                ${formatCurrency(Math.round(dayTotal))}
            </div>
        </div>
    `;
    
    dayOrders.forEach(o => {
        html += `
            <div class="day-order-item" onclick="closeCalendarModal(); openEditOrderModal('${o.id}')">
                <div style="font-weight: 800; color: #1e293b; text-transform: uppercase;">${o.shop}</div>
                <div style="font-weight: 900; color: #0ea5e9;">${formatCurrency(Math.round(o.amount || 0))}</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeCalendarModal() {
    const modal = document.getElementById('calendarModal');
    if (modal) modal.classList.remove('open');
}

window.openCalendarModal = openCalendarModal;
window.closeCalendarModal = closeCalendarModal;
window.changeCalendarMonth = changeCalendarMonth;
window.viewDayOrders = viewDayOrders;

async function previewReport() {
    const start = document.getElementById('reportStartDate').value;
    const end = document.getElementById('reportEndDate').value;
    if (!start || !end) return alert("Selecciona fechas");

    const content = document.getElementById('previewContent');
    content.innerHTML = '<div class="text-center p-8"><span class="material-icons-round animate-spin">sync</span> Generando Informe BI...</div>';
    document.getElementById('previewModal').classList.add('open');

    try {
        const orders = await dataManager.getOrders();
        const clients = await dataManager.getClients();
        const lookup = dataManager.buildClientLookup(clients);
        const salesHistory = await dataManager.getSalesHistory();
        
        const startD = new Date(start); 
        const endD = new Date(end);
        
        const startPrev = new Date(startD); startPrev.setFullYear(startPrev.getFullYear() - 1);
        const prevYear = startPrev.getFullYear();
        const prevYearData = salesHistory[prevYear] || Array(12).fill(0);

        const currentOrders = orders.filter(o => { const d = new Date(o.dateISO); return d >= startD && d <= endD; });
        
        const ventasActual = currentOrders.reduce((s, o) => s + (o.amount || 0), 0);
        
        // Sumar meses del año anterior desde el historial
        let ventasAnterior = 0;
        const startM = startD.getMonth();
        const endM = endD.getMonth();
        for (let i = startM; i <= endM; i++) {
            ventasAnterior += (prevYearData[i] || 0);
        }

        const diff = ventasActual - ventasAnterior;
        const crecimiento = ventasAnterior > 0 ? (diff / ventasAnterior * 100).toFixed(1) : '---';

        const activeClients = new Set(currentOrders.map(o => {
            const c = dataManager.resolveClientForOrder(o, lookup);
            return c ? `code_${c.code}` : `shop_${normalizeTextKey(o.shop)}`;
        })).size;
        const totalOrders = currentOrders.length;
        const avgTicket = totalOrders > 0 ? ventasActual / totalOrders : 0;

        let html = `
            <div class="grid grid-cols-2 gap-3 mb-6">
                <div class="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                    <p class="text-[9px] uppercase font-black tracking-widest text-blue-400 mb-1">Ventas Periodo</p>
                    <h3 class="text-xl font-black text-blue-900">${formatCurrency(Math.round(ventasActual))}</h3>
                    <div class="mt-1 flex items-center gap-1 ${diff >= 0 ? 'text-green-600' : 'text-red-500'} font-bold text-[10px]">
                        <span class="material-icons-round text-xs">${diff >= 0 ? 'trending_up' : 'trending_down'}</span>
                        ${crecimiento}% vs año ant.
                    </div>
                </div>
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p class="text-[9px] uppercase font-black tracking-widest text-slate-400 mb-1">Clientes Activos</p>
                    <h3 class="text-xl font-black text-slate-800">${activeClients}</h3>
                    <p class="text-[9px] font-bold text-slate-500 mt-1">Ticket medio: <span class="text-slate-800">${formatCurrency(Math.round(avgTicket))}</span></p>
                </div>
            </div>
            
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Top Clientes en el periodo</p>
            <div class="overflow-hidden rounded-xl border border-slate-100">
                <table class="w-full text-xs" style="border-collapse: collapse;">
                    <thead>
                        <tr class="bg-slate-800 text-white font-bold uppercase text-[9px] tracking-wider">
                            <th class="p-3 text-left" style="width: 55%;">TIENDA</th>
                            <th class="p-3 text-right" style="width: 25%;">IMPORTE</th>
                            <th class="p-3 text-right" style="width: 20%;">PED.</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        const clientStats = {};
        currentOrders.forEach(o => {
            const c = dataManager.resolveClientForOrder(o, lookup);
            const key = c ? `code_${c.code}` : `shop_${normalizeTextKey(o.shop)}`;
            const displayName = c ? c.name : o.shop;
            if (!clientStats[key]) clientStats[key] = { name: displayName, amount: 0, count: 0 };
            clientStats[key].amount += (o.amount || 0);
            clientStats[key].count++;
        });

        const sorted = Object.values(clientStats)
            .sort((a,b) => b.amount - a.amount)
            .slice(0, 15);

        sorted.forEach(data => {
            html += `
                <tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td class="p-3 font-black text-slate-700 uppercase tracking-tight">${data.name}</td>
                    <td class="p-3 text-right font-black text-slate-900">${formatCurrency(Math.round(data.amount))}</td>
                    <td class="p-3 text-right text-slate-500 font-bold">${data.count}</td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        html += '<p class="text-[9px] text-center text-slate-400 mt-4 font-bold italic uppercase tracking-wider">💡 Descarga el Excel para ver el informe BI completo de 8 pestañas.</p>';
        content.innerHTML = html;
    } catch (e) {
        console.error(e);
        content.innerHTML = '<p class="text-red-500 p-4">Error al generar vista previa</p>';
    }
}

async function generateStrategicReport() {
    try {
        const start = document.getElementById('reportStartDate').value;
        const end = document.getElementById('reportEndDate').value;
        if (!start || !end) return alert("Selecciona fechas");

        const orders = await dataManager.getOrders();
        const clients = await dataManager.getClients();
        const salesHistory = await dataManager.getSalesHistory();
        const lookup = dataManager.buildClientLookup(clients);
        const getClientKey = (o) => {
            const c = dataManager.resolveClientForOrder(o, lookup);
            return c ? `code_${c.code}` : `shop_${normalizeTextKey(o.shop)}`;
        };

        const startD = new Date(start); startD.setHours(0,0,0,0);
        const endD = new Date(end); endD.setHours(23,59,59,999);
        
        const prevYear = startD.getFullYear() - 1;
        const prevYearData = salesHistory[prevYear] || Array(12).fill(0);

        const currentOrders = orders.filter(o => { const d = new Date(o.dateISO); return d >= startD && d <= endD; });

        const wb = XLSX.utils.book_new();

        // 1. KPIs RESUMEN
        const ventasActual = currentOrders.reduce((s, o) => s + (o.amount || 0), 0);
        
        let ventasAnterior = 0;
        const startM = startD.getMonth();
        const endM = endD.getMonth();
        for (let i = startM; i <= endM; i++) {
            ventasAnterior += (prevYearData[i] || 0);
        }
        const diff = ventasActual - ventasAnterior;
        
        const kpis = [
            { "MÉTRICA": "Ventas Totales (Periodo Base)", "VALOR": Math.round(ventasActual), "NOTA": "" },
            { "MÉTRICA": `Ventas Año Anterior (${prevYear})`, "VALOR": Math.round(ventasAnterior), "NOTA": "Datos históricos consolidados" },
            { "MÉTRICA": "Crecimiento de facturación (%)", "VALOR": ventasAnterior > 0 ? (diff/ventasAnterior*100).toFixed(1) + '%' : '---', "NOTA": diff >= 0 ? "Positivo" : "Negativo" },
            { "MÉTRICA": "Total Pedidos (Periodo Base)", "VALOR": currentOrders.length, "NOTA": "" },
            { "MÉTRICA": "Ticket Medio de Compra (€)", "VALOR": currentOrders.length > 0 ? Math.round(ventasActual/currentOrders.length) : 0, "NOTA": "" },
            { "MÉTRICA": "Clientes Únicos Activos", "VALOR": new Set(currentOrders.map(o => getClientKey(o))).size, "NOTA": "Distintos clientes que compraron ahora" }
        ];
        
        const shopsBeforeStart = new Set(orders.filter(o => new Date(o.dateISO) < startD).map(o => getClientKey(o)));
        const newClients = Array.from(new Set(currentOrders.map(o => getClientKey(o)))).filter(k => !shopsBeforeStart.has(k)).length;
        kpis.push({ "MÉTRICA": "Recién Adquiridos (1ª Compra)", "VALOR": newClients, "NOTA": "Atraídos en esta fecha concreta" });

        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpis), "1. KPIs Resumen");

        // 2. EVOLUC MENSUAL
        const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        const evolution = [];
        for (let i = startM; i <= endM; i++) {
            const actual = currentOrders.filter(o => new Date(o.dateISO).getMonth() === i).reduce((s, o) => s + (o.amount || 0), 0);
            const prev = prevYearData[i] || 0;
            evolution.push({
                "MES": monthNames[i],
                "VENTAS FECHAS": Math.round(actual),
                "VENTAS AÑO ANTERIOR": Math.round(prev),
                "DIFERENCIA (€)": Math.round(actual - prev),
                "Nº PEDIDOS MES": currentOrders.filter(o => new Date(o.dateISO).getMonth() === i).length
            });
        }
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(evolution), "2. Evoluc Mensual");

        // 3. TOP CLIENTES
        const clientStats = {};
        currentOrders.forEach(o => {
            const c = dataManager.resolveClientForOrder(o, lookup);
            const key = getClientKey(o);
            const displayName = c ? c.name : o.shop;
            if (!clientStats[key]) clientStats[key] = { name: displayName, client: c, amount: 0, count: 0 };
            clientStats[key].amount += (o.amount || 0);
            clientStats[key].count++;
        });
        const ranking = Object.values(clientStats)
            .sort((a,b) => b.amount - a.amount)
            .map((data, idx) => {
                const c = data.client || {};
                return {
                    "RANKING": idx + 1,
                    "CÓDIGO": c.code || "---",
                    "TIENDA": data.name,
                    "FACTURACIÓN (€)": Math.round(data.amount),
                    "Nº PEDIDOS": data.count,
                    "TICKET MEDIO (€)": Math.round(data.amount / data.count),
                    "PROVINCIA": c.province || "---"
                };
            });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ranking), "3. Top Clientes");

        // 4. FUGAS RIESGO
        const currentShops = new Set(currentOrders.map(o => getClientKey(o)));
        const prevOrdersExist = orders.filter(o => new Date(o.dateISO).getFullYear() === prevYear);
        const prevShopsStats = {};
        prevOrdersExist.forEach(o => {
            const k = getClientKey(o);
            if (!currentShops.has(k)) {
                const c = dataManager.resolveClientForOrder(o, lookup);
                const displayName = c ? c.name : o.shop;
                if (!prevShopsStats[k]) prevShopsStats[k] = { name: displayName, amount: 0 };
                prevShopsStats[k].amount += (o.amount || 0);
            }
        });
        const fugas = Object.values(prevShopsStats).map(item => ({ "KPI": "CLIENTE PERDIDO", "TIENDA": item.name, "VENTA AÑO PASADO": Math.round(item.amount) }));
        if (fugas.length === 0) fugas.push({ "INFO": "No hay datos de pedidos detallados del año anterior para detectar fugas." });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fugas), "4. Fugas Riesgo");

        // 5. GEOGRAFICO
        const provStats = {};
        const pobStats = {};
        currentOrders.forEach(o => {
            const c = dataManager.resolveClientForOrder(o, lookup) || {};
            const prov = (c.province || "DESCONOCIDO").toUpperCase();
            const pob = (c.location || "DESCONOCIDO").toUpperCase();
            if (!provStats[prov]) provStats[prov] = { amount: 0, count: 0 };
            provStats[prov].amount += (o.amount || 0);
            provStats[prov].count++;
            if (!pobStats[pob]) pobStats[pob] = { amount: 0, count: 0 };
            pobStats[pob].amount += (o.amount || 0);
            pobStats[pob].count++;
        });
        const provRows = Object.entries(provStats).sort((a,b) => b[1].amount - a[1].amount).map(([p, d]) => ({ "PROVINCIA": p, "FACTURACIÓN (€)": Math.round(d.amount), "Nº PEDIDOS": d.count }));
        const pobRows = Object.entries(pobStats).sort((a,b) => b[1].amount - a[1].amount).map(([p, d]) => ({ "POBLACIÓN": p, "FACTURACIÓN (€)": Math.round(d.amount), "Nº PEDIDOS": d.count }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(provRows), "5a. Geog Prov");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pobRows), "5b. Geog Pobla");

        // 6. TRAMOS
        const tramos = { "<100€": 0, "100-500€": 0, "500-1000€": 0, ">1000€": 0 };
        currentOrders.forEach(o => {
            const amt = o.amount || 0;
            if (amt < 100) tramos["<100€"]++;
            else if (amt < 500) tramos["100-500€"]++;
            else if (amt < 1000) tramos["500-1000€"]++;
            else tramos[">1000€"]++;
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(Object.entries(tramos).map(([t, c]) => ({ "TRAMO": t, "Nº PEDIDOS": c }))), "6. Tramos Ticket");

        // 7. BASE DE DATOS
        const dbSheet = currentOrders
            .sort((a,b) => (a.displayId || 0) - (b.displayId || 0))
            .map(o => {
                const c = dataManager.resolveClientForOrder(o, lookup) || {};
                return {
                    "Nº": o.displayId || String(o.id).split('-').pop(),
                    "FECHA": new Date(o.dateISO).toLocaleDateString('es-ES'),
                    "CÓDIGO": c.code || o.clientCode || "---",
                    "TIENDA": c.name || o.shop,
                    "IMPORTE": Math.round(o.amount || 0),
                    "PROVINCIA": (c.province || "---").toUpperCase(),
                    "POBLACIÓN": (c.location || "---").toUpperCase()
                };
            });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dbSheet), "7. Base de Datos");

        // APLICAR ESTILOS AVANZADOS A TODAS LAS HOJAS
        wb.SheetNames.forEach(name => {
            const ws = wb.Sheets[name];
            const range = XLSX.utils.decode_range(ws['!ref']);
            const colWidths = [];

            for (let C = range.s.c; C <= range.e.c; ++C) {
                let maxWidth = 10;
                for (let R = range.s.r; R <= range.e.r; ++R) {
                    const addr = XLSX.utils.encode_cell({ r: R, c: C });
                    if (!ws[addr]) continue;
                    
                    // Estilo común: Todo centrado
                    ws[addr].s = {
                        alignment: { horizontal: "center", vertical: "center" }
                    };

                    // Formato de número: Separador de miles (#,##0)
                    if (ws[addr].t === 'n') {
                        ws[addr].z = '#,##0';
                    }

                    // Encabezados en negrita y color
                    if (R === 0) {
                        ws[addr].s.font = { bold: true };
                        ws[addr].s.fill = { fgColor: { rgb: "F1F5F9" } };
                        ws[addr].s.border = { bottom: { style: "thin" } };
                    }

                    // Calcular ancho
                    const val = ws[addr].v ? String(ws[addr].v) : "";
                    if (val.length > maxWidth) maxWidth = val.length;
                }
                colWidths.push({ wch: maxWidth + 4 });
            }
            ws['!cols'] = colWidths;
        });

        XLSX.writeFile(wb, `Informe_Estrategico_${start}_al_${end}.xlsx`);
        closeReportModal();
    } catch (e) {
        console.error(e);
        alert("Error generando Informe BI");
    }
}

window.previewReport = previewReport;
window.generateStrategicReport = generateStrategicReport;

// --- NOTAS DE VISITA Y RECORDATORIOS ---
let _visitNotesFilter = 'all';
let _visitNotesSearch = '';

function _escapeDashHtml(val) {
    return String(val ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function _formatShortDashDate(dateVal) {
    if (!dateVal) return '--/--/--';
    const parts = String(dateVal).split('-');
    if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2].slice(0, 2)}/${parts[1]}/${parts[0].slice(-2)}`;
    }
    const d = new Date(dateVal);
    if (Number.isNaN(d.getTime())) return '--/--/--';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
}

function _getTodayLocalISODash() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function openVisitNotesModal(filterMode = null, searchQuery = null) {
    if (filterMode !== null) _visitNotesFilter = filterMode;
    if (searchQuery !== null) _visitNotesSearch = searchQuery;

    let modal = document.getElementById('visitNotesModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'visitNotesModal';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-content vn-modal-shell">
            <div class="vn-modal-header">
                <div class="vn-modal-title-wrap">
                    <span class="material-icons-round">edit_note</span>
                    <h2>Notas de Visita</h2>
                </div>
                <button type="button" class="vn-close-btn" onclick="closeVisitNotesModal()" aria-label="Cerrar">
                    <span class="material-icons-round">close</span>
                </button>
            </div>

            <div class="vn-controls-bar">
                <div class="vn-filter-tabs">
                    <button type="button" class="vn-filter-tab ${_visitNotesFilter === 'all' ? 'is-active' : ''}" onclick="setVisitNotesFilter('all')">Todas</button>
                    <button type="button" class="vn-filter-tab ${_visitNotesFilter === 'alerts' ? 'is-active' : ''}" onclick="setVisitNotesFilter('alerts')">Con alerta</button>
                    <button type="button" class="vn-filter-tab ${_visitNotesFilter === 'done' ? 'is-active' : ''}" onclick="setVisitNotesFilter('done')">Completadas</button>
                </div>
                <div class="vn-search-box">
                    <span class="material-icons-round">search</span>
                    <input type="text" id="visitNotesSearchInput" value="${_escapeDashHtml(_visitNotesSearch)}"
                           placeholder="Buscar tienda o nota..." oninput="filterVisitNotesList(this.value)">
                </div>
            </div>

            <div id="visitNotesListContainer" class="vn-list-body"></div>
        </div>
    `;

    modal.classList.add('open');
    document.body.classList.add('no-scroll');
    await renderVisitNotesList();
}

async function renderVisitNotesList() {
    const container = document.getElementById('visitNotesListContainer');
    if (!container) return;

    const allNotes = await dataManager.getVisitNotes();
    const todayISO = _getTodayLocalISODash();
    const normFn = window.normalizeTextKey || (s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim());
    const q = normFn(_visitNotesSearch);

    const filtered = allNotes.filter(n => {
        if (_visitNotesFilter === 'alerts' && (n.done || !n.alertDate)) return false;
        if (_visitNotesFilter === 'done' && !n.done) return false;
        if (q) {
            const hay = normFn(`${n.clientName || ''} ${n.clientCode || ''} ${n.note || ''}`);
            if (!hay.includes(q)) return false;
        }
        return true;
    }).sort((a, b) => {
        const keyA = a.createdAt || a.date || '';
        const keyB = b.createdAt || b.date || '';
        return String(keyB).localeCompare(String(keyA));
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="vn-empty-state">
                <span class="material-icons-round">event_note</span>
                <p>${allNotes.length === 0 ? 'Todavía no has guardado ninguna nota de visita.' : 'No hay notas que coincidan con este filtro.'}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(n => {
        const safeId = _escapeDashHtml(n.id);
        const safeCode = String(n.clientCode || '').replace(/'/g, "\\'");
        const noteDate = _formatShortDashDate(n.date);
        let alertBadgeHtml = '';

        if (n.alertDate) {
            const alertShort = _formatShortDashDate(n.alertDate);
            if (n.done) {
                alertBadgeHtml = `<span class="vn-alert-badge vn-alert-done">✓ Alerta ${alertShort}</span>`;
            } else if (n.alertDate < todayISO) {
                alertBadgeHtml = `<span class="vn-alert-badge vn-alert-overdue">🔔 Vencida (${alertShort})</span>`;
            } else if (n.alertDate === todayISO) {
                alertBadgeHtml = `<span class="vn-alert-badge vn-alert-today">🔔 HOY (${alertShort})</span>`;
            } else {
                alertBadgeHtml = `<span class="vn-alert-badge vn-alert-future">🔔 ${alertShort}</span>`;
            }
        }

        return `
            <div class="vn-note-card ${n.done ? 'is-done' : ''}">
                <div class="vn-note-top">
                    <button type="button" class="vn-store-link" onclick="openClientFromVisitNote('${safeCode}', 'visitNotesModal')">
                        <span>${_escapeDashHtml(n.clientName || 'Cliente')}</span>
                        <span class="material-icons-round">open_in_new</span>
                    </button>
                    <span class="vn-note-date">${noteDate}</span>
                </div>

                <div id="vn-text-${safeId}" class="vn-note-text">${_escapeDashHtml(n.note || '')}</div>

                ${alertBadgeHtml ? `<div class="vn-note-badges">${alertBadgeHtml}</div>` : ''}

                <div id="vn-edit-${safeId}" class="vn-edit-box" style="display: none;">
                    <textarea id="vn-edit-text-${safeId}" class="vn-edit-textarea" rows="2">${_escapeDashHtml(n.note || '')}</textarea>
                    <div class="vn-edit-date-row">
                        <label for="vn-edit-date-${safeId}">Alerta:</label>
                        <input type="date" id="vn-edit-date-${safeId}" class="vn-edit-date" value="${_escapeDashHtml(n.alertDate || '')}">
                        <button type="button" class="vn-edit-clear-date" onclick="document.getElementById('vn-edit-date-${safeId}').value=''" title="Quitar fecha de alerta">✕</button>
                    </div>
                    <div class="vn-edit-actions">
                        <button type="button" class="vn-edit-btn vn-edit-cancel" onclick="cancelEditVisitNote('${safeId}')">Cancelar</button>
                        <button type="button" class="vn-edit-btn vn-edit-save" onclick="saveEditVisitNote('${safeId}')">Guardar</button>
                    </div>
                </div>

                <div class="vn-note-actions">
                    ${(!n.done && n.alertDate) ? `
                    <button type="button" class="vn-act-btn vn-act-snooze" onclick="snoozeVisitNoteFromModal('${safeId}', 7, 'visit')" title="Posponer 7 días">
                        <span class="material-icons-round">update</span>
                        <span>+7d</span>
                    </button>` : ''}
                    <button type="button" class="vn-act-btn ${n.done ? 'vn-act-reopen' : 'vn-act-done'}" onclick="toggleVisitNoteStatus('${safeId}', 'visit')">
                        <span class="material-icons-round">${n.done ? 'replay' : 'check_circle'}</span>
                        <span>${n.done ? 'Reabrir' : 'Hecha'}</span>
                    </button>
                    <button type="button" class="vn-act-btn vn-act-edit" onclick="startEditVisitNote('${safeId}')" title="Editar nota o alerta">
                        <span class="material-icons-round">edit</span>
                        <span>Editar</span>
                    </button>
                    <button type="button" class="vn-act-btn vn-act-del" onclick="deleteVisitNoteFromModal('${safeId}')" title="Eliminar nota">
                        <span class="material-icons-round">delete_outline</span>
                        <span>Borrar</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function closeVisitNotesModal() {
    const modal = document.getElementById('visitNotesModal');
    if (modal) modal.classList.remove('open');
    document.body.classList.remove('no-scroll');
}

function setVisitNotesFilter(mode) {
    _visitNotesFilter = mode;
    document.querySelectorAll('.vn-filter-tab').forEach(btn => btn.classList.remove('is-active'));
    openVisitNotesModal(mode, _visitNotesSearch);
}

function filterVisitNotesList(val) {
    _visitNotesSearch = val || '';
    renderVisitNotesList();
}

async function openStartupVisitAlertsModal(dueAlerts = null) {
    const list = Array.isArray(dueAlerts) ? dueAlerts : await dataManager.getDueVisitAlerts();
    if (!list || list.length === 0) {
        closeStartupVisitAlertsModal();
        return;
    }

    let modal = document.getElementById('startupVisitAlertsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'startupVisitAlertsModal';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }

    const todayISO = _getTodayLocalISODash();

    modal.innerHTML = `
        <div class="modal-content vn-modal-shell vn-startup-shell">
            <div class="vn-startup-header">
                <div class="vn-modal-title-wrap">
                    <span class="material-icons-round">notifications_active</span>
                    <div>
                        <h2>Recordatorios de Visita</h2>
                        <p>${list.length === 1 ? 'Tienes 1 aviso pendiente para hoy' : `Tienes ${list.length} avisos pendientes`}</p>
                    </div>
                </div>
                <button type="button" class="vn-close-btn" onclick="closeStartupVisitAlertsModal()" aria-label="Cerrar">
                    <span class="material-icons-round">close</span>
                </button>
            </div>

            <div class="vn-list-body">
                ${list.map(n => {
                    const safeId = _escapeDashHtml(n.id);
                    const safeCode = String(n.clientCode || '').replace(/'/g, "\\'");
                    const isOverdue = n.alertDate < todayISO;
                    const alertShort = _formatShortDashDate(n.alertDate);
                    return `
                        <div class="vn-note-card">
                            <div class="vn-note-top">
                                <button type="button" class="vn-store-link" onclick="openClientFromVisitNote('${safeCode}', 'startupVisitAlertsModal')">
                                    <span>${_escapeDashHtml(n.clientName || 'Cliente')}</span>
                                    <span class="material-icons-round">open_in_new</span>
                                </button>
                                <span class="vn-alert-badge ${isOverdue ? 'vn-alert-overdue' : 'vn-alert-today'}">
                                    ${isOverdue ? `Vencida ${alertShort}` : `HOY ${alertShort}`}
                                </span>
                            </div>
                            <div class="vn-note-text">${_escapeDashHtml(n.note || '')}</div>
                            <div class="vn-note-meta-line">Visita del ${_formatShortDashDate(n.date)}</div>
                            <div class="vn-note-actions vn-note-actions-row">
                                <button type="button" class="vn-act-btn vn-act-row vn-act-snooze" onclick="snoozeVisitNoteFromModal('${safeId}', 7, 'startup')">
                                    <span class="material-icons-round">update</span>
                                    <span>Posponer +7d</span>
                                </button>
                                <button type="button" class="vn-act-btn vn-act-row vn-act-done" onclick="toggleVisitNoteStatus('${safeId}', 'startup')">
                                    <span class="material-icons-round">check_circle</span>
                                    <span>Hecha</span>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div class="vn-startup-footer">
                <button type="button" class="vn-btn-secondary" onclick="closeStartupVisitAlertsModal(); openVisitNotesModal('alerts')">Ver todas las notas</button>
                <button type="button" class="vn-btn-primary" onclick="closeStartupVisitAlertsModal()">Entendido</button>
            </div>
        </div>
    `;

    modal.classList.add('open');
}

function closeStartupVisitAlertsModal() {
    const modal = document.getElementById('startupVisitAlertsModal');
    if (modal) modal.classList.remove('open');
}

async function toggleVisitNoteStatus(noteId, source = 'visit') {
    await dataManager.toggleVisitNoteDone(noteId);
    if (source === 'startup') {
        const remaining = await dataManager.getDueVisitAlerts();
        if (remaining.length > 0) await openStartupVisitAlertsModal(remaining);
        else closeStartupVisitAlertsModal();
    } else {
        await renderVisitNotesList();
    }
    if (window.currentView === 'dash' && typeof renderDash === 'function') {
        await renderDash(true);
    }
}

async function snoozeVisitNoteFromModal(noteId, days = 7, source = 'visit') {
    await dataManager.snoozeVisitNoteAlert(noteId, days);
    if (source === 'startup') {
        const remaining = await dataManager.getDueVisitAlerts();
        if (remaining.length > 0) await openStartupVisitAlertsModal(remaining);
        else closeStartupVisitAlertsModal();
    } else {
        await renderVisitNotesList();
    }
    if (window.currentView === 'dash' && typeof renderDash === 'function') {
        await renderDash(true);
    }
}

async function deleteVisitNoteFromModal(noteId) {
    if (!confirm('¿Eliminar esta nota de visita?')) return;
    await dataManager.deleteVisitNote(noteId);
    await renderVisitNotesList();
    if (window.currentView === 'dash' && typeof renderDash === 'function') {
        await renderDash(true);
    }
}

function startEditVisitNote(noteId) {
    const textEl = document.getElementById(`vn-text-${noteId}`);
    const editBox = document.getElementById(`vn-edit-${noteId}`);
    const textarea = document.getElementById(`vn-edit-text-${noteId}`);
    if (textEl) textEl.style.display = 'none';
    if (editBox) editBox.style.display = 'flex';
    if (textarea) textarea.focus();
}

function cancelEditVisitNote(noteId) {
    const textEl = document.getElementById(`vn-text-${noteId}`);
    const editBox = document.getElementById(`vn-edit-${noteId}`);
    if (editBox) editBox.style.display = 'none';
    if (textEl) textEl.style.display = 'block';
}

async function saveEditVisitNote(noteId) {
    const textarea = document.getElementById(`vn-edit-text-${noteId}`);
    const dateInput = document.getElementById(`vn-edit-date-${noteId}`);
    const newText = textarea ? textarea.value : '';
    const newAlertDate = dateInput ? dateInput.value : '';
    await dataManager.updateVisitNote(noteId, newText, newAlertDate);
    await renderVisitNotesList();
    if (window.currentView === 'dash' && typeof renderDash === 'function') {
        await renderDash(true);
    }
}

function openClientFromVisitNote(clientCode, modalIdToClose) {
    if (modalIdToClose) {
        const m = document.getElementById(modalIdToClose);
        if (m) m.classList.remove('open');
        document.body.classList.remove('no-scroll');
    }
    if (clientCode && typeof window.openClientDetailModal === 'function') {
        window.openClientDetailModal(clientCode);
    }
}

window.openVisitNotesModal = openVisitNotesModal;
window.closeVisitNotesModal = closeVisitNotesModal;
window.setVisitNotesFilter = setVisitNotesFilter;
window.filterVisitNotesList = filterVisitNotesList;
window.openStartupVisitAlertsModal = openStartupVisitAlertsModal;
window.closeStartupVisitAlertsModal = closeStartupVisitAlertsModal;
window.toggleVisitNoteStatus = toggleVisitNoteStatus;
window.snoozeVisitNoteFromModal = snoozeVisitNoteFromModal;
window.deleteVisitNoteFromModal = deleteVisitNoteFromModal;
window.startEditVisitNote = startEditVisitNote;
window.cancelEditVisitNote = cancelEditVisitNote;
window.saveEditVisitNote = saveEditVisitNote;
window.openClientFromVisitNote = openClientFromVisitNote;




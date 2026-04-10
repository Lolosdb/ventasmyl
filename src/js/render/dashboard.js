/**
 * Lógica de renderizado del Dashboard Principal
 */

let currentDashDate = new Date(); // Estado global para el periodo seleccionado


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

async function renderDash() {
    const app = document.getElementById('app');
    
    // Usar el periodo seleccionado
    const selectedMonth = currentDashDate.getMonth();
    const selectedYear = currentDashDate.getFullYear();
    
    const stats = await dataManager.getDashStats(selectedMonth, selectedYear);
    const goals = await dataManager.getDetailedGoals();
    
    const monthSales = stats.ventasMes.total;
    const targetAmount = stats.ventasMes.objetivo;
    const progressPercent = stats.ventasMes.porcentaje;
    const year = selectedYear;

    let targetLabel = "Objetivo 3% del Mes";
    if (monthSales >= goals.data4[selectedMonth]) targetLabel = "Objetivo 5% del Mes";
    else if (monthSales >= goals.data3[selectedMonth]) targetLabel = "Objetivo 4% del Mes";


    const headerHtml = getCommonHeaderHtml('Dash', {
        extraAction: `
            <button class="btn-header-pill" onclick="openReportModal()" title="Informe Completo">
                <span class="material-icons-round">analytics</span>
                <span>Informe Completo</span>
            </button>
        `
    });

    let contentHtml = '<main class="main-content fade-in-up" style="padding-top: 1rem;">';
    
    // Cabecera de Sección con Selector de Fecha Refinado
    const monthName = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(currentDashDate).toUpperCase();
    const isToday = currentDashDate.getMonth() === new Date().getMonth() && 
                    currentDashDate.getFullYear() === new Date().getFullYear();

    contentHtml += `
        <div class="dash-section-header mb-6" style="padding: 0 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.8rem;">
                <div style="display: flex; align-items: baseline; gap: 12px;">
                    <h1 class="text-3xl font-black text-slate-900 leading-tight" style="margin: 0;">Dash</h1>
                    <span class="text-sm font-bold text-slate-500 tracking-widest" style="white-space: nowrap;">${monthName} ${year}</span>
                </div>
                <div class="date-selector-container">
                    <button class="nav-date-btn" onclick="changeDashMonth(-1)" title="Mes anterior">
                        <span class="material-icons-round">chevron_left</span>
                    </button>
                    <button onclick="resetDashDate()" class="btn-today-selector">HOY</button>
                    <button class="nav-date-btn" onclick="changeDashMonth(1)" title="Mes siguiente">
                        <span class="material-icons-round">chevron_right</span>
                    </button>
                </div>
            </div>
            
            <div style="display: flex; gap: 12px; margin-bottom: 0.5rem;">
                <button class="action-card-pill" onclick="renderDepartamentos()">
                    <span class="material-icons-round" style="color: #3b82f6;">groups</span>
                    <span>Departamentos</span>
                </button>
                <button class="action-card-pill" onclick="openCalendarModal()">
                    <span class="material-icons-round" style="color: #f59e0b;">calendar_month</span>
                    <span>Calendario</span>
                </button>
            </div>
        </div>
    `;

    // --- Lógica de objetivos dinámicos (3% -> 4% -> 5%) ---
    const th = stats.ventasMes.thresholds;
    let activeTarget = th.p3;
    let activeLabel = "Objetivo 3% del Mes";
    
    if (monthSales >= th.p4) {
        activeTarget = th.p5;
        activeLabel = "Objetivo 5% del Mes";
    } else if (monthSales >= th.p3) {
        activeTarget = th.p4;
        activeLabel = "Objetivo 4% del Mes";
    }

    const currentProgressPercent = Math.min((monthSales / activeTarget) * 100, 100).toFixed(1);
    
    // Cálculo de color dinámico (Rojo 0 -> Verde 120)
    const hue = (currentProgressPercent / 100) * 120;
    const barColor = `hsl(${hue}, 85%, 45%)`;
    const glowColor = `hsla(${hue}, 85%, 45%, 0.4)`;

    // Card de Ventas con Comparativa YoY
    contentHtml += `
        <div class="card glass shadow-premium" style="border-left: 5px solid var(--blue-primary); margin-bottom: 1.5rem; padding: 1.5rem 2rem;">
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <p class="card-title-sm" style="margin: 0; font-size: 14px; letter-spacing: 1px; color: #94a3b8; font-weight: 900;">VENTAS DEL MES</p>
                <h2 class="price-display-lg" style="margin: 0; line-height: 1; font-size: 3rem; color: #1e293b;">${formatCurrency(Math.round(monthSales))}</h2>
                
                <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 1.5rem; margin-bottom: 0.5rem;">
                    <span style="font-size: 13px; font-weight: 850; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">${activeLabel}</span>
                    <span style="font-size: 13px; font-weight: 900; color: #1e293b;">${formatCurrency(Math.round(activeTarget))}</span>
                </div>

                <div class="premium-progress-container" onclick="openGoalsModal()" style="cursor: pointer; margin: 0.5rem 0;">
                    <div class="premium-progress-bar" style="width: ${currentProgressPercent}%; background-color: ${barColor}; box-shadow: 0 0 15px ${glowColor};"></div>
                    <div class="premium-progress-text">${currentProgressPercent}%</div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                    ${(() => {
                        const prevYearSales = stats.ventasMes.totalAnterior || 0;
                        const diff = monthSales - prevYearSales;
                        const diffPercent = prevYearSales > 0 ? (diff / prevYearSales) * 100 : (monthSales > 0 ? 100 : 0);
                        const isPositive = diff >= 0;
                        
                        let color, bgColor, borderColor;
                        if (diffPercent < 0) {
                            color = '#ef4444'; bgColor = '#ef444410'; borderColor = '#ef444420';
                        } else if (diffPercent >= 5) {
                            color = '#10b981'; bgColor = '#10b98110'; borderColor = '#10b98120';
                        } else {
                            const ratio = diffPercent / 5;
                            const h = 38 + (142 - 38) * ratio;
                            color = `hsl(${h}, 80%, 45%)`;
                            bgColor = `hsla(${h}, 80%, 45%, 0.1)`;
                            borderColor = `hsla(${h}, 80%, 45%, 0.2)`;
                        }

                        const icon = isPositive ? 'trending_up' : 'trending_down';
                        return `
                            <div style="display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 99px; background: ${bgColor}; color: ${color}; border: 1px solid ${borderColor};">
                                <span class="material-icons-round" style="font-size: 16px;">${icon}</span>
                                <span style="font-size: 12px; font-weight: 850;">${isPositive ? '+' : ''}${diffPercent.toFixed(1)}% vs año ant.</span>
                            </div>

                            <div style="display: flex; align-items: center; gap: 8px; color: #1e293b; font-size: 15px; font-weight: 850; padding-right: 4px;">
                                <span class="material-icons-round" style="font-size: 20px; color: #009ee3;">event_repeat</span>
                                <span>Quedan ${getRemainingBusinessDays(currentDashDate)} días</span>
                            </div>
                        `;
                    })()}
                </div>
            </div>
        </div>
    `;
    // --- CÁLCULO DE VENTAS SEMANALES ---
    const rawWeeks = [];
    const lastDayOfMonth = new Date(year, selectedMonth + 1, 0);
    const todayDate = new Date();
    const realTodayDay = todayDate.getDate();
    const isCurrentRealMonth = todayDate.getMonth() === selectedMonth && todayDate.getFullYear() === selectedYear;

    let sDate = 1;
    while (sDate <= lastDayOfMonth.getDate()) {
        const curr = new Date(year, selectedMonth, sDate);
        let dw = curr.getDay(); // 0 (Sun) to 6 (Sat)
        if (dw === 0) dw = 7; // Normalize Sun to 7
        let eDate = sDate + (7 - dw);
        if (eDate > lastDayOfMonth.getDate()) eDate = lastDayOfMonth.getDate();
        rawWeeks.push({ start: sDate, end: eDate });
        sDate = eDate + 1;
    }

    // Filtrar solo las semanas que contienen al menos un día laborable (L-V)
    const weeksList = rawWeeks.filter(w => {
        for (let d = w.start; d <= w.end; d++) {
            const date = new Date(year, selectedMonth, d);
            const dayOfWeek = date.getDay();
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
        
        return `
            <div class="weekly-stat-card ${isCur ? 'current-week' : ''}">
                <span class="weekly-label">Semana ${i + 1}</span>
                <span class="weekly-amount">${formatCurrency(Math.round(wTotal))}</span>
            </div>
        `;
    }).join('');

    contentHtml += `
        <div class="weekly-sales-grid">
            ${weeklyHtml}
        </div>
    `;

    // Gráfico de Tendencia
    contentHtml += `
        <div class="card glass shadow-premium" style="margin-bottom: 1.5rem;">
            <div class="flex justify-between items-center mb-4">
                <div class="flex items-center gap-2">
                    <div class="icon-circle bg-blue-light">
                        <span class="material-icons-round text-blue-primary">analytics</span>
                    </div>
                    <h3 class="font-bold text-gray-800">Tendencia de Ventas</h3>
                </div>
                <div class="flex items-center gap-4">
                    <div class="flex items-center gap-2">
                        <span style="display: block; width: 10px; height: 10px; border-radius: 50%; background-color: #bae6fd;"></span>
                        <span style="font-size: 11px; font-weight: 800; color: #94a3b8;">Ant.</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span style="display: block; width: 10px; height: 10px; border-radius: 50%; background-color: #009ee3;"></span>
                        <span style="font-size: 11px; font-weight: 800; color: #1e293b;">Actual</span>
                    </div>
                </div>
            </div>
            <div style="height: 220px; position: relative;">
                <canvas id="trendChart"></canvas>
            </div>
        </div>
    `;

    const avgOrderMonth = stats.stats.pedidosMes > 0 ? (stats.ventasMes.total / stats.stats.pedidosMes) : 0;
    contentHtml += `
        <div class="dash-stats-grid-3">
            <div class="card glass shadow-premium flex flex-col justify-center items-center text-center">
                <div class="stat-icon-box mb-2" style="background-color: #e0e7ff;">
                     <span class="material-icons-round" style="color: #4f46e5;">group</span>
                </div>
                <h2 class="text-xl font-bold">${stats.stats.clientesActivos}</h2>
                <p class="text-[10px] uppercase font-bold text-slate-400">Clientes Activos</p>
            </div>
            <div class="card glass shadow-premium flex flex-col justify-center items-center text-center">
                 <div class="stat-icon-box mb-2" style="background-color: #dcfce7;">
                     <span class="material-icons-round" style="color: #16a34a;">shopping_cart</span>
                </div>
                <h2 class="text-xl font-bold">${stats.stats.pedidosMes}</h2>
                <p class="text-[10px] uppercase font-bold text-slate-400">Pedidos Mes</p>
            </div>
            <div class="card glass shadow-premium flex flex-col justify-center items-center text-center">
                 <div class="stat-icon-box mb-2" style="background-color: #fef3c7;">
                     <span class="material-icons-round" style="color: #d97706;">payments</span>
                </div>
                <h2 class="text-xl font-bold">${formatCurrency(Math.round(avgOrderMonth))}</h2>
                <p class="text-[10px] uppercase font-bold text-slate-400">Media Pedido</p>
            </div>
        </div>

        <div style="margin-top: 2rem; margin-bottom: 1rem; display: flex; align-items: center; justify-content: center; gap: 10px;">
            <span class="material-icons-round" style="color: #fbbf24; font-size: 22px;">emoji_events</span>
            <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 0.8px;">Top Clientes Mensual</h3>
        </div>

        <div class="top-clients-list" style="margin-bottom: 2.5rem; display: flex; flex-direction: column; align-items: center; width: 100%;">
            ${(stats.topClientes || []).map(c => `
                <div class="card glass shadow-sm" style="padding: 12px 16px; border-radius: 16px; margin-bottom: 0.6rem; display: flex; align-items: center; background: white; border: 1px solid rgba(0,0,0,0.03); width: 90%; max-width: 400px;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div class="rank-circle" style="background: #f1f5f9; color: #64748b; font-size: 11px; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0;">
                            ${c.rank.toString().padStart(2, '0')}
                        </div>
                        <div>
                            <div style="font-size: 13px; font-weight: 800; color: #1e293b; text-transform: uppercase; line-height: 1.2;">${c.name}</div>
                            <div style="font-size: 12px; font-weight: 600; color: #94a3b8; margin-top: 2px;">${formatCurrency(Math.round(c.amount))}</div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
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

    app.innerHTML = headerHtml + contentHtml;
    
    if (typeof initDashCharts === 'function') initDashCharts(stats);
    if (window.activeCurrentNav) window.activeCurrentNav('dash');

    // Ocultar Splash Screen tras un breve retardo para asegurar suavidad
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) splash.classList.add('splash-hidden');
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


async function initDashCharts(stats) {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;

    // Destruir instancia previa si existe para evitar duplicados y flickering
    if (window.myTrendChart) window.myTrendChart.destroy();

    const ctx = canvas.getContext('2d');
    const allHistory = await dataManager.getSalesHistory();
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    
    const labels = stats.tendencia.map(t => t.mes);
    const currentData = stats.tendencia.map(t => t.ventas);
    
    const now = new Date();
    const lastYearData = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mIdx = d.getMonth();
        const val = (allHistory[lastYear] && allHistory[lastYear][mIdx]) || 0;
        lastYearData.push(val);
    }

    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';

    window.myTrendChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Año Anterior',
                    data: lastYearData,
                    backgroundColor: '#bae6fd', // Azul Cielo suave (Sky Blue)
                    borderRadius: 4,
                    borderSkipped: false,
                    barPercentage: 0.85,
                    categoryPercentage: 0.7
                },
                {
                    label: 'Año Actual',
                    data: currentData,
                    backgroundColor: '#009ee3',
                    borderRadius: 4,
                    borderSkipped: false,
                    barPercentage: 0.85,  // Pequeña separación entre barras del mismo mes
                    categoryPercentage: 0.7 // Espacio general
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { top: 10, bottom: 0, left: -5, right: 5 }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: isDark ? '#1e293b' : '#fff',
                    titleColor: isDark ? '#f8fafc' : '#1e293b',
                    titleFont: { size: 14, weight: 'bold' },
                    bodyColor: isDark ? '#94a3b8' : '#64748b',
                    bodyFont: { size: 12, weight: '600' },
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                    borderWidth: 1,
                    cornerRadius: 12,
                    padding: 12,
                    boxPadding: 8,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += formatCurrency(Math.round(context.parsed.y));
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: gridColor, drawBorder: false },
                    border: { display: false },
                    ticks: {
                        color: textColor,
                        font: { size: 10, weight: '600' },
                        callback: (value) => value >= 1000 ? (value/1000) + 'k' : value,
                        padding: 8
                    }
                },
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: {
                        color: textColor,
                        font: { size: 10, weight: '800' },
                        autoSkip: false,
                        maxRotation: 0,
                        padding: 10
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

        const activeClients = new Set(currentOrders.map(o => o.shop)).size;
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
            if (!clientStats[o.shop]) clientStats[o.shop] = { amount: 0, count: 0 };
            clientStats[o.shop].amount += (o.amount || 0);
            clientStats[o.shop].count++;
        });

        const sorted = Object.entries(clientStats)
            .sort((a,b) => b[1].amount - a[1].amount)
            .slice(0, 15);

        sorted.forEach(([name, data]) => {
            html += `
                <tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td class="p-3 font-black text-slate-700 uppercase tracking-tight">${name}</td>
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
        const clientMap = new Map(clients.map(c => [(c.name || '').toLowerCase().trim(), c]));

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
            { "MÉTRICA": "Clientes Únicos Activos", "VALOR": new Set(currentOrders.map(o => o.shop)).size, "NOTA": "Distintos clientes que compraron ahora" }
        ];
        
        const shopsBeforeStart = new Set(orders.filter(o => new Date(o.dateISO) < startD).map(o => o.shop.toLowerCase().trim()));
        const newClients = Array.from(new Set(currentOrders.map(o => o.shop))).filter(s => !shopsBeforeStart.has(s.toLowerCase().trim())).length;
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
            const s = o.shop;
            if (!clientStats[s]) clientStats[s] = { amount: 0, count: 0 };
            clientStats[s].amount += (o.amount || 0);
            clientStats[s].count++;
        });
        const ranking = Object.entries(clientStats)
            .sort((a,b) => b[1].amount - a[1].amount)
            .map(([name, data], idx) => {
                const c = clientMap.get(name.toLowerCase().trim()) || {};
                return {
                    "RANKING": idx + 1,
                    "TIENDA": name,
                    "FACTURACIÓN (€)": Math.round(data.amount),
                    "Nº PEDIDOS": data.count,
                    "TICKET MEDIO (€)": Math.round(data.amount / data.count),
                    "PROVINCIA": c.province || "SUR"
                };
            });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ranking), "3. Top Clientes");

        // 4. FUGAS RIESGO
        const currentShops = new Set(currentOrders.map(o => o.shop.toLowerCase().trim()));
        // Fugas basadas en pedidos reales previos si existen, o si no hay, mensaje informativo
        const prevOrdersExist = orders.filter(o => new Date(o.dateISO).getFullYear() === prevYear);
        const prevShopsStats = {};
        prevOrdersExist.forEach(o => {
            if (!currentShops.has(o.shop.toLowerCase().trim())) {
                prevShopsStats[o.shop] = (prevShopsStats[o.shop] || 0) + (o.amount || 0);
            }
        });
        const fugas = Object.entries(prevShopsStats).map(([name, amount]) => ({ "KPI": "CLIENTE PERDIDO", "TIENDA": name, "VENTA AÑO PASADO": Math.round(amount) }));
        if (fugas.length === 0) fugas.push({ "INFO": "No hay datos de pedidos detallados del año anterior para detectar fugas." });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fugas), "4. Fugas Riesgo");

        // 5. GEOGRAFICO
        const provStats = {};
        const pobStats = {};
        currentOrders.forEach(o => {
            const c = clientMap.get(o.shop.toLowerCase().trim()) || {};
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
                const c = clientMap.get(o.shop.toLowerCase().trim()) || {};
                return {
                    "Nº": o.displayId || String(o.id).split('-').pop(),
                    "FECHA": new Date(o.dateISO).toLocaleDateString('es-ES'),
                    "TIENDA": o.shop,
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

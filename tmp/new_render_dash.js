
async function renderDash() {
    const app = document.getElementById('app');
    const stats = await dataManager.getDashStats();
    const goals = await dataManager.getDetailedGoals();
    const monthSales = stats.ventasMes.total;
    const targetAmount = stats.ventasMes.objetivo;
    const progressPercent = stats.ventasMes.porcentaje;
    const year = new Date().getFullYear();

    // Determine Label matches logic in getDashStats
    const currentMonthIdx = new Date().getMonth();
    let targetLabel = "Objetivo 3% del Mes";
    if (monthSales >= goals.data4[currentMonthIdx]) targetLabel = "Objetivo 5% del Mes";
    else if (monthSales >= goals.data3[currentMonthIdx]) targetLabel = "Objetivo 4% del Mes";

    const headerHtml = `
        <header class="header">
            <div class="header-content">
                <div class="user-info">
                   <div class="avatar">
                        <span class="material-icons-round text-blue-primary">person</span>
                   </div>
                   <div class="user-text">
                        <p class="greeting text-xs font-medium">Panel de Control</p>
                        <h1 class="user-name text-lg font-bold">${year}</h1>
                   </div>
                </div>
                <div class="header-actions flex items-center gap-2">
                    <button class="icon-btn-ghost shadow-sm theme-toggle-btn" onclick="toggleTheme()" title="Cambiar Tema">
                        <span class="material-icons-round theme-icon">dark_mode</span>
                    </button>
                    <button class="icon-btn-ghost shadow-sm" onclick="openReportModal()" title="Informe Completo">
                        <span class="material-icons-round text-blue-primary">analytics</span>
                        <span class="btn-text">Informe Completo</span>
                    </button>
                </div>
            </div>
        </header>
    `;

    let contentHtml = '<main class="main-content fade-in-up">';

    // 1. Ventas del Mes Card
    contentHtml += `
        <div class="card glass shadow-premium" style="border-left: 5px solid var(--blue-primary); margin-bottom: 1.5rem;">
            <div class="sales-card-grid">
                <div>
                    <p class="card-title-sm">Ventas del Mes</p>
                    <h2 class="price-display-lg">${Math.round(monthSales).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} €</h2>
                    
                    <div class="flex items-center gap-2 mt-2">
                        <span class="text-xs text-secondary">${targetLabel}</span>
                        <span class="text-xs font-bold text-gray-400">(${Math.round(targetAmount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} €)</span>
                    </div>

                    <!-- YoY Comparison -->
                    <div class="mt-3 flex items-center gap-2">
                        ${(() => {
                            const prevYearSales = stats.ventasMes.totalAnterior || 0;
                            const diff = monthSales - prevYearSales;
                            const diffPercent = prevYearSales > 0 ? ((diff / prevYearSales) * 100).toFixed(1) : (monthSales > 0 ? 100 : 0);
                            const isPositive = diff >= 0;
                            const color = isPositive ? '#10b981' : '#ef4444';
                            const icon = isPositive ? 'trending_up' : 'trending_down';
                            return `
                                <div class="flex items-center gap-1 px-2 py-0.5 rounded-full" style="background: ${color}15; color: ${color}; border: 1px solid ${color}30;">
                                    <span class="material-icons-round" style="font-size: 14px;">${icon}</span>
                                    <span class="text-[10px] font-bold">${isPositive ? '+' : ''}${diffPercent}% vs año ant.</span>
                                </div>
                            `;
                        })()}
                    </div>
                </div>

                <div class="progress-circle-container" onclick="openGoalsModal()" style="cursor: pointer;">
                    <svg class="progress-circle-svg" viewBox="0 0 100 100">
                        <circle class="progress-circle-bg" cx="50" cy="50" r="40" />
                        <circle class="progress-circle-fill shadow-glow" cx="50" cy="50" r="40" 
                                style="stroke-dasharray: 251.2; stroke-dashoffset: ${251.2 - (251.2 * Math.min(progressPercent, 100) / 100)};" />
                    </svg>
                    <div class="progress-circle-text">${progressPercent}%</div>
                </div>
            </div>
        </div>
    `;

    // 2. Tendencia con Chart.js
    contentHtml += `
        <div class="card glass shadow-premium" style="margin-bottom: 1.5rem;">
            <div class="flex justify-between items-center mb-4">
                <div class="flex items-center gap-2">
                    <div class="icon-circle bg-blue-light">
                        <span class="material-icons-round text-blue-primary">analytics</span>
                    </div>
                    <h3 class="font-bold text-gray-800">Tendencia de Ventas</h3>
                </div>
                <div class="flex items-center gap-3">
                    <div class="flex items-center gap-1">
                        <span class="w-3 h-3 rounded-full" style="background: #009ee3;"></span>
                        <span class="text-[10px] text-gray-500 font-medium">Actual</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <span class="w-3 h-3 rounded-full" style="background: #cbd5e1;"></span>
                        <span class="text-[10px] text-gray-500 font-medium">Ant.</span>
                    </div>
                </div>
            </div>
            <div style="height: 220px; position: relative;">
                <canvas id="trendChart"></canvas>
            </div>
        </div>
    `;

    // 3. Stats Row
    const avgOrderMonth = stats.stats.pedidosMes > 0 ? (stats.ventasMes.total / stats.stats.pedidosMes) : 0;
    contentHtml += `
        <div class="dash-stats-grid-3">
            <div class="card glass shadow-premium flex flex-col justify-center items-center text-center">
                <div class="stat-icon-box mb-2" style="background-color: #e0e7ff;">
                     <span class="material-icons-round" style="color: #4f46e5;">group</span>
                </div>
                <h2 class="text-xl font-bold">${stats.stats.clientesActivos}</h2>
                <p class="text-[10px] uppercase font-bold text-slate-400">Clientes</p>
            </div>
            <div class="card glass shadow-premium flex flex-col justify-center items-center text-center">
                 <div class="stat-icon-box mb-2" style="background-color: #dcfce7;">
                     <span class="material-icons-round" style="color: #16a34a;">shopping_cart</span>
                </div>
                <h2 class="text-xl font-bold">${stats.stats.pedidosMes}</h2>
                <p class="text-[10px] uppercase font-bold text-slate-400">Pedidos</p>
            </div>
            <div class="card glass shadow-premium flex flex-col justify-center items-center text-center">
                 <div class="stat-icon-box mb-2" style="background-color: #fef3c7;">
                     <span class="material-icons-round" style="color: #d97706;">payments</span>
                </div>
                <h2 class="text-xl font-bold">${Math.round(avgOrderMonth)}€</h2>
                <p class="text-[10px] uppercase font-bold text-slate-400">Media</p>
            </div>
        </div>
    `;

    // 4. Modales
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
                    <div class="flex gap-2">
                        <button class="btn btn-secondary flex-1 flex items-center justify-center gap-2" onclick="previewReport()">
                            <span class="material-icons-round">visibility</span>
                            Previsualizar
                        </button>
                        <button class="btn btn-primary flex-1 flex items-center justify-center gap-2" onclick="generateStrategicReport()">
                            <span class="material-icons-round">description</span>
                            Descargar Excel
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <div id="previewModal" class="modal-overlay">
            <div class="modal-content" style="max-width: 90%; width: 600px;">
                <div class="modal-header">
                    <h2 class="text-xl font-bold">Vista Previa de Ventas</h2>
                    <button class="icon-btn" onclick="document.getElementById('previewModal').classList.remove('active')">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                <div id="previewContent" class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                    <!-- Tabla de previsualización -->
                </div>
            </div>
        </div>
    `;

    contentHtml += '</main>';
    contentHtml += renderBottomNav('dash');

    app.innerHTML = headerHtml + contentHtml;
    
    // Inicializar gráficos
    if (typeof initDashCharts === 'function') initDashCharts(stats);
    if (window.activeCurrentNav) window.activeCurrentNav('dash');
}

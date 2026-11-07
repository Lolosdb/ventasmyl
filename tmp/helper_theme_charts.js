
/**
 * Inicializa los gráficos del Dashboard usando Chart.js
 */
async function initDashCharts(stats) {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;

    // Obtener historial completo para comparativa interanual en el gráfico
    const allHistory = await dataManager.getSalesHistory();
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    
    // Preparar etiquetas (6 meses)
    const labels = stats.tendencia.map(t => t.mes);
    const currentData = stats.tendencia.map(t => t.ventas);
    
    // Preparar datos del año pasado para los mismos meses
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
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

    new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Año Actual',
                    data: currentData,
                    borderColor: '#009ee3',
                    backgroundColor: 'rgba(0, 158, 227, 0.1)',
                    borderWidth: 3,
                    pointBackgroundColor: '#009ee3',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Año Anterior',
                    data: lastYearData,
                    borderColor: '#cbd5e1',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.4,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: isDark ? '#1e293b' : '#fff',
                    titleColor: isDark ? '#fff' : '#1e293b',
                    bodyColor: isDark ? '#cbd5e1' : '#64748b',
                    borderColor: '#009ee333',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(context.parsed.y);
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
                    ticks: {
                        color: textColor,
                        font: { size: 10 },
                        callback: (value) => value >= 1000 ? (value/1000) + 'k€' : value + '€'
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        color: textColor,
                        font: { size: 10, weight: 'bold' }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'nearest'
            }
        }
    });
}

/**
 * Cambia entre modo claro y oscuro
 */
function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    // Actualizar icono
    const icon = document.querySelector('.theme-icon');
    if (icon) {
        icon.textContent = isDark ? 'light_mode' : 'dark_mode';
    }
    
    // Recargar Dash si estamos en él
    if (document.getElementById('trendChart')) {
        renderDash();
    }
}

/**
 * Inicializa el tema
 */
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

// Inicializar el tema
initTheme();

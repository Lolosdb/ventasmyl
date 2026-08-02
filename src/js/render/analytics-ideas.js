/**
 * analytics-ideas.js — Motor de Inteligencia Comercial "Ideas de Visita"
 *
 * Analiza el historial de pedidos para detectar patrones de compra
 * (frecuencia, estacionalidad, volumen) y genera planes de visitas
 * agrupando clientes por proximidad geográfica.
 */

// ─── CONSTANTES ────────────────────────────────────────────
const IDEAS_MAX_DISTANCE_KM = 50;       // Radio máximo de agrupación geográfica
const IDEAS_CLIENTS_PER_DAY = 5;        // Clientes ideales por día
const IDEAS_WEIGHT_URGENCY = 0.50;      // Peso del factor urgencia
const IDEAS_WEIGHT_SEASON  = 0.30;      // Peso del factor estacionalidad
const IDEAS_WEIGHT_VOLUME  = 0.20;      // Peso del factor volumen
const IDEAS_PROSPECT_SCORE = 8;         // Puntuación base para clientes sin pedidos

// ─── UTILIDADES GEOGRÁFICAS ────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── FASE 1: ANÁLISIS DE PATRONES ──────────────────────────
function analyzeClientPatterns(clients, orders) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Indexar pedidos por nombre de tienda (lowercase trim)
    const ordersByShop = {};
    orders.forEach(o => {
        const key = (o.shop || '').toLowerCase().trim();
        if (!key) return;
        if (!ordersByShop[key]) ordersByShop[key] = [];
        ordersByShop[key].push(o);
    });

    const patterns = [];

    clients.forEach(client => {
        const key = (client.name || '').toLowerCase().trim();
        const clientOrders = (ordersByShop[key] || [])
            .filter(o => o.date || o.dateISO)
            .map(o => ({
                date: new Date(o.dateISO || o.date),
                amount: parseFloat(o.amount) || 0
            }))
            .sort((a, b) => a.date - b.date);

        const lat = parseFloat(client.lat);
        const lng = parseFloat(client.lng);
        const hasGPS = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;

        const pattern = {
            client,
            name: client.name,
            code: client.code,
            province: client.province || '',
            location: client.location || '',
            lat: hasGPS ? lat : null,
            lng: hasGPS ? lng : null,
            hasGPS,
            orderCount: clientOrders.length,
            avgFrequencyDays: null,
            daysSinceLastOrder: null,
            lastOrderDate: null,
            seasonalMonths: [],
            avgAmount: 0,
            totalAmount: 0,
            score: 0,
            reason: '',
            isProspect: clientOrders.length === 0
        };

        if (clientOrders.length === 0) {
            // Cliente de prospección
            pattern.score = IDEAS_PROSPECT_SCORE;
            pattern.reason = 'Cliente sin historial de pedidos — prospección';
            patterns.push(pattern);
            return;
        }

        // Última compra
        const lastOrder = clientOrders[clientOrders.length - 1];
        pattern.lastOrderDate = lastOrder.date;
        pattern.daysSinceLastOrder = Math.floor((today - lastOrder.date) / (1000 * 60 * 60 * 24));

        // Importe medio y total
        const totalAmt = clientOrders.reduce((s, o) => s + o.amount, 0);
        pattern.totalAmount = totalAmt;
        pattern.avgAmount = totalAmt / clientOrders.length;

        // Frecuencia media (días entre pedidos consecutivos)
        if (clientOrders.length >= 2) {
            const gaps = [];
            for (let i = 1; i < clientOrders.length; i++) {
                const diffDays = Math.floor(
                    (clientOrders[i].date - clientOrders[i - 1].date) / (1000 * 60 * 60 * 24)
                );
                if (diffDays > 0) gaps.push(diffDays);
            }
            if (gaps.length > 0) {
                pattern.avgFrequencyDays = Math.round(
                    gaps.reduce((s, g) => s + g, 0) / gaps.length
                );
            }
        }

        // Si solo tiene 1 pedido, estimar frecuencia como desconocida
        if (!pattern.avgFrequencyDays && clientOrders.length === 1) {
            pattern.avgFrequencyDays = 90;
        }

        // Estacionalidad: en qué meses suele comprar
        const monthCounts = Array(12).fill(0);
        clientOrders.forEach(o => monthCounts[o.date.getMonth()]++);
        const maxMonthCount = Math.max(...monthCounts);
        if (maxMonthCount > 0) {
            const threshold = maxMonthCount * 0.3;
            pattern.seasonalMonths = monthCounts
                .map((c, i) => c >= threshold ? i : -1)
                .filter(i => i >= 0);
        }

        patterns.push(pattern);
    });

    return patterns;
}

// ─── FASE 2: PUNTUACIÓN ────────────────────────────────────
function scoreClients(patterns) {
    const today = new Date();
    const currentMonth = today.getMonth();

    const maxAmount = Math.max(1, ...patterns.filter(p => !p.isProspect).map(p => p.avgAmount));

    patterns.forEach(p => {
        if (p.isProspect) return;

        // Urgencia (0-100)
        let urgencyScore = 0;
        if (p.avgFrequencyDays && p.avgFrequencyDays > 0) {
            const ratio = p.daysSinceLastOrder / p.avgFrequencyDays;
            urgencyScore = Math.min(100, ratio * 50);
        } else if (p.daysSinceLastOrder !== null) {
            urgencyScore = Math.min(100, p.daysSinceLastOrder / 2);
        }

        // Estacionalidad (0-100)
        let seasonScore = 0;
        if (p.seasonalMonths.length > 0) {
            if (p.seasonalMonths.includes(currentMonth)) {
                seasonScore = 100;
            } else {
                const nextMonth = (currentMonth + 1) % 12;
                if (p.seasonalMonths.includes(nextMonth)) {
                    seasonScore = 40;
                }
            }
        }

        // Volumen (0-100)
        const volumeScore = (p.avgAmount / maxAmount) * 100;

        // Score final ponderado
        p.score = Math.round(
            (IDEAS_WEIGHT_URGENCY * urgencyScore) +
            (IDEAS_WEIGHT_SEASON * seasonScore) +
            (IDEAS_WEIGHT_VOLUME * volumeScore)
        );

        // Razón principal
        if (p.avgFrequencyDays && p.daysSinceLastOrder > p.avgFrequencyDays) {
            const overdue = p.daysSinceLastOrder - p.avgFrequencyDays;
            p.reason = `Supera su ciclo habitual en ${overdue} días`;
        } else if (p.seasonalMonths.includes(currentMonth)) {
            const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
            p.reason = `Suele comprar en ${monthNames[currentMonth]}`;
        } else if (p.avgAmount >= maxAmount * 0.7) {
            p.reason = 'Cliente de alto volumen — mantener contacto';
        } else if (p.daysSinceLastOrder > 60) {
            p.reason = `Sin actividad desde hace ${p.daysSinceLastOrder} días`;
        } else {
            p.reason = 'Visita de seguimiento comercial';
        }
    });

    return patterns;
}

// ─── FASE 3: CLUSTERING GEOGRÁFICO ────────────────────────
function clusterByProximity(scoredClients, maxDistKm) {
    const withGPS = scoredClients.filter(c => c.hasGPS);
    const withoutGPS = scoredClients.filter(c => !c.hasGPS);

    withGPS.sort((a, b) => b.score - a.score);

    const clusters = [];
    const assigned = new Set();

    withGPS.forEach(client => {
        if (assigned.has(client.code)) return;

        const cluster = {
            centroid: client,
            clients: [client],
            label: client.province || client.location || 'Zona sin definir',
            avgLat: client.lat,
            avgLng: client.lng,
            totalScore: client.score
        };
        assigned.add(client.code);

        withGPS.forEach(other => {
            if (assigned.has(other.code)) return;
            const dist = haversineKm(cluster.avgLat, cluster.avgLng, other.lat, other.lng);
            if (dist <= maxDistKm) {
                cluster.clients.push(other);
                cluster.totalScore += other.score;
                assigned.add(other.code);
                const n = cluster.clients.length;
                cluster.avgLat = cluster.clients.reduce((s, c) => s + c.lat, 0) / n;
                cluster.avgLng = cluster.clients.reduce((s, c) => s + c.lng, 0) / n;
            }
        });

        const provinces = cluster.clients.map(c => c.province).filter(Boolean);
        const locations = cluster.clients.map(c => c.location).filter(Boolean);
        if (provinces.length > 0) {
            const freq = {};
            provinces.forEach(p => freq[p] = (freq[p] || 0) + 1);
            cluster.label = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
        }
        const uniqueLocations = [...new Set(locations)].slice(0, 3);
        if (uniqueLocations.length > 0) {
            cluster.sublabel = uniqueLocations.join(', ');
        }

        clusters.push(cluster);
    });

    // Clientes sin GPS: agrupar por provincia
    if (withoutGPS.length > 0) {
        const byProvince = {};
        withoutGPS.forEach(c => {
            const prov = c.province || 'Sin provincia';
            if (!byProvince[prov]) byProvince[prov] = [];
            byProvince[prov].push(c);
        });
        Object.entries(byProvince).forEach(([prov, clients]) => {
            clients.sort((a, b) => b.score - a.score);
            clusters.push({
                centroid: null,
                clients,
                label: prov,
                sublabel: [...new Set(clients.map(c => c.location).filter(Boolean))].slice(0, 3).join(', '),
                avgLat: null,
                avgLng: null,
                totalScore: clients.reduce((s, c) => s + c.score, 0)
            });
        });
    }

    clusters.sort((a, b) => b.totalScore - a.totalScore);
    return clusters;
}

// ─── FASE 4: PLAN DIARIO ──────────────────────────────────
function generateVisitPlan(clusters, numDays) {
    const plan = [];

    for (let day = 0; day < numDays && day < clusters.length; day++) {
        const cluster = clusters[day];

        const sortedClients = [...cluster.clients].sort((a, b) => b.score - a.score);
        const count = Math.min(sortedClients.length, IDEAS_CLIENTS_PER_DAY + 2);
        const dayClients = sortedClients.slice(0, Math.max(count, IDEAS_CLIENTS_PER_DAY));

        plan.push({
            dayNumber: day + 1,
            zone: cluster.label,
            subzone: cluster.sublabel || '',
            clients: dayClients,
            totalClients: cluster.clients.length
        });
    }

    return plan;
}

// ─── RENDERIZADO DE LA VISTA ──────────────────────────────
async function renderIdeas(isBack = false) {
    if (typeof updateHistoryState === 'function') updateHistoryState('ideas', isBack);
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Ideas de Visita');

    let contentHtml = `<main class="ideas-wrapper">
        <div class="ideas-selector-card">
            <div class="ideas-selector-header">
                <span class="material-icons-round" style="color: #f59e0b; font-size: 28px;">lightbulb</span>
                <div>
                    <p class="ideas-selector-title">Planificador Inteligente</p>
                    <p class="ideas-selector-subtitle">El sistema analiza los patrones de compra de tus clientes para sugerirte las mejores visitas</p>
                </div>
            </div>
            <p class="ideas-selector-label">¿Cuántos días quieres planificar?</p>
            <div class="ideas-day-buttons" id="ideasDaySelector">
                ${[1, 2, 3, 4, 5].map(n => `
                    <button class="ideas-day-btn ${n === 3 ? 'active' : ''}" onclick="selectIdeasDays(${n})">${n}</button>
                `).join('')}
            </div>
            <button class="ideas-generate-btn" onclick="generateIdeasPlan()">
                <span class="material-icons-round">auto_awesome</span>
                Generar Plan
            </button>
        </div>
        <div id="ideasResultContainer"></div>
    </main>`;

    contentHtml += renderBottomNav(null);
    app.innerHTML = headerHtml + contentHtml;
}

let _ideasSelectedDays = 3;
function selectIdeasDays(n) {
    _ideasSelectedDays = n;
    document.querySelectorAll('.ideas-day-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.textContent) === n);
    });
}

async function generateIdeasPlan() {
    const container = document.getElementById('ideasResultContainer');
    container.innerHTML = `
        <div class="ideas-loading">
            <span class="material-icons-round ideas-loading-icon">psychology</span>
            <p class="ideas-loading-text">Analizando patrones de compra...</p>
            <p class="ideas-loading-sub">Esto puede tardar unos segundos</p>
        </div>
    `;

    await new Promise(r => setTimeout(r, 300));

    try {
        const clients = await dataManager.getClients();
        const orders = await dataManager.getOrders();

        const patterns = analyzeClientPatterns(clients, orders);
        const scored = scoreClients(patterns);
        const candidatos = scored.filter(p => p.score > 0).sort((a, b) => b.score - a.score);

        if (candidatos.length === 0) {
            container.innerHTML = `
                <div class="ideas-empty">
                    <span class="material-icons-round" style="font-size: 64px; opacity: 0.3;">lightbulb</span>
                    <p style="font-weight: 800; margin-top: 1rem; color: #64748b;">No hay suficientes datos</p>
                    <p style="font-size: 0.85rem; color: #94a3b8; margin-top: 0.5rem;">Registra más pedidos para que el sistema pueda aprender los patrones de tus clientes</p>
                </div>
            `;
            return;
        }

        const clusters = clusterByProximity(candidatos, IDEAS_MAX_DISTANCE_KM);
        const plan = generateVisitPlan(clusters, _ideasSelectedDays);

        const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
            'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

        let html = '';
        plan.forEach(day => {
            html += `
                <div class="ideas-day-card">
                    <div class="ideas-day-header">
                        <div class="ideas-day-badge">Día ${day.dayNumber}</div>
                        <div class="ideas-day-zone">
                            <span class="material-icons-round" style="font-size: 18px;">location_on</span>
                            <span>${day.zone}</span>
                        </div>
                        ${day.subzone ? `<p class="ideas-day-subzone">${day.subzone}</p>` : ''}
                    </div>
                    <div class="ideas-clients-list">
                        ${day.clients.map((c, idx) => {
                            const lastDateStr = c.lastOrderDate
                                ? `${c.lastOrderDate.getDate()} ${monthNames[c.lastOrderDate.getMonth()]} ${c.lastOrderDate.getFullYear()}`
                                : 'Sin pedidos';
                            const freqStr = c.avgFrequencyDays
                                ? `cada ~${c.avgFrequencyDays} días`
                                : '—';
                            const amtStr = c.avgAmount > 0
                                ? `${formatCurrency(Math.round(c.avgAmount)).replace(' €', '')} €`
                                : '—';
                            const scoreColor = c.score >= 60 ? '#ef4444'
                                             : c.score >= 40 ? '#f59e0b'
                                             : c.score >= 20 ? '#3b82f6'
                                             : '#94a3b8';
                            const prospectBadge = c.isProspect
                                ? '<span class="ideas-prospect-badge">PROSPECCIÓN</span>'
                                : '';

                            return `
                            <div class="ideas-client-card">
                                <div class="ideas-client-rank">${idx + 1}</div>
                                <div class="ideas-client-info">
                                    <div class="ideas-client-name-row">
                                        <p class="ideas-client-name">${c.name}</p>
                                        ${prospectBadge}
                                    </div>
                                    <p class="ideas-client-reason">
                                        <span class="material-icons-round" style="font-size: 14px; vertical-align: -2px;">lightbulb</span>
                                        ${c.reason}
                                    </p>
                                    <div class="ideas-client-stats">
                                        <div class="ideas-stat">
                                            <span class="ideas-stat-label">Última compra</span>
                                            <span class="ideas-stat-value">${lastDateStr}</span>
                                        </div>
                                        ${!c.isProspect ? `
                                        <div class="ideas-stat">
                                            <span class="ideas-stat-label">Frecuencia</span>
                                            <span class="ideas-stat-value">${freqStr}</span>
                                        </div>
                                        <div class="ideas-stat">
                                            <span class="ideas-stat-label">Importe medio</span>
                                            <span class="ideas-stat-value">${amtStr}</span>
                                        </div>
                                        ` : ''}
                                    </div>
                                </div>
                                <div class="ideas-client-actions">
                                    <div class="ideas-score-ring" style="--score-color: ${scoreColor}">
                                        <span>${c.score}</span>
                                    </div>
                                    ${c.hasGPS ? `
                                    <a href="https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}"
                                       target="_blank" class="ideas-map-btn" title="Navegar">
                                        <span class="material-icons-round">navigation</span>
                                    </a>` : ''}
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                    ${day.totalClients > day.clients.length ? `
                        <p class="ideas-day-more">+${day.totalClients - day.clients.length} clientes más en esta zona</p>
                    ` : ''}
                </div>
            `;
        });

        html += `
            <div class="ideas-footer-stats">
                <p><strong>${candidatos.length}</strong> clientes analizados · <strong>${candidatos.filter(c => !c.isProspect && c.orderCount >= 2).length}</strong> con patrones detectados · <strong>${candidatos.filter(c => c.isProspect).length}</strong> de prospección</p>
                <p style="opacity: 0.6; font-size: 0.7rem; margin-top: 4px;">El sistema mejora con cada pedido registrado</p>
            </div>
        `;

        container.innerHTML = html;

    } catch (e) {
        console.error('Error generando Ideas:', e);
        container.innerHTML = `
            <div class="ideas-empty">
                <span class="material-icons-round" style="font-size: 48px; color: #ef4444;">error_outline</span>
                <p style="font-weight: 800; margin-top: 1rem; color: #ef4444;">Error al generar el plan</p>
                <p style="font-size: 0.85rem; color: #94a3b8; margin-top: 0.5rem;">${e.message}</p>
            </div>
        `;
    }
}

window.renderIdeas = renderIdeas;
window.selectIdeasDays = selectIdeasDays;
window.generateIdeasPlan = generateIdeasPlan;

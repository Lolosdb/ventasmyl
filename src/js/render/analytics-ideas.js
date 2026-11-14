/**
 * analytics-ideas.js — Motor de Inteligencia Comercial "Ideas de Visita"
 *
 * Aprende longitudinalmente el timing real de cada cliente (ciclo ponderado por recencia,
 * mediana anti-atípicos, estacionalidad multi-año por importe y ventanas interanuales),
 * integra historial de visitas reales, notas/alertas y pedidos en curso, y genera rutas
 * optimizadas geográficamente para smartphone vertical.
 */

// ─── CONSTANTES DEL MOTOR ──────────────────────────────────
const IDEAS_MAX_DISTANCE_KM = 10;       // Radio máximo de agrupación geográfica (10 km)
const IDEAS_MIN_PRIORITY_SCORE = 40;    // Umbral de clientes prioritarios
const IDEAS_WEIGHT_URGENCY = 0.45;      // Peso del factor urgencia sobre ciclo aprendido
const IDEAS_WEIGHT_SEASON  = 0.35;      // Peso del factor estacionalidad multi-año
const IDEAS_WEIGHT_VOLUME  = 0.20;      // Peso del factor volumen económico
const IDEAS_PROSPECT_BASE_SCORE = 24;   // Base para clientes sin historial de pedidos
const IDEAS_RECENT_VISIT_COOL_DAYS = 12; // Días de enfriamiento tras visita registrada
const IDEAS_PLAN_STORAGE_KEY = 'app_ventas_ideas_plan_v2';

// Estado de la vista
let _ideasSelectedDays = 3;
let _ideasSelectedStops = 6;
let _ideasSelectedRegion = '';
let _ideasSelectedMode = 'priority'; // 'priority' | 'mixed' | 'nearby'
let _currentIdeasPlan = null;
let _currentIdeasAnalysis = null;
let _ideasUserCoords = null;

// ─── UTILIDADES DE FECHA Y TEXTO ───────────────────────────
function escapeIdeasHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normIdeasText(str) {
    if (!str) return '';
    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function formatRegionDisplayName(region) {
    const r = normIdeasText(region);
    if (r === 'ASTURIAS') return 'Asturias';
    if (r === 'CANTABRIA') return 'Cantabria';
    if (r === 'LEON') return 'León';
    if (r === 'GALICIA') return 'Galicia';
    return region ? String(region) : '';
}

function parseIdeasDate(val) {
    if (!val) return null;
    if (val instanceof Date) {
        if (Number.isNaN(val.getTime())) return null;
        const d = new Date(val.getFullYear(), val.getMonth(), val.getDate());
        return d;
    }
    const raw = String(val).trim();
    if (!raw) return null;

    // YYYY-MM-DD o ISO YYYY-MM-DDTHH...
    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
    }
    // DD/MM/YYYY
    const esMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (esMatch) {
        return new Date(parseInt(esMatch[3], 10), parseInt(esMatch[2], 10) - 1, parseInt(esMatch[1], 10));
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function getTodayLocalDate() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getTodayLocalISO() {
    const d = getTodayLocalDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

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

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasExactPlaceTerm(normalizedField, normalizedTerm) {
    if (!normalizedField || !normalizedTerm) return false;
    if (normalizedField === normalizedTerm) return true;
    const rx = new RegExp(`(^|[^A-Z0-9])${escapeRegExp(normalizedTerm)}([^A-Z0-9]|$)`);
    return rx.test(normalizedField);
}

// ─── FASE 1: APRENDIZAJE LONGITUDINAL DE TIMING ───────────
function buildBuyingEvents(sortedOrders) {
    // Agrupar ampliaciones realizadas en <= 2 días para que no distorsionen el ciclo real
    const events = [];
    sortedOrders.forEach(o => {
        const lastEv = events[events.length - 1];
        if (lastEv) {
            const diffDays = Math.round((o.date - lastEv.lastDate) / (1000 * 60 * 60 * 24));
            if (diffDays <= 2) {
                lastEv.amount += o.amount;
                lastEv.lastDate = o.date;
                lastEv.orderCount += 1;
                return;
            }
        }
        events.push({
            date: o.date,
            lastDate: o.date,
            amount: o.amount,
            orderCount: 1
        });
    });
    return events;
}

function computeMedian(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

function analyzeClientPatterns(clients, orders, visitNotes = []) {
    const today = getTodayLocalDate();
    const todayISO = getTodayLocalISO();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const lookup = dataManager.buildClientLookup(clients);

    // 1. Indexar pedidos por cliente
    const ordersByClientKey = {};
    (orders || []).forEach(o => {
        const matched = dataManager.resolveClientForOrder(o, lookup);
        const key = matched ? `code_${matched.code}` : `shop_${normalizeTextKey(o.shop)}`;
        if (!key) return;
        if (!ordersByClientKey[key]) ordersByClientKey[key] = [];
        ordersByClientKey[key].push(o);
    });

    // 2. Indexar notas de visita por cliente (alertas vencidas y última nota activa)
    const notesByCode = {};
    (visitNotes || []).forEach(n => {
        if (!n || !n.clientCode) return;
        const cKey = String(n.clientCode).trim();
        if (!notesByCode[cKey]) notesByCode[cKey] = [];
        notesByCode[cKey].push(n);
    });

    const patterns = [];

    (clients || []).forEach(client => {
        const codeKey = `code_${client.code}`;
        const nameKey = `shop_${normalizeTextKey(client.name)}`;
        const rawOrders = ordersByClientKey[codeKey] || ordersByClientKey[nameKey] || [];

        const parsedOrders = rawOrders
            .map(o => ({
                date: parseIdeasDate(o.dateISO || o.date),
                amount: parseFloat(o.amount) || 0,
                facturadoTodo: o.facturadoTodo || '',
                noTampo: o.noTampo || '',
                noTampoAmount: parseFloat(o.noTampoAmount) || 0
            }))
            .filter(o => o.date !== null)
            .sort((a, b) => a.date - b.date);

        // Pedidos actualmente pendientes de salir (Almacén o Falta Tampo)
        let pendingAlmacenCount = 0;
        let pendingTampoCount = 0;
        let pendingTampoAmount = 0;
        parsedOrders.forEach(o => {
            if (!o.facturadoTodo) {
                if (o.noTampo) {
                    pendingTampoCount++;
                    pendingTampoAmount += Math.max(0, o.amount - Math.max(0, o.noTampoAmount));
                } else {
                    pendingAlmacenCount++;
                }
            }
        });

        // Notas de visita asociadas al cliente
        const clientNotes = notesByCode[String(client.code || '').trim()] || [];
        const activeNotes = clientNotes.filter(n => !n.done);
        const dueAlertNote = activeNotes.find(n => n.alertDate && String(n.alertDate).trim() <= todayISO) || null;
        const latestActiveNote = activeNotes[0] || null;

        // Última visita registrada
        const lastVisitDate = parseIdeasDate(client.lastVisitDate);
        const daysSinceLastVisit = lastVisitDate
            ? Math.max(0, Math.floor((today - lastVisitDate) / (1000 * 60 * 60 * 24)))
            : null;

        const lat = parseFloat(client.lat);
        const lng = parseFloat(client.lng);
        const hasGPS = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;

        const pattern = {
            client,
            name: client.name || 'Sin nombre',
            code: client.code,
            province: client.province || '',
            location: client.location || '',
            address: client.address || '',
            lat: hasGPS ? lat : null,
            lng: hasGPS ? lng : null,
            hasGPS,
            orderCount: parsedOrders.length,
            eventCount: 0,
            avgFrequencyDays: null,
            daysSinceLastOrder: null,
            lastOrderDate: null,
            lastVisitDate,
            daysSinceLastVisit,
            seasonalMonths: [],
            confirmedSeasonalMonths: [],
            lastYearSameWindow: false,
            avgAmount: 0,
            totalAmount: 0,
            timingConfidence: 'aprendiendo', // 'estable' | 'media' | 'aprendiendo'
            cycleTrend: 'estable',           // 'acelera' | 'espacia' | 'estable'
            pendingAlmacenCount,
            pendingTampoCount,
            pendingTampoAmount,
            dueAlertNote,
            latestActiveNote,
            score: 0,
            reason: '',
            isProspect: parsedOrders.length === 0,
            recentlyVisited: false
        };

        if (parsedOrders.length === 0) {
            const visitPenalty = (daysSinceLastVisit !== null && daysSinceLastVisit < 21) ? 16 : 0;
            const alertBonus = dueAlertNote ? 22 : 0;
            pattern.score = Math.max(4, IDEAS_PROSPECT_BASE_SCORE + (hasGPS ? 4 : 0) - visitPenalty + alertBonus);
            pattern.recentlyVisited = daysSinceLastVisit !== null && daysSinceLastVisit < IDEAS_RECENT_VISIT_COOL_DAYS;
            if (dueAlertNote) {
                pattern.reason = `Recordatorio pendiente: ${dueAlertNote.note}`;
            } else if (daysSinceLastVisit !== null) {
                pattern.reason = `Prospección (última visita hace ${daysSinceLastVisit} días)`;
            } else {
                pattern.reason = 'Prospección — cliente sin pedidos todavía';
            }
            patterns.push(pattern);
            return;
        }

        // Eventos reales de compra (agrupando ampliaciones de <= 2 días)
        const events = buildBuyingEvents(parsedOrders);
        pattern.eventCount = events.length;

        const lastOrder = parsedOrders[parsedOrders.length - 1];
        pattern.lastOrderDate = lastOrder.date;
        pattern.daysSinceLastOrder = Math.max(0, Math.floor((today - lastOrder.date) / (1000 * 60 * 60 * 24)));

        // Importes sobre pedidos valorados (>0) si existen
        const valuedOrders = parsedOrders.filter(o => o.amount > 0);
        const amtSource = valuedOrders.length > 0 ? valuedOrders : parsedOrders;
        const totalAmt = amtSource.reduce((s, o) => s + o.amount, 0);
        pattern.totalAmount = totalAmt;
        pattern.avgAmount = amtSource.length > 0 ? totalAmt / amtSource.length : 0;

        // ─── APRENDIZAJE DEL CICLO REAL (MEDIANA + TENDENCIA RECIENTE) ───
        const gaps = [];
        for (let i = 1; i < events.length; i++) {
            const diffDays = Math.floor((events[i].date - events[i - 1].date) / (1000 * 60 * 60 * 24));
            if (diffDays >= 3) gaps.push(diffDays);
        }

        if (gaps.length >= 3) {
            const medianGap = computeMedian(gaps);
            // Media ponderada exponencial hacia los intervalos más recientes (se adapta con los años)
            let wSum = 0;
            let wTotal = 0;
            const decay = 0.72;
            gaps.forEach((g, idx) => {
                const weight = Math.pow(decay, gaps.length - 1 - idx);
                wSum += g * weight;
                wTotal += weight;
            });
            const weightedRecentGap = wTotal > 0 ? wSum / wTotal : medianGap;

            pattern.avgFrequencyDays = Math.max(10, Math.round((medianGap * 0.40) + (weightedRecentGap * 0.60)));

            // Calcular tendencia y estabilidad
            const recentTwoAvg = (gaps[gaps.length - 1] + gaps[gaps.length - 2]) / 2;
            if (recentTwoAvg < medianGap * 0.80) pattern.cycleTrend = 'acelera';
            else if (recentTwoAvg > medianGap * 1.25) pattern.cycleTrend = 'espacia';

            const avgAbsDev = gaps.reduce((s, g) => s + Math.abs(g - medianGap), 0) / gaps.length;
            const cv = medianGap > 0 ? avgAbsDev / medianGap : 1;
            pattern.timingConfidence = cv <= 0.35 ? 'estable' : 'media';
        } else if (gaps.length > 0) {
            pattern.avgFrequencyDays = Math.max(10, Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length));
            pattern.timingConfidence = gaps.length === 2 ? 'media' : 'aprendiendo';
        } else {
            // Un solo evento de compra: estimar un ciclo inicial prudente según tamaño del pedido
            pattern.avgFrequencyDays = pattern.avgAmount >= 600 ? 75 : 90;
            pattern.timingConfidence = 'aprendiendo';
        }

        // ─── APRENDIZAJE ESTACIONAL MULTI-AÑO (PONDERADO POR RECENCIA E IMPORTE) ───
        const monthWeights = Array(12).fill(0);
        const monthYears = Array.from({ length: 12 }, () => new Set());
        const baseTicket = Math.max(50, pattern.avgAmount || 200);

        events.forEach(ev => {
            const m = ev.date.getMonth();
            const y = ev.date.getFullYear();
            const yearsAgo = Math.max(0, currentYear - y);
            const recencyWeight = 1 / (1 + 0.25 * yearsAgo);
            const amtFactor = Math.min(2.2, Math.max(0.6, ev.amount / baseTicket));
            monthWeights[m] += recencyWeight * amtFactor;
            monthYears[m].add(y);
        });

        const maxMonthWeight = Math.max(...monthWeights);
        if (maxMonthWeight > 0) {
            const threshold = maxMonthWeight * 0.42;
            pattern.seasonalMonths = monthWeights
                .map((w, idx) => w >= threshold ? idx : -1)
                .filter(idx => idx >= 0);
            pattern.confirmedSeasonalMonths = monthYears
                .map((yrs, idx) => (yrs.size >= 2 && monthWeights[idx] >= threshold) ? idx : -1)
                .filter(idx => idx >= 0);
        }

        // Detectar si el año pasado pidió en esta misma ventana y este año aún no ha pedido recientemente
        const prevYear = currentYear - 1;
        const nextMonth = (currentMonth + 1) % 12;
        const orderedLastYearSameWindow = events.some(ev =>
            ev.date.getFullYear() === prevYear &&
            (ev.date.getMonth() === currentMonth || ev.date.getMonth() === nextMonth)
        );
        const orderedRecentlyThisCycle = pattern.daysSinceLastOrder <= Math.max(25, Math.round((pattern.avgFrequencyDays || 60) * 0.5));
        pattern.lastYearSameWindow = orderedLastYearSameWindow && !orderedRecentlyThisCycle;

        patterns.push(pattern);
    });

    return patterns;
}

// ─── FASE 2: PUNTUACIÓN INTELIGENTE ────────────────────────
function scoreClients(patterns) {
    const today = getTodayLocalDate();
    const currentMonth = today.getMonth();
    const nextMonth = (currentMonth + 1) % 12;

    const activeAmounts = patterns.filter(p => !p.isProspect && p.avgAmount > 0).map(p => p.avgAmount);
    const maxAmount = Math.max(100, ...activeAmounts);

    patterns.forEach(p => {
        if (p.isProspect) return;

        // 1. Urgencia sobre ciclo aprendido (0-100)
        let urgencyScore = 0;
        const cycle = p.avgFrequencyDays || 90;
        if (p.daysSinceLastOrder !== null) {
            const ratio = p.daysSinceLastOrder / cycle;
            // ratio = 1.0 (justo en su ciclo) -> ~62 pts de urgencia; ratio >= 1.6 -> 100 pts
            urgencyScore = Math.min(100, Math.round(ratio * 62));
        }

        // 2. Estacionalidad multi-año (0-100)
        let seasonScore = 0;
        if (p.confirmedSeasonalMonths.includes(currentMonth)) {
            seasonScore = 100;
        } else if (p.seasonalMonths.includes(currentMonth)) {
            seasonScore = 80;
        } else if (p.lastYearSameWindow) {
            seasonScore = 70;
        } else if (p.confirmedSeasonalMonths.includes(nextMonth) || p.seasonalMonths.includes(nextMonth)) {
            seasonScore = 38;
        }

        // 3. Volumen económico relativo (0-100)
        const volumeScore = Math.min(100, (p.avgAmount / maxAmount) * 100);

        let rawScore = Math.round(
            (IDEAS_WEIGHT_URGENCY * urgencyScore) +
            (IDEAS_WEIGHT_SEASON * seasonScore) +
            (IDEAS_WEIGHT_VOLUME * volumeScore)
        );

        // Bonus si hay alerta/recordatorio vencido en Notas de Visita
        if (p.dueAlertNote) {
            rawScore = Math.min(100, rawScore + 25);
        }

        // Enfriamiento por compra reciente
        const minDaysWindow = Math.max(14, Math.round(cycle * 0.45));
        const isRecentOrder = p.daysSinceLastOrder !== null && p.daysSinceLastOrder < minDaysWindow;

        // Enfriamiento por visita reciente sin pedido (solo si visitaste después de su último pedido)
        const visitedAfterLastOrder = p.lastVisitDate && (!p.lastOrderDate || p.lastVisitDate >= p.lastOrderDate);
        const isRecentVisit = visitedAfterLastOrder &&
            p.daysSinceLastVisit !== null &&
            p.daysSinceLastVisit < IDEAS_RECENT_VISIT_COOL_DAYS &&
            !p.dueAlertNote;

        p.recentlyVisited = isRecentVisit;

        if (isRecentOrder) {
            rawScore = Math.max(1, Math.round(rawScore * 0.05));
        } else if (isRecentVisit) {
            rawScore = Math.max(4, Math.round(rawScore * 0.14));
        }

        p.score = Math.min(100, Math.max(1, rawScore));

        // 4. Explicación legible de por qué aparece
        const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

        if (p.dueAlertNote) {
            p.reason = `Recordatorio: ${p.dueAlertNote.note}`;
        } else if (isRecentOrder) {
            p.reason = `Pedido muy reciente (hace ${p.daysSinceLastOrder} días)`;
        } else if (isRecentVisit) {
            p.reason = `Visitado hace ${p.daysSinceLastVisit} días — en espera`;
        } else if (p.daysSinceLastOrder > cycle) {
            const overdue = p.daysSinceLastOrder - cycle;
            p.reason = `Supera su ciclo (~${cycle}d) en ${overdue} días`;
        } else if (p.confirmedSeasonalMonths.includes(currentMonth)) {
            p.reason = `Patrón habitual en ${monthNames[currentMonth]} (varios años)`;
        } else if (p.lastYearSameWindow) {
            p.reason = `El año pasado pidió por estas fechas`;
        } else if (p.seasonalMonths.includes(currentMonth)) {
            p.reason = `Suele pedir en ${monthNames[currentMonth]}`;
        } else if (p.daysSinceLastOrder >= Math.round(cycle * 0.8)) {
            p.reason = `En ventana de reposición (cada ~${cycle}d)`;
        } else if (p.avgAmount >= maxAmount * 0.65) {
            p.reason = 'Cliente de alto valor — seguimiento';
        } else {
            p.reason = `Sin actividad desde hace ${p.daysSinceLastOrder} días`;
        }
    });

    return patterns;
}

// ─── ZONAS COMERCIALES DELIMITADAS (RUTAS DE 1 DÍA) ──────────
const COMMERCIAL_ZONES_ASTURIAS = [
    {
        id: 'EO_NAVIA',
        region: 'ASTURIAS',
        name: 'Occidente / Eo-Navia',
        towns: ['CASTROPOL', 'VEGADEO', 'TAPIA DE CASARIEGO', 'TAPIA', 'LA CARIDAD', 'EL FRANCO', 'SAN TIRSO DE ABRES', 'TARAMUNDI', 'VIAVELEZ', 'LA MURIA', 'BARRES', 'ARANTE', 'CEDOFEITA', 'VIXANDE']
    },
    {
        id: 'NOROCCIDENTE',
        region: 'ASTURIAS',
        name: 'Noroccidente (Navia - Luarca - Pravia - Tineo)',
        towns: ['NAVIA', 'LUARCA', 'VALDES', 'CADAVEDO', 'CUDILLERO', 'OVINANA', 'SOTO DE LUINA', 'TREVIAS', 'PRAVIA', 'SOTO DEL BARCO', 'MUROS DE NALON', 'SALAS', 'TINEO', 'GRADO', 'ORTIGUERA', 'PUERTO DE VEGA', 'VILLAPEDRE', 'CARCEDO', 'LA ESPINA', 'CORNELLANA', 'SANTIAGO DEL MONTE', 'AGONES', 'SAN ESTEBAN', 'ANLEO', 'JARRIO', 'ARCADINA', 'AYONES', 'ARISTEBANO']
    },
    {
        id: 'AVILES_GOZON',
        region: 'ASTURIAS',
        name: 'Comarca de Avilés y Gozón',
        towns: ['AVILES', 'SALINAS', 'PIEDRAS BLANCAS', 'CASTRILLON', 'LUANCO', 'CANDAS', 'GOZON', 'TRASONA', 'CORVERA', 'CORVERA DE ASTURIAS', 'TAMON', 'SAN JUAN DE NIEVA', 'MONIELLO', 'BOCINES', 'PERLORA', 'NUBLEDO', 'ILLAS']
    },
    {
        id: 'GIJON',
        region: 'ASTURIAS',
        name: 'Gijón y Alrededores',
        towns: ['GIJON', 'SOMIO', 'VERINA', 'NUEVO ROCES', 'CIMADEVILLA', 'ROCES', 'TREMANES', 'CABUENES', 'PORCEYO']
    },
    {
        id: 'ORIENTE_COSTA',
        region: 'ASTURIAS',
        name: 'Oriente Costero (Villaviciosa - Llanes)',
        towns: ['VILLAVICIOSA', 'LASTRES', 'COLUNGA', 'CARAVIA', 'RIBADESELLA', 'NUEVA', 'POSADA DE LLANES', 'POSADA', 'LLANES', 'PRIA', 'CUEVAS', 'OLES', 'SELORIO', 'LUE', 'HONTORIA', 'CELORIO', 'POO', 'LA HUERTONA', 'NOCEDO', 'CUERRES', 'ILLAMES DE PRIA', 'AMANDI', 'ANAYO', 'LA GALGUERA', 'LLAMIGO']
    },
    {
        id: 'ORIENTE_INTERIOR',
        region: 'ASTURIAS',
        name: 'Oriente Interior (Arriondas - Cangas de Onís - Cabrales)',
        towns: ['ARRIONDAS', 'CANGAS DE ONIS', 'COVADONGA', 'BENIA DE ONIS', 'CARRENA', 'LAS ARENAS', 'ARENAS DE CABRALES', 'CABRALES', 'ABAMIA', 'LLANO DE CON', 'GAMONEDO', 'TORNIN', 'PARRES', 'ONIS']
    },
    {
        id: 'OVIEDO',
        region: 'ASTURIAS',
        name: 'Oviedo y Área Metropolitana',
        towns: ['OVIEDO', 'LUGONES', 'COLLOTO', 'SAN CLAUDIO', 'PIEDRAMUELLE', 'EL CRISTO', 'OLLONIEGO', 'LATORES', 'TRUBIA']
    },
    {
        id: 'SIERO_CUENCAS',
        region: 'ASTURIAS',
        name: 'Siero y Cuencas Mineras (Siero - Langreo - Mieres)',
        towns: ['POLA DE SIERO', 'SIERO', 'NORENA', 'EL BERRON', 'BERRON', 'LA SECADA', 'CARBAYIN', 'CARBAYIN ALTO', 'LANGREO', 'SAMA DE LANGREO', 'EL ENTREGO', 'SAN MARTIN DEL REY AURELIO', 'POLA DE LAVIANA', 'LAVIANA', 'MIERES', 'UJO', 'CUNA', 'POLA DE LENA', 'LENA', 'MOREDA', 'ALLER', 'CABANAQUINTA', 'PELUGANO']
    }
];

const COMMERCIAL_ZONES_CANTABRIA = [
    {
        id: 'CANTABRIA_LIEBANA',
        region: 'CANTABRIA',
        name: 'Liébana y Peñarrubia (Panes - Potes)',
        towns: ['PANES', 'LA HERMIDA', 'LEBENA', 'SAN PEDRO DE BEDOYA', 'POTES', 'PORCIEDA', 'PENARRUBIA', 'CILLORIGO', 'VEGA DE LIEBANA', 'CAMALENO', 'PESAGUERO', 'CABEZON DE LIEBANA']
    },
    {
        id: 'CANTABRIA_WEST_COAST',
        region: 'CANTABRIA',
        name: 'Costa Occidental (San Vicente - Comillas - Cabezón)',
        towns: ['SAN VICENTE DE LA BARQUERA', 'SAN VICENTE', 'COMILLAS', 'SIERRAPANDO', 'TRECENO', 'CABEZON DE LA SAL', 'VALDALIGA', 'RUILOBA', 'UDIAS']
    },
    {
        id: 'CANTABRIA_BESAYA',
        region: 'CANTABRIA',
        name: 'Besaya y Costa Central (Torrelavega - Suances)',
        towns: ['TORRELAVEGA', 'SUANCES', 'SANTILLANA DEL MAR', 'SANTILLANA', 'POLANCO', 'MIENGO', 'REOCIN', 'CARTES', 'PUENTE SAN MIGUEL', 'BARCENA DE CICERO', 'CUCHIA']
    },
    {
        id: 'CANTABRIA_SANTANDER',
        region: 'CANTABRIA',
        name: 'Santander y Área Metropolitana',
        towns: ['SANTANDER', 'CUETO', 'SOTO DE LA MARINA', 'SANTA CRUZ DE BEZANA', 'BEZANA', 'CAMARGO', 'MALIANO', 'ASTILLERO', 'EL ASTILLERO', 'LIANO', 'MURIEDAS', 'PENACASTILLO', 'MONTE', 'SAN ROMAN']
    },
    {
        id: 'CANTABRIA_EAST_COAST',
        region: 'CANTABRIA',
        name: 'Costa Oriental (Laredo - Santoña - Castro)',
        towns: ['SOMO', 'GALIZANO', 'LANGRE', 'BAREYO', 'ISLA', 'ARNUERO', 'NOJA', 'ARGONOS', 'SANTONA', 'LAREDO', 'COLINDRES', 'ISLARES', 'CERDIGO', 'CASTRO-URDIALES', 'CASTRO URDIALES', 'SAMANO', 'LUSA', 'EL PONTARRON', 'GURIEZO', 'HAZAS DE CESTO', 'HOZNAYO', 'RIOSECO']
    },
    {
        id: 'CANTABRIA_INTERIOR_PAS_ASON',
        region: 'CANTABRIA',
        name: 'Interior Pas-Asón (Sarón - Solares - Ramales)',
        towns: ['VARGAS', 'RENEDO DE PIELAGOS', 'RENEDO', 'ZURITA', 'PIELAGOS', 'SARON', 'SOLARES', 'LIERGANES', 'CABARCENO', 'BARRIO DE ARRIBA', 'ENTRAMBASAGUAS', 'HORNEDO', 'SOLORZANO', 'NATES', 'LIMPIAS', 'AMPUERO', 'SAN PANTALEON DE ARAS', 'RAMALES DE LA VICTORIA', 'RAMALES', 'ALISAS', 'ARREDONDO', 'PUENTE VIESGO', 'VILLAFUFRE', 'VEGA DE VILLAFUFRE']
    },
    {
        id: 'CANTABRIA_CAMPOO_SAJA',
        region: 'CANTABRIA',
        name: 'Campoo y Saja-Nansa (Reinosa - Molledo)',
        towns: ['REINOSA', 'MATAMOROSA', 'FONTIBRE', 'SALCES', 'ESPINILLA', 'ARGUESO', 'ORMAS', 'ABIADA', 'BRANAVIEJA', 'TUDANCA', 'HELGUERA', 'EL TOJO', 'LOS TOJOS', 'SAJA', 'BARCENA MAYOR', 'MOLLEDO', 'SILIO', 'BARCENA DE PIE DE CONCHA', 'MONTABLIZ', 'SANTIURDE DE REINOSA', 'SANTIURDE', 'LANTUENO', 'BOLMIR', 'RETORTILLO', 'ARROYO', 'LAS ROZAS', 'CAMPOO', 'ALTO CAMPOO']
    }
];

const COMMERCIAL_ZONES_LEON = [
    {
        id: 'LEON_CENTRO_ORBIGO',
        region: 'LEON',
        name: 'León, Órbigo y Astorga',
        towns: ['LEON', 'LA VIRGEN DEL CAMINO', 'VILLADANGOS DEL PARAMO', 'VILLADANGOS', 'CARRIZO DE LA RIBERA', 'CARRIZO', 'ARMELLADA', 'BENAVIDES DE ORBIGO', 'BENAVIDES', 'HOSPITAL DE ORBIGO', 'VEGUELLINA DE ORBIGO', 'VEGUELLINA', 'ASTORGA', 'CARNEROS', 'RIEGO DE LA VEGA', 'VALDEVIMBRE', 'BERCIANOS DEL PARAMO', 'SAN JUSTO DE LA VEGA', 'SANTA MARIA DEL PARAMO', 'PONFERRADA']
    },
    {
        id: 'LEON_ESTE_CAMPOS',
        region: 'LEON',
        name: 'Tierra de Campos y León Este (Sahagún - Carrión)',
        towns: ['PUENTE VILLARENTE', 'MANSILLA DE LAS MULAS', 'MANSILLA', 'RELIEGOS', 'EL BURGO RANERO', 'SAHAGUN', 'CEA', 'GRAJAL DE CAMPOS', 'LEDIGOS', 'SALDANA', 'CARRION DE LOS CONDES', 'VILLAMARTIN DE DON SANCHO', 'POZA DE LA VEGA', 'BARRIOS DE LA VEGA', 'SANTERVAS DE LA VEGA', 'PEDROSA DE LA VEGA', 'BUSTILLO DE LA VEGA', 'VILLAMORONTA', 'CALZADILLA DE LA CUEZA', 'CALZADA DEL COTO', 'BERCIANOS DEL REAL CAMINO', 'VALDESCAPA DE CEA', 'VILLAMUNIO', 'JOARILLA DE LAS MATAS', 'MELGAR DE ARRIBA']
    }
];

const COMMERCIAL_ZONES_GALICIA = [
    {
        id: 'GALICIA_LUGO_MARINA',
        region: 'GALICIA',
        name: 'Galicia Norte (Mariña Lucense - Lugo)',
        towns: ['RIBADEO', 'RINLO', 'TRABADA', 'A PONTENOVA', 'VIVEIRO', 'CILLERO', 'JOVE', 'XOVE', 'SAN CIPRIAN', 'BURELA', 'CANGAS DE FOZ', 'FAZOURO', 'FOZ', 'SAN COSME', 'O VALADOURO', 'VALADOURO', 'LORENZANA', 'LOURENZA', 'GONTAN', 'BRETONA', 'PASTORIZA', 'A PASTORIZA', 'MUIMENTA', 'COSPEITO', 'FEIRA DO MONTE', 'CASTRO DE REY', 'CASTRO DE REI', 'MEIRA', 'RIBEIRAS DE LEA', 'MOSTEIRO', 'RABADE', 'OUTERO DE REI', 'SILVARREI', 'DAS GANDARAS', 'LUGO']
    }
];

const COMMERCIAL_ZONES_PREDEFINED = [
    ...COMMERCIAL_ZONES_ASTURIAS,
    ...COMMERCIAL_ZONES_CANTABRIA,
    ...COMMERCIAL_ZONES_LEON,
    ...COMMERCIAL_ZONES_GALICIA
];

function getCommercialZoneForClient(client, preferredRegion = '') {
    const loc = normIdeasText(client.location);
    const addr = normIdeasText(client.address);
    const prefReg = normIdeasText(preferredRegion);

    // Evaluar primero zonas de la región elegida (si la hay) para evitar conflictos fronterizos
    const orderedZones = prefReg
        ? [...COMMERCIAL_ZONES_PREDEFINED].sort((a, b) => (a.region === prefReg ? -1 : 1) - (b.region === prefReg ? -1 : 1))
        : COMMERCIAL_ZONES_PREDEFINED;

    // 1. Priorizar siempre la población/localidad exacta
    if (loc) {
        for (const zone of orderedZones) {
            for (const term of zone.towns) {
                if (hasExactPlaceTerm(loc, term)) {
                    return zone;
                }
            }
        }
    }

    // 2. Respaldo en dirección solo si no coincidió por localidad
    if (addr) {
        for (const zone of orderedZones) {
            for (const term of zone.towns) {
                if (term.length >= 4 && hasExactPlaceTerm(addr, term)) {
                    return zone;
                }
            }
        }
    }

    return null;
}

function matchesRegion(provinceStr, locationStr, regionTarget) {
    if (!regionTarget) return true;
    const target = normIdeasText(regionTarget);
    const prov = normIdeasText(provinceStr);
    const loc = normIdeasText(locationStr);

    if (target === 'ASTURIAS') {
        return prov.includes('ASTUR') || hasExactPlaceTerm(loc, 'OVIEDO') || hasExactPlaceTerm(loc, 'GIJON') ||
            hasExactPlaceTerm(loc, 'AVILES') || hasExactPlaceTerm(loc, 'VEGADEO') || hasExactPlaceTerm(loc, 'CASTROPOL') ||
            hasExactPlaceTerm(loc, 'TAPIA') || hasExactPlaceTerm(loc, 'LLANES') || hasExactPlaceTerm(loc, 'MIERES');
    }
    if (target === 'CANTABRIA') {
        return prov.includes('CANTABR') || hasExactPlaceTerm(loc, 'SANTANDER') ||
            hasExactPlaceTerm(loc, 'TORRELAVEGA') || hasExactPlaceTerm(loc, 'PANES') || hasExactPlaceTerm(loc, 'LAREDO');
    }
    if (target === 'LEON') {
        return prov.includes('LEON') || prov.includes('PALENC') ||
            hasExactPlaceTerm(loc, 'PONFERRADA') || hasExactPlaceTerm(loc, 'ASTORGA');
    }
    if (target === 'GALICIA') {
        return prov.includes('GALIC') || prov.includes('LUGO') || prov.includes('CORUN') ||
            prov.includes('OURENS') || prov.includes('PONTEVEDR') ||
            hasExactPlaceTerm(loc, 'SANTIAGO') || hasExactPlaceTerm(loc, 'VIGO') ||
            hasExactPlaceTerm(loc, 'RIBADEO') || hasExactPlaceTerm(loc, 'FOZ') ||
            hasExactPlaceTerm(loc, 'VIVEIRO') || hasExactPlaceTerm(loc, 'BURELA') ||
            hasExactPlaceTerm(loc, 'RINLO') || hasExactPlaceTerm(loc, 'SAN COSME') ||
            hasExactPlaceTerm(loc, 'LOURENZA') || hasExactPlaceTerm(loc, 'LUGO');
    }
    return prov.includes(target) || loc.includes(target);
}

// ─── FASE 3: CLUSTERING Y ORDENACIÓN GEOGRÁFICA ───────────
function orderStopsByProximity(clients, startCoords = null) {
    if (!clients || clients.length <= 2) return [...(clients || [])];

    const withGps = clients.filter(c => c.hasGPS);
    const withoutGps = clients.filter(c => !c.hasGPS);
    if (withGps.length <= 1) return [...clients];

    const remaining = [...withGps];
    const ordered = [];

    // Elegir punto de partida: el más cercano a tu GPS actual, o el de mayor prioridad
    let currentLat, currentLng;
    if (startCoords && !isNaN(startCoords.lat) && !isNaN(startCoords.lng)) {
        let bestIdx = 0;
        let bestDist = Infinity;
        remaining.forEach((c, idx) => {
            const d = haversineKm(startCoords.lat, startCoords.lng, c.lat, c.lng);
            if (d < bestDist) {
                bestDist = d;
                bestIdx = idx;
            }
        });
        const first = remaining.splice(bestIdx, 1)[0];
        ordered.push(first);
        currentLat = first.lat;
        currentLng = first.lng;
    } else {
        remaining.sort((a, b) => b.score - a.score);
        const first = remaining.shift();
        ordered.push(first);
        currentLat = first.lat;
        currentLng = first.lng;
    }

    // Vecino más cercano iterativo para minimizar kilómetros
    while (remaining.length > 0) {
        let nearestIdx = 0;
        let nearestDist = Infinity;
        remaining.forEach((c, idx) => {
            const d = haversineKm(currentLat, currentLng, c.lat, c.lng);
            if (d < nearestDist) {
                nearestDist = d;
                nearestIdx = idx;
            }
        });
        const nextStop = remaining.splice(nearestIdx, 1)[0];
        ordered.push(nextStop);
        currentLat = nextStop.lat;
        currentLng = nextStop.lng;
    }

    return [...ordered, ...withoutGps];
}

function clusterByProximity(scoredClients, maxDistKm, preferredRegion = '') {
    const clusters = [];
    const assigned = new Set();

    // 1. Zonas Comerciales Predefinidas
    const zoneMap = new Map();
    scoredClients.forEach(c => {
        const zone = getCommercialZoneForClient(c, preferredRegion);
        if (zone) {
            if (!zoneMap.has(zone.id)) {
                zoneMap.set(zone.id, { zone, clients: [] });
            }
            zoneMap.get(zone.id).clients.push(c);
        }
    });

    for (const { zone, clients } of zoneMap.values()) {
        clients.sort((a, b) => b.score - a.score);
        clients.forEach(c => assigned.add(c.code));
        const locations = [...new Set(clients.map(c => (c.location || '').trim()).filter(Boolean))];
        clusters.push({
            id: zone.id,
            seed: clients[0],
            clients,
            label: zone.name,
            sublabel: locations.slice(0, 4).join(', '),
            totalScore: clients.reduce((s, c) => s + c.score, 0)
        });
    }

    // 2. Clustering por GPS (10 km) para clientes fuera de zonas fijas
    const unassignedGPS = scoredClients.filter(c => !assigned.has(c.code) && c.hasGPS);
    unassignedGPS.sort((a, b) => b.score - a.score);

    unassignedGPS.forEach(seedClient => {
        if (assigned.has(seedClient.code)) return;

        const seedLat = seedClient.lat;
        const seedLng = seedClient.lng;
        const seedLoc = normIdeasText(seedClient.location);

        const clusterClients = [seedClient];
        assigned.add(seedClient.code);

        unassignedGPS.forEach(other => {
            if (assigned.has(other.code)) return;
            const otherLoc = normIdeasText(other.location);
            const sameLocation = seedLoc && otherLoc && seedLoc === otherLoc;
            const dist = haversineKm(seedLat, seedLng, other.lat, other.lng);

            if (sameLocation || dist <= maxDistKm) {
                clusterClients.push(other);
                assigned.add(other.code);
            }
        });

        const locations = [...new Set(clusterClients.map(c => (c.location || '').trim()).filter(Boolean))];
        const primaryLoc = locations[0] || seedClient.province || 'Zona';

        clusters.push({
            id: `gps_${seedClient.code}`,
            seed: seedClient,
            clients: clusterClients,
            label: primaryLoc,
            sublabel: locations.length > 1 ? locations.slice(1).join(', ') : (seedClient.province || ''),
            totalScore: clusterClients.reduce((s, c) => s + c.score, 0)
        });
    });

    // 3. Resto por localidad normalizada
    const remaining = scoredClients.filter(c => !assigned.has(c.code));
    if (remaining.length > 0) {
        const byLoc = {};
        remaining.forEach(c => {
            const loc = (c.location || c.province || 'Sin Ubicación').trim();
            const key = normIdeasText(loc);
            if (!byLoc[key]) byLoc[key] = { name: loc, clients: [] };
            byLoc[key].clients.push(c);
        });

        Object.values(byLoc).forEach(group => {
            group.clients.sort((a, b) => b.score - a.score);
            group.clients.forEach(c => assigned.add(c.code));
            clusters.push({
                id: `loc_${normIdeasText(group.name)}`,
                seed: group.clients[0],
                clients: group.clients,
                label: group.name,
                sublabel: '',
                totalScore: group.clients.reduce((s, c) => s + c.score, 0)
            });
        });
    }

    clusters.sort((a, b) => b.totalScore - a.totalScore);
    return clusters;
}

// ─── FASE 4: PLAN DIARIO (CON RESERVA Y PROSPECCIÓN DE PASO) ─
function generateVisitPlan(clusters, numDays, stopsPerDay, mode = 'priority', allPatterns = [], preferredRegion = '') {
    const plan = [];

    // Pre-indexar prospectos válidos por zona si estamos en modo 'mixed'
    const prospectsByZone = new Map();
    if (mode === 'mixed' && allPatterns.length > 0) {
        const prospects = allPatterns.filter(p =>
            p.isProspect &&
            !p.recentlyVisited &&
            (!preferredRegion || matchesRegion(p.province, p.location, preferredRegion))
        ).sort((a, b) => b.score - a.score);

        prospects.forEach(p => {
            const z = getCommercialZoneForClient(p, preferredRegion);
            const key = z ? z.id : `loc_${normIdeasText(p.location || p.province)}`;
            if (!prospectsByZone.has(key)) prospectsByZone.set(key, []);
            prospectsByZone.get(key).push(p);
        });
    }

    for (let day = 0; day < numDays && day < clusters.length; day++) {
        const cluster = clusters[day];
        const sortedClusterClients = [...cluster.clients].sort((a, b) => b.score - a.score);

        let selectedClients = [];
        let reserveClients = [];

        if (mode === 'mixed') {
            // Reservar hasta 1-2 huecos para prospección en la misma zona si existen prospectos
            const zoneProspects = prospectsByZone.get(cluster.id) || [];
            const maxProspects = stopsPerDay >= 6 ? 2 : 1;
            const chosenProspects = zoneProspects.slice(0, maxProspects);
            const activeSlots = Math.max(1, stopsPerDay - chosenProspects.length);
            const activeSelected = sortedClusterClients.slice(0, activeSlots);

            selectedClients = [...activeSelected, ...chosenProspects];
            const usedCodes = new Set(selectedClients.map(c => String(c.code)));
            reserveClients = [
                ...sortedClusterClients.filter(c => !usedCodes.has(String(c.code))),
                ...zoneProspects.slice(maxProspects)
            ];
        } else {
            selectedClients = sortedClusterClients.slice(0, stopsPerDay);
            reserveClients = sortedClusterClients.slice(stopsPerDay);
        }

        // Ordenar geográficamente las paradas del día para optimizar el trayecto
        const orderedClients = orderStopsByProximity(selectedClients);
        const locNames = [...new Set(orderedClients.map(c => (c.location || '').trim()).filter(Boolean))];
        const potentialAmount = orderedClients.reduce((sum, c) => sum + (c.avgAmount || 0), 0);

        plan.push({
            dayNumber: day + 1,
            zone: cluster.label || locNames[0] || 'Zona',
            subzone: locNames.length > 0 ? locNames.join(' · ') : (cluster.sublabel || ''),
            clients: orderedClients,
            reserveClients,
            potentialAmount,
            totalClients: orderedClients.length + reserveClients.length
        });
    }

    return plan;
}

// ─── PERSISTENCIA DEL ÚLTIMO PLAN DEL DÍA ──────────────────
function saveIdeasPlanState(plan, meta) {
    try {
        // Guardar versión ligera sin objetos pesados redundantes
        const compactPlan = (plan || []).map(day => ({
            dayNumber: day.dayNumber,
            zone: day.zone,
            subzone: day.subzone,
            potentialAmount: day.potentialAmount,
            totalClients: day.totalClients,
            clientCodes: day.clients.map(c => String(c.code)),
            reserveCodes: (day.reserveClients || []).map(c => String(c.code)),
            visitedCodes: day.clients.filter(c => c.visitedToday).map(c => String(c.code)),
            distancesByCode: Object.fromEntries(
                day.clients.filter(c => c.distanceKm !== undefined).map(c => [String(c.code), c.distanceKm])
            )
        }));
        sessionStorage.setItem(IDEAS_PLAN_STORAGE_KEY, JSON.stringify({
            dateISO: getTodayLocalISO(),
            meta,
            plan: compactPlan
        }));
    } catch (e) {
        console.warn('No se pudo guardar estado temporal de Ideas:', e);
    }
}

function loadSavedIdeasPlanState() {
    try {
        const raw = sessionStorage.getItem(IDEAS_PLAN_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.dateISO !== getTodayLocalISO()) {
            sessionStorage.removeItem(IDEAS_PLAN_STORAGE_KEY);
            return null;
        }
        return parsed;
    } catch (e) {
        return null;
    }
}

function clearSavedIdeasPlanState() {
    try {
        sessionStorage.removeItem(IDEAS_PLAN_STORAGE_KEY);
    } catch (e) {}
}

// ─── ANÁLISIS COMPLETO Y RADAR REGIONAL ────────────────────
async function runIdeasAnalysis() {
    const [clients, orders, visitNotes] = await Promise.all([
        dataManager.getClients(),
        dataManager.getOrders(),
        typeof dataManager.getVisitNotes === 'function' ? dataManager.getVisitNotes() : Promise.resolve([])
    ]);
    const patterns = analyzeClientPatterns(clients, orders, visitNotes);
    const scored = scoreClients(patterns);
    _currentIdeasAnalysis = scored;
    return scored;
}

function buildRegionRadarStats(scoredPatterns) {
    const regions = [
        { key: 'ASTURIAS', label: 'Asturias' },
        { key: 'CANTABRIA', label: 'Cantabria' },
        { key: 'LEÓN', label: 'León' },
        { key: 'GALICIA', label: 'Galicia' }
    ];

    return regions.map(r => {
        const items = scoredPatterns.filter(p =>
            !p.isProspect &&
            p.score >= IDEAS_MIN_PRIORITY_SCORE &&
            matchesRegion(p.province, p.location, r.key)
        );
        const urgentCount = items.filter(p => p.score >= 60).length;
        const potential = items.reduce((s, p) => s + (p.avgAmount || 0), 0);
        return {
            key: r.key,
            label: r.label,
            total: items.length,
            urgentCount,
            potential: Math.round(potential)
        };
    });
}

// ─── RENDERIZADO PRINCIPAL DE LA VISTA ─────────────────────
async function renderIdeas(isBack = false) {
    if (typeof updateHistoryState === 'function') updateHistoryState('ideas', isBack);
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Ideas de Visita');

    const saved = loadSavedIdeasPlanState();
    if (saved && saved.meta) {
        _ideasSelectedDays = saved.meta.days || _ideasSelectedDays;
        _ideasSelectedStops = saved.meta.stops || _ideasSelectedStops;
        _ideasSelectedRegion = saved.meta.region !== undefined ? saved.meta.region : _ideasSelectedRegion;
        _ideasSelectedMode = saved.meta.mode || _ideasSelectedMode;
    }

    let contentHtml = `<main class="ideas-wrapper">
        <div id="ideasRadarStrip" class="ideas-radar-section">
            <div class="ideas-radar-head">
                <span class="ideas-radar-title">
                    <span class="material-icons-round">radar</span>
                    <span>Radar de Oportunidades Hoy</span>
                </span>
                <span class="ideas-radar-hint">Toca una zona</span>
            </div>
            <div class="ideas-radar-grid" id="ideasRadarGrid">
                <div class="ideas-radar-skeleton">Analizando cartera...</div>
            </div>
        </div>

        <div class="ideas-selector-card">
            <div class="ideas-selector-header">
                <div class="ideas-header-icon-box">
                    <span class="material-icons-round">psychology</span>
                </div>
                <div>
                    <p class="ideas-selector-title">Planificador Inteligente</p>
                    <p class="ideas-selector-subtitle">Aprende el ciclo real, estacionalidad y visitas de cada cliente para sugerir tu mejor ruta</p>
                </div>
            </div>

            <!-- Modo de Ruta -->
            <p class="ideas-selector-label">Tipo de ruta:</p>
            <div class="ideas-mode-grid" id="ideasModeSelector">
                <button type="button" class="ideas-mode-chip ${_ideasSelectedMode === 'priority' ? 'active' : ''}" data-mode="priority" onclick="selectIdeasMode('priority')">
                    <span class="material-icons-round">bolt</span>
                    <span>Prioritarios</span>
                </button>
                <button type="button" class="ideas-mode-chip ${_ideasSelectedMode === 'mixed' ? 'active' : ''}" data-mode="mixed" onclick="selectIdeasMode('mixed')">
                    <span class="material-icons-round">person_add_alt</span>
                    <span>Mixto + Prosp.</span>
                </button>
                <button type="button" class="ideas-mode-chip ${_ideasSelectedMode === 'nearby' ? 'active' : ''}" data-mode="nearby" onclick="selectIdeasMode('nearby')">
                    <span class="material-icons-round">my_location</span>
                    <span>Cerca de mí</span>
                </button>
            </div>

            <!-- Selector de Región (oculto en modo Cerca de mí) -->
            <div id="ideasRegionBlock" ${(_ideasSelectedMode === 'nearby') ? 'hidden' : ''}>
                <p class="ideas-selector-label">Comunidad / Región:</p>
                <div class="ideas-region-layout" id="ideasRegionSelector">
                    <button type="button" class="ideas-region-chip ideas-region-all ${_ideasSelectedRegion === '' ? 'active' : ''}" data-region="" onclick="selectIdeasRegion('')">Todas las regiones</button>
                    <div class="ideas-region-grid">
                        <button type="button" class="ideas-region-chip ${_ideasSelectedRegion === 'ASTURIAS' ? 'active' : ''}" data-region="ASTURIAS" onclick="selectIdeasRegion('ASTURIAS')">Asturias</button>
                        <button type="button" class="ideas-region-chip ${_ideasSelectedRegion === 'CANTABRIA' ? 'active' : ''}" data-region="CANTABRIA" onclick="selectIdeasRegion('CANTABRIA')">Cantabria</button>
                        <button type="button" class="ideas-region-chip ${_ideasSelectedRegion === 'LEÓN' ? 'active' : ''}" data-region="LEÓN" onclick="selectIdeasRegion('LEÓN')">León</button>
                        <button type="button" class="ideas-region-chip ${_ideasSelectedRegion === 'GALICIA' ? 'active' : ''}" data-region="GALICIA" onclick="selectIdeasRegion('GALICIA')">Galicia</button>
                    </div>
                </div>

                <!-- Días y Paradas por día -->
                <div class="ideas-numbers-row">
                    <div class="ideas-num-col">
                        <p class="ideas-selector-label">Días:</p>
                        <div class="ideas-day-buttons" id="ideasDaySelector">
                            ${[1, 2, 3, 4, 5].map(n => `
                                <button type="button" class="ideas-day-btn ${n === _ideasSelectedDays ? 'active' : ''}" onclick="selectIdeasDays(${n})">${n}</button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="ideas-num-col ideas-stops-col">
                        <p class="ideas-selector-label">Paradas/día:</p>
                        <div class="ideas-day-buttons" id="ideasStopsSelector">
                            ${[4, 6, 8].map(s => `
                                <button type="button" class="ideas-day-btn ${s === _ideasSelectedStops ? 'active' : ''}" onclick="selectIdeasStops(${s})">${s}</button>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>

            <button type="button" class="ideas-generate-btn" onclick="generateIdeasPlan()">
                <span class="material-icons-round">auto_awesome</span>
                <span id="ideasGenerateBtnLabel">${_ideasSelectedMode === 'nearby' ? 'Buscar Clientes Cerca de Mí' : 'Generar Plan de Visitas'}</span>
            </button>

            <div class="ideas-legend-box">
                <span class="ideas-legend-title">Prioridad basada en ciclo aprendido, campaña y visitas</span>
                <div class="ideas-legend-items">
                    <span class="ideas-legend-item"><span class="ideas-legend-dot" style="background:#ef4444;"></span> <strong>≥ 60</strong> Alta (Atrasado)</span>
                    <span class="ideas-legend-item"><span class="ideas-legend-dot" style="background:#f59e0b;"></span> <strong>40–59</strong> En ventana</span>
                </div>
            </div>
        </div>
        <div id="ideasResultContainer"></div>
    </main>`;

    contentHtml += renderBottomNav(null);
    app.innerHTML = headerHtml + contentHtml;
    if (window.restoreScroll) window.restoreScroll();

    // Calcular radar en vivo y restaurar plan del día si existía
    try {
        const scored = await runIdeasAnalysis();
        renderIdeasRadarGrid(scored);

        if (saved && Array.isArray(saved.plan) && saved.plan.length > 0) {
            restoreSavedPlanIntoView(saved, scored);
        }
    } catch (err) {
        console.error('Error cargando radar de Ideas:', err);
    }
}

function renderIdeasRadarGrid(scoredPatterns) {
    const grid = document.getElementById('ideasRadarGrid');
    if (!grid) return;

    const stats = buildRegionRadarStats(scoredPatterns);
    grid.innerHTML = stats.map(st => `
        <button type="button" class="ideas-radar-card ${_ideasSelectedRegion === st.key ? 'is-selected' : ''}" onclick="quickGenerateForRegion('${st.key}')">
            <div class="ideas-radar-card-top">
                <span class="ideas-radar-reg">${escapeIdeasHtml(st.label)}</span>
                ${st.urgentCount > 0 ? `<span class="ideas-radar-urgent">${st.urgentCount} urg.</span>` : ''}
            </div>
            <div class="ideas-radar-count">${st.total} <span>${st.total === 1 ? 'cliente' : 'clientes'}</span></div>
            <div class="ideas-radar-potential">~${formatCurrency(st.potential)}</div>
        </button>
    `).join('');
}

function restoreSavedPlanIntoView(saved, scoredPatterns) {
    const byCode = new Map(scoredPatterns.map(p => [String(p.code), p]));
    const restoredPlan = saved.plan.map(day => {
        const visitedSet = new Set(day.visitedCodes || []);
        const distMap = day.distancesByCode || {};
        const clients = (day.clientCodes || [])
            .map(c => byCode.get(String(c)))
            .filter(Boolean)
            .map(p => ({
                ...p,
                visitedToday: visitedSet.has(String(p.code)),
                distanceKm: distMap[String(p.code)]
            }));
        const reserveClients = (day.reserveCodes || [])
            .map(c => byCode.get(String(c)))
            .filter(Boolean);

        return {
            dayNumber: day.dayNumber,
            zone: day.zone,
            subzone: day.subzone,
            clients,
            reserveClients,
            potentialAmount: clients.reduce((s, c) => s + (c.avgAmount || 0), 0),
            totalClients: clients.length + reserveClients.length
        };
    }).filter(d => d.clients.length > 0);

    if (restoredPlan.length > 0) {
        _currentIdeasPlan = restoredPlan;
        renderIdeasPlanResults(restoredPlan, scoredPatterns, saved.meta?.mode || _ideasSelectedMode);
    }
}

function selectIdeasDays(n) {
    _ideasSelectedDays = n;
    document.querySelectorAll('#ideasDaySelector .ideas-day-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.textContent, 10) === n);
    });
}

function selectIdeasStops(s) {
    _ideasSelectedStops = s;
    document.querySelectorAll('#ideasStopsSelector .ideas-day-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.textContent, 10) === s);
    });
}

function selectIdeasRegion(region) {
    _ideasSelectedRegion = region;
    document.querySelectorAll('#ideasRegionSelector .ideas-region-chip').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.region === region);
    });
    document.querySelectorAll('#ideasRadarGrid .ideas-radar-card').forEach(card => {
        card.classList.toggle('is-selected', card.getAttribute('onclick')?.includes(`'${region}'`));
    });
}

function selectIdeasMode(mode) {
    _ideasSelectedMode = mode;
    document.querySelectorAll('#ideasModeSelector .ideas-mode-chip').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    const regionBlock = document.getElementById('ideasRegionBlock');
    if (regionBlock) regionBlock.hidden = (mode === 'nearby');
    const btnLabel = document.getElementById('ideasGenerateBtnLabel');
    if (btnLabel) {
        btnLabel.textContent = mode === 'nearby'
            ? 'Buscar Clientes Cerca de Mí'
            : 'Generar Plan de Visitas';
    }
}

async function quickGenerateForRegion(region) {
    if (_ideasSelectedMode === 'nearby') {
        selectIdeasMode('priority');
    }
    selectIdeasRegion(region);
    await generateIdeasPlan();
    const resEl = document.getElementById('ideasResultContainer');
    if (resEl) resEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── GENERACIÓN DEL PLAN ───────────────────────────────────
async function generateIdeasPlan() {
    const container = document.getElementById('ideasResultContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="ideas-loading">
            <span class="material-icons-round ideas-loading-icon">psychology</span>
            <p class="ideas-loading-text">${_ideasSelectedMode === 'nearby' ? 'Buscando ubicación GPS y clientes cercanos...' : 'Calculando ruta óptima...'}</p>
        </div>
    `;

    try {
        const scored = await runIdeasAnalysis();
        renderIdeasRadarGrid(scored);

        if (_ideasSelectedMode === 'nearby') {
            await generateNearbyPlan(scored, container);
            return;
        }

        let candidatos = scored.filter(p => !p.isProspect && p.score >= IDEAS_MIN_PRIORITY_SCORE);
        if (_ideasSelectedRegion) {
            candidatos = candidatos.filter(p => matchesRegion(p.province, p.location, _ideasSelectedRegion));
        }
        candidatos.sort((a, b) => b.score - a.score);

        // Si en modo mixto no hay activos prioritarios en la región pero sí prospectos, permitir ruta de prospección
        if (candidatos.length === 0 && _ideasSelectedMode === 'mixed') {
            candidatos = scored.filter(p =>
                p.isProspect &&
                !p.recentlyVisited &&
                (!_ideasSelectedRegion || matchesRegion(p.province, p.location, _ideasSelectedRegion))
            );
        }

        if (candidatos.length === 0) {
            clearSavedIdeasPlanState();
            const regName = formatRegionDisplayName(_ideasSelectedRegion);
            const regText = regName ? ` en ${regName}` : '';
            container.innerHTML = `
                <div class="ideas-empty">
                    <span class="material-icons-round" style="font-size: 56px; color: #16a34a;">verified</span>
                    <p style="font-weight: 900; margin-top: 0.75rem; color: #0f172a; font-size: 1.05rem;">¡Cartera al día${escapeIdeasHtml(regText)}!</p>
                    <p style="font-size: 0.85rem; color: #64748b; margin-top: 0.45rem; max-width: 380px; margin-left: auto; margin-right: auto; line-height: 1.45;">
                        No hay clientes pendientes con prioridad Media o Alta${escapeIdeasHtml(regText)} en este momento.
                    </p>
                </div>
            `;
            return;
        }

        const clusters = clusterByProximity(candidatos, IDEAS_MAX_DISTANCE_KM, _ideasSelectedRegion);
        const plan = generateVisitPlan(clusters, _ideasSelectedDays, _ideasSelectedStops, _ideasSelectedMode, scored, _ideasSelectedRegion);

        _currentIdeasPlan = plan;
        saveIdeasPlanState(plan, {
            region: _ideasSelectedRegion,
            mode: _ideasSelectedMode,
            days: _ideasSelectedDays,
            stops: _ideasSelectedStops
        });

        renderIdeasPlanResults(plan, scored, _ideasSelectedMode);
    } catch (e) {
        console.error('Error generando Ideas:', e);
        container.innerHTML = `
            <div class="ideas-empty">
                <span class="material-icons-round" style="font-size: 48px; color: #ef4444;">error_outline</span>
                <p style="font-weight: 800; margin-top: 0.75rem; color: #ef4444;">Error al generar el plan</p>
                <p style="font-size: 0.85rem; color: #64748b; margin-top: 0.35rem;">${escapeIdeasHtml(e.message)}</p>
            </div>
        `;
    }
}

async function generateNearbyPlan(scored, container) {
    if (!navigator.geolocation) {
        container.innerHTML = `
            <div class="ideas-empty">
                <span class="material-icons-round" style="font-size: 48px; color: #f59e0b;">location_off</span>
                <p style="font-weight: 800; margin-top: 0.75rem; color: #0f172a;">GPS no disponible</p>
                <p style="font-size: 0.85rem; color: #64748b; margin-top: 0.35rem;">Tu navegador no permite geolocalización.</p>
            </div>
        `;
        return;
    }

    const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 7000,
            maximumAge: 30000
        });
    }).catch(err => {
        console.warn('Geolocalización fallida en Ideas:', err);
        return null;
    });

    if (!pos || !pos.coords) {
        container.innerHTML = `
            <div class="ideas-empty">
                <span class="material-icons-round" style="font-size: 48px; color: #f59e0b;">gps_off</span>
                <p style="font-weight: 800; margin-top: 0.75rem; color: #0f172a;">No se pudo obtener tu ubicación</p>
                <p style="font-size: 0.85rem; color: #64748b; margin-top: 0.35rem;">Activa la ubicación del teléfono e inténtalo de nuevo, o selecciona una región manual.</p>
            </div>
        `;
        return;
    }

    _ideasUserCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const gpsClients = scored.filter(p => p.hasGPS && !p.recentlyVisited);

    const withDist = gpsClients.map(p => ({
        ...p,
        distanceKm: haversineKm(_ideasUserCoords.lat, _ideasUserCoords.lng, p.lat, p.lng)
    }));

    // Buscar en radio 20 km; si hay menos de 3, ampliar a 40 km
    let nearby = withDist.filter(p => p.distanceKm <= 20 && (p.score >= 30 || p.dueAlertNote));
    let radiusUsed = 20;
    if (nearby.length < 3) {
        nearby = withDist.filter(p => p.distanceKm <= 40 && (p.score >= 25 || p.isProspect || p.dueAlertNote));
        radiusUsed = 40;
    }

    if (nearby.length === 0) {
        container.innerHTML = `
            <div class="ideas-empty">
                <span class="material-icons-round" style="font-size: 48px; color: #0284c7;">explore</span>
                <p style="font-weight: 800; margin-top: 0.75rem; color: #0f172a;">Sin clientes urgentes en ${radiusUsed} km</p>
                <p style="font-size: 0.85rem; color: #64748b; margin-top: 0.35rem;">Prueba seleccionando una comunidad manualmente arriba.</p>
            </div>
        `;
        return;
    }

    // Ordenar combinando prioridad comercial + cercanía física
    nearby.sort((a, b) => {
        const rankA = a.score + Math.max(0, (radiusUsed - a.distanceKm) * 0.8);
        const rankB = b.score + Math.max(0, (radiusUsed - b.distanceKm) * 0.8);
        return rankB - rankA;
    });

    const maxStops = Math.max(6, _ideasSelectedStops);
    const chosen = orderStopsByProximity(nearby.slice(0, maxStops), _ideasUserCoords);
    const reserve = nearby.slice(maxStops);
    const locNames = [...new Set(chosen.map(c => (c.location || '').trim()).filter(Boolean))];

    const plan = [{
        dayNumber: 1,
        zone: `Cerca de ti (radio ${radiusUsed} km)`,
        subzone: locNames.join(' · '),
        clients: chosen,
        reserveClients: reserve,
        potentialAmount: chosen.reduce((s, c) => s + (c.avgAmount || 0), 0),
        totalClients: nearby.length
    }];

    _currentIdeasPlan = plan;
    saveIdeasPlanState(plan, {
        region: '',
        mode: 'nearby',
        days: 1,
        stops: maxStops
    });

    renderIdeasPlanResults(plan, scored, 'nearby');
}

// ─── RENDERIZADO DE RESULTADOS DEL PLAN ────────────────────
function renderIdeasPlanResults(plan, allScoredPatterns = [], mode = 'priority') {
    const container = document.getElementById('ideasResultContainer');
    if (!container) return;

    const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    let html = '';

    plan.forEach(day => {
        const potentialStr = formatCurrency(Math.round(day.potentialAmount || 0));
        const hasAnyGps = day.clients.some(c => c.hasGPS);

        html += `
            <div class="ideas-day-card">
                <div class="ideas-day-header">
                    <div class="ideas-day-header-top">
                        <div class="ideas-day-badge">Día ${day.dayNumber}</div>
                        <div class="ideas-day-zone">
                            <span class="material-icons-round">location_on</span>
                            <span>${escapeIdeasHtml(day.zone)}</span>
                        </div>
                    </div>
                    <div class="ideas-day-meta-row">
                        <span class="ideas-day-meta-pill">${day.clients.length} ${day.clients.length === 1 ? 'parada' : 'paradas'}</span>
                        <span class="ideas-day-meta-pill is-money">Potencial ~${potentialStr}</span>
                    </div>
                    ${day.subzone ? `<p class="ideas-day-subzone">${escapeIdeasHtml(day.subzone)}</p>` : ''}
                    <div class="ideas-day-header-actions">
                        ${hasAnyGps ? `
                        <button type="button" class="ideas-header-btn ideas-maps-route-btn" onclick="openIdeasDayGoogleMaps(${day.dayNumber})">
                            <span class="material-icons-round">directions</span>
                            <span>Ruta Maps</span>
                        </button>` : ''}
                        <button type="button" class="ideas-header-btn ideas-share-btn" onclick="shareIdeasDayRoute(${day.dayNumber})">
                            <span class="material-icons-round">share</span>
                            <span>WhatsApp</span>
                        </button>
                    </div>
                </div>

                <div class="ideas-clients-list">
                    ${(() => {
                        let lastLoc = '';
                        return day.clients.map((c, idx) => {
                            const currentLoc = normIdeasText(c.location || c.province);
                            let locHeaderHtml = '';
                            if (currentLoc && currentLoc !== lastLoc) {
                                lastLoc = currentLoc;
                                locHeaderHtml = `
                                    <div class="ideas-location-divider">
                                        <span class="material-icons-round">location_city</span>
                                        <span>${escapeIdeasHtml((c.location || c.province || '').toUpperCase())}</span>
                                    </div>
                                `;
                            }

                            const lastDateStr = c.lastOrderDate
                                ? `${c.lastOrderDate.getDate()} ${monthNames[c.lastOrderDate.getMonth()]} ${String(c.lastOrderDate.getFullYear()).slice(-2)}`
                                : 'Sin pedidos';
                            const freqStr = c.avgFrequencyDays ? `~${c.avgFrequencyDays}d` : '—';
                            const amtStr = c.avgAmount > 0 ? formatCurrency(Math.round(c.avgAmount)) : '—';
                            const visitStr = c.daysSinceLastVisit !== null
                                ? (c.daysSinceLastVisit === 0 ? 'Hoy' : `Hace ${c.daysSinceLastVisit}d`)
                                : 'Nunca';

                            const scoreColor = c.isProspect ? '#0284c7'
                                : c.score >= 60 ? '#ef4444'
                                : c.score >= 40 ? '#f59e0b'
                                : '#64748b';

                            const safeCode = String(c.code || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                            const cleanPhone = (c.client?.phone || '').replace(/[^0-9]/g, '');

                            // Badges de contexto comercial
                            const badges = [];
                            if (c.visitedToday) {
                                badges.push(`<span class="ideas-tag is-visited">✓ Visitado hoy</span>`);
                            }
                            if (c.isProspect) {
                                badges.push(`<span class="ideas-tag is-prospect">Prospección</span>`);
                            } else if (c.timingConfidence === 'estable') {
                                badges.push(`<span class="ideas-tag is-stable">Timing estable</span>`);
                            }
                            if (c.cycleTrend === 'acelera') {
                                badges.push(`<span class="ideas-tag is-accel">Pide más rápido</span>`);
                            }
                            if (c.pendingAlmacenCount > 0) {
                                badges.push(`<span class="ideas-tag is-almacen">En Almacén</span>`);
                            }
                            if (c.pendingTampoCount > 0) {
                                badges.push(`<span class="ideas-tag is-tampo">Falta Tampo ${formatCurrency(Math.round(c.pendingTampoAmount))}</span>`);
                            }
                            if (c.distanceKm !== undefined) {
                                badges.push(`<span class="ideas-tag is-dist">${c.distanceKm.toFixed(1)} km</span>`);
                            }

                            return `
                                ${locHeaderHtml}
                                <div class="ideas-client-card ${c.visitedToday ? 'is-visited-card' : ''}">
                                    <div class="ideas-client-top" onclick="openClientDetailModal('${safeCode}')">
                                        <div class="ideas-client-rank">${idx + 1}</div>
                                        <div class="ideas-client-main">
                                            <p class="ideas-client-name">${escapeIdeasHtml(c.name)}</p>
                                            ${badges.length > 0 ? `<div class="ideas-tags-row">${badges.join('')}</div>` : ''}
                                        </div>
                                        <div class="ideas-score-container" title="Prioridad de visita (0 a 100)">
                                            <div class="ideas-score-ring" style="--score-color: ${scoreColor}">
                                                <span>${c.isProspect ? '★' : c.score}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <p class="ideas-client-reason" onclick="openClientDetailModal('${safeCode}')">
                                        <span class="material-icons-round">lightbulb</span>
                                        <span>${escapeIdeasHtml(c.reason)}</span>
                                    </p>

                                    ${c.latestActiveNote && (!c.dueAlertNote || c.latestActiveNote.id !== c.dueAlertNote.id) ? `
                                        <p class="ideas-client-note-chip">
                                            <span class="material-icons-round">sticky_note_2</span>
                                            <span>${escapeIdeasHtml(c.latestActiveNote.note)}</span>
                                        </p>
                                    ` : ''}

                                    <div class="ideas-client-stats" onclick="openClientDetailModal('${safeCode}')">
                                        <div class="ideas-stat">
                                            <span class="ideas-stat-label">Últ. pedido</span>
                                            <span class="ideas-stat-value">${lastDateStr}</span>
                                        </div>
                                        ${!c.isProspect ? `
                                        <div class="ideas-stat">
                                            <span class="ideas-stat-label">Ciclo</span>
                                            <span class="ideas-stat-value">${freqStr}</span>
                                        </div>
                                        <div class="ideas-stat">
                                            <span class="ideas-stat-label">Media</span>
                                            <span class="ideas-stat-value">${amtStr}</span>
                                        </div>
                                        ` : ''}
                                        <div class="ideas-stat">
                                            <span class="ideas-stat-label">Últ. visita</span>
                                            <span class="ideas-stat-value">${visitStr}</span>
                                        </div>
                                    </div>

                                    <div class="ideas-corp-actions app-corp-row">
                                        ${window.renderCorpActionBtn({
                                            type: 'maps',
                                            href: c.hasGPS ? `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}` : '',
                                            label: 'Cómo llegar',
                                            title: c.hasGPS ? 'Cómo llegar en Google Maps' : 'Sin ubicación GPS',
                                            disabled: !c.hasGPS,
                                            compact: true
                                        })}
                                        ${window.renderCorpActionBtn({
                                            type: 'phone',
                                            onclick: cleanPhone ? `window.location.href='tel:${cleanPhone}'` : '',
                                            label: 'Llamar',
                                            title: cleanPhone ? 'Llamar por teléfono' : 'Sin teléfono',
                                            disabled: !cleanPhone,
                                            compact: true
                                        })}
                                        ${window.renderCorpActionBtn({
                                            type: 'whatsapp',
                                            onclick: cleanPhone ? `window.openAppWhatsApp('${cleanPhone}')` : '',
                                            label: 'Whatsapp',
                                            title: cleanPhone ? 'Abrir Whatsapp' : 'Sin teléfono',
                                            disabled: !cleanPhone,
                                            compact: true
                                        })}
                                        ${window.renderCorpActionBtn({
                                            type: 'visit',
                                            onclick: `openIdeasQuickVisitModal('${safeCode}', ${day.dayNumber})`,
                                            label: 'Visitado',
                                            title: c.visitedToday ? 'Visitado hoy' : 'Registrar visita rápida',
                                            done: !!c.visitedToday,
                                            compact: true
                                        })}
                                    </div>
                                </div>
                            `;
                        }).join('');
                    })()}
                </div>

                ${day.reserveClients && day.reserveClients.length > 0 ? `
                    <div class="ideas-reserve-bar">
                        <button type="button" class="ideas-reserve-btn" onclick="addReserveStopToIdeasDay(${day.dayNumber})">
                            <span class="material-icons-round">add_circle_outline</span>
                            <span>Añadir parada en esta zona (+${day.reserveClients.length} disp.)</span>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    });

    const totalPlanned = plan.reduce((s, d) => s + d.clients.length, 0);
    const totalActiveAnalyzed = allScoredPatterns.filter(p => !p.isProspect && p.orderCount >= 2).length;
    const totalProspectsPlanned = plan.reduce((s, d) => s + d.clients.filter(c => c.isProspect).length, 0);

    html += `
        <div class="ideas-footer-stats">
            <p><strong>${totalPlanned}</strong> paradas planificadas · <strong>${totalActiveAnalyzed}</strong> clientes con timing aprendido${totalProspectsPlanned > 0 ? ` · <strong>${totalProspectsPlanned}</strong> de prospección` : ''}</p>
            <p style="opacity: 0.7; font-size: 0.7rem; margin-top: 4px;">El algoritmo ajusta automáticamente los ciclos con cada pedido y visita registrada</p>
        </div>
    `;

    container.innerHTML = html;
}

// ─── ACCIONES SOBRE EL PLAN (AÑADIR RESERVA, MAPS, WHATSAPP, VISITA) ──
function addReserveStopToIdeasDay(dayNumber) {
    if (!_currentIdeasPlan) return;
    const day = _currentIdeasPlan.find(d => d.dayNumber === dayNumber);
    if (!day || !day.reserveClients || day.reserveClients.length === 0) return;

    const nextStop = day.reserveClients.shift();
    day.clients.push(nextStop);
    day.clients = orderStopsByProximity(day.clients, _ideasSelectedMode === 'nearby' ? _ideasUserCoords : null);
    day.potentialAmount = day.clients.reduce((s, c) => s + (c.avgAmount || 0), 0);

    saveIdeasPlanState(_currentIdeasPlan, {
        region: _ideasSelectedRegion,
        mode: _ideasSelectedMode,
        days: _ideasSelectedDays,
        stops: _ideasSelectedStops
    });
    renderIdeasPlanResults(_currentIdeasPlan, _currentIdeasAnalysis || [], _ideasSelectedMode);
    if (window.showToast) window.showToast(`➕ Añadido: ${nextStop.name}`);
}

function openIdeasDayGoogleMaps(dayNumber) {
    if (!_currentIdeasPlan) return;
    const day = _currentIdeasPlan.find(d => d.dayNumber === dayNumber);
    if (!day) return;

    const points = [];
    if (_ideasSelectedMode === 'nearby' && _ideasUserCoords) {
        points.push(`${_ideasUserCoords.lat},${_ideasUserCoords.lng}`);
    }
    day.clients.forEach(c => {
        if (c.hasGPS && !c.visitedToday) {
            points.push(`${c.lat},${c.lng}`);
        }
    });

    if (points.length === 0) {
        day.clients.forEach(c => {
            if (c.hasGPS) points.push(`${c.lat},${c.lng}`);
        });
    }

    if (points.length === 0) {
        return alert('Ninguno de los clientes de este día tiene coordenadas GPS guardadas.');
    }

    const url = `https://www.google.com/maps/dir/${points.join('/')}`;
    window.open(url, '_blank');
}

function shareIdeasDayRoute(dayNumber) {
    if (!_currentIdeasPlan) return;
    const day = _currentIdeasPlan.find(d => d.dayNumber === dayNumber);
    if (!day) return;

    let text = `📍 *PLAN DE VISITAS — DÍA ${day.dayNumber}*\n`;
    text += `🗺️ *Zona:* ${day.zone}\n`;
    if (day.subzone) text += `📌 *Localidades:* ${day.subzone}\n`;
    text += `💶 *Potencial estimado:* ${formatCurrency(Math.round(day.potentialAmount || 0))}\n`;
    text += `\n*Paradas (${day.clients.length}):*\n`;

    day.clients.forEach((c, idx) => {
        const phoneStr = c.client?.phone ? ` (📞 ${c.client.phone})` : '';
        const locStr = (c.location || c.province) ? ` — ${c.location || c.province}` : '';
        const statusStr = c.visitedToday ? ' ✅' : '';
        text += `\n${idx + 1}. *${c.name}*${locStr}${statusStr}\n   💡 ${c.reason}${phoneStr}\n`;
    });

    window.openAppWhatsApp('', text);
}

// ─── MODAL RÁPIDO PARA REGISTRAR VISITA DESDE IDEAS ─────────
function injectIdeasVisitModal() {
    if (document.getElementById('ideasQuickVisitModal')) return;
    const html = `
        <div id="ideasQuickVisitModal" class="modal-overlay" style="z-index: 1300;" onclick="if(event.target.id==='ideasQuickVisitModal') closeIdeasQuickVisitModal()">
            <div class="modal-content" style="max-width: 440px; width: 92%; border-radius: 22px; overflow: hidden;">
                <div class="modal-header" style="background: linear-gradient(135deg, #0284c7 0%, #009ee3 100%); color: white; padding: 15px 18px;">
                    <div style="min-width: 0;">
                        <h2 style="margin: 0; font-size: 16px; font-weight: 800;">Registrar Visita de Hoy</h2>
                        <p id="ideasVisitModalClientName" style="margin: 2px 0 0; font-size: 12px; opacity: 0.9; font-weight: 600;"></p>
                    </div>
                    <button type="button" class="icon-btn text-white" onclick="closeIdeasQuickVisitModal()">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                <div class="modal-body" style="padding: 16px; display: flex; flex-direction: column; gap: 12px;">
                    <input type="hidden" id="ideasVisitClientCode">
                    <input type="hidden" id="ideasVisitDayNum">
                    <div>
                        <label class="form-label" style="font-size: 11px; font-weight: 800; color: #64748b;">COMENTARIO DE LA VISITA (OPCIONAL)</label>
                        <textarea id="ideasVisitNoteInput" class="form-input" rows="2" placeholder="Ej: Pasa pedido la próxima semana, quiere ver novedades..."></textarea>
                    </div>
                    <div>
                        <label class="form-label" style="font-size: 11px; font-weight: 800; color: #64748b;">RECORDATORIO / PRÓXIMA ALERTA (OPCIONAL)</label>
                        <div class="ideas-visit-alert-chips">
                            <button type="button" class="ideas-alert-chip active" data-days="0" onclick="selectIdeasVisitAlertOffset(0, this)">Sin alerta</button>
                            <button type="button" class="ideas-alert-chip" data-days="7" onclick="selectIdeasVisitAlertOffset(7, this)">+7 días</button>
                            <button type="button" class="ideas-alert-chip" data-days="15" onclick="selectIdeasVisitAlertOffset(15, this)">+15 días</button>
                            <button type="button" class="ideas-alert-chip" data-days="30" onclick="selectIdeasVisitAlertOffset(30, this)">+1 mes</button>
                        </div>
                        <input type="hidden" id="ideasVisitAlertDays" value="0">
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 4px;">
                        <button type="button" onclick="closeIdeasQuickVisitModal()" style="flex: 1; height: 46px; border-radius: 13px; border: 1px solid #e2e8f0; background: #f1f5f9; color: #475569; font-weight: 800; cursor: pointer;">Cancelar</button>
                        <button type="button" onclick="confirmIdeasQuickVisit()" style="flex: 1.4; height: 46px; border-radius: 13px; border: none; background: #16a34a; color: white; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                            <span class="material-icons-round" style="font-size: 19px;">check_circle</span>
                            <span>Confirmar Visita</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
}

async function openIdeasQuickVisitModal(clientCode, dayNumber) {
    injectIdeasVisitModal();
    const client = await dataManager.getClientByCode(clientCode);
    if (!client) return alert('Cliente no encontrado');

    document.getElementById('ideasVisitClientCode').value = client.code;
    document.getElementById('ideasVisitDayNum').value = dayNumber;
    document.getElementById('ideasVisitModalClientName').textContent = client.name || '';
    document.getElementById('ideasVisitNoteInput').value = '';
    document.getElementById('ideasVisitAlertDays').value = '0';

    document.querySelectorAll('#ideasQuickVisitModal .ideas-alert-chip').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.days === '0');
    });

    document.getElementById('ideasQuickVisitModal').classList.add('open');
}

function closeIdeasQuickVisitModal() {
    const modal = document.getElementById('ideasQuickVisitModal');
    if (modal) modal.classList.remove('open');
}

function selectIdeasVisitAlertOffset(days, btn) {
    document.getElementById('ideasVisitAlertDays').value = String(days);
    document.querySelectorAll('#ideasQuickVisitModal .ideas-alert-chip').forEach(el => {
        el.classList.toggle('active', el === btn);
    });
}

async function confirmIdeasQuickVisit() {
    const code = document.getElementById('ideasVisitClientCode').value;
    const note = document.getElementById('ideasVisitNoteInput').value.trim();
    const alertDays = parseInt(document.getElementById('ideasVisitAlertDays').value, 10) || 0;

    let alertDateISO = '';
    if (alertDays > 0) {
        const d = getTodayLocalDate();
        d.setDate(d.getDate() + alertDays);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        alertDateISO = `${y}-${m}-${day}`;
    }

    const res = await dataManager.recordClientVisit(code, note, null, alertDateISO);
    if (!res || !res.success) {
        alert('No se pudo registrar la visita: ' + (res?.message || ''));
        return;
    }

    closeIdeasQuickVisitModal();

    if (_currentIdeasPlan) {
        _currentIdeasPlan.forEach(day => {
            day.clients.forEach(c => {
                if (String(c.code) === String(code)) {
                    c.visitedToday = true;
                    c.daysSinceLastVisit = 0;
                    c.recentlyVisited = true;
                }
            });
        });
        saveIdeasPlanState(_currentIdeasPlan, {
            region: _ideasSelectedRegion,
            mode: _ideasSelectedMode,
            days: _ideasSelectedDays,
            stops: _ideasSelectedStops
        });
    }

    const scored = await runIdeasAnalysis();
    renderIdeasRadarGrid(scored);
    if (_currentIdeasPlan) {
        renderIdeasPlanResults(_currentIdeasPlan, scored, _ideasSelectedMode);
    }

    if (window.showToast) {
        window.showToast(`✓ Visita registrada: ${res.client?.name || code}`);
    }
}

// Globales
window.renderIdeas = renderIdeas;
window.selectIdeasDays = selectIdeasDays;
window.selectIdeasStops = selectIdeasStops;
window.selectIdeasRegion = selectIdeasRegion;
window.selectIdeasMode = selectIdeasMode;
window.quickGenerateForRegion = quickGenerateForRegion;
window.generateIdeasPlan = generateIdeasPlan;
window.addReserveStopToIdeasDay = addReserveStopToIdeasDay;
window.openIdeasDayGoogleMaps = openIdeasDayGoogleMaps;
window.shareIdeasDayRoute = shareIdeasDayRoute;
window.openIdeasQuickVisitModal = openIdeasQuickVisitModal;
window.closeIdeasQuickVisitModal = closeIdeasQuickVisitModal;
window.selectIdeasVisitAlertOffset = selectIdeasVisitAlertOffset;
window.confirmIdeasQuickVisit = confirmIdeasQuickVisit;

/**
 * analytics-ideas.js — Motor de Inteligencia Comercial "Ideas de Visita"
 *
 * Analiza el historial de pedidos para detectar patrones de compra
 * (frecuencia, estacionalidad, volumen) y genera planes de visitas
 * agrupando clientes por proximidad geográfica.
 */

// ─── CONSTANTES ────────────────────────────────────────────
const IDEAS_MAX_DISTANCE_KM = 10;       // Radio máximo de agrupación geográfica (10 km)
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
        let rawScore = Math.round(
            (IDEAS_WEIGHT_URGENCY * urgencyScore) +
            (IDEAS_WEIGHT_SEASON * seasonScore) +
            (IDEAS_WEIGHT_VOLUME * volumeScore)
        );

        // PENALIZACIÓN DE COMPRA RECIENTE:
        // Si compró hace menos de 14 días (o menos del 45% de su frecuencia habitual),
        // es improbable que vuelva a comprar. Reducimos su prioridad a casi 0.
        const minDaysWindow = Math.max(14, Math.round((p.avgFrequencyDays || 30) * 0.45));
        const isRecent = p.daysSinceLastOrder !== null && p.daysSinceLastOrder < minDaysWindow;
        if (isRecent) {
            rawScore = Math.max(1, Math.round(rawScore * 0.05));
        }

        p.score = rawScore;

        // Razón principal
        if (isRecent) {
            p.reason = `Compra muy reciente (hace ${p.daysSinceLastOrder} días)`;
        } else if (p.avgFrequencyDays && p.daysSinceLastOrder > p.avgFrequencyDays) {
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

// ─── ZONAS COMERCIALES DELIMITADAS (RUTAS DE 1 DÍA) ──────────
const COMMERCIAL_ZONES_ASTURIAS = [
    {
        id: 'EO_NAVIA',
        name: 'Occidente / Eo-Navia',
        towns: ['RIBADEO', 'CASTROPOL', 'VEGADEO', 'TAPIA DE CASARIEGO', 'TAPIA', 'LA CARIDAD', 'EL FRANCO', 'FOZ', 'SAN COSME', 'TRABADA', 'SAN TIRSO DE ABRES', 'TARAMUNDI', 'A PONTENOVA', 'VIAVÉLEZ', 'VIAVELEZ', 'LA MURIA', 'RINLO', 'BARRES', 'ARANTE', 'CEDOFEITA', 'VIXANDE']
    },
    {
        id: 'NOROCCIDENTE',
        name: 'Noroccidente (Navia - Luarca - Pravia - Tineo)',
        towns: ['NAVIA', 'LUARCA', 'VALDÉS', 'VALDES', 'CADAVEDO', 'CUDILLERO', 'OVIÑANA', 'SOTO DE LUIÑA', 'SOTO DE LUINA', 'TREVÍAS', 'TREVIAS', 'PRAVIA', 'SOTO DEL BARCO', 'MUROS DE NALÓN', 'MUROS DE NALON', 'SALAS', 'TINEO', 'GRADO', 'ORTIGUERA', 'PUERTO DE VEGA', 'VILLAPEDRE', 'CARCEDO', 'LA ESPINA', 'CORNELLANA', 'SANTIAGO DEL MONTE', 'AGONES', 'SAN ESTEBAN', 'ANLEO', 'JARRIO', 'ARCADINA', 'AYONES', 'ARISTÉBANO', 'ARISTEBANO']
    },
    {
        id: 'AVILES_GOZON',
        name: 'Comarca de Avilés y Gozón',
        towns: ['AVILÉS', 'AVILES', 'SALINAS', 'PIEDRAS BLANCAS', 'CASTRILLÓN', 'CASTRILLON', 'LUANCO', 'CANDÁS', 'CANDAS', 'GOZÓN', 'GOZON', 'TRASONA', 'CORVERA', 'CORVERA DE ASTURIAS', 'TAMÓN', 'TAMON', 'SAN JUAN DE NIEVA', 'MONIELLO', 'BOCINES', 'PERLORA', 'NUBLEDO', 'ILLAS']
    },
    {
        id: 'GIJON',
        name: 'Gijón y Alrededores',
        towns: ['GIJÓN', 'GIJON', 'SOMIO', 'SOMIÓ', 'VERIÑA', 'VERINA', 'NUEVO ROCES', 'CIMADEVILLA', 'ROCES', 'TREMAÑES', 'TREMANES', 'CABUEÑES', 'CABUENES', 'PORCEYO']
    },
    {
        id: 'ORIENTE_COSTA',
        name: 'Oriente Costero (Villaviciosa - Llanes)',
        towns: ['VILLAVICIOSA', 'LASTRES', 'COLUNGA', 'CARAVIA', 'RIBADESELLA', 'NUEVA', 'POSADA DE LLANES', 'POSADA', 'LLANES', 'PRIA', 'PRÍA', 'CUEVAS', 'OLES', 'SELORIO', 'LUE', 'HONTORIA', 'CELORIO', 'PÓO', 'POO', 'LA HUERTONA', 'NOCEDO', 'CUERRES', 'ILLAMES DE PRIA', 'AMANDI', 'ANAYO', 'LA GALGUERA', 'LLAMIGO']
    },
    {
        id: 'ORIENTE_INTERIOR',
        name: 'Oriente Interior (Arriondas - Cangas de Onís - Cabrales)',
        towns: ['ARRIONDAS', 'CANGAS DE ONÍS', 'CANGAS DE ONIS', 'COVADONGA', 'BENIA DE ONÍS', 'BENIA DE ONIS', 'CARREÑA', 'CARRENA', 'LAS ARENAS', 'ARENAS DE CABRALES', 'CABRALES', 'ABAMIA', 'CON', 'LLANO DE CON', 'GAMONEDO', 'TORNÍN', 'TORNIN', 'PARRES', 'ONÍS', 'ONIS']
    },
    {
        id: 'OVIEDO',
        name: 'Oviedo y Área Metropolitana',
        towns: ['OVIEDO', 'LUGONES', 'COLLOTO', 'SAN CLAUDIO', 'PIEDRAMUELLE', 'EL CRISTO', 'OLLONIEGO', 'LATORES', 'TRUBIA']
    },
    {
        id: 'SIERO_CUENCAS',
        name: 'Siero y Cuencas Mineras (Siero - Langreo - Mieres - Lena)',
        towns: ['POLA DE SIERO', 'SIERO', 'NOREÑA', 'NORENA', 'EL BERRÓN', 'EL BERRON', 'BERRÓN', 'BERRON', 'LA SECADA', 'CARBAYÍN', 'CARBAYIN', 'CARBAYÍN ALTO', 'LANGREO', 'SAMA', 'EL ENTREGO', 'SAN MARTÍN DEL REY AURELIO', 'SAN MARTIN DEL REY AURELIO', 'POLA DE LAVIANA', 'LAVIANA', 'MIERES', 'UJO', 'CUNA', 'POLA DE LENA', 'LENA', 'MOREDA', 'ALLER', 'CABAÑAQUINTA', 'CABANAQUINTA', 'PELUGANO']
    }
];

// ─── ZONAS COMERCIALES DELIMITADAS EN CANTABRIA ─────────────
const COMMERCIAL_ZONES_CANTABRIA = [
    {
        id: 'CANTABRIA_LIEBANA',
        name: 'Liébana y Peñarrubia (Panes - Potes)',
        towns: ['PANES', 'LA HERMIDA', 'LEBEÑA', 'LEBENA', 'SAN PEDRO DE BEDOYA', 'POTES', 'PORCIEDA', 'PEÑARRUBIA', 'PENARRUBIA', 'CILLORIGO', 'VEGA DE LIÉBANA', 'VEGA DE LIEBANA', 'CAMALEÑO', 'CAMALENO', 'PESAGUERO', 'CABEZÓN DE LIÉBANA']
    },
    {
        id: 'CANTABRIA_WEST_COAST',
        name: 'Costa Occidental (San Vicente - Comillas - Cabezón)',
        towns: ['SAN VICENTE DE LA BARQUERA', 'SAN VICENTE', 'COMILLAS', 'SIERRAPANDO', 'TRECEÑO', 'TRECENO', 'CABEZÓN DE LA SAL', 'CABEZON DE LA SAL', 'CABEZÓN', 'CABEZON', 'VALDÁLIGA', 'VALDALIGA', 'RUILOBA', 'UDIAS', 'UDÍAS']
    },
    {
        id: 'CANTABRIA_BESAYA',
        name: 'Besaya y Costa Central (Torrelavega - Suances - Santillana)',
        towns: ['TORRELAVEGA', 'SUANCES', 'SANTILLANA DEL MAR', 'SANTILLANA', 'POLANCO', 'MIENGO', 'REOCÍN', 'REOCIN', 'CARTES', 'PUENTE SAN MIGUEL', 'BARCENA DE CICERO', 'CUCHÍA', 'CUCHIA']
    },
    {
        id: 'CANTABRIA_SANTANDER',
        name: 'Santander y Área Metropolitana',
        towns: ['SANTANDER', 'CUETO', 'SOTO DE LA MARINA', 'SANTA CRUZ DE BEZANA', 'BEZANA', 'CAMARGO', 'MALIAÑO', 'MALIANO', 'ASTILLERO', 'EL ASTILLERO', 'LIAÑO', 'LIANO', 'MURIEDAS', 'PEÑACASTILLO', 'PENACASTILLO', 'MONTE', 'SAN ROMÁN']
    },
    {
        id: 'CANTABRIA_EAST_COAST',
        name: 'Costa Oriental (Trasmiera - Laredo - Castro-Urdiales)',
        towns: ['SOMO', 'GALIZANO', 'LANGRE', 'AJO', 'BAREYO', 'ISLA', 'ARNUERO', 'NOJA', 'ARGOÑOS', 'ARGONOS', 'SANTOÑA', 'SANTONA', 'LAREDO', 'COLINDRES', 'ISLARES', 'CERDIGO', 'CASTRO-URDIALES', 'CASTRO URDIALES', 'CASTRO', 'SÁMANO', 'SAMANO', 'LUSA', 'EL PONTARRÓN', 'EL PONTARRON', 'AMPUERO', 'LIMPIAS', 'GURIEZO', 'HAZAS DE CESTO', 'SOLÓRZANO', 'ENTRAMBASAGUAS', 'HOZNAYO', 'RIOSECO']
    },
    {
        id: 'CANTABRIA_INTERIOR_PAS_ASON',
        name: 'Interior Pas-Asón (Sarón - Solares - Liérganes - Ampuero - Ramales)',
        towns: ['VARGAS', 'RENEDO DE PIÉLAGOS', 'RENEDO DE PIELAGOS', 'RENEDO', 'ZURITA', 'PIÉLAGOS', 'PIELAGOS', 'SARÓN', 'SARON', 'SOLARES', 'LIÉRGANES', 'LIERGANES', 'CABÁRCENO', 'CABARCENO', 'BARRIO DE ARRIBA', 'ENTRAMBASAGUAS', 'HORNEDO', 'SOLÓRZANO', 'SOLORZANO', 'NATES', 'LIMPIAS', 'AMPUERO', 'SAN PANTALEÓN DE ARAS', 'SAN PANTALEON DE ARAS', 'RAMALES DE LA VICTORIA', 'RAMALES', 'ALISAS', 'ARREDONDO', 'PUENTE VIESGO', 'VILLAFUFRE', 'VEGA DE VILLAFUFRE']
    },
    {
        id: 'CANTABRIA_CAMPOO_SAJA',
        name: 'Campoo y Valles del Saja-Nansa (Reinosa - Molledo - Tudanca)',
        towns: ['REINOSA', 'MATAMOROSA', 'FONTIBRE', 'SALCES', 'ESPINILLA', 'ARGÜESO', 'ARGUESO', 'ORMAS', 'ABIADA', 'BRAÑAVIEJA', 'BRANAVIEJA', 'TUDANCA', 'HELGUERA', 'EL TOJO', 'LOS TOJOS', 'SAJA', 'BÁRCENA MAYOR', 'BARCENA MAYOR', 'MOLLEDO', 'SILIÓ', 'SILIO', 'BÁRCENA DE PIE DE CONCHA', 'BARCENA DE PIE DE CONCHA', 'MONTABLIZ', 'SANTIURDE DE REINOSA', 'SANTIURDE', 'LANTUENO', 'BOLMIR', 'RETORTILLO', 'ARROYO', 'LAS ROZAS', 'CAMPOO', 'ALTO CAMPOO']
    }
];

// ─── ZONAS COMERCIALES DELIMITADAS EN LEÓN Y ALREDEDORES ─────
const COMMERCIAL_ZONES_LEON = [
    {
        id: 'LEON_CENTRO_ORBIGO',
        name: 'León, Órbigo y Astorga (León - Astorga - Benavides)',
        towns: ['LEÓN', 'LEON', 'LA VIRGEN DEL CAMINO', 'VILLADANGOS DEL PÁRAMO', 'VILLADANGOS DEL PARAMO', 'VILLADANGOS', 'CARRIZO DE LA RIBERA', 'CARRIZO', 'ARMELLADA', 'BENAVIDES DE ÓRBIGO', 'BENAVIDES DE ORBIGO', 'BENAVIDES', 'HOSPITAL DE ÓRBIGO', 'HOSPITAL DE ORBIGO', 'VEGUELLINA DE ÓRBIGO', 'VEGUELLINA DE ORBIGO', 'VEGUELLINA', 'ASTORGA', 'CARNEROS', 'RIEGO DE LA VEGA', 'VALDEVIMBRE', 'BERCIANOS DEL PÁRAMO', 'BERCIANOS DEL PARAMO', 'SAN JUSTO DE LA VEGA', 'SANTA MARÍA DEL PÁRAMO', 'SANTA MARIA DEL PARAMO']
    },
    {
        id: 'LEON_ESTE_CAMPOS',
        name: 'Tierra de Campos y León Este (Mansilla - Sahagún - Saldaña)',
        towns: ['PUENTE VILLARENTE', 'MANSILLA DE LAS MULAS', 'MANSILLA', 'RELIEGOS', 'EL BURGO RANERO', 'SAHAGÚN', 'SAHAGUN', 'CEA', 'GRAJAL DE CAMPOS', 'LEDIGOS', 'SALDAÑA', 'SALDANA', 'CARRIÓN DE LOS CONDES', 'CARRION DE LOS CONDES', 'CARRION', 'VILLAMARTÍN DE DON SANCHO', 'VILLAMARTIN DE DON SANCHO', 'POZA DE LA VEGA', 'BARRIOS DE LA VEGA', 'SANTERVÁS DE LA VEGA', 'SANTERVAS DE LA VEGA', 'PEDROSA DE LA VEGA', 'BUSTILLO DE LA VEGA', 'VILLAMORONTA', 'CALZADILLA DE LA CUEZA', 'CALZADA DEL COTO', 'BERCIANOS DEL REAL CAMINO', 'VALDESCAPA DE CEA', 'VILLAMUÑÍO', 'VILLAMUNIO', 'JOARILLA DE LAS MATAS', 'MELGAR DE ARRIBA']
    }
];

// ─── ZONAS COMERCIALES DELIMITADAS EN GALICIA ───────────────
const COMMERCIAL_ZONES_GALICIA = [
    {
        id: 'GALICIA_LUGO_MARINA',
        name: 'Galicia Norte (Mariña Lucense - Lugo)',
        towns: ['VIVEIRO', 'CILLERO', 'JOVE', 'SAN CIPRIÁN', 'SAN CIPRIAN', 'BURELA', 'CANGAS DE FOZ', 'FAZOURO', 'FOZ', 'SAN COSME', 'RINLO', 'O VALADOURO', 'VALADOURO', 'LORENZANA', 'LOURENZÁ', 'LOURENZA', 'GONTÁN', 'GONTAN', 'BRETOÑA', 'BRETONA', 'PASTORIZA', 'A PASTORIZA', 'MUIMENTA', 'COSPEITO', 'FEIRA DO MONTE', 'CASTRO DE REY', 'CASTRO DE REI', 'MEIRA', 'RIBEIRAS DE LEA', 'POL', 'MOSTEIRO', 'RÁBADE', 'RABADE', 'OUTERO DE REI', 'SILVARREI', 'DAS GÁNDARAS', 'DAS GANDARAS', 'LUGO', 'RIBADEO']
    }
];

const COMMERCIAL_ZONES_PREDEFINED = [
    ...COMMERCIAL_ZONES_ASTURIAS,
    ...COMMERCIAL_ZONES_CANTABRIA,
    ...COMMERCIAL_ZONES_LEON,
    ...COMMERCIAL_ZONES_GALICIA
];

function getCommercialZoneForClient(client) {
    const loc = (client.location || '').toUpperCase().trim();
    const addr = (client.address || '').toUpperCase().trim();
    const prov = (client.province || '').toUpperCase().trim();

    for (const zone of COMMERCIAL_ZONES_PREDEFINED) {
        for (const t of zone.towns) {
            if (loc.includes(t) || addr.includes(t) || ((prov.includes('ASTUR') || prov.includes('CANTABR') || prov.includes('LEON') || prov.includes('LEÓN') || prov.includes('GALIC')) && loc === t)) {
                return zone;
            }
        }
    }
    return null;
}

// ─── FASE 3: CLUSTERING GEOGRÁFICO Y POR ZONAS ────────────
function clusterByProximity(scoredClients, maxDistKm) {
    const clusters = [];
    const assigned = new Set();

    // 1. Agrupar primero por Zonas Comerciales Predefinidas
    const zoneMap = new Map();
    scoredClients.forEach(c => {
        const zone = getCommercialZoneForClient(c);
        if (zone) {
            if (!zoneMap.has(zone.id)) {
                zoneMap.set(zone.id, { zone, clients: [] });
            }
            zoneMap.get(zone.id).clients.push(c);
        }
    });

    // Crear clusters para las zonas delimitadas encontradas
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

    // 2. Para clientes que no encajan en una zona delimitada fija, usar clustering GPS (10 km) o por localidad
    const unassignedGPS = scoredClients.filter(c => !assigned.has(c.code) && c.hasGPS);
    unassignedGPS.sort((a, b) => b.score - a.score);

    unassignedGPS.forEach(seedClient => {
        if (assigned.has(seedClient.code)) return;

        const seedLat = seedClient.lat;
        const seedLng = seedClient.lng;
        const seedLoc = (seedClient.location || '').trim().toUpperCase();

        const clusterClients = [seedClient];
        assigned.add(seedClient.code);

        unassignedGPS.forEach(other => {
            if (assigned.has(other.code)) return;

            const otherLoc = (other.location || '').trim().toUpperCase();
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
            id: null,
            seed: seedClient,
            clients: clusterClients,
            label: primaryLoc,
            sublabel: locations.length > 1 ? locations.slice(1).join(', ') : (seedClient.province || ''),
            totalScore: clusterClients.reduce((s, c) => s + c.score, 0)
        });
    });

    // 3. Clientes restantes sin GPS ni zona
    const remaining = scoredClients.filter(c => !assigned.has(c.code));
    if (remaining.length > 0) {
        const byLoc = {};
        remaining.forEach(c => {
            const loc = (c.location || c.province || 'Sin Ubicación').trim();
            const key = loc.toUpperCase();
            if (!byLoc[key]) byLoc[key] = { name: loc, clients: [] };
            byLoc[key].clients.push(c);
        });

        Object.values(byLoc).forEach(group => {
            group.clients.forEach(c => assigned.add(c.code));
            clusters.push({
                id: null,
                seed: null,
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

// ─── FASE 4: PLAN DIARIO ──────────────────────────────────
function generateVisitPlan(clusters, numDays) {
    const plan = [];

    for (let day = 0; day < numDays && day < clusters.length; day++) {
        const cluster = clusters[day];

        // Agrupar estrictamente por Localidad normalizada
        const locationGroupsMap = new Map();
        cluster.clients.forEach(c => {
            const locRaw = (c.location || c.province || 'Sin Ubicación').trim();
            const locKey = locRaw.toUpperCase();
            if (!locationGroupsMap.has(locKey)) {
                locationGroupsMap.set(locKey, { name: locRaw, clients: [] });
            }
            locationGroupsMap.get(locKey).clients.push(c);
        });

        // Ordenar clientes dentro de cada localidad por puntuación descendente
        for (const grp of locationGroupsMap.values()) {
            grp.clients.sort((a, b) => b.score - a.score);
        }

        // Ordenar las localidades según el cliente con mayor puntuación de cada grupo
        const sortedGroups = Array.from(locationGroupsMap.values())
            .sort((a, b) => (b.clients[0]?.score || 0) - (a.clients[0]?.score || 0));

        // Construir la lista de clientes agrupada por localidad
        const dayClients = [];
        sortedGroups.forEach(grp => {
            dayClients.push(...grp.clients);
        });

        const maxCount = Math.max(IDEAS_CLIENTS_PER_DAY, Math.min(dayClients.length, IDEAS_CLIENTS_PER_DAY + 3));
        const selectedClients = dayClients.slice(0, maxCount);

        const locNames = [...new Set(selectedClients.map(c => (c.location || '').trim()).filter(Boolean))];

        plan.push({
            dayNumber: day + 1,
            zone: locNames[0] || cluster.label,
            subzone: locNames.length > 1 ? locNames.slice(1).join(', ') : (cluster.sublabel || ''),
            clients: selectedClients,
            totalClients: cluster.clients.length
        });
    }

    return plan;
}

// Helper para comprobar si una provincia/ciudad coincide con la comunidad seleccionada
function matchesRegion(provinceStr, locationStr, regionTarget) {
    if (!regionTarget) return true;
    const target = regionTarget.toUpperCase().trim();
    const prov = (provinceStr || '').toUpperCase().trim();
    const loc = (locationStr || '').toUpperCase().trim();

    if (target === 'ASTURIAS') {
        return prov.includes('ASTUR') || loc.includes('ASTUR') || loc.includes('OVIEDO') || loc.includes('GIJON') || loc.includes('AVILE') || loc.includes('RIBADEO') || loc.includes('VEGADEO') || loc.includes('CASTROPOL') || loc.includes('TAPIA');
    }
    if (target === 'CANTABRIA') {
        return prov.includes('CANTABR') || loc.includes('SANTANDER') || loc.includes('TORRELAVEGA') || loc.includes('PANES');
    }
    if (target === 'LEÓN' || target === 'LEON') {
        return prov.includes('LEON') || prov.includes('LEÓN') || prov.includes('PALENC') || loc.includes('PONFERRADA') || loc.includes('ASTORGA');
    }
    if (target === 'GALICIA') {
        return prov.includes('GALIC') || prov.includes('LUGO') || prov.includes('CORUÑ') ||
               prov.includes('OURENS') || prov.includes('PONTEVEDR') || prov.includes('SANTIAGO') || prov.includes('VIGO') ||
               loc.includes('RIBADEO') || loc.includes('FOZ') || loc.includes('VIVEIRO') || loc.includes('BURELA') || loc.includes('RINLO') || loc.includes('SAN COSME') || loc.includes('LORENZANA') || loc.includes('LUGO');
    }
    return prov.includes(target) || loc.includes(target);
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

            <!-- Selector de Región / Comunidad -->
            <p class="ideas-selector-label">Comunidad / Región (Opcional):</p>
            <div class="ideas-region-chips" id="ideasRegionSelector">
                <button class="ideas-region-chip ${_ideasSelectedRegion === '' ? 'active' : ''}" data-region="" onclick="selectIdeasRegion('')">Todas</button>
                <button class="ideas-region-chip ${_ideasSelectedRegion === 'ASTURIAS' ? 'active' : ''}" data-region="ASTURIAS" onclick="selectIdeasRegion('ASTURIAS')">Asturias</button>
                <button class="ideas-region-chip ${_ideasSelectedRegion === 'CANTABRIA' ? 'active' : ''}" data-region="CANTABRIA" onclick="selectIdeasRegion('CANTABRIA')">Cantabria</button>
                <button class="ideas-region-chip ${_ideasSelectedRegion === 'LEÓN' ? 'active' : ''}" data-region="LEÓN" onclick="selectIdeasRegion('LEÓN')">León</button>
                <button class="ideas-region-chip ${_ideasSelectedRegion === 'GALICIA' ? 'active' : ''}" data-region="GALICIA" onclick="selectIdeasRegion('GALICIA')">Galicia</button>
            </div>

            <!-- Selector de Días -->
            <p class="ideas-selector-label">¿Cuántos días quieres planificar?</p>
            <div class="ideas-day-buttons" id="ideasDaySelector">
                ${[1, 2, 3, 4, 5].map(n => `
                    <button class="ideas-day-btn ${n === _ideasSelectedDays ? 'active' : ''}" onclick="selectIdeasDays(${n})">${n}</button>
                `).join('')}
            </div>

            <button class="ideas-generate-btn" onclick="generateIdeasPlan()">
                <span class="material-icons-round">auto_awesome</span>
                Generar Plan
            </button>

            <!-- Leyenda explicativa de Prioridades -->
            <div class="ideas-legend-box">
                <span class="ideas-legend-title">Filtro activo: Solo prioridades pendientes (≥ 40 pts)</span>
                <div class="ideas-legend-items">
                    <span class="ideas-legend-item"><span class="ideas-legend-dot" style="background:#ef4444;"></span> <strong>>60</strong> Alta (Atrasados)</span>
                    <span class="ideas-legend-item"><span class="ideas-legend-dot" style="background:#f59e0b;"></span> <strong>40-59</strong> Media (Próximos)</span>
                </div>
            </div>
        </div>
        <div id="ideasResultContainer"></div>
    </main>`;

    contentHtml += renderBottomNav(null);
    app.innerHTML = headerHtml + contentHtml;
}

let _ideasSelectedDays = 3;
let _ideasSelectedRegion = '';

function selectIdeasDays(n) {
    _ideasSelectedDays = n;
    document.querySelectorAll('.ideas-day-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.textContent) === n);
    });
}

function selectIdeasRegion(region) {
    _ideasSelectedRegion = region;
    document.querySelectorAll('.ideas-region-chip').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.region === region);
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

        // Filtrar por puntuación >= 40 y por región seleccionada (si la hay)
        let candidatos = scored.filter(p => p.score >= 40);
        if (_ideasSelectedRegion) {
            candidatos = candidatos.filter(p => matchesRegion(p.province, p.location, _ideasSelectedRegion));
        }
        candidatos.sort((a, b) => b.score - a.score);

        if (candidatos.length === 0) {
            const regText = _ideasSelectedRegion ? ` en ${capitalizeWord(_ideasSelectedRegion)}` : '';
            container.innerHTML = `
                <div class="ideas-empty">
                    <span class="material-icons-round" style="font-size: 64px; color: #f59e0b; opacity: 0.8;">verified</span>
                    <p style="font-weight: 800; margin-top: 1rem; color: #1e293b; font-size: 1.05rem;">¡Cartera al día${regText}!</p>
                    <p style="font-size: 0.85rem; color: #64748b; margin-top: 0.5rem; max-width: 400px; margin-left: auto; margin-right: auto;">
                        No hay clientes con prioridad Media o Alta (≥40 pts) pendientes de visita${regText} en este momento. Tus clientes están al día o han comprado recientemente.
                    </p>
                </div>
            `;
            return;
        }

        const clusters = clusterByProximity(candidatos, IDEAS_MAX_DISTANCE_KM);
        const plan = generateVisitPlan(clusters, _ideasSelectedDays);

        _currentIdeasPlan = plan;

        const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
            'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

        let html = '';
        plan.forEach(day => {
            html += `
                <div class="ideas-day-card">
                    <div class="ideas-day-header">
                        <div class="ideas-day-header-left">
                            <div class="ideas-day-badge">Día ${day.dayNumber}</div>
                            <div class="ideas-day-zone">
                                <span class="material-icons-round" style="font-size: 18px;">location_on</span>
                                <span>${day.zone}</span>
                            </div>
                        </div>
                        <button class="ideas-share-btn" onclick="shareIdeasDayRoute(${day.dayNumber})" title="Enviar esta ruta por WhatsApp">
                            <span class="material-icons-round" style="font-size: 15px;">share</span>
                            <span>Enviar Ruta</span>
                        </button>
                    </div>
                    ${day.subzone ? `<p class="ideas-day-subzone">${day.subzone}</p>` : ''}
                    <div class="ideas-clients-list">
                        ${(() => {
                            let lastLoc = '';
                            return day.clients.map((c, idx) => {
                                const currentLoc = (c.location || c.province || '').trim().toUpperCase();
                                let locHeaderHtml = '';

                                if (currentLoc && currentLoc !== lastLoc) {
                                    lastLoc = currentLoc;
                                    locHeaderHtml = `
                                        <div class="ideas-location-divider">
                                            <span class="material-icons-round" style="font-size:15px; color:#009ee3;">location_city</span>
                                            <span>${(c.location || c.province || '').toUpperCase()}</span>
                                        </div>
                                    `;
                                }

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
                                const locPill = (c.location || c.province)
                                    ? `<span class="ideas-location-pill"><span class="material-icons-round" style="font-size:11px;">place</span>${c.location || c.province}</span>`
                                    : '';

                                const cleanPhone = (c.client.phone || '').replace(/[^0-9]/g, '');

                                return `
                                ${locHeaderHtml}
                                <div class="ideas-client-card">
                                    <div class="ideas-client-rank">${idx + 1}</div>
                                    <div class="ideas-client-info">
                                        <div class="ideas-client-name-row">
                                            <p class="ideas-client-name">${c.name}</p>
                                            ${locPill}
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
                                        <div class="ideas-score-container" title="Puntuación de Prioridad (0 a 100)">
                                            <span class="ideas-score-tag">PRIORIDAD</span>
                                            <div class="ideas-score-ring" style="--score-color: ${scoreColor}">
                                                <span>${c.score}</span>
                                            </div>
                                        </div>
                                        <div class="ideas-action-row">
                                            ${cleanPhone ? `
                                            <a href="tel:${cleanPhone}" class="ideas-action-icon ideas-call-btn" title="Llamar">
                                                <span class="material-icons-round">call</span>
                                            </a>
                                            <a href="https://wa.me/34${cleanPhone}" target="_blank" class="ideas-action-icon ideas-wa-btn" title="WhatsApp">
                                                <span class="material-icons-round">chat</span>
                                            </a>
                                            ` : ''}
                                            ${c.hasGPS ? `
                                            <a href="https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}"
                                               target="_blank" class="ideas-action-icon ideas-map-btn" title="Navegar">
                                                <span class="material-icons-round">navigation</span>
                                            </a>` : ''}
                                        </div>
                                    </div>
                                </div>
                                `;
                            }).join('');
                        })()}
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

let _currentIdeasPlan = null;

function shareIdeasDayRoute(dayNumber) {
    if (!_currentIdeasPlan) return;
    const day = _currentIdeasPlan.find(d => d.dayNumber === dayNumber);
    if (!day) return;

    let text = `📍 *PLAN DE VISITAS — DÍA ${day.dayNumber}*\n`;
    text += `🗺️ *Zona:* ${day.zone}\n`;
    if (day.subzone) text += `📍 *Área:* ${day.subzone}\n`;
    text += `\n*Clientes recomendados (${day.clients.length}):*\n`;

    day.clients.forEach((c, idx) => {
        const phoneStr = c.client.phone ? ` (📞 ${c.client.phone})` : '';
        const locStr = (c.location || c.province) ? ` — ${c.location || c.province}` : '';
        text += `\n${idx + 1}. *${c.name}*${locStr}\n   💡 ${c.reason}${phoneStr}\n`;
    });

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

window.renderIdeas = renderIdeas;
window.selectIdeasDays = selectIdeasDays;
window.selectIdeasRegion = selectIdeasRegion;
window.generateIdeasPlan = generateIdeasPlan;
window.shareIdeasDayRoute = shareIdeasDayRoute;

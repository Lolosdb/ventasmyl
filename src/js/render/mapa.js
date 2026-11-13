/**
 * Lógica del Mapa Interactivo y Optimización de Rutas
 */

window.currentLeafletMap = null;
window.isRouteMode = false;
window.selectedRoutePoints = [];
window.userLocationMarker = null;
window._mapClusterGroup = null;
window._mapMarkerItems = [];
window._mapStatusFilter = window._mapStatusFilter || 'all';

function _escapeMapHtml(val) {
    return String(val ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function _normMapSearch(str) {
    if (typeof window.normalizeTextKey === 'function') return window.normalizeTextKey(str);
    return String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

async function renderMapa(isBack = false) {
    if (typeof updateHistoryState === 'function') updateHistoryState('mapa', isBack);
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Mapa de Clientes');
    const activeFilter = window._mapStatusFilter || 'all';

    let contentHtml = '<main class="map-view-main">';

    // Buscador + filtros interactivos por color (leyenda siempre visible)
    contentHtml += `
        <div class="map-top-controls">
            <div class="pro-search-bar map-search-bar">
                <span class="material-icons-round pro-search-icon">search</span>
                <input type="text" id="mapSearchInput" class="pro-search-input" placeholder="Buscar tienda o localidad..." 
                       onkeydown="if(event.key==='Enter') searchLocation()" oninput="toggleMapClearBtn()" onkeyup="toggleMapClearBtn()">
                <div class="pro-search-actions">
                    <button type="button" id="clearMapSearchBtn" class="pro-search-clear-btn" style="display: none;" onclick="clearMapSearch()" title="Borrar búsqueda">
                        <span class="material-icons-round">close</span>
                    </button>
                    <button type="button" class="pro-search-mic-btn" onclick="window.toggleVoiceDictation('mapSearchInput', this, () => searchLocation())" title="Buscar localidad por voz">
                        <span class="material-icons-round">mic</span>
                    </button>
                </div>
            </div>

            <div class="map-filter-row" id="mapFilterRow">
                <button type="button" class="map-filter-chip is-all ${activeFilter === 'all' ? 'is-active' : ''}" data-map-filter="all" onclick="setMapStatusFilter('all')">
                    <span class="map-chip-count" id="mapCountAll">-</span>
                    <span class="map-chip-label">Todos</span>
                </button>
                <button type="button" class="map-filter-chip is-active-status ${activeFilter === 'active' ? 'is-active' : ''}" data-map-filter="active" onclick="setMapStatusFilter('active')">
                    <span class="map-chip-count" id="mapCountActive">-</span>
                    <span class="map-chip-label"><span class="legend-dot dot-active"></span>Al día</span>
                </button>
                <button type="button" class="map-filter-chip is-overdue ${activeFilter === 'overdue' ? 'is-active' : ''}" data-map-filter="overdue" onclick="setMapStatusFilter('overdue')">
                    <span class="map-chip-count" id="mapCountOverdue">-</span>
                    <span class="map-chip-label"><span class="legend-dot dot-inactive"></span>+45 días</span>
                </button>
                <button type="button" class="map-filter-chip is-none ${activeFilter === 'none' ? 'is-active' : ''}" data-map-filter="none" onclick="setMapStatusFilter('none')">
                    <span class="map-chip-count" id="mapCountNone">-</span>
                    <span class="map-chip-label"><span class="legend-dot dot-no-orders"></span>Sin ped.</span>
                </button>
            </div>
        </div>
    `;

    // Lienzo del mapa limpio con controles flotantes esenciales
    contentHtml += `
        <div class="map-canvas-wrapper">
            <div id="map-container"></div>

            <div class="map-fabs">
                <!-- Clientes Cerca -->
                <button type="button" class="map-fab-btn map-fab-nearby" onclick="window.openNearbyRadarModal()" id="btnNearbyRadar" title="¿Quién tengo cerca ahora?">
                    <span class="material-icons-round">person_pin_circle</span>
                </button>

                <!-- Control de Zoom (+ / -) -->
                <div class="map-control-group">
                    <button type="button" class="map-control-btn" onclick="window.zoomIn()" title="Acercar mapa">
                        <span class="material-icons-round">add</span>
                    </button>
                    <div class="map-control-divider"></div>
                    <button type="button" class="map-control-btn" onclick="window.zoomOut()" title="Alejar mapa">
                        <span class="material-icons-round">remove</span>
                    </button>
                </div>

                <!-- Mi Ubicación GPS -->
                <button type="button" class="map-fab-btn map-fab-location" onclick="centerMapOnUser(true)" title="Centrar en mi ubicación actual">
                    <span class="material-icons-round">my_location</span>
                </button>
            </div>
        </div>
    `;

    contentHtml += '</main>';
    contentHtml += renderBottomNav('mapa');
    app.innerHTML = headerHtml + contentHtml; if(window.restoreScroll) window.restoreScroll();

    initLeafletMap();
    if (window.activeCurrentNav) window.activeCurrentNav('mapa');
}

async function initLeafletMap() {
    if (typeof L === 'undefined') {
        document.getElementById('map-container').innerHTML = '<div class="p-8 text-center text-slate-400">Error: Leaflet no cargado.</div>';
        return;
    }

    const map = L.map('map-container', { zoomControl: false }).setView([43.36, -5.85], 9);
    window.currentLeafletMap = map;
    window.userLocationMarker = null;
    window._mapMarkerItems = [];

    if (window.lastUserCoords) {
        updateUserMarker(window.lastUserCoords.lat, window.lastUserCoords.lng);
    }

    // Mapa base OpenStreetMap oficial (sin API key ni marcas de agua), suavizado por CSS
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    try {
        if (window.injectClientModals) window.injectClientModals();
        if (window.injectPedidoModals) window.injectPedidoModals();
        
        const clients = await dataManager.getClients();
        const orders = await dataManager.getOrders();
        const now = new Date();
        const year = now.getFullYear();

        const markers = L.markerClusterGroup({
            spiderfyOnMaxZoom: false,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: false,
            maxClusterRadius: 26,
            disableClusteringAtZoom: 14
        });
        window._mapClusterGroup = markers;

        markers.on('clusterclick', function (a) {
            const bounds = a.layer.getBounds();
            window.currentLeafletMap.fitBounds(bounds, {
                padding: [50, 50],
                maxZoom: 17,
                animate: true,
                duration: 0.6
            });
        });

        const seenCoords = new Map();
        let countActive = 0;
        let countOverdue = 0;
        let countNone = 0;

        clients.forEach(c => {
            if (!c.lat || !c.lng) return;
            let lat = parseFloat(String(c.lat).replace(',', '.'));
            let lng = parseFloat(String(c.lng).replace(',', '.'));
            if (isNaN(lat) || isNaN(lng)) return;

            const coordKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
            if (seenCoords.has(coordKey)) {
                const count = seenCoords.get(coordKey);
                seenCoords.set(coordKey, count + 1);
                lat += (Math.random() - 0.5) * 0.00016; 
                lng += (Math.random() - 0.5) * 0.00016;
            } else {
                seenCoords.set(coordKey, 1);
            }

            const cOrders = orders.filter(o => dataManager.isOrderForClient(o, c) && o.year === year);
            let daysAgo = null;
            let statusKey = 'none';
            let color = '#3b82f6';
            let statusBadgeHtml = '<span class="popup-status-pill is-none">Sin compras este año</span>';
            
            if (cOrders.length > 0) {
                const lastDate = new Date(Math.max(...cOrders.map(o => new Date(o.dateISO).getTime())));
                daysAgo = Math.ceil(Math.abs(now - lastDate) / (1000 * 60 * 60 * 24));
                if (daysAgo <= 45) {
                    statusKey = 'active';
                    color = '#16a34a';
                    countActive++;
                    statusBadgeHtml = `<span class="popup-status-pill is-active">Al día · hace ${daysAgo}d</span>`;
                } else {
                    statusKey = 'overdue';
                    color = '#ef4444';
                    countOverdue++;
                    statusBadgeHtml = `<span class="popup-status-pill is-overdue">+45d · hace ${daysAgo}d</span>`;
                }
            } else {
                countNone++;
            }

            const marker = L.circleMarker([lat, lng], {
                radius: 9.5,
                fillColor: color,
                color: '#ffffff',
                weight: 2.5,
                fillOpacity: 1
            });

            const safeCode = String(c.code || '').replace(/'/g, "\\'");
            const visitTag = c.lastVisitDate
                ? `<span class="popup-visit-pill"><span class="material-icons-round">visibility</span>${new Date(c.lastVisitDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</span>`
                : '';
            const pinTag = (c.notes && String(c.notes).trim())
                ? '<span class="popup-pin-pill" title="Tiene nota fija"><span class="material-icons-round">push_pin</span>Nota</span>'
                : '';

            marker.bindPopup(`
                <div class="popup-card-wrap">
                    <h3 class="popup-title">${_escapeMapHtml(c.name || 'Cliente')}</h3>
                    <p class="popup-subtitle">${_escapeMapHtml(c.location || '')}</p>
                    <div class="popup-badges-row">
                        ${statusBadgeHtml}
                        ${visitTag}
                        ${pinTag}
                    </div>
                    <div class="popup-actions-stack">
                        <div class="popup-actions-grid">
                            <button type="button" class="popup-btn btn-detail"
                                    onclick="event.stopPropagation(); window.openClientDetailModal('${safeCode}')">
                                <span class="material-icons-round">account_circle</span>
                                <span>Ficha</span>
                            </button>
                            <button type="button" class="popup-btn btn-go-direct"
                                    onclick="event.stopPropagation(); window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}', '_blank')">
                                <span class="material-icons-round">directions</span>
                                <span>Ir</span>
                            </button>
                        </div>
                        <button type="button" class="popup-btn btn-popup-order"
                                onclick="event.stopPropagation(); window.openNewOrderForClient('${safeCode}')">
                            <span class="material-icons-round">add_shopping_cart</span>
                            <span>Nuevo pedido</span>
                        </button>
                        <button type="button" class="popup-btn btn-popup-visit"
                                onclick="event.stopPropagation(); window.quickCheckInVisit('${safeCode}')">
                            <span class="material-icons-round">visibility</span>
                            <span>Visitado hoy</span>
                        </button>
                    </div>
                </div>
            `, { closeButton: false, minWidth: 210 });

            window._mapMarkerItems.push({
                marker,
                status: statusKey,
                name: c.name || '',
                location: c.location || '',
                province: c.province || '',
                lat,
                lng
            });
        });

        const totalMarkers = window._mapMarkerItems.length;
        const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val); };
        setTxt('mapCountAll', totalMarkers);
        setTxt('mapCountActive', countActive);
        setTxt('mapCountOverdue', countOverdue);
        setTxt('mapCountNone', countNone);

        map.addLayer(markers);
        applyMapStatusFilter();

        // Auto-localizar al inicio
        setTimeout(() => centerMapOnUser(false), 500);

    } catch (e) { console.error("Error en mapa", e); }
}

function applyMapStatusFilter() {
    const markers = window._mapClusterGroup;
    if (!markers) return;
    const mode = window._mapStatusFilter || 'all';
    markers.clearLayers();
    const toAdd = [];
    window._mapMarkerItems.forEach(item => {
        if (mode === 'all' || item.status === mode) {
            toAdd.push(item.marker);
        }
    });
    if (toAdd.length > 0) markers.addLayers(toAdd);
}

function setMapStatusFilter(mode) {
    window._mapStatusFilter = mode || 'all';
    document.querySelectorAll('#mapFilterRow .map-filter-chip').forEach(btn => {
        btn.classList.toggle('is-active', btn.getAttribute('data-map-filter') === window._mapStatusFilter);
    });
    applyMapStatusFilter();
}

/**
 * Crea o mueve el marcador de ubicación del usuario.
 * @param {number} lat 
 * @param {number} lng 
 */
function updateUserMarker(lat, lng) {
    if (!window.currentLeafletMap) return;
    window.lastUserCoords = { lat, lng };

    const goldPulseIcon = L.divIcon({
        className: 'user-location-marker',
        html: `
            <div style="position: relative; width: 18px; height: 18px;">
                <div style="position: absolute; width: 100%; height: 100%; background: #fbbf24; border: 2.5px solid white; border-radius: 50%; box-shadow: 0 2px 10px rgba(0,0,0,0.35); z-index: 2;"></div>
                <div style="position: absolute; width: 100%; height: 100%; background: #fbbf24; border-radius: 50%; opacity: 0.65; animation: goldPulse 2s infinite ease-out; z-index: 1;"></div>
            </div>
            <style>
                @keyframes goldPulse {
                    0% { transform: scale(1); opacity: 0.65; }
                    100% { transform: scale(3.2); opacity: 0; }
                }
            </style>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    if (window.userLocationMarker && window.currentLeafletMap.hasLayer(window.userLocationMarker)) {
        window.userLocationMarker.setLatLng([lat, lng]);
    } else {
        window.userLocationMarker = L.marker([lat, lng], { 
            icon: goldPulseIcon,
            zIndexOffset: 1000 // Siempre por encima
        }).addTo(window.currentLeafletMap);
    }
}

function toggleRouteMode() {
    window.isRouteMode = !window.isRouteMode;
    const btn = document.getElementById('btnRouteMode');
    const panel = document.getElementById('route-panel');
    
    if (window.isRouteMode) {
        btn.classList.add('bg-blue-600', 'text-white');
        btn.classList.remove('bg-white', 'text-blue-600');
        panel.style.display = 'block';
        panel.classList.add('fade-in-up');
    } else {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-white', 'text-blue-600');
        panel.style.display = 'none';
        window.selectedRoutePoints = [];
        updateRouteUI();
    }
}

function addPointToRoute(code, name) {
    if (!window.isRouteMode) toggleRouteMode();
    
    if (window.selectedRoutePoints.some(p => p.code === code)) {
        if (window.showToast) window.showToast(`${name} ya está en la ruta`);
        return;
    }
    
    window.selectedRoutePoints.push({ code, name });
    updateRouteUI();
    if (window.showToast) window.showToast(`Añadido a ruta: ${name}`);
    if (window.currentLeafletMap) window.currentLeafletMap.closePopup();
}

function removePointFromRoute(index) {
    window.selectedRoutePoints.splice(index, 1);
    updateRouteUI();
}

function updateRouteUI() {
    const list = document.getElementById('route-list');
    const count = document.getElementById('route-count');
    const btnGen = document.getElementById('btnGenerateRoute');
    
    if (window.selectedRoutePoints.length === 0) {
        list.innerHTML = '<div class="text-center py-6 text-slate-400 italic text-xs">Toca clientes en el mapa para añadirlos</div>';
        btnGen.disabled = true;
        count.textContent = '0';
        return;
    }

    count.textContent = window.selectedRoutePoints.length;
    btnGen.disabled = false;

    list.innerHTML = window.selectedRoutePoints.map((p, i) => `
        <div class="route-item flex items-center justify-between p-3">
            <div class="flex items-center gap-3">
                <div class="number-badge">${i + 1}</div>
                <span class="text-[11px] font-black text-slate-700 uppercase tracking-tight">${p.name}</span>
            </div>
            <button class="text-slate-300 p-1 hover:text-red-500" onclick="window.removePointFromRoute(${i})">
                <span class="material-icons-round text-sm">remove_circle</span>
            </button>
        </div>
    `).join('');
}

async function confirmRoute() {
    if (window.selectedRoutePoints.length === 0) return;
    
    const points = [];
    for (const p of window.selectedRoutePoints) {
        const client = await dataManager.getClientByCode(p.code);
        if (client && client.lat && client.lng) {
            points.push(`${client.lat},${client.lng}`);
        }
    }

    if (points.length === 0) return alert("Los clientes seleccionados no tienen coordenadas válidas.");

    // URL de Google Maps para múltiples destinos: https://www.google.com/maps/dir/lat1,lng1/lat2,lng2/...
    const url = `https://www.google.com/maps/dir/${points.join('/')}`;
    window.open(url, '_blank');
}

function toggleMapClearBtn() {
    toggleClearSearch('mapSearchInput', 'clearMapSearchBtn');
}

async function searchLocation() {
    const input = document.getElementById('mapSearchInput');
    const query = (input ? input.value : '').trim();
    if (!query) return;
    
    // Ocultar teclado en móviles
    if (input) input.blur();

    // 1. Buscar primero en clientes locales (tienda, población o provincia, ignorando tildes)
    const normQ = _normMapSearch(query);
    if (normQ && Array.isArray(window._mapMarkerItems) && window._mapMarkerItems.length > 0 && window.currentLeafletMap) {
        const localMatches = window._mapMarkerItems.filter(item => {
            const hay = _normMapSearch(`${item.name} ${item.location} ${item.province}`);
            return hay.includes(normQ);
        });

        if (localMatches.length === 1) {
            const m = localMatches[0];
            if (window._mapStatusFilter !== 'all' && m.status !== window._mapStatusFilter) {
                setMapStatusFilter('all');
            }
            window.currentLeafletMap.flyTo([m.lat, m.lng], 16, { animate: true, duration: 0.7 });
            setTimeout(() => {
                if (window._mapClusterGroup && typeof window._mapClusterGroup.zoomToShowLayer === 'function') {
                    window._mapClusterGroup.zoomToShowLayer(m.marker, () => m.marker.openPopup());
                } else {
                    m.marker.openPopup();
                }
            }, 450);
            showToast(`📍 ${m.name}`);
            return;
        }

        if (localMatches.length > 1) {
            if (window._mapStatusFilter !== 'all') {
                const anyInFilter = localMatches.some(m => m.status === window._mapStatusFilter);
                if (!anyInFilter) setMapStatusFilter('all');
            }
            const bounds = L.latLngBounds(localMatches.map(m => [m.lat, m.lng]));
            window.currentLeafletMap.fitBounds(bounds, {
                padding: [45, 45],
                maxZoom: 15,
                animate: true,
                duration: 0.7
            });
            showToast(`📍 Mostrando ${localMatches.length} clientes en "${query.toUpperCase()}"`);
            return;
        }
    }

    // 2. Respaldo online con Nominatim si no hay coincidencias locales
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.length > 0 && window.currentLeafletMap) {
            const { lat, lon } = data[0];
            window.currentLeafletMap.flyTo([lat, lon], 14);
        } else alert("No se encontró la ubicación");
    } catch (e) { alert("Error en el buscador (sin conexión)"); }
}

function clearMapSearch() {
    clearSearchField('mapSearchInput', 'clearMapSearchBtn');
}

function centerMapOnUser(doFly = true) {
    if (!navigator.geolocation) return alert("GPS no disponible");

    if (doFly && window.lastUserCoords && window.currentLeafletMap) {
        updateUserMarker(window.lastUserCoords.lat, window.lastUserCoords.lng);
        window.currentLeafletMap.flyTo([window.lastUserCoords.lat, window.lastUserCoords.lng], 15);
    }

    const onPosSuccess = (p) => {
        const { latitude, longitude } = p.coords;
        updateUserMarker(latitude, longitude);
        if (doFly && window.currentLeafletMap) {
            window.currentLeafletMap.flyTo([latitude, longitude], 15);
        }
    };

    navigator.geolocation.getCurrentPosition(
        onPosSuccess,
        () => {
            // Fallback sin alta precisión (más rápido en interiores / redes móviles)
            navigator.geolocation.getCurrentPosition(
                onPosSuccess,
                (err) => {
                    console.warn("Geolocation error:", err);
                    if (doFly && !window.lastUserCoords) {
                        alert("No se pudo obtener la ubicación actual. Comprueba que el GPS esté activado.");
                    }
                },
                { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
            );
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
    );
}

function showToast(message) {
    let toast = document.querySelector('.map-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'map-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function zoomIn() {
    if (window.currentLeafletMap) window.currentLeafletMap.zoomIn();
}

function zoomOut() {
    if (window.currentLeafletMap) window.currentLeafletMap.zoomOut();
}

// Globales
window.renderMapa = renderMapa;
window.toggleRouteMode = toggleRouteMode;
window.addPointToRoute = addPointToRoute;
window.removePointFromRoute = removePointFromRoute;
window.confirmRoute = confirmRoute;
window.searchLocation = searchLocation;
window.clearMapSearch = clearMapSearch;
window.toggleMapClearBtn = toggleMapClearBtn;
window.centerMapOnUser = centerMapOnUser;
window.setMapStatusFilter = setMapStatusFilter;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.showToast = showToast;



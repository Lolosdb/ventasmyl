/**
 * Lógica del Mapa Interactivo y Optimización de Rutas
 */

window.currentLeafletMap = null;
window.isRouteMode = false;
window.selectedRoutePoints = [];
window.userLocationMarker = null;

async function renderMapa(isBack = false) {
    if (typeof updateHistoryState === 'function') updateHistoryState('mapa', isBack);
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Mapa de Clientes');

    let contentHtml = '<main class="map-view-main">';

    // Barra de búsqueda superior con espaciado limpio y equilibrado
    contentHtml += `
        <div class="map-top-search-wrap">
            <div class="pro-search-bar map-search-bar">
                <span class="material-icons-round pro-search-icon">search</span>
                <input type="text" id="mapSearchInput" class="pro-search-input" placeholder="Buscar localidad..." 
                       onkeydown="if(event.key==='Enter') searchLocation()" oninput="toggleMapClearBtn()" onkeyup="toggleMapClearBtn()">
                <div class="pro-search-actions">
                    <button type="button" id="clearMapSearchBtn" class="pro-search-clear-btn" style="display: none;" onclick="clearMapSearch()" title="Borrar búsqueda">
                        <span class="material-icons-round">close</span>
                    </button>
                    <button type="button" class="pro-search-mic-btn" onclick="window.toggleVoiceDictation('mapSearchInput', this)" title="Buscar localidad por voz">
                        <span class="material-icons-round">mic</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    // Lienzo del mapa enmarcado con controles flotantes unificados
    contentHtml += `
        <div class="map-canvas-wrapper">
            <div id="map-container"></div>

            <!-- Controles flotantes unificados y elegantes -->
            <div class="map-fabs">
                <!-- Leyenda Popover -->
                <div id="mapLegendPopover" class="map-legend-popover">
                    <div class="map-legend-title">Estado de Clientes</div>
                    <div class="legend-item"><span class="legend-dot dot-active"></span><span class="legend-label">Activos (&le; 45 días)</span></div>
                    <div class="legend-item"><span class="legend-dot dot-inactive"></span><span class="legend-label">Inactivos (&gt; 45 días)</span></div>
                    <div class="legend-item"><span class="legend-dot dot-no-orders"></span><span class="legend-label">Sin compras este año</span></div>
                </div>

                <!-- Cápsula 1: Herramientas de Consulta (Leyenda + Radar Cercanos) -->
                <div class="map-control-group">
                    <button type="button" class="map-control-btn" onclick="toggleMapLegend()" id="btnMapLegend" title="Ver leyenda de colores">
                        <span class="material-icons-round">info</span>
                    </button>
                    <div class="map-control-divider"></div>
                    <button type="button" class="map-control-btn" onclick="window.openNearbyRadarModal()" id="btnNearbyRadar" title="¿Quién tengo cerca ahora?">
                        <span class="material-icons-round">radar</span>
                    </button>
                </div>

                <!-- Cápsula 2: Control de Zoom (+ / -) -->
                <div class="map-control-group">
                    <button type="button" class="map-control-btn" onclick="window.zoomIn()" title="Acercar mapa">
                        <span class="material-icons-round">add</span>
                    </button>
                    <div class="map-control-divider"></div>
                    <button type="button" class="map-control-btn" onclick="window.zoomOut()" title="Alejar mapa">
                        <span class="material-icons-round">remove</span>
                    </button>
                </div>

                <!-- Botón Principal GPS: Mi Ubicación -->
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

    if (window.lastUserCoords) {
        updateUserMarker(window.lastUserCoords.lat, window.lastUserCoords.lng);
    }

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    // L.control.zoom({ position: 'bottomleft' }).addTo(map); // Eliminado para usar botones personalizados fab-btn

    try {
        // Asegurar que las modales existan
        if (window.injectClientModals) window.injectClientModals();
        if (window.injectPedidoModals) window.injectPedidoModals();
        
        const clients = await dataManager.getClients();
        const orders = await dataManager.getOrders();
        const now = new Date();
        const year = now.getFullYear();

        // Grupo de clusters con zoom inteligente y sin "palitos"
        const markers = L.markerClusterGroup({
            spiderfyOnMaxZoom: false,    // Desactiva los palitos
            showCoverageOnHover: false,
            zoomToBoundsOnClick: false,  // Controlamos nosotros el evento para el zoom forzado
            maxClusterRadius: 2,         // Sensibilidad máxima para separar puntos
            disableClusteringAtZoom: 14  // Que aparezcan los puntos mucho antes de la vista de calle
        });

        // Evento personalizado para zoom con encuadre perfecto
        markers.on('clusterclick', function (a) {
            const bounds = a.layer.getBounds();
            // maxZoom: 17 garantiza ver calles sin acercarse excesivamente
            window.currentLeafletMap.fitBounds(bounds, {
                padding: [50, 50],
                maxZoom: 17,
                animate: true,
                duration: 0.6
            });
        });

        const seenCoords = new Map();

        clients.forEach(c => {
            if (!c.lat || !c.lng) return;
            let lat = parseFloat(String(c.lat).replace(',', '.'));
            let lng = parseFloat(String(c.lng).replace(',', '.'));
            if (isNaN(lat) || isNaN(lng)) return;

            // Micro-desplazamiento para puntos en la misma ubicación (Jitter)
            const coordKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
            if (seenCoords.has(coordKey)) {
                const count = seenCoords.get(coordKey);
                seenCoords.set(coordKey, count + 1);
                // Desplazamiento muy pequeño (~10-15 metros) para separar visualmente
                lat += (Math.random() - 0.5) * 0.00016; 
                lng += (Math.random() - 0.5) * 0.00016;
            } else {
                seenCoords.set(coordKey, 1);
            }

            // Cálculo de días desde último pedido (usando vínculo por código de cliente o nombre normalizado)
            const cOrders = orders.filter(o => dataManager.isOrderForClient(o, c) && o.year === year);
            let daysAgo = 999;
            let color = '#3b82f6'; // Azul: Sin pedidos
            
            if (cOrders.length > 0) {
                const lastDate = new Date(Math.max(...cOrders.map(o => new Date(o.dateISO).getTime())));
                daysAgo = Math.ceil(Math.abs(now - lastDate) / (1000 * 60 * 60 * 24));
                color = daysAgo <= 45 ? '#22c55e' : '#ef4444';
            }

            const marker = L.circleMarker([lat, lng], {
                radius: 11, // Aumentado para mejor táctil
                fillColor: color,
                color: 'white',
                weight: 2,
                fillOpacity: 1
            });

            const safeCode = String(c.code || '').replace(/'/g, "\\'");
            const visitTag = c.lastVisitDate
                ? `<div style="font-size: 10px; font-weight: 800; color: #6d28d9; background: #f5f3ff; border-radius: 999px; padding: 2px 8px; margin: -8px auto 10px; width: fit-content;">👁️ Visitado ${new Date(c.lastVisitDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</div>`
                : '';

            marker.bindPopup(`
                <div class="text-center">
                    <h3 class="popup-title">${c.name}</h3>
                    <p class="popup-subtitle">${c.location || ''}</p>
                    ${visitTag}
                    <div class="flex flex-col gap-2">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                            <button class="popup-btn btn-detail"
                                    onclick="event.stopPropagation(); window.openClientDetailModal('${safeCode}')">
                                <span class="material-icons-round">account_circle</span> FICHA
                            </button>
                            <button class="popup-btn btn-go-direct"
                                    onclick="event.stopPropagation(); window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}', '_blank')">
                                <span class="material-icons-round">near_me</span> IR
                            </button>
                        </div>
                        <button class="popup-btn" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: white; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);"
                                onclick="event.stopPropagation(); window.openNewOrderForClient('${safeCode}')">
                            <span class="material-icons-round">add_shopping_cart</span> ➕ NUEVO PEDIDO
                        </button>
                        <button class="popup-btn" style="background: #f5f3ff; color: #6d28d9; border: 1px solid #ddd6fe;"
                                onclick="event.stopPropagation(); window.quickCheckInVisit('${safeCode}')">
                            <span class="material-icons-round">visibility</span> 👁️ VISITADO HOY
                        </button>
                    </div>
                </div>
            `, { closeButton: false, minWidth: 195 });

            markers.addLayer(marker);
        });

        map.addLayer(markers);
        
        // Auto-localizar al inicio
        setTimeout(() => centerMapOnUser(false), 500);

    } catch (e) { console.error("Error en mapa", e); }
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
    const query = input.value.trim();
    if (!query) return;
    
    // Ocultar teclado en móviles
    input.blur();

    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.length > 0) {
            const { lat, lon } = data[0];
            window.currentLeafletMap.flyTo([lat, lon], 14);
        } else alert("No se encontró la ubicación");
    } catch (e) { alert("Error en el buscador"); }
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

function toggleMapLegend() {
    const popover = document.getElementById('mapLegendPopover');
    const btn = document.getElementById('btnMapLegend');
    const isOpen = popover.classList.contains('open');
    
    if (isOpen) {
        popover.classList.remove('open');
        btn.classList.remove('active');
    } else {
        popover.classList.add('open');
        btn.classList.add('active');
    }
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
window.toggleMapLegend = toggleMapLegend;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.showToast = showToast;



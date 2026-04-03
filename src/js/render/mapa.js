/**
 * Lógica del Mapa Interactivo y Optimización de Rutas
 */

window.currentLeafletMap = null;
window.isRouteMode = false;
window.selectedRoutePoints = [];
window.userLocationMarker = null;

async function renderMapa() {
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Mapa de Clientes');

    let contentHtml = '<main style="padding: 0 1.5rem; position: relative; height: calc(100vh - 120px);">';

    // Leyenda y Buscador Flotante
    contentHtml += `
            <div class="search-container mb-2" style="margin-top: 0.5rem; width: 100%;">
                <span class="material-icons-round search-icon">search</span>
                <input type="text" id="mapSearchInput" class="search-input" placeholder="Buscar localidad..." 
                       onkeydown="if(event.key==='Enter') searchLocation()" onkeyup="toggleMapClearBtn()">
                <span id="clearMapSearchBtn" class="material-icons-round clear-icon" style="display: none;" onclick="clearMapSearch()">cancel</span>
            </div>
            
        </div>
    `;

    contentHtml += '<div id="map-container" style="width: 100%; height: 100%;"></div>';

    // FABs (Botones flotantes)
    contentHtml += `
        <div class="map-fabs absolute bottom-6 right-6 flex flex-col gap-3">
            <!-- Leyenda Popover -->
            <div id="mapLegendPopover" class="map-legend-popover">
                <div class="legend-item"><span class="legend-dot dot-active"></span><span class="legend-label">Activos (<=35d)</span></div>
                <div class="legend-item"><span class="legend-dot dot-inactive"></span><span class="legend-label">Inactivos (>35d)</span></div>
                <div class="legend-item"><span class="legend-dot dot-no-orders"></span><span class="legend-label">Sin compras</span></div>
            </div>

            <button class="fab-btn bg-white text-slate-600 shadow-xl" onclick="toggleMapLegend()" id="btnMapLegend" title="Ver Leyenda">
                <span class="material-icons-round">info</span>
            </button>
            <button class="fab-btn bg-white text-blue-600 shadow-xl" onclick="toggleRouteMode()" id="btnRouteMode" title="Optimizar Ruta">
                <span class="material-icons-round">directions</span>
            </button>
            <button class="fab-btn bg-white text-amber-500 shadow-xl" onclick="centerMapOnUser()" title="Mi Ubicación">
                <span class="material-icons-round">my_location</span>
            </button>
        </div>
    `;

    // Panel de Ruta (Oculto por defecto) - Estilo Bottom Sheet
    contentHtml += `
        <div id="route-panel" class="route-panel-modern glass" style="display: none;">
            <div class="route-header p-4 flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                        <span class="material-icons-round text-sm">route</span>
                    </div>
                    <h3 class="font-black text-slate-800 text-sm">Ruta del Día</h3>
                </div>
                <button class="p-1.5 bg-slate-100 rounded-full text-slate-500" onclick="window.toggleRouteMode()" title="Cerrar y Limpiar">
                    <span class="material-icons-round text-sm">close</span>
                </button>
            </div>
            
            <div id="route-list" class="p-4 flex flex-col gap-2 max-h-48 overflow-y-auto">
                <div class="text-center py-6 text-slate-400 italic text-xs">Añade clientes desde el mapa</div>
            </div>
            
            <div class="p-4 pt-0">
                <button class="btn btn-generate-premium w-full py-4 rounded-2xl flex items-center justify-center gap-2" 
                        id="btnGenerateRoute" disabled onclick="window.confirmRoute()">
                    <span class="material-icons-round">navigation</span>
                    <span>GENERAR RUTA (<span id="route-count">0</span>)</span>
                </button>
            </div>
        </div>
    `;

    contentHtml += '</main>';
    contentHtml += renderBottomNav('mapa');
    app.innerHTML = headerHtml + contentHtml;

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

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20
    }).addTo(map);

    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    try {
        // Asegurar que las modales existan
        if (window.injectClientModals) window.injectClientModals();
        
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

            // Cálculo de días desde último pedido
            const cOrders = orders.filter(o => o.shop === c.name && o.year === year);
            let daysAgo = 999;
            let color = '#3b82f6'; // Azul: Sin pedidos
            
            if (cOrders.length > 0) {
                const lastDate = new Date(Math.max(...cOrders.map(o => new Date(o.dateISO).getTime())));
                daysAgo = Math.ceil(Math.abs(now - lastDate) / (1000 * 60 * 60 * 24));
                color = daysAgo <= 35 ? '#22c55e' : '#ef4444';
            }

            const marker = L.circleMarker([lat, lng], {
                radius: 11, // Aumentado para mejor táctil
                fillColor: color,
                color: 'white',
                weight: 2,
                fillOpacity: 1
            });

            marker.bindPopup(`
                <div class="text-center">
                    <h3 class="popup-title">${c.name}</h3>
                    <p class="popup-subtitle">${c.location || ''}</p>
                    <div class="flex flex-col gap-2">
                        <button class="popup-btn btn-detail"
                                onclick="event.stopPropagation(); window.openClientDetailModal('${c.code}')">
                            <span class="material-icons-round">account_circle</span> FICHA
                        </button>
                        <button class="popup-btn btn-go-direct"
                                onclick="event.stopPropagation(); window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}', '_blank')">
                            <span class="material-icons-round">near_me</span> IR
                        </button>
                    </div>
                </div>
            `, { closeButton: false, minWidth: 160 });

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

    const goldPulseIcon = L.divIcon({
        className: 'user-location-marker',
        html: `
            <div style="position: relative; width: 16px; height: 16px;">
                <div style="position: absolute; width: 100%; height: 100%; background: #fbbf24; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.3); z-index: 2;"></div>
                <div style="position: absolute; width: 100%; height: 100%; background: #fbbf24; border-radius: 50%; opacity: 0.6; animation: goldPulse 2s infinite ease-out; z-index: 1;"></div>
            </div>
            <style>
                @keyframes goldPulse {
                    0% { transform: scale(1); opacity: 0.6; }
                    100% { transform: scale(3); opacity: 0; }
                }
            </style>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    if (window.userLocationMarker) {
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
    
    navigator.geolocation.getCurrentPosition(p => {
        const { latitude, longitude } = p.coords;
        updateUserMarker(latitude, longitude);
        if (doFly && window.currentLeafletMap) {
            window.currentLeafletMap.flyTo([latitude, longitude], 15);
        }
    }, (err) => {
        console.warn("Geolocation error:", err);
    }, { enableHighAccuracy: true });
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
window.showToast = showToast;


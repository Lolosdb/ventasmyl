/**
 * MÓDULO DE MAPA MYL - REIMPLANTACIÓN MODULAR
 * Este archivo maneja de forma aislada toda la lógica del mapa para evitar cuelgues y mejorar la precisión.
 */

(function () {
    // 1. ESTILOS INYECTADOS (Para mantener index.html limpio)
    const style = document.createElement('style');
    style.textContent = `
        /* --- VISOR MAPA FULLSCREEN --- */
        #visor-mapa-myl {
            display: none; position: fixed; top: 0; left: 0;
            width: 100vw; height: 100vh; background: #f8fafc; z-index: 100000;
            animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        #mi-mapa-real { width: 100%; height: 100%; }

        /* --- PANEL CONTROL --- */
        #panel-mapa {
            position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
            background: rgba(255, 255, 255, 0.98); padding: 15px 25px;
            border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.15);
            z-index: 100001; width: 90%; max-width: 450px;
            display: flex; flex-direction: column; align-items: center;
            font-family: 'Inter', system-ui, sans-serif;
            backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.5);
        }

        .header-mapa { display: flex; justify-content: space-between; width: 100%; margin-bottom: 8px; }
        .estado-busqueda { font-size: 14px; color: #1e293b; font-weight: 600; }
        .contador-num { font-size: 14px; color: #64748b; font-weight: 500; }

        .progress-bar {
            width: 100%; height: 8px; background: #e2e8f0;
            border-radius: 10px; overflow: hidden; position: relative;
        }
        #p-fill { height: 100%; background: #2563eb; width: 0%; transition: width 0.5s ease; }

        .btn-cerrar-mapa {
            position: absolute; top: 15px; right: 15px; width: 36px; height: 36px;
            background: #ffffff; border: none; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.1);
            z-index: 100002; transition: all 0.2s; font-size: 20px; color: #475569;
        }
        .btn-cerrar-mapa:hover { background: #f1f5f9; transform: rotate(90deg); }

        #btn-reparar {
            margin-top: 10px; background: none; border: none; color: #ef4444;
            font-size: 12px; text-decoration: underline; cursor: pointer; opacity: 0.7;
        }
        #btn-reparar:hover { opacity: 1; }
    `;
    document.head.appendChild(style);

    // 2. ESTRUCTURA HTML (Solo visor, sin botón flotante propio)
    const html = `
        <div id="visor-mapa-myl">
            <button class="btn-cerrar-mapa">✕</button>
            <div id="panel-mapa">
                <div class="header-mapa">
                    <span id="st-texto" class="estado-busqueda">Geolocalizando...</span>
                    <span id="st-contador" class="contador-num">0/0</span>
                </div>
                <div class="progress-bar"><div id="p-fill"></div></div>
                <button id="btn-reparar">Forzar actualización de direcciones</button>
            </div>
            <div id="mi-mapa-real"></div>
        </div>
    `;
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    // 3. LÓGICA DEL MAPA
    let map = null;
    let markers = [];
    let markerCluster = null;
    // Iconos más pequeños para mejor rendimiento (15x25px en lugar de 25x41px)
    const greenIcon = L.icon({ 
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png', 
        iconSize: [15, 25], 
        iconAnchor: [7, 25], 
        popupAnchor: [1, -20], 
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png', 
        shadowSize: [25, 25] 
    });
    const redIcon = L.icon({ 
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png', 
        iconSize: [15, 25], 
        iconAnchor: [7, 25], 
        popupAnchor: [1, -20], 
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png', 
        shadowSize: [25, 25] 
    });

    function initMap() {
        if (!map) {
            map = L.map('mi-mapa-real').setView([40.4168, -3.7038], 6);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }).addTo(map);
            
            // Inicializar cluster de marcadores (si está disponible)
            if (typeof L !== 'undefined' && L.markerClusterGroup && typeof L.markerClusterGroup === 'function') {
                markerCluster = L.markerClusterGroup({
                    maxClusterRadius: 50, // Radio máximo para agrupar marcadores (en píxeles)
                    spiderfyOnMaxZoom: true, // Separar marcadores al hacer zoom máximo
                    showCoverageOnHover: false,
                    zoomToBoundsOnClick: true,
                    chunkedLoading: true, // Cargar en chunks para mejor rendimiento
                    chunkDelay: 50 // Delay entre chunks
                });
                markerCluster.addTo(map);
            } else {
                console.warn('Leaflet.markercluster no está disponible. Los marcadores se mostrarán sin clustering.');
            }
        }
        map.invalidateSize();
        cargarClientes();
    }

    function cargarClientes() {
        try {
            if (!map) {
                console.error('El mapa no está inicializado');
                return;
            }
            
            const clients = JSON.parse(localStorage.getItem('clients') || '[]');
            const orders = JSON.parse(localStorage.getItem('orders') || '[]');
            
            console.log(`Cargando ${clients.length} clientes...`);
            const now = new Date();
            const limite30Dias = new Date();
            limite30Dias.setDate(now.getDate() - 30);

            let total = 0;
            let ubicados = 0;
            let pendientes = 0;

            // Pre-calcular información de pedidos por cliente para optimizar
            const pedidosPorCliente = new Map();
            orders.forEach(o => {
                const clienteId = o.cliente_id || (o.cliente ? o.cliente : null);
                if (clienteId) {
                    if (!pedidosPorCliente.has(clienteId)) {
                        pedidosPorCliente.set(clienteId, []);
                    }
                    pedidosPorCliente.get(clienteId).push(o);
                }
            });

            // Ordenar pedidos de cada cliente una sola vez
            pedidosPorCliente.forEach((pedidos, clienteId) => {
                pedidos.sort((a, b) => new Date(b.fecha || b.timestamp) - new Date(a.fecha || a.timestamp));
            });

            // Filtrar clientes con coordenadas válidas
            const clientesConCoordenadas = [];
            clients.forEach(c => {
                // Obtener dirección (soporta ambos formatos: inglés y español)
                const direccion = c.address || c.direccion || '';
                const nombre = c.name || c.nombre || '';
                
                if (!nombre && !direccion) return;
                total++;

                if (c.lat && c.lon && c.lat !== 0 && c.lat !== 0.0001) {
                    ubicados++;
                    clientesConCoordenadas.push(c);
                } else if (direccion && direccion.length > 3) {
                    pendientes++;
                }
            });

            // Limpiar marcadores existentes
            if (markerCluster) {
                markerCluster.clearLayers();
            } else {
                // Si no hay clustering, eliminar marcadores del mapa directamente
                markers.forEach(m => map.removeLayer(m));
            }
            markers = [];
            
            console.log(`Clientes con coordenadas: ${clientesConCoordenadas.length}`);

            // Procesar marcadores en lotes para no bloquear la UI
            procesarMarcadoresEnLotes(clientesConCoordenadas, pedidosPorCliente, limite30Dias, total, pendientes);

        } catch (e) {
            console.error("Error cargando clientes:", e);
            document.getElementById('st-texto').innerHTML = `<span style="color: #ef4444;">❌ Error: ${e.message}</span>`;
        }
    }

    function procesarMarcadoresEnLotes(clientes, pedidosPorCliente, limite30Dias, total, pendientes) {
        const BATCH_SIZE = 50; // Procesar 50 marcadores por lote
        let index = 0;
        let procesados = 0;

        function procesarLote() {
            const fin = Math.min(index + BATCH_SIZE, clientes.length);
            
            for (let i = index; i < fin; i++) {
                const c = clientes[i];
                const idMarcador = `m-${c.id}`;
                
                // Buscar pedidos del cliente (por ID o por nombre)
                let misPedidos = pedidosPorCliente.get(c.id) || [];
                if (misPedidos.length === 0 && c.name) {
                    // Buscar por nombre si no hay por ID
                    const pedidosPorNombre = Array.from(pedidosPorCliente.values())
                        .flat()
                        .filter(o => o.cliente && o.cliente.includes(c.name));
                    if (pedidosPorNombre.length > 0) {
                        misPedidos = pedidosPorNombre.sort((a, b) => 
                            new Date(b.fecha || b.timestamp) - new Date(a.fecha || a.timestamp)
                        );
                    }
                }

                let tieneVentaReciente = false;
                let ultimaFecha = "Sin ventas";

                if (misPedidos.length > 0) {
                    const fechaVenta = new Date(misPedidos[0].fecha || misPedidos[0].timestamp);
                    ultimaFecha = fechaVenta.toLocaleDateString();
                    if (fechaVenta >= limite30Dias) tieneVentaReciente = true;
                }

                const nombre = c.name || c.nombre || 'Cliente';
                const direccion = c.address || c.direccion || '';
                
                const marker = L.marker([c.lat, c.lon], { icon: tieneVentaReciente ? greenIcon : redIcon })
                    .bindPopup(`
                        <div style="font-family: sans-serif; padding: 5px;">
                            <strong style="color: #2563eb; font-size: 14px;">${nombre}</strong><br>
                            <span style="color: #64748b; font-size: 12px;">${direccion}</span><br>
                            <span style="font-size: 11px; font-weight: bold;">Venta: ${ultimaFecha}</span>
                        </div>
                    `);
                
                marker._id = idMarcador;
                markers.push(marker);
                if (markerCluster) {
                    markerCluster.addLayer(marker);
                } else {
                    // Si no hay clustering, agregar directamente al mapa
                    marker.addTo(map);
                }
                procesados++;
            }

            index = fin;
            
            // Actualizar progreso
            const porcentaje = total > 0 ? ((total - pendientes) / total * 100) : 0;
            document.getElementById('st-contador').textContent = `${procesados} / ${total - pendientes}`;
            document.getElementById('p-fill').style.width = `${porcentaje}%`;

            if (index < clientes.length) {
                // Continuar con el siguiente lote
                requestAnimationFrame(procesarLote);
            } else {
                // Procesamiento completo
                document.getElementById('st-contador').textContent = `${total - pendientes} / ${total}`;
                if (pendientes > 0) {
                    buscarSiguienteDireccion();
                } else {
                    document.getElementById('st-texto').innerHTML = `<span style="color: #10b981;">✅ Mapa Actualizado</span>`;
                }
            }
        }

        // Iniciar procesamiento
        requestAnimationFrame(procesarLote);
    }

    // Contador de reintentos por cliente para evitar loops infinitos
    const reintentosPorCliente = new Map();
    
    // Función para agregar un solo marcador sin recargar todos
    function agregarMarcadorCliente(cliente, orders, limite30Dias) {
        const idMarcador = `m-${cliente.id}`;
        
        // Verificar si el marcador ya existe
        const existente = markers.find(m => m._id === idMarcador);
        if (existente) {
            return; // Ya existe, no hacer nada
        }
        
        // Buscar pedidos del cliente
        let misPedidos = orders.filter(o => o.cliente_id == cliente.id || (o.cliente && o.cliente.includes(cliente.name || cliente.nombre || '')));
        let tieneVentaReciente = false;
        let ultimaFecha = "Sin ventas";

        if (misPedidos.length > 0) {
            misPedidos.sort((a, b) => new Date(b.fecha || b.timestamp) - new Date(a.fecha || a.timestamp));
            const fechaVenta = new Date(misPedidos[0].fecha || misPedidos[0].timestamp);
            ultimaFecha = fechaVenta.toLocaleDateString();
            if (fechaVenta >= limite30Dias) tieneVentaReciente = true;
        }

        const nombre = cliente.name || cliente.nombre || 'Cliente';
        const direccion = cliente.address || cliente.direccion || '';
        
        const marker = L.marker([cliente.lat, cliente.lon], { icon: tieneVentaReciente ? greenIcon : redIcon })
            .bindPopup(`
                <div style="font-family: sans-serif; padding: 5px;">
                    <strong style="color: #2563eb; font-size: 14px;">${nombre}</strong><br>
                    <span style="color: #64748b; font-size: 12px;">${direccion}</span><br>
                    <span style="font-size: 11px; font-weight: bold;">Venta: ${ultimaFecha}</span>
                </div>
            `);
        
        marker._id = idMarcador;
        markers.push(marker);
        
        if (markerCluster) {
            markerCluster.addLayer(marker);
        } else {
            marker.addTo(map);
        }
    }

    async function buscarSiguienteDireccion() {
        if (document.getElementById('visor-mapa-myl').style.display === 'none') return;

        const clients = JSON.parse(localStorage.getItem('clients') || '[]');
        
        // Buscar cliente sin coordenadas (soporta ambos formatos)
        const target = clients.find(c => {
            const direccion = c.address || c.direccion || '';
            return direccion.length > 4 && (!c.lat || c.lat === 0);
        });

        if (!target) {
            // No hay más clientes pendientes
            document.getElementById('st-texto').innerHTML = `<span style="color: #10b981;">✅ Mapa Actualizado</span>`;
            return;
        }

        const nombre = target.name || target.nombre || 'Cliente';
        const clienteId = target.id;
        const reintentos = reintentosPorCliente.get(clienteId) || 0;
        
        // Si ha fallado 3 veces, marcarlo como no encontrado y seguir
        if (reintentos >= 3) {
            target.lat = 0.0001;
            const idx = clients.findIndex(x => x.id === clienteId);
            if (idx !== -1) clients[idx] = target;
            localStorage.setItem('clients', JSON.stringify(clients));
            reintentosPorCliente.delete(clienteId);
            setTimeout(buscarSiguienteDireccion, 500);
            return;
        }

        document.getElementById('st-texto').innerHTML = `Buscando: <small>${nombre.substring(0, 15)}...</small>`;

        try {
            // Construimos queries progresivamente más simples si falla
            const direccion = target.address || target.direccion || '';
            const ciudad = target.city || target.localidad || '';
            const provincia = target.province || target.provincia || '';
            
            // Intentar diferentes niveles de búsqueda
            const queries = [];
            
            // 1. Búsqueda completa: dirección + ciudad + provincia
            if (direccion && ciudad && provincia) {
                queries.push(`${direccion}, ${ciudad}, ${provincia}, España`);
            }
            
            // 2. Búsqueda sin dirección específica: ciudad + provincia
            if (ciudad && provincia) {
                queries.push(`${ciudad}, ${provincia}, España`);
            }
            
            // 3. Solo provincia
            if (provincia) {
                queries.push(`${provincia}, España`);
            }
            
            // 4. Solo ciudad si existe
            if (ciudad) {
                queries.push(`${ciudad}, España`);
            }

            let encontrado = false;
            
            for (const query of queries) {
                if (encontrado) break;
                
                try {
                    // Timeout más largo (15 segundos) y mejor manejo
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 15000);
                    
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`, {
                        signal: controller.signal,
                        headers: {
                            'User-Agent': 'VentasMYL/1.0'
                        }
                    });
                    clearTimeout(timeoutId);

                    if (res.ok) {
                        const data = await res.json();
                        if (data.length > 0) {
                            target.lat = parseFloat(data[0].lat);
                            target.lon = parseFloat(data[0].lon);
                            console.log(`✅ Coordenadas encontradas para ${nombre}: ${target.lat}, ${target.lon}`);
                            encontrado = true;
                            reintentosPorCliente.delete(clienteId);
                        }
                    } else if (res.status === 429) {
                        // Rate limit - esperar más tiempo
                        console.warn(`⏸️ Límite de velocidad alcanzado, esperando 10 segundos...`);
                        setTimeout(buscarSiguienteDireccion, 10000);
                        return;
                    }
                } catch (fetchError) {
                    if (fetchError.name === 'AbortError') {
                        console.warn(`⏱️ Timeout con query: ${query.substring(0, 50)}...`);
                    } else {
                        console.warn(`❌ Error de red: ${fetchError.message}`);
                    }
                    // Continuar con la siguiente query
                }
            }

            if (!encontrado) {
                // Incrementar contador de reintentos
                reintentosPorCliente.set(clienteId, reintentos + 1);
                
                if (reintentos < 2) {
                    // Reintentar este mismo cliente
                    console.warn(`⚠️ No encontrado, reintentando (${reintentos + 1}/3)...`);
                    setTimeout(buscarSiguienteDireccion, 3000);
                    return;
                } else {
                    // Marcar como no encontrado después de 3 intentos
                    target.lat = 0.0001;
                    console.warn(`⚠️ No se encontraron coordenadas para: ${nombre}`);
                    reintentosPorCliente.delete(clienteId);
                }
            }

            // Guardar progreso
            const idx = clients.findIndex(x => x.id === clienteId);
            if (idx !== -1) clients[idx] = target;
            localStorage.setItem('clients', JSON.stringify(clients));

            // Si se encontraron coordenadas, agregar el marcador sin recargar todos
            if (encontrado && target.lat && target.lon && target.lat !== 0 && target.lat !== 0.0001) {
                const orders = JSON.parse(localStorage.getItem('orders') || '[]');
                const now = new Date();
                const limite30Dias = new Date();
                limite30Dias.setDate(now.getDate() - 30);
                
                agregarMarcadorCliente(target, orders, limite30Dias);
                
                // Actualizar contador sin recargar todo
                const totalClientes = clients.length;
                const clientesConCoords = clients.filter(c => c.lat && c.lon && c.lat !== 0 && c.lat !== 0.0001).length;
                document.getElementById('st-contador').textContent = `${clientesConCoords} / ${totalClientes}`;
                const porcentaje = totalClientes > 0 ? (clientesConCoords / totalClientes * 100) : 0;
                document.getElementById('p-fill').style.width = `${porcentaje}%`;
            }
            
            // Continuar con el siguiente cliente
            setTimeout(buscarSiguienteDireccion, 2000); // Pausa de cortesía para la API (2 segundos)

        } catch (e) {
            console.error("Error en geolocalización:", e);
            reintentosPorCliente.set(clienteId, (reintentosPorCliente.get(clienteId) || 0) + 1);
            setTimeout(buscarSiguienteDireccion, 5000);
        }
    }

    // EVENTOS INTEGRADOS CON BARRA INFERIOR
    setInterval(() => {
        // Buscamos el botón "Mapa" de la barra azul inferior
        const botonesMenu = document.querySelectorAll('span, p');
        botonesMenu.forEach(btn => {
            if (btn.textContent.trim().toLowerCase() === 'mapa' && !btn.dataset.hooked) {
                const contenedorBoton = btn.closest('button, div');
                if (contenedorBoton) {
                    contenedorBoton.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        document.getElementById('visor-mapa-myl').style.display = 'block';
                        initMap();
                    };
                    btn.dataset.hooked = "true";
                }
            }
        });
    }, 1000);

    // Esperar a que el DOM esté listo para los event listeners
    setTimeout(() => {
        const btnCerrar = document.querySelector('.btn-cerrar-mapa');
        if (btnCerrar) {
            btnCerrar.onclick = () => {
                document.getElementById('visor-mapa-myl').style.display = 'none';
            };
        }
        
        const btnReparar = document.getElementById('btn-reparar');
        if (btnReparar) {
            btnReparar.onclick = () => {
                if (confirm("Se borrarán las coordenadas actuales y se volverán a buscar todas las direcciones. ¿Continuar?")) {
                    const clients = JSON.parse(localStorage.getItem('clients') || '[]');
                    clients.forEach(c => { c.lat = 0; c.lon = 0; });
                    localStorage.setItem('clients', JSON.stringify(clients));
                    location.reload();
                }
            };
        }
    }, 100);

})();

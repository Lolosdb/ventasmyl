/**
 * MÓDULO DE MAPA MYL - REIMPLANTACIÓN MODULAR
 * Este archivo maneja de forma aislada toda la lógica del mapa para evitar cuelgues y mejorar la precisión.
 */

(function() {
    // 1. ESTILOS INYECTADOS (Para mantener index.html limpio)
    const style = document.createElement('style');
    style.textContent = `
        /* --- BOTÓN FLOTANTE ESTILO PREMIUM --- */
        #btn-lanzar-mapa {
            position: fixed; bottom: 95px; right: 20px;
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            color: white; padding: 14px 24px; border-radius: 50px;
            box-shadow: 0 10px 25px rgba(37, 99, 235, 0.4);
            font-weight: 800; font-family: 'Inter', sans-serif;
            z-index: 9999; cursor: pointer; border: none;
            display: flex; align-items: center; gap: 10px;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            letter-spacing: 0.5px; border: 1px solid rgba(255,255,255,0.2);
        }
        #btn-lanzar-mapa:hover { transform: translateY(-3px) scale(1.05); box-shadow: 0 15px 30px rgba(37, 99, 235, 0.5); }
        #btn-lanzar-mapa:active { transform: scale(0.95); }

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

    // 2. ESTRUCTURA HTML
    const html = `
        <div id="btn-lanzar-mapa">
            <span>🌍</span> MAPA CLIENTES
        </div>
        <div id="visor-mapa-myl">
            <button class="btn-cerrar-mapa">✕</button>
            <div id="panel-mapa">
                <div class="header-mapa">
                    <span id="st-texto" class="estado-busqueda">Iniciando...</span>
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
    const greenIcon = L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png', shadowSize: [41, 41] });
    const redIcon = L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png', shadowSize: [41, 41] });

    function initMap() {
        if (!map) {
            map = L.map('mi-mapa-real').setView([40.4168, -3.7038], 6);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' 
            }).addTo(map);
        }
        map.invalidateSize();
        cargarClientes();
    }

    function cargarClientes() {
        // Limpiar marcadores previos
        markers.forEach(m => map.removeLayer(m));
        markers = [];

        try {
            const clients = JSON.parse(localStorage.getItem('clients') || '[]');
            const orders = JSON.parse(localStorage.getItem('orders') || '[]');
            const now = new Date();
            const limite30Dias = new Date();
            limite30Dias.setDate(now.getDate() - 30);

            let total = 0;
            let ubicados = 0;
            let pendientes = 0;

            clients.forEach(c => {
                if (!c.name && !c.address) return; // Saltar registros vacíos
                total++;

                // Si ya tiene coordenadas válidas
                if (c.lat && c.lon && c.lat !== 0 && c.lat !== 0.0001) {
                    ubicados++;
                    // Determinar color por venta reciente (30 días)
                    const misPedidos = orders.filter(o => o.cliente_id == c.id || (o.cliente && o.cliente.includes(c.name)));
                    let tieneVentaReciente = false;
                    let ultimaFecha = "Sin ventas";

                    if (misPedidos.length > 0) {
                        misPedidos.sort((a,b) => new Date(b.fecha||b.timestamp) - new Date(a.fecha||a.timestamp));
                        const fechaVenta = new Date(misPedidos[0].fecha||misPedidos[0].timestamp);
                        ultimaFecha = fechaVenta.toLocaleDateString();
                        if (fechaVenta >= limite30Dias) tieneVentaReciente = true;
                    }

                    const marker = L.marker([c.lat, c.lon], { icon: tieneVentaReciente ? greenIcon : redIcon })
                        .bindPopup(`
                            <div style="font-family: sans-serif; padding: 5px;">
                                <strong style="color: #2563eb; font-size: 14px;">${c.name}</strong><br>
                                <span style="color: #64748b; font-size: 12px;">${c.address || 'Sin dirección'}</span><br>
                                <span style="color: #64748b; font-size: 12px;">${c.city || ''} ${c.province || ''}</span><br>
                                <hr style="margin: 8px 0; border: 0; border-top: 1px solid #e2e8f0;">
                                <span style="font-size: 11px; font-weight: bold;">Última venta: ${ultimaFecha}</span>
                            </div>
                        `)
                        .addTo(map);
                    markers.push(marker);
                } else if (c.address && c.address.length > 3) {
                    pendientes++;
                }
            });

            // Actualizar UI del panel
            const porc = total > 0 ? Math.round(((total - pendientes) / total) * 100) : 0;
            document.getElementById('st-contador').textContent = `${total - pendientes} / ${total}`;
            document.getElementById('p-fill').style.width = `${porc}%`;
            
            if (pendientes > 0) {
                document.getElementById('st-texto').innerHTML = `<span style="color: #f59e0b;">Buscando ubicaciones...</span>`;
                buscarSiguienteDireccion();
            } else {
                document.getElementById('st-texto').innerHTML = `<span style="color: #10b981;">✅ Todo ubicado</span>`;
            }

        } catch (e) {
            console.error("Error cargando clientes en mapa:", e);
        }
    }

    async function buscarSiguienteDireccion() {
        if (document.getElementById('visor-mapa-myl').style.display === 'none') return;

        const clients = JSON.parse(localStorage.getItem('clients') || '[]');
        const target = clients.find(c => (c.address && c.address.length > 4) && (!c.lat || c.lat === 0));

        if (!target) return;

        document.getElementById('st-texto').innerHTML = `Buscando: <small>${target.name.substring(0, 15)}...</small>`;

        try {
            // Construimos una query potente combinando Dirección, Ciudad y Provincia
            let queryPartes = [target.address];
            if (target.city) queryPartes.push(target.city);
            if (target.province) queryPartes.push(target.province);
            queryPartes.push("España");

            const query = queryPartes.join(', ');
            const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`);
            
            if (res.ok) {
                const data = await res.json();
                if (data.length > 0) {
                    target.lat = parseFloat(data[0].lat);
                    target.lon = parseFloat(data[0].lon);
                } else {
                    // Si no lo encuentra, marcamos con un valor mínimo para no reintentar infinitamente
                    target.lat = 0.0001; 
                }
            } else {
                // Si la API falla (por ejemplo, por límites de velocidad), esperamos
                setTimeout(buscarSiguienteDireccion, 3000);
                return;
            }

            // Guardar progreso
            const idx = clients.findIndex(x => x.id === target.id);
            if (idx !== -1) clients[idx] = target;
            localStorage.setItem('clients', JSON.stringify(clients));
            
            // Recargar para mostrar chincheta y seguir con el siguiente
            cargarClientes();
            setTimeout(buscarSiguienteDireccion, 1200); // Pausa de cortesía para la API

        } catch (e) {
            console.error("Error en geolocalización:", e);
            setTimeout(buscarSiguienteDireccion, 5000);
        }
    }

    // EVENTOS
    document.getElementById('btn-lanzar-mapa').onclick = () => {
        document.getElementById('visor-mapa-myl').style.display = 'block';
        initMap();
    };

    document.querySelector('.btn-cerrar-mapa').onclick = () => {
        document.getElementById('visor-mapa-myl').style.display = 'none';
    };

    document.getElementById('btn-reparar').onclick = () => {
        if (confirm("Se borrarán las coordenadas actuales y se volverán a buscar todas las direcciones. ¿Continuar?")) {
            const clients = JSON.parse(localStorage.getItem('clients') || '[]');
            clients.forEach(c => { c.lat = 0; c.lon = 0; });
            localStorage.setItem('clients', JSON.stringify(clients));
            location.reload();
        }
    };

})();

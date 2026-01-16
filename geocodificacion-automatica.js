/**
 * MÓDULO DE GEOCODIFICACIÓN AUTOMÁTICA AL IMPORTAR
 * Este script intercepta la importación de clientes y busca coordenadas automáticamente
 */

(function() {
    'use strict';
    
    console.log('📍 Módulo de geocodificación automática cargado');
    
    // Función para geocodificar una dirección
    async function geocodificarDireccion(direccion, ciudad, provincia) {
        try {
            // Construir query
            const queryPartes = [];
            if (direccion && direccion.trim()) queryPartes.push(direccion.trim());
            if (ciudad && ciudad.trim()) queryPartes.push(ciudad.trim());
            if (provincia && provincia.trim()) queryPartes.push(provincia.trim());
            queryPartes.push("España");
            
            const query = queryPartes.join(', ');
            
            // Llamar a la API con timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`,
                {
                    signal: controller.signal,
                    headers: { 'User-Agent': 'VentasMYL/1.0' }
                }
            );
            
            clearTimeout(timeoutId);
            
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                    return {
                        lat: parseFloat(data[0].lat),
                        lon: parseFloat(data[0].lon)
                    };
                }
            }
            
            return null;
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.warn(`Error geocodificando: ${error.message}`);
            }
            return null;
        }
    }
    
    // Función para procesar clientes en segundo plano
    async function procesarGeocodificacionEnSegundoPlano(clientes) {
        console.log(`🔄 Iniciando geocodificación automática para ${clientes.length} clientes...`);
        
        let procesados = 0;
        let encontrados = 0;
        const clientesActualizados = [...clientes];
        
        // Procesar en lotes pequeños para no bloquear la UI
        const BATCH_SIZE = 5;
        
        for (let i = 0; i < clientesActualizados.length; i += BATCH_SIZE) {
            const lote = clientesActualizados.slice(i, i + BATCH_SIZE);
            
            await Promise.all(lote.map(async (cliente) => {
                // Si ya tiene coordenadas, saltar
                if (cliente.lat && cliente.lon && cliente.lat !== 0 && cliente.lat !== 0.0001) {
                    return;
                }
                
                // Si no tiene dirección, saltar
                const direccion = cliente.address || cliente.direccion || '';
                if (!direccion || direccion.trim().length < 3) {
                    return;
                }
                
                procesados++;
                const ciudad = cliente.city || cliente.localidad || cliente.poblacion || '';
                const provincia = cliente.province || cliente.provincia || '';
                
                const coords = await geocodificarDireccion(direccion, ciudad, provincia);
                
                if (coords) {
                    cliente.lat = coords.lat;
                    cliente.lon = coords.lon;
                    encontrados++;
                    console.log(`✅ [${procesados}] ${cliente.name || cliente.nombre}: ${coords.lat}, ${coords.lon}`);
                } else {
                    cliente.lat = 0.0001; // Marcar como no encontrado
                    cliente.lon = 0.0001;
                }
                
                // Guardar progreso en localStorage
                const idx = clientesActualizados.findIndex(c => c.id === cliente.id);
                if (idx !== -1) {
                    clientesActualizados[idx] = cliente;
                }
                localStorage.setItem('clients', JSON.stringify(clientesActualizados));
            }));
            
            // Pausa de cortesía para la API (2 segundos entre lotes)
            if (i + BATCH_SIZE < clientesActualizados.length) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        console.log(`✅ Geocodificación completada: ${encontrados}/${procesados} encontrados`);
        
        // Mostrar notificación si hay muchos clientes
        if (clientesActualizados.length > 10) {
            console.log('💡 Tip: Las coordenadas se están buscando en segundo plano. El mapa se actualizará automáticamente.');
        }
    }
    
    // Interceptar el proceso de importación
    let intervaloIntercepcion = setInterval(() => {
        // Buscar el input de archivo de importación
        const inputs = document.querySelectorAll('input[type="file"][accept*="xls"]');
        
        inputs.forEach(input => {
            // Si ya tiene el listener, no agregarlo de nuevo
            if (input.dataset.geocodificacionHook === 'true') {
                return;
            }
            
            input.dataset.geocodificacionHook = 'true';
            
            // Guardar el listener original
            const originalOnChange = input.onchange;
            
            // Interceptar el cambio de archivo
            input.addEventListener('change', async function(e) {
                // Esperar un momento para que la importación original termine
                setTimeout(async () => {
                    try {
                        // Obtener los clientes recién importados
                        const clients = JSON.parse(localStorage.getItem('clients') || '[]');
                        
                        // Contar cuántos necesitan geocodificación
                        const necesitanGeocodificacion = clients.filter(c => {
                            const direccion = c.address || c.direccion || '';
                            return direccion.length > 3 && (!c.lat || c.lat === 0 || c.lat === 0.0001);
                        }).length;
                        
                        if (necesitanGeocodificacion > 0) {
                            console.log(`📍 Detectada importación: ${clients.length} clientes, ${necesitanGeocodificacion} necesitan geocodificación`);
                            
                            // Iniciar geocodificación en segundo plano
                            procesarGeocodificacionEnSegundoPlano(clients).catch(err => {
                                console.error('Error en geocodificación automática:', err);
                            });
                        } else {
                            console.log('✅ Todos los clientes ya tienen coordenadas');
                        }
                    } catch (error) {
                        console.error('Error interceptando importación:', error);
                    }
                }, 1000); // Esperar 1 segundo para que termine la importación
            }, true); // Usar capture phase
        });
    }, 2000);
    
    // Limpiar intervalo después de 30 segundos (ya debería haber encontrado el input)
    setTimeout(() => {
        clearInterval(intervaloIntercepcion);
    }, 30000);
    
    console.log('✅ Interceptor de importación activado');
})();

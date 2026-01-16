/**
 * Script para agregar coordenadas desde Excel después de importar
 * 
 * INSTRUCCIONES:
 * 1. Importa tu Excel con las columnas lat y lon en la app
 * 2. Abre la consola del navegador (F12)
 * 3. Pega este script completo y ejecútalo
 * 4. El script leerá el Excel y agregará las coordenadas a los clientes en localStorage
 */

// Función para leer un archivo Excel
async function leerExcelYAgregarCoordenadas(archivo) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                // Usar la librería SheetJS (ya está cargada en la app)
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                
                // Convertir a JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                
                // Obtener clientes actuales
                const clients = JSON.parse(localStorage.getItem('clients') || '[]');
                
                let actualizados = 0;
                let noEncontrados = 0;
                
                // Buscar columnas lat y lon en el Excel
                const primeraFila = jsonData[0];
                let colLat = null;
                let colLon = null;
                let colName = null;
                
                // Detectar columnas
                for (const key in primeraFila) {
                    const keyLower = key.toLowerCase();
                    if (keyLower === 'lat' || keyLower === 'latitude') colLat = key;
                    if (keyLower === 'lon' || keyLower === 'long' || keyLower === 'lng' || keyLower === 'longitude') colLon = key;
                    if (keyLower === 'name' || keyLower === 'nombre') colName = key;
                }
                
                if (!colLat || !colLon) {
                    alert('❌ No se encontraron las columnas "lat" y "lon" en el Excel');
                    reject('Columnas no encontradas');
                    return;
                }
                
                console.log(`📊 Procesando ${jsonData.length} filas del Excel...`);
                console.log(`   Columnas detectadas: lat=${colLat}, lon=${colLon}, name=${colName || 'no encontrada'}`);
                
                // Actualizar clientes
                jsonData.forEach((fila, index) => {
                    const lat = parseFloat(fila[colLat]);
                    const lon = parseFloat(fila[colLon]);
                    
                    // Saltar si no hay coordenadas válidas
                    if (isNaN(lat) || isNaN(lon) || lat === 0 || lat === 0.0001) {
                        return;
                    }
                    
                    // Buscar cliente por nombre o código
                    const nombreExcel = fila[colName] || '';
                    const cliente = clients.find(c => {
                        const nombreCliente = (c.name || c.nombre || '').toLowerCase().trim();
                        const nombreExcelLower = nombreExcel.toLowerCase().trim();
                        return nombreCliente === nombreExcelLower || 
                               (c.code && c.code.toString() === (fila.code || fila.Code || '').toString());
                    });
                    
                    if (cliente) {
                        cliente.lat = lat;
                        cliente.lon = lon;
                        actualizados++;
                    } else {
                        noEncontrados++;
                        if (noEncontrados <= 5) {
                            console.warn(`⚠️ Cliente no encontrado: ${nombreExcel}`);
                        }
                    }
                });
                
                // Guardar en localStorage
                localStorage.setItem('clients', JSON.stringify(clients));
                
                console.log(`✅ Proceso completado:`);
                console.log(`   - Clientes actualizados: ${actualizados}`);
                console.log(`   - Clientes no encontrados: ${noEncontrados}`);
                
                alert(`✅ Coordenadas agregadas!\n\nActualizados: ${actualizados}\nNo encontrados: ${noEncontrados}\n\nRecarga el mapa para ver los cambios.`);
                
                resolve({ actualizados, noEncontrados });
                
            } catch (error) {
                console.error('Error procesando Excel:', error);
                alert('❌ Error: ' + error.message);
                reject(error);
            }
        };
        
        reader.onerror = reject;
        reader.readAsArrayBuffer(archivo);
    });
}

// Función para crear un input de archivo
function crearInputArchivo() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.style.display = 'none';
    
    input.onchange = async (e) => {
        const archivo = e.target.files[0];
        if (!archivo) return;
        
        console.log(`📁 Archivo seleccionado: ${archivo.name}`);
        await leerExcelYAgregarCoordenadas(archivo);
    };
    
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
}

// Ejecutar
console.log('🚀 Script de geocodificación iniciado');
console.log('📝 Selecciona el archivo Excel con las columnas lat y lon...');
crearInputArchivo();

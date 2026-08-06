/**
 * Extrae de forma segura el año de una fecha (soporta YYYY-MM-DD, DD/MM/YYYY, ISO completo)
 * Evitando dependencias de zona horaria del constructor de Date en ciertos formatos.
 */
function getYearFromDate(dateStr) {
    if (!dateStr) return null;
    const cleanDate = String(dateStr).trim();
    if (cleanDate.includes('-')) {
        const parts = cleanDate.split('-');
        if (parts[0].length === 4) return parseInt(parts[0], 10);
        if (parts[2] && parts[2].substring(0, 4).length === 4) return parseInt(parts[2].substring(0, 4), 10);
    }
    if (cleanDate.includes('/')) {
        const parts = cleanDate.split('/');
        if (parts[2] && parts[2].substring(0, 4).length === 4) return parseInt(parts[2].substring(0, 4), 10);
    }
    const d = new Date(cleanDate);
    return isNaN(d.getTime()) ? null : d.getFullYear();
}

/**
 * Extrae de forma segura el mes (0-11) de una fecha
 */
function getMonthFromDate(dateStr) {
    if (!dateStr) return null;
    const cleanDate = String(dateStr).trim();
    if (cleanDate.includes('-')) {
        const parts = cleanDate.split('-');
        if (parts[0].length === 4) return parseInt(parts[1], 10) - 1; // YYYY-MM-DD
        return parseInt(parts[1], 10) - 1; // Fallback
    }
    if (cleanDate.includes('/')) {
        const parts = cleanDate.split('/');
        return parseInt(parts[1], 10) - 1; // DD/MM/YYYY
    }
    const d = new Date(cleanDate);
    return isNaN(d.getTime()) ? null : d.getMonth();
}

class DataManager {
    constructor() {
        this.db = new LocalDB();
    }

    async init() {
        await this.db.init();
        // Cargar objetivos por defecto si no existen
        const goals = await this.db.get('config', 'goals');
        if (!goals) {
            await this.db.put('config', {
                key: 'goals',
                // Default detailed goals for 3%, 4%, 5%
                data3: [10710, 38039, 57372, 40860, 52467, 58145, 77911, 74852, 44996, 43557, 17640, 12600],
                data4: [11305, 40152, 60560, 43130, 55382, 61376, 82240, 79011, 47496, 45977, 18620, 13300],
                data5: [11900, 42265, 63747, 45400, 58297, 64606, 86568, 83169, 49996, 48397, 19600, 14000]
            });
        }

        // Auto-create current year if missing (e.g. first run on Jan 1st)
        const currentYear = new Date().getFullYear();
        const created = await this.ensureYearExists(currentYear);

        // 3. Departments Default Seed
        const depts = await this.getDepartamentos();
        if (depts.length === 0) {
            const defaultDepts = [
                { id: '1', name: 'Joaquín - Pedidos', contactName: 'Joaquín', functions: 'Pedidos - Facturación - R.E. - Cambios en...', phone: '', whatsapp: '', mail: '', createdAt: new Date().toISOString() },
                { id: '2', name: 'Eva - Agencias transporte', contactName: 'Eva', functions: 'Transporte - Ordenes de recogida -...', phone: '', whatsapp: '', mail: '', createdAt: new Date().toISOString() },
                { id: '3', name: 'David - Roturas', contactName: 'David', functions: 'Partes de roturas - Morosos', phone: '', whatsapp: '', mail: '', createdAt: new Date().toISOString() },
                { id: '4', name: 'Sofía - Contabilidad', contactName: 'Sofía', functions: 'Cambios vtos - Domiciliaciones bancarias -...', phone: '', whatsapp: '', mail: '', createdAt: new Date().toISOString() },
                { id: '5', name: 'Vanessa - Gestión', contactName: 'Vanessa', functions: 'Ingresos - Cambios c/c - Baja clientes -...', phone: '', whatsapp: '', mail: '', createdAt: new Date().toISOString() },
                { id: '6', name: 'Alex - Compras internacional', contactName: 'Alex', functions: 'Compras - Fechas de llegadas', phone: '', whatsapp: '', mail: '', createdAt: new Date().toISOString() }
            ];
            await this.db.bulkPut('departments', defaultDepts);
        }

        return { created, year: currentYear };
    }

    async ensureYearExists(year) {
        let changed = false;

        // 1. Sales History
        let sales = await this.getSalesHistory();
        if (!sales[year]) {
            sales[year] = Array(12).fill(0);
            await this.db.put('config', { key: 'sales_history', data: sales });
            changed = true;
        }

        // 2. Invoice History
        let invoice = await this.getInvoiceHistory();
        if (!invoice[year]) {
            invoice[year] = Array(12).fill(0);
            await this.db.put('config', { key: 'invoice_history', data: invoice });
            changed = true;
        }

        return changed;
    }


    async getDetailedGoals() {
        const stored = await this.db.get('config', 'goals');
        if (stored && stored.data3) return stored;

        // Fallback defaults if key missing or old structure
        return {
            data3: [10710, 38039, 57372, 40860, 52467, 58145, 77911, 74852, 44996, 43557, 17640, 12600],
            data4: [11305, 40152, 60560, 43130, 55382, 61376, 82240, 79011, 47496, 45977, 18620, 13300],
            data5: [11900, 42265, 63747, 45400, 58297, 64606, 86568, 83169, 49996, 48397, 19600, 14000]
        };
    }

    async saveGoals(goalsData) {
        // goalsData should look like { data3: [], data4: [], data5: [] }
        await this.db.put('config', { key: 'goals', ...goalsData });
    }

    async updateGoal(level, monthIdx, value) {
        const goals = await this.getDetailedGoals();
        const key = `data${level}`;
        if (goals[key]) {
            goals[key][monthIdx] = parseFloat(value) || 0;
            await this.saveGoals(goals);
        }
    }

    // --- GOALS HISTORY (SNAPSHOTS POR AÑO para Facturación Real) ---
    async getGoalsHistory() {
        const stored = await this.db.get('config', 'goals_history');
        return (stored && stored.data) ? stored.data : {};
    }

    async saveGoalsSnapshot(year, goalsData) {
        const yearStr = String(year);
        const history = await this.getGoalsHistory();
        history[yearStr] = {
            data3: [...(goalsData.data3 || [])],
            data4: [...(goalsData.data4 || [])],
            data5: [...(goalsData.data5 || [])]
        };
        await this.db.put('config', { key: 'goals_history', data: history });
    }

    // Devuelve los objetivos para un año concreto:
    //   - Año actual → objetivos activos (siempre en vivo)
    //   - Año pasado → snapshot guardada, o null si no existe (sin colores)
    async getGoalsForYear(year) {
        const currentYear = new Date().getFullYear();
        if (parseInt(year) >= currentYear) {
            return await this.getDetailedGoals();
        }
        const history = await this.getGoalsHistory();
        return history[String(year)] || null;
    }

    // --- QUARTERLY GOALS (OBJETIVOS TRIMESTRALES) ---
    // --- QUARTERLY GOALS (OBJETIVOS TRIMESTRALES POR AÑO) ---
    async getQuarterlyGoals(year) {
        const stored = await this.db.get('config', 'quarterly_goals_v2');
        const yearStr = String(year || new Date().getFullYear());
        
        if (stored && stored.data && stored.data[yearStr]) {
            return stored.data[yearStr];
        }

        // Migración transparente: si no existe v2, buscar en v1 (global)
        if (!stored) {
            const old = await this.db.get('config', 'quarterly_goals');
            if (old && old.data) {
                // Si es el año actual, devolver lo que había en v1 para no perder datos
                const currentYear = new Date().getFullYear();
                if (String(year) === String(currentYear)) {
                    return old.data;
                }
            }
        }

        return {
            q1: { target: 0 }, q2: { target: 0 }, q3: { target: 0 }, q4: { target: 0 }
        };
    }

    async saveQuarterlyGoals(year, yearData) {
        const yearStr = String(year || new Date().getFullYear());
        let stored = await this.db.get('config', 'quarterly_goals_v2');
        
        if (!stored) stored = { key: 'quarterly_goals_v2', data: {} };
        
        // Guardar solo el objetivo (target); el facturado (actual) es siempre dinámico
        const cleanData = {};
        Object.keys(yearData).forEach(q => {
            cleanData[q] = { target: parseFloat(yearData[q].target) || 0 };
        });

        stored.data[yearStr] = cleanData;
        await this.db.put('config', stored);
    }

    // --- DEPARTAMENTOS ---
    async getDepartamentos() {
        return await this.db.getAll('departments');
    }

    async saveDepartamento(dept) {
        if (!dept.id) {
            dept.id = Date.now().toString(); // Simple ID generation
        }
        await this.db.put('departments', dept);
        return dept;
    }

    async deleteDepartamento(id) {
        await this.db.delete('departments', id);
    }

    // --- CLIENTS ---
    async getClients() {
        return await this.db.getAll('clients');
    }

    async getClientByCode(code) {
        // Ensure code is treated as string for lookup robustness
        return await this.db.get('clients', String(code));
    }

    async importClientsFromExcel(input) {
        return new Promise((resolve, reject) => {
            const processData = async (data) => {
                try {
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    let rawData = XLSX.utils.sheet_to_json(firstSheet);

                    if (rawData.length > 0) {
                        console.log("Columnas detectadas:", Object.keys(rawData[0]));
                    }

                    const getValue = (row, ...keys) => {
                        for (let k of keys) {
                            if (row[k] !== undefined) return row[k];
                            const foundKey = Object.keys(row).find(rk => rk.trim().toUpperCase() === k.toUpperCase());
                            if (foundKey) return row[foundKey];
                        }
                        return '';
                    };

                    const clients = rawData.map(row => ({
                        // Trim code and remove leading quotes/accents if present
                        code: String(getValue(row, 'CODIGO', 'CÓDIGO') || '').replace(/^['´]+/, '').trim(),
                        name: getValue(row, 'TIENDA', 'NOMBRE', 'CLIENTE'),
                        nif: getValue(row, 'NIF', 'DNI'),
                        email: getValue(row, 'MAIL', 'EMAIL', 'CORREO'),
                        address: getValue(row, 'DIRECCION', 'DIRECCIÓN'),
                        contact: getValue(row, 'CONTACTO'),
                        location: getValue(row, 'POBLACION', 'POBLACIÓN', 'CIUDAD'),
                        province: getValue(row, 'PROVINCIA'),
                        cp: getValue(row, 'CP', 'C.P.', 'CODIGO POSTAL', 'CÓDIGO POSTAL'),
                        phone: String(getValue(row, 'TELEFONO', 'TELÉFONO', 'MOVIL') || '').replace(/^['´]+/, '').trim(),
                        phone2: String(getValue(row, 'TELEFONO 2', 'TELÉFONO 2', 'MOVIL 2') || '').replace(/^['´]+/, '').trim(),
                        schedule: getValue(row, 'HORARIO', 'HORARIOS', 'SCHEDULE'),
                        lat: getValue(row, 'LATITUD', 'LAT', 'LATITUDE'),
                        lng: getValue(row, 'LONGITUD', 'LNG', 'LONG', 'LON', 'LONGITUDE'),
                        createdAt: new Date().toISOString()
                    })).filter(c => c.code && c.name);

                    if (clients.length > 0) {
                        // MERGE: los clientes de Drive actualizan/añaden los locales,
                        // pero NO se borran los clientes creados solo en local.
                        const existingClients = await this.db.getAll('clients');
                        const driveCodeSet = new Set(clients.map(c => String(c.code).trim()));
                        // Clientes locales que NO están en Drive (se conservan)
                        const localOnlyClients = existingClients.filter(
                            c => !driveCodeSet.has(String(c.code).trim())
                        );
                        // Limpiar y volver a poner: Drive + local-only
                        await this.db.clearStore('clients');
                        await this.db.bulkPut('clients', [...clients, ...localOnlyClients]);
                        resolve({ success: true, count: clients.length, preserved: localOnlyClients.length });
                    } else {
                        const foundKeys = rawData.length > 0 ? Object.keys(rawData[0]).join(', ') : 'Ninguna';
                        resolve({
                            success: false,
                            message: `No se encontraron clientes validos. Columnas detectadas: [${foundKeys}].`
                        });
                    }
                } catch (error) {
                    console.error("Error parsing Excel", error);
                    reject(error);
                }
            };

            if (input instanceof File) {
                const reader = new FileReader();
                reader.onload = (e) => processData(new Uint8Array(e.target.result));
                reader.readAsArrayBuffer(input);
            } else if (input instanceof Uint8Array || input instanceof ArrayBuffer) {
                processData(new Uint8Array(input));
            } else {
                reject(new Error("Formato de entrada no soportado"));
            }
        });
    }

    _getColumnMap(headerRow) {
        const map = {};
        if (!headerRow) return map;

        headerRow.forEach((val, idx) => {
            const clean = String(val || '').trim().toUpperCase();
            if (['CODIGO', 'CÓDIGO'].includes(clean)) map.code = idx;
            else if (['TIENDA', 'NOMBRE', 'CLIENTE'].includes(clean)) map.name = idx;
            else if (['NIF', 'DNI'].includes(clean)) map.nif = idx;
            else if (['MAIL', 'EMAIL', 'CORREO'].includes(clean)) map.email = idx;
            else if (['DIRECCION', 'DIRECCIÓN'].includes(clean)) map.address = idx;
            else if (['CONTACTO'].includes(clean)) map.contact = idx;
            else if (['POBLACION', 'POBLACIÓN', 'CIUDAD'].includes(clean)) map.location = idx;
            else if (['PROVINCIA'].includes(clean)) map.province = idx;
            else if (['CP', 'C.P.'].includes(clean)) map.cp = idx;
            else if (['TELEFONO', 'TELÉFONO', 'MOVIL'].includes(clean)) map.phone = idx;
            else if (['TELEFONO 2', 'TELÉFONO 2', 'MOVIL 2'].includes(clean)) map.phone2 = idx;
            else if (['HORARIO', 'HORARIOS', 'SCHEDULE'].includes(clean)) map.schedule = idx;
            else if (['LATITUD', 'LAT'].includes(clean)) map.lat = idx;
            else if (['LONGITUD', 'LNG', 'LON'].includes(clean)) map.lng = idx;
        });

        const defaults = {
            code: 0, name: 1, nif: 2, email: 3, address: 4, contact: 5,
            location: 6, province: 7, cp: 8, phone: 9, schedule: 10,
            lat: 21, lng: 22, phone2: 23
        };

        Object.keys(defaults).forEach(key => {
            if (map[key] === undefined) map[key] = defaults[key];
        });

        return map;
    }

    _cleanAndSortRows(rows) {
        if (!rows || rows.length === 0) return [];

        // 1. Encontrar la cabecera real (la primera fila que tiene "CODIGO" o "CÓDIGO")
        // Habitualmente es la fila 0, pero buscamos por si acaso hay basura arriba
        let headerIndex = -1;
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
            const rowStr = JSON.stringify(rows[i]).toUpperCase();
            if (rowStr.includes('"CODIGO"') || rowStr.includes('"CÓDIGO"')) {
                headerIndex = i;
                break;
            }
        }

        // Si no se encuentra, asumimos la primera fila como cabecera por defecto
        if (headerIndex === -1) headerIndex = 0;

        const headerRow = rows[headerIndex];
        const colMap = this._getColumnMap(headerRow);

        // 2. Extraer datos (filas por debajo de la cabecera)
        let dataRows = rows.slice(headerIndex + 1);

        // 3. REGLA: Eliminar si A y B están vacíos. Guardar si alguno tiene carácter.
        // Columna A = colMap.code, Columna B = colMap.name
        dataRows = dataRows.filter(r => {
            if (!Array.isArray(r)) return false;
            const colA = String(r[colMap.code] || '').trim();
            const colB = String(r[colMap.name] || '').trim();
            return colA !== '' || colB !== ''; // Conservar si alguno tiene datos
        });

        // 4. Limpieza de trailing cells (evita ghost columns)
        dataRows = dataRows.map(r => {
            const cleaned = r.map(cell => typeof cell === 'string' ? cell.trim() : cell);
            // Cortar el array al último elemento que tenga algo para no engordar el Excel
            let lastIdx = -1;
            for (let i = cleaned.length - 1; i >= 0; i--) {
                if (cleaned[i] !== '' && cleaned[i] !== null && cleaned[i] !== undefined) {
                    lastIdx = i;
                    break;
                }
            }
            return lastIdx === -1 ? [] : cleaned.slice(0, lastIdx + 1);
        });

        // 5. Ordenar alfabéticamente por Población (Columna G / colMap.location)
        dataRows.sort((a, b) => {
            const valA = (a[colMap.location] || "").toString().toLowerCase().trim();
            const valB = (b[colMap.location] || "").toString().toLowerCase().trim();
            if (valA === valB) {
                // Si la población es igual, ordenar por Nombre
                const nameA = (a[colMap.name] || "").toString().toLowerCase().trim();
                const nameB = (b[colMap.name] || "").toString().toLowerCase().trim();
                return nameA.localeCompare(nameB);
            }
            return valA.localeCompare(valB);
        });

        // 6. Devolver con la cabecera en el primer puesto (Fila 1 real)
        return [headerRow, ...dataRows];
    }

    async _safeFetchJson(url, options = {}) {
        const response = await fetch(url, options);
        const text = await response.text();
        if (!text || text.trim() === '') {
            throw new Error("El servidor devolvió una respuesta vacía.");
        }
        if (text.trim().startsWith('<') || text.includes('<!DOCTYPE') || text.includes('<html')) {
            throw new Error("El servidor de Google Apps Script devolvió una página HTML en lugar de JSON. Verifica la URL configurada y los permisos del script.");
        }
        try {
            return JSON.parse(text);
        } catch (e) {
            throw new Error("Respuesta no válida del servidor: " + text.slice(0, 100));
        }
    }

    async saveNewClientToDrive(url, filename, newClientData) {
        // 1. Guardar primero en la BD local (IndexedDB)
        try {
            await this.db.put('clients', {
                code: newClientData.code,
                name: newClientData.name,
                nif: newClientData.nif,
                email: newClientData.email,
                address: newClientData.address,
                contact: newClientData.contact,
                location: newClientData.location,
                province: newClientData.province,
                cp: newClientData.cp,
                phone: newClientData.phone,
                phone2: newClientData.phone2 || "",
                schedule: newClientData.schedule || "",
                lat: newClientData.lat,
                lng: newClientData.lng,
                createdAt: new Date().toISOString()
            });
        } catch (localErr) {
            console.error("Error guardando cliente localmente:", localErr);
            return { success: false, message: "No se pudo guardar en la base de datos local: " + localErr.message };
        }

        // 2. Intentar guardar en Google Drive
        try {
            if (!url) throw new Error("URL de Google Drive no configurada");

            const json = await this._safeFetchJson(`${url}?action=get&filename=${encodeURIComponent(filename)}`);
            if (json.status !== 'success' || !json.data) {
                throw new Error(json.message || "No se pudo descargar el archivo de Drive.");
            }

            const binaryString = atob(json.data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

            const workbook = XLSX.read(bytes, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            let rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
            rows = this._cleanAndSortRows(rows);

            const headerRow = rows[0] || [];
            const colMap = this._getColumnMap(headerRow);

            const maxIdx = Math.max(...Object.values(colMap), 22);
            const newRow = new Array(maxIdx + 1).fill("");

            newRow[colMap.code] = newClientData.code;
            newRow[colMap.name] = newClientData.name;
            newRow[colMap.nif] = newClientData.nif;
            newRow[colMap.email] = newClientData.email;
            newRow[colMap.address] = newClientData.address;
            newRow[colMap.contact] = newClientData.contact;
            newRow[colMap.location] = newClientData.location;
            newRow[colMap.province] = newClientData.province;
            newRow[colMap.cp] = newClientData.cp;
            newRow[colMap.phone] = newClientData.phone;
            if (colMap.phone2 !== undefined) newRow[colMap.phone2] = newClientData.phone2 || "";
            newRow[colMap.schedule] = newClientData.schedule;
            newRow[colMap.lat] = newClientData.lat;
            newRow[colMap.lng] = newClientData.lng;

            rows.push(newRow);

            const header = rows.shift();
            rows.sort((a, b) => {
                const valA = (a[colMap.location] || "").toString().toLowerCase();
                const valB = (b[colMap.location] || "").toString().toLowerCase();
                return valA.localeCompare(valB);
            });
            rows.unshift(header);

            const newWorksheet = XLSX.utils.aoa_to_sheet(rows);
            workbook.Sheets[firstSheetName] = newWorksheet;
            const wbOut = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });

            const uploadJson = await this._safeFetchJson(url + '?action=save&filename=' + encodeURIComponent(filename), {
                method: 'POST',
                body: wbOut
            });

            if (uploadJson.status === 'success') {
                return { success: true, driveSynced: true };
            } else {
                throw new Error(uploadJson.message || "Error al subir a Drive");
            }

        } catch (driveErr) {
            console.warn("Cliente guardado en local, pero no se pudo sincronizar en Drive:", driveErr);
            return {
                success: true,
                driveSynced: false,
                warning: `Guardado en el dispositivo. No se pudo sincronizar con Google Drive (${driveErr.message})`
            };
        }
    }

    async updateClientInDrive(url, filename, originalCode, updatedData) {
        // 1. Guardar primero en la BD local (IndexedDB)
        try {
            if (String(originalCode) !== String(updatedData.code)) {
                await this.db.delete('clients', originalCode);
            }

            await this.db.put('clients', {
                code: updatedData.code,
                name: updatedData.name,
                nif: updatedData.nif,
                email: updatedData.email,
                address: updatedData.address,
                contact: updatedData.contact,
                location: updatedData.location,
                province: updatedData.province,
                cp: updatedData.cp,
                phone: updatedData.phone,
                phone2: updatedData.phone2 || "",
                schedule: updatedData.schedule || "",
                lat: updatedData.lat,
                lng: updatedData.lng,
                createdAt: new Date().toISOString()
            });
        } catch (localErr) {
            console.error("Error actualizando cliente localmente:", localErr);
            return { success: false, message: "No se pudo actualizar en la base de datos local: " + localErr.message };
        }

        // 2. Intentar actualizar en Google Drive
        try {
            if (!url) throw new Error("URL de Google Drive no configurada");

            const json = await this._safeFetchJson(`${url}?action=get&filename=${encodeURIComponent(filename)}`);
            if (json.status !== 'success' || !json.data) throw new Error(json.message || "No se pudo descargar el archivo de Drive.");

            const binaryString = atob(json.data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

            const workbook = XLSX.read(bytes, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            let rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
            rows = this._cleanAndSortRows(rows);

            const headerRow = rows[0] || [];
            const colMap = this._getColumnMap(headerRow);

            let rowIndex = -1;
            for (let i = 1; i < rows.length; i++) {
                // Comparar como strings ignorando espacios y diferencias de tipo (número vs string)
                if (String(rows[i][colMap.code]).trim().toLowerCase() === String(originalCode).trim().toLowerCase()) {
                    rowIndex = i;
                    break;
                }
            }

            // Si no se encuentra en Drive, el cliente solo existía en local (sync fallido anterior).
            // Lo tratamos como inserción nueva para que quede sincronizado.
            if (rowIndex === -1) {
                const maxIdxNew = Math.max(...Object.values(colMap), 22);
                const newRow = new Array(maxIdxNew + 1).fill("");
                newRow[colMap.code]     = updatedData.code;
                newRow[colMap.name]     = updatedData.name;
                newRow[colMap.nif]      = updatedData.nif;
                newRow[colMap.email]    = updatedData.email;
                newRow[colMap.address]  = updatedData.address;
                newRow[colMap.contact]  = updatedData.contact;
                newRow[colMap.location] = updatedData.location;
                newRow[colMap.province] = updatedData.province;
                newRow[colMap.cp]       = updatedData.cp;
                newRow[colMap.phone]    = updatedData.phone;
                if (colMap.phone2 !== undefined) newRow[colMap.phone2] = updatedData.phone2 || "";
                newRow[colMap.schedule] = updatedData.schedule;
                newRow[colMap.lat]      = updatedData.lat;
                newRow[colMap.lng]      = updatedData.lng;
                rows.push(newRow);

                // Ordenar (sin cabecera) y recomponer
                const hdr = rows.shift();
                rows.sort((a, b) => {
                    const valA = (a[colMap.location] || "").toString().toLowerCase();
                    const valB = (b[colMap.location] || "").toString().toLowerCase();
                    return valA.localeCompare(valB);
                });
                rows.unshift(hdr);

                const wsNew = XLSX.utils.aoa_to_sheet(rows);
                workbook.Sheets[firstSheetName] = wsNew;
                const wbOutNew = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
                const uploadNew = await this._safeFetchJson(url + '?action=save&filename=' + encodeURIComponent(filename), {
                    method: 'POST',
                    body: wbOutNew
                });
                if (uploadNew.status === 'success') {
                    return { success: true, driveSynced: true };
                } else {
                    throw new Error(uploadNew.message || "Error al subir a Drive");
                }
            }

            const maxIdx = Math.max(...Object.values(colMap), 22);
            if (!Array.isArray(rows[rowIndex])) rows[rowIndex] = new Array(maxIdx + 1).fill("");

            rows[rowIndex][colMap.code] = updatedData.code;
            rows[rowIndex][colMap.name] = updatedData.name;
            rows[rowIndex][colMap.nif] = updatedData.nif;
            rows[rowIndex][colMap.email] = updatedData.email;
            rows[rowIndex][colMap.address] = updatedData.address;
            rows[rowIndex][colMap.contact] = updatedData.contact;
            rows[rowIndex][colMap.location] = updatedData.location;
            rows[rowIndex][colMap.province] = updatedData.province;
            rows[rowIndex][colMap.cp] = updatedData.cp;
            rows[rowIndex][colMap.phone] = updatedData.phone;
            if (colMap.phone2 !== undefined) rows[rowIndex][colMap.phone2] = updatedData.phone2 || "";
            rows[rowIndex][colMap.schedule] = updatedData.schedule;
            rows[rowIndex][colMap.lat] = updatedData.lat;
            rows[rowIndex][colMap.lng] = updatedData.lng;

            const header = rows.shift();
            rows.sort((a, b) => {
                const valA = (a[colMap.location] || "").toString().toLowerCase();
                const valB = (b[colMap.location] || "").toString().toLowerCase();
                return valA.localeCompare(valB);
            });
            rows.unshift(header);

            const newWorksheet = XLSX.utils.aoa_to_sheet(rows);
            workbook.Sheets[firstSheetName] = newWorksheet;
            const wbOut = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });

            const uploadJson = await this._safeFetchJson(url + '?action=save&filename=' + encodeURIComponent(filename), {
                method: 'POST',
                body: wbOut
            });

            if (uploadJson.status === 'success') {
                return { success: true, driveSynced: true };
            } else {
                throw new Error(uploadJson.message || "Error al actualizar en Drive");
            }

        } catch (driveErr) {
            console.warn("Cliente guardado en local, pero no se pudo sincronizar en Drive:", driveErr);
            return {
                success: true,
                driveSynced: false,
                warning: `Guardado en el dispositivo. No se pudo sincronizar con Google Drive (${driveErr.message})`
            };
        }
    }

    async deleteClientFromDrive(url, filename, clientCode) {
        // 1. Eliminar localmente en BD primero
        try {
            await this.db.delete('clients', clientCode);
        } catch (localErr) {
            console.error("Error eliminando cliente localmente:", localErr);
            return { success: false, message: "No se pudo eliminar en el dispositivo: " + localErr.message };
        }

        // 2. Eliminar en Google Drive
        try {
            if (!url) throw new Error("URL de Google Drive no configurada");

            const json = await this._safeFetchJson(`${url}?action=get&filename=${encodeURIComponent(filename)}`);
            if (json.status !== 'success' || !json.data) throw new Error(json.message || "No se pudo descargar el archivo de Drive.");

            const binaryString = atob(json.data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

            const workbook = XLSX.read(bytes, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            let rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

            rows = this._cleanAndSortRows(rows);
            const headerRow = rows[0] || [];
            const colMap = this._getColumnMap(headerRow);

            const header = rows.shift();
            const initialLen = rows.length;

            rows = rows.filter(r => String(r[colMap.code]).trim() !== String(clientCode).trim());

            if (rows.length === initialLen) throw new Error("Cliente no encontrado en el archivo de Drive.");

            rows.unshift(header);
            rows = this._cleanAndSortRows(rows);

            const newWorksheet = XLSX.utils.aoa_to_sheet(rows);
            workbook.Sheets[firstSheetName] = newWorksheet;
            const wbOut = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });

            const uploadJson = await this._safeFetchJson(url + '?action=save&filename=' + encodeURIComponent(filename), {
                method: 'POST',
                body: wbOut
            });

            if (uploadJson.status === 'success') {
                return { success: true, driveSynced: true };
            } else {
                throw new Error(uploadJson.message || "Error al eliminar de Drive");
            }

        } catch (driveErr) {
            console.warn("Cliente eliminado localmente pero falló eliminación en Drive:", driveErr);
            return {
                success: true,
                driveSynced: false,
                warning: `Eliminado del dispositivo. No se pudo sincronizar la eliminación con Google Drive (${driveErr.message})`
            };
        }
    }

    async importFromDrive(url, filename) {
        try {
            if (!url) throw new Error("URL de Google Drive no configurada");

            const json = await this._safeFetchJson(`${url}?action=get&filename=${encodeURIComponent(filename)}`);

            if (json.status === 'success' && json.data) {
                const binaryString = atob(json.data);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                return await this.importClientsFromExcel(bytes);
            } else {
                throw new Error(json.message || 'Error al descargar el archivo de Drive');
            }
        } catch (error) {
            console.error("Error en importFromDrive", error);
            return { success: false, message: error.message };
        }
    }

    // --- ORDERS (PEDIDOS) ---
    async getOrders() {
        const orders = await this.db.getAll('orders');
        // Ordenar por fecha descendente
        return orders.sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO));
    }

    async createOrder(orderData) {
        // orderData: { clientCode, shopName, amount, dateString (DD/MM/YYYY), ... }

        // Create Order 
        // orderData.date comes from <input type="date"> which is YYYY-MM-DD
        // We need to store it as is for dateISO, or parse if needed.
        // Previously we split by '/' assuming Spanish format, but input date gives '2026-01-20'.

        // If it comes from Excel import it might be different, but from Modal is YYYY-MM-DD.
        let dateISO = orderData.date;

        // If it happens to be DD/MM/YYYY
        if (dateISO.includes('/') && !dateISO.includes('-')) {
            const [day, month, year] = dateISO.split('/');
            dateISO = `${year}-${month}-${day}`;
        }

        // No need to redeclare 'dateISO' if we use 'orderData.dateISO' equivalent inside newOrder
        // But 'orderData' has 'date'. Let's ensure consistency.

        const newOrder = {
            ...orderData,
            dateISO,
            createdAt: new Date().toISOString()
        };

        return await this.db.put('orders', newOrder);
    }

    async deleteOrder(id) {
        // ID must be string matching key
        return await this.db.delete('orders', String(id));
    }

    async getOrderById(id) {
        const orders = await this.getOrders();
        // ID is string in DB usually.
        return orders.find(o => String(o.id) === String(id));
    }

    // --- DASHBOARD STATS ---
    async getDashStats(targetMonth, targetYear) {
        const orders = await this.getOrders();
        const clients = await this.getClients();

        const now = new Date();
        const currentMonth = (targetMonth !== undefined) ? targetMonth : now.getMonth();
        const currentYear = (targetYear !== undefined) ? targetYear : now.getFullYear();

        // Ventas del mes
        const ordersThisMonth = orders.filter(o => {
            const dateStr = o.dateISO || o.date;
            return getMonthFromDate(dateStr) === currentMonth && getYearFromDate(dateStr) === currentYear;
        });

        // Ventas mismo mes año anterior (YoY)
        const ordersLastYearMonth = orders.filter(o => {
            const dateStr = o.dateISO || o.date;
            return getMonthFromDate(dateStr) === currentMonth && getYearFromDate(dateStr) === (currentYear - 1);
        });

        // Filtrar solo pedidos con importe > 0 para la estadística de pedidos y media
        const ordersThisMonthValued = ordersThisMonth.filter(o => (parseFloat(o.amount) || 0) > 0);

        const totalVentasMes = ordersThisMonth.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
        
        // Obtener ventas del año anterior desde el historial consolidado
        const salesHistory = await this.getSalesHistory();
        const prevYear = currentYear - 1;
        const totalVentasMesAnteriorAnio = (salesHistory[prevYear] && salesHistory[prevYear][currentMonth]) || 0;

        // Ventas del año (hasta el mes seleccionado)
        const ordersThisYear = orders.filter(o => {
            const dateStr = o.dateISO || o.date;
            const y = getYearFromDate(dateStr);
            const m = getMonthFromDate(dateStr);
            return y === currentYear && m <= currentMonth;
        });
        const totalVentasAnio = ordersThisYear.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
        const ordersThisYearValued = ordersThisYear.filter(o => (parseFloat(o.amount) || 0) > 0);

        // Clientes activos (MES seleccionado)
        const activeClientsSet = new Set();
        ordersThisMonth.forEach(o => {
            activeClientsSet.add(o.clientCode || o.shop);
        });

        // Top Clientes del mes seleccionado
        const clientSales = {};
        ordersThisMonth.forEach(o => {
            if (!clientSales[o.shop]) clientSales[o.shop] = 0;
            clientSales[o.shop] += parseFloat(o.amount);
        });

        const topClientes = Object.entries(clientSales)
            .map(([name, amount]) => ({ name, amount, rank: 0 }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 20)
            .map((item, index) => ({ ...item, rank: index + 1 }));

        // Objetivos (Dinamizados para el mes seleccionado)
        const goals = await this.getDetailedGoals();
        const monthIdx = currentMonth;

        let targetAmount = goals.data3[monthIdx];
        if (totalVentasMes >= goals.data4[monthIdx]) {
            targetAmount = goals.data5[monthIdx];
        } else if (totalVentasMes >= goals.data3[monthIdx]) {
            targetAmount = goals.data4[monthIdx];
        }

        // 12-Month Trend Logic (Relativa al mes seleccionado)
        const tendencia = [];
        const MONTHS_TO_SHOW = 12;
        for (let i = MONTHS_TO_SHOW - 1; i >= 0; i--) {
            const d = new Date(currentYear, currentMonth - i, 1);
            const mIdx = d.getMonth();
            const yInfo = d.getFullYear();
            const monthLabel = d.toLocaleString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');

            const sum = orders.reduce((acc, o) => {
                const dateStr = o.dateISO || o.date;
                if (getMonthFromDate(dateStr) === mIdx && getYearFromDate(dateStr) === yInfo) {
                    return acc + (parseFloat(o.amount) || 0);
                }
                return acc;
            }, 0);

            const sumAnterior = (salesHistory[yInfo - 1] && salesHistory[yInfo - 1][mIdx]) || 0;

            tendencia.push({ 
                mes: monthLabel, 
                ventas: sum,
                ventasAnterior: sumAnterior
            });
        }

        return {
            currentMonth,
            currentYear,
            ventasMes: {
                total: totalVentasMes,
                totalAnterior: totalVentasMesAnteriorAnio,
                objetivo: targetAmount,
                porcentaje: ((totalVentasMes / targetAmount) * 100).toFixed(1),
                thresholds: {
                    p3: goals.data3[monthIdx],
                    p4: goals.data4[monthIdx],
                    p5: goals.data5[monthIdx]
                }
            },
            stats: {
                clientesActivos: activeClientsSet.size,
                pedidosMes: ordersThisMonthValued.length,
                pedidosAnio: ordersThisYearValued.length
            },
            ventasAnio: {
                total: totalVentasAnio
            },
            topClientes,
            tendencia
        };
    }


    // --- YEARLY RANKING ---
    async getYearlyRanking(year = new Date().getFullYear(), sortBy = 'amount') {
        const orders = await this.getOrders();

        // 1. Filter orders for specified year
        const yearlyOrders = orders.filter(o => {
            const d = new Date(o.dateISO || o.date);
            return d.getFullYear() === year;
        });

        // 2. Aggregate sales and order count by client
        const clientStats = {};
        yearlyOrders.forEach(o => {
            const key = o.shop;
            if (!clientStats[key]) clientStats[key] = { amount: 0, orderCount: 0 };
            const amt = parseFloat(o.amount) || 0;
            clientStats[key].amount += amt;
            if (amt > 0) clientStats[key].orderCount += 1;
        });

        // 3. Convert to array and sort
        const ranking = Object.entries(clientStats)
            .map(([name, stats]) => ({ name, ...stats }))
            .sort((a, b) => {
                if (sortBy === 'orders') {
                    // Mas pedidos primero. Si son iguales, mas importe primero.
                    if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount;
                    return b.amount - a.amount;
                } else {
                    // Mas importe primero.
                    return b.amount - a.amount;
                }
            })
            .map((item, index) => ({ ...item, rank: index + 1 }));

        return ranking;
    }

    // --- SALES HISTORY (FACTURACION) ---
    async getSalesHistory() {
        // Stored in config as 'sales_history'
        const stored = await this.db.get('config', 'sales_history');
        if (stored && stored.data) return stored.data;

        // Default Data (Preserving historical data provided)
        return {
            "2023": [20207, 48128, 67578, 29569, 51373, 72568, 73656, 77855, 49961, 26468, 18464, 3036],
            "2024": [27667, 53783, 42963, 43800, 64598, 70680, 83019, 82068, 58964, 43046, 22965, 6994],
            "2025": [18099, 57630, 56677, 38101, 58432, 69221, 84573, 80152, 46201, 54948, 20138, 4717],
            "2026": Array(12).fill(0)
        };
    }

    async saveSalesHistory(year, monthIndex, value) {
        let history = await this.getSalesHistory();
        if (!history[year]) history[year] = Array(12).fill(0);

        history[year][monthIndex] = parseFloat(value) || 0;

        await this.db.put('config', { key: 'sales_history', data: history });
        return history;
    }

    async checkAndAutoFillSales() {
        const now = new Date();
        const d = now.getDate();
        const m = now.getMonth(); // 0-11
        const y = now.getFullYear();

        let targetMonth = -1;
        let targetYear = y;

        // Lógica de disparo:
        // 1. A partir del 23 de diciembre -> Rellenar Diciembre (m=11)
        if (m === 11 && d >= 23) {
            targetMonth = 11;
        }
        // 2. A partir del día 1 de cada mes (Feb-Dic) -> Rellenar mes anterior
        else if (d >= 1 && m > 0) {
            targetMonth = m - 1;
        }
        // Nota: Enero no dispara nada porque Diciembre se hizo el 23 Dic.

        if (targetMonth === -1) return;

        // Comprobar si ya se hizo para este mes/año
        const autofillKey = `autofill_done_${targetYear}_${targetMonth}`;
        const alreadyDone = await this.db.get('config', autofillKey);
        if (alreadyDone) return;

        console.log(`[AutoFill] Detectado gatillo para ${targetMonth + 1}/${targetYear}. Calculando pedidos...`);

        // Calcular suma de pedidos del mes objetivo
        const orders = await this.getOrders();
        const totalAmount = orders.reduce((sum, o) => {
            const oDate = new Date(o.dateISO || o.date);
            if (oDate.getFullYear() === targetYear && oDate.getMonth() === targetMonth) {
                return sum + (parseFloat(o.amount) || 0);
            }
            return sum;
        }, 0);

        // Guardar en el historial de ventas
        await this.saveSalesHistory(targetYear, targetMonth, totalAmount);

        // Marcar como completado
        await this.db.put('config', { key: autofillKey, done: true, timestamp: now.toISOString(), amount: totalAmount });
        console.log(`[AutoFill] Completado: ${totalAmount}€ para el mes ${targetMonth + 1}`);
    }

    // --- INVOICE HISTORY (FACTURA REAL) ---
    async getInvoiceHistory() {
        const stored = await this.db.get('config', 'invoice_history');
        if (stored && stored.data) return stored.data;

        // Default Data for Factura (Start empty or with defaults)
        return {
            "2023": [20207, 48128, 67578, 29569, 51373, 72568, 73656, 77855, 49961, 26468, 18464, 3036],
            "2024": [27667, 53783, 42963, 43800, 64598, 70680, 83019, 82068, 58964, 43046, 22965, 6994],
            "2025": [18099, 57630, 56677, 38101, 58432, 69221, 84573, 80152, 46201, 54948, 20138, 4717],
            "2026": Array(12).fill(0)
        };
    }

    async saveInvoiceHistory(year, monthIndex, value) {
        let history = await this.getInvoiceHistory();
        if (!history[year]) history[year] = Array(12).fill(0);

        history[year][monthIndex] = parseFloat(value) || 0;

        await this.db.put('config', { key: 'invoice_history', data: history });
        return history;
    }

    async exportFullBackup() {
        // Recolectar todos los datos de todas las tablas
        const clients = await this.db.getAll('clients');
        const orders = await this.db.getAll('orders');
        const departments = await this.db.getAll('departments');
        const config = await this.db.getAll('config'); // Exportamos TODA la tabla de configuración

        const backupData = {
            timestamp: new Date().toISOString(),
            appVersion: '1.1',
            clients,
            orders,
            departments,
            config 
        };

        return backupData;
    }

    async restoreFullBackup(data) {
        // data structure expected: { clients: [], orders: [], config: {}, sales_history: {}, departments: [] }
        // or a similar structure wrapped in a payload { action: '...', data: { ... } }

        console.log("Restoring backup...", data);

        if (!data) throw new Error("No data received");

        // Soporte para datos envueltos (Payload de Drive)
        if (!data.orders && !data.clients && data.data) {
            console.log("Detectado backup envuelto en propiedad 'data', desempaquetando...");
            data = data.data;
        }

        // 1. Clear and Restore Clients
        if (data.clients && Array.isArray(data.clients) && data.clients.length > 0) {
            await this.db.clearStore('clients');
            await this.db.bulkPut('clients', data.clients);
        }

        // 2. Clear and Restore Orders
        if (data.orders && Array.isArray(data.orders) && data.orders.length > 0) {
            await this.db.clearStore('orders');
            await this.db.bulkPut('orders', data.orders);
        }

        // 3. Clear and Restore Departments
        if (data.departments && Array.isArray(data.departments) && data.departments.length > 0) {
            await this.db.clearStore('departments');
            await this.db.bulkPut('departments', data.departments);
        }

        // 4. Restaurar Configuración (Objetivos, Históricos, Ajustes)
        if (data.config) {
            if (Array.isArray(data.config)) {
                for (const item of data.config) {
                    if (item && item.key) await this.db.put('config', item);
                }
            } else if (data.config.goals) {
                await this.db.put('config', { key: 'goals', ...data.config.goals });
            }
        }

        // Compatibilidad con backups antiguos (claves fuera de config)
        if (data.sales_history) await this.db.put('config', { key: 'sales_history', data: data.sales_history });
        if (data.invoice_history) await this.db.put('config', { key: 'invoice_history', data: data.invoice_history });
        if (data.quarterly_goals) await this.db.put('config', { key: 'quarterly_goals', data: data.quarterly_goals });

        return { success: true };
    }
    // --- EXCEL BACKUP (LOCAL) ---
    async exportBackupToExcel() {
        try {
            const wb = XLSX.utils.book_new();

            // 1. Clients Sheet
            const clients = await this.getClients();
            if (clients && clients.length > 0) {
                const wsClients = XLSX.utils.json_to_sheet(clients);
                XLSX.utils.book_append_sheet(wb, wsClients, "Clientes");
            }

            // 2. Orders Sheet
            const orders = await this.getOrders();
            if (orders && orders.length > 0) {
                const wsOrders = XLSX.utils.json_to_sheet(orders);
                XLSX.utils.book_append_sheet(wb, wsOrders, "Pedidos");
            }

            // 2.1 Departments Sheet
            const departments = await this.getDepartamentos();
            if (departments && departments.length > 0) {
                const wsDepts = XLSX.utils.json_to_sheet(departments);
                XLSX.utils.book_append_sheet(wb, wsDepts, "Departamentos");
            }

            // 3. Goal & History (Config)
            // Flatten config into a key-value pair sheet or JSON string
            const goals = await this.db.get('config', 'goals');
            const salesHistory = await this.db.get('config', 'sales_history');
            const invoiceHistory = await this.db.get('config', 'invoice_history'); // Also export Invoice History

            const configData = [
                { key: 'goals', value: JSON.stringify(goals || {}) },
                { key: 'sales_history', value: JSON.stringify(salesHistory || {}) },
                { key: 'invoice_history', value: JSON.stringify(invoiceHistory || {}) }
            ];
            const wsConfig = XLSX.utils.json_to_sheet(configData);
            XLSX.utils.book_append_sheet(wb, wsConfig, "Config");

            // Save File
            XLSX.writeFile(wb, `Backup_Ventas_${new Date().toISOString().slice(0, 10)}.xlsx`);
            return { success: true };

        } catch (error) {
            console.error("Export Error", error);
            return { success: false, message: error.message };
        }
    }

    async exportBackupToExcelDrive(url) {
        try {
            if (!url) throw new Error("URL de Google Drive no configurada.");
            const wb = XLSX.utils.book_new();

            const clients = await this.getClients();
            if (clients && clients.length > 0) {
                const wsClients = XLSX.utils.json_to_sheet(clients);
                XLSX.utils.book_append_sheet(wb, wsClients, "Clientes");
            }

            const orders = await this.getOrders();
            if (orders && orders.length > 0) {
                const wsOrders = XLSX.utils.json_to_sheet(orders);
                XLSX.utils.book_append_sheet(wb, wsOrders, "Pedidos");
            }

            const departments = await this.getDepartamentos();
            if (departments && departments.length > 0) {
                const wsDepts = XLSX.utils.json_to_sheet(departments);
                XLSX.utils.book_append_sheet(wb, wsDepts, "Departamentos");
            }

            const goals = await this.db.get('config', 'goals');
            const salesHistory = await this.db.get('config', 'sales_history');
            const invoiceHistory = await this.db.get('config', 'invoice_history');

            const configData = [
                { key: 'goals', value: JSON.stringify(goals || {}) },
                { key: 'sales_history', value: JSON.stringify(salesHistory || {}) },
                { key: 'invoice_history', value: JSON.stringify(invoiceHistory || {}) }
            ];
            const wsConfig = XLSX.utils.json_to_sheet(configData);
            XLSX.utils.book_append_sheet(wb, wsConfig, "Config");

            const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
            const filename = `Backup_Ventas_${new Date().toISOString().slice(0, 10)}.xlsx`;

            const uploadJson = await this._safeFetchJson(url + '?action=save&filename=' + encodeURIComponent(filename), {
                method: 'POST',
                body: wbOut
            });

            if (uploadJson.status === 'success' || uploadJson.success) {
                return { success: true, filename };
            } else {
                throw new Error(uploadJson.message || "Error al guardar el archivo Excel en Drive");
            }

        } catch (error) {
            console.error("Export Excel to Drive Error", error);
            return { success: false, message: error.message };
        }
    }

    async importBackupFromExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const wb = XLSX.read(data, { type: 'array' });

                    // 1. Restore Clients
                    if (wb.SheetNames.includes("Clientes")) {
                        const ws = wb.Sheets["Clientes"];
                        const clients = XLSX.utils.sheet_to_json(ws);
                        if (clients.length > 0) {
                            await this.db.clearStore('clients');
                            await this.db.bulkPut('clients', clients);
                        }
                    }

                    // 2. Restore Orders
                    if (wb.SheetNames.includes("Pedidos")) {
                        const ws = wb.Sheets["Pedidos"];
                        const rawOrders = XLSX.utils.sheet_to_json(ws);
                        if (rawOrders.length > 0) {
                            const normalizedOrders = rawOrders.map(o => {
                                const displayId = o["Nº Pedido"] !== undefined ? parseInt(o["Nº Pedido"], 10) : (o["displayId"] !== undefined ? parseInt(o["displayId"], 10) : parseInt(String(o.id || "").split('-').pop(), 10) || 0);
                                const dateVal = o["Fecha"] || o["dateISO"] || o["date"];
                                const shopVal = o["Cliente"] || o["shop"] || "";
                                const amountVal = parseFloat(o["Importe"] !== undefined ? o["Importe"] : o["amount"]) || 0;
                                const commentsVal = o["Comentarios"] || o["comments"] || "";
                                
                                let isNewClient = false;
                                if (o["Nuevo Cliente?"] !== undefined) {
                                    isNewClient = o["Nuevo Cliente?"] === "SI" || o["Nuevo Cliente?"] === true;
                                } else if (o["persistedIsNewClient"] !== undefined) {
                                    isNewClient = o["persistedIsNewClient"] === true || o["persistedIsNewClient"] === "true";
                                }

                                let normalizedDate = dateVal;
                                if (normalizedDate && normalizedDate.includes('/') && !normalizedDate.includes('-')) {
                                    const [day, month, year] = normalizedDate.split('/');
                                    normalizedDate = `${year}-${month}-${day}`;
                                }
                                if (normalizedDate && normalizedDate.includes('T')) {
                                    normalizedDate = normalizedDate.split('T')[0];
                                }

                                const yearVal = getYearFromDate(normalizedDate) || new Date().getFullYear();
                                const compositeId = `${yearVal}-${displayId}`;

                                return {
                                    id: compositeId,
                                    displayId,
                                    date: normalizedDate,
                                    dateISO: normalizedDate,
                                    shop: shopVal,
                                    amount: amountVal,
                                    comments: commentsVal,
                                    year: yearVal,
                                    persistedIsNewClient: isNewClient
                                };
                            });
                            await this.db.clearStore('orders');
                            await this.db.bulkPut('orders', normalizedOrders);
                        }
                    }

                    // 2.1 Restore Departments
                    if (wb.SheetNames.includes("Departamentos")) {
                        const ws = wb.Sheets["Departamentos"];
                        const departments = XLSX.utils.sheet_to_json(ws);
                        if (departments.length > 0) {
                            await this.db.clearStore('departments');
                            await this.db.bulkPut('departments', departments);
                        }
                    }

                    // 3. Restore Config
                    if (wb.SheetNames.includes("Config")) {
                        const ws = wb.Sheets["Config"];
                        const configRows = XLSX.utils.sheet_to_json(ws);

                        for (const row of configRows) {
                            if (row.key && row.value) {
                                try {
                                    const parsedVal = JSON.parse(row.value);
                                    // Special handling for keys that need 'key' property wrapper in DB if stored that way
                                    // In init(), we do: db.put('config', { key: 'goals', ...goalsData })
                                    // Here parsedVal is likely { key: 'goals', data3: ... } if we stringified the whole object.
                                    // Let's check if parsedVal has the key property or if we need to add it.

                                    if (row.key === 'goals' || row.key === 'sales_history' || row.key === 'invoice_history') {
                                        // Reuse the key from the row to ensure consistency
                                        // If parsedVal already has 'key', good. If not (unlikely if we exported standard way), we might need to add it.
                                        // Actually in export we did: value: JSON.stringify(goals)
                                        // 'goals' object from db.get('config', 'goals') ALREADY has { key: 'goals', ...rest }
                                        // so JSON.parse(row.value) returns the full object with key.
                                        await this.db.put('config', parsedVal);
                                    }

                                } catch (err) {
                                    console.warn("Error parsing config", row.key, err);
                                }
                            }
                        }
                    }

                    resolve({ success: true });

                } catch (error) {
                    console.error("Import Error", error);
                    resolve({ success: false, message: error.message });
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }
    async generateAnnualSummaryToDrive(year) {
        try {
            console.log(`Generando resumen anual ${year} para Drive...`);
            const wb = XLSX.utils.book_new();

            // --- HOJA 1: PEDIDOS ---
            const allOrders = await this.getOrders();
            const clients = await this.getClients();
            const clientMap = new Map(clients.map(c => [c.name, c]));

            const currentYearOrders = allOrders.filter(o => {
                return getYearFromDate(o.dateISO || o.date) === year;
            }).sort((a, b) => {
                const numA = a.displayId || parseInt(String(a.id).split('-').pop());
                const numB = b.displayId || parseInt(String(b.id).split('-').pop());
                return numA - numB;
            });

            const ordersSheetData = currentYearOrders.map(o => {
                const client = clientMap.get(o.shop || o["Cliente"]) || {};
                return {
                    "Nº Pedido": o.displayId || String(o.id).split('-').pop(),
                    "Fecha": o.dateISO || o.date,
                    "Cliente": o.shop || o["Cliente"],
                    "Importe": o.amount !== undefined ? o.amount : o["Importe"],
                    "Población": client.location || "---",
                    "Provincia": client.province || "---",
                    "Nuevo Cliente?": (o.persistedIsNewClient || o["Nuevo Cliente?"] === "SI") ? "SI" : "NO",
                    "Comentarios": o.comments || o["Comentarios"] || ""
                };
            });

            const wsOrders = XLSX.utils.json_to_sheet(ordersSheetData);
            XLSX.utils.book_append_sheet(wb, wsOrders, "Pedidos");

            // --- HOJA 2: RESUMEN POR PROVINCIA Y TOTALES ---
            const PROVINCES_TO_SHOW = ['ASTURIAS', 'CANTABRIA', 'LEÓN', 'GALICIA'];
            const statsByProv = {};
            PROVINCES_TO_SHOW.forEach(p => statsByProv[p] = { Provincia: p, "Ventas Totales": 0, "Nº Pedidos": 0, "Ticket Medio": 0 });

            let totalVentasYear = 0;
            currentYearOrders.forEach(o => {
                const amt = parseFloat(o.amount !== undefined ? o.amount : o["Importe"]) || 0;
                totalVentasYear += amt;
                const client = clientMap.get(o.shop || o["Cliente"]);
                if (client && client.province) {
                    let prov = client.province.trim().toUpperCase();
                    if (prov === 'LEON') prov = 'LEÓN';
                    if (prov === 'LUGO') prov = 'GALICIA';
                    if (prov === 'PALENCIA') prov = 'LEÓN';

                    if (statsByProv[prov]) {
                        statsByProv[prov]["Ventas Totales"] += amt;
                        statsByProv[prov]["Nº Pedidos"] += 1;
                    }
                }
            });

            PROVINCES_TO_SHOW.forEach(p => {
                if (statsByProv[p]["Nº Pedidos"] > 0) {
                    statsByProv[p]["Ticket Medio"] = statsByProv[p]["Ventas Totales"] / statsByProv[p]["Nº Pedidos"];
                }
            });

            const resumenData = Object.values(statsByProv);
            // Añadir fila de totales generales
            resumenData.push({ Provincia: "TOTAL GENERAL", "Ventas Totales": totalVentasYear, "Nº Pedidos": currentYearOrders.length, "Ticket Medio": totalVentasYear / currentYearOrders.length });

            // Clientes nuevos en el año
            const newClientsCount = currentYearOrders.filter(o => o.persistedIsNewClient || o["Nuevo Cliente?"] === "SI").length;
            resumenData.push({});
            resumenData.push({ Provincia: "Clientes Nuevos en el Año", "Ventas Totales": newClientsCount });

            const wsResumen = XLSX.utils.json_to_sheet(resumenData);
            XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen Provincias");

            // --- HOJA 3: RANKING CLIENTES ---
            const ranking = await this.getYearlyRanking(year);
            const rankingRows = ranking.map(r => ({
                "Puesto": r.rank,
                "Cliente": r.name,
                "Importe Total": r.amount
            }));
            const wsRanking = XLSX.utils.json_to_sheet(rankingRows);
            XLSX.utils.book_append_sheet(wb, wsRanking, "Ranking Clientes");

            // --- HOJA 4: VISTA FACTURA (HISTÓRICO) ---
            const invoiceHistory = await this.getInvoiceHistory();
            const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const facturaYears = Object.keys(invoiceHistory).sort();

            const facturaRows = months.map((m, mIdx) => {
                const row = { "MES": m };
                facturaYears.forEach(y => {
                    row[y] = invoiceHistory[y][mIdx] || 0;
                });
                return row;
            });
            const wsFactura = XLSX.utils.json_to_sheet(facturaRows);
            XLSX.utils.book_append_sheet(wb, wsFactura, "Vista Factura");

            // --- HOJA 5: VISTA VENTAS (HISTÓRICO) ---
            const salesHistory = await this.getSalesHistory();
            const salesYears = Object.keys(salesHistory).sort();

            const salesRows = months.map((m, mIdx) => {
                const row = { "MES": m };
                salesYears.forEach(y => {
                    row[y] = salesHistory[y][mIdx] || 0;
                });
                return row;
            });
            const wsSales = XLSX.utils.json_to_sheet(salesRows);
            XLSX.utils.book_append_sheet(wb, wsSales, "Vista Ventas");

            // --- ENVIO A DRIVE ---
            const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
            const filename = `Resumen_${year}.xlsx`;

            // Usar la URL constante que está en render.js o definirla aquí si es necesario
            // Como estamos en DataManager, es mejor pasarla o usar la que tengamos guardada en config
            const scriptUrl = localStorage.getItem('apps_script_url') || 
                (typeof DEFAULT_SCRIPT_URL !== 'undefined' ? DEFAULT_SCRIPT_URL : (typeof GOOGLE_SCRIPT_URL !== 'undefined' ? GOOGLE_SCRIPT_URL : ''));

            if (!scriptUrl) throw new Error("URL de Google Drive no configurada.");

            const uploadUrl = `${scriptUrl}?action=save&filename=${encodeURIComponent(filename)}`;
            const response = await fetch(uploadUrl, {
                method: 'POST',
                body: wbOut
            });

            const json = await response.json();
            if (json.status === 'success') {
                console.log(`Resumen ${year} guardado con éxito en Drive.`);
                return { success: true, filename };
            } else {
                throw new Error(json.message || "Error al subir resumen a Drive");
            }

        } catch (error) {
            console.error("Error generating annual summary:", error);
            return { success: false, message: error.message };
        }
    }

    async getVipClientsAtRisk() {
        try {
            const clients = await this.getClients();
            const orders = await this.getOrders();
            const today = new Date();

            const ordersByShop = {};
            orders.forEach(o => {
                const key = (o.shop || '').toLowerCase().trim();
                if (!ordersByShop[key]) ordersByShop[key] = [];
                ordersByShop[key].push(o);
            });

            const vipCandidates = [];

            clients.forEach(client => {
                const key = (client.name || '').toLowerCase().trim();
                const clientOrders = (ordersByShop[key] || [])
                    .filter(o => o.date || o.dateISO)
                    .map(o => ({
                        date: new Date(o.dateISO || o.date),
                        amount: parseFloat(o.amount) || 0
                    }))
                    .sort((a, b) => a.date - b.date);

                if (clientOrders.length === 0) return;

                const totalAmount = clientOrders.reduce((s, o) => s + o.amount, 0);
                const avgAmount = totalAmount / clientOrders.length;
                const lastOrder = clientOrders[clientOrders.length - 1];
                const daysSince = Math.floor((today - lastOrder.date) / (1000 * 60 * 60 * 24));

                let avgFreq = 90;
                if (clientOrders.length >= 2) {
                    const gaps = [];
                    for (let i = 1; i < clientOrders.length; i++) {
                        const diffDays = Math.floor((clientOrders[i].date - clientOrders[i - 1].date) / (1000 * 60 * 60 * 24));
                        if (diffDays > 0) gaps.push(diffDays);
                    }
                    if (gaps.length > 0) {
                        avgFreq = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
                    }
                }

                // Criterio VIP en riesgo: Alto volumen (avg >= 250€ o total >= 800€) y atrasado >= max(60, freq * 1.6)
                const isHighVolume = avgAmount >= 250 || totalAmount >= 800 || clientOrders.length >= 3;
                const minOverdueThreshold = Math.max(60, Math.round(avgFreq * 1.6));
                const isOverdue = daysSince >= minOverdueThreshold;

                if (isHighVolume && isOverdue) {
                    vipCandidates.push({
                        client,
                        name: client.name,
                        code: client.code,
                        phone: client.phone || '',
                        location: client.location || client.province || '',
                        avgAmount,
                        totalAmount,
                        orderCount: clientOrders.length,
                        lastOrderDate: lastOrder.date,
                        daysSince,
                        avgFreq,
                        overdueDays: daysSince - avgFreq
                    });
                }
            });

            vipCandidates.sort((a, b) => b.totalAmount - a.totalAmount);
            return vipCandidates.slice(0, 5);
        } catch (e) {
            console.error('Error calculando clientes VIP en riesgo:', e);
            return [];
        }
    }
}
// End DataManager

// Global Instance
const dataManager = new DataManager();

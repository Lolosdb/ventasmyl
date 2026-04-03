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

    // --- QUARTERLY GOALS (OBJETIVOS TRIMESTRALES) ---
    async getQuarterlyGoals() {
        const stored = await this.db.get('config', 'quarterly_goals');
        if (stored) return stored.data;

        // Default empty structure
        return {
            q1: { target: 0, actual: 0 },
            q2: { target: 0, actual: 0 },
            q3: { target: 0, actual: 0 },
            q4: { target: 0, actual: 0 }
        };
    }

    async saveQuarterlyGoals(goalsData) {
        await this.db.put('config', { key: 'quarterly_goals', data: goalsData });
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
                        await this.db.clearStore('clients');
                        await this.db.bulkPut('clients', clients);
                        resolve({ success: true, count: clients.length });
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

    async saveNewClientToDrive(url, filename, newClientData) {
        try {
            // 1. Download current file
            const response = await fetch(`${url}?action=get&filename=${encodeURIComponent(filename)}`);
            const json = await response.json();

            if (json.status !== 'success' || !json.data) {
                throw new Error("No se pudo descargar el archivo actual de Drive.");
            }

            // 2. Parse Excel
            const binaryString = atob(json.data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

            const workbook = XLSX.read(bytes, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // 3. Convert to JSON + Clean Structure
            let rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
            rows = this._cleanAndSortRows(rows);

            const headerRow = rows[0] || [];
            const colMap = this._getColumnMap(headerRow);

            // Prepare New Row
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

            // 4. Final Re-sort after push
            const header = rows.shift();
            rows.sort((a, b) => {
                const valA = (a[colMap.location] || "").toString().toLowerCase();
                const valB = (b[colMap.location] || "").toString().toLowerCase();
                return valA.localeCompare(valB);
            });
            rows.unshift(header);

            // 5. Write back to Sheet
            const newWorksheet = XLSX.utils.aoa_to_sheet(rows);
            workbook.Sheets[firstSheetName] = newWorksheet;

            const wbOut = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });

            // 6. Upload
            const uploadRes = await fetch(url + '?action=save&filename=' + encodeURIComponent(filename), {
                method: 'POST',
                body: wbOut
            });

            const uploadJson = await uploadRes.json();
            if (uploadJson.status === 'success') {
                // Also save locally
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
                    lat: newClientData.lat,
                    lng: newClientData.lng,
                    createdAt: new Date().toISOString()
                });
                return { success: true };
            } else {
                throw new Error(uploadJson.message || "Error al subir a Drive");
            }

        } catch (error) {
            console.error("Save Error", error);
            return { success: false, message: error.message };
        }
    }

    async updateClientInDrive(url, filename, originalCode, updatedData) {
        try {
            // 1. Download
            const response = await fetch(`${url}?action=get&filename=${encodeURIComponent(filename)}`);
            const json = await response.json();
            if (json.status !== 'success' || !json.data) throw new Error("No se pudo descargar el archivo.");

            // 2. Parse
            const binaryString = atob(json.data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

            const workbook = XLSX.read(bytes, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            // 3. Convert + Sanitize File
            let rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
            rows = this._cleanAndSortRows(rows);

            const headerRow = rows[0] || [];
            const colMap = this._getColumnMap(headerRow);

            // 3b. Find and Update
            let rowIndex = -1;
            for (let i = 1; i < rows.length; i++) {
                if (String(rows[i][colMap.code]).trim() === String(originalCode).trim()) {
                    rowIndex = i;
                    break;
                }
            }

            if (rowIndex === -1) throw new Error("Cliente no encontrado en el Excel.");

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

            // 4. Final Re-sort (in case location changed)
            const header = rows.shift();
            rows.sort((a, b) => {
                const valA = (a[colMap.location] || "").toString().toLowerCase();
                const valB = (b[colMap.location] || "").toString().toLowerCase();
                return valA.localeCompare(valB);
            });
            rows.unshift(header);

            // 5. Upload
            const newWorksheet = XLSX.utils.aoa_to_sheet(rows);
            workbook.Sheets[firstSheetName] = newWorksheet;
            const wbOut = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });

            const uploadRes = await fetch(url + '?action=save&filename=' + encodeURIComponent(filename), {
                method: 'POST',
                body: wbOut
            });
            const uploadJson = await uploadRes.json();

            if (uploadJson.status === 'success') {
                // Update Local
                // Delete old key if code changed? IndexedDB put overwrites if key same.
                // If code changed, we need to delete old key.
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
                    lat: updatedData.lat,
                    lng: updatedData.lng,
                    createdAt: new Date().toISOString()
                });
                return { success: true };
            } else {
                throw new Error(uploadJson.message || "Error al actualizar en Drive");
            }

        } catch (e) {
            console.error(e);
            return { success: false, message: e.message };
        }
    }

    async deleteClientFromDrive(url, filename, clientCode) {
        try {
            // 1. Download
            const response = await fetch(`${url}?action=get&filename=${encodeURIComponent(filename)}`);
            const json = await response.json();
            if (json.status !== 'success' || !json.data) throw new Error("No se pudo descargar el archivo.");

            // 2. Parse
            const binaryString = atob(json.data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

            const workbook = XLSX.read(bytes, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            let rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

            // compact & clean
            rows = this._cleanAndSortRows(rows);
            const headerRow = rows[0] || [];
            const colMap = this._getColumnMap(headerRow);

            // 3. Filter
            const header = rows.shift();
            const initialLen = rows.length;

            rows = rows.filter(r => String(r[colMap.code]).trim() !== String(clientCode).trim());

            if (rows.length === initialLen) throw new Error("Cliente no encontrado para eliminar.");

            // Put header back and final clean/resort
            rows.unshift(header);
            rows = this._cleanAndSortRows(rows);

            // 4. Upload
            const newWorksheet = XLSX.utils.aoa_to_sheet(rows);
            workbook.Sheets[firstSheetName] = newWorksheet;
            const wbOut = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });

            const uploadRes = await fetch(url + '?action=save&filename=' + encodeURIComponent(filename), {
                method: 'POST',
                body: wbOut
            });
            const uploadJson = await uploadRes.json();

            if (uploadJson.status === 'success') {
                // Local delete
                await this.db.delete('clients', clientCode);
                return { success: true };
            } else {
                throw new Error(uploadJson.message || "Error al eliminar de Drive");
            }

        } catch (e) {
            console.error(e);
            return { success: false, message: e.message };
        }
    }

    async importFromDrive(url, filename) {
        try {
            const response = await fetch(`${url}?action=get&filename=${encodeURIComponent(filename)}`);
            const json = await response.json();

            if (json.status === 'success' && json.data) {
                const binaryString = atob(json.data);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                return await this.importClientsFromExcel(bytes);
            } else {
                throw new Error(json.message || 'Error desconocido al descargar de Drive');
            }
        } catch (error) {
            console.error("Error en importFromDrive", error);
            // Return object with success:false so UI handles it gracefully
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
    async getDashStats() {
        const orders = await this.getOrders();
        const clients = await this.getClients();

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Ventas del mes
        const ordersThisMonth = orders.filter(o => {
            const d = new Date(o.dateISO);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        // Ventas mismo mes año anterior (YoY)
        const ordersLastYearMonth = orders.filter(o => {
            const d = new Date(o.dateISO);
            return d.getMonth() === currentMonth && d.getFullYear() === (currentYear - 1);
        });

        // Filtrar solo pedidos con importe > 0 para la estadística de pedidos y media
        const ordersThisMonthValued = ordersThisMonth.filter(o => (parseFloat(o.amount) || 0) > 0);

        const totalVentasMes = ordersThisMonth.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
        
        // CORRECCIÓN: Obtener ventas del año anterior desde el historial consolidado
        const salesHistory = await this.getSalesHistory();
        const prevYear = currentYear - 1;
        const totalVentasMesAnteriorAnio = (salesHistory[prevYear] && salesHistory[prevYear][currentMonth]) || 0;

        // Ventas del año
        const ordersThisYear = orders.filter(o => {
            const d = new Date(o.dateISO || o.date);
            return d.getFullYear() === currentYear;
        });
        const totalVentasAnio = ordersThisYear.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
        const ordersThisYearValued = ordersThisYear.filter(o => (parseFloat(o.amount) || 0) > 0);

        // Clientes activos (MES en curso)
        // Se cuentan los clientes únicos que han hecho al menos 1 pedido este MES.
        const activeClientsSet = new Set();
        ordersThisMonth.forEach(o => {
            // Prioritize code, fallback to shop name
            activeClientsSet.add(o.clientCode || o.shop);
        });

        // Top Clientes (Global o Mes? Asumiremos Mes por ahora para el Dash)
        const clientSales = {};
        ordersThisMonth.forEach(o => {
            if (!clientSales[o.shop]) clientSales[o.shop] = 0;
            clientSales[o.shop] += parseFloat(o.amount);
        });

        const topClientes = Object.entries(clientSales)
            .map(([name, amount]) => ({ name, amount, rank: 0 }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5)
            .map((item, index) => ({ ...item, rank: index + 1 }));

        // Objetivos (Dinamizados)
        const goals = await this.getDetailedGoals();
        const monthIdx = new Date().getMonth();

        let targetAmount = goals.data3[monthIdx];
        if (totalVentasMes >= goals.data4[monthIdx]) {
            targetAmount = goals.data5[monthIdx];
        } else if (totalVentasMes >= goals.data3[monthIdx]) {
            targetAmount = goals.data4[monthIdx];
        }

        // 6-Month Trend Logic
        const tendencia = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthIdx = d.getMonth();
            const yearInfo = d.getFullYear();
            const monthLabel = d.toLocaleString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');

            const sum = orders.reduce((acc, o) => {
                const oDate = new Date(o.dateISO || o.date);
                if (oDate.getMonth() === monthIdx && oDate.getFullYear() === yearInfo) {
                    return acc + (parseFloat(o.amount) || 0);
                }
                return acc;
            }, 0);

            // Dato del año anterior para la tendencia
            const sumAnterior = (salesHistory[yearInfo - 1] && salesHistory[yearInfo - 1][monthIdx]) || 0;

            tendencia.push({ 
                mes: monthLabel, 
                ventas: sum,
                ventasAnterior: sumAnterior
            });
        }

        return {
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
        // Collect all data
        const clients = await this.db.getAll('clients');
        const orders = await this.db.getAll('orders');
        const departments = await this.db.getAll('departments');

        // Config: we just get the specific keys we know of. 
        const goals = await this.db.get('config', 'goals');
        const history = await this.getSalesHistory(); // Use the method with fallback defaults
        const invoiceHistory = await this.getInvoiceHistory(); // Use the method with fallback defaults

        const config = {
            goals: goals // include full goals object (data3, data4, data5)
        };

        const backupData = {
            timestamp: new Date().toISOString(),
            appVersion: '1.0',
            clients,
            orders,
            departments,
            config,
            sales_history: history,
            invoice_history: invoiceHistory
        };

        return backupData;
    }

    async restoreFullBackup(data) {
        // data structure expected: { clients: [], orders: [], config: {}, sales_history: {}, departments: [] }
        // or a similar structure exported by the App.

        console.log("Restoring backup...", data);

        if (!data) throw new Error("No data received");

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

        // 4. Restore Config (Goals, Sales History)
        if (data.config) {
            // If config is an array (from getAll) or object? 
            // Usually export is an object representation.
            // Let's assume data.config contains keys: 'goals', 'sales_history'

            if (data.config.goals) {
                await this.db.put('config', { key: 'goals', ...data.config.goals });
                // Note: if data.config.goals was just the value object, we ensure key is there.
                // Actually, if we export getAll('config'), we get [{key:'goals', ...}, {key:'sales_history', ...}]
            }

            // Handle if data.config is the raw array from export
            if (Array.isArray(data.config)) {
                for (const item of data.config) {
                    await this.db.put('config', item);
                }
            }
        }

        // Special case for sales_history if it's separate in the backup JSON structure
        if (data.sales_history) {
            await this.db.put('config', { key: 'sales_history', data: data.sales_history });
        }

        // Special case for invoice_history
        if (data.invoice_history) {
            await this.db.put('config', { key: 'invoice_history', data: data.invoice_history });
        }

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
                        const orders = XLSX.utils.sheet_to_json(ws);
                        if (orders.length > 0) {
                            await this.db.clearStore('orders');
                            await this.db.bulkPut('orders', orders);
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
                const d = new Date(o.dateISO || o.date);
                return d.getFullYear() === year;
            }).sort((a, b) => {
                const numA = a.displayId || parseInt(String(a.id).split('-').pop());
                const numB = b.displayId || parseInt(String(b.id).split('-').pop());
                return numA - numB;
            });

            const ordersSheetData = currentYearOrders.map(o => {
                const client = clientMap.get(o.shop) || {};
                return {
                    "Nº Pedido": o.displayId || String(o.id).split('-').pop(),
                    "Fecha": o.dateISO || o.date,
                    "Cliente": o.shop,
                    "Importe": o.amount,
                    "Población": client.location || "---",
                    "Provincia": client.province || "---",
                    "Nuevo Cliente?": o.persistedIsNewClient ? "SI" : "NO",
                    "Comentarios": o.comments || ""
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
                totalVentasYear += (parseFloat(o.amount) || 0);
                const client = clientMap.get(o.shop);
                if (client && client.province) {
                    let prov = client.province.trim().toUpperCase();
                    if (prov === 'LEON') prov = 'LEÓN';
                    if (prov === 'LUGO') prov = 'GALICIA';
                    if (prov === 'PALENCIA') prov = 'LEÓN';

                    if (statsByProv[prov]) {
                        statsByProv[prov]["Ventas Totales"] += (parseFloat(o.amount) || 0);
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
            const newClientsCount = currentYearOrders.filter(o => o.persistedIsNewClient).length;
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
            const scriptUrl = typeof GOOGLE_SCRIPT_URL !== 'undefined' ? GOOGLE_SCRIPT_URL :
                (window.GOOGLE_SCRIPT_URL || "");

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
}
// End DataManager

// Global Instance
const dataManager = new DataManager();

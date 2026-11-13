/**
 * Extrae de forma segura el año de una fecha (soporta YYYY-MM-DD, DD/MM/YYYY, ISO completo)
 * Evitando dependencias de zona horaria del constructor de Date en ciertos formatos.
 */
/**
 * Normaliza un texto para comparaciones tolerantes (sin tildes, minúsculas y sin espacios dobles o extremos)
 */
function normalizeTextKey(str) {
    if (!str) return '';
    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

window.normalizeTextKey = normalizeTextKey;

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

        // 4. Sincronizar Preferencias de Comunicación (WhatsApp y Correo) entre IndexedDB y localStorage
        const storedCommPrefs = await this.db.get('config', 'comm_prefs');
        if (storedCommPrefs) {
            if (!localStorage.getItem('pref_whatsapp_app') && storedCommPrefs.pref_whatsapp_app) {
                localStorage.setItem('pref_whatsapp_app', storedCommPrefs.pref_whatsapp_app);
            }
            if (!localStorage.getItem('pref_email_app') && storedCommPrefs.pref_email_app) {
                localStorage.setItem('pref_email_app', storedCommPrefs.pref_email_app);
            }
            if (!localStorage.getItem('pref_work_email') && storedCommPrefs.pref_work_email) {
                localStorage.setItem('pref_work_email', storedCommPrefs.pref_work_email);
            }
        } else {
            await this.db.put('config', this._getCommPrefsRecord());
        }

        return { created, year: currentYear };
    }

    buildClientLookup(clients) {
        const byCode = new Map();
        const byNormName = new Map();
        (clients || []).forEach(c => {
            if (!c) return;
            if (c.code !== undefined && c.code !== null && String(c.code).trim() !== '') {
                byCode.set(String(c.code).trim(), c);
            }
            if (c.name) {
                byNormName.set(normalizeTextKey(c.name), c);
            }
        });
        return { byCode, byNormName };
    }

    resolveClientForOrder(orderOrShop, lookup) {
        if (!orderOrShop || !lookup) return null;
        if (typeof orderOrShop === 'object') {
            const code = orderOrShop.clientCode !== undefined && orderOrShop.clientCode !== null
                ? String(orderOrShop.clientCode).trim()
                : '';
            if (code && lookup.byCode.has(code)) {
                return lookup.byCode.get(code);
            }
            const shopName = orderOrShop.shop || orderOrShop["Cliente"] || '';
            const norm = normalizeTextKey(shopName);
            if (norm && lookup.byNormName.has(norm)) {
                return lookup.byNormName.get(norm);
            }
            return null;
        } else {
            const raw = String(orderOrShop).trim();
            if (lookup.byCode.has(raw)) return lookup.byCode.get(raw);
            const norm = normalizeTextKey(raw);
            return lookup.byNormName.get(norm) || null;
        }
    }

    isOrderForClient(order, client) {
        if (!order || !client) return false;
        const oCode = order.clientCode !== undefined && order.clientCode !== null ? String(order.clientCode).trim() : '';
        const cCode = client.code !== undefined && client.code !== null ? String(client.code).trim() : '';
        if (oCode && cCode) {
            return oCode === cCode;
        }
        const oName = normalizeTextKey(order.shop || order["Cliente"] || '');
        const cName = normalizeTextKey(client.name || '');
        return oName !== '' && oName === cName;
    }

    async migrateOrdersClientCode() {
        try {
            const [clients, orders] = await Promise.all([
                this.getClients(),
                this.db.getAll('orders')
            ]);
            if (!clients.length || !orders.length) return 0;

            const lookup = this.buildClientLookup(clients);
            const toUpdate = [];

            orders.forEach(o => {
                if (!o) return;
                const currentCode = o.clientCode !== undefined && o.clientCode !== null ? String(o.clientCode).trim() : '';
                const matchedClient = this.resolveClientForOrder(o, lookup);
                if (matchedClient && matchedClient.code) {
                    const targetCode = String(matchedClient.code).trim();
                    if (currentCode !== targetCode || (currentCode === targetCode && matchedClient.name && o.shop !== matchedClient.name.trim())) {
                        o.clientCode = targetCode;
                        if (matchedClient.name) {
                            o.shop = matchedClient.name.trim();
                        }
                        toUpdate.push(o);
                    }
                }
            });

            if (toUpdate.length > 0) {
                await this.db.bulkPut('orders', toUpdate);
                console.log(`[Migración] ${toUpdate.length} pedidos vinculados/actualizados con su código de cliente.`);
            }
            return toUpdate.length;
        } catch (err) {
            console.warn("Error en migrateOrdersClientCode:", err);
            return 0;
        }
    }

    async syncClientOrdersIdentity(originalCode, originalName, updatedClientData) {
        try {
            const orders = await this.db.getAll('orders');
            if (!orders || orders.length === 0) return 0;

            const origCodeStr = originalCode !== undefined && originalCode !== null ? String(originalCode).trim() : '';
            const origNameNorm = normalizeTextKey(originalName);
            const newCodeStr = String(updatedClientData.code || '').trim();
            const newNameStr = String(updatedClientData.name || '').trim();

            const updatedOrders = [];
            orders.forEach(o => {
                if (!o) return;
                const oCode = o.clientCode !== undefined && o.clientCode !== null ? String(o.clientCode).trim() : '';
                const oNameNorm = normalizeTextKey(o.shop || o["Cliente"] || '');

                const matchByCode = origCodeStr && oCode && oCode === origCodeStr;
                const matchByName = !oCode && origNameNorm && oNameNorm === origNameNorm;

                if (matchByCode || matchByName) {
                    let changed = false;
                    if (newCodeStr && o.clientCode !== newCodeStr) {
                        o.clientCode = newCodeStr;
                        changed = true;
                    }
                    if (newNameStr && o.shop !== newNameStr) {
                        o.shop = newNameStr;
                        changed = true;
                    }
                    if (changed) updatedOrders.push(o);
                }
            });

            if (updatedOrders.length > 0) {
                await this.db.bulkPut('orders', updatedOrders);
                console.log(`[Integridad] Actualizados ${updatedOrders.length} pedidos tras editar el cliente ${newCodeStr} - ${newNameStr}`);
            }
            return updatedOrders.length;
        } catch (err) {
            console.warn("Error sincronizando pedidos del cliente editado:", err);
            return 0;
        }
    }

    async ensureYearExists(year) {
        await this.migrateOrdersClientCode();
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

    // --- COLA DE SINCRONIZACIÓN DE CLIENTES (OFFLINE-FIRST) ---
    async getPendingClientOps() {
        const stored = await this.db.get('config', 'pending_client_ops');
        return (stored && Array.isArray(stored.ops)) ? stored.ops : [];
    }

    async savePendingClientOps(ops) {
        await this.db.put('config', {
            key: 'pending_client_ops',
            ops: Array.isArray(ops) ? ops : [],
            updatedAt: new Date().toISOString()
        });
    }

    async enqueueClientSyncOp(op) {
        let ops = await this.getPendingClientOps();
        const timestamp = new Date().toISOString();

        if (op.type === 'delete') {
            const targetCode = String(op.code || '').trim();
            // Eliminar cualquier alta o edición pendiente sobre ese mismo código
            ops = ops.filter(item => {
                const itemCode = String(item.code || item.data?.code || '').trim();
                const itemOrig = String(item.originalCode || '').trim();
                return itemCode !== targetCode && itemOrig !== targetCode;
            });
            ops.push({ type: 'delete', code: targetCode, timestamp });
        } else if (op.type === 'upsert') {
            const newCode = String(op.data?.code || '').trim();
            const origCode = String(op.originalCode || newCode).trim();
            // Reemplazar operaciones previas sobre el mismo cliente para dejar solo el último estado
            ops = ops.filter(item => {
                const itemCode = String(item.code || item.data?.code || '').trim();
                const itemOrig = String(item.originalCode || '').trim();
                return itemCode !== newCode && itemCode !== origCode && itemOrig !== origCode;
            });
            ops.push({
                type: 'upsert',
                originalCode: origCode,
                data: { ...op.data, updatedAt: timestamp },
                timestamp
            });
        }

        await this.savePendingClientOps(ops);
        return ops.length;
    }

    async clearPendingClientOps() {
        await this.savePendingClientOps([]);
    }

    /**
     * Sincroniza la cola pendiente con Google Drive en segundo plano (un único envío optimizado sin descargar el Excel)
     */
    async flushPendingClientSync(url = null, filename = 'Clientes_CON_COORDENADAS.xlsx') {
        if (this._isFlushingClientSync) {
            return { success: false, busy: true };
        }
        const pending = await this.getPendingClientOps();
        if (pending.length === 0) {
            return { success: true, synced: 0, pendingCount: 0 };
        }

        const scriptUrl = url || localStorage.getItem('apps_script_url') ||
            (typeof DEFAULT_SCRIPT_URL !== 'undefined' ? DEFAULT_SCRIPT_URL : (typeof GOOGLE_SCRIPT_URL !== 'undefined' ? GOOGLE_SCRIPT_URL : ''));

        if (!scriptUrl || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
            return { success: false, offline: true, pendingCount: pending.length };
        }

        this._isFlushingClientSync = true;
        try {
            const res = await this.syncAllClientsToDriveExcel(scriptUrl, filename);
            if (res.success) {
                await this.clearPendingClientOps();
                console.log(`[Cola Sync] Sincronizados con éxito ${pending.length} cambios pendientes con Google Drive.`);
                if (typeof window !== 'undefined' && typeof window.onClientSyncQueueUpdated === 'function') {
                    window.onClientSyncQueueUpdated(0);
                }
                return { success: true, synced: pending.length, pendingCount: 0 };
            } else {
                return { success: false, message: res.message, pendingCount: pending.length };
            }
        } catch (err) {
            console.warn("[Cola Sync] No se pudo vaciar la cola aún:", err.message);
            return { success: false, message: err.message, pendingCount: pending.length };
        } finally {
            this._isFlushingClientSync = false;
        }
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
                        cp: getValue(row, 'CP', 'C.P.', 'C.P', 'C. P.', 'CODIGO POSTAL', 'CÓDIGO POSTAL', 'COD POSTAL', 'COD. POSTAL'),
                        phone: String(getValue(row, 'TELEFONO', 'TELÉFONO', 'MOVIL') || '').replace(/^['´]+/, '').trim(),
                        phone2: String(getValue(row, 'TELEFONO 2', 'TELÉFONO 2', 'MOVIL 2') || '').replace(/^['´]+/, '').trim(),
                        schedule: getValue(row, 'HORARIO', 'HORARIOS', 'SCHEDULE'),
                        notes: getValue(row, 'NOTAS', 'OBSERVACIONES', 'NOTAS CLIENTE') || '',
                        lastVisitDate: getValue(row, 'ULTIMA VISITA', 'ÚLTIMA VISITA', 'FECHA VISITA') || '',
                        lastVisitNote: getValue(row, 'NOTA VISITA', 'COMENTARIO VISITA') || '',
                        lat: getValue(row, 'LATITUD', 'LAT', 'LATITUDE'),
                        lng: getValue(row, 'LONGITUD', 'LNG', 'LONG', 'LON', 'LONGITUDE'),
                        createdAt: new Date().toISOString()
                    })).filter(c => c.code && c.name);

                    if (clients.length > 0) {
                        const existingClients = await this.db.getAll('clients');
                        const pendingOps = await this.getPendingClientOps();

                        if (existingClients.length > 50 && clients.length < 20) {
                            const ok = confirm(`Atención: El Excel contiene solo ${clients.length} clientes, mientras que en tu app tienes ${existingClients.length}.\n\n¿Estás seguro de que quieres continuar?`);
                            if (!ok) {
                                resolve({ success: false, message: 'Importación cancelada por seguridad para no perder tus clientes locales.' });
                                return;
                            }
                        }

                        // FUSIÓN INTELIGENTE (MERGE):
                        // 1. Empezamos con los clientes locales existentes para NO borrar clientes creados en local que aún no estén en el Excel
                        const mergedMap = new Map();
                        existingClients.forEach(c => {
                            if (c && c.code) mergedMap.set(String(c.code).trim(), c);
                        });

                        // 2. Aplicamos los clientes entrantes del Excel (conservando notas y visitas locales si el Excel las trae en blanco)
                        clients.forEach(incoming => {
                            const code = String(incoming.code).trim();
                            const prev = mergedMap.get(code);
                            if (prev) {
                                mergedMap.set(code, {
                                    ...prev,
                                    ...incoming,
                                    notes: incoming.notes || prev.notes || '',
                                    lastVisitDate: incoming.lastVisitDate || prev.lastVisitDate || '',
                                    lastVisitNote: incoming.lastVisitNote || prev.lastVisitNote || '',
                                    visitHistory: prev.visitHistory || []
                                });
                            } else {
                                mergedMap.set(code, incoming);
                            }
                        });

                        // 3. Re-aplicamos encima cualquier operación pendiente en la cola (altas, ediciones o borrados hechos sin cobertura)
                        let protectedChanges = 0;
                        if (pendingOps.length > 0) {
                            pendingOps.forEach(op => {
                                if (op.type === 'delete' && op.code) {
                                    mergedMap.delete(String(op.code).trim());
                                    protectedChanges++;
                                } else if (op.type === 'upsert' && op.data && op.data.code) {
                                    const origCode = String(op.originalCode || op.data.code).trim();
                                    const newCode = String(op.data.code).trim();
                                    if (origCode !== newCode) mergedMap.delete(origCode);
                                    mergedMap.set(newCode, {
                                        ...(mergedMap.get(newCode) || {}),
                                        ...op.data,
                                        pendingSync: true
                                    });
                                    protectedChanges++;
                                }
                            });
                        }

                        const finalClients = Array.from(mergedMap.values());
                        const localOnlyPreserved = Math.max(0, finalClients.length - clients.length);

                        await this.db.clearStore('clients');
                        await this.db.bulkPut('clients', finalClients);
                        await this.migrateOrdersClientCode();

                        resolve({
                            success: true,
                            count: finalClients.length,
                            importedCount: clients.length,
                            preserved: localOnlyPreserved,
                            protectedPending: protectedChanges
                        });
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
            else if (['CP', 'C.P.', 'C.P', 'C. P.', 'CODIGO POSTAL', 'CÓDIGO POSTAL', 'COD POSTAL', 'COD. POSTAL'].includes(clean)) map.cp = idx;
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

    async syncAllClientsToDriveExcel(url, filename = 'Clientes_CON_COORDENADAS.xlsx') {
        try {
            if (!url) throw new Error("URL de Google Drive no configurada");
            const clients = await this.getClients();
            clients.sort((a, b) => {
                const locA = (a.location || "").toString().toLowerCase().trim();
                const locB = (b.location || "").toString().toLowerCase().trim();
                if (locA === locB) return (a.name || "").toString().toLowerCase().localeCompare((b.name || "").toString().toLowerCase());
                return locA.localeCompare(locB);
            });

            const header = [
                "CODIGO", "TIENDA", "NIF", "MAIL", "DIRECCION", "CONTACTO",
                "POBLACION", "PROVINCIA", "CP", "TELEFONO", "HORARIO",
                "NOTAS", "ULTIMA VISITA", "NOTA VISITA", "", "", "", "", "", "", "",
                "LATITUD", "LONGITUD", "TELEFONO 2"
            ];

            const rows = [header];
            clients.forEach(c => {
                const r = new Array(24).fill("");
                r[0] = c.code || "";
                r[1] = c.name || "";
                r[2] = c.nif || "";
                r[3] = c.email || "";
                r[4] = c.address || "";
                r[5] = c.contact || "";
                r[6] = c.location || "";
                r[7] = c.province || "";
                r[8] = c.cp || "";
                r[9] = c.phone || "";
                r[10] = c.schedule || "";
                r[11] = c.notes || "";
                r[12] = c.lastVisitDate || "";
                r[13] = c.lastVisitNote || "";
                r[21] = c.lat !== undefined && c.lat !== null ? c.lat : "";
                r[22] = c.lng !== undefined && c.lng !== null ? c.lng : "";
                r[23] = c.phone2 || "";
                rows.push(r);
            });

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, ws, "Clientes");
            const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });

            const uploadJson = await this._safeFetchJson(url + '?action=save&filename=' + encodeURIComponent(filename), {
                method: 'POST',
                body: wbOut
            });

            if (uploadJson.status === 'success' || uploadJson.success) {
                // Limpiar bandera pendingSync en los clientes locales tras subida exitosa
                const updatedLocal = clients.filter(c => c.pendingSync).map(c => {
                    const copy = { ...c };
                    delete copy.pendingSync;
                    return copy;
                });
                if (updatedLocal.length > 0) {
                    await this.db.bulkPut('clients', updatedLocal);
                }
                return { success: true, driveSynced: true, count: clients.length };
            } else {
                throw new Error(uploadJson.message || "Error al subir el Excel de clientes a Drive");
            }
        } catch (err) {
            console.error("Error en syncAllClientsToDriveExcel:", err);
            return { success: false, message: err.message };
        }
    }

    async saveNewClientToDrive(url, filename, newClientData) {
        const nowISO = new Date().toISOString();
        const clientRecord = {
            code: String(newClientData.code || '').trim(),
            name: String(newClientData.name || '').trim(),
            nif: newClientData.nif || "",
            email: newClientData.email || "",
            address: newClientData.address || "",
            contact: newClientData.contact || "",
            location: newClientData.location || "",
            province: newClientData.province || "",
            cp: newClientData.cp || "",
            phone: newClientData.phone || "",
            phone2: newClientData.phone2 || "",
            schedule: newClientData.schedule || "",
            notes: newClientData.notes || "",
            lastVisitDate: newClientData.lastVisitDate || "",
            lastVisitNote: newClientData.lastVisitNote || "",
            visitHistory: Array.isArray(newClientData.visitHistory) ? newClientData.visitHistory : [],
            lat: newClientData.lat,
            lng: newClientData.lng,
            pendingSync: true,
            createdAt: nowISO,
            updatedAt: nowISO
        };

        // 1. Guardar inmediatamente en la BD local (IndexedDB) y registrar en la cola de pendientes
        try {
            await this.db.put('clients', clientRecord);
            await this.enqueueClientSyncOp({ type: 'upsert', originalCode: clientRecord.code, data: clientRecord });
            await this.migrateOrdersClientCode();
        } catch (localErr) {
            console.error("Error guardando cliente localmente:", localErr);
            return { success: false, message: "No se pudo guardar en la base de datos local: " + localErr.message };
        }

        // 2. Sincronizar con Google Drive mediante subida directa (sin descargar el Excel previo)
        try {
            if (!url) throw new Error("URL de Google Drive no configurada");
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                throw new Error("Sin conexión a Internet en este momento");
            }

            const syncRes = await this.flushPendingClientSync(url, filename);
            if (syncRes.success) {
                return { success: true, driveSynced: true, pendingCount: 0 };
            } else {
                throw new Error(syncRes.message || "No se pudo completar la subida a Drive");
            }
        } catch (driveErr) {
            const pendingOps = await this.getPendingClientOps();
            console.warn("Cliente guardado en local y añadido a la cola de sincronización:", driveErr);
            return {
                success: true,
                driveSynced: false,
                queued: true,
                pendingCount: pendingOps.length,
                warning: `Guardado en tu dispositivo y añadido a la cola de sincronización (${pendingOps.length} pendiente${pendingOps.length === 1 ? '' : 's'}). Se subirá automáticamente a Drive al recuperar cobertura.`
            };
        }
    }

    async updateClientInDrive(url, filename, originalCode, updatedData) {
        const existingClient = await this.getClientByCode(originalCode);
        const originalName = existingClient ? existingClient.name : '';
        const nowISO = new Date().toISOString();

        const clientRecord = {
            code: String(updatedData.code || '').trim(),
            name: String(updatedData.name || '').trim(),
            nif: updatedData.nif || "",
            email: updatedData.email || "",
            address: updatedData.address || "",
            contact: updatedData.contact || "",
            location: updatedData.location || "",
            province: updatedData.province || "",
            cp: updatedData.cp || "",
            phone: updatedData.phone || "",
            phone2: updatedData.phone2 || "",
            schedule: updatedData.schedule || "",
            notes: updatedData.notes !== undefined ? updatedData.notes : (existingClient?.notes || ""),
            lastVisitDate: updatedData.lastVisitDate !== undefined ? updatedData.lastVisitDate : (existingClient?.lastVisitDate || ""),
            lastVisitNote: updatedData.lastVisitNote !== undefined ? updatedData.lastVisitNote : (existingClient?.lastVisitNote || ""),
            visitHistory: Array.isArray(updatedData.visitHistory) ? updatedData.visitHistory : (existingClient?.visitHistory || []),
            lat: updatedData.lat,
            lng: updatedData.lng,
            pendingSync: true,
            createdAt: existingClient?.createdAt || nowISO,
            updatedAt: nowISO
        };

        // 1. Guardar inmediatamente en la BD local (IndexedDB) y encolar
        try {
            if (String(originalCode).trim() !== clientRecord.code) {
                await this.db.delete('clients', originalCode);
            }
            await this.db.put('clients', clientRecord);
            await this.enqueueClientSyncOp({ type: 'upsert', originalCode, data: clientRecord });
        } catch (localErr) {
            console.error("Error actualizando cliente localmente:", localErr);
            return { success: false, message: "No se pudo actualizar en la base de datos local: " + localErr.message };
        }

        await this.syncClientOrdersIdentity(originalCode, originalName, clientRecord);

        // 2. Sincronizar con Google Drive en un solo paso (sin descargar el Excel previo)
        try {
            if (!url) throw new Error("URL de Google Drive no configurada");
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                throw new Error("Sin conexión a Internet en este momento");
            }

            const syncRes = await this.flushPendingClientSync(url, filename);
            if (syncRes.success) {
                return { success: true, driveSynced: true, pendingCount: 0 };
            } else {
                throw new Error(syncRes.message || "Error al actualizar en Drive");
            }
        } catch (driveErr) {
            const pendingOps = await this.getPendingClientOps();
            console.warn("Cliente actualizado en local y añadido a la cola de sincronización:", driveErr);
            return {
                success: true,
                driveSynced: false,
                queued: true,
                pendingCount: pendingOps.length,
                warning: `Cambios guardados en el dispositivo y encolados (${pendingOps.length} pendiente${pendingOps.length === 1 ? '' : 's'}). Se sincronizarán automáticamente al tener cobertura.`
            };
        }
    }

    async saveClientQuickNotes(clientCode, notesText) {
        const client = await this.getClientByCode(clientCode);
        if (!client) return { success: false, message: "Cliente no encontrado" };

        const updatedClient = {
            ...client,
            notes: String(notesText || '').trim(),
            pendingSync: true,
            updatedAt: new Date().toISOString()
        };

        await this.db.put('clients', updatedClient);
        await this.enqueueClientSyncOp({ type: 'upsert', originalCode: client.code, data: updatedClient });

        // Sincronizar en segundo plano sin bloquear la UI
        this.flushPendingClientSync().catch(() => {});
        return { success: true, client: updatedClient };
    }

    _getLocalDateISO(dateObj = new Date()) {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    async getVisitNotes() {
        const stored = await this.db.get('config', 'visit_notes');
        return Array.isArray(stored?.data) ? stored.data : [];
    }

    async saveVisitNotesList(notes) {
        const list = Array.isArray(notes) ? notes : [];
        await this.db.put('config', { key: 'visit_notes', data: list });
        return list;
    }

    async toggleVisitNoteDone(noteId) {
        const notes = await this.getVisitNotes();
        const updated = notes.map(n => n.id === noteId ? { ...n, done: !n.done, updatedAt: new Date().toISOString() } : n);
        await this.saveVisitNotesList(updated);
        return updated;
    }

    async deleteVisitNote(noteId) {
        const notes = await this.getVisitNotes();
        const updated = notes.filter(n => n.id !== noteId);
        await this.saveVisitNotesList(updated);
        return updated;
    }

    async snoozeVisitNoteAlert(noteId, daysToAdd = 7) {
        const notes = await this.getVisitNotes();
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + Number(daysToAdd || 7));
        const nextISO = this._getLocalDateISO(nextDate);
        const updated = notes.map(n => n.id === noteId ? { ...n, alertDate: nextISO, done: false, updatedAt: new Date().toISOString() } : n);
        await this.saveVisitNotesList(updated);
        return updated;
    }

    async getDueVisitAlerts(referenceDateISO = null) {
        const todayISO = referenceDateISO || this._getLocalDateISO();
        const notes = await this.getVisitNotes();
        return notes
            .filter(n => !n.done && n.alertDate && String(n.alertDate).trim() !== '' && n.alertDate <= todayISO)
            .sort((a, b) => String(a.alertDate).localeCompare(String(b.alertDate)));
    }

    async recordClientVisit(clientCode, visitNote = '', visitDateISO = null, alertDateISO = '') {
        const client = await this.getClientByCode(clientCode);
        if (!client) return { success: false, message: "Cliente no encontrado" };

        const dateISO = visitDateISO || this._getLocalDateISO();
        const cleanNote = String(visitNote || '').trim();
        const cleanAlertDate = String(alertDateISO || '').trim();
        const nowISO = new Date().toISOString();

        const history = Array.isArray(client.visitHistory) ? [...client.visitHistory] : [];
        history.unshift({
            date: dateISO,
            note: cleanNote,
            alertDate: cleanAlertDate,
            timestamp: nowISO
        });

        const updatedClient = {
            ...client,
            lastVisitDate: dateISO,
            lastVisitNote: cleanNote,
            visitHistory: history,
            pendingSync: true,
            updatedAt: nowISO
        };

        await this.db.put('clients', updatedClient);
        await this.enqueueClientSyncOp({ type: 'upsert', originalCode: client.code, data: updatedClient });

        // Guardar también en el listado global de notas de visita (y alertas)
        const visitNotes = await this.getVisitNotes();
        const newNoteEntry = {
            id: `vn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            clientCode: String(client.code || ''),
            clientName: client.name || 'Sin Nombre',
            date: dateISO,
            note: cleanNote || 'Visita registrada (sin comentario)',
            alertDate: cleanAlertDate,
            done: false,
            createdAt: nowISO
        };
        visitNotes.unshift(newNoteEntry);
        await this.saveVisitNotesList(visitNotes);

        // Sincronizar en segundo plano sin bloquear la UI
        this.flushPendingClientSync().catch(() => {});
        return { success: true, client: updatedClient, visitNoteEntry: newNoteEntry };
    }

    async deleteClientFromDrive(url, filename, clientCode) {
        // 1. Eliminar localmente en BD primero y registrar borrado en la cola
        try {
            await this.db.delete('clients', clientCode);
            await this.enqueueClientSyncOp({ type: 'delete', code: clientCode });
        } catch (localErr) {
            console.error("Error eliminando cliente localmente:", localErr);
            return { success: false, message: "No se pudo eliminar en el dispositivo: " + localErr.message };
        }

        // 2. Sincronizar con Google Drive en un solo paso
        try {
            if (!url) throw new Error("URL de Google Drive no configurada");
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                throw new Error("Sin conexión a Internet en este momento");
            }

            const syncRes = await this.flushPendingClientSync(url, filename);
            if (syncRes.success) {
                return { success: true, driveSynced: true, pendingCount: 0 };
            } else {
                throw new Error(syncRes.message || "Error al eliminar de Drive");
            }
        } catch (driveErr) {
            const pendingOps = await this.getPendingClientOps();
            console.warn("Cliente eliminado localmente, eliminación encolada para Drive:", driveErr);
            return {
                success: true,
                driveSynced: false,
                queued: true,
                pendingCount: pendingOps.length,
                warning: `Eliminado del dispositivo y encolado (${pendingOps.length} pendiente${pendingOps.length === 1 ? '' : 's'}). Se actualizará en Google Drive cuando haya conexión.`
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
                const importResult = await this.importClientsFromExcel(bytes);
                // Si teníamos cambios pendientes en la cola local, los subimos ahora para que Drive también quede al día
                const pendingOps = await this.getPendingClientOps();
                if (importResult.success && pendingOps.length > 0) {
                    await this.flushPendingClientSync(url, filename);
                }
                return importResult;
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

        const clients = await this.getClients();
        const lookup = this.buildClientLookup(clients);
        const matchedClient = this.resolveClientForOrder(orderData, lookup);
        const resolvedClientCode = orderData.clientCode || (matchedClient ? String(matchedClient.code).trim() : null);
        const resolvedShopName = matchedClient && matchedClient.name ? matchedClient.name.trim() : String(orderData.shop || '').trim();

        const newOrder = {
            ...orderData,
            shop: resolvedShopName,
            clientCode: resolvedClientCode,
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

        const lookup = this.buildClientLookup(clients);

        // Clientes activos (MES seleccionado)
        const activeClientsSet = new Set();
        ordersThisMonth.forEach(o => {
            const c = this.resolveClientForOrder(o, lookup);
            activeClientsSet.add(c ? c.code : (o.clientCode || normalizeTextKey(o.shop)));
        });

        // Top Clientes del mes seleccionado
        const clientSales = {};
        ordersThisMonth.forEach(o => {
            const c = this.resolveClientForOrder(o, lookup);
            const displayShop = c ? c.name : o.shop;
            const key = c ? `code_${c.code}` : `shop_${normalizeTextKey(o.shop)}`;
            if (!clientSales[key]) clientSales[key] = { name: displayShop, amount: 0 };
            clientSales[key].amount += (parseFloat(o.amount) || 0);
        });

        const topClientes = Object.values(clientSales)
            .map(item => ({ name: item.name, amount: item.amount, rank: 0 }))
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
        const clients = await this.getClients();
        const lookup = this.buildClientLookup(clients);

        // 1. Filter orders for specified year
        const yearlyOrders = orders.filter(o => {
            const d = new Date(o.dateISO || o.date);
            return d.getFullYear() === year;
        });

        // 2. Aggregate sales and order count by client
        const clientStats = {};
        yearlyOrders.forEach(o => {
            const c = this.resolveClientForOrder(o, lookup);
            const key = c ? `code_${c.code}` : `shop_${normalizeTextKey(o.shop)}`;
            const displayName = c ? c.name : o.shop;
            if (!clientStats[key]) clientStats[key] = { name: displayName, code: c ? c.code : (o.clientCode || null), amount: 0, orderCount: 0 };
            const amt = parseFloat(o.amount) || 0;
            clientStats[key].amount += amt;
            if (amt > 0) clientStats[key].orderCount += 1;
        });

        // 3. Convert to array and sort
        const ranking = Object.values(clientStats)
            .map(stats => ({ ...stats }))
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

    _getCommPrefsRecord() {
        return {
            key: 'comm_prefs',
            pref_whatsapp_app: localStorage.getItem('pref_whatsapp_app') || 'business',
            pref_email_app: localStorage.getItem('pref_email_app') || 'default',
            pref_work_email: localStorage.getItem('pref_work_email') || ''
        };
    }

    _applyCommPrefsRecord(prefs) {
        if (!prefs || typeof prefs !== 'object') return;
        if (prefs.pref_whatsapp_app) {
            localStorage.setItem('pref_whatsapp_app', prefs.pref_whatsapp_app);
        }
        if (prefs.pref_email_app) {
            localStorage.setItem('pref_email_app', prefs.pref_email_app);
        }
        if (prefs.pref_work_email !== undefined) {
            localStorage.setItem('pref_work_email', String(prefs.pref_work_email || '').trim());
        }
    }

    async exportFullBackup() {
        // Sincronizar preferencias de WhatsApp y Correo en la tabla config antes de exportar
        const commPrefs = this._getCommPrefsRecord();
        await this.db.put('config', commPrefs);

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
            config,
            comm_prefs: commPrefs
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

        // 4. Restaurar Configuración (Objetivos, Históricos, Ajustes, Preferencias WhatsApp/Mail)
        if (data.config) {
            if (Array.isArray(data.config)) {
                for (const item of data.config) {
                    if (item && item.key) {
                        await this.db.put('config', item);
                        if (item.key === 'comm_prefs') {
                            this._applyCommPrefsRecord(item);
                        }
                    }
                }
            } else if (data.config.goals) {
                await this.db.put('config', { key: 'goals', ...data.config.goals });
            }
        }

        if (data.comm_prefs) {
            await this.db.put('config', { key: 'comm_prefs', ...data.comm_prefs });
            this._applyCommPrefsRecord(data.comm_prefs);
        }

        // Compatibilidad con backups antiguos (claves fuera de config)
        if (data.sales_history) await this.db.put('config', { key: 'sales_history', data: data.sales_history });
        if (data.invoice_history) await this.db.put('config', { key: 'invoice_history', data: data.invoice_history });
        if (data.quarterly_goals) await this.db.put('config', { key: 'quarterly_goals', data: data.quarterly_goals });

        await this.migrateOrdersClientCode();

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

            // 2.2 Visit Notes & Alerts Sheet
            const visitNotes = await this.getVisitNotes();
            if (visitNotes && visitNotes.length > 0) {
                const wsVisitNotes = XLSX.utils.json_to_sheet(visitNotes);
                XLSX.utils.book_append_sheet(wb, wsVisitNotes, "NotasVisita");
            }

            // 3. Goal & History (Config) + Preferencias WhatsApp/Mail
            const goals = await this.db.get('config', 'goals');
            const salesHistory = await this.db.get('config', 'sales_history');
            const invoiceHistory = await this.db.get('config', 'invoice_history');
            const commPrefs = this._getCommPrefsRecord();
            await this.db.put('config', commPrefs);

            const configData = [
                { key: 'goals', value: JSON.stringify(goals || {}) },
                { key: 'sales_history', value: JSON.stringify(salesHistory || {}) },
                { key: 'invoice_history', value: JSON.stringify(invoiceHistory || {}) },
                { key: 'comm_prefs', value: JSON.stringify(commPrefs) }
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

            const visitNotes = await this.getVisitNotes();
            if (visitNotes && visitNotes.length > 0) {
                const wsVisitNotes = XLSX.utils.json_to_sheet(visitNotes);
                XLSX.utils.book_append_sheet(wb, wsVisitNotes, "NotasVisita");
            }

            const goals = await this.db.get('config', 'goals');
            const salesHistory = await this.db.get('config', 'sales_history');
            const invoiceHistory = await this.db.get('config', 'invoice_history');
            const commPrefs = this._getCommPrefsRecord();
            await this.db.put('config', commPrefs);

            const configData = [
                { key: 'goals', value: JSON.stringify(goals || {}) },
                { key: 'sales_history', value: JSON.stringify(salesHistory || {}) },
                { key: 'invoice_history', value: JSON.stringify(invoiceHistory || {}) },
                { key: 'comm_prefs', value: JSON.stringify(commPrefs) }
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
                        await this.migrateOrdersClientCode();
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
                                const clientCodeVal = o["Código Cliente"] || o["clientCode"] || null;

                                return {
                                    id: compositeId,
                                    displayId,
                                    date: normalizedDate,
                                    dateISO: normalizedDate,
                                    shop: String(shopVal).trim(),
                                    clientCode: clientCodeVal ? String(clientCodeVal).trim() : null,
                                    amount: amountVal,
                                    comments: commentsVal,
                                    year: yearVal,
                                    persistedIsNewClient: isNewClient
                                };
                            });
                            await this.db.clearStore('orders');
                            await this.db.bulkPut('orders', normalizedOrders);
                            await this.migrateOrdersClientCode();
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

                    // 2.2 Import Visit Notes
                    if (wb.SheetNames.includes("NotasVisita")) {
                        const ws = wb.Sheets["NotasVisita"];
                        const importedNotes = XLSX.utils.sheet_to_json(ws);
                        if (Array.isArray(importedNotes) && importedNotes.length > 0) {
                            const normalized = importedNotes.map(n => ({
                                ...n,
                                done: n.done === true || n.done === 'true' || n.done === 1
                            }));
                            await this.saveVisitNotesList(normalized);
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
                                        await this.db.put('config', parsedVal);
                                    } else if (row.key === 'comm_prefs') {
                                        const commRecord = { key: 'comm_prefs', ...parsedVal };
                                        await this.db.put('config', commRecord);
                                        this._applyCommPrefsRecord(commRecord);
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
            const lookup = this.buildClientLookup(clients);

            const currentYearOrders = allOrders.filter(o => {
                return getYearFromDate(o.dateISO || o.date) === year;
            }).sort((a, b) => {
                const numA = a.displayId || parseInt(String(a.id).split('-').pop());
                const numB = b.displayId || parseInt(String(b.id).split('-').pop());
                return numA - numB;
            });

            const ordersSheetData = currentYearOrders.map(o => {
                const client = this.resolveClientForOrder(o, lookup) || {};
                return {
                    "Nº Pedido": o.displayId || String(o.id).split('-').pop(),
                    "Fecha": o.dateISO || o.date,
                    "Código Cliente": client.code || o.clientCode || "---",
                    "Cliente": client.name || o.shop || o["Cliente"],
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
                const client = this.resolveClientForOrder(o, lookup);
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
            const lookup = this.buildClientLookup(clients);

            const ordersByClientKey = {};
            orders.forEach(o => {
                const matched = this.resolveClientForOrder(o, lookup);
                const key = matched ? `code_${matched.code}` : `shop_${normalizeTextKey(o.shop)}`;
                if (!ordersByClientKey[key]) ordersByClientKey[key] = [];
                ordersByClientKey[key].push(o);
            });

            const vipCandidates = [];

            clients.forEach(client => {
                const key = `code_${client.code}`;
                const fallbackKey = `shop_${normalizeTextKey(client.name)}`;
                const rawClientOrders = ordersByClientKey[key] || ordersByClientKey[fallbackKey] || [];
                const clientOrders = rawClientOrders
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

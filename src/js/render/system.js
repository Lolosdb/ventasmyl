/**
 * Lógica de Sistema, Ajustes, Backups e Información
 */

// --- AJUSTES Y SISTEMA (REDiseño PREMIUM) ---
// --- AJUSTES Y SISTEMA (REDiseño PREMIUM) ---
async function renderAjustes(isBack = false) {
    if (typeof updateHistoryState === 'function') updateHistoryState('ajustes', isBack);
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Backups', { showBack: true });

    const currentUrl = localStorage.getItem('apps_script_url') || DEFAULT_SCRIPT_URL;
    const lastBackup = localStorage.getItem('last_auto_backup_str') || 'Sin registros';
    const orders = await dataManager.getOrders();
    const salesHistory = await dataManager.getSalesHistory();
    const configuredYears = Object.keys(salesHistory).sort((a,b) => a - b);

    let contentHtml = `<main class="ajustes-container fade-in-up">`;
    
    contentHtml += `
        <p class="text-sm text-slate-500 font-bold mb-8 px-2 leading-relaxed">
            Gestiona la seguridad de tus datos y la conectividad con la nube.
        </p>
    `;

    // SECCIÓN 1: SEGURIDAD Y COPIAS
    contentHtml += `<span class="ajustes-section-label">Seguridad y Copias</span>`;
    
    // Card Nube
    contentHtml += `
        <div class="ajustes-card">
            <div class="ajustes-header">
                <div class="ajustes-icon-box bg-purple-lite">
                    <span class="material-icons-round">cloud_done</span>
                </div>
                <div>
                    <h3 class="ajustes-title">Copia en la Nube</h3>
                    <p class="ajustes-subtitle">Sincroniza tus datos con Google Drive.</p>
                </div>
            </div>
            
            <div class="btn-grid">
                <button class="btn-ajuste btn-nube-primary" onclick="initiateDriveBackup()">
                    <span class="material-icons-round">cloud_upload</span>
                    <span>Guardar Ahora</span>
                </button>
                <button class="btn-ajuste btn-nube-secondary" onclick="openBackupsModal()">
                    <span class="material-icons-round">history</span>
                    <span>Ver Historial</span>
                </button>
            </div>

            <div class="status-box-lite">
                <span class="material-icons-round">schedule</span>
                <p>Auto-Backup L-V 20:30h<br><strong>Última:</strong> ${lastBackup}</p>
            </div>
        </div>
    `;

    // Card Local
    contentHtml += `
        <div class="ajustes-card">
            <div class="ajustes-header">
                <div class="ajustes-icon-box bg-blue-lite">
                    <span class="material-icons-round">inventory_2</span>
                </div>
                <div>
                    <h3 class="ajustes-title">Archivo Local (Excel)</h3>
                    <p class="ajustes-subtitle">Exporta o importa tus datos manualmente.</p>
                </div>
            </div>

            <div class="btn-grid">
                <button class="btn-ajuste btn-local-primary" onclick="handleExcelExport()">
                    <span class="material-icons-round">file_download</span>
                    <span>Descargar Excel</span>
                </button>
                <button class="btn-ajuste btn-nube-primary" onclick="handleExcelDriveExport()">
                    <span class="material-icons-round">cloud_upload</span>
                    <span>Excel a Drive</span>
                </button>
                <button class="btn-ajuste btn-local-secondary" onclick="document.getElementById('excelBackupInput').click()">
                    <span class="material-icons-round">file_upload</span>
                    <span>Importar</span>
                </button>
                <input type="file" id="excelBackupInput" style="display:none;" onchange="handleExcelImport(this)">
            </div>
        </div>
    `;

    // SECCIÓN 2: CONECTIVIDAD CLOUD
    contentHtml += `<span class="ajustes-section-label">Conectividad Cloud</span>`;
    
    contentHtml += `
        <div class="ajustes-card">
            <div class="ajustes-header">
                <div class="ajustes-icon-box bg-rose-lite">
                    <span class="material-icons-round">settings_remote</span>
                </div>
                <div>
                    <h3 class="ajustes-title">Configuración del Script</h3>
                    <p class="ajustes-subtitle">Enlace técnico con Google Apps Script.</p>
                </div>
            </div>

            <div class="premium-input-card">
                <label class="premium-input-label">URL del Servidor</label>
                <input type="text" id="scriptUrlInput" class="url-input" 
                       value="${currentUrl}" 
                       placeholder="https://script.google.com/..."
                       onchange="updateScriptUrl(this.value)">
            </div>

            <div class="conn-footer">
                <div id="syncStatus" class="sync-status-indicator" style="color: #64748b;">
                    <span class="material-icons-round" style="font-size: 18px;">sensors</span>
                    <span>Estado: Desconocido</span>
                </div>
                <button class="btn-test-conn" onclick="testConnection()">
                    <span class="material-icons-round" style="font-size: 16px;">refresh</span>
                    Probar enlace
                </button>
            </div>

            <button class="btn-force-sync" onclick="initiateDriveBackup()">
                <span class="material-icons-round">sync</span>
                <span>Sincronizar todo ahora (${orders.length})</span>
            </button>
        </div>
    `;

    // SECCIÓN 3: GESTIÓN DE DATOS Y SISTEMA
    contentHtml += `<span class="ajustes-section-label">Sistema y Datos</span>`;
    
    contentHtml += `
        <div class="ajustes-card">
            <div class="integrated-header">
                <div class="flex items-center gap-3">
                    <div class="ajustes-icon-box bg-green-lite">
                        <span class="material-icons-round">calendar_today</span>
                    </div>
                    <h3 class="ajustes-title">Gestión de Años</h3>
                </div>
                <button class="btn-add-action" onclick="openManagementYearsModal()">
                    <span class="material-icons-round" style="font-size: 16px;">add</span>
                    Añadir
                </button>
            </div>
            
            <p class="text-[11px] font-bold text-slate-400 mb-3 ml-1">AÑOS ACTIVOS EN TABLAS:</p>
            <div class="years-pill-cloud">
                ${configuredYears.map(y => `<span class="pill-year">${y}</span>`).join('')}
            </div>
        </div>
    `;

    // Banner Alerta
    contentHtml += `
        <div class="ajustes-banner-alert">
            <div class="alert-icon-box">
                <span class="material-icons-round">security</span>
            </div>
            <div class="alert-content">
                <p>Protección de Datos: Realiza copias regularmente.</p>
                <p style="opacity: 0.7; font-weight: 500;">Los cambios en el historial son permanentes.</p>
            </div>
        </div>
    `;

    // Versión
    contentHtml += `
        <div class="app-version-footer">
            <p>App Ventas v5.0 • marzo 2026</p>
        </div>
    `;

    contentHtml += `</main>`;
    contentHtml += renderBottomNav(null);
    app.innerHTML = headerHtml + contentHtml;
    
    injectManagementYearsModal();

    // Verificación automática de la conexión al abrir los ajustes
    setTimeout(() => {
        if (typeof checkConnectionStatus === 'function') checkConnectionStatus(true);
    }, 100);
}

// --- LOGICA DE // Función núcleo de backup (puede ser manual o automática)
async function performDriveBackup(isSilent = false) {
    try {
        const fullData = await dataManager.exportFullBackup();
        console.log(`[Backup] Exportando ${fullData.orders.length} pedidos, ${fullData.clients.length} clientes...`);

        const payload = {
            action: 'fullBackup',
            data: {
                ...fullData,
                timestamp: new Date().toISOString()
            }
        };

        let url = localStorage.getItem('apps_script_url');
        if (!url || url.includes('/edit')) {
            url = DEFAULT_SCRIPT_URL;
            localStorage.setItem('apps_script_url', DEFAULT_SCRIPT_URL);
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        const text = await res.text();
        let result;
        try {
            result = JSON.parse(text);
        } catch (jsonErr) {
            if (text.trim().startsWith('<')) {
                throw new Error("El servidor de Google devolvió una respuesta HTML en lugar de JSON. Revisa la URL y los permisos del Apps Script.");
            }
            throw jsonErr;
        }

        if (result.success || result.status === 'success') {
            const now = new Date();
            const nowStr = now.toLocaleString();
            localStorage.setItem('last_auto_backup', now.getTime().toString());
            localStorage.setItem('last_auto_backup_str', nowStr);
            
            const backups = JSON.parse(localStorage.getItem('app_backups') || '[]');
            backups.unshift({ date: now.toISOString(), status: 'OK', count: fullData.orders.length });
            localStorage.setItem('app_backups', JSON.stringify(backups.slice(0, 10)));
            
            if (!isSilent) alert(`Copia de seguridad en la nube completada (${fullData.orders.length} pedidos, ${fullData.clients.length} clientes).`);
            if (window.currentView === 'ajustes') renderAjustes();
            return true;
        } else {
            if (!isSilent) alert("Fallo en Drive: " + (result.message || "Error al guardar la copia."));
            return false;
        }
    } catch (e) {
        console.error("Backup Error", e);
        if (!isSilent) alert("Error al realizar la copia de seguridad: " + e.message);
        return false;
    }
}

// Interfaz manual (con botón y confirmación)
async function initiateDriveBackup() {
    if (!confirm("Se guardará una copia de tus pedidos, clientes y departamentos en Google Drive. ¿Continuar?")) return;
    
    const btn = event.currentTarget || document.activeElement;
    if (btn && btn.innerHTML) {
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<span class="material-icons-round animate-spin">sync</span> Procesando...';
        btn.disabled = true;
        
        await performDriveBackup(false);
        
        btn.innerHTML = originalContent;
        btn.disabled = false;
    } else {
        await performDriveBackup(false);
    }
}

async function openBackupsModal() {
    let modal = document.getElementById('backupsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'backupsModal';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }

    // Lock background scroll
    document.body.style.overflow = 'hidden';

    // Modal Style Reset & Main Structure (Explicit Inline Styles)
    modal.innerHTML = `
        <div class="modal-content" style="border-radius: 28px; overflow: hidden; padding: 0; box-shadow: 0 25px 60px rgba(0,0,0,0.3); max-width: 520px; width: 95%; background-color: #fff; margin: auto;">
            <!-- Header (Fixed at top) -->
            <div style="background-color: #009ee3; padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 10;">
                <h2 style="font-size: 1.25rem; font-weight: 800; color: #ffffff; margin: 0; font-family: 'Inter', sans-serif;">Copias Disponibles</h2>
                <button style="background: transparent; border: none; color: #ffffff; cursor: pointer; padding: 4px; display: flex;" onclick="closeBackupsModal()">
                    <span class="material-icons-round" style="font-size: 24px;">close</span>
                </button>
            </div>
            
            <!-- List Body Container with Internal Scroll (FIXED SCROLL) -->
            <div id="backupsListContainer" style="padding: 1.75rem; max-height: 70vh; overflow-y: auto; background-color: #fff; scrollbar-width: thin; scrollbar-color: #e2e8f0 transparent;">
                <!-- Loading State -->
                <div style="display: flex; flex-direction: column; items-center; justify-content: center; text-align: center; padding-top: 4rem; padding-bottom: 4rem;">
                    <p style="font-size: 1.1rem; font-weight: 600; color: #64748b; margin-bottom: 0.5rem;">Cargando copias desde Drive...</p>
                    <p style="font-size: 0.85rem; color: #94a3b8; font-weight: 500;">Esto puede tardar unos segundos</p>
                </div>
            </div>
        </div>
    `;
    modal.classList.add('open');

    // Separar error de Drive del caso "no hay copias" para dar feedback claro al usuario
    let driveError = null;
    let driveFiles = null;

    try {
        let url = localStorage.getItem('apps_script_url');
        if (!url || url.includes('/edit')) {
            url = DEFAULT_SCRIPT_URL;
            localStorage.setItem('apps_script_url', DEFAULT_SCRIPT_URL);
        }
        let response = await fetch(url + (url.includes('?') ? '&' : '?') + "action=list");
        let text = await response.text();
        let result;
        try {
            result = JSON.parse(text);
        } catch (jsonErr) {
            if (text.trim().startsWith('<')) {
                throw new Error("El servidor de Google devolvió una página HTML en lugar de datos JSON. Esto ocurre cuando la URL es incorrecta o la Aplicación Web en Google Apps Script no está configurada para 'Cualquier persona' (Anyone).");
            }
            throw jsonErr;
        }

        if ((result.status !== "success" && !result.success) || !result.files) {
            response = await fetch(url + (url.includes('?') ? '&' : '?') + "action=getBackups");
            text = await response.text();
            try {
                result = JSON.parse(text);
            } catch (jsonErr) {
                if (text.trim().startsWith('<')) {
                    throw new Error("El servidor de Google devolvió una página HTML en lugar de datos JSON. Verifica la URL y los permisos en Google Apps Script.");
                }
                throw jsonErr;
            }
        }

        if ((result.status === "success" || result.success) && result.files) {
            // Filtrar archivos Excel (.xlsx) — no son copias de seguridad restaurables
            driveFiles = result.files.filter(f => !f.name.toLowerCase().endsWith('.xlsx'));
        } else {
            driveError = result.message || "El servidor no devolvió copias válidas.";
        }
    } catch (e) {
        console.error("Error al obtener copias de Drive:", e);
        driveError = e.message || "Error de conexión con Google Drive.";
    }

    const container = document.getElementById('backupsListContainer');
    const localBackups = JSON.parse(localStorage.getItem('app_backups') || '[]');

    let html = '';

    // --- SECCIÓN NUBE ---
    if (driveError) {
        // Mostrar banner de error informativo en lugar de silenciar el fallo
        html += `
            <div style="background-color: #fff7ed; border: 1.5px solid #fed7aa; border-radius: 16px; padding: 1rem 1.25rem; margin-bottom: 1.5rem; display: flex; gap: 12px; align-items: flex-start;">
                <span class="material-icons-round" style="color: #f97316; font-size: 22px; margin-top: 2px; flex-shrink: 0;">cloud_off</span>
                <div>
                    <p style="font-size: 0.8rem; font-weight: 800; color: #9a3412; margin: 0 0 4px;">No se pudo conectar con Google Drive</p>
                    <p style="font-size: 0.72rem; color: #c2410c; font-weight: 500; margin: 0; word-break: break-word;">${driveError}</p>
                    <p style="font-size: 0.68rem; color: #9a3412; font-weight: 600; margin: 6px 0 0; opacity: 0.75;">Comprueba la URL del script en Ajustes o vuelve a intentarlo.</p>
                </div>
            </div>
        `;
    } else if (!driveFiles || driveFiles.length === 0) {
        html += `
            <div style="text-align: center; padding: 2rem 0 1rem; opacity: 0.4;">
                <span class="material-icons-round" style="font-size: 48px; color: #94a3b8;">cloud_done</span>
                <p style="font-size: 0.8rem; font-weight: 700; color: #64748b; margin-top: 0.5rem;">No hay copias en Google Drive</p>
            </div>
        `;
    } else {
        html += `
            <p style="font-size: 0.65rem; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;">Copias en la Nube</p>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                ${driveFiles.map(f => {
                    const sizeStr = f.size ? `${(f.size / 1024).toFixed(1)} KB` : "—";
                    return `
                    <div style="padding: 1.25rem; border: 1.5px solid #f1f5f9; border-radius: 20px; display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: center; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                        <div style="flex: 1 1 150px; padding-right: 0.5rem;">
                            <p style="font-size: 0.875rem; font-weight: 800; color: #1e293b; margin: 0; line-height: 1.2;">${f.name}</p>
                            <p style="font-size: 0.725rem; color: #64748b; font-weight: 600; margin-top: 6px;">
                                ${new Date(f.date).toLocaleDateString()} - ${sizeStr}
                            </p>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <button onclick="handleDeleteRemoteFile('${f.id}', '${f.name}')" 
                                    style="width: 40px; height: 40px; border-radius: 50%; background-color: #fee2e2; border: none; color: #ef4444; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                                <span class="material-icons-round" style="font-size: 20px;">delete_outline</span>
                            </button>
                            <button onclick="handleRemoteRestore('${f.id}', '${f.name}')" 
                                    style="display: flex; align-items: center; gap: 8px; background-color: #9333ea; color: #ffffff; border: none; padding: 10px 18px; border-radius: 12px; font-size: 0.75rem; font-weight: 800; cursor: pointer; box-shadow: 0 4px 6px -1px rgba(147, 51, 234, 0.3);">
                                <span class="material-icons-round" style="font-size: 18px;">cloud_download</span>
                                <span>Restaurar</span>
                            </button>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
            <div style="height: 1.5rem;"></div>
        `;
    }

    // --- SECCIÓN LOCAL (siempre visible si hay copias) ---
    if (localBackups.length > 0) {
        html += `
            <p style="font-size: 0.65rem; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem; ${driveFiles && driveFiles.length > 0 ? 'border-top: 1px solid #f1f5f9; padding-top: 1.5rem;' : ''}">Copias Locales</p>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                ${localBackups.map(b => `
                    <div style="padding: 1.25rem; border: 1.5px solid #f1f5f9; border-radius: 20px; display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center; background-color: #ffffff;">
                        <div style="flex: 1 1 150px;">
                            <p style="font-size: 0.825rem; font-weight: 800; color: #1e293b; margin: 0;">${new Date(b.date).toLocaleString()}</p>
                            <p style="font-size: 0.65rem; color: #10b981; font-weight: 800; text-transform: uppercase; margin-top: 4px;">Sincronizado localmente</p>
                        </div>
                        <button style="background-color: #9333ea; color: #ffffff; border: none; padding: 10px 18px; border-radius: 12px; font-size: 0.75rem; font-weight: 800;">Local</button>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (!driveFiles && !driveError) {
        // Sin nube y sin local
        html = `
            <div style="text-align: center; padding-top: 4rem; padding-bottom: 4rem; opacity: 0.3;">
                <span class="material-icons-round" style="font-size: 64px;">cloud_off</span>
                <p style="font-weight: 800; margin-top: 1rem;">No se encontraron copias</p>
            </div>
        `;
    }

    container.innerHTML = html;
}

function closeBackupsModal() {
    const modal = document.getElementById('backupsModal');
    if (modal) {
        modal.classList.remove('open');
        // Restore background scroll
        document.body.style.overflow = '';
    }
}

async function handleDeleteRemoteFile(fileId, fileName) {
    if (!confirm(`¿Seguro que quieres eliminar definitivamente la copia "${fileName}" de Google Drive?`)) return;
    
    try {
        let url = localStorage.getItem('apps_script_url');
        if (!url || url.includes('/edit')) {
            url = DEFAULT_SCRIPT_URL;
            localStorage.setItem('apps_script_url', DEFAULT_SCRIPT_URL);
        }
        const deleteUrl = `${url}${url.includes('?') ? '&' : '?'}action=delete&id=${fileId}`;
        
        // Mostrar carga temporal
        const container = document.getElementById('backupsListContainer');
        const originalHtml = container.innerHTML;
        container.innerHTML = `<div class="text-center py-20 text-red-400 font-bold">Eliminando de Drive...</div>`;

        const response = await fetch(deleteUrl);
        const text = await response.text();
        let result;
        try {
            result = JSON.parse(text);
        } catch (jsonErr) {
            if (text.trim().startsWith('<')) {
                throw new Error("Respuesta HTML de Google Apps Script. Revisa la URL y permisos.");
            }
            throw jsonErr;
        }

        if (result.status === "success" || result.success) {
            // Cerramos y reabrimos para forzar el listado nuevo (o solo re-abrir)
            openBackupsModal(); 
        } else {
            throw new Error(result.message || "Fallo al borrar");
        }
    } catch (e) {
        console.error("Delete Error:", e);
        alert("Error al eliminar la copia: " + e.message);
        openBackupsModal(); // Restaurar vista original
    }
}


async function handleRemoteRestore(fileId, fileName) {
    if (!confirm(`¿Deseas descargar y restaurar la copia "${fileName}"? Se perderán los cambios locales no guardados.`)) return;
    
    alert("Iniciando descarga de copia remota...");
    const url = localStorage.getItem('apps_script_url') || DEFAULT_SCRIPT_URL;
    
    try {
        console.log(`Solicitando descarga de backup ID: ${fileId} (${fileName})...`);
        const response = await fetch(url + (url.includes('?') ? '&' : '?') + `action=get&id=${fileId}`);
        const text = await response.text();
        let result;
        try {
            result = JSON.parse(text);
        } catch (jsonErr) {
            if (text.trim().startsWith('<')) {
                throw new Error("Respuesta HTML de Google Apps Script. Revisa la URL y permisos.");
            }
            throw jsonErr;
        }
        
        if ((result.status === "success" || result.success) && result.data) {
            let backupData = result.data;

            // Si los datos vienen en Base64 (estándar de Drive en este script), los decodificamos
            if (typeof backupData === 'string' && !backupData.trim().startsWith('{')) {
                try {
                    // Decodificar Base64 manejando caracteres especiales (UTF-8)
                    const binaryString = atob(backupData);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    const decodedData = new TextDecoder().decode(bytes);
                    backupData = JSON.parse(decodedData);
                } catch (e) {
                    console.error("Error decodificando Base64:", e);
                }
            } else if (typeof backupData === 'string') {
                try { backupData = JSON.parse(backupData); } catch(e) {}
            }
            
            if (!backupData || (typeof backupData === 'object' && Object.keys(backupData).length === 0)) {
                throw new Error("El archivo de copia está vacío o no es válido.");
            }

            // Validar que tiene estructura de backup real (no es un Excel u otro archivo)
            const hasBackupStructure = backupData.clients || backupData.orders ||
                                       backupData.config || backupData.departments ||
                                       (backupData.data && (backupData.data.clients || backupData.data.orders));
            if (!hasBackupStructure) {
                throw new Error("El archivo seleccionado no es una copia de seguridad válida. Solo se pueden restaurar copias generadas por la aplicación.");
            }

            await dataManager.restoreFullBackup(backupData);
            alert("Restauración completada con éxito. La página se recargará para mostrar los datos.");
            window.location.reload();
        } else {
            throw new Error(result.message || "Error en la descarga desde Drive");
        }

    } catch (e) {
        alert("Error al restaurar: " + e.message);
    }
}

// --- EXCEL LOGIC ---
async function handleExcelExport() {
    const res = await dataManager.exportBackupToExcel();
    if (res.success) alert("Excel generado con éxito");
}

async function handleExcelDriveExport() {
    if (!confirm("Se guardará una copia completa en formato Excel (con todos los pedidos, clientes y departamentos) directamente en Google Drive. ¿Continuar?")) return;
    const btn = event ? (event.currentTarget || event.target) : null;
    let orig = '';
    if (btn) {
        orig = btn.innerHTML;
        btn.innerHTML = '<span class="material-icons-round animate-spin">sync</span> Subiendo Excel...';
        btn.disabled = true;
    }

    try {
        const url = localStorage.getItem('apps_script_url') || DEFAULT_SCRIPT_URL;
        const res = await dataManager.exportBackupToExcelDrive(url);
        if (res.success) {
            alert(`Copia completa en Excel (${res.filename}) guardada con éxito en Google Drive.`);
        } else {
            alert("Error al guardar Excel en Drive: " + res.message);
        }
    } catch (e) {
        alert("Error de conexión: " + e.message);
    } finally {
        if (btn) {
            btn.innerHTML = orig;
            btn.disabled = false;
        }
    }
}

async function handleExcelImport(input) {
    if (!input.files || input.files.length === 0) return;
    if (!confirm("Se reemplazarán todos los datos actuales por los del archivo. ¿Confirmar?")) return;
    
    const res = await dataManager.importBackupFromExcel(input.files[0]);
    if (res.success) {
        alert("Datos restaurados con éxito");
        window.location.reload();
    } else {
        alert("Error al importar: " + res.message);
    }
}

// --- CONFIGURACIÓN DINÁMICA ---
function updateScriptUrl(url) {
    if (!url) return;
    localStorage.setItem('apps_script_url', url.trim());
    console.log("Script URL updated:", url);
    checkConnectionStatus(true);
}

async function checkConnectionStatus(isSilent = true) {
    const statusEl = document.getElementById('syncStatus');
    const urlInput = document.getElementById('scriptUrlInput');
    let url = urlInput ? urlInput.value.trim() : '';
    if (!url) url = localStorage.getItem('apps_script_url') || DEFAULT_SCRIPT_URL;

    if (!url) {
        if (statusEl) {
            statusEl.innerHTML = `
                <span class="material-icons-round" style="color: #ef4444; font-size: 18px;">error</span>
                <span style="color: #ef4444; font-weight: 700;">Estado: URL no configurada</span>
            `;
        }
        return false;
    }

    if (statusEl) {
        statusEl.innerHTML = `
            <span class="material-icons-round animate-spin" style="color: #009ee3; font-size: 18px;">sync</span>
            <span style="color: #64748b;">Comprobando conexión...</span>
        `;
    }

    try {
        const testUrl = url + (url.includes('?') ? '&' : '?') + "action=ping";
        const response = await fetch(testUrl, { method: 'GET', cache: 'no-cache' });
        const text = await response.text();

        let isOk = response.ok;
        if (text && text.trim().startsWith('{')) {
            try {
                const json = JSON.parse(text);
                if (json.status === 'success' || json.success || json.pong) isOk = true;
            } catch (e) {}
        }

        if (statusEl) {
            statusEl.innerHTML = `
                <span class="material-icons-round" style="color: #10b981; font-size: 18px;">check_circle</span>
                <span style="color: #10b981; font-weight: 700;">Estado: Sincronización activa</span>
            `;
        }
        if (!isSilent) alert("Conexión activa. La URL es válida y el servidor responde correctamente.");
        return true;
    } catch (e) {
        console.warn("Connection Status Check Error:", e);
        if (statusEl) {
            statusEl.innerHTML = `
                <span class="material-icons-round" style="color: #ef4444; font-size: 18px;">error</span>
                <span style="color: #ef4444; font-weight: 700;">Estado: Error de conexión</span>
            `;
        }
        if (!isSilent) alert("No se pudo alcanzar el script. Verifica la conexión o la URL.");
        return false;
    }
}

async function testConnection() {
    const btn = event ? (event.currentTarget || event.target) : null;
    let originalContent = '';
    if (btn) {
        originalContent = btn.innerHTML;
        btn.innerHTML = '<span class="material-icons-round animate-spin">sync</span>';
        btn.disabled = true;
    }

    try {
        await checkConnectionStatus(false);
    } finally {
        if (btn) {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    }
}

// Periódico Automático
// Periódico Automático
function startBackupScheduler() {
    const checkAndRun = () => {
        const lastBackupTime = localStorage.getItem('last_auto_backup');
        const now = new Date();
        const day = now.getDay(); 
        const hours = now.getHours();
        const minutes = now.getMinutes();

        // Configuración: Lunes (1) a Viernes (5) después de las 20:30
        const isWorkDay = (day >= 1 && day <= 5);
        const isAfterTime = (hours > 20 || (hours === 20 && minutes >= 30));

        if (isWorkDay && isAfterTime) {
            // Comprobar si ya se hizo una copia HOY
            if (lastBackupTime) {
                const lastDate = new Date(parseInt(lastBackupTime));
                if (lastDate.toDateString() === now.toDateString()) {
                    console.log("Auto-Backup: Ya se realizó la copia correspondiente a hoy.");
                    return;
                }
            }
            
            console.log("Iniciando única copia automática del día (Rango 20:30 - 00:00)...");
            performDriveBackup(true); // El true indica modo silencioso (sin alertas)
        }
    };

    // Ejecutar inmediatamente al abrir la app
    checkAndRun();

    // Y dejar un vigilante cada 15 minutos por si la app se queda abierta en segundo plano
    setInterval(checkAndRun, 15 * 60 * 1000); 
}

function injectManagementYearsModal() {
    if (document.getElementById('yearsModal')) return;
    const html = `
        <div id="yearsModal" class="modal-overlay">
            <div class="modal-content" style="border-radius: 28px;">
                <div class="modal-header">
                    <h2 class="text-xl font-black">Añadir Nuevo Año</h2>
                    <button class="icon-btn text-white" onclick="closeManagementYearsModal()">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                <div class="modal-body p-10">
                    <p class="text-sm text-slate-500 mb-6 font-medium leading-relaxed">
                        Introduce el año que deseas habilitar en el sistema. Se crearán tablas de historial vacías para ventas y facturación.
                    </p>
                    <label class="premium-form-label">AÑO (YYYY)</label>
                    <input type="number" id="newYearInput" class="premium-form-input" 
                           value="${new Date().getFullYear() + 1}" placeholder="Ej: 2027">
                    
                    <div class="flex gap-4 mt-8">
                        <button class="btn-link-cancel flex-1" onclick="closeManagementYearsModal()">
                            <span class="material-icons-round">close</span>
                            Cancelar
                        </button>
                        <button class="flex-1 btn-premium-save" onclick="handleAddNewYear()">Crear Año</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
}

function openManagementYearsModal() {
    injectManagementYearsModal();
    document.getElementById('yearsModal').classList.add('open');
}

function closeManagementYearsModal() {
    document.getElementById('yearsModal').classList.remove('open');
}

async function handleAddNewYear() {
    const year = parseInt(document.getElementById('newYearInput').value);
    if (!year || year < 2000 || year > 2100) return alert("Año no válido");
    
    if (confirm(`¿Habilitar el año ${year} en el sistema?`)) {
        await dataManager.ensureYearExists(year);
        alert(`Año ${year} configurado con éxito.`);
        closeManagementYearsModal();
        renderAjustes();
    }
}

// Globales
window.renderAjustes = renderAjustes;
window.initiateDriveBackup = initiateDriveBackup;
window.performDriveBackup = performDriveBackup;
window.startBackupScheduler = startBackupScheduler;
window.openBackupsModal = openBackupsModal;
window.handleExcelExport = handleExcelExport;
window.handleExcelDriveExport = handleExcelDriveExport;
window.handleExcelImport = handleExcelImport;
window.updateScriptUrl = updateScriptUrl;
window.checkConnectionStatus = checkConnectionStatus;
window.testConnection = testConnection;
window.openManagementYearsModal = openManagementYearsModal;
window.closeManagementYearsModal = closeManagementYearsModal;
window.handleAddNewYear = handleAddNewYear;

// Iniciar se gestiona desde main.js

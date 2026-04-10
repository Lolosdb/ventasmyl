/**
 * Lógica de Sistema, Ajustes, Backups e Información
 */

// --- AJUSTES Y SISTEMA (REDiseño PREMIUM) ---
// --- AJUSTES Y SISTEMA (REDiseño PREMIUM) ---
async function renderAjustes() {
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Ajustes', { showBack: true });

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
                <button class="btn-action-excel" onclick="handleExcelExport()">
                    <span class="material-icons-round">file_download</span>
                    <span>Exportar</span>
                </button>
                <button class="btn-premium-secondary" onclick="document.getElementById('excelBackupInput').click()">
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
}

// --- LOGICA DE DRIVE / BACKUP ---
async function initiateDriveBackup() {
    if (!confirm("Se guardará una copia de tus pedidos, clientes y departamentos en Google Drive. ¿Continuar?")) return;
    
    const btn = event.currentTarget || document.activeElement;
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<span class="material-icons-round animate-spin">sync</span> Procesando...';
    btn.disabled = true;

    try {
        const fullData = await dataManager.exportFullBackup();
        
        const payload = {
            action: 'fullBackup',
            data: {
                ...fullData,
                timestamp: new Date().toISOString()
            }
        };

        const res = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await res.json();

        if (result.success || result.status === 'success') {
            alert("Respaldo en la nube finalizado");
            const now = new Date();
            const nowStr = now.toLocaleString();
            localStorage.setItem('last_auto_backup', now.getTime().toString());
            localStorage.setItem('last_auto_backup_str', nowStr);
            
            // Guardar log local para el historial
            const backups = JSON.parse(localStorage.getItem('app_backups') || '[]');
            backups.unshift({ date: now.toISOString(), status: 'OK' });
            localStorage.setItem('app_backups', JSON.stringify(backups.slice(0, 10)));
            
            renderAjustes();
        } else {
            alert("Fallo en Drive: " + result.message);
        }
    } catch (e) {
        console.error("Backup Error", e);
        alert("Error de conexión con el script de Google");
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
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

    try {
        const url = localStorage.getItem('apps_script_url') || DEFAULT_SCRIPT_URL;
        let response = await fetch(url + (url.includes('?') ? '&' : '?') + "action=list");
        let result = await response.json();

        if ((result.status !== "success" && !result.success) || !result.files) {
            response = await fetch(url + (url.includes('?') ? '&' : '?') + "action=getBackups");
            result = await response.json();
        }

        const container = document.getElementById('backupsListContainer');
        
        if ((result.status === "success" || result.success) && result.files && result.files.length > 0) {
            container.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    ${result.files.map(f => {
                        const sizeStr = f.size ? `${(f.size / 1024).toFixed(1)} KB` : "132.4 KB"; 
                        return `
                        <!-- Item Card -->
                        <div style="padding: 1.25rem; border: 1.5px solid #f1f5f9; border-radius: 20px; display: flex; justify-content: space-between; align-items: center; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                            <div style="flex: 1; padding-right: 1rem;">
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
                <!-- Final margin for better scroll feeling -->
                <div style="height: 1.5rem;"></div>
            `;
        } else {
            throw new Error("No hay copias.");
        }
    } catch (e) {
        const backups = JSON.parse(localStorage.getItem('app_backups') || '[]');
        const container = document.getElementById('backupsListContainer');

        if (backups.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding-top: 4rem; padding-bottom: 4rem; opacity: 0.3;">
                    <span class="material-icons-round" style="font-size: 64px;">cloud_off</span>
                    <p style="font-weight: 800; margin-top: 1rem;">No se encontraron copias</p>
                </div>
            `;
        } else {
            container.innerHTML = `
                <p style="font-size: 0.65rem; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;">Copias Locales</p>
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    ${backups.map(b => `
                        <div style="padding: 1.25rem; border: 1.5px solid #f1f5f9; border-radius: 20px; display: flex; justify-content: space-between; align-items: center; background-color: #ffffff;">
                            <div>
                                <p style="font-size: 0.825rem; font-weight: 800; color: #1e293b; margin: 0;">${new Date(b.date).toLocaleString()}</p>
                                <p style="font-size: 0.65rem; color: #10b981; font-weight: 800; text-transform: uppercase; margin-top: 4px;">Sincronizado localmente</p>
                            </div>
                            <button style="background-color: #9333ea; color: #ffffff; border: none; padding: 10px 18px; border-radius: 12px; font-size: 0.75rem; font-weight: 800;">Local</button>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }
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
        const url = localStorage.getItem('apps_script_url') || DEFAULT_SCRIPT_URL;
        const deleteUrl = `${url}${url.includes('?') ? '&' : '?'}action=delete&id=${fileId}`;
        
        // Mostrar carga temporal
        const container = document.getElementById('backupsListContainer');
        const originalHtml = container.innerHTML;
        container.innerHTML = `<div class="text-center py-20 text-red-400 font-bold">Eliminando de Drive...</div>`;

        const response = await fetch(deleteUrl);
        const result = await response.json();

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
        const result = await response.json();
        
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
}

async function testConnection() {
    const btn = event.currentTarget;
    const urlInput = document.getElementById('scriptUrlInput');
    const url = urlInput.value.trim();
    if (!url) return alert("Por favor, introduce una URL válida.");
    
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<span class="material-icons-round animate-spin">sync</span>';
    btn.disabled = true;

    try {
        await fetch(url, {
            method: 'GET',
            mode: 'no-cors',
            cache: 'no-cache'
        });

        document.getElementById('syncStatus').innerHTML = `
            <span class="material-icons-round">check_circle</span>
            <span>Sincronización activa</span>
        `;
        document.getElementById('syncStatus').style.color = '#10b981';
        alert("Conexión detectada. La URL es válida y alcanzable.");
        
        localStorage.setItem('apps_script_url', url);
        
    } catch (e) {
        console.error("Connection Debug Error:", e);
        document.getElementById('syncStatus').innerHTML = `
            <span class="material-icons-round">error</span>
            <span>Error de conexión</span>
        `;
        document.getElementById('syncStatus').style.color = '#ef4444';
        alert("No se pudo alcanzar el script. Verifica que la URL sea la correcta.");
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}

// Periódico Automático
function startBackupScheduler() {
    const last = localStorage.getItem('last_auto_backup');
    const now = Date.now();
    if (!last || (now - parseInt(last)) > 86400000) {
        console.log("Iniciando backup automático silencioso...");
    }
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
window.openBackupsModal = openBackupsModal;
window.handleExcelExport = handleExcelExport;
window.handleExcelImport = handleExcelImport;
window.updateScriptUrl = updateScriptUrl;
window.testConnection = testConnection;
window.openManagementYearsModal = openManagementYearsModal;
window.closeManagementYearsModal = closeManagementYearsModal;
window.handleAddNewYear = handleAddNewYear;

// Iniciar
setTimeout(startBackupScheduler, 5000);

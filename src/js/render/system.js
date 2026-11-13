/**
 * Lógica de Sistema, Ajustes, Backups e Información
 */

// --- AJUSTES Y BACKUPS (DISEÑO EJECUTIVO UNIFICADO) ---
async function renderAjustes(isBack = false) {
    if (typeof updateHistoryState === 'function') updateHistoryState('ajustes', isBack);
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Backups', { showBack: true });

    const currentUrl = localStorage.getItem('apps_script_url') || DEFAULT_SCRIPT_URL;
    const rawBackupTs = parseInt(localStorage.getItem('last_auto_backup') || '', 10);
    let lastBackup = localStorage.getItem('last_auto_backup_str') || 'Sin copias';
    if (!Number.isNaN(rawBackupTs) && rawBackupTs > 0) {
        const d = new Date(rawBackupTs);
        if (!Number.isNaN(d.getTime())) {
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const hh = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            lastBackup = `${dd}/${mm} · ${hh}:${min}`;
        }
    }

    const orders = await dataManager.getOrders();
    const clients = await dataManager.getClients();
    const visitNotes = typeof dataManager.getVisitNotes === 'function' ? await dataManager.getVisitNotes() : [];
    const salesHistory = await dataManager.getSalesHistory();
    const configuredYears = Object.keys(salesHistory).sort((a, b) => a - b);
    const currentYearStr = String(new Date().getFullYear());

    const currentWaPref = window.getWhatsAppPref ? window.getWhatsAppPref() : 'business';
    const currentEmailPref = window.getEmailPref ? window.getEmailPref() : 'default';
    const currentWorkEmail = window.getWorkEmailAddress ? window.getWorkEmailAddress() : '';

    let contentHtml = `<main class="ajustes-container fade-in-up">`;

    contentHtml += `<div class="sys-section-eyebrow">Copias de seguridad</div>`;

    // 1. COPIA DE SEGURIDAD EN LA NUBE (TARJETA PROTAGONISTA AZUL)
    contentHtml += `
        <section class="sys-pro-card sys-card-cloud-hero">
            <div class="sys-hero-banner">
                <div class="sys-card-head-left">
                    <div class="sys-icon-box sys-icon-hero">
                        <span class="material-icons-round">cloud_done</span>
                    </div>
                    <div>
                        <h3 class="sys-card-title sys-title-white">Copia en la Nube</h3>
                        <p class="sys-card-subtitle sys-sub-white">Respaldo completo en Google Drive</p>
                    </div>
                </div>
                <span class="sys-hero-badge">Auto 20:30</span>
            </div>

            <div class="sys-hero-stats-grid">
                <div class="sys-hero-stat">
                    <span class="sys-hero-stat-val">${orders.length}</span>
                    <span class="sys-hero-stat-lbl">Pedidos</span>
                </div>
                <div class="sys-hero-stat">
                    <span class="sys-hero-stat-val">${clients.length}</span>
                    <span class="sys-hero-stat-lbl">Clientes</span>
                </div>
                <div class="sys-hero-stat">
                    <span class="sys-hero-stat-val">${visitNotes.length}</span>
                    <span class="sys-hero-stat-lbl">Notas</span>
                </div>
            </div>

            <div class="sys-btn-grid-2">
                <button type="button" class="sys-btn-primary" onclick="initiateDriveBackup()">
                    <span class="material-icons-round">cloud_upload</span>
                    <span>Guardar Ahora</span>
                </button>
                <button type="button" class="sys-btn-secondary" onclick="openBackupsModal()">
                    <span class="material-icons-round">history</span>
                    <span>Ver Historial</span>
                </button>
            </div>

            <div class="sys-info-strip">
                <div class="sys-info-strip-left">
                    <span class="material-icons-round">schedule</span>
                    <span>Auto-Backup L–V</span>
                </div>
                <span class="sys-info-strip-badge">Última: ${lastBackup}</span>
            </div>
        </section>
    `;

    // 2. COPIA EN ARCHIVO EXCEL (.XLSX) - ACENTO VERDE EXCEL
    contentHtml += `
        <section class="sys-pro-card sys-card-excel">
            <div class="sys-card-head">
                <div class="sys-card-head-left">
                    <div class="sys-icon-box sys-icon-excel">
                        <span class="material-icons-round">table_view</span>
                    </div>
                    <div>
                        <h3 class="sys-card-title">Copia en Excel (.XLSX)</h3>
                        <p class="sys-card-subtitle">Exporta o restaura tus hojas de cálculo</p>
                    </div>
                </div>
            </div>

            <div class="sys-btn-grid-2">
                <button type="button" class="sys-btn-excel" onclick="handleExcelExport()">
                    <span class="material-icons-round">file_download</span>
                    <span>Descargar</span>
                </button>
                <button type="button" class="sys-btn-secondary sys-btn-excel-sec" onclick="document.getElementById('excelBackupInput').click()">
                    <span class="material-icons-round">file_upload</span>
                    <span>Importar</span>
                </button>
            </div>

            <button type="button" class="sys-btn-soft-excel" onclick="handleExcelDriveExport()">
                <span class="material-icons-round">cloud_upload</span>
                <span>Subir copia Excel a Google Drive</span>
            </button>
            <input type="file" id="excelBackupInput" accept=".xlsx,.xls" style="display:none;" onchange="handleExcelImport(this)">
        </section>
    `;

    contentHtml += `<div class="sys-section-eyebrow">Preferencias y sistema</div>`;

    // 3. CANALES DE COMUNICACIÓN (WHATSAPP Y CORREO) - ACENTO ÍNDIGO
    contentHtml += `
        <section class="sys-pro-card sys-card-comm">
            <div class="sys-card-head">
                <div class="sys-card-head-left">
                    <div class="sys-icon-box sys-icon-comm">
                        <span class="material-icons-round">forum</span>
                    </div>
                    <div>
                        <h3 class="sys-card-title">WhatsApp y Correo</h3>
                        <p class="sys-card-subtitle">Apps predeterminadas para contactar clientes</p>
                    </div>
                </div>
            </div>

            <div class="sys-field-group">
                <label class="sys-field-label">Aplicación de WhatsApp</label>
                <select class="sys-select-control" style="cursor: pointer;" onchange="window.setWhatsAppPref(this.value)">
                    <option value="business" ${currentWaPref === 'business' ? 'selected' : ''}>WhatsApp Business (Por defecto)</option>
                    <option value="personal" ${currentWaPref === 'personal' ? 'selected' : ''}>WhatsApp Personal</option>
                    <option value="ask" ${currentWaPref === 'ask' ? 'selected' : ''}>Preguntar siempre</option>
                </select>
            </div>

            <div class="sys-field-group">
                <label class="sys-field-label">Aplicación de Correo</label>
                <select class="sys-select-control" style="cursor: pointer;" onchange="window.setEmailPref(this.value)">
                    <option value="default" ${currentEmailPref === 'default' ? 'selected' : ''}>App de correo predeterminada</option>
                    <option value="gmail" ${currentEmailPref === 'gmail' ? 'selected' : ''}>Gmail</option>
                    <option value="outlook" ${currentEmailPref === 'outlook' ? 'selected' : ''}>Microsoft Outlook</option>
                    <option value="ask" ${currentEmailPref === 'ask' ? 'selected' : ''}>Preguntar siempre</option>
                </select>
            </div>

            <div class="sys-field-group">
                <label class="sys-field-label">Tu Correo de Trabajo (Opcional)</label>
                <input type="email" class="sys-input-control" data-no-clear="true"
                       value="${currentWorkEmail.replace(/"/g, '&quot;')}"
                       placeholder="Ej: comercial@tuempresa.com"
                       onchange="window.setWorkEmailAddress(this.value)">
            </div>
        </section>
    `;

    // 4. CONECTIVIDAD CON GOOGLE APPS SCRIPT
    contentHtml += `
        <section class="sys-pro-card sys-card-tech">
            <div class="sys-card-head">
                <div class="sys-card-head-left">
                    <div class="sys-icon-box sys-icon-tech">
                        <span class="material-icons-round">cloud_sync</span>
                    </div>
                    <div>
                        <h3 class="sys-card-title">Servidor Google Drive</h3>
                        <p class="sys-card-subtitle">Enlace técnico de Google Apps Script</p>
                    </div>
                </div>
            </div>

            <div class="sys-field-group">
                <label class="sys-field-label">URL del Servidor</label>
                <input type="text" id="scriptUrlInput" class="sys-input-control sys-input-mono" data-no-clear="true"
                       value="${currentUrl}" 
                       placeholder="https://script.google.com/..."
                       onchange="updateScriptUrl(this.value)">
            </div>

            <div class="sys-conn-bar">
                <div id="syncStatus" class="sync-status-indicator" style="color: #64748b;">
                    <span class="material-icons-round" style="font-size: 16px;">sensors</span>
                    <span>Comprobando...</span>
                </div>
                <button type="button" class="btn-test-conn" onclick="testConnection()">
                    <span class="material-icons-round" style="font-size: 15px;">refresh</span>
                    <span>Probar enlace</span>
                </button>
            </div>
        </section>
    `;

    // 5. GESTIÓN DE AÑOS COMERCIALES
    contentHtml += `
        <section class="sys-pro-card sys-card-years">
            <div class="sys-card-head">
                <div class="sys-card-head-left">
                    <div class="sys-icon-box sys-icon-years">
                        <span class="material-icons-round">date_range</span>
                    </div>
                    <div>
                        <h3 class="sys-card-title">Años Comerciales</h3>
                        <p class="sys-card-subtitle">Ejercicios activos en ventas</p>
                    </div>
                </div>
                <button type="button" class="btn-add-year-pro" onclick="openManagementYearsModal()">
                    <span class="material-icons-round" style="font-size: 16px;">add</span>
                    <span>Añadir</span>
                </button>
            </div>

            <div class="years-pill-cloud">
                ${configuredYears.map(y => `<span class="pill-year ${String(y) === currentYearStr ? 'is-current-year' : ''}">${y}</span>`).join('')}
            </div>
        </section>
    `;

    // Pie de versión
    contentHtml += `
        <div class="app-version-footer">
            <p>App Ventas · Sistema de Seguridad y Sincronización Cloud</p>
        </div>
    `;

    contentHtml += `</main>`;
    contentHtml += renderBottomNav(null);
    app.innerHTML = headerHtml + contentHtml; if(window.restoreScroll) window.restoreScroll();
    
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
        const totalOrders = Array.isArray(fullData.orders) ? fullData.orders.length : 0;
        const totalClients = Array.isArray(fullData.clients) ? fullData.clients.length : 0;

        // Protección anti-copias vacías (2.6 KB): si la base de datos local está vacía (p.ej. al abrir en un navegador nuevo o de prueba),
        // bloquear la subida automática para no ensuciar Google Drive con copias sin pedidos ni clientes.
        if (totalOrders === 0 && totalClients === 0) {
            console.warn("[Backup] Cancelada subida de copia vacía (0 pedidos y 0 clientes).");
            if (!isSilent) {
                alert("No hay pedidos ni clientes cargados en este dispositivo para hacer copia de seguridad.");
            }
            return false;
        }

        // Prevent backup spam from quick reloads
        if (isSilent) {
            localStorage.setItem("last_auto_backup", new Date().getTime().toString());
        }
        console.log(`[Backup] Exportando ${totalOrders} pedidos, ${totalClients} clientes...`);

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

function _formatBackupDisplay(file) {
    const rawName = String(file?.name || 'Copia');
    const match = rawName.match(/(\d{4})-(\d{2})-(\d{2})[_T-](\d{2})-(\d{2})/);
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    if (match) {
        const [, yyyy, mm, dd, hh, min] = match;
        const mLabel = months[Math.max(0, parseInt(mm, 10) - 1)] || mm;
        return {
            title: `${parseInt(dd, 10)} ${mLabel} ${yyyy} · ${hh}:${min}`,
            subtitle: rawName
        };
    }
    const d = file?.date ? new Date(file.date) : null;
    if (d && !Number.isNaN(d.getTime())) {
        const mLabel = months[d.getMonth()] || '';
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return {
            title: `${d.getDate()} ${mLabel} ${d.getFullYear()} · ${hh}:${min}`,
            subtitle: rawName
        };
    }
    return { title: rawName, subtitle: '' };
}

async function openBackupsModal() {
    let modal = document.getElementById('backupsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'backupsModal';
        modal.className = 'modal-overlay sys-backups-overlay';
        document.body.appendChild(modal);
    } else {
        modal.classList.add('sys-backups-overlay');
    }

    // Lock background scroll
    document.body.style.overflow = 'hidden';

    // Modal Structure (Executive Pro Design)
    modal.innerHTML = `
        <div class="modal-content sys-backups-modal-content">
            <!-- Header (Fixed at top) -->
            <div class="sys-backups-modal-header">
                <div class="sys-backups-head-left">
                    <div class="sys-backups-head-icon">
                        <span class="material-icons-round">cloud_queue</span>
                    </div>
                    <div>
                        <h2 class="sys-backups-head-title">Copias Disponibles</h2>
                        <p class="sys-backups-head-sub">Historial en Google Drive</p>
                    </div>
                </div>
                <button type="button" class="sys-backups-close-btn" onclick="closeBackupsModal()" title="Cerrar">
                    <span class="material-icons-round">close</span>
                </button>
            </div>
            
            <!-- List Body Container with Internal Scroll -->
            <div id="backupsListContainer" class="sys-backups-body">
                <!-- Loading State -->
                <div class="sys-backups-loading">
                    <span class="material-icons-round">cloud_sync</span>
                    <p class="sys-backups-loading-title">Consultando copias en Google Drive...</p>
                    <p class="sys-backups-loading-sub">Esto puede tardar unos segundos</p>
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

        const isSuccess = result.status === "success" || result.success;

        if (isSuccess) {
            const files = Array.isArray(result.files) ? result.files : [];
            driveFiles = files.filter(f => !f.name.toLowerCase().endsWith('.xlsx'));
        } else if (!result.files) {
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

            if (result.status === "success" || result.success) {
                const files = Array.isArray(result.files) ? result.files : [];
                driveFiles = files.filter(f => !f.name.toLowerCase().endsWith('.xlsx'));
            } else {
                driveError = result.message || "El servidor no devolvió copias válidas.";
            }
        } else {
            driveError = result.message || "El servidor no devolvió copias válidas.";
        }
    } catch (e) {
        console.error("Error al obtener copias de Drive:", e);
        driveError = e.message || "Error de conexión con Google Drive.";
    }

    const container = document.getElementById('backupsListContainer');
    let html = '';

    // --- SECCIÓN NUBE ---
    if (driveError) {
        html += `
            <div style="background-color: #fff7ed; border: 1.5px solid #fed7aa; border-radius: 16px; padding: 14px 16px; display: flex; gap: 12px; align-items: flex-start;">
                <span class="material-icons-round" style="color: #ea580c; font-size: 22px; margin-top: 2px; flex-shrink: 0;">cloud_off</span>
                <div style="flex: 1;">
                    <p style="font-size: 0.82rem; font-weight: 800; color: #9a3412; margin: 0 0 4px;">No se pudo conectar con Google Drive</p>
                    <p style="font-size: 0.75rem; color: #c2410c; font-weight: 600; margin: 0; word-break: break-word;">${driveError}</p>
                    <button onclick="openBackupsModal()" style="margin-top: 10px; display: inline-flex; align-items: center; gap: 6px; background-color: #0284c7; color: #fff; border: none; border-radius: 10px; padding: 8px 14px; font-size: 0.75rem; font-weight: 800; cursor: pointer;">
                        <span class="material-icons-round" style="font-size: 16px;">refresh</span> Reintentar
                    </button>
                </div>
            </div>
        `;
    } else if (!driveFiles || driveFiles.length === 0) {
        html += `
            <div style="text-align: center; padding: 2.5rem 1rem; background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 16px;">
                <span class="material-icons-round" style="font-size: 42px; color: #94a3b8;">cloud_done</span>
                <p style="font-size: 0.88rem; font-weight: 800; color: #334155; margin: 8px 0 2px;">No hay copias en Google Drive</p>
                <p style="font-size: 0.75rem; font-weight: 600; color: #64748b; margin: 0;">Usa el botón «Guardar Ahora» para crear tu primera copia en la nube.</p>
            </div>
        `;
    } else {
        html += `
            <div class="sys-backups-toolbar">
                <span class="sys-backups-count-lbl">Copias guardadas (${driveFiles.length})</span>
                <button type="button" onclick="handleDeleteMultipleRemoteFiles()" id="btnBulkDelete" class="sys-backups-bulk-del" style="display: none;">
                    <span class="material-icons-round" style="font-size: 15px;">delete_sweep</span>
                    <span id="bulkDeleteCount">Borrar</span>
                </button>
            </div>
            <div class="sys-backups-list">
                ${driveFiles.map((f, idx) => {
                    const sizeKB = f.size ? (f.size / 1024) : 0;
                    const sizeStr = f.size ? `${sizeKB.toFixed(1)} KB` : '—';
                    const isSmallWarning = sizeKB > 0 && sizeKB < 10;
                    const info = _formatBackupDisplay(f);
                    const safeName = String(f.name || '').replace(/'/g, "\\'");
                    return `
                    <div class="sys-backup-item ${idx === 0 ? 'is-latest' : ''}">
                        <div class="sys-backup-top-row">
                            <label class="sys-backup-check-wrap" title="Seleccionar copia">
                                <input type="checkbox" class="backup-checkbox" value="${f.id}" data-name="${safeName}" onchange="toggleBulkDeleteBtn()">
                            </label>
                            <div class="sys-backup-meta">
                                <div class="sys-backup-title-row">
                                    <span class="sys-backup-name">${info.title}</span>
                                    ${idx === 0 ? '<span class="sys-backup-latest-pill">Más reciente</span>' : ''}
                                </div>
                                <div class="sys-backup-sub">
                                    ${info.subtitle ? `<span class="sys-backup-filename">${info.subtitle}</span>` : ''}
                                    <span class="sys-backup-size-pill ${isSmallWarning ? 'is-warn' : ''}">${sizeStr}</span>
                                </div>
                            </div>
                        </div>
                        <div class="sys-backup-actions-row">
                            <button type="button" class="sys-backup-del-btn" onclick="handleDeleteRemoteFile('${f.id}', '${safeName}')">
                                <span class="material-icons-round">close</span>
                                <span>Eliminar</span>
                            </button>
                            <button type="button" class="sys-backup-restore-btn" onclick="handleRemoteRestore('${f.id}', '${safeName}')">
                                <span class="material-icons-round">cloud_download</span>
                                <span>Restaurar copia</span>
                            </button>
                        </div>
                    </div>
                    `;
                }).join('')}
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
        container.innerHTML = `<div style="text-align:center; padding: 4rem 0; color: #ef4444; font-weight: 700;">Eliminando de Drive...</div>`;

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
            // Esperar a que Apps Script cierre su ejecución antes de pedir la lista nueva,
            // de lo contrario puede devolver HTML en lugar de JSON.
            container.innerHTML = `<div style="text-align:center; padding: 4rem 0; color: #64748b; font-weight: 700;">Actualizando lista...</div>`;
            await new Promise(resolve => setTimeout(resolve, 900));
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
                <span class="material-icons-round" style="color: #ef4444; font-size: 17px;">error</span>
                <span style="color: #dc2626; font-weight: 800;">URL no configurada</span>
            `;
        }
        return false;
    }

    if (statusEl) {
        statusEl.innerHTML = `
            <span class="material-icons-round animate-spin" style="color: #0284c7; font-size: 17px;">sync</span>
            <span style="color: #64748b; font-weight: 700;">Comprobando...</span>
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
                <span class="material-icons-round" style="color: #10b981; font-size: 17px;">check_circle</span>
                <span style="color: #059669; font-weight: 800;">Sincronización activa</span>
            `;
        }
        if (!isSilent) alert("Conexión activa. La URL es válida y el servidor responde correctamente.");
        return true;
    } catch (e) {
        console.warn("Connection Status Check Error:", e);
        if (statusEl) {
            statusEl.innerHTML = `
                <span class="material-icons-round" style="color: #ef4444; font-size: 17px;">error</span>
                <span style="color: #dc2626; font-weight: 800;">Error de conexión</span>
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
            <div class="modal-content" style="border-radius: 22px; overflow: hidden; padding: 0; max-width: 420px; width: 92%; border: 1px solid #e2e8f0; box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25);">
                <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 34px; height: 34px; border-radius: 10px; background: rgba(255,255,255,0.16); display: flex; align-items: center; justify-content: center; color: #ffffff;">
                            <span class="material-icons-round" style="font-size: 19px;">date_range</span>
                        </div>
                        <h2 style="font-size: 1.02rem; font-weight: 800; color: #ffffff; margin: 0;">Añadir Nuevo Año</h2>
                    </div>
                    <button style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.22); color: #ffffff; cursor: pointer; width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center;" onclick="closeManagementYearsModal()">
                        <span class="material-icons-round" style="font-size: 20px;">close</span>
                    </button>
                </div>
                <div style="padding: 20px; background: #ffffff;">
                    <p style="font-size: 0.82rem; color: #64748b; margin: 0 0 14px; font-weight: 600; line-height: 1.45;">
                        Introduce el año que deseas habilitar en el sistema para el registro de pedidos y facturación.
                    </p>
                    <div class="sys-field-group" style="margin-bottom: 16px;">
                        <label class="sys-field-label" for="newYearInput">Año contable (YYYY)</label>
                        <input type="number" id="newYearInput" class="sys-input-control" style="font-size: 1rem;"
                               value="${new Date().getFullYear() + 1}" placeholder="Ej: 2027">
                    </div>
                    <div class="sys-actions-grid">
                        <button class="sys-btn-secondary" onclick="closeManagementYearsModal()">
                            <span class="material-icons-round">close</span>
                            <span>Cancelar</span>
                        </button>
                        <button class="sys-btn-primary" onclick="handleAddNewYear()">
                            <span class="material-icons-round">check</span>
                            <span>Habilitar Año</span>
                        </button>
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






window.toggleBulkDeleteBtn = function() {
    const checkboxes = document.querySelectorAll('.backup-checkbox:checked');
    const btn = document.getElementById('btnBulkDelete');
    const countSpan = document.getElementById('bulkDeleteCount');
    if (checkboxes.length > 0) {
        btn.style.display = 'inline-flex';
        countSpan.innerText = 'Borrar (' + checkboxes.length + ')';
    } else {
        btn.style.display = 'none';
    }
};

window.handleDeleteMultipleRemoteFiles = async function() {
    const checkboxes = Array.from(document.querySelectorAll('.backup-checkbox:checked'));
    if (checkboxes.length === 0) return;
    if (!confirm(`¿Seguro que quieres eliminar definitivamente ${checkboxes.length} copias de Google Drive?`)) return;
    
    try {
        let url = localStorage.getItem('apps_script_url');
        if (!url || url.includes('/edit')) {
            url = DEFAULT_SCRIPT_URL;
            localStorage.setItem('apps_script_url', DEFAULT_SCRIPT_URL);
        }
        
        const container = document.getElementById('backupsListContainer');
        container.innerHTML = `<div style="text-align:center; padding: 4rem 0; color: #ef4444; font-weight: 700;">Eliminando ${checkboxes.length} copias...</div>`;

        for (let i = 0; i < checkboxes.length; i++) {
            const fileId = checkboxes[i].value;
            const deleteUrl = `${url}${url.includes('?') ? '&' : '?'}action=delete&id=${fileId}`;
            await fetch(deleteUrl);
        }

        container.innerHTML = `<div style="text-align:center; padding: 4rem 0; color: #64748b; font-weight: 700;">Actualizando lista...</div>`;
        await new Promise(resolve => setTimeout(resolve, 900));
        
        const modal = document.getElementById('backupsModal');
        if (modal) {
            modal.classList.remove('open');
            document.body.style.overflow = '';
        }
        setTimeout(openBackupsModal, 300);
        
    } catch (e) {
        alert("Error al eliminar múltiples copias: " + e.message);
    }
};


/**
 * Lógica de gestión de Clientes
 */

function getClientScriptUrl() {
    return localStorage.getItem('apps_script_url') || (typeof DEFAULT_SCRIPT_URL !== 'undefined' ? DEFAULT_SCRIPT_URL : (typeof GOOGLE_SCRIPT_URL !== 'undefined' ? GOOGLE_SCRIPT_URL : ''));
}

async function renderClientes(isBack = false) {
    if (typeof updateHistoryState === 'function') updateHistoryState('clientes', isBack);
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Clientes');

    const pendingOps = await dataManager.getPendingClientOps();
    const pendingCount = Array.isArray(pendingOps) ? pendingOps.length : 0;

    let contentHtml = '<main style="padding: 1rem 1.25rem; padding-bottom: 100px;" class="view-enter">';

    // Panel Superior Unificado de Gestión de Clientes
    contentHtml += `
        <div class="pro-clients-toolbar">
            <div class="pro-toolbar-primary-grid">
                <button type="button" class="pro-btn-new-client" onclick="openNewClientModal()">
                    <span class="material-icons-round">person_add</span>
                    <span>Nuevo Cliente</span>
                </button>
                <button type="button" class="pro-btn-nearby-gps" onclick="window.openNearbyRadarModal()">
                    <span class="material-icons-round">my_location</span>
                    <span>Clientes Cerca</span>
                </button>
            </div>

            <div class="pro-toolbar-sync-row">
                <button type="button" class="pro-sync-btn" onclick="document.getElementById('clientImportInput').click()">
                    <span class="material-icons-round">upload_file</span>
                    <span>Importar Excel</span>
                </button>
                <button type="button" class="pro-sync-btn" onclick="handleDriveImport()">
                    <span class="material-icons-round">cloud_download</span>
                    <span>Bajar Drive</span>
                </button>
                <button type="button" class="pro-sync-btn" onclick="handleDriveExportClients()">
                    <span class="material-icons-round">cloud_upload</span>
                    <span>Subir Drive</span>
                </button>
            </div>

            ${pendingCount > 0 ? `
            <div id="pendingSyncBanner" class="pro-pending-banner">
                <div class="pro-pending-info">
                    <span class="material-icons-round">cloud_off</span>
                    <span>${pendingCount} ${pendingCount === 1 ? 'cambio pendiente' : 'cambios pendientes'} de subir a Drive</span>
                </div>
                <button type="button" onclick="handleFlushPendingClients(this)" class="pro-pending-btn">
                    <span class="material-icons-round" style="font-size: 14px;">sync</span>
                    <span>Subir ahora</span>
                </button>
            </div>
            ` : ''}
            <input type="file" id="clientImportInput" accept=".xlsx, .xls" style="display: none;" onchange="handleClientImport(this)">
        </div>

        <div class="pro-search-bar mb-4">
            <span class="material-icons-round pro-search-icon">search</span>
            <input type="text" id="clientSearchInput" 
                   class="pro-search-input"
                   placeholder="Buscar por nombre, código o población..." 
                   onkeyup="filterClients(this.value)" 
                   onkeydown="if(event.key==='Enter') this.blur()"
                   oninput="toggleClearSearch('clientSearchInput', 'clearSearchBtn')">
            <div class="pro-search-actions">
                <button type="button" id="clearSearchBtn" class="pro-search-clear-btn" 
                        style="display: none;" 
                        onclick="clearClientSearch()"
                        title="Borrar búsqueda">
                    <span class="material-icons-round">close</span>
                </button>
                <button type="button" class="pro-search-mic-btn" 
                        onclick="window.toggleVoiceDictation('clientSearchInput', this)"
                        title="Buscar por voz">
                    <span class="material-icons-round">mic</span>
                </button>
            </div>
        </div>
    `;

    const clients = await dataManager.getClients();
    clients.sort((a, b) => { const lA = (a && a.location) ? String(a.location) : ""; const lB = (b && b.location) ? String(b.location) : ""; return lA.localeCompare(lB); });

    contentHtml += '<div id="clientsList" class="clients-list">';
    if (clients.length === 0) {
        contentHtml += '<div class="text-center p-8 text-secondary">No hay clientes registrados</div>';
    } else {
        clients.forEach(client => { if(!client) return;
            const searchCode = String(client.code || '').toLowerCase();
            const searchName = String(client.name || '').toLowerCase();
            const searchLoc = String(client.location || '').toLowerCase();
            contentHtml += `
                <div class="client-card pro-client-item" 
                     onclick="openClientDetailModal('${String(client.code || '').replace(/'/g, "\\'")}')"
                     data-name="${searchCode} ${searchName}" 
                     data-location="${searchLoc}">
                    <div class="pro-client-item-body">
                        <div class="pro-client-item-top">
                            <span class="pro-client-code-badge">#${client.code || '---'}</span>
                            <span class="pro-client-name">${client.name || 'Sin Nombre'}</span>
                        </div>
                        <div class="pro-client-meta-row">
                            <span class="pro-meta-pill pro-meta-loc">
                                <span class="material-icons-round">place</span>
                                ${client.location || 'Sin ubicación'}
                            </span>
                            ${client.contact ? `
                                <span class="pro-meta-pill pro-meta-contact">
                                    <span class="material-icons-round">person</span>
                                    ${client.contact}
                                </span>
                            ` : ''}
                            ${client.lastVisitDate ? `
                                <span class="pro-meta-pill pro-meta-visit" title="Última visita registrada">
                                    <span class="material-icons-round">visibility</span>
                                    ${new Date(client.lastVisitDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                                </span>
                            ` : ''}
                            ${client.pendingSync ? `
                                <span class="pro-meta-pill pro-meta-sync" title="Pendiente de subir a Drive">
                                    <span class="material-icons-round">cloud_queue</span>
                                    Pendiente
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    <span class="material-icons-round pro-client-chevron">chevron_right</span>
                </div>
            `;
        });
    }
    contentHtml += '</div>';

    injectClientModals();

    contentHtml += '</main>';
    contentHtml += renderBottomNav('clientes');
    app.innerHTML = headerHtml + contentHtml; if(window.restoreScroll) window.restoreScroll();
    
    if (window.activeCurrentNav) window.activeCurrentNav('clientes');
}

function filterClients(query) {
    const q = query.toLowerCase();
    
    // Usar utilidad global para el botón X
    toggleClearSearch('clientSearchInput', 'clearSearchBtn');

    document.querySelectorAll('.client-card').forEach(card => {
        const name = card.getAttribute('data-name');
        const loc = card.getAttribute('data-location');
        card.style.display = (name.includes(q) || loc.includes(q)) ? 'flex' : 'none';
    });
}

function clearClientSearch() {
    clearSearchField('clientSearchInput', 'clearSearchBtn', () => filterClients(''));
}

async function openClientDetailModal(clientCode) {
    injectClientModals();
    const client = await dataManager.getClientByCode(clientCode);
    if (!client) return alert('Cliente no encontrado');

    const modal = document.getElementById('clientDetailModal');
    const content = document.getElementById('modal-client-content');
    
    // Historial (vinculado por código de cliente con soporte para pedidos antiguos por nombre normalizado)
    const orders = await dataManager.getOrders();
    const clientOrders = orders.filter(o => dataManager.isOrderForClient(o, client)).sort((a,b) => new Date(b.dateISO) - new Date(a.dateISO));
    
    let historyHtml = '<div class="pro-history-list">';
    if (clientOrders.length === 0) {
        historyHtml += '<p class="pro-empty-state">Sin pedidos registrados todavía</p>';
    } else {
        clientOrders.forEach(o => {
            let statusLabel = 'ALMACÉN';
            let statusClass = 'status-almacen';
            if (o.facturadoTodo) {
                statusLabel = 'FACTURADO TODO';
                statusClass = 'status-todo';
            } else if (o.noTampo) {
                statusLabel = 'FACTURADO S/ TAMPO';
                statusClass = 'status-tampo';
            }

            const formattedAmount = Math.round(parseFloat(o.amount) || 0).toLocaleString('de-DE') + ' €';

            historyHtml += `
                <div class="pro-history-row">
                    <div class="pro-history-info">
                        <span class="pro-history-amount">${formattedAmount}</span>
                        <span class="pro-history-date">${new Date(o.dateISO).toLocaleDateString('es-ES')}</span>
                    </div>
                    <div class="history-badge ${statusClass}">${statusLabel}</div>
                </div>
            `;
        });
    }
    historyHtml += '</div>';

    const safeCode = String(client.code || '').replace(/'/g, "\\'");
    const lastVisitFormatted = client.lastVisitDate
        ? new Date(client.lastVisitDate).toLocaleDateString('es-ES')
        : '';

    const waPref = window.getWhatsAppPref ? window.getWhatsAppPref() : 'business';
    const waBadgeText = waPref === 'business' ? 'WA Business' : (waPref === 'personal' ? 'WA Personal' : 'Elegir al enviar');
    const cleanPhone1 = (client.phone || '').replace(/\s+/g, '');
    const cleanPhone2 = (client.phone2 || '').replace(/\s+/g, '');
    const cleanEmail = (client.email || '').trim();

    content.innerHTML = `
        <!-- CABECERA EJECUTIVA UNIFICADA -->
        <div class="pro-modal-header">
            <div class="pro-header-topbar">
                <div class="pro-header-badges">
                    <span class="pro-code-pill">CLIENTE #${client.code || '---'}</span>
                    ${client.nif ? `<span class="pro-nif-pill">${client.nif}</span>` : ''}
                </div>
                <div class="pro-header-icon-actions">
                    <button type="button" class="pro-header-icon-btn" onclick="openNewClientModal('${safeCode}')" title="Editar cliente">
                        <span class="material-icons-round">edit</span>
                    </button>
                    <button type="button" class="pro-header-icon-btn pro-header-icon-danger" onclick="handleDeleteClient('${safeCode}')" title="Eliminar cliente">
                        <span class="material-icons-round">delete_outline</span>
                    </button>
                    <button type="button" class="pro-header-icon-btn" onclick="closeClientDetailModal()" title="Cerrar">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
            </div>

            <h2 class="pro-client-title">${client.name || 'Sin Nombre'}</h2>

            <div class="pro-header-subrow">
                <span class="pro-header-subitem">
                    <span class="material-icons-round">place</span>
                    <span>${client.location || 'Sin localidad'}${client.province ? ' · ' + client.province : ''}</span>
                </span>
                ${client.contact ? `
                <span class="pro-header-subitem">
                    <span class="material-icons-round">person</span>
                    <span>${client.contact}</span>
                </span>
                ` : ''}
            </div>
        </div>
        
        <div class="pro-modal-body">
            <!-- BARRA DE ACCIONES PRINCIPALES SIMÉTRICA -->
            <div class="pro-primary-actions-grid">
                <button type="button" class="pro-btn-primary-action" onclick="window.openNewOrderForClient('${safeCode}')">
                    <span class="material-icons-round">add_shopping_cart</span>
                    <span>Nuevo Pedido</span>
                </button>
                <button type="button" class="pro-btn-secondary-action" onclick="toggleQuickVisitBox()">
                    <span class="material-icons-round">visibility</span>
                    <span>Registrar Visita</span>
                </button>
            </div>

            <!-- Panel desplegable para Check-in de Visita sin pedido -->
            <div id="quickVisitBox" class="pro-visit-drawer" style="display: none;">
                <div class="pro-section-head" style="margin-bottom: 8px;">
                    <div class="pro-section-title">
                        <span class="material-icons-round" style="color: #0284c7;">visibility</span>
                        <span>Registrar visita de hoy (Sin pedido)</span>
                    </div>
                    <button type="button" class="pro-mini-pill-btn" onclick="window.toggleVoiceDictation('clientVisitNoteInput', this)">
                        <span class="material-icons-round">mic</span>
                        <span>Dictar</span>
                    </button>
                </div>
                <input type="text" id="clientVisitNoteInput" class="pro-clean-input"
                       value="${(client.lastVisitNote || '').replace(/"/g, '&quot;')}"
                       placeholder="Nota opcional (ej. pasar en 15 días, tiene stock...)">
                <button type="button" class="pro-btn-confirm-visit" onclick="confirmClientVisitCheckIn('${safeCode}')">
                    <span class="material-icons-round">check_circle</span>
                    <span>Guardar Visita de Hoy</span>
                </button>
            </div>

            ${lastVisitFormatted ? `
            <div id="lastVisitInfoBanner" class="pro-visit-status-bar">
                <span class="material-icons-round">event_available</span>
                <div class="pro-visit-status-text">
                    <span><strong>Última visita:</strong> ${lastVisitFormatted}</span>
                    ${client.lastVisitNote ? `<span class="pro-visit-note-quote">· "${client.lastVisitNote}"</span>` : ''}
                </div>
            </div>
            ` : ''}

            <!-- SECCIÓN 1: CONTACTO DIRECTO (TELÉFONO, WHATSAPP BUSINESS Y CORREO) -->
            <div class="pro-section-card">
                <div class="pro-section-head">
                    <div class="pro-section-title">
                        <span class="material-icons-round">contact_phone</span>
                        <span>Contacto y Comunicación</span>
                    </div>
                    <button type="button" class="pro-comm-pref-chip" onclick="window.openCommPrefsModal('${safeCode}')" title="Configurar desde qué WhatsApp o Correo enviar">
                        <span class="material-icons-round" style="font-size: 13px; color: #10b981;">storefront</span>
                        <span>${waBadgeText}</span>
                        <span class="material-icons-round" style="font-size: 13px; color: #94a3b8;">tune</span>
                    </button>
                </div>

                <!-- Teléfono Principal -->
                <div class="pro-contact-row">
                    <div class="pro-contact-icon-box">
                        <span class="material-icons-round">phone</span>
                    </div>
                    <div class="pro-contact-info">
                        <span class="pro-field-label">Teléfono Principal</span>
                        ${cleanPhone1
                            ? `<a href="tel:${cleanPhone1}" class="pro-contact-value-link">${client.phone}</a>`
                            : `<span class="pro-field-empty">No registrado</span>`}
                    </div>
                    ${cleanPhone1 ? `
                    <div class="pro-contact-actions">
                        <button type="button" class="pro-icon-action pro-action-call" onclick="window.location.href='tel:${cleanPhone1}'" title="Llamar por teléfono">
                            <span class="material-icons-round">call</span>
                        </button>
                        <button type="button" class="pro-icon-action pro-action-wa" onclick="window.openAppWhatsApp('${cleanPhone1}')" title="Enviar por ${waBadgeText}">
                            <span class="material-icons-round">chat</span>
                            ${waPref === 'business' ? `<span class="pro-wa-b-tag">B</span>` : ''}
                        </button>
                    </div>
                    ` : ''}
                </div>

                ${cleanPhone2 ? `
                <!-- Teléfono Secundario -->
                <div class="pro-contact-row pro-row-divider">
                    <div class="pro-contact-icon-box">
                        <span class="material-icons-round">phone_forwarded</span>
                    </div>
                    <div class="pro-contact-info">
                        <span class="pro-field-label">Teléfono Secundario</span>
                        <a href="tel:${cleanPhone2}" class="pro-contact-value-link">${client.phone2}</a>
                    </div>
                    <div class="pro-contact-actions">
                        <button type="button" class="pro-icon-action pro-action-call" onclick="window.location.href='tel:${cleanPhone2}'" title="Llamar por teléfono">
                            <span class="material-icons-round">call</span>
                        </button>
                        <button type="button" class="pro-icon-action pro-action-wa" onclick="window.openAppWhatsApp('${cleanPhone2}')" title="Enviar por ${waBadgeText}">
                            <span class="material-icons-round">chat</span>
                            ${waPref === 'business' ? `<span class="pro-wa-b-tag">B</span>` : ''}
                        </button>
                    </div>
                </div>
                ` : ''}

                <!-- Correo Electrónico -->
                <div class="pro-contact-row pro-row-divider">
                    <div class="pro-contact-icon-box">
                        <span class="material-icons-round">mail_outline</span>
                    </div>
                    <div class="pro-contact-info">
                        <span class="pro-field-label">Correo Electrónico</span>
                        ${cleanEmail
                            ? `<a href="javascript:void(0)" onclick="window.openAppEmail('${cleanEmail.replace(/'/g, "\\'")}')" class="pro-email-value-link">${cleanEmail}</a>`
                            : `<span class="pro-field-empty">No registrado</span>`}
                    </div>
                    ${cleanEmail ? `
                    <div class="pro-contact-actions">
                        <button type="button" class="pro-icon-action pro-action-mail" onclick="window.openAppEmail('${cleanEmail.replace(/'/g, "\\'")}')" title="Enviar correo electrónico">
                            <span class="material-icons-round">send</span>
                        </button>
                    </div>
                    ` : ''}
                </div>

                <!-- Persona de Contacto y Horario -->
                <div class="pro-contact-meta-grid pro-row-divider">
                    <div>
                        <span class="pro-field-label">Persona de Contacto</span>
                        <p class="pro-field-text">${client.contact || '---'}</p>
                    </div>
                    <div>
                        <span class="pro-field-label">Horario Comercial</span>
                        <p class="pro-field-text">${client.schedule || '---'}</p>
                    </div>
                </div>
            </div>

            <!-- SECCIÓN 2: UBICACIÓN Y NAVEGACIÓN GPS -->
            <div class="pro-section-card">
                <div class="pro-section-head">
                    <div class="pro-section-title">
                        <span class="material-icons-round">location_on</span>
                        <span>Ubicación y Logística</span>
                    </div>
                    ${(client.lat && client.lng) ? `
                    <button type="button" class="pro-btn-gps-route" onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${client.lat},${client.lng}', '_blank')">
                        <span class="material-icons-round" style="font-size: 16px;">directions</span>
                        <span>Cómo llegar</span>
                    </button>
                    ` : ''}
                </div>

                <div class="pro-location-grid">
                    <div class="pro-location-main">
                        <span class="pro-field-label">Dirección</span>
                        <p class="pro-field-text">${client.address || '---'}</p>
                    </div>
                    <div class="pro-location-subgrid">
                        <div>
                            <span class="pro-field-label">Población</span>
                            <p class="pro-field-text">${client.location || '---'}${client.cp ? ` (${client.cp})` : ''}</p>
                        </div>
                        <div>
                            <span class="pro-field-label">Provincia</span>
                            <p class="pro-field-text">${client.province || '---'}</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- SECCIÓN 3: NOTAS PERMANENTES DEL CLIENTE -->
            <div class="pro-section-card">
                <div class="pro-section-head">
                    <div class="pro-section-title">
                        <span class="material-icons-round">description</span>
                        <span>Notas Permanentes</span>
                    </div>
                    <div class="pro-notes-actions">
                        <button type="button" class="pro-mini-pill-btn" onclick="window.toggleVoiceDictation('clientQuickNotesInput', this, () => saveQuickClientNotes('${safeCode}', true))">
                            <span class="material-icons-round">mic</span>
                            <span>Dictar</span>
                        </button>
                        <button type="button" id="btnSaveQuickNotes" class="pro-mini-pill-btn pro-mini-pill-primary" onclick="saveQuickClientNotes('${safeCode}', false)">
                            <span class="material-icons-round">save</span>
                            <span>Guardar</span>
                        </button>
                    </div>
                </div>
                <textarea id="clientQuickNotesInput" rows="2" class="pro-notes-textarea"
                          placeholder="Escribe o dicta notas fijas (ej. prefiere imanes de resina, hablar con María por la mañana...)">${client.notes || ''}</textarea>
                <div id="quickNotesSavedStatus" class="pro-notes-saved-msg" style="display: none;">✅ Nota guardada en la ficha del cliente</div>
            </div>

            <!-- SECCIÓN 4: HISTORIAL DE PEDIDOS -->
            <div class="pro-section-card">
                <div class="pro-section-head">
                    <div class="pro-section-title">
                        <span class="material-icons-round">history</span>
                        <span>Historial de Pedidos</span>
                    </div>
                    <span class="pro-count-badge">${clientOrders.length}</span>
                </div>
                ${historyHtml}
            </div>
            
            <div class="pro-modal-footer">
                <button type="button" class="btn-footer-close" onclick="closeClientDetailModal()">Cerrar Ficha</button>
            </div>
        </div>
    `;

    modal.classList.add('open');
    document.body.classList.add('no-scroll');
}

function closeClientDetailModal() {
    document.getElementById('clientDetailModal').classList.remove('open');
    document.body.classList.remove('no-scroll');
}

function openNewClientModal(code = null) {
    injectClientModals();
    const modal = document.getElementById('newClientModal');
    const detailModal = document.getElementById('clientDetailModal');
    
    // Forzar que el modal de edición esté por encima del de detalle
    if (detailModal) detailModal.style.zIndex = '1050';
    modal.style.zIndex = '1100';

    const form = document.getElementById('newClientForm');
    form.reset();
    
    if (code) {
        dataManager.getClientByCode(code).then(client => {
            if (!client) return;
            form.dataset.isEdit = 'true';
            form.dataset.originalCode = code;
            document.getElementById('ncCode').value = client.code;
            document.getElementById('ncName').value = client.name;
            document.getElementById('ncNIF').value = client.nif || '';
            document.getElementById('ncPhone').value = client.phone || '';
            document.getElementById('ncPhone2').value = client.phone2 || '';
            document.getElementById('ncEmail').value = client.email || '';
            document.getElementById('ncLocation').value = client.location || '';
            document.getElementById('ncProvince').value = client.province || '';
            document.getElementById('ncCP').value = client.cp || '';
            document.getElementById('ncAddress').value = client.address || '';
            document.getElementById('ncContact').value = client.contact || '';
            document.getElementById('ncSchedule').value = client.schedule || '';
            const notesEl = document.getElementById('ncNotes');
            if (notesEl) notesEl.value = client.notes || '';
            document.getElementById('ncLat').value = client.lat || '';
            document.getElementById('ncLng').value = client.lng || '';
            modal.querySelector('h2').textContent = 'Editar Cliente';
            if (window.enhanceClearableInputs) window.enhanceClearableInputs(modal);
        });
    } else {
        form.dataset.isEdit = 'false';
        modal.querySelector('h2').textContent = 'Nuevo Cliente';
        if (window.enhanceClearableInputs) window.enhanceClearableInputs(modal);
    }
    
    modal.classList.add('open');
    setTimeout(() => {
        document.getElementById('ncCode').focus();
    }, 300);
}

async function saveNewClient() {
    const form = document.getElementById('newClientForm');
    const isEdit = form.dataset.isEdit === 'true';
    const originalCode = form.dataset.originalCode;
    
    const data = {
        code: document.getElementById('ncCode').value,
        name: document.getElementById('ncName').value,
        nif: document.getElementById('ncNIF').value,
        phone: document.getElementById('ncPhone').value,
        phone2: document.getElementById('ncPhone2').value,
        email: document.getElementById('ncEmail').value,
        location: document.getElementById('ncLocation').value,
        province: document.getElementById('ncProvince').value,
        cp: document.getElementById('ncCP').value,
        address: document.getElementById('ncAddress').value,
        contact: document.getElementById('ncContact').value,
        schedule: document.getElementById('ncSchedule').value,
        notes: document.getElementById('ncNotes') ? document.getElementById('ncNotes').value : '',
        lat: document.getElementById('ncLat').value,
        lng: document.getElementById('ncLng').value
    };

    if (!data.code || !data.name) return alert("Código y Nombre son obligatorios");

    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="material-icons-round animate-spin">sync</span> Guardando...';
    btn.disabled = true;

    try {
        const filename = 'Clientes_CON_COORDENADAS.xlsx';
        const scriptUrl = getClientScriptUrl();
        let res;
        if (isEdit) res = await dataManager.updateClientInDrive(scriptUrl, filename, originalCode, data);
        else res = await dataManager.saveNewClientToDrive(scriptUrl, filename, data);

        if (res.success) {
            if (res.warning) {
                alert("⚠️ " + res.warning);
            } else {
                alert("Cliente guardado correctamente");
            }
            document.getElementById('newClientModal').classList.remove('open');
            closeClientDetailModal();
            renderClientes();
        } else alert("Error: " + res.message);
    } catch (e) {
        alert("Error de conexión al guardar el cliente: " + e.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function handleClientImport(input) {
    if (!input.files || input.files.length === 0) return;
    try {
        const res = await dataManager.importClientsFromExcel(input.files[0]);
        if (res.success) {
            const scriptUrl = getClientScriptUrl();
            if (scriptUrl) {
                const syncRes = await dataManager.syncAllClientsToDriveExcel(scriptUrl, 'Clientes_CON_COORDENADAS.xlsx');
                if (syncRes && syncRes.success) {
                    await dataManager.clearPendingClientOps();
                }
            }
            let msg = `Importados ${res.count} clientes y sincronizados con la carpeta "Copias seguridad App Gestión" en Drive.`;
            if (res.protectedPending > 0) {
                msg += `\n\n🛡️ Se han respetado ${res.protectedPending} cambio(s) hecho(s) sin cobertura en el móvil.`;
            }
            alert(msg);
            renderClientes();
        } else {
            alert("Error: " + res.message);
        }
    } catch (e) {
        alert("Error al importar el archivo Excel: " + e.message);
    } finally {
        input.value = '';
    }
}

async function handleFlushPendingClients(btn) {
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = '<span class="material-icons-round animate-spin" style="font-size: 14px;">sync</span><span>Subiendo...</span>';
        btn.disabled = true;
    }
    try {
        const scriptUrl = getClientScriptUrl();
        const res = await dataManager.flushPendingClientSync(scriptUrl, 'Clientes_CON_COORDENADAS.xlsx');
        if (res.success && res.flushed > 0) {
            alert(`✅ ¡Sincronización completada! Se han subido los ${res.flushed} cambio(s) pendientes a Google Drive.`);
            renderClientes();
        } else if (res.pendingCount > 0) {
            alert(`⚠️ Aún no hay suficiente cobertura para conectar con Drive (${res.message || 'Sin respuesta'}). Tus cambios siguen guardados y protegidos en el móvil.`);
        } else {
            renderClientes();
        }
    } catch (e) {
        alert("Error al sincronizar cambios pendientes: " + e.message);
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

window.onClientSyncQueueUpdated = function(remainingCount) {
    if (window.currentView === 'clientes' && remainingCount === 0) {
        renderClientes(true);
    }
};

async function handleDriveImport() {
    const btn = event.target.closest('button');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="material-icons-round animate-spin">sync</span>';
    btn.disabled = true;

    try {
        const scriptUrl = getClientScriptUrl();
        const res = await dataManager.importFromDrive(scriptUrl, 'Clientes_CON_COORDENADAS.xlsx');
        if (res.success) {
            let msg = `Sincronizados ${res.count} clientes desde la carpeta "Copias seguridad App Gestión" en Drive.`;
            if (res.protectedPending > 0) {
                msg += `\n\n🛡️ Tus ${res.protectedPending} cambio(s) hecho(s) en ruta se han conservado automáticamente (no han sido sobrescritos).`;
            }
            alert(msg);
            renderClientes();
        } else {
            const currentClients = await dataManager.getClients();
            if (currentClients.length > 0 && confirm(`No se encontró el archivo de clientes en la carpeta "Copias seguridad App Gestión" (${res.message}).\n\n¿Quieres subir ahora tus ${currentClients.length} clientes actuales de la app para crear el Excel en esa carpeta de Drive?`)) {
                const syncRes = await dataManager.syncAllClientsToDriveExcel(scriptUrl, 'Clientes_CON_COORDENADAS.xlsx');
                if (syncRes.success) {
                    await dataManager.clearPendingClientOps();
                    alert(`¡Listo! Se ha creado "Clientes_CON_COORDENADAS.xlsx" con ${syncRes.count} clientes dentro de la carpeta "Copias seguridad App Gestión".`);
                    renderClientes();
                } else {
                    alert("Error al subir el Excel a Drive: " + syncRes.message);
                }
            } else {
                alert("Error: " + res.message);
            }
        }
    } catch (e) {
        alert("Error de conexión");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function handleDriveExportClients() {
    const currentClients = await dataManager.getClients();
    if (currentClients.length === 0) {
        return alert("No tienes clientes en la aplicación para subir a Drive.");
    }
    if (!confirm(`Se guardarán tus ${currentClients.length} clientes actuales de la app en el archivo "Clientes_CON_COORDENADAS.xlsx" dentro de la carpeta "Copias seguridad App Gestión" de Google Drive.\n\n¿Continuar?`)) {
        return;
    }

    const btn = event.target.closest('button');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="material-icons-round animate-spin">sync</span>';
    btn.disabled = true;

    try {
        const scriptUrl = getClientScriptUrl();
        const res = await dataManager.syncAllClientsToDriveExcel(scriptUrl, 'Clientes_CON_COORDENADAS.xlsx');
        if (res.success) {
            await dataManager.clearPendingClientOps();
            alert(`¡Perfecto! Se han guardado ${res.count} clientes en "Clientes_CON_COORDENADAS.xlsx" dentro de la carpeta "Copias seguridad App Gestión".`);
            renderClientes();
        } else {
            alert("Error al subir a Drive: " + res.message);
        }
    } catch (e) {
        alert("Error de conexión: " + e.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function handleDeleteClient(code) {
    if (!confirm("¿Deseas eliminar este cliente permanentemente?")) return;
    try {
        const scriptUrl = getClientScriptUrl();
        const res = await dataManager.deleteClientFromDrive(scriptUrl, 'Clientes_CON_COORDENADAS.xlsx', code);
        if (res.success) {
            if (res.warning) {
                alert("⚠️ " + res.warning);
            } else {
                alert("Cliente eliminado");
            }
            closeClientDetailModal();
            renderClientes();
        } else alert("Error: " + res.message);
    } catch (e) {
        alert("Error de conexión: " + e.message);
    }
}

function injectClientModals() {
    if (document.getElementById('newClientModal')) return;
    
    const html = `
    <div id="newClientModal" class="modal-overlay">
        <div class="modal-content" style="max-width: 560px !important; width: 95% !important; height: 92vh; max-height: 92vh; padding: 0; overflow: hidden; margin: auto; border-radius: 24px; display: flex; flex-direction: column;">
            <div style="display: flex; flex-direction: column; height: 100%; min-height: 0; width: 100%; overflow: hidden;">
                
                <div class="pro-modal-header" style="flex-direction: row; align-items: center; justify-content: space-between; padding: 1.15rem 1.35rem; flex-shrink: 0;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="material-icons-round" style="color: #ffffff; font-size: 22px;">person_add</span>
                        <h2 class="pro-client-title" style="margin: 0; font-size: 17px;">Nuevo Cliente</h2>
                    </div>
                    <button type="button" class="pro-header-icon-btn" onclick="document.getElementById('newClientModal').classList.remove('open')">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                
                <form id="newClientForm" onsubmit="event.preventDefault(); saveNewClient();" onkeydown="handleFormNavigation(event)" style="display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; overflow: hidden;">
                    <div class="pro-modal-body" style="flex: 1 1 auto; min-height: 0; overflow-y: auto;">
                        
                        <!-- SECCIÓN 1: IDENTIDAD COMERCIAL -->
                        <div class="pro-section-card">
                            <div class="pro-section-head">
                                <div class="pro-section-title">
                                    <span class="material-icons-round">badge</span>
                                    <span>Identidad Comercial</span>
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label class="pro-field-label">Código *</label>
                                    <input type="text" id="ncCode" class="pro-clean-input" style="margin-bottom: 0;" inputmode="numeric" pattern="[0-9]*" placeholder="Ej: 1234" required>
                                </div>
                                <div>
                                    <label class="pro-field-label">NIF / DNI</label>
                                    <input type="text" id="ncNIF" class="pro-clean-input" style="margin-bottom: 0;" placeholder="A12345678">
                                </div>
                            </div>
                            <div>
                                <label class="pro-field-label">Nombre de Tienda *</label>
                                <input type="text" id="ncName" class="pro-clean-input" style="margin-bottom: 0;" placeholder="Nombre comercial" required>
                            </div>
                        </div>

                        <!-- SECCIÓN 2: CONTACTO -->
                        <div class="pro-section-card">
                            <div class="pro-section-head">
                                <div class="pro-section-title">
                                    <span class="material-icons-round">contact_phone</span>
                                    <span>Datos de Contacto</span>
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label class="pro-field-label">Teléfono Principal</label>
                                    <input type="text" id="ncPhone" class="pro-clean-input" style="margin-bottom: 0;" inputmode="numeric" placeholder="600000000">
                                </div>
                                <div>
                                    <label class="pro-field-label">Teléfono Secundario</label>
                                    <input type="text" id="ncPhone2" class="pro-clean-input" style="margin-bottom: 0;" inputmode="numeric" placeholder="Opcional">
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="pro-field-label">Persona de Contacto</label>
                                <input type="text" id="ncContact" class="pro-clean-input" style="margin-bottom: 0;" placeholder="Nombre del responsable">
                            </div>
                            <div>
                                <label class="pro-field-label">Correo Electrónico</label>
                                <input type="email" id="ncEmail" class="pro-clean-input" style="margin-bottom: 0;" placeholder="cliente@correo.com">
                            </div>
                        </div>

                        <!-- SECCIÓN 3: UBICACIÓN Y NOTAS -->
                        <div class="pro-section-card">
                            <div class="pro-section-head">
                                <div class="pro-section-title">
                                    <span class="material-icons-round">location_on</span>
                                    <span>Ubicación y Logística</span>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="pro-field-label">Dirección</label>
                                <input type="text" id="ncAddress" class="pro-clean-input" style="margin-bottom: 0;" placeholder="Calle, número, local...">
                            </div>
                            <div class="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label class="pro-field-label">Población</label>
                                    <input type="text" id="ncLocation" class="pro-clean-input" style="margin-bottom: 0;" placeholder="Ciudad">
                                </div>
                                <div>
                                    <label class="pro-field-label">Provincia</label>
                                    <input type="text" id="ncProvince" class="pro-clean-input" style="margin-bottom: 0;" placeholder="Provincia">
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label class="pro-field-label">Código Postal</label>
                                    <input type="text" id="ncCP" class="pro-clean-input" style="margin-bottom: 0;" inputmode="numeric" placeholder="33000">
                                </div>
                                <div>
                                    <label class="pro-field-label">Horario Comercial</label>
                                    <input type="text" id="ncSchedule" class="pro-clean-input" style="margin-bottom: 0;" placeholder="Ej: 9:00 - 14:00">
                                </div>
                            </div>
                            <div>
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                    <label class="pro-field-label" style="margin: 0;">Notas Permanentes</label>
                                    <button type="button" class="pro-mini-pill-btn" onclick="window.toggleVoiceDictation('ncNotes', this)">
                                        <span class="material-icons-round">mic</span>
                                        <span>Dictar</span>
                                    </button>
                                </div>
                                <textarea id="ncNotes" class="pro-notes-textarea" rows="2" placeholder="Preferencias, persona clave, días de cierre..."></textarea>
                            </div>
                        </div>

                        <!-- SECCIÓN 4: GEOLOCALIZACIÓN GPS -->
                        <div class="pro-section-card">
                            <div class="pro-section-head">
                                <div class="pro-section-title">
                                    <span class="material-icons-round">my_location</span>
                                    <span>Coordenadas GPS</span>
                                </div>
                                <button type="button" class="pro-btn-gps-route" onclick="getCurrentCoordinates()">
                                    <span class="material-icons-round" style="font-size: 15px;">gps_fixed</span>
                                    <span>Capturar mi GPS actual</span>
                                </button>
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="pro-field-label">Latitud</label>
                                    <input type="text" id="ncLat" class="pro-clean-input" style="margin-bottom: 0;" placeholder="43.xxxx">
                                </div>
                                <div>
                                    <label class="pro-field-label">Longitud</label>
                                    <input type="text" id="ncLng" class="pro-clean-input" style="margin-bottom: 0;" placeholder="-5.xxxx">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style="background: #ffffff; border-top: 1px solid #e2e8f0; display: grid; grid-template-columns: 1fr 1.3fr; gap: 10px; padding: 14px 16px;">
                        <button type="button" class="pro-btn-secondary-action" onclick="document.getElementById('newClientModal').classList.remove('open')">
                            <span class="material-icons-round">close</span>
                            <span>Cancelar</span>
                        </button>
                        <button type="submit" class="pro-btn-primary-action">
                            <span class="material-icons-round">save</span>
                            <span>Guardar Cliente</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    
    <div id="clientDetailModal" class="modal-overlay">
        <div class="modal-content" style="height: 92vh; max-height: 92vh; max-width: 540px !important; width: 96% !important; margin: auto; padding: 0; border-radius: 24px; overflow: hidden; display: flex; flex-direction: column;">
            <div id="modal-client-content" style="display: flex; flex-direction: column; flex: 1 1 auto; height: 100%; min-height: 0; overflow: hidden;"></div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
}

function getCurrentCoordinates() {
    if (!navigator.geolocation) return alert("GPS no disponible");
    navigator.geolocation.getCurrentPosition(p => {
        const latEl = document.getElementById('ncLat');
        const lngEl = document.getElementById('ncLng');
        if (latEl) { latEl.value = p.coords.latitude; latEl.dispatchEvent(new Event('input', { bubbles: true })); }
        if (lngEl) { lngEl.value = p.coords.longitude; lngEl.dispatchEvent(new Event('input', { bubbles: true })); }
    }, e => alert("Error GPS: " + e.message), { enableHighAccuracy: true });
}

function handleFormNavigation(event) {
    if (event.key === 'Enter' && event.target.tagName === 'INPUT') {
        const form = event.target.form;
        const index = Array.prototype.indexOf.call(form, event.target);
        if (form.elements[index + 1]) {
            event.preventDefault();
            form.elements[index + 1].focus();
        }
    }
}

function toggleQuickVisitBox() {
    const box = document.getElementById('quickVisitBox');
    if (!box) return;
    const isHidden = box.style.display === 'none' || !box.style.display;
    box.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
        const input = document.getElementById('clientVisitNoteInput');
        if (input) input.focus();
    }
}

async function confirmClientVisitCheckIn(clientCode) {
    const noteEl = document.getElementById('clientVisitNoteInput');
    const note = noteEl ? noteEl.value.trim() : '';
    const res = await dataManager.recordClientVisit(clientCode, note);
    if (res.success) {
        await openClientDetailModal(clientCode);
        if (window.currentView === 'clientes') renderClientes(true);
    } else {
        alert("No se pudo registrar la visita: " + (res.message || ''));
    }
}

async function quickCheckInVisit(clientCode) {
    const client = await dataManager.getClientByCode(clientCode);
    if (!client) return alert('Cliente no encontrado');
    const note = prompt(`👁️ Registrar visita de hoy a "${client.name}" (Sin pedido).\n\nNota rápida opcional (o déjalo en blanco):`, client.lastVisitNote || '');
    if (note === null) return; // Cancelado
    const res = await dataManager.recordClientVisit(clientCode, note);
    if (res.success) {
        if (window.showToast) {
            window.showToast(`👁️ Visita registrada: ${client.name}`);
        } else {
            alert(`👁️ Visita de hoy registrada en la ficha de ${client.name}`);
        }
        if (window.currentView === 'mapa' && typeof renderMapa === 'function') {
            renderMapa(true);
        } else if (window.currentView === 'clientes' && typeof renderClientes === 'function') {
            renderClientes(true);
        }
    }
}

async function saveQuickClientNotes(clientCode, isAutoFromVoice = false) {
    const input = document.getElementById('clientQuickNotesInput');
    if (!input) return;
    const res = await dataManager.saveClientQuickNotes(clientCode, input.value);
    if (res.success) {
        const badge = document.getElementById('quickNotesSavedStatus');
        if (badge) {
            badge.textContent = isAutoFromVoice
                ? '🎙️ Dictado guardado automáticamente en la ficha'
                : '✅ Nota guardada en la ficha del cliente';
            badge.style.display = 'block';
            setTimeout(() => { badge.style.display = 'none'; }, 3000);
        }
    }
}

// Globales
window.renderClientes = renderClientes;
window.filterClients = filterClients;
window.clearClientSearch = clearClientSearch;
window.openClientDetailModal = openClientDetailModal;
window.closeClientDetailModal = closeClientDetailModal;
window.openNewClientModal = openNewClientModal;
window.saveNewClient = saveNewClient;
window.handleClientImport = handleClientImport;
window.handleDriveImport = handleDriveImport;
window.handleDriveExportClients = handleDriveExportClients;
window.handleDeleteClient = handleDeleteClient;
window.getCurrentCoordinates = getCurrentCoordinates;
window.handleFormNavigation = handleFormNavigation;
window.injectClientModals = injectClientModals;
window.toggleQuickVisitBox = toggleQuickVisitBox;
window.confirmClientVisitCheckIn = confirmClientVisitCheckIn;
window.quickCheckInVisit = quickCheckInVisit;
window.saveQuickClientNotes = saveQuickClientNotes;




/**
 * Lógica de gestión de Clientes
 */

const APPS_SCRIPT_CLIENTS_URL = 'https://script.google.com/macros/s/AKfycbw0oAQ1Dq8gKHsy6vutnPh9xylbcFThY1irpehdeQTT9pY7LJAbvNIU0t6ZT0ovD2rMeg/exec';async function renderClientes() {
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Clientes');

    let contentHtml = '<main style="padding: 1rem 1.5rem; padding-bottom: 100px;" class="view-enter">';

    // Tarjeta de Importación Premium Rediseñada
    contentHtml += `
        <div class="premium-import-card">
            <div class="import-title-row">
                <div class="import-title-group">
                    <span class="material-icons-round">description</span>
                    <h3>Importar Clientes</h3>
                </div>
                <button class="btn-create-client-premium" onclick="openNewClientModal()">
                    <span class="material-icons-round">add</span>
                    <span>Crear nuevo</span>
                </button>
            </div>
            <p class="import-description">Selecciona un archivo Excel (.xlsx) o importa directamente desde Google Drive.</p>
            <div class="import-actions-row">
                <button class="btn-action-excel" onclick="document.getElementById('clientImportInput').click()">
                    <span class="material-icons-round">upload_file</span>
                    <span>Excel (.xlsx)</span>
                </button>
                <button class="btn-drive-premium" onclick="handleDriveImport()">
                    <span class="material-icons-round">cloud_download</span>
                    <span>Desde Drive</span>
                </button>
            </div>
            <input type="file" id="clientImportInput" accept=".xlsx, .xls" style="display: none;" onchange="handleClientImport(this)">
        </div>
    `;

    // Buscador
    contentHtml += `
        <!-- BUSCADOR CON ESTILOS INLINE PARA EVITAR CONFLICTOS -->
        <div style="position: relative; width: 100%; display: block; margin-bottom: 1rem;">
            <span class="material-icons-round" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none;">search</span>
            <input type="text" id="clientSearchInput" 
                   placeholder="Buscar por nombre o población..." 
                   onkeyup="filterClients(this.value)" 
                   oninput="toggleClearSearch('clientSearchInput', 'clearSearchBtn')"
                   style="width: 100% !important; padding: 10px 40px 10px 40px !important; box-sizing: border-box !important; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-family: inherit; font-size: 13.5px; font-weight: 700; color: #0f172a;">
            <span id="clearSearchBtn" class="material-icons-round" 
                  style="position: absolute !important; right: 12px !important; top: 50% !important; transform: translateY(-50%) !important; color: #94a3b8; cursor: pointer; z-index: 10; font-size: 18px; display: none;" 
                  onclick="clearClientSearch()">
                close
            </span>
        </div>
    `;

    const clients = await dataManager.getClients();
    clients.sort((a, b) => (a.location || '').localeCompare(b.location || ''));

    contentHtml += '<div id="clientsList" class="clients-list">';
    if (clients.length === 0) {
        contentHtml += '<div class="text-center p-8 text-secondary">No hay clientes registrados</div>';
    } else {
        clients.forEach(client => {
            contentHtml += `
                <div class="client-card card glass mb-3 p-3 flex justify-between items-center shadow-sm" 
                     onclick="openClientDetailModal('${String(client.code).replace(/'/g, "\\'")}')"
                     data-name="${client.name.toLowerCase()}" 
                     data-location="${(client.location || '').toLowerCase()}">
                    <div class="flex flex-col gap-2 w-full">
                        <div class="flex items-center gap-2">
                            <span class="client-code-badge-lite">${client.code}</span>
                            <span class="font-black text-gray-800 text-sm uppercase">${client.name}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <div class="pill-location">
                                <span class="material-icons-round">place</span>
                                ${client.location || 'Sin ubicación'}
                            </div>
                            ${client.contact ? `
                                <div class="pill-contact">
                                    <span class="material-icons-round">person</span>
                                    ${client.contact}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <span class="material-icons-round text-slate-400">menu</span>
                </div>
            `;
        });
    }
    contentHtml += '</div>';

    injectClientModals();

    contentHtml += '</main>';
    contentHtml += renderBottomNav('clientes');
    app.innerHTML = headerHtml + contentHtml;
    
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
    
    // Historial
    const orders = await dataManager.getOrders();
    const clientOrders = orders.filter(o => o.shop === client.name).sort((a,b) => new Date(b.dateISO) - new Date(a.dateISO));
    
    let historyHtml = '<div class="flex flex-col gap-1 mt-4">';
    if (clientOrders.length === 0) {
        historyHtml += '<p class="text-center text-xs text-gray-400 py-4">Sin historial de pedidos</p>';
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
                <div class="flex justify-between items-center" style="padding: 1rem 0 !important; border-bottom: 2px solid rgba(0,0,0,0.05) !important;">
                    <div>
                        <p style="font-size: 13px !important; color: #64748b !important; font-style: italic !important; font-weight: normal !important; margin-bottom: 6px !important;">
                            ${new Date(o.dateISO).toLocaleDateString('es-ES')}
                        </p>
                        <p style="font-size: 19px !important; font-weight: 900 !important; color: #1e293b !important; line-height: 1 !important;">
                            ${formattedAmount}
                        </p>
                    </div>
                    <div class="history-badge status-facturado">${statusLabel}</div>
                </div>
            `;
        });
    }
    historyHtml += '</div>';

    content.innerHTML = `
        <div class="v7-header shadow-lg">
            <!-- BOTON CERRAR: MINIMALISTA -->
            <div class="v7-btn-close-minimal" onclick="closeClientDetailModal()">
                <span class="material-icons-round">close</span>
            </div>

            <!-- IDENTIDAD: NOMBRE Y CODIGO UNIFICADOS CON RESTRICCION DE ANCHO -->
            <div class="flex flex-col" style="width: 100%; max-width: calc(100% - 60px); overflow: hidden;">
                <h2 class="v7-name-premium" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 1.5rem;">
                    ${client.code} &nbsp;&nbsp; ${client.name}
                </h2>
            </div>
            
            <!-- ACCIONES: BOTONES PROPORCIONALES Y SIMETRICOS -->
            <div class="v7-actions-row">
                <div class="v7-btn-base v7-btn-edit" onclick="openNewClientModal('${client.code}')">
                    <span class="material-icons-round" style="font-size: 20px;">edit</span>
                    <span>EDITAR</span>
                </div>
                <div class="v7-btn-base v7-btn-delete" onclick="handleDeleteClient('${client.code}')">
                    <span class="material-icons-round" style="font-size: 20px;">delete_outline</span>
                    <span>ELIMINAR</span>
                </div>
            </div>
        </div>
        
        <div class="modal-body p-6">
            <!-- Info List -->
            <div class="flex flex-col gap-6">
                
                <div class="detail-item-row">
                    <div class="info-icon-circle"><span class="material-icons-round">tag</span></div>
                    <div class="flex-1">
                        <label class="detail-label">Código de Cliente</label>
                        <p class="detail-value">${client.code}</p>
                    </div>
                </div>

                <div class="detail-item-row">
                    <div class="info-icon-circle"><span class="material-icons-round">place</span></div>
                    <div class="flex-1">
                        <label class="detail-label">Dirección</label>
                        <p class="detail-value">${client.address || '---'}</p>
                    </div>
                </div>

                <div class="detail-item-row">
                    <div class="info-icon-circle"><span class="material-icons-round">language</span></div>
                    <div class="flex-1 flex justify-between items-center pr-2">
                        <div class="field-vertical">
                            <label class="detail-label">Localidad</label>
                            <p class="detail-value">${client.location || '---'}</p>
                            <p class="text-[10px] text-slate-400 font-bold uppercase">Provincia: ${client.province || '---'}</p>
                        </div>
                        ${(client.lat && client.lng) ? `
                        <button class="btn-gps-navigation" onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${client.lat},${client.lng}', '_blank')">
                            <span class="material-icons-round" style="font-size: 20px;">directions</span>
                            <span>LLEVAME</span>
                        </button>
                        ` : ''}
                    </div>
                </div>

                <div class="detail-item-row">
                    <div class="info-icon-circle"><span class="material-icons-round">person</span></div>
                    <div class="flex-1">
                        <label class="detail-label">Persona de Contacto</label>
                        <p class="detail-value">${client.contact || '---'}</p>
                    </div>
                </div>

                <div class="detail-item-row">
                    <div class="info-icon-circle"><span class="material-icons-round" style="color: #25d366;">call_made</span></div>
                    <div class="flex-1 flex justify-between items-center" style="background: #eff6ff; padding: 1.25rem; border-radius: 20px; border: 1px solid #dbeafe; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.05);">
                        <div class="field-vertical">
                            <label class="detail-label" style="color: #1e40af; margin-bottom: 4px;">Teléfono de contacto</label>
                            <a href="tel:${(client.phone || '').replace(/\s+/g, '')}" class="detail-value block" style="font-size: 19px !important; color: #1e3a8a !important; font-weight: 900 !important;">${client.phone || '---'}</a>
                        </div>
                        <button class="btn-action-whatsapp-pill" onclick="window.open('https://wa.me/34${(client.phone || '').replace(/[^0-9]/g, '')}', '_blank')">
                            <span class="material-icons-round" style="font-size: 20px;">chat</span>
                            <span>WHATSAPP</span>
                        </button>
                    </div>
                </div>

                <div class="detail-item-row">
                    <div class="info-icon-circle"><span class="material-icons-round">mail</span></div>
                    <div class="flex-1 field-vertical">
                        <label class="detail-label">Correo Electrónico</label>
                        ${client.email ? `<a href="mailto:${client.email}" class="detail-value underline block" style="font-size: 16px !important;">${client.email}</a>` : `<p class="detail-value">---</p>`}
                    </div>
                </div>

                <div class="mt-2 pt-4 border-t border-slate-100">
                    <h3 class="text-lg font-black text-slate-800 flex items-center gap-3 mb-4">
                        <span class="material-icons-round text-blue-primary">history</span>
                        Historial de Pedidos
                    </h3>
                    ${historyHtml}
                </div>
            </div>
            
            <div class="modal-footer">
                <button class="btn-footer-close" onclick="closeClientDetailModal()">Cerrar</button>
            </div>
        </div>
    `;

    modal.classList.add('open');
    document.body.classList.add('no-scroll');

    // Auto-ajuste de tipografía Premium (Shrink-to-Fit) 
    if (window.autoShrinkText) {
        window.autoShrinkText(modal.querySelector('.v7-name-premium'));
        window.autoShrinkText(modal.querySelector('a[href^="mailto:"]'));
    }
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
            document.getElementById('ncEmail').value = client.email || '';
            document.getElementById('ncLocation').value = client.location || '';
            document.getElementById('ncProvince').value = client.province || '';
            document.getElementById('ncCP').value = client.cp || '';
            document.getElementById('ncAddress').value = client.address || '';
            document.getElementById('ncContact').value = client.contact || '';
            document.getElementById('ncSchedule').value = client.schedule || '';
            document.getElementById('ncLat').value = client.lat || '';
            document.getElementById('ncLng').value = client.lng || '';
            modal.querySelector('h2').textContent = 'Editar Cliente';
        });
    } else {
        form.dataset.isEdit = 'false';
        modal.querySelector('h2').textContent = 'Nuevo Cliente';
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
        email: document.getElementById('ncEmail').value,
        location: document.getElementById('ncLocation').value,
        province: document.getElementById('ncProvince').value,
        cp: document.getElementById('ncCP').value,
        address: document.getElementById('ncAddress').value,
        contact: document.getElementById('ncContact').value,
        schedule: document.getElementById('ncSchedule').value,
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
        let res;
        if (isEdit) res = await dataManager.updateClientInDrive(APPS_SCRIPT_CLIENTS_URL, filename, originalCode, data);
        else res = await dataManager.saveNewClientToDrive(APPS_SCRIPT_CLIENTS_URL, filename, data);

        if (res.success) {
            alert("Cliente guardado correctamente");
            document.getElementById('newClientModal').classList.remove('open');
            closeClientDetailModal();
            renderClientes();
        } else alert("Error: " + res.message);
    } catch (e) {
        alert("Error de conexión");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function handleDriveImport() {
    const btn = event.target.closest('button');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="material-icons-round animate-spin">sync</span>';
    btn.disabled = true;

    try {
        const res = await dataManager.importFromDrive(APPS_SCRIPT_CLIENTS_URL, 'Clientes_CON_COORDENADAS.xlsx');
        if (res.success) {
            alert(`Sincronizados ${res.count} clientes.`);
            renderClientes();
        } else alert("Error: " + res.message);
    } catch (e) {
        alert("Error de conexión");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function handleDeleteClient(code) {
    if (!confirm("¿Deseas eliminar este cliente permanentemente de Google Drive?")) return;
    try {
        const res = await dataManager.deleteClientFromDrive(APPS_SCRIPT_CLIENTS_URL, 'Clientes_CON_COORDENADAS.xlsx', code);
        if (res.success) {
            alert("Cliente eliminado");
            closeClientDetailModal();
            renderClientes();
        } else alert("Error: " + res.message);
    } catch (e) {
        alert("Error de conexión");
    }
}

function injectClientModals() {
    if (document.getElementById('newClientModal')) return;
    
    const html = `
    <div id="newClientModal" class="modal-overlay">
        <div class="modal-content" style="max-width: 580px !important; width: 95% !important; max-height: 94vh; padding: 0; overflow: hidden; margin: 0 auto; border-radius: 24px;">
            <!-- Estructura mediante Grid para fijar cabecera y pie -->
            <div style="display: grid; grid-template-rows: auto 1fr auto; height: 100%; width: 100%;">
                
                <!-- Cabecera Fija Premium con Margen de Seguridad -->
                <div class="client-detail-header" style="flex-shrink: 0; padding: 2.5rem !important; border-radius: 24px 24px 0 0; position: relative;">
                    <h2 class="text-2xl font-black uppercase text-white m-0" style="letter-spacing: -0.5px; padding-right: 60px;">Editar Cliente</h2>
                    <button type="button" class="btn-close-modal" onclick="document.getElementById('newClientModal').classList.remove('open')" style="right: 2.25rem !important; top: 2.25rem !important;">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                
                <!-- Contenedor del Formulario (Scrollable) -->
                <form id="newClientForm" onsubmit="event.preventDefault(); saveNewClient();" onkeydown="handleFormNavigation(event)" style="display: contents;">
                    <div class="modal-body p-10 overflow-y-auto">
                        
                        <div class="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <label class="premium-form-label">CÓDIGO *</label>
                                <input type="text" id="ncCode" class="premium-form-input" inputmode="numeric" pattern="[0-9]*" placeholder="Ej: 1234" required>
                            </div>
                            <div>
                                <label class="premium-form-label">TIENDA (NOMBRE) *</label>
                                <input type="text" id="ncName" class="premium-form-input" placeholder="Nombre completo del establecimiento" required>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <label class="premium-form-label">NIF</label>
                                <input type="text" id="ncNIF" class="premium-form-input" placeholder="NIF/DNI">
                            </div>
                            <div>
                                <label class="premium-form-label">TELÉFONO</label>
                                <input type="text" id="ncPhone" class="premium-form-input" inputmode="numeric" pattern="[0-9]*" placeholder="600000000">
                            </div>
                        </div>

                        <div class="premium-form-group mb-6">
                            <label class="premium-form-label">EMAIL</label>
                            <input type="email" id="ncEmail" class="premium-form-input" placeholder="cliente@correo.com">
                        </div>

                        <div class="premium-form-group mb-6">
                            <label class="premium-form-label">DIRECCIÓN</label>
                            <input type="text" id="ncAddress" class="premium-form-input" placeholder="Calle, número, piso...">
                        </div>

                        <div class="grid grid-cols-3 gap-4 mb-6">
                            <div>
                                <label class="premium-form-label">POBLACIÓN</label>
                                <input type="text" id="ncLocation" class="premium-form-input" placeholder="Ciudad">
                            </div>
                            <div>
                                <label class="premium-form-label">PROVINCIA</label>
                                <input type="text" id="ncProvince" class="premium-form-input" placeholder="Provincia">
                            </div>
                            <div>
                                <label class="premium-form-label">C.P.</label>
                                <input type="text" id="ncCP" class="premium-form-input" inputmode="numeric" pattern="[0-9]*" placeholder="33000">
                            </div>
                        </div>

                        <div class="premium-form-group mb-6">
                            <label class="premium-form-label">CONTACTO (PERSONA)</label>
                            <input type="text" id="ncContact" class="premium-form-input" placeholder="Nombre del responsable">
                        </div>

                        <div class="premium-form-group mb-6">
                            <label class="premium-form-label">HORARIO</label>
                            <input type="text" id="ncSchedule" class="premium-form-input" placeholder="Ej: 9:00 - 14:00">
                        </div>

                        <div class="p-6 bg-slate-50 rounded-2xl border border-slate-100 mb-4 text-center">
                            <label class="premium-form-label mb-4 flex items-center justify-center gap-2">
                                <span class="material-icons-round text-blue-500" style="font-size: 18px;">location_on</span>
                                UBICACIÓN (GPS)
                            </label>
                            <div class="grid grid-cols-2 gap-4 mb-6">
                                <input type="text" id="ncLat" class="premium-form-input bg-white" placeholder="Latitud (Ej: 43.1234)">
                                <input type="text" id="ncLng" class="premium-form-input bg-white" placeholder="Longitud (Ej: -6.1234)">
                            </div>
                            <div class="flex justify-center">
                                <button type="button" class="btn-premium-save" style="width: auto !important; height: auto !important; padding: 12px 30px !important; margin: 0 !important; gap: 8px;" onclick="getCurrentCoordinates()">
                                    <span class="material-icons-round" style="font-size: 20px;">gps_fixed</span> 
                                    <span>Obtener Coordenadas</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Pie Fijo (Footer) Premium - CENTRADO Y AIREADO -->
                    <div class="bg-white border-t border-slate-100 flex items-center justify-center gap-6 p-10 px-20">
                        <button type="button" class="btn-link-cancel" onclick="document.getElementById('newClientModal').classList.remove('open')">
                            <span class="material-icons-round">close</span>
                            Cancelar
                        </button>
                        <button type="submit" class="btn-premium-save">
                            <span class="material-icons-round">cloud_upload</span>
                            Guardar en Drive
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    
    <div id="clientDetailModal" class="modal-overlay">
        <div class="modal-content" style="height: 90vh; padding: 0; border-radius: 24px;">
            <div id="modal-client-content" class="h-full flex flex-col overflow-y-auto"></div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
}

function getCurrentCoordinates() {
    if (!navigator.geolocation) return alert("GPS no disponible");
    navigator.geolocation.getCurrentPosition(p => {
        document.getElementById('ncLat').value = p.coords.latitude;
        document.getElementById('ncLng').value = p.coords.longitude;
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

// Globales
window.renderClientes = renderClientes;
window.filterClients = filterClients;
window.clearClientSearch = clearClientSearch;
window.openClientDetailModal = openClientDetailModal;
window.closeClientDetailModal = closeClientDetailModal;
window.openNewClientModal = openNewClientModal;
window.saveNewClient = saveNewClient;
window.handleDriveImport = handleDriveImport;
window.handleDeleteClient = handleDeleteClient;
window.getCurrentCoordinates = getCurrentCoordinates;
window.handleFormNavigation = handleFormNavigation;
window.injectClientModals = injectClientModals;

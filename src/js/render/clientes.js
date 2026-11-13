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
                   oninput="filterClients(this.value)" 
                   onkeyup="filterClients(this.value)" 
                   onkeydown="if(event.key==='Enter') this.blur()">
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
            const searchCode = String(client.code || '').toLowerCase().replace(/"/g, '&quot;');
            const searchName = String(client.name || '').toLowerCase().replace(/"/g, '&quot;');
            const searchLoc = String(client.location || '').toLowerCase().replace(/"/g, '&quot;');
            const searchContact = String(client.contact || '').toLowerCase().replace(/"/g, '&quot;');
            const searchProv = String(client.province || '').toLowerCase().replace(/"/g, '&quot;');
            contentHtml += `
                <div class="client-card pro-client-item" 
                     onclick="openClientDetailModal('${String(client.code || '').replace(/'/g, "\\'")}')"
                     data-name="${searchCode} ${searchName} ${searchContact}" 
                     data-location="${searchLoc} ${searchProv}">
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

function _normSearchStr(str) {
    return String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function filterClients(query) {
    const inputEl = document.getElementById('clientSearchInput');
    const rawQuery = (query !== undefined && query !== null) ? query : (inputEl ? inputEl.value : '');
    const q = _normSearchStr(rawQuery);
    
    // Usar utilidad global para el botón X
    toggleClearSearch('clientSearchInput', 'clearSearchBtn');

    document.querySelectorAll('.client-card').forEach(card => {
        const name = _normSearchStr(card.getAttribute('data-name'));
        const loc = _normSearchStr(card.getAttribute('data-location'));
        const text = !q ? '' : _normSearchStr(card.textContent);
        const matches = !q || name.includes(q) || loc.includes(q) || text.includes(q);
        if (matches) {
            card.style.setProperty('display', 'flex', 'important');
        } else {
            card.style.setProperty('display', 'none', 'important');
        }
    });
}

function clearClientSearch() {
    clearSearchField('clientSearchInput', 'clearSearchBtn', () => filterClients(''));
}

function escapeClientHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatShortOrderDate(dateValue) {
    if (!dateValue) return '--/--/--';
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return '--/--/--';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
}

async function copyClientField(text, label, el) {
    const clean = String(text || '').trim();
    if (!clean) return;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(clean);
        } else {
            const ta = document.createElement('textarea');
            ta.value = clean;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        if (window.showToast) {
            window.showToast(`${label} copiado: ${clean}`);
        } else if (el) {
            el.classList.add('cd-copied-flash');
            setTimeout(() => el.classList.remove('cd-copied-flash'), 900);
        }
    } catch (e) {
        console.warn('No se pudo copiar al portapapeles:', e);
    }
}

function openClientMapsRoute(lat, lng, fallbackQuery) {
    const hasCoords = Boolean(lat && lng);
    if (hasCoords) {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`, '_blank');
        return;
    }
    const q = String(fallbackQuery || '').trim();
    if (q) {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, '_blank');
    }
}

async function openClientDetailModal(clientCode) {
    injectClientModals();
    const client = await dataManager.getClientByCode(clientCode);
    if (!client) return alert('Cliente no encontrado');

    const modal = document.getElementById('clientDetailModal');
    const content = document.getElementById('modal-client-content');

    // Historial completo (desde siempre, ordenado del más reciente al más antiguo)
    const orders = await dataManager.getOrders();
    const clientOrders = orders
        .filter(o => dataManager.isOrderForClient(o, client))
        .sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO));

    const currentYear = new Date().getFullYear();
    const currentYearOrders = clientOrders.filter(o => {
        const d = new Date(o.dateISO);
        return !Number.isNaN(d.getTime()) && d.getFullYear() === currentYear;
    });
    const currentYearOrdersCount = currentYearOrders.length;
    const currentYearTotalAmount = Math.round(
        currentYearOrders.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0)
    ).toLocaleString('de-DE') + ' €';
    const allTimeTotalAmount = Math.round(
        clientOrders.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0)
    ).toLocaleString('de-DE') + ' €';

    let historyHtml = '';
    if (clientOrders.length === 0) {
        historyHtml = '<p class="cd-empty-history">Sin pedidos registrados todavía</p>';
    } else {
        historyHtml = clientOrders.map(o => {
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
            const formattedDate = formatShortOrderDate(o.dateISO);

            return `
                <div class="cd-history-row">
                    <div class="cd-history-left">
                        <span class="cd-history-date">${formattedDate}</span>
                        <span class="cd-history-sep">·</span>
                        <span class="cd-history-amount">${formattedAmount}</span>
                    </div>
                    <span class="history-badge cd-history-badge ${statusClass}">${statusLabel}</span>
                </div>
            `;
        }).join('');
    }

    const safeCode = String(client.code || '').replace(/'/g, "\\'");
    const lastVisitFormatted = client.lastVisitDate ? formatShortOrderDate(client.lastVisitDate) : '';

    const cleanPhone1 = (client.phone || '').replace(/[\s'"\\]/g, '');
    const cleanPhone2 = (client.phone2 || '').replace(/[\s'"\\]/g, '');
    const primaryCallPhone = cleanPhone1 || cleanPhone2;
    const cleanEmail = (client.email || '').trim();
    const safeEmailArg = cleanEmail.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    const cleanCp = String(client.cp ?? client.CP ?? client.codigoPostal ?? '').trim();
    const cleanLocation = String(client.location || '').trim();
    const cleanProvince = String(client.province || '').trim();
    const locationWithCp = cleanLocation
        ? `${cleanLocation}${cleanCp ? ` (${cleanCp})` : ''}`
        : cleanCp;
    const locationText = [locationWithCp, cleanProvince].filter(Boolean).join(' · ') || '---';

    const mapsFallbackQuery = [client.address, cleanCp, cleanLocation, cleanProvince]
        .filter(Boolean)
        .join(', ');
    const hasMapsTarget = Boolean((client.lat && client.lng) || mapsFallbackQuery);
    const safeLat = String(client.lat || '').replace(/'/g, "\\'");
    const safeLng = String(client.lng || '').replace(/'/g, "\\'");
    const safeMapsQuery = mapsFallbackQuery.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    const mapsSvg = `
        <svg viewBox="0 0 48 48" width="26" height="26" aria-hidden="true">
            <path fill="#1a73e8" d="M24 4c-7.73 0-14 6.27-14 14 0 3.09 1.01 5.95 2.71 8.27L24 44l11.29-17.73A13.92 13.92 0 0 0 38 18c0-7.73-6.27-14-14-14z"/>
            <path fill="#ea4335" d="M24 4c-5.21 0-9.75 2.85-12.16 7.08L20.1 18h7.8L36.16 11.08C33.75 6.85 29.21 4 24 4z"/>
            <path fill="#fbbc04" d="M11.84 11.08A13.94 13.94 0 0 0 10 18c0 3.09 1.01 5.95 2.71 8.27L20.1 18l-8.26-6.92z"/>
            <path fill="#34a853" d="M24 44l11.29-17.73A13.94 13.94 0 0 0 38 18c0-2.5-.66-4.85-1.84-6.92L24 25.5V44z"/>
            <circle cx="24" cy="18" r="5.5" fill="#ffffff"/>
        </svg>`;

    const phoneSvg = `
        <svg viewBox="0 0 24 24" width="22" height="22" fill="#ffffff" aria-hidden="true">
            <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.46.57 3.58a1 1 0 0 1-.25 1.01l-2.2 2.2z"/>
        </svg>`;

    const whatsappSvg = `
        <svg viewBox="0 0 32 32" width="24" height="24" fill="#ffffff" aria-hidden="true">
            <path d="M16 3C8.82 3 3 8.82 3 16c0 2.48.7 4.8 1.91 6.77L3.4 28.6l6-1.48A12.93 12.93 0 0 0 16 29c7.18 0 13-5.82 13-13S23.18 3 16 3zm7.58 18.23c-.32.9-1.87 1.72-2.6 1.83-.66.1-1.5.14-2.42-.15-.56-.18-1.28-.42-2.2-.82-3.87-1.67-6.4-5.58-6.6-5.84-.2-.26-1.57-2.09-1.57-3.99s.99-2.83 1.35-3.22c.35-.39.77-.49 1.03-.49.26 0 .51 0 .74.01.24.01.56-.09.87.67.32.77 1.09 2.66 1.18 2.86.1.19.16.42.03.68-.13.26-.2.42-.39.64-.19.23-.41.51-.58.68-.19.19-.4.4-.17.79.23.39 1.01 1.66 2.17 2.69 1.49 1.33 2.75 1.74 3.14 1.94.39.19.62.16.85-.1.23-.26.97-1.13 1.23-1.52.26-.39.52-.32.87-.19.35.13 2.25 1.06 2.64 1.25.39.19.64.29.74.45.1.16.1.94-.22 1.84z"/>
        </svg>`;

    const outlookSvg = `
        <svg viewBox="0 0 48 48" width="26" height="26" aria-hidden="true">
            <rect x="17" y="10" width="23" height="28" rx="3" fill="#0364b8"/>
            <path fill="#28a8ea" d="M40 16H17v18c0 2.21 1.79 4 4 4h15c2.21 0 4-1.79 4-4V16z"/>
            <path fill="#0078d4" d="M17 16l11.5 8.2L40 16v-2.5c0-1.93-1.57-3.5-3.5-3.5h-16c-1.93 0-3.5 1.57-3.5 3.5V16z"/>
            <path fill="#50d9ff" d="M17 16l11.5 8.2L40 16H17z" opacity="0.45"/>
            <rect x="6" y="14" width="20" height="20" rx="3.5" fill="#0a58ca"/>
            <ellipse cx="16" cy="24" rx="4.8" ry="5.6" fill="none" stroke="#ffffff" stroke-width="2.6"/>
        </svg>`;

    content.innerHTML = `
        <!-- CABECERA COMPACTA -->
        <div class="cd-header">
            <div class="cd-header-left">
                <h2 class="cd-client-name">${escapeClientHtml(client.name || 'Sin Nombre')}</h2>
                <div class="cd-contact-person">${escapeClientHtml(client.contact || 'Sin persona de contacto')}</div>
                <div class="cd-contact-sub">Persona de contacto</div>
            </div>
            <div class="cd-header-right">
                <div class="cd-code-block">
                    <div class="cd-client-code">${escapeClientHtml(client.code || '---')}</div>
                    <div class="cd-code-sub">Código de cliente</div>
                </div>
                <button type="button" class="cd-header-close-btn" onclick="closeClientDetailModal()" title="Cerrar ficha" aria-label="Cerrar ficha">
                    <span class="material-icons-round">close</span>
                </button>
            </div>
        </div>

        <!-- CUERPO SCROLLABLE -->
        <div class="cd-body">
            <!-- BLOQUE SUPERIOR: DATOS + BOTONES CORPORATIVOS -->
            <div class="cd-top-split">
                <div class="cd-info-list">
                    <div class="cd-info-item">
                        <span class="material-icons-round cd-info-icon">place</span>
                        <div class="cd-info-text">
                            <span class="cd-info-value">${escapeClientHtml(client.address || '---')}</span>
                            <span class="cd-info-label">Dirección</span>
                        </div>
                    </div>

                    <div class="cd-info-item">
                        <span class="material-icons-round cd-info-icon">map</span>
                        <div class="cd-info-text">
                            <span class="cd-info-value">${escapeClientHtml(locationText)}</span>
                            <span class="cd-info-label">Población</span>
                        </div>
                    </div>

                    <div class="cd-info-item">
                        <span class="material-icons-round cd-info-icon">badge</span>
                        <div class="cd-info-text">
                            <span class="cd-info-value">${escapeClientHtml(client.nif || '---')}</span>
                            <span class="cd-info-label">NIF</span>
                        </div>
                    </div>

                    <div class="cd-info-item">
                        <span class="material-icons-round cd-info-icon">call</span>
                        <div class="cd-info-text">
                            ${cleanPhone1
                                ? `<button type="button" class="cd-info-value cd-copyable" onclick="copyClientField('${cleanPhone1}', 'Teléfono', this)" title="Pulsa para copiar">${escapeClientHtml(client.phone)}</button>`
                                : `<span class="cd-info-value cd-muted">---</span>`}
                            <span class="cd-info-label">Teléfono</span>
                            ${cleanPhone2 ? `
                            <div class="cd-secondary-phone-row">
                                <button type="button" class="cd-secondary-phone-link cd-copyable" onclick="copyClientField('${cleanPhone2}', 'Teléfono 2', this)" title="Pulsa para copiar">
                                    Alt: ${escapeClientHtml(client.phone2)}
                                </button>
                                <button type="button" class="cd-mini-comm-btn cd-mini-call" onclick="window.location.href='tel:${cleanPhone2}'" title="Llamar al secundario">
                                    <span class="material-icons-round">call</span>
                                </button>
                                <button type="button" class="cd-mini-comm-btn cd-mini-wa" onclick="window.openAppWhatsApp('${cleanPhone2}')" title="Whatsapp al secundario">
                                    <span class="material-icons-round">chat</span>
                                </button>
                            </div>
                            ` : ''}
                        </div>
                    </div>

                    <div class="cd-info-item">
                        <span class="material-icons-round cd-info-icon">mail</span>
                        <div class="cd-info-text">
                            ${cleanEmail
                                ? `<button type="button" class="cd-info-value cd-info-email cd-copyable" onclick="copyClientField('${safeEmailArg}', 'Mail', this)" title="Pulsa para copiar">${escapeClientHtml(cleanEmail)}</button>`
                                : `<span class="cd-info-value cd-muted">---</span>`}
                            <span class="cd-info-label">Mail</span>
                        </div>
                    </div>

                    <div class="cd-info-item">
                        <span class="material-icons-round cd-info-icon">schedule</span>
                        <div class="cd-info-text">
                            <span class="cd-info-value">${escapeClientHtml(client.schedule || '---')}</span>
                            <span class="cd-info-label">Horario comercial</span>
                        </div>
                    </div>
                </div>

                <!-- COLUMNA DERECHA: ICONOS CORPORATIVOS -->
                <div class="cd-action-rail">
                    <button type="button"
                            class="cd-action-btn ${hasMapsTarget ? '' : 'is-disabled'}"
                            onclick="${hasMapsTarget ? `openClientMapsRoute('${safeLat}', '${safeLng}', '${safeMapsQuery}')` : ''}"
                            title="Cómo llegar en Google Maps">
                        <span class="cd-action-circle cd-circle-maps">${mapsSvg}</span>
                        <span class="cd-action-label">Cómo llegar</span>
                    </button>

                    <button type="button"
                            class="cd-action-btn ${primaryCallPhone ? '' : 'is-disabled'}"
                            onclick="${primaryCallPhone ? `window.location.href='tel:${primaryCallPhone}'` : ''}"
                            title="Llamar por teléfono">
                        <span class="cd-action-circle cd-circle-phone">${phoneSvg}</span>
                        <span class="cd-action-label">Llamar</span>
                    </button>

                    <button type="button"
                            class="cd-action-btn ${primaryCallPhone ? '' : 'is-disabled'}"
                            onclick="${primaryCallPhone ? `window.openAppWhatsApp('${primaryCallPhone}')` : ''}"
                            title="Abrir Whatsapp">
                        <span class="cd-action-circle cd-circle-wa">${whatsappSvg}</span>
                        <span class="cd-action-label">Whatsapp</span>
                    </button>

                    <button type="button"
                            class="cd-action-btn ${cleanEmail ? '' : 'is-disabled'}"
                            onclick="${cleanEmail ? `window.openAppEmail('${safeEmailArg}')` : ''}"
                            title="Abrir Mail">
                        <span class="cd-action-circle cd-circle-outlook">${outlookSvg}</span>
                        <span class="cd-action-label">Mail</span>
                    </button>
                </div>
            </div>

            <!-- HISTORIAL DE PEDIDOS CON SCROLL VERTICAL -->
            <div class="cd-history-card">
                <div class="cd-history-head">
                    <span class="cd-history-title">Historial de Pedidos</span>
                    <div class="cd-history-summary">
                        <div class="cd-summary-chip cd-summary-year">
                            <span class="cd-summary-label">${currentYear}:</span>
                            <span class="cd-summary-value">${currentYearOrdersCount} ped. · ${currentYearTotalAmount}</span>
                        </div>
                        <div class="cd-summary-chip cd-summary-total">
                            <span class="cd-summary-label">Total:</span>
                            <span class="cd-summary-value">${clientOrders.length} ped. · ${allTimeTotalAmount}</span>
                        </div>
                    </div>
                </div>
                <div class="cd-history-scroll">
                    ${historyHtml}
                </div>
            </div>

            <!-- BOTONES PRINCIPALES -->
            <div class="cd-primary-actions">
                <button type="button" class="cd-btn-new-order" onclick="window.openNewOrderForClient('${safeCode}')">
                    <span class="material-icons-round">add_shopping_cart</span>
                    <span>Nuevo pedido</span>
                </button>
                <button type="button" class="cd-btn-visit" onclick="toggleQuickVisitBox()">
                    <span class="material-icons-round">visibility</span>
                    <span>Registrar visita</span>
                </button>
            </div>

            <!-- CAJÓN DESPLEGABLE PARA VISITA SIN PEDIDO -->
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
                       value=""
                       placeholder="Ej. Visitar en 15 días, avisar cuando entren platos...">

                <div class="cd-visit-alert-row">
                    <div class="cd-visit-alert-top">
                        <span class="cd-visit-alert-label">
                            <span class="material-icons-round">notifications_active</span>
                            <span>Alerta (opcional)</span>
                        </span>
                        <div class="cd-visit-quick-pills">
                            <button type="button" class="cd-visit-offset-btn" data-days="7" onclick="setQuickVisitAlertOffset(7, this)">+7d</button>
                            <button type="button" class="cd-visit-offset-btn" data-days="15" onclick="setQuickVisitAlertOffset(15, this)">+15d</button>
                            <button type="button" class="cd-visit-offset-btn" data-days="30" onclick="setQuickVisitAlertOffset(30, this)">+1m</button>
                            <button type="button" class="cd-visit-offset-btn cd-visit-offset-clear" onclick="setQuickVisitAlertOffset(0, this)" title="Quitar fecha">✕</button>
                        </div>
                    </div>
                    <input type="date" id="clientVisitAlertDateInput" class="cd-visit-date-input" onchange="syncQuickVisitOffsetHighlight()">
                </div>

                <button type="button" class="pro-btn-confirm-visit" onclick="confirmClientVisitCheckIn('${safeCode}')">
                    <span class="material-icons-round">check_circle</span>
                    <span>Guardar Visita de Hoy</span>
                </button>
                <div id="quickVisitSavedMsg" class="pro-notes-saved-msg" style="display: none;">✅ Nota de visita guardada</div>
            </div>

            <div id="lastVisitInfoBanner" class="cd-visit-banner" style="${lastVisitFormatted ? '' : 'display: none;'}">
                <span class="material-icons-round">event_available</span>
                <div id="lastVisitInfoBannerText" class="cd-visit-banner-text">
                    ${lastVisitFormatted ? `<strong>Última visita:</strong> ${lastVisitFormatted}${client.lastVisitNote ? ` <span class="cd-visit-quote">· "${escapeClientHtml(client.lastVisitNote)}"</span>` : ''}` : ''}
                </div>
            </div>

            <!-- NOTAS PERMANENTES -->
            <div class="cd-notes-section">
                <div class="cd-notes-title">Notas</div>
                <div class="cd-notes-box">
                    <textarea id="clientQuickNotesInput" rows="2" class="cd-notes-textarea"
                              placeholder="Escribe o dicta notas fijas (ej. prefiere entregas por la mañana...)">${escapeClientHtml(client.notes || '')}</textarea>
                    <div class="cd-notes-toolbar">
                        <button type="button" class="cd-notes-mic-btn" onclick="window.toggleVoiceDictation('clientQuickNotesInput', this, () => saveQuickClientNotes('${safeCode}', true))" title="Dictar nota por voz">
                            <span class="material-icons-round">mic</span>
                        </button>
                        <button type="button" id="btnSaveQuickNotes" class="cd-notes-save-btn" onclick="saveQuickClientNotes('${safeCode}', false)">
                            Guardar
                        </button>
                    </div>
                </div>
                <div id="quickNotesSavedStatus" class="pro-notes-saved-msg" style="display: none;">✅ Nota guardada en la ficha del cliente</div>
            </div>
        </div>

        <!-- PIE FIJO: EDITAR / BORRAR / CERRAR -->
        <div class="cd-footer">
            <button type="button" class="cd-footer-btn cd-footer-edit" onclick="openNewClientModal('${safeCode}')">Editar</button>
            <button type="button" class="cd-footer-btn cd-footer-delete" onclick="handleDeleteClient('${safeCode}')">Borrar</button>
            <button type="button" class="cd-footer-btn cd-footer-close" onclick="closeClientDetailModal()">Cerrar</button>
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

function setQuickVisitAlertOffset(days, btnEl) {
    const dateInput = document.getElementById('clientVisitAlertDateInput');
    if (!dateInput) return;

    document.querySelectorAll('.cd-visit-offset-btn').forEach(b => b.classList.remove('is-active'));

    if (!days || days <= 0) {
        dateInput.value = '';
        return;
    }

    const d = new Date();
    if (days === 30) {
        d.setMonth(d.getMonth() + 1);
    } else {
        d.setDate(d.getDate() + days);
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dateInput.value = `${yyyy}-${mm}-${dd}`;
    if (btnEl) btnEl.classList.add('is-active');
}

function syncQuickVisitOffsetHighlight() {
    document.querySelectorAll('.cd-visit-offset-btn').forEach(b => b.classList.remove('is-active'));
}

async function confirmClientVisitCheckIn(clientCode) {
    const noteEl = document.getElementById('clientVisitNoteInput');
    const alertEl = document.getElementById('clientVisitAlertDateInput');
    const note = noteEl ? noteEl.value.trim() : '';
    const alertDate = alertEl ? alertEl.value.trim() : '';

    const res = await dataManager.recordClientVisit(clientCode, note, null, alertDate);
    if (res.success) {
        // Limpiar caja y fecha para permitir añadir múltiples notas seguidas
        if (noteEl) {
            noteEl.value = '';
            noteEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (alertEl) alertEl.value = '';
        syncQuickVisitOffsetHighlight();

        const savedEl = document.getElementById('quickVisitSavedMsg');
        if (savedEl) {
            savedEl.textContent = alertDate
                ? `✅ Visita guardada · Alerta programada para el ${formatShortOrderDate(alertDate)}`
                : '✅ Visita guardada en Notas de visita';
            savedEl.style.display = 'block';
            clearTimeout(savedEl._hideTimer);
            savedEl._hideTimer = setTimeout(() => { savedEl.style.display = 'none'; }, 3500);
        }

        const bannerEl = document.getElementById('lastVisitInfoBanner');
        const bannerTextEl = document.getElementById('lastVisitInfoBannerText');
        if (bannerEl && bannerTextEl && res.client) {
            const formattedDate = formatShortOrderDate(res.client.lastVisitDate);
            const noteHtml = res.client.lastVisitNote
                ? ` <span class="cd-visit-quote">· "${escapeClientHtml(res.client.lastVisitNote)}"</span>`
                : '';
            bannerTextEl.innerHTML = `<strong>Última visita:</strong> ${formattedDate}${noteHtml}`;
            bannerEl.style.display = 'flex';
        }

        if (window.currentView === 'clientes') renderClientes(true);
        else if (window.currentView === 'dash' && typeof renderDash === 'function') renderDash(true);
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
window.setQuickVisitAlertOffset = setQuickVisitAlertOffset;
window.syncQuickVisitOffsetHighlight = syncQuickVisitOffsetHighlight;
window.confirmClientVisitCheckIn = confirmClientVisitCheckIn;
window.quickCheckInVisit = quickCheckInVisit;
window.saveQuickClientNotes = saveQuickClientNotes;
window.copyClientField = copyClientField;
window.openClientMapsRoute = openClientMapsRoute;




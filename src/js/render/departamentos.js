/**
 * Lógica de Directorio de Departamentos — Diseño Unificado Móvil
 */

function escapeDeptHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getDeptVisualTheme(dept) {
    const text = `${dept?.name || ''} ${dept?.functions || ''}`.toLowerCase();
    if (text.includes('pedido') || text.includes('factur')) {
        return { icon: 'receipt_long', bg: '#e0f2fe', color: '#0284c7', accent: '#0284c7' };
    }
    if (text.includes('transport') || text.includes('agencia') || text.includes('recogida')) {
        return { icon: 'local_shipping', bg: '#eef2ff', color: '#4f46e5', accent: '#4f46e5' };
    }
    if (text.includes('rotura') || text.includes('inciden') || text.includes('moros')) {
        return { icon: 'report_problem', bg: '#fef3c7', color: '#d97706', accent: '#d97706' };
    }
    if (text.includes('contab') || text.includes('vto') || text.includes('banc')) {
        return { icon: 'account_balance', bg: '#dcfce7', color: '#15803d', accent: '#16a34a' };
    }
    if (text.includes('gesti') || text.includes('ingreso') || text.includes('baja')) {
        return { icon: 'manage_accounts', bg: '#f3e8ff', color: '#7c3aed', accent: '#7c3aed' };
    }
    if (text.includes('internacional') || text.includes('compra') || text.includes('import')) {
        return { icon: 'public', bg: '#ccfbf1', color: '#0f766e', accent: '#0d9488' };
    }
    if (text.includes('catálogo') || text.includes('catalogo') || text.includes('muestra')) {
        return { icon: 'menu_book', bg: '#fce7f3', color: '#be185d', accent: '#db2777' };
    }
    if (text.includes('tampo') || text.includes('serigraf') || text.includes('grab')) {
        return { icon: 'brush', bg: '#cffafe', color: '#0e7490', accent: '#0891b2' };
    }
    return { icon: 'business_center', bg: '#f1f5f9', color: '#334155', accent: '#009ee3' };
}

function parseDeptFunctionsList(raw) {
    const text = String(raw || '').trim();
    if (!text) return [];
    return text
        .split(/\r?\n|\s+-\s+|\s*[|>•]\s*|^\s*-\s+/m)
        .map(item => item.trim())
        .filter(item => item.length > 0 && item !== '...' && item !== '…');
}

function splitDeptDisplayTitle(rawName) {
    const clean = String(rawName || '').trim();
    // Si tiene formato "Nombre - Departamento" o similar y ya existe contactName, dejamos el nombre del depto limpio
    const idx = clean.indexOf(' - ');
    if (idx > 0 && idx < clean.length - 3) {
        return clean.slice(idx + 3).trim();
    }
    return clean;
}

function formatDeptPhoneDisplay(raw) {
    const digits = String(raw || '').replace(/[^0-9+]/g, '');
    if (digits.length === 9 && !digits.startsWith('+')) {
        return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }
    return String(raw || '').trim();
}

async function copyDeptField(text, label, el) {
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
            el.classList.add('is-copied');
            setTimeout(() => el.classList.remove('is-copied'), 900);
        }
    } catch (e) {
        console.warn('No se pudo copiar:', e);
    }
}

async function renderDepartamentos(isBack = false) {
    if (typeof updateHistoryState === 'function') updateHistoryState('departamentos', isBack);
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Departamentos', {
        showBack: true,
        extraAction: `
            <button type="button" class="btn-header-pill" onclick="openDeptModal()">
                <span class="material-icons-round">add</span>
                <span>Nuevo</span>
            </button>
        `
    });

    const depts = await dataManager.getDepartamentos();
    let contentHtml = '<main class="dept-view-main view-enter">';

    if (!depts || depts.length === 0) {
        contentHtml += `
            <div class="dept-empty-state">
                <div class="dept-empty-icon">
                    <span class="material-icons-round">contact_mail</span>
                </div>
                <h3 class="dept-empty-title">Directorio vacío</h3>
                <p class="dept-empty-sub">Añade los departamentos y personas de contacto para tener sus teléfonos, WhatsApp, correos y funciones siempre a mano.</p>
                <button type="button" class="dept-empty-btn" onclick="openDeptModal()">
                    <span class="material-icons-round">add</span>
                    <span>Añadir Departamento</span>
                </button>
            </div>
        `;
    } else {
        contentHtml += `
            <div class="pro-search-bar dept-search-bar">
                <span class="material-icons-round pro-search-icon">search</span>
                <input type="text" id="deptSearchInput" class="pro-search-input"
                       placeholder="Buscar área, persona o gestión (ej: roturas, vtos)..."
                       oninput="filterDepartamentos()"
                       onkeyup="filterDepartamentos()"
                       onkeydown="if(event.key==='Enter') this.blur()">
                <div class="pro-search-actions">
                    <button type="button" id="clearDeptSearchBtn" class="pro-search-clear-btn"
                            style="display: none;"
                            onclick="clearDeptSearch()"
                            title="Borrar búsqueda">
                        <span class="material-icons-round">close</span>
                    </button>
                    <button type="button" class="pro-search-mic-btn"
                            onclick="window.toggleVoiceDictation('deptSearchInput', this)"
                            title="Buscar por voz">
                        <span class="material-icons-round">mic</span>
                    </button>
                </div>
            </div>

            <div class="dept-summary-bar">
                <span id="deptCountLabel" class="dept-summary-count">${depts.length} ${depts.length === 1 ? 'departamento' : 'departamentos'}</span>
                <span class="dept-summary-hint">Toca una tarjeta para ver Mail y funciones</span>
            </div>

            <div id="deptListContainer" class="dept-container">
        `;

        depts.forEach(dept => {
            const theme = getDeptVisualTheme(dept);
            const displayArea = splitDeptDisplayTitle(dept.name) || dept.name || 'Departamento';
            const contactName = String(dept.contactName || '').trim() || 'Sin asignar';
            const fnItems = parseDeptFunctionsList(dept.functions);
            const fnPreview = fnItems.length > 0 ? fnItems.join(' · ') : (dept.functions || 'Sin funciones especificadas');

            const cleanPhone = String(dept.phone || '').replace(/\s+/g, '');
            const cleanWa = String(dept.whatsapp || dept.phone || '').replace(/[^0-9]/g, '');
            const searchKey = escapeDeptHtml(`${dept.name || ''} ${displayArea} ${contactName} ${dept.functions || ''}`.toLowerCase());
            const safeId = escapeDeptHtml(dept.id);

            contentHtml += `
                <div class="dept-card"
                     style="--dept-accent: ${theme.accent};"
                     data-search="${searchKey}"
                     onclick="openDeptDetailModal('${safeId}')">
                    <div class="dept-card-icon" style="background: ${theme.bg}; color: ${theme.color};">
                        <span class="material-icons-round">${theme.icon}</span>
                    </div>

                    <div class="dept-card-body">
                        <div class="dept-card-head">
                            <h3 class="dept-card-title">${escapeDeptHtml(displayArea)}</h3>
                            <span class="dept-card-person">${escapeDeptHtml(contactName)}</span>
                        </div>
                        <p class="dept-card-preview">${escapeDeptHtml(fnPreview)}</p>
                    </div>

                    <div class="dept-card-actions">
                        ${window.renderCorpActionBtn({
                            type: 'phone',
                            onclick: cleanPhone ? `window.location.href='tel:${cleanPhone}'` : '',
                            label: 'Llamar',
                            title: cleanPhone ? `Llamar a ${contactName}` : 'Sin teléfono',
                            disabled: !cleanPhone,
                            compact: true,
                            stopPropagation: true
                        })}
                        ${window.renderCorpActionBtn({
                            type: 'whatsapp',
                            onclick: cleanWa ? `window.openAppWhatsApp('${cleanWa}')` : '',
                            label: 'Whatsapp',
                            title: cleanWa ? `Whatsapp a ${contactName}` : 'Sin WhatsApp',
                            disabled: !cleanWa,
                            compact: true,
                            stopPropagation: true
                        })}
                    </div>
                </div>
            `;
        });

        contentHtml += `
            </div>
            <div id="deptNoMatchMsg" class="dept-no-match" style="display: none;">
                No hay departamentos que coincidan con tu búsqueda
            </div>
        `;
    }

    injectDeptModals();

    contentHtml += '</main>';
    contentHtml += renderBottomNav(null);
    app.innerHTML = headerHtml + contentHtml;
    if (window.restoreScroll) window.restoreScroll();
}

function filterDepartamentos() {
    const input = document.getElementById('deptSearchInput');
    const clearBtn = document.getElementById('clearDeptSearchBtn');
    const countLabel = document.getElementById('deptCountLabel');
    const noMatch = document.getElementById('deptNoMatchMsg');
    if (!input) return;

    const query = String(input.value || '').trim().toLowerCase();
    if (clearBtn) clearBtn.style.display = query ? 'inline-flex' : 'none';

    const cards = document.querySelectorAll('#deptListContainer .dept-card');
    let visible = 0;
    cards.forEach(card => {
        const hay = card.getAttribute('data-search') || '';
        const match = !query || hay.includes(query);
        card.style.display = match ? '' : 'none';
        if (match) visible++;
    });

    if (countLabel) {
        countLabel.textContent = `${visible} ${visible === 1 ? 'departamento' : 'departamentos'}`;
    }
    if (noMatch) {
        noMatch.style.display = visible === 0 && cards.length > 0 ? 'block' : 'none';
    }
}

function clearDeptSearch() {
    const input = document.getElementById('deptSearchInput');
    if (!input) return;
    input.value = '';
    filterDepartamentos();
    input.focus();
}

function injectDeptModals() {
    if (document.getElementById('newDeptModal')) return;

    const html = `
    <div id="newDeptModal" class="modal-overlay" onclick="if(event.target.id==='newDeptModal') closeDeptModal()">
        <div class="modal-content dept-form-modal-content">
            <div class="dept-modal-header">
                <div class="dept-modal-header-info">
                    <div class="dept-modal-header-badge">
                        <span class="material-icons-round">business_center</span>
                    </div>
                    <div>
                        <h2 id="deptFormModalTitle" class="dept-modal-title">Nuevo Departamento</h2>
                        <p class="dept-modal-sub">Contacto interno y responsabilidades</p>
                    </div>
                </div>
                <button type="button" class="dept-modal-close" onclick="closeDeptModal()" aria-label="Cerrar">
                    <span class="material-icons-round">close</span>
                </button>
            </div>

            <form id="newDeptForm" class="dept-form-body" onsubmit="event.preventDefault(); saveNewDepartment();">
                <input type="hidden" id="deptId">
                <input type="hidden" id="deptCreatedAt">

                <div class="dept-form-group">
                    <label class="dept-form-label" for="deptName">Nombre del Departamento *</label>
                    <input type="text" id="deptName" class="dept-form-input" required placeholder="Ej: Pedidos, Transporte, Roturas...">
                </div>

                <div class="dept-form-group">
                    <label class="dept-form-label" for="deptContactName">Persona de Contacto</label>
                    <input type="text" id="deptContactName" class="dept-form-input" placeholder="Ej: Joaquín, Susana...">
                </div>

                <div class="dept-form-row-2">
                    <div class="dept-form-group">
                        <label class="dept-form-label" for="deptPhone">Teléfono</label>
                        <input type="tel" id="deptPhone" class="dept-form-input" placeholder="600 000 000">
                    </div>
                    <div class="dept-form-group">
                        <label class="dept-form-label" for="deptWhatsapp">WhatsApp</label>
                        <input type="tel" id="deptWhatsapp" class="dept-form-input" placeholder="600 000 000">
                    </div>
                </div>

                <div class="dept-form-group">
                    <label class="dept-form-label" for="deptMail">Correo Electrónico</label>
                    <input type="email" id="deptMail" class="dept-form-input" placeholder="departamento@empresa.com">
                </div>

                <div class="dept-form-group">
                    <label class="dept-form-label" for="deptFunctions">Funciones y Gestiones</label>
                    <textarea id="deptFunctions" class="dept-form-input dept-form-textarea" rows="3"
                              placeholder="Separa cada función con guiones o saltos de línea..."></textarea>
                </div>

                <div class="dept-form-footer">
                    <button type="button" class="dept-btn-cancel" onclick="closeDeptModal()">Cancelar</button>
                    <button type="submit" class="dept-btn-save">
                        <span class="material-icons-round">check</span>
                        <span>Guardar</span>
                    </button>
                </div>
            </form>
        </div>
    </div>

    <div id="deptDetailModal" class="modal-overlay" onclick="if(event.target.id==='deptDetailModal') closeDeptDetailModal()">
        <div class="modal-content dept-detail-modal-content">
            <div id="detailContent" class="dept-detail-shell"></div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
}

async function openDeptDetailModal(id) {
    const depts = await dataManager.getDepartamentos();
    const dept = depts.find(d => String(d.id) === String(id));
    if (!dept) return;

    const content = document.getElementById('detailContent');
    if (!content) return;

    const theme = getDeptVisualTheme(dept);
    const displayArea = splitDeptDisplayTitle(dept.name) || dept.name || 'Departamento';
    const contactName = String(dept.contactName || '').trim() || 'Responsable no asignado';

    const rawPhone = String(dept.phone || '').trim();
    const cleanPhone = rawPhone.replace(/\s+/g, '');
    const rawWa = String(dept.whatsapp || '').trim();
    const cleanWa = rawWa.replace(/[^0-9]/g, '');
    const cleanMail = String(dept.mail || '').trim();

    const safePhoneCopy = escapeDeptHtml(rawPhone).replace(/'/g, "\\'");
    const safeWaCopy = escapeDeptHtml(rawWa).replace(/'/g, "\\'");
    const safeMailCopy = escapeDeptHtml(cleanMail).replace(/'/g, "\\'");
    const safeMailArg = cleanMail.replace(/'/g, "\\'");
    const safeId = escapeDeptHtml(dept.id).replace(/'/g, "\\'");

    const fnItems = parseDeptFunctionsList(dept.functions);

    content.innerHTML = `
        <div class="dept-modal-header">
            <div class="dept-modal-header-info">
                <div class="dept-modal-header-badge">
                    <span class="material-icons-round">${theme.icon}</span>
                </div>
                <div class="dept-modal-header-text">
                    <h2 class="dept-modal-title">${escapeDeptHtml(displayArea)}</h2>
                    <div class="dept-modal-person">${escapeDeptHtml(contactName)}</div>
                    <div class="dept-modal-person-sub">Persona de contacto</div>
                </div>
            </div>
            <button type="button" class="dept-modal-close" onclick="closeDeptDetailModal()" aria-label="Cerrar ficha">
                <span class="material-icons-round">close</span>
            </button>
        </div>

        <div class="dept-detail-body">
            <div class="dept-channels-card">
                <div class="dept-channel-row">
                    <div class="dept-channel-main">
                        <span class="dept-channel-label">Teléfono</span>
                        ${rawPhone
                            ? `<button type="button" class="dept-channel-value dept-copyable" onclick="copyDeptField('${safePhoneCopy}', 'Teléfono', this)" title="Pulsa para copiar">
                                   <span>${escapeDeptHtml(formatDeptPhoneDisplay(rawPhone))}</span>
                                   <span class="material-icons-round dept-copy-mini">content_copy</span>
                               </button>`
                            : `<span class="dept-channel-value dept-muted">Sin teléfono</span>`}
                    </div>
                    <div class="dept-channel-action">
                        ${window.renderCorpActionBtn({
                            type: 'phone',
                            onclick: cleanPhone ? `window.location.href='tel:${cleanPhone}'` : '',
                            label: 'Llamar',
                            title: cleanPhone ? `Llamar a ${rawPhone}` : 'Sin teléfono',
                            disabled: !cleanPhone,
                            compact: true
                        })}
                    </div>
                </div>

                <div class="dept-channel-row">
                    <div class="dept-channel-main">
                        <span class="dept-channel-label">WhatsApp</span>
                        ${rawWa
                            ? `<button type="button" class="dept-channel-value dept-copyable" onclick="copyDeptField('${safeWaCopy}', 'WhatsApp', this)" title="Pulsa para copiar">
                                   <span>${escapeDeptHtml(formatDeptPhoneDisplay(rawWa))}</span>
                                   <span class="material-icons-round dept-copy-mini">content_copy</span>
                               </button>`
                            : `<span class="dept-channel-value dept-muted">Sin WhatsApp</span>`}
                    </div>
                    <div class="dept-channel-action">
                        ${window.renderCorpActionBtn({
                            type: 'whatsapp',
                            onclick: cleanWa ? `window.openAppWhatsApp('${cleanWa}')` : '',
                            label: 'Whatsapp',
                            title: cleanWa ? `Whatsapp a ${rawWa}` : 'Sin WhatsApp',
                            disabled: !cleanWa,
                            compact: true
                        })}
                    </div>
                </div>

                <div class="dept-channel-row">
                    <div class="dept-channel-main">
                        <span class="dept-channel-label">Correo electrónico</span>
                        ${cleanMail
                            ? `<button type="button" class="dept-channel-value dept-channel-email dept-copyable" onclick="copyDeptField('${safeMailCopy}', 'Correo', this)" title="Pulsa para copiar">
                                   <span>${escapeDeptHtml(cleanMail)}</span>
                                   <span class="material-icons-round dept-copy-mini">content_copy</span>
                               </button>`
                            : `<span class="dept-channel-value dept-muted">Sin correo</span>`}
                    </div>
                    <div class="dept-channel-action">
                        ${window.renderCorpActionBtn({
                            type: 'mail',
                            onclick: cleanMail ? `window.openAppEmail('${safeMailArg}')` : '',
                            label: 'Mail',
                            title: cleanMail ? `Enviar correo a ${cleanMail}` : 'Sin correo',
                            disabled: !cleanMail,
                            compact: true
                        })}
                    </div>
                </div>
            </div>

            <div class="dept-functions-card">
                <div class="dept-section-head">
                    <div class="dept-section-title">
                        <span class="material-icons-round">assignment</span>
                        <span>Funciones y gestiones</span>
                    </div>
                    ${fnItems.length > 0 ? `<span class="dept-section-count">${fnItems.length}</span>` : ''}
                </div>
                ${fnItems.length > 0 ? `
                    <ul class="dept-fn-list">
                        ${fnItems.map(item => `
                            <li class="dept-fn-item">
                                <span class="material-icons-round">check_circle</span>
                                <span>${escapeDeptHtml(item)}</span>
                            </li>
                        `).join('')}
                    </ul>
                ` : `
                    <p class="dept-functions-empty">${escapeDeptHtml(dept.functions || 'Sin descripción detallada de funciones.')}</p>
                `}
            </div>
        </div>

        <div class="dept-detail-footer-bar">
            <button type="button" class="dept-footer-btn dept-footer-edit" onclick="openDeptModal('${safeId}')">Editar</button>
            <button type="button" class="dept-footer-btn dept-footer-delete" onclick="handleDeleteDept('${safeId}')">Borrar</button>
            <button type="button" class="dept-footer-btn dept-footer-close" onclick="closeDeptDetailModal()">Cerrar</button>
        </div>
    `;

    document.getElementById('deptDetailModal').classList.add('open');
}

async function openDeptModal(id = null) {
    if (id) closeDeptDetailModal();
    const form = document.getElementById('newDeptForm');
    if (form) form.reset();
    document.getElementById('deptId').value = '';
    document.getElementById('deptCreatedAt').value = '';

    const titleEl = document.getElementById('deptFormModalTitle');
    if (titleEl) titleEl.textContent = id ? 'Editar Departamento' : 'Nuevo Departamento';

    if (id) {
        const depts = await dataManager.getDepartamentos();
        const data = depts.find(d => String(d.id) === String(id));
        if (data) {
            document.getElementById('deptId').value = data.id;
            document.getElementById('deptCreatedAt').value = data.createdAt || '';
            document.getElementById('deptName').value = data.name || '';
            document.getElementById('deptContactName').value = data.contactName || '';
            document.getElementById('deptFunctions').value = data.functions || '';
            document.getElementById('deptPhone').value = data.phone || '';
            document.getElementById('deptWhatsapp').value = data.whatsapp || '';
            document.getElementById('deptMail').value = data.mail || '';
        }
    }

    document.getElementById('newDeptModal').classList.add('open');
}

async function saveNewDepartment() {
    const id = document.getElementById('deptId').value;
    const existingCreatedAt = document.getElementById('deptCreatedAt').value;
    const data = {
        id: id || undefined,
        name: document.getElementById('deptName').value.trim(),
        contactName: document.getElementById('deptContactName').value.trim(),
        functions: document.getElementById('deptFunctions').value.trim(),
        phone: document.getElementById('deptPhone').value.trim(),
        whatsapp: document.getElementById('deptWhatsapp').value.trim(),
        mail: document.getElementById('deptMail').value.trim(),
        createdAt: existingCreatedAt || new Date().toISOString()
    };

    await dataManager.saveDepartamento(data);
    closeDeptModal();
    closeDeptDetailModal();
    renderDepartamentos();
}

async function handleDeleteDept(id) {
    if (!confirm('¿Deseas eliminar este departamento?')) return;
    await dataManager.deleteDepartamento(id);
    closeDeptDetailModal();
    renderDepartamentos();
}

function closeDeptModal() {
    const el = document.getElementById('newDeptModal');
    if (el) el.classList.remove('open');
}

function closeDeptDetailModal() {
    const el = document.getElementById('deptDetailModal');
    if (el) el.classList.remove('open');
}

// Globales
window.renderDepartamentos = renderDepartamentos;
window.filterDepartamentos = filterDepartamentos;
window.clearDeptSearch = clearDeptSearch;
window.copyDeptField = copyDeptField;
window.openDeptDetailModal = openDeptDetailModal;
window.closeDeptDetailModal = closeDeptDetailModal;
window.openDeptModal = openDeptModal;
window.closeDeptModal = closeDeptModal;
window.saveNewDepartment = saveNewDepartment;
window.handleDeleteDept = handleDeleteDept;

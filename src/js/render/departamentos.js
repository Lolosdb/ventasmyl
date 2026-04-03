/**
 * Lógica de Directorio de Departamentos
 */

async function renderDepartamentos() {
    const app = document.getElementById('app');
    const headerHtml = getCommonHeaderHtml('Departamentos', {
        showBack: true,
        extraAction: `
             <button class="btn-header-pill" onclick="openDeptModal()">
                <span class="material-icons-round">add</span>
                <span>Nuevo</span>
            </button>
        `
    });

    const depts = await dataManager.getDepartamentos();
    let contentHtml = '<main class="fade-in-up" style="padding: 1rem 1.5rem; padding-bottom: 120px;">';

    if (!depts || depts.length === 0) {
        contentHtml += `
            <div class="empty-state-premium">
                <div class="empty-icon-circle">
                    <span class="material-icons-round">contact_mail</span>
                </div>
                <h3 class="font-black text-slate-800 text-xl mb-2">Directorio Vacío</h3>
                <p class="text-slate-400 text-sm mb-8 px-6 text-center leading-relaxed">Configura los departamentos y personas de contacto de la empresa.</p>
                <button class="btn btn-premium-primary" onclick="openDeptModal()">
                    <span class="material-icons-round">add</span>
                    Empieza Ahora
                </button>
            </div>
        `;
    } else {
        contentHtml += '<div class="dept-container">';
        depts.forEach((dept, index) => {
            const delay = index * 0.1;
            contentHtml += `
                <div class="dept-card-premium stagger-in" 
                     style="animation-delay: ${delay}s" 
                     onclick="openDeptDetailModal('${dept.id}')">
                    <div class="flex items-center">
                        <div class="dept-icon-wrapper">
                            <span class="material-icons-round">person</span>
                        </div>
                        <div class="dept-info">
                            <h3 class="dept-name text-slate-800">${dept.name}</h3>
                            <div class="dept-contact-badge">${dept.contactName || 'Responsable'}</div>
                        </div>
                    </div>
                    <span class="material-icons-round dept-chevron">chevron_right</span>
                </div>
            `;
        });
        contentHtml += '</div>';
    }

    injectDeptModals();

    contentHtml += '</main>';
    contentHtml += renderBottomNav(null);
    app.innerHTML = headerHtml + contentHtml;
}

function injectDeptModals() {
    if (document.getElementById('newDeptModal')) return;
    
    const html = `
    <div id="newDeptModal" class="modal-overlay">
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="text-xl font-bold">Nuevo Departamento</h2>
                <button class="icon-btn" onclick="closeDeptModal()"><span class="material-icons-round">close</span></button>
            </div>
            <div class="modal-body p-4">
                <form id="newDeptForm" onsubmit="event.preventDefault(); saveNewDepartment();">
                    <input type="hidden" id="deptId">
                    <div class="mb-4">
                        <label class="form-label">Nombre del Departamento *</label>
                        <input type="text" id="deptName" class="form-input" required placeholder="Ej: Dirección, Compras...">
                    </div>
                    <div class="mb-4">
                        <label class="form-label">Nombre de Contacto</label>
                        <input type="text" id="deptContactName" class="form-input">
                    </div>
                    <div class="mb-4">
                        <label class="form-label">Funciones / Notas</label>
                        <textarea id="deptFunctions" class="form-input" rows="3"></textarea>
                    </div>
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div><label class="form-label">Teléfono</label><input type="tel" id="deptPhone" class="form-input"></div>
                        <div><label class="form-label">WhatsApp</label><input type="tel" id="deptWhatsapp" class="form-input"></div>
                    </div>
                    <div class="mb-6"><label class="form-label">Email</label><input type="email" id="deptMail" class="form-input"></div>
                    <button type="submit" class="btn btn-primary w-full py-4 rounded-xl shadow-lg">Guardar Departamento</button>
                </form>
            </div>
        </div>
    </div>

    <div id="deptDetailModal" class="modal-overlay">
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="detailTitle" class="text-xl font-bold">Detalle</h2>
                <button class="icon-btn" onclick="closeDeptDetailModal()"><span class="material-icons-round">close</span></button>
            </div>
            <div id="detailContent" class="modal-body p-6"></div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
}

async function openDeptDetailModal(id) {
    const depts = await dataManager.getDepartamentos();
    const dept = depts.find(d => d.id === String(id));
    if (!dept) return;

    const content = document.getElementById('detailContent');
    const title = document.getElementById('detailTitle');
    
    // Ocultamos el header nativo del modal para usar nuestro diseño envolvente
    const modalContent = content.closest('.modal-content');
    modalContent.style.padding = '0'; // Quitamos padding para que el gradiente llegue al borde
    
    content.innerHTML = `
        <div class="contact-card-premium">
            <div class="contact-card-header">
                <div class="contact-card-avatar">
                   <span class="material-icons-round">person</span>
                </div>
                <h2 class="text-2xl font-black mb-1">${dept.contactName || 'Desconocido'}</h2>
                <p class="text-white/70 font-bold uppercase text-[10px] tracking-widest">${dept.name}</p>
            </div>

            <div class="contact-actions-grid">
                <div class="btn-contact-action btn-phone" onclick="window.location.href='tel:${(dept.phone || '').replace(/\s+/g, '')}'">
                    <span class="material-icons-round">call</span>
                    <span class="contact-label">Llamar</span>
                    <span class="contact-data">${dept.phone || '---'}</span>
                </div>
                <div class="btn-contact-action btn-whatsapp" onclick="window.open('https://wa.me/34${(dept.whatsapp || '').replace(/[^0-9]/g, '')}', '_blank')">
                    <span class="material-icons-round">chat</span>
                    <span class="contact-label">WhatsApp</span>
                    <span class="contact-data">${dept.whatsapp || '---'}</span>
                </div>
            </div>

            <div class="contact-email-premium" onclick="window.location.href='mailto:${dept.mail}'">
                <div class="email-icon-wrapper">
                    <span class="material-icons-round">alternate_email</span>
                </div>
                <div class="email-content-wrapper">
                    <span class="contact-label">Dirección de correo</span>
                    <span class="contact-data-full">${dept.mail || '---'}</span>
                </div>
                <span class="material-icons-round email-arrow">chevron_right</span>
            </div>
            
            <div class="contact-details-body">
                <div class="detail-section">
                    <div class="detail-section-header">
                        <span class="material-icons-round">assignment</span>
                        <span class="detail-label">Responsabilidades y Funciones</span>
                    </div>
                    <div class="functions-block-premium">
                        ${(() => {
                            const raw = dept.functions || 'Sin descripción detallada de funciones.';
                            // Separamos por guiones, flechas o saltos de línea
                            const items = raw.split(/[-|>\n]+/).map(i => i.trim()).filter(i => i.length > 0);
                            
                            // Siempre renderizamos como lista para mantener la consistencia visual (iconos de check)
                            if (items.length > 0) {
                                return `<ul class="functions-list">
                                    ${items.map(item => `<li><span class="material-icons-round">task_alt</span>${item}</li>`).join('')}
                                </ul>`;
                            }
                            return `<p class="functions-text">${raw}</p>`;
                        })()}
                    </div>
                </div>

                <div class="flex justify-center gap-4 mt-8">
                    <button class="btn-dept-edit" 
                            onclick="openDeptModal('${dept.id}')">
                        <span class="material-icons-round">edit</span>
                        <span>Editar</span>
                    </button>
                    <button class="btn-action-delete" style="flex: 1; max-width: 140px; height: 52px; font-size: 14px;"
                            onclick="handleDeleteDept('${dept.id}')">
                        <span class="material-icons-round">delete</span>
                        <span>Eliminar</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    document.getElementById('deptDetailModal').classList.add('open');
    
    // Auto-ajuste de tipografía para el email (Premium Shrink-to-Fit)
    const emailEl = document.querySelector('.contact-data-full');
    if (window.autoShrinkText) window.autoShrinkText(emailEl);
}

async function openDeptModal(id = null) {
    if (id) closeDeptDetailModal(); // Cerramos el detalle para que no tape el formulario de edición
    const form = document.getElementById('newDeptForm');
    form.reset();
    document.getElementById('deptId').value = '';
    
    if (id) {
        const depts = await dataManager.getDepartamentos();
        const data = depts.find(d => d.id === String(id));
        if (data) {
            document.getElementById('deptId').value = data.id;
            document.getElementById('deptName').value = data.name;
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
    const data = {
        id: id || undefined,
        name: document.getElementById('deptName').value.trim(),
        contactName: document.getElementById('deptContactName').value.trim(),
        functions: document.getElementById('deptFunctions').value.trim(),
        phone: document.getElementById('deptPhone').value.trim(),
        whatsapp: document.getElementById('deptWhatsapp').value.trim(),
        mail: document.getElementById('deptMail').value.trim(),
        createdAt: new Date().toISOString()
    };

    await dataManager.saveDepartamento(data);
    closeDeptModal();
    closeDeptDetailModal();
    renderDepartamentos();
}

async function handleDeleteDept(id) {
    if (!confirm("¿Deseas eliminar este departamento?")) return;
    await dataManager.deleteDepartamento(id);
    closeDeptDetailModal();
    renderDepartamentos();
}

function closeDeptModal() { document.getElementById('newDeptModal').classList.remove('open'); }
function closeDeptDetailModal() { document.getElementById('deptDetailModal').classList.remove('open'); }

// Globales
window.renderDepartamentos = renderDepartamentos;
window.openDeptDetailModal = openDeptDetailModal;
window.closeDeptDetailModal = closeDeptDetailModal;
window.openDeptModal = openDeptModal;
window.closeDeptModal = closeDeptModal;
window.saveNewDepartment = saveNewDepartment;
window.handleDeleteDept = handleDeleteDept;

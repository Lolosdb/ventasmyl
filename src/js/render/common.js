/**
 * Componentes comunes y utilidades de UI
 */

// URL de Google Script (Prioriza localStorage si existe)
const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw0oAQ1Dq8gKHsy6vutnPh9xylbcFThY1irpehdeQTT9pY7LJAbvNIU0t6ZT0ovD2rMeg/exec';
const GOOGLE_SCRIPT_URL = localStorage.getItem('apps_script_url') || DEFAULT_SCRIPT_URL;
const APPS_SCRIPT_URL = GOOGLE_SCRIPT_URL; // Alias para compatibilidad

// --- HELPER PARA ENCABEZADO COMÚN ---
function getCommonHeaderHtml(title, options = {}) {
    const showBack = options.showBack || false;
    const backFn = options.backFn || 'renderDash()';
    const extraAction = options.extraAction || '';
    return `
        <header class="header">
            <div class="header-container flex justify-between items-center w-full" style="padding: 0 1.5rem;">
                <div class="flex items-center gap-3">
                    ${showBack ? `
                        <button class="icon-btn text-white" onclick="${backFn}">
                            <span class="material-icons-round">arrow_back</span>
                        </button>
                    ` : ''}
                    <h1 class="header-title">${title}</h1>
                </div>
                <div class="flex items-center gap-3">
                    ${extraAction}
                    <button class="icon-btn text-white" onclick="openNavMenu()">
                        <span class="material-icons-round" style="font-size: 32px;">menu</span>
                    </button>
                </div>
            </div>
        </header>
    `;
}

// Helper para navegación inferior
function renderBottomNav(activeTab) {
    return `
        <nav class="bottom-nav">
             <a href="javascript:void(0)" onclick="renderDash()" class="nav-item ${activeTab === 'dash' ? 'active' : ''}">
                <span class="material-icons-round">grid_view</span>
                <span>Dash</span>
             </a>
             <a href="javascript:void(0)" onclick="renderPedidos()" class="nav-item ${activeTab === 'pedidos' ? 'active' : ''}">
                <span class="material-icons-round">shopping_bag</span>
                <span>Pedidos</span>
             </a>
             <a href="javascript:void(0)" onclick="renderTotales()" class="nav-item ${activeTab === 'totales' ? 'active' : ''}">
                <span class="material-icons-round">euro</span>
                <span>Totales</span>
             </a>
             <a href="javascript:void(0)" onclick="renderClientes()" class="nav-item ${activeTab === 'clientes' ? 'active' : ''}">
                <span class="material-icons-round">people</span>
                <span>Clientes</span>
             </a>
             <a href="javascript:void(0)" onclick="renderAlertas()" class="nav-item ${activeTab === 'alertas' ? 'active' : ''}">
                <span class="material-icons-round">notifications</span>
                <span>Alertas</span>
             </a>
             <a href="javascript:void(0)" onclick="renderMapa()" class="nav-item ${activeTab === 'mapa' ? 'active' : ''}">
                <span class="material-icons-round">map</span>
                <span>Mapa</span>
             </a>
        </nav>
    `;
}

// --- NAV MENU LOGIC ---
function openNavMenu() {
    let menuOverlay = document.getElementById('navMenuOverlay');
    if (!menuOverlay) {
        menuOverlay = document.createElement('div');
        menuOverlay.id = 'navMenuOverlay';
        menuOverlay.className = 'nav-menu-overlay';
        menuOverlay.onclick = (e) => {
            if (e.target.id === 'navMenuOverlay') closeNavMenu();
        };
        document.body.appendChild(menuOverlay);
    }
    menuOverlay.innerHTML = renderNavMenuHTML();
    setTimeout(() => {
        menuOverlay.classList.add('open');
        document.body.classList.add('no-scroll');
    }, 10);
}

function closeNavMenu() {
    const menuOverlay = document.getElementById('navMenuOverlay');
    if (menuOverlay) {
        menuOverlay.classList.remove('open');
        document.body.classList.remove('no-scroll');
    }
}

function renderNavMenuHTML() {
    return `
        <div class="nav-menu-content">
            <div class="nav-menu-header">
                <div class="flex items-center gap-2">
                    <span class="material-icons-round">explore</span>
                    <h2 class="font-bold text-lg">Más Opciones</h2>
                </div>
                <button class="icon-btn text-white" onclick="closeNavMenu()">
                    <span class="material-icons-round">close</span>
                </button>
            </div>
            <div class="nav-menu-body">
                <div class="nav-menu-section">Análisis</div>
                <button class="nav-menu-item" onclick="closeNavMenu(); renderVentas();">
                    <span class="material-icons-round">trending_up</span>
                    <span>Ventas Mensuales</span>
                </button>
                <button class="nav-menu-item" onclick="closeNavMenu(); renderFactura();">
                    <span class="material-icons-round">receipt_long</span>
                    <span>Facturación Real</span>
                </button>
                <button class="nav-menu-item" onclick="closeNavMenu(); renderMedias();">
                    <span class="material-icons-round">history_toggle_off</span>
                    <span>Medias Mensuales</span>
                </button>
                <button class="nav-menu-item" onclick="closeNavMenu(); openRankingModal();">
                    <span class="material-icons-round">emoji_events</span>
                    <span>Ranking Clientes</span>
                </button>
                <div class="nav-menu-section">Planificación</div>
                <button class="nav-menu-item" onclick="closeNavMenu(); renderObjetivos();">
                    <span class="material-icons-round">ads_click</span>
                    <span>Objetivos Mensuales</span>
                </button>
                <button class="nav-menu-item" onclick="closeNavMenu(); renderObjetivosTrimestrales();">
                    <span class="material-icons-round">event_repeat</span>
                    <span>Objetivos Trimestrales</span>
                </button>
                <button class="nav-menu-item" onclick="closeNavMenu(); renderAjustes();">
                    <span class="material-icons-round">cloud_upload</span>
                    <span>Backups</span>
                </button>

                <button class="nav-menu-item" onclick="closeNavMenu(); openInfoModal();">
                    <span class="material-icons-round">menu_book</span>
                    <span>Manual de Usuario</span>
                </button>

            </div>
            <div class="nav-menu-footer">
                <p>App Ventas Lolo Serantes</p>
            </div>
        </div>
    `;
}



// Hacer funciones globales para legacy
window.getCommonHeaderHtml = getCommonHeaderHtml;
window.renderBottomNav = renderBottomNav;
window.openNavMenu = openNavMenu;
window.closeNavMenu = closeNavMenu;


/**
 * Gestiona la visibilidad del botón de borrado (X) en un input.
 */
function toggleClearSearch(inputId, btnId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    if (input && btn) {
        btn.style.display = input.value ? 'block' : 'none';
    }
}

/**
 * Limpia un campo de búsqueda y ejecuta una acción de refresco.
 */
function clearSearchField(inputId, btnId, callback = null) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    if (input) {
        input.value = '';
        if (btn) btn.style.display = 'none';
        if (callback) callback();
        else if (typeof window.filterPedidos === 'function' && inputId === 'searchPedidosInput') window.filterPedidos();
        else if (typeof window.filterClients === 'function' && inputId === 'clientSearchInput') window.filterClients('');
        input.focus();
    }
}

window.toggleClearSearch = toggleClearSearch;
window.clearSearchField = clearSearchField;

/**
 * Formatea un importe numérico con separador de miles y símbolo de euro.
 * @param {number} amount - El importe a formatear.
 * @param {number} decimals - Número de decimales (por defecto 0).
 * @returns {string} El importe formateado.
 */
function formatCurrency(amount, decimals = 0) {
    if (amount === undefined || amount === null || isNaN(amount)) return '0 €';
    let val = parseFloat(amount).toFixed(decimals);
    let parts = val.split('.');
    let num = parts[0];
    let thousand = "";
    while (num.length > 3) {
        thousand = "." + num.slice(-3) + thousand;
        num = num.slice(0, -3);
    }
    let res = num + thousand;
    if (parts.length > 1) res += "," + parts[1];
    return res + ' €';
}

window.formatCurrency = formatCurrency;

// Inicializar al cargar

// --- MANUAL DE USUARIO ---
function openInfoModal() {
    let modal = document.getElementById('infoModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'infoModal';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }

    // Bloquear scroll de fondo
    document.body.style.overflow = 'hidden';

    const manualContent = `
        <div class="modal-content" style="border-radius: 28px; overflow: hidden; padding: 0; box-shadow: 0 25px 60px rgba(0,0,0,0.3); max-width: 600px; width: 95%; background-color: #fff; margin: auto;">
            <!-- Header -->
            <div style="background-color: #009ee3; padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                <h2 style="font-size: 1.25rem; font-weight: 800; color: #ffffff; margin: 0; font-family: 'Inter', sans-serif;">Manual de Usuario</h2>
                <button style="background: transparent; border: none; color: #ffffff; cursor: pointer; padding: 4px; display: flex;" onclick="closeInfoModal()">
                    <span class="material-icons-round" style="font-size: 24px;">close</span>
                </button>
            </div>
            
            <!-- Cuerpo del Manual con Scroll -->
            <div style="padding: 2rem; max-height: 80vh; overflow-y: auto; background-color: #fff; line-height: 1.6; color: #334155; font-size: 0.9rem;">
                
                <p style="text-align: center; font-weight: 900; color: #009ee3; text-transform: uppercase; margin-bottom: 2rem; letter-spacing: 0.05em; line-height: 1.4;">
                    Aplicación creada por<br>
                    <span style="font-size: 1.1em;">Manuel F. Serantes Pérez</span>
                </p>

                <div style="margin-bottom: 2.5rem;">
                    <h3 style="color: #0f172a; font-weight: 900; font-size: 1.1rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;">
                        <span class="material-icons-round" style="color: #009ee3;">dashboard</span>
                        1. Dashboard (Inicio)
                    </h3>
                    <p>El panel principal ofrece una visión rápida del estado comercial:</p>
                    <ul style="padding-left: 1.2rem; margin-top: 0.5rem;">
                        <li><strong>Venta Diaria:</strong> Sumatorio de los pedidos realizados hoy.</li>
                        <li><strong>Gráficos de Tendencia:</strong> Comparativa visual de ventas por departamento o mes.</li>
                        <li><strong>Acceso Rápido:</strong> Botones para ir directamente a añadir pedidos o clientes.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 2.5rem;">
                    <h3 style="color: #0f172a; font-weight: 900; font-size: 1.1rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;">
                        <span class="material-icons-round" style="color: #009ee3;">shopping_cart</span>
                        2. Gestión de Pedidos
                    </h3>
                    <p>En esta sección puedes ver y gestionar todas las ventas:</p>
                    <ul style="padding-left: 1.2rem; margin-top: 0.5rem;">
                        <li><strong>Estados de Facturación:</strong> 
                            <span style="color: #2563eb; font-weight: 800;">ALMACÉN</span> (Pendiente), 
                            <span style="color: #10b981; font-weight: 800;">TODO</span> (Facturado completo) o 
                            <span style="color: #0d9488; font-weight: 800;">S/ TAMPO</span> (Facturado parcialmente).
                        </li>
                        <li><strong>Añadir Pedido:</strong> Pulsa el botón "+" para crear un registro nuevo seleccionando cliente, importe y fecha.</li>
                        <li><strong>Edición:</strong> Haz clic en cualquier pedido para modificar sus datos o cambiar su estado de facturación.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 2.5rem;">
                    <h3 style="color: #0f172a; font-weight: 900; font-size: 1.1rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;">
                        <span class="material-icons-round" style="color: #009ee3;">analytics</span>
                        3. Ventas y Totales
                    </h3>
                    <p>Herramienta de análisis para revisar la facturación acumulada:</p>
                    <ul style="padding-left: 1.2rem; margin-top: 0.5rem;">
                        <li><strong>Filtros Temporales:</strong> Selecciona el año y el mes para ver el desglose detallado de ventas.</li>
                        <li><strong>Resumen por Departamento:</strong> Visualiza cuánto se ha vendido en cada categoría comercial.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 2.5rem;">
                    <h3 style="color: #0f172a; font-weight: 900; font-size: 1.1rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;">
                        <span class="material-icons-round" style="color: #009ee3;">groups</span>
                        4. Fichero de Clientes
                    </h3>
                    <p>Administra tu base de datos de comercios y contactos:</p>
                    <ul style="padding-left: 1.2rem; margin-top: 0.5rem;">
                        <li><strong>Buscador Inteligente:</strong> Encuentra clientes por nombre, código o población.</li>
                        <li><strong>Ficha Detallada:</strong> Consulta el historial de pedidos de cada cliente y su información de contacto.</li>
                        <li><strong>Mapas:</strong> Visualiza geográficamente la ubicación de tus clientes en el mapa interactivo.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 2.5rem;">
                    <h3 style="color: #0f172a; font-weight: 900; font-size: 1.1rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;">
                        <span class="material-icons-round" style="color: #009ee3;">cloud_sync</span>
                        5. Seguridad y Ajustes
                    </h3>
                    <p>Crucial para no perder información:</p>
                    <ul style="padding-left: 1.2rem; margin-top: 0.5rem;">
                        <li><strong>Copia en la Nube (Drive):</strong> Sincroniza tus datos con Google Drive. El sistema realiza copias automáticas programadas de L-V a las 20:30h.</li>
                        <li><strong>Historial de Copias:</strong> Puedes ver y restaurar cualquier copia anterior desde la nube.</li>
                        <li><strong>Archivo Local:</strong> Exporta toda tu base de datos a Excel para guardarla en tu ordenador.</li>
                        <li><strong>Gestión de Años:</strong> Al iniciar un nuevo año fiscal, usa esta opción para habilitar la facturación de ese año.</li>
                    </ul>
                </div>

                <div style="background-color: #f8fafc; padding: 1.5rem; border-radius: 16px; border: 1px solid #e2e8f0; margin-top: 1rem;">
                    <strong style="color: #0f172a; display: block; margin-bottom: 0.5rem;">Nota Importante:</strong>
                    Recuerda revisar el estado de conexión en la sección de Ajustes para asegurar que los datos se están sincronizando correctamente con la nube.
                </div>

                <p style="text-align: center; font-weight: 900; color: #94a3b8; text-transform: uppercase; margin-top: 3rem; letter-spacing: 0.05em; font-size: 0.8rem; line-height: 1.4;">
                    Aplicación creada por<br>
                    <span style="font-size: 1.1em;">Manuel F. Serantes Pérez</span>
                </p>
            </div>
        </div>
    `;

    modal.innerHTML = manualContent;
    modal.classList.add('open');
}

function closeInfoModal() {
    const modal = document.getElementById('infoModal');
    if (modal) {
        modal.classList.remove('open');
        document.body.style.overflow = '';
    }
}



// Exportar para uso global



/**
 * Componentes comunes y utilidades de UI
 */

// URL de Google Script (Prioriza localStorage si existe y es válida)
const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwqG-wULnEM5VfKuO9xujKVC-3pPcFaTWJLfMymEYhKGiqmCJ1R6MD9Kok8Xvf2SQ0B6w/exec';
const _savedScriptUrl = localStorage.getItem('apps_script_url');
if (!_savedScriptUrl || _savedScriptUrl.includes('/edit') || !_savedScriptUrl.startsWith('http')) {
    localStorage.setItem('apps_script_url', DEFAULT_SCRIPT_URL);
}
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
                <button class="nav-menu-item" onclick="closeNavMenu(); renderComisiones();">
                    <span class="material-icons-round">euro_symbol</span>
                    <span>Comisiones</span>
                </button>
                <button class="nav-menu-item" onclick="closeNavMenu(); renderIdeas();">
                    <span class="material-icons-round">lightbulb</span>
                    <span>Ideas de Visita</span>
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
    let num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/\./g, '').replace(',', '.'));
    if (isNaN(num)) return '0 €';
    
    // Formateo manual para asegurar puntos de miles (Estilo España)
    let fixedNum = num.toFixed(decimals);
    let [integerPart, decimalPart] = fixedNum.split('.');
    
    // Añadir puntos de miles
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    
    let result = integerPart;
    if (decimals > 0 && decimalPart) {
        result += ',' + decimalPart;
    }
    
    return result + ' €';
}

/**
 * Helper para formatear un input al vuelo (onblur)
 */
function formatNumericInput(el) {
    const val = el.value;
    if (!val) return;
    const cleanVal = val.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleanVal) || 0;
    el.value = formatCurrency(num).replace(' €', '');
}

window.formatCurrency = formatCurrency;
window.formatNumericInput = formatNumericInput;

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
        <div class="modal-content" style="border-radius: 28px; overflow: hidden; padding: 0; box-shadow: 0 25px 60px rgba(0,0,0,0.3); max-width: 650px; width: 95%; background-color: #fff; margin: auto;">
            <!-- Header -->
            <div style="background-color: #009ee3; padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                <h2 style="font-size: 1.25rem; font-weight: 800; color: #ffffff; margin: 0; font-family: 'Inter', sans-serif;">Manual de Usuario Completo</h2>
                <button style="background: transparent; border: none; color: #ffffff; cursor: pointer; padding: 4px; display: flex;" onclick="closeInfoModal()">
                    <span class="material-icons-round" style="font-size: 24px;">close</span>
                </button>
            </div>
            
            <!-- Cuerpo del Manual con Scroll -->
            <div style="padding: 2rem; max-height: 80vh; overflow-y: auto; background-color: #fff; line-height: 1.6; color: #334155; font-size: 0.95rem;">
                
                <p style="text-align: center; font-weight: 900; color: #009ee3; text-transform: uppercase; margin-bottom: 2rem; letter-spacing: 0.05em; line-height: 1.4;">
                    Aplicación creada por<br>
                    <span style="font-size: 1.1em;">Manuel F. Serantes Pérez</span>
                </p>

                <div style="margin-bottom: 2.5rem;">
                    <h3 style="color: #0f172a; font-weight: 900; font-size: 1.2rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;">
                        <span class="material-icons-round" style="color: #009ee3;">dashboard</span>
                        1. Dashboard (Panel Principal)
                    </h3>
                    <p>Es la pantalla de inicio y el centro de control de tu actividad diaria. Aquí encontrarás un resumen visual y rápido de cómo marchan las ventas:</p>
                    <ul style="padding-left: 1.2rem; margin-top: 0.5rem;">
                        <li><strong>Indicadores Clave (KPIs):</strong> Muestra la <em>Venta Diaria</em> (la suma de todos los pedidos registrados en el día de hoy) y el total acumulado en el mes actual.</li>
                        <li><strong>Accesos Rápidos:</strong> En la parte superior derecha encontrarás botones rápidos para registrar nuevos pedidos o añadir clientes sin tener que navegar por los menús.</li>
                        <li><strong>Gráficos de Tendencia:</strong> Diferentes gráficos de barras y líneas que te permitirán comparar de un vistazo el rendimiento por meses o visualizar cómo se distribuyen tus ventas entre los diferentes departamentos.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 2.5rem;">
                    <h3 style="color: #0f172a; font-weight: 900; font-size: 1.2rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;">
                        <span class="material-icons-round" style="color: #009ee3;">shopping_cart</span>
                        2. Gestión de Pedidos
                    </h3>
                    <p>Esta es la sección donde registras y administras todas las ventas que realizas. Está pensada para ser rápida y eficiente:</p>
                    <ul style="padding-left: 1.2rem; margin-top: 0.5rem;">
                        <li><strong>Crear Nuevo Pedido:</strong> Usando el botón flotante inferior o el botón superior "+", puedes añadir una venta. Selecciona la fecha, elige el cliente de la lista y teclea el importe total.</li>
                        <li><strong>Buscador:</strong> Un cajón de búsqueda potente en la parte superior te permite filtrar tus pedidos por nombre de cliente para que encuentres rápidamente lo que buscas.</li>
                        <li><strong>Estados de Facturación:</strong> Los pedidos cuentan con un sistema de control visual por colores:
                            <ul style="padding-left: 1.2rem; margin-top: 0.3rem;">
                                <li><span style="color: #2563eb; font-weight: 800;">ALMACÉN</span>: El pedido acaba de ser registrado y está pendiente de procesar o facturar.</li>
                                <li><span style="color: #10b981; font-weight: 800;">TODO</span>: El pedido ha sido facturado por completo (100%).</li>
                                <li><span style="color: #0d9488; font-weight: 800;">S/ TAMPO</span>: Ha sido facturado, pero con alguna exclusión (por ejemplo, sin incluir tampografía).</li>
                            </ul>
                        </li>
                        <li><strong>Edición Rápida:</strong> Pulsando sobre cualquier tarjeta de pedido abrirás su ficha, donde puedes corregir la cantidad, cambiar el cliente o actualizar su estado de facturación con un simple click.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 2.5rem;">
                    <h3 style="color: #0f172a; font-weight: 900; font-size: 1.2rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;">
                        <span class="material-icons-round" style="color: #009ee3;">euro</span>
                        3. Totales y Analítica
                    </h3>
                    <p>El lugar perfecto para la analítica profunda. Aquí puedes ver cómo se desglosan los ingresos:</p>
                    <ul style="padding-left: 1.2rem; margin-top: 0.5rem;">
                        <li><strong>Filtros Temporales:</strong> Arriba dispones de selectores para cambiar el año y el mes. Al seleccionarlos, todos los números y rankings de la pantalla se recalcularán de inmediato.</li>
                        <li><strong>Desglose por Provincia:</strong> Verás exactamente cuánto dinero y cuántos pedidos ha aportado cada zona geográfica (Asturias, Cantabria, León, Galicia) al total facturado.</li>
                        <li><strong>Ranking de Tiendas:</strong> Descubre fácilmente qué clientes te están comprando más volumen o haciendo mayor número de pedidos en cada periodo.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 2.5rem;">
                    <h3 style="color: #0f172a; font-weight: 900; font-size: 1.2rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;">
                        <span class="material-icons-round" style="color: #009ee3;">contact_mail</span>
                        4. Directorio de Departamentos
                    </h3>
                    <p>Accesible desde el menú superior del Dashboard, es una agenda interna de la empresa:</p>
                    <ul style="padding-left: 1.2rem; margin-top: 0.5rem;">
                        <li><strong>Contactos Internos:</strong> Puedes dar de alta diferentes departamentos (Dirección, Compras, Administración...) junto con el nombre de la persona responsable.</li>
                        <li><strong>Comunicación Rápida:</strong> Te permite guardar números de teléfono, correos y WhatsApp corporativos para tener el contacto de tu equipo centralizado.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 2.5rem;">
                    <h3 style="color: #0f172a; font-weight: 900; font-size: 1.2rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;">
                        <span class="material-icons-round" style="color: #009ee3;">track_changes</span>
                        5. Seguimiento de Objetivos
                    </h3>
                    <p>Una sección vital para medir el crecimiento, con dos vistas diferentes accesibles desde el menú superior de la app:</p>
                    <ul style="padding-left: 1.2rem; margin-top: 0.5rem;">
                        <li><strong>Objetivos Mensuales:</strong> Podrás ver una tabla que calcula automáticamente, sobre tu facturación mensual real, a cuánto ascienden diferentes porcentajes (3%, 4% y 5%). También puedes editar estos valores de forma manual si tienes otras metas pactadas.</li>
                        <li><strong>Objetivos Trimestrales:</strong> Un sistema de tarjetas que te permite fijar una meta económica ("Objetivo") a cada uno de los 4 trimestres del año. La aplicación calculará sola el total "Facturado" durante los meses de ese trimestre y te mostrará una etiqueta de <span style="color: #10b981; font-weight: 800; background: #ecfdf5; padding: 2px 6px; border-radius: 4px;">CONSEGUIDO</span> o <span style="color: #ef4444; font-weight: 800; background: #fef2f2; padding: 2px 6px; border-radius: 4px;">NO CONSEGUIDO</span> en tiempo real. <em>¡Acuérdate de pulsar en "Guardar Cambios" cuando modifiques las metas!</em></li>
                    </ul>
                </div>

                <div style="margin-bottom: 2.5rem;">
                    <h3 style="color: #0f172a; font-weight: 900; font-size: 1.2rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;">
                        <span class="material-icons-round" style="color: #009ee3;">receipt_long</span>
                        6. Facturación Real
                    </h3>
                    <p>Tabla multi-año con la facturación mensual real, editable para cada mes y año. Incluye un sistema de colores automático según los objetivos:</p>
                    <ul style="padding-left: 1.2rem; margin-top: 0.5rem;">
                        <li><strong>Código de Colores:</strong> Cada cifra se colorea automáticamente según el objetivo alcanzado en ese mes:
                            <ul style="padding-left: 1.2rem; margin-top: 0.3rem;">
                                <li><span style="display: inline-block; background: #ef4444; color: white; font-weight: 800; padding: 2px 8px; border-radius: 6px; font-size: 0.85em;">Rojo</span> → No se ha alcanzado el objetivo del 3%</li>
                                <li><span style="display: inline-block; background: #9333ea; color: white; font-weight: 800; padding: 2px 8px; border-radius: 6px; font-size: 0.85em;">Morado</span> → Alcanzado el 3% pero no el 4%</li>
                                <li><span style="display: inline-block; background: #3b82f6; color: white; font-weight: 800; padding: 2px 8px; border-radius: 6px; font-size: 0.85em;">Azul</span> → Alcanzado el 4% pero no el 5%</li>
                                <li><span style="display: inline-block; background: #22c55e; color: white; font-weight: 800; padding: 2px 8px; border-radius: 6px; font-size: 0.85em;">Verde</span> → Superado el objetivo del 5%</li>
                            </ul>
                        </li>
                        <li><strong>Persistencia de Colores:</strong> Cuando finaliza un año, los colores quedan congelados tal y como estaban. Aunque modifiques los objetivos para el nuevo año, los años anteriores conservarán sus colores originales.</li>
                        <li><strong>Editable:</strong> Puedes modificar cualquier cifra pulsando directamente sobre el valor. Los cambios se guardan automáticamente.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 2.5rem;">
                    <h3 style="color: #0f172a; font-weight: 900; font-size: 1.2rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;">
                        <span class="material-icons-round" style="color: #009ee3;">euro_symbol</span>
                        7. Comisiones
                    </h3>
                    <p>Vista de solo lectura que calcula automáticamente la comisión generada cada mes, basándose en la facturación real y el porcentaje de objetivo logrado:</p>
                    <ul style="padding-left: 1.2rem; margin-top: 0.5rem;">
                        <li><strong>Cálculo Automático:</strong> La comisión de cada mes se calcula multiplicando la facturación real por el porcentaje correspondiente al objetivo alcanzado:
                            <ul style="padding-left: 1.2rem; margin-top: 0.3rem;">
                                <li><span style="display: inline-block; background: #ef4444; color: white; font-weight: 800; padding: 2px 8px; border-radius: 6px; font-size: 0.85em;">2%</span> → Si no se llega al objetivo del 3%</li>
                                <li><span style="display: inline-block; background: #9333ea; color: white; font-weight: 800; padding: 2px 8px; border-radius: 6px; font-size: 0.85em;">3%</span> → Si se alcanza el 3% pero no el 4%</li>
                                <li><span style="display: inline-block; background: #3b82f6; color: white; font-weight: 800; padding: 2px 8px; border-radius: 6px; font-size: 0.85em;">4%</span> → Si se alcanza el 4% pero no el 5%</li>
                                <li><span style="display: inline-block; background: #22c55e; color: white; font-weight: 800; padding: 2px 8px; border-radius: 6px; font-size: 0.85em;">5%</span> → Si se supera el objetivo del 5%</li>
                            </ul>
                        </li>
                        <li><strong>Código de Colores:</strong> Mismo sistema visual que en Facturación Real (rojo, morado, azul, verde), aplicado también a la fila TOTAL según los totales anuales de los objetivos.</li>
                        <li><strong>Persistencia:</strong> Al igual que en Facturación Real, los colores de años anteriores quedan congelados permanentemente.</li>
                        <li><strong>Años Dinámicos:</strong> Al iniciar un nuevo año, la columna aparece automáticamente a la derecha. Puedes hacer scroll horizontal para consultar años anteriores.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 2.5rem;">
                    <h3 style="color: #0f172a; font-weight: 900; font-size: 1.2rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;">
                        <span class="material-icons-round" style="color: #009ee3;">lightbulb</span>
                        8. Ideas de Visita (Inteligencia Comercial)
                    </h3>
                    <p>Sistema inteligente que analiza continuamente el historial de pedidos de tus clientes para sugerirte planes de trabajo y rutas comerciales optimizadas de 1 día:</p>
                    <ul style="padding-left: 1.2rem; margin-top: 0.5rem;">
                        <li><strong>Aprendizaje Continuo:</strong> Con cada pedido que registras en la app, el sistema recalcula en tiempo real la frecuencia media de compra de cada cliente, sus meses históricos fuertes y su volumen medio. <em>Cuanto más usas la app, más precisa es la predicción.</em></li>
                        <li><strong>Cálculo de Prioridad (0 a 100):</strong> El número dentro del círculo de color indica el nivel de urgencia de la visita:
                            <br>- <strong style="color: #ef4444;">🔴 Alta (>60 pts):</strong> Cliente muy atrasado respecto a su ciclo habitual de compra.
                            <br>- <strong style="color: #f59e0b;">🟠 Media (40 - 59 pts):</strong> Cliente que se aproxima a su fecha estimada o en su mes fuerte histórico.
                        </li>
                        <li><strong>Filtro Inteligente:</strong> La vista muestra exclusivamente clientes con prioridad <strong>Media y Alta (≥ 40 pts)</strong>. Si un cliente ha comprado recientemente (menos de 14 días o menos del 45% de su ciclo habitual), el sistema lo penaliza y lo excluye automáticamente para no forzar visitas innecesarias.</li>
                        <li><strong>Rutas Comerciales Delimitadas (1 Día):</strong> El motor agrupa a los clientes según las rutas comerciales reales de trabajo delimitadas para <strong>Asturias</strong> (8 zonas), <strong>Cantabria</strong> (7 zonas), <strong>León</strong> (2 zonas) y <strong>Galicia</strong> (Mariña Lucense - Lugo), asegurando que todos los clientes recomendados para un mismo día correspondan a una única zona geográfica realizable.</li>
                        <li><strong>Agrupación Contigua por Municipio:</strong> Dentro de cada día, los clientes aparecen organizados e identificados por su población (ej: todos los de Luanco juntos, luego Candás, luego Avilés), con cabeceras visuales claras por municipio.</li>
                        <li><strong>Acciones Rápidas en Tarjeta:</strong> Cada cliente de la lista cuenta con botones directos para <strong>Llamar por teléfono 📞</strong>, <strong>abrir WhatsApp 💬</strong> o <strong>iniciar navegación GPS 📍</strong>.</li>
                        <li><strong>Enviar Ruta del Día por WhatsApp:</strong> En la cabecera de cada día dispones de un botón <em>"Enviar Ruta"</em> que formatea y prepara el resumen completo del plan del día para enviártelo o compartirlo por WhatsApp con un solo toque.</li>
                        <li><strong>Filtro por Comunidad:</strong> Puedes usar la botonera superior (<em>Todas, Asturias, Cantabria, León, Galicia</em>) para enfocar tu planificación a una región en particular.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 2.5rem;">
                    <h3 style="color: #0f172a; font-weight: 900; font-size: 1.2rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;">
                        <span class="material-icons-round" style="color: #009ee3;">groups</span>
                        9. Fichero de Clientes
                    </h3>
                    <p>Tu agenda comercial avanzada, diseñada para tener todos los contactos y su información a un solo toque:</p>
                    <ul style="padding-left: 1.2rem; margin-top: 0.5rem;">
                        <li><strong>Importación Premium:</strong> Puedes cargar masivamente tus clientes subiendo un archivo Excel (.XLSX) o restaurándolos directamente desde tu base de datos central en la nube.</li>
                        <li><strong>Buscador Instantáneo:</strong> Encuentra a cualquier cliente tecleando parte de su nombre, o buscando por su código postal o ciudad.</li>
                        <li><strong>Ficha de Cliente:</strong> Al pulsar en un cliente, verás su Código, Persona de Contacto, Correo y Teléfonos.
                            <br>- Tienes botones de acceso directo para <strong>llamar por teléfono</strong> al instante o <strong>abrir un chat de WhatsApp</strong> directamente sin tener que guardarlo en tu agenda.
                        </li>
                        <li><strong>Historial Integrado:</strong> Al final de la ficha de cada cliente, verás una cronología con absolutamente todos los pedidos que te ha hecho a lo largo de la historia y sus importes.</li>
                        <li><strong>Geolocalización GPS:</strong> Al crear o editar un cliente, hay un botón especial que capta tu ubicación actual (latitud y longitud). Guardarlo te permitirá usar después la integración con mapas.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 2.5rem;">
                    <h3 style="color: #0f172a; font-weight: 900; font-size: 1.2rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;">
                        <span class="material-icons-round" style="color: #009ee3;">map</span>
                        10. Mapa Interactivo
                    </h3>
                    <p>Una vista especial (accesible desde el icono "Mapa" del menú inferior) que pinta tu cartera de clientes sobre el mapa geográfico de Google.</p>
                    <ul style="padding-left: 1.2rem; margin-top: 0.5rem;">
                        <li><strong>Chinchetas:</strong> Cada cliente de tu base de datos que tenga coordenadas guardadas aparecerá marcado en el mapa para que visualices tu cobertura comercial.</li>
                        <li><strong>Trazar Ruta Directa:</strong> Al pinchar en cualquier cliente del mapa, o usando el botón "Llévame" dentro de la ficha de cliente, se abrirá automáticamente la app de navegación de tu móvil (Google Maps o similar) calculando la ruta en coche para llegar hasta su puerta.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 2.5rem;">
                    <h3 style="color: #0f172a; font-weight: 900; font-size: 1.2rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;">
                        <span class="material-icons-round" style="color: #009ee3;">settings</span>
                        11. Ajustes, Seguridad y Backups
                    </h3>
                    <p>Accesible pulsando en el icono superior derecho de tres rayitas o perfil. Es el panel técnico y de mantenimiento:</p>
                    <ul style="padding-left: 1.2rem; margin-top: 0.5rem;">
                        <li><strong>Guardado en la Nube (Drive):</strong> Para que nunca pierdas datos. La app tiene rutinas automáticas de seguridad que suben toda tu información a Drive de Lunes a Viernes a las 20:30h, salvaguardando tu trabajo diario.</li>
                        <li><strong>Restauración de Copias:</strong> Si borras un pedido o cliente sin querer, tienes un botón de "Historial Drive" que te permite restaurar la base de datos completa a un momento del pasado.</li>
                        <li><strong>Archivos Locales (Excel):</strong> Además de la nube, tienes la opción manual de exportar todos tus datos (ventas y clientes) en archivos Excel estándar en tu dispositivo en cualquier momento.</li>
                        <li><strong>Gestión de Años:</strong> Al comenzar un nuevo año comercial, utiliza este apartado para activarlo de forma que puedas seguir trabajando y conservando la estadística del año anterior intacta.</li>
                        <li><strong>Limpiar Caché:</strong> Un mantenimiento útil si la app sufre un comportamiento extraño o va lenta. Borrará la memoria temporal de tu teléfono y descargará la base de datos fresca desde la nube.</li>
                    </ul>
                </div>

                <div style="background-color: #f0fdf4; padding: 1.5rem; border-radius: 16px; border: 1px left solid #10b981; border-left-width: 4px; margin-top: 1rem;">
                    <strong style="color: #065f46; display: block; margin-bottom: 0.5rem;">Consejo Experto de Uso:</strong>
                    Si usas la aplicación desde tu smartphone (Android o iOS), instálala o "Añádela a la pantalla de inicio" desde tu navegador web. Se instalará como una App Nativa (PWA), eliminando las barras del navegador, funcionando a pantalla completa y mejorando drásticamente su velocidad y fluidez.
                </div>

                <p style="text-align: center; font-weight: 900; color: #94a3b8; text-transform: uppercase; margin-top: 3.5rem; letter-spacing: 0.05em; font-size: 0.8rem; line-height: 1.4;">
                    Aplicación diseñada y desarrollada por<br>
                    <span style="font-size: 1.1em; color: #009ee3;">Manuel F. Serantes Pérez</span><br>
                    <span style="font-size: 0.8em; opacity: 0.7;">Versión Final (V7)</span>
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

// --- 🎙️ DICTADO POR VOZ A TEXTO (ES-ES) ---
window._activeSpeechRecognition = null;
window._activeSpeechBtn = null;

window.toggleVoiceDictation = function(targetId, btnEl, onCompleteCallback = null) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
        alert("Tu navegador no soporta dictado directo por voz. Puedes usar el micrófono del teclado de tu móvil.");
        return;
    }

    const targetEl = document.getElementById(targetId);
    if (!targetEl) return;

    // Si ya estaba escuchando en este mismo botón, detener
    if (window._activeSpeechRecognition) {
        const wasSameBtn = window._activeSpeechBtn === btnEl;
        try { window._activeSpeechRecognition.stop(); } catch (e) {}
        window._activeSpeechRecognition = null;
        window._activeSpeechBtn = null;
        if (wasSameBtn) return;
    }

    const recognition = new SpeechRec();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    const originalHtml = btnEl ? btnEl.innerHTML : '';
    const originalBg = btnEl ? btnEl.style.background : '';
    const originalColor = btnEl ? btnEl.style.color : '';
    const originalBorder = btnEl ? btnEl.style.borderColor : '';

    const restoreBtn = () => {
        if (btnEl) {
            btnEl.innerHTML = originalHtml;
            btnEl.style.background = originalBg;
            btnEl.style.color = originalColor;
            btnEl.style.borderColor = originalBorder;
            btnEl.classList.remove('voice-recording-pulse');
        }
        window._activeSpeechRecognition = null;
        window._activeSpeechBtn = null;
    };

    if (btnEl) {
        btnEl.innerHTML = '<span class="material-icons-round" style="font-size: 16px;">graphic_eq</span><span>Escuchando...</span>';
        btnEl.style.background = '#fee2e2';
        btnEl.style.color = '#dc2626';
        btnEl.style.borderColor = '#fca5a5';
        btnEl.classList.add('voice-recording-pulse');
    }

    window._activeSpeechRecognition = recognition;
    window._activeSpeechBtn = btnEl;

    recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript.trim()) {
            const cleanText = transcript.trim();
            const capitalized = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
            const currentVal = (targetEl.value || '').trim();
            targetEl.value = currentVal
                ? (currentVal.endsWith('.') || currentVal.endsWith(',') ? `${currentVal} ${capitalized}` : `${currentVal}. ${capitalized}`)
                : capitalized;
            targetEl.dispatchEvent(new Event('input', { bubbles: true }));
            if (typeof onCompleteCallback === 'function') {
                onCompleteCallback(targetEl.value);
            }
        }
    };

    recognition.onerror = (event) => {
        console.warn("Aviso dictado por voz:", event.error);
        restoreBtn();
        if (event.error === 'not-allowed') {
            alert("Permiso de micrófono denegado. Activa el permiso de micrófono en el navegador para usar el dictado por voz.");
        }
    };

    recognition.onend = () => {
        restoreBtn();
    };

    try {
        recognition.start();
    } catch (e) {
        restoreBtn();
    }
};

// --- 🧭 RADAR "¿QUIÉN TENGO CERCA AHORA MISMO?" ---
function _calcRadarDistanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

window.openNearbyRadarModal = async function() {
    let modal = document.getElementById('nearbyRadarModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'nearbyRadarModal';
        modal.className = 'modal-overlay';
        modal.style.zIndex = '1200';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 520px; width: 96%; max-height: 90vh; border-radius: 26px; overflow: hidden; padding: 0; background: #f8fafc; margin: auto;">
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center; color: white;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 38px; height: 38px; border-radius: 12px; background: rgba(56, 189, 248, 0.2); display: flex; align-items: center; justify-content: center; color: #38bdf8;">
                        <span class="material-icons-round" style="font-size: 22px;">radar</span>
                    </div>
                    <div>
                        <h2 style="font-size: 1.05rem; font-weight: 900; margin: 0; letter-spacing: -0.3px;">¿Quién tengo cerca ahora?</h2>
                        <p id="radarSubtitleStatus" style="font-size: 11px; color: #94a3b8; margin: 2px 0 0; font-weight: 600;">Obteniendo tu posición GPS...</p>
                    </div>
                </div>
                <button onclick="closeNearbyRadarModal()" style="background: rgba(255,255,255,0.12); border: none; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                    <span class="material-icons-round" style="font-size: 20px;">close</span>
                </button>
            </div>
            <div id="nearbyRadarBody" style="padding: 1rem 1.15rem; overflow-y: auto; max-height: calc(90vh - 80px);">
                <div style="text-align: center; padding: 3rem 1rem; color: #64748b;">
                    <span class="material-icons-round animate-spin" style="font-size: 36px; color: #0ea5e9; margin-bottom: 10px;">my_location</span>
                    <p style="font-weight: 800; font-size: 14px; margin: 0;">Localizando tu vehículo por GPS...</p>
                    <p style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Calculando distancia a los clientes más cercanos</p>
                </div>
            </div>
        </div>
    `;
    modal.classList.add('open');

    const renderRadarResults = async (userLat, userLng, isCached = false) => {
        window.lastUserCoords = { lat: userLat, lng: userLng };
        const subtitle = document.getElementById('radarSubtitleStatus');
        if (subtitle) {
            subtitle.textContent = isCached
                ? '10 clientes más próximos (afinando GPS...)'
                : 'Los 10 clientes más cercanos a tu ubicación actual';
        }

        const clients = await dataManager.getClients();
        const orders = await dataManager.getOrders();
        const now = new Date();

        const withDist = [];
        clients.forEach(c => {
            if (!c || !c.lat || !c.lng) return;
            const lat = parseFloat(String(c.lat).replace(',', '.'));
            const lng = parseFloat(String(c.lng).replace(',', '.'));
            if (isNaN(lat) || isNaN(lng)) return;

            const distKm = _calcRadarDistanceKm(userLat, userLng, lat, lng);
            const cOrders = orders
                .filter(o => dataManager.isOrderForClient(o, c))
                .sort((a, b) => new Date(b.dateISO || b.date) - new Date(a.dateISO || a.date));

            let lastOrderDays = null;
            let lastOrderAmount = 0;
            let lastOrderDateStr = '';
            if (cOrders.length > 0) {
                const lastOrder = cOrders[0];
                const d = new Date(lastOrder.dateISO || lastOrder.date);
                if (!isNaN(d.getTime())) {
                    lastOrderDays = Math.max(0, Math.floor((now - d) / (1000 * 60 * 60 * 24)));
                    lastOrderAmount = Math.round(parseFloat(lastOrder.amount) || 0);
                    lastOrderDateStr = d.toLocaleDateString('es-ES');
                }
            }

            let lastVisitDays = null;
            if (c.lastVisitDate) {
                const vd = new Date(c.lastVisitDate);
                if (!isNaN(vd.getTime())) {
                    lastVisitDays = Math.max(0, Math.floor((now - vd) / (1000 * 60 * 60 * 24)));
                }
            }

            withDist.push({
                client: c,
                lat,
                lng,
                distKm,
                lastOrderDays,
                lastOrderAmount,
                lastOrderDateStr,
                lastVisitDays
            });
        });

        withDist.sort((a, b) => a.distKm - b.distKm);
        const top10 = withDist.slice(0, 10);

        const bodyEl = document.getElementById('nearbyRadarBody');
        if (!bodyEl) return;

        if (top10.length === 0) {
            bodyEl.innerHTML = `<div style="text-align: center; padding: 3rem 1rem; color: #64748b; font-weight: 700;">No hay clientes con coordenadas GPS registradas.</div>`;
            return;
        }

        bodyEl.innerHTML = `<div style="display: flex; flex-direction: column; gap: 10px;">` + top10.map((item, idx) => {
            const c = item.client;
            const distFormatted = item.distKm < 1
                ? `${Math.round(item.distKm * 1000)} m`
                : `${item.distKm.toFixed(1).replace('.', ',')} km`;

            let statusBadge = `<span style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 800;">🔵 Sin compras registradas</span>`;
            if (item.lastOrderDays !== null) {
                const isRecent = item.lastOrderDays <= 35;
                statusBadge = isRecent
                    ? `<span style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 800;">🟢 Últ. pedido hace ${item.lastOrderDays}d (${item.lastOrderAmount} €)</span>`
                    : `<span style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 800;">🔴 Hace ${item.lastOrderDays} días (${item.lastOrderAmount} €)</span>`;
            }

            const visitBadge = c.lastVisitDate
                ? `<span style="background: #f5f3ff; color: #6d28d9; border: 1px solid #ddd6fe; padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 800;">👁️ Visitado ${item.lastVisitDays === 0 ? 'HOY' : `hace ${item.lastVisitDays}d`}</span>`
                : '';

            const safeCode = String(c.code || '').replace(/'/g, "\\'");

            return `
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 18px; padding: 12px 14px; box-shadow: 0 3px 10px rgba(15, 23, 42, 0.04);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
                        <div style="min-width: 0; flex: 1;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="background: #0f172a; color: white; font-size: 10px; font-weight: 900; padding: 2px 6px; border-radius: 6px;">#${idx + 1}</span>
                                <span style="font-size: 11px; font-weight: 800; color: #64748b;">${c.code || ''}</span>
                                <span style="font-size: 14px; font-weight: 900; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-transform: uppercase;">${c.name || ''}</span>
                            </div>
                            <div style="font-size: 11px; font-weight: 700; color: #0369a1; margin-top: 2px; display: flex; align-items: center; gap: 4px;">
                                <span class="material-icons-round" style="font-size: 13px;">place</span>
                                <span>${c.location || 'Sin localidad'}${c.address ? ' · ' + c.address : ''}</span>
                            </div>
                        </div>
                        <div style="background: #f0f9ff; color: #0284c7; border: 1px solid #bae6fd; padding: 4px 9px; border-radius: 10px; font-size: 12px; font-weight: 900; white-space: nowrap; flex-shrink: 0;">
                            📍 ${distFormatted}
                        </div>
                    </div>

                    <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">
                        ${statusBadge}
                        ${visitBadge}
                        ${c.schedule ? `<span style="background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 800;">🕒 ${c.schedule}</span>` : ''}
                    </div>

                    ${c.notes ? `
                        <div style="background: #fffbeb; border-left: 3px solid #f59e0b; padding: 5px 8px; border-radius: 6px; font-size: 11px; color: #92400e; font-weight: 600; margin-bottom: 8px;">
                            📝 ${c.notes}
                        </div>
                    ` : ''}

                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #f1f5f9;">
                        <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}', '_blank')" style="background: #16a34a; color: white; border: none; border-radius: 10px; padding: 7px 4px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
                            <span class="material-icons-round" style="font-size: 15px;">near_me</span> IR
                        </button>
                        <button onclick="closeNearbyRadarModal(); window.openNewOrderForClient('${safeCode}')" style="background: #009ee3; color: white; border: none; border-radius: 10px; padding: 7px 4px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
                            <span class="material-icons-round" style="font-size: 15px;">add_shopping_cart</span> PEDIDO
                        </button>
                        <button onclick="closeNearbyRadarModal(); window.openClientDetailModal('${safeCode}')" style="background: #f1f5f9; color: #1e293b; border: none; border-radius: 10px; padding: 7px 4px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
                            <span class="material-icons-round" style="font-size: 15px;">badge</span> FICHA
                        </button>
                        <button onclick="${c.phone ? `window.location.href='tel:${String(c.phone).replace(/\\s+/g, '')}'` : `alert('Sin teléfono registrado')`}" style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; border-radius: 10px; padding: 7px 4px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
                            <span class="material-icons-round" style="font-size: 15px;">call</span> LLAMAR
                        </button>
                    </div>
                </div>
            `;
        }).join('') + `</div>`;
    };

    if (window.lastUserCoords && window.lastUserCoords.lat && window.lastUserCoords.lng) {
        await renderRadarResults(window.lastUserCoords.lat, window.lastUserCoords.lng, true);
    }

    if (!navigator.geolocation) {
        if (!window.lastUserCoords) {
            const bodyEl = document.getElementById('nearbyRadarBody');
            if (bodyEl) bodyEl.innerHTML = `<div style="text-align: center; padding: 2.5rem 1rem; color: #ef4444; font-weight: 700;">El GPS no está disponible en este dispositivo.</div>`;
        }
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (pos) => renderRadarResults(pos.coords.latitude, pos.coords.longitude, false),
        () => {
            navigator.geolocation.getCurrentPosition(
                (pos) => renderRadarResults(pos.coords.latitude, pos.coords.longitude, false),
                (err) => {
                    if (!window.lastUserCoords) {
                        const bodyEl = document.getElementById('nearbyRadarBody');
                        if (bodyEl) {
                            bodyEl.innerHTML = `
                                <div style="text-align: center; padding: 2.5rem 1rem; color: #ef4444;">
                                    <span class="material-icons-round" style="font-size: 40px; margin-bottom: 8px;">location_disabled</span>
                                    <p style="font-weight: 800; font-size: 14px; margin: 0;">No se pudo obtener tu ubicación GPS</p>
                                    <p style="font-size: 12px; color: #64748b; margin-top: 6px;">Comprueba que tienes activada la Ubicación en el teléfono y vuelve a intentarlo.</p>
                                </div>
                            `;
                        }
                    }
                },
                { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
            );
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 20000 }
    );
};

window.closeNearbyRadarModal = function() {
    const modal = document.getElementById('nearbyRadarModal');
    if (modal) modal.classList.remove('open');
};

// Exportar para uso global




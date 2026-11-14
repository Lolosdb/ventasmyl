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
            <div class="header-container flex justify-between items-center w-full" style="width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0 1.25rem;">
                <div class="flex items-center gap-3" style="min-width: 0;">
                    ${showBack ? `
                        <button class="icon-btn text-white" onclick="${backFn}">
                            <span class="material-icons-round">arrow_back</span>
                        </button>
                    ` : ''}
                    <h1 class="header-title">${title}</h1>
                </div>
                <div class="flex items-center gap-3" style="flex-shrink: 0;">
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
    const sections = [
        {
            title: 'Análisis',
            items: [
                { icon: 'trending_up', label: 'Ventas Mensuales', action: 'renderVentas()', tone: 'blue' },
                { icon: 'receipt_long', label: 'Facturación Real', action: 'renderFactura()', tone: 'blue' },
                { icon: 'euro_symbol', label: 'Comisiones', action: 'renderComisiones()', tone: 'green' },
                { icon: 'lightbulb', label: 'Ideas de Visita', action: 'renderIdeas()', tone: 'amber' },
                { icon: 'history_toggle_off', label: 'Medias Mensuales', action: 'renderMedias()', tone: 'indigo' },
                { icon: 'emoji_events', label: 'Ranking Clientes', action: 'openRankingModal()', tone: 'amber' }
            ]
        },
        {
            title: 'Objetivos',
            items: [
                { icon: 'ads_click', label: 'Objetivos Mensuales', action: 'renderObjetivos()', tone: 'indigo' },
                { icon: 'event_repeat', label: 'Objetivos Trimestrales', action: 'renderObjetivosTrimestrales()', tone: 'indigo' }
            ]
        },
        {
            title: 'Sistema y Ayuda',
            items: [
                { icon: 'cloud_upload', label: 'Backups', action: 'renderAjustes()', tone: 'blue' },
                { icon: 'menu_book', label: 'Manual de Usuario', action: 'openInfoModal()', tone: 'slate' }
            ]
        }
    ];

    const bodyHtml = sections.map(sec => `
        <div class="nav-menu-section">${sec.title}</div>
        <div class="nav-menu-group">
            ${sec.items.map(item => `
                <button type="button" class="nav-menu-item tone-${item.tone}" onclick="closeNavMenu(); ${item.action};">
                    <span class="nav-item-icon-box">
                        <span class="material-icons-round">${item.icon}</span>
                    </span>
                    <span class="nav-item-label">${item.label}</span>
                    <span class="material-icons-round nav-item-chevron">chevron_right</span>
                </button>
            `).join('')}
        </div>
    `).join('');

    return `
        <div class="nav-menu-content">
            <div class="nav-menu-header">
                <div class="nav-menu-head-left">
                    <div class="nav-menu-head-icon">
                        <span class="material-icons-round">explore</span>
                    </div>
                    <div>
                        <h2 class="nav-menu-head-title">Más Opciones</h2>
                        <p class="nav-menu-head-sub">Herramientas comerciales</p>
                    </div>
                </div>
                <button type="button" class="nav-menu-close-btn" onclick="closeNavMenu()" title="Cerrar menú">
                    <span class="material-icons-round">close</span>
                </button>
            </div>
            <div class="nav-menu-body">
                ${bodyHtml}
            </div>
            <div class="nav-menu-footer">
                <p>App Ventas · Lolo Serantes</p>
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
        btn.style.display = (input.value && input.value.length > 0) ? 'inline-flex' : 'none';
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
        else if (typeof window.filterAlerts === 'function' && inputId === 'alertSearchInput') window.filterAlerts();
        input.dispatchEvent(new Event('input', { bubbles: true }));
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
const MANUAL_SECTIONS = [
    {
        id: 'manual-sec-nav',
        num: '01 · Primeros Pasos',
        shortTitle: 'Navegación',
        title: 'Cómo moverte por la aplicación',
        icon: 'explore',
        tone: 'blue',
        intro: 'La pantalla principal está pensada para usarla cómodamente con una mano desde el móvil en vertical.',
        items: [
            { label: 'Barra inferior fija', text: 'Tienes acceso directo en cualquier momento a tus 6 vistas principales: Dash, Pedidos, Totales, Clientes, Alertas y Mapa.' },
            { label: 'Menú Más Opciones (≡)', text: 'Arriba a la derecha abre el menú lateral con los informes históricos (Ventas Mensuales, Facturación Real, Comisiones, Ideas de Visita, Medias Mensuales, Ranking Clientes), Objetivos, Backups y este Manual.' },
            { label: 'Búsqueda por voz y limpieza rápida', text: 'Todos los buscadores principales incluyen micrófono para dictar en español sin escribir y botón × para borrar la búsqueda al instante.' }
        ]
    },
    {
        id: 'manual-sec-dash',
        num: '02 · Inicio',
        shortTitle: 'Dash',
        title: 'Dash (Panel Principal)',
        icon: 'grid_view',
        tone: 'blue',
        intro: 'Es tu centro de control diario para saber en segundos cuánto llevas vendido este mes y qué tienes pendiente hoy.',
        items: [
            { label: 'Selector de mes (< HOY >)', text: 'Cambia de mes o vuelve rápidamente al mes actual pulsando HOY.' },
            { label: 'Accesos rápidos', text: 'Abre Departamentos, Calendario (actividad diaria) y Notas visita. Si hay recordatorios vencidos o de hoy, verás un aviso destacado para atenderlos.' },
            { label: 'Tarjeta VENTAS DEL MES', text: 'Muestra el total acumulado, el progreso automático hacia tu objetivo mensual (tramos 3%, 4% y 5%) y la comparativa frente al mismo mes del año anterior.' },
            { label: 'Informe Completo', text: 'Botón en la barra superior para generar y revisar un resumen completo de tu actividad.' },
            { label: 'Análisis del mes', text: 'Incluye ventas por semanas laborables, gráfico comparativo (Ant. vs Actual), clientes activos y alertas de tiendas VIP que llevan tiempo sin pedir.' }
        ]
    },
    {
        id: 'manual-sec-pedidos',
        num: '03 · Ventas Diarias',
        shortTitle: 'Pedidos',
        title: 'Gestión de Pedidos',
        icon: 'shopping_bag',
        tone: 'green',
        intro: 'Registra cada venta al momento y controla fácilmente qué pedidos siguen pendientes de preparación o facturación.',
        items: [
            { label: 'Resumen fijo superior', text: 'Siempre ves arriba el número e importe de pedidos en Almacén y los de Falta Tampo (calculando el importe pendiente).' },
            { label: 'Nuevo pedido (+)', text: 'Genera el número anual automático (ej. 2026-001), te deja elegir o buscar cliente, anotar el importe, marcar S/ Tampo (completo o parcial), añadir notas y señalar si es Nuevo Cliente.' },
            { label: 'Buscador e Informe', text: 'Filtra al instante por Nº de pedido o tienda (también por voz) y usa el botón Informe arriba para exportar o revisar listados.' },
            { label: 'Estados de pedido', text: 'Almacén (pendiente normal), S/ Tampo (sin o con parte pendiente de tampografía) y Todo (facturado al 100%). Pulsa cualquier pedido para editarlo o cambiar su estado.' }
        ]
    },
    {
        id: 'manual-sec-totales',
        num: '04 · Resumen Anual',
        shortTitle: 'Totales',
        title: 'Totales y Zonas',
        icon: 'euro',
        tone: 'indigo',
        intro: 'Revisa de un vistazo cómo va tu facturación acumulada del año actual y cuánto aporta cada zona geográfica.',
        items: [
            { label: 'Facturación Ventas Real', text: 'Tarjeta principal con el total facturado en el año en curso, cuánto te falta para alcanzar la siguiente meta (3%, 4% o 5%) y su barra de progreso.' },
            { label: 'Desglose por provincias', text: 'Cuatro tarjetas claras con el importe y número de pedidos de Asturias, Cantabria, León y Galicia.' },
            { label: 'Estadísticas Generales', text: 'Resume Clientes Nuevos, Clientes con Compra, Total Pedidos del año e Importe Medio Facturado.' }
        ]
    },
    {
        id: 'manual-sec-clientes',
        num: '05 · Cartera',
        shortTitle: 'Clientes',
        title: 'Clientes y Fichas',
        icon: 'people',
        tone: 'teal',
        intro: 'Tu agenda comercial completa, preparada para buscar una tienda, contactar en un toque y anotar tus visitas.',
        items: [
            { label: 'Panel superior de acciones', text: 'Crea un Nuevo Cliente, abre el radar Clientes Cerca o gestiona tus datos con Importar Excel, Bajar Drive y Subir Drive (con aviso automático si hay cambios pendientes offline).' },
            { label: 'Buscador inteligente', text: 'Localiza cualquier tienda por nombre, código o población mediante texto o dictado por voz.' },
            { label: 'Ficha completa', text: 'Consulta código, contacto, correo y teléfonos; llama, abre WhatsApp o inicia navegación GPS en un toque, registra notas de visita con recordatorios y revisa todo su historial de pedidos.' },
            { label: 'Captura GPS', text: 'Al crear o editar un cliente puedes guardar tu ubicación actual para situarlo con exactitud en el mapa y en las rutas.' }
        ]
    },
    {
        id: 'manual-sec-alertas',
        num: '06 · Seguimiento',
        shortTitle: 'Alertas',
        title: 'Alertas de Clientes',
        icon: 'notifications',
        tone: 'rose',
        intro: 'Evita que tus clientes habituales se enfríen detectando quién lleva demasiado tiempo sin hacer pedido.',
        items: [
            { label: 'Orden automático por urgencia', text: 'Ordena los clientes con actividad este año de mayor a menor número de días desde su último pedido.' },
            { label: 'Filtros rápidos', text: 'Alterna en un toque entre Todos, +45 días (prioritarios para contactar) y Al día.' },
            { label: 'Acción directa', text: 'Desde la propia alerta puedes buscar por tienda, población o provincia, ver la ficha, llamar o escribir por WhatsApp.' }
        ]
    },
    {
        id: 'manual-sec-mapa',
        num: '07 · Territorio',
        shortTitle: 'Mapa',
        title: 'Mapa Interactivo y Radar',
        icon: 'map',
        tone: 'blue',
        intro: 'Visualiza toda tu cartera geolocalizada sobre el mapa para planificar desplazamientos y aprovechar cada viaje.',
        items: [
            { label: 'Filtros de estado y buscador', text: 'Filtra marcadores entre Todos, Al día, +45 días o Sin ped., y busca tiendas o localidades por texto o voz.' },
            { label: 'Radar ¿Quién tengo cerca ahora?', text: 'Usa el GPS de tu móvil para mostrarte los clientes más próximos ordenados por distancia real y actuar al instante.' },
            { label: 'Agrupación y navegación', text: 'Los puntos cercanos se agrupan en clusters para mantener el mapa limpio; al tocar un cliente puedes abrir su ruta directa en Google Maps.' }
        ],
        tip: 'El mapa almacena en caché las zonas que vas consultando para ayudarte incluso en zonas con cobertura limitada.'
    },
    {
        id: 'manual-sec-analisis',
        num: '08 · Menú ≡',
        shortTitle: 'Análisis',
        title: 'Análisis Comercial Avanzado',
        icon: 'analytics',
        tone: 'amber',
        intro: 'Desde el menú lateral (≡ → Análisis) dispones de 6 herramientas especializadas para estudiar evolución, comisiones y rutas.',
        items: [
            { label: 'Ventas Mensuales', text: 'Tabla multi-año con todos los meses a la vista, variación porcentual (verde/rojo) frente al año anterior y edición táctil por mes (con suma automática de pedidos).' },
            { label: 'Facturación Real', text: 'Tabla editable por mes y año con barra de progreso y color automático según el tramo de objetivo alcanzado.' },
            { label: 'Comisiones', text: 'Vista automática de solo lectura que calcula la comisión mensual y el total anual aplicando el porcentaje alcanzado sobre tu Facturación Real.' },
            { label: 'Ideas de Visita', text: 'Motor inteligente que puntúa clientes según urgencia de ciclo, estacionalidad y volumen; organiza rutas de 1 día por Asturias, Cantabria, León o Galicia, envía la ruta por WhatsApp y permite registrar visitas al vuelo.' },
            { label: 'Medias Mensuales', text: 'Calcula tu media histórica de años cerrados, la media anual, la media mensual, el mes pico y el peso estacional (%) de cada mes.' },
            { label: 'Ranking Clientes', text: 'Clasificación por año alternando entre Por Ventas (€) y Por Pedidos, con top 3 destacado, buscador por voz y salto directo a cada ficha.' }
        ],
        tiers: true
    },
    {
        id: 'manual-sec-objetivos',
        num: '09 · Metas y Equipo',
        shortTitle: 'Objetivos',
        title: 'Objetivos y Departamentos',
        icon: 'ads_click',
        tone: 'indigo',
        intro: 'Define tus metas económicas anuales y ten siempre a mano el directorio interno de la empresa.',
        items: [
            { label: 'Objetivos Mensuales (≡ → Objetivos)', text: 'Configura mes a mes los importes objetivo de cada tramo (3%, 4% y 5%). Cada año conserva su propio histórico sin alterar años anteriores.' },
            { label: 'Objetivos Trimestrales (≡ → Objetivos)', text: 'Selector de año y tarjetas para 1er Trimestre (Ene–Mar), 2º (Abr–Jun), 3er (Jul–Sep) y 4º (Oct–Dic), con cálculo automático de facturado y estado (Conseguido, En curso, No conseguido o Pendiente).' },
            { label: 'Departamentos (desde Dash)', text: 'Agenda interna para guardar responsables y pulsar directamente sobre su teléfono, WhatsApp o correo.' }
        ]
    },
    {
        id: 'manual-sec-backups',
        num: '10 · Seguridad y PWA',
        shortTitle: 'Backups',
        title: 'Backups, Preferencias y Uso Offline',
        icon: 'cloud_done',
        tone: 'slate',
        intro: 'En ≡ → Backups proteges toda tu información en la nube y adaptas la app a tu forma habitual de trabajar.',
        items: [
            { label: 'Copia en Google Drive', text: 'Programación automática de lunes a viernes a las 20:30 h, subida manual con Guardar Ahora y botón Ver Historial para restaurar copias anteriores.' },
            { label: 'Excel (.XLSX)', text: 'Descarga copia local en Excel, importa hojas de Excel o sube una copia Excel directamente a tu Google Drive.' },
            { label: 'WhatsApp y Correo', text: 'Elige tu app preferida (WhatsApp Business, Personal o Preguntar; Gmail, Outlook o Predeterminada) y guarda tu correo de trabajo.' },
            { label: 'Servidor Drive y Años Comerciales', text: 'Comprueba el enlace con Probar enlace y añade nuevos años comerciales cuando empiece un nuevo ejercicio.' }
        ],
        tip: 'Añade la app a la pantalla de inicio desde el navegador del móvil (instalar PWA): funcionará a pantalla completa, más rápida y lista para consultar o anotar pedidos sin cobertura.'
    }
];

function buildManualSectionHtml(section) {
    const itemsHtml = section.items.map(item => `
        <li class="manual-item-row">
            <span class="manual-item-dot"></span>
            <div><strong>${item.label}:</strong> ${item.text}</div>
        </li>
    `).join('');

    const tiersHtml = section.tiers ? `
        <div class="manual-tier-chips">
            <span class="manual-chip is-red"><span class="manual-chip-dot"></span>Rojo · 2% (bajo 3%)</span>
            <span class="manual-chip is-amber"><span class="manual-chip-dot"></span>Ámbar · 3%</span>
            <span class="manual-chip is-blue"><span class="manual-chip-dot"></span>Azul · 4%</span>
            <span class="manual-chip is-green"><span class="manual-chip-dot"></span>Verde · 5%</span>
        </div>
    ` : '';

    const tipHtml = section.tip ? `
        <div class="manual-tip-box">
            <span class="material-icons-round">tips_and_updates</span>
            <span>${section.tip}</span>
        </div>
    ` : '';

    return `
        <section id="${section.id}" class="manual-section-card">
            <div class="manual-sec-head">
                <span class="manual-sec-icon tone-${section.tone}">
                    <span class="material-icons-round">${section.icon}</span>
                </span>
                <div class="manual-sec-heading">
                    <span class="manual-sec-num">${section.num}</span>
                    <h3 class="manual-sec-title">${section.title}</h3>
                </div>
            </div>
            <p class="manual-sec-intro">${section.intro}</p>
            <ul class="manual-item-list">${itemsHtml}</ul>
            ${tiersHtml}
            ${tipHtml}
        </section>
    `;
}

function scrollToManualSection(sectionId) {
    const target = document.getElementById(sectionId);
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function openInfoModal() {
    let modal = document.getElementById('infoModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'infoModal';
        modal.className = 'modal-overlay';
        modal.onclick = (e) => {
            if (e.target && e.target.id === 'infoModal') closeInfoModal();
        };
        document.body.appendChild(modal);
    }

    // Bloquear scroll de fondo
    document.body.style.overflow = 'hidden';

    const tocPillsHtml = MANUAL_SECTIONS.map(sec => `
        <button type="button" class="manual-toc-pill" onclick="scrollToManualSection('${sec.id}')">
            <span class="material-icons-round">${sec.icon}</span>
            <span>${sec.shortTitle}</span>
        </button>
    `).join('');

    const sectionsHtml = MANUAL_SECTIONS.map(buildManualSectionHtml).join('');

    const manualContent = `
        <div class="manual-modal-card" role="dialog" aria-modal="true" aria-labelledby="manualModalTitle">
            <div class="manual-modal-header">
                <div class="manual-head-left">
                    <span class="manual-head-icon">
                        <span class="material-icons-round">menu_book</span>
                    </span>
                    <div class="manual-head-titles">
                        <h2 id="manualModalTitle" class="manual-head-title">Manual de Usuario</h2>
                        <p class="manual-head-sub">Guía completa paso a paso · App Ventas</p>
                    </div>
                </div>
                <button type="button" class="ana-modal-close" onclick="closeInfoModal()" title="Cerrar manual" aria-label="Cerrar manual">
                    <span class="material-icons-round">close</span>
                </button>
            </div>

            <div class="manual-scroll-body">
                <div class="manual-hero-card">
                    <div class="manual-hero-eyebrow">
                        <span class="material-icons-round">auto_awesome</span>
                        <span>Guía de bienvenida</span>
                    </div>
                    <p class="manual-author-label">Aplicación creada por</p>
                    <p class="manual-author-name">Manuel F. Serantes Pérez</p>
                    <p class="manual-hero-desc">
                        Todo lo que necesitas para controlar tus pedidos, clientes, rutas GPS, facturación y objetivos comerciales desde el móvil.
                    </p>
                    <div class="manual-quickstart-grid">
                        <div class="manual-step-chip">
                            <span class="manual-step-num">Paso 1</span>
                            <span class="manual-step-text">Revisa Backups y Drive en ≡</span>
                        </div>
                        <div class="manual-step-chip">
                            <span class="manual-step-num">Paso 2</span>
                            <span class="manual-step-text">Consulta Dash, Clientes y Mapa</span>
                        </div>
                        <div class="manual-step-chip">
                            <span class="manual-step-num">Paso 3</span>
                            <span class="manual-step-text">Anota pedidos y rutas al vuelo</span>
                        </div>
                    </div>
                </div>

                <div class="manual-toc-card">
                    <p class="manual-toc-title">
                        <span class="material-icons-round">bolt</span>
                        <span>Acceso rápido a capítulos</span>
                    </p>
                    <div class="manual-toc-pills">
                        ${tocPillsHtml}
                    </div>
                </div>

                ${sectionsHtml}

                <div class="manual-footer-card">
                    <div>
                        <p class="manual-footer-credit-label">Aplicación diseñada y desarrollada por</p>
                        <p class="manual-footer-credit-name">Manuel F. Serantes Pérez</p>
                    </div>
                    <button type="button" class="manual-close-cta" onclick="closeInfoModal()">
                        <span class="material-icons-round" style="font-size: 18px;">check_circle</span>
                        <span>Entendido, volver a la app</span>
                    </button>
                </div>
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

window.openInfoModal = openInfoModal;
window.closeInfoModal = closeInfoModal;
window.scrollToManualSection = scrollToManualSection;

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

    const isTextarea = targetEl.tagName === 'TEXTAREA';
    const recognition = new SpeechRec();
    recognition.lang = 'es-ES';
    recognition.interimResults = !isTextarea;
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

    const isIconOnlyBtn = btnEl && (
        btnEl.classList.contains('pro-search-mic-btn') ||
        btnEl.dataset.iconOnly === 'true'
    );

    if (btnEl) {
        if (isIconOnlyBtn) {
            btnEl.innerHTML = '<span class="material-icons-round">graphic_eq</span>';
        } else {
            btnEl.innerHTML = '<span class="material-icons-round" style="font-size: 16px;">graphic_eq</span><span>Escuchando...</span>';
        }
        btnEl.style.background = '#fee2e2';
        btnEl.style.color = '#dc2626';
        btnEl.style.borderColor = '#fca5a5';
        btnEl.classList.add('voice-recording-pulse');
    }

    window._activeSpeechRecognition = recognition;
    window._activeSpeechBtn = btnEl;

    recognition.onresult = (event) => {
        let transcript = '';
        let hasFinal = false;
        if (event.results) {
            for (let i = 0; i < event.results.length; i++) {
                transcript += event.results[i][0]?.transcript || '';
                if (event.results[i].isFinal) hasFinal = true;
            }
        }
        if (transcript.trim()) {
            const cleanText = transcript.trim().replace(/[.,;!?]+$/, '');

            if (isTextarea) {
                if (!hasFinal) return;
                const capitalized = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
                const currentVal = (targetEl.value || '').trim();
                targetEl.value = currentVal
                    ? (currentVal.endsWith('.') || currentVal.endsWith(',') ? `${currentVal} ${capitalized}` : `${currentVal}. ${capitalized}`)
                    : capitalized;
            } else {
                // En buscadores e inputs de una línea, escribir el texto limpio directamente en tiempo real
                targetEl.value = cleanText;
            }

            targetEl.dispatchEvent(new Event('input', { bubbles: true }));
            targetEl.dispatchEvent(new Event('keyup', { bubbles: true }));

            if (targetId === 'clientSearchInput' && typeof window.filterClients === 'function') {
                window.filterClients(targetEl.value);
            } else if (targetId === 'searchPedidosInput' && typeof window.filterPedidos === 'function') {
                window.filterPedidos();
            } else if (targetId === 'alertSearchInput' && typeof window.filterAlerts === 'function') {
                window.filterAlerts();
            } else if (targetId === 'mapSearchInput') {
                if (typeof window.toggleMapClearBtn === 'function') window.toggleMapClearBtn();
                if (hasFinal && typeof window.searchLocation === 'function') window.searchLocation();
            }

            if (hasFinal && typeof onCompleteCallback === 'function') {
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
        <div class="modal-content" style="max-width: 520px; width: 96%; max-height: 90vh; border-radius: 24px; overflow: hidden; padding: 0; background: #f8fafc; margin: auto;">
            <div style="background: linear-gradient(135deg, #009ee3 0%, #0284c7 100%); padding: 1.15rem 1.35rem; display: flex; justify-content: space-between; align-items: center; color: white;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(255, 255, 255, 0.2); display: flex; align-items: center; justify-content: center; color: #ffffff;">
                        <span class="material-icons-round" style="font-size: 21px;">my_location</span>
                    </div>
                    <div>
                        <h2 style="font-size: 1rem; font-weight: 800; margin: 0; letter-spacing: -0.2px; text-transform: uppercase;">Clientes Cerca de Mí</h2>
                        <p id="radarSubtitleStatus" style="font-size: 11px; color: rgba(255,255,255,0.88); margin: 2px 0 0; font-weight: 600;">Obteniendo tu posición GPS...</p>
                    </div>
                </div>
                <button onclick="closeNearbyRadarModal()" style="background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.25); color: white; width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                    <span class="material-icons-round" style="font-size: 19px;">close</span>
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

        const buildClientRadarItem = (c, lat, lng, distKm) => {
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

            const locNorm = (typeof normalizeTextKey === 'function')
                ? normalizeTextKey(c.location || '')
                : String(c.location || '').trim().toLowerCase();

            return {
                client: c,
                lat,
                lng,
                distKm,
                locNorm,
                lastOrderDays,
                lastOrderAmount,
                lastOrderDateStr,
                lastVisitDays
            };
        };

        const withDist = [];
        clients.forEach(c => {
            if (!c || !c.lat || !c.lng) return;
            const lat = parseFloat(String(c.lat).replace(',', '.'));
            const lng = parseFloat(String(c.lng).replace(',', '.'));
            if (isNaN(lat) || isNaN(lng)) return;

            const distKm = _calcRadarDistanceKm(userLat, userLng, lat, lng);
            withDist.push(buildClientRadarItem(c, lat, lng, distKm));
        });

        withDist.sort((a, b) => a.distKm - b.distKm);

        // 1. Tomamos los 10 clientes más cercanos como semilla
        const seedTop = withDist.slice(0, 10);

        // 2. Identificamos todas las poblaciones presentes en esos clientes cercanos
        const includedCodes = new Set(seedTop.map(item => String(item.client.code)));
        const nearbyLocations = new Set();
        const locationMaxDist = new Map();

        seedTop.forEach(item => {
            if (item.locNorm) {
                nearbyLocations.add(item.locNorm);
                const prevMax = locationMaxDist.get(item.locNorm) || 0;
                if (item.distKm > prevMax) locationMaxDist.set(item.locNorm, item.distKm);
            }
        });

        // 3. Incluimos TODOS los clientes que pertenezcan a cualquiera de esas poblaciones cercanas
        // (tanto si tienen GPS y estaban más allá del puesto 10, como si están en esa misma población)
        const finalResults = [...seedTop];

        withDist.forEach(item => {
            const codeStr = String(item.client.code);
            if (!includedCodes.has(codeStr) && item.locNorm && nearbyLocations.has(item.locNorm)) {
                includedCodes.add(codeStr);
                finalResults.push(item);
            }
        });

        // También incluir clientes de esas mismas poblaciones aunque no tuvieran coordenadas GPS
        clients.forEach(c => {
            if (!c) return;
            const codeStr = String(c.code);
            if (includedCodes.has(codeStr)) return;
            const locNorm = (typeof normalizeTextKey === 'function')
                ? normalizeTextKey(c.location || '')
                : String(c.location || '').trim().toLowerCase();
            if (locNorm && nearbyLocations.has(locNorm)) {
                includedCodes.add(codeStr);
                const refDist = (locationMaxDist.get(locNorm) || 0) + 0.05;
                finalResults.push(buildClientRadarItem(c, null, null, refDist));
            }
        });

        // Ordenar por distancia para mantener el orden natural de cercanía
        finalResults.sort((a, b) => a.distKm - b.distKm);

        if (subtitle) {
            const numTowns = nearbyLocations.size;
            subtitle.textContent = isCached
                ? `${finalResults.length} clientes cercanos (afinando GPS...)`
                : `${finalResults.length} clientes en ${numTowns || 1} ${numTowns === 1 ? 'población cercana' : 'poblaciones cercanas'} (completas)`;
        }

        const bodyEl = document.getElementById('nearbyRadarBody');
        if (!bodyEl) return;

        if (finalResults.length === 0) {
            bodyEl.innerHTML = `<div style="text-align: center; padding: 3rem 1rem; color: #64748b; font-weight: 700;">No hay clientes con coordenadas GPS registradas.</div>`;
            return;
        }

        bodyEl.innerHTML = `<div style="display: flex; flex-direction: column; gap: 10px;">` + finalResults.map((item, idx) => {
            const c = item.client;
            const hasCoords = item.lat !== null && item.lng !== null;
            const distFormatted = !hasCoords
                ? `Misma población`
                : (item.distKm < 1
                    ? `${Math.round(item.distKm * 1000)} m`
                    : `${item.distKm.toFixed(1).replace('.', ',')} km`);

            let statusBadge = `<span style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 800;">🔵 Sin compras registradas</span>`;
            if (item.lastOrderDays !== null) {
                const isRecent = item.lastOrderDays <= 45;
                statusBadge = isRecent
                    ? `<span style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 800;">🟢 Últ. pedido hace ${item.lastOrderDays}d (${item.lastOrderAmount} €)</span>`
                    : `<span style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 800;">🔴 Hace ${item.lastOrderDays} días (${item.lastOrderAmount} €)</span>`;
            }

            const visitBadge = c.lastVisitDate
                ? `<span style="background: #f5f3ff; color: #6d28d9; border: 1px solid #ddd6fe; padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 800;">👁️ Visitado ${item.lastVisitDays === 0 ? 'HOY' : `hace ${item.lastVisitDays}d`}</span>`
                : '';

            const safeCode = String(c.code || '').replace(/'/g, "\\'");
            const mapsAction = hasCoords
                ? `window.open('https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}', '_blank')`
                : `window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('${String((c.address || '') + ' ' + (c.location || '')).replace(/'/g, "\\'")}'), '_blank')`;
            const cleanRadarPhone = String(c.phone || '').replace(/\s+/g, '');

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

                    <div class="app-corp-row" style="margin-top: 8px; padding-top: 10px; border-top: 1px solid #f1f5f9;">
                        ${window.renderCorpActionBtn({ type: 'maps', onclick: mapsAction, label: 'Cómo llegar', compact: true })}
                        ${window.renderCorpActionBtn({ type: 'phone', onclick: cleanRadarPhone ? `window.location.href='tel:${cleanRadarPhone}'` : '', label: 'Llamar', disabled: !cleanRadarPhone, compact: true })}
                        ${window.renderCorpActionBtn({ type: 'order', onclick: `closeNearbyRadarModal(); window.openNewOrderForClient('${safeCode}')`, label: 'Pedido', compact: true })}
                        ${window.renderCorpActionBtn({ type: 'detail', onclick: `closeNearbyRadarModal(); window.openClientDetailModal('${safeCode}')`, label: 'Ficha', compact: true })}
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

// ============================================================================
// PREFERENCIAS DE COMUNICACIÓN: WHATSAPP BUSINESS Y CORREO ELECTRÓNICO
// ============================================================================

window.getWhatsAppPref = function() {
    return localStorage.getItem('pref_whatsapp_app') || 'business'; // 'business' | 'personal' | 'ask'
};

window.syncCommPrefsToDb = function() {
    try {
        if (typeof dataManager !== 'undefined' && dataManager && dataManager.db) {
            dataManager.db.put('config', {
                key: 'comm_prefs',
                pref_whatsapp_app: window.getWhatsAppPref(),
                pref_email_app: window.getEmailPref(),
                pref_work_email: window.getWorkEmailAddress()
            });
        }
    } catch (e) {
        console.warn('No se pudo sincronizar comm_prefs en IndexedDB:', e);
    }
};

window.setWhatsAppPref = function(mode) {
    localStorage.setItem('pref_whatsapp_app', mode);
    window.syncCommPrefsToDb();
};

window.getEmailPref = function() {
    return localStorage.getItem('pref_email_app') || 'default'; // 'default' | 'gmail' | 'outlook' | 'ask'
};

window.setEmailPref = function(mode) {
    localStorage.setItem('pref_email_app', mode);
    window.syncCommPrefsToDb();
};

window.getWorkEmailAddress = function() {
    return localStorage.getItem('pref_work_email') || '';
};

window.setWorkEmailAddress = function(email) {
    localStorage.setItem('pref_work_email', (email || '').trim());
    window.syncCommPrefsToDb();
};

window.getWhatsAppPrefLabel = function() {
    const pref = window.getWhatsAppPref();
    if (pref === 'business') return 'WhatsApp Business';
    if (pref === 'personal') return 'WhatsApp Personal';
    return 'Preguntar al enviar';
};

window.getEmailPrefLabel = function() {
    const pref = window.getEmailPref();
    if (pref === 'gmail') return 'Gmail';
    if (pref === 'outlook') return 'Outlook';
    if (pref === 'ask') return 'Preguntar al enviar';
    return 'App predeterminada';
};

window.openAppWhatsApp = function(phone = '', text = '', forcedMode = null) {
    const cleanDigits = String(phone || '').replace(/[^0-9]/g, '');
    let fullPhone = cleanDigits;
    if (cleanDigits.length === 9) {
        fullPhone = '34' + cleanDigits;
    }

    if (!fullPhone && !text) {
        alert('No hay un número de teléfono válido registrado.');
        return;
    }

    const mode = forcedMode || window.getWhatsAppPref();
    if (mode === 'ask') {
        window.openWhatsAppSelectorModal(fullPhone, text);
        return;
    }

    const params = [];
    if (fullPhone) params.push(`phone=${fullPhone}`);
    if (text) params.push(`text=${encodeURIComponent(text)}`);
    const queryString = params.join('&');

    const fallbackUrl = fullPhone
        ? `https://wa.me/${fullPhone}${text ? '?text=' + encodeURIComponent(text) : ''}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`;

    const isAndroid = /Android/i.test(navigator.userAgent || '');
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent || '');

    if (isAndroid) {
        const pkg = (mode === 'personal') ? 'com.whatsapp' : 'com.whatsapp.w4b';
        const intentUrl = `intent://send?${queryString}#Intent;scheme=whatsapp;package=${pkg};S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
        window.location.href = intentUrl;
        return;
    }

    if (isIOS && mode === 'business') {
        window.location.href = `whatsapp-business://send?${queryString}`;
        return;
    }

    window.open(fallbackUrl, '_blank');
};

window.openAppEmail = function(email = '', subject = '', body = '', forcedMode = null) {
    const cleanEmail = String(email || '').trim();
    if (!cleanEmail) {
        alert('No hay una dirección de correo registrada.');
        return;
    }

    const mode = forcedMode || window.getEmailPref();
    if (mode === 'ask') {
        window.openEmailSelectorModal(cleanEmail, subject, body);
        return;
    }

    const workEmail = window.getWorkEmailAddress();
    const queryParts = [];
    if (subject) queryParts.push(`subject=${encodeURIComponent(subject)}`);
    if (body) queryParts.push(`body=${encodeURIComponent(body)}`);
    const mailtoUrl = `mailto:${cleanEmail}${queryParts.length ? '?' + queryParts.join('&') : ''}`;

    const isAndroid = /Android/i.test(navigator.userAgent || '');

    if (mode === 'gmail') {
        if (isAndroid) {
            const composeParams = [`to=${encodeURIComponent(cleanEmail)}`];
            if (subject) composeParams.push(`subject=${encodeURIComponent(subject)}`);
            if (body) composeParams.push(`body=${encodeURIComponent(body)}`);
            const intentUrl = `intent://compose?${composeParams.join('&')}#Intent;scheme=mailto;package=com.google.android.gm;S.browser_fallback_url=${encodeURIComponent(mailtoUrl)};end`;
            window.location.href = intentUrl;
            return;
        } else {
            const gmailWeb = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(cleanEmail)}${workEmail ? '&authuser=' + encodeURIComponent(workEmail) : ''}${subject ? '&su=' + encodeURIComponent(subject) : ''}${body ? '&body=' + encodeURIComponent(body) : ''}`;
            window.open(gmailWeb, '_blank');
            return;
        }
    }

    if (mode === 'outlook' && isAndroid) {
        const composeParams = [`to=${encodeURIComponent(cleanEmail)}`];
        if (subject) composeParams.push(`subject=${encodeURIComponent(subject)}`);
        if (body) composeParams.push(`body=${encodeURIComponent(body)}`);
        const intentUrl = `intent://compose?${composeParams.join('&')}#Intent;scheme=mailto;package=com.microsoft.office.outlook;S.browser_fallback_url=${encodeURIComponent(mailtoUrl)};end`;
        window.location.href = intentUrl;
        return;
    }

    window.location.href = mailtoUrl;
};

window.openWhatsAppSelectorModal = function(fullPhone, text) {
    let modal = document.getElementById('commSelectorModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'commSelectorModal';
        modal.className = 'modal-overlay';
        modal.style.zIndex = '2200';
        modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open'); };
        document.body.appendChild(modal);
    }

    window._pendingWaPayload = { fullPhone, text };

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 380px !important; width: 92% !important; padding: 0; border-radius: 24px; overflow: hidden; background: #ffffff;">
            <div style="padding: 1.25rem 1.5rem; background: #0f172a; color: white; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="material-icons-round" style="color: #10b981;">chat</span>
                    <h3 style="margin: 0; font-size: 15px; font-weight: 800;">Elegir WhatsApp</h3>
                </div>
                <button onclick="document.getElementById('commSelectorModal').classList.remove('open')" style="background: rgba(255,255,255,0.1); border: none; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                    <span class="material-icons-round" style="font-size: 18px;">close</span>
                </button>
            </div>
            <div style="padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 10px;">
                <p style="margin: 0 0 4px; font-size: 12.5px; color: #64748b; font-weight: 600;">¿Desde qué cuenta deseas enviar el mensaje?</p>
                <button onclick="document.getElementById('commSelectorModal').classList.remove('open'); window.openAppWhatsApp(window._pendingWaPayload.fullPhone, window._pendingWaPayload.text, 'business')"
                        style="display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-radius: 14px; border: 1.5px solid #10b981; background: #f0fdf4; color: #065f46; font-weight: 800; font-size: 13.5px; cursor: pointer;">
                    <span style="display: flex; align-items: center; gap: 10px;">
                        <span class="material-icons-round" style="color: #059669;">storefront</span>
                        <span>WhatsApp Business (Trabajo)</span>
                    </span>
                    <span class="material-icons-round" style="font-size: 18px;">chevron_right</span>
                </button>
                <button onclick="document.getElementById('commSelectorModal').classList.remove('open'); window.openAppWhatsApp(window._pendingWaPayload.fullPhone, window._pendingWaPayload.text, 'personal')"
                        style="display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-radius: 14px; border: 1px solid #e2e8f0; background: #f8fafc; color: #334155; font-weight: 700; font-size: 13.5px; cursor: pointer;">
                    <span style="display: flex; align-items: center; gap: 10px;">
                        <span class="material-icons-round" style="color: #64748b;">person</span>
                        <span>WhatsApp Personal</span>
                    </span>
                    <span class="material-icons-round" style="font-size: 18px; color: #94a3b8;">chevron_right</span>
                </button>
            </div>
        </div>
    `;
    modal.classList.add('open');
};

window.openEmailSelectorModal = function(email, subject, body) {
    let modal = document.getElementById('commSelectorModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'commSelectorModal';
        modal.className = 'modal-overlay';
        modal.style.zIndex = '2200';
        modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open'); };
        document.body.appendChild(modal);
    }

    window._pendingEmailPayload = { email, subject, body };

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 380px !important; width: 92% !important; padding: 0; border-radius: 24px; overflow: hidden; background: #ffffff;">
            <div style="padding: 1.25rem 1.5rem; background: #0f172a; color: white; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="material-icons-round" style="color: #38bdf8;">mail</span>
                    <h3 style="margin: 0; font-size: 15px; font-weight: 800;">Elegir aplicación de correo</h3>
                </div>
                <button onclick="document.getElementById('commSelectorModal').classList.remove('open')" style="background: rgba(255,255,255,0.1); border: none; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                    <span class="material-icons-round" style="font-size: 18px;">close</span>
                </button>
            </div>
            <div style="padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 10px;">
                <p style="margin: 0 0 4px; font-size: 12.5px; color: #64748b; font-weight: 600;">Destinatario: <strong>${email}</strong></p>
                <button onclick="document.getElementById('commSelectorModal').classList.remove('open'); window.openAppEmail(window._pendingEmailPayload.email, window._pendingEmailPayload.subject, window._pendingEmailPayload.body, 'gmail')"
                        style="display: flex; align-items: center; justify-content: space-between; padding: 13px 16px; border-radius: 14px; border: 1.5px solid #bae6fd; background: #f0f9ff; color: #0369a1; font-weight: 800; font-size: 13.5px; cursor: pointer;">
                    <span style="display: flex; align-items: center; gap: 10px;">
                        <span class="material-icons-round" style="color: #0284c7;">mail</span>
                        <span>Gmail</span>
                    </span>
                    <span class="material-icons-round" style="font-size: 18px;">chevron_right</span>
                </button>
                <button onclick="document.getElementById('commSelectorModal').classList.remove('open'); window.openAppEmail(window._pendingEmailPayload.email, window._pendingEmailPayload.subject, window._pendingEmailPayload.body, 'outlook')"
                        style="display: flex; align-items: center; justify-content: space-between; padding: 13px 16px; border-radius: 14px; border: 1px solid #e2e8f0; background: #f8fafc; color: #1e293b; font-weight: 700; font-size: 13.5px; cursor: pointer;">
                    <span style="display: flex; align-items: center; gap: 10px;">
                        <span class="material-icons-round" style="color: #2563eb;">business_center</span>
                        <span>Microsoft Outlook</span>
                    </span>
                    <span class="material-icons-round" style="font-size: 18px; color: #94a3b8;">chevron_right</span>
                </button>
                <button onclick="document.getElementById('commSelectorModal').classList.remove('open'); window.openAppEmail(window._pendingEmailPayload.email, window._pendingEmailPayload.subject, window._pendingEmailPayload.body, 'default')"
                        style="display: flex; align-items: center; justify-content: space-between; padding: 13px 16px; border-radius: 14px; border: 1px solid #e2e8f0; background: #ffffff; color: #475569; font-weight: 700; font-size: 13.5px; cursor: pointer;">
                    <span style="display: flex; align-items: center; gap: 10px;">
                        <span class="material-icons-round" style="color: #64748b;">forward_to_inbox</span>
                        <span>App de correo predeterminada</span>
                    </span>
                    <span class="material-icons-round" style="font-size: 18px; color: #94a3b8;">chevron_right</span>
                </button>
            </div>
        </div>
    `;
    modal.classList.add('open');
};

window.openCommPrefsModal = function(clientCodeToRefresh = null) {
    let modal = document.getElementById('commPrefsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'commPrefsModal';
        modal.className = 'modal-overlay';
        modal.style.zIndex = '2100';
        modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open'); };
        document.body.appendChild(modal);
    }

    const currentWa = window.getWhatsAppPref();
    const currentEmail = window.getEmailPref();
    const currentWorkEmail = window.getWorkEmailAddress();
    const safeClientCode = clientCodeToRefresh ? String(clientCodeToRefresh).replace(/'/g, "\\'") : '';

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 440px !important; width: 93% !important; padding: 0; border-radius: 24px; overflow: hidden; background: #ffffff;">
            <div style="padding: 1.25rem 1.5rem; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="material-icons-round" style="color: #38bdf8; font-size: 22px;">tune</span>
                    <div>
                        <h3 style="margin: 0; font-size: 15px; font-weight: 800;">Canales de Comunicación</h3>
                        <p style="margin: 2px 0 0; font-size: 11px; color: #94a3b8; font-weight: 500;">Configura desde dónde enviar WhatsApp y correos</p>
                    </div>
                </div>
                <button onclick="document.getElementById('commPrefsModal').classList.remove('open')" style="background: rgba(255,255,255,0.12); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                    <span class="material-icons-round" style="font-size: 18px;">close</span>
                </button>
            </div>
            <div style="padding: 1.35rem 1.5rem; display: flex; flex-direction: column; gap: 16px;">
                <div>
                    <label style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 8px;">
                        <span class="material-icons-round" style="font-size: 16px; color: #10b981;">chat</span>
                        <span>Aplicación de WhatsApp al pulsar enviar</span>
                    </label>
                    <select id="modalPrefWaSelect" style="width: 100%; padding: 12px 14px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: #f8fafc; font-size: 13.5px; font-weight: 700; color: #0f172a; outline: none;">
                        <option value="business" ${currentWa === 'business' ? 'selected' : ''}>WhatsApp Business (Trabajo - Recomendado)</option>
                        <option value="personal" ${currentWa === 'personal' ? 'selected' : ''}>WhatsApp Personal</option>
                        <option value="ask" ${currentWa === 'ask' ? 'selected' : ''}>Preguntar siempre antes de abrir</option>
                    </select>
                </div>

                <div>
                    <label style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 8px;">
                        <span class="material-icons-round" style="font-size: 16px; color: #0284c7;">mail</span>
                        <span>Aplicación de Correo Electrónico</span>
                    </label>
                    <select id="modalPrefEmailSelect" style="width: 100%; padding: 12px 14px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: #f8fafc; font-size: 13.5px; font-weight: 700; color: #0f172a; outline: none;">
                        <option value="default" ${currentEmail === 'default' ? 'selected' : ''}>App de correo predeterminada</option>
                        <option value="gmail" ${currentEmail === 'gmail' ? 'selected' : ''}>Abrir siempre en Gmail</option>
                        <option value="outlook" ${currentEmail === 'outlook' ? 'selected' : ''}>Abrir siempre en Microsoft Outlook</option>
                        <option value="ask" ${currentEmail === 'ask' ? 'selected' : ''}>Preguntar siempre antes de abrir</option>
                    </select>
                </div>

                <div>
                    <label style="display: block; font-size: 10.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 6px;">
                        Tu Correo de Trabajo (Opcional, para Gmail en Web/PC)
                    </label>
                    <input type="email" id="modalPrefWorkEmailInput" value="${currentWorkEmail.replace(/"/g, '&quot;')}" placeholder="Ej: tu.correo@empresa.com"
                           style="width: 100%; padding: 11px 14px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: #f8fafc; font-size: 13px; font-weight: 600; color: #0f172a; outline: none;">
                </div>

                <button type="button" onclick="window.saveCommPrefsFromModal('${safeClientCode}')"
                        style="width: 100%; margin-top: 4px; padding: 13px; border-radius: 14px; border: none; background: #0284c7; color: white; font-size: 13.5px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);">
                    <span class="material-icons-round" style="font-size: 18px;">check_circle</span>
                    <span>Guardar Preferencias</span>
                </button>
            </div>
        </div>
    `;
    modal.classList.add('open');
};

window.saveCommPrefsFromModal = function(clientCodeToRefresh = '') {
    const waSelect = document.getElementById('modalPrefWaSelect');
    const emailSelect = document.getElementById('modalPrefEmailSelect');
    const workEmailInput = document.getElementById('modalPrefWorkEmailInput');

    if (waSelect) window.setWhatsAppPref(waSelect.value);
    if (emailSelect) window.setEmailPref(emailSelect.value);
    if (workEmailInput) window.setWorkEmailAddress(workEmailInput.value);

    const modal = document.getElementById('commPrefsModal');
    if (modal) modal.classList.remove('open');

    if (clientCodeToRefresh && typeof window.openClientDetailModal === 'function') {
        window.openClientDetailModal(clientCodeToRefresh);
    } else if (window.currentView === 'ajustes' && typeof window.renderAjustes === 'function') {
        window.renderAjustes(true);
    }
};

// ============================================================================
// BOTÓN 'X' UNIVERSAL DE BORRADO RÁPIDO PARA TODOS LOS CUADROS DE TEXTO
// ============================================================================

window.enhanceClearableInputs = function(root = document) {
    if (!root || !root.querySelectorAll) return;
    const candidates = root.querySelectorAll(
        'input[type="text"], input[type="tel"], input[type="email"], input[type="number"], input[type="search"], textarea'
    );

    candidates.forEach(el => {
        if (el.dataset.clearEnhanced === 'true') {
            if (el._syncClearBtn) el._syncClearBtn();
            return;
        }
        if (el.readOnly || el.disabled) return;
        if (el.dataset && el.dataset.noClear === 'true') return;
        if (el.id === 'orderId' || el.id === 'rankSearch') return;
        if (
            el.classList.contains('v-input-premium') ||
            el.classList.contains('v7-input') ||
            el.classList.contains('v7-factura-input') ||
            el.closest('.analysis-table-wrapper') ||
            el.closest('.v7-obj-table') ||
            el.closest('.v7-factura-table') ||
            el.closest('.search-container') ||
            el.closest('.pro-search-bar') ||
            el.closest('.client-search-wrapper') ||
            el.closest('.trim-input-group') ||
            el.closest('.order-input-wrapper')
        ) {
            return;
        }

        el.dataset.clearEnhanced = 'true';

        const wrapper = document.createElement('div');
        wrapper.className = 'pro-clearable-wrapper';
        const isTextarea = el.tagName === 'TEXTAREA';
        if (isTextarea) wrapper.classList.add('is-textarea');

        // Conservar margen inferior si lo tenía el input directo
        const computedMb = el.style.marginBottom;
        if (computedMb) {
            wrapper.style.marginBottom = computedMb;
            el.style.marginBottom = '0';
        }

        const parent = el.parentNode;
        if (!parent) return;
        parent.insertBefore(wrapper, el);
        wrapper.appendChild(el);

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'pro-input-clear-x';
        clearBtn.title = 'Borrar texto';
        clearBtn.tabIndex = -1;
        clearBtn.innerHTML = '<span class="material-icons-round">close</span>';
        wrapper.appendChild(clearBtn);

        const syncVisibility = () => {
            const hasVal = el.value && String(el.value).length > 0;
            clearBtn.style.display = hasVal ? 'inline-flex' : 'none';
        };

        el._syncClearBtn = syncVisibility;
        el.addEventListener('input', syncVisibility);
        el.addEventListener('focus', syncVisibility);
        el.addEventListener('change', syncVisibility);

        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.value = '';
            syncVisibility();
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.focus();
        });

        syncVisibility();
    });
};

if (typeof document !== 'undefined') {
    const startClearableObserver = () => {
        window.enhanceClearableInputs(document);
        const obs = new MutationObserver(() => {
            window.enhanceClearableInputs(document);
        });
        if (document.body) {
            obs.observe(document.body, { childList: true, subtree: true });
        }
        document.addEventListener('focusin', (e) => {
            if (e.target && e.target._syncClearBtn) e.target._syncClearBtn();
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startClearableObserver);
    } else {
        startClearableObserver();
    }
}

// =========================================================================
// COMPONENTE GLOBAL UNIFICADO DE BOTONES CORPORATIVOS (MAPS, CALL, WA, MAIL)
// =========================================================================
window.APP_ACTION_SVGS = {
    maps: `<svg viewBox="0 0 48 48" width="26" height="26" aria-hidden="true">
        <path fill="#1a73e8" d="M24 4c-7.73 0-14 6.27-14 14 0 3.09 1.01 5.95 2.71 8.27L24 44l11.29-17.73A13.92 13.92 0 0 0 38 18c0-7.73-6.27-14-14-14z"/>
        <path fill="#ea4335" d="M24 4c-5.21 0-9.75 2.85-12.16 7.08L20.1 18h7.8L36.16 11.08C33.75 6.85 29.21 4 24 4z"/>
        <path fill="#fbbc04" d="M11.84 11.08A13.94 13.94 0 0 0 10 18c0 3.09 1.01 5.95 2.71 8.27L20.1 18l-8.26-6.92z"/>
        <path fill="#34a853" d="M24 44l11.29-17.73A13.94 13.94 0 0 0 38 18c0-2.5-.66-4.85-1.84-6.92L24 25.5V44z"/>
        <circle cx="24" cy="18" r="5.5" fill="#ffffff"/>
    </svg>`,
    phone: `<svg viewBox="0 0 24 24" width="22" height="22" fill="#ffffff" aria-hidden="true">
        <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.46.57 3.58a1 1 0 0 1-.25 1.01l-2.2 2.2z"/>
    </svg>`,
    whatsapp: `<svg viewBox="0 0 32 32" width="24" height="24" fill="#ffffff" aria-hidden="true">
        <path d="M16 3C8.82 3 3 8.82 3 16c0 2.48.7 4.8 1.91 6.77L3.4 28.6l6-1.48A12.93 12.93 0 0 0 16 29c7.18 0 13-5.82 13-13S23.18 3 16 3zm7.58 18.23c-.32.9-1.87 1.72-2.6 1.83-.66.1-1.5.14-2.42-.15-.56-.18-1.28-.42-2.2-.82-3.87-1.67-6.4-5.58-6.6-5.84-.2-.26-1.57-2.09-1.57-3.99s.99-2.83 1.35-3.22c.35-.39.77-.49 1.03-.49.26 0 .51 0 .74.01.24.01.56-.09.87.67.32.77 1.09 2.66 1.18 2.86.1.19.16.42.03.68-.13.26-.2.42-.39.64-.19.23-.41.51-.58.68-.19.19-.4.4-.17.79.23.39 1.01 1.66 2.17 2.69 1.49 1.33 2.75 1.74 3.14 1.94.39.19.62.16.85-.1.23-.26.97-1.13 1.23-1.52.26-.39.52-.32.87-.19.35.13 2.25 1.06 2.64 1.25.39.19.64.29.74.45.1.16.1.94-.22 1.84z"/>
    </svg>`,
    mail: `<svg viewBox="0 0 48 48" width="26" height="26" aria-hidden="true">
        <rect x="17" y="10" width="23" height="28" rx="3" fill="#0364b8"/>
        <path fill="#28a8ea" d="M40 16H17v18c0 2.21 1.79 4 4 4h15c2.21 0 4-1.79 4-4V16z"/>
        <path fill="#0078d4" d="M17 16l11.5 8.2L40 16v-2.5c0-1.93-1.57-3.5-3.5-3.5h-16c-1.93 0-3.5 1.57-3.5 3.5V16z"/>
        <path fill="#50d9ff" d="M17 16l11.5 8.2L40 16H17z" opacity="0.45"/>
        <rect x="6" y="14" width="20" height="20" rx="3.5" fill="#0a58ca"/>
        <ellipse cx="16" cy="24" rx="4.8" ry="5.6" fill="none" stroke="#ffffff" stroke-width="2.6"/>
    </svg>`
};

window.renderCorpActionBtn = function({
    type = 'phone',
    onclick = '',
    href = '',
    label = '',
    title = '',
    disabled = false,
    compact = false,
    showLabel = true,
    done = false,
    stopPropagation = false,
    extraClass = ''
} = {}) {
    const defaults = {
        maps: 'Cómo llegar',
        phone: 'Llamar',
        whatsapp: 'Whatsapp',
        mail: 'Mail',
        visit: 'Visitado',
        order: 'Pedido',
        detail: 'Ficha'
    };
    const finalLabel = label !== undefined && label !== null && label !== '' ? label : (defaults[type] || '');
    const finalTitle = title || finalLabel || type;

    let iconHtml = window.APP_ACTION_SVGS[type] || '';
    if (!iconHtml) {
        const matIcons = {
            visit: done ? 'check_circle' : 'add_task',
            order: 'add_shopping_cart',
            detail: 'badge'
        };
        iconHtml = `<span class="material-icons-round">${matIcons[type] || 'touch_app'}</span>`;
    }

    const escAttr = (v) => String(v || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;');

    const cls = [
        'app-corp-btn',
        compact ? 'is-compact' : '',
        disabled ? 'is-disabled' : '',
        done ? 'is-done' : '',
        extraClass || ''
    ].filter(Boolean).join(' ');

    const innerHtml = `
        <span class="app-corp-circle is-${type}">${iconHtml}</span>
        ${showLabel && finalLabel ? `<span class="app-corp-label">${finalLabel}</span>` : ''}
    `;

    if (href && !disabled) {
        const stopAttr = stopPropagation ? ' onclick="event.stopPropagation()"' : '';
        return `<a href="${escAttr(href)}" target="_blank" rel="noopener" class="${cls}" title="${escAttr(finalTitle)}"${stopAttr}>${innerHtml}</a>`;
    }

    const rawClick = String(onclick || '').trim();
    const clickCode = !disabled && rawClick
        ? (stopPropagation ? `event.stopPropagation(); ${rawClick}` : rawClick)
        : '';
    const onclickAttr = clickCode ? ` onclick="${escAttr(clickCode)}"` : '';
    const disabledAttr = disabled ? ' disabled aria-disabled="true"' : '';

    return `<button type="button" class="${cls}" title="${escAttr(finalTitle)}"${onclickAttr}${disabledAttr}>${innerHtml}</button>`;
};




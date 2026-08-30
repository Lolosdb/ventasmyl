/**
 * main.js - Punto de entrada y orquestación
 */

// La instancia dataManager ya se crea globalmente en data-manager.js
// Solo nos aseguramos de que esté disponible para otros scripts
// Gestión de Navegación y Botón Atrás
window.currentView = 'dash';
window.viewScrollPositions = {};

window.restoreScroll = function() {
    const app = document.getElementById('app');
    if (!app) return;
    // Pequeño timeout para permitir que el DOM se repinte después del innerHTML
    setTimeout(() => {
        const targetView = window.currentView;
        if (window.viewScrollPositions[targetView] !== undefined) {
            app.scrollTop = window.viewScrollPositions[targetView];
        } else {
            app.scrollTop = 0;
        }
    }, 10);
};

/**
 * Actualiza el estado del historial del navegador.
 * @param {string} viewName - Nombre de la vista actual.
 * @param {boolean} isBack - Si el cambio viene de una acción de retroceso.
 */
function updateHistoryState(viewName, isBack = false) {
    const app = document.getElementById('app');
    if (app && window.currentView && window.currentView !== viewName) {
        window.viewScrollPositions[window.currentView] = app.scrollTop;
    }

    if (isBack) {
        window.currentView = viewName;
        return;
    }

    if (viewName === 'dash') {
        window.currentView = 'dash';
        return;
    }

    // Si pasamos de Dash a una Subvista -> Creamos una nueva entrada en el historial
    if (window.currentView === 'dash') {
        history.pushState({ view: viewName }, '', '#' + viewName);
    } else {
        // Si ya estamos en una subvista, reemplazamos para que 'atrás' siempre vaya al Dash
        history.replaceState({ view: viewName }, '', '#' + viewName);
    }
    window.currentView = viewName;
}

// Escuchar el botón de retroceso del sistema
window.addEventListener('popstate', () => {
    if (window.currentView !== 'dash') {
        if (typeof renderDash === 'function') renderDash(true);
    }
});

window.updateHistoryState = updateHistoryState;

if (typeof dataManager === 'undefined') {
    console.warn("dataManager no detectado. Re-instanciando...");
    window.dataManager = new DataManager();
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Iniciando Aplicación...");

    // Intentar bloquear la orientación en vertical
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('portrait').catch(err => {
            console.log("El bloqueo de orientación no es soportado o requiere interacción previa:", err);
        });
    }

    try {
        // 1. Inicializar Base de Datos Local
        await dataManager.init();

        // 2. Iniciar programador de backups si está disponible
        if (typeof window.startBackupScheduler === 'function') {
            window.startBackupScheduler();
        }

        // 3. Activar y verificar automáticamente la conexión con Google Script al iniciar
        if (typeof window.checkConnectionStatus === 'function') {
            window.checkConnectionStatus(true);
        }

        // 4. Renderizar vista inicial (Dashboard)
        if (typeof renderDash === 'function') {
            renderDash().catch(err => {
                console.error("Error al renderizar el Dashboard:", err);
            });
        }

    } catch (error) {
        console.error('Error crítico durante la inicialización:', error);
        
        const appContainer = document.getElementById('app');
        if (appContainer) {
            appContainer.innerHTML = [
                '<div style="padding: 2rem; text-align: center;">',
                    '<div style="color: #ef4444; font-size: 40px; margin-bottom: 1rem;">⚠️</div>',
                    '<h2 style="color: #1e293b; font-weight: 800; margin-bottom: 0.5rem;">Fallo de Inicialización</h2>',
                    '<p style="color: #64748b; font-size: 14px; margin-bottom: 1.5rem;">',
                        'No se ha podido conectar con la base de datos local. Por favor, intenta recargar la página.',
                    '</p>',
                    '<button onclick="window.location.reload()" style="background: #009ee3; color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 700; cursor: pointer;">',
                        'Recargar Ahora',
                    '</button>',
                '</div>'
            ].join("");
        }
    }
});

/**
 * Utilidad Premium: Ajusta automáticamente el tamaño de la fuente para que el texto quepa en una sola línea.
 */
function autoShrinkText(element, minFontSize = 8) {
    if (!element || !element.clientWidth) return;
    
    if (!element.dataset.originalSize) {
        element.dataset.originalSize = window.getComputedStyle(element).fontSize;
    }
    
    let currentFontSize = parseFloat(element.dataset.originalSize);
    element.style.fontSize = currentFontSize + "px";
    
    while (element.scrollWidth > (element.clientWidth + 2) && currentFontSize > minFontSize) {
        currentFontSize -= 0.5;
        element.style.fontSize = currentFontSize + "px";
    }
}

window.autoShrinkText = autoShrinkText;



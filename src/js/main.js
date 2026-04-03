/**
 * main.js - Punto de entrada y orquestación
 */

// La instancia dataManager ya se crea globalmente en data-manager.js
// Solo nos aseguramos de que esté disponible para otros scripts
if (typeof dataManager === 'undefined') {
    console.warn("dataManager no detectado. Re-instanciando...");
    window.dataManager = new DataManager();
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Iniciando Aplicación...");
    try {
        // 1. Inicializar Base de Datos Local
        await dataManager.init();

        // 2. Iniciar programador de backups si está disponible
        if (typeof window.startBackupScheduler === 'function') {
            window.startBackupScheduler();
        }

        // 3. Renderizar vista inicial (Dashboard)
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

/**
 * GESTIÓN DE RETROCESO (Android Back Button) v8.3
 * Intercepta el botón físico para evitar cierres accidentales.
 */
function initBackButtonHandler() {
    // Empujamos un estado inicial para poder capturar el primer 'atrás'
    if (window.history && window.history.pushState) {
        window.history.pushState({ type: 'initial' }, '');
        
        window.addEventListener('popstate', function(event) {
            // 1. Si el modal de salida está abierto, el 'atrás' lo cierra (equivale a NO salir)
            const exitModal = document.getElementById('exitModal');
            if (exitModal && exitModal.classList.contains('open')) {
                closeExitModal();
                // Volvemos a empujar el estado para la siguiente vez
                window.history.pushState({ type: 'initial' }, '');
                return;
            }

            // 2. Si hay otros modales o menús abiertos, los cerramos
            const navMenu = document.getElementById('navMenuOverlay');
            if (navMenu && navMenu.classList.contains('open')) {
                closeNavMenu();
                window.history.pushState({ type: 'initial' }, '');
                return;
            }

            // 3. Caso general: Preguntar si desea salir
            if (typeof confirmExitApp === 'function') {
                confirmExitApp();
            }
        });
    }
}

// Inicializar el manejador de retroceso
initBackButtonHandler();

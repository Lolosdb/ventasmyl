
$filePath = 'c:\Users\Usuario\Desktop\Mis Herramientas\App Ventas con src\src\js\render.js'
$codeToAppend = @"

/**
 * Cambia entre modo claro y oscuro
 */
function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    // Actualizar icono
    const icon = document.querySelector('.theme-icon');
    if (icon) {
        icon.textContent = isDark ? 'light_mode' : 'dark_mode';
    }
    
    // Recargar Dash si estamos en él para refrescar colores de Chart.js
    if (document.getElementById('trendChart')) {
        renderDash();
    }
}

/**
 * Inicializa el tema basado en la preferencia guardada
 */
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

// Llamar a initTheme al cargar el script o en initApp
initTheme();
"@

Add-Content -Path $filePath -Value $codeToAppend

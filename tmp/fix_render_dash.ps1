
$filePath = 'c:\Users\Usuario\Desktop\Mis Herramientas\App Ventas con src\src\js\render.js'
$content = Get-Content $filePath -Raw

# Esta regex busca el final de la función renderDash y añade la llamada a initDashCharts
$oldLine = 'app.innerHTML = headerHtml \+ contentHtml;'
$newLine = 'app.innerHTML = headerHtml + contentHtml;' + "`n`n    // Inicializar gráficos`n    initDashCharts(stats);`n`n    // Activar micro-interacciones de la barra de navegación (si existe)`n    if (window.activeCurrentNav) window.activeCurrentNav('dash');"

# Aplicamos el reemplazo solo en la primera ocurrencia (que es renderDash)
$newContent = [regex]::Replace($content, $oldLine, $newLine, 1)

Set-Content -Path $filePath -Value $newContent -NoNewline


$renderPath = 'c:\Users\Usuario\Desktop\Mis Herramientas\App Ventas con src\src\js\render.js'
$newDashPath = 'c:\Users\Usuario\Desktop\Mis Herramientas\App Ventas con src\tmp\new_render_dash.js'
$themePath = 'c:\Users\Usuario\Desktop\Mis Herramientas\App Ventas con src\tmp\helper_theme_charts.js'
$previewPath = 'c:\Users\Usuario\Desktop\Mis Herramientas\App Ventas con src\tmp\helper_preview_report.js'

# Leer partes originales
$originalLines = Get-Content $renderPath
$topPart = $originalLines[0..30] # Líneas 1-31 (0-indexed)
$bottomPart = $originalLines[603..($originalLines.Length - 1)] # Línea 604 en adelante (0-indexed)

# Leer nuevas partes
$newDash = Get-Content $newDashPath -Raw
$themeLogic = Get-Content $themePath -Raw
$previewLogic = Get-Content $previewPath -Raw

# Combinar todo
$finalContent = @()
$finalContent += $topPart
$finalContent += $newDash
$finalContent += $themeLogic
$finalContent += $previewLogic
$finalContent += $bottomPart

# Escribir el archivo final
$finalContent | Set-Content $renderPath -NoNewline
Write-Host "render.js successfully rebuilt and updated."

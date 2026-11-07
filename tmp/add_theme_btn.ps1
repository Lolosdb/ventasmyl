
$filePath = 'c:\Users\Usuario\Desktop\Mis Herramientas\App Ventas con src\src\js\render.js'
$content = [System.IO.File]::ReadAllText($filePath)

# Regex para encontrar el bloque de header-actions y añadir el botón de toggle de tema
$oldBlock = '<div class="header-actions">`r?`n\s+<button class="icon-btn-ghost shadow-sm" onclick="openReportModal\(\)" title="Informe Completo">`r?`n\s+<span class="material-icons-round text-blue-primary">analytics</span>`r?`n\s+<span class="btn-text">Informe Completo</span>`r?`n\s+</button>`r?`n\s+</div>'

$newBlock = '<div class="header-actions flex items-center gap-2">
                    <button class="icon-btn-ghost shadow-sm theme-toggle-btn" onclick="toggleTheme()" title="Cambiar Tema">
                        <span class="material-icons-round theme-icon">dark_mode</span>
                    </button>
                    <button class="icon-btn-ghost shadow-sm" onclick="openReportModal()" title="Informe Completo">
                        <span class="material-icons-round text-blue-primary">analytics</span>
                        <span class="btn-text">Informe Completo</span>
                    </button>
                </div>'

if ($content -match $oldBlock) {
    Write-Host "Found the header block!"
    $newContent = [regex]::Replace($content, $oldBlock, $newBlock)
    [System.IO.File]::WriteAllText($filePath, $newContent)
} else {
    Write-Host "Header block not found by regex. Trying a simpler one..."
    # Intento con búsqueda de texto literal si la regex falla por saltos de línea/espacios
    $targetText = '<div class="header-actions">'
    $replacementText = '<div class="header-actions flex items-center gap-2">`n                    <button class="icon-btn-ghost shadow-sm theme-toggle-btn" onclick="toggleTheme()" title="Cambiar Tema">`n                        <span class="material-icons-round theme-icon">dark_mode</span>`n                    </button>'
    if ($content.Contains($targetText)) {
         $newContent = $content.Replace($targetText, $replacementText)
         [System.IO.File]::WriteAllText($filePath, $newContent)
         Write-Host "Simple replacement used."
    } else {
         Write-Host "Critical error: Header block not found."
    }
}

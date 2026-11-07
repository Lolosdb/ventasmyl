
$path = "c:\Users\Usuario\Desktop\Mis Herramientas\App Ventas con src\src\css\main.css"
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

# Reemplazo Robusto usando Regex para .modal-overlay
$regex = "(?s)\.modal-overlay\s*\{[^}]*background-color:\s*rgba\(0,\s*0,\s*0,\s*0\.5\);[^}]*z-index:\s*1000;"
$match = [regex]::Match($content, $regex)

if ($match.Success) {
    $newVal = ".modal-overlay {`r`n    position: fixed;`r`n    top: 0;`r`n    left: 0;`r`n    right: 0;`r`n    bottom: 0;`r`n    background-color: rgba(15, 23, 42, 0.85);`r`n    backdrop-filter: blur(10px);`r`n    -webkit-backdrop-filter: blur(10px);`r`n    z-index: 99999;"
    $content = $content.Replace($match.Value, $newVal)
    Write-Host "Reemplazo de .modal-overlay exitoso."
} else {
    Write-Host "No se encontró el patrón de .modal-overlay."
}

# Reemplazo de z-index de .header
$content = $content.Replace("z-index: 500;", "z-index: 100;")

[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)


$path = "c:\Users\Usuario\Desktop\Mis Herramientas\App Ventas con src\src\css\main.css"
$content = Get-Content -Path $path -Raw -Encoding UTF8

# 1. Ajustar .modal-overlay para que sea más oscuro, tenga desenfoque y un z-index superior
$oldOverlay = ".modal-overlay {`r`n    position: fixed;`r`n    top: 0;`r`n    left: 0;`r`n    right: 0;`r`n    bottom: 0;`r`n    background-color: rgba(0, 0, 0, 0.5);`r`n    z-index: 1000;"
$newOverlay = ".modal-overlay {`r`n    position: fixed;`r`n    top: 0;`r`n    left: 0;`r`n    right: 0;`r`n    bottom: 0;`r`n    background-color: rgba(15, 23, 42, 0.85);`r`n    backdrop-filter: blur(8px);`r`n    -webkit-backdrop-filter: blur(8px);`r`n    z-index: 99999;"

# Reemplazar (intentando coincidir exactamente con lo que vimos en el cat anterior)
$content = $content.Replace("background-color: rgba(0, 0, 0, 0.5);`n    z-index: 1000;", "background-color: rgba(15, 23, 42, 0.85);`n    backdrop-filter: blur(8px);`n    -webkit-backdrop-filter: blur(8px);`n    z-index: 99999;")

# En caso de que los saltos de línea sean diferentes (\r\n vs \n)
if ($content -notmatch "backdrop-filter") {
    $content = $content.Replace("background-color: rgba(0, 0, 0, 0.5);`r`n    z-index: 1000;", "background-color: rgba(15, 23, 42, 0.85);`r`n    backdrop-filter: blur(8px);`r`n    -webkit-backdrop-filter: blur(8px);`r`n    z-index: 99999;")
}

# 2. Asegurar que .header tenga un z-index menor que el modal
$content = $content.Replace("z-index: 500;", "z-index: 100;")

Set-Content -Path $path -Value $content -NoNewline -Encoding UTF8

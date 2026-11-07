
$filePath = 'c:\Users\Usuario\Desktop\Mis Herramientas\App Ventas con src\src\js\render.js'
$content = [System.IO.File]::ReadAllText($filePath)

$target = '<button class="btn btn-primary w-full flex items-center justify-center gap-2" onclick="generateStrategicReport\(\)">'
$replacement = '<div class="flex gap-2 mb-4">
                        <button class="btn btn-secondary flex-1 flex items-center justify-center gap-2" onclick="previewReport()">
                            <span class="material-icons-round">visibility</span>
                            Previsualizar
                        </button>
                        <button class="btn btn-primary flex-1 flex items-center justify-center gap-2" onclick="generateStrategicReport()">'

if ($content.Contains('<button class="btn btn-primary w-full flex items-center justify-center gap-2" onclick="generateStrategicReport()">')) {
    $newContent = $content.Replace('<button class="btn btn-primary w-full flex items-center justify-center gap-2" onclick="generateStrategicReport()">', $replacement)
    [System.IO.File]::WriteAllText($filePath, $newContent)
    Write-Host "Preview button added to report modal."
} else {
    Write-Host "Target not found for preview button."
}

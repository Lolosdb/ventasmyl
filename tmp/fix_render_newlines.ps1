
$path = 'c:\Users\Usuario\Desktop\Mis Herramientas\App Ventas con src\src\js\render.js'
$lines = Get-Content $path -Raw
# If it's one single string, try to split it by 'async function' or similar
# Actually, I'll just write it back with proper newlines if I can.
# Wait, I'll just use a smarter replacement script.

# Better: Read it and replace the long line with line breaks where functions start.
$newContent = $lines -replace 'async function ', "`nasync function " -replace 'function ', "`nfunction "
$newContent | Set-Content $path

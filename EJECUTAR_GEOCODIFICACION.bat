@echo off
echo ========================================
echo   Geocodificacion de Clientes
echo ========================================
echo.
echo Por favor, arrastra tu archivo Excel aqui
echo o escribe la ruta completa del archivo:
echo.
set /p ARCHIVO="Archivo Excel: "
echo.
echo Procesando...
python geocodificar_clientes.py "%ARCHIVO%"
echo.
echo Presiona cualquier tecla para salir...
pause >nul

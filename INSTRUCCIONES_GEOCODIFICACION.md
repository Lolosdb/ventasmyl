# 📍 Instrucciones: Geocodificación Automática de Clientes

## 🎯 Objetivo
Agregar coordenadas (latitud y longitud) a tu hoja de cálculo **antes** de importarla, para que el mapa cargue instantáneamente.

## 📋 Pasos

### 1. Preparar el Entorno

Abre una terminal/consola en la carpeta del proyecto y ejecuta:

```bash
pip install -r requirements.txt
```

Esto instalará las librerías necesarias (pandas, openpyxl, requests).

### 2. Ejecutar el Script

```bash
python geocodificar_clientes.py Clientes.xlsx
```

**Nota**: Reemplaza `Clientes.xlsx` con el nombre real de tu archivo.

### 3. Esperar el Proceso

- ⏱️ El script procesará cada cliente (1 segundo por cliente para respetar límites de la API)
- 💾 Guarda el progreso cada 10 clientes (si se interrumpe, puedes continuar)
- ✅ Verás en pantalla el progreso: `[50/396] Buscando: NOMBRE... ✅ 43.4269, -3.8242`

### 4. Resultado

Se creará un nuevo archivo: `Clientes_con_coordenadas.xlsx`

Este archivo tendrá las mismas columnas que el original **más** dos columnas nuevas:
- `lat` (latitud)
- `lon` (longitud)

### 5. Importar en la App

1. Abre la app
2. Ve a la sección de **Clientes**
3. Haz clic en **"Importar Clientes"**
4. Selecciona el archivo `Clientes_con_coordenadas.xlsx`
5. ✅ Los clientes se importarán **con sus coordenadas ya incluidas**

## 🔧 Formato del Excel

El script detecta automáticamente las columnas. Acepta estos nombres:

| Campo | Nombres Aceptados |
|-------|-------------------|
| **Dirección** | `direccion`, `address`, `dirección` |
| **Ciudad** | `ciudad`, `city`, `localidad`, `poblacion` |
| **Provincia** | `provincia`, `province` |

## ⚠️ Notas Importantes

1. **Tiempo**: Para 400 clientes, el proceso puede tardar ~7-10 minutos
2. **Conexión**: Necesitas conexión a internet estable
3. **API Gratuita**: Usa OpenStreetMap (gratis pero con límites de velocidad)
4. **Progreso**: Si se interrumpe, el archivo parcial se guarda. Puedes continuar después

## 🐛 Solución de Problemas

### "No se encontró la columna de dirección"
- Verifica que tu Excel tenga una columna con "direccion" o "address" en el nombre
- El script es sensible a mayúsculas/minúsculas en el nombre de la columna

### Muchos "No encontrado"
- Algunas direcciones pueden ser muy específicas o tener errores
- El script intenta diferentes combinaciones automáticamente
- Puedes revisar manualmente esos casos después

### Error de conexión
- Verifica tu conexión a internet
- La API puede estar temporalmente saturada, intenta más tarde

## 💡 Ventajas de este Método

✅ **Rápido**: El mapa carga instantáneamente (no busca coordenadas en tiempo real)  
✅ **Eficiente**: Se hace una sola vez, no cada vez que abres el mapa  
✅ **Confiable**: No depende de la velocidad de la API en tiempo real  
✅ **Reutilizable**: Puedes actualizar el Excel y volver a geocodificar solo los nuevos

## 📝 Ejemplo de Uso Completo

```bash
# 1. Instalar dependencias (solo la primera vez)
pip install -r requirements.txt

# 2. Ejecutar el script
python geocodificar_clientes.py Clientes.xlsx

# 3. Esperar el proceso...
# [1/396] Buscando: CLIENTE 1... ✅ 43.4269, -3.8242
# [2/396] Buscando: CLIENTE 2... ✅ 40.4168, -3.7038
# ...

# 4. Cuando termine, importar Clientes_con_coordenadas.xlsx en la app
```

## 🔄 Opción Alternativa: Script en el Navegador

Si ya importaste los clientes y quieres agregar las coordenadas después:

1. Prepara tu Excel con las columnas `lat` y `lon` (puedes usar el script Python)
2. Abre la app y la consola del navegador (F12)
3. Abre el archivo `agregar_coordenadas_desde_excel.js` y copia todo su contenido
4. Pégalo en la consola y presiona Enter
5. Selecciona tu archivo Excel cuando se abra el diálogo
6. ✅ Las coordenadas se agregarán automáticamente a los clientes ya importados

## 🎉 Resultado Final

Una vez importado el Excel con coordenadas:
- El mapa se abrirá **instantáneamente**
- Todos los marcadores aparecerán de inmediato
- No habrá esperas ni timeouts
- La experiencia será mucho más fluida

# Geocodificación Automática de Clientes

Este script permite agregar coordenadas (latitud y longitud) a tu hoja de cálculo de clientes antes de importarla a la app.

## Instalación

1. Instala Python 3.7 o superior si no lo tienes
2. Instala las dependencias:
```bash
pip install -r requirements.txt
```

## Uso

### Opción 1: Script Python (Recomendado)

1. Prepara tu archivo Excel con las columnas:
   - Dirección (o Address, Dirección)
   - Ciudad (o City, Localidad, Población) - Opcional
   - Provincia (o Province) - Opcional

2. Ejecuta el script:
```bash
python geocodificar_clientes.py Clientes.xlsx
```

3. El script creará un nuevo archivo `Clientes_con_coordenadas.xlsx` con las columnas `lat` y `lon` agregadas.

4. Importa este nuevo archivo en la app.

### Opción 2: Automático en la App (Próximamente)

La app buscará automáticamente las coordenadas al importar, pero será más lento.

## Notas Importantes

- ⏱️ **Tiempo**: El proceso puede tardar varios minutos (1 segundo por cliente para respetar los límites de la API)
- 💾 **Progreso**: El script guarda el progreso cada 10 clientes, así que si se interrumpe, puedes continuar
- 🌐 **API**: Usa la API gratuita de OpenStreetMap (Nominatim)
- ⚠️ **Límites**: La API tiene límites de velocidad, por eso hay pausas entre peticiones

## Formato del Excel

El script detecta automáticamente las columnas por nombre. Acepta:
- **Dirección**: "direccion", "address", "dirección"
- **Ciudad**: "ciudad", "city", "localidad", "poblacion"
- **Provincia**: "provincia", "province"

## Ejemplo de uso

```bash
# Procesar archivo y crear uno nuevo
python geocodificar_clientes.py Clientes.xlsx

# Especificar nombre de salida
python geocodificar_clientes.py Clientes.xlsx Clientes_geocodificados.xlsx
```

## Solución de problemas

- **Error "No se encontró la columna de dirección"**: Verifica que tu Excel tenga una columna con "direccion" o "address" en el nombre
- **Muchos "No encontrado"**: Algunas direcciones pueden ser muy específicas o incorrectas. El script intenta diferentes combinaciones
- **Timeout**: Si hay muchos timeouts, puede ser un problema de conexión. El script continuará con el siguiente cliente

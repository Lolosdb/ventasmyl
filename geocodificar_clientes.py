"""
Script para geocodificar direcciones de clientes en Excel
Agrega columnas 'lat' y 'lon' al archivo Excel
"""

import pandas as pd
import time
import requests
from openpyxl import load_workbook
import sys

def geocodificar_direccion(direccion, ciudad, provincia):
    """
    Busca coordenadas usando la API de Nominatim (OpenStreetMap)
    """
    try:
        # Construir query
        query_parts = []
        if direccion and str(direccion).strip():
            query_parts.append(str(direccion).strip())
        if ciudad and str(ciudad).strip():
            query_parts.append(str(ciudad).strip())
        if provincia and str(provincia).strip():
            query_parts.append(str(provincia).strip())
        query_parts.append("España")
        
        query = ", ".join(query_parts)
        
        # Llamar a la API
        url = f"https://nominatim.openstreetmap.org/search"
        params = {
            'q': query,
            'format': 'json',
            'limit': 1,
            'addressdetails': 1
        }
        headers = {
            'User-Agent': 'VentasMYL-Geocoder/1.0'
        }
        
        response = requests.get(url, params=params, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                lat = float(data[0]['lat'])
                lon = float(data[0]['lon'])
                return lat, lon
        
        return None, None
        
    except Exception as e:
        print(f"Error geocodificando {query}: {e}")
        return None, None

def procesar_excel(archivo_entrada, archivo_salida=None):
    """
    Procesa el archivo Excel y agrega coordenadas
    """
    if archivo_salida is None:
        archivo_salida = archivo_entrada.replace('.xls', '_con_coordenadas.xlsx').replace('.xlsx', '_con_coordenadas.xlsx')
    
    print(f"📖 Leyendo archivo: {archivo_entrada}")
    
    # Leer Excel
    try:
        df = pd.read_excel(archivo_entrada)
    except Exception as e:
        print(f"❌ Error leyendo el archivo: {e}")
        return
    
    # Detectar columnas (soporta diferentes nombres)
    col_direccion = None
    col_ciudad = None
    col_provincia = None
    
    # Buscar columnas por diferentes nombres posibles
    for col in df.columns:
        col_lower = str(col).lower()
        if 'direccion' in col_lower or 'address' in col_lower or 'dirección' in col_lower:
            col_direccion = col
        if 'ciudad' in col_lower or 'city' in col_lower or 'localidad' in col_lower or 'poblacion' in col_lower:
            col_ciudad = col
        if 'provincia' in col_lower or 'province' in col_lower:
            col_provincia = col
    
    if col_direccion is None:
        print("❌ No se encontró la columna de dirección")
        print(f"Columnas disponibles: {list(df.columns)}")
        return
    
    print(f"✅ Columnas detectadas:")
    print(f"   - Dirección: {col_direccion}")
    if col_ciudad:
        print(f"   - Ciudad: {col_ciudad}")
    if col_provincia:
        print(f"   - Provincia: {col_provincia}")
    
    # Agregar columnas lat y lon si no existen (al final)
    # El código de importación lee por posición, así que las agregamos al final
    # y el usuario puede reorganizar si es necesario, o podemos agregarlas en posiciones específicas
    
    # Opción 1: Agregar al final (más seguro)
    if 'lat' not in df.columns:
        df['lat'] = None
    if 'lon' not in df.columns:
        df['lon'] = None
    
    # Opción 2: Si quieres que estén en posiciones específicas (descomenta si lo necesitas)
    # Si el Excel tiene el formato estándar: code(0), name(1), email(3), address(4), contact(5), city(6), province(7), phone(10)
    # Podríamos insertar lat en posición 8 y lon en posición 9, pero es más complicado
    
    total = len(df)
    procesados = 0
    encontrados = 0
    
    print(f"\n🔄 Procesando {total} clientes...")
    print("⏱️  Esto puede tardar varios minutos (hay que respetar los límites de la API)\n")
    
    for index, row in df.iterrows():
        procesados += 1
        
        # Si ya tiene coordenadas, saltar
        if pd.notna(row.get('lat')) and pd.notna(row.get('lon')):
            if float(row['lat']) != 0 and float(row['lat']) != 0.0001:
                encontrados += 1
                continue
        
        direccion = row.get(col_direccion, '')
        ciudad = row.get(col_ciudad, '') if col_ciudad else ''
        provincia = row.get(col_provincia, '') if col_provincia else ''
        
        if not direccion or str(direccion).strip() == '':
            continue
        
        nombre = row.get('name', row.get('nombre', f'Cliente {index+1}'))
        print(f"[{procesados}/{total}] Buscando: {nombre[:30]}...", end=' ')
        
        lat, lon = geocodificar_direccion(direccion, ciudad, provincia)
        
        if lat and lon:
            df.at[index, 'lat'] = lat
            df.at[index, 'lon'] = lon
            encontrados += 1
            print(f"✅ {lat:.6f}, {lon:.6f}")
        else:
            df.at[index, 'lat'] = 0.0001  # Marcar como no encontrado
            df.at[index, 'lon'] = 0.0001
            print("❌ No encontrado")
        
        # Pausa de cortesía para la API (1 segundo entre peticiones)
        time.sleep(1)
        
        # Guardar progreso cada 10 clientes
        if procesados % 10 == 0:
            df.to_excel(archivo_salida, index=False)
            print(f"💾 Progreso guardado ({procesados}/{total})")
    
    # Guardar archivo final
    print(f"\n💾 Guardando archivo: {archivo_salida}")
    df.to_excel(archivo_salida, index=False)
    
    print(f"\n✅ Proceso completado!")
    print(f"   - Total procesados: {procesados}")
    print(f"   - Coordenadas encontradas: {encontrados}")
    print(f"   - Archivo guardado: {archivo_salida}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python geocodificar_clientes.py <archivo_excel> [archivo_salida]")
        print("\nEjemplo:")
        print("  python geocodificar_clientes.py Clientes.xlsx")
        print("  python geocodificar_clientes.py Clientes.xlsx Clientes_con_coords.xlsx")
        sys.exit(1)
    
    archivo_entrada = sys.argv[1]
    archivo_salida = sys.argv[2] if len(sys.argv) > 2 else None
    
    procesar_excel(archivo_entrada, archivo_salida)

/**
 * GOOGLE APPS SCRIPT - CONECTOR GOOGLE DRIVE PARA APP GESTIÓN / VENTAS
 * Carpeta destino de todo (Copias de seguridad + Excel de Clientes):
 * "Copias seguridad App Gestión"
 */

const FOLDER_NAME = 'Copias seguridad App Gestión';
const CLIENTS_FILENAME = 'Clientes_CON_COORDENADAS.xlsx';

/**
 * Obtiene la carpeta "Copias seguridad App Gestión" (o la crea si no existe).
 */
function getTargetFolder() {
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(FOLDER_NAME);
}

/**
 * Busca un archivo por nombre dentro de la carpeta "Copias seguridad App Gestión".
 * Si es el archivo de clientes y aún estaba fuera (en Mi Unidad), lo mueve automáticamente dentro de la carpeta.
 */
function findFileInTargetFolder(folder, filename) {
  // 1. Buscar coincidencia exacta dentro de la carpeta
  let files = folder.getFilesByName(filename);
  if (files.hasNext()) {
    return files.next();
  }

  // 2. Buscar sin extensión .xlsx por si Google Drive lo convirtió a Google Sheets
  const baseName = filename.replace(/\.xlsx$/i, '');
  if (baseName !== filename) {
    files = folder.getFilesByName(baseName);
    if (files.hasNext()) {
      return files.next();
    }
  }

  // 3. Si es el Excel de clientes y estaba en otra parte de Drive, moverlo automáticamente a "Copias seguridad App Gestión"
  if (filename.toLowerCase() === CLIENTS_FILENAME.toLowerCase()) {
    const globalFiles = DriveApp.getFilesByName(filename);
    if (globalFiles.hasNext()) {
      const foundFile = globalFiles.next();
      foundFile.moveTo(folder);
      return foundFile;
    }
  }

  return null;
}

/**
 * Convierte un archivo de Drive (Excel o Google Sheet) a Base64 (formato .xlsx o contenido binario).
 */
function fileToBase64(file) {
  const mimeType = file.getMimeType();
  let blob;

  // Si el usuario lo abrió y guardó como Hoja de Cálculo de Google, exportarlo al vuelo como .xlsx
  if (mimeType === MimeType.GOOGLE_SHEETS) {
    const url = 'https://docs.google.com/spreadsheets/d/' + file.getId() + '/export?format=xlsx';
    const token = ScriptApp.getOAuthToken();
    const response = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    blob = response.getBlob();
  } else {
    blob = file.getBlob();
  }

  return Utilities.base64Encode(blob.getBytes());
}

/**
 * Peticiones GET:
 * - ?action=ping
 * - ?action=list  /  ?action=getBackups
 * - ?action=get&filename=Clientes_CON_COORDENADAS.xlsx
 * - ?action=get&id=FILE_ID
 * - ?action=delete&id=FILE_ID
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const action = params.action || 'ping';
    const folder = getTargetFolder();

    // 1. PING (Comprobar conexión)
    if (action === 'ping') {
      return jsonResponse({
        status: 'success',
        success: true,
        pong: true,
        folder: folder.getName()
      });
    }

    // 2. LISTAR COPIAS DE SEGURIDAD EN LA CARPETA
    if (action === 'list' || action === 'getBackups') {
      const filesIterator = folder.getFiles();
      const fileList = [];

      while (filesIterator.hasNext()) {
        const f = filesIterator.next();
        if (f.isTrashed()) continue;
        const name = f.getName();
        // Excluir el Excel maestro de clientes de la lista de copias restaurables
        if (name.toLowerCase() === CLIENTS_FILENAME.toLowerCase() ||
            name.toLowerCase() === CLIENTS_FILENAME.replace(/\.xlsx$/i, '').toLowerCase()) {
          continue;
        }
        fileList.push({
          id: f.getId(),
          name: name,
          date: f.getLastUpdated().toISOString(),
          size: f.getSize()
        });
      }

      // Ordenar de más reciente a más antigua
      fileList.sort(function(a, b) {
        return new Date(b.date) - new Date(a.date);
      });

      return jsonResponse({
        status: 'success',
        success: true,
        files: fileList
      });
    }

    // 3. DESCARGAR ARCHIVO (POR ID O POR NOMBRE, EJ. EXCEL DE CLIENTES O COPIA)
    if (action === 'get') {
      let file = null;
      if (params.id) {
        file = DriveApp.getFileById(params.id);
      } else if (params.filename) {
        file = findFileInTargetFolder(folder, params.filename);
      }

      if (!file) {
        return jsonResponse({
          status: 'error',
          success: false,
          message: 'No se encontró el archivo "' + (params.filename || params.id) + '" en la carpeta "' + FOLDER_NAME + '".'
        });
      }

      const base64Data = fileToBase64(file);
      return jsonResponse({
        status: 'success',
        success: true,
        name: file.getName(),
        data: base64Data
      });
    }

    // 4. ELIMINAR COPIA DE SEGURIDAD
    if (action === 'delete' && params.id) {
      const file = DriveApp.getFileById(params.id);
      file.setTrashed(true);
      return jsonResponse({
        status: 'success',
        success: true,
        message: 'Archivo eliminado correctamente'
      });
    }

    return jsonResponse({
      status: 'error',
      success: false,
      message: 'Acción GET no reconocida: ' + action
    });

  } catch (err) {
    return jsonResponse({
      status: 'error',
      success: false,
      message: err.toString()
    });
  }
}

/**
 * Peticiones POST:
 * 1) ?action=save&filename=... (Cuerpo en Base64: guarda/actualiza Clientes_CON_COORDENADAS.xlsx, Backup_Ventas_...xlsx, Resumen_...xlsx)
 * 2) Cuerpo JSON { action: 'fullBackup', data: { ... } } (Guarda copia de seguridad completa en la carpeta)
 */
function doPost(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const action = params.action || '';
    const folder = getTargetFolder();
    const rawBody = (e && e.postData && e.postData.contents) ? e.postData.contents : '';

    // CASO A: Guardar o sobrescribir un archivo binario (Excel de clientes, Excel de Backup, Resumen anual)
    if (action === 'save' && params.filename) {
      const filename = params.filename;
      const bytes = Utilities.base64Decode(rawBody);
      const mimeType = filename.toLowerCase().endsWith('.xlsx')
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : MimeType.PLAIN_TEXT;
      const blob = Utilities.newBlob(bytes, mimeType, filename);

      // Si ya existe el archivo en la carpeta "Copias seguridad App Gestión", lo actualizamos o reemplazamos sin duplicar
      let existingFile = findFileInTargetFolder(folder, filename);
      if (existingFile) {
        // Si existía como Google Sheet convertido, mover a papelera para dejar versión limpia o actualizar
        if (existingFile.getMimeType() === MimeType.GOOGLE_SHEETS) {
          existingFile.setTrashed(true);
          const created = folder.createFile(blob);
          return jsonResponse({ status: 'success', success: true, id: created.getId(), filename: filename });
        }
        // Reemplazar contenido manteniendo o recreando en la misma carpeta
        existingFile.setTrashed(true);
      }

      const newFile = folder.createFile(blob);
      return jsonResponse({
        status: 'success',
        success: true,
        id: newFile.getId(),
        filename: filename
      });
    }

    // CASO B: Copia de seguridad completa en JSON (action: 'fullBackup')
    if (rawBody) {
      const parsed = JSON.parse(rawBody);
      if (parsed.action === 'fullBackup' || parsed.data) {
        const now = new Date();
        const pad = function(n) { return n < 10 ? '0' + n : n; };
        const dateStr = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
                        '_' + pad(now.getHours()) + '-' + pad(now.getMinutes());
        const backupFilename = 'Backup_App_' + dateStr + '.json';

        const jsonContent = JSON.stringify(parsed.data || parsed, null, 2);
        const blob = Utilities.newBlob(jsonContent, MimeType.PLAIN_TEXT, backupFilename);
        const createdFile = folder.createFile(blob);

        return jsonResponse({
          status: 'success',
          success: true,
          id: createdFile.getId(),
          name: backupFilename
        });
      }
    }

    return jsonResponse({
      status: 'error',
      success: false,
      message: 'Acción POST no reconocida'
    });

  } catch (err) {
    return jsonResponse({
      status: 'error',
      success: false,
      message: err.toString()
    });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

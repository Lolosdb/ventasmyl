const fs = require('fs');
const path = 'c:/Users/Usuario/Desktop/Mis Herramientas/App Ventas con src/src/js/render/system.js';
let content = fs.readFileSync(path, 'utf8');

const regex = /<p style="font-size: 0\.65rem; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0\.05em; margin-bottom: 1rem;">Copias en la Nube<\/p>\s*<div style="display: flex; flex-direction: column; gap: 1rem;">\s*\$\{driveFiles\.map\(f => \{.*?\n\s*return `\s*<div style="padding: 1\.25rem; border: 1\.5px solid #f1f5f9; border-radius: 20px; display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: center; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba\(0,0,0,0\.05\);">/s;

const replacement = `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <p style="font-size: 0.65rem; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin: 0;">Copias en la Nube</p>
                <button onclick="handleDeleteMultipleRemoteFiles()" id="btnBulkDelete" style="display: none; align-items: center; gap: 4px; background-color: #fee2e2; color: #ef4444; border: none; padding: 6px 12px; border-radius: 8px; font-size: 0.7rem; font-weight: 800; cursor: pointer;">
                    <span class="material-icons-round" style="font-size: 16px;">delete_sweep</span>
                    <span id="bulkDeleteCount">Borrar</span>
                </button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                ${driveFiles.map(f => {
                    const sizeStr = f.size ? \`\${(f.size / 1024).toFixed(1)} KB\` : "—";
                    return \`
                    <div style="padding: 1.25rem; border: 1.5px solid #f1f5f9; border-radius: 20px; display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: center; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                        <input type="checkbox" class="backup-checkbox" value="\${f.id}" data-name="\${f.name}" onchange="toggleBulkDeleteBtn()" style="width: 22px; height: 22px; accent-color: #ef4444; cursor: pointer; flex-shrink: 0;">`;

content = content.replace(regex, replacement);

const globalFunctions = `
window.toggleBulkDeleteBtn = function() {
    const checkboxes = document.querySelectorAll('.backup-checkbox:checked');
    const btn = document.getElementById('btnBulkDelete');
    const countSpan = document.getElementById('bulkDeleteCount');
    if (checkboxes.length > 0) {
        btn.style.display = 'inline-flex';
        countSpan.innerText = 'Borrar (' + checkboxes.length + ')';
    } else {
        btn.style.display = 'none';
    }
};

window.handleDeleteMultipleRemoteFiles = async function() {
    const checkboxes = Array.from(document.querySelectorAll('.backup-checkbox:checked'));
    if (checkboxes.length === 0) return;
    if (!confirm(\`¿Seguro que quieres eliminar definitivamente \${checkboxes.length} copias de Google Drive?\`)) return;
    
    try {
        let url = localStorage.getItem('apps_script_url');
        if (!url || url.includes('/edit')) {
            url = DEFAULT_SCRIPT_URL;
            localStorage.setItem('apps_script_url', DEFAULT_SCRIPT_URL);
        }
        
        const container = document.getElementById('backupsListContainer');
        container.innerHTML = \`<div style="text-align:center; padding: 4rem 0; color: #ef4444; font-weight: 700;">Eliminando \${checkboxes.length} copias...</div>\`;

        // Sequential delete to avoid Google Drive API rate limits
        for (let i = 0; i < checkboxes.length; i++) {
            const fileId = checkboxes[i].value;
            const deleteUrl = \`\${url}\${url.includes('?') ? '&' : '?'}action=delete&id=\${fileId}\`;
            await fetch(deleteUrl);
        }

        container.innerHTML = \`<div style="text-align:center; padding: 4rem 0; color: #64748b; font-weight: 700;">Actualizando lista...</div>\`;
        await new Promise(resolve => setTimeout(resolve, 900));
        
        const modal = document.getElementById('backupsModal');
        if (modal) {
            modal.classList.remove('open');
            document.body.style.overflow = '';
        }
        setTimeout(openBackupsModal, 300);
        
    } catch (e) {
        alert("Error al eliminar múltiples copias: " + e.message);
    }
};

window.performDriveBackup = performDriveBackup;`;

content = content.replace('window.performDriveBackup = performDriveBackup;', globalFunctions);
fs.writeFileSync(path, content, 'utf8');

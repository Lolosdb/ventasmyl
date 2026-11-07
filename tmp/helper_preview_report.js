
/**
 * Genera una previsualización de las ventas del periodo elegido
 */
async function previewReport() {
    const start = document.getElementById('reportStartDate').value;
    const end = document.getElementById('reportEndDate').value;
    
    if (!start || !end) return alert("Por favor selecciona ambas fechas.");
    
    try {
        const orders = await dataManager.getOrdersInRange(start, end);
        const modal = document.getElementById('previewModal');
        const content = document.getElementById('previewContent');
        
        if (orders.length === 0) {
            content.innerHTML = '<p class="p-4 text-center text-gray">No hay ventas en este periodo.</p>';
        } else {
            let html = `
                <table class="w-full text-xs text-left">
                    <thead class="bg-slate-50 text-slate-500 uppercase font-bold">
                        <tr>
                            <th class="p-2">Fecha</th>
                            <th class="p-2">Cliente</th>
                            <th class="p-2 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
            `;
            
            orders.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(order => {
                html += `
                    <tr class="hover:bg-slate-50 transition-colors">
                        <td class="p-2">${new Date(order.date).toLocaleDateString()}</td>
                        <td class="p-2 font-medium">${order.customer}</td>
                        <td class="p-2 text-right font-bold text-blue-primary">${Math.round(order.total).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}€</td>
                    </tr>
                `;
            });
            
            html += '</tbody></table>';
            content.innerHTML = html;
        }
        
        modal.classList.add('active');
    } catch (e) {
        console.error("Error in preview:", e);
        alert("Error al cargar la previsualización: " + e.message);
    }
}

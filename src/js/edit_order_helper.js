
// Function to open modal in Edit Mode
async function openEditOrderModal(orderId) {
    try {
        const order = await dataManager.getOrderById(orderId);
        if (!order) {
            alert("Pedido no encontrado");
            return;
        }

        // Open Modal
        openNewOrderModal();

        // Change Title (Optional, but good UX)
        // document.querySelector('#newOrderModal h2').textContent = 'Editar Pedido';

        // Populate Fields
        document.getElementById('orderDate').value = order.date; // already YYYY-MM-DD from input or saved
        // If saved as ISO YYYY-MM-DD
        if (order.dateISO && order.dateISO.includes('T')) {
            document.getElementById('orderDate').value = order.dateISO.split('T')[0];
        } else if (order.date) {
            // Check format. If DD/MM/YYYY convert to YYYY-MM-DD for input
            const parts = order.date.split('/');
            if (parts.length === 3) {
                document.getElementById('orderDate').value = `${parts[2]}-${parts[1]}-${parts[0]}`;
            } else {
                document.getElementById('orderDate').value = order.date;
            }
        }

        document.getElementById('orderId').value = order.id;
        document.getElementById('orderId').setAttribute('readonly', 'true'); // Maybe lock ID on edit? User asked to edit ID manually though. let's leave it open but be careful.
        // Actually user might want to edit ID? "el número del pedido quiero poder meterlo...". 
        // If they change ID, it becomes a new order effectively unless we delete old.
        // For simplicity, let's assume ID is key and immutable for now, OR let them change it but handle the key change (delete old, create new).
        // Let's stick to simple UPDATE first. If they change ID, it might duplicate.
        // Safest: set readonly or warn. 
        // Let's leave it editable as per previous request, but we need to know the ORIGINAL ID to delete if changed.
        // Store original ID in a hidden attribute or variable.
        document.getElementById('orderId').dataset.originalId = order.id;


        document.getElementById('orderClient').value = order.shop;
        document.getElementById('orderAmount').value = order.amount;
        document.getElementById('orderNoTampo').value = order.noTampo || '';
        document.getElementById('orderFacturadoTodo').value = order.facturadoTodo || '';
        document.getElementById('orderComments').value = order.comments || '';

        // Handle Switch? Not stored in order, it's a transient action "Cliente Nuevo?". Reset it.
        document.getElementById('isNewClientSwitch').checked = false;

        // SHOW DELETE BUTTON for existing orders
        const btnDelete = document.getElementById('btnDeleteOrder');
        if (btnDelete) {
            btnDelete.style.display = 'block'; // Or 'flex' if it has flex children
            btnDelete.onclick = window.deleteCurrentOrder; // Ensure binding if global
        }

    } catch (e) {
        console.error(e);
        alert("Error al cargar pedido");
    }
}

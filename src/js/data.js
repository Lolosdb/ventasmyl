// Datos simulados

const appData = {
    currentDate: new Date(),
    ventasMes: {
        total: 8644,
        currency: '€',
        objetivo3Porciento: 10710,
        porcentajeActual: 81
    },
    tendencia: [
        { mes: 'AUG', valor: 4000 },
        { mes: 'SEP', valor: 5500 },
        { mes: 'OCT', valor: 4800 },
        { mes: 'NOV', valor: 6200 },
        { mes: 'DEC', valor: 7100 },
        { mes: 'JAN', valor: 8644 }
    ],
    stats: {
        clientesActivos: 19,
        pedidosMes: 19
    },
    topClientes: [
        { rank: 1, nombre: 'TOLON TOLON', importe: 1376, subida: true },
        { rank: 2, nombre: 'TV JAIME', importe: 1319, subida: true },
        { rank: 3, nombre: 'SUSANA PAPELERIA Y REGALO', importe: 686, subida: true },
        { rank: 4, nombre: 'LA CASA DE JULIA', importe: 640, subida: true },
        { rank: 5, nombre: 'AELIA DUTY FREE - OVIEDO', importe: 607, subida: true },
    ],
    objetivos: [
        { porcentaje: '3%', meta: 529149, actual: 0, diferencia: -529149 },
        { porcentaje: '4%', meta: 558549, actual: 0, diferencia: -558549 },
        { porcentaje: '5%', meta: 587945, actual: 0, diferencia: -587945 }
    ]
};

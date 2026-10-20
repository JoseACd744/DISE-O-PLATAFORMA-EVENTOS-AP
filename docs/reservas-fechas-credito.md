# Reservas por fecha, crédito y abonos

Implementación en la rama main. No incluye componentes ni endpoints SUNAT.

- El ícono Registrar abono de una proforma abre su confirmación. Completar dirección, horarios y contacto antes de guardar. Abrir o cancelar no confirma la ficha.
- Reserva a crédito permite confirmar sin exigir abono. El saldo y los controles Completado/Pendiente/Parcial siguen calculándose con los pagos reales.
- Agregar fecha crea otra pestaña con pedido, dirección, horarios, movilidad, precio, observaciones y abono propios. El cliente, el crédito y el estado de confirmación son comunes. La nueva fecha empieza con un día de movilidad.
- Cada fecha se guarda como una ficha operativa vinculada a la misma reserva. Los listados, disponibilidad, logística, pagos e impresión de fichas siguen operando por fecha. Las fechas existentes se eliminan desde su ficha; el editor permite quitar únicamente fechas aún no guardadas.
- Proforma y contrato reúnen las fechas de la reserva, sus importes y observaciones. Los precios conservan el desglose cotizado. Una diferencia sin motivo debe corregirse antes de imprimir.
- Confirmación y primer abono se guardan en una transacción. Los guardados de varias fechas son atómicos. Los identificadores de operación evitan duplicar pagos/reservas tras una respuesta perdida.

## Backend y migración

Backend: C:/Users/JOSE/Desktop/EVENTOS-AP-BACKEND, rama main. Migración 048_reservas_fechas_credito.sql aplicada el 19/10/2026 al entorno configurado: conservadas 197 fichas, 262 abonos y 347 clientes, con los mismos importes. No se confirmaron reservas reales ni se crearon pagos de prueba en esa base. Los despliegues de frontend y backend quedan a cargo del usuario.

API: POST /fichas/reserva acepta solicitud_id, brand, grupo_id opcional y fechas (1 a 31). Cada fecha usa el payload de ficha, con id opcional para editar. PUT /fichas/:id y POST /fichas aceptan es_credito y abono_inicial con solicitud_id propio. Los abonos se validan contra el saldo de su fecha.

## Verificación

- TypeScript y compilación de frontend/backend.
- npm --prefix tests/proformas test: catálogo, cantidades, proformas, trazabilidad, stock, históricos y reservas atómicas.
- node tests/proformas/test-ui-abono-distrito.cjs: API simulada, San Isidro, abono/crédito, errores y reintento, cuatro tamaños de pantalla y dos fechas de S/450 + S/880 = S/1330, con reapertura y observaciones en ambos documentos.
- TEST_BRAND=jugueton ejecuta el mismo flujo para Juguetón.
- node tests/proformas/test-ui-ajuste.cjs conserva precios, descuentos y Solo helados.

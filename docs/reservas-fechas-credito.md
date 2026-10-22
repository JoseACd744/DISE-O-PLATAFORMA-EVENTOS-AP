# Reservas por fecha, crédito y abonos

Implementación en la rama main. No incluye componentes ni endpoints SUNAT.

- El ícono Registrar abono de una proforma abre su confirmación. Completar dirección, horarios y contacto antes de guardar. Abrir o cancelar no confirma la ficha.
- Reserva a crédito permite confirmar sin exigir abono. El saldo y los controles Completado/Pendiente/Parcial siguen calculándose con los pagos reales.
- El evento puede ser de un día o un intervalo Desde/Hasta. Se guarda una sola ficha con todo el periodo. El usuario elige cobrar el pedido una sola vez o por cada día; la movilidad mantiene su cantidad de días editable y ofrece aplicar uno o todos los días del intervalo.
- La disponibilidad de carritos, inflables y personal se valida en todo el intervalo, incluidos inicio y fin. Los calendarios muestran la ocupación durante esos días. Las reservas antiguas de varias fichas vinculadas conservan sus datos y se pueden editar.
- Proforma y contrato reúnen las fechas de la reserva, sus importes y observaciones. Los precios conservan el desglose cotizado. Una diferencia sin motivo debe corregirse antes de imprimir.
- Confirmación y primer abono se guardan en una transacción. Los guardados de varias fechas son atómicos. Los identificadores de operación evitan duplicar pagos/reservas tras una respuesta perdida.

## Backend y migración

Backend: C:/Users/JOSE/Desktop/EVENTOS-AP-BACKEND, rama main. Migración 048_reservas_fechas_credito.sql aplicada el 19/10/2026 al entorno configurado: conservadas 197 fichas, 262 abonos y 347 clientes, con los mismos importes. No se confirmaron reservas reales ni se crearon pagos de prueba en esa base. Los despliegues de frontend y backend quedan a cargo del usuario.

API: POST /fichas/reserva acepta solicitud_id, brand, grupo_id opcional y fechas (1 a 31). Cada fecha usa el payload de ficha, con id opcional para editar. PUT /fichas/:id y POST /fichas aceptan es_credito y abono_inicial con solicitud_id propio. Los abonos se validan contra el saldo de su fecha.

## Verificación

- TypeScript y compilación de frontend/backend.
- npm --prefix tests/proformas test: catálogo, cantidades, proformas, trazabilidad, stock, históricos y reservas atómicas.
- node tests/proformas/test-ui-abono-distrito.cjs: API simulada, San Isidro, abono/crédito, errores y reintento, cuatro tamaños de pantalla y un intervalo de cuatro días en una ficha: S/400 por el pedido + S/50 de movilidad, cobro único S/450, movilidad diaria S/600 o pedido diario S/1800; reapertura y documentos con todo el periodo.
- TEST_BRAND=jugueton ejecuta el mismo flujo para Juguetón.
- node tests/proformas/test-ui-ajuste.cjs conserva precios, descuentos y Solo helados.

## Intervalos de evento (21/10/2026)

Migración 049_intervalo_evento.sql: fecha_evento_fin y cobro_evento. Un intervalo se guarda con POST/PUT de ficha, sin generar una ficha diaria. El modo por_dia multiplica las líneas del pedido excepto movilidad, que usa dias_movilidad. El modo una_vez conserva el pedido una vez. Los precios cotizados se mantienen al cambiar modo o intervalo.

Migración 049 aplicada: 212 fichas, 288 abonos y 362 clientes conservados, con los mismos importes. La disponibilidad y los calendarios reconocen todos los días del intervalo. Logística permite asignar la ficha durante el periodo.

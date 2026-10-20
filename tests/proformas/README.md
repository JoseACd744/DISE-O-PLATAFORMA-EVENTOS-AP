# Pruebas de proformas y catálogo

Estas pruebas usan PostgreSQL en memoria. No leen `.env`, no abren conexiones a la base real y no ejecutan el servidor.

Desde la raíz del frontend:

```powershell
npm --prefix tests/proformas install --ignore-scripts
npm --prefix tests/proformas test
```

El backend se busca en `C:/Users/JOSE/Desktop/EVENTOS-AP-BACKEND`. Se puede indicar otra ubicación con la variable `EVENTOS_BACKEND_DIR`.

Se comprueban también los ajustes de cotización: motivo obligatorio, historial atómico, usuario/fecha del servidor, preservación del total anterior, compatibilidad con clientes anteriores, ausencia de duplicados por el orden JSONB y actualización del total al cambiar ítems o días de movilidad.

`test-bases.cjs` verifica históricos mensuales por marca, permisos, reemplazo sin duplicados, alquileres base de inflables, meses completos y productos individuales. La prueba visual opcional se ejecuta desde la raíz del frontend, después de compilar, con `node tests/proformas/test-ui-bases.cjs`. Usa API simulada y cierra Edge y su servidor al terminar.

Se verifican los precios y cantidades de los doce afiches de tecnopor, la ausencia de combos del Excel ajenos al pedido, los nueve distritos, la conservación de los precios existentes y que repetir la migración no duplique registros. También se ejercitan las rutas reales de fichas con todas las migraciones en una base temporal: guardado sin dirección y horarios, exclusión de proformas de los listados operativos, confirmación y descuento de stock, conflictos con rollback, eliminación de una proforma y limpieza de horarios.

`test-ui-abono-distrito.cjs` reproduce San Isidro → ícono de abono → completar/confirmar la proforma, crédito sin abono y errores con reintento. Verifica también dos fechas con pedidos y precios independientes, reapertura y observaciones en proforma/contrato. Tras compilar: `node tests/proformas/test-ui-abono-distrito.cjs`. Para Juguetón: `$env:TEST_BRAND="jugueton"` antes de ejecutarlo. Utiliza exclusivamente API simulada.

Las rutas prueban confirmación y abono en una transacción, deduplicación, sobrepago con rollback, reservas de varias fechas, membresía completa y fechas distintas. La migración 048 no convierte proformas ni registra pagos existentes.

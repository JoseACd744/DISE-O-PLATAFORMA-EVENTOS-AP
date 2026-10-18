# Pruebas de proformas y catálogo

El flujo nuevo de comprobantes tiene una prueba visual adicional (después de compilar el frontend con API local):

```powershell
$env:VITE_API_BASE_URL='http://127.0.0.1:3001/api'
npm run build
node tests/proformas/test-ui-fiscal.cjs
```

Usa Edge y una API totalmente simulada, bloquea conexiones externas y cierra navegador/servidor al terminar. Comprueba emisor elegible, revisión, confirmación, recuperación idempotente, historial, descargas, enlace privado y escritorio/móvil. Las pruebas fiscales de servidor se ejecutan en el backend con `npm run test:fiscal`; no leen `.env` ni contactan SUNAT.

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

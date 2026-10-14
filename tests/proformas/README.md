# Pruebas de proformas y catálogo

Estas pruebas usan PostgreSQL en memoria. No leen `.env`, no abren conexiones a la base real y no ejecutan el servidor.

Desde la raíz del frontend:

```powershell
npm --prefix tests/proformas install --ignore-scripts
npm --prefix tests/proformas test
```

El backend se busca en `C:/Users/JOSE/Desktop/EVENTOS-AP-BACKEND`. Se puede indicar otra ubicación con la variable `EVENTOS_BACKEND_DIR`.

Se comprueban también los ajustes de cotización: motivo obligatorio, historial atómico, usuario/fecha del servidor, preservación del total anterior, compatibilidad con clientes anteriores, ausencia de duplicados por el orden JSONB y actualización del total al cambiar ítems o días de movilidad.

Se verifican los precios y cantidades de los doce afiches de tecnopor, la ausencia de combos del Excel ajenos al pedido, los nueve distritos, la conservación de los precios existentes y que repetir la migración no duplique registros. También se ejercitan las rutas reales de fichas con todas las migraciones en una base temporal: guardado sin dirección y horarios, exclusión de proformas de los listados operativos, confirmación y descuento de stock, conflictos con rollback, eliminación de una proforma y limpieza de horarios.

# Ventas históricas y alquileres anteriores

## Ventas por mes

En Reportes, un administrador puede abrir «Ventas de meses anteriores» y guardar el importe de una marca y un mes anterior al actual. El importe corresponde exclusivamente a ventas no registradas en fichas. El editor muestra la suma de sistema más histórico. Guardar de nuevo el mismo mes reemplaza su importe; cero lo deja sin aporte.

El histórico se suma a ventas, comparaciones y cuota del mes. No genera fichas, abonos, saldos, descuentos ni una cantidad de clientes. El ticket promedio conserva únicamente las fichas reales. La serie mensual muestra ambos componentes juntos; en series diarias se informa por separado el histórico mensual porque se desconoce su distribución por días. En filtros por rango solo se incluyen históricos de meses completos contenidos en el rango. El CSV de fichas sigue exportando únicamente fichas.

## Inflables

En Inflables, pestaña Inflables, «Alquileres anteriores» permite editar la base de cada unidad física. «Nueva Unidad» incluye el mismo campo al crearla. Se admiten enteros no negativos y poner cero borra el aporte anterior. No se deben incluir alquileres que ya tengan una ficha registrada.

El ranking de Juguetón muestra por defecto «Inflables más usados · acumulado»: base anterior más fichas confirmadas de todo el historial, agrupadas por tipo. Una unidad con base 15 y tres fichas aporta 18. La tabla separa Base anterior, En fichas y Total. Desmarcar «Incluir alquileres anteriores (acumulado)» vuelve al ranking del período seleccionado, sin asignar fechas ficticias a la base. No se cuentan proformas, ni se altera disponibilidad o reservas.

En Juguetón, «Productos individuales más vendidos» reemplaza al gráfico de carritos. Cuenta cantidades de productos sueltos de fichas confirmadas del período; no cuenta contenido de paquetes. D’Onofrio conserva su gráfico de carritos y no incorpora las bases de inflables de Juguetón. Los campos y pantallas de clientes no se modificaron.

## Migración y validación

`045_bases_reportes.sql` añade `inflables.alquileres_base` con cero por defecto y crea `ventas_historicas`, con un registro por marca/mes y fecha/usuario de actualización. Se aplicó y registró el 17/10/2026. No se cargaron cifras históricas: la tabla nueva quedó vacía y las 24 unidades comienzan con base cero. Se preservaron 185 fichas, sus importes, los 336 clientes y sus bases existentes. Evidencia: `output/qa/migracion-bases-20261017.json`. Respaldo de las rutas anteriores: `output/backups/bases-reportes-20261017/`.

Se verificaron rutas reales sobre PostgreSQL aislado, autorización por marca, edición administrativa de ventas, importes/cantidades inválidos, corrección a cero, ausencia de duplicados y compatibilidad con ediciones anteriores. Se probaron 15+3=18, límites de meses completos, años bisiestos y ranking de productos sin paquetes. En Edge con API simulada se verificaron guardado, recarga, nueva unidad con base, reportes y separación entre marcas. Compilaciones de frontend y backend correctas. El usuario despliega ambos; no se publicaron servicios. Los procesos temporales se cierran al terminar las pruebas.

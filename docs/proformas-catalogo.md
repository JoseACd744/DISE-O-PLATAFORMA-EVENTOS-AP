# Proformas y catálogo de D’Onofrio

En Nueva Ficha, elegir **Cotización / proforma** permite guardar sin dirección, teléfono, tipo de evento ni horas de entrega/recojo. Se mantienen cliente, distrito, fecha de contacto y fecha tentativa del evento. Luego se edita el mismo registro, se completan los datos y se cambia a **Ficha confirmada**.

Una proforma no descuenta recursos, no bloquea equipos o personal y no aparece en rutas, reportes de venta ni impresión operativa. Al confirmar, el servidor valida los datos y la disponibilidad. La proforma comercial se puede imprimir desde la ficha.

La presentación del pedido permite escoger Carrito, Lonchera o Box tecnopor. Se conserva el catálogo existente. Las presentaciones faltantes usan el contenido de carritos; los doce paquetes de los afiches tienen sus precios específicos de tecnopor y no incluyen personal automáticamente.

Para delivery a **Mala** y **Santa Rosa** se advierte que falta la tarifa. El usuario ingresa la movilidad y la confirma expresamente. Cambiar distrito, modalidad o precio exige confirmar nuevamente. Un cero se acepta únicamente como decisión expresa para esos destinos.

## Despliegue

Los cambios requieren desplegar el frontend y el backend. La migración `041_proformas_catalogo.sql` se aplicó y quedó registrada en la base configurada el 04/10/2026, por autorización del usuario. Se verificaron los nueve destinos, los doce paquetes de los afiches y las columnas nuevas. Las 151 fichas existentes se conservaron.

La migración 041 ya está aplicada. En `C:\Users\JOSE\Desktop\EVENTOS-AP-BACKEND`, el ejecutor omitirá los archivos registrados si se revisan las demás migraciones pendientes. Compilar antes de poner en servicio el backend actualizado:

```powershell
npm run migrate
npm run build
```

La nueva migración es `src/migrations/041_proformas_catalogo.sql`; el ejecutor registra los archivos aplicados. Incluye las columnas de proforma/presentación, los nueve destinos en negrita, las presentaciones faltantes, los doce paquetes de tecnopor de las cuatro imágenes. No se ejecutan migraciones automáticamente al iniciar el servidor.

Compilar el frontend con `npm run build` y desplegar `dist` con el procedimiento habitual.

## Corrección del alcance

Los doce paquetes de las cuatro imágenes tienen toda la información necesaria. No hay datos pendientes para estos paquetes. La migración `042_corregir_catalogo_imagenes.sql` se aplicó y registró el 04/10/2026. Retiró exclusivamente los dieciséis combos del Excel agregados por error, comprobando que no se usaron en fichas. Su respaldo se conserva en `output/backups/combos-excel-retirados-20261004.json`. La migración 041 ya no incorpora esos combos en instalaciones nuevas.

Los respaldos de los cuatro archivos del backend anteriores a este cambio están en `output/backups/backend-antes-proformas-20261004.zip`, dentro del frontend.

## Validación realizada

TypeScript y compilación de ambas aplicaciones; migraciones y rutas reales probadas en PostgreSQL aislado; formulario probado con API simulada en Edge. El formulario guardó una proforma sin los datos pendientes y sumó el precio de tecnopor. Se verificó que Mala no se guarda sin decidir la movilidad. Los servidores de prueba quedaron detenidos.

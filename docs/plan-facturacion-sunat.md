# Plan de implementación de facturación SUNAT

Rama: `codex/facturacion-sunat` en frontend y backend. Inicio: 17/10/2026.

## Objetivo

Emitir facturas/boletas desde fichas mediante SEE del contribuyente, con identidad fiscal configurable, datos inmutables, numeración segura, seguimiento y descargas protegidas. No se ejecutan migraciones ni emisiones en producción durante este trabajo.

## Etapas

1. [x] Modelo fiscal, configuración por marca/emisor, cálculos y validaciones de receptor, conceptos, impuestos y pago.
2. [x] Persistencia transaccional: correlativos, idempotencia, snapshots, cola, estados y protección de fichas relacionadas.
3. [x] Adaptador directo SUNAT: XML UBL 2.1, firma, ZIP, SOAP, CDR y consulta tras incertidumbre; pruebas sin documentos reales.
4. [x] Interfaz desde fichas: historial, formulario fiscal, previsualización validada, confirmación y archivos.
5. [x] Pruebas aisladas de rutas/base/cálculos/transporte y revisión visual de escritorio/móvil; compilación de ambos repositorios.
6. [x] Documentación operativa y configuración pendiente documentada. Cambios guardados en las ramas nuevas.

## Decisiones de esta implementación

- La emisión productiva permanece deshabilitada por defecto; requiere configuración explícita por responsable. No se deducen emisores autorizados de los RUC impresos en contratos.
- Se prioriza factura/boleta individual de operación completa. Si una operación requiere anticipos, detracciones u otro tratamiento no configurado, se bloquea su emisión con explicación; no se simula cumplimiento.
- No enviar mensajes automáticamente al cliente. Ofrecer archivos al usuario autenticado.
- Backend aislado en la carpeta de trabajo de esta tarea; su checkout original en Desktop permanece intacto.
- A petición del usuario, se elige la empresa/RUC al emitir. El servidor solo acepta emisores previamente configurados por marca y congela esa elección en el comprobante.

## Resultado y evidencias

Implementada la primera versión para operación completa gravada, boleta al contado y factura al contado/crédito sin anticipos. Incluye PDF con QR e importe en letras, XML/CDR protegidos y portal privado del adquirente con enlace revocable. Las fichas vinculadas no se pueden eliminar y sus comprobantes no se regeneran con precios del catálogo.

Validación realizada:

- TypeScript y build del frontend y backend.
- 23 pruebas fiscales del backend: PostgreSQL temporal, firma criptográfica real con certificado efímero, transporte SUNAT simulado, permisos, selección de emisor, CDR, numeración, idempotencia, conservación, portal privado y bloqueo de envíos vencidos.
- Regresiones existentes de proformas/catálogo/trazabilidad/reportes contra el backend aislado, con todas sus migraciones en PostgreSQL temporal.
- Edge con API simulada: receptor inválido, cambio de emisor invalida preview, confirmación, historial, consulta y descarga, enlace privado, respuesta perdida con la misma clave, factura con cuotas, boleta, escritorio/móvil, permisos y backend aún no instalado.
- PDF renderizado y comprobado: una página con un concepto y cinco páginas con 60 conceptos; sin páginas vacías. Evidencia sintética en `output/qa/fiscal-*.png` y `output/qa/factura-prueba*`.

Limitaciones de esta entrega: no implementa notas, bajas, resúmenes diarios, anticipos separados, detracciones ni operaciones exoneradas/inafectas. Una respuesta incierta de boleta/beta requiere conciliación manual sin reenvío. No hay alertas externas por vencimiento de cola. Falta probar concurrencia en PostgreSQL de staging, validar beta oficial por cada emisor/tipo y autorizar la primera emisión real.

No se aplicó la migración 046 a producción ni se activó ningún emisor. El backend incluye `docs/facturacion-sunat.md` y `.env.fiscal.example` con configuración por empresa, credenciales separadas y continuidad de correlativos. La instalación necesita desplegar ambos repositorios y revisar las migraciones pendientes antes de ejecutarlas.

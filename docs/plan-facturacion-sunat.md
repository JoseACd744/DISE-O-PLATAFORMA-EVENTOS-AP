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
- La primera fase cubrió factura/boleta individual completa; la ampliación incorpora anticipos y su liquidación. Las detracciones y otros tratamientos no configurados siguen bloqueados con explicación.
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

Limitaciones de la primera fase, posteriormente ampliadas en el apartado siguiente: faltaban notas, bajas, resúmenes y anticipos. Se mantienen fuera del alcance las detracciones, operaciones exoneradas/inafectas y alertas externas. La validación beta oficial y la primera emisión real requieren configuración del negocio.

No se aplicó la migración 046 a producción ni se activó ningún emisor. El backend incluye `docs/facturacion-sunat.md` y `.env.fiscal.example` con configuración por empresa, credenciales separadas y continuidad de correlativos. La instalación necesita desplegar ambos repositorios y revisar las migraciones pendientes antes de ejecutarlas.

## Ampliación autorizada: anticipos, correcciones y recuperación

Se continúa en las mismas ramas `codex/facturacion-sunat`. La configuración productiva permanece deshabilitada.

1. [x] Contrastar UBL vigente para anticipos/liquidación, notas de crédito/débito, resúmenes y bajas.
2. [x] Incorporar saldo fiscal por operación, relación de anticipos con abonos y aplicación de documentos aceptados; bloquear dobles imputaciones y cambios de emisor/receptor incompatibles.
3. [x] Incorporar notas referenciadas, motivos permitidos, límites de importe y efecto fiscal confirmado por CDR.
4. [x] Incorporar resúmenes y bajas con tickets persistentes, consulta, evidencias y recuperación sin reenvíos ambiguos.
5. [x] Extender la interfaz, los PDFs, el historial y los avisos de pendientes/configuración.
6. [x] Ejecutar pruebas de regresión, escenarios completos, aislamiento y concurrencia en PostgreSQL local; documentar configuración y límites pendientes.
7. [x] Guardar los cambios revisados en commits de ambas ramas.

La validación beta oficial y la activación real dependen de los emisores/certificados del negocio. No se usan credenciales reales ni se cambia producción en esta ampliación.

### Evidencia de cierre de la ampliación — 18/10/2026

- Backend: build y 45 pruebas fiscales aprobadas, sin omisiones. Firma real con certificado efímero, NC/ND, cálculo de anticipos netos tras notas, RC/RA, tickets, CDR, reservas y recuperación sin doble envío. XSD oficial OASIS validado offline para factura, boleta, nota de crédito, nota de débito y liquidación; manifiesto de 16 esquemas con SHA-256 reproducible.
- PostgreSQL nativo efímero: 6 pruebas de concurrencia aprobadas (misma clave, claves diferentes, pagos durante emisión en ambos órdenes, anticipo duplicado y notas simultáneas). No se leyó `.env` ni se usó una base existente.
- Frontend: TypeScript y build aprobados; Edge con API simulada en escritorio/móvil cubre anticipos, liquidación, nota, resumen/ticket y rechazo visible de CDR falsa, además de los casos anteriores. PDFs nuevos inspeccionados de una página: `output/qa/nota-credito-prueba.pdf` y `output/qa/liquidacion-prueba.pdf`.
- Regresiones existentes de catálogo, proformas, stock, trazabilidad e históricos aprobadas contra el backend aislado.

Antes del uso real: configurar emisores, series y sus últimos correlativos, certificados/credenciales en el servidor, desplegar ambos repositorios y revisar/aplicar migraciones 046/047. Ejecutar beta en base separada y validar oficialmente cada operación con contabilidad. Ninguno de estos pasos productivos se ejecutó aquí.

Límites: sin detracciones ni regímenes especiales, sin alertas externas, sin aceptación beta oficial todavía. Los XSD específicos SUNAT de RC/RA no estuvieron accesibles; esas estructuras tienen pruebas locales, pero no se afirma validación XSD o aceptación SUNAT. La conciliación mediante archivo CDR firmado se limita a beta: producción exige consulta por el canal oficial o ticket existente. Las boletas individuales inciertas sin ticket quedan para revisión operativa y no se reenvían a ciegas.

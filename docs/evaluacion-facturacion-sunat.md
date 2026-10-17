# Evaluación: facturas y boletas electrónicas desde fichas

Fecha de evaluación: 16/10/2026, Perú. Alcance: investigación de fuentes oficiales y revisión estática del frontend y del backend en `C:/Users/JOSE/Desktop/EVENTOS-AP-BACKEND`. No se consultó SOL, no se emitieron documentos ni se modificó producción. Las propuestas siguientes no están implementadas.

## Conclusión

Es viable emitir desde una ficha. Requiere un módulo fiscal en el backend, además de una acción en la interfaz. La proforma actual sirve como origen comercial; no constituye por sí misma un comprobante electrónico.

Recomendación: preparar un modelo fiscal propio con un adaptador de envío. Si se elige conexión directa y el RUC está habilitado para ese SEE, el adaptador genera/firma XML y usa los servicios SUNAT. Si ya existe un proveedor de facturación, evaluar primero su integración para conservar continuidad de series y operación. La interfaz de fichas no debería depender del proveedor elegido.

## Rutas de integración

| Ruta | Funcionamiento | Evaluación para este proyecto |
|---|---|---|
| SEE del contribuyente, conexión directa | El servidor prepara XML UBL, firma, comprime, transmite y procesa respuestas. | Mayor control; asumir mantenimiento de reglas, certificado, comunicaciones y recuperación. |
| Proveedor con API | Contrato comercial y conector al servicio del proveedor. Verificar si actúa como PSE, integra OSE o presta solo software. | Menor desarrollo del transporte si incluye firma, envío y seguimiento; comprobar cobertura real, exportación y costos. |
| Facturador SUNAT, SFS | Aplicación oficial que recibe archivos TXT/JSON/XML en una carpeta y genera/firma/envía. | Posible mediante un servicio puente; menos natural para el backend web que una integración de servicios. |
| Portal SOL | Emisión operada en el portal. | Alternativa manual; no resuelve la emisión integrada desde fichas. |

El PSE puede generar y firmar por encargo; el OSE comprueba documentos y comunica resultados a SUNAT. Son funciones distintas. Debe verificarse si cada RUC tiene obligación de usar OSE antes de elegir conexión directa. Fuentes: [PSE](https://cpe.sunat.gob.pe/aliados/pse), [OSE](https://cpe.sunat.gob.pe/aliados/ose), [SFS](https://cpe.sunat.gob.pe/sistema_emision/facturador_sunat).

Los servicios documentados de emisión usan SOAP: `sendBill`, `sendSummary` y consulta de tickets con `getStatus`. La consulta integrada con credenciales de API sirve para comprobar validez y no sustituye el proceso de emisión. El envío directo requiere XML firmado y ZIP; no basta enviar el JSON de la ficha. Fuentes: [manual del programador](https://cpe.sunat.gob.pe/sites/default/files/inline-files/manual_programador%20%281%29.pdf), [manual de consulta integrada](https://cpe.sunat.gob.pe/sites/default/files/inline-files/Manual-de-Consulta-Integrada-de-Comprobante-de-Pago-por-ServicioWEB_v2_0.pdf), [comunicado UBL 2.1](https://www.sunat.gob.pe/mensajes/junio/2019/aviso-ti-120619.html).

## Lo que ya existe y lo que falta

| Área | Evidencia actual | Necesidad fiscal |
|---|---|---|
| Ficha | Cliente, marca, paquetes, productos, movilidad, personal, descuentos y abonos. `src/app/pages/FichasPage.tsx:85`. | Convertir datos comerciales a conceptos tributarios aprobados y congelarlos al emitir. |
| Cliente | `dni_ruc`, `razon_social` y dirección opcionales. `FichasPage.tsx:235`. | Tipo y número de documento, identidad fiscal validada y domicilio cuando corresponda; distinguir receptor de contacto del evento. |
| Impuesto | `aplica_igv` solo desglosa un precio que ya incluye IGV. `FichasPage.tsx:1234` y `:4779`. | Afectación, base e impuesto por concepto. Desmarcar la casilla no demuestra exoneración. |
| Emisor | Contratos contienen RUC 20556840149 y 20613544250 según marca. `src/app/lib/eventContract.ts:39`. | Configuración legal verificada por emisor; no inferir autorización desde esos textos. |
| Precios | Desglose guardado en `cotizacion_trazabilidad`, descuentos y ajustes manuales con motivo. `docs/cotizacion-trazabilidad.md`. | Reconciliación fiscal en servidor; no convertir automáticamente cualquier ajuste en una línea tributaria. |
| Conservación | Fichas editables y eliminación física en backend `src/routes/fichas.ts`. | Documento fiscal independiente; impedir borrado de la evidencia y de sus relaciones necesarias. |

El backend valida coherencia del desglose recibido, pero eso no equivale a validar el tratamiento tributario. La emisión debe releer la ficha en servidor y validar importes, receptor, emisor y conceptos. Para fichas antiguas sin desglose suficiente se requiere conciliación antes de emitir; nunca reconstruir silenciosamente el precio con el catálogo actual.

## Requisitos y reglas que condicionan el alcance

Para conexión directa se debe comprobar habilitación del emisor, situación del RUC, acceso SOL, certificado digital registrado/vigente y datos del establecimiento. La factura exige RUC del adquirente en operaciones nacionales ordinarias. El emisor debe conservar documentos y habilitar acceso web autenticado al adquirente durante un año; este plazo de acceso no sustituye las obligaciones de conservación. Fuente: [SEE del contribuyente](https://cpe.sunat.gob.pe/sistema_emision/see_contribuyente).

Factura: envío en la fecha de emisión o hasta tres días calendario contados desde el día siguiente. Una respuesta HTTP exitosa no acredita aceptación: debe interpretarse la CDR y sus observaciones. Fuente: [preguntas frecuentes SUNAT](https://cpe.sunat.gob.pe/informacion_general/preguntas_frecuentes).

Plazos diferenciados para el SEE del contribuyente, al 16/10/2026:

| Operación | Regla |
|---|---|
| Boleta individual y sus notas | Hasta cinco días calendario desde el día siguiente de emisión; después, informar mediante resumen diario dentro del plazo aplicable. |
| Resumen diario de boletas | Hasta el séptimo día calendario siguiente a emisión; agrupar documentos de la misma fecha. |
| Baja de factura no otorgada | Hasta siete días calendario desde el día siguiente de recibir CDR aceptada. |
| Baja de boleta no otorgada | Resumen con estado anulado: si ya se envió/informó, siete días desde el día siguiente de CDR aceptada; de lo contrario, desde el día siguiente de generación. |

Fuentes: [RS 244-2019, artículo 4.6](https://www.sunat.gob.pe/legislacion/superin/2019/244-2019.pdf) y [RS 114-2019, artículos 2.5 y 2.7](https://www.sunat.gob.pe/legislacion/superin/2019/114-2019.pdf). La baja no sustituye las notas para documentos ya otorgados.

Importante para la implementación: la [RS 000048-2026](https://www.sunat.gob.pe/legislacion/superin/2026/000048-2026.pdf) modifica, entre otros puntos, bajas; su vigencia general se postergó al 01/01/2027 mediante el artículo 3.4 de la [RS 000143-2026](https://www.sunat.gob.pe/legislacion/superin/2026/000143-2026.pdf). No aplicar anticipadamente las reglas futuras ni codificar un plazo único para todos los documentos. Revalidar modificatorias antes del lanzamiento.

No debe presupuestarse una homologación del contribuyente como requisito general de incorporación: la [RS 287-2017](https://www.sunat.gob.pe/legislacion/superin/2017/287-2017.pdf) eliminó ese procedimiento; las exigencias para registrarse como PSE/OSE son distintas.

La forma de pago de la factura distingue contado y crédito; crédito requiere saldo neto y vencimientos/importes de cuotas. Transferencia, Yape o efectivo son medios de cobro, no reemplazan esta clasificación. Fuente: [preguntas frecuentes SUNAT](https://cpe.sunat.gob.pe/informacion_general/preguntas_frecuentes).

Los anticipos pueden generar obligación de emitir antes de la fecha del evento. Debe acordarse su tratamiento y la aplicación al comprobante posterior para no facturar dos veces el mismo importe. La oportunidad depende de la operación, no solo del estado de la ficha. Fuente: [Reglamento de Comprobantes de Pago, artículo 5](https://www.sunat.gob.pe/legislacion/comprob/regla/capituloI.pdf).

Para alquileres y otros servicios, revisar con contabilidad si existe detracción y qué código/tasa corresponde. No asumir que helados, alquiler de inflables, movilidad y personal tienen idéntico tratamiento. [Información SUNAT sobre detracciones](https://cpe.sunat.gob.pe/factura-con-detraccion).

## Flujo propuesto en fichas

1. Abrir una ficha y seleccionar **Emitir comprobante**.
2. Elegir factura o boleta; el servidor propone el emisor permitido y permite completar el receptor fiscal sin reemplazar el contacto operativo.
3. Revisar conceptos, descuentos, impuestos, total, fecha fiscal y pago. Elegir alcance: operación completa o anticipo según reglas aprobadas.
4. Validación previa sin consumir correlativo. Presentar errores concretos en el formulario.
5. Confirmar emisión con permiso específico. El backend asigna numeración, congela datos y registra el trabajo de envío de forma transaccional.
6. Mostrar estado real, detalle de observaciones y descargas PDF/XML/CDR según disponibilidad. Para resúmenes, conservar ticket y seguimiento hasta resultado definitivo.
7. Las correcciones posteriores usan el mecanismo tributario aplicable: nota de crédito/débito o baja si procede. Editar o cancelar la ficha no anula el comprobante.

Propuesta inicial: no emitir desde proformas incompletas. La existencia de anticipos obliga a definir la regla de confirmación de ficha antes de implementarla. Una ficha podrá tener varios documentos relacionados; no permitir factura y boleta por el mismo importe sin una operación válida de corrección o distribución.

## Arquitectura propuesta

Todo el proceso fiscal vive en Express/PostgreSQL; el navegador no recibe certificado, clave privada ni credenciales SOL.

Entidades sugeridas:

- `emisores_fiscales` y `series_comprobantes`: emisor legal, establecimiento, ambiente y correlativos separados por tipo/serie.
- `comprobantes` y `comprobante_lineas`: snapshot fiscal, versión de ficha, receptor, monedas, importes decimales, afectación y vínculos con anticipos/notas.
- `comprobante_envios` y `outbox_fiscal`: intentos, tickets, códigos, próximas consultas y vencimientos.
- `comprobante_archivos` y `auditoria_fiscal`: XML firmado, ZIP, CDR, PDF, integridad, autor y eventos.

Controles de implementación:

- Restricción única de emisor/tipo/serie/número y asignación con bloqueo transaccional. Clave idempotente para doble clic y reintentos.
- En caso de timeout, consultar el resultado del documento enviado antes de crear otro correlativo; el mismo envío conserva identidad y contenido.
- Cola persistente y proceso de seguimiento recuperable tras reinicio; no depender de que el usuario mantenga la pantalla abierta.
- Separar estado técnico del envío de estado tributario. Incluir pendientes, aceptación con observaciones, rechazo e incertidumbre de comunicación.
- Cálculo decimal en servidor, redondeo por línea, distribución explícita de descuentos globales y conciliación de totales.
- Versionado para detectar cambios entre previsualización y emisión. La ficha puede seguir cambiando operativamente; el comprobante conserva su snapshot.
- Prohibir eliminación en cascada de documentación fiscal; almacenar archivos de forma durable y con acceso autorizado.
- El backend actual genera URLs públicas para archivos subidos (`src/routes/upload.ts:100`). No reutilizar automáticamente ese patrón para XML, CDR o datos fiscales del cliente.
- Permisos de emitir/corregir, separación de ambientes, protección de credenciales y alertas por vencimiento del certificado o de envíos pendientes.

## Plan y validación

1. Definir emisores, SEE permitido, series existentes, proveedor actual, tratamiento de productos/servicios y anticipos.
2. Implementar datos fiscales, cálculos y previsualización con API simulada, sin envíos reales.
3. Integrar un adaptador y probar generación/firma, respuestas, tickets y recuperación en ambiente de pruebas. El beta no acredita por sí solo habilitación productiva ni validez tributaria.
4. Validar una operación completa por cada emisor y tipo, además de crédito, anticipo/saldo, descuentos, rechazo y corrección.
5. Activar con configuración revisada y una emisión real expresamente autorizada; conciliar contra el canal tributario y entregar los archivos correspondientes.

Pruebas imprescindibles: doble clic concurrente, timeout tras recepción remota, reinicio del worker, series por emisor, edición simultánea, cambio posterior del catálogo, documento del cliente inválido, certificado vencido, diferencia de céntimos, baja/nota y acceso a archivos. En boletas por resumen, verificar también estados y resultados individuales dentro del lote.

El beta oficial prueba estructuras, no consistencia completa de datos; no admite pruebas de carga, envíos masivos simultáneos ni documentos reales. Hacer las pruebas de concurrencia/carga contra un simulador propio. Fuente: [restricciones beta SUNAT](https://cpe.sunat.gob.pe/noticias/servicio-beta-para-realizar-pruebas-ubl-21).

El costo y plazo no están cerrados: dependen de número de RUC, volumen, proveedor o conexión directa, anticipos, detracciones y alcance de correcciones. Comparar costo total de desarrollo/operación y no solo tarifa por comprobante. No se ha seleccionado ni cotizado un proveedor.

## Información pendiente para cerrar especificación

- RUC y razón social legal de quien emitirá por cada marca; ¿uno o dos emisores?
- Sistema/proveedor usado actualmente, series y últimos correlativos; volumen mensual aproximado.
- Certificado vigente y SEE habilitado/obligatorio por cada RUC; verificar en SOL con el responsable, sin compartir claves por chat.
- Tratamiento contable de anticipos, cancelaciones, cambios de importe, alquiler y conceptos mixtos.
- Quién puede emitir, qué recibirá el cliente y qué canal se usará para entregarlo.

Esta evaluación deja preparado el alcance para elegir la vía de integración; no autoriza ni realiza emisiones, migraciones o despliegues.

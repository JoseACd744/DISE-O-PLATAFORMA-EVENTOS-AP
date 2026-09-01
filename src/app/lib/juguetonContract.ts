export interface JuguetonContractItem {
  descripcion: string;
  cantidad?: number;
  monto?: number;
}

export interface JuguetonContractData {
  numero: string;
  fechaEmision: string;
  clienteNombre: string;
  clienteDocumento: string;
  clienteEmail: string;
  clienteTelefono: string;
  tipoEvento: string;
  fechaEvento: string;
  direccionEvento: string;
  horarioEvento: string;
  duracionEvento: string;
  incluyePersonal: boolean;
  items: JuguetonContractItem[];
  total: number;
  abonado: number;
  saldo: number;
}

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatMoney = (value: number) =>
  `S/ ${value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function buildJuguetonContractHtml(data: JuguetonContractData): string {
  const cliente = escapeHtml(data.clienteNombre || "________________________");
  const documento = escapeHtml(data.clienteDocumento || "________________");
  const correo = escapeHtml(data.clienteEmail || "________________________");
  const telefono = escapeHtml(data.clienteTelefono || "________________");
  const filasDetalle = data.items.length > 0
    ? data.items.map((item) => `
        <li>
          <span>${item.cantidad && item.cantidad > 1 ? `${item.cantidad} x ` : ""}${escapeHtml(item.descripcion)}</span>
          ${typeof item.monto === "number" && item.monto > 0 ? `<strong>${formatMoney(item.monto)}</strong>` : ""}
        </li>
      `).join("")
    : `<li><span>Servicio según ficha de evento</span></li>`;

  return `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Contrato Juguetón ${escapeHtml(data.numero)}</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; background: #e5e7eb; color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 11.5pt; line-height: 1.34; }
        .actions { position: sticky; top: 0; z-index: 10; display: flex; justify-content: center; gap: 10px; padding: 12px; background: rgba(17, 24, 39, .94); }
        .actions button { border: 0; border-radius: 8px; padding: 10px 18px; cursor: pointer; font-weight: 700; }
        .actions .primary { background: #EF8022; color: white; }
        .actions .secondary { background: white; color: #111827; }
        .page { width: 210mm; min-height: 297mm; margin: 12px auto; padding: 18mm 20mm 17mm; background: white; page-break-after: always; position: relative; }
        .page:last-of-type { page-break-after: auto; }
        .header { display: grid; grid-template-columns: 150px 1fr; align-items: center; gap: 24px; margin-bottom: 20px; }
        .logo { width: 132px; height: 70px; object-fit: contain; }
        .contract-number { text-align: right; font-size: 15pt; font-weight: 800; letter-spacing: .2px; }
        h1 { margin: 0 0 10px; font-size: 14pt; text-align: center; }
        h2 { margin: 17px 0 8px; font-size: 11.5pt; text-transform: uppercase; }
        p { margin: 5px 0; text-align: justify; }
        ol { margin: 7px 0 0; padding-left: 24px; }
        ol li { margin: 7px 0; padding-left: 5px; text-align: justify; }
        .service-data { margin: 7px 0 0; padding: 11px 13px; border: 1px solid #d1d5db; border-radius: 6px; background: #f9fafb; }
        .service-data div { display: grid; grid-template-columns: 165px 1fr; gap: 8px; margin: 3px 0; }
        .detail-list { margin: 7px 0 0; padding-left: 22px; }
        .detail-list li { display: flex; justify-content: space-between; gap: 20px; margin: 5px 0; }
        .payment { margin: 10px 0; padding: 12px 14px; border-left: 4px solid #EF8022; background: #fff7ed; }
        .payment-grid { display: grid; grid-template-columns: 1fr auto; gap: 5px 16px; max-width: 330px; margin-top: 8px; }
        .accounts { margin-top: 10px; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 5px; }
        .accounts strong { display: block; margin-bottom: 4px; }
        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 45px; align-items: end; margin-top: 50px; text-align: center; }
        .signature { min-height: 135px; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; }
        .signature-viewport { width: 170px; height: 78px; overflow: hidden; position: relative; }
        .signature-viewport img { position: absolute; width: 384px; height: 512px; max-width: none; left: -107px; top: -230px; }
        .signature-line { width: 100%; border-top: 1px solid #111827; padding-top: 5px; font-weight: 700; }
        .signature small { display: block; font-size: 9pt; font-weight: 600; }
        .footer { position: absolute; left: 20mm; right: 20mm; bottom: 9mm; display: flex; justify-content: space-between; color: #6b7280; font-size: 8.5pt; }
        @media print {
          @page { size: A4; margin: 0; }
          body { background: white; font-size: 10.5pt; }
          .actions { display: none; }
          .page { margin: 0; box-shadow: none; }
        }
      </style>
    </head>
    <body>
      <div class="actions">
        <button class="primary" onclick="window.print()">Imprimir / Guardar PDF</button>
        <button class="secondary" onclick="window.close()">Cerrar</button>
      </div>

      <section class="page">
        <header class="header">
          <img class="logo" src="/images/jugueton.png" alt="Juguetón" />
          <div class="contract-number">CONTRATO: N&deg;${escapeHtml(data.numero)}</div>
        </header>

        <h1>CONTRATO DE ALQUILER DE JUEGOS INFLABLES</h1>
        <p>Juguetón Inflables, con RUC 20613544250, se compromete a brindar el servicio de alquiler de inflables y complementos para el evento organizado por <strong>${cliente}</strong>.</p>

        <h2>I. Datos de las partes</h2>
        <p><strong>Arrendador:</strong> Juguetón Inflables, con RUC 20613544250, representado para este acto por Fernanda Yllescas Ruiz, Coordinadora de Ventas.</p>
        <p><strong>Arrendatario:</strong> ${cliente}, identificado(a) con DNI/CE/RUC ${documento}.</p>

        <h2>II. Objeto del contrato</h2>
        <p>El presente contrato tiene por objeto el alquiler de juegos inflables, carritos de snacks y/o servicios complementarios para su uso recreativo durante el evento organizado por ${cliente}, en ${escapeHtml(data.direccionEvento)}, el día ${escapeHtml(data.fechaEvento)}.</p>

        <h2>III. Duración del alquiler</h2>
        <p>El alquiler tendrá una duración de ${escapeHtml(data.duracionEvento)}, conforme al horario acordado: ${escapeHtml(data.horarioEvento)}.</p>

        <h2>IV. Descripción del servicio</h2>
        <div class="service-data">
          <div><strong>Cliente:</strong><span>${cliente}</span></div>
          <div><strong>DNI/CE/RUC:</strong><span>${documento}</span></div>
          <div><strong>Correo:</strong><span>${correo}</span></div>
          <div><strong>Número de contacto:</strong><span>${telefono}</span></div>
          <div><strong>Tipo de evento:</strong><span>${escapeHtml(data.tipoEvento || "No especificado")}</span></div>
          <div><strong>Fecha del evento:</strong><span>${escapeHtml(data.fechaEvento)}</span></div>
          <div><strong>Dirección de entrega:</strong><span>${escapeHtml(data.direccionEvento)}</span></div>
          <div><strong>Horario del evento:</strong><span>${escapeHtml(data.horarioEvento)}</span></div>
          <div><strong>Personal de supervisión:</strong><span>${data.incluyePersonal ? "Sí" : "No"}</span></div>
        </div>
        <p style="margin-top: 11px;"><strong>Detalle del servicio:</strong></p>
        <ul class="detail-list">${filasDetalle}</ul>

        <h2>V. Condiciones del alquiler</h2>
        <ol>
          <li><strong>Uso adecuado:</strong> El arrendatario se compromete a hacer un uso adecuado de los equipos, siguiendo todas las indicaciones de seguridad proporcionadas.</li>
          <li><strong>Prohibiciones:</strong> No se permite el ingreso de alimentos, bebidas, objetos punzocortantes, zapatos ni personas bajo efectos de alcohol o drogas en los juegos inflables. Tampoco se permite el ingreso de niños con caritas pintadas, maquillaje o productos similares. El incumplimiento generará un cargo adicional de S/ 100.00 por limpieza especializada.</li>
          <li><strong>Entrega y retiro:</strong> Juguetón Inflables será responsable de la instalación y desmontaje de los equipos, asegurando su correcto funcionamiento.</li>
        </ol>
        <div class="footer"><span>Juguetón Inflables y más</span><span>Contrato ${escapeHtml(data.numero)} - Página 1</span></div>
      </section>

      <section class="page">
        <header class="header" style="margin-bottom: 8px;">
          <img class="logo" src="/images/jugueton.png" alt="Juguetón" />
          <div class="contract-number">CONTRATO: N&deg;${escapeHtml(data.numero)}</div>
        </header>

        <h2>VI. Responsabilidad y exoneración de responsabilidad</h2>
        <ol>
          <li><strong>Daños a los equipos:</strong> El arrendatario se hace responsable de cualquier daño causado a los inflables, carritos o accesorios por uso indebido.</li>
          <li><strong>Accidentes:</strong> Juguetón Inflables no se hace responsable por accidentes, lesiones o daños que ocurran durante el uso de los equipos. El arrendatario asume la responsabilidad de supervisar su uso y respetar las indicaciones de seguridad.</li>
        </ol>

        <h2>VII. Pago y penalidades</h2>
        <div class="payment">
          <p><strong>Precio del alquiler:</strong> El costo total del servicio es de ${formatMoney(data.total)}. Para separar la fecha se requiere un adelanto y el saldo debe ser cancelado como máximo un día antes del evento o al momento de la instalación, según lo coordinado.</p>
          <div class="payment-grid">
            <span>Monto total:</span><strong>${formatMoney(data.total)}</strong>
            <span>Adelanto abonado:</span><strong>${formatMoney(data.abonado)}</strong>
            <span>Saldo pendiente:</span><strong>${formatMoney(data.saldo)}</strong>
          </div>
        </div>
        <div class="accounts">
          <strong>Métodos de pago - Distribuciones Disam EIRL</strong>
          <div>Transferencias BCP</div>
          <div>BCP: 1947106235050</div>
          <div>CCI: 1947106235050</div>
          <div>Yape: 906 729 831</div>
        </div>
        <ol start="3">
          <li><strong>Cancelaciones:</strong> En caso de cancelación por parte del arrendatario con menos de 48 horas de anticipación, se retendrá el 50% del pago como penalidad.</li>
        </ol>

        <h2>VIII. Terminación del contrato</h2>
        <p>El incumplimiento de cualquiera de las cláusulas mencionadas faculta a Juguetón Inflables a dar por terminado el contrato sin derecho a reembolso para el arrendatario. En señal de conformidad, firman ambas partes.</p>
        <p style="margin-top: 18px;"><strong>Fecha de emisión:</strong> ${escapeHtml(data.fechaEmision)}</p>

        <div class="signatures">
          <div class="signature">
            <div class="signature-viewport"><img src="/images/firma-fernanda.png" alt="Firma Fernanda Yllescas Ruiz" /></div>
            <div class="signature-line">FERNANDA YLLESCAS RUIZ</div>
            <small>COORDINADORA DE VENTAS</small>
          </div>
          <div class="signature">
            <div style="height: 78px;"></div>
            <div class="signature-line">CLIENTE: ${cliente}</div>
            <small>DNI/CE/RUC: ${documento}</small>
          </div>
        </div>
        <div class="footer"><span>RUC 20613544250</span><span>Contrato ${escapeHtml(data.numero)} - Página 2</span></div>
      </section>
    </body>
  </html>`;
}

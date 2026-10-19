// Flujo real React en Edge, API completamente simulada. Nunca carga .env ni envía a SUNAT.
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const {
  chromium,
} = require("C:/Users/JOSE/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const root = path.resolve("dist");
let browser;
const server = http.createServer((req, res) => {
  const target = path.resolve(
    root,
    "." + decodeURIComponent(req.url.split("?")[0]),
  );
  const file =
    target.startsWith(root + path.sep) &&
    fs.existsSync(target) &&
    fs.statSync(target).isFile()
      ? target
      : path.join(root, "index.html");
  res.setHeader(
    "Content-Type",
    file.endsWith(".js")
      ? "application/javascript"
      : file.endsWith(".css")
        ? "text/css"
        : file.endsWith(".png")
          ? "image/png"
          : file.endsWith(".jpg")
            ? "image/jpeg"
            : "text/html",
  );
  res.end(fs.readFileSync(file));
});
const emitterA = {
  id: "ap",
  ruc: "20556840149",
  razon_social: "EMISOR A PRUEBA",
  series: { "01": "F001", "03": "B001" },
  enabled: true,
};
const emitterB = {
  id: "otra",
  ruc: "20613544250",
  razon_social: "EMISOR B PRUEBA",
  series: { "01": "F002", "03": "B002" },
  enabled: true,
};
const ficha = {
  id: 254,
  titulo: "Evento sintético fiscal",
  brand: "donofrio",
  es_cotizacion: false,
  presentacion: "carrito",
  fecha_evento: "2026-10-17",
  fecha_reserva: "2026-10-17",
  cliente_nombre: "RECEPTOR SINTÉTICO",
  cliente_celular: "999999999",
  distrito: "Miraflores",
  direccion: "Dirección sintética",
  transporte: "delivery",
  cotizacion: 118,
  descuento: 0,
  costo_envio: 0,
  paquetes: [],
  productosSueltos: [],
  carritos: [],
  carritoIds: [],
  recursos: [],
  personal: [],
  personalIds: [],
  inflables: [],
  inflableIds: [],
  abonos: [{ id: 1, fecha: "2026-10-17", monto: 118, medio: "Efectivo" }],
};
let mode = "normal",
  docs = [],
  requests = [],
  previews = [],
  consultas = 0,
  downloads = 0,
  failOnce = false;
let resumenes = [],
  summaryCalls = 0;
const advanced = () =>
  ["advance", "settlement", "correction", "summary"].includes(mode);
const fiscalSnapshot = (tipo = "01", operacion = "total", total = 118) => ({
  emisor: emitterA,
  receptor: {
    tipo_documento: tipo === "03" ? "1" : "6",
    numero_documento: tipo === "03" ? "12345678" : "20100070970",
    razon_social: "RECEPTOR SINTÉTICO",
    direccion: "Dirección fiscal de prueba",
    email: "",
  },
  tipo,
  operacion,
  fecha_emision: "2026-10-17",
  moneda: "PEN",
  forma_pago: "Contado",
  cuotas: [],
  lineas: [
    {
      descripcion: "Servicio acordado",
      cantidad: 1,
      total,
      base: total / 1.18,
      igv: total - total / 1.18,
    },
  ],
  base: total / 1.18,
  igv: total - total / 1.18,
  total,
  afectacion: "10",
});
const errors = [];
const fiscalData = () => ({
  config: {
    enabled: mode !== "disabled",
    environment: "beta",
    emitters: [emitterA, emitterB],
    reason: mode === "disabled" ? "Falta configurar certificado y series." : "",
  },
  defaults: {
    receptor: {
      tipo_documento: "6",
      numero_documento: "20100070970",
      razon_social: "RECEPTOR SINTÉTICO",
      direccion: "Dirección fiscal de prueba",
      email: "",
    },
    lineas: [
      { key: "p", descripcion: "Servicio acordado", cantidad: 1, total: 118 },
    ],
    total: 118,
    abonado: mode === "credit" ? 0 : 118,
    version: "ficha-v1",
  },
  comprobantes: docs,
  resumenes,
  ...(advanced()
    ? {
        alerts: [
          {
            code: "TEST_PENDING",
            message: "Aviso fiscal sintético de seguimiento",
            severity: "warning",
          },
        ],
      }
    : {}),
});
const datosOriginales = fiscalData;
function datosFase2() {
  const data = datosOriginales();
  if (!advanced()) return data;
  data.defaults.total = 236;
  data.defaults.abonado = mode === "advance" ? 118 : 236;
  data.defaults.abonos = [
    { id: 1, fecha: "2026-10-17", monto: 118, disponible: mode === "advance" },
  ];
  data.defaults.ledger = {
    anticipos: mode === "settlement" ? docs : [],
    facturado: mode === "advance" ? 0 : mode === "settlement" ? 118 : 236,
    anticipado: mode === "settlement" ? 118 : 0,
    saldo: mode === "advance" ? 236 : mode === "settlement" ? 118 : 0,
    pendiente: mode === "summary",
  };
  data.defaults.operations = {
    total: mode === "advance",
    anticipo: mode === "advance",
    saldo: mode === "settlement",
    nota_credito: mode === "correction",
    nota_debito: mode === "correction",
  };
  return data;
}
async function mock(route) {
  const req = route.request(),
    url = new URL(req.url());
  const ix = url.pathname.indexOf("/api/");
  if (ix < 0) {
    if (url.hostname !== "127.0.0.1") return route.abort();
    return route.continue();
  }
  const p = url.pathname.slice(ix + 4);
  let data = [],
    status = 200;
  if (p === "/fichas") data = [ficha];
  if (p === "/fichas/254") data = ficha;
  if (p === "/fiscal") {
    if (mode === "missing")
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "not found" }),
      });
    data = datosFase2();
  }
  if (p === "/fiscal/preview") {
    const b = req.postDataJSON();
    previews.push(b);
    assert.equal(b.ficha_id, 254);
    assert.equal(b.afectacion, "10");
    assert(!("total" in b), "El cliente no impone importes fiscales");
    if (b.receptor.numero_documento === "INVALIDO") {
      status = 400;
      data = { error: "RUC del receptor inválido." };
    } else {
      const emisor = b.emisor_id === "otra" ? emitterB : emitterA;
      data = {
        preview_token: "TOKEN_PREVIEW_SINTETICO",
        snapshot: {
          emisor,
          receptor: b.receptor,
          tipo: b.tipo,
          fecha_emision: "2026-10-17",
          moneda: "PEN",
          forma_pago: b.forma_pago,
          cuotas: b.cuotas,
          lineas: [
            {
              descripcion: "Servicio acordado",
              cantidad: 1,
              total: 118,
              base: 100,
              igv: 18,
            },
          ],
          base: 100,
          igv: 18,
          total: 118,
          afectacion: "10",
        },
      };
      if (advanced()) {
        const op = b.operacion || "total",
          amount =
            op === "anticipo"
              ? 118
              : op === "saldo"
                ? 118
                : op === "nota_credito" || op === "nota_debito"
                  ? b.monto || 236
                  : 236;
        data.snapshot = {
          ...fiscalSnapshot(b.tipo, op, amount),
          emisor,
          receptor: b.receptor,
          forma_pago: b.forma_pago,
          cuotas: b.cuotas,
        };
        if (op === "saldo") {
          data.snapshot.lineas = fiscalSnapshot("01", "total", 236).lineas;
          data.snapshot.total_operacion = 236;
          data.snapshot.total_anticipos = 118;
          data.snapshot.anticipos_aplicados = [
            {
              tipo: "01",
              serie: "F001",
              numero: 1,
              total: 118,
              base: 100,
              igv: 18,
            },
          ];
        }
        if (op === "nota_credito" || op === "nota_debito")
          data.snapshot.referencia = {
            tipo: "01",
            serie: "F001",
            numero: 1,
            motivo_codigo: b.motivo_codigo,
            motivo: b.motivo,
          };
      }
    }
  }
  if (p === "/fiscal/emitir") {
    const b = req.postDataJSON(),
      key = req.headers()["idempotency-key"];
    assert(key);
    assert.equal(b.preview_token, "TOKEN_PREVIEW_SINTETICO");
    requests.push({ key, body: b });
    const emisor = b.emisor_id === "otra" ? emitterB : emitterA;
    if (!docs.length)
      docs = [
        {
          id: "42",
          tipo: b.tipo,
          serie: emisor.series[b.tipo],
          numero: 1,
          estado: "queued",
          environment: "beta",
          total: 118,
          archivos: [],
        },
      ];
    if (mode === "timeout" && !failOnce) {
      failOnce = true;
      return route.abort("failed");
    }
    data = docs[0];
    if (advanced()) {
      const op = b.operacion,
        amount =
          op === "nota_credito" || op === "nota_debito" ? b.monto || 236 : 118;
      const doc = {
        id: String(43 + docs.length),
        tipo: b.tipo,
        operacion: op,
        serie: b.tipo === "07" ? "FC01" : b.tipo === "08" ? "FD01" : "F001",
        numero: 2,
        estado: "queued",
        environment: "beta",
        total: amount,
        archivos: [],
        snapshot: fiscalSnapshot(b.tipo, op, amount),
      };
      docs.push(doc);
      data = doc;
    }
    status = 202;
  }
  if (p === "/fiscal/42/consultar") {
    consultas++;
    docs[0] = {
      ...docs[0],
      estado: "accepted",
      mensaje: "Aceptado en simulador de prueba",
      archivos: ["xml", "cdr", "pdf"],
    };
    data = docs[0];
  }
  if (p === "/fiscal/42/acceso") {
    assert.equal(req.method(), "POST");
    data = {
      url: "https://fiscal.invalid/api/fiscal-portal/42#PRIVATE_SYNTHETIC_TOKEN",
      expires_in_days: 366,
    };
  }
  if (p === "/fiscal/resumenes" && req.method() === "POST") {
    const b = req.postDataJSON();
    assert(req.headers()["idempotency-key"]);
    assert.deepEqual(b.documento_ids, ["42"]);
    summaryCalls++;
    docs[0].can_summary = false;
    resumenes = [
      {
        id: "9",
        tipo: "RC",
        identificador: "RC-20261017-1",
        estado: "pending",
        ticket: "TICKET-SINTETICO",
        documento_ids: ["42"],
        created_at: "2026-10-17",
      },
    ];
    data = resumenes[0];
  }
  if (p === "/fiscal/resumenes/9/consultar") {
    resumenes[0].estado = "accepted";
    docs[0].estado = "accepted";
    data = resumenes[0];
  }
  if (p === "/fiscal/resumenes/9/conciliar") {
    assert(req.postDataJSON().cdr_zip_base64);
    status = 403;
    data = { error: "La CDR no tiene una firma SUNAT confiable." };
  }
  if (p.startsWith("/fiscal/42/archivos/")) {
    assert(req.headers().authorization, "Descarga debe autenticar");
    downloads++;
    return route.fulfill({
      status: 200,
      contentType: "application/xml",
      body: "<documento>SINTETICO</documento>",
    });
  }
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
}
const dialog = (page) =>
  page.getByRole("dialog", { name: "Comprobantes electrónicos" });
async function open(page) {
  await page
    .getByRole("button", { name: "Comprobantes electrónicos", exact: true })
    .click();
  await dialog(page)
    .getByText("Historial de esta ficha", { exact: true })
    .waitFor();
}
async function close(page) {
  await dialog(page)
    .getByRole("button", { name: "Cerrar", exact: true })
    .last()
    .click();
  await dialog(page).waitFor({ state: "hidden" });
}
async function review(page) {
  await dialog(page)
    .getByRole("button", { name: "Revisar comprobante", exact: true })
    .click();
  await dialog(page)
    .getByText("Revisión antes de emitir", { exact: true })
    .waitFor();
}
async function fresh(page, newMode) {
  mode = newMode;
  docs = [];
  resumenes = [];
  if (mode === "settlement")
    docs = [
      {
        id: "42",
        tipo: "01",
        operacion: "anticipo",
        serie: "F001",
        numero: 1,
        estado: "accepted",
        environment: "beta",
        total: 118,
        archivos: [],
        snapshot: fiscalSnapshot("01", "anticipo", 118),
      },
    ];
  if (mode === "correction")
    docs = [
      {
        id: "42",
        tipo: "01",
        operacion: "total",
        serie: "F001",
        numero: 1,
        estado: "accepted",
        environment: "beta",
        total: 236,
        archivos: [],
        snapshot: fiscalSnapshot("01", "total", 236),
      },
    ];
  if (mode === "summary")
    docs = [
      {
        id: "42",
        tipo: "03",
        operacion: "total",
        serie: "B001",
        numero: 1,
        estado: "blocked",
        environment: "beta",
        total: 236,
        can_summary: true,
        archivos: [],
        snapshot: fiscalSnapshot("03", "total", 236),
      },
    ];
  await page.reload();
  await open(page);
}
(async () => {
  await new Promise((resolve) => server.listen(5193, "127.0.0.1", resolve));
  browser = await chromium.launch({
    headless: true,
    executablePath:
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  });
  const page = await browser.newPage({
    viewport: { width: 1365, height: 1000 },
    timezoneId: "America/Lima",
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem("authToken", "FISCAL_TEST_ONLY");
    if (!localStorage.getItem("authUser"))
      localStorage.setItem(
        "authUser",
        JSON.stringify({
          id: "synthetic",
          nombre: "PRUEBA",
          rol: "admin",
          brand: "donofrio",
        }),
      );
    localStorage.setItem("selectedBrand", "donofrio");
  });
  await page.context().route("**/*", mock);
  await page.goto("http://127.0.0.1:5193/dashboard/fichas");
  await open(page);
  const d = dialog(page);
  await d.getByLabel("Empresa que emite el comprobante").selectOption("otra");
  await d.getByLabel("Número de documento").fill("INVALIDO");
  await d
    .getByRole("button", { name: "Revisar comprobante", exact: true })
    .click();
  await d.getByRole("alert").getByText("RUC del receptor inválido.").waitFor();
  await d.getByLabel("Número de documento").fill("20100070970");
  await review(page);
  assert.equal(previews.at(-1).emisor_id, "otra");
  await d
    .getByText("Emite: EMISOR B PRUEBA · RUC 20613544250", { exact: true })
    .waitFor();
  assert(
    await d
      .getByRole("button", { name: "Emitir en pruebas", exact: true })
      .isDisabled(),
  );
  fs.mkdirSync("output/qa", { recursive: true });
  await page.screenshot({ path: "output/qa/fiscal-desktop-preview.png" });
  // Cambiar emisor invalida una vista previa ya revisada.
  await d.getByLabel("Empresa que emite el comprobante").selectOption("ap");
  assert.equal(
    await d.getByText("Revisión antes de emitir", { exact: true }).count(),
    0,
  );
  await review(page);
  assert.equal(previews.at(-1).emisor_id, "ap");
  await d.getByRole("checkbox").check();
  await d
    .getByRole("button", { name: "Emitir en pruebas", exact: true })
    .click();
  await d.getByText("Factura F001-1", { exact: true }).waitFor();
  assert.equal(requests.length, 1);
  assert.equal(
    await d
      .getByRole("button", { name: "Emitir en pruebas", exact: true })
      .count(),
    0,
  );
  await d
    .getByRole("button", { name: "Consultar estado", exact: true })
    .click();
  await d.getByText("Aceptado", { exact: true }).waitFor();
  assert.equal(consultas, 1);
  const download = page.waitForEvent("download");
  await d.getByRole("button", { name: "CDR", exact: true }).click();
  const file = await download;
  assert(file.suggestedFilename().endsWith(".xml"));
  assert.equal(downloads, 1);
  await d
    .getByRole("button", { name: "Crear enlace para cliente", exact: true })
    .click();
  assert(
    (await d.getByLabel("Enlace privado del cliente").inputValue()).includes(
      "#PRIVATE_SYNTHETIC_TOKEN",
    ),
  );
  await close(page);
  await open(page);
  await d.getByText("Factura F001-1", { exact: true }).waitFor();
  await close(page);
  // Respuesta perdida después de registrar: misma clave y mismos datos, un documento.
  await fresh(page, "timeout");
  await review(page);
  await d.getByRole("checkbox").check();
  await d
    .getByRole("button", { name: "Emitir en pruebas", exact: true })
    .click();
  await d
    .getByRole("button", { name: "Recuperar emisión", exact: true })
    .waitFor();
  assert(await d.getByLabel("Empresa que emite el comprobante").isDisabled());
  await d
    .getByRole("button", { name: "Recuperar emisión", exact: true })
    .click();
  await d.getByText("Factura F001-1", { exact: true }).waitFor();
  assert.equal(requests.at(-1).key, requests.at(-2).key);
  assert.deepEqual(requests.at(-1).body, requests.at(-2).body);
  assert.equal(docs.length, 1);
  await close(page);
  // Boleta y factura con cuotas en móvil.
  await page.setViewportSize({ width: 390, height: 844 });
  await fresh(page, "normal");
  await d.getByLabel("Tipo de comprobante").selectOption("03");
  await d.getByLabel("Documento del receptor").selectOption("1");
  await d.getByLabel("Número de documento").fill("12345678");
  await review(page);
  assert.equal(previews.at(-1).tipo, "03");
  assert.equal(previews.at(-1).forma_pago, "Contado");
  await close(page);
  await fresh(page, "credit");
  await d.getByRole("button", { name: "Añadir cuota", exact: true }).click();
  await d.getByLabel("Vencimiento 1").fill("2026-10-20");
  await d.getByLabel("Monto 1", { exact: true }).fill("118");
  await review(page);
  assert.equal(previews.at(-1).tipo, "01");
  assert.equal(previews.at(-1).forma_pago, "Credito");
  assert.deepEqual(previews.at(-1).cuotas, [
    { fecha: "2026-10-20", monto: 118 },
  ]);
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  const box = await d.boundingBox();
  assert(box.x >= 0 && box.x + box.width <= 390);
  await page.screenshot({ path: "output/qa/fiscal-mobile-preview.png" });
  await close(page);
  // Nuevos flujos: anticipos, aplicación en liquidación, notas y recuperación con ticket.
  await page.setViewportSize({ width: 1365, height: 1000 });
  await fresh(page, "advance");
  await d.getByLabel("Qué deseas emitir").selectOption("anticipo");
  await d.getByRole("checkbox", { name: /2026-10-17/ }).check();
  await review(page);
  assert.equal(previews.at(-1).operacion, "anticipo");
  assert.deepEqual(previews.at(-1).abono_ids, [1]);
  assert(!("monto" in previews.at(-1)));
  await page.screenshot({ path: "output/qa/fiscal-anticipo-preview.png" });
  await close(page);
  await fresh(page, "settlement");
  await d.getByLabel("Qué deseas emitir").selectOption("saldo");
  assert(await d.getByLabel("Empresa que emite el comprobante").isDisabled());
  await review(page);
  await d.getByText("Anticipos aplicados", { exact: true }).waitFor();
  assert.equal(previews.at(-1).operacion, "saldo");
  await page.screenshot({ path: "output/qa/fiscal-liquidacion-preview.png" });
  await close(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await fresh(page, "correction");
  await d.getByLabel("Qué deseas emitir").selectOption("nota_credito");
  await d.getByLabel("Comprobante que se corrige").selectOption("42");
  await d.getByLabel("Motivo de la nota").selectOption("09");
  await d
    .getByLabel("Sustento de la corrección")
    .fill("Disminución acordada del servicio");
  await d.getByLabel("Importe de la nota").fill("50");
  assert(await d.getByLabel("Número de documento").isDisabled());
  await review(page);
  assert.equal(previews.at(-1).tipo, "07");
  assert.equal(previews.at(-1).documento_origen_id, "42");
  assert.equal(previews.at(-1).monto, 50);
  await d.getByText("Modifica: Factura F001-1", { exact: true }).waitFor();
  await d
    .getByText("Motivo 09: Disminución acordada del servicio", { exact: true })
    .waitFor();
  await page.screenshot({ path: "output/qa/fiscal-nota-mobile-preview.png" });
  await close(page);
  await fresh(page, "summary");
  await d.getByText("Recuperación, resúmenes y bajas", { exact: true }).click();
  await d.getByRole("checkbox", { name: /B001-1/ }).check();
  await d
    .getByRole("button", { name: "Crear resumen diario", exact: true })
    .click();
  await d
    .getByText("Ticket SUNAT: TICKET-SINTETICO", { exact: true })
    .waitFor();
  assert.equal(summaryCalls, 1);
  await d.getByLabel("CDR firmada del resumen").setInputFiles({
    name: "cdr-sintetica.zip",
    mimeType: "application/zip",
    buffer: Buffer.from("SINTETICO"),
  });
  await d
    .getByRole("alert")
    .getByText("La CDR no tiene una firma SUNAT confiable.", { exact: true })
    .waitFor();
  await d
    .getByRole("button", { name: "Consultar resumen", exact: true })
    .click();
  await d.getByText("RC-20261017-1 · Aceptado", { exact: true }).waitFor();
  await close(page);
  await fresh(page, "disabled");
  await d
    .getByText("Falta configurar certificado y series.", { exact: true })
    .waitFor();
  assert.equal(
    await d
      .getByRole("button", { name: "Revisar comprobante", exact: true })
      .count(),
    0,
  );
  await close(page);
  mode = "missing";
  await page.reload();
  await page
    .getByRole("button", { name: "Comprobantes electrónicos", exact: true })
    .click();
  await d
    .getByRole("alert")
    .getByText(
      "El módulo de comprobantes aún no está disponible en este servidor. Debe desplegarse el backend de facturación.",
      { exact: true },
    )
    .waitFor();
  await close(page);
  mode = "normal";
  await page.evaluate(() =>
    localStorage.setItem(
      "authUser",
      JSON.stringify({
        id: "staff",
        nombre: "PRUEBA",
        rol: "staff",
        brand: "donofrio",
      }),
    ),
  );
  await page.reload();
  await open(page);
  assert.equal(
    await d
      .getByRole("button", { name: "Revisar comprobante", exact: true })
      .count(),
    0,
  );
  await d
    .getByText("Un administrador debe revisar y emitir el comprobante.", {
      exact: true,
    })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "UI fiscal Edge OK: emisor, receptor, preview, confirmación, historial, archivos, idempotencia, boleta/crédito, anticipos, liquidación, notas, resúmenes/tickets, rechazo de CDR no confiable, móvil, backend ausente y permisos.",
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    server.close();
  });

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
});
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
    data = fiscalData();
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
    "UI fiscal Edge OK: selección de emisor, receptor inválido, vista previa, invalidación al editar, confirmación, historial, consulta, descarga autenticada, recuperación idempotente, boleta/crédito, móvil, deshabilitado, backend ausente y permisos.",
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

import { Router, Response, NextFunction } from "express";
import { PoolClient } from "pg";
import { pool } from "../db/pool";
import { AuthenticatedRequest as Request } from "../middleware/auth";

const router = Router();

type Queryable = Pick<PoolClient, "query">;


class CotizacionRegistroError extends Error {}
const redondearCotizacion = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
function validarRegistroCotizacion(body: any) {
  const registro = body.cotizacion_registro;
  if (registro === undefined) return null; // Compatibilidad con clientes anteriores.
  const error = () => { throw new CotizacionRegistroError("El desglose de cotización es inválido. Revisa los importes antes de guardar."); };
  if (!registro || !["manual", "calculado", "sin_registro"].includes(registro.origen) || typeof registro.motivo !== "string" || registro.motivo.length > 500 || !Array.isArray(registro.lineas) || registro.lineas.length > 500) return error();
  if (typeof body.cotizacion !== "number" || !Number.isFinite(body.cotizacion) || body.cotizacion < 0) return error();
  const keys = new Set<string>();
  const lineas = registro.lineas.map((l: any) => {
    if (!l || typeof l.key !== "string" || l.key.length > 100 || keys.has(l.key) || typeof l.descripcion !== "string" || l.descripcion.length > 1000) return error();
    keys.add(l.key);
    for (const campo of ["cantidad", "precioUnitario", "descuentoMonto", "total"]) if (typeof l[campo] !== "number" || !Number.isFinite(l[campo]) || l[campo] < 0) return error();
    const bruto = redondearCotizacion(l.cantidad * l.precioUnitario);
    if (l.descuentoMonto > bruto || Math.abs(redondearCotizacion(bruto - l.descuentoMonto) - l.total) > 0.011) return error();
    return { key: l.key, descripcion: l.descripcion, cantidad: l.cantidad, precioUnitario: l.precioUnitario, descuentoMonto: l.descuentoMonto, total: l.total };
  });
  const base = redondearCotizacion(lineas.reduce((sum: number, l: any) => sum + l.total, 0));
  if (typeof registro.base !== "number" || !Number.isFinite(registro.base) || Math.abs(base - registro.base) > 0.011) return error();
  const ajuste = redondearCotizacion(body.cotizacion - base);
  if (registro.origen === "calculado" && Math.abs(ajuste) >= 0.01) return error();
  if (registro.origen === "manual" && Math.abs(ajuste) >= 0.01 && !registro.motivo.trim()) throw new CotizacionRegistroError("Indica el motivo o concepto del ajuste de Cotización Total.");
  return { origen: registro.origen, motivo: registro.motivo.trim(), cotizacion: redondearCotizacion(body.cotizacion), base, ajuste, descuentoGlobal: Number(body.descuento ?? 0), lineas };
}
async function guardarRegistroCotizacion(client: Queryable, fichaId: number, body: any, user: Request["user"], anterior?: any) {
  let registro = validarRegistroCotizacion(body);
  const previo = anterior?.cotizacion_trazabilidad;
  if (!registro) {
    // Un cliente anterior no puede dejar un motivo viejo atribuido a un importe nuevo.
    const cambiaFinanzas = (body.cotizacion !== undefined && Number(body.cotizacion) !== Number(anterior?.cotizacion))
      || (body.descuento !== undefined && Number(body.descuento) !== Number(anterior?.descuento))
      || ["paquetes", "productosSueltos", "carritoIds", "inflableIds", "recursos", "personalIds", "costo_envio", "dias_movilidad", "descuento_movilidad"].some(k => body[k] !== undefined);
    if (!previo || !cambiaFinanzas) return;
    registro = { origen: "sin_registro", motivo: "", cotizacion: Number(body.cotizacion ?? anterior.cotizacion), base: 0, ajuste: Number(body.cotizacion ?? anterior.cotizacion), descuentoGlobal: Number(body.descuento ?? anterior.descuento ?? 0), lineas: [] };
  }
  const comparable = (r: any) => r && JSON.stringify({ origen: r.origen, motivo: r.motivo, cotizacion: r.cotizacion, base: r.base, ajuste: r.ajuste, descuentoGlobal: r.descuentoGlobal, lineas: r.lineas.map((l: any) => ({ key: l.key, descripcion: l.descripcion, cantidad: l.cantidad, precioUnitario: l.precioUnitario, descuentoMonto: l.descuentoMonto, total: l.total })) });
  if (comparable(previo?.actual) === comparable(registro)) return;
  const actual = { ...registro, fecha: new Date().toISOString(), usuarioId: user?.sub ?? null, usuario: user?.nombre || user?.email || "Usuario no disponible", cotizacionAnterior: anterior ? Number(anterior.cotizacion) : null };
  const trazabilidad = { actual, historial: [...(previo?.historial ?? []), actual] };
  await client.query("UPDATE fichas SET cotizacion_trazabilidad = $2::jsonb WHERE id = $1", [fichaId, JSON.stringify(trazabilidad)]);
}

function normalizeOptionalText(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function toIsoDate(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value.toISOString().split("T")[0];
  }
  const str = String(value).trim();
  if (!str) return null;
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // Any other parseable format (e.g. full JS Date string)
  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split("T")[0];
}

function resolveFichaDates(payload: Record<string, unknown>) {
  const legacyFecha = toIsoDate(payload.fecha);
  const fechaEventoInput = toIsoDate(payload.fecha_evento);
  const fechaReservaInput = toIsoDate(payload.fecha_reserva);

  const fecha_evento = fechaEventoInput ?? legacyFecha;
  const fecha_reserva = fechaReservaInput ?? legacyFecha;

  return {
    legacyFecha,
    fecha_evento,
    fecha_reserva,
  };
}

const TIPOS_ENVIO = ["cumpleanos", "corporativo", "delivery"] as const;

function normalizeTransporte(value: unknown) {
  const normalized = normalizeOptionalText(value);
  if (normalized === null) return null;
  if (!TIPOS_ENVIO.includes(normalized as typeof TIPOS_ENVIO[number])) return undefined;
  return normalized;
}

function normalizeIdList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const ids = value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
  return Array.from(new Set(ids));
}

function mergeUniqueIds(...groups: number[][]): number[] {
  return Array.from(new Set(groups.flat().filter((id) => Number.isInteger(id) && id > 0)));
}

async function recalculateApoyoStatus(client: PoolClient, personalIds: number[]) {
  if (!personalIds.length) return;

  await client.query(
    `UPDATE personal p
        SET estado = CASE
          WHEN EXISTS (
            SELECT 1
              FROM ficha_personal fp
              INNER JOIN fichas f ON f.id = fp.ficha_id
             WHERE fp.personal_id = p.id
               AND NOT f.es_cotizacion AND COALESCE(f.fecha_evento, f.fecha) = CURRENT_DATE
          ) THEN 'ocupado'
          WHEN p.estado = 'descanso' THEN 'descanso'
          ELSE 'disponible'
        END
      WHERE p.id = ANY($1::int[])
        AND p.rol = 'apoyo'`,
    [personalIds]
  );
}

async function findApoyoConflictsByDate(
  client: Queryable,
  fechaEvento: string,
  personalIds: number[],
  excludeFichaId?: number
) {
  if (!personalIds.length) return [];

  const params: unknown[] = [personalIds, fechaEvento];
  const excludeCondition = excludeFichaId
    ? `AND fp.ficha_id <> $3`
    : "";

  if (excludeFichaId) {
    params.push(excludeFichaId);
  }

  const { rows } = await client.query(
    `SELECT fp.personal_id,
            fp.ficha_id,
            COALESCE(f.fecha_evento, f.fecha) AS fecha_evento,
            COALESCE(p.nombre_completo, p.nombre) AS personal_nombre,
            f.cliente_nombre
       FROM ficha_personal fp
       INNER JOIN fichas f ON f.id = fp.ficha_id
       INNER JOIN personal p ON p.id = fp.personal_id
      WHERE fp.personal_id = ANY($1::int[])
        AND NOT f.es_cotizacion AND COALESCE(f.fecha_evento, f.fecha) = $2::date
        AND p.rol = 'apoyo'
        ${excludeCondition}
      ORDER BY fp.personal_id, fp.ficha_id`,
    params
  );

  return rows;
}

async function findCarritoConflictsByDate(
  client: Queryable,
  fechaEvento: string,
  carritoIds: number[],
  excludeFichaId?: number
) {
  if (!carritoIds.length) return [];

  const params: unknown[] = [carritoIds, fechaEvento];
  const excludeCondition = excludeFichaId
    ? "AND fc.ficha_id <> $3"
    : "";

  if (excludeFichaId) {
    params.push(excludeFichaId);
  }

  const { rows } = await client.query(
    `SELECT fc.carrito_id,
            fc.ficha_id,
            COALESCE(f.fecha_evento, f.fecha) AS fecha_evento,
            c.modelo AS carrito_modelo,
            c.codigo AS carrito_codigo,
            f.cliente_nombre
       FROM ficha_carritos fc
       INNER JOIN fichas f ON f.id = fc.ficha_id
       INNER JOIN carritos c ON c.id = fc.carrito_id
      WHERE fc.carrito_id = ANY($1::int[])
        AND NOT f.es_cotizacion AND COALESCE(f.fecha_evento, f.fecha) = $2::date
        ${excludeCondition}
      ORDER BY fc.carrito_id, fc.ficha_id`,
    params
  );

  return rows;
}

async function findInflableConflictsByDate(
  client: Queryable,
  fechaEvento: string,
  inflableIds: number[],
  excludeFichaId?: number
) {
  if (!inflableIds.length) return [];

  const params: unknown[] = [inflableIds, fechaEvento];
  const excludeCondition = excludeFichaId ? "AND fi.ficha_id <> $3" : "";
  if (excludeFichaId) params.push(excludeFichaId);

  const { rows } = await client.query(
    `SELECT fi.inflable_id,
            fi.ficha_id,
            COALESCE(f.fecha_evento, f.fecha) AS fecha_evento,
            t.nombre AS inflable_tipo,
            i.codigo AS inflable_codigo,
            f.cliente_nombre
       FROM ficha_inflables fi
       INNER JOIN fichas f    ON f.id = fi.ficha_id
       INNER JOIN inflables i ON i.id = fi.inflable_id
       LEFT  JOIN inflable_tipos t ON t.id = i.tipo_id
      WHERE fi.inflable_id = ANY($1::int[])
        AND NOT f.es_cotizacion AND COALESCE(f.fecha_evento, f.fecha) = $2::date
        ${excludeCondition}
      ORDER BY fi.inflable_id, fi.ficha_id`,
    params
  );

  return rows;
}

// ── Stock helpers ─────────────────────────────────────────────

// Falta de stock al asignar recursos: es un error del usuario (400 con el nombre del recurso), no del servidor
class StockRecursoError extends Error {}

// Mueve el stock de un recurso en una sola sentencia (actualiza y registra el movimiento).
// delta > 0 descuenta (salida hacia la ficha); delta < 0 devuelve (entrada).
async function ajustarStockRecurso(client: PoolClient, recursoId: number, delta: number, fichaId: number) {
  if (!delta) return;
  const salida = delta > 0;
  const cantidad = Math.abs(delta);
  const { rowCount } = await client.query(
    `WITH upd AS (
       UPDATE recurso_stocks
          SET stock_actual = stock_actual ${salida ? "-" : "+"} $2, updated_at = NOW()
        WHERE recurso_id = $1 ${salida ? "AND stock_actual >= $2" : ""}
       RETURNING recurso_id, stock_actual AS stock_nuevo, stock_actual ${salida ? "+" : "-"} $2 AS stock_anterior
     )
     INSERT INTO recurso_stock_movements
       (recurso_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia)
     SELECT recurso_id, $3, $2, stock_anterior, stock_nuevo, $4, $5 FROM upd`,
    [
      recursoId,
      cantidad,
      salida ? "salida" : "entrada",
      salida ? "Asignado a ficha" : "Devuelto por cambio en ficha",
      `ficha:${fichaId}`,
    ]
  );
  if (rowCount || !salida) return; // devolver a un recurso sin fila de stock no hace nada, como antes

  // Solo en el caso de error: distinguir "sin stock registrado" de "stock insuficiente"
  const { rows } = await client.query(
    `SELECT r.recurso, rs.stock_actual
       FROM recursos r LEFT JOIN recurso_stocks rs ON rs.recurso_id = r.id
      WHERE r.id = $1`,
    [recursoId]
  );
  const nombre = rows[0]?.recurso ? `«${rows[0].recurso}»` : `el recurso #${recursoId}`;
  if (!rows.length || rows[0].stock_actual === null) {
    throw new StockRecursoError(`No hay stock registrado para ${nombre}. Regístralo en Productos › Recursos o quítalo de la ficha.`);
  }
  const disponible = Number(rows[0].stock_actual);
  throw new StockRecursoError(
    `No hay stock suficiente de ${nombre}: ${disponible === 1 ? "queda 1" : `quedan ${disponible}`} y se ${cantidad === 1 ? "pidió 1" : `pidieron ${cantidad}`}. Baja la cantidad o quítalo de la ficha.`
  );
}

// Cantidad total por recurso (una ficha podría repetir el mismo recurso en dos filas)
function cantidadesPorRecurso(filas: { recurso_id: number | null; cantidad: number }[]) {
  const map = new Map<number, number>();
  for (const f of filas) {
    if (!f.recurso_id) continue;
    map.set(Number(f.recurso_id), (map.get(Number(f.recurso_id)) ?? 0) + Number(f.cantidad));
  }
  return map;
}

// Aplica al stock solo la diferencia entre lo que tenía la ficha y lo que tiene ahora.
// Antes se devolvía todo y se volvía a descontar en cada guardado, aunque nada cambiara.
async function aplicarDiferenciaStock(
  client: PoolClient,
  fichaId: number,
  antes: { recurso_id: number | null; cantidad: number }[],
  despues: { recurso_id: number | null; cantidad: number }[]
) {
  const prev = cantidadesPorRecurso(antes);
  const next = cantidadesPorRecurso(despues);
  const ids = Array.from(new Set([...prev.keys(), ...next.keys()])).sort((a, b) => a - b);
  // Primero las devoluciones, para que liberen stock antes de descontar
  const deltas = ids.map((id) => ({ id, delta: (next.get(id) ?? 0) - (prev.get(id) ?? 0) }));
  for (const { id, delta } of deltas.filter((d) => d.delta < 0)) await ajustarStockRecurso(client, id, delta, fichaId);
  for (const { id, delta } of deltas.filter((d) => d.delta > 0)) await ajustarStockRecurso(client, id, delta, fichaId);
}

// ── Inserción de líneas en bloque (una sentencia por tabla en vez de una por fila) ──

type LineaDescuento = { tipo: string; valor: number };

async function insertPaquetes(client: PoolClient, fichaId: number, paquetes: any[]) {
  if (!paquetes.length) return;
  const desc = paquetes.map((p) => normalizeLineDiscount(p));
  await client.query(
    `INSERT INTO ficha_paquetes (ficha_id, paquete_id, paquete_nombre, paquete_tipo, cantidad, descuento_tipo, descuento_valor)
     SELECT $1, paquete_id, paquete_nombre, paquete_tipo, cantidad, descuento_tipo, descuento_valor
       FROM unnest($2::int[], $3::text[], $4::text[], $5::int[], $6::text[], $7::numeric[])
       WITH ORDINALITY AS t(paquete_id, paquete_nombre, paquete_tipo, cantidad, descuento_tipo, descuento_valor, ord)
      ORDER BY ord`,
    [
      fichaId,
      paquetes.map((p) => p.paqueteId ?? null),
      paquetes.map((p) => p.paqueteNombre ?? null),
      paquetes.map((p) => p.paqueteTipo ?? null),
      paquetes.map((p) => p.cantidad ?? 1),
      desc.map((d) => d.tipo),
      desc.map((d) => d.valor),
    ]
  );
}

async function insertProductosSueltos(client: PoolClient, fichaId: number, productos: any[]) {
  if (!productos.length) return;
  const desc = productos.map((p) => normalizeLineDiscount(p));
  await client.query(
    `INSERT INTO ficha_productos_sueltos (ficha_id, producto_nombre, cantidad, descuento_tipo, descuento_valor)
     SELECT $1, producto_nombre, cantidad, descuento_tipo, descuento_valor
       FROM unnest($2::text[], $3::int[], $4::text[], $5::numeric[])
       WITH ORDINALITY AS t(producto_nombre, cantidad, descuento_tipo, descuento_valor, ord)
      ORDER BY ord`,
    [
      fichaId,
      productos.map((p) => p.productoNombre),
      productos.map((p) => p.cantidad ?? 1),
      desc.map((d) => d.tipo),
      desc.map((d) => d.valor),
    ]
  );
}

// ficha_carritos / ficha_inflables: ids + descuento por id
async function insertIdsConDescuento(
  client: PoolClient,
  tabla: "ficha_carritos" | "ficha_inflables",
  columna: "carrito_id" | "inflable_id",
  fichaId: number,
  ids: unknown[],
  descuentos: Map<number, LineaDescuento>
) {
  if (!ids.length) return;
  const desc = ids.map((id) => descuentos.get(Number(id)) ?? { tipo: "porcentaje", valor: 0 });
  await client.query(
    `INSERT INTO ${tabla} (ficha_id, ${columna}, descuento_tipo, descuento_valor)
     SELECT $1, id, descuento_tipo, descuento_valor
       FROM unnest($2::int[], $3::text[], $4::numeric[]) WITH ORDINALITY AS t(id, descuento_tipo, descuento_valor, ord)
      ORDER BY ord
     ON CONFLICT DO NOTHING`,
    [fichaId, ids.map((id) => Number(id)), desc.map((d) => d.tipo), desc.map((d) => d.valor)]
  );
}

async function insertPersonal(client: PoolClient, fichaId: number, personalIds: number[], previous: Array<{ personal_id: number; precio_cotizado: number | string }> = []) {
  if (!personalIds.length) return;
  await client.query(
    `INSERT INTO ficha_personal (ficha_id, personal_id, precio_cotizado)
     SELECT $1, p.id, COALESCE(saved.precio, p.precio) FROM personal p
     LEFT JOIN unnest($3::int[], $4::numeric[]) AS saved(id, precio) ON saved.id = p.id
     WHERE p.id = ANY($2::int[])
     ON CONFLICT DO NOTHING`,
    [fichaId, personalIds, previous.map(p => p.personal_id), previous.map(p => p.precio_cotizado)]
  );
}

class RecursoInvalidoError extends Error {}

// Resuelve los nombres que faltan con una sola consulta y deja las filas listas para insertar
async function prepararRecursos(client: PoolClient, recursos: any[]) {
  const sinNombre = recursos
    .filter((r) => !r.recursoNombre && r.recursoId)
    .map((r) => Number(r.recursoId));
  const nombres = new Map<number, string>();
  if (sinNombre.length) {
    const { rows } = await client.query("SELECT id, recurso FROM recursos WHERE id = ANY($1::int[])", [sinNombre]);
    for (const row of rows) nombres.set(Number(row.id), row.recurso);
  }
  return recursos.map((rec) => {
    const recursoId: number | null = rec.recursoId ?? null;
    let recursoNombre: string | null = rec.recursoNombre ?? null;
    if (!recursoNombre && recursoId) {
      recursoNombre = nombres.get(Number(recursoId)) ?? null;
      if (!recursoNombre) throw new RecursoInvalidoError(`Recurso ${recursoId} not found`);
    }
    if (!recursoNombre) throw new RecursoInvalidoError("recursoNombre is required for each recurso");
    const desc = normalizeLineDiscount(rec);
    return { recurso_id: recursoId, recurso_nombre: recursoNombre, cantidad: Number(rec.cantidad ?? 1), desc };
  });
}

async function insertRecursos(client: PoolClient, fichaId: number, filas: Awaited<ReturnType<typeof prepararRecursos>>) {
  if (!filas.length) return;
  await client.query(
    `INSERT INTO ficha_recursos (ficha_id, recurso_id, recurso_nombre, cantidad, descuento_tipo, descuento_valor)
     SELECT $1, recurso_id, recurso_nombre, cantidad, descuento_tipo, descuento_valor
       FROM unnest($2::int[], $3::text[], $4::int[], $5::text[], $6::numeric[])
       WITH ORDINALITY AS t(recurso_id, recurso_nombre, cantidad, descuento_tipo, descuento_valor, ord)
      ORDER BY ord`,
    [
      fichaId,
      filas.map((f) => f.recurso_id),
      filas.map((f) => f.recurso_nombre),
      filas.map((f) => f.cantidad),
      filas.map((f) => f.desc.tipo),
      filas.map((f) => f.desc.valor),
    ]
  );
}

// ── Helpers: fichas con todos sus datos anidados ──────────────


// Columnas de la ficha tal como las devuelven la lista y el detalle
const FICHA_COLUMNS_SQL = `
  f.*,
  COALESCE(f.fecha_evento, f.fecha) AS fecha_evento,
  COALESCE(f.fecha_reserva, f.fecha) AS fecha_reserva,
  CASE
    WHEN c.id IS NULL THEN NULL
    ELSE json_build_object(
      'id', c.id,
      'nombre', c.nombre,
      'razon_social', c.razon_social,
      'dni_ruc', c.dni_ruc,
      'telefono', c.telefono,
      'status', c.status
    )
  END AS cliente,
  COALESCE(ab.total_abonado, 0) AS total_abonado,
  (f.cotizacion * (1 - f.descuento / 100)) AS total,
  (f.cotizacion * (1 - f.descuento / 100) - COALESCE(ab.total_abonado, 0)) AS saldo,
  u.nombre AS created_by_nombre`;

const FICHA_FROM_SQL = `
  FROM fichas f
  LEFT JOIN clients c ON c.id = f.cliente_id
  LEFT JOIN users u ON u.id = f.created_by
  LEFT JOIN LATERAL (
    SELECT SUM(a.monto) AS total_abonado FROM abonos a WHERE a.ficha_id = f.id
  ) ab ON TRUE`;

// Consultas de las tablas hijas para un conjunto de fichas. `__ficha_id` solo sirve para
// repartir las filas y se quita antes de responder, así la forma de cada fila es la misma de siempre.
function childQueries(idsSql: string) {
  return [
    `SELECT * FROM ficha_paquetes WHERE ficha_id = ANY(${idsSql}) ORDER BY ficha_id, id`,
    `SELECT * FROM ficha_productos_sueltos WHERE ficha_id = ANY(${idsSql}) ORDER BY ficha_id, id`,
    `SELECT c.*, fc.descuento_tipo, fc.descuento_valor, fc.ficha_id AS __ficha_id
       FROM carritos c
       INNER JOIN ficha_carritos fc ON fc.carrito_id = c.id
      WHERE fc.ficha_id = ANY(${idsSql})`,
    `SELECT i.*, t.nombre AS tipo_nombre, t.precio_alquiler, t.imagen_url, t.dimensiones, t.edad_minima,
            fi.descuento_tipo, fi.descuento_valor, fi.ficha_id AS __ficha_id
       FROM inflables i
       INNER JOIN ficha_inflables fi ON fi.inflable_id = i.id
       LEFT JOIN inflable_tipos t ON t.id = i.tipo_id
      WHERE fi.ficha_id = ANY(${idsSql})`,
    `SELECT p.*, fp.precio_cotizado, fp.ficha_id AS __ficha_id
       FROM personal p
       INNER JOIN ficha_personal fp ON fp.personal_id = p.id
      WHERE fp.ficha_id = ANY(${idsSql})`,
    `SELECT * FROM abonos WHERE ficha_id = ANY(${idsSql}) ORDER BY ficha_id, fecha, id`,
    `SELECT fr.id, fr.recurso_id, fr.recurso_nombre, fr.cantidad,
            fr.descuento_tipo, fr.descuento_valor,
            r.sku, r.precio, fr.ficha_id AS __ficha_id
       FROM ficha_recursos fr
       LEFT JOIN recursos r ON r.id = fr.recurso_id
      WHERE fr.ficha_id = ANY(${idsSql})
      ORDER BY fr.ficha_id, fr.id`,
  ];
}

function groupByFicha(rows: any[], key: "ficha_id" | "__ficha_id") {
  const map = new Map<number, any[]>();
  for (const row of rows) {
    const fichaId = Number(row[key]);
    if (key === "__ficha_id") delete row.__ficha_id;
    const list = map.get(fichaId);
    if (list) list.push(row);
    else map.set(fichaId, [row]);
  }
  return map;
}

function attachChildren(fichas: any[], childResults: any[][]) {
  const [paquetes, productos, carritos, inflables, personal, abonos, recursos] = [
    groupByFicha(childResults[0], "ficha_id"),
    groupByFicha(childResults[1], "ficha_id"),
    groupByFicha(childResults[2], "__ficha_id"),
    groupByFicha(childResults[3], "__ficha_id"),
    groupByFicha(childResults[4], "__ficha_id"),
    groupByFicha(childResults[5], "ficha_id"),
    groupByFicha(childResults[6], "__ficha_id"),
  ];
  return fichas.map((f) => {
    const fichaCarritos = carritos.get(f.id) ?? [];
    const fichaInflables = inflables.get(f.id) ?? [];
    const fichaPersonal = personal.get(f.id) ?? [];
    return {
      ...f,
      paquetes: paquetes.get(f.id) ?? [],
      productosSueltos: productos.get(f.id) ?? [],
      carritoIds: fichaCarritos.map((c) => c.id),
      carritos: fichaCarritos,
      inflableIds: fichaInflables.map((i) => i.id),
      inflables: fichaInflables,
      personalIds: fichaPersonal.map((p) => p.id),
      personal: fichaPersonal,
      abonos: abonos.get(f.id) ?? [],
      recursos: recursos.get(f.id) ?? [],
    };
  });
}

// Ids validados como enteros, así pueden ir literales en el SQL: permite mandar todas las
// consultas en un solo envío (el protocolo con parámetros no admite varias sentencias).
function idsLiteral(ids: number[]) {
  const safe = ids.filter((id) => Number.isInteger(id) && id > 0);
  return `'{${safe.join(",")}}'::int[]`;
}

// Agrega los datos anidados a fichas ya leídas: una sola ida y vuelta a la base
async function withChildren(db: Queryable, fichas: any[]) {
  if (!fichas.length) return [];
  const results = (await db.query(childQueries(idsLiteral(fichas.map((f) => f.id))).join(";\n"))) as unknown as { rows: any[] }[];
  return attachChildren(fichas, results.map((r) => r.rows));
}

// Ficha completa en una sola ida y vuelta (ficha + tablas hijas en el mismo envío)
async function getFichaDetail(id: number, db: Queryable = pool) {
  if (!Number.isInteger(id) || id <= 0) return null;
  const ids = idsLiteral([id]);
  const results = (await db.query(
    [`SELECT ${FICHA_COLUMNS_SQL} ${FICHA_FROM_SQL} WHERE f.id = ${id}`, ...childQueries(ids)].join(";\n")
  )) as unknown as { rows: any[] }[];
  const [fichaResult, ...children] = results;
  if (!fichaResult.rows.length) return null;
  return attachChildren(fichaResult.rows, children.map((r) => r.rows))[0];
}

// Un usuario no-admin solo puede leer o modificar fichas de su propia marca.
// Devuelve false y responde el error cuando no corresponde.
async function assertFichaDeLaMarca(req: Request, res: Response, fichaId: number): Promise<boolean> {
  if (!Number.isFinite(fichaId)) {
    res.status(400).json({ error: "Invalid ficha id" });
    return false;
  }
  const { rows } = await pool.query("SELECT brand FROM fichas WHERE id = $1", [fichaId]);
  if (!rows.length) {
    res.status(404).json({ error: "Ficha not found" });
    return false;
  }
  if (req.user && req.user.rol !== "admin" && rows[0].brand !== req.user.brand) {
    res.status(403).json({ error: "No tienes permiso sobre esta ficha" });
    return false;
  }
  return true;
}

async function getDescuentoMax(): Promise<number> {
  const { rows } = await pool.query("SELECT value FROM settings WHERE key = 'descuento_max'");
  return rows.length ? Number(rows[0].value) : 10;
}

// Descuento por línea: 'porcentaje' (0-100) o 'monto' (soles sobre el subtotal de la línea)
function normalizeLineDiscount(source: unknown): { tipo: string; valor: number } {
  const raw = (source ?? {}) as Record<string, unknown>;
  const tipo = raw.descuentoTipo === "monto" || raw.descuento_tipo === "monto" ? "monto" : "porcentaje";
  const valor = Number(raw.descuentoValor ?? raw.descuento_valor ?? 0);
  if (!Number.isFinite(valor) || valor < 0) return { tipo, valor: 0 };
  return { tipo, valor: tipo === "porcentaje" ? Math.min(100, valor) : valor };
}

// Mapa id -> descuento, para inflables y carritos (que se envían como arreglo de ids)
function buildDiscountMap(entries: unknown, idKey: string): Map<number, { tipo: string; valor: number }> {
  const map = new Map<number, { tipo: string; valor: number }>();
  if (!Array.isArray(entries)) return map;
  for (const entry of entries) {
    const id = Number((entry as Record<string, unknown>)?.[idKey]);
    if (!Number.isFinite(id)) continue;
    map.set(id, normalizeLineDiscount(entry));
  }
  return map;
}

// ── GET /api/fichas?brand=&from=&to=&estado_pago= ─────────────
/**
 * @swagger
 * /fichas:
 *   get:
 *     summary: Listar fichas de servicio
 *     tags: [Fichas]
 *     parameters:
 *       - in: query
 *         name: brand
 *         schema: { $ref: '#/components/schemas/Brand' }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Ficha' }
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { brand, from, to } = req.query;
    // detalle=1 incluye paquetes, carritos, inflables, personal, abonos y recursos de cada
    // ficha (lo mismo que GET /fichas/:id) sin tener que pedirlas una por una.
    const conDetalle = req.query.detalle === "1" || req.query.detalle === "true";
    // from/to filtran por fecha del evento, o por fecha de venta con fecha_tipo=venta
    const fechaSql = req.query.fecha_tipo === "venta"
      ? "COALESCE(f.fecha_reserva, f.fecha)"
      : "COALESCE(f.fecha_evento, f.fecha)";
    const conditions: string[] = [];
    if (req.query.incluir_cotizaciones !== "1") conditions.push("NOT f.es_cotizacion");
    const values: unknown[] = [];

    // Un usuario no-admin ve todas las fichas de su marca, sin importar quién las creó
    // (hay una sola cuenta por marca y las fichas importadas no tienen created_by).
    const brandFilter = req.user && req.user.rol !== "admin" ? req.user.brand : brand;
    if (brandFilter) {
      conditions.push(`f.brand = $${values.length + 1}`);
      values.push(brandFilter);
    }
    if (from) {
      conditions.push(`${fechaSql} >= $${values.length + 1}`);
      values.push(from);
    }
    if (to) {
      conditions.push(`${fechaSql} <= $${values.length + 1}`);
      values.push(to);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    // Discount is a percentage (0-100)
    const { rows } = await pool.query(
      `SELECT ${FICHA_COLUMNS_SQL}
       ${FICHA_FROM_SQL}
       ${where}
       ORDER BY COALESCE(f.fecha_evento, f.fecha) DESC, f.id DESC`,
      values
    );
    res.json(conDetalle ? await withChildren(pool, rows) : rows);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/fichas/:id ───────────────────────────────────────
/**
 * @swagger
 * /fichas/{id}:
 *   get:
 *     summary: Obtener ficha con todos sus datos anidados
 *     tags: [Fichas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Ficha' }
 *       404:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fichaId = Number(req.params.id);
    if (!Number.isInteger(fichaId) || fichaId <= 0) { res.status(400).json({ error: "Invalid ficha id" }); return; }
    const data = await getFichaDetail(fichaId);
    if (!data) { res.status(404).json({ error: "Ficha not found" }); return; }
    // Un usuario no-admin solo puede leer fichas de su propia marca
    if (req.user && req.user.rol !== "admin" && data.brand !== req.user.brand) {
      res.status(403).json({ error: "No tienes permiso sobre esta ficha" });
      return;
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/fichas/:id/imagenes ─────────────────────────────
/**
 * @swagger
 * /fichas/{id}/imagenes:
 *   get:
 *     summary: Listar imágenes/comprobantes asociados a una ficha
 *     tags: [Fichas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   abono_id: { type: integer }
 *                   url: { type: string }
 *                   path: { type: string }
 *                   fecha: { type: string, format: date }
 *       404:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get("/:id/imagenes", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fichaId = Number(req.params.id);
    if (!(await assertFichaDeLaMarca(req, res, fichaId))) return;

    const { rows } = await pool.query(
      `SELECT id AS abono_id,
              comprobante_url AS url,
              regexp_replace(comprobante_url, '^.*/storage/v1/object/public/[^/]+/', '') AS path,
              fecha
       FROM abonos
       WHERE ficha_id = $1
         AND comprobante_url IS NOT NULL
         AND btrim(comprobante_url) <> ''
       ORDER BY fecha DESC, id DESC`,
      [fichaId]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/fichas ──────────────────────────────────────────
/**
 * @swagger
 * /fichas:
 *   post:
 *     summary: Crear ficha de servicio
 *     tags: [Fichas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Ficha' }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Ficha' }
 */
function validateDocument(body: Record<string, any>): string | null {
  if (typeof body.es_cotizacion !== "boolean") return "es_cotizacion debe ser verdadero o falso";
  if (!["carrito", "lonchera", "solo_helados", "tecnopor", "delivery"].includes(body.presentacion || "carrito")) return "Presentación inválida";
  if (body.presentacion === "solo_helados" && body.transporte !== "delivery") return "Solo helados corresponde a delivery";
  if (!String(body.distrito || "").trim()) return "Selecciona el distrito";
  if (body.transporte === "delivery" && ["mala", "santa rosa"].includes(String(body.distrito).trim().toLowerCase()) && body.movilidad_confirmada !== true) return "Define y confirma el precio de movilidad para este distrito";
  if (!body.es_cotizacion) {
    if (!String(body.direccion || "").trim() || !body.hora_entrega || (body.transporte !== "delivery" && !body.hora_recojo)) return "Completa dirección, entrega y recojo antes de confirmar la ficha";
    if (!body.tipo_evento || !String(body.cliente_celular || "").trim()) return "Completa tipo de evento y teléfono antes de confirmar";
    if (body.brand === "jugueton" && !body.hora_entrega_fin) return "Completa la hora de inicio antes de confirmar";
  }
  return null;
}

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const {
      fecha, fecha_evento, fecha_reserva, cliente_id, distrito, direccion, referencia,
      tipo_evento, titulo, hora_entrega, hora_recojo, hora_entrega_fin, hora_recojo_fin, comentarios, transporte, costo_envio,
      cliente_nombre, cliente_celular, contacto_nombre, contacto_celular,
      cotizacion, descuento, descuento_movilidad, dias_movilidad, aplica_igv, brand, es_cotizacion, presentacion, movilidad_confirmada,
      paquetes, productosSueltos, carritoIds, inflableIds, personalIds, recursos,
      inflablesDescuentos, carritosDescuentos,
    } = req.body;

    const esCotizacion = es_cotizacion === true;
    // Preserve legacy API callers; the new document flow always sends its explicit mode.
    const validationError = es_cotizacion === undefined
      ? null
      : validateDocument(req.body);
    if (validationError) { res.status(400).json({ error: validationError }); return; }
    validarRegistroCotizacion(req.body);
    const hasDiasMovilidad = Object.prototype.hasOwnProperty.call(req.body, "dias_movilidad");
    const diasMovilidad = hasDiasMovilidad ? Number(dias_movilidad) : 1;
    if (!Number.isSafeInteger(diasMovilidad) || diasMovilidad < 1 || diasMovilidad > 2147483647) {
      res.status(400).json({ error: "dias_movilidad must be a positive integer" });
      return;
    }

    const mappedDates = resolveFichaDates(req.body as Record<string, unknown>);
    const legacyFechaValue = normalizeOptionalText(fecha) ?? mappedDates.fecha_evento;
    const inflableDiscounts = buildDiscountMap(inflablesDescuentos, "inflableId");
    const carritoDiscounts = buildDiscountMap(carritosDescuentos, "carritoId");

    if (!mappedDates.fecha_evento || !mappedDates.fecha_reserva || !cliente_nombre || !brand) {
      res.status(400).json({ error: "fecha_evento, fecha_reserva, cliente_nombre and brand are required" });
      return;
    }

    const normalizedTransporte = normalizeTransporte(transporte);
    if (normalizedTransporte === undefined) {
      res.status(400).json({ error: "transporte must be cumpleanos, corporativo or delivery" });
      return;
    }

    const normalizedClienteId = normalizeOptionalText(cliente_id);
    const normalizedPersonalIds = normalizeIdList(personalIds);
    const normalizedCarritoIds = normalizeIdList(carritoIds);
    const normalizedInflableIds = normalizeIdList(inflableIds);
    const fechaEventoStr = String(mappedDates.fecha_evento);

    // Validaciones previas: son lecturas independientes, van en paralelo
    const [maxDescuento, existingClient, apoyoConflicts, carritoConflicts, inflableConflicts] = await Promise.all([
      getDescuentoMax(),
      normalizedClienteId ? pool.query("SELECT id FROM clients WHERE id = $1", [normalizedClienteId]) : null,
      esCotizacion ? [] : findApoyoConflictsByDate(pool, fechaEventoStr, normalizedPersonalIds),
      esCotizacion ? [] : findCarritoConflictsByDate(pool, fechaEventoStr, normalizedCarritoIds),
      esCotizacion ? [] : findInflableConflictsByDate(pool, fechaEventoStr, normalizedInflableIds),
    ]);

    const descuentoValue = Number(descuento ?? 0);
    if (descuentoValue > maxDescuento) {
      res.status(400).json({ error: `El descuento no puede superar el tope de ${maxDescuento}%` });
      return;
    }

    if (existingClient && !existingClient.rows.length) {
      res.status(400).json({ error: "cliente_id does not exist" });
      return;
    }

    if (apoyoConflicts.length) {
      res.status(409).json({
        error: "Personal de apoyo ya asignado en otra ficha para esa fecha_evento",
        conflicts: apoyoConflicts.map((row) => ({
          personal_id: row.personal_id,
          personal_nombre: row.personal_nombre,
          ficha_id: row.ficha_id,
          cliente_nombre: row.cliente_nombre,
          fecha_evento: row.fecha_evento,
        })),
      });
      return;
    }

    if (carritoConflicts.length) {
      res.status(409).json({
        error: "Carritos ya asignados en otra ficha para esa fecha_evento",
        conflicts: carritoConflicts.map((row) => ({
          carrito_id: row.carrito_id,
          carrito_modelo: row.carrito_modelo,
          carrito_codigo: row.carrito_codigo,
          ficha_id: row.ficha_id,
          cliente_nombre: row.cliente_nombre,
          fecha_evento: row.fecha_evento,
        })),
      });
      return;
    }

    if (inflableConflicts.length) {
      res.status(409).json({
        error: "Inflables ya asignados en otra ficha para esa fecha_evento",
        conflicts: inflableConflicts.map((row) => ({
          inflable_id: row.inflable_id,
          inflable_tipo: row.inflable_tipo,
          inflable_codigo: row.inflable_codigo,
          ficha_id: row.ficha_id,
          cliente_nombre: row.cliente_nombre,
          fecha_evento: row.fecha_evento,
        })),
      });
      return;
    }

    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO fichas
         (fecha, fecha_evento, fecha_reserva, cliente_id, distrito, direccion, referencia, tipo_evento, hora_entrega, hora_recojo,
         hora_entrega_fin, hora_recojo_fin,
         comentarios, transporte, costo_envio, cliente_nombre, cliente_celular,
          contacto_nombre, contacto_celular, cotizacion, descuento, descuento_movilidad, brand, created_by, titulo,
          aplica_igv, dias_movilidad, es_cotizacion, presentacion, movilidad_confirmada)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30) RETURNING *`,
      [
        legacyFechaValue,
        mappedDates.fecha_evento,
        mappedDates.fecha_reserva,
        normalizedClienteId,
        distrito ?? null,
        direccion ?? null,
        referencia ?? null,
        normalizeOptionalText(tipo_evento),
        hora_entrega ?? null,
        hora_recojo ?? null,
        hora_entrega_fin ?? null,
        hora_recojo_fin ?? null,
        comentarios ?? null,
        normalizedTransporte,
        costo_envio ?? 0,
        cliente_nombre,
        cliente_celular ?? null,
        contacto_nombre ?? null,
        contacto_celular ?? null,
        cotizacion ?? 0,
        descuento ?? 0,
        descuento_movilidad ?? 0,
        brand,
        req.user?.sub ?? null,
        normalizeOptionalText(titulo),
        aplica_igv === true,
        diasMovilidad,
        esCotizacion,
        presentacion || "carrito",
        movilidad_confirmada === true,
      ]
    );
    const ficha = rows[0];
    const fichaId = ficha.id;

    if (!ficha.titulo) {
      await client.query(
        `UPDATE fichas SET titulo = 'Ficha #' || LPAD(id::text, 7, '0') WHERE id = $1`,
        [fichaId]
      );
    }

    await insertPaquetes(client, fichaId, Array.isArray(paquetes) ? paquetes : []);
    await insertProductosSueltos(client, fichaId, Array.isArray(productosSueltos) ? productosSueltos : []);
    await insertIdsConDescuento(client, "ficha_carritos", "carrito_id", fichaId, normalizedCarritoIds, carritoDiscounts);
    await insertIdsConDescuento(client, "ficha_inflables", "inflable_id", fichaId, normalizedInflableIds, inflableDiscounts);
    await insertPersonal(client, fichaId, normalizedPersonalIds);

    await recalculateApoyoStatus(client, normalizedPersonalIds);

    // recursos — descontar stock al crear
    if (Array.isArray(recursos) && recursos.length) {
      let filas;
      try {
        filas = await prepararRecursos(client, recursos);
      } catch (err) {
        if (!(err instanceof RecursoInvalidoError)) throw err;
        await client.query("ROLLBACK");
        res.status(400).json({ error: err.message });
        return;
      }
      await insertRecursos(client, fichaId, filas);
      if (!esCotizacion) await aplicarDiferenciaStock(client, fichaId, [], filas);
    }

    await guardarRegistroCotizacion(client, fichaId, req.body, req.user);
    await client.query("COMMIT");
    // Se lee con la misma conexión, sin pedir otra al pool
    const data = await getFichaDetail(fichaId, client);
    res.status(201).json(data);
  } catch (err) {
    await client.query("ROLLBACK");
    if (err instanceof CotizacionRegistroError) { res.status(400).json({ error: err.message }); return; }
    if (err instanceof StockRecursoError) { res.status(400).json({ error: err.message }); return; }
    next(err);
  } finally {
    client.release();
  }
});

// ── PUT /api/fichas/:id ───────────────────────────────────────
/**
 * @swagger
 * /fichas/{id}:
 *   put:
 *     summary: Actualizar ficha de servicio
 *     tags: [Fichas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Ficha' }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Ficha' }
 */
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    const fichaId = Number(req.params.id);
    const {
      fecha, fecha_evento, fecha_reserva, cliente_id, distrito, direccion, referencia,
      tipo_evento, titulo, hora_entrega, hora_recojo, hora_entrega_fin, hora_recojo_fin, comentarios, transporte, costo_envio,
      cliente_nombre, cliente_celular, contacto_nombre, contacto_celular,
      cotizacion, descuento, descuento_movilidad, dias_movilidad, aplica_igv, brand, es_cotizacion, presentacion, movilidad_confirmada,
      paquetes, productosSueltos, carritoIds, inflableIds, personalIds, recursos,
      inflablesDescuentos, carritosDescuentos,
    } = req.body;

    validarRegistroCotizacion(req.body);
    const hasDiasMovilidad = Object.prototype.hasOwnProperty.call(req.body, "dias_movilidad");
    const diasMovilidad = hasDiasMovilidad ? Number(dias_movilidad) : 1;
    if (!Number.isSafeInteger(diasMovilidad) || diasMovilidad < 1 || diasMovilidad > 2147483647) {
      res.status(400).json({ error: "dias_movilidad must be a positive integer" });
      return;
    }

    const inflableDiscounts = buildDiscountMap(inflablesDescuentos, "inflableId");
    const carritoDiscounts = buildDiscountMap(carritosDescuentos, "carritoId");
    const hasAplicaIgv = Object.prototype.hasOwnProperty.call(req.body, "aplica_igv");
    const hasTipoEvento = Object.prototype.hasOwnProperty.call(req.body, "tipo_evento");
    const hasTitulo = Object.prototype.hasOwnProperty.call(req.body, "titulo");

    const hasLegacyFecha = Object.prototype.hasOwnProperty.call(req.body, "fecha");
    const hasFechaEvento = Object.prototype.hasOwnProperty.call(req.body, "fecha_evento");
    const hasFechaReserva = Object.prototype.hasOwnProperty.call(req.body, "fecha_reserva");
    const hasClienteId = Object.prototype.hasOwnProperty.call(req.body, "cliente_id");

    const mappedDates = resolveFichaDates(req.body as Record<string, unknown>);
    const fechaForUpdate = hasLegacyFecha
      ? normalizeOptionalText(fecha)
      : null;
    const fechaEventoForUpdate = hasFechaEvento || hasLegacyFecha
      ? mappedDates.fecha_evento
      : null;
    const fechaReservaForUpdate = hasFechaReserva || hasLegacyFecha
      ? mappedDates.fecha_reserva
      : null;
    const normalizedClienteId = hasClienteId ? normalizeOptionalText(cliente_id) : null;
    const hasTransporte = Object.prototype.hasOwnProperty.call(req.body, "transporte");
    const normalizedTransporte = hasTransporte
      ? normalizeTransporte(transporte)
      : null;

    if (normalizedTransporte === undefined) {
      res.status(400).json({ error: "transporte must be cumpleanos, corporativo or delivery" });
      return;
    }

    const hasDescuento = Object.prototype.hasOwnProperty.call(req.body, "descuento");

    await client.query("BEGIN");
    transactionOpen = true;
    // Bloquea la ficha para que dos confirmaciones no descuenten stock dos veces.
    // Validaciones previas: lecturas independientes, van en paralelo
    const [existingClient, currentFicha, maxDescuento] = await Promise.all([
      normalizedClienteId ? pool.query("SELECT id FROM clients WHERE id = $1", [normalizedClienteId]) : null,
      client.query("SELECT * FROM fichas WHERE id = $1 FOR UPDATE", [fichaId]),
      hasDescuento ? getDescuentoMax() : null,
    ]);

    if (existingClient && !existingClient.rows.length) {
      res.status(400).json({ error: "cliente_id does not exist" });
      return;
    }

    // Permission check: un usuario no-admin administra todas las fichas de su marca
    if (!currentFicha.rows.length) {
      res.status(404).json({ error: "Ficha not found" });
      return;
    }

    if (req.user?.rol !== "admin" && currentFicha.rows[0].brand !== req.user?.brand) {
      res.status(403).json({ error: "No tienes permiso para editar esta ficha" });
      return;
    }

    const effectiveDocument = { ...currentFicha.rows[0], ...req.body };
    const esCotizacion = effectiveDocument.es_cotizacion === true;
    const validationError = es_cotizacion !== undefined || currentFicha.rows[0].es_cotizacion
      ? validateDocument(effectiveDocument)
      : null;
    if (validationError) { res.status(400).json({ error: validationError }); return; }
    if (esCotizacion && !currentFicha.rows[0].es_cotizacion) {
      const paid = await client.query("SELECT 1 FROM abonos WHERE ficha_id = $1 LIMIT 1", [fichaId]);
      if (paid.rows.length) { res.status(400).json({ error: "Una ficha con abonos no puede cambiarse a proforma" }); return; }
    }
    // A confirmed assignment must be removed before changing the document back to a proforma.
    if (esCotizacion && !currentFicha.rows[0].es_cotizacion) {
      const assignments = await client.query("SELECT 1 FROM asignacion_fichas WHERE ficha_id = $1 LIMIT 1", [fichaId]);
      if (assignments.rows.length) { res.status(400).json({ error: "Retira la ficha de su ruta antes de cambiarla a proforma" }); return; }
    }

    // Discount validation
    if (hasDescuento && maxDescuento !== null) {
      const descuentoValue = Number(descuento ?? 0);
      if (descuentoValue > maxDescuento) {
        res.status(400).json({ error: `El descuento no puede superar el tope de ${maxDescuento}%` });
        return;
      }
    }

    const hasCostoEnvio = Object.prototype.hasOwnProperty.call(req.body, "costo_envio");

    const { rows } = await client.query(
      `UPDATE fichas SET
         fecha               = COALESCE($1,  fecha),
         fecha_evento        = COALESCE($2,  fecha_evento),
         fecha_reserva       = COALESCE($3,  fecha_reserva),
         cliente_id          = CASE WHEN $4::boolean THEN $5::uuid ELSE cliente_id END,
         distrito            = COALESCE($6,  distrito),
         direccion           = COALESCE($7,  direccion),
         referencia          = COALESCE($8,  referencia),
         hora_entrega        = CASE WHEN $40::boolean THEN $9::time ELSE hora_entrega END,
         hora_recojo         = CASE WHEN $41::boolean THEN $10::time ELSE hora_recojo END,
         hora_entrega_fin    = CASE WHEN $33::boolean THEN $11::time ELSE hora_entrega_fin END,
         hora_recojo_fin     = CASE WHEN $34::boolean THEN $12::time ELSE hora_recojo_fin END,
         comentarios         = COALESCE($13, comentarios),
         transporte          = CASE WHEN $14::boolean THEN $15::text ELSE transporte END,
         costo_envio         = CASE WHEN $16::boolean THEN $17::numeric ELSE costo_envio END,
         cliente_nombre      = COALESCE($18, cliente_nombre),
         cliente_celular     = COALESCE($19, cliente_celular),
         contacto_nombre     = COALESCE($20, contacto_nombre),
         contacto_celular    = COALESCE($21, contacto_celular),
         cotizacion          = COALESCE($22, cotizacion),
         descuento           = COALESCE($23, descuento),
         brand               = COALESCE($24::brand, brand),
         descuento_movilidad = COALESCE($25, descuento_movilidad),
         tipo_evento         = CASE WHEN $27::boolean THEN $28::varchar ELSE tipo_evento END,
         titulo              = CASE WHEN $29::boolean THEN COALESCE($30::varchar, 'Ficha #' || LPAD(id::text, 7, '0')) ELSE titulo END,
         aplica_igv          = CASE WHEN $31::boolean THEN $32::boolean ELSE aplica_igv END,
         dias_movilidad      = CASE WHEN $35::boolean THEN $36::integer ELSE dias_movilidad END,
         es_cotizacion       = $37::boolean,
         presentacion        = $38::text,
         movilidad_confirmada = $39::boolean
       WHERE id = $26 RETURNING *`,
      [
        fechaForUpdate,
        fechaEventoForUpdate,
        fechaReservaForUpdate,
        hasClienteId,
        normalizedClienteId,
        distrito ?? null,
        direccion ?? null,
        referencia ?? null,
        hora_entrega ?? null,
        hora_recojo ?? null,
        hora_entrega_fin ?? null,
        hora_recojo_fin ?? null,
        comentarios ?? null,
        hasTransporte,
        normalizedTransporte,
        hasCostoEnvio,
        costo_envio ?? null,
        cliente_nombre ?? null,
        cliente_celular ?? null,
        contacto_nombre ?? null,
        contacto_celular ?? null,
        cotizacion ?? null,
        descuento ?? null,
        brand ?? null,
        descuento_movilidad ?? null,
        fichaId,
        hasTipoEvento,
        normalizeOptionalText(tipo_evento),
        hasTitulo,
        normalizeOptionalText(titulo),
        hasAplicaIgv,
        aplica_igv === true,
        Object.prototype.hasOwnProperty.call(req.body, "hora_entrega_fin"),
        Object.prototype.hasOwnProperty.call(req.body, "hora_recojo_fin"),
        hasDiasMovilidad,
        diasMovilidad,
        esCotizacion,
        effectiveDocument.presentacion || "carrito",
        effectiveDocument.movilidad_confirmada === true,
        Object.prototype.hasOwnProperty.call(req.body, "hora_entrega"),
        Object.prototype.hasOwnProperty.call(req.body, "hora_recojo"),
      ]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Ficha not found" });
      return;
    }

    const effectiveFechaEvento = toIsoDate(rows[0].fecha_evento ?? rows[0].fecha) ?? "";
    const isDateUpdated = hasFechaEvento || hasLegacyFecha || currentFicha.rows[0].es_cotizacion !== esCotizacion;
    const normalizedPersonalIds = normalizeIdList(personalIds);
    const normalizedCarritoIds = normalizeIdList(carritoIds);

    let personalIdsToValidate: number[] = [];
    if (normalizedPersonalIds.length) {
      personalIdsToValidate = normalizedPersonalIds;
    } else if (isDateUpdated) {
      const currentPersonal = await client.query(
        "SELECT personal_id FROM ficha_personal WHERE ficha_id = $1",
        [fichaId]
      );
      personalIdsToValidate = currentPersonal.rows
        .map((row) => Number(row.personal_id))
        .filter((id) => Number.isInteger(id) && id > 0);
    }

    if (!esCotizacion && personalIdsToValidate.length) {
      const conflicts = await findApoyoConflictsByDate(
        client,
        effectiveFechaEvento,
        personalIdsToValidate,
        fichaId
      );

      if (conflicts.length) {
        await client.query("ROLLBACK");
        const details = conflicts.map((row) => ({
          personal_id: row.personal_id,
          personal_nombre: row.personal_nombre,
          ficha_id: row.ficha_id,
          cliente_nombre: row.cliente_nombre,
          fecha_evento: row.fecha_evento,
        }));
        res.status(409).json({
          error: "Personal de apoyo ya asignado en otra ficha para esa fecha_evento",
          conflicts: details,
        });
        return;
      }
    }

    let carritoIdsToValidate: number[] = [];
    if (normalizedCarritoIds.length) {
      carritoIdsToValidate = normalizedCarritoIds;
    } else if (isDateUpdated) {
      const currentCarritos = await client.query(
        "SELECT carrito_id FROM ficha_carritos WHERE ficha_id = $1",
        [fichaId]
      );
      carritoIdsToValidate = currentCarritos.rows
        .map((row) => Number(row.carrito_id))
        .filter((id) => Number.isInteger(id) && id > 0);
    }

    if (!esCotizacion && carritoIdsToValidate.length) {
      const conflicts = await findCarritoConflictsByDate(
        client,
        effectiveFechaEvento,
        carritoIdsToValidate,
        fichaId
      );

      if (conflicts.length) {
        await client.query("ROLLBACK");
        const details = conflicts.map((row) => ({
          carrito_id: row.carrito_id,
          carrito_modelo: row.carrito_modelo,
          carrito_codigo: row.carrito_codigo,
          ficha_id: row.ficha_id,
          cliente_nombre: row.cliente_nombre,
          fecha_evento: row.fecha_evento,
        }));
        res.status(409).json({
          error: "Carritos ya asignados en otra ficha para esa fecha_evento",
          conflicts: details,
        });
        return;
      }
    }

    const normalizedInflableIds = normalizeIdList(inflableIds);
    let inflableIdsToValidate: number[] = [];
    if (normalizedInflableIds.length) {
      inflableIdsToValidate = normalizedInflableIds;
    } else if (isDateUpdated) {
      const currentInflables = await client.query(
        "SELECT inflable_id FROM ficha_inflables WHERE ficha_id = $1",
        [fichaId]
      );
      inflableIdsToValidate = currentInflables.rows
        .map((row) => Number(row.inflable_id))
        .filter((id) => Number.isInteger(id) && id > 0);
    }

    if (!esCotizacion && inflableIdsToValidate.length) {
      const conflicts = await findInflableConflictsByDate(
        client,
        effectiveFechaEvento,
        inflableIdsToValidate,
        fichaId
      );

      if (conflicts.length) {
        await client.query("ROLLBACK");
        const details = conflicts.map((row) => ({
          inflable_id: row.inflable_id,
          inflable_tipo: row.inflable_tipo,
          inflable_codigo: row.inflable_codigo,
          ficha_id: row.ficha_id,
          cliente_nombre: row.cliente_nombre,
          fecha_evento: row.fecha_evento,
        }));
        res.status(409).json({
          error: "Inflables ya asignados en otra ficha para esa fecha_evento",
          conflicts: details,
        });
        return;
      }
    }

    // Replace nested lists only when provided
    if (Array.isArray(paquetes)) {
      await client.query("DELETE FROM ficha_paquetes WHERE ficha_id = $1", [fichaId]);
      await insertPaquetes(client, fichaId, paquetes);
    }

    if (Array.isArray(productosSueltos)) {
      await client.query("DELETE FROM ficha_productos_sueltos WHERE ficha_id = $1", [fichaId]);
      await insertProductosSueltos(client, fichaId, productosSueltos);
    }

    if (Array.isArray(carritoIds)) {
      await client.query("DELETE FROM ficha_carritos WHERE ficha_id = $1", [fichaId]);
      await insertIdsConDescuento(client, "ficha_carritos", "carrito_id", fichaId, normalizedCarritoIds, carritoDiscounts);
    }

    if (Array.isArray(inflableIds)) {
      await client.query("DELETE FROM ficha_inflables WHERE ficha_id = $1", [fichaId]);
      await insertIdsConDescuento(client, "ficha_inflables", "inflable_id", fichaId, normalizedInflableIds, inflableDiscounts);
    }

    const recalculatedPersonalIds: number[] = [];

    if (Array.isArray(personalIds)) {
      const previousPersonalRows = await client.query(
        "SELECT personal_id, precio_cotizado FROM ficha_personal WHERE ficha_id = $1",
        [fichaId]
      );
      const previousPersonalIds = previousPersonalRows.rows
        .map((row) => Number(row.personal_id))
        .filter((id) => Number.isInteger(id) && id > 0);

      await client.query("DELETE FROM ficha_personal WHERE ficha_id = $1", [fichaId]);
      await insertPersonal(client, fichaId, normalizedPersonalIds, previousPersonalRows.rows);

      recalculatedPersonalIds.push(...mergeUniqueIds(previousPersonalIds, normalizedPersonalIds));
    } else if (isDateUpdated) {
      recalculatedPersonalIds.push(...personalIdsToValidate);
    }

    await recalculateApoyoStatus(client, mergeUniqueIds(recalculatedPersonalIds));

    // recursos — el stock solo se mueve por la diferencia con lo que ya tenía la ficha
    if (Array.isArray(recursos)) {
      let filas;
      try {
        filas = await prepararRecursos(client, recursos);
      } catch (err) {
        if (!(err instanceof RecursoInvalidoError)) throw err;
        await client.query("ROLLBACK");
        res.status(400).json({ error: err.message });
        return;
      }
      const prevRecursos = await client.query(
        "DELETE FROM ficha_recursos WHERE ficha_id = $1 RETURNING recurso_id, cantidad",
        [fichaId]
      );
      await insertRecursos(client, fichaId, filas);
      await aplicarDiferenciaStock(client, fichaId, currentFicha.rows[0].es_cotizacion ? [] : prevRecursos.rows, esCotizacion ? [] : filas);
    }

    if (!Array.isArray(recursos) && currentFicha.rows[0].es_cotizacion !== esCotizacion) {
      const stored = await client.query("SELECT recurso_id, cantidad FROM ficha_recursos WHERE ficha_id = $1", [fichaId]);
      await aplicarDiferenciaStock(client, fichaId, currentFicha.rows[0].es_cotizacion ? [] : stored.rows, esCotizacion ? [] : stored.rows);
    }

    await guardarRegistroCotizacion(client, fichaId, req.body, req.user, currentFicha.rows[0]);
    await client.query("COMMIT");
    transactionOpen = false;
    // Se lee con la misma conexión, sin pedir otra al pool
    const data = await getFichaDetail(fichaId, client);
    res.json(data);
  } catch (err) {
    await client.query("ROLLBACK");
    if (err instanceof CotizacionRegistroError) { res.status(400).json({ error: err.message }); return; }
    if (err instanceof StockRecursoError) { res.status(400).json({ error: err.message }); return; }
    next(err);
  } finally {
    if (transactionOpen) await client.query("ROLLBACK");
    client.release();
  }
});

// ── DELETE /api/fichas/:id ────────────────────────────────────
/**
 * @swagger
 * /fichas/{id}:
 *   delete:
 *     summary: Eliminar ficha de servicio
 *     tags: [Fichas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deleted: { type: integer }
 */
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  const fichaId = Number(req.params.id);
  const client = await pool.connect();
  try {
    const currentFicha = await client.query("SELECT * FROM fichas WHERE id = $1", [fichaId]);
    if (!currentFicha.rows.length) {
      res.status(404).json({ error: "Ficha not found" });
      return;
    }

    if (req.user?.rol !== "admin" && currentFicha.rows[0].brand !== req.user?.brand) {
      res.status(403).json({ error: "No tienes permiso para eliminar esta ficha" });
      return;
    }

    await client.query("BEGIN");

    const personalRows = await client.query(
      "SELECT personal_id FROM ficha_personal WHERE ficha_id = $1",
      [fichaId]
    );
    const personalIdsToRecalculate = personalRows.rows
      .map((row) => Number(row.personal_id))
      .filter((id) => Number.isInteger(id) && id > 0);

    // Restaurar stock de recursos asignados antes del CASCADE
    const recursoRows = await client.query(
      "SELECT recurso_id, cantidad FROM ficha_recursos WHERE ficha_id = $1",
      [fichaId]
    );
    if (!currentFicha.rows[0].es_cotizacion) await aplicarDiferenciaStock(client, fichaId, recursoRows.rows, []);

    const { rows } = await client.query(
      "DELETE FROM fichas WHERE id = $1 RETURNING id",
      [fichaId]
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Ficha not found" });
      return;
    }

    await recalculateApoyoStatus(client, personalIdsToRecalculate);

    await client.query("COMMIT");
    res.json({ deleted: rows[0].id });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

// ── Abonos ────────────────────────────────────────────────────

// POST /api/fichas/:id/abonos
/**
 * @swagger
 * /fichas/{id}/abonos:
 *   post:
 *     summary: Registrar abono en una ficha
 *     tags: [Fichas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Abono' }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Abono' }
 */
router.post("/:id/abonos", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fichaId = Number(req.params.id);
    const quotation = await pool.query("SELECT es_cotizacion FROM fichas WHERE id = $1", [fichaId]);
    if (quotation.rows[0]?.es_cotizacion) { res.status(400).json({ error: "Confirma la ficha antes de registrar abonos" }); return; }
    const { fecha, monto, numero_operacion, comprobante_url, medio } = req.body;

    if (!fecha || !monto || !medio) {
      res.status(400).json({ error: "fecha, monto and medio are required" });
      return;
    }

    if (!(await assertFichaDeLaMarca(req, res, fichaId))) return;

    const { rows } = await pool.query(
      `INSERT INTO abonos (ficha_id, fecha, monto, numero_operacion, comprobante_url, medio)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [fichaId, fecha, monto, numero_operacion ?? null, comprobante_url ?? null, medio]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/fichas/:id/abonos/:abonoId
/**
 * @swagger
 * /fichas/{id}/abonos/{abonoId}:
 *   put:
 *     summary: Actualizar abono
 *     tags: [Fichas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: abonoId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Abono' }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Abono' }
 */
router.put("/:id/abonos/:abonoId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fecha, monto, numero_operacion, comprobante_url, medio } = req.body;

    if (!(await assertFichaDeLaMarca(req, res, Number(req.params.id)))) return;

    // comprobante_url y numero_operacion se deben poder vaciar: si vienen en el cuerpo
    // se escriben tal cual (incluido null), en vez de conservar el valor anterior.
    const hasComprobante = Object.prototype.hasOwnProperty.call(req.body, "comprobante_url");
    const hasNumeroOperacion = Object.prototype.hasOwnProperty.call(req.body, "numero_operacion");

    const { rows } = await pool.query(
      `UPDATE abonos
       SET fecha            = COALESCE($1, fecha),
           monto            = COALESCE($2, monto),
           numero_operacion = CASE WHEN $8::boolean THEN $3::text ELSE numero_operacion END,
           comprobante_url  = CASE WHEN $9::boolean THEN $4::text ELSE comprobante_url END,
           medio            = COALESCE($5, medio)
       WHERE id = $6 AND ficha_id = $7 RETURNING *`,
      [fecha ?? null, monto ?? null, numero_operacion ?? null,
       comprobante_url ?? null, medio ?? null,
       req.params.abonoId, req.params.id,
       hasNumeroOperacion, hasComprobante]
    );
    if (!rows.length) { res.status(404).json({ error: "Abono not found" }); return; }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/fichas/:id/abonos/:abonoId
/**
 * @swagger
 * /fichas/{id}/abonos/{abonoId}:
 *   delete:
 *     summary: Eliminar abono
 *     tags: [Fichas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: abonoId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deleted: { type: integer }
 */
router.delete("/:id/abonos/:abonoId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await assertFichaDeLaMarca(req, res, Number(req.params.id)))) return;

    const { rows } = await pool.query(
      "DELETE FROM abonos WHERE id = $1 AND ficha_id = $2 RETURNING id",
      [req.params.abonoId, req.params.id]
    );
    if (!rows.length) { res.status(404).json({ error: "Abono not found" }); return; }
    res.json({ deleted: rows[0].id });
  } catch (err) {
    next(err);
  }
});

export default router;


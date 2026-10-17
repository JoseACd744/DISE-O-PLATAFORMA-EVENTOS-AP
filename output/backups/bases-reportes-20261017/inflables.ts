import { Router, Request, Response, NextFunction } from "express";
import { PoolClient } from "pg";
import { pool } from "../db/pool";

const router = Router();

function sanitizeImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function parseOrden(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return 0;
  return parsed;
}

async function getTipoById(client: PoolClient, tipoId: number) {
  const tipoResult = await client.query("SELECT * FROM inflable_tipos WHERE id = $1", [tipoId]);
  if (!tipoResult.rows.length) return null;

  const imagesResult = await client.query(
    `SELECT id, image_url, orden, created_at
     FROM inflable_tipo_images
     WHERE tipo_id = $1
     ORDER BY orden, id`,
    [tipoId]
  );

  return { ...tipoResult.rows[0], imagenes: imagesResult.rows };
}

// ── Tipos de inflable ─────────────────────────────────────────

// GET /api/inflables/tipos
router.get("/tipos", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.*,
             COALESCE(
               json_agg(
                 json_build_object('id', ii.id, 'image_url', ii.image_url, 'orden', ii.orden)
                 ORDER BY ii.orden, ii.id
               ) FILTER (WHERE ii.id IS NOT NULL),
               '[]'
             ) AS imagenes,
             COUNT(i.id)::int AS cantidad_unidades
      FROM inflable_tipos t
      LEFT JOIN inflable_tipo_images ii ON ii.tipo_id = t.id
      LEFT JOIN inflables i ON i.tipo_id = t.id
      GROUP BY t.id
      ORDER BY t.nombre
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/inflables/tipos/:id
router.get("/tipos/:id", async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const tipo = await getTipoById(client, Number(req.params.id));
    if (!tipo) { res.status(404).json({ error: "Tipo not found" }); return; }
    res.json(tipo);
  } catch (err) { next(err); }
  finally { client.release(); }
});

// POST /api/inflables/tipos
router.post("/tipos", async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const { nombre, descripcion, dimensiones, edad_minima, precio_alquiler, imagen_url } = req.body;
    const imagenes = sanitizeImageUrls(req.body.imagenes);

    if (!nombre) { res.status(400).json({ error: "nombre is required" }); return; }

    await client.query("BEGIN");

    const primaryImage = (typeof imagen_url === "string" && imagen_url.trim())
      ? imagen_url.trim()
      : (imagenes[0] ?? null);

    const edadMinimaInt = (edad_minima !== "" && edad_minima != null) ? Number(edad_minima) : null;
    const { rows } = await client.query(
      `INSERT INTO inflable_tipos (nombre, descripcion, dimensiones, edad_minima, precio_alquiler, imagen_url)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [nombre, descripcion || null, dimensiones || null, edadMinimaInt,
       precio_alquiler ?? 0, primaryImage]
    );
    const tipoId = Number(rows[0].id);

    const uniqueImages = Array.from(new Set(primaryImage ? [primaryImage, ...imagenes] : imagenes));
    for (let i = 0; i < uniqueImages.length; i++) {
      await client.query(
        `INSERT INTO inflable_tipo_images (tipo_id, image_url, orden)
         VALUES ($1,$2,$3) ON CONFLICT (tipo_id, image_url) DO NOTHING`,
        [tipoId, uniqueImages[i], i]
      );
    }

    const tipo = await getTipoById(client, tipoId);
    await client.query("COMMIT");
    res.status(201).json(tipo);
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally { client.release(); }
});

// PUT /api/inflables/tipos/:id
router.put("/tipos/:id", async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const tipoId = Number(req.params.id);
    const { nombre, descripcion, dimensiones, edad_minima, precio_alquiler, imagen_url } = req.body;
    const imagenes = req.body.imagenes;

    await client.query("BEGIN");

    const existing = await client.query("SELECT id, imagen_url FROM inflable_tipos WHERE id = $1", [tipoId]);
    if (!existing.rows.length) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Tipo not found" });
      return;
    }

    const nextPrimaryImage = typeof imagen_url === "string" ? (imagen_url.trim() || null) : null;

    const edadMinimaInt = (edad_minima !== "" && edad_minima != null) ? Number(edad_minima) : null;
    await client.query(
      `UPDATE inflable_tipos
       SET nombre          = COALESCE($1, nombre),
           descripcion     = COALESCE($2, descripcion),
           dimensiones     = COALESCE($3, dimensiones),
           edad_minima     = COALESCE($4, edad_minima),
           precio_alquiler = COALESCE($5, precio_alquiler),
           imagen_url      = COALESCE($6, imagen_url)
       WHERE id = $7`,
      [nombre || null, descripcion || null, dimensiones || null, edadMinimaInt,
       precio_alquiler ?? null, nextPrimaryImage, tipoId]
    );

    if (Array.isArray(imagenes)) {
      const sanitized = sanitizeImageUrls(imagenes);
      const finalPrimary = nextPrimaryImage ?? existing.rows[0].imagen_url ?? sanitized[0] ?? null;
      const uniqueImages = Array.from(new Set(finalPrimary ? [finalPrimary, ...sanitized] : sanitized));

      await client.query("DELETE FROM inflable_tipo_images WHERE tipo_id = $1", [tipoId]);
      for (let i = 0; i < uniqueImages.length; i++) {
        await client.query(
          `INSERT INTO inflable_tipo_images (tipo_id, image_url, orden)
           VALUES ($1,$2,$3) ON CONFLICT (tipo_id, image_url) DO NOTHING`,
          [tipoId, uniqueImages[i], i]
        );
      }
      await client.query("UPDATE inflable_tipos SET imagen_url = $1 WHERE id = $2", [finalPrimary, tipoId]);
    }

    const tipo = await getTipoById(client, tipoId);
    await client.query("COMMIT");
    res.json(tipo);
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally { client.release(); }
});

// DELETE /api/inflables/tipos/:id
router.delete("/tipos/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Con unidades físicas no se borra: quedarían sin tipo y sus reservas dejarían de verse
    const unidades = await pool.query("SELECT COUNT(*)::int AS n FROM inflables WHERE tipo_id = $1", [req.params.id]);
    if (unidades.rows[0].n > 0) {
      res.status(409).json({ error: `Tipo has ${unidades.rows[0].n} units` });
      return;
    }
    const { rows } = await pool.query(
      "DELETE FROM inflable_tipos WHERE id = $1 RETURNING id",
      [req.params.id]
    );
    if (!rows.length) { res.status(404).json({ error: "Tipo not found" }); return; }
    res.json({ deleted: rows[0].id });
  } catch (err) { next(err); }
});

// POST /api/inflables/tipos/:id/images
router.post("/tipos/:id/images", async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const tipoId = Number(req.params.id);
    const imageUrl = typeof req.body.image_url === "string" ? req.body.image_url.trim() : "";
    const orden = parseOrden(req.body.orden);

    if (!imageUrl) { res.status(400).json({ error: "image_url is required" }); return; }

    await client.query("BEGIN");

    const tipoResult = await client.query("SELECT id, imagen_url FROM inflable_tipos WHERE id = $1", [tipoId]);
    if (!tipoResult.rows.length) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Tipo not found" });
      return;
    }

    const inserted = await client.query(
      `INSERT INTO inflable_tipo_images (tipo_id, image_url, orden)
       VALUES ($1,$2,$3)
       ON CONFLICT (tipo_id, image_url) DO UPDATE SET orden = EXCLUDED.orden
       RETURNING *`,
      [tipoId, imageUrl, orden]
    );

    if (!tipoResult.rows[0].imagen_url) {
      await client.query("UPDATE inflable_tipos SET imagen_url = $1 WHERE id = $2", [imageUrl, tipoId]);
    }

    await client.query("COMMIT");
    res.status(201).json(inserted.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally { client.release(); }
});

// DELETE /api/inflables/tipos/:tipoId/images/:imageId
router.delete("/tipos/:tipoId/images/:imageId", async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const tipoId = Number(req.params.tipoId);
    const imageId = Number(req.params.imageId);

    await client.query("BEGIN");

    const deleted = await client.query(
      "DELETE FROM inflable_tipo_images WHERE id = $1 AND tipo_id = $2 RETURNING id, image_url",
      [imageId, tipoId]
    );
    if (!deleted.rows.length) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Image not found" });
      return;
    }

    const remaining = await client.query(
      "SELECT image_url FROM inflable_tipo_images WHERE tipo_id = $1 ORDER BY orden, id LIMIT 1",
      [tipoId]
    );
    await client.query(
      "UPDATE inflable_tipos SET imagen_url = $1 WHERE id = $2",
      [remaining.rows[0]?.image_url ?? null, tipoId]
    );

    await client.query("COMMIT");
    res.json({ deleted: deleted.rows[0].id });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally { client.release(); }
});

// ── Unidades de inflable ──────────────────────────────────────

// GET /api/inflables
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(`
      SELECT i.*,
             t.nombre          AS tipo_nombre,
             t.descripcion     AS tipo_descripcion,
             t.dimensiones,
             t.edad_minima,
             t.precio_alquiler,
             t.imagen_url
      FROM inflables i
      LEFT JOIN inflable_tipos t ON t.id = i.tipo_id
      ORDER BY i.id
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/inflables/:id
// GET /api/inflables/reservas?from=&to=
// Todas las reservas manuales en una sola petición (antes el frontend pedía una por cada tipo).
// Va antes de "/:id" para que "reservas" no se tome como un id.
router.get("/reservas", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to } = req.query;
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (from) { conditions.push(`fecha >= $${values.length + 1}`); values.push(from); }
    if (to)   { conditions.push(`fecha <= $${values.length + 1}`); values.push(to); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT * FROM reservas_inflables ${where} ORDER BY inflable_id, fecha`,
      values
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(`
      SELECT i.*,
             t.nombre          AS tipo_nombre,
             t.descripcion     AS tipo_descripcion,
             t.dimensiones,
             t.edad_minima,
             t.precio_alquiler,
             t.imagen_url
      FROM inflables i
      LEFT JOIN inflable_tipos t ON t.id = i.tipo_id
      WHERE i.id = $1
    `, [req.params.id]);
    if (!rows.length) { res.status(404).json({ error: "Inflable not found" }); return; }
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/inflables
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tipo_id, codigo, estado, fecha_adquisicion } = req.body;
    if (!tipo_id) { res.status(400).json({ error: "tipo_id is required" }); return; }
    const { rows } = await pool.query(
      `INSERT INTO inflables (tipo_id, codigo, estado, fecha_adquisicion) VALUES ($1,$2,$3,$4)
       RETURNING *, (SELECT nombre FROM inflable_tipos WHERE id = $1) AS tipo_nombre`,
      [tipo_id, codigo ?? null, estado ?? "disponible", fecha_adquisicion ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/inflables/:id
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tipo_id, codigo, estado, fecha_adquisicion } = req.body;
    const { rows } = await pool.query(
      `UPDATE inflables
       SET tipo_id           = COALESCE($1, tipo_id),
           codigo            = COALESCE($2, codigo),
           estado            = COALESCE($3, estado),
           fecha_adquisicion = COALESCE($4, fecha_adquisicion)
       WHERE id = $5
       RETURNING *, (SELECT nombre FROM inflable_tipos WHERE id = tipo_id) AS tipo_nombre`,
      [tipo_id ?? null, codigo ?? null, estado ?? null, fecha_adquisicion ?? null, req.params.id]
    );
    if (!rows.length) { res.status(404).json({ error: "Inflable not found" }); return; }
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/inflables/:id
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query("DELETE FROM inflables WHERE id = $1 RETURNING id", [req.params.id]);
    if (!rows.length) { res.status(404).json({ error: "Inflable not found" }); return; }
    res.json({ deleted: rows[0].id });
  } catch (err) { next(err); }
});

// ── Reservas de inflables ─────────────────────────────────────

// GET /api/inflables/:id/reservas?from=&to=
router.get("/:id/reservas", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to } = req.query;
    const conditions = ["inflable_id = $1"];
    const values: unknown[] = [req.params.id];

    if (from) { conditions.push(`fecha >= $${values.length + 1}`); values.push(from); }
    if (to)   { conditions.push(`fecha <= $${values.length + 1}`); values.push(to); }

    const { rows } = await pool.query(
      `SELECT * FROM reservas_inflables WHERE ${conditions.join(" AND ")} ORDER BY fecha`,
      values
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/inflables/:id/reservas
router.post("/:id/reservas", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cliente_nombre, fecha, cantidad, evento, notas } = req.body;
    if (!cliente_nombre || !fecha) {
      res.status(400).json({ error: "cliente_nombre and fecha are required" }); return;
    }
    const { rows } = await pool.query(
      `INSERT INTO reservas_inflables (inflable_id, cliente_nombre, fecha, cantidad, evento, notas)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id, cliente_nombre, fecha, cantidad ?? 1, evento ?? null, notas ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/inflables/:inflableId/reservas/:reservaId
router.put("/:inflableId/reservas/:reservaId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cliente_nombre, fecha, cantidad, evento, notas } = req.body;
    const { rows } = await pool.query(
      `UPDATE reservas_inflables
       SET cliente_nombre = COALESCE($1, cliente_nombre),
           fecha          = COALESCE($2, fecha),
           cantidad       = COALESCE($3, cantidad),
           evento         = COALESCE($4, evento),
           notas          = COALESCE($5, notas)
       WHERE id = $6 AND inflable_id = $7 RETURNING *`,
      [cliente_nombre ?? null, fecha ?? null, cantidad ?? null,
       evento ?? null, notas ?? null, req.params.reservaId, req.params.inflableId]
    );
    if (!rows.length) { res.status(404).json({ error: "Reserva not found" }); return; }
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/inflables/:inflableId/reservas/:reservaId
router.delete("/:inflableId/reservas/:reservaId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(
      "DELETE FROM reservas_inflables WHERE id = $1 AND inflable_id = $2 RETURNING id",
      [req.params.reservaId, req.params.inflableId]
    );
    if (!rows.length) { res.status(404).json({ error: "Reserva not found" }); return; }
    res.json({ deleted: rows[0].id });
  } catch (err) { next(err); }
});

export default router;

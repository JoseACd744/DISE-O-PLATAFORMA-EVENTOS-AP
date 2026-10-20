BEGIN;
ALTER TABLE fichas ADD COLUMN IF NOT EXISTS reserva_grupo_id uuid;
ALTER TABLE fichas ADD COLUMN IF NOT EXISTS es_credito boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_fichas_reserva_grupo ON fichas(reserva_grupo_id);
ALTER TABLE abonos ADD COLUMN IF NOT EXISTS solicitud_id uuid UNIQUE;
CREATE TABLE IF NOT EXISTS reserva_guardados (
 solicitud_id uuid PRIMARY KEY, brand text NOT NULL, usuario_id text NOT NULL,
 solicitud_hash text NOT NULL, respuesta jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;

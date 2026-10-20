const fs=require('fs');const base='C:/Users/JOSE/Desktop/EVENTOS-AP-BACKEND';fs.mkdirSync('output/backups/reservas-fechas-20261019',{recursive:true});const path=base+'/src/routes/fichas.ts';let s=fs.readFileSync(path,'utf8').replaceAll('\r\n','\n');fs.copyFileSync(path,'output/backups/reservas-fechas-20261019/fichas.ts');
s=s.replace('const router = Router();','const router = Router();\nconst CLIENTE_RESERVA = Symbol("clienteReserva");\nconst clienteEscritura = (req: Request): Promise<PoolClient> => (req as any)[CLIENTE_RESERVA] ? Promise.resolve((req as any)[CLIENTE_RESERVA]) : pool.connect();');
// Solo la capa interna puede inyectar la transacción. No se acepta desde el cuerpo HTTP.
s=s.replaceAll('const client = await pool.connect();','const client = await clienteEscritura(req);');
const helper=fs.readFileSync('tmp/reservas-fechas/pagos-helper.txt','utf8');s=s.replace('function validateDocument(body: Record<string, any>): string | null {',helper+'\nfunction validateDocument(body: Record<string, any>): string | null {');
s=s.replace('    await guardarRegistroCotizacion(client, fichaId, req.body, req.user);','    await guardarCondicionesReserva(client, fichaId, req.body);\n    await guardarRegistroCotizacion(client, fichaId, req.body, req.user);');
s=s.replace('    await guardarRegistroCotizacion(client, fichaId, req.body, req.user, currentFicha.rows[0]);','    await guardarCondicionesReserva(client, fichaId, req.body);\n    await guardarRegistroCotizacion(client, fichaId, req.body, req.user, currentFicha.rows[0]);');
s=s.replace('export default router;',fs.readFileSync('tmp/reservas-fechas/grupos-helper.txt','utf8')+'\nexport default router;');fs.writeFileSync('tmp/reservas-fechas/fichas.ts',s);
fs.writeFileSync('tmp/reservas-fechas/048_reservas_fechas_credito.sql',`BEGIN;
ALTER TABLE fichas ADD COLUMN IF NOT EXISTS reserva_grupo_id uuid;
ALTER TABLE fichas ADD COLUMN IF NOT EXISTS es_credito boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_fichas_reserva_grupo ON fichas(reserva_grupo_id);
ALTER TABLE abonos ADD COLUMN IF NOT EXISTS solicitud_id uuid UNIQUE;
CREATE TABLE IF NOT EXISTS reserva_guardados (
 solicitud_id uuid PRIMARY KEY, brand text NOT NULL, usuario_id text NOT NULL,
 solicitud_hash text NOT NULL, respuesta jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
`);
console.log('Backend de reservas preparado y respaldado.');

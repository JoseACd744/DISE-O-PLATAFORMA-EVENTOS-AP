const {PGlite}=require('@electric-sql/pglite');
const fs=require('fs');const assert=require('node:assert/strict');
(async()=>{
const db=new PGlite();
await db.exec(`CREATE TABLE fichas(id serial primary key); CREATE TABLE paquetes(id serial primary key,nombre text,precio_unitario numeric,tipo text,brand text); CREATE TABLE paquete_items(id serial primary key,paquete_id int references paquetes(id),producto_sku text,producto_nombre text,cantidad int); CREATE TABLE tarifas_envio(id serial primary key,zona text,distrito text unique,costo_cumpleanos numeric,costo_corporativo numeric,costo_delivery numeric); INSERT INTO paquetes(nombre,precio_unitario,tipo,brand) VALUES ('100 MINIS',250,'minis','donofrio'),('VERANO IV',700,'verano','donofrio'),('100 MINIS-BOX LONCHERAS',200,'box-loncheras','donofrio'); INSERT INTO paquete_items(paquete_id,producto_sku,producto_nombre,cantidad) VALUES(1,'MINI_JET','MINI JET',100),(2,'JET','JET',200),(3,'MINI_JET','MINI JET',100);`);
const sql=fs.readFileSync((process.env.EVENTOS_BACKEND_DIR || 'C:/Users/JOSE/Desktop/EVENTOS-AP-BACKEND')+'/src/migrations/041_proformas_catalogo.sql','utf8');
await db.exec(sql);
let result=await db.query('SELECT nombre,precio_unitario,presentacion FROM paquetes ORDER BY id');
const initialCount=result.rows.length;
assert.equal(result.rows.find(p=>p.nombre==='100 MINIS').precio_unitario,'250');
assert.equal(result.rows.find(p=>p.nombre==='100 MINIS-BOX LONCHERAS').precio_unitario,'200');
assert.equal(result.rows.find(p=>p.nombre==='BOX TECNOPOR - 100 MINIS').precio_unitario,'200');
assert.equal(result.rows.filter(p=>p.presentacion==='delivery').length,0);
assert.equal(result.rows.filter(p=>p.presentacion==='lonchera' && p.nombre.includes('100 MINIS')).length,1);
const afiches=JSON.parse(fs.readFileSync(__dirname+'/tecnopor.json','utf8'));
for(const p of afiches){
 const actual=await db.query('SELECT p.precio_unitario,sum(i.cantidad)::int cantidad FROM paquetes p JOIN paquete_items i ON i.paquete_id=p.id WHERE p.nombre=$1 GROUP BY p.id',[p.nombre]);
 assert.equal(Number(actual.rows[0].precio_unitario),p.precio);
 assert.equal(actual.rows[0].cantidad,p.contenido.reduce((sum,i)=>sum+i.cantidad,0));
}
assert.equal((await db.query('SELECT count(*)::int n FROM tarifas_envio')).rows[0].n,9);
assert.equal((await db.query('SELECT count(*)::int n FROM tarifas_envio WHERE delivery_por_confirmar')).rows[0].n,2);
await db.exec(sql);
assert.equal((await db.query('SELECT count(*)::int n FROM paquetes')).rows[0].n,initialCount);
assert.equal((await db.query('SELECT count(*)::int n FROM tarifas_envio')).rows[0].n,9);
const cleanup=fs.readFileSync((process.env.EVENTOS_BACKEND_DIR || 'C:/Users/JOSE/Desktop/EVENTOS-AP-BACKEND')+'/src/migrations/042_corregir_catalogo_imagenes.sql','utf8');
await db.exec('CREATE TABLE ficha_paquetes(ficha_id integer REFERENCES fichas(id), paquete_id integer REFERENCES paquetes(id));');
await db.exec(cleanup);
await db.exec("INSERT INTO paquetes(id,nombre,precio_unitario,tipo,brand,presentacion) VALUES(88,'Bombones Pote',25,'delivery','donofrio','delivery');");
// El precio exacto del respaldo evita borrar otro producto con el mismo nombre.
const expectedPrice=Number(cleanup.match(/\(88,'Bombones Pote',([\d.]+)\)/)[1]);
await db.query('UPDATE paquetes SET precio_unitario=$1 WHERE id=88',[expectedPrice]);
await db.exec('INSERT INTO fichas(id) VALUES(1); INSERT INTO ficha_paquetes VALUES(1,88);');
await assert.rejects(db.exec(cleanup),/No se retiran combos usados/);
await db.exec('ROLLBACK; DELETE FROM ficha_paquetes;');
await db.exec(cleanup);
assert.equal((await db.query('SELECT count(*)::int n FROM paquetes WHERE id=88')).rows[0].n,0);
await db.exec(cleanup);
assert.equal((await db.query('SELECT count(*)::int n FROM paquetes')).rows[0].n,initialCount);
console.log('Migración PostgreSQL aislada OK: 12 precios y cantidades tecnopor, sin combos del Excel, 9 distritos, preservación del catálogo e idempotencia.');
await db.close();
})().catch(e=>{console.error(e);process.exit(1)});

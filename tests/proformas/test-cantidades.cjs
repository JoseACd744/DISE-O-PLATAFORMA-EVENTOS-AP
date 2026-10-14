const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const base=process.env.EVENTOS_BACKEND_DIR || 'C:/Users/JOSE/Desktop/EVENTOS-AP-BACKEND';
function esperadas(nombre){
 const n=nombre.replace(/^(LONCHERA - |BOX TECNOPOR - )/,'').replace('-BOX LONCHERAS','');
 const minis=n.match(/^(\d+) MINIS$/);if(minis)return Number(minis[1]);
 return {'MINI VACILÓN':60,'VACILÓN':90,'EXTRA VACILON':120,'EXTRA VACILÓN':120,'FULL VACILÓN':150,'PREMIUM I':60,'PREMIUM II':90,'PREMIUM III':120,'PREMIUM IV':150,'VERANO I':60,'VERANO II':100,'VERANO III':150,'VERANO IV':200}[n];
}
(async()=>{
 const db=new PGlite();
 await db.exec('CREATE TABLE paquetes(id integer PRIMARY KEY,nombre text,brand text,precio_unitario numeric); CREATE TABLE paquete_items(id serial PRIMARY KEY,paquete_id int,producto_sku text,producto_nombre text,cantidad int);');
 const catalogo=JSON.parse(fs.readFileSync(path.join(__dirname,'../../output/backups/catalogo-antes-correccion-cantidades-20261014.json'),'utf8'));
 for(const p of catalogo){await db.query("INSERT INTO paquetes VALUES($1,$2,'donofrio',$3)",[p.id,p.nombre,p.precio_unitario]);for(const i of p.contenido??[])await db.query('INSERT INTO paquete_items(paquete_id,producto_sku,producto_nombre,cantidad) VALUES($1,$2,$3,$4)',[p.id,i.sku,i.nombre,i.cantidad]);}
 const sql=fs.readFileSync(base+'/src/migrations/044_corregir_cantidades_paquetes.sql','utf8');
 await db.exec(sql);await db.exec(sql);
 const r=await db.query('SELECT p.id,p.nombre,p.precio_unitario,sum(i.cantidad)::int cantidad FROM paquetes p JOIN paquete_items i ON i.paquete_id=p.id GROUP BY p.id ORDER BY p.id');
 assert.equal(r.rows.length,catalogo.length);
 for(const p of r.rows){assert.notEqual(esperadas(p.nombre),undefined,p.nombre);assert.equal(p.cantidad,esperadas(p.nombre),p.nombre);assert.equal(p.precio_unitario,catalogo.find(c=>c.id===p.id).precio_unitario);}
 console.log(`Cantidades verificadas: ${r.rows.length} paquetes correctos, Premium I 60 y Verano I 60; precios intactos e idempotencia.`);
 await db.close();
})().catch(e=>{console.error(e);process.exit(1)});
module.exports={esperadas};

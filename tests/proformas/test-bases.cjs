const {PGlite}=require('@electric-sql/pglite');const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),vm=require('node:vm'),ts=require('../../node_modules/typescript');
const base=process.env.EVENTOS_BACKEND_DIR||'C:/Users/JOSE/Desktop/EVENTOS-AP-BACKEND';
(async()=>{
const db=new PGlite();for(const f of fs.readdirSync(base+'/src/migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(fs.readFileSync(base+'/src/migrations/'+f,'utf8').replace('CREATE EXTENSION IF NOT EXISTS "pgcrypto";',''));
const fichasIniciales=(await db.query('SELECT count(*)::int n FROM fichas')).rows[0].n;
const adapter={query:async(sql,args)=>{if(!args&&sql.includes(';'))return db.exec(sql);const r=await db.query(sql,args);return {...r,rowCount:r.affectedRows??r.rows.length};},release(){}};const pool={...adapter,connect:async()=>adapter};
function load(file,local=false){const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText;const mod={exports:{}};vm.runInNewContext(code,{module:mod,exports:mod.exports,require:n=>n==='../db/pool'?{pool}:require(base+'/node_modules/'+n),console,Date,Intl,Set,Map});return mod.exports;}
const admin={rol:'admin',brand:'jugueton',nombre:'PRUEBA'};
async function call(router,method,route,body={},params={},query={},user=admin){const l=router.stack.find(l=>l.route?.path===route&&l.route.methods[method]);let status=200,data;const res={status(s){status=s;return this;},json(d){data=d;return this;}};await l.route.stack[0].handle({body,params,query,user},res,e=>{throw e;});return {status,data};}
const ventas=load(base+'/src/routes/ventas-historicas.ts').default;
let saved=await call(ventas,'put','/',{brand:'jugueton',mes:'2020-01',monto:500,nota:'Base'});assert.equal(saved.status,200,JSON.stringify(saved.data));
saved=await call(ventas,'put','/',{brand:'jugueton',mes:'2020-01',monto:700});assert.equal(saved.status,200);
assert.equal((await db.query("SELECT count(*)::int n FROM ventas_historicas WHERE brand='jugueton'")).rows[0].n,1);
let listed=await call(ventas,'get','/',{}, {},{brand:'jugueton'});assert.equal(Number(listed.data[0].monto),700);
await call(ventas,'put','/',{brand:'donofrio',mes:'2020-01',monto:200});listed=await call(ventas,'get','/',{}, {},{brand:'donofrio'});assert.equal(listed.data.length,1);assert.equal(Number(listed.data[0].monto),200);
assert.equal((await call(ventas,'put','/',{brand:'jugueton',mes:'2020-01',monto:100},{},{},{rol:'vendedor',brand:'jugueton'})).status,403);
assert.equal((await call(ventas,'get','/',{}, {},{brand:'donofrio'},{rol:'vendedor',brand:'jugueton'})).status,403);
for(const patch of [{mes:'2020-13'},{mes:'9999-01'},{monto:-1},{monto:0.001},{monto:null},{nota:'a'.repeat(501)}])assert.equal((await call(ventas,'put','/',{brand:'jugueton',mes:'2020-01',monto:100,...patch})).status,400);
assert.equal((await call(ventas,'put','/',{brand:'jugueton',mes:'2020-01',monto:0})).status,200);
const inflables=load(base+'/src/routes/inflables.ts').default;const tipo=await db.query("INSERT INTO inflable_tipos(nombre) VALUES('TIPO BASE TEST') RETURNING id");
const unit=await call(inflables,'post','/',{tipo_id:tipo.rows[0].id,codigo:'TEST-BASE',alquileres_base:15});assert.equal(unit.status,201);assert.equal(unit.data.alquileres_base,15);
const params={id:String(unit.data.id)};
let u=await call(inflables,'put','/:id',{codigo:'TEST-BASE-EDIT'},params);assert.equal(u.data.alquileres_base,15);
for(const n of [-1,1.5,null,'15',2147483648])assert.equal((await call(inflables,'put','/:id',{alquileres_base:n},params)).status,400);
u=await call(inflables,'put','/:id',{alquileres_base:0},params);assert.equal(u.data.alquileres_base,0);
const functions=load(path.join(__dirname,'../../src/app/lib/reportesHistoricos.ts'),true);const {sumarHistorico,rankingInflables,rankingProductosIndividuales}=functions;
const historical=[{mes:'2024-02',monto:200},{mes:'2024-03',monto:300}];
assert.equal(sumarHistorico(historical,'2024-02-01','2024-02-29'),200);assert.equal(sumarHistorico(historical,'2024-02-02','2024-03-15'),0);assert.equal(sumarHistorico(historical,'2024-02-01','2024-03-31'),500);
const rows=rankingInflables([{id:1,tipoNombre:'Castillo',alquileresBase:15},{id:2,tipoNombre:'Tobogán',alquileresBase:0}],[{inflableIds:[1,1]},{inflableIds:[1]},{inflableIds:[1]},{inflableIds:[1],es_cotizacion:true}]);assert.equal(rows[0].valor,18);assert.equal(rows[0].base,15);assert.equal(rows[0].sistema,3);
const products=rankingProductosIndividuales([{productosSueltos:[{producto_nombre:'Producto A',cantidad:4}],paquetes:[{cantidad:99}]},{productosSueltos:[{producto_nombre:'Producto A',cantidad:2}]},{es_cotizacion:true,productosSueltos:[{producto_nombre:'Producto A',cantidad:10}]}]);assert.equal(products[0].valor,6);
assert.equal((await db.query('SELECT count(*)::int n FROM fichas')).rows[0].n,fichasIniciales);
console.log('Bases/reportes OK: histórico por marca sin duplicados, permisos, cero y validaciones; alquileres 15+3=18 sin proformas; meses completos y productos individuales sin paquetes; ninguna ficha ficticia.');await db.close();
})().catch(e=>{console.error(e);process.exit(1);});

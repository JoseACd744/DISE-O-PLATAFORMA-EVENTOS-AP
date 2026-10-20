const http=require('http'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/JOSE/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve('dist');let browser;
const server=http.createServer((req,res)=>{const target=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));let file=target.startsWith(root)&&fs.existsSync(target)&&fs.statSync(target).isFile()?target:path.join(root,'index.html');res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.jpg')?'image/jpeg':'text/html');res.end(fs.readFileSync(file));});
(async()=>{
 await new Promise(resolve=>server.listen(5191,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage({viewport:{width:1365,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));let payload;
 let ficha={id:254,titulo:'Ejemplo trazabilidad',es_cotizacion:false,brand:'donofrio',presentacion:'carrito',fecha_evento:'2026-12-10',fecha_reserva:'2026-10-13',cliente_nombre:'CLIENTE PRUEBA',distrito:'Miraflores',transporte:'cumpleanos',cotizacion:805,descuento:0,costo_envio:50,dias_movilidad:1,paquetes:[],productosSueltos:[{producto_nombre:'COPA K-BANA',cantidad:100,descuento_valor:0,descuento_tipo:'porcentaje'}],carritoIds:[1],carritos:[{id:1,descuento_tipo:'porcentaje',descuento_valor:15}],recursos:[],personal:[],abonos:[],inflableIds:[],personalIds:[]};
 let quote={...ficha,id:272,es_cotizacion:true,distrito:'San Isidro',direccion:'',cliente_celular:'',hora_entrega:'',hora_recojo:'',tipo_evento:'Cumpleaños',created_at:'2026-10-19T12:00:00Z'};
 let quoteSaves=0;let failNextPayment=false;
 const premium={id:39,nombre:'PREMIUM I',precio_unitario:400,tipo:'premium',brand:'donofrio',presentacion:'carrito',contenido:['BOM BOM','SIN PARAR','DONOSANDWICH','KIT KAT','FRIO RICO CONO','ALASKA FRUTAS'].map(producto_nombre=>({producto_nombre,producto_sku:producto_nombre.replaceAll(' ','_'),cantidad:10}))};
 const cat={ '/products/categories':[{id:1,nombre:'HELADOS'}],'/products':[{id:1,categoria_id:1,producto:'COPA K-BANA',sku:'KB',precio:2.5,brand:'donofrio'}],'/carritos':[{id:1,codigo:'CAR-01',modelo:'Carrito personalizado',estado:'disponible',precio_alquiler:150,tipo_id:1,tipo_nombre:'Carrito'}],'/tarifas-envio':[{id:3,distrito:'San Isidro',costo_cumpleanos:50,costo_delivery:20},{id:2,distrito:'San Miguel',costo_cumpleanos:50},{id:1,distrito:'Miraflores',zona:'Lima Moderna',costo_cumpleanos:50,costo_corporativo:50,costo_delivery:20}]};
 await page.addInitScript(()=>{localStorage.setItem('authToken','TOKEN_SINTETICO');localStorage.setItem('authUser',JSON.stringify({id:'prueba',nombre:'OPERADOR PRUEBA',rol:'admin',brand:'donofrio'}));localStorage.setItem('selectedBrand','donofrio');});
 await page.context().route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.pathname==='/images/donofrio.jpg')return route.fulfill({status:200,contentType:'image/jpeg',body:fs.readFileSync('public/images/donofrio.jpg')});const ix=url.pathname.indexOf('/api/');if(ix<0){if(url.hostname!=='127.0.0.1')return route.abort();return route.continue();}const p=url.pathname.slice(ix+4);let data=cat[p]??[];
  if(p==='/fichas')data=[ficha,{...ficha,id:255,distrito:'San Miguel',cliente_nombre:'OTRO CLIENTE'},quote];
  if(p==='/fichas/254/abonos' && req.method()==='POST'){payload=req.postDataJSON();ficha.abonos.push({id:700,...payload});data={ok:true};}
  if(p==='/paquetes')data=[premium];
  if(p.startsWith('/tarifas-envio/'))data=cat['/tarifas-envio'][0];
  if(p==='/fichas/272'&&req.method()==='PUT'){
    payload=req.postDataJSON();quoteSaves++;
    if(failNextPayment){failNextPayment=false;return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'El abono supera el saldo de esta fecha'})});}
    quote={...quote,...payload,abonos:payload.abono_inicial?[{id:701,...payload.abono_inicial}]:quote.abonos};data=quote;
  }else if(p==='/fichas/272')data=quote;
  if(p==='/fichas'&&req.method()==='POST'){

    payload=req.postDataJSON();const r=payload.cotizacion_registro;const actual={...r,cotizacion:payload.cotizacion,ajuste:payload.cotizacion-r.base,descuentoGlobal:payload.descuento,fecha:'2026-10-14T15:00:00Z',usuario:'OPERADOR PRUEBA'};
    ficha={...ficha,...payload,productosSueltos:[],paquetes:payload.paquetes.map(p=>({paquete_id:p.paqueteId,paquete_nombre:p.paqueteNombre,paquete_tipo:p.paqueteTipo,cantidad:p.cantidad,descuento_tipo:p.descuentoTipo,descuento_valor:p.descuentoValor})),cotizacion_trazabilidad:{actual,historial:[actual]}};data=ficha;
  }
  if(p==='/fichas/254'&&req.method()==='PUT'){
   payload=req.postDataJSON();const r=payload.cotizacion_registro;const actual={...r,cotizacion:payload.cotizacion,ajuste:payload.cotizacion-r.base,descuentoGlobal:payload.descuento,fecha:'2026-10-13T20:00:00Z',usuario:'OPERADOR PRUEBA',cotizacionAnterior:805};
   ficha={...ficha,...payload,productosSueltos:payload.productosSueltos.map(p=>({producto_nombre:p.productoNombre,cantidad:p.cantidad,descuento_valor:p.descuentoValor,descuento_tipo:p.descuentoTipo})),cotizacion_trazabilidad:{actual,historial:[actual]}};data=ficha;
  }else if(p==='/fichas/254')data=ficha;
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data),headers:{'Access-Control-Allow-Origin':'*'}});
 });

 await page.goto('http://127.0.0.1:5191/dashboard/fichas');
 const filter=page.getByRole('combobox',{name:'Filtrar por distrito'});
 await page.getByTitle('Registrar abono').first().waitFor();
 for(const width of [1365,1024,768,390]) {
 await page.setViewportSize({width,height:1000});
 for(const district of ['Todos','Miraflores','San Miguel','Miraflores']) {
  await filter.selectOption(district);
  const button=district==='Todos'?page.getByTitle('Registrar abono').nth(1):page.getByTitle('Registrar abono').first();
  await button.click();
  await page.getByRole('heading',{name:'Registrar Abono',exact:true}).waitFor({timeout:3000});
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 }
 }
 await page.setViewportSize({width:1365,height:1000});
 await filter.selectOption('Miraflores');
 await page.getByTitle('Ver detalle').click();
 await page.getByRole('button',{name:'Registrar abono',exact:true}).last().click();
 await page.locator('#abono-form input[type="number"]').fill('100');
 await page.getByRole('button',{name:'Guardar abono',exact:true}).click();
 await page.getByRole('heading',{name:'Registrar Abono',exact:true}).waitFor({state:'hidden'});
 assert.equal(payload.monto,100);
 assert.equal(await filter.inputValue(),'Miraflores');

 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await filter.selectOption('San Isidro');
 await page.getByTitle('Registrar abono').click();
 await page.getByText('Completa los datos de la reserva.',{exact:false}).waitFor();
 assert.equal(quoteSaves,0,'Abrir no debe confirmar ni crear abonos');
 const checked=page.getByRole('checkbox',{name:'Registrar abono al guardar'});
 assert(await checked.isChecked());
 await page.locator('input[name="direccion"]').fill('Av. Prueba 123');
 await page.locator('input[name="cliente_celular"]').fill('999999999');
 await page.locator('input[name="hora_entrega"]').fill('14:00');
 await page.locator('input[name="hora_recojo"]').fill('18:00');
 await page.locator('input[name="abonoInicialMonto"]').fill('100');
 failNextPayment=true;
 await page.getByRole('button',{name:'Guardar Cambios',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'El abono supera el saldo'}).waitFor();
 const paymentId=payload.abono_inicial.solicitud_id;
 assert.equal(quote.es_cotizacion,true);
 await page.getByRole('button',{name:'Guardar Cambios',exact:true}).click();
 await page.locator('#ficha-form').waitFor({state:'hidden'});
 assert.equal(payload.es_cotizacion,false);assert.equal(payload.abono_inicial.monto,100);
 assert.equal(payload.abono_inicial.solicitud_id,paymentId);
 assert.equal(await filter.inputValue(),'San Isidro');
 await page.getByTitle('Registrar abono').click();
 await page.getByRole('heading',{name:'Registrar Abono',exact:true}).waitFor();
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 quote={...quote,es_cotizacion:true,abonos:[]};await page.reload();await filter.selectOption('San Isidro');
 await page.getByTitle('Registrar abono').click();
 await page.getByRole('checkbox',{name:'Registrar abono al guardar'}).uncheck();
 await page.getByRole('checkbox',{name:'Reserva a crédito'}).check();
 await page.getByRole('button',{name:'Guardar Cambios',exact:true}).click();
 await page.locator('#ficha-form').waitFor({state:'hidden'});
 assert.equal(payload.es_credito,true);assert.equal(payload.abono_inicial,undefined);
 await page.getByText('A crédito',{exact:true}).waitFor();
  assert.equal(errors.length,0,errors.join('\n'));

 console.log('OK: Todos -> Miraflores -> San Miguel -> Miraflores, abrir/cerrar abono y guardar con distrito activo.');
})().catch(e=>{console.error(e.stack);process.exitCode=1}).finally(async()=>{await browser?.close();server.close();});

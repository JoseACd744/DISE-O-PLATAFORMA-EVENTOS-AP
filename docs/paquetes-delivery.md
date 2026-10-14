# Cantidades y presentación delivery

El 14/10/2026 se verificaron los 57 paquetes de D’Onofrio en la base configurada. Premium I de carrito y lonchera contenían dos renglones adicionales de una unidad: Copa D’Onofrio y Frío Rico paleta. Los seis productos de diez unidades ya sumaban 60. Se retiraron esos dos renglones, conservando los precios. Premium I de tecnopor ya estaba correcto.

Verano I de carrito y lonchera contenían una unidad adicional de Alaska mousse. El detalle de las imágenes proporcionadas suma 60 con 20 Alaska frutas, 20 Jet, 10 Sublime clásico y 10 Sublime dúo. Se retiró únicamente esa unidad sobrante. Los demás paquetes coinciden con las cantidades de sus presentaciones.

La migración `044_corregir_cantidades_paquetes.sql` se aplicó y registró. Verifica las composiciones antes de corregirlas y puede repetirse sin efectos adicionales. Se conservaron los precios de todos los paquetes y los importes de las 173 fichas. Respaldo: `output/backups/catalogo-antes-correccion-cantidades-20261014.json`. Resultado: `output/qa/cantidades-paquetes-20261014.json`.

En modalidad Delivery, las presentaciones son Carrito, Lonchera, Solo helados y Tecnopor. Solo helados permite utilizar los paquetes existentes del catálogo de carrito, sin duplicarlos. La ficha guarda `solo_helados`; la proforma muestra «Solo helados». Al pasar a Evento, esa presentación vuelve a Carrito. El servidor rechaza Solo helados si la modalidad no es delivery.

Validación: PostgreSQL aislado con los 57 paquetes, repetición de la migración, preservación de precios, rutas reales de guardado y consulta, TypeScript y compilación de ambos proyectos. El formulario se prueba en Edge con API simulada. Los servidores temporales se cierran al terminar. El usuario despliega frontend y backend; la migración de cantidades ya está aplicada.

# BoostWater

Tienda online de equipamiento de propulsión eléctrica acuática (motores, baterías, accesorios). 

- Proyecto Firebase: `boostwater-497012`
- Hosting site: `boostwaterarg` → https://boostwaterarg.web.app/
- Mail del negocio: `boostwater@outlook.com.ar`
- WhatsApp del negocio: `5491134519455`
- Idioma: todo el código (nombres de variables, comentarios, UI) está en español. Mantener esa convención.

## Objetivo del proyecto (visión del dueño)

El objetivo es que boostwaterarg.web.app funcione como un e-commerce completo donde el cliente pueda:
Explorar y elegir productos del catálogo
Agregar al carrito y gestionar su compra
Seleccionar el método de envío:
Retiro personal
Envío por OCA
Pagar mediante:
Transferencia bancaria
Efectivo
MercadoPago
Todo el flujo debe ser simple, claro y funcionar de punta a punta sin fricción para el cliente final.

## Estado actual (implementado en código, pendiente de deploy)

- **Stack**: sitio estático en `public/` (Firebase Hosting), sin framework de frontend (JS vanilla en un único `public/js/app.js`). Backend en `functions/index.js` (Cloud Functions).
- **Carrito → Checkout**: el cliente agrega productos, elige envío (Retiro en local / OCA Sucursal / OCA Domicilio — `cotizarOCA` solo cotiza el precio, no genera el envío) y pasa a `public/cart.html`, que ahora es la página de Checkout completa (antes era una página huérfana sin uso).
- **`crearPedido`** (Cloud Function): valida precio/stock contra Firestore (nunca confía en el navegador), exige dirección completa solo si el envío es a domicilio por OCA, guarda el pedido en la colección `pedidos` (estado `"pendiente"`, sin descontar stock todavía), y manda mail de confirmación al cliente + aviso al vendedor vía SendGrid.
- **Métodos de pago implementados**: `"transferencia"` (siempre disponible; al confirmar aparece un botón para coordinar por WhatsApp) y `"efectivo"` (solo habilitado si el envío elegido es "Retiro en local" — no tiene sentido pagar en efectivo un envío de OCA sin contacto físico; no dispara WhatsApp, solo mail). **`"mercadopago"` todavía no existe** — se deja para el final a propósito.
- **Pendiente para que esto funcione en producción**:
  1. Terminar de verificar el Single Sender en SendGrid (`boostwater@outlook.com.ar`) y generar la API Key — **en pausa por ahora**, el dueño no pudo crear la cuenta todavía.
  2. Guardar esa key con `firebase functions:secrets:set SENDGRID_API_KEY`.
  3. `firebase deploy --only functions,hosting` (nada de lo de arriba está deployado aún).
- **Mercado Pago**: pendiente, a propósito al final. Plan: Checkout Pro + función `crearPreferencia` (recalculando todo server-side) + webhook que confirme el pago, actualice `pedidos/{id}.estado` y descuente stock. Usar credenciales de prueba (`TEST-...`) del panel de Mercado Pago durante el desarrollo, guardadas también vía Firebase secrets (nunca pegadas en el chat).

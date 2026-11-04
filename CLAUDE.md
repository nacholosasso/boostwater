# BoostWater

Tienda online de equipamiento de propulsión eléctrica acuática (motores, baterías, accesorios). 

- Proyecto Firebase: `boostwater-497012` (⚠️ borrado el 2026-11-03, ver abajo)
- Hosting site: `boostwaterarg` → https://boostwaterarg.web.app/ (ya no está en pie)
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

## ⚠️ Infra de Firebase/GCP borrada (2026-11-03)

El proyecto de Google Cloud `boostwater-497012` fue **borrado por el dueño**. Esto significa que, aunque el código del repo describe un checkout que llegó a estar deployado, **ya no hay nada corriendo**: no hay hosting en `boostwaterarg.web.app`, no hay Cloud Functions (`cotizarOCA`, `crearPedido`), no hay Firestore, no hay secrets. El repo de GitHub es la única fuente de verdad que sobrevive.

Para que alguien retome esto hay que **reprovisionar todo desde cero**: crear un proyecto nuevo de Firebase/GCP, reconfigurar Hosting (sitio `boostwaterarg` u otro nombre libre), redeployar las Cloud Functions de `functions/index.js`, recrear Firestore con los datos de productos/stock, y volver a configurar secrets (SendGrid, y más adelante Mercado Pago). No asumir que algo de esto sigue en pie — verificar con `firebase projects:list` / `gcloud projects list` antes de dar por hecho cualquier estado de deploy.

## Estado del código (según el último deploy conocido, ya no vigente)

- **Stack**: sitio estático en `public/` (Firebase Hosting), sin framework de frontend (JS vanilla en un único `public/js/app.js`). Backend en `functions/index.js` (Cloud Functions).
- **Carrito → Checkout**: el cliente agrega productos, elige envío (Retiro en local / OCA Sucursal / OCA Domicilio — `cotizarOCA` solo cotiza el precio, no genera el envío) y pasa a `public/cart.html`, que es la página de Checkout completa.
- **`crearPedido`** (Cloud Function): valida precio/stock contra Firestore (nunca confía en el navegador), exige dirección completa solo si el envío es a domicilio por OCA, guarda el pedido en la colección `pedidos` (estado `"pendiente"`, sin descontar stock todavía), y manda mail de confirmación al cliente + aviso al vendedor vía SendGrid.
- **Métodos de pago implementados**: `"transferencia"` (siempre disponible; al confirmar aparece un botón para coordinar por WhatsApp) y `"efectivo"` (solo habilitado si el envío elegido es "Retiro en local" — no tiene sentido pagar en efectivo un envío de OCA sin contacto físico; no dispara WhatsApp, solo mail). **`"mercadopago"` todavía no existe** — se deja para el final a propósito.
- **Pendiente real (además de reprovisionar toda la infra)**:
  1. SendGrid: el secreto `SENDGRID_API_KEY` **todavía no existe** en el proyecto (verificado con `gcloud secrets list`) — el dueño sigue sin poder crear la cuenta/verificar el Single Sender (`boostwater@outlook.com.ar`). Mientras no exista, `enviarEmail` (functions/index.js) omite el envío de mails en silencio — el pedido se guarda igual, pero no llegan mails de confirmación ni aviso al vendedor.
  2. Cuando esté la key: `firebase functions:secrets:set SENDGRID_API_KEY`, después volver a agregar `.runWith({ secrets: ["SENDGRID_API_KEY"] })` en `crearPedido` (está comentado como nota en el código) y redeployar funciones.
- **Mercado Pago**: pendiente, a propósito al final. Plan: Checkout Pro + función `crearPreferencia` (recalculando todo server-side) + webhook que confirme el pago, actualice `pedidos/{id}.estado` y descuente stock. Usar credenciales de prueba (`TEST-...`) del panel de Mercado Pago durante el desarrollo, guardadas también vía Firebase secrets (nunca pegadas en el chat).

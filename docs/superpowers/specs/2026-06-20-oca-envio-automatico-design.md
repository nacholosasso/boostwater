# Generación automática de envío OCA + etiqueta

## Contexto

Hoy `cotizarOCA` (`functions/index.js:19`) solo cotiza el costo del envío contra el webservice de tarifación de OCA (`Tarifar_Envio_Corporativo`). Cuando el cliente confirma el pedido, `crearPedido` (`functions/index.js:212`) guarda el pedido en Firestore con la dirección completa, pero no genera ningún envío real en OCA: hoy el vendedor entra a mano al sistema de OCA y carga el paquete usando los datos guardados en el pedido.

El objetivo es automatizar esa carga: que al crearse el pedido se genere también el envío real en OCA (con número de seguimiento y etiqueta), sin intervención manual.

Generar un envío real usa un sistema distinto al de tarifación: el webservice e-Pak de OCA (`developers.oca.com.ar/epak.html`), que requiere credenciales de usuario/contraseña del portal e-Pak (`ocaepak.oca.com.ar`) y un número de cuenta corporativa — datos que **todavía no existen** para este proyecto (confirmado: solo se tiene CUIT + Operativa, suficiente para tarifar pero no para generar envíos). Por eso el desarrollo se hace contra el ambiente de pruebas de OCA, dejando preparado el cambio a producción para cuando lleguen las credenciales reales.

## Alcance

Automatizar, dentro de `crearPedido`, la generación del envío real en OCA y su etiqueta, para pedidos con `envio.tipo` igual a `oca_sucursal` u `oca_domicilio`. Los pedidos con `envio.tipo === "retiro"` no generan ningún envío (no aplica).

### Fuera de alcance (explícitamente, para no sobre-construir)

- **Anular/cancelar el envío en OCA** si el pedido nunca se paga. Hoy no existe ningún flujo de "cancelar pedido" en la app — el `estado` de un pedido siempre queda en `"pendiente"`, no hay transición a cancelado. No tiene sentido anular un envío en un sistema que todavía no sabe cancelar pedidos. Queda para un desarrollo futuro, una vez que exista esa noción.
- **Panel de administración.** El vendedor sigue viendo los pedidos en la consola de Firestore y por mail; no se construye ninguna pantalla nueva.
- **Reintento automático** si falla la generación del envío. Si falla, queda registrado en el pedido para que el vendedor lo resuelva a mano esa vez.
- **Conciliación de pago antes de generar el envío.** El envío se genera automáticamente apenas se crea el pedido, independientemente de si la transferencia ya se acreditó o no (ver "Riesgos aceptados" abajo).

## Decisiones de diseño

### 1. Disparador: automático al crear el pedido

La generación se dispara dentro de `crearPedido`, inmediatamente después de guardar el pedido en Firestore (después de `db.collection("pedidos").add(pedido)`, junto al envío de mails). No requiere ninguna acción del vendedor ni un panel para confirmarlo.

**Riesgo aceptado:** los envíos OCA en este proyecto siempre se pagan por transferencia (el método `"efectivo"` solo está habilitado para `"retiro"`), y la transferencia no se confirma de forma automática — el pedido queda `"pendiente"` aunque el cliente nunca pague. Esto significa que se puede generar un envío real en OCA para un pedido que después no se cobra. Se acepta este riesgo ahora porque: (a) generar el envío no implica entregar el paquete — el vendedor solo lo despacha si la transferencia se confirmó, y (b) anular un envío no efectivizado en OCA es una operación de bajo costo/impacto. Si esto resulta problemático en la práctica, la mitigación natural es la opción descartada en el brainstorming (disparo manual o atado a un estado "confirmado"), no necesariamente cancelación automática.

### 2. Generación: webservice e-Pak, `IngresoORMultiplesRetiros`

Nueva función auxiliar `generarEnvioOCA(pedido, pedidoId)` en `functions/index.js`, llamada solo cuando `envio.tipo !== "retiro"`.

Llama a `IngresoORMultiplesRetiros` (método del webservice e-Pak) con:

- `usr` / `psw`: credenciales e-Pak (ver sección de credenciales).
- `ConfirmarRetiro = true`: confirmación instantánea del envío (no se usa el modo "carrito de envíos", que sirve para acumular varios envíos y confirmarlos juntos más tarde — no aplica acá porque cada pedido se confirma individualmente y al instante).
- `XML_Datos`: con cabecera (número de cuenta corporativa), origen (CP/dirección propia + centro de costo correspondiente a la Operativa `467765` o `467764`, según `envio.tipo`), destinatario (datos del cliente del pedido — dirección completa si es `oca_domicilio`, o la sucursal elegida si es `oca_sucursal`), y paquete (peso/volumen — mismos datos que ya calcula `cotizarOCA` para tarifar).

### 3. Credenciales: ambiente de prueba ahora, producción después

No existen credenciales e-Pak reales todavía. El código se escribe apuntando al endpoint de QA de OCA:

```
https://integraciones.ocadev.com.ar/epak_tracking_test/Oep_TrackEPak.asmx/IngresoORMultiplesRetiros
```

con las credenciales de prueba públicas que documenta OCA (`test@oca.com.ar` / `123456`, cuenta `111757/001`). Estas son de uso público en la documentación de OCA, no son secretas.

**Importante:** la cuenta de prueba (`111757/001`) no tiene asignadas las Operativas reales `467765`/`467764` — esas son de la cuenta corporativa real, no de la cuenta test de OCA. Para QA se usa la Operativa que la propia cuenta de prueba tenga disponible (se obtiene igual con `GetCentroCostoPorOperativa`, pero contra la cuenta test), no las de producción. El código aísla esto en una sola constante (`OCA_EPAK_OPERATIVAS_POR_TIPO`, separada de las `OPERATIVAS` que ya usa `cotizarOCA`) para que el cambio a producción sea reemplazar esa constante, no tocar lógica.

Cuando OCA habilite la cuenta real, el cambio queda acotado a:

1. Cambiar la URL base al endpoint de producción (`webservice.oca.com.ar/ePak_tracking/...`).
2. Reemplazar usuario/contraseña de prueba por las reales, vía Firebase secret (mismo patrón que `SENDGRID_API_KEY`: `firebase functions:secrets:set OCA_EPAK_USER` / `OCA_EPAK_PSW`, y agregar `.runWith({ secrets: [...] })`), dejando una nota comentada en el código como ya existe para SendGrid.
3. Reemplazar `OCA_EPAK_OPERATIVAS_POR_TIPO` por el centro de costo real de las Operativas `467765`/`467764`, obtenido con `GetCentroCostoPorOperativa` contra la cuenta real.

### 4. Resultado exitoso: datos guardados + etiqueta por mail

Si OCA confirma el envío, se actualiza el documento del pedido con:

```
envioOCA: {
  numeroEnvio: "...",
  numeroOrdenRetiro: "...",
  generadoEn: <timestamp>
}
```

Se llama a `GetPdfDeEtiquetasPorOrdenOrNumeroEnvio` con el número de envío para obtener la etiqueta en PDF, y se adjunta directamente al mail de "Nuevo pedido" que ya recibe el vendedor (`construirMailVendedor`). No se persiste el PDF en Storage ni se monta infraestructura nueva — si se necesita de nuevo más adelante, se puede volver a pedir a OCA con el número de envío guardado.

El mail de confirmación al cliente (`construirMailCliente`) suma el número de seguimiento cuando está disponible.

**Dependencia conocida:** hoy `enviarEmail` omite el envío en silencio porque `SENDGRID_API_KEY` no existe todavía (ver CLAUDE.md). Mientras eso no se resuelva, la etiqueta se genera y el número de envío queda guardado en Firestore, pero no le llega a nadie por mail — el vendedor tendría que buscarla a mano en el portal e-Pak con el `numeroEnvio` guardado. Esto se resuelve solo cuando SendGrid quede configurado; no es un problema nuevo de este desarrollo.

### 5. Resultado fallido: no bloquea el checkout

Mismo patrón que ya usa el envío de mails (`functions/index.js:312-321`): la llamada a OCA va en su propio `try/catch`, separado de la lógica principal de `crearPedido`. Si falla (servicio caído, CP rechazado, lo que sea), se guarda:

```
envioOCA: { error: "<mensaje>" }
```

y el pedido se crea y responde igual al cliente con `201`. El vendedor ve el error en el documento del pedido y genera el envío a mano esa vez.

## Testing

- Contra el ambiente de QA de OCA, con los datos de prueba documentados, casos:
  - `oca_domicilio` exitoso: verificar que `envioOCA.numeroEnvio` queda guardado y que se intenta adjuntar la etiqueta.
  - `oca_sucursal` exitoso: idem, sin dirección de domicilio.
  - Falla del webservice (mockeando una respuesta de error o un corte de red): verificar que el pedido se crea igual con `envioOCA.error` y responde `201`.
  - `envio.tipo === "retiro"`: verificar que no se llama a `generarEnvioOCA` en absoluto.
- No hay testing end-to-end contra producción posible hasta tener las credenciales reales — eso queda pendiente para cuando OCA las entregue.

## Prerrequisito externo (no depende de desarrollo)

Antes de poder pasar esto a producción, el dueño del proyecto necesita pedirle a su ejecutivo de cuenta en OCA:

1. Usuario y contraseña del portal e-Pak (`ocaepak.oca.com.ar`).
2. Confirmación de que la cuenta corporativa está habilitada para `IngresoORMultiplesRetiros` (generación de envíos), no solo para tarifación.
3. El centro de costo asociado a las Operativas `467765` (sucursal) y `467764` (domicilio), vía `GetCentroCostoPorOperativa`.

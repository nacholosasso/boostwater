const functions = require("firebase-functions");
const axios = require("axios");
const cors = require("cors")({ origin: true });
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// ====================================================
// TUS CREDENCIALES (Completá los datos vacíos)
// ====================================================
const OCA_CUIT = "23367019069"; // OCA exige el CUIT CON guiones. Lo formatearemos abajo por las dudas.
const OCA_CP_ORIGEN = "1430"; // Código Postal desde donde despachás. Ej: 1602
const OPERATIVAS = {
    sucursal: "467765", // SaS (Sucursal a Sucursal)
    domicilio: "467764"  // SaP (Sucursal a Puerta)
};

exports.cotizarOCA = functions.https.onRequest((req, res) => {
    // El middleware CORS permite que tu dominio pueda hacer peticiones a esta función
    cors(req, res, async () => {
        if (req.method !== "POST") {
            return res.status(405).send("Method Not Allowed");
        }

        // Recibimos los datos del carrito desde el frontend
        const { cpDestino, peso = 1, volumen = 0.01, valorDeclarado = 10000 } = req.body;

        if (!cpDestino) {
            return res.status(400).json({ error: "Falta el código postal de destino" });
        }

        try {
            // Formateamos los números. OCA exige el CUIT con guiones y suele fallar con valores declarados excesivos o con decimales.
            const pPeso = Math.max(0.1, Number(peso)).toFixed(2);
            const pVol = Math.max(0.0001, Number(volumen)).toFixed(4);
            
            // OCA tiene un límite máximo de Valor Declarado (generalmente alrededor de $500.000 - $1.000.000). 
            // Si el carrito supera este valor, OCA rechaza la cotización devolviendo un XML con <Error>.
            const MAX_SEGURO_OCA = 1000000;
            const pValor = Math.min(Math.round(Number(valorDeclarado)), MAX_SEGURO_OCA);

            // Aseguramos que el CUIT tenga guiones (ej: 23-36701906-9)
            const cLimpio = OCA_CUIT.replace(/\D/g, '');
            const pCuit = cLimpio.length === 11 ? `${cLimpio.slice(0, 2)}-${cLimpio.slice(2, 10)}-${cLimpio.slice(10)}` : OCA_CUIT;

            // Función auxiliar para consultar a la API web service de OCA
            const consultarOperativa = async (operativa) => {
                const url = `https://webservice.oca.com.ar/oep_tracking/Oep_Track.asmx/Tarifar_Envio_Corporativo?PesoTotal=${pPeso}&VolumenTotal=${pVol}&CodigoPostalOrigen=${OCA_CP_ORIGEN}&CodigoPostalDestino=${cpDestino}&CantidadPaquetes=1&ValorDeclarado=${pValor}&Cuit=${pCuit}&Operativa=${operativa}`;
                
                try {
                    const response = await axios.get(url);
                    const xml = response.data;
                    
                    // Extraemos Total (Precio + Seguro) en lugar de solo Precio para evitar cobrarle de menos al cliente
                    const totalMatch = xml.match(/<Total>(.*?)<\/Total>/i);
                    const precioMatch = xml.match(/<Precio>(.*?)<\/Precio>/);
                    const diasMatch = xml.match(/<PlazoEntrega>(.*?)<\/PlazoEntrega>/);
                    const errorMatch = xml.match(/<Error>(.*?)<\/Error>/);
                    
                    if (errorMatch && errorMatch[1]) console.error(`Error OCA en ${operativa}:`, errorMatch[1]);
                    
                    const precioFinalStr = totalMatch ? totalMatch[1] : (precioMatch ? precioMatch[1] : null);
                    const precio = precioFinalStr ? parseFloat(precioFinalStr) : null;
                    const dias = diasMatch ? diasMatch[1] : "3 a 5";
                    
                    return { precio, dias };
                } catch (err) {
                    console.error(`Error de red al consultar OCA ${operativa}:`, err.message);
                    return { precio: null, dias: null };
                }
            };

            // Consultamos Sucursal y Domicilio al mismo tiempo para ganar velocidad
            const [cotizSucursal, cotizDomicilio] = await Promise.all([
                consultarOperativa(OPERATIVAS.sucursal),
                consultarOperativa(OPERATIVAS.domicilio)
            ]);

            const resultados = [];
            
            if (cotizSucursal.precio) {
                resultados.push({
                    nombre: "OCA - Retiro en Sucursal",
                    precio: cotizSucursal.precio,
                    dias: cotizSucursal.dias
                });
            }
            
            if (cotizDomicilio.precio) {
                resultados.push({
                    nombre: "OCA - Envío a Domicilio",
                    precio: cotizDomicilio.precio,
                    dias: cotizDomicilio.dias
                });
            }

            res.status(200).json(resultados);

        } catch (error) {
            console.error("Error consultando a OCA:", error);
            res.status(500).json({ error: "Error al calcular el envío" });
        }
    });
});

// ====================================================
// ENVÍO DE MAILS (SendGrid - Single Sender Verification,
// no requiere dominio propio). La API Key se guarda como secreto
// con: firebase functions:secrets:set SENDGRID_API_KEY
// ====================================================
const EMAIL_REMITENTE = "boostwater@outlook.com.ar";
const EMAIL_VENDEDOR = "boostwater@outlook.com.ar";

async function enviarEmail({ to, subject, html }) {
    // Mientras no esté el Sender Identity verificado en SendGrid, el secreto
    // no existe todavía: se omite el envío en vez de romper la creación del pedido.
    if (!process.env.SENDGRID_API_KEY) {
        console.warn(`SENDGRID_API_KEY no configurado: se omite el mail a ${to} ("${subject}")`);
        return;
    }
    await axios.post("https://api.sendgrid.com/v3/mail/send", {
        personalizations: [{ to: [{ email: to }] }],
        from: { email: EMAIL_REMITENTE, name: "BoostWater" },
        subject,
        content: [{ type: "text/html", value: html }]
    }, {
        headers: {
            Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
            "Content-Type": "application/json"
        }
    });
}

function formatPrecio(valor) {
    return new Intl.NumberFormat("es-AR").format(valor);
}

function construirDireccionHtml(direccion) {
    if (!direccion) return "";
    return `<p><strong>Dirección de entrega:</strong><br>${direccion.calle} ${direccion.numero}${direccion.piso ? ", " + direccion.piso : ""}, ${direccion.localidad}, ${direccion.provincia} (CP ${direccion.cp})</p>`;
}

function construirItemsHtml(items) {
    return items.map(it => `
        <tr>
            <td style="padding:4px 0;">${it.cantidad}x ${it.nombre}</td>
            <td style="padding:4px 0; text-align:right;">$${formatPrecio(it.subtotal)}</td>
        </tr>
    `).join("");
}

function construirNotaPago(pedido) {
    if (pedido.metodoPago === "transferencia") {
        return "<p>En breve nos contactamos por WhatsApp para coordinar el pago por transferencia o depósito.</p>";
    }
    if (pedido.metodoPago === "efectivo") {
        return "<p>Podés abonar en efectivo cuando retires tu pedido en el local.</p>";
    }
    return "";
}

function construirMailCliente(pedido, pedidoId) {
    const numeroPedido = pedidoId.slice(-6).toUpperCase();
    const notaPago = construirNotaPago(pedido);
    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#1f2937;">
            <h2 style="color:#0f172a;">¡Gracias por tu compra, ${pedido.cliente.nombre}!</h2>
            <p>Recibimos tu pedido <strong>#${numeroPedido}</strong>. Este es el resumen:</p>
            <table style="width:100%; border-collapse: collapse;">${construirItemsHtml(pedido.items)}</table>
            <hr>
            <p>Envío: ${pedido.envio.nombre} ${pedido.envio.costo > 0 ? "($" + formatPrecio(pedido.envio.costo) + ")" : "(Gratis)"}</p>
            ${construirDireccionHtml(pedido.direccion)}
            <p style="font-size:18px;"><strong>Total: $${formatPrecio(pedido.totales.totalFinal)}</strong></p>
            <p style="color:#16a34a;"><strong>Pagando con transferencia: $${formatPrecio(pedido.totales.totalConTransferencia)}</strong></p>
            ${notaPago}
        </div>
    `;
}

function construirMailVendedor(pedido, pedidoId) {
    const numeroPedido = pedidoId.slice(-6).toUpperCase();
    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#1f2937;">
            <h2 style="color:#0f172a;">Nuevo pedido #${numeroPedido}</h2>
            <p><strong>Cliente:</strong> ${pedido.cliente.nombre} ${pedido.cliente.apellido}${pedido.cliente.dni ? " - DNI " + pedido.cliente.dni : ""}<br>
            <strong>Contacto:</strong> ${pedido.cliente.telefono} - ${pedido.cliente.email}</p>
            <table style="width:100%; border-collapse: collapse;">${construirItemsHtml(pedido.items)}</table>
            <hr>
            <p>Envío: ${pedido.envio.nombre} ${pedido.envio.costo > 0 ? "($" + formatPrecio(pedido.envio.costo) + ")" : "(Gratis)"}</p>
            ${construirDireccionHtml(pedido.direccion)}
            ${pedido.observaciones ? `<p><strong>Observaciones:</strong> ${pedido.observaciones}</p>` : ""}
            <p style="font-size:18px;"><strong>Total: $${formatPrecio(pedido.totales.totalFinal)}</strong> (método de pago: ${pedido.metodoPago})</p>
        </div>
    `;
}

// ====================================================
// CREAR PEDIDO
// Valida precios/stock contra Firestore (nunca confía en lo que
// manda el navegador) y persiste el pedido. No descuenta stock ni
// cobra todavía: eso se conecta cuando se sume Mercado Pago.
// Manda mail de confirmación al cliente y aviso al vendedor.
// ====================================================
const TIPOS_ENVIO_VALIDOS = ["retiro", "oca_sucursal", "oca_domicilio"];
const METODOS_PAGO_VALIDOS = ["transferencia", "efectivo"]; // se sumará "mercadopago" más adelante

// Nota: cuando esté el secreto SENDGRID_API_KEY seteado
// (firebase functions:secrets:set SENDGRID_API_KEY), agregar de nuevo
// .runWith({ secrets: ["SENDGRID_API_KEY"] }) antes de .https para que
// quede disponible como variable de entorno en runtime.
exports.crearPedido = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        if (req.method !== "POST") {
            return res.status(405).send("Method Not Allowed");
        }

        const { items, envio, cliente, direccion, observaciones, metodoPago } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "El carrito está vacío" });
        }
        if (!cliente || !cliente.nombre || !cliente.apellido || !cliente.email || !cliente.telefono) {
            return res.status(400).json({ error: "Faltan datos del cliente" });
        }
        if (!envio || !TIPOS_ENVIO_VALIDOS.includes(envio.tipo)) {
            return res.status(400).json({ error: "Falta seleccionar el tipo de entrega" });
        }
        if (!METODOS_PAGO_VALIDOS.includes(metodoPago)) {
            return res.status(400).json({ error: "Método de pago inválido" });
        }
        if (metodoPago === "efectivo" && envio.tipo !== "retiro") {
            return res.status(400).json({ error: "El pago en efectivo solo está disponible para retiro en el local" });
        }

        const requiereDireccion = envio.tipo === "oca_domicilio";
        if (requiereDireccion && (!direccion || !direccion.calle || !direccion.numero || !direccion.localidad || !direccion.provincia || !direccion.cp)) {
            return res.status(400).json({ error: "Faltan datos de la dirección de entrega" });
        }

        try {
            let totalProductos = 0;
            const itemsValidados = [];

            for (const item of items) {
                if (!item.id || !Number.isInteger(item.cantidad) || item.cantidad < 1) {
                    return res.status(400).json({ error: "Hay un item del carrito inválido" });
                }

                const productoSnap = await db.collection("productos").doc(item.id).get();
                if (!productoSnap.exists) {
                    return res.status(400).json({ error: "Uno de los productos ya no existe" });
                }

                const producto = productoSnap.data();
                if (!producto.Publicado_) {
                    return res.status(400).json({ error: `${producto.Nombre_} ya no está disponible` });
                }
                if (producto.Stock_ < item.cantidad) {
                    return res.status(409).json({ error: `Sin stock suficiente de ${producto.Nombre_}` });
                }

                const subtotal = producto.Precio_ * item.cantidad;
                totalProductos += subtotal;
                itemsValidados.push({
                    productoId: item.id,
                    nombre: producto.Nombre_,
                    precio: producto.Precio_,
                    cantidad: item.cantidad,
                    subtotal
                });
            }

            // El costo de envío todavía viene del frontend (cotización de OCA).
            // Para "retiro" lo forzamos a 0. Cuando se conecte Mercado Pago hay que
            // volver a cotizar contra OCA en el servidor antes de cobrar.
            const costoEnvio = envio.tipo === "retiro" ? 0 : Math.max(0, Number(envio.costo) || 0);
            const totalFinal = totalProductos + costoEnvio;
            const totalConTransferencia = Math.round(totalProductos * 0.93) + costoEnvio;

            const pedido = {
                estado: "pendiente",
                metodoPago,
                items: itemsValidados,
                envio: {
                    tipo: envio.tipo,
                    nombre: envio.nombre || "",
                    costo: costoEnvio
                },
                cliente: {
                    nombre: cliente.nombre,
                    apellido: cliente.apellido,
                    email: cliente.email,
                    telefono: cliente.telefono,
                    dni: cliente.dni || null
                },
                direccion: requiereDireccion ? {
                    calle: direccion.calle,
                    numero: direccion.numero,
                    piso: direccion.piso || null,
                    localidad: direccion.localidad,
                    provincia: direccion.provincia,
                    cp: direccion.cp
                } : null,
                observaciones: observaciones || null,
                totales: { totalProductos, totalEnvio: costoEnvio, totalFinal, totalConTransferencia },
                creadoEn: admin.firestore.FieldValue.serverTimestamp()
            };

            const ref = await db.collection("pedidos").add(pedido);

            // El mail es una confirmación, no el corazón de la operación: si falla,
            // el pedido ya quedó guardado y no debe devolver error al cliente.
            try {
                await Promise.all([
                    enviarEmail({ to: pedido.cliente.email, subject: `Confirmación de tu pedido #${ref.id.slice(-6).toUpperCase()} - BoostWater`, html: construirMailCliente(pedido, ref.id) }),
                    enviarEmail({ to: EMAIL_VENDEDOR, subject: `Nuevo pedido #${ref.id.slice(-6).toUpperCase()}`, html: construirMailVendedor(pedido, ref.id) })
                ]);
            } catch (emailError) {
                console.error("El pedido se creó pero falló el envío de mails:", emailError.message);
            }

            res.status(201).json({ pedidoId: ref.id, totales: pedido.totales });

        } catch (error) {
            console.error("Error creando pedido:", error);
            res.status(500).json({ error: "Error al crear el pedido" });
        }
    });
});
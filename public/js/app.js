import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBmG7ArDKd1yCvH55VJzn9xGgIZbWx7FMw",
    authDomain: "boostwater-497012.firebaseapp.com",
    projectId: "boostwater-497012",
    storageBucket: "boostwater-497012.firebasestorage.app",
    messagingSenderId: "490829589649",
    appId: "1:490829589649:web:625d58e92eb65b5dd9a330"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ============================================
// CARGA DE COMPONENTES GLOBALES (Navbar)
// ============================================
async function cargarComponentes() {
    const navbarEl = document.getElementById('navbar-container');
    if (navbarEl) {
        const res = await fetch('./components/navbar.html');
        navbarEl.innerHTML = await res.text();
        
        // Colorear el enlace activo automáticamente
        const path = window.location.pathname.split('/').pop() || 'index.html';
        document.querySelectorAll('#navbar-container a').forEach(link => {
            if (link.getAttribute('href') === path) {
                link.classList.add('text-brand-500');
                link.classList.remove('text-gray-600');
            }
        });

        // Cargar Footer dinámicamente
        const footerEl = document.getElementById('footer-container');
        if (footerEl) {
            const res = await fetch('./components/footer.html');
            footerEl.innerHTML = await res.text();
        }

        // Cargar Carrito dinámicamente
        const cartEl = document.getElementById('cart-container');
        if (cartEl) {
            const res = await fetch('./components/cart.html');
            cartEl.innerHTML = await res.text();
        }

        // Cargar WhatsApp dinámicamente
        const waEl = document.getElementById('whatsapp-container');
        if (waEl) {
            const res = await fetch('./components/whatsapp.html');
            waEl.innerHTML = await res.text();
        }

        renderizarCarrito(); // Actualizar contador al inyectar el HTML
    }
}
cargarComponentes();

// ============================================
// CARRUSEL HERO (Solo en index.html)
// ============================================
const slides = document.querySelectorAll('.hero-slide');
const dots = document.querySelectorAll('.carousel-dot');
if (slides.length > 0) {
    let currentSlide = 0;
    const showSlide = (index) => {
        slides[currentSlide].classList.remove('opacity-70', 'active-slide');
        slides[currentSlide].classList.add('opacity-0');
        dots[currentSlide].classList.remove('opacity-100');
        dots[currentSlide].classList.add('opacity-50');
        
        currentSlide = index;
        
        slides[currentSlide].classList.remove('opacity-0');
        slides[currentSlide].classList.add('opacity-70', 'active-slide');
        dots[currentSlide].classList.remove('opacity-50');
        dots[currentSlide].classList.add('opacity-100');
    };

    setInterval(() => {
        let next = (currentSlide + 1) % slides.length;
        showSlide(next);
    }, 5000);

    dots.forEach((dot, idx) => {
        dot.addEventListener('click', () => showSlide(idx));
    });
}

// ============================================
// LÓGICA GLOBAL DEL CARRITO Y ENVÍOS
// ============================================

let carrito = JSON.parse(localStorage.getItem('carrito')) || [];
let costoEnvioGlobal = 0;
let nombreEnvioGlobal = 'Retiro en local';

function formatPrecio(valor) {
    return new Intl.NumberFormat('es-AR').format(valor);
}


function renderizarCarrito() {
    const contenedorCarrito = document.getElementById('contenedor-carrito');
    const totalCarritoEl = document.getElementById('total-carrito');
    const btnPagar = document.getElementById('btn-pagar');

    if (!contenedorCarrito) return;
    contenedorCarrito.innerHTML = '';
    let total = 0; let cantidadTotal = 0;

    if (carrito.length === 0) {
        contenedorCarrito.innerHTML = '<p class="text-gray-500 text-center mt-10 text-sm">El carrito está vacío.</p>';
        if (btnPagar) btnPagar.style.display = 'none';
        if (totalCarritoEl) totalCarritoEl.textContent = '0';
        const totalCarritoDescuentoEl = document.getElementById('total-carrito-descuento');
        if (totalCarritoDescuentoEl) totalCarritoDescuentoEl.textContent = '0';
        const mensajePago = document.getElementById('mensaje-pago');
        if (mensajePago) mensajePago.classList.add('hidden');
        const cartCount = document.getElementById('cart-count');
        if (cartCount) cartCount.textContent = '0';
        const calcSection = document.getElementById('envio-calculator-section');
        if (calcSection) calcSection.classList.add('hidden');
        const resGlobal = document.getElementById('resumen-envio-global');
        if (resGlobal) resGlobal.classList.add('hidden');
        return;
    }

    const calcSection = document.getElementById('envio-calculator-section');
    if (calcSection) calcSection.classList.remove('hidden');

    carrito.forEach((item, index) => {
        total += item.precio * item.cantidad;
        cantidadTotal += item.cantidad;
        
        contenedorCarrito.insertAdjacentHTML('beforeend', `
            <div class="flex justify-between items-start bg-white p-3 rounded-lg border shadow-sm mb-3">
                <div class="flex-1">
                    <h4 class="text-sm font-semibold text-gray-800 line-clamp-1">${item.nombre}</h4>
                    <div class="flex items-center gap-2 mt-1">
                        <input type="number" min="1" max="${item.stock}" value="${item.cantidad}" class="input-cantidad w-16 px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500" data-index="${index}">
                        <p class="text-xs text-gray-500">x $${formatPrecio(item.precio)}</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <div class="text-right">
                        <span class="font-bold text-brand-900 text-sm">$${formatPrecio(item.precio * item.cantidad)}</span>
                    </div>
                    <button class="btn-eliminar text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded-md transition" data-index="${index}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
            </div>
        `);
    });

    if (totalCarritoEl) totalCarritoEl.textContent = formatPrecio(total + costoEnvioGlobal);
    const totalCarritoDescuentoEl = document.getElementById('total-carrito-descuento');
    if (totalCarritoDescuentoEl) {
        const totalConDescuento = Math.round(total * 0.93) + costoEnvioGlobal;
        totalCarritoDescuentoEl.textContent = formatPrecio(totalConDescuento);
    }
    const resGlobal = document.getElementById('resumen-envio-global');
    if (resGlobal) {
        if (nombreEnvioGlobal) {
            resGlobal.classList.remove('hidden');
            document.getElementById('resumen-envio-nombre').textContent = nombreEnvioGlobal;
            if (costoEnvioGlobal === 0 && nombreEnvioGlobal.includes('coordinar')) {
                document.getElementById('resumen-envio-costo').textContent = '-';
            } else {
                document.getElementById('resumen-envio-costo').textContent = costoEnvioGlobal > 0 ? '$' + formatPrecio(costoEnvioGlobal) : 'Gratis';
            }
        } else {
            resGlobal.classList.add('hidden');
        }
    }
    
    const cartCount = document.getElementById('cart-count');
    if (cartCount) cartCount.textContent = cantidadTotal;
    if (btnPagar) btnPagar.style.display = 'block';
    const mensajePago = document.getElementById('mensaje-pago');
    if (mensajePago) mensajePago.classList.remove('hidden');
    localStorage.setItem('carrito', JSON.stringify(carrito));
}

const toggleCart = () => {
    const cartSidebar = document.getElementById('cart-sidebar');
    const cartOverlay = document.getElementById('cart-overlay');
    if (!cartSidebar || !cartOverlay) return;
    cartSidebar.classList.toggle('translate-x-full');
    if (cartOverlay.classList.contains('hidden')) {
        cartOverlay.classList.remove('hidden');
        setTimeout(() => cartOverlay.classList.remove('opacity-0'), 10);
    } else {
        cartOverlay.classList.add('opacity-0');
        setTimeout(() => cartOverlay.classList.add('hidden'), 300);
    }
};

document.addEventListener('click', async (e) => {
    // Interacciones dinámicas del Navbar y Carrito
    if (e.target.id === 'cart-overlay' || e.target.closest('#cart-toggle') || e.target.closest('#cart-close')) {
        toggleCart();
    }
    const btnMenu = e.target.closest('#mobile-menu-btn');
    const linkMenu = e.target.closest('#mobile-menu a');
    const menuMovil = document.getElementById('mobile-menu');
    if (btnMenu && menuMovil) {
        menuMovil.classList.toggle('hidden');
        menuMovil.classList.toggle('flex');
    } else if (linkMenu && menuMovil) {
        menuMovil.classList.add('hidden');
        menuMovil.classList.remove('flex');
    }

    const btnAgregar = e.target.closest('.btn-agregar');
    if (btnAgregar) {
        const id = btnAgregar.getAttribute('data-id');
        const nombre = btnAgregar.getAttribute('data-nombre');
        const precio = parseFloat(btnAgregar.getAttribute('data-precio'));
        const stock = parseInt(btnAgregar.getAttribute('data-stock'));
        const pesoProd = parseFloat(btnAgregar.getAttribute('data-peso'));
        const altoProd = parseFloat(btnAgregar.getAttribute('data-alto'));
        const anchoProd = parseFloat(btnAgregar.getAttribute('data-ancho'));
        const largoProd = parseFloat(btnAgregar.getAttribute('data-largo'));
        
        const inputCant = document.getElementById('cantidad-producto');
        const cantidadDeseada = inputCant ? parseInt(inputCant.value) : 1;

        if (isNaN(cantidadDeseada) || cantidadDeseada < 1) {
            alert('Por favor, ingresa una cantidad válida.');
            return;
        }

        const index = carrito.findIndex(item => item.id === id);
        if (index !== -1) {
            if (carrito[index].cantidad + cantidadDeseada <= stock) {
                carrito[index].cantidad += cantidadDeseada;
            } else {
                alert(`¡Atención! Solo tenemos ${stock} unidad(es) disponible(s) de este producto. Ya tienes ${carrito[index].cantidad} en el carrito.`);
                return;
            }
        } else {
            if (stock > 0 && cantidadDeseada <= stock) {
                carrito.push({ id, nombre, precio, cantidad: cantidadDeseada, stock: stock, peso: pesoProd, alto: altoProd, ancho: anchoProd, largo: largoProd });
            } else if (cantidadDeseada > stock) {
                alert(`¡Atención! Solo tenemos ${stock} unidad(es) disponible(s) de este producto.`);
                return;
            }
        }
        renderizarCarrito();
        if (cartSidebar && cartSidebar.classList.contains('translate-x-full')) toggleCart();
    }

    const btnEliminar = e.target.closest('.btn-eliminar');
    if (btnEliminar) {
        const index = btnEliminar.getAttribute('data-index');
        carrito.splice(index, 1);
        renderizarCarrito();
    }


    // ============================================
    // ACCIÓN: FINALIZAR COMPRA (Enviar a WhatsApp)
    // ============================================
    const btnPagarClick = e.target.closest('#btn-pagar');
    if (btnPagarClick) {
        if (carrito.length === 0) return;
        
        let textoWhatsApp = "¡Hola! Quiero realizar el siguiente pedido:%0A%0A";
        
        carrito.forEach(item => {
            textoWhatsApp += `- ${item.cantidad}x ${item.nombre} ($${formatPrecio(item.precio * item.cantidad)})%0A`;
        });
        
        let totalProd = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
        let totalDesc = Math.round(totalProd * 0.93) + costoEnvioGlobal;
        let totalStd = totalProd + costoEnvioGlobal;
        
        if (costoEnvioGlobal > 0) {
            textoWhatsApp += `%0A📦 Envío: ${nombreEnvioGlobal} ($${formatPrecio(costoEnvioGlobal)})`;
        } else if (nombreEnvioGlobal === 'Retiro en local') {
            textoWhatsApp += `%0A📦 Envío: Retiro en local (Gratis)`;
        } else {
            textoWhatsApp += `%0A📦 Envío: ${nombreEnvioGlobal}`;
        }

        textoWhatsApp += `%0A%0A*Total:* $${formatPrecio(totalStd)}`;
        textoWhatsApp += `%0A*Pagando con Transferencia:* $${formatPrecio(totalDesc)}%0A`;
        textoWhatsApp += `%0A¡Espero la confirmación para avanzar con el pago!`;

        const numeroWhatsApp = "5491134519455";
        const url = `https://wa.me/${numeroWhatsApp}?text=${textoWhatsApp}`;
        window.open(url, '_blank');
    }
});

document.addEventListener('change', (e) => {
    if (e.target.classList.contains('input-cantidad')) {
        const index = e.target.getAttribute('data-index');
        let nuevaCantidad = parseInt(e.target.value);
        const maxStock = carrito[index].stock;

        if (isNaN(nuevaCantidad) || nuevaCantidad < 1) {
            nuevaCantidad = 1;
        } else if (nuevaCantidad > maxStock) {
            alert(`¡Atención! Solo tenemos ${maxStock} unidad(es) disponible(s).`);
            nuevaCantidad = maxStock;
        }

        carrito[index].cantidad = nuevaCantidad;
        renderizarCarrito();
    }

    if (e.target.name === 'tipo-entrega') {
        if (e.target.value === 'envio') {
            costoEnvioGlobal = 0;
            nombreEnvioGlobal = 'Envío por correo (A coordinar)';
        } else {
            costoEnvioGlobal = 0;
            nombreEnvioGlobal = 'Retiro en local';
        }
        renderizarCarrito();
    }
});

renderizarCarrito();

// ============================================
// LÓGICA DE CATÁLOGO (index.html)
// ============================================
const contenedorProductos = document.getElementById('contenedor-productos');
if (contenedorProductos) {
    const qDocs = query(collection(db, "productos"), where("Publicado", "==", true));
    let productosCatalogo = [];
    let categoriaSeleccionada = null;

    function renderizarProductos(listaProductos) {
        contenedorProductos.innerHTML = '';
        if (listaProductos.length === 0) {
            contenedorProductos.innerHTML = '<p class="col-span-full text-center py-12 text-gray-500">No hay productos para esta categoría.</p>';
            return;
        }

        listaProductos.forEach((producto, index) => {
            const delay = (index % 4) * 100; // Crea un efecto cascada por fila
            const id = producto.id;
            const sinStock = producto.Stock <= 0;
            const tarjetaHTML = `
                <div class="bg-white rounded-2xl shadow-sm hover:shadow-2xl transition-all duration-300 overflow-hidden flex flex-col border border-gray-100 group" data-aos="fade-up" data-aos-delay="${delay}">
                    <a href="producto.html?id=${id}" class="block relative aspect-square overflow-hidden bg-gray-100">
                        ${sinStock ? '<div class="absolute top-3 left-3 bg-red-500 text-white text-[11px] font-black px-3 py-1 rounded-full uppercase z-10 shadow-md">Agotado</div>' : ''}
                        <img src="${producto.Imagen}" alt="${producto.Nombre}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerpolicy="no-referrer">
                    </a>
                    <div class="p-6 flex flex-col flex-grow">
                        ${producto.Categoria ? `<span class="text-xs font-bold text-brand-500 uppercase tracking-wider mb-1">${producto.Categoria}</span>` : ''}
                        <a href="producto.html?id=${id}">
                            <h3 class="text-lg font-bold text-gray-800 mb-2 line-clamp-2 hover:text-brand-500 transition-colors">${producto.Nombre}</h3>
                        </a>
                        ${producto.Descripcion_Corta ? `<p class="text-sm text-gray-500 mb-2 line-clamp-3">${producto.Descripcion_Corta}</p>` : ''}
                        ${!sinStock ? `<p class="text-xs font-bold text-green-600 mb-4">Stock disponible: ${producto.Stock}</p>` : ''}
                        <div class="mt-auto pt-4 flex items-center justify-between border-t border-gray-50">
                            <div>
                                <span class="text-2xl font-black text-brand-900 block">$${formatPrecio(producto.Precio)}</span>
                                <span class="text-[11px] font-bold text-green-600 block mt-1">$${formatPrecio(Math.round(producto.Precio * 0.93))} <span class="text-gray-500 font-medium">con Transferencia o depósito</span></span>
                            </div>
                            ${!sinStock ? `<button class="btn-agregar shrink-0 bg-brand-50 hover:bg-brand-500 text-brand-500 hover:text-white p-3 rounded-xl transition-colors shadow-sm ml-2" data-id="${id}" data-nombre="${producto.Nombre}" data-precio="${producto.Precio}" data-stock="${producto.Stock}" data-peso="${producto.Peso || 1}" data-alto="${producto.Alto || 10}" data-ancho="${producto.Ancho || 10}" data-largo="${producto.Largo || 10}"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg></button>` : ''}
                        </div>
                    </div>
                </div>
            `;
            contenedorProductos.insertAdjacentHTML('beforeend', tarjetaHTML);
        });
        
        // Le avisamos a la librería de animaciones que hay elementos nuevos en pantalla
        setTimeout(() => { if (typeof AOS !== 'undefined') AOS.refresh(); }, 100);
    }

    function aplicarFiltroCategoria(categoria) {
        categoriaSeleccionada = categoria === 'Todos' ? null : categoria;
        const productosFiltrados = categoriaSeleccionada ? productosCatalogo.filter(p => p.Categoria && p.Categoria.toLowerCase() === categoriaSeleccionada.toLowerCase()) : productosCatalogo;
        renderizarProductos(productosFiltrados);
        const filtroActivo = document.querySelectorAll('[data-categoria]');
        filtroActivo.forEach(el => {
            el.classList.toggle('text-brand-500', el.dataset.categoria === categoria);
            el.classList.toggle('font-bold', el.dataset.categoria === categoria);
        });
    }

    async function cargarProductos() {
        try {
            const snapshot = await getDocs(qDocs);
            contenedorProductos.innerHTML = ''; 

            if (snapshot.empty) {
                contenedorProductos.innerHTML = '<p>No hay productos publicados en este momento.</p>';
                return;
            }

            productosCatalogo = [];
            snapshot.forEach((docSnap) => {
                productosCatalogo.push({ id: docSnap.id, ...docSnap.data() });
            });

            const params = new URLSearchParams(window.location.search);
            const categoriaUrl = params.get('categoria');
            if (categoriaUrl) {
                aplicarFiltroCategoria(categoriaUrl);
            } else {
                renderizarProductos(productosCatalogo);
            }
        } catch (error) {
            console.error("Error al cargar productos:", error);
            contenedorProductos.innerHTML = '<div class="col-span-full text-center py-12"><p class="text-red-500">Ocurrió un error al cargar los productos.</p></div>';
        }
    }

    cargarProductos();

    document.querySelectorAll('[data-categoria]').forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const categoria = event.currentTarget.dataset.categoria;
            if (!categoria) return;
            const url = categoria === 'Todos'
                ? 'index.html#catalogo'
                : `index.html?categoria=${encodeURIComponent(categoria)}#catalogo`;
            window.history.replaceState(null, '', url);
            aplicarFiltroCategoria(categoria);
        });
    });
}

// ============================================
// LÓGICA DE PRODUCTO (producto.html)
// ============================================
const detalleProducto = document.getElementById('detalle-producto');
if (detalleProducto) {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    async function cargarDetalle() {
        if (!productId) {
            detalleProducto.innerHTML = '<div class="text-center py-20"><h2 class="text-3xl font-bold text-brand-900">Producto no encontrado</h2><a href="index.html" class="text-brand-500 mt-4 block underline">Volver al catálogo</a></div>';
            return;
        }

        try {
            const docRef = doc(db, "productos", productId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const prod = docSnap.data();
                const sinStock = prod.Stock <= 0;
                const specsFormat = prod.Especificaciones ? prod.Especificaciones.replace(/- /g, '<br>• ') : 'No hay especificaciones disponibles.';

                // Actualizar Pestaña SEO dinámicamente
                document.title = `${prod.Nombre} - BoostWater`;

                detalleProducto.innerHTML = `
                    <div class="mb-6" data-aos="fade-right"><a href="index.html#catalogo" class="text-brand-500 font-semibold hover:underline flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg> Volver</a></div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-12 bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-gray-100" data-aos="fade-up">
                        <div class="flex items-center justify-center bg-gray-50 rounded-2xl overflow-hidden p-4 relative">
                            ${sinStock ? '<div class="absolute top-4 left-4 bg-red-500 text-white font-black px-4 py-2 rounded-lg uppercase shadow-md">Agotado</div>' : ''}
                            <img src="${prod.Imagen}" alt="${prod.Nombre}" class="w-full max-w-md object-contain mix-blend-multiply">
                        </div>
                        <div class="flex flex-col justify-center">
                            <span class="text-brand-500 font-bold uppercase tracking-widest text-sm mb-2">${prod.Categoria || ''}</span>
                            <h1 class="text-3xl md:text-4xl lg:text-5xl font-black text-brand-900 mb-4 leading-tight">${prod.Nombre}</h1>
                            <div class="mb-6">
                                <p class="text-4xl font-black text-gray-800">$${formatPrecio(prod.Precio)}</p>
                                <p class="text-sm font-bold text-green-600 mt-2">$${formatPrecio(Math.round(prod.Precio * 0.93))} <span class="text-gray-500 font-medium">abonando con Transferencia o depósito bancario (7% OFF)</span></p>
                            </div>
                            <p class="text-gray-600 text-lg mb-4 leading-relaxed">${prod.Descripcion_Corta || ''}</p>
                        ${!sinStock ? `<p class="text-md font-bold text-green-600 mb-6">Stock disponible: ${prod.Stock}</p>` : ''}
                            ${!sinStock 
                          ? `<div class="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                                 <div class="flex items-center justify-center border border-gray-200 rounded-xl bg-white px-4 py-2">
                                     <span class="text-gray-500 text-sm font-bold mr-2">Cant:</span>
                                     <input type="number" id="cantidad-producto" min="1" max="${prod.Stock}" value="1" class="w-16 outline-none text-lg font-bold text-center text-brand-900 bg-transparent">
                                 </div>
                                 <button class="btn-agregar flex-1 bg-brand-500 hover:bg-brand-600 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-lg hover:shadow-brand-500/50 flex items-center justify-center gap-3 text-lg" data-id="${productId}" data-nombre="${prod.Nombre}" data-precio="${prod.Precio}" data-stock="${prod.Stock}" data-peso="${prod.Peso || 1}" data-alto="${prod.Alto || 10}" data-ancho="${prod.Ancho || 10}" data-largo="${prod.Largo || 10}">Agregar al Carrito</button>
                             </div>` 
                              : `<div class="bg-red-50 text-red-600 border border-red-200 font-bold py-4 px-6 rounded-xl text-center">Producto sin stock actualmente</div>`
                            }
                        </div>
                    </div>
                    
                    <!-- Descripciones y Especificaciones -->
                    <div class="mt-12 bg-white rounded-3xl shadow-sm border border-gray-100 p-8 md:p-12" data-aos="fade-up" data-aos-delay="200">
                        <h3 class="text-2xl font-black text-brand-900 mb-6 border-b pb-4">Descripción General</h3>
                        <p class="text-gray-600 leading-relaxed mb-12 text-lg whitespace-pre-line">${prod.Descripcion || 'No hay descripción disponible.'}</p>
                        
                        <h3 class="text-2xl font-black text-brand-900 mb-6 border-b pb-4">Especificaciones Técnicas</h3>
                        <p class="text-gray-600 leading-relaxed text-lg">${specsFormat}</p>
                    </div>
                `;
                // Recargar animaciones
                setTimeout(() => { if (typeof AOS !== 'undefined') AOS.refresh(); }, 100);
            } else {
                detalleProducto.innerHTML = '<div class="text-center py-20"><h2 class="text-3xl font-bold text-brand-900">Producto no encontrado</h2></div>';
            }
        } catch (error) {
            detalleProducto.innerHTML = '<div class="text-center py-20 text-red-500">Error al cargar producto.</div>';
        }
    }
    cargarDetalle();
}
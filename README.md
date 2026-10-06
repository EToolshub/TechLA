# TechLA — E-commerce Case Study

TechLA es un caso de estudio de UX/UI y frontend para un e-commerce de tecnología, diseñado para desktop y mobile.

## Dirección de producto
- Marca: TechLA
- Monograma: TL
- Paleta: blanco, negro, gris y rojo oscuro
- Tipografía: Inter
- Enfoque: conversión, claridad, confianza y motion con propósito

## Experiencia incluida
- Landing/home responsive
- Categorías y filtros
- Búsqueda instantánea
- Fichas de producto
- Wishlist persistente
- Comparador de hasta 3 productos
- Carrito persistente con cantidades
- Checkout responsive
- UI de pago para Bs, USDT y PayPal
- Estados de modal, carrito, búsqueda y comparación
- Hover/magnetic buttons
- Tilt 3D del hero
- Hover de tarjetas y quick add
- Reveal on scroll
- Marquee y floating chips
- `prefers-reduced-motion`

## Generador de QR gratis (`/qr/`)
Herramienta gratuita en `qr/index.html`, enlazada desde el menú de la tienda.

- Tipos: enlace, WiFi, WhatsApp, texto, correo y contacto (vCard).
- Diseño: 4 formas, colores con avisos de contraste, emoji o logo propio en el centro (sube la corrección de errores a «H» automáticamente).
- Descargas: PNG (512 / 1024 / 2048 px), SVG para imprenta, copiar imagen y compartir (si el navegador lo permite).
- 100 % en el navegador: sin servidor, sin registro, sin marca de agua. Los QR son estáticos y no caducan.
- Motor: [qr-code-styling](https://github.com/kozakdenys/qr-code-styling) 1.9.2 (MIT), copiado en `qr/lib/vendor/` para no depender de un CDN.
- Los huecos de publicidad (`.ad-slot`) están ocultos con `hidden`; para activar AdSense, pega el código dentro y quita el atributo.

## Publicación
El repositorio está preparado para GitHub Pages. `index.html` se encuentra en la raíz y no requiere build.

## Importante
Los métodos Bs, USDT y PayPal son una representación UX/UI. No existe todavía una pasarela ni backend real conectado. Para producción se debe integrar un backend, gestión de inventario, autenticación, proveedor de pagos, seguridad y políticas legales reales.

## Caso de estudio para Behance
La narrativa recomendada es: problema → investigación → arquitectura → decisiones de conversión → design system → responsive → motion → checkout → resultado.

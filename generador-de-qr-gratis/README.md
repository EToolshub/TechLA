# Generador de QR Gratis

Generador de códigos QR **gratis, sin registro y sin marca de agua**. Los códigos son estáticos: no caducan y no dependen de ningún servidor.

**Web:** https://generador-de-qr-gratis.vercel.app/

Un proyecto de [TechLA](https://tech-la-drab.vercel.app/).

## Qué hace
- **Tipos de QR:** enlace, WiFi, WhatsApp, texto, correo y contacto (vCard).
- **Diseño:** 4 formas (clásico, redondeado, puntos, elegante), colores y avisos de contraste, emoji o logo propio en el centro. Con logo, la corrección de errores sube a «H» automáticamente.
- **Descargas:** PNG (512 / 1024 / 2048 px), SVG para imprenta, copiar imagen y compartir (si el navegador lo permite). Indica el tamaño mínimo de impresión.
- **Privado:** todo ocurre en el navegador del visitante. No hay servidor, base de datos ni cuentas.
- Acentos, ñ y emojis se codifican en UTF-8 para que se lean bien en cualquier teléfono.

## Archivos
| Archivo | Para qué |
|---|---|
| `index.html` | La página: herramienta, textos, preguntas frecuentes y datos para Google (JSON-LD) |
| `qr.css` | Estilos |
| `main.js` | Lógica del generador |
| `lib/vendor/qr-code-styling.js` | Motor de QR, [qr-code-styling](https://github.com/kozakdenys/qr-code-styling) 1.9.2 (MIT), copiado para no depender de un CDN |
| `robots.txt`, `sitemap.xml` | Para que Google encuentre e indexe la web |
| `og-qr.png` | Imagen que aparece al compartir el enlace en WhatsApp o redes |
| `vercel.json` | Configuración de Vercel (caché y cabeceras) |
| `404.html` | Página de «no encontrada» |

No hay paso de compilación: son archivos estáticos. Para probarla en local:

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

## Publicación
Está publicada en Vercel (proyecto `generador-de-qr-gratis`). Si conectas este repositorio al proyecto en Vercel, cada cambio en `main` se publica solo.

Al cambiar `qr.css` o `main.js`, sube el número `?v=AAAAMMDD` en `index.html` para que los navegadores descarguen la versión nueva.

## Google
1. Entra en [Google Search Console](https://search.google.com/search-console) y añade la propiedad `https://generador-de-qr-gratis.vercel.app/` (tipo «Prefijo de URL»).
2. Verifícala con el archivo HTML (`google293f06e74ff88d87.html` ya está en la raíz) o con la etiqueta HTML que te dé Google.
3. En «Sitemaps», envía `sitemap.xml`.
4. En «Inspección de URLs», pide la indexación de la página principal.

## Publicidad
Los huecos para anuncios (`.ad-slot`) están en `index.html`, ocultos con `hidden`. Para activar AdSense, pega tu código dentro y quita el atributo. Antes, añade el aviso de cookies donde indica el comentario `TODO cookies` del `<head>`.

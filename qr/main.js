/* TechLA · Generador de códigos QR — todo se calcula en el navegador. */
(function () {
  "use strict";

  var $ = function (sel, scope) { return (scope || document).querySelector(sel); };
  var $$ = function (sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); };

  // Un preset de forma = las tres opciones de la librería a la vez.
  var STYLES = {
    clasico:    { dots: "square",         corners: "square",        cornerDot: "square" },
    redondeado: { dots: "rounded",        corners: "extra-rounded", cornerDot: "dot" },
    puntos:     { dots: "dots",           corners: "dot",           cornerDot: "dot" },
    elegante:   { dots: "classy-rounded", corners: "extra-rounded", cornerDot: "square" }
  };
  // Vista previa en canvas a alta resolución: el SVG reducido deja finas líneas blancas entre módulos.
  var PREVIEW_PX = 800;
  var EMPTY_MSG = {
    url: "Escribe tu enlace y tu QR aparecerá aquí",
    wifi: "Escribe el nombre de tu red WiFi",
    whatsapp: "Escribe tu número de WhatsApp",
    text: "Escribe tu texto y tu QR aparecerá aquí",
    email: "Escribe el correo de destino",
    vcard: "Escribe al menos un nombre, teléfono o correo"
  };

  var state = {
    type: "url",
    style: "clasico",
    fg: "#0b0b0c",
    bg: "#ffffff",
    logo: null,         // dataURL de la imagen central (emoji o logo subido)
    logoKind: "",       // "" | "emoji" | "file"
    fileLogo: null,     // último logo subido (se conserva para volver a él)
    size: 1024,
    payload: "",
    name: "qr",
    modules: 0
  };

  var preview = null;   // instancia de QRCodeStyling de la vista previa
  var card = null;

  // ---------- Utilidades ----------
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }

  // La librería escribe cada carácter como un byte (Latin-1): pasamos el texto
  // ya codificado en UTF-8 para que ñ, tildes, € y emojis se lean bien.
  function utf8(str) {
    var bytes = new TextEncoder().encode(str), out = "";
    for (var i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
    return out;
  }

  function slug(str) {
    return String(str || "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  }

  function toast(text) {
    var el = $("#toast");
    if (!el) return;
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { el.classList.remove("show"); }, 2200);
  }

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  function safe(fn, name) {
    try { fn(); } catch (e) { console.warn("[" + name + "] falló:", e); }
  }

  // ---------- Contenido → texto del QR ----------
  function normalizeUrl(raw) {
    if (!raw) return "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;               // ya trae https:, mailto:, tel:…
    if (/^[^\s]+\.[^\s]{2,}$/.test(raw)) return "https://" + raw;  // dominio suelto
    return raw;
  }

  function escWifi(s) { return s.replace(/([\\;,:"])/g, "\\$1"); }
  function escVcard(s) { return s.replace(/\\/g, "\\\\").replace(/([;,])/g, "\\$1"); }

  function buildPayload() {
    var t = state.type, out = { text: "", name: "qr", notes: [] };
    if (t === "url") {
      var raw = val("f-url"), url = normalizeUrl(raw);
      out.text = url;
      if (url) {
        var host = "";
        try { host = new URL(url).hostname.replace(/^www\./, ""); } catch (_) {}
        out.name = "qr-" + (slug(host) || slug(raw) || "enlace");
        if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) out.notes.push(["info", "Esto no parece un enlace: el QR mostrará el texto tal cual."]);
        else if (url.length > 300) out.notes.push(["warn", "Es un enlace muy largo: el QR saldrá muy denso. Si puedes, usa uno más corto."]);
      }
    } else if (t === "wifi") {
      var ssid = val("f-ssid"), pass = $("#f-pass").value, sec = $("#f-sec").value, hidden = $("#f-hidden").checked;
      if (ssid) {
        out.text = "WIFI:T:" + sec + ";S:" + escWifi(ssid) + ";" +
          (sec !== "nopass" ? "P:" + escWifi(pass) + ";" : "") +
          (hidden ? "H:true;" : "") + ";";
        out.name = "qr-wifi-" + (slug(ssid) || "red");
        if (sec !== "nopass" && !pass) out.notes.push(["warn", "Falta la contraseña. Si tu red no tiene, elige «Sin contraseña»."]);
      }
      $("#f-pass").disabled = sec === "nopass";
    } else if (t === "whatsapp") {
      var digits = val("f-wa").replace(/^\+/, "").replace(/\D/g, "").replace(/^00/, ""), msg = val("f-wa-msg");
      if (digits) {
        out.text = "https://wa.me/" + digits + (msg ? "?text=" + encodeURIComponent(msg) : "");
        out.name = "qr-whatsapp-" + digits.slice(-4);
        if (digits.length < 8 || digits.length > 15) out.notes.push(["warn", "Revisa el número: debe incluir el código de país (por ejemplo 58 para Venezuela)."]);
        else if (/^0/.test(digits)) out.notes.push(["warn", "El número empieza por 0. Escribe primero el código de país y quita el 0 inicial (58 412…, no 0412…)."]);
      }
    } else if (t === "text") {
      var txt = $("#f-text").value;
      $("#text-count").textContent = String(txt.length);
      if (txt.trim()) { out.text = txt; out.name = "qr-" + (slug(txt.split(/\s+/).slice(0, 4).join(" ")) || "texto"); }
    } else if (t === "email") {
      var to = val("f-mail"), sub = val("f-mail-sub"), body = val("f-mail-body"), q = [];
      if (to) {
        if (sub) q.push("subject=" + encodeURIComponent(sub));
        if (body) q.push("body=" + encodeURIComponent(body));
        out.text = "mailto:" + to + (q.length ? "?" + q.join("&") : "");
        out.name = "qr-correo-" + (slug(to.split("@")[0]) || "contacto");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) out.notes.push(["warn", "Revisa el correo: parece incompleto."]);
      }
    } else if (t === "vcard") {
      var name = val("f-vc-name"), tel = val("f-vc-tel"), mail = val("f-vc-mail"), org = val("f-vc-org"), web = normalizeUrl(val("f-vc-web"));
      if (name || tel || mail) {
        var parts = name.split(/\s+/), last = parts.length > 1 ? parts.pop() : "", first = parts.join(" ");
        var lines = ["BEGIN:VCARD", "VERSION:3.0", "N:" + escVcard(last) + ";" + escVcard(first) + ";;;", "FN:" + escVcard(name || tel || mail)];
        if (org) lines.push("ORG:" + escVcard(org));
        if (tel) lines.push("TEL;TYPE=CELL:" + tel.replace(/[^\d+]/g, ""));
        if (mail) lines.push("EMAIL:" + mail);
        if (web) lines.push("URL:" + web);
        lines.push("END:VCARD");
        out.text = lines.join("\r\n");
        out.name = "qr-contacto-" + (slug(name) || "tarjeta");
      }
    }
    return out;
  }

  // ---------- Opciones de la librería ----------
  function qrOptions(size, type) {
    var st = STYLES[state.style] || STYLES.clasico;
    var opts = {
      width: size,
      height: size,
      type: type,
      data: utf8(state.payload),
      margin: Math.round(size * 0.06),
      qrOptions: { errorCorrectionLevel: state.logo ? "H" : "M" },
      // En SVG clásico, bordes nítidos (crispEdges) para que no aparezcan uniones entre cuadrados.
      dotsOptions: { type: st.dots, color: state.fg, roundSize: !(type === "svg" && state.style === "clasico") },
      cornersSquareOptions: { type: st.corners, color: state.fg },
      cornersDotOptions: { type: st.cornerDot, color: state.fg },
      backgroundOptions: { color: state.bg },
      imageOptions: { hideBackgroundDots: true, imageSize: 0.36, margin: Math.round(size * 0.008), saveAsBlob: true }
    };
    if (state.logo) opts.image = state.logo;
    return opts;
  }

  // ---------- Avisos de legibilidad ----------
  function luminance(hex) {
    var n = parseInt(hex.slice(1), 16), rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    var lin = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  }

  function renderWarnings(notes) {
    var list = notes.slice();
    var lf = luminance(state.fg), lb = luminance(state.bg);
    var ratio = (Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05);
    if (ratio < 3) list.push(["bad", "Poco contraste entre el código y el fondo: muchas cámaras no lo leerán. Usa un código oscuro sobre fondo claro."]);
    else if (lf > lb) list.push(["warn", "Código claro sobre fondo oscuro: la mayoría de teléfonos lo leen, pero algunos antiguos no. Pruébalo antes de imprimir."]);
    else if (ratio < 4.5) list.push(["warn", "El contraste es justo. Un código más oscuro se leerá mejor con poca luz."]);
    if (state.logo && state.payload) list.push(["info", "Con logo en el centro, el QR usa la corrección de errores máxima. Escanéalo con tu teléfono antes de imprimir."]);
    if (state.modules >= 61) list.push(["warn", "Tu QR tiene mucha información y salió muy denso. Acorta el texto o imprímelo grande."]);
    $("#warnings").innerHTML = list.map(function (w) {
      var li = document.createElement("li");
      li.className = w[0];
      li.textContent = w[1];
      return li.outerHTML;
    }).join("");
  }

  function minPrintCm(modules) {
    // ~0,5 mm por módulo (incluido el margen) es un mínimo cómodo para cualquier cámara.
    var cm = (modules + 8) * 0.05;
    return Math.max(2, Math.ceil(cm * 2) / 2);
  }

  // ---------- Render ----------
  function setState(name) {
    card.setAttribute("data-state", name);
    var ready = name === "ready";
    $$("[data-dl], #copy-img, #share-img").forEach(function (b) {
      if (b.closest(".mini-bar")) return;
      b.disabled = !ready;
    });
    updateMiniBar();
  }

  function render() {
    var p = buildPayload();
    state.payload = p.text;
    state.name = p.name;
    $("#empty-msg").textContent = EMPTY_MSG[state.type] || EMPTY_MSG.url;

    if (!state.payload) {
      state.modules = 0;
      setState("empty");
      renderWarnings(p.notes);
      $("#dl-hint").textContent = "Pruébalo con la cámara de tu teléfono antes de imprimirlo.";
      return;
    }

    try {
      var opts = qrOptions(PREVIEW_PX, "canvas");
      if (!preview) {
        preview = new window.QRCodeStyling(opts);
        preview.append($("#qr-box"));
      } else {
        preview.update(opts);
      }
      state.modules = preview._qr && preview._qr.getModuleCount ? preview._qr.getModuleCount() : 0;
      setState("ready");
      var typeLabel = $('input[name="type"]:checked + span');
      $("#qr-box").setAttribute("aria-label", "Vista previa del código QR: " + (typeLabel ? typeLabel.textContent.trim() : "enlace"));
      var cm = state.modules ? minPrintCm(state.modules) : 2;
      $("#dl-hint").innerHTML = "Imprímelo de <b>" + String(cm).replace(".", ",") + " × " + String(cm).replace(".", ",") +
        " cm</b> o más. Pruébalo con tu teléfono antes de imprimir.";
      // La librería dibuja de forma asíncrona (sobre todo con logo): copiamos la miniatura al terminar.
      Promise.resolve(preview._canvasDrawingPromise).then(syncMiniThumb, syncMiniThumb);
    } catch (e) {
      state.modules = 0;
      var tooLong = /overflow|length/i.test(String(e && e.message || e));
      $("#preview-error").textContent = tooLong
        ? "Demasiada información para un solo QR. Acorta el texto" + (state.logo ? " o quita el logo." : ".")
        : "No se pudo crear el QR. Revisa lo que escribiste e inténtalo otra vez.";
      setState("error");
      if (!tooLong) console.warn("[render]", e);
    }
    renderWarnings(p.notes);
  }

  var renderSoon = debounce(function () { safe(render, "render"); }, 130);

  // ---------- Descargas ----------
  function exportBlob(ext, size) {
    var inst = new window.QRCodeStyling(qrOptions(size, ext === "svg" ? "svg" : "canvas"));
    return inst.getRawData(ext).then(function (blob) {
      if (!blob) throw new Error("vacío");
      return ext === "svg" && !blob.type ? new Blob([blob], { type: "image/svg+xml" }) : blob;
    });
  }

  function saveBlob(blob, filename) {
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function download(ext) {
    if (!state.payload || card.getAttribute("data-state") !== "ready") return;
    var size = ext === "svg" ? 1024 : state.size;
    exportBlob(ext, size).then(function (blob) {
      saveBlob(blob, state.name + (ext === "png" ? "-" + size : "") + "." + ext);
      toast("✓ QR descargado en " + ext.toUpperCase());
    }).catch(function (e) {
      console.warn("[download]", e);
      toast("No se pudo descargar. Inténtalo otra vez.");
    });
  }

  function initDownloads() {
    $$("[data-dl]").forEach(function (b) {
      b.addEventListener("click", function () { download(b.getAttribute("data-dl")); });
    });

    var copyBtn = $("#copy-img");
    if (navigator.clipboard && window.ClipboardItem && window.isSecureContext) {
      copyBtn.hidden = false;
      copyBtn.addEventListener("click", function () {
        if (!state.payload) return;
        // Safari exige pasar la promesa directamente a ClipboardItem dentro del clic.
        var item = new window.ClipboardItem({ "image/png": exportBlob("png", 1024) });
        navigator.clipboard.write([item]).then(function () {
          toast("✓ Imagen copiada: pégala donde quieras");
        }).catch(function () { toast("Tu navegador no permitió copiar. Usa «Descargar PNG»."); });
      });
    }

    var shareBtn = $("#share-img");
    var probe = null;
    try { probe = new File([new Blob(["x"], { type: "image/png" })], "qr.png", { type: "image/png" }); } catch (_) {}
    if (probe && navigator.canShare && navigator.share && navigator.canShare({ files: [probe] })) {
      shareBtn.hidden = false;
      shareBtn.addEventListener("click", function () {
        if (!state.payload) return;
        exportBlob("png", 1024).then(function (blob) {
          var file = new File([blob], state.name + ".png", { type: "image/png" });
          return navigator.share({ files: [file], title: "Código QR" });
        }).catch(function (e) {
          if (e && e.name === "AbortError") return;
          toast("No se pudo compartir. Usa «Descargar PNG».");
        });
      });
    }
  }

  // ---------- Controles ----------
  function initType() {
    $$('input[name="type"]').forEach(function (r) {
      r.addEventListener("change", function () {
        if (!r.checked) return;
        state.type = r.value;
        $$("[data-fields]").forEach(function (box) { box.hidden = box.getAttribute("data-fields") !== state.type; });
        var first = $('[data-fields="' + state.type + '"] input, [data-fields="' + state.type + '"] textarea');
        // En móvil no abrimos el teclado solo; en escritorio sí enfocamos el primer campo.
        if (first && window.matchMedia("(hover: hover) and (pointer: fine)").matches) first.focus({ preventScroll: true });
        safe(render, "render");
      });
    });
    $$("[data-watch]").forEach(function (el) {
      el.addEventListener("input", renderSoon);
      el.addEventListener("change", renderSoon);
    });
    var toggle = $("#toggle-pass"), pass = $("#f-pass");
    toggle.addEventListener("click", function () {
      var show = pass.type === "password";
      pass.type = show ? "text" : "password";
      toggle.textContent = show ? "Ocultar" : "Ver";
      toggle.setAttribute("aria-pressed", String(show));
    });
  }

  function initDesign() {
    $$('input[name="style"]').forEach(function (r) {
      r.addEventListener("change", function () { if (r.checked) { state.style = r.value; safe(render, "render"); } });
    });

    var fg = $("#c-fg"), bg = $("#c-bg");
    $$('input[name="palette"]').forEach(function (r) {
      r.addEventListener("change", function () {
        if (!r.checked) return;
        var c = r.value.split("|");
        state.fg = fg.value = c[0];
        state.bg = bg.value = c[1];
        safe(render, "render");
      });
    });
    function onCustom() {
      state.fg = fg.value;
      state.bg = bg.value;
      $$('input[name="palette"]').forEach(function (r) { r.checked = r.value === state.fg + "|" + state.bg; });
      renderSoon();
    }
    fg.addEventListener("input", onCustom);
    bg.addEventListener("input", onCustom);

    $$('input[name="size"]').forEach(function (r) {
      r.addEventListener("change", function () {
        if (!r.checked) return;
        state.size = parseInt(r.value, 10) || 1024;
        $("#mini-sub").textContent = "PNG · " + state.size + " px";
      });
    });
  }

  function emojiDataUrl(ch) {
    var c = document.createElement("canvas"), x = c.getContext("2d");
    c.width = c.height = 160;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.font = '124px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    x.fillText(ch, 80, 88);
    return c.toDataURL("image/png");
  }

  function initLogo() {
    var label = $("#logo-upload-label"), text = $("#logo-upload-text"), file = $("#logo-file"), clear = $("#logo-clear");

    function showUploaded(on) {
      label.classList.toggle("is-active", on);
      clear.hidden = !state.fileLogo;
      var img = label.querySelector("img");
      if (state.fileLogo) {
        if (!img) { img = document.createElement("img"); img.alt = ""; label.querySelector("span").insertBefore(img, text); }
        img.src = state.fileLogo;
        text.textContent = on ? "Tu logo" : "Usar mi logo";
        label.querySelector("svg").style.display = "none";
      } else {
        if (img) img.remove();
        text.textContent = "Subir logo";
        label.querySelector("svg").style.display = "";
      }
    }

    $$('input[name="logo"]').forEach(function (r) {
      r.addEventListener("change", function () {
        if (!r.checked) return;
        state.logo = r.value ? emojiDataUrl(r.value) : null;
        state.logoKind = r.value ? "emoji" : "";
        showUploaded(false);
        safe(render, "render");
      });
    });

    // Volver a elegir «Tu logo» sin subirlo otra vez.
    label.addEventListener("click", function (e) {
      if (state.fileLogo && state.logoKind !== "file") {
        e.preventDefault();
        useFileLogo();
      }
    });

    function useFileLogo() {
      state.logo = state.fileLogo;
      state.logoKind = "file";
      $$('input[name="logo"]').forEach(function (r) { r.checked = false; });
      showUploaded(true);
      safe(render, "render");
    }

    file.addEventListener("change", function () {
      var f = file.files && file.files[0];
      file.value = "";
      if (!f) return;
      if (!/^image\//.test(f.type)) { toast("Ese archivo no es una imagen."); return; }
      if (f.size > 8 * 1024 * 1024) { toast("La imagen pesa demasiado (máx. 8 MB)."); return; }
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          // Reducimos el logo a 512 px: suficiente para imprimir y mantiene el SVG ligero.
          var max = 512, w = img.naturalWidth || max, h = img.naturalHeight || max;
          var k = Math.min(1, max / Math.max(w, h));
          var c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(w * k));
          c.height = Math.max(1, Math.round(h * k));
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          state.fileLogo = c.toDataURL("image/png");
          useFileLogo();
          toast("✓ Logo añadido");
        };
        img.onerror = function () { toast("No se pudo leer esa imagen. Prueba con PNG o JPG."); };
        img.src = reader.result;
      };
      reader.readAsDataURL(f);
    });

    clear.addEventListener("click", function () {
      state.fileLogo = null;
      if (state.logoKind === "file") {
        state.logo = null;
        state.logoKind = "";
        $('input[name="logo"][value=""]').checked = true;
      }
      showUploaded(false);
      safe(render, "render");
    });
  }

  // ---------- Barra inferior en móvil ----------
  var toolVisible = false, previewAbove = false;

  function updateMiniBar() {
    var bar = $("#mini-bar");
    if (!bar || !card) return;
    var show = toolVisible && previewAbove && card.getAttribute("data-state") === "ready";
    bar.setAttribute("data-show", String(show));
    bar.setAttribute("aria-hidden", String(!show));
    bar.querySelector("button").tabIndex = show ? 0 : -1;
  }

  function syncMiniThumb() {
    var src = $("#qr-box canvas"), thumb = $("#mini-thumb");
    if (!src || !thumb) return;
    var c = thumb.querySelector("canvas");
    if (!c) { c = document.createElement("canvas"); c.width = c.height = 128; thumb.appendChild(c); }
    var x = c.getContext("2d");
    x.clearRect(0, 0, c.width, c.height);
    x.imageSmoothingQuality = "high";
    x.drawImage(src, 0, 0, c.width, c.height);
  }

  function initMiniBar() {
    if (!("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (entries) {
      toolVisible = entries[0].isIntersecting;
      updateMiniBar();
    }, { threshold: 0 }).observe($("#herramienta"));
    new IntersectionObserver(function (entries) {
      var e = entries[0];
      previewAbove = !e.isIntersecting && e.boundingClientRect.bottom < 0;
      updateMiniBar();
    }, { threshold: 0 }).observe($("#preview-frame"));
  }

  // ---------- Arranque ----------
  function boot() {
    card = $("#tool-card");
    if (!card) return;
    if (typeof window.QRCodeStyling !== "function" || !("TextEncoder" in window)) {
      $("#preview-error").textContent = "Tu navegador no puede ejecutar el generador. Actualízalo o prueba con Chrome, Safari o Firefox.";
      card.setAttribute("data-state", "error");
      return;
    }
    // El navegador puede recordar valores al volver atrás: sincronizamos el estado.
    var checkedType = $('input[name="type"]:checked');
    state.type = checkedType ? checkedType.value : "url";
    $$("[data-fields]").forEach(function (box) { box.hidden = box.getAttribute("data-fields") !== state.type; });
    var st = $('input[name="style"]:checked'); if (st) state.style = st.value;
    state.fg = $("#c-fg").value || state.fg;
    state.bg = $("#c-bg").value || state.bg;
    var sz = $('input[name="size"]:checked'); if (sz) state.size = parseInt(sz.value, 10) || 1024;
    var lg = $('input[name="logo"]:checked'); if (lg && lg.value) { state.logo = emojiDataUrl(lg.value); state.logoKind = "emoji"; }

    safe(initType, "initType");
    safe(initDesign, "initDesign");
    safe(initLogo, "initLogo");
    safe(initDownloads, "initDownloads");
    safe(initMiniBar, "initMiniBar");
    safe(render, "render");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

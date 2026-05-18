---
title: Crear tu primer alojamiento
description: Proceso de creación — mini-form rápido en el sitio público + asistente guiado (wizard) completo en el panel.
order: 2
role: host
section: Empezar como host
---

# Crear tu primer alojamiento

El proceso está partido en **dos etapas**:

1. **Mini-form en el sitio público** — apenas 4 campos para crear la propiedad inicial.
2. **Asistente guiado (wizard) completo en el panel de administración** — donde completás todos los detalles (ubicación, fotos, precios, etc.).

Después del paso 1, **el sitio te redirige automáticamente al panel** para que sigas. Es importante que sepas esto: vas a salir de `staging.hospeda.com.ar` y aterrizar en el subdominio del panel admin durante el proceso.

## Etapa 1 — Mini-form en el sitio público

1. En el panel **"Mis propiedades"** (`/mi-cuenta/propiedades/`), apretá el botón para crear una propiedad nueva (si todavía no tenés ninguna, vas a ver el CTA **"Publicar ahora"** en el estado vacío).
2. Te abre un formulario corto con **4 campos**:
   - **Nombre de la propiedad** (ej. "Casa del Río")
   - **Tipo de alojamiento** (select)
   - **Ciudad**
   - **Resumen** (una línea que describa la propiedad)
3. Apretá **"Publicar"**.
4. El sistema crea la propiedad como borrador y **te redirige automáticamente al panel de administración** para completar los detalles.

> ⚠️ **No te asustes con el cambio de dominio**: al apretar Publicar vas a salir de `staging.hospeda.com.ar` y entrar al subdominio del panel admin. Es esperado.

### Tipos de alojamiento disponibles

El select tiene exactamente estas 10 opciones:

- Apartamento
- Casa
- Casa quinta
- Cabaña
- Hotel
- Hostal
- Camping
- Habitación
- Motel
- Complejo turístico

> Si ves opciones distintas a estas (ej. "Rural", "Boutique"), reportalo.

## Etapa 2 — Asistente guiado completo en el panel admin

Una vez en el panel, llegás a la edición de tu propiedad con un asistente guiado partido en **8 secciones**. Las podés ir guardando con **"Guardar borrador"** y volver cuando quieras.

### 1. Datos básicos

- **Nombre de la propiedad**
- **Descripción corta** (una línea)
- **Descripción completa** (texto largo)
- **Tipo de propiedad**

> ⚠️ **Importante:** las descripciones son **texto plano simple**, sin negrita / itálica / listas. **No reportes que "falta el editor con formato"** — el editor enriquecido está en desarrollo.

### 2. Ubicación

- **Dirección** (calle y número)
- **Ciudad**, **Provincia**, **País**, **Código postal**
- **Latitud** y **Longitud** (campos separados)
- **Mapa interactivo** con un pin arrastrable. Hint: **"Arrastrá el pin para ajustar la ubicación"**.
- Botones **"Expandir mapa"** / **"Contraer mapa"**.

> El form **puede** autocompletar las coordenadas desde la dirección. Si no lo hace, arrastrá el pin manualmente sobre el mapa hasta el lugar correcto.

### 3. Capacidad

- **Huéspedes máximos**
- **Habitaciones**
- **Baños**
- **Camas**

### 4. Comodidades

Lista grande de casillas de verificación (con label **"Comodidades"** — no "Amenidades"): WiFi, Aire acondicionado, Calefacción, Cocina completa, Heladera con freezer, Microondas, Cafetera, Ropa de cama, Toallas, TV por cable, Parrilla, Estacionamiento, Lavarropas, Hogar a leña, Salamandra, Jardín privado, Detector de humo, Botiquín de primeros auxilios, Matafuego, Pileta, Jacuzzi, Gimnasio, Lavandería, Ascensor, Desayuno, Restaurante, Bar, Spa, Estacionamiento cubierto, Balcón, Terraza, Plancha, Secador de pelo, Caja fuerte, Ventilador, Cortinas blackout, Cuna, Accesible para silla de ruedas, Se aceptan mascotas.

Probá marcar/desmarcar varias. Si hay un campo de búsqueda dentro de la lista, usalo.

### 5. Fotos

- Podés subir **hasta 20 fotos**.
- Interfaz: **"Arrastrá fotos acá o hacé click para seleccionar"**, botón **"Seleccionar archivos"**.
- Mientras suben aparece **"Subiendo..."**.
- Cada foto tiene botón **"Quitar foto"**.
- Si llegás al límite, ves **"Llegaste al máximo de 20 fotos"**.

> ⚠️ Si la propiedad recién la creaste con el mini-form, el sistema te puede pedir **"Guardá primero los datos básicos antes de subir fotos"**. Guardá la sección Datos básicos primero y volvé a Fotos.

Probá:

- Subir 3, después 10, después intentar la #21. **Lo esperado** es que el sistema bloquee la #21. Si te deja subir más de 20, reportalo.
- Quitar una foto y verificar que se quitó.

### 6. Precio

- **Precio por noche**
- **Moneda**

> No hay (todavía) precios por temporada, descuentos por estadía larga, ni reservas con checkout dinámico. **No los reportes como faltantes** — están planeados.

### 7. Contacto

- **Email**
- **Teléfono**
- **Método preferido** (Email / Teléfono / WhatsApp)

### 8. Publicar

- Pantalla de revisión final.
- Si te faltan campos obligatorios, ves **"Faltan datos obligatorios"** con la lista de qué completar.
- Cuando todo esté listo, apretá **"Publicar"**.
- Notificación flotante (toast): **"¡Tu propiedad fue publicada!"**.
- Andá al sitio público (en otra pestaña) y buscá tu alojamiento por nombre. ¿Aparece?

## Qué reportar

> 📋 **Reportá:**
>
> - Si el mini-form del sitio público falla al apretar Publicar
> - Si el redirect al panel admin se rompe (página en blanco, error, no llegás)
> - Si al volver al sitio público para comparar, los datos no se ven igual a los que cargaste en el admin
> - Si en algún paso del asistente guiado el botón "Siguiente" / "Guardar" no funciona
> - Si refrescaste la página y se perdieron datos
> - Si una foto no se subió (anotá tamaño y formato del archivo)
> - Si publicaste pero no aparece en el sitio público después de 1 minuto
> - Si el pin del mapa no se puede arrastrar o no marca bien

## Próximo paso

Andá a **[Tu panel de control (dashboard) de propietario o anfitrión (host)](/beta/host/dashboard/)** para revisar lo que creaste y editarlo.

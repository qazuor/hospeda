---
title: Tu panel de control (dashboard) de propietario o anfitrión (host)
description: Cómo revisar tus alojamientos publicados, editarlos y ver el preview público.
order: 3
role: host
section: Gestión del host
---

# Tu panel de control (dashboard) de propietario o anfitrión (host)

Abrí el menú de usuario (arriba a la derecha) y elegí **"Mis propiedades"**. Llegás al panel del propietario con el título **"Mis propiedades"** y debajo el subtítulo **"Gestioná tus publicaciones"**.

## Qué hay que ver

Cada propiedad aparece como una tarjeta con:

- **Imagen** y **nombre**
- **Precio por noche**
- **Estado** (etiqueta): **"Borrador"**, **"Publicada"** o **"Suspendida"**
- Botones de acción: **"Editar"**, **"Publicar"** / **"Despublicar"**, **"Ver en el sitio"**

Si nunca creaste una propiedad, vas a ver **"Aún no publicaste ninguna propiedad"** con un botón **"Publicar ahora"**.

## Editar tu alojamiento

1. Apretá **"Editar"** en la tarjeta de tu propiedad.
2. **Al apretar Editar te redirige al panel de administración** (subdominio admin, fuera de `staging.hospeda.com.ar`). Ahí vivís el asistente guiado (wizard) de 8 secciones.
3. Cambiá el nombre. Guardá. Recargá. ¿Quedó?
4. Agregá una foto más. Guardá. ¿Apareció?
5. Sacá una comodidad. ¿Se actualizó?
6. Cambiá el precio. Volvé al sitio público (con **"Ver en el sitio"** desde el panel de control) y verificá que el precio coincida.

> Si ves una notificación flotante (toast) **"Cambios guardados"**, está OK.
>
> ⚠️ El redirect web → admin durante la edición es esperado, no es un error (bug).

## Despublicar y volver a publicar

1. En una propiedad **"Publicada"**, apretá **"Despublicar"**.
2. Fijate qué pasa: ¿cambió a "Suspendida"? ¿Sigue visible en el sitio público? ¿Aparece como 404?
3. Apretá **"Publicar"** para reactivarla. ¿Volvió a aparecer en el listado público?

## Qué reportar

> 📋 **Reportá:**
>
> - Cualquier cambio que no se haya guardado bien
> - Cualquier cambio que **sí** se guardó pero no se refleja en el sitio público
> - Errores raros al apretar "Editar" / "Publicar" / "Despublicar"
> - Si "Ver en el sitio" lleva a una página rota o 404

## Lo que NO está todavía

> ⚠️ **No los reportes** — están planeados pero no para este beta:
>
> - ❌ Estadísticas de la lista (cuántas vistas, clicks, favoritos)
> - ❌ Calendario de disponibilidad
> - ❌ Sincronización con Google Calendar / Airbnb
> - ❌ Embed de video YouTube en la descripción
> - ❌ Comprar add-ons extra desde tu panel de control
> - ❌ Crear promociones temporales desde tu cuenta de propietario
> - ❌ Responder a reseñas de huéspedes

Mirá la lista completa en [Qué no es error](/beta/reportar-bugs/que-no-es-bug/).

## Próximo paso

Para hacer que tu alojamiento siga visible más allá del período de prueba, andá a **[Suscripción y pagos](/beta/host/suscripcion-y-pagos/)**.

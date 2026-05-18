---
title: Tu panel de control (dashboard) de propietario/anfitrión
description: Cómo revisar tus alojamientos, editarlos y ver el preview público.
order: 3
role: host
section: Gestión del host
---

# Tu panel de control de propietario/anfitrión

Menú de usuario (arriba a la derecha) → **"Mis propiedades"**. Título: **"Mis propiedades"** con subtítulo **"Gestioná tus publicaciones"**.

## Qué hay que ver

Cada propiedad es una tarjeta con:

- **Imagen** y **nombre**
- **Precio por noche**
- **Estado**: Borrador / Publicada / Suspendida
- Botones: **Editar**, **Publicar** / **Despublicar**, **Ver en el sitio**

Si nunca creaste una propiedad, ves **"Aún no publicaste ninguna propiedad"** + botón **"Publicar ahora"**.

## Editar tu alojamiento

1. Apretá **"Editar"**.
2. Te redirige al panel admin (subdominio admin, fuera de `staging.hospeda.com.ar`). Ahí está el asistente de 8 secciones.
3. Cambiá el nombre. Guardá. Recargá. ¿Quedó?
4. Agregá una foto. ¿Apareció?
5. Sacá una comodidad. ¿Se actualizó?
6. Cambiá el precio. Volvé al sitio público con **"Ver en el sitio"** y verificá que coincida.

> Toast **"Cambios guardados"** = OK.
>
> ⚠️ El redirect web → admin es esperado, no bug.

## Despublicar y volver a publicar

1. En una **"Publicada"**, apretá **"Despublicar"**.
2. ¿Cambió a "Suspendida"? ¿Sigue visible en el sitio? ¿Aparece como 404?
3. Apretá **"Publicar"** para reactivarla. ¿Volvió al listado público?

## Qué reportar

> 📋 **Reportá:**
>
> - Cambios que no se guardaron bien
> - Cambios guardados que no se reflejan en el sitio público
> - Errores raros al apretar Editar / Publicar / Despublicar
> - "Ver en el sitio" lleva a página rota o 404

## Lo que NO está todavía

> ⚠️ **No los reportes** — están planeados, no para este beta:
>
> - ❌ Estadísticas de la lista (vistas, clicks, favoritos)
> - ❌ Calendario de disponibilidad
> - ❌ Sincronización con Google Calendar / Airbnb
> - ❌ Embed de video YouTube en la descripción
> - ❌ Comprar add-ons extra desde tu panel
> - ❌ Crear promociones desde la cuenta de propietario
> - ❌ Responder a reseñas

Lista completa en [Qué no es error](/beta/reportar-bugs/que-no-es-bug/).

## Próximo paso

Para que tu alojamiento siga visible más allá del beta, **[Suscripción y pagos](/beta/host/suscripcion-y-pagos/)**.

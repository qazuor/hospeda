---
title: Admin — alojamientos, destinos y eventos
description: CRUD completo de alojamientos, destinos y eventos en el panel de administración.
order: 3
role: admin-editor
section: Solo admin
---

# Admin — alojamientos, destinos y eventos

<aside class="beta-callout beta-callout--info beta-callout--compact">
  <span class="beta-callout__icon" aria-hidden="true">ℹ️</span>
  <div class="beta-callout__body">Sección solo para testers preseleccionados de admin / editor. Si no es tu caso, podés ignorarla. <a href="/beta/admin-editor/acceso-y-roles/">Más info</a>.</div>
</aside>

Como admin tenés **mucho más** que un editor. Te recomendamos hacer también todo lo del [editor](/beta/admin-editor/editor-publicaciones-tags/).

> Para no abrumarte, te organizamos las áreas por importancia. Probá todo lo que puedas en las 2-3 semanas del beta.

## Panel de control (dashboard) principal (prioridad alta)

- Mirá los KPIs (usuarios, alojamientos, ingresos, etc.).
- Mirá los gráficos / tendencias.
- ¿Los números cuadran? ¿Te parecen razonables?

## Alojamientos (prioridad alta)

Tenés CRUD completo:

- **Listar** alojamientos. Filtros disponibles: **estado**, **tipo**, **destacado**, **incluir eliminados** y búsqueda libre. *No hay filtro por propietario en este momento — si lo encontrás, reportá dónde.*
- **Ver detalle** de un alojamiento: mirá las pestañas (General, Amenidades, Galería, Precios, Reseñas).
- **Editar** un alojamiento: cambiá un campo, guardá, fijate si se actualizó en el sitio público.
- **Crear** alojamiento desde admin: completá el asistente guiado (wizard). ¿Funcionó?
- **Borrar** uno: ¿soft delete? ¿se puede recuperar?

### Casos especiales

- Probá editar la **galería**: subir, reordenar, eliminar fotos.
- Probá editar las **amenidades** y **características**.
- Probá modificar los **precios** (por noche, por temporada).
- Mirá las **reseñas**. ¿Podés moderarlas? ¿Marcar spam?

> 📋 **Reportá:** todo lo que no haya guardado, dado error o no se haya reflejado en el sitio público.

## Destinos (prioridad alta)

Mismo proceso que con alojamientos:

- Listar, filtrar, buscar.
- Ver detalle (pestañas: General, Alojamientos, Atracciones, Eventos).
- Editar: cambiá descripción, foto cover.
- Crear un destino nuevo (ciudad, región).
- Asignar **atracciones** (puntos de interés) al destino.

## Eventos (prioridad media)

- Listar y filtrar eventos.
- Crear un evento (nombre, descripción, fecha, ubicación, organizador, categoría).
- Editar un evento existente.
- Sub-menú **Ubicaciones** (venues): crear / editar / eliminar.
- Sub-menú **Organizadores**: crear / editar / eliminar.

> ⚠️ La gestión de **tickets / asistentes** todavía no está completa. **No la reportes** si no la encontrás.

## Contenido transversal (prioridad media)

Hay un sub-menú **Contenido** con:

- **Comodidades de Alojamientos** (la lista maestra: WiFi, Pileta, Estacionamiento, etc.). Probá agregar, editar, eliminar.
- **Características de Alojamientos** (habitaciones, baños, etc.).
- **Atracciones de Destinos** (puntos de interés que después se asignan a destinos).

> 📋 **Reportá:** si una comodidad / característica que creaste no aparece después en el formulario del propietario o anfitrión (host).

## Publicaciones / Blog (mismo que editor + extras)

Como admin tenés:

- **Pestaña SEO** con más opciones que editor.
- **Pestaña Sponsorship**: asignar marcas patrocinadoras / enlaces promocionales a posts.

## Etiquetas / tags (más tipos que editor)

- **Etiquetas de blog (post-tags)** — visibles para usuarios
- **Etiquetas internas** — organización interna del equipo, no visibles al público
- **Etiquetas de sistema** — predefinidas, modificables con cuidado
- **Etiquetas de moderación de usuario** — etiquetas que el sistema usa para clasificar perfiles de USUARIO (no para marcar spam/abuso del usuario)

## Próximo paso

Andá a **[Admin — Billing](/beta/admin-editor/admin-billing/)** (la sección más grande del panel).

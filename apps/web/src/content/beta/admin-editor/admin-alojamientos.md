---
title: Admin — alojamientos, destinos y eventos
description: CRUD completo de alojamientos, destinos y eventos en el panel admin.
order: 3
role: admin-editor
section: Solo admin
audience: ['admin']
---

# Admin — alojamientos, destinos y eventos

<aside class="beta-callout beta-callout--info beta-callout--compact">
  <span class="beta-callout__icon" aria-hidden="true">ℹ️</span>
  <div class="beta-callout__body">Sección solo para testers preseleccionados de admin / editor. Si no es tu caso, podés ignorarla. <a href="/beta/admin-editor/acceso-y-roles/">Más info</a>.</div>
</aside>

Como admin tenés mucho más que un editor. Hacé también todo lo del [editor](/beta/admin-editor/editor-publicaciones-tags/).

> Áreas organizadas por importancia. Probá todo lo que puedas en las 2-3 semanas del beta.

## Panel de control (dashboard) principal (prioridad alta)

- KPIs (usuarios, alojamientos, ingresos).
- Gráficos / tendencias.
- ¿Los números cuadran y son razonables?

## Alojamientos (prioridad alta)

CRUD completo:

- **Listar**: filtros por estado, tipo, destacado, incluir eliminados, búsqueda libre. *No hay filtro por propietario — si lo encontrás, reportá dónde.*
- **Ver detalle**: pestañas General, Amenidades, Galería, Precios, Reseñas.
- **Editar**: cambiá un campo, guardá, verificá en el sitio público.
- **Crear** desde admin: completá el asistente.
- **Borrar**: ¿soft delete? ¿se recupera?

### Casos especiales

- Editar **galería**: subir, reordenar, eliminar.
- Editar **amenidades** y **características**.
- Modificar **precios** (por noche, por temporada).
- **Reseñas**: ¿se moderan? ¿se marca spam?

> 📋 **Reportá:** lo que no guardó, dio error o no se reflejó en el sitio.

## Destinos (prioridad alta)

Mismo proceso:

- Listar, filtrar, buscar.
- Detalle (pestañas: General, Alojamientos, Atracciones, Eventos).
- Editar descripción, foto de portada.
- Crear destino (ciudad, región).
- Asignar **atracciones** (puntos de interés).

## Eventos (prioridad media)

- Listar y filtrar.
- Crear: nombre, descripción, fecha, ubicación, organizador, categoría.
- Editar uno existente.
- Sub-menú **Ubicaciones** (venues): CRUD.
- Sub-menú **Organizadores**: CRUD.

> ⚠️ Tickets / asistentes todavía incompleto. No lo reportes si no aparece.

## Contenido transversal (prioridad media)

Sub-menú **Contenido**:

- **Comodidades de Alojamientos** (lista maestra: WiFi, Pileta, etc.). Agregar, editar, eliminar.
- **Características** (habitaciones, baños, etc.).
- **Atracciones de Destinos**.

> 📋 **Reportá** si una comodidad/característica que creaste no aparece después en el formulario del propietario o anfitrión (host).

## Publicaciones / Blog (igual que editor + extras)

Como admin tenés:

- **Pestaña SEO** con más opciones.
- **Pestaña Sponsorship**: marcas / enlaces promocionales en posts.

## Etiquetas (más tipos que editor)

- **De blog (post-tags)** — visibles para usuarios
- **Internas** — uso del equipo, no visibles al público
- **De sistema** — predefinidas, modificables con cuidado
- **De moderación de usuario** — clasifican perfiles de USUARIO (no spam/abuso)

## Próximo paso

**[Admin — Billing](/beta/admin-editor/admin-billing/)** (la sección más grande).

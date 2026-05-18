---
title: Procesos guiados (paso a paso)
description: Cuatro procesos completos que combinan varios módulos del panel.
order: 7
role: admin-editor
section: Solo admin
audience: ['admin']
---

# Procesos guiados

<aside class="beta-callout beta-callout--info beta-callout--compact">
  <span class="beta-callout__icon" aria-hidden="true">ℹ️</span>
  <div class="beta-callout__body">Sección solo para testers preseleccionados de admin / editor. Si no es tu caso, podés ignorarla. <a href="/beta/admin-editor/acceso-y-roles/">Más info</a>.</div>
</aside>

Procesos completos de uso real. Hacelos al menos una vez.

## Proceso 1 — Crear destino con todo

1. **Acceso → Usuarios** → crear "propietario o anfitrión (host) de prueba" con tu email + 1.
2. **Destinos** → crear "Ciudad de Prueba".
3. **Contenido → Atracciones de Destinos** → crear 3 y asignalas al destino.
4. **Alojamientos** → crear uno en ese destino.
5. Sitio público (otra pestaña): ¿el destino aparece en el catálogo? ¿Las atracciones en su detalle? ¿El alojamiento en "alojamientos en ese destino"?

## Proceso 2 — Gestionar suscripción de propietario

1. Crear propietario nuevo (otro email tuyo).
2. Desde la web pública, suscribirlo con [tarjeta de prueba de MP](/beta/pagos/pagos-de-prueba/).
3. Admin → **Billing → Suscripciones** → buscar esa suscripción.
4. ¿Está activa? ¿Próxima renovación correcta?
5. **Billing → Pagos** → buscar el pago. Si hay opción de reembolso, probala.
6. **Billing → Facturas** → ¿se generó factura?

## Proceso 3 — Moderar contenido

1. Desde otra cuenta (turista), dejá una reseña en un alojamiento.
2. Admin → **Alojamientos → [el alojamiento]** → pestaña Reseñas.
3. Encontrala. Probá moderar (aprobar / rechazar / spam).
4. Verificá en el sitio público si apareció/desapareció.

## Proceso 4 — Publicar post de blog completo

1. **Publicaciones → Agregar**.
2. Título, contenido (con formato), imagen de portada.
3. Asignar 3 etiquetas + 1 categoría.
4. Configurar SEO (meta title, description, slug).
5. Guardar como borrador, editarlo, asignar patrocinio (sponsorship).
6. Cambiar a **publicado**.
7. Sitio público: aparece en `/publicaciones/`, bajo su categoría y cada etiqueta, SEO aplicado (title de pestaña), patrocinio visible.

## Qué reportar

> 📋 **Reportá** cualquier paso que no funcionó. Estos procesos son representativos del uso real: cada error (bug) acá vale doble.

## Próximo paso

Antes de meterte a fondo, leé **[Lo que NO tenés que tocar](/beta/admin-editor/no-tocar/)** — secciones del panel que pueden romper el sistema.

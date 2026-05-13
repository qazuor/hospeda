---
title: Flujos guiados (paso a paso)
description: Cuatro flujos completos de uso real que combinan varios módulos del panel.
order: 7
role: admin-editor
section: Solo admin
---

# Flujos guiados

<aside class="beta-callout beta-callout--info beta-callout--compact">
  <span class="beta-callout__icon" aria-hidden="true">ℹ️</span>
  <div class="beta-callout__body">Sección solo para testers preseleccionados de admin / editor. Si no es tu caso, podés ignorarla. <a href="/beta/admin-editor/acceso-y-roles/">Más info</a>.</div>
</aside>

Estos son flujos completos de uso real. Hacelos completos al menos una vez.

## Flujo 1 — Crear destino con todo

1. **Acceso → Usuarios** → crear un usuario "host de prueba" con tu email + 1.
2. **Destinos** → crear un destino nuevo "Ciudad de Prueba".
3. **Contenido → Atracciones de Destinos** → crear 3 atracciones turísticas y asignalas al destino.
4. **Alojamientos** → crear un alojamiento en ese destino.
5. Andá al **sitio público** (otra pestaña) y verificá:
   - ¿El destino aparece en el catálogo?
   - ¿Las atracciones aparecen en el detalle del destino?
   - ¿El alojamiento aparece en "alojamientos en ese destino"?

## Flujo 2 — Gestionar una suscripción de host

1. Crear un host nuevo (con otro email tuyo).
2. Desde la web pública, suscribirlo a un plan con [tarjeta test de MP](/beta/host/suscripcion-y-pagos/).
3. Volver al admin → **Billing → Suscripciones** → buscar esa suscripción.
4. Mirar el detalle. ¿Está activa? ¿Próxima renovación correcta?
5. Ir a **Billing → Pagos** → buscar el pago asociado.
6. Si hay opción de reembolso, probarla.
7. Ir a **Billing → Facturas** → ver si se generó factura para ese pago.

## Flujo 3 — Moderar contenido

1. Desde otra cuenta (turista), dejá una reseña en un alojamiento.
2. Volvé al admin → **Alojamientos → [el alojamiento]** → tab Reseñas.
3. Encontrá la reseña.
4. Probá moderarla (aprobar / rechazar / marcar spam).
5. Verificá en el sitio público si la reseña apareció / desapareció.

## Flujo 4 — Publicar un post de blog completo

1. **Publicaciones → Agregar**.
2. Escribir título, contenido (con formato), imagen de portada.
3. Asignarle 3 tags y 1 categoría.
4. Configurar el SEO (meta title, description, slug).
5. Guardar como borrador.
6. Editarlo, asignarle un sponsorship.
7. Cambiar a estado **publicado**.
8. Ir al sitio público y verificar:
   - El post aparece en `/publicaciones/`
   - Aparece bajo su categoría y bajo cada tag
   - El SEO se aplica (mirá el title de la pestaña del navegador)
   - El sponsorship se ve

## Qué reportar

> 📋 **Reportá:** cualquier paso del flujo donde algo no funcionó como esperabas. Estos flujos son representativos del uso real, así que cada bug acá vale doble.

---
title: Admin — Facturación (billing) y monetización
description: Planes, suscripciones, add-ons, códigos promo, pagos, facturas, métricas.
order: 4
role: admin-editor
section: Solo admin
audience: ['admin']
---

# Admin — Facturación (billing) y monetización

<aside class="beta-callout beta-callout--info beta-callout--compact">
  <span class="beta-callout__icon" aria-hidden="true">ℹ️</span>
  <div class="beta-callout__body">Sección solo para testers preseleccionados de admin / editor. Si no es tu caso, podés ignorarla. <a href="/beta/admin-editor/acceso-y-roles/">Más info</a>.</div>
</aside>

Sección clave y grande. Tomate tu tiempo.

## Planes

**Billing → Planes**. Verás varios planes definidos en código (`packages/billing/src/config/plans.config.ts`): principales **Basic**, **Professional** y **Premium**; pueden aparecer **Complex Basic/Pro/Premium** (multi-propiedad) y **Free / Plus / VIP**.

> ⚠️ Los planes se gestionan desde el código. El panel los muestra pero crear/editar/eliminar plan se hace tocando `plans.config.ts` + deploy. No reportes "no puedo editar el precio" o "no me deja crear un plan" — es esperado.

- Mirá precio, límites, qué incluye.
- Verificá que coincidan con el sitio público en **`/suscriptores/precios/`**.

## Suscripciones

**Billing → Suscripciones**.

- Filtrá por plan, estado (activa / cancelada / vencida), cliente.
- Abrí una al azar. ¿Se ven los datos y el historial de pagos?

## Add-ons

**Billing → Add-ons**. ¿Hay add-ons cargados? Si no, probá crear uno (lista destacada, soporte prioritario).

## Códigos promocionales

**Billing → Códigos promo**.

- **Crear**: Código, Descripción, Tipo (porcentaje / fijo), Valor, Usos máximos, Válido desde/hasta. Ejemplo: `BETATEST50`, porcentaje, 50, 100 usos, 30 días.
- Crear otro al **100%** y guardarlo.
- **Listar** y **editar** un código.

> ⚠️ No vas a poder validar el descuento desde la pantalla de pago del sitio público — la pantalla de pago corre en MercadoPago Checkout Pro y no expone un campo de código promo al usuario final. Hoy son una herramienta administrativa cuya aplicación final está en revisión.

## Promociones para propietarios (Owner Promotions)

> ⚠️ Distinto de los códigos promo. Las promociones para propietarios son promos de un alojamiento (ej. 20% en una cabaña por temporada baja). Los códigos promo son cupones globales para suscripciones.

**Billing → Promociones para propietarios**, probá crear una.

## Sponsorships

**Billing → Patrocinios** o **Sponsorships**. Crear un patrocinio asociando una marca a una publicación, con duración y monto.

## Pagos

**Billing → Pagos**. Filtrá por estado, cliente, fecha. Abrí un pago: ¿hay opción de **reembolso**? Probala con un pago de prueba.

## Facturas

**Billing → Facturas**.

- Listar, generar una nueva, descargar PDF.
- Estados: **Borrador → Enviado → Pendiente → Pagado** (también **Cancelado**). No existe "Emitida".

> Notas de crédito: existe el permiso pero **no hay pantalla todavía** para gestionarlas. Si aparece, anotala. Si no, no es error (bug) — está pendiente.

## Tasas de cambio

**Billing → Tasas de cambio**. Mirá la tasa ARS/USD actual, probá actualizar manualmente. ¿Hay sincronización automática?

## Métricas

**Billing → Métricas**. Mirá los KPIs: MRR, ARR, churn, ARPU. ¿Tienen sentido?

## Logs y eventos

- **Registros de notificación (Notification logs)** → notificaciones de facturación enviadas
- **Eventos de webhook (Webhook events)** → eventos recibidos desde MercadoPago

> ⚠️ Existen como rutas pero **pueden no aparecer en el menú lateral**. Probá acceder por dirección web (URL) directa (`/billing/notification-logs`, `/billing/webhook-events`). Si funcionan, **reportá** "estas pantallas no aparecen en el menú lateral pero existen".

## Qué reportar

> 📋 Todo lo que no haya guardado bien, números que no cuadran, secciones que no cargan, errores en pantalla.

## Próximo paso

Sigamos con **[Admin — usuarios y permisos](/beta/admin-editor/admin-usuarios/)**.

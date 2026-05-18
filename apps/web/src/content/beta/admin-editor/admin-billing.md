---
title: Admin — Billing y monetización
description: Planes, suscripciones, add-ons, códigos promo, pagos, facturas, métricas y más.
order: 4
role: admin-editor
section: Solo admin
---

# Admin — Billing y monetización

<aside class="beta-callout beta-callout--info beta-callout--compact">
  <span class="beta-callout__icon" aria-hidden="true">ℹ️</span>
  <div class="beta-callout__body">Sección solo para testers preseleccionados de admin / editor. Si no es tu caso, podés ignorarla. <a href="/beta/admin-editor/acceso-y-roles/">Más info</a>.</div>
</aside>

Esta sección es **clave** y muy grande. Tomate tu tiempo.

## Planes

Andá a **Billing → Planes**. Vas a ver varios planes definidos en código (`packages/billing/src/config/plans.config.ts`). Los principales son **Basic**, **Professional** y **Premium**, pero también pueden aparecer variantes como **Complex Basic / Complex Professional / Complex Premium** (multi-propiedad) y **Free / Plus / VIP**.

> ⚠️ **Los planes se gestionan desde el código fuente.** El panel admin los muestra pero los CRUD (crear / editar / eliminar plan) se hacen modificando `plans.config.ts` y haciendo deploy. **No reportes "no puedo editar el precio del plan" o "no me deja crear un plan nuevo"** — es esperado.

- Mirá los datos de cada uno (precio, límites, qué incluye).
- Verificá que coincidan con lo que se muestra en el sitio público en **`/suscriptores/precios/`**.

## Suscripciones

Andá a **Billing → Suscripciones**.

- Vas a ver la tabla con todas las suscripciones.
- **Filtrá** por plan, por estado (activa / cancelada / vencida), por cliente.
- Abrí una al azar. ¿Se ven los datos? ¿Historial de pagos?

## Add-ons

Andá a **Billing → Add-ons**.

- ¿Hay add-ons cargados? Si no, probá crear uno (lista destacada, soporte prioritario, etc.).

## Códigos promocionales

Andá a **Billing → Códigos promo**.

- **Crear** un código nuevo. Los campos del form son: **Código**, **Descripción**, **Tipo** (porcentaje / fijo), **Valor**, **Usos máximos**, **Válido desde**, **Válido hasta**.
  - Ejemplo: Código `BETATEST50`, Tipo porcentaje, Valor 50, Usos máximos 100, vence en 30 días.
- Crear otro al **100%** y guardarlo. Anotá si el sistema lo deja crear.
- **Listar** los códigos creados.
- **Editar** uno.

> ⚠️ **No vas a poder validar el descuento desde un checkout del sitio público** — el checkout corre en MercadoPago Checkout Pro y no expone un campo de promo code al usuario final. Los promo codes hoy son una herramienta administrativa cuyo proceso de aplicación final está en revisión.

## Promociones para propietarios (Owner Promotions)

> ⚠️ Esto es **distinto** a los códigos promo. Las owner promotions son promos específicas de un alojamiento (ej. descuento del 20% en una cabaña por temporada baja). Los promo codes son cupones globales para suscripciones.

Andá a **Billing → Promociones para propietarios** y probá crear una.

## Sponsorships

Andá a **Billing → Patrocinios** o **Sponsorships**.

- Crear un sponsorship asociando una marca a un post.
- Asignar duración, monto, etc.

## Pagos

Andá a **Billing → Pagos**. Vas a ver la lista de transacciones.

- Filtrá por estado (aprobado, rechazado, pendiente).
- Buscá por cliente, fecha.
- Abrí un pago. ¿Tenés opción de **reembolso**? Si sí, probala con un pago de prueba.

## Facturas

Andá a **Billing → Facturas**.

- Listar facturas existentes.
- Generar una factura nueva.
- Descargarla en PDF.
- Los estados posibles son: **Borrador → Enviado → Pendiente → Pagado** (también puede haber **Cancelado**). No existe el estado "Emitida".

> Sobre **Notas de crédito**: existe el permiso a nivel sistema pero **no hay todavía una pantalla en el panel para gestionarlas**. Si la encontrás en el menú, anotala — sería un cambio reciente. Si no, no es un error (bug), está pendiente.

## Tasas de cambio

Andá a **Billing → Tasas de cambio**.

- Mirá la tasa actual ARS/USD.
- Probá actualizar manualmente.
- ¿Hay sincronización automática con alguna API?

## Métricas

Andá a **Billing → Métricas**.

- Mirá los KPIs: MRR, ARR, churn, ARPU.
- ¿Tienen sentido?

## Logs y eventos

- **Notification logs** → logs de notificaciones de billing enviadas
- **Webhook events** → eventos recibidos desde MercadoPago

> ⚠️ Estas dos páginas existen como rutas pero **podrían no estar en el menú lateral de Billing**. Si no las ves en la barra lateral, podés intentar acceder por dirección web directa (`/billing/notification-logs` y `/billing/webhook-events`). Si funciona, **reportá "estas pantallas no aparecen en el menú lateral pero existen"** — eso es un error de la barra lateral.

## Qué reportar

> 📋 **Reportá:** todo lo que no haya guardado bien, números que no cuadran, secciones que no cargan, errores en pantalla.

## Próximo paso

Sigamos con **[Admin — usuarios y permisos](/beta/admin-editor/admin-usuarios/)**.

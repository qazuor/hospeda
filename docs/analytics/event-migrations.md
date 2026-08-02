# Event Migrations

## Objetivo

Documentar renombres y consolidaciones para evitar dashboards ambiguos y para conservar trazabilidad con datos históricos.

## Mapeos aplicados

| Evento anterior | Evento nuevo | Motivo |
| --- | --- | --- |
| `accommodation_searched` | `search_performed` | Unificar búsquedas públicas bajo un nombre de dominio más general. |
| `booking_initiated` | `contact_owner_started` | El flujo representa contacto/conversación, no reserva confirmada. |
| `booking_request_sent` | `contact_owner_completed` | Señal de contacto confirmado, no “booking”. |
| `conversation_duplicate` | `contact_owner_failed` + `failure_reason=conversation_duplicate` | Consolidar fallos del mismo flujo bajo un solo evento con reason explícito. |
| `conversation_rate_limited` | `contact_owner_failed` + `failure_reason=rate_limited:*` | Consolidar fallos del mismo flujo bajo un solo evento con reason explícito. |
| `property_import_attempted` | `accommodation_import_started` | Unificar importaciones frontend/backend. |
| `property_import_succeeded` | `accommodation_import_completed` | Unificar importaciones frontend/backend. |
| `property_import_failed` | `accommodation_import_failed` | Unificar importaciones frontend/backend. |
| `favorite_toggled` | `favorite_added` / `favorite_removed` | Separar alta y baja evita tener que depender de `action` para métricas básicas. |
| `signup_completed` | `sign_up_completed` | Alinear naming de auth a `snake_case` consistente y legible. |
| `checkout_started` | `subscription_checkout_started` | Hacer explícito el dominio de suscripciones. |
| `checkout_completed` | `subscription_created` | Describir el hecho real confirmado por backend. |
| `payment_failed` | `subscription_payment_failed` | Evitar ambigüedad con otros tipos de pago futuros. |
| `admin.tour.shown` | `admin_tour_shown` | Eliminar dot notation y unificar catálogo. |
| `admin.tour.completed` | `admin_tour_completed` | Eliminar dot notation y unificar catálogo. |
| `admin.tour.skipped` | `admin_tour_skipped` | Eliminar dot notation y unificar catálogo. |
| `admin.whats_new.panel.opened` | `admin_whats_new_panel_opened` | Eliminar dot notation y unificar catálogo. |
| `admin.whats_new.modal.shown` | `admin_whats_new_modal_shown` | Eliminar dot notation y unificar catálogo. |
| `admin.whats_new.modal.closed` | `admin_whats_new_modal_closed` | Eliminar dot notation y unificar catálogo. |

## Compatibilidad

- En `apps/web` existe una capa de aliases en `src/lib/analytics/events.ts`.
- Esa capa permite seguir migrando call sites sin romper todo de una sola vez.
- La intención es TEMPORAL. Los dashboards nuevos deben usar sólo los nombres nuevos.

## Eventos históricos que NO se borran

- No se elimina ningún evento histórico en PostHog.
- Los dashboards nuevos deben filtrar por el naming nuevo.
- Si se necesita continuidad histórica, los insights pueden usar combinaciones temporales durante la transición.

## Reglas de transición

- No emitir simultáneamente viejo y nuevo en el mismo call site salvo que haya una razón explícita de compatibilidad analítica.
- En los flujos críticos de negocio, el nombre nuevo debe convertirse en la señal canónica.
- Los eventos viejos deben considerarse legacy apenas los dashboards nuevos estén activos.

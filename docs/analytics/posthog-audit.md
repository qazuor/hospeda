# Auditoría de PostHog en Hospeda

## Estado actual

- `apps/web` usa el snippet inline oficial de PostHog en `apps/web/src/components/analytics/PostHogScript.astro`.
- `apps/admin` usa `posthog-js` por ESM en `apps/admin/src/lib/analytics/posthog-client.ts`.
- `apps/api` usa `posthog-node` en `apps/api/src/lib/posthog.ts`.
- No existe un paquete compartido de analytics en `packages/`.
- No existe un catálogo unificado de eventos entre frontend y backend.
- No existe automatización en el repo para dashboards, insights, funnels o cohortes de PostHog.
- No hay integración en código con la API administrativa de PostHog.
- Session Replay está deshabilitado actualmente tanto en `web` como en `admin` (`disable_session_recording: true`).
- El contexto técnico provisto sobre Clerk está desactualizado: el código real usa Better Auth; Clerk sólo aparece como legado/documentación. Evidencia: `apps/api/src/lib/auth.ts`, `docs/decisions/ADR-002-better-auth-over-clerk.md`.

## SDKs instalados

- `apps/admin/package.json`: `posthog-js`
- `apps/api/package.json`: `posthog-node`
- `apps/web` no depende de `posthog-js`; usa snippet inline y `window.posthog` tipado localmente.

## Variables de entorno disponibles hoy

- Web:
  - `PUBLIC_POSTHOG_KEY`
  - `PUBLIC_POSTHOG_HOST`
  - `PUBLIC_VERSION`
- Admin:
  - `VITE_POSTHOG_KEY`
  - `VITE_POSTHOG_HOST`
  - `VITE_APP_VERSION`
- API:
  - `HOSPEDA_POSTHOG_KEY`
  - `HOSPEDA_POSTHOG_HOST`

## Variables faltantes para automatización administrativa

- No existe hoy en el repo una variable registrada para usar la API administrativa de PostHog, por ejemplo:
  - `POSTHOG_HOST`
  - `POSTHOG_PROJECT_ID`
  - `POSTHOG_PERSONAL_API_KEY`
- Tampoco existe hoy un env server-only equivalente ya registrado en `@repo/config` para Query API / dashboards.

## Inicialización actual

### Web

- Archivo: `apps/web/src/components/analytics/PostHogScript.astro`
- Configuración actual relevante:
  - `person_profiles: 'identified_only'`
  - `capture_pageview: true`
  - `capture_pageleave: true`
  - `autocapture: true`
  - `capture_performance: { web_vitals: true }`
  - `disable_session_recording: true`
  - `respect_dnt: true`
- El snippet se monta desde `apps/web/src/layouts/BaseLayout.astro`.
- La app usa Astro View Transitions, pero la configuración actual NO usa `capture_pageview: 'history_change'`, que según la documentación actual de PostHog es la opción recomendada para soft navigation en Astro con `ClientRouter`.

### Admin

- Archivo: `apps/admin/src/lib/analytics/posthog-client.ts`
- Configuración actual relevante:
  - `person_profiles: 'identified_only'`
  - `capture_pageview: true`
  - `autocapture: true`
  - `disable_session_recording: true`
  - `respect_dnt: true`
- Se inicializa al cargar `apps/admin/src/routes/__root.tsx`.

### API

- Archivo: `apps/api/src/lib/posthog.ts`
- Cliente lazy singleton con:
  - `flushAt: 20`
  - `flushInterval: 10000`
  - `shutdown()` en cierre controlado
- Hoy el comentario y el naming de env lo presentan como cliente de analíticas server-side de IA, pero en la práctica ya se usa también para signup, billing, importaciones y chat.

## Identificación de usuarios actual

### Web

- Identificación en `apps/web/src/components/shared/navigation/UserMenu.client.tsx`.
- Usa `identifyUser(user.id, props)` con `user.id` de Better Auth.
- Propiedades actuales de persona:
  - `role`
  - `is_host`
  - `is_commerce_owner`
  - `is_staff`
  - `plan`
  - `plan_status`
  - `locale`
- `resetUser()` se ejecuta en sign out.
- No hay guard explícito para evitar reintentos innecesarios de `identify` más allá del comportamiento idempotente esperado del SDK.

### Admin

- Identificación en `apps/admin/src/contexts/auth-context.tsx`.
- Usa `identifyUser(authState.user.id, { role, emailDomain })`.
- `resetUser()` se ejecuta en sign out.
- `emailDomain` no es PII directa, pero no está justificado hoy como dimensión de negocio principal.

### Backend

- Los eventos server-side usan `distinctId` explícito.
- En billing hay stitching parcial entre frontend y backend:
  - `checkout_started` y `checkout_completed` usan `actor.id`
  - `subscription_payment_succeeded` resuelve el owner user id cuando puede
  - `trial_converted_to_paid` intenta usar el owner user id y cae a `customerId`
- No se aprovechan hoy `tracing_headers` ni `X-POSTHOG-DISTINCT-ID` / `X-POSTHOG-SESSION-ID` entre frontend y backend.

## Eventos existentes

### Web

Catálogo explícito en `apps/web/src/lib/analytics/events.ts`:

- `accommodation_searched`
- `accommodation_viewed`
- `signup_completed`
- `booking_initiated`
- `booking_request_sent`
- `newsletter_subscribed`
- `contribution_banner_clicked`
- `contribution_report_submitted`
- `contribution_photo_submitted`
- `contribution_editor_submitted`
- `post_viewed`
- `event_viewed`
- `ai_search_submitted`
- `ai_search_intent_applied`
- `ai_search_fallback_keyword`
- `ai_search_login_prompted`
- `property_import_attempted`
- `property_import_succeeded`
- `property_import_failed`
- `favorite_toggled`
- `review_submitted`
- `conversation_duplicate`
- `conversation_rate_limited`

Uso real hoy detectado en `apps/web/src`:

- Búsqueda: `SearchBar.client.tsx`
- Vista de alojamiento: `AccommodationViewTracker.client.tsx`
- Vista de post/evento: `EntityViewTracker.client.tsx`
- Contacto a alojamiento: `ContactHost.client.tsx`
- Newsletter: `NewsletterForm.client.tsx`
- Favoritos: `FavoriteButton.client.tsx`
- Reviews: `ReviewSidebarCard.client.tsx`
- Importación: `CreatePropertyMiniForm.client.tsx`
- Contributions: `ContributionForm.client.tsx`, `ContributionBanner.astro`

### Admin

Eventos explícitos detectados:

- `admin.tour.shown`
- `admin.tour.completed`
- `admin.tour.skipped`
- `admin.whats_new.panel.opened`
- `admin.whats_new.modal.shown`
- `admin.whats_new.modal.closed`

### API / backend

Eventos PostHog reales detectados:

- `signup_completed`
- `checkout_started`
- `checkout_completed`
- `subscription_payment_succeeded`
- `payment_failed`
- `trial_converted_to_paid`
- `accommodation_import_started`
- `accommodation_import_started_async`
- `accommodation_import_completed`
- `accommodation_import_failed`
- `ai_chat_opened`
- `ai_chat_cap_reached`
- `ai_chat_message_sent`
- `ai_chat_moderation_blocked`
- `ai_chat_response_completed`
- `ai_fallback`
- `ai_call_exhausted`
- `ai_kill_switch_hit`
- `ai_moderation_blocked`
- `ai_feature_used`

## Pageviews y autocapture

- Web y admin tienen `capture_pageview` activo.
- Web y admin tienen `autocapture` activo.
- No se detectó captura manual explícita de `$pageview`.
- No se detectó doble emisión manual+automática de `$pageview`.
- Sí existe superposición SEMÁNTICA entre:
  - `$pageview` automático
  - eventos explícitos tipo `accommodation_viewed`, `post_viewed`, `event_viewed`
- Esa superposición no duplica técnicamente el mismo evento, pero sí vuelve fácil construir métricas ambiguas de “vistas” si no se normaliza el modelo.

## Session Replay actual

- Web: deshabilitado (`disable_session_recording: true`)
- Admin: deshabilitado (`disable_session_recording: true`)
- No hay hoy estrategia de masking, sampling, exclusiones por ruta ni `ph-no-capture` para PostHog porque Replay no está activo.

## Helpers y wrappers actuales

- Web:
  - `apps/web/src/lib/analytics/posthog-client.ts`
  - `apps/web/src/lib/analytics/events.ts`
  - `apps/web/src/lib/analytics/plan-properties.ts`
  - `apps/web/src/lib/analytics/view-capture.ts`
- Admin:
  - `apps/admin/src/lib/analytics/posthog-client.ts`
- API:
  - `apps/api/src/lib/posthog.ts`
  - `apps/api/src/lib/auth-signup-analytics.ts`
- No hay wrapper compartido, tipos compartidos ni naming compartido entre apps.

## Problemas detectados

### 1. No existe un modelo unificado de analytics

- `web`, `admin` y `api` instrumentan por separado.
- No hay single source of truth para nombres, propiedades obligatorias o convenciones.
- No hay validación central contra PII o cardinalidad alta.

### 2. Inconsistencia fuerte de nomenclatura

- Se mezclan formatos:
  - snake_case: `accommodation_viewed`
  - dot notation: `admin.tour.shown`
  - nombres ambiguos: `booking_initiated`, `booking_request_sent`
- Las propiedades también mezclan estilos:
  - `destination_id`
  - `fieldsPrefilled`
  - `planSlug`
  - `billingInterval`
  - `emailDomain`

### 3. Privacidad del sitio público insuficientemente estricta

- El sitio público captura eventos anónimos aun sin consentimiento analítico, usando `persistence: 'memory'`.
- `identify` y propiedades de persona sí están gateados por consentimiento, pero la navegación y algunos eventos anónimos pueden existir antes del opt-in.
- Esto es compatible con un modelo híbrido cookieless, pero requiere documentación clara para no confundir “anónimo pre-consentimiento” con “usuario identificado”.

### 4. Autocapture activo sin estrategia de reducción de ruido

- `autocapture: true` está activo en web y admin.
- No hay allowlist/ignorelist explícita.
- No hay documentación de qué métricas dependen de autocapture y cuáles no.
- Para este objetivo de negocio, la mayor parte del valor debe venir de eventos explícitos y confirmados.

### 5. Astro con soft navigation no está configurado según la guía actual

- La documentación actual de PostHog para Astro + `ClientRouter` recomienda guard de inicialización y `capture_pageview: 'history_change'`.
- Hoy `apps/web` no usa esa configuración.
- Riesgo: pageviews incompletos o inconsistentes en navegación cliente.

### 6. Falta de separación clara entre analítica de producto y telemetría interna

- En PostHog conviven hoy eventos de negocio, IA, admin interno y billing, sin una taxonomía común ni una separación documental clara.
- Esto dificulta construir dashboards ejecutivos limpios.

### 7. Eventos de contacto priorizados, pero mal nombrados para el dominio

- El flujo clave de leads usa:
  - `booking_initiated`
  - `booking_request_sent`
- El producto real es contacto/conversación con alojamiento, no una reserva transaccional confirmada.
- El naming actual induce lecturas incorrectas del funnel.

### 8. Duplicidad semántica en importaciones

- Frontend usa:
  - `property_import_attempted`
  - `property_import_succeeded`
  - `property_import_failed`
- Backend usa:
  - `accommodation_import_started`
  - `accommodation_import_started_async`
  - `accommodation_import_completed`
  - `accommodation_import_failed`
- No hay colisión literal, pero sí dos taxonomías distintas para el mismo flujo.

### 9. Backend crítico todavía incompleto para producto

- Hay eventos backend para signup, checkout, pagos, trial conversion, import y chat.
- Faltan hoy eventos server-side canon para:
  - inicio/completitud de contacto con alojamiento
  - publicación efectiva de alojamiento
  - cambios relevantes de onboarding
  - activación/cancelación/cambio de plan con naming homogéneo

### 10. No existen dashboards operativos del negocio como código

- No hay scripts idempotentes para crear dashboards, insights, funnels o cohortes.
- No hay credenciales administrativas registradas para eso.
- No hay documentación de regeneración.

### 11. Propiedades discutibles o innecesarias

- `accommodation_viewed` manda `destination_name`, `price`, `owner_id`.
- `admin` identifica con `emailDomain`.
- `whats_new` manda arrays de `entryIds`.
- Varias propiedades no están justificadas todavía por una pregunta concreta de negocio.

### 12. No hay propiedad global coherente por app/entorno

- Web sólo registra `app_version`.
- Admin registra `app_type`, `project`, `app_version`.
- API no registra super properties globales.
- No hay una propiedad global consistente como `app`, `environment`, `locale`, `role`, `plan`.

### 13. No hay controls anti-PII centralizados

- Hoy la seguridad depende de que cada call site “se porte bien”.
- No existe un catálogo tipado que marque qué propiedades están permitidas.
- No existe una validación de claves sospechosas tipo `email`, `phone`, `message`, `token`, `password`.

### 14. `entity_views` y PostHog no responden hoy a las mismas preguntas

- `entity_views` (DB propia) sólo cubre `ACCOMMODATION`, `POST`, `EVENT`.
- No cubre `DESTINATION`.
- PostHog explícito tampoco cubre hoy `destination_viewed`.
- Resultado: una de las preguntas más importantes del producto (“qué destinos atraen tráfico y convierten”) no tiene hoy una señal consistente.

## Eventos duplicados o ambiguos

### Ambiguos

- `booking_initiated` → debería modelarse como contacto, no como reserva.
- `booking_request_sent` → semánticamente es una conversación/contacto creado o una solicitud confirmada.
- `signup_completed` → correcto como hecho, pero deberá alinearse con una convención única del catálogo final.
- `payment_failed` → demasiado genérico para convivir con negocio multi-dominio; conviene un nombre explícito de suscripción.

### Solapados o con riesgo de doble lectura

- `$pageview` vs `accommodation_viewed` / `event_viewed` / `post_viewed`
- `property_import_*` vs `accommodation_import_*`
- analítica de vistas en PostHog vs `entity_views` en base propia

## Riesgos de privacidad

- Captura anónima pre-consentimiento en web.
- Query strings sensibles pueden llegar a PostHog vía `$current_url`; ya existe mitigación puntual para `preapproval_id` en `apps/web/src/components/billing/strip-checkout-return-params.snippet.ts`, pero no hay política global documentada.
- Autocapture activo puede registrar texto/click context innecesario si se deja crecer sin control.
- No existe hoy estrategia de Session Replay para masking porque Replay está apagado; si se activa sin diseño previo sería riesgoso.

## Datos faltantes respecto a las preguntas de negocio

- `destination_viewed`
- selección de resultado de búsqueda
- búsquedas sin resultados
- filtros aplicados relevantes
- inicio/completitud/fallo de contacto con owner con naming de negocio
- `sign_up_started`
- `sign_in_completed`
- `onboarding_started`
- progreso de onboarding
- `accommodation_creation_started`
- `accommodation_published` confirmado desde backend
- `accommodation_updated` de negocio
- `subscription_activated`
- `subscription_created` normalizado
- `subscription_plan_changed`
- `subscription_cancelled`
- cohortes reutilizables de owners por estado
- dashboard principal “00 · Hospeda — Resumen”

## Cambios propuestos

### Arquitectura

- Crear `packages/analytics` como capa compartida mínima y tipada.
- Centralizar:
  - catálogo de eventos
  - tipos de propiedades
  - propiedades globales
  - helpers browser/server
  - validaciones anti-PII
  - guards para modo disabled/dev/test

### Web

- Revisar init para Astro + View Transitions con configuración actual oficial.
- Pasar de instrumentación dispersa a helper compartido.
- Reducir o deshabilitar autocapture según valor real.
- Convertir los eventos clave a taxonomía explícita y de negocio.
- Agregar cobertura de destinos y búsqueda.
- Hacer explícita y documentada la política híbrida: anónimo cookieless pre-consentimiento, persistente/identificado post-consentimiento.

### Admin

- Mantener sólo señales de producto interno que realmente sirvan.
- Deshabilitar ruido innecesario.
- Homogeneizar naming y propiedades.
- Mantener Replay deshabilitado por defecto salvo estrategia muy acotada.

### API

- Reusar el cliente server-side como capa oficial de eventos críticos de negocio, no sólo IA.
- Instrumentar backend en puntos confirmados:
  - signup/signin
  - publicación
  - conversaciones/contactos
  - suscripciones/pagos
- Usar `distinctId` consistente con Better Auth user id cuando exista.
- Registrar propiedades de persona sólo si están justificadas.

### Operación PostHog

- Agregar script idempotente `pnpm posthog:setup`.
- Crear dashboards, insights, funnels y cohortes mediante API oficial.
- Registrar variables server-only para API administrativa.
- Documentar estrategia de Session Replay antes de activarlo.

## Archivos que probablemente serán modificados

### Nuevos

- `packages/analytics/package.json`
- `packages/analytics/src/*`
- `packages/analytics/test/*`
- `scripts/posthog/setup.mjs` o equivalente TypeScript
- `docs/analytics/README.md`
- `docs/analytics/event-catalog.md`
- `docs/analytics/posthog-dashboards.md`
- `docs/analytics/session-replay-privacy.md`
- `docs/analytics/event-migrations.md`

### Web

- `apps/web/src/components/analytics/PostHogScript.astro`
- `apps/web/src/lib/analytics/posthog-client.ts`
- `apps/web/src/lib/analytics/events.ts`
- `apps/web/src/components/analytics/AccommodationViewTracker.client.tsx`
- `apps/web/src/components/analytics/EntityViewTracker.client.tsx`
- `apps/web/src/components/sections/SearchBar.client.tsx`
- `apps/web/src/components/accommodation/ContactHost.client.tsx`
- `apps/web/src/components/shared/navigation/UserMenu.client.tsx`
- `apps/web/src/lib/analytics/plan-properties.ts`
- `apps/web/src/pages/[lang]/destinos/[...path].astro`
- `apps/web/src/components/host/CreatePropertyMiniForm.client.tsx`
- `apps/web/src/components/host/PublishButton.client.tsx`

### Admin

- `apps/admin/src/lib/analytics/posthog-client.ts`
- `apps/admin/src/contexts/auth-context.tsx`
- `apps/admin/src/contexts/tour-context.tsx`
- `apps/admin/src/components/whats-new/WhatsNewModal.tsx`
- `apps/admin/src/components/whats-new/WhatsNewPanel.tsx`

### API

- `apps/api/src/lib/posthog.ts`
- `apps/api/src/lib/auth-signup-analytics.ts`
- `apps/api/src/lib/auth.ts`
- `apps/api/src/routes/billing/start-paid.ts`
- `apps/api/src/routes/webhooks/mercadopago/payment-logic.ts`
- `apps/api/src/routes/host-onboarding/protected/start.ts`
- `apps/api/src/routes/conversations/public/initiate.ts`
- `apps/api/src/routes/conversations/protected/initiate.ts`
- `apps/api/src/routes/accommodation/protected/import-from-url.ts`
- `apps/api/src/routes/accommodation/protected/publish.ts`
- `packages/service-core/src/services/accommodation/accommodation.service.ts`

### Configuración

- `packages/config/src/env-registry.hospeda.ts`
- `packages/config/generated/env-registry.json`
- `apps/api/src/utils/env-schema.ts`
- `apps/api/.env.example`
- posiblemente `package.json` raíz para `pnpm posthog:setup`

## Dashboards que se crearán

- `00 · Hospeda — Resumen`
- `01 · Hospeda — Adquisición`
- `02 · Hospeda — Descubrimiento`
- `03 · Hospeda — Owners`
- `04 · Hospeda — Suscripciones`
- `05 · Hospeda — Calidad`

## Funnels a crear

- Funnel de adquisición de owner
- Funnel de publicación
- Funnel de contacto
- Funnel de suscripción

## Cohortes a crear

- Owners registrados
- Owners sin alojamiento publicado
- Owners con alojamiento publicado
- Owners activos últimos 30 días
- Usuarios con contacto completado
- Usuarios en trial
- Usuarios con suscripción activa
- Usuarios que cancelaron
- Usuarios que abandonaron onboarding
- Cohortes por plan real del producto

## Criterios de implementación derivados de la auditoría

- El proyecto necesita una taxonomía enfocada en hechos confirmados de negocio, no en clics genéricos.
- Los eventos de backend deben ser la fuente canónica para signup, publicación, contacto y suscripción siempre que la operación pueda confirmarse server-side.
- El sitio público necesita una política de consentimiento más explícita y documentada.
- No hay que intentar “medir todo”: hay que priorizar claridad, costo y utilidad ejecutiva.

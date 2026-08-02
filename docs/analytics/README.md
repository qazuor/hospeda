# PostHog Analytics

Esta carpeta documenta la implementación de analytics de Hospeda basada en PostHog.

## Objetivos

- Medir hechos de negocio útiles, no clicks decorativos.
- Mantener naming y propiedades consistentes entre `web`, `admin` y `api`.
- Evitar PII y reducir ruido/costo.
- Priorizar backend como fuente canónica cuando una operación pueda confirmarse server-side.

## Modelo actual

- `apps/web`: modelo híbrido mejorado.
  - Antes del consentimiento: captura anónima cookieless con `persistence: 'memory'`.
  - Después del consentimiento: `localStorage+cookie`, `identify`, person properties.
- `apps/admin`: captura autenticada interna con eventos explícitos y sin `autocapture`.
- `apps/api`: captura server-side para signup, onboarding, contacto, publicación y billing.
- `packages/analytics`: catálogo tipado, schemas Zod, helpers browser/server y guardas anti-PII.

## Documentos

- `posthog-audit.md` — auditoría inicial, problemas detectados y plan de cambio.
- `event-catalog.md` — catálogo actual de eventos y propiedades.
- `event-migrations.md` — mapeo de eventos viejos → nuevos.
- `posthog-dashboards.md` — estrategia y regeneración de dashboards.
- `session-replay-privacy.md` — estado actual y política de Replay.

## Estado operativo

- Session Replay: deshabilitado.
- Dashboard automation: disponible vía `pnpm posthog:setup` con credenciales administrativas de PostHog.
- Funnels/cohortes: pendientes de automatización sobre la taxonomía nueva.

## Setup operativo

Comando:

```bash
pnpm posthog:setup
```

Variables de ejemplo:

- `scripts/posthog/.env.example`

## Reglas prácticas

- `snake_case` para eventos y propiedades.
- No enviar email, teléfono, mensaje, token, password, dirección ni payloads de DB completos.
- Usar IDs estables (`user.id`, IDs de entidad, subscription IDs locales) y no nombres visibles.
- En frontend, preferir eventos explícitos a `autocapture`.
- En backend, capturar sólo cuando la operación quedó confirmada.

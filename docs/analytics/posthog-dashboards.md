# PostHog Dashboards

## Objetivo

Los dashboards de PostHog deben responder preguntas de negocio concretas sobre:

- uso general de Hospeda
- adquisición
- descubrimiento de contenido
- conversión de owners
- contactos con alojamientos
- suscripciones y pagos
- problemas que afectan conversión

## Dashboards previstos

### `00 · Hospeda — Resumen`

Debe responder en menos de un minuto:

- cuánta gente usa Hospeda
- cuántos owners se registran
- cuántos publican
- cuántos turistas contactan alojamientos
- cuántos pasan a planes pagos

Eventos base esperados:

- `$pageview`
- `sign_up_completed`
- `accommodation_published`
- `contact_owner_completed`
- `subscription_created`
- `subscription_payment_succeeded`

### `01 · Hospeda — Adquisición`

Debe responder:

- de dónde llega el tráfico
- qué fuentes convierten a registro
- qué fuentes convierten a contacto

### `02 · Hospeda — Descubrimiento`

Debe responder:

- qué destinos y alojamientos se ven más
- qué búsquedas se realizan
- qué contenido convierte en contacto

### `03 · Hospeda — Owners`

Debe responder:

- cuántos owners arrancan onboarding
- cuántos crean draft
- cuántos publican
- dónde abandonan

### `04 · Hospeda — Suscripciones`

Debe responder:

- cuántos checkouts arrancan
- cuántas suscripciones se crean
- cuántos pagos salen bien/mal
- cómo convierten trials y cambios de plan

### `05 · Hospeda — Calidad`

Debe responder:

- qué acciones fallan más
- qué errores de producto pegan sobre conversión
- dónde hay más fricción en contacto/importación/pagos

## Estado actual

- Existe un primer script operativo en `scripts/posthog/setup.ts`.
- El comando `pnpm posthog:setup` crea o actualiza de forma idempotente:
  - dashboards base
  - starter insights
  - cohortes base
- Todavía no define el layout final de tiles ni cubre todas las tarjetas pedidas en el brief original.
- La API oficial a usar es:
  - dashboards: `/api/projects/:project_id/dashboards/`
  - insights: `/api/projects/:project_id/insights/`
  - cohorts: `/api/projects/:project_id/cohorts/`
  - annotations: `/api/projects/:project_id/annotations/`

## Variables esperadas para automatización

El script de setup va a necesitar credenciales administrativas de PostHog. La intención es soportar estas variables shell:

- `POSTHOG_HOST`
- `POSTHOG_PROJECT_ID`
- `POSTHOG_PERSONAL_API_KEY`

Para integración server-side del repo también existe el carril `HOSPEDA_*` en `apps/api`, pero el setup script se piensa como una herramienta operativa explícita, no como código runtime del producto.

## Reglas de creación

- crear o reutilizar dashboards por nombre estable
- crear o actualizar insights por nombre/tag estable
- no duplicar dashboards en cada corrida
- no borrar dashboards existentes ajenos
- no inventar métricas si la taxonomía todavía no garantiza esa lectura

## Starter insights automatizados hoy

El script crea una primera tanda de insights orientados a:

- visitantes únicos y evolución diaria
- registros
- publicaciones
- contactos completados
- suscripciones creadas y pagos
- tops por destino/alojamiento
- importaciones y contactos fallidos
- dos funnels base

Y cohortes base reutilizables para:

- owners
- owners con/sin publicación
- suscripción activa
- trial
- plan básico / pro / premium

La cobertura todavía es parcial respecto al objetivo final de 10-12 tarjetas por dashboard.

## Limitaciones actuales

- Falta cerrar la automatización completa de insights/funnels/cohortes en esta rama.
- Session Replay sigue deshabilitado.
- Algunas métricas ejecutivas dependen de terminar la migración de eventos al naming nuevo.
- La atribución fuerte `source/referrer/utm -> sign_up_completed` todavía no está cosida de forma canónica en backend.
- La atribución fuerte `source/referrer/utm -> contact_owner_completed` tampoco está cosida todavía de punta a punta.
- El script actual crea starter insights defendibles con la taxonomía nueva, pero no pretende simular una BI perfecta donde la señal todavía no existe.

## Métricas confiables hoy

Con el modelo ya implementado, estas lecturas son razonablemente confiables:

- pageviews y visitantes en producción
- vistas explícitas de destino/alojamiento/post/evento
- sign up started/completed
- sign in completed
- onboarding started
- drafts guardados
- publicaciones efectivas
- contactos completados y fallidos
- checkout started
- subscription created
- subscription payment succeeded/failed
- trial converted to paid

## Métricas que deben leerse como aproximación

- conversión visitante → registro
- conversión registro → publicación
- conversión vista alojamiento → contacto
- adquisición por canal aplicada a resultados de negocio

Motivo: todavía no existe stitching causal perfecto entre la primera adquisición pública y todos los eventos backend finales.

## Cómo se va a regenerar

Comando objetivo:

```bash
pnpm posthog:setup
```

Este comando debe ser idempotente y seguro para re-ejecutar.

Variables necesarias en shell:

```bash
export POSTHOG_HOST="https://us.posthog.com"
export POSTHOG_PROJECT_ID="<project-id>"
export POSTHOG_PERSONAL_API_KEY="<personal-api-key>"
pnpm posthog:setup
```

También hay un ejemplo listo en:

- `scripts/posthog/.env.example`

## Anotaciones opcionales

El mismo comando puede crear una annotation global de deploy si recibe alguna de estas variables:

```bash
export POSTHOG_RELEASE="2026.07.29"
export POSTHOG_DEPLOY_SHA="abc123def456"
pnpm posthog:setup
```

También puede usarse texto explícito:

```bash
export POSTHOG_ANNOTATION_CONTENT="Hospeda deploy · release=2026.07.29 · sha=abc123def456"
export POSTHOG_ANNOTATION_DATE="2026-07-29T13:00:00Z"
pnpm posthog:setup
```

## Dry run opcional

Para revisar el plan sin pegarle a PostHog real:

```bash
export POSTHOG_DRY_RUN=true
pnpm posthog:setup
```

En este modo el script simula creación/actualización y muestra qué haría, sin requerir credenciales reales.

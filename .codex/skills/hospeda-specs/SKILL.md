---
name: hospeda-specs
description: Fuente de verdad y refinamiento de specs de Hospeda.
triggers:
  - .specs
  - spec
  - task
  - refinamiento de spec
  - closeout
---

# Specs de Hospeda

## Fuente de verdad

- El código, Git y el estado real de Linear prevalecen sobre memorias de sesiones
  e índices históricos.
- Antes de ofrecer una spec, verificá que el directorio existe, que el estado del
  índice coincide con Git y que el PR/closeout no la dejó obsoleta.
- Una spec implementada no se vuelve a refinar: se registra el drift del índice y
  se conserva sólo la decisión durable que siga aplicando.

## Refinamiento

- Usá `qz-refine-spec` para separar hechos observados, inferencias y decisiones
  abiertas antes de escribir cambios en la spec.
- No edites código de producto durante el refinamiento.
- Una decisión de producto que cambie alcance necesita aprobación explícita.
- Terminá con historias de usuario, ejemplos, criterios verificables, mapa de
  archivos y un veredicto de ajuste al modelo objetivo.

## Decisiones históricas promovidas

- SPEC-264 estableció que los usuarios locales de test deben quedar listos desde
  `packages/seed` mediante `markUserReady`; no agregues bypasses globales de
  onboarding ni flags de test en producción. El cookie-consent es estado del
  navegador y se cubre en E2E, no en el seed.
- SPEC-265 dejó el AI search con onboarding contextual, aviso de baja confianza,
  control de cancelación y errores diferenciados. Verificá siempre los archivos
  actuales antes de asumir que una tarea sigue pendiente.
- SPEC-200 y su seguimiento de monetización no son un contrato vigente por sí
  mismos: al tocar AI/billing contrastá el modelo actual en código, specs y
  Linear; nunca copies cuotas o ownership desde una memoria histórica.

## Verificación

- Para cambios de seed ejecutá `qz-verify --changed` y comprobá idempotencia en
  una base descartable.
- Para cambios de AI revisá proveedor, límites, moderación y ownership de costo.
- Para cerrar una spec usá `hops close-issue --plan` y no declares completado un
  PR sólo por existir: verificá merge, CI y closeout.

---
name: hospeda-config
description: Reglas para configuración compartida, registro de env vars y sincronización de schemas en Hospeda.
triggers:
  - packages/config
  - variable de entorno
  - ENV_REGISTRY
  - env schema
  - configuración compartida
---

# Hospeda Config

Usá este skill cuando agregues, renombres o elimines variables de entorno o
cambies schemas compartidos de configuración.

## Reglas

- Registrá cada variable en el `ENV_REGISTRY` y schema de la app correcta.
- Distinguí runtime, build args y variables públicas (`PUBLIC_`, `VITE_`).
- Actualizá `.env.example` generado y documentación sin incluir valores reales.
- Mantené coincidencia entre API, web, admin, Dockerfiles y worktree source.
- No edites envs de otro worktree a mano: usá el workflow de `hospeda-staging`.
- Cambios sensibles requieren revisar guards y reconciliación de drift.

## Verificación

- Ejecutá `hops env`/los guards declarados y tests de registry/schema.
- Verificá ejemplos, Docker build args y uso en código.
- Reportá variables faltantes, sobrantes o con nombres inconsistentes sin mostrar
  sus valores.

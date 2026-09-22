# Backlog de skills project-locales para Hospeda

Fecha: 2026-09-15.

Este documento define candidatos. No crea skills ni cambia la carga de OpenCode.

| Prioridad | Skill | Se carga cuando | Fuentes | No debe duplicar |
|---|---|---|---|---|
| P0 | `hospeda-architecture` | cambio cruza apps/packages o contratos | `CLAUDE.md` raíz, docs arquitectura, `AGENTS.md` | reglas universales y comandos básicos |
| P0 | `hospeda-testing-quality` | se agregan/cambian tests o guards | docs testing, commands `run-tests`/`quality-check`, CI | ejecución automática de suites completas |
| P0 | `hospeda-security` | auth, secretos, permisos, producción | security docs, guardrails, scripts guards | política global de permisos del agente |
| P0 | `hospeda-web-astro` | `apps/web` o Astro/islands | `apps/web/CLAUDE.md`, docs web | arquitectura monorepo |
| P0 | `hospeda-api-hono` | `apps/api`, rutas o middleware | `apps/api/CLAUDE.md`, route architecture | reglas genéricas TypeScript |
| P0 | `hospeda-admin-tanstack` | `apps/admin` o TanStack Start | `apps/admin/CLAUDE.md` | reglas de UI web generales |
| P0 | `hospeda-db-drizzle` | schemas, migrations o queries | `packages/db/CLAUDE.md`, migration docs | credenciales y comandos destructivos |
| P1 | `hospeda-schemas-zod` | contratos o validación | `packages/schemas/CLAUDE.md` | modelos duplicados en apps |
| P1 | `hospeda-service-core` | lógica de dominio/servicios | `packages/service-core/CLAUDE.md` | detalles de transporte Hono |
| P1 | `hospeda-auth` | Better Auth, roles, sesiones | auth docs, packages auth | secretos reales y datos de usuarios |
| P1 | `hospeda-billing` | QZPay, planes, entitlements, MP | billing docs/specs, packages billing | smoke productivo automático |
| P1 | `hospeda-i18n` | locales, claves o routing idioma | `packages/i18n/CLAUDE.md`, i18n guards | textos de negocio completos |
| P1 | `hospeda-linear-specs` | HOS, Linear o `.specs` | `.specs/README.md`, Linear adapter, workflow docs | cliente GraphQL y credenciales |
| P1 | `hospeda-worktrees` | start/close, DBs, puertos, servers | worktree design, `hops`, scripts | segundo gestor de worktrees |
| P2 | `hospeda-deploy-observability` | Coolify, Sentry, logs o VPS | deploy docs, Sentry docs, runbooks | operaciones remotas sin autorización |
| P2 | `hospeda-performance-a11y` | CWV, browser, WCAG o UX | audit commands, docs performance/a11y | cambios automáticos sin evidencia |
| P2 | `hospeda-content-media-email` | contenido, media, email, notificaciones | package `CLAUDE.md` y docs | arquitectura base |

## Reglas de autoría

- Cada skill debe tener una fuente canónica enlazada y una sección de límites.
- El contenido estable se resume; los historiales y ejemplos extensos quedan en
  documentación normal.
- Las skills no deben ejecutar mutaciones externas por defecto.
- Si dos skills necesitan la misma regla, se mueve a arquitectura o a una
  referencia común; no se copia.
- La primera implementación debe crear sólo P0 y validarse con una tarea real
  por app antes de añadir P1/P2.

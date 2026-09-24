# Hospeda — reglas universales para agentes

## Alcance y seguridad

- Este repositorio es un monorepo pnpm/Turborepo. Las reglas de este archivo aplican a casi cualquier tarea; el conocimiento específico vive en skills y documentación del área.
- Trabajá siempre en un worktree dedicado para cambios del repositorio. No edites directamente `main`, `staging` ni otro worktree activo. No hagas `push`, no cambies de branch y no crees commits sin una instrucción explícita.
- No leas, muestres ni registres secretos: contenidos de `.env`, tokens, claves privadas, credenciales, cookies o passwords. Podés verificar nombres, rutas y existencia de variables sin exponer valores.
- No ejecutes operaciones destructivas ni acciones sobre producción sin autorización explícita. En particular, no uses `db:push`, reseteos de base, migraciones destructivas ni comandos de despliegue como parte de una tarea normal.

## Arquitectura

- Aplicaciones principales: `apps/web` (Astro), `apps/api` (Hono) y `apps/admin` (TanStack Start).
- Paquetes compartidos contienen contratos y lógica reutilizable. Respetá el single source of truth: no dupliques tipos, schemas, configuración o lógica de dominio que ya exista en un paquete compartido.
- Stack transversal: TypeScript estricto, Zod, Drizzle/PostgreSQL, Vitest, Biome, pnpm y Turborepo.
- En API distinguí los niveles público, protegido y administrativo; validá entradas en runtime con Zod y mantené errores tipados.
- Respetá los límites de rutas: web consume sólo `public`/`protected`, admin consume `admin` salvo la excepción documentada de auth.
- Mantené una única fuente de verdad: schemas en `@repo/schemas`, lógica en `@repo/service-core`, DB en `@repo/db`, i18n en `@repo/i18n`, configuración en `@repo/config` y logging en `@repo/logger`.
- Usá exports nombrados, `import type`, `async/await`, parámetros readonly cuando corresponda y funciones pequeñas. Evitá archivos de más de 500 líneas salvo justificación clara.

## Cambios y validación

- Antes de editar, entendé el módulo y sus consumidores. Preferí cambios pequeños, reversibles y alineados con el issue de Linear `HOS-NNN` cuando exista.
- Para cambios de código agregá o actualizá pruebas significativas. Usá patrón Arrange/Act/Assert; no introduzcas `.only`, skips permanentes ni dependencias frágiles de orden.
- Ejecutá las verificaciones adecuadas al alcance: tests focalizados, typecheck, lint/format y build cuando corresponda. Informá qué ejecutaste y cualquier limitación.
- Seguí Conventional Commits cuando luego se autorice crear commits; agrupá cambios por unidad revisable y separá documentación de código cuando ayude a revisar.

## Workflow del proyecto

- Linear es la fuente de verdad operativa para el trabajo desde julio de 2026. Conservá la trazabilidad entre `HOS-NNN`, branch, worktree, spec y cierre.
- Diferenciá `HOS-NNN` (specs de Hospeda) de `BETA-NNN` (feedback); no infieras el equipo por la palabra “issue”.
- Los PR normales se destinan a `develop`; los PR directos a `staging` requieren una intención urgente explícita. Todos deben llevar el work tag correspondiente (`[HOS-NNN]` o `[NOSPEC:slug]`) y pasar CI antes del merge.
- El flujo `hops` y los scripts de `scripts/client-tools` automatizan worktrees, variables, puertos, bases y limpieza. Reutilizalos antes de iniciar procesos manualmente.
- Antes de `start-issue`, `close-issue` o crear un worktree, consultá `hops env --drift --json`. Si devuelve `missing`, `obsolete`, `needsValue` o `mismatched`, detené la operación y reportá sólo nombres y estados; pedí al humano los valores que requieran secreto.
- `hospeda-staging` es la fuente fija de tooling y entorno local. `hops update` debe ejecutarse al comenzar una sesión o cuando el preflight indique que el checkout está atrasado.
- Para validar cambios usá `hops verify --changed`; cuando el resultado lo consuma otro agente, usá `hops verify --changed --json` y no reconstruyas el plan leyendo logs manualmente.
- Linear es el tracking operativo y `HOS-NNN` la identidad de trabajo. ODD es el flujo predeterminado de Gentle-AI: describí el resultado, explorá, implementá y verificá; usá un documento recuperable `odd/tasks/` sólo cuando el trabajo necesite sobrevivir una interrupción. `.specs/` conserva el contrato técnico duradero cuando corresponde.
- SDD/OpenSpec está deprecado para el flujo normal de Hospeda: no lo inicies por tamaño, riesgo o incertidumbre. Sólo entra ante un pedido explícito de la persona para un lifecycle formal; no migres specs históricas ni dupliques tareas.
- `AGENTS.md` es la única fuente canónica de instrucciones compartidas por Claude Code, OpenCode y Codex. El conocimiento especializado vive en skills y documentación; no dependas de `CLAUDE.md`.

## Documentación y mantenimiento

- El conocimiento transversal debe permanecer breve aquí. Las instrucciones de Astro, Hono, TanStack Start, DB, auth, i18n, testing, Linear, worktrees y otros dominios se cargarán mediante skills especializados.
- No copies documentación extensa ni historiales en este archivo. Referenciá la fuente canónica y actualizá el skill o documento correspondiente.
- Ante una regla contradictoria, priorizá la seguridad, el estado real del código y la instrucción específica del issue; documentá la decisión.

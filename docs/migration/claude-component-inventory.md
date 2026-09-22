# Inventario de componentes Claude y destino preliminar

Este inventario es una clasificación para la migración. No implica que un
componente ya esté migrado ni que deba conservarse sin validación.

## Commands

| Command | Función actual | Dependencias principales | Estado / destino preliminar |
|---|---|---|---|
| `startIssue` | Inicia issue, valida Linear, prepara contexto y orienta la sesión | Linear, worktree, `.specs`, Git | Mantener como interfaz fina sobre `hops`; OpenCode command |
| `closeIssue` | Cierre, closeout, validaciones y actualización de Linear | Linear, `.specs`, Git, tests, smoke gates, Engram, `wt-remove.sh` | Existe globalmente en `~/.claude/commands`; portar como adaptador confirmado, con dry-run y autorización por mutación |
| `recap` | Recap read-only del worktree o varios worktrees | Git, estado local, Engram | Migrar como command read-only o subcomando `hops`; bajo riesgo |
| `handoff` | Commit local, resumen Engram, sync Task Master y prompt de continuación | Git, Engram, Task Master/Linear | Mantener como operación explícita; nunca ejecutarlo automáticamente al compactar |
| `smoke-tanda` / auditorías de smoke | Verificación guiada de despliegues y evidencia | navegador, Linear, Engram, scripts | Mantener como skill especializada; no cargar globalmente |
| `code-check` | Lint y typecheck con stop-on-error | Biome, TypeScript, pnpm/Turbo | Reemplazar prompt por `hops verify`/script determinista |
| `run-tests` | Suite de tests y cobertura | Vitest, pnpm/Turbo | Mantener como script; command sólo como wrapper |
| `quality-check` | Orquesta checks, tests y reviews | varios commands/agents | Simplificar: pipeline determinista + revisión bajo demanda |
| `code-review` | Revisión de cambios por severidad | agente reviewer, Git diff | OpenCode review agent/skill; conservar criterios, no el agente 1:1 |
| `security-review` / `security-audit` | Revisión de seguridad y OWASP | código, configuración, posible red | Skill especializada + guardas pre-commit acotadas |
| `performance-audit` | Auditoría de DB/API/frontend/CWV | código, medición, browser | Skill bajo demanda; no agente permanente |
| `accessibility-audit` / `design-review` | Auditoría visual, WCAG y UX | browser/Playwright, app levantada | Skill/browser workflow; separar diagnóstico de cambios |
| `check-deps` | Dependencias desactualizadas, CVE y licencias | registries, package managers | Script programado/CI; no usar en cada sesión |
| `hops-stats` | Estadísticas repo, tests, Linear, worktrees | `hops`, GitHub, Linear | Mantener en `hops`; OpenCode sólo invoca |
| `commit` | Sugiere Conventional Commit | Git diff | Mantener como ayuda opcional; nunca auto-commit |
| `generate-changelog` | Changelog desde Git | Git history | Script/documentación release; no específico de Claude |
| `update-docs` / `format-markdown` | Mantención de documentación | archivos Markdown, reglas locales | Skill o script especializado según necesidad |
| `add-new-entity` | Wizard de scaffolding de dominio | templates, DB, API, tests | Candidato a CLI/script determinista; requiere revisión antes de portar |
| `init-project` | Scaffolding de configuración Claude | `.claude`, templates | Legacy para Hospeda; reemplazar por bootstrap OpenCode separado |
| `five-why` | Análisis de causa raíz | debugger agent | Skill breve; no requiere agente dedicado |

## Agentes

| Agente | Función | Diagnóstico preliminar |
|---|---|---|
| `astro-engineer` | Implementación/revisión Astro | Conservar como skill `web-astro` + agente sólo si se prueba utilidad |
| `hono-engineer` | API Hono | Skill `api-hono`; agente especializado opcional |
| `tanstack-start-engineer` | Admin TanStack Start | Skill `admin-tanstack`; agente opcional |
| `db-drizzle-engineer` | Drizzle/Postgres | Skill `db-drizzle`; permisos sensibles requieren política explícita |
| `react-senior-dev` | React general | Solapado con web/admin; probablemente consolidar |
| `node-typescript-engineer` | TS/Node transversal | Reemplazable por `AGENTS.md` + skill de tooling |
| `code-reviewer` | Revisión sistemática | Conservar como único agente de review general |
| `debugger` | Diagnóstico y causa raíz | Conservar como agente general de debugging |
| `qa-engineer` | QA y tests | Consolidar con testing/verification; evitar agente paralelo redundante |
| `devops-engineer` | CI/CD/infra | Skill deploy/infra; agente bajo demanda por riesgo operativo |
| `design-reviewer` | Review visual con browser | Mantener sólo si browser workflow sigue siendo usado |
| `design-cloner` | Reproducción visual | Caso específico; no incluir en perfil por defecto |
| `ux-ui-designer` | Diseño/UX | Skill de diseño; no delegar por defecto |
| `tech-lead` | Orquestación y delegación | Gentle/OpenCode ya cubren orquestación; candidato a eliminar |
| `product-functional` | Lectura funcional | Skill/documentación de dominio, no agente persistente |
| `product-technical` | Análisis técnico de producto | Combinar con exploración/SDD |
| `content-writer` | Redacción | Skill global o documentación, fuera del núcleo de ingeniería |

## Criterio de migración

La implementación actual de `hops start-issue` ya separa la consulta GraphQL
read-only de Linear, la derivación de branch/slug y la creación del worktree,
pero finalmente ejecuta `claude` con un prompt opcional. La parte de Linear usa
el endpoint GraphQL y busca la key en variable de entorno o archivos locales
protegidos. El reemplazo debe conservar ese contrato y cambiar únicamente el
launcher del agente, idealmente mediante una opción explícita (`--agent
opencode`) y no una detección implícita.

`closeIssue` es bastante más que un cambio de estado: exige comprobar estado
idempotente, gates de smoke, PR mergeado y árbol limpio; puede escribir en
Linear, Engram y GitHub, y finalmente retirar el worktree. Debe migrarse como
una máquina de estados con preflight read-only, plan/dry-run y confirmaciones
separadas para cada escritura. `handoff` también hace commit y sincronización,
por lo que no debe quedar como acción automática de compactación.

La inspección del código confirma una dependencia técnica concreta: los comandos
`hops servers-up`, `hops servers-down` y `hops wt-clean` resuelven scripts desde
`~/.claude/skills/worktree/scripts/` (`wt-remove.sh` y scripts de servidores).
El resto del dispatcher de `hops` es local al repositorio y no necesita Claude
para resolver worktrees, branches o contexto. Esta ruta debe convertirse en una
configuración explícita y versionada antes de retirar Claude Code; no alcanza con
renombrar el command de OpenCode.

La primera ola debe migrar sólo `hops` + una interfaz fina para `startIssue`,
`closeIssue`, `recap` y `handoff`. Los agentes por framework se convierten
primero en skills cargadas bajo demanda. Se conservarán como agentes sólo
review, debugging y quizá una revisión visual/browser, después de medir su uso.

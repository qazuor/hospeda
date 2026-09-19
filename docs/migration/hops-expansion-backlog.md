# Candidatos para ampliar `hops`

Fecha: 2026-09-15.

La regla es agregar al CLI sólo operaciones deterministas, repetibles y
medibles. Las decisiones conversacionales quedan en OpenCode; los scripts
devuelven datos estructurados y exit codes.

| Prioridad | Candidato | Qué resolvería | Diseño recomendado |
|---|---|---|---|
| P0 | `hops recap` | reducir lecturas repetidas de Git/worktree/spec | implementado: salida compacta de branch, dirty, issue, DB, servidores y últimos commits; read-only |
| P0 | `hops issue-preflight HOS-N` | evitar que agentes reimplementen validaciones | implementado: lookup Linear, estado, labels, worktrees y guía PR/CI; read-only |
| P0 | `hops start-issue --agent` | eliminar launcher fijo a Claude | aceptar `opencode`, `claude`, `none`; conservar bootstrap único |
| P1 | `hops close-issue --plan` | preparar cierre sin mutar | evaluar smoke, PR mergeado, árbol limpio, closeout y cleanup; devuelve plan |
| P1 | `hops verify --changed` | ejecutar sólo guards/tests afectados | resolver paquetes/rutas staged sin red; CI conserva suite completa |
| P1 | `hops context HOS-N` | entregar contexto mínimo al agente | implementado: issue + spec + worktree + DB/servidores/Git, con `--json`; sin secretos |
| P1 | `hops smoke-plan` | enumerar smokes requeridos por labels/spec | implementado: labels `status-needs-smoke-*`, salida humana/JSON read-only |
| P2 | `hops handoff --plan` | preparar handoff sin commit | implementado: cambios, estado Git, commits recientes y pendientes; salida humana/JSON read-only |
| P2 | `hops guard` | agrupar guards locales rápidos | ejecutar sólo checks estáticos seleccionados; CI es autoridad final |
| P2 | `hops docs-check` | validar enlaces/frontmatter/format | reemplazar parte de `update-docs` narrativo |

## No agregar al CLI

- prompts conversacionales completos de Claude;
- un segundo gestor de worktrees;
- un orquestador de agentes;
- lógica de SDD/OpenSpec que duplique Gentle;
- mutaciones de Linear sin plan/autorización/read-back;
- comandos que impriman `.env`, cookies, tokens o DSN.

## Orden recomendado

Primero `recap`, `issue-preflight` y launcher configurable. Luego `close-issue
--plan`, `context` y `verify --changed`. Medir tiempo ahorrado, tamaño de
salida y errores antes de sumar los candidatos P2.

Estado actual: los candidatos P0 y P1 enumerados arriba están implementados y
validados en el worktree de migración, incluyendo `verify --changed`. Los P2
(`guard` y `docs-check`) siguen deliberadamente fuera del núcleo hasta medir
duplicación y definir reglas deterministas. `close-issue` continúa siendo
preflight/plan read-only; las mutaciones requieren una etapa posterior con
autorización y read-back.

# Backlog de commands para OpenCode + Hospeda

Fecha: 2026-09-15.

Los commands OpenCode deben ser interfaces pequeñas. La lógica determinista
debe vivir en `hops`, scripts versionados o CI; el command no debe esconder
mutaciones.

| Command | Destino | Estado | Mutaciones | Dependencias |
|---|---|---|---|---|
| `startIssue` | wrapper OpenCode sobre `hops start-issue` | P0 | worktree, opcionalmente Linear/Engram | Linear, worktrees, agente launcher |
| `closeIssue` | wrapper OpenCode sobre `hops close-issue --plan` | P0 | preflight read-only; mutaciones separadas | smoke gates, GitHub, Linear, specs, cleanup |
| `recap` | command read-only o `hops recap` | P0 | ninguna | Git, worktree, memoria opcional |
| `handoff` | command explícito | P1 | commit, Engram, progreso | Git, Linear/specs |
| `code-check` | `hops verify`/script | P0 | ninguna | Biome, TypeScript |
| `run-tests` | `hops test`/script | P0 | artefactos locales | Vitest/Turbo |
| `quality-check` | pipeline determinista + review opcional | P1 | reportes locales | guards, tests, review |
| `code-review` | agente/skill de review | P1 | ninguna salvo reporte | diff, criterios |
| `security-review` | skill + guards | P1 | ninguna | Semgrep/scanners |
| `performance-audit` | skill bajo demanda | P2 | reportes locales | browser/medición |
| `accessibility-audit` | skill/browser | P2 | reportes locales | servidor y browser |
| `design-review` | skill/browser | P2 | ninguna por defecto | UI levantada |
| `check-deps` | CI o tarea programada | P2 | cache/reportes | registry, auditoría |
| `hops-stats` | mantener sólo en `hops` | P1 | cache/historial local | GitHub, Linear |
| `commit` | ayuda opcional | P2 | commit sólo con autorización | Git |
| `generate-changelog` | script release | P2 | archivo changelog | Git history |
| `update-docs` | skill/script | P2 | archivos Markdown | docs/guards |
| `add-new-entity` | CLI determinista + review | P1 | scaffolding de archivos/DB | templates, schemas, tests |
| `init-project` | eliminar como command Claude | Legacy | configuración | reemplazar por bootstrap OpenCode |
| `five-why` | skill breve | P2 | ninguna | contexto del incidente |
| `smoke` | adaptador Linear/Hospeda + command fino | P0 | comentario, labels, estado, issue de seguimiento | gates de entorno y evidencia |
| `linear-backlog` | CLI/API genérico opcional | P1 | issues/labels/estados | contrato Linear configurable |

## Reglas

- `startIssue`, `closeIssue` y `handoff` siempre muestran preflight y plan.
- Ningún command hace `commit`, `push`, Linear Done, borrado de worktree o DB
  sin autorización explícita.
- `recap`, `code-check`, `run-tests` y audits son read-only salvo sus artefactos
  locales temporales.
- No se migran prompts completos de Claude si el script ya resuelve el trabajo.
- Los commands duplicados con `hops` se eliminan o quedan como wrappers mínimos,
  nunca como dos implementaciones independientes.
- El inventario real contiene 19 commands project-locales y 7 globales de Claude;
  el backlog trata ambos grupos, pero no implica que deban instalarse todos en
  OpenCode.

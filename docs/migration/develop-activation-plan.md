# Plan de activación de `develop`

Este plan convierte la auditoría en una secuencia verificable. Su objetivo es introducir `develop` sin que una referencia antigua a `staging` cambie silenciosamente el comportamiento.

## Orden de trabajo

| Fase | Área | Resultado requerido |
|---|---|---|
| 0 | GitHub | `develop` existe desde `staging`, con protección y reglas de CI definidas |
| 1 | Adapter | `.qz/project.json` o el adapter Hospeda declara `issueBase`, `integration`, promociones y ramas protegidas |
| 2 | Worktrees | `wt-create`, cleanup, template y env usan `issueBase`/`integration`, no una constante global |
| 3 | Hops | `start-issue`, `close-issue`, `update`, `merge`, `verify`, `ci` y `recap` consumen el adapter |
| 4 | CI | PRs a `develop`, `staging` y `main` tienen gates explícitos; no se heredan por coincidencia de texto |
| 5 | Dependabot | Actualizaciones normales apuntan a `develop`; seguridad conserva el camino urgente documentado |
| 6 | Promoción | `qz promote` y `qz back-merge` funcionan primero en `--plan` y producen evidencia |
| 7 | E2E | Una épica de varios issues llega a `develop` sin tocar `staging`; luego se promociona y se back-mergen cambios |

## Mapa de referencias que debe cambiar

- `.claude/project.config.json`: reemplazar `baseBranch` único por política de ramas y mantener compatibilidad durante la transición.
- `scripts/worktree/wt-create.sh`, `wt-cleanup.sh`, `wt-config.sh`, template y env: usar la rama declarada por el adapter.
- `scripts/client-tools`: eliminar constantes de `staging`/`main` en `start-issue`, `close-issue`, `merge`, `verify`, `ci`, `update`, `recap`, `stats` y `whats-new` donde representen política, conservándolas sólo como defaults del adapter.
- `.github/workflows`: revisar CI, E2E, CodeQL, What's New, Dependabot y sincronización de seguridad con pruebas por tipo de destino.
- `.claude/docs`, `CLAUDE.md`, `AGENTS.md` y skills: actualizar ejemplos y reglas de branch.

## Reglas de seguridad

- No crear worktrees desde `develop` hasta que template, env y DB tengan fingerprints compatibles.
- No promover automáticamente al terminar un issue.
- No hacer merge ni push implícito desde un agente.
- Un PR directo a `staging` sólo se permite con una intención urgente explícita.
- `main` sigue siendo una línea protegida y sólo recibe una promoción validada o un hotfix documentado.

## Criterios de aceptación

- `qz start-issue HOS-NNN --plan` identifica `develop` como base cuando el adapter está activado.
- Un cierre de issue crea/actualiza el PR contra `develop` y no contra `staging` por accidente.
- `qz verify --changed` compara contra la base correcta del worktree.
- `qz promote --plan develop staging` y `qz promote --plan staging main` enumeran diferencias y gates sin mutar Git.
- `qz back-merge --plan main staging` detecta si no hay nada que reconciliar.
- Un test E2E demuestra la ruta urgente directa a `staging` y su back-merge posterior.
- El rollback consiste en volver el adapter a `staging`, sin borrar worktrees ni memoria.

## Fuera de alcance actual

No se crea la rama `develop`, no se cambian workflows, no se toca Linear y no se implementan aún los comandos. Primero debe aprobarse este contrato y decidirse la política de protección de la nueva rama.

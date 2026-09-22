# Auditoría de skills duplicadas en OpenCode V1

Fecha: 2026-09-18.

OpenCode V1 inicia y carga 87 skills, pero informa nombres duplicados porque busca en más de una raíz global. No se eliminó ni modificó ningún skill.

## Fuentes observadas

- `~/.claude/skills`: fuente compatible con Claude Code.
- `~/.agents/skills`: fuente compartida administrada por Gentle-AI.
- `~/.config/opencode/skills`: copia global específica de OpenCode/Gentle.
- `.opencode/skills` y `.claude/skills` del proyecto: fuentes locales de Hospeda.

## Resultado de hashes

La mayoría de los duplicados entre `~/.agents/skills` y `~/.config/opencode/skills` son byte a byte idénticos. Las copias en `~/.claude/skills` divergen en varios skills, por lo que no deben borrarse ni reemplazarse automáticamente.

Duplicados exactos entre `.agents` y `.config/opencode`:

- `cognitive-doc-design`
- `gentle-ai-bench`
- `rdd-defect-workflow`
- todas las skills `sdd-*`
- `skill-registry`
- `systemic-issue-triage`
- `work-unit-commits`

Skills con divergencias respecto de Claude:

- `branch-pr`
- `chained-pr`
- `comment-writer`
- `go-testing`
- `issue-creation`
- `judgment-day`
- `skill-creator`
- `skill-improver`
- `work-unit-commits`

## Fuente canónica recomendada

Para el runtime OpenCode + Gentle V1:

1. `~/.agents/skills` debe ser la fuente canónica de skills administradas por Gentle.
2. `~/.config/opencode/skills` debe quedar vacío o contener sólo overrides explícitos de OpenCode.
3. `~/.claude/skills` se conserva separado para compatibilidad futura con Claude Code.
4. Las skills específicas de Hospeda deben vivir en el worktree/proyecto, dentro de `.opencode/skills`.
5. Los archivos `synced` de Claude deben considerarse snapshots administrados, no fuente manual.

## Resultado aplicado

Se movieron 25 `SKILL.md` idénticos desde `~/.config/opencode/skills` a la cuarentena reversible:

`~/.local/state/hospeda-opencode-migration/quarantine/opencode-skills-duplicates-2026-09-18/`

El manifest contiene hashes, origen, fuente canónica y destino. Las carpetas auxiliares `strict-tdd.md`, `strict-tdd-verify.md` y `_shared` quedaron en OpenCode porque no eran duplicados equivalentes.

La TUI V1 fue probada después del cambio: no aparecen errores de carga de plugins ni `plugin operation stalled`; el cache de model variants sigue presente. Quedan 15 warnings intencionales por coexistencia Claude/Gentle, preservada para no romper Claude Code.

## Operación futura recomendada

Antes de limpiar:

- crear backup de las cuatro raíces;
- comparar hashes y fechas;
- confirmar qué agente sigue usando cada raíz;
- iniciar OpenCode y Claude con una sesión de prueba;
- mover duplicados a cuarentena, nunca borrarlos directamente;
- mantener un manifiesto de restore.

La limpieza queda pendiente porque mover una copia global puede cambiar el comportamiento de Claude o de otro agente. El warning no bloquea OpenCode V1 y no justifica una eliminación apresurada.

# `.specs` de Hospeda vs SDD/OpenSpec de Gentle-AI

## Ciclo de Gentle-AI

La instalación actual expone el ciclo `explore → propose → spec → design →
tasks → apply → verify → archive`, con `state.yaml`, artefactos separados,
status nativo v2, dependencias entre fases y reportes de verificación con
conteos de requisitos/escenarios. El artifact store puede ser OpenSpec local,
Engram, híbrido o ninguno; no está fijado por el command.

El sistema impone gates fuertes: no aplicar sin spec/design/tasks, no archivar
sin tareas completas y verify report válido, y exige evidencia runtime para
escenarios. También contempla autoridad de edición por raíz autorizada y
preserva un audit trail al archivar.

## Diferencias relevantes

| Tema | `.specs` Hospeda | Gentle SDD/OpenSpec |
|---|---|---|
| Identidad | `HOS-NNN` asignado por Linear | nombre de change; no conoce HOS por sí solo |
| Fuente de verdad | Linear para estado macro; Git para código | artifact store declarado + status nativo |
| Propuesta/exploración/diseño | mezclados según la spec y comandos Claude | fases explícitas y separadas |
| Tareas | Task Master local por spec, con sync Linear acoplado | `tasks.md` y estado SDD |
| Verificación | quality gates, tests y closeout variable | verify report estricto y requisitos/escenarios |
| Archivo | `closeout.md`, historial `.specs` | archive mecánico, delta specs y audit trail |
| Worktrees | integración profunda con `hops` y DB/puertos | no reemplaza el lifecycle de Hospeda |
| Linear | modelo operativo completo | no es fuente de verdad automática para HOS |
| Lock-in | convenciones propias + plugin Task Master | convenciones Gentle/OpenSpec; migrable si se conservan Markdown |

## Evaluación de alternativas

- **A — sólo `.specs`**: menor cambio y máxima continuidad; conserva ergonomía actual pero pierde gates y status estructurado de SDD.
- **B — sólo Gentle SDD**: mejora lifecycle y verificación, pero rompe identidad HOS, Linear, scripts y metadata histórica; no recomendable.
- **C — `.specs` + agentes/workflows Gentle**: conserva el formato y adopta mejores agentes, pero deja dos ciclos de estado potencialmente ambiguos.
- **D — adaptar `.specs` a conceptos SDD**: agrega proposal/design/verify de forma gradual, preservando `spec.md`, `tasks/` y closeout; costo moderado y buena trazabilidad.
- **E — SDD sólo para features complejas**: evita ceremonialidad en bugs/tareas pequeñas; requiere criterio claro de entrada.
- **F — híbrido por capas**: Linear/HOS + `.specs` siguen siendo la identidad de Hospeda; Gentle SDD orquesta exploration/design/tasks/verify para cambios complejos y guarda artefactos OpenSpec bajo una raíz versionada sólo si se decide por change.

## Taskmaster y estado de la instalación

`.claude/project.config.json` declara `taskMaster.backend: linear`, pero la
instalación limpia de OpenCode/Gentle no contiene el plugin task-master de
Claude. El repositorio conserva tanto `.specs` con backend Linear como algunos
`.claude/tasks`/`.qtm` legacy. Por lo tanto, no se debe asumir que los comandos
`/next-task`, `/tasks` o `index-sync` estén disponibles después de retirar
Claude.

La migración inicial debe conservar `.specs` y Linear como fuente de verdad y
tratar taskmaster como una dependencia opcional a reimplementar o reemplazar.
Sólo conviene recuperar su ergonomía (selección de próxima tarea, quality gate,
progreso) mediante scripts/commands deterministas si se demuestra que el equipo
la usa. No conviene reinstalar el plugin de Claude dentro de OpenCode como copia
1:1.

## Recomendación

Adoptar **F con reglas de D y E**:

1. Linear continúa siendo la fuente de verdad operativa y `HOS-NNN` el identificador.
2. `.specs/HOS-NNN-*` continúa siendo el registro técnico canónico de Hospeda.
3. Para features complejas, Gentle aporta exploration, proposal, design, tasks y verify; un adaptador debe enlazar cada change con `HOS-NNN` y `.specs` sin duplicar estados.
4. Para bugs y tareas pequeñas, usar Linear + `hops`, sin SDD completo.
5. `archive` de Gentle no debe borrar ni mover `.specs`; debe producir closeout compatible o un enlace explícito.
6. Task Master no se migra por inercia: primero se prueba si sus gates y sync Linear siguen siendo necesarios frente al flujo SDD.

La decisión queda reversible porque no exige convertir las specs históricas ni
crear una segunda fuente de verdad para el estado del issue.

## Verificación del checkout (2026-09-15)

El sistema real contiene 147 directorios `.specs`, 146 `spec.md`, 5
`closeout.md`, 45 carpetas `tasks/` con 86 archivos de tareas/estado, y 41
`TODOs.md` asociados a tareas Claude. La metadata `statusSource: linear` aparece
en los 147 directorios inspeccionados. No existe un `tasks.md` único y uniforme
dentro de `.specs`; el seguimiento vive en carpetas de tareas, `.claude/tasks` y
Linear. Esto refuerza la recomendación
de no hacer una conversión masiva a Gentle SDD: primero hay que preservar la
identidad Linear y definir un adaptador de trazabilidad para cambios complejos.

# Gap de `closeIssue`

Fecha: 2026-09-16

## Hallazgo inicial

La inspección inicial no encontró una implementación ejecutable de `closeIssue`.
El gap quedó resuelto en este worktree con un preflight determinista y un
command OpenCode prefijado. El cierre mutante sigue separado deliberadamente.

## Implementación inicial

Se agregó `hops close-issue --plan [--issue HOS-NNN]` en este worktree. El comando es
estrictamente read-only: inspecciona branch, estado Git, commits sin upstream,
specs asociadas, issue Linear y recursos registrados, y marca como pendientes
CI/PR, smoke y closeout. `--help` funciona como el resto del CLI.

La suite completa de `client-tools` pasó: 292 tests, 0 fallos y 687
aserciones. El plan JSON ahora incluye acciones propuestas derivadas de la
evidencia encontrada, mientras que `acciones ejecutadas` permanece siempre
vacío en esta fase.
Si Linear o GitHub no pueden consultarse, el plan conserva su salida JSON y
devuelve exit code `1`; así un agente no puede interpretar una consulta
incompleta como un cierre exitoso.

El plan acepta `--issue HOS-NNN` cuando la branch no contiene el identificador;
la prueba con HOS-1344 consultó Linear y mostró `Backlog` sin mutar nada. Ahora
informa también si existen `closeout.md` y `tasks/state.json` en la spec.

También consulta el PR/CI de la branch mediante `gh` en modo read-only y
reporta `sin PR`, error o un resumen del PR/checks.

El plan muestra labels y detecta los gates `status-needs-smoke-*` sin retirar ni
actualizar ninguno.

## Implicación

El wrapper OpenCode ya existe en `.opencode/commands/hops-close-issue.md` y
llama únicamente a `hops close-issue --plan`. No marca Done, no cierra gates,
no comenta, no hace push, merge ni elimina worktrees. Las mutaciones siguen
siendo una segunda fase con autorización y read-back.

## Próximo diseño

1. Implementar preflight sin mutaciones.
2. Mostrar estado Linear, PR, CI, smoke, spec/closeout, árbol Git y recursos.
3. Emitir un plan explícito de acciones.
4. Aplicar cada mutación por separado, con confirmación.
5. Leer nuevamente Linear/Git/worktree para comprobar el resultado.

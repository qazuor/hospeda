# Frontera entre `hops` y OpenCode

Fecha: 2026-09-15.

`@hospeda/client-tools` expone 19 comandos registrados. Es la capa correcta
para operaciones deterministas porque ya declara alcance (`local`, `remote` o
`both`), carga módulos bajo demanda y devuelve códigos de salida composables.

## Comandos que deben permanecer en `hops`

- `db-start`, `db-stop`, `db-migrate`, `db-seed`, `db-studio`, `db-fresh` y
  `db-update-template`;
- `servers-up`, `servers-down`, `wt-clean` y `env`;
- `verify`, `test`, `ci`, `merge`, `stats`, `run` y `update`.

Estos comandos necesitan contratos de filesystem, Docker, DB, puertos, CI o
GitHub que no deben duplicarse en plugins o commands conversacionales.

## `hops recap` versus `/recap`

`hops recap` es el inventario determinista y barato del worktree: branch, issue,
Git, DB, servidores y commits. `/recap` es una command de OpenCode que ejecuta
ese inventario y luego agrega contexto de sesión: qué se hizo, hallazgos,
problemas, decisiones, pendientes, riesgos y próximo paso. El command no debe
reimplementar los hechos de `hops`, escribir memoria ni mutar servicios.

Esta regla aplica a todos los commands: `hops` hace el trabajo pesado y ofrece
salida estructurada más una vista humana; el command del agente sólo agrega la
capa conversacional necesaria. Los commands propios usan el prefijo `hops-`.

## Wrappers OpenCode permitidos

Sólo conviene añadir wrappers finos para:

- `startIssue` → `hops start-issue --agent opencode`;
- `closeIssue` → workflow de preflight sobre CLI genérico;
- `recap` → lectura de estado local y memoria opcional;
- `handoff` → operación explícita con confirmación.

El wrapper debe reenviar exit code, stdout estructurado y errores; no debe
reimplementar la lógica.

## Discrepancia relevante

El registro actual no contiene `close-issue`: el cierre vive hoy en comandos y
workflow Claude, mientras que `hops` ya cubre parte del preflight, CI, merge y
cleanup. Por eso `hops close-issue --plan` debe diseñarse como una composición
de capacidades existentes y una nueva capa de plan, no como una copia literal
del prompt Claude. La primera versión debe ser read-only y producir un plan
estructurado antes de permitir cualquier mutación.

## Dependencia actual a corregir

El registro describe `start-issue` como “abre Claude adentro” y la implementación
lanza el binario `claude`. La futura adaptación debe introducir un launcher
configurable y conservar Claude como fallback temporal, sin cambiar el resto del
bootstrap.

No se modificó el CLI en esta etapa.

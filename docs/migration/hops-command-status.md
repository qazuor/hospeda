# Estado funcional de los comandos `hops`

Fecha: 2026-09-16.

Este inventario distingue código existente de funcionamiento validado. La suite
unitaria prueba reglas y parsing, pero no reemplaza una prueba end-to-end con
Linear, GitHub, Docker/Postgres, servidores y worktrees reales.

## Comandos implementados

La suite completa de `scripts/client-tools` quedó en **294 tests pasados, 0
fallos y 724 assertions** después de agregar los binarios standalone de los
wrappers `gentle-status` y `gentle-sdd-status`. Esto valida contratos y
parsing locales; no reemplaza los gates E2E que requieren Docker, worktrees,
servidores o GitHub real.

| Comando | Estado | Qué hace | Dependencia o límite pendiente |
|---|---|---|---|
| `artifact` | completo local | valida, publica y lista bundles | flujo local; hosting remoto no integrado |
| `stats` | completo local | reúne métricas de código, tests, Git, PRs y Linear | algunas métricas externas dependen de credenciales/red |
| `wt-clean` | completo con confirmación | inventaría y elimina worktrees, DB y servidores seleccionados | requiere TTY y prueba manual de cleanup controlado |
| `start-issue` | completo en flujo controlado | consulta Linear, deriva branch, crea/reutiliza worktree y lanza agente | E2E real creó/compiló/eliminó un worktree de HOS-1344; DB/servers reales quedan como gates separados |
| `close-issue --plan` | preflight completo | reúne criterios de cierre, Git, spec, Linear, PR/CI y smoke-gates | cierre mutante todavía no implementado |
| `handoff --plan` | completo read-only | arma hechos para handoff en texto/JSON | narrativa final pertenece al command del agente |
| `recap` | completo read-only | resume worktree, issue, Git, DB, servidores y commits | no consulta memoria automáticamente |
| `context` | completo read-only | entrega contexto compacto de issue/worktree | cobertura depende de que Linear/spec/worktree existan |
| `issue-preflight` | completo read-only | consulta issue, labels, worktrees y guía PR/CI | sólo lectura; no inicia workflow |
| `smoke-plan` | completo read-only | traduce labels `status-needs-smoke-*` a gates | ejecución y actualización de evidencia siguen fuera |
| `ci` | completo para consulta inmediata; espera separada | consulta PR/checks con `gh`; distingue verde, rojo, pending, conflicto, sin checks y espera; `--json` entrega contrato para agentes | `--wait` conserva salida textual; faltan estados de PR reales distintos a `no-pr` en esta migración |
| `merge` | completo como gate read-only | dictamina si un PR apunta a staging y está listo; `--json` entrega contrato para agentes | depende de GitHub real; no mergea por diseño |
| `verify` | completo como runner local | lee `.github/workflows/ci.yml` y ejecuta lint/guards/typecheck; `--changed` activa el camino recomendado para cambios | la validación E2E de diffs del monorepo queda como gate operativo |
| `test` | completo local | ejecuta tests por categoría | depende de dependencias/servicios de cada paquete |
| `run` | completo con guardas | busca scripts y ejecuta el elegido | scripts mutables requieren autorización; no es sandbox |
| `env` | completo read-only | verifica presencia/forma sin imprimir valores | no valida que un proveedor externo acepte la credencial |
| `db-start/stop` | implementado, no E2E validado en esta migración | inicia/detiene Postgres y Redis compartidos | Docker, puertos y procesos reales pendientes de prueba controlada |
| `db-migrate/seed/studio/fresh/update-template` | implementados, validación controlada pendiente | operaciones de base y Drizzle por worktree | mutan DB o abren procesos; falta prueba autorizada y rollback |
| `servers-up/down` | implementados, validación controlada pendiente | lifecycle de DB y servidores con puertos del worktree | requiere procesos reales; no duplicar con plugin PTY |
| `ci` / `merge` | no mutantes por diseño | lectura de GitHub y gates | no deben marcar Linear ni ejecutar merge |
| `update` | implementado | actualiza client-tools desde staging | muta checkout/dependencias; falta prueba de rollback |

## Candidatos todavía no implementados

| Candidato | Qué resolvería | Decisión preliminar |
|---|---|---|
| `verify --changed` | ejecutar sólo guards/tests afectados por rutas modificadas | implementado; falta validación con diffs reales |
| `guard` | agrupar guards estáticos rápidos con exit code uniforme | implementar después de medir duplicación con `verify` |
| `quality-check` | composición de formato, guards, typecheck y tests | probablemente alias/composición, no otro motor |
| `docs-check` | validar frontmatter, enlaces y convenciones documentales | implementar sólo reglas deterministas claras |
| `smoke` | ejecutar smoke, guardar evidencia y eventualmente actualizar Linear | diseñar como flujo separado con plan, autorización y read-back |
| `linear-backlog` | consultas masivas y filtros de issues | opcional; no es necesario para iniciar/cerrar issues |

## No conviene convertirlos en `hops`

`code-review`, `security-review`, `performance-audit`,
`accessibility-audit`, `design-review`, `five-why` y análisis narrativos deben
seguir como skills/agents de OpenCode o Gentle-AI, consumiendo la evidencia que
producen los scripts. `commit`, `push` y `merge` deben conservarse como acciones
separadas y autorizadas.

## Qué significa “completo” para el cierre del gate

Antes de usar OpenCode como entorno principal se debe completar la validación
controlada de los comandos con efectos externos y de `ci`/`merge` con estados
reales. La existencia de tests unitarios o de un binario ejecutable no alcanza
para declarar terminado el workflow.

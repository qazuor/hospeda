# Compatibilidad OpenSpec ↔ workflow Hospeda

Fecha: 2026-09-24.

| Área | Hospeda actual | OpenSpec/Gentle | Decisión provisional |
|---|---|---|---|
| Identificador | `HOS-NNN` en Linear y `.specs/HOS-NNN-*` | `change-id` libre | El issue HOS es la identidad; OpenSpec usa un slug derivado |
| Fuente funcional | `.specs` y sus estados/closeout | `openspec/changes` y `openspec/specs` | `.specs` conserva la autoridad; OpenSpec sólo delta cuando se elija explícitamente |
| Tasks | tasks/state y closeout por spec | `tasks.md` y apply progress | No duplicar: un adaptador debe leer/escribir el formato elegido por issue |
| Exploración/propuesta | documentación y comandos propios | proposal/design/spec | Usar OpenSpec para features complejas; no imponerlo a fixes pequeños |
| Branch | `develop` por defecto; promoción a `staging` y `main` | config vieja basada en `staging` | El adapter `qz` es la fuente; OpenSpec debe recibir base/target explícitos |
| Linear | API/CLI read-only y comandos `hops-*` | no trae integración Hospeda | Mantener `hops` como autoridad de Linear |
| Worktrees | `hops`/scripts con DB, envs y puertos | SDD no crea nuestro lifecycle | No introducir un segundo sistema |
| Verify | `hops verify --changed` y guards del repo | `sdd-verify` | `hops verify` valida el código; SDD sólo puede aportar trazabilidad |
| Archive | closeout y estado del issue | archive de delta specs | Archivar sólo después de sincronizar `.specs` y Linear |

## Arquitectura recomendada

1. `hops start-issue` crea la branch desde `develop`, worktree y contexto
   Linear.
2. Para un fix o cambio pequeño, se usa `.specs` sólo si el issue lo exige y
   no se inicia SDD.
3. Para una feature compleja, `hops` crea o vincula un `change-id` OpenSpec
   determinista (`hos-205-host-web-foundation`, por ejemplo) y conserva el
   `HOS-NNN` como identidad primaria.
4. Gentle SDD opera proposal/design/spec/tasks dentro de ese change, pero no
   administra branches, Linear, DB ni puertos.
5. `hops verify --changed` y los guards del repositorio siguen siendo la puerta
   de verificación técnica.
6. `hops close-issue --plan` comprueba spec, tasks, closeout, CI, Linear y PR;
   el archive SDD sólo se considera después de esa evidencia.

Esta arquitectura evita duplicar el sistema `.specs` completo y permite
probar SDD en features complejas sin convertir sus artifacts en una segunda
fuente de verdad accidental.

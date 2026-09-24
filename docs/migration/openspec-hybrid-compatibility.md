# Compatibilidad OpenSpec ↔ workflow Hospeda

Fecha: 2026-09-24.

| Área | Hospeda actual | OpenSpec/Gentle | Decisión provisional |
|---|---|---|---|
| Identificador | `HOS-NNN` en Linear y `.specs/HOS-NNN-*` | `change-id` libre | El issue HOS es la identidad; OpenSpec usa un slug derivado |
| Fuente funcional | `.specs` y sus estados/closeout | `openspec/changes` y `openspec/specs` | `.specs` conserva la autoridad; OpenSpec sólo delta cuando se elija explícitamente |
| Tasks | tasks/state y closeout por spec | `tasks.md` y apply progress | No duplicar: un adaptador debe leer/escribir el formato elegido por issue |
| Exploración/propuesta | ODD y documentación propia | proposal/design/spec | ODD es obligatorio por defecto; OpenSpec sólo ante pedido explícito |
| Branch | `develop` por defecto; promoción a `staging` y `main` | config vieja basada en `staging` | El adapter `qz` es la fuente; OpenSpec debe recibir base/target explícitos |
| Linear | API/CLI read-only y comandos `hops-*` | no trae integración Hospeda | Mantener `hops` como autoridad de Linear |
| Worktrees | `hops`/scripts con DB, envs y puertos | SDD no crea nuestro lifecycle | No introducir un segundo sistema |
| Verify | `hops verify --changed` y guards del repo | `sdd-verify` | `hops verify` valida el código; SDD sólo puede aportar trazabilidad |
| Archive | closeout y estado del issue | archive de delta specs | Archivar sólo después de sincronizar `.specs` y Linear |

## Arquitectura recomendada

1. `hops start-issue` crea la branch desde `develop`, worktree y contexto
   Linear.
2. Para cualquier trabajo normal, ODD explora y mantiene un único documento
   recuperable; `.specs` se usa sólo si el issue necesita contrato técnico.
3. Sólo ante un pedido explícito de SDD, `hops` crea o vincula un `change-id`
   OpenSpec determinista (`hos-205-host-web-foundation`, por ejemplo) y
   conserva el `HOS-NNN` como identidad primaria.
4. Gentle SDD opera proposal/design/spec/tasks dentro de ese change explícito,
   pero no administra branches, Linear, DB ni puertos.
5. `hops verify --changed` y los guards del repositorio siguen siendo la puerta
   de verificación técnica.
6. `hops close-issue --plan` comprueba spec, tasks, closeout, CI, Linear y PR;
   el archive SDD sólo se considera después de esa evidencia.

Esta arquitectura evita duplicar el sistema `.specs` completo. ODD es la
fuente de ejecución normal; SDD queda aislado como excepción explícita y sus
artifacts nunca se convierten en una segunda fuente de verdad.

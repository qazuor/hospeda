# Verificación actualizada — 2026-09-22

La auditoría read-only confirmó que `develop` todavía no existe ni localmente ni
en `origin`. El contrato de configuración ya quedó preparado para que `develop`
sea la base por defecto de nuevos issues; la rama real aún debe activarse en una
etapa separada. `main` continúa siendo la única rama protegida declarada por el
adapter durante esta transición.

La activación requiere una decisión explícita y una etapa separada: crear la rama,
ajustar GitHub/CI, validar template y env, y probar start/close issue. Mientras
tanto, `start-issue` acepta `--base staging` para un trabajo urgente que deba
saltear `develop`.

## Auditoría para agregar `develop`

El repositorio actual sólo conoce operacionalmente `staging` y `main`.

## Referencias críticas

- `.qz/project.json` declara `develop` como base, la cadena
  `develop -> staging -> main` y sólo `main` como protegida; el archivo legacy
  `.claude/project.config.json` conserva el mismo `baseBranch` para compatibilidad.
- `start-issue`, `wt-create`, template DB y `update` cortan o sincronizan desde
  `staging`.
- `merge` y sus gates esperan PRs hacia `staging`.
- `verify` usa `origin/staging` como baseline.
- `whats-new` audita `origin/main..origin/staging`.
- CI tiene rutas distintas para PRs/pushes a `staging` y `main`; cobertura
  reforzada sólo aplica a `main`.
- Dependabot apunta actualizaciones normales a `staging`; los security updates
  pueden entrar a `main` y luego volver por `main -> staging`.
- `sync-main-to-staging.yml` automatiza el back-merge de seguridad.

## Implicación

Agregar `develop` no es cambiar un nombre. Requiere separar tres conceptos:

1. `issueBaseBranch`: de dónde se cortan issues nuevas, inicialmente `develop`;
2. `integrationBranch`: dónde caen automáticamente los trabajos terminados;
3. `promotionBranches`: `develop -> staging -> main`, con escapes directos a
   `staging` para urgencias explícitas.

Los comandos `qz start-issue`, `qz close-issue`, `qz promote` y
`qz back-merge` deben leer esos valores del adapter. El adapter Hospeda puede
mantener `staging` como base durante la transición hasta que la rama exista.

No se creó la rama ni se modificó Git remoto, CI, Linear o protección de GitHub en
esta etapa.

## Matriz de transición propuesta

| Superficie | Hoy | Objetivo | Regla de compatibilidad |
|---|---|---|---|
| Base de `start-issue`/`wt-create` | `staging` | `develop` | El default ya es `develop`; `--base staging` es el bypass explícito hasta activar la rama. |
| Cierre de issue | PR hacia `staging` | PR hacia `develop` | `--base` explícito permite urgencias directas a `staging`. |
| Promoción | manual `staging → main` | `develop → staging → main` | Cada salto exige CI, mergeability y working tree limpio. |
| Back-merge | `main → staging` | `main → staging` y `staging → develop` | Nunca hacer back-merge implícito durante un cierre de issue. |
| Verificación | baseline `origin/staging` | baseline configurable | El comando debe imprimir la base efectiva en JSON y texto. |
| `wt-clean`/stats | asumen `origin/staging` | reciben base resuelta | No borrar worktrees si la base efectiva no pudo resolverse. |

### Contrato de configuración

El adapter del proyecto debe exponer, sin duplicarlo en cada comando:

- `issueBaseBranch`: rama desde la que se crean issues nuevas;
- `integrationBranch`: rama objetivo del cierre normal;
- `promotionChain`: lista ordenada de promociones;
- `urgentBases`: bases permitidas para escapes explícitos;
- `backMergeChain`: pares de ramas que deben mantenerse sincronizados.

La implementación debe rechazar una configuración donde una rama de la cadena
no exista local/remotamente, salvo el modo explícito de transición. No se debe
crear `develop`, cambiar protección de GitHub ni modificar CI como parte de este
análisis.

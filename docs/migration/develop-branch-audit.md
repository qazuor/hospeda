# Auditoría para agregar `develop`

El repositorio actual sólo conoce operacionalmente `staging` y `main`.

## Referencias críticas

- `.claude/project.config.json` declara `staging` como `baseBranch` y protege
  `main`/`staging`.
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

Los comandos futuros `qz start-issue`, `qz close-issue`, `qz promote` y
`qz back-merge` deben leer esos valores del adapter. El adapter Hospeda puede
mantener `staging` como base durante la transición hasta que la rama exista.

No se modifica Git ni CI en esta etapa.

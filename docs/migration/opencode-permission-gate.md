# OpenCode — Gate 3 de permisos (auditoría read-only)

Fecha: 2026-09-15

## Estado observado

La configuración global contiene dos familias de reglas:

- `bash`: 15 reglas. El comodín `*` está en `allow`; commit, push, force-push,
  rebase, reset hard, ssh/scp/sftp y rsync están en `ask`.
- `read`: 14 reglas. El comodín está en `allow`; `.env`, `.env.*`, `.ssh`,
  `.aws/credentials`, `.credentials`, `credentials.json`, `secrets`, claves
  `.key`/`.pem` y keychains están en `deny`.

No se mostraron valores de variables ni contenidos sensibles. La política
global es amplia para shell y depende de que OpenCode aplique correctamente la
precedencia de reglas específicas sobre comodines. Debe tratarse como riesgo
hasta probar esa precedencia en una sesión aislada.

El checkout contiene además `.claude/settings.json`, que protege operaciones
contra `main`/`staging`, y `AGENTS.md` con reglas de trabajo seguro. Son capas
distintas: una instrucción documental no sustituye un permiso del runtime.

## Recomendación para la siguiente etapa

Conservar la política actual como rollback, pero diseñar una política por
capas: lectura del repositorio y diagnósticos reversibles permitidos; cambios
locales y procesos persistentes con autorización; commit, push, operaciones de
base de datos, deploy, producción, secretos y destrucción prohibidos o con una
confirmación específica. La política final debe probarse con comandos inocuos
que sólo verifiquen allow/ask/deny y nunca con push, reset, migraciones o acceso
a secretos.

No se modifica todavía `opencode.json`, `.claude/settings.json`, hooks ni
permisos del sistema.

## Revalidación read-only — 2026-09-20

La configuración efectiva de `~/.config/opencode/opencode.json` mantiene 15
reglas `bash` y 14 reglas `read`: comodines de lectura/shell permitidos, con
`ask` para commit/push/rebase/reset hard/SSH/SCP/SFTP/rsync y `deny` para
`.env`, `.ssh`, credenciales, secretos y claves privadas. No se alteró ninguna
regla ni se ejecutaron comandos para probar una mutación.

## Revisión contra la documentación V1 — 2026-09-22

La documentación V1 confirma que las reglas se declaran bajo `permission` y
que `bash` admite patrones específicos con resultados `allow`, `ask` o `deny`.
La configuración instalada usa esa sintaxis; no debe mezclarse con la sintaxis
de V2 (`permissions`, `shell`, `subagent`). Fuentes: [permissions V1](https://dev.opencode.ai/docs/permissions/)
y [configuración V1](https://dev.opencode.ai/docs/config/).

La política recomendada para el siguiente cambio es:

| Superficie | Default | Excepciones automáticas | Siempre pedir | Denegar |
|---|---|---|---|---|
| `bash` | `ask` | diagnóstico local, `git status/diff/log`, `rg`, `hops * --plan/--json`, guards read-only | `pnpm/bun install`, Docker, DB, servidores, `gh`, `git commit`, `git push`, worktrees y ramas | `git push --force`, `git reset --hard`, `rm -rf`, `docker compose down -v`, producción |
| `read` | `allow` | repo y documentación | — | `.env*`, `.ssh`, credenciales, claves, secretos y keychains |
| `edit` | `allow` en el worktree actual | archivos versionados del worktree | fuera del worktree o rutas externas | secretos y archivos protegidos |
| `task` | `ask` | agentes de revisión explícitamente declarados | agentes con shell/red | agentes no declarados |

No se aplica esta matriz todavía: el cambio global debe hacerse con backup,
una sesión de prueba y rollback. El motivo es evitar que un ajuste de
permisos interrumpa `hops`, Gentle o el flujo de worktrees antes de verificar
la precedencia efectiva de las reglas en OpenCode V1.

## Revalidación efectiva de agentes — 2026-09-23

La configuración activa sigue usando el permiso global `bash: "*": "allow"`
con excepciones `ask` para Git mutante y transporte remoto. Las reglas de
lectura sensible continúan bloqueando `.env*`, `.ssh`, credenciales, secretos y
claves privadas.

Se verificó además la separación de agentes: `explore`, `jd-judge-a`,
`jd-judge-b` y `review-refuter` no pueden ejecutar shell ni escribir; los
agentes de review por riesgo tienen permiso global denegado; `review-validator`
permite únicamente `gentle-ai review inspect-candidate` y mantiene edición,
write y task bloqueados. `gentle-orchestrator` sólo puede lanzar los agentes
explicitamente enumerados.

Conclusión: la segmentación de subagentes es adecuada, pero el comodín global
de Bash sigue siendo demasiado amplio para cerrar la migración. El próximo
cambio seguro es probar una copia de configuración con default `ask` y una
allowlist mínima de diagnósticos, conservando rollback. No se modificó aún la
configuración activa ni se ejecutaron operaciones mutantes para probarla.

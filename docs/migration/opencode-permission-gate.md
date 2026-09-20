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

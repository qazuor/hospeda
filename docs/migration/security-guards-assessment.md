# Seguridad y guards — evaluación para OpenCode

## Estado observado

Después de la instalación limpia, no existe configuración OpenCode project-local
en el worktree de migración. La configuración global de Gentle mantiene
`bash: "*": "allow"` para el agente principal, mientras que el agente
`review-validator` sólo permite su comando específico de inspección y niega el
resto de Bash. Esto debe endurecerse antes de habilitar tareas de Hospeda, sin
alterar el contrato administrado por Gentle de forma aislada.

La configuración de ejemplo del skill de worktree incluye campos de conexión de
DB con credenciales embebidas. No se copiarán ni se registrarán sus valores. La
futura configuración versionada debe usar referencias a variables o archivos
locales protegidos y rechazar credenciales en JSON trackeado.

La inspección de `.claude/project.config.json` confirmó que el problema también
aparece en la configuración del proyecto: existe un `connStringTemplate` con
forma de credencial local embebida. No se copió su valor al informe. Antes de
versionar o reutilizar esta configuración debe reemplazarse por referencias a
variables/archivos protegidos y agregarse un guard que bloquee DSN con password.

El pre-commit actual hace cuatro cosas: escanea patrones básicos de secretos en
los cambios staged, ejecuta `lint-staged`, bloquea `ilike()` directo fuera de
`safeIlike()` y valida documentación `.claude`. Luego intenta sincronizar TODOs
con GitHub, aunque ese paso es tolerante a fallos. Los guards más importantes
están además en CI mediante `pnpm check:guards`, Semgrep, auditoría de
dependencias y tests guard.

El repositorio tiene una colección amplia de guards específicos: schema drift,
env registry, CSP, imports Cloudinary, casts inseguros, soft-delete actor,
vocabulario de dominio, seed dual-write, fechas locales, resolución de planes,
i18n y aislamiento de proveedores. Son reglas de dominio valiosas; no deben
trasladarse como permisos de OpenCode, sino permanecer versionadas y ejecutarse
en CI o en comandos deterministas.

## Política futura

### Automático

- formato y lint staged;
- typecheck focalizado cuando el cambio sea TypeScript;
- tests rápidos del paquete afectado;
- guards estáticos sin red ni mutaciones;
- detección de secretos en diff, con scanner dedicado además de regex;
- validación de que se agregó migración cuando cambia seed persistente;
- detección de archivos fuera del worktree o cambios en `.env`/credenciales.

### Requiere autorización

- cualquier escritura en Linear, GitHub, Sentry o servicios externos;
- creación/eliminación de worktrees, ramas, DBs, contenedores o puertos;
- instalación/upgrade de plugins, MCPs, providers o binarios;
- ejecución de tests que requieran servicios reales o datos no efímeros;
- comandos de `commit`, `push`, merge, deploy o cambios de estado operativo;
- acceso de browser, shell persistente, PTY o red fuera de allowlist.

### Prohibido por defecto

- exponer secretos o volcarlos en logs/Engram;
- comandos destructivos de DB (`down -v`, reset, drop, producción);
- mutaciones de Linear durante diagnóstico;
- `git push --force`, cambios directos en `main`/`staging` y commits automáticos;
- importar memorias completas sin curación;
- permitir que un plugin de terceros tenga shell/red persistente sin revisión.

## Matriz operativa previa a la primera sesión de Hospeda

| Superficie | Automático | Autorización | Prohibido por defecto |
|---|---|---|---|
| lectura del repo | sí, salvo rutas sensibles | — | secretos, claves y credenciales |
| edición de código/docs | sí en worktree dedicado | — | checkout principal o worktree ajeno |
| shell local | diagnósticos y comandos deterministas | procesos persistentes, Docker, DB, puertos | `drop`, `reset --hard`, `down -v`, producción |
| Git | status, diff, log, ramas de diagnóstico | branch/worktree, commit, merge, push | force-push y cambios directos en protegidas |
| Linear/GitHub/Sentry | consultas read-only explícitas | crear/actualizar/cerrar, comentarios, PR | mutar durante diagnóstico |
| Engram | lectura sobre copia temporal | saneamiento/importación curada | DB original, import masivo, delete masivo |
| plugins/MCP | cargar componentes aprobados | instalar, actualizar, cambiar permisos | terceros con shell/red sin revisión |
| modelos/gateways | OpenAI para tareas críticas | activar GLM/DeepSeek/OpenKilo | fallback silencioso con datos sensibles |

Esta matriz debe implementarse más adelante en la configuración y en `hops`,
pero durante esta etapa sólo queda como especificación revisable.

## Pre-commit recomendado

El pre-commit debería seguir siendo rápido y local. La propuesta es conservar
lint-staged y los guards puramente estáticos, sumar un detector de secretos con
falsos positivos controlables y ejecutar sólo el conjunto de guards relacionado
con las rutas staged. Los checks costosos (suite completa, Semgrep, auditoría de
dependencias, build, migraciones de prueba) deben quedar en CI o en `hops
verify` explícito.

No conviene meter en pre-commit llamadas a Linear/GitHub, arranque de DB,
regeneración de índices, Engram ni plugins de OpenCode. Eso haría el commit
lento y agregaría fallos de red no deterministas.

## Relación con OpenCode/Gentle

OpenCode debe recibir una política de permisos conservadora para shell, red y
filesystem. Gentle-AI aporta permisos generales y perfiles, pero los invariantes
de Hospeda deben permanecer en scripts versionados y CI. Un plugin de seguridad
puede complementar la confirmación de comandos, pero no reemplaza guards de
dominio ni debe convertirse en una segunda fuente de reglas.

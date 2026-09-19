# Política operativa de seguridad v1

Esta política combina permisos de OpenCode/Gentle con guards versionados de Hospeda. El agente debe poder trabajar rápido dentro de un worktree, pero las operaciones con efectos externos permanecen explícitas.

## Permitido automáticamente

- leer código, documentación, historial y estado Git;
- editar archivos dentro del worktree asignado;
- ejecutar formatter, lint y guards estáticos staged;
- ejecutar tests rápidos y `hops verify --changed` cuando no requieren servicios persistentes;
- leer Linear/GitHub/Sentry sólo cuando el comando sea explícitamente read-only;
- generar planes, reportes y artifacts locales.

## Requiere autorización explícita

- crear/eliminar worktrees, ramas, DBs, contenedores, puertos o procesos persistentes;
- instalar o actualizar OpenCode, Gentle, Engram, plugins, MCPs o providers;
- escribir en Linear, GitHub, Sentry, Engram o cualquier servicio externo;
- commit, push, merge, PR, deploy, cambio de estado o promoción;
- migraciones, seeds, reset de DB, pruebas contra servicios reales;
- browser, PTY, red fuera de la allowlist y modelos alternativos con datos sensibles.

## Prohibido por defecto

- leer o imprimir valores de secretos, `.env`, claves, cookies o tokens;
- tocar otro worktree o el checkout principal cuando la tarea exige worktree;
- `push --force`, `reset --hard`, drop/reset destructivo, `docker down -v` o producción;
- importación/borrado masivo de Engram;
- commits o merges automáticos desde agentes;
- plugins con shell/red persistente sin revisión de supply chain.

## Pre-commit por capas

1. **Siempre local y rápido:** secretos en diff, archivos sensibles, formato/lint, JSON/YAML, `ilike`, cambios en ramas protegidas.
2. **Condicional por rutas:** env registry, schemas, i18n, Cloudinary, seed, billing y guards de dominio afectados.
3. **Fuera del hook:** build completo, E2E, browser, Semgrep/CodeQL, auditoría de dependencias, DB, Docker, Linear, GitHub y Engram.

Cada guard debe devolver una explicación corta, un comando de reparación y un detalle opcional en archivo temporal. Debe tener prueba de aceptación y rechazo; ningún guard puede autoeditar lógica ni crear commits.

## Precedencia

La política más restrictiva gana: prohibido > autorización > permitido. Las reglas de proyecto no pueden ampliar una prohibición global. Los comandos `hops/qz` deben declarar si son read-only y rechazar flags de aplicación no soportados.

La implementación queda pendiente de probarla en OpenCode V1 con filesystem escribible y de revisar falsos positivos antes de activarla como política por defecto.

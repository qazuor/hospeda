# Paquete pendiente para `staging`

El checkout operativo `hospeda-staging` se actualiza desde `origin/staging`.
Los cambios que habilitan la reconciliación automática todavía viven en la rama
de migración y por eso `hops update` los detecta, pero no puede ejecutarlos en
el checkout operativo.

## Cambios que deben llegar juntos

- `scripts/reconcile-local-env.sh`: reconciliación segura contra los templates.
- `scripts/copy-env-to-worktree.sh`: fuente predeterminada `hospeda-staging` y
  modo incremental que no sobrescribe valores existentes.
- `scripts/worktree/wt-create.sh` y `scripts/worktree/wt-up.sh`: integración de
  envs, bootstrap de client-tools y preparación del worktree.
- `scripts/client-tools/src/commands/update/update.ts` y
  `scripts/client-tools/src/lib/runner.ts`: `--dry-run --json` y captura segura
  para el modo JSON.

## Evidencia

- La rama de migración tiene estos cambios en commits separados; el diff
  operativo contra `staging` es de seis archivos y 681 líneas netas.
- La prueba E2E real de `hops update --json` funcionó sobre `hospeda-staging`
  para fetch, reset e instalación de wrappers.
- La reconciliación no se ejecutó porque `origin/staging` aún no contiene el
  script.
- No se debe copiar manualmente el script al checkout operativo: debe llegar por
  el flujo normal de integración/versionado para que todos los clones reciban la
  misma versión.

## Criterio de cierre

Después de integrar el paquete, ejecutar `hops update --json` y comprobar que
incluya el paso `env-reconcile`, luego verificar `hops env --drift --wt
hospeda-staging --json`. No borrar claves obsoletas a mano antes de esa prueba.

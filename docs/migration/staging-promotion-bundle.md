# Paquete pendiente para `staging`

El checkout operativo `hospeda-staging` se actualiza desde `origin/staging`.
Los cambios que habilitan la reconciliación automática todavía viven en la rama
de migración y por eso `hops update` los detecta, pero no puede ejecutarlos en
el checkout operativo.

## Cambios operativos que deben llegar juntos

- `scripts/reconcile-local-env.sh`: reconciliación segura contra los templates.
- `scripts/copy-env-to-worktree.sh`: fuente predeterminada `hospeda-staging` y
  modo incremental que no sobrescribe valores existentes.
- `scripts/worktree/wt-create.sh` y `scripts/worktree/wt-up.sh`: integración de
  envs, bootstrap de client-tools y preparación del worktree.
- `scripts/client-tools/src/commands/update/update.ts` y
  `scripts/client-tools/src/lib/runner.ts`: `--dry-run --json` y captura segura
  para el modo JSON.
- `scripts/worktree/template.sh`, `scripts/worktree/wt-config.sh` y los
  helpers de DB/servers: lifecycle de template con candidata aislada,
  fingerprint, manifest y rollback.
- `scripts/client-tools/src/commands/db/update-template.ts`: interfaz Hops
  para `status`, `build-candidate` y `promote --confirm`.

Los documentos de migración, el bootstrap genérico y el artifact deben viajar
en una promoción separada o en el mismo PR sólo si la revisión acepta el
paquete completo. No se deben mezclar automáticamente todos los commits de la
rama: el diff actual contiene aproximadamente 110 archivos y combina código
operativo, guards, comandos nuevos y documentación histórica.

## Evidencia

- La rama de migración tiene cambios en commits separados; el diff completo
  contra `staging` incluye aproximadamente 110 archivos y 9.500 líneas. El
  paquete mínimo de env/worktree/template debe seleccionarse por archivos o
  commits revisados, no mediante un merge ciego de toda la rama.
- La prueba E2E real de `hops update --json` funcionó sobre `hospeda-staging`
  para fetch, reset e instalación de wrappers.
- La reconciliación no se ejecutó porque `origin/staging` aún no contiene el
  script.
- No se debe copiar manualmente el script al checkout operativo: debe llegar por
  el flujo normal de integración/versionado para que todos los clones reciban la
  misma versión.

## Criterio de cierre

Después de integrar el paquete mínimo, ejecutar `hops update --json` y
comprobar que incluya el paso `env-reconcile`; luego verificar
`hops env --drift --wt hospeda-staging --json`, `hops db-update-template
status` y el E2E de worktree/servers. No borrar claves obsoletas a mano antes
de esas pruebas.

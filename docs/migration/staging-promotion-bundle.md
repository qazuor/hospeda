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
  fingerprint, manifest y rollback. `wt-config.sh` debe calcular el
  fingerprint con la configuración de la rama base; de lo contrario un
  checkout nuevo puede bloquear un template correcto por usar reglas futuras
  del checkout que ejecuta el comando.
- `scripts/worktree/wt-up.sh`: aceptar `HOPS_ENV_COPY_SCRIPT` para validar el
  reconciliador nuevo mientras el checkout operativo todavía contiene el
  script anterior.
- `scripts/client-tools/src/commands/db/update-template.ts`: interfaz Hops
  para `status`, `build-candidate` y `promote --confirm`.

Los documentos de migración, el bootstrap genérico y el artifact deben viajar
en una promoción separada o en el mismo PR sólo si la revisión acepta el
paquete completo. No se deben mezclar automáticamente todos los commits de la
rama: el diff actual contiene aproximadamente 110 archivos y combina código
operativo, guards, comandos nuevos y documentación histórica.

## Evidencia

- La rama de migración tiene cambios en commits separados; el diff completo
  contra `staging` incluye aproximadamente 114 archivos y 9.500 líneas. El
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

## Mapa de commits de referencia

La rama no debe integrarse con un merge ciego, pero este mapa permite revisar
la procedencia de cada bloque antes de armar el PR:

| Bloque | Commits principales |
| --- | --- |
| Template, fingerprint y rollback | `c2b103ad5`, `a14e85543`, `4c065590c`, `646428b21` |
| Creación/up de worktrees y client-tools | `5d848e885`, `877d40459`, `40891fd85`, `050bc3aa5`, `8405cca2d` |
| Env source-of-truth y drift | `a6fc2d679`, `eab8ca192`, `40952bc25`, `3de124b66` |
| Update read-only/JSON | `6ab36b219`, `31d3cabff`, `6a097af17`, `fd06bcf40` |
| Verify/CI y guards | `915507bb4`, `9da0f329b`, `19a8f6f2c`, `5578315d6` |

Los commits de documentación y artifact que acompañan estos cambios deben
revisarse por separado. El PR operativo debe seleccionar archivos, conservar
sus tests y no arrastrar automáticamente todo el historial de migración.

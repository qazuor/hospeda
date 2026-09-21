# Servidor de artifacts 24/7

## Qué requiere reinicio

Hay dos tipos de cambios distintos:

- **Contenido**: publicar una nueva versión o artifact. No requiere reinicio.
  El visor consulta metadata y se actualiza solo; la galería también refresca.
- **Motor**: cambiar `server.mjs`, CSS, renderer, validación, API o reglas de
  seguridad. El proceso Node ya iniciado conserva el código anterior y requiere
  un restart controlado.

En operación normal se publicarán bundles, por lo que el primer caso será el
habitual. Los reinicios sólo ocurren al actualizar el software del servidor.

## Arquitectura recomendada

- Ejecutar el servidor desde un checkout estable y versionado, separado de los
  worktrees de Hospeda.
- Mantener la DB en `~/.local/share/opencode-artifacts`, fuera del checkout.
- Usar un servicio de usuario `systemd` con `Restart=on-failure`, logs acotados,
  bind sólo a `127.0.0.1` y un puerto fijo.
- Actualizar el motor mediante una operación explícita: backup de DB, cambio de
  checkout, restart y health-check; rollback al binario anterior si falla.
- Los worktrees y proyectos sólo publican bundles hacia ese servicio; nunca
  levantan una instancia propia ni compiten por el puerto.

## Actualización sin interrupción perceptible

Para cambios de contenido, `publish-bundle.mjs` escribe una nueva versión y el
visor la detecta por polling. Para cambios del motor, un restart breve es
aceptable; el cliente conserva la URL y vuelve a cargar cuando el health-check
responde. Más adelante puede usarse socket activation o un supervisor con
reemplazo gradual, pero no hace falta para el MVP local.

## Regla operativa

No ejecutar el servidor desde un worktree efímero. La instalación futura debe
registrar una única instancia estable, su ruta, puerto, servicio, health-check,
backup y procedimiento de rollback. Los cambios del renderer se agrupan y se
actualizan juntos, en lugar de reiniciar por cada artifact publicado.

## Unidad de usuario propuesta (no instalada)

La instalación reproducible deberá generar una unidad como ésta usando rutas
absolutas del checkout estable detectado:

```ini
[Unit]
Description=Hospeda local artifact viewer
After=network.target

[Service]
Type=simple
WorkingDirectory=%h/projects/tools/artifact-app
ExecStart=/usr/bin/node %h/projects/tools/artifact-app/server.mjs
Environment=ARTIFACT_PORT=4317
Environment=ARTIFACT_DATA_DIR=%h/.local/share/opencode-artifacts
Restart=on-failure
RestartSec=2

[Install]
WantedBy=default.target
```

El bootstrap futuro debe instalarla sólo en modo `--apply`, ejecutar primero
`--plan`, comprobar que el puerto esté libre y hacer un health-check HTTP. El
servicio no debe apuntar a un worktree de Hospeda ni copiar DB al checkout.

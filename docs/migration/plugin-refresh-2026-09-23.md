# Actualización de candidatos OpenCode — 2026-09-23

Auditoría documental read-only de los tres candidatos que el plan dejó para
revisión posterior. No se instaló ningún plugin ni se modificó la configuración
global.

## OpenKilo

El proyecto se presenta como un gateway/plugin que ofrece modelos gratuitos y
de pago mediante Kilo Gateway/OpenRouter, con autenticación anónima para los
tiers gratuitos y OAuth para los premium. La descripción pública también indica
que abstrae la autenticación de proveedores.

**Decisión:** no activar todavía. Puede servir para tareas de bajo riesgo, pero
introduce un gateway adicional, una superficie de supply chain y una política de
datos distinta de OpenAI. Debe probarse en un perfil aislado, sin Linear,
Engram, repositorios privados ni secretos, y sólo después de comparar calidad,
latencia y límites contra modelos explícitamente configurados.

Fuente: <https://github.com/AnganSamadder> (sección OpenKilo, consultada
2026-09-23). El repositorio específico y su release reproducible no quedaron
verificados en esta consulta; tratar la disponibilidad como **no verificada**.

## OpenChamber

OpenChamber es una aplicación/workspace externo (desktop, web/PWA, VS Code y
móvil) que usa OpenCode como backend. Ofrece sesiones persistentes, goals,
multi-run, worktrees opcionales, preview, GitHub y acceso remoto. Su release
visible más reciente es `v1.24.2` (2026-09-18); también aparece una línea V2
preview.

**Decisión:** interesante para probar como interfaz separada, no como plugin del
stack base. La aplicación puede traer su propio CLI de OpenCode y, por tanto,
competir con nuestra instalación V1/Gentle y con la TUI. No debe instalarse en
la misma etapa que cambios de runtime; primero habría que probarla apuntando a
un proyecto descartable y confirmar compatibilidad con V1, Engram, permisos y
worktrees de Hospeda.

Fuentes: <https://github.com/openchamber/openchamber>,
<https://github.com/openchamber/openchamber/releases> (consultadas
2026-09-23).

## opencode-pty

Es un plugin real de OpenCode para mantener procesos interactivos en PTY:
`pty_spawn`, `pty_read`, `pty_write` y `pty_kill`, con buffers, filtros por regex
y notificación al terminar. La release visible `v0.3.6` actualiza `bun-pty` y
declara conformidad con `PluginModule`.

**Decisión:** candidato **interesante / probar** para servidores persistentes,
logs y procesos que hoy requieren polling. Tiene dos límites relevantes para
Hospeda: respeta los permisos `bash`, pero un permiso `ask` se interpreta como
deny porque el plugin no puede abrir el prompt de autorización; además permite
directorios externos cuando `external_directory` está en `ask`. Antes de usarlo
hay que definir allowlists explícitas para `pnpm`, `bun`, Docker y los wrappers
`qz/hops`, con deny explícito para Git destructivo y producción.

Fuentes: <https://github.com/shekohex/opencode-pty> y release
<https://github.com/shekohex/opencode-pty/releases/tag/v0.3.6> (consultadas
2026-09-23). El issue de bloqueo de archivos observado es específico de
Windows, pero justifica probar una sola instancia en Linux antes de adoptarlo.

## smart-voice-notify

Es un plugin de notificaciones de voz para eventos idle, permission, error y
question. Soporta varios motores TTS y webhooks opcionales, incluido Discord.

**Decisión:** no instalar en el núcleo. Puede aportar ergonomía, pero añade
audio, red y potenciales credenciales de TTS/webhook sin resolver una necesidad
de workflow. Si se quiere probar, hacerlo como perfil opt-in, con webhooks
desactivados por defecto y sin datos de prompts en notificaciones.

Fuente: <https://github.com/MasuRii/opencode-smart-voice-notify> (consultada
2026-09-23).

## Resultado para la matriz

| Candidato | Clasificación | Acción | Motivo principal |
|---|---|---|---|
| OpenKilo | Interesante / probar | Perfil aislado | Modelos gratuitos potenciales, pero gateway y supply chain adicionales |
| OpenChamber | Interesante / probar | App separada | Workspace completo, no plugin; puede traer/competir con OpenCode |
| opencode-pty | Interesante / probar | Validar con allowlist | Útil para procesos persistentes; cambia la semántica de permisos `ask` |
| smart-voice-notify | No recomendado para el núcleo | Opt-in posterior | Ergonomía, pero agrega red/TTS y no es necesario para operar Hospeda |

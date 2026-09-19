# OpenCode — Gate 4 de proveedores y modelos

Fecha: 2026-09-15

## Estado

OpenCode 2.0.3 está instalado y `opencode auth list` devuelve `No authenticated
integrations`. `opencode auth login` sin target muestra `No authentication
integrations are available`; no es un fallo de la cuenta, sino que ese flujo
no descubre providers por sí solo.

La documentación oficial actual indica usar `/connect` dentro de la TUI para
seleccionar OpenAI y elegir ChatGPT Plus/Pro OAuth o API key. Después se usa
`/models` para seleccionar el modelo. Fuente: [Providers — OpenCode](https://opencode.ai/docs/providers).

El baseline posterior a la reinstalación no tiene `auth.json` ni `account.json`
en el directorio de datos de OpenCode y no se configuró ningún proveedor. La
política propuesta está en `model-routing-assessment.md`: OpenAI para trabajo
complejo, GLM/DeepSeek sólo para tareas acotadas y OpenKilo como experimento
separado.

Ejecutando fuera del sandbox read-only, `opencode models --help` y
`opencode auth --help` funcionaron. `opencode models` devolvió el catálogo
disponible, incluyendo proveedores `github-copilot`, `ollama` y `opencode`.
`opencode mcp list` y `opencode plugin list` siguen informando cero activos.
No se inició login ni se mostraron credenciales. El estado concreto de cuentas
guardadas: `auth list` sólo mostró una entrada de GitHub, sin exponer identidad
ni credenciales. No se asumirá que esa entrada habilita modelos hasta probar una
solicitud explícita y autorizada.

Un filtro del catálogo no encontró modelos bajo los nombres `openai/*` o
`gpt/*`; los modelos GPT observados están publicados bajo `github-copilot/*`.
Esto confirma que todavía no hay un provider OpenAI directo configurado en el
runtime limpio.

## Decisión pendiente

En una etapa autorizada habrá que elegir un único perfil inicial de OpenAI,
configurarlo sin guardar secretos en Git y probar una tarea no mutante. Después
se podrá evaluar GLM/DeepSeek con datos no sensibles. Los fallbacks no deben
cambiar silenciosamente durante SDD, Linear, Engram, commits o infraestructura.

La imposibilidad actual de escribir logs debe resolverse primero de forma
controlada (por ejemplo, ejecutando en un entorno OpenCode con log escribible),
sin alterar la configuración productiva por accidente.

## Revalidación posterior — 2026-09-19

El runtime operativo cambió deliberadamente a OpenCode V1.18.31 por
compatibilidad con Gentle-AI 2.9.0. El estado actual sí tiene OpenAI OAuth y
GitHub Copilot detectados por `opencode providers list`; esta observación
reemplaza el baseline histórico de V2 sin auth. GLM, DeepSeek y OpenKilo siguen
sin activarse.

La CLI ofrece `opencode auth login [target] [--method]`; consultar la ayuda no
inició ningún flujo. La futura configuración debe usar el método oficial del
provider, verificar el catálogo después y registrar sólo provider/modelo,
nunca el token. El primer login debe probarse con una tarea read-only y sin
fallbacks automáticos.

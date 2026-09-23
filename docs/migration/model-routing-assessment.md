# Providers y routing de modelos

## Estado actual observado antes y después de la limpieza

El relevamiento pre-limpieza encontró entradas de autenticación local para
`openai`, `github-copilot`, `anthropic`, `opencode-go` y `opencode`. Sólo se
registraron nombres y formas de las entradas; nunca se leyeron valores.
Esas entradas fueron eliminadas junto con el estado OpenCode anterior.

Después de la reinstalación limpia no existe `~/.local/share/opencode/auth.json`
ni `account.json`, y no hay providers autenticados. Esto es el baseline correcto
para decidir el routing.

El `opencode.json` limpio no fija todavía un catálogo de modelos ni un provider por
agente. Gentle-AI conserva asignaciones abstractas (`opus`, `sonnet`, `haiku`)
para sus agentes SDD/review; esas etiquetas no deben interpretarse como una
decisión final de proveedor. El plugin de variantes descubre modelos y guarda
un cache global, lo que puede cambiar con cada actualización.

No se encontraron entradas configuradas para GLM ni DeepSeek. OpenKilo/Kilo
debe tratarse como gateway externo separado, no como modelo gratuito confiable
por defecto.

### Revalidación del runtime operativo — 2026-09-19

OpenCode V1.18.31 detecta una credencial OAuth de OpenAI y una variable de
entorno de GitHub Copilot. Context7 y Engram están conectados por MCP. No se
activaron GLM, DeepSeek, Ollama ni OpenKilo, y no se imprimieron credenciales.

## Routing recomendado

| Clase de tarea | Provider principal | Fallback | Motivo |
|---|---|---|---|
| arquitectura, billing, seguridad, migraciones, revisión final | OpenAI por suscripción | OpenAI modelo de mayor razonamiento disponible | sensibilidad y costo de error |
| implementación normal con contexto amplio | OpenAI | GLM/DeepSeek configurado explícitamente | calidad estable y trazabilidad |
| resumen, clasificación, formato, navegación simple | GLM o DeepSeek | OpenAI económico | menor costo y riesgo acotado |
| exploración de código grande | OpenAI con CodeGraph/contexto selectivo | GLM/DeepSeek sólo para consultas simples | evitar respuestas superficiales |
| SDD verify/archive | OpenAI | ningún fallback automático | requiere evidencia y consistencia |
| tareas experimentales/no sensibles | OpenKilo/Kilo pilot | GLM/DeepSeek | gateway externo, disponibilidad variable |

## Reglas de seguridad

- Nunca enviar a gateways gratuitos o experimentales secretos, `.env`, datos de
  clientes, dumps de DB, tokens, código de producción sensible ni prompts con
  credenciales.
- El routing debe ser explícito por agente/command o perfil, no cambiar de
  provider silenciosamente a mitad de una operación crítica.
- Un fallback puede continuar una consulta read-only; no debe autorizar commits,
  Linear, Engram ni cambios de infraestructura.
- Registrar provider/modelo y costo aproximado en reportes, pero nunca tokens de
  autenticación ni contenido sensible.

## Decisión de implementación futura

Primero se debe fijar un perfil OpenAI funcional para tareas complejas y medir
calidad/costo durante una semana de uso real. Luego se prueban GLM y DeepSeek en
tareas acotadas. OpenKilo se habilita sólo como perfil experimental para tareas
no sensibles y con límites de contexto/red. No conviene instalar tres gateways
al mismo tiempo ni dejar que Gentle reasigne silenciosamente sus aliases
`opus`/`sonnet`/`haiku`.

### Revalidación de selección de modelos — 2026-09-23

OpenCode V1 mantiene un `opencode.json` sin provider/model explícito. La
consulta previa en terminal writable identificó OpenAI OAuth y GitHub Copilot
como integraciones disponibles, sin exponer credenciales. El cache de
`~/.gentle-ai/cache/model-variants.json` contiene catálogos de muchos
proveedores, incluidos GLM y DeepSeek, pero ese cache es descubrimiento de
variantes y no prueba autenticación, disponibilidad ni autorización para
usarlos.

La configuración efectiva no tiene fallback automático declarado. Se mantiene
la recomendación: OpenAI por suscripción para tareas críticas; GLM/DeepSeek sólo
como perfiles explícitos después de benchmark; OpenKilo/Kilo separado y sólo
para tareas no sensibles. No se activó ningún provider adicional.

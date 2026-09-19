# Gate de routing de modelos

## Estado verificable — checkpoint 2026-09-19

- OpenCode operativo: **1.18.31**.
- `opencode providers list` muestra una credencial OAuth de OpenAI y la
  variable de entorno de GitHub Copilot; no se imprimieron credenciales ni
  identidades.
- No se activó GLM, DeepSeek, Ollama ni OpenKilo.
- Context7 y Engram MCP están conectados.
- Gentle mantiene aliases abstractos (`opus`, `sonnet`, `haiku`), que no deben
  mapearse automáticamente a un proveedor alternativo.

## Política provisional

| Riesgo | Modelo/proveedor |
|---|---|
| Arquitectura, seguridad, billing, migraciones, SDD verify/archive | OpenAI por suscripción, sin fallback silencioso |
| Implementación normal | OpenAI; fallback explícito sólo después de medir |
| Resúmenes y clasificación sin datos sensibles | candidato GLM/DeepSeek |
| Experimentos no sensibles | OpenKilo/Kilo sólo en perfil aislado |

## Gate antes de activar alternativas

1. Resolver filesystem de OpenCode y obtener una lista verificable de modelos.
2. Definir perfiles explícitos por tarea, no fallback implícito.
3. Probar una muestra equivalente de tareas simples y medir calidad, latencia, costo y contexto.
4. Confirmar que no se envían secretos, `.env`, dumps ni código sensible a gateways externos.
5. Registrar proveedor/modelo en el reporte sin registrar credenciales ni prompts sensibles.

No se instalaron proveedores ni se modificó auth.

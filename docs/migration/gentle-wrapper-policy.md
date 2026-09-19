# Política de wrappers para Gentle-AI

La CLI de Gentle-AI 2.9.0 tiene comandos de consulta, operaciones de configuración y superficies de revisión/SDD. Hospeda no debe envolverlos todos: el wrapper sólo agrega descubribilidad, contexto del proyecto y protección de mutaciones.

## Exponer como wrapper de lectura

| Wrapper futuro | Comando subyacente | Motivo |
|---|---|---|
| `hops gentle-status` | `gentle-ai version`, `gentle-ai doctor`, `gentle-ai review status` | Estado local y diagnóstico sin cambiar archivos |
| `hops gentle-sdd-status` | `gentle-ai sdd-status [change]` | Ver fase SDD desde Hospeda |
| `hops gentle-sdd-continue` | `gentle-ai sdd-continue [change]` | Mostrar routing recomendado sin ejecutarlo |
| `hops gentle-review-status` | `gentle-ai review status` | Inventario de autoridad RDD/review |
| `hops gentle-telemetry-preview` | `gentle-ai telemetry preview --json` | Ver payload sin enviarlo |

Estos wrappers deben devolver salida humana y `--json` estable para agentes.

## Exponer sólo con confirmación explícita

- `gentle-ai review mode enable|disable`: cambia política local.
- `gentle-ai sdd-attempt acquire|settle` y superficies `begin|finish|reset|repair`: modifican el ledger de ejecución.
- `gentle-ai review capture-*`: admite evidencia en la autoridad de review.
- `gentle-ai restore`: restaura configuración.
- `gentle-ai telemetry enable|disable|trigger`: cambia o envía telemetría.

El wrapper debe rechazar flags peligrosos no previstos, exigir `--confirm` y mostrar exactamente qué comando ejecutaría. No debe agregar `--apply`, `--all` o equivalentes por su cuenta.

## No envolver por ahora

- `install`, `uninstall`, `sync`, `upgrade`: son operaciones de lifecycle global y deben ejecutarse directamente con una política de instalación/backup.
- `review start`, `capture-result`, `capture-correction-plan`, `capture-refuter`, `capture-validation`: requieren un flujo RDD explícito y están desactivados actualmente.
- `sdd-attempt` como orquestador automático: primero debe aprobarse la estrategia `.specs` vs SDD híbrido.

## Contrato común

1. Detectar el checkout y el proyecto actual.
2. Mostrar si la operación es read-only o mutante.
3. En modo humano, usar tablas y mensajes breves.
4. En `--json`, no incluir secretos ni dumps de configuración.
5. Registrar la versión de Gentle-AI y el exit code.
6. No escribir Engram ni memorias automáticamente.

## Estado

Esto es una política y una matriz de decisión. No instala Gentle-AI, no cambia su configuración y no crea wrappers todavía.

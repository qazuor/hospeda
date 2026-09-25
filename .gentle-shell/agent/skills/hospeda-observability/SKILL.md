---
name: hospeda-observability
description: Reglas para logging estructurado, errores, métricas y diagnósticos de Hospeda.
triggers:
  - logging
  - observabilidad
  - packages/logger
  - errores en producción
  - métricas
---

# Hospeda Observability

Usá este skill cuando cambies logging, errores, métricas, diagnósticos o
telemetría operativa.

## Reglas

- Usá loggers estructurados y scopes existentes.
- Elegí nivel y formato según entorno; producción debe ser parseable.
- Nunca registres tokens, cookies, passwords, headers sensibles ni payloads
  completos de usuarios.
- Conservá correlación request/actor sin identificar de más.
- Los errores deben mantener código, causa y contexto útil.
- No agregues telemetría externa sin decisión explícita y documentación.

## Verificación

- Probá formato pretty y JSON cuando corresponda.
- Verificá redacción de campos sensibles.
- Confirmá que los errores llegan al logger correcto sin duplicación excesiva.

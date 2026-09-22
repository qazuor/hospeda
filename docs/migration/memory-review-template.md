# Ficha de revisión individual de memoria

Usar una ficha por cada entrada candidata. No completar con secretos ni copiar
contenido sensible al repositorio.

```text
Origen:
Proyecto:
ID/fecha/topic:
Título sanitizado:

Clasificación: vigente | vigente-con-ajuste | histórica | contradicha |
duplicada | ruidosa | secreta

Qué afirma (resumen breve):
Evidencia actual consultada:
Fecha de verificación:
Conflictos encontrados:
Destino: AGENTS | skill | documentación | Engram | Linear/.specs | descartar
Transformación necesaria:
Revisión humana requerida: sí/no
Decisión:
Motivo:
```

La ficha es un registro de decisión, no un volcado de la memoria original.

## Orden de revisión sugerido

Priorizar `gotcha` e `issue` que todavía puedan afectar seguridad o workflow;
después revisar decisiones de specs/proyectos; dejar feedback repetitivo,
retirado o ya codificado en guards para el final. El orden sólo reduce riesgo y
no implica admisión automática.

Las entradas señaladas por el filtro de nombres sensible deben revisarse fuera
del repositorio y con valores redactados. Si aparece un secreto real, se
clasifica como `secreta`, se excluye de la migración y se evalúa rotación por un
canal operativo separado.

---
title: Matriz de validación de Mercado Pago (FASE 1C)
linear: HOS-1352
statusSource: linear
created: 2026-09-15
status: CURRENT
phase: 1C
---

# Matriz de validación de Mercado Pago

Esqueleto de **FASE 1C**. Hoy **todas las filas están en `UNKNOWN`**: nada fue verificado
en el marco de este programa.

## Reglas

1. **Nada acá se completa desde documentación, memoria, código existente ni "parece que lo
   soporta"** (PDR §58). Una fila se llena **sólo** con un experimento ejecutado.
2. **No se implementa una capability crítica mientras su fila diga `UNKNOWN`** (PDR §61).
3. Cada fila lleva **fecha y entorno**. Una fila sin fecha se lee como `UNKNOWN`
   (`S-METH-02`): MP cambia y un `VERIFIED` viejo no es un `VERIFIED`.
4. Las sondas van **versionadas** en `docs/mp-probes/`, marcadas como no-productivas y
   excluidas de todo build (`S-METH-01`). Un experimento que vive sólo en el log no es
   reproducible y la matriz envejece sin que nadie lo note.
5. Un resultado `PARTIALLY_SUPPORTED` **tiene que decir qué parte**. "Casi" no es un
   resultado.

## Estados

| Estado | Significa |
|---|---|
| `VERIFIED` | Se ejecutó y funciona como necesitamos. Con evidencia. |
| `NOT_SUPPORTED` | Se ejecutó y MP no lo permite. Con evidencia. |
| `PARTIALLY_SUPPORTED` | Funciona con una restricción **nombrada**. |
| `UNKNOWN` | No se probó, o se probó hace demasiado. |

## Procedimiento por fila (PDR §59)

Leer la documentación oficial actual → revisar limitaciones → preparar la prueba →
ejecutar contra la API → happy path → error paths → estados ambiguos → retries →
registrar request → registrar response → observar el webhook → documentar la conclusión.

---

## Matriz

Columnas: **Estado** · **Fecha** · **Entorno** · **Evidencia** (ruta de la sonda + request,
response y webhook observado) · **Conclusión**.

### Preapproval

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| P-1 | Creación por API | `UNKNOWN` | — | — | — | — |
| P-2 | Linking con nuestro dominio desde el inicio | `UNKNOWN` | — | — | — | — |
| P-3 | Autorización por el usuario | `UNKNOWN` | — | — | — | — |
| P-4 | Rechazo | `UNKNOWN` | — | — | — | — |
| P-5 | Cancelación | `UNKNOWN` | — | — | — | — |
| P-6 | Abandono: qué pasa con un preapproval nunca autorizado | `UNKNOWN` | — | — | — | — |

> P-6 no está en la matriz mínima del PDR §60 pero se agrega: es el estado
> `PENDING_AUTHORIZATION` de `M-SUB-01`, y en el modelo elegido existe siempre.

### Frecuencias de facturación

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| F-1 | Mensual | `UNKNOWN` | — | — | — | — |
| F-2 | Trimestral | `UNKNOWN` | — | — | — | — |
| F-3 | Semestral | `UNKNOWN` | — | — | — | — |
| F-4 | Anual | `UNKNOWN` | — | — | — | — |
| F-5 | Cambio de frecuencia sobre un preapproval ya autorizado | `UNKNOWN` | — | — | — | — |

### Renovaciones

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| R-1 | Cobro exitoso | `UNKNOWN` | — | — | — | — |
| R-2 | Cobro fallido | `UNKNOWN` | — | — | — | — |
| R-3 | Recuperación tras el fallo | `UNKNOWN` | — | — | — | — |

### Grace

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| G-1 | Recuperación durante el grace | `UNKNOWN` | — | — | — | — |
| G-2 | Pago tardío (después de suspender) | `UNKNOWN` | — | — | — | — |
| G-3 | Política de reintentos de MP | `UNKNOWN` | — | — | — | — |

### Pausa — `BD-MP-01`

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| PA-1 | Pausar | `UNKNOWN` | — | — | — | — |
| PA-2 | Que no cobre mientras está pausada | `UNKNOWN` | — | — | — | — |
| PA-3 | Reanudación anticipada por el usuario | `UNKNOWN` | — | — | — | — |
| PA-4 | Reanudación automática al llegar la fecha | `UNKNOWN` | — | — | — | — |
| PA-5 | Qué pasa con las fechas al reanudar | `UNKNOWN` | — | — | — | — |
| PA-6 | Qué pasa con la fecha de cobro al reanudar | `UNKNOWN` | — | — | — | — |
| PA-7 | ¿Se preservan los días ya pagados? (§26.4) | `UNKNOWN` | — | — | — | — |

### Cancelación

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| CA-1 | Cancelación programada a fin de período | `UNKNOWN` | — | — | — | — |
| CA-2 | Comportamiento inmediato del provider | `UNKNOWN` | — | — | — | — |

### Cambios de precio — `BD-MP-03`

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| PR-1 | Sobre una subscription existente | `UNKNOWN` | — | — | — | — |
| PR-2 | Limitaciones (pisos, topes, magnitud del cambio) | `UNKNOWN` | — | — | — | — |
| PR-3 | ¿Requiere nuevo consentimiento del usuario? | `UNKNOWN` | — | — | — | — |

> PR-3 es la que define si Hospeda puede actualizar precios sin perder la base instalada.

### Upgrade

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| UP-1 | Aplicación inmediata | `UNKNOWN` | — | — | — | — |
| UP-2 | Efecto económico (prorrateo, cobro inmediato, nada) | `UNKNOWN` | — | — | — | — |

### Downgrade

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| DN-1 | Aplicación al ciclo siguiente | `UNKNOWN` | — | — | — | — |
| DN-2 | ¿Lo soporta el provider, o hay que emularlo? | `UNKNOWN` | — | — | — | — |

### Cortesía temporal — `BD-MP-02`

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| CO-1 | N meses gratis sobre una subscription viva | `UNKNOWN` | — | — | — | — |
| CO-2 | Estrategias posibles (bajar monto / pausar / recrear / reembolsar) | `UNKNOWN` | — | — | — | — |
| CO-3 | Efectos colaterales de cada estrategia | `UNKNOWN` | — | — | — | — |

### Grant permanente

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| GR-1 | Cancelación correcta de la subscription de MP | `UNKNOWN` | — | — | — | — |

### Webhooks

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| WH-1 | Duplicados | `UNKNOWN` | — | — | — | — |
| WH-2 | Demorados | `UNKNOWN` | — | — | — | — |
| WH-3 | Fuera de orden | `UNKNOWN` | — | — | — | — |
| WH-4 | Reintentos | `UNKNOWN` | — | — | — | — |
| WH-5 | Faltantes (evento que nunca llega) | `UNKNOWN` | — | — | — | — |
| WH-6 | ¿Hay versionado o timestamp confiable del evento? | `UNKNOWN` | — | — | — | — |

> WH-6 se agrega a la matriz mínima: sin un orden confiable, `M-CONC-02` (no-retroceso de
> estado) no se puede implementar.

### Reconciliación

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| RC-1 | Consultar el estado real de un preapproval | `UNKNOWN` | — | — | — | — |
| RC-2 | Historial de pagos | `UNKNOWN` | — | — | — | — |
| RC-3 | Reparar el estado local desde el del provider | `UNKNOWN` | — | — | — | — |

### Addons recurrentes — `BD-MP-04`

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| AD-1 | ¿Un preapproval puede cubrir más de un ítem? | `UNKNOWN` | — | — | — | — |
| AD-2 | N preapprovals del mismo pagador conviviendo | `UNKNOWN` | — | — | — | — |

### Reembolsos — `DEC-LEGAL-001`

> Agregado el 2026-09-15: la revocación de 10 días con devolución total, que el owner
> incorporó al alcance, necesita poder reembolsar.

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| RF-1 | Reembolso total de un cobro de preapproval | `UNKNOWN` | — | — | — | — |
| RF-2 | Reembolso parcial | `UNKNOWN` | — | — | — | — |
| RF-3 | Plazo máximo para reembolsar un cobro | `UNKNOWN` | — | — | — | — |

### Compensación en días — `DEC-SUB-001`

> Agregado el 2026-09-15: la regla de cambio de plan que eligió el owner compensa los días ya
> pagados corriendo la primera fecha de cobro, en vez de prorratear dinero. Si esto no se
> puede, el plan B declarado es que el cambio de ciclo espere a la renovación.

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| CD-1 | Crear un preapproval con la primera fecha de cobro corrida N días | `UNKNOWN` | — | — | — | — |
| CD-2 | ¿Esa fecha se respeta, o MP la recalcula? | `UNKNOWN` | — | — | — | — |

---

## Resumen

| Estado | Filas |
|---|---|
| `VERIFIED` | 0 |
| `PARTIALLY_SUPPORTED` | 0 |
| `NOT_SUPPORTED` | 0 |
| `UNKNOWN` | **46** |

## Qué espera cada decisión

| Decisión | Filas que la desbloquean |
|---|---|
| `BD-MP-01` mecanismo de pausa | `PA-1`…`PA-7` |
| `BD-MP-02` cortesía sobre suscripción viva | `CO-1`…`CO-3` |
| `BD-MP-03` cambio de precio sobre vigentes | `PR-1`…`PR-3` |
| `BD-MP-04` addons recurrentes (**última bloqueante de FASE 2**) | `AD-1`, `AD-2` |
| `DEC-SUB-001` plan B del cambio de ciclo | `CD-1`, `CD-2`, `F-5` |
| `DEC-LEGAL-001` revocación con devolución | `RF-1`, `RF-3` |
| `M-CONC-02` no-retroceso de estado | `WH-6` |
| `M-SUB-01` estado `PENDING_AUTHORIZATION` | `P-6` |

**Ninguna capability de billing puede implementarse hoy.** Es lo esperable: FASE 1C no
empezó.

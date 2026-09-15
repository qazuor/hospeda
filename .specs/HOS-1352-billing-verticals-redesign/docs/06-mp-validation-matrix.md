---
title: Matriz de validación de Mercado Pago (FASE 1C)
linear: HOS-1352
statusSource: linear
created: 2026-09-15
status: CURRENT
phase: 1C
---

# Matriz de validación de Mercado Pago

Esqueleto de **FASE 1C**. **Las 53 filas están en `UNKNOWN`**: no se ejecutó ningún
experimento.

FASE 1C **no ha empezado** y no puede empezar antes de que el owner responda FASE 1A (§67:
*"NO empezar FASE 1B hasta que yo responda las preguntas de 1A"*; el mismo orden aplica).

## Reglas

1. **Ninguna fila se completa desde documentación, memoria, código existente ni "parece que lo
   soporta"** (§58: *"NO alcanza documentación. NO alcanza código legacy. NO alcanza memoria.
   NO alcanza 'parece soportarlo'."*). Una fila se llena **sólo** con un experimento
   ejecutado.
2. **No se implementa una capability crítica mientras su fila diga `UNKNOWN`** (§61).
3. **Ninguna decisión sobre Mercado Pago se toma mientras su fila diga `UNKNOWN`**
   (regla 3 de [`01-decision-log.md`](./01-decision-log.md)).
4. Cada fila lleva **fecha y entorno**. Una fila sin fecha se lee como `UNKNOWN` (`S-MP-02`):
   un proveedor externo cambia su comportamiento sin avisarnos, y un resultado viejo no es un
   resultado.
5. Las pruebas quedan como **sondas versionadas y ejecutables** en `docs/mp-probes/`, marcadas
   como no productivas y excluidas de todo build (`S-MP-03`). Un experimento que vive sólo en
   su conclusión no se puede volver a correr.
6. Un `PARTIALLY_SUPPORTED` **tiene que nombrar qué parte**. "Casi" no es un resultado.
7. Antes de FASE 10 **todas las filas se re-verifican** (`S-MP-02`).

## Estados (§61)

| Estado | Significa |
|---|---|
| `VERIFIED` | Se ejecutó y funciona como lo necesitamos. Con evidencia. |
| `NOT_SUPPORTED` | Se ejecutó y el proveedor no lo permite. Con evidencia. |
| `PARTIALLY_SUPPORTED` | Funciona con una restricción **nombrada**. |
| `UNKNOWN` | No se probó, o se probó hace demasiado. |

## Procedimiento por fila (§59)

Leer la documentación oficial **actual** → revisar limitaciones → preparar la prueba →
ejecutar contra la API o el sandbox → happy path → error paths → estados ambiguos → retries →
registrar request → registrar response → observar el webhook → documentar la conclusión.

## Composición

| Origen | Filas |
|---|---|
| Matriz mínima obligatoria del **§60** | 42 |
| Agregadas por FASE 1A (`M-MP-03`), marcadas ✚ | 11 |
| **Total** | **53** |

Columnas: **Estado** · **Fecha** · **Entorno** · **Evidencia** (ruta de la sonda, con request,
response y webhook observado) · **Conclusión**.

---

# Matriz mínima del §60

## Preapproval

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| PA-1 | Creación por API | `UNKNOWN` | — | — | — | — |
| PA-2 | Linking con nuestro dominio desde el inicio | `UNKNOWN` | — | — | — | — |
| PA-3 | Autorización por el usuario | `UNKNOWN` | — | — | — | — |
| PA-4 | Rechazo | `UNKNOWN` | — | — | — | — |
| PA-5 | Cancelación | `UNKNOWN` | — | — | — | — |

## Frecuencias de facturación (§19)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| FR-1 | Mensual | `UNKNOWN` | — | — | — | — |
| FR-2 | Trimestral | `UNKNOWN` | — | — | — | — |
| FR-3 | Semestral | `UNKNOWN` | — | — | — | — |
| FR-4 | Anual | `UNKNOWN` | — | — | — | — |

## Renovaciones

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| RN-1 | Cobro exitoso | `UNKNOWN` | — | — | — | — |
| RN-2 | Cobro fallido | `UNKNOWN` | — | — | — | — |
| RN-3 | Recuperación tras el fallo | `UNKNOWN` | — | — | — | — |

## Grace (§20)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| GR-1 | Recuperación durante el grace | `UNKNOWN` | — | — | — | — |
| GR-2 | Pago tardío, después de suspender (§22) | `UNKNOWN` | — | — | — | — |
| GR-3 | Política de reintentos del proveedor | `UNKNOWN` | — | — | — | — |

## Pausa — `BD-MP-01`

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| PS-1 | Pausar | `UNKNOWN` | — | — | — | — |
| PS-2 | Que no cobre mientras está pausada | `UNKNOWN` | — | — | — | — |
| PS-3 | Reanudación anticipada por el usuario (§26.2) | `UNKNOWN` | — | — | — | — |
| PS-4 | Reanudación automática al llegar la fecha (§26.2) | `UNKNOWN` | — | — | — | — |
| PS-5 | Qué pasa con las fechas al reanudar | `UNKNOWN` | — | — | — | — |
| PS-6 | Qué pasa con la fecha de cobro al reanudar (§26.4) | `UNKNOWN` | — | — | — | — |

## Cancelación (§24)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| CN-1 | Cancelación programada a fin de período | `UNKNOWN` | — | — | — | — |
| CN-2 | Comportamiento inmediato del proveedor | `UNKNOWN` | — | — | — | — |

## Cambios de precio — `BD-MP-03` (§29)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| PC-1 | Sobre una suscripción existente ya autorizada | `UNKNOWN` | — | — | — | — |
| PC-2 | Limitaciones: pisos, topes, magnitud del cambio | `UNKNOWN` | — | — | — | — |
| PC-3 | ¿Requiere nuevo consentimiento del usuario? | `UNKNOWN` | — | — | — | — |

> `PC-3` decide si se pueden actualizar precios sin perder la base instalada. `PC-2` también
> alimenta el piso de `A-PROMO-01` y la estrategia de bajar el monto de `BD-MP-02`.

## Upgrade (§27)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| UP-1 | Aplicación inmediata | `UNKNOWN` | — | — | — | — |
| UP-2 | Efecto económico: prorrateo, cobro inmediato, o nada | `UNKNOWN` | — | — | — | — |

## Downgrade (§28)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| DW-1 | Aplicación al ciclo siguiente | `UNKNOWN` | — | — | — | — |
| DW-2 | ¿Lo soporta el proveedor, o hay que emularlo? | `UNKNOWN` | — | — | — | — |

## Cortesía temporal — `BD-MP-02` (§34.2)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| CT-1 | N meses gratis sobre una suscripción viva | `UNKNOWN` | — | — | — | — |
| CT-2 | Estrategias posibles: bajar monto / pausar / recrear / reembolsar | `UNKNOWN` | — | — | — | — |
| CT-3 | Efectos colaterales de cada estrategia | `UNKNOWN` | — | — | — | — |

## Grant permanente (§35.3)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| GT-1 | Cancelación correcta de la suscripción del proveedor | `UNKNOWN` | — | — | — | — |

## Webhooks (§51)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| WH-1 | Duplicados | `UNKNOWN` | — | — | — | — |
| WH-2 | Demorados | `UNKNOWN` | — | — | — | — |
| WH-3 | Fuera de orden | `UNKNOWN` | — | — | — | — |
| WH-4 | Reintentos | `UNKNOWN` | — | — | — | — |
| WH-5 | Faltantes: un evento que nunca llega | `UNKNOWN` | — | — | — | — |

## Reconciliación (§23)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| RC-1 | Consultar el estado real de una suscripción | `UNKNOWN` | — | — | — | — |
| RC-2 | Historial de pagos | `UNKNOWN` | — | — | — | — |
| RC-3 | Reparar el estado local desde el del proveedor | `UNKNOWN` | — | — | — | — |

---

# ✚ Filas agregadas por FASE 1A

No están en la matriz mínima del §60. §60 dice *"matriz mínima"*, así que ampliarla es lo
esperado; se marcan para que quede claro qué exige el PDR y qué agregó el análisis
(`M-MP-03`).

## ✚ Reembolsos — `M-LEGAL-01`

> El derecho de revocación con devolución total necesita poder reembolsar. También es una de
> las cuatro estrategias posibles de `BD-MP-02`.

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| RF-1 | Reembolso total de un cobro | `UNKNOWN` | — | — | — | — |
| RF-2 | Reembolso parcial | `UNKNOWN` | — | — | — | — |
| RF-3 | Plazo máximo para reembolsar un cobro | `UNKNOWN` | — | — | — | — |

## ✚ Huecos estructurales

| # | Comportamiento | Para qué | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|---|
| EX-1 | Qué pasa con una autorización creada y **nunca completada**: ¿vence?, ¿cuándo?, ¿se puede reusar? | `M-SUB-01`, `M-MP-02` | `UNKNOWN` | — | — | — | — |
| EX-2 | ¿Los eventos del proveedor traen **orden confiable** (versión o timestamp)? | `M-CONC-02` | `UNKNOWN` | — | — | — | — |
| EX-3 | ¿Qué le comunica el proveedor **al cliente, por su cuenta**, al cancelar / pausar / modificar? | `M-MAIL-04` | `UNKNOWN` | — | — | — | — |
| EX-4 | Cambio de **frecuencia** sobre una suscripción ya autorizada | `BD-SUB-01`, `MP-01` | `UNKNOWN` | — | — | — | — |
| EX-5 | ¿Una autorización puede cubrir **más de un monto**? | `BD-MP-04` | `UNKNOWN` | — | — | — | — |
| EX-6 | N autorizaciones del mismo pagador conviviendo, ya autorizadas | `BD-MP-04` | `UNKNOWN` | — | — | — | — |
| EX-7 | Compensar días ya pagados corriendo la **primera fecha de cobro** | `BD-SUB-01` | `UNKNOWN` | — | — | — | — |
| EX-8 | ¿Se respeta esa primera fecha **después** de autorizar? | `BD-SUB-01` | `UNKNOWN` | — | — | — | — |

> `EX-7` y `EX-8` van separadas a propósito: que el proveedor **acepte** una fecha futura al
> crear no prueba que la **respete** una vez autorizada, y ésa es la que decide. Una fila que
> sólo se probó antes de autorizar no responde por el comportamiento después.

---

## Resumen

| Estado | Filas |
|---|---|
| `VERIFIED` | 0 |
| `PARTIALLY_SUPPORTED` | 0 |
| `NOT_SUPPORTED` | 0 |
| **`UNKNOWN`** | **53** |

## Qué espera cada decisión

| Decisión abierta | Filas que la desbloquean |
|---|---|
| `BD-MP-01` mecanismo de pausa | `PS-1`…`PS-6` |
| `BD-MP-02` cortesía sobre una suscripción viva | `CT-1`…`CT-3`, `PC-2`, `RF-1` |
| `BD-MP-03` cambio de precio sobre vigentes | `PC-1`, `PC-2`, `PC-3` |
| `BD-MP-04` addons recurrentes | `EX-5`, `EX-6` |
| `BD-SUB-01` matriz de cambio de plan | `UP-1`, `UP-2`, `DW-1`, `DW-2`, `EX-4`, `EX-7`, `EX-8` |
| `MP-01` los cuatro ciclos del §19 | `FR-1`…`FR-4`, `EX-4` |
| `M-LEGAL-01` revocación con devolución | `RF-1`, `RF-3` |
| `M-CONC-02` no-retroceso de estado | `WH-3`, `EX-2` |
| `M-SUB-01` estado de autorización pendiente | `PA-3`, `PA-4`, `EX-1` |
| `M-MAIL-04` correos del proveedor | `EX-3` |
| `A-PROMO-01` piso del descuento apilado | `PC-2` |

**Ninguna capability de billing puede implementarse todavía** (§61), y ninguna decisión que
dependa de estas filas puede tomarse. Es lo esperable: FASE 1C no empezó.

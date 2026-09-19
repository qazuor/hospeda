---
title: Master Spec 21 — Migración
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-18
status: CURRENT
fase: 2
capitulo: 21
cierra:
  - M-MIG-01
  - O-MIG-01
  - R-MIG-01
---

# 21 · Migración

Mitad **BILLING** del capítulo 21 del programa. La otra mitad vive en la otra épica.

Este capítulo es corto por una razón que está medida: **no hay casi nada que migrar.**

Los tres huecos que cierra se contestan con el mismo número, y el número no se hereda del PDR:
se midió, y se re-midió al escribir este capítulo.

---

## 1. La premisa del §56, medida · cierra `O-MIG-01`

### 1.1 La objeción

El §56 razona: *«Como hay pocos customers actuales: si migrar automáticamente agrega mucha
complejidad/riesgo: preferir coordinación manual y nueva subscription»*. **La premisa —*«hay pocos
customers»*— es una afirmación sobre el estado real del sistema y el PDR no da el número.** Toda
la preferencia por la coordinación manual descansa ahí, y también el tamaño del riesgo de
`R-MIG-01`.

`O-MIG-01` pedía **medirla, no heredarla**. Es el §61 aplicado al propio PDR.

### 1.2 Está medida, y la premisa es cierta por mucho

Medición de producción del **2026-09-15**, sólo lectura
([`07-facts-inventory.md`](../../HOS-1352-billing-verticals-redesign/docs/07-facts-inventory.md)), **re-verificada el 2026-09-17 a las 12:52
`-03`** con la consulta 2 de ese documento, **sin un solo cambio**:

| | |
|---|---|
| **pagos registrados en toda la historia** | **0** |
| suscripciones vivas | 8, **todas mensuales** |
| con compromiso de cobro vivo | **3** (`trialing`, alojamiento) |
| cortesías sin vínculo con el proveedor | **2** (`comp`) |
| gastronomías · experiencias · partners | **0 · 0 · 0** |

**«Pocos customers» son tres compromisos de cobro y cero pagos cobrados en la historia del
sistema.** No hay historial de pagos que preservar, y tres de las cinco verticales no tienen un
solo dato: su rediseño no arrastra deuda de datos, sólo de código.

**`DEC-MIG-001` queda apoyada en una premisa verificada**, no en una heredada. La objeción se
cerró midiendo, que es la única forma en que se cierra una objeción de este tipo.

### 1.3 Y caduca

`S-METH-01`: esta medición vale mientras el hecho no cambie, y **este hecho cambia solo** — el
2026-09-26 (§3). Se re-verifica antes de implementar nada de FASE 10, con la consulta que el
inventario deja escrita.

---

## 3. El cobro durante el rediseño · cierra `R-MIG-01`

### 3.1 El hueco cambia de forma cuando se lo mide

`R-MIG-01` lo planteaba así: *«si hay débitos automáticos activos, siguen corriendo durante todo
el programa»*, y lo llamaba **el riesgo operativo más grande del programa**.

**No hay débitos corriendo.** Cero pagos en la historia del sistema. Lo que hay son **tres
compromisos que todavía no cobraron**, con fecha:

| compromiso | primer cobro |
|---|---|
| 1 | **2026-09-26** |
| 2 | 2026-11-25 |
| 3 | 2026-11-30 |

### 3.2 Y entonces son tres problemas distintos, no uno

**(a) Las cinco relaciones vivas.** No hay nada que parar ni que coexistir: se coordinan a mano
(`DEC-MIG-001`) y se transcriben según §2.3. Ninguna de las tres opciones que el hueco planteaba
—coexistencia de dos motores, corte con migración asistida, congelamiento— hace falta para éstas.

**(b) El 2026-09-26.** Esa fecha llega **durante FASE 2 o 3**, y la implementación está en FASE 10
(§65). O sea que **ese primer cobro de la historia del sistema ocurre bajo el sistema ACTUAL, no
bajo éste.** No es una pregunta de migración: es una operación que necesita a alguien mirándola el
día que pase. Este capítulo la registra con fecha para que no llegue por sorpresa.

**(c) Las altas nuevas.** Es lo único de los tres que sigue abierto, y **no lo cierra esta spec.**

### 3.3 Las altas nuevas son una decisión del owner, y se declara abierta

Qué pasa con quien se suscriba **mientras dura el rediseño** es una decisión comercial, no
técnica: congelar altas tiene costo de negocio, y no congelarlas agranda la cohorte que después
hay que transcribir a mano —que es precisamente lo que hoy hace barata a la opción (a)—.

Las tres opciones del hueco, con lo que cuesta cada una **dado el número medido**:

| # | opción | costo | riesgo |
|---|---|---|---|
| 1 | **seguir tomando altas** en el sistema actual | ninguno comercial | la cohorte a transcribir crece: hoy son 5 y la regla de §2.3 sólo es barata mientras sean pocas |
| 2 | **congelar altas nuevas** hasta FASE 10 | comercial, y no es chico: tres verticales todavía no vendieron nada | cero cohorte nueva |
| 3 | **coexistencia de dos motores** | el más caro de construir | contamina la arquitectura nueva, que es lo que el §56 pide no hacer |

**No se completa en silencio** (§67). Queda declarada como decisión del owner en
[`04-open-decisions.md`](../../HOS-1352-billing-verticals-redesign/docs/04-open-decisions.md) — la única que este capítulo abre en vez de
cerrar.

---

## 4. Lo que NO se migra, y no es una omisión

- **Los pagos**: no hay ninguno.
- **`commerce`**: el §55 ordena eliminarlo de fuentes activas, con la excepción histórica del
  §55.1 —auditoría, historia de migraciones, entender datos legacy— **marcada inequívocamente**.
  Eso es trabajo de FASE 5 y de código, no de datos.

---

## Lo que este capítulo NO cierra

- **Qué pasa con las altas nuevas durante el rediseño** (§3.3): decisión del owner, declarada
  abierta.
- **La clasificación del código legacy** en reusar o reescribir tiene su propio gate
  (`DEC-METH-003`) y es FASE 5. No se anticipa acá ni implícitamente.

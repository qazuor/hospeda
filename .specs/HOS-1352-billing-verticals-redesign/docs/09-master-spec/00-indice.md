---
title: Master Spec — índice y reglas de escritura
linear: HOS-1352
statusSource: linear
created: 2026-09-17
updated: 2026-09-17
status: CURRENT
fase: 2
---

# Master Spec — índice

La spec de FASE 2: **cómo se construye hoy Verticales + Billing de Hospeda partiendo de cero**
(`00-PDR.md` §1). Son 22 capítulos en tres partes, un archivo cada uno.

## Qué es y qué no es

**Es** el diseño completo del sistema nuevo: dominio, datos, estados, invariantes, servicios,
API, jobs, proveedor, superficies, testing y migración.

**No es** un plan de implementación (eso es FASE 7), ni una comparación contra lo que existe
(eso es FASE 5), ni una clasificación de código en `KEEP`/`ADAPT`/`REWRITE` — que tiene su
propio gate (`DEC-METH-003`) y **no se anticipa acá ni siquiera de forma implícita**.

## De dónde sale cada afirmación

La regla de fuentes de esta fase es **distinta de la de FASE 1B**, y conviene decirlo porque
las dos conviven en la misma carpeta.

FASE 1B se escribió **sólo contra el código**. FASE 2 se escribe **sin el código**: el §0 del
PDR es explícito —*«NO quiero que la implementación existente condicione el diseño del sistema
nuevo»*— y el §65 lo repite al abrir la fase. Las tres fuentes admitidas son las del programa
(`01-decision-log.md`, regla 4):

1. **el PDR** — y si un capítulo cita un `§`, el texto se verifica contra el PDR antes de
   escribirlo (regla 5);
2. **una decisión registrada** en `01-decision-log.md` — son 45, y las `SUPERSEDED` no cuentan;
3. **una medición fechada** de `06-mp-validation-matrix.md` o `07-facts-inventory.md`.

**El registro de FASE 1B (`08`) no es fuente de diseño.** Un hallazgo de 1B puede aparecer en
un capítulo **sólo** como advertencia sobre un modo de falla ya observado —nunca como razón
para que el diseño sea de una forma u otra—, y va marcado como tal. Es la línea que el §0
traza: la arquitectura actual no es la fuente de verdad.

## Cómo se relacionan los capítulos

La Parte I es **el único lugar donde algo se define**. Los capítulos de la Parte II describen
comportamiento y **referencian** el núcleo; no redefinen una entidad, un estado ni un
invariante. Si un subdominio necesita algo que el núcleo no tiene, se agrega al núcleo — no se
declara localmente.

Es el §7 aplicado al documento: *«Debe existir un único motor genérico de billing»*. Una spec
organizada por subdominio reproduce en el papel la duplicación que el §1 nombra como causa de
este programa.

## Cuándo un hueco se considera cerrado

Los 72 huecos técnicos de `04-open-decisions.md` los resuelve esta spec **sin el owner**. Un
hueco se cierra cuando un capítulo dice qué pasa en todos sus casos, y en el **mismo commit**
se marca cerrado en `04-open-decisions.md` con el capítulo que lo cerró. La fila no se borra.

Dos reglas de método que salen de los propios huecos y rigen este documento:

- **`O-METH-01`** — *«cerrar todas las decisiones funcionales» no cierra en 1A*. Se registra
  acá: el cierre de una decisión funcional es este documento, y lo que quede abierto al
  terminarlo se declara abierto, no se completa en silencio (§67).
- **`S-METH-01`** — **cuándo caduca una decisión**. Toda afirmación de esta spec que se apoye
  en una medición lleva su fecha; una medición de `06` o de `07` caduca si el hecho que mide
  puede haber cambiado, y en ese caso se re-mide antes de implementar, no antes de escribir.

## Las tres partes

### Parte I — El núcleo transversal

Es el Eje 1 del §8. Lo que no depende de ninguna vertical.

| # | capítulo | cierra |
|---|---|---|
| 01 | Glosario y modelo conceptual | `M-ARCH-01` `A-SUB-01` `A-SUB-02` `O-ARCH-01` `S-ARCH-02` |
| 02 | Modelo de datos: entidades, relaciones y constraints | `C-ARCH-01` `S-ARCH-01` `M-ARCH-02` `M-DATA-01` |
| 03 | Las máquinas de estado (§63) — ocho, más la postulación de Partner | `M-SUB-01` `M-CONC-02` |
| 04 | Invariantes | — consolida los 37 del §64 |
| 05 | Idempotencia y concurrencia | `E-CONC-01` `M-CONC-03` |
| 06 | Abstracción de proveedor y el contrato de Mercado Pago | `MP-01` `M-MP-01` `M-MP-02` `M-MP-03` `R-MP-01` `S-MP-01` `S-MP-02` `S-MP-03` |
| 07 | Outbox y notificaciones | `M-MAIL-01` `M-MAIL-02` `M-MAIL-03` `M-MAIL-04` |
| 08 | Auditoría y observabilidad | `M-ADMIN-01` `M-AUDIT-01` `M-OBS-01` `R-OBS-01` `S-OBS-01` |
| 09 | Conciliación | — se apoya en `DEC-CONC-002` |

### Parte II — Los subdominios

Cada uno dice sus reglas, qué estados del capítulo 03 usa, qué servicios expone, qué API, qué
jobs y qué muestra la UI.

| # | capítulo | cierra |
|---|---|---|
| 10 | Verticales, planes y billing options | `OD-ARCH-01` `M-SUB-03` |
| 11 | Trial | `A-TRIAL-02` `E-TRIAL-02` `E-TRIAL-03` `E-TRIAL-04` `M-TRIAL-03` `OD-TRIAL-01` `S-TRIAL-01` |
| 12 | Suscripción: alta, cambio de plan, pausa, gracia y cancelación | `E-SUB-01` `E-SUB-02` `E-SUB-05` `E-SUB-06` `M-SUB-02` `R-SUB-01` |
| 13 | Pagos: Mercado Pago y manuales | — se apoya en 06 |
| 14 | Promos, cortesías y grants | `A-PROMO-01` `A-PROMO-02` `E-PROMO-01` `M-PROMO-02` |
| 15 | Entitlements y limits | `A-ENT-02` `E-ENT-01` `M-ENT-01` `M-ENT-02` `M-ENT-03` |
| 16 | Addons | `A-ADDON-01` `A-ADDON-02` `E-ADDON-03` `E-ADDON-04` |
| 17 | Autorización | `A-AUTH-01` `M-AUTH-01` `M-AUTH-02` `S-AUTH-01` |
| 18 | Partner | `A-PARTNER-01` `M-PARTNER-01` |

### Parte III — Ejecución

| # | capítulo | cierra |
|---|---|---|
| 19 | Superficies: API, Web y Admin | — se apoya en 17 |
| 20 | Estrategia de testing (§62) | — |
| 21 | Migración | `M-MIG-01` `O-MIG-01` `R-MIG-01` |
| 22 | Lo que queda en manos de la consulta legal | `M-LEGAL-01` `M-LEGAL-02` `M-LEGAL-03` |

## Cobertura, verificada

**Los 72 huecos abiertos de `04-open-decisions.md` están asignados y ninguno queda sin
capítulo.** El reparto cierra sin residuo: 5 + 4 + 2 + 2 + 8 + 4 + 5 en la Parte I, 2 + 7 + 6 +
4 + 5 + 4 + 4 + 2 en la Parte II, 3 + 3 en la Parte III, más `O-METH-01` y `S-METH-01` que se
cierran acá arriba. Son 75 los IDs que la sección nombra; tres ya estaban cerrados
—`E-TRIAL-01` por `DEC-TRIAL-005`, `R-DATA-01` por `DEC-DATA-001` y `M-CONC-01` por
`DEC-CONC-001`—, así que **72 abiertos**.

**Y las 36 áreas que el §65 le exige a la Master Spec tienen capítulo:**

| área del §65 | capítulo |
|---|---|
| domain · entities · relations · constraints | 01, 02 |
| DB | 02 |
| states · transitions | 03 |
| invariants | 04 |
| services · API | cada subdominio + 19 |
| jobs | cada subdominio |
| provider · MP | 06 |
| manual payments | 13 |
| outbox | 07 |
| trial | 11 |
| subscription · billing · pause · grace · cancellation | 12 |
| plans · billing options | 10 |
| promo · courtesy · grants | 14 |
| addons | 16 |
| entitlements · limits | 15 |
| auth | 17 |
| UI · Admin | 19 |
| audit · observability | 08 |
| reconciliation | 09 |
| testing | 20 |
| migration | 21 |

## Estado

| capítulo | estado |
|---|---|
| 00 — este índice | ✅ |
| 01 — Glosario y modelo conceptual | ✅ |
| 02 — Modelo de datos | ✅ |
| 03 — Las máquinas de estado | ✅ |
| 04 — Invariantes | ✅ |
| 05 — Idempotencia y concurrencia | ✅ |
| 06 — Proveedor y contrato de MP | ✅ |
| 07 — Outbox y notificaciones | ✅ |
| 08 — Auditoría y observabilidad | ✅ |
| 09 — Conciliación | ✅ |
| **Parte I completa** | ✅ |
| 10 — Verticales, planes y billing options | ✅ |
| 11 — Trial | ✅ |
| 12 a 14 | ⬜ sin escribir |
| 15 — Entitlements y limits | ✅ |
| 16 — Addons | ✅ |
| 17 — Autorización | ✅ |
| 18 — Partner | ✅ |
| 19 a 22 | ⬜ sin escribir |

---
title: Decision Log
linear: HOS-1352
statusSource: linear
created: 2026-09-15
status: CURRENT
---

# Decision Log

Registro explícito de las decisiones del programa. **Ninguna decisión vive en otro lado**:
ni en un comentario de código, ni en un mensaje de chat, ni en la memoria de un agente.

Si una decisión se aparta del [PDR](./00-PDR.md), el PDR **no se edita**: se registra acá el
apartamiento y por qué.

## Formato

```
### DEC-<AREA>-<NNN> — <título>

- **Fecha**:
- **Estado**: PROPOSED | ACCEPTED | SUPERSEDED por DEC-xxx | REJECTED
- **Decide**: owner | agente (con nombre de quién)
- **Problema**:
- **Alternativas**: (1) … (2) … (3) …
- **Decisión**:
- **Motivo**:
- **Implicaciones**:
- **Reemplaza a**: —
- **Origen**: ID de 1A que la motivó (ej. `BD-ARCH-01`)
```

Áreas: `TRIAL` · `SUB` · `BILL` · `MP` · `ENT` · `LIM` · `ADDON` · `PROMO` · `AUTH` ·
`DATA` · `MAIL` · `ADMIN` · `ARCH` · `MIG` · `TEST` · `METH`.

Reglas:

- Una decisión `ACCEPTED` sólo se cambia creando otra que la marque `SUPERSEDED`. No se
  edita el texto de una decisión ya aceptada.
- Toda decisión que cierre un ítem de [`04-open-decisions.md`](./04-open-decisions.md) debe
  actualizar ese documento en el mismo commit.
- Una decisión sobre Mercado Pago no puede tomarse mientras su fila de
  [`06-mp-validation-matrix.md`](./06-mp-validation-matrix.md) diga `UNKNOWN` (PDR §61).

---

## Decisiones tomadas

### DEC-METH-001 — Los documentos rectores viven en `.specs/HOS-1352-*`

- **Fecha**: 2026-09-15
- **Estado**: ACCEPTED
- **Decide**: owner
- **Problema**: el PDR pide guardar el documento rector en el repo, sin decir dónde. Las dos
  ubicaciones candidatas eran una carpeta `docs/` de primer nivel o el sistema de specs.
- **Alternativas**: (1) `.specs/HOS-<n>-billing-verticals-redesign/` con issue paraguas en
  Linear; (2) `docs/billing-redesign/` sin issue.
- **Decisión**: (1).
- **Motivo**: respeta la convención del repo, el macro-estado queda en Linear y no en
  archivos, y cada épica de FASE 3 puede nacer como sub-issue con su propia carpeta.
- **Implicaciones**: el número de carpeta lo asigna Linear, nunca se inventa.
- **Origen**: FASE 0.

### DEC-METH-002 — Se crea un issue paraguas nuevo, no se reusa HOS-1257

- **Fecha**: 2026-09-15
- **Estado**: ACCEPTED
- **Decide**: owner
- **Problema**: existe `HOS-1257` ("paridad total de billing entre las 3 verticales") con
  worktree activo, además de una veintena de issues puntuales de `area-billing`.
- **Alternativas**: (1) issue paraguas nuevo; (2) colgar el programa de HOS-1257; (3) sin
  issue por ahora.
- **Decisión**: (1) — se creó `HOS-1352`.
- **Motivo**: HOS-1257 es trabajo previo con su propio alcance. Colgar un rediseño integral
  de un issue de paridad confunde ambos.
- **Implicaciones**: la clasificación de qué issues abiertos quedan absorbidos por el
  rediseño se hace en **FASE 5**, no ahora.
- **Origen**: FASE 0.

### DEC-METH-003 — Se permiten conteos de DB en FASE 0, sin mirar código

- **Fecha**: 2026-09-15
- **Estado**: ACCEPTED
- **Decide**: owner
- **Problema**: el PDR §67 prohíbe FASE 1B antes de cerrar 1A, pero varias decisiones de 1A
  (migración, identidad, alcance del trial) dependen de cuántos clientes reales existen.
- **Alternativas**: (1) permitir conteos read-only de DB; (2) 1A absolutamente puro y los
  conteos recién en 1B.
- **Decisión**: (1), acotado a conteos. Nada de leer código, esquema como diseño, ni
  comportamiento.
- **Motivo**: los números son restricciones de realidad, no arquitectura legacy. Sin ellos,
  `BD-MIG-01` no se puede responder.
- **Implicaciones**: resultados en [`07-facts-inventory.md`](./07-facts-inventory.md), con
  fecha de medición y caducidad explícita.
- **Origen**: `O-METH-01`.

---

## Decisiones pendientes

Las 7 BLOCKING y el resto de las abiertas viven en
[`04-open-decisions.md`](./04-open-decisions.md) hasta que el owner las responda.
Cuando se responda una, se crea acá su `DEC-*` y se marca allá como cerrada.

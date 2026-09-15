---
title: Worklog / Progress Log
linear: HOS-1352
statusSource: linear
created: 2026-09-15
status: CURRENT
---

# Worklog

Registro cronológico del programa. Tiene que poder responder, en cualquier momento:
**"¿qué hicimos hasta ahora y por qué?"**

Se agrega al final. No se reescribe el pasado: si algo resultó estar mal, se anota abajo que
estaba mal, con la fecha en que se supo.

---

## 2026-09-15 — FASE 0 y FASE 1A

### Qué se hizo

**FASE 0 — bootstrap**

1. El owner entregó el PDR rector completo en una sola sesión.
2. Se acordaron tres cosas antes de empezar (ver `DEC-METH-001/002/003`): ubicación de los
   documentos, issue paraguas nuevo, y permiso para contar filas en producción.
3. Se buscaron duplicados en Linear (team `Hospeda`) con dos consultas: "rediseño billing
   verticales" y "billing redesign motor generico rewrite". **No existía ningún issue
   paraguas de rediseño integral.** Sí aparecieron ~20 issues puntuales de `area-billing`
   abiertos, incluido `HOS-1257` (paridad entre verticales, con worktree activo).
4. Se creó **`HOS-1352`** como issue paraguas.
5. Se creó el worktree `hospeda-spec-hos-1352-billing-redesign`, branch
   `spec/HOS-1352-billing-verticals-redesign`, cortada de `origin/staging` (`60a39dae2`).
   No se levantaron servers ni DB: el worktree es sólo para documentos.
6. Se escribió el PDR verbatim en [`00-PDR.md`](./00-PDR.md), marcado inmutable, más este
   worklog, el decision log, el handoff, las decisiones abiertas y la matriz MP vacía.

**Inventario de hechos duros** (autorizado, ver `DEC-METH-003`)

Conteos read-only contra producción. El resultado más importante:
**cero pagos registrados en producción** (`billing_payments` = 0 filas), y cero fichas de
gastronomía, experiencias y partner. Lo que hay vivo son 3 trials con preapproval de MP,
2 cortesías, 22 usuarios y 12 alojamientos (5 publicados). Detalle completo en
[`07-facts-inventory.md`](./07-facts-inventory.md).

**FASE 1A — análisis del dominio**

Se analizó el PDR contra sí mismo, sin mirar código. Resultado en
[`05-phase-1a-domain-analysis.md`](./05-phase-1a-domain-analysis.md): 6 contradicciones,
6 ambigüedades, 9 decisiones bloqueantes, 5 abiertas, 11 edge cases, 4 riesgos,
31 requisitos faltantes, 3 objeciones, 7 mejoras sugeridas y 21 preguntas para el owner.

### Qué se encontró (lo que más pesa)

- **`BD-ARCH-01`** — el PDR nunca define si los planes son mutables o versionados, y define
  todo lo demás encima de esa pregunta. Es la decisión que más condiciona el esquema.
- **`C-ARCH-01`** — "toda la configuración en DB" (§9) es inaplicable tal como está escrito:
  el código necesita nombrar las claves de entitlement y limit para poder gatear. Hay que
  acotar el principio o se va a violar en silencio, que es cómo se llegó a la situación
  actual.
- **`M-SUB-01`** — falta el estado `PENDING_AUTHORIZATION`. En el modelo elegido (§5.6) esa
  ventana existe siempre y es donde se pierde gente.
- **`M-ENT-01`** — §37 asume que todos los limits suman; hay limits donde sumar es incorrecto.
  Falta `aggregationStrategy`.
- **`M-LEGAL-01`** — el PDR no menciona el botón de baja ni el derecho de revocación de 10
  días, que son requisitos legales duros para cobrar por débito automático en Argentina.
- **`C-TRIAL-02`** — §17 dice que Partner tiene trial; §17.3 lo hace imposible.
- Los conteos de producción **abaratan mucho** `BD-MIG-01` y `R-MIG-01`: no hay historial de
  pagos que preservar. Son cinco relaciones a migrar, no una base instalada.

### Problemas encontrados en el camino

- `hops psql` devuelve **salida vacía** cuando la query falla: un `UNION` de diez tramos se
  anula entero si una sola columna no existe. Se resolvió partiendo las consultas.
- El clone principal estaba en detached HEAD; todo el trabajo se hizo en el worktree nuevo
  para no tocar la branch de otra sesión.

### Decisiones tomadas

`DEC-METH-001`, `DEC-METH-002`, `DEC-METH-003`. Ver
[`01-decision-log.md`](./01-decision-log.md).

### Próximo paso exacto

**El owner responde las 21 preguntas** de la sección 16 de
[`05-phase-1a-domain-analysis.md`](./05-phase-1a-domain-analysis.md), o al menos las 7
marcadas `[BLOCKING]`.

Hasta entonces, por orden explícito del PDR §67: **no se arranca FASE 1B**.

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

---

## 2026-09-15 (más tarde) — Cierre de 1A: 36 decisiones

### Qué se hizo

El owner pidió resolver, en una sola sesión, todo lo que dependiera de su decisión y no
necesitara investigación previa. Se recorrieron **30 decisiones suyas en siete tandas**, más
seis que aparecieron durante la conversación.

**Resultado: 36 decisiones cerradas.** Detalle completo en
[`01-decision-log.md`](./01-decision-log.md); el mapeo pregunta → decisión, en
[`04-open-decisions.md`](./04-open-decisions.md).

De las 7 bloqueantes de FASE 2, **quedaron cerradas 6**. La séptima (`BD-MP-04`, addons
recurrentes) el owner la dejó **deliberadamente condicionada a FASE 1C**, porque la opción
buena para el cliente — cobrarlos junto al plan — depende de lo que permita MercadoPago.

### Lo que se verificó en el camino

Para responder `BD-SUB-02` no alcanzaba con opinar, así que se consultó la **documentación
oficial de Stripe** vía Context7, de donde copia el resto de la industria. Lo que encontró
corrigió mi propia recomendación previa:

- Cambio de precio con el mismo intervalo: se prorratea en la próxima factura, sin mover la
  fecha de cobro.
- Downgrades: se agendan a fin de período con *subscription schedules* (su portal lo llama
  literalmente "Manage downgrades").
- **Cambio de intervalo: es la excepción explícita.** Se acredita el tiempo no usado, se cobra
  el precio nuevo de inmediato y el ciclo se reinicia.

Yo había recomendado que el cambio de ciclo esperara siempre a la renovación. La industria
hace lo contrario. Se adoptó la regla de la industria (`DEC-SUB-001`), con la salvedad de que
**la compensación se hace en días y no en pesos** — corriendo la primera fecha de cobro del
preapproval nuevo — porque prorratear dinero es justamente lo que MP probablemente no soporta.
El plan B quedó declarado por si 1C dice que no.

### Hallazgo aportado por el owner

**`M-MAIL-04`**: cuando el motor cancela, pausa o modifica un preapproval, **MercadoPago le
manda al cliente su propio correo**, que nosotros no escribimos ni controlamos. El cliente
recibe "tu suscripción fue cancelada" sin contexto.

No es un caso de un flujo: es transversal a toda operación sobre un preapproval. Se agregó al
análisis 1A y se cerró como `DEC-MAIL-002`: **todo lo que toque un preapproval va precedido de
un correo nuestro**.

### Decisiones que se apartaron de la recomendación

Cinco, todas del owner y todas con su riesgo declarado en el log:

- `DEC-METH-004` — sin criterio fijo para KEEP vs REWRITE, caso por caso. Es la que más
  tensión guarda con el §2 del propio PDR; conviene revisarla al empezar FASE 5.
- `DEC-ENT-003` y `DEC-GRANT-001` — cancelar sin reembolso. Riesgo bajo hoy (todas las
  suscripciones vivas son mensuales), alto si aparece un ciclo anual.
- `DEC-ADDON-004` y `DEC-ADDON-005` — el reloj del addon corre igual, y el addon se pierde con
  la ficha. Ambas necesitan que la UI avise explícitamente.
- `DEC-MAIL-001` — campañas de recuperación en paralelo sin control. Riesgo teórico hoy: sólo
  una vertical tiene contenido.
- `DEC-PROMO-003` — scope "verticales futuras" sin restricción.

### Revisión de DEC-METH-004, el mismo día

El owner pidió volver sobre la única decisión que había quedado en tensión con su propio PDR:
clasificar KEEP vs REWRITE caso por caso, sin criterio.

Al discutirla aparecieron las dos caras:

- **A favor de tener criterio**: FASE 5 son decenas de clasificaciones (42 tablas de billing
  medidas, más al menos siete motores de entitlements detectados). El §2 pone la carga de la
  prueba del lado de conservar, pero eso sólo funciona si hay algo concreto que rendir; sin
  eso la carga se invierte sola, porque conservar nunca requiere defensa. Y con el programa
  atravesando varias ventanas de contexto (§3.3), dos piezas equivalentes se clasifican al
  revés sin que nadie lo note.
- **En contra del criterio que yo había propuesto**: era **defectuoso**. Su punto 2 exigía que
  el código no nombrara ninguna vertical, pero el §8 define el Eje 2 como *comportamiento
  específico de vertical*. Ese criterio mandaba todo el Eje 2 a `REWRITE` por definición.

**Resultado**: `DEC-METH-004` queda `SUPERSEDED` por **`DEC-METH-005`** — la decisión se toma
al empezar FASE 5, con el inventario real de 1B enfrente, y es el **gate de entrada** de esa
fase: no se clasifica ninguna pieza antes de haberla tomado.

### Próximo paso exacto

**FASE 1B está desbloqueada** (discovery del sistema actual), y **FASE 1C también** —
son independientes entre sí.

Conviene **arrancar por 1C**: hay 4 decisiones esperando su resultado (`BD-MP-01`, `BD-MP-02`,
`BD-MP-03`, `BD-MP-04`), más el plan B de `DEC-SUB-001` y el reembolso que necesita
`DEC-LEGAL-001`. Mientras 1C corre, 1B puede avanzar en paralelo.

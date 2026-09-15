---
title: Decisiones abiertas
linear: HOS-1352
statusSource: linear
created: 2026-09-15
status: CURRENT
---

# Decisiones abiertas

Todo lo que el [PDR](./00-PDR.md) no define y hay que definir. Mientras un ítem esté acá,
**nadie decide por su cuenta**: ni un agente, ni una implementación, ni un default silencioso.

Cuando una se cierra: se crea su `DEC-*` en [`01-decision-log.md`](./01-decision-log.md) y se
marca acá como cerrada con el ID de la decisión. No se borra la fila — el histórico de qué
estuvo abierto es parte del registro.

Detalle completo de cada una en
[`05-phase-1a-domain-analysis.md`](./05-phase-1a-domain-analysis.md); acá va el estado.

---

## BLOCKING — frenan FASE 2

Ninguna se puede responder leyendo el PDR. Cada una condiciona el esquema de datos o el
modelo de dominio, así que escribir la Master Spec sin ellas es escribirla dos veces.

| ID | Pregunta | Estado |
|---|---|---|
| `BD-ARCH-01` | ¿Planes mutables, o versionados e inmutables? | 🔴 abierta |
| `BD-TRIAL-01` | Derivación del Trial Plan: ¿live o snapshot? | 🔴 abierta |
| `C-TRIAL-01` | "Máximo 1 ficha en trial" contra "hereda los limits del plan más básico" | 🔴 abierta |
| `BD-SUB-02` | ¿Qué es "upgrade" con dos ejes (tier × ciclo)? | 🔴 abierta |
| `BD-MP-04` | ¿Existen addons recurrentes? | 🔴 abierta |
| `BD-MIG-01` | ¿Qué se le promete al cliente que hoy paga? | 🔴 abierta |
| `C-TRIAL-02` | ¿Partner tiene trial? | 🔴 abierta |

## BLOCKING dependientes de MP

No las decide el owner: las decide el experimento. **No se pueden cerrar mientras su fila de
[`06-mp-validation-matrix.md`](./06-mp-validation-matrix.md) diga `UNKNOWN`** (PDR §61).

| ID | Pregunta | Estado |
|---|---|---|
| `BD-MP-01` | Mecanismo de pausa: ¿nativa, recrear, o crédito interno? | 🟡 pendiente de FASE 1C |
| `BD-MP-02` | Cortesía temporal sobre una subscription viva | 🟡 pendiente de FASE 1C |
| `BD-MP-03` | Cambios de precio sobre subscriptions vigentes | 🟡 pendiente de FASE 1C |
| `BD-TRIAL-02` | Qué señal define "misma identidad" para el trial de por vida | 🔴 abierta (decisión del owner, no de MP) |

## OPEN DECISIONS

No frenan FASE 2, pero sin ellas la Master Spec queda con huecos.

| ID | Pregunta | Estado |
|---|---|---|
| `OD-ARCH-01` | ¿Hay `rank` explícito entre planes? ¿Cuáles participan de la derivación? | 🔴 abierta |
| `OD-TRIAL-01` | Trial con pausa y cortesía: ¿se puede? ¿hay techo de días? | 🔴 abierta |
| `OD-SUB-01` | Ventana de límites de pausa: ¿por user+vertical o por subscription? | 🔴 abierta |
| `OD-ENT-01` | ¿Hay entitlements de consumo (cuotas), o son todos booleanos? | 🔴 abierta |
| `OD-PROMO-01` | Scope "todas las verticales futuras": ¿tope, revisión, vencimiento? | 🔴 abierta |

## Requisitos faltantes que necesitan definición del owner

No son ambigüedades técnicas: el PDR no los menciona y alguien tiene que decidirlos.

| ID | Qué falta | Estado |
|---|---|---|
| `M-TRIAL-01` | Qué puede hacer un usuario en estado "pre-trial" | 🔴 abierta |
| `M-TRIAL-02` | ¿Turista VIP tiene trial? ¿Con qué disparador? | 🔴 abierta |
| `M-LEGAL-01` | Botón de baja y derecho de revocación de 10 días | 🔴 abierta |
| `O-LEGAL-01` | Confirmar avanzar sin comprobante fiscal hasta ARCA | 🔴 abierta |
| `C-DATA-01` | Retención: qué ve el dueño a los 90 días, y si se avisa antes de los 180 | 🔴 abierta |
| `A-ENT-01` | Herencia Turista VIP: alcance y doble cobro | 🔴 abierta |
| `M-ADDON-01` | Addon sobre ficha despublicada: ¿congela, libera, reembolsa? | 🔴 abierta |
| `M-PROMO-02` | ¿Cupo total por promo code? | 🔴 abierta |
| `C-SUB-01` | Grace de 10 días: ¿constante o configurable? | 🔴 abierta |
| `E-SUB-03` | ¿Se puede hacer upgrade estando en grace? | 🔴 abierta |
| `E-TRIAL-01` | ¿Se devuelve el trial si la ficha se rechaza tras publicarse? | 🔴 abierta |
| `R-TRIAL-01` | ¿El trial regala los entitlements con costo por uso? | 🔴 abierta |
| `O-METH-02` | ¿Se acepta el criterio de 4 puntos para KEEP vs REWRITE? | 🔴 abierta |

## Decisiones técnicas a resolver en FASE 2

No necesitan al owner. Se listan para que no se pierdan: son huecos reales del PDR que la
Master Spec tiene que cerrar, no cosas que alguien improvise al implementar.

`M-ARCH-01` cacheo e invalidación · `M-ARCH-02` glosario de estados · `M-ARCH-03` retiro de
planes · `M-SUB-01` estados faltantes · `M-SUB-02` cola de cambios programados ·
`M-SUB-03` vertical discontinuada · `M-MP-01` moneda e impuestos · `M-MP-02` checkout
pendiente · `M-ENT-01` `aggregationStrategy` · `M-ENT-02` enforcement transversal ·
`M-ENT-03` scope global de entitlements · `M-AUTH-01` checks faltantes · `M-AUTH-02` actor
administrativo · `M-DATA-01` qué es dato eliminable · `M-MAIL-01` huso horario ·
`M-MAIL-02` idempotencia de envío · `M-MAIL-03` jerarquía de supresión · `M-CONC-01`
idempotencia de checkout · `M-CONC-02` no-retroceso de estado · `M-ADMIN-01` catálogo de
acciones · `M-OBS-01` correlación punta a punta · `M-MIG-01` trial ya consumido ·
`M-PROMO-01` promo activa ante cambio de plan.

---

## Cerradas

_(ninguna todavía)_

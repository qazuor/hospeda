---
title: Decisiones abiertas
linear: HOS-1352
statusSource: linear
created: 2026-09-15
updated: 2026-09-15
status: CURRENT
---

# Decisiones abiertas

Todo lo que el [PDR](./00-PDR.md) no define y hay que definir. Mientras un ítem esté abierto,
**nadie decide por su cuenta**: ni un agente, ni una implementación, ni un default silencioso.

Cuando una se cierra: se crea su `DEC-*` en [`01-decision-log.md`](./01-decision-log.md) y se
marca acá como cerrada con el ID de la decisión. **No se borra la fila** — el histórico de qué
estuvo abierto es parte del registro.

> **Estado al 2026-09-15**: el owner cerró **36 decisiones** en una sesión.
> Queda **1 bloqueante** condicionada a FASE 1C, **3 dependientes de MP**, y
> **23 huecos técnicos** que resuelve la Master Spec sin intervención del owner.

## Gate de FASE 5

`O-METH-02` — **el criterio para clasificar KEEP / ADAPT / REWRITE se define al empezar
FASE 5** (`DEC-METH-005`), con el inventario de 1B terminado a la vista.

**No se clasifica ninguna pieza antes de haberlo definido.** Empezar a clasificar "mientras
tanto" es elegir no tener criterio, sin decirlo. Sea cual sea el resultado, toda clasificación
lleva su argumento escrito.

---

## Bloqueantes de FASE 2

| ID | Pregunta | Estado |
|---|---|---|
| `BD-ARCH-01` | ¿Planes mutables o versionados? | ✅ `DEC-ARCH-001` — híbrido: se versiona lo que tiene efecto |
| `BD-TRIAL-01` | Derivación del Trial Plan: ¿live o snapshot? | ✅ `DEC-TRIAL-001` — trinquete: en vivo, nunca empeora |
| `C-TRIAL-01` | "1 ficha en trial" vs "hereda limits de Basic" | ✅ `DEC-TRIAL-002` — overrides declarados en DB por vertical |
| `BD-SUB-02` | ¿Qué es upgrade con dos ejes? | ✅ `DEC-SUB-001` — la regla de la industria |
| `BD-MP-04` | ¿Existen addons recurrentes? | 🟡 **`DEC-ADDON-001` — condicionada a FASE 1C** |
| `BD-MIG-01` | ¿Qué se le promete al cliente que hoy paga? | ✅ `DEC-MIG-001` — coordinación manual de las 5 |
| `C-TRIAL-02` | ¿Partner tiene trial? | ✅ `DEC-TRIAL-003` — configurable por plan, apagado hoy |

## Dependientes de FASE 1C

No las decide el owner: las decide el experimento. **No se pueden cerrar mientras su fila de
[`06-mp-validation-matrix.md`](./06-mp-validation-matrix.md) diga `UNKNOWN`** (PDR §61).

| ID | Pregunta | Estado |
|---|---|---|
| `BD-MP-01` | Mecanismo de pausa: ¿nativa, recrear, o crédito? | 🟡 pendiente de 1C (filas `PA-1`…`PA-7`) |
| `BD-MP-02` | Cortesía temporal sobre una suscripción viva | 🟡 pendiente de 1C (filas `CO-1`…`CO-3`) |
| `BD-MP-03` | Cambios de precio sobre suscripciones vigentes | 🟡 pendiente de 1C (filas `PR-1`…`PR-3`) |
| `BD-MP-04` | Addons recurrentes | 🟡 pendiente de 1C (filas `AD-1`, `AD-2`) |
| `DEC-SUB-001` (plan B) | ¿MP permite correr la primera fecha de cobro? | 🟡 si no, el cambio de ciclo espera a la renovación |
| `DEC-LEGAL-001` | Revocación con devolución total | 🟡 requiere poder reembolsar |

## Decisiones del owner — cerradas

| ID | Pregunta | Decisión |
|---|---|---|
| `BD-TRIAL-02` | Señal de identidad para el trial de por vida | ✅ `DEC-TRIAL-004` — email normalizado bloquea, el resto observa |
| `M-TRIAL-01` | Estado pre-trial | ✅ `DEC-TRIAL-005` — borradores ilimitados, archivado por inactividad |
| `R-TRIAL-01` | Entitlements caros en trial | ✅ `DEC-ENT-001` — todos, con cuota reducida en los medidos |
| `E-TRIAL-01` | Rechazo de moderación tras publicar | ✅ `DEC-TRIAL-006` — el trial arranca cuando la ficha queda visible |
| `E-TRIAL-02` | Publicar y despublicar enseguida | ✅ `DEC-TRIAL-006` — el trial sigue corriendo |
| `M-TRIAL-02` | Disparador del trial de Turista | ✅ `DEC-TRIAL-007` — declarado en DB; `vertical.activated` |
| `OD-TRIAL-01` | Trial con pausa y cortesía | ✅ `DEC-TRIAL-008` — no se pausa, extensiones sin techo |
| `M-TRIAL-03` | Superposición de campañas de recuperación | ✅ `DEC-MAIL-001` — paralelas, sin control |
| `C-SUB-01` | Grace: ¿constante o configurable? | ✅ `DEC-SUB-002` — en DB, default 10, por plan |
| `E-SUB-03` | Cambiar de plan en grace | ✅ `DEC-SUB-003` — permitido, es el camino de recuperación |
| `OD-SUB-01` | Ventana de límites de pausa | ✅ `DEC-SUB-004` — por suscripción |
| `A-ENT-01` | Alcance de la herencia Turista VIP | ✅ `DEC-ENT-002` — entitlements y limits, no puede comprar VIP |
| `A-ENT-01` (b) | Qué pasa con un VIP previo pago | ✅ `DEC-ENT-003` — se cancela ya, sin reembolso, con aviso previo |
| `A-ENT-02` | Guest vs turista en el chat de IA | ✅ `DEC-ENT-005` — el guest no tiene chat |
| `OD-ENT-01` | Modelo de cuotas de consumo | ✅ `DEC-ENT-004` — mensuales, independientes del ciclo, sin arrastre |
| `A-ADDON-01` | Taxonomía de addons | ✅ `DEC-ADDON-002` — dos ejes: `billingKind` × `grantDuration` |
| `C-ADDON-01` | Desde cuándo se pueden comprar addons | ✅ `DEC-ADDON-003` — sólo con suscripción `ACTIVE` confirmada |
| `M-ADDON-01` | Addon sobre ficha despublicada | ✅ `DEC-ADDON-004` — el reloj sigue corriendo |
| `E-ADDON-01` | Addon sobre ficha borrada | ✅ `DEC-ADDON-005` — se pierde con la ficha |
| `A-PROMO-01` | Orden de aplicación de promos apilables | ✅ `DEC-PROMO-001` — porcentajes, después fijos, con piso |
| `M-PROMO-02` | Cupo global de un promo code | ✅ `DEC-PROMO-002` — cupo total + ventana de validez |
| `OD-PROMO-01` | Scope "todas las verticales futuras" | ✅ `DEC-PROMO-003` — permitido sin restricción |
| `M-GRANT-01` | Free Forever y el dinero ya cobrado | ✅ `DEC-GRANT-001` — cancela ya sin reembolso |
| `A-AUTH-01` | ¿El rol se revoca al suspender? | ✅ `DEC-AUTH-001` — el rol persiste, el acceso se computa |
| `M-LEGAL-01` | Botón de baja y revocación de 10 días | ✅ `DEC-LEGAL-001` — los dos, desde el diseño |
| `O-LEGAL-01` | Comprobante no fiscal hasta ARCA | ✅ `DEC-LEGAL-002` — confirmado, sin fecha de revisión |
| `C-DATA-01` | Retención a los 90 y 180 días | ✅ `DEC-DATA-001` — oculto del público, visible al dueño, dos avisos |
| `M-MP-01` | Moneda e impuestos | ✅ `DEC-BILL-001` — sólo ARS, precio final con impuestos |
| `OD-ARCH-01` | Jerarquía entre planes | ✅ `DEC-ARCH-002` — rank explícito, sólo planes vendibles |
| `M-ARCH-03` | Retiro de un plan con clientes vigentes | ✅ `DEC-ARCH-003` — archivado con fecha de fin obligatoria |
| `M-MAIL-04` | El correo que manda MP y no controlamos | ✅ `DEC-MAIL-002` — aviso nuestro antes de toda acción sobre un preapproval |
| `O-METH-02` | Criterio KEEP vs REWRITE | 🔴 **reabierta** — `DEC-METH-005`: se define al empezar FASE 5, y es su **gate de entrada** |

## Huecos técnicos — los resuelve la Master Spec

No necesitan al owner. Se listan para que no se pierdan: son huecos reales del PDR que FASE 2
tiene que cerrar, no cosas que alguien improvise al implementar.

`M-ARCH-01` cacheo e invalidación · `M-ARCH-02` glosario de estados · `M-SUB-01` estados
faltantes (`NONE`, `PENDING_AUTHORIZATION`, `ENDED`, y separar los dos `SUSPENDED`) ·
`M-SUB-02` cola de cambios programados · `M-SUB-03` vertical discontinuada · `E-SUB-01` pausa
más cancelación programada · `E-SUB-02` pausar en grace · `E-SUB-04` downgrade programado con
cambio de precio · `M-MP-02` checkout pendiente · `M-ENT-01` `aggregationStrategy` por limit ·
`M-ENT-02` enforcement transversal · `M-ENT-03` scope global de entitlements · `M-PROMO-01`
promo activa ante cambio de plan · `E-PROMO-01` `TRIAL_EXTENSION` el día del vencimiento ·
`E-ADDON-02` addon a $0 bajo Free Forever · `M-AUTH-01` checks faltantes (estado de ficha y de
usuario) · `M-AUTH-02` actor administrativo · `M-DATA-01` qué es dato eliminable ·
`M-MAIL-01` huso horario · `M-MAIL-02` idempotencia de envío · `M-MAIL-03` jerarquía de
supresión · `E-MAIL-01` schedule que cambia tras dispararse · `M-CONC-01` idempotencia de
checkout · `M-CONC-02` no-retroceso de estado · `E-CONC-01` los seis casos de carrera ·
`M-ADMIN-01` catálogo de acciones administrativas · `M-OBS-01` correlación punta a punta ·
`M-MIG-01` trial ya consumido bajo reglas viejas.

## Para revisar más adelante

Decisiones tomadas cuyo riesgo está declarado y acotado hoy, pero que conviene volver a mirar
cuando cambien las condiciones:

| Decisión | Cuándo revisarla |
|---|---|
| `DEC-ENT-003` · `DEC-GRANT-001` — cancelar sin reembolso | El día que exista un ciclo anual: hoy se retiene un mes parcial como máximo, entonces serían hasta once meses |
| `DEC-MAIL-001` — campañas sin control de superposición | Cuando haya más de una vertical con contenido real |
| `DEC-SUB-004` — ventana de pausa por suscripción | Si se detecta que alguien cancela y re-suscribe para resetear el contador |
| `DEC-PROMO-003` — scope "futuras" sin restricción | Al crear cada vertical nueva: hay que listar qué grants la alcanzan automáticamente |

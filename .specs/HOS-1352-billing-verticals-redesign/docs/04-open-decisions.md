---
title: Decisiones abiertas
linear: HOS-1352
statusSource: linear
created: 2026-09-15
updated: 2026-09-15
status: CURRENT
---

# Decisiones abiertas

Todo lo que el [PDR](./00-PDR.md) no define y hay que definir, más todo lo que define de forma
contradictoria o ambigua.

**Mientras un ítem esté abierto, nadie decide por su cuenta**: ni un agente, ni una
implementación, ni un default silencioso. §67: *"No completar silenciosamente ningún hueco."*

Cuando una se cierra: se crea su `DEC-*` en [`01-decision-log.md`](./01-decision-log.md) y se
marca acá como cerrada con el ID de la decisión. **No se borra la fila** — el histórico de qué
estuvo abierto es parte del registro.

Todos los IDs salen de [`05-phase-1a-domain-analysis.md`](./05-phase-1a-domain-analysis.md).

> **Estado al 2026-09-15**: FASE 1A entregada y **completamente respondida**. 106 hallazgos,
> **29 decisiones registradas**, **0 de las 25 preguntas de FASE 1A abiertas**.
>
> **Pero FASE 1C abrió una pregunta nueva para el owner**: `BD-MP-04`. Sus filas están medidas
> y aun así le sobrevivió una elección de diseño que la medición no toma. Está abajo, con su
> cuadro comparativo y una recomendación.
>
> Lo que frena FASE 2 son **2** bloqueantes que decide el experimento (`BD-MP-01` pausa,
> `BD-MP-02` cortesía). `BD-MP-03` la cerró `DEC-MP-001`.

---

## Quién decide qué

Tres grupos, y no se mezclan:

| Grupo | Quién decide | Cuántos | Cuándo |
|---|---|---|---|
| **Bloqueantes de FASE 2 que decide el owner** | owner | **8** | ✅ cerradas |
| **Bloqueantes de FASE 2 que decide el experimento** | FASE 1C | **4** | 1 cerrada (`DEC-MP-001`) · **2** esperan la matriz · **1 volvió al owner** (`BD-MP-04`) |
| **No bloqueantes que decide el owner** | owner | **19** | ✅ cerradas |
| **Huecos técnicos** | la Master Spec (FASE 2) | **~70** | sin intervención del owner |

Los 12 bloqueantes son los que frenan FASE 2 (§0: *"Toda cuestión que pueda cambiar
significativamente la arquitectura: `BLOCKING DECISION`"*).

**FASE 2 sigue bloqueada**, pero por **2** de las 4 que decide el experimento, no por las
cuatro: FASE 1C ya cerró las filas de `BD-MP-03` y `BD-MP-04`. Ninguna de las otras dos se
puede cerrar mientras su fila de la matriz diga `UNKNOWN` (§61), y al 2026-09-15 **26 de las
57 filas** lo dicen.

---

## Bloqueantes de FASE 2 — las decide el owner

Corresponden a las preguntas **1 a 8** de
[`05-phase-1a-domain-analysis.md`](./05-phase-1a-domain-analysis.md) §16.

| # | ID | Pregunta | Estado |
|---|---|---|---|
| 1 | `BD-ARCH-01` | ¿Los planes son mutables, o versionados con las suscripciones ancladas? | ✅ `DEC-ARCH-001` — híbrido: se versiona lo que tiene efecto |
| 2 | `BD-ARCH-02` | ¿Cómo se ordenan los planes para computar "el más premium" y "el más básico"? | ✅ `DEC-ARCH-002` — rank explícito, sólo los vendibles |
| 3 | `C-TRIAL-01` | El "1 ficha en trial" (§10.5) vs heredar los limits de Basic (§10.3) | ✅ `DEC-TRIAL-001` — overrides declarados en DB, por vertical |
| 4 | `BD-TRIAL-01` | La derivación del Trial Plan, ¿en vivo o congelada al arrancar? | ✅ `DEC-TRIAL-002` — trinquete: en vivo, nunca empeora |
| 5 | `BD-SUB-01` | Las seis celdas sin política de la matriz tier × ciclo | ✅ `DEC-SUB-001`, **reemplazada por `DEC-SUB-005`** — misma política, se ejecuta cancelando y recreando |
| 6 | `C-PARTNER-01` | ¿Partner tiene trial, dentro de un alta administrada? | ✅ `DEC-TRIAL-003` — configurable por plan, en cero hoy |
| 7 | `BD-MIG-01` | ¿Qué se le promete a quien hoy está pagando? | ✅ `DEC-MIG-001` — coordinación manual de las 5, cero código |
| 8 | `BD-TRIAL-02` | ¿Qué señal define "la misma identidad" para el trial de por vida? | ✅ `DEC-TRIAL-004` — el email normalizado bloquea, el resto observa |

`C-TRIAL-01` y `C-PARTNER-01` son contradicciones del PDR **y además** bloqueantes: aparecen en
las dos listas a propósito, no por doble conteo.

## Bloqueantes de FASE 2 — las decide el experimento, no el owner

**No se pueden cerrar mientras su fila de [`06-mp-validation-matrix.md`](./06-mp-validation-matrix.md)
diga `UNKNOWN`** (§61 y regla 3 del Decision Log). Al 2026-09-15, **26 de las 57** lo dicen —
y **`BD-MP-03` y `BD-MP-04` ya no**.

| ID | Pregunta | Filas que la desbloquean | Estado |
|---|---|---|---|
| `BD-MP-01` | Mecanismo de pausa: ¿nativa, recrear, o crédito interno? | `PS-1`…`PS-6`, `EX-11` | 🟡 espera 1C, **pero `EX-11` ya midió dos restricciones duras**: estando pausada el proveedor **rechaza toda modificación** (con control: reanudada, el mismo cambio entra), y **cancelar sí se puede**. Los efectos sobre el cobro los responde el reloj el 2026-09-16 |
| `BD-MP-02` | Cortesía temporal sobre una suscripción viva | `CT-1`…`CT-3`, `PC-2`, `RF-1` | 🟡 espera 1C |
| `BD-MP-03` | Cambio de precio sobre suscripciones vigentes | `PC-1`, `PC-2`, `PC-3` | ✅ **`DEC-MP-001`** — se muta el monto del preapproval; el §29 se cumple del lado nuestro |
| `BD-MP-04` | ¿Existen addons recurrentes? | `EX-5`, `EX-6` | 🔴 **la medición no alcanzó: sobrevivió una elección — ver abajo** |

Además, `M-LEGAL-01` **queda condicionada** a la matriz aunque no sea bloqueante de FASE 2:
depende de `RF-1`/`RF-3` para saber si se puede reembolsar. (`BD-SUB-01` ya no: `EX-4`, `EX-7`
y `EX-8` están medidas y `DEC-SUB-005` la cerró.)

### `BD-MP-04` — la medición cerró la pregunta técnica y dejó una elección abierta

Estaba clasificada como *"la decide el experimento, no el owner"*. **Esa clasificación resultó
incorrecta**, y conviene decirlo en vez de forzar una decisión que la medición no toma.

Lo que el experimento sí cerró:

- `EX-5` **`NOT_SUPPORTED`** — **una autorización cubre un solo monto**. `auto_recurring` como
  array da `400`; el campo `items` devuelve `201` y **se descarta en silencio**. Un addon
  recurrente **no puede ser una línea aparte dentro de la suscripción del plan**.
- `EX-6` **`VERIFIED`** — **dos suscripciones autorizadas del mismo pagador conviven** sin
  conflicto.
- `PC-1`/`PC-3` **`VERIFIED`** — el monto de una autorizada se muta sin re-consentimiento.

Y el §38 no deja lugar a dudas de que hacen falta: *"Tipos: one-time; **recurrent**"*.

Con eso, **quedan dos mecanismos posibles y los dos funcionan**. Por eso la elección no la
decide la matriz:

| | (1) Subir el monto de la suscripción del plan | (2) Un preapproval aparte por addon recurrente |
|---|---|---|
| **Se apoya en** | `PC-1`, `PC-3` | `EX-6` |
| **Qué ve el cliente en su tarjeta** | **un solo importe**, sin desglose | un cargo por el plan y otro por cada addon |
| **Contratar un addon** | no le pide nada: es un `PUT` | exige **autorizar de nuevo**, con código de seguridad (`EX-9`) |
| **Ciclo del addon** | **obligado al del plan**: un addon mensual sobre un plan anual no entra | **propio**, independiente del plan |
| **Que venza el addon** | otra mutación del monto, con el riesgo del §0 en cada una | cancelar su preapproval, sin tocar el plan |
| **Conciliar** | el importe cobrado **no dice** qué lo compone: hay que derivarlo del estado local | cada cobro se explica solo |
| **Si la mutación falla en silencio** | se cobra de menos **o de más** sin que nadie lo note | no aplica |

**Recomendación: (2)**, y el motivo no es el desglose sino el §40: el PDR define addons con
scope `LISTING`, `VERTICAL_SUBSCRIPTION`, `USER` y `GLOBAL`, y el §41 exige poder cancelar un
addon huérfano **sin** tocar lo demás. Con (1) cada alta y cada baja de addon es una mutación
del monto del plan — el punto exacto donde este proveedor ya demostró aceptar sin aplicar — y
un addon con ciclo propio directamente no existe.

El costo de (2) está medido y es real: **contratar un addon recurrente le pide al cliente el
código de seguridad**, igual que `DEC-SUB-005`.

**Decide el owner.** Ninguna medición pendiente cambia este cuadro.

## No bloqueantes — las decide el owner

Corresponden a las preguntas **9 a 25** del §16.

| # | ID | Pregunta | Estado |
|---|---|---|---|
| 9 | `M-TRIAL-01` | ¿Turista tiene trial? ¿Qué lo dispara? | ✅ `DEC-TRIAL-006` — sí; el botón `Empezar` del §47 |
| 10 | `M-TRIAL-02` | Qué puede hacer quien entró y todavía no publicó | ✅ `DEC-TRIAL-007` — borradores ilimitados, archivado por inactividad |
| 11 | `A-TRIAL-01` | ¿La publicación de una ficha es inmediata o mediada? | ✅ `DEC-TRIAL-005` — inmediata: publicar es quedar visible |
| 12 | `R-TRIAL-01` · `OD-ENT-01` | ¿El trial regala los entitlements que cuestan por uso? | ✅ `DEC-ENT-001` — todas las funciones, con cuota propia de trial |
| 12b | `OD-ENT-01` | ¿Cuándo se resetea una cuota de consumo? | ✅ `DEC-ENT-002` — mensual siempre, sin arrastre |
| 13 | `A-ENT-01` | Alcance de la herencia Turista VIP | ✅ `DEC-ENT-003` — entitlements y limits; no puede comprar VIP |
| 13b | `A-ENT-01` (b) | Qué pasa con un VIP previo ya pago | ✅ `DEC-ENT-004` — se cancela ya, sin reembolso |
| 14 | `C-SUB-01` | ¿El grace de 10 días es constante o configurable? | ✅ `DEC-SUB-002` — en DB por plan, default 10 |
| 15 | `E-SUB-03` | ¿Se puede cambiar de plan estando en grace? | ✅ `DEC-SUB-003` — permitido, es el camino de recuperación |
| 16 | `OD-SUB-01` | ¿La ventana de pausa se cuenta por user+vertical o por suscripción? | ✅ `DEC-SUB-004` — por user + vertical |
| 17 | `E-ADDON-01` · `E-ADDON-02` | Addon sobre ficha borrada o despublicada | ✅ `DEC-ADDON-001` — se pierde con la ficha; el reloj no se congela |
| 18 | `M-PROMO-01` | ¿Hay cupo total y ventana de validez por promo code? | ✅ `DEC-PROMO-001` — cupo total + ventana |
| 19 | `OD-PROMO-01` | El scope "todas las verticales futuras", ¿sin tope? | ✅ `DEC-PROMO-002` — permitido sin restricción |
| 20 | `M-GRANT-01` | Free Forever y el dinero ya cobrado; qué pasa al revocar | ✅ `DEC-GRANT-001` — corta ya sin reembolso; revocar no restaura |
| 21 | `A-GRANT-01` | ¿Quién puede otorgar una cortesía temporal? | ✅ `DEC-GRANT-002` — sólo `SUPER_ADMIN`, igual que Free Forever |
| 22 | `C-DATA-01` | Retención a los 90 y 180 días, y los avisos previos | ✅ `DEC-DATA-001` — oculto del público, visible al dueño, dos avisos |
| 23 | `O-LEGAL-01` | Comprobante no fiscal hasta ARCA, ¿con fecha de revisión? | ✅ `DEC-LEGAL-001` — confirmado, sin fecha ni disparador |
| 24 | `O-METH-02` | ¿Se autorizan conteos read-only de producción durante 1A? | ✅ `DEC-METH-002` — sí, con fecha y método |
| 25 | `O-METH-03` | ¿El criterio de FASE 5 se define al empezar FASE 5? | ✅ `DEC-METH-003` — sí, y es su gate de entrada |

---

## Gate de FASE 5 — decidido (`DEC-METH-003`)

**El criterio para clasificar `KEEP` / `ADAPT` / `REWRITE` se define al empezar FASE 5**, con
el inventario real de 1B a la vista, y **es su condición de entrada**.

**No se clasifica ninguna pieza antes de haberlo definido.** Empezar a clasificar "mientras
tanto" equivale a elegir no tener criterio, sin decirlo.

Y una trampa a evitar cuando se defina, sea cual sea: un criterio del tipo *"no nombra ninguna
vertical en su lógica"* manda **todo el Eje 2 a `REWRITE` por definición**, porque §8 define el
Eje 2 como comportamiento específico de vertical. El criterio tiene que decir explícitamente
cómo trata al Eje 2.

---

## Huecos técnicos — los resuelve la Master Spec

No necesitan al owner. Se listan para que no se pierdan: son huecos reales del PDR que FASE 2
tiene que cerrar, no cosas que alguien improvise al implementar.

**Arquitectura** · `C-ARCH-01` §9 inaplicable como está escrito · `S-ARCH-01` separar catálogo
de claves de configuración comercial · `O-ARCH-01` falta criterio para distinguir Eje 1 de
Eje 2 · `S-ARCH-02` lista cerrada de decisiones por vertical · `M-ARCH-01` glosario de estados ·
`M-ARCH-02` caché e invalidación · `OD-ARCH-01` retiro de un plan del catálogo

**Trial** · ~~`E-TRIAL-01`~~ **disuelto por `DEC-TRIAL-005`** (sin revisión previa no hay
rechazo posterior) · **`E-TRIAL-04` baja reactiva de una ficha publicada** (nuevo, residuo de
`DEC-TRIAL-005`) · `E-TRIAL-02` publicar y
despublicar enseguida · `A-TRIAL-02` "solamente en trial" para un usuario multi-vertical ·
`S-TRIAL-01` cuota de trial por entitlement medido · `OD-TRIAL-01` techo de extensiones ·
`M-TRIAL-03` anti-spam de la campaña de recuperación · `E-TRIAL-03` la campaña se dispara y
después el trial se extiende

**Suscripción** · `M-SUB-01` estados faltantes · `A-SUB-01` qué es una "main subscription" ·
`A-SUB-02` dónde se habilita la pausa · **`E-SUB-05` compensar días sobre una suscripción en deuda** (nuevo, residuo de `DEC-SUB-003`) · **`E-SUB-06` un cambio de precio programado que cae sobre una suscripción PAUSADA** (nuevo, residuo de `DEC-MP-001` + `EX-11`: estando pausada el proveedor **rechaza toda modificación**, así que el cambio no se puede aplicar en su fecha efectiva y hay que decidir si se encola hasta la reanudación, si se bloquea la pausa mientras hay un cambio pendiente, o si el §29 se cumple de otro modo) · `M-SUB-02` cola de cambios programados · `E-SUB-01`
precio que cambia entre programar y ejecutar · `E-SUB-02` pausa más cancelación programada ·
`R-SUB-01` el servicio completo durante el grace · `M-SUB-03` vertical discontinuada

**Mercado Pago** · **`R-MP-01` la API de Payments se descontinúa** (nuevo, 2026-09-15): el panel avisa *"Esta API será descontinuada pronto"* sobre `API de Payments` y la documentación **no lo formaliza** —las docs de Suscripciones siguen indicando `/v1/payments`, y las de Orders la presentan como opción paralela, sin fecha—. **Ninguna de las 39 filas medidas depende de `POST /v1/payments`**, y `EX-16` midió que la conciliación entera se puede hacer con `/authorized_payments`, de la familia de suscripciones. Quedan sobre la familia que se retira **sólo** el detalle fino del pago y **los reembolsos**. Tres preguntas para soporte de MP, que no se pueden medir porque son sobre el futuro del proveedor: si alcanza también a las lecturas, cuándo, y **cómo se reembolsa un cobro originado por un `preapproval`** si se retira · `MP-01` los cuatro ciclos · `M-MP-01` moneda e impuestos · `M-MP-02`
checkout pendiente · `S-MP-01` capacidades por método de pago · `S-MP-02` caducidad de un
resultado verificado · `S-MP-03` sondas reproducibles · `M-MP-03` los seis huecos del §60

**Entitlements y limits** · **`E-ENT-01` suspensión y beneficios de turista heredados** (nuevo, residuo de `DEC-ENT-003`) · `M-ENT-01` estrategia de agregación por limit · `M-ENT-02`
enforcement transversal de excedentes · `A-ENT-02` qué tiene el visitante sin cuenta ·
`M-ENT-03` scope global de entitlements

**Addons** · `A-ADDON-01` dos ejes en vez de uno · `A-ADDON-02` qué es una suscripción
"válida" · `E-ADDON-03` addon a costo cero bajo Free Forever · `E-ADDON-04` vence un addon que
sostenía capacidad en uso

**Promos y grants** · `A-PROMO-01` orden de aplicación y piso · `M-PROMO-02` promo en curso
ante un cambio de plan · `E-PROMO-01` extensión aplicada el día del vencimiento · `A-PROMO-02`
combinación de promo, cortesía y grant

**Autorización** · `M-AUTH-01` faltan el estado del recurso y el de la persona · `M-AUTH-02`
actor administrativo · `A-AUTH-01` el rol al perder el acceso · `S-AUTH-01` scope de vertical
estructural, no un chequeo

**Datos y legal** · ~~`R-DATA-01`~~ **resuelto por `DEC-DATA-001`** (los dos avisos tapan el silencio) · `M-DATA-01` qué es dato
eliminable · `M-LEGAL-01` baja online y derecho de revocación · `M-LEGAL-02` finalidad de las
señales de identidad · `M-LEGAL-03` política de notificación de aumento

**Emails** · `M-MAIL-01` huso horario como invariante · `M-MAIL-02` deduplicación del envío ·
`M-MAIL-03` jerarquía de supresión y transaccional vs comercial · `M-MAIL-04` qué comunica el
proveedor por su cuenta

**Concurrencia** · `M-CONC-01` idempotencia del lado nuestro · `M-CONC-02` no-retroceso de
estado · `E-CONC-01` los seis cruces del §52 · `M-CONC-03` qué hace que un pago tardío sea
seguro

**Admin y observabilidad** · `M-ADMIN-01` catálogo de acciones administrativas · `R-OBS-01` un
correo por evento apaga el canal · `S-OBS-01` dashboard más correo agregado · `M-OBS-01`
identificador de correlación · `M-AUDIT-01` qué es un evento auditable, y si es inmutable

**Partner** · `A-PARTNER-01` qué cuentan los limits de Partner · `M-PARTNER-01` ciclo de vida
de la postulación

**Migración** · `O-MIG-01` §56 apoya su conclusión en un número que no da · `R-MIG-01`
convivencia durante el rewrite · `M-MIG-01` criterio de corte del trial ya consumido

**Metodología** · `O-METH-01` "cerrar todas las decisiones funcionales" no cierra en 1A ·
`S-METH-01` declarar cuándo una decisión se considera caduca

---

## Los experimentos que movían plata — EJECUTADOS el 2026-09-15

El owner los autorizó y se corrieron **contra producción**. Los cuatro pagos
reembolsables resultaron ser todos del **propio owner** (`qazuor@gmail.com`,
pagador `5860436`), verificado ANTES de tocar nada, así que la plata fue de su
cuenta vendedora a su propia tarjeta. La comisión ya estaba pagada y no vuelve
en ningún escenario, así que el costo adicional fue cero.

| Experimento | Resultado |
|---|---|
| Mínimo exacto de reembolso | **NO HAY MÍNIMO.** ARS 5 entró sobre pagos de 5.000 y 7.500. La conclusión anterior era un diagnóstico equivocado; ver `RF-2` y `RF-8` |
| Idempotencia del reembolso | **SÍ es idempotente**: misma clave → `200` con cuerpo vacío y ningún reembolso nuevo (`RF-6`) |
| Parciales acumulativos | **Funcionan**, validan contra el **saldo** (no contra el total) y al completarse el pago pasa a `refunded` solo |
| ¿El header era obligatorio hace unas horas? | **La pregunta no existía**: la sonda 11 sí manda el header. Era una suposición mía |

Y dos que estaban dadas por imposibles y no lo eran:

| | |
|---|---|
| **¿Un reembolso emite webhook?** | Estaba marcado **bloqueado** porque el receptor propio está atado a la app de prueba. El razonamiento tenía un agujero: **la API de producción es un receptor y sus logs se leen**. Emite **tres notificaciones por reembolso, en dos formatos** (`RF-7`) |
| **Re-medir el sandbox contra producción** | Diez comparaciones, **las diez coinciden**. Lo único que el sandbox falseaba era que **el vendedor de prueba no puede escribir sobre `/v1/payments`** |

---

## Lo que le queda al owner

| Qué | Para qué |
|---|---|
| ⚠️ **Un error VIVO en producción, encontrado de paso** | Los webhooks `subscription_authorized_payment` / `invoice.updated` de al menos dos preapprovals (`74eea70d…` y `7a9e6a99…`) fallan con `SubscriptionNotResolvedError` (HOS-276), la API responde **`500`** y los encola para reintentar hasta 5 veces. **Alcanza a suscripciones reales, no sólo a las de prueba**, y es **anterior a esta sesión** (aparece disparado por el cron `webhook-retry`). Además, `invoice.updated` cae en `DEAD-LETTER: unrecognized MercadoPago event type`. **Queda registrado y NO se tocó**: el §4 prohíbe tocar código productivo, y es justo lo que el rediseño tiene que resolver de raíz |
| 📬 **`EX-3`: mirá tu casilla** | El 2026-09-15 22:38 se creó en producción un preapproval `pending` con **tu** dirección como pagador, y se canceló 45 s después. Si Mercado Pago te mandó algún correo por eso —por la suscripción pendiente o por su cancelación—, **ése es el dato que `EX-3` necesita** y es la única vía que quedó viva: en sandbox la casilla del comprador de prueba no existe |
| Autorizar (o no) lo que **sigue** necesitando una tarjeta real | `EX-4` (cambiar el ciclo), `EX-12` (reusar un token), `UP-*`, `DW-*`, `PS-*`: exigen una suscripción **autorizada**, y autorizar en producción exige una tarjeta real y un cobro real. Hoy están medidas sólo en sandbox |

---

## Para revisar más adelante

Decisiones tomadas cuyo riesgo está declarado y acotado **hoy**, pero que hay que volver a
mirar cuando cambie la condición que las hacía tolerables. No son errores: son decisiones del
owner con su costo anotado.

| Decisión | Cuándo revisarla |
|---|---|
| `DEC-ENT-004` y `DEC-GRANT-001` — cancelar sin reembolso | **El día que exista un ciclo anual.** Hoy se retiene un mes parcial como máximo porque todas las suscripciones vivas son mensuales; con anual serían hasta once meses |
| `DEC-TRIAL-004` — sólo el email bloquea la identidad | Cuando la base crezca dos órdenes de magnitud. Hoy se optimiza contra perder clientes reales porque son 22 |
| `DEC-SUB-005` — cancelar y recrear pide el código de seguridad | Si la fricción del CVV resulta costar conversión. La alternativa medida es esperar a la renovación, que es peor para el cliente |
| `DEC-TRIAL-003` — Partner con el trial en cero | Si alguna vez se pone en distinto de cero: hay que declarar su evento de activación (§10.4) |
| `DEC-PROMO-002` — scope "futuras" sin restricción | **Al crear cada vertical nueva.** Hay que listar qué concesiones la alcanzan automáticamente, con su costo estimado |
| `DEC-GRANT-002` — cortesía sólo por `SUPER_ADMIN` | Si aparece que se comparte la cuenta de `SUPER_ADMIN` para compensar clientes. Ese síntoma pide un permiso acotado, no una cuenta compartida |
| `DEC-LEGAL-001` — comprobante no fiscal | **Sin disparador agendado, por decisión explícita.** El riesgo impositivo crece con cada cobro y nada va a avisar: depende de que alguien lo recuerde |

---

## Índice por categoría (§"Entrega 1A")

| Categoría | Cantidad |
|---|---|
| Contradictions (`C-`) | 5 |
| Ambiguities (`A-`) | 13 |
| Blocking Decisions | 12 (10 `BD-` + `C-TRIAL-01` + `C-PARTNER-01`) |
| Open Decisions (`OD-`) | 5 |
| Edge Cases (`E-`) | 15 |
| Risks (`R-`) | 6 |
| Missing Requirements (`M-`) | 35 |
| Objections (`O-`) | 6 |
| Suggested Improvements (`S-`) | 9 |
| Pending MP Validation | `MP-01` más toda la sección 4 y las 55 filas de la matriz |
| **Total de hallazgos** | **106** (`E-TRIAL-04`, `E-ENT-01`, `E-SUB-05`, `E-SUB-06` y `R-MP-01` agregados el 2026-09-15) |

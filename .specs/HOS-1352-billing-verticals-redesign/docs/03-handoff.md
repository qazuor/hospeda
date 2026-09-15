---
title: Handoff vivo
linear: HOS-1352
statusSource: linear
created: 2026-09-15
updated: 2026-09-15
status: CURRENT
---

# Handoff — estado del programa

> **Si sos un agente o una persona que acaba de entrar a este programa: leé esto entero antes
> de hacer nada, y después leé los documentos en el orden de abajo.**
>
> **No confíes en memoria implícita, ni en engram, ni en ningún `CLAUDE.md`, ni en
> documentación del repo, ni en un sistema de tracking.** El PDR es explícito (§3.5):
> reutilizar conocimiento viejo como si siguiera vigente es una de las causas de que estemos
> acá. Este programa ya tuvo que resetearse una vez por exactamente eso (`DEC-METH-001`).

## Orden de lectura obligatorio (§66)

1. [`00-PDR.md`](./00-PDR.md) — el documento rector del owner. **Inmutable.**
2. [`01-decision-log.md`](./01-decision-log.md) — qué se decidió y por qué.
3. [`02-worklog.md`](./02-worklog.md) — qué se hizo, cronológicamente.
4. **Este archivo** — dónde estamos parados.
5. [`04-open-decisions.md`](./04-open-decisions.md) — qué falta decidir.
6. [`05-phase-1a-domain-analysis.md`](./05-phase-1a-domain-analysis.md) — el análisis de dominio.
7. [`06-mp-validation-matrix.md`](./06-mp-validation-matrix.md) — qué sabemos de Mercado Pago
   (**69 filas: 31 `VERIFIED`, 11 parciales, 7 `NOT_SUPPORTED`, 20 `UNKNOWN`**, recontadas con
   [`contar-filas-de-la-matriz.py`](./contar-filas-de-la-matriz.py), nunca a mano).
8. [`07-facts-inventory.md`](./07-facts-inventory.md) — cuántos clientes reales hay, medido.

---

## Última actualización: 2026-09-15

### Último punto completado

**FASE 0 completa. FASE 1A entregada y COMPLETAMENTE respondida: las 25 preguntas cerradas.
FASE 1C en curso: 49 de 69 filas medidas, EL RELOJ CORRIENDO, y TODO LO MEDIBLE SIN ESPERAR,
MEDIDO — LA MITAD DE ESO CONTRA PRODUCCIÓN.**

**De las 20 filas que siguen abiertas, 16 sólo esperan el reloj.** Las otras cuatro son `WH-5`
(se fuerza con el interruptor del receptor, **pero hacerlo hoy rompe la lectura del reloj de
mañana**), `RC-3`, `RF-3` (necesita un pago de más de 180 días que no existe) y `EX-3`
(**medida como inmedible en sandbox**). O sea: **no queda ningún experimento pendiente que se
pueda correr sin esperar o sin mover plata.**

El programa se reseteó hoy: el único documento heredado es el PDR (`DEC-METH-001`). Todo lo
demás se escribió de cero contra ese texto.

Dos de las cuatro bloqueantes de FASE 2 tienen todas sus filas cerradas, y **terminaron
distinto**: `BD-MP-03` quedó decidida (**`DEC-MP-001`**, se muta el monto del preapproval),
y `BD-MP-04` **no la cerró la medición** — le sobrevivió una elección de diseño y volvió al
owner.

### Estado por fase

| Fase | Estado |
|---|---|
| FASE 0 — bootstrap de documentación | ✅ completa |
| FASE 1A — análisis de dominio | ✅ **cerrada — 25 de 25 preguntas respondidas, 29 decisiones** |
| FASE 1B — discovery del sistema actual | ⛔ bloqueada por `DEC-METH-001`: no se lee código hasta cerrar el diseño |
| FASE 1C — experimentación con Mercado Pago | 🟡 **en curso — 49 de 69 filas medidas · reloj corriendo, leer el 2026-09-16** |
| FASE 2 — Master Spec | ⛔ bloqueada por `BD-MP-01` (pausa) y `BD-MP-02` (cortesía) |
| FASE 3 a 10 | ⬜ no empezadas |

### Próximo paso exacto

**Seguir FASE 1C.** Las 25 preguntas de FASE 1A están respondidas, pero **FASE 1C abrió una**:
`BD-MP-04` (cómo se implementa un addon recurrente) tiene sus filas medidas y aun así **le
sobrevivió una elección de diseño**, planteada con su cuadro y una recomendación en
[`04-open-decisions.md`](./04-open-decisions.md).

**Antes de medir nada más, leer el §0 de
[`mp-probes/RESULTS-2026-09-15.md`](./mp-probes/RESULTS-2026-09-15.md)**: Mercado Pago acepta
cambios que no aplica y responde `2xx`. Cinco casos medidos. **Toda mutación exige relectura y
comparación campo por campo**; ninguna fila de la matriz se marca por el código de estado.

### EL RELOJ ESTÁ CORRIENDO — lo primero que hay que hacer mañana

El 2026-09-15 quedaron **ocho sujetos vivos** de ciclo diario en el sandbox. El
ciclo diario funciona y está verificado por relectura. Lo que sigue sólo
depende de que el proveedor ejecute un ciclo.

> ✅ **El receptor está en modo normal.** Estuvo en `mode=fail` para medir los
> reintentos de `WH-4` y se devolvió a `ok` el 2026-09-15 16:36, verificado con
> un POST de control (`200`). Si alguna vez se vuelve a poner en `--fail`,
> **acordarse de devolverlo**: con el receptor fallando, las renovaciones se
> pierden en reintentos y `RN-1` queda sin medir.

**A partir del 2026-09-16 ~11:30, correr la sonda 06:**

```bash
cd .specs/HOS-1352-billing-verticals-redesign/docs/mp-probes
source ~/.config/hospeda/mp-sandbox-creds.sh && OUT_DIR=/tmp/mp-probe-05 bash probe-06-leer-el-reloj.sh
```

La primera corrida fija la línea de base y **no concluye nada**; de la segunda en adelante
cada fila se marca contra el **delta entre dos fotos fechadas**.

| slug | id | qué fila decide | cómo quedó al arrancar |
|---|---|---|---|
| `renov-ok` | `930a7596…` | `RN-1` | `authorized`, ARS 2000 |
| `renov-falla3` | `0e678ead…` | `RN-2`, `GR-1..3` | `authorized`, ARS 2000 |
| `pausa-real` | `747cc456…` | `PS-2`/`4`/`5`/`6` | **`paused`** |
| `sin-autorizar` | `bf9b6feb…` | `EX-1` | `pending` |
| `monto-baja` | `5e4c5e5c…` | `DW-1`/`DW-2` | ARS **1000** |
| `monto-sube` | `4f60c31c…` | `UP-1`/`UP-2` | ARS **4000** |
| `cortesia-piso` | `30c03cca…` | `CT-1`/`CT-3` | ARS **15** |
| `cancelada-no-cobra` | `6738c7fb…` | `GT-1` | **`cancelled`**, con cobro anunciado para el 16 |

**Y leer también el receptor de webhooks**, que ahora ve las renovaciones
crudas: es la única forma de medir `RN-1` sin la capa legacy en el medio.

```bash
SINK_URL=https://hos1352-webhook-sink.qazuor.workers.dev bash probe-08-leer-webhooks.sh
```

El manifiesto vive en `/tmp/mp-probe-05/manifiesto.json`, que **no sobrevive a un reinicio**.
Y si se pierde, **se pierde el experimento**: por `RC-1` el `search` de preapprovals ignora
`external_reference` en silencio, así que no habría forma de volver a encontrar estas
suscripciones por nuestra referencia. Por eso hay dos copias:
[`mp-probes/manifiesto-reloj-2026-09-15.json`](./mp-probes/manifiesto-reloj-2026-09-15.json)
en el repo, y `~/.config/hospeda/mp-reloj-manifiesto-2026-09-15.json` fuera de él. Los ids de
suscripción del sandbox no son secretos: son la evidencia del §59.

**Para medir la reanudación de la pausa** (`PS-5`, `PS-6`, que son las que deciden si el §26.4
es implementable), con la pausa ya cumplida y **una sola vez**, porque reanudar no se deshace:

```bash
source ~/.config/hospeda/mp-sandbox-creds.sh && OUT_DIR=/tmp/mp-probe-05 REANUDAR=1 bash probe-06-leer-el-reloj.sh
```

**Una trampa que ya mordió**: si todos los sujetos dicen SIN CAMBIOS pasadas las 24 h, eso no
es un error de la sonda, **es el hallazgo**. Y al revés: un `429 local_rate_limited` **no**
significa que algo esté prohibido, significa que no llegó a evaluarse. La sonda 07 casi
concluye un `NOT_SUPPORTED` inexistente por eso.

### Lo que se midió la tarde del 2026-09-15, sin esperar nada (sondas 14 a 18)

Cinco preguntas que estaban abiertas por falta de experimento, no por falta de tiempo.
Detalle completo en [`mp-probes/RESULTS-2026-09-15.md`](./mp-probes/RESULTS-2026-09-15.md).

| Qué | Resultado | Fila |
|---|---|---|
| ¿La creación de una suscripción es idempotente? | **NO, por ningún mecanismo.** Diez sujetos, diez ids. Ni `external_reference` ni `X-Idempotency-Key` deduplican — el header **se acepta y no hace nada**. **El candado es nuestro o no existe** | **`EX-17`** nueva |
| ¿Se puede cobrar en otra moneda? | **Sólo ARS.** `USD` y `BRL` → `400`. El modelo de datos no necesita moneda | **`EX-18`** nueva |
| ¿Qué filtra el `search`? | **`payer_email` y `status` sí, y se componen; `external_reference` no.** Y un **`status` inválido devuelve `200` con `total: 0`**, que se lee como "este cliente no tiene nada" | `RC-1` completada |
| ¿Existe la casilla del comprador de prueba? | **No, y no puede existir**: MX a `localhost`, dominio parqueado ajeno a MP | `EX-3` — inmedible, con causa |
| ¿Qué error da un reembolso que no corresponde? | **`cause[0].code` distingue**: `2063` estado del pago, `2017` monto. El `message` no alcanza. Y **`X-Idempotency-Key` es obligatorio en `/refunds`** | **`RF-4`**, **`RF-5`** nuevas |

**Dos cosas de método salieron de acá y valen más que las filas:**

1. **La idempotencia de este proveedor es POR ENDPOINT.** El mismo header es decorativo en
   `/preapproval` y obligatorio en `/refunds`. No se puede razonar de uno al otro.
2. **La regla del §0 vale en las dos direcciones, y mordió dos veces esta tarde.** La sonda 18
   midió tres `400` que no eran del negocio sino de un header faltante — leerlos como
   "un pago reembolsado rechaza todo" habría sido acertar por casualidad. Y la sonda 15 casi
   registra un `PARTIALLY_SUPPORTED` inventado para multi-moneda, porque el proveedor
   **valida el monto antes que la moneda** y el mensaje del piso es **ciego a la moneda**: un
   `"Cannot pay an amount lower than $ 15.00"` no dice nada sobre si la moneda era válida.
   Lo que lo resolvió en los dos casos fue **el control que distingue**, no otra hipótesis.

### La tanda de PRODUCCIÓN (sondas 19 a 26) — pedido del owner

*"Ya tuvimos el problema de algo que pensamos que no se podía hacer, y la realidad era que no
andaba en sandbox, pero en producción sí."* Se re-midió contra la cuenta real todo lo que se
podía medir sin cobrarle a nadie.

**La respuesta corta: esta vez el sandbox no mintió.** Diez comparaciones, las diez coinciden
(`EX-17`, `EX-18`, `PC-2` piso y techo, `FR-4`, `EX-5` array e `items`, `CN-1`). Lo único que
el sandbox falseaba se puede nombrar con precisión: **el vendedor de prueba no puede ESCRIBIR
sobre `/v1/payments`** —ni crear un pago ni reembolsar—, y eso fue lo que dejó `RF-1`/`RF-2` en
`UNKNOWN` con un `401` que sólo existe ahí.

**Lo que sí cambió, y mucho:**

| Qué | Antes | Ahora |
|---|---|---|
| El "monto mínimo de reembolso" | *"existe, entre 5 y 50"* | **NO EXISTE.** ARS 5 entra en pagos de 5.000 y 7.500. Cuatro hipótesis murieron; el rechazo `code 2084` quedó **sin explicar**, y lo único probado es que **NO es una propiedad del pago**: el mismo pago rechazó 5 y aceptó 14 (`RF-8`) |
| Idempotencia del reembolso | sin medir | **Es idempotente**: misma clave → `200`, cuerpo vacío, ningún reembolso nuevo (`RF-6`) |
| ¿Un reembolso emite webhook? | **"bloqueado, no se puede ver"** | **Se ve.** La API de producción ES el receptor y sus logs se leen: tres notificaciones por reembolso, en **dos formatos** para el mismo hecho (`RF-7`) |
| El `search` de suscripciones | *"`status` sí filtra"* | **`status=cancelled` devuelve 15 de 69** — un subconjunto plausible, sin señal de que falte nada (`RC-1`). Y el `search` devuelve **menos campos** que el `GET` (`RC-4`) |
| `EX-16` | medido en sandbox | **VERIFIED en producción también** — pero el primer resultado fue un falso negativo perfecto: 0 cobros en las 4 autorizadas porque **ninguna cobró todavía** |

**Escribir en producción tiene un radio de explosión medido, no supuesto**: crear un preapproval
`pending` y cancelarlo produce exactamente **dos webhooks, los dos `200`**, sin encolar
reintentos ni escribir filas. Se midió con UNO antes de crear los siete de la sonda 26.

⚠️ **Y de paso apareció un error VIVO en producción que NO se tocó** (§4): los webhooks
`subscription_authorized_payment` de al menos dos preapprovals fallan con
`SubscriptionNotResolvedError`, la API responde `500` y los encola hasta 5 veces. Es anterior a
esta sesión y alcanza a suscripciones reales. Detalle en
[`04-open-decisions.md`](./04-open-decisions.md).

### Los webhooks ya son observables — qué queda de ese bloque

El receptor propio (sonda 08, un Worker en la cuenta de Cloudflare del owner)
guarda cada POST crudo con **todos** los headers. Con eso se cerraron `WH-2`,
`EX-2`, `EX-13`, `EX-14` y `EX-15`. Para seguir:

```bash
cd .specs/HOS-1352-billing-verticals-redesign/docs/mp-probes
source ~/.config/hospeda/mp-sandbox-creds.sh && ESPERA=90 bash probe-09-disparar-webhooks.sh
SINK_URL=https://hos1352-webhook-sink.qazuor.workers.dev bash probe-08-leer-webhooks.sh
```

- **`WH-4` y `WH-5`** se fuerzan con el interruptor: `probe-08-leer-webhooks.sh --fail`
  hace que el receptor responda `500` y el proveedor reintente. **Acordarse de
  volver con `--ok`.**
- **`EX-13`** ✅ cerrado: `bash probe-10-verificar-firma.sh` reproduce el `v1`.
- **Espaciar las acciones más de 32 s**, que es la demora máxima medida. Con
  menos, la atribución de un evento a una acción es una inferencia, no una
  lectura.
- El Worker se borra al terminar 1C: `wrangler delete --name hos1352-webhook-sink`

### Lo que NO se pudo fabricar, y es un problema abierto

**No se puede provocar un cobro fallido eligiendo una tarjeta mala.** Los dos titulares de
rechazo de las tarjetas de prueba (`FUND` y `OTHE`) **no llegan a crear la suscripción**:
mueren antes con `400 CC_VAL_433`, porque la validación de la tarjeta ocurre primero (`PA-4`).

El único camino que queda es el sujeto `renov-falla3`, que nació sano y tiene el monto
subido. **Si mañana igual cobra bien, `RN-2` y `GR-1..3` necesitan otra idea** — y esa
ausencia de mecanismo es, ella misma, un hallazgo que hay que registrar.

### Lo que necesita al owner

| Qué | Para qué |
|---|---|
| Las **credenciales** de prueba | ✅ **entregadas y cargadas.** Viven en `~/.config/hospeda/mp-sandbox-creds.sh`, fuera del repo y `chmod 600`. **Ojo con un supuesto que era falso**: el modo de pruebas actual de Mercado Pago **no usa el prefijo `TEST-`** — se arma con un usuario vendedor de prueba y una app propia, cuyas credenciales empiezan con `APP_USR-` igual que las productivas. Lo que distingue, y lo dice el proveedor, es `GET /users/me` → `tags:["test_user",…]`, y eso es lo que verifica el guard antes de dejar correr nada |
| ⚠️ **El webhook de la app de prueba está repuntado a la sonda** | El owner lo cambió el 2026-09-15 a `https://hos1352-webhook-sink.qazuor.workers.dev`. **Mientras siga así, el billing de staging no recibe nada de esa app.** La URL a restaurar es `https://staging-api.hospeda.com.ar/api/v1/webhooks/mercadopago?source_news=webhooks`, y **se restaura a mano**: el `PUT` por API da `403` |
| ✅ La **clave secreta de webhook** | Entregada. Cerró `EX-13`: la firma se verifica con HMAC-SHA256 sobre `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`. Guardada en `~/.config/hospeda/mp-webhook-secret.txt`, fuera del repo |
| ✅ **Reembolsos: resueltos** | `RF-1` y `RF-2` cerrados el 2026-09-15 **midiendo en producción**. El bloqueo era **la cuenta de prueba**, no la API ni el código: la misma llamada da `401` con el vendedor de prueba y entra con la cuenta real. `M-LEGAL-01` **ya tiene respuesta técnica** |
| Qué credenciales habilitan **reembolsos** en sandbox | `RF-1`/`RF-2` dieron `401 "Unauthorized use of live credentials"`. Eso no dice que el proveedor no reembolse: dice que estas credenciales no lo pueden pedir |
| ~~Acceso a la casilla del comprador de prueba~~ | ❌ **YA NO SIRVE.** `EX-3` se midió **inmedible en sandbox** (sonda 17): el dominio del comprador tiene un MX a `localhost` —un agujero negro— y ni siquiera es de Mercado Pago. Ese correo no se puede haber enviado. La única vía que queda es observarlo en producción sobre un cliente real |
| ✅ Los cuatro experimentos que movían plata | **EJECUTADOS el 2026-09-15**, autorizados por el owner, contra producción. Los cuatro pagos reembolsables eran todos **suyos** (verificado antes de tocar nada), así que la plata volvió a su propia tarjeta. Resultados en [`04-open-decisions.md`](./04-open-decisions.md) |
| 📬 **Mirar la casilla de `qazuor@gmail.com`** | `EX-3`. El 2026-09-15 22:38 se creó en producción un preapproval `pending` con esa dirección como pagador y se canceló 45 s después. Si Mercado Pago mandó algún correo, **ése es el dato**, y es la única vía viva: en sandbox la casilla del comprador no existe |
| ⚠️ **Un error vivo en producción, encontrado de paso** | Webhooks de suscripción que fallan con `500` y se encolan hasta 5 veces, sobre suscripciones reales. **Registrado y no tocado** por el §4 |
| ⚠️ **Preguntarle a soporte de MP por `R-MP-01`** | El panel avisa que **la API de Payments se descontinúa** y la documentación no lo formaliza. Tres preguntas que **no se pueden medir** porque son sobre el futuro del proveedor: (1) ¿alcanza también a las **lecturas** de `/v1/payments`? (2) ¿**cuándo**? (3) si se retira, **¿cómo se reembolsa un cobro originado por un `preapproval`?**. Tardan días: conviene preguntarlas ya |

Reglas de 1C, del §58 al §61: nada se completa desde documentación ni memoria — **sólo con un
experimento ejecutado**, con request, response y webhook registrados. Las sondas van
versionadas en `docs/mp-probes/`, marcadas como no productivas.

**Cómo se corre una sonda**: el `source` va en la **misma línea**, porque cada invocación
arranca un shell nuevo y las variables de entorno **no sobreviven** de una llamada a la
siguiente (comprobado):

```bash
cd .specs/HOS-1352-billing-verticals-redesign/docs/mp-probes
source ~/.config/hospeda/mp-sandbox-creds.sh && bash probe-05-arrancar-el-reloj.sh
```

Para cada respuesta nueva del owner: se registra **una decisión** en
[`01-decision-log.md`](./01-decision-log.md) con el formato del §3.4, y se marca el ítem
cerrado en [`04-open-decisions.md`](./04-open-decisions.md) **en el mismo commit**.

### Decisiones tomadas

**Veintinueve**: tres de metodología y **veintiséis funcionales**. Veinticinco cubren las 25
preguntas de FASE 1A, incluidas las 8 bloqueantes que le correspondían al owner.

Tres son **apartamientos declarados del PDR** (`DEC-ENT-001` del §10.3, `DEC-GRANT-002` del
§34, y `DEC-LEGAL-001` explicitando que "cuando entre ARCA" no es un disparador). Dos se
tomaron **contra la recomendación**, con su riesgo escrito: `DEC-ENT-004` y `DEC-GRANT-001`,
cancelar sin reembolso.

`DEC-SUB-001` ya **no está en pie**: FASE 1C la dejó sin mecanismo (`EX-4` es `NOT_SUPPORTED`
y falla en silencio) y la reemplazó **`DEC-SUB-005`** — misma política, ejecutada cancelando y
recreando con la primera fecha corrida, en ese orden. `EX-8` salió `VERIFIED`, así que el plan
B que la condicionaba ("esperar a la renovación") no hizo falta.

Si alguien encuentra una afirmación funcional en cualquier documento de este programa que no
esté respaldada por el PDR, por una medición fechada o por una respuesta del owner, es un
defecto: hay que marcarlo, no usarlo.

### Reglas duras que rigen ahora

- **`00-PDR.md` no se edita nunca** (§3.1). Toda desviación se registra como decisión en `01`.
- **Una decisión `ACCEPTED` no se edita**: se crea otra que la marque `SUPERSEDED`.
- **No se toca código productivo** hasta FASE 10 (§4), y por `DEC-METH-001` **ni siquiera se
  lee código** para fundamentar una decisión funcional, hasta que el diseño esté cerrado.
- **No se implementa ninguna capability cuya fila de la matriz diga `UNKNOWN`** (§61), ni se
  toma ninguna decisión que dependa de ella.
- **No se clasifica nada como `KEEP` / `ADAPT` / `REWRITE`** antes de definir el criterio al
  empezar FASE 5. Es un **gate** (`DEC-METH-003`), no un pendiente, y toda clasificación lleva
  su argumento escrito.
- **Ningún documento de este programa referencia trabajo anterior.** Si encontrás una
  referencia así, es un defecto.
- Los hallazgos de 1A **no se reescriben**. Si aparece algo nuevo, se agrega con un ID nuevo.

### Lo que NO hay que rehacer

- El PDR ya está guardado, verbatim, con su integridad verificada contra el historial de git.
- El análisis 1A ya está entregado. Si algo le falta, se **agrega**; no se reescribe.
- El issue paraguas ya existe: **HOS-1352**. No crear otro.

### Dónde está el trabajo

- **Worktree**: `/home/qazuor/projects/WEBS/hospeda-spec-hos-1352-billing-redesign`
- **Branch**: `spec/HOS-1352-billing-verticals-redesign`
- **Linear**: HOS-1352
- Sólo documentos. Cero código, cero migraciones, cero cambios en la DB.

### Trampas concretas de este entorno

- El clone principal del repo puede estar en `detached HEAD` o en la branch de otra sesión.
  **Trabajá siempre en el worktree de arriba.**
- Los conteos de producción están autorizados (`DEC-METH-002`), pero **sólo contar filas**.
  Y una salida **vacía** de la consola de SQL significa que la consulta falló y el error se
  tragó, **no** que haya cero filas: un `UNION` largo se anula entero si una sola columna no
  existe. Partir las consultas.

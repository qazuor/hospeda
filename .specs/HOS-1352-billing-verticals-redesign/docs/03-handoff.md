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
   (60 filas: 23 `VERIFIED`, 10 parciales, 4 `NOT_SUPPORTED`, 23 `UNKNOWN`).
8. [`07-facts-inventory.md`](./07-facts-inventory.md) — cuántos clientes reales hay, medido.

---

## Última actualización: 2026-09-15

### Último punto completado

**FASE 0 completa. FASE 1A entregada y COMPLETAMENTE respondida: las 25 preguntas cerradas.
FASE 1C en curso: 37 de 60 filas medidas, EL RELOJ CORRIENDO, y los webhooks observables Y VERIFICABLES.**

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
| FASE 1C — experimentación con Mercado Pago | 🟡 **en curso — 37 de 60 filas medidas · reloj corriendo, leer el 2026-09-16** |
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

> ⚠️ **ANTES QUE NADA, devolver el receptor a modo normal.** Quedó en `mode=fail`
> para medir los reintentos (`WH-4`). Si sigue así cuando lleguen las
> renovaciones, **todas van a fallar y reintentarse**, y encima el proveedor
> podría dejar de mandar:
>
> ```bash
> cd .specs/HOS-1352-billing-verticals-redesign/docs/mp-probes
> SINK_URL=https://hos1352-webhook-sink.qazuor.workers.dev bash probe-08-leer-webhooks.sh --ok
> ```

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
| **Habilitar reembolsos**, o decidir sin ellos | `RF-1`/`RF-2` dan `401` por **las dos** vías, mientras el mismo token lee y escribe. No es el token: son las operaciones de reembolso las vedadas para esta cuenta. Deja a `M-LEGAL-01` (derecho de revocación con devolución) **sin respuesta técnica** |
| Qué credenciales habilitan **reembolsos** en sandbox | `RF-1`/`RF-2` dieron `401 "Unauthorized use of live credentials"`. Eso no dice que el proveedor no reembolse: dice que estas credenciales no lo pueden pedir |
| Acceso a la **casilla del comprador de prueba** | `EX-3`: qué le comunica el proveedor al cliente por su cuenta |

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

---
title: Handoff vivo
linear: HOS-1352
statusSource: linear
created: 2026-09-15
updated: 2026-09-17
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
   (**89 filas: 49 `VERIFIED`, 13 parciales, 19 `NOT_SUPPORTED`, 8 `UNKNOWN`**, recontadas con
   [`contar-filas-de-la-matriz.py`](./contar-filas-de-la-matriz.py), nunca a mano).
8. [`07-facts-inventory.md`](./07-facts-inventory.md) — cuántos clientes reales hay, medido.

---

## Última actualización: 2026-09-17, mediodía — FASE 2 EN CURSO

### Dónde estamos

**FASE 1B cerrada** con **132 hallazgos** (`F-1B-001` a `F-1B-132`) y **FASE 2 en curso**: la
Master Spec vive en [`09-master-spec/`](./09-master-spec/), son **22 capítulos en tres partes**, y
la **Parte I está completa** — 10 de 22 archivos escritos.

| | |
|---|---|
| Capítulos escritos | **10 de 22** (`00` a `09`) |
| Huecos técnicos cerrados | **30 de 72** · quedan **42** |
| Decisiones | **45** (4 apartamientos declarados del PDR) |
| Filas de la matriz de MP | 89 · **8 `UNKNOWN`**, y **cinco se contestan hoy** |

### ⏰ TRES RELOJES VENCEN HOY — es lo primero que hay que hacer

| sujeto | entorno | vence | qué decide |
|---|---|---|---|
| **`pausa-real`** | sandbox | **12:28 `-03`** | **condiciona `DEC-SUB-010`**: si la fecha no corre +1 ciclo en el vencimiento 2 y 3, la decisión de la pausa **se reabre** |
| **`renov-falla3`** | sandbox | **~12:29 `-03`** | `RN-2` por el camino del monto impagable (ARS 2.000.000) |
| **`apagon`** | **producción** | **14:19:55 `-03`** | `RN-2` por el camino de la tarjeta apagada. Con él caen `RN-3` y `GR-1..3` |

**El cobro del proveedor llega tarde y el retraso es variable** (~26 a 33 min medidos), así que la
lectura útil es **una media hora después** de cada vencimiento, no en el minuto exacto.

```bash
# sandbox — lee los 8 sujetos del reloj, pausa-real y renov-falla3 incluidos
cd .specs/HOS-1352-billing-verticals-redesign/docs/mp-probes
source ~/.config/hospeda/mp-sandbox-creds.sh && OUT_DIR=/tmp/mp-probe-05 bash probe-06-leer-el-reloj.sh

# producción — apagon. El manifiesto de /tmp del contenedor se repuso el 17 a las 03:18
B64=$(base64 -w0 probe-43-la-tarjeta-que-se-apaga.mjs)
M64=$(base64 -w0 manifiesto-tarjeta-apagada-2026-09-16.json)
ssh -p 2222 qazuor@216.238.103.219 "bash -lc \"hops --target=prod exec api -- sh -c 'echo $B64 | base64 -d > /tmp/p43.mjs && echo $M64 | base64 -d > /tmp/hos1352-tarjeta-apagada.json && LEER=1 node /tmp/p43.mjs'\""
```

> ⚠️ **El manifiesto de `/tmp/mp-probe-05` no sobrevive a un reinicio**, y sin él la sonda 06
> aborta. La copia versionada es
> [`manifiesto-reloj-2026-09-15.json`](./mp-probes/manifiesto-reloj-2026-09-15.json): se copia a
> `/tmp/mp-probe-05/manifiesto.json` antes de correr.

### Cómo se escribe FASE 2 — la regla de fuentes CAMBIA respecto de 1B

**1B se escribió sólo contra el código. FASE 2 se escribe SIN el código.** El §0 es explícito
—*«NO quiero que la implementación existente condicione el diseño del sistema nuevo»*, *«La
arquitectura actual NO es la fuente de verdad»*— y el §65 lo repite al abrir la fase.

Las tres fuentes admitidas son el **PDR**, una de las **45 decisiones**, y una **medición fechada**
de la matriz o del inventario de hechos. **El registro de 1B (`08`) NO es fuente de diseño**: puede
aparecer en un capítulo sólo como advertencia de un modo de falla ya observado, marcado como tal.

Lo que el owner describe como *«esto se hace nuevo, esto se reutiliza, esto se mueve acá»* **es
FASE 5**, no FASE 2, y tiene su propio gate (`DEC-METH-003`).

### Los 22 capítulos, y por dónde seguir

**Parte I — núcleo transversal ✅ COMPLETA**: `00` índice · `01` glosario · `02` modelo de datos ·
`03` las ocho máquinas de estado · `04` invariantes · `05` idempotencia y concurrencia · `06`
proveedor y contrato de MP · `07` outbox y notificaciones · `08` auditoría y observabilidad · `09`
conciliación.

**PRÓXIMO PASO EXACTO: el capítulo 10**, «Verticales, planes y billing options», que cierra
`OD-ARCH-01` (retiro de un plan del catálogo) y `M-SUB-03` (vertical discontinuada).

**Parte II — subdominios**: `10` verticales y planes · `11` trial · `12` suscripción · `13` pagos ·
`14` promos, cortesías y grants · `15` entitlements y limits · `16` addons · `17` autorización ·
`18` Partner.
**Parte III — ejecución**: `19` superficies · `20` testing · `21` migración · `22` lo legal.

> **El capítulo 12 tiene una dependencia dura de los relojes de hoy.** Puede escribir la política
> del grace —la fijan el §20 y `DEC-SUB-002`— pero **no cómo se compone nuestro grace con el del
> proveedor**: si él reintenta cuatro días y nosotros suspendemos a los tres, suspendemos a alguien
> que iba a pagar bien. Eso lo contestan `RN-2`, `RN-3` y `GR-1..3`.

### Reglas de trabajo de FASE 2

1. **Un capítulo por commit**, con su fila de `04-open-decisions.md` marcada **en el mismo commit**
   y el estado del índice `00` actualizado. Pushear.
2. **El decision log y la matriz de MP NO se tocan sin el OK del owner**, con las razones. Un
   apartamiento del PDR se escribe en el capítulo marcado como pendiente y se pregunta.
3. **Si un capítulo cita un `§`, el texto se verifica contra el PDR antes de escribirlo** (regla 5
   del log). Ya evitó dos errores.
4. **commitlint**: el subject va en minúscula y no pasa de 100 caracteres. `FASE 2` al principio lo
   rechaza por `subject-case`.
5. **Stagear archivo por archivo.** `git add <directorio>` es `git add .` acotado: el 17 coló un
   `.wrangler/cache/wrangler-account.json` al repo (sacado en `561183907`).

### Lo que cerró hoy, y lo que se corrigió

- **La frontera qzpay↔hospeda quedó enunciada entera** (`F-1B-132`): **seis repartos sobre las
  mismas 27 tablas y ninguno coincide**, y el corte **no es por entidad sino por camino** — la
  misma cancelación tiene tres, con tres repartos y dos grafías.
- **`F-1B-131`**: «cancelar a fin de período» desde el admin **ejecuta todos los efectos de una
  baja inmediata menos el status**, y es la opción **por defecto** del diálogo. Contradice el §24 y
  `DEC-SUB-009`. Registrado, **no tocado** (§4).
- **`F-1B-130`**: el módulo que desambigua `canceled`/`cancelled` opera hoy sobre **cero filas**, y
  la cifra de producción de su docblock no se reproduce contra la base.
- **Corrección propia**: el capítulo 03 afirmaba que los eventos del proveedor no traen orden
  confiable. **`EX-2` mide lo contrario** —traen un contador `version` monótono por recurso—. La
  conclusión (releer en vez de creerle al evento) no cambió; la razón sí, y ahora el contador se
  usa para descartar eventos viejos sin gastar una relectura.

### Dos decisiones nuevas, las dos del owner

- **`DEC-ARCH-003`** — los dos `SUSPENDED` del PDR se separan: el del trial se llama
  **`TRIAL_EXPIRED`**. Difieren en si hubo dinero, si corresponde la campaña del §10.7, y qué le
  falta a la persona para volver.
- **`DEC-OBS-001`** — `RECONCILIATION_REQUIRED` avisa por un **listado accionable** más un correo
  **agregado**, no uno por evento. Cumple el objetivo del §22.1 y no su letra.

---

## Histórico: 2026-09-17, madrugada — el cierre de FASE 1B

### Dónde estamos

**FASE 1B en curso, con casi todos sus carriles cerrados.** El registro de 1B es
[`08-phase-1b-code-discovery.md`](./08-phase-1b-code-discovery.md) — **129 hallazgos**,
`F-1B-001` a `F-1B-129` —, y **no** el worklog, que no tiene entradas de 1B entre el 15 y el 17
(anotado allá como hueco, no reconstruido hacia atrás).

> ⚠️ **Todo lo que sigue de esta sección hacia abajo quedó del 2026-09-16 y describe 1C.**
> En particular, la tabla «Estado por fase» dice que **FASE 1B está bloqueada por
> `DEC-METH-001`**, y eso ya no rige: el owner levantó ese bloqueo el 2026-09-16 y 1B corrió.
> Se conserva por la misma razón que el resto del histórico.

**La regla de fuentes de 1B es más angosta que la del PDR, por decisión del owner (2026-09-16):
la única fuente admitida es el CÓDIGO**, en los dos repos —hospeda y `qzpay`—. Ni docs del
repo, ni specs, ni engram, ni Linear. El motivo está medido: el 2026-09-15 se borraron 94
archivos de documentación de billing, 149 observaciones de engram y 303 issues. Las anclas son
refs remotos, nunca el working tree: hospeda `60a39dae2`, qzpay `c934164`.

**Y el encuadre del owner para 1B, textual**: *«el código y tablas y configs de todo lo
referente a billing está súper desastroso, desorganizado, desparramado, duplicado, así que vos
sólo relevá todo, después analizaremos qué queda y qué no»*. O sea: **no se pregunta si algo es
deliberado**; se anota con su evidencia y se sigue. `KEEP`/`ADAPT`/`REWRITE` es FASE 5 y tiene
su propio gate (`DEC-METH-003`).

#### Carriles cerrados al 2026-09-17

| carril | estado |
|---|---|
| `apps/api/src/services` | ✅ **185 de 185 archivos / 64.191 líneas** |
| `packages/service-core/src/services/billing` | ✅ 52 de 52 / 14.254 líneas |
| Superficies Web y Admin | ✅ 15 de 15 y 22 de 22 |
| Los 47 crons, por dentro | ✅ 47 de 47 |
| Los **1.078** handlers por tier | ✅ `F-1B-123` — 1.032 era el piso, medido sin billing inicializado (`F-1B-105`) |
| Las 125 migraciones estructurales | ✅ qué agregan y qué quitan, `F-1B-120` a `F-1B-122` |
| Los 90 `pgEnum`, los 836 índices, las 399 FK, los 132 triggers | ✅ |
| **qzpay entero** salvo tests y ejemplos | ✅ core 96 %, drizzle 65/68, mercadopago 16/16, **hono 22/22 y react 28/28** |
| Las 358 FK internas de hospeda | ✅ `F-1B-126` — 253 apuntan a `users` |
| Los cinco vocabularios de estado compartidos | ✅ `F-1B-021` + `F-1B-125` |
| La matriz de gates, contrastada contra el código | ✅ `F-1B-129` |

#### Lo que queda abierto de 1B

Quedan **tres**, y ninguno bloquea FASE 2:

1. **Qué hace cada uno de los 1.078 handlers, uno por uno** — el reparto por tier está medido
   (`F-1B-123`) y la dimensión del gate también (`F-1B-129`); el contenido de cada handler no.
2. **Los tests, como evidencia de intención** (no de corrección) — sin empezar.
3. **La frontera conceptual**: qué decide qzpay y qué decide hospeda sobre el mismo hecho. Hay
   siete hallazgos que la tocan de costado (`F-1B-090`, `097`, `098`, `104`, `121`, `127`, `128`)
   y ninguno la enuncia entera.

Cerrados el 2026-09-17, después del primer corte de este handoff: la re-medición de la tabla de
rutas con billing inicializado (`F-1B-123`, `F-1B-124`), las 358 FK internas (`F-1B-126`), los
50 archivos de `hono` y `react` (`F-1B-127`, `F-1B-128` — **qzpay queda relevado entero**), los
cuatro vocabularios compartidos que faltaban (`F-1B-125`) y los sospechosos de la matriz de gates
(`F-1B-129`).

#### Método de 1B, que conviene no reinventar

- **Delegar la lectura masiva a sub-agentes con el contrato de evidencia en el prompt**
  (`archivo:línea` obligatorio, el docblock no es prueba, contar el denominador antes de
  recorrerlo, sin juicios, `model: sonnet`) — **y verificar a mano sus afirmaciones más
  graves.** Fallaron muchas veces en detalles que daban vuelta el hallazgo, y dos veces
  tuvieron razón contra la verificación.
- **Van veinte trampas de medición**, y unas ocho fueron propias. Están inventariadas en el
  `08`. La que más se repite: `rg -l <símbolo>` matchea menciones dentro de un comentario o un
  `@example`.
- **Producción se consulta** con `hops --target=prod psql` por SSH, pasando la consulta en
  base64. **Salida vacía = error tragado**, no cero filas: partir las consultas.
- **La tabla de rutas se vuelca** con
  [`probes/probe-45-volcar-la-tabla-de-rutas.test.ts.txt`](./probes/probe-45-volcar-la-tabla-de-rutas.test.ts.txt),
  copiado a `apps/api/test/` y corrido con `CI=true pnpm exec vitest run`. **No se commitea**;
  se borra al terminar.

---

## Histórico: 2026-09-16 — FASE 1C

### Dónde estamos

**FASE 1C prácticamente cerrada.** Ya no queda ningún bloqueante de FASE 2 que dependa de una
medición: los cuatro salieron de `UNKNOWN`.

| | 2026-09-15 | **2026-09-16** |
|---|---|---|
| Filas de la matriz | 84 · 12 `UNKNOWN` | **89 · 8 `UNKNOWN`** |
| Decisiones | 39 | **43** |
| Puntos del contraste PDR ↔ proveedor | 9 de 12 | **11 de 12** |
| Bloqueantes de FASE 2 que decide el experimento | 2 abiertos | **0** |
| Bloqueantes de FASE 2 que decide el owner | 1 abierto (`BD-MP-04`) | **0** |

**FASE 2 queda DESBLOQUEADA**: no hay ningún bloqueante abierto, ni de experimento ni de owner.

Las tres decisiones nuevas, las tres del owner:

- **`DEC-SUB-010`** — la **pausa** es la nativa del proveedor, empieza cuando el cliente la pide,
  se elige en **meses enteros**, y los días no usados del ciclo en curso **se pierden**. Con
  ciclos enteros el cliente vuelve el mismo día del mes, así que lo perdido se compensa con lo que
  gana al volver. Puede volver cuando quiera (§26.2 entero) y se le cobra normal en el ciclo
  siguiente. **Al reanudar se le muestra UNA sola cosa: qué día se le va a cobrar** — nada de días
  perdidos, porque el cobro es **por adelantado** y no paga servicio que no recibe.
- **`DEC-GRANT-003`** — la **cortesía temporal** se implementa **pausando** en el proveedor y
  sosteniendo el servicio de nuestro lado. Es la única de las tres que no mueve un peso: bajar al
  piso le **cobra** ARS 15 por ciclo a quien le dijimos que no pagaba, y cancelar lo obliga a
  volver al checkout al final del regalo.
- **`DEC-ADDON-002`** — cada **addon recurrente** es un **preapproval aparte**, no una línea del
  monto del plan. Cierra `BD-MP-04`, el último bloqueante de FASE 2. Subir el monto **toca plata
  cada vez** que alguien contrata o da de baja un addon, en el punto exacto donde el proveedor
  acepta sin aplicar — y `EX-15` midió que esa mutación **no emite webhook**, así que cobraría mal
  sin que nadie se entere.

### Lo único que falta decidir: el cobro fallido

Y ya **no** le falta un mecanismo para medirlo, que era el problema de ayer.

**Un cobro fallido no se puede fabricar** (sonda 42): el proveedor valida la tarjeta **cobrando
ARS 0** tanto al crear la suscripción como al cambiarle el medio de pago, así que **nunca deja una
suscripción asociada a una tarjeta que no aprueba**. Los seis cardholders de rechazo dan `400
CC_VAL_433` en el alta y `402` en el cambio; ni `CONT` se cuela, porque en una validación de
tarjeta no existe el estado pendiente.

La salida fue del owner: **que la tarjeta apruebe al asociarse y se degrade después.** El sujeto
`apagon` vive en **producción** con su tarjeta real, ya cobró su primer ciclo sano, y el owner la
apaga desde el home banking. **El intento del 2026-09-17 ~14:20 es el cobro fallido**, y con lo
que pase después caen `RN-2`, `RN-3` y `GR-1..3`.

### Los dos relojes que hay que leer

| qué | cuándo | comando |
|---|---|---|
| **`apagon`** — el cobro fallido | 2026-09-17, bien pasadas las 14:20 | sonda 43, modo `LEER=1` |
| **`pausa-real`** — la condición de `DEC-SUB-010` | 17, 18 y 19 | sonda 06 |

```bash
# producción — corre adentro del contenedor de la API en el VPS
cd .specs/HOS-1352-billing-verticals-redesign/docs/mp-probes
B64=$(base64 -w0 probe-43-la-tarjeta-que-se-apaga.mjs)
ssh -p 2222 qazuor@216.238.103.219 "bash -lc \"hops --target=prod exec api -- sh -c 'echo $B64 | base64 -d > /tmp/p43.mjs && LEER=1 node /tmp/p43.mjs'\""

# sandbox — el reloj de la pausa larga
source ~/.config/hospeda/mp-sandbox-creds.sh && OUT_DIR=/tmp/mp-probe-05 bash probe-06-leer-el-reloj.sh
```

> **`DEC-SUB-010` está CONDICIONADA a esa segunda lectura.** Que la fecha corra +1 ciclo por
> vencimiento está medido **una sola vez**, con ciclo diario y **un** vencimiento; toda la
> aritmética de los meses enteros lo necesita en el vencimiento 2 y 3. `pausa-real` quedó pausada
> el 2026-09-16 12:16 `-03` con `next` en el 17 justamente para eso. **Si esa lectura desmiente el
> corrimiento, la decisión se reabre.**

### Sujetos vivos — hay que acordarse de cancelarlos

**En producción** (cuenta `HOSPEDA_COM_AR` 3497516165, pagador `qazuor@gmail.com`, ARS 15 por
ciclo cada uno). Ids en
[`manifiesto-tarjeta-apagada-2026-09-16.json`](./mp-probes/manifiesto-tarjeta-apagada-2026-09-16.json),
[`manifiesto-segundo-trial-2026-09-16.json`](./mp-probes/manifiesto-segundo-trial-2026-09-16.json)
y [`manifiesto-trial-vuelta-3-2026-09-16.json`](./mp-probes/manifiesto-trial-vuelta-3-2026-09-16.json),
y también en `~/.config/hospeda/`:

| slug | id | empieza a cobrar |
|---|---|---|
| `apagon` | `5d9dfc9d…` | ya cobró 1 ciclo · próximo intento **17/09** |
| `ex33` | `04adf298…` | **19/09** |
| `trial-vuelta-2` | `6b93a292…` | **18/09** |
| `trial-vuelta-3` | `84a9c564…` | **21/09** |

**Gasto real del 2026-09-16: ARS 15** de los 60 autorizados por el owner. Los tres sujetos con
fecha futura no cobraron nada — que es justamente la respuesta buena de `EX-33`.

**En sandbox**: los 8 del reloj original, más los ~20 de las sondas 33-37. Sin costo.

### Cinco cosas medidas hoy que cambian cómo se implementa

1. **`EX-37` — el `init_point` que devuelve la API está ROTO.** Viene con `&activation=true` y esa
   URL abre **«Esta página no existe»**; bug abierto del proveedor desde el 2026-09-04
   ([sdk-nodejs#480](https://github.com/mercadopago/sdk-nodejs/issues/480)), sin respuesta oficial.
   **Es el caso más caro del §0**: la API responde `201` y entrega un dato que parece válido, el
   cliente no se suscribe, y no hay ningún error del lado nuestro. **Nunca usar el `init_point`
   crudo** — sanearlo antes de mostrarlo, **con un guard estático**, porque es un call site que
   cualquiera vuelve a escribir «bien» copiando lo que devuelve la API.
2. **`EX-38` — una `start_date` futura se convierte en un free trial sola.** El request no lleva
   `free_trial` y el objeto queda con uno, y al comprador se le anuncia **«Tu prueba gratis
   comenzó»**. O sea: **compensar días ya pagados corriendo la fecha ES pedirle un trial al
   proveedor**, aunque el payload no lo nombre — y un guard que busque `free_trial` **en el
   payload** no ve nada. Al cliente que hace un upgrade a mitad de mes se le anuncia una prueba
   gratis justo cuando está usando días que **ya pagó**.
3. **`EX-36` — se puede cambiar el medio de pago sin recrear la suscripción.** `card_id` y
   `payment_method_id` cambian de verdad, incluso de marca y de crédito a débito. Pero **el cambio
   cobra una validación de ARS 0 que puede fallar**, y **el endpoint no dice por qué**: devuelve
   `402 "Unknown error"` con `cause: null`, y el motivo real **sólo existe en el pago de
   validación**, que hay que ir a buscar aparte.
4. **`EX-34` y `EX-35` — sobre una suscripción viva no se puede correr la fecha ni poner un
   `free_trial`.** Cuatro formas y dos formas, todas `200`, `last_modified` congelado. El control
   que lo separa de «esta suscripción está trabada»: el monto sobre el mismo objeto sí entra.
5. **El cobro del proveedor llega tarde, y el retraso es variable.** 33 minutos en la renovación de
   sandbox, ~26 en producción (`PA-3`), y ~100 segundos en el alta de `apagon`. **Ninguna lógica
   puede preguntar «¿ya cobró?» a la hora exacta.**

### Trampas nuevas, además de las del §0

- **`live_mode: true` NO distingue sandbox de producción** (`EX-14`), y el token es `APP_USR-` en
  los dos. Lo que **sí** distingue es `GET /users/me`: la cuenta de pruebas trae
  `tags: ["test_user"]`. **Toda sonda que mute algo tiene que abrir con ese guard** — las 42 y 43
  lo traen, y en la 43 está invertido porque ahí producción es lo que se quiere.
- **`~/.config/hospeda/mp-refunds-app-creds.sh` es de la cuenta de PRUEBAS**, pese al nombre. El
  token de producción es `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` y **sólo existe dentro del contenedor
  de la API en el VPS**.
- **`/tmp` del contenedor no sobrevive a un redeploy**, y `RC-1` midió que el `search` ignora
  `external_reference`: **sin los ids no hay forma de reencontrar los sujetos**. Por eso cada
  manifiesto se copia al repo Y a `~/.config/hospeda/`.

### Próximo paso exacto

1. **Leer `apagon` el 17** — es el último punto del contraste.
2. **Leer `pausa-real` el 17, 18 y 19** — es la condición de `DEC-SUB-010`.
3. **Decidir el residuo abierto**: la precedencia entre una cortesía vigente y una pausa pedida
   por el cliente, y entre dos cortesías. Salió de `DEC-GRANT-003` y quedó anotado ahí, sin decidir.
4. **Arrancar FASE 2 (Master Spec)**, que ya no está bloqueada. Tiene **~70 huecos técnicos**
   inventariados en `04-open-decisions.md` que resuelve sola, sin el owner.
5. **Pedir las consultas que dependen de terceros, que son las de mayor latencia**: `M-LEGAL-03`
   (sobre todo **si el silencio del cliente vale como aceptación** de un aumento — si no alcanza,
   `DEC-MP-002` cambia de forma), `M-LEGAL-01` (si cada renovación abre una ventana nueva de
   revocación), y las tres preguntas a soporte de MP por `R-MP-01` (la API de los reembolsos se
   descontinúa y su guía de migración **excluye suscripciones**).

### Cómo pidió trabajar el owner

Punto por punto. **Antes de plantear cada uno: búsqueda externa exhaustiva** (docs oficiales,
foros, normativa). Recién después, **opciones numeradas con costo / riesgo / fricción y UNA
recomendación justificada**. **UNA pregunta por vez, y después PARAR.** Cuando da el OK, se asienta
en `01-decision-log.md` **y** se marca cerrado en `04-open-decisions.md`, **en el mismo commit**.

Sus dos criterios, que ya resolvieron ocho puntos:

- la frontera no es «automático vs manual», es **«toca plata o no toca plata»**;
- se elige **hacia dónde falla** cada opción, no cuál funciona.

---

## Estado al 2026-09-15 — histórico, superado por lo de arriba

> Lo que sigue quedó como registro de dónde estaba el programa esa noche. **Los conteos, los
> relojes y las filas abiertas que menciona ya no son los vigentes.** Se conserva porque el
> histórico de qué se creía en cada momento es parte del registro de este programa.

### Último punto completado

**FASE 0 completa. FASE 1A entregada y COMPLETAMENTE respondida: las 25 preguntas cerradas.
FASE 1C en curso: 52 de 71 filas medidas, DOS RELOJES CORRIENDO —sandbox y PRODUCCIÓN—, y TODO
LO MEDIBLE SIN ESPERAR, MEDIDO.**

**Ya no falta ningún permiso, ninguna credencial ni ningún endpoint.** De las 19 filas abiertas,
**16 esperan que un ciclo SE EJECUTE** y se leen mañana. Las otras tres son `WH-5` (se fuerza con
el interruptor del receptor, **pero hacerlo rompe la lectura del reloj**), `RC-3` (más pregunta
de diseño que de proveedor) y `RF-3` (necesita un pago de más de 180 días que todavía no existe).

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
| FASE 1C — experimentación con Mercado Pago | 🟡 **en curso — 52 de 71 filas medidas · DOS relojes corriendo, leer el 2026-09-16** |
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

### HAY TRES RELOJES, Y LOS TRES SE LEEN MAÑANA

| reloj | arrancado | leer a partir de | sujetos |
|---|---|---|---|
| **sandbox** | 2026-09-15 12:26 (-03) | **2026-09-16 ~11:30** | 8 |
| **producción** | 2026-09-15 20:35 (-03) | **2026-09-16 ~20:40** | 7 |
| **planes** (sandbox) | 2026-09-15 23:32 (-03) | **2026-09-16 ~23:35** | 2 |

```bash
# sandbox
cd .specs/HOS-1352-billing-verticals-redesign/docs/mp-probes
source ~/.config/hospeda/mp-sandbox-creds.sh && OUT_DIR=/tmp/mp-probe-05 bash probe-06-leer-el-reloj.sh

# producción — corre adentro del contenedor de la API en el VPS
ssh -p 2222 qazuor@216.238.103.219 'bash -lc "hops --target=prod exec api -- sh -c \"LEER=1 node /tmp/p29.mjs\""'

# planes — ¿el plan propaga el monto de verdad, o sólo lo refleja la lectura?
source ~/.config/hospeda/mp-sandbox-creds.sh && \
  OUT_DIR=/tmp/mp-probe-33 LEER=1 node probe-36-el-plan-propaga-o-solo-lo-parece.mjs
```

> **El reloj de planes contesta UNA cosa y no hay que pedirle otra.** Un sujeto nació a ARS 2000
> y su plan se subió a **ARS 3300** antes del primer cobro; el otro es idéntico y **no se tocó**.
> Si el editado cobra 3300, editar un plan **propaga** de verdad y existe un cambio de precio
> masivo que `DEC-MP-001` no consideró. Si cobra 2000, **la relectura miente sobre el monto que
> se cobra**, y eso alcanza a toda verificación hecha sobre planes. El control es el que lo hace
> legible: si no cobró nada, el hallazgo es otro y no hay que forzar una conclusión sobre el
> monto. Manifiesto versionado en
> [`manifiesto-propaga-2026-09-15.json`](./mp-probes/manifiesto-propaga-2026-09-15.json).

<!-- separador: son dos notas distintas, no una sola cita -->

> **Ruido en el sink de webhooks**: las sondas 33 a 37 crearon ~20 suscripciones en el sandbox,
> y el webhook de la app de prueba apunta al receptor propio. Al leer el sink mañana para
> `RN-1`, esos `data.id` son ruido y están todos en
> [`manifiesto-planes-2026-09-15.json`](./mp-probes/manifiesto-planes-2026-09-15.json) justamente
> para poder excluirlos.

### El modelo de PLANES entró a la matriz — y no resuelve el punto 1

Las 71 filas anteriores se habían medido **todas** sobre `/preapproval` (suscripciones sueltas).
La noche del 2026-09-15 se midió el segundo modelo del proveedor, `/preapproval_plan`, con nueve
filas nuevas (`EX-21` a `EX-29`, sondas 33 a 37, todas en sandbox y a costo cero).

| | |
|---|---|
| **`EX-21`** — mover una suscripción viva de un plan a otro | **NO, con un `200` y el campo descartado.** Medido con el control en tres pasos. **El modelo de planes NO resuelve el cambio de ciclo individual**: `DEC-SUB-005` sigue siendo el único camino |
| **`EX-23`** — editar el monto del plan | **alcanza la LECTURA de los ya suscriptos** (2000 → 2500 → 15 sobre un testigo que nadie tocó). Si alcanza también al **cobro**, es un cambio de precio masivo. Lo contesta el reloj de planes |
| **`EX-25`** — editar el ciclo del plan | el ciclo **es editable** (`EX-24`) y **NO alcanza a los suscriptos**. Asimetría con `EX-23`: sobre los mismos sujetos, el monto cambia y el ciclo no |
| **`EX-27`** — `repetitions` y `billing_day` | **exclusivos de planes**; sin plan se descartan con un `201`. Es lo único que los planes aportan sobre el suelto. `free_trial` sí anda suelto (`EX-26`) |
| **`EX-29`** — el free trial de un plan | **no lo decide el request**: dos altas idénticas dan resultados distintos, reproducido tres veces (`✅ ✅ ❌`). Mecanismo **sin identificar**. La relectura lo delata, así que **no se le puede prometer al cliente la fecha del primer cobro desde lo que se mandó** |
| **`EX-22`** — el `reason` con plan | lo fija **el plan**, no la suscripción. Como el `reason` **es la copy que ve el cliente** (`EX-3`), un catálogo de planes es también un catálogo de textos, uno por vertical × tier × ciclo |

Y un dato de costo: **los planes aceptan ciclo diario** (`EX-28`), así que una batería completa
sobre planes se lee en 24 h y no en un mes — salvo lo que use `billing_day`, que es mensual por
definición.

**Si el contenedor se redeployó, `/tmp/p29.mjs` se perdió**: hay que volver a ponerlo con el
base64 de [`probe-29`](./mp-probes/probe-29-el-reloj-de-produccion.mjs). El manifiesto sí está
versionado ([`manifiesto-reloj-produccion-2026-09-15.json`](./mp-probes/manifiesto-reloj-produccion-2026-09-15.json)),
y sin él se pierde el experimento: `RC-1` midió que el `search` **ignora `external_reference`**.

**La primera pregunta que contesta el reloj de producción no es ninguna fila**: es si
`PA-3` diverge. Autorizar allá **no cobró nada** (ver abajo). Si mañana hay **un** cobro por
sujeto, el primer ciclo no se cobra al autorizar; si hay **dos**, el primero simplemente tardó.

### El reloj de SANDBOX — lo primero que hay que hacer mañana

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

### La noche del 2026-09-15 — con la tarjeta real del owner (sondas 27 a 29)

El owner autorizó usar su tarjeta. **Los datos de la tarjeta nunca pasaron por el chat**: se
tipearon una sola vez en su sesión SSH, adentro del contenedor de la API de producción, donde
ya vive el access token. La sonda 27 mintió los tokens y escribió **sólo los ids**.
`hops exec api -- node X` **no da TTY** — va `hops exec api --shell` y el script adentro.

**La batería entera salió gratis**: con `start_date` a +30 días una suscripción autorizada no
cobra, así que se crearon seis, se les corrió todo encima y se cancelaron. **Cero cobros**,
verificado sujeto por sujeto. El primer sujeto fue un **canario** que abortaba la corrida si
tenía un cobro.

| Qué | Resultado |
|---|---|
| `EX-4`, `EX-11`, `EX-12`, `PC-1/2/3`, `CN-1`, `PS-1/PS-3`, `EX-6` | **confirmados en producción**. `EX-6` pasó de dos autorizadas conviviendo a **seis** |
| **`EX-20`** nueva | **un `PUT` con varios campos se aplica A MEDIAS, con un solo `200`**. Releer "la" mutación no alcanza: hay que comparar **campo por campo cada campo que se mandó** |
| **`EX-19`** nueva | **`external_reference` se puede reescribir** sobre una autorizada (también `reason` y `back_url`; `payer_email` no). **Es una vía de reparación** para el `SubscriptionNotResolvedError` vivo en producción |
| **`EX-3`** cerrada | leyendo la **casilla real del owner**: 43 correos del proveedor en un día. Ver abajo |
| **`PA-3`** | **DIVERGE**: en producción autorizar **no cobra en el acto**, sólo deja un `card_validation`. Y el owner confirmó que **su tarjeta no vio ningún cargo**, ni de $15 ni de $0 |

#### `EX-3` — y son seis consecuencias de diseño, no un dato de color

Mercado Pago le escribe al cliente por su cuenta en el alta, el cambio de monto, la pausa y la
cancelación. Lo que sale de ahí:

1. **El `reason` ES la copy que ve el cliente** (asunto y encabezado), y `EX-19` lo hace
   reescribible. **Nunca va un slug interno ahí.**
2. **Un cambio de precio no se puede hacer en silencio** — y como `EX-15` midió que no emite
   webhook, **el proveedor le avisa al cliente y NO nos avisa a nosotros**.
3. Los cuatro correos mandan al cliente a **nuestra** puerta: no hay autogestión.
4. **`paused` y `cancelled` le llegan AMBIGUOS** (*"por un pago no realizado o por opción del
   vendedor"*): una pausa de cortesía y una por mora son idénticas para el cliente.
5. El proveedor afirma que **una pausa la levanta el vendedor**, contra el supuesto de
   reanudación automática del §26.2.
6. **Tres textos del proveedor contradicen sus propios datos**: el `2084` que dice que el pago
   no se puede reembolsar cuando sí se puede, el *"Pagaste la suscripción"* de un alta que no
   cobró, y el *"Cobramos $15"* de un cargo que no existió. **Ninguna decisión de soporte puede
   apoyarse en la copy de Mercado Pago.**

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
| ✅ `EX-3` | **CERRADA** el 2026-09-15 leyendo su casilla: 43 correos del proveedor. Seis consecuencias de diseño, arriba |
| 🔍 **Volver a mirar la tarjeta mañana** | A los 75 min de las seis autorizaciones **no había entrado ningún cargo**, ni de $15 ni de $0. Eso y la API (`card_validation` de ARS 0) coinciden; el que queda afuera es el correo del proveedor. Un resumen puede tardar, así que se re-mira junto con el reloj |
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

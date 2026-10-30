---
title: "FASE 9 completa · aplicado en billing, carril 2"
linear: HOS-1352
statusSource: linear
created: 2026-09-25
updated: 2026-09-25
status: CURRENT
fase: 9
---

# FASE 9 completa — aplicado en billing, carril 2

Carril: todo `B/*` salvo las sub-specs (`B/spec.md`, `B/descomposicion.md`). Fuentes: la tabla del
owner ([`10`](./10-decisiones-del-owner.md)) —decisiones `4a`–`4e` y el lado billing de `6c`—,
el informe [`03`](./03-R4-R6-cortesia-promos-y-addons.md) (contradicciones 1–5 de §R4.5 y 1–3 de
§R6.5, bordes), `K-9` del [`05`](./05-R9-F8CA2004-reloj-y-publicacion.md) §6.3, `R12-OWNER-2` del
[`07`](./07-R12-R14-trial-y-cupos.md), y los pendientes que dejaron
[`12`](./12-aplicado-el-corte.md) §4 y [`13`](./13-aplicado-billing-1.md) §3-§4. No se tocó el log,
la matriz, el núcleo, el contrato, `V/*` ni las sub-specs. Las líneas son las del archivo
**después** de editar. Todo lo que cambia de sentido quedó tachado con `~~…~~` y el texto nuevo
lleva *owner 2026-09-25; FASE 9 completa, `<ID>`*. `updated: 2026-09-25` en los diez archivos
tocados (`B/14` y `B/16` lo tenían viejo). `markdownlint-cli2` sobre los diez: ningún error nuevo
fuera de los de estilo que el corpus ya tenía (`MD013`, `MD060`, `MD024`, `MD001`); `MD028` y
`MD056`, cero.

## 1. Cambios, por archivo

### `B/03-maquinas-de-estado.md`

| línea | qué | cierra |
|---|---|---|
| 29-37 | transiciones con `desde` de conjunto: seis → **ocho** (`S32`, `S33`) | recuento (4a) |
| 144 (`S2`), 151 (`S9`), 160 (`S18`) | *«plan anual»* → *«plan no mensual —trimestral, semestral o anual—»*; `DESTINO_DE_PLAN_ANUAL` → `DESTINO_DE_PLAN_NO_MENSUAL` | contradicción 1 de §R4.5 |
| 150 (`S8`) | si `S8` ocurre, sus complementos se pausan por `S32` | 4a |
| 152 (`S10`) | condición: *«la fila es principal»*; efecto: **escribe `fin_real`**; reanuda complementos por `S33` | contradicción 3 de §R4.5, 4a |
| 162 (`S20`), 163 (`S21`) | si la fila de complemento estaba `PAUSED` por `S32`, escriben `fin_real` | 4a (borde C·S20/S21, deja de ser borde) |
| 167 (`S25`) | condición: *«la fila es principal, como en `S10`»* | 4a |
| 174 | **`S32`** ✚: pausa de los complementos recurrentes con su principal (`LISTING`/`VERTICAL_SUBSCRIPTION` de la vertical; `USER`/`GLOBAL` sólo si no queda título sin pausar en otra vertical compatible); relectura; si falla, marca 22 `PAUSA_NO_APLICADA`; no consume cupo; sin reloj propio | 4a (`F-8CC1-004`) |
| 175 | **`S33`** ✚: reanudación del complemento cuando su principal (o la sucesora a la que `S18` lo re-apuntó) está `ACTIVE`, o —`USER`/`GLOBAL`— otra vertical compatible tiene principal `ACTIVE` o ancla viva; si falla, `REANUDACIÓN_NO_APLICADA`; si la principal termina, no corre (orfandad → `A5` → `S21`) | 4a |
| 176 | **`S34`** ✚: `PAUSED · COURTESY` → mismo estado, `SUPER_ADMIN` otorga cortesía: suma meses | contradicción 4 de §R4.5 |
| 177 | **`S35`** ✚: `PAUSED · COURTESY` → `PAUSED · CUSTOMER_REQUEST`, la persona pide pausar | contradicción 5 de §R4.5 |
| 773-780 | blockquote de recuento: salidas de `PAUSED` = cinco terminales (`S22`, `S13`, `S17`, `S25`, espejo) + `S6`, todas escriben `fin_real`; *«cuatro»* → **seis** | contradicción 2 de §R4.5 |
| 1305-1326 | `S21`, motivo 14/15: las transiciones que sacan una principal de las filas vivas, doce → **trece** (`S31`); *«cinco de doce»* → trece; *«otras siete»* → **ocho** | contradicción 2 de §R6.5 |
| 1621-1636 | §5: entradas/salidas de la pausa (con `S32`, `S33`, el espejo, `S34`, `S35`); *«cuatro terminales»* → cinco; `S10` escribe `fin_real` | contradicciones 2 y 3, 4a |
| 1645 | §5 límites: el cupo se cuenta sólo sobre filas principales | 4a |
| 1680-1692 | §5 cruces cortesía×pausa: los ejecutan `S35` y `S34`; párrafo nuevo de 4a | contradicciones 4 y 5, 4a |
| 2478 (`A1`) | *«válida»* = `ACTIVE` y cobrada (pago acreditado, o sucesora de una que venía pagando) | 4d, `R12-OWNER-2` |
| 2482 (`A5`) | `LISTING` sobre el **conjunto** de las principales + ancla viva; `USER`/`GLOBAL` = ninguna principal viva y cobrada ni ancla viva en sus verticales compatibles; **el borrado de la ficha sale de `A5`**; la lista *«seis»* se tacha y remite a `B/16` §4.3 (trece); re-evaluación sobre `USER`/`GLOBAL` | 4c, 4d, `K-9`, contradicción 2 de §R6.5 |
| 2483 (`A6`) | `desde` gana `PENDING_AUTHORIZATION`; evento = toda llegada a `PURGED` (`PB9` o `PB12`); es la única fila que ejecuta el borrado | `K-9` |
| 2495 | *«doce»* → trece | contradicción 2 de §R6.5 |
| 2686 (§10.1) | `authorized`×`PAUSED`: `S33` si la fila es de complemento | 4a |
| 2693 (§10.1) | el espejo sobre una `PAUSED` escribe `fin_real` con el día de la relectura | borde C·espejo (corregido, no declarado) |
| 2841-2849 | «NO cierra»: *«`S31` no figura en `B/16` §4.3»* tachado → cerrado | contradicción 2 de §R6.5 |

### `B/16-addons.md`

| línea | qué | cierra |
|---|---|---|
| 6 | `updated` | — |
| 107-114 | §2.2: *«Válida es `ACTIVE`»* → `ACTIVE` **y cobrada** | 4d (absorbe `R12-OWNER-2`, `B/16:114`) |
| 245-252 | §3.3: ningún scope queda del todo en *«el objetivo nunca murió»*; la tercera cláusula sigue haciendo falta para quien conserva otro título | 4c, 4d |
| 384-387 | §3.4: el *«para siempre»* de `USER`/`GLOBAL` queda sólo para quien conserva otro título | 4d |
| 428 (fila `LISTING`) | tachada; nueva: ninguna principal viva de ese `user + vertical` y ninguna ancla viva; el borrado sale de la fila (`A6`) | 4c, `K-9` |
| 430 (fila `USER`·`GLOBAL`) | *«la cuenta se borró»* tachado → ninguna principal viva y cobrada ni ancla viva en las verticales compatibles (y la cuenta borrada) | 4d |
| 445-454 | viñeta de la segunda mitad: tachada; leída sobre el conjunto | 4c |
| 456-467 | viñeta de `A6`: única puerta del borrado, desde `ACTIVE` o `PENDING_AUTHORIZATION` | `K-9` |
| 470-479 | párrafo nuevo *«Por qué el borrado salió de la orfandad (`K-9`)»*; el `NUCLEO/03` no cambia | `K-9` |
| 481-496 | blockquote *«lo que esta mitad no alcanza»* (la más reciente) tachado → leído sobre el conjunto | 4c |
| 595-601 | *«vale también para `LISTING` cuando tiene fila principal»*: vale para los cuatro scopes | 4c, 4d |
| 658-668 | *«la pausa que pide el cliente ya no lo deja cobrando»* | 4a (`F-8CC1-004`) |
| 686-689, 711-712, 716 | §4.3: *«las doce»* → **trece** (`S31`); `S31` entre las que matan a la sucesora que relevaba | contradicción 2 de §R6.5 |
| 740-750 | §4.3 punto 4 nuevo: re-evaluación sobre `USER`/`GLOBAL`; y la sucesora de 3c no deja huérfano nada (va a `S4`, no a `S16`) | 4d; pendiente 3c de `13` §4 |
| 843-845 | §4.4: *«nunca muere»* acotado | 4c, 4d |
| 918-923 | «NO cierra», segunda viñeta: conjunto (4c), `USER`/`GLOBAL` (4d), pausa (4a) | 4a, 4c, 4d |
| 947-951 | «NO cierra»: contracargo sobre el cobro de un addon periódico | borde 4 de §R7.5.2 de `04` (pendiente de `13` §4) |
| 952-957 | «NO cierra»: la emisión de `USER`/`GLOBAL` la fija el contrato §2.7 con `G-R2-C`; billing aporta el dato | 4e (lado billing) |

### `B/14-promos-cortesias-y-grants.md`

| línea | qué | cierra |
|---|---|---|
| 6 | `updated` | — |
| 67-84 | §1.3 reglas 2 y 3 tachadas → **el canje o el apilado bajo el piso se rechaza con el motivo en pantalla**; el 100 % no se canjea; el código no se consume | 4b |
| 125-139 | §2.2 downgrade: la promo la apaga **el pedido** y no el acto; muta al precio de lista del plan nuevo; el *«plan NUEVO desde el pedido»* tachado y reescrito | contradicción 1 de §R6.5 |
| 140-145 | §2.2: la vuelta del suspendido con tarjeta pierde la promo aunque vuelva al mismo plan; se acepta y se dice; anotado para el futuro | 3b (pendiente de `13` §4) |
| 271-274 | §2.4: *«el aumento de `DEC-MP-002` muta al monto esperado»* | matiz de `F-8CB1-016` |
| 290-293 | §2.4: *«plan vigente»* → *«plan nuevo, sin promos»* | contradicción 1 de §R6.5 |
| 646-647 | §4.7: el ejemplo alcanza al trimestral y al semestral | contradicción 1 de §R4.5 |
| 653 | fila *«un plan anual»* → *«un plan no mensual»* | contradicción 1 de §R4.5 |
| 654 | cortesía sobre cortesía: la ejecuta `S34` | contradicción 4 de §R4.5 |
| 665-670 | §4.7 punto 2: no mensual, `DESTINO_DE_PLAN_NO_MENSUAL` | contradicción 1 de §R4.5 |
| 695-697, 721-725 | «NO cierra»: los dos cerrados del downgrade, alineados (el pedido; *«sin promos»*) | contradicción 1 de §R6.5 |
| 726-730 | «NO cierra»: la promo que se agota con la fila en `GRACE_PERIOD` | borde e4 |

### `B/02-modelo-de-datos.md`

| línea | qué | cierra |
|---|---|---|
| 50 | `subscription_pause` puede ser de complemento (`S32`); no cuenta contra `DEC-SUB-004` | 4a |
| 492 | `addon_product`: dos productos pueden anclar versiones del mismo `addon`; sus verticales compatibles las leen la emisión (4e) y la orfandad (4d) | borde k4; 4d, 4e |
| 598-605 | downgrade: el pedido, no el acto; muta al precio de lista del plan nuevo | contradicción 1 de §R6.5 |
| 672-673 | `motivo_cierre`: `DESTINO_DE_PLAN_ANUAL` → `DESTINO_DE_PLAN_NO_MENSUAL` (la enumeración sigue en cuatro) | contradicción 1 de §R4.5 |
| 1123-1128 | §4.1: *«se conserva íntegro»* habla del modelo nuevo; del sistema viejo no se conserva nada | pendiente 6 de `12` §4 (`2a`) |

### Otros `B/*`

| archivo:línea | qué | cierra |
|---|---|---|
| `B/05:73-78` | §1.2: vale para `/preapproval`; `/v1/orders` sí tiene candado (`EX-41`) | contradicción 3 de §R6.5 |
| `B/09:121` | monto esperado en la ventana del downgrade: plan nuevo, sin promos | contradicción 1 de §R6.5 |
| `B/09:506` | quinta comprobación: `S10` o `S33` | 4a |
| `B/09:512-525` | salidas de `PAUSED`: cuatro → **seis** (`S17`, espejo), las seis escriben `fin_real`; complementos de `S32` | contradicción 2 de §R4.5, 4a |
| `B/12:211-220` | §2.3: el pedido y no el acto termina la promo; ventana = plan nuevo, sin promos | contradicción 1 de §R6.5 |
| `B/19:109` (fila 5) | la ejecuta `S35` | contradicción 5 |
| `B/19:110` (fila 5-bis) | qué les pasa a sus addons recurrentes al pausar | 4a |
| `B/19:113` (fila 7-bis) | el canje bajo el piso se rechaza con el motivo; no se consume | 4b |
| `B/19:123-124` (13-ter, 13-quater) | anual → no mensual; `S34`; `DESTINO_DE_PLAN_NO_MENSUAL` | contradicciones 1 y 4 |
| `B/19:137` (fila **21** ✚) | botón de suscribirse: si no publicó en esa vertical, lo manda a publicar; el checkout queda para quien publicó o consumió su trial; red `T8` | 6c (espejo de `V/19` fila 23) |
| `B/19:298-300` | §7 pricing: el botón de primer uso manda a publicar | 6c |
| `B/20:359-362` | filas de `V/20` §2: 18 → **19** (`G-R2-C`); guards distintos 30 → **31**; sin unidad 0 → **1** | 4e (recuento) |
| `B/21:147-148` | la regla de re-vinculación nombra el motivo 6 (`TRANSICIÓN_NO_DECLARADA`), como `B/09` §2.4 | coherencia 2b |
| `B/21:154-156` | *«se escribe en»* → *«está escrita en»* el cap. 09 §2.4 | coherencia 2b |
| `B/21:304-308` | «NO cierra»: la precondición *«todavía no escrita»* tachada → cerrada | coherencia 2b |

**Coherencia `B/21` ↔ `B/09` §2.4 (2b), verificada leyendo las dos**: misma condición
(*«el `external_reference` nombra una fila nuestra sin otro `provider_link` vivo»*), mismo destino
del resto (marca, motivo 6, una persona), misma razón (`PA-2`, el cobro en vuelo del sistema viejo
ya no tiene candidato plausible). `B/21:161-173` (lápida, salvedad 4) no contradice: la lápida hace
reconocible el id, así que un webhook sobre ella no es un desconocido.

## 2. Decisiones que tomé donde el informe dejaba forma abierta

- **4a, forma**: dos transiciones nuevas y no un `desde` ampliado de `S8`/`S10`, por la misma
  razón que `S13`/`S20` son dos filas (`B/03` §3): `S32` evalúa una condición (el `USER`/`GLOBAL`
  sin título en otra vertical). La pausa del complemento **no tiene reloj propio** y **no gasta
  cupo**; `S10` y `S25` exigen ahora *«la fila es principal»* para no competir con `S33` por el
  mismo evento. Si el `PUT` del complemento falla, marca **22** (`PAUSA_NO_APLICADA`, ya
  existente): **el catálogo de motivos no se movió**. La pausa por `COURTESY` no pausa
  complementos (la cortesía emite título; eje F·CO del informe, OK).
- **4d, *«cobrada»***: la leí como en `S4` (3c): pago acreditado **o** sucesora de una predecesora
  que venía pagando. Sin la segunda mitad, todo upgrade dejaba huérfanos los `USER`/`GLOBAL` en el
  acto (la sucesora nace `cobrada: no`).
- **`K-9`**: elegí la segunda propuesta del informe —sacar el borrado de la orfandad y dejárselo a
  `A6`— en vez de declarar un décimo caso de la regla 7 del núcleo. Como `A5` cubría también la
  instancia `PENDING_AUTHORIZATION`, `A6` gana ese `desde`. Mismo destino y mismo motivo 14, así que
  no mueve plata; **el lado núcleo no necesita cambio** (no queda par compartido).
- **Contradicciones 4 y 5**: `S34` y `S35` son filas nuevas, como propone el informe; `S35` no pasa
  por el término de estado de `puedePausar()` (el `N/01` ya dice que la decide esa fila).
- **Borde C·espejo**: corregido en `B/03` §10.1 en vez de declarado, como prefiere el informe.
- **Borde C·S20/S21**: deja de ser borde con 4a (la población existe); `S20` y `S21` escriben
  `fin_real`.
- **4b, texto de pantalla**: *«este código deja el importe por debajo del mínimo que se puede
  cobrar»*; es propuesta mía, no del owner.

## 3. Lo que NO apliqué, y por qué

- **6b** (γ, el caché el día del fin de servicio, `B/10` §4.3): no está entre las tareas de este
  carril. Sigue pendiente la frase *«el barrido del día invalida las entradas de la vertical»* en
  `B/10` §4.3 (ya la listó `13` §3).
- **4e, el contrato y el guard**: el texto del contrato §2.7 (`D/12:636`) y `G-R2-C` (`V/20` §2)
  ya estaban escritos por otros carriles; acá sólo el lado billing (`B/16` «NO cierra», `B/02`
  §2.4) y el recuento de `B/20`.
- **La unidad de `G-R2-C`**: no la asigna ninguna `descomposicion.md`; es de `V/descomposicion.md`
  (fuera de carril). Por eso `B/20` §6 cuenta **1 sin unidad**.

## 4. Citas fuera del carril, con el texto propuesto

**Núcleo**:

- (1) `N/01-glosario.md:842`: *«la decide la fila `PAUSED · COURTESY` → `PAUSED · CUSTOMER_REQUEST`»*
   → agregar *«(`S35`)»*.
- (2) `N/01-glosario.md:770`: *«destino de plan anual»* → *«destino de plan no mensual
   (`DESTINO_DE_PLAN_NO_MENSUAL`)»* (contradicción 1 de §R4.5).
- (3) `N/01` precisión 3 del cruce *«cortesía sobre cortesía»*, si la nombra: la ejecuta `S34`.
- (4) `N/03` regla 7: **sin cambio** (`K-9` resuelto del lado `B/16`/`B/03`; no queda par compartido).

**Verticales**:

- (5) `V/11-trial.md:354`: *«Si esa suscripción es de plan anual, la cortesía no está disponible»* →
   *«de plan no mensual —trimestral, semestral o anual—»*.
- (6) `V/15-entitlements-y-limits.md:157` ya cita 4d; verificar que diga *«viva y cobrada»* con la
   lectura de 3c (pago acreditado o sucesora de una que venía pagando), como `B/16` §4.2.
- (7) `V/descomposicion.md`: asignar unidad a `G-R2-C` (por capítulo, `V3`, con `G-R2-B`); con eso
   `B/20` §6 vuelve a *«sin unidad: 0»*.

**Sub-specs de billing**:

- (8) `B/descomposicion.md:199` (fila `B9`): *«y que un 100 % es una cortesía»* → *«y que un canje
   bajo el piso se rechaza (4b)»*; la duda *«si la cortesía se implementa pausando o no cobrando»*
   pierde sujeto.
- (9) `B/descomposicion.md`: la unidad que construye la máquina de suscripción gana **`S32`–`S35`**
   (35 filas numeradas, antes 31).

**Log (`D/01`)**, con OK del owner:

- (10) `DEC-ADDON-001`/`DEC-ADDON-002`, 📌: *«La pausa pedida por el cliente pausa también sus addons
  recurrentes de esa vertical por los mismos meses (`USER`/`GLOBAL` sólo sin título en otra
  vertical compatible); la fila de complemento gana `PAUSED` (`S32`, `S33`) (owner 2026-09-25;
  FASE 9 completa, 4a)»*.
- (11) `DEC-GRANT-003`, 📌: *«La promo cuyo monto compuesto cae bajo el piso del proveedor se rechaza
  al canjear, con el motivo en pantalla; ya no se ejecuta como cortesía (4b)»*. Y
  `DESTINO_DE_PLAN_ANUAL` → `DESTINO_DE_PLAN_NO_MENSUAL` donde el log lo nombre.
- (12) `DEC-ADDON-004` o la entrada de `F-8CA2-003`, 📌: *«La orfandad de `LISTING` se lee sobre el
  conjunto de las principales de su `user + vertical` y el ancla viva (4c); la de `USER`/`GLOBAL`,
  sobre las principales vivas y cobradas y las anclas vivas de sus verticales compatibles (4d);
  *«válida»* para comprar es `ACTIVE` y cobrada (4d, `R12-OWNER-2`); el borrado de la ficha lo
  ejecuta sólo `A6` (`K-9`)»*.
- (13) `DEC-GRANT-004`, 📌: los cruces 1 y 3 tienen fila (`S35`, `S34`).

**Contrato (`D/12`)**: `§2.6` fila de `PAUSED` por `CUSTOMER_REQUEST`, si enumera qué emite una
fila de complemento: la complemento pausada por `S32` no emite y no hace falta (el pliegue ya la
descartaba sin título). Sin cambio obligatorio.

## 5. Recuentos de listas cerradas

| lista | antes | ahora | comando |
|---|---|---|---|
| transiciones de la suscripción (`B/03` §3.2) | 31 | **35** (`S32`–`S35`) | `rg -n "^\| (\*\*)?S[0-9]+" 03-maquinas-de-estado.md`; citas del número en el corpus: `rg -n -o "S1.{1,3}S31\|31 transiciones\|treinta y un"` sobre `$W` sin informes → **cero** fuera del informe `06` |
| `desde` de conjunto (`B/03` §3) | 6 | **8** | lectura de la tabla; `rg -n "conjunto de filas" $W` → sólo `B/03:29` y `:1968` (este último no cuenta) |
| transiciones que sacan una principal de las filas vivas (`B/16` §4.3) | 12 | **13** (`S31`) | `rg -n -o ".{0,80}\b(doce\|seis) (transiciones\|que sacan).{0,60}" $W` sin informes → sólo `V/03:521`, que es otra máquina; las de `B/03` y `B/16` corregidas |
| salidas de `PAUSED` además de `S10` | 4 | **6** (`S22`, `S13`, `S17`, `S25`, espejo, `S6`) | `rg -n -o ".{0,60}(cuatro\|tres) salidas.{0,60}" $W` → `B/03:785` queda en el párrafo de rastro; `B/09` corregido |
| filas de `V/20` §2 / guards distintos / sin unidad | 18 / 30 / 0 | **19 / 31 / 1** | `rg -n "^\| \*?\*?G" V/20-testing.md` (19 filas); `rg -n "G-R2-C"` sobre las dos `descomposicion.md` → cero |
| caminos del motivo 14 *«el cliente actuó»* (`B/03`) | 7 | **8** (`S31`) | lectura de la tabla |
| motivos de marca (`B/02` §2.5) | 22 | **22** — sin cambio | 4a usa el 22 y `REANUDACIÓN_NO_APLICADA`; `K-9` y 4d, el 14 |
| `motivo_cierre` (`B/02` §2.4) | 4 | **4** — renombrado un valor | `rg -n "DESTINO_DE_PLAN_ANUAL" $W` sin informes → sólo apariciones tachadas en `B/*` |
| máquinas / estados / acciones administrativas | 10 / 9 / 14 | sin cambio | `S34` usa *«otorgar cortesía»*, que ya está en el catálogo |

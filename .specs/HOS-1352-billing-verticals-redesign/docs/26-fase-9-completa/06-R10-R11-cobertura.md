---
title: "FASE 9 completa · R10 y R11 — la cobertura que cambia y la vertical que cierra"
linear: HOS-1352
statusSource: linear
created: 2026-09-25
updated: 2026-09-25
status: CURRENT
fase: 9
---

# FASE 9 completa · R10 y R11 — la cobertura que cambia y la vertical que cierra

`DEC-METH-004` pide dos cosas para dar un racimo por resuelto: que el camino de cada hallazgo,
reejecutado sobre el texto **corregido**, ya no llegue; y que la regla corregida se verifique
contra **todo** el dominio que cuantifica. Acá van los dos racimos de cobertura de la FASE 8
completa: **R10** (nueve hallazgos) y **R11** (dos).

**Este documento no edita nada.** Las correcciones se proponen; el orquestador las aplica. Todas
las citas se verificaron contra el texto del 2026-09-25 en la worktree
`hospeda-spec-hos-1352-billing-redesign`. Abreviaturas de ruta:

- `C` = `HOS-1352-…/docs/12-contrato-de-cobertura.md`
- `N/01`, `N/04`, `N/07` = `HOS-1352-…/docs/nucleo/01-glosario.md`, `04-invariantes.md`,
  `07-outbox-y-notificaciones.md`
- `V/NN` = `HOS-1353-verticales-capacidades-y-autorizacion/docs/NN-*.md`
- `B/NN` = `HOS-1354-billing-cobro-y-proveedor/docs/NN-*.md`
- `LOG` = `HOS-1352-…/docs/01-decision-log.md`

**Resumen de veredictos**: 11 caminos reejecutados — **11 DEJAN DE LLEGAR**, 0 siguen llegando,
0 llegan a otra cosa. El dominio de R10 tiene **72 casos** y el de R11 **24**. Quedan **dos
residuos AL OWNER** (uno por racimo), **cuatro de borde** (dos sin declarar, dos declarados de
más estrecho) y **cuatro contradicciones de texto**.

---

## R10 · La cobertura cambia y verticales no se entera

### 1. La regla corregida

`DEC-ARCH-009` (`LOG:5252`), llevada al capítulo en `V/03:876-879`:

> **Una vez por día, el reconciliador le pregunta al contrato por cada dueño de la población, lo
> compara con el estado de sus fichas y, si no coinciden, corre la transición que el aviso habría
> disparado.** Tapa los tres agujeros sin importar por qué hay diferencia —aviso perdido, fecha
> vencida o un camino que nadie previó—, porque se apoya en la pregunta y no en un mensaje.

Las piezas que la completan:

- **La población** (`V/03:881-882`): *«todo `user + vertical` con al menos una ficha que **no** esté
  en `DRAFT` ni en `PURGED` **ni en `MODERATED`**»*, más los partners con presencia
  (`V/03:887-894`).
- **La pregunta, en vivo** (`V/03:896-898`): *«Se hace en vivo y nunca contra el caché»*.
- **La tabla de qué corre** (`V/03:902-907`): fila 1, `cubierto` falso con alguna `PUBLISHED` →
  `PB2` primera rama + hecho 5; fila 2, `cubierto` verdadero con cupo libre y candidatas →
  `PB3`/`PB7` + hecho 2; fila 3, `cubierto` verdadero con excedente → `PB2` segunda rama.
- **Invalida sólo cuando corre algo** (`V/03:909`, `V/02:482`).
- **El aviso sigue siendo el camino rápido**, y su definición no cambió: `C:778`
  *«evento: la cobertura de (user, vertical) cambió»*; ahora con **cuatro** consumidores
  (`C:782-791`) y un segundo disparador sin cambio de fuente, el primer pago acreditado
  (`C:793-799`).
- **Lo que no cierra**, declarado en `V/03:953-977` (cuatro puntos).

### 2. El dominio

Lo que la regla cuantifica es **todo lo que puede cambiar la respuesta de `cobertura(user,
vertical)` × si ese cambio lleva aviso × si el reconciliador lo relee**, más **los actos de
verticales que quitan y que devuelven**. Cinco ejes, cada uno con su fuente:

| eje | casos | fuente |
|---|---|---|
| transiciones de la suscripción | `S1`…`S31` (31 filas) + el espejo de la baja decidida por el proveedor; `S10`, `S22`, `S25` y `S31` se abren en dos por su `desde` (cortesía/pedido, o `ACTIVE`/`PENDING`) → **36** | `B/03:128-158` (tabla), `B/03:2555` (espejo, §10.1) |
| pago y addon | `P1`, `P6`, `P7`; `A2`, `A4`, `A5`, `A6` (`A1` y `A3` no mueven fuente) → **7** | `B/03:1635-1641`, `B/03:2364-2369` |
| grant y catálogo | revocación del grant; versión nueva de un plan anclado (otorgar y anclar son `S13`) → **2** | `V/02:475`, `V/02:480` |
| trial (verticales) | `T1`…`T7` → **7** | `V/03:43-50` |
| vencimientos por fecha **sin** transición | fin de `CANCEL_SCHEDULED`, fin de cortesía, fin del trial, fin de addon `DÍAS_FIJOS`, `vertical.fin_de_servicio` → **5** | `C:357` (los cuatro `fecha`), `C:574-578` (fin de servicio) |
| actos de publicación | `PB1`…`PB12`, con `PB2`, `PB3` y `PB7` abiertas en sus dos ramas → **15** | `V/03:438-449` |
| **total** | **72** | contado con script sobre `scratchpad/r10/dominio.tsv` |

Qué emite cada estado —y por lo tanto qué transición cambia `cubierto`— sale de la tabla
`C:405-416`: emiten `ACTIVE`, `GRACE_PERIOD`, `PAUSED·COURTESY` (como `CORTESÍA`) y
`CANCEL_SCHEDULED`; no emiten los otros seis. Y una predecesora con sucesora `ACTIVE` deja de
emitir en el acto (`C:461-463`), así que `S17` no cambia nada.

**Qué significa «lleva aviso».** Ninguna épica tiene un mapa fila por fila, y no hace falta: el
evento se define por su efecto (`C:778`) y el contrato lo empuja cada vez que la respuesta cambia
(`C:781`). La única fila que lo nombra aparte es `P1` (`B/03:1635`), porque su cambio no aparece ni
apaga ninguna fuente. Los vencimientos por fecha **no** lo llevan, y eso está declarado
(`C:390-393`).

### 3. Los caminos reejecutados

#### `F-8CA2-002` (CRÍTICO) — el aviso perdido de la vuelta encierra la ficha

1. *Juan está `SUSPENDED`; `PB2` le bajó sus 3 fichas.* Sigue igual: `SUSPENDED` no emite
   (`C:413`) y `PB2` baja por el cambio (`V/03:439`).
2. *Vuelve por el checkout (`S1` → `S2`), `cubierto` pasa a verdadero, el aviso se pierde.* Sigue
   posible: el aviso no tiene transporte durable, *«perderlo es un caso declarado, no un
   incidente»* (`C:802-803`). Con tarjeta vuelve como sucesora (`B/03:134`), que llega a `ACTIVE`
   por `S2`.
3. *`PB3` no dispara y nada más corre.* **Acá se corta.** Las fichas están en
   `UNPUBLISHED_BY_BILLING`, así que Juan está en la población (`V/03:881-882`); al día siguiente el
   reconciliador pregunta en vivo, encuentra `cubierto` verdadero con cupo y candidatas, y corre
   `PB3` (`V/03:905`, fila 2) e invalida (`V/03:909`).
4. *El día 90 `PB4` relee y reinicia sin restituir, cada 90 días.* Ya no se alcanza: la ficha
   volvió el día 1. Y el texto dice ahora a quién le toca: *«La relectura no restituye: si el aviso
   perdido era el de la vuelta, la ficha que está abajo la republica el reconciliador diario de
   cobertura»* (`V/03:483-485`; igual `C:827-830`).
5. *Juan no tiene salida propia.* Sigue siendo cierto y deja de importar: la salida es del sistema.

**Veredicto: DEJA DE LLEGAR**, con el día de atraso que `DEC-ARCH-009` acepta (`V/03:949-951`).

#### `F-8CC1-005` — la relectura existe sólo para los que quitan

1. *Juan pausa (`S8`) y `PB2` baja sus 3 fichas.* Igual (`C:411`).
2. *Reanuda (`S10`) y paga; el aviso se pierde.* Igual.
3. *`PB3` no dispara; el caché cae a lo sumo en la regla 2 de `V/02` §3.2.* **Se corta**: fila 2
   del reconciliador (`V/03:905`). Si la pausa pasó el día 90 y la ficha está `ARCHIVED`, corre
   `PB7`, que exige el origen correcto (`V/03:444`); la de `PB4` lo tiene.
4. *`PB4` reinicia indefinidamente.* Ya no llega: la ficha está publicada.

**Veredicto: DEJA DE LLEGAR.** La simetría que el hallazgo pedía —releer también al restituir— se
resolvió con un ejecutor aparte y no con la relectura de `PB4`, y el texto lo dice (`V/03:483-485`).

#### `F-8CA1-007` — el `hasta` vencido no invalida el caché

1. *Juan en `CANCEL_SCHEDULED`, fin el día 30, conjunto cacheado.* Igual (`C:414`).
2. *El job de `S12` falla.* Igual.
3. *`cobertura()` ya no emitiría la fuente, pero nadie la llama.* **Se corta**: el reconciliador la
   llama en vivo una vez por día (`V/03:896-898`), encuentra `cubierto` falso con fichas publicadas,
   corre `PB2`, escribe el hecho 5 e invalida (`V/03:904`, `V/03:909`). `C:390-397` lo nombra como la
   pieza que *«lleva hasta ellos»* la segunda línea.
4. *Juan sigue publicando y usando el plan hasta que vuelva el job.* Para Juan, que tiene fichas
   publicadas, dura hasta el día siguiente.

**Veredicto: DEJA DE LLEGAR.** La variante **sin** fichas publicadas no se corta —no hay diferencia
que invalide— y está declarada: `V/03:960-964`, punto 2. La propuesta del hallazgo (que la entrada
lleve el menor `hasta` como vencimiento propio) **no** se adoptó; el residuo queda donde el punto 2
dice.

#### `F-8CC1-009` — la fuente que vence no produce aviso

1. *Juan en `CANCEL_SCHEDULED`, fin el día 10; `S12` no corre.* Igual.
2. *Día 10: no hay transición, ni aviso, ni invalidación.* Igual, y ahora **declarado** como
   comportamiento: *«Que la fecha pase no es una transición: no emite el aviso del §3 ni invalida el
   caché»* (`C:391-393`).
3. *Las fichas siguen publicadas y la única red es `PB4` a 90 días.* **Se corta**: fila 1 del
   reconciliador al día siguiente (`V/03:904`).

**Veredicto: DEJA DE LLEGAR.** La *«segunda línea»* de `C:386-388` ya no promete una defensa que
no existe: `C:390` agrega *«y la segunda línea sólo la ve quien pregunta, así que tiene que haber
quien pregunte»*.

#### `F-8CC1-011` — el censo de consumidores omite al trial

1. *La fila `cubierto` del §2.1 no nombra a `T1` ni a `T6`.* **Se corta**: los nombra —*«**`T1` y
   `T6`** de la máquina de trial, cuya guarda es este campo»* (`C:111`).
2. *El §3 dice que el aviso alimenta tres cosas y omite la máquina de trial.* **Se corta**: dice
   **cuatro** y la cuarta es la máquina de trial (`C:782-791`).
3. *Quien implemente el emisor contra el §3 no despierta al trial.* Ya no: la lista que va a leer lo
   incluye.

**Veredicto: DEJA DE LLEGAR.** El aviso **perdido** hacia el trial sigue sin red y está declarado
(`V/03:967-973`, punto 3; `C:798-799`).

#### `F-8CA2-015` — los avisos previos de retención no releen

1. *Los avisos antes del 90 y del 180 se programan sobre `inactiva_desde`.* Igual.
2. *No releen.* **Se corta**: *«Los dos previos releen la cobertura del `user + vertical` antes de
   salir, y no salen si está cubierto»* (`N/07:231`), y figuran en el censo (`C:111`, *«los dos
   avisos previos de retención»*) y en `N/01:160-162`.

**Veredicto: DEJA DE LLEGAR.**

#### `F-8CA1-009` — sobre quién se evalúan los pasos 5-7 en `PB2`/`PB3`/`PB7`

1. *`V/17` §3.4 declara la clase del reloj y deja sin clase a las transiciones de sistema por
   evento.* **Se corta**: *«Y las transiciones del sistema que dispara un EVENTO no son de esta
   clase, y se declaran acá»*, nombrando `PB2`, `PB3`, `PB7`, los dos reconciliadores
   (`V/17:318-323`).
2. *La analogía disponible evalúa el cupo sobre el actor.* **Se corta**: *«En ellas los pasos 5, 6
   y 7 se evalúan sobre el SUJETO»* (`V/17:325-327`). `V/03:921-922` remite ahí para el
   reconciliador diario.

**Veredicto: DEJA DE LLEGAR.** Queda declarado cómo cumple un actor de sistema la regla 1 del §3.2
(`V/17:338-342`), que no es de este racimo.

#### `F-8CC1-008` — `hasta: fecha` no es «fin de la cobertura»

1. *El §2.6 le dice al aviso que `fecha` es «hay ventana, y es ésta».* **Se corta**: tachado y
   reemplazado por *«esta fuente deja de emitirse ese día —el fin de la emisión, no el de la
   cobertura»* (`C:357`).
2. *Para el trial, el contrato y `V/15` §4.4 se contradicen.* **Se corta**: *«manda `V/15` §4.4»*,
   y el fin del trial va sin ventana (`C:362-369`), igual que `V/15:385`.
3. *La cortesía anuncia una pérdida que no ocurre cuando detrás viene `S10`.* No se corta, y está
   **declarado** en los dos lados: `C:371-377` y `V/15:485-490`.

**Veredicto: DEJA DE LLEGAR** en la contradicción; la mitad de la cortesía es residuo declarado.

#### `F-8CA2-016` — `S7` restituye sin cupo

1. *`S7` dice «se restituye la publicación».* **Se corta**: tachado y reemplazado por *«la fila
   vuelve a emitir fuente […] y ese cambio de cobertura es lo que restituye la publicación por
   `PB3`/`PB7`, si el cupo alcanza»* (`B/03:134`). Las otras dos copias también se corrigieron:
   `B/03:1836` y `B/05:271-273`.

**Veredicto: DEJA DE LLEGAR.**

### 4. El dominio recorrido

Tabla completa en `scratchpad/r10/dominio.tsv`; recuento por script. Leyenda de resultado:
**SIN EFECTO** = no cambia nada que las fichas o el caché reflejen (o cambia sólo el `hasta`/el
`tipo` con la misma referencia); **CUBRE** = si el aviso se pierde, el reconciliador corre la
transición al día siguiente; **CUBRE +D** = cubre, con un residuo ya declarado.

| caso | cambio | aviso | reconciliador | resultado | residuo |
|---|---|---|---|---|---|
| `S1`, `S3`, `S4`, `S5`, `S14`, `S15`, `S17`–`S21`, `S22`·pedido, `S23`, `S25`·pedido, `S27`, `S28`, `S30`, `S31`·`PENDING`, `P7` (19) | ninguno | no hace falta | — | SIN EFECTO | `S1`: ver R11 |
| `S9`, `S10`·cortesía, `S11`, `S26` (4) | `tipo` o `hasta`, misma referencia (`B/02` §2.4 vía `C:373`) | sí (`C:778`) | — | SIN EFECTO | — |
| `S2`, `S7`, `S10`·pedido, `S29` (4) | `cubierto` f → v | sí | fila 2 | CUBRE | α-bis, δ |
| `S13` (1) | cambia la fuente; f → v si no había título | sí | fila 2 o 3 | CUBRE | β, δ |
| `S6`, `S8`, `S12`, `S16`, `S22`·cortesía, `S24`, `S25`·cortesía, `S31`·`ACTIVE`, espejo, `P6`, revocación del grant (11) | `cubierto` v → f | sí | fila 1 | CUBRE | α, β |
| `P1` (1) | `cobrada` no → sí | sí, **nombrado** (`B/03:1635`) | no lo relee | CUBRE +D | δ (declarado) |
| `A2`, `A4`, `A5`, `A6` (4) | cupo y capacidades | sí | fila 2 o 3 | CUBRE | β |
| versión nueva de plan anclado (1) | cupo y capacidades | interno a verticales (`V/02:480`) | fila 2 o 3 | CUBRE | — |
| `T1`, `T4`, `T6`, `T7` (4) | `T1` en el mismo acto que `PB1`; los otros, `hasta` o nada | interno | — | SIN EFECTO | — |
| `T2`, `T5` (2) | el título ya es otra fuente | interno | — | SIN EFECTO | δ (declarado) |
| `T3` (1) | v → f | interno (`V/03:46`) | fila 1 | CUBRE | α, β |
| vencen por fecha: `CANCEL_SCHEDULED`, cortesía, trial, addon (4) | v → f, o cupo | **no**, declarado (`C:391-393`) | fila 1 o 3 | CUBRE +D | α; β declarado en `V/03:960` |
| vence `fin_de_servicio` (1) | v → f para todos | no (`C:574-576`) | el barrido, y fila 1 como red | CUBRE en fichas | **γ — AL OWNER** |
| `PB2`a, `PB2`b, `PB3`a, `PB3`b, `PB7`a, `PB7`b (6) | quitan / devuelven por evento | es su evento | filas 1, 3, 2, 2, 2, 2 | CUBRE | — |
| `PB4`, `PB5`, `PB9` (3) | quitan por reloj | releen (`V/03:473-480`) | — | CUBRE | — |
| `PB6` (1) | el dueño libera cupo | — | fila 2 al día siguiente | CUBRE +D | punto 4 (`V/03:974-977`) |
| `PB1`, `PB8`, `PB10`, `PB11`, `PB12` (5) | actos del dueño o del admin | — | `MODERATED` fuera de la población (`V/03:884-885`) | CUBRE | — |

**Recuento** (script): 72 casos; **29 SIN EFECTO**, **41 CUBRE**, **2 CUBRE +D** en la clasificación
del script (los 4 vencimientos se contaron como CUBRE con residuo declarado). **Ningún caso donde la
ficha quede en el estado equivocado más de un día**, salvo los que declara el ⚠️ de `V/03:953-977`.
Los residuos aparecen así: **α/α-bis** en 15 casos, **β** en 21 (más 4 ya declarados para las
fechas), **δ** en 8, **γ** en 1.

### 5. Residuos de R10

#### AL OWNER · γ — el día del fin de servicio nadie invalida el caché de quien cubría un grant, una cortesía o un trial

**El caso, con un cliente.** Juan tiene un *Free Forever* anclado en Gastronomía. Llega
`vertical.fin_de_servicio`: el contrato deja de emitirle la fuente `GRANT` (`C:534-536`) y el
barrido del día le baja las fichas por `PB2` (`B/10:270-272`). Al día siguiente el reconciliador
pregunta, encuentra `cubierto` falso **y ninguna ficha publicada** —el barrido ya las bajó—, así que
no corre nada y **no invalida** (`V/03:909`, *«cuando corre algo»*). La entrada del caché de Juan en
Gastronomía sigue diciendo lo que otorgaba el grant: el paso 6 de la autorización se resuelve contra
ese conjunto (`V/02:458`). **No hay ningún job atascado que vaya a volver**: el grant no tiene
transición ese día, y ninguna fila de la lista de invalidación nombra la fecha de fin de servicio
(`V/02:470-482`; `rg -i "invalid"` sobre `B/10` no devuelve nada). La entrada otorga hasta que venza
la red de tiempo, **que no tiene valor declarado**. Lo mismo para la cortesía (hasta `S25`) y el
trial (hasta `T3`).

**Por qué es AL OWNER y no de borde.** El ⚠️ punto 2 de `V/03:960-964` alcanza este caso por la
letra —*«si el dueño no tiene ninguna ficha publicada»*— pero lo describe como algo que *«pasa sólo
cuando esa primera línea falla»*. Acá **no falla nada**: pasa siempre, a toda la población de grant,
cortesía y trial de una vertical que cierra. Es acceso en el camino principal de la
discontinuación.

**Opciones:**

1. **Una fila más en `V/02` §3.2**: *«llega `vertical.fin_de_servicio` → invalida todas las entradas
   de esa vertical»*, ejecutada por el barrido del día (`B/10` §4.3), que ya recorre las fichas de la
   vertical. Costo: una fila y una línea en el barrido. Riesgo: ninguno; invalidar es borrar
   (`V/02:497`), y lo peor que pasa es recalcular de más.
2. **Que el reconciliador invalide siempre que lea `cubierto` falso**, haya o no diferencia. Costo:
   invalida todos los días a todos los dueños sin cobertura. Riesgo: rendimiento, y no alcanza a
   quien no tiene fichas.
3. **Dimensionar la red de tiempo** del caché y aceptar la ventana. Costo: cero. Riesgo: acceso a
   capacidades de una vertical cerrada durante lo que dure el TTL, sin cota escrita.

**Recomendación: la 1.** Es mecánica, usa el ejecutor que ya existe ese día, y deja el punto 2 del
⚠️ con su texto verdadero: *«pasa sólo cuando esa primera línea falla»* vuelve a ser cierto.

#### DE BORDE · α — el hecho 5 sin red alcanza a más dueños que «el que sólo tiene borradores»

**Qué pasa.** Con el aviso de la caída perdido, el reconciliador escribe el hecho 5 **sólo junto con
`PB2`** (`V/03:904`, `V/03:933-940`), y `PB2` necesita una ficha `PUBLISHED`. El texto declara el
residuo para *«el dueño que sólo tiene borradores»* (`V/03:956-959`; igual `C:845`, `N/01:253-256`,
`N/04:171`). Pero la población sin ficha publicada es más grande: un dueño cuyas fichas están todas
en `ARCHIVED` (p. ej. borradores que archivó `PB5`) o en `UNPUBLISHED_BY_BILLING` **está** en la
población y tampoco tiene diferencia que delate la caída. `N/01:239-241` ya lo intuye: *«"todas"
incluye por la letra a las fichas ya `ARCHIVED` del dueño, que la decisión no nombró aparte»*.

**Y el encabezado del ⚠️ dice más de lo que es.** `V/03:953-954` afirma que ningún punto *«borra
datos»*. Para una ficha `ARCHIVED` de un dueño cubierto, el reloj puede tener hasta 180 días —`PB9`
lo reinicia al releer y encontrarlo cubierto—, así que sin el hecho 5 `PB9` puede borrar el
contenido **pocos días después de la caída**, y el aviso previo del día 180 pudo haber quedado
suprimido mientras estaba cubierto (`N/07:231`). Es un borrado adelantado. No es camino principal
—requiere el aviso perdido, que el diseño declara posible pero no normal—, por eso queda de borde.

**Declaración propuesta**, en `V/03` §9, reemplazando el punto 1 del ⚠️ (`V/03:956-959`):

> 1. **El dueño sin ninguna ficha publicada en el momento de la caída no tiene red para el hecho 5.**
>    Si se pierde el aviso, el reconciliador no encuentra una ficha `PUBLISHED` que delate la
>    diferencia y no escribe el hecho 5 —sólo lo escribe junto con `PB2`, por la razón de arriba—.
>    Alcanza al que sólo tiene borradores, que además está fuera de la población, **y al que tiene
>    sus fichas en `ARCHIVED` o en `UNPUBLISHED_BY_BILLING`**, que está adentro. Su red sigue siendo
>    la relectura de `PB5` y la de `PB9` sobre el reloj viejo, **y eso puede adelantar el borrado del
>    día 180**: el reloj de una ficha `ARCHIVED` de un dueño cubierto puede tener hasta 180 días,
>    porque `PB9` lo reinicia al releer. Causa: una ficha no publicada no guarda memoria de que
>    antes había cobertura (cap. 01 §1.2, núcleo, ⚠️ punto 3).

Y en `V/03:953-954`, cambiar *«ninguno mueve plata en el camino principal, da acceso indebido en él
ni borra datos»* por *«ninguno mueve plata ni da acceso indebido en el camino principal, y el único
que puede adelantar un borrado —el punto 1— necesita un aviso perdido»*.

#### DE BORDE · β — el caché sin diferencia de fichas, cuando lo que se perdió es el aviso de una transición

**Qué pasa.** `C:809-811` dice que lo que el reconciliador no cubre *«—la máquina de trial, el dueño
que sólo tiene borradores, **el caché sin diferencia de fichas**— está declarado en el ⚠️ de ese
§»*. Pero el ⚠️ lo declara **sólo para una fecha que vence** (`V/03:960`, *«La fecha que vence sin
transición se corrige sólo si produce una diferencia de fichas»*). El caso de una **transición**
cuyo aviso se pierde y que no mueve ninguna ficha —un downgrade sin excedente, un addon que vence,
un grant que se otorga sobre una suscripción, una caída sin fichas publicadas— deja la entrada
otorgando lo viejo hasta la red de tiempo, y no está escrito. Es el mismo mecanismo con otro
disparador. Afecta 21 casos del dominio.

**Y el mismo punto nombra jobs de menos.** Enumera *«`S12`, `T3` o el de un addon `DÍAS_FIJOS`»* y
omite el de la cortesía (`S10`/`S25`), que es el cuarto `hasta: fecha` de `C:357`.

**Declaración propuesta**, en `V/03` §9, reemplazando la primera frase del punto 2 (`V/03:960`):

> 2. **Una diferencia que no mueve fichas no invalida el caché**, venga de una fecha que vence sin
>    transición o de una transición cuyo aviso se perdió. Si el dueño no tiene ninguna ficha
>    publicada, o no está en la población, o la persona no tiene fichas, o el cambio sólo toca
>    capacidades que no son cupo, el reconciliador no encuentra nada y **no invalida**: la entrada
>    sigue otorgando hasta el próximo evento de la lista del cap. 02 §3.2, hasta que corra el job
>    atascado (`S12`, `S10`/`S25`, `T3` o el de un addon `DÍAS_FIJOS`) o hasta que venza la red de
>    tiempo. Causa: el reconciliador compara estados de ficha, no conjuntos efectivos.

(Si el owner elige la opción 1 de γ, el caso del fin de servicio sale de este punto.)

#### DE BORDE · δ — la máquina de trial sin red

**Ya declarado**: `V/03:967-973` (punto 3) y `C:798-799`. Lo verifiqué contra los 8 casos del
dominio donde aparece un título (`S2`, `S7`, `S10`·pedido, `S13`, `S29`, `P1`, `T2`, `T5`): en todos
el aviso perdido deja dos títulos hasta `T3`, y en todos la cita alcanza.

#### DE BORDE · la ventana del fin de una `CANCEL_SCHEDULED`

`C:357` pone el fin de una `CANCEL_SCHEDULED` entre los `fecha` y remite la ventana a `V/15` §4.4,
pero la tabla de `V/15:382-385` no lo clasifica ni con ventana ni sin ella (`rg
"CANCEL_SCHEDULED|baja programada|pide la baja"` sobre `V/15`: sin resultados). No mueve plata ni
acceso: la baja la pidió la persona y sus avisos son de billing. **Declaración propuesta**, en el
«NO cierra» de `V/15`: *«El fin de una suscripción en `CANCEL_SCHEDULED` no está en la tabla del
§4.4. La baja la pidió la persona y sus avisos son los de `B/19` §4; este capítulo no le promete una
ventana para elegir qué fichas conservar, porque no queda título que conserve ninguna.»*

#### CONTRADICCIÓN DE TEXTO · la población del reconciliador, en el censo

- `C:111`: *«el reconciliador diario de cobertura, que lo pregunta una vez por día por cada dueño
  con fichas fuera de `DRAFT` y `PURGED`»*.
- `C:804` y `V/03:881-885`: fuera de `DRAFT`, `PURGED` **y `MODERATED`** (`F-8CA2-004`).

**Corrección**: en `C:111`, *«fuera de `DRAFT`, `PURGED` y `MODERATED`»*.

---

## R11 · Una vertical discontinuada no cubre a nadie desde su fin de servicio

### 1. La regla corregida

`C:534-536` (§2.6, *«Una vertical discontinuada no cubre a nadie»*):

> **Desde `vertical.fin_de_servicio` (`V/02` §2.1), el contrato no emite en esa vertical ninguna
> fuente de `tipo` `TRIAL`, `SUSCRIPCIÓN`, `CORTESÍA` ni `GRANT`, cualquiera sea el estado que la
> sostenga.** `cubierto` pasa a falso para todos en el mismo instante.

Con su gemela del día 0: *«La vertical deja de admitir altas y trials —los trials, porque `T1`
exige `admite_altas`»* (`B/10:149-150`), y la guarda nueva de `T1` (`V/03:44`).

### 2. El dominio

**Cada fuente de cobertura × las dos fases de una discontinuación** —entre el anuncio y el fin de
servicio, y desde el fin de servicio—, **más cada acto que crea una fuente nueva después del
anuncio**. Ejes y fuentes:

- los seis `tipo` de fuente: `C:88`; más la promo, que **no** es fuente (mueve plata, no
  cobertura: `C:113` no la lista);
- las dos fases: `B/10:241-248` (la fecha única) y `B/10:149` (el día 0);
- los actos que crean fuente: `T1`, `T6`, `T7` (`V/03:44-50`), `T4` (`V/03:47`), `S1` alta y `S1`
  sucesión (`B/03:128`), `S9` por otorgamiento y por re-emisión diferida (`B/03:136`), `S13`
  (`B/03:140`), `A1` (`B/03:2364`).

Tamaño: **24 casos** (tabla del §4).

### 3. Los caminos reejecutados

#### `F-8CC1-001` (CRÍTICO) — discontinuar no apaga la cobertura

1. *Juan con Free Forever anclado en Gastronomía; Ana `PAUSED·COURTESY` con 100 días; Pedro en
   `PRE_TRIAL`.* Igual.
2. *Día 0: `S26`/`S27`/`S28` recorren las suscripciones; nada toca el grant ni la pausa.* Igual,
   y es deliberado: la regla *«no revoca el grant»* y *«no mueve ningún estado»* (`C:548-553`).
3. *Pedro publica el día 5 y `T1` le arranca un trial.* **Se corta dos veces**: `T1` exige *«la
   vertical admite altas»* (`V/03:44`), y `PB1` publica *«sólo si el dueño está cubierto […] o si
   esta publicación dispara `T1`»* (`V/03:438`). La tabla de `V/03:202` lo dice para este caso
   exacto: *«ninguna de las dos […] y no publica»*.
4. *Día 60: `cobertura()` devuelve el `GRANT` con `NO_VENCE` y la `CORTESÍA` con fecha posterior;
   `cubierto` no cambia y el evento de `PB2` no ocurre.* **Se corta**: desde el fin de servicio el
   contrato no emite ninguna de las dos (`C:534-536`); `cubierto` pasa a falso y `PB2` tiene su
   evento. Las baja el barrido (`B/10:270-272`), con el reconciliador como red.
5. *`PB4` relee, encuentra cubierto y reinicia; `PB3` puede republicar la de Juan.* Ya no: la
   relectura encuentra `cubierto` falso, y la segunda rama de `PB3` no tiene cupo que dar —sin
   título el pliegue deja sólo el piso, que otorga *«recuperar lo suyo»* y no publicar
   (`V/03:445`, `C:554-557`).

**Veredicto: DEJA DE LLEGAR.**

#### `F-8CA2-007` — la discontinuación no baja las fichas del grant anclado

1. *Juan con Free Forever en Gastronomía y dos fichas publicadas.* Igual.
2. *Llega el fin de servicio.* Igual.
3. *`PB2` no tiene evento.* **Se corta**: lo tiene (`C:542-544` lo cuenta como el defecto que la
   regla arregla; `B/10:258-261`).
4. *`PB4` relee y reinicia; Juan puede publicar fichas nuevas.* Ya no: `cubierto` falso; `PB1`
   exige cobertura o `T1`, y `T1` exige `admite_altas`.

**Veredicto: DEJA DE LLEGAR.** La pregunta de política que el hallazgo le hacía al owner —¿se
desancla? ¿se revoca?— se contestó con *«ninguna de las dos: deja de cubrir esa vertical»*
(`C:548-551`, `B/10:265`).

### 4. El dominio recorrido

| fuente o acto | entre día 0 y fin de servicio | desde el fin de servicio | cita | resultado |
|---|---|---|---|---|
| `TRIAL` en `PRE_TRIAL` | fuente `BASE`, no cubre | no se emite; resuelve contra el piso | `C:559-561` | OK |
| `TRIAL` en `TRIAL_ACTIVE` | cubre (por diseño) | no se emite | `V/03:68-70` | OK · caché → γ |
| `T1` después del día 0 | no dispara | no dispara | `V/03:44` | OK |
| `T6` / `T7` después del día 0 | fila consumida, sin cobertura nueva | ídem | `V/03:211-217` (razón escrita) | OK |
| `T4` (extensión) | corre el `hasta` | el contrato corta igual | `C:534-536` | OK |
| `SUSCRIPCIÓN` `ACTIVE`/`GRACE` → `S26` | cubre hasta la fecha única | `S12` la consuma | `B/10:161`, `B/10:268` | OK |
| `SUSCRIPCIÓN` `SUSPENDED` → `S27` | no cubría | — | `B/10:162` | OK |
| `SUSCRIPCIÓN` `PENDING` → `S28` | no cubría | — | `B/10:163` | OK |
| `SUSCRIPCIÓN` `PAUSED`·pedido | no cubría | `S25` al volver | `B/10:164` | OK |
| **`S1` alta nueva después del día 0** | **nada la frena** | **no cubre y el proveedor sigue cobrando** | `B/03:128` (sin `admite_altas`) | **AL OWNER** |
| **`S1` sucesión desde una `CANCEL_SCHEDULED` de `S26`** | **admitida por la letra** | **ídem** | `B/03:128` (*«la `CANCEL_SCHEDULED` tiene el preapproval ya cancelado por `S11` o `S26`»*) | **AL OWNER** |
| `CORTESÍA` vigente (`PAUSED·COURTESY`) | cubre | no se emite; la fila sigue `PAUSED` hasta `S25` | `B/10:266` | OK · caché → γ |
| `S9` otorgada por `SUPER_ADMIN` | sólo sobre `ACTIVE`, y no queda ninguna tras `S26` salvo las del residuo de `S1` | no se emite | `B/03:136` | OK (depende de `S1`) |
| `S9` re-emisión diferida (`DEC-GRANT-010`) | necesita un alta nueva | ídem | `B/10:214-215` | OK (depende de `S1`) |
| `GRANT` anclado antes del día 0 | cubre | no se emite; el ancla sigue viva | `B/10:265` | OK · caché → γ |
| `S13` otorga o ancla después del día 0 | cancela las `CANCEL_SCHEDULED` sin reembolso y cubre hasta la fecha | no se emite | `B/03:140`, `C:534-536` | OK (acto de `SUPER_ADMIN`, sin plata nueva) |
| versión nueva de un plan anclado | cambia capacidades | no se emite | `V/02:480` | OK |
| `ADDON` `VERTICAL`/`LISTING` de la vertical | su suscripción de complemento cae con `S26` | sin título, el pliegue lo descarta | `B/10:153-154`, `C:556-557` | OK |
| `ADDON` `USER`/`GLOBAL` con principal en otra vertical | aporta | sin título en esa vertical, no aporta ahí; sigue valiendo en las otras | `C:556-557` | OK |
| `A1` después del día 0 | exige principal `ACTIVE` (`B/16:107`), que no queda salvo por `S1` | ídem | `B/03:2364` | OK (depende de `S1`) |
| `BASE` | no cubre, por diseño | no cubre; es lo que deja `PB8` | `C:554-556` | OK |
| promo | no es fuente | no es fuente | `C:88` | fuera del dominio de cobertura |
| el hecho 4 (reloj) | — | lo escribe el barrido | `B/10:298-303` | OK |
| el día después del fin (red) | — | reconciliador fila 1 si quedó una publicada | `C:574-578` | OK |

**Recuento**: 24 casos; **17 OK**, **4 OK que dependen del residuo de `S1`**, **2 AL OWNER** (las
dos caras de `S1`), **1 fuera del dominio** (la promo). Tres de los OK llevan el residuo γ de R10
(el caché de quien cubría un trial, una cortesía o un grant).

### 5. Residuos de R11

#### AL OWNER · `S1` no exige que la vertical admita altas

**El caso, con un cliente.** El 1/10 `SUPER_ADMIN` anuncia la discontinuación de Gastronomía, con
fin de servicio el 30/11. El 5/10 Juan, que no tenía nada ahí, entra al checkout y contrata el plan
Básico mensual: `S1` sólo pide *«no hay otro origen vivo para ese `user + vertical`, o la fila
declara una sucesión»* (`B/03:128`) y la pricing sólo lee *«la versión vigente […] y sólo si es
vendible»* (`V/10:92`, `B/19:44`) —la discontinuación no retira ningún plan—. `S26` ya corrió el día
0, así que esta fila nace `ACTIVE` con un preapproval vivo. El 30/11 el contrato deja de emitirle la
fuente (`C:534-536`) y el barrido le baja las fichas; **la fila sigue `ACTIVE` y el proveedor le
cobra el 5/12, el 5/01 y cada mes**, por una vertical que ya no existe. Es exactamente lo que
`B/10:139` prohíbe: *«Se deja de cobrar antes de dejar de prestar. Nunca al revés.»*

**La segunda cara es la sucesión.** Ana, con su Premium en `CANCEL_SCHEDULED` por `S26`, cambia a
Básico el 10/10: `S1` admite por la letra una predecesora `CANCEL_SCHEDULED` (*«la
`CANCEL_SCHEDULED` tiene el preapproval ya cancelado por `S11` o `S26`»*, `B/03:128`), la sucesora
nace con un preapproval nuevo, `S17` cancela la predecesora, y el resto es el caso de Juan.

**Es el mismo defecto que `T1` tenía**, y `B/10:272-274` lo dice de `T1`: *«que es lo que el anuncio
ya decía —"la vertical deja de admitir altas y trials"— y ninguna fila hacía cumplir»*. El arreglo
cubrió los trials y no las suscripciones. `V/02:117` afirma que `admite_altas` *«la lee billing
(`B/10` §4.6)»*, pero ninguna fila de billing la lee (`rg "admite"` sobre `B/03`, `B/12`, `B/14`,
`B/16`: una sola mención, `B/03:879`, que habla de la re-emisión de cortesía).

**Opciones:**

1. **`S1` exige `situaciónDeVertical(vertical).admiteAltas`** para el alta nueva **y** para la
   sucesión, y la pricing no ofrece planes de una vertical que no admite altas. Costo: una
   condición en `S1`, una en la regla de lectura de `V/10:92`, y la fila de `B/19` que diga *«esta
   vertical ya no admite altas»*. Riesgo: la persona en `CANCEL_SCHEDULED` no puede cambiar de plan
   durante la cola de la discontinuación, que es coherente con que se vaya a cerrar. Lee un campo
   que el contrato ya declara (`C:905`): no hay campo nuevo.
2. **Permitir la sucesión y prohibir sólo el alta nueva**, y hacer que toda sucesora de una
   vertical discontinuándose nazca con fin de servicio en la fecha única. Costo: una rama nueva en
   `S1`/`S2` y un estado de nacimiento que hoy no existe (sucesora directo a `CANCEL_SCHEDULED`).
   Riesgo: más superficie en la máquina más cargada del programa, por un caso chico.
3. **Retirar todos los planes de la vertical el día 0** (el acto del §3 de `B/10`) como parte de la
   discontinuación. Costo: cero filas nuevas; la pricing y `A1` quedan cerrados por `vendible`.
   Riesgo: el grant lee la versión vigente «vendible o no» (`V/10:96`), así que no le afecta; pero
   la **sucesión** a otro plan quedaría cerrada sólo porque la pricing no ofrece nada, sin guarda
   en `S1` —un checkout abierto de antes o una llamada directa la seguiría admitiendo—.

**Recomendación: la 1.** Cierra las dos caras con una guarda en el lugar que ejecuta, usa el campo
que la frontera ya transporta, y hace verdadera la afirmación de `V/02:117`. `A1`, `S9` por
otorgamiento y la re-emisión diferida quedan cerrados por arrastre, porque dependen de una principal
`ACTIVE` que ya no puede nacer.

#### AL OWNER (compartido con R10) · γ — el caché de grant, cortesía y trial el día del fin de servicio

Es el mismo residuo de R10 §5 y se decide una sola vez. En R11 es la mitad que falta para que la
regla *«no cubre a nadie»* valga también **en el camino de lectura**: la emisión se corta
(`C:534-536`), pero la entrada cacheada de esas tres poblaciones sigue otorgando capacidades de la
vertical cerrada.

#### DE BORDE · declarados

- *«El `hasta` no refleja la fecha de fin de servicio»*: declarado en `C:580-585`.
- *«El `saldo_meses` que escribe `S25` no cuenta los meses que la regla nueva dejó sin cubrir»*:
  declarado en `B/10:285-292`.
- `T6` y `T7` no exigen `admite_altas`: no es residuo, es decisión con razón escrita (`V/03:211-217`).

#### CONTRADICCIÓN DE TEXTO · ¿vuelve la cobertura con un alta nueva en una vertical discontinuada?

- `B/03:734-737` (sobre `S25`): *«La fila muere, pero `PB3`/`PB7` republican sus fichas en cuanto
  vuelva a estar cubierta (`V/03` §9), y la cobertura vuelve con el alta nueva de `S1`.»*
- `B/10:214-215`: *«Sobre una vertical discontinuada esa alta nueva no va a existir»*; y
  `B/10:282`: *«la vertical queda cerrada a altas para siempre»*.

Hoy las dos son «verdaderas» porque `S1` no mira `admite_altas` (residuo de arriba). **Corrección
propuesta** (con la opción 1): en `B/03:736-737`, *«y la cobertura no vuelve: la vertical dejó de
admitir altas (`B/10` §4.3), así que no hay alta nueva que la devuelva. Lo que le queda es lo suyo:
`PB8` y la exportación, sobre la versión de piso»*.

#### CONTRADICCIÓN DE TEXTO · quién lee `admite_altas`

- `V/02:116-117`: *«`admite_altas` y `fin_de_servicio` las **lee billing** (`B/10` §4.6)»*.
- `B/10:365-381` (§4.6) describe las situaciones de la vertical y no nombra ningún lector; ninguna
  fila de `B/03` lee `admite_altas` (`rg -o "admite(_altas|Altas| altas)"` sobre `B/03`, `B/12`,
  `B/14`, `B/16`: un solo resultado, `B/03:879`, ajeno).

**Corrección propuesta**: con la opción 1, agregar a `B/10` §4.6 *«La lee `S1` (`B/03` §3.2): la
vertical que no admite altas no admite suscripciones nuevas ni sucesiones»*. Sin la opción 1,
cambiar `V/02:117` a *«la lee la máquina de trial (`T1`); billing lee sólo `fin_de_servicio`»*.

---

## Lo que pide owner, en una lista

1. **R11 · `S1` y `admite_altas`** — un alta o una sucesión en una vertical que se está
   discontinuando nace con un preapproval que cobra después del fin de servicio. Recomendación:
   guarda en `S1` (opción 1).
2. **R10/R11 · γ, el caché el día del fin de servicio** — grant, cortesía y trial siguen otorgando
   desde el caché en una vertical cerrada. Recomendación: una fila en `V/02` §3.2, ejecutada por el
   barrido del día (opción 1).

## Contradicciones de texto, en una lista

1. `C:111` omite `MODERATED` en la población del reconciliador; `C:804` y `V/03:881-885` la excluyen.
2. `C:809-811` dice que el caché sin diferencia de fichas está declarado en `V/03` §9; el punto 2 de
   ahí (`V/03:960`) lo declara sólo para fechas, y omite el job de la cortesía (residuo β).
3. `B/03:734-737` promete cobertura por un alta nueva en una vertical discontinuada;
   `B/10:214-215` y `B/10:282` dicen que esa alta no existe.
4. `V/02:116-117` dice que billing lee `admite_altas` en `B/10` §4.6; ninguna fila de billing la lee.

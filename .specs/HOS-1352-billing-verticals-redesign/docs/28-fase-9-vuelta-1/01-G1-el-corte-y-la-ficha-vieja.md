---
title: "FASE 9 vuelta 1 · el corte y la ficha vieja"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 9
---

# FASE 9 vuelta 1 — el corte y la ficha vieja

Grupo **G1**. Resuelve los racimos **R1** (crítico declarado de la vuelta), **R6** y **R7** del
consolidado `27-fase-8-vuelta-1/00-hallazgos.md`, más los hallazgos sueltos de su §3 cuyo ID
empieza con `F-8V1A3-` o `F-8V1C2-` y no están en ningún racimo. **27 hallazgos**, listados con
script contra el consolidado (11 en racimos, 16 sueltos).

**Sobre qué texto se midió.** Los capítulos citados se tocaron por última vez el 2026-09-26 a las
02:37, antes de los nueve informes, y ningún commit posterior los cambió: los 27 caminos **siguen
llegando**. Cada uno se re-verificó igual con `rg -n` con ruta explícita, y las citas de este
documento pasan `27-fase-8-vuelta-1/verificar-citas.py`.

**Qué no se reabre.** `2g` (la cartera estrena el trial y sólo se le respeta la ficha), `2a` (no
se conserva nada del billing viejo), `2c`, `2d`, `2e`, `5c`, `6c` y `7a` están decididos. Donde un
hallazgo choca con una de ellas, se dice y se propone cómo aplicarla.

---

## 1. Resumen

| hallazgo | ¿sigue llegando? | salida | capítulos afectados |
|---|---|---|---|
| `F-8V1C2-001` (R1, CRÍT) | sí | owner `G1-1` + aplicación | `V/03` §2 y §9, `V/21` §2.4, `V/19`, `D/16` §4.2 |
| `F-8V1A2-001` (R1) | sí | owner `G1-1` + aplicación | `V/03` §2 y §9, `V/21` §2.4 |
| `F-8V1A3-002` (R1) | sí | owner `G1-1` + aplicación | `V/03` §9, `V/21` §2.4, `V/19` |
| `F-8V1D1-001` (R1) | sí | owner `G1-1` + aplicación | `V/03` §9, `V/19`, `B/19` |
| `F-8V1A3-001` (R1) | sí | aplicación + owner `G1-2` | `V/21` §2.4, `V/02` §2.5, `B/21` §4 |
| `F-8V1A3-012` (R6) | sí | aplicación | `B/02` §2.2, `B/21` §2.5, `B/09` §3 |
| `F-8V1B3-003` (R6) | sí | aplicación | `B/02` §2.2, `B/21` §2.5, `B/descomposicion` |
| `F-8V1C2-005` (R6) | sí | aplicación | `D/16` §4.2, `B/21` §2.5 |
| `F-8V1D1-010` (R6) | sí | aplicación | `D/16` §4.2, `B/21` §2.5 |
| `F-8V1A3-011` (R7) | sí | aplicación | `B/21` §1.3, `V/21` §2.5 y §4, `D/16` §4.2 |
| `F-8V1C2-009` (R7) | sí | aplicación | `B/21` §1.3, `V/21` NO cierra, `D/07` |
| `F-8V1A3-004` | sí | aplicación + owner `G1-3` | `D/16` §4.2, `B/21` §2.4 |
| `F-8V1C2-002` | sí | owner `G1-4` | `B/21` §4 y NO cierra, `D/16` §4.2 |
| `F-8V1A3-006` | sí | aplicación | `V/02` §2.1 |
| `F-8V1A3-007` | sí | aplicación | `B/02` §2.2 |
| `F-8V1A3-010` | sí | owner `G1-5` + aplicación | `V/02` §4.1, `V/03` §9 |
| `F-8V1C2-004` | sí | aplicación | `D/16` §4.2, `B/descomposicion` |
| `F-8V1C2-006` | sí | aplicación | `D/16` §4.2 |
| `F-8V1C2-007` | sí | aplicación | `D/16` §4.2 |
| `F-8V1C2-008` | sí | aplicación | `D/16` §4.2 |
| `F-8V1C2-010` | sí | declarar | `D/16` §4.2 |
| `F-8V1C2-011` | sí | aplicación | `D/16` §4.2, `V/21` NO cierra |
| `F-8V1A3-013` | sí | aplicación | `N/04` §2.1, `V/02` §5 |
| `F-8V1A3-015` | sí | aplicación | `V/02` §3.2 |
| `F-8V1C2-012` | sí | declarar | `D/16` §4.2, `V/21` §2.4 |
| `F-8V1C2-014` | sí | aplicación | `B/21` §4 |
| `F-8V1C2-015` | sí | aplicación | `D/16` §1 y §3 |

Por salida principal: **8 owner** (los cuatro de R1 que dependen de `G1-1`, `F-8V1A3-001`,
`-004`, `-010` y `F-8V1C2-002`), **17 aplicación** y **2 declarar**. Ninguno dejó de llegar.

---

## 2. Los racimos

### 2.1 R1 · la ficha vieja nace sin estado y el dueño no puede estrenar el trial desde ella

#### Causa

`2g` se escribió como una frase sobre el trial y nunca se tradujo a la máquina de publicación.
El texto supone que la ficha vieja nace `PUBLISHED` y que `PB2` la baja, pero no lo declara, y
desde `UNPUBLISHED_BY_BILLING` la tabla no le da al dueño ningún acto que ejerza el evento de
activación. Son **dos huecos de la misma causa**: falta el estado de nacimiento de cada ficha vieja
(`F-8V1A3-001`) y falta la salida del dueño que `2g` supone (los otros cuatro).

Lo que el texto promete:

- `$V/docs/21-migracion.md:75` «nuevo: los tomamos como clientes nuevos. Sólo les respetamos la
  ficha para que no la tengan que»
- `$V/docs/21-migracion.md:155` «publicar —o el botón de suscribirse, que manda a publicar a quien
  todavía no publicó en esa»
- `$V/docs/03-maquinas-de-estado.md:223` «persona queda en `PRE_TRIAL`: su próximo `PB1`, sin
  cobertura, arranca el trial por `T1`.»

Lo que la máquina permite:

- `$V/docs/03-maquinas-de-estado.md:506` «| PB1 | `DRAFT` | el dueño publica | `PUBLISHED` | sólo
  si el dueño está cubierto»
- `$V/docs/03-maquinas-de-estado.md:516` «el dueño no la republica —`PB1` sale sólo de `DRAFT`— y el
  sistema tampoco»
- `$V/docs/03-maquinas-de-estado.md:529` «La ficha nace en `DRAFT`, y nacer no es una fila de esta
  tabla»
- `$V/docs/21-migracion.md:153` «se los llama, contratan, y la ficha vuelve sola por `PB3` cuando
  la cobertura vuelve.»

Y qué es *«publicó»* no está escrito para quien publicó sólo en el sistema viejo, aunque el
registro que leen `T7` y `T8` es el del sistema nuevo:

- `$V/docs/03-maquinas-de-estado.md:364` «encendido sigue resolviendo a quien ejerció el evento en
  el sistema nuevo.»
- `$B/docs/19-superficies.md:137` «y la regla de qué es «publicó» es de verticales»

#### Qué contesta ya el diseño y qué no

**Contesta** (aplicación): que `2g` quiere el trial por `T1` —la frase está en tres lugares—, que
publicar es un acto del dueño y restituir no lo es, que el registro de *«ya ejerció el evento»*
es el del sistema nuevo, y que `UNPUBLISHED_BY_BILLING ≠ DRAFT` existe para que **el sistema** no
republique lo que el dueño bajó:

- `$V/docs/03-maquinas-de-estado.md:628` «`UNPUBLISHED_BY_BILLING` es un estado distinto de `DRAFT`
  a propósito.»
- `$V/docs/03-maquinas-de-estado.md:950` «y `PB7` hace lo mismo un estado más atrás: restituir no es
  publicar. Leerlo al revés le»

**No contesta** (owner, `G1-1`): **por qué camino** el dueño viejo ejerce el evento. Hay tres
formas que respetan `2g`, y cambian cosas distintas. La recomendada es ensanchar el `desde` de
`PB1`; el recorrido de abajo está hecho sobre ella, y en `G1-1` están las otras dos con lo que
cambian.

**Tampoco contesta** (owner, `G1-2`): dos clases de ficha vieja que no tienen equivalente limpio
en la máquina nueva, la borrada por su dueño y la `REJECTED` de moderación.

#### Dominio declarado

La regla cuantifica **toda ficha que existe en la base el día del corte, por el estado que le dan
sus columnas viejas**, cruzada con **la situación de cobertura de su dueño en el corte**. Es una
lista cerrada:

**Eje 1 · clase de la ficha vieja** (columnas de `accommodations`; las otras tres verticales
tienen cero filas y se re-cuentan por R7). Se evalúa en este orden y gana la primera que aplica:

| clase | condición sobre las columnas viejas | nace en |
|---|---|---|
| `L1` | `deleted_at` no nulo | `PURGED` (propuesta; `G1-2`) |
| `L2` | `lifecycle_state = DRAFT` | `DRAFT` |
| `L3` | `lifecycle_state = ARCHIVED` | `DRAFT` |
| `L4` | `lifecycle_state = INACTIVE` y `billing_unpublished_at` nulo | `DRAFT` |
| `L5` | `lifecycle_state = INACTIVE` y `billing_unpublished_at` no nulo | `UNPUBLISHED_BY_BILLING` |
| `L6` | `lifecycle_state = ACTIVE` y `visibility` distinta de `PUBLIC` | `DRAFT` |
| `L7` | `ACTIVE` + `PUBLIC` y (`owner_suspended` o `plan_restricted`) | `UNPUBLISHED_BY_BILLING` |
| `L8` | `ACTIVE` + `PUBLIC`, sin ninguna de las dos marcas | `UNPUBLISHED_BY_BILLING` |

Dos capas que no cambian el estado y se resuelven aparte:

- **`moderation_state`**: `PENDING` y `APPROVED` no se traducen, porque la columna nunca gobernó la
  visibilidad. El código de hoy lo dice (`packages/service-core/src/services/accommodation/`
  `accommodation.service.ts:2166`, *«no public read of an accommodation … filters on
  `moderationState` today»*), y `PENDING` es el default de toda fila. `REJECTED` es `G1-2`.
- **`is_featured`**: no cruza. El diseño nuevo no tiene destaque curado fuera de la capacidad
  comercial, y `B/21` §4 retira `featured_by_entitlement` pero no nombra `is_featured`.

**Eje 2 · cobertura del dueño en el corte**:

| | situación | quién |
|---|---|---|
| `C1` | sin título, en una vertical que declara evento, con días de trial > 0 y altas abiertas | todo cliente real de Alojamiento |
| `C2` | sin título, en una vertical sin trial (sin evento, días en 0 o sin altas) | nadie hoy (R7 lo re-cuenta) |
| `C3` | cubierto por un `permanent_grant` | las dos cuentas del owner, desde el 3b |
| `C4` | ventana entre el paso 3 y el 3b de esas dos cuentas | ídem, minutos |

Y **fuera del corte, la misma causa** (`F-8V1A2-001`, segundo caso): `C5`, quien se suscribió
antes de publicar, publicó en la ventana del primer cobro y lo tuvo rechazado (`S16`), y quedó en
`PRE_TRIAL` con la ficha en `UNPUBLISHED_BY_BILLING`.

**Por qué `L8` nace `UNPUBLISHED_BY_BILLING` y no `PUBLISHED`**: es el estado al que `PB2` la
llevaría dentro del primer día, y escribirlo en el corte quita la ventana de hasta un día de ficha
publicada sin cobertura y deja al dueño estrenar el trial desde el primer minuto. El reloj no
cambia: la escritura `C` le pone el instante del corte, el mismo que `PB2` le escribiría. Si el
owner prefiere dejarla arriba hasta el reconciliador, `L8` nace `PUBLISHED` y el resto de la
propuesta vale igual; sólo se agrega esa ventana.

#### Recorrido del dominio contra la propuesta

Propuesta recomendada (`G1-1`, opción 1): `PB1` sale también de `UNPUBLISHED_BY_BILLING`, **sólo
por su segunda rama** —si esa publicación dispara `T1`—, más la tabla de arriba.

| caso | qué pasa | ¿cumple `2g`? |
|---|---|---|
| `L8`/`L5`/`L7` × `C1` | nace abajo; el dueño toca «publicar» sobre esa ficha; `PB1` dispara `T1`: `TRIAL_ACTIVE`, ficha arriba | sí |
| `L2`/`L3`/`L4`/`L6` × `C1` | nace `DRAFT`; `PB1` dispara `T1`. La que el dueño había bajado (`L4`) no vuelve sola | sí |
| varias fichas × `C1` | la primera `PB1` arranca el trial; el cupo del trial es una, así que las demás esperan; al contratar, `PB3` sube las `UNPUBLISHED_BY_BILLING` por el cupo; las `DRAFT` las publica el dueño | sí, con una sola ficha durante el trial |
| cualquiera × `C1`, contrata sin publicar | `S1` lo cubre, `PB3` sube la ficha, `T8` no escribe (no hay `PB1` suyo en el sistema nuevo), paga desde el primer cobro y conserva el trial para después | no, pero por elección suya: el botón y el guion lo mandan a publicar (declarar) |
| abajo o `DRAFT` × `C2` | `PB1` no publica y la pantalla dice «suscribite para publicar» | no aplica: la vertical no ofrece trial (declarar; el lazo del botón es de R10) |
| `L8`/`L5`/`L7` × `C3` | nace abajo; el grant del 3b cambia `cubierto` y `PB3` la sube | sí (no hay trial que regalar: `T6` lo consume al publicar, ya declarado en `V/21` §2.4) |
| `DRAFT` × `C3` | `PB1` publica por la primera rama; `T6` escribe la fila consumida | igual que hoy |
| cualquiera × `C4` | abajo desde el nacimiento hasta el grant, minutos | igual que el residuo ya aceptado en `V/21` §2.4 punto 3 |
| `L1` × cualquiera | `PURGED`, final: no publica, no compite por cupo, no toca el trial | sí |
| `REJECTED` × cualquiera | según `G1-2` | — |
| `C5` (fuera del corte) | `PB1` desde `UNPUBLISHED_BY_BILLING` dispara `T1`: la promesa de `V/03` §2 pasa a ser ejecutable | sí |
| dueño cubierto con una ficha abajo por excedente | `PB1` desde `UNPUBLISHED_BY_BILLING` no le aplica (su rama es la del trial); vuelve por `PB3` con el criterio de vuelta | sin cambio |
| dueño en `TRIAL_EXPIRED` o con el hash consumido | `T1` no dispara, así que `PB1` no sale de `UNPUBLISHED_BY_BILLING`: fila 21 | sin cambio |

Tres cosas que se verificaron contra la tabla y no se rompen:

- **`G-R4`**: el par `(UNPUBLISHED_BY_BILLING, «el dueño publica»)` tiene una sola fila; `PB3` y
  `PB7` tienen otro evento. No se agrega ningún par con dos destinos.
- **La distinción `UNPUBLISHED_BY_BILLING ≠ DRAFT`** sigue intacta: habla de lo que republica el
  sistema. Acá republica el dueño, y sólo arrancando su trial.
- **El conteo** sigue en seis estados y doce transiciones: no se agrega fila, se ensancha un
  `desde`.

#### Propuesta de texto (con `G1-1` = opción 1)

**`V/03` §9, fila `PB1`.** Columna `desde`: tachar `` `DRAFT` `` y poner:

> `DRAFT` **o `UNPUBLISHED_BY_BILLING`**

Y al final de la nota, agregar:

> **Desde `UNPUBLISHED_BY_BILLING` sale sólo por la segunda rama**: si esta publicación dispara
> `T1`. Es el camino del dueño que perdió la ficha por billing y todavía no estrenó su trial —la
> cartera del corte (`V/21` §2.4; `2g`) y quien quedó en `PRE_TRIAL` por un primer cobro
> rechazado (§2, `T8`)—. **Con cobertura no sale por acá**: la ficha vuelve por `PB3`, con el
> criterio de *«cuáles vuelven»*, y no a mano (FASE 9 vuelta 1, R1).

**`V/03` §9, después de *«La ficha nace en `DRAFT`…»*.** Agregar:

> **La ficha que ya existía el día del corte nace en el estado que le da la tabla de traducción
> de `V/21` §2.4**, escrito una sola vez por la migración estructural del corte, junto con la
> escritura `C` de `inactiva_desde`. Tampoco es una fila de esta tabla: es la forma de la regla 2
> del cap. 03 §1 (núcleo) para una fila que no nació en el sistema nuevo (FASE 9 vuelta 1, R1).

**`V/03` §9, cuatro lugares que dicen que `PB1` sale sólo de `DRAFT`** (en la nota de `PB11`, en
el párrafo de `PB2`/`PB3` por el cambio de `cubierto`, en el recorrido del excedente y en el
reconciliador). Reemplazar en los cuatro *«`PB1` sale sólo de `DRAFT`»* por:

> `PB1` sale de `DRAFT`, y de `UNPUBLISHED_BY_BILLING` sólo si arranca un trial

Las tres razones que se apoyan en esa frase siguen siendo verdaderas, porque hablan de un dueño
**cubierto** o de una ficha `MODERATED`.

**`V/03` §9, *«Tres cosas que estas dos filas NO son»*, punto 1.** Agregar al final:

> **`PB1` desde `UNPUBLISHED_BY_BILLING` sí es publicar**: es un acto del dueño, y por eso es el
> evento que `T1` mira. Lo que no es publicar es que la ficha vuelva sola.

**`V/03` §2, bullet *«Si el cobro se rechaza»* de `T6`/`T8`.** Después de *«arranca el trial por
`T1`»*, agregar: *«—también sobre la ficha que `PB2` bajó, porque `PB1` sale de
`UNPUBLISHED_BY_BILLING` cuando arranca un trial (§9)—»*.

**`V/21` §2.4.** Reemplazar el párrafo *«Qué pasa entonces, y está determinado…»* hasta *«es una
consecuencia»* por:

> **En qué estado nace cada ficha, y está determinado.** La migración estructural del corte le
> escribe a cada ficha preexistente el estado de la tabla de abajo, una sola vez, con la escritura
> `C`. La ficha que estaba a la vista **nace `UNPUBLISHED_BY_BILLING`**: es el estado al que `PB2`
> la llevaría en la primera corrida del reconciliador, porque `PRE_TRIAL` no cubre, y escribirlo
> en el corte le ahorra al dueño un día de ficha publicada sin cobertura y le deja estrenar el
> trial desde el primer minuto.

Insertar la tabla `L1`–`L8` de este documento y las dos capas (`moderation_state`, `is_featured`).

Reemplazar el recuadro *«Y eso es lo que se hace…»* por:

> **Y eso es lo que se hace: no se siembra nada.** Se les avisa **antes** del corte y se los
> llama. **El camino que se les nombra es el del cliente nuevo** (`2g`): entrar y **publicar su
> ficha**, que `PB1` admite desde `UNPUBLISHED_BY_BILLING` o desde `DRAFT` cuando arranca un trial
> (`V/03` §9), y eso les arranca el trial por `T1`. El botón de suscribirse los manda ahí, porque
> no tienen ningún `PB1` en el sistema nuevo (`V/19` fila 23). Al contratar, las fichas que siguen
> abajo vuelven solas por `PB3`, hasta llenar el cupo.

Y en el «NO cierra» del capítulo, tres puntos nuevos (`DEC-METH-015`):

> - **Quien contrata sin publicar paga desde el primer cobro.** Si un dueño del corte llega al
>   checkout por otro camino, `S1` lo cubre, `PB3` le sube la ficha y `T8` no escribe nada, porque
>   no ejerció el evento en el sistema nuevo: paga el primer ciclo y conserva el trial sin usar.
>   **Causa**: el guion y el botón lo mandan a publicar; cobrarle al que elige pagar no es un
>   defecto. No da acceso indebido ni borra nada.
> - **Durante el trial vuelve una sola ficha.** El cupo del trial es una (invariante 6); las
>   demás esperan a que contrate. **Causa**: `2g` le da el trial de un cliente nuevo, no uno más
>   grande. El aviso lo dice.
> - **En una vertical sin trial, el dueño del corte no tiene trial que estrenar.** Hoy son cero
>   fichas (§4, re-contadas por `B/21` §1.3). **Causa**: la configuración de la vertical, no el
>   corte.

**`V/02` §2.5, fila `listing`.** Después de *«…nunca con su `created_at`»*, agregar: *«**y nace en
el estado que le da la tabla de traducción de `V/21` §2.4**, en la misma migración»*.

**`V/19` §4, fila 23.** Después de *«—en general, no ejerció su evento de activación (cap. 10 §1,
ítem 1)—»*, agregar:

> **Lo que se lee es el registro del sistema nuevo**, el mismo que leen `T7` y `T8` (cap. 03 §2):
> haber publicado en el sistema viejo no cuenta, así que todo dueño del corte llega acá como quien
> todavía no publicó y el botón lo manda a publicar su ficha (`V/21` §2.4).

**`V/19` §4, fila 21.** Tachar *«que la ficha **sigue en borrador**»* y poner *«que la ficha
**sigue sin publicar**»* (desde R1 puede estar en `UNPUBLISHED_BY_BILLING`).

**`D/16` §4.2.** Reemplazar el párrafo *«Y hay un quinto acto que no es del sistema: las
llamadas…»* hasta *«…vuelven solas cuando cada dueño contrata»* por:

> **Y hay un quinto acto que no es del sistema: las llamadas.** Las fichas que estaban a la vista
> **nacen `UNPUBLISHED_BY_BILLING`** por la escritura de nacimiento del paso 3 (`V/21` §2.4). Cada
> dueño las recupera **publicándolas, que le arranca el trial** (`2g`, `V/03` §9 `PB1`), o
> contratando, y entonces vuelven solas por `PB3`.

Y en *«El paso 4 es la única escritura a mano del corte. Las otras dos…»*: tachar *«Las otras
dos»* y poner *«Las otras tres —el estado de nacimiento y `inactiva_desde` de toda ficha
preexistente (`V/21` §2.4), y los dos `permanent_grant`—»*; ver `F-8V1C2-012` para el resto de
esa frase.

**`V/descomposicion.md`, V6.** Agregar a su alcance: *«**el estado de nacimiento de la ficha
preexistente** (`V/21` §2.4), en la misma migración que la escritura `C`; **y `PB1` desde
`UNPUBLISHED_BY_BILLING` por su rama de trial** (FASE 9 vuelta 1, R1)»*. Criterio de terminación
nuevo: *«una ficha del corte en `UNPUBLISHED_BY_BILLING` de un dueño en `PRE_TRIAL` se publica y
arranca el trial; la de un dueño cubierto no se publica a mano y vuelve por `PB3`; una ficha
`INACTIVE` sin `billing_unpublished_at` nace `DRAFT` y ningún cambio de cobertura la publica»*.

**`B/21` §4.** En la lista de lo que se retira, después de `featured_by_entitlement`, agregar
*«**y `is_featured`**: ninguna ficha nace destacada; el destaque es una capacidad comercial»*.

#### Cómo deja de llegar cada miembro

- `F-8V1C2-001` y `F-8V1A3-002`: el trial se alcanza publicando la ficha abajo, y el guion y el
  botón mandan ahí. Contratar sin publicar queda declarado como elección, no como el camino.
- `F-8V1A2-001`: las dos poblaciones (cartera y `C5`) tienen `PB1` desde
  `UNPUBLISHED_BY_BILLING`; no hace falta crear un duplicado ni esperar a `PB4`/`PB8`.
- `F-8V1D1-001`: *«publicó»* queda escrito como el registro del sistema nuevo, así que el botón
  manda al dueño viejo a publicar, y publicar tiene qué ejecutar.
- `F-8V1A3-001`: la tabla `L1`–`L8` cierra las cinco caras. La archivada nace `DRAFT` (llega a
  `PB9` sólo después del aviso de `PB5`); la bajada por el dueño nace `DRAFT` (`PB3` no la toca);
  `PENDING` no se traduce porque nunca bajó nada; `is_featured` se retira; la borrada es `G1-2`.

**Vecino, no mío**: para `C5`, el botón de la fila 23 lo manda al checkout (ya publicó en el
sistema nuevo), donde `T8` le consume el trial al primer pago. Es la regla del botón partida por
causa, de R10.

### 2.2 R6 · la lápida no tiene fuente para sus columnas ni dueño

#### Causa

La lápida se declaró como *«una `subscription` en `CANCELLED`»* sin mirar que esa entidad exige
columnas que el corte no tiene, y su autor se escribió tres veces distinto.

- `$B/docs/02-modelo-de-datos.md:47` «`user`, vertical, versión de plan anclada, billing option,
  estado, la fecha del próximo cobro»
- `$D/06-mp-validation-matrix.md:333` «y el `GET` lo devuelve vacío, nunca el mail real»
- `$D/16-fase-7-del-paraguas.md:126` «sembrar las lápidas (`B/21` §2.5) con los ids cancelados |
  el sistema nuevo»
- `$D/16-fase-7-del-paraguas.md:160` «a mano del corte. Las otras dos —`inactiva_desde` en toda
  ficha preexistente»
- `$B/docs/21-migracion.md:172` «la escribe una persona, sin idempotencia ni registro de nuestro
  lado,»

**No es del owner.** El consolidado lo subía sólo si la respuesta era leer las tablas viejas. No
hace falta leerlas —la lápida no necesita al usuario para lo único que hace—, y aunque hiciera
falta, `DEC-MIG-005` ya lo admite:

- `$D/01-decision-log.md:5681` «Lo que el corte tuviera que leer del sistema viejo corre antes de
  retirar esas»

#### Dominio declarado

**Los preapprovals que el recorrido del 1b encontró vivos**, en cinco clases cerradas:

| clase | ¿lápida? | columnas que el corte conoce |
|---|---|---|
| `P1` conocido por la base (las `trialing` y cualquier alta posterior) | sí | id del proveedor |
| `P2` sólo en el proveedor (como `f6d89f71…`) | sí | id del proveedor |
| `P3` sonda cancelada en el 1b | sí | id del proveedor |
| `P4` sonda del manifiesto, viva a propósito | no: sigue viva y su cobro cae en la marca por `2b` | — |
| `P5` ya `cancelled` antes del 1b | no: no está en el censo y no puede cobrar | — |

Lo que se cuantifica sobre cada lápida: qué columnas lleva, quién la escribe, qué hace el barrido
con ella.

#### Recorrido

El único trabajo de la lápida es que el barrido **encuentre el id** y lo trate por la salvedad 4
(`B/09` §3): releer, reintentar la cancelación, marcar a los 3 días. Para eso alcanza el
`provider_link` y el estado. Recorrido de `P1`–`P3`: las tres llevan lo mismo, y **ninguna** lleva
usuario, vertical, versión ni billing option, porque en `P2` y `P3` no existen y en `P1` leerlos no
agrega nada a lo que la lápida hace. Uniforme, sin lectura del sistema viejo, y `P2` deja de ser
*«sin lápida»*. Un cobro tardío sobre cualquiera de las tres encuentra su fila: qué motivo abre es
el desempate de `B/05` §3, de R4.

#### Propuesta de texto

**`B/02` §2.2, fila `subscription`.** En *«clase (principal o de complemento)»* poner *«clase
(principal, de complemento **o lápida**)»*, y en restricciones agregar:

> **`user`, vertical, versión anclada y billing option son no nulos salvo en `clase = LÁPIDA`**, y
> `clase = LÁPIDA` exige `estado = CANCELLED` y un `provider_link`. La lápida del corte (`B/21`
> §2.5) es la única fila así: el corte no tiene de dónde sacar esas columnas y el barrido no las
> usa (FASE 9 vuelta 1, R6).

**`B/21` §2.5.** Después del recuadro *«El compromiso viejo se conserva…»*, agregar:

> **Qué lleva y sobre qué ids.** Se escribe una lápida por cada preapproval que el paso 1b canceló
> y el paso 2 verificó, **conocido por la base o no, sondas incluidas**; no se escribe sobre las
> sondas del manifiesto, que siguen vivas. Lleva `clase = LÁPIDA`, `estado = CANCELLED` y su
> `provider_link`, y nada más: ni usuario, ni vertical, ni versión, ni billing option (`B/02`
> §2.2). **La dispara una persona**: el operador corre, en el paso 4, la herramienta del corte
> sobre el manifiesto que produjo el 1b. La escritura la construye y la prueba **B11**.

En la frase de *«lo que venga del sistema viejo —un cobro en vuelo sin lápida porque su id sólo
estaba en el proveedor, una sonda que siguió viva—»*, tachar *«un cobro en vuelo sin lápida porque
su id sólo estaba en el proveedor,»*: desde R6 ese id tiene lápida. Queda la sonda del manifiesto.

Y en *«la escribe una persona, sin idempotencia ni registro de nuestro lado»*, poner *«la dispara
una persona con la herramienta del corte, sobre el manifiesto del 1b»*.

**`B/09` §3, salvedad 4.** Agregar: *«Sobre una lápida la relectura mira sólo el estado: no tiene
versión contra la cual comparar un monto (`B/02` §2.2)»*.

**`D/16` §4.2, fila 4.** Columna *«quién lo hace»*: tachar *«el sistema **nuevo**»* y poner *«una
persona, con la herramienta del corte, sobre la base nueva»*. Y en la prosa del mismo §, donde
dice que un cobro de un id que sólo estaba en el proveedor lo recoge la marca de la
re-vinculación, poner que lo reconoce su lápida (coordinación con R4 y R5, que son de otro grupo).

**`B/descomposicion.md`, B11.** Agregar: *«**la lápida del corte** (`B/21` §2.5): la escritura
con `clase = LÁPIDA` y el criterio de que una fila principal sin usuario ni versión la rechaza la
base (FASE 9 vuelta 1, R6)»*.

#### Cómo deja de llegar cada miembro

- `F-8V1A3-012`: la lápida no ancla a ninguna versión; el barrido no compara montos sobre ella.
- `F-8V1B3-003`: no hace falta el usuario; `B11` es dueña de la escritura.
- `F-8V1C2-005`: una sola respuesta (una persona con la herramienta, sobre el manifiesto), el
  conjunto exacto (`P1`–`P3`) y el valor de cada columna.
- `F-8V1D1-010`: la tabla y la prosa dicen lo mismo.

### 2.3 R7 · la población del aviso se contó en suscripciones

#### Causa

El costo de *«no migrar»* se midió en suscripciones, y lo que el corte hace efectivo alcanza a
**toda ficha**. Desde R1 es más ancho todavía: el reloj de retención arranca en el corte para toda
ficha preexistente, y el trial se le ofrece a todo dueño.

- `$V/docs/21-migracion.md:313` «Con ocho filas «no migrar» son tres llamadas; el umbral medido
  está en unas veinte»
- `$V/docs/21-migracion.md:343` «Cómo se le avisa a las tres personas y cuándo se cancelan sus
  suscripciones»
- `$B/docs/21-migracion.md:70` «es para saber a quién hay que llamar y qué le toca»
- `$D/07-facts-inventory.md:149` «UNION ALL SELECT 'alojamientos', count(*)::text FROM
  accommodations WHERE deleted_at IS NULL;»
- `$V/docs/21-migracion.md:323` «Gastronomía, experiencia y partner: cero filas. El rediseño de
  esas tres verticales no»

#### Dominio declarado

Toda persona que el día del corte tiene, en alguna de las cinco verticales: (a) una ficha a la
vista (`L7`, `L8`), (b) una ficha abajo o en borrador (`L2`–`L6`), (c) sólo una suscripción viva
sin ficha, (d) sólo fichas `L1`. Cinco verticales × cuatro clases.

#### Recorrido

(a) pierde la ficha el día del corte: aviso obligatorio. (b) no pierde visibilidad, pero su reloj
de 180 días arranca en el corte (escritura `C`) y se le ofrece el trial: aviso. (c) pierde la
suscripción en el 1b: aviso, ya estaba. (d) no pierde nada: sin aviso. Las cinco verticales entran
por la misma consulta. Hoy la población real es Alojamiento; las otras tres se re-cuentan.

#### Propuesta de texto

**`B/21` §1.3**, al final del párrafo *«Y la re-verificación cuenta más que…»*, agregar:

> **Y cuenta fichas por dueño en las cinco verticales**, con la clase `L1`–`L8` de `V/21` §2.4.
> **La población a avisar** es toda persona con una ficha que no sea `L1` o con una suscripción
> viva en el sistema viejo, **medida el día del corte** (FASE 9 vuelta 1, R7).

**`D/07`**, consulta 3: agregar una consulta por tabla de ficha de cada vertical, agrupada por
dueño y por clase, en lugar del único `count(*)` de alojamientos.

**`V/21` §2.5.** Tachar *«Con ocho filas *«no migrar»* son tres llamadas»* y poner *«Con la
población de `B/21` §1.3 —hoy, los dueños de doce alojamientos y tres suscriptores—»*; y agregar
que el umbral de *«unas veinte»* se mide en **personas a llamar**, no en suscripciones.

**`V/21` §4.** Después de *«cero filas»*, agregar *«al 2026-09-15; se re-cuentan el día del corte
con la consulta de `B/21` §1.3»*.

**`V/21`, NO cierra.** Tachar *«a las tres personas»* y poner *«a la población de `B/21` §1.3»*.

**`D/16` §4.2**, en *«El aviso va ANTES del paso 1»*, agregar: *«a la población de `B/21` §1.3, y
dice qué pasa con su ficha y cómo estrena el trial (`V/21` §2.4)»*.

#### Cómo deja de llegar cada miembro

- `F-8V1A3-011` y `F-8V1C2-009`: el aviso va a quien pierde algo, contado por fichas y por
  vertical el día del corte, y la caducidad mide personas.

---

## 3. Hallazgos sueltos

### `F-8V1A3-004` · el corte no siembra el catálogo nuevo

Sigue llegando: la tabla del §4.2 salta de desplegar a los grants.

- `$D/16-fase-7-del-paraguas.md:124` «recién acá, y sólo si el paso 2 cerró»

**Aplicación.** `D/16` §4.2, dentro del paso 3: *«**3a · el catálogo de producción**: las
data-migrations del catálogo nuevo (verticales con su evento, `admite_altas` y fin de servicio;
por vertical, los planes vendibles, el de trial, el de pre-trial y el de piso con sus versiones)
corren en el carril de datos del despliegue, después de la migración estructural y antes de que
arranque el proceso nuevo. **Y antes del 3b se verifican contra la base de producción** las
condiciones de `G-R3` y el espejo del enum de verticales: si no dan, el corte no sigue»*.
**Owner** (`G1-3`): qué plan anclan los dos grants.

### `F-8V1C2-002` · lo pagado en el viejo por un período o un addon que el corte corta

Sigue llegando: `2d` es de la rama de aborto y `2a` es de las tablas, no del período no usado.

- `$B/docs/21-migracion.md:276` «los hay desde el 2026-09-26, bajo el sistema viejo (§1.3), y»

**Owner** (`G1-4`). Aplicación que vale para cualquier respuesta: el aviso dice *«no contrates
ni compres nada en el sistema viejo después de este aviso»*.

### `F-8V1A3-006` · las restricciones de `plan_version` no se escriben sobre sus columnas

Sigue llegando.

- `$V/docs/02-modelo-de-datos.md:48` «`UNIQUE(vertical, rank) WHERE vendible AND vigente` — dos
  vendibles con el mismo rank es un estado inválido»

**Aplicación.** `V/02` §2.1, fila `plan_version`: agregar **`vertical`**, copiada de su plan al
crearla e inmutable, con **FK compuesta `(plan_id, vertical)` → `plan(id, vertical)`** (la
`UNIQUE(id, vertical)` de `plan` ya existe); declarar **`vigente` como la única columna mutable
de la versión**, porque no cambia lo que otorga una versión anclada (`DEC-ARCH-001` versiona lo
que tiene efecto); y agregar **`UNIQUE(id, plan_id)`**, que pide la FK de `B/02` §2.4. Con eso las
dos parciales viven en una sola tabla.

### `F-8V1A3-007` · `subscription` no ata vertical, versión y billing option

Sigue llegando.

- `$B/docs/02-modelo-de-datos.md:47` «`user`, vertical, versión de plan anclada, billing option,
  estado, la fecha del próximo cobro»

**Aplicación.** `B/02` §2.2, restricciones de `subscription`: *«**FK compuesta `(billing_option,
versión)` → `billing_option(id, plan_version_id)`** y **`(versión, vertical)` →
`plan_version(id, vertical)`**; con columnas nulas —sólo en la lápida, R6— la FK no se evalúa»*.
Se apoya en la `vertical` de `plan_version` de `F-8V1A3-006` y en una `UNIQUE(id,
plan_version_id)` en `billing_option` (`B/02` §2.1).

### `F-8V1A3-010` · el borrado del día 180 enumera cuatro clases y la ficha tiene más

Sigue llegando.

- `$V/docs/02-modelo-de-datos.md:574` «el contenido de ESA ficha —textos, fotos, FAQ, horarios— y
  sus borradores, y nada más»

**Aplicación** (sin decisión): *«fotos»* incluye **su copia en el almacenamiento externo**; y
como `PURGED` conserva la fila, un `ON DELETE CASCADE` no corre: se escribe para que nadie lea
*«hard delete»* como `DELETE` de la fila. **Owner** (`G1-5`): reseñas de terceros y conexión de
calendario.

### `F-8V1C2-004` · las herramientas del corte no son de ninguna unidad

Sigue llegando.

- `$D/16-fase-7-del-paraguas.md:121` «el sistema viejo, que todavía corre | es el único que sabe
  hacerlo»

**Aplicación.** `D/16` §4.2, párrafo nuevo *«Las herramientas del corte»*: (1) **censo,
cancelación y verificación** (1a, 1b, 2): un script del repositorio actual, con manifiesto de
salida, **mergeado y promovido a `main` antes de que la rama del paraguas entre a `staging`**
—así no hace falta la excepción de hotfix—; es de la FASE 7 del paraguas y va con fecha del §2;
(2) **lápidas**: B11 (R6); (3) **grants**: B9; (4) **estado de nacimiento y escritura `C`**: V6
(R1). Y en `B/descomposicion`, la frase *«el resto, el corte del paraguas, es de `D/16` §4.2»*
pasa a citar ese párrafo.

### `F-8V1C2-006` · el ensayo del paso 0 es en sandbox y verifica producción

Sigue llegando.

- `$D/16-fase-7-del-paraguas.md:195` «navegador: se verifica en el ensayo del paso 0.»

**Aplicación.** `D/16` §4.2, paso 0: *«**con una mitad en producción**: sobre un plan propio sin
suscriptores (como la sonda 50) se cancela, se reactiva y se abre el link en el navegador; que
venda es condición para el 1a. El resto se ensaya en `staging`»*.

### `F-8V1C2-007` · la rama de aborto supone al viejo corriendo

Sigue llegando.

- `$D/16-fase-7-del-paraguas.md:198` «2b, y el viejo vuelve a correr sobre su propio esquema»

**Aplicación.** `D/16` §4.2, rama de aborto, punto 2, agregar: *«si el paso 3 alcanzó a
reemplazar la imagen: se vuelve a desplegar la imagen vieja, se reencienden su webhook y sus
crons (lo inverso de `DB-5`) y se verifican los dos, igual que su apagado»*.

### `F-8V1C2-008` · nadie apunta ni verifica el webhook después del corte

Sigue llegando.

- `$D/06-mp-validation-matrix.md:269` «las 108 preapprovals de producción son de
  `1890101689209057` y ninguna tiene `notification_url`»

**Aplicación.** `D/16` §4.2, en el paso 3: *«la URL de notificación de la aplicación del
proveedor apunta a la ruta del handler nuevo, y **se verifica con una entrega real** (el alta de
una sonda propia) antes del paso 4»*.

### `F-8V1C2-010` · lo que hace el viejo con sus propias cancelaciones en la ventana

Sigue llegando. El 1b emite webhooks al viejo:

- `$D/06-mp-validation-matrix.md:335` «Crear, pausar, reanudar y cancelar sí notifican»

**Declarar** en `D/16` §4.2: *«**Lo que la persona ve en la ventana**: al cancelar el 1b, el viejo
recibe cada cancelación, manda su correo de baja y baja las fichas del dueño. No se suprime:
el aviso previo lo anticipa. La ficha que el viejo bajó entra al corte con `billing_unpublished_at`
y nace `UNPUBLISHED_BY_BILLING` (`V/21` §2.4, `L5`), igual que las otras. Si hay aborto, la
re-suscripción por el link reactivado la republica con la lógica del viejo. **Causa**: tocar el
código viejo para silenciarlo cuesta más que decirlo, y no mueve plata»*.

### `F-8V1C2-011` · el aviso del corte no deja evidencia

Sigue llegando. El canal de evidencia ya está decidido:

- `$B/docs/22-lo-legal.md:73` «Correo transaccional, por lo mismo. No una notificación dentro del
  producto, que no deja»

**Aplicación.** Al pliego legal **no** va: el corte se resolvió sin apartamiento del PDR ni
abogado (dato de esta vuelta). `D/16` §4.2, en el aviso: *«además de la llamada, **un correo** a
cada persona de la población de `B/21` §1.3, desde el sistema viejo o desde la casilla del owner,
**con el envío registrado en el manifiesto del corte** (destinatario, fecha, identificador del
mensaje): es la evidencia de `B/22` §1.2, antes de que exista el outbox nuevo»*.

### `F-8V1A3-013` · el núcleo pone el invariante 2 en la base

Sigue llegando.

- `$D/nucleo/04-invariantes.md:45` «la fila de `trial` no se borra nunca, ni siquiera en el hard
  delete del día 180»

**Aplicación.** Declarar la restricción que falta: `V/02` §5, en el ⚠️ de la fila 2, tachar
*«Con qué se rechaza un `DELETE` directo no está decidido acá»* y poner *«**un trigger que rechaza
todo `DELETE` sobre `trial`**, en el carril de extras (`packages/db/src/migrations/extras/`):
ningún camino legítimo borra esa fila, porque el borrado de la cuenta la anonimiza»*. Con eso
`N/04` §2.1 queda cierto sin cambiar el conteo de seis.

### `F-8V1A3-015` · una fila de invalidación contradice la inmutabilidad

Sigue llegando.

- `$V/docs/02-modelo-de-datos.md:498` «se publica una versión nueva de un plan al que hay
  suscripciones ancladas | cambia lo que esa versión otorga»

**Aplicación.** Tachar la fila en `V/02` §3.2, con la razón: *«la suscripción lee su versión
anclada, que es inmutable; una versión nueva no la cambia. La que sí invalida es la de los
grants, que leen la vigente»*.

### `F-8V1C2-012` · el paso 3b no alcanza a evitar lo que dice evitar

Sigue llegando, y además hay contradicción de texto:

- `$D/16-fase-7-del-paraguas.md:161` «dos `permanent_grant` del paso 3b— las hace el sistema nuevo
  en el paso 3»

**Declarar** (y corregir el texto). Con R1, las fichas visibles de las dos cuentas nacen
`UNPUBLISHED_BY_BILLING` como todas, así que un reconciliador que corra antes del 3b no les hace
nada, y el grant las sube por `PB3`. El residuo son minutos de ficha abajo en dos cuentas del
owner, el que `V/21` §2.4 punto 3 ya aceptó. En `D/16` §4.2 poner *«el estado de nacimiento y
`inactiva_desde`, en la migración del paso 3; los dos `permanent_grant`, en el 3b»*, y cambiar la
razón del 3b a *«antes del paso 4, para que esas dos cuentas estén abajo sólo minutos»*.

### `F-8V1C2-014` · la lista de lo que se retira omite `partner_subscriptions`

Sigue llegando.

- `$B/docs/21-migracion.md:282` «destaque, `entity_subscriptions` y las columnas denormalizadas que
  el código de hoy lee, como»

**Aplicación.** `B/21` §4: agregar *«`partner_subscriptions`»* después de `entity_subscriptions`.

### `F-8V1C2-015` · el §1 y el §3 del corte dicen que el rollback no existe

Sigue llegando.

- `$D/16-fase-7-del-paraguas.md:47` «Cuatro de los seis tienen cero apariciones en todo el diseño
  del programa»

**Aplicación.** `D/16` §1: tachar la frase y poner *«Cuatro de los seis tenían cero apariciones
(`rollout`, `coexistence`, `feature flags` y `rollback`); `rollback` quedó decidido en el §4.3»*.
`D/16` §3: tachar *«con la palabra «rollback» sin aparecer en un solo documento…»* y poner *«hasta
que el §4.3 lo decidió»*.

---

## 4. Preguntas al owner

### G1-1 · ¿Por qué camino estrena el trial el dueño del corte, cuya ficha queda abajo?

`2g` ya decidió que lo estrena. Falta cuál es el acto.

1. **`PB1` sale también de `UNPUBLISHED_BY_BILLING`, sólo si arranca un trial.** Qué hace: el
   dueño toca «publicar» sobre su ficha y `T1` dispara. Costo: se ensancha el `desde` de una fila
   y se escriben el estado de nacimiento y el guion; sin fila nueva. Riesgo: bajo; la rama no
   aplica a un dueño cubierto. Capítulos: `V/03` §2 y §9, `V/21` §2.4, `V/19`, `D/16` §4.2,
   `V/descomposicion`. **Arregla también `C5`**, el `S16` de `6c`.
2. **Toda ficha vieja nace `DRAFT`.** Qué hace: `PB1` tal como está arranca el trial. Costo: sólo
   la tabla de nacimiento. Riesgo: se pierde *«vuelven solas al contratar»* —cada ficha la publica
   el dueño a mano— y **`C5` sigue sin salida**, así que su promesa hay que arreglarla aparte.
   Capítulos: `V/21` §2.4, `D/16` §4.2.
3. **El corte siembra un trial activo** a cada dueño con ficha a la vista. Qué hace: la ficha no
   baja nunca. Costo: una escritura nueva del corte con hash, reloj y campaña, contra *«el corte no
   escribe filas de `trial`»*. Riesgo: el reloj corre aunque la llamada tarde, sólo una ficha
   entra en el cupo del trial y `C5` sigue sin salida. Capítulos: `V/21` §2.4, `V/03` §2,
   `D/16` §4.2.

**Recomendación: la 1.** Es la única que cumple `2g` sin agregar escrituras, conserva *«vuelven
solas»* y además vuelve ejecutable la promesa de `6c` para `C5`. La 2 es más chica en texto pero
deja a `C5` igual. La 3 es la que elegiría quien quiere que ninguna ficha baje nunca, y cuesta un
mecanismo que el §56 pide no construir.

**Juan.** Juan tiene «Cabañas del Río» publicada en el sistema viejo. El owner lo llama: *«el
día X tu ficha queda en pausa; entrá, tocá publicar y arranca tu trial»*. Corte: la ficha nace
`UNPUBLISHED_BY_BILLING`. Juan entra a las 11, toca «publicar», `PB1` dispara `T1` y la ficha
vuelve con su trial. Si en cambio va a «suscribirme», el botón lo manda al mismo lugar, porque no
publicó en el sistema nuevo.

### G1-2 · ¿Cómo nacen la ficha borrada por su dueño y la `REJECTED` de moderación?

1. **La borrada nace `PURGED` y su contenido se borra como en `PB12`; `REJECTED` no se traduce,
   se lista en la re-verificación y el admin la modera después con `PB10` si quiere.** Costo: un
   borrado en la migración, sobre lo que el dueño ya había borrado. Riesgo: si alguna borrada lo
   fue por un admin y no por su dueño, se pierde su contenido. Capítulos: `V/21` §2.4.
2. **La borrada nace `PURGED` conservando el contenido; `REJECTED` nace `MODERATED` con un motivo
   fijo.** Costo: una `PURGED` con contenido (contra lo que el estado dice) y una moderación que
   no hizo ningún admin, sin el motivo auditado que `PB10` exige. Riesgo: dos excepciones a
   reglas del estado. Capítulos: `V/21` §2.4, `V/03` §9.
3. **Las dos nacen `DRAFT`.** Costo: nada. Riesgo: la borrada reaparece en el panel del dueño y
   la rechazada se puede volver a publicar. Capítulos: `V/21` §2.4.

**Recomendación: la 1.** Honra el acto del dueño con el mismo efecto que `PB12` y no inventa una
moderación. `REJECTED` nunca bajó nada, así que ignorarla no cambia lo que se ve hoy. Si el owner
no quiere borrar nada en el corte, la 2 es la posición honesta, con sus dos excepciones escritas.

**Juan.** Juan borró en marzo un alojamiento viejo. En el corte esa ficha nace `PURGED` y en Mi
Cuenta ve que existió y que se borró; no le reaparece como borrador.

### G1-3 · ¿Qué plan anclan los dos grants del owner, y en qué verticales?

1. **El vendible de `rank` más alto de Alojamiento**, en la vertical en que tenían `comp`. Costo:
   ninguno. Riesgo: si el owner quiere esas cuentas para probar un plan intermedio, no le sirven.
   Capítulos: `B/21` §2.4, `D/16` §4.2 (3b).
2. **Un plan elegido por el owner en cada vertical**, con la lista escrita en `B/21` §2.4. Costo:
   que el owner la dé. Riesgo: ninguno. Capítulos: los mismos.
3. **Un plan propio no vendible «cortesía del owner»** en el catálogo. Costo: una fila de catálogo
   más por vertical. Riesgo: un plan que nadie más usa. Capítulos: los mismos más el catálogo del
   paso 3a (`F-8V1A3-004`).

**Recomendación: la 1**, porque son cuentas propias de demostración y el grant ya lee la versión
vigente. La 2 si el owner las usa para probar un plan concreto.

**Juan.** Juan no está en esto: son las dos cuentas del owner. El 3b les escribe un grant anclado
al plan más alto de Alojamiento y sus fichas vuelven por `PB3` en minutos.

### G1-4 · ¿Qué se hace con lo pagado en el sistema viejo por un período o un addon que el corte corta?

1. **Se acepta y se declara**: se pierde; el trial que `2g` regala lo compensa de hecho, y el aviso
   lo dice. Costo: nada. Riesgo: un reclamo sin comprobante de nuestro lado (ya declarado en
   `B/21`). Capítulos: `B/21` NO cierra, guion del aviso en `D/16` §4.2.
2. **Se devuelve completo, antes del corte, el último cobro cuyo período no terminó y los addons
   vigentes**, desde el panel del proveedor, sobre la lista de la re-verificación de `B/21` §1.3
   (una lectura previa al retiro, que `DEC-MIG-005` punto 1 admite). Costo: unos pocos reembolsos
   a mano. Riesgo: bajo; un reembolso total no tiene el caso del parcial. Capítulos: `B/21` §1.3 y
   §4, `D/16` §4.2.
3. **Se devuelve la parte no usada.** Costo: un cálculo por persona. Riesgo: el reembolso parcial
   tiene el caso `2084` de `RF-8`. Capítulos: los mismos que la 2.

**Recomendación: la 2.** La población es de tres personas como mucho, y es la misma postura del
owner en `3c` (*«que Juan, que venía pagando, no quede sin nada»*). La 1 es la posición coherente
con `2a` y `2d`, y el owner la puede elegir con razón: el trial que regala suele cubrir los días.

**Juan.** Juan pagó ARS 18.000 el 25/11; el corte es el 05/12. Con la 2, el 04/12 se le devuelven
los 18.000 y el 05/12 publica y arranca su trial. Con la 1, pierde veinte días pagos y recibe el
trial.

### G1-5 · ¿Qué pasa en `PURGED` con las reseñas de terceros y con la conexión de calendario?

1. **Las reseñas se conservan, sin mostrarse; la conexión de calendario se desconecta y su token
   se revoca y se borra.** Costo: un paso más en `PB9`/`PB12`. Riesgo: ninguno de datos de otros.
   Capítulos: `V/02` §4.1, `V/03` §9.
2. **Las reseñas se borran con el contenido; el calendario, igual que en la 1.** Costo: el mismo.
   Riesgo: se borra lo que escribieron otras personas. Capítulos: los mismos.
3. **Todo se conserva**, la lectura literal de *«y nada más»*, y sólo se corta la sincronización.
   Costo: nada. Riesgo: queda guardada una credencial que no presta servicio. Capítulos: `V/02`
   §4.1.

**Recomendación: la 1.** La reseña es de quien la escribió (`DEC-DATA-005` protege a las
personas), y un token vivo sobre una ficha que no existe es riesgo sin servicio.

**Juan.** La ficha de Juan llega a `PURGED` el día 180. Las tres reseñas que le dejaron quedan
guardadas y no se ven; su Google Calendar deja de sincronizar y el token se revoca.

---

## 5. Trabajo de aplicación sin decisión

Las de R1 dependen de `G1-1` = 1 y las de `F-8V1A3-004` de `G1-3` sólo en el plan.

1. `V/03` §9, fila `PB1`: `desde` = `DRAFT` o `UNPUBLISHED_BY_BILLING`, con la nota de la rama
   del trial (R1).
2. `V/03` §9: párrafo del estado de nacimiento de la ficha del corte, después de *«La ficha nace
   en `DRAFT`»* (R1).
3. `V/03` §9: reemplazar *«`PB1` sale sólo de `DRAFT`»* en sus cuatro apariciones (R1).
4. `V/03` §9, *«Tres cosas…»* punto 1: `PB1` desde `UNPUBLISHED_BY_BILLING` sí es publicar (R1).
5. `V/03` §2, bullet del rechazo del primer cobro: la salida desde `UNPUBLISHED_BY_BILLING` (R1).
6. `V/21` §2.4: tabla `L1`–`L8` y sus dos capas; párrafo de nacimiento; recuadro del guion; tres
   puntos al NO cierra (R1).
7. `V/02` §2.5, `listing`: la ficha del corte nace en el estado de la tabla (R1).
8. `V/19` §4, filas 23 y 21: qué es *«publicó»*; *«sigue sin publicar»* (R1).
9. `D/16` §4.2: párrafo del quinto acto; *«Las otras tres»* (R1, `F-8V1C2-012`).
10. `V/descomposicion`, V6: alcance y criterio de terminación (R1).
11. `B/21` §4: `is_featured` y `partner_subscriptions` a la lista de lo que se retira (R1,
    `F-8V1C2-014`).
12. `B/02` §2.2: `clase = LÁPIDA` y sus restricciones (R6).
13. `B/21` §2.5: qué lleva la lápida, sobre qué ids y quién la dispara; tachar el caso *«sin
    lápida»* (R6).
14. `B/09` §3, salvedad 4: la relectura de una lápida mira sólo el estado (R6).
15. `D/16` §4.2, fila 4 y prosa del id que sólo estaba en el proveedor (R6; coordinar con R4/R5).
16. `B/descomposicion`, B11: la escritura de la lápida (R6).
17. `B/21` §1.3, `D/07`, `V/21` §2.5, §4 y NO cierra, `D/16` §4.2: la población del aviso (R7).
18. `D/16` §4.2: paso 3a del catálogo y su verificación contra producción (`F-8V1A3-004`).
19. `V/02` §2.1: `vertical` en `plan_version`, `vigente` mutable declarado, `UNIQUE(id, plan_id)`
    (`F-8V1A3-006`).
20. `B/02` §2.2: las dos FK compuestas de `subscription` (`F-8V1A3-007`).
21. `V/02` §4.1: *«fotos»* incluye el almacenamiento externo; `PURGED` no borra la fila
    (`F-8V1A3-010`).
22. `D/16` §4.2: párrafo de las herramientas del corte; `B/descomposicion` lo cita
    (`F-8V1C2-004`).
23. `D/16` §4.2, paso 0: la mitad en producción (`F-8V1C2-006`).
24. `D/16` §4.2, rama de aborto: redespliegue del viejo y reencendido verificado
    (`F-8V1C2-007`).
25. `D/16` §4.2, paso 3: URL del webhook y entrega real verificada (`F-8V1C2-008`).
26. `D/16` §4.2: declarar lo que la persona ve en la ventana (`F-8V1C2-010`).
27. `D/16` §4.2: correo del aviso con el envío en el manifiesto (`F-8V1C2-011`).
28. `V/02` §5: el trigger que rechaza `DELETE` sobre `trial` (`F-8V1A3-013`).
29. `V/02` §3.2: tachar la fila de la versión nueva con suscripciones ancladas (`F-8V1A3-015`).
30. `D/16` §1 y §3: el rollback ya aparece (`F-8V1C2-015`).

---

## 6. Key Learnings

1. La causa de R1 no es la máquina de trial sino **que una decisión del owner sobre el trial
   nunca se tradujo a la máquina de publicación**: nadie escribió en qué estado nace una fila que
   no nació en el sistema nuevo. La regla 2 del núcleo (el estado inicial vive en la creación)
   tiene un caso que no es creación, y hay que declararlo.
2. La salida más chica para R1 no es una transición nueva sino **ensanchar el `desde` de `PB1`
   sólo por su rama de trial**: no agrega pares a `G-R4`, no toca el conteo y además repara una
   promesa ajena al corte (el `S16` de `6c`), que usaba la misma frase inejecutable.
3. `moderation_state` del sistema viejo **nunca gobernó la visibilidad** (lo dice el código) y su
   default es `PENDING`: traducirla por su valor habría bajado toda la cartera. Leer el código del
   estado viejo antes de mapearlo cambió la respuesta de «pregunta al owner» a «no se traduce».
4. La lápida no necesita al usuario para lo único que hace (que el barrido encuentre el id). Mirar
   **qué lee cada consumidor de una fila** achica las columnas obligatorias y evita leer tablas que
   el owner decidió retirar.
5. Una población de aviso contada **por la entidad que se cancela** (suscripciones) y no **por la
   que pierde algo** (fichas, relojes, trials) queda corta en cuanto el corte hace efectos sobre
   otra entidad. Desde R1, esa otra entidad es cada ficha preexistente.
6. `DEC-MIG-005` punto 1 ya prevé que el corte lea tablas viejas antes de retirarlas: un hallazgo
   que se sube al owner *«porque contradice la decisión»* conviene releerlo contra la cláusula
   condicional de la decisión antes de subirlo.

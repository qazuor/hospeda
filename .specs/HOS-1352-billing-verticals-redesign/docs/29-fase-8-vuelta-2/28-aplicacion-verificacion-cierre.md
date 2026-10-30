---
title: "FASE 9 vuelta 2 · aplicación de la verificación, tramo de cierre"
linear: HOS-1352
statusSource: linear
created: 2026-09-28
updated: 2026-09-28
status: CURRENT
fase: 9
---

# FASE 9 vuelta 2 · aplicación de la verificación: el tramo de cierre

Las decisiones `V2-m` a `V2-x` de
[`24-decisiones-del-owner-verificacion.md`](./24-decisiones-del-owner-verificacion.md), las dos
secciones finales, que contestan los casos vecinos de
[`26-`](./26-aplicacion-verificacion-billing.md) §5 (`V2-m` a `V2-r`) y de
[`27-`](./27-aplicacion-verificacion-verticales.md) §5 (`V2-s` a `V2-x`). Medido y editado en el
worktree `hospeda-spec-hos-1352-billing-redesign` sobre HEAD `18077a6d41`, sin commits. Leí
enteros `26-` y `27-` para no pisar ni duplicar: no toqué nada de `V2-a` a `V2-l` salvo donde una
decisión de este tramo cambia un texto que ellos escribieron, y lo digo en cada caso. `B/` es
`HOS-1354…/docs`, `V/` es `HOS-1353…/docs`, `D/16` es la FASE 7 del paraguas. El último § junta,
para aprobar en un lote, todo lo que los tres tramos proponen para el log y la matriz.

## 1. Qué se aplicó

### `V2-m` · el 1b no arranca sin la fecha del pago (caso 1 de `26-` §5)

La medición de `V2-a` pasa de *«vuelve al owner si no da»* a condición del 1b, como `EX-42` lo es
del 1a.

- En el paso 0: `D/16:122` «Y es condición del 1b»
- En la columna de razones del 1b, donde vive la condición de cada paso:
  `D/16:125` «no arranca sin el dato de `V2-a` medido en el paso 0»
- En la regla de `R2`: `B/21:299` «y el 1b no arranca sin ese dato»

**Por qué el 1b y no otro paso.** El 1b es el que cancela los preapprovals cuyos cobros posteriores
lee la regla de la marca: sin el campo, el corte generaría la población sin la regla que la
clasifica. Es la letra de `V2-m` (*«el paso 1b no arranca»*).

### `V2-n` · `S21` lee la causa en `vertical_discontinuation`, y `S12`-vía-`S26` pasa al 15 (caso 2 de `26-` §5)

Hasta acá el `S12` que consumaba un `CANCEL_SCHEDULED` puesto por `S26` abría el 14 *«por
mecanismo»*: la transición no dice quién puso el estado intermedio. Con `V2-n` la causa se lee en
una fila que ya existe, la de `vertical_discontinuation` de la vertical de la principal, sin
transportar nada. Eso vale para el `USER`/`GLOBAL` de `V2-d` (que `26-` justificó con el argumento
de *«el acto tocó la fila al pasar»*, que no alcanzaba) y para los `LISTING` y
`VERTICAL_SUBSCRIPTION` de la vertical.

- `S11`, la frase que extendía el 14 a los complementos de `S26`:
  `B/03:159` «salvo que ahí la marca es el motivo 15 y no el 14»
- `S12`, el orden en la fecha de fin:
  `B/03:160` «o el 15 si la vertical de la principal tiene una fila en `vertical_discontinuation`»
- `S21`, el reparto de sus dos motivos, donde vive la regla:
  `B/03:169` «o `S12` por su primer evento cuando la vertical de la principal tiene una fila en `vertical_discontinuation`»
- `S26`, el argumento de `V2-d` tachado y reemplazado:
  `B/03:174` «y `S21` lo deduce en esa fecha de que la vertical tiene una fila en `vertical_discontinuation`»
- `B/03:174` «Lo mismo con los complementos `LISTING` y `VERTICAL_SUBSCRIPTION` de la vertical que este acto deja en `CANCEL_SCHEDULED`»
- `B/03` §3.2, en el § de cuál de los dos motivos abre `S21`, el criterio que dejaba dos caminos
  nuestros del lado de la regla: `B/03:1333` «un camino nuestro del lado de la regla»
- La tabla de los cuatro disparadores, fila 2:
  `B/03:1342` «o `S12` en la fecha de fin sobre una vertical con fila en `vertical_discontinuation`»
- `B/03:1349` «uno lo es, `S17`, nombrado más abajo»
- El recuento de la partición: `B/03:1378` «parte CUATRO y deja uno, porque suma `S12`-vía-`S26`»
- La tabla del reparto, la fila de `S17` tachada en su mitad:
  `B/03:1385` «(`S12`-vía-`S26` pasó a la fila de abajo, `V2-n`)»
- La fila del 15, que ahora junta el `USER`/`GLOBAL` y los `S12`-vía-`S26`:
  `B/03:1386` «y `S21` la lee en la fecha de fin: la vertical de la principal tiene una fila en `vertical_discontinuation`»
- Las formas de leer la causa: `B/03:1396` «tres formas distintas de leerla»
- La tercera: `B/03:1416` «`S12`-vía-`S26` la lee en una fila que ya existe»
- Su costo, dicho: `B/03:1420` «La deducción es por la vertical y no por la fila»
- Lo que NO se parte, con `S12`-vía-`S26` tachado: `B/03:1428` «`S12`-vía-`S26` ya no está acá»
- El costo humano, con el piso de 60 días: `B/03:1445` «Desde `V2-n` el `S12`-vía-`S26`»
- La frase de que la causa no sobrevive en ningún lado, con su salvedad:
  `B/03:1459` «que queda escrita en `vertical_discontinuation`, y de ahí la lee `S21`»
- `B/02` §2.5, motivo 14: `B/02:993` «uno de los caminos que caen acá es NUESTRO»
- Motivo 15: `B/02:994` «o cuando a su objetivo lo mató `S12` en la fecha de fin y la vertical de la principal tiene una fila en `vertical_discontinuation`»
- `B/02:994` «o la fila de `vertical_discontinuation` (`V2-n`)»
- `B/16` §4.3: `B/16:718` «con el motivo 15 y no el 14»
- `B/16` §4.4, las dos excepciones: `B/16:933` «o `S12` en la fecha de fin sobre una vertical»
- `B/16:945` «`S12` cuando su `CANCEL_SCHEDULED` lo puso `S26` pasó al 15»
- `B/19` §6, la fila del 15: `B/19:230` «lo mató `S12` en la fecha de fin sobre una vertical»
- La fila del 14, que decía en voz alta los dos caminos: `B/19:234` «una de esas cinco cae acá: `S17`»
- `B/19:234` «ese camino se lee acá y no se deduce»
- `B/10` §4.3, la marca que deja el acto: `B/10:241` «Y lo mismo para lo que `S26` deja en `CANCEL_SCHEDULED`»
- `NUCLEO/08` §3, la fila de abrir la marca: `nucleo/08:210` «o `S12` en la fecha de fin sobre una vertical»
- Al pasar, esa fila no tenía el `USER`/`GLOBAL` de `V2-d` (espejo que `26-` no tocó):
  `nucleo/08:210` «o si es un `USER`/`GLOBAL` que `S26` canceló»
- La unidad B10: `$B/descomposicion.md:136` «o el 15 si la vertical de la principal tiene una fila en `vertical_discontinuation`»
- Su criterio: `$B/descomposicion.md:749` «termina en esa fecha por `S21` con la marca 15 y no la 14»

**Dos derivaciones mías, dichas.** La primera: **la regla es para `S12` por su primer evento**, la
fecha de fin, y así quedó en `S21` y en todos los espejos. El segundo evento de `S12` es un
contracargo, un acto del titular, que sigue en el 14 como `S31`; `V2-n` habla de la cancelación que
puso `S26`, que se consuma en la fecha de fin. La segunda: **la deducción es por la vertical y no
por la fila**, así que también manda al 15 la `CANCEL_SCHEDULED` que la persona pidió por `S11`
antes del anuncio y termina después. Es la letra de la decisión (*«lo deduce de que la vertical…
tiene una fila»*); lo dejé escrito en `B/03` §3.2 como costo y lo llevo a los casos vecinos (§4,
caso 1).

**Conteos.** La partición de `DEC-RF-004` pasa de *«parte TRES y deja dos»* a *«parte CUATRO y deja
uno»*; los *«cinco caminos que no son un acto del cliente»* siguen siendo cinco, y las *«otras
ocho»* transiciones de la fila del 14 siguen siendo ocho, porque `S12` ya estaba contado por mitades.
Los motivos no se mueven (§2).

### `V2-o` · `S36` devuelve el pago retenido por su `RF1`, y la rama 6 no abre marca (caso 3 de `26-` §5)

- `S36`, donde vive la regla: `B/03:184` «y ese pago retenido es el último pago acreditado que devuelve el `RF1` de esta fila»
- `S18`, que abría la marca: `B/03:166` «Salvo cuando la predecesora murió por `S36`»
- `S19`: `B/03:167` «y en la 6 no cuando la baja es `S36`, que lo devuelve por su `RF1`»
- La tabla de las escrituras de `S18`, escritura 5:
  `B/03:588` «`S36` desde `GRACE_PERIOD` está en la rama 6 y no corre esta escritura»
- La tabla de las salidas de la sucesión: `B/03:775` «salvo tras `S36`, cuyo `RF1` ya devuelve ese pago, y no hay marca»
- La rama 6 en `B/12` §5.3: `B/12:679` «Tras `S36` no hay marca»
- El motivo 1: `B/02:980` «en la 6, no tras `S36`, cuyo `RF1` devuelve el pago retenido»
- La columna del reembolso del pago manual: `B/02:402` «en la 6, tras `S36` lo devuelve su `RF1` y no la marca»
- `B/19` §6: `B/19:225` «en la 6, no tras `S36`, cuyo `RF1` ya devuelve el pago»
- La unidad B5: `$B/descomposicion.md:131` «y `S18` no abre la marca de la rama 6 sobre él»

**La rama 6 sigue siendo una y sigue teniendo tres filas**: `S36` no sale de ella, sólo no escribe
la marca. **Y los 10 días de `S36` se cuentan desde el pago retenido**, que es la lectura que
`26-` §5 caso 3 dejaba como consecuencia de esta opción: el pago retenido es *«el último pago
acreditado»* de la revocación.

### `V2-p` · la marca 7 de la sonda del manifiesto, declarada

- En lo que `B/09` NO cierra, donde vive el trato de la sonda:
  `B/09:1102` «La marca de la sonda del manifiesto nace proponiendo devolverle al owner su propio cobro»
- `B/09:1107` «El owner la levanta sin»
- La remisión desde §2.4: `B/09:110` «aunque nazca con la propuesta de devolver, que es lo que el motivo 7 propone siempre»

No mueve la regla de `B/19` §6 (*«la propuesta no depende de nada más que el motivo»*), que es
justo lo que la opción elegida conserva.

### `V2-q` · la marca 22 sobre un complemento que `S7` canceló

- `S7`: `B/03:155` «La que `S32` no alcanzó tiene abierta la marca `PAUSA_NO_APLICADA`»
- El motivo 22, columna de qué hace la persona:
  `B/02:1001` «y si después `S7` canceló el complemento por la regla de `S11`, la cancelación no la resuelve»

### `V2-r` · el paso 0 cuenta las anuales vivas del viejo (caso 7 de `26-` §5)

- El paso 0: `D/16:122` «Y se cuentan las suscripciones anuales vivas del sistema viejo»
- Por qué: `D/16:122` «así que sobre él la segunda corrida puede caer hasta un año después del corte»
- `D/16:122` «No es condición del corte: dice cuándo cae la segunda corrida»
- `B/21` §1.3, donde se define la segunda corrida: `B/21:106` «Sobre una suscripción anual del viejo esa fecha puede caer hasta un año»
- El detector de lo que el capítulo NO cierra: `B/21:498` «Sobre un anual del viejo la segunda corrida puede»

**Dos cosas son mías.** Que el recuento **no es condición del corte**: `V2-r` pide contar y no
dice que bloquee, y el recuento no cambia qué cubre la regla de la marca, sólo cuándo cae la
segunda corrida. Y que el anual del sistema actual es `frequency: 12` con `frequency_type: months`:
sale del `CLAUDE.md` del repo (*«Annual is a recurring preapproval at qzpay's `'annual'`
cadence»*), no de una medición. La fila de matriz va propuesta (§6, `EX-50`), sin escribir.

### `V2-s` · el sujeto de la acción 16 es la vertical

- `V/17` §3.2, regla 5: `V/17:399` «En la decimosexta, discontinuar una vertical, el sujeto es la vertical»
- Lo que `V/17` NO cierra, porque la regla 5 es de ese capítulo:
  `V/17:629` «El `SUPER_ADMIN` que es dueño en la vertical que discontinúa»
- El resumen de `DEC-OBS-001`: `nucleo/08:345` «La acción 16 va»

### `V2-t` · el 4c purga la página de cada destino

- `D/16:133` «una purga por destino, 22»
- La verificación del paso: `D/16:133` «y la página de su destino»
- `V/21` §2.4: `V/21:167` «la página de cada destino, que lista sus alojamientos: una purga por destino, 22»
- La tabla del §2.10: `$V/descomposicion.md:404` «y la página de cada destino, una purga por destino (22)»
- El criterio de V6: `$V/descomposicion.md:530` «y purga la página de cada destino, 22»

**Las 22 purgas sí cuentan para el tope del borde**, a diferencia de las de colección: lo escribí
en el paso para que quien opera el corte no las crea gratis. La etiqueta sale del mapeo del
código (`packages/service-core/src/revalidation/entity-tag-mapper.ts:75`).

### `V2-u` · `PB4`, `PB6` y `PB12` toman el lock (caso 3 de `27-` §5)

- La viñeta de las que liberan cupo: `V/03:882` «Las que liberan cupo también lo toman»
- `V/03:889` «Con esto la excepción de las que sólo liberan cupo queda vacía.»
- La fila de `PB4`: `V/03:583` «como `PB10`, porque lo comparte con `PB2` y `PB3`»
- La de `PB6`: `V/03:585` «como `PB10`, porque lo comparte con `PB2` (FASE»
- La de `PB12`, con la carrera que la motiva: `V/03:591` «sin lock, el dueño la borra mientras `PB3` la restituye»
- La tabla del §2.10: `$V/descomposicion.md:407` «y `PB4`, `PB6` y `PB12`, por la misma razón»
- La unidad V6, que tampoco tenía a `PB10`: `$V/descomposicion.md:59` «y `PB10`, `PB4`, `PB6` y `PB12`, que comparten el suyo con alguna de ellas»

**La viñeta vieja se tacha y no se borra**: su argumento del conteo sigue siendo cierto, y lo dejé
dicho (*«para el conteo no lo necesitan»*). Lo que cambia es que el lock ya no se decide por el
conteo sino por el `desde`.

### `V2-v` · Fastmail y Yandex pierden el `+` (caso 4 de `27-` §5)

- La fila nueva de la lista: `V/02:366` «Fastmail y Yandex ✚»
- Lo que el § NO cierra, con los dos sacados del costo: `V/02:403` «Fastmail y Yandex salieron de este»

Con esto *«Fastmail queda partido en dos»*, que `27-` §1 declaró, deja de ser cierto: `fastmail.com`
y un dominio propio alojado en Fastmail pierden los dos el `+`. No lo escribí en ningún capítulo
porque ninguno lo decía; lo dejo acá.

### `V2-w` · la medición de dominios no exporta casillas (caso 5 de `27-` §5)

- `D/16:122` «la herramienta sólo cuenta dominios: no exporta ni guarda casillas»

### `V2-x` · las cinco elecciones del tramo de verticales, confirmadas

Busqué en los capítulos cada una de las cinco: la fila de los dominios propios como la del resto
(`V/02` §2.2, regla (c)), lo *«a medir»* que no se aplica sin medir (regla (b)), `G-R9` en V6
(`$V/descomposicion.md` §2.10 y la unidad V6), `revalidation_config` en lo que `PURGED` no toca
(`V/02` §4.1) y `PB9` esperando el hecho 4 (`V/03` §9). **Ninguna está marcada como pendiente ni
como elección del tramo en el capítulo**: `27-` las declaró como suyas sólo en su registro. No
edité capítulos; la confirmación va en los 📌 propuestos (§6).

## 2. Conteos recontados

| lista | antes → ahora | comando | espejos |
|---|---|---|---|
| motivos de `B/02` §2.5 | 24 → **24**, con **9** `SÍ` | `python3` sobre las filas `\| N \|` con nombre de motivo y su última columna | sin cambio: `V2-n` mueve caminos entre el 14 y el 15, no motivos |
| filas del listado de `B/19` §6 | 11 → **11**, **9** proponen devolver, 1 no devolver, 1 nada | `python3` sobre la tabla `\| motivo \| qué propone el listado \|` | *«diez que proponen algo»* de `B/19:249` sigue siendo exacto |
| caminos nuestros que no son acto del cliente | 5 → **5** | lectura de `B/03` §3.2 | sin cambio |
| caminos que parte la ampliación de `DEC-RF-004` | 3 y quedan 2 → **4 y queda 1** | lectura de la tabla del reparto | `B/03` §3.2 (cuatro lugares), `B/02` motivo 14, `B/16` §4.4, `B/19` §6 |
| transiciones que sacan a la principal de las filas vivas | 14 → **14** | sin cambio de miembros | sin espejos que tocar |
| ramas de `B/12` §5.3 / filas de la rama 6 | 6 / 3 → **6 / 3** | lectura | `S36` sigue en la rama 6 sin escribir la marca |
| transiciones de la ficha que toman el lock | 7 → **10** (`PB1`, `PB2`, `PB3`, `PB7`, `PB8`, `PB9`, `PB10` + `PB4`, `PB6`, `PB12`) | lectura de `V/03` §9 y de las filas | `$V/descomposicion.md:59` y `:407`; `PB5` y `PB11`, ver §4 caso 5 |
| filas de la lista del seudónimo | 7 → **8** | lectura de la tabla | ninguno cuenta las filas |
| filas de la matriz y `UNKNOWN` | 104 / 10 → **104 / 10** | `contar-filas-de-la-matriz.py` | sin cambio hasta el OK; con `EX-48` a `EX-50`, 107 / 13 (§6) |
| precisadas sin `SUPERSEDED` del log | 44 → **44** | `python3` sobre el campo *Estado*, con el criterio del resumen del log | con los 📌 del §6, 47 (§6) |

## 3. Preguntas abiertas

Ninguna nueva de las que me tocaban. Las decisiones se aplicaron a la letra, salvo las derivaciones
que declaro en el §1: `S12` por su primer evento en `V2-n`, el recuento de `V2-r` como no
condición, y dónde declarar `V2-p` y `V2-s`.

## 4. Casos vecinos

1. **La deducción de `V2-n` alcanza a una baja del cliente.** Una `CANCEL_SCHEDULED` que la persona
   pidió por `S11` **antes** del anuncio y termina después también encuentra la fila de
   `vertical_discontinuation`, así que su complemento va al 15 con propuesta de devolver, aunque la
   baja fue suya. Es la letra de la decisión y lo dejé escrito como costo en `B/03` §3.2; la
   confirma una persona (`DEC-RF-002`). Si el owner quiere cerrarlo, el mecanismo mínimo sería
   comparar la fecha de fin de la fila con la de la vertical, que no es confiable (la fórmula del
   `B/10` §4.3 toma el máximo de lo pagado): no lo propongo como texto.
2. **`B/03` §3.2 *«la baja tiene CUATRO filas»*** (caso 8 de `26-` §5) sigue sin decisión: no lo
   tocó ninguna de `V2-m` a `V2-x`.
3. **`EX-50` pide también el `expire_date` de un anual.** `V2-r` pide contar; pero si hay alguno,
   que su registro de cobro abierto venza a un ciclo (un año) es la extrapolación de `RC-7`, no una
   medición. La fila propuesta lo nombra; si el owner prefiere sólo el conteo, la fila se acorta.
4. **Las 22 purgas del 4c contra el tope del borde.** El paso ahora las cuenta, pero ningún texto
   dice cuál es el tope del plan ni si 22 más las de colección y portada entran en una ventana. Es
   una medición, no texto.
5. **`PB5` tiene la forma de las que `V2-u` alcanzó y no está nombrada.** Sale de `DRAFT`, que
   comparte con `PB1` (toma el lock) y ahora con `PB12`, y no ocupa ni libera cupo: por la viñeta
   de *«las que no ocupan ni liberan cupo lo toman si comparten `desde`»* debería tomarlo, y la
   viñeta sólo nombra a `PB8` y `PB9`. La carrera es `PB5` archivando un borrador que `PB1`
   publica. Es texto, pero nadie lo pidió.
6. **`27-` §1 dice que Fastmail queda partido en dos**, y desde `V2-v` ya no. Es un registro
   histórico y no lo edito; queda dicho acá.

## Key Learnings

1. Una causa que *«no sobrevive»* a un estado intermedio puede estar escrita en otra fila que nadie
   borra (`vertical_discontinuation`): el argumento del mecanismo descartado valía para
   transportarla, no para leerla. Pero leerla por la vertical y no por la fila arrastra a quien
   no la causó.
2. Dos caminos de reembolso sobre el mismo pago (`RF1` de `S36` y la marca de la rama 6) se
   resuelven sin sacar a nadie de la rama: la transición sigue en la rama y sólo omite la
   escritura, así que ningún conteo de ramas se mueve.
3. Vaciar una excepción de lock (`V2-u`) muestra otra transición con la misma forma (`PB5`) que la
   regla general ya alcanzaba y la viñeta no nombraba: una regla con lista de ejemplos se lee como
   lista cerrada.
4. Un arreglo que cambia un texto escrito en el mismo lote (el argumento de `V2-d` en `S26`) se
   tacha igual que uno viejo: la fecha dice qué decisión lo reemplazó.

## 5. Cómo se verificó

- Citas: `cd $D/27-fase-8-vuelta-1 && python3 verificar-citas.py ../29-fase-8-vuelta-2/28-aplicacion-verificacion-cierre.md`.
- markdownlint desde la raíz del worktree sobre los 16 capítulos tocados y este registro.
- Sin em dashes en el texto nuevo, revisado con un diff por segmentos insertados.

## 6. Para el log y la matriz (pide OK del owner)

Consolida lo que propusieron [`26-`](./26-aplicacion-verificacion-billing.md) §3,
[`27-`](./27-aplicacion-verificacion-verticales.md) §3 y este tramo. Grepeé cada ID en
`$D/01-decision-log.md` el 2026-09-28: **ninguna decisión tiene todavía un 📌 ni un *Estado* con
`V2-`**, así que nada de esto está escrito. Donde un 📌 de `26-` o `27-` quedó falso o incompleto por
una decisión de este tramo, va reescrito acá y lo digo; el texto de este § reemplaza al de ellos.
Los números de línea son del log en HEAD `18077a6d41`.

### Matriz (`$D/06-mp-validation-matrix.md`, después de `EX-47`)

Los guiones de las celdas vacías son la convención de la matriz, no prosa.

1. **`EX-48`** (`V2-a`, propuesta por `26-`, sin cambio). **Razón**: la regla de `R2` decide con
   ese dato desde `V2-a`, y desde `V2-m` es condición del 1b.
   > | **EX-48** ✚ | Leído por id el pago que aprobó un registro de cobro (`authorized_payment`) en un **reintento** posterior a la creación del registro, ¿qué campo trae el instante de esa aprobación, distinto del `date_created` del registro? | la ventana del corte: si un cobro sobre la lápida del corte es posterior al corte (`B/21` §2.5, `B/09` §3, `B/05` §3; FASE 9 vuelta 2, verificación, `V2-a`, `F-8V2B3-002`) | `UNKNOWN` | — | — | — | Se mide en el paso 0 del corte (`16-fase-7…` §4.2) sobre una sonda propia con un registro que se rechaza y cobra en un reintento (`GR-1`, `RC-6`). Un campo que dé la fecha del registro, o que no venga en la lectura por id, no sirve. Si ningún campo es confiable, la ventana vuelve al owner, **y el 1b no arranca sin este dato** (`V2-m`) |

   Cambio respecto de `26-`: la última frase suma *«y el 1b no arranca sin este dato (`V2-m`)»*.
2. **`EX-49`** (`V2-j4`, propuesta por `27-`, sin cambio de fondo). **Razón**: `V2-j4` pide la fila.
   > | **EX-49** ✚ | ¿Qué variantes de un correo entregan en la misma casilla, por proveedor? Sin puntos, con `+t1`, en mayúsculas y en los dominios hermanos, sobre cuentas receptoras nuevas del owner en Outlook, Hotmail, Yahoo, Proton, iCloud y Gmail (unos 30 correos, `29-…/25-` §4); y la distribución de dominios de la tabla de usuarios, **contando sólo dominios, sin exportar ni guardar casillas** (`V2-w`) | la lista cerrada del seudónimo del correo (`V/02` §2.2; FASE 9 vuelta 2, verificación, `V2-j1` a `V2-j4`) | `UNKNOWN` | — | — | — | Se mide en el paso 0 del corte (`16-fase-7…` §4.2), antes del despliegue que lleva la lista. Un rebote 550 prueba que la variante cuenta; que llegue, que se ignora; *nada a los 30 minutos* no prueba nada y se repite. Lo que la tabla da como *«si la medición lo confirma»* entra sólo si lo confirma; lo que la medición muestre fuera de la tabla vuelve al owner |

   Cambio respecto de `27-`: suma la restricción de `V2-w` en la primera celda.
3. **`EX-50`** (`V2-r`, nueva). **Razón**: `V2-r` pide la fila; la segunda corrida del detector
   depende de un `expire_date` que `RC-7` midió sólo sobre ciclos de 1 y 2 días.
   > | **EX-50** ✚ | ¿Cuántas suscripciones del sistema viejo con ciclo anual (`frequency: 12`, `frequency_type: months`) siguen vivas el día del corte, y qué `expire_date` trae el registro de cobro abierto de cada una? | la fecha de la segunda corrida del detector del cobro sobre la lápida del corte (`B/21` §1.3 y «NO cierra»; FASE 9 vuelta 2, verificación, `V2-r`) | `UNKNOWN` | — | — | — | Se cuenta en el paso 0 del corte (`16-fase-7…` §4.2), sobre el recorrido del proveedor del 1b. `RC-7` midió `expire_date` = un ciclo sobre ciclos de 1 y 2 días; sobre un anual es una extrapolación. No es condición del corte: dice cuándo cae la segunda corrida |

**Recuento si el owner acepta las tres**: la matriz pasa de 104 a **107** filas y los `UNKNOWN` de
10 a **13**. Espejos de billing (`$B/spec.md` §5.2, `B/06` §11 con su recuento de la línea 28, y
`$B/descomposicion.md` §2.7): suman **`EX-48` y `EX-50`**, con la unidad **B11** y la herramienta
del corte (paso 0), como `EX-44`; pasan de diez a **doce** filas `UNKNOWN`, y la frase de la línea 431 de
`B/06` (*«`EX-43` a `EX-47` son cinco lecturas…, tres de ellas en el paso 0»*) pasa a *«`EX-43` a
`EX-48` y `EX-50` son siete lecturas…, cinco de ellas en el paso 0»*. **`EX-49` no va a esos espejos**: la
construye la herramienta del corte con la lista de V9, y si el owner la quiere en un censo, es el de
verticales.

### Log (`$D/01-decision-log.md`)

Cada ítem dice la entrada, dónde va el 📌 (después del último de la entrada), el fragmento que se
suma al campo *Estado* antes de *«· **Decide**»*, el texto del 📌 y la razón.

1. **`DEC-MIG-005`** (`:5824`; 📌 existente en `:5894`). Junta `V2-a` (de `26-`), `V2-m` y `V2-r`.
   **Razón**: el paréntesis *«(`date_created` del registro)»* del 📌 existente queda falso, y el
   paso 0 gana una condición y un recuento.
   - *Estado*, se suma con el separador de la entrada: **y precisada otra vez con OK del owner** (FASE 9 vuelta 2, verificación: `V2-a` el 2026-09-27, `V2-m` y `V2-r` el 2026-09-28: la fecha del pago, el 1b que la espera y las anuales del viejo; ver su segundo 📌)
   > 📌 **Precisado con OK del owner (FASE 9 vuelta 2, verificación: `V2-a` el 2026-09-27; `V2-m`
   > y `V2-r` el 2026-09-28)**: el día del cobro se lee en la fecha del pago que aprobó el registro,
   > leído por id, y no en el `date_created` del registro, que no se mueve con los reintentos. Qué
   > campo del pago la trae se mide en el paso 0 del corte (`EX-48`), y el 1b no arranca sin ese
   > dato: si ningún campo es confiable, vuelve al owner antes del corte. Y el paso 0 cuenta las
   > suscripciones anuales vivas del viejo (`EX-50`), porque sobre ellas la segunda corrida del
   > detector puede caer hasta un año después del corte.
2. **`DEC-MIG-003`** (`:2708`; tercer 📌 en `:2803`). `V2-t`. **Razón**: el 4c que ese 📌 describe
   gana las páginas de destino.
   - *Estado*, se suma con el separador de la entrada: **y el paso 4c, precisado el 2026-09-28, con OK del owner** (FASE 9 vuelta 2, verificación, `V2-t`: la página de cada destino; ver su cuarto 📌)
   > 📌 **Precisado el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-t`)**: el
   > paso 4c revalida también la página de cada destino, que lista sus alojamientos y el código
   > invalida por su destino: una purga por destino, 22, que cuentan para el tope del borde.
3. **`DEC-SUB-009`** (`:1245`; 📌 en `:1293`). `V2-b`, de `26-`, sin cambio. **Razón**: el crédito
   también sostiene la baja desde una pausa por cortesía.
   - *Estado*, se suma con el separador de la entrada: **y precisada otra vez el 2026-09-27, con OK del owner** (FASE 9 vuelta 2, verificación, `V2-b`: la baja desde `PAUSED` de una sucesora que vive del crédito; ver su segundo 📌)
   > 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, verificación, `V2-b`)**: la
   > baja desde `PAUSED` de una sucesora que vive del crédito sin consumir (`S22`) va a
   > `CANCEL_SCHEDULED` con fin en el fin del crédito, con la regla de `S11` entera, complementos
   > incluidos.
4. **`DEC-ADDON-002`** (`:1926`; 📌 en `:2003`). `V2-c`, `V2-d` y `V2-e`, de `26-`, sin cambio.
   **Razón**: la selección que ese 📌 nombra tiene lectura confirmada y dos usuarios más.
   - *Estado*, se suma con el separador de la entrada: **y precisada otra vez el 2026-09-27, con OK del owner** (FASE 9 vuelta 2, verificación, `V2-c`, `V2-d` y `V2-e`: la selección confirmada, `S26` sobre los `USER`/`GLOBAL` y el disparador nuevo de `S32`; ver su segundo 📌)
   > 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, verificación, `V2-c`, `V2-d`
   > y `V2-e`)**: la selección de `S32` en la baja suma `CANCEL_SCHEDULED` a la exclusión. `S26`
   > la aplica a los `USER`/`GLOBAL` compatibles con la vertical que discontinúa. Y cuando una de
   > las catorce transiciones saca a una principal de las filas vivas y la orfandad de un
   > `USER`/`GLOBAL` no se cumple sólo porque las otras compatibles están pausadas o suspendidas,
   > `S32` lo pausa en el mismo acto.
5. **`DEC-SUB-019`** (`:5352`; segundo 📌 en `:5409`). `V2-q`. **Razón**: ese 📌 dice que `S7`
   cancela los complementos por la regla de `S11`, y no qué pasa con la marca 22 que ya tenían.
   - *Estado*, se suma con el separador de la entrada: **y precisada otra vez el 2026-09-28, con OK del owner** (FASE 9 vuelta 2, verificación, `V2-q`: la marca 22 sobre un complemento que `S7` ya canceló; ver su tercer 📌)
   > 📌 **Precisada el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-q`)**: si
   > el complemento que `S7` cancela por la regla de `S11` tenía abierta la marca
   > `PAUSA_NO_APLICADA`, la cancelación no la resuelve: la levanta una persona después de ver que
   > el complemento ya no cobra.
6. **`DEC-RF-001`** (`:1625`; 📌 de la parte 1 en `:1656`). `V2-o`. **Razón**: la parte 1 (*«reembolso
   total + cancelación en un solo acto»*) gana qué pago es *«el último acreditado»* cuando hay uno
   retenido.
   - *Estado*, se suma con el separador de la entrada: **y la parte 1 precisada otra vez el 2026-09-28, con OK del owner** (FASE 9 vuelta 2, verificación, `V2-o`: el pago retenido por `S19`; ver su último 📌)
   > 📌 **Precisada el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-o`)**:
   > cuando `S36` corre desde `GRACE_PERIOD` sobre una predecesora que retiene un pago por `S19`,
   > ese pago es el último pago acreditado de la revocación: lo devuelve su `RF1`, los 10 días se
   > cuentan desde él, y la rama 6 no abre marca sobre ese pago.
7. **`DEC-RF-003`** (`:4012`, sin 📌). `V2-o`. **Razón**: el default *devolver* de la rama 6 ya no
   corre tras `S36`.
   - *Estado*, se suma con el separador de la entrada: **precisada el 2026-09-28, con OK del owner** (FASE 9 vuelta 2, verificación, `V2-o`: tras `S36` la rama 6 no abre marca; ver su 📌)
   > 📌 **Precisada el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-o`)**: tras
   > `S36`, la rama 6 no abre la marca: el pago retenido lo devuelve el `RF1` de la revocación. La
   > rama sigue siendo una, con sus tres filas.
8. **`DEC-RF-004`** (`:4689`, sin 📌). `V2-n`. **Razón**: su texto dice que `S17` y `S12`-vía-`S26`
   *«siguen en `NO DEVOLVER`»* y *«lo que NO se parte»* nombra los dos (`:4711`–`:4738`); desde `V2-n`
   queda sólo `S17`.
   - *Estado*, se suma con el separador de la entrada: **precisada el 2026-09-28, con OK del owner** (FASE 9 vuelta 2, verificación, `V2-n`: `S12`-vía-`S26` pasa al lado que devuelve; ver su 📌)
   > 📌 **Precisada el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-n`)**: la
   > ampliación parte cuatro caminos y deja uno. `S12`-vía-`S26` ya no depende de transportar la
   > causa: `S21` la lee en la fecha de fin en la fila de `vertical_discontinuation` de la vertical
   > de la principal, y abre el 15. Queda del lado de la regla sólo `S17`. La lectura es por la
   > vertical y no por la fila, así que también alcanza a la baja que la persona pidió antes del
   > anuncio y termina después.
9. **`DEC-RF-006`** (`:4986`; 📌 en `:5052`). Junta `V2-d` (de `26-`), `V2-n` y `V2-p`. **Razón**: el
   15 gana dos poblaciones, y el default por motivo gana una excepción declarada. El 📌 de `26-`
   decía sólo el `USER`/`GLOBAL`; va reescrito.
   - *Estado*, se suma con el separador de la entrada: **y precisada otra vez con OK del owner** (FASE 9 vuelta 2, verificación: `V2-d` el 2026-09-27, `V2-n` y `V2-p` el 2026-09-28: el 15 gana el `USER`/`GLOBAL` de `S26` y el `S12`-vía-`S26`, y la marca de la sonda se declara; ver su segundo 📌)
   > 📌 **Precisada con OK del owner (FASE 9 vuelta 2, verificación: `V2-d` el 2026-09-27; `V2-n` y
   > `V2-p` el 2026-09-28)**: abren el 15 y no el 14, en la fecha de fin, el `USER`/`GLOBAL` que
   > `S26` canceló y todo complemento cuya principal mató `S12` sobre una vertical con fila en
   > `vertical_discontinuation`. Siguen siendo veinticuatro motivos, nueve que devuelven. Y la marca
   > 7 de una sonda del manifiesto del corte nace proponiendo devolver, como toda marca de ese
   > motivo: se declara, el owner la levanta sin devolver, y no hay motivo nuevo.
10. **`DEC-OBS-001`** (`:2055`, sin 📌). Junta `V2-f` (de `26-`) y `V2-s`. **Razón**: el resumen
    gana un tipo sin marca y la forma de la acción 16.
    - *Estado*, se suma con el separador de la entrada: **precisada con OK del owner** (FASE 9 vuelta 2, verificación: `V2-f` el 2026-09-27, `V2-s` el 2026-09-28: el cobro por debajo del esperado y el sujeto de la acción 16; ver su 📌)
    > 📌 **Precisada con OK del owner (FASE 9 vuelta 2, verificación: `V2-f` el 2026-09-27; `V2-s`
    > el 2026-09-28)**: el resumen lista el cobro por debajo del monto esperado de su período, con
    > el sujeto y la diferencia; no abre marca ni mueve el conteo de motivos. Y lista la acción 16
    > con la vertical como sujeto y cuántos dueños alcanza, así que el `SUPER_ADMIN` que además es
    > dueño en esa vertical queda visible ahí, sin regla nueva.
11. **`DEC-TRIAL-004`** (`:429`; 📌 de `R23` en `:461`). `V2-j1` a `V2-j4` (de `27-`), más `V2-v`,
    `V2-w` y la confirmación de `V2-x`. **Razón**: *«Gmail, Outlook y los que se midan»* queda falso.
    El 📌 de `27-` no tenía a Fastmail y Yandex; va reescrito.
    - *Estado*, se suma con el separador de la entrada: **y precisada otra vez el 2026-09-28, con OK del owner** (FASE 9 vuelta 2, verificación, `V2-j1` a `V2-j4`, `V2-v`, `V2-w` y `V2-x`: la lista por proveedor; ver su segundo 📌)
    > 📌 **Precisada el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-j1` a
    > `V2-j4`, `V2-v`, `V2-w` y `V2-x`)**: la normalización sigue la lista por proveedor de `V/02`
    > §2.2. Gmail quita puntos y `+`; Microsoft consumidor sólo el `+`, sin unificar dominios;
    > Proton e iCloud unifican y quitan el `+`; Fastmail y Yandex quitan el `+`; todo dominio que la
    > lista no nombra cuenta como dominio propio y quita el `+`. Lo marcado *«a medir»* entra sólo
    > si la medición del paso 0 lo confirma, y lo que la medición muestre fuera de la lista vuelve
    > al owner. La medición de dominios sólo cuenta dominios: no exporta ni guarda casillas.
12. **`DEC-ARCH-011`** (`:6062`; 📌 en `:6087`). `V2-g`, `V2-h` y `V2-i` (de `27-`), sin cambio de
    fondo; `V2-s` va a `DEC-OBS-001` (ítem 10) y no acá. **Razón**: la acción gana el acortamiento,
    el reintento automático y su lugar fuera de las máquinas.
    - *Estado*, se suma con el separador de la entrada: **y precisada otra vez el 2026-09-27, con OK del owner** (FASE 9 vuelta 2, verificación, `V2-g`, `V2-h` y `V2-i`: acortar la cola, la capa de composición y el reintento; ver su segundo 📌)
    > 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, verificación, `V2-g`, `V2-h`
    > y `V2-i`)**: la acción 16 es *«discontinuar una vertical o acortar su cola»*, con el mismo
    > permiso, y la confirmación del acortamiento dice cuántos compromisos se reembolsan. Es capa
    > de composición, fuera de las máquinas de las dos épicas, y la única que la regla de vigilancia
    > exime por nombre. Si la mitad de billing falla, el reintento es automático y lleva la firma y
    > la correlación del `SUPER_ADMIN` que confirmó.
13. **`DEC-ARCH-006`** (`:2266`; último 📌 en `:2357`). Confirmación de `V2-x` sobre `PB9`. **Razón**:
    ese 📌 dice que el hecho 4 lo ejecuta el reconciliador diario, y no que `PB9` lo espera.
    - *Estado*, se suma con el separador de la entrada: **y precisada otra vez el 2026-09-28, con OK del owner** (FASE 9 vuelta 2, verificación, `N-B-03` confirmado por `V2-x`: `PB9` no borra con el hecho 4 pendiente; ver su último 📌)
    > 📌 **Precisada el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-x` sobre
    > `N-B-03`)**: `PB9` no borra una ficha de una vertical cuya `finDeServicio` ya pasó mientras la
    > corrida del reconciliador no escribió el hecho 4, así que `finDeServicio` tiene tres lectores
    > en verticales y no dos.
14. **`DEC-TEST-001`** (`:4098`; 📌 en `:4137`). `V2-k` (de `27-`) con la confirmación de `V2-x`.
    - *Estado*, se suma con el separador de la entrada: **y enmendada el 2026-09-27, con OK del owner** (FASE 9 vuelta 2, verificación, `V2-k`, con su unidad confirmada el 2026-09-28 por `V2-x`: `G-R9`; ver su último 📌)
    > 📌 **Enmendada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, verificación, `V2-k`)**:
    > `G-R9` vigila la lista cerrada de `PURGED` recorriendo el esquema, y lo construye V6 (unidad
    > y nombre confirmados el 2026-09-28, `V2-x`). El programa pasa a 32 guards, 19 de verticales y
    > 13 de billing.
15. **`DEC-DATA-005`** (`:5588`; segundo 📌 en `:5623`, el de `R9`). `V2-l` (de `27-`, que dejó la
    entrada sin ubicar: es ésta) con la confirmación de `V2-x`.
    - *Estado*, se suma con el separador de la entrada: **y precisada otra vez con OK del owner** (FASE 9 vuelta 2, verificación: `V2-l` el 2026-09-27, `V2-x` el 2026-09-28: la clase del correo de la alerta cerrada y `revalidation_config`; ver su tercer 📌)
    > 📌 **Precisada con OK del owner (FASE 9 vuelta 2, verificación: `V2-l` el 2026-09-27; `V2-x`
    > el 2026-09-28)**: el correo de la alerta de precio cerrada es transaccional. Y la configuración
    > de revalidación, que tiene `entity_type` y no nombra ninguna ficha, está en la fila de lo que
    > `PURGED` no toca.

**Sin 📌**: `V2-u` (el lock de `PB4`, `PB6` y `PB12`) no tiene entrada en el log: el lock por
`user + vertical` vive en `V/03` §9 desde el racimo `R14` de la FASE 8 completa, sin decisión con
ID. Si el owner la quiere registrada, es una entrada nueva, no un 📌.

**Recuento del resumen del log si el owner acepta los quince**: *Precisadas sin `SUPERSEDED`* pasa
de **44** a **47**, por `DEC-OBS-001`, `DEC-RF-003` y `DEC-RF-004`, que hoy tienen el *Estado* en
`ACCEPTED` a secas (recontado con script sobre el campo *Estado* entero, con el criterio del
resumen: 44 hoy, igual que la tabla). Las otras doce ya cuentan. *Decisiones tomadas* no se mueve:
ninguna es nueva.

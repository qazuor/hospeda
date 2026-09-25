---
title: FASE 9-bis-4 — Rastro por aparición de la familia del grant y el addon
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 9-bis-4
---

# Rastro por aparición · `ce52dce5f`

Cumple la parte 2 de `DEC-METH-011`: **por cada aparición que NO se corrigió y que vive en un
párrafo que el commit no tocó**, van el archivo, las líneas, el §, la cita y **por qué sigue
siendo correcta**. No hay agregados: cada línea de abajo se puede tomar sola y mostrarse falsa.

## El commit

| sha | qué cierra |
|---|---|
| `ce52dce5f` | `F-8eB3-002` — `permanent_grant` gana `revocado_en`, y *«grant vivo»* / *«ancla viva»* pasan a ser términos con columna e inventario · `F-8eB2-002` — las dos escrituras de `S20` quedan ordenadas: primero el ancla-título, después el cobro |

## 1. Qué se arregló, en una frase cada uno

**`F-8eB3-002`.** Tres predicados del diseño preguntan *«¿sigue vivo ese grant?»* **el día
después del acto** —la tercera y la cuarta comprobación de cero llamadas de `B/09` §3 y la
tercera mitad de la orfandad de `B/16` §4.2—, y `permanent_grant` **no declaraba ni estado ni
revocación**: la revocación existía como **acto**, y un acto no se puede leer más tarde. Los tres
eran inevaluables, y lo que dejaban sin ver es que **alguien paga todos los meses algo que el
§35.2 y el §35.3 declaran gratis**.

| pieza | dónde |
|---|---|
| `permanent_grant.revocado_en` (anulable) + quién la firmó | `B/02` §2.4 |
| **grant vivo** = `revocado_en` nulo · **ancla viva** = fila de `permanent_grant_vertical` cuyo grant lo está | `NUCLEO/01` §2.4 |
| el inventario de consumidores de los dos términos, **nueve filas**, partido por el sujeto del predicado | `NUCLEO/01` §2.4 |
| **revocar retira las anclas como TÍTULO, no como FILAS** | `B/02` §2.4, `B/03` §8, `B/16` §3.3, `12-contrato…` §2.8 |
| **un grant revocado no emite ninguna fuente** | `12-contrato…` §2.8 |

Las filas de `permanent_grant_vertical` **no se borran** por dos razones que ya estaban escritas
en otros capítulos: `addon_instance` apunta ahí y la cuarta comprobación lee el ancla **después**
de la revocación, y *«un efecto lateral de borrar una fila»* es el mecanismo que el
`12-contrato…` §2.8 rechaza con esas palabras.

**`F-8eB2-002`.** `S20` había copiado de `S13` el *«idempotente y reanudable fila por fila»*
teniendo **dos escrituras sobre dos entidades**, y la que cancela el cobro **saca la fila de su
propio `desde`**. El arreglo es declarar el orden:

| orden | qué deja una corrida cortada | ¿reanudable? | ¿detectable? |
|---|---|---|---|
| cancelar el cobro y después anclar ❌ | instancia `ACTIVE`, sin cobro, **ancla-título en nulo** | no | **no, en 3 de los 4 scopes** |
| anclar y después cancelar el cobro ✅ | instancia ya anclada, complemento **todavía vivo** | sí | sí: la 2ª fila de la 3ª comprobación |

## 2. Cómo se tocan los dos

Son **el mismo mecanismo visto desde sus dos puntas**, y por eso van en un commit:

- El arreglo 1 **le da estado al grant**; el arreglo 2 **necesita poder preguntar por él**. La
  tercera comprobación —la que levanta la corrida de `S20` cortada— arranca por *«un **ancla
  viva** en la vertical V»*: sin la columna del 1, el orden del 2 deja un estado reanudable que
  **nadie levanta**.
- Y al revés: sin el orden del 2, la columna del 1 llega tarde. El ancla-título en nulo deja la
  tercera cláusula de `A5` **sin sujeto**, así que el grant puede estar perfectamente vivo o
  perfectamente revocado y el addon sigue encendido igual. Un `revocado_en` impecable no apaga
  nada si la instancia no dice de qué ancla colgaba.
- El punto donde se cruzan tiene nombre: **una corrida de `S20` cortada sobre la que después se
  revoca el grant**. Con las dos mitades puestas, `A5` encuentra el ancla, apaga la instancia y
  `S21` cierra la fila de complemento detrás (`B/03` §3.2 y §8). Con cualquiera de las dos
  faltando, ese camino termina en el addon *«funcionando gratis para siempre y sin
  suscripción»*, que es el desenlace que `B/16` §3.3 declara inadmisible.

## 3. Qué se grepeó

**Términos NUEVOS** (los que el arreglo define): *«grant vivo»* · *«ancla viva»* ·
`permanent_grant.revocado_en` · *«revocar retira las anclas como TÍTULO, no como FILAS»* ·
*«un grant revocado no emite ninguna fuente»* · *«el orden de las dos escrituras de `S20`»* ·
*«reanudable fila por fila BAJO ese orden»*.

**Términos VIEJOS que se retiran**, grepeados aparte porque el consumidor no actualizado no
aparece buscando el nuevo: *«uno vivo»* (la palabra sola sobre el grant, en el evento de `S13` y
de `S20`) · *«el grant no vence»* leído como *«no tiene forma de dejar de estar vivo»* ·
*«retira todas las anclas (a la vez)»* leído como borrar filas · *«desanclar»* · *«`S20` es
idempotente y reanudable fila por fila»* (la frase de `S13` copiada) · *«que el grant del ancla
siga vivo es un dato de nuestra base»* (era **falsa** cuando se escribió).

**Una clase excluida a propósito, y va nombrada**: el *«derecho de revocación»* del `B/22`
(§2.2, y sus filas en `13-pliego-consulta-legal.md`, `DEC-RF-001` y `B/06` §5) es **otro
término con otro sujeto** — el arrepentimiento del consumidor sobre una compra, no la revocación
de una concesión. No lo toca nada de este commit y no entra en el conteo.

**Alcance**: los **52 archivos** del corpus —las dos épicas con sus `spec.md` y
`descomposicion.md`, el núcleo, el contrato, el corte, la partición, el decision log y los
documentos de medición—, con y sin backticks, **incluidos los nueve archivos que el commit
toca**. La lista se construyó con `fd -e md` sobre los tres directorios, quitando los informes de
fase (`14-…` a `21-…`) y el PDR.

**Medido sobre el árbol en `ce52dce5f`**: **269** líneas con al menos una aparición, repartidas
en **155** párrafos; **47** de esos párrafos los tocó el commit; **108** no, y son los que van
abajo, uno por uno. La partición se calculó con los rangos `+` de
`git diff --unified=0 ce52dce5f^..ce52dce5f` proyectados sobre los bloques separados por línea en
blanco —la unidad que `DEC-METH-010` obligación 1 fija es el **párrafo**—, no a ojo.

## 4. Las 108 apariciones no corregidas, una por una

### `01-decision-log.md` (14)

**El log no se edita** (regla dura de la fase), así que estas catorce van con su razón y ninguna
con un cambio. Ninguna de las catorce se volvió falsa: las decisiones describen **qué se
decidió**, y este commit **no cambia ninguna decisión** — le da soporte de datos a la que
`DEC-ADDON-006` ya había tomado y ordena las escrituras que `DEC-ADDON-003` ya había enumerado.

- **L810-838 · `DEC-GRANT-001`** — «Si el grant se **revoca**, **no se reanuda el débito viejo**»
  → sigue correcta: el commit no toca qué pasa al revocar, sólo **guarda que se revocó**. La
  decisión no afirma en ningún lado que la revocación no deje rastro.
- **L869-898 · `DEC-DATA-001`** — la retención con sus avisos → sigue correcta: no nombra ni el
  grant ni el addon; entró al grep por *«revoca»* en su prosa de suspensión, que es otro sujeto.
- **L2370-2404 · `DEC-GRANT-005`** — «`permanent_grant` gana **`plan_id`** (no anulable) y el
  **piso del trinquete**» → sigue correcta y **no está en tensión con la columna nueva**: aquélla
  es la implicación de anclar al plan (hoy vive en `permanent_grant_vertical`) y `revocado_en` es
  del instrumento. Agregar una columna no contradice las que la decisión pidió.
- **L2475-2524 · `DEC-MIG-003`** — las ocho filas se cancelan y las dos cortesías se escriben
  como `permanent_grant` → sigue correcta: nacen **vivas**, con `revocado_en` nulo, que es el
  valor por defecto de la columna. El corte no cambia.
- **L2820-2863 · `DEC-GRANT-006`** — `courtesy_grant.scope` se retira; *«una cortesía se vence
  sola, así que no hay revocación que se escape»* → **sigue correcta, y es la comparación que
  explica por qué el grant necesitaba la columna y la cortesía no**: la cortesía **guarda su
  fin** (`días o meses, inicio, fin`), el grant no guardaba nada.
- **L2973 · `DEC-TRIAL-009`, título** — «Revocar un grant NO devuelve el trial» → sigue correcta:
  es sobre el trial, y el trial no cambia.
- **L2975-2996 · `DEC-TRIAL-009`, cuerpo** — «**Revocar el grant no lo devuelve**: no hay
  transición de vuelta» → sigue correcta. El commit **no crea** una transición de vuelta: agrega
  una marca de que el acto ocurrió, que es lo contrario de revertirlo.
- **L3081 · `DEC-ADDON-003`, título** → sigue correcta.
- **L3083-3132 · `DEC-ADDON-003`, cuerpo** — «se cancela la suscripción de complemento y la
  instancia pasa a colgar del ancla como su título» → **sigue correcta y el commit no la
  contradice: la ordena**. La decisión enumera las dos escrituras sin fijar su orden, y fijarlo
  es mecánica, que es exactamente lo que su propio apartado *«las cinco cosas de mecánica»*
  declara resoluble fuera del log.
- **L3156-3184 · `DEC-ADDON-004`, cola** — «`S20` también lo dispara un acto de otra entidad y
  también es fila propia» → sigue correcta: `S20` sigue siendo una fila de `B/03` §3.2 y el
  precedente que `S21` usa no se movió.
- **L3190-3241 · `DEC-SUB-012`** — «En `DEC-TRIAL-009` (revocar un grant) y `DEC-ADDON-003` (su
  addon) **nosotros** terminábamos algo deliberadamente» → sigue correcta: el criterio de cuándo
  se repara no cambia porque el acto ahora quede registrado.
- **L3247-3266 · `DEC-ADDON-005`** — «se apaga con el grant, por la tercera cláusula de `A5`» →
  **sigue correcta y este commit es lo que la vuelve ejecutable de punta a punta**: la cláusula
  necesita que la instancia tenga ancla (arreglo 2) y que el ancla se pueda leer después de
  revocado (arreglo 1). La fuga sigue abierta y decidida, sin reabrirse.
- **L3270 · `DEC-ADDON-006`, título** — «porque desanclar no existe» → sigue correcta: el commit
  **no declara desanclar**. Marca el instrumento, que es un acto que ya existía.
- **L3272-3296 · `DEC-ADDON-006`, cuerpo** — «la palabra *«desanclar»* **no aparece en todo el
  corpus**» → **sigue siendo cierta después del commit**: verificado con `rg -i "desancl"`, que
  devuelve sólo las apariciones que la **niegan** (`B/02` §2.4, `B/03` §8, `B/16` §3.3,
  `12-contrato…` §2.8 y este log). Y su premisa *«retira todas las anclas a la vez»* queda
  **precisada, no negada**: se retiran como título y no como filas.

### `B/03-maquinas-de-estado.md` (25)

- **L28-36 · §3, el recuadro de las dos filas con `desde` de conjunto** — «en esta tabla hay
  **dos**, `S13` y `S20` … `S13` cancela **sin evaluar condición**, y `S20` **evalúa una**» →
  sigue correcta: el commit no agrega ni saca filas de esa clase, y no toca las condiciones. El
  orden de las escrituras no cambia cuántas filas escriben un conjunto.
- **L100-102 · §3.1** — «sin un estado de salida esa ventana **no vence nunca**» → sigue
  correcta: es sobre `ABANDONED` y el preapproval sin autorizar. Entró al grep por *«no vence»*,
  que acá tiene **otro sujeto** que el del grant.
- **L514-524 · §3.2** — «**anclarle una vertical nueva a un grant vivo es un acto propio**» →
  **sigue correcta, y el commit la vuelve evaluable**: hasta ahora *«vivo»* ahí era la palabra
  sola que la regla 2 de `NUCLEO/01` §2.4 prohíbe en un predicado; ahora tiene columna. El
  párrafo no afirma nada sobre cómo se sabe.
- **L528-531 · §3.2, la tabla del alcance por evento** — «**anclarle una vertical nueva** a un
  grant vivo \| toda fila viva **principal** … en esa vertical» → sigue correcta: el reparto del
  alcance por evento no cambia.
- **L571-577 · §3.2, el recuadro del desenlace inadmisible** — «el grant se revocaba y seguía
  encendido para siempre … la instancia **cuelga del ancla** y **tiene apagado declarado**» →
  **sigue correcta y es la premisa que el arreglo 2 protege**: el *«apagado declarado»* depende de
  que la columna del ancla esté escrita, y por eso se escribe primero.
- **L599-608 · §3.2** — «`S13` de las principales, `S20` de las de complemento que cumplen su
  condición» → sigue correcta: los conjuntos no cambian.
- **L610-616 · §3.2** — «`S13` y `S20` comparten el evento y NO comparten el par … los pares con
  dos filas de esta tabla siguen siendo los **tres**» → sigue correcta: el commit no agrega filas
  a esta tabla, así que el conteo de pares no se mueve. **Recontado**, no heredado: los tres son
  los que `NUCLEO/03` §1 regla 7 enumera y ninguno los toca.
- **L625-628 · §3.2, el recuadro de idempotencia de `S13`** — «**`S13` es idempotente y
  reanudable fila por fila** … volver a correrlo sobre una fila que ya cerró no escribe nada» →
  **sigue correcta sobre `S13`, que es de lo único que habla**. Es el párrafo del que `S20` había
  copiado la frase, y el arreglo consistió en **no copiarla**, no en corregirlo: sobre `S13` el
  argumento cierra porque su efecto por fila es uno.
- **L630-637 · §3.2** — «el detector va aparte y es la **tercera comprobación de cero llamadas**:
  *«un beneficiario con un ancla viva en la vertical V no debería tener una fila viva principal en
  V»*» → **sigue correcta, y desde este commit el término que cita tiene definición**. La cita es
  del predicado, que no cambió.
- **L639-646 · §3.2** — «`S20` corre en el mismo acto, con el mismo fan-out y el mismo modo de
  falla, así que la tercera comprobación lo cubre a él también» → **sigue correcta, y sólo lo es
  bajo el orden que el commit declaró**. Con el orden inverso la comprobación preguntaba por la
  mitad ya ejecutada; el párrafo que sigue ahora —el del orden— es el que sostiene esta frase.
- **L725-731 · §3.2, `S21`** — «el precedente es del mismo día: `S20` también lo dispara un acto
  de otra entidad» → sigue correcta: `S20` sigue disparándose desde el grant.
- **L733-741 · §3.2, `S21`** — «la tercera cláusula del evento de `A5`, *«se revoca el grant del
  que cuelga el ancla que era su título»*, que es la única que alcanza a los scopes `LISTING`,
  `USER` y `GLOBAL`» → sigue correcta: el enunciado de la cláusula no cambia.
- **L770-776 · §3.2, `S21`** — «el mismo criterio con el que `DEC-GRANT-001` lo dice para `S13` y
  `B/16` §3.4 para `S20`» → sigue correcta: el no-reembolso no se toca.
- **L778-783 · §3.2, `S21`** — «para el addon convertido a $0 la población de `S21` es vacía» →
  **sigue correcta como enunciado del caso normal, y el commit le agregó abajo el recuadro que
  nombra su excepción** (la corrida de `S20` cortada). El párrafo en sí no se editó y no hizo
  falta: dice *«el addon convertido»*, que es el que `S20` terminó de convertir.
- **L794-800 · §3.2** — «`S21` no agrega ningún par con dos filas, así que `G-R4` sigue contando
  **tres** … `S20` declara explícitamente que **la instancia no cambia de estado**» → sigue
  correcta: el orden no cambia el estado de la instancia, sólo cuándo se le escribe el ancla. En
  el acto de `S20` sigue sin haber ninguna instancia llegando a `CANCELLED`.
- **L897-900 · §4, `GRACE_PERIOD`** — «sale por `S5` o `S6` — y por `S17` o `S13`, si … le cae un
  grant» → sigue correcta: `S13` no cambia.
- **L1008-1014 · §7, `MP1`** — la celda del pago manual → sigue correcta: no nombra ni el grant ni
  el addon; entró por `S19`/`S13` de su prosa vecina.
- **L1053-1060 · §7.1** — «Al revocar un grant el trial **no vuelve** … y el addon que el grant
  había pasado a $0 **se apaga y no vuelve solo**» → sigue correcta: las dos mitades son
  `DEC-TRIAL-009` y `DEC-ADDON-003`, intactas.
- **L1497-1504 · §8, la tabla de la máquina de addon** — «`A5` \| **toda instancia con una
  autorización que puede cobrar**» → sigue correcta: el `desde` de `A5` no cambia.
- **L1538-1546 · §8** — «*«se revoca el grant»* no lo comparte ninguna otra fila de esta tabla …
  la tabla de la regla 7 del núcleo sigue teniendo **tres** entradas» → sigue correcta: el commit
  no agrega filas a la máquina de addon.
- **L1566-1573 · §8** — «el predicado de `B/16` §4.2 pregunta por el OBJETIVO … sólo el scope
  `VERTICAL_SUBSCRIPTION` volvía a *«huérfano»* al caerse el grant» → sigue correcta: la
  asimetría entre objetivo y título no cambia.
- **L1575-1584 · §8** — «**retirar un ancla no existe** … `NUCLEO/08` §3 declara exactamente
  **tres** escrituras» → **sigue correcta, y siguen siendo tres**: `revocado_en` es **lo que la
  tercera escribe**, no una cuarta. El párrafo habla de qué actos existen, no de qué columnas
  tocan.
- **L1586-1591 · §8** — «sin esta cláusula la revocación dejaría al addon convertido
  **funcionando gratis para siempre y sin suscripción**» → **sigue correcta, y el arreglo 2 cierra
  el segundo camino hacia ese mismo desenlace**: la cláusula existe, y ahora además siempre tiene
  sujeto.
- **L1623-1629 · §8, el recuadro de la columna** — «la otra sigue entera y alcanza sola: sin el
  ancla no se sabe **en qué vertical** ese addon es gratis» → sigue correcta: la columna sigue
  apuntando al ancla y por la misma razón. Lo que el commit agrega es que esa fila **sobrevive a
  la revocación**, que refuerza el argumento en vez de moverlo.
- **L1631-1633 · §8** — «Cubre los dos orígenes del addon gratuito con una sola regla» → sigue
  correcta: los dos orígenes siguen siendo dos y la regla una.

### `B/16-addons.md` (18)

- **L154-155 · §3.2** — «evita el desenlace absurdo de que revocar un grant tenga que apagar
  quince cosas que el beneficiario nunca pidió» → sigue correcta: es sobre *«habilita; no
  enciende»*, que el commit no toca.
- **L164 · §3.3, título** — «Al revocar el grant, el addon se corta» → sigue correcta.
- **L177-180 · §3.3** — «revocar un grant es **la acción administrativa más grave**» → sigue
  correcta, y ahora esa acción deja marca, que es lo que `NUCLEO/08` §3 ya pedía auditar.
- **L182-190 · §3.3** — «**No pasa nada más: no se reanuda la suscripción de complemento vieja y
  no se compensa**» → sigue correcta: el commit no repara nada al revocar.
- **L192-201 · §3.3** — «Para los otros tres scopes **el objetivo nunca murió** … por eso el
  evento de `A5` tiene **una tercera cláusula**» → sigue correcta: la partición por scope no
  cambia.
- **L235-238 · §3.4** — «`S20` **evalúa una condición**, que es lo que el §41 pide» → sigue
  correcta: la condición es el flag y la compatibilidad, y ninguna se movió.
- **L245-249 · §3.4** — «compatible es lo que el §39 hace declarar al **producto**» → sigue
  correcta: *«compatible»* no se reinterpreta acá y el commit tampoco lo hace.
- **L256-284 · §3.4, el recuadro de la fuga `USER`/`GLOBAL`** — «**se apaga con el grant, sin
  mecanismo aparte**: al revocarlo, `A5` corta la instancia por su tercera cláusula» → **sigue
  correcta, y este commit es lo que la sostiene**: la cláusula necesita el ancla escrita (arreglo
  2) y legible después de revocar (arreglo 1). `DEC-ADDON-005` no se reabre.
- **L291-295 · §3.4, la tabla del período pagado** — «el período del complemento **ya cobrado**
  \| **no se reembolsa**» → sigue correcta: el orden de las escrituras no toca el dinero ya
  cobrado.
- **L297-298 · §3.4** — «el sujeto de `S20` son sólo los `PERIÓDICO`» → sigue correcta: un
  `UNA_VEZ` no tiene suscripción de complemento, así que **no tiene dos escrituras que ordenar**.
- **L309-316 · §3.4** — «La instancia registra **el ancla** … Es la columna que `B/16` §3.1 ya
  daba por existente y **no existía**» → **sigue correcta, y el commit agrega cuándo se escribe**,
  que era la mitad que faltaba: la columna existía en el modelo y nadie había dicho en qué orden
  `S20` la escribe.
- **L434-448 · §4.2, la tercera mitad** — «un grant **no es una sucesión**: sin esta tercera mitad
  la condición se cumple entera en el mismo acto del otorgamiento» → sigue correcta: el
  razonamiento de por qué la mitad existe no cambia. Lo que el commit agregó, en el recuadro de
  abajo que sí tocó, es **contra qué columna se evalúa**.
- **L528-532 · §4.3, la tabla de los tres efectos** — «los que **releva un grant permanente** en
  esa vertical … **además a costo $0**, con su suscripción de complemento cancelada por `S20`» →
  sigue correcta: el efecto final de `S20` es el mismo, ordenado.
- **L548-591 · §4.3, el recuadro de los cuatro momentos** — «**se revoca el grant** \|
  `NUCLEO/08` §3, fila del grant permanente \| es el único acto que apaga la **tercera mitad** del
  §4.2» → **sigue correcta, y recién ahora ese momento tiene cómo evaluarse**: era *«una promesa
  sin momento»* por el lado del acto y también por el lado del dato. Siguen siendo **cuatro**
  momentos: el commit no agrega ninguno.
- **L607-619 · §4.3** — «hay terminales de suscripción que también dependen de una llamada
  nuestra —`S12`, `S3`, `S13`, **`S20`**, **`S21`** y la lápida» → sigue correcta: `S20` sigue
  llegando a terminal por una llamada nuestra, y el orden no cambia **quién** canceló.
- **L621-626 · §4.3** — «`S21` entra por la **salvedad 1** … Es el reverso de `S20`, que entra
  por la 4 **y no por la 1** precisamente porque allá la instancia sobrevive» → sigue correcta: la
  instancia de `S20` sigue sobreviviendo, y por eso su fila terminal es sólo la suscripción.
- **L662-672 · §4.4** — «las **tres cláusulas del evento de `A5`** … la orfandad mira el
  **objetivo** y la revocación mira el **título**» → sigue correcta: las tres cláusulas siguen
  siendo tres.
- **L681-685 · §4.4** — «El período ya cobrado no se reembolsa» → sigue correcta.

### `B/09-conciliacion.md` (6)

- **L107-119 · §3, la tabla de las once puertas** — «`S20` → `CANCELLED` … **nuestra llamada**, y
  como `S13` no tiene rama de fallo declarada: el addon pasa a $0 pase lo que pase con la llamada»
  → **sigue correcta bajo el orden nuevo, y por la misma razón**: el §35.2 lo declara gratis desde
  el acto, y con el orden declarado el *«pasa a $0»* es **la primera** escritura, no la segunda.
  La fila no cambia de veredicto. **Once recontadas** sobre la tabla: `S16`, el espejo, `S17`,
  `S12`, `S3`, `S13`, `S20`, `S21`, `S22`, `S23` y la lápida.
- **L124-129 · §3, las cuatro salvedades** — «4 \| … **siete** de las **ocho** filas *«no»*» →
  sigue correcta: las ocho *«no»* son `S12`, `S3`, `S13`, `S20`, `S21`, `S22`, `S23` y la lápida,
  y `S21` sigue entrando por la 1. **Recontado**, no heredado.
- **L131-154 · §3, el recuadro de la 4** — «`S20` entra por la 4 y no por la 1 … en `S20` la
  instancia **no** es terminal: sigue `ACTIVE`, a costo $0» → sigue correcta: el orden no cambia
  el estado de la instancia.
- **L165-176 · §3, la salvedad de la instancia terminal** — «`A5` —la que lo declara huérfano, o
  la que revoca el grant del que colgaba su ancla-título—» → sigue correcta: las cláusulas de
  `A5` no cambian.
- **L178-212 · §3, el recuadro de las dos filas de la salvedad 1** — «`S20` es el otro caso y
  sigue siendo otro. Ahí la causa es el grant, la instancia **sobrevive**» → sigue correcta.
- **L279-282 · §3, la tabla de la tercera comprobación** — «una **fila viva de complemento** suya
  cuyo addon es **compatible con V** \| `S20` \| **paga todos los meses un addon que el flag le
  declaró gratis**» → **sigue correcta, y el orden nuevo es lo que la vuelve alcanzable**: con la
  cancelación primero, esta fila tenía población vacía sobre la corrida cortada. El predicado no
  cambió; cambió que ahora encuentra a alguien.

### `B/02-modelo-de-datos.md` (4)

- **L338-344 · §2.4** — «la instancia gana una TERCERA referencia … se escribe **una sola vez
  para sus dos orígenes**» → sigue correcta: sigue siendo una columna con dos orígenes; el commit
  le agregó **cuándo** se escribe en el segundo.
- **L396-466 · §2.4, los bullets de las concesiones** — «`B/14` §4.3 confirma que sobre un grant
  no se otorga porque *«no queda nada que no cobrar»*» → **sigue correcta como razón**, y la
  condición que la ejecuta quedó calificada en `B/14` §4.3 (*«un ancla viva en esa vertical»*):
  lo que cambia es el predicado, no el motivo que se cita acá.
- **L555-570 · §2.6, el recuadro del grant** — «`S20` **cancela** la suscripción de complemento …
  y **la instancia pasa a colgar del ancla**» → **sigue correcta, y su orden de enumeración no es
  normativo**: este § inventaria qué le pasa a cada cosa que cuelga, no en qué orden se escribe.
  El orden normativo vive en `B/03` §3.2, que es donde la fila lo declara.
- **L589-595 · §5, la tabla de restricciones** — «10 · una acción en una vertical no afecta a otra
  \| **`UNIQUE(permanent_grant_id, vertical)`**» → sigue correcta: la clave del ancla no cambia, y
  `revocado_en` está en la otra tabla.

### `12-contrato-de-cobertura.md` (3)

- **L458 · §2.8, título** — «N anclas no son N grants, y la diferencia se paga al revocar» →
  **sigue correcta, y ahora se paga una sola escritura**: revocar sigue siendo un acto sobre un
  instrumento, que es exactamente lo que el título afirma.
- **L487-505 · §2.8, las dos mitades del anclaje** — «Dispara `S13` sobre la vertical que se
  ancla … **Lo que sí les pasa, si el grant lleva `includesAddons: true`, es que los compatibles
  se convierten a costo $0**» → sigue correcta: el efecto es el mismo; el commit ordena sus dos
  escrituras y no cambia cuáles son.
- **L507-511 · §2.8** — «**Desanclar no está declarado, y esto no lo declara** … y no como un
  efecto lateral de **borrar una fila**» → **sigue correcta, y es la premisa que el commit usa dos
  veces**: es la razón escrita por la que revocar marca en vez de borrar las anclas.

### `NUCLEO` (7)

- **`01-glosario.md` L224-236 · §2.2** — «sin un estado de salida esa ventana **no vence nunca**»
  → sigue correcta: es sobre `ABANDONED`, otro sujeto que el del grant. Entró por *«no vence»*.
- **`03-maquinas-de-estado.md` L86-120 · §1 regla 7** — «los **siete** casos vivos que comparten
  `desde` … `A5` … sus eventos son **los tres** que declara desde `DEC-ADDON-003` … **Que el
  tercero y el segundo se cumplan a la vez —lo que pasa al revocar…— no es lo que esta regla
  prohíbe**» → sigue correcta: el commit **no agrega filas ni eventos** a ninguna tabla. **Los
  siete recontados**: `T7`, los dos pares de `S18`, los tres de `A5` y `PB7`/`PB8`.
- **`04-invariantes.md` L53-68 · §2.2** — invariantes 3 a 10, con el 10 apoyado en el ancla →
  siguen correctas: ninguna se enuncia sobre el estado del grant.
- **`04-invariantes.md` L102-108 · §2.5** — «27 · *Free Forever* no activa addons
  automáticamente … lo único automático ahí es **el fin de un cobro**» → sigue correcta, y el
  orden nuevo **la refuerza**: lo primero que `S20` escribe no enciende nada, sólo cambia de qué
  título cuelga una capacidad ya encendida.
- **`08-auditoria-y-observabilidad.md` L134-147 · §3, la tabla de las doce acciones** — «otorgar,
  **anclarle una vertical nueva**, o revocar un **grant permanente**» → **sigue correcta y siguen
  siendo doce**: `revocado_en` es la escritura **de esa fila**, no una acción nueva. La tabla
  reparte permisos y confirmaciones, no columnas.
- **`08-auditoria-y-observabilidad.md` L192-197 y L199-204 · §3.1** — «los cobros que dejan de
  ocurrir son más de uno … la frase tiene que **enumerarlos**» y «esos addons se apagan y **NO
  vuelven solos**» → siguen correctas: la confirmación dice lo mismo, y el orden de las
  escrituras no cambia cuántos preapprovals se cancelan ni qué correos manda el proveedor.

### `B/12`, `B/19`, `B/21` y `descomposicion.md` de billing (6)

- **`12-suscripcion.md` L394-399 · §5.2** — «Nada limpia `sucede_a` cuando la sucesora se muere
  —`S3` a las 72 h, o `S13`—» → sigue correcta: `S13` no cambió.
- **`19-superficies.md` L79-97 · §4, la tabla de lo que hay que decir** — las filas 3, 5 y 5-bis y
  la 13 (*«qué addons corta»*) → siguen correctas: el commit no cambia qué se le dice a nadie. La
  13 ya está cubierta por `NUCLEO/08` §3.1, que tampoco cambió de contenido.
- **`21-migracion.md` L129-133 · §2.4** — «Las dos cortesías se escriben como `permanent_grant`»
  → sigue correcta: nacen con `revocado_en` nulo.
- **`21-migracion.md` L142-149 · §2.4** — «escribir **dos grants** de una vertical cada uno … es
  el otro extremo, porque revocar pasaría a ser dos actos en vez de uno. Lo que se multiplica es
  la fila de `permanent_grant_vertical`, **nunca la concesión**» → **sigue correcta, y es la forma
  del modelo que hace que la columna nueva viva donde vive**: `revocado_en` está en la concesión
  justamente porque revocar es **un** acto.
- **`descomposicion.md` L106-120 · §2** — «**B9** … **`S20` no es de acá** … **B10** … el que ya
  se venía pagando y `S20` convierte» → sigue correcta: el reparto de unidades no cambia. `B9`
  lista `02` §2.4 entre sus capítulos, así que la columna nueva ya cae dentro de su alcance
  declarado.
- **`descomposicion.md` L347-361 · §3** — las condiciones de listo de `B1`–`B12` → siguen
  correctas: ninguna se enuncia sobre el estado del grant ni sobre el orden de `S20`.

### Épica de verticales — `V/02`, `V/03`, `V/11`, `V/15`, `V/17`, `V/18`, `V/21` y `spec.md` (14)

Todas entraron por la palabra *«revoca»* o por *«no vence»*, y ninguna se condiciona sobre el
estado del grant: la regla 1 de `NUCLEO/01` §2.4 lo impide —verticales sólo recibe `cubierto` y
`fuentes`—, así que **ninguna puede leer la columna nueva ni la necesita**.

- **`02-modelo-de-datos.md` L276-277 y L287-289 · §3** — «un entitlement que sigue vivo después de
  revocado es acceso indebido» y «un TTL como defensa principal deja una ventana en la que un
  permiso revocado sigue funcionando» → **siguen correctas, y son el argumento que hacía falta
  para que la revocación tuviera dato**: sin columna, esa ventana no se cerraba nunca del lado de
  billing. Lo dicen sobre el caché, que se invalida por evento.
- **`02-modelo-de-datos.md` L293-304 · §3.2, la tabla de invalidación** — «se otorga o se revoca
  una cortesía o un grant, **o se le ancla una vertical nueva a un grant vivo**» → sigue correcta,
  y es el consumidor 9 del inventario nuevo: llega como **evento**, no como predicado, que es lo
  que la regla 1 exige.
- **`03-maquinas-de-estado.md` L484-488 · §11** — «Una `PENDIENTE` que nadie resuelve **no
  vence**» → sigue correcta: es la postulación de Partner, otro sujeto.
- **`11-trial.md` L105 y L110-113 · §2.4** — «revocar un grant NO entra acá … **revocarlo no lo
  devuelve**» → siguen correctas: `DEC-TRIAL-009` intacta.
- **`15-entitlements-y-limits.md` L101-105 · §2.5** — «Un `permanent_grant` se ancla a **un plan
  por cada vertical** … su piso es lo que ese plan otorgaba el día que se firmó» → sigue correcta:
  el trinquete vive en el ancla y la columna nueva está en el instrumento.
- **`15-entitlements-y-limits.md` L223-227 · §4.1** — «hace falta idéntico cuando … se revoca un
  grant (§35)» → sigue correcta: el reconciliador de excedentes se dispara igual.
- **`17-autorizacion.md` L340-341 · §4.3** — «Si el rol no se revoca nunca, una autorización que
  decidiera sólo por rol dejaría operar a un suspendido» → sigue correcta: habla de **roles**, no
  de concesiones.
- **`18-partner.md` L121 y L162-164 · §2.3 y §2.4** — «Una postulación pendiente **no vence**» →
  siguen correctas: otro sujeto de *«no vence»*.
- **`21-migracion.md` L93-106 y L108-113 · §2.4** — «un `GRANT` con `hasta: NO_VENCE` es de clase
  **`TÍTULO`** … si ese grant se revocara alguna vez, quedarían sin grant y sin el trial que nunca
  usaron» → **siguen correctas, y la segunda describe un escenario que ahora tiene cómo
  observarse**: el grant revocado deja de emitir y la fila queda con su marca. El defecto de trial
  que nombra sigue abierto y no lo toca este commit.
- **`spec.md` L51-63 · §2, el índice de capítulos** → sigue correcta: es una tabla de contenidos.

### Documentos de medición (8)

Los cinco de `05-phase-1a`, los dos de `08-phase-1b` y el `02-worklog` son **registro histórico
de lo que se midió o se hizo**, y no se editan: describen el estado del sistema viejo o el de una
fase pasada.

- **`05-phase-1a-domain-analysis.md` L155-156, L915-916, L918-920** — sobre roles y caché → siguen
  correctas: otro sujeto.
- **`05-phase-1a-domain-analysis.md` L664-666** — «se revoca un grant (§35)» en la lista de lo que
  necesita el reconciliador → sigue correcta.
- **`05-phase-1a-domain-analysis.md` L790-792** — «**¿qué pasa con un addon activo a $0 cuando se
  revoca el grant** — se corta, se empieza a cobrar, o se deja correr?» → **sigue correcta como
  pregunta de fase 1A, y es la que `B/16` §3.3 contestó**; se deja como registro de que la
  pregunta existió.
- **`08-phase-1b-code-discovery.md` L3361-3365** — «una `trialing` con `trial_end` nulo no vence
  nunca» → sigue correcta: es el sistema viejo.
- **`08-phase-1b-code-discovery.md` L5379-5381** — «un addon que el catálogo ya no conoce **se da
  por revocado sin haberlo revocado**» → sigue correcta: es el sistema viejo, y el diseño nuevo no
  deriva la revocación de nada.
- **`02-worklog.md` L991-1001** — «eso obligó a que `courtesy_grant` y `permanent_grant` ganaran
  su columna» → **sigue correcta y se refiere a OTRA columna** (la referencia resoluble que el
  contrato exige, `DEC-GRANT-005`/`DEC-GRANT-006`), no a `revocado_en`. Se deja sin tocar porque
  el worklog registra lo que pasó en su fecha.

### `04-open-decisions.md` (3)

- **L223-243 · la tabla de preguntas cerradas** — «20 \| `M-GRANT-01` \| Free Forever y el dinero
  ya cobrado; qué pasa al revocar \| ✅ `DEC-GRANT-001`» → sigue correcta: la pregunta sigue
  cerrada por la misma decisión.
- **L339-349 · Addons** — «el grant permanente vale como título, o `includesAddons: true` sería
  inalcanzable» → sigue correcta; el predicado que lo ejecuta quedó calificado en `B/16` §2.4 sin
  cambiar la conclusión.
- **L367-378 · Autorización** → sigue correcta: entró por *«revoca»* en su prosa de roles.

## 5. Premisas ajenas que el arreglo volvió falsas y se corrigieron en el mismo acto (13)

| dónde | qué decía | por qué dejó de ser cierta |
|---|---|---|
| `B/09` §3, recuadro de la 4ª comprobación | *«que el grant del ancla siga vivo es **un dato de nuestra base**»* | **era falsa cuando se escribió**: no había columna. Se deja la frase y se dice contra qué se lee, y que hasta hoy no se podía |
| `B/03` §8 | *«revocar … **retira todas las anclas** del instrumento a la vez»*, sin decir si como filas | borrar las filas deja sin sujeto a la 4ª comprobación; se precisa: como **título**, no como filas |
| `B/16` §3.3, recuadro | ídem, *«retira todas las anclas de una vez»* | ídem |
| `B/03` §3.2, celda de `S20` | *«**Proceso idempotente y reanudable fila por fila**»*, copiado de `S13` | `S13` supone **una** escritura por fila; `S20` tiene dos sobre dos entidades |
| `B/03` §3.2, celda de `S20` | enumeraba sus dos escrituras **sin orden** | el orden decide si una corrida cortada es recuperable |
| `B/16` §3.4, el recuadro de la conversión | *«se cancela su suscripción de complemento y la instancia pasa a colgar del ancla»* | enunciaba las dos escrituras en el orden que rompe |
| `B/03` §8 | *«en el addon convertido **normalmente no queda ninguno** vivo»* | el *«normalmente»* tenía un caso sin nombrar: la corrida de `S20` cortada |
| `B/03` §3.2, `S21` | *«para el addon convertido la población de `S21` es vacía»* | ídem, por el otro lado |
| `NUCLEO/01` §2.4, título y entrada | *««Vivo» nombra **dos** conjuntos»* | son **cuatro** desde que *«grant vivo»* y *«ancla viva»* tienen definición |
| `NUCLEO/01` §2.4, consumidor 17 | *«las dos mitades enumeran los seis»* | enumeraba los dos *«vivos»* que sabía nombrar y dejaba pasar el tercero de la misma frase |
| `NUCLEO/01` §1.5 | *«el grant … **no vence**»*, leído como que no deja de estar vivo | termina por revocación, y ahora la revocación se guarda |
| `12-contrato…` §2.6, fila `NO_VENCE` | *«no hay ventana **porque no hay fin**»* | no hay fin **por calendario**; un grant se apaga al revocarse |
| `B/14` §4.3 | *«sobre un grant no se otorga cortesía»*, sin adjetivo | con la revocación guardada, dejaba sin cortesía para siempre a quien alguna vez tuvo un grant |

**Y una cuenta congelada que quedó atrasada de la familia de la baja, corregida acá:**

- **`B/16` §4.4** decía *«la tabla de puertas a un estado terminal de `B/09` §3 **pasa a nueve
  filas** con `S21`»*, y desde `032f761e0` esa tabla tiene **once** (`S22` y `S23`). El
  `rastro-032f761e0.md` §4 corrigió la aparición de *«nueve puertas»* en `B/09` §3 y **no la de
  `B/16` §4.4**, que dice el mismo número desde otro capítulo. Recontada contra la tabla, no
  sumada: `S16`, el espejo, `S17`, `S12`, `S3`, `S13`, `S20`, `S21`, `S22`, `S23` y la lápida.

## 6. Justificaciones de los rastros anteriores que dejaron de ser ciertas

- **`rastro-032f761e0.md` §4** — su tabla de premisas corregidas incluye *«`B/09` §3 · «nueve
  puertas a un estado terminal» → once»*. La corrección es correcta y sigue entera; lo que no
  cubrió es **la segunda aparición del mismo número**, en `B/16` §4.4, que quedó viva hasta este
  commit. No es una justificación falsa: es una **incompleta**, y es exactamente el modo que
  `DEC-METH-010` obligación 1 nombra —*«un archivo abierto no es un párrafo leído»*— aplicado a un
  archivo que ese commit **sí** tocó.
- **`rastro-5836ec219.md`** — ninguna de sus justificaciones dejó de ser cierta. Sus términos son
  el reloj de inactividad, `inactiva_desde` y el piso de tres capacidades, y este commit no toca
  ninguno: la revocación de un grant **no reinicia** el reloj de inactividad (los cuatro hechos de
  reinicio de `DEC-DATA-002` no la incluyen) y tampoco lo arranca — lo que la revocación mueve es
  `cubierto`, que **sí** es uno de los cuatro, y eso ya estaba escrito antes de este commit.
- **`rastro-8f9f31ac0.md`** — ninguna. Sus términos son *«la fecha del próximo cobro»* y el tope
  de `MP4`, y una suscripción que `S13` o `S20` mandan a `CANCELLED` deja de tener próximo cobro,
  que es el sentido contrario a volverse falsa.

## 7. Preguntas para el owner

1. **¿La revocación de un grant guarda MOTIVO, además de fecha y firmante?** El commit agregó
   `revocado_en` y quién la firmó, que es lo que los predicados necesitan. El **motivo** no lo
   necesita ningún predicado, pero `permanent_grant` ya guarda el motivo del otorgamiento y
   *«la acción administrativa más grave»* (`NUCLEO/08` §3) es la que más se va a querer explicar
   después. No se agregó porque nada del diseño lo pide y agregar columnas que nadie lee es lo
   que este programa viene evitando.
2. **Un grant revocado y vuelto a otorgar son DOS filas, y eso no está escrito en ninguna parte.**
   Con la revocación guardada, la fila vieja queda para siempre; otorgar de nuevo crea otra. No
   hay ninguna clave que lo impida ni ninguna que lo exija, y el efecto práctico es que un
   beneficiario puede acumular N `permanent_grant` de los cuales a lo sumo uno está vivo. Los tres
   predicados nuevos funcionan igual —preguntan por *«un ancla viva»*, no por *«la fila»*—, pero
   si el owner quiere que eso sea imposible (un `UNIQUE` parcial sobre beneficiario × vivo) es una
   decisión de modelo que no se toma acá.
3. **El orden de `S20` se declaró; el de `S13` no hizo falta, y conviene saber si eso se revisa.**
   `S13` tiene **una** escritura por fila más su llamada al proveedor, y por eso su frase de
   idempotencia cierra. Si alguna vez `S13` gana un segundo efecto por fila, esa frase vuelve a
   ser la de `S20` antes del arreglo — y nada lo va a señalar, porque el texto que la sostiene no
   nombra el número de escrituras. Un guard que exija que toda fila con `desde` de conjunto
   declare cuántas escrituras tiene, y en qué orden, es la defensa obvia y no se escribió acá.

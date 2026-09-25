---
title: "FASE 8-bis-2 · A1 — acceso cruzado y autorización"
linear: HOS-1352
statusSource: linear
created: 2026-09-20
updated: 2026-09-20
status: CURRENT
fase: 8
---

# FASE 8-bis-2 · A1 — acceso cruzado y autorización

Tercera pasada adversarial sobre `HOS-1353`, con el mismo vector de siempre —**que una cuenta
llegue a algo que no le corresponde**: otra vertical, otro plan, otra ficha, otro sujeto— y sobre
el texto que la 9-bis produjo.

**Quince hallazgos. Tres `CRITICA`, seis `ALTA`, seis `MEDIA`.**

Los paths se abrevian como en las pasadas anteriores: `NUCLEO` es `HOS-1352-…/docs/nucleo/`, `V` es
`HOS-1353-verticales-capacidades-y-autorizacion/docs/`, `B` es
`HOS-1354-billing-cobro-y-proveedor/docs/`, y lo que no lleva prefijo es `HOS-1352-…/docs/`.

## La tesis, y es sobre la regla nueva antes que sobre el diseño

`DEC-METH-008` agrega dos obligaciones. **Las tres `CRITICA` de esta pasada son una de cada tipo de
incumplimiento posible, y la tercera es de un tipo que la regla no cubre:**

| | qué pasó | cuál |
|---|---|---|
| **obligación 1 no cumplida** — el dominio que el arreglo CREA | `T6` agregó una segunda transición con **el mismo origen y el mismo evento** que `T1`, y nadie le puso a `T1` la condición negativa. El dominio pasó de un par `(origen, evento)` a dos transiciones compitiendo por él | `F-8cA1-001` |
| **obligación 2 no cumplida** — la premisa de otro arreglo | `V/21` §2.4 razona *«`PB2` se dispara por el cambio de `cubierto`, así que se despublican»*. Esa premisa es del arreglo 9, **y en el sistema nuevo `cubierto` nunca fue verdadero**: no hay cambio | `F-8cA1-003` |
| **ninguna de las dos** — el arreglo no llegó a la tabla | el grant ancla **N planes** en el contrato y **uno** en `B/02`. La regla se escribió tres veces con tres formas distintas y la única que la base puede hacer cumplir es la vieja | `F-8cA1-002` |

**Y la proporción que la fase mide: 3 de 3 críticos los produjo la tanda de arreglos anterior.**
Ninguno es preexistente. Pero el modo cambió, y el dato útil está ahí: la vuelta pasada los 25
críticos eran **agujeros nuevos** que el arreglo abrió; esta vuelta **dos de tres son arreglos que
no llegaron entero al lugar donde se ejecutan**. `DEC-METH-008` le pregunta al que arregla qué
dominio creó y a qué premisa ajena le pegó; **no le pregunta si su arreglo está escrito en el
capítulo que lo tiene que ejecutar**, y ése es el generador dominante de esta tanda —
`F-8cA1-002`, `F-8cA1-007` y `F-8cA1-008` son el mismo defecto de aplicación sobre tres reglas
distintas.

---

## CRITICAS

### F-8cA1-001 — `T1` y `T6` comparten origen y evento, y la rama vieja deja al que paga el plan básico con las capacidades del premium, para siempre

**Qué se rompe.** Alguien contrata **antes** de publicar —lo normal en Alojamiento: se registra, ve
la pricing, paga, y después carga la ficha—. El día que publica, la tabla de `V/03` §2 habilita
**dos** transiciones a la vez. Si corre `T1`, queda en `TRIAL_ACTIVE` **sin salida alcanzable**, y
`TRIAL_ACTIVE` es una **fuente viva de clase `TÍTULO`** que apunta al plan de trial, cuyos
entitlements **se derivan del plan vendible de `rank` más alto**. El pliegue del capítulo 15 suma
esa fuente a la de su suscripción: **paga el plan básico y opera con las capacidades del premium,
sin fecha de fin.**

**El camino.**

1. La persona contrata Alojamiento. `S1` → `S2`, la suscripción queda `ACTIVE` (`B/03` §3.2).
   Nunca publicó, así que su trial sigue en `PRE_TRIAL` — *«`T1` crea la fila, y por eso
   `PRE_TRIAL` no la tiene»* (`V/03` §2).
2. Publica. El evento es *«el evento de activación declarado por la vertical»* = *«publicar una
   ficha»* (`V/10` §1, fila 1).
3. La tabla de `V/03` §2 tiene **dos filas con ese mismo origen y ese mismo evento**:

   | # | desde | evento | hacia | condición |
   |---|---|---|---|---|
   | T1 | `PRE_TRIAL` | el evento de activación declarado por la vertical | `TRIAL_ACTIVE` | la vertical declara evento **y** su plan de trial tiene días de trial > 0 |
   | T6 | `PRE_TRIAL` | el evento de activación declarado por la vertical | `TRIAL_CONVERTED` | **ya hay una suscripción viva** para ese `user + vertical` |

   Alojamiento declara evento y tiene días > 0, así que **la condición de `T1` se cumple**. La de
   `T6` también. **Las dos condiciones son verdaderas al mismo tiempo y ninguna excluye a la otra.**
4. Si corre `T1` —y una implementación que recorra la tabla en orden corre `T1`—, el estado queda
   `TRIAL_ACTIVE`. El propio capítulo describe el resultado: *«lo dejaría en `TRIAL_ACTIVE` **sin
   salida alcanzable** — `T3` no puede vencerlo porque exige que no haya suscripción autorizada, y
   `T2` espera **un evento que ya ocurrió**»*.
5. Y acá el capítulo se detiene, pero el contrato no: en `TRIAL_ACTIVE` el trial **es fuente viva**,
   con `referencia` = *«la versión del **plan de trial**»* y `hasta` = *«la fecha de fin»*
   (`V/03` §2, tabla de estados). Con `tipo: TRIAL` y `hasta: fecha`, la tabla del contrato §2.4 la
   clasifica **`TÍTULO`**.
6. Paso 6: el pliegue agrega **todas** las fuentes vivas. La del plan de trial otorga lo del
   **premium** — *«sus limits y entitlements **no se guardan**: se derivan … del plan vendible de
   `rank` más alto y del más bajo»* (`V/02` §2.1)— y `DEC-ENT-001` es explícita en que el trial
   *«muestra todas las funciones del plan premium»*.
7. Paso 7: con `SUMA` los cupos se suman; con `MÁXIMO`/`MEJOR_DECLARADO` *«gana el cliente»*
   (`V/15` §2.4). En las dos familias el resultado es **al menos el premium**.
8. Pasa la fecha de fin del trial y **no cambia nada**: la fuente es viva porque el **estado** lo
   dice, y el estado no se puede mover. El `hasta` queda en el pasado y la fuente sigue contando.

**Dónde lo permite el diseño.**

`V/03` §2, la tabla, es el artefacto normativo — `V/17` §4.4 construye un guard *«sobre los efectos
declarados de las transiciones del capítulo 03, que están **enumerados uno por uno**»*. Sus dos
filas están citadas arriba textuales. **La condición de `T1` no menciona la suscripción**, y la
prosa del mismo § lo dice en presente condicional sin corregir la tabla:

> el día que publica, `T1` **dispararía** sobre alguien que ya tiene suscripción y lo dejaría en
> `TRIAL_ACTIVE` **sin salida alcanzable**

El mismo § además **retiró** a `T1` su única condición sobre filas previas, por redundante:

> La condición vieja —*«no hay trial previo para ese `user + vertical`»*— decía lo mismo que su
> estado de origen **y lo negaba** … Se cae por **redundante**, no por permisiva.

Correcto respecto de *«trial previo»*, y deja a `T1` sin ninguna condición que mire el estado
comercial de la persona — que es justo lo que `T6` vino a mirar.

**Severidad.** `CRITICA` — alguien paga de menos: opera con las capacidades del plan más caro
pagando el que contrató, y no hay transición que lo termine. El caso es el camino normal de quien
contrata antes de publicar, no un borde.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 8** (`T6`, defecto 8 de la 9-bis). Antes
del arreglo había **una** transición para ese par `(origen, evento)` y el defecto 8 era el trial
colgado; el arreglo agregó la segunda y **duplicó el dominio del par sin recorrerlo**. Es
literalmente la obligación 1 de `DEC-METH-008`: *«si un arreglo agrega un eje a … un estado, el
dominio se multiplica»*. Y lo que el arreglo agregó encima del defecto viejo es la **consecuencia
comercial**: el defecto 8 se reportó como *«un trial colgado que no vence nunca»*, y nadie miró que
un trial colgado es una fuente `TÍTULO` que el paso 6 suma.

---

### F-8cA1-002 — El grant ancla N planes en el contrato y UNO en la tabla: `permanent_grant` sigue teniendo scope plural y `plan_id` singular

**Qué se rompe.** Exactamente lo que `F-8bA1-002` reportaba y el arreglo 6 declaró cerrado: un
*Free Forever* de scope {Alojamiento, Gastronomía} emite dos fuentes que transportan **la misma**
referencia, y la segunda vertical resuelve sus capacidades leyendo `plan_version_entitlement` de un
plan de la primera. El arreglo se escribió en el contrato y en la migración de billing; **no se
escribió en la única tabla que puede impedirlo**, que sigue declarando un `plan` por grant.

**El camino.**

1. `SUPER_ADMIN` firma un grant con *«scope de verticales»* = {Alojamiento, Gastronomía}.
2. La fila se escribe con la forma que declara `B/02` §2.4:

   > | **`permanent_grant`** | beneficiario, **scope de verticales**, `includesAddons`, quién lo
   > firmó, motivo, suscripciones afectadas (§35.4), **el `plan` que otorga** y **el piso del
   > trinquete** | ídem; el plan **no es anulable** |

   Un `scope` plural y **un** `plan`. La fila con dos verticales y un plan **se puede escribir**, y
   nada en la restricción declarada dice que el plan pertenezca a alguna de las dos, menos aún a
   las dos.
3. El bullet de abajo confirma la cardinalidad en singular, y razona sobre ella:

   > **`permanent_grant.plan_id`, y NO una versión.** El grant resuelve **la versión vigente de ese
   > plan, vendible o no**

4. `cobertura(user, GASTRONOMÍA)` devuelve la fuente `GRANT` con esa referencia — el plan de
   Alojamiento.
5. Paso 6 sobre Gastronomía: resuelve contra las dos tablas de una versión de plan de Alojamiento.
   Paso 7: `plan_version_limit` de Alojamiento acota las fichas de Gastronomía.
6. Y el trinquete: `piso_del_trinquete` es **una** columna. Con dos verticales hacen falta dos.

**Dónde lo permite el diseño.** Hay **tres** enunciados vivos del mismo arreglo, y no coinciden:

| dónde | qué dice |
|---|---|
| `12-contrato-de-cobertura.md` §2.8 | *«un grant de scope N verticales **ancla N planes**, uno de cada una»* — **un grant, N planes** |
| `B/21` §2.4 | *«Con una precisión que no es de forma: **una fila por cada vertical de su scope**»* — **N filas, un plan cada una** |
| `B/02` §2.4 | una fila con **`scope de verticales`** plural y **`el plan que otorga`** singular — **un grant, un plan, N verticales** |

Las tres no pueden ser verdaderas juntas. `B/21` y `B/02` se contradicen dentro de la **misma
épica**: si son N filas, el `scope de verticales` de cada una es un singleton y la columna sobra; si
es una fila, el `plan_id` singular es exactamente el defecto. Y `V/15` §2.5 —el capítulo que calcula
el trinquete— sigue en singular y citando la tabla:

> Un `permanent_grant` se ancla a un **plan** y resuelve su **versión vigente** (`B/02` §2.4)

Del otro lado, `V/15` §3.2 sigue declarando que esto no puede pasar: *«Una clave de vertical no se
puede leer desde otra vertical porque su resolución pide la vertical … No hay un control que alguien
pueda olvidar»*. La resolución pidió Gastronomía; le entregaron Alojamiento adentro de la fuente.

**Severidad.** `CRITICA` — acceso a capacidades y cupos de una vertical no concedida, sobre el
instrumento más caro del sistema, por la misma grieta que la vuelta pasada ya se había medido como
crítica. Que el contrato diga lo correcto no lo cierra: **la base es lo que impide escribir la fila
mala**, y la base la declara `B/02`.

**¿Es nuevo, o es el arreglo?** **Es el arreglo 6, aplicado a la mitad.** `F-8bA1-002` **sigue
llegando** por el paso 2 de su camino original. Y hay un agravante propio del arreglo: antes el
defecto era *«nadie lo pensó»*; ahora es *«tres documentos lo pensaron y escribieron tres formas
distintas»*, que es peor porque el que implemente `B/02` va a leer una regla que suena deliberada
—tiene su bullet, su razón y su `no es anulable`— y no va a ir a buscar el contrato.

---

### F-8cA1-003 — La mañana del corte no se despublica nada: `PB2` se dispara por el CAMBIO de `cubierto` y en el sistema nuevo `cubierto` nunca fue verdadero

**Qué se rompe.** El corte elige, de las dos ramas que el defecto 22 puso sobre la mesa, la de
*«se despublican»*. **El mecanismo produce la otra.** `PB2` no tiene con qué dispararse el día uno,
así que las fichas de la cartera existente **quedan publicadas, sin cobertura y sin cota**: quien no
atienda la llamada usa la plataforma gratis indefinidamente, y nada en el diseño lo detecta.

**El camino.**

1. Se despliega. `V/21` §2.1: *«**El sistema nuevo no hereda una sola fila.** Las ocho
   suscripciones vivas se cancelan»*. Del lado de verticales *«no se escribe ninguna fila»*
   (§2.4).
2. Sin fila de `trial`, toda la población amanece en `PRE_TRIAL` (`V/21` §2.4, y `V/03` §2:
   *«`T1` crea la fila, y por eso `PRE_TRIAL` no la tiene»*). Sus fichas están `PUBLISHED`: el
   esquema de publicación no se reescribe.
3. `cobertura(user, ALOJAMIENTO)` devuelve `cubierto: no` — la fuente de `PRE_TRIAL` tiene
   `hasta = SIN_EMPEZAR` y por §2.4 es de clase `BASE`. Correcto, y es lo que `V/21` §2.4 usa.
4. **Y acá se rompe.** `PB2` no se dispara porque `cubierto` **sea** falso: se dispara porque
   **pasa** a falso. `V/03` §9, la tabla:

   > | PB2 | `PUBLISHED` | **`cubierto` pasa a falso** | `UNPUBLISHED_BY_BILLING` |

   y la prosa que lo fija como decisión: *«**`PB2` y `PB3` se disparan por el CAMBIO de `cubierto`,
   no por una lista de transiciones**»*.
5. En el sistema nuevo **nunca hubo un valor anterior**. No hay transición de la que salga el
   cambio, no hay fuente que se apague —no había ninguna—, y el único empujón declarado es el aviso
   del contrato §3, que *«lleva qué fuente cambió y en qué dirección»*: no hay fuente que haya
   cambiado. Billing tampoco lo emite: las ocho se cancelaron **en el sistema viejo** (`16-fase-7`
   §4.2, paso 1), y la única fila que el nuevo escribe es la lápida, que nace `CANCELLED` y por
   §2.6 **no emite fuente**.
6. El segundo mecanismo tampoco corre, y por la misma razón: el reconciliador de excedentes *«se
   dispara cuando el conjunto efectivo … **se recalcula**, y **actúa sólo si algo bajó**»* (`V/15`
   §4.2), y su lista de disparo es la de `V/02` §3.2, que **no tiene una entrada para «el sistema
   arranca»**. Nada bajó, porque nada existía.
7. Resultado: las fichas siguen arriba. Quien contrata no cambia nada —ya estaba publicada, y `PB3`
   sale sólo de `UNPUBLISHED_BY_BILLING`—; quien no contrata **tampoco**.

**Dónde lo permite el diseño.** Dos documentos afirman el desenlace contrario, y los dos se apoyan
en el mismo mecanismo:

`V/21` §2.4:

> `PRE_TRIAL` **no cubre** … y `PB2` se dispara **por el cambio de `cubierto`** (`V/03` §9), así
> que **las fichas publicadas de Alojamiento se despublican la mañana del corte**. **No es una
> ambigüedad entre dos ramas: es una consecuencia.**

`16-fase-7-del-paraguas.md` §4.2:

> Las fichas publicadas de Alojamiento **se despublican la mañana del corte** —es una consecuencia,
> no una falla (`V/21` §2.4)— y vuelven solas cuando cada dueño contrata.

Y el §2.4 declara como costo lo que en realidad es el beneficio invertido:

> **Qué se pierde, dicho sin adornos**: la ficha de cada uno está abajo **desde el corte hasta que
> esa persona contrata**.

Está **al revés**: la ficha está arriba desde el corte hasta que alguien lo note.

**Severidad.** `CRITICA` — servicio comercial completo, gratis y sin fecha, para toda la cartera
existente, por el mecanismo que dos documentos declaran que lo impide. Es la rama *«usan la
plataforma gratis para siempre»* que el defecto 22 enumeró y el owner **no** eligió.

**¿Es nuevo, o es el arreglo?** **Lo introdujeron dos arreglos juntos, y es la obligación 2 de
`DEC-METH-008` sin hacer.** El arreglo 9 cambió el disparador de `PB2`/`PB3` de *«una lista de
transiciones»* a *«el cambio de `cubierto`»* — correcto para su problema, y **diferencial**. El
arreglo 22 se escribió después, eligió la rama *«se despublican»* y **la fundó en el disparador
nuevo** sin preguntarse si un disparador diferencial tiene de dónde disparar en `t = 0`. Con el
disparador viejo —una lista de transiciones— el desenlace habría sido el mismo, así que el arreglo
9 no lo causó solo: lo causó el 22 apoyándose en él. El arreglo 23 lo copió una tercera vez.

---

## ALTAS

### F-8cA1-004 — La exención de las lecturas se dio en el paso que ya no rechaza, y se les dejó el paso 6, que es el que rechaza: un suspendido no puede leer su *Mi Cuenta*

**Qué se rompe.** El arreglo 3 saca a las lecturas del **paso 5** y las manda por *«los otros
ocho»*, que incluyen el **paso 6**. Pero el paso 5 ya no rechazaba a nadie —lo dice el propio
capítulo— y el paso 6 heredó toda la defensa. O sea: **la exención se le dio al paso inofensivo y
se le negó al que decide.** La consecuencia concreta es que el paso 6 le niega la lectura a quien
sólo tiene el piso — `Turista Free`, `TRIAL_EXPIRED` y, sobre todo, el `SUSPENDED` al que el §21 le
promete *«Mi Cuenta read-only»*, *«billing accesible»* y *«recuperación posible»*.

**El camino.**

1. Una persona cae en `SUSPENDED`. Por el contrato §2.6 ese estado **no emite fuente**, así que sus
   `fuentes` en esa vertical son el título `BASE` y nada más.
2. Abre *Mi Cuenta*. Es una lectura: no muta nada.
3. Por `V/17` §3.5 punto 1: *«Toda operación la corre, escriba o no. No hay operación exenta»* y
   *«Una lectura que no muta nada **no pasa por el 5** — y **sí por los otros ocho**»*.
4. Paso 6: *«¿su conjunto efectivo otorga **esta capacidad**?»* (§1.2, fila 6). Su conjunto efectivo
   sale de la versión de piso, que otorga *«**ninguna capacidad comercial**, y la de contratar una
   suscripción»* (`V/02` §2.1). Leer *Mi Cuenta* no es contratar una suscripción.
5. Rama A: **se le niega la lectura**, y con ella las tres promesas del §21. `V/19` §1 no deja
   puerta de atrás: *«Todo lo que la UI esconde tiene que estar rechazado por la resolución»*, y lo
   que la resolución rechaza, la UI no lo muestra.
6. Rama B: se siembra en la versión de piso una clave por cada superficie de lectura. **La versión
   de piso pasa a ser la ACL de lectura de toda la plataforma**, sobre la tabla que `V/02` §2.1
   declara *«punto único de falla»* — *«si alguien le siembra una clave comercial … toda la
   plataforma la recibe gratis, para siempre»*— y que `G-R3` vigila con un predicado
   (*«ninguna clave de la clase comercial ni ningún entitlement medido»*) que no fue escrito para
   distinguir una clave de lectura de una comercial.

**Dónde lo permite el diseño.** `V/17` §3.5, punto 1, da razón para el paso 4 y **ninguna para el 6
ni el 7**:

> **Por qué una lectura no pasa por el paso 5, y sí por el 4**: el 5 pregunta si hay de dónde
> resolver capacidades **comerciales**, y leer no consume ninguna. El 4 pregunta **si el recurso es
> del sujeto** … Son preguntas distintas y sacarlas juntas fue el error.

Los pasos 6 y 7 entran por el conteo (*«los otros ocho»*) y por nada más. Contra la precisión 5 del
§1.2, que dice dónde está hoy la decisión:

> **La consecuencia hay que decirla en voz alta: el paso 5 ya no rechaza a nadie, y toda la defensa
> se apoya en el paso 6.**

Y contra el §21, citado por `V/17` §4.2: *«El §21 promete tres cosas que necesitan el rol vivo:
«Mi Cuenta read-only», «billing accesible» y «recuperación posible»»*. El rol sobrevive; la
capacidad no.

**Severidad.** `ALTA` — la rama A rompe tres promesas declaradas del §21 sobre el estado en que la
persona más necesita entrar, y es la que el diseño produce hoy. No es `CRITICA` porque falla
cerrado. La rama B sí regala, y es la salida barata.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 3.** Antes del arreglo la lectura no
corría ningún paso (ése era `F-8bA1-003`, cerrado bien). El arreglo la devolvió a la resolución y
eligió el paso a eximir **mirando la formulación vieja del paso 5** —la que preguntaba por
`cubierto`— en vez de la que dejó `D-04`, donde el 5 no rechaza. Es el espejo exacto de
`F-8bA1-001`: allá el fail-open se mudó un paso más adelante, acá se mudó el fail-closed.

---

### F-8cA1-005 — El admin del §48 lee ajeno, y sus pasos 6 y 7 se evalúan sobre el SUJETO: inspeccionar no está entre las doce acciones, así que no tiene ni permiso ni excepción

**Qué se rompe.** `M-AUTH-02` existe porque *«el §48 exige que el admin inspeccione usuarios,
suscripciones, pagos, cortesías y grants **ajenos**»*. Con el arreglo 3 esas inspecciones pasaron a
ser operaciones que recorren ocho pasos, y dos de esos ocho —el 6 y el 7— se evalúan **sobre el
sujeto**. La excepción que los evalúa sobre el actor está declarada **sólo para las doce acciones
del `NUCLEO/08` §3**, y **las doce son escrituras**: ninguna es inspeccionar. Resultado: el admin
necesita que el cliente tenga la capacidad para poder mirarlo, y el permiso que la regla 1 le exige
no existe en ningún catálogo.

**El camino.**

1. El admin abre el panel del §48 sobre un cliente `SUSPENDED`. `actor ≠ sujeto`.
2. Paso 3 —permiso—: `V/17` §3.2 regla 1 dice *«**`actor ≠ sujeto` exige un permiso de esa acción
   concreta**, no una condición general de «es administrador». Las doce acciones del capítulo 08 §3
   llevan permiso propio, una por una»*. Medido sobre la tabla de `NUCLEO/08` §3: **doce filas, y
   las doce son actos de escritura** — otorgar/revocar cortesía, otorgar/revocar grant, registrar
   pago manual, confirmar que no se pagó, aprobar/rechazar postulación, configurar plan y método,
   levantar la marca, cancelar, pausar/reanudar, cambiar de plan, extender trial, reembolsar.
   **Inspeccionar no está.** El permiso *«de esa acción concreta»* no existe.
3. Paso 6 y paso 7 —si el 3 se resuelve de algún modo—: regla 3, *«**El admin no hereda los
   entitlements del sujeto.** Los pasos 5, 6 y 7 se evalúan **sobre el sujeto**»*, con la excepción
   acotada a las doce. Inspeccionar no es una de las doce, así que no hay excepción.
4. El conjunto efectivo del sujeto `SUSPENDED` es el del piso: ninguna capacidad comercial. **El
   admin no puede leer los datos del cliente que dejó de pagar** — que es el único cliente por el
   que alguien abre ese panel.
5. La salida barata es declarar *«el admin puede leer todo»*, que es **la condición general que la
   regla 1 prohíbe con esas palabras**, y el hueco original ya nombró su costo: *«cada punto de
   entrada lo resuelve a su manera, y es además un vector de abuso: **un admin comprometido
   operando sin rastro**»*. Sin entrada en el catálogo de las doce, tampoco hay tipo de auditoría
   declarado para esa lectura, y la regla 2 —*«toda operación con `actor ≠ sujeto` es auditable sin
   excepción»*— queda sin ejecutor.

**Dónde lo permite el diseño.** `V/17` §3.5 mete las lecturas en la resolución:

> **¿corre la resolución?** **Toda operación la corre**, escriba o no. No hay operación exenta.

`V/17` §3.2, reglas 1 y 3, citadas arriba. `NUCLEO/08` §3, cuyo encabezado lo dice con todas las
letras: *«El §48 enumera veintiuna cosas que el admin debe poder **inspeccionar** y **ninguna que
pueda hacer**»* — y la tabla enumera lo que puede **hacer**, no lo que puede mirar. Y `V/19` §2, que
asigna a Admin *«todo lo anterior, de cualquier persona, **como actor distinto del sujeto** (cap. 17
§3)»*, remitiendo a un §3 que no lo resuelve para lecturas.

**Severidad.** `ALTA` — deja sin autorización declarada a la superficie entera del §48, en las dos
direcciones: la rama honesta no deja mirar a nadie en problemas, y la rama practicable es el
`es administrador` general con el que el hueco justificó su propia existencia. No es `CRITICA`
porque el acceso indebido depende de que se tome la segunda rama.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 3.** Antes, por `D-23`, una inspección no
era operación de dominio y no recorría nada — mal, y era la mitad admin de `F-8bA1-003`. El arreglo
la trajo adentro de la resolución **sin mirar que el §3.2 reparte 5, 6 y 7 sobre el sujeto y que su
única excepción es un catálogo cerrado de escrituras**. Es el dominio que el arreglo creó: el
conjunto *«operaciones que recorren los pasos»* se agrandó con toda la superficie de lectura, y las
reglas de reparto de `actor ≠ sujeto` se escribieron para el conjunto viejo.

---

### F-8cA1-006 — «Operación de dominio» perdió su definición, y la ÚNICA defensa estructural contra el cruce de verticales cuantifica sobre ella

**Qué se rompe.** El arreglo 3 partió el criterio en dos preguntas y, al hacerlo, **dejó de definir
qué es una operación de dominio**. El término sobrevive en tres reglas que sí deciden cosas, y la
más grave es `V/17` §2.2 — *«Ninguna **operación de dominio** se puede expresar sin su contexto de
vertical»*, que es la única defensa estructural contra el problema que da nombre al capítulo. Si una
lectura no es de dominio, **una lectura no está obligada a declarar su vertical**, y sin embargo
ahora corre el paso 6, que se resuelve por `user + vertical`.

**El camino.**

1. Antes del arreglo el criterio definía el término: *«una operación es de dominio … si escribe
   estado del negocio y es auditable»*. Una lectura **no** era de dominio.
2. El arreglo reemplaza esa frase por dos preguntas: *«¿corre la resolución?»* y *«¿pasa por el paso
   5?»*. Ninguna de las dos define *«operación de dominio»*. El término aparece una sola vez más en
   el §, en la primera línea —*«El conjunto de operaciones de dominio **nunca se enumeró**»*— y
   nunca se dice qué lo compone.
3. Quien implemente conserva la única respuesta que tuvo: una lectura no es de dominio.
4. Entonces `V/17` §2.2 no la alcanza. La lectura se puede expresar **sin vertical**.
5. El guard tampoco: `G2` falla si *«una **operación de dominio** no declara su contexto de
   vertical»* (`V/20` §2). Una lectura sin vertical **no está en el conjunto que el guard recorre**.
6. Y sin embargo la lectura corre el paso 6, que `V/02` §3.1 resuelve **por `user + vertical`**. Dos
   ramas: o el paso 6 no se puede invocar —y ninguna lectura se autoriza—, o la vertical se deduce
   del recurso, que es **lo que §2.2 prohíbe con esas palabras**: *«no un parámetro opcional ni un
   valor que se deduzca del recurso»*. La segunda rama es el §13 textual: *«un user con Gastronomía
   activa termina ejecutando una operación de Alojamientos»*, en su versión de lectura.
7. `G-R3-C` arrastra lo mismo: *«toda **operación de dominio** declara si pasa por el paso 5»*. La
   clase sobre la que el criterio nuevo decide —las lecturas— es exactamente la que queda fuera de
   su cuantificador.

**Dónde lo permite el diseño.** `V/17` §3.5 punto 1, entero, no define el término. `V/17` §2.2 y
§2.3 lo usan como sujeto. `V/20` §2 lo usa en `G2` y en `G-R3-C`. Y el `12-contrato…` §2 lo usa para
justificar su propia firma: *«Es la misma forma estructural que el capítulo 17 §2.2 le dio a **toda
operación de dominio**»*.

Contra la tesis con la que abre el capítulo, que es el criterio con el que hay que juzgarlo:

> **Una verificación cubre el lugar donde alguien se acordó de escribirla.** Por eso lo que se puede
> volver estructural se vuelve estructural … y encima va un guard que falla cuando alguien no lo
> hizo.

**Severidad.** `ALTA` — deja sin cuantificador a la única defensa que el capítulo declara
estructural, y a sus dos guards, justo sobre la clase de operaciones que el arreglo acaba de traer
adentro. No es `CRITICA` porque el paso 4 sigue bloqueando el recurso ajeno, así que el cruce
posible es entre verticales de la propia persona; y porque se corrige con una definición.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 3.** El término tenía definición —ancha, y
por eso `F-8bA1-003`— y el arreglo la retiró en vez de acotarla, sin releer a sus tres consumidores.
Es el caso puro de *«¿qué premisa de OTRO arreglo estoy volviendo falsa?»*: `G2` es de la FASE 2 y
`G-R3-C` es del propio `D-23`.

---

### F-8cA1-007 — El gate que descarta los complementos se escribió en el contrato y no en el capítulo que pliega: `V/15` sigue diciendo «suma todas las fuentes vivas»

**Qué se rompe.** El arreglo 2 cerró `F-8bA1-001` con una regla —*«el pliegue descarta las fuentes
de clase `COMPLEMENTO` cuando no hay ninguna de clase `TÍTULO` viva»*— y la escribió **en el
contrato de cobertura**. El pliegue lo ejecuta el capítulo 15, y el capítulo 15 **no la tiene**: su
tabla de estrategias sigue diciendo *«suma **todas** las fuentes vivas»*, sin condición. El contrato
sigue entregando el addon en `fuentes`, y el capítulo que lo pliega sigue sin saber que depende de
otra cosa — que es, textualmente, el diagnóstico que el propio arreglo escribió de sí mismo.

**El camino.**

1. Una persona con suscripción de Alojamiento y un addon cae en `SUSPENDED`.
2. `cobertura(user, ALOJAMIENTO)` devuelve `cubierto: no` y `fuentes` con dos entradas: la de clase
   `BASE` y la del addon. Correcto: §2.1 sigue definiendo `fuentes` como *«**todas** las fuentes
   vivas, **de las tres clases**»*.
3. Quien implementa el paso 6 abre `V/15` §2.2, que es donde viven las cuatro estrategias, y lee:

   > | **acumula** | `SUMA` | **suma todas las fuentes vivas** | fotos, fichas, destaques |

   Sin condición, sin nota, sin remisión al contrato.
4. Suma el addon. El suspendido conserva lo que su addon otorga — `F-8bA1-001` completo.
5. Nada lo detecta: medido sobre el catálogo de `V/20` §2, **ninguno de los diez guards** mira si el
   pliegue descartó los complementos.

**Dónde lo permite el diseño.** La regla existe **en un solo lugar de todo el programa** —medido con
`rg` sobre los tres árboles de docs: la única aparición normativa de la regla de descarte es
`12-contrato-de-cobertura.md` §2.4—, y ese mismo § declara por qué eso no alcanza:

> **No es una regla nueva: es la misma que este § ya enuncia, dicha donde se ejecuta en vez de sólo
> donde se define.** *«Agrega capacidades sobre un título»* era una frase en el contrato y **una
> frase no es un gate**: el capítulo 15 pliega lo que el contrato le da, y le estábamos dando el
> addon sin decirle que dependía de otra cosa.

*«Dicha donde se ejecuta»* es falso: se ejecuta en `V/15`, y quedó escrita en el contrato. Y el §2.7
—el § del contrato que **sí** define el pliegue, en dos tramos— tampoco la lleva.

**Severidad.** `ALTA` — es el mismo acceso a capacidades pagas por quien dejó de pagar que
`F-8bA1-001` reportó como `CRITICA`, con una regla normativa que lo prohíbe en un documento que
`DEC-ARCH-006` hace vinculante para las dos épicas. No es `CRITICA` por eso: la regla **existe** y es
obligatoria, y quien lea el contrato la cumple. El defecto es que el capítulo que la ejecuta dice lo
contrario y no hay guard que dirima.

**¿Es nuevo, o es el arreglo?** **Es el arreglo 2, aplicado a la mitad.** El defecto que cierra es
`F-8bA1-001`; lo que quedó abierto es su domicilio.

---

### F-8cA1-008 — La lista de invalidación pasó de siete entradas a once y `V/15` §4.2 sigue diciendo «sus siete entradas»: el reconciliador no se dispara por ninguna de las nuevas

**Qué se rompe.** *«Una lista, dos consumidores»* era el mecanismo: la lista de `V/02` §3.2 invalida
el caché **y** dispara el reconciliador de excedentes. El arreglo 4 le agregó cuatro entradas a la
lista y **no tocó al segundo consumidor**, que la cita por su cardinalidad. Con eso, las cuatro
fuentes que el arreglo 4 acaba de cubrir invalidan el caché y **no hacen correr al reconciliador**:
se recalcula con el valor nuevo y nadie despublica lo que sobra ni recorta el cupo que bajó.

**El camino.**

1. A la versión de piso de Alojamiento se le sembró por error una clave comercial con cupo. Es el
   escenario que `V/02` §2.1 declara punto único de falla.
2. Se detecta y se publica una versión nueva de la de piso, sin la clave.
3. Entrada 8 de la lista de `V/02` §3.2 —de las nuevas— invalida el caché de todos: *«se publica una
   versión nueva de la de PISO o de la de PRE-TRIAL»*. Bien; es el arreglo 4.
4. El reconciliador, en cambio, se especifica así (`V/15` §4.2):

   > no hace falta una lista nueva: **es la misma lista que invalida el caché** (cap. 02 §3.2), **con
   > sus siete entradas**. Una lista, dos consumidores.

   Medido por mí sobre `V/02` §3.2: **la tabla tiene diez filas**, y el propio § cuenta *«las cuatro
   últimas»* como nuevas porque la fila del piso nombra dos eventos — o sea **once entradas**. Quien
   implemente el reconciliador contra `V/15` cablea **siete**.
5. Las fichas que se publicaron gracias a la clave mal sembrada **siguen publicadas**, y los cupos
   siguen en el valor alto para todo el que ya los tenía calculados. Lo mismo vale para el grant al
   que se le publica una versión nueva de su plan que recorta, y para la versión nueva de un
   `addon_version`.
6. `G5` —*«ninguna fuente se apaga sin pasar por el reconciliador»*— **pasa**: acá no se apagó
   ninguna fuente, cambió lo que una fuente otorga. Es exactamente la clase de cambio que la regla
   nueva del arreglo 4 nombra: *«si una fuente puede cambiar **lo que otorga** sin que cambie
   **ninguna fila** del `user + vertical`, necesita su propia entrada»*.

**Dónde lo permite el diseño.** `V/02` §3.2, la tabla de diez filas y su nota *«Las cuatro últimas
son de la FASE 9 y ninguna entraba por las siete de arriba»*. `V/15` §4.2, citado arriba, sin tocar
(`updated: 2026-09-19`, pero el número sigue en siete). Y `V/02` §3 abre declarando la clase de
error: *«es de las pocas cosas donde **un error es de seguridad y no de rendimiento**»*.

**Severidad.** `ALTA` — un cupo revocado que sigue sin hacerse cumplir y fichas por encima del
límite que nadie baja, sobre las cuatro fuentes que el arreglo 4 acababa de declarar cubiertas. No
es `CRITICA` porque no abre un acceso nuevo: prolonga uno ya dado, y la lista correcta existe a un
documento de distancia.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 4.** Las siete eran siete y `V/15` estaba
bien. El arreglo agrandó la lista y **la cardinalidad escrita en el otro consumidor la volvió una
foto vieja** — el riesgo exacto de escribir un número en la prosa de quien no es dueño de la lista.

---

### F-8cA1-009 — Al espejo del §10.1 le falta la fila `authorized × ACTIVE`, y por su propia regla de default TODA suscripción sana es una divergencia real

**Qué se rompe.** El arreglo 18 enumeró los pares (estado leído en el proveedor × estado nuestro) y
cerró con *«**Lo que no figura acá es divergencia real**, y ahí la marca es la respuesta correcta»*.
Los dos pares más frecuentes del sistema —`authorized` con `ACTIVE`, y `paused` con `PAUSED`— **no
figuran**. Con la regla tal como está, cada relectura de una suscripción sana produce una
divergencia real: marca en la fila y el §22.1 entero — evento crítico, correo a `SUPER_ADMIN`,
alerta en Admin. En pocos días **la cartera entera está marcada**, y una marca que tienen todos no
señala nada.

**El camino.**

1. Llega un webhook de una suscripción sana. `B/03` §10.1: no se escribe lo que trae, se **relee el
   recurso por su id** y se escribe lo leído.
2. Se lee `authorized`. Lo nuestro es `ACTIVE`.
3. Se busca el par en la tabla. Medido por mí sobre las ocho filas: `authorized` aparece con
   `PENDING_AUTHORIZATION` (→ `S2`), con `PAUSED` (→ `S10`) y con `GRACE_PERIOD · SUSPENDED` (→
   divergencia). **Con `ACTIVE`, no aparece.**
4. Aplica el default: *«Lo que **no** figura acá es divergencia real, y ahí la marca es la respuesta
   correcta»*. Y `B/09` §3 lo ejecuta: *«se evalúa la transición contra la tabla del cap. 03. Si no
   existe, se pone la **marca**»*.
5. Que la tabla trae el caso «coinciden» cuando quiere declararlo está probado por ella misma: tiene
   **dos** filas *«nada: coinciden»* —`pending × PENDING_AUTHORIZATION` y
   `cancelled × CANCEL_SCHEDULED`—. La coincidencia necesita fila, y a las dos más comunes les falta.
6. Con el arreglo 19 encima, el ruido se apaga solo y el daño queda: *«Lo que se agrega es el AVISO,
   nunca la comparación … lo que no vuelve a emitir es una alerta por corrida sobre un caso ya
   abierto»*. Marcada la cartera, el canal queda callado, y la divergencia que sí importa —*«una
   suscripción a la que el proveedor le cobra un monto distinto del pactado»*, el caso que `B/09` §3
   usa para justificar seguir barriendo— llega como una fila más entre todas.

**Dónde lo permite el diseño.** `B/03` §10.1, la tabla de ocho filas y su regla de default, citadas
arriba. El conteo del dominio, medido por mí: el proveedor devuelve **cuatro** estados (lo dice el
propio §) y `B/03` §3.1 declara **nueve** estados nuestros, o sea **36 pares**. Las ocho filas, con
sus dos comodines (*«cualquier otro»* para `pending`, *«cualquier estado vivo que no sea
`CANCEL_SCHEDULED`»* para `cancelled`), cubren **20**. Quedan **16 sin declarar**, y entre ellos los
dos de arriba más `paused` contra cualquier estado que no sea `ACTIVE`.

La afirmación que no se sostiene es la del propio arreglo:

> El proveedor devuelve **cuatro** estados de preapproval; cruzados con lo que tengamos nosotros,
> **éstos son los pares** y su veredicto

**Severidad.** `ALTA` — apaga el único detector de una divergencia de monto, que es plata que sale de
la tarjeta de alguien todos los meses, y lo hace ahogándolo en vez de silenciándolo. No es `CRITICA`
por el criterio de esta fase: una fila marcada *«sigue cubriendo a quien estaba cubierto»* (`B/03`
§3.1), así que por sí mismo no da ni quita acceso.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 18**, y es su dominio sin recorrer: el
arreglo enumeró los pares que el problema viejo tocaba —los del desorden de webhooks, todos entre
estados en movimiento— y declaró cerrada una enumeración cuyo dominio real es 4 × 9. **Es la
pregunta que las instrucciones de esta pasada mandaban hacerle**: no son ocho de verdad, y el
proveedor no devuelve más estados — los que faltan son los nuestros.

**Fuera de mi vector en su mitad operativa**: cómo se comporta el barrido y qué escala la marca son
de `B2`/`B3`. Lo reporto porque el eje estaba encargado a esta pasada y porque el desenlace —un
detector que deja de detectar— cae del lado del acceso.

---

## MEDIAS

### F-8cA1-010 — La tabla de seis `tipo` × cuatro `hasta` dice «las tres combinaciones imposibles» y trae dos: trece de sus veinticuatro celdas son un guion mudo

**Qué se rompe.** El arreglo 1 cierra con una promesa de método: *«Las tres combinaciones imposibles
lo son **por una razón escrita, no por omisión**, y es lo que impide que la regla se vuelva a romper
por un extremo que nadie miró»*. Medido por mí sobre la tabla: **24 celdas; 9 traen clase; 2 traen
«imposible» con su razón; 13 son un `—` sin nada**. La promesa es falsa sobre trece de sus propias
celdas, y el número declarado —tres— no coincide con ninguno de los dos conteos.

**El camino.** Recuento celda por celda de la tabla de `12-contrato…` §2.4:

| fila | clases asignadas | «imposible» con razón | `—` mudo |
|---|---|---|---|
| `TRIAL` | 2 (`fecha`, `SIN_EMPEZAR`) | 1 (`NO_VENCE`) | 1 |
| `SUSCRIPCIÓN` | 2 (`fecha`, `SIN_FECHA_CONOCIDA`) | 1 (`SIN_EMPEZAR`) | 1 |
| `CORTESÍA` | 1 | 0 | 3 |
| `GRANT` | 1 | 0 | 3 |
| `BASE` | 1 | 0 | 3 |
| `ADDON` | 2 | 0 | 2 |
| **total** | **9** | **2** | **13** |

Tres de esos trece son imposibles por una razón que **sí existe y está en otro capítulo**, sin
citarse: `ADDON × NO_VENCE` lo cierra `B/16` §1.3 —*«**no hay vigencia `PERMANENTE`**»*— y las tres
de `BASE` las cierra el §2.5 —*«su `hasta` es `NO_VENCE`»*—. Los otros diez no tienen razón en
ningún lado, y el § que los deja mudos es el mismo que declara que la ausencia de razón escrita es
lo que rompió la regla la vez anterior.

**Dónde lo permite el diseño.** La tabla y su frase de cierre, en `12-contrato-de-cobertura.md`
§2.4. Y el criterio con el que hay que juzgarla es suyo: la mitad que faltaba —*«un reloj que no
arrancó no es un título»*— se había perdido **exactamente así**, por una combinación que nadie miró.

**Severidad.** `MEDIA` — no abre un acceso por sí sola; deja sin cerrar la mitad del dominio que el
arreglo declaró recorrido, y el número declarado es el tipo de conteo que después va al mensaje de un
guard. Ver `F-8cA1-011` para una de las celdas mudas que sí decide algo.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 1.** La tabla es suya, y su conteo también.

---

### F-8cA1-011 — La derivación de la clase no es excluyente: `ADDON` con `hasta = SIN_EMPEZAR` satisface `BASE` y `COMPLEMENTO`, y sólo una de las dos lo descarta

**Qué se rompe.** El arreglo 1 declara que la clase **no se transporta** porque *«el `tipo` y el
`hasta` ya la determinan»*. No la determinan: las tres filas de la tabla de clases son predicados
**que se solapan**, y no hay precedencia declarada. La celda donde se cruzan es la que decide si el
gate del arreglo 2 se aplica, porque el gate descarta `COMPLEMENTO` y **no** descarta `BASE`.

**El camino.**

1. La regla, tal cual:

   > | **`BASE`** | `tipo = BASE`, **o cualquier fuente con `hasta = SIN_EMPEZAR`** | **no** | … |
   > | **`COMPLEMENTO`** | `tipo = ADDON` | **no** | agrega capacidades sobre un título; nunca cobertura |

2. Una fuente con `tipo = ADDON` y `hasta = SIN_EMPEZAR` cumple las dos. La tabla de 6 × 4 la deja en
   `—` mudo, sin decir que sea imposible (`F-8cA1-010`).
3. Si se resuelve a `BASE`, el gate del arreglo 2 **no la toca**: descarta *«las fuentes de clase
   `COMPLEMENTO`»*, y ésta no lo es. El addon vuelve a otorgar sin ningún título — `F-8bA1-001`
   reabierto por la puerta que el arreglo 1 construyó.
4. Si se resuelve a `COMPLEMENTO`, se descarta. Las dos lecturas son defendibles y el texto no elige.

**Dónde lo permite el diseño.** La tabla de clases de `12-contrato…` §2.4 y su afirmación de
unicidad: *«La clase se deriva de dos campos que la fuente ya transporta … y no se transporta ella
misma: hacerlo sería la segunda fuente de un dato que esos dos ya determinan»*. Determinar exige que
los predicados particionen, y no lo hacen.

**Severidad.** `MEDIA` — para que dé acceso hace falta que exista un addon con el reloj sin arrancar,
y hoy `B/16` §1.2 sólo declara dos vigencias, las dos con reloj corriendo. La celda está vacía por
ahora; lo que está roto es la propiedad que hace segura la derivación, y la falla es en la dirección
cara (regala).

**¿Es nuevo, o es el arreglo?** **Lo introdujeron los arreglos 1 y 2 juntos**: el 1 escribió una
derivación no excluyente, el 2 montó un gate sobre una de las dos clases que se solapan. Por
separado ninguno decide nada; juntos, la celda ambigua decide si una capacidad paga sobrevive sin
título.

---

### F-8cA1-012 — `T6` quema el trial de por vida sobre «una suscripción viva», y en cuatro de los nueve estados la persona no está pagando

**Qué se rompe.** `T6` escribe la fila de `trial` **consumida** y la justifica así: *«no necesita
probar lo que ya está pagando»*. Su condición es *«ya hay una suscripción viva»*, y **«viva» no está
definido sobre un dominio de nueve estados**. En al menos cuatro de ellos la persona no está
pagando, y el trial es único de por vida: se lo quema alguien que nunca lo usó y no hay transición
de vuelta.

**El camino.**

1. La persona abre el checkout: `S1` → `PENDING_AUTHORIZATION`. Antes de autorizar, publica.
2. ¿Es *«una suscripción viva»*? El contrato §2.6 dice que ese estado **no emite fuente**; `B/03`
   §3.1 dice que la fila existe y no es terminal. Las dos lecturas son razonables y el diseño no
   elige.
3. Con la lectura «hay fila», `T6` dispara: la fila de `trial` nace **consumida** en
   `TRIAL_CONVERTED`.
4. La persona abandona el checkout. `S3` → `ABANDONED` a las 72 h. **No tiene suscripción y no tiene
   trial**, y no hay vuelta: *«No existe transición de vuelta a `PRE_TRIAL` ni a `TRIAL_ACTIVE`»*
   (`V/03` §2) y el `UNIQUE(user_id, vertical)` de `V/02` §2.2 es *«sin condición de estado … el
   trial es único **de por vida**»*.
5. El mismo camino vale, con la misma ambigüedad, para `SUSPENDED` (publica por primera vez estando
   en mora), `CANCEL_SCHEDULED` (publica tres días antes de irse) y `PAUSED por CUSTOMER_REQUEST`
   (*«el servicio está detenido»*, `B/16` §2.2). En los cuatro, la justificación de `T6` —*«ya está
   pagando»*— es falsa.
6. Y hay una asimetría más, en la otra dirección: `T1` exige *«la vertical declara evento **y** su
   plan de trial tiene días de trial > 0»*; **`T6` no repite la segunda mitad**. En una vertical que
   declare evento con los días en cero, quien tenga suscripción publica —su plan se lo permite— y
   `T6` le escribe la fila consumida de un trial que la vertical todavía no ofrece. El día que lo
   encienda, esa persona ya no lo tiene. `DEC-TRIAL-003` contempla exactamente ese día para Partner.

**Dónde lo permite el diseño.** `V/03` §2, fila `T6`, columna condición: *«**ya hay una suscripción
viva** para ese `user + vertical`»*. Contra `B/03` §3.1, que enumera los nueve estados y no define
«vivo»; el término más cercano lo fija `B/09` §3 por exclusión —*«Los estados terminales no se
barren: `CANCELLED`, `ABANDONED` y `CHARGE_DECLINED`»*—, lectura que deja `PENDING_AUTHORIZATION`,
`SUSPENDED`, `PAUSED` y `CANCEL_SCHEDULED` **adentro** de «vivo».

**Severidad.** `MEDIA` — se pierde un dato sin vuelta y la persona queda sin poder probar el
producto, pero el daño es acotado y auto-infligido en el sentido de que hace falta publicar en ese
momento exacto. No lo subo a `CRITICA` porque no hay acceso indebido ni cobro mal hecho; sí hay
pérdida irreversible, y por eso no baja de `MEDIA`.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 8.** `T6` no existía. Es la otra mitad del
dominio que `F-8cA1-001` recorre: aquél mira qué pasa cuando `T1` gana el par, éste mira qué pasa
cuando lo gana `T6` sobre un estado que no paga.

---

### F-8cA1-013 — El arreglo del grant citó a la cortesía como precedente, y `courtesy_grant` tiene la misma forma que el grant venía a corregir

**Qué se rompe.** `12-contrato…` §2.8 cierra el arreglo 6 apoyándose en un precedente: *«Es lo que
`R5-D` ya decía para las cortesías heredadas —«una fila por vertical de su scope»— aplicado al
instrumento entero»*. La fila de cortesía **no tiene esa forma**: `courtesy_grant` conserva un
`scope` y **una** *«suscripción que pausa»*, no anulable. O el `scope` plural es una configuración
que no hace nada, o la cortesía cruza verticales igual que el grant cruzaba.

**El camino.**

1. `B/02` §2.4: *«| **`courtesy_grant`** | beneficiario, **scope**, días o meses, inicio, fin, quién
   lo firmó, motivo, **la suscripción que pausa** | … la suscripción **no es anulable** |»*.
2. Una suscripción es de **una** vertical (`B/02` §2.2: *«`user`, **vertical**, versión de plan
   anclada…»*).
3. El contrato mapea la cortesía a **una** fuente: *«| suscripción, cortesía, trial, `BASE` | —
   (cubren su vertical) | `VERTICAL` |»* (§2.7). El grant, en la fila de abajo, es el único con
   fan-out.
4. Entonces un `courtesy_grant` con scope de dos verticales emite una sola fuente, en la vertical de
   la suscripción que pausa. La segunda vertical del scope **no recibe nada**: el `scope` es una
   columna que se puede escribir y no hace nada — *«una opción que existe en la base, se puede
   encender, y no hace nada»*, que es el modo de falla que `B/16` §2.4 nombra para rechazarlo.
5. Y si alguien la hace hacer algo —emitir la fuente en las dos verticales con la referencia de la
   suscripción que pausa— es `F-8bA1-002` otra vez, con `CORTESÍA` en vez de `GRANT`: la segunda
   vertical resolvería contra la versión anclada de un plan de la primera.

**Dónde lo permite el diseño.** `B/02` §2.4, la fila y el bullet de `courtesy_grant.subscription_id`
—que declara que *«la referencia que transporta el `tipo: CORTESÍA` es **la versión anclada de la
suscripción que pausa**»*, o sea explícitamente **una** versión de **una** vertical— contra el
`scope` de la misma fila y contra el §2.8 del contrato, que la invoca como el precedente correcto.

**Severidad.** `MEDIA` — hoy no da acceso: la lectura que el modelo sostiene es la que emite una
sola fuente, y ésa es correcta. Lo que queda es una columna muerta en la entidad que el arreglo 6
citó como su modelo, y la duda razonable de si un implementador la va a interpretar como el fan-out
que el contrato le pide al grant.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 6**, por la vía de citar un precedente sin
verificarlo — la misma regla dura de esta fase (*«verificá las citas ajenas contra EL TEXTO»*)
aplicada al que arregla.

---

### F-8cA1-014 — «Y sí por los otros ocho» apoya el arreglo en un conteo que el propio capítulo desmiente: la tabla tiene siete pasos

**Qué se rompe.** El criterio nuevo define la exención de las lecturas **por sustracción sobre un
total**: *«no pasa por el 5 — y sí por **los otros ocho**»*. El total es nueve, y la tabla que
enumera los pasos tiene **siete filas**. Quien implemente contra la tabla exime uno y le quedan
**seis**, no ocho; los dos pasos que faltan no tienen nombre, así que nadie puede decir si una
lectura los atraviesa. El conteo dejó de ser un descuido de redacción el día que un arreglo lo usó
para definir una regla.

**El camino.**

1. `V/17` §1.1 cierra con *«Quedan **nueve pasos y una precondición**»*.
2. `V/17` §1.2 trae la tabla. Contada por mí: una fila de precondición (`—`) y filas numeradas **1 a
   7**. Siete pasos.
3. `V/17` §3.5 punto 1 define la exención restando sobre nueve: *«y **sí por los otros ocho**»*.
4. La ⚠️ del mismo punto refuerza el nueve: *«Los **nueve** pasos no vienen en bloque, y decir que
   una lectura «no es de dominio» la sacaba de **los nueve**»*.
5. Un implementador con la tabla delante exime el 5 y corre 1, 2, 3, 4, 6 y 7. Seis. Si los dos que
   faltan existen —y `HOS-1353/spec.md` §3.6 también titula *«Nueve pasos»* sobre siete—, nadie sabe
   si una lectura los tiene que atravesar, y el arreglo no lo puede decir porque los cuenta sin
   nombrarlos.

**Dónde lo permite el diseño.** Las tres citas de arriba, en el mismo capítulo.

**Severidad.** `MEDIA` — por sí solo no abre nada; convierte un desajuste de conteo viejo en la base
aritmética de una regla nueva, y es el tipo de número que después aparece en el predicado de un
guard. Sube de `BAJA` sólo por eso.

**¿Es nuevo, o es el arreglo?** **El conteo es viejo** —es `F-8A1-016`, de la FASE 8, que nunca
estuvo en un racimo—. **Lo nuevo es que el arreglo 3 lo volvió portante**: antes nadie decidía nada
con ese número, y ahora la única formulación de qué pasos corre una lectura es *«los otros ocho»*.

---

### F-8cA1-015 — Si `S17` falla, la predecesora y la sucesora quedan las dos emitiendo: el pliegue suma los dos planes, que es lo que el arreglo 16 evitó del otro lado de la autorización

**Qué se rompe.** El arreglo 16 eligió que *«esperar autorización NO emite»* citando el costo de la
otra rama: *«durante una sucesión significa **los dos planes sumados** hasta que la nueva se
autorice»*. Cerró la ventana **antes** de la autorización y dejó abierta la de **después**: `S2` y
`S17` disparan con el mismo webhook y son dos escrituras sobre dos filas, y el propio `S17` declara
que puede no ocurrir. Cuando no ocurre, hay dos filas en estado emisor para el mismo
`user + vertical`, y el contrato no tiene ninguna regla que diga que sólo una cuenta.

**El camino.**

1. Cambio de plan: la sucesora nace con `sucede_a` apuntando a la predecesora (`S1`).
2. Llega el webhook de autorización. `S2` mueve la sucesora a `ACTIVE` — y por el espejo de `B/03`
   §10.1, `authorized × PENDING_AUTHORIZATION` → `S2`, que se ejecuta sobre la relectura de **ese**
   preapproval.
3. `S17` tiene que cancelar la predecesora en el proveedor. Si esa cancelación falla, el propio §3.2
   lo declara: *«Si la cancelación en el proveedor **falla**, `S17` no ocurre: la marca se pone y una
   persona lo mira»*.
4. Queda la predecesora en su estado vivo —`ACTIVE`, o `CANCEL_SCHEDULED` si venía de `S11`— y la
   sucesora en `ACTIVE`. `B/03` §3.1 es explícito sobre la marcada: *«La fila conserva el estado que
   tenía, y **sigue cubriendo a quien estaba cubierto**»*.
5. `cobertura(user, vertical)` devuelve **dos** fuentes `SUSCRIPCIÓN`, las dos de clase `TÍTULO`, con
   dos referencias distintas. El contrato define `fuentes` como una lista y no acota su cardinalidad
   por tipo.
6. El pliegue de `V/15` §2.2 suma: con `SUMA` los cupos de los dos planes; con las tres de «no
   acumula», *«gana el cliente»*. La persona opera con el máximo de los dos planes mientras dure la
   marca, y la marca **ya no vuelve a alertar** (`B/09` §3, arreglo 19).

**Dónde lo permite el diseño.** `12-contrato…` §2.6, que enumera qué emite cada estado **por fila** y
nunca por `user + vertical`, y cuya justificación nombra el caso: *«durante una sucesión significa
**los dos planes sumados** hasta que la nueva se autorice»* — *hasta que se autorice*, que es
exactamente donde termina la garantía. `B/03` §3.2, `S17` y su rama de falla. `B/03` §3.1, la marca
que sigue cubriendo. `B/02` §2.2, que admite *«hasta **dos filas** durante la ventana de una
sucesión»*.

**Severidad.** `MEDIA` — las dos autorizaciones siguen vivas, así que la persona está pagando los dos
planes mientras recibe los dos: no paga de menos. Lo que queda mal es que la capacidad sigue al
accidente en vez de al contrato, y que el techo de lo que alguien puede tener depende de que una
llamada al proveedor haya salido bien. El doble cobro en sí es de `B1`/`B2`.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 16**, que acotó su garantía a la mitad
anterior de la sucesión, junto con los arreglos 11 y 12, que crearon la transición cuya falla abre
la mitad posterior. Antes de los tres no había `S17` y la predecesora **nunca** se cancelaba, así que
el caso existía siempre y estaba reportado como doble cobro; lo que es nuevo es que ahora el diseño
declara un camino feliz y **un camino declarado de falla que nadie recorrió hasta el paso 6**.

---

## Los 14 hallazgos de la 8-bis, reejecutados sobre el texto de hoy

No cuentan como hallazgos nuevos. Cada camino se volvió a correr paso por paso.

| ID | título, en corto | ¿corta? | dónde |
|---|---|---|---|
| `F-8bA1-001` | el addon sigue otorgando sin título | **SÍ, con reserva** | corta en el paso 5 de su camino: el gate del arreglo 2 existe y es normativo. **Pero vive sólo en el contrato** — es `F-8cA1-007` |
| `F-8bA1-002` | el grant ancla un plan y su scope son varias verticales | **NO** | llega entero por el paso 2: `B/02` §2.4 sigue con `scope de verticales` y **un** `plan`. Es `F-8cA1-002` |
| `F-8bA1-003` | el criterio del paso 5 saca a toda lectura de la resolución | **SÍ** | corta en el paso 2: *«Toda operación la corre, escriba o no. No hay operación exenta»*. El arreglo 3 lo cerró bien, y abrió `F-8cA1-004`, `005`, `006` y `014` |
| `F-8bA1-004` | el §2.2 justifica la lista con una regla que `BASE` vuelve siempre verdadera | **NO** | llega entero: `12-contrato…` §2.2 está **sin tocar** —*«quitar una fuente no quita la cobertura si queda otra»*— y ahora convive con un `BASE` que siempre queda. No estuvo entre los 23 |
| `F-8bA1-005` | el trinquete del grant necesita un dato que el contrato no transporta | **NO**, y agravado | llega en el paso 3: la fuente sigue con cinco campos (§2), el §4 sigue prohibiendo cruzar valores, y `permanent_grant.piso_del_trinquete` sigue del lado de billing (`B/02` §2.4). **El arreglo 6 lo empeoró**: con N planes hacen falta N pisos y la columna es una |
| `F-8bA1-006` | la clase «disparada por el reloj» no tiene dónde declararse | **NO** | llega en el paso 2: las tablas de `V/03` §2, §9 y §11 siguen con las mismas columnas —`desde, evento, hacia, condición, efectos`— y ninguna es la clase. `G-R3-B` sigue sin conjunto sobre el que cuantificar |
| `F-8bA1-007` | los pasos 5-7 «sobre el actor» no tienen respuesta cuando el actor es el reloj | **NO** | llega entero: `V/17` §3.4 sin tocar, y `BASE` sigue siendo *«de toda **persona**»* (§2.5) |
| `F-8bA1-008` | §3.4 resuelve el reloj y deja al webhook, que es el que SÍ otorga | **NO** | llega entero: §3.3 sigue declarando un actor de sistema con dos formas y §3.4 sigue titulando *«Cuando el actor es **el reloj**»*. `PB3` sigue otorgando |
| `F-8bA1-009` | `G-R3-C` cuantifica sobre el conjunto que tiene que cerrar | **NO**, y agravado | llega en el paso 3, y peor: el conjunto sobre el que cuantifica ya no está definido en ningún lado (`F-8cA1-006`) |
| `F-8bA1-010` | las dos versiones no vendibles no tienen evento de invalidación | **SÍ** | corta en el paso 4: la lista de `V/02` §3.2 ganó la fila *«se publica una versión nueva de la de PISO o de la de PRE-TRIAL»*. **Su consumidor no se enteró** — es `F-8cA1-008` |
| `F-8bA1-011` | nadie implementa la fuente `ADDON`: el §5.1 dice cuatro y el §5.2 tres | **NO** | llega entero: §5.1 sigue diciendo *«las cuatro de billing: suscripción, cortesía, grant y addon»* y §5.2 sigue diciendo *«Agrega **las otras tres** fuentes —suscripción, cortesía, grant—»*. No estuvo entre los 23 |
| `F-8bA1-012` | la dirección inversa declara siete campos y se cuenta como seis | **NO**, y ahora explícito | el arreglo 7 corrigió el §4.1 —*«Son **siete campos** en tres preguntas»*— y **no tocó el §4.2**, que sigue cuantificando la regla de vigilancia sobre *«los **seis** campos del §4.1»*. Antes eran dos números en dos lugares; ahora se contradicen a dieciséis líneas de distancia |
| `F-8bA1-013` | qué otorga la versión de pre-trial tiene tres declaraciones distintas | **NO** | llega entero: `V/02` §2.1 sigue con *«exactamente tres cosas»* y `G-R3` sigue prohibiendo *«ningún entitlement medido»* sobre la misma versión que el §64.6 obliga a limitar a una ficha |
| `F-8bA1-014` | el paso 5 conserva un mensaje de rechazo inalcanzable | **NO** | llega entero: la fila 5 de `V/17` §1.2 sigue diciendo *«sin cobertura»* en la columna «si falla», cinco párrafos arriba de la precisión 5 |

**Tres cortan** (`001` con reserva, `003`, `010`) y **once siguen llegando**, dos de ellos agravados
por la tanda (`005`, `009`) y uno vuelto contradicción explícita (`012`).

---

## Ataques que intenté y el diseño resistió

Vale tanto como la lista de arriba: son los caminos que probé sobre el texto nuevo y que cierran.

- **Conservar el addon `USER`/`GLOBAL` apoyándolo en el título de OTRA vertical.** Probé que alguien
  compra un addon global sobre Alojamiento, Alojamiento cae en `SUSPENDED` y el addon sobrevive en
  Gastronomía porque ahí sí hay título. **Cierra, y está decidido de antemano**: `V/11` §5.3 dice
  textual *«La persona conserva el addon en cada vertical donde tenga una **suscripción real** y
  **sólo se apaga en la que está probando**»*. No es un hueco: es la regla.
- **Revivir un trial vencido por la puerta que abrió el arreglo 8.** `T6` va de `PRE_TRIAL` a
  `TRIAL_CONVERTED` y **no crea una entrada a `PRE_TRIAL`**: *«nadie entra a `PRE_TRIAL`, se empieza
  ahí, y ninguna transición vuelve»*. El `UNIQUE(user_id, vertical)` sin condición de estado cierra
  el resto.
- **Que la sucesión emita dos fuentes ANTES de la autorización**, para tener dos planes durante 72
  horas repetibles. Cerrado en seco por el arreglo 16: `PENDING_AUTHORIZATION` **no emite**, con la
  razón escrita y con el costo de la rama contraria medido. Lo que queda abierto es después de la
  autorización, y es `F-8cA1-015`.
- **Darle cobertura perpetua a un `PRE_TRIAL` confundiendo `SIN_EMPEZAR` con `NO_VENCE`.** Cerrado
  por `D-20` y, ahora, por la clase derivada del `hasta`: la fila `TRIAL × SIN_EMPEZAR` de la tabla
  del §2.4 dice `BASE`, no `TÍTULO`.
- **Publicar en Partner apoyándose en la versión de pre-trial.** Cerrado por dato y no por rama: sin
  evento declarado y con días en cero, el «si y sólo si» de `V/02` §2.1 le niega la capacidad de
  activación, y `G-R3` lo verifica en las dos direcciones.
- **Usar el addon `LISTING` de una ficha en otra ficha del mismo dueño.** Cerrado por el pliegue en
  dos tramos (§2.7), y cerrado bien: sin meter la ficha en la clave del caché y sin crear un segundo
  lugar donde se resuelven capacidades.
- **Expresar una fuente sin referencia para que el paso 6 falle abierto.** Cerrado
  estructuralmente, y ahora también en la base: `B/02` §2.4 le puso columna no anulable a las dos
  concesiones que no la tenían.
- **Que un job otorgue una cortesía o un grant.** `V/17` §3.3 intacto contra `D11`, y `S13` sigue
  exigiendo `SUPER_ADMIN`.
- **Impersonar al cliente para lavar el rastro.** `V/17` §3.2 regla 4, intacta.
- **Que un addon permanente quede como título encubierto.** Cerrado por `B/16` §1.3: *«**no hay
  vigencia `PERMANENTE`**»*, con la razón —ya existe el grant— y el argumento de por qué dos
  mecanismos para lo mismo es el defecto que el programa corrige.
- **Comprar un addon sobre una suscripción que todavía no se autorizó, para quedarse con la
  capacidad si el checkout se abandona.** Cerrado por `B/16` §2.2, que enumera los siete estados y
  deja **sólo `ACTIVE`**, con la excepción del grant declarada y justificada.
- **Acumular roles hasta que el paso 3 deje de filtrar.** Sigue cerrado: §64.12, §64.13, `G6`, y `G4`
  impidiendo que una transición escriba roles.
- **Que el `BASE` de una vertical le dé algo comercial a alguien en otra.** Cierra en el paso 6 y
  `V/17` §2.2 lo dice donde corresponde desde el arreglo anterior: *«se le contesta en el **paso
  6**, porque la versión de piso de Alojamiento no otorga ninguna capacidad comercial»*.

---

## Fuera de mi vector

Lo que vi y le toca a otro. No lo perseguí.

- **`NUCLEO`.** Sigue en pie lo que reporté la vuelta pasada y no se tocó: `NUCLEO/08` §3 tiene
  **doce filas** y `V/17` §3.2 regla 1 las llama *«las doce **acciones** … una por una»*, pero
  **cuatro filas nombran dos actos cada una** —*«otorgar **o revocar** una cortesía»*, *«otorgar **o
  revocar** un grant»*, *«aprobar **o rechazar** una postulación»*, *«pausar **o reanudar**»*—.
  Contadas por acto son **dieciséis**, y el permiso *«de esa acción concreta»* cuantifica sobre
  actos. Es de la pasada C. `F-8cA1-005` se apoya en la tabla, no en el conteo.
- **Costura (`C1`).** El catálogo de `V/20` §2 lista **diez** guards (contados por mí: `G1`-`G6`,
  `G8`, `G-R3`, `G-R3-B`, `G-R3-C`), **`G7` no existe**, y `HOS-1353/spec.md` §5 sigue diciendo
  *«siete»*. Tercera cardinalidad viva.
- **Costura (`C1`).** `V/19` sigue partido: el §2 tiene **una** fila (Admin), el §4 está numerado
  `1, 2, 4, 8, 9` y no hay §3 ni §5. El capítulo se presenta como *«la lista de lo que hay que
  decirle a la gente»* y la lista está incompleta.
- **Máquinas y carreras (`A2`).** `PB2` y `PB3` ahora dependen de un hecho diferencial (*«el cambio
  de `cubierto`»*) y **el único transporte declarado de ese hecho es el aviso del contrato §3**, que
  *«no reemplaza la consulta»*. Quién guarda el valor anterior de `cubierto` para poder detectar el
  cambio no está escrito en ningún lado; `F-8cA1-003` es el caso extremo (no hay valor anterior), y
  el caso general es de `A2`.
- **Datos (`A3`).** `V/02` §3.2 encabeza su lista con *«Invalidan la entrada de un `user +
  vertical`»*, y **las cuatro entradas nuevas del arreglo 4 no invalidan una entrada: invalidan
  todas** —la versión de piso la tiene todo el mundo—. Qué significa «recalcular» cuando el
  disparador alcanza a la cartera entera, y qué hace el reconciliador de excedentes en ese caso, no
  está escrito.
- **Billing (`B1`/`B3`).** `F-8cA1-009` tiene una mitad operativa que no perseguí: qué pasa con la
  cartera cuando el 100 % de las filas queda marcada, y qué escala el reloj de la marca del
  arreglo 19 cuando lo que venció es una marca falsa.

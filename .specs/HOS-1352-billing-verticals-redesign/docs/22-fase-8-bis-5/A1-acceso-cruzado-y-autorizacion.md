---
title: "FASE 8-bis-5 · A1 — acceso cruzado y autorización"
linear: HOS-1352
statusSource: linear
created: 2026-09-22
updated: 2026-09-22
status: CURRENT
fase: 8
---

# FASE 8-bis-5 · A1 — acceso cruzado y autorización

Sexta pasada adversarial sobre `HOS-1353`, con el vector de siempre —**que una cuenta llegue a algo
que no le corresponde, o pierda algo que sí**— sobre el texto que la 9-bis-4 produjo.

**Seis hallazgos. Uno `CRITICA`, dos `ALTA`, tres `MEDIA`.**

Los paths se abrevian como siempre: `NUCLEO` es `HOS-1352-…/docs/nucleo/`, `V` es
`HOS-1353-verticales-capacidades-y-autorizacion/docs/`, `B` es
`HOS-1354-billing-cobro-y-proveedor/docs/`, y lo que no lleva prefijo es `HOS-1352-…/docs/`.

**Lo que medí yo, y cómo.** Todo conteo de este informe sale de recorrer el artefacto citado sobre
el worktree `/home/qazuor/projects/WEBS/hospeda-spec-hos-1352-billing-redesign` el 2026-09-22, con
`rg` o a mano sobre la tabla: **17** guards en `V/20` §2 (eran 15 en la 8-bis-4); **10** filas en la
tabla de invalidación de caché de `V/02` §3.2 —7 originales más 3—; **3** planes marcados *«no
vendible»* por vertical en `V/02` §2.1 (trial, pre-trial, piso); **3** ítems en la lista cerrada de
la versión de piso; **6** filas en la tabla de lectura de catálogo de `V/10` §2; **12** filas en el
catálogo de acciones administrativas de `NUCLEO/08` §3; **19** filas con número en `B/19` §4 (con
sus tres *bis*); **7** filas numeradas en la tabla de pasos de `V/17` §1.2 más la precondición,
contra el *«nueve pasos»* de su prosa; **77** commits en `5ac5e92c9~1..HEAD`; **1** commit de la
tanda sobre `V/17`, **4** sobre `V/02`, **5** sobre `V/03`, **1** sobre `V/15`, **1** sobre `V/11`,
**2** sobre `V/19`, **6** sobre `V/20`. **Ningún número de este informe viene de otro informe**, y
las citas están verificadas contra el texto del capítulo, nunca contra el informe —ni el rastro—
que las cita.

---

## La tesis: la tanda cerró mi `CRITICA` moviéndolo a una fila de catálogo, y el guard que vigila esa fila sólo sabe prohibir

`F-8eA1-001` decía que `PB8` era inejecutable porque el piso no otorgaba reactivar. El arreglo
(`afa4590c2`) hizo lo correcto: **le agregó una tercera cosa a la lista cerrada de la versión de
piso**, y la escribió en los cinco lugares que hacían falta —`V/02` §2.1, `V/17` §1.2 precisión 1,
`V/17` §2.2, `V/03` §9 (la fila de `PB8` y la tabla comparativa) y el `12-contrato…` §2.5—. Mi
crítico corta.

**Lo que no hizo, y es de lo que sale mi `CRITICA` de esta vuelta, es preguntarse quién verifica que
esa fila EXISTA.** `G-R3` es el único guard sobre las versiones no vendibles, y su predicado es
enteramente **negativo**: *«no otorga una clave de la clase comercial ni ningún entitlement
medido»*, más **un** «si y sólo si» que alcanza sólo a la capacidad de activación de la versión de
**pre-trial**. Ninguna de las tres cosas que el piso declara otorgar tiene quien exija que esté.

El corpus tiene esa regla escrita, literal, sobre otro guard del mismo día: *«**La mitad que falta
es la misma en las dos listas**: ninguna de las dos comprueba que sus miembros declarados
**existan**, sólo que no haya intrusos»* (`V/20` §2, sobre `G-R6` y `G-R6-B`). Se escribió el
2026-09-21 para la columna del reloj y **no se aplicó a la lista que el mismo día pasó de dos a
tres**.

Y hay un modo segundo, del mismo nudo: **`G-R3` no puede formar su medio predicado**, porque
*«clave de la clase comercial»* no está definida en ningún capítulo ni es un atributo que el
catálogo de claves declare. El guard que `V/20` §2 llama *«el que más carga lleva»* tiene que
clasificar, como primera clave de su vida, exactamente la que la tanda acaba de agregar.

---

## CRITICA

### F-8fA1-001 — `G-R3` sólo sabe prohibir: nada exige que la versión de piso OTORGUE sus tres cosas, así que la defensa entera del hard delete del día 180 —y la «recuperación posible» del §21— cuelgan de una fila de catálogo cuya ausencia no ve ningún guard — `NUCLEO`

**Qué se rompe.** El piso de una vertical se siembra sin la clave *«recuperar lo suyo»* —o sin *«contratar
una suscripción»*—. El catálogo pasa `G-R3` en verde, porque el guard sólo pregunta si sobra algo.
A partir de ahí, y **sin que nada lo señale**: quien canceló y tiene su ficha `ARCHIVED` recibe un
rechazo en el paso 6 al intentar `PB8`, no puede ejecutar ninguno de los cuatro hechos que
reinician la inactividad, el reloj corre hasta el día 180 y **se le borra el contenido publicable
de la ficha**. Es `F-8eA1-001` reproducido entero, con una diferencia que lo empeora: antes el
defecto estaba escrito en el diseño y era señalable leyendo dos párrafos; ahora está en una fila de
una tabla de catálogo y **el único mecanismo que el diseño puso ahí a propósito mira para el otro
lado**. Y con la segunda clave ausente el daño es mayor y más ancho: un `TRIAL_EXPIRED`, un
`Turista Free` y un `Guest` **no pueden suscribirse**, que es la única forma de volver a tener un
título — *«queda afuera para siempre»* con las palabras del `12-contrato…` §2.5.

**El camino.**

1. La lista es de **tres** y es cerrada: *«Otorga exactamente lo mínimo para que alguien exista en
   la plataforma, **pueda recuperar lo suyo** y pueda volver a contratar. Son **tres** cosas y la
   lista es cerrada»*, con su tabla: *«| 1 | **ninguna capacidad comercial** | es la mitad en
   negativo, y la vigila `G-R3` | 2 | **contratar una suscripción** | sin esto la «recuperación
   posible» del §21 no tiene por dónde ocurrir | 3 | **recuperar lo suyo**: sobre una ficha
   **propia**, verla, exportarla y **reactivarla a borrador** (`PB8`, cap. 03 §9) | sin esto la
   mitad de la defensa del hard delete del día 180 es inejecutable — §4.2, regla 3 |»* (`V/02`
   §2.1).
2. **Sólo la fila 1 tiene guard, y lo dice ella misma**: *«es la mitad en negativo, y la vigila
   `G-R3`»*. Las filas 2 y 3 no nombran ninguno.
3. **El enunciado del guard es negativo entero, más un «si y sólo si» que no las alcanza**: *«**`G-R3`
   — ninguna de las dos versiones no vendibles de una vertical otorga una clave de la clase
   comercial ni ningún entitlement medido**, y la capacidad de activación está en la de pre-trial
   **si y sólo si** la vertical declara evento y su plan de trial tiene días > 0»* (`V/02` §2.1). Lo
   mismo, palabra por palabra, en el catálogo: *«| G-R3 | una de las **dos versiones no vendibles**
   de una vertical —la de pre-trial o la de piso— otorga una clave de la clase comercial o un
   entitlement medido; o la capacidad de activación no cumple el «si y sólo si» |»* (`V/20` §2).
   **Recorrí los 17 guards de `V/20` §2: ninguno otro tiene por sujeto lo que una versión de plan
   otorga.**
4. **El propio arreglo verificó una dirección y no la otra, y lo escribe**: *«**Y no toca `G-R3`,
   que es lo que hay que verificar antes de agregar nada acá.** El guard falla si esta versión
   otorga *«una clave de la clase comercial o un entitlement medido»*»* (`V/02` §2.1). La pregunta
   que se hizo es *«¿esto rompe el guard?»*; la que no se hizo es *«¿quién se entera si esto no
   está?»*.
5. **El diseño declara que ahí un error no lo ve nadie**: *«Se comprueba sobre el catálogo, en CI,
   en las dos direcciones. Es una verificación automática y no una revisión, **porque es el único
   lugar donde un error de siembra no lo ve nadie**»* (`V/02` §2.1). *«En las dos direcciones»*
   describe al «si y sólo si» de la capacidad de activación, no a las tres cosas del piso — lo
   verifiqué contra el enunciado del §2.1 y contra la fila de `V/20` §2, que son los dos únicos
   lugares donde el predicado está escrito.
6. **La regla que faltaba aplicar está escrita en el mismo catálogo, sobre otro guard del mismo
   día**: *«**La mitad que falta es la misma en las dos listas**: ninguna de las dos comprueba que
   sus miembros declarados **existan**, sólo que no haya intrusos»* (`V/20` §2, sobre `G-R6` y
   `G-R6-B`).
7. **Y `DEC-TEST-001` evaluó exactamente dos guards candidatos, y éste no fue ninguno**: el de la
   columna muerta (aceptado) y el del orden de escrituras (rechazado), más tres enmiendas —`G-R6`
   a las dos épicas, `G-R6-B`, y sus dos mitades—. Recorrí la entrada entera: **no hay una línea
   sobre la lista del piso**, aunque `afa4590c2` la haya ampliado el mismo día.
8. **El desenlace con la clave 3 ausente está escrito por el propio capítulo, como el motivo de
   agregarla**: *«Su conjunto efectivo **es** esta versión, así que si acá no está, el paso 6 la
   rechaza — y como el hecho 1 del reloj de inactividad es *«un acto del dueño … reactivarla»*
   (cap. 01 §1.2, núcleo), esa persona no puede ejecutar **ninguno** de los cuatro reinicios y el
   día 180 le borra el contenido. **Es exactamente el sujeto del borrado**»* (`V/02` §2.1).
9. **Y con la clave 2 ausente el desenlace también está escrito**: *«Sin un piso, el paso 5 le niega
   a un `TRIAL_EXPIRED` **la operación de suscribirse**, que es la única forma de volver a tener
   una: **queda afuera para siempre**»* (`12-contrato…` §2.5). Un piso presente que no otorgue esa
   clave produce lo mismo un paso más adentro, porque *«**el paso 5 deja de rechazar a nadie**, y
   toda la defensa se apoya en el paso 6»* (`V/17` §1.2 precisión 5, `12-contrato…` §2.5).

**Dónde lo permite el diseño.** Las nueve citas. El nudo es la asimetría del predicado: `G-R3` tiene
una mitad **negativa** con dominio universal (*«ninguna … otorga»*) y una mitad **bicondicional** con
dominio de una sola clave (*«la capacidad de activación … si y sólo si»*). El diseño sabe escribir
la forma que hace falta —la usó para la capacidad de activación— y no la usó para las tres cosas
que la versión que más gente recibe declara otorgar.

**Severidad.** `CRITICA` — *«un dato se pierde sin vuelta»*: es el contenido entero de la ficha de
alguien que dejó de pagar, que es un derecho, y la pérdida ocurre por la ausencia de una fila que
ningún control mira. Y cae además del otro lado de mi vector: *«queda sin poder hacer lo que sí le
corresponde»*, con la clave 2 ausente, para **toda la plataforma a la vez** — es el mismo punto
único de falla que el §2.1 declara para la dirección contraria (*«toda la plataforma la recibe
gratis, para siempre»*), leído en el sentido que nadie escribió. No lo baja a `ALTA` que haga falta
un error de siembra: el escalón del capítulo 17 —*«lo que se puede volver estructural se vuelve
estructural, lo que no se pueda se verifica en **un** lugar, y encima va un guard que falla cuando
alguien no lo hizo»*— existe precisamente para que un error de siembra no sea la condición de nada,
y acá lo es de la única operación irreversible sobre datos del cliente de todo el programa.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo de la familia de la retención**, commit
`afa4590c2` (rastro `5836ec219`), que cerró `F-8eA1-001` moviendo la defensa a una fila de catálogo
— y, en la tanda de decisiones, **`DEC-TEST-001`**, que es la entrada donde la pregunta *«¿qué guard
va?»* se hizo y se contestó sin que esta lista apareciera. Antes de la tanda la lista tenía dos
ítems y el mismo agujero; lo que cambió es **qué cuelga de ella**: hasta el 2026-09-21 ningún
párrafo del corpus decía que el hard delete del día 180 se defendiera con una clave de esa tabla.

**¿Lo habría encontrado el grep?** **No.** El término que el arreglo introduce es *«recuperar lo
suyo»*; `rg -n "recuperar lo suyo"` sobre el corpus devuelve **diez** líneas y las diez son la
afirmación de que la clave está —`V/02` §2.1 (×3), `V/17` §1.2 y §2.2, `V/03` §9 (×2),
`12-contrato…` §2.5, `V/spec` (×2)—. **Ninguna es un consumidor roto**, porque lo que falta no está
escrito en ningún lado: es un guard que no existe. El término viejo tampoco ayuda: la lista de dos
(*«ninguna capacidad comercial, y la de contratar una suscripción»*) estaba en el mismo párrafo y
tampoco tenía quien exigiera su segunda mitad.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y ahora se puede contestar con el rastro
en la mano.** La aparición más cercana **está** en `rastro-5836ec219.md` §2, y la cité entera:
*«**L210 · §2.1** — «si alguien le siembra una clave comercial a la de piso o a la de pre-trial…» →
sigue correcta: *«recuperar lo suyo»* **no es** una clave comercial, y el aviso del guard vale
igual»*, y su gemela *«**L59 · §2, `G-R3`** — «otorga una clave de la clase comercial o un
entitlement medido» → sigue correcta: la tercera cosa del piso no es ninguna de las dos, y el guard
se verificó contra ella explícitamente en `V/02` §2.1»*. **Las dos líneas son verdaderas y las dos
resuelven la pregunta angosta**: si la clave nueva rompe el guard. Ninguna de las dos podía
producir la pregunta ancha —si el guard cubre la clave nueva en el otro sentido—, porque la
obligación 2 pide justificar **la aparición del término**, y el término aparece exactamente donde
la respuesta es *«no lo rompe»*. Es el tercer desenlace del §1.4: **la aparición está, su
justificación no es falsa, y el defecto vive en la pregunta que la aparición no obliga a hacerse.**

---

## ALTAS

### F-8fA1-002 — «clave de la clase comercial» no está definida en ningún capítulo ni es un atributo que el catálogo de claves declare: el medio predicado de `G-R3` —«el guard que más carga lleva»— no se puede formar, y la primera clave que tiene que clasificar es la que la tanda acaba de agregar

**Qué se rompe.** Quien construya `G-R3` tiene que decidir, clave por clave, si es *«de la clase
comercial»*. El corpus **no dice qué hace comercial a una clave**, y el catálogo de claves no lleva
ese atributo: lleva scope, estrategia de agregación y `enforcementStrategy`, y nada más. Así que o
el guard no se construye —y entonces las dos versiones que **toda la plataforma recibe** no tienen
ninguna vigilancia, que es el punto único de falla que el propio capítulo declara—, o el que lo
construya **inventa la clasificación**, y la primera clave sobre la que la tiene que aplicar es
*«recuperar lo suyo»*: una escritura de estado sobre un `listing`, el recurso comercial de la
vertical. Si la clasifica comercial, el guard se pone en rojo sobre el catálogo correcto y la
salida obvia es sacar la clave — que es `F-8eA1-001` de vuelta. Si la clasifica no-comercial, lo
hizo con un criterio que nadie escribió y que la próxima clave va a resolver distinto.

**El camino.**

1. El predicado, en sus dos redacciones: *«ninguna de las dos versiones no vendibles de una vertical
   otorga **una clave de la clase comercial** ni ningún entitlement medido»* (`V/02` §2.1) y *«otorga
   una clave de la clase comercial o un entitlement medido»* (`V/20` §2).
2. **La otra mitad sí está definida y sirve de contraste.** *«Entitlement medido»* tiene entrada en
   el glosario: *«El que tiene costo marginal por uso. Declara **dos** cuotas: la del plan y la del
   trial, menor (`DEC-ENT-001`)»* (`NUCLEO/01` §1.6). Se puede evaluar sobre el catálogo sin
   juicio. *«Clase comercial»* no tiene entrada: **recorrí `NUCLEO/01` entero y no está.**
3. **Y el capítulo que dice qué declara una clave enumera tres cosas, y ninguna es la clase**:
   *«acá está que el subconjunto se declara por vertical y que **cada clave lleva scope, estrategia
   de agregación y `enforcementStrategy`**»* (`V/15`, *«Lo que este capítulo NO cierra»*), coherente
   con `V/15` §2.2 (*«La estrategia de agregación se declara con la clave, en el catálogo»*) y §3.2
   (*«Cada clave de entitlement y de limit declara su scope en el catálogo: de vertical, o
   global»*).
4. **Y el catálogo de claves es, por definición del núcleo, sólo nombres**: *«**lo único que vive en
   código es el conjunto de nombres. Ningún valor, ningún precio, ninguna asignación**»*
   (`NUCLEO/02` §1.2). Una clase es un valor.
5. **El guard se declara comprobable sin juicio, y ésa es la condición con que se aceptó su
   hermano**: *«Cruzar las columnas que una condición **lee** contra las que alguna transición
   **escribe** es una comprobación **estructural**, no un juicio: **no hace falta entender qué
   significa la columna**»* (`B/20` §2, sobre `G-R6`). `G-R3` pide exactamente lo contrario: hay que
   entender qué significa la clave.
6. **Y el programa tiene la regla que esto incumple**: *«el texto con que falla no puede afirmar más
   de lo que el predicado verifica. Un guard que dice *«ninguna operación cruza verticales»* y sólo
   mira una forma sintáctica está mintiendo con precisión, que es peor que no estar»* (`V/20` §2.1).
   Un guard cuyo predicado no se puede formar afirma todo y verifica nada.
7. **El caso ya está sobre la mesa, escrito como argumento y no como dato**: *«**Recuperar lo suyo
   no es ninguna de las dos**: no publica nada —`PB8` va a `DRAFT`, y publicar sigue siendo `PB1`,
   que sí es comercial—, no cuenta contra ningún limit, y su objeto es **una ficha que la persona ya
   tenía**, nunca una nueva»* (`V/02` §2.1). Es un razonamiento de tres premisas sobre un caso; un
   guard necesita un predicado sobre el catálogo.

**Dónde lo permite el diseño.** Las siete citas. Y la carga que el guard lleva está declarada por el
propio catálogo: *«**`G-R3` es el que más carga lleva** … si alguien siembra una de esas dos
versiones con una clave comercial, **toda la plataforma la recibe gratis, para siempre, sin consumir
ningún trial**»* (`V/20` §2).

**Severidad.** `ALTA` — no otorga nada indebido por sí solo y no pierde datos: lo que rompe es el
único control sobre el punto único de falla más ancho del programa. No es `CRITICA` porque para
que alguien acceda a algo indebido hace falta además un error de siembra, y el guard —si se
construye con **alguna** clasificación— sigue atrapando el caso obvio. Sube de `MEDIA` porque es el
guard que el propio corpus señala como el que más carga lleva, y porque la clave que obliga a
resolver la ambigüedad **ya está escrita**: no es una hipótesis para dentro de seis meses.

**¿Es nuevo, o es el arreglo?** **Preexistente en el enunciado, activado por el arreglo.** La frase
*«clave de la clase comercial»* vive en `V/02` §2.1 y `V/20` §2 desde la FASE 9 y la reportó de paso
`F-8bA1-…` sin llegar a este punto. Lo que la tanda cambió es que hasta `afa4590c2` **no había
ninguna clave que obligara a clasificar**: las dos cosas que el piso otorgaba eran *«ninguna
capacidad comercial»* (la negación misma) y *«contratar una suscripción»* (que nadie discute). La
tercera es la primera que cae en la zona gris, y la agregó la familia de la retención.

**¿Lo habría encontrado el grep?** **No.** El término que el arreglo introduce es *«recuperar lo
suyo»*, y el consumidor roto —el enunciado de `G-R3`— **no lo contiene**: dice *«una clave de la
clase comercial»*. Buscar el término viejo tampoco: `rg -n "clase comercial"` fuera de los informes
devuelve **cuatro** líneas —`V/02` §2.1 (×2), `V/20` §2, `V/17` §1.2 precisión 5— y las cuatro son
usos del término, ninguna una definición. **Que las cuatro sean usos y ninguna definición es
exactamente el hallazgo, y el grep lo muestra sin poder señalarlo.**

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y el rastro lo confirma en dos líneas que
cité verbatim.** `rastro-5836ec219.md` §2 declara correctas **`V/02` L210** y **`V/20` L59**, las dos
apariciones del término, con la misma justificación: *«recuperar lo suyo no es una clave comercial
ni un entitlement medido»*. **Las dos líneas usan la clasificación cuya inexistencia es el
defecto.** No son falsas —el juicio es defendible— pero **presuponen resuelto lo que no está
escrito**, que es el modo exacto que la obligación 2 no puede detectar: la aparición se declara
correcta aplicando un criterio que el corpus no tiene. Cae en el primer desenlace del §1.4 por la
forma y en el tercero por el fondo, y conviene decirlo así en vez de elegir uno.

---

### F-8fA1-003 — El commit de `DEC-GRANT-008` reescribió la fila 13 de `B/19` §4, le agregó el motivo y NO le agregó la frase del trial que `NUCLEO/08` §3.1 —la fuente que esa misma fila cita— exige; y sigue sin haber fila para «otorgar», que es el acto que consume el trial — `NUCLEO`

**Qué se rompe.** `DEC-TRIAL-009` decidió que revocar un grant **no devuelve el trial** y que eso no
se repara, y puso **una sola** obligación a cambio: *«Lo que sí corresponde, y es **lo único**: que
la confirmación de revocar lo diga»*. `NUCLEO/08` §3.1 la escribe. `B/19` §4 fila 13 —la superficie
que la ejecuta, y que cita a `NUCLEO/08` §3.1 como su fuente— **no la dice**, después de que el
commit de la tanda reescribiera esa celda entera. Y el acto que **consume** el trial —otorgar el
grant, o anclarle una vertical— sigue sin advertirlo en ningún documento: quien firma un *Free
Forever* sobre alguien en `TRIAL_ACTIVE` **le destruye su trial único de por vida** y ninguna
pantalla se lo dice. La única mitigación que el owner puso sobre una pérdida que decidió no reparar
sigue sin ejecutor, y el acto que causa la pérdida sigue sin advertencia.

**El camino.**

1. La obligación está en el núcleo, con todas las letras: *«**Y la frase de revocar dice además que
   el trial ya está consumido y no vuelve** (`DEC-TRIAL-009`). Recibir el grant consume el trial de
   esa vertical —`T2` o `T6`, según estuviera corriendo o no— y **la revocación no lo devuelve** …
   sin él quien firma cree que está haciendo algo menos grave de lo que hace»* (`NUCLEO/08` §3.1,
   regla 1).
2. **La fila que la ejecuta enumera cuatro cosas y el trial no es ninguna.** Textual, hoy: *«| 13 |
   la confirmación de **revocar un grant** | que deja al cliente **sin servicio**, qué addons corta,
   **que se pide el MOTIVO y se guarda** —texto libre, `DEC-GRANT-008`…— **y que los que el grant
   había pasado a costo $0 se apagan y no vuelven solos** … | **cap. 08 §3.1 (núcleo)**, cap. 16
   §3.3 y §3.4 |»* (`B/19` §4). **La fila cita como fuente el § que contiene la obligación que la
   fila incumple.**
3. **Y el commit de la tanda reescribió esa celda.** Lo medí con
   `git log -L` sobre la fila: `01599ec6a` (*«la revocacion guarda motivo y un beneficiario tiene un
   grant vivo»*, 2026-09-21) la sustituyó entera para insertarle *«que se pide el MOTIVO y se
   guarda»*. Es decir: **el arreglo tuvo la celda abierta, le agregó una de las dos frases que le
   faltaban y dejó la otra.**
4. **No hay fila para otorgar.** Recorrí las **19** filas numeradas de `B/19` §4 (con sus tres
   *bis*): la 13 es *«revocar un grant»* y la 13-bis es *«anclarle una vertical nueva a un grant»*.
   **Ninguna es otorgar**, aunque `NUCLEO/08` §3.1 declare que son **tres** escrituras y que *«las
   tres … tienen cada una su frase, y ninguna se deduce de la otra»*.
5. **Y ninguna de las tres frases del núcleo menciona el trial salvo la de revocar.** Textual:
   *«otorgar y anclar **cancelan la suscripción que el beneficiario paga** en cada vertical alcanzada
   (`S13`) y **terminan la cortesía que tuviera vigente ahí**…; revocar corta el servicio»*, y
   después tres párrafos que empiezan por *«Y la frase de revocar…»*. **`rg -n "trial"` sobre
   `NUCLEO/08` §3 devuelve dos apariciones: la fila *«extender un trial»* del catálogo y ese párrafo
   de revocar.** Otorgar y anclar son los actos que **consumen** el trial (`T2`/`T6`, `V/03` §2) y
   ninguno de los dos lo nombra.
6. La fila 13-bis lo hace visible sin verlo: enumera *«qué cobro deja de ocurrir»*, la cortesía que
   termina y los addons de `S20`, y cierra con *«Es el acto que **parece que sólo agrega**, y por
   eso necesita la frase más que los otros»*. **Consumir el trial de la vertical que se ancla es,
   literalmente, lo que ese acto agrega sin que se vea.**
7. El capítulo lo declara no-cosmético: *«Cada línea de esta tabla es la mitad de una decisión … Si
   la superficie no lo dice, **la decisión se convierte en lo que se le permitió no ser**»*
   (`B/19` §4).

**Dónde lo permite el diseño.** Las siete citas. El agravante es de dirección y ya estaba escrito:
`DEC-TRIAL-009` declara que *«la confirmación le avisa **al que revoca**, no al que pierde. Quien
recibe la revocación se entera cuando intenta seguir usando la plataforma»*. Si al administrador
tampoco se lo dicen, no se entera nadie — y el que pierde el trial ni siquiera tiene a quién
preguntarle por qué.

**Severidad.** `ALTA` — deja sin ejecutor la única obligación que el owner puso sobre una pérdida
irreversible que decidió no reparar, y deja al acto que causa esa pérdida sin ninguna advertencia,
en las dos puntas. No es `CRITICA` porque la pérdida en sí está decidida (`DEC-TRIAL-009`) y no la
reabro. Sube desde donde estaba en la 8-bis-4 porque ahora hay **evidencia positiva de que la
corrección pasó por encima**: el commit tuvo la celda abierta y no la completó.

**¿Es nuevo, o es el arreglo?** **Es `F-8eA1-003`, entero, con un agravante que sí es de la tanda.**
Las dos mitades siguen llegando paso por paso sobre el texto de hoy; lo que la tanda agregó es que
`DEC-GRANT-008` —una de las doce decisiones nuevas— **reescribió exactamente la celda que le
faltaba la frase** y le puso la suya sin mirar la que ya debía.

**¿Lo habría encontrado el grep?** **Sí, y con el término más obvio, en las dos vueltas.** El término
es `trial` / *«el trial ya está consumido y no vuelve»*. `01599ec6a` toca `B/19`, así que ni siquiera
hacía falta la búsqueda *«sobre los capítulos que el commit NO toca»*: el archivo estaba abierto.
`rg -n "trial" .specs/HOS-1354-…/docs/19-superficies.md` devuelve resultados en el §4 y **ninguno en
la fila 13**, que es el hueco.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Estaba en el rastro, y la línea resuelve una
pregunta más angosta que la aparición que declara.** `rastro-8d6b27a12.md` §2 lo trae:
*«**`NUCLEO/08` L200-205 · §3** — *«"qué addons corta" (`B/19` §4 fila 13)»* → sigue correcta: la
fila 13 es del §4, y es la que el commit de `DEC-GRANT-008` amplió para que pida el motivo»*. La
línea **es verdadera**: la referencia cruzada sigue apuntando bien. Pero la aparición que declara
vive **dentro del §3.1**, a cinco párrafos del renglón que obliga a la frase del trial, y el rastro
**nombra el commit que amplió la fila** sin preguntarse si la amplió entera. Es el primer desenlace
del §1.4 en su forma más útil: la regla se ejecutó, la aparición se tocó, y la resolución contestó
*«¿sigue apuntando bien?»* donde la pregunta que importaba era *«¿sigue estando completa?»*.

---

## MEDIAS

### F-8fA1-004 — `G-R6`, extendido a las nueve máquinas, va a ROJO sobre `T1`, `T6`, `T7`, `S10` y `S25`: sus guardas leen columnas de CATÁLOGO, y el catálogo no lo escribe ninguna transición por diseño

**Qué se rompe.** `DEC-TEST-001` amplió `G-R6` de las seis tablas de billing a las **nueve
máquinas**. Su predicado, textual, es *«el guard recorre cada condición de las tablas de
transiciones de **las nueve máquinas, en las dos épicas**, extrae las columnas que lee y exige que
**al menos una transición del corpus las escriba**»*, y se declara **sin excepciones** y sin juicio.
Cinco transiciones del corpus tienen guardas que leen columnas de **catálogo** —`vertical.evento_de_activacion`,
los días de trial de una `plan_version`, `vertical.fin_de_servicio`— y **ninguna transición escribe
una columna de catálogo**, porque por `NUCLEO/02` §1.2 el catálogo lo escribe *«un administrador, en
cualquier momento»*. El guard nace en rojo sobre código correcto, y la única salida es una lista de
exenciones que nadie declaró — que es la fábrica de exenciones por ruta contra la que el capítulo 17
escribe medio §3.4.

**El camino.**

1. El predicado: *«| **G-R6** | una **condición de transición lee una columna que NINGUNA transición
   escribe**. El guard recorre cada condición de las tablas de transiciones de **las nueve máquinas,
   en las dos épicas**, extrae las columnas que lee y exige que **al menos una transición del corpus
   las escriba** |»* (`B/20` §2), repetido en `V/20` §2.
2. Y su admisibilidad se apoya en que **no admite juicio**: *«Cruzar las columnas que una condición
   **lee** contra las que alguna transición **escribe** es una comprobación **estructural**, no un
   juicio: **no hace falta entender qué significa la columna** para saber si alguien la mueve»*
   (`B/20` §2).
3. **`T1` y `T6` leen dos columnas de catálogo.** Sus condiciones: *«la vertical declara evento **y**
   su plan de trial tiene días de trial > 0 **y** `cubierto` es **falso/verdadero**»* (`V/03` §2). La
   primera mitad es, por declaración propia, **catálogo**: *«Es la **mitad de catálogo** de la
   condición de `T1` —que `T6` comparte palabra por palabra— expresada **como dato en vez de como
   rama**»*, y la columna es `vertical.evento_de_activacion` (`V/02` §2.1).
4. **`T7` lee una columna de catálogo como evento**: *«el encendido: la vertical pasa los días de
   trial de su plan de trial de 0 a > 0»* (`V/03` §2), y el propio capítulo declara que *«El
   encendido no es una acción del catálogo del cap. 08 §3 … es **configuración de catálogo**»*.
5. **`S10` y `S25` leen una tercera.** Sus guardas complementarias: *«el plan al que la fila está
   anclada **se sigue prestando**»* y *«el plan al que la fila está anclada **ya NO se presta** — su
   vertical fue discontinuada (`B/10` §4.3)»* (`B/03` §3.2). El dato es
   `vertical.fin_de_servicio`, columna de `vertical` (`V/02` §2.1) escrita por el acto de
   `SUPER_ADMIN` del `B/10` §4.3 — que **no tiene fila numerada en ninguna máquina** (ver
   `F-8fA1-005`).
6. **Ninguna transición escribe el catálogo, y es la regla, no un olvido**: *«| **quién lo cambia** |
   un desarrollador, en un release | **un administrador, en cualquier momento** |»* (`NUCLEO/02`
   §1.2).
7. **El guard no declara ninguna exención.** Recorrí las dos redacciones —`B/20` §2 y `V/20` §2, con
   sus párrafos de desarrollo— y el único recorte escrito es el opuesto: *«hay que decir qué NO
   afirma el guard sobre esta columna»*, sobre `inactiva_desde`, para decir que queda **verde** por
   un escritor de cuatro. **No hay una línea sobre columnas de catálogo.**
8. Y el desenlace de un guard que falla sobre código correcto está escrito en el capítulo de mi
   vector: *«La alternativa descartada … es exactamente cómo se generan las **exenciones por ruta**:
   cada job inventando su propia respuesta al paso 5»* (`V/17` §3.4).

**Dónde lo permite el diseño.** Las ocho citas. Y el daño para mi vector es específico: **las columnas
que el guard va a marcar son justamente la mitad de catálogo que `V/02` §2.1 sacó de una rama de
código para poder vigilarla** (*«expresada como dato en vez de como rama, y un guard la verifica en
las dos direcciones»*). Si `G-R6` se calla con una exención genérica para *«columnas de catálogo»*,
esa exención cubre las tres columnas de las que dependen las **tres** transiciones que salen de
`PRE_TRIAL` — el estado más poblado del sistema.

**Severidad.** `MEDIA` — no otorga acceso indebido ni pierde datos por sí mismo: lo que rompe es un
guard que `DEC-TEST-001` aceptó **porque era comprobable sin juicio**, y que sobre cinco filas
reales del corpus no lo es. Sube de `BAJA` porque el guard todavía no corre —*«son declaraciones en
`B/20` §2 y `V/20` §2 hasta la FASE 10»*— y por lo tanto el rojo llega el día en que ya no hay
contexto para distinguir una exención legítima de una por ruta.

**¿Es nuevo, o es el arreglo?** **Lo introdujo `DEC-TEST-001`**, una de las doce decisiones nuevas, en
su **ampliación del mismo día** (*«`G-R6` alcanza LAS DOS ÉPICAS, no sólo billing»*). Acotado a las
seis tablas de billing el problema no existía en esta forma: ahí las guardas leen columnas de
`subscription` y de `payment`, que las transiciones sí escriben. La ampliación lo trajo con las tres
máquinas de verticales, y `S25` —creada por `DEC-SUB-015` en la misma tanda— agregó la quinta fila.

**¿Lo habría encontrado el grep?** **No.** El término que la decisión introduce es `G-R6` /
*«columna que ninguna transición escribe»*, y los consumidores rotos son las **condiciones** de
`T1`, `T6`, `T7`, `S10` y `S25`, que no nombran ninguno de los dos: dicen *«la vertical declara
evento»*, *«días de trial > 0»* y *«el plan … se sigue prestando»*. `rg -n "G-R6"` sobre `V/03` y
sobre `B/03` devuelve **cero** líneas (lo medí). El término viejo tampoco: antes de la ampliación no
había nada que buscar en esas tablas.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No: la aparición no existe y no debía
existir.** El commit que amplía `G-R6` toca `V/20` §2 y `B/20` §2; las cinco condiciones afectadas
viven en `V/03` §2 y `B/03` §3.2, **sin ninguna aparición del término**, así que no hay línea que
declarar correcta ni incorrecta. Es el tercer desenlace del §1.4, en el modo *«el consumidor roto no
comparte vocabulario con lo que cambió»* — `C1` §4.4 modo 3. Y es además el modo que `DEC-METH-011`
dejó vivo a propósito por la otra punta: el enunciado del guard, que es donde el defecto se podría
haber visto, **lo escribió el commit**.

---

### F-8fA1-005 — El día del fin de servicio de una vertical discontinuada, la ficha del que no perdió `cubierto` queda PUBLICADA: `PB2` pide un cambio que para dos poblaciones no ocurre, y `DEC-SUB-015` sólo corrigió una de ellas

**Qué se rompe.** `B/10` §4.3 dice, para el día del fin de servicio: *«Las fichas pasan a
`UNPUBLISHED_BY_BILLING` por PB2»*. `PB2` dispara por **el cambio de `cubierto` a falso**. Hay dos
poblaciones a las que ese cambio no les llega ese día, y sus fichas **quedan a la vista del público
en una vertical cuyo servicio la plataforma dejó de prestar**, con los entitlements de su plan
vivos: (a) **la pausada por `COURTESY`**, cuya fila sigue emitiendo fuente de clase `TÍTULO` hasta
que la cortesía vence o `S25` corre —y eso es exactamente lo que `DEC-SUB-015` decidió, así que no
es un olvido sino una consecuencia no escrita—; y (b) **las cuatro filas que `B/10` §4.3 manda a
`CANCEL_SCHEDULED` sin que ninguna transición del programa ejecute ese movimiento**, de las cuales
`ACTIVE` y `GRACE_PERIOD` emiten fuente.

**El camino.**

1. La orden del día 0 y la del día del fin de servicio: *«**cada suscripción viva que pueda llegar a
   `CANCEL_SCHEDULED` se cancela en el proveedor de inmediato** y pasa a ese estado»* y *«**El día
   del fin de servicio.** Las fichas pasan a `UNPUBLISHED_BY_BILLING` por PB2 del capítulo 03 §9»*
   (`B/10` §4.3).
2. El evento de `PB2`: *«| PB2 | `PUBLISHED` | **`cubierto` pasa a falso** | `UNPUBLISHED_BY_BILLING`
   | o el excedente tras un downgrade, que no cambia `cubierto` y sí el cupo |»* (`V/03` §9). **Es un
   cambio, no un estado**, y el propio § lo subraya: *«`PB2` y `PB3` se disparan por el CAMBIO de
   `cubierto`»*.
3. **Población (a): la pausada por `COURTESY` sigue cubierta.** El contrato lo dice por estado:
   *«| `PAUSED` por `COURTESY` | **sí**, como `tipo: CORTESÍA` | la fecha de fin de la cortesía | lo
   sostenemos nosotros (`DEC-GRANT-003`) |»* (`12-contrato…` §2.6), y una fuente `CORTESÍA` con
   `hasta: fecha` es de clase **`TÍTULO`** (§2.4), o sea cuenta para `cubierto`.
4. **Y esa fila se queda donde está por decisión.** *«**La pausada no entra al piso y se queda
   `PAUSED`.** … Su preapproval **no se cancela el día 0**: se cancela cuando la pausa termine, en
   `S25`»* (`B/10` §4.3), y `S25` sale de *«`PAUSED` — **con cualquiera de los dos motivos**»*
   (`B/03` §3.2) con el evento de `S10`: *«llega el fin de la pausa, o la persona vuelve antes»*.
   Una cortesía de N meses firmada por `SUPER_ADMIN` sostiene la ficha publicada esos N meses
   **después** del fin de servicio.
5. **Población (b): el movimiento del día 0 no lo ejecuta ninguna fila.** Lo declara el propio rastro
   de la tanda, como pregunta abierta: *«**El acto de la discontinuación sigue sin fila numerada, y
   no sólo para `PAUSED`.** `S11` no lo ejecuta —su evento es *«pide la baja»*, un acto del cliente
   sobre su propia fila— y `B/10` §4.3 lo decide `SUPER_ADMIN` sobre la cartera entera de una
   vertical. Hoy ese movimiento cae en la regla 1 del núcleo desde `ACTIVE`, `GRACE_PERIOD`,
   `SUSPENDED` y `PENDING_AUTHORIZATION` exactamente igual que caía desde `PAUSED`. `DEC-SUB-015`
   resolvió **a quién alcanza el piso**, no **qué transición lo ejecuta**»*
   (`rastro-8d6b27a12.md` §6, pregunta 3). **Nadie la contestó**, y la regla 1 del núcleo dice que un
   movimiento sin fila es un incidente y no una operación.
6. **Y de esas cuatro, dos emiten**: *«| `ACTIVE` | **sí** | `SIN_FECHA_CONOCIDA` |»* y
   *«| `GRACE_PERIOD` | **sí** | `SIN_FECHA_CONOCIDA` | el §20 da **servicio entero** durante el
   grace |»* (`12-contrato…` §2.6). Sin la transición que las lleve a `CANCEL_SCHEDULED`, `cubierto`
   no cambia y `PB2` no dispara.
7. **La regla que esto incumple es la que ordena el § entero**: *«**Se deja de cobrar antes de dejar
   de prestar. Nunca al revés.**»* (`B/10` §4.2). Acá se sigue **prestando** —la ficha visible, los
   entitlements vivos— después del día en que el servicio terminó, que es la mitad que esa regla no
   nombra.
8. Y el aviso no lo cubre: `B/19` §4 fila 14-bis —la fila que `DEC-SUB-015` creó para el pausado—
   dice que *«su pausa sigue corriendo y no se la toca nadie»* y que *«al volver elige de nuevo»*.
   **Recorrí las 19 filas de `B/19` §4 y las 6 de `V/19` §4: ninguna dice qué pasa con la ficha de
   esa persona el día del fin de servicio.**

**Dónde lo permite el diseño.** Las ocho citas. **Y digo de frente la tensión con el §4 de las
instrucciones**, porque corresponde: *«la discontinuación de una vertical»* está en la tabla de lo
que no se reporta, con la causa de que el owner declaró que no va a pasar. Lo reporto igual y la
razón no es mía: es de `DEC-SUB-015`, que declara textualmente que la declaración del owner *«**NO
retira nada de lo escrito**, y la razón es que la contradicción entre `B/10` §4.3 y `B/03` §3.3 era
real con escenario o sin escenario: un capítulo ordenaba lo que otro prohíbe, que es exactamente la
clase de defecto que el ciclo `DEC-METH-006` existe para eliminar»*. **Lo que traigo es esa misma
contradicción, sin corregir, para las otras cuatro filas** —y su consecuencia sobre la publicación,
que la decisión no miró para ninguna de las cinco—. Lo que **no** reabro es el saldo de cortesía sin
destino, que `DEC-GRANT-010` sí dejó declarado con causa.

**Severidad.** `MEDIA` — *«alguien accede a algo que no le corresponde»* en su forma más literal —una
ficha visible en el sitio público de una vertical cerrada, y sus entitlements comerciales vivos—,
pero sobre un escenario que el owner declaró improbable y con un desenlace que no pierde datos ni
cobra de más. No lo bajo a `BAJA` porque para la población (b) el mismo hueco tiene una mitad de
cobro que no es mía —la fila `ACTIVE` que nadie mueve **sigue con su preapproval** y el §4.2 existe
para que eso no pase—, y esa mitad la hereda `B1`/`B3`.

**¿Es nuevo, o es el arreglo?** **Mitad y mitad, y las dos mitades son de la tanda.** La población (a)
la crea `DEC-SUB-015` —una de las doce decisiones nuevas—: antes de ella `B/10` §4.3 pretendía
mandar a la pausada a `CANCEL_SCHEDULED`, y aunque el movimiento no fuera ejecutable, ningún párrafo
declaraba que la fila **se queda emitiendo**. Hoy lo declara y no dice qué pasa con la ficha. La
población (b) es preexistente y quedó **nombrada** por el rastro `8d6b27a12` §6 como pregunta 3, sin
respuesta — y una pregunta abierta no es una causa declarada.

**¿Lo habría encontrado el grep?** **No.** El término que la decisión introduce es `S25` / *«no entra
al piso»*. `rg -n "S25"` sobre el corpus devuelve **24** líneas (lo medí) y **todas** están en
`B/03`, `B/09`, `B/10`, `B/14`, `B/16`, `B/19`, `B/20` y `NUCLEO/01` — **ninguna en `V/03`**, que es
donde vive `PB2`, ni en `V/02`, ni en el contrato. El consumidor roto es la celda del evento de
`PB2`, que dice *«`cubierto` pasa a falso»* y no nombra ni `S25` ni el piso ni la discontinuación.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y el rastro lo muestra por las dos puntas.**
La única aparición cercana que el rastro declara es *«**`B/10` L218-221 · §4.4, «el piso de 60
días»** — «como el cobro ya se cortó el día 0, esos días se prestan **sin cobrar**» → **sigue
correcta para la población que le quedó** … La pausada quedó fuera por `DEC-SUB-015` y **no recibe
esos días** —no está recibiendo servicio, está pausada—»* (`rastro-8d6b27a12.md` §2). **Esa línea es
donde el defecto se podía ver y no se vio**: afirma *«no está recibiendo servicio»* sobre una fila
que, si el motivo es `COURTESY`, **sí emite fuente de clase `TÍTULO`** (`12-contrato…` §2.6) y por lo
tanto sí está recibiendo servicio de nuestro lado, que es literalmente lo que `DEC-GRANT-003`
decidió. La línea es verdadera para `CUSTOMER_REQUEST` y **falsa para `COURTESY`**, y `S25` sale de
*«`PAUSED` con cualquiera de los dos motivos»*. Primer desenlace del §1.4: la regla se ejecutó, la
aparición está, y la justificación generaliza sobre un motivo cuando el sujeto tiene dos.

---

### F-8fA1-006 — Una línea del rastro certifica «siguen siendo dos» sobre los tres planes no vendibles que `V/02` §2.1 declara, y con eso la tabla de lectura de catálogo de `V/10` §2 se queda con seis filas y ninguna dice qué versión lee la fuente de trial en `TRIAL_ACTIVE`

**Qué se rompe.** `V/10` §2 es *«la única regla de lectura que el resto de la Parte II va a usar sin
repetirla»*: seis filas que dicen, por consumidor, **qué versión de plan lee**. La fuente de un trial
**corriendo** —`tipo: TRIAL`, `hasta: la fecha de fin`, que `V/03` §2 dice que apunta a *«la versión
del **plan de trial**»*— **no tiene fila**. La única fila que nombra al plan de trial es la 3, *«la
derivación del plan de trial»*, que pide *«las versiones **vigentes y vendibles**»* — y el plan de
trial está *«marcado **no vendible**»*. Quien implemente la resolución siguiendo esta tabla no
encuentra de dónde sacar la referencia de un `TRIAL_ACTIVE`, y si toma la fila 3 como respuesta le
exige `vendible` a una versión que nunca lo es: **el paso 6 no resuelve capacidades para nadie que
esté en su trial**. Y el § cierra afirmando que las seis quedan cubiertas *«sin excepción»*.

**El camino.**

1. **Son tres planes no vendibles por vertical, no dos.** `V/02` §2.1, tres párrafos distintos:
   *«**El plan de trial no es una entidad aparte.** Es un `plan` con su versión, marcado **no
   vendible**, uno por vertical»*; *«**El plan de pre-trial tampoco.** Es un `plan` con su versión,
   marcado **no vendible**, uno por vertical»*; *«**El plan de piso tampoco** … Es un `plan` con su
   versión, marcado **no vendible**, **uno por vertical**»*.
2. **`V/10` §2.1 cuantifica sobre dos.** *«Y las dos versiones no vendibles de cada vertical —la de
   piso y la de pre-trial— son el caso extremo del mismo problema: si la resolución les exigiera
   `vendible`, **nadie tendría nada**, nunca»*, y el cierre: *«Con ese enunciado las **seis** filas
   quedan del lado correcto **sin excepción** … la fuente `SUSCRIPCIÓN`, el grant y las dos versiones
   no vendibles **resuelven lo que alguien tiene**, y ninguna pide `vendible`»*.
3. **La fuente que falta existe y está tabulada en otro capítulo.** *«| `TRIAL_ACTIVE` | **sí** | la
   versión del **plan de trial** | la fecha de fin |»* (`V/03` §2). Es una fuente viva de clase
   `TÍTULO`, y el paso 6 resuelve contra su `referencia` (`12-contrato…` §2.1 y §2.3).
4. **La fila 6 cubre las otras dos y sólo esas**: *«| **una fuente `BASE`, y una fuente de trial en
   `PRE_TRIAL`** | la versión vigente de la de **piso** y la de **pre-trial** de la vertical, **no
   vendibles por construcción** |»* (`V/10` §2). La fuente de trial en `TRIAL_ACTIVE` no está en
   ninguna de las seis: lo verifiqué recorriendo la tabla fila por fila.
5. **Y la regla que el § enuncia la cubriría, si alguien la aplicara**: *«**Una lectura que resuelve
   lo que ALGUIEN TIENE nunca exige `vendible`; una que resuelve lo que SE PUEDE COMPRAR siempre lo
   exige**»*. La resolución de un `TRIAL_ACTIVE` resuelve lo que alguien tiene. **El enunciado es
   correcto y su recuento no la incluye**, que es la forma exacta de defecto que este § existe para
   arreglar (*«El enunciado de arriba se escribió sobre cuatro lectores y **con seis deja de ser
   cierto**»*).
6. **Y el rastro de la tanda declaró esa línea correcta, con el conteo en la mano.** Textual:
   *«**L120 · §2.1** — «las dos no vendibles de cada vertical —la de piso y la de pre-trial— son el
   caso extremo del mismo problema» → sigue correcta: **siguen siendo dos** y siguen siendo el caso
   extremo; la tercera cosa del piso no es comercial y no cambia ese argumento»*
   (`rastro-5836ec219.md` §2). **«Siguen siendo dos» es falso contra `V/02` §2.1 leído hoy**, y es la
   afirmación que sostiene el *«sin excepción»* del §2.1.

**Dónde lo permite el diseño.** Las seis citas. La línea de rastro confunde dos preguntas —*«¿el
arreglo cambió el número?»* (no) y *«¿el número es el correcto?»* (no lo es)— y contesta la primera
para declarar correcta la segunda. Es lo que el §1.3 de las instrucciones pide encontrar: una
justificación que se puede mostrar falsa sola, con archivo y línea.

**Severidad.** `MEDIA` — nadie accede a nada indebido y no se pierde ningún dato: lo que se rompe es
la única regla de lectura de catálogo del programa, sobre el consumidor más poblado que le falta, y
con un *«sin excepción»* escrito encima. Se queda en `MEDIA` y no sube porque el corpus contiene su
propia corrección en dos lugares —`V/03` §2 dice a qué versión apunta la fuente, y el enunciado del
propio §2.1 la resolvería bien si se aplicara— así que el implementador tiene de dónde sacarla si
mira más allá de la tabla.

**¿Es nuevo, o es el arreglo?** **Es `F-8dA1-007` en su tercer tercio, todavía llegando**, y lo nuevo
es la línea de rastro que ahora lo certifica. La tanda **no** creó el hueco; lo que hizo fue pasarle
por encima con una justificación escrita, que es peor que no haberlo mirado: deja registro de que se
lo miró y de que se lo dio por bueno.

**¿Lo habría encontrado el grep?** **Sí, y es lo que agrava la línea de rastro.** El término es *«no
vendible»* / *«las dos»*: `rg -n "no vendible"` sobre `V/02` devuelve las tres declaraciones, una por
párrafo, en el mismo § que `V/10` §2.1 cita como fuente (*«no vendibles por construcción (cap. 02
§2.1)»*). La resolución por aparición **tuvo la línea abierta y la fuente a un clic**.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Está en el rastro y su justificación es falsa.**
Es el desenlace más fuerte del §1.4 y va con su cita exacta: `rastro-5836ec219.md` §2, sección
`V/10-verticales-planes-billing-options.md`, entrada **L120 · §2.1**, la frase *«sigue correcta:
siguen siendo dos»*. **La regla se ejecutó y la resolución estuvo mal.**

---

## Mis siete hallazgos de la 8-bis-4, reejecutados sobre el texto de hoy

No cuentan como hallazgos nuevos. Cada camino se volvió a correr paso por paso sobre el texto
vigente.

| ID | título, en corto | ¿corta? | dónde |
|---|---|---|---|
| `F-8eA1-001` | `PB8` resuelve contra el piso y el piso no otorga reactivar — `CRITICA` | **SÍ, limpio** | cerrado por `afa4590c2` en los cinco lugares: `V/02` §2.1 (lista de tres, con la fila 3 y su párrafo *«La tercera se agrega porque `PB8` la necesita»*), `V/17` §1.2 precisión 1 (*«el otro es el 6»*), `V/17` §2.2 (el blockquote del cruce), `V/03` §9 (la celda de `PB8` y la fila *«con qué la autoriza»* de la tabla comparativa) y `12-contrato…` §2.5 punto 2. **Lo que queda es `F-8fA1-001`**: la fila existe y nada exige que exista |
| `F-8eA1-002` | revocar un grant apaga el addon que el cliente pagaba en la vertical que el grant no ancló | **NO** | llega entero. `B/16` §3.3 sigue con *«no se reanuda la suscripción de complemento vieja y no se compensa»* y con la premisa *«la persona **estuvo cubierta de verdad** todo lo que duró el grant»*, que `B/16` §2.4 y el `12-contrato…` §2.8 siguen desmintiendo para la vertical no anclada (*«En una vertical donde no ancló nada **no emite fuente**»*). `B/19` fila 13 sigue sin distinguir la vertical anclada de la otra, **y la reescribió el commit de `DEC-GRANT-008`** |
| `F-8eA1-003` | las tres frases del grant / `B/19` fila 13 sin la del trial | **NO, y peor** | es `F-8fA1-003` |
| `F-8eA1-004` | `T7` lee *«la transición de publicar»* y su única vertical no publica nada | **NO** | llega entero y ganó una cuarta particularización. `V/03` §2 sigue con *«publicar es una transición de la máquina del §9»*; `V/11` §8.2 sigue con *«Su registro es **el evento de dominio de la transición de publicar**»*; `V/03` §9 punto 1 sigue con *«El evento que `T1` y `T7` miran es «el dueño publica», que es `PB1`»*; y la tabla *«quién / qué le pasa»* de `V/03` §2 encabeza su primera fila con **«ya publicó en esa vertical»**. Contra eso, `V/11` §8.3 paso 1 y `V/18` §1.5 siguen diciendo que para Partner el evento candidato es **la aprobación del admin**, que es `PP2` de la novena máquina |
| `F-8eA1-005` | `PB7` otorga, la dispara el sistema, y `V/03` §9 declara a qué clase NO pertenece sin declarar a cuál sí | **NO, atenuado** | `V/03` §9 punto 3 se reescribió en `5836ec219` y hoy dice *«a `PB7` la disparan **un cambio de cobertura o un cambio de cupo** … **Ninguno de los dos es el reloj**: los dos son el recálculo del conjunto efectivo … que lo dispara un acto —el de la persona o el de billing— y no el paso del tiempo»*. **Sigue declarando sólo a qué clase no pertenece**, contra `V/17` §3.2 regla 3 (*«A qué clase pertenece una operación se declara, nunca se infiere»*), y el *«acto de billing»* que la puede disparar es un webhook, o sea uno de los dos actores no-persona de `V/17` §3.3. Recorrí los **17** guards de `V/20` §2: ninguno vigila una transición del sistema que no sea del reloj |
| `F-8eA1-006` | cuando el cupo no alcanza para todas, nada dice cuáles fichas se publican | **SÍ** | cerrado por `DEC-DATA-003`: `V/03` §9 tiene la sección *«Cuáles vuelven, cuando el cupo no alcanza para todas»* con el criterio (*«vuelve primero la que cayó al final»*), la razón verificable (*«el conjunto que queda publicado depende sólo del cupo y no del camino»*) y el desempate por origen declarado inexistente a propósito; `V/15` §4.3 lo escribe del lado del reconciliador; y `V/19` §4 ganó la **fila 19** del aviso de restitución, con la fila 18 corregida para nombrar el cupo |
| `F-8eA1-007` | `V/02` §4.2 regla 3 decía *«reactivarla suscribiéndose»* — `BAJA` | **SÍ** | la regla 3 dice hoy *«puede **exportarla o reactivarla a borrador sin pagar nada**»* y lleva el párrafo *«**La salida NO es «suscribiéndose», y decirlo así describía una salida más angosta que la que el diseño tiene**»*, con el cierre *«el hard delete del día 180 se defiende con las dos salidas, y para el sujeto del borrado las dos tienen que ser **alcanzables**, no sólo estar escritas»* |

**Tres cortan** (`001`, `006`, `007`) y **cuatro siguen llegando** (`002`, `003`, `004`, `005`). Los
tres que cortaron los cerró la tanda, y los tres por el mismo mecanismo: una decisión del owner más
un commit que la escribió en todos sus consumidores. **De los cuatro que siguen, uno tuvo su celda
abierta por un commit de esta tanda** (`003`).

**Y dos de fases anteriores que siguen llegando y son de este vector**, sin ID nuevo porque ya lo
tienen. `F-8bA1-012` —la dirección inversa del contrato— **corta a medias todavía**: el
`12-contrato…` §4.1 dice *«**siete** campos en tres preguntas»* y `V/02` §2.1 sigue diciendo *«Son
**dos de los seis campos** de la dirección inversa»*. Y `F-8cA1-014` —*«nueve pasos»* sobre una tabla
numerada 1 a 7— **llega entero**: `V/17` §1.1 sigue con *«Quedan **nueve pasos** y una precondición»*,
la tabla del §1.2 sigue con **siete** filas numeradas más la precondición (las conté), el §3.5 sigue
restando *«los otros ocho»* y el párrafo que la tanda agregó en la precisión 1 lo repite: *«no pasa
por el 5 y **sí por los otros ocho**»*.

---

## Ataques que intenté y el diseño resistió

Vale tanto como la lista de arriba: son los caminos que probé sobre el texto nuevo y que cierran.

+ **Usar *«recuperar lo suyo»* para tocar una ficha de otra vertical, aprovechando que el piso lo
  tiene todo el mundo en todas.** Cerrado, y con las dos razones escritas por separado: *«es **por
  vertical**, porque hay una versión de piso por vertical y la resolución es por `user + vertical`;
  y su objeto es **una ficha propia**, que el **paso 4** ya exige antes de llegar al 6»* (`V/17`
  §2.2). Probé entrar por el paso 4 y la precisión 1 lo acota a *«de su dueño»*.
+ **Usar `PB8` para publicar sin pagar, encadenándolo con `PB1` o con `PB3`.** Cerrado por el
  destino de la fila: `PB8` va a `DRAFT`, `PB1` sale de `DRAFT` **y es comercial** (`V/02` §2.1:
  *«publicar sigue siendo `PB1`, que sí es comercial»*), y `PB3` sale de `UNPUBLISHED_BY_BILLING`, no
  de `DRAFT`. La cadena se corta en el paso 6 del acto siguiente.
+ **Quedarme con la ficha de alguien en `PRE_TRIAL` cuyo borrador archivó `PB5`, aprovechando que la
  versión de pre-trial NO otorga *«recuperar lo suyo»*.** Cerrado: la fuente `BASE` es *«la que toda
  persona tiene en toda vertical por el solo hecho de existir»* (`12-contrato…` §2.5) y el conjunto
  plegable de `V/15` §2.6 incluye **`TÍTULO` y `BASE`**, así que el de `PRE_TRIAL` tiene **las dos**
  fuentes y el piso le da la tercera clave. La población de `PB8` que `V/03` §9 declara —*«y el
  borrador que archivó `PB5`»*— sí está cubierta.
+ **Hacer que un `Guest` ejecute `PB8`, dado que el piso también es su conjunto efectivo.** Cerrado
  dos veces: por el paso 4 (una ficha tiene *«exactamente un User dueño»*, `NUCLEO/01` §1.2) y por el
  paso 1. Queda la fricción declarada de `V/15` §5.3 —*«la fricción que esto agrega es un
  registro»*— y no un agujero.
+ **Hacer que un admin use `PB8` sobre la ficha de un cliente para publicársela sin que el cliente
  lo pida.** Cerrado: `PB8` va a `DRAFT` y los pasos 5-7 se evalúan **sobre el sujeto** salvo para
  las doce acciones del `NUCLEO/08` §3, donde `PB8` no está — así que el admin no hereda nada y el
  destino no es público.
+ **Quemarle el trial a alguien anclándole una vertical a un grant sin permiso propio.** Sigue
  cerrado: `NUCLEO/08` §3 mantiene *«otorgar, **anclarle una vertical nueva**, o revocar»* en una
  sola fila con un permiso, y `NUCLEO/04` §2 extiende el §64.30. Lo que queda es que **nadie se lo
  dice a quien firma**, y eso es `F-8fA1-003`.
+ **Contratar una suscripción paga en una vertical que mi grant ya cubre.** Sigue vigilado por la
  tercera comprobación del barrido (`NUCLEO/01` §2.4, fila 17; `B/09` §3), que ahora además tiene
  término definido para su *«ancla viva»* y su inventario propio.
+ **Conservar un addon convertido a $0 después de que me revocaron el grant, volviendo a suscribirme
  el mismo día.** Sigue cerrado por el predicado de `A5` —*«se revoca **el grant del que cuelga el
  ancla que era su título**»*— y ahora por la columna: *«grant vivo»* tiene `revocado_en` y su
  `UNIQUE` parcial (`DEC-GRANT-009`), así que el predicado por fin se puede evaluar.
+ **Tener dos grants vivos y hacer que uno tape la revocación del otro.** Cerrado **por la base** desde
  esta tanda: *«un beneficiario tiene a lo sumo **UN** grant vivo, y lo garantiza la base, no los
  nueve consumidores: `UNIQUE(beneficiario) WHERE revocado_en IS NULL`»* (`NUCLEO/01` §1.5).
+ **Que `S25` me cancele la suscripción y me deje sin salida para la ficha.** Cerrado: el hecho 4 del
  reloj —*«el **fin de servicio** de una vertical discontinuada»*— reinicia `inactiva_desde`
  (`NUCLEO/01` §1.2), y `PB8` sigue disponible contra el piso. Lo que no cierra es la dirección
  contraria, y es `F-8fA1-005`.
+ **Que la segunda rama de `PB7` —el cupo— republique la ficha de alguien que ya no paga.** Cerrado
  por el `desde` y por el cupo mismo: el origen tiene que venir de `PUBLISHED` o de
  `UNPUBLISHED_BY_BILLING`, y el cupo de quien no tiene título sale del piso, que *«no otorga ninguna
  capacidad comercial»*. La rama sólo alcanza a quien sigue cubierto.
+ **Publicar el borrador de alguien que nunca pidió publicarlo, ahora que `PB7` tiene dos eventos.**
  Cerrado explícitamente, y el rastro lo declara para las dos ramas: *«el borrador de `PB5` no es
  candidato ni cuando vuelve la cobertura ni cuando vuelve el cupo»* — lo verifiqué contra `V/03` §9,
  que conserva la condición del origen en la fila de `PB7`.
+ **Hacer que un grant de scope plural alimente una vertical con el plan de otra, entrando por el
  trinquete.** Sigue cerrado en la base (`UNIQUE(permanent_grant_id, vertical)`), en el contrato
  (§2.8) y en `V/15` §2.5, con `G-R2-B` contándolo.
+ **Que un job o un webhook otorgue una cortesía, un grant o un ancla.** `V/17` §3.3 intacto, y
  reforzado por el párrafo de `NUCLEO/08` §3 sobre *«una escritura sin fila»*.
+ **Impersonar al cliente, o acumular roles hasta que el paso 3 deje de filtrar.** `V/17` §3.2 regla
  4 y §4.4, más §64.12, §64.13, `G6` y `G4`: los seis intactos.
+ **Que la marca de conciliación, ahora que es una fila con motivo, deje pasar un acceso al
  levantarse la equivocada.** Fuera de mi vector en su daño (es plata), pero el mecanismo cierra: el
  §2.5 del `NUCLEO/01` define *«marca abierta»* con inventario y `G-R1-F`, y `S15` sale de
  *«cualquiera con **una** marca abierta»*.

---

## Líneas de rastro que ataqué

**Revisé 212 líneas** de los diez rastros —las **187** del §2 de `rastro-5836ec219.md`, leídas una
por una de punta a punta, más **25** entradas elegidas de `rastro-8d6b27a12.md` (§2 sobre
`NUCLEO/08`, `B/10` y `B/19`, más sus §5 y §6), `rastro-ce52dce5f.md` (las cinco de `DEC-TRIAL-009` y
`DEC-GRANT-006`), `rastro-7676082e6.md` (las cuatro sobre el piso y el contrato) y
`rastro-12cc0879f.md` / `rastro-40b922120.md` (los conteos de guards)—. **De ésas verifiqué 51 contra
el texto del capítulo citado**, no contra el rastro.

**Por qué ésas.** `rastro-5836ec219.md` entero porque es el rastro de la familia que cerró mi
`CRITICA` y el único que toca los cinco capítulos de mi vector (`V/02`, `V/03`, `V/15`, `V/17`,
`V/20`). Los otros cuatro por muestreo dirigido a mis términos: *«piso»*, *«recuperar lo suyo»*,
`G-R3`, *«clave comercial»*, *«versión no vendible»*, `PB8`, `trial`. **No** ataqué
`rastro-032f761e0.md`, `rastro-f21d5d828.md` ni `rastro-31ce26bb2.md` más allá de un grep: sus
sujetos son la baja, la sucesión y la lista de `inactiva_desde`, y las apariciones de mis términos
ahí son homónimos declarados. Eso es una elección, no una medición: **si alguien quiere saber cuántas
falsas hay en esos tres, hay que mirarlos.**

**Resultado: 2 falsas, 1 verdadera que resuelve una pregunta más angosta que la aparición que
declara, y 2 que presuponen resuelto lo que no está escrito.**

| rastro · entrada | qué afirma | veredicto |
|---|---|---|
| `5836ec219` · `V/10` **L120 · §2.1** | *«las dos no vendibles de cada vertical» → sigue correcta: **siguen siendo dos***» | **FALSA.** `V/02` §2.1 declara **tres** planes marcados *«no vendible»* por vertical —trial, pre-trial y piso—, en tres párrafos consecutivos. Es `F-8fA1-006` |
| `5836ec219` · `11-particion` **L127 y L132 · §3.1** | *«la dirección nueva se dispara con **la misma lista de siete entradas**, así que no agrega ningún punto de invocación»* | **FALSA en su número.** Conté la tabla de `V/02` §3.2 el 2026-09-22: **diez** filas, siete originales más tres que el propio § declara *«de la FASE 9»*. La conclusión que la línea sostiene puede seguir siendo cierta; el dato con que la sostiene no lo es. (El defecto de fondo es `F-8eA3-…` de la 8-bis-4, no mío) |
| `8d6b27a12` · `B/10` **L218-221 · §4.4** | *«la pausada … **no está recibiendo servicio, está pausada***» | **FALSA para uno de los dos motivos.** `PAUSED` por `COURTESY` **sí emite fuente**, como `tipo: CORTESÍA` (`12-contrato…` §2.6), y `S25` sale de *«`PAUSED` con **cualquiera de los dos motivos**»*. Es el paso 8 de `F-8fA1-005` |
| `8d6b27a12` · `NUCLEO/08` **L200-205 · §3** | *«sigue correcta: la fila 13 es del §4, y es la que el commit de `DEC-GRANT-008` amplió para que pida el motivo»* | **verdadera y angosta.** La referencia cruzada sigue apuntando bien; la línea nombra el commit que reescribió la celda sin preguntarse si la completó. Es el paso 3 de `F-8fA1-003` |
| `5836ec219` · `V/02` **L210 · §2.1** y `V/20` **L59 · §2** | *«*«recuperar lo suyo»***no es** una clave comercial ni un entitlement medido»* | **verdaderas bajo un criterio que el corpus no tiene.** Aplican la clasificación *«clase comercial»*, que no está definida en ningún capítulo ni es un atributo del catálogo de claves. Es `F-8fA1-002` |

**Y una sección de rastro que verifiqué y está bien.** `rastro-5836ec219.md` §3 declara **tres**
apariciones que el recorrido encontró falsas y corrigió en `5836ec219`; verifiqué la tercera —`V/03`
§9 punto 3, *«a `PB7` la dispara un cambio de cobertura»* → hoy *«la disparan un cambio de cobertura
o un cambio de cupo … Ninguno de los dos es el reloj»*— contra el texto y **está corregida tal como
lo declara**. Es la auto-corrección documentada funcionando; lo que la corrección no arregló es la
mitad que `F-8eA1-005` reporta desde la vuelta pasada, que no es lo que ese § prometía arreglar.

---

## Fuera de mi vector

Lo que vi y le toca a otro. No lo perseguí.

+ **Costura (`C1`).** `HOS-1353/spec.md` línea 61 ya dice *«diecisiete guards»* y coincide con lo que
  conté en `V/20` §2. Pero la línea 303 del mismo archivo sigue diciendo *«**Siete guards con id
  propio de esta épica** —`G1`-`G6` y `G8`—»*, y `G-R2`, `G-R2-B`, `G-R3`, `G-R3-B`, `G-R3-C` y
  `G-R6-B` salen los seis de capítulos de esta épica y tienen id propio. La brecha se cerró en un
  renglón y sigue abierta en el otro.
+ **Costura (`C1`).** El `12-contrato…` §2.4 sigue diciendo *«Las **tres** combinaciones imposibles lo
  son por una razón escrita»* sobre una tabla 6 × 4 en la que conté **dos** celdas marcadas
  *«imposible»*. Es `F-8cA1-010`, sin moverse.
+ **Costura (`C1`) / `NUCLEO`.** `V/02` §3.2 dice *«Las **cuatro** últimas son de la FASE 9»* sobre
  **tres** filas nuevas (las conté: piso/pre-trial, plan con grants anclados, `addon_version`). El
  commit que escribió la frase (`2a3f47d606`) agregó **dos**; el mensaje habla de *«las cuatro fuentes
  nuevas»*, y la fila del piso/pre-trial cuenta dos fuentes en un renglón. El número describe fuentes
  y la frase dice *«filas»*.
+ **Datos (`A3`).** El hecho 1 de reinicio de la inactividad incluye **`exportarla`**, y desde esta
  tanda **exportar lo otorga el piso a todo el mundo** (`V/02` §2.1, fila 3): un dueño sin título
  puede posponer el hard delete del día 180 indefinidamente con una lectura cada 179 días, y ahora
  tiene el entitlement escrito para hacerlo. El agujero era mío en la vuelta pasada por el lado
  contrario; ahora es un reloj de retención que su propio sujeto reinicia sin actuar sobre el dato.
+ **Máquinas (`A2`).** Quién guarda el valor anterior de `cubierto` para detectar *«el cambio»* que
  disparan `PB2`, `PB3` y `PB7` sigue sin estar escrito, y con la segunda rama de `PB3`/`PB7` ahora
  hace falta además el valor anterior **del cupo**.
+ **Máquinas (`A2`).** La pregunta 3 de `rastro-8d6b27a12.md` §6 —*«el acto de la discontinuación
  sigue sin fila numerada, y no sólo para `PAUSED`»*— sigue sin contestar. La tomé sólo por su mitad
  de acceso (`F-8fA1-005`); la mitad de máquina —qué transición ejecuta el movimiento desde `ACTIVE`,
  `GRACE_PERIOD`, `SUSPENDED` y `PENDING_AUTHORIZATION`— es de `A2`.
+ **Billing (`B1`/`B3`).** La misma pregunta 3, por su mitad de cobro: una fila `ACTIVE` que nadie
  mueve conserva su preapproval después del día 0 del anuncio, contra el §4.2 de `B/10` (*«se deja de
  cobrar antes de dejar de prestar»*).
+ **Billing (`B1`/`B3`).** La pregunta 2 del mismo § —el saldo de cortesía que `DEC-GRANT-010` difiere
  sobre una vertical que *«queda cerrada a altas para siempre»*, así que su re-emisión no llega
  nunca— está **declarada con causa** y no la reporto; lo anoto porque la declaración es del owner y
  conviene que se vea que la leí.

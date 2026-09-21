---
title: "FASE 8-bis-4 · A2 — máquinas de estado, carreras y huérfanos"
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 8
---

# FASE 8-bis-4 · A2 — máquinas de estado, carreras y huérfanos

Quinta pasada adversarial A2. Vector: transiciones que faltan, transiciones que nadie dispara,
transiciones que se pisan, estados sin salida, relojes sin dueño, efectos huérfanos, carreras, y
**el eje del tiempo** —qué pasa el día que la configuración cambie—, que la vuelta anterior midió
como el único modo que ninguna búsqueda de texto encuentra.

**Once hallazgos: 2 `CRITICA`, 6 `ALTA`, 2 `MEDIA`, 1 `BAJA`.**

**Atribución: 10 de 11 los introdujo —o los volvió alcanzables— un arreglo o una decisión de la
9-bis-3. De los 2 `CRITICA`, 2 de 2.**

**Dónde falla `DEC-METH-010`, en una línea.** La enmienda manda recorrer **todo el corpus por
párrafo** y resolver por aparición **lo que el commit no tocó**. Medido sobre mis once: **tres**
caen exactamente adentro de lo que la obligación 2 manda escribir y no se escribieron —o sea, la
enmienda alcanzaba y no se ejecutó—; **seis** viven **adentro de un párrafo que el propio commit
escribió**, que es el conjunto que la obligación 2 excluye por definición; y **dos** son
**ausencias** —una idempotencia que no se declaró, un paso que falta en una lista de tres—, que
ninguna búsqueda de texto puede encontrar porque no hay cadena que buscar. **La proporción se dio
vuelta respecto de la vuelta anterior**: entonces el problema era que el grep no llegaba, ahora es
que la resolución por aparición **no mira adentro del commit**, y ahí vive la mayoría.

**Y hay una fuga nueva de la obligación 4**, la condicional: manda que *«cada término que EL
NÚCLEO define lleva su lista de consumidores»*. `T6` y `T1` los define **`V/03` §2**, no el
núcleo; `fe7d14914` le creó a `T6` un consumidor nuevo en `V/11` §2.4 que dice de él algo que `T6`
no hace, y la obligación 4 **no lo cubre por su propio enunciado** (`F-8eA2-007`).

Los paths se abrevian como en los documentos anteriores: `NUCLEO` es `HOS-1352-…/docs/nucleo/`,
`V` es `HOS-1353-verticales-capacidades-y-autorizacion/docs/`, `B` es
`HOS-1354-billing-cobro-y-proveedor/docs/`, y lo que no lleva prefijo es `HOS-1352-…/docs/`.

**Lo que medí yo, y dónde.** Todo sale de contar sobre el worktree
`/home/qazuor/projects/WEBS/hospeda-spec-hos-1352-billing-redesign`, el 2026-09-21, con `rg`,
`awk` y `git blame`:

| qué conté | resultado |
|---|---|
| tablas de transiciones en el corpus (encabezado `\| # \| desde \| evento`) | **7**: 3 en `V/03` (§2, §9, §11) y 4 en `B/03` (§3.2, §6, §7, §8) |
| filas de la tabla de invalidación de `V/02` §3.2 | **10** (el § dice *«las cuatro últimas»* y *«las siete de arriba»*, que suman 11) |
| apariciones de la cadena `retiro de un ancla` en el corpus | **1**: `B/09` §3, línea 349 |
| archivos que nombran `T7` | **7**; **`V/15`, `V/17` y `V/20` no están entre ellos** |
| archivos que nombran `PB7` / `PB8` | **11 / 8**; **`V/20` no está en ninguna de las dos** |
| commits de la tanda que tocan `B/09` | **6** de 11 (`f4edbdfdf`, `4e383480d`, `a85f5bb7e`, `6bac7e63a`, `456563988`, `1c17565e1`) |
| autor de la fila `PB3` y del párrafo del excedente en `V/03` §9 | `2a3f47d606` (2026-09-19, 9-bis-2) — **`621332e7c` no los tocó** |

**No medí nada contra el proveedor**: donde hablo de Mercado Pago cito la medición que el capítulo
ya trae, con su identificador (`PS-4`, `PA-3`, `PA-5`, `EX-15`).

---

## 1. Los hallazgos

### CRITICA

### F-8eA2-001 — El excedente tras un downgrade no tiene camino de vuelta: `PB2` lo declara como causa propia *«que no cambia `cubierto`»* y `PB3` y `PB7` sólo salen por el CAMBIO de `cubierto`. El que vuelve a subir de plan paga el grande y sus fichas no se republican nunca

**Qué se rompe.** Un anfitrión con cinco fichas baja de Premium a Básico. El reconciliador de
excedentes le despublica tres. Tres meses después vuelve a Premium y paga el precio entero.
**Sus tres fichas no vuelven, y no hay ninguna transición que las pueda devolver**: `PB3` y `PB7`
exigen que `cubierto` **pase** a verdadero, y sobre alguien que estuvo cubierto todo el tiempo no
hay cambio que disparar. Las tres siguen en `UNPUBLISHED_BY_BILLING`, desde donde **no sale
ninguna otra fila** salvo el reloj: día 90 `PB4` las archiva, día 180 el hard delete les borra el
contenido. Paga Premium y recibe Básico, indefinidamente, sin que nada lo señale.

**El camino.**

1. `V/03` §9, fila `PB2`: *«| PB2 | `PUBLISHED` | **`cubierto` pasa a falso** |
   `UNPUBLISHED_BY_BILLING` | **o el excedente tras un downgrade, que no cambia `cubierto` y sí el
   cupo** |»*. El evento de `PB2` es **una disyunción de dos**, y la segunda rama está declarada
   con todas las letras como la que **no** toca `cubierto`.
2. `V/03` §9, fila `PB3`: *«| PB3 | `UNPUBLISHED_BY_BILLING` | **`cubierto` pasa a verdadero** |
   `PUBLISHED` | y el cupo alcanza |»*. **No es una disyunción**: el evento es uno solo, y es el
   que la segunda rama de `PB2` acaba de declarar que no ocurre.
3. `PB7` copia la asimetría un estado más atrás: *«| **PB7** | `ARCHIVED` | **`cubierto` pasa a
   verdadero** | `PUBLISHED` | y el cupo alcanza, **y el evento que la archivó dice que venía de
   `PUBLISHED` o de `UNPUBLISHED_BY_BILLING`** |»*.
4. **El § lo dice y lee el resultado al revés.** *«**Y el excedente queda como la única causa
   enumerada**, porque es la que **no** cambia `cubierto`: la persona sigue cubierta y lo que no le
   alcanza es el cupo. **Por eso `PB3` pide las dos cosas.**»* Pedir *«las dos cosas»* —el cambio
   de `cubierto` **y** el cupo— es exactamente lo que deja la rama del excedente sin vuelta: para
   que sirviera, `PB3` tendría que salir también por *«el cupo vuelve a alcanzar»*, que es el
   simétrico de la rama que `PB2` sí tiene. La frase que reconoce la asimetría es la misma que la
   declara resuelta.
5. **Y el camino de vuelta por el que se subiría de plan tampoco cambia `cubierto`.** Un upgrade es
   una sucesión: la predecesora `ACTIVE` **emite** hasta que `S17` la mata, la sucesora empieza a
   emitir con `S2` (`12-contrato…` §2.6), así que en el camino normal `cubierto` **es verdadero de
   punta a punta** y nunca *«pasa a»* nada.
6. **El reconciliador tampoco lo levanta, por su propia definición.** `V/15` §4.2: *«se dispara
   cuando el conjunto efectivo de un `user + vertical` se recalcula, y **actúa sólo si algo
   bajó**»*. Al volver a Premium el conjunto **sube**, así que no actúa. No existe en ningún
   capítulo un reconciliador de lo que falta.
7. **Desde `UNPUBLISHED_BY_BILLING` no sale ninguna otra transición**, y el capítulo lo sabe:
   *«tampoco podía sacarla a mano, porque `PB1` sale sólo de `DRAFT`»*. Las únicas salidas del
   estado son `PB3` (que no dispara) y `PB4` (el reloj). **No hay `UNPUBLISHED_BY_BILLING` →
   `DRAFT`.**
8. **Entonces el reloj corre, y corre sobre la definición nueva.** *«Inactividad = el tiempo que
   lleva **sin estar a la vez publicada y cubierta**»* (`NUCLEO/01` §1.2). La ficha del excedente
   no está publicada, así que acumula. De los cuatro hechos que la reinician, el 2 (*«`cubierto`
   pasa a verdadero»*) no ocurre nunca por lo de arriba, el 3 (*«vuelve a `PUBLISHED`»*) tampoco,
   el 4 es el fin de servicio de una vertical y el 1 es **un acto del dueño sobre la ficha** —que
   un dueño no tiene motivo para hacer sobre una ficha que no ve—.
9. Día 90: `PB4`, cuyo `desde` incluye `UNPUBLISHED_BY_BILLING`. Día 180: `V/02` §4.1, *«Se borra
   al día 180: el contenido publicable de la ficha (textos, fotos, FAQ, horarios), los
   borradores»*. **Es el contenido de un cliente que paga el plan más caro.**
10. **La única salida que existe aparece recién el día 90 y hay que descubrirla.** `PB8` —*«el
    dueño la reactiva»*, `ARCHIVED` → `DRAFT`— más `PB1`. O sea: el cliente que subió de plan tiene
    que esperar tres meses a que se le archive la ficha para poder recuperarla a mano en dos pasos.
    `V/19` fila 18 escribe ese aviso para el caso de la cobertura —*«que **vuelve sola cuando
    recupere la cobertura** (`PB7`)»*—, que es justo lo que a éste no le va a pasar.

**Dónde lo permite el diseño.**

- `V/03-maquinas-de-estado.md` §9, las filas `PB2`, `PB3`, `PB4`, `PB7`, `PB8`, y el párrafo *«Y el
  excedente queda como la única causa enumerada … Por eso `PB3` pide las dos cosas»*.
- `V/15-entitlements-y-limits.md` §4.2 (*«actúa sólo si algo bajó»*) y §4.3.
- `NUCLEO/01-glosario.md` §1.2, la definición de inactividad y los cuatro hechos.
- `V/02-modelo-de-datos.md` §4.1, qué se borra al día 180; §4.2 regla 3 y regla 4.
- `12-contrato-de-cobertura.md` §2.6, `ACTIVE` y `PENDING_AUTHORIZATION`.
- `V/19-superficies.md` fila 18.

**Severidad.** `CRITICA`. **Alguien paga de más**: el precio del plan grande contra la visibilidad
del chico, sin ninguna transición que lo corrija y sin nada que lo detecte —verticales no tiene
barrido (`F-8A2-005`, abierto)—. Y termina en **un dato que se pierde**: el hard delete del día
180 sobre el contenido de un cliente al día. Lo que acota el daño, y hay que decirlo, es que los
**tres avisos transaccionales no suprimibles** de `V/02` §4.2 regla 3 salen igual, y que `PB8`
existe desde la 9-bis-3 — pero los dos llegan el día 90 o después, y ninguno de los dos está
escrito para este caso: el aviso de la fila 18 de `V/19` le promete al dueño que *«vuelve sola
cuando recupere la cobertura»*, que es la frase que sobre este cliente no se cumple.

**¿Es nuevo, o es el arreglo?** **La mitad vieja es del arreglo 9 de la 9-bis-2 y la 9-bis-3 la
volvió terminal.** El arreglo **9** (`2a3f47d606`, medido con `git blame`) cambió `PB2`/`PB3` de
una lista congelada al cambio de `cubierto` —es el arreglo correcto para el caso que venía a
cerrar, `F-8bA2-003`— y **partió el evento de `PB2` en dos ramas sin partir el de `PB3`**. Hasta
la 9-bis-3 eso costaba una ficha abajo; lo que agregó `DEC-DATA-002` (`621332e7c`) es **el otro
extremo del reloj**: definió la inactividad, le puso a `PB4` un `desde` que incluye
`UNPUBLISHED_BY_BILLING` leído contra ella, escribió `PB7` **copiando la condición de `PB3`
palabra por palabra**, y declaró la vuelta resuelta —*«la ficha se archiva, sí, pero **vuelve sola
por `PB7`** y **nunca se borra**»*, en el propio `DEC-DATA-002`—. La frase es verdadera para el que
perdió cobertura y falsa para el del excedente, que es la otra mitad del `desde` de `PB4`.

**¿Lo habría encontrado el grep?** **Sí, sin esfuerzo.** El término que `DEC-DATA-002` redefine es
**«inactividad»**, y el que se apoya en él es **`cubierto` pasando a verdadero** (hecho 2 de la
lista cerrada). Un `rg 'cubierto'` sobre `V/03` §9 devuelve **las tres filas en la misma tabla**
—`PB2`, `PB3` y `PB7`— y la asimetría se ve de un vistazo: una tiene dos ramas y las otras dos
tienen una. El commit **sí tocó `V/03`**.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí, y es el caso más limpio del informe.**
La aparición vive en la fila `PB3` y en el párrafo del excedente, y `git blame` dice que las dos
las escribió `2a3f47d606` y que **`621332e7c` no las tocó**: son, literalmente, *«una aparición no
corregida en un párrafo que el commit no tocó»*, dentro de un archivo que el commit sí abrió — el
caso que la obligación 1 agregó al alcance (*«un archivo abierto no es un párrafo leído»*) y que
la obligación 2 manda justificar por escrito. **La enmienda alcanzaba y no se ejecutó.** Y el
commit que la dejó pasar es uno de los **seis que no reportan ninguna cifra de apariciones**
(§2.3 de las instrucciones).

---

### F-8eA2-002 — `S10` no tiene rama de fallo y es la única que puede reiniciar el reloj: una pausa cuya reanudación no ocurre no la ve nadie —el barrido compara `PAUSED` contra `paused` y coinciden—, y `D16` sigue en verde porque compara números de catálogo, no el tiempo real de la fila

**Qué se rompe.** Un cliente pausa cuatro meses. El día 120 nuestro reloj tiene que mandar
`PUT status=authorized` y llevarlo a `ACTIVE`. **Si esa llamada no se aplica, no pasa
absolutamente nada**: no hay transición declarada para una pausa vencida que no reanudó, así que
la fila se queda `PAUSED`, `cubierto` sigue falso, el reloj de inactividad **no se reinicia** —su
único hecho aplicable es `cubierto` pasando a verdadero— y sigue corriendo hacia el día 180. El
barrido del cap. 09 no lo ve porque nuestro estado y el del proveedor **coinciden**: los dos dicen
`paused`. `D16` y su guard siguen en verde, porque comparan **el tope que declara el catálogo**
contra el día del hard delete, no el tiempo que lleva una fila. Al día 180 se le borra el contenido
a un cliente que no canceló nada y que usó una función que le vendimos — que es, con esas palabras,
el defecto que `DEC-DATA-002` existe para cerrar.

**El camino.**

1. `B/03` §5: *«| **quién la termina** | **nuestro reloj**. Está medido que el proveedor **no tiene
   auto-reanudación** (`PS-4`) |»*. No hay segunda vía: si el reloj no corre, nadie reanuda.
2. `B/03` §3.2, `S10`: *«| S10 | `PAUSED` | llega el fin, o la persona vuelve antes | `ACTIVE` | —
   | `PUT status=authorized`; al reanudar se le muestra **una sola cosa: qué día se le cobra** |»*.
   **Columna de condición vacía y ningún desenlace escrito para la llamada que falla.**
3. **La asimetría con su gemela es lo que lo vuelve un defecto y no una omisión pareja.** La otra
   transición del corpus cuyo efecto es una llamada al proveedor que puede fallar —`S17`— **sí**
   tiene rama declarada: *«La única rama en la que la sucesión NO se cierra es que la cancelación
   en el proveedor falle sobre un preapproval que la relectura vio vivo. Ahí `S17` no ocurre, `S18`
   tampoco … **la marca se pone y una persona lo mira**»* (`B/03` §3.2). Y `S13` tiene su propio
   párrafo explicando por qué **no** necesita una (*«tiene que ocurrir igual»*) más la salvedad 4
   del barrido. `S10` no tiene ni lo uno ni lo otro.
4. **Por la regla 1 del núcleo, el intento fallido no se ejecuta**: *«Un intento de transición que
   la tabla no declara **no se ejecuta**: se registra como evento de dominio y, si tocaba plata o
   estado, pone la marca»* (`NUCLEO/03` §1). Pero acá la transición **sí** está declarada y lo que
   falta es su rama de fallo, así que lo más probable es lo contrario: el job reintenta o no, y la
   fila se queda donde estaba **sin marca**.
5. **El barrido es ciego a este estado, por su propio mecanismo.** `B/09` §3 compara *«estado |
   el del proveedor, leído por id»*, y el estado del proveedor es `paused` —`PS-4` mide que no se
   reanuda solo—, así que los dos lados dicen lo mismo. Ninguna de las cinco comparaciones lo ve, y
   ninguna de las **cuatro** comprobaciones de cero llamadas lo busca: la 1 mira `sucede_a`, la 2 el
   pago pendiente de `S19`, la 3 el ancla de un grant y la 4 una instancia de addon. **Ninguna mira
   una fila `PAUSED` cuya fecha de fin ya pasó.** Es exactamente la forma que el propio §3 describe
   dos veces —*«la fila está `ACTIVE`, el proveedor dice `authorized`, y para el barrido eso
   **coincide**»*— aplicada a un estado en que nadie la buscó.
6. **Y el reloj de verticales sigue corriendo sin enterarse, por decisión.** `NUCLEO/01` §1.2: *«la
   pausa no aparece en la lista de arriba … Verticales no sabe —ni puede saber: el §4 del contrato y
   `DEC-TRIAL-008`— que detrás de la pérdida de cobertura hay una pausa y no una baja»*. Día 90:
   `PB4` archiva. Día 180: hard delete.
7. **`D16` no lo acota, y su propio enunciado dice por qué.** `NUCLEO/04` §3: *«El tope de una
   pausa, **en días**, es menor que el día del hard delete … **Las dos cifras son configuración**,
   así que el invariante es la relación entre ellas y nunca los números»*. Es una relación entre
   **dos valores del catálogo**. El tiempo que una fila concreta lleva en `PAUSED` no es ninguno de
   los dos, y nada lo compara contra nada.
8. `DEC-DATA-002` apoya el resultado entero en esa aritmética: *«El daño residual es **cero**, y por
   una razón aritmética: el tope de una pausa son 4 pausas-mes ≈ 120 días contra los 180 del hard
   delete, y **cada reanudación reinicia**»*. **La premisa de la segunda mitad es que la reanudación
   ocurre.** Es la única de las dos que depende de que un job corra, y es la que no tiene rama.

**Dónde lo permite el diseño.**

- `B/03-maquinas-de-estado.md` §3.2, fila `S10` y la rama de fallo declarada de `S17`; §5, *«quién
  la termina: nuestro reloj»* y el párrafo de `D16`/`G-R5`.
- `B/09-conciliacion.md` §3, la tabla de las cinco comparaciones y las cuatro comprobaciones de
  cero llamadas.
- `NUCLEO/01-glosario.md` §1.2, los cuatro hechos de reinicio y *«la pausa no aparece en la lista»*.
- `NUCLEO/03-maquinas-de-estado.md` §1, regla 1.
- `NUCLEO/04-invariantes.md` §3, `D16`.
- `V/02-modelo-de-datos.md` §4.1 y §4.2 reglas 3 y 4; `V/03` §9, `PB4`.

**Severidad.** `CRITICA`. **Un dato se pierde**: el contenido publicable de un cliente al día, por
el hard delete del día 180, sobre el camino que el owner describió con la frase *«la pausa fue
deliberada, así que no le podemos borrar la ficha por algo que le dijimos que podía hacer»*. Y hay
una segunda pérdida antes: el cliente está **sin servicio y sin cobro** desde el día 120, sin que
nada lo detecte. Lo que acota el daño son los tres avisos de `V/02` §4.2 regla 3 —que salen igual,
porque cuelgan del reloj y no del estado de la suscripción— y `PB8`: el dueño puede reactivar a
`DRAFT` y exportar. No alcanza para bajarlo: los tres avisos le dicen que su ficha está archivada
por inactividad, no que su pausa no reanudó, y el instrumento que le arregla el problema real —la
suscripción— no está en ninguno de los tres.

**¿Es nuevo, o es el arreglo?** **`S10` no tuvo rama de fallo nunca; lo que la 9-bis-3 cambió es
que esa ausencia pasó a sostener sola una garantía.** Antes de `DEC-DATA-002` el contenido de quien
pausaba se borraba **de todos modos** —ése era `F-8cC1-001`, el `CRITICA` que la decisión cerró—,
así que la reanudación no cargaba con nada. `DEC-DATA-002` (`621332e7c`) construyó la garantía
entera sobre **dos** piezas: la desigualdad 120 < 180, que ahora tiene invariante y guard, y *«cada
reanudación reinicia»*, que **no tiene ninguna de las dos**. De las dos premisas, se le puso
vigilancia a la que no depende de que nada corra.

**¿Lo habría encontrado el grep?** **No, y es la fuga estructural otra vez, por el lado del
sujeto.** El término que `DEC-DATA-002` redefine es **«inactividad»** y los que introduce son
**`D16`**, **`G-R5`**, **`PB7`** y **`PB8`**. La fila `S10` no contiene ninguno de los cuatro: su
celda entera es *«llega el fin, o la persona vuelve antes | `ACTIVE` | — | `PUT
status=authorized`»*. Un grep de cualquiera de los cuatro sobre `B/03` §3.2 devuelve cero sobre esa
fila. **El capítulo que se rompe es el que nunca nombró el término**, igual que `V/11` en
`F-8dA2-002`.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y hay que decir por qué con precisión.**
El párrafo de `B/03` §5 que enuncia la garantía —*«lo que protege al cliente … son dos cosas:
`PB7` republica la ficha sola **cuando la cobertura vuelve al reanudar**, y el tope de una pausa es
menor que el día del hard delete»*— **lo escribió `621332e7c`**, verificado con `git blame`. La
obligación 2 manda escribir las apariciones *«que no se corrigen **y están en un párrafo que el
commit no tocó**»*, así que ésta queda **explícitamente afuera del alcance**. El defecto no es una
aparición vieja mal resuelta: es una **premisa nueva que el commit escribió y no recorrió**, y esa
clase la enmienda no la mira por construcción. Es la misma familia que `F-8dA2-005` y `F-8dA2-008`
de la vuelta anterior, y ya van **tres vueltas** con ella.

---

### ALTA

### F-8eA2-003 — `T7` es un fan-out sobre una cohorte entera y no declara idempotencia, ni reanudabilidad, ni detector, en la misma tanda en que su gemela `S13` recibió las tres; y `V/11` §8.3 le exige ventana cero

**Qué se rompe.** El día del encendido de una vertical hay que ejecutar `T7` sobre **todo el que
está en `PRE_TRIAL` habiendo ya ejercido el evento de activación**, y `V/11` §8.3 declara que
*«la ventana tiene que ser **cero**: los tres pasos son **un solo acto**, no tres tareas»*. Si esa
corrida muere a la mitad —y es un recorrido sobre una cohorte, o sea la clase de proceso que más
se corta—, **la mitad que quedó sin resolver se queda en `PRE_TRIAL` con los días ya encendidos**,
que es exactamente el estado que `T7` existe para impedir: publican y se llevan `T1`, con las
capacidades del plan vendible de `rank` más alto. Nada lo detecta: `T7` no declara ser idempotente,
no declara ser reanudable fila por fila, **ningún guard del catálogo de `V/20` la nombra** y
verticales no tiene barrido.

**El camino.**

1. `V/03` §2, `T7`: *«| T7 | `PRE_TRIAL` | **el encendido: la vertical pasa los días de trial de su
   plan de trial de 0 a > 0** | `TRIAL_CONVERTED` | la persona **ya ejerció el hecho que la
   vertical declara como evento de activación** … | **crea la fila de `trial`, consumida**, sin
   reloj y sin campaña |»*. La celda de efectos dice qué escribe y nada sobre cómo se reanuda.
2. `V/11` §8.2 declara el sujeto en plural: *«el mismo acto escribe la fila de `trial` CONSUMIDA
   **para todo el que está en `PRE_TRIAL` en esa vertical** y ya ejerció el hecho …»*. Y §8.1 dice
   que el sujeto *«no es una fila: el sujeto es una **cohorte**»*.
3. `V/11` §8.3, paso 3: *«**ejecutar `T7` sobre la cohorte** | entre el paso 2 y éste, cualquier
   ex-cliente que publique se lleva un trial completo. La ventana tiene que ser **cero**»*. Una
   ventana declarada en cero sobre un recorrido de N filas **es una promesa sobre una corrida**, y
   una corrida se corta.
4. **La gemela del otro lado recibió las tres piezas en esta misma tanda, y eso es lo que vuelve
   visible la diferencia.** `S13` —el otro fan-out del corpus, también sobre *«toda fila viva
   PRINCIPAL del beneficiario en **cada vertical que el acto ancla**»*— declara textualmente:
   *«**Proceso idempotente y reanudable fila por fila**, con su detector en `B/09` §3»*. Y `S20`
   repite la misma frase. El detector es la tercera comprobación de cero llamadas, que `B/09` §3
   escribe con su justificación completa (*«Es el detector de un racimo, no de un caso»*).
5. **Y la razón por la que `S13` la necesitaba vale igual para `T7`.** `B/09` §3: *«Hace falta
   porque ése es, con esas palabras, el estado que el diseño declara indetectable»*. En `T7` el
   estado que queda es **una fila en `PRE_TRIAL`**, que es *«el estado más poblado del sistema»*
   (`V/03` §2): no se distingue de las decenas de miles de filas legítimas que también están ahí.
   Distinguirla pide releer el registro append-only de eventos de dominio por cada una, que es la
   consulta que `T7` ya hace una vez y nadie vuelve a hacer.
6. **La idempotencia tampoco es gratis por construcción, aunque lo parezca.** El argumento fácil es
   que la fila de `trial` es `UNIQUE(user_id, vertical)` (`V/02` §2.2), así que un segundo intento
   choca contra la base. Es cierto y **no alcanza**: lo que choca es el `INSERT`, y el efecto de
   `T7` es *«crea la fila»* **más** la salida de `PRE_TRIAL`. Una segunda corrida sobre quien ya
   está en `TRIAL_CONVERTED` no encuentra sujeto —el `desde` no matchea— y eso está bien; lo que
   nadie declara es qué hace una corrida que aborta **entre** las dos escrituras, ni si el acto es
   una transacción por fila o una por cohorte. `S13` lo dice en cinco palabras y `T7` no lo dice.
7. `V/11` §8.4 agrava el alcance: *«**Toda vertical que nazca con los días en cero hereda este §**,
   no sólo Partner»*. No es una corrida única en la vida del sistema.

**Dónde lo permite el diseño.**

- `V/03-maquinas-de-estado.md` §2, la fila `T7` y el recuadro *«El encendido de una vertical
  resuelve, en el acto, a todo el que quedó en `PRE_TRIAL` …»*.
- `V/11-trial.md` §8.1, §8.2, §8.3 (el paso 3 y *«la ventana tiene que ser cero»*) y §8.4.
- `B/03-maquinas-de-estado.md` §3.2, filas `S13` y `S20` (*«Proceso idempotente y reanudable fila
  por fila, con su detector en `B/09` §3»*).
- `B/09-conciliacion.md` §3, la tercera comprobación de cero llamadas y su justificación.
- `V/20-testing.md` §2, el catálogo entero: **no nombra `T7`** (lo conté con `rg`).

**Severidad.** `ALTA`. La mitad de la cohorte que quedó sin resolver se lleva **el activo más caro
que el diseño regala una sola vez en la vida**, que es el desenlace que `F-8dA2-002` midió como
`CRITICA`. No lo pongo en `CRITICA` porque el desenlace **no está garantizado**: hace falta que la
corrida se corte, y el acto lo ejecuta una persona que está mirando el encendido y que puede
volver a lanzarlo. Lo que está roto es que **nada lo obliga ni lo detecta**, y que la tanda que
escribió `T7` le dio a su gemela exactamente eso.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 2 de la 9-bis-3** (`1e3c3fc9e`), que es
el commit que escribió `T7` y `V/11` §8 completos. No existía nada antes.

**¿Lo habría encontrado el grep?** **No, porque no hay cadena que buscar.** El término nuevo es
**`T7`** y el viejo no existe —`T7` no reemplaza nada—. Lo que falta es **una ausencia**:
`idempotente`, `reanudable` y `detector` son palabras que no están. Un grep de `T7` devuelve las
siete apariciones y todas son correctas; un grep de `idempotente` devuelve `S13`, `S20`, `S21` y
`S12`, y **ninguna búsqueda le pregunta a un texto por lo que no dice**. Es el quinto modo que
`DEC-METH-010` declara no cubierto, en su forma pura.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** La obligación 2 se ejecuta sobre
**apariciones de un término**; acá no hay ninguna que recorrer. Lo que lo habría atrapado es otra
cosa, y conviene nombrarla porque es barata: **recorrer, por cada transición nueva, la lista de
propiedades que sus hermanas ya declaran** —idempotencia, reanudabilidad, detector, actor— en vez
de recorrer términos. `S13` y `T7` se escribieron en el mismo commit y sólo una las tiene.

---

### F-8eA2-004 — Los tres pasos del encendido no incluyen el que le da a la versión de pre-trial la capacidad de activación, y el «si y sólo si» de `V/02` §2.1 lo vuelve obligatorio: después del paso 2 o `G-R3` queda en rojo, o nadie en esa vertical puede ejercer el evento que `T1` espera

**Qué se rompe.** `V/11` §8.3 escribe *«las tres cosas que hay que hacer el mismo día, y en este
orden»* y las declara **un solo acto**. Son tres y hacen falta cuatro. La capacidad de activación
—sin la cual nadie puede publicar sin tener ya un título— **no se deriva en el momento: es un dato
de la versión de pre-trial**, y las versiones son inmutables, así que encenderla es **publicar una
segunda versión de catálogo** que la lista no menciona. Ejecutados los tres pasos tal como están,
la vertical queda con los días en `> 0` y con una versión de pre-trial que **no otorga la capacidad
de activación**: `G-R3` —que verifica el «si y sólo si» en las dos direcciones— falla, y mientras
no se corrija **nadie que no tenga ya un título puede ejercer el evento que `T1` espera**. La
vertical encendió su trial y el trial no le llega a nadie.

**El camino.**

1. `V/02` §2.1 lo declara como dato y no como rama, en un recuadro:
   *«**La capacidad de activación está en la versión de pre-trial de una vertical si y sólo si esa
   vertical declara evento de activación y su plan de trial tiene días > 0.**»*, y el párrafo
   siguiente: *«Es la **mitad de catálogo** de la condición de `T1` … expresada **como dato en vez
   de como rama**, y **un guard la verifica en las dos direcciones**»*.
2. El guard es `G-R3`, y su enunciado lleva la segunda dirección explícita: *«ninguna de las dos
   versiones no vendibles … otorga una clave de la clase comercial ni ningún entitlement medido, **y
   la capacidad de activación está en la de pre-trial si y sólo si** la vertical declara evento y su
   plan de trial tiene días > 0»* (`V/02` §2.1; la fila está en `V/20` §2).
3. **Los dos lados del «si y sólo si» viven en dos versiones distintas.** Los días están en la
   versión del **plan de trial**; la capacidad está en la versión del **plan de pre-trial**. `V/02`
   §2.1 declara los dos planes por separado y a los dos con versión propia, y `plan_version` es
   *«lo que tiene efecto y por eso **es inmutable**»*. Cambiar cualquiera de los dos lados es
   **publicar una versión nueva**.
4. `V/11` §8.3 enumera tres pasos: **1** declarar el evento de activación en `vertical`, **2**
   *«publicar la versión del plan de trial con días > 0»*, **3** ejecutar `T7` sobre la cohorte.
   **El paso 2 mueve un lado del «si y sólo si» y ninguno de los tres mueve el otro.**
5. **El propio capítulo sabe que la capacidad no está.** `V/11` §8.1: *«contrata, publica —con la
   capacidad que le da su plan vendible, **porque la versión de pre-trial no lleva la de activación
   cuando los días son cero** (cap. 02 §2.1)—»*. Es el diagnóstico correcto del estado de partida y
   la lista de tres no lo revierte.
6. `V/02` §2.1 lo remacha desde el lado de Partner: *«Partner, que hoy tiene el trial en cero … y
   **ningún evento declarado** … **no la lleva**»*.
7. **Las dos salidas son malas y ninguna está elegida.** O el paso 2 se ejecuta solo, y entonces
   `G-R3` está en rojo sobre una vertical viva y quien la mire va a leer el guard como roto y no
   como acertado; o alguien publica la versión de pre-trial sin que ninguna lista se lo diga, y
   entonces `V/11` §8.3 —que se presenta como exhaustiva y como **un solo acto**— es falsa en el
   mismo punto donde declara que *«la ventana entre 2 y 3 es el riesgo entero»*.
8. **Y la ventana que se abre es la misma que el § ya identificó, corrida un paso.** Con el paso 2
   hecho y la capacidad todavía no publicada, `T1` está armada pero nadie la puede disparar; con la
   capacidad publicada y `T7` sin correr, **cualquier ex-cliente que publique se lleva el trial
   completo**. La lista de tres pasos declara el orden `1 → 2 → 3` y el orden real es
   `1 → 2 → 2-bis → 3`, con el riesgo entre `2-bis` y `3`.

**Dónde lo permite el diseño.**

- `V/11-trial.md` §8.3, la tabla de los tres pasos y el párrafo *«El orden de 1 y 2 no es
  intercambiable con el 3, y la ventana entre 2 y 3 es el riesgo entero»*; §8.1.
- `V/02-modelo-de-datos.md` §2.1, el recuadro del «si y sólo si», la inmutabilidad de
  `plan_version`, la descripción del plan de pre-trial y el recuadro de `G-R3`.
- `V/03-maquinas-de-estado.md` §2, las condiciones de `T1`, `T6` y `T7`, y el párrafo *«El encendido
  no es una acción del catálogo del cap. 08 §3»*.
- `V/20-testing.md` §2, la fila de `G-R3`.

**Severidad.** `ALTA`. La vertical enciende su trial y **nadie lo puede empezar**, o el guard que
protege el punto único de falla más caro del diseño nace en rojo sobre una vertical de producción
— y `B/20` §2 ya escribió qué pasa con un guard que falla sobre el camino normal: *«es un guard que
alguien va a relajar»*, y lo que se relaja acá es el que impide que se le siembre una clave
comercial a una versión que **toda la plataforma recibe gratis**. No es `CRITICA` porque en la
primera rama nadie paga de menos ni accede de más: el trial no llega, que es el lado seguro del
error.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 2 de la 9-bis-3** (`1e3c3fc9e`), que
escribió `V/11` §8 entero, la lista de tres pasos incluida. El «si y sólo si» y `G-R3` son de la
9-bis-2 y están bien; lo que falta es el renglón que los conecta con el procedimiento nuevo.

**¿Lo habría encontrado el grep?** **Parcialmente, y la parte que falla es la que importa.** El
término es **«capacidad de activación»** / **«si y sólo si»**. Un `rg 'capacidad de activación'`
devuelve `V/02` §2.1, `V/03` §2 y **`V/11` §8.1**, o sea que el grep **sí llega al capítulo que se
rompe**. Lo que no encuentra es el defecto, porque en `V/11` la cadena está en el § que **describe
el estado de partida** y la ausencia está en el § siguiente, que habla de pasos y no de
capacidades. **Un grep encuentra el término, no la consecuencia de que falte en otro párrafo.**

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y por el mismo corte que `F-8eA2-002`.**
Las dos apariciones relevantes —`V/11` §8.1 y §8.3— **las escribió el mismo commit**
(`1e3c3fc9e`), así que caen fuera de lo que la obligación 2 manda justificar. La contradicción vive
entre dos párrafos consecutivos que ese commit escribió de un tirón. El commit `1e3c3fc9e` es
además el único de los cinco de arreglo que **sí** reporta cifra —*«72 apariciones no corregidas
quedaron justificadas una por una»*—, lo que confirma que la cifra mide el conjunto correcto **y
el conjunto correcto no contiene este defecto**.

---

### F-8eA2-005 — `T7` es la única transición del corpus que le saca a una persona su única fuente viva, y los dos capítulos que la escriben afirman que «no le quita nada a nadie»

**Qué se rompe.** El día del encendido, `T7` mueve a la cohorte de `PRE_TRIAL` a
`TRIAL_CONVERTED`. `PRE_TRIAL` **es fuente viva** y apunta a la versión de pre-trial;
`TRIAL_CONVERTED` **no emite nada**. Para el sujeto que `T7` tiene por definición —el ex-cliente
que ya publicó y ya se fue, que **no tiene ningún otro título**— eso significa que el día del
encendido pierde, sin ningún acto suyo y sin aviso, **los borradores ilimitados y la capacidad de
activación** que la versión de pre-trial le otorgaba, y cae al piso, que otorga *«ninguna capacidad
comercial, y la de contratar una suscripción»*. El reconciliador de excedentes se dispara sobre la
cohorte entera el mismo día —una transición de la máquina de trial invalida el caché— y tiene que
*«archivar, despublicar o deshabilitar»* borradores, **para lo cual no hay transición**: la única
`DRAFT` → `ARCHIVED` es `PB5`, y su evento es el reloj de inactividad.

**El camino.**

1. `V/03` §2, la tabla de cobertura por estado: *«| `PRE_TRIAL` | **sí** | la versión de
   **pre-trial** de la vertical | `SIN_EMPEZAR` |»* contra *«| `TRIAL_CONVERTED` | no | — | — |»*.
2. `V/02` §2.1: la versión de pre-trial *«Otorga exactamente tres cosas: lo que `DEC-TRIAL-007` ya
   prometió —**borradores ilimitados**, sin ninguna capacidad comercial—, **la capacidad de
   activación de la vertical**, y la de contratar una suscripción»*. La de piso otorga *«ninguna
   capacidad comercial, y la de contratar una suscripción»* — **dos de tres**.
3. `T7` es la única salida de `PRE_TRIAL` que no garantiza un título de repuesto. Las otras dos lo
   garantizan por su guarda: `T1` exige `cubierto` **falso** pero **entrega el plan de trial**, que
   es fuente viva; `T6` exige `cubierto` **verdadero**, o sea que la persona ya tiene un título.
   **`T7` declara que `cubierto` no participa** (*«`cubierto` no participa»*, celda de condición),
   y su sujeto canónico —el que `V/11` §8.1 describe— es alguien que *«paga meses, y algunos
   cancelan y se van»*.
4. **Y los dos capítulos que la escriben afirman lo contrario, en las dos redacciones.** `V/11`
   §8.2: *«Y tampoco es *«reparación hacia adelante»* al revés — **no le quita nada a nadie**: le
   niega a un ex-cliente un trial que … la vertical no ofrecía»*. `V/03` §2 arma el mismo argumento
   sobre lo que la persona *no* pierde. Ninguno de los dos menciona que la fuente de `PRE_TRIAL`
   deja de existir, aunque la tabla que lo dice está en el mismo §.
5. **El efecto se dispara solo y sobre la cohorte entera.** `V/02` §3.2 lista *«toda transición de
   la máquina de trial»* como causa de invalidación, y `V/15` §4.2 declara que *«es la misma lista»*
   la que dispara el reconciliador de excedentes, que *«actúa sólo si algo bajó»*. Acá bajó, para
   todos, el mismo día.
6. **Y lo que el reconciliador tiene que hacer no tiene transición.** `V/15` §4.3: *«**Nunca borra.**
   Archiva, despublica o deshabilita»*. Para un borrador eso es `DRAFT` → `ARCHIVED`, y la única
   fila del corpus con ese par es `PB5`, cuyo evento es *«N meses de **inactividad**»*. Por la regla
   1 del núcleo, un archivado por excedente sobre un borrador **no se ejecuta**: se registra y, si
   tocaba estado, pone la marca — sobre cada fila de la cohorte.
7. **Y la ventana del §8.4 lo vuelve permanente.** *«El caso inverso —**apagar** un trial encendido
   … **no está declarado**»*, así que no hay forma de devolverle la fuente de pre-trial a nadie.
   Ninguna transición vuelve a `PRE_TRIAL` (`V/03` §2, *«nadie entra a `PRE_TRIAL`, se empieza ahí,
   y ninguna transición vuelve»*).

**Dónde lo permite el diseño.**

- `V/03-maquinas-de-estado.md` §2, la fila `T7`, la tabla *«Qué contesta el contrato de cobertura en
  cada estado»*, y el recuadro del encendido.
- `V/11-trial.md` §8.2 (*«no le quita nada a nadie»*) y §8.4.
- `V/02-modelo-de-datos.md` §2.1, lo que otorga la versión de pre-trial y lo que otorga la de piso;
  §3.2, *«toda transición de la máquina de trial»*.
- `V/15-entitlements-y-limits.md` §4.2 y §4.3.
- `V/03-maquinas-de-estado.md` §9, `PB5`; `NUCLEO/03` §1, regla 1.

**Severidad.** `ALTA`. Es una pérdida de capacidades real, sobre una cohorte entera, disparada por
un cambio de configuración, sobre gente que no hizo nada — y el corpus declara por escrito que no
ocurre, que es lo que garantiza que nadie construya la defensa. No es `CRITICA` porque nadie paga
de más ni de menos —el sujeto ya no paga nada— y porque **no se borra contenido en el acto**: lo
que falta es el desenlace del excedente, que termina en la marca y en una persona.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 2 de la 9-bis-3** (`1e3c3fc9e`). Antes de
`T7` nadie salía de `PRE_TRIAL` en el tercer renglón, así que la fuente de pre-trial no se le
retiraba a nadie por un cambio de catálogo. El arreglo cierra `F-8dA2-002` —que era `CRITICA`— y la
salida que eligió arrastra este costo sin declararlo.

**¿Lo habría encontrado el grep?** **Sí, y la aparición está en la misma sección.** El término
nuevo es **`T7`** y el que decide es **«fuente viva»** / **`TRIAL_CONVERTED`**. Un `rg
'TRIAL_CONVERTED'` sobre `V/03` §2 devuelve la fila de `T7` **y** la fila de la tabla de cobertura
que dice *«| `TRIAL_CONVERTED` | no | — | — |»*, a unas cuarenta líneas de distancia. Comparar las
dos es una lectura, no una búsqueda.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** La tabla de cobertura por estado de
`V/03` §2 **la tocó el mismo commit** —es donde se agregó la fila de `PRE_TRIAL` como fuente viva
en la familia del trial—, así que las dos mitades están adentro de `1e3c3fc9e` y la obligación 2 no
las mira. Es la tercera de este informe con esa forma.

---

### F-8eA2-006 — `G-R5` y `G-R3` vigilan números que viven en el CATÁLOGO y el capítulo los declara corriendo «sobre el árbol de fuentes, en CI»: el día que alguien sube el tope de pausa —el único evento para el que `G-R5` existe— el guard no corre

**Qué se rompe.** `G-R5` es la única pieza que impide que `D16` sea *«una premisa que envejece
sola»*, y `V/20` §2 dice con todas las letras para qué existe: para el día *«que alguien suba el
tope de pausa»*. Ese tope **es configuración del catálogo** —lo dice la fila del guard, *«el tope de
una pausa **que declara el catálogo**»*— o sea un dato que se edita en producción, no en un PR. Y
la capa está definida al revés: `V/20` §1 declara que los guards son *«propiedades del **código**,
no de una ejecución»* y que corren *«**el árbol de fuentes, en CI**»*. Entonces el acto que `G-R5`
existe para atrapar ocurre exactamente donde `G-R5` no mira, y el cliente que pausa se queda sin la
única defensa que `DEC-DATA-002` le dejó.

**El camino.**

1. `V/20` §1 fija la capa: *«| **guards** | propiedades del **código**, no de una ejecución | **el
   árbol de fuentes, en CI** |»*.
2. `V/20` §2, fila `G-R5`: *«el **tope de una pausa** que declara **el catálogo**, pasado a días,
   **alcanza el día del hard delete** de la retención»*. `B/20` §2 lo repite como referencia cruzada
   y agrega por qué vive de ese lado: *«**el número que puede romperlo es de esta épica**: si
   alguien sube el tope de pausa y el guard sólo vive en el catálogo de la otra, el cambio se hace
   sin verlo»*. El razonamiento es correcto sobre **qué épica** y no toca **qué capa**.
3. `V/20` §2 escribe el evento que el guard persigue: *«Es una premisa verdadera el día que se
   escribe y que **nadie vuelve a mirar** el día que alguien suba el tope de pausa … Un guard es lo
   único que la vuelve a mirar sola»*. El sujeto de la frase es una persona editando un número, no
   un PR.
4. `B/03` §5 confirma dónde vive el número: *«| **límites** | los del §26.3, reexpresados en meses:
   **4 pausas-mes** por pausa y **8** acumulados en 12 meses; máximo 3 pausas por ventana |»*, y el
   §9 los declara configuración. `NUCLEO/04` §3, `D16`: *«**Las dos cifras son configuración**»*.
5. **La otra mitad del par tampoco está en el código.** El día 180 sale de `V/02` §4.1, que lo
   escribe en prosa citando el §25 del PDR. Un guard que compare *«el tope del catálogo»* contra
   *«180»* tiene un lado que es una fila de base y otro que es una frase de un `.md`.
6. **Y el corpus ya se contradice sobre la capa, en el guard vecino.** `V/02` §2.1, `G-R3`: *«Se
   comprueba **sobre el catálogo**, en CI, en las dos direcciones»*. *«Sobre el catálogo»* y *«el
   árbol de fuentes»* no son lo mismo, y el capítulo que define la capa dice lo segundo.
7. **La consecuencia práctica se mide sobre los dos guards a la vez.** `G-R3` vigila el punto único
   de falla más caro del diseño —*«si alguien siembra una de esas dos versiones con una clave
   comercial, toda la plataforma la recibe gratis, para siempre»*— y una siembra así se hace
   **publicando una versión de plan**, que es un acto de catálogo en producción. Si la capa es CI
   sobre fuentes, los dos guards vigilan un catálogo semilla y no el que la gente usa.

**Dónde lo permite el diseño.**

- `V/20-testing.md` §1, la tabla de las cuatro capas; §2, filas `G-R3` y `G-R5` y el párrafo
  *«`G-R5` vigila una desigualdad entre dos números de configuración»*.
- `B/20-testing.md` §2, fila `G-R5`.
- `NUCLEO/04-invariantes.md` §3, `D16` y su columna de apoyo (*«guard»*).
- `B/03-maquinas-de-estado.md` §5, la fila de límites; `V/02` §2.1, el recuadro de `G-R3`; §4.1, el
  día 180.

**Severidad.** `ALTA`. Deja sin mecanismo al único invariante que sostiene el arreglo de
`DEC-DATA-002` —`NUCLEO/04` §3 le asigna apoyo **guard**, que es el nivel medio de los tres— y, de
paso, al guard que protege las dos versiones no vendibles. No es `CRITICA` porque no rompe nada por
sí mismo: lo que rompe es la defensa, y el daño que la defensa evita ya está reportado como
`F-8eA2-002`.

**¿Es nuevo, o es el arreglo?** **`G-R5` lo escribió `DEC-DATA-002`** (`621332e7c`), que es el
commit que también escribió `D16` y las dos filas del catálogo. La ambigüedad de capa de `G-R3` es
anterior —de la 9-bis-2—, pero hasta que existió `G-R5` ningún guard del corpus comparaba **dos
números de configuración** entre sí: `G-R3` al menos mira una relación entre un dato y un enunciado.
`G-R5` es el primero cuyos dos operandos son datos.

**¿Lo habría encontrado el grep?** **No.** El término nuevo es **`G-R5`**, y un `rg 'G-R5'` sobre el
corpus devuelve ocho apariciones: `V/20`, `B/20`, `NUCLEO/04`, `NUCLEO/01`, `V/03`, `V/02`, `B/03` y
la descomposición. **Ninguna de ellas es el párrafo que lo contradice**, porque la tabla de las
cuatro capas de `V/20` §1 no nombra ningún guard por su id: dice *«guards»* en genérico. El término
viejo tampoco ayuda: no hay ninguno que se retire. Es el mismo hueco que `F-8dA2-002` por el lado de
la **capa** en vez del capítulo: la regla que se rompe es la que nunca nombró el término.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y es la variante que conviene anotar.**
`621332e7c` **sí tocó `V/20`** —le agregó la fila de `G-R5` y su párrafo—, así que el archivo estuvo
abierto; pero la tabla del §1 es un párrafo que el commit no tocó **y que no contiene el término**,
así que no entra por ninguna de las dos puertas: la obligación 2 se ejecuta sobre *«cada aparición»*
y acá **no hay aparición**. Es la prueba de que las obligaciones 1, 2 y 3 son todas sobre
**apariciones de una cadena**, y de que un contrato declarado en genérico —*«los guards corren
contra X»*— es invisible a las tres.

---

### F-8eA2-007 — `V/11` §2.4 le atribuye a `T6` el consumo del trial al recibir un *Free Forever*, y `T6` no dispara ahí: el beneficiario que no publicó conserva su trial intacto, y `DEC-TRIAL-009` queda incumplida justo para él

**Qué se rompe.** `DEC-TRIAL-009` decidió que revocar un grant **no devuelve el trial**, con el
argumento de que *«el trial no se perdió: se gastó, y se gastó recibiendo algo mejor»*. El capítulo
lo baja a mecanismo en una frase: *«Recibir un *Free Forever* consume el trial de esa vertical —`T2`
si estaba corriendo, **`T6` si todavía no**»*. **La segunda mitad es falsa**: `T6` no dispara al
recibir un grant. Su evento es *«el evento de activación declarado por la vertical»*, o sea que la
persona publique. El beneficiario que está en `PRE_TRIAL` y **no publica** —que es el caso normal de
un *Free Forever* otorgado a alguien que todavía no operaba— se queda en `PRE_TRIAL`, con su fila de
trial **sin escribir**. El día que se le revoca el grant, `cubierto` pasa a falso; el día que
publica, `T1` evalúa sus tres condiciones, las tres se cumplen, y **le arranca un trial completo**:
las capacidades del plan vendible de `rank` más alto, gratis, a alguien que ya tuvo *«cobertura
completa del plan anclado, todo el tiempo que duró el grant»*. Es exactamente lo que la decisión del
owner dice que no pasa.

**El camino.**

1. `V/11` §2.4: *«Recibir un *Free Forever* consume el trial de esa vertical —**`T2` si estaba
   corriendo, `T6` si todavía no**—, y **revocarlo no lo devuelve**»*.
2. `V/03` §2, fila `T6`: *«| T6 | `PRE_TRIAL` | **el evento de activación declarado por la
   vertical** | `TRIAL_CONVERTED` | … **y `cubierto` es verdadero** | crea la fila de `trial`,
   consumida |»*. **El evento no es *«aparece un título»***: es un acto de la persona. `cubierto` es
   la **condición**, no el disparador.
3. **La asimetría con `T2` es lo que hace que la frase suene verdadera.** `T2` **sí** tiene por
   evento *«aparece una fuente viva de clase `TÍTULO` que no es la del trial»*, así que sobre alguien
   en `TRIAL_ACTIVE` el grant lo dispara solo. Las dos mitades de la frase de §2.4 tienen la misma
   forma gramatical y sólo una tiene mecanismo.
4. **Y ninguna otra transición cubre el hueco.** De `PRE_TRIAL` salen tres filas: `T1` y `T6` esperan
   el evento de activación, `T7` espera el encendido. **Ninguna dispara por la aparición de un
   título.** Está dicho a propósito en `V/03` §2 para el caso vecino: *«Alguien puede contratar
   **antes** de publicar: el día que publica, `T1` dispararía …»* — o sea que el diseño **sabe** que
   contratar no mueve la máquina, y el único candado es que el día que publique gane `T6`. Con el
   grant revocado, ese día gana `T1`.
5. **La ventana no es teórica y el propio corpus la construye.** `12-contrato…` §2.8 acaba de
   agregar el **segundo disparador de `S13`** —anclarle una vertical nueva a un grant vivo—, o sea
   el acto que pone a un beneficiario a cubierto en una vertical **donde nunca operó**, que es por
   definición alguien en `PRE_TRIAL` que no publicó ahí. La decisión que amplía el scope de un grant
   es la que más gente mete en este estado.
6. **Y el desenlace contradice el criterio del owner citado en las instrucciones**: *«si la pérdida
   la causa un acto deliberado NUESTRO y la persona no puso plata nueva → se declara y no se
   repara»*. Acá no hay reparación que discutir: **no hay nada que reparar, porque nunca se
   consumió**, y el sistema le entrega el trial entero sin que nadie lo decida.
7. **La mitad de proceso también queda mal.** `V/11` §2.4 cierra con *«Lo que sí corresponde, y es lo
   único: que la confirmación de revocar lo diga (`NUCLEO/08` §3.1). **Se declara, no se repara.**»*
   La confirmación que el administrador va a leer antes de revocar afirma que el beneficiario queda
   sin trial, y para la mitad de los sujetos eso es falso.

**Dónde lo permite el diseño.**

- `V/11-trial.md` §2.4, la frase *«`T2` si estaba corriendo, `T6` si todavía no»* y el cierre *«Se
  declara, no se repara»*.
- `V/03-maquinas-de-estado.md` §2, las filas `T1`, `T2` y `T6`, y el párrafo *«Alguien puede
  contratar antes de publicar»*.
- `12-contrato-de-cobertura.md` §2.8, el segundo disparador de `S13`.
- `NUCLEO/08-auditoria-y-observabilidad.md` §3.1, la confirmación de revocar.

**Severidad.** `ALTA`. **Alguien paga de menos**: recibe el trial completo después de haber tenido
el producto entero gratis, sobre el caso que una decisión del owner acaba de resolver al revés. No
lo pongo en `CRITICA` porque la población es chica y conocida —los *Free Forever* los firma
`SUPER_ADMIN` uno por uno, y `NUCLEO/08` §3 los llama *«la acción administrativa más grave»*—, y
porque la mitad de la frase que sí tiene mecanismo (`T2`) cubre al beneficiario que ya estaba
probando, que es el que más se parece al abuso.

**¿Es nuevo, o es el arreglo?** **Lo introdujo `DEC-TRIAL-009`** (`fe7d14914`, 3 archivos: log,
`NUCLEO/08` y `V/11`), que es el commit que escribió el §2.4 entero. Antes de esa decisión `V/11`
**no nombraba a `T6` ni una vez** —lo medí en la vuelta anterior con `rg` y era el dato central de
`F-8dA2-002`—, así que el consumidor nuevo del término nació con este commit.

**¿Lo habría encontrado el grep?** **Sí, y en la dirección que la enmienda agregó.** El término es
**`T6`**, que existe desde la 9-bis-2 y que este commit **empieza a consumir**. `fe7d14914` tocó
`V/11` y no tocó `V/03`, así que un `rg 'T6'` *«sobre los capítulos que el commit NO toca»* devuelve
la fila de `T6` en `V/03` §2 en la primera corrida, con su evento a la vista. La comparación que
faltaba es de una línea.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y ésta es la fuga que conviene reportar
al método, porque es de la obligación 4 y no de la 2.** La aparición de `T6` en `V/03` §2 **es
correcta** —ahí `T6` está bien escrita— así que la obligación 2 la habría marcado como *«declarada
correcta»* con razón, y el defecto habría sobrevivido a la revisión. Lo que lo atrapa es la
obligación **4**: *«cada término que el núcleo define lleva su lista de consumidores, y el arreglo
que crea un consumidor nuevo agrega la fila antes de declararse aplicado»*. **`T6` no lo define el
núcleo: lo define `V/03` §2**, así que por su propio enunciado la obligación 4 no lo alcanza. La
enmienda tiene inventario de consumidores para los términos del núcleo y no para los de las épicas,
y las nueve máquinas viven todas en las épicas.

---

### F-8eA2-008 — `T7`, `PB7` y `PB8` no declaran clase de operación, `V/17` §3.2 regla 3 prohíbe inferirla y `G-R3-C` falla el build sobre toda operación que no la declare: la única clase escrita para un actor de sistema es la del reloj, que ninguna de las tres es

**Qué se rompe.** El corpus tiene exactamente **dos** formas de contestar *«sobre quién se evalúan
los pasos 5, 6 y 7 cuando el actor no es el sujeto»*: la clase del reloj (`V/17` §3.4) y el catálogo
de las doce acciones administrativas (`NUCLEO/08` §3). Las tres transiciones nuevas de la tanda no
caben en ninguna de las dos, y el corpus **cierra explícitamente la segunda puerta para `T7`**. Con
la regla que prohíbe inferir la clase, el resultado es que o alguien la inventa, o los pasos 5-7 se
evalúan **sobre el sujeto** — y el sujeto de `T7` es, por definición de su propia condición, alguien
que **no tiene ningún título**: el paso 5 le contesta que no y `T7` no se ejecuta sobre la población
entera para la que se escribió. En cualquiera de los dos casos, `G-R3-C` —*«una operación de dominio
no declara si pasa por el paso 5»*— falla el build.

**El camino.**

1. `V/17` §3.4 declara la clase del reloj y su alcance literal: *«**Las transiciones disparadas por
   el reloj** son una segunda clase de operación, evaluada por analogía con las doce acciones
   administrativas: los pasos 5, 6 y 7 se resuelven sobre la capacidad del **ACTOR**, no sobre la
   del sujeto»*, con el caso que la obliga: `T3`, *«esos tres pasos preguntan por el título, las
   capacidades y el cupo **de alguien que no existe**»*.
2. **`T7` tiene exactamente el mismo problema y no es del reloj.** Su evento es *«el encendido: la
   vertical pasa los días de trial de su plan de trial de 0 a > 0»*, o sea un cambio de catálogo.
3. **Y `V/03` §2 cierra la otra puerta a mano.** *«**El encendido no es una acción del catálogo del
   cap. 08 §3 (núcleo) y no hay que agregarlo ahí.** No es un acto de un administrador sobre la
   cuenta de otro: es **configuración de catálogo**»*. Las doce siguen siendo doce.
4. `V/17` §3.2 regla 3, citada por el propio §3.4: *«**a qué clase pertenece una operación se
   declara, nunca se infiere**»*, y el §3.4 remacha *«Dejarla inferida sería incumplir la regla con
   la que se la resuelve»*.
5. `V/17` §3.5 punto 3: *«Un guard que lo hace cumplir: toda operación de dominio **declara** si pasa
   por el paso 5, y **el build falla si alguna no lo declara**»*. Es `G-R3-C` en el catálogo de
   `V/20` §2.
6. **`T7` escribe estado del negocio y es auditable**, que es el criterio exacto del §3.5 para pasar
   por el paso 5: crea la fila de `trial` y `V/03` §2 la declara *«auditable por el criterio 2 del
   §1.1»*. No hay lectura por la que quede exenta.
7. **`PB7` está en la misma situación y el capítulo lo roza sin resolverlo.** `V/03` §9, nota 3:
   *«`PB7` **no es una transición de la clase del reloj**, así que no la alcanza la propiedad
   *«nunca otorga»* del cap. 17 §3.4 … a `PB7` la dispara un cambio de cobertura, igual que a
   `PB3`»*. Dice de qué clase **no** es y no dice de cuál es — y `PB3` ya arrastraba el mismo hueco
   (`F-8bA1`/`F-8cA1`, del vector de `A1`). **`PB8` sí tiene actor** —el dueño— así que su paso 5 se
   evalúa sobre él; lo que le falta es la declaración, no la respuesta.
8. **Ningún guard las mira.** Lo conté con `rg`: el catálogo de `V/20` §2 **no nombra a `T7`, ni a
   `PB7`, ni a `PB8`**.

**Dónde lo permite el diseño.**

- `V/17-autorizacion.md` §3.2 regla 3, §3.4 (la clase del reloj) y §3.5 (el criterio y el guard).
- `V/03-maquinas-de-estado.md` §2, la fila `T7` y el párrafo *«El encendido no es una acción del
  catálogo del cap. 08 §3»*; §9, la nota 3 de `PB7`/`PB8`.
- `NUCLEO/08-auditoria-y-observabilidad.md` §3, el catálogo de doce filas.
- `V/20-testing.md` §2, `G-R3-B` y `G-R3-C`.

**Severidad.** `ALTA`. Bajo la lectura por defecto —el sujeto— `T7` **no se puede ejecutar sobre
nadie de su propia cohorte**, y el `CRITICA` que `T7` vino a cerrar (`F-8dA2-002`: el trial completo
a toda la cohorte de ex-clientes el día del encendido) vuelve entero. No lo pongo en `CRITICA`
porque la otra lectura es plausible y correcta en el resultado —clasificar el fan-out del encendido
como una operación de actor de sistema, por analogía con `T3`— y porque un implementador que llegue
ahí va a hacer eso; lo que está roto es que el corpus lo prohíbe por escrito y no deja ninguna
alternativa escrita.

**¿Es nuevo, o es el arreglo?** **Lo introdujeron el arreglo 2 (`1e3c3fc9e`, `T7`) y `DEC-DATA-002`
(`621332e7c`, `PB7` y `PB8`)**, las dos de la 9-bis-3. `621332e7c` **sí tocó `V/17`** —le agregó el
párrafo de `PB8` en el paso 4, *«`ARCHIVED` dejó de ser un estado sin salida»*—, o sea que el
capítulo de autorización estuvo abierto y se le agregó a `PB8` la respuesta del paso 4 sin darle la
del 5.

**¿Lo habría encontrado el grep?** **No, y por dos razones a la vez.** Los términos nuevos son
**`T7`**, **`PB7`** y **`PB8`**, y un `rg` de los tres sobre `V/17` devuelve **sólo `PB8`, dos
veces**, las dos en el párrafo del paso 4 que el commit escribió. `T7` y `PB7` no aparecen en `V/17`
en absoluto (lo conté). Y lo que falta no es una aparición mal resuelta sino **una declaración que
nadie escribió**, que es la misma ausencia de `F-8eA2-003`.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** Las dos apariciones de `PB8` en `V/17`
las escribió `621332e7c`, y de `T7` y `PB7` no hay ninguna. La obligación 2 no tiene sobre qué
correr. Lo que habría hecho falta es lo mismo que en `F-8eA2-003`: recorrer, por cada transición
nueva, **la lista de preguntas que el corpus le hace a toda transición** —actor, clase, paso 5,
idempotencia, detector— en vez de recorrer términos.

---

### MEDIA

### F-8eA2-009 — `D16` acota la pausa contra el hard delete suponiendo que el reloj de inactividad arranca el primer día de la pausa, y para toda ficha que no estaba publicada-y-cubierta ya venía corriendo

**Qué se rompe.** El caso testigo de `D16` —el que `DEC-DATA-002`, `NUCLEO/01` §1.2, `V/02` §4.2 y
`B/03` §5 cuentan los cuatro igual— es una ficha **publicada y cubierta** el día que empieza la
pausa: `PB2` la baja el día 1, el reloj arranca ahí, y 120 < 180 la salva. Para cualquier otra ficha
del mismo cliente el reloj **ya estaba corriendo**, porque la inactividad se define como *«el tiempo
que lleva sin estar a la vez publicada **y** cubierta»* y un borrador nunca estuvo publicado. La
pausa le agrega 120 días **encima de lo que ya llevaba**, y la desigualdad que `D16` vigila no dice
nada sobre esa suma: al día 180 de inactividad se le borra el contenido igual, a un cliente que
pausó.

**El camino.**

1. `NUCLEO/01` §1.2: *«**Inactividad** (de una ficha) | El tiempo que lleva **sin estar a la vez
   publicada y cubierta**, contado desde **el más reciente** de los cuatro hechos que la
   reinician»*. Un `DRAFT` cumple la definición desde que se creó y no se tocó más.
2. `V/03` §9, `PB5`: *«| PB5 | `DRAFT` | N meses de **inactividad** | `ARCHIVED` |»*, y `V/02` §4.1
   pone **los borradores** entre lo que se borra al día 180.
3. **Ninguno de los cuatro hechos de reinicio lo alcanza durante la pausa.** El 1 es un acto del
   dueño sobre la ficha; el 2 es `cubierto` pasando a verdadero, que durante la pausa pasa a
   **falso**; el 3 es volver a `PUBLISHED`, que un borrador no hace; el 4 es el fin de servicio de
   una vertical.
4. **El corpus arma la garantía sobre el sujeto de un solo tipo, cuatro veces.** `NUCLEO/01` §1.2:
   *«la ficha de alguien que **pausa** su suscripción baja por `PB2` el primer día de la pausa,
   cruza el día 90 … y sigue corriendo hasta el hard delete del día 180»*. `V/02` §4.2 regla 4:
   *«`PB2` le baja la ficha el primer día y `PB4` se la archiva el 90»*. `B/03` §5: *«`cubierto`
   pasa a falso y `PB2` baja la ficha el primer día»*. `V/03` §9: *«el día 90 llega antes que el fin
   de la pausa»*. Las cuatro redacciones empiezan la cuenta en el día 1 de la pausa.
5. `NUCLEO/04` §3 escribe `D16` sobre ese supuesto: *«Es lo único que impide que una pausa del
   catálogo llegue a borrar contenido»*. Sobre el borrador de ese mismo cliente no impide nada.
6. **Y la vuelta también es peor para él.** `PB7` exige que *«el evento que la archivó diga que venía
   de `PUBLISHED` o de `UNPUBLISHED_BY_BILLING`»*, y el de un borrador dice `DRAFT`, así que al
   reanudar **no vuelve sola**: tiene que usar `PB8` a mano, si llega antes del 180.

**Dónde lo permite el diseño.**

- `NUCLEO/01-glosario.md` §1.2, la definición de inactividad, los cuatro hechos y el párrafo de la
  pausa.
- `NUCLEO/04-invariantes.md` §3, `D16` y *«es lo único que impide»*.
- `V/02-modelo-de-datos.md` §4.1 (los borradores entre lo que se borra) y §4.2 regla 4.
- `B/03-maquinas-de-estado.md` §5, el párrafo *«Qué le pasa a la ficha mientras dura la pausa»*.
- `V/03-maquinas-de-estado.md` §9, `PB5` y `PB7`.

**Severidad.** `MEDIA`. El borrado del borrador inactivo **es el comportamiento diseñado** de la
retención —el cliente lo habría perdido igual sin la pausa—, así que la pausa no lo causa: lo
adelanta. Lo que está roto es que `D16` y sus cuatro redacciones afirman una garantía general
(*«una pausa nunca borra contenido»*) que sólo vale para una de las tres poblaciones de fichas, y
`G-R5` no puede ver la diferencia porque compara dos números de catálogo. Lo reporto porque es
**una razón caduca debajo de una conclusión que se lee como universal**, que es la clase que ningún
guard mira.

**¿Es nuevo, o es el arreglo?** **Lo introdujo `DEC-DATA-002`** (`621332e7c`), que escribió la
definición de inactividad, los cuatro hechos, `D16` y las cuatro redacciones del caso testigo. Antes
de la 9-bis-3 *«inactividad»* aparecía **una sola vez en todo el corpus y sin definición** —lo mide
la propia decisión—, así que no había garantía que acotar.

**¿Lo habría encontrado el grep?** **Sí, y es la aparición más barata del informe.** El término
nuevo es **«inactividad»**, y un `rg 'inactividad'` devuelve `PB4` **y `PB5`** en la misma tabla de
`V/03` §9, con `PB5` diciendo `DRAFT` en su `desde`. La pregunta *«¿y el borrador?»* sale de leer las
dos filas seguidas.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No: `621332e7c` tocó las dos filas.** `git
blame` dice que `PB4` y `PB5` las reescribió ese commit —es el que les puso la referencia a `cap. 01
§1.2`—, así que las dos apariciones están **adentro del commit** y la obligación 2 las excluye. Es
la cuarta de este informe con esa forma.

---

### F-8eA2-010 — `PB3` y `PB7` compiten por el mismo cupo y ninguna declara criterio de selección, mientras `PB2` tiene el suyo escrito y con obligación de publicarlo

**Qué se rompe.** El día que un anfitrión recupera la cobertura, el mismo hecho dispara `PB3` sobre
las fichas que quedaron en `UNPUBLISHED_BY_BILLING` y `PB7` sobre las que ya se archivaron. Las dos
piden *«y el cupo alcanza»* y el cupo es uno solo. Con cinco fichas abajo y un plan de tres, **qué
tres vuelven lo decide el orden en que una implementación recorra dos tablas** — que es, con las
palabras del núcleo, *«exactamente la diferencia entre una máquina de estados y una convención»*. Y
el cliente no lo puede predecir ni reclamar, porque el criterio que el diseño sí escribió es el de
bajar, no el de subir.

**El camino.**

1. `V/03` §9: *«| PB3 | `UNPUBLISHED_BY_BILLING` | `cubierto` pasa a verdadero | `PUBLISHED` | **y
   el cupo alcanza** |»* y *«| **PB7** | `ARCHIVED` | `cubierto` pasa a verdadero | `PUBLISHED` | **y
   el cupo alcanza**, y el evento que la archivó … |»*. Mismo evento, mismo destino, mismo recurso
   escaso, dos `desde` distintos.
2. **El corpus escribió el criterio para la dirección contraria y declaró por qué hacía falta.**
   `V/03` §9: *«**El excedente tras un downgrade tiene criterio escrito y predecible**: se despublican
   **las publicadas más recientemente**, hasta entrar en el límite, y **el criterio va escrito en el
   aviso** — si el cliente no puede leerlo, deja de ser predecible y se pierde el motivo por el que
   se eligió (`DEC-SUB-008`)»*. `V/15` §4.3 lo generaliza a todo limit contable *«en vez de inventar
   un segundo criterio, porque dos criterios distintos para la misma clase de problema es cómo se
   vuelve impredecible»*. Para la vuelta no hay ninguno, ni primero ni segundo.
3. `V/19` fila 8 obliga a publicar el criterio de bajar; **no hay fila para el de subir**.
4. **La regla 7 del núcleo no lo alcanza, y conviene decir por qué**: exige guardas disjuntas a *«dos
   filas que comparten `(desde, evento)`»*, y `PB3` y `PB7` comparten evento y **no** `desde`.
   `NUCLEO/03` §1 lo dice para el par vecino: *«`PB7` y `PB8` … salen las dos de `ARCHIVED` … sus
   eventos son distintos … **Lo que este guard cuenta son pares, no estados de origen.**»* Acá es el
   espejo: mismo evento, orígenes distintos, y también queda afuera.
5. **El desenlace es visible y acotado**, no permanente: la ficha que no entró se queda donde estaba
   y el dueño puede publicarla a mano —desde `ARCHIVED` con `PB8` + `PB1`; desde
   `UNPUBLISHED_BY_BILLING`, **no puede** (`F-8eA2-001`, paso 7)—.

**Dónde lo permite el diseño.**

- `V/03-maquinas-de-estado.md` §9, las filas `PB3` y `PB7`, y el párrafo del criterio del excedente.
- `V/15-entitlements-y-limits.md` §4.3.
- `V/19-superficies.md` fila 8 y fila 18.
- `NUCLEO/03-maquinas-de-estado.md` §1, regla 7 y el párrafo *«Compartir el `desde` no es compartir
  el par»*.

**Severidad.** `MEDIA`. No hay plata de por medio y el resultado es corregible por el dueño en la
mitad de los casos. Lo reporto porque es **el mismo defecto que `DEC-SUB-008` ya pagó una vez** —un
criterio de selección implícito sobre fichas— resuelto en una dirección y no en la otra, y porque
desde `PB7` el conjunto de candidatos dejó de ser homogéneo: una ficha archivada y una despublicada
no son lo mismo para el dueño, y nada dice cuál tiene prioridad.

**¿Es nuevo, o es el arreglo?** **Lo introdujo `DEC-DATA-002`** (`621332e7c`): hasta que existió
`PB7` había **un** origen y el problema era sólo *«cuáles de las N»*; ahora hay dos orígenes y la
pregunta se duplica. La mitad vieja —`PB3` sin criterio— es del arreglo 9 de la 9-bis-2.

**¿Lo habría encontrado el grep?** **Sí.** El término es **`PB7`**, y su fila se escribió **tres
líneas debajo de la de `PB3`**, con la cadena *«y el cupo alcanza»* copiada palabra por palabra. Un
`rg 'el cupo alcanza'` devuelve las dos filas juntas.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí, ésta sí, y es la segunda del informe.**
El párrafo del criterio —*«se despublican las publicadas más recientemente … el criterio va escrito
en el aviso»*— lo escribió `9796d4e2b3` el 2026-09-18 y **`621332e7c` no lo tocó**: es una aparición
no corregida, en un párrafo que el commit no tocó, dentro del archivo que el commit sí abrió. Cae
exactamente en lo que la obligación 2 manda justificar por escrito. **La enmienda alcanzaba y no se
ejecutó.**

---

### BAJA

### F-8eA2-011 — `B/09` §3 sigue nombrando «el retiro de un ancla» como cuarto momento de re-evaluación de `A5`, y `DEC-ADDON-006` lo retiró de los otros dos lugares por ser un acto que ningún catálogo produce

**Qué se rompe.** El acto *«retirar un ancla»* **no existe** —`12-contrato…` §2.8 y `B/02` §2.4 lo
dicen los dos con esas palabras—, y `DEC-ADDON-006` reescribió por eso la tercera cláusula de `A5` y
el cuarto momento de `B/16` §4.3. **Quedó vivo en `B/09` §3**, que es el capítulo del backstop: el
párrafo que justifica la cuarta comprobación de cero llamadas sigue diciendo que el cuarto momento
es *«la revocación del grant **o el retiro de un ancla**»*. Quien lea el detector por ahí va a
buscar un momento que nadie puede producir, y el argumento de por qué la comprobación hace falta
—*«esta comprobación existe para la corrida en que ninguno se ejecutó»*— cuenta uno de más.

**El camino.**

1. `B/09` §3, recuadro de la cuarta comprobación: *«En el curso normal `A5` ya cerró la instancia en
   alguno de los **cuatro** momentos que el `B/16` §4.3 enumera —el cuarto es la revocación del
   grant **o el retiro de un ancla**—»*. Lo conté con `rg`: **es la única aparición de esa cadena en
   todo el corpus**.
2. `B/16` §4.3, el mismo cuarto momento, ya corregido: *«**Y es uno solo, no dos**: la redacción
   anterior decía *«o se retira el ancla de esa vertical»* y ese acto **no está declarado**
   (`12-contrato…` §2.8, `B/02` §2.4), así que nombrarlo agregaba un momento que nadie podía
   producir»*.
3. `B/03` §8, `A5`, también corregida: *«**El tercero nombra la REVOCACIÓN y no *«el retiro del
   ancla»***, porque *«desanclar no está declarado»* … y **una transición no puede esperar un acto
   que ningún catálogo produce**»*.
4. `12-contrato…` §2.8: *«**Desanclar no está declarado, y esto no lo declara.**»*
5. **El predicado de la comprobación sí está bien**, y eso es lo que lo deja en `BAJA`: dice *«o el
   ancla que era su título **ya no es la de un grant vivo**»*, que es la lectura por revocación. Lo
   que quedó caduco es la **razón** escrita debajo, no la condición.

**Dónde lo permite el diseño.**

- `B/09-conciliacion.md` §3, el recuadro *«Es un backstop, no el disparador»* de la cuarta
  comprobación (línea 349 del archivo).
- `B/16-addons.md` §4.3, la tabla de los cuatro momentos.
- `B/03-maquinas-de-estado.md` §8, `A5`.
- `12-contrato-de-cobertura.md` §2.8; `B/02-modelo-de-datos.md` §2.4.

**Severidad.** `BAJA`. El predicado que se implementa está bien escrito y el conteo de cuatro
momentos también; lo caduco es la glosa. Lo reporto porque es **una razón caduca debajo de una
conclusión correcta**, que es la clase que ningún guard mira y que se vuelve una contradicción viva
el día que alguien decida declarar el acto de desanclar — que es justo lo que `12-contrato…` §2.8
deja como puerta abierta (*«si alguna vez se necesita, entra por el catálogo del `NUCLEO/08` §3 con
su propia fila»*).

**¿Es nuevo, o es el arreglo?** **Es de la tanda entera, y las dos mitades se pueden fechar.** El
párrafo lo escribió **`6bac7e63a`** (`DEC-ADDON-003`) y el término lo retiró **`1c17565e1`**
(`DEC-ADDON-006`, *«las tres chicas»*), tres commits después. Lo medí con `git blame`: las líneas
348-350 de `B/09` llevan `6bac7e63a`.

**¿Lo habría encontrado el grep?** **Sí, y es literalmente la obligación 3 de `DEC-METH-010`.** Esa
obligación dice *«se grepea también el término VIEJO, el que se retira»*, y el término viejo acá es
**«retiro de un ancla» / «desanclar»**. Un `rg 'retiro de un ancla'` sobre el corpus devuelve
**exactamente una línea** —la conté— y es ésta. La obligación que la enmienda agregó está escrita
para este caso y el caso pasó igual.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí, y es la tercera del informe.**
`1c17565e1` **tocó `B/09`** (lo verifiqué con `git show --name-only`: es uno de sus 6 archivos) y no
tocó ese párrafo, que sigue con el blame de `6bac7e63a`. O sea: aparición no corregida, en un
párrafo que el commit no tocó, en un archivo que el commit abrió — el caso exacto de la obligación
2, con el término exacto de la obligación 3. **Las dos obligaciones nuevas apuntaban a este defecto
y ninguna de las dos se ejecutó.**

---

## 2. Hallazgos anteriores que siguen llegando sobre el texto nuevo

No cuentan como hallazgos nuevos (§4 de las instrucciones). Sólo los que **siguen llegando** y
cambiaron de forma, verificados hoy contra el texto y no contra el informe que los cita.

| ID | veredicto | en qué paso llega ahora |
|---|---|---|
| `F-8dA2-001` | **CORTA** | **paso 3**. `S18` ganó su cuarta escritura —*«si la predecesora retiene un pago pendiente por `S19`, se le pone a ELLA la marca … con motivo «reembolso por confirmar»»*— y `B/09` §3 ganó la **salvedad 3**, que devuelve al barrido *«una suscripción terminal con un pago acreditado pendiente de resolución»*. Las dos poblaciones que el arreglo anterior dejó a medias están cubiertas. Es el mejor arreglo de la tanda. |
| `F-8dA2-002` | **CORTA, y deja residuo** | **paso 4**. `T7` cierra el tercer renglón. Lo que quedó son tres cosas nuevas: la corrida que la ejecuta no declara idempotencia (`F-8eA2-003`), la lista de pasos que la lanza está incompleta (`F-8eA2-004`) y no hay clase de operación que la pueda ejecutar (`F-8eA2-008`). |
| `F-8dA2-003` | **CORTA** | **paso 6**. El espejo de la baja decidida por el proveedor dejó de ser un renglón anónimo: es la **séptima** fila de la tabla del §3.2, `S18` sale de `PENDING_AUTHORIZATION` por ella, `B/16` §4.3 la cuenta entre las seis y `B/12` §5.3 ganó su **rama 5**. |
| `F-8dA2-004` | **SIGUE** | **paso 3**. Verifiqué el texto de hoy: `12-contrato…` §2.6 sigue defendiendo `PENDING_AUTHORIZATION` con *«a quien está cambiando de plan **lo sigue cubriendo su suscripción vieja**»*, y la tabla del `B/03` §3.2 —ahora de **siete** filas, no seis— sigue dejándola en un estado que no emite en la mayoría de los casos. La séptima que el arreglo 8 agregó (el espejo → `CANCELLED`) **tampoco emite**, así que el conteo empeoró: **seis de siete**. |
| `F-8dA2-005` | **CORTA** | **paso 1**. El evento de `S19` se reescribió sobre el hecho: *«entra el pago del período impago, por cualquiera de sus **DOS puertas** … `MP1` **o `MP4`**»*. `MP1` ya matchea. |
| `F-8dA2-006` | **SIGUE** | **paso 1**. `V/20` §2 sigue diciendo *«`T1`/`T6` es **el único par** con dos destinos que el diseño declara hoy —que siga siendo el único es **lo que este guard cuenta**—»*, y `NUCLEO/03` §1 regla 7 sigue declarando **tres** en su tabla. `V/03` §2 y `B/03` §3.2 están los dos corregidos; el número equivocado sigue **en el único lugar que el corpus designa como la definición** de `G-R4`. Sin cambios respecto de la vuelta anterior. |
| `F-8dA2-007` | **SIGUE** | **paso 1**. `B/03` §8, `A1`: *«exige una suscripción principal válida y compatible (§38). **Nunca durante un trial** (§10.5)»*, contra `V/11` §5.2, *«**¿Puede comprarlo?** **Sí.**»*. Ninguna de las dos se movió, `NUCLEO/01` §2.4 sigue con la regla escrita en una sola dirección y `G-R4-B` sigue vigilando sólo el sentido verticales→billing. |
| `F-8dA2-008` | **SIGUE** | **paso 1**. `B/03` §4 sigue abriendo con *«**Mientras esa sucesión esté en curso, ni `S5` ni `S6` se ejecutan**»* y la fila `S6` del §3.2 sigue condicionando sobre *«no hay un pago acreditado del período pendiente de resolución»*, que son dos reglas distintas. La fila 3 de la tabla de siete transiciones sigue del lado del §3.2. |
| `F-8dA2-009` | **SIGUE, y se mudó de casa** | **paso 4**. Conté hoy los encabezados otra vez: **siete** tablas, 3 en `V/03` y 4 en `B/03`. `NUCLEO/03` §1 sigue diciendo *«las nueve máquinas»* y *«las nueve tablas»*, `V/03` §2 *«las nueve tablas»*, `V/20` §2 *«sobre las nueve máquinas»*. **Lo nuevo**: el *«seis tablas»* que antes estaba en `B/20` ahora está en **`V/20` §2** (*«para que las seis tablas de billing no queden vigiladas por un guard que su propio catálogo no nombra»*), o sea que el número equivocado se mudó al archivo que **define** el guard y que ya carga el *«único par»* de `F-8dA2-006`. |
| `F-8dA2-010` | **SIGUE** | **paso 1**. `B/02` §2.2 sigue con *«**cuatro de estos seis** no emiten ninguna fuente»* y `NUCLEO/01` §2.4 sigue contando **tres** (*«De las seis filas vivas **de la suscripción**, tres no emiten ninguna fuente»*). La cita cruzada sigue en el mismo bloque que el número equivocado. |
| `F-8dA2-011` | **CORTA** | **paso 2**. `V/18` §1.5 se reescribió: *«**La garantía se escribe sobre las TRES salidas de `PRE_TRIAL`, no sobre `T1` sola.**»*, y `V/02` §2.1 lo acompaña con *«Son tres y no dos»*. |
| `F-8cA2-006` | **SIGUE** | **paso 3**. Ningún documento dice qué estados de la **instancia de addon** emiten fuente. Lo verifiqué otra vez: la tabla del `12-contrato…` §2.6 sigue siendo la de los estados de la suscripción. `A1` (`PENDING_AUTHORIZATION` de addon) sigue sin respuesta, y desde `S20` hay un estado más que la necesita: una instancia `ACTIVE` a costo $0 colgando de un ancla. |
| `F-8cA2-009` | **SIGUE** | **paso 2**. Ninguna de las **siete** tablas ganó columna de clase de actor; conté los encabezados hoy. `T7`, `PB7`, `PB8`, `S20` y `S21` se suman a la lista de transiciones sin clase declarada — y en tres de ellas eso ya es un defecto con consecuencia (`F-8eA2-008`). |
| `F-8cA2-011` | **SIGUE** | **paso 3**. El reloj de la marca sigue sin ser transición, sin actor y sin destino para *«escala»*; `B/09` §3 lo repite (*«Si sigue puesta pasado su plazo, **escala**»*). Le cuelgan ahora la marca de la rama 1 y la de la rama 5 de `B/12` §5.3. |
| `F-8A2-005` · `F-8bA2-005` · `F-8bA2-006` · `F-8bA2-007` · `F-8A2-013` · `F-8A2-017` | **SIGUEN** | Sin cambio. Verifiqué los tres conteos que los sostienen: cero columnas de clase en las siete tablas, **ningún barrido de verticales** (billing tiene cinco comparaciones y cuatro comprobaciones de cero llamadas; verticales no tiene ninguna), y `G5` sigue comprobándose *«sobre los efectos declarados de las transiciones del capítulo 03»*. La ausencia de barrido de verticales es lo que deja sin detector a `F-8eA2-001` y a `F-8eA2-003`. |

---

## 3. Ataques que intenté y el diseño resistió

1. **Conseguir dos trials en la misma vertical encadenando `T7` con `T1` o `T6`.** Cerrado en tres
   niveles y `T7` no abre ninguno: las tres salen de `PRE_TRIAL`, **ninguna transición vuelve ahí**,
   y `V/02` §2.2 hace la fila única de por vida por `user` **y** por hash del correo normalizado,
   *«sin condición de estado»*. Después de `T7` el sujeto está en `TRIAL_CONVERTED` y ya no matchea
   ningún `desde`.
2. **Hacer que `T7` se pisara con `T1` o con `T6`.** Imposible por el par: comparten `desde` y **no
   el evento** —el encendido es un cambio de catálogo, el de aquéllas es un acto de la persona—.
   `NUCLEO/03` §1 regla 7 lo escribe con su razón (*«Lo que este guard cuenta son **pares**, no
   estados de origen»*) y enumera los **cinco** casos vivos que comparten `desde` sin compartir par.
   Recorrí los cinco —`T7`, `S18`, `A5`, `PB7`/`PB8`, `S20`/`S21`— y el argumento se sostiene en los
   cinco; en `S20`/`S21` incluso agrega la mitad que hacía falta (*«además **no se pueden satisfacer
   a la vez** —`S20` declara que la instancia **no** cambia de estado—»*).
3. **Quemarle el trial a alguien con `T7` sin que hubiera ejercido el evento.** Falla por dato y el
   dominio está recorrido en una tabla de dos filas (`V/03` §2): quien nunca publicó sigue en
   `PRE_TRIAL` intacto, *«tenga suscripción o no la tenga, esté al día o esté `SUSPENDED`»*, que es
   literalmente la población que `DEC-TRIAL-008` protege. Y la condición **no pide un hecho nuevo en
   la frontera**: se lee sobre el registro append-only de la propia épica. Es el mejor argumento de
   la tanda.
4. **Volver de `ARCHIVED` publicando el borrador de alguien que nunca pidió publicarlo.** Cerrado, y
   por eso son dos filas: `PB7` mira el origen (*«sólo si venía de `PUBLISHED` o de
   `UNPUBLISHED_BY_BILLING`»*) y `PB8` va a `DRAFT`. El argumento —*«Una vuelta automática que no
   las distinguiera publicaría el borrador de alguien que nunca pidió publicarlo»*— es correcto, y
   el origen sale del evento de dominio sin columna nueva.
5. **Quemarle el trial a quien reanuda una pausa, haciendo pasar `PB7` por el evento de
   activación.** Cerrado explícitamente: `V/03` §9 nota 1, *«`PB7` **no es el evento de activación**
   … `PB3` ya republicaba sin ser `PB1` y `PB7` hace lo mismo un estado más atrás: **restituir no es
   publicar**»*. Es exactamente el ataque que `F-8cA2-012` abrió sobre `PB3` y acá está contestado
   por escrito antes de que nadie pregunte.
6. **Dejar el reloj de retención corriendo sobre alguien que volvió con un plan más chico.** Cerrado
   y bien argumentado: el reinicio cuelga del **hecho** (`cubierto` pasando a verdadero) y no de la
   transición, *«si el cupo no alcanza y la ficha se queda abajo, el reloj se reinicia igual»*
   (`V/03` §9, `V/02` §4.2 regla 4, `NUCLEO/01` §1.2 hecho 2). Es la mitad que más fácil se
   olvidaba y está en tres capítulos con la misma redacción.
7. **Encontrar una transición que entre a `PUBLISHED` y no esté en el hecho 3.** No hay: las
   transiciones hacia `PUBLISHED` son `PB1`, `PB3` y `PB7`, y el hecho 3 nombra exactamente esas
   tres. Lo verifiqué sobre la tabla del §9 fila por fila.
8. **Hacer que `S13` dejara una sucesión abierta sobre una fila muerta al anclarle una vertical
   nueva a un grant.** Cerrado por el alcance: `S13` toma *«toda fila viva PRINCIPAL»*, o sea
   también a la sucesora, y `B/09` §3 lo declara (*«quedan **las dos** muertas, y no hay candado
   vacío que aprovechar»*). Y la ejecución parcial del fan-out tiene su detector, que **cubre los
   dos disparadores** porque pregunta por el resultado y no por el acto.
9. **Que la cobertura se cayera entre la cancelación de `S13` y el anclaje del grant.** No hay
   ventana escrita al revés: `12-contrato…` §2.8 ordena el acto como *«el beneficiario queda
   cubierto ahí **desde el instante del anclaje**, así que toda fila viva PRINCIPAL suya en esa
   vertical se cancela»*, o sea el ancla primero y `S13` después. Y si la corrida se corta, la
   tercera comprobación de `B/09` §3 lo ve con cero llamadas.
10. **Colar un `includesAddons` apagado después del hecho, para que el addon quedara gratis para
    siempre.** No encontré el camino: `NUCLEO/08` §3 no tiene fila para *«cambiar `includesAddons`
    de un grant vivo»* y el `B/16` §3.4 lee el flag **en el acto** del otorgamiento o del anclaje.
    Lo anoto como dominio sin sujeto y no como defecto: mientras el acto no exista, no hay quién lo
    dispare.
11. **Usar `PB8` para sacar una ficha del alcance de `PB7` y quedarme con el cupo.** No compra nada:
    `PB8` lleva a `DRAFT`, que no consume cupo y del que se sale por `PB1`, que es un acto del dueño.
    El único efecto raro —que después de `PB8` la ficha deje de volver sola— es el desenlace correcto
    de haber pedido el borrador.
12. **Hacer que `S21` se disparara dos veces sobre el mismo preapproval.** Cerrado y con la
    aritmética escrita: *«un addon recurrente tiene **un** preapproval y es el de esta fila … Volver
    a escribirla acá serían dos llamadas por el mismo recurso»*, más la partición de salvedades del
    `B/09` §3 (`S20` por la 4, `S21` por la 1) con el argumento de por qué contarla en las dos sería
    barrer dos veces. Es el recorrido de dominio más cuidadoso de la tanda.

---

## 4. Fuera de mi vector

Anotado y no perseguido.

1. **`NUCLEO`** — `NUCLEO/03` §1 regla 7 sigue enunciando la regla sobre *«dos filas que comparten
   `(desde, evento)`»* **sin calificar el destino**, y su tabla enumera sólo *«los pares con dos
   filas **y dos destinos distintos**»*. Recorrí hoy las 21 filas de `B/03` §3.2 y las 7 de `V/03`
   §2 y sigue sin haber ningún par con el mismo destino y guardas solapadas, así que es dominio sin
   sujeto. **Pasada C**, sin cambios respecto de la vuelta anterior.
2. **`NUCLEO`** — `NUCLEO/04` §3 le da a `D16` apoyo **guard**, y ese guard no puede correr donde el
   número cambia (`F-8eA2-006`). Es un invariante de nivel medio cuyo mecanismo no alcanza a su
   sujeto; el recuento de los tres niveles del §3 (*«diez los sostiene la base … `D8 D9 D10 D12 D15
   D16` (6) … las diez restantes servicio»*) lo cuenta como resuelto. **Pasada C.**
3. **`NUCLEO`** — `NUCLEO/04` §3 declara que `D11` (*«lo que toca plata lo confirma una persona»*)
   tiene apoyo **servicio**, sin base ni guard, y ahora sostiene además las dos marcas de
   *«reembolso por confirmar»* de `B/12` §5.3 (ramas 1 y 5). Sigue siendo el único de los tres
   niveles sin mecanismo. **Pasada C**, ya anotado en la vuelta anterior.
4. **Entitlements (`A1`)** — `V/15` §4.2 sigue diciendo que el reconciliador de excedentes se
   dispara con *«la misma lista … con sus **siete** entradas»* y la lista de `V/02` §3.2 tiene
   **diez** (las conté hoy). Es `F-8cA1-008`, de `A1`, abierto desde la 8-bis-2 y sin tocar: **`V/15`
   no está en los archivos de ninguno de los once commits de la tanda**. Le agrego un dato nuevo:
   el propio `V/02` §3.2 dice *«**Las cuatro últimas** son de la FASE 9 y ninguna entraba por **las
   siete** de arriba»*, que suman **once** sobre una tabla de **diez**, así que el § se equivoca
   también consigo mismo.
5. **Contrato (`C1`)** — `12-contrato…` §2.6 sigue afirmando en un párrafo que la predecesora
   *«sigue cubriendo»* durante la ventana y midiendo en otro que no emite. Con la séptima transición
   del `B/03` §3.2 el conteo pasó de cinco de seis a **seis de siete**. Lo reporto como
   `F-8dA2-004` que sigue; la contradicción interna del contrato es de la costura.
6. **Addons (`B1`/`B2`)** — `F-8cA2-006` sigue llegando y ahora tiene un estado más que mapear: la
   instancia `ACTIVE` a costo $0 que `S20` deja colgando del ancla. Los estados de la instancia
   siguen sin mapa de emisión.
7. **Método (`C1`)** — el reparto de los once de este informe contra `DEC-METH-010`: **3** caen
   adentro de la obligación 2 y no se ejecutaron (`F-8eA2-001`, `F-8eA2-010`, `F-8eA2-011`), **6**
   viven adentro de un párrafo que el propio commit escribió (`F-8eA2-002`, `004`, `005`, `007`,
   `008`, `009`) y **2** son ausencias sin cadena que grepear (`F-8eA2-003`, `F-8eA2-008` comparte
   las dos formas). La enmienda **sirve** —los tres que atrapa son reales y baratos— y **su alcance
   declarado excluye a la mayoría**. Si se amplía, la ampliación barata sigue siendo la que anoté la
   vuelta pasada —**leer entero el § que se toca**— más una segunda que este informe hace evidente:
   **toda transición nueva se recorre contra la lista de preguntas que el corpus ya le hace a las
   viejas** (actor, clase de operación, paso 5, idempotencia, reanudabilidad, detector). `S13` las
   tiene todas y `T7`, escrita en el mismo commit, no tiene ninguna.

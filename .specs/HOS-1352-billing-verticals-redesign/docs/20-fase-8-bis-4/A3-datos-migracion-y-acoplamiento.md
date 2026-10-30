---
title: "FASE 8-bis-4 · A3 — datos, migración y acoplamiento"
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 8
---

# FASE 8-bis-4 · A3 — datos, migración y acoplamiento

Quinta pasada A3, sobre el texto que la **9-bis-3** produjo. El vector no cambia: columnas que
hacen falta y no existen, columnas que existen y nadie escribe, datos que dos lugares declaran
distinto, restricciones que no se pueden cumplir, caché e invalidación, y todo punto donde una
épica necesita algo de la otra sin que el contrato lo declare.

Lo que pesa en esta tanda, para mi vector, no es una entidad nueva: es **un reloj**.
`DEC-DATA-002` le dio a la inactividad su definición —**cuatro hechos de reinicio con lista
cerrada**— y con eso convirtió un contador monótono en un contador **reiniciable**. Un contador
reiniciable es un dato distinto: necesita dónde vivir, necesita una fuente durable para cada
reinicio, y **re-agenda los avisos que cuelgan de él**. Ninguna de las tres cosas está escrita.
Los dos `CRITICA` de esta pasada salen de ahí, y los dos terminan en lo mismo: **el contenido de
la ficha de un cliente al día se borra el día 180 sin que nadie le haya avisado**, que es
exactamente el daño que `DEC-DATA-002` vino a cerrar, entrando por la puerta de al lado.

**Diecinueve hallazgos: 2 `CRITICA`, 6 `ALTA`, 8 `MEDIA`, 3 `BAJA`.**

**Atribución, que es lo que esta pasada existe para medir.** De los diecinueve, **siete los
introdujo entera la tanda de arreglos de la 9-bis-3** —**cuatro** de ellos `DEC-DATA-002`
(`621332e7c`), uno la costura (`c29b318c7`) y dos la familia de la sucesión (`f4edbdfdf`)—,
**once siguen llegando** con su ID viejo, y **dos son mitad y mitad**. **Los dos `CRITICA` los
introdujo un arreglo, y los dos son `DEC-DATA-002`.**

**Y la respuesta a la pregunta nueva, la tercera línea: la resolución POR APARICIÓN no alcanzaba
a ninguno de los dos `CRITICA`, y no por no ejecutarse.** Los dos viven en párrafos que **no
contienen ningún término que el commit redefina**: uno en `NUCLEO/07` §2 —la clave de
deduplicación del outbox, que habla de *«ocurrencia»* y de `T4`, y jamás de retención—, el otro en
la ausencia de una columna. El defecto que `DEC-DATA-002` creó no es una aparición nueva de un
término: es una **propiedad** nueva —el reloj pasó a reiniciarse— y una propiedad no tiene término
que grepear. El §«Qué mide esta pasada sobre `DEC-METH-010`» al final lo desarrolla con los
diecinueve.

**Los conteos que uso son míos y los conté sobre el texto de hoy**: la tabla de invalidación de
`V/02` §3.2 tiene **10** filas; el inventario de consumidores de `NUCLEO/01` §2.4 tiene **20**
filas (numeradas 1-20, diez en el grupo A y diez en el B); el catálogo de acciones administrativas
de `NUCLEO/08` §3 tiene **12** filas; la tabla de retención de `B/02` §4.1 tiene **1** fila; la
tabla de lectura de `V/10` §2 tiene **6**; `NUCLEO/04` §3 tiene **16** filas. La palabra `inactiv`
aparece **11** veces en todo el corpus de capítulos y **ninguna** es una columna (medido con `rg`
sobre las dos épicas, el núcleo y el contrato). Los números que no medí yo llevan su fuente.

---

## CRITICA

### F-8eA3-001 — La clave de deduplicación del outbox sólo lleva la fecha objetivo para el trial: con el reloj de retención ya reiniciable, los dos avisos del borrado se mandan UNA vez en la vida de la ficha y el segundo ciclo hard-deletea el contenido sin avisar ni dejar exportar

**Qué se rompe.** Una persona pausa su suscripción, su ficha baja por `PB2`, `PB4` la archiva el
día 90 y recibe sus dos avisos —el previo al 90 y el previo al 180—. Reanuda antes del 180:
`cubierto` vuelve a verdadero, **el reloj se reinicia** (hecho 2) y `PB7` la republica. Meses
después vuelve a pasar lo mismo —o simplemente deja de pagar—. El reloj arranca de cero, el día 90
llega otra vez y el día 180 también. **Esta vez no le llega ningún aviso**: la clave
`(destinatario, plantilla, ocurrencia)` es la misma que la primera vez, así que la restricción de
unicidad suprime los dos envíos como duplicados. El día 180 el contenido publicable de la ficha
—textos, fotos, FAQ, horarios— **se borra**, y la persona nunca supo que iba a pasar ni tuvo la
ventana para exportarlo. El diseño dice, con todas las letras, que esa ventana es la condición
bajo la cual el borrado es defendible.

**El camino.**

1. La clave es una columna con restricción de unicidad, no una convención: `NUCLEO/07` §2 —
   *«**La clave de deduplicación, y es una columna con restricción de unicidad:**
   `(destinatario, plantilla, ocurrencia)`»*.
2. Y la ocurrencia de un correo de schedule **es el sujeto más el hito**, sin fecha: `NUCLEO/07`
   §2 — *«| de **schedule** (avisos previos, campaña, recordatorios de renovación) | el sujeto más
   el hito: `trial:<id>:pre:-2d`, `sub:<id>:renov:-5d` |»*. Los dos avisos de retención son de
   schedule: `NUCLEO/07` §6 — *«| retención | transaccional | **antes del día 90**, al archivar y
   **antes del día 180** |»*.
3. La única excepción declarada es el trial, y está escrita como excepción: `NUCLEO/07` §2 —
   *«**Un caso que esto tiene que dejar pasar a propósito**: si el trial se extiende (T4 del cap.
   03), el aviso de «faltan 2 días» **corresponde de nuevo** contra la fecha nueva. La ocurrencia
   entonces **incluye la fecha objetivo vigente**, no un contador»*. Está escrita para **un**
   sujeto —el trial— y nombra **una** transición —`T4`—. La retención no aparece.
4. Y el reloj de retención pasó a comportarse igual que un trial extendido, en esta misma tanda:
   `NUCLEO/01` §1.2 — *«**Los cuatro hechos que reinician la inactividad, y la lista es
   cerrada**»*, con el hecho 2 *«**`cubierto` pasa a verdadero**»* que *«**Reinicia por sí solo**,
   aunque la ficha no vuelva a publicarse»*. Antes de `DEC-DATA-002` el reloj no se reiniciaba
   —`NUCLEO/01` §1.2 lo declara: *«Lo que se retira es que el reloj fuera monótono»*—, así que
   cada ficha cruzaba el día 90 y el día 180 **una sola vez en su vida** y una ocurrencia sin
   fecha era exacta.
5. Y no hay una segunda red del lado del envío: `NUCLEO/07` §2 — *«**La clave se calcula antes de
   encolar, no antes de enviar**»*, así que la segunda ocurrencia **ni siquiera llega a la cola**:
   no queda `failed`, no se reintenta y no escala por `NUCLEO/07` §1.3. Desaparece en silencio.
6. Y lo que se pierde es irreversible y el propio capítulo lo dice: `V/02` §4.2 regla 3 — *«**El
   día 90 no borra nada.** … **Poder exportar antes es lo que hace defendible el hard delete del
   día 180**, y los avisos son correos transaccionales no suprimibles: **tres**»*. `NUCLEO/07`
   §4.1 sube la apuesta en esta misma tanda: *«si cayeran bajo el opt-out comercial, **se dejaría
   de avisar justo a quien está por perder su contenido**»*. El mecanismo que este § blinda contra
   el opt-out queda abierto por la clave.
7. Y la población no es marginal: es **exactamente** la que `DEC-DATA-002` vino a proteger.
   `V/02` §4.2 regla 4 — *«**Su caso testigo es la pausa** … Alguien pausa hasta 4 pausas-mes
   —unos 120 días— … lo único que separa a ese cliente del borrado es que **120 < 180** y que
   **reanudar reinicie**»*. Reanudar reinicia el reloj **y también deja los dos avisos del
   siguiente ciclo sin poder salir.**

**Dónde lo permite el diseño.** `NUCLEO/07` §2 (la clave, la tabla de ocurrencias y la excepción
del trial), `NUCLEO/07` §6 (la fila de retención) y §4.1, contra `NUCLEO/01` §1.2 (los cuatro
hechos) y `V/02` §4.2 reglas 3 y 4.

**Severidad.** `CRITICA`. **Un dato se pierde sin vuelta**: el contenido publicable de la ficha de
un cliente que pausó, reanudó y volvió a caer se borra el día 180 sin el aviso que el diseño
declara como la condición de que ese borrado sea defendible, y sin la ventana de exportación que
ese aviso abre. No falla ruidosamente: la fila nunca se encola, así que no hay `failed` que
escalar ni nadie que se entere.

**Marcá `NUCLEO`** — la clave vive en `NUCLEO/07` §2.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: `DEC-DATA-002`** (`621332e7c`). La clave sin
fecha es anterior y era **correcta**: con el reloj monótono —la lectura que `NUCLEO/01` §1.2
declara retirada en esta misma tanda— una ficha cruzaba cada hito una sola vez y una ocurrencia
por sujeto+hito era única por construcción. El arreglo volvió reiniciable el reloj y no tocó la
clave. Es el mismo modo que el propio `NUCLEO/07` §2 ya había tenido que resolver para el trial,
un ciclo antes, sin generalizarlo.

**¿Lo habría encontrado el grep?** **No.** Los términos que `621332e7c` redefine son
`inactividad`, los cuatro hechos, `PB7`, `PB8`, `D16` y `G-R5`, más el término viejo que retira,
`monótono`. **Ninguno de los siete aparece en `NUCLEO/07` §2** — lo verifiqué: ese § habla de
`ocurrencia`, `plantilla`, `destinatario` y `T4`, y la palabra `retención` no aparece hasta el §6.
El grep del término nuevo **sí** llega a `NUCLEO/07` §6, que el commit editó; el §2 queda fuera de
su alcance por completo.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y la enmienda no alcanza.** La
obligación 2 manda escribir, por aparición, las que **no se corrigen y viven en un párrafo que el
commit no tocó**. `621332e7c` **sí tocó** `nucleo/07`, pero en dos hunks —§4.1 y §6, medidos con
`git show`— y **no tocó el §2**; el problema no es ése: es que en el §2 **no hay ninguna
aparición** que recorrer. Lo que el arreglo creó no es una aparición nueva de un término sino una
**propiedad** nueva del sujeto —*«este reloj ahora se reinicia»*—, y una propiedad no tiene término
que buscar. La pregunta que lo encuentra es *«¿qué cuelga de este reloj y asume que corre una sola
vez?»*, que es un recorrido de consumidores y no una búsqueda de texto. Es el mismo modo que
`DEC-METH-010` llama el quinto —el que motivó `D16`— aplicado a un schedule en vez de a un número.

---

### F-8eA3-002 — El reloj de inactividad no tiene columna en ninguna entidad y su hecho de reinicio más importante se lee de un aviso que el propio contrato prohíbe usar para decidir: `PB4`, `PB5`, el día 180 y la fecha que `V/19` obliga a imprimir leen un instante que nadie guarda

**Qué se rompe.** La inactividad decide **cuándo se borra el contenido de una ficha**, que es la
única operación irreversible sobre datos del cliente en todo el programa. Su valor es *«el más
reciente de cuatro hechos»*, y **ninguna entidad del modelo tiene una columna donde ese instante
viva**. Peor: el hecho que salva al cliente que volvió —`cubierto` pasando a verdadero— se declara
legible **del aviso que billing empuja**, y el contrato dice textualmente que decidir con ese
aviso es el error que prohibió para los eventos del proveedor. Un aviso que se pierde, llega tarde
o se procesa dos veces deja el reloj corriendo sobre alguien que volvió, y el día 180 le borra el
contenido.

**El camino.**

1. El término y su definición: `NUCLEO/01` §1.2 — *«| **Inactividad** (de una ficha) | El tiempo
   que lleva **sin estar a la vez publicada y cubierta**, contado desde **el más reciente de los
   cuatro hechos que la reinician** |»*.
2. Lo conté: **la palabra `inactiv` aparece 11 veces en los capítulos, el núcleo y el contrato, y
   ninguna es una columna.** La entidad `listing` guarda exactamente cuatro cosas: `V/02` §2.5 —
   *«| **`listing`** | vertical, **un solo `owner_user_id`** (§6), estado del cap. 03 §9, contenido
   |»*. No hay `inactiva_desde`, ni fecha de archivado, ni nada equivalente, ni en `V/02` §2 ni en
   `NUCLEO/02` §2.6.
3. Los cuatro consumidores que leen ese instante: `PB4` (día 90) y `PB5` (N meses) en `V/03` §9;
   el hard delete del día 180 en `V/02` §4.1 —*«**Los dos días se cuentan sobre la misma
   inactividad**»*—; y los dos avisos de schedule de `NUCLEO/07` §6.
4. Y desde esta tanda hay un quinto, que **obliga a imprimir el número**: `V/19` §4 fila 18 — el
   aviso de ficha archivada tiene que decir *«… y **la fecha** a partir de la cual el contenido sí
   se borra»*; `NUCLEO/07` §6 lo repite: *«y **desde cuándo se cuentan los 180**»*. Una superficie
   no puede imprimir una fecha que ninguna fila guarda.
5. El hecho 2 se declara legible de un push: `NUCLEO/01` §1.2 — *«| 2 | **`cubierto` pasa a
   verdadero** | **el aviso del contrato** ([`12-contrato-de-cobertura.md`](../12-contrato-de-cobertura.md)
   §3) | … Reinicia **por sí solo**, aunque la ficha no vuelva a publicarse |»*.
6. Y el contrato prohíbe exactamente eso, en el § que la celda cita: `12-contrato…` §3 — *«**El
   evento no reemplaza la consulta.** … Un consumidor que decidiera con lo que trae el evento
   estaría **creyéndole a un mensaje en vez de al estado**, que es el error que el capítulo 03 §10
   ya prohibió para los eventos del proveedor»*. El reloj de inactividad **decide**: decide borrar.
7. Y los otros tres hechos sí tienen fuente durable declarada —el registro append-only (hechos 1
   y 3) y `vertical.fin_de_servicio` (hecho 4, aunque la celda lo atribuya a `B/10` §4 en vez de a
   la columna, que es de **esta** épica: `V/02` §2.1)—. El hecho 2 es **el único de los cuatro sin
   estado detrás**, y es justamente el que *«impide que el día 180 alcance a alguien que volvió»*
   (`V/02` §4.1).
8. La dirección en que falla es la cara: si el aviso se pierde, el reloj **no** se reinicia y el
   borrado ocurre. `V/02` §3.2 regla 2 ya declara que la pérdida de un push de este mismo canal es
   tolerable para el caché —*«Si la invalidación falla, la operación de dominio no falla»*—, o sea
   que el diseño **ya asume** que estos avisos se pierden, y en el caché eso sólo cuesta
   rendimiento. Acá cuesta el contenido.

**Dónde lo permite el diseño.** `NUCLEO/01` §1.2 (la definición y la tabla de los cuatro hechos),
`V/02` §2.5 (la entidad `listing`), `V/02` §4.1 y §4.2, `V/03` §9 (`PB4`, `PB5`), `V/19` §4 fila
18, `NUCLEO/07` §6, contra `12-contrato…` §3.

**Severidad.** `CRITICA`. **Un dato se pierde sin vuelta.** El hard delete del día 180 se ejecuta
sobre un instante que no está guardado en ninguna parte y cuyo reinicio más importante depende de
que un mensaje llegue. Es el mismo desenlace que `F-8cC1-001` denunció y que `DEC-DATA-002`
declaró cerrado —*«se le borra el contenido a un cliente que no canceló nada»*—, reabierto por la
implementabilidad de su propio arreglo.

**Marcá `NUCLEO`** — la definición y los cuatro hechos viven en `NUCLEO/01` §1.2.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: `DEC-DATA-002`.** Antes de esta tanda la palabra
*«inactividad»* aparecía **una sola vez en todo el corpus y sin definición** —lo declara el propio
`NUCLEO/01` §1.2—, así que no había cuatro hechos cuya procedencia exigir ni un instante que
guardar: la lectura literal (*el tiempo desde que dejó de estar publicada*) se derivaba de la
máquina de publicación, que sí tiene estado. El arreglo le dio al reloj una definición que **no se
deriva de ninguna máquina** y no le dio dónde vivir.

**¿Lo habría encontrado el grep?** **No.** El término nuevo es `inactividad` y el término viejo
que se retira es `monótono`. Grepear `inactividad` llega a `V/02` §4.1, `V/03` §9 y `NUCLEO/04`
§3 —los tres **dentro** del commit— y a ninguna tabla de entidades, porque **una entidad que no
existe no contiene el término**. El defecto es la ausencia de una columna, y el grep devuelve
presencias. Es el tercer modo que mi informe anterior ya nombró (`F-8dA3-008`, `F-8dA3-013`), acá
sobre el dato más caro del capítulo de retención.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y la enmienda no alcanza — con una
mitad que sí.** La mitad que **no**: no hay aparición que recorrer en `V/02` §2.5, porque el
defecto es que falta la fila. La mitad que **sí**: la celda del hecho 2 en `NUCLEO/01` §1.2 **es**
una aparición, está en un párrafo que el commit **escribió**, y la obligación 1 de `DEC-METH-010`
dice explícitamente que *«un archivo abierto no es un párrafo leído»* — pero la obligación 2 sólo
manda escribir el rastro de las apariciones **no corregidas y en párrafos no tocados**, y ésta es
una aparición **nueva**. O sea: la enmienda cubre lo que el arreglo deja atrás y **no cubre lo que
el arreglo escribe**, que es donde vive la mitad de este defecto. Es una asimetría que conviene
que `C1` mida, porque es estructural: el commit que crea una fuente inexistente la crea **en el
párrafo que él mismo escribió**.

---

## ALTA

### F-8eA3-003 — `D16` declara que sus dos cifras «son configuración» y `G-R5` las compara, y ninguna de las dos es una columna de ninguna entidad de ninguna de las dos épicas: el único apoyo del invariante que impide que una pausa borre contenido no tiene qué leer

**Qué se rompe.** `D16` es un invariante **de guard** —el escalón que `NUCLEO/04` §1 reserva para
*«una propiedad del código»*— y su enunciado dice que las dos cifras que compara **son
configuración**. Un guard que compara dos números de configuración necesita dos lugares de donde
leerlos. No hay ninguno: ni el tope de una pausa ni el día del hard delete son columnas de ninguna
entidad. Quien implemente `G-R5` va a comparar **dos literales escritos en dos capítulos**, que es
exactamente la *«premisa que envejece sola»* que `D16` existe para no ser.

**El camino.**

1. El enunciado: `NUCLEO/04` §3 — *«| D16 | **El tope de una pausa, en días, es menor que el día
   del hard delete.** … **Las dos cifras son configuración**, así que el invariante es la relación
   entre ellas y nunca los números | … | **guard**: compara el tope de pausa del catálogo contra el
   día del hard delete |»*.
2. Los dos guards lo repiten diciendo **catálogo**: `V/20` §2 — *«| G-R5 | el **tope de una pausa**
   que declara el **catálogo**, pasado a días, **alcanza el día del hard delete** |»*; `B/20` §2 —
   *«el tope de una pausa que declara el catálogo —cap. 03 §5 de **esta** épica—»*.
3. El tope no está en el catálogo. Lo que `B/03` §5 escribe es prosa: *«| **límites** | los del
   §26.3, reexpresados en meses: **4 pausas-mes** por pausa y **8** acumulados en 12 meses; máximo
   3 pausas por ventana |»*. Y lo que la entidad guarda es **otro dato**: `V/02` §2.1, fila
   `plan_version` — *«`rank`, si es vendible, días de grace, días de trial, **si permite pausa**,
   si hereda Turista VIP»*. `permitePausa` es un booleano; el **tope** no está. Lo verifiqué con
   `rg` sobre las tablas de entidades de las dos épicas: cero apariciones de `pausas-mes` o de un
   equivalente en una fila de entidad.
4. El día del hard delete tampoco: `V/02` §4.1 lo escribe como número en prosa —*«**Se borra** al
   día 180»*— y `V/02` §2 no tiene ninguna entidad de configuración de retención. La única cifra
   de esa familia que el diseño **sí** declara configurable tiene su declaración escrita: `V/03`
   §9, `PB5` — *«`N` es configuración»*. Para el 90 y el 180 no hay ninguna frase equivalente.
5. Y el guard es el **único** apoyo: `NUCLEO/04` §3 no le da a `D16` ni base ni servicio, y
   `NUCLEO/04` §5 lo cuenta en la columna de guards (6, con `D16` agregado). Sin dato que leer, el
   apoyo no existe y `D16` cae al escalón *«no verificable»*, que `NUCLEO/04` §1 obliga a
   **declarar como tal**.
6. Lo que eso cuesta está medido en el propio capítulo: `NUCLEO/04` §3 — *«`D16` existe porque la
   alternativa era una premisa que envejece sola … **nadie vuelve a mirar el día que alguien suba
   el tope de pausa a siete meses**»*. Con el guard sin fuente, el día que alguien suba el tope
   nadie lo mira igual.

**Dónde lo permite el diseño.** `NUCLEO/04` §3 (`D16`) y §5, `V/20` §2 y `B/20` §2 (`G-R5`),
contra `B/03` §5, `V/02` §2.1 y `V/02` §4.1.

**Severidad.** `ALTA`. No rompe hoy: 120 < 180 es cierto. Lo que rompe es que la única defensa
contra que deje de serlo **no tiene de dónde leer ninguno de los dos números**, y la consecuencia
declarada de que deje de serlo es el borrado del contenido de un cliente al día. No es `CRITICA`
porque hace falta un cambio de configuración deliberado, y porque el guard con dos literales
igual falla si alguien edita el literal del capítulo.

**Marcá `NUCLEO`** — `D16` vive en `NUCLEO/04` §3.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: `DEC-DATA-002`.** `D16` y `G-R5` nacen en esta
tanda; los dos números son anteriores y ninguno tenía por qué ser una columna hasta que un
invariante se apoyó en su relación.

**¿Lo habría encontrado el grep?** **No.** Los términos nuevos son `D16` y `G-R5`, y grepearlos
llega a los tres lugares que el commit escribió (`nucleo/04`, `V/20`, `B/20`) y a `B/03` §5 y
`V/02` §4.1 por la remisión — pero en ninguno de esos dos el término aparece: aparecen los
**números**. Para llegar a *«¿dónde vive el 4?»* y *«¿dónde vive el 180?»* hay que grepear cifras
sueltas, que es ruido, o recorrer las tablas de entidades preguntándose por la ausencia.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** Las apariciones de `D16` y `G-R5`
están **todas** en párrafos que el commit escribió o editó —los conté: `nucleo/01` §1.2 y §3,
`nucleo/04` §3 y §5, `V/02` §4.2, `V/03` §9, `V/20` §2, `B/03` §5 y §10, `B/20` §2, y el log—, así
que la obligación 2 —que sólo manda escribir el rastro de las **no corregidas en párrafos no
tocados**— tiene **población vacía** para este término. El defecto está en un párrafo donde el
término **no** aparece (la fila `plan_version` de `V/02` §2.1) y que el commit no tenía motivo
para abrir.

---

### F-8eA3-004 — El corte escribe cinco clases de fila y su procedimiento declara una: los dos grants del owner y sus anclas no son ningún paso de `16-fase-7` §4.2, y el `piso_del_trinquete` del ancla es no anulable sobre una versión de plan que no existía el día que esa cortesía se firmó

**Qué se rompe.** El único documento que fija **el orden del corte** —una secuencia con gate, sin
rollback y con un punto de no retorno— tiene cuatro pasos y declara que el cuarto *«es la única
escritura del corte»*. Pero el corte escribe además **dos `permanent_grant` y sus anclas**, que son
lo que sostiene la cobertura de dos cuentas desde el primer minuto, y una de las columnas de esas
anclas **no se puede completar con ningún valor honesto**, porque referencia una versión de plan
que el corte está sembrando esa misma noche.

**El camino.**

1. El procedimiento: `16-fase-7` §4.2 — cuatro pasos, y *«**El paso 4 es la única escritura del
   corte, y es a mano.** Las lápidas hacen reconocible un cobro viejo…»*. Los grants no son ningún
   paso; el § agrega un *«quinto acto que no es del sistema: las llamadas»*, que tampoco los
   nombra.
2. Billing dice lo mismo desde la otra punta: `B/21` §2.5 — *«**Ésta es la única fila que el
   sistema nuevo sí escribe**»*, y `B/21` §4 — *«Lo único que se escribe es la lápida del §2.5»*.
3. Y el § inmediatamente anterior del **mismo archivo** dice lo contrario: `B/21` §2.4 — *«**Las
   dos cortesías se escriben como `permanent_grant`**, exactamente como el *Free Forever* del
   diseño nuevo»*, y *«**un ANCLA por cada vertical de su scope, sobre UNA sola fila de grant** …
   Lo que se multiplica es la fila de `permanent_grant_vertical`»*. Son **como mínimo cuatro
   filas** más la lápida: dos grants y dos anclas.
4. Verticales depende de que existan y lo declara: `V/21` §2.4 punto 1 — *«**No es cierto que
   «nadie tiene un título vivo»** … la otra mitad del corte **escribe dos `permanent_grant`** en el
   mismo acto»*, punto 2 — *«**Y por eso `PB2` tampoco las alcanza** … lo de abajo vale para seis
   de las ocho»*, y punto 3 — *«**El orden entre la escritura de los dos grants y el paso 4 no está
   fijado en ningún lado, y hay que fijarlo en el procedimiento del corte**»*. El procedimiento
   sigue sin fijarlo y sin nombrarlas.
5. Y la columna que no se puede escribir: `B/02` §2.4 — *«| **`permanent_grant_vertical`** | … el
   `plan` que otorga en esa vertical y **el piso del trinquete de esa vertical** | … **el piso
   tampoco es anulable** |»*, con su significado en `B/02` §2.4 —*«la referencia a la versión de
   **ESE** plan que estaba vigente **el día que se firmó**»*— y en `V/15` §2.5 —*«Su piso es **lo
   que ese plan otorgaba el día que se firmó el grant**»*. Las dos cortesías del owner se firmaron
   bajo el sistema viejo; la versión de plan vigente ese día **no existe en el modelo nuevo**,
   porque `V/21` §2.4 declara que *«del lado de verticales **no se escribe ninguna fila**»* y el
   catálogo se siembra desde cero (`12-contrato…` §5.1: *«Lo único que se siembra son las versiones
   de plan del catálogo»*).
6. Las dos ramas son malas y ninguna está declarada: apuntar el piso a la versión que se acaba de
   sembrar convierte el trinquete en un no-op **para siempre** sobre el instrumento más caro del
   sistema, sin que nadie lo haya decidido; no poder apuntarlo deja la fila sin escribir y con ella
   las dos cuentas amanecen `cubierto` falso, que es la rama que `V/21` §2.4 punto 2 declara
   descartada.

**Dónde lo permite el diseño.** `16-fase-7` §4.2, `B/21` §2.4, §2.5 y §4, `V/21` §2.4 puntos 1-3,
`B/02` §2.4 (`permanent_grant_vertical`), `V/15` §2.5.

**Severidad.** `ALTA`. El daño inmediato es chico y conocido —las dos cuentas son del owner y
*«regenerables de cero»* (`B/21` §2.4)—, pero el procedimiento del único momento del programa sin
rollback **omite una escritura de la que depende el estado de dos cuentas**, y la columna no
anulable sin fuente honesta no es un problema del corte: **lo hereda todo grant que se escriba
fuera del flujo normal**, que es precisamente lo que `B/21` §2.5 acaba de advertir para las
lápidas (*«cualquier escritura manual futura hereda el mismo agujero»*).

**¿Es nuevo, o es el arreglo?** **Sigue llegando, y creció.** Es `F-8cA3-013` con su ID viejo: en
la 8-bis-2 eran *«tres clases de fila»* contra *«la única fila»*; hoy son **cinco** y el
procedimiento sumó un quinto acto que tampoco las nombra. La mitad del `piso_del_trinquete` **sí
es de un arreglo** —el 4 de la 9-bis-2, que creó `permanent_grant_vertical` con esa columna no
anulable—, y ninguna de las dos tandas siguientes la miró contra el corte.

**¿Lo habría encontrado el grep?** **No para la mitad nueva.** El término es
`permanent_grant_vertical` / `piso_del_trinquete`, y **`16-fase-7` §4.2 no escribe ninguno de los
dos**: habla de preapprovals, despliegue y lápidas. `B/21` §2.4 **sí** los escribe y se editó, y es
exactamente el párrafo que afirma *«no hace falta inventar nada para cortesías heredadas, son el
caso normal»* sin preguntarse de dónde sale el piso de una cortesía heredada.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Parcialmente, y la mitad que importa no.**
`B/21` §2.4 es una aparición del término y el commit del arreglo 4 la corrigió —hoy cita
`permanent_grant_vertical` por nombre—, o sea que la obligación 2 no la alcanza (fue corregida). La
aparición que había que resolver es la **contradicción con el § de al lado** (`B/21` §2.5, *«la
única fila»*), que **no contiene el término** y está en un párrafo que el commit no tocó: no
figura en lo que la obligación 2 manda escribir. Es el caso en que la enmienda se cumple al pie y
no sirve, porque lo que quedó inconsistente es **un conteo en prosa**, no una aparición.

---

### F-8eA3-005 — La fila de `trial` que `T6` escribe «consumida, sin reloj» —y desde esta tanda también `T7`— no se puede expresar: la entidad exige inicio, fin y el piso del trinquete, y ninguno de los tres existe en una fila que nunca arrancó

**Qué se rompe.** Dos de las tres transiciones que salen de `PRE_TRIAL` escriben una fila que la
entidad no admite. La consecuencia no es cosmética: la fila de `trial` es **la única evidencia de
por vida** de que alguien ya consumió su prueba (`V/02` §4.1: *«la evidencia … tiene que sobrevivir
al borrado o el borrado se convierte en la forma de conseguir otro»*), y `T7` existe precisamente
para escribirla **sobre una cohorte entera el día del encendido**. Si la fila no se puede escribir,
esa cohorte se queda en `PRE_TRIAL` y el día que publique dispara `T1`: trial completo con las
capacidades del plan de `rank` más alto, gratis, para toda la cartera de ex-clientes de la
vertical a la vez.

**El camino.**

1. Lo que las dos transiciones escriben: `V/03` §2 — `T6`, efecto *«**crea la fila de `trial`,
   consumida**, sin reloj y sin campaña»*; `T7`, efecto idéntico *«**crea la fila de `trial`,
   consumida**, sin reloj y sin campaña»*.
2. Lo que la entidad exige: `V/02` §2.2 — *«| **`trial`** | `user`, vertical, estado del cap. 03
   §2, referencia al plan de trial, **referencia a las versiones vigentes al arrancar** (el piso
   del trinquete), **inicio**, **fin** y **el hash irreversible del correo normalizado** |»*. Ni
   `inicio`, ni `fin`, ni el piso se declaran anulables, y la fila *«sin reloj»* no tiene ninguno
   de los tres: no arrancó, así que no hay *«versiones vigentes al arrancar»*.
3. Y el piso no es decorativo: `V/02` §2.2 — *«**El piso del trinquete se guarda como referencia a
   versiones, nunca como copia de valores**»*, apoyado en `DEC-TRIAL-002`. Es un dato que sólo
   tiene sentido si el trial corre.
4. El consumidor que se cae si la fila no se escribe: `V/11` §8.3 paso 3 — *«**ejecutar `T7` sobre
   la cohorte** … entre el paso 2 y éste, cualquier ex-cliente que publique se lleva un trial
   completo. **La ventana tiene que ser cero**»*. Una fila que no se puede escribir hace que la
   ventana sea infinita.
5. Y la otra mitad es la unicidad: `V/02` §2.2 declara `UNIQUE(user_id, vertical)` *«sin condición
   de estado»* porque *«su sola existencia niega un trial nuevo»*. Toda la defensa del §10.2 sobre
   `T6` y `T7` descansa en escribir esa fila.

**Dónde lo permite el diseño.** `V/03` §2 (`T6`, `T7`), `V/02` §2.2 (la entidad), `V/11` §8.3.

**Severidad.** `ALTA`. La dirección es *«no se puede hacer»* hasta que alguien lo implemente con
columnas anulables —que es lo que va a pasar— y ahí la fila nace sin que nadie haya decidido qué
significa un `trial` sin piso ni fechas. Si en cambio se resuelve no escribiendo la fila, el
resultado es un trial completo regalado a una cohorte entera, que es el daño que `T7` vino a
cerrar.

**¿Es nuevo, o es el arreglo?** **Sigue llegando, y el arreglo 2 le agregó una segunda fila.** Es
`F-8cA3-008` con su ID viejo, reportado sobre `T6` en la 8-bis-2 y confirmado *«SIGUE, entero»* en
la 8-bis-3. Lo que cambió en esta tanda es que **`T7` es nueva** (`1e3c3fc9e`, arreglo 2) y escribe
**la misma fila imposible**, declarándolo por escrito: *«es la misma escritura de `T6`, con otro
disparador»*. El arreglo copió el efecto sin volver a mirar la entidad, que es el mismo movimiento
que el informe anterior midió.

**¿Lo habría encontrado el grep?** **Sí.** El término es `T6` —que `T7` cita ocho veces en `V/03`
§2 y `V/11` §8— y `1e3c3fc9e` **tocó `V/02`**, donde vive la entidad. Grepear `trial` sobre `V/02`
llega derecho a §2.2, que es el párrafo exacto. La búsqueda alcanzaba con el término más obvio del
commit.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, porque la aparición está DENTRO del
archivo tocado y no fue tocada — y ahí es donde la obligación 2 sí manda escribir.** `1e3c3fc9e`
editó `V/02` (el párrafo de `vertical.evento_de_activacion`, §2.1) y **no editó §2.2**. La fila
`trial` de §2.2 es una aparición **no corregida**, en un **párrafo que el commit no tocó**, del
término central del commit. Cae **exactamente** dentro de lo que la obligación 2 manda escribir
una por una. **La enmienda alcanzaba y no se ejecutó sobre esta aparición** — y el commit declara
*«72 apariciones no corregidas quedaron justificadas una por una»*, que es la cifra más alta de la
tanda. Es el dato más limpio que esta pasada produce sobre `DEC-METH-010`: el único commit que
reporta un rastro por aparición **dejó pasar una aparición que su propio rastro tenía que
contener**.

---

### F-8eA3-006 — Una cortesía durante el trial sigue sin poder tener fila: `courtesy_grant.subscription_id` no es anulable y quien está en trial no tiene suscripción; tres capítulos la siguen contando contra el techo y una transición la sigue nombrando como evento

**Qué se rompe.** El §34.1 del PDR —una cortesía durante el trial extiende el trial— sigue vivo
como camino en cuatro lugares, incluido el **evento de una transición**, y la entidad que lo
soportaría no lo admite. El acto no tiene fila, así que no se audita, no tiene origen, y el techo
de días que `V/11` §3 construyó no puede contarlo.

**El camino.**

1. La entidad, hoy: `B/02` §2.4 — *«| **`courtesy_grant`** | beneficiario, días o meses, inicio,
   fin, quién lo firmó, motivo, **la suscripción que pausa** | … la suscripción **no es anulable**
   y **se re-apunta en `S18`** (§2.6); **sin `scope`** — la cortesía es por suscripción
   (`DEC-GRANT-006`) |»*. La 9-bis-3 **le agregó** una obligación más a esa columna —el re-apunte
   de `S18`— y **no la volvió anulable**.
2. La transición la sigue nombrando como evento: `V/03` §2 — *«| T4 | `TRIAL_ACTIVE` | **promo de
   extensión o cortesía** | `TRIAL_ACTIVE` | sólo durante `TRIAL_ACTIVE` (§32) | corre la fecha de
   fin; **re-agenda** la campaña previa |»*.
3. El techo la sigue contando: `V/11` §3.2 — *«Toda extensión cuenta contra ese mismo techo, venga
   de un promo del §32 o de **una cortesía del §34.1**»*.
4. Billing la sigue declarando resuelta allá: `B/14` §4.5 — *«**Extensión de trial + cortesía
   durante el trial.** **Ya está resuelto en el capítulo 11 (épica de verticales) §3**: las dos
   extienden, **acumulan contra un único techo**»*.
5. Y `V/11` §7 la vuelve a usar como caso vivo al razonar sobre el cruce: *«una cortesía sobre
   alguien en `TRIAL_EXPIRED` no tiene nada que extender: el §34.1 extiende **el trial**, y ahí ya
   no hay uno»* — lo que presupone que sobre alguien en `TRIAL_ACTIVE` **sí** lo hay.
6. Las dos lecturas posibles siguen siendo las dos malas: instrumentada con `courtesy_grant`, la
   fila no se puede escribir; no instrumentada con `courtesy_grant`, es un cuarto instrumento sin
   nombre y sin tabla que `NUCLEO/01` §1.5 —que enumera **tres** concesiones— no declara.

**Dónde lo permite el diseño.** `B/02` §2.4 (`courtesy_grant`), `V/03` §2 (`T4`), `V/11` §3.2 y
§7, `B/14` §4.5, `NUCLEO/01` §1.5.

**Severidad.** `ALTA`. Nadie paga de más ni accede de más: lo que falla es que un acto que entrega
servicio gratis —el que `D11` manda que confirme una persona— **no tiene fila donde quedar**, así
que no se audita ni se cuenta contra el único techo que existe.

**¿Es nuevo, o es el arreglo?** **Sigue llegando, entero.** Es `F-8dA3-006`, reportado la vuelta
anterior con su atribución a `DEC-GRANT-006`. Ninguno de los once commits de la 9-bis-3 lo tocó;
lo que sí hicieron fue **cargar más la columna** (`f4edbdfdf`, el arreglo 7: el re-apunte de
`S18`), lo que vuelve más caro volverla anulable.

**¿Lo habría encontrado el grep?** **Sí, y sigue siendo el mismo grep de la vuelta pasada.**
`courtesy_grant` / `cortesía` sobre los capítulos que `f4edbdfdf` no toca llega a `V/03` §2,
`V/11` §3.2 y `B/14` §4.5 — y `f4edbdfdf` **no toca ninguno de los tres** (sus 17 archivos no
incluyen `V/03`, `V/11` ni `B/14`, medido contra la tabla del §2.3 de las instrucciones). Las tres
apariciones están en la misma frase que la palabra **trial**.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí, y ésta es la segunda que la enmienda
cubría de frente.** Las tres apariciones son **no corregidas** y están en **párrafos que
`f4edbdfdf` no tocó** — caen íntegras dentro de lo que la obligación 2 manda escribir. `f4edbdfdf`
es uno de los cuatro commits de arreglo que **no reporta ninguna cifra de apariciones** (tabla
§2.3). Acá la enmienda no falló: **no se ejecutó**, y el commit lo declara al no declarar nada.

---

### F-8eA3-007 — El invariante 26 —«la instancia no repite ningún campo del producto», declarado al nivel base en dos lugares— sigue prohibiendo exactamente la columna de la que depende que publicar una versión no mueva lo ya comprado

**Qué se rompe.** El invariante 26 está declarado al nivel **base** —el que `NUCLEO/04` §1 define
como el que *«no admite ningún camino que lo esquive»*— y dice que la instancia no puede repetir
ningún campo del producto. La columna `addon_instance.addon_version_id` **es** esa repetición, y es
lo único que impide que publicar una versión nueva mueva todas las instancias vivas. Quien
implemente el invariante como está escrito borra la columna y el defecto vuelve entero.

**El camino.**

1. El invariante, en el núcleo: `NUCLEO/04` §2.1 — *«| 26 | producto de addon ≠ instancia de addon
   | **dos tablas, y la instancia no repite ningún campo del producto** |»*.
2. Y en billing, palabra por palabra: `B/02` §5 — *«| 26 · producto ≠ instancia | son dos tablas, y
   **la instancia no repite ningún campo del producto** |»*.
3. La columna que el diseño exige **es** la repetición: `B/02` §2.4 — *«| **`addon_product.version_id`**
   | **qué se vende hoy** |»* y *«| **`addon_instance.addon_version_id`** | **qué se compró**: es la
   **única** referencia que el contrato transporta para una fuente `ADDON` | **no se mueve** |»*.
   En el instante de la compra las dos valen lo mismo, por construcción.
4. El contrato la eleva a regla: `12-contrato…` §2.3 — *«Una fuente `ADDON` transporta **la versión
   que ancló la INSTANCIA al comprarse** … y **nunca** la que el producto vende hoy»*.
5. El desenlace de resolver la contradicción hacia el invariante está medido: `V/02` §2.1 — *«quien
   compró *«+30 fotos»* pasaba a tener lo que dijera la versión nueva, **sin comprar nada y sin que
   nadie se lo avisara**»*.

**Dónde lo permite el diseño.** `NUCLEO/04` §2.1 (fila 26), `B/02` §5 (fila 26), contra `B/02`
§2.4, `12-contrato…` §2.3 y `V/02` §2.1.

**Severidad.** `ALTA`. Un invariante de nivel base que el modelo viola **por exigencia** no es un
invariante: es una trampa para el que lo implemente.

**Marcá `NUCLEO`** — la fila 26 vive en `NUCLEO/04` §2.1.

**¿Es nuevo, o es el arreglo?** **Sigue llegando, entero.** Es `F-8dA3-004`. Ninguno de los once
commits lo tocó, **aunque cuatro de ellos editaron `nucleo/04`** (`1e3c3fc9e`, `f4edbdfdf`,
`4e383480d`, `621332e7c`, medido contra la tabla del §2.3) y dos editaron `B/02` §5.

**¿Lo habría encontrado el grep?** **No, y por la razón estructural de siempre.** El término es
`addon_product.version_id` / `addon_instance`, y **`NUCLEO/04` §2.1 no escribe ninguno de los
dos**: dice *«producto de addon ≠ instancia de addon»* en prosa castellana. Es el mismo agujero
que `F-8eA3-011` mide para el glosario, en el otro capítulo del núcleo que nombra entidades sin
`snake_case`.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y es el caso más limpio de que la
enmienda tiene un techo.** La obligación 2 se ejecuta **por aparición del término**, y en la fila
26 el término no aparece. Los cuatro commits que abrieron `nucleo/04` lo hicieron por `D15` y
`D16`, en el §3 y el §5; el §2.1 es otro párrafo y no contiene ninguna aparición que recorrer. La
obligación 1 —*«el alcance es todo el corpus y la unidad es el párrafo»*— lo cubriría **si se
leyera como «releer cada párrafo»**, pero lo que la obligación 2 hace verificable es el rastro por
aparición, y sin aparición no hay rastro. La única búsqueda que lo encuentra es por **sinónimo
castellano**, que es lo que la regla no distingue de ruido.

---

### F-8eA3-008 — La restricción «el plan del ancla pertenece a esa vertical» sigue obligando a billing a leer `plan.vertical`, que sigue sin estar en la dirección inversa: la regla de vigilancia del §4.2 lleva dos vueltas sin dispararse sobre su propia excepción

**Qué se rompe.** El invariante `§64.10` se apoya en una restricción de base de una tabla de
**billing** que sólo se puede evaluar leyendo una columna de una tabla de **verticales** que el
contrato no declara legible. Es exactamente el acoplamiento no declarado que el §4.1 se escribió
para cerrar, sostenido por el invariante que el propio §4.1 presenta como su mayor logro.

**El camino.**

1. La restricción: `B/02` §2.4 — *«| **`permanent_grant_vertical`** | … | **`UNIQUE(permanent_grant_id,
   vertical)`**; el plan **no es anulable** y **pertenece a esa vertical**; el piso tampoco es
   anulable |»*. Y `B/02` §5, invariante 10, al nivel **base**: *«**`UNIQUE(permanent_grant_id,
   vertical)` en `permanent_grant_vertical`, más «el plan del ancla pertenece a esa vertical»**»*.
2. El núcleo lo ratifica en esta tanda: `NUCLEO/04` §2.2, invariante 10 — *«**Y una mitad la
   sostiene la base**: el ancla de un grant es **por vertical** y **su plan pertenece a esa
   vertical**»*.
3. El contrato pide lo mismo y dice dónde tiene que vivir: `12-contrato…` §2.8 punto 1 — *«el plan
   **pertenece a la vertical del ancla**, que es la restricción que **la base** tiene que hacer
   cumplir»*.
4. A qué vertical pertenece un plan es un dato de verticales: `V/02` §2.1, fila `plan` — *«identidad
   y cosmética: **vertical**, slug, nombre… `UNIQUE(vertical, slug)`»*.
5. Y no está declarado como legible: `12-contrato…` §4.1 enumera las tres preguntas —
   `políticaDePlan → { díasDeGrace, díasDeTrial, permitePausa, vigente, vendible }`,
   `situaciónDeVertical → { admiteAltas, finDeServicio }`, `direcciónDeCambio → SUBE | BAJA`.
   **`plan.vertical` no está en ninguna de las tres.**
6. La regla que esto dispara y que nadie disparó: `12-contrato…` §4.2 — *«**si billing necesita
   leer de verticales algo que no está en los seis campos del §4.1, vale lo mismo. Una lectura no
   declarada es un acoplamiento que nadie está mirando.**»*

**Dónde lo permite el diseño.** `B/02` §2.4 y §5, `NUCLEO/04` §2.2, `12-contrato…` §2.8, §4.1 y
§4.2, `V/02` §2.1.

**Severidad.** `ALTA`. No rompe ejecutando: la restricción es correcta y necesaria. Lo que rompe es
**la única regla que vigila el corte en dos épicas**, con una excepción sin declarar justo en el
invariante que tres documentos presentan como el cierre del cruce entre verticales.

**¿Es nuevo, o es el arreglo?** **Sigue llegando, entero.** Es `F-8dA3-003`, y **se agravó**: en
esta tanda `1e3c3fc9e` escribió la mitad del invariante 10 en `NUCLEO/04` §2.2, o sea que **un
tercer documento** repite la restricción y ninguno de los tres la declara como lectura.

**¿Lo habría encontrado el grep?** **No.** El término es `permanent_grant_vertical` / el ancla, y
**no aparece en `12-contrato…` §4.1 ni en §4.2**, que hablan de planes y verticales en abstracto.
El grep que lo encuentra es el inverso —buscar `plan.vertical` contra la lista de siete campos—,
que es una búsqueda **por consumidor** y no por término redefinido.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** `1e3c3fc9e` **tocó el contrato** (está
entre sus 16 archivos), así que las apariciones de `permanent_grant_vertical` en `12-contrato…`
§2.8 están corregidas y fuera del alcance de la obligación 2. Las del §4.1 y §4.2 no existen: el
término no está ahí. Lo que hay que recorrer no son apariciones del término nuevo sino **las siete
filas de una lista cerrada**, preguntándose cuál falta — que es la obligación 4 (*«cada término que
el núcleo define lleva su lista de consumidores»*) aplicada a un término del **contrato** en vez de
del núcleo. La obligación 4 existe y **no alcanza al contrato**.

---

## MEDIA

### F-8eA3-009 — La lista de invalidación del caché tiene diez filas, su propia frase de cierre afirma once, y su segundo consumidor sigue diciendo siete

**Qué se rompe.** El reconciliador de excedentes se dispara con *«la misma lista»* que invalida el
caché, y lee un número que ya no es el de la lista. Que a veces se dispare de más es gratis; que
falte un disparo *«es una capacidad regalada o un límite incumplido»*, y es el propio capítulo el
que lo dice.

**El camino.**

1. **Las conté: `V/02` §3.2 tiene 10 filas.** En orden: cambio de plan o de ciclo · toda transición
   de suscripción · toda transición de trial · cortesía/grant/**anclaje** · addon · versión nueva de
   un plan con suscripciones · override del plan de trial · versión nueva de piso o pre-trial ·
   versión nueva de un plan con grants · versión nueva de un `addon_version`.
2. Su propia frase de cierre: `V/02` §3.2 — *«**Las cuatro últimas son de la FASE 9 y ninguna
   entraba por las siete de arriba.**»* 7 + 4 = **11**, y hay 10. Las nuevas de la FASE 9 son
   **tres** filas (las tres últimas); la cuarta novedad no es una fila sino **el inciso que esta
   tanda le agregó a la cuarta fila** —*«o se le ancla una vertical nueva a un grant vivo»*—, que
   es un acto más contado dentro de una fila que ya existía.
3. El segundo consumidor: `V/15` §4.2 — *«no hace falta una lista nueva: **es la misma lista que
   invalida el caché** (cap. 02 §3.2), con **sus siete entradas**. Una lista, dos consumidores»*.
4. Y el contrato repite la frase sin número: `12-contrato…` §3 — *«la lista de invalidación del
   caché (cap. 02 §3.2), que es la **misma lista** que dispara el reconciliador de excedentes (cap.
   15 §4.2) — *«una lista, dos consumidores»*»*.

**Dónde lo permite el diseño.** `V/02` §3.2 (las 10 filas y su frase), `V/15` §4.2,
`12-contrato…` §3.

**Severidad.** `MEDIA`. El daño concreto —que falte un disparo del reconciliador— lo acota que el
consumidor real es la lista y no el número; lo que queda mal es el único mecanismo escrito para
saber si la lista está completa.

**¿Es nuevo, o es el arreglo?** **Sigue llegando, entero.** Es `F-8cA3-012`, reportado en la
8-bis-2 y confirmado en la 8-bis-3. **La mitad que aquella vuelta declaraba agravada SÍ se
cerró**: el anclaje de una vertical nueva ya entra a la lista, en la cuarta fila, con su nota. Lo
que no se movió es ninguno de los dos números.

**¿Lo habría encontrado el grep?** **Sí.** `1e3c3fc9e` es el commit que agregó el inciso del
anclaje y **tocó `V/02`**; `V/15` **no está entre sus 16 archivos**. Grepear `invalidación` o
`§3.2` sobre los capítulos que el commit no toca llega a `V/15` §4.2 en un paso.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí, las dos mitades.** `V/15` §4.2 es una
aparición no corregida en un archivo que el commit no tocó: cae de lleno en la obligación 2. Y la
frase *«las siete de arriba»* de `V/02` §3.2 está **en el párrafo inmediatamente debajo de la tabla
que el commit editó**, que es el caso que la obligación 1 nombra por su nombre: *«un archivo
abierto no es un párrafo leído»*. Es la tercera aparición de esta pasada que la enmienda cubría y
no se ejecutó, y las tres son del mismo commit.

---

### F-8eA3-010 — Los campos de la dirección inversa del contrato se cuentan de tres maneras: el §4.1 dice siete, el §4.2 dice seis, y `V/02` dice seis

**Qué se rompe.** La regla de vigilancia que decide cuándo billing está leyendo algo que no debería
se enuncia **sobre un conteo**, y el conteo no coincide con la lista que hay tres párrafos más
arriba. Quien la aplique tiene que elegir cuál leer.

**El camino.**

1. `12-contrato…` §4.1 — *«**Son siete campos en tres preguntas**, y los dos últimos son los que
   importa declarar.»* El bloque lista 5 + 2 campos más un veredicto.
2. `12-contrato…` §4.2 — *«si billing necesita leer de verticales algo que no está en **los seis
   campos** del §4.1, vale lo mismo»*.
3. `V/02` §2.1 — *«Son dos de **los seis campos** de la dirección inversa del contrato
   (`12-contrato-de-cobertura.md` §4.1)»*.

**Dónde lo permite el diseño.** `12-contrato…` §4.1 y §4.2, `V/02` §2.1.

**Severidad.** `MEDIA`. No falla ejecutando; lo que queda ambiguo es el predicado de la única regla
que vigila la frontera en la dirección que nadie mira.

**¿Es nuevo, o es el arreglo?** **Sigue llegando, entero.** Es `F-8cA3-014`. `c29b318c7` **editó el
contrato** en esta tanda —es uno de sus 6 archivos— y corrigió el §5.1/§5.2 (cuatro fuentes contra
tres) sin mirar el §4.1/§4.2, que es **el mismo modo de defecto, en el mismo documento, dos
secciones antes**.

**¿Lo habría encontrado el grep?** **No, y por una razón que vale anotar.** El término que
`c29b318c7` redefine es *«la firma de `cobertura()`»*, y el conteo roto es el de **la otra
dirección**, que no lleva esa firma. Ninguna búsqueda por el término del commit llega ahí.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** `c29b318c7` tocó el contrato y declara
*«90 apariciones recorridas, 15 corregidas, 75 declaradas correctas con su rastro por párrafo»* —
la cifra más alta de la tanda. Pero el §4.2 **no contiene ninguna aparición de la firma**, así que
no está entre las 90; y la obligación 2 sólo manda recorrer apariciones. El commit corrigió un
conteo roto (§5.1/§5.2) y dejó otro idéntico dos secciones antes **porque el segundo no tenía
aparición que lo llevara ahí**. Es la prueba de que recorrer apariciones no es recorrer conteos,
que es lo que `NUCLEO/04` §5 ya había aprendido y documentado para sus propias notas.

---

### F-8eA3-011 — El glosario, que se declara dueño de los nombres, sigue diciendo que el producto de addon guarda la duración, los efectos y el tipo de scope; y su mapa sigue dándole al grant «su scope de verticales» y enumerando cinco fuentes de agregación

**Qué se rompe.** `NUCLEO/01` abre diciendo *«Este capítulo fija **los nombres** … **nada de lo que
esté acá se redefine en otro capítulo**»*. Por su propia regla, el glosario gana. Y el glosario
dice tres cosas que el diseño ya no sostiene: que `addon_product` guarda lo que el corte por campo
mandó a verticales, que el grant lleva un scope que dejó de ser columna, y que el conjunto efectivo
se agrega de cinco fuentes cuando el contrato tiene seis.

**El camino.**

1. `NUCLEO/01` §1.6 — *«| **Addon: producto** | La definición: **capability, precio, recurrencia,
   verticales compatibles, duración, efectos, tipo de scope** (§39). |»*, contra `V/02` §2.1 —
   *«| `addon_version` | qué otorga y con qué valores, **vigencia, tipo de scope** | **VERTICALES**
   | · | `addon_product` | **precio, recurrencia, verticales compatibles** | **BILLING** |»*.
2. La misma celda dice *«capability»* en singular y *«efectos»* en plural, que es el defecto que
   `V/02` §2.1 declara **cerrado**: *«El glosario decía *«efectos»* en plural y el modelo
   instanciaba `capability` en singular; **acá se cierra**»*. No se cerró en el glosario.
3. `NUCLEO/01` §5 — *«└── Grant permanente (§35, **con su scope de verticales**)»*, contra `B/02`
   §2.4 — *«**El scope de verticales NO es una columna: son sus anclas**»*.
4. `NUCLEO/01` §5 — *«Entitlements y limits efectivos = agregación de: **versión de plan + herencia
   Turista VIP + addons + cortesía + grant**»*. Son cinco; el contrato tiene **seis** `tipo`
   (`12-contrato…` §2.1) y el que falta es `BASE`, *«la fuente que **toda persona tiene en toda
   vertical**»* (§2.5). Y el mapa suma los addons sin la condición de `V/15` §2.6.

**Dónde lo permite el diseño.** `NUCLEO/01` §1.6, §5 y su regla de apertura, contra `V/02` §2.1,
`B/02` §2.4, `12-contrato…` §2.1, §2.5 y §2.8, `V/15` §2.6.

**Severidad.** `MEDIA`. Ningún mecanismo lee el glosario. Pero es el capítulo que el índice declara
ganador en materia de nombres, y las cuatro cosas que dice mal son cuatro que cuatro arreglos
distintos se tomaron el trabajo de cambiar en otro lado.

**Marcá `NUCLEO`.**

**¿Es nuevo, o es el arreglo?** **Siguen llegando, los dos.** Son `F-8dA3-005` (§1.6) y
`F-8dA3-010` (§5), reportados la vuelta anterior. **Siete de los once commits de la 9-bis-3
editaron `nucleo/01`** —`1e3c3fc9e`, `f4edbdfdf`, `4e383480d`, `a85f5bb7e`, `621332e7c`,
`6bac7e63a` y `456563988`, contados sobre la tabla del §2.3 de las instrucciones— y **ninguno tocó
estas dos celdas**.

**¿Lo habría encontrado el grep?** **No, y es la misma causa las dos veces.** El núcleo escribe las
entidades **en castellano** —*«Addon: producto»*, *«Grant permanente»*— y el resto del corpus en
`snake_case`. Un grep por nombre de tabla **no entra nunca al capítulo que se declara dueño de los
nombres**, y eso alcanza a las 15 filas de entidades de `NUCLEO/01` §1. Lo reporté la vuelta
anterior como límite estructural de la regla; **sigue sin cerrarse y ya produjo tres hallazgos en
dos pasadas** (éste y `F-8eA3-007`). El arreglo más barato sigue siendo el mismo: que cada término
del glosario lleve su `snake_case` al lado.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** Siete commits abrieron `nucleo/01` y
ninguno pasó por estas celdas, pero no por descuido: la obligación 2 se ejecuta por **aparición del
término**, y en `§1.6` y `§5` el término no aparece en la grafía que se busca. Es el mismo techo
que `F-8eA3-007`. Lo que lo cierra no es una enmienda al método sino **un cambio en el glosario**,
que es lo que lo vuelve alcanzable.

---

### F-8eA3-012 — La regla de vigilancia de la firma del contrato se comprueba con un `rg` que hoy devuelve DOS bloques que definen, en documentos del paraguas `status: CURRENT`; uno enumera cinco tipos y el otro se presenta como «cita textual» de un §2 que tiene cinco campos y él muestra tres

**Qué se rompe.** El cierre de la 9-bis-3 declaró que las copias de la firma eran **cuatro**, las
retiró y escribió una regla verificable para que no vuelvan. La regla nombra explícitamente a los
*«documentos del paraguas»* y trae su propio comando. Corrí el comando: **quedan dos bloques que
definen**, los dos en documentos del paraguas marcados `status: CURRENT`, y los dos con la firma
**vieja**. El conteo de cuatro era el número que el arreglo midió, no el que había.

**El camino.**

1. La regla y su comando: `12-contrato…`, encabezado — *«**Regla de vigilancia: la firma de
   `cobertura()` se enuncia acá y en ningún otro documento.** **Ningún otro capítulo, `spec.md`,
   `descomposicion.md` ni documento del paraguas** lleva un bloque que enumere sus campos … Se
   comprueba con `rg -n "cobertura\(user" .specs/` — fuera de este documento **y de los informes de
   fase**, toda aparición tiene que ser prosa que **cite**, nunca un bloque que **defina**»*.
2. Lo corrí. Fuera del contrato y de las carpetas de informes de fase quedan **tres** apariciones,
   y **dos son bloques**:
   - `15-fase-9/02-R2-resuelto.md` §1.1 (`status: CURRENT`) — un bloque completo con
     *«`tipo: TRIAL | SUSCRIPCIÓN | CORTESÍA | GRANT | ADDON`»* (**cinco** tipos: falta `BASE`) y
     *«`hasta: fecha | NO_VENCE | SIN_FECHA_CONOCIDA`»* (**tres** valores: falta `SIN_EMPEZAR`),
     más la dirección inversa con **dos** preguntas en vez de tres.
   - `15-fase-9/00-dominios-de-los-racimos.md` §1 (`status: CURRENT`) — un bloque rotulado
     ***«Cita textual, `12-contrato-de-cobertura.md` §2»*** con **tres** campos
     (`cubierto`, `fuentes: [ { tipo, versiónDePlan, hasta } ]`) donde el §2 tiene cinco. La
     etiqueta *«cita textual»* es falsa.
   - La tercera (`V/15` §2.6) sí es prosa que cita y cumple.
3. Las dos están bajo `HOS-1352-billing-verticals-redesign/docs/`, o sea **documentos del
   paraguas**, que la regla nombra por su nombre. Que estén en una carpeta cuyo nombre empieza con
   `15-fase-9` es lo único que las acerca a la exención, y la exención dice *«informes de fase»*:
   los informes de fase son los ocho vectores de `14-`, `17-`, `18-`, `19-` y `20-`, no las
   resoluciones de racimo. **Declaro esa ambigüedad y no la resuelvo yo**: si la exención se quiere
   extender a `15-fase-9/`, hay que escribirlo, porque hoy la regla se lee al revés.
4. Y el daño que la regla existe para evitar es exactamente el que estos dos bloques ya tienen:
   `12-contrato…`, encabezado — *«**las cuatro divergieron sin que nadie las tocara**: alcanzó con
   que el contrato avanzara de tres campos a cinco»*. Éstos dos divergieron por lo mismo.

**Dónde lo permite el diseño.** `12-contrato…`, encabezado (la regla y su comando), contra
`15-fase-9/02-R2-resuelto.md` §1.1 y `15-fase-9/00-dominios-de-los-racimos.md` §1.

**Severidad.** `MEDIA`. Ningún mecanismo los lee, pero el segundo está rotulado como cita textual
de un § que dice otra cosa, y los dos están marcados `CURRENT`. Y lo que queda desmentido es una
regla **cuya verificabilidad era su único valor**: una regla que trae su propio `rg` y que su
propio `rg` refuta no la vuelve a correr nadie.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: la costura, `c29b318c7`.** El commit retiró cuatro
copias y escribió la regla; el conteo de cuatro es suyo y es el que está mal.

**¿Lo habría encontrado el grep?** **Sí, y no cualquier grep: el que el propio arreglo escribió.**
El término es la firma `cobertura(user`, y el comando está en el texto del commit. `c29b318c7`
toca **6 archivos** y ninguno de los dos está entre ellos (tabla del §2.3). Correr el comando que
el commit publica devuelve las dos en un paso.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí, de frente.** Las dos son apariciones del
término, no corregidas, en párrafos que el commit no tocó: caen exactamente en lo que la obligación
2 manda escribir una por una. `c29b318c7` declara *«**90 apariciones recorridas**, 15 corregidas,
75 declaradas correctas»* — y estas dos, que son bloques que definen y no prosa que cita, **o no
estuvieron entre las 90, o fueron declaradas correctas siendo lo contrario de lo que la regla
exige**. Es el hallazgo que más directamente mide `DEC-METH-010`: el único commit que publica un
rastro por aparición, sobre el único término del corpus con comando de verificación escrito, y el
comando lo refuta.

---

### F-8eA3-013 — El techo de días de trial por vertical sigue sin columna, el origen de cada extensión tampoco la tiene, y `V/02` §2.1 sigue justificando no hacer una tabla diciendo que «hoy hay una sola cosa que configurar» sobre una fila que ya lleva cuatro

**Qué se rompe.** `V/11` §3 cierra `OD-TRIAL-01` con un número configurable por vertical, en base y
no en código. Ese número **no está en ninguna entidad**. Y `V/11` §3.5 exige mostrar *«el total
acumulado de días de trial, **con su origen**»* en dos superficies: el total podría derivarse de
`fin − inicio`, pero **el origen de cada extensión no tiene dónde vivir en ninguna de las dos
épicas** — y para una de las dos vías, la cortesía del §34.1, no hay ni siquiera una fila
(`F-8eA3-006`).

**El camino.**

1. Lo que `V/11` §3.2 exige: *«**Cada vertical declara un máximo de días de trial acumulados por
   `user + vertical`**, en base y no en código (§9)»*. Y §3.1 dice qué pasa sin él: *«Un trial puede
   crecer indefinidamente y, peor, **nadie lo ve**»*.
2. Lo que `V/02` §2.1 guarda en `vertical`: *«el espejo en base del enum de código, **su evento de
   activación**, **si admite altas** y **su fecha de fin de servicio**»* — cuatro cosas, y ninguna
   es el techo. Cero apariciones de `techo` o `máximo de días` en todo `V/02`, medido con `rg`.
3. El argumento que decide no hacer tabla, intacto: `V/02` §2.1 — *«Va en `vertical` y no en una
   tabla de configuración porque … **hoy hay una sola cosa que configurar**»*. La fila de arriba, en
   el mismo §, ya enumera **tres** configurables además del espejo, y `V/11` §3.2 pide la cuarta.
4. Y lo que la entidad `trial` guarda no incluye el origen: `V/02` §2.2 — `user`, vertical, estado,
   referencia al plan de trial, piso, inicio, fin y el hash. Nada que diga *«de estos 45 días, 30
   son del plan, 10 de un promo y 5 de una cortesía»*, que es lo que `V/11` §3.5 obliga a mostrar.

**Dónde lo permite el diseño.** `V/11` §3.2, §3.3 y §3.5, contra `V/02` §2.1 y §2.2.

**Severidad.** `MEDIA`. Las dos vías de extensión pasan por un acto humano (`V/11` §3.4), así que no
hay camino automático que lo explote; lo que falla es que el techo que `OD-TRIAL-01` declaró
cerrado no tiene dónde vivir y su superficie obligatoria no tiene qué leer.

**¿Es nuevo, o es el arreglo?** **Sigue llegando.** Es `F-8dA3-011`, con la mitad del origen que
agrego ahora. La frase *«hoy hay una sola cosa que configurar»* sigue siendo del arreglo 3 de la
9-bis-2 y ninguno de los once commits de esta tanda tocó ese párrafo, aunque `1e3c3fc9e` editó
`V/02` y `V/11` **los dos**.

**¿Lo habría encontrado el grep?** **No.** El término del commit que editó los dos archivos es
`T7` / *«el encendido»*, y `V/11` §3 no habla de `T7`: habla de un techo. La conexión es *«los dos
son configuración por vertical»*, que es semántica y no léxica.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y esta vez ni siquiera en teoría.**
`1e3c3fc9e` tocó `V/02` **y** `V/11`, así que si la aparición existiera estaría en un archivo
abierto; pero el término `T7` **no aparece** en `V/11` §3 ni en el párrafo de
`vertical.evento_de_activacion`, así que no hay aparición que recorrer. Lo que hay que preguntarse
es *«¿qué más se configura por vertical?»*, que es un recorrido de la tabla de entidades.

---

### F-8eA3-014 — `G-R2-B` lleva en `V/15` §2.5 el trabajo de vigilar el trinquete cruzado y su predicado sigue mirando sólo el plan

**Qué se rompe.** El capítulo que crea el peligro le asigna un guard; el catálogo que define el
guard verifica **la mitad**. El mensaje afirma más de lo que el predicado comprueba, que es el modo
de falla que el propio `V/20` §2.1 declara peor que no tener guard.

**El camino.**

1. Lo que `V/15` §2.5 le encarga: *«**Y se compara POR VERTICAL, que es la parte que la resolución
   no puede deducir sola.** … Un piso único para un grant de scope plural compararía las claves de
   Gastronomía contra lo que otorgaba **un plan de Alojamiento** … **entrando por el trinquete en
   vez de por la referencia**. Lo vigila `G-R2-B` (`V/20` §2)»*.
2. Lo que `V/20` §2 define: *«| G-R2-B | una fuente `GRANT` transporta **un plan de otra vertical**
   que la de la fuente | cap. 15 §2.5, `12-contrato…` §2.8 |»*. El predicado es sobre **el plan**;
   el cruce que `V/15` acaba de describir es sobre **el piso**, y son dos columnas distintas de
   `permanent_grant_vertical` (`B/02` §2.4).
3. La regla que incumple: `V/20` §2.1 — *«**el texto con que falla no puede afirmar más de lo que el
   predicado verifica**»*.
4. Y el piso es la mitad que **no** protege el `UNIQUE`: la restricción de base es
   `UNIQUE(permanent_grant_id, vertical)` más *«el plan pertenece a esa vertical»*; el piso queda
   fuera de las dos, así que el guard era su única defensa.

**Dónde lo permite el diseño.** `V/20` §2 (fila `G-R2-B`), `V/15` §2.5, `B/02` §2.4.

**Severidad.** `MEDIA`. El daño que el guard debería atrapar —un piso de otra vertical— produce un
trinquete que otorga de más o de menos, y no lo mira nadie.

**¿Es nuevo, o es el arreglo?** **Sigue llegando, entero.** Es `F-8dA3-012`. Ninguno de los once
commits tocó `V/15` ni `V/20` §2 en esa fila (`621332e7c` tocó `V/20` para agregar `G-R5`).

**¿Lo habría encontrado el grep?** **Sí**, como la vuelta anterior: el término es `G-R2-B` y sus
dos apariciones están a un grep de distancia. Pero **ningún commit de esta tanda redefine
`G-R2-B`**, así que la regla no tenía por qué correrse sobre él. Lo anoto porque el defecto no se
corta solo y ya lleva dos vueltas.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No aplica**: no lo introdujo ningún arreglo
de la 9-bis-3, así que no hay commit cuya obligación 2 tuviera que cubrirlo. Es un residuo abierto,
no una falla del método.

---

### F-8eA3-015 — `B/16` §4.3 congela «las seis transiciones que sacan a una fila principal de las filas vivas»: es una lectura derivada del término que el inventario de `NUCLEO/01` §2.4 no tiene y que `G-R1-E` por lo tanto no cuenta

**Qué se rompe.** El inventario de consumidores de *«fila viva»* existe para que el término sea
verificable —*«Esta lista es el control, no un registro»*— y `G-R1-E` lo vigila contando que no
falte una fila. Hay una clase de consumidor que el inventario no contempla y que es la más frágil
de todas: la que no pregunta *«¿esta fila es viva?»* sino **«¿qué la saca del conjunto?»**, y la
contesta con una **enumeración congelada de transiciones**. Agregar una séptima transición que
saque a una principal de las filas vivas no falla ningún guard.

**El camino.**

1. El consumidor: `B/16` §4.3 — *«**El disparador es que la fila salga de las filas vivas, y no un
   estado de llegada** … las **seis** transiciones de `B/03` §3.2 sacan a una fila principal de las
   filas vivas: `S3`, `S12`, `S13`, `S16`, `S17` y **el espejo** …»*, y su tabla — *«| **una de las
   seis transiciones saca al título de las filas vivas** | `B/03` §3.2 | es el disparador directo
   |»*.
2. El inventario y su regla: `NUCLEO/01` §2.4 — 20 filas, partidas en dos grupos por **cómo
   fallan**: A, *«Preguntan «¿ESTA fila es viva?»»*; B, *«Preguntan «¿hay OTRA fila viva
   apuntándola?»»*. Una enumeración de transiciones de salida no es ninguna de las dos.
3. El guard: `B/20` §2 — *«| G-R1-E | un predicado sobre `sucede_a` … **o un consumidor nuevo del
   término *«fila viva»* no figura en el inventario** … **o enumera el conjunto del sujeto
   equivocado** |»*. Las tres mitades del guard son sobre **predicados**; ninguna cuenta una
   enumeración de transiciones.
4. Y el propio § declara que la enumeración es frágil, en la frase de al lado: `B/16` §4.3 — *«los
   cuatro momentos … **el cuarto momento no es una transición de esa tabla**»*. Un conjunto que ya
   tuvo que declarar una excepción es exactamente el que se queda corto en el próximo cambio.
5. La tanda agregó `S20` y `S21`, las dos hacia `CANCELLED`. **Las dos son de complemento**, así que
   la cifra de seis sigue siendo correcta hoy — y lo que la mantuvo correcta es el adjetivo
   *«principal»*, no un guard.

**Dónde lo permite el diseño.** `B/16` §4.3, contra `NUCLEO/01` §2.4 (el inventario y sus dos
grupos) y `B/20` §2 (`G-R1-E`).

**Severidad.** `MEDIA`. Hoy el número es correcto, lo verifiqué contra `B/03` §3.2. Lo que falta es
el control: la próxima transición que saque a una principal del conjunto no va a hacer fallar nada,
y el consumidor que se queda corto es **el disparador del addon huérfano**, o sea una capacidad que
sigue viva sobre un título que murió.

**Marcá `NUCLEO`** — el inventario y sus dos grupos viven en `NUCLEO/01` §2.4.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 5** (`f4edbdfdf`), que creó el inventario y
`G-R1-E` con sus dos grupos, y **el 12/13**, que agregaron `S20` y `S21` a `B/03` §3.2 sin que
nadie recontara los seis. El inventario nació con dos formas de fallar declaradas y la tercera
—enumerar la salida— existía ya en `B/16` §4.3 y no entró.

**¿Lo habría encontrado el grep?** **Sí.** El término es `fila viva`, **`f4edbdfdf` toca `B/16`**
(está entre sus 17 archivos, tabla del §2.3) y este párrafo es uno de los **13** hits de `fila
viva` que conté en ese capítulo. El archivo estuvo abierto y el párrafo es alcanzable con el grep
del término más central del commit.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, porque el commit SÍ tocó el archivo.**
La obligación 2, en su versión acotada, manda escribir el rastro *«por cada aparición que no se
corrige **y está en un párrafo que el commit no tocó**»*. `f4edbdfdf` tocó `B/16` y corrigió
apariciones ahí, así que este párrafo cae en la zona que la obligación 2 **excluye** por
construcción: es un párrafo del archivo tocado, y si el que aplicó el arreglo no lo editó, la
enmienda no le pide justificarlo. La obligación 1 dice que el alcance incluye los archivos tocados
y que *«un archivo abierto no es un párrafo leído»*, pero es la **obligación 2** la que produce el
rastro verificable, y su recorte deja fuera exactamente este caso. Es el hueco del método que esta
pasada encuentra en el texto de la enmienda misma, y va para `C1`.

---

### F-8eA3-016 — El `UNIQUE(hash_del_correo_normalizado, vertical)` hace que `T1`, `T6` y `T7` no puedan escribir su fila para quien se re-registró, y ninguna máquina declara qué pasa entonces

**Qué se rompe.** La restricción que cierra el §10.2 contra el re-registro funciona **rechazando un
`INSERT`**, y las tres transiciones que salen de `PRE_TRIAL` tienen como efecto declarado *«crea la
fila de `trial`»*. Cuando el `INSERT` colisiona, la transición no ocurre, la persona **se queda en
`PRE_TRIAL`** —que no cubre— y el diseño no dice si eso es el desenlace correcto, un incidente, o
un caso que `requiere_conciliación`. Por la regla 1 del `NUCLEO/03` §1 (*«lo que la tabla no
declara no se ejecuta»*), hoy es un incidente, y no lo es.

**El camino.**

1. La restricción y su motivo: `V/02` §2.2 — *«**`UNIQUE(hash_del_correo_normalizado, vertical)`**,
   sin condición de estado … Alguien se registra de nuevo con el mismo correo, obtiene un `user_id`
   nuevo, entra en `PRE_TRIAL` y **publica**: trial gratis, las veces que quiera»*.
2. El efecto de las tres transiciones: `V/03` §2 — `T1`, *«**crea la fila de `trial`**»*; `T6` y
   `T7`, *«**crea la fila de `trial`, consumida**»*.
3. Lo que pasa cuando el `INSERT` no entra **no está escrito en ningún lado**. Lo busqué: ni `V/03`
   §2, ni `V/02` §2.2, ni `V/11` dicen qué estado queda ni qué se le contesta a la persona.
4. Y el residuo es visible para el usuario: en `PRE_TRIAL` la fuente tiene `hasta: SIN_EMPEZAR` y
   es de clase `BASE` (`12-contrato…` §2.4), así que `cubierto` es falso y `PB2` le baja la ficha
   que acaba de publicar. Puede reintentar indefinidamente, y cada intento dispara una transición
   que falla.
5. Y hay una segunda población, la que esta tanda creó: `T7` corre **sobre una cohorte, en un solo
   acto** (`V/11` §8.3 paso 3, *«la ventana tiene que ser cero»*). Si dos cuentas de la cohorte
   comparten hash en la misma vertical, el `INSERT` de la segunda colisiona y **la corrida tiene
   que decidir si aborta o sigue** — que es exactamente lo que `S13` y `S20` sí declaran para su
   caso (*«Proceso idempotente y reanudable fila por fila»*, `B/03` §3.2) y `T7` no declara.

**Dónde lo permite el diseño.** `V/02` §2.2, `V/03` §2 (`T1`, `T6`, `T7`), `V/11` §8.3,
`NUCLEO/03` §1 regla 1.

**Severidad.** `MEDIA`. La dirección es la barata —la restricción hace lo que tiene que hacer— pero
deja un estado alcanzable y no declarado, y en el caso de `T7` deja una corrida masiva sin regla de
reanudación, que es la mitad que las dos transiciones equivalentes de billing sí tienen.

**¿Es nuevo, o es el arreglo?** **Mitad y mitad.** La colisión de `T1` es anterior a esta tanda y
no la reportó nadie. La mitad de `T7` **es del arreglo 2** (`1e3c3fc9e`): una transición que corre
sobre una cohorte entera en un acto es el primer lugar del corpus donde esta colisión deja de ser
un caso por persona.

**¿Lo habría encontrado el grep?** **No.** El término es `T7` / *«el encendido»*, y `V/02` §2.2 —el
párrafo del `UNIQUE`— **no lo escribe**: fue escrito para `T1`. El commit tocó `V/02`, pero en otro
párrafo.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** No hay aparición de `T7` en `V/02`
§2.2. Lo que hace falta es preguntarse *«¿qué restricción de base puede rechazar la escritura que
esta transición declara como efecto?»*, que es un recorrido del modelo contra la tabla de
transiciones — la misma pregunta inversa que el informe `B3` de la vuelta anterior propuso para el
modo *«el defecto es una ausencia»*.

---

## BAJA

### F-8eA3-017 — La retención de billing sigue teniendo UNA fila y no nombra ninguna de las cinco entidades cuyo único valor es sobrevivir

**Qué se rompe.** `sucedida_por` se declara *«durable»* y *«no se borra nunca»*, y su durabilidad
descansa en una sección de retención que tiene una fila y no nombra a `subscription`. Lo mismo vale
para `permanent_grant`, `permanent_grant_vertical`, `courtesy_grant` y `addon_instance`.

**El camino.**

1. La promesa: `B/02` §2.2 — *«**`sucedida_por` es esa evidencia, y es durable.** … **no se borra
   nunca**»*, repetida en `NUCLEO/04` §3, `D15`, y con un consumidor que lee tarde a propósito:
   `B/16` §4.2 — *«`sucedida_por` es la misma pregunta contra un dato que **no se borra**, así que
   **se puede contestar tarde**»*.
2. La retención de billing, completa. **La conté: una fila.** `B/02` §4.1 — *«| **Se conserva
   íntegro, siempre** | pagos, reembolsos, comprobantes, el vínculo con el proveedor | los cuatro
   primeros son obligación legal y contable |»*. `subscription` no está ni entre lo conservado, ni
   entre lo anonimizado, ni entre lo borrado, y no hay ninguna otra fila.
3. Y el reloj sí existe del otro lado: `V/02` §4.1 ordena el hard delete del día 180 y conserva
   **una sola** entidad, con la nota de que *«es la **única** entidad de este modelo que lo hace»*.
4. Lo que se sumó en esta tanda: `permanent_grant_vertical` (cuyo `piso_del_trinquete` es *«la
   referencia a la versión de ESE plan»* y sólo sirve mientras el grant viva) y el nuevo *«ancla del
   grant»* de `addon_instance`. Ninguna de las dos entra en ninguna clasificación de retención.

**Severidad.** `BAJA`. Es el hueco de `B/02` §4.1 —que es `F-8B3-013` y **sigue llegando**— con dos
consumidores nuevos encima.

**¿Es nuevo, o es el arreglo?** **Sigue llegando**, con las dos columnas nuevas de los arreglos 5
y 7 apoyadas encima. Es `F-8dA3-013` de la vuelta anterior.

**¿Lo habría encontrado el grep?** **No.** El término es `sucedida_por` / `permanent_grant_vertical`
y `B/02` §4.1 **no escribe ninguna columna ni ninguna entidad**: escribe categorías. Encontrarlo
pide preguntar *«¿qué la borra?»*.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No**, por lo mismo: tres commits tocaron
`B/02` y ninguno pasó por el §4.1, porque ahí no hay aparición de ningún término de la tanda.

---

### F-8eA3-018 — `V/02` §4 cita `(§2.6)` para `domain_event` sobre un capítulo que no tiene §2.6, y `PB7` lee de esa entidad el dato que decide si una ficha archivada se republica

**Qué se rompe.** `PB7` —la salida nueva de `ARCHIVED`— decide leyendo el registro de eventos de
dominio, y el capítulo de datos de verticales remite a esa entidad con un puntero a una sección
suya que no existe. El puntero correcto es `NUCLEO/02` §2.6, que es el capítulo de **otra** mitad.

**El camino.**

1. La remisión rota: `V/02` §4 — *«Por eso `domain_event` guarda **referencias y campos que
   cambiaron, no copias** (§2.6)»*. `V/02` tiene §2.1, §2.2 y §2.5, y **no tiene §2.6**; la entidad
   vive en `NUCLEO/02` §2.6.
2. El consumidor que se apoya en ella: `V/03` §9 — *«**Y el origen no necesita ninguna columna
   nueva: ya está escrito.** El evento de dominio de `PB4` y el de `PB5` guardan *«los campos que
   cambiaron, con su valor anterior y el nuevo»* (cap. 08 §1.2, núcleo) sobre un registro
   **append-only** (§1.3)»*.
3. Y en la misma sección hay un segundo residuo de la misma clase: `V/02` §4.1, tercera fila —
   *«**el quinto es el §10.2**: el trial no se devuelve»*. *«El quinto»* no tiene antecedente: la
   tabla tiene tres filas.

**Severidad.** `BAJA`. Dos remisiones rotas en el capítulo que sostiene el mecanismo del que depende
`PB7`. Importa poco y se arregla en dos renglones; la anoto porque `PB7` es de esta tanda y su
única fuente de datos se cita mal en el capítulo que la debería declarar.

**¿Es nuevo, o es el arreglo?** **La primera mitad es anterior; el consumidor es del arreglo**
(`DEC-DATA-002`, `621332e7c`), que escribió `V/03` §9 apoyándose en la entidad sin arreglar su
remisión en el capítulo de al lado, que el mismo commit editó.

**¿Lo habría encontrado el grep?** **Sí, trivialmente**: `domain_event` aparece una sola vez en
`V/02` y está en la línea de la cita rota, dentro de un archivo que el commit tocó.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No**, con un matiz: `domain_event` no es un
término que `621332e7c` redefina, así que no entra en la obligación 2 por ninguna de sus tres
vías. Es el tipo de defecto que sólo encuentra releer el párrafo, que es lo que la obligación 1
pide y lo que ningún rastro registra.

---

### F-8eA3-019 — `B/16` §3.1 sigue diciendo que la instancia «dice que su título es el grant» y que «es un campo que el modelo ya necesita, no uno nuevo», sobre la columna que esta tanda creó y que apunta al ANCLA

**Qué se rompe.** El § que declara qué se registra cuando un addon pasa a costo cero nombra un
referente —*«el grant»*— que ya no es el de la columna, y afirma que el campo no es nuevo cuando
acaba de nacer. Es el vocabulario del capítulo desincronizado con el del modelo, en la frase que
decide qué se corta al revocar.

**El camino.**

1. `B/16` §3.1 — *«**Lo que sí se registra es el origen**: la instancia dice que su título es **el
   grant**, del mismo modo que una instancia recurrente dice cuál es su suscripción de complemento.
   **Es un campo que el modelo ya necesita, no uno nuevo.**»*
2. La columna, tal como quedó: `B/02` §2.4 — *«| **`addon_instance`** | … **y el ancla del grant que
   sea su título, si lo es** | … **El ancla del título apunta a `permanent_grant_vertical` y sí es
   anulable** |»*. El referente es **el ancla**, no el grant, y la distinción es la que `B/16` §2.4
   declara indispensable: *«vale en la vertical donde el grant **ANCLÓ**, no en todas»*.
3. Y la columna es **nueva**: no existía antes de esta tanda, que es lo que mi informe anterior
   reportó como `F-8dA3-007` y este arreglo cerró. La afirmación *«no uno nuevo»* era falsa cuando
   se escribió y sigue en pie después de que el arreglo la desmintiera.

**Severidad.** `BAJA`. El modelo quedó bien; lo que queda mal es la frase que justifica no haberlo
mirado, y el grano del referente en el único § que explica cómo se registra el origen.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 7** (`f4edbdfdf`, `B/02` §2.6 y el inventario de
qué cuelga de una suscripción) junto con la corrección de `addon_instance`. El arreglo agregó la
columna y no releyó el § que la pedía.

**¿Lo habría encontrado el grep?** **Sí.** El término es `addon_instance` y `f4edbdfdf` **toca
`B/16`**; `B/16` §3.1 no escribe `addon_instance` pero sí *«la instancia»* en la misma frase que
*«el grant»*, y el grep por `grant` sobre `B/16` devuelve el párrafo.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No**, por el mismo recorte que `F-8eA3-015`:
el párrafo está en un archivo que el commit **sí** tocó, así que no cae en *«un párrafo que el
commit no tocó»* y la obligación 2 no pide justificarlo.

---

## Qué mide esta pasada sobre `DEC-METH-010`

Es lo que la instrucción pide y conviene tenerlo junto, porque las respuestas individuales no se
leen como conjunto.

| | cuántos | cuáles |
|---|---|---|
| hallazgos | 19 | |
| **introducidos enteros por un arreglo de la 9-bis-3** | **7** | `001`, `002`, `003`, `012`, `015`, `018`, `019`. Cinco de los siete son `DEC-DATA-002` o la costura |
| **siguen llegando con su ID viejo** | **11** | `004` (`F-8cA3-013`), `005` (`F-8cA3-008`), `006` (`F-8dA3-006`), `007` (`F-8dA3-004`), `008` (`F-8dA3-003`), `009` (`F-8cA3-012`), `010` (`F-8cA3-014`), `011` (`F-8dA3-005` + `F-8dA3-010`), `013` (`F-8dA3-011`), `014` (`F-8dA3-012`), `017` (`F-8dA3-013`) |
| **mitad y mitad** | **2** | `004` (sigue llegando **y** creció con el arreglo 4) y `016` (la mitad de `T7` es del arreglo 2) |
| **el grep los habría mostrado** | **8** | `005`, `006`, `009`, `012`, `014`, `015`, `018`, `019` |
| **el grep NO los habría mostrado** | **11** | los demás |
| **`CRITICA` que el grep habría mostrado** | **0 de 2** | ninguno |
| **la resolución POR APARICIÓN los habría atrapado** | **4** | `005`, `006`, `009`, `012` |
| **la enmienda no alcanza** | **15** | los demás |

**El resultado, en una línea: `DEC-METH-010` atrapaba cuatro de diecinueve, y ninguno de los dos
`CRITICA`.** Los cuatro que atrapaba se reparten en dos mitades iguales y opuestas, y conviene
separarlas porque son dos veredictos distintos:

- **Dos donde la enmienda no se ejecutó, y uno de ellos es el más caro de medir.**
  `F-8eA3-005` vive en `V/02` §2.2 —una aparición no corregida, en un párrafo que `1e3c3fc9e` no
  tocó, del término central de ese commit— y `1e3c3fc9e` es **el único de los cinco commits de
  arreglo que publica una cifra**: *«72 apariciones no corregidas quedaron justificadas una por
  una»*. La aparición que se le escapó tenía que estar entre esas 72. `F-8eA3-009` es del mismo
  commit, y una de sus dos mitades está **en el párrafo pegado a la tabla que editó**.
- **Dos donde la enmienda tampoco se ejecutó y el commit no lo oculta.** `F-8eA3-006` es de
  `f4edbdfdf`, que **no reporta ninguna cifra**; `F-8eA3-012` es de `c29b318c7`, que reporta la
  cifra más alta de la tanda —*«90 apariciones recorridas, 75 declaradas correctas»*— sobre el
  único término del corpus **que trae su propio comando de verificación**, y el comando lo refuta
  en un paso.

**Y las quince que la enmienda no alcanza se reparten en cinco modos, no en quince.** Tres ya los
reporté la vuelta pasada y siguen vivos; dos son nuevos y los dos salen del **texto de la enmienda
misma**:

1. **El núcleo escribe las entidades en castellano.** `F-8eA3-007` y `F-8eA3-011`. `NUCLEO/01`
   dice *«Addon: producto»*, *«Grant permanente»*; `NUCLEO/04` dice *«producto de addon ≠ instancia
   de addon»*; el resto del corpus dice `addon_product`, `permanent_grant`, `addon_instance`. **Un
   grep por nombre de tabla no entra nunca a los dos capítulos que se declaran dueños de los
   nombres y de los invariantes.** Lo reporté en la 8-bis-3 con tres instancias; en esta tanda
   **siete commits abrieron `nucleo/01` y cuatro abrieron `nucleo/04`**, y las celdas siguen igual.
   El arreglo sigue siendo el más barato del corpus: el `snake_case` al lado de cada término.
2. **Una aparición que falta no se puede grepear.** `F-8eA3-002` (ninguna entidad tiene el reloj),
   `F-8eA3-003` (ninguna entidad tiene las dos cifras de `D16`), `F-8eA3-017` (la retención de
   billing no nombra ninguna entidad). El defecto es la ausencia; el grep devuelve presencias.
3. **Un arreglo puede crear un ACTO o una PROPIEDAD, y ninguno de los dos tiene término.**
   `F-8eA3-001` es el caso puro y es un `CRITICA`: `DEC-DATA-002` no agregó una aparición, agregó
   **una propiedad** —*«este reloj ahora se reinicia»*— y todo lo que cuelga de un reloj monótono
   dejó de ser correcto sin que ninguna palabra cambiara. La pregunta que lo encuentra es *«¿qué
   asume que esto pasa una sola vez?»*.
4. **NUEVO — la obligación 2 excluye por construcción los párrafos del archivo que el commit sí
   tocó.** Su texto acota el rastro a *«la aparición que no se corrige **y está en un párrafo que
   ese commit no tocó**»*. `F-8eA3-015` y `F-8eA3-019` viven los dos en `B/16`, que `f4edbdfdf`
   **editó**: por el recorte, el que aplicó el arreglo no tenía que justificar esos párrafos. La
   obligación 1 dice lo contrario —*«incluidos los archivos que el commit toca, porque un archivo
   abierto no es un párrafo leído»*— pero **la obligación 1 no produce rastro y la 2 sí**, así que
   lo verificable es justamente lo que deja fuera el caso que la obligación 1 nombra. Las dos
   obligaciones no cubren el mismo conjunto, y la diferencia son dos hallazgos de esta pasada.
5. **NUEVO — la enmienda cubre lo que el arreglo deja atrás y no lo que el arreglo escribe.**
   `F-8eA3-002` tiene una mitad que vive en una celda **que `621332e7c` escribió de cero**: el
   hecho 2 de `NUCLEO/01` §1.2, que declara legible de un push lo que el contrato prohíbe decidir
   con un push. Una aparición nueva no es *«una aparición no corregida»*, así que ninguna de las
   cuatro obligaciones la alcanza. El commit que crea una fuente inexistente la crea **en el
   párrafo que él mismo escribió**, que es el único lugar donde este método no mira.

**Lo que no cambió respecto de las tres vueltas anteriores**: la atribución de los `CRITICA`. **2
de 2**, los dos de la misma decisión. Lo que **sí** cambió: por primera vez el generador no es un
arreglo que redefine un término sino **uno que cambia una propiedad del tiempo**, y contra eso
ninguna de las cuatro obligaciones de `DEC-METH-010` tiene forma.

---

## Los hallazgos anteriores que ya NO llegan

Con su ID viejo, para que el conteo de la serie sea honesto.

| ID | estado | por qué |
|---|---|---|
| `F-8dA3-001` — anclar no cancela la suscripción (el `CRITICA` de la vuelta pasada) | **CORTADO** | `B/03` §3.2, `S13`: el evento hoy dice *«`SUPER_ADMIN` **otorga** un *Free Forever*, **o le ancla una vertical nueva a uno vivo**»*, y `12-contrato…` §2.8 punto 2 lo declara desde el otro lado |
| `F-8dA3-002` — anclar no está en las doce acciones | **CORTADO** | `NUCLEO/08` §3, fila del grant: *«otorgar, **anclarle una vertical nueva**, o revocar»*, con *«**Anclar también mueve dinero**»*, y el párrafo que explica por qué siguen siendo doce. `V/17` §3.2/§3.3 y `B/19` §6 siguen diciendo *«las doce»* y siguen siendo exactos |
| `F-8dA3-007` — el addon gratis sin dónde decir de qué ancla cuelga | **CORTADO** | `B/02` §2.4: `addon_instance` gana *«**el ancla del grant que sea su título, si lo es**»*, anulable, apuntando a `permanent_grant_vertical`. Queda el residuo de vocabulario, `F-8eA3-019` |
| `F-8dA3-009` — `NUCLEO/04` §5 en cuatro guards y 18 apoyos | **CORTADO** | la tabla dice hoy base 4, servicio 10, guard 6, total 16; los recorrí y suman **20 apoyos** sobre 16 con cuatro filas de doble apoyo (`D3 D8 D12 D15`), que es lo que la nota declara |
| `F-8dA3-008` — la ficha del beneficiario de grant tras el fin de servicio | **no lo reabro** | cae del lado de `C2`/`B3` (discontinuación), y la mitad que era mía —el grant como único título que ninguna transición apaga— no se movió. Lo anoto en *«fuera de mi vector»* |
| `F-8dA3-014` — la cita rota de la referencia `ADDON` | **CORTADO** | `B/02` §2.4 line 293 remite hoy al enunciado correcto |

---

## Ataques que intenté y el diseño resistió

**1. Que `PB7` republique el borrador de alguien que nunca pidió publicarlo.** No: su `desde` exige
*«el evento que la archivó dice que venía de `PUBLISHED` o de `UNPUBLISHED_BY_BILLING`»* (`V/03`
§9), y el § lo argumenta por su nombre —*«A `ARCHIVED` se entra por dos puertas»*—. Intenté
encontrar una tercera puerta a `ARCHIVED` y no hay: las únicas filas con `ARCHIVED` en la columna
`hacia` son `PB4` y `PB5`, las conté sobre la tabla.

**2. Que el origen que `PB7` lee no sobreviva al día 180.** No sobrevive el contenido, pero sí el
evento: `V/02` §4.1 manda **anonimizar**, no borrar, los eventos de dominio, y `NUCLEO/08` §1.3
declara que la anonimización *«no toca el tipo, la fecha, la entidad ni la causa»*. El estado
anterior de una transición no es un dato personal.

**3. Que `PB8` deje al dueño reactivar una ficha cuyo contenido ya se borró, sin decírselo.** Está
cubierto, y por un correo que esta tanda escribió: `NUCLEO/07` §6, fila de la reapertura — *«si el
hard delete ya corrió, **que el contenido no vuelve**»*, con su razón (*«Anunciar la vuelta y
callar eso es prometer una ventana que no se tiene»*).

**4. Que el reinicio del reloj por el hecho 2 le regale vida eterna a una ficha que nunca se
republica.** Es el desenlace y es deliberado: `NUCLEO/01` §1.2, hecho 2 — *«Reinicia **por sí
solo**, aunque la ficha no vuelva a publicarse —si el cupo no alcanza, por ejemplo— porque lo que
terminó es la ausencia, no el cupo»*. Una ficha de alguien cubierto que no entra en el cupo no se
borra nunca, y es correcto: está pagando.

**5. Que las pausas encadenadas acumulen y crucen los 180.** No: `NUCLEO/01` §3 precisión 2 —*«Los
8 acumulados **no** entran en la cuenta: son hasta tres pausas con una reanudación en el medio, y
cada reanudación reinicia el reloj (§1.2, hecho 2)»*—, y la reanudación devuelve `cubierto` a
verdadero porque `PAUSED` por `CUSTOMER_REQUEST` no emite fuente y `ACTIVE` sí (`12-contrato…`
§2.6). El razonamiento cierra; lo que no cierra es quién vigila la desigualdad, que es
`F-8eA3-003`.

**6. Que la invalidación del caché se quede corta con `S20` y `S21`.** No: `S20` no cambia lo que
la instancia otorga —*«La instancia no cambia de estado»* (`B/03` §3.2)—, así que no hay conjunto
efectivo que recalcular; y `S21` corre **después** de que la instancia llegó a `CANCELLED`, cuya
fuente ya se apagó por la fila *«se activa o vence un addon»* de `V/02` §3.2. Las dos transiciones
nuevas no necesitan entrada propia, y lo verifiqué contra el criterio que el § enuncia al cerrar.

**7. Que `T7` necesite un hecho nuevo en la frontera y viole `DEC-TRIAL-008`.** No: *«ya ejerció el
evento de activación»* es un hecho de verticales de punta a punta, leído del registro append-only
de la transición de publicar (`V/03` §2, `V/11` §8.2). Busqué un camino donde `T7` tuviera que
preguntar algo de billing y no hay: su condición dice explícitamente *«**`cubierto` no
participa**»*.

**8. Que el `UNIQUE(permanent_grant_id, vertical)` deje escribir dos anclas de la misma vertical.**
No, por la misma razón que la vuelta pasada: la clave es sobre `(grant, vertical)`, así que la
segunda colisiona. Lo reverifiqué contra el texto de hoy, que no se movió.

**9. Que el `alcance` colapsado del addon (`VERTICAL_SUBSCRIPTION` → `VERTICAL`) pierda un dato que
alguien necesite.** No hoy: `12-contrato…` §2.7 lo declara, dice por qué no cambia ninguna
resolución (*«los dos se pliegan en el mismo tramo»*) y deja escrito qué lo reabre (*«el día que
alguna clave se resuelva distinto según de qué cuelga el addon»*). Y `B/02` §2.4 blinda la grafía
canónica: *«se escribe **con la grafía del §40, no con una prosa equivalente**»*.

**10. Que la lápida del corte compita por alguno de los dos candados.** No: `CANCELLED` no está
entre los seis estados vivos, y `B/21` §2.5 lo dice y lo verifiqué contra `B/02` §2.2. Lo que sí
aprendí releyéndolo es que la lápida **necesitó** una salvedad propia en el barrido porque *«no
nace de ninguna transición»* — y ése es el argumento que `F-8eA3-004` extiende a los dos grants del
owner, que tampoco nacen de ninguna transición y no tienen salvedad ninguna.

**11. Que `V/21` §2.4 se contradiga con `B/21` §2.4 sobre qué transición dispara el día que las dos
cuentas del owner publiquen.** No: los dos dicen `T6` y los dos dan la misma razón (`cubierto`
verdadero por el grant). La costura entre las dos mitades de ese § está bien hecha, y es de las
pocas donde las dos épicas dicen lo mismo con las mismas palabras.

**12. Que el `evento_de_activacion` de `vertical` sea una lectura de billing no declarada.** No: lo
lee **verticales** —`T1`, `T6` y `T7` son transiciones suyas— y la dirección inversa del contrato
no tiene por qué declararlo. La confusión es fácil porque `admite_altas` y `fin_de_servicio` viven
en la misma fila y ésas **sí** las lee billing; las tres están declaradas del lado correcto.

---

## Fuera de mi vector

Lo anoto sin desarrollarlo, para quien corresponda:

- **`C1`**: la obligación 2 de `DEC-METH-010` excluye por construcción los párrafos del archivo que
  el commit sí tocó, y la obligación 1 dice lo contrario. Dos hallazgos de esta pasada
  (`F-8eA3-015`, `F-8eA3-019`) caen en esa grieta, y un tercero (`F-8eA3-002`) cae en la de
  *«aparición nueva»*. Las dos grietas están en el texto de la enmienda, no en su aplicación.
- **`A2`**: `T7` corre sobre una cohorte en un solo acto y **no declara idempotencia ni
  reanudación**, a diferencia de `S13` y `S20`, que sí lo hacen con las mismas palabras (*«Proceso
  idempotente y reanudable fila por fila»*) y con detector en `B/09` §3. `V/11` §8.3 exige que la
  ventana sea cero y no dice qué pasa si la corrida muere a la mitad.
- **`C2`**: `16-fase-7` §4.2 sigue con cuatro pasos y un quinto acto, y los dos grants del owner
  —hoy cinco clases de fila con la lápida— no son ninguno. `V/21` §2.4 punto 3 declara que el orden
  *«hay que fijarlo en el procedimiento del corte»*, y el procedimiento no lo fijó.
- **`A1`**: `V/17` §1.2 precisión 1 dice que una ficha `ARCHIVED` *«acepta de su dueño verla,
  exportarla y reactivarla»* — **tres** operaciones, y `PB8` es una sola transición. Verlas y
  exportarlas no son transiciones de ninguna máquina, así que el paso 4 tiene que aceptar dos
  operaciones que ninguna tabla declara.

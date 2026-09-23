---
title: "FASE 8-bis-5 · A2 — máquinas de estado, carreras y huérfanos"
linear: HOS-1352
statusSource: linear
created: 2026-09-22
updated: 2026-09-22
status: CURRENT
fase: 8
---

# FASE 8-bis-5 · A2 — máquinas de estado, carreras y huérfanos

Sexta pasada adversarial A2. Vector: transiciones que faltan, transiciones que nadie dispara,
transiciones que se pisan, estados sin salida, relojes sin dueño, corridas cortadas a la mitad,
dos actores sobre la misma fila, y toda fila que quede sin dueño.

**Nueve hallazgos: 1 `CRITICA`, 4 `ALTA`, 3 `MEDIA`, 1 `BAJA`.**

**Atribución: 9 de 9 los introdujo —o los volvió alcanzables— un arreglo o una decisión de la
9-bis-4.** El único `CRITICA` también.

**Y esta vuelta sí pudo atacar el rastro.** De las **63** líneas de rastro que revisé una por una,
**una resultó falsa hoy** (`rastro-8d6b27a12.md` §4, la fila de *«tres pares»*: declara corregidos
tres sitios y dos de los tres siguen diciendo *«tres»*) y **una segunda justifica una aparición
nombrando sólo al hermano nuevo** (`rastro-032f761e0.md` §3, `B/02` L45-49: declara la restricción
de `subscription_pause` *«respetada»* porque `S22` la respeta, sin mirar a `S10`, que es la salida
normal y no la respeta). Las dos están escritas abajo como hallazgo propio. El detalle del
recorrido está en el §4.

**Dónde falla `DEC-METH-011`, en una línea.** La enmienda alcanzó a las decisiones —los rastros lo
prueban: `8d6b27a12` recorrió 91 apariciones sobre 19 archivos— y la exclusión que dejó viva a
propósito **sigue siendo por donde entra la mayoría**: de mis nueve, **cinco** viven adentro de un
párrafo que el propio commit escribió, **dos** están en una aparición que el rastro declaró
resuelta y resolvió mal, **una** está en un párrafo que el commit no tocó y no entró al rastro, y
**una** es una ausencia sin cadena que grepear. Lo nuevo y medible es el segundo grupo: **por
primera vez el programa puede señalar una resolución equivocada en vez de suponerla.**

Los paths se abrevian como en los documentos anteriores: `NUCLEO` es
`HOS-1352-…/docs/nucleo/`, `V` es `HOS-1353-verticales-capacidades-y-autorizacion/docs/`, `B` es
`HOS-1354-billing-cobro-y-proveedor/docs/`, y lo que no lleva prefijo es `HOS-1352-…/docs/`.

**Lo que medí yo, y dónde.** Todo sale de contar sobre el worktree
`/home/qazuor/projects/WEBS/hospeda-spec-hos-1352-billing-redesign`, el 2026-09-22, con `rg`,
`awk`, `sed` y `git blame`:

| qué conté | resultado |
|---|---|
| líneas del corpus que declaran la **relectura de la cobertura antes de actuar** (`rg -i 'relee\|releen\|releer'` sobre verticales + núcleo, descontando las de proveedor) | **5**: `V/02` L429, `V/03` L295, L296, L313 y `NUCLEO/01` L79. **Cuatro nombran sólo `PB4`/`PB5`; una sola suma el hard delete del día 180** |
| apariciones de `idempotente` / `reanudable` en **toda** la épica de verticales | **0** (`rg -n` sobre `V/*.md`) |
| lugares que dicen que los pares con dos filas de `G-R4` son **tres** | **5**: `B/03` L884, L1265, L1581, L1642-1643 y `V/03` L172 |
| lugares que dicen que son **cuatro** | **5**: `NUCLEO/03` L77, `B/03` L572, L1543, `V/03` L456-457, `V/20` L172 |
| comprobaciones de cero llamadas de `B/09` §3 (contadas por sus encabezados `**Y una N-ésima…**`) | **6** — `B/02` §2.5 dice seis y la quinta dice *«las otras cinco»*: los dos conteos cierran |
| escritores declarados de `subscription_pause.fin_real` (`rg -n 'fin_real'`) | **2**: `S22` y `S25`. **`S10`, `S13` y `S17` no escriben ninguno** |
| salidas de `PAUSED` en `B/03` §3.2 | **5**: `S10`, `S22`, `S13`, `S25` y `S17` (cuyo `desde` incluye `PAUSED` entre *«las cinco alcanzables»*). `B/03` §5 enumera **tres** y llama *«las dos terminales»* a dos de ellas |
| apariciones de `retiro de un ancla` en el corpus | **1**: `B/09` §3 L400 — la misma de la vuelta anterior, sin tocar |
| líneas de rastro revisadas una por una | **63**, sobre cuatro rastros (detalle en el §4) |

**No medí nada contra el proveedor**: donde hablo de Mercado Pago cito la medición que el capítulo
ya trae con su identificador (`PS-2`, `PS-4`, `EX-11`, `EX-15`).

---

## 1. Los hallazgos

### CRITICA

### F-8fA2-001 — El hard delete del día 180 relee la cobertura en UNA sola línea de todo el corpus, y los otros cuatro lugares dicen que relee «`PB4` o `PB5`» y que el reinicio «se ejecuta en dos momentos, no en uno»: con el aviso perdido —el modo de falla que el propio diseño declara— se le borra el contenido a un cliente que ya volvió

**Qué se rompe.** Un anfitrión pierde la cobertura, su ficha baja, el reloj arranca. Al día 100
recontrata y `cubierto` vuelve a verdadero. **El aviso de invalidación se pierde** —el propio
diseño lo declara: *«si la invalidación falla, la operación de dominio no falla»* (`V/02` §3.2,
regla 2)—, así que el recálculo no corre y nadie escribe `listing.inactiva_desde`. Al día 180 el
hard delete se ejecuta sobre un cliente que está pagando. **Que ese borrado se evite o no depende
de qué capítulo lea el que lo implemente**: una línea del núcleo dice que el hard delete relee la
cobertura antes de avanzar, y el capítulo que es dueño de la columna dice, con esas palabras, que
el reinicio *«se ejecuta en **dos momentos**, no en uno»* y nombra **el recálculo y `PB4`/`PB5`**.
El hard delete no está entre ellos. Y en la lista cerrada de consumidores de la columna, el día 180
figura **como lector**, no como escritor.

**El camino.**

1. **La única línea que declara la relectura del hard delete.** `NUCLEO/01` §1.2: *«**`PB4`, `PB5`
   y el hard delete del día 180 releen la cobertura del `user + vertical` en el momento de
   ejecutar** y, si está cubierta, reinician el reloj en vez de avanzar»*. Es la línea 79 del
   archivo y **es la única aparición del mecanismo que nombra al hard delete** — lo conté sobre las
   cinco del corpus.
2. **`V/02` §4.2, regla 4, es explícita y cuenta dos.** *«El reinicio es una escritura en
   `inactiva_desde` (§2.5) y **se ejecuta en dos momentos, no en uno**: cuando el recálculo que el
   aviso despierta vuelve a preguntar y trae `cubierto` verdadero, y —como red— cuando **`PB4` o
   `PB5`** relean antes de archivar (cap. 03 §9). **Los dos** preguntan»*. El §es de `V/02`, que es
   **el capítulo que define la columna**, y el numeral no es una omisión distraída: dice *«dos
   momentos, **no en uno**»* y remata con *«los dos»*.
3. **`V/03` §9 cuenta lo mismo, dos veces.** *«las **dos filas del reloj** relee**n** antes de
   actuar»* y *«Así que **las dos**, en el momento de ejecutar, vuelven a pedirle la cobertura al
   contrato»*. Las celdas de `PB4` y `PB5` repiten *«relee la cobertura antes de archivar»* cada
   una. Ninguna de las cuatro nombra el día 180.
4. **Y la lista cerrada de la columna lo pone del lado de los lectores.** `V/02` §2.5: *«**Se
   escribe en los cuatro hechos y en ninguna otra parte**»* y, aparte, *«**Y la leen cinco
   consumidores**, y esta lista también es cerrada: `PB4` (día 90) y `PB5` (N meses) del cap. 03
   §9, **el día 180 del §4.1 de este capítulo**, los dos avisos previos de schedule … y la fecha
   que el cap. 19 §4 fila 18 obliga a imprimirle al cliente»*. El día 180 está enumerado **una
   sola vez y como lector**.
5. **Y el guard se construye sobre esas dos listas, no sobre la línea del núcleo.** `G-R6-B` es,
   textual, *«**las DOS mitades de la lista cerrada de `listing.inactiva_desde`** (cap. 02 §2.5).
   **(a) Escritores**: una escritura de la columna … que no sea uno de los cuatro hechos … **(b)
   Consumidores**: una lectura … que no figure entre los cinco consumidores que el cap. 02 §2.5
   enumera y cierra»* (`V/20` §2). O sea: si el hard delete **sí** relee y escribe, el guard lo ve
   escribir una columna cuyo inventario lo declara lector, y el que lo relaje va a relajarlo por
   ahí; si **no** relee, el guard queda verde sobre el borrado.
6. **El modo de falla que la relectura existe para tapar es el único que queda vivo, y está
   declarado.** `NUCLEO/01` §1.2 lo escribe entero: *«**Y como un aviso se puede perder, el que
   ACTÚA vuelve a preguntar antes de actuar** … es lo que vuelve el aviso perdido un retraso y no
   un borrado: **sin esta relectura el modo de falla cae del lado caro** —el aviso que no llega
   deja el reloj corriendo sobre alguien que volvió— y el propio diseño ya declara que estos avisos
   se pierden»*. El párrafo dice exactamente qué pasa si falta la relectura, y la relectura que
   falta en cuatro de los cinco lugares es la del acto irreversible.
7. **No hay ningún segundo hecho que lo salve.** De los cuatro hechos de reinicio, el 1 es un acto
   del dueño sobre una ficha que no ve, el 3 es volver a `PUBLISHED` —que no ocurre si el cupo no
   alcanza o si la republicación depende del mismo recálculo perdido—, el 4 es el fin de servicio
   de una vertical. Sólo el 2 lo alcanza, y el 2 es justamente el que se perdió.
8. **Y el propio corpus declara qué se pierde.** `V/02` §4.1: *«**Se borra** al día 180 … el
   contenido publicable de la ficha (textos, fotos, FAQ, horarios), los borradores»*, sobre *«**la
   única operación irreversible sobre datos del cliente de todo el programa**»* (`V/20` §2, con
   esas palabras).

**Dónde lo permite el diseño.**

- `NUCLEO/01-glosario.md` §1.2, la línea 79 y el párrafo *«Y como un aviso se puede perder…»*.
- `V/02-modelo-de-datos.md` §4.2 regla 4 (*«dos momentos, no en uno»*); §2.5, las dos listas
  cerradas; §4.1, qué se borra; §3.2 regla 2.
- `V/03-maquinas-de-estado.md` §9, las celdas de `PB4` y `PB5` y el párrafo *«las dos filas del
  reloj releen antes de actuar»*.
- `V/20-testing.md` §2, `G-R6-B` y su párrafo de motivo.

**Severidad.** `CRITICA`. **Un dato se pierde sin vuelta**: el contenido publicable de un cliente
que está pagando, por el único acto irreversible del programa, sobre el modo de falla que el propio
diseño nombra y declara frecuente. No lo baja nada: los tres avisos de retención cuelgan del mismo
reloj que no se reinició, así que **avisan puntualmente del borrado que no corresponde** en vez de
señalarlo, y `PB8` no ayuda —lleva a `DRAFT` una ficha cuyo contenido ya no está—. La ambigüedad no
es teórica: cuatro de las cinco redacciones son excluyentes (*«las dos»*, *«dos momentos, no en
uno»*), así que la lectura mayoritaria del corpus es la que borra.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: la familia de la retención**, y el commit exacto
es `5ac5e92c9` —*«el reloj de inactividad gana columna y deja de leerse del aviso»*—, que escribió
**las cinco** líneas. Lo verifiqué con `git blame`: `NUCLEO/01` L78-80 llevan `5ac5e92c9`, y lo
mismo `V/03` L295, L296 y L313. Antes de esa familia no había relectura en ninguno de los tres
actores, porque no había columna que reiniciar.

**¿Lo habría encontrado el grep?** **Sí, y en una sola corrida.** El término nuevo es
**«relee»/«releen»**; el viejo es **«monótono»**, que la misma familia retira. Un
`rg -i 'relee|releen|releer'` sobre verticales y el núcleo devuelve **cinco** líneas —las conté— y
la discrepancia se ve sin abrir ningún archivo: cuatro dicen *«`PB4` y `PB5`»* y una dice *«`PB4`,
`PB5` y el hard delete del día 180»*. Es una comparación de cinco renglones.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y cae en el tercer desenlace del §1.4.**
Busqué las cinco líneas en `rastro-5836ec219.md` §2 —el rastro de la retención, 187 apariciones— y
**ninguna de las cinco figura**: las cinco las escribió `5ac5e92c9` en sus propios hunks, así que
caen de lleno en la exclusión que `DEC-METH-011` dejó viva a propósito. Es el **modo 1** de
`C1` §4.4: prosa nueva contradiciéndose consigo misma dentro del mismo commit. Lo que el rastro sí
tiene cerca es **L57** —*«Los cuatro hechos … siguen siendo cuatro: la corrección le dio al hecho 2
una fuente distinta, no agregó ni quitó hechos»*—, que es verdadera sobre el número de hechos y
**no dice nada sobre cuántos actores ejecutan el hecho 2**, que es donde está el defecto.

---

### ALTA

### F-8fA2-002 — La relectura de `PB4` deja la ficha del excedente sin NINGUNA salida: no archiva porque el dueño está cubierto, `PB3` no dispara si el cupo no vuelve, `PB1` sale sólo de `DRAFT` y `PB8` sale sólo de `ARCHIVED`. El arreglo le sacó al dueño el único camino de recuperación que tenía

**Qué se rompe.** Un anfitrión con cinco fichas baja a un plan de tres. El reconciliador le
despublica dos por la segunda rama de `PB2`. Se queda en ese plan —que es lo normal: por eso bajó—.
**Las dos fichas quedan en `UNPUBLISHED_BY_BILLING` para siempre y el dueño no tiene ningún acto
con el que sacarlas de ahí.** `PB3` pide que `cubierto` cambie (no cambia: estuvo cubierto todo el
tiempo) o que el cupo vuelva a alcanzar (no vuelve). `PB4` llega al día 90, **relee la cobertura,
la encuentra cubierta, no archiva y reinicia el reloj** — y como no archiva, `PB8`, que es la única
salida que el dueño puede ejecutar, **nunca tiene sujeto**. `PB1` sale sólo de `DRAFT` y `PB6` sólo
de `PUBLISHED`. La ficha queda viva, invisible, no recuperable y no borrable, y los avisos de
retención se le repiten al dueño cada 90 días anunciándole un archivado que la relectura garantiza
que no va a ocurrir.

**El camino.**

1. **La ficha entra por la segunda rama de `PB2`.** `V/03` §9: *«| PB2 | `PUBLISHED` | **`cubierto`
   pasa a falso** | `UNPUBLISHED_BY_BILLING` | **o el excedente tras un downgrade, que no cambia
   `cubierto` y sí el cupo** |»*.
2. **`PB3` tiene ahora dos ramas y ninguna dispara sobre este sujeto.** *«| PB3 |
   `UNPUBLISHED_BY_BILLING` | **`cubierto` pasa a verdadero**, **o el cupo vuelve a alcanzar sin
   que `cubierto` cambie** | `PUBLISHED` |»*. La primera no ocurre —el § lo dice él mismo:
   *«la persona sigue cubierta y lo que no le alcanza es el cupo»*—; la segunda pide un acto que
   este cliente no va a hacer. `DEC-DATA-003` resolvió al que **vuelve a subir**; sobre el que se
   queda abajo no cambia nada.
3. **`PB4` deja de alcanzarla, y es el cambio de esta tanda.** `V/03` §9: *«las dos, en el momento
   de ejecutar, **vuelven a pedirle la cobertura al contrato**: **si el `user + vertical` está
   cubierto, no archivan y reinician el reloj** escribiendo `listing.inactiva_desde`»*. La pregunta
   es por el `user + vertical`, **no por la ficha**, y este dueño está cubierto: paga su plan
   chico. Así que `PB4` **nunca** la archiva, y el reinicio la vuelve a dejar a 90 días de una
   decisión que se va a tomar igual.
4. **Y sin `ARCHIVED` no hay `PB8`.** `V/03` §9: *«| **PB8** | `ARCHIVED` | **el dueño la reactiva**
   | `DRAFT` |»*. Es la única fila de toda la máquina cuyo disparador es un acto del dueño sobre
   una ficha que no está publicada, y su `desde` es un estado al que esta ficha ya no puede llegar.
5. **Las otras dos filas del dueño no sirven.** `PB1` *«sale sólo de `DRAFT`»* —lo dice el propio §
   dos veces— y `PB6` sale de `PUBLISHED`. **No existe `UNPUBLISHED_BY_BILLING` → `DRAFT`**, y el
   capítulo lo sabe: escribió el estado aparte *«a propósito»* justamente para que el dueño no
   pudiera confundirlo con su propio borrador.
6. **Borrarla tampoco es una salida declarada** (ver `F-8fA2-008`): la máquina no tiene fila para el
   borrado de una ficha y la lista de actos del dueño de `NUCLEO/01` §1.2 hecho 1 —*«crearla,
   editarla, publicarla, despublicarla, exportarla, reactivarla»*— no lo nombra.
7. **Y los tres avisos de retención siguen saliendo, sobre un reloj que se reinicia.**
   `NUCLEO/07` §6: *«retención … antes del día 90, **al archivar** y antes del día 180, los tres
   contados sobre `listing.inactiva_desde` — **un reloj reiniciable, así que los tres pueden
   corresponder más de una vez sobre la misma ficha**»*. El primero de los tres le avisa cada 90
   días que la ficha va a archivarse en N días; la relectura garantiza que no. El del medio no sale
   nunca. Y `V/19` fila 18 —el texto del que sí saldría— promete *«que **vuelve sola cuando
   recupere la cobertura —o cuando el cupo vuelva a alcanzar—** si hay lugar para ella»*, que son
   las dos cosas que sobre este cliente no pasan.
8. **El estado anterior era estrictamente mejor para el dueño, y se puede fechar.** Antes de
   `5ac5e92c9`, `PB4` no releía: al día 90 la ficha se archivaba, salía el aviso de la fila 18 y el
   dueño podía ejecutar `PB8` —que `afa4590c2` acaba de volver ejecutable dándole al piso
   *«recuperar lo suyo»*—. **La relectura, que existe para proteger al que volvió, le cerró la
   puerta al que no se fue.**

**Dónde lo permite el diseño.**

- `V/03-maquinas-de-estado.md` §9, las filas `PB1`, `PB2`, `PB3`, `PB4`, `PB6`, `PB8`; el párrafo
  *«Pero el hecho dice CUÁNDO preguntar…»*; el párrafo *«`UNPUBLISHED_BY_BILLING` es un estado
  distinto de `DRAFT` a propósito»*.
- `V/02-modelo-de-datos.md` §4.2 regla 3 y regla 4; §2.1, la tercera cosa del piso.
- `NUCLEO/01-glosario.md` §1.2, los cuatro hechos.
- `NUCLEO/07-outbox-y-notificaciones.md` §6, la fila de retención.
- `V/19-superficies.md` fila 18.

**Severidad.** `ALTA`. No hay plata directa de por medio y **no se pierde contenido** —al contrario:
la ficha queda protegida del día 180 para siempre—, así que no es `CRITICA`. Lo que se rompe es que
**una ficha del cliente queda sin ningún acto que la alcance**, ni suyo ni del sistema, y que la
única superficie que le habla del caso le describe una vuelta que no le corresponde. La población
no es de borde: es todo el que baja de plan y se queda, que es exactamente para lo que existe bajar
de plan.

**¿Es nuevo, o es el arreglo?** **Es el arreglo, y son dos piezas de la misma familia.** La
relectura de `PB4` la escribió `5ac5e92c9` (familia de **la retención**) y `PB8` —con su `desde`
acotado a `ARCHIVED`— la dejó ejecutable `afa4590c2`, de la misma familia. `DEC-DATA-003`
(`8ed89adf8`) cerró la mitad del excedente que **vuelve a subir** y esta es la mitad que se queda
abajo. Antes de la tanda, el desenlace de esta ficha era el de `F-8eA2-001` —archivo y borrado—, que
era peor en el dato y **mejor en la agencia del dueño**.

**¿Lo habría encontrado el grep?** **Sí.** El término nuevo es **«relee»/«releen»** y el que decide
es **`UNPUBLISHED_BY_BILLING`**. Un `rg 'UNPUBLISHED_BY_BILLING'` sobre `V/03` §9 devuelve las
cuatro filas que lo nombran —`PB2`, `PB3`, `PB4` y `PB7`— **en la misma tabla**, y la pregunta
*«¿desde acá se sale por algo que el dueño pueda hacer?»* se contesta leyendo las cuatro celdas
seguidas. El commit **sí tocó `V/03`**.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Parcialmente, y la línea que más cerca
estuvo está en el rastro y se quedó corta.** `rastro-5836ec219.md` §2 tiene **L433-436 · §9** —
*«Las dos reinician el reloj, y `PB7` ni siquiera hace falta que dispare … si el cupo no alcanza y
la ficha se queda abajo, el reloj se reinicia igual»* → *«siguen correctas, **y ahora esa ficha
además tiene cómo volver cuando el cupo se libere**»*. La cláusula que el rastro agrega es la que
falla: *«cuando el cupo se libere»* es una condición, no un hecho, y sobre la población de este
hallazgo **no se cumple nunca**. La aparición se revisó, se declaró correcta con razón —lo que
afirma es verdadero— y la razón que se le puso encima **es la que deja el caso sin salida**. Cae en
el primer desenlace del §1.4 en su forma débil: la línea no es falsa, **su justificación agrega una
garantía que el texto no da**.

---

### F-8fA2-003 — `S10` no escribe `fin_real`, y la restricción de base «a lo sumo una sin `fin_real` por suscripción» convierte eso en que nadie pueda pausar dos veces; la vuelta anticipada además le come al cliente los meses que no usó, que es literalmente la razón que `S22` escribe para escribirlo

**Qué se rompe.** Un cliente pausa dos meses y **vuelve a los veinte días** —`S10` contempla el
caso con todas las letras: *«llega el fin, **o la persona vuelve antes**»*—. La fila vuelve a
`ACTIVE` y nadie le escribe `fin_real` a la `subscription_pause`, porque ninguna línea del corpus
dice que `S10` lo haga. Dos cosas se rompen a la vez y en direcciones distintas. **La primera es
plata:** los topes del §26.3 se cuentan por `user + vertical` y *«sobreviven a cancelar y volver a
suscribirse»*, así que una pausa sin fin real vale **los meses que pidió**, no los que usó: el
cliente que volvió a los veinte días pagó dos pausas-mes de su cupo de ocho. **La segunda es que
no puede volver a pausar:** `B/02` §2.2 restringe `subscription_pause` a *«a lo sumo una sin
`fin_real` por suscripción»*, así que el segundo `S8` lo **rechaza la base**, sobre un cliente al
que el catálogo le vende *«máximo 3 pausas por ventana»*.

**El camino.**

1. **La restricción es de base y es dura.** `B/02` §2.2: *«| **`subscription_pause`** | suscripción,
   motivo, meses pedidos, inicio, fin previsto, fin real | **a lo sumo una sin `fin_real` por
   suscripción** |»*.
2. **`S10` no la escribe.** Su celda de efectos (`B/03` §3.2) enumera: *«`PUT status=authorized`; al
   reanudar se le muestra una sola cosa: qué día se le cobra … la fecha del próximo cobro avanza
   tantos ciclos como hayan vencido durante la pausa … **Si la relectura sigue viendo `paused`,
   `S10` NO ocurre**…»*. **No hay ninguna mención de `fin_real`**, ni en la celda ni en el § de
   abajo (*«`S10` es la única salida de `PAUSED` que devuelve el servicio»*), ni en `B/03` §5.
3. **Sus dos hermanas sí, y escriben la razón.** `S22`: *«**Se escribe `fin_real` en la
   `subscription_pause`** (`B/02` §2.2) con ese mismo día: los topes del §26.3 **sobreviven a
   cancelar y volver a suscribirse** (`DEC-SUB-004`), así que **una pausa que se corta sin
   registrar su fin real le come al cliente meses que no usó**»*. `S25` repite la frase palabra por
   palabra. **La frase describe exactamente lo que `S10` hace cuando la persona vuelve antes** —es
   la definición literal de *«una pausa que se corta»*— y es la única de las tres que no escribe la
   columna.
4. **Y el barrido confirma desde afuera que `S10` no la escribe.** `B/09` §3, quinta comprobación:
   *«**`S22` y `S25` además escriben el `fin_real` de la pausa**, que es la primera condición»*. El
   *«además»* separa a esas dos del resto de las salidas; `S10` no aparece en ningún lado de ese
   párrafo como escritor.
5. **La restricción no es letra muerta: la salida normal la choca.** Con la primera pausa abierta
   para siempre, el segundo `S8` viola el *«a lo sumo una sin `fin_real`»*. Las dos lecturas
   posibles son malas: si la base rechaza, **el cliente pierde las dos pausas que el catálogo le
   vende** y el intento cae en la regla 1 del núcleo —marca `TRANSICIÓN_NO_DECLARADA`—; si alguien
   lo resuelve cerrando la pausa vieja en el acto de abrir la nueva, **el `fin_real` que se escribe
   es la fecha de la segunda pausa** y el conteo de pausas-mes queda peor todavía.
6. **Y el detector se vuelve un falso positivo en esa segunda lectura.** La quinta comprobación
   busca *«una `subscription_pause` **sin `fin_real`** cuyo `fin_previsto` ya pasó y su suscripción
   **sigue en `PAUSED`**»*. Sobre alguien que volvió antes y pausó de nuevo, la pausa **vieja**
   cumple las tres condiciones, y el barrido abre `REANUDACIÓN_NO_APLICADA` —*«el cliente está sin
   servicio y sin cobro»*— sobre un cliente cuya pausa corriente está perfectamente sana.
7. **Y la pregunta no la contesta ningún otro capítulo.** `rg -n 'fin_real'` sobre las dos épicas y
   el núcleo devuelve **doce** líneas y ninguna dice quién lo escribe al reanudar; `B/03` §5, que
   es el § de la pausa, no lo nombra una sola vez.

**Dónde lo permite el diseño.**

- `B/02-modelo-de-datos.md` §2.2, la fila de `subscription_pause`.
- `B/03-maquinas-de-estado.md` §3.2, las celdas de `S10`, `S22` y `S25`; el § *«`S10` es la única
  salida de `PAUSED` que devuelve el servicio»*; §5 entero.
- `B/09-conciliacion.md` §3, la quinta comprobación y el párrafo *«Las otras tres salidas de
  `PAUSED`…»*.
- `DEC-SUB-004` y `DEC-SUB-010` (el §26.3 reexpresado en meses).

**Severidad.** `ALTA`. **Alguien paga de más** —pausas-mes que no usó, sobre un cupo anual acotado
que `DEC-SUB-004` declara imposible de resetear— y, en la otra lectura, **pierde una capacidad que
el catálogo le vende**. No lo pongo en `CRITICA` porque el monto no es un cobro sino un beneficio
consumido de más, y porque el desenlace concreto depende de cómo la implementación resuelva el
choque con la restricción — que es, precisamente, lo que nadie escribió.

**¿Es nuevo, o es el arreglo?** **La ausencia es vieja; lo que la volvió un defecto es la tanda,
por dos vías de la misma familia de arreglo (`032f761e0`, la baja, y `8d6b27a12`, las decisiones).**
Hasta la 9-bis-4 `fin_real` era una columna que nadie escribía desde ninguna transición, así que la
restricción de base no tenía cómo dispararse en la práctica ni nadie afirmaba nada sobre ella. La
tanda le puso **dos escritores declarados** (`S22`, `S25`), le puso **un lector que decide** (la
quinta comprobación, que usa la ausencia de `fin_real` como su primera condición) y **escribió la
razón** —*«le come al cliente meses que no usó»*—. Con las tres piezas puestas, que la salida normal
no escriba la columna pasa de hueco a contradicción.

**¿Lo habría encontrado el grep?** **Sí, y es la obligación 3 en su forma exacta.** El término
nuevo es **`fin_real`** —lo introduce como escritura `S22`—. Un `rg -n 'fin_real'` sobre el corpus
devuelve **doce** líneas, las conté, y **todas las de escritura nombran `S22` o `S25`**. Poner al
lado la tabla de salidas de `PAUSED` de `B/03` §3.2 es una lectura de cinco filas.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Estaba en el rastro y la justificación es
incompleta: es el segundo hallazgo de método de este informe.** `rastro-032f761e0.md` §3, bloque
`B/02-modelo-de-datos.md`, **L45-49**: *««`subscription_pause` | … inicio, fin previsto, fin real |
**a lo sumo una sin `fin_real` por suscripción**» → **sigue correcta, y `S22` la respeta**: escribe
`fin_real` al cancelar, así que **no deja una pausa abierta sobre una fila muerta**»*. La
justificación verifica **la fila nueva contra la restricción** y no **la restricción contra las
filas que ya estaban**: `S10` es la salida normal de `PAUSED`, no escribe la columna, y el
*«sobre una fila muerta»* del final es justamente el recorte que deja afuera al caso que importa —la
fila **viva** que reanudó—. Es el primer desenlace del §1.4: **la regla se ejecutó sobre esta
aparición y la resolución miró para el lado equivocado.**

---

### F-8fA2-004 — Dos de los tres cruces de `DEC-GRANT-004` no tienen fila, y la condición de `S9` prohíbe el tercero: «cortesía sobre cortesía → se suman los días» no lo puede ejecutar nadie, y el aviso le promete al cliente una fecha de fin nueva que no llega

**Qué se rompe.** `SUPER_ADMIN` le extiende la cortesía a alguien que ya está en cortesía. El
corpus promete dos cosas: que **se suman los días** y que **el aviso dice la fecha de fin nueva**.
Ninguna transición ejecuta la suma: `S9` —la única fila que llega a `PAUSED · COURTESY`— sale de
`ACTIVE`, y esta fila está `PAUSED`; y su condición declarada es *«no hay pausa vigente»*, que sobre
una cortesía corriendo **es falsa por definición**. Así que el acto cae en la regla 1 del núcleo
—no se ejecuta, se registra, marca `TRANSICIÓN_NO_DECLARADA`—, el `fin_previsto` de la
`subscription_pause` **no se mueve**, y el día del fin original `S10` reanuda: **se le empieza a
cobrar a alguien a quien se le acaba de escribir por correo que su cortesía termina un mes
después.** El mismo agujero alcanza al cruce 1 —*«en cortesía pide pausar → se le permite»*—, que
pide pasar de `PAUSED · COURTESY` a `PAUSED · CUSTOMER_REQUEST` y tampoco tiene fila.

**El camino.**

1. **La decisión enumera tres cruces y los resuelve los tres.** `DEC-GRANT-004`: *«(1) **En
   cortesía, pide pausar** → se le permite, avisándole … Si acepta, el grant se cancela y queda una
   pausa normal. (2) **En pausa, el super admin intenta otorgar cortesía** → se bloquea. (3)
   **Cortesía sobre cortesía** → se **SUMAN los días**, no se reemplazan, y el aviso dice la **fecha
   de fin nueva**, no «un mes más»»*.
2. **`B/03` §5 afirma que la máquina los ejecuta.** *«**Los tres cruces entre pausa y cortesía** ya
   están decididos (`DEC-GRANT-004`) y **la máquina los ejecuta así**: en cortesía pide pausar → se
   permite …; en pausa se intenta otorgar cortesía → se bloquea; cortesía sobre cortesía → se suman
   los días y el aviso dice la fecha de fin nueva»*. Es **la única aparición de la cadena «se suman
   los días» en todo el corpus** — la conté.
3. **`S9` no puede ser el ejecutor, por su `desde` y por su condición.** `B/03` §3.2: *«| S9 |
   **`ACTIVE`** | … | `PAUSED` *(motivo `COURTESY`)* | **no hay pausa vigente (`DEC-GRANT-004`)** |»*.
   El `desde` no matchea y la condición es **la negación exacta** del cruce 3. Los dos disparadores
   que la 9-bis-4 le agregó no ayudan: los dos hablan de *«una sucesora recién autorizada»* o de
   *«una fila recién autorizada»*, y el propio texto aclara que *«ni una sucesora recién autorizada
   ni un alta nueva tienen ninguna [pausa vigente]»* — o sea que los tres disparadores comparten esa
   condición y ninguno alcanza a una fila ya pausada.
4. **Ninguna otra fila lo declara.** Recorrí las 25 filas de `B/03` §3.2: las únicas con `PAUSED` en
   su `desde` son `S10`, `S22`, `S25`, `S13` y `S17`, y sus eventos son *«llega el fin»*, *«pide la
   baja»*, *«otorga un grant»* y *«su sucesora quedó autorizada»*. **Ninguna es «se otorga otra
   cortesía»**, y el `hacia` *«el mismo estado»* —que la tabla sí sabe expresar: lo usan `S14`,
   `S15` y `S19`— no está usado para esto.
5. **Y el cruce 1 está en la misma situación.** Pasar de `PAUSED · COURTESY` a `PAUSED ·
   CUSTOMER_REQUEST` es un cambio de **motivo**, que `B/02` §2.5 declara *«no un adorno»* y que
   `B/03` §5 declara que **el reloj lee** (*«El reloj lee el motivo, nunca al proveedor»*). `S8`
   sale de `ACTIVE`. Nadie escribe ese cambio.
6. **El desenlace concreto sale del reloj de la pausa, que nadie mueve.** `S10` y `S25` se disparan
   con *«llega el fin de la pausa»*, que se lee del `fin_previsto` de la `subscription_pause`
   (`B/02` §2.2). Sin una transición que lo corra, el fin previsto sigue siendo el de la primera
   cortesía: `S10` reanuda, el proveedor vuelve a cobrar, y la fuente `CORTESÍA` deja de emitir
   —*«una fuente con `hasta: fecha` deja de aparecer en `fuentes` cuando esa fecha pasa»*,
   `12-contrato…` §2.6—.
7. **Y el aviso ya está comprometido.** `NUCLEO/07` §6 tiene fila propia: *«**pausa por cortesía** |
   transaccional | al otorgarla y al vencer; desambigua el correo del proveedor»*. El cliente recibe
   la fecha nueva por escrito y el sistema honra la vieja.

**Dónde lo permite el diseño.**

- `B/03-maquinas-de-estado.md` §5, el párrafo *«Los tres cruces entre pausa y cortesía…»*; §3.2, la
  fila `S9` (su `desde` y su condición) y las cinco filas que salen de `PAUSED`.
- `B/02-modelo-de-datos.md` §2.2, `subscription_pause` (motivo y fin previsto).
- `01-decision-log.md`, `DEC-GRANT-004`, los tres cruces.
- `NUCLEO/03-maquinas-de-estado.md` §1, regla 1.
- `NUCLEO/07-outbox-y-notificaciones.md` §6, la fila *«pausa por cortesía»*.
- `B/14-promos-cortesias-y-grants.md` §4: sus cinco sub-secciones cubren promo+cortesía,
  cortesía+grant, cortesía+cambio de plan, trial+cortesía y cortesía+vertical discontinuada —
  **no hay ninguna de cortesía+cortesía**.

**Severidad.** `ALTA`. **Alguien paga de más**: se le cobra un ciclo que `SUPER_ADMIN` firmó como
regalado, y el propio corpus obliga a habérselo dicho por correo antes. No lo pongo en `CRITICA`
porque la población la origina un acto administrativo uno por uno —`NUCLEO/08` §3 trata la cortesía
como acción del catálogo con permiso propio— y porque el dinero es recuperable por la vía del
reembolso que `DEC-RF-002` ya declara. Lo que está roto es que **el corpus afirma que la máquina
ejecuta tres cosas y ejecuta una.**

**¿Es nuevo, o es el arreglo?** **El hueco es anterior; lo volvió alcanzable la tanda, por la
familia de la sucesión (`f21d5d828`) y la de las ocho decisiones (`8d6b27a12`).** Esas dos le
agregaron a `S9` **dos disparadores nuevos** (`DEC-GRANT-007` y `DEC-GRANT-010`) y le escribieron a
la condición una salvedad explícita: *«**y ni una sucesora recién autorizada ni un alta nueva tienen
ninguna**, así que el segundo y el tercer disparador corren sin tocar la condición»*. Esa frase es
la que vuelve el defecto señalable: el commit **fue a mirar esa condición** para justificar sus dos
disparadores nuevos y no se preguntó por el tercero que la decisión ya exigía. Antes, la condición
era una línea que nadie había vuelto a leer.

**¿Lo habría encontrado el grep?** **Sí, y con el término que el propio commit grepeó.** El término
es **«no hay pausa vigente»** / **`DEC-GRANT-004`**, y el commit lo tocó: reescribió esa celda
entera. Un `rg 'DEC-GRANT-004'` sobre `B/03` devuelve **dos** líneas —la condición de `S9` y el
párrafo de los tres cruces del §5—, a unas 900 líneas de distancia y en el mismo archivo. Leerlas
juntas es la comparación entera.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No: la aparición no está en ningún rastro y
debería estar.** Busqué *«cruces»*, *«cortesía sobre cortesía»* y *«pausa vigente»* en los diez
rastros de la 9-bis-4: **`rastro-f21d5d828.md` y `rastro-8d6b27a12.md` no tienen ninguna entrada
para `B/03` §5 L1058-1060**, que es el párrafo de los tres cruces, aunque los dos tocaron `B/03` y
`8d6b27a12` corrigió la celda *«quién la termina»* de ese mismo §. Es el **segundo desenlace** del
§1.4: aparición no corregida, en un párrafo que el commit no tocó, dentro de un § que el commit sí
abrió. **La regla no se ejecutó sobre ella.**

---

### F-8fA2-005 — La suscripción pausada por CORTESÍA sobre una vertical discontinuada sigue emitiendo fuente el día del fin de servicio, así que `PB2` no dispara y su ficha se queda PUBLICADA en una vertical que dejamos de prestar: `B/10` §4.1 y §4.3 declaran lo contrario y ninguna transición lo ejecuta

**Qué se rompe.** Se discontinúa una vertical. `DEC-SUB-015` decidió que **la pausada no entra al
piso**: se queda `PAUSED` hasta que su pausa termine. Para la pausada por `CUSTOMER_REQUEST` eso no
cambia nada —esa fila no emite, su ficha bajó el primer día de la pausa—. Para la pausada por
**`COURTESY`** sí: esa fila **sí emite fuente** (`12-contrato…` §2.6), así que `cubierto` sigue
siendo verdadero el día del fin de servicio. `PB2` se dispara por el **cambio** de `cubierto` y no
hay cambio, así que **su ficha se queda `PUBLISHED`** en una vertical cuya pricing desapareció, cuya
sección de Mi Cuenta se fue y cuyo servicio declaramos terminado. `PB4` tampoco la alcanza: relee la
cobertura, la encuentra cubierta y no archiva. La ficha queda pública, comprable-en-apariencia y sin
producto detrás, hasta que la cortesía termine — y `B/10` §4.3 declara que *«una pausa que sobrevive
al piso es el caso normal, no la excepción»*.

**El camino.**

1. **La decisión deja la fila viva a propósito.** `B/10` §4.3: *«**La pausada no entra al piso y se
   queda `PAUSED`.** Sigue apuntando a un plan de una vertical que ya tiene fecha de cierre, y
   **eso es legal** … Su preapproval **no se cancela el día 0**: se cancela cuando la pausa termine,
   en `S25`»*. Y `S25` no corre hasta *«llega el fin de la pausa, o la persona vuelve antes»*.
2. **Una de las dos clases de pausa emite.** `12-contrato…` §2.6: *«| `PAUSED` por
   `CUSTOMER_REQUEST` | **no** | — | … | | `PAUSED` por `COURTESY` | **sí**, como `tipo: CORTESÍA` |
   la fecha de fin de la cortesía | lo sostenemos nosotros (`DEC-GRANT-003`) |»*.
3. **`PB2` pide un cambio que no ocurre.** `V/03` §9: *«| PB2 | `PUBLISHED` | **`cubierto` pasa a
   falso** | `UNPUBLISHED_BY_BILLING` | o el excedente … |»*, y el § lo remacha: *«**`PB2` y `PB3` se
   disparan por el CAMBIO de `cubierto` —o por el del cupo—, no por una lista de transiciones**»*.
   El día del fin de servicio, para esta persona, `cubierto` sigue en verdadero y el cupo no se
   movió.
4. **Y `PB4` tampoco la alcanza, por la relectura nueva.** *«si el `user + vertical` está cubierto,
   **no archivan** y reinician el reloj»* (`V/03` §9). Ese `user + vertical` está cubierto por la
   cortesía.
5. **El capítulo afirma lo contrario dos veces, en indicativo.** `B/10` §4.1: *«Discontinuar es otra
   cosa: **el servicio se deja de prestar. Las fichas se bajan**, la sección de Mi Cuenta se va, la
   pricing desaparece»*. Y `B/10` §4.3: *«**El día del fin de servicio.** Las fichas pasan a
   `UNPUBLISHED_BY_BILLING` **por PB2** del capítulo 03 §9, las suscripciones consuman su
   `CANCELLED`, y arranca el reloj de retención»*. La frase nombra el mecanismo exacto que sobre
   esta población no dispara.
6. **La ventana no es de borde, y lo dice la propia decisión.** `B/10` §4.3: *«**Y la ventana no es
   un borde raro.** El tope de **una** pausa son 120 días (`B/03` §5) y el piso del §4.4 son 60, así
   que **una pausa que sobrevive al piso es el caso normal**, no la excepción»*. Y la cortesía no
   pasa por `puedePausar()` —`B/03` §7.2 lo subraya—, así que sus días no están acotados por el
   tope de 120.
7. **Y la única superficie escrita para esta persona no lo nombra.** `NUCLEO/07` §6, fila *«la pausa
   alcanzada por una vertical discontinuada»*: *«Dice tres cosas: que la vertical cierra; que **su
   pausa sigue corriendo y nadie se la toca**; y que al volver **va a tener que elegir de nuevo**»*.
   **Ninguna de las tres es qué le pasa a la ficha**, que es lo único que el público ve.
8. **Y el reloj de retención arranca igual.** `NUCLEO/01` §1.2, hecho 4: el fin de servicio de una
   vertical discontinuada reinicia la inactividad *«y arranca **ahí y no antes**»*. Sobre una ficha
   que sigue publicada y cubierta eso no acumula nada, así que cuando `S25` finalmente corra y `PB2`
   la baje, el reloj del día 180 **ya lleva corriendo desde el fin de servicio**: los días de la
   cortesía se le descuentan del plazo de retención sin que nadie lo diga.

**Dónde lo permite el diseño.**

- `B/10-verticales-planes-billing-options.md` §4.1, §4.3 (el recuadro *«La pausada NO entra al piso»*
  y *«El día del fin de servicio»*), §4.5 borde 4.
- `12-contrato-de-cobertura.md` §2.6, la tabla de los nueve estados y la regla del `hasta`.
- `V/03-maquinas-de-estado.md` §9, `PB2` y la relectura de `PB4`.
- `NUCLEO/01-glosario.md` §1.2, hecho 4.
- `NUCLEO/07-outbox-y-notificaciones.md` §6, la fila de la pausa discontinuada.
- `B/03-maquinas-de-estado.md` §3.2, `S25`.

**Severidad.** `ALTA`. **Alguien accede a algo que no le corresponde** —capacidades comerciales y
presencia pública en una vertical cuyo servicio declaramos terminado— y, del otro lado del
mostrador, un visitante ve una ficha activa en una categoría que ya no se puede contratar. No lo
pongo en `CRITICA` porque la dirección del error es la barata —regalamos servicio, no cobramos de
más: `PS-2` mide que una pausada **no cobra**, así que la regla del §4.2 (*«se deja de cobrar antes
de dejar de prestar»*) se sigue cumpliendo— y porque el estado termina solo cuando la pausa vence.
Lo que está roto es que **dos frases en indicativo describen un efecto que ninguna fila produce**,
sobre la población que una decisión de esta tanda creó a propósito.

**¿Es nuevo, o es el arreglo?** **Lo introdujo `DEC-SUB-015`**, una de las doce decisiones nuevas
(commit `5d412ae60`, dentro de la tanda de `8d6b27a12`). Antes de ella el §4.3 ordenaba *«cada
suscripción viva se cancela y pasa a `CANCEL_SCHEDULED`»*: bajo esa redacción **la pausada por
cortesía también terminaba el día 0**, dejaba de emitir y `PB2` disparaba con todo el mundo. La
decisión arregló el choque real —`B/03` §3.3 prohíbe `PAUSED → CANCEL_SCHEDULED`— y al dejar la fila
viva creó la única población de la vertical que sigue cubierta después del fin de servicio, **sin
recorrer qué consumidores leen esa cobertura**.

**¿Lo habría encontrado el grep?** **Sí, y el término es el que la propia decisión introduce.** El
nuevo es **«la pausada no entra al piso»** / **`S25`**; el viejo, el que la decisión retira, es
**«cada suscripción viva»**. Un `rg 'PAUSED.*COURTESY|por`COURTESY`'` cruzado con el §2.6 del
contrato devuelve **la única fila de los nueve estados que emite estando pausada**, y la pregunta
*«¿qué pasa con `PB2` sobre ésa?»* sale de leer esa fila al lado del *«las fichas pasan a
`UNPUBLISHED_BY_BILLING` por PB2»* que el commit **escribió tres párrafos más abajo**, en el mismo
archivo que abrió.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y cae en el tercer desenlace del §1.4,
modo 2.** `rastro-8d6b27a12.md` §4 tiene la fila *«`B/10` §4.3 | «cada suscripción viva se cancela y
pasa a `CANCEL_SCHEDULED`» | la pausada no puede, y no entra»*, o sea que el commit **corrigió esa
premisa en el mismo acto**; lo que quedó sin recorrer es el párrafo *«El día del fin de servicio»*,
que está en el mismo § y que el commit **reescribió** al insertar el recuadro nuevo. La
contradicción vive entre dos párrafos consecutivos del mismo hunk, que es la clase que
`DEC-METH-011` excluye por su propio enunciado. Lo que la habría atrapado no es recorrer términos
sino **recorrer, por cada estado que una decisión deja vivo, los consumidores de su cobertura**.

---

### MEDIA

### F-8fA2-006 — `S13` y `S17` sacan una fila de `PAUSED` sin escribir `fin_real`, y `B/03` §5 afirma que «las dos terminales … cierran la pausa»: son cuatro las salidas terminales, dos las que cierran, y `B/09` §3 lo dice al revés en el mismo párrafo que §5

**Qué se rompe.** El encabezado de `B/03` §5 enumera las salidas de la pausa y afirma dos cosas
falsas de una vez: que las terminales son **dos** (son cuatro: `S22`, `S13`, `S25` y `S17`) y que
**las dos cierran la pausa** (sólo `S22` lo hace; `S13` no escribe `fin_real` en ningún lado). El
efecto concreto es el de `F-8fA2-003` sobre otra población: al beneficiario de un *Free Forever* que
estaba pausado, y al que estaba pausado mientras cambiaba de plan, se le queda una pausa abierta y
sus meses no usados cuentan como usados **el día que el grant se revoque o vuelva a suscribirse**,
porque los topes del §26.3 *«sobreviven a cancelar y volver a suscribirse»*.

**El camino.**

1. **El encabezado, textual.** `B/03` §5: *«Sub-estado de Suscripción con reloj propio y motivo
   obligatorio. **Entra por S8 o S9, sale por S10 — o termina, sin reanudar, por `S22` (la persona
   pide la baja) o por `S13` (le cae un grant). Las dos terminales mandan la fila a `CANCELLED` y
   cierran la pausa**, así que la que sostiene lo que sigue es S10.»*
2. **Son cuatro y no dos.** `S25` sale de `PAUSED` *«con cualquiera de los dos motivos»* y va a
   `CANCELLED`; `S17` declara su `desde` como *«la predecesora, si sigue siendo fila viva — **las
   cinco alcanzables: `ACTIVE`, `GRACE_PERIOD`, `CANCEL_SCHEDULED`, `PAUSED`, `SUSPENDED`**»* y
   también va a `CANCELLED`. El propio §3.2 ya cuenta tres: *«`PAUSED` tiene **otras tres** salidas
   … `S22` —la baja—, `S13` —el grant— y **`S25`**»* — y deja `S17` afuera de esa cuenta también.
3. **Y «cierran la pausa» es falso para `S13`.** Recorrí su celda de efectos entera: cancela la
   obligación de pago, cancela el preapproval, apaga la bandera de `S19`, declara idempotencia y
   reanudabilidad. **No menciona `fin_real`.** Lo mismo `S17`.
4. **El capítulo vecino lo dice al revés, y en el párrafo que habla de las mismas tres filas.**
   `B/09` §3, quinta comprobación: *«`S22` —la baja—, `S13` —el grant— y `S25` … mandan la fila a
   `CANCELLED` … **`S22` y `S25` además escriben el `fin_real` de la pausa**»*. El *«además»* es la
   confirmación de que `S13` **no** lo escribe, escrita por la misma tanda que en `B/03` §5 afirma
   que sí.
5. **La consecuencia no es sólo de prosa.** `B/02` §2.2 restringe a *«a lo sumo una sin `fin_real`
   por suscripción»*; una fila `CANCELLED` con la pausa abierta no choca contra nada —la restricción
   es por suscripción y la suscripción se muere—, pero el conteo de pausas-mes es **por
   `user + vertical`** y sobrevive a la muerte de la fila (`DEC-SUB-004`). O sea: los meses que el
   grant o la sucesión le cortaron **se los cuenta como consumidos** el día que vuelva a pausar,
   que es exactamente el daño que `S22` escribe para justificar su propia escritura.

**Dónde lo permite el diseño.**

- `B/03-maquinas-de-estado.md` §5, el encabezado; §3.2, las celdas de `S13`, `S17`, `S22` y `S25` y
  el § *«`S10` es la única salida de `PAUSED`…»*.
- `B/09-conciliacion.md` §3, el párrafo *«Las otras tres salidas de `PAUSED`…»*.
- `B/02-modelo-de-datos.md` §2.2; `DEC-SUB-004`.

**Severidad.** `MEDIA`. La plata es la misma familia que `F-8fA2-003` pero sobre poblaciones mucho
más chicas —beneficiarios de grant y predecesoras de una sucesión que además estaban pausadas— y con
el agravante invertido: al beneficiario de un *Free Forever* la pausa dejó de importarle. Lo reporto
aparte porque **el conteo y la afirmación son falsos hoy y los dos son verificables en un renglón**,
y porque `S17` no figura en ninguna de las tres enumeraciones de salidas de `PAUSED` del corpus.

**¿Es nuevo, o es el arreglo?** **Es el arreglo, y las dos mitades se pueden fechar.** El
encabezado lo escribió **`032f761e0`** (la familia de **la baja**), que reemplazó *«Entra por S8 o
S9, sale por S10»* por la redacción de arriba — y con ella introdujo *«las dos terminales … cierran
la pausa»*, que era falso para `S13` **ya el día que se escribió**. Después **`8d6b27a12`** (las
ocho decisiones) agregó `S25` y **corrigió la celda «quién la termina» que está tres renglones más
abajo**, sin tocar el encabezado.

**¿Lo habría encontrado el grep?** **Sí, para las dos mitades.** Para `8d6b27a12` el término es
**`S25`** y la obligación 3 pide grepear el viejo, *«las dos salidas»* / *«otras dos»* — un `rg` de
esa cadena sobre `B/03` devuelve el encabezado del §5 junto con las dos celdas que el commit **sí**
corrigió. Para `032f761e0` el término es **`fin_real`**, y un `rg` de la cadena devuelve `S22` y
nada más: la pregunta *«¿y `S13`, que acabo de nombrar como terminal?»* es de una línea.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí para la mitad de `8d6b27a12`, y no se
ejecutó: es el segundo desenlace del §1.4.** Recorrí `rastro-8d6b27a12.md` §2 buscando entradas para
`B/03` §5: hay **L1029-1037** y **L1039-1041** —los dos párrafos de abajo—, y **no hay ninguna para
L1015-1018**, que es el encabezado. El commit tocó ese § (su §4 declara corregida la celda *«quién
la termina»*, `B/03` §5), o sea que el archivo y el § estuvieron abiertos, la aparición no se
corrigió y **no entró al rastro**. La mitad de `032f761e0` cae en la exclusión: el encabezado es
prosa que ese commit escribió.

---

### F-8fA2-007 — `G-R4` cuenta cuatro pares y el corpus dice «tres» en cinco lugares, uno de ellos re-auditando la frase y declarándola «sigue verdadera»; y el rastro que declaró esa corrección hecha nombra tres sitios de los que dos siguen sin corregir

**Qué se rompe.** El número de pares `(desde, evento)` con dos filas es la única cifra del programa
que **un guard recalcula en cada PR**, y el núcleo lo declara así con todas las letras: *«Que sean
cuatro y no cinco **no es una afirmación de este capítulo: es lo que `G-R4` cuenta en cada PR**»*.
Hoy el corpus dice **cuatro** en cinco lugares y **tres** en otros cinco, y uno de los que dice tres
es una tabla de auditoría que va a buscar esa misma frase y la declara *«sigue verdadera»*. Quien
lea `B/03` §8 —*«la tabla de la regla 7 del núcleo sigue teniendo **tres** entradas»*— y abra el
núcleo va a encontrar cuatro, y la lectura razonable es que alguien agregó un par sin declararlo:
o relaja el guard, o borra la cuarta entrada, que es `S10`/`S25`.

**El camino.**

1. **Los cinco que dicen «cuatro»**, todos escritos o confirmados por esta tanda: `NUCLEO/03` §1
   regla 7 (*«Los pares con dos filas y dos destinos distintos que el diseño declara hoy son
   **cuatro**»*, con la tabla de cuatro filas); `B/03` §3.2 (*«**Con éste son cuatro**, y el conteo
   se recalculó sobre la tabla del `NUCLEO/03` §1, no se le sumó uno»*); `B/03` §7.2 (*«los pares
   con dos filas son **cuatro** desde `S25`»*); `V/03` §9 nota 2 (*«que desde la FASE 9-bis-4 son
   **cuatro** —el cuarto es `S10`/`S25`—»*); `V/20` §2 (*«los pares con dos destinos que el diseño
   declara hoy son **cuatro**»*).
2. **Los cinco que dicen «tres»**, con línea:
   - `B/03` L884 (§3.2, `S21`): *«**`S21` no agrega ningún par con dos filas, así que `G-R4` sigue
     contando tres.**»*
   - `B/03` L1265 (§7.1, `MP4`): *«**Y `MP4` no agrega ningún par con dos filas, así que `G-R4`
     sigue contando tres.**»*
   - `B/03` L1581 (§7.2, la tabla *«Qué premisa de otro arreglo vuelve falsa este»*): *«| «`MP4` no
     agrega ningún par, así que `G-R4` sigue contando tres» | el arreglo de `MP4` (§7.1) | **sigue
     verdadera**, y `MP5` tampoco agrega uno |»*.
   - `B/03` L1642-1643 (§8, `A5`): *«Son dos eventos distintos, así que **no hay un cuarto par con
     dos filas** y **la tabla de la regla 7 del núcleo sigue teniendo tres entradas**.»*
   - `V/03` L172 (§2, `T7`): *«**`T7` no es un cuarto par de `G-R4` y no toca los tres
     declarados.**»*
3. **La contradicción más corta está adentro de un solo §.** `B/03` §7.2 dice *«cuatro desde
   `S25`»* en su bloque *«Lo que NO cambia»* (L1543) y, **38 líneas más abajo** (L1581), va a
   auditar la frase *«sigue contando tres»* y la declara **verdadera**. Es el mismo capítulo, el
   mismo §, el mismo día.
4. **Y el dato que decide está enumerado y es inequívoco.** La tabla de `NUCLEO/03` §1 regla 7 tiene
   hoy **cuatro filas**: `T1`/`T6`, `S5`/`S19`, `S7`/`S19` y *«| `(PAUSED, llega el fin de la pausa
   o la persona vuelve antes)` | `S10` / `S25` | si **el plan al que la fila está anclada se sigue
   prestando** |»*. Las conté.
5. **El corpus ya declaró que este modo de falla importa.** El propio párrafo del núcleo remata:
   *«**Y el cuarto es la prueba de que el guard hace falta**: entró en la FASE 9-bis-4 por una
   decisión del owner sobre planes retirados, **no por nadie que estuviera mirando esta tabla**»*.

**Dónde lo permite el diseño.**

- `B/03-maquinas-de-estado.md` L884 (§3.2), L1265 (§7.1), L1543 y L1581 (§7.2), L1642-1643 (§8),
  L572 (§3.2).
- `V/03-maquinas-de-estado.md` L172 (§2) y L456-457 (§9).
- `NUCLEO/03-maquinas-de-estado.md` §1 regla 7, la tabla.
- `V/20-testing.md` §2, `G-R4` y su párrafo.

**Severidad.** `MEDIA`. Nadie paga de más ni accede a nada: el guard cuenta sobre las tablas, no
sobre la prosa, así que `G-R4` va a seguir dando cuatro. Lo que está roto es que **la mitad del
corpus le dice al que lo mire que el guard está midiendo mal**, sobre la única cifra que el
programa declaró explícitamente que no se lleva a mano, y que uno de los cinco lugares es una
auditoría que fue a mirar la frase y la aprobó.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: la tanda de las ocho decisiones (`8d6b27a12`), por
`DEC-SUB-015`**, que creó `S25` y con él el cuarto par. Las cinco frases que dicen *«tres«* son
anteriores y eran **verdaderas el día que se escribieron**; lo que las volvió falsas es la decisión.

**¿Lo habría encontrado el grep?** **Sí, y el commit declara haberlo corrido.** El término viejo es
**«tres pares»** / **«sigue contando tres»** — `rastro-8d6b27a12.md` §2 lo lista textualmente entre
lo que se grepeó: *«…aparece buscando el nuevo: … *«tres pares»* / *«el único par con dos
destinos»*…»*. Un `rg 'contando tres|tres pares|tres entradas|cuarto par'` sobre las dos épicas
devuelve **las cinco líneas que siguen mal** y las cinco que están bien, en una corrida. Lo corrí
hoy y ése es el resultado.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Estaba en el rastro, la declaró corregida, y
dos de los tres sitios que nombra siguen sin corregir. Es el hallazgo de método más fuerte que
pude producir esta vuelta.** `rastro-8d6b27a12.md` §4 —*«Premisas ajenas que el arreglo volvió falsas
**y se corrigieron en el mismo acto**»*— tiene la fila:

> *«| `B/03` §7.1 y §7.2 | «once puertas», **«tres pares»**, «cinco comprobaciones» | doce/trece,
> **cuatro**, seis |»*

**`B/03` §7.1 L1265 y `B/03` §7.2 L1581 siguen diciendo «tres» hoy** — las leí sobre el worktree el
2026-09-22, y el `git blame` de las dos las deja en commits anteriores a `5d412ae60`, o sea que el
commit **no las tocó**. Lo que sí corrigió es L1543, en §7.2. La fila del rastro nombra dos §y
corrigió uno y medio. Y hay dos apariciones más que ese §4 **ni siquiera nombra**: `B/03` §8
L1642-1643 y `V/03` §2 L172 — la segunda es especialmente cara, porque `V/03` §9 **sí** quedó
corregido en el mismo archivo (L456-457 dice *«cuatro»*), así que hoy el capítulo de máquinas de
verticales se contradice consigo mismo a 280 líneas de distancia. Primer desenlace del §1.4, en su
forma pura: **la regla se ejecutó, el rastro lo declaró por escrito, y la resolución fue falsa.**

---

### F-8fA2-008 — El borrado de una ficha es el evento de `A6` y no es una transición de ninguna tabla de `V/03`, ni uno de los actos del dueño que el núcleo enumera: la máquina de addon espera un acto que ningún catálogo produce, que es el defecto exacto que `DEC-ADDON-006` retiró de `A5`

**Qué se rompe.** `A6` mueve una instancia de addon a `CANCELLED` con el evento *«se borra la ficha
destino»*, y `S21` cuelga de ese resultado para apagar el cobro. **Ese acto no existe como
transición**: la máquina de publicación tiene ocho filas —`PB1` a `PB8`— y ninguna sale hacia el
borrado; y la lista de actos del dueño sobre una ficha que el núcleo declara cerrada enumera seis y
no lo incluye. Por la regla 1 del núcleo, un borrado de ficha **no se ejecuta**: se registra y abre
una marca. O sea que `A6` —y con ella la segunda puerta de `S21`, que `B/03` §8 escribe con todas
las letras— espera un hecho que ninguna máquina puede producir, que es palabra por palabra el
defecto que `DEC-ADDON-006` fue a sacar de la tercera cláusula de `A5` tres commits antes.

**El camino.**

1. **`A6` lo declara como evento.** `B/03` §8: *«| A6 | `ACTIVE` | **se borra la ficha destino** |
   `CANCELLED` | **se consume**: no se libera ni se reasigna (`DEC-ADDON-001`) … |»*.
2. **`S21` lo cuenta entre sus disparadores.** `B/03` §3.2: *«**su instancia llega a `CANCELLED`**:
   por cualquiera de las tres cláusulas del evento de `A5` … **y también por `A6`**, el borrado de
   la ficha (§8)»*.
3. **La máquina de publicación no lo tiene.** `V/03` §9 tiene ocho filas y ningún `hacia` terminal:
   `PB1` publica, `PB2` y `PB4`/`PB5` bajan o archivan, `PB3`/`PB7` restituyen, `PB6` despublica,
   `PB8` reactiva a `DRAFT`. Las conté fila por fila.
4. **Y el inventario de actos del dueño lo omite.** `NUCLEO/01` §1.2, hecho 1: *«un **acto del
   dueño** sobre la ficha: **crearla, editarla, publicarla, despublicarla, exportarla,
   reactivarla**»*. Son seis, la lista está declarada cerrada y vigilada por `G-R6-B`, y **crear
   está y borrar no**.
5. **El corpus sí supone que el acto existe, en otro lado.** `V/11` §52 (*«no lo detiene
   despublicar, ni **borrar la ficha**, ni dejar de entrar, ni crear otra»*) y `V/03` §2 (*«ni
   borrar la ficha ni darse de baja lo borran»*, sobre el registro append-only). Dos capítulos
   razonan sobre el acto y ninguna tabla lo declara.
6. **Y el hard delete no es ese acto.** `V/02` §4.1 borra *«el contenido publicable de la ficha …
   los borradores»*, no la fila: la ficha sobrevive vacía. Así que el día 180 no produce el evento
   de `A6` tampoco.
7. **El precedente de forma está a tres commits.** `DEC-ADDON-006` reescribió la tercera cláusula de
   `A5` exactamente por esto: *«ese acto **no está declarado** … así que nombrarlo agregaba un
   momento que nadie podía producir»* y *«**una transición no puede esperar un acto que ningún
   catálogo produce**»* (`B/16` §4.3 y `B/03` §8). El argumento vale igual acá y no se aplicó.

**Dónde lo permite el diseño.**

- `B/03-maquinas-de-estado.md` §8, `A6`; §3.2, el evento de `S21`.
- `V/03-maquinas-de-estado.md` §9, las ocho filas.
- `NUCLEO/01-glosario.md` §1.2, hecho 1.
- `NUCLEO/03-maquinas-de-estado.md` §1, regla 1.
- `V/02-modelo-de-datos.md` §4.1; `B/16-addons.md` §4.3.

**Severidad.** `MEDIA`. No hay plata ni dato perdido hoy, porque la lectura que un implementador va
a tomar es que borrar una ficha es una operación de superficie y no de la máquina — y va a acertar
en el resultado. Lo que está roto es que el corpus **acaba de declarar por escrito que eso es un
defecto** cuando le pasaba a `A5`, y la misma forma sobrevive en `A6`, en `S21` y en la lista cerrada
de hechos que un guard vigila. Y tiene una consecuencia concreta sobre `F-8fA2-002`: el dueño de la
ficha trabada en `UNPUBLISHED_BY_BILLING` **tampoco la puede borrar**, porque el acto no es una
operación declarada.

**¿Es nuevo, o es el arreglo?** **`A6` es vieja; lo volvió señalable la tanda, por dos piezas.**
`DEC-ADDON-004` (`4565639`) escribió `S21` y le puso a su evento la cláusula *«**y también por
`A6`**, el borrado de la ficha»*, o sea que le dio al acto inexistente un **segundo consumidor**; y
`5ac5e92c9` escribió la lista cerrada de los seis actos del dueño del hecho 1, que es el inventario
que hoy lo deja afuera de forma verificable. Antes no había ni consumidor nuevo ni lista cerrada.

**¿Lo habría encontrado el grep?** **Sí, y con el término viejo de la obligación 3.** El que
`DEC-ADDON-006` retira es **«desanclar» / «no está declarado»**, y la cadena que lo encuentra es
**«borra la ficha»**: un `rg 'borra la ficha|borrar la ficha'` sobre las dos épicas devuelve
**cuatro** líneas —las conté— y ninguna es una fila de transición. Contra la tabla de `V/03` §9, que
tiene ocho filas, la comparación es de un vistazo.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y es la ausencia pura: el quinto modo.**
La celda de `A6` **no cambió** en la tanda, así que no hay aparición mal resuelta que citar; lo que
falta es **una fila que nadie escribió**, y ninguna búsqueda le pregunta a un texto por lo que no
dice. Busqué `A6` en los diez rastros: aparece en `rastro-ce52dce5f.md` y `rastro-f21d5d828.md`
sólo como parte de enumeraciones de transiciones de la instancia, siempre declaradas correctas — y
lo son. Lo que lo habría atrapado es lo mismo que anoté la vuelta pasada: **recorrer, por cada
evento nuevo que una fila declara, quién lo produce.**

---

### BAJA

### F-8fA2-009 — La quinta comprobación abre su marca diciendo que «el cliente está sin servicio y sin cobro», y sobre la mitad de su población —la pausa por cortesía— eso es falso: está con servicio y sin cobro, que es exactamente lo que le prometimos

**Qué se rompe.** La quinta comprobación de cero llamadas y la rama de fallo de `S10` abren la misma
marca, `REANUDACIÓN_NO_APLICADA`, y el catálogo de `B/02` §2.5 le escribe a la persona que la va a
resolver: *«reanudar a mano o reclamarle al proveedor — **el cliente está sin servicio y sin
cobro**»*. El `desde` de `S10` es `PAUSED` **con cualquiera de los dos motivos**, y sobre una pausa
por `COURTESY` la frase es falsa mientras la cortesía corra: esa fila **sí emite fuente**
(`12-contrato…` §2.6), el servicio *«lo sostenemos nosotros»* (`DEC-GRANT-003`) y no cobrar es el
regalo, no el síntoma. Quien lea la marca sobre esa fila va a leer una urgencia que no es y,
peor, **no va a ver la que sí es**: cuando la fecha de fin de la cortesía pase, la fuente deja de
emitir por la regla del `hasta`, `cubierto` cae, `PB2` baja la ficha y el reloj de retención arranca
sobre alguien a quien nadie le cortó nada.

**El camino.**

1. **La marca y su texto.** `B/02` §2.5, fila 8: *«| 8 | `REANUDACIÓN_NO_APLICADA` | `S14`, desde la
   rama de fallo de `S10`; **y la quinta comprobación** del `B/09` §3 | reanudar a mano o
   reclamarle al proveedor — **el cliente está sin servicio y sin cobro** | no |»*.
2. **La comprobación no filtra por motivo.** `B/09` §3: *«Si hay una `subscription_pause` **sin
   `fin_real`** cuyo **`fin_previsto` ya pasó** y su suscripción **sigue en `PAUSED`**»*. La
   `subscription_pause` lleva motivo (`B/02` §2.2) y la condición no lo mira.
3. **Y la mitad `COURTESY` de esa población tiene servicio.** `12-contrato…` §2.6: *«| `PAUSED` por
   `COURTESY` | **sí**, como `tipo: CORTESÍA` | la fecha de fin de la cortesía | lo sostenemos
   nosotros (`DEC-GRANT-003`) |»*.
4. **El daño real de esa mitad es otro y la marca no lo nombra.** `12-contrato…` §2.6: *«**El `hasta`
   es el fin de la emisión, no una etiqueta: una fuente con `hasta: fecha` deja de aparecer en
   `fuentes` cuando esa fecha pasa**»*. O sea que la cortesía cuya reanudación no corrió **deja de
   cubrir sola**, `PB2` baja la ficha y el reloj del día 180 arranca — sin que la fila salga de
   `PAUSED` ni el proveedor diga nada distinto.
5. **El propio § de `S10` razona sobre la otra mitad.** `B/03` §3.2: *«**El cliente queda sin
   servicio y sin cobro desde el día 120**, y a nadie le llega nada que lo nombre»*, sobre el caso
   testigo de una pausa del catálogo. Es correcto para `CUSTOMER_REQUEST` y la frase se copió al
   catálogo de motivos como si fuera la definición del motivo.

**Dónde lo permite el diseño.**

- `B/02-modelo-de-datos.md` §2.5, la fila 8 del catálogo; §2.2, `subscription_pause`.
- `B/09-conciliacion.md` §3, la quinta comprobación.
- `B/03-maquinas-de-estado.md` §3.2, la rama de fallo de `S10`; §5.
- `12-contrato-de-cobertura.md` §2.6, la fila de `PAUSED · COURTESY` y la regla del `hasta`.

**Severidad.** `BAJA`. El predicado de la comprobación está bien —la reanudación efectivamente no
corrió, en las dos mitades— y la acción que pide (*«reanudar a mano»*) también. Lo caduco es **la
razón escrita debajo**, que es la clase que ningún guard mira y que acá además esconde el desenlace
que sí cuesta contenido. Lo reporto para que quede anotado que el catálogo de motivos describe media
población.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: la familia de la retención (`5ac5e92c9`/`52efd38fb`)
escribió la rama de fallo y la quinta comprobación, y la familia de la marca escribió la fila 8 del
catálogo con su texto.** Antes de la tanda no había ni comprobación ni fila: el motivo no existía.

**¿Lo habría encontrado el grep?** **Sí.** El término nuevo es **`REANUDACIÓN_NO_APLICADA`**, y un
`rg` suyo devuelve **tres** líneas —la fila 8 de `B/02` §2.5, la rama de fallo de `S10` y la quinta
comprobación de `B/09` §3—. Ponerlas al lado de *«con cualquiera de los dos motivos»*, que es como
`S22` y `S25` escriben su `desde`, es la comparación entera.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No: las tres líneas las escribió la tanda, en
sus propios hunks.** Cae en el tercer desenlace del §1.4, modo 1 de `C1` §4.4. Lo verifiqué contra
`rastro-5836ec219.md` §2, que no tiene entrada para ninguna de las tres.

---

## 2. Hallazgos anteriores que siguen llegando sobre el texto nuevo

No cuentan como hallazgos nuevos (§4 de las instrucciones). Verificados hoy contra el texto y no
contra el informe que los cita.

| ID | veredicto | en qué paso llega ahora |
|---|---|---|
| `F-8eA2-001` | **CORTA** | **paso 2**. `PB3` y `PB7` ganaron la disyunción simétrica a la de `PB2` (*«o el cupo vuelve a alcanzar sin que `cubierto` cambie»*), `V/15` §4.2 dejó de actuar *«sólo si algo bajó»* y pasó a actuar *«en las DOS direcciones»*, y `DEC-DATA-003` le puso criterio de orden. Es el arreglo más completo de la tanda: le contestó al hallazgo, al mecanismo que lo ejecuta y al aviso. **Deja residuo**: el que **no** vuelve a subir queda sin salida (`F-8fA2-002`). |
| `F-8eA2-002` | **CORTA** | **paso 2**. `S10` ganó rama de fallo por relectura con marca `REANUDACIÓN_NO_APLICADA`, y el barrido su quinta comprobación. El § escribe además por qué hacen falta **las dos** (*«la rama sólo corre si el job corrió»*). **Deja residuo**: `fin_real` (`F-8fA2-003`) y el texto del motivo (`F-8fA2-009`). |
| `F-8eA2-003` | **SIGUE** | **paso 1**, sin cambios. Lo medí hoy: `idempotente` y `reanudable` aparecen **cero** veces en toda la épica de verticales, y `V/20` §2 sigue sin nombrar `T7`. Del otro lado, `S13`, `S20` y `S21` siguen declarando las tres propiedades. La asimetría del mismo commit sigue intacta. |
| `F-8eA2-004` | **SIGUE** | **paso 1**. `V/11` §8.3 sigue con **tres** pasos y el paso que publica la versión de pre-trial con la capacidad de activación sigue sin estar. `V/02` §2.1 sigue con el *«si y sólo si»* y `G-R3` sigue verificándolo en las dos direcciones. |
| `F-8eA2-005` | **SIGUE, atenuado** | **paso 2**. `V/11` §378 sigue diciendo *«no le quita nada a nadie»*, y `PRE_TRIAL` sigue siendo fuente viva contra `TRIAL_CONVERTED` que no emite. Lo que cambió es el piso: `V/02` §2.1 le agregó la **tercera** cosa (*«recuperar lo suyo»*), así que el sujeto de `T7` ya no cae a dos capacidades sino a tres. **Sigue perdiendo las otras dos**: borradores ilimitados y la capacidad de activación. |
| `F-8eA2-006` | **SIGUE** | **paso 1**. `V/20` §1 sigue declarando que los guards corren contra *«el árbol de fuentes, en CI»* y `G-R5` sigue vigilando *«el tope de una pausa **que declara el catálogo**»*. Lo nuevo es que `V/20` §2 le agregó a la celda quién lo construye (`B8`) y retiró la de `V9`, o sea que se tocó la fila **sin tocar la capa**. |
| `F-8eA2-007` | **SIGUE** | **paso 1**, verbatim. `V/11` §2.4 sigue diciendo *«Recibir un *Free Forever* consume el trial de esa vertical —`T2` si estaba corriendo, **`T6` si todavía no**—»* y la fila `T6` de `V/03` §2 sigue teniendo por evento *«el evento de activación declarado por la vertical»*, no la aparición de un título. |
| `F-8eA2-008` | **SIGUE, media** | **paso 3**. **`PB8` quedó resuelta**: `V/17` §1.2, precisión 1, le escribió la respuesta del paso 4 y la del paso 6 (*«la versión de piso la otorga hoy: es la tercera cosa de su lista cerrada»*). **`T7` y `PB7` siguen sin clase declarada**: un `rg` de los dos sobre `V/17` devuelve cero, y `V/03` §9 nota 3 sigue diciendo de qué clase **no** es `PB7` sin decir de cuál es. `G-R3-C` sigue fallando el build sobre toda operación que no declare. |
| `F-8eA2-009` | **SIGUE, y se volvió literal** | **paso 2**. Antes era una inferencia sobre la definición; ahora es una columna: `V/02` §2.5 dice *«**`inactiva_desde` no es anulable**: una ficha nace con el instante de su creación, que es el hecho 1»*. O sea que el reloj de un `DRAFT` **arranca el día que se crea**, y `D16` sigue afirmando ser *«lo único que impide que una pausa del catálogo llegue a borrar contenido»* sobre las cuatro redacciones del caso testigo, que siguen empezando la cuenta el día 1 de la pausa. |
| `F-8eA2-010` | **CORTA** | **paso 3**. `V/03` §9 ganó el § *«Cuáles vuelven, cuando el cupo no alcanza para todas»* con el criterio inverso (`DEC-DATA-003`), la razón verificable (*«el conjunto que queda publicado depende sólo del cupo y no del camino»*), la declaración de que el origen **no** desempata, el dato con el que se ordena y la fila 19 de `V/19` para el aviso. `V/15` §4.3 lo generalizó a todo limit contable. |
| `F-8eA2-011` | **SIGUE** | **paso 1**, sin tocar. `B/09` §3 L400 sigue diciendo *«los **cuatro** momentos que el `B/16` §4.3 enumera —el cuarto es la revocación del grant **o el retiro de un ancla**—»*, y sigue siendo **la única aparición de esa cadena en el corpus** (lo volví a contar). `B/16` §4.3 y `B/03` §8 siguen corregidos. Van dos vueltas que las obligaciones 2 y 3 apuntan a esta línea y no la alcanzan. |
| `F-8cA2-006` | **SIGUE** | **paso 3**. Ningún capítulo dice qué estados de la **instancia de addon** emiten fuente. La tabla de `12-contrato…` §2.6 sigue siendo la de los estados de la suscripción, y la instancia `ACTIVE` a costo $0 que deja `S20` colgando del ancla sigue sin respuesta. |
| `F-8cA2-009` | **SIGUE** | **paso 2**. Ninguna de las tablas de transiciones ganó columna de clase de actor. `S22`, `S23`, `S24` y `S25` se suman a la lista de transiciones sin clase declarada. |
| `F-8cA2-011` | **SIGUE, atenuado** | **paso 3**. El reloj de la marca **ganó el dato que le faltaba** —`reconciliation_mark.puesta_en`, `B/02` §2.5 punto 3, que cierra `F-8cB3-005`—, pero el escalamiento sigue sin ser una transición, sin actor y sin destino: `B/09` §3 sigue diciendo *«Si sigue puesta pasado su plazo, **escala**»* y ninguna tabla lo declara. |
| `F-8A2-005` · `F-8bA2-005` · `F-8bA2-006` · `F-8bA2-007` · `F-8A2-013` · `F-8A2-017` | **SIGUEN** | Sin cambio. Verifiqué el conteo que más pesa sobre mi vector: **verticales sigue sin barrido**. Billing tiene cinco comparaciones y **seis** comprobaciones de cero llamadas; verticales no tiene ninguna, y es lo que deja sin detector a `F-8fA2-002`, a `F-8eA2-003` y a la mitad verticales de `F-8fA2-005`. |

---

## 3. Ataques que intenté y el diseño resistió

1. **Meter dos filas sobre el par `(PAUSED, llega el fin)` con las guardas solapadas.** Cerrado por
   construcción y con el argumento escrito: *«las dos guardas leen **el mismo dato** —si el plan
   anclado se sigue prestando— y **una es la negación de la otra**»* (`B/03` §3.2). Probé las cuatro
   combinaciones y el tercer caso —plan vivo, `PUT` no aplicado— **no cae en ninguna de las dos**:
   lo recoge la rama de fallo de `S10`, que es una escritura declarada y no una fila. La única
   imprecisión que encontré es de prosa: `NUCLEO/03` §1 dice que los cuatro pares *«difieren en el
   valor de **un** booleano»* y el de `S10` es una conjunción de dos. No lo reporto porque la
   propiedad que la regla 7 exige —que no se puedan satisfacer a la vez— **se cumple igual**.
2. **Hacer que `S25` corriera sin escribir `fin_real` para cegar la quinta comprobación.** Cerrado, y
   el § lo anticipa por escrito: *«**`S25` es la que más cerca estuvo de volverla ciega** … Lo que la
   separa es que `S25` escribe **las dos columnas que el detector mira** … Si `S25` corriera sin
   escribir el `fin_real`, el barrido reportaría todos los días una reanudación que nadie va a
   aplicar nunca»* (`B/09` §3). Es el mejor auto-análisis de la tanda.
3. **Dejar la sucesión abierta cortando `S18` entre sus cinco escrituras.** No encontré el camino:
   la primera comprobación de cero llamadas busca *«la sucesión abierta sobre una fila muerta»* y
   `G-R1-C` verifica el inventario completo de `B/02` §2.6 —*«un cierre que escribe las dos columnas
   y deja un complemento o la redención apuntando a la predecesora, **o una cortesía vigente sin
   cerrar y sin saldo**, es un cierre incompleto»*—. Probé además cortar **entre** `saldo_días` y
   `sucedida_por`: la sexta comprobación lo levanta igual, porque su segunda fila busca por
   beneficiario + vertical y encuentra a la sucesora en `ACTIVE`.
4. **Cortar `S20` entre sus dos escrituras para dejar un complemento cobrando gratis.** Cerrado, con
   el caso nombrado: *«**El *«normalmente»* tiene un caso con nombre** … una corrida de `S20` cortada
   entre sus dos escrituras. Ahí la instancia ya cuelga del ancla y su complemento sigue vivo, así
   que si el grant se revoca antes de que la corrida se reanude, `A5` la apaga —tiene sujeto, que es
   todo el punto del orden— y **`S21` sí encuentra una fila viva de complemento**»* (`B/03` §3.2). El
   orden normativo de las dos escrituras es lo que lo sostiene, y está escrito como normativo.
5. **Que la baja desde `GRACE_PERIOD` dejara el reloj del §4 corriendo hacia `SUSPENDED`.** Cerrado:
   `S24` declara *«**Apaga el reloj del §4**: sin esta fila el intento caía en la regla 1 del núcleo
   … mientras el reloj del grace seguía corriendo hacia `SUSPENDED` con una persona mirando el
   caso»*. Y `B/03` §4 sumó `S24` a sus salidas.
6. **Conseguir que `S22`/`S23`/`S24` compitieran con alguna fila de su `desde`.** Recorrí los tres
   pares y el argumento se sostiene: el evento de la baja no lo declara ninguna otra fila, y el
   octavo caso —`S24` sobre `GRACE_PERIOD`, que **ya figura** en la tabla de pares— está anticipado
   por escrito (*«un `desde` que ya aparece en la tabla **no arrastra a las filas nuevas** que salen
   de él»*). Es la distinción más fina de la tanda y está bien hecha.
7. **Republicar el borrador de alguien por la rama nueva de `PB7`.** Cerrado en las dos ramas, y el
   rastro lo verificó: `PB7` mira su origen *«para no publicar el borrador de `PB5`, que nunca fue
   candidato»*, y la condición de origen no distingue por cuál de los dos eventos entró.
8. **Usar la restitución por cupo como evento de activación para quemarle el trial a alguien.**
   Cerrado explícitamente y en la rama nueva: *«La rama nueva **no toca `cubierto`** —lo lee, no lo
   mueve—, así que no consume ni devuelve ningún trial … y **no es el evento de activación**:
   restituir no es publicar, igual que en la rama vieja»* (`V/03` §9).
9. **Hacer que la restitución por cupo agregara un par a `G-R4`.** No: *«son **dos eventos en la
   misma fila con el mismo destino**, no dos filas sobre un par — la misma forma que `PB2` ya
   tenía»*, y `NUCLEO/03` §1 lo enumera entre sus ocho casos. El recorrido está hecho.
10. **Conseguir dos marcas del mismo motivo sobre la misma fila para perder una.** El `UNIQUE
    (subscription_id, motivo) WHERE levantada_en IS NULL` lo impide **a propósito** y `S15` levanta
    una y no la fila, que es la mitad que faltaba. El único camino que se me ocurrió —dos pagos
    retenidos por `S19` sobre la misma predecesora, con una sola marca `REEMBOLSO_POR_CONFIRMAR` que
    lleva **una** referencia al pago— exige que las dos puertas de `S19` entren sobre la misma fila,
    y un pagador manual no tiene cuota reciclando en el proveedor. Lo dejo anotado para `B1`/`B3`
    como dominio que no pude poblar, no como defecto.
11. **Que el reconciliador de excedentes ganara un punto de invocación con la dirección nueva.** No:
    *«la dirección nueva **no agrega ningún punto de invocación**, usa la misma lista»*, y `G5`
    —*«ninguna fuente se apaga sin pasar por el reconciliador»*— no gana obligaciones porque
    *«restituir no es apagar una fuente»*. Los dos argumentos son correctos.
12. **Dejar una cortesía diferida sin destino explotando `S25` sobre una vertical viva.** Imposible
    por la guarda: `S25` sólo corre si *«su vertical fue discontinuada»*, así que su población y la
    de la re-emisión imposible son **la misma**, y `DEC-GRANT-010` la declara con causa. No lo
    reporto (§4 de las instrucciones), pero anoto que el tercer disparador de `S9` y la segunda fila
    de la sexta comprobación son, por construcción, **mecanismo sobre población vacía**.

---

## 4. Líneas de rastro que ataqué

**Revisé 63 líneas, sobre cuatro de los diez rastros. Una resultó falsa, una resultó incompleta de
un modo que oculta el defecto, y 61 se sostuvieron.**

**Por qué esos cuatro.** Elegí por las dos puntas que el §2.3 de las instrucciones señala. Por el
lado **grueso**, `rastro-5836ec219.md` (187 apariciones, 20 archivos): es el rastro de la retención,
que es donde vive la mitad de mi vector —el reloj, `PB4`/`PB5`, la relectura, `S10`—. Por el lado
**fino**, `rastro-032f761e0.md` (69 apariciones, 8 archivos): es la familia de la baja, que tocó
`PAUSED` por tres lados y es la más densa por archivo de las que me tocan. Sumé `rastro-8d6b27a12.md`
(91) porque es el que trajo `S25`, que es la transición nueva de mi vector, y `rastro-8f9f31ac0.md`
(65) porque es el que reafirmó el conteo de pares. No toqué los seis restantes: `ce52dce5f` y
`f21d5d828` son de grant, addon y sucesión —vector `B1`/`B3`— y los cuatro de guards no recorren
máquinas.

| rastro | líneas que revisé | qué miré | resultado |
|---|---|---|---|
| `rastro-5836ec219.md` · la retención | **28** — las 11 de `NUCLEO/01` §1.2, la de `NUCLEO/03`, las 14 de `V/03` §2 y §9, y las 2 de `V/15` §4.2 | cada afirmación sobre el reloj, los cuatro hechos, la disyunción nueva y quién reinicia | **27 se sostienen. 1 incompleta**: L433-436 (ver abajo) |
| `rastro-032f761e0.md` · la baja | **14** — las 4 de `B/02`, las de `B/03` §5 y §3.2 sobre `PAUSED`, y la de `B/09` §3 | quién cierra la pausa, qué escribe cada salida, qué mira el detector | **13 se sostienen. 1 incompleta**: L45-49 (ver abajo) |
| `rastro-8d6b27a12.md` · las ocho decisiones | **13** — las de `B/03` §3.2/§5/§3.3, la de `B/10` §4.3 y las 24 filas del §4 leídas como bloque | si lo que declara corregido está corregido hoy | **12 se sostienen. 1 FALSA**: §4, la fila de `B/03` §7.1 y §7.2 (ver abajo) |
| `rastro-8f9f31ac0.md` · el pagador manual | **8** — las de `B/03` §7.1 y §7.2 sobre pares, puertas y comprobaciones | los conteos que el arreglo tocó | **8 se sostienen** para lo que afirman; el error de conteo de `G-R4` no está en este rastro sino en el texto que audita |

### La que resultó FALSA

**`rastro-8d6b27a12.md` §4, fila 13**: *«| `B/03` §7.1 y §7.2 | «once puertas», **«tres pares»**,
«cinco comprobaciones» | doce/trece, **cuatro**, seis |»*, bajo un encabezado que dice *«Premisas
ajenas que el arreglo volvió falsas **y se corrigieron en el mismo acto**»*.

Medido hoy sobre el worktree: **`B/03` §7.1 L1265 sigue diciendo *«`G-R4` sigue contando tres»* y
`B/03` §7.2 L1581 va a buscar esa misma frase y la declara *«sigue verdadera»***. El `git blame` de
las dos las deja en `71615bb41` y `1c17565e1`, los dos anteriores a `5d412ae60`, así que el commit
no las tocó. De los tres ítems que la fila nombra, el de *«tres pares»* quedó corregido en **una**
de las **dos** ubicaciones declaradas. Es `F-8fA2-007`, y es el primer desenlace del §1.4 en su
forma pura.

### La que resultó INCOMPLETA de un modo que oculta el defecto

**`rastro-032f761e0.md` §3, bloque `B/02-modelo-de-datos.md`, L45-49**: *««`subscription_pause` | …
fin real | **a lo sumo una sin `fin_real` por suscripción**» → **sigue correcta, y `S22` la
respeta**: escribe `fin_real` al cancelar, así que no deja una pausa abierta sobre una fila
muerta»*. La justificación verifica la fila **nueva** contra la restricción y no la restricción
contra las filas que ya estaban: `S10` es la salida normal de `PAUSED`, no escribe la columna, y el
*«sobre una fila muerta»* recorta la afirmación justo antes del caso que importa. Es `F-8fA2-003`.

**`rastro-5836ec219.md` §2, `V/03` L433-436**: *««Las dos reinician el reloj … si el cupo no alcanza
y la ficha se queda abajo, el reloj se reinicia igual» → siguen correctas, **y ahora esa ficha
además tiene cómo volver cuando el cupo se libere**»*. Lo que la línea afirma es verdadero; la
cláusula que el rastro le agrega es una condición, no un hecho, y sobre la población de
`F-8fA2-002` no se cumple nunca.

### Las que ataqué y no pude falsear, y vale decirlo

- **`rastro-5836ec219.md` L57** (*«los cuatro hechos siguen siendo cuatro: la corrección le dio al
  hecho 2 una fuente distinta, no agregó ni quitó hechos»*). Intenté mostrar que la relectura de
  `PB4`/`PB5` es un **quinto escritor** —escribe cuando `cubierto` **está** verdadero, no cuando
  *«pasa a»*—. No lo pude sostener: `V/02` §4.2 regla 4 lo declara explícitamente como el segundo
  momento del **mismo** hecho 2. La línea del rastro es correcta sobre lo que afirma; el defecto
  está en **cuántos actores** ejecutan ese momento, que la línea no toca (`F-8fA2-001`).
- **`rastro-032f761e0.md` L109-110** (*«la quinta comprobación … sigue correcta, y el commit la
  reforzó desde el otro lado: `S22` escribe `fin_real` **y** saca la fila de `PAUSED`, así que rompe
  las dos condiciones»*). Verdadera y verificada contra el texto de `B/09` §3.
- **`rastro-8d6b27a12.md` L86-88** (*«el título «`S10` es la única salida de `PAUSED` que devuelve el
  servicio» → `S25` sale de `PAUSED` con el mismo evento y **no devuelve el servicio**: cancela»*).
  Verdadera, y el título está corregido hoy con el calificativo puesto.
- **`rastro-8d6b27a12.md` §4, fila 4** (*«`B/03` §3.2, pares de la baja | «la tabla de pares sigue
  teniendo tres entradas» | `S25` agrega la cuarta»*). Verdadera: `B/03` L572 dice cuatro hoy. Es la
  misma corrección que la fila 13 declara y no ejecuta dos § más adelante, lo que confirma que el
  problema no fue no saberlo.
- **`rastro-5836ec219.md` L466** (*«Una ficha publicada y cubierta no acumula inactividad» → sigue
  correcta*). Verdadera, y es la que sostiene que la mitad `PUBLISHED` del `desde` de `PB4` siga
  teniendo sentido.

---

## 5. Fuera de mi vector

Anotado y no perseguido.

1. **`NUCLEO`** — `NUCLEO/01` §1.2 es el único lugar del corpus que declara que **el hard delete del
   día 180 relee la cobertura**, y `V/02` §2.5 lo enumera entre los **lectores** de la columna que
   escribiría. Es el núcleo de `F-8fA2-001` y la mitad que la **pasada C** tiene que dirimir: qué
   lista gana, la del núcleo o la del capítulo dueño de la columna. **Pasada C.**
2. **`NUCLEO`** — `NUCLEO/03` §1 regla 7 afirma que los cuatro pares *«difieren en el valor de **un**
   booleano, no en una combinación que alguien tenga que evaluar en orden»*, y la guarda de `S10` es
   una conjunción de dos (plan vivo **y** `PUT` aplicado). La propiedad que la regla exige se cumple
   igual; lo que no describe bien es **por qué**. **Pasada C**, cosmético.
3. **`NUCLEO`** — `NUCLEO/04` §3 le sigue dando a `D16` apoyo **guard**, y `G-R5` sigue sin poder
   correr donde el número cambia (`F-8eA2-006`, abierto). Sin cambios respecto de la vuelta anterior.
   **Pasada C.**
4. **Entitlements (`A1`)** — `V/15` §4.2 sigue diciendo que la lista de invalidación tiene *«**siete**
   entradas»*. Es `F-8cA1-008`, de `A1`, abierto desde la 8-bis-2; le agrego que la familia de la
   retención **sí tocó `V/15`** y corrigió el párrafo de arriba (*«actúa sólo si algo bajó»* → *«en
   las DOS direcciones»*) **sin tocar el número dos renglones más abajo**.
5. **Addons (`B1`/`B2`)** — `F-8cA2-006` sigue llegando: los estados de la instancia siguen sin mapa
   de emisión, y `S20` deja una instancia `ACTIVE` a costo $0 colgando de un ancla.
6. **Pagos (`B1`/`B3`)** — dos pagos retenidos por `S19` sobre la misma predecesora chocarían contra
   el `UNIQUE(subscription_id, motivo)` de `reconciliation_mark`, y la marca lleva **una** referencia
   al pago. No pude poblar el dominio (ataque 10 del §3) y lo dejo anotado.
7. **Método (`C1`)** — el reparto de mis nueve contra `DEC-METH-011`: **5** viven adentro de un
   párrafo que el propio commit escribió (`001`, `005`, `009` y las mitades nuevas de `002` y `006`),
   **2** están en una aparición que el rastro declaró resuelta y resolvió mal o de más (`003`, `007`),
   **1** está en un párrafo que el commit no tocó y no entró al rastro (`004`), y **1** es una
   ausencia sin cadena que grepear (`008`). El número que decide si la corrección B de la 8-bis-4 hay
   que aplicarla es el primero: **5 de 9 caen en la exclusión que la enmienda dejó viva a propósito,
   y son la mayoría por tercera vuelta consecutiva**. Lo nuevo y que ninguna vuelta anterior pudo
   medir es el segundo grupo: con el rastro en la mano, **2 de las 63 líneas que revisé fallaron** —
   una falsa y una que oculta el defecto con la cláusula que le agrega—, o sea una tasa de error
   medida de **3,2 %** sobre las que miré. No es una tasa del corpus entero: es la de las líneas que
   elegí **porque tocaban mi vector**, así que está sesgada hacia arriba a propósito.

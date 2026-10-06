---
title: "FASE 8-bis-2 · B3 — conciliación, datos y migración"
linear: HOS-1352
statusSource: linear
created: 2026-09-20
updated: 2026-09-20
status: CURRENT
fase: 8
---

# B3 · conciliación, datos y migración — segunda vuelta

**Vector**: lo que el barrido ve y lo que no, lo que la base guarda y lo que no, y el corte.
**Material**: `B/02`, `B/03` §10, `B/05`, `B/06`, `B/09`, `B/12`, `B/19`, `B/20`, `B/21`, el
contrato de cobertura, `16-fase-7-del-paraguas.md` §4, y `V/21` §2.4 donde el corte lo toca.

**Cómo se recorrió.** Por mandato de `DEC-METH-008` la unidad de trabajo no fue el capítulo: fue
**el dominio que cada arreglo CREA**. Los cuatro ejes que las instrucciones nombran se recorrieron
enumerados, y **tres de los cuatro devolvieron defecto**:

| eje nuevo | tamaño del dominio | recorrido | resultado |
|---|---|---|---|
| los «ocho pares» del espejo (`B/03` §10.1) | **4 × 9 = 36** (4 estados del proveedor, medidos en `RC-1`; 9 nuestros, `B/03` §3.1) | **36 de 36** | **16 pares sin declarar**, tres de ellos coincidencias — `F-8cB3-004` |
| `sucede_a` nulo / no nulo × los nueve estados | 9 predecesoras × {`S17` aplica / no aplica} | 9 de 9 | **la predecesora muerta rompe `S17`** — `F-8cB3-001` |
| la lápida con su `provider_link` (`B/21` §2.5) | los 4 pasos del corte × {lápida escrita / no escrita} | 8 de 8 | **la ventana 3→4 no tiene lápida** — `F-8cB3-003` |
| la marca × su reloj (`B/09` §3) | 1 columna × {puesta / levantada} × {primer caso / segundo caso} | 4 de 4 | **la columna es booleana: el reloj no tiene desde cuándo** — `F-8cB3-005` |

**Conteo de este informe** (contado sobre los `###` de este archivo, no estimado):

| | |
|---|---|
| hallazgos | **21** |
| `CRITICA` | **3** |
| `ALTA` | **9** |
| `MEDIA` | **8** |
| `BAJA` | **1** |
| **atribuidos a un arreglo de la 9-bis** | **18 de 21** · **3 de 3** entre los `CRITICA` |

Los tres que **no** atribuyo a un arreglo son `F-8cB3-012` (preexistente; el arreglo 21 sólo
escribe la prueba de que la justificación vieja era falsa), `F-8cB3-019` (remediación de la FASE 9
declarada y no aplicada) y `F-8cB3-020` (hueco preexistente que ningún informe anterior nombró).

**Números que cito y no medí yo**: las ocho relaciones, los tres compromisos y los cero pagos
salen de `B/21` §1.2 (producción, 2026-09-15, re-verificada el 2026-09-17 12:52 `-03`). Los cuatro
estados de preapproval salen de `RC-1` (*«los 4 estados suman exactamente 153»*, sandbox,
2026-09-15). **«12 filas de alojamiento y 22 usuarios»** sale de `03-handoff.md` §«Tres
correcciones de registro», punto 2, que además declara que **cuántas están publicadas nunca se
contó**. No uso «las doce fichas del catálogo» en ningún lado.

---

## 1. Hallazgos

### F-8cB3-001 — Si la predecesora muere antes de que la sucesora autorice, `S17` no se aplica nunca y el candado `A` queda vacío para siempre: dos autorizaciones cobrando

**Qué se rompe.** Un cliente que canceló y se arrepintió —el caso que el propio diseño declara
*«barato»*— termina con `sucede_a` **no nulo y eterno**. El candado `A` queda vacío, un alta nueva
entra sin que nada la rechace, y quedan **dos preapprovals vivos cobrándole todos los meses**. Es
literalmente el desenlace que los arreglos 11 y 12 vinieron a cerrar, en la mitad del dominio que
no se recorrió.

**El camino.**

1. La persona pide la baja. `S11`: *«`ACTIVE` | pide la baja | `CANCEL_SCHEDULED` | — | **se cancela
   en el proveedor de inmediato** y se guarda **nuestra** fecha de fin de servicio»* (`B/03` §3.2).
2. Antes del fin de servicio se arrepiente. El diseño no le da una transición de vuelta:
   *«`CANCEL_SCHEDULED` → `ACTIVE` … arrepentirse **no es una transición: es una sucesión**. …
   volver exige recrear y volver a autorizar — y eso entra por el candado `B` igual que un
   upgrade»* (`B/03` §3.3). Nace la sucesora con `sucede_a` apuntando a la predecesora.
3. **El guard lo permite**: `G-R1-A` falla si la predecesora está *«**fuera de**
   `{ACTIVE, GRACE_PERIOD, CANCEL_SCHEDULED}`»* (`B/20` §2). `CANCEL_SCHEDULED` está adentro.
4. La persona autoriza dentro de las 72 h. `S17` se dispara y su primer efecto es *«**se cancela en
   el proveedor** (es `D7`)»* (`B/03` §3.2). **Pero ese preapproval ya está cancelado desde el paso
   1**, y está medido qué contesta el proveedor: `PA-5`, `VERIFIED`, producción y sandbox —
   *«`PUT {status:"cancelled"}`. **Irreversible**: reintentar da `400`»*
   ([`06-mp-validation-matrix.md`](../06-mp-validation-matrix.md), fila `PA-5`).
5. `S17` tiene escrita la salida de ese `400`, y es la que cierra la trampa: *«Si la cancelación en
   el proveedor **falla**, `S17` no ocurre: la marca se pone y una persona lo mira, que es el camino
   declarado y no un hueco»* (`B/03` §3.2). **Si `S17` no ocurre, `sucede_a` no se limpia**, porque
   la limpieza es el segundo efecto de la misma transición: *«en el mismo acto **la sucesora limpia
   su `sucede_a`**»*.
6. Con `sucede_a` no nulo y la predecesora en `CANCELLED`, el candado `A` —*«`WHERE clase =
   principal AND sucede_a IS NULL AND estado ∈ {vivos}`»* (`B/02` §2.2)— **no tiene ninguna fila
   que lo ocupe**. `EX-6` mide que el proveedor no frena la segunda (`B/02` §2.2). Un alta nueva
   entra, autoriza, y hay dos preapprovals cobrando.

**Y hay una segunda entrada al mismo pozo, sin depender del `400`.** La predecesora en
`CANCEL_SCHEDULED` tiene fecha de fin de servicio, y `S12` no pregunta por sucesoras: *«`S12` |
`CANCEL_SCHEDULED` | llega la fecha de fin de servicio | `CANCELLED` | — | se corta el servicio»*
(`B/03` §3.2). La ventana de autorización dura **72 h** (`B/03` §3.4, punto 1). Si el fin de
servicio cae adentro de esas 72 h —el caso normal de quien se arrepiente el último día—, cuando la
sucesora autorice la predecesora ya está en `CANCELLED`, y **`S17` exige explícitamente «la
predecesora, en cualquier estado vivo»**. El `desde` no matchea, la transición no existe, y
`sucede_a` queda igual de eterno.

**Dónde lo permite el diseño.** El arreglo declara su dominio recorrido y **la declaración es
falsa**:

> *«**El dominio que esto crea, recorrido**: la sucesora puede tener `sucede_a` **no nulo**
> (sucesión en curso …) o **nulo** (sucesión terminada …). **No hay un tercer estado**, y el paso
> entre los dos es atómico con `S17`.»* — `B/03` §3.2

El tercer estado existe y es el de arriba: **`sucede_a` no nulo con la sucesión terminada y `S17`
inalcanzable**. El § lo enumeró sobre las dos filas de la sucesora y nunca sobre los **nueve
estados de la predecesora**, que es donde el arreglo puso su precondición (`desde: cualquier estado
vivo`).

**Severidad.** `CRITICA`. Dos autorizaciones vivas del mismo `user + vertical` cobrando: alguien
paga de más, y es el daño exacto que el §11 existe para impedir.

**¿Es nuevo, o es el arreglo?** **Es el arreglo** — los **11 y 12** (`S17` cancela la predecesora y
limpia `sucede_a`). Antes de ellos no había ninguna transición que limpiara y el defecto era
*«nunca se limpia»* (`F-8bB1-001` ≡ `F-8bB2-002`); ahora hay una que limpia **en seis de los nueve
estados de la predecesora**, y el hueco quedó en los tres terminales, alcanzables desde el camino
más común del capítulo 12. El eje que faltó recorrer es exactamente el que `DEC-METH-008` nombra:
`sucede_a` cruzado con los nueve estados.

---

### F-8cB3-002 — `B/05` §3 manda reactivar con el pago tardío en la ventana exacta donde `B/12` §5.3 manda no aplicar `S5`: dos capítulos, el mismo hecho, respuestas opuestas

**Qué se rompe.** El cobro de la cuota en reintento entra durante la sucesión. Un capítulo dice
*«reactivá la predecesora»* y el otro dice *«no la reactives, reembolsá»*. Quien implemente el
primero produce **las dos filas vivas con el crédito de la sucesora ya computado en cero**: el
cliente paga un período entero que no le compra nada y la fórmula que lo ignoró ya no se puede
corregir. Es, palabra por palabra, el daño que el arreglo 15 describe y viene a impedir.

**El camino.**

1. La predecesora está en `GRACE_PERIOD` y su cuota sigue en `recycling` — medido: *«Mientras la
   predecesora siga viva su cuota sigue en `recycling` (§1.3, medido) y **puede entrar**»*
   (`B/12` §5.3).
2. El cliente cambia de plan desde grace, que es el camino de recuperación (`DEC-SUB-003`,
   `B/03` §4). Nace la sucesora en `PENDING_AUTHORIZATION` con `sucede_a` no nulo.
3. Entra el cobro. `B/05` §3 evalúa sus cuatro condiciones de *«pago tardío seguro de reactivar»*:
   la 1 se cumple (*«la suscripción existe y está en `GRACE_PERIOD` o `SUSPENDED`»*), la 2 y la 4
   se cumplen, y **la 3 se cumple por escrito**: *«no hay otra fila principal … en un estado que dé
   título —`ACTIVE`, `GRACE_PERIOD`, `PAUSED`, `CANCEL_SCHEDULED`—, **ni una sucesora de esta fila
   ya autorizada**»*. La sucesora está `PENDING_AUTHORIZATION`: no está en la lista y no está
   autorizada.
4. Por si quedara duda, el mismo § lo dice en voz alta y con motivo: *«**Y una sucesora en
   `PENDING_AUTHORIZATION` no bloquea, a propósito.** Todavía no puede cobrar —`D8` le exige fecha
   de primer cobro futura— y el pago tardío que reactiva a la predecesora **es la evidencia de que
   la sucesión ya no hace falta**»* (`B/05` §3).
5. `B/12` §5.3 dice lo contrario sobre el mismo hecho: *«**`S5` no se aplica sobre una fila que ya
   declaró sucesión.** El pago entra, se registra, y **se reembolsa**; la predecesora sigue su
   camino a `CANCELLED` por `S17`»*.

**Dónde lo permite el diseño.** Las dos citas de arriba, en dos capítulos que **`B/05` §3 y `B/12`
§5.3**, sin que ninguno nombre al otro. `B/05` §3 **se editó en esta misma tanda** —*«Su redacción
cambió, y es más precisa, no más laxa»*, y cita *«la marca de `B/02` §2.2»*, que es de los arreglos
17 y 19—, así que el capítulo estuvo bajo la mano que escribió el 15 y salió contradiciéndolo.

**Y el conflicto no se resuelve leyendo con cuidado**, porque las dos reglas son argumentadas en
direcciones opuestas: `B/05` §3 justifica no bloquear (*«bloquear ahí dejaría a la persona con la
vieja sin reactivar y la nueva sin autorizar»*) y `B/12` §5.3 justifica no reactivar (*«paga un
período entero que **no le compra nada**»*). Las dos razones son buenas y sólo una puede ejecutarse.

**Severidad.** `CRITICA`. Si gana `B/05` §3, el cliente paga un período que el diseño ya declaró
perdonado y no se lo devuelve nadie: paga de más.

**¿Es nuevo, o es el arreglo?** **Es el arreglo 15** (*«`S5` no aplica sobre una fila que ya declaró
sucesión»*). El arreglo escribió su regla en el capítulo 12 y **no recorrió el dominio que crea**:
todo lugar del diseño donde `S5`/`S7` se dispara por un pago. Ese lugar es exactamente uno, es
`B/05` §3, y ahí la respuesta declarada sigue siendo la vieja.

---

### F-8cB3-003 — La lápida no puede existir entre el paso 3 y el paso 4 del corte, que es la ventana exacta que vino a cubrir

**Qué se rompe.** El orden del corte pone la escritura de las lápidas **después** del despliegue y
**a mano**, *«en la misma tanda en la que se habla con la gente»*. Durante esa ventana el sistema
nuevo ya corre **sin ninguna lápida**, y un cobro viejo en vuelo llega como preapproval desconocido:
el único camino automático lo empareja con la suscripción nueva de esa misma persona. **El cobro
viejo se imputa como pago del ciclo nuevo: pagó dos veces y el sistema registra una.** La frase no
es mía: es la del capítulo que inventó la lápida para evitarlo.

**El camino.**

1. Paso 1 y 2 del corte: se cancelan los tres preapprovals y se verifica releyendo
   (`16-fase-7-del-paraguas.md` §4.2). El paso 2 descarta *«la cancelación se aceptó y no se
   aplicó»*.
2. **No descarta la otra mitad**: *«o porque el cobro ya estaba en vuelo»* (`B/21` §2.5). Está
   medido que el retraso del cobro es variable y no predecible —*«~33 minutos en una renovación de
   sandbox, ~26 en producción, ~100 segundos en un alta»* (`B/09` §6.2)— y `B/05` §C2 lo trata como
   un caso vivo: *«el cobro puede estar ya en vuelo»*.
3. Paso 3: se despliega. El sistema viejo, *«el lugar donde anotarlo»* que el §4.2 declara como la
   razón del orden, deja de existir.
4. Paso 4: *«**sembrar las lápidas** (`B/21` §2.5) con los ids cancelados | el sistema **nuevo** |
   la fila es del esquema nuevo: **no puede existir antes del paso 3**»*
   (`16-fase-7-del-paraguas.md` §4.2). Y no es inmediato: *«**El paso 4 es la única escritura del
   corte, y es a mano.** … Se escriben sobre una lista conocida, **en la misma tanda en la que se
   habla con la gente**»*.
5. En esa ventana llega el webhook del cobro en vuelo. `B/09` §2.2: *«toda suscripción que cobra
   emite un webhook, así que uno que llegue de un preapproval desconocido **es** la detección»*, y
   `B/09` §2.4: *«**Sólo se repara el vínculo automáticamente**»*.
6. El emparejamiento está descrito y es el peor posible: *«El candidato más plausible del
   emparejamiento es **la suscripción nueva de esa misma persona, que acaba de contratar**»*
   (`B/21` §2.5). Y que ya haya contratado no es hipotético: las fichas *«se despublican la mañana
   del corte»* y *«vuelven solas cuando cada dueño contrata»* (`V/21` §2.4), sobre gente a la que se
   está llamando **en esa misma tanda**.

**Dónde lo permite el diseño.** El arreglo 21 se justifica así:

> *«Con la lápida, el barrido del cap. 09 **encuentra el id** y resuelve «cancelado durante el
> corte» en vez de «huérfana».»* — `B/21` §2.5

Y el arreglo 23 hace que la lápida **no exista todavía** precisamente cuando eso haría falta:

> *«la fila es del esquema nuevo: **no puede existir antes del paso 3**»* —
> `16-fase-7-del-paraguas.md` §4.2

El §4.2 nombra la ventana peligrosa y elige la otra: *«**La ventana entre el paso 1 y el paso 3** es
la parte incómoda, y se declara»*. **La ventana entre el paso 3 y el paso 4 no se nombra en ningún
lado**, y es la única en la que el cobro cae en un sistema que no lo reconoce.

**Severidad.** `CRITICA`. Alguien paga dos veces y el sistema registra una, sobre dinero real, en el
único momento del programa que no tiene vuelta atrás.

**¿Es nuevo, o es el arreglo?** **Es el cruce de dos arreglos, el 21 y el 23**, y ninguno de los dos
lo ve solo. El 21 escribió la lápida sin decir cuándo se escribe; el 23 escribió el orden y la puso
al final, con una razón correcta (*«la fila es del esquema nuevo»*) que **vuelve falsa la premisa
del 21** —que la lápida está ahí cuando el cobro llega—. Es el caso textual de la pregunta
obligatoria de `DEC-METH-008`.

---

### F-8cB3-004 — El espejo declara «ocho pares» sobre un dominio de 36, y tres de las cuatro coincidencias caen en «divergencia real»: toda renovación normal marca la fila

**Qué se rompe.** El webhook de una renovación normal dispara una relectura, la relectura devuelve
`authorized` sobre una fila `ACTIVE`, **ese par no está en la tabla**, y la regla del § manda
tratarlo como divergencia real: se pone `requiere_conciliación`, se emite el evento crítico del
§22.1, y **la fila queda con la marca puesta, que le bloquea al cliente declarar una sucesión**
(`B/02` §2.2). O sea: nadie puede cambiar de plan después de su primera renovación, y el listado
accionable de conciliación se llena con la cartera entera — que es la forma más eficaz de esconder
la única divergencia que sí importa.

**El camino.**

1. El proveedor devuelve **cuatro** estados de preapproval y está medido: `RC-1`, *«**`status`
   filtra** (los 4 estados suman exactamente 153)»*
   ([`06-mp-validation-matrix.md`](../06-mp-validation-matrix.md)). **El arreglo acierta en el lado
   del proveedor**: no son más de cuatro.
2. Los nuestros son **nueve** (`B/03` §3.1). El dominio del cruce es **4 × 9 = 36**, no ocho.
3. La tabla del §10.1 tiene ocho filas, pero dos son comodines. **Conté los 36 pares uno por uno
   contra esas ocho filas**:

   | columna del proveedor | pares cubiertos | pares sin declarar |
   |---|---|---|
   | `pending` | 9 — una fila explícita y *«cualquier otro»* | 0 |
   | `authorized` | 4 — `PENDING_AUTHORIZATION`, `PAUSED`, `GRACE_PERIOD`, `SUSPENDED` | **5** — `ACTIVE`, `ABANDONED`, `CANCEL_SCHEDULED`, `CANCELLED`, `CHARGE_DECLINED` |
   | `paused` | 1 — `ACTIVE` | **8** — todos los demás, **incluido `PAUSED`** |
   | `cancelled` | 6 — `CANCEL_SCHEDULED` y *«cualquier estado vivo que no sea `CANCEL_SCHEDULED`»* (5) | **3** — `ABANDONED`, `CANCELLED`, `CHARGE_DECLINED` |
   | **total** | **20** | **16** |

4. Y el § declara qué pasa con los que faltan: *«Lo que **no** figura acá es divergencia real, y ahí
   la marca es la respuesta correcta — deja de ser un falso positivo y pasa a señalar lo que su
   nombre dice»* (`B/03` §10.1).
5. **Tres de los 16 son coincidencias**, o sea el caso en que no pasa nada:
   `authorized × ACTIVE` (la renovación normal, el evento más frecuente del sistema),
   `paused × PAUSED` (toda pausa y toda cortesía) y `cancelled × CANCELLED` (toda reentrega de un
   webhook de baja; `RF-7` mide que un mismo hecho emite **tres notificaciones en dos formatos**).
   Las otras tres coincidencias que sí están —`pending × PENDING_AUTHORIZATION` y
   `cancelled × CANCEL_SCHEDULED`— muestran que el patrón *«nada: coinciden»* estaba en el diseño
   del arreglo; se enumeraron dos de cinco.
6. Otros tres de los 16 son **terminales cuya baja ya conocemos**: `cancelled × ABANDONED` (`S3`
   canceló el preapproval), `cancelled × CHARGE_DECLINED` (*«el proveedor la canceló al
   rechazarlo»*, `B/03` §3.1) y `authorized × CANCEL_SCHEDULED` — este último **sí es divergencia
   real y la marca es correcta**, así que el comodín acierta en uno de dieciséis.

**Dónde lo permite el diseño.** `B/03` §10.1, la tabla *«Qué se escribe, par por par»* y su nota
final, contra `B/03` §3.1 (nueve estados) y `RC-1` (cuatro del proveedor).

**Y un daño de segundo orden que conviene decir**: `paused × PAUSED` con motivo `COURTESY` tiene
además una salida peor que la marca. La fila 6 espeja `paused` *«con motivo `CUSTOMER_REQUEST`»*, y
quien complete la tabla por analogía le pisa el motivo a una cortesía — que es exactamente el
accidente que `DEC-GRANT-004` existe para impedir: *«un reloj que leyera el estado del proveedor
reanudaría la cortesía de quien había pedido pausa, o al revés»* (`B/03` §5).

**Severidad.** `ALTA`. No hay un peso mal cobrado en el paso, pero la marca bloquea la sucesión del
cliente (`B/02` §2.2), arranca un reloj que **escala** (`B/09` §3) y ahoga el único detector de la
divergencia de monto, que es la que sí cuesta plata. No lo subo a `CRITICA` porque nadie paga de
más por este camino solo.

**¿Es nuevo, o es el arreglo?** **Es el arreglo 18** (*«los ocho pares, enumerados con su
veredicto»*). El defecto anterior era que **seis de ocho** pares no tenían transición declarada
(`F-8bB2-005`); el arreglo enumeró ocho filas y **midió el dominio por el lado del proveedor**
—cuatro estados, y ahí acertó— **sin multiplicarlo por los nueve nuestros**. Es el mismo error de
método que el `UNIQUE` del §11: se recorrió la mitad del dominio nuevo.

---

### F-8cB3-005 — La marca lleva reloj y la columna es un booleano: no hay desde cuándo contar, y la escalada que le pone cota al servicio gratis no se puede implementar

**Qué se rompe.** El arreglo 19 cerró *«el servicio gratis no tiene cota»* poniéndole un reloj a la
marca. El reloj no tiene de dónde leer la hora: la columna que el modelo declara es un booleano. La
cota vuelve a no existir, y vuelve por el mismo camino por el que se había ido.

**El camino.**

1. `B/09` §3: *«**La marca lleva reloj.** Si sigue puesta pasado su plazo, **escala**: es una
   divergencia de plata que nadie resolvió, y sin reloj el servicio que la fila sostiene **no tiene
   cota**. El plazo es configuración, como todos los del §42.»*
2. Un plazo se mide contra un instante, y el instante tendría que estar en la fila.
3. `B/02` §2.2 declara la columna y no tiene instante: *«**`requiere_conciliación`** (booleano)»*.
4. `B/03` §3.1 lo repite y lo subraya: *«**`requiere_conciliación` es una marca booleana sobre la
   fila, no un estado.** La fila conserva el estado que tenía»*.
5. Un booleano no dice cuándo se puso. `S14` *«pone la marca»* y `S15` *«levanta la marca»*
   (`B/03` §3.2) sin escribir ninguna fecha, y el listado accionable de `B/19` §6 muestra *«el
   estado real de la fila»*, no una antigüedad.

**Dónde lo permite el diseño.** `B/09` §3 contra `B/02` §2.2 y `B/03` §3.1.

**Severidad.** `ALTA`. Lo que la escalada acota es una divergencia de monto que **sigue saliendo de
la tarjeta del cliente todos los meses** —es el caso que el mismo § describe— así que sin reloj el
daño no tiene fin declarado. No es `CRITICA` porque el barrido sigue detectándola y el listado sigue
mostrándola: lo que falta es el plazo, no la detección.

**¿Es nuevo, o es el arreglo?** **Es el arreglo 19** (*«la fila marcada SÍ se barre … y la marca
lleva reloj»*). El arreglo recorrió el dominio del problema —el barrido, el aviso, la cota— y no el
que crea: **la columna que el reloj necesita**. Y la columna estaba a la vista, en el capítulo
vecino, escrita en la misma tanda por el arreglo 17.

---

### F-8cB3-006 — El barrido excusa `next_payment_date` por diseño, así que la columna del arreglo 13 sólo se verifica contra nuestra propia copia

**Qué se rompe.** El arreglo 13 existe para que `D8` —*«una fecha de primer cobro futura es la
precondición de seguridad de todo cambio de plan o de ciclo»*— pase de recordable a **verificable**.
Lo que quedó verificable es que **la fecha que guardamos es la que leímos al crear**. Si el
proveedor la mueve después —al autorizar, que es el instante que importa— **ningún mecanismo del
diseño lo mira**, porque el único que releería esa fecha tiene escrito que no la cuente.

**El camino.**

1. La sucesora nace y se guarda la fecha confirmada: *«**La fecha de primer cobro que se guarda es
   LA QUE EL PROVEEDOR CONFIRMÓ, no la que mandamos.** … La fecha se escribe en esa misma
   relectura, que ya ocurre»* (`B/02` §2.2). La relectura ocurre al crear, sobre un preapproval
   `pending`.
2. El cliente autoriza hasta **71 horas después** (`B/12` §5.2, `S3`). Ahí el proveedor fija el
   calendario real.
3. El único proceso que volvería a mirar esa fecha es el barrido, y su tabla la excusa:
   *«fecha del próximo cobro | `next_payment_date` | se registra; **no es por sí sola una
   divergencia**, porque el proveedor la mueve solo en casos medidos (`PS-6`)»* (`B/09` §3).
4. Y el guard tampoco la vuelve a mirar en el proveedor: `G-R1-B` *«compara la fecha guardada contra
   el vencimiento de la ventana de esa misma fila»* (`B/12` §5.2) — **la guardada**, no la viva.
5. El diseño mide que la asimetría es real: `EX-39` (*«la inmutabilidad de las fechas no depende del
   estado»*) dice que **nosotros** no la podemos mover; **no dice que el proveedor no la mueva al
   autorizar**, y `GT-1` mide que ese campo se comporta raro —*«su `next_payment_date` quedó
   congelado en la fecha vieja … **`next_payment_date` no se limpia**, así que ese campo no sirve
   para saber si va a cobrar»*.

**Dónde lo permite el diseño.** `B/02` §2.2 (la columna), `B/09` §3 (la excusa) y `B/20` §2
(`G-R1-B` lee la columna).

**Severidad.** `ALTA`. El incumplimiento de `D8` *«es literalmente el doble cobro»* (`B/02` §2.2), y
lo que el arreglo entrega es una verificación contra una copia que no puede estar mal — que es
textualmente la crítica que el propio arreglo le hizo a la versión anterior: *«Guardar la que
mandamos no verificaba nada: verificaba el único dato que no podía estar mal»*.

**¿Es nuevo, o es el arreglo?** **Es el arreglo 13**, y su premisa la vuelve falsa **el arreglo 19**,
que escribió la tabla del barrido. El 13 se apoya en *«la relectura que ya ocurre»* sin decir que
esa relectura es una sola, al crear; el 19 declaró que las relecturas posteriores **no miran esa
fecha**. Cada uno es defendible por separado.

---

### F-8cB3-007 — Los dos guards que sostienen `D8` y el candado son propiedades de FILAS, y están declarados en la capa que corre contra el árbol de fuentes

**Qué se rompe.** `G-R1-A` y `G-R1-B` son lo único que convierte a `D8` y a la forma de la sucesión
en algo verificable en vez de recordable. Están puestos en la capa de guards, y esa capa está
definida como *«propiedades del **código**, no de una ejecución»* que corren *«el árbol de fuentes,
en CI»*. Ninguno de los dos se puede escribir así: los dos cuantifican sobre filas de la base, que
no existen en el árbol de fuentes. El invariante vuelve a ser algo que alguien tiene que acordarse
de cumplir, que es exactamente lo que el arreglo declaró haber cerrado.

**El camino.**

1. `B/20` §1: *«**guards** | propiedades del **código**, no de una ejecución | el árbol de fuentes,
   en CI»*.
2. `B/20` §2 lista los dos nuevos y los dos hablan de filas:
   - *«`G-R1-A` | **una fila** con `sucede_a` no nulo apunta a una predecesora **fuera de**
     `{ACTIVE, GRACE_PERIOD, CANCEL_SCHEDULED}`, o a una que a su vez tenga `sucede_a` no nulo»*;
   - *«`G-R1-B` | **una fila** con `sucede_a` no nulo **no** nace con fecha de primer cobro posterior
     al vencimiento de su ventana de autorización, **o esa fecha no es la que el proveedor
     confirmó**»*.
3. Los cuatro guards anteriores de la lista —`G7`, `G9`, `G10`, `G11`— sí son propiedades del código
   (*«un valor comercial vive **en código**»*, *«se le pide un **trial al proveedor**»*): la capa
   estaba bien definida antes de esta tanda.
4. `B/20` §2 agrava el punto al explicar `G-R1-B`: *«**depende de la columna** que guarda la fecha
   con la que nació la fila (cap. 02 §2.2): **sin ella el guard no se puede escribir**»*. Una
   dependencia de una columna es la firma de un chequeo de datos, no de un chequeo de fuentes.
5. Y `B/20` §2.1 le exige a todo guard de la lista *«un caso que lo hace fallar a propósito»*: un
   caso que hace fallar a `G-R1-A` es **una fila**, no un archivo.

**Dónde lo permite el diseño.** `B/20` §1 y §2; `B/12` §5.2 (*«es verificable sin contexto:
`G-R1-B` compara la fecha guardada contra el vencimiento de la ventana de esa misma fila»*).

**Severidad.** `ALTA`. Es el mecanismo de verificación de la precondición de seguridad del mecanismo
más caro del sistema, colocado en una capa que no lo puede ejecutar. No es `CRITICA` por sí solo: no
mueve plata, deja de impedir que otra cosa la mueva.

**¿Es nuevo, o es el arreglo?** **Es el arreglo 14** (la fecha atada al vencimiento de la ventana,
que trajo `G-R1-B`) junto con el **13** (*«o esa fecha no es la que el proveedor confirmó»*, la
segunda mitad del predicado). Los dos escribieron su guard donde estaba la lista, sin preguntar qué
corre esa lista.

---

### F-8cB3-008 — `addon_product.version_id` sigue declarado «la referencia que transporta una fuente `ADDON`», al lado del ancla que el arreglo 10 le puso a la instancia

**Qué se rompe.** El arreglo 10 le dio a `addon_instance` la versión que ancló al comprarse,
*«publicar una versión nueva cambia lo que ya se compró»*. En la misma tabla, dos filas más arriba,
sigue escrito que **la referencia que el contrato transporta la aporta el producto**, no la
instancia. Quien implemente esa frase lee la versión vigente del producto y el defecto sigue entero:
publicar una versión nueva cambia lo que ya se compró, para todas las instancias a la vez.

**El camino.**

1. `B/02` §2.4, fila `addon_product`: *«más **`version_id`** → `addon_version` … | `version_id` **no
   es anulable**: **es la referencia que transporta una fuente `ADDON`**»*.
2. `B/02` §2.4, fila `addon_instance`: *«producto, **la `addon_version` que ANCLÓ al comprarse**, …
   | … **la versión anclada no es anulable**»*.
3. El contrato pide **una** referencia por fuente: *«**`referencia`** | … una versión de plan o una
   versión de addon. **No es anulable**»* (`12-contrato-de-cobertura.md` §2.1), y la fuente `ADDON`
   nace de una **instancia**, no de un producto: es la instancia la que tiene `objetivo`, estado,
   inicio y fin, y es la instancia la que el §2.7 del contrato manda leer (*«billing … sólo devolver
   el `objetivo` que ya guarda en `addon_instance`»*).
4. Las dos columnas divergen apenas se publica una `addon_version` nueva, que es el caso que el
   arreglo vino a cubrir.

**Dónde lo permite el diseño.** `B/02` §2.4, las dos filas, contra `12-contrato-de-cobertura.md`
§2.1 y §2.7.

**Severidad.** `ALTA`. Alguien recibe capacidades distintas de las que compró, en las dos
direcciones — y si la versión nueva otorga menos, se le saca algo que pagó.

**¿Es nuevo, o es el arreglo?** **Es el arreglo 10** (`addon_instance` ancla su `addon_version`). El
arreglo agregó la columna correcta y **no borró ni corrigió la frase que nombra a la otra como la
portadora**, con lo cual la tabla ahora declara dos referencias para una fuente que admite una.

---

### F-8cB3-009 — `PB2` se dispara por el CAMBIO de `cubierto` y en el corte no hay cambio: la despublicación que el arreglo 22 declara «una consecuencia, no una ambigüedad» no ocurre

**Qué se rompe.** Todo el plan del corte del lado de verticales descansa en que la mañana del corte
las fichas se despublican solas, se llama a la gente y vuelven por `PB3` cuando contratan. `PB2` se
dispara por una **transición** de `cubierto`, y el día del corte `cubierto` no transiciona: nace
falso. Las fichas quedan publicadas sin ninguna relación comercial detrás, y el camino de vuelta que
el arreglo 22 quería *«ejercitar el primer día»* no se ejercita.

**El camino.**

1. `V/21` §2.4 lo declara determinado: *«`PRE_TRIAL` **no cubre** … y **`PB2` se dispara por el
   cambio de `cubierto`** (`V/03` §9), así que **las fichas publicadas de Alojamiento se despublican
   la mañana del corte**. No es una ambigüedad entre dos ramas: es una consecuencia»*.
2. `V/03` §9 define el disparador y es literalmente un cambio: *«PB2 | `PUBLISHED` | **`cubierto`
   pasa a falso** | `UNPUBLISHED_BY_BILLING`»*, y el § lo subraya: *«**`PB2` y `PB3` se disparan por
   el CAMBIO de `cubierto`, no por una lista de transiciones**»*.
3. El mecanismo del cambio es un empuje de billing: *«**El contrato ya emite el hecho** —*«la
   cobertura de (user, vertical) cambió»*(`12-contrato…` §3)— así que atarse a él **no agrega un
   mecanismo: usa el que estaba**»* (`V/03` §9).
4. El día del corte no hay valor anterior contra el cual haya cambio, y no hay quién lo empuje: el
   sistema nuevo acaba de nacer y **no hereda una sola fila** (`B/21` §2.4, `V/21` §2.4). Billing no
   emite ningún evento de cobertura porque ninguna cobertura cambió: nunca hubo una.
5. El reconciliador tampoco lo cubre por escrito: el contrato lo ata al mismo aviso —*«la lista de
   invalidación del caché … es la **misma lista** que dispara el reconciliador de excedentes»*
   (`12-contrato…` §3)— y lo que se dispara *«por condición»* es el de **excedentes**, que es el
   caso que `V/03` §9 declara aparte porque *«no cambia `cubierto`»*.

**Dónde lo permite el diseño.** `V/03` §9 (el disparador es el cambio) contra `V/21` §2.4 (la
despublicación es una consecuencia determinada) y `16-fase-7-del-paraguas.md` §4.2 (el quinto acto,
que la da por hecha).

**Severidad.** `ALTA`. Quedan fichas públicas sin título que las cubra —servicio que nadie está
pagando— y el plan operativo del corte queda apoyado en un efecto que no va a pasar. No es `CRITICA`
porque nadie paga de más y el dato no se pierde; lo que falla es el sentido de la llamada.

**¿Es nuevo, o es el arreglo?** **Es el cruce del arreglo 9 con el 22.** El 9 cambió `PB2`/`PB3` de
*«listas de transiciones»* a *«el CAMBIO de `cubierto`»*, y con eso **volvió falsa la premisa del
22**, que se escribió apoyándose en que `PB2` dispara al arrancar el sistema en `PRE_TRIAL`. Los dos
se aplicaron en la misma tanda de seis commits y ninguno nombra al otro.

---

### F-8cB3-010 — El paso 2 del corte es un gate sin lado de salida: con dos preapprovals ya cancelados y el tercero no, el corte «no avanza» y `PA-5` mide que tampoco se puede volver

**Qué se rompe.** El gate está bien elegido y no tiene qué hacer cuando falla. Si el tercero no se
puede cancelar, dos clientes reales ya quedaron sin su autorización, el corte no avanza, el sistema
viejo sigue corriendo creyendo que están vivos, y **cancelar es irreversible**. No hay estado
declarado para eso ni quién decide.

**El camino.**

1. *«| 1 | **cancelar los tres preapprovals en el proveedor** | el sistema **viejo** …»* y *«| 2 |
   **verificar releyendo cada uno por su id** y confirmar que quedó `cancelled` …»*
   (`16-fase-7-del-paraguas.md` §4.2).
2. *«**El paso 2 es el gate** … si alguno de los tres **no se pudo cancelar**, el corte **no
   avanza**.»* — mismo §.
3. El paso 1 es por definición secuencial sobre tres sujetos, así que el estado *«dos cancelados,
   uno no»* es alcanzable en cuanto uno de los tres falle.
4. `PA-5`, `VERIFIED`: *«`PUT {status:"cancelled"}`. **Irreversible**: reintentar da `400`; sobre una
   autorizada, `400 "Invalid transition from cancelled to authorized"»*
   ([`06-mp-validation-matrix.md`](../06-mp-validation-matrix.md)). No hay des-cancelar.
5. Los tres sujetos son las tres `trialing`, *«clientes reales, **y contactables**»* (`V/21` §2.2),
   con primer cobro el **2026-09-26**, el **2026-11-25** y el **2026-11-30** (`B/21` §3.1).
6. El documento declara explícitamente que no resuelve la vuelta: *«**Qué pasa si el corte hay que
   revertirlo después del paso 3.** Eso es el rollback del programa, es el §3, y sigue sin
   escribirse»* (§4.3) — pero lo de acá es **antes** del paso 3, o sea dentro de lo que el §4
   sí declara resuelto.

**Dónde lo permite el diseño.** `16-fase-7-del-paraguas.md` §4.2 y §4.3, contra `PA-5`.

**Severidad.** `ALTA`. Dos personas pierden su suscripción sin haberlo pedido y el programa se queda
en un estado que ningún documento nombra. No es `CRITICA` porque son dos personas conocidas a las
que se puede llamar —que es la premisa de todo el capítulo— y porque nadie paga de más.

**¿Es nuevo, o es el arreglo?** **Es el arreglo 23** (*«el orden del corte: cancelar → verificar
releyendo → desplegar → escribir. El paso 2 es el gate»*). El arreglo recorrió el dominio del
problema —el cobro que cae en el vacío— y no el que crea: **un gate tiene dos salidas y sólo se
escribió una**.

---

### F-8cB3-011 — El reembolso del arreglo 15 es automático, y todo el diseño tiene escrito que lo que toca plata lo confirma una persona

**Qué se rompe.** El arreglo 15 mete un movimiento de dinero automático en un diseño cuya regla
declarada, aplicada *«por tercera vez»*, es la contraria. Y lo apoya en la única capacidad que el
propio diseño declara con riesgo de plataforma, sobre una tabla que no guarda lo que hace falta para
que el reintento no reembolse dos veces.

**El camino.**

1. `B/12` §5.3: *«El pago entra, se registra, y **se reembolsa**»*. No hay actor, no hay
   confirmación, no hay marca: la frase describe un efecto del sistema.
2. La regla contraria está escrita tres veces: *«**Toda divergencia de monto, estado o cobro pone la
   marca `requiere_conciliación` y la mira una persona.** Es el criterio del owner aplicado por
   tercera vez: **la línea no es «automático contra manual», es «toca plata o no toca plata»**»*
   (`B/09` §2.4); *«el reembolso lo confirma una persona (`DEC-RF-001`, `DEC-CONC-001`)»* (`B/05`
   §C2); *«**cero decisiones destructivas automáticas**»* (`S14`, `B/03` §3.2).
3. `B/05` §C2 resuelve el caso gemelo —un cobro posterior a una cancelación— **poniendo la marca**,
   no reembolsando solo. Los dos casos son el mismo hecho: un cobro que no debía entrar.
4. La capacidad sobre la que se apoya es la declarada frágil: *«**la única capacidad del diseño que
   vive en una API anunciada como discontinuada es la 6, reembolsar**»* (`B/06` §10), y el propio
   `B/12` §5.3 lo reconoce: *«el reembolso es **la única capacidad que el cap. 06 §10 declara en
   riesgo de plataforma**»*.
5. Y para que un reembolso automático sea seguro hace falta guardar el id del reembolso en el
   proveedor, porque `RF-6` mide que *«la repetición devuelve **`200`, no `201`** … y **no devuelve
   el refund original** en el cuerpo, así que hay que tenerlo guardado»*
   ([`06-mp-validation-matrix.md`](../06-mp-validation-matrix.md)). **`B/02` §2.3 sigue sin esa
   columna**: *«`refund` | pago, monto, motivo, estado, quién lo confirmó»*. Es `F-8B3-011`, de la
   FASE 8 — lo traigo con su ID viejo porque **ahora llega por un paso nuevo**: antes era un
   reembolso que confirmaba una persona y ahora es uno que ejecuta un job que puede reintentar.

**Dónde lo permite el diseño.** `B/12` §5.3 contra `B/09` §2.4, `B/05` §C2, `B/03` §3.2 (`S14`),
`B/06` §10 y `B/02` §2.3.

**Severidad.** `ALTA`. Un reembolso automático sin id guardado puede salir dos veces —el cliente
cobra de más y nosotros pagamos de menos— y la regla que lo impedía era la de la persona. No lo
subo a `CRITICA` porque `RF-6` mide que el proveedor **sí** respeta la clave de idempotencia en ese
endpoint, así que el segundo reembolso requiere además que la clave se pierda.

**¿Es nuevo, o es el arreglo?** **Es el arreglo 15**. El defecto que cerró era real (`S5` reactivaba
la predecesora); la salida que eligió —reembolsar— **creó un dominio nuevo**, el de las operaciones
automáticas sobre dinero, que el diseño entero tenía vacío a propósito.

---

### F-8cB3-012 — La re-vinculación automática se declara «no cambia plata», y el arreglo 21 escribe la prueba de que sí; el criterio de emparejamiento no está en ningún capítulo

**Qué se rompe.** El único camino automático del sistema para un preapproval desconocido decide **de
quién es un cobro**, y el capítulo que lo autoriza lo justifica diciendo que *«no cambia plata»*. El
capítulo de migración, escrito después, demuestra lo contrario en un párrafo. Y el criterio con el
que se elige el dueño no está escrito en ninguna parte: lo único que hay es *«el candidato más
plausible»*.

**El camino.**

1. `B/09` §2.4: *«**Sólo se repara el vínculo automáticamente.** Re-vincular una huérfana
   reescribiendo su `external_reference` **no cambia plata ni estado**: sólo dice de quién es.»*
2. `B/21` §2.5 dice qué pasa cuando *«sólo dice de quién es»* se equivoca: *«El candidato más
   plausible del emparejamiento es **la suscripción nueva de esa misma persona** … **El cobro viejo
   se imputa como pago del ciclo nuevo: pagó dos veces y el sistema registra una.**»*
3. O sea: *«de quién es»* **es** una imputación de plata. Las dos frases están en capítulos que se
   citan mutuamente y ninguna corrige a la otra.
4. El criterio no está escrito. `EX-19` mide **que se puede** reescribir `external_reference` sobre
   una autorizada, con su salvedad: *«el `search` **ignora** `external_reference`, así que la
   referencia sirve para **reconocer** una suscripción que ya se tiene, no para **encontrarla**»*
   ([`06-mp-validation-matrix.md`](../06-mp-validation-matrix.md)). Nada dice cómo se elige el
   candidato, ni qué pasa si hay más de uno, ni si el `payer_email` entra en la cuenta — y `EX-19`
   mide además que *«`payer_email` **NO** [se puede reescribir]: … el `GET` lo devuelve **vacío**,
   nunca el mail real»*, que es el único dato con el que uno emparejaría a mano.
5. La lápida acota el problema para **tres** ids conocidos y no para ninguno más: toda huérfana
   futura entra por el mismo camino automático sin criterio.

**Dónde lo permite el diseño.** `B/09` §2.4 contra `B/21` §2.5 y `EX-19`.

**Severidad.** `ALTA`. Un cobro imputado a la suscripción equivocada es plata mal asentada, y el
mecanismo es automático y sin criterio escrito. No lo pongo en `CRITICA` porque el caso concreto y
fechado —los tres del corte— ya tiene su cobertura declarada en `F-8cB3-003`, y acá lo que falta es
la regla general.

**¿Es nuevo, o es el arreglo?** **Preexistente en `B/09` §2.4; lo que el arreglo 21 introduce es la
prueba escrita de que la justificación de ese § es falsa**, y no volvió a corregirlo. El arreglo
recorrió su propio caso —los tres ids del corte— y no el dominio que su argumento abre: **todas las
huérfanas**.

---

### F-8cB3-013 — La lápida no dice con qué versión de plan ni con qué billing option nace, y ninguna superficie la puede escribir

**Qué se rompe.** El paso 4 del corte es *«a mano»* y es la única escritura del corte. La fila que
hay que escribir es una `subscription`, y una `subscription` tiene columnas obligatorias que el
mundo viejo no tiene con qué llenar. Nadie puede ejecutar el paso 4 tal como está escrito.

**El camino.**

1. `B/02` §2.2: *«**`subscription`** | `user`, vertical, **versión de plan anclada**, **billing
   option**, estado, período actual, fecha de fin de servicio, clase (principal o de complemento),
   **`sucede_a`** …»*.
2. `B/21` §2.5 dice qué se conserva y nombra dos cosas: *«El compromiso viejo se conserva como una
   `subscription` en `CANCELLED` **con su `provider_link`**»*. No dice la versión de plan, ni la
   billing option, ni el período, ni la fecha de fin de servicio.
3. El catálogo viejo no tiene contraparte declarada en el nuevo: *«**El sistema nuevo no hereda una
   sola fila**»* (`B/21` §2.4) alcanza también a los planes, y las tres `trialing` son de
   alojamiento bajo el catálogo actual.
4. El contrato prohíbe la salida fácil: *«**Una fuente sin referencia resoluble no se puede
   expresar**»* (`12-contrato…` §2.3). Una lápida en `CANCELLED` **no emite fuente** (`12-contrato…`
   §2.6, fila `CANCELLED`), así que la referencia nunca se resuelve — pero la columna igual hay que
   llenarla al insertar, y nada dice con qué.
5. Y no hay dónde hacerlo: `B/19` §6 enumera lo que el panel muestra y las acciones son *«las doce
   del capítulo 08 §3 (núcleo)»*. Crear una suscripción `CANCELLED` con un `provider_link` a un
   preapproval que el sistema nuevo nunca creó no está entre lo que ninguna superficie hace.

**Dónde lo permite el diseño.** `B/02` §2.2, `B/21` §2.5, `16-fase-7-del-paraguas.md` §4.2 (paso 4),
`B/19` §6.

**Severidad.** `MEDIA`. Se descubre al ejecutar el corte, con la gente al teléfono y el despliegue
hecho. No es `ALTA` porque son tres filas y alguien con acceso a la base las escribe igual; lo que
falta es que esté decidido antes de ese día.

**¿Es nuevo, o es el arreglo?** **Es el arreglo 21** (la lápida) **más el 23** (que la manda escribir
a mano en el paso 4). El 21 describió qué conserva la fila y no qué la fila exige; el 23 la puso en
un paso ejecutable sin verificar que se pudiera ejecutar.

---

### F-8cB3-014 — «El barrido del cap. 09 encuentra el id» y el cap. 09 no barre los estados terminales: el mecanismo que justifica la lápida no la mira

**Qué se rompe.** La lápida se justifica por un mecanismo que, en el capítulo que lo define, está
declarado como que no la toca. Quien implemente la resolución de *«cancelado durante el corte»*
dentro del barrido no va a encontrar nada.

**El camino.**

1. `B/21` §2.5: *«Con la lápida, **el barrido del cap. 09 encuentra el id** y resuelve «cancelado
   durante el corte» en vez de «huérfana»»*.
2. `B/09` §3 define sobre qué corre el barrido: *«Por cada suscripción de nuestro inventario **que
   no esté en un estado terminal**»*, y remata: *«**Los estados terminales no se barren**:
   `CANCELLED`, `ABANDONED` y `CHARGE_DECLINED` no pueden divergir hacia nada que nos importe, y
   barrerlos es gastar llamadas sobre la parte de la cartera que más crece»*.
3. La lápida está, por definición, *«en `CANCELLED`»* (`B/21` §2.5). El barrido no la lee nunca.
4. El mecanismo que **sí** funciona es otro y está en otro § —la detección por webhook de `B/09`
   §2.2 más la unicidad de `provider_link` (`B/02` §2.2)—, pero ninguno de los dos capítulos lo
   nombra para este caso.

**Dónde lo permite el diseño.** `B/21` §2.5 contra `B/09` §3.

**Severidad.** `MEDIA`. El mecanismo correcto existe y es alcanzable; lo que está mal es la frase
que dice cuál es, y el costo es que alguien construya la resolución en el lugar equivocado.

**¿Es nuevo, o es el arreglo?** **Es el arreglo 21.** La regla venía de `R5-G` y se re-pegó tal cual,
en un capítulo cuyo §3 declara la exclusión de los terminales. El arreglo no recorrió el dominio que
crea —**una fila en un estado que el barrido excluye**— porque el problema original no tenía filas.

---

### F-8cB3-015 — El párrafo del quinto acto dice «el aviso va ANTES del paso 1» y dos oraciones después «las dos van después de desplegar», con un «las dos» que no tiene antecedente

**Qué se rompe.** El único párrafo que ordena el aviso a los clientes respecto del corte se
contradice en tres oraciones. Quien lo ejecute leyendo la última frase llama a la gente **después**
de desplegar, o sea con las fichas ya abajo — y el propio párrafo dice que el aviso previo *«es lo
único que acota cuánto tiempo queda abajo cada ficha»*.

**El camino.**

1. `16-fase-7-del-paraguas.md` §4.2, párrafo completo: *«**Y hay un quinto acto que no es del
   sistema: las llamadas.** Las fichas publicadas de Alojamiento **se despublican la mañana del
   corte** … y vuelven solas cuando cada dueño contrata. **El aviso va ANTES del paso 1**, no
   después: es lo único que acota cuánto tiempo queda abajo cada ficha. **Las dos escriben filas del
   esquema nuevo, así que las dos van después de desplegar** — y por eso el paso 3 no es el final
   del corte, aunque lo parezca.»*
2. *«Las dos»* no tiene antecedente en el párrafo: el párrafo nombra **un** acto (las llamadas) y
   **una** consecuencia (la despublicación), y ninguna de las dos *«escribe filas del esquema
   nuevo»* — una llamada no escribe nada, y la despublicación la escribiría `PB2` sobre una ficha
   que ya existe.
3. El antecedente plausible es la siembra que el **arreglo 22 eliminó**: *«**Y eso es lo que se
   hace: se despublican. No se siembra nada**»* (`V/21` §2.4). Con la siembra viva había dos
   escrituras del esquema nuevo —las lápidas y la siembra— y la frase cerraba.

**Dónde lo permite el diseño.** `16-fase-7-del-paraguas.md` §4.2 contra `V/21` §2.4.

**Severidad.** `MEDIA`. Es el orden del aviso en el único momento irreversible del programa, y la
frase equivocada es la última del párrafo, que es la que se recuerda. No es `ALTA` porque las dos
oraciones anteriores dicen lo correcto con énfasis.

**¿Es nuevo, o es el arreglo?** **Es el arreglo 22 volviendo falsa la premisa del 23**, en la misma
tanda: el 22 borró la siembra y el 23 escribió el párrafo con un *«las dos»* que la contaba. La
pregunta obligatoria —*«¿qué premisa de OTRO arreglo estoy volviendo falsa?»*— habría bastado.

---

### F-8cB3-016 — El corte cancela tres preapprovals y no dice nada de las otras cinco relaciones, con `EX-1` en `UNKNOWN`

**Qué se rompe.** El paso 1 del corte enumera tres sujetos. Las ocho relaciones son ocho, y para
tres de ellas —las `abandoned`— la afirmación de que no hay nada vivo descansa en algo que el propio
diseño declara no medido: si un `pending` vence solo. Si alguno de esos tres preapprovals sigue
`pending` y alguien lo autoriza después del corte, entra un cobro de un id que nadie canceló y para
el que nadie escribió lápida.

**El camino.**

1. `16-fase-7-del-paraguas.md` §4.2, paso 1: *«cancelar **los tres** preapprovals en el
   proveedor»*, y §4.1: *«Son **tres** las que pueden hacerlo —las únicas con preapproval vivo—»*.
2. `V/21` §2.2: *«Las tres `trialing` son las **únicas** con preapproval vivo (medido: 3 de 3, y
   ninguna de las otras cinco)»*, y *«**3 `abandoned`** | no tienen **nada vivo** que migrar:
   abandonaron el checkout»*.
3. Qué significa *«nada vivo»* para un `abandoned` no está medido en la dirección que importa:
   `EX-1` sigue `UNKNOWN` — *«**¿un `pending` vence solo?** … **`EX-1` sigue `UNKNOWN`.** Hay un
   sujeto vivo desde el 2026-09-15 esperando respuesta»* (`B/06` §6). Y `B/06` §6 saca de ahí la
   regla del sistema nuevo: *«nuestro job de limpieza **cancela explícitamente** el preapproval al
   vencer la ventana. … si no lo vence, es lo único que impide una autorización viva que puede
   cobrar»*.
4. El sistema **viejo** no tiene ese job declarado en ningún lado de este diseño, así que sus tres
   `abandoned` son exactamente el caso contra el que el nuevo se defiende.
5. Y la única atenuación medida no es del diseño: el enlace que se les mandó viene roto (`EX-37`,
   `B/06` §4.2), así que reautorizarlo es improbable — improbable, no imposible, y el paso 1 cuesta
   tres llamadas más a la API.

**Dónde lo permite el diseño.** `16-fase-7-del-paraguas.md` §4.2 y §4.1, `V/21` §2.2, `B/06` §6.

**Severidad.** `MEDIA`. El daño posible es el del §2.5 —un cobro sin asiento— pero apoyado en un
`UNKNOWN` declarado y sobre tres personas que abandonaron el checkout.

**¿Es nuevo, o es el arreglo?** **Es el arreglo 23**, que fijó el alcance del paso 1 en *«los tres»*.
El dominio del arreglo es *«los preapprovals que pueden cobrar después del corte»*, y se lo igualó
al de *«los que están vivos hoy»*, que no es el mismo conjunto mientras `EX-1` siga `UNKNOWN`.

---

### F-8cB3-017 — El arreglo 13 no nombra qué campo del proveedor se lee, y los dos candidatos están medidos con comportamientos distintos

**Qué se rompe.** *«La fecha que el proveedor confirmó»* no es un campo: son dos, y el diseño midió
que se comportan distinto. Elegir el equivocado deja al guard comparando contra un valor que el
propio programa declaró inservible para saber si va a cobrar.

**El camino.**

1. `B/02` §2.2: *«**La fecha de primer cobro que se guarda es LA QUE EL PROVEEDOR CONFIRMÓ** … La
   fecha se escribe en esa misma relectura»*. No nombra el campo.
2. Los dos candidatos están medidos y no son intercambiables:
   - `auto_recurring.start_date` — `EX-39`: sobre un preapproval `pending`, *«`auto_recurring.start_date`
     suelto | `200`, **`last_modified` congelado**, la fecha sin moverse»* (`B/12` §5.4);
   - `next_payment_date` — `GT-1`, producción: *«su `next_payment_date` quedó congelado en la fecha
     vieja mientras las activas se corrían +24 h. Sigue valiendo que **`next_payment_date` no se
     limpia**, así que ese campo **no sirve para saber si va a cobrar**»*
     ([`06-mp-validation-matrix.md`](../06-mp-validation-matrix.md)).
3. El barrido lee explícitamente el segundo (`B/09` §3, fila *«fecha del próximo cobro |
   `next_payment_date`»*) y el guard lee la columna (`B/20` §2), así que si la columna se llena con
   el otro campo los dos comparan cosas distintas sin que nada lo note.

**Dónde lo permite el diseño.** `B/02` §2.2, `B/09` §3, `B/20` §2, contra `EX-39` y `GT-1`.

**Severidad.** `MEDIA`. Es una ambigüedad de implementación sobre el dato que sostiene `D8`; la
recorre cualquiera que lea las dos filas de la matriz, y hoy nada obliga a leerlas.

**¿Es nuevo, o es el arreglo?** **Es el arreglo 13.** La columna es nueva y la frase que la define
nombra un concepto (*«la fecha que el proveedor confirmó»*) donde el proveedor tiene dos campos
medidos.

---

### F-8cB3-018 — `S17` admite «cualquier estado vivo» —seis— y `G-R1-A` admite tres: el dominio de la sucesión tiene dos tamaños en dos capítulos

**Qué se rompe.** El mismo arreglo escribió la transición con un dominio y el guard con otro. Si
manda la transición, `G-R1-A` va a fallar sobre filas legítimas; si manda el guard, `S17` declara un
`desde` que la mitad de las veces no puede existir. Nadie sabe cuál de los dos es la regla.

**El camino.**

1. `B/03` §3.2, `S17`: *«| S17 | la **predecesora**, **en cualquier estado vivo** | webhook de que su
   sucesora quedó autorizada …»*.
2. Los vivos son seis: *«**Los «vivos» siguen siendo los mismos seis**: `PENDING_AUTHORIZATION`,
   `ACTIVE`, `GRACE_PERIOD`, `PAUSED`, `SUSPENDED` y `CANCEL_SCHEDULED`»* (`B/02` §2.2).
3. `B/20` §2, `G-R1-A`, falla si la predecesora está *«**fuera de**
   `{ACTIVE, GRACE_PERIOD, CANCEL_SCHEDULED}`»* — tres.
4. Los tres que sobran tienen razón declarada de estar afuera (*«`G-R1-A` impide declarar una
   sucesión desde una `SUSPENDED` … o desde una `PAUSED`, donde `EX-11` mide que el proveedor
   rechaza toda modificación»*, `B/20` §2), pero `PENDING_AUTHORIZATION` **no está nombrado en esa
   explicación** y sin embargo también queda afuera del guard. `B/03` §3.3.1 lo deja fuera por
   superficie —*«terminá o cancelá el checkout que tenés abierto»*— y declara expresamente que eso
   es *«de **superficie, no de modelo**»*.

**Dónde lo permite el diseño.** `B/03` §3.2 (`S17`) contra `B/20` §2 (`G-R1-A`) y `B/02` §2.2.

**Severidad.** `MEDIA`. No produce daño por sí solo, pero es la definición del dominio sobre el que
se apoya `F-8cB3-001`: mientras tenga dos tamaños, no hay forma de decidir si ese hueco es un caso
legítimo o uno prohibido.

**¿Es nuevo, o es el arreglo?** **Son los arreglos 11 y 12**, que escribieron `S17`, contra el guard
que la misma tanda agregó. Dos escrituras del mismo dominio, en dos capítulos, con dos tamaños.

---

### F-8cB3-019 — `B/05` §C5 sigue afirmando que «la base lo impide» sobre un candado que la FASE 9 declaró imposible de construir, y la remediación acordada no se aplicó

**Qué se rompe.** El único cruce que el diseño declara como *«doble cobro con dinero real»* dice
tener una red en la base. No la tiene y está sabido. La FASE 9 acordó que el capítulo dijera que el
candado **no existe**, y el capítulo sigue diciendo lo contrario.

**El camino.**

1. `B/05` §2, `C5`: *«**Es el único de los seis que produce un doble cobro con dinero real**, y por
   eso es el único que se lleva a la base: **`UNIQUE(subscription_id, período) WHERE el pago está
   acreditado`**. Un período de una suscripción admite **un solo pago acreditado**, y **la base lo
   impide**.»*
2. `B/02` §2.3 no tiene columna de período en `payment`: *«`payment` | suscripción, monto, moneda,
   estado del cap. 03 §6, **id del hecho en el proveedor**, fecha del hecho, monto reembolsado
   acumulado»*. Lo confirmé por búsqueda: la palabra *«período»* aparece en `B/02` sólo como
   *«período actual»* de `subscription` y en prosa.
3. La FASE 9 lo declaró bloqueado y dejó escrita la remediación:
   [`15-fase-9/07-decisiones-del-owner.md`](../15-fase-9/07-decisiones-del-owner.md), *«No decidible
   hoy · `F-8B3-002` y el capítulo 13 — `R1` #9»*: *«**Lo que `R1` sí dejó hecho** … que el candado
   **figure como inexistente** en vez de aparecer en un capítulo como si existiera»*.
4. **No figura como inexistente**: figura como *«la base lo impide»*. La remediación no se aplicó, y
   tampoco está entre las tres omisiones de aplicación que `17-fase-8-bis/00-hallazgos.md` §4 lista.

**Dónde lo permite el diseño.** `B/05` §2 `C5` contra `B/02` §2.3 y `15-fase-9/07-decisiones-del-owner.md`.

**Severidad.** `MEDIA`. **El defecto de fondo está declarado con causa** (bloqueado en el capítulo
13, sostenido por `D11`), así que no lo reporto de nuevo. Lo que reporto es que el texto sigue
afirmando una red que no hay, que es precisamente lo que la FASE 9 acordó corregir.

**¿Es nuevo, o es el arreglo?** **Ni uno ni otro: es una remediación de la FASE 9 declarada y no
aplicada.** No lo introdujo ninguno de los 23, y no es uno de los 141: es el residuo de `F-8B3-002`,
que llega hoy por el paso 3 de su camino original.

---

### F-8cB3-020 — `B/02` §4 cierra `M-DATA-01` con una tabla de una sola fila: qué se borra y qué se anonimiza no está escrito en ningún lado

**Qué se rompe.** El capítulo declara cerrar el hueco de retención y sólo contesta un tercio de su
propio título. Nada dice qué pasa con los datos de una persona que pide su baja y su borrado: ni qué
se elimina, ni qué se anonimiza, ni con qué plazo.

**El camino.**

1. `B/02` declara el cierre en el frontmatter: *«cierra: … `M-DATA-01`»*.
2. El § se titula *«**4. Retención: qué se borra, qué se anonimiza, qué se conserva** · cierra
   `M-DATA-01`»* y su tabla tiene **una fila**, contada: *«Se conserva íntegro, siempre | pagos,
   reembolsos, comprobantes, el vínculo con el proveedor | los cuatro primeros son obligación legal
   y contable»*. Las dos primeras preguntas del título no tienen fila.
3. Busqué las otras dos mitades en el resto de la épica: `B/22` (lo legal), `B/16`, `B/14` y `B/10`
   no las contestan; lo único cercano es el reloj de archivado de fichas del §25 en `B/10` §4, que
   es de verticales y de otra entidad.

**Dónde lo permite el diseño.** `B/02` §4.

**Severidad.** `MEDIA`. Roza *«un dato se pierde sin vuelta»* por el lado contrario —nada declara
que se pierda— pero es un hueco de política, no un camino a un daño concreto, así que no lo subo.

**¿Es nuevo, o es el arreglo?** **Preexistente, y no estaba en ningún informe anterior**: verifiqué
por búsqueda que `M-DATA-01` sólo aparece en `F-8A3-015` (frontmatters duplicados), que es otro
defecto sobre el mismo identificador. Ningún arreglo de la 9-bis tocó este §.

---

### F-8cB3-021 — La despublicación del corte se planifica sobre un número que nadie contó y que se mide el día del corte, después del aviso que lo necesita

**Qué se rompe.** El plan del corte dice avisar **antes** del paso 1 a los dueños de las fichas
publicadas. Cuántas están publicadas no se contó y se va a contar el día del corte — o sea después
del momento en que hace falta para hacer las llamadas.

**El camino.**

1. `16-fase-7-del-paraguas.md` §4.2: *«**El aviso va ANTES del paso 1**, no después: es lo único que
   acota cuánto tiempo queda abajo cada ficha»*.
2. El número está declarado no medido:
   [`03-handoff.md`](../03-handoff.md), *«Tres correcciones de registro»*, punto 2: *«**«Las doce
   fichas del catálogo» era una inferencia, no una medición.** Lo medido son **12 filas de
   alojamiento y 22 usuarios**; **cuántas están publicadas nunca se contó**. Se mide **el día del
   corte**, que es cuando el número importa y el único momento en que no está vencido»*.
3. Los dos son correctos por separado y no componen: el aviso necesita la lista antes, y la lista se
   saca después.

**Dónde lo permite el diseño.** `16-fase-7-del-paraguas.md` §4.2 contra `03-handoff.md`.

**Severidad.** `BAJA`. El owner *«los conoce a todos»* (`V/21` §2.4), así que la lista se arma sin la
consulta. Lo que falta es que el orden lo diga.

**¿Es nuevo, o es el arreglo?** **Es la corrección de registro de la 9-bis** —la tercera de las tres,
*«las doce fichas retiradas por no ser una medición»*— cruzada con el arreglo 23. Retirar el número
fue correcto; lo que quedó sin revisar es el paso que lo usaba.

---

## 2. La pregunta obligatoria: ¿qué premisa de OTRO arreglo estoy volviendo falsa?

La respuesta, recorrida arreglo por arreglo sobre los 23, y **son cinco pares**:

| el arreglo | vuelve falsa la premisa de | cómo | hallazgo |
|---|---|---|---|
| **23** (el orden del corte) | **21** (la lápida) | el 21 supone que la lápida está cuando llega el cobro; el 23 la pone **después del despliegue** y a mano | `F-8cB3-003` |
| **9** (`PB2` por el CAMBIO de `cubierto`) | **22** (se despublica y se la llama) | el 22 supone que `PB2` dispara la mañana del corte; con el 9, no hay cambio que disparar | `F-8cB3-009` |
| **15** (`S5` no aplica sobre una sucesión) | `B/05` §3, editada en la misma tanda por el **17/19** | `B/05` §3 declara que la sucesora `PENDING_AUTHORIZATION` **no bloquea a propósito** | `F-8cB3-002` |
| **19** (el barrido excusa `next_payment_date`) | **13** (la fecha que el proveedor confirmó) | el 13 supone que la relectura verifica la fecha; el 19 declara que esa fecha **no es divergencia** | `F-8cB3-006` |
| **22** (no se siembra nada) | **23** (el párrafo del quinto acto) | el 23 escribió *«las dos escriben filas del esquema nuevo»* contando una siembra que el 22 acababa de borrar | `F-8cB3-015` |

**Y una que no es un par sino una autorreferencia**, que es la forma más difícil de ver: los
arreglos **11 y 12** declaran en su propio texto *«el dominio que esto crea, recorrido … no hay un
tercer estado»*, y el tercer estado existe (`F-8cB3-001`). **Una declaración de dominio recorrido no
es una medición**, y ésta es la primera vez que el ciclo produce una — conviene tratarla como lo que
es: una afirmación a verificar, no un certificado.

---

## 3. Lo que esta pasada dice sobre si `DEC-METH-008` funcionó

**Mi vector, medido**: de 21 hallazgos, **18 los introdujo un arreglo de la 9-bis** y **los 3
`CRITICA` son 3 de 3**. La proporción de críticos atribuidos **no bajó**.

**Pero cambió de forma, y eso sí es información.** Los 25 de la vuelta anterior eran, en su mayoría,
**el dominio del problema recorrido a medias**. Los 3 de ésta son otra cosa:

- dos son **colisiones entre arreglos escritos en tandas distintas** (`F-8cB3-003`, `F-8cB3-002`),
  que es exactamente lo que la pregunta nueva de `DEC-METH-008` fue a buscar — y que **el arreglo
  que las produjo no podía ver solo**;
- uno es un **dominio declarado recorrido y no recorrido** (`F-8cB3-001`), o sea la regla nueva
  aplicada nominalmente.

**Lo que yo mediría antes de la próxima vuelta**: no la proporción de atribuidos, que va a seguir
alta mientras se siga arreglando, sino **cuántos de los críticos son visibles desde el arreglo que
los produjo**. Dos de mis tres no lo son: requieren leer dos capítulos que ningún arreglo tocó
juntos. Eso no lo arregla una regla de método; lo arregla que alguien lea la costura, que es el
encargo de `C1`.

---

## 4. Lo que cae en el hueco del capítulo 13, y que esta tanda movió

Lo anoto porque el §4 de las instrucciones lo permite y porque **esta tanda le agregó carga**:

1. **El reembolso automático del arreglo 15** (`F-8cB3-011`) necesita la mecánica del reembolso, que
   es del 13, y el 13 la arrastra con `RF-3` en `UNKNOWN` (`B/05` §4). El capítulo va a nacer con una
   operación automática encima.
2. **`F-8B3-002`** —el candado del período— sigue bloqueado en el 13 (`F-8cB3-019`), y ahora el 13
   también tiene que definir el período para el reembolso del punto 1: sobre qué período se reembolsa
   un cobro que el arreglo 15 declara perdonado.
3. **La columna del id de reembolso en el proveedor** (`F-8B3-011`, FASE 8) deja de ser una prolijidad
   y pasa a ser la precondición de que el punto 1 sea seguro.

---

## 5. Ataques que intenté y el diseño resistió

**1. Romper el candado partido por los dos lados a la vez, con una sucesora de una sucesora.**
Intenté encadenar: A sucedida por B, B sucedida por C mientras B vive. La base lo rechaza sin
ninguna regla extra, y la razón está bien escrita: *«al indexar `B` sobre `(user_id, vertical)` —y no
sobre `sucede_a`— una sucesora no puede ser sucedida mientras viva … porque la segunda sucesora
colisiona con la primera»* (`B/02` §2.2). Y `G-R1-A` lo repite en el momento de escribir. **Dos
defensas independientes, y las dos aciertan.**

**2. Meter una suscripción de complemento en el candado del §11.** Un addon recurrente es una
suscripción con su propio preapproval (`DEC-ADDON-002`), y quise usarla para ocupar o liberar el
candado. No entra: los dos índices llevan `WHERE clase = principal` (`B/02` §2.2), y el owner lo
confirmó explícitamente al decidir el arreglo 11. **La clase está en la clave, no en un chequeo.**

**3. Perder el id del proveedor y volver invisible una suscripción para el barrido.** Es el camino
que `B/09` §2.1 nombra —*«Una suscripción cuyo id se pierde es invisible para el barrido»*— y quise
alcanzarlo. No se llega: `provider_link` lleva `UNIQUE(proveedor, id_del_proveedor)` y la columna del
id no es anulable por construcción de la tabla (`B/02` §2.2), y la huérfana que igual aparezca la
detecta el webhook (`B/09` §2.2). **El agujero está nombrado y cerrado en la misma página.**

**4. Concluir «no cobró» desde el endpoint de cobros durante la conciliación.** Es la trampa mejor
documentada del carril y el §4 de `B/09` la cierra con la medición de las 21:33: se concluye desde el
contador del preapproval y se usa el endpoint para el detalle. **Probé los tres modos de «cero
cobros» y los tres se distinguen con lo que el § declara.**

**5. Hacer que el barrido liste desde el proveedor.** Es el fallo más caro de `RC-1` —15 de 69 en
producción— y ningún capítulo deja una puerta: `B/09` §2.1 lo prohíbe, `B/02` §2.2 lo apoya en la
tabla, `B/03` §10.1 lo repite para la relectura y `B/05` §1.2 acota la única excepción (por correo
del pagador y estado, que sí filtran y se componen). **Cuatro capítulos, la misma regla, sin
variantes.**

**6. Usar la marca `requiere_conciliación` para sacar una fila del candado.** Era el defecto viejo y
el arreglo 17 lo dio vuelta del todo: la fila conserva su estado, **ocupa** el candado, y `B/05` §3
lo aprovecha sin tocar su condición 3 (*«Con la marca de `B/02` §2.2 ese agujero desaparece **sin
tocar la condición**»*). **Es la única dirección en que este modelado aprieta, y aprieta bien.**

**7. Cobrar dos veces el mismo hecho con las tres notificaciones de un reembolso.** `RF-7` mide tres
notificaciones en dos formatos, y `UNIQUE(proveedor, id_del_hecho)` más la regla *«se deduplica por
el id del hecho, no por el tipo de evento»* (`B/03` §10.2, `B/05` §C6) lo cubren sin lock. **La
medición y la restricción están pegadas.**

**8. Escribir una lápida sobre un preapproval que sigue vivo.** El orden lo impide y la razón está
escrita: *«Al revés quedaría una lápida sobre un preapproval que sigue vivo, que es peor que no
tenerla — afirmaría que está cerrado algo que cobra»* (`B/21` §2.5), reforzado por el paso 2 como
gate. **El ataque que el arreglo 21 sí previó, lo previó bien** — el que falló es *cuándo* se
escribe, no *en qué orden* respecto del proveedor.

**9. Que la lápida compita por el candado del §11 y bloquee la resuscripción del cliente.** No
compite: `CANCELLED` no está entre los vivos y el § lo dice explícitamente. **Verificado contra la
lista de seis de `B/02` §2.2.**

**10. Hacer que el corte pierda plata por el lado que el §4.2 declara incómodo** —la ventana entre el
paso 1 y el paso 3—. Ahí el argumento es correcto y completo: el sistema viejo sigue corriendo y
*«sigue existiendo el lugar donde anotarlo»*. **El agujero está en la ventana siguiente, que el §
no nombra (`F-8cB3-003`), no en la que sí nombra.**

**11. Repetir un trial con las seis personas que pierden su «trial ya consumido» al no migrar.**
Está declarado y cuantificado: *«**El «trial ya consumido» de seis personas** —las tres `abandoned`
y las tres `trialing`—, que sin migrarlo **podrían repetir trial**. Son seis personas conocidas»*
(`V/21` §2.3). **Un costo declarado con su número no es un hallazgo.**

**12. Que el arreglo 18 se equivoque en el lado del proveedor.** Era el ataque que las instrucciones
pedían —*«¿son ocho de verdad, o el proveedor devuelve más estados?»*— y **la respuesta es que el
proveedor devuelve cuatro, medido**: `RC-1`, *«los 4 estados suman exactamente 153»*. El arreglo
acertó ahí. El defecto está del **otro** lado del producto cartesiano (`F-8cB3-004`), que es
justamente lo que `DEC-METH-008` manda mirar.

---
title: "FASE 8-bis-2 · B1 — doble cobro y pérdida de pago"
linear: HOS-1352
statusSource: linear
created: 2026-09-20
updated: 2026-09-20
status: CURRENT
fase: 8
---

# FASE 8-bis-2 · B1 — doble cobro y pérdida de pago

Tercera pasada adversarial sobre la épica de billing (`HOS-1354`), el núcleo y el contrato de
cobertura, con el mismo vector: **los caminos por los que a alguien se le cobra dos veces, se le
cobra lo que no corresponde, se le cobra después de irse, o paga y no recibe lo que pagó.**

**Doce hallazgos —diez nuevos y dos de la 8-bis que siguen llegando—. Cinco `CRITICA`, y los
cinco los introdujo un arreglo de la 9-bis.** La
proporción de la vuelta anterior se repite, y el §1 de las instrucciones dice qué significa eso.
Pero **el modo en que se repite cambió**, y ése es el dato que la pasada tenía que producir:

> La 8-bis encontró arreglos que **no habían recorrido su propio dominio**. Ésta encuentra arreglos
> que **sí lo recorrieron y volvieron falsa la premisa de otro**. Los cinco `CRITICA` de acá son
> todos del segundo tipo.

El caso más limpio es `S17`. Su propio texto declara el dominio recorrido —*«la sucesora puede tener
`sucede_a` no nulo … o nulo … **No hay un tercer estado**»* (`B/03` §3.2)— y el recorrido es
correcto **sobre la sucesora**. El eje que el arreglo creó y nadie recorrió es **el otro**: los
**nueve estados de la PREDECESORA** mientras la sucesora espera autorización. `S17` sólo dispara
sobre *«cualquier estado vivo»*, y **tres transiciones declaradas de la misma tabla** (`S12`, `S13`,
`S16`) llevan a la predecesora a un estado **no vivo** dentro de la ventana de 72 h. Ahí `S17` deja
de ser alcanzable para siempre, y el tercer estado que el texto niega es exactamente ese:
`sucede_a` no nulo apuntando a una fila que ya no puede ser cancelada por nadie.

Y un segundo patrón, más barato de ver y con el mismo origen: **tres arreglos se apoyan en el
barrido del capítulo 09 y el capítulo 09 no fue tocado por ninguno de los seis commits.** La lápida
(21), el aviso de la marca (19) y el detector del addon huérfano quedan colgados de un barrido que
por su primera línea no los mira.

Regla de lectura: cada hallazgo se apoya en cita textual con archivo y §. Los conteos que uso los
conté yo sobre el texto vigente del worktree y digo cómo.

---

## CRITICA

### F-8cB1-001 — La predecesora que muere en un estado NO vivo deja `sucede_a` colgado para siempre: `S17` ya no puede correr, el candado `A` queda vacío y el alta siguiente son dos autorizaciones cobrando

**Qué se rompe.** Exactamente el doble cobro que el arreglo 11·12 vino a cerrar, sobre un cliente
que hizo un cambio de plan mientras su suscripción vieja se moría por cualquiera de tres caminos
declarados. Terminada la sucesión su fila sucesora queda con `sucede_a` **no nulo** de forma
permanente: ocupa el candado `B`, deja el candado `A` **vacío**, y el próximo alta de esa persona en
esa vertical entra sin que nada la rechace — dos preapprovals vivos cobrando.

**El camino.**

1. `S17` es la **única** transición que limpia `sucede_a`, y su estado de origen está acotado:
   *«`S17` | la **predecesora**, en cualquier estado vivo | webhook de que **su sucesora** quedó
   autorizada … | `CANCELLED` | … y en el mismo acto **la sucesora limpia su `sucede_a`**»*
   (`B/03` §3.2).
2. Los vivos son seis y están enumerados: *«Los «vivos» siguen siendo los mismos seis:
   `PENDING_AUTHORIZATION`, `ACTIVE`, `GRACE_PERIOD`, `PAUSED`, `SUSPENDED` y `CANCEL_SCHEDULED`.
   Quedan afuera `ABANDONED`, `CANCELLED` y `CHARGE_DECLINED`»* (`B/02` §2.2).
3. Los estados desde los que **se puede** declarar una sucesión son tres: `G-R1-A` prohíbe apuntar a
   una predecesora *«fuera de `{ACTIVE, GRACE_PERIOD, CANCEL_SCHEDULED}`»* (`B/20` §2), y `B/03`
   §3.3.1 saca además `PENDING_AUTHORIZATION` y `PAUSED` por superficie.
4. **Desde esos tres estados, tres transiciones declaradas de la misma tabla llevan a la predecesora
   a un estado no vivo dentro de la ventana de 72 h**, y las conté sobre la tabla del §3.2:

   | # | desde | transición | hacia | el caso concreto |
   |---|---|---|---|---|
   | 1 | `CANCEL_SCHEDULED` | `S12` — *«llega la fecha de fin de servicio»* | `CANCELLED` | el **arrepentimiento** de `B/03` §3.3: *«arrepentirse no es una transición: es una sucesión»*. Quien cancela cerca del fin de período y se arrepiente tiene 72 h de ventana y menos días de servicio que eso |
   | 2 | `ACTIVE`·`GRACE_PERIOD`·`PAUSED`·`SUSPENDED` | `S13` — *«`SUPER_ADMIN` otorga *Free Forever*»* | `CANCELLED` | ver `F-8cB1-002` |
   | 3 | `ACTIVE` | `S16` — *«el **primer** cobro se rechaza»* | `CHARGE_DECLINED` | el cobro real llega *«entre 26 y 44 minutos»* después de autorizar (`PA-3`, `B/12` §4.3), y durante esa media hora la fila es `ACTIVE`: un cambio de plan ahí es legal |

5. En los tres, cuando la sucesora queda autorizada **`S17` no puede dispararse**: su estado de
   origen ya no es vivo. El diseño no declara ninguna otra transición que limpie `sucede_a` —lo
   conté con `rg` sobre los trece capítulos de `HOS-1354`, los siete del núcleo y el contrato:
   **16 apariciones en 4 archivos** (`B/02` 5, `B/03` 5, `B/20` 2, `nucleo/04` 2), **y la única que
   escribe la columna es `S17`**.
6. La sucesora autoriza, `S2` la lleva a `ACTIVE` con `sucede_a` **no nulo**. El candado `A`
   —*«`UNIQUE (user_id, vertical) WHERE clase = principal AND sucede_a IS NULL AND estado ∈
   {vivos}`»* (`B/02` §2.2)— **no tiene ninguna fila que lo ocupe**.
7. El daño lo describe el propio arreglo: *«el candado `A` **vacío** … todo cliente que alguna vez
   cambió de plan quedaba **permanentemente fuera del §11**: un alta nueva entraba sin que nada la
   rechazara, y `EX-6` mide que el proveedor no frena la segunda»* (`B/03` §3.2). Y el candado `B`
   queda consumido: esa persona **no puede volver a cambiar de plan nunca**.

**Dónde lo permite el diseño.** `HOS-1354/docs/03-maquinas-de-estado.md` §3.2 (`S12`, `S13`, `S16`,
`S17`, y la afirmación *«No hay un tercer estado, y el paso entre los dos es atómico con `S17`»*);
`HOS-1354/docs/02-modelo-de-datos.md` §2.2 (los dos candados y la lista de vivos);
`HOS-1354/docs/20-testing.md` §2 (`G-R1-A`); `nucleo/04-invariantes.md` `D15` —*«a lo sumo una
sucesora viva por `user + vertical`»*, apoyado en *«**base**: los dos índices parciales, partidos por
`sucede_a`»*—, que es el invariante que deja de sostenerse.

**Severidad.** `CRITICA`. Es el doble cobro literal, y sobre la misma población que el arreglo
declaró protegida. La diferencia con `F-8bB1-001` de la vuelta anterior es que antes fallaba **toda**
sucesión y ahora falla el subconjunto en que la predecesora muere durante la ventana — más chico,
igual de irreversible, y **sin ningún detector**: no hay guard que mire `sucede_a` contra una fila
muerta, y el barrido del capítulo 09 no mira los terminales (`B/09` §3).

**¿Es nuevo, o es el arreglo?** **Es el arreglo: 11·12** (`B/03` §3.2, commit `7ba3b148d`). El
arreglo recorrió el dominio de la **sucesora** —*«nulo / no nulo, sin tercer estado»*— y no el de la
**predecesora**, que es el que `S17` usa como condición de disparo. **La premisa que vuelve falsa es
la suya propia**: *«los dos se cierran con el mismo acto»* sólo vale si el acto puede ocurrir.

---

### F-8cB1-002 — `S13` cancela la obligación que ve y deja viva la que no: el beneficiario de *Free Forever* queda pagando una suscripción que el grant le regaló

**Qué se rompe.** A alguien a quien `SUPER_ADMIN` le acaba de conceder *Free Forever* se le cobra
todos los meses. El §35.3 ordena *«cancelar toda obligación de pago cubierta»* y `S13` la ejecuta
sobre **una fila**; la sucesora en `PENDING_AUTHORIZATION` es una obligación de pago que nadie mira,
y sobrevive al grant.

**El camino.**

1. El cliente pide un cambio de plan estando `ACTIVE`. Nace la sucesora: `S1`, *«la fila declara una
   sucesión (`sucede_a`)»*, `PENDING_AUTHORIZATION`, con 72 h de ventana (`B/03` §3.4 punto 1).
2. Durante esa ventana, `SUPER_ADMIN` otorga *Free Forever*. `S13`: *«`ACTIVE`, `GRACE_PERIOD`,
   `PAUSED`, `SUSPENDED` | `SUPER_ADMIN` otorga *Free Forever* | `CANCELLED` | … §35.3: se cancela
   toda obligación de pago, **sin reembolso** (`DEC-GRANT-001`); el acceso pasa a darlo el grant»*
   (`B/03` §3.2). **Su estado de origen no incluye `PENDING_AUTHORIZATION`**, así que la sucesora no
   entra por esa transición, y ninguna otra la alcanza.
3. La predecesora queda `CANCELLED`. `S17` ya no puede correr (`F-8cB1-001` paso 5), así que tampoco
   hay nada que cancele la sucesora *«en el proveedor»* por esa vía.
4. El cliente termina el checkout que tenía abierto —no tiene por qué saber que el grant llegó— y
   `S2` lleva la sucesora a `ACTIVE`. **Su preapproval está autorizado y cobra**, con la fecha que
   `B/12` §5.2 le puso: *«posterior al vencimiento de su ventana de autorización»*, o sea días
   después del grant.
5. El barrido no lo ve como divergencia: la fila está `ACTIVE` y el proveedor dice `authorized`, que
   es coincidencia. Y `B/14` §4.3 declara que *«sobre un grant no se otorga cortesía … porque **no
   queda nada que no cobrar**»* — una afirmación que en este camino es falsa y que nadie comprueba.

**Dónde lo permite el diseño.** `HOS-1354/docs/03-maquinas-de-estado.md` §3.2, `S13` y `S17`;
`HOS-1354/docs/14-promos-cortesias-y-grants.md` §4.3; `12-contrato-de-cobertura.md` §2.6, que
declara que *«Una suscripción esperando autorización NO emite fuente de cobertura»* — o sea que la
fila que va a cobrar **es invisible también para el contrato**, no sólo para `S13`.

**Severidad.** `CRITICA`. Alguien paga de más, indefinidamente, por el acto administrativo que el
capítulo 08 declara el más grave del panel, y `DEC-GRANT-001` ya decidió que **no se devuelve lo
pagado**.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: 11·12.** Antes de `S17` la sucesión no terminaba
nunca y el caso existía igual, pero no llegaba como hallazgo porque `F-8bB1-001` lo tapaba entero: la
sucesora quedaba colgada en todos los casos. El arreglo dejó el resto del dominio limpio y **este
par —`S13` × `PENDING_AUTHORIZATION`— quedó como el único hueco, sin que nada lo señale.** Es el
cruce de *«`sucede_a` nulo / no nulo × los nueve estados × las operaciones»* que `DEC-METH-008`
manda recorrer, en la casilla que el recorrido del §3.2 no abrió.

---

### F-8cB1-003 — Los «ocho pares» son ocho FILAS y veinte de treinta y seis pares: `authorized × ACTIVE` y `paused × PAUSED` no figuran, así que el barrido diario marca la cartera sana entera y entierra el único detector de la divergencia de monto

**Qué se rompe.** El primer día que corra el barrido, **toda suscripción sana de la plataforma queda
con la marca `requiere_conciliación`**. Con eso: nadie puede declarar una sucesión (o sea, nadie
puede cambiar de plan ni de ciclo), el reloj de escalada de la marca dispara sobre la cartera
entera, y el listado accionable —*«el canal primario»* de `DEC-OBS-001`— deja de distinguir la
divergencia real. La consecuencia la escribe el propio arreglo 19: *«el cobro equivocado sigue
saliendo de su tarjeta todos los meses»*.

**El camino.**

1. El arreglo 18 enumeró la tabla y cerró con una regla sin excepciones: *«Espejar un estado leído
   por id es una transición declarada de esta tabla, no un acto aparte. Lo que **no** figura acá es
   divergencia real, y ahí la marca es la respuesta correcta»* (`B/03` §10.1).
2. **La tabla tiene ocho filas y el dominio tiene treinta y seis pares.** Lo conté sobre el texto
   vigente: el proveedor devuelve **cuatro** estados (*«El proveedor devuelve **cuatro** estados de
   preapproval»*, `B/03` §10.1) y nosotros tenemos **nueve** (`B/03` §3.1, *«siguen siendo nueve»*).
   4 × 9 = **36**. Las ocho filas cubren **20**:

   | fila | pares que cubre |
   |---|---|
   | `pending` × `PENDING_AUTHORIZATION` | 1 |
   | `pending` × *cualquier otro* | 8 |
   | `authorized` × `PENDING_AUTHORIZATION` | 1 |
   | `authorized` × `PAUSED` | 1 |
   | `authorized` × `GRACE_PERIOD` · `SUSPENDED` | 2 |
   | `paused` × `ACTIVE` | 1 |
   | `cancelled` × `CANCEL_SCHEDULED` | 1 |
   | `cancelled` × *cualquier estado vivo que no sea `CANCEL_SCHEDULED`* | 5 |
   | | **20** |

   **Quedan 16 sin declarar**: `authorized` × {`ACTIVE`, `CANCEL_SCHEDULED`, `ABANDONED`,
   `CANCELLED`, `CHARGE_DECLINED`} = 5; `paused` × {`PENDING_AUTHORIZATION`, `GRACE_PERIOD`,
   `PAUSED`, `SUSPENDED`, `CANCEL_SCHEDULED`, `ABANDONED`, `CANCELLED`, `CHARGE_DECLINED`} = 8;
   `cancelled` × {`CANCELLED`, `ABANDONED`, `CHARGE_DECLINED`} = 3.
3. **Dos de los dieciséis son los dos estados sanos más poblados del sistema**: `authorized × ACTIVE`
   —toda suscripción al día— y `paused × PAUSED` —toda pausa y toda cortesía, que `DEC-GRANT-003`
   implementa pausando—. La tabla escribió *«nada: coinciden»* para los otros dos pares coincidentes
   (`pending × PENDING_AUTHORIZATION` y `cancelled × CANCEL_SCHEDULED`) y **omitió éstos dos**.
4. El disparador no es hipotético ni depende de que llegue un webhook: es el barrido **diario**.
   `B/09` §3: *«Por cada suscripción de nuestro inventario que no esté en un estado terminal … |
   estado | el del proveedor, leído por id | **no se escribe el del proveedor**: se evalúa la
   transición contra la tabla del cap. 03. **Si no existe, se pone la marca**»*. Una `ACTIVE` sana
   leída como `authorized` no tiene transición en el §3.2 ni par en el §10.1 → marca.
5. Lo que la marca hace, y es lo caro: **bloquea la sucesión** —*«mientras esté puesta **no se puede
   declarar una sucesión**»* (`B/02` §2.2)—, y **escala por reloj** —*«Si sigue puesta pasado su
   plazo, **escala**»* (`B/09` §3)—. Con la cartera entera marcada, las dos cosas dejan de
   significar algo.
6. Y ahí muere el arreglo 19. Su razón escrita es que la fila marcada tiene que seguir barriéndose
   porque *«lo que se apaga así no es el ruido: es el único detector»* de una suscripción *«a la que
   el proveedor le cobra un monto distinto del pactado»*. El detector sobrevive; **lo que se apaga es
   la capacidad de leerlo**, porque la señal que lo hace visible —la marca, el listado accionable— la
   emiten ahora todas las filas.

**Dónde lo permite el diseño.** `HOS-1354/docs/03-maquinas-de-estado.md` §10.1 (la tabla de ocho
filas y su regla de cierre), §3.1 (los nueve estados);
`HOS-1354/docs/09-conciliacion.md` §3 (la comparación de estado y la marca, el reloj de escalada);
`HOS-1354/docs/02-modelo-de-datos.md` §2.2 (la marca bloquea la sucesión);
`HOS-1354/docs/19-superficies.md` §6 (el listado accionable como canal primario).

**Severidad.** `CRITICA`. La cadena tiene un eslabón argumental y hay que decirlo: lo que el defecto
produce por sí solo es **bloquear el cambio de plan a toda la cartera** y **ahogar el canal de
conciliación**, no un débito. El débito es el que el propio capítulo 09 declara como consecuencia de
perder el detector —*«el cobro equivocado sigue saliendo de su tarjeta todos los meses»*—, y el
defecto 19 de la 8-bis se clasificó `CRITICA` por esa misma cadena. Lo clasifico igual por
consistencia, no por agregarle nada.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: 18**, y la opción C que el owner eligió. La decisión
registrada dice *«se enumeran los **ocho pares**; los que tengan transición legítima la reciben y
**los que queden son divergencias reales**»* (`17-fase-8-bis/00-hallazgos.md` §3, defecto 18). **La
palabra «ocho» venía del hallazgo, que contaba pares con transición faltante, no el dominio**, y la
implementación escribió ocho **filas** y declaró cerrado el dominio. Es el caso testigo de
`DEC-METH-008` repetido con otro sujeto: un arreglo que agrega un eje —el estado del proveedor— y
recorre el conteo viejo.

---

### F-8cB1-004 — `S17` borra el único registro de que una cancelación fue una sucesión, y `B/16` §4.2 lo lee DESPUÉS: los addons del que hizo un upgrade quedan huérfanos y se cancelan de forma irreversible

**Qué se rompe.** El cliente que mejora su plan pierde los addons que ya pagó. Los recurrentes se
cancelan en el proveedor —*«e **irreversible**»* (`PA-5`, `B/06` §2)—; los de una vez con vigencia
`MIENTRAS_VIVA_LA_SUSCRIPCIÓN` —*«+5 fichas»*, `B/16` §1.3— se consumen sin devolución. Es
textualmente lo que `B/16` §4.2 escribió para impedir: *«le cobramos más y le sacamos lo que ya
pagó»*.

**El camino.**

1. `B/16` §4.2 define el huérfano con una condición que necesita saber si hubo sucesión:
   *«| `VERTICAL_SUBSCRIPTION` | la suscripción de esa vertical llegó a `CANCELLED` **y no tiene
   sucesora** |»*.
2. **El único dato que responde «¿tiene sucesora?» es `sucede_a`.** La palabra *«sucesora»* no tiene
   otra definición en el corpus: `sucede_a` es *«FK anulable a `subscription`»* (`B/02` §2.2) y es lo
   que los dos candados discriminan. Lo verifiqué: **`sucede_a` no aparece ni una vez en el capítulo
   16, ni en el 05, ni en el contrato de cobertura** — los tres consumidores que hablan de
   *«sucesora»* lo hacen sin nombrar la columna.
3. `S17` **borra esa columna en el mismo acto en que crea el `CANCELLED`**: *«se cancela en el
   proveedor (es `D7`), y en el mismo acto **la sucesora limpia su `sucede_a`**»* (`B/03` §3.2).
   Después de `S17` no queda **ningún** vínculo entre las dos filas, en ninguna dirección.
4. Entonces la condición del paso 1, evaluada en cualquier instante posterior al acto, da siempre lo
   mismo: la predecesora está `CANCELLED` y **no tiene sucesora**. Es huérfano.
5. Y lo que sigue es inmediato y en el proveedor: *«| los complementos pueden quedar huérfanos |
   **se cancelan en el proveedor, de inmediato** — salvo los que se re-apuntan a una sucesora (§4.2),
   que no quedaron huérfanos |»* (`B/16` §4.3). La excepción se apoya en un hecho que `S17` acaba de
   borrar.
6. **No alcanza con «hacerlo antes».** `B/16` §4.2 dice que el re-apunte ocurre *«en el mismo acto
   del upgrade»*, pero `S17` no lo lista entre sus efectos, y el capítulo 16 declara que el detector
   de un complemento huérfano es posterior y periódico: *«Lo que lo hace detectable es el barrido del
   capítulo 09 … un addon en estado terminal con su preapproval vivo es una discrepancia que el
   barrido ve»*. Cualquier control que corra **después** del acto —el barrido, una revisión manual, un
   reconciliador— sólo puede leer lo que quedó escrito, y lo que quedó escrito dice «huérfano».

**Dónde lo permite el diseño.** `HOS-1354/docs/16-addons.md` §4.2 (la tabla de scopes y el
re-apunte) y §4.3 (*«y esto es lo urgente»*);
`HOS-1354/docs/03-maquinas-de-estado.md` §3.2, `S17`, y §8, `A5`;
`HOS-1354/docs/06-proveedor.md` §2 (*«cancelar | ✅ | e **irreversible** (`PA-5`)»*).

**Severidad.** `CRITICA`. Se pierde sin vuelta algo pagado —un preapproval cancelado no se recupera,
y una instancia consumida *«no se libera ni se reasigna»* (`DEC-ADDON-001`)— y ocurre en el camino
normal del upgrade, que es el mecanismo que el cliente usa para **gastar más**.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: 11·12, volviendo falsa la premisa de un arreglo
ANTERIOR.** La condición *«y no tiene sucesora»* de `B/16` §4.2 la escribió la tanda del candado
(commit `20483a829`, verificado con `git log -S`), y `B/16` **no fue tocado por ninguno de los seis
commits de la 9-bis** (verificado con `git log a720519e1~1..e6f4ff3a7 -- 16-addons.md`, vacío). Es
literalmente la pregunta que `DEC-METH-008` manda hacer: **la premisa de otro arreglo que éste vuelve
falsa es «después de una sucesión queda escrito que hubo una sucesión»**. Es la forma nueva de
`F-8bB1-010` —que reportaba que el instante del re-apunte no estaba declarado— y es peor: antes el
implementador podía elegir el orden seguro; ahora la evidencia no existe en ningún orden posterior.

---

### F-8cB1-005 — El mismo cobro tiene dos veredictos opuestos: `B/05` §3 lo declara SEGURO para reactivar a la predecesora y `B/12` §5.3 manda registrarlo y reembolsarlo

**Qué se rompe.** El cliente en mora que usa el camino de recuperación —cambiar de plan estando en
grace, `DEC-SUB-003`— paga un período entero que, por la rama que se implemente, o **no se le
devuelve** o **le devuelve el servicio que después `S17` le cancela**. En la rama del capítulo 05 el
resultado es el que el arreglo 15 escribió para impedir: *«paga un período entero que **no le compra
nada**»*.

**El camino.**

1. Predecesora en `GRACE_PERIOD`; el cliente cambia de plan, que es el camino que `DEC-SUB-003`
   declara *«la salida del problema en vez de un muro»* (`B/16` §2.3). Nace la sucesora en
   `PENDING_AUTHORIZATION`, con crédito **cero** —*«En grace, el período en curso no se pagó …
   Entonces el crédito es **cero**»* (`B/12` §5.2)—.
2. La cuota impaga **sigue en `recycling` y puede entrar**: *«Mientras la predecesora siga viva su
   cuota sigue en `recycling` (§1.3, medido) y **puede entrar**»* (`B/12` §5.3).
3. **`B/12` §5.3 dice qué hacer, y es no reactivar**: *«**`S5` no se aplica sobre una fila que ya
   declaró sucesión.** El pago entra, se registra, y **se reembolsa**; la predecesora sigue su camino
   a `CANCELLED` por `S17`»*.
4. **`B/05` §3 dice lo contrario, con el caso enumerado y una nota que lo justifica.** Sus cuatro
   condiciones se cumplen las cuatro: (1) *«la suscripción existe y está en `GRACE_PERIOD` o
   `SUSPENDED`»* ✓; (2) el monto coincide ✓; (3) *«no hay otra fila principal … en un estado que dé
   título —`ACTIVE`, `GRACE_PERIOD`, `PAUSED`, `CANCEL_SCHEDULED`—, **ni una sucesora de esta fila ya
   autorizada**»* — la sucesora está en `PENDING_AUTHORIZATION`, que no está en la lista y no está
   autorizada ✓; (4) no hay otro pago del período ✓. Y el capítulo remata: *«**Si las cuatro se
   cumplen**, entra `SUSPENDED → ACTIVE` (S7) y se restituye la publicación»*.
5. La nota que lo sella no es una omisión, es una decisión escrita: *«**Y una sucesora en
   `PENDING_AUTHORIZATION` no bloquea, a propósito.** … el pago tardío que reactiva a la predecesora
   **es la evidencia de que la sucesión ya no hace falta**»* (`B/05` §3).
6. **Nada cancela la sucesora en esa rama.** El cliente ya tiene el checkout abierto, autoriza, `S2`
   la lleva a `ACTIVE`, y `S17` cancela la predecesora que el pago acaba de reactivar. El período
   cobrado no compró nada, y el reembolso que `B/12` §5.3 prometía **nunca se dispara**, porque en
   esta rama el pago se consideró legítimo.
7. En la rama inversa el daño es menor pero el texto muerto queda: un implementador que lea el
   capítulo 05 —que es el capítulo cuyo título es *«qué hace seguro a un pago tardío»*— escribe la
   reactivación, y el aviso previo del catálogo de `NUCLEO/07` (*«cambio de plan con una cuota en
   reintento»*) le habrá anticipado al cliente un reembolso que no llega.

**Dónde lo permite el diseño.** `HOS-1354/docs/05-idempotencia-y-concurrencia.md` §3, la tabla de
cuatro condiciones y la nota final; `HOS-1354/docs/12-suscripcion.md` §5.3, el bloque *«Y si entra,
NO reactiva a la predecesora»*; `nucleo/07-outbox-y-notificaciones.md`, la fila *«cambio de plan con
una cuota en reintento»*.

**Severidad.** `CRITICA`. Es plata real del cliente en el único camino que el diseño le ofrece a
alguien en mora, y las dos reglas están escritas con la misma autoridad en dos capítulos `CURRENT`.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: 15.** El capítulo 05 **no fue tocado por ninguno de
los seis commits de la 9-bis** (verificado con `git log a720519e1~1..e6f4ff3a7 --
05-idempotencia-y-concurrencia.md`, vacío), y su §3 ya llevaba una corrección de la tanda anterior
—*«Su redacción cambió, y es más precisa, no más laxa»*, sobre la marca—. El arreglo 15 escribió la
regla contraria en el capítulo 12 sin mirar el capítulo que resuelve el mismo evento. **La premisa
que vuelve falsa es la del párrafo «no bloquea, a propósito»**, que se apoyaba en *«el pago tardío …
es la evidencia de que la sucesión ya no hace falta»* — desde el arreglo 15, la sucesión sigue y el
pago se reembolsa.

---

## ALTA

### F-8cB1-006 — La lápida se apoya en un barrido que por su primera línea no la mira, así que el doble cobro que venía a cerrar sigue abierto

**Qué se rompe.** El cobro viejo que entra después del corte vuelve a llegar como preapproval
desconocido y se imputa a la suscripción nueva de esa misma persona. Es, palabra por palabra, el
daño que el arreglo 21 describe: *«**El cobro viejo se imputa como pago del ciclo nuevo: pagó dos
veces y el sistema registra una.**»*

**El camino.**

1. El arreglo 21 escribe la lápida y declara su mecanismo de rescate: *«Con la lápida, el barrido del
   cap. 09 **encuentra el id** y resuelve *«cancelado durante el corte»* en vez de *«huérfana»*»*
   (`B/21` §2.5).
2. La lápida es *«una `subscription` en **`CANCELLED`** con su `provider_link`»* (mismo §).
3. **El barrido no mira las `CANCELLED`.** `B/09` §3 abre con *«Por cada suscripción de nuestro
   inventario **que no esté en un estado terminal**»* y lo repite: *«**Los estados terminales no se
   barren**: `CANCELLED`, `ABANDONED` y `CHARGE_DECLINED` no pueden divergir hacia nada que nos
   importe, y barrerlos es gastar llamadas sobre la parte de la cartera que más crece»*.
4. El commit de la lápida (`7c53c88ad`) tocó **un solo archivo**, `21-migracion.md` (verificado con
   `git show --stat`). El capítulo 09 quedó como estaba.
5. El otro camino que la lápida podría tomar —que el webhook resuelva el `provider_link` y no sea
   *«desconocido»*— tampoco está escrito, y si se lo asume, choca con `F-8cB1-003`: el par
   `cancelled × CANCELLED` es uno de los dieciséis que la tabla del §10.1 no declara, así que todo
   evento sobre una lápida es *«divergencia real»* y pone la marca.

**Dónde lo permite el diseño.** `HOS-1354/docs/21-migracion.md` §2.5;
`HOS-1354/docs/09-conciliacion.md` §3 y §2.2; `HOS-1354/docs/03-maquinas-de-estado.md` §10.1.

**Severidad.** `ALTA`. El doble cobro de fondo es real y está descrito por el propio capítulo, pero
su alcance está medido y es chico: *«tres compromisos que todavía no cobraron»* y *«**0** pagos
registrados en toda la historia»* (`B/21` §1.2, medición del 2026-09-15 re-verificada el 2026-09-17).
No es `CRITICA` porque la población expuesta son tres filas conocidas y contactables, no la cartera.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: 21.** La exclusión de los terminales es
preexistente —está desde `966189003`, verificado con `git log -S`— y ya llegó como `F-8B3-008` de la
FASE 8, que las instrucciones excluyen de esta pasada. **Lo nuevo es que un arreglo de la 9-bis eligió
esa exclusión como su mecanismo de rescate sin verificarla**, y el arreglo se declaró `APLICAR`, o sea
sin discusión de diseño.

---

### F-8cB1-007 — La lápida es una `subscription` y el mismo capítulo declara que no existe ninguna versión de plan vieja que anclarle: la fila no se puede escribir

**Qué se rompe.** La única fila que el arreglo 21 manda escribir no tiene valores posibles para los
campos que su entidad exige. Si se escribe igual —inventando un ancla— la lápida miente sobre qué
compromiso fue; si no se escribe, `F-8cB1-006` deja de ser el problema y el problema es que el
mecanismo no existe.

**El camino.**

1. `B/02` §2.2 declara qué guarda una `subscription`: *«`user`, vertical, **versión de plan anclada**,
   **billing option**, estado, período actual, fecha de fin de servicio, clase (principal o de
   complemento), `sucede_a` (FK anulable a `subscription`) …»*. La única columna que el capítulo
   declara anulable es `sucede_a`.
2. `B/21` §2.4 declara, en negrita y como cita destacada: *«**El sistema nuevo no hereda una sola
   fila.**»* y *«no se migra ninguna»*. No se crea ninguna versión de plan del sistema viejo, ni
   ninguna `billing_option` suya.
3. El compromiso que la lápida conserva es del sistema **viejo**: un plan que no está en el catálogo
   nuevo. No hay `plan_version_id` ni `billing_option` que ponerle.
4. El capítulo tampoco declara una clase para ella. Si nace `principal`, el candado `A` no la ve
   —`CANCELLED` no es vivo, y eso `B/21` §2.5 lo dice bien—, pero el resto del sistema sí: `B/10`
   §3.4 cuenta *«cuántas suscripciones siguen ancladas»* a cada versión retirada, y una lápida con un
   ancla inventada aparece en ese conteo.

**Dónde lo permite el diseño.** `HOS-1354/docs/02-modelo-de-datos.md` §2.2, la fila `subscription`;
`HOS-1354/docs/21-migracion.md` §2.4 y §2.5.

**Severidad.** `ALTA`. No mueve plata por sí solo; deja sin poder ejecutarse el mecanismo de
`F-8cB1-006`, que sí la mueve.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: 21.** La regla venía de antes —el §2.5 lo dice:
*«Esta regla ya estaba escrita y no se aplicó»*— pero **se escribió por primera vez junto a la
decisión de no migrar nada**, y es esa convivencia la que la vuelve inejecutable. El texto incluso
nombra el modo de falla que lo produjo y no lo aplica a sí mismo: *«una decisión que vuelve
innecesario un trabajo puede llevarse algo que seguía haciendo falta»*.

---

### F-8cB1-008 — `S17` sobre una predecesora en `CANCEL_SCHEDULED` vuelve a cancelar un preapproval ya cancelado, y el camino del arrepentimiento —declarado normal— termina en un incidente

**Qué se rompe.** El cliente que se arrepiente de su baja completa el camino que el diseño le indica,
y al autorizar la fila nueva el sistema emite un incidente en vez de cerrar la sucesión. El efecto
colateral es `F-8cB1-001`: `S17` no ocurre, `sucede_a` no se limpia.

**El camino.**

1. `B/03` §3.3 declara el arrepentimiento como sucesión: *«arrepentirse **no es una transición: es
   una sucesión**. `DEC-SUB-009` cancela en el proveedor de inmediato y cancelar allá es irreversible
   (`PA-5`) … eso entra por el candado `B` igual que un upgrade»*. Y `G-R1-A` lo admite:
   `CANCEL_SCHEDULED` está en los tres estados legales de predecesora.
2. `S11` **ya canceló el preapproval de esa predecesora**: *«se cancela en el proveedor de inmediato»*
   (`B/03` §3.2), y el propio §3.3 se apoya en eso para descartar el doble cobro.
3. `S17` no distingue: su efecto es *«**se cancela en el proveedor** (es `D7`)»*, sin excepción por
   estado de origen. Sobre un preapproval ya `cancelled`, el proveedor mide la transición inversa
   como `400` —*«`PUT {status:"authorized"}` devuelve `400 "Invalid transition from cancelled to
   authorized"`»* (`B/12` §4.4)— y **nadie midió `cancelled → cancelled`**: no hay fila de la matriz
   para una segunda cancelación.
4. `D5` obliga a verificar releyendo y comparando campo por campo, y el §3.2 declara qué pasa si la
   cancelación falla: *«Si la cancelación en el proveedor **falla**, `S17` no ocurre: la marca se pone
   y una persona lo mira»*. Para el arrepentimiento, eso es **el desenlace normal del camino normal**,
   que es exactamente la forma de defecto que `S17` fue escrito para cerrar (*«el acto normal del
   mecanismo más caro del sistema terminaba en un incidente y una fila sin cancelar»*).

**Dónde lo permite el diseño.** `HOS-1354/docs/03-maquinas-de-estado.md` §3.2 (`S11`, `S17` y la nota
sobre la cancelación fallida) y §3.3; `HOS-1354/docs/12-suscripcion.md` §4.4;
`HOS-1354/docs/20-testing.md` §2, `G-R1-A`.

**Si esa medición vuelve al revés**: si cancelar un preapproval ya cancelado es idempotente y
devuelve el objeto `cancelled`, el paso 4 no ocurre y el hallazgo baja a una precisión de redacción
—`S17` debería decir *«se cancela si no está ya cancelado»*—. **Es una sonda de sandbox sin costo y
sin plata en juego**, y decide entre una redacción y un incidente por cada arrepentimiento.

**Severidad.** `ALTA`. No cobra de más por sí solo; deja la sucesión sin terminar, que es la entrada
de `F-8cB1-001`.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: 11·12.** `S17` es la transición nueva; el camino del
arrepentimiento es texto anterior (`B/03` §3.3) y no se cruzó con ella. Es el par *«`S17` × estado de
origen de la predecesora»* otra vez, en la casilla en que el efecto de `S17` ya está ejecutado.

---

### F-8bB1-009 (sigue llegando) — `G-R1-A` y `G-R1-B` siguen en la capa que corre contra el árbol de fuentes, y el arreglo 13 le agregó a `G-R1-B` una comparación contra el proveedor

**Dónde llega ahora.** El arreglo 13 reescribió `G-R1-B` (commit `7ba3b148d`, diff verificado) y lo
que le agregó es **más** imposible de evaluar sobre el código que lo que tenía: *«una fila con
`sucede_a` no nulo **no** nace con fecha de primer cobro posterior al vencimiento de su ventana de
autorización, **o esa fecha no es la que el proveedor confirmó**»* (`B/20` §2). Comparar contra *«la
que el proveedor confirmó»* exige una fila y una relectura.

El choque es textual y ahora está en dos capítulos a la vez: `B/20` §1 define la capa como
*«**guards** | propiedades del **código**, no de una ejecución | **el árbol de fuentes, en CI**»*,
mientras `B/02` §2.2 sostiene el arreglo 13 sobre lo contrario: *«El guard sigue corriendo sin red,
porque **lee la columna**»*, y `nucleo/04` `D8` lo apoya en *«**base**: la fecha que el proveedor
confirmó se guarda en `subscription` …, y un guard la compara contra esa ventana»*.

**Y hay un tercero en la misma lista**: `G11` —*«se le pide un **trial al proveedor**»*— tiene su
imposibilidad escrita en el capítulo 06 §4.3: *«Un guard que busque `free_trial` en el payload **no
ve nada**, porque el payload no lo nombra. **El guard tiene que mirar la relectura.**»* Tres de los
seis guards de la lista no son propiedades del árbol de fuentes.

**Y `G-R1-A` leído como predicado de datos falla sobre una sucesión legítima**, con un camino que no
tenía antes: predecesora en `GRACE_PERIOD` (estado legal), el cliente usa el camino de recuperación
de `DEC-SUB-003`, el reloj del grace se agota durante la ventana de 72 h, `S6` la lleva a
`SUSPENDED` — y `SUSPENDED` está **fuera** del conjunto que `G-R1-A` exige.

**Severidad.** `ALTA`. Es el andamiaje de `F-8cB1-001` y del arreglo 13 entero: si los dos guards no
se pueden ejecutar donde están declarados, `D8` y `D15` vuelven a ser invariantes recordables, que es
lo que los dos arreglos fueron a corregir.

**¿Es nuevo, o es el arreglo?** **Sigue llegando desde la 8-bis** (`F-8bB1-009`), y **el arreglo 13
lo agravó** en la mitad que tocó.

---

### F-8bB1-012 (sigue llegando) — Un addon cuya suscripción muere en `CHARGE_DECLINED` no queda huérfano por la definición del §4.2, y su preapproval no se cancela ni se barre

**Dónde llega ahora.** **Intacto, en los cuatro pasos**: `B/16` no fue tocado por la 9-bis
(verificado con `git log a720519e1~1..e6f4ff3a7 -- 16-addons.md`, vacío), así que §4.2 sigue diciendo
*«llegó a `CANCELLED` y no tiene sucesora»* y `CHARGE_DECLINED` sigue sin ser `CANCELLED`; `B/09` §3
sigue listándolo entre los terminales que no se barren. Lo que cambió es que **ahora tiene un
hermano**: `F-8cB1-004`, que es el mismo hueco por el lado contrario —ahí el addon se declara huérfano
cuando no lo es; acá no se declara cuando lo es—. Los dos salen de que la condición del §4.2 se
escribió antes de que existieran `S16` y `S17`.

**Severidad.** `ALTA` en la 8-bis; la mantengo, con la misma acotación: la ventana para contratar el
addon son los 26-44 minutos de `PA-3`.

---

## MEDIA

### F-8cB1-010 — El arreglo 13 hizo `D8` verificable y no declaró qué se hace cuando la verificación falla: la única respuesta declarada prohíbe el acto que evitaría el cobro

**Qué se rompe.** Guardar *«la fecha que el proveedor confirmó»* convierte el incumplimiento de `D8`
en algo **detectable**, y el diseño no dice qué hacer al detectarlo. La única respuesta declarada es
`S14` —marca más §22.1, con *«**cero decisiones destructivas automáticas**»*—, y el acto que evitaría
el cobro (cancelar la sucesora antes de que cobre) es destructivo por definición. O sea: se detecta,
se avisa, y se cobra igual, con la predecesora viva porque `D7` la mantiene así.

**El camino.** `B/02` §2.2 declara el valor del arreglo: *«su incumplimiento es literalmente el doble
cobro»*, y *«si no lo respeta la sucesora cobra en el acto con la predecesora viva — el cliente paga
dos veces el mismo período»*. La relectura de `D5`/`B/06` §4.1 lo descubre; `B/03` §3.2 `S14` es lo
único que se dispara; `B/20` §2 `G-R1-B` corre en CI (ver `F-8bB1-009`) y no sobre esa fila.

**Si esa medición vuelve al revés**: `EX-33` está `VERIFIED` *«en producción con tarjeta real, medido
tres veces sobre el mismo pagador»* (`B/06` §6) diciendo que **el checkout SÍ respeta una fecha de
primer cobro futura**, así que el disparador está medido como improbable. **Si esa fila caduca**
—`S-METH-01`, y el proveedor *«acepta y descarta»* en cinco de las ocho capacidades del §3 del
capítulo 06— el camino se abre entero y el diseño no tiene respuesta escrita.

**Severidad.** `MEDIA`. La medición vigente dice que el disparador no ocurre; lo que falta es la
rama, no el mecanismo.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: 13.** Antes del arreglo la verificación no existía y
no había nada que declarar; el arreglo creó el detector y no la conducta.

---

### F-8cB1-011 — El §3 del capítulo 09 se contradice a sí mismo desde el arreglo 19: la fila marcada «SÍ se barre» y el barrido corre sólo sobre las no terminales

**Qué se rompe.** Una fila marcada **y** terminal cae en el hueco entre dos frases del mismo §, y el
caso no es de laboratorio: `S14` dispara *«cualquiera»* (`B/03` §3.2) y `S3` manda a `ABANDONED`
después de cancelar el preapproval sin condicionar la transición al éxito de esa cancelación — que
`B/06` §6 declara *«lo único que impide una autorización viva que puede cobrar»*.

**El camino.** `B/09` §3 abre con *«Por cada suscripción de nuestro inventario **que no esté en un
estado terminal**»*, reafirma *«Los estados terminales no se barren: `CANCELLED`, `ABANDONED` y
`CHARGE_DECLINED`»*, y el párrafo inmediatamente siguiente —reescrito por el arreglo 19— dice *«Una
fila con la marca `requiere_conciliación` **SÍ se barre**»*. Para la intersección, el capítulo afirma
las dos cosas.

**Severidad.** `MEDIA`. La población es chica y el daño de fondo —el preapproval vivo de una
`ABANDONED`— ya está cubierto por el job del §3.4 punto 2. Lo que falta es decir cuál de las dos
frases gana.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: 19.** El diff (`7ba3b148d`) reemplazó *«una fila con
la marca puesta tampoco se barre»* por su contrario **sin tocar la frase de arriba**, que era la que
la hacía consistente.

---

## `NUCLEO` — lo que encontré en `docs/nucleo/` y no resuelvo acá

1. **`D15` se apoya en una base que no lo sostiene en el caso de `F-8cB1-001`.**
   `nucleo/04-invariantes.md` `D15` dice *«Una sucesión es un compromiso, no dos: a lo sumo una
   sucesora viva por `user + vertical`, y una sucesora no puede ser sucedida»*, apoyado en *«**base**:
   los dos índices parciales, partidos por `sucede_a`»*. Los índices hacen cumplir *«a lo sumo una»*
   en las dos mitades; **lo que no hacen cumplir es que la mitad `A` esté ocupada**, y eso es lo que
   convierte *«un compromiso, no dos»* en *«ninguno»*. El apoyo declarado es correcto para el
   enunciado y falso para el invariante 8 del §64, que es el que cuenta compromisos. `MEDIA`, y es
   del recuento que la 9-bis rehízo entero.
2. **`D7` y `S17` no dicen lo mismo sobre cuándo termina la vida de la predecesora.** `D7` es
   *«La suscripción vieja se cancela **sólo** al recibir el webhook de que la nueva quedó
   autorizada»*, y las tres transiciones del paso 4 de `F-8cB1-001` la cancelan antes, por causas que
   no son ese webhook. `D7` no declara excepción, así que o las tres la violan o `D7` está
   sobre-enunciado. `BAJA` como texto, `CRITICA` como consecuencia, y la consecuencia ya está
   reportada arriba.

---

## Lo que cae en el hueco del capítulo 13

De mi vector, y sólo lo que **esta pasada** movió:

1. **Qué devuelve el proveedor al cancelar un preapproval ya `cancelled`.** Es `F-8cB1-008`. No tiene
   fila en la matriz; `PA-5` mide que cancelar es irreversible, no que sea idempotente. Sonda de
   sandbox, sin costo.
2. **Qué se hace cuando la relectura dice que la fecha de primer cobro confirmada viola `D8`.** Es
   `F-8cB1-010`, y la respuesta no puede ser `S14` sola.
3. **El reembolso del cobro de `recycling`** que `B/12` §5.3 promete: sigue apoyado en *«la única
   capacidad que el cap. 06 §10 declara en riesgo de plataforma»* (`RF-6/7/8`), y ahora además
   compite con la reactivación de `B/05` §3 (`F-8cB1-005`).

---

## Ataques que intenté y el diseño resistió

- **Encadenar sucesiones para conseguir tres autorizaciones vivas.** No se puede: el candado `B` está
  indexado sobre `(user_id, vertical)` y no sobre `sucede_a`, así que *«la segunda sucesora colisiona
  con la primera»* (`B/02` §2.2) sin ninguna regla extra. El argumento está bien construido y el
  contraejemplo obvio —indexar sobre `sucede_a`— está descartado por escrito.
- **Suceder desde una fila marcada para cobrar dos veces.** El arreglo 17 lo cierra bien: la excepción
  de `CANCEL_SCHEDULED` ahora *«exige releer el preapproval por su id»*, y la objeción que yo iba a
  hacer —que `D6` prohíbe preguntarle al proveedor— está contestada en el mismo párrafo con la
  distinción correcta: `D6` es sobre **el buscador** (`RC-1`), y **leer por id es `VERIFIED`**
  (`RC-2`). *«Y si la relectura dice que el preapproval sigue vivo, la marca hace lo que tiene que
  hacer: bloquear.»*
- **Sacar a `PENDING_AUTHORIZATION` de los vivos para liberar el candado.** El §2.2 lo anticipa y
  explica por qué es la salida que parece equivalente y no lo es: *«sin él **nada impide una tercera,
  una cuarta y una décima creación simultánea**»*.
- **72 h de servicio gratis repetibles abandonando el checkout.** Cerrado por el arreglo 16:
  *«Una suscripción esperando autorización NO emite fuente de cobertura»* (contrato §2.6), con las dos
  ramas caras nombradas. Verifiqué la tabla de nueve estados contra `B/03` §3.1 y contra
  `B/16` §2.2: los nueve están, los `PAUSED` están partidos por motivo, y ninguna fila contradice a su
  capítulo de origen.
- **Que la cortesía cubra y la pausa pedida también, o al revés.** El motivo obligatorio y la regla
  *«el reloj lee el motivo, nunca al proveedor»* (`B/03` §5) lo cierran, con la medición que lo obliga
  (en el proveedor las dos se ven idénticas).
- **Un reembolso parcial que supere el monto del pago.** `P5` valida *«contra el saldo, no contra el
  monto original»* (`B/03` §6) y la entidad `refund` lo repite como restricción. Resiste.
- **Un descuento apilado que dé distinto según el orden de iteración.** `B/14` §1.2 es determinista y
  el argumento de conmutatividad dentro de cada familia es correcto: 1.000 con 20 % y ARS 100 da
  ARS 700 por el camino declarado, y sólo por ése.
- **Cobrar ARS 15 a quien tiene un descuento del 100 %.** `B/14` §1.3 valida contra el rango
  **antes** de mutar y cae al mecanismo de cortesía. La razón está medida (`PC-2`) y la dirección de
  falla elegida es la correcta.
- **Un `payment` de cero por un addon a costo cero, para contaminar la conciliación.** `B/16` §3.1 lo
  prohíbe con el argumento exacto: *«un pago de cero sin contraparte es una fila que después aparece
  en toda conciliación como una discrepancia que hay que explicar cada vez»*.
- **Cobrar durante la discontinuación de una vertical.** `B/10` §4.2 —*«Se deja de cobrar antes de
  dejar de prestar. Nunca al revés»*— más la cancelación de todas las suscripciones y complementos el
  día 0. El techo de la fórmula (*«el último día ya pagado»*) evita el prorrateo que el capítulo 06
  dejó fuera de las ocho capacidades. Cierra.
- **Perder el cobro que entra justo antes de una cancelación.** `C2` lo resuelve por **fecha del
  hecho** y extiende la fecha de fin de servicio, que es lo coherente con `DEC-SUB-009`. Y el caso
  inverso —cobro posterior— cae en la marca con reembolso confirmado por una persona.
- **Que un evento viejo pise el estado actual.** La regla de no-retroceso está bien construida: el
  `version` descarta sin gastar relectura y **el evento nunca es la fuente**. Lo que falla no es la
  regla sino la enumeración de pares que la implementa (`F-8cB1-003`).
- **Concluir «no cobró» desde el endpoint de cobros.** `B/09` §4 enumera los tres modos y fija la
  regla correcta: se concluye desde el contador del preapproval, nunca desde el `search`.
- **Dejar sin capacidades a un *Free Forever* retirándole el plan.** `UNIQUE(plan_id) WHERE vigente`
  más *«la vigente, vendible o no»* más el trinquete lo cierran, y el argumento de por qué **no** se
  lee como la pricing está escrito con su caso (`D13`).
- **Que el re-apunte del addon lo deje colgando de dos filas.** No: es un movimiento, no una copia, y
  `A5` sólo dispara sobre el huérfano. El problema es cuándo se evalúa el huérfano (`F-8cB1-004`), no
  el re-apunte.

---

## Cómo dio la medición que esta pasada existe para producir

| | 8-bis | 8-bis-2 (`B1`) |
|---|---|---|
| hallazgos | 14 | **12** — 10 nuevos + 2 que siguen llegando |
| `CRITICA` · `ALTA` · `MEDIA` · `BAJA` | 7 · 5 · 2 · 0 | **5 · 5 · 2 · 0** |
| **`CRITICA` atribuidos a la tanda de arreglos anterior** | **6 de 7** | **5 de 5** |

**La proporción se repite, y hay que declarar el sesgo antes de leerla**: el §2 de las instrucciones
manda mirar primero los 23 arreglos, así que la búsqueda estaba dirigida ahí. Recorrí también las
superficies que la 9-bis **no** tocó —capítulos 05, 06, 10, 14, 16, 19, 22 de billing— y lo que
produjeron no fueron defectos independientes sino **contradicciones con el texto nuevo**: `F-8cB1-004`
y `F-8cB1-005` viven enteros en capítulos intactos, y llegan porque otro capítulo cambió debajo.

**Eso es el dato, y es distinto del de la vuelta pasada.** Los cinco `CRITICA` no son arreglos que
dejaron su propio dominio a medias: son arreglos que recorrieron el suyo y **volvieron falsa una
premisa escrita en otro lado**. `DEC-METH-008` agregó las dos obligaciones; la primera —recorrer el
dominio que el arreglo crea— **funcionó**, y se ve en que `S17` trae su dominio recorrido y en que el
arreglo 16 trae los nueve estados. La segunda —*«¿qué premisa de OTRO arreglo estoy volviendo
falsa?»*— **no se ejecutó en ninguno de los cinco casos**, y en cuatro de ellos la premisa estaba a
una búsqueda de distancia:

| arreglo | la premisa que volvió falsa | dónde vivía | ¿la tocó el commit? |
|---|---|---|---|
| 11·12 (`S17`) | *«después de una sucesión queda escrito que hubo una sucesión»* | `B/16` §4.2 | no |
| 11·12 (`S17`) | *«`S17` siempre puede correr»* — la suya propia | `B/03` §3.2 | sí, y no la recorrió |
| 15 (`S5` no aplica) | *«el pago tardío que reactiva a la predecesora es la evidencia de que la sucesión ya no hace falta»* | `B/05` §3 | no |
| 18 (los ocho pares) | *«ocho»* era un conteo de pares rotos, no del dominio | `B/03` §10.1 | sí |
| 21 (la lápida) | *«el barrido del cap. 09 encuentra el id»* | `B/09` §3 | no |

**La mecánica sugiere el control que falta**, y no es otra regla de método: **cuatro de los cinco se
detectan con una búsqueda de texto por el término que el arreglo redefine** —`sucede_a`, «sucesora»,
«barrido», «pago tardío»— **sobre los capítulos que el commit NO toca**. Es la única parte de esto
que se puede automatizar, y la dejo señalada sin proponerla como decisión: eso es del owner.

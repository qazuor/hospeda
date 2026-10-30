---
title: "FASE 8-bis-3 · B1 — doble cobro y pérdida de pago"
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 8
---

# FASE 8-bis-3 · B1 — doble cobro y pérdida de pago

Cuarta pasada adversarial sobre la épica de billing (`HOS-1354`), el núcleo y el contrato de
cobertura, con el mismo vector: **los caminos por los que a alguien se le cobra dos veces, se le
cobra lo que no corresponde, se le cobra después de irse, o paga y no recibe lo que pagó.**

**Nueve hallazgos —siete nuevos y dos que siguen llegando—. Tres `CRITICA`, y los tres los
introdujo un arreglo de la 9-bis-2.** La proporción no baja. Pero **el modo cambió otra vez**, y
ése es el dato que la pasada existía para producir:

> La 8-bis encontró arreglos que **no habían recorrido su propio dominio**. La 8-bis-2 encontró
> arreglos que **sí lo recorrieron y volvieron falsa la premisa de otro capítulo**. Ésta encuentra
> arreglos que **recorrieron el dominio, nombraron el término y lo aplicaron a unos predicados y
> no a otros, dentro del mismo commit**.

El caso testigo es literal y se puede leer en dos líneas del mismo archivo. `B/16` §4.2 escribe
*«**no hay una fila viva con `sucede_a` apuntándola**»*; `S19`, escrito por la misma tanda, escribe
*«la fila tiene una sucesora con `sucede_a` apuntándola»*, **sin la mitad «viva»**. Los dos
predicados preguntan lo mismo. Uno sobrevive a que la sucesora se muera y el otro no, y del que no
cuelga la plata de un cobro acreditado.

**Y eso mide `DEC-METH-009` con una precisión que la regla no anticipaba.** El grep que la regla
manda —*«buscar el término sobre los capítulos que el commit NO toca»*— **habría encontrado dos de
los tres `CRITICA`, y tres de los siete hallazgos nuevos**. Los otros cuatro viven **adentro de los
capítulos que el commit sí tocó**, y para ésos la regla apunta al lugar equivocado. La sección
*«Cómo dio la medición»*, al final, lo cuenta entero.

Regla de lectura: cada hallazgo se apoya en cita textual con archivo y §. Los conteos que uso los
conté yo sobre el texto vigente del worktree (`cd4e59164`) y digo cómo. Verifiqué las citas ajenas
contra el texto del capítulo, no contra el informe que las cita, y donde una no dio, lo digo.

---

## CRITICA

### F-8dB1-001 — Nada limpia `sucede_a` cuando la sucesora se muere, así que el cliente que abandonó una vez un checkout de cambio de plan queda con `S5`, `S6` y `S7` apagados PARA SIEMPRE: el próximo cobro que entre se retiene, no reactiva y no se devuelve

**Qué se rompe.** Alguien en mora usa el camino de recuperación que el diseño le ofrece —cambiar
de plan estando en `GRACE_PERIOD`, `DEC-SUB-003`—, se arrepiente y abandona el checkout. A las 72 h
`S3` mata a la sucesora. **Desde ese día su fila cumple para siempre la condición de `S19`**, y
cuando el proveedor consigue cobrar la cuota que seguía en `recycling`, el pago **se registra y
queda pendiente de resolución**: no reactiva (`S5`/`S7` lo tienen prohibido), no vence el reloj
(`S6` no corre sobre un pago pendiente) y no se devuelve (el disparador del reembolso es el cierre
de una sucesión que ya no existe). El cliente pagó el período, se queda en `GRACE_PERIOD`
indefinidamente, y la plata no vuelve ni se aplica. **La rama 2 de las cuatro —la que `DEC-RF-002`
cita como *«vencer la ventana reactiva»*— es inalcanzable.**

**El camino.**

1. **`sucede_a` tiene un solo limpiador y exige que la sucesora esté `ACTIVE`.**
   *«`sucede_a` no nulo → **sucesión en curso**. La escribe `S1`, la limpia `S18`»*
   (`B/02` §2.2), y `S18` es *«la **sucesora**, en `ACTIVE` … **cierra la sucesión, y es el único
   acto que lo hace**»* (`B/03` §3.2). Lo conté con `rg` sobre los trece capítulos de `HOS-1354`,
   los ocho del núcleo y el contrato: las dos columnas aparecen **65 veces en 8 archivos**
   (`B/02` 19, `B/03` 14, `B/16` 11, `B/05` 6, `B/20` 6, `B/12` 5, `nucleo/04` 3, `B/09` 1) y **la
   única línea que limpia `sucede_a` o escribe `sucedida_por` es la fila `S18`**.
2. **Una sucesora que muere conserva su `sucede_a`.** `S3` —*«pasaron **72 h** sin autorizar … se
   cancela el preapproval en el proveedor; **la fila se conserva**»*— no lo limpia, y para `S13` el
   texto lo declara a propósito: *«la sucesora queda `CANCELLED` con su `sucede_a` escrito, que es
   el registro fiel de lo que pasó»* (`B/03` §3.2). Después de `S3` no queda ninguna transición que
   pueda limpiarlo: `S18` exige `ACTIVE` y de `ABANDONED` no se sale (*«`ABANDONED` → `ACTIVE`: la
   ventana venció»*, `B/03` §3.3).
3. **El predicado que decide la plata se lee sobre esa columna y no pide que esté viva.** `S19`:
   *«la **predecesora** de una sucesión en curso, en `GRACE_PERIOD` o `SUSPENDED` … condición: **la
   fila tiene una sucesora con `sucede_a` apuntándola**»* (`B/03` §3.2). `G-R1-D` repite la
   definición operativa entre paréntesis: *«la **predecesora de una sucesión en curso** (tiene una
   sucesora con `sucede_a` apuntándola)»* (`B/20` §2). **En ninguno de los dos figura «viva».**
4. **Las tres transiciones de plata quedan trabadas a la vez, y las tres lo dicen con la misma
   frase**: `S5` y `S7` llevan *«las cuatro condiciones del cap. 05 §3 — y la 3 incluye **que esta
   fila no sea la predecesora de una sucesión en curso**»*, y `S6` lleva *«**no hay un pago
   acreditado del período pendiente de resolución** por `S19`»* (`B/03` §3.2). Con `sucede_a`
   eterno, la primera mitad es verdadera para siempre y la segunda se cumple apenas entra el cobro.
5. **Y el destino del pago cuelga de un cierre que no puede ocurrir.** *«El pago acreditado no se
   reembolsa al entrar: queda pendiente, y se resuelve cuando la sucesión se resuelve»*
   (`B/12` §5.3). Las cuatro ramas se disparan por cómo **termina** la sucesión; acá la sucesión,
   leída por la columna que el propio arreglo declaró canónica, **no termina nunca**.
6. **El único backstop lee el término al revés que el predicado.** `B/09` §3: *«Si una fila tiene
   un pago acreditado **pendiente de resolución** (`B/03` §3.2, `S19`) y ya **no** es la predecesora
   de una sucesión en curso —**la sucesora murió**, o la sucesión se cerró—, su destino estaba
   determinado y nadie lo ejecutó»*. O sea que el capítulo 09 declara que *«la sucesora murió»* ⇒
   ya no hay sucesión en curso, y `B/02` §2.2 declara que *«`sucede_a` no nulo → sucesión en
   curso»*. **Son dos definiciones del mismo término, en dos capítulos `CURRENT`, y deciden en
   direcciones opuestas sobre el mismo pago.**
7. **Y aunque se elija la lectura del capítulo 09, su remedio está prohibido por escrito.** El
   backstop manda resolver *«por la rama que le corresponda de las cuatro»*, y la rama 2 es
   *«**no se reembolsa: reactiva** … `S5` o `S7`, según el estado»* (`B/12` §5.3). Reactivar una
   fila que tiene una sucesora con `sucede_a` apuntándola es exactamente lo que `G-R1-D` declara
   defecto. El backstop y el guard se anulan mutuamente.
8. **El otro detector también se apaga, y por la misma columna.** La fila `authorized` ×
   `GRACE_PERIOD`·`SUSPENDED` del §10.1 —*«divergencia real … Marca»*— lleva desde esta tanda la
   salvedad *«**Salvo que la fila sea la predecesora de una sucesión en curso con un pago pendiente
   por `S19`**»* (`B/03` §10.1). Con `sucede_a` eterno la salvedad es permanente: el preapproval
   sigue `authorized` y nuestro estado dice `GRACE_PERIOD`, y nada lo marca nunca.
9. **El alcance no es un borde.** `B/03` §3.3.1 trata abandonar el checkout como una salida
   **normal y ofrecida**: *«en el primero tiene un checkout abierto que puede terminar o abandonar
   —y abandonarlo lo deja en `ABANDONED`, desde donde sí puede elegir otro—»*. Todo cliente que
   alguna vez abandonó un cambio de plan entra en esta población, y no sale.

**Dónde lo permite el diseño.** `HOS-1354/docs/02-modelo-de-datos.md` §2.2 (la partición en tres
por columna, y *«la limpia `S18`»*); `HOS-1354/docs/03-maquinas-de-estado.md` §3.2 (`S3`, `S5`,
`S6`, `S7`, `S18`, `S19`) y §10.1 (la salvedad nueva);
`HOS-1354/docs/12-suscripcion.md` §5.3 (las cuatro ramas y su rama 2);
`HOS-1354/docs/09-conciliacion.md` §3 (el backstop y su lectura opuesta);
`HOS-1354/docs/20-testing.md` §2 (`G-R1-D`);
`HOS-1352/docs/nucleo/03-maquinas-de-estado.md` §1 regla 7 (el booleano que separa `S5` de `S19`,
enunciado con el mismo término sin calificar).

**Severidad.** `CRITICA`. Es plata acreditada del cliente que no vuelve y no compra nada, sobre el
único camino que el diseño le ofrece a alguien en mora, con la población entera de los que alguna
vez abandonaron un checkout. Y de yapa reabre `R-SUB-01` por la puerta de al lado: una fila
congelada en `GRACE_PERIOD` con `S6` apagado tiene **servicio completo sin cota** (§20), que es
literalmente lo que `B/12` §4 existe para demostrar que no puede pasar.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: 12** (`S19` más la condición en `S5`, `S6` y `S7`,
commit `99e9d4e24`), con el reparto del 10 debajo. La tanda hizo dos cosas correctas y una a medias:
partió `S17` de `S18` para que el cierre fuera **alcanzable**, y recorrió el dominio **de la
predecesora**. El eje que no recorrió es el tercero: **qué pasa con `sucede_a` cuando la que muere
es la SUCESORA**. `B/16` §4.2 —del commit anterior, `3692d5deb`— sí lo recorrió y por eso escribió
*«y **no hay una fila viva** con `sucede_a` apuntándola»*, nombrando explícitamente el caso: *«si la
sucesora abandona el checkout (`S3` → `ABANDONED`), deja de ser fila viva y el addon pasa a huérfano
sin que nadie declare nada»*. **La mitad «fila viva» existía, estaba escrita, y `S19` no la copió.**

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No, y hay que decir por qué.** El término
redefinido es `sucede_a` / *«sucesión en curso»*. El commit `99e9d4e24` tocó `B/02`, `B/03`, `B/05`,
`B/09`, `B/12`, `B/19`, `B/20` y tres archivos del núcleo: **los dos lados de la contradicción —`S19`
en `B/03` y el backstop en `B/09`— están adentro de los capítulos que el commit tocó**, así que la
búsqueda «sobre los capítulos que el commit NO toca» no los cruza. Lo que sí lo habría encontrado es
un grep de *«fila viva»* **sobre los archivos tocados**: `NUCLEO/01` §2.4 —tocado por ese mismo
commit— enumera *«los **cinco** predicados de billing que la necesitan»* y `S19` es un **sexto** que
la necesita y no figura. **La regla apunta al lugar equivocado: el peligro no es el capítulo
intacto, es el predicado nuevo que nadie agregó a la lista del término.**

---

### F-8dB1-002 — Con la predecesora muerta y la sucesora esperando, el candado `A` queda LIBRE y el propio diseño manda al cliente a dar un alta nueva: quedan dos autorizaciones cobrando, y `S18` no puede volver a ejecutarse nunca porque la base rechaza su escritura

**Qué se rompe.** El doble cobro literal, por el camino que `B/12` §4.4 le indica al cliente con
todas las letras. Y el daño no se repara solo: cuando la sucesora autoriza, `S18` intenta limpiar
`sucede_a` y **la base rechaza la escritura**, porque al hacerlo la sucesora pasa a competir por el
candado `A` con la fila que el cliente creó en el medio. La sucesión queda abierta para siempre, el
cliente no puede volver a cambiar de plan, y los dos preapprovals cobran todos los meses.

**El camino.**

1. Cliente `ACTIVE`. Declara un cambio de plan: `S1`, la sucesora nace en `PENDING_AUTHORIZATION`
   con `sucede_a` apuntando a la predecesora, y ocupa el candado `B` (`B/02` §2.2).
2. **La predecesora se muere sola, dentro de la ventana, por uno de tres caminos que la propia
   tanda enumeró**: `S12` (llega la fecha de fin de servicio, camino del arrepentimiento), `S13`
   (*Free Forever*) o `S16` (el primer cobro de esa autorización se rechaza, que `PA-3` mide *«entre
   26 y 44 minutos»* después de autorizar, *«y en esa media hora un cambio de plan es legal»*)
   (`B/03` §3.2, la tabla de las seis, filas 4, 5 y 6).
3. **Ahí el candado `A` queda vacío, y es aritmética de los índices.** `A` es
   *«`UNIQUE (user_id, vertical) WHERE clase = principal AND sucede_a IS NULL AND estado ∈
   {vivos}`»* (`B/02` §2.2). La predecesora ya no es viva; la sucesora tiene `sucede_a` **no nulo**,
   así que **cae en `B` y no en `A`**. Ninguna fila ocupa `A`.
4. **El diseño manda al cliente a dar el alta nueva, y lo repite tres veces.** Para `S16`:
   *«no hay servicio, no hay autorización y no hay vuelta: **el reintento es un alta nueva**»*
   (`B/03` §3.2); *«`CHARGE_DECLINED` es terminal y **no vivo**: el reintento entra como alta nueva
   **sin pelear contra ninguna restricción**»* (`B/12` §4.3); *«la superficie tiene que ofrecer
   **empezar de nuevo**, no “reintentar el pago”»* (`B/12` §4.4, consecuencia 1).
5. **La base la acepta.** `S1` exige *«no hay otro **origen** vivo para ese `user + vertical`»*
   (`B/03` §3.2) y no hay ninguno. La fila nueva nace con `sucede_a` nulo y ocupa `A`.
6. **Y el texto que decía que esto no podía pasar es falso desde que los candados son dos.**
   `B/03` §3.4 punto 4: *«**no** se crea otra. Se reusa la vigente si le queda ventana … **el candado
   `A` de `B/02` §2.2 incluye `PENDING_AUTHORIZATION` entre los vivos, así que el segundo `INSERT`
   lo rechaza la base**»*. Eso sólo vale si la fila pendiente ocupa `A` — y **una sucesora nunca
   ocupa `A`**.
7. **Las dos autorizan y las dos cobran.** `S2` no tiene condición (`—`, `B/03` §3.2). La sucesora
   entra a `ACTIVE` con su fecha de primer cobro posterior al vencimiento de su ventana (`D8`); el
   alta nueva entra a `ACTIVE` con la suya. Son dos preapprovals autorizados sobre el mismo
   `user + vertical`, y *«`EX-6` mide que el proveedor no frena la segunda»* (`B/02` §2.2).
8. **Y el cierre pasa a ser imposible, que es lo que lo vuelve permanente.** `S18` tiene que
   *«limpiar `sucede_a` en la sucesora»*; al hacerlo la sucesora queda con `sucede_a IS NULL` y
   `ACTIVE`, o sea **colisiona con el alta nueva en el candado `A`**, que es un `UNIQUE`. La base
   rechaza. `S18` es *«el único acto»* que cierra, así que `sucede_a` queda eterno, el candado `B`
   queda consumido —*«nadie podía cambiar de plan dos veces»* (`B/03` §3.2)— y la fila cae además
   en `F-8dB1-001`.
9. **El invariante que esto rompe está enunciado y contado.** `B/02` §5: *«8 · máximo una
   suscripción principal por vertical … **El invariante cuenta compromisos, no filas**: durante la
   ventana del cambio de plan hay **dos filas y un solo compromiso de pago**»*. Acá hay dos filas
   **y dos compromisos de pago**, y ninguna de las dos claves lo impide.
10. **El detector existe y llega tarde.** `B/09` §3 marca la sucesión abierta sobre una fila muerta,
    pero sólo cuando la sucesora ya no está en `PENDING_AUTHORIZATION` —su excepción es explícita—,
    o sea **después** de que la segunda autorización ya está viva.

**Dónde lo permite el diseño.** `HOS-1354/docs/02-modelo-de-datos.md` §2.2 (los dos índices
parciales) y §5 (el invariante 8); `HOS-1354/docs/03-maquinas-de-estado.md` §3.2 (`S1`, `S2`, `S12`,
`S13`, `S16`, `S18`, y la tabla de las seis transiciones) y §3.4 punto 4;
`HOS-1354/docs/12-suscripcion.md` §4.3 y §4.4;
`HOS-1354/docs/09-conciliacion.md` §3, el bloque de excepción.

**Severidad.** `CRITICA`. Dos preapprovals cobrando sobre el mismo `user + vertical`, en un camino
que el diseño **recomienda por escrito**, y sin reparación posible por las transiciones declaradas.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: 8, rematado por el cierre `1c972a07b`.** Es la
forma nueva del defecto 8 del mapa de la 8-bis-2 (*«la predecesora muere en un estado no vivo →
`S17` inalcanzable → candado `A` vacío»*), y hay que decir qué cambió: antes el candado `A` quedaba
vacío **después** de la sucesión y el `sucede_a` eterno era la causa. Ahora el arreglo hizo el cierre
alcanzable y **declaró que la ventana con `A` vacío es benigna**: *«Esto **no** abre el agujero que
la comprobación vigila: mientras la sucesora no autorizó **no hay dos autorizaciones que puedan
cobrar**, que es la condición del candado `A`»* (`B/09` §3, commit `1c972a07b`). **La afirmación es
verdadera en el instante y falsa sobre la ventana**: mientras `A` está libre se puede crear una
tercera fila que después sí autoriza, y es justo lo que el capítulo 12 le pide al cliente que haga.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí.** El término es *«candado `A`»*.
`1c972a07b` tocó tres archivos —`nucleo/08`, `B/09` y `B/12`— y **no tocó `B/03`**, donde vive la
premisa que la afirmación necesita: el §3.4 punto 4, *«el segundo `INSERT` lo rechaza la base»*. Un
`rg 'candado'` sobre los capítulos intactos la pone en la primera pantalla. **La regla existía y no
se ejecutó.**

---

### F-8dB1-003 — `S18` enumera sus efectos, se declara «el único acto que cierra la sucesión» y la promo no está entre ellos: el cliente que mejora su plan pierde en silencio los cobros con descuento que le quedaban

**Qué se rompe.** Quien tiene un 20 % `forever`, o tres de cinco cobros con descuento pendientes, y
hace un upgrade, **empieza a pagar el precio entero**. Es, con esas palabras, lo que el capítulo que
promete lo contrario declara inadmisible: *«Sin esa herencia el upgrade destruiría la promo en
silencio — que es exactamente la **destrucción silenciosa de bienes pagados** que el rediseño del
candado vino a cerrar»* (`B/14` §2.2).

**El camino.**

1. **`B/14` §2.2 declara el resultado y no el acto.** *«El veredicto es el mismo en las dos
   direcciones y el mecanismo no. En el downgrade el contador sigue donde estaba porque **la fila
   sobrevive**; en el upgrade, porque **la sucesora lo hereda**»*. *«Hereda»* no nombra ninguna
   transición, ninguna columna y ningún acto.
2. **El dato que habría que mover existe y cuelga de la fila vieja.** `promo_redemption` guarda
   *«código, user, cuándo, **sobre qué suscripción**»*, con `UNIQUE(promo_code_id, user_id)`
   (`B/02` §2.4). El upgrade *«cancela y recrea: la fila que llevaba la promo **es sucedida por
   otra**»* (`B/14` §2.1), así que la redención sigue apuntando a la predecesora `CANCELLED`.
3. **`S18` enumera sus efectos y son tres.** *«**cierra la sucesión, y es el único acto que lo
   hace**: se escribe `sucedida_por` en la predecesora, se limpia `sucede_a` en la sucesora, y **los
   complementos** de la predecesora se re-apuntan a ella (`B/16` §4.2)»* (`B/03` §3.2). **La promo no
   es uno de los tres.** Lo verifiqué con `rg re-apunt|hereda` sobre los trece capítulos y el
   núcleo: **el re-apunte se declara como efecto en dos lugares y los dos son el addon** (`B/03`
   §3.2 y `B/16` §4.2/§4.3); para la promo, la única aparición es el *«lo hereda»* de `B/14` §2.2.
4. **Y la regla que decide qué pasa con lo no declarado la invoca el propio §3.2 contra sí mismo**,
   dos párrafos más abajo: *«La regla que lo impide tiene que estar en esta tabla, **no sólo en la
   prosa de otro capítulo**, y ésa es la regla 1 del núcleo: **lo que la tabla no declara, no
   pasa**»* (`B/03` §3.2, justificación de `S19`). Aplicada acá, la herencia de la promo no pasa.
5. **El monto ya está mutado del lado equivocado.** `DEC-MP-001` aplica el descuento **mutando el
   monto en el proveedor** (`B/14`, tabla de apertura), y ese monto vive en el preapproval de la
   predecesora, que `S17` cancela. La sucesora nace con el precio de lista. El cliente no ve nada:
   *«mutar el monto **no emite webhook**»* (`EX-15`), y el aviso del §29 no corre porque no hubo
   aumento de precio.
6. **No hay detector.** El barrido compara *«monto vigente | `transaction_amount`»* (`B/09` §3), y
   los dos coinciden: el monto vigente de la sucesora **es** el de lista. La divergencia es contra
   lo pactado, no contra el proveedor.

**Dónde lo permite el diseño.** `HOS-1354/docs/03-maquinas-de-estado.md` §3.2 (`S18` y sus tres
efectos; la invocación de la regla 1); `HOS-1354/docs/14-promos-cortesias-y-grants.md` §2.1 y §2.2;
`HOS-1354/docs/02-modelo-de-datos.md` §2.4 (`promo_redemption`);
`HOS-1352/docs/nucleo/03-maquinas-de-estado.md` §1 regla 1.

**Severidad.** `CRITICA`. El cliente paga de más, todos los meses, por el acto con el que decidió
gastar más, y el propio capítulo nombra el daño y lo declara cerrado.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: 10**, y de una forma que hay que precisar porque
**contradice una cita ajena**. `F-8cB2-010` de la 8-bis-2 afirma que *«el re-apuntado de la sucesión
se escribió para addons **y promos**»*. **Verificado contra el texto, no es así**: `B/14` §2.2
declara un resultado (*«la sucesora lo hereda»*) y ninguna transición lo ejecuta, ni antes ni ahora.
Lo que el arreglo 10 cambió es peor que dejarlo igual: **promovió al addon** —*«El re-apunte es un
efecto declarado de `S18`, y por eso el orden dejó de importar»* (`B/16` §4.2)— y con eso convirtió
una omisión compartida en una **enumeración cerrada de tres efectos** donde la promo quedó afuera por
escrito, en la misma fila que se declara *«el único acto»*.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí.** El término redefinido es *«sucesora»* /
*«se re-apuntan»*. El commit `3692d5deb` tocó `B/02`, `B/03`, `B/05`, `B/09`, `B/16`, `B/20`, el
contrato y dos del núcleo; **no tocó `B/14`**, y un `rg 'sucesora'` sobre los capítulos intactos
devuelve la línea *«en el upgrade, porque la sucesora lo hereda»* de `B/14` §2.2 — que es, palabra
por palabra, la premisa que la enumeración de `S18` vuelve falsa. **La regla existía y no se
ejecutó.**

---

## ALTA

### F-8dB1-004 — Las cuatro ramas de cierre se enumeraron sobre la tabla del §3.2 y la baja que decide el proveedor no está ahí: el pago pendiente del cliente en mora queda sin rama, y es justo la salida esperada de esa población

**Qué se rompe.** El cliente al que el proveedor le da de baja la suscripción por impagos
acumulados —que es **exactamente** la población que llega a `S19`, porque llega desde
`GRACE_PERIOD`— pierde la cobertura en plena sucesión con un pago acreditado retenido, y su pago no
cae en ninguna de las cuatro ramas. El backstop tampoco lo alcanza: su condición es *«la sucesora
murió, o la sucesión se cerró»*, y acá la sucesora está viva y la sucesión abierta.

**El camino.**

1. La predecesora está en `GRACE_PERIOD` con una sucesión en curso y un pago pendiente por `S19`.
2. **El proveedor la cancela por su cuenta, y el diseño lo declara esperable**: *«Si el proveedor da
   de baja la suscripción por su cuenta tras acumular impagos, **eso es un hecho suyo** … La
   consecuencia operativa hay que decirla: en el camino de mora, **cuándo se termina el vínculo no
   lo decidimos nosotros**. Nuestro grace puede ser más largo que la paciencia del proveedor»*
   (`B/12` §1.4). Y `GR-3` —su política de reintentos— *«sigue `UNKNOWN`»* (§1.5), así que no hay
   forma de acotar cuándo.
3. **Espejarlo es una transición declarada y no figura en la tabla del §3.2.** `B/03` §10.1:
   *«`cancelled` | cualquier estado vivo que no sea `CANCEL_SCHEDULED` | **`S12`** si hay una baja
   programada; si no, **espejar la baja decidida por el proveedor**»*, con la regla de cierre
   *«**Espejar un estado leído por id es una transición declarada de esta tabla**, no un acto
   aparte»*. Es una transición de la tabla que **no tiene fila numerada** en el §3.2.
4. **Y el dominio de las cuatro ramas se recorrió sobre el §3.2.** *«El dominio es el de las formas
   en que una sucesión en curso puede terminar, y **son cuatro**. Las enumeré sobre `B/03` §3.2,
   recorriendo las salidas de la predecesora (en `GRACE_PERIOD` o `SUSPENDED`) y las de la sucesora
   (en `PENDING_AUTHORIZATION`)»* (`B/12` §5.3). Conté yo las salidas de una predecesora en
   `GRACE_PERIOD` con `S6` bloqueado: `S13` (rama 4), `S17` (rama 1) y **el espejo del §10.1**, que
   no está en las cuatro. Para la sucesora conté cuatro salidas —`S2` (rama 1), `S3` (rama 2), `S13`
   (rama 4) y el mismo espejo del §10.1, porque `PENDING_AUTHORIZATION` es un estado vivo—, y la
   rama 2 nombra sólo `S3`.
5. **Mientras tanto el cliente deja de estar cubierto y ya pagó.** `CANCELLED` *«no emite»* y
   `PENDING_AUTHORIZATION` *«no emite»* (`12-contrato…` §2.6), así que la garantía que ese mismo §
   da —*«a quien está cambiando de plan **lo sigue cubriendo su suscripción vieja**»*— se cae en
   esta rama, con el pago del período acreditado en nuestra cuenta.
6. Si después la sucesora abandona, el backstop sí corre y manda a la rama 2 —*«reactiva»*—, que
   sobre una `CANCELLED` es imposible por la condición 1 de `B/05` §3. Cae en *«si la rama no es
   determinable, se pone la **marca**»*, o sea en una persona, sin que ningún texto lo anticipe.

**Dónde lo permite el diseño.** `HOS-1354/docs/12-suscripcion.md` §5.3 (la tabla de cuatro ramas y
su método de enumeración) y §1.4; `HOS-1354/docs/03-maquinas-de-estado.md` §10.1 y §3.2;
`HOS-1354/docs/09-conciliacion.md` §3 (el backstop y su condición);
`12-contrato-de-cobertura.md` §2.6.

**Severidad.** `ALTA`. Hay plata retenida y cobertura perdida sobre el camino normal de una
población conocida, pero el desenlace termina en una persona mirando el caso en vez de en una
pérdida irreversible, y el tramo sin cobertura está acotado por la ventana de 72 h.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: 13** (el disparador del reembolso pasa al cierre,
con las cuatro ramas, commit `99e9d4e24`). La enumeración es nueva, se declara completa y declara su
método; **el método es el que falla**, porque recorre la tabla del §3.2 y el propio §10.1 dice que
hay transiciones de esa tabla que no están escritas ahí.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término redefinido es *«cómo termina
la sucesión»*, y el capítulo que aporta la quinta forma —`B/03` §10.1— **es uno de los que el commit
tocó**. Igual que en `F-8dB1-001`, la regla mira afuera y el defecto está adentro. Lo que sí lo
habría encontrado es una pregunta de método, no de búsqueda: *«¿la tabla sobre la que estoy
enumerando es la tabla completa?»* — y el §10.1 la contesta en una línea que dice que no.

---

### F-8dB1-005 — Un pago manual retenido por `S19` no se puede reembolsar: `refund` cuelga de `payment`, un pago manual no es un `payment`, y la rama 1 promete devolverlo igual

**Qué se rompe.** El cliente que paga por transferencia —el camino del §30, con `MP1`— entra al
mismo mecanismo de pago pendiente, y cuando la sucesión se cierra por la rama 1 el diseño manda
devolverle la plata. **No hay entidad donde registrar esa devolución ni transición que la ejecute**,
así que el período que `S17` se llevó puesto queda cobrado y sin asiento de reversa.

**El camino.**

1. **`MP1` entra al carril de `S19` por decisión explícita de esta tanda**: *«la suscripción sale de
   `GRACE_PERIOD` por `S5` — **o queda pendiente por `S19`, si es la predecesora de una sucesión en
   curso**: el efecto de `MP1` es el de `S5` y hereda su condición, porque el daño no depende de por
   qué puerta entró el pago»* (`B/03` §3.2).
2. **La rama 1 manda devolver**: *«la sucesora autoriza (`S2`) → `S17` mata a la predecesora y `S18`
   cierra | **se reembolsa, y lo confirma una persona** (`DEC-RF-002`)»* (`B/12` §5.3).
3. **`refund` referencia un `payment`, y son entidades distintas.** `B/02` §2.3: `refund` guarda
   *«**pago**, monto, motivo, estado, quién lo confirmó»*; `manual_payment` guarda *«suscripción,
   estado del cap. 03 §7, quién lo registró, cuándo, comprobante»*. Son dos filas de la misma tabla
   de entidades, sin vínculo entre ellas.
4. **Y un pago manual no puede ser un `payment`, por la razón que el corpus ya escribió para otro
   caso**: *«un `payment` es el registro de **un hecho en el proveedor**, con su identificador y su
   fecha (cap. 02 §2.3)»* (`B/16` §3.1). Un pago manual no tiene hecho en el proveedor.
5. **La máquina de pago tampoco lo cubre.** El §6 da `P3`/`P4` —reembolso total y parcial— sobre la
   máquina de `payment`; la del pago manual (§7) tiene tres transiciones —`MP1`, `MP2`, `MP3`— y
   **ninguna de reversa**.
6. `DEC-RF-002` enumera con cuidado lo que no decide y las tres ramas que no devuelven plata, y
   **no distingue la puerta por la que entró el pago** — que es justo la distinción que `MP1`
   declaró irrelevante *«porque el daño no depende de por qué puerta entró»*. El daño no; **el
   remedio sí**.

**Dónde lo permite el diseño.** `HOS-1354/docs/02-modelo-de-datos.md` §2.3;
`HOS-1354/docs/03-maquinas-de-estado.md` §3.2 (`MP1`), §6 y §7;
`HOS-1354/docs/12-suscripcion.md` §5.3, rama 1; `01-decision-log.md`, `DEC-RF-002`.

**Severidad.** `ALTA`. Es plata del cliente que el diseño declara devolvible y no tiene cómo
devolver ni cómo asentar; no la subo a `CRITICA` porque una persona puede transferirla por fuera —el
reembolso ya es manual por `DEC-RF-002`— y lo que falta es el registro, no necesariamente el dinero.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: 12 y 13.** `MP1` heredó la condición de `S5` en
`99e9d4e24` y las cuatro ramas son del mismo commit. Antes de la tanda, un pago manual en grace
simplemente reactivaba y no había nada que devolver.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término es *«el pago pendiente»* /
*«se reembolsa»*, y `B/02` §2.3 —donde vive `refund`— **fue tocado por el mismo commit**. Y hay una
señal de que se miró y no alcanzó: `DEC-RF-002` cita `B/02` §2.3 por **otra** carencia de la misma
fila (*«no guarda el id del refund»*) y la descarta diciendo que *«la rama automática exigía además
esa columna; la manual no»*. Se leyó la entidad y se miró una sola columna.

---

### F-8dB1-006 — «La devolución no es instantánea» quedó escrita sólo en el capítulo que decide: las dos superficies que emiten el aviso —nombradas dos párrafos antes— siguen prometiendo la devolución a secas

**Qué se rompe.** El correo que el cliente recibe antes de confirmar el cambio de plan le dice *«si
termina el checkout **se le devuelve**»* y no dice cuándo. `DEC-RF-002` puso esa devolución en manos
de una persona, y el propio `B/12` §5.3 declara que **el aviso es donde el precio de esa decisión se
acota**. El aviso, tal como está escrito en los dos lugares donde vive, no lo acota.

**El camino.**

1. **El requisito está escrito y su razón también**: *«**Y tiene que decir que la devolución no es
   instantánea**, porque `DEC-RF-002` la puso en manos de una persona … un cliente que sabe que la
   devolución lleva unas horas espera; uno que la esperaba en el acto reclama. **Sin esta frase el
   correo promete algo que la decisión no da**»* (`B/12` §5.3, commit `1c972a07b`).
2. **El mismo § nombra las dos superficies espejo, dos párrafos más arriba**: *«Alcanza a
   `NUCLEO/07` §6, fila «cambio de plan con una cuota en reintento», y a `B/19` §4, fila 15»*.
3. **`1c972a07b` tocó tres archivos y ninguno es ésos**: `nucleo/08-auditoria…`, `B/09` y `B/12`
   (verificado con `git show --stat`).
4. **Y las dos siguen diciendo la promesa sin el plazo.** `NUCLEO/07` §6: *«**si termina el
   checkout, se le devuelve**; si lo abandona, le queda»*. `B/19` §4 fila 15: *«si termina el
   checkout **se le devuelve**, si lo abandona **le queda**»*. Ninguna de las dos menciona que la
   devolución la confirma una persona.
5. **`DEC-RF-002` se apoya en ese aviso para aceptar su propio costo**: *«El costo, aceptado con los
   ojos abiertos: la persona **espera a que alguien mire**, y este es un camino **normal** … **Se
   acota avisándolo en el mismo correo**»*. La acotación no existe en el correo.

**Dónde lo permite el diseño.** `HOS-1354/docs/12-suscripcion.md` §5.3;
`HOS-1352/docs/nucleo/07-outbox-y-notificaciones.md` §6, fila *«cambio de plan con una cuota en
reintento»*; `HOS-1354/docs/19-superficies.md` §4, fila 15; `01-decision-log.md`, `DEC-RF-002`.

**Severidad.** `ALTA`. No mueve plata por sí solo; deja sin cumplir la condición bajo la cual una
decisión de owner se aceptó, sobre un camino que la propia decisión declara **normal y frecuente**.
`NUCLEO/07` ya usa esa forma para este mismo correo —*«**El último no es un aviso más: es la
condición bajo la cual se aceptó la decisión**»*—, así que el estándar lo fija el corpus.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el cierre `1c972a07b`.** El requisito nació con él y
nació sin sus dos consumidores.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí, y es el caso más barato de los nueve.** El
término es *«se le devuelve»* / *«reembolso»*; los dos archivos están intactos por ese commit y
además **el propio párrafo anterior los nombra por archivo y por fila**. No hacía falta ni el grep:
alcanzaba con abrir las dos referencias que el texto ya escribió. **La regla existía y no se
ejecutó.**

---

### F-8cB1-011 (sigue llegando, y ahora sostiene plata) — La marca que la rama 1 pone al cerrar la sucesión cae sobre una fila terminal, y el §3 del capítulo 09 ahora enumera sus excepciones y ésa no es una: el reloj de escalada —lo único que garantiza que alguien ejecute el reembolso manual— no corre ahí. Y ningún capítulo dice sobre qué fila va la marca

**Dónde llega ahora.** La contradicción del §3 **sigue textual**, y el arreglo 14 la volvió más
nítida en vez de resolverla: la primera línea ahora **enumera** su única excepción —*«Por cada fila
de nuestro inventario … que no esté en un estado terminal, **más las terminales que la salvedad del
complemento devuelve al barrido**»*— y reafirma *«**Los estados terminales de una SUSCRIPCIÓN no se
barren**: `CANCELLED`, `ABANDONED` y `CHARGE_DECLINED`»*, mientras más abajo el mismo § insiste
*«**Una fila con la marca `requiere_conciliación` SÍ se barre**»*. La fila marcada **no** es la
salvedad del complemento, así que la intersección sigue afirmada en las dos direcciones.

**Lo nuevo es que ahora hay plata colgando de esa intersección.** La rama 1 de `B/12` §5.3 dice
*«al cerrar la sucesión **se pone la marca** y el caso entra al canal de conciliación; el sistema
**no ejecuta el reembolso solo**»*, y lo único que impide que ese caso quede abierto para siempre es
el reloj del capítulo 09: *«**La marca lleva reloj.** Si sigue puesta pasado su plazo, **escala**»*,
que está escrito dentro del § del barrido.

**Y no está declarado sobre qué fila va la marca**, que es la pregunta que decide cuál de los dos
daños toca:

| dónde cae la marca | qué pasa |
|---|---|
| en la **predecesora** —la dueña del pago— | está en `CANCELLED` por `S17`, o sea terminal: no se barre, el reloj no escala, y el reembolso que `DEC-RF-002` volvió obligatoriamente manual **no tiene quién lo recuerde** |
| en la **sucesora** —la fila viva— | queda marcada, y *«mientras esté puesta sobre una fila, **ningún `sucede_a` puede apuntarla**»* (`B/02` §2.2): el cliente que **acaba** de cambiar de plan no puede volver a cambiarlo hasta que una persona resuelva un caso que es de su plata, no de su plan |

Lo busqué: ni `B/12` §5.3, ni `S14`, ni `DEC-RF-002`, ni `B/09` §3 nombran la fila. `S14` dispara
sobre *«cualquiera»*.

**Severidad.** `ALTA`. Sube desde la `MEDIA` de la 8-bis-2 por una razón concreta y no por
insistencia: allá la población era chica y el daño de fondo estaba cubierto por otro job; acá la
intersección es **el único mecanismo de recordatorio** de un reembolso que una decisión de owner
acaba de volver manual sobre un camino declarado normal.

**¿Es nuevo, o es el arreglo?** **Sigue llegando desde la 8-bis-2** (`F-8cB1-011`, arreglo 19), y
**los arreglos 13 y `DEC-RF-002` lo volvieron portante**: le colgaron plata a una contradicción que
ya estaba reportada y no se tocó.

---

## MEDIA

### F-8dB1-007 — La mitad `sucedida_por` de la condición 3 del pago tardío es inalcanzable: la condición 1 excluye toda fila que pueda tenerla, así que el argumento que justificó agregarla es falso

**Qué se rompe.** Nada, en ejecución: la condición falla cerrada. Lo que se rompe es el
razonamiento, y con él la confianza en que el caso está cubierto — que es lo que hace que nadie
vuelva a mirarlo.

**El camino.**

1. La condición 1 exige *«la suscripción existe y está en `GRACE_PERIOD` o `SUSPENDED`»*
   (`B/05` §3), y el capítulo es explícito en que si está `CANCELLED`, `ABANDONED` o ya `ACTIVE`,
   *«el pago no la reactiva»*.
2. `S18` sólo escribe `sucedida_por` sobre una fila cuya condición es *«la predecesora **ya no es
   fila viva**»* (`B/03` §3.2), y las no vivas son exactamente `ABANDONED`, `CANCELLED` y
   `CHARGE_DECLINED` (`B/02` §2.2, `NUCLEO/01` §2.4).
3. `GRACE_PERIOD` y `SUSPENDED` **son** filas vivas, y de los tres estados no vivos no se vuelve
   (`B/03` §3.3: *«`CANCELLED` → cualquier cosa: una suscripción terminada no revive»*;
   *«`ABANDONED` → `ACTIVE`: la ventana venció»*). **Ninguna fila puede tener `sucedida_por` puesta
   y cumplir la condición 1 a la vez.**
4. Y el argumento que la agregó afirma lo contrario: *«Preguntar sólo por `sucede_a` daba «no fue
   superada» justo en el caso en que sí lo fue … Con `sucedida_por` la condición se puede evaluar
   **después** del cierre, **que es cuando llega un pago tardío**»* (`B/05` §3). Después del cierre
   la condición 1 ya dijo que no, sin leer la 3.

**Severidad.** `MEDIA`. No hay daño: las dos condiciones fallan en la misma dirección. Pero
`B/02` §2.2 lista al pago tardío como **consumidor** de `sucedida_por` en su tabla de dos filas, y
`NUCLEO/01` §2.4 lo cuenta como el quinto predicado del término — dos capítulos que apoyan una
columna en un consumidor que no la puede leer.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: 10 y 11**, que reescribieron la condición 3 y su
justificación en el mismo commit (`3692d5deb` la columna, `99e9d4e24` la enumeración de las seis).

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No, y esta vez ni siquiera en principio**: los
dos lados de la contradicción —la condición 1 y la condición 3— son **dos filas de la misma tabla**.
No hay término que buscar en otro capítulo; lo que hacía falta era cruzar la tabla consigo misma.

---

### F-8bB1-009 (sigue llegando) — `G-R1-D` es el tercer guard declarado como propiedad del árbol de fuentes cuyo predicado sólo se puede evaluar sobre una ejecución, y además prohíbe el remedio que el capítulo 09 manda ejecutar

**Dónde llega ahora.** La tanda agregó un guard más a la lista, y es de la misma forma que los tres
que ya venían. `B/20` §1 define la capa: *«**guards** | propiedades del **código**, no de una
ejecución | **el árbol de fuentes, en CI**»*. Y `G-R1-D` dice *«un camino **reactiva** una fila
—`S5`, `S7` o el efecto de `MP1`— **que en ese instante** es la predecesora de una sucesión en
curso … o **reembolsa** el pago que quedó pendiente por `S19` **antes** de que la sucesión se
resuelva»* (`B/20` §2). *«En ese instante»* y *«antes de que la sucesión se resuelva»* son
propiedades de una corrida, no del árbol.

El propio capítulo lo sabe a medias y lo dice para `G-R1-C` —*«Es una propiedad del árbol de fuentes
y **se rompe a propósito comentando una de las dos escrituras**»*— y para `G-R1-D` cierra con
*«**Se rompe a propósito sacándole la condición a una sola de las tres**»*, que **sí** es una
propiedad del árbol: *«los tres call sites llevan la condición»*. O sea que el enunciado y la forma
de romperlo describen dos guards distintos, y el enunciado es el que un implementador va a leer.

Con éste van **tres de los nueve** de la lista del §2 cuyo enunciado no es una propiedad del árbol
de fuentes —`G-R1-B`, `G11` y `G-R1-D`—, contados por mí sobre la tabla vigente, que tiene nueve
filas. **`G-R1-A` salió de la lista y hay que acreditarlo**: la tanda lo re-ancló *«al **ACTO** de
declarar, no una propiedad permanente de la fila»* (`B/20` §2), que sí es del árbol, y explica por
qué con el conteo de las seis transiciones de la ventana. Ése es el arreglo bien hecho de esta
familia.

Y hay un agravante nuevo, que es el paso 7 de `F-8dB1-001`: **tal como está enunciado, `G-R1-D`
prohíbe el remedio que `B/09` §3 manda ejecutar**. No es sólo un guard mal ubicado: es un guard que,
leído literalmente, pone en rojo la rama 2 de las cuatro.

**Severidad.** `MEDIA` como defecto de capa —es el andamiaje, no el daño—, y se vuelve `CRITICA` por
la vía de `F-8dB1-001`, que es donde está reportado.

**¿Es nuevo, o es el arreglo?** **Sigue llegando desde la 8-bis** (`F-8bB1-009`), y **el arreglo 12
le sumó un miembro más** — al mismo tiempo que el arreglo 8 le sacó otro, `G-R1-A`, que sí quedó
bien. El saldo de la tanda sobre este defecto es neutro.

---

## `NUCLEO` — lo que encontré en `docs/nucleo/` y no resuelvo acá

1. **`D15` afirma algo que es falso para toda sucesión que no termina en autorización.**
   `nucleo/04-invariantes.md` `D15` dice ahora *«Y **toda sucesión que termina deja escrito que
   ocurrió**: la predecesora queda con `sucedida_por` puesta»*, apoyado en *«los dos índices
   parciales, más la columna `sucedida_por`»* y en `G-R1-C`. La única escritura de `sucedida_por` es
   `S18`, que exige la sucesora `ACTIVE`: cuando la sucesión termina porque **la sucesora** se murió
   —`S3`, `S13`, o el espejo del §10.1— no queda escrito nada, y `G-R1-C` se cumple de forma vacua
   porque no ocurre ninguna de las dos escrituras. El propio `B/03` §3.2 lo reconoce para `S13`
   —*«la sucesión **no se cierra: se cancela**»*— y `D15` no tiene esa excepción. `MEDIA` como texto;
   es la mitad conceptual de `F-8dB1-001`.
2. **`NUCLEO/01` §2.4 dice «los cinco predicados de billing» y hoy son seis.** La lista enumera
   *«el alcance de `S13`, el de `S17` y la condición de cierre de `S18`, la definición de addon
   huérfano de cap. 16 §4.2, y la condición 3 del pago tardío de cap. 05 §3»*. **`S19` es un sexto
   predicado que necesita el término y no lo usa**, y ése es exactamente el que dejó afuera la
   palabra *«viva»*. El archivo fue tocado por el commit que creó `S19` (`99e9d4e24`, +16 líneas) y
   la lista no se actualizó. `ALTA` como registro: es la lista que hace ejecutable a `DEC-METH-009`
   y quedó corta en el mismo commit.
3. **La regla 7 de `NUCLEO/03` enuncia el booleano con el término sin definir por estado.** La fila
   *«`(GRACE_PERIOD, entra el pago)` | `S5` / `S19` | si la fila **es la predecesora de una sucesión
   en curso**: `S5` exige que no, `S19` que sí»* hereda entera la ambigüedad de `F-8dB1-001`: las
   guardas son disjuntas por construcción **sólo si el término significa lo mismo en las dos**, y el
   corpus le da dos significados. `MEDIA`.

---

## Lo que cae en el hueco del capítulo 13

De mi vector, y sólo lo que **esta pasada** movió:

1. **Cómo se ejecuta y se asienta el reembolso manual de la rama 1** — `DEC-RF-002` declara que
   `B/02` §2.3 *«no guarda el id del refund, que `RF-6` mide necesario para que un reintento no
   devuelva dos veces»* y lo resuelve diciendo que la rama manual no lo necesita. El capítulo 13
   tiene que decir cómo un reintento manual no devuelve dos veces sin esa columna, apoyado en que
   `X-Idempotency-Key` **sí** funciona en reembolso (`RF-4`) aunque no funcione en el alta (`EX-17`).
2. **El reembolso de un pago manual** (`F-8dB1-005`): sin entidad, sin transición y sin hecho en el
   proveedor.
3. **Cuántos días son «pocos» para la ventana reducida de `B/12` §5.4** — sigue siendo *«un número,
   no un mecanismo»*, y ahora además es lo único que impide que el pago de `S19` y la renovación de
   la predecesora caigan en la misma ventana.

---

## Cómo dio la medición que esta pasada existe para producir

| | 8-bis | 8-bis-2 | **8-bis-3 (`B1`)** |
|---|---|---|---|
| hallazgos | 14 | 12 | **9** — 7 nuevos + 2 que siguen llegando |
| `CRITICA` · `ALTA` · `MEDIA` · `BAJA` | 7 · 5 · 2 · 0 | 5 · 5 · 2 · 0 | **3 · 4 · 2 · 0** |
| **`CRITICA` atribuidos a la tanda anterior** | 6 de 7 | 5 de 5 | **3 de 3** |
| **`CRITICA` que el grep de `DEC-METH-009` habría encontrado** | — | — | **2 de 3** |

Los conteos de las dos primeras columnas salen de la tabla final de mi informe de la 8-bis-2 y de
la de la 8-bis; los de la tercera los conté sobre este archivo.

### Lo que la regla acertó, y es real

`DEC-METH-009` **funciona donde su premisa se cumple**, y hay que decirlo antes de la crítica:
`F-8dB1-002`, `F-8dB1-003` y `F-8dB1-006` son tres defectos que un `rg` de una línea sobre los
capítulos intactos pone en pantalla, y el tercero ni siquiera necesita el grep porque **el propio
párrafo del arreglo nombra los dos archivos por ruta y por fila**. Tres de siete es mucho para una
regla que cuesta una búsqueda.

### Dónde no llega, y es una forma distinta de defecto

| # | hallazgo | término redefinido | ¿el commit tocó el capítulo del defecto? | ¿lo encontraba el grep? |
|---|---|---|---|---|
| 001 | `sucede_a` sin limpiador | `sucede_a` / *«sucesión en curso»* | **sí**, los dos lados (`B/03` y `B/09`) | **no** |
| 002 | candado `A` libre | *«candado `A`»* | no (`B/03` intacto en `1c972a07b`) | **sí** |
| 003 | la promo fuera de `S18` | *«sucesora»* / *«re-apuntan»* | no (`B/14` intacto) | **sí** |
| 004 | la quinta forma de terminar | *«cómo termina la sucesión»* | **sí** (`B/03` §10.1) | **no** |
| 005 | reembolso de un pago manual | *«se reembolsa»* | **sí** (`B/02` §2.3) | **no** |
| 006 | *«no es instantánea»* sin consumidores | *«se le devuelve»* | no (`NUCLEO/07`, `B/19`) | **sí** |
| 007 | la mitad inalcanzable de la condición 3 | — | las dos condiciones son **dos filas de la misma tabla** | **no, ni en principio** |

**Los cuatro que se escapan no son el mismo problema que la regla combate, y por eso se escapan.**
`DEC-METH-009` está escrita contra *«el capítulo que nadie miró»*, y estos cuatro son *«el predicado
nuevo que el commit escribió al lado del viejo y no copió su mitad»*. El más limpio es `F-8dB1-001`:
`B/16` §4.2 y `S19` están **en el mismo commit**, preguntan lo mismo, y uno dice *«fila viva con
`sucede_a` apuntándola»* y el otro *«una sucesora con `sucede_a` apuntándola»*.

**Y el corpus ya tiene el control que los agarra, sin inventar nada: la lista de `NUCLEO/01` §2.4.**
Ese § enumera *«los cinco predicados de billing»* que usan el término *«fila viva»*, y el commit que
creó el sexto —`S19`— **tocó ese archivo y no lo agregó**. Un `rg 'fila viva'` sobre los archivos
**tocados**, con la pregunta *«¿el predicado que acabo de escribir está en la lista del término?»*,
encuentra `F-8dB1-001` y `F-8dB1-004`. Lo dejo señalado como observación de la medición y no como
propuesta: eso es del owner.

**Un sesgo que hay que declarar antes de leer la tabla**, igual que la vuelta pasada: el §2 de las
instrucciones manda mirar primero los doce arreglos, así que la búsqueda estaba dirigida ahí.
Recorrí también las superficies que la tanda **no** tocó —`B/06`, `B/10`, `B/14`, `B/21`, `B/22`— y
lo que produjeron fue **un** hallazgo (`F-8dB1-003`, que vive entero en `B/14` y llega porque `B/03`
cambió debajo). Los capítulos intactos siguen siendo intactos; lo que cambia es el texto contra el
que se leen.

---

## Ataques que intenté y el diseño resistió

- **Encadenar sucesiones para llegar a tres autorizaciones.** Sigue cerrado: el candado `B` está
  indexado sobre `(user_id, vertical)` y no sobre `sucede_a`, así que *«la segunda sucesora colisiona
  con la primera»* (`B/02` §2.2). Y la columna nueva no lo afloja: *«**Ninguna de las dos claves la
  mira**, y es deliberado: un índice sobre `sucedida_por` volvería a atar una decisión de unicidad a
  un dato histórico»*. Recorrí la cadena A→B→C con las dos columnas y la restricción *«nunca las dos
  puestas en la misma fila»* se cumple en los tres pasos.
- **Dejar los addons huérfanos por el lado del abandono.** `B/16` §4.2 lo resiste bien, y es el
  contraste que usé para medir el resto: la condición lee **las dos columnas** y la mitad de
  `sucede_a` pide **fila viva**, con el caso nombrado (*«si la sucesora abandona el checkout (`S3` →
  `ABANDONED`), deja de ser fila viva y el addon pasa a huérfano sin que nadie declare nada»*).
  Recorrí las tres formas de la relación contra las cinco transiciones de `B/16` §4.3 y no encontré
  hueco. **`F-8cB1-004` de la 8-bis-2 está cerrado de verdad**, y el re-apunte ya no depende del
  orden porque `sucedida_por` no se borra.
- **Dejar al beneficiario de *Free Forever* pagando una sucesora en `PENDING_AUTHORIZATION`.**
  `F-8cB1-002` está cerrado: `S13` alcanza *«toda fila viva del beneficiario en cada vertical que el
  grant ancla — los seis estados, `PENDING_AUTHORIZATION` y `CANCEL_SCHEDULED` incluidos»* y cancela
  el preapproval *«esté autorizado o esperando autorización»*, con la pantalla del §3.4 punto 3
  obligada a retirar el enlace en el mismo acto. Verifiqué los seis estados contra `B/02` §2.2.
- **Re-cancelar un preapproval ya cancelado en el arrepentimiento.** `F-8cB1-008` está cerrado y con
  la medición citada: *«`PA-5` mide que re-cancelar da `400`, así que mandarlo otra vez convertía el
  camino normal en un incidente garantizado … sobre una ya cancelada por decisión de la persona,
  `D7` está cumplido y no hay nada que mandar»* (`B/03` §3.2). La regla está en `S17` y en `S13`.
- **Los dos veredictos opuestos sobre el mismo cobro** (`F-8cB1-005`). Cerrado: `B/05` §3 y
  `B/12` §5.3 ahora dicen lo mismo, la nota *«no bloquea, a propósito»* está retirada con sus tres
  razones desarmadas, y `B/05` nombra `S5` **y** `S7`. Lo verifiqué leyendo los dos textos, no el
  informe que los citaba.
- **Reembolsar al entrar el pago y dejar al que abandona sin el cobro que lo salvaba.** Cerrado por
  el arreglo 13: el disparador es el cierre, y las dos primeras ramas *«son la razón de la regla y
  son opuestas»*. El argumento es correcto; lo que falla es la enumeración (`F-8dB1-004`), no la
  tesis.
- **Suspender a alguien cuyo pago está acreditado.** La condición de `S6` lo impide y el tope es la
  ventana. Resiste **mientras la ventana termine**, que es lo que `F-8dB1-001` rompe por el otro
  lado.
- **Cobrarle dos períodos al que cambia de plan desde grace.** El crédito cero más `D8`
  —*«toda sucesora nace con fecha de primer cobro posterior al vencimiento de su ventana de
  autorización»*— más `G-R1-B` leyendo la fecha **que el proveedor confirmó** lo cierran, y la
  elección de atarlo a la ventana en vez de a un número nuevo está bien argumentada.
- **Meter una sucesión desde una fila marcada.** La excepción de `CANCEL_SCHEDULED` sigue exigiendo
  relectura por id, y el argumento de `D6` (buscador ≠ lectura por id, `RC-1` vs `RC-2`) es correcto.
- **Un reembolso parcial que supere el saldo, y un descuento apilado que dé distinto según el
  orden.** `P5` valida contra el saldo y `B/14` §1.2 es determinista con conmutatividad dentro de
  cada familia. Recalculé 1.000 con 20 % y ARS 100: ARS 700 por el camino declarado y sólo por ése.
- **Cobrar ARS 15 a quien tiene 100 % de descuento.** `B/14` §1.3 valida contra `PC-2` **antes** de
  mutar y cae al mecanismo de cortesía. Resiste.
- **Cobrar durante la discontinuación de una vertical.** `B/10` §4.2 sigue cerrando.
- **Dos fuentes `SUSCRIPCIÓN` de clase `TÍTULO` por un camino que no sea la cancelación fallida.**
  Recorrí las seis transiciones de la ventana contra la tabla de diez estados del contrato §2.6:
  cinco dejan a la predecesora sin emitir y la sexta (`S9`) emite con `tipo: CORTESÍA`. El conteo del
  contrato es correcto. Lo que **no** recorrió es la baja decidida por el proveedor, y eso está en
  `F-8dB1-004`.
- **La cortesía que muere con la predecesora.** Llega igual y está intacta, pero es
  **`F-8cB2-010` de la 8-bis-2** —de otro vector, `ALTA`, sin arreglo en esta tanda— así que no la
  reporto de nuevo. Verifiqué contra el texto la única parte de su atribución que me tocaba y **no
  dio**: afirma que el re-apunte *«se escribió para addons y promos»*, y para la promo nunca se
  escribió (ver `F-8dB1-003`).
- **`C2` contra la rama 1**, buscando dos veredictos para el pago de `S19`: `C2` gobierna la
  cancelación **que pide el cliente** (*«Se pide la cancelación mientras entra un cobro»*), y la de
  `S17` no la pide nadie. No hay choque; el sujeto es otro.

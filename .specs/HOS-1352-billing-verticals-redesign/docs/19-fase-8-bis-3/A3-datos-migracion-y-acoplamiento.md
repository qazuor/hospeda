---
title: "FASE 8-bis-3 · A3 — datos, migración y acoplamiento"
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 8
---

# FASE 8-bis-3 · A3 — datos, migración y acoplamiento

Cuarta pasada A3, sobre el texto que la **9-bis-2** produjo. El vector no cambia: columnas que
hacen falta y no existen, columnas que existen y nadie escribe, datos que dos lugares declaran
distinto, restricciones que no se pueden cumplir, caché e invalidación, y todo punto donde una
épica necesita algo de la otra sin que el contrato lo declare.

Lo que pesa en esta tanda son **cinco cambios de modelo**, y los recorrí uno por uno buscando
consumidores: la entidad nueva `permanent_grant_vertical` con su `UNIQUE`; que `permanent_grant`
**perdió** `plan_id`, `piso_del_trinquete` y `scope`; la columna nueva `sucedida_por`; que
`courtesy_grant` **perdió** `scope`; y que `addon_product.version_id` dejó de ser la referencia
que transporta la fuente `ADDON`.

**Catorce hallazgos: 1 `CRITICA`, 7 `ALTA`, 4 `MEDIA`, 2 `BAJA`.**

**Atribución, que es lo que esta pasada existe para medir.** De los catorce, **doce los introdujo
la tanda de arreglos de la 9-bis-2** y dos son mitad y mitad. El único `CRITICA` **lo introdujo un
arreglo** — los arreglos 4 y 9, que son el mismo cambio de modelo visto desde la entidad y desde
la máquina.

**Y la respuesta a la pregunta que la pasada hace: el grep de `DEC-METH-009` habría mostrado el
único `CRITICA`, y de hecho lo mostró.** La línea de `S13` **se editó en esta tanda** — dice
textual *«cada vertical que el grant ancla (`B/02` §2.4, `permanent_grant_vertical`)»*—, así que
quien aplicó el arreglo 4 llegó hasta ahí y resolvió **la mitad equivocada de la fila**: corrigió
el `desde` (a qué filas alcanza) y no miró el `evento` (cuándo dispara). Eso es un dato útil y es
incómodo: **la regla se ejecutó y el crítico pasó igual**, porque lo que el arreglo 4 creó no es
una aparición nueva de un término — es un **acto nuevo** (anclar una vertical a un grant que ya
existe), y un acto no se encuentra grepeando el nombre de una tabla. El §«Qué mide esta pasada
sobre `DEC-METH-009`» al final lo desarrolla con los catorce.

**Los conteos que uso son míos y los conté sobre el texto**: la tabla de invalidación de `V/02`
§3.2 tiene **10** filas; el catálogo de acciones administrativas de `NUCLEO/08` §3 tiene **12**
filas y la frase *«las doce»* aparece **5** veces (4 en `V/17`, 1 en `B/19`, contadas con `rg`);
la dirección inversa del contrato declara **7** campos en 3 preguntas; `NUCLEO/04` §3 tiene **15**
filas. Los números que no medí yo llevan su fuente.

---

## CRITICA

### F-8dA3-001 — Anclarle una vertical nueva a un grant vivo no cancela la suscripción que el grant pasa a cubrir: `S13` sólo dispara al otorgar, y el beneficiario sigue pagándola todos los meses

**Qué se rompe.** Una persona tiene *Free Forever* anclado en Alojamiento y una suscripción
`ACTIVE` que paga en Gastronomía. `SUPER_ADMIN` le extiende el grant a Gastronomía —que desde el
arreglo 4 es **anclarle un plan**—. Desde ese instante el grant emite en Gastronomía una fuente
`GRANT` de clase `TÍTULO` con `hasta: NO_VENCE`: **tiene todo gratis**. Y su preapproval de
Gastronomía **sigue cobrando todos los meses**, porque la única transición que cancela por un
grant dispara con el otorgamiento y esto no es un otorgamiento. **Paga por lo que le acaban de
regalar**, y nada lo detecta: la fila está `ACTIVE`, el proveedor dice `authorized`, y para el
barrido del cap. 09 eso **coincide**.

**El camino.**

1. El acto existe y está declarado: `12-contrato-de-cobertura.md` §2.8 — *«**un grant no emite
   fuente en una vertical donde no tiene ancla**; extenderlo a una vertical nueva es **anclarle un
   plan**, que es un acto de `SUPER_ADMIN` y queda auditado como cualquier otro»*. `B/02` §2.4 lo
   repite: *«extenderlo a una vertical nueva es anclarle un plan, un acto de `SUPER_ADMIN` que
   queda auditado»*.
2. Anclar hace emitir: `12-contrato…` §2.7, fila `grant` — *«una fuente `VERTICAL` **por cada
   vertical de su scope**, y cada una transporta **el ancla de esa vertical**»*; y §2.4 pone a
   `GRANT` con `NO_VENCE` en la clase **`TÍTULO`**, o sea que **cubre**.
3. La transición que cancelaría la suscripción **no dispara**: `B/03` §3.2, `S13` — `desde` = *«**toda
   fila viva** del beneficiario en **cada vertical que el grant ancla** (`B/02` §2.4,
   `permanent_grant_vertical`)»*, `evento` = *«**`SUPER_ADMIN` otorga *Free Forever***»*. El
   `desde` se corrigió por vertical en esta tanda; el `evento` sigue siendo el otorgamiento.
4. Y la obligación que queda incumplida está escrita en la misma sección: `B/03` §3.2, encabezado
   *«`S13` alcanza a TODA fila viva, no a una»* — *«El §35.3 ordena **«cancelar toda obligación de
   pago cubierta»**, en plural»*. Después de anclar, la obligación de Gastronomía **está cubierta y
   no está cancelada**.
5. El propio § enuncia este desenlace como el daño que vino a cerrar, y lo reproduce por la otra
   puerta: `B/03` §3.2 — *«El beneficiario de *Free Forever* terminaba pagando todos los meses una
   suscripción que el grant le regaló, **y nada lo detectaba**: la fila está `ACTIVE`, el proveedor
   dice `authorized`, y para el barrido eso **coincide**»*.
6. Y no hay una segunda red: `B/14` §4.3 sólo cubre la dirección contraria —*«otorgar un grant
   termina cualquier cortesía vigente»*—, y `NUCLEO/08` §3 no tiene una fila para este acto
   (`F-8dA3-002`), así que tampoco hay confirmación que lo nombre.

**Dónde lo permite el diseño.** `12-contrato-de-cobertura.md` §2.8 (el acto), §2.7 y §2.4 (la
fuente que emite y su clase), `B/02` §2.4 (la entidad y la repetición del acto), `B/03` §3.2
(`S13`, su `evento`).

**Severidad.** `CRITICA`. Alguien paga de más, todos los meses, por un servicio que una decisión
administrativa acaba de declarar gratuito para él. Es literalmente la fila *«mueve dinero»* del
criterio, y el diseño ya la nombra como el modo de falla que `S13` existe para evitar.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 4 y el 9, que son el mismo cambio.** Antes de
esta tanda el grant tenía **un** `plan_id` y un `scope`: no había forma de extenderlo *«a una
vertical nueva»* como acto separado del otorgamiento, porque el scope era una columna del
instrumento. El arreglo 4 convierte el scope en **un conjunto de filas** (`permanent_grant_vertical`)
y declara explícitamente el acto de agregarle una; el arreglo 9 reescribe `S13` para que alcance
*«cada vertical que el grant ancla»* y **no toca su evento**. El acto nuevo nació sin transición.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí — y de hecho lo mostró.** El término
redefinido es `permanent_grant` / su `scope`, y grepearlo sobre los capítulos que el commit del
contrato no tocaba llega a `B/03` §3.2, que es donde vive `S13`. La prueba de que llegó es que
**esa fila está editada en esta tanda** y hoy cita `permanent_grant_vertical` por nombre. Lo que
falló no es la búsqueda: es que *«resolver cada aparición»* se cumplió sobre **la columna `desde`**
y la aparición estaba en una fila con dos columnas que decidían cosas distintas. La regla busca
**términos**; el arreglo 4 creó un **acto**, y un acto nuevo no tiene término que buscar hasta que
alguien le pone nombre.

---

## ALTA

### F-8dA3-002 — Anclar una vertical nueva es «un acto de `SUPER_ADMIN`» que no está en el catálogo de las doce acciones administrativas: sin permiso propio, sin confirmación, y sin nadie a quien esté prohibido

**Qué se rompe.** El único lugar del programa que enumera qué puede hacer un administrador sobre
la cuenta de otro tiene **doce filas**, y este acto no es ninguna. De ahí se cae todo lo que el
diseño le cuelga a esa lista: el permiso propio, la confirmación explícita de algo que mueve
dinero, y la prohibición de que lo ejecute un actor de sistema.

**El camino.**

1. El acto se declara dos veces con las mismas palabras: `12-contrato…` §2.8 — *«es un **acto de
   `SUPER_ADMIN`** y queda auditado **como cualquier otro**»*; `B/02` §2.4 — *«un acto de
   `SUPER_ADMIN` que queda auditado»*.
2. El catálogo es cerrado y lo conté: `NUCLEO/08` §3, **12 filas** (cortesía, grant, pago manual,
   confirmar impago, postulación de Partner, configurar plan de Partner, levantar la marca,
   cancelar, pausar/reanudar, cambiar de plan, extender trial, reembolsar). La fila del grant dice
   *«**otorgar o revocar** un grant permanente»* — otorgar y revocar, no anclar.
3. El número está congelado en **cinco lugares** (contados con `rg`): `V/17` §3.2 regla 1
   —*«**Las doce acciones** del capítulo 08 §3 llevan **permiso propio**, una por una»*—, §3.2
   regla 3 —*«las doce acciones … son **capacidades del actor**»*—, §3.3 —*«**Un actor de sistema
   no puede ejecutar ninguna de las doce acciones**»*—, §3.4, y `B/19` §6 —*«son **las doce** del
   capítulo 08 §3 (núcleo), cada una con permiso propio, auditoría y confirmación explícita»*.
4. Consecuencia de no estar: no tiene permiso propio, así que la regla 1 de `V/17` §3.2 —*«`actor
   ≠ sujeto` exige un permiso **de esa acción concreta**, no una condición general de «es
   administrador»»*— no tiene sujeto; no lleva confirmación, aunque su gemela (revocar) sea *«la
   más grave»*; y `V/17` §3.3 **no se lo prohíbe a un job**, porque la prohibición está escrita
   sobre las doce.
5. Y la auditoría sí lo alcanza, por el criterio y no por la lista: `NUCLEO/08` §1.1 punto 2
   —*«cambia el acceso de alguien»*—. O sea que **quedó auditado y no quedó autorizado**, que es
   la mitad que no alcanza.

**Dónde lo permite el diseño.** `NUCLEO/08` §3 (las doce filas), `V/17` §3.2 y §3.3, `B/19` §6,
contra `12-contrato…` §2.8 y `B/02` §2.4.

**Severidad.** `ALTA`. No hay un camino directo a cobro indebido desde acá —el cobro indebido es
`F-8dA3-001`—, pero el acto que extiende el instrumento más caro del sistema queda sin gate
declarado y sin confirmación, y un actor de sistema no lo tiene prohibido.

**Marcá `NUCLEO`** — la lista de doce vive en `NUCLEO/08` §3.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 4.** El acto no existía antes: con `scope`
como columna del grant, extenderlo era editar el grant y caía bajo *«otorgar o revocar un grant»*.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término redefinido es
`permanent_grant` / `scope` / el ancla, y **ninguno de los tres aparece en `NUCLEO/08` §3**, que
nombra el instrumento en prosa (*«otorgar o revocar un grant permanente»*). Tampoco aparece en las
cinco líneas de *«las doce»*, que no citan ninguna tabla. Para llegar había que grepear **el
número** —`doce`— o razonar *«creé un acto»*, y ninguna de las dos cosas es lo que la regla pide.

---

### F-8dA3-003 — La restricción «el plan del ancla pertenece a esa vertical» obliga a billing a leer `plan.vertical`, que no es ninguno de los siete campos de la dirección inversa: la regla de vigilancia del §4.2 se dispara y nadie la disparó

**Qué se rompe.** El arreglo 4 apoya el invariante §64.10 en una restricción de base de una tabla
de **billing** que sólo se puede evaluar leyendo una columna de una tabla de **verticales** que el
contrato no declara legible. Es exactamente el acoplamiento no declarado que el §4.1 se escribió
para cerrar, reabierto por el arreglo que lo cita.

**El camino.**

1. La restricción: `B/02` §2.4, fila `permanent_grant_vertical` — *«`UNIQUE(permanent_grant_id,
   vertical)`; el plan **no es anulable** y **pertenece a esa vertical**»*. Y §5, invariante 10 —
   *«**`UNIQUE(permanent_grant_id, vertical)` en `permanent_grant_vertical`, más «el plan del ancla
   pertenece a esa vertical»**»*, declarada al nivel **base**.
2. `12-contrato…` §2.8 pide lo mismo y dice dónde tiene que vivir: *«el plan **pertenece a la
   vertical del ancla**, que es la restricción que **la base** tiene que hacer cumplir: sin ella la
   fila mala se sigue pudiendo escribir»*.
3. A qué vertical pertenece un plan es un dato de verticales: `V/02` §2.1, fila `plan` —
   *«identidad y cosmética: **vertical**, slug, nombre… `UNIQUE(vertical, slug)`»*.
4. Y no está declarado como legible: `12-contrato…` §4.1 enumera las tres preguntas de la
   dirección inversa — `políticaDePlan → { díasDeGrace, díasDeTrial, permitePausa, vigente,
   vendible }`, `situaciónDeVertical → { admiteAltas, finDeServicio }`, `direcciónDeCambio → SUBE |
   BAJA`. **`plan.vertical` no está en ninguna de las tres**, y el propio § dice *«Son **siete
   campos** en tres preguntas»*.
5. La regla que esto dispara: `12-contrato…` §4.2 — *«**si billing necesita leer de verticales algo
   que no está en los seis campos del §4.1, vale lo mismo. Una lectura no declarada es un
   acoplamiento que nadie está mirando.**»*
6. Y el §4.1 dice con qué gravedad se lee esto: *«Ése resultó ser **el acoplamiento real entre las
   dos épicas**, con un agravante medido: **dos de las columnas que billing lee no existen**»*. Acá
   la columna existe; lo que no existe es la declaración.

**Dónde lo permite el diseño.** `B/02` §2.4 y §5, `12-contrato…` §2.8, §4.1 y §4.2, `V/02` §2.1.

**Severidad.** `ALTA`. No rompe ejecutando: la restricción es correcta y necesaria. Lo que rompe
es **la única regla que vigila el corte en dos épicas**, que queda con una excepción sin declarar
justo en el invariante que el arreglo presenta como su mayor logro. Y el precedente es caro: la
próxima lectura no declarada no va a tener a nadie que la cuente.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 4.** La restricción nace con
`permanent_grant_vertical`. Con un solo `plan_id` en `permanent_grant` no había ninguna
restricción de pertenencia que enunciar, porque no había dos verticales que confundir.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término redefinido es
`permanent_grant` / `permanent_grant_vertical` / el ancla, y **ninguno aparece en `12-contrato…`
§4.1 ni en §4.2**, que hablan de planes y verticales en abstracto. El grep que sí lo habría
encontrado es el inverso —buscar `plan.vertical` contra la lista de siete campos—, que es una
búsqueda por **consumidor** y no por **término redefinido**. La regla, tal como está escrita, no
la pide.

---

### F-8dA3-004 — El invariante 26 —«la instancia no repite ningún campo del producto», declarado al nivel base— prohíbe exactamente la columna de la que depende el arreglo 6

**Qué se rompe.** El arreglo 6 cierra el caso *«publicar una versión mueve todas las instancias
vivas»* poniendo en `addon_instance` una copia de la versión que el producto vendía el día de la
compra. El invariante 26, declarado en **dos lugares** al nivel **base** —el que el `NUCLEO/04` §1
define como el que *«no admite ningún camino que lo esquive»*—, dice que eso no puede existir.
Quien implemente el invariante como está escrito **borra la columna** y el crítico vuelve entero.

**El camino.**

1. El invariante, en el núcleo: `NUCLEO/04` §2.1 — *«| 26 | producto de addon ≠ instancia de addon
   | **dos tablas, y la instancia no repite ningún campo del producto** |»*.
2. Y en billing, palabra por palabra: `B/02` §5 — *«| 26 · producto ≠ instancia | son dos tablas, y
   **la instancia no repite ningún campo del producto** |»*.
3. La columna que el arreglo 6 necesita **es** una repetición del campo del producto, congelada en
   el momento de la compra: `B/02` §2.4 — *«| **`addon_product.version_id`** | **qué se vende
   hoy**: la versión que **una compra nueva ancla** |»* y *«| **`addon_instance.addon_version_id`**
   | **qué se compró** … **no se mueve**: lo ya comprado no cambia |»*. En el instante de la compra
   las dos valen lo mismo, por construcción: la instancia **ancla lo que el producto vendía**.
4. Y el arreglo lo declara como la única referencia válida: `B/02` §2.4 — *«**La referencia de una
   fuente `ADDON` sale SIEMPRE de la instancia, nunca del producto**»*; `V/02` §2.1 — *«la
   referencia que el contrato transporta para una fuente `ADDON` es la de la INSTANCIA, nunca la
   del producto»*.
5. El desenlace de resolver la contradicción en la dirección del invariante está medido en el
   propio texto: `V/02` §2.1 — *«quien compró *«+30 fotos»* pasaba a tener lo que dijera la versión
   nueva, **sin comprar nada y sin que nadie se lo avisara**»*.

**Dónde lo permite el diseño.** `NUCLEO/04` §2.1 (fila 26), `B/02` §5 (fila 26), contra `B/02`
§2.4 y `V/02` §2.1.

**Severidad.** `ALTA`. No rompe sola: hace falta que alguien resuelva la contradicción, y la
resuelva hacia el invariante. Pero el invariante está en el escalón **base**, que es el que el
`NUCLEO/04` §1 reserva para lo que *«no admite ningún camino que lo esquive»*, y el enunciado hoy
tiene un contraejemplo que el diseño **exige**. Un invariante que el modelo viola no es un
invariante: es una trampa para el que lo implemente.

**Marcá `NUCLEO`** — la fila 26 vive en `NUCLEO/04` §2.1.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 6** (y su antecesor, el 10 de la 9-bis, que
creó la columna). La redacción del invariante 26 es anterior y era cierta: hasta que la instancia
ancló su versión, efectivamente no repetía ningún campo del producto. El arreglo la volvió falsa y
no la tocó.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término redefinido es
`addon_product.version_id` / `addon_instance`, y **`NUCLEO/04` §2.1 no escribe ninguno de los
dos**: dice *«producto de addon ≠ instancia de addon»* en prosa. El grep que lo encuentra es el de
la palabra `instancia`, que no es un término redefinido sino un sustantivo común del dominio — o
sea, el tipo de búsqueda que la regla no distingue de ruido.

---

### F-8dA3-005 — El glosario, que es el capítulo que fija los nombres y prohíbe que otro los redefina, sigue describiendo «Addon: producto» con la duración, los efectos y el tipo de scope adentro

**Qué se rompe.** `NUCLEO/01` abre diciendo *«Este capítulo fija **los nombres**. Todo lo que el
resto de la spec use tiene que estar acá, y **nada de lo que esté acá se redefine en otro
capítulo**»*. Por su propia regla, el glosario gana. Y el glosario dice que el producto guarda lo
que el corte por campo mandó a verticales. Quien modele desde el núcleo pone duración, efectos y
tipo de scope en `addon_product` —una tabla de billing, mutable, re-apuntable— y el corte que
permite *«que un addon otorgue sin que billing intervenga»* no existe.

**El camino.**

1. El glosario: `NUCLEO/01` §1.6 — *«| **Addon: producto** | La definición: **capability, precio,
   recurrencia, verticales compatibles, duración, efectos, tipo de scope** (§39). |»*.
2. El corte dice lo contrario, y enumera campo por campo: `V/02` §2.1 — *«| `addon_version` | qué
   otorga y con qué valores, **vigencia, tipo de scope** | **VERTICALES** | · | `addon_product` |
   **precio, recurrencia, verticales compatibles** | **BILLING** |»*, y el motivo: *«**precio y
   recurrencia son dinero; capability, duración y scope son capacidades**»*.
3. `B/02` §2.4 lo confirma desde el otro lado: *«| **`addon_product`** | **precio, recurrencia y
   verticales compatibles**, más **`version_id`** |»*.
4. Y el singular `capability` del glosario es **el otro defecto que el mismo corte declaró
   cerrado**: `V/02` §2.1 — *«El glosario decía *«**efectos**»* en plural y el modelo instanciaba
   `capability` en singular; **acá se cierra**»*. El glosario que la frase nombra **sigue diciendo
   las dos cosas a la vez**: *«capability … efectos»*, en la misma celda.
5. Lo que el corte compra y esto devuelve: `V/02` §2.1 — *«**Consecuencia útil**: partido así, **un
   addon puede otorgar sin que billing intervenga**»*.

**Dónde lo permite el diseño.** `NUCLEO/01` §1.6 y su regla de apertura, contra `V/02` §2.1 y
`B/02` §2.4.

**Severidad.** `ALTA`. El capítulo que el índice declara ganador en materia de nombres contradice
el corte que separa las dos épicas, en la entidad exacta que el corte movió. No falla ejecutando
porque nadie ejecutó todavía: falla el día que alguien modele.

**Marcá `NUCLEO`.**

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 6** lo dejó vivo y la fila del glosario es de
la FASE 9, cuando se partió `addon_product`. El arreglo 6 de esta tanda es el que vuelve a tocar
las dos columnas de `addon_product` / `addon_instance` y declara que la separación es *«la regla
del catálogo, con las mismas palabras»* — y no releyó la celda que define la entidad.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término redefinido es
`addon_product` y el glosario **no lo escribe**: escribe *«Addon: producto»*. Es el mismo modo de
falla que `F-8dA3-004`, en el mismo capítulo: el núcleo nombra las entidades **en castellano** y el
resto del corpus **en `snake_case`**, así que un grep por nombre de tabla **no entra nunca al
glosario**. Eso no es una falla del que aplicó la regla: es un límite estructural de la regla, y
vale la pena declararlo porque alcanza a las 15 filas de entidades de `NUCLEO/01` §1.

---

### F-8dA3-006 — Una cortesía durante el trial no se puede escribir: `courtesy_grant` exige una suscripción no anulable y quien está en trial no tiene ninguna — y tres capítulos la siguen contando contra el techo

**Qué se rompe.** El §34.1 del PDR —una cortesía durante el trial extiende el trial— sobrevive en
tres capítulos como un camino vivo, incluido el **evento de una transición**. Y la entidad que lo
soportaría no lo admite: `courtesy_grant.subscription_id` **no es anulable**, y el trial existe
precisamente en la ausencia de una suscripción. El acto no tiene fila, así que no se audita, no
tiene origen, y el techo de días que `V/11` §3 construyó **no puede contarlo**.

**El camino.**

1. La entidad, después de `DEC-GRANT-006`: `B/02` §2.4 — *«| **`courtesy_grant`** | beneficiario,
   días o meses, inicio, fin, quién lo firmó, motivo, **la suscripción que pausa** | … **la
   suscripción no es anulable**; **sin `scope`** — la cortesía es por suscripción
   (`DEC-GRANT-006`) |»*. Y el desarrollo: *«Una cortesía cubre **la suscripción que pausa**, y
   nada más»*.
2. La transición la nombra como evento: `V/03` §2 — *«| T4 | `TRIAL_ACTIVE` | **promo de extensión
   o cortesía** | `TRIAL_ACTIVE` | sólo durante `TRIAL_ACTIVE` (§32) | corre la fecha de fin |»*.
3. El techo la cuenta: `V/11` §3.2 — *«Toda extensión cuenta contra ese mismo techo, venga de un
   promo del §32 o de **una cortesía del §34.1**: **se acumulan, y acumulan contra un único
   número**»*. Y §3.5 exige mostrar *«**el total acumulado de días de trial, con su origen**»* —
   origen que sin fila no existe.
4. Billing la declara resuelta allá: `B/14` §4.4 — *«**Extensión de trial + cortesía durante el
   trial** … las dos extienden, **acumulan contra un único techo** configurable por `user +
   vertical`»*.
5. Y `DEC-GRANT-006` **sabe que el §34.1 existe** y lo usa como argumento sin retirarlo: *«el PDR
   trae media respuesta y en dos mecanismos distintos —**§34.1** *«durante trial: extiende el
   trial»*, **§34.2** *«durante subscription: mantiene servicio sin cobrar»*— y **ninguna** para el
   tercer caso»*. La decisión resuelve el tercer caso retirando el `scope`; el primero queda en
   pie y sin entidad.
6. Las dos lecturas posibles son las dos malas: si el §34.1 se instrumenta con `courtesy_grant`,
   **la fila no se puede escribir**; si no se instrumenta con `courtesy_grant`, es un **cuarto
   instrumento sin nombre** y sin tabla, que `NUCLEO/01` §1.5 —que enumera tres concesiones— no
   declara.

**Dónde lo permite el diseño.** `B/02` §2.4 (`courtesy_grant`), `V/03` §2 (`T4`), `V/11` §3.2 y
§3.5, `B/14` §4.4, `DEC-GRANT-006`, `NUCLEO/01` §1.5.

**Severidad.** `ALTA`. Nadie paga de más ni accede de más: lo que falla es que un acto que entrega
servicio gratis —el que `D11` manda que confirme una persona— **no tiene fila donde quedar**, así
que no se audita ni se cuenta contra el único techo que existe. La dirección es la barata (no se
puede hacer) hasta que alguien lo implemente por fuera del modelo, que es cuando se vuelve cara.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: `DEC-GRANT-006`.** La columna no anulable es
anterior, pero mientras `courtesy_grant` tenía `scope` la cortesía todavía se podía leer como un
instrumento sobre un `user + vertical` y el §34.1 tenía dónde apoyarse. La decisión de esta tanda
la ata **enteramente** a la suscripción —*«Una cortesía cubre la suscripción que pausa, y nada
más»*— y con eso el §34.1 se queda sin sujeto.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí.** El término redefinido es
`courtesy_grant` / su `scope`, y grepear `cortesía` sobre los capítulos que el commit de
`DEC-GRANT-006` no toca llega derecho a las tres apariciones: `V/03` §2 (`T4`, el evento
*«cortesía»*), `V/11` §3.2 (*«una cortesía del §34.1»*) y `B/14` §4.4 (*«cortesía durante el
trial»*). Las tres están en la misma frase que la palabra **trial**, que es el dato que las
delata. **La regla existía, alcanzaba, y no se ejecutó sobre este término** — el commit se
concentró en `permanent_grant`, que cambió el mismo día y era el cambio más grande.

---

### F-8dA3-007 — El addon que un beneficiario de *Free Forever* usa a costo cero no tiene dónde decir de qué ancla cuelga, y `B/16` §3.1 afirma que ese campo «ya» existe

**Qué se rompe.** Desde el arreglo 4 un grant es título **en la vertical donde ancló y no en las
otras**. El addon gratuito que cuelga de un grant tiene entonces que decir **de qué ancla**
depende, para que retirar esa ancla lo corte y no corte los de las otras verticales. `addon_instance`
no tiene esa columna, y el capítulo que la usa declara que sí la tiene.

**El camino.**

1. La afirmación: `B/16` §3.1 — *«**Lo que sí se registra es el origen**: la instancia dice que su
   título es **el grant**, del mismo modo que una instancia recurrente dice cuál es su suscripción
   de complemento. **Es un campo que el modelo ya necesita, no uno nuevo.**»*
2. El modelo, completo: `B/02` §2.4 — *«| **`addon_instance`** | producto, **la `addon_version` que
   ANCLÓ al comprarse**, dueño, **objetivo** (ficha, suscripción de vertical, usuario o global),
   estado, inicio, fin, **su suscripción de complemento si es recurrente** |»*. La analogía que
   `B/16` invoca —*«su suscripción de complemento»*— **es** una columna real, y guarda una
   suscripción: **no hay ninguna que pueda guardar un grant ni un ancla**.
3. El consumidor que la necesita: `B/16` §3.3 — *«**Al revocar el grant, el addon se corta** … **la
   fuente era el grant y el grant se fue**»*, y `B/19` §4 fila 13 obliga a que la confirmación diga
   *«qué addons corta»*. Sin la columna, las dos ramas son malas: no cortar ninguno deja
   capacidades gratis después de revocar, cortarlos todos se lleva los que la persona pagó.
4. Y el arreglo 4 le sube la exigencia, porque ahora el título es **por vertical**: `B/16` §2.4 —
   *«**Y vale en la vertical donde el grant ANCLÓ, no en todas** … En una vertical donde no ancló
   nada **no emite fuente**»*. O sea que la columna que falta ya no puede ser *«el grant»*: tiene
   que ser **el ancla**.
5. Y hay un segundo agujero del mismo origen: el predicado de huérfano de `B/16` §4.2 para scope
   `VERTICAL_SUBSCRIPTION` es *«**la suscripción de esa vertical dejó de ser fila viva** y ninguna
   sucesión la releva»*. El beneficiario de *Free Forever* **no tiene suscripción** —el §35.3 la
   canceló y `S13` la ejecuta—, así que el predicado no se puede evaluar sobre su addon: o es
   huérfano desde que nace, o no lo es nunca.

**Dónde lo permite el diseño.** `B/02` §2.4 (`addon_instance`), `B/16` §3.1, §3.3, §2.4 y §4.2,
`B/19` §4 fila 13.

**Severidad.** `ALTA`. La rama fail-open —no cortar— deja capacidades comerciales vivas después de
*«la acción administrativa más grave»* (`NUCLEO/08` §3), o sea acceso a algo que ya no le
corresponde. Lo que la contiene por ahora es que la revocación es un acto humano con confirmación.

**¿Es nuevo, o es el arreglo?** **Mitad y mitad, y la mitad nueva es el arreglo 4.** La afirmación
falsa de `B/16` §3.1 —*«un campo que el modelo ya necesita»*— es anterior a esta tanda y nadie la
reportó. Lo que el arreglo 4 agrega es que el referente **cambió de grano**: ya no alcanza con
*«el grant»*, hace falta *«el ancla»*, y `B/16` §2.4 se editó en esta tanda para decir exactamente
eso sin mirar qué guarda la instancia.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término redefinido es
`permanent_grant` / el ancla, y grepearlo llega a `B/16` §2.4 —que efectivamente se corrigió— pero
**no llega a `B/16` §3.1 ni a `B/02` §2.4 fila `addon_instance`**, que hablan de *«el grant»* y de
*«su suscripción de complemento»* sin nombrar ninguna tabla redefinida. La aparición que había que
resolver no contenía el término.

---

### F-8dA3-008 — Discontinuar una vertical no toca los grants, y `PB2` dispara por el CAMBIO de `cubierto`: la ficha del beneficiario de *Free Forever* queda publicada después del fin de servicio

**Qué se rompe.** El día del fin de servicio de una vertical discontinuada, el capítulo declara
que *«las fichas pasan a `UNPUBLISHED_BY_BILLING` por `PB2`»*. Para el beneficiario de un grant
anclado en esa vertical, `cubierto` **no cambia** —el grant emite con `hasta: NO_VENCE` y nadie lo
apagó—, así que `PB2` **no dispara** y su ficha sigue pública en una vertical que la plataforma
dejó de prestar, sin pricing, sin sección de Mi Cuenta y sin nadie que la sostenga.

**El camino.**

1. Lo que el corte hace: `B/10` §4.3 — *«**Día 0 — el anuncio.** La vertical deja de admitir altas
   y trials. Y en el mismo acto, **cada suscripción viva se cancela en el proveedor de
   inmediato**»*, y *«**El día del fin de servicio.** Las fichas pasan a `UNPUBLISHED_BY_BILLING`
   **por PB2** del capítulo 03 §9»*.
2. Lo que el corte **no** toca: conté las apariciones con `rg` sobre `B/10` — **cero** menciones de
   `grant` y **cero** de `Free Forever`. Un grant no es una suscripción, así que *«cada suscripción
   viva se cancela»* no lo alcanza.
3. `PB2` ya no se dispara por una lista: `V/03` §9 — *«| PB2 | `PUBLISHED` | **`cubierto` pasa a
   falso** | `UNPUBLISHED_BY_BILLING` |»*, y el § lo subraya: *«**`PB2` y `PB3` se disparan por el
   CAMBIO de `cubierto`, no por una lista de transiciones**»*.
4. Y el grant sigue cubriendo: `12-contrato…` §2.4 pone `GRANT` + `NO_VENCE` en clase **`TÍTULO`**;
   §2.8 dice que resuelve *«la versión vigente del plan que ancló, **sea vendible o no**»*, y
   `B/10` §4.1 aclara que discontinuar **no borra los planes** —*«La fila de `vertical` no se borra
   nunca»* (§4.5.4)—, así que la referencia sigue resolviendo perfectamente.
5. El resultado contradice la regla que ordena la sección: `B/10` §4.2 — *«**Se deja de cobrar
   antes de dejar de prestar. Nunca al revés.**»* Acá no se deja de prestar nunca, para ese
   beneficiario.

**Dónde lo permite el diseño.** `B/10` §4.3, §4.2 y §4.5, `V/03` §9 (`PB2`), `12-contrato…` §2.4 y
§2.8.

**Severidad.** `ALTA`. La dirección es la barata —se presta de más, no se cobra de más— pero el
efecto es público: una ficha visible de una vertical que el producto declaró terminada, sin fecha
de salida y sin mecanismo que la baje. Y no es hipotético para un solo caso: `B/21` §2.4 escribe
las **dos** cortesías heredadas del owner **como `permanent_grant`**, así que los primeros grants
del sistema existen desde la mañana del corte.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 4.** Con `permanent_grant` sin plan anclado, el
grant no tenía referencia resoluble y `12-contrato…` §2.3 no lo dejaba emitir fuente; el problema
no tenía sujeto. Al darle un ancla por vertical con `NO_VENCE`, el grant pasa a ser el único título
del sistema que **ninguna transición apaga** y que **ninguna fecha vence** — y el único caso donde
`PB2`, que se rediseñó para no depender de listas, se queda sin disparador.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término redefinido es
`permanent_grant` / el ancla, y `B/10` §4 **no lo escribe** (medido: cero apariciones de `grant` en
todo el capítulo). La aparición que había que encontrar es la **ausencia** de una, que es
precisamente lo que un grep no devuelve.

---

## MEDIA

### F-8dA3-009 — `NUCLEO/04` §5: la celda de guards quedó en cuatro y su propia nota del 2026-09-21 dice cinco; la tabla suma 18 apoyos donde el texto declara 19

**Qué se rompe.** El capítulo de invariantes lleva un conteo del reparto por nivel, y es el único
lugar donde se puede preguntar *«¿cuántos invariantes sostiene un guard?»*. La nota que el arreglo
10 le agregó **corrige el texto y no la tabla**, con lo que los dos no coinciden y el que llegue
después no sabe cuál leer — sobre el capítulo que dice, textual, *«los conteos se recorren enteros
con un script, o no se tocan»*.

**El camino.**

1. La tabla: `NUCLEO/04` §5 — `| base | 6 | **4** |`, `| servicio | 14 | **10** |`, `| guard | 5 |
   **4** |`.
2. La nota inmediatamente debajo: *«**Recorrido otra vez el 2026-09-21 — FASE 9-bis-2.** `D15` pasó
   de tener **un** apoyo a tener **dos** … **lo único que se mueve es la lista de guards**, que
   pasa de **cuatro a cinco**: `D15` se agrega a `D8 D9 D10 D12`. … **Los apoyos totales pasan de
   18 a 19** sobre las mismas 15 filas»*.
3. Recorrí las 15 filas de `NUCLEO/04` §3 y clasifiqué su columna de apoyo, que es lo que la nota
   anterior manda hacer: **base** `D2 D3 D8 D15` = 4; **guard** `D8 D9 D10 D12 D15` = 5;
   **servicio** `D1 D3 D4 D5 D6 D7 D11 D12 D13 D14` = 10. La celda de guards tiene que decir **5**,
   y 4 + 5 + 10 = **19**, que es el número que la nota declara. La tabla, tal como está, suma
   **18**.
4. Y la nota anterior —la del 2026-09-19— existe para prevenir exactamente esto: *«Corregir sólo lo
   que un informe señala … habría dejado la tabla sumando **18 apoyos sobre 15** … o sea mal de
   nuevo»*.

**Dónde lo permite el diseño.** `NUCLEO/04` §5 (la tabla y sus dos notas), contra `NUCLEO/04` §3
(las 15 filas).

**Severidad.** `MEDIA`. No falla ejecutando. Lo que queda mal es el único inventario de apoyos del
programa, en el capítulo que enuncia la regla de cómo se tocan los conteos, y en el párrafo que
dice haberla aplicado.

**Marcá `NUCLEO`.**

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 10** (`sucedida_por` y su guard `G-R1-C`). La
nota del 2026-09-21 **es** el arreglo, y corrigió la prosa dejando la celda.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí.** El término redefinido es
`sucedida_por` / `G-R1-C`, y `NUCLEO/04` **contiene los dos** —`D15` los cita por nombre en su
fila del §3 y la nota del §5 los cita otra vez—. El grep llega al párrafo exacto; la aparición
**se resolvió a medias**, que es el mismo modo de falla que el `CRITICA`: se corrigió el texto que
menciona el término y no la estructura que ese texto describe.

---

### F-8dA3-010 — El mapa conceptual del glosario sigue dándole al grant «su scope de verticales» y enumera cinco fuentes de agregación sin el piso

**Qué se rompe.** El mapa de `NUCLEO/01` §5 es la figura con la que alguien entiende el modelo
antes de leer nada, y dice dos cosas que el diseño ya no sostiene: que el grant lleva un scope (es
una columna que se retiró) y que el conjunto efectivo se agrega de cinco fuentes (son seis, y la
que falta es la que **tiene todo el mundo**).

**El camino.**

1. El mapa: `NUCLEO/01` §5 — *«└── Grant permanente (§35, **con su scope de verticales**)»*.
2. La columna no existe: `B/02` §2.4 — *«| **`permanent_grant`** | beneficiario, `includesAddons`,
   quién lo firmó, motivo, suscripciones afectadas (§35.4). **El scope de verticales NO es una
   columna: son sus anclas** |»*, y *«el **scope ES el conjunto de anclas**: no es una columna
   aparte que pueda contradecirlas»* (`12-contrato…` §2.8).
3. La otra mitad del mapa: *«Entitlements y limits efectivos = agregación de: **versión de plan +
   herencia Turista VIP + addons + cortesía + grant**»*. Son cinco; el contrato tiene **seis**
   `tipo` (`12-contrato…` §2.1) y el que falta es `BASE`, que `12-contrato…` §2.5 define como *«la
   fuente que **toda persona tiene en toda vertical** por el solo hecho de existir»*.
4. Y falta la regla que decide qué entra al pliegue: `V/15` §2.6 — *«los complementos se descartan
   y **no entran en ninguna de las cuatro estrategias**»* sin título vivo. El mapa suma los addons
   sin condición.
5. Y el glosario es el que manda sobre los nombres por su propia regla de apertura: *«nada de lo
   que esté acá se redefine en otro capítulo»*.

**Dónde lo permite el diseño.** `NUCLEO/01` §5, contra `B/02` §2.4, `12-contrato…` §2.1, §2.5 y
§2.8, y `V/15` §2.6.

**Severidad.** `MEDIA`. Es una figura explicativa y ningún mecanismo la lee. Pero es la única
figura del programa, está en el capítulo que se declara dueño de los nombres, y las dos cosas que
dice mal son exactamente las dos que dos arreglos distintos se tomaron el trabajo de cambiar.

**Marcá `NUCLEO`.**

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 4** para el scope del grant; la ausencia de
`BASE` es anterior (nació con `R3`, en la FASE 9) y **sigue llegando**.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No para el scope del grant.** El término
redefinido es `permanent_grant` y el mapa escribe *«Grant permanente»*. Es la tercera vez en este
informe que el glosario queda fuera del alcance del grep por escribir las entidades en castellano
(ver `F-8dA3-004` y `F-8dA3-005`), y las tres juntas son el hallazgo real sobre la regla.

---

### F-8dA3-011 — El techo de días de trial por vertical no tiene columna en ningún lado, y `V/02` §2.1 justifica no hacer una tabla diciendo que «hoy hay una sola cosa que configurar» sobre una fila que ya lleva cuatro

**Qué se rompe.** `V/11` §3 cierra `OD-TRIAL-01` con un número configurable por vertical, en base y
no en código. Ese número **no está en ninguna entidad del modelo**, así que el techo que impide que
un trial crezca indefinidamente no tiene dónde vivir. Y el argumento con que `V/02` §2.1 decide no
crear una tabla de configuración por vertical se apoya en un conteo que su propia tabla desmiente.

**El camino.**

1. Lo que `V/11` §3.2 exige: *«**Cada vertical declara un máximo de días de trial acumulados por
   `user + vertical`**, en base y no en código (§9)»*. Y §3.1 dice qué pasa sin él: *«Un trial puede
   crecer indefinidamente y, peor, **nadie lo ve**»*.
2. Lo que `V/02` §2.1 guarda en `vertical`: *«el espejo en base del enum de código, **su evento de
   activación**, **si admite altas** y **su fecha de fin de servicio**»* — cuatro cosas, y
   **ninguna es el techo**. Lo verifiqué con `rg` sobre el capítulo: cero apariciones de `techo` y
   de `máximo de días`.
3. El argumento que decide no hacer tabla: `V/02` §2.1 — *«Va en `vertical` y no en una tabla de
   configuración porque `vertical` es exactamente donde el diseño ya pone el espejo del enum, y
   **hoy hay una sola cosa que configurar**; si mañana aparece la segunda, pasar de columna a tabla
   es trivial»*. La fila de arriba, en el mismo §, ya enumera **tres** configurables además del
   espejo, y `V/11` §3.2 pide la cuarta.
4. Y el techo no es un valor suelto: `V/11` §3.5 obliga a mostrar *«el total acumulado de días de
   trial, **con su origen**»* en dos superficies, y §3.3 a rechazar entera la extensión que no
   entra. Las tres cosas leen el mismo número que no existe.

**Dónde lo permite el diseño.** `V/11` §3.2, §3.3 y §3.5, contra `V/02` §2.1 (la fila `vertical` y
el párrafo del `evento_de_activacion`).

**Severidad.** `MEDIA`. Sin el techo las extensiones no tienen límite, que es el hueco que
`OD-TRIAL-01` declaró cerrado; pero las dos vías de extensión pasan por un acto humano (`V/11`
§3.4: el promo lo frena el techo, `SUPER_ADMIN` lo puede pasar), así que no hay un camino
automático que lo explote.

**¿Es nuevo, o es el arreglo?** **Mitad y mitad.** El techo sin columna es anterior a esta tanda.
Lo que es del arreglo **3** es la frase *«hoy hay una sola cosa que configurar»*: el párrafo de
`vertical.evento_de_activacion` se reescribió en esta tanda —cita a `T6` compartiendo la mitad de
catálogo *«palabra por palabra»*, que es el arreglo 3— y quedó afirmando un conteo que su propia
tabla contradice.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término redefinido por el arreglo 3
es `T6` / *«la mitad de catálogo»*, y grepearlo llega a `V/02` §2.1 —que se editó— pero no a `V/11`
§3.2, que habla de un techo y no de `T6`. La conexión es *«los dos son configuración por
vertical»*, que es semántica y no léxica.

---

### F-8dA3-012 — `G-R2-B` lleva en `V/15` §2.5 el trabajo de vigilar el trinquete cruzado y en `V/20` §2 su predicado sólo mira el plan

**Qué se rompe.** El capítulo que crea el peligro le asigna un guard; el catálogo que define el
guard verifica **la mitad**. El mensaje afirma más de lo que el predicado comprueba, que es el
modo de falla que el propio `V/20` §2.1 declara peor que no tener guard.

**El camino.**

1. Lo que `V/15` §2.5 le encarga: *«**Y se compara POR VERTICAL, que es la parte que la resolución
   no puede deducir sola.** … Un piso único para un grant de scope plural compararía las claves de
   Gastronomía contra lo que otorgaba **un plan de Alojamiento**, que es el mismo cruce que el
   ancla por vertical vino a cerrar, **entrando por el trinquete en vez de por la referencia**. **Lo
   vigila `G-R2-B`** (`V/20` §2)»*.
2. Lo que `V/20` §2 define: *«| G-R2-B | **una fuente `GRANT` transporta un plan de otra vertical**
   que la de la fuente | cap. 15 §2.5, `12-contrato…` §2.8 |»*. El predicado es sobre **el plan**;
   el cruce que `V/15` acaba de describir es sobre **el piso**, y son dos columnas distintas de
   `permanent_grant_vertical` (`B/02` §2.4: *«el `plan` que otorga en esa vertical»* y *«el piso del
   trinquete de esa vertical»*).
3. La regla que esto incumple: `V/20` §2.1 — *«**el texto con que falla no puede afirmar más de lo
   que el predicado verifica.** Un guard que dice *«ninguna operación cruza verticales»* y sólo
   mira una forma sintáctica **está mintiendo con precisión, que es peor que no estar**»*.
4. Y el piso es la mitad que **no** protege el `UNIQUE`: la restricción de base es
   `UNIQUE(permanent_grant_id, vertical)` más *«el plan pertenece a esa vertical»* — el piso
   **queda fuera** de las dos, así que el guard era su única defensa.

**Dónde lo permite el diseño.** `V/20` §2 (fila `G-R2-B`), `V/15` §2.5, `B/02` §2.4.

**Severidad.** `MEDIA`. El daño que el guard debería atrapar —un piso de otra vertical— produce un
trinquete que otorga de más o de menos por comparar contra el plan equivocado, y no lo mira nadie.
No es `CRITICA` porque la fila mala requiere un error de escritura que la base ya hace improbable
para la mitad del plan.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 4.** `G-R2-B` y la separación piso/plan por
ancla nacen en esta tanda; el guard se escribió sobre la mitad que el contrato §2.8 enfatiza.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí.** El término es `G-R2-B` —y también
`piso del trinquete`—, y las dos apariciones están a un grep de distancia (`V/15` §2.5 y `V/20`
§2). Es un caso donde la regla alcanzaba con un solo término y las dos apariciones estaban en la
misma épica. No se ejecutó.

---

## BAJA

### F-8dA3-013 — `sucedida_por` se declara «no se borra nunca» sobre una tabla cuya retención el capítulo nunca clasifica

**Qué se rompe.** La durabilidad de la columna nueva es su razón de ser —es *«la única evidencia de
que esa cancelación fue una sucesión y no una baja»*— y descansa en una sección de retención que
tiene **una** fila y no nombra a `subscription`.

**El camino.**

1. La promesa: `B/02` §2.2 — *«**`sucedida_por` es esa evidencia, y es durable.** Se escribe **en
   la predecesora** … y **no se borra nunca**»*, repetida en `NUCLEO/04` §3, `D15`.
2. La retención de billing, completa: `B/02` §4.1 — una sola fila, *«**Se conserva íntegro,
   siempre** | pagos, reembolsos, comprobantes, **el vínculo con el proveedor** |»*. `subscription`
   no está ni entre lo conservado, ni entre lo anonimizado, ni entre lo borrado.
3. Y el reloj sí existe del otro lado: `V/02` §4.1 ordena el hard delete del día 180 y conserva
   **una sola** entidad —*«la fila de `trial`»*—, con la nota de que *«es la **única** entidad de
   este modelo que lo hace»* (§4.2 regla 2).
4. El consumidor que se apoya en la promesa lee tarde a propósito: `B/16` §4.2 — *«`sucedida_por`
   es la misma pregunta contra un dato que **no se borra**, así que **se puede contestar tarde**: el
   barrido, una revisión manual o un reconciliador leen lo mismo que el acto»*.

**Severidad.** `BAJA`. Es el hueco de retención de `B/02` §4.1 —que es `F-8B3-013` y **sigue
llegando**— con un consumidor nuevo encima. Lo anoto aparte porque lo que cambió es que ahora hay
una columna cuyo **único valor** es sobrevivir, y el capítulo que decide si sobrevive no la nombra.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 10.** El hueco de retención es anterior
(`F-8B3-013`, FASE 8); lo nuevo es la dependencia.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término es `sucedida_por` y `B/02`
§4.1 no lo escribe — no escribe ninguna columna. Encontrarlo pedía preguntarse *«¿qué la borra?»*,
que es un recorrido de dominio y no una búsqueda.

---

### F-8dA3-014 — `B/02` §2.4 remite la regla de la referencia `ADDON` a dos § del contrato que no la contienen

**Qué se rompe.** La afirmación central del arreglo 6 cita su fundamento en el lugar equivocado, y
el lugar correcto es el que lleva la regla general de la que ésta es un caso.

**El camino.**

1. La cita: `B/02` §2.4 — *«**La referencia de una fuente `ADDON` sale SIEMPRE de la instancia,
   nunca del producto** (`V/02` §2.1, `12-contrato-de-cobertura.md` **§2.1 y §2.7**)»*.
2. `12-contrato…` §2.1 es la tabla de campos, y de la referencia sólo dice *«una versión de plan o
   una versión de addon. **No es anulable** (§2.3)»* — remite al §2.3 y no dice de dónde sale.
3. `12-contrato…` §2.7 es `alcance` y `objetivo`; lo único que nombra de la instancia es *«sólo
   devolver el `objetivo` que ya guarda en `addon_instance`»*, que es otra cosa.
4. La regla está en **§2.3**: *«Una fuente `ADDON` transporta **la versión que ancló la INSTANCIA al
   comprarse** (`addon_instance`, `B/02` §2.4) y **nunca** la que el producto vende hoy
   (`addon_product.version_id`)»*.

**Severidad.** `BAJA`. Una remisión rota entre dos documentos que dicen lo mismo. Importa poco y se
arregla en un renglón; la anoto porque el §2.3 es además el que contiene *«una fuente sin
referencia resoluble no se puede expresar»*, que es el enunciado del que esta regla es una
instancia, y perder el puntero es perder el porqué.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 6**, que escribió la cita.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí**, trivialmente: el término es
`addon_product.version_id` y está en la misma línea que la cita rota.

---

## Qué mide esta pasada sobre `DEC-METH-009`

Es lo que la instrucción pide y conviene tenerlo junto, porque las respuestas individuales no se
leen como conjunto.

| | cuántos | cuáles |
|---|---|---|
| hallazgos | 14 | |
| **introducidos por un arreglo de la 9-bis-2** | **12** | todos menos `F-8dA3-007` y `F-8dA3-011`, que son mitad y mitad |
| **el grep los habría mostrado** | **5** | `F-8dA3-001`, `006`, `009`, `012`, `014` |
| **el grep NO los habría mostrado** | **9** | los demás |
| **`CRITICA` que el grep habría mostrado** | **1 de 1** | `F-8dA3-001` |

**El único `CRITICA` estaba dentro del alcance del grep y pasó igual, y eso es el resultado.** La
línea de `S13` no sólo era alcanzable: **fue alcanzada y editada en esta misma tanda**. Lo que el
protocolo pide —*«cada aparición se resuelve»*— se cumplió sobre una fila de tabla con cinco
columnas, resolviendo la que el arreglo venía a cambiar (`desde`) y dejando la que decidía el otro
caso (`evento`). La regla, tal como está escrita, **no distingue «se tocó la línea» de «se resolvió
la aparición»**.

**Y las nueve que el grep no habría mostrado se reparten en tres modos, no en nueve.** Vale
separarlos porque son tres arreglos distintos de la regla, no uno:

1. **El núcleo escribe las entidades en castellano.** `F-8dA3-004`, `F-8dA3-005` y `F-8dA3-010` son
   el mismo agujero: `NUCLEO/01` dice *«Addon: producto»*, *«Grant permanente»*, *«producto de
   addon ≠ instancia de addon»*, y el resto del corpus dice `addon_product`, `permanent_grant`,
   `addon_instance`. **Un grep por nombre de tabla no entra nunca al capítulo que se declara dueño
   de los nombres.** Es el modo más barato de cerrar: el glosario podría llevar el `snake_case` al
   lado de cada término, y las tres pasan a ser alcanzables.
2. **Un arreglo puede crear un ACTO, y un acto no tiene término hasta que alguien se lo pone.**
   `F-8dA3-002` (anclar no está en las doce acciones) y, por el otro extremo, el propio `CRITICA`.
   La regla busca apariciones de un término redefinido; acá lo que hay que buscar es *«¿qué se
   puede hacer ahora que antes no se podía?»*, que es un recorrido de dominio.
3. **Una aparición que falta no se puede grepear.** `F-8dA3-008` (cero menciones de `grant` en
   `B/10` §4) y `F-8dA3-013` (cero menciones de columnas en `B/02` §4.1). El defecto es la ausencia,
   y el grep devuelve presencias.

**Lo que no cambió respecto de las dos vueltas anteriores**: la atribución. 12 de 14, y 1 de 1 en
`CRITICA`. Lo que **sí** cambió es que el crítico de esta vuelta **no** sale de un arreglo que no
se leyó con otro —el modo de la 8-bis-2— sino de un arreglo que **se leyó a sí mismo a medias**.

---

## Los hallazgos de la 8-bis-2 que siguen llegando sobre el texto nuevo

Con su ID viejo, y con el paso en el que llegan ahora. No los vuelvo a contar.

| ID | estado | dónde llega ahora |
|---|---|---|
| `F-8cA3-002` — `addon_product.version_id` como referencia transportada | **CORTADO** | `B/02` §2.4 lo invierte por escrito y agrega la tabla de dos columnas. Queda el residuo `F-8dA3-014` (la cita) y el `F-8dA3-004` (el invariante 26) |
| `F-8cA3-004` — el pliegue decía *«todas las fuentes vivas»* | **CORTADO** | `V/15` §2.6 existe, con `G-R2` en `V/20` §2 |
| `F-8cA3-005` — el grant con UN plan para N verticales | **CORTADO** | `permanent_grant_vertical` con su `UNIQUE`. Los seis hallazgos nuevos de arriba salen del dominio que ese corte crea |
| `F-8cA3-001` / `F-8cA3-007` — `T1`/`T6` no disjuntas y `T6` sobre *«suscripción viva»* | **CORTADOS** | las dos guardas difieren en un booleano, `G-R4` y `G-R4-B` en su lugar |
| `F-8cA3-008` — `T6` escribe una fila de `trial` que la entidad no puede expresar | **SIGUE**, entero | `V/03` §2, `T6` — *«**crea la fila de `trial`, consumida**, sin reloj y sin campaña»*; `V/02` §2.2 sigue pidiendo *«**referencia a las versiones vigentes al arrancar** (el piso del trinquete), **inicio**, **fin**»*. Nada de eso existe en una fila sin reloj, y el arreglo 3 tocó la fila sin tocar la entidad |
| `F-8cA3-012` — la lista de invalidación en diez y sus dos consumidores en siete | **SIGUE**, entero | `V/02` §3.2 sigue con **10** filas (las conté) y sigue diciendo *«las **cuatro** últimas»* y *«las **cuatro** nuevas»* sobre **tres**; `V/15` §4.2 sigue diciendo *«con sus **siete** entradas»*. **Agravado por el arreglo 4**: hay un acto más que debería invalidar y no está — anclar una vertical nueva a un grant, que agrega un título entero a un `user + vertical` sin tocar ninguna fila suya, que es literalmente el criterio que el § enuncia al cerrar (*«si una fuente puede cambiar lo que otorga sin que cambie ninguna fila del `user + vertical`, necesita su propia entrada»*) |
| `F-8cA3-013` — *«la única fila que el sistema nuevo escribe»* son tres clases | **SIGUE**, y crece | `16-fase-7` §4.2 sigue con **cuatro** pasos y los grants no son ninguno; `B/21` §2.4 sigue diciendo *«Las dos cortesías se escriben como `permanent_grant`»*. **Agravado por el arreglo 4**: ahora cada una son **dos** clases de fila —el grant y sus anclas— y el ancla lleva `piso_del_trinquete` **no anulable**, que es una referencia a una versión vigente que la noche del corte recién se está sembrando |
| `F-8cA3-014` — tres conteos distintos de los campos de la dirección inversa | **SIGUE** | `12-contrato…` §4.1 dice *«**siete campos** en tres preguntas»*, §4.2 dice *«los **seis** campos»*, `V/02` §2.1 dice *«**los seis campos**»*. Y `F-8dA3-003` agrega el octavo que nadie declaró |
| `F-8cA3-003` · `F-8cA3-006` | **RETIRADOS** por `DEC-MIG-004` | no los reabro |

---

## Ataques que intenté y el diseño resistió

**1. Que el `UNIQUE(permanent_grant_id, vertical)` deje escribir dos anclas de la misma vertical
por la puerta del `plan`.** No se puede: el `UNIQUE` es sobre `(grant, vertical)` y no sobre
`(grant, plan)`, así que aunque un grant quisiera anclar dos planes distintos de Alojamiento, la
segunda fila colisiona. El diseño eligió la clave correcta: la que hace imposible el estado malo,
no la que describe la intención.

**2. Que un grant de scope plural pueda emitir dos fuentes en la misma vertical.** Tampoco: el
mismo `UNIQUE` lo impide, y `12-contrato…` §2.7 emite *«una fuente **por cada vertical** de su
scope»*, que con una sola ancla por vertical da exactamente una. El pliegue de `V/15` §2.2 nunca ve
dos `GRANT` en el mismo conjunto.

**3. Que retirar el plan anclado por un grant lo deje sin nada.** Está cerrado por escrito y en tres
lugares que coinciden: `12-contrato…` §2.8 punto 2, `B/02` §2.4 y `V/10` §2.1 —*«Una lectura que
resuelve lo que ALGUIEN TIENE nunca exige `vendible`»*—. Intenté encontrar un cuarto lector que
sí lo exigiera y no hay: las seis filas de `V/10` §2 están del lado correcto, las verifiqué una por
una contra el enunciado nuevo.

**4. Que la sucesora de una sucesión pueda ser sucedida y se escapen tres filas vivas.** No: el
candado `B` está indexado sobre `(user_id, vertical)` y no sobre `sucede_a`, así que la segunda
sucesora colisiona con la primera sin ninguna regla extra. El razonamiento de `B/02` §2.2 es
correcto y lo verifiqué contra los tres estados de la relación que `B/03` §3.2 enumera.

**5. Que `sucedida_por` y `sucede_a` puedan quedar las dos puestas en la misma fila y confundir a
los dos consumidores.** Está prohibido en el modelo (`B/02` §2.2: *«nunca las dos puestas en la
misma fila»*) y hay guard de las dos direcciones (`G-R1-C`: escribir una sin limpiar la otra, y al
revés). Los dos lectores —`B/16` §4.2 y `B/05` §3— leen las dos columnas, que es lo que cubre la
línea de tiempo entera.

**6. Que `addon_product` sea mutable y eso mueva algo ya comprado.** No mueve nada, y por eso el
arreglo pudo declarar que no hace falta inmutabilidad: la instancia ancló su versión y el contrato
transporta la de la instancia. El único camino que queda es que alguien lea
`addon_product.version_id` para resolver una fuente viva, y eso está prohibido en tres lugares que
dicen lo mismo. Lo que sí queda abierto es el invariante 26 (`F-8dA3-004`), que es la puerta de
atrás de esta misma defensa.

**7. Que la cortesía sin `scope` pueda emitir en una segunda vertical transportando la versión de
la suscripción de la primera.** No: la suscripción es de **una** vertical (`B/02` §2.2) y la
cortesía transporta **la** versión anclada de **la** suscripción que pausa, que no es anulable. Sin
`scope` no hay ni siquiera una columna que pudiera decir otra cosa. `DEC-GRANT-006` cerró esto
bien; lo que dejó abierto es el otro extremo (`F-8dA3-006`).

**8. Que `DEC-GRANT-006` rompa la cortesía sobre un `PAUSED` que después se suceda.** No hay
camino: `B/19` §4 fila 17 declara que el cambio de plan estando pausado **no se ofrece**, así que
una suscripción en `PAUSED (COURTESY)` no puede ser predecesora de nada mientras dure la cortesía.

**9. Que la lápida del `B/21` §2.5 compita por alguno de los dos candados nuevos.** No: los dos
índices son parciales sobre los estados vivos y `CANCELLED` no es uno de los seis. El capítulo lo
dice y lo verifiqué contra la lista de `B/02` §2.2.

**10. Que el techo de la cortesía heredada del owner necesite un ancla en una vertical sin planes.**
No es alcanzable: las dos `comp` son de Alojamiento o de nada (`B/21` §1.2 mide 0 · 0 · 0 en
gastronomía, experiencia y partner), y `B/02` §2.4 exige *«al menos un ancla»*, no una por vertical
existente. Un grant de una sola vertical es una fila de grant y una de ancla.

**11. Que el `piso_del_trinquete` del ancla pueda quedar apuntando a una versión de otro plan.** La
restricción no lo dice explícitamente —dice *«el piso tampoco es anulable»*— pero `B/02` §2.4 lo
enuncia como *«la referencia a la versión de **ESE** plan que estaba vigente el día que se firmó»* y
`V/15` §2.5 lo repite. Es una restricción que la base **puede** hacer cumplir y el capítulo no la
escribe como tal; lo dejo acá y no como hallazgo porque el enunciado es inequívoco y el guard
`G-R2-B` debería cubrirlo — aunque hoy no lo cubra, que es `F-8dA3-012`.

**12. Que la migración escriba alguna fila de verticales y contradiga *«no se hereda una sola
fila»*.** No: `V/21` §2.4 cierra que del lado de verticales **no se escribe ninguna**, y la única
excepción declarada es la lápida, que es de billing. El grant heredado es billing también. La
afirmación es literal en su mitad.

---

## Fuera de mi vector

Lo anoto sin desarrollarlo, para quien corresponda:

- **`A2` / `C1`**: `S13` alcanza *«toda fila viva … en cada vertical que el grant ancla»* y el acto
  de anclar no tiene transición. Eso es un `desde` sin `evento`, o sea una máquina con un camino de
  entrada no declarado — la regla 1 de `NUCLEO/03` (*«lo que la tabla no declara no se ejecuta»*)
  lo mandaría a la marca `requiere_conciliación`, que no es lo que corresponde para un acto
  administrativo legítimo.
- **`A1`**: el acto de anclar no tiene permiso propio (`F-8dA3-002`), y `V/17` §3.3 prohíbe las
  **doce** a un actor de sistema — la décimo tercera no está prohibida.
- **`C2`**: `16-fase-7` §4.2 sigue con cuatro pasos y los grants del owner, que ahora son dos
  clases de fila cada uno, no son ninguno.

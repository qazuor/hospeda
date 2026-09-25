---
title: "FASE 9-bis-5 · rastro de la familia 3 — la marca y los motivos"
linear: HOS-1352
statusSource: linear
created: 2026-09-23
updated: 2026-09-23
status: CURRENT
fase: 9-bis-5
---

# Rastro de la familia 3 — la marca y los motivos

Cierra el **crítico #6** —`F-8fB2-001` + `F-8fB3-002` (`CRITICA`, colapsados por `C1` §2.3 punto 1)
y `F-8eB1-004` (`ALTA`, que sigue llegando desde la 8-bis-4)—, el **crítico #5** (`F-8fB1-002`,
`CRITICA`, sus dos mitades) y el defecto **`I2`** (`MEDIA`). **Dieciséis commits sobre el corpus de
diseño**, más el de este rastro, sobre **trece** archivos.

---

## 1. Los commits

| sha | qué cierra |
|---|---|
| `fd349086d` | **#6** — la marca deja de llevar **una** FK al pago: los pagos cuelgan de `reconciliation_mark_payment` y son **N** |
| `0f673aa45` | **#6** — el escritor **acumula**: `C2`, `C3` y `S14` cuelgan el hecho de la marca abierta en vez de dejar que el `UNIQUE` lo rechace |
| `7f9bb4ad3` | **#6** — el listado muestra **todos** los pagos y el **monto total**, y `S15` no levanta con pagos sin resolver |
| `4635068cf` | **#6** — `G-R1-F` gana el predicado de la cardinalidad, y el inventario del `NUCLEO/01` §2.5 sus dos consumidores nuevos |
| `3a563039f` | **#5 mitad A** — el motivo 7 pasa de `no` a **`SÍ`** en *«¿hay plata del cliente que devolver?»*, con las cuatro condiciones recorridas |
| `de8162798` | **#5 mitad A** — el motivo 7 entra a la tabla de defaults del `B/19` §6 y sale del ejemplo del reloj del `B/09` §3 |
| `4f20c02ca` | **#5 mitad B** — la **regla de desempate**: un pago tardío sobre una fila `CANCELLED` tiene un motivo y no dos |
| `8835bc26a` | **`F-8eB1-004`** — el reembolso que `S21` declara posible gana **motivo 14**, default y quién lo abre |
| `b7ab85961` | los conteos congelados que los dos anteriores mueven, **recontados enteros** |
| `669a78ccc` | **`I2`** — el `02` §2.5 pasa a ser capítulo de **B3**, y la primera de las dos preguntas del §2.9 se cierra |
| `d93fe6b54` | dos apariciones que el barrido destapó: el conteo del `NUCLEO/03` §1 y la FK del `B/09` §3 |
| `94fd21b87` | las tres ramas de la sucesión del `B/12` §5.3 nombran los pagos colgados, y su *«las otras diez»* se recuenta |
| `9291f3994` | `S21` entra a las fuentes de `G-R1-F` y a la salvedad 2 del barrido |
| `76ee57f12` | premisa ajena: *«el default es devolver»* deja de ser universal — son **cinco de siete** |
| `e60f43427` | premisa ajena: *«el efecto de `S21` es UNA escritura sobre UNA entidad»* — son **dos**, y las dos idempotentes |
| `d3bd02332` | premisa ajena: el enrutado del reembolso del `NUCLEO/08` §3 gana la fila de `S21`, y su *«las dos»* se recuenta |

---

## 2. Qué se arregló

1. **La marca sigue siendo una por `(fila, motivo)` y los HECHOS que la sostienen pasan a ser N.**
   El `UNIQUE(subscription_id, motivo) WHERE levantada_en IS NULL` **no se tocó** —dos marcas
   abiertas del mismo motivo serían el mismo caso dos veces en el listado—; lo que se movió es la
   **FK singular al pago**, que pasó a ser la entidad `reconciliation_mark_payment` con
   `UNIQUE(marca, pago)`, `resuelto_en` y el `refund` que lo asienta.
2. **El escritor acumula en vez de rebotar, y eso se escribió en los cuatro sitios que escriben.**
   `C2`, `C3` y `S14` cuelgan el hecho **de la marca que ya está abierta** con ese motivo; el
   `UNIQUE` deja de rechazar el `INSERT` y pasa a **enrutar** el hecho. Sin esa regla, del segundo
   cobro en adelante la plata quedaba sin ninguna fila que la nombrara, y la población no era un
   borde: es la que la **salvedad 4** del `B/09` §3 existe para cubrir —*«cancelar no emite webhook,
   así que el primer aviso es el cobro»*— sobre un preapproval que cobra **una vez por ciclo**.
3. **La corrección llega hasta el listado, que es donde el daño se consumaba.** El listado muestra
   **todos** los pagos colgados, **cuántos son** y el **monto total**, y `S15` gana una guarda: no
   puede levantar una marca con algún pago sin resolver. Ése era el acto que cerraba el caso —la
   persona devolvía el único pago que el listado le nombraba y hacía bien su trabajo—, y es el
   residuo que `C1` §2.3 pidió no dejar en el modelo.
4. **`G-R1-F` vigila ahora la cardinalidad y no sólo el motivo.** Sus predicados nuevos son dos:
   un camino que escribe un hecho con plata sobre una marca abierta del mismo motivo y **no lo
   cuelga de ella**, y un camino que **levanta** una marca con pagos sin resolver. El guard viejo
   comprobaba que hubiera *un* pago; nunca preguntaba **si había más de uno**.
5. **El motivo 7 pasa a `SÍ`, y la razón se escribió condición por condición.** Las cuatro del
   `B/05` §3 **sólo fallan con el pago ya acreditado** —la 1 sobre una fila terminal o ya activa, la
   2 con un monto que existe y no coincide, la 3 con el cliente pagando dos veces, la 4 con un doble
   cobro declarado—. Con `no` el listado lo mandaba **último y sin propuesta**, que es el estado que
   el propio `B/19` §6 declara ya fallido.
6. **Su default es DEVOLVER con la excepción nombrada, no tapada.** La condición **2** fallando por
   un precio nuevo que no se propagó se resuelve **aceptando el monto y reactivando**; eso no pide
   un motivo aparte porque *«cuál de las cuatro falló va en el evento y no en el motivo»*, y porque
   el default **no ejecuta nada** (`DEC-RF-002`).
7. **El mismo hecho deja de tener dos motivos.** La regla de desempate está escrita como tabla en el
   `B/05` §3, que es el § que cuantifica sobre *«si falla cualquiera»*: la condición 1 fallando
   sobre una fila `CANCELLED` es del motivo **2** o del **3** según quién la cerró, y todo lo demás
   —la 1 sobre `ABANDONED` o `ACTIVE`, y las condiciones 2, 3 y 4— es del **7**. **El desempate no
   decide si el cliente cobra de vuelta**: los tres motivos llevan `SÍ`. Decide qué le ponen
   delante a quien lo resuelve.
8. **El reembolso que `S21` declaraba gana quién lo abre.** El motivo **14**,
   `COMPLEMENTO_CON_PERÍODO_COBRADO`, lo escribe `S21` **en el mismo acto** en que lleva la fila a
   `CANCELLED`, y sólo cuando el último cobro paga **un período que todavía no terminó** — condición
   que deja afuera sin enumerarlas las tres poblaciones sin nada que decidir (el addon convertido a
   $0, el que muere al final de su ciclo y el `A3` que nunca cobró). **La marca no decide**: `B/16`
   §4.4 ya había decidido que la regla es no devolver, y el listado propone **eso**.
9. **`I2`: la tabla de los motivos es capítulo de `B3`.** Verificado contra `B/descomposicion.md`
   antes de escribirlo: `B3` ya tenía `02` §2.2 —la tabla que crea la entidad— y los dos actos que
   la abren y la levantan (`S14`, `S15`, dentro de `03` §3.1–§3.4). La parte que `B3` no puede
   terminar sola quedó dicha: siete de los catorce motivos los abren actos de `B8`, `B10` y `B12`,
   que traen su fila viva cuando llegan.
10. **Los conteos se recontaron enteros, no se les sumó uno.** Catorce motivos y **cinco** que
    devuelven plata, recontados sobre la tabla; y con ellos *«siete de los trece»* de `S14`, *«los
    otros seis»*, *«las otras doce marcas»*, *«los otros diez»* del `B/05` §3 y *«las otras diez»*
    del `B/12` §5.3.

---

## 3. Qué se grepeó

**Términos NUEVOS que esta familia introduce**: `reconciliation_mark_payment` ·
`COMPLEMENTO_CON_PERÍODO_COBRADO` · *«colgado de ella»* / *«el pago colgado»* / *«cuelga»* ·
*«monto total»* · *«regla de desempate»* · *«acumulativo»* · *«catorce motivos»* · *«cinco que
devuelven plata»* · *«NO devolver»* como default.

**Términos VIEJOS que se retiran o se estrechan**, grepeados aparte porque el consumidor no
actualizado no aparece buscando el nuevo: *«la referencia al pago»* / *«la referencia al cobro»* /
*«la referencia a ese cobro»* · *«el pago que hay que devolver»* como **columna** · *«trece
motivos»* / *«trece marcas»* / *«trece cosas»* **con sujeto la casilla** —separado a mano de los
trece capítulos, las trece unidades y las trece puertas del `B/09` §3, que **no se tocan**— ·
*«cuatro motivos»* / *«cuatro que devuelven plata»* / *«cuatro de ellas significan»* · *«las otras
doce marcas»* / *«una de las otras doce»* / *«los otros diez»* · *«el default es devolver»* ·
*«sin reembolso del período ya cobrado»* · *«si corresponde devolver»*.

**Términos de ANCLA**, grepeados porque son los sujetos sobre los que el arreglo se apoya:
`reconciliation_mark` · `requiere_conciliación` · `PAGO_TARDÍO_RECHAZADO` ·
`COBRO_POSTERIOR_A_LA_BAJA` · `COBRO_POSTERIOR_AL_GRANT` · `REEMBOLSO_POR_CONFIRMAR` ·
`PAGO_PENDIENTE_SIN_RAMA` · `COBRO_DURANTE_CORTESÍA` · `UNIQUE(subscription_id, motivo)` · `S14` ·
`S15` · `S21` · `G-R1-F` · *«listado accionable»* · *«marca abierta»* / *«marcas abiertas»* ·
*«motivo»* / *«motivos»* · *«default»* · *«la marca»* / *«las marcas»*.

**Alcance**: los **47 archivos** del corpus de diseño —las dos épicas con sus `spec.md` y
`descomposicion.md`, el núcleo, el contrato, la partición, las decisiones abiertas y los documentos
de medición—, construidos con `fd -e md` sobre los tres directorios quitando los informes de fase
(`14-…` a `23-…`), el PDR, las probes, **el decision log y la matriz** (que el alcance de
`DEC-METH-011` excluye por definición y que las reglas duras prohíben tocar). Con y sin backticks,
**incluidos los trece archivos del corpus que la familia toca**, contados con `git diff
--name-only`.

**Medido sobre el árbol en `d3bd02332`**: **607** líneas con al menos una aparición; **209** las
tocaron los commits de la familia y **398** no, y son las que van abajo. La partición se calculó con
los rangos `+` de `git diff --unified=0 fd349086d~1..d3bd02332` proyectados sobre los bloques
separados por línea en blanco —el párrafo es la unidad que `DEC-METH-011` fija—, no a ojo.

> **Una advertencia sobre el barrido.** *«Motivo»* y *«la marca»* son los dos términos más
> productivos del corpus y los dos más contaminados: **135 de las 398** apariciones no corregidas
> son el motivo de **otra cosa** —una pausa, una revocación de grant, un `reason` al proveedor— o la
> marca de **otra cosa** —`permanent_grant.revocado_en`, una fila *«marcada»* en el sentido del
> barrido—. Van agrupadas y nombradas como lo que son, porque contarlas como hallazgos habría
> enterrado las que sí son de la marca de conciliación.

---

## 4. Las 398 apariciones no corregidas, una por una

### Grupo A — `08-phase-1b-code-discovery.md`, el CÓDIGO DE HOY · 92 apariciones

**Las 92 describen lo que el código hace hoy, medido en la FASE 1B**, y su cuantificador es sobre
la implementación existente —`billing_subscriptions`, qzpay, los servicios de `apps/api`— y **nunca
sobre el diseño de esta tanda**. Ninguna nombra `reconciliation_mark`, el catálogo de motivos ni el
listado accionable, que son entidades que **este corpus inventa y el código no tiene**. **Si alguna
dijera *«la marca lleva un pago»* o *«los motivos son trece»*, sería falsa**; ninguna lo dice.

| archivo | líneas |
|---|---|
| `08-phase-1b-code-discovery.md` | 92 apariciones, L30 a L6465 |

### Grupo B — *«motivo»* de una PAUSA, de una REVOCACIÓN o de un `reason` · 81 apariciones

**Las 81 cuantifican sobre un motivo que no es el de la marca** —`subscription_pause.motivo`
(`CUSTOMER_REQUEST` o `COURTESY`), `permanent_grant` y su motivo de revocación **libre y no de
lista cerrada** (`DEC-GRANT-008`), el `reason` que se manda al proveedor (`D9`)—, y el cuantificador
es correcto para ese sujeto. **Ninguna de las 81 nombra la enumeración cerrada del `B/02` §2.5, ni
`G-R1-F`, ni el listado accionable**, que son los tres lugares donde los motivos de la marca se
cuentan. La prueba de que son conjuntos distintos la escribe el propio corpus: el motivo de
revocación es **texto libre** *«por `DEC-GRANT-008`»* (`NUCLEO/01` §2.3) y el de la marca es
**cerrado y contado** — el `B/02` §2.4 lo dice con todas las letras, *«no es un motivo de los de
`reconciliation_mark`, y conviene no confundirlos»*.

| archivo | líneas |
|---|---|
| `B/03-maquinas-de-estado.md` | L47, L278, L393, L411, L844, L845, L949, L1037, L1044, L1077, L1613, L1910, L1952 |
| `NUCLEO/01-glosario.md` | L211, L317, L319, L321, L322, L449, L452, L562, L577, L578, L694 |
| `B/02-modelo-de-datos.md` | L285, L348, L349, L501, L564, L570, L572, L577, L651, L725 |
| `12-contrato-de-cobertura.md` | L87, L473, L642, L743, L748 |
| `10-evaluacion-de-proveedor.md` | L220, L406, L500, L642 |
| `NUCLEO/04-invariantes.md` | L112, L129, L194, L239 |
| `V/11-trial.md` | L100, L156, L164, L211 |
| `B/12-suscripcion.md` | L489, L491, L492, L702 |
| `03-handoff.md` | L472, L835, L1009 |
| `V/03-maquinas-de-estado.md` | L367, L402, L438 |
| `B/14-promos-cortesias-y-grants.md` | L81, L269, L389 |
| `02-worklog.md` | L43, L715 |
| `04-open-decisions.md` | L198, L469 |
| `NUCLEO/08-auditoria-y-observabilidad.md` | L216, L221 |
| `B/09-conciliacion.md` | L282, L284 |
| `B/19-superficies.md` | L91, L102 |
| `05-phase-1a-domain-analysis.md` | L883 |
| `NUCLEO/07-outbox-y-notificaciones.md` | L281 |
| `V/02-modelo-de-datos.md` | L312 |
| `V/20-testing.md` | L92 |
| `B/descomposicion.md` | L295 |
| `B/10-verticales-planes-billing-options.md` | L286 |
| `B/16-addons.md` | L236 |

### Grupo C — *«default»* de un VALOR, no la propuesta del listado · 18 apariciones

**Las 18 cuantifican sobre un valor por omisión** —un campo que nace con un default en la base, una
configuración con valor de fábrica, una rama que se toma *«por default»*— y **ninguna nombra
`DEC-RF-003` ni el listado accionable**, que son los dos lugares donde vive el default de la marca.
El default que esta familia mueve es **lo que el listado PROPONE a una persona**, que es un dato de
superficie y no un valor de columna; las 18 no hablan de superficies.

| archivo | líneas |
|---|---|
| `05-phase-1a-domain-analysis.md` | L401, L503, L1366 |
| `12-contrato-de-cobertura.md` | L750, L785, L794 |
| `B/12-suscripcion.md` | L34, L496, L499 |
| `04-open-decisions.md` | L16, L232 |
| `NUCLEO/07-outbox-y-notificaciones.md` | L208, L210 |
| `02-worklog.md` | L224 |
| `11-particion-del-programa.md` | L129 |
| `V/spec.md` | L271 |
| `B/03-maquinas-de-estado.md` | L1018 |
| `B/19-superficies.md` | L163 |

### Grupo D — *«trece»* / *«catorce»* de OTRO conjunto · 18 apariciones

**Ninguna de las 18 cuantifica sobre los motivos de la marca**, y los conjuntos son cinco y están
identificados uno por uno: los **trece capítulos** de la épica de billing (`B/descomposicion.md`
L16, L50; `B/spec.md` L17, L41; `NUCLEO/00` L108), las **trece unidades** del reparto
(`B/descomposicion.md` L23, L62, L85, L105, L166, L507), las **trece puertas a un estado terminal**
del `B/09` §3 (L110), los **catorce guards sin unidad** de la quinta enmienda de `DEC-TEST-001`
(`B/20` L287, L314, L319, L329, L340) y las **trece tablas de qzpay** del worklog (L557). **Si
alguna de las cinco dijera *«motivos»* o *«marcas»*, sería falsa**; ninguna lo dice, y por eso
ninguna se movió cuando el catálogo pasó a catorce.

| archivo | líneas |
|---|---|
| `B/descomposicion.md` | L16, L23, L50, L62, L85, L105, L166, L507 |
| `B/20-testing.md` | L287, L314, L319, L329, L340 |
| `B/spec.md` | L17, L41 |
| `02-worklog.md` | L557 |
| `NUCLEO/00-indice.md` | L108 |
| `B/09-conciliacion.md` | L110 |

### Grupo E — *«la marca»* / *«las marcas»* de OTRA cosa · 54 apariciones

**Las 54 usan la palabra sobre un sujeto que no es `reconciliation_mark`**: la marca comercial, la
marca que un acto *«deja»* en una columna (`permanent_grant.revocado_en`), y sobre todo la forma
adjetiva —*«una fila marcada»*— cuando lo que importa es que **la fila divergió**, no con qué
motivo. **Ese uso adjetivo es exactamente el que el `NUCLEO/01` §2.5 declara admisible**: su regla
de uso prohíbe *«marcada»* **en la columna condición de una transición, en un invariante o en un
guard** cuando lo que importa es cuál, y las 54 son prosa explicativa, no ninguno de esos tres
lugares. **Si alguna estuviera en una condición, un invariante o un guard, sería falsa**; las
recorrí y ninguna lo está.

| archivo | líneas |
|---|---|
| `B/12-suscripcion.md` | L503, L521, L530, L548, L561, L563, L569, L570, L571, L696 |
| `B/09-conciliacion.md` | L168, L228, L279, L327, L401, L446, L448, L502, L513 |
| `B/03-maquinas-de-estado.md` | L268, L334, L358, L368, L1153, L1161, L1957, L2020 |
| `B/02-modelo-de-datos.md` | L151, L204, L210, L218, L220, L221, L227 |
| `B/descomposicion.md` | L457, L458, L473 |
| `B/05-idempotencia-y-concurrencia.md` | L257, L261, L279 |
| `02-worklog.md` | L500, L760 |
| `03-handoff.md` | L177, L341 |
| `12-contrato-de-cobertura.md` | L362, L371 |
| `NUCLEO/01-glosario.md` | L560, L575 |
| `B/20-testing.md` | L67, L111 |
| `13-pliego-consulta-legal.md` | L141 |
| `NUCLEO/03-maquinas-de-estado.md` | L72 |
| `V/20-testing.md` | L105 |
| `B/14-promos-cortesias-y-grants.md` | L274 |

### Grupo F1 — `S14`, `S15` y `S21` como sujeto · 48 apariciones

**Las 48 cuantifican sobre propiedades de esas tres filas que los commits no movieron**: su
`desde`, su lugar en las tablas de la máquina, su relación con `S20` y `A5`, su aparición en los
inventarios de *«fila viva»* y en la tabla de puertas del `B/09` §3. **Lo que esta familia les
cambió a las tres es distinto en cada una y está enumerado**: a `S14` el *«abrir es acumulativo»*,
a `S15` la guarda de los pagos sin resolver, a `S21` la apertura de la marca del motivo 14 — y las
tres escrituras viven en párrafos que los commits **sí** tocaron. **Dos que merecen decirse
enteras, porque cuantifican sobre algo que sí se movió y siguen siendo verdaderas**:

- **`B/16` L627-628 y `B/09` L154** — *«las seis no vuelven todas por la misma puerta … `S21`
  entra por la salvedad 1 y no por la 4»*. La cláusula cuantifica sobre **cuál salvedad selecciona
  a cada una de las seis**, y la salvedad 2 —que ahora también alcanza a `S21` mientras su marca
  esté abierta— **no selecciona por quién canceló sino por tener una marca abierta**, así que
  alcanza a cualquiera de las seis por igual y no rompe la asimetría que la frase enuncia. La
  adición quedó escrita en `B/16` §4.4, que es el § dueño del sujeto.
- **`B/03` L902-909** — *«`S21` no agrega ningún par con dos filas, así que `G-R4` sigue contando
  tres»*. Cuantifica sobre **pares `(desde, evento)` de la tabla de transiciones**, y abrir una
  marca es un **efecto**, no una fila nueva: `S21` sigue siendo una sola fila con un solo par.

| archivo | líneas |
|---|---|
| `B/03-maquinas-de-estado.md` | L91, L329, L427, L704, L737, L742, L794, L809, L831, L868, L890, L893, L894, L900, L902, L903, L906, L909, L1800, L1806, L1893, L1894 |
| `B/09-conciliacion.md` | L121, L133, L134, L154, L198, L208, L214, L386, L388 |
| `B/16-addons.md` | L534, L622, L627, L628, L645, L668, L683, L690, L726 |
| `B/02-modelo-de-datos.md` | L200, L423, L426 |
| `NUCLEO/01-glosario.md` | L414, L557 |
| `NUCLEO/03-maquinas-de-estado.md` | L116 |
| `NUCLEO/04-invariantes.md` | L165 |
| `B/descomposicion.md` | L327 |

### Grupo F2 — el PREDICADO *«marca abierta»* y la entidad · 18 apariciones

**Las 18 cuantifican sobre el predicado —*«esta fila tiene al menos una marca abierta»*— y sobre la
entidad como fila con motivo y reloj**, y **ninguna de las dos propiedades se movió**: la marca
sigue siendo una fila, sigue siendo única por `(fila, motivo)` mientras esté abierta, y el
predicado sigue leyéndose sobre `levantada_en`. Lo que cambió cuelga **por debajo** de la marca
—los pagos— y no altera ni su cardinalidad por motivo ni el predicado que la enumera. **Si alguna
dijera *«la marca lleva el pago»* o *«una marca, un pago»*, sería falsa**; las recorrí y ninguna lo
dice: las que nombraban el pago como columna estaban en `B/02` §2.2, `B/12` §5.3, `B/09` §3 y
`NUCLEO/08` §3, y **las cuatro se corrigieron** (§5).

| archivo | líneas |
|---|---|
| `NUCLEO/01-glosario.md` | L516, L527, L529, L536, L537, L546, L553, L558, L559, L576 |
| `B/09-conciliacion.md` | L71, L169, L496 |
| `B/03-maquinas-de-estado.md` | L425, L940 |
| `B/descomposicion.md` | L302 |
| `B/02-modelo-de-datos.md` | L197 |
| `B/20-testing.md` | L69 |

### Grupo F3 — un motivo CON NOMBRE PROPIO que esta familia no toca · 11 apariciones

**Las 11 nombran uno de los motivos cuyo texto, escritor y clasificación quedaron intactos**:
`REEMBOLSO_POR_CONFIRMAR`, `TRANSICIÓN_NO_DECLARADA`, `DIVERGENCIA_DE_MONTO`,
`REANUDACIÓN_NO_APLICADA`, `CORTESÍA_SIN_RE_EMITIR` y `SUCESIÓN_ABIERTA_SOBRE_FILA_MUERTA`. **Los
tres motivos que esta familia SÍ movió son el 2, el 3, el 7 y el 14**, y las apariciones donde su
texto cambia viven en párrafos tocados. **Si alguna de las 11 afirmara algo sobre la columna
*«¿hay plata que devolver?»* de su motivo, habría que releerla**; ninguna lo hace: las 11 lo citan
como el nombre del caso, no como su clasificación.

| archivo | líneas |
|---|---|
| `B/09-conciliacion.md` | L90, L91, L224, L280, L290, L356 |
| `B/16-addons.md` | L595, L596 |
| `NUCLEO/07-outbox-y-notificaciones.md` | L262 |
| `B/12-suscripcion.md` | L506 |
| `B/19-superficies.md` | L161 |

### Grupo F4 — el LISTADO ACCIONABLE y `G-R1-F` como canal y como guard · 15 apariciones

**Las 15 cuantifican sobre el listado como CANAL PRIMARIO** —*«el correo es agregado»*,
`DEC-OBS-001`— **o sobre `G-R1-F` como una fila del catálogo de guards** —su letra, su racimo, su
unidad, su lugar entre los seis de `R1`—, y **ninguna enumera qué muestra el listado ni qué
predicados tiene el guard**, que es lo único que esta familia movió en los dos. Las que sí lo
enumeran son `B/19` §6, `B/20` §2 y el inventario del `NUCLEO/01` §2.5, y las tres están en
párrafos tocados. **Si alguna dijera *«el listado muestra el pago»* en singular, sería falsa**;
ninguna lo dice.

| archivo | líneas |
|---|---|
| `NUCLEO/01-glosario.md` | L518, L548, L606 |
| `B/20-testing.md` | L68, L145, L322 |
| `B/09-conciliacion.md` | L471, L511 |
| `02-worklog.md` | L673 |
| `03-handoff.md` | L814 |
| `05-phase-1a-domain-analysis.md` | L1146 |
| `NUCLEO/08-auditoria-y-observabilidad.md` | L255 |
| `V/20-testing.md` | L104 |
| `B/descomposicion.md` | L459 |
| `B/02-modelo-de-datos.md` | L578 |

### Grupo F5 — *«devolver»*, *«colgar»* y el monto, sobre otro sujeto · 11 apariciones

**Las 11 usan el verbo sobre un sujeto que no es un pago de la marca**: devolver un entitlement,
devolver un trial, devolver una fila al barrido, colgar una instancia de un ancla, el monto vigente
de un preapproval. El cuantificador es correcto para cada uno y **ninguna nombra un `refund`, un
`payment` ni un `manual_payment`**, que son los tres sujetos que la entidad nueva alcanza. **Si
alguna dijera *«el monto está determinado»* sobre una marca, sería falsa**; la única que lo decía
es la fila 1 del `B/02` §2.5, y **se corrigió** (§5).

| archivo | líneas |
|---|---|
| `B/09-conciliacion.md` | L298, L317, L409, L416, L456 |
| `B/03-maquinas-de-estado.md` | L471, L479, L860 |
| `V/03-maquinas-de-estado.md` | L241 |
| `V/15-entitlements-y-limits.md` | L337 |
| `B/16-addons.md` | L663 |

### Grupo G — el resto, recorrido uno por uno · 32 apariciones

**Las 32 son las que no cayeron en ningún grupo y se leyeron enteras.** Se reparten en cuatro
sujetos, y ninguno es la cardinalidad del pago ni la clasificación de un motivo:

1. **La fila marcada y el barrido** (`02-worklog` L1080, `03-handoff` L107, L176, L181, `B/09`
   L170, `B/05` L258, L280, `B/02` L214) — cuantifican sobre **si una fila marcada se barre**,
   que es la salvedad 2 del `B/09` §3 y no cambió: sigue seleccionando por *«al menos una marca
   abierta»*, y una marca con N pagos sigue siendo una marca abierta.
2. **Las doce acciones de admin** (`04-open-decisions` L404, `NUCLEO/08` L58, `B/20` L294) —
   cuantifican sobre el catálogo de `NUCLEO/08` §3, que **sigue teniendo doce filas**: abrir la
   marca del motivo 14 es un acto **de sistema**, y eso quedó escrito en la tabla de enrutado de
   ese mismo § (§5, punto 5).
3. **Los conjuntos de estados y de escritores** (`NUCLEO/01` L300, `B/05` L206, `B/09` L135, L136,
   `B/03` L429, L739, L1074, L1740, L1755, L1756, `B/descomposicion` L495, L498, L499, `B/09`
   L405, L454, `B/14` L333, `B/19` L159, `B/20` L70, `10-evaluacion` L184) — cuantifican sobre los seis estados de la suscripción, las nueve filas de
   la salvedad 4, las tres cláusulas de `A5` y las seis comprobaciones del `B/09` §3. **Ninguno de
   los cuatro conjuntos ganó ni perdió un miembro**: el motivo 14 lo escribe una **transición**, no
   una comprobación, y el `B/16` §4.4 lo dice con esas palabras.
4. **El motivo de revocación como texto libre** (`NUCLEO/01` L209, `B/02` L653) — es el conjunto
   del grupo B visto desde su propia definición.

---

## 5. Premisas ajenas que el arreglo volvió falsas y se corrigieron en el mismo acto

**Ocho, y las ocho verificables con un `rg`.**

| # | dónde | qué decía | qué dice ahora | commit |
|---|---|---|---|---|
| 1 | `B/09` §3, el recuadro del reloj de la marca | *«un `REEMBOLSO_POR_CONFIRMAR` tiene plata del cliente parada y un `PAGO_TARDÍO_RECHAZADO` no»* | el ejemplo del motivo sin plata parada pasa a ser `TRANSICIÓN_NO_DECLARADA`, y el recuadro dice por qué se cambió | `de8162798` |
| 2 | `B/19` §6, la tabla de defaults | **`COBRO_DURANTE_CORTESÍA` no tenía fila**, y lleva `SÍ` en el `B/02` §2.5 desde `DEC-GRANT-007` — o sea que `G-R1-F` lo exigía y no estaba | tiene su fila, con default **devolver**, que es el camino que `DEC-GRANT-007` eligió por escrito | `7f9bb4ad3` |
| 3 | `B/02` §2.5, fila 1 | *«**SÍ**, y el monto está determinado»* — con N pagos por marca, *«el monto»* dejaba de estar definido | el monto es **la suma de los pagos colgados**, y acá es uno porque `S19` retiene uno | `7f9bb4ad3` |
| 4 | `B/05` §3 | *«el motivo es lo que separa este caso de **los otros diez** en el listado»* — eran doce antes de esta familia | **los otros doce**, recontado sobre la tabla y no incrementado | `4f20c02ca` |
| 5 | `B/12` §5.3, el recuadro de las tres ramas | *«se distingue de **las otras diez**»* y *«una de **las otras doce**»* | **las otras trece**, las dos, recontadas sobre la tabla de catorce | `94fd21b87` |
| 6 | `NUCLEO/08` §3, la tabla del enrutado | *«**Las dos** son actos de sistema»* sobre una tabla que **ya tenía tres** desde `DEC-GRANT-010` | **las cuatro**, con la fila de `S21` sumada y el conteo rehecho sobre las filas | `d3bd02332` |
| 7 | `B/03` §3.2, *«por qué `S21` sí puede decir idempotente a secas»* | *«Su efecto es **UNA** escritura sobre **UNA** entidad»* | son **dos** —el estado y la marca— **y las dos idempotentes por separado**, con la razón de cada una | `e60f43427` |
| 8 | `B/19` §6 | *«el default es devolver, y la persona confirma salvo que haya razón»* como caracterización **universal** | **cinco de las siete filas** proponen devolver; el 14 propone lo contrario y `PAGO_PENDIENTE_SIN_RAMA` no propone nada | `76ee57f12` |

**Las 2 y la 3 viajan en el mismo commit y se cuentan aparte porque su sujeto es otro.** Ocho
premisas, ocho correcciones, **todas ejecutadas enteras** — verificado con `rg` sobre el corpus
después del último commit: ninguna de las ocho formulaciones viejas sobrevive en ningún archivo.

---

## 6. Lo que este rastro vuelve falso de los anteriores

**Nueve líneas, todas por CADUCIDAD** —eran verdaderas el día que se escribieron y un commit
posterior las movió—, y ninguna por error del rastro que las escribió. Es el modo que
`DEC-METH-012` declaró vivo a propósito.

### De `21-fase-9-bis-4/rastro-8d6b27a12.md` (la tanda de las ocho decisiones)

| línea del rastro | qué declaraba | por qué es falsa hoy |
|---|---|---|
| L129-132 | *«`B/09` L75-78 · el recuadro de los trece motivos — «Cuatro de los trece motivos significan…» … Las dos cifras se recontaron sobre `B/02` §2.5 y siguen»* | las dos cifras son **catorce** y **cinco** (`b7ab85961`, `d93fe6b54`) |
| L176 | *«`B/02` L602 · §2.5, el título «trece motivos … y cuatro de ellos devuelven plata» → sigue»* | el título dice **catorce** y **cinco** |
| L181 | *«`B/02` L619-623 · «`S14` … cubre siete de los trece casos … Los otros seis…»»* | siete de los **catorce**, y los otros **siete** — `S21` es el escritor nuevo |
| L185 | *«`B/02` L625-639 · la tabla de los trece motivos — fila 1…»* | la tabla tiene **catorce** filas, y la celda de la fila 1 cambió (§5, punto 3) |
| L395 | la tabla de premisas corregidas: *«`B/03` §3.2, `S14` \| «seis de los once» \| siete de los trece»* | la corrección que esa fila declara quedó a su vez caduca: hoy es **siete de los catorce** |

### De `21-fase-9-bis-4/rastro-f21d5d828.md` (la familia de la sucesión)

| línea del rastro | qué declaraba | por qué es falsa hoy |
|---|---|---|
| L41 | *«`reconciliation_mark` con `motivo`, `puesta_en`, `levantada_en`, quién la levantó **y el pago** \| `B/02` §2.2»* | **el pago ya no es una columna de la marca**: cuelga de `reconciliation_mark_payment`, y son N (`fd349086d`) |
| L44 | *«**«marca abierta»** definido, con su inventario de **nueve** consumidores»* | el inventario tiene **once** desde `4635068cf` (`S14` antes de abrir y `S15` antes de levantar) |
| L692 | *«sigue correcta y el arreglo la refuerza: **la marca lleva ahora la referencia al pago**»* | lleva **los pagos**, en plural y en otra entidad |

### De `23-fase-9-bis-5/rastro-93eb0a1dc.md` (familia 1, la retención y el piso)

| línea del rastro | qué declaraba | por qué es falsa hoy |
|---|---|---|
| L136-141 y L152 | *«Son cuatro conjuntos distintos: … los **trece motivos** de la marca … Los commits de esta familia no agregaron ni quitaron miembros de ninguno de los cuatro»* | **la afirmación sobre la familia 1 sigue siendo cierta** —ella no los movió— pero **la cardinalidad citada ya no es la del corpus**: son catorce. La fila `B/02` L535-537, L643, L664 de su §4 hereda la misma caducidad |

### De `23-fase-9-bis-5/rastro-2e58663f7.md` (familia 2, el pagador manual)

**Ninguna.** Lo grepeé entero: sus 243 justificaciones no nombran la marca de conciliación, su
catálogo ni el listado accionable — la única línea con la palabra *«motivo»* (L445) es *«por un
motivo distinto»* en el sentido corriente. **La familia 2 tocó `B/02` §2.3, `B/03` §7.1 y §7.2,
`B/09` §3 fila `S3` y `B/19` §4, y ninguno de esos cinco es terreno de esta familia**: el único
cruce posible era el `B/09` §3, y allá ella movió la **fila de `S3` en la tabla de puertas** y yo
las **salvedades 2 y 4** y el **recuadro del reloj**, que son párrafos distintos. Verificado
abriendo los dos diffs.

---

## 7. Preguntas para el owner

**Dos, y las dos cuestan plata.**

1. **El default del motivo 14 quedó en NO DEVOLVER, y hay una población donde eso es discutible.**
   `B/16` §4.4 ya había decidido la regla —*«el período ya pagado no se reembolsa»*, con
   `DEC-GRANT-001` y el §3.4 como precedente— y esta familia no la movió: lo que agregó es **quién
   pone el caso delante de una persona**. Pero `S21` tiene **cuatro** disparadores y no son
   equivalentes: en `A6` el cliente borró su propia ficha y `DEC-ADDON-001` ya dijo *«se consume»*;
   en la primera cláusula de `A5` el cliente pidió la baja; **en la tercera —se revoca el grant del
   que colgaba el ancla que era su título— el cliente no hizo nada** y pierde los días que pagó.
   **¿El default tendría que ser distinto en esa tercera?** Lo dejé uniforme porque partirlo es una
   decisión de plata y no una lectura del corpus.
2. **El default del motivo 7 quedó en DEVOLVER, con una excepción que la persona resuelve.** Las
   cuatro condiciones del `B/05` §3 sólo fallan con el pago acreditado, así que la propuesta es
   devolver; la **condición 2** fallando porque el monto de más es un precio nuevo que no se
   propagó se resuelve **aceptando el monto y reactivando**, y eso queda librado a que la persona
   lea el evento crítico. **¿Alcanza con eso, o el listado tendría que traer «cuál de las cuatro
   falló» y proponer distinto según cuál?** Lo segundo obliga a que la marca **guarde** ese dato, y
   el `B/05` §3 dice explícitamente que va en el evento y no en el motivo.

**Y una nota que no es pregunta, porque no es de esta familia**: en `B/19` §6 la fila *«las
versiones de plan retiradas»* (L199) quedó **fuera de su tabla** —hay cinco párrafos de prosa entre
la tabla y ella—, así que hoy se renderiza como texto suelto con pipes. Es anterior a esta tanda y
no lo toqué.

---
title: "FASE 8-bis-5 · B2 — máquinas, idempotencia y carreras"
linear: HOS-1352
statusSource: linear
created: 2026-09-22
updated: 2026-09-22
status: CURRENT
fase: 8
---

# FASE 8-bis-5 · B2 — máquinas, idempotencia y carreras

Sexta pasada de este vector sobre `HOS-1354`. La respuesta corta de esta vuelta es una sola frase,
y nombra al arreglo que la produjo:

> **La marca dejó de ser un booleano y pasó a ser una fila con `UNIQUE(subscription_id, motivo)
> WHERE levantada_en IS NULL` y UNA FK al pago que hay que devolver. Eso resuelve que dos motivos
> distintos no se pisen y crea el problema simétrico que nadie recorrió: dos HECHOS del mismo
> motivo sobre la misma fila colapsan en una marca y en un solo pago referenciado.** El segundo
> cobro que entra después de una baja, o después de un *Free Forever*, no tiene dónde escribirse
> — y `S13` es, por decisión escrita, la transición que llega a `CANCELLED` *«pase lo que pase con
> la llamada»*, con la salvedad 4 del `B/09` §3 existiendo precisamente porque ahí *«el primer
> aviso es el cobro»*. O sea: la repetición no es el borde, es el escenario para el que la
> salvedad se escribió.

Y una segunda, que es el patrón del que cuelgan seis hallazgos de esta vuelta: **`S22`, `S23`,
`S24` y `S25` entraron a la tabla del §3.2 y sus consumidores DENTRO del mismo capítulo no se
recontaron.** `B/03` dice hoy *«`G-R4` sigue contando **tres**»* en **cuatro** lugares y *«son
**cuatro**»* en **cuatro** más; dice *«**doce** puertas»* donde `B/09` §3 y `B/16` §4.4 dicen
**trece**; y la celda de `A5` en el §8 sigue diciendo *«las **seis** transiciones que sacan a la
principal de las filas vivas»* donde `B/16` §4.3 dice **diez**. Lo que hace que esto no sea
prolijidad es dónde cayó: **una de esas cuatro apariciones vive adentro de la tabla *«qué premisa
de otro arreglo vuelve falsa este»* del §7.2 —el mecanismo de auto-auditoría de `DEC-METH-008`—
que la vuelve a certificar como *«sigue verdadera»***.

Y una tercera: **`S17` saca filas de `PAUSED` y ninguna de las cuatro enumeraciones de *«las
salidas de `PAUSED`»* lo cuenta**, así que la obligación que `S22` y `S25` inauguraron —escribir
`fin_real` para que los topes del §26.3 no le coman al cliente meses que no usó— no llegó ni a
`S17` ni a `S13`, que son las otras dos.

**Dieciséis hallazgos. Uno `CRITICA`, seis `ALTA` —dos siguen llegando con su ID viejo—, siete
`MEDIA` —cuatro siguen llegando—, dos `BAJA` —una sigue llegando.**

**Lo que medí yo, y cómo.** Todo sobre el worktree
`/home/qazuor/projects/WEBS/hospeda-spec-hos-1352-billing-redesign`, el 2026-09-22, con el `HEAD`
en `0f46a7ede`: las **25** filas numeradas de `B/03` §3.2 (`S1`…`S25`) y las **8** de su tabla de
recorrido; las **8** filas de `B/03` §10.1 cruzadas contra 4 estados del proveedor × 9 nuestros =
**36** pares; las **13** filas de la tabla de puertas a un estado terminal de `B/09` §3 y sus
**4** salvedades y **6** comprobaciones de cero llamadas; las **13** filas del catálogo de motivos
de `B/02` §2.5; las **4** entradas de la tabla de la regla 7 de `NUCLEO/03` §1 y sus **8** casos
de *«compartir el `desde` no es compartir el par»*; las **6** filas de `A1`…`A6` de `B/03` §8; las
tablas de transiciones de las dos épicas, contadas con `rg -c '^\| # \| desde \| evento'`:
**4** en billing y **3** en verticales, **7** en total; las **38** filas del inventario de
`NUCLEO/01` §2.4. La cronología de las familias la medí con `git log -1 --format=%ct` sobre los
diez shas de rastro, no con los mensajes de commit; la autoría de una línea concreta, con
`git log -L`. **Ningún número de este informe viene de otro informe ni de un rastro**; las citas
ajenas las verifiqué contra el texto del capítulo.

Abreviaturas: `B` es `HOS-1354-…/docs/`, `V` es `HOS-1353-…/docs/`, `NUCLEO` es
`HOS-1352-…/docs/nucleo/`, y lo que no lleva prefijo es `HOS-1352-…/docs/`.

---

## CRITICA

### F-8fB2-001 — Una marca por `(fila, motivo)` y UNA FK al pago: del segundo cobro en adelante la plata del cliente queda en nuestra cuenta sin ninguna fila que la nombre, y el escenario que lo produce es el que la salvedad 4 del barrido declara normal

**Qué se rompe.** A un cliente que se dio de baja —o al que le cayó un *Free Forever*— se le sigue
cobrando todos los meses porque la cancelación en el proveedor no se aplicó. El primer cobro abre
una marca con motivo `COBRO_POSTERIOR_A_LA_BAJA` (o `COBRO_POSTERIOR_AL_GRANT`) y **con la
referencia al pago que hay que devolver**. El segundo cobro intenta abrir la misma marca sobre la
misma fila y **la base lo rechaza**. El tercero, igual. Cuando una persona resuelve la marca,
devuelve **un** pago y la cierra; los otros N-1 no están referenciados en ninguna parte, no
aparecen en el listado accionable y ningún proceso los vuelve a mirar.

**El camino.**

1. **La marca es una fila con una restricción de unicidad por motivo.** `B/02` §2.2, fila
   `reconciliation_mark`, verbatim: *«**`UNIQUE(subscription_id, motivo) WHERE levantada_en IS
   NULL`**: una fila puede tener **varias marcas abiertas a la vez, una por motivo**, y **el mismo
   motivo no se duplica sobre la misma fila**»*.
2. **Y lleva UNA referencia al pago, no una lista.** Misma celda: *«y **el pago que hay que
   devolver** cuando el motivo lo pide — **FK anulable** a `payment` **o** a `manual_payment`»*.
   Singular, y es la que el listado accionable muestra: `B/19` §6 enseña *«el pago, el monto y QUÉ
   PROPONE EL SISTEMA»* (`B/19`, fila del listado accionable).
3. **El escritor del segundo cobro es el mismo `S14` con el mismo motivo.** `B/05` §2 `C2`: *«el
   cobro es **posterior** a la cancelación … **Se pone la marca `requiere_conciliación` con motivo
   `COBRO_POSTERIOR_A_LA_BAJA`** …, **con la referencia al cobro que hay que devolver**»*. No hay
   ninguna rama para *«ya hay una abierta con ese motivo»*: ni `C2`, ni `C3`, ni `S14`, ni `B/02`
   §2.5, ni `G-R1-F` dicen qué pasa con el `INSERT` rechazado. Recorrí los cuatro.
4. **Y la repetición no es un borde: es la población que la salvedad 4 del barrido existe para
   cubrir.** `B/09` §3, salvedad 4, verbatim: *«cancelar **no emite webhook** (`EX-15`), así que si
   la llamada no se aplicó **no hay ninguna otra vía de aviso** y **el primer aviso es el
   cobro**»*. Un cobro mensual que nadie frenó produce **un hecho por ciclo**, no uno.
5. **Y sobre `S13` el diseño renuncia explícitamente a la rama de fallo, así que garantiza el
   caso.** `B/09` §3, tabla de puertas: *«`S13` → `CANCELLED` … **nuestra llamada**, y `S13` **no
   tiene rama de fallo declarada**: su destino es `CANCELLED` pase lo que pase con la llamada»*, y
   el recuadro de abajo lo razona: *«el beneficiario de un *Free Forever* **seguiría pagando todos
   los meses**»*. Ésa es exactamente la población de `COBRO_POSTERIOR_AL_GRANT`, y es multi-mes por
   construcción.
6. **Lo que el barrido sí ve no arregla lo que falta.** Sobre la fila terminal el par
   `authorized × CANCELLED` no figura en las ocho filas del §10.1, así que cae en *«divergencia
   real … marca»* con motivo `TRANSICIÓN_NO_DECLARADA` (`B/02` §2.5, motivo 6). Una persona se
   entera de que hay un preapproval vivo — **y no de cuántos cobros entraron ni de cuáles**,
   porque ese motivo tiene `no` en la columna *«¿hay plata del cliente que devolver?»* y por lo
   tanto **no lleva pago, no lleva monto y el listado no lo pone adelante** (`B/19` §6,
   `B/02` §2.5).
7. **Y el propio § declara ese desenlace inadmisible, con esas palabras, para el caso hermano.**
   `B/02` §2.5, la razón por la que la marca ganó motivo: *«lo que le llegaba a la persona era una
   fila `CANCELLED` marcada, **indistinguible de las otras doce marcas**, sin nada que dijera que
   hay plata del cliente en nuestra cuenta. **El pago se quedaba**»*. El segundo cobro está hoy en
   esa posición exacta, y la restricción que lo pone ahí es la que el arreglo agregó.

**Por qué no lo salva `S15`.** *«Se levanta **UNA** marca —la del motivo que esa persona
resolvió—, no la fila»* (`B/03` §3.2, `S15`). El grano de la resolución es el **motivo**, no el
hecho: una vez levantada, la fila vuelve a admitir un `INSERT` de ese motivo, pero los cobros que
ya llegaron mientras estaba abierta no dejaron rastro que nadie pueda re-emitir.

**Dónde lo permite el diseño.** `B/02` §2.2 (`reconciliation_mark`: el `UNIQUE` parcial y la FK
singular) y §2.5 (los trece motivos, los cuatro que devuelven plata, y la regla *«un escritor
nuevo agrega su fila»* — que cuantifica sobre escritores, no sobre hechos); `B/05` §2 `C2` y `C3`;
`B/03` §3.2 (`S13` efecto, `S14`, `S15`) y §10.1 (las ocho filas y su cierre); `B/09` §3 (la tabla
de trece puertas, la fila de `S13`, la salvedad 4 y su recuadro); `B/19` §6 (el listado
accionable); `B/20` §2 (`G-R1-F`, que vigila que la marca lleve **motivo** y que el listado
muestre el pago — **no** que haya un pago por hecho); `01-decision-log.md`, `DEC-RF-002`,
`DEC-RF-003`, `DEC-GRANT-001`.

**Severidad.** `CRITICA` — alguien paga de más y la plata se pierde de vista: es dinero del
cliente acreditado en nuestra cuenta sobre el cual el diseño no conserva ninguna referencia
accionable, en el único canal que `DEC-OBS-001` declara primario. No es reversible por el barrido,
porque el barrido compara **estados** y los cobros ya entraron.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: la familia de la sucesión** (`f21d5d828`), que
convirtió `requiere_conciliación` de columna en fila y le puso el `UNIQUE` y la FK. Antes el
defecto tenía otra forma —una marca booleana sin motivo y sin pago— y era el que `B/02` §2.5
describe; la restricción nueva resuelve la colisión **entre** motivos y deja sin recorrer la
colisión **dentro** de un motivo. Lo verifiqué con `git log -1 --format=%ct` sobre los diez shas:
`f21d5d828` es de las 18:29 del 2026-09-21, anterior a la tanda de decisiones.

**¿Lo habría encontrado el grep?** **No.** El término nuevo es
*«`UNIQUE(subscription_id, motivo)`»* / *«el mismo motivo no se duplica»*, y sus apariciones son
**dos** (`B/02` §2.2 y §2.5 punto 2), las dos escritas nuevas por ese commit y las dos correctas
sobre lo que afirman. Lo que hay que ver no es una aparición sino **un cuantificador**: la
enumeración de `B/02` §2.5 cuantifica sobre **escritores** (*«un escritor nuevo agrega su fila»*)
y el daño está en la cardinalidad de los **hechos** por escritor. Eso se cuenta cruzando el
`UNIQUE` contra la salvedad 4 del `B/09` §3, no buscando un término.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y cae en el tercer desenlace del
§1.4.** Busqué las dos apariciones en `rastro-f21d5d828.md`: la del `UNIQUE` no figura en su §3
—que declara 268 apariciones **no corregidas**— porque **es prosa que el commit escribió**, y la
obligación 2 no la alcanza. Es el modo 1 de `C1` §4.4, el que `DEC-METH-011` dejó vivo a propósito.
Y es el mismo límite que ya midieron `F-8eB2-002` y `F-8eB2-005`: **la enmienda verifica lo que el
término viejo decía, no lo que el mecanismo nuevo todavía no dice.**

---

## ALTAS

### F-8fB2-002 — La celda de `A5` en `B/03` §8 sigue enumerando SEIS transiciones que dejan huérfano a un addon y `B/16` §4.3 enumera DIEZ: sobre la tabla normativa de la máquina de addon, las cuatro bajas que la 9-bis-4 agregó no disparan la orfandad

**Qué se rompe.** Un cliente con un *Boost* recurrente pide la baja estando pausado, suspendido o
en el grace (`S22`, `S23`, `S24`), o su pausa termina sobre un plan que ya no se presta (`S25`). Su
suscripción principal sale de las filas vivas; el addon queda huérfano. Pero la tabla de
transiciones de la máquina de addon —que es donde la regla 1 del núcleo hace que un evento exista o
no exista— enumera **seis** disparadores y ninguno de los cuatro nuevos está. Quien implemente `A5`
contra esa celda deja el preapproval del addon cobrando todos los meses a alguien que ya no es
cliente, que es lo que `B/16` §4.3 llama *«el que no puede fallar»*.

**El camino.**

1. **La celda de `A5`, verbatim** (`B/03` §8): *«*«Huérfano»*es la condición de `B/16` §4.2 …,
   **nunca un estado de llegada concreto**: la pueden cumplir las **seis** transiciones que sacan a
   la principal de las filas vivas —`S3`, `S12`, `S13`, `S16`, `S17` y el espejo del §10.1—»*.
2. **`B/16` §4.3 dice diez y las nombra todas**, verbatim: *«Las transiciones que la cumplen son
   **las diez** que en `B/03` §3.2 sacan a una fila principal de las filas vivas: `S3`, `S12`,
   `S13`, `S16`, `S17`, **el espejo** … y, desde la FASE 9-bis-4, **`S22`, `S23` y `S24`** … más
   **`S25`**»*.
3. **La diferencia no es de prosa: es de tabla contra prosa.** `NUCLEO/03` §1 regla 1 gobierna la
   **tabla de transiciones**: *«lo que la tabla no declara, no pasa»*. La celda de `A5` **es** la
   tabla; `B/16` §4.3 es prosa de otro capítulo. El mismo capítulo usa ese argumento dos veces a su
   favor —`S21` existe *«porque un efecto de la tabla de addon que moviera esa columna es
   exactamente lo que la regla 1 no admite»* (`B/03` §3.2)— y acá lo deja jugar en contra.
4. **Y el §8 lo repite una segunda vez, en su propio párrafo explicativo.** `B/03` §8, *«la
   instancia que autoriza después de que su título murió»*: *«Cualquiera de **las seis**
   transiciones del `B/16` §4.3 sirve»*. Son dos apariciones del mismo número en el mismo capítulo,
   las dos citando a `B/16`, y `B/16` dice otra cosa.
5. **La consecuencia de plata está escrita por el propio corpus**: *«un preapproval huérfano sin
   cancelar es **un débito mensual a alguien que ya no es cliente** — y como mutar o cancelar no
   emite webhook, **nadie se entera desde adentro**»* (`B/16` §4.3).
6. **Y el `desde` de `A5` hace que el caso sea peor de lo que parece**: alcanza también a una
   instancia en `PENDING_AUTHORIZATION`, cuyo checkout la persona puede completar *«sin tener por
   qué saber que su título murió»* (`B/03` §8). Con el disparador incompleto, ese checkout autoriza
   por `A2` y arranca a cobrar.

**Lo que acota el daño, y por qué no lo cierra.** La **cuarta** comprobación de cero llamadas de
`B/09` §3 —*«una instancia viva cuyo objetivo ya cumple la condición de `B/16` §4.2»*— es el
backstop declarado, y su corrida es diaria. Pero su desenlace es *«la **marca** —una persona—,
nunca una cancelación automática»* (`B/09` §3, recuadro de la cuarta), así que el cobro sigue
saliendo hasta que alguien mire. Y `B/16` §4.3 lo declara *«un backstop, no el disparador»*.

**Dónde lo permite el diseño.** `B/03` §8 (la celda de `A5` y el § *«la instancia que autoriza
después»*) y §3.2 (`S22`, `S23`, `S24`, `S25`, `S21`); `B/16` §4.2 (la condición con sus tres
mitades), §4.3 (las diez y los cuatro momentos) y §4.4; `B/09` §3 (la cuarta comprobación y su
recuadro); `NUCLEO/03` §1 regla 1 (`NUCLEO`).

**Severidad.** `ALTA` — no la subo a `CRITICA` porque la cuarta comprobación del barrido delega en
la **condición** y no en la lista, así que el caso es alcanzable a diario y el daño está acotado a
la latencia del barrido más la de la persona. Lo que se rompe es que la tabla normativa
sub-declara el disparador en **cuatro** de sus **diez** puertas, y las cuatro son las que la última
tanda agregó.

**¿Es nuevo, o es el arreglo?** **Es el arreglo, y son dos familias**: la de **la baja**
(`032f761e0`, que agregó `S22` y `S23`) y la de **las ocho decisiones** (`8d6b27a12`, que agregó
`S24` y `S25`). Las dos corrigieron `B/16` §4.3 —lo declaran en sus §4: *«`B/16` §4.3 | «las seis
que sacan a una fila principal de las filas vivas» | son ocho»* y *«`B/16` §4.3 | «las ocho que
sacan a una principal» | diez, en dos pasos»*— y **ninguna bajó a `B/03` §8**.

**¿Lo habría encontrado el grep?** **Sí, y es el caso más barato de los dieciséis.** El término
viejo que se retira es *«las seis que sacan a una principal»*, y `8d6b27a12` **lo grepeó
explícitamente**: su rastro §2 lo lista entre los términos viejos (*«las ocho que sacan a una
principal»*). Un `rg "sacan a la principal de las filas vivas" B/03` devuelve hoy **dos**
apariciones, las dos con *«seis»*. El grep se declaró corrido sobre *«los 53 archivos del corpus …
incluidos los archivos que los commits tocan»* y estas dos sobrevivieron.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí, y es el primer desenlace del §1.4 por
el lado más caro: la aparición NO está en el rastro y debía estar.** Recorrí las **9** apariciones
de `B/03` que `rastro-8d6b27a12.md` §3 declara y las **10** de `B/09`: ninguna es la celda de `A5`
ni el párrafo de *«la instancia que autoriza después»*. Y `8d6b27a12` **no tocó ninguno de los
dos** (su edición en `B/03` está en §3.2, §3.3, §4, §5, §7.1 y §7.2). O sea: aparición **no
corregida, en un párrafo que el commit no tocó**, que es literalmente lo que la obligación 2 manda
escribir. Hay además un antecedente exacto, y está en el rastro de la familia anterior:
`rastro-032f761e0.md` §3 declara sobre `B/03` §8 que *«lo que sí cambió —cuántas transiciones
sacan a la principal de las filas vivas— vive en `B/16` §4.3 y **se recontó ahí**»*. Es la
justificación entera: se recontó **allá**, y la aparición de acá se dio por cubierta por el
recuento de otro archivo. **La enmienda alcanzaba, y la resolución por aparición se ejecutó mal.**

---

### F-8fB2-003 — `S17` y `S13` sacan filas de `PAUSED` y no escriben `fin_real`: la obligación que `S22` y `S25` inauguraron —con su daño nombrado— no llegó a las otras dos salidas, y las CUATRO enumeraciones de «las salidas de `PAUSED`» omiten a `S17`

**Qué se rompe.** Un cliente pausa su suscripción en el mes 1 de una pausa de 4 meses y en el mes 2
declara un cambio de plan; la sucesora autoriza y `S17` mata a la predecesora pausada. La
`subscription_pause` se queda **sin `fin_real`**. Los topes del §26.3 —4 pausas-mes por pausa, 8
acumulados en 12 meses, máximo 3 pausas— se cuentan por `user + vertical` y **sobreviven a cancelar
y volver a suscribirse** (`DEC-SUB-004`), así que sobre la suscripción nueva el cliente arrastra
una pausa contada por los meses que pidió y no por los que usó. Es, con las palabras que `S22`
escribió para sí misma, *«una pausa que se corta sin registrar su fin real **le come al cliente
meses que no usó**»*. Lo mismo con `S13`: al beneficiario de un *Free Forever* que estaba pausado,
el día que le revoquen el grant le faltan meses de pausa que nadie gastó.

**El camino.**

1. **La obligación está escrita, dos veces, con su razón.** `S22` (`B/03` §3.2): *«**Se escribe
   `fin_real` en la `subscription_pause`** … con ese mismo día: los topes del §26.3 **sobreviven a
   cancelar y volver a suscribirse** (`DEC-SUB-004`), así que una pausa que se corta sin registrar
   su fin real le come al cliente meses que no usó»*. `S25`: *«**Se escribe `fin_real` …** igual
   que `S22` y **por la misma razón**»*.
2. **`S13` sale de `PAUSED` y no lo escribe.** Su `desde` es *«toda fila viva PRINCIPAL … los seis
   estados»*, `PAUSED` entre ellos, y su celda de efectos —que recorrí entera— no nombra
   `fin_real`. Un `rg "fin_real"` sobre las dos épicas y el núcleo devuelve **12** líneas y los
   únicos escritores nombrados son `S22` y `S25`.
3. **`S17` también sale de `PAUSED`, y eso es deliberado y argumentado.** `S17` `desde`: *«la
   **predecesora**, si **sigue siendo fila viva** — las **cinco** alcanzables: `ACTIVE`,
   `GRACE_PERIOD`, `CANCEL_SCHEDULED`, **`PAUSED`**, `SUSPENDED`»*, y el § lo defiende: *«**Las
   tres primeras siguen siendo filas vivas y son el dominio de `S17`** —por eso su `desde` son
   cinco estados y no tres—»*. Las filas 1 y 2 de la tabla de recorrido llevan a una predecesora
   legal a `PAUSED` dentro de la ventana, con la columna *«¿sigue siendo fila viva?»* en **sí**.
4. **Y `S17` no figura en NINGUNA de las cuatro enumeraciones de las salidas de `PAUSED`.** Las
   recorrí una por una sobre el texto de hoy:

   | dónde | qué enumera | cuántas |
   |---|---|---|
   | `B/03` §3.2, *«`S10` es la única salida … que devuelve el servicio»* | *«`PAUSED` tiene **otras tres** salidas … `S22` …, `S13` … y **`S25`**»* | 3 |
   | `B/03` §3.3, celda de `PAUSED` | *«`ACTIVE` es `S10`, y `CANCELLED` es **`S22`** …, `S13` … y **`S25`**»* | 3 |
   | `B/09` §3, recuadro de la quinta comprobación | *«**Las otras tres salidas de `PAUSED`** … `S22` …, `S13` … y **`S25`**»* | 3 |
   | `B/03` §5, encabezado | *«sale por S10 — o termina, sin reanudar, por **`S22`** … o por `S13`… **Las dos** terminales»* | **2** |

   Las cuatro omiten `S17`; la cuarta omite además `S25`, que su propia celda *«quién la termina»*
   sí nombra.
5. **Y el único detector no puede verlo.** La quinta comprobación de cero llamadas de `B/09` §3
   exige *«una `subscription_pause` **sin `fin_real`** cuyo **`fin_previsto` ya pasó** … **y su
   suscripción sigue en `PAUSED`**»*. Después de `S17` o de `S13` la suscripción está `CANCELLED`,
   así que la tercera condición no se cumple — y el § lo dice él mismo como si fuera la prueba de
   que no hay problema: *«el caso sale del detector por donde corresponde»*.
6. **Y el `UNIQUE` de la base tampoco.** *«A lo sumo una sin `fin_real` **por suscripción**»*
   (`B/02` §2.2): la pausa colgada vive sobre una suscripción muerta que nunca va a tener otra, así
   que la restricción se cumple mientras el dato se pierde.

**Dónde lo permite el diseño.** `B/03` §3.2 (`S13` efecto, `S17` `desde`, `S22`, `S25`, la tabla
de recorrido filas 1 y 2, y el § de `S10`) y §3.3 y §5; `B/02` §2.2 (`subscription_pause` y su
restricción); `B/09` §3 (la quinta comprobación y su recuadro); `B/20` §2 (`G-R5`, que compara el
**tope declarado** y no el tiempo de una fila); `01-decision-log.md`, `DEC-SUB-004`, `DEC-SUB-010`,
`DEC-SUB-015`.

**Severidad.** `ALTA` — un dato se pierde sin vuelta: `fin_real` no se puede reconstruir después
(el instante en que la pausa se cortó no queda en ninguna otra columna), y lo que se le retira al
cliente es una capacidad declarada que *«sobrevive a cancelar y volver a suscribirse»*. No la subo
a `CRITICA` porque no mueve plata directamente y el camino de `S13` es raro; el de `S17` **es el
camino normal del cambio de plan** sobre una fila que la misma tabla declara legal en `PAUSED`.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: la familia de la baja** (`032f761e0`, `S22`) y
**la tanda de las ocho decisiones** (`8d6b27a12`, `S25`). Antes de ellas **nadie** escribía
`fin_real` en ninguna salida terminal, así que la omisión era pareja y no señalable; el arreglo
creó la obligación, escribió su daño, y la repartió a dos de las cuatro salidas.

**¿Lo habría encontrado el grep?** **Sí.** El término nuevo es *«`fin_real`»*, y `032f761e0` lo
declara en su §2 entre los términos grepeados (*«`fin_real` escrito por la …»*). Un
`rg "fin_real"` devuelve hoy **12** líneas sobre las dos épicas y el núcleo; poner al lado el
`desde` de `S17` —que el mismo commit no tocó pero que está en el mismo § que sí tocó— cierra la
comprobación. Lo que faltó fue recorrer el `desde` de `S17` contra `PAUSED`, que es lo mismo que
faltó en las cuatro enumeraciones.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Está en el rastro y su justificación no
alcanza: es el primer desenlace del §1.4.** `rastro-032f761e0.md` §3, sobre `B/02` §2.2:
*««… fin real | a lo sumo una sin `fin_real` por suscripción» → **sigue correcta, y `S22` la
respeta**: escribe `fin_real` al cancelar, así que **no deja una pausa abierta sobre una fila
muerta**»*. La justificación es verdadera **sobre `S22`** y la conclusión que sostiene —que no
quedan pausas abiertas sobre filas muertas— es **falsa**, porque `S13` y `S17` las dejan y las
dejaban ya ese día. Resolver esa aparición obligaba a preguntar *«¿quién más deja una fila muerta
con la pausa abierta?»*, y la respuesta estaba en el `desde` de `S17`, doce líneas más arriba en el
archivo que ese mismo commit editó. **La regla se ejecutó y la resolución estuvo mal.**

---

### F-8fB2-004 — El espejo del §10.1 escribe `S10` sobre `authorized × PAUSED` y declara su condición cumplida por la relectura, pero desde `DEC-SUB-015` `S10` lleva una SEGUNDA guarda cuya rama falsa es `S25`: el espejo elige una de las dos filas de un par por su nombre, sin leer el booleano que las separa

**Qué se rompe.** El espejo es *«la defensa central contra el desorden de webhooks»* y es el único
camino por el que un estado del proveedor se escribe en nuestra fila. Su fila
`authorized × PAUSED` manda ejecutar `S10` — reanudar — y afirma que su condición **ya está
cumplida**. Desde `DEC-SUB-015` la condición de `S10` tiene dos conjuntos y el espejo sólo
establece uno. Cuando el otro es falso, la transición que corresponde es `S25`, que va a
`CANCELLED` **y cancela el preapproval**: dos destinos opuestos sobre el mismo par. El espejo
escribe el que nombró.

**El camino.**

1. **La fila del espejo, verbatim** (`B/03` §10.1): *«| `authorized` | `PAUSED` | **`S10`**: el
   proveedor reanudó. Espejar — **y acá la condición de `S10` ya está cumplida, porque esta lectura
   ES la relectura que la fila pide** |»*.
2. **La condición de `S10` hoy tiene dos mitades y la frase sólo cubre la segunda.** `B/03` §3.2,
   `S10`, columna *condición*, verbatim: *«**el plan al que la fila está anclada se sigue
   prestando** —es la guarda que la separa de `S25`, ver abajo— **y el `PUT` se aplicó, confirmado
   por relectura**»*. *«Esta lectura ES la relectura»* satisface la segunda. **La primera no se
   evalúa en ninguna parte del §10.1.**
3. **Y la rama falsa de esa primera mitad no es *«no hacer nada»*: es otra fila con otro destino.**
   `S25`: mismo `desde`, **mismo evento**, guarda *«el plan … **ya NO se presta**»*, `hacia`
   `CANCELLED`, y su efecto **cancela** el preapproval en vez de mandar `PUT status=authorized`.
   `NUCLEO/03` §1 regla 7 lo registra como la **cuarta** entrada de su tabla de pares con dos
   filas: *«`(PAUSED, llega el fin de la pausa o la persona vuelve antes)` | `S10` / `S25` | si el
   plan al que la fila está anclada **se sigue prestando**»*.
4. **Elegir por nombre es exactamente lo que la regla 7 prohíbe.** Su enunciado: *«**No se dirime
   por precedencia**, porque una precedencia es una séptima cosa que hay que acordarse de leer: se
   exige que **las condiciones no se puedan satisfacer las dos a la vez**»*, y *«**Qué pasa si
   igual se solapan**: el intento **cae en la regla 1**»*. El espejo no dirime por precedencia ni
   por guarda: **nombra la fila**, que es la séptima cosa que hay que acordarse de leer, escrita en
   otro capítulo.
5. **El caso es alcanzable y está medido de nuestro lado.** El par `authorized × PAUSED` existe
   precisamente porque la pausa se pudo no aplicar: `EX-20` mide que un `PUT` con varios campos
   *«se aplica a medias con un solo `200`»* y `EX-15` que mutar **no emite webhook** (`B/03` §10.4).
   Con la pausa no aplicada, nuestra fila dice `PAUSED` y la relectura dice `authorized`. Y la
   relectura ocurre sobre **cualquier** evento del preapproval, no sólo sobre uno de pausa.
6. **El desenlace no tiene salida declarada.** La fila queda `ACTIVE` sobre un plan que ya no se
   presta, y el propio capítulo declara que desde ahí no hay transición: *«el acto de la
   discontinuación **no tiene fila numerada para NINGÚN estado**, no sólo para `PAUSED` … hoy ese
   movimiento cae en la marca desde `ACTIVE`, desde `GRACE_PERIOD`, desde `SUSPENDED` y desde
   `PENDING_AUTHORIZATION`»* (`B/03`, *«Lo que esta mitad NO cierra»*). El cliente vuelve a estar
   cobrando y el arreglo que `DEC-SUB-015` eligió —que la fila muera al terminar la pausa— no
   ocurre nunca.

**Lo que NO estoy reportando acá.** No reabro la discontinuación de una vertical: el owner la
declaró fuera de alcance (§4 de las instrucciones). Lo que reporto es que **el espejo escribe una
fila de un par con dos filas sin leer la guarda que las separa**, que es un defecto de la máquina y
no del escenario. La discontinuación es hoy el único valor falso conocido de esa guarda; el defecto
es que el espejo no la lee, y eso vale para cualquier guarda que `S10` gane mañana.

**Dónde lo permite el diseño.** `B/03` §10.1 (la fila `authorized × PAUSED` y el recuadro *«espejar
es una transición declarada de esta tabla»*) y §10.4 (`EX-15`, `EX-20`) y §3.2 (`S10` condición,
`S25`, y el § *«`S25` comparte el par de `S10`»*); `NUCLEO/03` §1 regla 7 (`NUCLEO`); `B/10` §4.3;
`01-decision-log.md`, `DEC-SUB-015`.

**Severidad.** `ALTA` — hay plata (una fila reanudada vuelve a cobrar) y el estado de llegada no
tiene transición de salida declarada, pero la población conocida hoy es la que el owner declaró que
no va a ocurrir, así que no la subo.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: la tanda de las ocho decisiones** (`8d6b27a12`,
`DEC-SUB-015`), que le agregó a `S10` la primera mitad de su condición. La frase del §10.1 la
escribió la familia de **la retención** (`52efd38fb`, medido con
`git log -1 -L 1800,1801:…/03-maquinas-de-estado.md`), y **era verdadera cuando se escribió**:
entonces la única condición de `S10` era la relectura que ese mismo commit le puso.

**¿Lo habría encontrado el grep?** **Sí.** El término nuevo es *«el plan al que la fila está
anclada se sigue prestando»* / *«`S25`»*, y `8d6b27a12` declara en su §2 haber grepeado `S25`
*«con y sin backticks, incluidos los archivos que los commits tocan»*. Un `rg "S10" B/03` devuelve
hoy la fila del §10.1 entre sus apariciones, y es la única del capítulo que **ejecuta** `S10` desde
afuera del §3.2.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí, y es el segundo desenlace del §1.4: la
aparición NO está en el rastro y debía estar.** Recorrí las 9 apariciones de `B/03` que
`rastro-8d6b27a12.md` §3 declara: ninguna es del §10.1. Y el commit **no tocó el §10.1** (sus
ediciones en `B/03` están en §3.2, §3.3, §4, §5, §7.1 y §7.2). Es una aparición no corregida, en un
párrafo que ese commit no tocó, de un término que él mismo declara haber grepeado. **La enmienda
alcanzaba y no se ejecutó sobre esa aparición.** Vale decir, para no acreditarle de más al defecto,
que la familia **anterior** sí declaró el §10.1 en su rastro (`rastro-032f761e0.md` §3, L1611-1632)
y su justificación —que las tres cifras del recuadro son **ordinales** y no totales— la verifiqué
y **es correcta y sigue siéndolo hoy**. Lo que ese rastro miró fue el recuadro; la fila del
`authorized × PAUSED` no estaba en su dominio porque `S25` todavía no existía.

---

### F-8fB2-005 — `S24` fija la fecha de fin de servicio en el día de la baja sobre un período que el reciclado del proveedor pudo haber pagado minutos antes, y `C2` declara inaplicable su propia primera fila —la que dice «decide la fecha del hecho»— justo donde el hecho es anterior

**Qué se rompe.** Un cliente en `GRACE_PERIOD` decide irse. Su cuota impaga sigue en `recycling` y
el proveedor la cobra a las 10:00; nosotros procesamos ese cobro a las 10:30, porque el retraso
está medido *«entre 26 y 44 minutos»*. A las 10:05 el cliente pide la baja: nuestra fila todavía
dice `GRACE_PERIOD`, así que corre `S24` y **la fecha de fin de servicio es hoy**. A las 10:30
llega un pago acreditado que cubre el período entero, la condición 1 del `B/05` §3 lo rechaza por
`CANCELLED`, y el cobro se trata como **posterior** a la baja. El cliente pagó un mes y recibió
cinco minutos, y la devolución de lo que corresponda queda en el juicio de una persona bajo un
motivo que nombra el caso al revés.

**El camino.**

1. **La regla de `C2` es explícita y es la primera línea del §.** `B/05` §2 `C2`: *«**Decide la
   fecha del hecho, no la de llegada**»*, con su primera fila: *«el cobro es **anterior** a la
   cancelación | es legítimo: el cobro es **por adelantado**, así que **pagó el período que va a
   usar**. **Se extiende la fecha de fin de servicio** hasta cubrirlo»*.
2. **Y el mismo § declara que sobre las tres bajas nuevas esa fila no tiene dónde aplicarse**:
   *«Las dos filas presuponen que la baja dejó una fecha de fin de servicio que se pueda extender,
   y eso vale para `S11` y **no para las otras tres**. Desde `PAUSED` (`S22`), desde `SUSPENDED`
   (`S23`) y desde `GRACE_PERIOD` (`S24`) la fila va **directo a `CANCELLED`** …, así que **no hay
   nada que extender y la primera fila no tiene dónde aplicarse**»*.
3. **Para `PAUSED` y `SUSPENDED` la conclusión se sostiene sola; para `GRACE_PERIOD` no.** El
   propio § lo argumenta bien en los dos primeros —en pausa *«el proveedor **no cobra**»* (`PS-6`),
   y en `SUSPENDED` *«el cobro que entra es el que `S7` o `S19` esperaban, y **llega tarde**»*—.
   Para el grace escribe: *«el cobro que entra es el reciclado del proveedor, **y llega tarde**.
   `S24` canceló el preapproval «de inmediato» …, así que **lo que puede entrar después es un cobro
   que ya estaba en vuelo**»*. *«Ya estaba en vuelo»* es precisamente un hecho cuya **fecha es
   anterior**, que es el sujeto de la primera fila.
4. **La premisa de `S24` es que el período no está pagado, y durante el grace eso puede dejar de
   ser cierto sin que nosotros lo sepamos todavía.** `S24` (`B/03` §3.2): *«**el grace existe
   porque el cobro del período en curso falló**, así que no hay período pagado que sostener»*. Pero
   el grace dura *«los días que declara la versión de plan, default **10**»* (`B/03` §4) y durante
   ellos *«la cuota impaga **sigue en `recycling`** del lado del proveedor, que la reintenta solo»*
   (`B/03` §3.2, `S19`). Un reintento exitoso vuelve la premisa falsa; el desfase entre el hecho y
   nuestro procesamiento está medido en el mismo capítulo: *«el retraso del proveedor es
   **variable y no predecible** —33 minutos en una renovación de sandbox, ~26 en producción—»*
   (`B/05` §2 `C2`, y `B/03` §4 lo repite).
5. **Y el motivo con el que llega al listado accionable nombra el caso al revés.**
   `COBRO_POSTERIOR_A_LA_BAJA` (`B/02` §2.5, motivo 2) sobre un cobro cuyo hecho es **anterior**.
   El § mitiga pidiendo que el listado muestre *«el pago, el monto y **desde cuándo la fila estaba
   en grace**»* — pero no **la fecha del hecho contra la de la baja**, que es el dato que la propia
   regla del § declara decisivo.

**Dónde lo permite el diseño.** `B/05` §2 `C2` (la regla, sus dos filas, el párrafo de las otras
tres bajas y el bullet de `GRACE_PERIOD`) y §3 condición 1; `B/03` §3.2 (`S24`, `S19`, `S5`) y §4
(la duración del grace y el margen del reloj); `B/02` §2.5 (motivo 2); `B/19` §6;
`01-decision-log.md`, `DEC-SUB-014`, `DEC-SUB-009`, `DEC-RF-002`.

**Severidad.** `ALTA` — el cliente paga un período que no usa, pero la plata queda referenciada
(el motivo lleva la FK al pago) y una persona decide. No la subo a `CRITICA` por eso; sí vale que
es **la única de las cuatro bajas que retira cobertura que estaba corriendo** (el propio `S24` lo
dice), así que es la que más tiene para devolver y la única cuya regla general se declaró
inaplicable sin recorrer el caso anterior.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: `DEC-SUB-014`** (`8d6b27a12`), que creó `S24` y
escribió el bullet de `GRACE_PERIOD` en `C2`. El párrafo *«las otras tres»* es de la familia de la
baja (`032f761e0`, que escribió *«las otras dos»*) y `8d6b27a12` lo pasó a tres — lo declara en su
§4: *«`B/05` C2 | «las otras dos» bajas sin fecha que extender | las otras tres»*.

**¿Lo habría encontrado el grep?** **No.** El término es *«el cobro es anterior a la
cancelación»*, y sus apariciones son **una**: la fila de la tabla, que no se corrigió porque no
había nada que corregirle. Lo que hay que ver no es una aparición sino que **la fila nueva quedó
fuera del dominio de la regla del propio §**, que se cuenta cruzando la duración del grace contra
el retraso medido del proveedor.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y cae en el modo 1 de `C1` §4.4.** El
bullet de `GRACE_PERIOD` que declara *«la primera fila no tiene dónde aplicarse»* **es prosa que
`8d6b27a12` escribió**, y la fila de la tabla que contradice está en el mismo bloque que ese commit
editó. Ninguna de las dos cae en *«no corregida y en un párrafo que el commit no tocó»*. Es la
exclusión que `DEC-METH-011` dejó viva a propósito, y la que esta pasada tiene por encargo medir:
**un párrafo editado no es un párrafo verificado, y el párrafo que se agrega debajo de una regla no
verifica la regla.**

---

### F-8cB2-005 (sigue llegando) — El espejo sigue teniendo ocho filas sobre treinta y seis pares, y ahora es además el que ejecuta `S10` sin su guarda: la tabla que marca la cartera sana entera es la misma que escribe la transición equivocada

**Qué se rompe.** Lo mismo que medí en la 8-bis-2 y que `C1` dejó en `ALTA`: la tabla del §10.1
enumera **ocho** filas sobre un dominio de **4 estados del proveedor × 9 nuestros = 36 pares**, y
su cierre dice *«Lo que **no** figura acá es divergencia real, y ahí la marca es la respuesta
correcta»*. El par más común del sistema —`authorized × ACTIVE`, toda renovación normal— sigue sin
figurar.

**En qué paso llega hoy.** Recontado sobre el texto de hoy, con `HEAD` en `0f46a7ede`: la tabla
sigue con **ocho** filas y dos comodines, sin un solo cambio de contenido respecto de la vuelta
anterior. `pending` cubre 2; `authorized` cubre `PENDING_AUTHORIZATION`, `PAUSED` y
`GRACE_PERIOD`·`SUSPENDED`, y deja afuera `ACTIVE`, `CANCEL_SCHEDULED` y los tres terminales;
`paused` cubre sólo `ACTIVE`; `cancelled` cubre `CANCEL_SCHEDULED` y los cinco vivos restantes y
deja afuera los tres terminales — o sea que **toda** fila que el barrido devuelve por la salvedad 4
(`S12`, `S3`, `S13`, `S20`, `S22`, `S23`, `S24`, `S25` y la lápida: **nueve** de las trece puertas)
produce, al releerse, un par no enumerado sobre una fila ya terminal.

**Lo nuevo de esta vuelta, y es lo que lo mantiene en `ALTA`.** La tabla ganó dos cargas más:
(a) sus filas son hoy la **única** vía por la que el corpus ejecuta una transición del §3.2 desde
afuera del §3.2, y una de ellas lo hace sin leer una guarda que existe desde esta tanda
(`F-8fB2-004`); y (b) el par `authorized × CANCELLED` —no enumerado— es el que decide si una
persona se entera de que un preapproval sigue cobrando después de una baja, que es la mitad
detectable de `F-8fB2-001`.

**Dónde lo permite el diseño.** `B/03` §10.1 (las ocho filas, el bloque de cierre y el recuadro de
las cuatro consecuencias) y §3.1 (los nueve estados); `B/02` §2.2 (los seis vivos y los tres que
no); `B/09` §3 (la tabla de trece puertas y la salvedad 4).

**Severidad.** `ALTA`, la que `C1` ya le fijó en la 8-bis-2. No la subo: el desenlace es una
inundación de marcas, no un cobro mal hecho — pero es la inundación la que entierra los dos únicos
detectores que sí mueven plata.

**¿Es nuevo, o es el arreglo?** Es **`F-8cB2-005` que sigue llegando**, con su ID viejo. La 9-bis-4
**no tocó la tabla**: lo verifiqué contra el texto y contra los diez rastros — la única aparición
del §10.1 declarada en todos ellos es `rastro-032f761e0.md` L1611-1632, y es sobre el **recuadro**,
no sobre las filas.

**¿Lo habría encontrado el grep?** No aplica: el hallazgo es anterior y la tanda no editó la tabla.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No**, y por una razón que vale anotar: el
defecto es un **conteo de cobertura sobre un producto cartesiano**, y ningún rastro por término
produce eso. Es el mismo límite que ya midieron `F-8dB2-012` y `F-8eB2-010`.

---

### F-8dB2-006 (sigue llegando) — `S17` y `S18` siguen compartiendo `(ACTIVE, la sucesora quedó autorizada)` y lo que las separa sigue siendo un ROL escrito en la columna `desde`: la regla 7 pasó de cinco salvedades a OCHO y el único par que comparte también el evento sigue sin estar en ninguna

**Qué se rompe.** Lo mismo que reporté en la 8-bis-3 y en la 8-bis-4: el único control de la regla
7 del núcleo es un guard definido sobre `(desde, evento)`, y la columna `desde` de `B/03` §3.2 **no
contiene sólo estados**. Con eso `G-R4` o cuenta un quinto par y se pone en rojo sobre el camino
normal de todo cambio de plan, o está anclado en el texto y no verifica la propiedad que dice
verificar.

**En qué paso llega hoy.** Recontado sobre el texto de hoy:

1. **`S17`**: `desde` = *«la **predecesora**, si sigue siendo fila viva — las cinco alcanzables:
   **`ACTIVE`**, `GRACE_PERIOD`, `CANCEL_SCHEDULED`, `PAUSED`, `SUSPENDED`»*, evento = *«su
   sucesora quedó **autorizada**, confirmado por relectura»*, `hacia` `CANCELLED`.
   **`S18`**: `desde` = *«la **sucesora viva**: en **`ACTIVE`**…»*, evento = *«**la misma
   autorización que disparó `S2`**…»*, `hacia` *«el mismo estado»*. Mismo estado de origen, mismo
   hecho del mundo, dos destinos distintos.
2. **Las condiciones siguen sin separarlas.** `S17`: *«la fila tiene una **sucesora viva** con
   `sucede_a` apuntándola»* — la predecesora la cumple. `S18`: *«la predecesora **ya no es fila
   viva**»* — sobre una fila que no tiene predecesora eso es **vacuo**, no falso.
3. **Y la tanda demostró otra vez que sabe escribir la salvedad, y la escribió tres veces más.**
   `NUCLEO/03` §1 regla 7 enumera hoy **ocho** casos de *«compartir el `desde` no es compartir el
   par»* —`T7`, `S18` desde `PENDING_AUTHORIZATION`, `A5` desde `PENDING_AUTHORIZATION`,
   `PB7`/`PB8`, `S20`/`S21`, y **`S22`, `S23` y `S24`**, los casos sexto, séptimo y octavo—, y
   `B/03` §3.2 y §7.1 agregan los suyos (`S13`/`S20`, `S21`, `MP4`). **El par `S17`/`S18` no
   aparece en ninguna de las once salvedades**, y sigue siendo el único de todas ellas donde
   `desde` y evento coinciden de verdad.
4. **Y la tabla de pares con dos filas creció a cuatro sin incorporarlo**: `T1`/`T6`, `S5`/`S19`,
   `S7`/`S19` y —desde esta tanda— `S10`/`S25`. La regla sigue delegando: *«**Que sean cuatro y no
   cinco no es una afirmación de este capítulo: es lo que `G-R4` cuenta en cada PR**»*.

**Dónde lo permite el diseño.** `NUCLEO/03` §1 regla 7 (`NUCLEO`); `B/03` §3.2 (recorrí las **25**
filas: **nueve** celdas `desde` no son estados — `S13`, `S14`, `S15`, `S17`, `S18`, `S19`, `S20`,
`S21` y el comodín de `S15`); `B/20` §2 (`G-R4`); `V/20` §2; `V/03` §2.

**Severidad.** `ALTA` — el par sigue siendo disjunto de verdad (los dos candados de `B/02` §2.2 lo
garantizan), así que no mueve plata por sí solo. Lo que queda sin apoyo es la regla que garantiza
que **los próximos** pares lo sean, sobre una tabla que pasó de diecinueve filas a **veinticinco**
en dos tandas.

**¿Es nuevo, o es el arreglo?** Es **`F-8dB2-006` que sigue llegando**, con su ID viejo. La mitad
nueva es de la tanda: la regla 7 pasó de cinco salvedades a ocho y su tabla de pares de tres a
cuatro, **las dos cosas recontadas explícitamente**, sin que el par que las motiva entre en
ninguna de las dos.

**¿Lo habría encontrado el grep?** **No**, por la razón de siempre: lo que hay que comprobar no es
una aparición del término sino **contar pares recorriendo la tabla**, que es lo que hace el propio
guard.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** Verifiqué las tres apariciones de
`NUCLEO/03` que `rastro-f21d5d828.md` declara y las del §4 de `rastro-8d6b27a12.md`: las dos
familias **editaron el bloque** de *«compartir el `desde` no es compartir el par»* para agregarle
casos, así que ninguna aparición cae en *«no corregida y en un párrafo que el commit no tocó»*.
Mismo modo de falla que `F-8eB2-002`: un párrafo editado no es un párrafo verificado.

---

## MEDIAS

### F-8fB2-006 — «`G-R4` sigue contando TRES» sobrevive en cuatro lugares de `B/03` contra «cuatro» en cuatro más, y una de las cuatro vive adentro de la tabla «qué premisa de otro arreglo vuelve falsa este», que la vuelve a certificar como «sigue verdadera»

**Qué se rompe.** El número contra el cual se audita la regla 7 del núcleo está escrito ocho veces
en el mismo capítulo con dos valores distintos, y el mecanismo que la tanda usa para no dejar
premisas caducas —la tabla *«qué premisa de otro arreglo vuelve falsa este»* de la obligación 2 de
`DEC-METH-008`— evaluó exactamente esta afirmación y la declaró vigente.

**El camino.** Recontado con `rg` sobre `B/03` el 2026-09-22:

| línea | qué dice | ¿correcto? |
|---|---|---|
| §3.2, `S19` | *«los pares con dos filas … hoy son **cuatro** y el cuarto lo agregó `S25`»* | sí |
| §3.2, la baja | *«**La tabla de pares con dos filas no crece por la baja** — pero sí crece por `S25`»* | sí |
| §3.2, `S25` | *«es el **CUARTO** par con dos filas del programa … **Con éste son cuatro**»* | sí |
| §3.2, `S13`/`S20` | *«los pares con dos filas de esta tabla no crecen por `S20`/`S21`**— hoy son **cuatro**»* | sí |
| §7.2, *«lo que NO cambia»* | *«los pares con dos filas son **cuatro** desde `S25`»* | sí |
| **§3.2, `S21`** | *«`S21` no agrega ningún par con dos filas, así que **`G-R4` sigue contando tres**»* | **no** |
| **§7.1, `MP4`** | *«`MP4` no agrega ningún par con dos filas, así que **`G-R4` sigue contando tres**»* | **no** |
| **§8, `A5`** | *«**no hay un cuarto par con dos filas** y la tabla de la regla 7 del núcleo sigue teniendo **tres** entradas»* | **no** |
| **§7.2, tabla de premisas** | *«*«`MP4` no agrega ningún par, así que `G-R4` sigue contando tres»*… **sigue verdadera**»* | **no** |

La fuente contra la que las medí es `NUCLEO/03` §1 regla 7, cuya tabla tiene hoy **cuatro** filas
—`T1`/`T6`, `S5`/`S19`, `S7`/`S19`, `S10`/`S25`— con el texto *«Los **cuatro** son disjuntos por
construcción»* y *«Que sean cuatro y no cinco … es lo que `G-R4` cuenta en cada PR»*.

**Por qué la cuarta fila de esa lista es distinta de las otras tres.** Las otras tres son
apariciones que nadie volvió a leer. Ésa es una aparición que **alguien volvió a leer y declaró
verdadera**, en la tabla que existe para eso, y en el mismo § cuyo bullet de diez líneas más arriba
dice *«cuatro»*. Una contradicción a diez líneas de distancia, con una de las dos mitades firmada
por el mecanismo de auto-auditoría.

**Y afuera de `B/03` hay una quinta**, que dejo nombrada para `C1` porque es de la otra épica:
`V/03` §2 dice *«`T7` **no es un cuarto par** de `G-R4` y no toca **los tres** declarados»*.

**Dónde lo permite el diseño.** `B/03` §3.2, §7.1, §7.2 y §8; `NUCLEO/03` §1 regla 7 (`NUCLEO`);
`B/20` §2 (`G-R4`); `V/03` §2.

**Severidad.** `MEDIA` — no hay daño de plata y el guard, si existe, cuenta la tabla y no el texto.
Lo que queda mal es el número contra el cual una persona audita la regla, y que el mecanismo que la
tanda construyó para que eso no pase lo certificó al revés.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: la tanda de las ocho decisiones** (`8d6b27a12`,
`DEC-SUB-015`), que creó `S25` y con él el cuarto par. Las cuatro apariciones falsas son anteriores
y eran verdaderas: las escribieron la familia del grant y el addon (`ce52dce5f`, 17:55) y la del
pagador manual (`8f9f31ac0`, 17:12), las dos antes de `8d6b27a12` (20:17) — medido con
`git log -1 --format=%ct` sobre los diez shas.

**¿Lo habría encontrado el grep?** **Sí, y el commit declara haberlo corrido.** El término viejo
que se retira figura en el §2 de `rastro-8d6b27a12.md` entre los grepeados: *«*«tres pares»*/
*«el único par con dos destinos»*»*. **Pero el corpus no dice *«tres pares»*: dice *«`G-R4` sigue
contando tres»* y *«la tabla de la regla 7 … sigue teniendo tres entradas»*.** El término retirado
se nombró por su forma abreviada y las cuatro apariciones vivas están escritas en otras dos formas.
Un `rg "contando tres|tres entradas"` sobre `B/03` devuelve las cuatro en una línea cada una.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Las cuatro están cubiertas por alguna línea
de rastro y las cuatro salieron mal: es el primer desenlace del §1.4, cuatro veces.**

- `rastro-ce52dce5f.md` §3, L794-800: *««`S21` no agrega ningún par con dos filas, así que `G-R4`
  sigue contando **tres** …» → **sigue correcta**»*. **Falsa hoy.** Era verdadera al escribirse.
- `rastro-032f761e0.md` §3, `B/20` §2: *«y `G-R4` cuenta **pares**, que **siguen siendo tres**»*.
  **Falsa hoy.** Era verdadera al escribirse.
- `rastro-f21d5d828.md` §3, `NUCLEO/03` L79-89: *«Y los **tres** pares con dos filas siguen siendo
  tres»*. **Falsa hoy**, aunque el corpus sí se corrigió ahí.
- `rastro-8d6b27a12.md` §4, fila 13: declara corregida la premisa *«tres pares»* **en `B/03` §7.1 y
  §7.2**. Medido contra el texto de hoy: en `§7.2` se corrigió **un** bullet y quedó sin corregir
  **la tabla de premisas del mismo §**; en `§7.1` quedó sin corregir **la única aparición que había
  ahí**. O sea que la fila declara una corrección que se ejecutó a la mitad, sobre los dos § que
  nombra.

---

### F-8fB2-007 — `B/03` §7.1 y §7.2 dicen que el barrido tiene DOCE puertas a un estado terminal y `B/09` §3 y `B/16` §4.4 dicen TRECE: falta `S25`, exactamente, y el mismo rastro declara esa premisa corregida en esos dos §

**Qué se rompe.** El conteo contra el que se audita si toda transición que lleva una fila a un
estado terminal pasó por el veredicto de exención del barrido está escrito con dos valores. La que
falta es `S25`, cuya fila **sí** existe en `B/09` §3 con su veredicto *«no»*, o sea que el defecto
es de conteo y no de cobertura — pero el conteo es lo único que permite preguntar *«¿están
todas?»*, y contesta que sí faltando una.

**El camino.**

1. `B/03` §7.1, *«lo que NO cambia»*: *«Sus puertas son **doce** desde que `S22`, `S23` y `S24` le
   agregaron tres»*.
2. `B/03` §7.2, *«lo que NO cambia»*: *«sus puertas son **doce** desde `S22`, `S23` y `S24`»*.
3. `B/09` §3: *«sobre un conjunto de **trece** puertas a un estado terminal»*, y su tabla tiene
   **trece** filas: `S16`, el espejo, `S17`, `S12`, `S3`, `S13`, `S20`, `S21`, `S22`, `S23`, `S24`,
   **`S25`** y la lápida. Las conté una por una.
4. `B/16` §4.4: *«la tabla de puertas a un estado terminal de `B/09` §3 —que hoy tiene **trece**,
   desde que `S22`, `S23`, **`S24` y `S25`** le agregaron las suyas»*.
5. La salvedad 4 del mismo `B/09` §3 lo confirma desde el otro lado: *«**nueve** de las **diez**
   filas *«no»* de la tabla de arriba: `S12`, `S3`, `S13`, `S20`, `S22`, `S23`, `S24`, **`S25`** y
   la lápida»*. Nueve más las tres exentas (`S16`, el espejo, `S17`) más `S21` = trece.

**Dónde lo permite el diseño.** `B/03` §7.1 y §7.2; `B/09` §3 (el encabezado, la tabla y la
salvedad 4); `B/16` §4.4.

**Severidad.** `MEDIA` — la fila de `S25` está y su veredicto está, así que nadie queda sin barrer.
Lo que queda mal es el número, y es el mismo modo de falla que ya costó un `ALTA` dos vueltas
atrás (`F-8dB2-007`: *«la lista que la tanda escribió para poder preguntar «¿están todas?»
contesta que sí cuando falta una»*).

**¿Es nuevo, o es el arreglo?** **Es el arreglo: la tanda de las ocho decisiones** (`8d6b27a12`),
que agregó `S25` y su fila en `B/09` §3 y movió el conteo de `B/09` de once a trece sin bajar a
`B/03`.

**¿Lo habría encontrado el grep?** **Sí, y el commit lo declara grepeado dos veces**: su §2 lista
el término nuevo *«doce/trece puertas a un estado terminal»* **y** el término viejo *«once
puertas»*. Un `rg "puertas" B/03` devuelve hoy **dos** apariciones y las dos dicen *«doce»*.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Está en el rastro y la resolución salió mal:
primer desenlace del §1.4.** `rastro-8d6b27a12.md` §4 fila 13 declara, textual, que en `B/03` §7.1
y §7.2 la premisa *«once puertas»* pasó a *«doce/trece»*. El propio destino está escrito con dos
valores separados por una barra, que es la forma de anotar una corrección que no se decidió: hoy
las dos apariciones quedaron en el valor menor y el capítulo que las contiene es el único del
corpus que dice doce.

---

### F-8fB2-008 — El mismo § cuenta los caminos por los que `S18` corre sin `S17` de tres maneras en cien líneas: seis enumerados, cinco contados dos veces, y tres en el argumento que sostiene que ninguno deja viva una autorización

**Qué se rompe.** El conjunto sobre el que se reparte la única transición que cierra una sucesión
—y del que cuelgan las dos escrituras condicionales de `S18`, la rama 6 de `B/12` §5.3 y el
argumento de que el candado `A` nunca queda vacío— tiene tres cardinalidades en el mismo §, y el
argumento de seguridad está escrito sobre la más chica.

**El camino.** Las tres redacciones, verificadas contra el texto de hoy:

| dónde | qué dice | cuántos |
|---|---|---|
| `B/03` §3.2, *«por qué `S18` también sale de `PENDING_AUTHORIZATION`»*, primer párrafo | *«por `S12`, por `S16`, por el espejo del §10.1, o porque ella misma pidió la baja estando pausada (`S22`), suspendida (`S23`) o **en el grace (`S24`)**»* | **6** |
| mismo §, catorce líneas más abajo | *«Muerta la predecesora por cualquiera de esos **cinco** caminos»* | **5** |
| mismo §, el bloque de la asimetría | *«`S18` sin `S17` es lo CORRECTO en los **CINCO** caminos … —`S12`, `S16`, el espejo del §10.1, `S22` y `S23`—»* | **5**, y `S24` no está |
| mismo bloque, la frase siguiente | *«y en ninguno de **los tres** deja viva una autorización»*, seguido de la enumeración de `S12`, `S16` y el espejo, y rematado con *«su advertencia … es falsa en **los tres**»* | **3** |

La cuenta correcta es **seis**, y la da la propia fila de `S18`: su segundo evento nombra los seis.
El argumento de seguridad —*«en ninguno deja viva una autorización»*— está escrito sólo sobre
`S12`, `S16` y el espejo; para `S22`, `S23` y `S24` **es verdadero pero no está argumentado acá**:
hay que ir a leer las tres celdas (`S22` *«se cancela en el proveedor de inmediato»*, `S23` *«si el
preapproval sigue vivo se cancela»*, `S24` *«de inmediato»*).

**Y hay un pariente en la otra dirección**: `S24` declara *«**dispara `S18`**, igual que `S23`»*, y
la celda de `S23` **no menciona `S18` en ninguna parte** — tampoco la de `S22`. El *«igual que»*
apunta a una afirmación que su referente no hace.

**Dónde lo permite el diseño.** `B/03` §3.2 (`S18` segundo evento; el § *«por qué `S18` también
sale de `PENDING_AUTHORIZATION`»* entero; la tabla de las dos escrituras repartidas; `S22`, `S23`,
`S24`); `B/12` §5.3 (la rama 6 y sus dos filas); `NUCLEO/04` `D15`.

**Severidad.** `MEDIA` — el mecanismo funciona (la fila de `S18` es la normativa y nombra los
seis), y las consecuencias de plata que vi cuelgan de otros hallazgos. Lo que queda mal es el
conjunto sobre el que se reparten las escrituras condicionales, escrito con tres valores.

**¿Es nuevo, o es el arreglo?** **Es el arreglo, y son dos familias encadenadas.** La de **la
sucesión** (`f21d5d828`) escribió *«los cinco caminos»* —su mensaje de commit es literalmente *«el
cierre sin S17 enumera los cinco caminos, no tres»*— y la de **las ocho decisiones**
(`8d6b27a12`) agregó `S24` como sexto sin recontar. Lo verifiqué con `git log -1 --format=%ct`:
18:29 y 20:17 del 2026-09-21.

**¿Lo habría encontrado el grep?** **Sí.** El término viejo que se retira figura en el §2 de
`rastro-8d6b27a12.md`: *«*«seis de las siete»*»* y *«*«siete transiciones»*»*, pero **no** *«cinco
caminos»*, que es la forma en que el corpus lo escribe. Un `rg "cinco caminos|los tres deja viva"`
sobre `B/03` devuelve las tres apariciones.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y cae en el modo 2 de `C1` §4.4.**
`8d6b27a12` **editó ese §**: su rastro §4 declara haber corregido ahí *«`S18` escritura 4»* y
*«`S18` escritura 5»*, que están en la tabla inmediatamente posterior. Las tres apariciones falsas
están **adentro del bloque que el commit tocó**, así que la obligación 2 no las alcanza. Es
exactamente el modo que `DEC-METH-011` dejó vivo y que esta vuelta tiene por encargo medir.

---

### F-8dB2-012 (sigue llegando) — `G-R4` sigue declarando que cubre «las SEIS tablas de esta épica»: conté cuatro en billing y siete en el programa, con el mismo comando y el mismo resultado que hace dos vueltas

**Qué se rompe.** El guard al que `NUCLEO/03` §1 le delega el número de pares tiene su alcance
declarado sobre un conjunto que no existe.

**En qué paso llega hoy.** Recontado el 2026-09-22 con
`rg -c '^\| # \| desde \| evento'` sobre los dos árboles de `docs/`:

| épica | tablas de transiciones | cuáles |
|---|---|---|
| billing | **4** | `B/03` §3.2 (suscripción), §6 (pago), §7 (pago manual), §8 (addon) |
| verticales | **3** | `V/03` §2 (trial), §9 (publicación), §11 (postulación de Partner) |
| **total** | **7** | |

Contra `B/20` §2, fila `G-R4`, verbatim y **sin un carácter de cambio desde la vuelta anterior**:
*«cubre las **seis** tablas de esta épica»*. Y el mismo capítulo, tres filas más arriba, escribe
bien el otro alcance: `G-R6` *«recorre … las tablas de transiciones de **las nueve máquinas, en
las dos épicas**»*. Nueve máquinas es correcto; **siete tablas** no es lo mismo, y las dos cifras
conviven en el mismo §.

**Dónde lo permite el diseño.** `B/20` §2 (`G-R4`, `G-R6`); `V/20` §2 (`G-R4`); `NUCLEO/03` §1
reglas 6 y 7; `B/03` §4 y §5.

**Severidad.** `MEDIA` — sin cambios respecto de las dos vueltas anteriores.

**¿Es nuevo, o es el arreglo?** Es **`F-8dB2-012` que sigue llegando**, con su ID viejo. `B/20` §2
fue reescrito entero por esta tanda —`G-R1-E` cambió de enunciado, `G-R1-F` y `G-R6` y `G-R6-B` son
nuevos, y las cuatro tandas de guards recontaron el catálogo tres veces— y la celda de `G-R4` quedó
igual.

**¿Lo habría encontrado el grep?** **No**, por la razón de las dos vueltas anteriores: el defecto
no es una aparición de `G-R4` sino **contar tablas**, que es lo que hace el propio guard.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No**, y el motivo que anoté la vuelta
pasada sigue siendo el correcto y ahora tiene confirmación en el rastro: `rastro-7676082e6.md` §3
declara la fila de `G-R4` de `B/20` §2 —*«Esta fila es la definición; `B/20` §2 la repite como
referencia cruzada»*— y la da por correcta, porque lo que verifica es **la estabilidad de la
afirmación bajo el cambio del commit**, no su **verdad**. La obligación 2 no pregunta *«¿este
número es cierto?»*.

---

### F-8eB2-006 (sigue llegando) — El preámbulo del §3 sigue contando DOS transiciones con `desde` de conjunto y ya son TRES: el inventario contra el que se audita esa regla sigue con una fila menos que sus miembros

**Qué se rompe.** Lo mismo que reporté la vuelta pasada, sin cambios. El § que obliga a toda
transición futura escrita sobre un conjunto a decir si alcanza a las de complemento publica el
inventario contra el que se audita esa regla, y ese inventario tiene una fila menos que sus
miembros.

**En qué paso llega hoy.** El preámbulo, verbatim sobre el texto de hoy (`B/03` §3): *«Una
transición cuyo `desde` se escribe como un **conjunto de filas** —y en esta tabla hay **dos**,
`S13` y `S20`— tiene que decir si alcanza también a las de complemento»*. Y `S21` sigue siendo la
tercera: su `desde` es *«**toda fila viva DE COMPLEMENTO** —los seis estados de la suscripción— **de
la que cuelga una instancia de addon**»*, y **contesta lo que el § pide** (*«Las principales no
entran, y acá no hace falta acotarlo»*). La regla se cumple; el conteo no se movió. Un
`rg "conjunto de filas" B/03` sigue devolviendo **una sola** aparición.

**Dónde lo permite el diseño.** `B/03` §3 (el preámbulo) y §3.2 (`S13`, `S20`, `S21`);
`NUCLEO/01` §2.4 (el inventario).

**Severidad.** `MEDIA` — sin cambios.

**¿Es nuevo, o es el arreglo?** Es **`F-8eB2-006` que sigue llegando**, con su ID viejo. La tanda
de la 9-bis-4 tocó el §3.2 en diez commits distintos y agregó cuatro filas más; el preámbulo no se
movió.

**¿Lo habría encontrado el grep?** **Sí**, igual que la vuelta pasada.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí**, igual que la vuelta pasada, y **sigue
sin ejecutarse**: el preámbulo es un párrafo que ninguno de los commits de esta tanda tocó, y la
aparición no se corrigió. Busqué *«conjunto de filas»* en los diez rastros y **no figura en
ninguno**. **La enmienda alcanzaba, dos tandas seguidas, y no se ejecutó ninguna de las dos.**

---

### F-8eB2-007 (sigue llegando) — `G-R1-E` se reescribió entero y sigue enumerando TRES lugares donde puede vivir un predicado; el de `MP1` y `MP4` sigue viviendo en el cuarto —la columna de EFECTOS— y sigue sin figurar en el inventario

**Qué se rompe.** Lo mismo que la vuelta pasada, con el guard reescrito y el hueco intacto.

**En qué paso llega hoy.** El predicado de `G-R1-E` hoy (`B/20` §2) es más largo —ganó *«grant
vivo»*, *«ancla viva»*, los dos inventarios y la cláusula del sujeto equivocado— y su enumeración
de lugares es **la misma**: *«—**en la columna *condición* de una transición, en el enunciado de un
invariante o en otro guard**—»*. Y la paráfrasis sigue en el cuarto: `MP1`, columna **efectos**
(`B/03` §7): *«o queda pendiente por `S19`, **si es la predecesora de una sucesión en curso**»*;
`MP4`, columna **efectos**: la misma frase, *«misma herencia y misma razón que `MP1`»*. Ninguna de
las dos dice *«viva»*. Y recorrí las **38** filas del §2.4 de `NUCLEO/01`: **`MP1` y `MP4` siguen
sin tener fila** (`rg "MP1|MP4|MP5" nucleo/01-glosario.md` devuelve **cero**).

**Por qué hoy no produce daño.** Igual que la vuelta pasada: `G-R1-D` está escrito con el adjetivo
puesto y cubre los cuatro sitios, así que un implementador que siga el guard hace lo correcto. Lo
que falla es la **detección** del caso siguiente.

**Dónde lo permite el diseño.** `B/20` §2 (`G-R1-E`, `G-R1-D`); `B/03` §7 (`MP1`, `MP4`);
`NUCLEO/01` §2.4 (`NUCLEO`: los dos inventarios y su regla de uso 3).

**Severidad.** `MEDIA` — sin cambios.

**¿Es nuevo, o es el arreglo?** Es **`F-8eB2-007` que sigue llegando**, con su ID viejo, y la
mitad nueva empeora el caso: esta tanda **reescribió el predicado entero de `G-R1-E`** —lo partió
en dos inventarios, le agregó dos términos y una tercera cláusula— sin tocar la enumeración de los
tres lugares, que es la mitad por la que se escapa.

**¿Lo habría encontrado el grep?** **Sí.** El término es *«la predecesora de una sucesión en
curso»*; un `rg "sucesión en curso" NUCLEO/01` devuelve el inventario y su regla de uso 3, que dice
en una línea qué había que hacer.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí, y es el segundo desenlace del §1.4.**
Busqué `MP1` y `MP4` en los diez rastros: no aparecen en ninguno como aparición declarada de
`NUCLEO/01`. Las dos son apariciones no corregidas, en un archivo y un párrafo que el commit de
`G-R1-E` no tocó. **La enmienda alcanzaba dos vueltas seguidas y no se ejecutó ninguna.**

---

### F-8eB2-008 (sigue llegando, dos de tres consecuencias) — `MP5` sigue poniendo a todo pagador manual en `GRACE_PERIOD` el primer instante de cada período, y `B/16` §2.2 sigue negándole comprar un addon por una razón que sobre él es falsa

**Qué se rompe.** Lo mismo que reporté la vuelta pasada. El pagador manual queda
estructuralmente en el estado que el resto del diseño usa para significar *«no pagó»*, sin haber
dejado de pagar nada, y reglas escritas contra ese significado se le aplican por el estado y no por
el hecho.

**En qué paso llega hoy, y qué se cerró.** `MP5` y `S4` siguen corriendo en el mismo acto, y el
§7.2 lo escribe hoy con más letra: la fila `GRACE_PERIOD` de su tabla dice *«un pagador manual
llega a grace **porque su cuota de este período no se pagó**»*.

- **Consecuencia 1 — CERRADA.** *«No puede cancelar durante esa ventana»* dejó de valer: `S24` le
  da la baja desde `GRACE_PERIOD` (`DEC-SUB-014`). Y pausar nunca fue su caso: `puedePausar()` es
  `false` sobre un pagador manual sin excepción (`B/06` §7, y el §7.2 lo razona entero).
- **Consecuencia 2 — SIGUE ENTERA.** `B/16` §2.2 está **sin tocar**: *«| `GRACE_PERIOD` | **no** |
  el servicio corre, pero **hay un cobro que no entró**: venderle algo más a **quien no pudo pagar
  lo anterior** es agrandarle la deuda |»*. El pagador manual está ahí el día 1 del período: no hay
  ningún cobro que haya fallado y nadie dejó de pagar nada. Lo verifiqué con
  `rg "GRACE_PERIOD" B/16`, que devuelve esa fila y nada más en §2.2.
- **Consecuencia 3 — SIGUE, atenuada.** El §7.2 recorrió el aviso por sus **dos** destinatarios y
  concluyó que al cliente *«ya está cubierto por «renovación por venir»»* y que el catálogo del
  `NUCLEO/07` §6 *«no gana una fila»*. Lo que sigue sin recorrerse es que **`S4` dispara por su
  cuenta las advertencias del §20** —*«servicio activo, … **advertencias y correos**»* (`B/03`
  §4)—, que le dicen a alguien al día que regularice. El § apoya la no-duplicación en *«la
  jerarquía de supresión de `NUCLEO/07` §4.2»*, que es un mecanismo y no una comprobación de que
  este caso caiga adentro.

**Dónde lo permite el diseño.** `B/03` §7 (`MP5`) y §7.2 (las seis filas de *«desde qué estados se
crea»*, *«cómo entra el grace»* y *«el aviso»*) y §3.2 (`S4`, `S24`) y §4; `B/16` §2.2 y §2.3;
`NUCLEO/07` §6 y §4.2; `01-decision-log.md`, `DEC-SUB-013`, `DEC-SUB-014`.

**Severidad.** `MEDIA` — sin cambios; con una consecuencia menos y las otras dos intactas.

**¿Es nuevo, o es el arreglo?** Es **`F-8eB2-008` que sigue llegando**, con su ID viejo. La tanda
cerró su consecuencia 1 y **no tocó `B/16`** en los commits de `MP5` ni en los de la baja.

**¿Lo habría encontrado el grep?** **Sí, para la consecuencia 2**, igual que la vuelta pasada:
`rg "GRACE_PERIOD" B/16` devuelve la fila con su razón escrita en la misma celda.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí, y sigue sin ejecutarse.** Recorrí las
**6** apariciones de `B/16` que `rastro-8d6b27a12.md` §3 declara y las que declara
`rastro-8f9f31ac0.md` (el pagador manual, que **no toca `B/16` en absoluto**): ninguna es la fila
de §2.2. Es una aparición no corregida en un archivo que esos commits no tocaron. **Dos vueltas
seguidas alcanzando por la misma puerta.**

---

## BAJAS

### F-8fB2-009 — La colisión 4 de `B/12` §2.2 dice que un cambio programado «espera a la reanudación», y `S25` es un final de pausa que no reanuda nunca

**Qué se rompe.** El descenso de capacidades encolado sobre una fila pausada espera un evento que
sobre la población de `S25` no ocurre: la pausa termina **cancelando**. La regla general que el §
escribe debajo sí cubre el caso —*«si no va a tener servicio nunca más, se descarta»*— pero la
celda de la colisión 4 no la invoca y la 3, que es la que enumera los desenlaces terminales, no
nombra a `S25` (enumera `S11`, `S22`, `S23` y `S24`).

**El camino.** `B/12` §2.2, colisión 4, verbatim: *«| **una pausa** (§26) | **espera a la
reanudación**, y en las DOS pausas por la misma razón …»*, con su justificación entera apoyada en
`EX-11` (*«estando pausada el proveedor rechaza toda modificación»*), que es correcta. Y `S25`
(`B/03` §3.2): *«`S10` **no puede reanudar** sobre un plan que no existe, y ésta es la fila que
ejecuta ese final»*. La colisión 3 —la que absorbe el descenso— dice *«**lo absorbe, y en los
cuatro casos**»* y enumera `S11`, `S22`, `S23` y `S24`; `S25` no está en ninguna de las dos.

**Dónde lo permite el diseño.** `B/12` §2.2 (colisiones 3 y 4, y la regla general de dos
cláusulas); `B/03` §3.2 (`S25`); `B/10` §4.3.

**Severidad.** `BAJA` — no hay daño: un descenso de entitlements encolado sobre una fila
`CANCELLED` no se ejecuta y no le quita nada a nadie. Lo que queda es una regla que promete un
momento que sobre esa población no llega, y una enumeración de *«los cuatro casos»* que tiene un
quinto.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: `DEC-SUB-015`** (`8d6b27a12`), que creó `S25`.

**¿Lo habría encontrado el grep?** **Sí.** El término nuevo es `S25`, declarado grepeado en el §2
de su propio rastro; un `rg "S25" B/12` devuelve **cero** apariciones hoy, que es la comprobación
entera: el capítulo que decide qué pasa con la cola de cambios no nombra la fila nueva ni una vez.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí, y es el segundo desenlace del §1.4.**
`rastro-8d6b27a12.md` §4 declara haber corregido *«`B/12` §2.2 colisión 3 | «en los tres casos» |
cuatro»*, o sea que el commit **tocó la colisión 3 y no la 4**, que está inmediatamente debajo. Y
las **6** apariciones de `B/12` que su §3 declara no incluyen la colisión 4. Aparición no
corregida, en un párrafo que el commit no tocó, del archivo vecino al que sí tocó.

---

### F-8eB2-010 (sigue llegando) — La lista de flujos críticos de E2E sigue saltando del 6 al 8

**Qué se rompe.** Lo mismo que la vuelta pasada, sin un carácter de cambio.

**En qué paso llega hoy.** Lo conté con `rg '^[0-9]+\. ' B/20` sobre el texto de hoy: devuelve las
líneas 405, 407, 408, 410, 411, 412 y 413, con los números **`1 2 3 4 5 6 8`**. No hay ítem 7.
Y la lista sigue sin flujo para el **grant** (`S13` + `S20`, hoy con su orden de escrituras
normativo), ni para el **pago manual** (`MP1`…`MP5`), ni para las **tres bajas nuevas**
(`S22`/`S23`/`S24`) ni para `S25`, que son las cuatro filas que esta tanda agregó y las cuatro
cortan servicio.

**Dónde lo permite el diseño.** `B/20` §5 (la lista) y §2 (los dieciséis guards, que sí crecieron).

**Severidad.** `BAJA` — sin cambios.

**¿Es nuevo, o es el arreglo?** Es **`F-8eB2-010` que sigue llegando**, con su ID viejo. `B/20`
fue tocado por al menos **once** commits de esta tanda (las cuatro tandas de guards viven ahí) y
ninguno bajó al §5.

**¿Lo habría encontrado el grep?** **No.** No hay término que buscar: es una numeración.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No**, por lo mismo. Es el tipo de defecto
que sólo encuentra contar una lista, y **sigue siendo el único de los dieciséis del que ninguna de
las once reglas de metodología del log dice nada**.

---

## Ataques que intenté y el diseño resistió

Once, y van porque el valor de esta sección es que la próxima pasada no los repita.

1. **`S20` sigue copiando de `S13` la frase de idempotencia con dos escrituras sobre dos
   entidades** (`F-8eB2-002`, `CRITICA` de la vuelta anterior). **Cerrado, y por el lado correcto y
   completo.** El orden es hoy normativo —*«dos escrituras sobre dos entidades, **EN ESTE ORDEN**
   … **Primero la instancia** … **Después el cobro**»*—, la frase copiada se reemplazó por
   *«**Reanudable fila por fila BAJO ese orden** … **y no por la razón de `S13`**, que supone una
   escritura por fila»*, y el § `«el orden de las dos escrituras de`S20`»* tabula los dos órdenes
   contra sus tres preguntas. Verifiqué las tres consecuencias que reporté: bajo el orden nuevo la
   fila **sigue en su propio`desde`** después del primer corte, la **tercera comprobación** de
   `B/09` §3 la ve (*«es la segunda fila de la tercera comprobación»*), y la **tercera cláusula de
   `A5`** tiene sujeto porque el ancla ya está escrita. Intenté además el corte **entre la
   cancelación en el proveedor y la escritura de`CANCELLED`** y el § lo cierra contando: *«es una
   divergencia de estado que las cinco comparaciones del`B/09` §3 **sí** ven»*. Y `DEC-TEST-001`
   decidió por escrito que el guard del orden **no va**, así que no lo cuento como hueco.

2. **La cortesía se pierde cuando el espejo mata a una predecesora `PAUSED`** (`F-8eB2-001`,
   `CRITICA` de la vuelta anterior). **Cerrado por construcción.** `S18` tiene hoy **cinco**
   escrituras y la cuarta es *«la cortesía se **DIFIERE**»*, con su dominio tabulado —corre por el
   cierre normal con `S17` y **por el espejo**, y no por `S12`, `S16`, `S22`, `S23` ni `S24`, con
   la razón de cada uno—; `S9` ganó un segundo disparador que la re-emite; `B/14` §4.4 se
   reescribió y el recuadro del §3.2 declara explícitamente que *«el enunciado … era verdadero
   sobre los dos caminos que entonces existían y es **falso** sobre el tercero»*; y la **sexta**
   comprobación de cero llamadas de `B/09` §3 es el detector que faltaba, con su motivo
   `CORTESÍA_SIN_RE_EMITIR`. Las cinco piezas están y encajan.

3. **El pausado que quiere irse no puede, y el pagador manual suspendido queda encerrado**
   (`F-8eB2-003`, `CRITICA` de la vuelta anterior). **Cerrado, y con las tres filas.** `S22`,
   `S23` y `S24` existen, `S23` libera el candado `A` y **cierra la ventana de `MP4`**, el §3.1
   corrigió su enumeración de salidas para nombrar `S23`, y el §7.1 reescribió *«que nadie
   cancela»* diciendo que *«nombra un subconjunto **recién desde `S23`**: hasta esa fila … la
   población entera era la que nadie podía cancelar»*. Es el cierre más completo de la tanda.

4. **La sucesora que muere por el espejo no tiene rama** (`F-8eB2-004`, `ALTA` de la vuelta
   anterior). **Cerrado por el lado que importaba**: `B/12` §5.3 tiene hoy **seis** ramas, la 5 es
   el espejo y la 6 es la predecesora que pide la baja, con sus **dos** filas (`S23` y `S24`). El
   eje de la **sucesora** sigue sin rama para el espejo — pero su desenlace hoy está cubierto: la
   sucesora muerta deja de ser *«sucesora viva»*, la salvedad de `authorized × GRACE_PERIOD` del
   §10.1 declara que *«la salvedad está acotada por la ventana: muerta la sucesora, la fila deja de
   ser predecesora de una sucesión en curso y vuelve a esta fila con su premisa verdadera»*, y de
   ahí el pago se reevalúa. Lo verifiqué contra las tres celdas y no lo sostengo más.

5. **`S24` deja una fila en `GRACE_PERIOD` con el reloj corriendo y el pago pendiente por `S19`
   sin apagar.** No: la celda de `S24` lo cubre por las dos puntas —*«**Apaga el reloj del §4**»*
   y *«si la fila es la predecesora de una sucesión en curso, **dispara `S18`**»*—, y `B/12` §5.3
   fila 6 y la tabla de los cuatro actos de `B/03` §3.2 lo registran como la misma rama 6 y no una
   séptima. El argumento *«`S19` retiene pagos desde `GRACE_PERIOD` y desde `SUSPENDED`, así que es
   la misma rama»* es correcto y lo verifiqué contra el `desde` de `S19`.

6. **`S22` pierde el pago que `S19` retenía, porque no está entre las filas de la rama 6.** No:
   `S19` sale de *«la predecesora … **en `GRACE_PERIOD` o `SUSPENDED`**»*, y a `PAUSED` sólo se
   llega por `S8` y `S9`, cuyo `desde` es `ACTIVE`. Ninguna fila con pago pendiente puede estar en
   `PAUSED`, así que la población de *«`S22` sobre una predecesora con pago retenido»* es **vacía**
   y la tabla de las dos escrituras repartidas de `S18` lo dice con esas palabras. Recorrí los dos
   `desde` y la aritmética cierra.

7. **`S25` y `S22` colisionan sobre una `PAUSED` cuya vertical se discontinuó y cuyo dueño pide la
   baja el mismo día.** No: los eventos son distintos —*«pide la baja»* contra *«llega el fin de
   la pausa, o la persona vuelve antes»*— y los dos llegan al mismo `CANCELLED` con las mismas dos
   escrituras (`fin_real` y la cancelación del preapproval), así que el orden no cambia el estado
   final. `NUCLEO/03` §1 regla 7 lo registra como el sexto de sus ocho casos de *«compartir el
   `desde` no es compartir el par»* y el razonamiento es verificable sobre las dos celdas.

8. **El `UNIQUE` parcial de un grant vivo por beneficiario rompe el fan-out de `S13` cuando dos
   grants coexisten.** No lo sostengo: `UNIQUE(beneficiario) WHERE revocado_en IS NULL`
   (`B/02` §5, `DEC-GRANT-009`) hace que el caso no exista, y el `desde` de `S13` se enuncia sobre
   *«cada vertical que **el acto** ancla»*, no sobre el grant, así que anclar una vertical nueva a
   un grant vivo recorre sólo esa vertical — con la razón escrita: *«las que el grant ya anclaba
   no se vuelven a recorrer … gastaría una llamada al proveedor por fila para no cambiar nada»*.

9. **El segundo disparador de `S9` corre dos veces sobre la misma cortesía diferida si la sucesora
   autoriza y el barrido la encuentra en paralelo.** No: el efecto declara que *«**`saldo_días`
   vuelve a nulo**»* en el mismo acto, y la sexta comprobación de `B/09` §3 selecciona por
   *«`saldo_días` **no nulo**»*, así que la segunda corrida no encuentra sujeto. Es idempotencia
   por condición sobre la misma columna, igual que `MP5`.

10. **`S21` corre dos veces sobre la misma fila cuando `A5` y `A6` se cumplen a la vez.** No: su
    condición es *«la instancia está en `CANCELLED`»* —un estado, no una entrega— y su efecto
    declara *«**Idempotente**: sobre una fila que ya está `CANCELLED` no escribe nada y no manda
    nada»*. Y el caso `VERTICAL_SUBSCRIPTION`, donde dos cláusulas de `A5` se cumplen en el mismo
    acto, lo cierra `B/03` §8: *«la segunda encuentra la instancia **ya fuera del `desde`**»*.

11. **La marca bloquea el cierre de la sucesión, porque una fila marcada no puede ser sucedida y
    `S18` le pone una marca al cerrar.** No: la prohibición es *«ningún `sucede_a` **puede
    apuntarla**»* (`B/02` §2.2, `B/03` §3.3), o sea que gobierna el acto de **declarar** una
    sucesión nueva, y la marca que `S18` abre se escribe **después** de limpiar `sucede_a`, sobre
    una predecesora que ya está `CANCELLED`. Recorrí las dos celdas y el orden cierra.

---

## Líneas de rastro que ataqué

**Revisé 108 líneas declaradas, de 7 de los 10 rastros. Tres resultaron FALSAS hoy, y una cuarta
—una fila de la tabla §4 de un rastro— declara una corrección que se ejecutó a la mitad.**

**Cómo elegí.** Las instrucciones dan dos puntas que valen —el rastro fino, donde una justificación
floja es más probable, y el grueso, donde el volumen es el riesgo— y yo agregué una tercera que
resultó la productiva: **atacar por CRONOLOGÍA**. Medí con `git log -1 --format=%ct` sobre los diez
shas que las cinco familias estructurales corrieron entre las 16:47 y las 18:29 del 2026-09-21 y la
tanda de las ocho decisiones a las 20:17. Una línea de rastro es una afirmación fechada; las de las
familias tempranas se escribieron sobre un corpus **que la tanda posterior iba a cambiar**, y
ninguna regla obliga a revisitarlas. Ahí busqué primero, con los términos de mi vector —los
conteos de pares, de puertas, de caminos y de salidas de `PAUSED`— y las tres falsas salieron de
ahí.

| rastro | líneas revisadas | de qué § | por qué ésas | resultado |
|---|---|---|---|---|
| `rastro-8d6b27a12.md` (las ocho decisiones, 91) | **45** | las 9 de `B/03`, las 10 de `B/09`, la tabla §4 entera (24 filas), el §5 (6) y el §6 (5) | es la familia que creó `S24` y `S25`, o sea la que volvió falso todo lo que mis hallazgos atacan | las 19 apariciones de §3 **verificadas y correctas**; **1 fila de §4 a medio ejecutar** (ver abajo) |
| `rastro-032f761e0.md` (la baja, 69) | **21** | `B/02` §2.2, `B/03` §3.2/§8/§10.1, `B/12` §5.3, `B/20` §2, la tabla §4 (13) y su § de rastros invalidados | creó `S22` y `S23`; es el rastro de mi terreno con más filas de §4 | **1 FALSA** (`G-R4` pares) + **1 insuficiente** (`fin_real`) |
| `rastro-ce52dce5f.md` (el grant y el addon, 108) | **14** | el bloque de `S20`/`S21` del §3.2, §3, §4 y el §6 de auto-corrección | es el rastro de `S20`, cuyo orden de escrituras es el arreglo central de mi vector | **1 FALSA** (`G-R4` pares, L794-800) |
| `rastro-f21d5d828.md` (la sucesión, 268) | **12** | las 3 de `NUCLEO/03`, las 2 de `NUCLEO/04`, `B/05` §3, `B/12` §5.3 y el paréntesis de conteo | es el rastro más grueso y el de `reconciliation_mark`, sujeto de mi `CRITICA` | **1 FALSA** (*«los tres pares … siguen siendo tres»*) **+ 1 paréntesis caduco** (*«`B/03` §3.2 … sigue teniendo **23** filas numeradas»*: hoy son **25**) |
| `rastro-8f9f31ac0.md` (el pagador manual, 65) | **8** | `MP1`, `MP4`, la fecha del próximo cobro, `B/05` §3 | es el rastro cuyo § el §7.2 de hoy audita con su tabla de premisas | correctas |
| `rastro-5836ec219.md` (la retención, 187) | **6** | `S10`, su rama de fallo, la quinta comprobación, `NUCLEO/04` 24 | es la familia que escribió la fila `authorized × PAUSED` del §10.1 | correctas **al escribirse**; el corpus que describen cambió después (`F-8fB2-004`) |
| `rastro-12cc0879f.md` + `rastro-7676082e6.md` (guards) | **2** | las tablas de conteo de guards | para confirmar que 15/16/28 quedó superado por 16/17/29 y no es una contradicción viva | correctas, y correctamente superadas |

**Las tres falsas, con su cita y su medición:**

1. **`rastro-ce52dce5f.md` §3, L794-800 de `B/03` §3.2** — *««`S21` no agrega ningún par con dos
   filas, así que **`G-R4` sigue contando tres** …» → **sigue correcta**»*. Hoy `NUCLEO/03` §1
   regla 7 tiene **cuatro** entradas y el mismo `B/03` lo dice en cuatro lugares. Era verdadera a
   las 17:55 y dejó de serlo a las 20:17.
2. **`rastro-032f761e0.md` §3, `B/20` §2** — *«y `G-R4` cuenta **pares**, que **siguen siendo
   tres**»*. Mismo caso, a las 17:33.
3. **`rastro-f21d5d828.md` §3, `NUCLEO/03` L79-89** — *«Y los **tres** pares con dos filas siguen
   siendo tres: `S9` gana un **evento**, no una fila»*. Mismo caso, a las 18:29. Acá el corpus
   **sí** se corrigió después; lo que quedó falso es la línea.

**La cuarta, que no es una línea falsa sino una corrección a medias, y es la más útil:**
`rastro-8d6b27a12.md` §4, fila 13 — *«| `B/03` §7.1 y §7.2 | *«once puertas»*, *«tres pares»*,
*«cinco comprobaciones»* | doce/trece, cuatro, seis |»*. Medido contra el texto de hoy, en esos
dos § hay **seis** apariciones de las tres premisas y **dos** se corrigieron (*«cuatro»* y
*«seis»*, las dos en el bullet de §7.2) y **cuatro** no: *«sigue contando tres»* en §7.1,
*«doce puertas»* en §7.1, *«doce»* en §7.2 y *«sigue contando tres → **sigue verdadera**»* en la
**tabla de premisas del propio §7.2**. La tabla §4 de un rastro es una declaración de *«corregí
esto acá»*, y ésta es verificable línea por línea: es el primer artefacto del programa que se puede
falsar sin razonar, y falsó.

**Y una justificación que no es falsa y no alcanza**, que anoto aparte porque es el modo que
`F-8fB2-003` reporta: `rastro-032f761e0.md` §3, `B/02` §2.2 — *««… a lo sumo una sin `fin_real` por
suscripción» → **sigue correcta, y `S22` la respeta**: escribe `fin_real` al cancelar, así que **no
deja una pausa abierta sobre una fila muerta**»*. Las dos primeras cláusulas son verdaderas; la
tercera es una conclusión sobre el corpus entero derivada de una sola fila, y es falsa: `S13` y
`S17` dejan exactamente eso, y lo dejaban ya ese día.

**Y dos justificaciones que ataqué y resistieron, que van porque son el contraejemplo útil:**

- `rastro-032f761e0.md` §3, L1611-1632 de `B/03` §10.1 — declara correctas las tres cifras del
  recuadro del espejo *«porque son **ordinales que identifican al espejo**, no totales»*. Lo
  verifiqué: el espejo sigue siendo la **séptima** fila de una tabla de recorrido de **ocho**, la
  **sexta** de una lista de `B/16` §4.3 que hoy tiene **diez**, y **un** tercer camino de los que
  hoy son seis. Las tres sobreviven, y el rastro **anticipó por qué**: *«Si alguna se hubiera
  escrito como «el último» o «de seis», sería falsa»*. Es la mejor línea de rastro que leí.
- `rastro-8d6b27a12.md` §3, L437 de `B/03` §3.2 — declara correcto el título *«`S10` es la única
  salida de `PAUSED` **que devuelve el servicio**»* con el argumento de que *«el calificativo … ya
  estaba puesto por `S22` y `S13`, y cubre a `S25` sin cambiarlo»*. Verificado: el calificativo
  hace el trabajo y el título sigue siendo verdadero con cuatro salidas terminales en vez de dos.
  Lo que ese razonamiento **no** alcanzó es la lista del cuerpo, que sigue diciendo tres y omite
  `S17` (`F-8fB2-003`).

---

## Lo que cae fuera de mi vector, y a quién le toca

- **Cuánto hay que devolver de los cobros que `F-8fB2-001` deja sin referencia** —si corresponde
  uno por hecho o un saldo, y con qué regla de `DEC-RF-002` / `DEC-RF-003`— es de `B1`.
- **`F-8fB2-002` visto desde el barrido** —si la cuarta comprobación de cero llamadas alcanza a los
  cuatro disparadores que la celda de `A5` no declara, o si hace falta otra— es de `B3`.
- **`F-8fB2-003` visto desde el dato** —si `fin_real` se puede reconstruir de la auditoría o si es
  pérdida definitiva, y qué le pasa al conteo de los topes del §26.3— es de `B3`.
- **`F-8fB2-006`, `F-8fB2-007` y `F-8dB2-012`** son defectos de conteo que viven mitad en `B/03`,
  `B/09` y `B/20` y mitad en `NUCLEO/03` §1 regla 7; **el enunciado de la regla y el alcance de
  `G-R4` son `NUCLEO`**, para la pasada C. La quinta aparición de *«los tres declarados»* vive en
  `V/03` §2 y es de la otra épica, así que va a `C1`.
- **`F-8eB2-007`** es mitad `B/20` y mitad `NUCLEO/01` §2.4: los dos inventarios y su regla de uso
  3 son **`NUCLEO`**.
- **`F-8dB2-006`**, igual que las dos vueltas anteriores: la mitad corregible es la columna `desde`
  de `B/03` §3.2 y por eso va acá; **el enunciado de la regla 7 es `NUCLEO`**.
- **`F-8fB2-004` visto desde la cobertura** —qué emite una fila que el espejo reanimó a `ACTIVE`
  sobre una vertical con fecha de cierre cumplida— toca a `A2` y al `12-contrato…` §2.6.

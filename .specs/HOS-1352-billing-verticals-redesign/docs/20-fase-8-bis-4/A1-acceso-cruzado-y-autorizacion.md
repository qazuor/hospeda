---
title: "FASE 8-bis-4 · A1 — acceso cruzado y autorización"
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 8
---

# FASE 8-bis-4 · A1 — acceso cruzado y autorización

Quinta pasada adversarial sobre `HOS-1353`, con el vector de siempre —**que una cuenta llegue a
algo que no le corresponde, o pierda algo que sí**: otra vertical, otro plan, otra ficha, otro
sujeto— sobre el texto que la 9-bis-3 produjo.

**Siete hallazgos. Uno `CRITICA`, tres `ALTA`, dos `MEDIA`, uno `BAJA`.**

Los paths se abrevian como siempre: `NUCLEO` es `HOS-1352-…/docs/nucleo/`, `V` es
`HOS-1353-verticales-capacidades-y-autorizacion/docs/`, `B` es
`HOS-1354-billing-cobro-y-proveedor/docs/`, y lo que no lleva prefijo es `HOS-1352-…/docs/`.

**Lo que medí yo, y cómo.** Todo conteo de este informe sale de recorrer el artefacto citado
sobre el worktree `/home/qazuor/projects/WEBS/hospeda-spec-hos-1352-billing-redesign` el
2026-09-21, con `rg` o a mano sobre la tabla: 7 filas en la tabla de transiciones de `V/03` §2 y
8 en la del §9; 12 filas en `NUCLEO/08` §3; **15** guards en `V/20` §2 (eran 14 en la 8-bis-3);
20 filas en el inventario de consumidores de *«fila viva»* de `NUCLEO/01` §2.4, partidas 10 y 10;
**5** campos en la firma de la fuente del `12-contrato…` §2 —los mismos cinco que en la vuelta
anterior—; 6 filas en la tabla de lectura de catálogo de `V/10` §2; 3 planes no vendibles por
vertical en `V/02` §2.1; 2 celdas marcadas *«imposible»* en la tabla 6 × 4 del `12-contrato…`
§2.4 contra el *«tres»* de su prosa; 17 filas en la tabla de avisos de `B/19` §4. **Ningún número
de este informe viene de otro informe**, y las citas están verificadas contra el texto del
capítulo, nunca contra el informe que las cita.

---

## La tesis: `DEC-METH-010` mordió donde el defecto comparte vocabulario, y esta vuelta el vector se movió a donde no

La enmienda pide tres cosas y la más cara es la 2: escribir, **por aparición**, por qué cada
ocurrencia no corregida sigue siendo correcta. Eso funciona cuando el consumidor roto **nombra el
término**. De mis siete hallazgos:

| modo | cuántos de los 7 | ¿la resolución POR APARICIÓN lo atrapaba? |
|---|---|---|
| el consumidor roto **no nombra** el término que el arreglo redefine | **3** (`001`, `004`, `005`) | **no** — la obligación 2 se aplica a las apariciones del término, y ahí el término no está |
| el defecto vive **en el párrafo que el commit escribe** | **2** (`002`, `006`) | **no** — la obligación 2 sólo manda escribir las apariciones *«en un párrafo que el commit no tocó»* |
| aparición no corregida, en un archivo que el commit no toca | **1** (`003`) | **sí** — la enmienda alcanzaba y no se ejecutó |
| preexistente, ningún arreglo de la tanda lo tocó | **1** (`007`) | no aplica |

**El dato que importa para el veredicto de método**: de los seis que atribuyo a la tanda,
**uno solo** cae dentro de lo que `DEC-METH-010` manda escribir. Los otros cinco no son *«no se
aplicó»*: son **alcance**. Y los dos modos que los explican son los mismos dos que ya nombré en la
8-bis-3 —el consumidor que no comparte vocabulario, y la colisión adentro del archivo editado—,
que la enmienda **declaró** cubrir con su obligación 1 (*«el alcance es todo el corpus y la unidad
es el párrafo»*) y **no cubre**, porque la obligación 2 vuelve a recortar sobre *«párrafos no
tocados»* justo donde la 1 acababa de ampliar. Las dos obligaciones se contradicen en el recorte,
y la que se ejecuta es la 2, porque es la que pide escribir algo.

**Y hay un modo nuevo que ninguna de las dos alcanza, y es donde está mi `CRITICA`**: el arreglo
declara **qué paso de la autorización resuelve** un acto nuevo (`V/17` §1.2, paso 4) y deja sin
declarar **el paso siguiente**, que es donde el propio capítulo dice que se materializa todo
rechazo. No hay término que grepear: lo que falta no está escrito en ningún lado.

---

## CRITICA

### F-8eA1-001 — `PB8` resuelve contra el piso, y el piso no otorga reactivar: la mitad de la defensa del hard delete del día 180 es inejecutable justo para la población que la necesita

**Qué se rompe.** Alguien canceló su suscripción de Gastronomía, su ficha bajó por `PB2`, el día
90 `PB4` la archivó. El diseño le promete dos salidas y una es *«traerla a borrador cuando
quiera»* (`PB8`). Esa persona no tiene ninguna fuente de clase `TÍTULO`: su conjunto efectivo es
**la versión de piso**, que otorga una lista cerrada de **dos** cosas y ninguna es reactivar una
ficha. El paso 6 de la autorización la rechaza. Y como el reloj de inactividad se reinicia con
*«un acto del dueño … reactivarla»* (`NUCLEO/01` §1.2, hecho 1) y esa persona **no puede
ejecutar ninguno**, el reloj corre hasta el día 180 y **el contenido publicable se borra**.
`V/02` §4.2 regla 3 dice, con esas palabras, que *«el hard delete del día 180 **se defiende con
las dos salidas**»*: la otra es `PB7`, que sólo alcanza a quien **recupera cobertura**. Para el
que no la recupera —que es exactamente el sujeto del borrado— quedan cero.

**El camino.**

1. La fila existe y su evento es un acto del dueño: *«| **`PB8`** | `ARCHIVED` | **el dueño la
   reactiva** | `DRAFT` | desde cualquier origen, incluido el de `PB5`. Es la mitad de
   `DEC-DATA-001` que se prometía en una nota y no ejecutaba ninguna tabla |»* (`V/03` §9). Y la
   tabla que compara las dos salidas le asigna su población: *«| para quién existe | el que pausó,
   el que recontrata, el que regularizó | **el que quiere su ficha de vuelta sin pagar todavía**, y
   el borrador que archivó `PB5` |»* (`V/03` §9).
2. **Es una operación de dominio que escribe estado y es auditable**, así que por `V/17` §3.5 pasa
   por el paso 5 **y por los nueve**: *«¿pasa por el paso 5? Sólo si **escribe estado del negocio y
   es auditable**»*. Escribe la columna de estado de la ficha y es una transición de la máquina del
   §9, o sea auditable por el criterio 2 de `NUCLEO/08` §1.1.
3. El capítulo 17 se ocupó del **paso 4** y lo dice: *«una ficha `ARCHIVED` **acepta de su dueño
   verla, exportarla y reactivarla** —`PB8`, cap. 03 §9— y rechaza todo lo demás … Sin esta línea,
   *«archivado responde no existe»* se lee como que lo responde **también al dueño**, y entonces la
   promesa no la puede cumplir nadie y `PB8` es inalcanzable»* (`V/17` §1.2, precisión 1).
   **Recorrí el capítulo 17 entero con `rg -n "PB7|PB8"`: devuelve dos líneas, las dos de esa
   precisión, las dos sobre `PB8` y las dos sobre el paso 4.** Del paso 6 no dice nada.
4. Y el paso 5 ya no defiende nada, por declaración propia: *«**el paso 5 ya no rechaza a nadie, y
   toda la defensa se apoya en el paso 6**»* (`V/17` §1.2, precisión 5), repetido en el
   `12-contrato…` §2.5 (*«con un piso siempre presente, **el paso 5 deja de rechazar a nadie**»*).
5. **El paso 6 resuelve contra el piso, y el piso otorga una lista de dos cosas.** *«Otorga
   exactamente lo mínimo para que alguien exista en la plataforma y pueda volver a contratar:
   **ninguna capacidad comercial**, y la de contratar una suscripción»* (`V/02` §2.1). Reactivar
   una ficha archivada no está, y no puede estar por omisión: la lista es exhaustiva y la vigila
   `G-R3`, que falla si esa versión otorga *«una clave de la clase comercial»* (`V/20` §2).
6. **Y el capítulo 17 ya demostró que ese rechazo funciona**, usándolo como su propia defensa:
   *«Se le contesta en el **paso 6**, porque la versión de piso de Alojamiento **no otorga ninguna
   capacidad comercial**»* (`V/17` §2.2). El mismo mecanismo que cierra el cruce entre verticales
   cierra a `PB8` sobre la ficha propia.
7. El reloj no perdona: los cuatro hechos de reinicio son *«un **acto del dueño** sobre la ficha …
   exportarla, reactivarla»*, *«**`cubierto` pasando a verdadero**»*, *«la ficha **vuelve a
   `PUBLISHED`**»* y *«el **fin de servicio** de una vertical discontinuada»* (`NUCLEO/01` §1.2,
   lista cerrada). Los tres primeros están bloqueados para este sujeto —el 1 por el paso 6, el 2
   porque no vuelve a pagar, el 3 porque `PB7` pide `cubierto` verdadero—. Queda el 4, que no
   aplica.
8. Al día 180 se borra *«el contenido publicable de la ficha (textos, fotos, FAQ, horarios), los
   borradores …»* (`V/02` §4.1). Sin vuelta: es el hard delete.

**Dónde lo permite el diseño.** Las ocho citas. Y la asimetría es lo que lo hace un defecto y no
una omisión estética: **el mismo commit que creó `PB8` escribió en `V/17` la línea que lo salva del
paso 4 y no escribió ninguna para el 6**, sobre un capítulo que declara —dos veces, en dos
documentos— que el 6 es el único que rechaza. La exportación del día 90 está en la misma
situación: `V/02` §4.2 regla 3 la usa para justificar el borrado (*«poder exportar antes es lo que
hace defendible el hard delete del día 180»*) y es una lectura, que por `V/17` §3.5 **no pasa por
el 5 y sí por los otros ocho**, el 6 incluido.

**Severidad.** `CRITICA` — *«un dato se pierde sin vuelta»*, y es el contenido entero de la ficha
de alguien que no hizo nada malo: dejó de pagar, que es un derecho. La defensa que el diseño
declara para ese borrado tiene dos patas y la que corresponde a esta población no tiene entitlement
que la habilite. Cae además del lado del vector: **la persona pierde algo que sí le corresponde**,
y se lo niega el paso que el propio capítulo nombra como el único que niega.

**¿Es nuevo, o es el arreglo?** **Lo introdujo `DEC-DATA-002`** (commit `621332e7c`), que creó
`PB7` y `PB8`. Antes de la tanda `ARCHIVED` no aparecía en la columna `desde` de ninguna tabla
—`V/02` §4.2 regla 3 lo dice: *«reactivar era un incidente y no una operación»*—, así que no había
operación cuyo paso 6 declarar. El arreglo creó la operación y declaró **un** paso de los nueve.

**¿Lo habría encontrado el grep?** **No.** El término que el arreglo trae al alcance es `PB8` /
*«reactivar»*, y el consumidor que se rompe —la lista de lo que otorga la versión de piso, `V/02`
§2.1— **no contiene ninguno de los dos**: dice *«ninguna capacidad comercial, y la de contratar una
suscripción»*. `rg -n "reactiva"` sobre el corpus devuelve siete líneas y ninguna es ésa (lo medí).
Es el mismo modo que el `CRITICA` de la vuelta anterior: **el consumidor roto no comparte
vocabulario con lo que cambió**.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y por la razón que separa la obligación
1 de la 2.** La obligación 2 manda escribir el rastro *«por aparición»* — y una aparición es una
ocurrencia **del término**. En el párrafo donde vive el defecto el término no aparece, así que no
hay aparición que declarar correcta ni incorrecta. La obligación 1 sí lo cubriría si se leyera
literal (*«el alcance es TODO EL CORPUS y la unidad es el PÁRRAFO»*), pero la 1 no manda escribir
nada y por lo tanto no es falsable, que es exactamente el diagnóstico con que nació `DEC-METH-010`.
**La enmienda no alcanza**, y este caso dice por qué: el defecto no es una premisa que envejece
**ni** un consumidor que se olvidó, es **un paso de un procedimiento de nueve que nadie declaró
para una operación nueva**.

---

## ALTAS

### F-8eA1-002 — Revocar un grant de Gastronomía le apaga a un cliente de Alojamiento el addon que venía pagando ahí, y la razón escrita para no repararlo —«estuvo cubierta de verdad»— es falsa en esa vertical

**Qué se rompe.** Alguien paga Alojamiento y compró un addon de scope `GLOBAL` cuyo producto
declara compatibles Alojamiento y Gastronomía. Le otorgamos un *Free Forever* de Gastronomía con
`includesAddons: true`: `S20` **le cancela la suscripción de complemento** —el débito que él venía
pagando— y la instancia pasa a colgar del ancla de Gastronomía. Meses después revocamos ese grant.
`A5` corta la instancia por su tercera cláusula *«en las dos verticales a la vez, porque la
instancia es una sola»*. Resultado: **la persona sigue siendo cliente de Alojamiento, sigue
pagando Alojamiento, y perdió ahí un addon que estaba pagando por su cuenta antes de que
apareciera el grant** — sin reanudación del débito, sin compensación y sin que ningún aviso lo
nombre. En Alojamiento el grant nunca cubrió nada: la cobertura la pagaba ella.

**El camino.**

1. La conversión alcanza al addon por **el producto**, no por la vertical de uso: *«`S20` alcanza
   entonces al complemento cuyo producto declara compatible **la vertical que el acto ancla**, y
   para los dos scopes que tienen vertical propia —`VERTICAL_SUBSCRIPTION` y `LISTING`— pide además
   que **su objetivo sea de esa vertical**»* (`B/16` §3.4). `USER` y `GLOBAL` **no tienen vertical
   propia**, así que no se les pide nada más.
2. El efecto es la cancelación de su cobro: *«se cancela la suscripción de complemento y la
   instancia pasa a colgar del **ANCLA** como su título»* (`B/16` §3.4), ejecutado por `S20`, que
   en `B/03` §3.2 lleva a `CANCELLED` *«toda fila viva DE COMPLEMENTO del beneficiario»* que cumpla
   la condición.
3. La fuga a la vertical no anclada está declarada y **aceptada**: *«un addon de scope `USER` o
   `GLOBAL` compatible con **dos** verticales, en alguien cuyo grant ancla **una**, se convierte
   igual … y de paso **queda gratis también en la vertical que el grant no ancló**»*
   (`B/16` §3.4, `DEC-ADDON-005`). No la reabro: está decidida.
4. **Lo que no está decidido es el desenlace de la revocación sobre esa segunda vertical.** La
   decisión cierra con *«**se apaga con el grant**, sin mecanismo aparte: al revocarlo, `A5` corta
   la instancia por su tercera cláusula (§3.3) —**en las dos verticales a la vez, porque la
   instancia es una sola**—»* (`B/16` §3.4). La frase describe el mecanismo y **no dice que en una
   de las dos la persona sigue pagando**.
5. La no-reparación está escrita y su razón es del grant: *«la persona **no recibió el addon de
   regalo: lo venía pagando**, y la revocación se lo apaga sin devolverle el débito que le
   cancelamos. **No pasa nada más: no se reanuda la suscripción de complemento vieja y no se
   compensa**»*, apoyado en *«`DEC-TRIAL-009` fija el criterio de por qué revocar **no repara** —el
   acto no es un error sino una decisión legítima, y la persona **estuvo cubierta de verdad** todo
   lo que duró el grant—»* (`B/16` §3.3).
6. **Esa premisa es falsa en la vertical que el grant no ancló**, y es verificable contra el propio
   corpus: *«En una vertical donde no ancló nada **no emite fuente**»* (`B/16` §2.4) y *«un grant no
   emite fuente en una vertical donde no tiene ancla»* (`12-contrato…` §2.8). En Alojamiento el
   grant **nunca fue título**; el título era su suscripción, que sigue viva y paga.
7. Y el criterio del owner que ordena las cinco decisiones de producto de esta tanda se lee al
   revés acá: *«si la pérdida la causa un acto deliberado NUESTRO y **la persona no puso plata
   nueva** → se declara y no se repara; si la persona **PUSO PLATA** → se le da salida»*
   (`00-instrucciones` §3, citando al owner). Esta persona **puso plata**: compró el addon y lo
   pagó hasta el día en que `S20` le canceló el débito.
8. Ningún aviso lo cubre. `B/19` §4 fila 13 obliga a que la confirmación de revocar diga *«qué
   addons corta, **y que los que el grant había pasado a costo $0 se apagan y no vuelven solos**»*
   — dirigido a **quien revoca**, y sin distinguir la vertical anclada de la otra. Recorrí las 17
   filas de esa tabla: **ninguna** es un aviso al cliente por la pérdida de un addon al revocar.

**Dónde lo permite el diseño.** Las ocho citas. El defecto no es la fuga —decidida— sino **su
salida**: `DEC-ADDON-005` la acota diciendo *«no es indefinida: se apaga con el grant»*, y esa
acotación, aplicada a una vertical donde el grant nunca aportó, **apaga una capacidad comprada en
una relación comercial que el grant no tocó**. El corte es del grant; el daño es de la otra
vertical.

**Severidad.** `ALTA` — le quitamos a un cliente que paga una capacidad que había comprado, por un
acto administrativo sobre **otra** vertical, sin reparación ni aviso. No es `CRITICA` porque no
hay cobro de más ni acceso indebido: nadie paga lo que no debe, y el dato de la instancia queda
—lo que se pierde es la capacidad y el derecho comprado—. Sube de `MEDIA` porque la única razón
escrita para no repararlo se apoya en una premisa que el propio corpus desmiente en dos lugares.

**¿Es nuevo, o es el arreglo?** **Lo introdujeron tres decisiones de la tanda, cada una con su
mitad**: `DEC-ADDON-003` (el commit `6bac7e63a`) creó `S20` y con eso la cancelación del débito
propio; `DEC-ADDON-005` aceptó la fuga a la vertical no anclada; `DEC-ADDON-006` (las dos en
`1c17565e1`) convirtió la tercera cláusula de `A5` en el apagado único. Antes de la tanda el addon
comprado **seguía cobrándose y seguía andando** en las dos verticales, y revocar no lo tocaba en
ninguna.

**¿Lo habría encontrado el grep?** **No.** El término nuevo es *«se apaga con el grant»* / *«la
tercera cláusula»*, y las tres apariciones que importan —`B/16` §3.3, `B/16` §3.4 y `B/03` §8—
están **las tres en los párrafos que esos commits escriben**. El término viejo tampoco ayuda: antes
no había ningún enunciado sobre el addon convertido, porque no había addon convertido.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** La obligación 2 manda escribir el
rastro de las apariciones *«que no se corrigen y están en un párrafo que el commit no tocó»*, y acá
las tres están en párrafos **que el commit escribió de cero**. El defecto no es una aparición vieja
que sobrevive: es **una consecuencia del texto nuevo sobre una población que el texto nuevo no
nombra**. Es el mismo punto ciego que `F-8dA1-006` y `F-8dA1-004` señalaron en la vuelta anterior,
y `DEC-METH-010` lo declaró cubierto por su obligación 1 sin darle una escritura que lo haga
falsable.

---

### F-8eA1-003 — El núcleo manda tres frases de confirmación sobre un grant y la tabla de superficies tiene dos; y la única obligación que `DEC-TRIAL-009` impuso —decir que el trial ya no vuelve— no está en la que la ejecuta

**Qué se rompe.** Dos huecos en el mismo mecanismo, y el mecanismo es la única mitigación que el
owner puso sobre un `CRITICA` que decidió no reparar.

**(a)** `DEC-TRIAL-009` cierra con *«Lo que sí corresponde, y es **lo único**: que la confirmación
de revocar lo diga»*. `NUCLEO/08` §3.1 lo escribe. Y `B/19` §4 —la tabla que el propio capítulo
declara *«la mitad de una decisión»*— enumera para esa confirmación tres cosas y **no la del
trial**. La decisión queda con su única obligación sin ejecutor en la superficie.

**(b)** El acto que **consume** el trial —otorgar el grant, o anclarle una vertical nueva— no
advierte nada sobre el trial, en ningún documento. Quien firma un *Free Forever* sobre alguien que
está en `TRIAL_ACTIVE` en esa vertical **le destruye su trial único de por vida** y la pantalla no
se lo dice. `NUCLEO/08` §3.1 regla 1 exige lo contrario con esas palabras: *«La confirmación dice
qué va a pasar»*.

**El camino.**

1. El acto consume, y el núcleo lo sabe: *«Recibir el grant consume el trial de esa vertical
   —`T2` o `T6`, según estuviera corriendo o no— y **la revocación no lo devuelve**»*
   (`NUCLEO/08` §3.1, regla 1). Lo mismo en `V/11` §2.4 y en `DEC-TRIAL-009`.
2. El mecanismo está en la tabla: *«| T2 | `TRIAL_ACTIVE` | **aparece una fuente viva de clase
   `TÍTULO` que no es la del trial** | `TRIAL_CONVERTED` |»* y *«| T6 | `PRE_TRIAL` | … `cubierto`
   es **verdadero** | `TRIAL_CONVERTED` | … **crea la fila de `trial`, consumida** |»* (`V/03` §2),
   sobre una fuente `GRANT` que el `12-contrato…` §2.4 clasifica `TÍTULO`.
3. **`NUCLEO/08` §3.1 declara tres frases y sólo desarrolla dos.** Textual: *«**Las tres escrituras
   sobre un grant tienen cada una su frase, y ninguna se deduce de la otra**: otorgar y anclar
   **cancelan la suscripción que el beneficiario paga** … ; revocar corta el servicio»*. Después
   agrega dos párrafos más, **los dos empezando por «Y la frase de revocar…»**: uno sobre los
   addons convertidos y otro que dice *«**Y la frase de revocar dice además que el trial ya está
   consumido y no vuelve** (`DEC-TRIAL-009`)»*. **Ninguno de los cuatro párrafos le pone al acto de
   otorgar ni al de anclar una frase sobre el trial.** Lo medí: `rg -n "trial"` sobre `NUCLEO/08`
   devuelve dos apariciones en el §3 —la fila *«extender un trial»* y ese párrafo de revocar— y
   ninguna más.
4. La superficie que ejecuta esas frases tiene **dos** filas para las **tres** escrituras, y la que
   falta no es la del trial sino la de **otorgar**: `B/19` §4 fila 13 es *«la confirmación de
   **revocar un grant**»* y la fila 13-bis es *«la confirmación de **anclarle una vertical nueva a
   un grant**»*. Recorrí las 17 filas: **no hay fila para otorgar**.
5. Y la fila 13 enumera exactamente lo que tiene que decir: *«que deja al cliente **sin servicio**,
   qué addons corta, **y que los que el grant había pasado a costo $0 se apagan y no vuelven
   solos**»*, con su procedencia *«cap. 08 §3.1 (núcleo), cap. 16 §3.3 y §3.4»*. **El trial no
   está**, aunque el núcleo lo exija en el mismo §3.1 que la fila cita como fuente.
6. La fila 13-bis, que es la del acto nuevo de la tanda, enumera *«qué cobro deja de ocurrir»*, la
   cortesía que termina y los addons de `S20`, y cierra con *«Es el acto que **parece que sólo
   agrega**, y por eso necesita la frase más que los otros»*. Consumir el trial de la vertical que
   se ancla es, literalmente, lo que ese acto agrega sin que se vea.
7. El capítulo lo declara no-cosmético: *«Cada línea de esta tabla es la mitad de una decisión … Si
   la superficie no lo dice, **la decisión se convierte en lo que se le permitió no ser**»*
   (`B/19` §4).

**Dónde lo permite el diseño.** Las siete citas. Y el agravante es de dirección: `DEC-TRIAL-009`
declara por escrito su propio costo —*«la confirmación le avisa **al que revoca**, no al que
pierde. Quien recibe la revocación se entera cuando intenta seguir usando la plataforma»*—, o sea
que el único que puede enterarse es el administrador. Si a él tampoco se lo dicen, no se entera
nadie.

**Severidad.** `ALTA` — deja sin ejecutor la única obligación que el owner puso sobre una pérdida
irreversible que decidió no reparar, y deja al acto que causa esa pérdida sin ninguna advertencia.
No es `CRITICA` porque la pérdida en sí está decidida (`DEC-TRIAL-009`) y no la reabro: lo que
reporto es que su mitigación no está implementada en el capítulo que la implementa.

**¿Es nuevo, o es el arreglo?** **Lo introdujo `DEC-TRIAL-009`** (commit `fe7d14914`) para la mitad
(a), y el **arreglo 3** de la familia del trial y el grant —`S13` ganando su segundo evento,
`1e3c3fc9e`— para la mitad (b): antes de la tanda anclar no existía como escritura, así que no
había una tercera frase que escribir.

**¿Lo habría encontrado el grep?** **Sí, la mitad (a), y con el término más obvio.** El término
nuevo es *«el trial ya está consumido y no vuelve»* / `trial`. `fe7d14914` toca **tres archivos**
—el log, `NUCLEO/08` y `V/11`— y `B/19` **no está entre ellos** (tabla del §2.3). `rg -n "grant"`
sobre `B/19` devuelve las filas 13 y 13-bis en las primeras líneas de resultados, y resolverlas
contra el enunciado nuevo obligaba a agregar la frase. Para la mitad (b) la respuesta es **no**: el
término que el arreglo introduce es *«anclar»*, y el consumidor roto —la enumeración de frases del
propio `NUCLEO/08` §3.1— **sí** lo nombra, pero lo que falta ahí no es una aparición vieja sino una
fila nueva en una lista que el commit escribió.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí, la mitad (a), y es el único caso de esta
pasada en que la enmienda alcanzaba.** La aparición vive en `B/19` §4 fila 13, **no corregida**, en
un **archivo que `fe7d14914` no toca** y por lo tanto en un párrafo que no tocó: cae exactamente
dentro de lo que la obligación 2 manda escribir. `fe7d14914` es además uno de los **seis commits de
decisiones que no reportan ninguna cifra de apariciones** (tabla del §2.3), aunque edite el núcleo.
**La enmienda no falló: no se corrió sobre este commit.**

---

### F-8eA1-004 — `T7` lee «la transición de publicar» y la única vertical donde `T7` puede correr hoy no publica nada: la cohorte de ex-partners se lleva un trial completo el día del encendido

**Qué se rompe.** `T7` existe para un día y una sola cosa: que el día en que una vertical enciende
sus días de trial, **el que ya fue cliente no estrene un trial gratis**. Hoy la única vertical con
los días en cero es Partner (`DEC-TRIAL-003`), y su evento de activación candidato es **la
aprobación del admin**, no publicar. Pero los dos capítulos que definen `T7` declaran que el hecho
se lee del **evento de dominio de la transición de publicar**. Quien lo implemente así no encuentra
nada en Partner, `T7` no escribe ninguna fila, y el día del encendido **toda la cartera de partners
aprobados dispara `T1`** al ejercer el evento: trial completo, con *«las capacidades del plan
vendible de `rank` más alto, gratis»*, a gente cuya relación comercial ya existió o terminó. Es,
con las palabras del propio capítulo, *«un trial gratis para quien ya fue cliente»*.

**El camino.**

1. La condición de `T7` es genérica y está bien escrita: *«| T7 | `PRE_TRIAL` | **el encendido: la
   vertical pasa los días de trial de su plan de trial de 0 a > 0** | `TRIAL_CONVERTED` | la
   persona **ya ejerció el hecho que la vertical declara como evento de activación**, en cualquier
   momento anterior al encendido |»* (`V/03` §2).
2. **El dato del que sale ese hecho, en cambio, está particularizado a publicar, y en los dos
   lugares que lo justifican.** `V/03` §2: *«Su registro existe y es duradero sin agregar nada:
   **publicar es una transición de la máquina del §9**, o sea un evento auditable por el criterio 2
   del cap. 08 §1.1 (núcleo), y ese registro es **append-only** (§1.3)»*. Y `V/11` §8.2: *«Su
   registro es **el evento de dominio de la transición de publicar** (cap. 08 §1.1 punto 2,
   núcleo), que es **append-only** (§1.3)»*.
3. Partner no publica una ficha y el corpus lo repite tres veces: *«| 2 | qué publica | … | Partner
   | presencia de Partner, **sólo Gold** |»* (`V/10` §1), *«lo que publica **no es una ficha**»*
   (`V/18` §1) y el §17.1 que ordena *«**no** forzarla al modelo `Ficha`»* (`NUCLEO/01` §1.2). La
   máquina del §9 es *«la máquina de la ficha»* (`V/03` §9): Partner no tiene filas ahí.
4. Y su evento de activación **no es publicar**: *«Para Partner el candidato a evento de activación
   es **la aprobación del admin** (`DEC-TRIAL-003`, implicación 1), así que `T7` alcanzaría a **los
   partners ya aprobados**»* (`V/18` §1.5), confirmado por `V/11` §8.3 paso 1 (*«Para Partner el
   candidato anotado es la aprobación del admin»*) y por `V/10` §1 fila 1 (*«**ninguno hoy**»*).
   La aprobación es `PP2`, de la novena máquina (`V/03` §11).
5. **Partner es hoy la única población de `T7`.** `V/11` §8.1: *«Una vertical puede declarar su
   evento de activación y tener los **días de trial en cero** — hoy Partner (`DEC-TRIAL-003`), y
   encenderlo está planificado, no es hipotético»*. Recorrí la tabla del Eje 2 en `V/10` §1: las
   otras cuatro verticales declaran evento y ninguna está en cero.
6. Si `T7` no escribe la fila, el daño es el que el propio § describe: *«el día que el número sube
   esa gente vuelve a ser elegible … como no está cubierto por nada dispara `T1`: trial completo,
   con las capacidades del plan vendible de `rank` más alto. **Le pasa a toda la cohorte de
   ex-clientes de esa vertical el mismo día**»* (`V/11` §8.1).
7. Y la ventana es cero por diseño, así que no hay red: *«entre el paso 2 y éste, cualquier
   ex-cliente que publique se lleva un trial completo. La ventana tiene que ser **cero**: los tres
   pasos son **un solo acto**»* (`V/11` §8.3). Un `T7` que no encuentra a nadie **parece** un acto
   ejecutado con la ventana en cero.

**Dónde lo permite el diseño.** Las siete citas. La contradicción es interna y está en el mismo
capítulo: la **condición** de `T7` cuantifica sobre *«el hecho que la vertical declara»* —correcto—
y su **justificación de dato** lo particulariza a publicar —incorrecto para la única vertical donde
corre—. `V/03` §9 punto 1 agrava la lectura al reforzar la particularización desde el otro lado:
*«El evento que `T1` y `T7` miran es *«el dueño publica»*, que es `PB1`»*.

**Severidad.** `ALTA` — una cohorte entera recibiendo gratis las capacidades del plan de `rank` más
alto es *«alguien accede a algo que no le corresponde»*, que es el criterio literal de `CRITICA`.
Se queda en `ALTA` por una sola razón, y va dicha: la **condición** de la fila es genérica y correcta,
y un tercer lugar (`V/18` §1.5) escribe la lectura buena con todas las letras, así que el corpus
contiene su propia corrección. Lo que reporto es que **los dos únicos § que definen `T7` declaran la
fuente del dato de una forma que excluye a su única población**.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 2** de la familia del trial y el grant
(commit `1e3c3fc9e`): `T7` es la fila nueva, y las dos frases sobre *«la transición de publicar»*
se escribieron con ella.

**¿Lo habría encontrado el grep?** **No.** El término que el arreglo introduce es *«el evento de
activación»* / *«ya ejerció»*, y `rg` sobre él devuelve `V/03` §2, `V/11` §8 y `V/18` §1.5 — **los
tres archivos los toca el mismo commit** `1e3c3fc9e` (16 archivos, tabla del §2.3: `V/03`, `V/11` y
`V/18` están los tres). La búsqueda que la obligación 3 de `DEC-METH-009` mandaba —*«sobre los
capítulos que el commit NO toca»*— no puede ver nada de esto.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** Las tres apariciones están en
**párrafos que el commit escribe**, así que quedan fuera del recorte de la obligación 2 (*«no
corregida, y en un párrafo que ese commit no tocó»*). Es el caso más limpio de la contradicción
entre las obligaciones 1 y 2: la 1 incluye *«los archivos que el commit toca»* porque *«un archivo
abierto no es un párrafo leído»*, y la 2 —la única que exige escribir— vuelve a excluir el párrafo
escrito. **El defecto está entre dos frases del mismo commit, a nueve renglones una de otra.**

---

## MEDIAS

### F-8eA1-005 — `PB7` otorga, la dispara el sistema, y `V/03` §9 declara a qué clase NO pertenece sin declarar a cuál sí: queda fuera del único guard que vigila «una transición del sistema nunca otorga»

**Qué se rompe.** El diseño tiene exactamente una regla sobre transiciones sin persona detrás:
*«Una transición de esta clase nunca otorga»*, con guard (`G-R3-B`). `PB7` **restituye una
publicación** —o sea otorga— y la dispara el contrato, no el dueño. `V/03` §9 se adelanta a la
objeción y la contesta por la negativa: dice que `PB7` **no** es de esa clase. Con eso `PB7` queda
sin clase declarada, y `V/17` §3.2 regla 3 prohíbe exactamente eso: *«A qué clase pertenece una
operación se declara, nunca se infiere»*. Nadie sabe sobre quién se evalúan sus pasos 5-7 ni qué
guard la vigila.

**El camino.**

1. La fila otorga: *«| **`PB7`** | `ARCHIVED` | **`cubierto` pasa a verdadero** | `PUBLISHED` | y el
   cupo alcanza … Es `PB3` un estado más atrás |»* (`V/03` §9). Pasar de `ARCHIVED` a `PUBLISHED`
   es devolver visibilidad pública.
2. El diseño la saca de la clase, y lo escribe: *«**`PB7` no es una transición de la clase del
   reloj**, así que no la alcanza la propiedad *«nunca otorga»* del cap. 17 §3.4. Las de esa clase
   en esta máquina son `PB4` y `PB5`, y las dos **quitan**; a `PB7` la dispara un cambio de
   cobertura, igual que a `PB3`»* (`V/03` §9, punto 3 de las *«tres cosas que estas dos filas NO
   son»*).
3. Pero la clase del reloj es la **única** segunda clase que el capítulo 17 declara, y su
   enunciado cubre a un actor, no a un reloj: *«**Las transiciones disparadas por el reloj son una
   segunda clase de operación** … los pasos 5, 6 y 7 se resuelven sobre la capacidad del ACTOR, no
   sobre la del sujeto»* (`V/17` §3.4). `PB7` la dispara **el sistema** —el aviso del contrato
   (`12-contrato…` §3)—, o sea uno de los dos actores no-persona de `V/17` §3.3.
4. La regla que esto incumple está en el mismo capítulo: *«**A qué clase pertenece una operación se
   declara, nunca se infiere**»* (`V/17` §3.2, regla 3), y el §3.4 la repite para sí mismo: *«**La
   clase se declara transición por transición**, nunca se infiere — … Dejarla inferida sería
   incumplir la regla con la que se la resuelve»*.
5. El guard queda sin sujeto: *«| G-R3-B | una transición **disparada por el reloj** otorga algo,
   en vez de quitar | cap. 17 §3.4 |»* (`V/20` §2). Recorrí los **15** guards de `V/20` §2:
   **ninguno** vigila una transición del sistema que no sea del reloj.
6. Y el §3.4 declara qué pasa cuando la clase no se declara: *«La alternativa descartada —que cada
   transición del reloj resuelva por su cuenta— es exactamente cómo se generan las **exenciones por
   ruta**: cada job inventando su propia respuesta al paso 5»*.

**Dónde lo permite el diseño.** Las seis citas. Y no es un caso aislado: `PB3` tiene la misma forma
y es `F-8bA1-008`, que sigue llegando desde la 8-bis. Lo que la tanda agregó es que ahora el
corpus **nombra el problema y lo contesta a medias**: antes `PB3` estaba sin clasificar por
omisión, hoy `PB7` está sin clasificar **por una frase que dice cuál no es**.

**Severidad.** `MEDIA` — el desenlace práctico hoy es correcto: si los pasos 5-7 se evalúan sobre
el sujeto, ese sujeto **acaba de recuperar cobertura** y los pasa. Lo que está roto es la propiedad
que vuelve auditable a la clase, y el guard que debería sostenerla no tiene a `PB7` en su dominio.
Sube de `BAJA` porque `PB7` es la primera transición que **otorga** y que dispara el contrato sobre
una ficha que estuvo 90 días fuera del sitio público, y porque la frase que la excluye de la clase
del reloj es lo que va a hacer que nadie vuelva a mirar.

**¿Es nuevo, o es el arreglo?** **Lo introdujo `DEC-DATA-002`** (commit `621332e7c`), que creó
`PB7` y escribió el punto 3. **Agrava `F-8bA1-008`**, que reportaba lo mismo sobre `PB3` y sigue
llegando entero.

**¿Lo habría encontrado el grep?** **No.** El término que el arreglo introduce es `PB7`, y
`rg -n "PB7|PB8"` sobre `V/17` —el consumidor que tendría que declarar la clase— devuelve **dos
líneas, las dos en §1.2 precisión 1 y las dos sobre `PB8`** (lo medí). El §3.4, que es donde vive
la clase, **no nombra ninguna de las dos filas**. El término viejo tampoco: *«la clase del reloj»*
no aparece en `V/03` antes de este commit.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y por las dos puntas a la vez.** El
párrafo de `V/03` §9 punto 3 lo **escribe** el commit, así que queda fuera del recorte de la
obligación 2; y el párrafo de `V/17` §3.4, que sí está en un archivo que el commit toca pero en una
sección que no editó, **no contiene ninguna aparición del término**, así que tampoco hay nada que
declarar correcto ahí. Es el mismo modo que el `CRITICA`: lo que falta no está escrito en ningún
lado y por lo tanto no se puede buscar.

---

### F-8eA1-006 — Cuando la cobertura vuelve y el cupo no alcanza para todas, nada dice cuáles fichas se publican: `PB3` y `PB7` compiten por el mismo cupo y el criterio «escrito y predecible» de `DEC-SUB-008` sólo existe para bajar

**Qué se rompe.** Un anfitrión con seis fichas se atrasa, `PB2` se las baja, tres cruzan el día 90
y `PB4` las archiva. Regulariza con un plan que permite **dos** publicadas. `PB3` puede subir tres
y `PB7` puede subir otras tres, las dos con la condición *«y el cupo alcanza»*, y el cupo alcanza
para dos. **Cuáles dos es una decisión de visibilidad pública que ningún capítulo declara**, y la
única regla de selección que el diseño tiene se escribió para la dirección opuesta.

**El camino.**

1. Las dos filas piden lo mismo y no se ordenan entre sí: *«| PB3 | `UNPUBLISHED_BY_BILLING` |
   **`cubierto` pasa a verdadero** | `PUBLISHED` | **y el cupo alcanza** |»* y *«| **PB7** |
   `ARCHIVED` | **`cubierto` pasa a verdadero** | `PUBLISHED` | **y el cupo alcanza**, y el evento
   que la archivó dice que venía de `PUBLISHED` o de `UNPUBLISHED_BY_BILLING` |»* (`V/03` §9).
2. Las dos se disparan **con el mismo hecho**, en el mismo instante: *«`PB2` y `PB3` se disparan
   por el CAMBIO de `cubierto`»* (`V/03` §9) y `PB7` *«la dispara el hecho que el contrato empuja»*
   (misma sección, tabla comparativa).
3. El único criterio de selección escrito es de bajada: *«**El criterio de selección es el mismo
   que ya fijó `DEC-SUB-008` para las fichas: cae lo más reciente primero, hasta entrar en el
   límite, y el criterio va escrito en el aviso.** Se generaliza a todo limit contable **en vez de
   inventar un segundo criterio**, porque dos criterios distintos para la misma clase de problema
   es cómo se vuelve impredecible»* (`V/15` §4.3). *«Cae»*, *«hasta entrar en el límite»*: el
   sujeto es el excedente, no la restitución.
4. `V/03` §9 lo repite igual de acotado: *«El excedente tras un downgrade tiene criterio escrito y
   predecible: **se despublican las publicadas más recientemente**, hasta entrar en el límite, y el
   criterio va escrito en el aviso — si el cliente no puede leerlo, **deja de ser predecible** y se
   pierde el motivo por el que se eligió (`DEC-SUB-008`)»*.
5. Y no hay aviso que lo cubra del otro lado. Recorrí las 17 filas de `B/19` §4 y las 5 de `V/19`
   §2: la única que habla de la vuelta es `V/19` fila 18, *«el aviso de **ficha archivada**»*, que
   promete *«que **vuelve sola cuando recupere la cobertura** (`PB7`)»* — **sin condición**, aunque
   la fila de la transición la tenga.
6. El reloj tapa la mitad del daño y no la otra: *«el reinicio cuelga del HECHO, no de la
   transición: si el cliente vuelve con un plan más chico y el cupo no alcanza, **el reloj se
   reinicia igual**»* (`V/02` §4.2 regla 4). O sea que las que no entran **no se borran** — pero
   quedan abajo, y cuál queda abajo lo decide el orden de recorrido de una implementación.

**Dónde lo permite el diseño.** Las seis citas. `PB3` ya tenía la condición *«y el cupo alcanza»*
sin criterio, así que la mitad es preexistente; lo que la tanda agregó es que **la población que
compite por ese cupo se duplicó** —ahora incluye las archivadas, que llevan 90 días o más fuera del
sitio público— y que el aviso de `V/19` fila 18 promete la vuelta **sin la condición**.

**Severidad.** `MEDIA` — no otorga nada indebido ni pierde datos: la ficha que no entra queda
abajo y su reloj se reinicia. Lo que se rompe es la propiedad que `DEC-SUB-008` compró con su
criterio —que el cliente pueda **predecir** qué ficha suya se ve— justo en el acto donde acaba de
volver a pagar, y una promesa de superficie que la transición no cumple.

**¿Es nuevo, o es el arreglo?** **Mitad y mitad.** La ausencia de criterio en `PB3` es preexistente
y ningún hallazgo mío anterior la reportó. Lo nuevo es de `DEC-DATA-002` (commit `621332e7c`):
`PB7`, que mete a las archivadas en la misma competencia, y la fila 18 de `V/19`, que el mismo
commit escribe prometiendo la vuelta sin nombrar el cupo.

**¿Lo habría encontrado el grep?** **No.** El término que el arreglo introduce es `PB7` / *«y el
cupo alcanza»*. `rg -n "el cupo alcanza"` devuelve **sólo `V/03` §9**, las dos filas, o sea el
archivo y la sección que el commit edita. El consumidor que tendría que dirimir —`V/15` §4.3— no
usa esa frase: dice *«hasta entrar en el límite»*.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** Las dos apariciones de la condición
están en la tabla que el commit reescribe, y la fila 18 de `V/19` la escribe el mismo commit: los
tres párrafos quedan fuera del recorte *«en un párrafo que ese commit no tocó»*. `V/15` §4.3 sí está
en un archivo que `621332e7c` **no** toca, pero **no contiene el término**, así que tampoco aparece
en ningún rastro por aparición.

---

## BAJA

### F-8eA1-007 — `V/02` §4.2 sigue diciendo que la ficha archivada se reactiva «suscribiéndose» y `PB8` existe justamente para el que no paga: la regla que defiende el hard delete describe una salida más angosta que la que el diseño tiene

**Qué se rompe.** La regla que justifica el borrado del día 180 enuncia la salida como *«exportarla
o reactivarla **suscribiéndose**»*. `PB8` no pide suscribirse: su población declarada es *«el que
quiere su ficha de vuelta **sin pagar todavía**»*. Quien lea la regla 3 tal cual está entiende que
para recuperar la ficha hay que volver a contratar, que es la lectura que `PB8` vino a desmentir —y
es además la que, combinada con `F-8eA1-001`, vuelve la promesa inalcanzable en los dos sentidos a
la vez.

**El camino.**

1. La regla: *«**El día 90 no borra nada.** La ficha sale del sitio público, **el dueño la sigue
   viendo** y puede exportarla o **reactivarla suscribiéndose** (`DEC-DATA-001`)»* (`V/02` §4.2
   regla 3).
2. El párrafo que sigue, en la misma regla, ya la contradice sin corregirla: *«Hoy lo ejecutan
   **`PB7`** —sola, cuando la cobertura vuelve— y **`PB8`** —a pedido del dueño, hacia `DRAFT`—»*.
3. Y la tabla de la transición es explícita en lo contrario: *«| para quién existe | el que pausó,
   el que recontrata, el que regularizó | **el que quiere su ficha de vuelta sin pagar todavía**, y
   el borrador que archivó `PB5` |»* (`V/03` §9).
4. La superficie sigue la versión ancha: *«que **vuelve sola cuando recupere la cobertura** (`PB7`)
   y que **puede traerla a borrador cuando quiera** (`PB8`)»* (`V/19` §2, fila 18).

**Dónde lo permite el diseño.** Las cuatro citas. Tres documentos dicen la versión ancha y la regla
que **justifica el borrado** dice la angosta, que es el peor reparto posible: la frase que un
abogado o un implementador va a leer para decidir si el hard delete es defendible es la que
describe menos salidas de las que hay.

**Severidad.** `BAJA` — no cambia ninguna resolución y el resto del corpus dice lo correcto. Lo
reporto porque es la frase sobre la que `V/02` §4.2 apoya el borrado de contenido, y porque su
versión angosta es **exactamente el desenlace** que `F-8eA1-001` produce por otro camino: si la
regla 3 fuera verdadera, `PB8` no existiría.

**¿Es nuevo, o es el arreglo?** **Lo introdujo `DEC-DATA-002`** (commit `621332e7c`), que agregó el
párrafo de `PB7`/`PB8` **debajo** de la frase vieja sin reescribirla. Antes de la tanda *«reactivarla
suscribiéndose»* era la única lectura posible, porque `ARCHIVED` no tenía salida.

**¿Lo habría encontrado el grep?** **Sí, y sobre el archivo que el commit edita.** El término es
*«reactivar»*; `rg -n "reactiva"` devuelve siete líneas en todo el corpus y ésta es una de ellas,
a **siete renglones** del párrafo que el commit agrega.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, por el recorte.** La aparición está en
`V/02` §4.2 regla 3 —archivo **y sección** que `621332e7c` edita—, así que cae en la zona que la
obligación 2 excluye. Es el tercer hallazgo de esta pasada en el que el defecto está a menos de
diez renglones del texto nuevo, y el cuarto en total si se cuenta la vuelta anterior.

---

## Mis diez hallazgos de la 8-bis-3, reejecutados sobre el texto de hoy

No cuentan como hallazgos nuevos. Cada camino se volvió a correr paso por paso sobre el texto
vigente.

| ID | título, en corto | ¿corta? | dónde |
|---|---|---|---|
| `F-8dA1-001` | `T2`/`T6` queman el trial ante un `GRANT` y revocar no lo devuelve | **se retira por decisión** | `DEC-TRIAL-009` lo resolvió: *«no se repara. Se declara»*. El texto llegó a `V/11` §2.4 y a `NUCLEO/08` §3.1. **No lo reabro** — lo que sí reporto es que la única obligación que impuso no está en `B/19` §4 fila 13 (`F-8eA1-003`) |
| `F-8dA1-002` | `DEC-GRANT-006` dejó el §34.1 sin instrumento; `T4` tiene medio evento sin productor | **NO** | llega entero. `V/03` §2 `T4` sigue diciendo *«promo de extensión **o cortesía**»*; `B/03` §3.2 `S9` sigue exigiendo `ACTIVE`; `V/11` §3.2 sigue apoyando el techo en *«un promo del §32 o **una cortesía del §34.1**»* y §3.4 en *«una extensión firmada por `SUPER_ADMIN`»*; `NUCLEO/08` §3 sigue listando *«extender un trial»* sin transición que lo produzca. `V/11` §2.3 sigue prometiendo la reparación que no tiene camino |
| `F-8dA1-003` | el conjunto plegable de `V/15` §2.6 no lleva el recorte de `V/11` §5.3 | **NO** | llega entero, paso por paso. `V/15` §2.6 sigue definiendo el plegable como *«`TÍTULO` y `BASE`, más … `COMPLEMENTO` SÓLO SI hay al menos una de clase `TÍTULO` viva»* y sus *«tres casos que NO cambian»* siguen sin el trial; `V/11` §5.3 sigue prohibiendo lo contrario; `G-R2` sigue escrito sobre el caso complementario. **`DEC-ADDON-005` NO lo cubre**: esa decisión es sobre la fuga de `S20` entre verticales del grant, no sobre el addon en una vertical cuyo único título es un trial |
| `F-8dA1-004` | el piso del trinquete no cruza la frontera y `G-R2-B` mira el plan | **NO** | llega entero, y lo verifiqué contra la firma: el `12-contrato…` §2 sigue con **cinco** campos —`tipo`, `referencia`, `alcance`, `objetivo`, `hasta`— y ninguno es el piso; `V/15` §2.5 sigue afirmando *«la fuente `GRANT` de esa vertical —con el plan de esa vertical **y el piso de esa vertical**—»*; `G-R2-B` sigue siendo *«transporta **un plan de otra vertical**»* (`V/20` §2) |
| `F-8dA1-005` | anclar no está en el catálogo de acciones administrativas | **SÍ** | corta en el paso 2: `NUCLEO/08` §3 ahora dice *«otorgar, **anclarle una vertical nueva**, o revocar un grant permanente»*, con el párrafo que explica por qué sigue habiendo doce filas, y `NUCLEO/04` §2 extiende el §64.30 —*«**La misma autorización cubre las otras dos escrituras**»*—. Verifiqué las cinco líneas que cuantifican sobre la tabla y las cinco siguen diciendo doce y siguen siendo exactas |
| `F-8dA1-006` | `T2` y `T4` salen del mismo estado con veredictos opuestos y `G-R4` no los ve | **NO** | llega entero: las dos filas siguen textuales en `V/03` §2, una cortesía sigue siendo `TÍTULO` (`12-contrato…` §2.4), `G-R4` sigue comparando `(desde, evento)` y `NUCLEO/03` §1 regla 7 sigue enumerando **tres** pares. Sigue no alcanzable sólo porque `F-8dA1-002` no tiene camino |
| `F-8dA1-007` | tres planes no vendibles, cinco documentos dicen «las dos»; el séptimo lector del catálogo | **NO, y medio arreglado** | `V/20` §2 ahora **nombra** las dos (*«la de pre-trial o la de piso»*), lo que quita la ambigüedad del guard. Pero `V/02` §2.1 sigue declarando **tres** planes no vendibles y usando *«los dos»* para dos pares distintos; **nada en el modelo dice cuál plan es cuál**; y `V/10` §2 sigue con **seis** filas y su *«sin excepción»*, sin la fuente de trial en `TRIAL_ACTIVE`, que lee la versión del plan de trial |
| `F-8dA1-008` | la razón de `DEC-GRANT-006` —«no hay revocación que se escape»— la desmiente el catálogo | **NO** | llega entero: `NUCLEO/08` §3 fila 1 sigue siendo *«**otorgar o revocar** una **cortesía temporal** … **sí**: revocar deja al cliente sin la cortesía que le quedaba»*, y `DEC-GRANT-006` sigue apoyándose en *«una cortesía se vence sola … No hay revocación que se pueda escapar»* |
| `F-8dA1-009` | `NUCLEO/01` no recibió las redefiniciones de la cortesía ni del grant — `NUCLEO` | **NO** | llega entero, verificado línea por línea sobre el archivo de hoy (`updated: 2026-09-21`): §1.5 línea 106 sigue definiendo la cortesía sin decir que es por suscripción, y el mapa conceptual de §5 sigue con *«└── Grant permanente (§35, **con su scope de verticales**)»*. El §2.4 creció de cinco predicados a **20 consumidores** en el mismo archivo y estas dos líneas no se movieron |
| `F-8dA1-010` | `VERTICAL_SUBSCRIPTION` colapsa en `VERTICAL` diciendo que no renombra nada | **SÍ, como hallazgo** | el desenlace no cambió, pero dejó de ser un hueco: el `12-contrato…` §2.7 ahora lo **declara** —*«**el mapeo del addon SÍ colapsa un nombre**, así que decir «no se renombra ninguno» era falso para esa fila»*— con sus tres consecuencias y **citando el hallazgo por su ID**. Queda como línea a revisar, no como contradicción |

**Uno corta** (`005`), **uno se retira por decisión** (`001`), **uno corta declarándose** (`010`),
**uno corta a medias** (`007`) y **seis siguen llegando**. El único que cortó limpio lo cerró un
commit de arreglo (`1e3c3fc9e`) más una decisión del owner sobre el invariante; **ninguno de los
seis que siguen cae en el alcance de un commit de esta tanda**.

**Y dos de fases anteriores que siguen llegando y son de este vector**, sin ID nuevo porque ya lo
tienen: `F-8bA1-012` —la dirección inversa del contrato— **corta a medias**: el `12-contrato…`
§4.1 ahora dice *«Son **siete** campos en tres preguntas»*, pero la regla de vigilancia del §4.2
sigue diciendo *«algo que no está en los **seis** campos del §4.1»* y `V/02` §2.1 sigue diciendo
*«Son **dos de los seis campos** de la dirección inversa»*. El enunciado se corrigió y sus dos
consumidores no, así que el control del acoplamiento inverso sigue cuantificando sobre un conjunto
que no existe. Y `F-8cA1-014` —*«nueve pasos»* sobre una tabla numerada 1 a 7, con `V/17` §3.5
restando *«los otros ocho»*— **llega entero**: lo recorrí hoy sobre `V/17` §1.1, §1.2 y §3.5 y no
se movió nada.

---

## Ataques que intenté y el diseño resistió

Vale tanto como la lista de arriba: son los caminos que probé sobre el texto nuevo y que cierran.

+ **Anclarle una vertical a un grant sin permiso propio, aprovechando que el acto es nuevo.**
  Cerrado en los dos lugares que hacían falta: `NUCLEO/08` §3 lo metió en la fila del grant con su
  párrafo de por qué siguen siendo doce, y `NUCLEO/04` §2 extendió el §64.30 con la frase que cierra
  el flanco —*«si «otorgar» fuera la única autorizada, extender un grant a una vertical más quedaría
  sin gate y `SUPER_ADMIN` dejaría de ser exclusivo **por la puerta de al lado**»*—. Es `F-8dA1-005`
  cortado, y cortado por el lado correcto.
+ **Ejecutar la escritura que ningún catálogo nombra —desanclar— para reducir un scope sin
  revocar.** Cerrado por `DEC-ADDON-006`, que en vez de declarar el acto reescribió la cláusula que
  lo esperaba. Verifiqué con `rg -n "desanclar"` sobre `.specs/`: aparece sólo en el log, en el
  `12-contrato…` §2.8 y en `B/02`/`B/16`/`B/03`, **siempre para decir que no está declarado**.
+ **Contratar una suscripción paga en una vertical que mi grant ya cubre, y que nadie lo note.** La
  base no lo impide —el candado `A` es sobre filas de `subscription` y un grant no ocupa ninguna—,
  pero **existe detector y es de cero llamadas**: *«un beneficiario con un ancla viva en la vertical
  V no debería tener una fila viva **principal** en V»* (`NUCLEO/01` §2.4 fila 17, `B/09` §3). No
  cierra la puerta, pero la vigila, y el hallazgo que quedaría es de cobro, no de acceso.
+ **Conservar un addon convertido a $0 después de que me revocaron el grant, volviendo a
  suscribirme el mismo día.** Cerrado, y con la razón escrita: el predicado es *«se revoca **el
  grant del que cuelga el ancla que era su título**»* y no *«no le queda ninguna fuente `TÍTULO`»*
  — `B/03` §8 lo dice con ese caso exacto—, y la instancia apunta al ancla, no al grant.
+ **Quedarme con el cobro de un complemento vivo después de que su instancia murió.** Cerrado por
  `S21`, con su evento atado **al estado de llegada de la instancia** y no a un predicado, así que
  cubre las tres cláusulas de `A5` más `A6`, y con la salvedad 1 del barrido pudiendo nombrar el
  sujeto de las dos maneras (`B/03` §3.2 y §8).
+ **Que `S13` me cancele el complemento que pagué ayer, por pertenecer al conjunto.** Sigue cerrado
  por el adjetivo *«principal»*, que ahora es fila 1 del inventario de `NUCLEO/01` §2.4 y lo cuenta
  `G-R1-E`. Probé entrar por `S20`, y `S20` evalúa condición —flag, compatibilidad del producto,
  objetivo en los scopes con vertical propia— en vez de alcanzar por pertenencia.
+ **Quemarle el trial a un ex-partner el día del encendido y que nadie lo vea, entrando por el
  candado del hecho nuevo en la frontera.** Cerrado: `T7` se apoya en un hecho de verticales leído
  sobre el pasado y **no agrega nada a la frontera**, que es lo que `DEC-TRIAL-008` prohíbe. Lo que
  sí rompe es por dónde se lee ese hecho, y es `F-8eA1-004`.
+ **Publicar el borrador de alguien que nunca pidió publicarlo, el día que recupera cobertura.**
  Cerrado por el `desde` de `PB7`, que mira el origen —*«sólo si venía de `PUBLISHED` o de
  `UNPUBLISHED_BY_BILLING`»*— y lo lee del evento de dominio append-only, sin columna nueva
  (`V/03` §9).
+ **Quemarle el trial a quien reanuda una pausa, haciendo pasar a `PB7` por el evento de
  activación.** Cerrado explícitamente: *«`PB7` no es el evento de activación, y no consume ningún
  trial … **restituir no es publicar**»* (`V/03` §9, punto 1).
+ **Borrarle la ficha a un cliente que pausó, dejando que el reloj de inactividad llegue al día
  180.** Cerrado por `D16` y `G-R5`, que convierten la desigualdad 120 < 180 en algo que se vuelve
  a mirar en cada PR en vez de en una nota. Probé subir el tope de pausa y el guard es exactamente
  lo que falla.
+ **Hacer que un grant de scope plural alimente una vertical con el plan de otra.** Sigue cerrado en
  la base —`UNIQUE(permanent_grant_id, vertical)` más *«el plan … pertenece a esa vertical»*
  (`B/02` §2.4)— y ahora también en el contrato, cuyo §2.7 dice que cada fuente transporta *«**el
  ancla de esa vertical** … nunca la de otra»*.
+ **Comprar un addon apoyándome en un grant que ancló otra vertical.** Cerrado por `B/16` §2.4:
  *«**Y vale en la vertical donde el grant ANCLÓ, no en todas** … En una vertical donde no ancló
  nada **no emite fuente**»*.
+ **Que un job o un webhook otorgue una cortesía, un grant o un ancla.** `V/17` §3.3 intacto —*«Un
  actor de sistema no puede ejecutar ninguna de las doce acciones»*— y ahora reforzado por el
  párrafo de `NUCLEO/08` §3 que dice que una escritura sin fila *«**no le está prohibida a un actor
  de sistema**»*, que es justamente por qué anclar tuvo que entrar a la tabla.
+ **Acumular roles hasta que el paso 3 deje de filtrar, o que una transición me escriba uno.**
  Sigue cerrado: §64.12, §64.13, `G6` y `G4`, los cuatro intactos.
+ **Impersonar al cliente para lavar el rastro.** `V/17` §3.2 regla 4, intacta.
+ **Leer la ficha archivada de otro dueño aprovechando que `ARCHIVED` dejó de responder «no
  existe».** Cerrado con precisión: la precisión 1 de `V/17` §1.2 acota la excepción a *«de su
  dueño»* y mantiene el *«no existe»* para todo lo demás. El defecto que quedó es el opuesto —que
  el dueño tampoco pueda— y es `F-8eA1-001`.

---

## Fuera de mi vector

Lo que vi y le toca a otro. No lo perseguí.

+ **Costura (`C1`).** El `12-contrato…` §2.4 sigue diciendo *«Las **tres** combinaciones imposibles
  lo son por una razón escrita»* sobre una tabla 6 × 4 en la que conté **dos** celdas marcadas
  *«imposible»*. Es `F-8cA1-010` en su forma de hoy, sobre un texto que además ganó la razón
  escrita de una de las dos (§2.6, último párrafo).
+ **Costura (`C1`).** El catálogo de `V/20` §2 pasó a **15** guards contados por mí (los 14 de la
  vuelta anterior más `G-R5`), `B/20` §2 tiene los suyos, y `HOS-1353/spec.md` sigue diciendo
  *«siete guards»*. La brecha creció otra vez.
+ **Costura (`C1`) / `NUCLEO`.** El inventario de consumidores de *«fila viva»* de `NUCLEO/01` §2.4
  tiene **20 filas** numeradas 1-20 repartidas 10 y 10, pero su numeración salta —el grupo A va
  `1…6, 17, 18, 19, 20` y el B va `7…16`—, así que *«el inventario tenga una fila menos que los
  consumidores»*, que es lo que `G-R1-E` cuenta, no se puede verificar leyendo el último número.
+ **Datos (`A3`) / legal (`V/22`).** El hecho 1 de reinicio de la inactividad incluye
  **`exportarla`** (`NUCLEO/01` §1.2), así que un dueño puede posponer el hard delete del día 180
  indefinidamente con una lectura cada 179 días. Un reloj de retención que el sujeto reinicia sin
  actuar sobre el dato es otra cosa que un reloj de retención.
+ **Máquinas (`A2`).** Quién guarda el valor anterior de `cubierto` para detectar *«el cambio»* que
  disparan `PB2`, `PB3` y ahora `PB7` sigue sin estar escrito en ningún lado, y el consumidor nuevo
  hace tres.
+ **Máquinas (`A2`).** Un partner cuya postulación fue **aprobada antes** del encendido pero que
  reclama su cuenta **después** no está en la cohorte de `T7` —no estaba en `PRE_TRIAL` ese día— y
  tampoco dispara `T1` ni `T6`, cuyo evento es el acto y no el pasado. Queda en `PRE_TRIAL` con el
  evento ya ejercido y el trial sin consumir, sin transición que lo saque.
+ **Billing (`B1`).** `DEC-SUB-012` declara en voz alta que *«una `SUSPENDED` de pagador manual que
  nadie cancela **es reabrible indefinidamente**»*. Para mi vector eso es una fila que puede volver
  a otorgar acceso años después; para el de cobro es otra cosa.

---
title: "FASE 9 vuelta 3 · verificación corta — verticales y transversal"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 9
---

# FASE 9 vuelta 3 · verificación corta: verticales y transversal

Verificación de sólo lectura de lo que la FASE 9 vuelta 3 aplicó en el tramo de verticales, en el
corte y en las cifras que cruzan el programa. Medido en el worktree
`hospeda-spec-hos-1352-billing-redesign`, HEAD `c021d8c6c8` (lotes AC y AD incluidos). Los
recuentos se hicieron con `python3` sobre el texto sin tachados, buscando cada cifra por número y
por palabra en `$V`, `$B`, `$D/nucleo`, el contrato, `16-`, el log y `$D/spec.md`.

## 1. Qué se verificó

| mecanismo | dominio corrido | veredicto |
|---|---|---|
| Lote A: el reclamo que verifica cierra sesiones y credenciales | cuenta del correo sin verificar (ocupante), reclamo desde otra cuenta, sesión abierta por recuperación, por contraseña y por Google | LIMPIO |
| Lotes A y AA: link de un solo uso y secreto `partner.secreto_de_reclamo` | link nuevo, secreto equivocado, sin secreto, link ya usado, reenvío del aviso | **HALLAZGO** (`VC3-VT-01`) |
| Lote A: escritura sólo sobre `owner_user_id` nulo | rama del correo sin usuario, rama con usuario, camino B del admin, Partner ya reclamado | LIMPIO |
| Lote B: una cuenta, un Partner | segundo reclamo, link que no se gasta, alta nueva por la rama sin usuario, addon de scope vertical | LIMPIO |
| Lotes A y B: las dos pantallas que derivan a soporte (`V/19` filas 32 y 33) | link usado, segundo reclamo, criterio de `V8` | cae en `VC3-VT-01` |
| `DEC-AUTH-004` y `DEC-AUTH-005` en el log | texto contra `V/18` §2.4 y `V/17` §1.2 | LIMPIO |
| Lotes I y M: `PP1` como segunda excepción del guest, Turnstile, una postulación abierta por correo | guest con y sin captcha, dos envíos a la vez, cuenta autenticada sin verificar, espejos del paso 1 | **HALLAZGO** (`VC3-VT-09`, `VC3-VT-10`) |
| R13: conversaciones, reseñas y comentarios fuera de la precisión 7 | ficha publicada, borrador, bajada por billing, `PURGED`, respuesta del dueño sobre su ficha no pública | **HALLAZGO** (`VC3-VT-11`) |
| Lote O: `PB13` a la cola ordenada | cupo lleno y libre, origen `PUBLISHED`, `UNPUBLISHED_BY_BILLING` y `ARCHIVED` | LIMPIO |
| Lote Q: `coberturaPerdidaEn` dentro de `retenciónDetenida` y la regla de la primera pasada | aviso atrasado, aviso perdido, pérdida por trial, `NINGUNO`, pasada salteada, ficha cubierta o en pausa en la pasada anterior | **HALLAZGO** (`VC3-VT-05`, `VC3-VT-06`) |
| Lote H y R10: seudónimo tras la baja, `user.deleted_at`, credenciales, trigger de favoritos | baja con trial, sin trial, con postulación, sesión con Google | LIMPIO |
| Lote I × R10: `postulacion.correo` de un postulante sin cuenta | postulante rechazado sin cuenta que pide supresión | **HALLAZGO** (`VC3-VT-08`) |
| Lotes P y AC: permiso que viene con el rol y acción 26 | asignar, quitar, sobre la propia cuenta, override a un `CLIENT_MANAGER`; recuentos 25 · 23 · 7 | **HALLAZGO** (`VC3-VT-03`) |
| R5: `G13` con seis respuestas | contrato §5.1 y §6.3, `V/20`, `$V/spec.md`, criterio de `V4` | LIMPIO |
| R11: `pedido_de_arreglo` en la lista de `PURGED` | `PB9`, `PB12`, correo de moderación levantada (`NUCLEO/07` §6) | LIMPIO |
| R15: `PURGED` sin `deleted_at` y el carril de extras en el paso 6 | favoritos de terceros, foto del paso 6, triggers de `trial` y de la espera | LIMPIO |
| Lista cerrada de `PURGED` | 40 nombres, 40 distintos, en la cuarta columna de `V/02` §4.1 | LIMPIO |
| R19: `canje_de_trial` | reintento con la misma clave, rechazo, `V/02`, contrato y `B/14` | LIMPIO |
| R20: interfaces y simuladores en `V1`, `V4 → B1` | contrato §7.1, las dos descomposiciones, cifra de dependencias | LIMPIO |
| R22 a R25 | cola de `PB13`, borrados remotos después del commit, `PB9` contra el aviso atrasado, clave medida de vertical | R24 cae en `VC3-VT-05`; el resto LIMPIO |
| Lote C: el catálogo en el paso 3 | falla a la mitad, orden contra la prueba, unidad dueña, bases armadas desde el repositorio antes del paso 6 | **HALLAZGO** (`VC3-VT-07`) |
| Lotes N y S: las tres columnas que sobreviven a `U1` | lectura de `L5` y `L7`, migración que las borra, foto del paso 6, `G8` y `G16` | LIMPIO |
| Lote T y R30: recuentos con el viejo apagado | los recuentos que se repiten, qué es gate y qué no | **HALLAZGO** (`VC3-VT-04`) |
| Lote J: las tres declaraciones y la frase de `D/16:143` | causa, daño y falla previa de cada una; otras restauraciones del mismo tipo | **HALLAZGO** (`VC3-VT-02`) |
| Lotes F y G: sin «lo compensa», `EX-59` | guion, `B/21`, matriz (117 = 61 · 16 · 24 · 16) | LIMPIO |
| Lote X: alta sin `expire_date` | fecha de la segunda corrida, registro que sigue abierto después | LIMPIO |
| R9: manifiesto del 1b fuera del repositorio | vida hasta el día siguiente a la segunda corrida, lista de sondas en código | LIMPIO |
| Conteos transversales | guards 33 (19 + 17 − 3), unidades 23, plazos 18 con 5 sin valor, entradas del contrato 8, campos de la fuente 8, `PURGED` 40, log 139 en `$D/spec.md` y `NUCLEO/00` | **HALLAZGO** (`VC3-VT-06`, `VC3-VT-12`) |

Veintinueve mecanismos: diecisiete limpios y doce hallazgos, dos que bloquean.

## 2. Hallazgos

### VC3-VT-01 · BLOQUEA · un link de reclamo ya usado contesta dos cosas

El lote A dice que quien abre un link ya usado ve que el Partner ya tiene dueño (la fila 32), y
el lote AA dice que un link con el secreto equivocado contesta lo mismo que uno de un Partner que
no existe, y que el reclamo que escribe el vínculo vacía la columna del hash. Corrido: Juan
reclama su Partner; la columna queda nula. Al día siguiente abre el mismo link. Su secreto ya no
coincide con ningún hash, así que por la regla del lote AA contesta *«no existe»*; por la del lote
A, la fila 32. Las dos no pueden valer, y el criterio de `V8` prueba la segunda. Y si la
implementación mira primero el vínculo, cualquiera que arme el link con el id de un Partner y un
secreto cualquiera aprende que ese Partner existe y ya tiene dueño.

- `V/18:289` «quien abre un link ya usado ve que ese Partner ya tiene dueño»
- `V/18:295` «contesta lo mismo que uno de un Partner que no»
- `V/18:296` «El reclamo que escribe el vínculo vacía la columna»
- `V/19:79` «al abrir un **link de reclamo de un Partner que ya tiene dueño**»

Recomendación, con elección:

1. El reclamo no vacía el hash, lo conserva marcado como usado: un link con el secreto correcto
   sobre un Partner ya reclamado muestra la fila 32, y uno con secreto equivocado contesta *«no
   existe»*. Cuesta una frase en `V/18` §2.4 regla 4 y en `V/02` §2.7. **Recomendada**: conserva
   la pantalla que el owner aprobó y no revela nada a quien no tiene el secreto.
2. La fila 32 sale y el link usado contesta *«no existe»*. Cuesta la fila 32 y el criterio de
   `V8`, y la dueña que reabre su propio link no sabe por qué.

### VC3-VT-02 · BLOQUEA · restaurar el backup del 2b borra lo que el viejo asentó después de tomarlo

El lote J declara lo que una restauración no deshace, y la segunda situación es el aborto que
borra los pagos que el receptor nuevo asentó. Falta la gemela del lado viejo. El backup del 2b se
toma con el sistema viejo encendido: el borde cierra su ruta de avisos recién en el paso 3, antes
de apagar el contenedor, y el viejo acepta cuentas y fichas hasta que se apaga. Corrido: el 1b
cancela el preapproval de Juan con un cobro en vuelo; el cobro llega al webhook viejo entre el 2b
y el cierre de la ruta, el viejo lo asienta y contesta `200`. La migración del paso 3 falla y la
rama de aborto restaura el 2b: el pago desaparece, Mercado Pago no lo reenvía y el detector no
corre porque el corte no terminó. Lo mismo, con menos daño, con la cuenta que alguien creó en esos
minutos. Es la misma clase de daño que la segunda situación declarada, y exige la misma falla
previa, pero no está en el «NO cierra».

- `D/16:136` «es lo que restaura la rama de aborto si el paso 3 falla con algo ya escrito»
- `D/16:137` «El borde (Cloudflare) cierra esa ruta antes de que se apague el contenedor viejo»
- `D/16:137` «porque el viejo acepta cuentas y fichas hasta que se apaga»
- `D/16:488` «Lo que no deshace una restauración: tres situaciones, declaradas por decisión del owner»
- `D/16:502` «Un aborto borra los pagos que el receptor nuevo ya asentó»

Recomendación, con elección:

1. Declararla como cuarta situación del §4.3, con su causa y su daño, como el owner eligió para
   las otras tres (lote J). **Recomendada**: respeta la elección del owner de declarar y no
   agrega procedimiento.
2. Ordenar el corte para que el 2b se tome con la ruta ya cerrada y el contenedor viejo apagado.
   Cierra el caso, pero es una regla de procedimiento, lo que el owner descartó en el lote J, y
   mueve los cobros de esa ventana a la segunda situación declarada.

### VC3-VT-03 · MENOR · la acción 26 cambió de nombre y no de contenido

El lote AC pasó la fila 26 a *«asignar o quitar el rol»*, pero sólo cambió el nombre en cuatro
lugares. Lo que la fila dice de sí misma sigue hablando de asignar: la confirmación, el sujeto y
el criterio de `V5`, que no tiene un caso de quitar. Y los espejos que la nombran siguen diciendo
*«asignar el rol»*: `V/17` §3.2 reglas 1 y 3, §3.3 y §3.5, `$V/spec.md`, `B/19` §6 y los cuatro
de `B/03`. Las cifras están bien: 25 acciones vivas, 23 capacidades del actor y 7 filas *«sólo
`SUPER_ADMIN`»*, recontadas sobre la tabla y en todos sus espejos.

- `nucleo/08:205` «Su confirmación dice a qué cuenta se le da el rol y qué filas pasa a poder ejecutar»
- `V/17:479` «En la vigesimosexta el sujeto es la cuenta que recibe el rol»
- `$V/descomposicion.md:503` «asignar el rol a otra cuenta deja un registro con actor, sujeto y motivo»
- `V/17:519` «La vigesimosexta, asignar el rol `SUPER_ADMIN`, no toca plata»
- `B/19:206` «con la vigesimosexta, asignar el rol `SUPER_ADMIN`»

Recomendación: que la confirmación diga también a qué cuenta se le quita y qué deja de poder
ejecutar; que el sujeto sea *«la cuenta que recibe o pierde el rol»*; un caso de quitar en el
criterio de `V5`; y los espejos con el nombre nuevo. Sumarlo también a la enumeración de filas
con más de un verbo del mismo §3.

### VC3-VT-04 · MENOR · «los tres recuentos del paso 2» son dos del paso 2 y uno del paso 0

El paso 3 repite, con el viejo apagado, *«los tres recuentos del paso 2»*, y los nombra. El paso 2
tiene dos (Gastronomía y Experiencia, y seudónimos repetidos). El de dueños con más de una `L8`
es del paso 0, donde tampoco es gate. La regla que aplica (los dos primeros abortan, el tercero se
anota) está bien; la remisión no.

- `D/16:137` «se repiten los tres recuentos del paso 2»
- `D/16:135` «Y el recuento de cuentas de la cartera que comparten seudónimo en la misma vertical tiene que dar cero»
- `D/16:131` «cuántos dueños tienen más de una ficha a la vista (`L8`) en la misma vertical»

Recomendación: *«se repiten los dos recuentos del paso 2 y el de dueños con más de una `L8` del
paso 0»*.

### VC3-VT-05 · MENOR · el ⚠️ del reconciliador dice dos cosas sobre el punto 1

El lote Q corrigió el encabezado del ⚠️: el punto 1 ya no alcanza a `PB9`, porque
`coberturaPerdidaEn` se guarda con el encolado del aviso y no depende de que llegue. Corrido con
un aviso perdido, el encabezado es verdad. Pero el cuerpo del punto 1 quedó igual y sigue diciendo
que la relectura de `PB9` sobre el reloj viejo puede adelantar el borrado del día 180.

- `V/03:1232` «desde el lote Q ni ése alcanza a `PB9`»
- `V/03:1245` «y eso puede adelantar el borrado del día 180»

Recomendación: acotar la frase del punto 1 al archivado (`PB4` y `PB5`), que no es irreversible,
y decir que `PB9` cuenta además desde `coberturaPerdidaEn`.

### VC3-VT-06 · MENOR · el contrato sigue contando trece campos

El lote Q suma un campo a `retenciónDetenida` y el contrato dice bien que siguen siendo ocho
entradas. Pero la cuenta de campos de las consultas no se movió: con `coberturaPerdidaEn` son
catorce (cuatro de `políticaDePlan`, tres de `ficha`, cuatro de `políticaDeAddon` y tres de
`retenciónDetenida`). El registro `15-` recontó entradas y campos de la fuente, no éste.

- `D/12:1236` «trece campos en»
- `D/12:1119` «Es el instante en que `cubierto` pasó por última vez de `sí` a `no`»

Recomendación: *«catorce campos en cuatro consultas»*, con el origen del lote Q.

### VC3-VT-07 · MENOR · la carga del catálogo tiene dos unidades dueñas y corre en toda base antes del paso 6

El lote C metió el catálogo de producción dentro de la migración estructural del paso 3, que es
de `V6`. La fila de `V2` sigue diciendo que `V2` construye *«la migración del catálogo»*, con un
criterio de migración suelta (corrida dos veces no escribe dos), que no aplica a un tramo de otra
migración. Y la migración estructural es del carril de migraciones del repositorio: desde que se
mergea hasta el paso 6, toda base que aplique las migraciones (el ensayo en `staging`, las de
desarrollo, la de CI) carga el catálogo de producción, además de los datos de demostración del
seed. El paso 6 sólo dice que la foto de partida no lo lleva.

- `$V/descomposicion.md:487` «(la operación, las validaciones y la migración del catálogo)»
- `$V/descomposicion.md:487` «la migración del catálogo, corrida dos veces, no escribe dos»
- `$V/descomposicion.md:511` «dueña de la migración estructural del corte»
- `D/16:145` «No lleva el catálogo de producción»

Recomendación: que `V2` construya la carga como una pieza que llama la migración de `V6`, con el
criterio de que la prueba del corte la lee ya escrita; y que diga qué hace esa carga en una base
que no es la de producción (no correr, o correr sólo con una bandera del corte). Lo segundo es de
implementación si el owner no lo quiere escrito.

### VC3-VT-08 · MENOR · el correo de un postulante sin cuenta no tiene quién lo borre

El lote I trae una población nueva: quien postula sin cuenta. Su correo queda en `postulacion`,
en claro y sin retención. El único escritor que lo reemplaza es la acción 24, y la acción 24 opera
sobre una cuenta. Corrido: Juan, sin cuenta, postula su bar; lo rechazan y pide que borren sus
datos. No hay cuenta que dar de baja, y la tabla del `NUCLEO/08` §3 no deja ejecutar una escritura
sin fila.

- `V/02:592` «El correo es un dato personal que la baja de cuenta alcanza»
- `V/17:236` «Postular un Partner (`PP1`) es la segunda excepción del guest en el paso 1»
- `nucleo/08:330` «lo que no se puede es ejecutar una escritura que no esté nombrada en ninguna fila»

Recomendación: extender el alcance de la acción 24, o el de la acción de la postulación (la
quinta), a reemplazar el correo de una postulación a pedido de quien la escribió; o declararlo en
el «NO cierra» de `V/18` con su causa.

### VC3-VT-09 · MENOR · dos espejos del paso 1 siguen con una sola excepción del guest

El paso 1 de `V/17` §1.2, la precisión 9, la fila del visitante de §3.3 y `V/03` §11 dicen dos
excepciones. Dos lugares siguen diciendo que el guest falla en el paso 1 salvo en la lectura
pública: la razón de `V/02` §2.1 (la conclusión sigue siendo cierta, porque `PP1` tampoco pasa
por el paso 5) y el resumen de `V5` en la descomposición.

- `V/02:231` «el paso 1 lo rechaza en toda operación que no sea una lectura pública»
- `$V/descomposicion.md:58` «el guest rechazado en el paso 1 salvo en la lectura pública»

Recomendación: sumar *«y en `PP1`»* en los dos.

### VC3-VT-10 · MENOR · una cuenta sin verificar no puede postular y un visitante sí

La precisión 9 saca del paso 2 al guest porque no tiene cuenta, y no dice nada de quien sí tiene
sesión. Corrido: Juan se registró y no verificó su correo; con sesión, postular falla en el paso 2
por *«correo sin verificar»*; si cierra sesión, postula. La razón que dio el owner para el lote I
(no quitarle esa población al formulario) vale igual para él, y la guarda de `PP1` mira el correo
del formulario, no el de la cuenta.

- `V/17:242` «El paso 2 no le aplica, porque no hay cuenta»

Recomendación: que `PP1` no pase por el paso 2 tampoco para una cuenta autenticada, o que la
pantalla le diga que postule sin sesión. Lo primero es una frase en la precisión 9.

### VC3-VT-11 · MENOR · el turista no puede contestar sobre una ficha que dejó de publicarse, y ninguna pantalla lo dice

La precisión 7 deja escribir al turista sólo sobre una ficha `PUBLISHED`, y al dueño sobre la
suya en cualquier estado. Corrido: Juan le escribe a María por su cabaña; la ficha baja por
billing; María contesta. Juan ve la conversación entera en su bandeja y, al responder, recibe
*«no existe»*. La fila 28 de `V/19` cubre sólo la ficha `PURGED`; el caso intermedio no tiene
pantalla (caso vecino 5 de `11-`, no aplicado).

- `V/17:222` «Leer la propia conversación sigue siendo una lectura de lo suyo, también sobre una ficha que ya no se publica»
- `V/19:75` «en la bandeja de los dos»

Recomendación: extender la fila 28 a toda ficha que no está en `PUBLISHED`, con el texto de sólo
lectura y sin decir por qué, o una fila nueva.

### VC3-VT-12 · MENOR · el resumen del log suma 138 y dice 139

El log tiene 139 decisiones (140 encabezados menos la plantilla), y lo dicen bien `$D/spec.md`,
`NUCLEO/00` y el resumen del log. Pero las dos filas que las parten no suman: 123 funcionales y
15 de metodología. Los prefijos `DEC-METH-` son 16 desde `DEC-METH-016`, que además está bajo el
encabezado funcional, así que el paréntesis también tendría que decir doce. Viene del
2026-09-29, no de esta vuelta, pero es espejo de la cifra que esta vuelta movió.

- `D/01:7088` «15 (por prefijo; once —`DEC-METH-005` a `-015`— están bajo el encabezado funcional»

Recomendación: 16, y *«doce —`DEC-METH-005` a `-016`—»*.

## Key Learnings

1. Dos lotes que escriben en la misma regla, uno sobre la pantalla (A) y otro sobre el secreto
   (AA), pueden quedar bien cada uno y contradecirse entre sí: el que vacía la columna cambió qué
   contesta el link que el otro describía.
2. Una restauración pierde lo que el sistema que sigue encendido escribió después del backup, no
   sólo lo que el corte hizo afuera de la base: la declaración del lote J miraba hacia adelante.
3. Un campo nuevo en una pregunta existente no mueve la cifra de entradas, pero sí la de campos:
   hay dos conteos colgados del mismo bloque de firmas.
4. Cambiar el nombre de una fila no alcanza cuando la fila describe su confirmación, su sujeto y
   su criterio con el verbo viejo.
5. Una excepción nueva de la cadena (el guest en `PP1`) arrastra también a quien tiene sesión y le
   falta otro paso, y a los datos que esa población deja sin un escritor que los borre.

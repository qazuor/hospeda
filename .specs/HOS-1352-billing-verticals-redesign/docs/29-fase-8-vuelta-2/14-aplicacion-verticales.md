---
title: "FASE 9 vuelta 2 · aplicación — verticales"
linear: HOS-1352
statusSource: linear
created: 2026-09-27
updated: 2026-09-27
status: CURRENT
fase: 9
---

# FASE 9 vuelta 2 · aplicación — grupo D, verticales

Racimos R7, R9, R10, R14, R15 y R22 del [consolidado](./00-hallazgos.md), más los sueltos de
verticales: `A2-007` y `A3-006` (R13), `A3-004` (R23) y `A3-005` (R24). R7, R9 y R15 aplican las
decisiones del mismo nombre de [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md). R10,
R14, R22, R13, R23 y R24 son escritura sin decisión. Confirmado contra la trazabilidad
(`00-hallazgos.md` §8): son los doce IDs de `A1`, `A2`, `A3` y `D1` que ningún registro anterior
nombra. Faltan `A1-001` a `-004`, `A2-001` a `-007`, `A3-003` a `-006` y `D1-002`. `A2-008` lo
aplicó el grupo C (R12).

Medido y editado en el worktree `hospeda-spec-hos-1352-billing-redesign`, sin commits, sobre lo que
dejaron commiteado los grupos A, B y C (`b500361f93`). `V/` es `HOS-1353…/docs`, `nucleo/` es
`HOS-1352…/docs/nucleo`. No toqué `B/*`, el contrato, `D/16` ni `B/21`.

## 1. Qué se aplicó

### R14 · la precisión 7 y el sujeto (`F-8V2A1-001`, `F-8V2A1-002`)

**La escritura sobre lo ajeno.** La precisión 7 queda acotada a lo que no escribe. Una escritura
exige `sujeto = dueño`, y sobre lo ajeno, sea público o no, contesta *«no existe»*. Así el
repertorio de respuestas no crece. La compra de un addon `LISTING` con una ficha ajena de
objetivo entra como escritura.

- `V/17:197` — «Y vale sólo para lo que no escribe»
- `V/17:74` — «una escritura exige `sujeto = dueño`»
- El mismo recorte en el §3.5: `V/17:512` — «y sólo para leer: una escritura»

**El sujeto.** Es la precisión 8, simétrica de la 6. Una operación que no es de `actor ≠ sujeto`
tiene `sujeto = actor`, siempre. En una de `actor ≠ sujeto`, el sujeto es el dueño del recurso,
leído del recurso, y si el pedido declara otro, contesta *«no existe»*. La operación declara en
qué caso está, igual que declara su clase (regla 3). Descarté anclar el sujeto al recurso en toda
operación. Sobre un borrador ajeno, el paso 3 habría contestado *«sin permiso»* y confirmado que el
id existe, contra la precisión 1.

- `V/17:206` — «El sujeto no viene del pedido: se lee de la sesión o del recurso»
- `V/17:503` — «Lo propio» es del sujeto, y el sujeto no lo elige el pedido

**El permiso de lectura.** Cada entidad que el §48 manda inspeccionar tiene su permiso de
inspección, y ninguno es *«es administrador»*. Eso sale de la regla 1. **No suma ninguna acción
al catálogo de `NUCLEO/08` §3.** Ese catálogo es de escrituras, y el §3.3 le prohíbe sus filas al
actor de sistema. Si las inspecciones entraban ahí, los jobs, que leen todo el tiempo, quedaban
sin poder leer. La lista de permisos se arma con la superficie del admin, como la del §3.5 punto 2.

- `V/17:342` — «Y una lectura con `actor ≠ sujeto` también exige el suyo»
- `V/19:44` — «con el permiso de inspección de cada entidad»
- Espejos en la spec: `$V/spec.md:170` — «tiene ~~siete~~ ocho», `$V/spec.md:186` — «El sujeto
  no lo elige el pedido»

### R10 · la acción 15 (`F-8V2A1-004`, `F-8V2D1-002`)

**Los pasos 6 y 7, sobre el sujeto.** La regla 3 pasa a decir que las catorce primeras acciones son
capacidad del actor, y que la decimoquinta se evalúa sobre el dueño de la ficha. Las dos analogías
del §3.4 y la frase de `NUCLEO/08` §3 que decía que toda fila es capacidad del actor se corrigieron
en el mismo acto.

- `V/17:363` — «La decimoquinta, editar el contenido de una ficha ajena, no está en la excepción»
- `V/17:422` — «catorce acciones administrativas que son»
- `V/17:450` — «catorce acciones del cap. 08 §3 que son capacidad del actor»
- `nucleo/08:182` — «todas menos la decimoquinta, que se evalúa sobre el sujeto a propósito»
- `$V/spec.md:211` — «y la excepción son las catorce primeras acciones de `NUCLEO/08` §3»

**El aviso.** El núcleo apuntaba a la fila 1 de `V/19` §4, que es el botón Empezar de Turista. El
aviso no existía, así que lo creé: la fila 26 de `V/19` §4 y su entrada en `NUCLEO/07` §6.

- `nucleo/08:166` — «el aviso de la fila 26 del cap. 19 §4»
- `V/19:73` — «cuando soporte edita el contenido de su ficha»
- `nucleo/07:242` — «contenido de tu ficha editado por soporte»

### R7 · decisión `R7` — la identidad de Partner (`F-8V2A1-003`, `F-8V2A2-005`)

- **El reclamo exige sesión y vincula a la cuenta que reclama.** Si esa cuenta es la del correo y
  no lo tiene verificado, el reclamo lo verifica. Si reclama desde otra cuenta, la cuenta que tiene
  la dirección no se toca. La decisión dice *la cuenta del correo*, y la razón que da (el link
  llega sólo a quien lee la casilla) prueba la casilla y la sesión, no una tercera cuenta.
  Verificar la cuenta del ocupante le entregaría a Juan un correo verificado, que es lo contrario
  de lo que la decisión cierra.
  `V/18:256` — «Leer la casilla prueba la casilla, no la cuenta»
- `V/18:262` — «El reclamo exige sesión y vincula a la cuenta que reclama.»
- `V/02:530` — «con sesión: escribe la cuenta de la sesión y no la que tiene la dirección»
- **Un correo nunca verificado no se cambia llevándose vínculos**: la cuenta con un vínculo de
  Partner y el correo sin verificar puede verificarlo pero no cambiarlo. Es la lista cerrada del
  paso 2.
  `V/18:269` — «Un correo nunca verificado no se cambia llevándose vínculos.»
- `V/17:120` — «salvo que la cuenta tenga un vínculo de Partner»
- **La guarda de `PP1` es una restricción de la base.** Un índice único parcial sobre el correo en
  minúsculas donde el estado es `PENDIENTE`, y un trigger del carril de extras que rechaza la
  inserción dentro de una espera sin anular.
  `V/02:529` — «La guarda de `PP1` es una restricción de la base»
- `V/03:1344` — «que el admin no haya anulado»
- **El admin puede anular una espera.** **Entra como variante de la acción que aprueba y rechaza**
  la postulación: mismo instrumento y mismo permiso. Es la misma forma que *otorgar o
  revocar* o *pausar o reanudar*. **No suma fila: siguen siendo quince.**
  `V/18:217` — «Y el admin puede anular una espera»
- `nucleo/08:156` — «o anular la espera tras un rechazo»
- `nucleo/08:175` — «aprobar, rechazar o anular la espera»
- `V/03:1356` — «Anular la espera tampoco es una transición»

### R9 · decisión `R9` — `PURGED` y `listing` (`F-8V2A2-006`, `F-8V2A3-003`)

**La lista cerrada.** Está en `V/02` §4.1, debajo de la tabla de retención, con la columna de
tablas del código actual. La medí con un script sobre `packages/db/src/schemas`. Recorre toda
tabla con FK a `accommodations`, `gastronomies` o `experiences`, y toda tabla con `entity_type`.
Son 28 con FK y 10 polimórficas, y las 38 están en la lista. Quedan afuera `revalidation_config`,
que es por tipo y no por ficha, y `partner_logo_clicks`, que es de Partner. Hay nueve
filas: contenido, reseñas, comentarios, conversaciones, favoritos, alertas, calendario, lo del
dueño que sólo sirve a la ficha, y lo que nombra la ficha sin ser de ella.

- `V/02:658` — «Lo que cuelga de `listing`, y qué le pasa en `PURGED`: la lista cerrada»
- `V/02:673` — «se conservan en sólo lectura»
- `V/02:675` — «se cierran, con un aviso al turista»
- `V/02:680` — «La lista es cerrada»
- Remisión desde el renglón que prometía tratar todo uno por uno: `V/02:654` — «en la lista
  cerrada de abajo»
- `PB9` y `PB12` la nombran: `V/03:577` — «Y lo que cuelga de la ficha lo trata la lista cerrada»,
  `V/03:580` — «y el resto de lo que cuelga de la ficha según la lista cerrada»
- Los avisos nuevos: `V/19:74` — «cuando la ficha de una alerta suya llega a `PURGED`»,
  `V/19:75` — «esta ficha ya no existe», `nucleo/07:243` — «tu alerta de precio se cerró»

**La correspondencia de `listing`.** Son las filas que ya existen, una tabla por vertical con
ficha. `V/21` §2.4 ya lo suponía al decir *«un valor de columna sobre filas que ya existen»*. Para
Gastronomía y Experiencia elegí la segunda salida del consolidado: **el corte se detiene antes del
paso 3 si el recuento no da cero**. La primera obligaba a adivinar si una `INACTIVE` sin columna de
billing la bajó billing o su dueño, y eso es lo que separa `L4` de `L5`.

- `V/02:381` — «`listing` son las filas que ya existen, no una tabla nueva»
- `V/21:168` — «Y está escrita sólo para `accommodations`»

### R15 · decisión `R15` — la cartera del corte y el lock de la máquina de trial (`F-8V2A2-001`, `F-8V2A2-002`)

**La vuelta cuenta para `T8`.** Una ficha que vuelve por `PB3` o `PB7` bajo un título que paga
cuenta como ejercicio del evento para la guarda de `T8`, y sólo para ella. El consolidado decía
*«un título que convierte»* y la decisión dice *«un título que paga»*. Apliqué el de la decisión y
lo definí como una fuente de `tipo: SUSCRIPCIÓN`, haya cobrado o no. Cuando `PB3` sube la ficha
del corte, la suscripción todavía no cobró, así que *«que convierte»* no alcanzaba nunca a la
población que la decisión nombra. Para que `T8` lo pueda leer, el registro de `PB3` y `PB7`
guarda si una `SUSCRIPCIÓN` cubría la vuelta.

- `V/03:58` — «o le volvió una ficha por `PB3` o `PB7` bajo un título que paga»
- `V/03:244` — «La vuelta bajo un título que paga cuenta para `T8`»
- `V/03:260` — «No cambia qué es publicar para `T1`.»
- `V/03:694` — «salvo para la guarda de `T8`»
- `V/03:1080` — «Para la guarda de `T8`, en cambio»
- `$V/spec.md:248` — «salvo que le haya vuelto una ficha por `PB3` o `PB7` bajo esa»

**El lock.** Es el mismo lock por `user + vertical` que toma la publicación, y lo toman las ocho
transiciones. Coincide con el de publicación porque las guardas de `T6` y `T8` leen lo que escribe
la otra. Con un solo lock siempre escribe una de las dos, porque el aviso sale después del commit
de billing.

- `V/03:265` — «El lock de la máquina de trial es el mismo lock»
- `V/03:278` — «Siempre escribe una de las dos.»

**El ⚠️ de `2g` en `V/21`.** El NO cierra del capítulo decía que quien contrata sin publicar
conserva el trial sin usar: lo contrario de la decisión. Quedó tachado.

- `V/21:444` — «le consume el trial al primer cobro»

**El residuo, en el ítem 3 del NO cierra del reconciliador** (`V/03` §9). Si se pierde el aviso
del alta, la ficha la sube el reconciliador después del primer cobro, y `T8` ya despertó sin ver
ninguna vuelta. Es la misma causa que ese ítem ya declaraba.

- `V/03:1263` — «Lo mismo cuando lo que se pierde es el aviso»

### R22 · el lock de verticales y la guarda de `T4` (`F-8V2A2-003`, `F-8V2A2-004`)

- `T4` exige la fecha de fin sin pasar: `V/03:54` — «y con la fecha de fin sin pasar»
- Espejo en el capítulo del trial: `V/11:354` — «y la fecha de fin sin»
- **`PB8` y `PB9` toman el lock y releen su `desde` adentro**, porque comparten `desde` con `PB7`.
  `PB9` relee además el reloj y la cobertura. `PB11` no lo toma, porque es la única salida de
  `MODERATED`.
  `V/03:875` — «Las que no ocupan ni liberan cupo lo toman»
- `V/03:880` — «`PB11` no lo toma»
- `V/03:576` — «Toma el lock del `user + vertical` y relee adentro que la ficha siga en `ARCHIVED`»
- `V/03:577` — «Y lo relee todo dentro del lock del `user + vertical`»

### R13 · las dos de verticales (`F-8V2A2-007`, `F-8V2A3-006`)

- `T3` ya no dice que arranca el reloj:
  `V/03:53` — «y el reloj de retención tampoco es suyo»
- El paréntesis de `V/21` §2.4 que afirmaba que `PB2` corre sobre las fichas del corte quedó
  tachado:
  `V/21:259` — «Lo tachado afirmaba que `PB2` corre»

### R23 · la función del seudónimo (`F-8V2A3-004`)

- **La normalización** es la de `DEC-TRIAL-004` a la letra. **La función** es SHA-256 sin clave,
  que es lo que el pliego legal ya supone: que cualquiera con un correo candidato calcula el hash
  sólo es cierto sin clave. **Ninguna de las dos cambia nunca**, porque el correo no se guarda y no
  hay de dónde recalcular. Los dominios de los puntos quedan en un ⚠️ y en la pregunta 2.
  `V/02:330` — «Cómo se calcula el seudónimo»
- `V/02:336` — «La función es SHA-256 sin clave»
- `V/02:340` — «La función y la normalización no cambian nunca.»

### R24 · retirar todos los planes (`F-8V2A3-005`)

**No lo apliqué.** El consolidado da dos salidas: que `T1` exija una versión vigente y vendible, o
que retirar el último vendible escriba `admite_altas = no`. La segunda depende de la pregunta que
el grupo C dejó abierta, *¿quién escribe `admite_altas`?* La primera no depende de esa pregunta,
pero deja sin resolver qué le dice la pantalla a quien no puede publicar. La fila 21 le diría
*«suscribite»* en una vertical sin nada que vender. Elegir una de las dos es la pregunta 3.

### Unidades

Todo lo nuevo tiene unidad en la tabla de §2.10 de `$V/descomposicion.md`, en su fila del §2 y en
su criterio del §4:

| qué | unidad |
|---|---|
| precisiones 7 y 8, el permiso de inspección y la clase de la acción 15 | **V5** |
| el aviso de la acción 15 y las filas 26 a 28 del `19` | **V8** |
| el reclamo con sesión, el correo sin verificar, la guarda como restricción y la espera anulable | **V7** (y **V5**, la excepción del paso 2) |
| la lista cerrada de `PURGED` | **V9** (`PB9`) y **V6** (`PB12` y la referencia anulable) |
| `listing` sobre las tres tablas y el corte que se detiene | **V6** |
| la vuelta que cuenta para `T8`, el lock de la máquina de trial, `T4` y `T3` | **V4** (y **V6**, el registro de `PB3`/`PB7`) |
| `PB8` y `PB9` bajo el lock | **V6** y **V9** |
| el seudónimo | **V9** |

- `$V/descomposicion.md:398` — «la precisión 7 sólo para lo que no escribe»
- `$V/descomposicion.md:401` — «la lista cerrada de lo que cuelga de `listing` en `PURGED`»
- `$V/descomposicion.md:403` — «la vuelta por `PB3`/`PB7` bajo un título que paga»
- `$V/descomposicion.md:406` — «el seudónimo: SHA-256 sin clave»
- `$V/descomposicion.md:520` — «con el job de `T3` atrasado, un canje»

## 2. Conteos recontados

| lista | antes | ahora | comando | espejos |
|---|---|---|---|---|
| precisiones de `V/17` §1.2 | 7 | **8** | `python3`: ítems `^N. **` entre *«precisiones que el orden hace»* y `### 1.3` | `V/17:81`, `$V/spec.md:170`; `rg -n -i "siete precisiones"` sobre `$V`, `$B`, `nucleo`, el contrato y `D/16` no da otros |
| acciones administrativas de `NUCLEO/08` §3 | 15 | **15** | `python3`: filas de la tabla hasta *«La tabla tiene DOCE filas»* | sin cambio: anular la espera es una variante de la fila de la postulación |
| acciones que son capacidad del actor | 15 (todas) | **14** | la regla 3 nueva | `V/17` §3.2 regla 3, §3.4 (dos), `nucleo/08` fila 15 y el párrafo *«una escritura sin fila»*, `$V/spec.md:211`; `rg -n "capacidad(es)? del actor"` sobre `$V`, `$B`, `nucleo` y el contrato. `D/12:767` habla del anclaje, que sigue siendo del actor |
| transiciones que toman el lock por `user + vertical` | 4 (`PB1`, `PB2`, `PB3`, `PB7`) | **6** (+ `PB8`, `PB9`), más las ocho del trial | la lista del §9 y su viñeta nueva | `$V/descomposicion.md` fila V6 |
| filas de `V/19` §4 | 13 | **16** (26, 27 y 28) | `python3`: `^\| N` | sin conteo congelado |
| entradas de `NUCLEO/07` §6 | — | **+2** | — | sin conteo congelado |
| transiciones de publicación y de trial | 12 y 8 | **12 y 8** | — | — |

## 3. Propuestas para el log y la matriz

Grepeados antes: `DEC-TRIAL-004` (`$D/01-decision-log.md:429`), `DEC-DATA-005` (`:5507`) y
`DEC-AUTH-003` (`:6012`).

1. **`DEC-TRIAL-004`**, sólo si el owner contesta la pregunta 2 acotando los dominios. Si no la
   contesta, no hay que tocar nada. Texto propuesto:
   > 📌 **Precisado el 2026-09-27 (FASE 9 vuelta 2, `F-8V2A3-004`)**: el seudónimo del correo es
   > SHA-256 sin clave sobre el correo normalizado, y ni la función ni la normalización cambian
   > nunca. Los puntos de la parte local se sacan sólo en [los dominios que el owner elija]; el
   > `+alias`, en [ídem].
2. **`DEC-DATA-005`**. Razón: `R9` generaliza `G1-5` por dueño del dato, y el log sólo protege a
   las personas y a su contenido. Texto propuesto:
   > 📌 **2026-09-27 (FASE 9 vuelta 2, `R9`, con OK del owner)**: en `PURGED`, lo que cuelga de la
   > ficha se trata por dueño del dato, con una lista cerrada (`V/02` §4.1). Lo de un tercero se
   > conserva: la conversación queda en sólo lectura y su referencia admite una ficha ausente. La
   > alerta de precio se cierra con un aviso al turista. Lo del dueño que sólo sirve a la ficha se
   > borra con el contenido.
3. **`DEC-AUTH-003`** (la acción 15). Razón: cambia su clase. Texto propuesto:
   > 📌 **2026-09-27 (FASE 9 vuelta 2, `F-8V2A1-004`)**: la acción 15 no es capacidad del actor:
   > sus pasos 5 a 7 se evalúan sobre el dueño de la ficha. Su aviso es la fila 26 de `V/19` §4.
4. **Matriz**: ninguna fila.

## 4. Preguntas abiertas

1. **R7, qué hace el cambio de un correo nunca verificado cuando hay un vínculo.** Apliqué la
   lectura literal de *«no puede cambiarse llevándose vínculos»*.
   - **A, la aplicada: el cambio se rechaza.** **Daño**: una cuenta que escribió mal su correo y
     tiene un Partner queda sin poder verificarlo ni cambiarlo, y tiene que pasar por soporte.
   - **B: el cambio se permite y suelta el vínculo** (`owner_user_id` a nulo, y el Partner vuelve a
     *«aprobada sin reclamar»*). **Daño**: el Partner se desvincula sin aviso por un acto que no
     parece tocarlo, y hay que volver a mandar el reclamo.
2. **R23, en qué dominios se sacan los puntos y el `+alias`.** Escribí la letra de
   `DEC-TRIAL-004`, todos los dominios, con un ⚠️.
   - **A, la escrita: todos.** **Daño**: falso positivo. Dos casillas de un dominio propio que
     difieren en un punto comparten trial, y la segunda persona se va sin él. Es lo que
     `DEC-TRIAL-004` quiso evitar.
   - **B: sólo los que ignoran puntos o alias.** **Daño**: falso negativo. En un proveedor que los
     ignora y no está en la lista, el trial se consigue con un punto. Además, la lista hay que
     mantenerla, y cambiarla después no recalcula las filas viejas.
3. **R24, cómo se cierra la vertical sin vendibles.** No apliqué ninguna de las dos.
   - **A: `T1` exige una versión vigente y vendible.** Es de verticales y no depende de nadie.
     **Daño**: la pantalla. `PB1` no publica y la fila 21 dice *«suscribite»* en una vertical sin
     nada que vender. Además, `B/10` §4.1 sigue afirmando que la vertical *«queda cerrada a
     altas»*.
   - **B: retirar el último vendible escribe `admite_altas = no`.** Resuelve la pantalla con la
     fila de *«esta vertical ya no admite altas»*. **Daño**: pide contestar antes quién escribe
     `admite_altas`, la pregunta 2 del grupo C. Si es billing, es otra escritura en verticales
     fuera del contrato.
   - Recomiendo **A y B juntas**: A como guarda, que no puede quemar un trial, y B cuando se
     conteste la del grupo C.
4. **R9, la clase del correo de la alerta cerrada.** Lo puse **transaccional**, porque es un
   servicio que el turista pidió y no marketing. **Si fuera comercial**, el opt-out lo suprime, y el
   turista no se entera de que su alerta dejó de vigilar.

## 5. Casos vecinos

- **R27 (`F-8V2C2-006`) no es mío y no lo apliqué.** El paso que revalida o purga las páginas de las
  fichas que nacen despublicadas va en el orden del corte, que vive en `D/16`, vedado. El grupo B
  lo dejó como vecino. Texto propuesto para `D/16` §4.2, entre el paso 3 y el que da el corte por
  sano: *«Revalidar las páginas públicas de toda ficha que nació `UNPUBLISHED_BY_BILLING` o
  `PURGED`: la escritura de la migración no es una transición y no programa revalidación»*.
- **`D/16` y `B/21` §1.3, el recuento que detiene el corte** (R9). La regla está en `V/21` §2.4. El
  paso que la ejecuta y el punto donde el corte se detiene son del procedimiento, y es un espejo
  pendiente del orquestador.
- **`B/10` §4.1** sigue afirmando que retirar todos los vendibles cierra la vertical (R24). Es un
  archivo vedado.
- **`PB10` contra `PB3`.** Una moderación que se cruza con una restitución puede dejar publicada la
  ficha que el admin acaba de bajar. `A2-004` lo anota, y el consolidado no lo puso en R22. `PB10`
  sigue en la lista de las que liberan cupo sin lock.
- **`social_audit_log` guarda `old_value_json` y `new_value_json`** (código actual). Si alguna
  auditoría copia contenido de la ficha, el día 180 no lo borra, que es el riesgo que `V/02` §4
  describe. Lo dejé en *«no lo toca `PURGED`»* sin medir qué copia.
- **`owner_promotions.accommodation_id` es anulable.** Una promoción del dueño sin ficha no cuelga
  de ninguna, y la lista sólo borra las de esa ficha.
- **La lista cerrada no tiene guard.** Una tabla nueva que cuelgue de `listing` no pone nada en
  rojo. Un guard sería mecanismo nuevo, y no lo pidió nadie.
- **`V/19` fila 23** dice *«el registro que leen `T7` y `T8`»*. `T8` ahora lee también la vuelta
  por `PB3`/`PB7`, pero el predicado del botón no cambia, porque la decisión no toca `T1`.

## Key Learnings

1. Una decisión que dice *«título que paga»* y un consolidado que dice *«que convierte»* no son
   sinónimos en el instante que importa. En `PB3` la suscripción del corte todavía no cobró, así
   que sólo la palabra de la decisión alcanza a su población.
2. Anclar el sujeto al recurso en toda operación reabría la enumeración por 403 contra 404. El
   ancla vale sólo en las operaciones de `actor ≠ sujeto`. En las demás, el sujeto es el actor y lo
   ajeno cae en el paso 4.
3. Meter las inspecciones del §48 en el catálogo de `NUCLEO/08` §3 parecía lo obvio y le prohibía
   leer al actor de sistema. Un permiso nuevo no siempre es una fila de ese catálogo.
4. *«Uno por uno»* pedía medir el esquema entero, polimórficos incluidos. Un `rg` de FK
   encontraba 28 tablas y el script con `entity_type` encontró 38.
5. *«Capacidad del actor»* estaba contado como *«las quince»* en cinco lugares. Sacar una acción de
   la clase no cambia el catálogo, pero sí los cinco espejos.

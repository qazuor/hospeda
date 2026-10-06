---
title: "FASE 9 vuelta 3 · aplicación — lotes P a AA"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 9
---

# FASE 9 vuelta 3 · aplicación: lotes P a AA

Aplica al diseño las decisiones P a AA de
[`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md), que contestan las preguntas 1 a 12
de [`14-aplicacion-cierre.md`](./14-aplicacion-cierre.md) § «Para el owner». Donde un grupo ya
había escrito la opción como provisoria (S, T, V, U, W, X, Y), el texto pasa a decirla decidida y
salen el «pregunta abierta» y el ⚠️. Medido en el worktree `hospeda-spec-hos-1352-billing-redesign`,
sin commits. En paralelo, otro agente escribió el log (`DEC-AUTH-004`, `DEC-AUTH-005` y los siete
📌) y la matriz (`EX-57` a `EX-59`); acá sólo se citan. El origen de cada enmienda es
`(FASE 9 vuelta 3, owner 2026-09-30, lote X)`.

## 1. Qué se aplicó

### Lote P: «sólo `SUPER_ADMIN`» y la acción 26

- La fila nueva, la vigesimosexta, en `NUCLEO/08` §3.
  `nucleo/08:205` «asignar el rol `SUPER_ADMIN` a una cuenta ✚, sólo `SUPER_ADMIN`»
- El recuento de la tabla: veinticinco filas vivas.
  `nucleo/08:209` «La tabla tiene VEINTICINCO filas vivas»
- El ⚠️ de `NUCLEO/08` §3 sale y queda la regla decidida.
  `nucleo/08:236` «ese permiso viene sólo con el rol `SUPER_ADMIN` y no se da suelto»
- `V/17` §3.2 regla 1: el ⚠️ sale y queda la regla.
  `V/17:391` ««De `SUPER_ADMIN`» es un permiso que viene sólo con el rol»
- `V/17` §3.2 regla 3: veintitrés capacidades del actor.
  `V/17:415` «veintitrés acciones del capítulo 08 §3, las catorce primeras, de la decimoséptima a la vigesimosegunda y de la vigesimocuarta a la vigesimosexta,»
- `V/17` §3.2 regla 5, el sujeto de la 26.
  `V/17:479` «En la vigesimosexta el sujeto es la cuenta que recibe el rol»
- `V/17` §3.3, por qué la hace una persona.
  `V/17:519` «La vigesimosexta, asignar el rol `SUPER_ADMIN`, no toca plata, pero da el permiso de las que sí la tocan»
- `V/17` §3.5, la 26 en la enumeración.
  `V/17:589` «la 26, asignar el rol `SUPER_ADMIN` a una cuenta: FASE 9 vuelta 3, owner 2026-09-30, lote P»
- `$V/spec.md`, el resumen de la regla 3.
  `$V/spec.md:216` «y la vigesimosexta, asignar el rol `SUPER_ADMIN` a una cuenta, cuyo permiso»
- La unidad y el criterio: `V5`, en `$V/descomposicion.md` §2.12.
  `$V/descomposicion.md:503` «o el de cualquiera de las siete filas «sólo `SUPER_ADMIN`», se rechaza»
- `B/19` §6 y cuatro espejos de `B/03` pasan a veinticinco; uno de ellos:
  `B/19:206` «con la vigesimosexta, asignar el rol `SUPER_ADMIN`: FASE 9 vuelta 3, owner 2026-09-30, lote P»

### Lote Q: el borrado que se adelanta a un aviso atrasado

- `retenciónDetenida` devuelve un campo más, `coberturaPerdidaEn`; siguen siendo ocho entradas.
  `D/12:1074` «coberturaPerdidaEn: instante | NINGUNO }»
- El § que lo explica, con su único lector y la regla mientras no exista.
  `D/12:1119` «`coberturaPerdidaEn` es el dato que impide que el borrado se adelante a un aviso atrasado»
- La respuesta de arranque.
  `D/12:1358` «`pausaTerminadaEn: NINGUNO` y `coberturaPerdidaEn: NINGUNO`»
- La fila de `PB9` en `V/03` §9: cuenta desde el más tardío de tres instantes.
  `V/03:491` «o sobre la última pérdida de cobertura, `coberturaPerdidaEn`, el más tardío de los tres»
- La regla de la pasada, en la misma fila.
  `V/03:491` «Y con `coberturaPerdidaEn` en `NINGUNO` no borra en la misma pasada en que ve por primera vez la ficha vencida y sin cobertura»
- El ⚠️ del reconciliador de `V/03` §9, punto 5, pasa a cerrado.
  `V/03:1285` «Cerrado por el owner (FASE 9 vuelta 3, owner»
- Los espejos del tercer instante: glosario §1.2, `V/02` §2.5, `V/03` y el contrato; uno:
  `nucleo/01:212` «y `PB9`, además, desde `coberturaPerdidaEn`, el más tardío de los tres»
- Las unidades: `V9` y `V4` en `$V/descomposicion.md` §2.12, y `B4` en `$B/descomposicion.md` §2.11.
  `$B/descomposicion.md:693` «`coberturaPerdidaEn` en `retenciónDetenida`»

### Lote R: los plazos 16, 17 y 18

- `NUCLEO/02` §1.5, el 16.
  `nucleo/02:169` «~~sin valor escrito (a proponer al owner: §1.5, abajo)~~ 7 días»
- El recuento de los sin valor.
  `nucleo/02:175` «Los ~~cinco~~ ~~ocho~~ cinco sin valor escrito»
- El párrafo de los valores, que deja de ser propuesta.
  `nucleo/02:181` «nuevos, fijados por el owner»
- El espejo de `16-` paso 3.
  `D/16:137` «con su valor fijado: 7, 7 y 180 días»
- `B/09` §3, el 17 y el 18; y el NO cierra del plazo 16.
  `B/09:907` «con su valor inicial ~~a proponer al owner~~ de 7 días»

### Lotes S y T: ya aplicados, ahora decididos

- `16-` paso 3, el despliegue de las tres columnas.
  `D/16:137` «el mismo despliegue, decidido: FASE 9 vuelta 3, owner 2026-09-30, lote S»
- `V/21` §2.4.
  `V/21:230` «y es el que decidió el owner (FASE 9 vuelta 3, owner 2026-09-30, lote S)»
- `B/21` §4.
  `B/21:455` «y es el que decidió el owner (FASE 9 vuelta 3, owner 2026-09-30, lote S)»
- `16-` paso 3, los recuentos repetidos (T).
  `D/16:137` «que no cierra el alta del viejo en el borde»

### Lote U: la suscripción cancelada por rechazo que el proveedor revive

- `B/09` §3: la pregunta sale y queda la regla.
  `B/09:244` «el barrido manda la cancelación que `S16` habría mandado»
- Los cobros van al motivo 2, que ya propone devolver: sin motivo nuevo.
  `B/09:252` «`COBRO_POSTERIOR_A_LA_BAJA` (motivo 2), que ya propone devolver»
- La unidad: `B11`.
  `$B/descomposicion.md:687` «el barrido manda la cancelación que `S16` habría mandado»

### Lote V: la lista de sondas

- `16-` §4.2.
  `D/16:159` «Dónde vive lo decidió el owner: en el código del package del»
- `B/09` §2.4.
  `B/09:119` «la lista vive en el código»
- `B/06` §9.
  `B/06:390` «su lista vive en el código del package del cobro, importada como módulo»
- La unidad: `B11`.
  `$B/descomposicion.md:688` «la lista de sondas que el receptor no cancela, en el código del package del cobro»

### Lote W: la transferencia que no cae en una cuota abierta

- `B/03` §7, la transición nueva `MP6`; es la acción que ya existe, registrar un pago manual.
  `B/03:1871` «el admin registra una transferencia que no cae en ninguna cuota abierta»
- El NO cierra de `B/03`: sale la pregunta y queda el borde del monto.
  `B/03:3041` «que llega sobre una fila `CANCELLED`, se asientan por `MP6`»
- `B/02` §2.5, el motivo 20 gana un productor.
  `B/02:1036` «o desde `MP6`»
- `NUCLEO/08` §3, la fila de pago manual la nombra.
  `nucleo/08:182` «también la transferencia que no cae en ninguna cuota abierta»
- La unidad: `B5`.
  `$B/descomposicion.md:689` «`MP6`, la transferencia que no cae en ninguna cuota abierta»

### Lote X: el alta sin `expire_date` en la segunda corrida

- `16-` §4.6, punto 2.
  `D/16:348` «y entra a la segunda corrida con su fecha de creación más»
- `B/21` §1.3.
  `B/21:120` «y entra a la segunda corrida con su `date_created` más un ciclo»
- La unidad: `B11`.
  `$B/descomposicion.md:690` «un alta sin `expire_date` entra a la segunda corrida del detector del corte»

### Lote Y: dos addons recurrentes iguales

- `B/02` §2.4, el `UNIQUE` parcial incluye la instancia recurrente viva.
  `B/02:569` «en el recurrente frena también si ya hay una instancia viva igual sobre el mismo objetivo»
- `B/16` §1.4, y su NO cierra pasa a cerrado.
  `B/16:120` «y en el recurrente frena también si ya hay una instancia viva»
- `B/05` §1.
  `B/05:89` «Y en el recurrente frena también si ya hay una instancia»
- `B/03` §8, `A1`.
  `B/03:2529` «salvo en el recurrente mientras la instancia siga `ACTIVE`»
- La unidad: `B10`.
  `$B/descomposicion.md:691` «la identidad de la compra frena también un addon recurrente igual»

### Lote Z: la columna de la relectura que vio `cancelled`

- `B/02` §2.2, en `provider_link`.
  `B/02:60` «y `cancelado_visto_en` (anulable)»
- `B/09` §3: el ⚠️ sale y queda la columna con sus tres lectores.
  `B/09:264` «Que una relectura vio `cancelled` lo guarda `provider_link.cancelado_visto_en`»
- El contrato §4.1, en `puedeCobrarle`.
  `D/12:1121` «El dato es `provider_link.cancelado_visto_en`»
- La fila 27 del glosario.
  `nucleo/01:569` «Qué relectura confirmó la cancelación lo guarda `provider_link.cancelado_visto_en`»
- El reloj del plazo 16 en `NUCLEO/02` §1.5.
  `nucleo/02:169` «`provider_link.cancelado_visto_en` (`B/02` §2.2»
- Las unidades: `B4` y `B11`.
  `$B/descomposicion.md:692` «`provider_link.cancelado_visto_en`, el instante de la primera relectura»

### Lote AA: el secreto del link de reclamo

- `V/18` §2.4, regla 4.
  `V/18:292` «Y el link lleva un secreto de un solo uso que viaja sólo en el aviso»
- `V/02` §2.7, la columna que guarda su hash.
  `V/02:593` «Y `secreto_de_reclamo` (anulable)»
- La unidad: `V7`.
  `$V/descomposicion.md:499` «el secreto de un solo uso del link de reclamo»

### Los IDs del log y de la matriz

- `DEC-AUTH-004` en `V/18` §2.4.
  `V/18:263` «lotes A y B; `DEC-AUTH-004`»
- `DEC-AUTH-005` en `V/17` §1.2, precisión 9.
  `V/17:237` «`F-8V3A1-005`; `DEC-AUTH-005`»
- Los 📌: `DEC-ARCH-006` en el contrato, `DEC-DATA-005` en `V/02`, `DEC-ARCH-013` en `NUCLEO/02`,
  `DEC-RF-001` en `B/22`, `DEC-CONC-001` en `B/16`, `DEC-MIG-005` en `16-`; `DEC-DATA-008` ya estaba
  en `NUCLEO/02` §1.5. Uno:
  `B/22:129` «`DEC-RF-001`, 📌; la devolución de la orden, `EX-58`»
- `EX-57` donde decía propuesto a la matriz: `B/09`, `B/16`, `B/03`, `B/06` y `$B/descomposicion.md`.
  `B/09:1247` «La medición es `EX-57`, `UNKNOWN`»
- `EX-58` en `B/03` §6.1, `B/06` §3.2 y `B/22`.
  `B/06:131` «`EX-58`,»
- `EX-59` en `B/21` §1.3 y `16-` §4.2.
  `D/16:254` «(`EX-59`: el»
- Las filas de `$B/spec.md` y de `$B/descomposicion.md` §2.7, y la matriz a 117.
  `$B/spec.md:257` «`EX-57` a `EX-59` entraron el 2026-09-30»
- El índice del núcleo: 139 decisiones.
  `nucleo/00:44` «139 al 2026-09-30»

## 2. Lo que no se aplicó y por qué

- **Quitar el rol `SUPER_ADMIN`** (lote P): la decisión nombra sólo asignarlo. La fila 26 dice
  *«asignar»* y lo otro queda como pregunta abierta (§6).
- **AB** (el log y la matriz): los escribió el otro agente; acá sólo se citan los IDs.
- **T** no tenía ⚠️ ni pregunta en el diseño: el texto ya decía la opción aplicada, y sólo se le
  agregó el origen decidido.
- **Lote Q, `PB4`, `PB5` y los avisos de retención**: no leen `coberturaPerdidaEn`. La decisión
  habla del borrado, que es lo único irreversible.
- **Lote W, la transferencia de más dentro de una cuota abierta**: no se ve, porque la fila no
  guarda monto. Queda declarada en el «NO cierra» de `B/03` por `DEC-METH-015`, con la que llega a
  una suscripción que nunca tuvo un cobro ni una cuota (sin período con qué chocar).
- No toqué el handoff, el worklog, el PDR, el log, la matriz ni registros ajenos.

## 3. Conteos recontados

Con `python3` sobre las tablas, sin tachados (`scratchpad/p/recount.py`), y cada cifra buscada por
número y por palabra en `$V`, `$B`, `$D/nucleo`, el contrato y `16-`.

| lista | antes → después | espejos actualizados |
|---|---|---|
| acciones administrativas vivas | 24 → **25** (numeradas hasta la 26, la 16 tachada) | `NUCLEO/08` §3 (dos); `V/17` §3.2 reglas 1 (dos), 3 y 5, §3.3, §3.4 (tres), §3.5; `$V/spec.md`; `B/19` §6; `B/03` (seis) |
| acciones que son capacidad del actor | 22 → **23** | `V/17` §3.2 regla 3 y §3.4 (dos) |
| filas *«sólo `SUPER_ADMIN`»* | 6 → **7** | `NUCLEO/08` §3, `V/17` §3.2 regla 1 |
| plazos | 18, sin cambio | ninguno |
| plazos sin valor escrito | 8 → **5** (3, 4, 7, 8 y 9) | `NUCLEO/02` §1.5, `16-` paso 3 |
| motivos de la marca | 24, sin cambio (U usa el 2; W suma un productor al 20) | ninguno |
| transiciones vivas de la suscripción | 34, sin cambio | ninguno |
| transiciones del pago manual | `MP1`–`MP5` → `MP1`–`MP6`, sin cifra congelada | `B/03` §7 (*«no hay un `MP6`»* enmendado) |
| entradas del contrato §4.1 | 8, sin cambio (Q es un campo de `retenciónDetenida`) | el contrato lo dice |
| campos de la fuente | 8, sin cambio | ninguno |
| respuestas de arranque de `G13` | 6, sin cambio | ninguno |
| dependencias entre épicas | 12, sin cambio | ninguno |
| guards | 33 (19 de `V/20` + 17 de `B/20` − 3 cruzadas), sin cambio | ninguno |
| unidades | 23 (9 + 13 + `U1`), sin cambio | ninguno |
| filas de la lista de `PURGED` | 40, sin cambio | ninguno |
| invariantes | sin cambio | ninguno |
| filas de la matriz (espejo) | 114 → **117** = 61 · 16 · 24 · 16 | `$B/spec.md`, `$B/descomposicion.md` §2.7 |
| filas `UNKNOWN` con unidad | 13 → **15** (`EX-57`, `EX-59`) | `$B/descomposicion.md` §2.7 |
| decisiones del log (espejo) | 135 → **139** | `NUCLEO/00` |

## 4. Para otro grupo

Ninguno dentro del diseño. **Para el orquestador**, en `$D/03-handoff.md` (no lo toqué): si lleva
las cifras vigentes, acciones administrativas 25, plazos sin valor escrito 5, matriz 117 y log 139.

## 5. Propuestas para el log y la matriz

1. **`DEC-ARCH-006`, el 📌 del 2026-09-30** (línea 2543): dice *«el contrato devuelve cuándo perdió
   cobertura por última vez una ficha»*. La cobertura es de `user + vertical`, no de una ficha, y el
   dato quedó como un campo de una pregunta que ya existía. Texto propuesto para esa frase: *«Y el
   contrato devuelve cuándo perdió la cobertura por última vez la persona en esa vertical
   (`coberturaPerdidaEn`, un campo de `retenciónDetenida`): el borrado de una ficha inactiva
   (`PB9`) cuenta su plazo también desde ahí. Que una relectura confirmó la cancelación lo guarda
   `provider_link.cancelado_visto_en`.»* Razón: que el 📌 diga lo mismo que el contrato §4.1 y
   nombre el dato del lote Z.
2. Ninguna fila nueva de matriz.

## 6. Preguntas abiertas

1. **Quitar el rol `SUPER_ADMIN` a una cuenta** (lote P).
   - Lectura A: es la misma fila 26, *«asignar o quitar el rol»*, como *«otorgar o revocar»* una
     cortesía. Daño: ninguno; la fila suma un verbo.
   - Lectura B: queda fuera de la tabla. Daño: por la regla de `NUCLEO/08` §3 (*«lo que no se puede
     es ejecutar una escritura que no esté nombrada en ninguna fila»*), el panel no puede quitarlo, y
     sacárselo a una cuenta comprometida o a alguien que se fue pide una escritura a mano en la base,
     sin registro.
   - Recomendación: **A**.

## 7. Casos vecinos

1. **`coberturaPerdidaEn` cuando la pérdida la causa el trial.** El contrato dice que la real lo
   guarda al encolar el aviso de la caída; si la caída es `T3`, el aviso lo emite verticales
   (contrato §5.1), y no está escrito cómo lo sabe `B4`. No adelanta un borrado: sin el dato,
   `PB9` cae en la regla de la pasada.
2. **`B/05` §C5** sigue diciendo *«`P1`-`P5` y `MP1`-`MP5`»*: ya existían `P6` y ahora `MP6`.
3. **`V/17` §3.3**, *«Doce mueven dinero o conceden servicio»*: no se recontó con la tabla actual.
   La 26 no mueve dinero y quedó nombrada aparte.
4. **`B/02` §2.2**: la restricción de `provider_link` dice *«el vínculo no tiene estado»*, y
   `cancelado_visto_en` se le parece; no es un estado de máquina, pero la frase va a leer raro.
5. **`16-` §4.2, líneas 246 y 313** (caso vecino 4 de `14-`): siguen igual.

## 8. Key Learnings

1. Un dato que la decisión pone en «el contrato» puede entrar como campo de una pregunta que ya
   existe: no mueve la cifra de entradas, ni la de campos de la fuente, ni la tabla de
   dependencias, que colgaban todas de agregar una entrada.
2. Una columna que registra *«la primera vez que se vio X»* necesita decir cuándo se vacía si X se
   deshace: sin eso, el lector más peligroso (`puedeCobrarle`) seguía contestando «confirmado»
   sobre un preapproval revivido.
3. Una acción nueva de la tabla de `NUCLEO/08` arrastra dos cifras distintas en `V/17`: las
   acciones vivas y las que son capacidad del actor, más la de las filas *«sólo `SUPER_ADMIN`»*.
4. Antes de crear una acción administrativa nueva, mirar si el acto es una fila existente
   ejecutada desde otro origen (`MP4` ya lo era): la transferencia sin cuota lo es, y no suma fila.

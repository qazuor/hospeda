---
title: "FASE 9 vuelta 3 · aplicación — cierre"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 9
---

# FASE 9 vuelta 3 · aplicación: grupo de cierre

Grupo de cierre, solo, después de los tres grupos en paralelo. Leí enteros los registros
[`11-`](./11-aplicacion-verticales.md), [`12-`](./12-aplicacion-billing.md) y
[`13-`](./13-aplicacion-nucleo-contrato-y-corte.md), apliqué lo que cada uno dejó «para otro
grupo», dejé diciendo lo mismo las dos puntas de lo que tocaron dos o tres grupos, reconté las
listas con conteo congelado y unifiqué las propuestas de log y matriz. Medido en el worktree
`hospeda-spec-hos-1352-billing-redesign`, sin commits. Archivos tocados:
`$D/12-contrato-de-cobertura.md`, `$D/16-fase-7-del-paraguas.md`, `$D/nucleo/07-…`,
`$D/nucleo/08-…`, `$V/descomposicion.md`, `$V/docs/02-…`, `$V/docs/21-…`,
`$B/descomposicion.md` y, en `$B/docs/`, los capítulos 06, 09, 14 y 21.

## 1. Qué se aplicó

### Lo que V dejó para otro grupo

- Contrato §4.1, `extenderTrial`: la clave vive en una tabla, no en una columna de `trial`.
  `D/12:1170` «`canje_de_trial`, de `V/02` §2.2 (FASE 9 vuelta 3, F-8V3C1-003), y la construye `V4`»
- `NUCLEO/08` §3, acción 24: el trigger de favoritos sobre `users` queda nombrado.
  `nucleo/08:203` «Es una escritura sobre datos de terceros que ya pasa hoy con cada baja»
- `NUCLEO/07` §6, fila de la moderación levantada: el cierre por `PURGED` no manda correo.
  `nucleo/07:259` «Salvo el cierre que hace la llegada de la ficha a `PURGED`, que no manda correo»
- `B/14` §3.2: dónde guarda verticales la clave de canje (el mismo pedido lo hizo N).
  `B/14:366` «la guarda en `canje_de_trial`, `V/02` §2.2»
- R23: la corrida diaria que reintenta los borrados remotos entra a lo que vigila el monitor externo.
  `B/09:1084` «Y vigila la corrida diaria que reintenta los borrados remotos de `PB9` y `PB12`»
- Espejo del trigger en `V/02` §2.2, para que la baja diga lo mismo en las dos puntas.
  `V/02:419` «y esa escritura dispara el trigger de favoritos sobre `users` del carril de extras»

### Lo que B dejó para otro grupo

- `16-` §4.2, la segunda corrida del detector: el registro de un alta sin `expire_date`.
  `D/16:344` «Un registro abierto que es el de un alta no trae `expire_date`»
- El manifiesto del 1b y la pasada de sólo lectura (líneas 246 y 313 de antes): N ya los había
  escrito con la medición del lote G; no hizo falta tocarlos (ver §2).

### Lo que N dejó para otro grupo

- `B/descomposicion.md` §2.6: doce dependencias, con la fila 14 nueva, `V4` sobre `B1`.
  `$B/descomposicion.md:369` «la hora del trial, en la otra dirección»
- El encabezado del §2.6.
  `$B/descomposicion.md:311` «~~ONCE~~ DOCE, sobre»
- El párrafo del grafo.
  `$B/descomposicion.md:342` «las ~~once~~ doce dependencias siguen»
- El recuento de la tabla.
  `$B/descomposicion.md:394` «once más una, doce, recontadas sobre la tabla»
- El §2.11, que decía que no había ninguna nueva.
  `$B/descomposicion.md:667` «duodécima, `V4` sobre `B1`, viene del contrato»
- El §3, que decía que las once seguían siendo once.
  `$B/descomposicion.md:690` «que son doce desde la FASE 9 vuelta 3 por otra razón: la fila 14»
- `V1` escribe todas las interfaces y los simuladores (`F-8V3C1-005`).
  `$B/descomposicion.md:334` «`V1` escribe las interfaces, las validaciones y los simuladores de todas las»
- `B4`, fila del §2: `puedeCobrarle` alcanza también las terminales sin confirmar.
  `$B/descomposicion.md:130` «o una terminal a la que llevó una transición nuestra cuya cancelación»
- `B4`, criterio del §4: la respuesta entera y las dos mitades en los inventarios.
  `$B/descomposicion.md:829` «sus dos mitades están en los inventarios que cuentan `G-R1-E` y `G-R1-F`»
- `B/09` §3: el dato que guarda que una relectura vio `cancelled` no existe; queda con ⚠️ y va al
  owner (sección final, pregunta 11).
  `B/09:241` «Qué dato guarda que una relectura vio `cancelled` no está escrito»

### Coherencia cruzada

- **El manifiesto de sondas** (R9): N lo había decidido (el código del package del cobro) y B lo
  dejaba abierto. No elegí: `16-` pasa a decir que es la lectura que se recomienda.
  `D/16:156` «Y dónde vive es pregunta abierta del owner»
- `B/09` §2.4 nombra la lectura que recomienda `16-`.
  `B/09:117` «`16-fase-7…` §4.2 recomienda el código del package del cobro»
- `B/06` §9, lo mismo.
  `B/06:390` «con la lectura que recomienda `16-fase-7…` §4.2»
- **Las tres columnas y los guards** (lote N): `16-` decía que `G8` y `G16` las admiten, y V y B
  midieron que ninguno mira columnas. Quedó dicho en `16-`.
  `D/16:596` «ninguno: ninguno mira columnas»
- **Cuándo se borran las tres columnas**: `16-` aplicó el mismo despliegue del paso 3; `V/21` y
  `B/21` copiaban la letra de la decisión, posterior al paso 3. Las tres puntas nombran la
  aplicada y la pregunta.
  `D/16:137` «en el mismo despliegue (FASE 9 vuelta 3, owner 2026-09-30, lote N; si es ése o uno»
- `B/21` §4.
  `B/21:450` «la aplica en el mismo despliegue del paso 3, fechada después de la»
- `V/21` §2.4.
  `V/21:228` «la aplica en el mismo despliegue del paso 3, fechada»
- **`G13`**: el contrato, `V/20` y `$V/spec.md` ya decían seis; el criterio de `V4` del §4
  nombraba sólo las fuentes.
  `$V/descomposicion.md:597` «con un caso por cada una de las seis respuestas de arranque»
- **`puedeCobrarle`**: contrato §4.1, fila 27 del glosario, fila 12 de «marca abierta», acción 24,
  `B/03` §3.1 y `B4` dicen lo mismo (la cancelación confirmada, las terminales sin confirmar y la
  marca). El único hueco era el dato que lo sostiene: la pregunta 11 del owner.
- **Plazos 16, 17 y 18**: `NUCLEO/02` §1.5, `B/09` §3, `B/03` §3.2, `B/06` §11, `$B/spec.md` y
  `B/descomposicion.md` §2.11 usan los mismos nombres y los mismos relojes (la suscripción al
  primer `cancelled`, la marca en su `puesta_en`, el pago o la instancia). V no los cita. Sin cambio.
- **`canje_de_trial`**: V, el contrato y `B/14` dicen lo mismo (arriba).
- **El catálogo en el paso 3**: `16-`, `NUCLEO/02` §1.4, `V/21` §2.4, `V/descomposicion.md` y
  `B/21` §1.3 dicen lo mismo; la fila `G-R3` de `V/20` sigue cierta (el 3a verifica después).
- **El manifiesto del 1b**: `16-` §4.2 y `B/21` §1.3 dicen lo mismo (el pagador de la lectura que
  lo traiga, si alguna lo trae). Sin cambio.
- **`V4` sobre `B1`**: el contrato §7.1, `16-` §4.6, `$V/descomposicion.md` y ahora
  `$B/descomposicion.md` dicen doce.
- **La baja de cuenta**: acción 24, `V/17` paso 1, `V/22` §3.3 y `V/02` §2.2 dicen lo mismo, con el
  trigger nombrado en las dos puntas.

## 2. Lo que no se aplicó y por qué

- **`03-handoff.md`** (pedido de V): no es mío; va a «Para el orquestador» (§4).
- **B → N, líneas 246 y 313 de `16-`**: N ya había escrito el manifiesto del 1b y la pasada con la
  medición del lote G (*de la lectura que lo traiga, si alguna lo trae*); el texto de B no agrega.
- **B → N, `puedeCobrarle` en el contrato y el glosario**: ya nombran la `CANCEL_SCHEDULED` en su
  ventana; sin cambio.
- **N → B, `B/16` y la fila de `B13`** (el acto que re-apunta `addon_product.version_id`): ya lo
  dicen `B/02` §2.4 y la fila de §2.10 de `B/descomposicion.md` (`B10` la operación, `B13` el
  editor). `B/16` no lo necesita.
- **N → V, puntos 1 a 9**: V ya los había aplicado (medido uno por uno). El punto 6 (la fila de
  guards de `V/20`) V lo dejó sin cambio con razón, y lo alineé del lado de `16-` (§1).
- **N → B, punto 1** (nombrar el dato de la relectura en `B/09` §3): nombrarlo es elegir dónde
  vive, que es mecanismo. Quedó el ⚠️ y la pregunta 11.
- **Casos vecinos de los tres registros**: no los perseguí; los que piden al owner están en la
  sección final.

## 3. Conteos recontados

Todos con `python3` sobre el texto sin tachados, buscando cada cifra por número y por palabra en
`$V`, `$B`, `$D/nucleo`, el contrato y `16-`.

| lista | vigente | cómo | espejos |
|---|---|---|---|
| guards | 33 (17 · 15 · 1), sin cambio | ninguno nuevo en esta tanda | `$V/descomposicion.md` y `$B/descomposicion.md` dicen 33 |
| acciones administrativas vivas | 24 (numeradas hasta la 25, la 16 tachada) | tabla de `NUCLEO/08` §3 | `V/17` §3.3 y §3.5 dicen veinticuatro; capacidad del actor 22 en §3.4 |
| transiciones vivas de la suscripción | 34, sin cambio | `$B/descomposicion.md` §2 | ningún espejo distinto |
| motivos de la marca | 24, sin cambio | tabla de `B/02` §2.5 | `B/02`, `B/05`, `B/09` y `B/12` dicen veinticuatro o veintitrés otros |
| plazos | 15 → 18 (N) | tabla de `NUCLEO/02` §1.5 | `16-` paso 3 dice dieciocho; ocho sin valor; los cinco de verticales en `$V/descomposicion.md` §2.11 siguen siendo cinco (3, 4, 7, 8, 9) |
| entradas del contrato | 8, sin cambio | §4.1 | ninguno |
| dependencias entre épicas | 11 → **12** | tabla de `B/descomposicion.md` §2.6: filas 1 a 7, 9 a 12 y 14 | **corregidos**: el encabezado, el grafo, el recuento, el §2.11 y el §3 de `$B/descomposicion.md` (B escribía once); `16-`, el contrato y `$V/descomposicion.md` ya decían doce |
| unidades | 23, sin cambio | `16-` §4.6 | ninguno |
| filas de la lista de `PURGED` | 40 (38 + 2), 40 distintas | cuarta columna de `V/02` §4.1 | `V/20` `G-R9` dice 40 |
| respuestas de arranque de `G13` | 6 | contrato §6.3 | **corregido**: el criterio de `V4` en `$V/descomposicion.md` §4 |
| inventario de marca abierta | 12 filas (N) | glosario §2.5 | sin espejo con cifra |
| reglas del reclamo, precisiones del paso 4, filas de `V/19` §4 | 5, 9, numeradas hasta la 33 | listas numeradas | sin espejos con cifra fuera de V |
| filas de la matriz | 114 = 61 · 15 · 24 · 14 hoy | estados de la tabla | con las tres filas propuestas: 117 = 61 · 16 · 24 · 16 |

## 4. Para otro grupo

Ninguno. **Para el orquestador**, en `$D/03-handoff.md` (no lo toqué):

- Línea 80, las cifras vigentes: *dependencias entre épicas **11*** pasa a ***12*** (la de `V4`
  sobre `B1`). Y en la misma línea, si se actualizan: matriz 117 si entran las tres filas.
- Línea 257, pedido de V: *publicación 6 estados / 12 transiciones, **8 precisiones*** pasa a *13
  transiciones* y *9 precisiones*. Ojo: esa línea es la foto de una fecha pasada (el registro de
  un día viejo, con 16 acciones y `vertical_discontinuation`); si el handoff conserva sus fotos
  fechadas, no se edita y la cifra nueva va en la sección vigente.

## 5. Propuestas para el log y la matriz

Unificadas en la sección final («Para el owner»), con los números finales. En corto: nueve para el
log (siete 📌 y dos decisiones nuevas) y tres filas nuevas para la matriz, `EX-57`, `EX-58` y
`EX-59`; el 📌 de `RF-7` que propuso B ya está en la matriz.

## 6. Preguntas abiertas

Unificadas en la sección final. Las mías: la 11 (el dato de la relectura) y la 12 (el secreto del
link de reclamo).

## 7. Casos vecinos

1. **El link de reclamo de Partner no dice que lleva un secreto** (caso vecino 1 de V). Si el link
   se pudiera armar con el id del Partner, cualquiera reclama: no es un residuo de borde, da acceso
   indebido. Lo subo al owner como la pregunta 12.
2. **`B/19` §6, fila del motivo 14** (caso vecino de B): sigue nombrando `S26`, que salió con C8.
   No estaba en ninguna lista.
3. **`NUCLEO/08` §1.3**: con la espera de hasta 3 días del lote D, la lista de pasos de soporte no
   dice qué hace soporte mientras espera (caso vecino de N).
4. **`16-` §4.2, las líneas 246 y 313** siguen diciendo que la pasada y el manifiesto traen el
   `payer_email`, y dos renglones después que viene vacío. Es coherente, pero lee raro.

## 8. Key Learnings

1. Un grupo que aplica «la lectura A» de su propia pregunta abierta la deja escrita como decisión
   en su archivo, y el grupo vecino que copió la letra de la decisión dice otra cosa: la pregunta
   tiene que quedar nombrada en las tres puntas, no sólo en el registro.
2. «Los guards la admiten» puede ser una frase vacía: si ningún guard mira el objeto, admitir no
   pide nada y hay que decirlo así, o alguien va a buscar la excepción en el guard.
3. Un dato que tres reglas leen (la exención, el reloj del plazo 16 y `puedeCobrarle`) puede no
   estar en el modelo: cada regla remitía a otra para escribirlo.
4. Antes de proponer un 📌 a la matriz, grepear la fila: el de `RF-7` ya estaba.

## Para el owner

### Preguntas abiertas

Doce, sin duplicados (R21 estaba en V y en N; el manifiesto de sondas, en B y en N), y una nota.
La 11 y la 12 salen de este cierre.

1. **Quién puede tener el permiso de las acciones *«sólo `SUPER_ADMIN`»*** (R21). Hoy el diseño
   dice que fijar precios, cambiar plazos y otras son *«de `SUPER_ADMIN`»*, pero el sistema de
   permisos también deja dar un permiso suelto a una cuenta.
   - A: es un permiso reservado al rol; no se puede dar suelto. Daño: ninguno sobre plata; para
     delegarlo hay que dar el rol entero.
   - B: se puede dar suelto, y darlo es una acción administrativa nueva con su registro. Daño:
     ninguno si la acción existe; suma una fila y su unidad.
   - C: se puede dar suelto, fuera del registro, como hoy. Daño: un permiso de fijar precios dado
     sin rastro de quién lo dio.
   - Recomendación: **A** (V y N coinciden). N agrega que asignar el rol mismo quede registrado
     como una fila nueva de acciones; es barato y cierra el último rastro.
2. **El borrado que se adelanta a un aviso atrasado** (R24). Si el aviso de que una ficha no
   publicada volvió a estar cubierta llega tarde, el borrado de una ficha inactiva puede correr
   antes y borrar algo que ya no debía borrarse. **Borra datos: no puede quedar como residuo.**
   - A: que el recálculo tome el mismo candado. Daño: no lo cierra, porque el borrado corre antes
     de que el recálculo arranque.
   - B: que el borrado exija que su reloj sea posterior a la última vez que la ficha perdió
     cobertura. Daño: ninguno para el cliente; pide un dato nuevo en el contrato (cuándo dejó de
     estar cubierta).
   - Recomendación: **B**, con el campo en el contrato. Mientras no exista, que el borrado no corra
     en la misma pasada en que ve por primera vez la ficha sin cobertura.
3. **Los valores de los plazos 16, 17 y 18.** 16, la ventana de relectura de la cancelación por
   rechazo; 17, el escalamiento de una marca abierta; 18, la ventana de las comprobaciones de pagos
   y órdenes. Ninguno está medido.
   - Recomendación de N: **7 días, 7 días y 180 días**. El 7 del 16 cubre con margen las horas que
     tardó el proveedor en deshacer sus cancelaciones en los seis casos registrados; el 7 del 17 es
     una revisión por semana; el 180 del 18 es un techo prudente mientras no se sepa cuánto tarda
     un contracargo. Riesgo: un 16 corto suelta una suscripción que el proveedor revive y cobra; un
     18 largo cuesta llamadas que crecen con los pagos.
4. **Cuándo se borran las tres columnas viejas** (`owner_suspended`, `plan_restricted`,
   `billing_unpublished_at`). La decisión N dice *«posterior al paso 3, después de la
   clasificación»*.
   - A (la aplicada): en el mismo despliegue del paso 3, fechada después de la clasificación. Las
     columnas no llegan a la foto final del corte. Daño: ninguno.
   - B: en un despliegue posterior al corte. Daño: la excepción dura más que el corte, y la foto
     final las incluye.
   - Recomendación: **A**. Si el owner quiso la B, cambian una frase del paso 3 y una del §4.6 de
     `16-`, y una de `V/21` y de `B/21`.
5. **Cuentas y fichas que el sistema viejo acepta mientras se apaga** (R30).
   - A (la aplicada): repetir los recuentos con el viejo ya apagado, antes de migrar; si no dan
     cero, aborto. Daño: detecta, no evita; un aborto cuesta repetir el corte.
   - B: cerrar desde el principio la creación de cuentas y fichas del viejo en el borde. Daño:
     nadie se puede registrar durante la ventana del corte.
   - Recomendación: **A**. La B es una decisión de producto que cuesta clientes nuevos ese día.
6. **Una suscripción que el proveedor canceló tras un rechazo y vuelve a autorizarse dentro de la
   ventana** (lote K).
   - A: una persona la ve y decide; mientras tanto el proveedor cobra y los cobros quedan con
     propuesta de devolver. Daño: visible, pero cobra sin dar servicio.
   - B: el sistema manda la cancelación que habría mandado antes, con los 3 días de reintento y la
     marca si no se confirma. Daño: si la persona reautorizó a propósito, se le corta algo que
     igual no le daba servicio.
   - Recomendación de B: **B**. La fila está terminal: todo cobro sería sin contraparte.
7. **Dónde vive la lista de sondas que el receptor de producción no debe cancelar** (R9). B y N
   recomiendan distinto.
   - A: en el código del package del cobro, importada como módulo; si falta, no compila. Daño:
     agregar o sacar una sonda es un despliegue. Recomendación de N.
   - B: en una tabla que escribe quien opera el corte; si falta, no cancela y marca. Daño: una
     escritura a mano en producción, y un desconocido real sigue cobrando con su marca abierta hasta
     que alguien actúe. Recomendación de B.
   - Mi recomendación: **A**. El caso *«si falta»* desaparece, y las sondas vivas son pocas y del
     owner; un despliegue por sonda es barato frente a una escritura manual en producción.
8. **La transferencia de un pagador manual que no corresponde a ninguna cuota abierta** (R26).
   - A: se registra como un segundo pago del mismo período, que abre la marca de cobro duplicado
     con propuesta de devolver. Daño: una acción nueva del admin.
   - B: no se registra; el admin la devuelve por fuera. Daño: plata de un cliente sin rastro, y un
     reclamo sin nada que mostrar.
   - Recomendación de B: **A**, simétrica con la tarjeta.
9. **Con qué fecha entra a la segunda corrida del detector del corte un cobro de alta sin fecha de
   vencimiento** (`F-8V3B3-004`).
   - A: la fecha de creación más un ciclo. Daño: no está medido para altas; la corrida puede
     llegar antes.
   - B: esperar a que el registro se cierre. Daño: sin fecha fija, alguien tiene que volver a mirar.
   - Recomendación de B: **A**, y que la segunda corrida liste igual todo registro que siga abierto.
10. **Dos destaques mensuales iguales sobre la misma ficha**, comprados uno después de resolverse
    el otro: la identidad de la compra (lote E) no los frena.
    - A: se permite (puede ser una recompra legítima). Daño: un segundo cobro mensual que no compra
      nada.
    - B: el candado también frena si ya hay uno vivo. Daño: ninguno visible.
    - Recomendación de B: **B**.
11. **Dónde se guarda que una relectura vio la suscripción cancelada** (de este cierre). Tres reglas
    lo leen: el barrido deja de mirar una suscripción cuando la confirma, el plazo 16 cuenta desde
    ahí, y la baja de cuenta espera hasta ahí (lote D). Ningún capítulo dice dónde se guarda.
    - A: un instante en el vínculo con el proveedor (la primera relectura que la vio cancelada).
      Daño: una columna nueva; ninguno sobre plata.
    - B: derivarlo del registro de corridas del barrido. Daño: ese registro no tiene tabla todavía,
      y una corrida perdida borra el dato.
    - Recomendación: **A**. Una sola columna sostiene las tres reglas.
12. **El link de reclamo de un Partner tiene que llevar un secreto** (caso vecino de V). El diseño
    dice que la prueba es leer la casilla, y eso sólo vale si el link no se puede adivinar.
    - A: escribirlo (un secreto de un solo uso que viaja sólo en el aviso). Daño: ninguno.
    - B: dejarlo a la implementación. Daño: si alguien arma el link con el id, se queda con el
      Partner de otro.
    - Recomendación: **A**. No es un borde: da acceso indebido.

**Nota, sin decisión** (lote A, de V): el reclamo deja viva sólo la sesión con que se abrió. V no
encontró una lectura con daño distinto; queda anotado para quien construya `V7`.

### Propuestas para el log

Grepeado cada ID en `$D/01-decision-log.md`. Las 📌 llevan Estado *«precisada el 2026-09-30, con OK
del owner»*.

1. **`DEC-DATA-005` 📌** (existe, línea 5840; lote H, de V): *«Tras la baja de la cuenta, el
   seudónimo de la fila de `trial` se conserva hasta que el abogado conteste la pregunta 5 de
   `V/22`; si contesta en contra, soporte los borra todos con una tarea puntual, y se anota quién la
   corrió y cuándo.»* Razón: la decisión dice que la baja es otro proceso, y ahora ese proceso tiene
   regla para el seudónimo.
2. **`DEC-AUTH-004`, nueva** (libre: el log tiene hasta la 003; lotes A y B, de V): *«El reclamo de
   un Partner escribe `owner_user_id` sólo si está nulo, y su link es de un solo uso; si verifica la
   cuenta, cierra todas sus sesiones y credenciales previas. Una cuenta es dueña de a lo sumo un
   Partner, con unicidad en la base; el reclamo de un segundo deriva a soporte.»* Razón: decide a
   qué cuenta pertenece un Partner, y hoy vive sólo en `V/18` §2.4.
3. **`DEC-AUTH-005`, nueva** (libre; lotes I y M, de V): *«Postular un Partner no exige cuenta: es
   la segunda excepción del guest en el paso 1, acotada a esa escritura, con captcha (Turnstile) y
   una sola postulación abierta por correo.»* Razón: cambia la cadena de autorización.
4. **`DEC-ARCH-013` 📌** (existe, línea 6769; lote C, de N): *«La migración de datos única del
   catálogo corre dentro de la migración estructural del paso 3 del corte, antes de la escritura
   `C` y de la prueba del corte, que la leen; el paso 3a sólo la verifica. Si falla a la mitad, el
   corte entra en la rama de aborto.»* Razón: la decisión dice *«en el paso 3a»*.
5. **`DEC-DATA-008` 📌** (existe, línea 6810; lote K y R18, de N): *«La lista cerrada pasa de
   quince a dieciocho plazos: la ventana de relectura de la cancelación por rechazo, el escalamiento
   de una marca abierta y la ventana de las comprobaciones de pagos acreditados y de órdenes
   pagadas, los tres de billing y sin valor escrito; los fija el owner antes del ensayo, con los
   otros cinco.»* Si el owner fija los valores al contestar la pregunta 3, van en el mismo 📌.
6. **`DEC-ARCH-006` 📌** (existe, línea 2403; lote D y R5, de N): *«`puedeCobrarle` contesta sobre
   la cancelación confirmada por Mercado Pago: mientras una relectura no vea `cancelled` contesta
   `sí` y la baja de cuenta espera. `G13` vigila las seis respuestas de arranque.»*
7. **`DEC-RF-001` 📌** (existe, línea 1722; lote L, de B, que proponía `DEC-ADDON-001`, que es la
   pérdida del addon con la ficha, no la revocación): *«El addon de única vez comprado dentro de la
   ventana de revocación se devuelve por `RF1`, que crea `S36`, por el camino de devolución de
   órdenes; fuera de ella se consume.»*
8. **`DEC-CONC-001` 📌** (existe, línea 1464; lote E; el precedente es el 📌 del lote L de la
   revisión del owner, que puso ahí la compra de pago único): *«`A3` sólo confirma y nunca crea:
   sin id de orden abandona sin reenviar, y la comprobación de órdenes pagadas busca también por el
   identificador del pedido si el proveedor lo permite. La identidad de la compra (dueño, producto,
   objetivo), única entre las pendientes, frena la segunda compra en una pantalla nueva y es el
   candado del addon recurrente.»*
9. **`DEC-MIG-005` 📌** (existe, línea 6141; lotes F y G, de este cierre): *«No se devuelve nada a
   nadie, y el trial regalado no se presenta como compensación. Hecho del owner: no hay anuales
   vivas en el sistema viejo ni las va a haber antes del corte. El titular que sólo conoce el
   proveedor tiene detector sólo si alguna lectura medida en sandbox trae su pagador; si ninguna,
   queda declarado sin detector.»*

Sin propuesta: los lotes J y G se declaran en el «NO cierra» de `16-` por `DEC-METH-015`; los
lotes N y O viven en su capítulo. Con las dos nuevas, el log pasa de 137 a 139 decisiones y las
funcionales de 121 a 123; las «precisadas sin `SUPERSEDED`» se recuentan con script al aplicar.

### Propuestas para la matriz

Grepeado: la última fila es `EX-56`, y ningún archivo del diseño cita todavía `EX-57` a `EX-59`.
Las tres filas llevan la marca ✚.

1. **`EX-57`** (lote E, de B): *¿Se puede encontrar una orden de `/v1/orders` por su
   `external_reference` sin conocer su id (una búsqueda de órdenes, o `/v1/payments/search` por la
   referencia del pago de la orden)?* Condiciona la búsqueda por el identificador del pedido de la
   comprobación de órdenes pagadas (`B/09` §3) y el motivo 23 sin id. Estado `UNKNOWN`; sandbox y
   producción. Si da que no, esa población queda sin detector (`B/09`, NO cierra).
2. **`EX-58`** (lote L, de B): *¿`POST /v1/orders/{id}/refund` exige y respeta
   `X-Idempotency-Key`, qué devuelve un reenvío con la misma clave, y la relectura de la orden
   nombra el id de cada devolución?* Evidencia parcial: sonda 56 (batería IPN del 2026-09-29), un
   total y un parcial, `201`, releídos `refunded` y `partially_refunded`. Estado
   `PARTIALLY_SUPPORTED`. Condiciona `RF2` y `RF3` sobre el pago de un `UNA_VEZ` (`B/03` §6.1) y la
   revocación del addon de única vez (`B/22` §2.2).
3. **`EX-59`** (lote G, de N y B, unificada): *Para un preapproval cuyo `GET` trae `payer_email`
   vacío, ¿alguna otra lectura trae el correo del pagador: el buscador sin filtro, o el pago
   asociado a un registro de cobro (`/authorized_payments/{id}` o `/v1/payments/{id}`)?* Condiciona
   el detector del titular que sólo conoce el proveedor (`16-` §4.2 y §4.3, `B/21` §1.3). Estado
   `UNKNOWN`; sandbox.

El 📌 de `RF-7` que propuso B ya está en la fila (la Orders API en sandbox, sonda 56): no se
propone. Con las tres, la matriz pasa de 114 = 61 · 15 · 24 · 14 a **117 = 61 · 16 · 24 · 16**.

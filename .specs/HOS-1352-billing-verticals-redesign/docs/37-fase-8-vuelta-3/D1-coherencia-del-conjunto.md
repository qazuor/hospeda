---
title: "FASE 8 vuelta 3 · D1 — coherencia del conjunto"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 8
---

# FASE 8 vuelta 3 · D1 — coherencia del conjunto

Ataqué la coherencia del diseño entero contra el HEAD `923b23586b`: recorrí los conteos congelados
de las dos descomposiciones (guards por unidad, unidades del programa), de los catálogos de guards
de `V/20` y `B/20`, del reparto de invariantes de `NUCLEO/04`, de las acciones administrativas de
`NUCLEO/08` §3 contra quienes las cuantifican (`V/17`, `B/19`, `NUCLEO/02`), de los motivos de la
marca de `B/02` §2.5 contra sus citas, de los campos y entradas del contrato (§2 y §4.1), de las
máquinas de publicación y trial, y de los hechos de reinicio; comparé la firma del contrato contra
su implementación de arranque (§5.1) y contra el guard que la defiende (§6.3 y `V/20` `G13`); y
crucé todas las `DEC-…` citadas contra el log (las 108 existen) y las referencias `§x` con prefijo
explícito contra los encabezados reales. Casi todos los conteos cierran: 33 guards (17 + 15 + 1),
19 y 17 en los catálogos, 52 invariantes, 24 acciones vivas, 24 motivos con 9 que devuelven,
8 campos de la fuente, 8 entradas del §4.1.

Son **7 hallazgos**: **0 CRITICA, 1 ALTA, 1 MEDIA y 5 BAJA**. La idea más grave: el guard que
impide que la implementación de arranque llegue a producción (`G13`) tiene su objeto enumerado de
tres formas distintas, y ninguna incluye el `no` de arranque de `puedeCobrarle`; la de `V/20`, que
es la que construye `V4`, tampoco incluye el de `retenciónDetenida`.

Regla de lectura: cada hallazgo se apoya en una cita textual copiada literal de una sola línea del
archivo, con su `archivo:línea` (rutas relativas a la raíz del worktree).

## CRITICA

Ninguno.

## ALTA

### F-8V3D1-001 — `G13` no vigila las dos respuestas de arranque de la dirección de ida

**Qué se rompe.** La implementación de arranque contesta por billing en seis lugares: `no` a las
cuatro fuentes de billing, `detenida: no` a `retenciónDetenida` y `no` a `puedeCobrarle` (contrato
§5.1). `G13` existe para que ese cableado no llegue a producción, pero su objeto está escrito de
tres maneras: el contrato §6.3 nombra las cuatro fuentes y `retenciónDetenida`; la fila de `G13` en
`V/20` §2, que es la que `V4` implementa, nombra sólo las cuatro fuentes; y ninguna nombra
`puedeCobrarle`. Quien construya el módulo guardado siguiendo `V/20` deja afuera las dos preguntas
de ida, y un build de producción que las siga enlazando pasa `G13` en verde. Es la situación que
el mismo §6.3 describe para el día del merge enorme.

**El camino.**

1. En la rama del paraguas, `V4` arma el módulo de arranque que contesta por billing con lo que
   dice la fila de `G13`: las cuatro fuentes. Las respuestas de arranque de `retenciónDetenida` y
   de `puedeCobrarle` quedan en otro módulo, porque ninguna fila de guard las pide adentro.
2. `B4` integra la real en la raíz de composición, y en el PR final una de las dos preguntas queda
   cableada a la de arranque. `G13` corre sobre el build de producción y no falla: no importa el
   módulo que vigila.
3. Juan paga una suscripción mensual y la pausa por `CUSTOMER_REQUEST`. `retenciónDetenida`
   contesta `detenida: no`. Sus fichas bajan por `PB2`, `PB4` las archiva al día 90 y `PB9` borra
   su contenido al 180, que es exactamente lo que `DEC-DATA-006` decidió impedir.
4. O bien: Juan tiene una suscripción `ACTIVE` y pide a soporte dar de baja su cuenta.
   `puedeCobrarle` contesta `no`, la acción 24 pasa, la cuenta queda sin acceso y Mercado Pago le
   sigue cobrando cada mes sobre un preapproval vivo.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:57`
  — "un build destinado a producción importa el módulo de la implementación de arranque que contesta por billing"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:57`
  — "(el `no` a las cuatro fuentes de billing"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1465`
  — "(revisión del owner, 2026-09-28, C14). La implementación de arranque lo tiene en un módulo propio,"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1340`
  — "y a `puedeCobrarle` contesta `no`, porque sin billing no hay suscripción que cobre"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1118`
  — "La construye `B4` en la real, y `V4` en la de arranque, que contesta `no`"

**Qué haría falta decidir o escribir.** Cuál es el objeto de `G13`: el cableado que contesta por
billing entero (las seis respuestas del §5.1) o una lista. Si es una lista, escribirla una sola
vez y que el contrato §6.3 y la fila de `V/20` la citen en vez de repetirla.

## MEDIA

### F-8V3D1-002 — El inventario de «fila viva» define `puedeCobrarle` sin la marca de cancelación

**Qué se rompe.** El contrato §4.1 dice que `puedeCobrarle` contesta `sí` con una suscripción en
fila viva salvo `CANCEL_SCHEDULED` **o** con una marca `CANCELACIÓN_SIN_CONFIRMAR` abierta, porque
ese preapproval todavía puede cobrar. La fila 27 del inventario de `NUCLEO/01` §2.4, que el propio
contrato designa como la entrada de `puedeCobrarle` y que `G-R1-E` vigila, da la respuesta entera
sin la segunda mitad. `B/descomposicion.md` (fila `B4`) y `NUCLEO/08` §3 sí la tienen: son dos
fuentes contra una, pero la que falta es la que define el término.

**El camino.**

1. Juan se da de baja; `S11` manda la cancelación, el proveedor no la aplica y el barrido abre
   `CANCELACIÓN_SIN_CONFIRMAR` sobre una fila que ya está terminal de nuestro lado.
2. Quien implementa `puedeCobrarle` en `B4` lo arma desde el inventario de `NUCLEO/01`: mira sólo
   filas vivas, no encuentra ninguna y contesta `no`.
3. Juan pide dar de baja su cuenta; la acción 24 pasa y la cuenta queda sin acceso.
4. Mercado Pago le cobra el mes siguiente sobre el preapproval que nunca se canceló, y Juan ya no
   tiene cuenta para ver el cobro ni pedir el reembolso.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:569`
  — "en una de las filas vivas salvo `CANCEL_SCHEDULED`, que ya está dada de baja en el proveedor"
- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:569`
  — "Son cinco de los seis a propósito"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1118`
  — "o una marca `CANCELACIÓN_SIN_CONFIRMAR` abierta sobre una suscripción suya"

**Qué haría falta decidir o escribir.** Si la fila 27 enumera sólo el consumo de *«fila viva»* (y
entonces debería decir que la respuesta tiene otra mitad y dónde está) o la respuesta completa (y
entonces le falta la marca).

## BAJA

### F-8V3D1-003 — `U1` dice que corren dos guards y sólo construye uno

**Qué se rompe.** El *«qué deja demostrado»* de la limpieza dice que dos guards corren sobre todo el
repo y nacen verdes, contando `G16`. La fila de `U1` y el párrafo siguiente dicen que `G16` sigue
en `B1` y que entre `U1` y `B1` su predicado (a) queda sin vigilancia automática.

**El camino.**

1. Quien revisa `U1` lee *«los dos guards corren»* y exige ver `G16` en verde.
2. `G16` no existe hasta `B1`; o se lo construye a medias en `U1`, o se da `U1` por no terminada.
3. Juan no ve nada: el efecto es sobre el tablero, no sobre un cliente.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:530`
  — "Los dos guards corren sobre todo el repo, sin lista de pendientes de código, y nacen verdes."
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:568`
  — "Entre `U1` y `B1` el predicado (a) queda sin"

**Qué haría falta decidir o escribir.** Corregir la frase del §4.6 para que diga un guard (`G8`) y un
recorrido manual del predicado (a).

### F-8V3D1-004 — `V/17` §3.4 y §3.5 cuentan 21 y 23 acciones donde la tabla tiene 22 y 24

**Qué se rompe.** `NUCLEO/08` §3 tiene 24 filas vivas, y `V/17` §3.2 regla 3 declara 22 como
capacidad del actor, incluida la vigesimoquinta (vaciar la presencia de un Partner). El §3.4 de
`V/17` sigue con *«veintiuna»* y enumera el conjunto sin la vigesimoquinta, dos veces, y el §3.5
enumera hasta la 24 y no la 25.

**El camino.**

1. Juan, Partner que dejó de pagar, pide vaciar su presencia.
2. Quien implementa la clase de esa acción lee el §3.4, no la encuentra entre las de capacidad del
   actor y aplica la regla general: pasos 5 a 7 sobre Juan.
3. Juan no tiene la clave de presencia y la acción se rechaza. La regla 3 del §3.2 dice lo
   contrario, así que un revisor lo corrige: el daño es de texto.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:371`
  — "veintidós acciones del capítulo 08 §3, las catorce primeras, de la decimoséptima a la vigesimosegunda, la vigesimocuarta y la vigesimoquinta,"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:497`
  — "las cinco del catálogo, con N1 y C9; la vigesimocuarta, con los casos vecinos, 2026-09-29, F-C)"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:524`
  — "veintiuna acciones del cap. 08 §3 que son capacidad del actor —las catorce primeras"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:543`
  — "la misma revisión, N1 y C9; la 23 y la 24, borrar una ficha ajena y"
- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:208`
  — "La tabla tiene VEINTICUATRO filas vivas"

**Qué haría falta decidir o escribir.** Llevar los dos lugares del §3.4 a veintidós con la
vigesimoquinta, y el §3.5 a 24 nombrando la 25.

### F-8V3D1-005 — La fila de `V6` dice doce transiciones; la máquina tiene trece

**Qué se rompe.** `V/03` §9 tiene `PB1`–`PB13` (entró `PB13` con C10) y lo dice. La fila `V6` de
`V/descomposicion.md` §2 sigue con doce y no nombra `PB13`; la asignación de `PB13` a `V6` vive sólo
en la tabla de repartos de más abajo.

**El camino.**

1. Quien toma `V6` recorre su fila y cuenta doce transiciones.
2. `PB13` (levantar la baja de una ficha que estaba publicada) queda fuera de su lista de trabajo.
3. Juan tiene una ficha moderada que el admin levanta; sin `PB13` no vuelve a
   `UNPUBLISHED_BY_BILLING`. La tabla de repartos lo asigna, así que el hueco es de la fila.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:59`
  — "Y la máquina entera, de seis estados y doce transiciones"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:498`
  — "(revisión del owner, 2026-09-28, C10: entra `PB13`, recontadas sobre la tabla)"

**Qué haría falta decidir o escribir.** Llevar la fila de `V6` a trece y nombrar `PB13`.

### F-8V3D1-006 — Dos lugares siguen con seis hechos de reinicio; la lista cerrada tiene cinco

**Qué se rompe.** `NUCLEO/01` §1.2 tiene cinco hechos (1, 2, 3, 5 y 6; el 4 salió con C8). `B/03`
§7.1 y `B/descomposicion.md` §2.9 dicen todavía seis, nombrando el sexto sin descontar el cuarto.

**El camino.**

1. Quien implementa el reloj de retención desde `B/03` §7.1 busca seis hechos.
2. Encuentra cinco en el glosario y pierde tiempo buscando el que falta, o reintroduce el cuarto
   (el fin de servicio de una vertical discontinuada), que ya no existe.
3. Juan no ve nada si nadie lo reintroduce: es texto vencido.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1937`
  — "(el sexto, levantar una moderación —`PB11`—, owner 2026-09-25; FASE 9 completa, 5b):"
- `.specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:598`
  — "hechos (el sexto, `PB11`: owner 2026-09-25, FASE 9 completa, 5b) de"
- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:50`
  — "(numerados 1, 2, 3, 5 y 6: el 4 salió con la revisión del owner, 2026-09-28, C8)"

**Qué haría falta decidir o escribir.** Llevar las dos cifras a cinco.

### F-8V3D1-007 — `V/02` §2.4 no existe y dos capítulos la citan por la FK de `trial`

**Qué se rompe.** `NUCLEO/08` §3 (la acción de dar de baja una cuenta) y `B/02` citan `V/02` §2.4
para la FK `ON DELETE RESTRICT` de `trial.user_id`. `V/02` no tiene §2.4: la FK está en el §2.2.

**El camino.**

1. Quien implementa la baja de cuenta sigue la cita a `V/02` §2.4 y no la encuentra.
2. Busca a mano la FK. Si no la encuentra, puede borrar la fila de `user` y chocar con la base.
3. Juan pide la baja y la acción falla por la FK. La FK sí está escrita, así que el daño es de
   navegación.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:203`
  — "Choca con `V/02` §2.4: la FK de `trial.user_id` es `ON DELETE RESTRICT`"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:401`
  — "La FK de `trial.user_id` a `user` es `ON DELETE RESTRICT`"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:299`
  — "### 2.2 Compromiso y ciclo de vida"

El silencio: `rg -n "^###? 2\.4" .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md`
no devuelve nada (los encabezados del §2 son 2.1, 2.2, 2.5 y 2.7).

**Qué haría falta decidir o escribir.** Cambiar las dos citas a `V/02` §2.2.

## Ataques que intenté y el diseño resistió

- **Reparto de guards (33 = 17 + 15 + 1)**: recontado por script sobre la columna `guards` de las dos
  descomposiciones sin tachaduras (V: 17; B: 15) más `G8` en `U1`; `16-fase-7` §4.6 dice lo mismo.
- **Catálogos de guards**: `V/20` §2 tiene 19 filas vivas y `B/20` §2, 17, como declaran los dos
  `spec.md`; los nueve con id propio de verticales y los diez `G-R*` también cierran.
- **Invariantes**: 6 + 14 + 5 + 7 + 5 = 37 del §64, 15 filas vivas en el §3 de `NUCLEO/04`, 20
  apoyos con cinco de doble apoyo, 52 en total, diez en base.
- **Acciones administrativas**: 24 filas vivas en `NUCLEO/08` §3 (la 16 tachada), igual que
  `V/17` §3.2, §3.3 y `B/19` §6; las cinco del catálogo de `NUCLEO/02` son la 18 a la 22.
- **Motivos de la marca**: 24 filas en `B/02` §2.5, 13 abiertas por `S14` y 11 por otros actos,
  9 que devuelven; `B/19` §6 tiene 11 filas con 9 que devuelven; todas las citas del número dicen
  lo mismo.
- **Contrato**: 8 campos de la fuente, 8 entradas en el §4.1 con 13 campos en 4 consultas, y los
  constructores de cada entrada coinciden con las filas de `V2`, `V4`, `V6`, `B4` y `V8`.
- **Decisiones citadas**: las 108 `DEC-…` del alcance existen en el log; las que revisé contra su
  contenido (`DEC-DATA-006`, `DEC-DATA-007`, `DEC-SUB-023`, `DEC-MIG-006`) coinciden con los
  capítulos.
- **Referencias a `B/10` §4**: todas las que encontré viven dentro de texto tachado.

## Fuera de mi vector

- **Numeración de las acciones y posición en la tabla**: moderar es la acción 13 y ocupa la fila 12;
  la tabla no imprime números, y quien cite por posición se corre uno. Le toca a quien revise
  `NUCLEO/08` como superficie de autorización.

## Key Learnings

1. Los conteos congelados del programa están casi todos sanos: los errores aparecen en las
   enumeraciones repetidas a mano (el objeto de `G13`, la lista de acciones del §3.4), no en las
   cifras con tachadura y recuento.
2. Una pregunta nueva de la dirección de ida (`puedeCobrarle`) entró al contrato §4.1 y §5.1 pero
   no a los dos lugares que enumeran lo que la implementación de arranque contesta por billing.
3. Un strip de `~~…~~` por línea no alcanza en este corpus: hay tachaduras que cruzan líneas y dan
   falsos positivos en un recorrido de referencias.

---
title: "FASE 9 vuelta 3 · aplicación — núcleo, contrato y corte"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 9
---

# FASE 9 vuelta 3 · aplicación del grupo N: núcleo, contrato y corte

Archivos tocados: `$D/12-contrato-de-cobertura.md`, `$D/16-fase-7-del-paraguas.md`,
`$D/nucleo/01-glosario.md`, `$D/nucleo/02-modelo-de-datos.md`,
`$D/nucleo/07-outbox-y-notificaciones.md` y `$D/nucleo/08-auditoria-y-observabilidad.md`. Todo
lo que cambia está tachado al lado de lo nuevo, con su origen entre paréntesis.

## 1. Qué se aplicó

### Lote D (R4: `F-8V3C1-001`, `F-8V3C1-004`, `F-8V3D1-002`)

- Contrato §4.1, `puedeCobrarle`: contesta sobre la cancelación confirmada, y mientras no, `sí`.
  `D/12:1118` «Contesta sobre la cancelación confirmada por Mercado Pago, no sobre el estado de la fila»
- Ídem, la espera de la acción 24 hasta que el barrido confirme o abra la marca.
  `D/12:1118` «Mientras no esté confirmada, contesta `sí` y la acción 24 espera»
- Ídem, entra también al inventario de marca abierta.
  `D/12:1118` «Y al de «marca abierta»
- Glosario §2.4, fila 27, con la respuesta entera y lo que cuenta `G-R1-E`.
  `nucleo/01:569` «Lo que cuenta `G-R1-E` es esta fila, la mitad de «fila viva»
- Glosario §2.5, fila 12 nueva del inventario de marca abierta (la mitad de la marca, `G-R1-F`).
  `nucleo/01:739` «la respuesta de `puedeCobrarle`, su mitad de la marca»
- `NUCLEO/08` §1.3, paso 1 de la baja: el paso 3 espera la confirmación.
  `nucleo/08:102` «con la cancelación mandada al proveedor en el acto,»
- `NUCLEO/08` §1.3, la precondición de la 24.
  `nucleo/08:116` «incluida una `CANCEL_SCHEDULED` o una terminal cuya cancelación nuestra ninguna relectura confirmó todavía»
- `NUCLEO/08` §3, acción 24: la precondición y la razón vieja tachada.
  `nucleo/08:203` «la razón tachada suponía confirmada una cancelación que el barrido puede estar reintentando»

### R5 (`F-8V3C1-002`, `F-8V3D1-001`)

- Contrato §6.3: el objeto de `G13` nombra las seis respuestas de arranque, con un caso por cada una.
  `D/12:1481` «Son las seis respuestas de arranque que contestan»
- En mis archivos el objeto no está escrito en otro lugar: el §5.1 ya enumeraba las seis, y el §7.1
  remite a `G13` sin lista.

### Lote C (R2: `F-8V3A2-001`, `F-8V3A3-001`)

- `16-` paso 3: el catálogo entra a la migración estructural, antes de la prueba, y qué pasa si falla.
  `D/16:137` «y el catálogo de producción, la migración de datos única que antes corría en el 3a»
- Ídem, la falla a la mitad aborta.
  `D/16:137` «si esa escritura falla a la mitad, falla la migración, el paso 3 no termina»
- `16-` paso 3a: sólo verifica.
  `D/16:138` «se cargan dentro de la migración estructural del paso 3, antes de la prueba del corte»
- `16-` paso 6: la migración única del catálogo sale del paso 3, no del 3a.
  `D/16:145` «desde el lote C, dentro de la del paso 3»
- `NUCLEO/02` §1.4, punto 2.
  `nucleo/02:92` «dentro de la migración estructural del paso 3 del»
- Ídem, la falla.
  `nucleo/02:96` «Si falla a la mitad, falla la migración»

### Lote N (R3: `F-8V3A3-002`, `F-8V3C2-006`)

- `16-` §4.6, punto 1 de `U1`: las tres columnas sobreviven, excepción temporal y nombrada.
  `D/16:584` «Salvo tres columnas de `accommodations`, `owner_suspended`,»
- `16-` paso 3: llegan vivas a la migración y las borra una migración propia después de `V6`.
  `D/16:137` «llegan vivas a esta migración»
- `16-` paso 3, la parte de `C2-006`: la verificación de la tabla de migraciones aplicadas, marcada
  como derivada. `D/16:137` «toda migración del journal de la imagen tiene que figurar»
- `16-` §4.4: los hotfixes del congelamiento pueden traer migraciones.
  `D/16:533` «Un hotfix puede traer una migración»

### Lote J (R14: `F-8V3C2-001`, `-002`, `-003`)

- `16-` §4.3, las tres situaciones declaradas, con causa y daño.
  `D/16:479` «Lo que no deshace una restauración: tres situaciones, declaradas por decisión del owner»
- Primera. `D/16:485` «Restaurar el backup del paso 6 deja preapprovals vivos sin fila»
- Segunda. `D/16:493` «Un aborto borra los pagos que el receptor nuevo ya asentó»
- Tercera. `D/16:501` «Después de un aborto, `main` sigue con el sistema nuevo»
- La frase de `D/16:143` queda, acotada a lo que es verdad al lado de la declaración.
  `D/16:143` «Eso vale para la rama de aborto y para nada más»
- Paso 6, el aviso junto a su restauración.
  `D/16:145` «y pierde lo que el sistema nuevo escribió desde ese backup»

### Lote F (R8, `F-8V3C2-004`)

- Guion, punto 3, sin lo de que la prueba compensa, y con que no se devuelve para todas.
  `D/16:274` «Y sin decirle que la prueba lo compensa»
- Paso 0, el hecho del owner.
  `D/16:131` «Y el owner aporta el hecho: no hay anuales vivas»

### Lote G (`F-8V3B3-001`)

- `16-` §4.2, la pasada: el campo medido vacío y la medición en sandbox como condición.
  `D/16:247` «Pero ese campo, medido, viene vacío»
- `16-` §4.3, la declaración si ninguna lectura trae el pagador.
  `D/16:509` «Y el titular que sólo conoce el proveedor, si ninguna lectura trae su pagador»
- La fila de matriz propuesta está en el §5.

### Lote H y R10 (`F-8V3A3-006`, `F-8V3A1-004`)

- Acción 24: el seudónimo se conserva hasta la pregunta 5, y la tarea puntual si es en contra.
  `nucleo/08:203` «El seudónimo de esa fila se conserva hasta que el abogado conteste la pregunta 5»
- Ídem, el dato que la marca dada de baja y el paso que lo lee, y las credenciales.
  `nucleo/08:203` «la acción escribe el instante de la baja en»
- Ídem, `postulacion.correo`. `nucleo/08:203` «la baja reemplaza, como el de»
- La cita a `V/02` §2.4, corregida a §2.2 (`F-8V3D1-007`), en la misma fila.
  `nucleo/08:203` «el § citado no existía, la FK está en el §2.2»

### Lote K y R18 (`F-8V3B3-002` lado plazos, `F-8V3B3-003`)

- `NUCLEO/02` §1.5, plazo 16. `nucleo/02:169` «la ventana de relectura de la cancelación por rechazo»
- Plazo 17. `nucleo/02:170` «el escalamiento de una marca abierta»
- Plazo 18. `nucleo/02:171` «la ventana de las comprobaciones de pagos acreditados y de órdenes pagadas»
- El recuento. `nucleo/02:173` «Son dieciocho»
- Los valores propuestos (pregunta abierta, §6). `nucleo/02:179` «Los valores que se le proponen al owner»
- Espejo en `16-` paso 3. `D/16:137` «con los ~~quince~~ dieciocho valores»

### R9 lado corte (`F-8V3C2-007`, `F-8V3C2-008`)

- El manifiesto de sondas que lee el handler sale de `mp-probes/`.
  `D/16:150` «un preapproval desconocido no puede vivir en `mp-probes/`»
- Dónde vive en producción, marcado como derivado. `D/16:151` «Vive en el código del package del cobro»
- El manifiesto del 1b, fuera del repositorio y hasta cuándo. `D/16:316` «El manifiesto no se»
- Quién agenda la segunda corrida. `D/16:341` «La segunda corrida la agenda quien opera el corte»

### R15, parte `F-8V3A3-003`

- `16-` paso 6: el carril de extras queda afuera, cómo se genera la partida y qué filas lleva.
  `D/16:145` «queda afuera del reemplazo»
- Ídem. `D/16:145` «La migración de partida la genera Drizzle»

### R19, R20, R29 (contrato)

- `extenderTrial`: la clave la guarda verticales (`F-8V3C1-003`).
  `D/12:1167` «La guarda verticales, que es quien ejecuta»
- Interfaz del reloj: la duodécima dependencia entre épicas (`F-8V3C1-006`).
  `D/12:1540` «depende de `B1`»
- §7.1: `V1` escribe todas las interfaces y simuladores (`F-8V3C1-005`) y la frase de `B1`
  (`F-8V3C1-008`). `D/12:1555` «escribe las»
- Publicar una versión de addon (`F-8V3C1-007`).
  `D/12:1175` «Y publicar una versión de addon cruza por `políticaDeAddon`, sin entrada nueva»
- Espejo en `NUCLEO/08` §3, acción 20. `nucleo/08:199` «Escribe en las dos épicas, cada mitad en la suya»
- `16-` §4.6, las dependencias entre épicas en doce. `D/16:660` «Son doce desde la FASE 9»

### R21 lado núcleo (`F-8V3A1-006`)

- No se eligió: queda como pregunta abierta (§6), con un ⚠️ en `NUCLEO/08` §3.
  `nucleo/08:227` «Quién asigna el permiso de cada fila»

### R30 (`F-8V3C2-005`)

- `16-` paso 3: los tres recuentos se repiten con el contenedor viejo apagado, antes de migrar.
  `D/16:137` «se repiten los tres recuentos del paso 2»

### R12 en mis archivos

- `F-8V3D1-003`, `16-` §4.6. `D/16:610` «corre sobre todo el repo, sin lista de pendientes de código, y nace verde»
- `F-8V3A2-008`, la fila del 3b (la única de las cuatro de ese hallazgo en mis archivos).
  `D/16:139` «dentro de lo que la rama de aborto cubre»
- `F-8V3A2-007`, `NUCLEO/07` §2 (la de `V/02` es de V). `nucleo/07:100` «quedan el 1, el 2, el 3, el 5 y el 6»
- `F-8V3D1-007`: arriba, en la acción 24.

## 2. Lo que no se aplicó y por qué

- **R21 (`F-8V3A1-006`)**: si *«sólo `SUPER_ADMIN`»* es un permiso no asignable y si asignar un
  permiso es una fila son dos lecturas con daño distinto; queda en el §6 con un ⚠️ en `NUCLEO/08`.
- **`F-8V3D1-006`**: no tiene espejo en el núcleo (el glosario ya dice cinco hechos); sus dos
  renglones son de B.
- **`F-8V3A3-008`, `F-8V3A3-009`** (BAJA de `A3`): caen en `V/02` y `V/22`, no en mis archivos.
- **Qué hace concretamente *«escalar»*** (`F-8V3B3-003`): es de `B/09` §3; el plazo sí entró.
- **La columna de la clave de canje** (R19) y **el paso 1 que lee `user.deleted_at`** (R10): se
  escriben en capítulos de V; acá queda la regla y va a «Para otro grupo».
- **La unidad de cada pieza nueva**: mi grupo no tiene descomposición. Las unidades van a «Para
  otro grupo» (los tres plazos, la fila 12 del inventario, la dependencia `V4` sobre `B1`).

## 3. Conteos recontados

| lista | viejo → nuevo | comando | espejos actualizados |
|---|---|---|---|
| plazos de `NUCLEO/02` §1.5 | 15 → **18** | `rg -c "^\| (1[0-8]\|[1-9]) " $D/nucleo/02-modelo-de-datos.md` sobre la tabla (filas 1 a 18) | `NUCLEO/02` §1.5 (*«Son dieciocho»*, *«dieciocho valores»*), `16-` paso 3 |
| plazos sin valor escrito | 5 → **8** (3, 4, 7, 8, 9, 16, 17, 18) | lectura de la columna *valor inicial* | `NUCLEO/02` §1.5, `16-` paso 3 |
| dependencias entre épicas | 11 → **12** (la de `V4` sobre `B1`) | tabla de `B/descomposicion.md` §2.6 más la nueva | `16-` §4.6 (dos lugares), contrato §7.1 |
| inventario de *«marca abierta»* | 11 → **12** filas | `awk` sobre la tabla B del §2.5 de `nucleo/01` | ninguno con cifra en mis archivos |
| inventario de *«fila viva»* | 27 filas, sin cambio | ídem §2.4 | — |
| entradas del contrato §4.1 | 8, sin cambio | bloque de firmas del §4.1 | — |
| acciones de `NUCLEO/08` §3 | 24 vivas, sin cambio | tabla del §3 | — |
| respuestas de arranque vigiladas por `G13` | 5 → **6** | §6.3 contra §5.1 | contrato §6.3 |

## 4. Para otro grupo

**Grupo V.**

1. `V/20`, línea 57, fila de `G13`: citar el contrato §6.3 en vez de enumerar. Texto: *«el cableado que
   contesta por billing: las seis respuestas de arranque del `12-contrato…` §6.3 (las cuatro fuentes,
   `retenciónDetenida` y `puedeCobrarle`), con un caso que falla por cada una»*. Razón: R5.
2. `V/02` §2.2, fila de `trial`: la columna de la clave de canje, escrita en la transacción de `T4`
   (`V4`); y en `V/descomposicion.md`, fila de `V4`, el caso del juego inverso que reintenta la
   misma clave y recibe `ACEPTADA` sin un segundo `T4`. Razón: R19, contrato §4.1.
3. `V/17` §1.2, paso 1: *«una cuenta dada de baja (`user.deleted_at` no nulo, acción 24 de
   `NUCLEO/08` §3) no tiene actor autenticado: no se le crea sesión, con ninguna credencial»*; y
   `V/02`, línea 412, la baja: *«escribe `user.deleted_at` y borra las filas de `account` de la cuenta»*.
   Razón: `F-8V3A1-004`.
4. `V/02` §2.7 (`postulacion`) y `V/22` pregunta 5: *«la baja de cuenta reemplaza el correo de toda
   postulación que lleve el de la cuenta»* y *«el seudónimo se conserva hasta la respuesta; si es en
   contra, soporte los borra con una tarea puntual, anotando quién y cuándo»*. Razón: lote H,
   `F-8V3A3-006`.
5. `V/21` §2.4 (`V/21`, línea 389): la prueba del corte lee el catálogo que la misma migración estructural
   carga antes. Razón: lote C.
6. `V/21` §2.4 y la fila de los guards de limpieza de `V/20` §2: las tres columnas sobreviven a
   `U1` hasta la migración que las borra, después de la clasificación de `V6`. Razón: lote N.
7. `V/descomposicion.md` §3 y fila de `V4`: dependencia de `B1` por la interfaz del reloj.
   Razón: `F-8V3C1-006`.
8. `V/descomposicion.md`, fila de `V1`: *«escribe las interfaces, validaciones y simuladores de
   todas las entradas del contrato; cada unidad trae sólo su implementación»*. Razón:
   `F-8V3C1-005`.
9. `V/02`, línea 93 y la unidad del editor del catálogo de verticales: la mitad de verticales de publicar
   una versión de addon (crear la `addon_version`), con su criterio. Razón: `F-8V3C1-007`.

**Grupo B.**

1. `B/09` §3: nombrar el dato que guarda que una relectura vio `cancelled` una cancelación nuestra
   (el mismo que saca la fila de las salvedades 1 y 4), porque `puedeCobrarle` lo lee. Razón: lote D.
2. `B/descomposicion.md`, línea 130, fila de `B4` (si no lo aplicó ya: `B/descomposicion.md`, línea 673 lo
   nombra): el criterio con la respuesta entera de `puedeCobrarle` y la fila 12 del inventario de
   *«marca abierta»*; `B/20` §2, `G-R1-F` cuenta esa fila. Razón: lote D.
3. `B/09`, línea 738, `B/09`, línea 779, `B/09`, línea 814: citar los plazos 16, 17 y 18 de `NUCLEO/02` §1.5 por su
   nombre; y `B/descomposicion.md`, línea 643, fila de los plazos de billing, con los tres relojes nuevos
   (la suscripción al primer `cancelled`, la marca, el pago o la instancia) y la unidad del barrido
   que los lee. Razón: lote K y R18.
4. `B/21`, línea 425: reemplazar *«Si algún día algo del corte volviera a leerlas, corre antes de
   retirarlas.»* por *«Tres de ellas las lee la tabla de traducción del corte (`owner_suspended`,
   `plan_restricted`, `billing_unpublished_at`): sobreviven a `U1` y las borra una migración
   posterior a la clasificación de `V6`, en el paso 3 (`16-fase-7…` §4.2 y §4.6)»*. Razón: lote N.
5. `B/21`, línea 148: el catálogo ya no es el paso 3a; se carga en la migración estructural del paso 3 y
   el 3a lo verifica. Razón: lote C.
6. `B/21`, línea 497 y `B/21`, línea 525: sin *«suele cubrir»*; *«no se devuelve»* para todas; el hecho del owner.
   Razón: lote F (B ya está en la segunda, según `B/21`, línea 528).
7. `B/09`, línea 112 y `B/06`, línea 390: el manifiesto que lee el handler vive en el código del package del
   cobro, y el de `mp-probes/` queda como registro (`16-` §4.2). Razón: `F-8V3C2-008`.
8. `B/descomposicion.md` §2.6 (encabezado *«ONCE»*, líneas 334 y 375-376): son doce, con una fila
   14 nueva, `V4` sobre `B1` (la interfaz del reloj); el 13 tachado no se reusa. Razón:
   `F-8V3C1-006`.
9. `B/descomposicion.md`, línea 326-334: *«con cada entrada entrando con la unidad que construye su
   implementación»* pasa a *«`V1` escribe todas las interfaces, validaciones y simuladores; cada
   unidad trae sólo su implementación»*. Razón: `F-8V3C1-005`.
10. `B/14`, línea 362: la clave de canje la guarda verticales. Razón: R19.
11. `B/16` y fila de `B13`: el acto de billing que re-apunta `addon_product.version_id` validando
    con `políticaDeAddon`. Razón: `F-8V3C1-007`.

## 5. Propuestas para el log y la matriz

1. **`DEC-ARCH-013`, 📌** (grepeado: existe, `01-decision-log.md`, línea 6768). Estado: *«precisada el
   2026-09-30, con OK del owner»*. Texto: *«La migración de datos única del catálogo corre dentro de
   la migración estructural del paso 3 del corte, antes de la escritura `C` y de la prueba del corte,
   que la leen; el paso 3a sólo la verifica. Si falla a la mitad, el corte entra en la rama de
   aborto (FASE 9 vuelta 3, owner 2026-09-30, lote C).»* Razón: la decisión dice *«en el paso 3a»*.
2. **`DEC-DATA-008`, 📌** (existe, `01-decision-log.md`, línea 6810). Texto: *«La lista cerrada pasa de
   quince a dieciocho plazos: la ventana de relectura de la cancelación por rechazo (lote K), el
   escalamiento de una marca abierta y la ventana de las comprobaciones de pagos acreditados y de
   órdenes pagadas (`F-8V3B3-003`), los tres de billing y sin valor escrito; los fija el owner antes
   del ensayo, con los otros cinco (FASE 9 vuelta 3, owner 2026-09-30).»*
3. **`DEC-ARCH-006`, 📌** (existe, `01-decision-log.md`, línea 2403). Texto: *«`puedeCobrarle` contesta
   sobre la cancelación confirmada por Mercado Pago: mientras una relectura no vea `cancelled`
   contesta `sí` y la baja de cuenta espera (FASE 9 vuelta 3, owner 2026-09-30, lote D). `G13` vigila
   las seis respuestas de arranque (R5).»* Razón: es la decisión del contrato. Si el owner prefiere
   otro `DEC` para `puedeCobrarle`, va ahí.
4. **Fila nueva de la matriz, `EX-57`** (el siguiente libre hoy; si B o V proponen otra con el
   mismo número, se renumera al aplicar). Pregunta: *«Para un preapproval cuyo `GET` trae
   `payer_email` vacío, ¿alguna otra lectura trae el correo del pagador: el buscador sin filtro, o
   el pago asociado a un registro de cobro (`/authorized_payments/{id}` o `/v1/payments/{id}`)?»*.
   Qué decide: si el titular que sólo conoce el proveedor tiene detector en el corte (`16-` §4.2 y
   §4.3; lote G). Estado: `UNKNOWN`. Dónde: sandbox. Razón: lote G.
5. **Declaraciones por `DEC-METH-015`**: las tres del lote J y la del lote G quedan en el §4.3 de
   `16-`; no piden fila propia.

## 6. Preguntas abiertas

1. **R21, quién asigna los permisos de las 24 acciones.** Lectura A: *«sólo `SUPER_ADMIN`»* es un
   permiso reservado al rol, no asignable por override, y asignar un permiso o un rol es una fila
   26 de `NUCLEO/08` §3, con auditoría y `actor ≠ sujeto`. Daño: ninguno de plata; suma una fila y
   su unidad. Lectura B: la asignación queda fuera de la tabla, como hoy, y se declara. Daño: un
   permiso de fijar precios asignado sin registro de quién lo dio. **Recomiendo la A.**
2. **Los valores de los plazos 16, 17 y 18.** Recomiendo 7, 7 y 180 días (razones en `NUCLEO/02`
   §1.5). Sin medición en ninguno; el 16 y el 18 esperan `EX-45` y `RF-3`.
3. **Cuándo corre la migración que borra las tres columnas (lote N).** La decisión dice *«posterior
   al paso 3, después de la clasificación»*. Lectura A (la aplicada): en el mismo despliegue del
   paso 3, fechada después de la clasificación de `V6`; las columnas no llegan a la foto del paso 6
   y los guards las admiten hasta el corte. Lectura B: en un despliegue posterior al corte; la foto
   del paso 6 las incluye y los guards las admiten más allá del corte. Daño de B: la excepción
   dura más que lo que la decisión nombra. **Recomiendo la A**; si el owner quiso la B, cambia una
   frase del paso 3 y una del §4.6.
4. **R30, cerrar o recontar.** Apliqué recontar en el paso 3 con el contenedor viejo apagado (es un
   control, no mecanismo). La otra salida, cerrar en el borde desde el 0b la creación de cuentas y
   fichas del viejo, evita el aborto en vez de detectarlo, pero deja a cualquier persona sin poder
   registrarse durante la ventana, que es decisión de producto. Si el owner la prefiere, se suma al
   0b.

## 7. Casos vecinos

- **La migración única del catálogo no tiene unidad nombrada**: antes la corría *«el despliegue»*
  en el 3a; ahora va dentro de la migración estructural, que es de `V6`, pero sus datos son también
  de billing (precios, complementos, códigos). Nadie dice quién la escribe.
- **`16-` §4.2, punto 2 de las herramientas**: la primera corrida del detector necesita los ids del
  manifiesto del 1b para los *«cobros del día del corte sin `payment`»*; la segunda no. Lo dejé
  dicho sólo para la segunda.
- **El párrafo de `NUCLEO/08` §1.3** dice que la baja la hace soporte *«con una lista de pasos
  escrita»*; con la espera de hasta 3 días del lote D, la lista necesita decir qué hace soporte
  mientras espera. No lo agregué.
- **El manifiesto de sondas en código** cambia el costo de agregar una sonda (un despliegue); `B/06`
  §8 dice *«versionadas, marcadas como no productivas»* para las sondas mismas, que siguen en
  `mp-probes/`.

## Key Learnings

1. El contrato y el glosario definían `puedeCobrarle` con dos inventarios distintos: la mitad de
   la marca es un consumidor de *«marca abierta»* (`G-R1-F`) y no de *«fila viva»* (`G-R1-E`).
2. Billing no nombra en ningún lado el dato de *«la relectura confirmó la cancelación»*, aunque el
   barrido lo necesita para sus salvedades: `puedeCobrarle` lo expone.
3. El código actual ya rechaza la sesión de una cuenta con `users.deleted_at` (H-163, en el hook de
   creación de sesión, para toda credencial): el *«sin acceso»* de la acción 24 tenía dónde apoyarse.
4. La ventana de pagos y la de órdenes son una sola por remisión (`B/09` §3): R18 suma dos plazos
   de esa familia, no tres.
5. Anclar una línea larga editada en la continuación de la siguiente la vuelve más larga que 100:
   conviene cortar al terminar cada inserción.

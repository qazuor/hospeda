---
title: "Revisión del owner · aplicación, tanda 1: la simplificación"
linear: HOS-1352
statusSource: linear
created: 2026-09-28
updated: 2026-09-28
status: CURRENT
fase: 9
---

# Revisión del owner · aplicación, tanda 1: la simplificación

C8 (las verticales no se discontinúan), C2 con L3-a y L3-b (sin convivencia, el script suelto del
corte y el congelamiento de `staging`) y la parte de avisos de C12 (el sistema no avisa nada del
corte), de [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md). Medido y editado en el
worktree `hospeda-spec-hos-1352-billing-redesign`, sin commits, sobre el mapa de
[`02-impacto-cobro-y-proceso.md`](./02-impacto-cobro-y-proceso.md) § C2 y § C8. Es la primera
tanda de esta revisión: no había registros anteriores que leer. `B/` es `HOS-1354…/docs`, `V/` es
`HOS-1353…/docs`, `D/12` es el contrato, `D/16` la FASE 7 del paraguas y `nucleo/` el núcleo.

**Forma**: donde salió un mecanismo entero, la sección quedó reducida a su título tachado y una
línea tachada con lo que decía, más la causa. En el resto, tachado y fechado
`(revisión del owner, 2026-09-28, C8)`. Los números retirados (`S25`–`S28`, `D14`, el hecho 4, la
acción 16) **no se reusan**: quedan en su tabla como fila tachada, para que ninguna cita a
`S29`–`S36`, a `D15`–`D17` o a los hechos 5 y 6 cambie de sujeto.

## 1. Qué se aplicó

### C8 · el contrato

- La subsección entera, reducida a una línea:
  `D/12:573` «Discontinuar una vertical queda **fuera de esta versión; si algún día hace falta, se diseña entonces**»
- La firma pierde `situaciónDeVertical` y `finDeServicio`, y la dirección de ida se queda sin
  pregunta: `D/12:1048` «verticales no le pregunta nada a billing»
- El recuento de entradas y campos, con script sobre el bloque:
  `D/12:1144` «**Son seis entradas: cinco preguntas y una operación**»
- Ninguna columna que crear: `D/12:1160` «**Ninguna columna que esto obligue a crear**»
- La regla de vigilancia pierde la exención por nombre:
  `D/12:1210` «la acción que la tenía, discontinuar una»
- La sucesión durante la ventana: diez transiciones pasan a nueve, sin `S27`:
  `D/12:449` «y sale `S27`»
- `D/12:536` «**siete de los nueve casos; las excepciones son dos**»

### C8 · el núcleo

- El hecho 4 sale de la lista del reloj; la lista queda en cinco y **el número 4 queda vacío**:
  `nucleo/01:57` «El número 4 queda vacío y los demás conservan el suyo»
- `nucleo/01:50` «cinco hechos que reinician la inactividad, más la escritura única del corte»
- Su ejecutor, reducido a una línea: `nucleo/01:176` «Sale con el hecho 4 (revisión del owner, 2026-09-28, C8)»
- La cortesía diferida pierde el alta nueva y el inventario pierde dos filas (7 y 8):
  `nucleo/01:782` «sin `S25` no hay cortesía diferida esperando un alta nueva, sólo una sucesora»
- `D14` retirado y el reparto recontado:
  `nucleo/04:141` «**retirado** (revisión del owner, 2026-09-28, C8): las verticales no se discontinúan. El número no se reusa»
- `nucleo/04:321` «**Recorrido otra vez el 2026-09-28, al retirar `D14`**»
- Los pares con dos filas pasan de cuatro a tres:
  `nucleo/03:89` «dos destinos distintos que el diseño declara hoy son ~~**cuatro**~~ **tres**»
- El catálogo de correos pierde la pausa alcanzada por la discontinuación y las condiciones de
  `admite_altas`: `nucleo/07:244` «no hay pausa alcanzada por un cierre ni `S25` que la termine»
- La acción 16 sale del catálogo y la tabla vuelve a quince:
  `nucleo/08:171` «**La tabla tiene QUINCE filas** (revisión del owner, 2026-09-28, C8»
- El motivo 15 se renombra: `nucleo/08:210` «**`COMPLEMENTO_CON_PERÍODO_COBRADO_POR_REVOCACIÓN`**»
- `nucleo/00:102` «53 invariantes (revisión del owner, 2026-09-28, C8: sale `D14`)»

### C8 · billing

- `B/10` §4 entero, reducido a una línea, y lo que queda de él pasa a un §3.6:
  `B/10:147` «**Sacado entero** (revisión del owner, 2026-09-28, C8)»
- `B/10:129` «**Retirar todos los planes de una vertical sigue siendo posible, y no la cierra.**»
- Su NO cierra: `B/10:168` «algún día hace falta, se diseña entonces** (§4). Lo que sí existe es retirar todos sus planes»
- `S25`–`S28` retiradas en la tabla, con su número:
  `B/03:175` «**retirada** (revisión del owner, 2026-09-28, C8): las verticales no se discontinúan. El número no se reusa»
- Las dos secciones que las explicaban, reducidas: `B/03:935` «**Salen enteras** (revisión del owner, 2026-09-28, C8)»
- `S1` pierde `admiteAltas`: `B/03:151` «(La guarda `admiteAltas` salió con la revisión del owner, 2026-09-28, C8: las verticales no se discontinúan.)»
- `S9` pasa a dos disparadores:
  `B/03:159` «**dos disparadores, un mismo acto** (revisión del owner, 2026-09-28, C8: el tercero era de la discontinuación)»
- El motivo 15 deja de partir el disparador 2 de `S21`:
  `B/03:1281` «**14** · `…_POR_OTRA_CAUSA`: ya no se parte (revisión del owner, 2026-09-28, C8)»
- Sus NO cierra: `B/03:2933` «quedan como historia, porque **el acto ya no existe**»
- `vertical_discontinuation` sale:
  `B/02:32` «las verticales no se discontinúan, y la pregunta `finDeServicio` que contestaba salió del contrato»
- `B/14` §4.6 entero: `B/14:636` «**Sale entero**»
- Las puertas del barrido pasan de dieciocho a quince, y la salvedad 4 a doce:
  `B/09:209` «~~**dieciocho**~~ **quince** puertas a un estado terminal»
- La orfandad del addon: catorce transiciones pasan a once:
  `B/16:742` «**las once** (revisión del owner, 2026-09-28, C8: salen `S25`, `S27` y `S28`)»
- Las superficies 14, 14-bis y 20 salen, y el acto a medias del panel:
  `B/19:127` «el sistema no manda avisos de un acto que no existe»
- `G-R1-A` y `G-R1-C`: `B/20:173` «`S25` salió, y `G-R1-C`»
- La unidad `B12`: `$B/descomposicion.md:138` «**la discontinuación salió entera**»
- Las dependencias entre épicas pasan de doce a once (la fila 13 se tacha):
  `$B/descomposicion.md:343` «**Tachada** (revisión del owner, 2026-09-28, C8): la pregunta salió del contrato»

### C8 · verticales

- `vertical.admite_altas` sale: `V/02:46` «(`admite_altas` salió con la revisión del owner, 2026-09-28, C8: sólo la escribía el acto de discontinuar)»
- La fila de invalidación del caché por el fin de servicio de la vertical:
  `V/02:607` «no hay fin de servicio de una vertical que invalide sus entradas»
- Su NO cierra: `V/02:896` «**Discontinuar una vertical** (`M-SUB-03`; revisión del owner, 2026-09-28,»
- `T1` y `T3` pierden la condición; la sección del día del fin de servicio sale entera:
  `V/03:1283` «vertical, ni hecho 4, ni invalidación de la vertical entera»
- La acción 16 sale de la autorización, con su excepción de sistema:
  `V/17:444` «**Sin excepción** (revisión del owner, 2026-09-28, C8)»
- Y su NO cierra: `V/17:638` «No hay acción administrativa que la haga, ni permiso»
- La superficie 29 queda como la única de la vertical sin planes: `V/19:76` «(las verticales no se discontinúan: revisión del owner, 2026-09-28, C8)»
- `V/descomposicion.md`: las filas de la mitad de verticales, de la acción 16 y del día del fin de
  servicio salen: `$V/descomposicion.md:380` «la invalidación, leyendo la fecha por `finDeServicio`~~»

### C2, L3-a y L3-b · la FASE 7 del paraguas

- `coexistence` y `feature flags` cerrados como inexistentes:
  `D/16:46` «**no existe, por decisión** (revisión del owner, 2026-09-28, C2)»
- `D/16:48` «**no existen, por decisión** (revisión del owner, 2026-09-28, C2): ningún interruptor»
- La regla del borde y el apuntado de la URL no son interruptores:
  `D/16:129` «**Y la regla del borde no es un interruptor**»
- La herramienta del corte es un script suelto:
  `D/16:273` «**un script suelto, fuera de los dos sistemas**»
- `D/16:279` «**Arma la lista de a quién avisa el owner**, en sólo lectura»
- `D/16:282` «**se archiva terminado el corte**»
- El 1a y el 1b los hace el script: `D/16:130` «**el script del corte** (revisión del owner, 2026-09-28, L3-a)»
- `EX-42` mide la llamada del script y no el `expire` de qzpay:
  `D/16:128` «**la llamada del script del corte, directa a la API del proveedor**»
- Cae el argumento de que el código que sabe cancelar se va con el despliegue, y el orden se
  sostiene por el cobro sin asiento: `D/16:190` «**El orden se sostiene igual por la otra razón, la del §4.1**»
- El congelamiento, §4.4 nuevo: `D/16:414` «**Desde que entra, `staging` queda congelado para `main` hasta el corte.**»
- `D/16:417` «**Los arreglos urgentes van a `main` como hoy**»
- La cuenta del §5: `D/16:436` «**Dos de los seis ítems huérfanos**»
- `B/09` y `B/21`, sobre la lápida: `B/21:247` «**la del script del corte en el paso 1b**»

### C12, sólo avisos

- `D/16:216` «**el sistema no manda ningún aviso del corte**, ni previo ni del día»
- `D/16:219` «**Y se le recuerda al owner cuando se acerque la fecha del corte**»
- El correo registrado en el manifiesto sale:
  `D/16:256` «**Sin correo del sistema** (revisión del owner, 2026-09-28, C12)»
- El guion lo dice el owner en persona: `D/16:235` «el owner le dice a cada persona, en persona»

**Lo que no toqué**: el contenido del guion (puntos 1 y 2), la tabla de nacimiento, `PB1` y todo lo
demás de C12 (tanda 2); el catálogo de producción como migración única (`L1-e`); la migración de
un plan retirado (C15); las notas N.

## 2. Conteos que cambiaron

Recontados sobre la tabla o la lista, no restados.

| qué | antes | ahora | espejos corregidos |
|---|---|---|---|
| transiciones vivas de la Suscripción | 36 | 32 (`S25`–`S28` retiradas con número) | `$B/descomposicion.md` §2 |
| pares `(desde, evento)` con dos filas | 4 | 3 | `nucleo/03`, `B/03` (cinco lugares), `V/03` (tres), `V/20`, `V/descomposicion.md` |
| filas con `desde` de conjunto en `B/03` §3 | 8 | 5 | `B/03` |
| transiciones que sacan a la predecesora de la declaración | 10 | 9 | `B/03`, `B/20`, `D/12` (dos), `$B/descomposicion.md` |
| salidas de `SUSPENDED` | 5 | 4 | `B/03` |
| salidas de `PAUSED` (otras que `S10`) | 7 | 6; terminales 6 → 5 | `B/03` (dos), `B/09` |
| filas que cancelan en el proveedor | 17 | 13 | `B/03` |
| salvedad 4 del barrido | 15 | 12 | `B/03` (tres), `B/09` (tres) |
| puertas a un estado terminal | 18 | 15 | `B/09`, `B/03` (tres), `B/16` |
| transiciones de la orfandad del addon | 14 | 11 | `B/16` (cinco), `B/03`, `B/19` |
| salidas del dominio de `MP3` | 10 | 8 | `B/03` |
| disparadores de `S9` | 3 | 2 | `B/03`, `nucleo/08` |
| consumidores de *«cortesía diferida»* | 11 | 9 | `nucleo/01`, `$B/descomposicion.md` |
| acciones administrativas | 16 | 15 | `nucleo/08` (tres), `V/17` (ocho), `B/03` (seis), `B/19`, `V/spec.md` |
| entradas del contrato §4.1 | 8 (7 + 1) | 6 (5 + 1) | `D/12` |
| campos en consultas | 12 en 4 | 11 en 3 | `D/12`, `V/descomposicion.md` |
| consultas que construye `V2` | 4 | 3 | `V/descomposicion.md` |
| hechos del reloj de retención | 6 | 5 (el 4 vacío) | `nucleo/01` (ocho), `V/02` (siete), `V/03` (tres), `V/20` (seis), `B/20` (dos), `V/descomposicion.md` (dos) |
| invariantes del §3 | 17 | 16; «cincuenta y cuatro» → 53 | `nucleo/04`, `nucleo/00` |
| dependencias entre épicas | 12 | 11 | `$B/descomposicion.md` (título y recuento) |
| filas del panel en `B/19` §6 | 3 | 2 | `B/19` |
| ítems huérfanos pendientes de `D/16` | 4 | 2 | `D/16` (§1 y §5) |

**Lo que no se movió**: los 24 motivos (el 15 cambia de nombre, no de número); las filas de la
matriz (ninguna medía la discontinuación); los guards (ninguno cae entero: cambian los textos de
`G13`, `G-R4`, `G-R6-B`, `G-R1-C` y `G-R1-F`); los seis lectores de `inactiva_desde`.

## 3. Para el log y la matriz (pide OK del owner)

Todos los IDs están grepeados en el log (`01-decision-log.md`) o en la matriz.

1. **`DEC-SUB-015`, `DEC-SUB-018`, `DEC-GRANT-010` y `DEC-ARCH-011`: SUPERSEDED enteras.** Texto:
   *«SUPERSEDED (revisión del owner, 2026-09-28, C8): las verticales no se discontinúan.
   Discontinuar una vertical queda fuera de esta versión; si algún día hace falta, se diseña
   entonces, y este texto queda como punto de partida.»* **Razón**: sus sujetos (la pausada en el
   piso, la suspendida, la cortesía diferida por discontinuación, admite altas y la invalidación de
   la vertical entera) salieron del diseño.
2. **📌 en `DEC-ARCH-006`**: *«El contrato perdió `situaciónDeVertical` y `finDeServicio` (C8); la
   dirección de ida vuelve a no tener preguntas.»*
3. **📌 en `DEC-RF-004` y `DEC-RF-006`**: *«Con C8 el disparador 2 de `S21` ya no se parte y el
   motivo 15 se llama `COMPLEMENTO_CON_PERÍODO_COBRADO_POR_REVOCACIÓN`.»* **Razón**: el nombre
   viejo nombraba la discontinuación, y un enum que nombra un caso inexistente invita a
   construirlo.
4. **📌 en `DEC-RF-008`**: *«dieciséis acciones»* pasa a quince (C8).
5. **📌 en `DEC-DATA-002`** (y **`DEC-DATA-004`** si nombra la lista): el hecho del fin de
   servicio sale de la lista del reloj; quedan cinco, con el número 4 vacío.
6. **📌 de texto en `DEC-ADDON-004` y `DEC-SUB-013`**, que nombran `S26`/`S28` en
   enumeraciones.
7. **📌 en `DEC-OBS-001`**: su resumen ya no lleva la acción 16 (`V2-s`).
8. **📌 en `DEC-ARCH-007`**: *«cómo se integra sin activar»* se contesta: no se activa nada; la
   épica vive en la rama del paraguas y entra a `staging` al final, con `staging` congelado para
   `main` hasta el corte (C2, L3-b; `D/16` §4.4).
9. **📌 en `DEC-MIG-001` punto 5** (*«cómo se convive durante el rewrite»*): no se convive (C2).
10. **Las decisiones de `29-fase-8-vuelta-2/24-decisiones-del-owner-verificacion.md` que caducan**:
    enteras `V2-g`, `V2-h`, `V2-i`, `V2-n`, `V2-s` y `V2-z1`; a medias `V2-d` (la mitad de `S26`;
    la selección de `S32` en `S11` sigue) y `V2-x` (`PB9` esperando el hecho 4). El registro es
    histórico y no lo edito: propongo que la tanda que cierre la revisión deje una nota de
    caducidad al pie.
11. **Matriz, `EX-42`**: reformular la pregunta de *«¿El `expire` de qzpay vence…?»* a
    *«¿La llamada del script del corte, directa a la API (`expiration_date_to` = ahora), vence una
    `Preference` de Checkout Pro, y la relectura lo confirma?»* **Razón**: L3-a, el script no usa
    qzpay. No cambia el estado ni el conteo de la matriz.

## 4. Casos vecinos (piden decisión, no los decidí)

1. **El correo de baja del sistema viejo en el paso 1b.** Cuando el script cancela, el webhook viejo
   recibe cada cancelación y **manda su correo de baja**: es un correo automático el día del corte,
   y C12 dice que el sistema no manda ningún aviso. Suprimirlo exige tocar código del viejo (C2 lo
   prohíbe) o apagar su webhook antes del 1b (y entonces nadie registra un cobro en vuelo). Lo dejé
   escrito como estaba, con remisión acá.
2. **La constancia de que la pérdida se avisó.** El correo registrado en el manifiesto era la única
   evidencia de `G1-4` (*«lo pagado en el viejo se pierde»*). Sin correo del sistema no queda
   registro: ¿el owner anota a quién llamó y cuándo, en la misma lista del script?
3. **Dónde vive el script.** La decisión dice *«fuera de los dos sistemas»*; no dice si va
   versionado en el repo (`scripts/cutover/`, como proponía el informe) o fuera, ni qué es
   *«archivar»*. Escribí sólo lo decidido.
4. **Si el §4.4 cierra `rollout`.** Lo dejé como *«en lo que el §4.4 no cubra, sigue pendiente»*.
5. **La numeración de los hechos.** El artifact dice *«cinco hechos»* y *«el quinto: levantar una
   moderación»*; el repo conserva los números 5 y 6 con el 4 vacío, para no mover unas sesenta
   citas. Si el owner quiere renumerar, es una pasada mecánica aparte.
6. **`M-SUB-03`** sigue en el frontmatter de `B/10` como *«cierra»*: lo cierra ahora por decisión
   (fuera de esta versión), y así lo dice el §4.

## Key Learnings

1. Sacar un mecanismo toca más conteos que texto: veintidós listas cerradas se movieron por cuatro
   transiciones, una acción y un hecho.
2. Retirar con número (sin renumerar) mantiene estables las citas de las filas vecinas.
3. Tachar un párrafo que ya tenía tachados adentro rompe el markdown: se reduce a una línea tachada
   nueva y se deja la causa.

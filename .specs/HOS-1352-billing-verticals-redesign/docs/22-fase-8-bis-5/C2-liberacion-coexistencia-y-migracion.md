---
title: "FASE 8-bis-5 · C2 — liberación, coexistencia y migración del conjunto"
linear: HOS-1352
statusSource: linear
created: 2026-09-22
updated: 2026-09-22
status: CURRENT
fase: 8
---

# FASE 8-bis-5 · C2 — liberación, coexistencia y migración del conjunto

Sexta pasada sobre el **conjunto**. No ataco ninguna de las dos mitades: ataco si este programa,
**como programa**, se puede empezar, se puede liberar por partes, puede convivir con el sistema que
reemplaza y tiene vuelta atrás.

**Once hallazgos: 1 `CRITICA`, 6 `ALTA`, 3 `MEDIA`, 1 `BAJA`.**

**Vuelvo a tener un `CRITICA` después de una vuelta sin ninguno, y conviene decir por qué**: la
tanda pasada cerró mi defecto más viejo —los guards sin unidad, que venía llegando tres vueltas—
repartiendo los catorce, y al hacerlo **abrió el documento que reparte trabajo cuatro veces sin
mirar el § que declara cuántas dependencias hay entre las dos épicas**. Ese § sigue diciendo *«dos,
y ninguna más»* desde el 2026-09-18, y el contrato declaró su **dirección inversa** —siete campos
en tres preguntas, que el propio contrato llama *«el acoplamiento real entre las dos épicas»*— el
**2026-09-19, al día siguiente**. Hoy esas tres preguntas tienen **cero apariciones** en los cuatro
documentos que reparten el trabajo, y una de ellas es la que decide, con las palabras del contrato,
*«qué se le cobra a alguien y qué día»*.

**Y esta vuelta tiene un hallazgo que ninguna anterior podía producir**: una línea de rastro que es
falsa hoy, con archivo, línea y cita (`F-8fC2-002`). El §"Líneas de rastro que ataqué" del final
dice cuántas revisé y cuáles resultaron falsas.

La reejecución de mis 9 hallazgos de la 8-bis-4 está en la **§4** y **no cuenta como hallazgos
nuevos**: **1 corta, 8 siguen llegando** (dos de ellos peor que la vuelta anterior, uno mejor).

**Límites declarados.**

1. **Mediciones del repo: 2026-09-22**, sobre el worktree
   `hospeda-spec-hos-1352-billing-redesign`, rama `spec/HOS-1352-billing-verticals-redesign`,
   **`HEAD = 0f46a7ede`**, con los seis informes de A y B de esta fase ya en el árbol y nada más.
   **Nunca sobre `/home/qazuor/projects/WEBS/hospeda2/`.** La tanda que reviso es
   `5ac5e92c9~1..90e4b326f`, **76 commits**, contados por mí con `git log --format=%h`.
2. **No vuelvo sobre la población de producción por ningún ángulo.** `DEC-MIG-004` la cerró con
   causa y es la **quinta** pasada que la puede redescubrir. Leí el §4 de las instrucciones antes de
   escribir una línea sobre migración. **Ninguno de los once hallazgos de abajo depende de cuántos
   usuarios hay en producción, de si alguno ya pagó, de si la cohorte crece, ni de qué pasa con
   `PB2` la mañana del corte.** Donde toco el corte, lo que ataco es el **texto del procedimiento**,
   no la población.
3. **No relitigo** las doce decisiones nuevas del §3 de las instrucciones, ni
   `DEC-ARCH-004/005/006/007`, `DEC-MIG-002/003/004`, `DEC-RF-002/003`, `D-26` ni `D-28`. Ataco si
   el **mecanismo** elegido cumple, y si los documentos que no las nombran quedaron consistentes.
4. **`DEC-MP-003` y `DEC-MP-004` sin implementar NO es hallazgo mío**, y lo verifiqué antes de
   escribir: `rg -l "PROVIDER_DUNNING"` fuera de los informes devuelve **sólo el decision log**.
   Lo que sí reporto (`F-8fC2-006`) es lo que el §4 de las instrucciones deja explícitamente
   abierto: que el espejo con `CUSTOMER_REQUEST` **rompa algo más** que lo que la propia decisión
   enumera, y que la lista de consumidores a recorrer que la decisión escribe **omita una salida de
   `PAUSED` que su propia tanda creó dos días antes**.
5. **El núcleo es de `C1`.** Lo marco `NUCLEO` donde aparece.
6. **No cito un número que no medí.** Cuando un número viene de otro lado —de las instrucciones,
   de un rastro, de un informe— digo de dónde y, si lo remedí, doy el mío al lado.

---

## 1. Tres mediciones mecánicas que deciden dónde miré

### 1.1 El documento del corte: cero de 76 commits, uno de 1.030 líneas de rastro

La medición que abre mi vector desde la 8-bis-3, rehecha con la tanda nueva:

| medición | comando | resultado |
|---|---|---|
| commits de la tanda que tocan `16-fase-7-del-paraguas.md` | `git log --oneline 5ac5e92c9~1..HEAD -- 16-fase-7…` | **0 de 76** |
| último commit que lo tocó | `git log -1 --date=short -- 16-fase-7…` | **`e6f4ff3a7`, 2026-09-20** |
| líneas del rastro por aparición que lo nombran | `rg -n "^### \`?16-fase-7" 21-fase-9-bis-4/*.md` | **1 de 1.030** |
| apariciones de los términos que la tanda define, sobre el corte | `rg -oc` de los 13 términos nuevos | **0 · 0 · 0 · 0 · 0 · 0 · 0 · 0 · 0 · 0 · 0 · 0 · 0** |

Los trece términos: `inactiva_desde`, `G-R6`, `S24`, `S25`, `reconciliation_mark`, `revocado_en`,
`PROVIDER_DUNNING`, `pasarela`, `Mobbex`, `Mercado Pago`, `capítulo 13`, `B6`, `PRUEBA 0`. **Los
trece dan cero.**

**La línea única del rastro es `rastro-8f9f31ac0.md` L189-192**, y dice: *«**L115 · §4.2** — «si
alguno no se pudo cancelar, el corte no avanza» → sigue correcta»*. Es una frase que **ningún
arreglo de esta tanda redefinió**. Cuatro vueltas seguidas midiendo lo mismo, y ahora con el
instrumento nuevo: **una regla de resolución por aparición, ejecutada sobre 1.030 apariciones, tocó
el documento que describe la noche irreversible del programa exactamente una vez, sobre una frase
que no cambió.**

### 1.2 Los cuatro documentos que reparten trabajo, y qué NO aparece en ellos

`rg -c` sobre `HOS-1353/spec.md`, `HOS-1354/spec.md`, `HOS-1353/descomposicion.md` y
`HOS-1354/descomposicion.md`:

| término | apariciones en los cuatro | qué es |
|---|---|---|
| `situaciónDeVertical` · `políticaDePlan` · `direcciónDeCambio` | **0 · 0 · 0** | las tres preguntas de la **dirección inversa del contrato** (§4.1) |
| `inactiva_desde` | **1** (`V/descomposicion` §2.5) | la columna que decide el borrado irreversible |
| `G-R` (cualquier R-guard, por su id) | **56** | era **0** en la 8-bis-4 — es el reparto de la quinta enmienda |
| un id de guard dentro de un **criterio de terminación** (§4 de cualquiera de las dos) | **0 de 29** | lo mide `F-8fC2-003` |

La fila 3 es la buena noticia de la tanda y cierra mi `F-8eC2-004`. La fila 1 es
`F-8fC2-001`. La fila 4 es lo que la fila 3 no compró.

### 1.3 Las preguntas abiertas, contadas por mí

Las instrucciones dicen *«cuatro rastros tienen un § de preguntas para el owner»*. **Lo conté y son
nueve**, con `rg -n "^## .*[Pp]ara el owner" 21-fase-9-bis-4/*.md`, y los ítems numerados dentro de
cada uno suman **30** (`awk` sobre el rango de cada sección). Más **3** en las dos
`descomposicion.md` (`V/desc` §2.8, `B/desc` §2.9 puntos 1 y 2): **33**.

**Los dos registros del programa que existen para esto dicen cero.** `01-decision-log.md`, tabla
resumen: *«| **Preguntas del owner abiertas** | **0 de 25** |»*. `04-open-decisions.md`,
`updated: 2026-09-15`, último commit `ee6f82544` del 2026-09-19 —o sea **anterior a la tanda**—:
*«**0 de las 25 preguntas de FASE 1A abiertas**»*. Es `F-8fC2-007`.

---

## 2. Hallazgos

## CRITICA

### F-8fC2-001 — La dirección inversa del contrato no la construye ninguna de las 22 unidades: la regla que decide «qué se le cobra a alguien y qué día» vive en la ÚLTIMA unidad del programa, el cambio de plan lo construye la octava, y el documento que reparte sigue declarando que entre las dos épicas hay dos dependencias y ninguna más

**Qué se rompe.** La unidad que construye el cambio de plan —`B8`— llega sin ninguna forma
declarada de saber si un cambio **sube o baja**, que es lo que decide si el monto se muta ya, si las
capacidades caen al fin del ciclo y si el excedente se avisa antes de tocarlo. La regla que lo
contesta vive en un capítulo de **`B12`, la última unidad del camino crítico**, y la consulta que la
vuelve evaluable sin romper el corte —`direcciónDeCambio(versiónOrigen, versiónDestino) → SUBE |
BAJA`— **no existe en ningún documento de implementación de ninguna de las dos épicas**. Lo único
que `B8` tiene a mano en su momento es el `rank`, y el diseño ya escribió qué pasa con eso: *«al
cliente **se le recorta algo en silencio mientras se le cobra como mejora**»*.

**El camino.**

1. **El contrato declara la dirección inversa y la llama por su nombre.**
   `12-contrato-de-cobertura.md` §4.1: *«El §4 enumera con cuidado lo que billing **empuja** a
   verticales, y **nunca declaró lo que billing LEE**. **Ése resultó ser el acoplamiento real entre
   las dos épicas**»*, con su bloque de tres preguntas:

   ```text
   políticaDePlan(versiónDePlan)  → { díasDeGrace, díasDeTrial, permitePausa, vigente, vendible }
   situaciónDeVertical(vertical)  → { admiteAltas, finDeServicio }
   direcciónDeCambio(versiónOrigen, versiónDestino) → SUBE | BAJA
   ```

2. **Y dice, textual, qué decide la tercera.** Mismo §4.1: *«la única regla que decide **qué se le
   cobra a alguien y qué día** exigía que billing leyera exactamente lo que el §4 prohíbe cruzar,
   dos veces, por escrito»*, y *«La comparación la hace verticales, que es dueño de las tablas, y
   billing recibe un **VEREDICTO**»*.
3. **Ninguna de las 22 unidades lo construye, medido.** `rg -c "direcciónDeCambio|situaciónDeVertical|políticaDePlan"`
   sobre todo el corpus de diseño, excluidas las cinco carpetas de informes de fase, devuelve
   **tres archivos**: `12-contrato-de-cobertura.md` (3), `03-handoff.md` (2) y `01-decision-log.md`
   (1). **Cero en los dos `spec.md`, cero en las dos `descomposicion.md`, cero en los 24 capítulos
   de las dos épicas y cero en el núcleo.**
4. **La regla que la tercera pregunta encapsula vive en `B12`, la última unidad.**
   `B/10` §3.5: *«**La dirección se deriva del delta entre las dos versiones, no del `rank`**: si
   algo baja —un limit, un entitlement, una cuota— el cambio sigue el camino de downgrade
   (`DEC-SUB-008`) … si nada baja, sigue el camino de upgrade (`DEC-SUB-007`): inmediato. **Cualquier
   baja manda.**»* Y `B/descomposicion.md` §2: *«| **B12** | **El catálogo que se retira** | … | `10`
   **entero** | — |»*, con el grafo del §3 poniéndola al final del camino crítico:
   `B1 → B3 → B5 → B7 → B8 → B9 → B10 → B13 → **B12**`.
5. **El cambio de plan lo construye `B8`, cinco unidades antes, y su columna de capítulos no
   contiene el `10`.** `B/descomposicion.md` §2: *«| **B8** | **Los cambios del compromiso** |
   cambiar de plan, de ciclo, pausar y darse de baja … | `03` §5, S8–S12, **S17–S18** · `12` §2, §3,
   §6, §7 · `02` §2.6 · `05` C2, C4 |»*. Lo verifiqué contra `B/12`: `rg -n` de
   *«la dirección se deriva»*, *«es upgrade o downgrade»* y *«cualquier baja manda»* sobre
   `12-suscripcion.md` devuelve **cero**. La regla no está en ningún capítulo de `B8`.
6. **Y el criterio de terminación de `B8` no la pide.** `B/descomposicion.md` §4: *«un downgrade
   encima de otro **vuelve a preguntar** qué conservar; un aumento cuya fecha cae sobre una pausada
   se aplica en el primer cobro posterior a la reanudación …»*. **Presupone que ya se sabe cuál es
   un downgrade y nunca pregunta cómo se decidió.**
7. **El documento que reparte declara que esto no puede existir.** `B/descomposicion.md` §2.6,
   titulado *«Las dos dependencias con la otra épica, y las dos son tempranas»*: *«**B2** no puede
   existir sin `plan_version`, que es `V2` … La segunda dependencia es la de **B4** sobre `V4` …
   **Esas dos, y ninguna más. Si aparece una tercera, es la señal del contrato §4: el corte se está
   filtrando, se mira y no se resuelve en el lugar.**»*
8. **Y hay al menos cuatro más, todas por la dirección inversa.** `díasDeGrace` lo lee el reloj del
   grace (`B7`); `permitePausa` lo lee la pausa (`B8`); `finDeServicio` lo lee la guarda de `S25`
   —*«el plan al que la fila está anclada ya NO se presta»*, `B/03` §3.2, que es de `B8`—;
   `admiteAltas` y `vigente`/`vendible` los lee el retiro y la discontinuación (`B12`). **Las siete
   columnas que la dirección inversa transporta son de `V/02` §2.1, que construye `V2`.**
9. **El orden de las fechas es lo que lo explica y no lo disculpa.** `git log -S` sobre las dos
   frases: la §2.6 la escribió **`2805d72ea`, 2026-09-18**; la §4.1 del contrato la escribió
   **`4f34afa1a`, 2026-09-19**, *al día siguiente*. **El acoplamiento se declaró el día después de
   que se declarara que no existía, y en cuatro días nadie cruzó los dos documentos.**
10. **La tanda abrió el archivo cuatro veces y le insertó 125 líneas justo debajo.**
    `git log --oneline 5ac5e92c9~1..90e4b326f -- B/descomposicion.md` → `2011e2676`, `0307d99c5`,
    `70d83299d`, `3310c9376`. Y `git diff --unified=0` sobre ese archivo da un hunk
    `@@ -275,0 +281,125 @@` —los §2.8 y §2.9 enteros, que son el reparto de los guards y las dos
    preguntas abiertas—: **se insertaron veinticinco renglones debajo del §2.6 y el §2.6 no está en
    ningún hunk.**

**Dónde lo permite el diseño.**

- `HOS-1352/docs/12-contrato-de-cobertura.md` §4.1 (las tres preguntas, el veredicto y la frase
  *«qué se le cobra a alguien y qué día»*) y §4.2 (la regla de vigilancia, que cubre **lecturas** y
  no constructores).
- `HOS-1354/descomposicion.md` §2 (filas `B8` y `B12`), §2.6, §3 (el camino crítico) y §4
  (criterio de `B8`).
- `HOS-1354/docs/10-verticales-planes-billing-options.md` §3.5 · `HOS-1353/docs/02-modelo-de-datos.md`
  §2.1 (las siete columnas, de `V2`).
- Medición propia: los `rg -c` del paso 3, el `rg -n` del paso 5, `git log -S` del paso 9 y
  `git diff --unified=0` del paso 10.

**Severidad.** `CRITICA`, y lo sostengo con la frase del propio contrato: la pieza sin constructor
es *«la única regla que decide qué se le cobra a alguien y qué día»*. El desenlace concreto no es
hipotético porque el diseño ya lo escribió al descartar la alternativa: derivar la dirección del
`rank` hace que *«un plan más caro pueda bajar un límite al rediseñarse, y entonces al cliente **se
le recorta algo en silencio mientras se le cobra como mejora**»* — y el excedente que el camino de
downgrade avisa antes de tocar, el de upgrade **no lo contempla**, así que la ficha cae sin aviso.
Es plata y es contenido abajo, por el mismo hueco.

**¿Es nuevo, o es el arreglo?** **En su origen no es de esta tanda**: la §2.6 es del 2026-09-18 y la
§4.1 del contrato del 2026-09-19. **Lo que esta tanda agrega es que es la primera que abrió
`B/descomposicion.md` con el mandato explícito de repartir trabajo que nadie había repartido** —la
quinta enmienda de `DEC-TEST-001`, que barrió los catorce guards sin unidad— y que en ese barrido
**el criterio fue *«qué capítulo declara alguna unidad»* y no *«qué pieza no declara ninguna»***.
Las §2.8 y §2.9 que el barrido escribió listan tres cosas sin dueño; **la dirección inversa no está
entre ellas.**

**¿Lo habría encontrado el grep?** **Sí, y con el término de la propia enmienda.** El barrido de
`40b922120` declara haber grepeado *«lo construye `B3`/`B7`/`B8`/`V2`/`V3`/`V4`/`V5`»* y *«el
reparto»* sobre **51 archivos**. Ninguno de los dos alcanza, porque la dirección inversa no tiene
guard ni unidad que la nombre. **El que sí llegaba es el nombre de la pieza**:
`rg "direcciónDeCambio"` sobre esos mismos 51 archivos devuelve **tres**, y ninguno es un documento
que reparta trabajo — que es exactamente la forma de un hueco, no de una aparición mal resuelta.
**No estaba en la lista de términos de ninguno de los diez rastros** (lo verifiqué con
`rg -c "direcciónDeCambio|dirección inversa" 21-fase-9-bis-4/*.md` → **0**).

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y cae en el tercer desenlace del §1.4:
no está en ningún rastro y no debía estar.** La §2.6 tiene **cero** apariciones de cualquier término
que la tanda redefinió, así que no es *«una aparición no corregida»*: es **un párrafo que afirma un
conteo sobre un conjunto cuyos miembros no nombra**, que es la misma forma de `F-8dC2-005` y de
`F-8eC2-007`. Y la ausencia del constructor **no es una aparición de nada**: es una fila que falta en
una tabla de 13 filas. La obligación 2 recorre apariciones; **una afirmación cuantificada
(*«dos, y ninguna más»*) y una fila ausente son las dos clases que la enmienda no puede ver por
construcción, y acá están juntas en el mismo defecto.**

---

## ALTA

### F-8fC2-002 — Línea de rastro FALSA: `rastro-f21d5d828.md` certifica «las cuatro siguen correctas» sobre cuatro tramos de la partición, y uno de los cuatro es el §3.2 punto 1 —el inventario de lo que no se puede ejercer sin billing—, falso en sus dos mitades; la justificación que da habla sólo de otro de los cuatro

**Qué se rompe.** El §3.2 de la partición es la lista de *«lo que queda inactivo, declarado y no
escondido»*, y existe con una razón escrita: *«para que nadie las descubra como un bug»*. Su primer
ítem es falso en las dos mitades —ni el disparador que enuncia es el que la máquina tiene, ni la
conclusión *«sólo puede vencer»* se sostiene desde que existe `T7`—, y **el rastro por aparición de
la familia más grande de la tanda lo recorrió y lo declaró correcto**, agrupándolo con otros tres
tramos y justificando los cuatro con un argumento que sólo aplica a uno.

**El camino.**

1. **La línea del rastro, textual.** `21-fase-9-bis-4/rastro-f21d5d828.md` **L331-337**:

   > `###`11-particion-del-programa.md`(4)`
   >
   > *«- **L91-96** y **L121-123** y **L139-147** y **L156-180** — el mismo hecho en cuatro lugares,
   > el valor por defecto de `cobertura()`, **lo que queda inactivo** y el reparto capítulo por
   > capítulo → **las cuatro siguen correctas**: la cortesía sigue siendo una de las cuatro fuentes
   > que implementa billing, y **una cortesía diferida no emite**, así que el conteo de fuentes de
   > la partición no se mueve.»*

2. **Qué hay en `L139-147`, contado sobre el archivo con `awk 'NR>=136 && NR<=150'`.** Es el §3.2
   entero, y su punto 1 son las líneas **139-140**:

   > *«1. **El trial nunca convierte.** Las transiciones `T2` y `T5` del capítulo 03 §2 disparan
   > cuando se autoriza una suscripción. Sin billing, un trial sólo puede vencer.»*

3. **La primera mitad es falsa: ése no es el disparador.** `V/03` §2, tabla de transiciones, hoy:
   *«| T2 | `TRIAL_ACTIVE` | **aparece una fuente viva de clase `TÍTULO` que no es la del trial** |
   `TRIAL_CONVERTED` |»* y *«| T5 | `TRIAL_EXPIRED` | **aparece una fuente viva de clase `TÍTULO`** |
   `TRIAL_CONVERTED` |»*. **La frase que la partición cita entre comillas es la columna «antes» de la
   tabla de cambios que el propio capítulo publica.** Eso ya era `F-8dC2-007` y `F-8eC2-002`.
4. **La segunda mitad es falsa: hay una conversión que no necesita billing.** `V/03` §2, fila `T7`:
   *«| T7 | `PRE_TRIAL` | **el encendido: la vertical pasa los días de trial de su plan de trial de
   0 a > 0** | `TRIAL_CONVERTED` | la persona **ya ejerció el hecho que la vertical declara como
   evento de activación** … — **`cubierto` no participa** | **crea la fila de `trial`, consumida**,
   sin reloj y sin campaña |»*. Sus tres patas son de verticales: el evento es una operación del
   catálogo de planes (`V2`), la guarda lee un hecho de dominio de verticales, y la condición
   **excluye expresamente `cubierto`**, que es el único campo que el contrato hace venir de billing.
5. **Y la justificación que el rastro da no toca ninguna de las dos mitades.** *«la cortesía sigue
   siendo una de las cuatro fuentes … el conteo de fuentes de la partición no se mueve»* es un
   argumento sobre **`L121-123`** —*«las **cuatro** de billing (suscripción, cortesía, grant y
   addon) responden que no»*—, que es otro de los cuatro tramos. **Cuatro tramos disjuntos, un solo
   argumento, y el argumento cubre uno.** Es la forma exacta que las instrucciones piden buscar:
   *«está en el rastro y su justificación es falsa»*.
6. **Y el efecto sobre la liberación es lo que lo hace mío.** El §3 entero de la partición es el
   argumento de por qué la épica de verticales se puede construir y probar sola; `V4` es la unidad
   que construye `03 §2` entero y su criterio de terminación dice *«un trial vence de verdad,
   `cobertura()` pasa de sí a no por sí sola, y un segundo trial para el mismo `user + vertical` es
   imposible»* — **ninguna conversión**. Entre el documento que declara la rama inexistente y el
   criterio que no la nombra, `T7` puede llegar al final sin un solo caso escrito.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/21-fase-9-bis-4/rastro-f21d5d828.md` L331-337.
- `HOS-1352/docs/11-particion-del-programa.md` §3.2 punto 1 (L139-140).
- `HOS-1353/docs/03-maquinas-de-estado.md` §2 (`T2`, `T5`, `T7` y la tabla de cambios de
  disparador).
- `HOS-1353/descomposicion.md` §2 (fila `V4`) y §4 (criterio de `V4`).
- Medición propia: `awk` sobre las líneas citadas de los dos archivos, y
  `rg -oc "T2|T5|T7|se autoriza una suscripción"` sobre la partición → **1 · 1 · 0 · 1**.

**Severidad.** `ALTA`. Hay una pérdida sin vuelta —el trial consumido, que `DEC-TRIAL-009` declara
no reparable— pero **el acto que la produce es una decisión tomada**, y lo que yo reporto es que el
documento que declara qué **no** puede pasar dice que no puede pasar, y que el instrumento nuevo del
programa lo certificó. **No lo marco `CRITICA`** porque el daño de `T7` está adjudicado a otros
vectores (`F-8fA1-*` y `F-8fA3-007` lo atacan desde la fila y desde la entidad) y no lo cuento dos
veces; lo mío es **el inventario de lo inactivo y la certificación falsa**.

**¿Es nuevo, o es el arreglo?** **Las dos mitades del defecto son anteriores** —la del disparador es
el arreglo 2 de la 9-bis-2 (`49eb99f34`), la de `T7` es el arreglo 2 de la 9-bis-3 (`1e3c3fc9e`)—.
**Lo que esta tanda agrega es la línea de rastro**, escrita por la familia de la sucesión
(`f21d5d828`), que es el instrumento que `DEC-METH-011` creó para que esto no pasara.

**¿Lo habría encontrado el grep?** **Sí, y el rastro dice haberlo corrido.** Su §"Alcance" declara
*«los **51 archivos** del corpus —las dos épicas con sus `spec.md` y `descomposicion.md`, el núcleo,
el contrato, el corte, **la partición**, el decision log …»*, y efectivamente llegó: **la aparición
está en el rastro**. No falló el barrido; falló la resolución.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Está en el rastro y su justificación es
falsa** — el primero de los tres desenlaces del §1.4, y el que las instrucciones llaman *«el
hallazgo más fuerte que esta pasada puede producir»*. El modo es identificable y vale nombrarlo
porque se puede prevenir: **el rastro agrupó cuatro rangos de línea disjuntos en un solo ítem y les
dio un solo *«siguen correctas»*.** Una resolución por aparición que agrupa apariciones deja de ser
por aparición; el ítem se lee como cuatro verificaciones y es una.

---

### F-8fC2-003 — Los guards sin unidad pasaron de 14 de 29 a 0 de 29 y ninguno de los 29 aparece en un criterio de terminación: la asignación vive sólo en una columna que nada consulta al declarar una unidad lista, y `G-R6` nace en `V4` con su único caso que lo rompe a propósito en `B8`, del otro lado de la pasarela

**Qué se rompe.** El reparto de la quinta enmienda cerró mi hallazgo de tres vueltas y **lo cerró de
verdad**: los 29 guards tienen unidad, medido por mí. Lo que no compró es que alguno se construya.
*«Lo que decide si alguno llega es que una unidad lo construya»* (`B/20` §2), y **lo que decide que
una unidad esté construida es su criterio de terminación**, que es la única pregunta que
`descomposicion.md` §4 define — *«qué pregunta tiene que poder contestar alguien de afuera cuando la
unidad se declara terminada»*. **Ninguno de los 29 guards aparece en ninguno de los 22 criterios.**
Las 22 unidades pueden declararse terminadas, una por una, con cero guards escritos, y el tablero
que *«calcula solo cuáles están listas»* las marcaría verdes.

**El camino, medido el 2026-09-22.**

1. **El reparto es real y lo verifiqué contra las dos tablas, no contra el rastro.** Filas de
   catálogo contadas con `rg -c "^\| \*{0,2}\`?(G-R[0-9]+(-[A-Z])?|G[0-9]+)"` sobre el §2 de cada
   `20-testing.md`: **`V/20` 17 · `B/20` 16 · unión 29** (17 + 16 − 4 referencias cruzadas:
   `G-R4`,`G-R5`,`G-R6`,`G-R6-B`). Columna *guards* de las dos`descomposicion.md`, recorrida
   entera: **29 de 29 asignados**, y los 14 que faltaban aparecen todos. **El conteo`14 de 29 → 0
   de 29` de `B/20` §2 es correcto.**
2. **Y `G-R5` se movió a la unidad que construye el número que compara**, que era la mitad de
   `F-8eC2-004` que no se arreglaba escribiendo una columna: `B/descomposicion.md` §2.8 y el retiro
   de la celda de `V9` en `V/descomposicion.md` §2.7. **Verificado contra las dos tablas.**
3. **Pero ningún criterio nombra un guard.** `rg -o "G-R[0-9]+(-[A-Z])?|G[0-9]+"` sobre el §4
   completo de cada `descomposicion.md` devuelve **cero** en las dos. La palabra *«guard»* aparece
   **una** vez en el §4 de billing y **cero** en el de verticales.
4. **Cinco de los 29 están codificados por su comportamiento y los otros 24 no.** Recorrí los 22
   criterios: `V1` describe `G1` y `G3` (*«agregar una clave al código sin agregarla a la base
   **falla**, y al revés también; y nombrar una vertical sin implementar su ítem del Eje 2
   **falla**»*), `B1` describe `G12` (*«importar el SDK afuera **falla**»*), `B2` describe `G7`
   (*«un monto escrito en código **falla**»*) y `B4` describe `G13` (*«la de arranque **no puede
   llegar a producción**»*). **Los 24 restantes —incluidos los seis de `R1`, `G-R6`, `G-R6-B`,
   `G-R5`, `G-R2`, `G-R2-B`, `G-R3`, `G-R3-B`, `G-R3-C`, `G-R4`, `G-R4-B`, `G5`, `G8`— no tienen
   una sola cláusula que los exija.**
5. **Y el reparto lo sabe, porque escribió la regla contraria dos veces.** `V/descomposicion.md`
   §1.1 regla 1 y `B/descomposicion.md` §1.3 regla 1: *«**Cada guard va con la pieza que protege,
   nunca al final**»*, con su razón: *«un guard que llega después se escribe contra código ya
   escrito, y para entonces hay call sites que lo violan: nace con una lista de excepciones»*. La
   regla dice **cuándo** va; el criterio de terminación es el único lugar donde se podría comprobar
   que fue, y no pregunta.
6. **El caso peor es `G-R6`, y es de esta tanda.** `V/descomposicion.md` §2.6 lo asigna a **`V4`**
   —*«la primera tabla de transiciones del programa»*, *«el lugar que la regla 1 pide»*—. Su caso
   que lo rompe a propósito, que `B/20` §2.1 declara obligatorio (*«**Todo guard de esta lista lleva
   un caso que lo hace fallar a propósito** … un guard que no puede fallar es un comentario con exit
   code 0»*), está escrito en `B/20` §2 y es éste: *«**Se rompe a propósito** sacándole a `S10` la
   escritura que avanza la fecha del próximo cobro (cap. 03 §7.2) … para ponerlo en rojo hay que
   sacarle **los tres** [escritores]»*. **`S10` es de `B8`** (`B/descomposicion.md` §2, fila `B8`:
   *«`03` §5, **S8–S12**»*), y `B8` está en el camino crítico de billing detrás de la bisagra y
   detrás del gate de la pasarela: `B1 → B3 → B5 → B7 → **B8**`. **`V4` es la cuarta de nueve
   unidades de verticales y no tiene gate.** El guard se entrega, se declara `V4` terminada, y su
   única forma de demostrar que puede fallar llega del otro lado de la frontera, meses después.
7. **Es la misma forma del defecto que la enmienda acaba de arreglar, sobre el guard que la enmienda
   acaba de asignar.** `V/descomposicion.md` §2.7, sobre `G-R5`: *«El guard se construiría **antes
   que el número que compara**, y ahí no llega tarde: llega tan temprano que **no tiene contra qué
   fallar**, que es «un comentario con exit code 0»»*. **Cambiá *«el número que compara»* por *«la
   escritura que lo rompe»* y es `G-R6` palabra por palabra.**
8. **Y la ventana de rojo que el reparto declara abierta corre sobre la rama compartida.**
   `V/descomposicion.md` §2.8: *«entre B5 y B8 el guard daría **rojo sobre el camino normal**, que es
   lo que la fila de `G-R1-A` describe como «un guard que alguien va a relajar» … **Queda como
   pregunta para el owner**»*. Las dos épicas se desarrollan **sobre una sola rama de integración**
   (`DEC-ARCH-007`, `11-particion` §6.1: *«las sub-épicas cortan de ella y mergean **a ella**»*), así
   que el rojo de un guard que construyó verticales bloquea los PRs de billing durante tres unidades
   del camino crítico. **Quien lo va a relajar es el equipo que no lo escribió.**

**Dónde lo permite el diseño.**

- `HOS-1353/descomposicion.md` §1.1 regla 1, §2 (columna guards), §2.5, §2.6, §2.7, §2.8 y §4 ·
  `HOS-1354/descomposicion.md` §1.3 regla 1, §2, §2.8 y §4.
- `HOS-1353/docs/20-testing.md` §2 · `HOS-1354/docs/20-testing.md` §2 y §2.1 (la regla del caso que
  rompe, y el caso de `G-R6`).
- `HOS-1352/docs/11-particion-del-programa.md` §6.1 (la rama de integración).
- Medición propia: los conteos de filas del paso 1, el `rg -o` del paso 3 y el recorrido de los 22
  criterios del paso 4.

**Severidad.** `ALTA` — los 29 guards son las defensas estructurales del programa y el reparto los
dejó a todos con dueño y a 24 de 29 sin ninguna cláusula que los exija. No mueve plata por sí solo;
**quita las defensas que impiden que otras cosas la muevan**, y lo hace del modo más difícil de ver:
**el tablero va a decir que está hecho.** Bajo de `CRITICA` porque para llegar al daño hace falta
además que nadie lo note al construir, y bajo el caso de `G-R6` de hallazgo propio porque `F-8fA1-004`
lo ataca desde otro lado (qué columnas lee) y no lo duplico.

**¿Es nuevo, o es el arreglo?** **Es el arreglo, y es la cuarta tanda de guards**: la quinta enmienda
de `DEC-TEST-001`, aplicada en `2011e2676` y sus cuatro hermanos. Antes de ella la pregunta era
*«¿quién lo construye?»* y la respuesta era *«nadie, catorce veces»*; ahora es *«¿cómo se sabe que lo
construyó?»* y la respuesta es *«por ningún lado, veinticuatro veces»*. **La asignación de `G-R6` a
`V4` la escribió esta tanda.**

**¿Lo habría encontrado el grep?** **No, y el propio rastro lo explica sin darse cuenta.**
`rastro-40b922120.md` §4 declara haber grepeado *«lo construye `B3`/…»*, *«el reparto»*, *«sin
unidad»* con el valor 14, y *«14 de 29»* / *«14 de 28»*. **Todos esos términos viven en el catálogo y
en la columna de guards; ninguno vive en un criterio de terminación**, porque un criterio de
terminación no nombra guards — que es exactamente el defecto. **Un barrido por el término del arreglo
no puede encontrar el lugar donde el término debería estar y no está.**

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y cae en el tercer desenlace del §1.4.**
`rastro-40b922120.md` §5 sección F cubre *«Las dos `descomposicion.md`, en los párrafos que la tanda
no tocó (**2 párrafos**)»*, y los verifiqué: **ninguno de los dos es el §4.** No es que el rastro los
resolviera mal: **el §4 no contiene ninguna aparición de ningún término del reparto**, así que no
entra al barrido por construcción. Es el mismo límite estructural que mis `F-8eC2-003` y `F-8eC2-008`
midieron y que `DEC-METH-011` no levantó: **la obligación recorre apariciones, y una cláusula que
falta no es una aparición.** La diferencia esta vez es que el defecto está en el §**contiguo** al que
el arreglo editó.

---

### F-8fC2-004 — Quinta vuelta sin una línea sobre el documento del corte, con el plazo venciendo MAÑANA, con un tercer capítulo delegándole por escrito el rollback del programa, y con su propia tabla del §1 declarando «cero apariciones» de un término que hoy tiene cinco

**Qué se rompe.** La única estrategia de despliegue del programa se pone a sí misma una fecha
límite —*«**Se escribe ANTES de que nazca la rama del paraguas**»*— que `D-28` fija en el
**2026-09-23**. Hoy es el **2026-09-22**. Los 76 commits de la tanda no le agregaron una línea y el
rastro por aparición lo tocó una vez de 1.030. Mientras tanto le llegó un **tercer** encargo escrito
—el rollback del programa entero, que `B/21` §3 declara sobreviviente y dice *«no se escribe acá»*
sin decir dónde— y **la tabla de su §1 quedó falsa**: declara que `rollback` tiene *«cero
apariciones en todo el diseño del programa»* cuando hoy tiene cinco, y una de las cinco es el
encargo que le acaban de hacer.

**El camino.**

1. **La fecha, en los dos extremos.** `16-fase-7-del-paraguas.md` §2: *«**Se escribe ANTES de que
   nazca la rama del paraguas.** La rama todavía no existe —`git ls-remote` devuelve cero— y el
   desarrollo arranca en días»*. `D-28` (`15-fase-9/07-decisiones-del-owner.md` L865-869): *«Plazo:
   **hasta el 2026-09-23**»*, y el `03-handoff.md` L371 lo repite como pendiente del owner: *«**si el
   2026-09-23 no hay respuesta, se arranca a desarrollar contra el proveedor falso igual**»*.
2. **La tanda no lo abrió, y ningún rastro lo recorrió.** Medido en mi §1.1: **0 de 76 commits, 1 de
   1.030 líneas de rastro**, y los **13** términos que la tanda define dan **cero** sobre el archivo.
3. **El tercer encargo, y es de esta tanda por su contexto aunque el párrafo sea anterior.**
   `HOS-1354/docs/21-migracion.md` §3, últimas líneas: *«**Lo único que sobrevive es de otro
   tamaño**: el **rollback del PROGRAMA** —qué se hace si hay que volver atrás el reemplazo entero
   del sistema de cobro— que no es el rollback de ocho filas y **no se escribe acá**.»* Los otros dos
   ya los medí en la 8-bis-4 y **siguen**: `V/21` §2.4 punto 3 (*«**hay que fijarlo en el
   procedimiento del corte**»*, L102) y `B/21` §2.4 (*«el orden entre esta escritura y el paso 4,
   **que hay que fijar en el procedimiento**»*, L139). **Tres capítulos le encargan trabajo por
   escrito a un documento que nadie abre.**
4. **Y la afirmación del §3 del propio corte es falsa hoy, medida.**
   `16-fase-7-del-paraguas.md` §3: *«**el rollback es uno de los seis ítems huérfanos** … que es
   exactamente su estado hasta ahora, con **la palabra «rollback» sin aparecer en un solo documento
   de diseño del programa**»*, y su §1: *«Cuatro de los seis tienen **cero apariciones en todo el
   diseño del programa**: `rollout`, `coexistence`, `feature flags` y **`rollback`**»*.
   `rg -in "rollback"` sobre el núcleo y las dos épicas devuelve **cinco**: `V/21` L50, L57 y L70, y
   `B/21` L203 y L204. **Las dos últimas son el encargo del paso 3**, así que el documento declara
   inexistente justamente el párrafo que le pasa el trabajo.
5. **Los otros cuatro ítems siguen en cero, recontados hoy.** `rg -oi` sobre el núcleo y las dos
   épicas: `rollout` **0** · `coexistence` **0** · `feature flag` **0** · `acceptance gate` **0**.
   Sobre todo el corpus de diseño, **una aparición cada uno**, y la única es la lista del §65 del PDR
   —el enunciado del pedido, no una respuesta—. **Quinta medición consecutiva sin mover un conteo.**
6. **Y el documento sigue sin nombrar lo que hoy decide cuándo se libera.** Medido sobre
   `16-fase-7-del-paraguas.md`: `pasarela` **0** · `Mobbex` **0** · `Mercado Pago` **0** · `capítulo
   13` **0** · `B6` **0** · `PRUEBA 0` **0**. Mientras tanto `B/descomposicion.md` abre con un bloque
   ⛔ —*«**De las trece unidades, nueve llaman a la pasarela**, y ninguna de esas nueve se puede
   terminar sin saber cuál es»*— y `DEC-ARCH-007` obliga a que *«las dos llegan a producción juntas y
   terminadas»*.
7. **Y la frase huérfana del §4.2 sigue palabra por palabra**, que era mi `F-8eC2-001`: *«El aviso va
   ANTES del paso 1, no después … **Las dos escriben filas del esquema nuevo, así que las dos van
   después de desplegar**»*, sobre un párrafo cuyo sujeto son **las llamadas**, que no escriben
   ninguna fila. **No la reporto otra vez como hallazgo propio**: es parte del mismo documento
   intacto y la cuento acá.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/16-fase-7-del-paraguas.md` §1 (la tabla de los diez ítems y la frase de las cuatro
  ausencias), §2 (la fecha), §3 (*«sin aparecer en un solo documento de diseño»*), §4.2 y §4.3.
- `HOS-1352/docs/15-fase-9/07-decisiones-del-owner.md` `D-28` · `HOS-1352/docs/03-handoff.md` L371.
- `HOS-1353/docs/21-migracion.md` L50, L57, L70 y §2.4 punto 3 · `HOS-1354/docs/21-migracion.md`
  §2.4 y §3.
- Medición propia: los conteos del §1.1 y de los pasos 4, 5 y 6.

**Severidad.** `ALTA`, y **la subo desde la `MEDIA` de la vuelta anterior**, con tres motivos
medidos: el plazo pasó de dos días a **uno**; el documento ganó un **tercer** encargo escrito, esta
vez del ítem que él mismo declara el más huérfano de los seis; y **su propio texto contiene ahora una
afirmación falsa** sobre el conteo que sostiene su argumento. Sigue sin mover plata y sin perder un
dato por sí solo, y por eso no es `CRITICA`; el desenlace concreto —un corte sin rollback, sin gates
y sin coexistencia escritos— **ya está declarado con causa** en el §3 del propio documento, que
acepta de antemano que la respuesta pueda ser *«no hay vuelta atrás»*. Lo que agrego es que **la
ventana para que esa respuesta sea una decisión y no una descripción se cierra mañana**.

**¿Es nuevo, o es el arreglo?** **Ni uno ni otro en su mitad principal: es una ausencia, y es mi
`F-8eC2-007` reejecutado.** Lo que **sí** es de esta tanda es el paso 4: la afirmación del §1 y del
§3 se volvió falsa sin que nadie tocara el corte, porque el `B/21` §3 que la falsifica lo escribió la
familia de la migración. **Es el modo que este programa mide desde la 8-bis: una copia no necesita
que nadie la mute para divergir, alcanza con que el otro documento avance.**

**¿Lo habría encontrado el grep?** **No, y la §1.1 lo mide con trece términos.** Los trece dan cero
sobre el corte. El término del encargo nuevo sería *«el procedimiento del corte»* o *«el rollback del
programa»*, que son frases en castellano y no términos del modelo. **Un documento que hace
afirmaciones cuantificadas sobre un conjunto sin nombrar a sus miembros es invisible a una búsqueda
por miembro** — es el mismo enunciado que escribí en `F-8dC2-005` y sigue siendo el resumen del
problema.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y ahora lo puedo contestar con el rastro
en la mano en vez de razonando, que es lo que esta vuelta agrega.** Los diez rastros declaran *«el
corte»* dentro de su alcance —los diez, verificado con `rg -n "el corte, la partición"`—, y entre los
diez produjeron **una sola línea** sobre el archivo (`rastro-8f9f31ac0.md` L189-192), sobre una frase
que ningún arreglo redefinió. **Cae en el tercer desenlace del §1.4: no está en ningún rastro y no
debía estar, porque sobre ese archivo no hay apariciones de nada.** Un arreglo puede cumplir
`DEC-METH-011` al pie de la letra y dejar el documento del corte intacto y vencido — y eso es
exactamente lo que pasó **1.030 veces**.

---

### F-8fC2-005 — `NUCLEO` · El catálogo de correos pasó de trece filas a quince, y la regla de reparto de la partición manda a billing CINCO avisos que construyen unidades de verticales, entre ellos los tres que defienden el borrado irreversible del día 180

**Qué se rompe.** Los tres avisos que le dicen a una persona que su contenido está por borrarse —el
del día 90, el del archivado y el del día 180— más el del excedente y el de la restitución **no son
trabajo de ninguna de las 22 unidades**, y la única frase del programa que los repartiría los manda a
la épica equivocada. El programa puede declararse terminado, con el tablero que *«calcula solo cuáles
están listas»* en verde, sin que exista una sola fila del catálogo de correos — quince momentos, uno
de los cuales el propio núcleo llama *«el que menos se puede suprimir de los tres»*.

**El camino.**

1. **El catálogo tiene hoy quince filas**, contadas con `rg -c "^\| "` sobre el §6 de
   `NUCLEO/07-outbox-y-notificaciones.md` menos el encabezado. Eran **trece** en la 8-bis-4 y
   **once** en la 8-bis-3. Las dos nuevas de esta tanda: *«**restitución tras recuperar cupo**»*
   (`DEC-DATA-003`) y *«**la pausa alcanzada por una vertical discontinuada**»* (`DEC-SUB-015`).
2. **La regla de reparto no se movió.** `11-particion-del-programa.md` §4, fila 07: *«| 07 | outbox y
   notificaciones | **PARTIDO** — el mecanismo es compartido; del catálogo de correos, **los dos del
   trial a verticales y el resto a billing** |»*. Es una regla **por exclusión**, así que las trece
   filas que no son *«del trial»* caen del lado de billing.
3. **Y al menos cinco de esas trece las construye una unidad de verticales**, recorrido el catálogo
   fila por fila contra las dos `descomposicion.md`:
   - *«**excedente por downgrade**»* → lo produce el reconciliador de `V/15` §4, que construye **`V6`**;
   - *«**restitución tras recuperar cupo**»* → *«al republicar solas (`PB3`, `PB7`…)»*, que son la
     máquina de `V/03` §9, **`V6`**;
   - *«**retención**»* → *«antes del día 90, **al archivar** y antes del día 180»*, o sea **tres**
     avisos, y la fila de **`V9`** los reclama con todas las letras: *«el reloj de 90 y 180 días con
     sus cuatro hechos de reinicio … y los **tres** avisos»*.
4. **Ninguna de las 22 unidades cita el capítulo 07.** Recorrí la columna *capítulos* de las 22
   filas: del lado verticales el núcleo aparece **dos** veces (`V1` con *«`02` §1 (núcleo)»* y `V9`
   con *«`01` §1.2 (núcleo)»*) y del lado billing **cero** — las dos apariciones de la palabra
   *«núcleo»* en `B/descomposicion.md` están en el §2.9 y en la fila *«B13 y el núcleo»* del §3.1, no
   en la tabla de unidades. **`NUCLEO/07` no aparece en ninguna de las 22 filas.**
5. **Y `V9` tampoco lo recoge desde su lado, aunque su celda prometa los tres avisos.** Su columna de
   capítulos sigue siendo *«`02` §4 · `22` §3 · `01` §1.2 (núcleo)»* — sin el `07` — y su criterio de
   terminación del §4 sigue siendo *«la fila de `trial` sobrevive al borrado de la cuenta, y su hash
   **no** se anonimiza»*: **ni un aviso, ni el reloj, ni la columna.**
6. **El efecto sobre la liberación.** `descomposicion.md` §5 dice que el estado vivo *«se lleva en el
   tablero, que calcula solo cuáles están listas: una unidad lo está cuando todas sus dependencias
   están hechas»*. **Un inventario que no contiene una pieza no puede reportar que falta**, y acá la
   pieza tiene además una declaración escrita de a quién pertenece que apunta al lado que no la
   construye: los dos mecanismos por los que alguien lo notaría se anulan.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/11-particion-del-programa.md` §4, fila 07.
- `HOS-1352/docs/nucleo/07-outbox-y-notificaciones.md` §6 (las quince filas) y §5 (el opt-out, con
  *«el del archivado es el que menos se puede suprimir de los tres»*). **`NUCLEO`.**
- `HOS-1353/descomposicion.md` §2 (filas `V6` y `V9`) y §4 (criterio de `V9`) ·
  `HOS-1354/descomposicion.md` §2 (fila `B13`: *«`19` entero · `22` §1»*).
- Medición propia: el conteo de filas del paso 1, el recorrido del paso 3 y la columna *capítulos* de
  las 22 filas del paso 4.

**Severidad.** `ALTA`. No mueve plata. Lo que rompe es que **los tres avisos que defienden el hard
delete del día 180 no tienen constructor y tienen un dueño declarado equivocado**, y el desenlace
—contenido borrado sin que nadie haya avisado— es *«un dato se pierde sin vuelta»*. **No lo marco
`CRITICA`** porque para llegar ahí hace falta además que nadie lo note al construir, y porque el daño
concreto del aviso que no sale está contado por `F-8fA3-018` y `F-8fA3-020`, que atacan el calendario
y la cancelación del aviso encolado: **son causas distintas del mismo silencio y no lo cuento dos
veces.**

**¿Es nuevo, o es el arreglo?** **Es el arreglo en su peso, y la ausencia es anterior.** La ausencia
del capítulo 07 del inventario es la mitad viva de `F-8dC2-002` y de `F-8eC2-003`. **Lo que esta
tanda agrega son dos filas más** —`DEC-DATA-003` y `DEC-SUB-015`—, de modo que la frase *«los dos del
trial a verticales y el resto a billing»* reparte hoy **trece** filas con un criterio que nunca se
revisó, y **una de las dos nuevas (`restitución tras recuperar cupo`) es de una máquina de
verticales.**

**¿Lo habría encontrado el grep?** **No con el término de las decisiones, sí con el del catálogo.**
Los términos que `DEC-DATA-003` y `DEC-SUB-015` definen son *«vuelve primero lo que cayó al final»*,
`PB7`, `S25` y *«la pausada no entra al piso»*: `rg` de los cuatro sobre
`11-particion-del-programa.md` devuelve **cero**. El que sí llega es *«catálogo de correos»*, que es
lo que la fila 07 nombra: **una aparición, exacta**, y es la que hay que corregir. Es la misma
limitación de siempre: la regla vigila términos del modelo, y **el reparto del trabajo está escrito
en castellano.**

**¿La resolución POR APARICIÓN lo habría atrapado?** **Para la regla sí, para la ausencia no, y la
distinción es la útil.** La fila 07 está en un archivo que **tres** rastros recorrieron
(`rastro-5836ec219.md` §2, `rastro-12cc0879f.md` §5, `rastro-f21d5d828.md` §4), con **7 líneas entre
los tres**, y **ninguna de las siete es la fila 07** — las verifiqué una por una: hablan del §3.1, del
§3.2, del §4.1 y de dos homónimos de *«referencias cruzadas»*. **Es el segundo desenlace del §1.4: la
aparición no está en el rastro y debería estar**, porque la fila 07 nombra *«el catálogo de correos»*
que las dos decisiones estaban modificando. La ausencia del capítulo del inventario, en cambio, **no
es una aparición**: es una fila que no existe, y ahí la enmienda no alcanza por construcción.

---

### F-8fC2-006 — `DEC-MP-003` enumera los consumidores del motivo de pausa que hay que recorrer y omite `S25`, la cuarta salida de `PAUSED`, creada por su propia tanda dos días antes; y con el motivo nuevo la pausa que el proveedor decide deja de tener el tope que `D16` y `G-R5` comparan contra el día del hard delete

**Qué se rompe.** `DEC-MP-003` está ACCEPTED y su implementación es trabajo pendiente y conocido
—eso **no** es hallazgo y no lo reporto—. Lo que reporto es que **la propia decisión escribe la lista
de lo que hay que recorrer al implementarla y la lista está incompleta**, y que el motivo nuevo
desarma, sin nombrarlo, el único invariante que separa a un cliente pausado del borrado irreversible
de su contenido. Quien la implemente siguiendo su lista deja `S25` sin tocar y deja `D16` vacío para
la población nueva.

**El camino.**

1. **La lista que la decisión escribe, textual.** `01-decision-log.md`, `DEC-MP-003`: *«**un motivo
   nuevo de pausa, `PROVIDER_DUNNING`.** El espejo lo escribe en lugar de `CUSTOMER_REQUEST`. Los
   motivos pasan de **dos a tres**, y **todo lo que lee el motivo de pausa hay que recorrerlo** —
   empezando por `puedePausar()`, los topes del §26 y **las salidas `S10`, `S22` y `PB*`**.»*
2. **Las salidas de `PAUSED` son cuatro, no tres, y la cuarta es de la misma tanda.** `B/03` §3.2:
   *«| **S25** | `PAUSED` — **con cualquiera de los dos motivos** | **el mismo evento de `S10`** …
   | `CANCELLED` | **el plan al que la fila está anclada ya NO se presta** … |»*. La creó
   `DEC-SUB-015`, del **2026-09-21**; `DEC-MP-003` es del **2026-09-22**. **La decisión que agrega el
   tercer motivo enumera los consumidores a recorrer y se saltea la transición que su propia tanda
   escribió el día anterior — la única de las cuatro cuya guarda dice literalmente «con cualquiera de
   los dos motivos» dos veces, junto con `S22` y `S10`.**
3. **Y `S25` no es una salida más: es la que decide qué pasa con la cortesía diferida.** Su celda:
   *«**si el motivo era `COURTESY` con días sin entregar, la cortesía NO se pierde: se DIFIERE**»*.
   Un tercer motivo sobre una guarda binaria (*«`COURTESY`, o el otro»*) deja indefinido el camino de
   una pausa `PROVIDER_DUNNING` que llega al fin sobre una vertical discontinuada.
4. **Lo que el motivo nuevo rompe y la decisión NO enumera: el tope.** La decisión enumera cuatro
   consecuencias del espejo actual —fuera del dunning, le consume una pausa que no pidió, `S10` lo
   devuelve a `ACTIVE` sin cobrar, y `paused` ya tenía dos significados—. Ninguna de las cuatro es
   ésta: **hoy la pausa del proveedor, espejada como `CUSTOMER_REQUEST`, queda acotada por *nuestro*
   tope** —*«4 pausas-mes por pausa»*, unos 120 días, `B/03` §5—, y **eso es lo único que la mantiene
   por debajo del día 180 del hard delete**. `NUCLEO/01` §1.2 lo escribe: *«entre el primer día de la
   pausa y ese reinicio hay 120 días como máximo contra los 180 del borrado. Que esa desigualdad siga
   siendo cierta **es un invariante, no una coincidencia aritmética**: es `D16`»*. Y `G-R5` lo vigila
   comparando *«el **tope de una pausa** que declara el catálogo —cap. 03 §5— … contra el día del hard
   delete»* (`B/20` §2).
5. **Una pausa `PROVIDER_DUNNING` no tiene tope en el catálogo, por definición.** La decide el
   proveedor —*«el proveedor pausa la suscripción por su cuenta cuando un ciclo agota sus cuatro
   reintentos»*— y `PS-4` mide que **no auto-reanuda**. Con el motivo nuevo la fila deja de contar
   contra los topes del §26 (es la consecuencia 2 que la decisión quiere corregir), **y con eso deja
   de tener cualquier tope**: `D16` no la alcanza, `G-R5` no tiene qué comparar, y el reloj de
   `listing.inactiva_desde` corre sin cota hasta el borrado. `PAUSED · CUSTOMER_REQUEST` **no emite
   fuente** (`12-contrato…` §2.6, y `S24` lo repite: *«a diferencia de `PAUSED` por
   `CUSTOMER_REQUEST` y de `SUSPENDED`»*), así que `PB2` baja la ficha el primer día y el reloj
   arranca ahí.
6. **Y esto es una dependencia de liberación que hoy nadie declara**, que es lo que lo hace mío.
   La decisión dice: *«qué hace el dunning con esa fila … **espera el veredicto de la sonda 49**, que
   se lee el **2026-09-24**»*. Las unidades que van a tener que absorberlo ya están escritas con sus
   criterios cerrados: **`B8`** (que construye `03` §5, `S8`–`S12`, `S22`, `S25` y el tope, y además
   `G-R1-C` y `G-R5`), **`B7`** (el dunning), **`B3`** (que construye `03` **§10**, donde vive el
   espejo) y **`V9`** (el día 180 y `D16`). **Ninguna de las cuatro filas ni de los cuatro criterios
   nombra `PROVIDER_DUNNING`**, y no pueden: la decisión es de ayer. Lo que falta no es la
   implementación, es **la línea que diga que esas cuatro unidades no se pueden cerrar antes del
   24/09**.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/01-decision-log.md`, `DEC-MP-003` (la lista de consumidores y las cuatro
  consecuencias) y `DEC-SUB-015`.
- `HOS-1354/docs/03-maquinas-de-estado.md` §3.2 (`S10`, `S22`, `S24`, `S25`), §5 (el tope) y §10.1
  (el espejo `paused × ACTIVE → S8`, *«con motivo `CUSTOMER_REQUEST`»*).
- `HOS-1352/docs/nucleo/01-glosario.md` §1.2 (la desigualdad 120 < 180 y `D16`) ·
  `HOS-1352/docs/nucleo/04-invariantes.md` §3 (`D16`) · `HOS-1354/docs/20-testing.md` §2 (`G-R5`).
  **`NUCLEO`.**
- `HOS-1354/descomposicion.md` §2 (filas `B3`, `B7`, `B8`) y §4 · `HOS-1353/descomposicion.md` §2
  (fila `V9`).
- Medición propia: `rg -l "PROVIDER_DUNNING"` fuera de los informes → **sólo el decision log**;
  `rg -c "con cualquiera de los dos motivos"` sobre `B/03` → **2** (`S22` y `S25`).

**Severidad.** `ALTA`. El desenlace del paso 5 es *«un dato se pierde sin vuelta»* —el contenido de
una ficha borrado el día 180 sobre un cliente que el proveedor pausó por mora—, pero **no llega a
`CRITICA` porque hoy no ocurre**: con el espejo actual la pausa está acotada por nuestro tope y la
desigualdad se cumple. Es un defecto **de la implementación pendiente y del inventario de lo que hay
que recorrer**, no del texto de hoy, y por eso lo escribo como dependencia de liberación y no como
camino ejecutable.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: `DEC-MP-003`, la undécima de las doce decisiones
nuevas.** La omisión de `S25` sólo es posible porque `S25` nació en la misma tanda, **dos días
antes**, y por eso es exactamente la clase de defecto que esta serie mide: *«el commit abrió el
archivo y no leyó el párrafo de al lado»*, con el agravante de que acá ni siquiera hizo falta abrir
un archivo — `S25` y `S22` son filas contiguas de la misma tabla.

**¿Lo habría encontrado el grep?** **Sí, y con el término que la propia decisión define.** El término
nuevo es *«motivo de pausa»* / `PROVIDER_DUNNING`, y el viejo que se retira como exclusivo es *«los
dos motivos»*: `rg -c "con cualquiera de los dos motivos"` sobre `B/03` devuelve **dos**, `S22` y
`S25`. **La decisión nombró una de las dos.**

**¿La resolución POR APARICIÓN lo habría atrapado?** **No está en ningún rastro y no debía estar**
—tercer desenlace del §1.4—, **y el motivo es el que `DEC-METH-011` dejó vivo a propósito**: el commit
de `DEC-MP-003` (`f9b4a8502`) **toca un solo archivo, el decision log**, y el párrafo defectuoso es
**el que ese commit escribió**. Cae en el modo 1 de `C1` §4.4: *«el defecto nace en la prosa que el
commit escribe»*. Es la segunda vez que mi vector aterriza en ese punto ciego —`F-8eC2-001` fue la
primera—, y las dos veces el defecto fue **una enumeración escrita por el arreglo que le faltó un
miembro**.

---

### F-8fC2-007 — La tanda dejó 33 preguntas para el owner repartidas en once documentos, ninguna en los dos registros que el programa tiene para eso, y los dos registros declaran cero abiertas

**Qué se rompe.** El programa tiene una regla escrita para las preguntas abiertas —*«Mientras un ítem
esté abierto, **nadie decide por su cuenta**: ni un agente, ni una implementación, ni un default
silencioso»* (`04-open-decisions.md`)— y dos registros donde viven. **La tanda produjo 33 ítems
dirigidos al owner y no puso ninguno en ninguno de los dos.** Los dos siguen diciendo que hay cero
abiertas. Entre esas 33 hay cosas que bloquean la liberación: qué comprueba `G-R6` (cuya respuesta
decide si un guard da rojo sobre el camino normal durante tres unidades del camino crítico), quién
mantiene los cuatro inventarios de `NUCLEO/01` §2 que dos guards leen, y una decisión que nombra
`PB1` donde corresponde `PB6`.

**El camino, medido el 2026-09-22.**

1. **Nueve de los diez rastros tienen un § de preguntas para el owner.**
   `rg -n "^## .*[Pp]ara el owner" 21-fase-9-bis-4/*.md` → **nueve archivos**. El único que no la
   tiene es `rastro-40b922120.md`, cuyo equivalente es su §3 (*«lo que sí quedó declarado, y son tres
   cosas»*), que no cuento acá. **Las instrucciones de esta fase dicen «cuatro rastros»; mi conteo da
   nueve, y lo doy con el comando.**
2. **Los ítems numerados dentro de esas secciones suman 30**, contados con `awk` sobre el rango de
   cada sección: 4 + 3 + 2 + 3 + 4 + 5 + 3 + 3 + 3.
3. **Más tres en las dos `descomposicion.md`.** `V/descomposicion.md` §2.8 (*«**Queda como pregunta
   para el owner**, con las dos salidas que se ven»* — el predicado global de `G-R6`) y
   `B/descomposicion.md` §2.9, titulado *«**Dos preguntas que el reparto deja abiertas**, y ninguna se
   resuelve inventando»* (`B/02` §2.5 sin unidad, y los inventarios de `NUCLEO/01` §2). **Total: 33.**
4. **Ninguna llegó a los registros.** `rg -c "predicado global|corpus se construye por partes|entre
   \`B5\` y \`B8\`"` sobre `01-decision-log.md` y `04-open-decisions.md` → **cero en los dos**. El
   único archivo con apariciones es `V/descomposicion.md` (3).
5. **Y los dos registros declaran cero.** `01-decision-log.md`, tabla resumen: *«| **Preguntas del
   owner abiertas** | **0 de 25** |»*. `04-open-decisions.md`, encabezado: *«**0 de las 25 preguntas
   de FASE 1A abiertas**»*, con `updated: 2026-09-15` y último commit **`ee6f82544`, 2026-09-19** —
   o sea **anterior a los 76 commits de la tanda**.
6. **Al menos tres de las 33 no son notas, son defectos o bloqueos.**
   - `V/descomposicion.md` §2.8 — el predicado global de `G-R6`: *«entre B5 y B8 el guard daría
     **rojo sobre el camino normal**»*, sobre la rama de integración compartida. Sin respuesta, lo
     resuelve quien se choque con el rojo.
   - `B/descomposicion.md` §2.9 — *«`G-R1-F` **lee esa enumeración** para decidir si un motivo existe,
     así que la pregunta no es teórica: quien construya el guard necesita que la tabla esté
     sembrada»*, sobre una tabla que no es capítulo de ninguna unidad.
   - `rastro-5836ec219.md` §4 punto 1 — *«**`DEC-DATA-003` nombra `PB1` donde corresponde `PB6`**»*,
     con el propio rastro diciendo *«**No toqué el log.** Si el owner prefiere, la decisión puede
     corregirse en su lugar»*. **Es un error en una decisión ACCEPTED, escrito en un archivo que
     ningún registro indexa.**
7. **Y el mecanismo que las juntaría existe y no se usó.** El `03-handoff.md` tiene una sección
   *«Pendientes del owner, que el agente no puede hacer»* con **cuatro** ítems, ninguno de esta tanda,
   y su `updated:` es **2026-09-20**.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/04-open-decisions.md`, encabezado y regla *«Mientras un ítem esté abierto…»* ·
  `HOS-1352/docs/01-decision-log.md`, tabla *«Resumen»* · `HOS-1352/docs/03-handoff.md`,
  *«Pendientes del owner»*.
- `HOS-1352/docs/21-fase-9-bis-4/*.md`, las nueve secciones de preguntas.
- `HOS-1353/descomposicion.md` §2.8 · `HOS-1354/descomposicion.md` §2.9.
- Medición propia: los `rg -n` y `awk` de los pasos 1-4.

**Severidad.** `ALTA`. No mueve plata por sí solo. Lo que rompe es que **el único mecanismo que este
programa tiene para que una pregunta se conteste está declarando vacío mientras 33 esperan**, y
`DEC-METH-011` acaba de institucionalizar el artefacto donde se acumulan: **los rastros son un
producto nuevo de esta tanda y ya son el mayor depósito de preguntas sin indexar del programa.** El
desenlace es el que el propio `04-open-decisions.md` nombra: *«un default silencioso»*, tomado por
quien se choque con el problema, en el momento en que el costo de cambiarlo es mayor.

**¿Es nuevo, o es el arreglo?** **Es el arreglo, y es `DEC-METH-011` misma.** El rastro por aparición
como archivo es su creación; las secciones de preguntas son el subproducto. Antes de esta tanda no
existía el depósito.

**¿Lo habría encontrado el grep?** **No, y no por límite del término sino de la dirección.** Los
términos de la tanda están **en** los rastros; lo que falta es la **entrada en otro documento**, y
ningún barrido que parta de las apariciones puede detectar un documento que debería tener una fila y
no la tiene. Es la misma clase que `F-8fC2-003` paso 4.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y es el límite estructural más nítido que
medí esta vuelta.** La obligación 2 recorre apariciones **dentro del corpus**, y los diez rastros
declaran su alcance como *«los 51 archivos del corpus … quitando los informes de fase (`14-…` a
`21-…`)»* — **o sea que los rastros se excluyen a sí mismos del barrido, con razón**. Pero eso
significa que **una pregunta escrita en un rastro no es una aparición para ningún rastro posterior**:
nace fuera del alcance de la regla que la produjo. Cae en el tercer desenlace del §1.4 y no hay forma
de que caiga en otro.

---

## MEDIA

### F-8fC2-008 — `NUCLEO` · El conteo de invariantes sigue viviendo con tres valores en cuatro documentos —51, 52 y 53— y el que dice 51 es el argumento de por qué el núcleo no se parte; dos commits de la tanda existieron sólo para recontar un número diez renglones arriba de uno de los 51

**Qué se rompe.** La razón escrita de por qué el núcleo **no se puede partir** —*«un glosario en dos
mitades deja de ser un glosario, y los **51** invariantes numerados de corrido pierden lo único que
los hace útiles: poder preguntar **una vez** si están todos»*— se apoya en un número que hoy es
**53**. Quien quiera *«preguntar una vez si están todos»* no tiene contra qué contrastar.

**El camino.**

1. **El valor verdadero, recontado por mí.** `NUCLEO/04` §5: *«**Cincuenta y tres invariantes, y diez
   los sostiene la base.**»*, con su tabla en `37 + 16 = 53`. Conté las filas del §3 con
   `rg -o "^\| \*?\*?\`?D[0-9]+" | wc -l` → **16**, de `D1` a `D16`. **53 es correcto.**
2. **Dos documentos dicen 51.** `HOS-1353/spec.md` L71, tabla *«De dónde sale cada cosa»*, fila *«el
   núcleo»*: *«los **51 invariantes** numerados de corrido»*. Y `NUCLEO/00-indice.md` L87: *«un
   glosario en dos mitades deja de ser un glosario, y **51 invariantes** numerados de corrido
   pierden lo único que los hace útiles»*. **Las dos frases son la misma frase**, y es el argumento
   entero de la indivisibilidad del núcleo. **`NUCLEO`.**
3. **Y un tercero dice 52, declarándolo como corrección pendiente.** `03-handoff.md` L256: *«| el
   resumen de invariantes quedó en «16 apoyos sobre 14» y «**51**, ocho de base» | `NUCLEO/04` §5.
   El real es **52 y 10** … |»*, y L183: *«el resumen de invariantes quedó recontado entero con
   script: **52**, 10 de base, 18 apoyos…»*. **La fila que existe para corregir el 51 caducó ella
   misma**, y está en la sección que el handoff titula *«se aplican sin discutir»*.
4. **Y esta tanda tuvo el archivo abierto con el mandato explícito de recontar.**
   `git log --oneline 5ac5e92c9~1..90e4b326f -- HOS-1353/spec.md` devuelve cuatro commits, y **dos de
   ellos existen sólo para arreglar un conteo en ese archivo**: `afa716777` (*«la spec de verticales
   recuenta sus guards y deja de dar siete por total»*) y `f77ae725e` (*«la spec de verticales cuenta
   diecisiete guards»*). El renglón que corrigieron es *«| `20` | testing | … **diecisiete guards** |»*,
   en la línea **61**. **El «51 invariantes» está en la línea 71: diez renglones abajo, en el mismo
   archivo, en la tanda cuyo encargo era recontar.**
5. **`NUCLEO/04` ya sabe que éste es su modo de falla y lo escribió dos veces.** Su nota de
   `621332e7c`: *«las dos correcciones anteriores se escribieron en la nota y no en la tabla … Es el
   modo que este mismo capítulo documenta: **corregir donde se mira y no donde se lee**»*. La tercera
   instancia es ésta, una capa más afuera: se corrigió el capítulo y no los tres documentos que lo
   citan.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/nucleo/00-indice.md` L87 · `HOS-1352/docs/nucleo/04-invariantes.md` §3 y §5.
  **`NUCLEO`.**
- `HOS-1353/spec.md` L71 · `HOS-1352/docs/03-handoff.md` L183 y L256.
- Medición propia: el conteo de filas `D*` del paso 1, `rg -n "5[0-9] invariantes|cincuenta y"` sobre
  el corpus excluidas las carpetas de informes → los tres archivos citados, y `git log --oneline` del
  paso 4.

**Severidad.** `MEDIA`. Nadie paga de más por esto. Lo reporto porque **el número es el argumento**,
no un dato de color: las dos épicas se liberan juntas (`DEC-ARCH-007`) y el núcleo es lo único que
comparten, así que el conteo es el único **control de completitud** que el programa se dio para el
artefacto que no se parte. Es mi `F-8eC2-006` intacto, y la instancia de esta vuelta es peor que la
anterior: entonces el commit que produjo el 53 tenía los 51 al alcance; ahora **dos commits cuyo
único trabajo era recontar** los tuvieron a diez renglones.

**¿Es nuevo, o es el arreglo?** **La brecha es anterior** (nace con `D13`/`D14` y la ensanchó
`621332e7c`, de la 9-bis-3). **Lo que esta tanda agrega es la oportunidad desperdiciada**: el encargo
de `afa716777` y `f77ae725e` era literalmente *«recontar»* sobre ese archivo.

**¿Lo habría encontrado el grep?** **Sí, y es el caso más limpio de la obligación 3.** Los dos commits
retiran el literal *«quince guards»* y *«siete guards»* de ese archivo; grepear el conteo vecino
—`rg "invariantes"` sobre el mismo archivo— devuelve **una** aparición, la de la línea 71. **Un
barrido por *«los conteos de este archivo»*, que es lo que el commit decía estar haciendo, la
devuelve.**

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí, y ésta es la instancia más incómoda que
medí en dos vueltas.** `rastro-12cc0879f.md` §5 cubre `V/spec.md` con **5 líneas**, y las verifiqué:
ninguna es la fila *«el núcleo»*. La aparición está **en el mismo archivo que el commit abrió, en una
tabla vecina, diez renglones abajo, no corregida y no registrada**: el segundo desenlace del §1.4 —la
regla no se ejecutó sobre esa aparición— en su forma más barata de detectar. **Si hay un solo dato
que separa *«la enmienda no sirve»* de *«no se aplicó»*, sigue siendo éste, y ahora con un rastro que
lo prueba en vez de un razonamiento.**

---

### F-8fC2-009 — `B5` y `V9` son las dos unidades dueñas de lo que la tanda más movió y sus criterios de terminación siguen sin una línea de diff: la que construye el pago manual no nombra el reloj que crea la cuota, y la que construye el borrado irreversible no nombra ni el reloj, ni la columna, ni los tres avisos

**Qué se rompe.** Las dos unidades que la tanda cargó de trabajo nuevo pueden declararse terminadas,
por su propio criterio escrito, sin que exista nada de lo que se les agregó. `B5` es la dueña del
`B/03` §7 —donde viven `MP4`, `MP5`, el tope de la reapertura y las tres escrituras de la fecha del
próximo cobro— y su criterio no nombra una cuota, un reloj ni una reapertura. `V9` es la dueña del
reloj de retención y su criterio no nombra ni el día 90, ni el día 180, ni `listing.inactiva_desde`,
ni los tres avisos que su propia celda promete.

**El camino.**

1. **El criterio de `B5`, hoy, y es idéntico al de la 8-bis-4.** `B/descomposicion.md` §4: *«| **B5**
   | un reembolso que emite **tres notificaciones en dos formatos** produce **una** fila; un período
   con un pago acreditado **rechaza el segundo desde la base**, no desde un chequeo; y un hecho más
   viejo que el último aplicado **se registra y no se aplica** |»*. **Tres aserciones y ninguna
   nombra una cuota, un reloj ni una reapertura.**
2. **Y `B5` es la dueña del §7.** `B/descomposicion.md` §2: *«| **B5** | **El registro del dinero** |
   … | `02` §2.3 · `03` §6, **§7**, §10.2 · `05` C5 | — |»*.
3. **Lo que el §7 ganó en esta tanda.** `MP5` con su condición reescrita —la columna pasa a ser *«la
   fecha del próximo cobro»* con **tres** escrituras—, el **TOPE** que reemplaza el re-anclaje
   incondicional de `MP4`, y la decimotercera puerta a un estado terminal. El §7.2 escribe por qué
   existe: *«una cuota que nadie crea es **servicio gratis en silencio**»*. **Nada de eso está en el
   criterio.**
4. **El criterio de `V9`, hoy.** `V/descomposicion.md` §4: *«| **V9** | la fila de `trial` sobrevive
   al borrado de la cuenta, y su hash **no** se anonimiza |»*. **Una aserción, sobre la única entidad
   que V9 *no* borra.**
5. **Y su celda del §2 promete otra cosa.** *«| **V9** | **Retención** | el reloj de 90 y 180 días
   **con sus cuatro hechos de reinicio**, la anonimización, el hash del correo y los **tres** avisos
   | `02` §4 · `22` §3 · `01` §1.2 (núcleo) | — |»*. **Cuatro entregables en la celda, uno en el
   criterio**, y el que falta es el que decide *«la única operación irreversible sobre datos del
   cliente de todo el programa»* (`V/02` §2.5).
6. **Los dos criterios están sin tocar.** `git diff 5ac5e92c9~1 90e4b326f` sobre las dos
   `descomposicion.md`: los hunks del §4 son `@@ -355,2 +485,2 @@` en billing —la fila de `B10`— y
   ninguno en verticales. **Ni `B5` ni `V9` tienen una línea de diff en su criterio, en 76 commits
   que reescribieron sus dos capítulos.**

**Dónde lo permite el diseño.**

- `HOS-1354/descomposicion.md` §2 (fila `B5`), §3 y §4 · `HOS-1353/descomposicion.md` §2 (fila `V9`)
  y §4.
- `HOS-1354/docs/03-maquinas-de-estado.md` §7 y §7.2 · `HOS-1353/docs/02-modelo-de-datos.md` §2.5 y
  §4.1 · `HOS-1352/docs/nucleo/07-outbox-y-notificaciones.md` §6.
- Medición propia: `git diff --unified=0` sobre las dos `descomposicion.md` acotado al §4.

**Severidad.** `MEDIA`. La plata está contada del otro lado y **no la vuelvo a contar**: `F-8fB1-001`
ataca lo que el tope de `MP4` hace con el pagador manual, y `F-8fA2-001` y `F-8fA3-001` atacan lo que
la relectura hace con el borrado. Lo que agrego es **con qué criterio se declara hecho**, y la
respuesta es dos criterios que no mencionan la pieza. Es la misma familia que `F-8fC2-003` —el §4 no
sabe lo que el §2 promete— y la bajo a `MEDIA` porque ahí ya la conté como clase.

**¿Es nuevo, o es el arreglo?** **Es el arreglo, y son dos familias**: la del pagador manual
(`rastro-8f9f31ac0.md`, 4 commits) y la de la retención (`rastro-5836ec219.md`, 6 commits). Es mi
`F-8eC2-005` reejecutado sobre `B5` y extendido a `V9`, que la vuelta pasada no había mirado: **la
tanda le agregó a `V9` los tres avisos y los cuatro hechos en su celda, y no tocó su criterio.**

**¿Lo habría encontrado el grep?** **No por el término nuevo, sí por el de la sección.**
`rg -c "MP4|MP5|inactiva_desde"` sobre `B/descomposicion.md` → **0 · 0 · 0**; sobre
`V/descomposicion.md` → **0 · 0 · 1**, y esa 1 es el §2.5 que la tanda escribió, no el criterio. Lo
que sí llega es la referencia de sección —la fila de `B5` cita *«`03` §6, **§7**, §10.2»*— pero
**nadie grepea *«§7»***.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Para `V9` sí, para `B5` no, y son los dos
desenlaces opuestos en el mismo hallazgo.** Para `V9`: `rastro-5836ec219.md` L225-227 **recorrió la
celda de `V9`** y la declaró correcta —*«siguen **cuatro** hechos y **tres** avisos; lo que la unidad
gana es una columna y una relectura, que no cambian ninguno de los dos conteos ni su guard»*—
**y no miró el criterio de la misma unidad, treinta renglones abajo en el mismo archivo**: segundo
desenlace. Para `B5`: `rg` de `MP4`/`MP5` sobre `B/descomposicion.md` da cero, así que **no hay
ninguna aparición que resolver** y cae en el tercero. *(De paso: esa línea de rastro también contiene
la mitad que caducó dentro de la propia tanda —*«ni su guard»*—, porque la quinta enmienda le sacó
`G-R5` a `V9` dos días después. La cuento en el § de líneas de rastro, no como hallazgo: su
afirmación era correcta para su familia.)*

---

### F-8fC2-010 — `NUCLEO` · Cuatro capítulos del núcleo siguen sin ser de ninguna de las 22 unidades; la tanda escribió en los seis, lo miró por escrito dos veces, y las dos veces lo dejó como pregunta

**Qué se rompe.** El panel administrativo del sistema de cobro —las doce acciones con su permiso
propio, su registro de auditoría y su confirmación explícita—, los invariantes, el catálogo de
correos y las reglas de lectura de las máquinas **siguen sin constructor**. Un inventario que no
contiene una pieza no puede reportar que falta.

**El camino.**

1. **Las 22 unidades citan el núcleo dos veces**, recorrida la columna *capítulos* entera: `V1` con
   *«`02` §1 (núcleo)»* y `V9` con *«`01` §1.2 (núcleo)»*. **`nucleo/03`, `nucleo/04`, `nucleo/07` y
   `nucleo/08` no aparecen en ninguna de las 22 filas.** Idéntico a la 8-bis-4.
2. **La tanda escribió en los seis capítulos del núcleo.** `git diff --name-only 5ac5e92c9~1
   90e4b326f` sobre `nucleo/`: `01`, `03`, `04`, `07` y `08` — cinco de los seis, y el `00` es el
   índice.
3. **Y lo que cuelga de los cuatro sin dueño creció.** `NUCLEO/04` ganó las reglas de `D15`/`D16` y su
   recuento; `NUCLEO/07` ganó **dos** filas de correo más (15 en total); `NUCLEO/08` ganó el
   `§4.3` del listado accionable con el default de `DEC-RF-003`; `NUCLEO/03` ganó `S22`-`S25` y el
   dominio de nueve máquinas de `G-R4`/`G-R6`.
4. **La tanda lo miró por escrito, dos veces, y las dos lo dejó abierto.**
   `B/descomposicion.md` §2.9 punto 2: *«**Los inventarios de `NUCLEO/01` §2.4, §2.5 y §2.6 tampoco
   lo son** … No es hallazgo nuevo: `F-8dC2-002` reporta que **cuatro capítulos del núcleo no son de
   ninguna unidad** … **Lo que deja abierto es quién mantiene las listas.**»* Y el §3.1 sigue con la
   fila *«| que el caso aparezca en el listado accionable con qué devolver (`NUCLEO/08` §4.3) | **B13
   y el núcleo** | sí |»*, donde **«el núcleo» no es ninguna de las 22 unidades**.
5. **Y la partición sí los había repartido**, `11-particion-del-programa.md` §4: `04` **PARTIDO**,
   `07` **PARTIDO**, `08` **PARTIDO**. El reparto existe a nivel de capítulo y **no bajó nunca al
   inventario de unidades**, que es el único lugar donde el tablero del §5 mira.

**Dónde lo permite el diseño.**

- `HOS-1353/descomposicion.md` §2 · `HOS-1354/descomposicion.md` §2, §2.9 y §3.1.
- `HOS-1352/docs/11-particion-del-programa.md` §4 y §4.1.
- `HOS-1352/docs/nucleo/08-auditoria-y-observabilidad.md` §3 y §4.3 ·
  `HOS-1352/docs/nucleo/04-invariantes.md` · `HOS-1352/docs/nucleo/07-outbox-y-notificaciones.md` ·
  `HOS-1352/docs/nucleo/03-maquinas-de-estado.md`. **`NUCLEO`.**
- Medición propia: la columna *capítulos* de las 22 filas, y `rg -n "núcleo"` sobre las dos
  `descomposicion.md` → **4 líneas en verticales (L54 y L62, que son las filas `V1` y `V9` de la
  tabla, más L106 y L229, que son prosa de los §2.5 y §2.7) y 2 en billing (L399 del §2.9 y L449 de
  la tabla del §3.1, ninguna en la tabla de unidades)**, y `git diff --name-only`.

**Severidad.** `MEDIA`, igual que la vuelta anterior. No mueve plata; lo que queda sin quién las
construya y sin quién las exija son **las doce acciones administrativas**, con *«otorgar o revocar un
grant permanente»* clasificada por el propio capítulo como *«**sí**, y **la más grave**»*.

**¿Es nuevo, o es el arreglo?** **La ausencia es anterior** —es `F-8dC2-002` y `F-8eC2-008`, que
siguen—. **Lo que esta tanda agrega es que el reparto de guards lo tuvo delante y lo declaró abierto
en vez de cerrarlo**, con un argumento explícito (*«asignar un capítulo a una unidad es repartir
trabajo, no asignar un guard, y eso lo decide el owner»*) que es correcto **y que nadie va a leer**,
porque la pregunta quedó en un §2.9 y no en ningún registro (`F-8fC2-007`).

**¿Lo habría encontrado el grep?** **No.** El defecto es **una fila que falta** en una tabla de 22, y
una fila que falta no tiene término. `rg "NUCLEO/08"` sobre los cuatro documentos de implementación
devuelve **una** aparición —la fila *«B13 y el núcleo»* del §3.1— y grepearla **confirma que el
capítulo se nombra** en vez de mostrar que no tiene unidad.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, mismo límite estructural que `F-8fC2-003`
y `F-8fC2-005`: una fila que falta no es una aparición.** Lo que sí cambió y vale decirlo: esta vez
**alguien la miró sin grep**, escribiendo el §2.9, y la dejó abierta. **El barrido no es el cuello de
botella acá; el registro de preguntas sí.**

---

## BAJA

### F-8fC2-011 — Quince de los treinta archivos que la tanda editó declaran un `updated:` anterior al día de su último commit, y entre ellos está otra vez el contrato de la frontera

**Qué se rompe.** El único dato que un agente o una persona que entra al programa tiene para saber si
lo que está leyendo es de antes o de después de la última tanda es el `updated:` del frontmatter, y
en **15 de 30 archivos miente para abajo**. El caso peor vuelve a ser el contrato de cobertura: cinco
commits de la tanda lo editaron y sigue diciendo `updated: 2026-09-20`, sobre el documento del que
`DEC-ARCH-006` dice que *«ninguna de las dos épicas lo puede mutar sola»*.

**El camino.**

1. **La unión de archivos `.md` que los 76 commits tocan, excluidos los informes de fase, es 30**,
   contada con `git diff --name-only 5ac5e92c9~1 90e4b326f`.
2. **Quince llevan un `updated:` anterior a la fecha de su último commit de la tanda.** Comparado uno
   por uno con `git log -1 --format=%ad --date=short 5ac5e92c9~1..90e4b326f -- <archivo>`. Los de mi
   vector y del paraguas: `12-contrato-de-cobertura.md` → **2026-09-20** con último commit
   **09-21** (cinco commits lo editan) · `01-decision-log.md` → **09-21** con último commit **09-22**
   · `nucleo/04-invariantes.md` → **09-20** / **09-21** · `nucleo/08-auditoria…` → **09-19** /
   **09-21** · `HOS-1353/descomposicion.md` → **2026-09-18** / **09-21**. Y diez capítulos más, el más
   viejo `V/11-trial.md` en **2026-09-17**.
   `06-mp-validation-matrix.md` **no tiene `updated:`**.
3. **Mejoró, y conviene decirlo**: en la 8-bis-4 eran **21 de 33**; ahora **15 de 30**. La convención
   existe y se aplicó en la mitad.
4. **Por qué es mío y no cosmética.** `DEC-ARCH-007` deja que las dos épicas se desarrollen en
   paralelo sobre una rama de integración que *«va a vivir meses»* (`D-28`), con *«**staging** se
   mergea HACIA la rama del paraguas, periódicamente y como obligación»*. En esa convivencia el
   `updated:` es el único marcador por documento de *«¿esto ya incorporó la última tanda?»*, y
   `03-handoff.md` abre diciendo *«Si sos un agente o una persona que acaba de entrar a este
   programa: leé esto entero antes»*.

**Dónde lo permite el diseño.** El frontmatter de los 15 archivos; `HOS-1352/docs/nucleo/00-indice.md`
§*«reglas de escritura»* como el lugar donde la convención tendría que estar enunciada. Medición
propia: el recorrido del paso 2.

**Severidad.** `BAJA`. Nadie paga de más, ningún dato se pierde y ninguna decisión cambia. Lo reporto
porque es **barato, mecánico y comprobable con una línea**, porque el archivo peor servido es el que
tiene la regla de mutación más estricta del programa, y porque una de las dos formas conocidas de que
una revisión mida contra el árbol equivocado es creerle a una fecha.

**¿Es nuevo, o es el arreglo?** **Es el arreglo, y son los 76 commits.** Cada uno de los 15 archivos
lo dejó viejo un commit de esta tanda.

**¿Lo habría encontrado el grep?** **No aplica por término, y sí por el archivo.** `rg "^updated:"`
sobre los archivos que cada commit toca —una comprobación de una línea— devuelve los 15.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí, quince veces, y ése es el dato.** El
frontmatter es, para cada uno de los 15, *«una aparición no corregida en un párrafo que el commit no
tocó»* **dentro de un archivo que el commit sí abrió** — el caso exacto que la obligación 2 existe
para registrar. **Ninguno de los quince aparece en ninguno de los diez rastros**: `rg -c "updated:"`
sobre los diez devuelve **1 por archivo, que es el `updated:` del propio frontmatter del rastro**, y
`rg -c "frontmatter"` sobre los diez devuelve **1 en total**, en una línea que no es un frontmatter
desfasado. Es la medición más barata que tiene esta
pasada sobre si la obligación 2 se ejecutó de verdad, y en su quinta corrida contesta **no, quince
veces**, sobre 1.030 apariciones declaradas.

---

## 3. Dos cosas que verifiqué de otros informes, porque las iba a usar

**`F-8fA3-014` — los campos de la dirección inversa se cuentan de tres maneras.** Lo medí por mi
cuenta antes de leer su informe y llegamos al mismo resultado: `12-contrato-de-cobertura.md` §4.1 dice
*«**Son siete campos en tres preguntas**»* y su propio §4.2, once renglones abajo, dice *«algo que no
está en **los seis campos** del §4.1»*; `V/02` L97 dice *«dos de **los seis** campos»*. Lo verifiqué
**abriendo el contrato**, no el informe: `git log -S "los seis campos"` → `4f34afa1a`, y
`git log -S "siete campos en tres preguntas"` → `a720519e1`, los dos anteriores a esta tanda. **Es
suyo y no lo duplico.** Lo que agrego, y es lo que hace `F-8fC2-001`: **el desacuerdo de conteo es el
síntoma menor. El mayor es que ninguno de los dos números tiene constructor.**

**`F-8fA3-004` — el cuarto hecho de la lista de escritores no tiene ejecutor.** Lo recorrí contra
`NUCLEO/01` §1.2 hecho 4, `V/02` §2.5 y `B/10` §4.3. **Su cita es correcta y el hallazgo se
sostiene.** `F-8fC2-001` **no lo duplica**: el suyo es *quién ejecuta esa escritura*; el mío es *que
el canal por el que billing puede preguntarle algo a verticales no lo construye nadie y que el
documento que reparte declara que no hay tercera dependencia*. Que sean uno o dos defectos lo decide
el que deduplica, y no soy yo — pero anoto que se tocan en un punto concreto: **`B/10` §4.3 es de
`B12` y `V/02` §2.5 es de `V6`**, así que la escritura sin ejecutor cruza exactamente la frontera
cuyas dependencias `B/descomposicion` §2.6 declara agotadas en dos.

**`F-8fA1-004` — `G-R6` va a rojo sobre `T1`, `T6`, `T7`, `S10` y `S25`.** No la verifiqué en
profundidad porque ataca un plano distinto del mío (qué columnas leen esas guardas) y porque mi paso 6
de `F-8fC2-003` no depende de que su conclusión sea cierta: **yo mido que el caso que el catálogo
prescribe para romperlo está en `B8`**, y eso vale con `G-R6` verde o rojo. **Si las dos son
correctas se refuerzan**: un guard que da rojo desde el día uno del otro lado de la frontera es peor
que uno que no puede fallar.

---

## 4. Mis 9 hallazgos de la 8-bis-4, reejecutados sobre el texto de hoy

**No son hallazgos de esta pasada.** Cada camino se volvió a correr contra el texto, no contra el
mensaje del commit ni contra la línea del rastro.

| id | veredicto | dónde corta, o dónde llega hoy |
|---|---|---|
| `F-8eC2-001` · la frase huérfana *«las dos van después de desplegar»* en el §4.2 del corte | **SIGUE, palabra por palabra** | el archivo no lo tocó ningún commit de los 76. Lo cuento dentro de `F-8fC2-004` y no lo vuelvo a numerar |
| `F-8eC2-002` · la partición §3.2 punto 1: el disparador de `T2`/`T5` y *«sólo puede vencer»* | **SIGUE, y ahora con una certificación falsa encima** | verificado línea por línea contra `V/03` §2 (hoy: *«aparece una fuente viva de clase `TÍTULO`»*) y contra `T7` → `F-8fC2-002` |
| `F-8eC2-003` · el catálogo de correos y la fila 07 de la partición | **SIGUE y empeoró** | el catálogo pasó de **13 a 15** filas y ahora son **cinco** los avisos que construye verticales y el reparto manda a billing → `F-8fC2-005` |
| `F-8eC2-004` · guards sin unidad, 12 de 26, y `G-R5` en la épica equivocada | **CORTA** | recontado por mí: **29 guards, 0 sin unidad**, y `G-R5` se fue a `B8`, que es la unidad que construye el tope. **Es el único corte de la vuelta y es un corte completo.** Lo que queda vivo es otra cosa y por eso lleva ID nuevo: **ningún criterio de terminación nombra un guard** → `F-8fC2-003` |
| `F-8eC2-005` · el criterio de `B5` no nombra el reloj que crea la cuota | **SIGUE, sin una línea de diff** | verificado contra el §4 de hoy: las mismas tres aserciones. Y se le suma `V9` → `F-8fC2-009` |
| `F-8eC2-006` · el conteo de invariantes, 51/52/53 | **SIGUE**, y con dos commits de recuento a diez renglones | `nucleo/00` L87 y `V/spec` L71 siguen en **51**; el handoff en **52**; `nucleo/04` §5 en **53**, que es el correcto → `F-8fC2-008` |
| `F-8eC2-007` · el documento del corte, intacto y con fecha límite | **SIGUE y empeoró tres veces** | 0 de 76 commits · 1 de 1.030 líneas de rastro · plazo **mañana** · tercer encargo (`B/21` §3) · y su §1 y §3 ahora afirman algo falso → `F-8fC2-004`, subido a `ALTA` |
| `F-8eC2-008` · cuatro capítulos del núcleo sin unidad | **SIGUE, mirado y declarado abierto** | `03`, `04`, `07` y `08` siguen fuera de las 22 filas; `B/descomposicion` §2.9 lo nombra y lo deja como pregunta → `F-8fC2-010` |
| `F-8eC2-009` · el `updated:` desfasado | **SIGUE, reducido** | de **21 de 33** a **15 de 30**; el contrato de cobertura sigue entre ellos → `F-8fC2-011` |

**Conteo: 1 corta · 8 siguen llegando.** Es lo contrario de la vuelta anterior (4 cortes), y la
explicación está medida: **la tanda de la 9-bis-4 fue enorme en los capítulos y casi no tocó los
documentos de mi vector.** De los seis documentos que mi vector recorre —el corte, la partición, el
contrato, los dos `spec.md` y las dos `descomposicion.md`—, los 76 commits abrieron **cinco**, y el
único que abrieron con mandato de repartir trabajo fue `B/descomposicion.md`. El corte no lo abrió
nadie, y la partición tampoco: `git log --oneline 5ac5e92c9~1..HEAD -- 11-particion-del-programa.md`
devuelve **cero**.

---

## 5. Ataques que intenté y el diseño resistió

Seis, y valen tanto como los hallazgos.

**1. «La discontinuación de una vertical es una tercera dependencia entre épicas en la dirección de
las ESCRITURAS: `B12` escribe `vertical.fin_de_servicio`, que es una columna de `V/02` §2.1.»** Lo
armé entero y **el diseño lo sostiene mejor de lo que esperaba**. La columna es de verticales y la
lee billing, pero el acto de discontinuar **es** de billing por reparto explícito
(`11-particion` §4, fila 10: *«el retiro de un plan y la **vertical discontinuada** a billing»*), así
que quien la escribe es quien la decide y la columna es sólo dónde vive el dato. Y el contrato §4.1
la declara por su nombre en `situaciónDeVertical`. **Lo que NO resistió es quién construye esa
escritura y que `B/descomposicion` §2.6 no la cuente como dependencia**, y eso es `F-8fC2-001`.
La forma del corte aguanta; el inventario del trabajo no.

**2. «El corte quedó expuesto a `S22`, `S23`, `S24` y `S25`: una baja directa desde `PAUSED`,
`SUSPENDED` o `GRACE_PERIOD` lo cruza.»** Lo rearmé con las cuatro filas nuevas y **sigue sin
existir**, por el mismo motivo que las dos vueltas anteriores y ahora con más filas que lo prueban.
El sistema nuevo no hereda una sola fila hasta el paso 4 —*«El sistema nuevo no hereda una sola
fila»* (`B/21` §2.4)—, así que no hay `PAUSED`, ni `SUSPENDED`, ni `GRACE_PERIOD`, ni sucesión, ni
cortesía diferida, ni pagador manual sobre los que las cuatro puedan correr. **El corte es inmune a
las cuatro bajas nuevas, a `MP4`, a `MP5` y a `reconciliation_mark`, y lo es por construcción.**

**3. «`DEC-DATA-002` metió un dato de billing adentro de verticales: `listing.inactiva_desde` se
reinicia con el fin de servicio de una vertical, que lo decide billing.»** No. Medí la frontera
después de la tanda y **el hecho 4 no transporta un estado de cobranza**: transporta una **fecha de
catálogo**, que es la misma clase de dato que `permitePausa` y que el contrato §4.1 declara
explícitamente como *«política y estado de catálogo, nunca capacidades»*. Y `NUCLEO/01` §1.2 escribe
la razón de que exista: *«ahí el dueño **no puede** actuar, así que contar su ausencia lo castigaría
por una decisión nuestra»*. **La frontera aguantó las doce decisiones nuevas enteras**, que sigue
siendo el resultado más sólido del programa en cinco vueltas.

**4. «El reparto de los catorce guards concentró cuatro en `B3` por comodidad, y eso es el patrón que
la regla 1 prohíbe.»** Lo intenté y **el rastro lo contesta con una medición, no con un argumento**:
`rastro-40b922120.md` §3 dice *«Los cuatro de `B3` anclan todos en el mismo `B/02` §2.2 —la tabla que
crea `sucede_a`, `sucedida_por`, la fecha de nacimiento de la fila y `reconciliation_mark`—, que es la
razón de que una sola unidad se lleve cuatro sin que sea concentración por comodidad»*. **Lo
verifiqué contra `B/02` §2.2 y es cierto**: los cuatro guards nombran esa tabla en su columna *«de
dónde sale»*. Es de las asignaciones mejor argumentadas del reparto.

**5. «`G-R6-B` va con `V6` y sus lectores nacen en `V8`, `V9` y billing: nace con lista de
excepciones.»** Lo intenté y **`V/descomposicion.md` §2.5 ya lo había pensado y lo contesta al
revés**: *«Un guard que naciera con el último de ellos llegaría cuando los cinco ya existen y
**nacería con lista de excepciones**; naciendo en V6 ve llegar a los tres de afuera **uno por uno**, y
cada uno tiene que traer su fila al `02` §2.5 para pasar»*. La elección entre `V6` y `V9` está
discutida con las dos candidatas nombradas y el criterio explícito. **Es el § mejor escrito de las dos
descomposiciones y el modelo de cómo debería verse cada una de las otras 28 asignaciones.** Lo que no
resistió es que esa calidad no llegó al criterio de terminación de `V6`, y eso es `F-8fC2-003`.

**6. «El paraguas se puede partir ahora que `B2` no tiene ninguna atadura con la pasarela: que salga
verticales sola, o que salga `B2` antes.»** Lo intenté por quinta vez y **falla igual**.
`DEC-ARCH-007` no es una preferencia sino un mecanismo —*«la unidad que llega a `staging` es el
paraguas»*, `11-particion` §6.1—, y `B2` sola no compra nada: su criterio es *«un monto escrito en
código falla; un precio con decimales no se puede guardar»*, que no es un producto. **La partición
aguanta, y su punto más fuerte sigue siendo que la hace cumplir el flujo de ramas y no la memoria de
nadie.** Lo que la rama compartida sí produce, y es nuevo esta vuelta, es que **un guard rojo de una
épica bloquea los PRs de la otra** — paso 8 de `F-8fC2-003`.

---

## 6. Líneas de rastro que ataqué

**Revisé 45 líneas de aparición y 11 ítems de auto-corrección, de los diez rastros. Una línea resultó
FALSA, una resultó CADUCA dentro de su propia tanda, las 43 restantes se sostienen, y de los 11 ítems
de auto-corrección verifiqué 6 contra el texto y los 6 se sostienen.**

**Qué elegí y por qué.** Las instrucciones dicen que *«donde el rastro es fino, la probabilidad de una
justificación floja es más alta — pero donde es grueso, el volumen mismo es un riesgo»*. Mi criterio
fue otro y es el de mi vector: **ataqué todas las líneas que tocan los siete documentos que reparten,
declaran o coordinan el conjunto**, sin importar de qué rastro vinieran, porque ahí es donde un error
no lo ve ningún capítulo. Las conté con `rg -n "^### \`?<archivo>"` sobre los diez rastros y `awk`
sobre cada sección:

| documento | líneas de rastro | en qué rastros | resultado |
|---|---|---|---|
| `12-contrato-de-cobertura.md` | **23** | `032f761e0` (3) · `5836ec219` (7) · `8d6b27a12` (1) · `8f9f31ac0` (2) · `ce52dce5f` (3) · `f21d5d828` (12 agrupadas en un bloque) | las 23 se sostienen |
| `11-particion-del-programa.md` | **7** | `12cc0879f` (3) · `5836ec219` (3) · `f21d5d828` (1 ítem, **4 rangos**) | **1 FALSA** → `F-8fC2-002` |
| `V/spec.md` | **5** | `5836ec219` · `12cc0879f` | las 5 se sostienen; ninguna es la fila *«el núcleo»* (`F-8fC2-008`) |
| `nucleo/00-indice.md` | **3** | `12cc0879f` · `31ce26bb2` | se sostienen; ninguna es el *«51 invariantes»* |
| `V/descomposicion.md` | **2** | `5836ec219` | **1 CADUCA** (ver abajo) |
| `B/descomposicion.md` | **2** | `032f761e0` · `5836ec219` | se sostienen; ninguna es el §2.6 ni el §4 |
| `16-fase-7-del-paraguas.md` | **1** | `8f9f31ac0` | se sostiene, y es la única de 1.030 (`F-8fC2-004`) |
| el §5 sección F de `rastro-40b922120.md` (*«las dos `descomposicion.md`»*) | **2** | `40b922120` | se sostienen; ninguna es un criterio de terminación (`F-8fC2-003`) |
| las tres secciones de auto-corrección (`12cc0879f` §5, `ce52dce5f` §6, `8d6b27a12` §5) | **11 ítems** (3 + 3 + 5, contados por mí) | — | verifiqué **6** de los 11 contra el texto y los 6 se sostienen (ver abajo) |

**Las seis auto-correcciones que verifiqué, y qué verifiqué de cada una.** Elegí las que afirman que
un estado del corpus cambió, porque son las únicas falsables: (1) `12cc0879f` §5 fila 1 —*«`G-R6`
quedó acotado a las seis tablas de billing … la decisión no tomó [la fila]»* es falsa hoy— **cierto**:
`V/20` §2 tiene fila `G-R6` y `B/20` §2 dice *«las nueve máquinas, en las dos épicas»*, las dos
verificadas en mi conteo de filas; (2) `12cc0879f` §5 fila 2 —*«el catálogo de `B/20` §2 no lista a
`G12` ni a `G13`»* es falsa hoy— **cierto**: los dos están en mis 16 filas; (3) `12cc0879f` §5 fila 3
—el *«13 de 27»* caduco— **cierto**: `B/20` §2 lo deja anclado con su nota; (4) `8d6b27a12` §5 punto 1
—`B/10` §4.3 corregido por `DEC-SUB-015`— **cierto**: el § lleva hoy el bloque *«La pausada NO entra
al piso, y eso es legal»*; (5) `8d6b27a12` §5 punto 3 —*«la fila la puede matar `S23` **o `S24`**»*—
**cierto**: `S24` existe y su celda dice *«si la fila es la predecesora de una sucesión en curso,
dispara `S18`, igual que `S23`»*; (6) `ce52dce5f` §6 punto 1 —la corrección incompleta de *«nueve →
once puertas»* en `B/16` §4.4— **cierto que se completó ahí**, y anoto que el número volvió a moverse
después (`F-8fB1-006` y `F-8fB2-007` miden **trece** contra **doce**): eso es de ellos y no lo cuento.

**La falsa, con su cita.** `rastro-f21d5d828.md` **L331-337**, un ítem que agrupa **cuatro rangos de
línea disjuntos** de `11-particion-del-programa.md` y los cierra con *«**las cuatro siguen
correctas**»* dando **un solo argumento**, que aplica a uno de los cuatro. El rango **L139-147** es el
§3.2 punto 1, y su primera mitad la contradice la tabla de `V/03` §2 de hoy y la segunda la
contradice `T7`. Está en `F-8fC2-002`.

**La caduca, con su matiz, porque no es lo mismo.** `rastro-5836ec219.md` **L225-227** declara sobre
la celda de `V9`: *«siguen **cuatro** hechos y **tres** avisos; lo que la unidad gana es una columna y
una relectura, **que no cambian ninguno de los dos conteos ni su guard**»*. La afirmación era
**correcta para su familia** —la retención no le tocó el guard a `V9`—, pero **la quinta enmienda de
`DEC-TEST-001`, dos días después y dentro de la misma tanda, le sacó `G-R5` a `V9` y lo mandó a
`B8`**, y la celda hoy dice *«— *(decía «el de `D16`», que era `G-R5`; se va a `B8` — §2.7)*»*. **No
la cuento como falsa**: la cuento como el mismo modo que `F-8fB3-009` mide del otro lado —*«el conteo
lo escribió un commit y lo invalidó el siguiente de la MISMA familia»*—, que es el modo de falla
propio del rastro por aparición cuando una tanda tiene 76 commits: **una justificación es una foto, y
la tanda sigue corriendo después de sacarla.**

**Un cero medido que vale decir.** `rg -c "updated:" 21-fase-9-bis-4/*.md` → **0 en los diez**. Los
quince frontmatters desfasados de `F-8fC2-011` no son una aparición de ningún término, así que
ninguno de los 1.030 recorridos los podía encontrar. **No es un fallo del barrido: es su forma.**

---

## 7. Fuera de mi vector

- **[`C1` — la costura]** `HOS-1354/docs/21-migracion.md` **sigue con sus secciones fuera de orden**:
  §1 → §1.3 → §3 → §3.3 → **§2.4** → §2.5 → §4, medido con `rg -n "^#{2,4} "`. **Es el quinto informe
  consecutivo que lo reporta intacto.**

- **[`C1` — deduplicación]** Los candidatos de mi lado: `F-8fC2-001` toca a `F-8fA3-004` (el cuarto
  hecho sin ejecutor) y a `F-8fA3-008` (`plan.vertical` fuera de la dirección inversa) **en el mismo
  documento y por la misma causa**; `F-8fC2-003` toca a `F-8fA1-004` y a `F-8fB3-007`, que atacan
  `G-R6` desde su predicado; `F-8fC2-005` toca a `F-8fA3-018` y `F-8fA3-020`, que atacan el mismo
  aviso desde el calendario. **Mi mitad en los tres casos es la única que no se resuelve escribiendo
  una columna o corrigiendo un conteo: se resuelve agregando una fila a una tabla de unidades.**

- **[`C1` — el veredicto de método]** Reparto de mis once contra la tercera línea: **dos** contestan
  *sí* (`F-8fC2-008`, la aparición a diez renglones dentro del archivo que dos commits de recuento
  abrieron; `F-8fC2-011`, quince frontmatters) · **uno** contesta *sí a medias* (`F-8fC2-009`: el
  rastro recorrió la celda de `V9` y no el criterio treinta renglones abajo) · **uno** está *en el
  rastro con justificación falsa* (`F-8fC2-002`) · **cinco** contestan *no por límite estructural* —
  una fila que falta, una cláusula que falta o una afirmación cuantificada no son apariciones
  (`F-8fC2-001`, `003`, `005`, `007`, `010`) · **uno** contesta *no porque sobre ese archivo no hay
  apariciones de nada* (`F-8fC2-004`) · **uno** contesta *no porque nace en la prosa que el commit
  escribió* (`F-8fC2-006`, modo 1 de `C1` §4.4). **Dos alcanzables y no ejecutadas · una ejecutada y
  resuelta mal · ocho inalcanzables por cuatro motivos distintos.** El dato que me parece el más
  cargado para el veredicto: **de mis once, el único que el rastro tocó lo tocó y lo declaró
  correcto.**

- **[`NUCLEO` → `C1`]** `nucleo/00-indice.md` lleva el *«51 invariantes»* que sostiene la
  indivisibilidad del núcleo (`F-8fC2-008`), y sigue siendo el documento donde tendría que estar
  enunciada la convención del `updated:` (`F-8fC2-011`). `nucleo/07` §6 y `nucleo/08` §3 son los
  capítulos sin unidad de `F-8fC2-005` y `F-8fC2-010`.

- **[repo, no diseño]** `F-8cC2-005` sigue entero: `rg -c "SPEC-143-billing-testing-coverage"
  CLAUDE.md` → **3**, y el directorio sigue sin existir en esta rama. El gate manual de billing que el
  `CLAUDE.md` del repo declara *«no negociable»* apunta a tres archivos que esta misma rama borró, y
  el PR que lo va a destapar es el que `DEC-ARCH-007` describe como el que *«nadie puede revisar de
  verdad»*.

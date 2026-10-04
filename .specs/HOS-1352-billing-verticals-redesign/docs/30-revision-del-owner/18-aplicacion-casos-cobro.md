---
title: "Revisión del owner · casos vecinos 20 a 40: el cobro"
linear: HOS-1352
statusSource: linear
created: 2026-09-29
updated: 2026-09-29
status: CURRENT
fase: 9
---

# Revisión del owner · casos vecinos 20 a 40: el cobro

Los lotes C (casos 20 a 29) y D (casos 30 a 40) de
[`16-casos-vecinos-decididos.md`](./16-casos-vecinos-decididos.md), con el detalle original de
[`14-aplicacion-transversal-y-lote.md`](./14-aplicacion-transversal-y-lote.md) §3 y del § Casos
vecinos de [`13-aplicacion-cobro.md`](./13-aplicacion-cobro.md). Medido y editado en el worktree
`hospeda-spec-hos-1352-billing-redesign` sobre el HEAD `e4ce09585f`, sin commits. Leído antes,
entero, el registro de la tanda anterior
([`17-aplicacion-casos-corte-y-verticales.md`](./17-aplicacion-casos-corte-y-verticales.md)): no
pisé nada suyo. No toqué los casos 41 a 50. Abreviaturas: `B/` es `HOS-1354…/docs`, `V/` es
`HOS-1353…/docs`, `D/12` el contrato, `D/16` la FASE 7 del paraguas, `nucleo/` el núcleo, `$V/` y
`$B/` la raíz de cada sub-spec.

**Forma**: tachado y fechado `(revisión del owner, casos vecinos, 2026-09-29, caso N)`. Los números
nuevos no reusan ninguno retirado: la transición nueva es **`S38`** (la última viva era `S37`, y
`S25`–`S28` siguen retiradas) y las filas nuevas de la segunda lista del falso son **`RP7` a
`RP11`**.

## 1. Qué se aplicó

### Caso 20 · los siete días de `S37`, técnicos y no configurables

`nucleo/02` §1.5 ya los listaba entre los plazos técnicos; lo dije también donde vive el mecanismo:

- `B/10:180` «Los siete días son un plazo técnico, no configurable»
- El `nucleo/02` ya lo decía: `nucleo/02:153` «y los 7 días de `S37` antes de la renovación»

### Caso 21 · «a 30 y a 7 días» es antes de la renovación de cada cliente

- `B/10:166` «30 días y 7 días antes de»
- `nucleo/07:239` «30 días y 7 días antes de la fecha de renovación de ese cliente»
- `nucleo/02:144` «y los contactos 30 y 7 días antes de la renovación de cada cliente»
- `B/19:123` «30 días y 7 días antes de la fecha de renovación de ese cliente»

El aumento de precio (`nucleo/07` fila de arriba, plazo 11) dice lo mismo en mensual y no lo toqué:
el caso es de la migración.

### Caso 22 · la migración sigue siendo la decimoséptima

Ya eran dos filas; lo dejé escrito en la de la migración:

- `nucleo/08:186` «Y sigue siendo una fila propia, aparte de publicar una versión de plan»

### Caso 23 · `S37` aplica lo que la persona firmó

`V/17` §3.3 ya lo decía; quedó marcado como confirmado, y vale igual para `S38` (caso 37):

- `V/17:455` «confirmado por el owner»

### Caso 24 · la cuenta del propio `SUPER_ADMIN` se excluye y el acto sigue

- `B/10:157` «cohorte incluye la cuenta del propio»
- `V/17:423` «la cohorte puede incluir la cuenta del propio `SUPER_ADMIN` que la lanza»
- `nucleo/08:186` «Si la cohorte incluye la cuenta de quien la lanza, esa fila se excluye y el acto sigue»
- La previsualización: `B/19:217` «excluida»

No se le escribe fila de alcance (no es una suscripción alcanzada), así que ni `FUERA` ni sus
motivos cambian.

### Caso 25 · cancelar dentro de los siete días no deshace la mutación

El correo de la cancelación pasa a tener dos textos; **no es una fila nueva** del catálogo de
`nucleo/07` §6:

- `B/10:202` «Tampoco las que están dentro de sus siete días»
- `nucleo/07:240` «la cancelación no lo alcanza, porque su cambio ya empezó»
- `B/19:123` «que la cancelación no lo alcanza porque su cambio ya empezó»

### Caso 26 · `PARA_RESOLVER` sin plazo, con la antigüedad a la vista

La antigüedad se cuenta desde `anunciada_en` de `plan_migration`, que ya existía (una fila nace
`PARA_RESOLVER` al anunciar): no hace falta columna nueva.

- `B/10:188` «Sin plazo»
- `B/19:217` «sin plazo y con su antigüedad»

### Caso 27 · la cortesía temporal espera, como está

Sale del «NO cierra» de `B/10`, que pasa de dos cosas a una:

- `B/10:244` «Un cliente con una cortesía temporal vigente el día de su migración espera, como»

### Caso 28 · lo que quedaba afuera va a la segunda lista, como comportamiento medido

Cinco filas nuevas, `RP7` a `RP11`, con su fila de la matriz (el campo `last_charged` es `RC-5`):

- `B/20:479` «con su comportamiento medido»
- `B/20:535` «RP11»
- `B/20:538` «Son once, recontadas sobre la tabla»
- `B/20:597` «Cerrado entero»
- La batería: `B/20:646` «las once reglas propias y comportamientos medidos»
- `$B/descomposicion.md:127` «las once reglas propias y comportamientos medidos»
- `$B/descomposicion.md:219` «las once reglas propias y comportamientos medidos en la otra lista»

`G15` no cambia: su predicado mira la primera lista.

### Caso 29 · las tres cifras de la presentación

La presentación no está en el repo. Dejé constancia sólo donde el diseño cita la cifra o su
fuente: el *«5 de 8»* sale de `$B/spec.md` §3.3, y *«fuera de orden»* vive en `B/20` como
simulación. El *«hasta 14 días de demora»* no lo cita ningún lugar del diseño (grepeado), así que no
hay dónde dejar constancia.

- `$B/spec.md:137` «La presentación lo cita como»
- `B/20:549` «la presentación los ponía entre las mentiras»

### Caso 30 · el package del cobro puede depender de packages internos (contra la recomendación)

La promesa de N2 (*«se puede publicar solo»*, *«sin reescribirlo»*) se tacha en los cuatro lugares
que la hacían; la regla del owner va textual en `$B/spec.md` §3.1:

- `$B/spec.md:102` «del repo; publicarlo en npm pediría reescribir sus dependencias internas»
- `$B/spec.md:104` «Sí puede depender»
- `$B/spec.md:109` «no mira sus dependencias hacia packages internos»
- `$B/descomposicion.md:127` «package compartido del repo que puede depender de packages internos»
- `D/16:467` «publicarlo en npm pediría reescribir sus»
- `B/20:67` «No mira sus dependencias hacia packages internos de Hospeda»
- `B/20:72` «sin `qzpay` (`B/spec.md` §3.1; caso 30)»
- `B/20:76` «y es a propósito: puede tenerlas»

**Lo que no cambió**: `G16` sigue con sus dos predicados, `@qazuor/qzpay` en cualquier lugar e
importar de `apps/`; lo segundo no es una dependencia de package sino de una app, y el caso no lo
nombra. `G14` sigue prohibiendo que el cobro importe de la mitad de verticales. El contrato
(`D/12` §7.1) ya dependía de `@repo/schemas` y no prometía publicarse.

### Caso 31 · el reloj adelantable, en un package de pruebas compartido

- `B/20:724` «package de pruebas compartido que importan las dos mitades»
- `V/20:58` «Importar el package de pruebas compartido del reloj adelantable no es cruzar»
- `$B/descomposicion.md:127` «en un package de pruebas compartido que importan las dos mitades»

### Caso 32 · la regla de smoke del `CLAUDE.md`, con cada sección

El `CLAUDE.md` raíz no se toca acá: el diseño dice qué unidad lo cambia y cuándo.

- `B/20:735` «actualiza la regla de smoke»
- `$B/descomposicion.md:139` «el recorte del checklist de smoke manual»

### Caso 33 · la autorización mensual la custodia el owner

- `B/20:654` «La autorización la custodia el owner y la renueva cada mes»

### Caso 34 · el correo de Mercado Pago al subir el monto

La fila de la matriz va propuesta en el §4; en el diseño quedó dicho que falta:

- `B/10:182` «Qué correo»

### Caso 35 · la lectura por id lleva su instante (opción 2)

**Va dentro del tipo, no como tercer predicado de `G17`.** El único camino al estado del proveedor
ya es el tipo que sólo el adaptador construye (`G17` *(b)*); si ese tipo sólo entrega el estado
contra el comienzo del acto, *(b)* alcanza y el *cuándo* queda impuesto sin que un guard estático
tenga que adivinar tiempos. El rechazo lo prueba un caso de `B1`. Así `G17` conserva sus dos
predicados y **el catálogo sigue en 33 guards**, y `D17` sigue con dos apoyos, servicio y guard.

- `nucleo/04:144` «El cuándo va dentro del tipo»
- `nucleo/04:144` «la decisión rechaza una lectura anterior al comienzo del acto»
- El ejemplo y el comienzo del acto por sujeto: `nucleo/04:144` «un proceso nocturno que leyó 500 a las 3:00 y llega a Juan a las 3:40 lo tiene que releer»
- El límite: `nucleo/04:144` «Límite declarado»
- `nucleo/04:310` «el cuándo lo impone»
- `B/20:68` «no es un tercer predicado»
- `B/20:80` «El comienzo del acto es el de la decisión sobre ese sujeto»
- `B/20:82` «Y queda un límite, declarado»
- `B/03:2708` «una anterior al comienzo del acto»
- `$B/descomposicion.md:127` «con su instante»

### Caso 36 · la fila 6 de dependencias queda así

Sin cambio de texto: el diseño ya lo dice.

- `$B/descomposicion.md:348` «Es la misma fila y no una nueva»

### Caso 37 · la cola de `B/12` §2 tiene transición: `S38`

`S38` aplica el cambio programado de la cola, el descenso de un downgrade y el cambio de versión de
una migración. **Al nombrarla apareció un hueco más del mismo origen**: el censo de emisores del
contrato listaba el cambio de versión de la migración y **no el descenso de un downgrade**, que le
cambia la `referencia` a la fuente igual. Lo sumé a la misma línea.

- `B/03:188` «llega la fecha del cambio programado de la fila»
- `B/03:188` «Es el nombre del acto que la cola ya describía y no tenía fila»
- La de `S37` que la nombraba sin transición: `B/03:187` «por `S38`»
- `B/12:190` «La transición que la aplica es»
- `B/10:179` «por `S38`»
- `D/12:875` «y el descenso de un downgrade, que viaja por la misma cola: los dos los aplica `S38`»
- `$B/descomposicion.md:145` «treinta y cuatro transiciones vivas»
- `$B/descomposicion.md:148` «`S31` y `S38` → B8»
- `$B/spec.md:61` «`S1`–`S38`»

### Caso 38 · la fila de `B12` de la discontinuación, tachada

- `$B/descomposicion.md:238` «tachada en los casos vecinos»

### Caso 39 · `WH-6` antes de cerrar el diseño; si no, registrar sin actuar

Escrito condicional, como pidió el owner:

- `B/06:490` «se mide antes de cerrar el diseño»
- `B/06:490` «el receptor nuevo registra los avisos IPN sin actuar»

### Caso 40 · `M-SUB-03`, cerrado

En el frontmatter de las dos mitades del capítulo 10 (`V/10` es el espejo de `B/10` y tenía el
mismo ítem), como comentario de YAML para que el valor siga siendo el ID. `V/10` tenía además sin
tachar la frase del encabezado que `B/10` ya había tachado con C8:

- `B/10:12` «M-SUB-03 # cerrado: no se discontinúan verticales»
- `V/10:12` «M-SUB-03 # cerrado: no se discontinúan verticales»
- `V/10:27` «queda cerrado: no se discontinúan verticales»

## 2. Conteos que cambiaron

| qué | antes | ahora | cómo se contó | espejos corregidos |
|---|---|---|---|---|
| transiciones vivas de la Suscripción | 33 (`S1`–`S37` sin `S25`–`S28`) | 34 (entra `S38`) | script sobre las filas de `B/03` §3.2 que empiezan con `S<n>` sin tachar | `$B/descomposicion.md` §2, `$B/spec.md` §2 (`S1`–`S38`) |
| filas de la segunda lista del falso | 6 | 11 (`RP7`–`RP11`) | script sobre las filas `RP<n>` de `B/20` §3.2 | `B/20` (recuento y batería), `$B/descomposicion.md` (fila B1 y §2.3) |
| mentiras de la primera lista | 13 | 13 | script sobre las filas `M<n>` | sin cambio |
| cosas sin cerrar de la migración en el «NO cierra» de `B/10` | 2 | 1 | leídas | `B/10` |
| textos del correo de la cancelación de una migración | 1 | 2 (la misma fila del catálogo) | leídos | `nucleo/07`, `B/19` |
| decisiones precisadas sin `SUPERSEDED`, si el owner aprueba el §4 | 58 (63 si antes se aprueba el §4 de `17-`) | 60 (65) | `contar-precisadas.py` sobre copias del log con las líneas de *Estado* simuladas: sólo `DEC-SUB-023` y `DEC-TEST-003` están hoy en `ACCEPTED` a secas | sólo el log, si el owner lo aprueba |
| filas de la matriz, si el owner aprueba el §4 | 111 = 55 · 17 · 23 · 16 | 112 = 55 · 17 · 23 · 17 | sobre la propuesta; se recuenta con `contar-filas-de-la-matriz.py` al escribirla | los de la matriz, y los espejos que lista `15-` §3 |

**Lo que no se movió**: los 33 guards (18 · 15: el instante del caso 35 va dentro del tipo, y
`G16` cambia de alcance declarado, no de predicados); `G17` sigue con dos predicados; los apoyos de
`nucleo/04` §3 (`D17` sigue en servicio y guard); las 21 acciones administrativas (la exclusión del
caso 24 es una regla de la 17, no una acción); los 24 motivos; los cinco hechos del reloj; las
siete entradas del contrato (el censo de emisores es una lista de auditoría: creció en contenido,
no en entradas); las once dependencias entre épicas (caso 36); el catálogo de correos de
`nucleo/07` §6 (el caso 25 es un segundo texto del mismo correo); los 17 pasos del corte.

## 3. Casos vecinos (piden decisión, no los decidí)

1. **`S38` cuando la fecha llega con la fila en `GRACE_PERIOD` o en `SUSPENDED`.** La escribí
   desde `ACTIVE`, y la pausada espera por la colisión 4 del `B/12` §2.2. Para la grace y la
   suspensión no hay regla escrita, y es anterior a los casos vecinos: el descenso de un downgrade
   ya tenía este hueco antes de tener transición. Tres formas: esperar a volver (como la pausada),
   aplicarse igual (el cambio no toca al proveedor), o descartarse en `SUSPENDED` y esperar en
   grace. Recomiendo **aplicarse igual en `GRACE_PERIOD` y esperar a volver en `SUSPENDED`**: en
   grace el servicio sigue y el monto ya se mutó, así que esperar deja al cliente con capacidades
   que ya no paga; en `SUSPENDED` no hay servicio que bajar, y al volver por `S7` se aplica.
2. **Dónde vive la interfaz del reloj que lee el código de producción** (caso 31). El reloj
   adelantable vive en el package de pruebas, pero para adelantarlo el código de las dos mitades
   tiene que leer la hora por una interfaz inyectada, y ésa sí la importa producción. No está
   escrito si va en el package del contrato o en cada mitad. Recomiendo el contrato: ya es el único
   package que importan las dos, y `G14` no cambia.
3. **Cómo repite la batería las cinco filas nuevas de la segunda lista** (caso 28). `RC-7`, `GR-3`
   y `RC-5` se midieron en producción sobre ciclos reales de cobro rechazado, a lo largo de días;
   una corrida semanal en la cuenta de pruebas no las reproduce en una pasada. Recomiendo que la
   batería las relea sobre los sujetos que ya existen (lectura sin mutar) y que las que no se
   puedan releer se declaren *«vigiladas a mano»*, como `R-MP-01`.
4. **Dónde registra el receptor nuevo los IPN sin actuar** (caso 39), si `WH-6` no se llega a
   medir. El modelo de `B/02` no tiene hoy una tabla de avisos recibidos: `provider_link` guarda
   sólo la última `version` aplicada. Recomiendo una tabla propia, sólo de altas, con el canal, el
   cuerpo y el instante, que ninguna transición lea; así registrar no puede volverse actuar.

**Fuera de lo que este registro puede editar**: el caso 29 corrige tres cifras de la presentación
al publicarla, que es el paso 4 de `03-handoff.md`; conviene que el orquestador sume ahí
*«"5 de 8" con su fuente, sin "hasta 14 días de demora" y con "fuera de orden" como simulación»*.

## 4. Para el log y la matriz (pide OK del owner)

Cada ID grepeado en `01-decision-log.md` y en la matriz el 2026-09-29: existen `DEC-SUB-023`,
`DEC-TEST-003`, `DEC-ARCH-004`, `DEC-SUB-008` y `WH-6`; ninguno tiene un 📌 de los casos vecinos, y
ninguno de los nueve de `17-` §4 se repite acá. **`EX-54` no existe** (la última `EX` es `EX-53`).
Cada 📌 suma a su *Estado*: *«precisada el 2026-09-29, con OK del owner (revisión del owner, casos
vecinos, <casos>; ver su 📌)»*, o *«y precisada…»* donde ya había precisiones (`DEC-ARCH-004` y
`DEC-SUB-008`).

1. **📌 en `DEC-SUB-023`** (casos 20 a 27): *«`S37` muta el monto siete días antes de la fecha de
   aplicación, un plazo técnico y no configurable. Los correos van al anunciar y 30 y 7 días antes
   de la fecha de renovación de cada cliente. La migración sigue siendo la acción 17, aparte de
   publicar una versión de plan, y lo que aplica fila por fila (`S37` y `S38`) es una transición que
   aplica lo que la persona firmó al anunciar. Si la cohorte incluye la cuenta del propio
   `SUPER_ADMIN`, esa fila se excluye y el acto sigue. Cancelar no deshace una mutación ya hecha:
   a quien está dentro de sus siete días le sale un correo que lo explica. `PARA_RESOLVER` no tiene
   plazo, y el panel muestra su antigüedad. Una cortesía temporal vigente el día de la migración
   espera a volver.»*
2. **📌 en `DEC-SUB-008`** (caso 37): *«El descenso programado lo aplica `S38`, la transición de la
   cola de `B/12` §2 que también aplica el cambio de versión de una migración: pasa la fila a la
   versión destino, aplica la elección de qué conservar y emite el aviso de cobertura.»* **Razón**:
   la decisión dice *«baja los entitlements al fin del ciclo»* y ninguna transición lo hacía.
3. **📌 en `DEC-ARCH-004`** (caso 30, contra la recomendación): *«El package del cobro es un
   package compartido del repo; publicarlo en npm pediría reescribir sus dependencias internas. Puede
   depender de packages internos de Hospeda con la regla del owner: "siempre que sea simple evitar la
   dependencia de otro package de Hospeda, evitalo; si es complejo, la dejamos y en el futuro se
   reverá", porque "no quiero demorar la salida de esta épica por eso". `G16` no mira esas
   dependencias; la prohibición de `@qazuor/qzpay` sigue.»* **Razón**: su 📌 del 2026-09-28 dice
   *«de modo que se pueda publicar como package npm propio sin reescribirlo»*, y eso deja de ser
   cierto.
4. **📌 en `DEC-TEST-003`** (casos 28, 31, 32, 33 y 35): *«La segunda lista del falso lleva también
   el comportamiento medido que no es mentira ni regla exigida (`RC-7`, `GR-3`, `PS-2`, `PS-6` y el
   campo `last_charged` de `RC-5`): son once, no seis. El reloj adelantable vive en un package de
   pruebas compartido que importan las dos mitades. La regla de smoke del `CLAUDE.md` raíz se
   actualiza, en el mismo cambio, a medida que cada sección del checklist sale del manual. La
   autorización mensual de la batería en producción la custodia el owner y la renueva cada mes.
   Y cada lectura por id lleva su instante: la decisión rechaza una lectura anterior al comienzo
   del acto, que es el de la decisión sobre ese sujeto; va dentro del tipo, así que `G17` conserva
   sus dos predicados. Queda una ventana de milisegundos entre releer y actuar, porque Mercado Pago
   no ofrece compare-and-swap, y la cubre el barrido.»* **Razón**: la decisión dice *«seis reglas
   propias»*.
5. **Matriz, fila nueva `EX-54`** (`UNKNOWN`, caso 34): *«¿Qué correo le manda el proveedor al
   pagador cuando le SUBIMOS el monto de un preapproval, con qué texto y en qué momento respecto de
   la mutación?»* `EX-3` lo midió al bajar (*«El vendedor Hospeda cambió el monto»*). Se mide con
   una mutación hacia arriba sobre un preapproval de prueba, leyendo la casilla del pagador.
   **Razón**: que el tercer correo de la migración lo anticipe con el texto exacto (`B/10` §3.7
   punto 4). **Con ella la matriz pasa de 111 a 112 filas, y `UNKNOWN` de 16 a 17**; los espejos
   son los que lista `15-` §3 (`spec.md` del paraguas, `$B/spec.md`, `B/06` y
   `$B/descomposicion.md` §2.7, que además tendría que darle unidad).
6. **Matriz, un 📌 en `WH-6`** (caso 39): *«Se mide antes de cerrar el diseño (paso 2 del handoff).
   Si no se llega a medir, el receptor nuevo registra los avisos IPN sin actuar hasta que esta fila
   esté medida (`B/06`, "lo que este capítulo NO cierra").»* No cambia su estado.

**Sin propuesta**: el caso 29 (la presentación no es del log); el 36 (no cambia nada); el 38 (es un
tachado en una tabla que el propio § marca como rastro); el 40 (el frontmatter; `M-SUB-03` ya lo
cerró C8 en el log, con los cuatro `SUPERSEDED` de la discontinuación).

## Key Learnings

1. Nombrar una transición que faltaba destapa a quién más le faltaba: el censo de emisores del
   contrato tenía la migración y no el descenso de un downgrade, que viaja por la misma cola.
2. Un *«cuándo»* que un guard estático no puede ver se impone mejor en el tipo por el que pasa el
   dato: si el único camino al estado exige el instante, el guard de *«de dónde»* ya alcanza.
3. Un ítem cerrado en una mitad de un capítulo partido en dos suele seguir abierto en el espejo:
   `V/10` conservaba `M-SUB-03` sin tachar.

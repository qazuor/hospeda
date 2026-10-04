---
title: "FASE 9 vuelta 1 · P1 y P2 aplicadas, y los dos residuos de 17-"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 9
---

# FASE 9 vuelta 1 — P1 y P2 aplicadas, y los dos residuos de `17-`

Aplica las filas P1 y P2 de `10-decisiones-del-owner.md` (las dos, opción 1, la recomendada) con
el texto y el impacto de `17-conteo-s18-y-dos-preguntas.md` §2 y §3, y cierra los dos residuos
de su §4 que el encargo nombra. Fui el único agente editando. No toqué el log ni la matriz. Rutas:
`V/` = `.specs/HOS-1353-…/`, `B/` = `.specs/HOS-1354-…/`, `D/` = `.specs/HOS-1352-…/docs/`. Las
líneas son las del worktree al cerrar esta pasada.

## 1. Lo aplicado

| ítem | archivo:línea | estado |
|---|---|---|
| **P1** — el detector sigue en `ACTIVE`; el hueco (sucesora en `GRACE_PERIOD` sin `S9`) se declara al lado del caso de `S3`, con población, desenlaces y la reparación | `B/09:631-642` | hecho |
| **P1** — entrada en *«lo que este capítulo NO cierra»* de `B/09`, con causa, «owner 2026-09-26, P1» y la reparación (`SUPER_ADMIN` vuelve a otorgar la cortesía cuando la fila vuelva a `ACTIVE`) | `B/09:989-1001` | hecho |
| **P1** — espejo en `B/14` §4.4, en el ⚠️ que nombra la sexta comprobación | `B/14:565-570` | hecho |
| **P2** — fila *«extender un trial»* de `NUCLEO/08` §3: es de verticales, fuera del contrato, `T4` con origen `SUPER_ADMIN` y motivo obligatorio, pasa el techo, suma al total visible, la construye V4; cita ~~§32~~ **§34.1** y `V/11` §3.4 | `D/nucleo/08-auditoria-y-observabilidad.md:162` | hecho |
| **P2** — efecto de `T4`: la cortesía no llega por `extenderTrial` | `V/docs/03-maquinas-de-estado.md:54` | hecho |
| **P2** — `V/11` §3.4: la extensión firmada por `SUPER_ADMIN` es de esta épica, no pasa por `extenderTrial` | `V/docs/11-trial.md:178-184` | hecho |
| **P2** — criterio de V4: suma la acción administrativa, fuera del contrato | `V/descomposicion.md:57` | hecho |
| **P2** — `B/14` §4.5: el acto no es de billing ni cruza el contrato; `extenderTrial` sigue sólo del canje; *«cortesía»* repartida entre las dos épicas | `B/14:591-601` | hecho |
| **Residuo (a)** — `S27` contra la fila de `S18`: la frase *«el segundo evento de `S18` no la nombra»* se tacha (contradecía a la fila) y se razona desde las filas de `S18` y `S28` | `B/03:495-506` | hecho |
| **Residuo (a)** — la cuenta *«faltan `S13` y `S27`»* se precisa: `S27` en su camino normal | `B/03:483` | hecho |
| **Residuo (a)** — el párrafo de los *«siete caminos»* de `S18` sin `S17` nombra a `S27` como octavo sólo en su rama con la sucesora ya autorizada | `B/03:641-644` | hecho |
| **Residuo (b)** — `S36` entra en la tabla de puertas de `B/09` §3, con la salvedad de `S23` para el pagador manual | `B/09:184` | hecho |
| **Residuo (b)** — salvedad 4: ~~trece de las catorce~~ **catorce de las quince**, `S36` en la lista, `S21` pasa a decimoquinta, ~~doce~~ **trece** principales, `S36` entre las que entran sólo con llamada (~~seis~~ **siete**) | `B/09:195` | hecho |
| **Residuo (b)** — la lista del reintento de la salvedad 4 | `B/09:200` | hecho |
| **Residuo (b)** — ~~dieciséis~~ **diecisiete** puertas | `B/09:165` | hecho |
| **Residuo (b)** — la lista de `B/03:286` (*«trece de la salvedad 4»* → **catorce**, con `S36`) | `B/03:286-287` | hecho |
| **Residuo (b)** — espejos del conteo: *«una de las ~~trece~~ catorce que reintenta el barrido»*; la lista del par `authorized`/`paused`/`pending` × terminal | `B/03:321`, `B/03:2738` | hecho |
| **Residuo (b)** — espejos de ~~dieciséis~~ **diecisiete** puertas | `B/03:2059`, `B/03:2093`, `B/03:2467`, `B/16:911` | hecho |

**El recuento, con script** sobre la tabla *«puerta a un estado terminal»* de `B/09` §3: **17**
puertas, **2** exentas (el espejo y `S17`) y **15** *«no»*; la salvedad 4 toma las 15 menos
`S21`, que entra por la 1: **14**.

**Cómo se resolvió `S27`, y por qué el diseño lo contesta.** La fila de `S28` (`B/03` §3.2) dice
que si la fila abandonada era una sucesora *«la sucesión no se cierra: se cae, como en `S3`»* y
*«`S18` no corre, porque su `desde` es una sucesora viva»*. Y la fila de `S18` tiene un tercer
`desde` —la sucesora en `CANCEL_SCHEDULED` por `S26` con la predecesora caída por `S27`—. Leídas
juntas: durante la ventana la sucesora espera autorización, así que en el camino normal `S27` la
alcanza con `S28` y `S18` no corre (la cuenta de *«faltan `S13` y `S27`»* queda como estaba);
sólo si la sucesora ya autorizó y `S17` todavía no ocurrió, `S26` la lleva a `CANCEL_SCHEDULED` y
`S18` cierra sin `S17`. La contradicción era de la frase del párrafo, no de la cuenta.
`B/03:504` y `:518` (el candado `A`) no cambian: hablan de una sucesora en
`PENDING_AUTHORIZATION`, y en `S27` ésa la abandona `S28`.

**markdownlint**: resultado en §4 al pie.

## 2. Lo que dejó declarado una opción elegida contra la recomendación

Ninguna: P1 y P2 son las recomendadas. Lo que la opción 1 de P1 deja —meses regalados perdidos y
avisos de mora injustos en la rama que termina suspendida— queda declarado igual, en el «NO cierra»
de `B/09`, con su causa y su reparación.

## 3. Propuestas para el log y la matriz

Ninguna. P2 no toca `DEC-ARCH-006` ni el contrato (lo dice `17-` §3, opción 1, *Impacto*), y P1 no
agrega mecanismo.

## 4. Residuos y verificación

1. **`B/14` §4.7, fila *«la cortesía durante el trial (§34.1)»***: dice *«no cambia: extiende el
   trial, que es nuestro»*. Es verdadera, pero no dice que el acto es de verticales; el §4.5 ya lo
   dice y la fila remite a él. No la toqué.
2. **`B/16:806`** enumera terminales que dependen de una llamada nuestra (`S12`, `S3`, `S13`,
   `S20`, `S21` y la lápida). Es ilustrativa, no un conteo de la salvedad 4, así que no le sumé
   `S36`.
3. **Superficie**: `17-` §3 opción 3 (un solo botón *«otorgar cortesía»* en Admin que llama a la
   acción de verticales si el beneficiario está en trial) no se eligió; *«se puede sumar
   después»*. Un panel que liste *«lo que regaló `SUPER_ADMIN`»* lee de dos épicas.

**markdownlint** (`npx markdownlint-cli2`) sobre `B/09`, `B/14`, `B/03`, `B/16`,
`D/nucleo/08-auditoria-y-observabilidad.md`, `V/docs/03-maquinas-de-estado.md`, `V/docs/11-trial.md`,
`V/descomposicion.md` y este registro: exit 0.

## Key Learnings

1. Una comprobación que busca en un solo estado deja un hueco sólo si ese estado es el único
   desde el que existe una acción. P1 se declaró en vez de ensancharse porque en el grace `S9` no
   tiene `desde`.
2. Una fila que se agrega a una transición (`S36`) arrastra todas las listas cerradas que la
   enumeran por forma: acá la tabla de puertas, la salvedad 4, su lista de reintento y sus tres
   espejos en `B/03` y `B/16`. La salvedad 4 había quedado sin `S36` porque su entrada en `B/03`
   no pasó por la tabla de `B/09`.
3. Antes de recontar a partir de *«la fila nombra X»*, hay que leer la fila de la transición
   hermana. La fila de `S18` nombra a `S27`, pero la de `S28` dice que en el camino normal `S18` no
   corre. Las dos tenían razón, cada una en una rama distinta.
4. *«Cortesía»* designa dos actos de dos épicas: la temporal, en meses, es de billing, y la del
   trial, en días, es de verticales. Dejar `extenderTrial` sólo para el canje evita que el techo
   se pueda saltear con un parámetro que cruza el contrato.

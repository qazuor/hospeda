---
title: "FASE 9 vuelta 1 · G5 — autorización, cobro, coherencia y registro"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 9
---

# FASE 9 vuelta 1 — G5: autorización, cobro, coherencia y registro

Resolución de los hallazgos del grupo G5 sobre el consolidado
`27-fase-8-vuelta-1/00-hallazgos.md`: los dos miembros de `R11`, los 18 sueltos de `A1`, `B1` y
`D1` que no están en ningún racimo, las cinco contradicciones chicas del §4 del consolidado y el
recuento del registro. **Este documento no edita nada**: propone texto y lo aplica el orquestador.

Cómo se armó la lista de IDs, con script sobre el consolidado (bloques `### R…` del §2 y filas
`` | `F-8V1…` `` del §3): 12 racimos con 44 miembros, 56 sueltos, intersección vacía. Míos: `R11`
(`F-8V1B1-008`, `F-8V1D1-005`) y los 18 sueltos con prefijo `A1`, `B1` o `D1`. Son **20**.

Medido todo sobre el worktree de la spec (HEAD `1e67aa9304`). Desde los informes del 26/09 no hubo
commits sobre el diseño (sólo el consolidado), y `verificar-citas.py` da sobre `A1`, `B1` y `D1`
**131 citas ok, 0 desplazadas, 0 fallas**. Aun así cada camino se reejecutó contra el texto: que
una cita siga en su lugar no prueba que nada la corte en otro.

Abreviaturas: `$D` es `HOS-1352-billing-verticals-redesign/docs`, `$V` es
`HOS-1353-verticales-capacidades-y-autorizacion`, `$B` es `HOS-1354-billing-cobro-y-proveedor`.

---

## 1. Resumen

| hallazgo | ¿sigue llegando? | salida | capítulos afectados |
|---|---|---|---|
| `F-8V1B1-008` (`R11`) | sí | aplicación | `B/03` §4, `B/06` §11 |
| `F-8V1D1-005` (`R11`) | sí | aplicación | `B/06`, `B/descomposicion` §2.7, `B/09` §3 |
| `F-8V1A1-001` | sí | **owner** (`G5-1`) | `V/17` §3.2, `N/08` §3 |
| `F-8V1A1-002` | sí | aplicación | `V/17` §4.3, `N/04` §2.3, `V/20` (`G6`) |
| `F-8V1A1-003` | sí | **owner** (`G5-2`) + aplicación (dos reglas) | `N/08` §3, `V/17` §3, `V/19` §2 |
| `F-8V1A1-004` | sí | aplicación | `V/17` §1.2 y §3.5, `V/18` §1.6, `V/spec`, `N/01`, `V/03`, `V/19`, `V/21` |
| `F-8V1A1-005` | sí | aplicación | `V/02` §2.1, `V/20` (`G-R3`), `V/15` §6 |
| `F-8V1A1-006` | sí | aplicación | `V/17` §1.2 y §3.3, `V/02` §2.1, `V/20` §2 |
| `F-8V1A1-007` | sí | aplicación | `V/17` §1.2 |
| `F-8V1A1-009` | sí | aplicación (la lectura cruza con `R8`) | `B/03` §8 (`A1`) |
| `F-8V1B1-001` | sí | **owner** (`G5-3`) | `B/03` `S10`, `DEC-SUB-010` |
| `F-8V1B1-003` | sí | aplicación | `B/03` `S1`, `B/12` §4.4 |
| `F-8V1B1-004` | sí | **owner** (`G5-4`) | `B/03` §3.2 y §6.1, `B/22` §2.2 |
| `F-8V1B1-005` | sí | aplicación (+ 📌 con OK del owner) | `B/03` §6 y §6.1 (`RF2`), `DEC-RF-001` |
| `F-8V1B1-006` | sí | aplicación | `B/03` `S30` |
| `F-8V1D1-002` | sí | aplicación (nombre propuesto) | `N/01`, `B/16`, `B/03`, `B/descomposicion` |
| `F-8V1D1-003` | sí | aplicación | `N/03` §1 regla 5, `N/04` `D17` |
| `F-8V1D1-006` | sí | aplicación | `N/04` §3 |
| `F-8V1D1-007` | sí | aplicación | `B/02` §2.5, `B/06` §11 |
| `F-8V1D1-008` | sí | aplicación | `V/spec` §2 |
| contradicción (a) `G13` | sí | **owner** (`G5-5`) | contrato §6.3, descomposiciones, `B/20` |
| contradicción (b) pasarela | sí | aplicación + 📌 con OK del owner | `D/11` §1, `DEC-ARCH-005` |
| contradicción (c) FASE 7 | sí | aplicación | `D/03-handoff` |
| contradicción (d) criterio de `V4` | sí | aplicación | `V/descomposicion` §4 |
| contradicción (e) nueve pasos | sí | aplicación | `V/17`, `V/spec`, `V/descomposicion`, `V/02`, `V/20` |

**Conteo**: de los 20 hallazgos, **20 siguen llegando y 0 dejan de llegar**; **16 son sólo
aplicación, 4 van al owner** (uno de ellos, `F-8V1A1-003`, con una parte de aplicación que no
depende de la respuesta) y **0 se declaran**. De las cinco contradicciones, una va al owner y
cuatro son aplicación (una de ellas pide OK para escribir un 📌 en el log).

---

## 2. Racimo `R11` — lo que la matriz cerró no llegó a todos los textos

### 2.1 Causa

Cuando una fila de la matriz cambia de estado, el cambio se propaga a mano a cada texto que la
nombra. El 25/09 (noche) `RN-3` pasó a `PARTIALLY_SUPPORTED` y el 26/09 `GR-1` pasó a `VERIFIED`;
la tanda que lo propagó tachó la mayoría de los lugares y dejó cinco. Ningún guard compara el
estado que un capítulo afirma de una fila contra el estado que la matriz le da.

### 2.2 Dominio declarado

Dos clases de afirmación, sobre el alcance del grupo (núcleo, las dos épicas con sus `spec.md` y
descomposiciones, contrato, `D/16`):

1. **Todo texto vivo (no tachado) que atribuye a una fila un estado.** Lo recorrí con script: el
   estado de cada fila sale de la matriz con el mismo criterio de `contar-filas-de-la-matriz.py`
   (primera celda con estado, lo tachado excluido), y se listan las líneas donde un ID cuyo estado
   **no** es `UNKNOWN` aparece a menos de 70 caracteres de la palabra `UNKNOWN`. Ocho líneas; a
   mano, las que el filtro de proximidad no ve (la fila de `RN-3` en `B/06` §11).
2. **Todo conteo de filas de la matriz**: `rg` de *«N medidas»*, *«N filas `UNKNOWN`»*, *«98
   filas»* y variantes con número en letras.

El recuento de hoy, con `python3 contar-filas-de-la-matriz.py` desde `$D`: **98 filas · 56
`VERIFIED` · 15 `PARTIALLY_SUPPORTED` · 23 `NOT_SUPPORTED` · 4 `UNKNOWN`** (`PA-6`, `GR-2`,
`RC-8`, `RF-3`). Medidas: 98 − 4 = **94**.

### 2.3 Recorrido del dominio

| lugar | qué afirma hoy | ¿coincide? |
|---|---|---|
| `D/06` cabecera (`:17`) | 56 · 15 · 23 · 4 sobre 98 | sí |
| `B/spec.md:229-233` | 98 — 56 · 15 · 23 · 4 | sí |
| `B/descomposicion.md:359` | 98 — 56 · 15 · 23 · 4 | sí |
| `B/descomposicion.md:380` | del grace queda `UNKNOWN` sólo `GR-2` | sí |
| `B/09-conciliacion.md:878` | sigue `UNKNOWN` `GR-2` | sí |
| `B/12-suscripcion.md:159` | `GR-1` `UNKNOWN`, **dentro de un tachado** de varias líneas | sí (tachado) |
| **`B/descomposicion.md:354`** | título: *«Dónde caen las ~~ocho~~ seis filas `UNKNOWN`»* | **no**: son cuatro |
| **`B/06-proveedor.md:27`** | *«98 filas, 92 medidas»* | **no**: son 94 |
| **`B/06-proveedor.md:412`** | `RN-3`: *«sigue `UNKNOWN` si vuelve a pausar»* | **no**: `PARTIALLY_SUPPORTED` |
| **`B/03-maquinas-de-estado.md:1598`** | la salida del grace *«condicionado a `GR-1` (`UNKNOWN`)»* | **no**: `VERIFIED` |
| **`B/09-conciliacion.md:159`** | *«`EX-1` todavía `UNKNOWN`»* | **no**: `PARTIALLY_SUPPORTED` desde el 23/09 |

Cinco textos vencidos, los mismos que nombran los dos hallazgos. Ninguno más en el dominio.

Las citas que lo prueban:

- `$B/docs/03-maquinas-de-estado.md:1598` «condicionado a `GR-1`** (`UNKNOWN`): que el reintento
  de un registro ya abierto»
- `$B/docs/06-proveedor.md:412` «reactivar no reintenta lo adeudado; sigue `UNKNOWN` si vuelve a
  pausar»
- `$B/docs/06-proveedor.md:27` «las reglas de trato que salen de haberlo medido** — 98 filas, 92
  medidas (recontadas»
- `$B/descomposicion.md:354` «Dónde caen las ~~ocho~~ seis filas `UNKNOWN`»
- `$B/docs/09-conciliacion.md:159` «y `B/06` §6 lo subraya con `EX-1` todavía `UNKNOWN`»
- `$B/docs/06-proveedor.md:284` «NO, y está medido: `EX-1` cerró el 2026-09-23** como
  `PARTIALLY_SUPPORTED`.»

Y la decisión del owner que la primera aplica, sin reabrirla: la 3a condicionó la frase a `GR-1`
*«y se mide con el próximo rechazo mensual real»*. Se midió (sonda 49), así que la condición se
cumplió; la 3a no se toca.

### 2.4 Propuesta de texto

**`B/03` §4, tabla del grace, fila *«qué se puede hacer adentro»*** (`:1598`). Se tacha desde
*«— **condicionado a `GR-1`**»* hasta *«`B/19` §4 fila 17-bis y fila 9)»*, y entra:

> (tachado 2026-09-26) **medido: `GR-1` `VERIFIED` el 2026-09-26** —cambiar el medio de pago
> dispara un reintento que cobra con el nuevo, sobre el mismo registro (sonda 49)—, **así que la
> pantalla y los correos del grace pueden decir que al cambiar la tarjeta se reintenta el cobro**
> (`B/12` §1.5; `B/19` §4 filas 9 y 17-bis). Sigue sin medir cuántos reintentos de un plan
> mensual o anual caen dentro del grace (`B/12`, *«lo que este capítulo NO cierra»*).

**`B/06` §11, fila `RN-3`**, última celda: se tacha *«sigue `UNKNOWN` si vuelve a pausar»* y
entra:

> **`PARTIALLY_SUPPORTED` desde el 2026-09-25 (noche)**: reactivar retoma el ciclo siguiente, no
> recupera lo adeudado, y vuelve a pausar si el medio sigue fallando (`D/06`, fila `RN-3`).

**`B/06`, introducción** (`:27`): *«98 filas, ~~92~~ **94** medidas (recontadas el ~~2026-09-25~~
**2026-09-26**, tras cerrar `RN-3` y `GR-1`; quedan cuatro `UNKNOWN`: `PA-6`, `GR-2`, `RC-8` y
`RF-3`)»*.

**`B/descomposicion.md` §2.7, título**: *«Dónde caen las ~~ocho~~ ~~seis~~ **cuatro** filas
`UNKNOWN`»*.

**`B/09` §3** (`:159`): se tacha *«todavía `UNKNOWN`»* y entra *«(`PARTIALLY_SUPPORTED` desde el
2026-09-23: un `pending` no vence solo)»*.

### 2.5 Cómo deja de llegar cada miembro

- **`F-8V1B1-008`**: la pantalla del grace escrita desde `B/03` §4 promete el reintento con la
  tarjeta nueva, y `B/06` §11 da `RN-3` como la matriz. Juan cambia la tarjeta y el cobro entra.
- **`F-8V1D1-005`**: las cuatro frases que nombra (y la de `B/03` §4, que es la de `B1`) dicen lo
  que dice el script. El implementador de `B7` lee en `B/06` que `RN-3` no está abierta.

**Lo que no cierra y conviene decir**: la clase de defecto sigue abierta. La próxima fila que cambie
de estado deja otra vez textos vencidos, porque la propagación es a mano. No propongo guard: un
guard que parsee prosa para encontrar estados de fila afirmaría más de lo que verifica. Lo que sí
se puede escribir es la regla de la tanda: **quien cambie el estado de una fila corre el script
de §2.2 punto 1 sobre el corpus antes de cerrar**, y lo deja dicho en el commit.

---

## 3. Hallazgos sueltos

### 3.1 `F-8V1A1-001` — un admin que también es cliente se administra a sí mismo · owner

**¿Sigue llegando?** Sí. `rg -n -i "sí mism[oa] |autoconce|actor = sujeto|segunda firma|cuatro
ojos"` sobre el núcleo, las dos épicas, el contrato y el log no encuentra ninguna regla sobre una
acción del catálogo cuyo sujeto es el propio actor; las cuatro coincidencias son de otra cosa. El
control está escrito sólo para `actor ≠ sujeto`:

- `$V/docs/17-autorizacion.md:295` «`actor ≠ sujeto` exige un permiso de esa acción concreta**,
  no una condición general de»
- `$V/docs/17-autorizacion.md:307` «capacidades del actor**, no del sujeto — otorgar una cortesía
  no consulta si el cliente tiene»
- `$D/nucleo/04-invariantes.md:138` «Lo que toca plata lo confirma una persona»

Con roles aditivos, la persona que confirma puede ser la interesada, y `D11` se cumple a la letra
sin proteger nada. **Es decisión del owner** (`G5-1`): el costo de cualquier regla es operativo y
cae sobre las cuentas con permisos, que hoy pueden ser la suya.

### 3.2 `F-8V1A1-002` — el bypass de staff pasa el guard del invariante 13 · aplicación

**¿Sigue llegando?** Sí. `rg -n -i "staff|EDITOR|CLIENT_MANAGER|bypass"` sobre el núcleo, las dos
épicas, el contrato y el corte: **cero**. El guard mira la decisión y no la construcción:

- `$D/nucleo/04-invariantes.md:74` «que ninguna autorización decida sólo por rol»
- `$V/docs/20-testing.md:55` «una autorización **decide sólo por rol**»
- `$D/12-contrato-de-cobertura.md:88` «tipo: TRIAL | SUSCRIPCIÓN | CORTESÍA | GRANT | BASE |
  ADDON»

**El diseño ya contesta**: el conjunto efectivo se pliega de las fuentes de `cobertura()` y un rol
no es ninguna. Falta escribirlo por nombre, porque el código de hoy tiene el cargador y la decisión
de qué se reutiliza está diferida a la FASE 5.

**Propuesta.** En `V/17` §4.3, después de la tabla de las dos mitades:

> **Y ningún rol es una fuente.** El conjunto efectivo sale **sólo** de las fuentes que devuelve
> `cobertura()` (`12-contrato…` §2): `TRIAL`, `SUSCRIPCIÓN`, `CORTESÍA`, `GRANT`, `BASE` y
> `ADDON`. El cargador del código de hoy, que le da a `SUPER_ADMIN`, `ADMIN`, `EDITOR` y
> `CLIENT_MANAGER` el conjunto entero con limits en `-1` antes de que corra el chequeo, **se
> retira**, se reutilice o no el resto del cargador. Lo que el staff necesita en su trabajo lo da
> el §3.2 regla 1, acción por acción, nunca un conjunto (FASE 9 vuelta 1, `F-8V1A1-002`).

En `N/04` §2.3, fila 13, la columna *«qué verifica»*: *«ídem, **y que ninguna construcción del
conjunto efectivo lea un rol**»*. En `V/20` §2, fila `G6`, agregar la segunda mitad con ese
predicado y su mensaje propio (*«un rol entró al conjunto efectivo»*), para que no afirme más de
lo que la corrida verificó.

**Cómo deja de llegar.** El `EDITOR` anfitrión de Alojamiento resuelve contra su piso: el paso 6 no
encuentra *«publicar»* y `G6` falla si alguien reintroduce el cargador.

### 3.3 `F-8V1A1-003` — escrituras del admin fuera del catálogo · owner + aplicación

**¿Sigue llegando?** Sí. El núcleo prohíbe y el capítulo de superficies le da al admin todo lo de
cualquiera:

- `$D/nucleo/08-auditoria-y-observabilidad.md:177` «una escritura sin fila no tiene permiso que
  pedir, no es capacidad»
- `$V/docs/19-superficies.md:44` «todo lo anterior, de cualquier persona, **como actor distinto
  del sujeto**»

`rg -i "is_?featured|hard delete del admin|a nombre de|restaurar"` sobre las dos épicas, el
núcleo, `B/21` y `D/16` da cero: el diseño no nombra las escrituras que el código tiene hoy.

**Qué es del owner** (`G5-2`): si el admin tiene escrituras sobre fichas ajenas fuera de las
catorce. **Qué es aplicación y no depende de esa respuesta**: dos reglas que cierran los tres
daños del hallazgo cualquiera sea la elección.

**Propuesta de las dos reglas**, en `N/08` §3, debajo de *«Lo que no se puede es ejecutar una
escritura que no esté nombrada en ninguna fila»*:

> **Dos cosas que ninguna fila de esta tabla hace, ni las que se agreguen:** un acto de un actor
> distinto del dueño **nunca es *«el dueño publica»***, así que no ejerce el evento de activación
> ni dispara `T1` (el trial es de por vida y lo gasta sólo el dueño, `V/03` §2); y **ningún
> borrado de ficha sale de otra fila que `PB9` o `PB12`**, que es lo que hace correr `A6`
> (`B/03` §8) y cancela el addon `LISTING` de la ficha borrada (FASE 9 vuelta 1, `F-8V1A1-003`).

Y en `V/19` §2, fila **Admin**: *«todo lo anterior, de cualquier persona, como actor distinto del
sujeto, **para leer; para escribir, sólo lo que nombra una fila de `NUCLEO/08` §3**»*.

**Vecino**: que `is_featured` sobreviva al corte sin la capacidad es también de `F-8V1A3-001`
(`R1`, otro grupo). La regla del destaque va con la respuesta a `G5-2`; su migración, con `R1`.

### 3.4 `F-8V1A1-004` — «la clave vigente» de la precisión 7 no dice cuál · aplicación

**¿Sigue llegando?** Sí:

- `$V/docs/17-autorizacion.md:177` «presencia de Partner **con la clave vigente y sin moderar**»
- `$V/docs/18-partner.md:43` «| plan | ~~presencia pública~~ página propia | **presencia en el
  carrusel** |»
- `$V/docs/18-partner.md:120` «el partner tiene HOY el entitlement de presencia pública (§1.2),
  desde el caché del conjunto»

La decisión 7b ya partió la clave en dos; falta que la precisión 7 y la lectura de la página digan
cuál. **Dominio**: toda línea viva que nombra la clave de presencia en singular. Con script
(`clave vigente|entitlement de presencia|la clave de presencia`): ocho.

| lugar | cambio |
|---|---|
| `V/17:177` (precisión 7) | «una presencia de Partner **con la clave de esa superficie** —“página propia” para la página, “presencia en el carrusel” para el carrusel (cap. 18 §1.2)— **vigente y sin moderar**» |
| `V/17:424` (§3.5) | la misma frase |
| `V/spec.md:173` | la misma frase |
| `V/18:120` (§1.6) | «el entitlement ~~de presencia pública~~ **“página propia”** (§1.2)» |
| `N/01:47` (glosario) | *«el entitlement ~~de presencia~~ **de la página propia**»* |
| `V/03:1016` | *«pregunta por el entitlement ~~de presencia~~ **de su superficie**»* |
| `V/19:87` | «pregunta por el entitlement ~~de presencia~~ **“página propia”**» |
| `V/21:330` | *«la lectura sin la clave ~~de presencia~~ **de la página**»* |

**Cómo deja de llegar.** Un Silver tiene *«presencia en el carrusel»* y no *«página propia»*: el
paso 4 sobre la página pregunta por la segunda y contesta *«no existe»*.

### 3.5 `F-8V1A1-005` — «hereda Turista VIP» no la mira `G-R3` · aplicación

**¿Sigue llegando?** Sí. La columna existe y sólo el plan de trial tiene su valor escrito:

- `$V/docs/02-modelo-de-datos.md:48` «si permite pausa, si hereda Turista VIP»
- `$V/docs/02-modelo-de-datos.md:136` «**Con una excepción, y es la única: `hereda Turista VIP` se
  DECLARA en el plan de trial, no se»
- `$V/docs/02-modelo-de-datos.md:277` «ninguna de las dos versiones no vendibles de una vertical
  otorga una clave de la»

**Dominio**: las versiones de plan que tiene toda vertical comercial —vendibles, trial, pre-trial
y piso— × el valor de la columna. Vendibles: declarado por plan (`V/10` fila 6). Trial: *«no»*
escrito (`V/02:147`). **Pre-trial y piso: sin valor escrito y sin guard.** El piso es la fuente
que tiene toda persona en toda vertical, así que un *«sí»* ahí es el punto único de falla que el
propio capítulo declara, por una columna que `G-R3` (a) no ve porque mira claves.

**El diseño ya contesta el valor**: la razón que decidió *«no»* para el trial (`DEC-ENT-003`,
regalarlo bloquea venderlo) vale con más fuerza para las versiones que nadie paga. Y **el
transporte ya existe**: la referencia de la fuente es una versión de plan
(`12-contrato…` §2), y verticales lee de su propia `plan_version` si esa versión hereda. No hace
falta campo nuevo en la firma.

**Propuesta.** En `V/02` §2.1, después de *«Y el valor declarado es que NO lo hereda»*:

> **Y lo mismo en las dos versiones no vendibles**: la de pre-trial y la de piso declaran
> `hereda Turista VIP = no`. La de piso la tiene toda persona en toda vertical
> (`12-contrato…` §2.5), así que un *«sí»* ahí le regala VIP a la plataforma entera y, por
> `DEC-ENT-003`, le bloquea a todos la compra (FASE 9 vuelta 1, `F-8V1A1-005`).

En el ⚠️ de `G-R3` (`V/02` §2.1 y `V/20` §2), una cuarta mitad:

> **(d)** ni la versión de trial ni las dos no vendibles declaran `hereda Turista VIP`: es una
> columna y no una clave, así que (a) no la ve. Mensaje propio: *«herencia de VIP fuera de una
> versión vendible»*.

En `V/15` §6, una línea sobre **quién lo pregunta**:

> La resolución de Turista hereda VIP si en alguna otra vertical **una fuente de clase `TÍTULO`**
> trae una `referencia` cuya versión declara `hereda Turista VIP`. Con la mitad (d) de `G-R3`,
> `BASE`, `TRIAL` y el pre-trial nunca la traen, y un `COMPLEMENTO` no tiene versión de plan. Lo
> resuelve `V3`, con la invalidación por `user` que ya tiene (regla 3 del cap. 02 §3.2).

**Cómo deja de llegar.** Sembrar el piso con *«sí»* hace fallar `G-R3` (d) antes del deploy, y la
resolución de Turista no cuenta la fuente `BASE` aunque la columna estuviera mal.

### 3.6 `F-8V1A1-006` — el guest es un actor y el paso 1 no rechaza a nadie · aplicación

**¿Sigue llegando?** Sí:

- `$V/docs/17-autorizacion.md:320` «es **un actor del modelo, no la falta de uno**»
- `$V/docs/02-modelo-de-datos.md:223` «Es lo que le da respuesta al paso 5 a un `TRIAL_EXPIRED`,
  a un `Turista Free` y a un `Guest`.»
- `$V/docs/15-entitlements-y-limits.md:433` «El visitante sin cuenta no recibe ningún
  entitlement medido.** De los booleanos recibe»
- `$V/docs/20-testing.md:309` «`Turista Free` y un `Guest` **no pueden suscribirse**»

**El diseño ya contesta**: el contrato de errores del repo pide 401 antes que 403, y el cap. 15 le
da al guest sólo los booleanos de lectura pública. Falta que el paso 1 lo diga.

**Propuesta.** `V/17` §1.2, fila 1:

> | 1 | **quién es** | ¿hay un actor **autenticado**? El `Guest` es un actor (§3.3) y **falla
> acá**, salvo en una lectura de lo ajeno en estado público (precisión 7) | no autenticado |

`V/17` §3.3, fila del visitante sin cuenta, al final: *«**No pasa del paso 1** salvo en la lectura
pública, y el paso 2 no le aplica: no tiene cuenta»*. `V/02:223`: se tacha *«y a un `Guest`»* y
entra *«; al `Guest` no hace falta: el paso 1 lo rechaza en toda operación que no sea una lectura
pública, y una lectura no pasa por el 5 (cap. 17 §1.2)»*. `V/20:309`: se tacha *«y un `Guest`»*
(el guest se registra antes de suscribirse, y entonces es `Turista Free`).

**Cómo deja de llegar.** El guest que llama a `POST /protected/...` recibe 401 en el paso 1, y
ningún conjunto efectivo del guest pasa por el piso.

### 3.7 `F-8V1A1-007` — el correo sin verificar bloquea la recuperación · aplicación

**¿Sigue llegando?** Sí. `rg -n -i "sin verificar|reenviar"` sobre las dos épicas y el núcleo no
encuentra ninguna operación exenta del paso 2:

- `$V/docs/17-autorizacion.md:70` «| 2 | **estado de la persona** | ¿esta cuenta puede operar
  hoy?»
- `$V/docs/17-autorizacion.md:396` «Toda operación la corre**, escriba o no. No hay operación
  exenta.»

Hay una cara que el hallazgo no nombra y sube el peso: **darse de baja también escribe estado, y
el paso 2 lo rechaza**. Quien cambió el correo y no verificó el nuevo sigue cobrando sin poder
cortarlo.

**El diseño ya contesta el criterio**: la clase `DE_ACCESO` del cap. 15 (existir, recuperar lo
propio, volver a contratar) y la excepción cerrada de lecturas de lo propio (decisión 8d). El paso
2 existe para que una cuenta sin correo probado no **produzca presencia ni consuma capacidad**; no
para impedirle recuperar lo suyo ni irse.

**Propuesta.** `V/17` §1.2, después de la precisión 2:

> **Lo que el paso 2 deja pasar con el correo sin verificar es una lista cerrada**: verificar el
> correo o cambiarlo; las lecturas de lo propio —Mi Cuenta, su billing y sus fichas (§3.5)—;
> exportar, `PB8` y `PB12`; regularizar un cobro —cambiar la tarjeta, pagar la cuota—; y **darse
> de baja**. Todo lo demás —publicar, contratar, comprar, editar lo público— lo rechaza. Sin esta
> lista el paso 2 bloqueaba justo la recuperación que `DEC-DATA-001` promete y la baja, que deja a
> la persona cobrando (FASE 9 vuelta 1, `F-8V1A1-007`).

Una elección queda a la vista, sin llegar a pregunta: *«contratar»* es `DE_ACCESO` y queda
**afuera** de la lista, porque sin correo probado ni el aviso previo al cobro ni el comprobante
tienen destino. Si el owner prefiere dejarlo pasar, es una palabra.

**Cómo deja de llegar.** Juan, con el correo nuevo sin verificar, entra, recupera su ficha
archivada con `PB8` y la exporta; el día 180 no borra a quien intentó recuperar.

### 3.8 `F-8V1A1-009` — nada exige que la ficha objetivo sea del comprador · aplicación

**¿Sigue llegando?** Sí:

- `$B/docs/02-modelo-de-datos.md:493` «el objetivo corresponde al tipo de scope del producto»
- `$B/docs/03-maquinas-de-estado.md:2479` «en `cobertura(user, vertical del objetivo)`, ninguna
  fuente de clase `TÍTULO`»

**El diseño ya contesta**: comprar un addon es una operación de dominio y pasa por la resolución
única del cap. 17 (§1.3), cuyo paso 4 pregunta si el recurso es del sujeto. Falta decir que el
recurso del paso 4, en un `LISTING`, es la ficha objetivo.

**Propuesta.** `B/03` §8, fila `A1`, al final de la condición:

> **Y con scope `LISTING`, la ficha objetivo es el recurso del paso 4 del cap. 17** (épica de
> verticales): propia del comprador, de la vertical del producto, y en un estado que acepte
> destacarla —ni `PURGED` ni `MODERATED`—. Si no, *«no existe»* (FASE 9 vuelta 1,
> `F-8V1A1-009`).

No propongo la restricción de base que ataría dueños entre épicas: sería una FK de billing sobre
una tabla de verticales, que es exactamente lo que `R8` (otro grupo) está inventariando. La lectura
del dueño de la ficha objetivo ya figura en ese inventario (`F-8V1A3-008`).

**Cómo deja de llegar.** El pedido con el id de la ficha de María contesta *«no existe»* antes de
crear la instancia, y el preapproval no nace.

### 3.9 `F-8V1B1-001` — la pausa con vuelta anticipada regala un ciclo · owner

**¿Sigue llegando?** Sí. La premisa de `DEC-SUB-010` y su libertad de vuelta siguen juntas:

- `$D/01-decision-log.md:1697` «**volver cuando quiera** (§26.2 se cumple entero), y al volver
  **se le cobra normal en el ciclo»
- `$D/01-decision-log.md:1702` «la pausa dura ciclos enteros, porque vuelve **el mismo día del
  mes** en que pausó.»
- `$B/docs/03-maquinas-de-estado.md:152` «si la persona vuelve antes, los meses no usados no
  cuentan contra `DEC-SUB-004`»
- `$D/nucleo/04-invariantes.md:67` «la pausa puede terminar anticipadamente»

Con `PS-2`, `PS-5` y `PS-6` medidos, el día de arranque y el de vuelta deciden cuánto se paga, y
nuestro estado y el del proveedor coinciden en cada paso: nada lo detecta. **Es del owner**
(`G5-3`) porque cambiar la vuelta anticipada toca una implicación de `DEC-SUB-010` y el invariante
24 (§26.2 del PDR).

### 3.10 `F-8V1B1-003` — `S16` deja entrar el alta nueva con el preapproval viejo vivo · aplicación

**¿Sigue llegando?** Sí. La fila es terminal pase lo que pase con la llamada, y terminal no vivo
deja pasar el alta:

- `$B/docs/03-maquinas-de-estado.md:158` «la cancelación no se ejecuta en esta corrida y **la
  reintenta el barrido**»
- `$B/docs/12-suscripcion.md:328` «`CHARGE_DECLINED` es terminal y **no vivo**: el reintento»
- `$B/docs/09-conciliacion.md:199` «Si los 3 días de la transición que decidió la cancelación la
  relectura todavía no la ve `cancelled`»

La decisión 1 del owner (un correo en `failed` no bloquea) no lo corta: el hueco es la ventana
entre la transición y la cancelación confirmada, que con un fallo transitorio del correo o de la
llamada dura hasta la corrida siguiente del barrido.

**El diseño ya contesta la forma**: `S1` ya relee al proveedor antes de aceptar una sucesión, y
`B/12` §4.4 cerró el mismo riesgo para el checkout abierto de una sucesión.

- `$B/docs/03-maquinas-de-estado.md:143` «el preapproval de la predecesora se relee por id antes
  de aceptar el cambio y tiene que estar»

**Propuesta.** `B/03` §3.2, fila `S1`, en la condición, después de la cláusula de la sucesión:

> **Y no hay, para ese `user + vertical`, una fila `CHARGE_DECLINED` cuyo preapproval no se haya
> releído `cancelled`.** Si la hay, `S1` lo relee por id en el acto: si lo ve `cancelled`, sigue;
> si no, corre la cancelación con la regla de relectura de `S17` y el correo antes, y **el alta no
> se admite en esta llamada** (*«estamos cerrando tu intento anterior; probá de nuevo en unos
> minutos»*). Sin esto el alta nueva convivía con un preapproval que el proveedor podía seguir
> reciclando, y `GR-1` midió que actualizar el medio de pago lo cobra en minutos (FASE 9 vuelta 1,
> `F-8V1B1-003`).

En `B/12` §4.4, consecuencia 1, una frase: *«**Y tampoco mientras la fila `CHARGE_DECLINED` tenga
el preapproval sin confirmar cancelado**: ahí la oferta espera a la relectura de `S1`.»*

**Qué no es de esta propuesta**: qué motivo abre el cobro viejo que igual entre sobre la fila
`CHARGE_DECLINED`. Es `F-8V1B1-007`, en `R4` (otro grupo).

**Cómo deja de llegar.** Juan vuelve a darse de alta: `S1` relee, ve `authorized`, cancela y le
pide que pruebe en unos minutos. Al volver, el viejo está `cancelled` y el alta entra sola.

### 3.11 `F-8V1B1-004` — la revocación tiene reembolso y no cancelación · owner

**¿Sigue llegando?** Sí:

- `$D/01-decision-log.md:1634` «1. **La revocación es UNA sola operación: reembolso total +
  cancelación.** No dos cosas que»
- `$B/docs/03-maquinas-de-estado.md:1801` «monto y motivo (`B/02` §2.3). **No mueve el pago ni la
  suscripción**»
- `$D/01-decision-log.md:1643` «4. **El botón de arrepentimiento queda FUERA DE ALCANCE por
  ahora**, por decisión explícita del»

Ninguna fila de `S1`–`S35` ejecuta la mitad *«cancelación»*. La parte 4 de `DEC-RF-001` saca de
alcance el **botón**, no el derecho: una revocación puede llegar por correo o por soporte hoy. Por
eso no alcanza con *«no se construye hasta el botón»*, y **es del owner** (`G5-4`): la elección
es entre construir ahora una fila o aceptar por escrito el camino manual con su costo.

### 3.12 `F-8V1B1-005` — ante un `2084`, caer al total devuelve de más · aplicación

**¿Sigue llegando?** Sí:

- `$B/docs/03-maquinas-de-estado.md:1802` «ante un `2084` la fila se queda en `CONFIRMED` y se
  reintenta con otro monto o con el total»
- `$D/06-mp-validation-matrix.md:312` «La misma `X-Idempotency-Key` con el mismo cuerpo, sobre un
  pago con saldo»
- `$D/01-decision-log.md:1642` «con otro monto o cae al reembolso total. Está medido que ese
  mensaje miente.»

**El diseño ya contesta, leído en su contexto**: la parte 3 de `DEC-RF-001` se escribió para la
revocación, cuyo reembolso **es** el total; ahí *«caer al total»* no pasa del monto confirmado.
Sobre un reembolso parcial, `D11` manda: nada automático mueve más plata de la que una persona
confirmó. Y `RF-2` midió que los parciales se acumulan, así que partir el monto confirmado es un
reintento posible que no lo supera. No se reabre la parte 3: se precisa su alcance.

**Propuesta.** `B/03` §6.1, fila `RF2`, se tacha *«y se reintenta con otro monto o con el total»*
y entra:

> y se reintenta **sin pasar nunca del monto confirmado**: partido en parciales que suman lo
> confirmado —`RF-2` midió que se acumulan—, cada uno con su propia clave persistida antes
> (`RF-6` mide la misma clave con el mismo cuerpo, no con otro). **Cae al total sólo si lo
> confirmado es el total del saldo**, que es el caso de la revocación de `DEC-RF-001`. Si ningún
> reintento entra, la fila sigue en `CONFIRMED` y la mira una persona (FASE 9 vuelta 1,
> `F-8V1B1-005`)

Lo mismo en la regla del §6 (`B/03:1779-1780`, *«Reintenta con otro monto o cae al total»*). Y un
📌 en `DEC-RF-001`, que pide OK del owner para tocar el log (§5).

**Cómo deja de llegar.** El 40 % confirmado sale como 20 + 20 si el primer intento da `2084`; nunca
como el 100 %.

### 3.13 `F-8V1B1-006` — `S30` sale sólo de `ACTIVE` · aplicación

**¿Sigue llegando?** Sí. El `desde` de `S30` es `ACTIVE` y el diseño escribió qué pasa si el
contador llega a 0 en pausa, no en grace:

- `$B/docs/03-maquinas-de-estado.md:172` «Y si el contador llega a 0 con la fila ya `PAUSED`**,
  esta fila no ocurre»

**El diseño ya contesta**: en grace el preapproval está `authorized` y la mutación se aplica (la
razón que excluye la pausa es `EX-11`, que no vale acá); lo único que falta es el estado.

**Propuesta.** `B/03` §3.2, fila `S30`, columna `desde`: *«`ACTIVE` **o `GRACE_PERIOD`**»*, y en
los efectos, después de la frase de la pausa:

> **Y si llega a 0 con la fila en `GRACE_PERIOD`** —el último cobro con descuento entró como
> reintento del proveedor—, `S5` y esta fila corren en el mismo acto y la mutación se aplica
> igual: el preapproval está `authorized` y no hay `EX-11` que la rechace (FASE 9 vuelta 1,
> `F-8V1B1-006`).

`G-R4` no cambia: ninguna otra fila tiene el par `(GRACE_PERIOD, P1 deja en 0 el contador)`.

**Cómo deja de llegar.** El tercer cobro de la promo entra en grace, el contador baja a 0 y el
monto se restituye en el mismo acto; el barrido no ve divergencia porque la abrió una mutación
nuestra con su reintento de 3 días.

### 3.14 `F-8V1D1-002` — «cobrada» significa dos cosas · aplicación

**¿Sigue llegando?** Sí:

- `$D/12-contrato-de-cobertura.md:126` «en una fuente `SUSCRIPCIÓN`, si **esa fila** tiene **al
  menos un pago acreditado**»
- `$B/docs/16-addons.md:114` «tiene al menos un pago acreditado, o es la sucesora de una
  predecesora que venía pagando»
- `$B/docs/03-maquinas-de-estado.md:220` «Las guardas de `S4` y `S16` son complementarias por un
  booleano** —*«la fila tiene al menos un»

Las dos lecturas están decididas (el bit del contrato, `DEC-TRIAL-010`; la ancha, 9e del owner,
*«como está»*) y no se tocan. Falta separarlas por nombre.

**Dominio**: toda línea viva con la palabra `cobrada` en el alcance. Con script: 54 líneas. Usan
la lectura ancha **diez**: `B/16:107`, `:114`, `:248`, `:386`, `:430`, `:742`; `B/03:2479` (`A1`)
y `:2483` (`A5`); `B/descomposicion.md:136`; `N/01:568`. El resto es el bit del contrato (`T2`,
`T6`, `T8`, el contrato mismo, `V/15`, `V/11`, las dos `spec.md`) o el adjetivo común (*«cobrada
más tarde»*). Y hay una frase vencida que
el hallazgo no nombra: `B/03:220-222` dice que `S4` y `S16` son complementarias *«por un
booleano»*, *«el mismo dato que el contrato transporta como `cobrada`»*, y desde la decisión 3c
son dos datos (la fila `S16` lo dice: *«ahora sobre dos datos»*).

**Propuesta.** Una entrada nueva en `N/01` §2 (el nombre es una propuesta; cambiarlo no mueve
nada):

> | **Pagando** (una principal) | Tiene al menos un pago acreditado, **o** es la sucesora de una
> predecesora que venía pagando (owner 2026-09-25, 9e; la misma lectura de `S4`). Es lo que
> exigen la validez de un addon (`A1`) y su orfandad (`A5`, 4d). **No es el campo `cobrada` del
> contrato**, que mira sólo la fila y viene en `no` sobre esa sucesora (`12-contrato…` §2.1): son
> dos predicados y cada consumidor usa el suyo. |

Y en las diez líneas de la lectura ancha, *«cobrada»* pasa a *«pagando»* (con el tachado de
práctica). `B/03:220-222`: *«complementarias por ~~un booleano~~ **dos datos** —la fila tiene al
menos un pago acreditado, y su predecesora tenía—; el primero es el que el contrato transporta como
`cobrada`»*.

**Cómo deja de llegar.** El implementador de `B10` busca «pagando», no reusa el bit de `B4`, y la
orfandad no cancela el addon de Juan al nacer su sucesora.

### 3.15 `F-8V1D1-003` — la regla 5 del núcleo no nombra a `S1` · aplicación

**¿Sigue llegando?** Sí:

- `$D/nucleo/03-maquinas-de-estado.md:63` «Ninguna máquina consulta el estado del proveedor para
  decidir.**»
- `$D/nucleo/03-maquinas-de-estado.md:66` «actuar**, releyendo por id, y esa relectura es parte de
  la condición de `S3` y `S6`»

**Dominio**: toda fila de las ocho tablas de transiciones cuya **condición** relee al proveedor.
Con script sobre `B/03` (las tablas de verticales no leen al proveedor): diez filas con *«relee»* o
*«relectura»* en la condición o en los efectos.

| filas | qué relee | ¿lo cubre hoy la regla 5 o `D17`? |
|---|---|---|
| `S3`, `S6`, `A3` | el estado antes de actuar por nuestro reloj | sí, *«un job que actúa por nuestro reloj»* |
| `S8`, `S10`, `S32`, `S33` | la confirmación de una mutación nuestra | sí, `D17`: *«una mutación nuestra se confirma releyendo»* (`D5`) |
| `P1`, `P6` | en los efectos, el aviso que llegó | sí, `D17`: *«un webhook es un aviso»* |
| **`S1`** | la predecesora, en el acto del cliente | **no**: no es job, ni mutación nuestra, ni aviso |

**Propuesta.** `N/03` §1, regla 5, se tacha *«Salvo un job que actúa por nuestro reloj sobre algo
que depende del estado del proveedor: ése le pregunta antes de actuar, releyendo por id, y esa
relectura es parte de la condición de `S3` y `S6`»* y entra:

> **Salvo una condición que depende del estado del proveedor**: la de un job que actúa por nuestro
> reloj (`S3`, `S6`, `A3`) y la de un acto del cliente que no puede declararse sobre un
> preapproval que no cobra (`S1`, sobre su predecesora). Ésas **le preguntan antes**, releyendo por
> id, y la relectura es parte de la condición (FASE 9 vuelta 1, `F-8V1D1-003`).

En `D17` (`N/04` §3), *«Son tres entradas»* pasa a cuatro, con *«**y un acto del cliente cuya
condición depende de ese estado** (`S1`)»*.

### 3.16 `F-8V1D1-006` — las invariantes cuentan 117 decisiones · aplicación

**¿Sigue llegando?** Sí:

- `$D/nucleo/04-invariantes.md:123` «El §64 se escribió antes de las 117 decisiones»
- `$D/nucleo/00-indice.md:43` «2026-09-25~~ **124** al 2026-09-25, con las siete nuevas de la
  FASE 9 completa»

**Propuesta.** Sacar el número, que es lo que vuelve a envejecer: *«El §64 se escribió antes de
~~las 117~~ **las** decisiones **del log** (decía «45» y después «117»; la cifra vive en
`NUCLEO/00` §1, que es el lugar que se recuenta)»*. El recuento de hoy está en §4.6.

### 3.17 `F-8V1D1-007` — tres referencias a secciones de `B/09` que no existen · aplicación

**¿Sigue llegando?** Sí. `B/09` tiene §1–§7 y §7.1; su §6 no tiene subsecciones:

- `$B/docs/02-modelo-de-datos.md:939` «el **barrido** (`B/09` §6.2, punto 2), **cuando pasaron 3
  días**»
- `$B/docs/06-proveedor.md:412` «(FASE 9 completa, C11: `B/09` §8 ya dice que ninguna bloquea)»
- `$B/docs/09-conciliacion.md:760` «## 6. Dos límites que no se pueden correr»

**Dominio**: toda referencia viva `` `B/NN` §x ``, `` `V/NN` §x `` y `` `NUCLEO/NN` §x `` del
alcance, resuelta contra los encabezados reales con script: **1764 referencias, 3 rotas**, las
tres de `B/09`: `B/02:915`, `B/02:939` y `B/06:412` (el hallazgo contó dos en `B/02`; son esas).

**Propuesta.** `B/02:915` y `:939`: *«`B/09` ~~§6.2~~ **§6, punto 2**»*. `B/06:412`: *«`B/09`
~~§8~~ **, *«Lo que este capítulo NO cierra»***»*, que es donde está *«ninguna bloquea este
capítulo»*.

### 3.18 `F-8V1D1-008` — el spec de verticales dice que no necesita leer billing · aplicación

**¿Sigue llegando?** Sí:

- `$V/spec.md:49` «y ninguno de ellos necesita leer uno de la épica de billing para estar
  completo.»
- `$D/nucleo/00-indice.md:70` «se citan entre sí**: recontado el 2026-09-25»

Recontado hoy con un patrón más ancho que el del índice (`` `B/NN` `` o *«épica de billing»*):
84 líneas de `V/docs` citan billing y 88 de `B/docs` citan verticales. La cifra del índice está
fechada y dice que no pretende estar al día; la del `spec.md` es la frase vieja.

**Propuesta.** `V/spec.md` §2: se tacha *«y ninguno de ellos necesita leer uno de la épica de
billing para estar completo»* y entra *«**y citan a billing donde el comportamiento cruza**
(`NUCLEO/00`: las dos épicas se citan entre sí); lo que cruza por contrato es la cobertura
(`12-contrato…`)»*. El mismo matiz toca `DEC-ARCH-005` (*«autónomas»*): va en el 📌 de la
contradicción (b).

---

## 4. Las cinco contradicciones chicas y el registro

### 4.1 (a) `G13`: el contrato dice `V4`, las descomposiciones y `B/20` dicen `B4` · owner

**¿Sigue?** Sí, y cada lado tiene su razón escrita:

- `$D/12-contrato-de-cobertura.md:1139` «Su dueño es `V4`, la unidad de la épica de verticales**,
  y no `B4`.»
- `$D/12-contrato-de-cobertura.md:1144` «Falla sobre un build destinado a producción, no sobre la
  rama**, así que no se dispara mientras»
- `$V/descomposicion.md:94` «Nace en **B4** de la otra épica, que es donde aparece la segunda
  implementación.»
- `$B/descomposicion.md:299` «Y acá nace `G13`**, no antes: mientras la de arranque es la única
  implementación, un guard que»
- `$B/docs/20-testing.md:349` «consumidor del contrato es billing.»

El argumento de las descomposiciones (*«falla desde el primer día»*) lo contesta el propio §6.3:
el guard mira un build destinado a producción, no la rama. Y la razón de `B/20` es falsa: el
consumidor de `cobertura()` es verticales. Aun así, las dos ubicaciones protegen el momento que el
§6.3 declara (el merge), porque las épicas llegan juntas (`DEC-ARCH-007`). Como es una asignación
de unidad y el owner viene decidiéndolas (10a–10e), va como `G5-5`.

### 4.2 (b) la partición se sigue justificando con «pasarela sin decidir» · aplicación + OK

**¿Sigue?** Sí:

- `$D/11-particion-del-programa.md:22` «La épica principal está bloqueada por una sola cosa: **no
  sabemos con qué pasarela vamos a»
- `$D/11-particion-del-programa.md:14` «pueda medir la pasarela. Lo que sigue no decide si partir:
  decide **por dónde pasa el corte**,»
- `$D/11-particion-del-programa.md:287` «DECIDIDA el 2026-09-24 por `DEC-MP-005`: Mercado Pago.**»
- `$D/01-decision-log.md:2128` «el programa entero quedó detenido por **una sola cosa**: no está
  decidida la»

No hay decisión: la partición no depende de esa razón. **Es una razón caduca bajo una conclusión
correcta**: el mismo §1 da la otra, *«ese bloqueo alcanza al dinero y no alcanza a las
capacidades»*, y el corte *«toca plata o no toca plata»* no dependía de qué pasarela.

**Propuesta para `D/11`** (se puede aplicar sin OK: no es el log). En el recuadro de la cabecera,
*«y **Billing**, que ~~espera a que se pueda medir la pasarela~~ **esperaba a la pasarela
(decidida el 2026-09-24, `DEC-MP-005`)**»*. En el §1, se tacha el primer párrafo entero (*«La
épica principal está bloqueada… desde el 2026-09-18.»*) y entra:

> (tachado 2026-09-26) **Así estaba el 2026-09-18**: la pasarela sin decidir. Se decidió el
> 2026-09-24 (`DEC-MP-005`, §7), y **la partición sigue en pie por la razón del párrafo
> siguiente, que nunca dependió de la pasarela**: el dinero y las capacidades son dos materias.

**Propuesta para `DEC-ARCH-005`**: un 📌 (pide OK del owner; texto en §5).

### 4.3 (c) FASE 7: «cinco ítems» contra cuatro de seis · aplicación

**¿Sigue?** Sí, en tres líneas del handoff; la cuarta (`:96`) ya lo anota:

- `$D/03-handoff.md:79` «`DEC-METH-013` cuenta desde acá), y recién ahí FASE 5, 6 y los cinco
  ítems de la FASE 7.»
- `$D/03-handoff.md:154` «pasar a la **FASE 5** (gap analysis), la **6** y los cinco ítems que
  faltan de la **FASE 7**.»
- `$D/03-handoff.md:291` «4. **FASE 5**, después la 6, y los cinco ítems que faltan de la FASE
  7.»
- `$D/16-fase-7-del-paraguas.md:232` «lo que hace al orden del corte.~~ **Cuatro de los seis ítems
  huérfanos** —`rollout`, `coexistence`,»

**Dominio**: `rg -n -i "cinco (ítems|de los seis)|ítems huérfanos"` sobre el paraguas vivo (sin
informes de fase), las dos épicas y el handoff. Fuera del handoff no quedan: `D/16:47` (*«Cuatro
de los seis tienen cero apariciones»*) es otra afirmación y es cierta.

**Propuesta.** En `D/03-handoff.md:79`, `:154` y `:291`: *«los ~~cinco~~ **cuatro** ítems que
faltan de la FASE 7 (`rollout`, `coexistence`, `feature flags` y `acceptance gates`; `D/16` §5)»*.
Y la línea `:96` se tacha como resuelta cuando se aplique.

### 4.4 (d) el criterio de `V4` dice lo contrario de la tabla de `V/03` §2 · aplicación

**¿Sigue?** Sí. Es un criterio de terminación, así que es el más caro de los cinco:

- `$V/descomposicion.md:484` «publicar con una `SUSCRIPCIÓN` presente y `cobrada: no` arranca el
  trial (`T1`) y no lo consume»
- `$V/docs/03-maquinas-de-estado.md:259` «**verdadero, pero sólo por una `SUSCRIPCIÓN` con
  `cobrada: no`** | **ninguna de las dos**»

**Dominio**: `rg "cobrada: no.{0,80}(arranca|T1)"` sobre las dos épicas, el núcleo y el contrato,
más `rg "cobrada: no"` sobre los `20-testing` y las `spec.md`: una sola línea, ésta.

**Propuesta.** `V/descomposicion.md` §4, fila `V4`: se tacha *«arranca el trial (`T1`) y no lo
consume (`T6` no dispara)»* y entra:

> **no arranca el trial ni lo consume** —ni `T1` ni `T6` disparan, la persona sigue en
> `PRE_TRIAL` y la ficha se publica porque está cubierta (`03` §2, fila de `cobrada: no`)—

El resto de la fila (el primer pago consume por `T8`) queda como está.

### 4.5 (e) los «nueve pasos» son siete y una precondición · aplicación

**¿Sigue?** Sí:

- `$V/docs/17-autorizacion.md:58` «Quedan **nueve pasos y una precondición**.»
- `$V/docs/17-autorizacion.md:419` «Una lectura de lo propio pasa por **siete** pasos: todos menos
  el 5 y»

**De dónde sale el nueve**, porque no es un error de suma sino de unidad. El §1.1 hace la cuenta
sobre **verificaciones**: ocho del §13, más dos que faltaban, menos el scope que pasa a ser
estructural: nueve. La tabla del §1.2 las agrupa en **siete pasos**: el 4 junta dueño y estado del
recurso (*«las tres juntas»*) y el 5 junta el estado de acceso y la fuente activa (el §4.2 dice
que *«los pasos 3 y 5»* separan rol y estado de acceso). Después alguien leyó el nueve como pasos,
y de ahí salen el *«los otros ocho»* y el *«siete pasos: todos menos el 5 y el 6»*.

- `$V/docs/17-autorizacion.md:461` «de acceso dice **si hoy puede ejecutarlas**. Son dos ejes
  independientes, y los pasos 3 y 5 del»

**Dominio**: `rg` de *«nueve pasos»*, *«los nueve»*, *«otros ocho»*, *«siete pasos»* y *«por
**siete**»* sobre el alcance. Diecisiete líneas vivas **de la autorización**; dos más (`V/18:252` y
`V/03:1145`) dicen *«el último de los nueve»* sobre el §17.3 **del PDR** (los pasos de la
postulación de Partner) y **no** se tocan.

| lugar | hoy | queda |
|---|---|---|
| `V/17:58` | nueve pasos y una precondición | *«**nueve verificaciones, en siete pasos y una precondición**: el paso 4 junta dueño y estado del recurso, y el 5 el estado de acceso y la fuente activa»* |
| `V/17:96` | pasa por los nueve | pasa por los siete |
| `V/17:109` y `:398` | sí por los otros ocho | sí por los otros seis, y por la precondición |
| `V/17:181` (título) | Los nueve se resuelven… | Los siete pasos se resuelven… |
| `V/17:183` | No hay nueve verificaciones repartidas | queda: son nueve verificaciones |
| `V/17:400`–`:401` | Los nueve pasos… la sacaba de los nueve | Los siete pasos… la sacaba de los siete |
| `V/17:419` | pasa por siete pasos: todos menos el 5 y el 6 | pasa por **cinco** pasos, y por la precondición |
| `V/02:233` | los nueve pasos | los siete pasos |
| `V/20:318` | son los nueve pasos del cap. 17 §3.5 | son los siete pasos |
| `V/spec.md:58`, `:148`, `:187`, `:312` | nueve | siete |
| `V/descomposicion.md:58` | pasar por los nueve pasos | pasar por los siete pasos |
| `V/descomposicion.md:237` | El paso 5 y los otros ocho | El paso 5 y los otros seis |

Y un vecino del mismo lugar, texto vencido: `V/spec.md:152` llama al paso 5 *«título vivo»*,
cuando el cap. 17 lo llama *«fuente viva»* y la precisión 5 explica por qué no es lo mismo (el
paso 5 acepta el piso, que no es título). Queda *«5. **fuente viva**»*.

### 4.6 El registro, recontado con script

Todo contado hoy sobre el worktree; entre paréntesis, cómo.

| qué | medido | qué afirman los documentos | ¿coincide? |
|---|---|---|---|
| filas de la matriz | **98**: 56 · 15 · 23 · 4 (`contar-filas-de-la-matriz.py`) | cabecera de `D/06`, `B/spec`, `B/descomposicion` §2.7 (cuerpo) | sí; **no** en `B/06:27` (92 medidas) y en el título de `B/descomposicion` §2.7 (seis) — §2 |
| los `UNKNOWN` | `PA-6`, `GR-2`, `RC-8`, `RF-3` | ídem | sí, salvo las cinco frases del §2 |
| decisiones del log | **125** encabezados `### DEC-` − 1 plantilla = **124**; **124 IDs únicos, 0 duplicados** | resumen del log, `N/00:43`, handoff `:130` | sí; **no** en `N/04:123` (117) — §3.16 |
| metodología / funcionales | **15 / 109** por prefijo | resumen del log, handoff `:130` | sí |
| `SUPERSEDED` | **6** sobre el campo *Estado* (`DEC-SUB-001`, `-003`, `-005`, `DEC-MIG-001`, `-002`, `DEC-MP-003`) | resumen del log, handoff `:130` | sí |
| IDs de decisión citados que no existen | sobre 206 archivos: **4 patrones, los cuatro falsas alarmas** | — | `DEC-BILL-001` (ejemplo del PDR), `DEC-RF-00N` y `DEC-GRANT-00x` (patrones), `DEC-TRIAL-011` (alternativa descartada en `26-…/14`) |
| motivos de marca | **22** filas; **12** abiertos por `S14` y **10** por otros actos; **7** con `SÍ` | `N/01:701`, `N/08:158`, `B/02:874` y `:907`, `B/09:104`, `B/12:698`, `B/descomposicion:456`, `:465`; `B/05:291` (*«otros veintiún»*) | sí, todas |
| acciones administrativas | **14** filas en `N/08` §3 | `N/08` (*«CATORCE filas»*) y las seis de `V/17` | sí |
| máquinas | **10**: ocho tablas (`T`, `S`, `P`, `MP`, `A`, `PB`, `PP`, `RF`) más grace y pausa como sub-estados de suscripción | `N/03:21` y `:84`, `N/00:108`, `V/descomposicion` (cinco líneas), `V/20:63`, `:67`, `B/20:62`, `:246`, `:282`; `V/descomposicion:201` (*«otras nueve… en siete tablas más»*) | sí |
| hechos del reloj | **6** filas numeradas más la fila `C` en `N/01` §1.2 | todas las *«seis hechos»* del alcance | sí |
| `S1`–`S35` | **35**, sin huecos ni duplicados | `B/03` y su reparto | sí |
| `T1`–`T8` | **8**, sin huecos | `V/03`, `V/descomposicion` | sí |
| publicación | **12** filas `PB1`–`PB12`; **6** estados en `desde`/`hacia` | `V/03:521`, `V/descomposicion:59` | sí |
| las otras tablas | `P1`–`P7`, `MP1`–`MP5`, `A1`–`A6`, `RF1`–`RF5`, `PP1`–`PP3`, sin huecos | — | sí |
| firma del contrato | **7** campos por fuente (`tipo`, `referencia`, `alcance`, `objetivo`, `hasta`, `cobrada`, `piso`) más `cubierto` | *«siete campos»* en el contrato, las dos descomposiciones, `V/02:125`, `B/spec:182` | sí (`12-contrato:1025` cita *«seis»* como historia) |
| referencias `X/NN §x` | **1764**, **3 rotas** | — | las tres de `F-8V1D1-007` |
| pasos de la autorización | **7** y una precondición | *«nueve pasos»* en diecisiete líneas | **no** — §4.5 |

**Los conteos congelados cierran; lo que no cierra es texto**: cinco frases de la matriz, una
cifra del log en `N/04`, tres referencias y la unidad de los pasos. Es la misma lectura de la vuelta
anterior: el recuento con script ya es costumbre, la propagación del cambio no.

---

## 5. Preguntas al owner

### G5-1 · ¿Puede una acción administrativa tener `actor = sujeto`? (`F-8V1A1-001`)

1. **No, nunca: el paso 3 la rechaza.** La hace otra cuenta con el permiso. *Costo*: una regla 5
   en `V/17` §3.2 y un caso de prueba en `V5`. *Riesgo*: si el owner es la única cuenta con un
   permiso, necesita una segunda cuenta (la de admin separada de la de cliente) para operar lo
   suyo. *Capítulos*: `V/17` §3.2, `N/08` §3 (una línea).
2. **Sí, salvo las que le mueven plata o servicio a favor del sujeto**: asentar un cobro,
   reembolsar, registrar un pago manual, otorgar cortesía o grant, levantar una marca, y moderar o
   levantar la moderación de lo propio. *Costo*: la misma regla con una lista de siete. *Riesgo*:
   una lista que hay que mantener cuando el catálogo crezca (es la forma que ya falló en el
   desempate de motivos, `R4`).
3. **Sí, todas, con detector**: toda acción con `actor = sujeto` entra al resumen diario de
   `DEC-OBS-001`. *Costo*: un tipo más del resumen. *Riesgo*: el control es posterior al daño.

**Recomendación: 1.** Es una regla sin lista, no agrega mecanismo, y convierte *«lo confirma una
persona»* en lo que `D11` quiso decir: otra persona. El costo es de una sola vez (una cuenta más),
a esta escala.

**Juan.** Juan es `ADMIN` y además Partner Gold con pago manual. Con (1), intenta registrarse a sí
mismo la cuota del mes y el sistema le contesta *«sin permiso»*; la registra la otra cuenta admin,
que ve que no hay comprobante. Con (3), la registra, la suscripción queda cubierta y el resumen del
día siguiente la muestra.

*La otra posición, con honestidad*: si el owner opera solo y no quiere dos cuentas, (3) es lo
razonable, y su riesgo a 22 usuarios es chico.

### G5-2 · ¿El admin tiene escrituras sobre fichas ajenas fuera de las catorce? (`F-8V1A1-003`)

1. **No: el núcleo gana.** Soporte no carga ni corrige fichas ajenas; si hace falta una escritura,
   entra como fila nueva cuando aparezca. *Costo*: cero diseño. *Riesgo*: soporte pierde la
   herramienta de hoy (crear a nombre de un dueño, corregir, restaurar), y la presión empuja a
   pedirle la contraseña al cliente —la impersonación que `V/17` §3.2 regla 4 prohíbe—.
2. **Una fila nueva: *«editar el contenido de una ficha ajena»*** —crearla en borrador a nombre de
   su dueño, corregirla, restaurar contenido—, **sin publicar, sin destacar y sin borrar**, que
   siguen siendo del dueño o de sus filas. *Costo*: una fila (catorce → quince, con el recuento de
   las líneas que cuantifican), permiso propio, auditoría. *Riesgo*: bajo; las dos reglas del §3.3
   cierran los tres daños.
3. **Filas para todo lo de hoy**, incluidos publicar por el dueño y el `isFeatured` manual.
   *Costo*: tres o cuatro filas. *Riesgo*: publicar por el dueño gasta su trial sin su aviso, y el
   destaque manual regala una clave comercial.

**Recomendación: 2.** Conserva la herramienta de soporte sin tocar lo que mueve plata o trial.
Las dos reglas del §3.3 se aplican igual con cualquiera de las tres.

**Juan.** Juan pide a soporte que le cargue la ficha. Con (2), el admin la crea en borrador a su
nombre; Juan recibe el aviso de la fila 1 del cap. 19, publica él y su trial arranca cuando él
decide. Con (1), soporte le dice que la cargue él.

### G5-3 · ¿La vuelta anticipada de una pausa sigue libre? (`F-8V1B1-001`)

1. **La vuelta anticipada se hace efectiva en el próximo aniversario mensual del inicio de la
   pausa.** Restituye la premisa de `DEC-SUB-010` (*«vuelve el mismo día del mes en que pausó»*):
   la pausa dura ciclos enteros y la aritmética vuelve a compensarse sola. *Costo*: la fecha de
   `S10` por la segunda mitad de su evento y una línea en pantalla (*«volvés el 30/11»*).
   *Riesgo*: quien pide volver espera hasta un mes; el invariante 24 se cumple (termina antes de lo
   elegido) pero *«volver cuando quiera»* se acota. *Capítulos*: `B/03` `S10`, `B/19`, 📌 en
   `DEC-SUB-010`.
2. **Se acepta y se declara**, con detector: el barrido lista en el resumen las pausas que duraron
   menos de un ciclo y cruzaron una fecha de cobro salteada. *Costo*: un tipo del resumen.
   *Riesgo*: hasta tres ciclos gratis por año por cliente, y el sobrecobro inverso (pausar el 5 y
   volver el 25) sigue existiendo.
3. **Cobrar el ciclo salteado al volver** con un cobro puntual. *Costo*: un mecanismo nuevo
   (`/v1/orders` para suscripciones, medido sólo para addons en sandbox, `EX-30`). *Riesgo*: alto.

**Recomendación: 1.** No agrega mecanismo: corrige una fecha que la decisión ya suponía, y cierra
las dos direcciones del daño a la vez, incluida la que la decisión llama indefendible.

**Juan.** Juan cobra el 1. El 30/oct pausa un mes y el 2/nov pide volver. Con (1), vuelve el
30/nov: pierde dos días de octubre, el proveedor salteó el 1/nov y cobra el 1/dic, y gana uno de
noviembre; neto, casi cero. Con (2), vuelve el 2/nov y tiene noviembre gratis; el resumen lo muestra.

*La otra posición*: si el owner valora *«volver cuando quiera»* a la letra (el §26.2), (2) es
honesto: el costo es acotado y la población, chica.

### G5-4 · Hasta que entre el botón, ¿cómo se ejecuta una revocación? (`F-8V1B1-004`)

1. **Construir ya la fila de la revocación**: desde `ACTIVE`, `GRACE_PERIOD` o
   `CANCEL_SCHEDULED`, dentro de los 10 días del cobro; la ejecuta una persona con la acción
   *«cancelar una suscripción»* y motivo revocación (no suma fila al catálogo). Efectos, en un
   acto: cancela el preapproval con la regla de relectura de `S17` y el correo antes, fin de
   servicio en el acto, y `RF1` por el total del último pago. *Costo*: una fila de suscripción y la
   cita en `RF1`; el botón sigue fuera. *Riesgo*: bajo. *Capítulos*: `B/03` §3.2 y §6.1, `B/22`
   §2.2, `B5`.
2. **No construirla hasta el botón**, y declarar el camino manual: una persona cancela y reembolsa
   con dos acciones, en ese orden. *Costo*: cero diseño. *Riesgo*: son las *«dos cosas que alguien
   tenga que acordarse de hacer juntas»* que `DEC-RF-001` prohíbe, y hoy no hay transición desde
   `ACTIVE` que corte el servicio en el acto (`S11` deja el mes entero): Juan conserva el mes y
   recibe el total.

**Recomendación: 1.** Es lo que `DEC-RF-001` parte 1 ya decidió (una sola operación); lo único
que la parte 4 dejó afuera es el botón, y esta fila es lo que el botón va a llamar cuando entre.

**Juan.** Juan paga el 1/oct y el 4/oct escribe a soporte que se arrepiente. Con (1), la persona
registra la revocación: el preapproval se cancela, Juan pierde el acceso ese día y el reembolso
total queda esperando confirmación. Con (2), si la persona usa la baja de siempre, Juan conserva
octubre y recibe los 18.000.

### G5-5 · ¿Qué unidad construye `G13`? (contradicción (a))

1. **`V4`, como dice el contrato.** El guard se escribe con la implementación de arranque y calla
   hasta que un build apunte a producción. *Costo*: unas ocho ediciones (`V/descomposicion` §2.3 y
   dos menciones, `B/descomposicion:163`, `:168`, `:299`, `B/20:55`, `:343-349`, `:367`) y
   recontar guards por catálogo (la fila pasa de `B/20` a `V/20`; el total de 31 no cambia).
   *Riesgo*: ninguno; la defensa existe desde el primer día.
2. **`B4`, como dicen las descomposiciones.** *Costo*: el §6.3 del contrato (un párrafo) y la razón
   falsa de `B/20:349`. *Riesgo*: la defensa no existe durante la épica de verticales; como las
   épicas llegan juntas (`DEC-ARCH-007`), el merge queda cubierto igual.

**Recomendación: 1.** El argumento contrario ya lo contesta el propio §6.3, y el owner prefiere la
defensa que existe antes a la que alcanza justo.

**Juan.** Juan (implementador de `V6`) engancha por error una lectura a la implementación de
arranque en el tercer mes. Con (1), el primer build hacia producción falla con el nombre del
guard, aunque `B4` todavía no exista. Con (2), falla igual, pero sólo después de que `B4` esté
construida.

*La otra posición*: (2) cuesta dos ediciones en vez de ocho y protege el mismo merge.

---

## 6. Trabajo de aplicación sin decisión

Ediciones concretas; el texto está en el § citado.

1. `B/03` §4, fila *«qué se puede hacer adentro»*: tachar la condición de `GR-1` (§2.4).
2. `B/06` §11, fila `RN-3`: estado `PARTIALLY_SUPPORTED` (§2.4) y referencia a `B/09` (§3.17).
3. `B/06` introducción: 94 medidas, 26/09 (§2.4).
4. `B/descomposicion.md` §2.7, título: cuatro filas (§2.4).
5. `B/09` §3 (`:159`): `EX-1` `PARTIALLY_SUPPORTED` (§2.4).
6. `V/17` §4.3: *«ningún rol es una fuente»*; `N/04` fila 13 y `V/20` `G6`: segunda mitad
   (§3.2).
7. `N/08` §3: las dos reglas (acto ajeno ≠ el dueño publica; borrado sólo por `PB9`/`PB12`);
   `V/19` §2 fila Admin (§3.3).
8. Las ocho menciones de la clave de presencia en singular (§3.4).
9. `V/02` §2.1: pre-trial y piso no heredan VIP; `G-R3` (d) en `V/02` y `V/20`; `V/15` §6 quién
   lo pregunta (§3.5).
10. `V/17` §1.2 fila 1 y §3.3; `V/02:223`; `V/20:309`: el guest y el paso 1 (§3.6).
11. `V/17` §1.2: la lista cerrada del paso 2 (§3.7).
12. `B/03` `A1`: la ficha objetivo es el recurso del paso 4 (§3.8).
13. `B/03` `S1` y `B/12` §4.4: la `CHARGE_DECLINED` sin cancelar confirmada (§3.10).
14. `B/03` §6.1 `RF2` y §6: el reintento no supera lo confirmado (§3.12).
15. `B/03` `S30`: `desde` con `GRACE_PERIOD` (§3.13).
16. `N/01` §2: entrada *«pagando»*; las diez líneas de la lectura ancha; `B/03:220-222` (§3.14).
17. `N/03` §1 regla 5 y `N/04` `D17`: `S1` en la excepción (§3.15).
18. `N/04:123`: sacar el número (§3.16).
19. `B/02:915`, `:939` y `B/06:412`: referencias a `B/09` (§3.17).
20. `V/spec.md` §2: las épicas se citan (§3.18).
21. `D/11` cabecera y §1: tachado con fecha (§4.2).
22. `D/03-handoff.md:79`, `:154`, `:291`: cuatro ítems, nombrados (§4.3).
23. `V/descomposicion.md` §4 fila `V4` (§4.4).
24. Las dieciséis líneas de los pasos de la autorización que cambian y `V/spec.md:152` (§4.5).

**Dos 📌 en el log que piden OK del owner** (no son decisiones: precisan el alcance de una que ya
está, y el log no se toca sin él):

- **`DEC-ARCH-005`**:

  > 📌 Precisado el 2026-09-26, con OK del owner (FASE 9 vuelta 1, contradicción (b)): el
  > *«Problema»* de esta entrada —la pasarela sin decidir— **dejó de ser cierto el 2026-09-24**
  > (`DEC-MP-005`: Mercado Pago). La partición **sigue en pie por la otra razón que ya daba**: el
  > bloqueo alcanzaba al dinero y no a las capacidades, y el corte *«toca plata o no toca plata»*
  > no dependía de la pasarela. *«Autónomas»* se lee hoy como lo midió `NUCLEO/00`: las épicas se
  > citan entre sí, y lo que cruza por contrato es la cobertura (`DEC-ARCH-006`).

- **`DEC-RF-001`**, parte 3:

  > 📌 Precisado el 2026-09-26, con OK del owner (FASE 9 vuelta 1, `F-8V1B1-005`): *«cae al
  > reembolso total»* vale cuando lo confirmado es el total —la revocación de esta entrada—. Sobre
  > un reembolso parcial, el reintento ante un `2084` parte el monto confirmado y nunca lo supera
  > (`D11`; `B/03` §6.1, `RF2`).

---

## 7. Key Learnings

1. Un conteo equivocado puede ser un error de **unidad** y no de suma: los «nueve pasos» son nueve
   verificaciones agrupadas en siete pasos, y cada frase que después restó pasos al nueve heredó el
   error sin que ningún recuento de tablas lo viera.
2. Una propagación de estado de la matriz deja texto vencido **en la proporción de los lugares que
   no se buscaron**: el filtro de proximidad (ID a menos de 70 caracteres de `UNKNOWN`) encontró
   cuatro de cinco; la quinta estaba en una celda larga y salió a mano.
3. Una decisión del owner que saca algo de alcance (el botón de arrepentimiento) no saca el hecho
   que el diseño tiene que atender (la revocación que llega por otro canal); hay que separar la
   superficie del derecho.
4. Una regla de desempate escrita para un contexto (caer al total en una revocación) se lee como
   general si nadie dice su alcance; el 📌 que la acota es más barato que reabrirla.
5. Una excepción del núcleo escrita como lista (*«`S3` y `S6`»*) se recorre bien por **clase de
   relectura** (reloj, mutación nuestra, aviso, acto del cliente): el script de condiciones dio
   diez filas y una sola clase sin cubrir.
6. El resolvedor de referencias `X/NN §x` sobre todo el alcance (1764) encontró exactamente las
   tres del hallazgo: conviene correrlo como cierre de cada tanda, no sólo cuando un agente lo
   reporta.
7. Dos ubicaciones de un guard pueden proteger lo mismo y aun así la contradicción importa: la
   razón escrita de una de ellas era falsa (*«el consumidor del contrato es billing»*), y una razón
   falsa en un documento vigente se hereda.

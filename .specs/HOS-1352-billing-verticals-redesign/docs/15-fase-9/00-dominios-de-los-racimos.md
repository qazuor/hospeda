---
title: "FASE 9 · el dominio de cada racimo"
linear: HOS-1352
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 9
---

# FASE 9 — el dominio de cada racimo

`DEC-METH-004` define «resuelto» para un racimo como: el camino del hallazgo, reejecutado sobre el
texto corregido, ya no llega — **y además** la regla corregida se verifica contra **todo el dominio
que cuantifica**. Ese dominio no estaba escrito en ningún lado. Éste es el documento que lo escribe.

**Este documento no resuelve nada.** No propone correcciones, no toca capítulos, no reabre
decisiones. Enumera, para cada racimo, el conjunto completo de casos sobre los que cuantifica la
regla que el racimo rompió, cuáles de esos casos la FASE 8 ya probó que fallan, y cuáles **nadie
miró todavía** — que es el verdadero producto.

Cada elemento de cada enumeración lleva su fuente. Los paths se abrevian así: `NUCLEO` es
`HOS-1352-…/docs/nucleo/`, `V` es `HOS-1353-verticales-capacidades-y-autorizacion/docs/`, `B` es
`HOS-1354-billing-cobro-y-proveedor/docs/`, y lo que no lleva prefijo es `HOS-1352-…/docs/`.

| racimo | tamaño del dominio | ya probados fallando | sin mirar |
|---|---|---|---|
| R1 · los «vivos» del `UNIQUE` | 90 | 6 | 84 |
| R2 · el contrato de cobertura | 28 | 11 | 17 |
| R3 · el trial no puede nacer | 45 | 8 | 37 |
| R4 · lo terminal vs el vínculo | 28 | 5 | 23 |
| R5 · la migración | 54 | 17 | 37 |
| R6 · el programa no puede empezar | 82 | 16 | 66 |
| | **327** | **63** | **264** |

---

## R1 · el conjunto de estados «vivos» del `UNIQUE` está mal calibrado

### 1. La regla que el racimo rompió

> Máximo **una** suscripción principal viva por `user + vertical`, impuesta por la base.

Cita textual, `B/02-modelo-de-datos.md` §2.2:

> **`UNIQUE(user_id, vertical) WHERE clase = principal AND estado ∈ {vivos}`** — es el §11,
> **impuesto por la base y no por un chequeo**

Y sus dos gemelas de servicio, `B/03-maquinas-de-estado.md` §3.2 (condición de `S1`): *«no hay otra
viva para ese `user + vertical`»*; y §3.3: *«dos vivas para el mismo `user + vertical` | es el §11.
La condición está en S1, y el capítulo 05 la hace cumplir con una restricción de unicidad»*.

### 2. El dominio

**Dimensión A — los 9 estados de la máquina de suscripción, con su clasificación vivo / no-vivo.**
Estados de `B/03-maquinas-de-estado.md` §3.1; la clasificación, de `B/02-modelo-de-datos.md` §2.2.

| # | estado | ¿vivo? | fuente de la clasificación |
|---|---|---|---|
| E1 | `PENDING_AUTHORIZATION` | **vivo** | `B/02` §2.2 |
| E2 | `ABANDONED` | no vivo | `B/02` §2.2 |
| E3 | `ACTIVE` | **vivo** | `B/02` §2.2 |
| E4 | `GRACE_PERIOD` | **vivo** | `B/02` §2.2 |
| E5 | `PAUSED` | **vivo** | `B/02` §2.2 |
| E6 | `SUSPENDED` | **vivo** | `B/02` §2.2 |
| E7 | `CANCEL_SCHEDULED` | **vivo** | `B/02` §2.2 |
| E8 | `CANCELLED` | no vivo | `B/02` §2.2 |
| E9 | `RECONCILIATION_REQUIRED` | no vivo, **a propósito** | `B/02` §2.2 |

**Son seis vivos y tres no-vivos, no siete y dos.** El conteo sale de la frase literal del §2.2,
que enumera los seis y después nombra los tres que quedan afuera. El décimo renglón de la tabla de
`B/03` §3.1 —*(sin fila)*— no es un estado: es el inicial, y es el único caso donde la restricción
no tiene con qué colisionar.

**Dimensión B — los caminos que piden una SEGUNDA fila principal para el mismo `user + vertical`.**
Cada uno es un lugar del diseño donde alguien llega a `S1` teniendo ya una fila.

| # | camino | fuente |
|---|---|---|
| C1 | alta nueva: la persona elige un plan | `B/03` §3.2, `S1` |
| C2 | cambio de **ciclo**: cancelar y recrear, con checkout | `DEC-SUB-006`, decisión |
| C3 | cambio de **plan** / upgrade: el mismo mecanismo | `DEC-SUB-007`, decisión |
| C4 | reintento tras `ABANDONED` | `B/03` §3.3: *«Volver a intentar crea una fila nueva»* |
| C5 | reintento tras un **primer cobro rechazado** | `B/12` §4.4, punto 1 |
| C6 | recontratar tras `CANCELLED` | `B/12` §4.2 |
| C7 | re-autorizar tras la baja que **decide el proveedor** por mora | `B/12` §1.4 |
| C8 | arrepentirse de un `CANCEL_SCHEDULED` | `B/03` §3.3: *«es una suscripción nueva»* |
| C9 | recontratar con un `RECONCILIATION_REQUIRED` abierto | `B/02` §2.2, la exclusión declarada |
| C10 | reintento dentro de la ventana de `PENDING_AUTHORIZATION` | `B/03` §3.4, punto 4 |

**Dimensión C — la clase, que la regla acota y por eso no multiplica.** `principal` ·
`complemento` (`NUCLEO/01-glosario.md` §1.4; el `WHERE clase = principal` de `B/02` §2.2). La
regla cuantifica **sólo** sobre `principal`; la clase `complemento` queda fuera por construcción y
sin ninguna restricción propia — `NUCLEO/01` §1.4: *«Las de complemento no tienen tope propio»*.

### 3. El tamaño del dominio

**9 estados × 10 caminos = 90 pares ordenados**, todos con `clase = principal`.

Cada par es la pregunta: *«si la fila que ya existe está en este estado y llega este camino, ¿qué
hace la base, y qué hace la condición de `S1`?»*

Adyacente y declarado aparte: el dominio de `clase = complemento` son los **5 estados** de la
máquina de addon (`B/03` §8) × sus **6 transiciones** `A1`…`A6` = **30 casos**, sobre los que la
regla **no dice nada**. No se suman a los 90: se nombran para que nadie los lea como cubiertos.

### 4. Los casos que los hallazgos YA probaron que fallan

| par (estado existente, camino) | hallazgos |
|---|---|
| (`ACTIVE`, C2 cambio de ciclo) | `F-8B1-001` · `F-8B2-001` · `F-8B3-001` |
| (`ACTIVE`, C3 upgrade) | `F-8B1-001` · `F-8B3-001` · `F-8B2-005` |
| (`SUSPENDED`, C5 reintento tras primer cobro rechazado) | `F-8B2-008` |
| (`SUSPENDED`, C1 alta nueva) | `F-8B2-008`, paso 5 del camino |
| (`RECONCILIATION_REQUIRED`, C1 alta nueva) | `F-8B1-002` · `F-8B2-002` |
| (`RECONCILIATION_REQUIRED`, C9 la vuelta de `S15`) | `F-8B2-002`, pasos 4 y 5 |

**Seis pares de noventa.** Y uno de los ocho críticos del racimo, `F-8B3-002`, **no vive en esta
grilla**: es un segundo candado —`UNIQUE(subscription_id, período) WHERE el pago está
acreditado`, de `B/05-idempotencia-y-concurrencia.md` §2, `C5`— sobre un eje que el modelo no
tiene (`payment` no guarda período, y `manual_payment` es otra tabla). Se registra acá porque el
racimo lo agrupa, y su dominio se declara incerrable en la sección final.

### 5. Los casos que NADIE miró todavía

**84 pares.** Los bloques enteros sin una sola lectura:

| bloque | pares | por qué importa |
|---|---|---|
| `GRACE_PERIOD` × los 10 caminos | 10 | `DEC-SUB-003` permite cambiar de plan **estando en grace** |
| `PAUSED` × los 10 caminos | 10 | `EX-11`: el proveedor rechaza toda modificación estando pausada |
| `CANCEL_SCHEDULED` × los 10 caminos | 10 | es vivo, y `B/03` §3.3 declara que arrepentirse crea otra |
| `ABANDONED` × los 10 caminos | 10 | es no-vivo: nada impide la segunda, la tercera y la décima |
| `CANCELLED` × los 10 caminos | 10 | ídem, y es la parte de la cartera que más crece |
| `PENDING_AUTHORIZATION` × los 10 | 10 | `C10` dice «se reusa»; los otros nueve no dicen nada |
| `ACTIVE` × C1, C4…C10 | 8 | sólo C2 y C3 fueron leídos |
| `SUSPENDED` × C2…C4, C6…C10 | 8 | sólo C1 y C5 fueron leídos |
| `RECONCILIATION_REQUIRED` × C2…C8, C10 | 8 | sólo C1 y C9 fueron leídos |

### 6. El criterio de verificación

**Para cada uno de los 90 pares hay que poder afirmar, por escrito y en un solo lugar, si el
`INSERT` entra o se rechaza, y si ese resultado es el que el diseño quiere o el bloqueo de un
camino que el diseño declara en otro capítulo.**

---

## R2 · el contrato de cobertura no puede transportar `grant` ni `addon`

### 1. La regla que el racimo rompió

> Todo lo que verticales necesita de billing se transporta en un solo hecho, y **nada más** cruza
> la frontera.

Cita textual, `12-contrato-de-cobertura.md` §2:

```text
cobertura(user, vertical) → {
    cubierto:  sí | no
    fuentes:   [ { tipo, versiónDePlan, hasta } ]
}
```

y §4: *«**No cruzan** montos, precios, monedas, ciclos, estados de pago, ids del proveedor, fechas
de cobro, medios de pago, comprobantes ni reembolsos»*, precedido por
`11-particion-del-programa.md` §3: *«**Nada más cruza la frontera.**»*

### 2. El dominio

**Dimensión A — las fuentes de una capacidad, completas.** El §36 las lista y
`NUCLEO/01-glosario.md` §1.6 y §5 las transcriben; el trial entra por el paso 5 (`V/17` §1.2).

| # | fuente | dónde se declara | ¿tiene `tipo` en el contrato? |
|---|---|---|---|
| S1 | versión de plan, vía suscripción | `NUCLEO/01` §1.6 y §5 | sí — `SUSCRIPCIÓN` |
| S2 | herencia de Turista VIP | `NUCLEO/01` §1.6 y §5; `DEC-ENT-003` | **no** |
| S3 | addon | `NUCLEO/01` §1.6 y §5; `V/02` §3.1 | **no** |
| S4 | cortesía temporal | `NUCLEO/01` §1.5 y §1.6 | sí — `CORTESÍA` |
| S5 | grant permanente | `NUCLEO/01` §1.5 y §1.6 | sí — `GRANT` |
| S6 | trial | `V/17` §1.2 paso 5; contrato §5.1 | sí — `TRIAL` |

**Son seis fuentes y el contrato nombra cuatro.** Dos de las seis no tienen `tipo` (`S2`, `S3`) y
dos de las cuatro que lo tienen no tienen plan al cual apuntar (`S4`, `S5`).

**Dimensión B — los campos de contenido, por fuente.** `versiónDePlan` y `hasta`
(`12-contrato-de-cobertura.md` §2.1). `tipo` es el discriminador, no contenido; `cubierto` es del
conjunto, no de la fuente.

**Dimensión C — el scope de la fuente contra la clave de resolución.** Los cuatro scopes, de
`V/15-entitlements-y-limits.md` §1 (*«una ficha, una vertical, el usuario, todo»*, §40 y §35.1) y
enumerados en `B/16-addons.md` §4.2; las dos claves, de `V/15` §3.2.

| scope de la fuente | `user + vertical` | `user` |
|---|---|---|
| `LISTING` | — | — |
| `VERTICAL_SUBSCRIPTION` | — | — |
| `USER` | — | — |
| `GLOBAL` | — | — |

Ocho casillas; la firma de `cobertura(user, vertical)` expresa dos.

**Dimensión D — la dirección inversa, que el contrato no declara.** Los campos que billing lee de
tablas de verticales, enumerados con su fuente:

| # | campo | tabla, de quién | dónde billing lo lee | ¿existe? |
|---|---|---|---|---|
| D1 | días de grace | `plan_version`, verticales (`11-particion` §2.1) | `B/03` §4 | sí |
| D2 | días de trial | `plan_version`, verticales | `NUCLEO/01` §1.3 | sí |
| D3 | permite pausa | `plan_version`, verticales | `NUCLEO/01` §3, `puedePausar()` | sí |
| D4 | si admite altas | `vertical`, verticales | `B/10` §4.6 | **no** |
| D5 | fecha de fin de servicio | `vertical`, verticales | `B/10` §4.6 | **no** |

`V/02-modelo-de-datos.md` §2.1 dice qué guarda `vertical`: *«el espejo en base del enum de
código»*. Nada más.

**Dimensión E — las tres defensas, que la decisión declara no opcionales.**
`12-contrato-de-cobertura.md` §6: *«Ninguna es opcional, y las tres son parte de la decisión
(`DEC-ARCH-006`), no una recomendación»*. §6.1 el default es negar; §6.2 un solo juego de casos
contra las dos implementaciones; §6.3 el guard que impide que la de arranque llegue a producción.

### 3. El tamaño del dominio

| bloque | cuenta |
|---|---|
| transporte: 6 fuentes × 2 campos de contenido | 12 |
| scope: 4 scopes de fuente × 2 claves de resolución | 8 |
| dirección inversa: los 5 campos que billing lee | 5 |
| las 3 defensas | 3 |
| **total** | **28** |

### 4. Los casos que los hallazgos YA probaron que fallan

| caso | hallazgos |
|---|---|
| (`GRANT`, `versiónDePlan`) | `F-8A1-004` · `F-8A3-001` · `F-8B3-007` |
| (`CORTESÍA`, `versiónDePlan`) | `F-8A1-004`, párrafo de cierre |
| (addon, `versiónDePlan`) | `F-8A3-002` · `F-8B3-007` |
| (addon, `hasta`) | `F-8B3-007`: sin `tipo`, ninguno de sus dos campos tiene portador |
| (addon, la fila del cobro de única vez) | `F-8B3-003` |
| (`LISTING` × `user + vertical`) | `F-8A1-003` |
| dirección inversa D4 · `vertical.admite_altas` | `F-8B3-009` |
| dirección inversa D5 · `vertical.fecha_fin_servicio` | `F-8B3-009` |
| defensa §6.1 · sin dueño | `F-8C1-003` |
| defensa §6.2 · sin dueño | `F-8C1-003` |
| defensa §6.3 · nace en `B4`, épica bloqueada | `F-8C1-003` |

**Once de veintiocho.**

### 5. Los casos que NADIE miró todavía

**Diecisiete.** Los que más pesan:

| caso | por qué importa |
|---|---|
| (herencia Turista VIP, `versiónDePlan`) y (·, `hasta`) | es la quinta fuente del §36 y no tiene `tipo` |
| (`TRIAL`, `versiónDePlan`) | el plan de trial **no guarda** limits ni entitlements: se derivan |
| (`CORTESÍA`, `hasta`) | `DEC-GRANT-003` la implementa pausando: la fecha es nuestra, no del proveedor |
| (`SUSCRIPCIÓN`, `hasta`) | `DEC-SUB-009`: la fecha de fin de servicio es un dato nuestro |
| (`VERTICAL_SUBSCRIPTION`, `USER`, `GLOBAL`) × las 2 claves | 6 casillas; sólo `LISTING` fue leído |
| dirección inversa D1, D2, D3 | existen, pero cruzan una frontera que §4 declara cerrada |

### 6. El criterio de verificación

**Para cada una de las seis fuentes hay que poder decir qué campo del contrato transporta lo que
otorga y hasta cuándo; para cada uno de los cuatro scopes, con qué clave se resuelve; y para cada
una de las tres defensas, qué unidad de trabajo la construye y en qué épica.**

---

## R3 · el trial no puede nacer

### 1. La regla que el racimo rompió

> Ninguna operación de dominio se ejecuta sin pasar por los nueve pasos, y el paso 5 exige un
> título vivo.

Cita textual, `V/17-autorizacion.md` §1.2:

> | 5 | **título vivo** | ¿tiene trial, suscripción, cortesía o grant que lo cubra? | sin cobertura |

y §1.3, que cierra la única puerta que quedaba:

> **No hay nueve verificaciones repartidas: hay una resolución de autorización que las ejecuta en
> orden, y es la única que las ejecuta.**

### 2. El dominio

**Dimensión A — las cinco verticales, con su evento de activación declarado.** Verticales de
`NUCLEO/01-glosario.md` §1.2; eventos de `DEC-TRIAL-006`, tabla de la decisión.

| # | vertical | evento de activación | ¿tiene ficha? |
|---|---|---|---|
| A1 | alojamiento | la ficha queda publicada (`PB1`, `DEC-TRIAL-005`) | sí |
| A2 | gastronomía | ídem | sí |
| A3 | experiencia | ídem | sí |
| A4 | turista | el botón `Empezar` del §47 | no |
| A5 | partner | **ninguno declarado** — trial en cero hoy (`DEC-TRIAL-003`) | no; presencia (§17.1) |

**Dimensión B — los cuatro estados de la máquina de trial.** `NUCLEO/01-glosario.md` §2.2, y la
máquina en `V/03-maquinas-de-estado.md` §2: `PRE_TRIAL` · `TRIAL_ACTIVE` · `TRIAL_CONVERTED` ·
`TRIAL_EXPIRED`.

**Dimensión C — las cinco transiciones.** `V/03-maquinas-de-estado.md` §2, tabla `T1`…`T5`:

| # | de | a | evento |
|---|---|---|---|
| T1 | `PRE_TRIAL` | `TRIAL_ACTIVE` | el evento de activación declarado por la vertical |
| T2 | `TRIAL_ACTIVE` | `TRIAL_CONVERTED` | se autoriza una suscripción |
| T3 | `TRIAL_ACTIVE` | `TRIAL_EXPIRED` | llega la fecha de fin |
| T4 | `TRIAL_ACTIVE` | `TRIAL_ACTIVE` | promo de extensión o cortesía |
| T5 | `TRIAL_EXPIRED` | `TRIAL_CONVERTED` | se autoriza una suscripción |

### 3. El tamaño del dominio

| bloque | cuenta |
|---|---|
| 5 verticales × 4 estados de trial: *«¿qué contesta el paso 5 acá?»* | 20 |
| 5 verticales × 5 transiciones: *«¿el evento que la dispara pasa el paso 5?»* | 25 |
| **total** | **45** |

### 4. Los casos que los hallazgos YA probaron que fallan

| caso | hallazgos |
|---|---|
| (alojamiento, `PRE_TRIAL`) · (gastronomía, ·) · (experiencia, ·) | `F-8A1-002` · `F-8A2-001` |
| (turista, `PRE_TRIAL`) | `F-8A2-001`, paso 6 del camino |
| (alojamiento, `T1`) · (gastronomía, `T1`) · (experiencia, `T1`) | `F-8A1-002` · `F-8A2-001` |
| (turista, `T1`) | `F-8A2-001`, paso 6 |

**Ocho de cuarenta y cinco.** Y `F-8A2-002` atraviesa la columna `PRE_TRIAL` entera por otro eje:
la fila que guardaría el estado lleva `UNIQUE(user_id, vertical)` **sin condición de estado**
(`V/02` §2.2), así que su sola existencia niega la condición de `T1`.

### 5. Los casos que NADIE miró todavía

**Treinta y siete.** Los bloques:

| bloque | casos | por qué importa |
|---|---|---|
| (partner, los 4 estados) | 4 | no tiene evento declarado: su `PRE_TRIAL` no sale nunca |
| (partner, las 5 transiciones) | 5 | `A5` es la vertical que el §10.4 obliga a declarar el suyo |
| (las 5 verticales, `TRIAL_ACTIVE`) | 5 | el único estado donde el paso 5 claramente contesta que sí |
| (las 5 verticales, `TRIAL_CONVERTED`) | 5 | el título pasa a ser la suscripción: es `S6`, no `S1` |
| (las 5 verticales, `TRIAL_EXPIRED`) | 5 | `PB2` ya bajó las fichas; qué queda ejecutable no está dicho |
| (las 5 verticales, `T2`…`T5`) | 16 | `T2` y `T5` **están inactivas hasta que exista billing** (§3.2) |

### 6. El criterio de verificación

**Para cada uno de los 20 pares (vertical, estado de trial) hay que poder decir qué contesta el
paso 5, y para cada uno de los 25 pares (vertical, transición) si el evento que la dispara puede
atravesar los nueve pasos sin una exención por ruta.**

---

## R4 · lo terminal se define sobre el estado local, y el riesgo vive en el vínculo

### 1. La regla que el racimo rompió

> Los estados terminales no se barren.

Cita textual, `B/09-conciliacion.md` §3:

> **Los estados terminales no se barren**: `CANCELLED` y `ABANDONED` no pueden divergir hacia nada
> que nos importe, y barrerlos es gastar llamadas sobre la parte de la cartera que más crece.

Contra la frase que cuenta con lo contrario, `B/16-addons.md` §4.3:

> Lo que lo hace detectable es el barrido del capítulo 09, que compara contra **nuestro**
> inventario (`DEC-CONC-002`): un addon en estado terminal con su preapproval vivo es una
> discrepancia que el barrido ve.

### 2. El dominio

**Dimensión A — los estados terminales que pueden llevar un vínculo con el proveedor.**

| # | máquina | estado terminal | fuente |
|---|---|---|---|
| T1 | Suscripción | `ABANDONED` | `B/03` §3.1 · `B/09` §3 |
| T2 | Suscripción | `CANCELLED` | `B/03` §3.1 · `B/09` §3 |
| T3 | Addon (instancia) | `ABANDONED` | `B/03` §8, `A3` |
| T4 | Addon (instancia) | `EXPIRED` | `B/03` §8, `A4` |
| T5 | Addon (instancia) | `CANCELLED` | `B/03` §8, `A5` y `A6` |

**Dimensión B — las transiciones que llegan a un terminal, con lo que cada una declara sobre el
preapproval.**

| # | transición | hacia | qué dice del preapproval | fuente |
|---|---|---|---|---|
| X1 | `S3` | `ABANDONED` | *«se cancela el preapproval en el proveedor»* | `B/03` §3.2 |
| X2 | `S12` | `CANCELLED` | *«se corta el servicio; proceso idempotente»* — nada | `B/03` §3.2 |
| X3 | `S13` | `CANCELLED` | *«se cancela toda obligación de pago, sin reembolso»* | `B/03` §3.2 |
| X4 | `A3` | `ABANDONED` | *«mismas 72 h que S3»* | `B/03` §8 |
| X5 | `A4` | `EXPIRED` | *«el reloj no se congela»* — nada del preapproval | `B/03` §8 |
| X6 | `A5` | `CANCELLED` | *«se cancelan en el proveedor, de inmediato»* (`B/16` §4.3) | `B/03` §8 |
| X7 | `A6` | `CANCELLED` | *«se consume: no se libera ni se reasigna»* | `B/03` §8 |

**Dimensión C — los dos estados posibles del vínculo cuando la fila local ya es terminal.**
Cancelado en el proveedor · **vivo** en el proveedor. Los dos existen porque está medido que el
proveedor acepta y no aplica (`EX-20`) y que cancelar y mutar no emiten webhook (`EX-15`). Esta
dimensión se deriva; **no está escrita en ningún documento** — ver la sección final.

**Dimensión D — los estados que el barrido SÍ mira y divergen por diseño.**
`CANCEL_SCHEDULED` es, textualmente, *«dada de baja en el proveedor, con servicio sostenido hasta
el fin del período pagado»* (`B/03` §3.1) y `NUCLEO/01` §2.2: *«**`CANCEL_SCHEDULED` existe aunque
el proveedor ya esté cancelado**»*. `B/09` §3 no lo exime.

### 3. El tamaño del dominio

| bloque | cuenta |
|---|---|
| 7 transiciones hacia un terminal × 2 estados del vínculo | 14 |
| 9 estados de suscripción + 5 de addon: *«¿el barrido lo mira, y su vínculo puede divergir?»* | 14 |
| **total** | **28** |

### 4. Los casos que los hallazgos YA probaron que fallan

| caso | hallazgos |
|---|---|
| (`A5`, vínculo vivo) | `F-8B1-006` · `F-8B2-007` · `F-8B3-008` |
| (`A6`, vínculo vivo) | `F-8B1-006` · `F-8B2-007` · `F-8B3-008` |
| (`S12` de la principal arrastrando complementos, vínculo vivo) | `F-8B1-006`, pasos 2 y 3 |
| (`CANCEL_SCHEDULED`, el barrido lo mira y diverge por diseño) | `F-8B2-004` |
| (`A1` duplicado: dos vínculos para una intención) | `F-8B2-006` |

**Cinco de veintiocho.**

### 5. Los casos que NADIE miró todavía

**Veintitrés.** Los que más pesan:

| caso | por qué importa |
|---|---|
| (`S3`, vínculo vivo) | la cancelación del preapproval puede aceptarse y no aplicarse (`EX-20`) |
| (`A3`, vínculo vivo) | el addon que muere a las 72 h deja su preapproval, y nadie vuelve |
| (`A4` `EXPIRED`, vínculo vivo) | `EXPIRED` no está entre los dos terminales que §3 nombra |
| (`S13` Free Forever, vínculo vivo) | cancela *«toda obligación»* sobre hasta N preapprovals |
| (`S12`, vínculo vivo) | `S11` ya canceló, pero nada verifica que la cancelación se aplicara |
| `PAUSED` y su vínculo | `DEC-GRANT-004`: cortesía y pausa **se ven idénticas** en el proveedor |
| `RECONCILIATION_REQUIRED` y su vínculo | `F-8B1-002` mide que queda `authorized` sin cancelar |

### 6. El criterio de verificación

**Para cada una de las 7 transiciones hacia un terminal hay que poder decir qué queda del vínculo
con el proveedor y quién lo vuelve a mirar; y para cada uno de los 14 estados de las dos máquinas,
si el barrido lo recorre y si su divergencia con el proveedor es esperada o es un incidente.**

---

## R5 · la migración no tiene dueño, ni orden, ni vuelta atrás

### 1. La regla que el racimo rompió

> Son cinco relaciones y se transcriben una por una a mano. Cero código de migración.

Cita textual, `V/21-migracion.md` §2.2: *«**Son cinco relaciones y se transcriben una por una a
mano** (`DEC-MIG-001`: cero código de migración)»*. Y la otra mitad de la misma regla, en
`DEC-MIG-001`: *«Se los contacta, se los da de alta en el motor nuevo y se cancela el compromiso
viejo. **Cero código de migración.**»*

**El dominio se enumera contra lo MEDIDO, no contra el código legacy.** La FASE 5 no está hecha
(`DEC-METH-003`, gate sin abrir), así que las 27 tablas del gap no están medidas.

### 2. El dominio

**Dimensión A — las 8 suscripciones vivas medidas.** `07-facts-inventory.md`, «Suscripciones
vivas», medición del 2026-09-15 re-verificada el 2026-09-17 a las 12:52 `-03` sin un solo cambio.

| # | status | vertical | compromiso de cobro | trial | fin de período | ¿está en «las cinco»? |
|---|---|---|---|---|---|---|
| F1 | `trialing` | alojamiento | **sí** — 2026-09-26 | sí | 2026-09-27 | sí |
| F2 | `trialing` | alojamiento | **sí** — 2026-11-25 | sí | 2026-09-27 | sí |
| F3 | `trialing` | alojamiento | **sí** — 2026-11-30 | sí | 2026-10-01 | sí |
| F4 | `comp` | alojamiento | no | **no** | **2126-06-30** | sí |
| F5 | `comp` | alojamiento | no | **no** | **2126-07-21** | sí |
| F6 | `abandoned` | alojamiento | no | **sí** | — | **no** |
| F7 | `abandoned` | alojamiento | no | **sí** | — | **no** |
| F8 | `abandoned` | turista | no | **sí** | — | **no** |

**Son ocho filas y la regla cuantifica sobre cinco.** Tres tienen trial y quedan afuera (`F6`,
`F7`, `F8`); dos de las cinco no tienen trial y son las únicas que la regla de transcripción no
sabe escribir (`F4`, `F5`).

**Dimensión B — las entidades destino del modelo nuevo.**

| # | entidad destino | dónde se declara | ¿tiene regla de transcripción? |
|---|---|---|---|
| D1 | `trial` | `V/02` §2.2 | **sí** — `V/21` §2.3, dos filas |
| D2 | `subscription` | `B/02` §2.2 | no |
| D3 | `provider_link` | `B/02` §2.2 | no — `F-8B3-006` |
| D4 | `courtesy_grant` / `permanent_grant` | `B/02` §2.4 | no — `F-8A3-004` |
| D5 | `plan_version` anclada + el piso del trinquete | `V/02` §2.1 y §2.2 | no |
| D6 | `billing_option` | `B/02` §2.1 | no |

**Dimensión C — el orden de las dos operaciones irreversibles.** Para cada fila con compromiso de
cobro vivo hay dos órdenes posibles y ninguno está escrito: **cancelar primero** (`PA-5`: cancelar
es irreversible) o **autorizar primero** (`EX-6`: conviven, y la ventana de `S3` dura 72 h).
Fuente del par: `F-8C2-001`, contra `DEC-MIG-001` y `B/21` §3.2 (a).

### 3. El tamaño del dominio

| bloque | cuenta |
|---|---|
| 8 filas × 6 entidades destino | 48 |
| 3 filas con compromiso de cobro vivo × 2 órdenes | 6 |
| **total** | **54** |

Y dos ejes adyacentes que **no son casos sino cardinalidades de cero**: de las **22 unidades de
trabajo** publicadas (`V1`…`V9` en `HOS-1353-…/descomposicion.md` §2, `B1`…`B13` en
`HOS-1354-…/descomposicion.md`), **ninguna** incluye el capítulo 21 (`F-8A3-009`); y de los tres
cuerpos de diseño, **ninguno** contiene las palabras `rollback`, `rollout` ni `feature flag`
(`F-8C2-005`, medido con `rg` el 2026-09-19).

### 4. Los casos que los hallazgos YA probaron que fallan

| caso | hallazgos |
|---|---|
| (`F6`, `F7`, `F8`) × D1 `trial` — quedan sin fila y reciben un trial nuevo | `F-8A3-004` |
| (`F4`, `F5`) × D4 — servicio perpetuo sin instrumento destino | `F-8A3-004` |
| (`F1`, `F2`, `F3`) × D2 `subscription` | `F-8B3-006` |
| (`F1`, `F2`, `F3`) × D3 `provider_link` | `F-8B3-006` |
| (`F1`, `F2`, `F3`) × los 2 órdenes | `F-8C2-001` |
| (las 8) × D5 — la fila de `trial` pide `plan_version`, que es `V2` de la otra épica | `F-8C2-002` |

**Diecisiete de cincuenta y cuatro.** Y `F-8C2-002` agrega un defecto que no es una celda sino la
grilla entera: `DEC-MIG-001` (dar de alta y cancelar el viejo) y `V/21` §2.3 (transcribir el
estado sin reinterpretarlo) **describen dos operaciones distintas sobre las mismas cinco filas**.

### 5. Los casos que NADIE miró todavía

**Treinta y siete.** Los bloques:

| bloque | casos | por qué importa |
|---|---|---|
| las 8 filas × D6 `billing_option` | 8 | las 8 son mensuales: hay un ciclo y un precio que nadie escribe |
| (`F4`, `F5`) × D1, D2, D3, D5 | 8 | sin trial, la única regla escrita no las alcanza |
| (`F6`, `F7`, `F8`) × D2…D6 | 15 | están fuera de «las cinco»: ninguna regla las nombra |
| (`F1`, `F2`, `F3`) × D4, D6 | 6 | ¿una `trialing` migrada arrastra alguna concesión? |

> **Corregido el 2026-09-19 por el recorrido de R5** (`06-R5-resuelto.md` §6). Esta tabla de
> bloques **cuenta `D6` tres veces** y **omite `(F1, F2, F3) × D1` y `(F1, F2, F3) × D5`**. El total de 37 no
> cambia —los solapamientos y las omisiones se compensan— pero los bloques no se pueden leer como
> particiones. Y `D6` **no aplica a cinco de las ocho filas**: un grant y un trial no tienen ciclo
> ni precio, así que ese bloque se contesta 3 y 5, no 8.

### 6. El criterio de verificación

**Para cada una de las 48 celdas (fila medida × entidad destino) hay que poder decir qué se
escribe o por qué no se escribe nada, y para cada una de las 3 filas con compromiso vivo, en qué
orden se ejecutan las dos operaciones irreversibles y quién las ejecuta.**

---

## R6 · el programa, como programa, no puede empezar todavía

### 1. La regla que el racimo rompió

> Las sub-épicas cortan de la rama paraguas y mergean a ella, nunca a `staging` directamente; la
> revisión ocurre en los PRs de sub-épica → paraguas.

Cita textual, `11-particion-del-programa.md` §6.1:

> **las sub-épicas** | cortan de ella y mergean **a ella**. Nunca a `staging` directamente
>
> **dónde se revisa** | **en los PRs de sub-épica → paraguas**. El PR final a `staging` va a ser
> enorme y nadie lo puede revisar de verdad

y, dos párrafos abajo: *«Es una excepción declarada al flujo de 6 pasos del `CLAUDE.md` del repo…
Queda escrita acá para que el próximo agente que entre no la «corrija».»*

### 2. El dominio

**Dimensión A — los 15 workflows del repo, con su disparador.** Medido sobre
`.github/workflows/` **del worktree de esta spec**, en `d974efde6`, el 2026-09-19.

> **Corregido el mismo día.** Esta tabla decía **13** y estaba medida sobre el clone principal
> (`/home/qazuor/projects/WEBS/hospeda2/`), que está parado en `cd4e59164` y **no tiene
> `whats-new-gate.yml` ni `whats-new-resolve-dates.yml`**. Un árbol de git desactualizado no es
> una fuente para enumerar un dominio: es la misma clase de error que `S-METH-01` acota para las
> mediciones del proveedor. **La conclusión no cambió** —los dos que faltaban tampoco nombran
> `epic`— pero el tamaño del dominio sí.

| # | workflow | disparador | ¿corre en un PR a `epic/**`? |
|---|---|---|---|
| W1 | `ci.yml` | push + `pull_request` a `main`, `staging` | **no** |
| W2 | `e2e-pr.yml` | `pull_request` a `staging`, `main` | **no** |
| W3 | `lighthouse.yml` | `pull_request` a `staging`, `main` | **no** |
| W4 | `a11y-sweep.yml` | `pull_request` a `staging` | **no** |
| W5 | `smoke-gate-sync.yml` | `pull_request` a `staging`, `main` | **no** |
| W6 | `validate-pr-title.yml` | `pull_request` a `staging`, `main` | **no** |
| W7 | `codeql.yml` | push + `pull_request` a `main` | **no** |
| W8 | `codeql-staging.yml` | `schedule` | **no** |
| W9 | `docs.yml` | `pull_request` **sin filtro de rama**, con filtro de paths | **sí, sólo docs** |
| W10 | `validate-docs.yml` | push + `pull_request` a `main`, `develop` | **no** |
| W11 | `e2e-nightly.yml` | `schedule` | **no** |
| W12 | `e2e-local.self-hosted.yml` | `workflow_dispatch` | **no** |
| W13 | `sync-main-to-staging.yml` | push a `main` | **no** |
| W14 | `whats-new-gate.yml` | `pull_request` a `main` + `workflow_dispatch` | **no** |
| W15 | `whats-new-resolve-dates.yml` | push a `main` + `workflow_dispatch` | **no** |

**Ninguno nombra `epic` ni un patrón `**`.** El único que alcanza un PR al paraguas es `W9`, y
sólo si el diff toca `docs/**`, `apps/**/docs/**`, `packages/**/docs/**`, `.markdownlint.json`,
`scripts/check-links.ts` o `scripts/validate-examples.ts`.

**Dimensión B — los 13 guards, con dónde se numeran.**

| # | guard | dónde está numerado |
|---|---|---|
| G1 | nombrar una vertical fuera del Eje 2 | `V/20-testing.md` §2 |
| G2 | una operación sin contexto de vertical | `V/20` §2 |
| G3 | una clave en código que no está en la base, y al revés | `V/20` §2 |
| G4 | una transición que escribe roles | `V/20` §2 |
| G5 | una fuente que se apaga sin pasar por el reconciliador | `V/20` §2 |
| G6 | una autorización que decide sólo por rol | `V/20` §2 |
| G7 | un valor comercial en código | `B/20-testing.md` §2 |
| G8 | `commerce` en fuentes activas | `V/20` §2 |
| G9 | el `reason` como identificador interno | `B/20` §2 |
| G10 | un `init_point` sin sanear | `B/20` §2 |
| G11 | pedirle un trial al proveedor | `B/20` §2 |
| G12 | — | **sólo** en `HOS-1354-…/descomposicion.md`, unidad `B1` |
| G13 | la implementación de arranque en producción | **sólo** en `descomposicion.md`, `B4` |

**Once en el catálogo y trece con los dos de las descomposiciones.** `F-8C1-010` registra una
tercera y una cuarta cuenta vivas (la spec dice siete).

**Dimensión C — las 4 puertas que el programa declara y que hoy están cerradas.**

| # | puerta | estado | fuente |
|---|---|---|---|
| P1 | el gate de entrada de FASE 5 | cerrado; 1B terminado, se puede abrir hoy | `DEC-METH-003` |
| P2 | la elección de pasarela | abierta, paso 4 de 6 | `11-particion` §7 |
| P3 | el KYC de Mobbex | en revisión manual desde 2026-09-18 | `11-particion` §1 |
| P4 | el capítulo 13 (Pagos) | **sin escribir**, el único de los 22 | `11-particion` §4 |

### 3. El tamaño del dominio

| bloque | cuenta |
|---|---|
| 15 workflows × 2 destinos (`epic/**` · `staging`) | 30 |
| 13 guards × 2 destinos | 26 |
| 22 unidades de trabajo: *«¿su PR tiene alguna verificación?»* | 22 |
| las 4 puertas | 4 |
| **total** | **82** |

### 4. Los casos que los hallazgos YA probaron que fallan

| caso | hallazgos |
|---|---|
| los 15 workflows × destino `epic/**` | `F-8C2-003`, medido en el repo |
| el merge periódico `staging` → paraguas, sin verificación | `F-8C2-004` |
| `V1` × `G8`, la primera unidad con un guard que exige FASE 5 | `F-8C2-006` |
| P1 · el gate de FASE 5 sin abrir | `F-8C2-006` |
| P2 · decidir la pasarela reabre la FASE 1C entera | `F-8C2-007` |

**Dieciséis de setenta y ocho.**

### 5. Los casos que NADIE miró todavía

**Sesenta y dos.** Los bloques:

| bloque | casos | por qué importa |
|---|---|---|
| los 13 guards × destino `epic/**` | 13 | corolario no medido de `F-8C2-003`: ninguno corre |
| los 13 guards × destino `staging` | 13 | `G12` y `G13` no están en el catálogo que CI leería |
| las 22 unidades × *«¿su PR verifica algo?»* | 22 | `F-8C2-003` midió el disparador, no cada unidad |
| los 15 workflows × destino `staging` | 15 | es el camino que la decisión **prohíbe** y el único con CI |
| P3 · el KYC de Mobbex | 1 | bloquea la batería de sondas escrita y sin correr |
| P4 · el capítulo 13 | 1 | es la única unidad (`B6`) sin diseño |

### 6. El criterio de verificación

**Para cada uno de los 15 workflows y cada uno de los 13 guards hay que poder decir si corre sobre
un PR de sub-épica al paraguas; para cada una de las 22 unidades, cuál es el conjunto de
verificaciones que su PR dispara; y para cada una de las 4 puertas, qué la abre y quién la abre.**

---

## Las dimensiones que no se pueden enumerar

Siete lugares donde el diseño no alcanza para cerrar un dominio. Cada uno es un hallazgo nuevo
sobre el diseño, no una omisión de este documento.

### 1. El conjunto de operaciones de dominio que pasan por el paso 5 · R3, y alcanza a R1

`V/17-autorizacion.md` §1.3 dice que la resolución de autorización *«es la única que las
ejecuta»*, y §3.2 regla 3 cierra la inferencia: *«A qué clase pertenece una operación se declara,
nunca se infiere.»* **Pero no existe la lista de las operaciones de dominio.** La única lista
enumerada del programa es la de las **doce acciones administrativas** de `NUCLEO/08` §3, que son
la EXCEPCIÓN —capacidades del actor, no del sujeto—, no el conjunto. Sin la lista del conjunto,
el dominio de R3 se puede acotar por vertical y por estado, como se hizo, pero **no se puede
cerrar por operación**: nadie puede afirmar que revisó todas.

### 2. Los estados del vínculo con el proveedor · R4

`B/02-modelo-de-datos.md` §2.2 dice que `provider_link` guarda *«el id del proveedor de una
suscripción, cuál es el proveedor, y la última `version` del recurso que aplicamos»*. **No hay
columna de estado, ni dominio cerrado, ni máquina.** La dimensión C de R4 se enumeró con dos
valores —cancelado y vivo— **derivados** de las mediciones `EX-15` y `EX-20`, no leídos de ningún
documento. Es exactamente lo que el racimo nombra: lo terminal se define sobre el estado local
porque **el vínculo no tiene estados que definir**.

### 3. El período de cobro · R1, y es el `F-8B3-002` entero

El segundo candado del racimo R1 es `UNIQUE(subscription_id, período) WHERE el pago está
acreditado` (`B/05-idempotencia-y-concurrencia.md` §2, `C5`). **La columna `período` no existe**:
`payment` guarda *«suscripción, monto, moneda, estado, id del hecho en el proveedor, fecha del
hecho, monto reembolsado acumulado»* (`B/02` §2.3). Quién define un período de cobro es el
**capítulo 13**, que no está escrito. **Este dominio hoy no se puede cerrar.**

### 4. El pago manual, que no vive en ningún capítulo · R1 y R4

Es la segunda mitad de lo anterior y merece nombre propio. La restricción de `C5` tiene que
comparar una fila de `payment` con una de `manual_payment`, **dos tablas distintas**, y
`manual_payment` guarda *«suscripción, estado, quién lo registró, cuándo, comprobante»* (`B/02`
§2.3) — **sin monto**. `manual payments` arrastra al capítulo 13 y no vive en ningún otro. El
dominio del cruce que mueve dinero real no es enumerable hoy.

### 5. Los efectos de un addon · R2

`NUCLEO/01-glosario.md` §1.6 define el producto de addon como *«capability, precio, recurrencia,
verticales compatibles, duración, **efectos**, tipo de scope (§39)»* — **efectos, en plural**. El
modelo instancia `capability`, **en singular** (`B/02` §2.4), y no guarda ningún valor. Así que
el conjunto de efectos que un addon puede otorgar **no se puede enumerar desde el modelo**: ni
cuántos, ni de qué clase, ni con qué valor. La dimensión A de R2 se cerró en seis fuentes; la
dimensión «qué otorga cada fuente» está cerrada para cinco y abierta para el addon.

### 6. Cuántos lugares cruzan la frontera · R2

`12-contrato-de-cobertura.md` §4 declara la regla de vigilancia: *«si aparece un quinto lugar que
necesita algo de billing **y no es este hecho**, es señal de que el corte se está filtrando. Se
mira, no se resuelve en el lugar.»* **`F-8B3-009` ya cuenta cinco**, en la dirección inversa. La
dimensión «cuántos lugares cruzan» es **abierta por construcción**: el contrato la declara cerrada
en cuatro, deja el detector como una obligación de mirar, y no le asigna dueño ni guard.

### 7. Cuántos guards hay · R6

La dimensión B de R6 se enumeró con trece, y es la cuenta más alta de **cuatro vivas**: el
catálogo de `V/20` §2 más `B/20` §2 dice **once**; las dos descomposiciones agregan `G12` y `G13`
y suman **trece**; la spec dice **siete** (`F-8C1-010`). Una dimensión con cuatro cardinalidades
no es una enumeración: es un conteo pendiente, y la verificación de R6 lo hereda.

**Y un límite que no es una dimensión sino el alcance entero de R5.** La FASE 5 no está hecha, así
que el dominio de R5 se enumeró contra las **ocho filas medidas** y **no** contra el código
legacy. Las 27 tablas del gap no están medidas y `DEC-METH-003` prohíbe clasificarlas antes de
abrir su gate. El dominio de *«qué se migra»* es cerrable para los **datos** y no para el
**código**.

---

## Lo que este documento NO decide

- **No resuelve ningún hallazgo.** Los 141 siguen abiertos, y los 48 críticos también. Acá está
  contra qué se va a verificar cada corrección, no cuál es la corrección.
- **No propone arreglos.** Donde la enumeración deja ver cuál sería, el arreglo se calló a
  propósito: escribirlo acá contamina el dominio con una solución, y el dominio tiene que
  sobrevivir a que la solución cambie.
- **No reabre `DEC-ARCH-004` a `007` ni `DEC-METH-004`.** El dominio se enumeró **dentro** de esas
  decisiones, incluida la partición en dos épicas y la frontera de un solo contrato.
- **No toca el PDR ni el decision log.** Las seis correcciones de registro de la §7 de
  [`14-fase-8-adversarial/00-hallazgos.md`](../14-fase-8-adversarial/00-hallazgos.md) siguen sin
  aplicar, y este documento no las aplica.
- **No prioriza entre racimos ni declara cuál se resuelve primero.** Los tamaños de la tabla de
  arriba miden trabajo de verificación, no urgencia.
- **No asigna dueños.** Que R5 y R6 tengan como hallazgo central *«nadie la ejecuta»* no se
  corrige nombrando a alguien acá.
- **Un dominio grande no significa un racimo grave, y uno chico no significa uno menor.** R2 tiene
  28 casos y cruza las dos épicas; R6 tiene 82 y se arregla, en su mayor parte, en un PR de
  workflows.

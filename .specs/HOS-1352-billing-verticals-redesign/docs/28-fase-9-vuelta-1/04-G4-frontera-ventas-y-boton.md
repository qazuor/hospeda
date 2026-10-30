---
title: "FASE 9 vuelta 1 · G4 — la frontera, las ventas del corte y el botón"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 9
---

# FASE 9 vuelta 1 — G4: la frontera, las ventas del corte y el botón

Resolución de los racimos **R5** (nada congela las ventas durante la ventana del corte), **R8**
(el inventario de lo que cruza la frontera no es el real) y **R10** (la regla del botón
«suscribirse» vive en dos espejos), más los hallazgos sueltos de `C1` que no están en ningún
racimo. Trabajo sobre el diseño vigente del worktree `hospeda-spec-hos-1352-billing-redesign`,
commit `1e67aa9304`. No toqué ningún archivo salvo éste.

**Mis IDs salieron de un script contra el consolidado** (`27-fase-8-vuelta-1/00-hallazgos.md`):
los miembros listados bajo R5, R8 y R10 (texto antes del **Juan.** de cada racimo), más las filas
del §3 con prefijo `F-8V1C1-` que no aparecen en ningún racimo. El script también atrapó
`F-8V1B3-001` (R5) y `F-8V1A2-006` (R10), pero el consolidado los nombra como **vecinos con otra
causa** y viven en su §3 con prefijo que no es `C1`: **no son míos** y no los resuelvo acá. Son
**18**: R5 tiene 3, R8 tiene 7, R10 tiene 2 y los sueltos de `C1` son 6.

**Las citas del informe original siguen en pie.** `verificar-citas.py` sobre `A1`, `A3`, `B3`,
`C1`, `C2` y `D1` da 0 desplazadas y 0 fallas (el último commit es el del consolidado, sin
cambios de diseño después). Igual recorrí cada camino a mano contra el texto vigente: los 18
siguen llegando.

Rutas: `$D/` es `.specs/HOS-1352-billing-verticals-redesign/docs/`, `$V/` es
`.specs/HOS-1353-verticales-capacidades-y-autorizacion/` y `$B/` es
`.specs/HOS-1354-billing-cobro-y-proveedor/`. El código se cita desde la raíz del repo.

---

## 1. Resumen

| hallazgo | racimo | ¿sigue llegando? | salida | capítulos afectados |
|---|---|---|---|---|
| `F-8V1C2-003` | R5 | sí | aplicación + owner (`G4-1`) | `$D/16` §4.2, §4.3 |
| `F-8V1A3-005` | R5 | sí | aplicación (depende de `G4-1`) | `$D/16` §4.2 |
| `F-8V1B3-006` | R5 | sí | aplicación + declarar (medio de pago diferido) | `$D/16` §4.2, §4.3 |
| `F-8V1A3-008` | R8 | sí | owner (`G4-2`) + aplicación (dónde vive vigencia/scope) | contrato §4.1, `$V/02`, `$B/02`, `$B/16` |
| `F-8V1C1-008` | R8 | sí | owner (`G4-2`) + aplicación (`A1` en el censo de `fuentes`) | contrato §2.1, §4.1, `$B/19` |
| `F-8V1C1-009` | R8 | sí | owner (`G4-2`) | contrato §4.1, `$V/03`, `$V/11`, `$B/14` |
| `F-8V1A3-009` | R8 | sí | aplicación | `$V/02` §3.2 |
| `F-8V1C1-004` | R8 | sí | aplicación | contrato §2.8, `$B/02` §2.4, `$V/02` §3.2 |
| `F-8V1A3-014` | R8 | sí | aplicación | contrato §4.2, `$B/descomposicion` §2.6 |
| `F-8V1C1-015` | R8 | sí | aplicación | contrato §4.1, `$V/02`, las dos descomposiciones |
| `F-8V1A1-008` | R10 | sí | aplicación | `$V/19` §4 fila 21 |
| `F-8V1D1-004` | R10 | sí | aplicación | `$V/19` §4 fila 23, `$B/19` §4 fila 21, §7 |
| `F-8V1C1-002` | suelto | sí | aplicación | `$B/10` §3.5, `$V/15` §2.2, `$V/descomposicion` |
| `F-8V1C1-003` | suelto | sí | aplicación + owner (`G4-3`) | `$V/02` §3.2, contrato §3 |
| `F-8V1C1-005` | suelto | sí | aplicación | `$B/descomposicion` §3 y criterio de `B4` |
| `F-8V1C1-007` | suelto | sí | aplicación | contrato §2.6 |
| `F-8V1C1-011` | suelto | sí | aplicación | contrato §6.3, las dos descomposiciones, `$B/20` |
| `F-8V1C1-014` | suelto | sí | aplicación | `$B/descomposicion` §2.5 y fila de `B10` |

**Conteo** (18): siguen llegando **18**, no siguen **0**. Por salida principal: **aplicación
pura 12**, **con pregunta al owner 6** (`F-8V1C2-003`, `F-8V1A3-005` por dependencia,
`F-8V1A3-008`, `F-8V1C1-008`, `F-8V1C1-009`, `F-8V1C1-003`), y **1 declaración** de residuo
(`F-8V1B3-006`, además de su aplicación). Las preguntas son tres: `G4-1`, `G4-2` y `G4-3`.

---

## 2. Los racimos

### 2.1 R5 · Nada congela las ventas durante la ventana del corte

**Causa.** El §4.2 del corte razona la ventana sólo como *cobros en vuelo de lo que ya estaba en
el censo*. Ningún paso cierra las **altas**, ni en el sistema viejo (que sigue corriendo entre el
paso 1 y el paso 3) ni en el nuevo (que atiende tráfico desde el paso 3, antes de que la rama de
aborto pueda restaurar el backup encima). Todo lo que se vende en esa ventana deja un preapproval
o un pago vivo que ninguna base conoce.

**Verificación sobre el texto vigente.**

- `$D/16-fase-7-del-paraguas.md:120`: «cierra los links públicos que siguen vendiendo»
- `apps/api/src/services/billing/paid-subscription-create.ts:142`: «HOS-1221 stopped sending the plan (MercadoPago rejects that request), so»
- `$D/16-fase-7-del-paraguas.md:147`: «registra el viejo~~ las suscripciones del censo canceladas. Si entra un cobro en vuelo de una que»
- `apps/api/src/services/addon.service.ts:93`: «code, then creates a Preference with a 30-minute expiration window.»
- `$D/16-fase-7-del-paraguas.md:138`: «contrata en esa ventana espera hasta el barrido diario.»
- `$D/16-fase-7-del-paraguas.md:190`: «la cancelación, un recorrido que el control del paso 2 no da por completo, o el paso 3— (FASE 9»
- `$D/16-fase-7-del-paraguas.md:217`: «una ubicación declarada: está entre el paso 2 y el paso 3.»

El 1a cierra los links de `preapproval_plan`, pero el checkout viejo ya no usa planes; la ventana
declarada habla de cobros *del censo*; el aviso de un pago de `Preference` puede llegar cuando el
viejo ya no escucha; y el propio documento admite que en el rollout del paso 3 alguien contrata.
Los tres caminos llegan.

**No choca con `DEC-MIG-002`, pero hay que decirlo.** Su alcance es *«durante el rediseño»*:

- `$D/01-decision-log.md:2321`: «Las altas nuevas siguen tomándose en el sistema actual durante el rediseño»

Cerrar las altas durante los minutos del corte **no** es congelar altas durante el programa (la
opción 2 que `$B/21` §3.3 descartó), sino el borde final de esa misma decisión. Como igual
suspende la venta por un rato, lo llevo al owner como `G4-1` en vez de darlo por aplicación.

**Dominio declarado** (DEC-METH-004): **todo canal por el que alguien puede crear, entre el censo
del 1b y el fin del corte, un objeto en el proveedor que mueva plata**. La lista es cerrada porque
sale del criterio, no de una enumeración de rutas: *crea o re-autoriza un preapproval, o crea una
`Preference` o un pago*.

| # | sistema | canal | hoy | con la propuesta |
|---|---|---|---|---|
| 1 | viejo | links públicos de `preapproval_plan` | cerrado en 1a | igual |
| 2 | viejo | checkout de suscripción (preapproval sin plan, HOS-1221; reintento de checkout) | **abierto** | cerrado en 0b |
| 3 | viejo | cambio de plan (nuevo preapproval) | **abierto** | cerrado en 0b |
| 4 | viejo | cambio de medio de pago / vinculación que re-autoriza un preapproval | **abierto** | cerrado en 0b |
| 5 | viejo | addon de única vez (`Preference`, 30 minutos) | **abierto** | cerrado en 0b + 30 min de espera antes del 1a |
| 6 | viejo | addon recurrente (preapproval propio) | **abierto** después del 1b | cerrado en 0b |
| 7 | viejo | un `pending` creado antes del cierre y autorizado después | cancelado en 1b (`DB-2`) | igual |
| 8 | viejo | sondas | manifiesto del 1b (`DB-1`) | igual |
| 9 | nuevo | alta (`S1`), incluido el pagador manual | **abierto** desde el paso 3 | cerrado hasta el paso 5 |
| 10 | nuevo | sucesión / cambio de plan (`S1` sucesión) | sin población (nadie tiene suscripción) | cerrado igual por el mismo bloqueo |
| 11 | nuevo | addon (`A1`) | sin población (`A1` exige principal cobrada) | cerrado igual |
| 12 | nuevo | actos del admin que no tocan al proveedor (grants del 3b, cortesías) | no mueven plata | fuera del dominio, se declara |
| 13 | los dos | un pago de `Preference` con un medio que acredita días después | **sin cubrir** | declarado con causa (abajo) |

**Recorrido del dominio contra la propuesta.** 2 a 6: el paso 0b los cierra antes de tomar el
censo, así que el censo del 1b ve todo preapproval que el viejo haya creado. 5: una `Preference`
creada antes del 0b vence o se paga en 30 minutos, y como el 1a espera ese plazo, el pago entra
**con el viejo todavía escuchando** (el webhook viejo se apaga recién en el paso 3, `DB-5`): el
viejo lo anota, y lo anotado se pierde con `2a`. Eso ya no es un pago que *ninguna base conoce*,
sino lo que `F-8V1C2-002` pregunta (lo pagado en el viejo que el corte corta), que es de otro
grupo; acá lo dejo apuntado. 7 y 8 ya estaban. 9 a 11: el sistema nuevo arranca con las altas
cerradas y las abre en un paso nuevo, el 5, después de verificar el 4; como la rama de aborto sólo
cubre hasta el fin del paso 3 (que la propuesta define), **cuando se restaura el backup no existe
ningún objeto del proveedor creado por el sistema nuevo**. 12 no mueve plata. 13 es el residuo:
no lo medí (tampoco `B3`), la población es la de una ventana de minutos y el desenlace cae en
`F-8V1B3-001` (el desconocido sin fila), que es de otro grupo. Se declara.

**Por qué el mecanismo es el borde y no una bandera nueva.** El viejo no tiene un interruptor de
checkout (no hay variable en `apps/api/src/utils/env.ts` ni en `packages/config`), y agregarle
código a un sistema condenado es lo que `$D/12` §5.3 rechaza. En el nuevo sí existe un dato que
cierra altas, `admite_altas`, pero **dice otra cosa**: bloquea `T1`, y la pricing mostraría *«esta
vertical ya no admite altas»* durante el corte. El borde (una regla en Cloudflare, que ya está
delante de todo) cierra por ruta, no toca ningún modelo y se verifica igual que el apagado del
webhook: con una petición que vuelve rechazada.

**Propuesta de texto.**

`$D/16-fase-7-del-paraguas.md` §4.2, tabla del orden. **Agregar** dos filas:

> | 0b | **cerrar las altas del sistema viejo**: una regla en el borde rechaza toda ruta del viejo
> que cree o re-autorice un preapproval, o cree una `Preference` o un pago en el proveedor
> —checkout de suscripción y su reintento, cambio de plan, cambio de medio de pago, compra de
> addon—, verificada con una petición a cada una que vuelve rechazada. **El 1a no arranca antes de
> 30 minutos después de verificado el 0b** | quien opera el corte | el censo del 1b sólo cuenta lo
> que existe al tomarlo; lo que el viejo venda después no lo ve ningún paso (FASE 9 vuelta 1,
> `F-8V1C2-003`, `F-8V1B3-006`). Los 30 minutos son la vida de la `Preference` de addons del
> viejo: así todo pago de una preferencia abierta entra con el webhook viejo todavía encendido |
>
> | 5 | **abrir las altas del sistema nuevo**: se levanta la regla del borde que las tuvo cerradas
> desde el despliegue | quien opera el corte | es el fin del corte. Hasta acá el sistema nuevo no
> crea nada en el proveedor, así que la rama de aborto nunca restaura un backup encima de un
> preapproval vivo (`F-8V1A3-005`) |

Y en la fila 3 (*desplegar*), **agregar** a la columna *por qué*:

> **despliega con sus rutas de alta cerradas en el borde** (checkout de suscripción, cambio de
> plan, compra de addon), la misma regla del 0b sobre las rutas nuevas. **El paso 3 termina cuando
> el despliegue está sano y el 3b verificado**: la rama de aborto cubre hasta ahí.

`$D/16` §4.2, párrafo *«La ventana entre el paso 1 y el paso 3…»*. **Agregar** al final:

> **Y en esa ventana no hay altas**: el 0b las cerró antes del censo, y el sistema nuevo las abre
> recién en el paso 5. Esto no suspende `DEC-MIG-002` —su alcance es el rediseño, y el corte es
> su final—, pero por esos minutos nadie puede suscribirse, y se avisa en el mismo aviso previo
> al paso 1 (owner, FASE 9 vuelta 1, `G4-1`).

`$D/16` §4.2, rama de aborto, punto 2. **Tachar** *«si el paso 3 alcanzó a escribir algo»* y
**escribir**:

> si el paso 3 —que termina con el despliegue sano y el 3b verificado— alcanzó a escribir algo
> —la migración estructural, `inactiva_desde`, los dos grants—, se restaura el backup del paso 2b.
> **Lo que el backup no puede pisar es un objeto del proveedor, y no hay ninguno**: las altas del
> sistema nuevo siguen cerradas hasta el paso 5.

`$D/16` §4.3 (*Lo que este orden NO resuelve*). **Agregar** una entrada declarada por
`DEC-METH-015`:

> **Un pago de una `Preference` del viejo con un medio que acredita días después** (efectivo,
> ticket) puede llegar cuando el viejo ya no existe. **Causa**: el 0b y los 30 minutos acotan las
> preferencias, no la acreditación diferida, que no se midió. La población es la de las
> preferencias abiertas en los minutos previos al 0b; el pago llega como desconocido y cae donde
> cae todo desconocido sin fila (`F-8V1B3-001`). No se abre mecanismo propio.

**Cómo deja de llegar cada miembro.**

- `F-8V1C2-003`: el paso 3 de su camino (*Juan se suscribe en el sitio viejo a las 10:30*) choca
  con la regla del 0b, verificada antes del 1a de las 10:00.
- `F-8V1A3-005`: el paso 1 de su camino (*el sistema nuevo atiende y Juan contrata*) choca con la
  fila 3 enmendada; y *«cuándo termina el paso 3»* queda escrito.
- `F-8V1B3-006`: la compra de las 13:49 no se puede iniciar después del 0b, y una iniciada antes
  se paga con el webhook viejo encendido. El residuo de acreditación diferida queda declarado.

### 2.2 R8 · El inventario de lo que cruza la frontera no es el real

**Causa.** El contrato declara la frontera como **dos listas** (lo que billing empuja y tres
consultas de vuelta) y una regla que dice que **todo lo que no está en ellas es filtración**. Pero
las listas se escribieron mirando la cobertura, y el resto del diseño tiene lecturas y una
escritura legítimas que nadie cargó: unas son de dominio (`A1`, el addon, la extensión del trial),
otras son de pantalla (pricing, Mi Suscripción, el botón), y otras son de verticales hacia billing
por la lista de invalidación del caché. Encima, la regla cuenta *«siete campos»*, que no incluyen
el veredicto y sí incluyen uno sin lector.

**Verificación sobre el texto vigente.**

- `$D/12-contrato-de-cobertura.md:946`: «> **El contrato tiene dos direcciones. La inversa transporta política y estado de catálogo, nunca**»
- `$D/12-contrato-de-cobertura.md:1018`: «> **Y en la otra dirección**: si billing necesita leer de verticales algo que no está entre **los»
- `$D/12-contrato-de-cobertura.md:984`: «**Son siete campos en tres preguntas, y los dos últimos son los que importa declarar.**»
- `$D/12-contrato-de-cobertura.md:941`: «políticaDePlan(versiónDePlan)  → { díasDeGrace, díasDeTrial, permitePausa, vigente, vendible }»
- `$B/descomposicion.md:339`: «ningún capítulo de esta épica los lee**: `díasDeTrial` lo consume la máquina de trial, que es de»
- `$B/docs/19-superficies.md:45`: «su estado, y el conjunto efectivo de entitlements y limits»
- `$V/docs/03-maquinas-de-estado.md:54`: «| T4 | `TRIAL_ACTIVE` | promo de extensión o cortesía | `TRIAL_ACTIVE` | sólo durante `TRIAL_ACTIVE` (§32) |»
- `$B/docs/14-promos-cortesias-y-grants.md:340`: «**El canje vale si y sólo si la fila del trial sigue en `TRIAL_ACTIVE` en el instante de»
- `$V/docs/02-modelo-de-datos.md:494`: «| toda transición de la máquina de suscripción | `ACTIVE`, `SUSPENDED` y `PAUSED` otorgan cosas distintas |»
- `$B/docs/02-modelo-de-datos.md:735`: «- **Cada ancla apunta a un `plan_id`, y NO a una versión.** El grant resuelve **la versión vigente de»

Todo llega. **Una aclaración que cambia la salida de una pregunta del consolidado**: la segunda
pregunta de R8 (*¿quién resuelve la versión vigente del grant?*) **ya la contesta el contrato**, y
por eso la trato como aplicación y no como decisión:

- `$D/12-contrato-de-cobertura.md:127`: «resuelve la versión vigente de `referencia` y nunca otorga menos que la de `piso`»

La resuelve el paso 6 (verticales), a partir de una versión del plan anclado, con tablas propias
(`plan_version.plan_id` y su vigente). Billing no necesita leer `plan_version`: le alcanza con
poner en `referencia` una versión de ese plan, y la única que guarda es el piso, que por la FK
compuesta de `$B/02` §2.4 **es una versión del mismo plan**. Lo que falta es escribirlo, y
corregir la frase de `$B/02` que dice *«el grant resuelve»*.

**Dominio declarado**: **toda lectura o escritura entre las dos épicas que algún capítulo
declara**, en las dos direcciones. La recorrí en los capítulos de los informes (`B/02`, `B/03`,
`B/10`, `B/14`, `B/16`, `B/19`, `V/02`, `V/03`, `V/11`, `V/15`, `V/19`) y en el contrato. El hecho
*«la ficha llegó a `PURGED`»* (verticales → billing) es de este dominio pero es **R2**, de otro
grupo: lo nombro y no lo toco.

| # | dirección | qué cruza | quién lo necesita | ¿declarado hoy? | salida |
|---|---|---|---|---|---|
| 1 | B → V | `cubierto`, `fuentes`, `cobrada`, `piso` y el aviso | verticales | sí (§2, §3) | — |
| 2 | V → B | `díasDeGrace`, `permitePausa`, `vigente`, `vendible`, `admiteAltas`, `finDeServicio` | `B7`, `B8`, `B3`, `B4`, `B12` | sí (§4.1) | — |
| 3 | V → B | `díasDeTrial` | nadie en billing | sí, **sin lector** | aplicación: se saca |
| 4 | V → B | veredicto `direcciónDeCambio` | `B8` | sí, pero **la regla no lo cuenta** | aplicación: la regla cita las preguntas |
| 5 | V → B | `fuentes` de clase `TÍTULO` que no son trial, en la vertical del objetivo | `A1` | es el contrato, pero `A1` **no está en el censo de `fuentes`** | aplicación |
| 6 | V → B | vertical (y dueño) de la ficha objetivo de un addon | `A1` | **no** | `G4-2` |
| 7 | V → B | vigencia, tipo de scope y `addon` madre de una `addon_version` | `A1`, instancia, `addon_product` | **no** | `G4-2` + aplicación (dónde viven) |
| 8 | V → B | versiones vigentes y vendibles de los planes de una vertical, con su presentación | pricing (`B13`) | **no** | `G4-2` |
| 9 | V → B | conjunto efectivo de entitlements y limits | Mi Suscripción (`B13`) | **no**, y el §4.1 dice *nunca capacidades* | `G4-2` |
| 10 | V → B | *¿publicar le arrancaría el trial?* | el botón (`B13`) | **no** | `G4-2` (ver R10) |
| 11 | B → V | *extendé N días este trial* (escritura) | `T4`, canje en `B9` | **no** | `G4-2` |
| 12 | B → V | versión vigente del plan de un grant | paso 6 | sí (contrato §2.1 fila `piso`), mal dicho en `$B/02` | aplicación |
| 13 | B → V | quién está anclado a un plan (para invalidar) | caché de verticales | **no** | aplicación: invalidar sin saberlo |
| 14 | B → V | cambio de ciclo, toda transición de suscripción (para invalidar) | caché de verticales | **no** | aplicación: el transporte es el aviso |
| 15 | V → B | la ficha llegó a `PURGED` | `A6` | **no** | R2, otro grupo |

**Recorrido del dominio contra la propuesta.** 1 y 2 quedan como están. 3 y 4 se cierran con la
regla corregida y el campo retirado (texto abajo). 5 es una línea en el censo. 12 es texto. 13 y
14 se cierran sin transportar nada nuevo: la fila de los grants anclados pasa a invalidar el caché
entero en la publicación de una versión (acto raro, de verticales, que no necesita saber quién
está anclado), y las filas de suscripción pasan a tener por transporte el aviso, que billing ya
emite cuando la respuesta cambia; un cambio de ciclo que no cambia la versión anclada no cambia
nada que el caché guarde. 6 a 11 dependen de `G4-2`: con la recomendación, 6, 7 y 11 son
consultas u operaciones del §4.1 (son de dominio: deciden si se vende y cuándo termina algo), y 8,
9 y 10 son lecturas de una capa de composición (pantallas que no deciden). 15 queda en R2.

**Propuesta de texto — aplicación sin decisión.**

`$D/12-contrato-de-cobertura.md` §4.2, segunda mitad de la regla. **Tachar** *«algo que no está
entre los siete campos del §4.1»* y **escribir**:

> algo que no contesta **ninguna de las preguntas del §4.1** —las consultas y sus campos, y el
> veredicto de `direcciónDeCambio`—, vale lo mismo.

Y en el párrafo siguiente (*«La mitad de vuelta sí lleva número…»*), **tachar** la frase que
defiende el número y **escribir**:

> La mitad de vuelta tampoco lleva número: cita **las preguntas del §4.1**, que se escriben enteras
> en un solo lugar. Contaba *«siete campos»* y el veredicto no era ninguno de ellos, así que leída
> literal señalaba como filtración la única lectura que el §4.1 construyó para evitar una (FASE 9
> vuelta 1, `F-8V1A3-014`). Y *«siete campos»* ya nombraba otra cosa: los de la fuente (§2, 9h).

`$D/12` §4.1, bloque de firmas. **Tachar** `díasDeTrial` de `políticaDePlan`, y en el párrafo
*«Son siete campos en tres preguntas…»* **escribir** *«Son seis campos y un veredicto en tres
preguntas»*, con esta nota:

> `díasDeTrial` salió el 2026-09-26 (FASE 9 vuelta 1, `F-8V1C1-015`): ningún capítulo de billing
> lo lee, y su único consumidor —la máquina de trial— lo lee de su propia tabla, del lado de
> verticales. Un campo declarado sin lector es un campo que alguien construye para nadie.

La misma cifra se corrige en los demás lugares que cuentan los campos del §4.1 (medido con
`rg -n 'siete campos|siete\*\* campos|otros cinco campos'`): `$D/12` §2.6 (el renglón de
*«uno de los siete campos»*) y §4.1 (*«los siete campos son columnas»*, *«Son siete campos en tres
preguntas»* citado en §4.2); `$V/02` §2.1 (*«dos de los siete campos de la dirección inversa»*);
`$V/descomposicion.md` §2.9 (*«Los siete campos son de `02` §2.1»*, y la tabla sin `díasDeTrial`)
y el criterio de `V2` (*«los otros cinco campos»* → *«los otros cuatro»*); `$B/descomposicion.md`
§2.6 (*«siete campos en tres preguntas»*, *«los siete campos siguen siendo siete»*, *«Se
recorrieron los siete campos»*, y la regla de vigilancia citada al final, que pasa a *«las
preguntas del §4.1»*).

`$D/12` §2.1, fila `fuentes`, columna *quién lo necesita*. **Agregar**:

> **y `A1` de billing** (`B/03` §8), que lee si en la vertical del objetivo hay un título que no
> sea de `tipo: TRIAL` antes de vender un addon (FASE 9 vuelta 1, `F-8V1C1-008`)

`$D/12` §2.8, después de *«El trinquete lo aplica verticales; el dato lo guarda billing y cruza
por la firma.»* **Agregar**:

> **Y la vigente la resuelve verticales, no billing.** En una fuente `GRANT`, billing pone en
> `referencia` una versión del plan anclado —la del piso, que es la única que guarda y que la FK
> compuesta de `B/02` §2.4 ata a ese plan—, y el paso 6 resuelve de ella la versión vigente del
> mismo plan con sus propias tablas. Billing nunca lee `plan_version` (FASE 9 vuelta 1,
> `F-8V1C1-004`).

`$B/docs/02-modelo-de-datos.md` §2.4, viñeta *«Cada ancla apunta a un `plan_id`…»*. **Tachar**
*«El grant resuelve la versión vigente de ese plan»* y **escribir**:

> La versión vigente de ese plan **la resuelve el paso 6 de verticales**, a partir de la versión
> que la fuente trae en `referencia` —la del piso— (`12-contrato…` §2.8)

`$V/docs/02-modelo-de-datos.md` §3.2, tabla de invalidación:

- fila *«cambio de plan o de ciclo»* y fila *«toda transición de la máquina de suscripción»*:
  **fundirlas** en una fila *«llega el aviso de cobertura (`12-contrato…` §3)»*, con la razón:
  *«es el único transporte de un cambio de billing: billing lo emite cuando la respuesta cambia
  —cambio de plan, transiciones que emiten o dejan de emitir—; un cambio de ciclo que no cambia la
  versión anclada no cambia nada de lo que se cachea»*.
- fila *«se publica una versión nueva de un plan al que hay GRANTS anclados»*: **tachar** la fila
  y **escribir** *«se publica una versión nueva de cualquier plan → se invalida el caché entero»*,
  con la razón: *«quién está anclado a un plan lo sabe billing y no cruza; publicar una versión es
  un acto raro de verticales, y borrar todo es la dirección segura de la regla 2. Es la misma forma
  de la fila del fin de servicio»*.

(La fila *«…plan al que hay suscripciones ancladas»* es de `F-8V1A3-015`, de otro grupo; con la
fila nueva queda absorbida, y conviene que ese grupo lo sepa.)

`$V/docs/02-modelo-de-datos.md` §2.1 (la tabla del corte por campo) y `$B/docs/16-addons.md` §1.2
y `$B/docs/02-modelo-de-datos.md` §2.4 (restricción de `addon_instance`): **una sola respuesta a
dónde viven la vigencia y el tipo de scope**, y el diseño ya la tiene —`V/02` los pone en
`addon_version` por el corte por campo—. **Tachar** *«El producto declara los dos»* en `$B/16`
§1.2 y **escribir** *«El cobro lo declara el producto (`addon_product`, billing); la vigencia, la
versión (`addon_version`, verticales)»*; y en `$B/02` **tachar** *«el tipo de scope del producto»*
y **escribir** *«el tipo de scope de la versión anclada»*. Cómo llega billing a esos dos valores es
`G4-2`.

**Propuesta de texto — si el owner elige la recomendación de `G4-2`.**

`$D/12` §4.1, bloque de firmas. **Agregar**:

```text
ficha(idDeFicha)                → { vertical, dueño }
políticaDeAddon(versiónDeAddon) → { addon, vigencia, díasDeVigencia, tipoDeScope }
extenderTrial(user, vertical, días, claveDeCanje) → ACEPTADA | RECHAZADA(motivo)
```

Con este párrafo:

> **Las dos primeras son estado de catálogo y política, como las de arriba**: de una ficha, billing
> sabe a qué vertical pertenece y de quién es —lo que `A1` necesita para validar el objetivo, y la
> precisión 6 del cap. 17 manda leer del recurso—; de un addon, cómo se comporta —cuándo termina
> la instancia, sobre qué se puede aplicar y de qué `addon` es versión—, nunca qué otorga.
> **La tercera es la única escritura de billing en verticales**: el canje de una extensión de trial
> le pide a verticales que corra `T4`, y verticales contesta con el techo ya aplicado (`V/11` §3) y
> dentro del lock de la máquina de trial, así que `T3` y el canje no se pisan. Billing asienta el
> canje sólo con `ACEPTADA`; la clave de canje hace idempotente el reintento. Las construyen `V2`
> (las dos consultas) y `V4` (la operación); las consumen `B10` y `B9`.
>
> **Las superficies no pasan por acá.** La pricing, Mi Suscripción y el botón de suscribirse son una
> **capa de composición**: muestran lo que cada épica resolvió leyendo sus consultas públicas —el
> catálogo vendible y su presentación, el conjunto efectivo del paso 6, el predicado del botón—, y
> no deciden nada (`V/19` §1). Por eso pueden leer capacidades sin que eso sea una filtración: la
> regla de vigilancia vigila a las **máquinas, guards y barridos** de billing, que son los que
> deciden.

Y la fila correspondiente en los §2 de los dos capítulos 19 (*qué lee cada superficie*):

> estas lecturas son de la capa de composición (`12-contrato…` §4.1): una superficie puede leer de
> las dos épicas porque no decide; si alguna vez decide algo, deja de ser superficie y su lectura
> entra al §4.1.

**Cómo deja de llegar cada miembro.**

- `F-8V1A3-014`: la regla cita las preguntas, no los campos; el veredicto está adentro.
- `F-8V1C1-015`: `díasDeTrial` sale de la firma y de las cuentas.
- `F-8V1C1-004`: la vigente la resuelve el paso 6 desde el piso; la invalidación de grants no
  necesita saber quién está anclado.
- `F-8V1A3-009`: las filas de invalidación tienen transporte (el aviso) o no necesitan datos de
  billing (caché entero en la publicación).
- `F-8V1A3-008`, `F-8V1C1-008`, `F-8V1C1-009`: quedan cerrados con `G4-2`. Mientras el owner no
  conteste, lo que sí es aplicación (dónde viven vigencia y scope, `A1` en el censo) se escribe
  igual.

### 2.3 R10 · La regla del botón «suscribirse» vive en dos espejos

**Causa.** La decisión 6c se escribió dos veces, una en cada capítulo 19, y cada espejo enumeró
**sus** causas: `V/19` nombra *«o no puede arrancar uno»*, `B/19` no; la fila 21 de `V/19` nombra
*«la vertical no admite altas»* como causa de *«suscribite para publicar»* cuando ahí billing no
vende. Ninguno dice la regla de la que salen los casos.

**Verificación sobre el texto vigente.**

- `$B/docs/19-superficies.md:137`: «**El checkout de billing queda para quien ya publicó o ya consumió su trial** en esa vertical»
- `$V/docs/19-superficies.md:69`: «El checkout queda para quien ya publicó o ya consumió su trial —el que no puede arrancar uno»
- `$V/docs/19-superficies.md:67`: «ya consumió su trial, la vertical no admite altas, o el hash de su correo ya tiene fila»
- `$B/docs/19-superficies.md:136`: «que **no se ofrece**: *«esta vertical ya no admite altas»*, con la fecha de fin de servicio si la tiene»
- `$V/docs/03-maquinas-de-estado.md:371`: «con los días en cero sólo se puede publicar teniendo un título»

Los dos caminos llegan.

**La regla que ya está en el diseño.** Lo que decide a dónde lleva el botón es **si publicar le
arrancaría el trial**, y eso no hay que inventarlo: es la condición de `T1` y la lectura que ya
hace `PB1`.

- `$V/docs/03-maquinas-de-estado.md:51`: «la vertical declara evento **y** su plan de trial tiene días de trial > 0 **y** `cubierto` es **falso**»
- `$V/docs/03-maquinas-de-estado.md:506`: «**o si esta publicación dispara `T1`**, o sea si arranca un trial: la persona está en `PRE_TRIAL` y se cumplen las condiciones de `T1` (§2)»

Y *«ya publicó»* también tiene definición: es el mismo registro que leen `T7` y `T8`.

- `$V/docs/03-maquinas-de-estado.md:58`: «la persona **ya ejerció el evento de activación** en esa vertical —el mismo hecho y el mismo registro que lee `T7`—»

Hay que conservar *«ya publicó → checkout»* aunque `T1` no mire ese registro, porque es lo que
dice 6c: quien ya ejerció el evento y quedó en `PRE_TRIAL` (su suscripción sin cobro murió) va al
checkout y `T8` le consume el trial al primer pago.

**Dominio declarado**: **toda combinación de estado por la que el botón se muestra, se oculta o
redirige**, para `user + vertical`. Las variables: `cubierto`; si la vertical admite altas; si
declara evento; días de trial del plan de trial; estado del trial (`PRE_TRIAL`, `TRIAL_ACTIVE`,
consumido); si ya ejerció el evento; si el hash del correo tiene fila.

| # | caso | hoy `V/19` | hoy `B/19` | con la regla única |
|---|---|---|---|---|
| 1 | `cubierto` verdadero (cualquier título, incluido `TRIAL_ACTIVE`) | no aplica | no aplica | no hay botón de suscribirse: es la situación *activo* del §47 (plan actual y cambio) |
| 2 | vertical sin altas | a publicar o checkout, según haya publicado | ídem | ninguno: *«esta vertical ya no admite altas»* (`B/19` fila 20) |
| 3 | `PRE_TRIAL`, nunca ejerció el evento, evento declarado, días > 0, hash libre | a publicar | a publicar | **a publicar** |
| 4 | ídem pero días = 0 | checkout (*no puede arrancar uno*) | **a publicar** (lazo) | checkout |
| 5 | ídem pero la vertical no declara evento | checkout | **a publicar** (lazo) | checkout |
| 6 | ídem pero el hash tiene fila | checkout | **a publicar** (lazo) | checkout |
| 7 | `PRE_TRIAL` y ya ejerció el evento | checkout | checkout | checkout (`T8`) |
| 8 | trial consumido (`TRIAL_EXPIRED`, `TRIAL_CONVERTED`) | checkout | checkout | checkout |
| 9 | cartera vieja: publicó sólo en el sistema viejo | sin definir | sin definir | depende de R1 (abajo) |

Recorrido: 1 queda fuera de la regla por definición (con título no hay botón de suscribirse). 2
sale del botón y va a la fila 20. 3 es 6c. 4, 5 y 6 son el lazo de `F-8V1D1-004` y se cierran
porque publicar no les arrancaría el trial. 7 y 8 no cambian. **9 no lo cierro**: qué es *«ya
ejerció el evento»* para quien publicó en el viejo es la pregunta de R1 (qué registro hereda o no
la cartera), de otro grupo; la regla única la absorbe sin cambiar, porque lee *el mismo registro
que `T7` y `T8`*, sea cual sea la respuesta.

**Propuesta de texto.**

`$V/docs/19-superficies.md` §4, fila 23, columna *qué tiene que decir*. **Tachar** desde *«no la
manda al checkout»* hasta *«no al publicar»* y **escribir**:

> **La regla del botón está escrita sólo acá, y `B/19` §4 fila 21 la cita.** Con `cubierto` falso
> en esa vertical —con un título el botón es el de *plan actual y cambio* del §47—:
>
> 1. **si la vertical no admite altas**, no ofrece ni suscripción ni publicación: dice *«esta
>    vertical ya no admite altas»*, con la fecha de fin de servicio si la tiene (`B/19` fila 20);
> 2. **si publicar le arrancaría el trial** —está en `PRE_TRIAL`, **todavía no ejerció el evento de
>    activación** (el registro que leen `T7` y `T8`) y se cumplen las demás condiciones de `T1`: la
>    vertical declara evento, su plan de trial tiene días > 0 y el hash de su correo no tiene fila—,
>    **la manda a publicar** y le dice que el trial arranca al publicar;
> 3. **en todo otro caso, la manda al checkout**: ya ejerció el evento, ya consumió su trial, la
>    vertical no declara evento, los días están en cero o el hash ya tiene fila. Publicar no le
>    daría un trial, y mandarla a publicar la devuelve al botón por la fila 21.
>
> Quien llega al checkout por otro camino tiene la red de `T8`. El predicado del punto 2 lo expone
> verticales y la pricing lo pregunta al mismo lugar que `PB1` (§1: *la UI y el backend preguntan
> lo mismo*); cómo lo lee billing es de `12-contrato…` §4.1.

`$V/19` §4, fila 21. **Tachar** *«(ya consumió su trial, la vertical no admite altas, o el hash de
su correo ya tiene fila)»* y **escribir**:

> (ya consumió su trial, la vertical no declara evento o tiene los días en cero, o el hash de su
> correo ya tiene fila). **Si la causa es que la vertical no admite altas, esta fila no aplica**:
> la pantalla dice lo de `B/19` fila 20 —*«esta vertical ya no admite altas»*—, porque ahí tampoco
> hay suscripción que ofrecer (FASE 9 vuelta 1, `F-8V1A1-008`)

`$B/docs/19-superficies.md` §4, fila 21, columna *qué tiene que decir*. **Tachar** el texto y
**escribir**:

> **a dónde lleva el botón lo decide la regla de `V/19` §4 fila 23, escrita sólo allá**: este
> capítulo construye el botón y no repite sus casos. Los tres desenlaces son publicar, el checkout,
> o ninguno con la fila 20. Quien llega al checkout por otro camino entra igual —`S1` no lo
> frena— y lo cubre `T8` (FASE 9 vuelta 1, `F-8V1D1-004`: este espejo enumeraba dos causas y el de
> verticales tres, y en una vertical con los días en cero el lazo era cerrado)

`$B/19` §7, punto 1, segunda oración. **Tachar** *«el botón de suscribirse de quien todavía no
publicó en esa vertical lo manda a publicar, no al checkout»* y **escribir** *«el botón de
suscribirse sigue la regla de `V/19` §4 fila 23»*.

**Cómo deja de llegar cada miembro.**

- `F-8V1A1-008`: en la vertical sin altas la fila 21 ya no dice *«suscribite»*: dice la fila 20.
- `F-8V1D1-004`: con los días en cero el botón manda al checkout (caso 4), no a publicar.

---

## 3. Hallazgos sueltos

### 3.1 `F-8V1C1-002` · `direcciónDeCambio` no sabe qué es «bajar» en una clave donde menos es mejor

- `$B/docs/10-verticales-planes-billing-options.md:104`: «el camino de downgrade (`DEC-SUB-008`): el monto se muta ya, las capacidades bajan al fin del»
- `$V/docs/15-entitlements-y-limits.md:62`: «| | `MÍNIMO` | gana el número más bajo | un compromiso de tiempo de respuesta |»
- `$V/docs/15-entitlements-y-limits.md:69`: «**Las tres de «no acumula» son la misma regla dicha tres veces: gana la fuente más favorable.**»

Sigue llegando: el criterio de `$B/10` §3.5 dice *«si algo baja, un limit…»* sin decir en qué
sentido, y el criterio de `V2` sólo prueba *rank mayor con un limit menor*. **Aplicación**: la
favorabilidad ya está definida por clave en `V/15` §2.2.

`$B/docs/10-verticales-planes-billing-options.md` §3.5, primera viñeta. **Después de** *«si algo
baja»* **agregar**:

> —*baja* es **empeora según la estrategia de la clave** (`V/15` §2.2), no *el número es menor*: en
> `SUMA` y `MÁXIMO`, un número menor; en `MÍNIMO`, uno **mayor**; en `MEJOR_DECLARADO`, un valor
> peor en el orden que la clave declara; y una clave presente en el origen y ausente en el destino
> baja. Una clave que aparece sólo en el destino no baja (FASE 9 vuelta 1, `F-8V1C1-002`)—

`$V/docs/15-entitlements-y-limits.md` §2.2, después de *«gana la fuente más favorable»*.
**Agregar**: *«La misma favorabilidad es la que usa `direcciónDeCambio` para decidir qué es
bajar (`B/10` §3.5).»*

`$V/descomposicion.md`, criterio de `V2`. **Agregar**: *«y contesta `SUBE` sobre un par donde
lo único que cambia es una clave `MÍNIMO` que pasa de 24 a 4»*.

### 3.2 `F-8V1C1-003` · El orden entre el aviso, la invalidación y el commit no está escrito

- `$V/docs/02-modelo-de-datos.md:523`: «1. **Invalidar es borrar, no recalcular.** Recalcular dentro de la transacción que causó el»
- `$V/docs/02-modelo-de-datos.md:484`: «**La invalidación es explícita, y el vencimiento por tiempo es una red, nunca el mecanismo.** Un»
- `$D/12-contrato-de-cobertura.md:833`: «El aviso no tiene transporte durable —el outbox del núcleo es de correos—,»

Sigue llegando: ningún texto fija el orden, y la regla 1 sugiere hacerlo dentro de la operación.
Es **acceso indebido** (la entrada revocada vuelve al caché), así que no es residuo de borde.
**Aplicación** para el orden; **owner** (`G4-3`) para el valor de la red de tiempo, que hoy no
tiene número.

`$V/docs/02-modelo-de-datos.md` §3.2, regla 1. **Agregar** al final:

> **Y se borra DESPUÉS del commit** de la operación que cambió la cobertura, nunca dentro de su
> transacción: una lectura concurrente anterior al commit recalcula con el estado viejo y lo vuelve
> a cachear, y un borrado previo al commit no la alcanza. Si el proceso cae entre el commit y el
> borrado, la entrada vieja vive hasta la red de tiempo (`G4-3`) o hasta que el reconciliador
> diario encuentre la diferencia (FASE 9 vuelta 1, `F-8V1C1-003`).

`$D/12-contrato-de-cobertura.md` §3, después de *«El evento no reemplaza la consulta.»*.
**Agregar**:

> **El aviso sale después del commit** de lo que cambió la respuesta, igual que la invalidación
> (`V/02` §3.2, regla 1): un aviso anterior al commit despierta a un consumidor que vuelve a
> preguntar, ve el estado viejo y no hace nada.

### 3.3 `F-8V1C1-005` · `B4` entrega `cobrada` y su aviso, pero corre antes de que exista el pago

- `$B/descomposicion.md:579`: «**B4** una vez que estén B3 y `V4` · **B11** una vez que esté B5»
- `$D/12-contrato-de-cobertura.md:126`: «un cobro del proveedor aprobado, leído por id (`B/09` §4), o una cuota de pagador manual»

Sigue llegando: el grafo no cambió y el criterio de `B4` no tiene caso de `cobrada`.
**Aplicación.**

`$B/descomposicion.md` §3, diagrama: **agregar** la flecha `B5 ──► B4`. Fila *en paralelo*:
**tachar** *«B4 una vez que estén B3 y `V4`»* y **escribir** *«B4 una vez que estén B3, **B5** y
`V4` —`cobrada` se lee sobre pagos acreditados, que registra B5, y el aviso del primer pago lo
emite `P1`, que también es de B5—»*. Criterio de terminación de `B4`: **agregar** *«y un caso de
`cobrada: no` sobre una `SUSCRIPCIÓN` `ACTIVE` sin pagos, que pasa a `sí` —con su aviso— al
primer pago acreditado»*. No mueve el camino crítico: `B4` sigue en paralelo, ahora con `B7`.

### 3.4 `F-8V1C1-007` · Si la sucesora entra en grace, la predecesora marcada vuelve a emitir

- `$D/12-contrato-de-cobertura.md:479`: «una fila con una sucesora en `ACTIVE` apuntándola (`sucede_a`) no emite»
- `$D/12-contrato-de-cobertura.md:157`: «que desde la FASE 9 completa entra al grace cuando su»

Sigue llegando: la condición está escrita sobre `ACTIVE` y 3c abrió `GRACE_PERIOD`. **Aplicación**,
y la forma la da el propio párrafo: *«El cambio de plan ocurrió en el momento en que la sucesora
autorizó»*. La condición se escribe sobre ese hecho, no sobre un estado.

`$D/12` §2.6, en la frase citada. **Tachar** *«una fila con una sucesora en `ACTIVE` apuntándola
(`sucede_a`) no emite fuente»* y **escribir**:

> **una fila cuya sucesora ya autorizó —una fila que la apunta por `sucede_a` y salió de
> `PENDING_AUTHORIZATION` hacia `ACTIVE`— no emite fuente, en ningún estado posterior de esa
> sucesora**: ni en `GRACE_PERIOD` (3c) ni después (FASE 9 vuelta 1, `F-8V1C1-007`; una condición
> escrita sobre un estado se rompe cada vez que una decisión abre el estado vecino)

Lo que esto no toca: si la cancelación de la predecesora falló, su preapproval puede seguir
cobrando; eso es la marca y el reintento del barrido (conciliación), no la cobertura.

### 3.5 `F-8V1C1-011` · El dueño de `G13` está escrito distinto en el contrato y las descomposiciones

- `$D/12-contrato-de-cobertura.md:1139`: «**Su dueño es `V4`, la unidad de la épica de verticales**, y no `B4`. No es indiferente: la épica»
- `$D/12-contrato-de-cobertura.md:1144`: «**Falla sobre un build destinado a producción, no sobre la rama**, así que no se dispara mientras»
- `$V/descomposicion.md:94`: «Nace en **B4** de la otra épica, que es donde aparece la segunda implementación. Queda anotado acá»
- `$B/docs/20-testing.md:55`: «que es donde aparece la segunda implementación — **no puede nacer en `V4`**, porque mientras la de arranque es la única»

Sigue llegando (es la contradicción (a) del consolidado). **Aplicación**: el contrato es el
documento que ninguna épica muta sola, y su §6.3 refuta con texto el argumento de las otras tres
(*falla desde el primer día*): el guard mira un build destinado a producción, no la rama. Se
alinean las descomposiciones y `B/20` al contrato.

- `$V/descomposicion.md` §2.3: **tachar** *«No puede nacer acá.»* y los dos párrafos que siguen, y
  **escribir** *«**Nace acá, en V4** (`12-contrato…` §6.3): falla sobre un build destinado a
  producción y no sobre la rama, así que se escribe con la de arranque y calla hasta el merge del
  paraguas, que es el momento que protege»*. Fila de `V4` en la tabla de unidades: **agregar**
  `G13` a la columna de guards. Criterio de `V4`: **agregar** *«y la de arranque no puede llegar a
  producción (`G13`)»*. Y en el §2.8, *«nace en `B4` (§2.3)»* → *«nace en `V4` (§2.3)»*.
- `$B/descomposicion.md`: **tachar** `G13` de la columna de guards de `B4`, la frase *«`G13` a
  `B4`»* del §2.1 (queda *«`G12` a `B1`; `G13` lo asigna la otra épica, a `V4`»*), el párrafo
  *«Y acá nace `G13`…»* del §2.5, y *«la de arranque no puede llegar a producción»* del criterio de
  `B4`.
- `$B/docs/20-testing.md` §2, fila `G13`: **tachar** *«Lo construye `B4`…»* hasta el final y
  **escribir** *«Lo construye `V4` (contrato §6.3): falla sobre un build destinado a producción, no
  sobre la rama»*. El guard sigue catalogado acá, porque vigila el contrato.

### 3.6 `F-8V1C1-014` · La descomposición de billing sigue contando tres fuentes, sin el addon

- `$B/descomposicion.md:296`: «Le alcanza con B3: **una suscripción viva ya es una fuente**. Las otras dos —cortesía y grant— se»
- `$D/12-contrato-de-cobertura.md:1092`: «**Son cuatro y no tres desde que el addon es una fuente del contrato** (§2.4, clase»

Sigue llegando. **Aplicación.**

`$B/descomposicion.md` §2.5: **tachar** *«Las otras dos —cortesía y grant— se enchufan en B9»* y
**escribir** *«Las otras tres se enchufan después **sin tocar** lo que B4 dejó: cortesía y grant
en B9, y el addon en B10, con su `alcance` —los cuatro—, su `objetivo` y su `hasta`»*. Fila de
`B10` en la tabla de unidades: **agregar** *«**emite la fuente `ADDON` entera**, en sus cuatro
alcances —`LISTING` con su `objetivo`, que es la única fuente que alimenta el pliegue por ficha
del contrato §2.7—»*.

---

## 4. Preguntas al owner

### G4-1 · ¿Se cierran las ventas, vieja y nueva, durante la ventana del corte?

**Pregunta.** ¿Se cierran las altas del sistema viejo desde antes del censo, y las del nuevo hasta
terminar el paso 4, aunque por ese rato (del orden de una hora) nadie pueda suscribirse?

1. **Cerrar las rutas de alta en el borde** (la propuesta del §2.1): una regla de Cloudflare
   rechaza las rutas que crean algo en el proveedor, en el viejo desde el 0b y en el nuevo hasta el
   paso 5. **Costo**: una regla y una verificación por ruta; nadie se suscribe durante el corte.
   **Riesgo**: que la regla deje afuera una ruta; lo acota el criterio (crear o re-autorizar en el
   proveedor) y la verificación. **Impacto**: `$D/16` §4.2 y §4.3.
2. **Mantenimiento del sitio entero** durante el corte. **Costo**: ninguno de diseño. **Riesgo**:
   baja todo, incluidas lecturas públicas y el panel, y hay que dejar pasar el webhook del nuevo.
   **Impacto**: el mismo, más una pantalla de mantenimiento.
3. **No cerrar nada** y repetir el control del paso 2 justo antes de apagar el viejo (la
   alternativa de `C2`). **Costo**: un recorrido más del proveedor. **Riesgo**: no ve las
   `Preference` ni lo que el nuevo venda antes de un aborto; el residuo sigue siendo plata sin
   asiento. **Impacto**: menor en texto, pero `F-8V1B3-006` y `F-8V1A3-005` quedan abiertos.

**Recomendación: 1.** Es la única que cierra los tres caminos sin tocar el código de ningún
sistema, y se verifica como el apagado de webhooks que el corte ya hace. La 2 cierra lo mismo con
más daño; la 3 no cierra dos de los tres.

**Juan.** Juan quiere suscribirse a las 10:30, en plena ventana. Con 1, el checkout le dice que no
está disponible por unos minutos (el aviso previo al corte lo anticipó) y se suscribe a las 11:40
en el sistema nuevo, con su trial. Sin cerrar, paga en el viejo, el pago se pierde con las tablas
viejas y un mes después le cobran de nuevo sin servicio.

**La otra posición, honesta.** `DEC-MIG-002` eligió no congelar altas porque tres verticales no
vendieron nada todavía; alguien puede leer que cualquier cierre la contradice. No la contradice:
aquélla es sobre los meses del rediseño, y esto son minutos al final. Pero es el owner quien dice
si esos minutos valen.

### G4-2 · ¿Cómo entran al contrato las lecturas y la escritura legítimas que hoy no están?

**Pregunta.** Las filas 6 a 11 del dominio de R8 (ficha objetivo, política del addon, catálogo de
la pricing, conjunto efectivo de Mi Suscripción, predicado del botón, extensión del trial), ¿se
declaran en el §4.1, se declaran las superficies como capa de composición, o las dos cosas según
el caso?

1. **Todo al §4.1**: una consulta u operación por cada una, incluida una
   `conjuntoEfectivo(user, vertical)` para Mi Suscripción. **Costo**: el §4.1 crece a ocho entradas;
   `V2`/`V4` construyen más. **Riesgo**: el §4.1 deja de ser *«nunca capacidades»*, y la excepción
   de pantalla invita a que una máquina de billing decida sobre capacidades. **Impacto**:
   contrato §4, `V/descomposicion` §2.9, `B/descomposicion` §2.6.
2. **Mixto** (recomendada): lo que **decide** —`ficha`, `políticaDeAddon`, `extenderTrial`— al
   §4.1; lo que **muestra** —pricing, Mi Suscripción, botón— a una capa de composición declarada
   en el contrato y en los dos capítulos 19. **Costo**: tres entradas en el §4.1 y un párrafo.
   **Riesgo**: que algo que decide se disfrace de superficie; lo acota la frase *si decide, entra
   al §4.1*. **Impacto**: contrato §4.1 y §4.2, `V/19` §2, `B/19` §2, `B/16`, `B/14`, `V/11`.
3. **Sacar las lecturas de billing**: mover vigencia y tipo de scope a `addon_product`, y la
   extensión del trial a una transición de verticales disparada por el aviso. **Costo**: reabre el
   corte por campo de `V/02` §2.1 (decisión previa) y deja la extensión sin forma de rechazar un
   código. **Riesgo**: alto. **Impacto**: `V/02`, `B/02`, `B/16`, `V/03`.

**Recomendación: 2.** Respeta la frase que hace valer el contrato (*la inversa transporta
política y estado de catálogo, nunca capacidades*) donde importa —en lo que decide plata o
acceso— y no la estira para pantallas que `V/19` §1 ya declara que no deciden. Agrega el mínimo:
tres firmas y un párrafo.

**Juan.** Juan canjea *+7 días de trial*. Con 2, billing llama a `extenderTrial`; verticales mira
que siga en `TRIAL_ACTIVE` y que el techo lo admita, dentro del lock del trial, y contesta
`ACEPTADA`; recién ahí billing gasta el código. Si el techo estaba lleno, contesta `RECHAZADA` y el
código de Juan queda intacto. Hoy, sin operación, alguien escribe directo en `trial` y cada lado
cuenta su techo.

**La otra posición, honesta.** La 1 es más uniforme: una sola regla (*todo lo que cruza está en
el §4.1*) sin una categoría nueva que alguien tenga que interpretar. Quien prefiera una regla sin
excepciones, aunque el §4.1 lleve una consulta de capacidades, tiene un argumento real.

### G4-3 · ¿Cuánto vale la red de tiempo del caché de entitlements?

**Pregunta.** Con la invalidación después del commit (§3.2), ¿qué vencimiento máximo tiene una
entrada del caché, que es lo que dura un permiso revocado si el proceso cae entre el commit y el
borrado?

1. **15 minutos.** **Costo**: una relectura por `user + vertical` activo cada 15 minutos.
   **Riesgo**: bajo; el permiso indebido dura como mucho eso. **Impacto**: una frase en `V/02`
   §3.2.
2. **1 hora.** **Costo**: menor. **Riesgo**: una hora de acceso indebido tras una caída.
   **Impacto**: el mismo.
3. **24 horas**, alineada con el reconciliador diario. **Costo**: casi nulo. **Riesgo**: un día de
   acceso indebido para quien no tiene fichas publicadas (el reconciliador no lo ve).
   **Impacto**: el mismo, más declararlo en el ⚠️ de `V/03` §9.

**Recomendación: 1.** `V/02` §3 dice que acá un error *es de seguridad y no de rendimiento*, y el
caso que la red cubre es raro (una caída en una ventana de milisegundos), así que su costo
—relecturas— es lo barato. La 3 es coherente con el *«hasta un día de atraso»* que el diseño ya
acepta para el aviso perdido, pero aquél es sobre publicación, no sobre capacidades revocadas.

**Juan.** A Juan le revocan el *Free Forever*; el proceso cae justo después del commit. Con 1,
Juan sigue viendo las capacidades del grant 15 minutos, como mucho. Con 3, hasta el día siguiente
si no tiene fichas publicadas.

---

## 5. Trabajo de aplicación sin decisión

Cada ítem está escrito como texto en §2 y §3; acá, la lista para aplicar.

1. `$D/16-fase-7-del-paraguas.md` §4.2: filas 0b y 5; enmienda de la fila 3 (rutas de alta
   cerradas y fin del paso 3); cierre del párrafo de la ventana; punto 2 de la rama de aborto. Con
   el texto de `G4-1` si el owner elige 1 (§2.1).
2. `$D/16` §4.3: entrada declarada del pago de `Preference` con acreditación diferida (§2.1).
3. `$D/12-contrato-de-cobertura.md` §4.2: la regla de vuelta cita las preguntas del §4.1; el
   párrafo que defendía el número (§2.2).
4. `$D/12` §4.1: `díasDeTrial` sale de `políticaDePlan`; *seis campos y un veredicto*; y la misma
   cifra en `$D/12` §2.6 y §4.1, `$V/02` §2.1, `$V/descomposicion.md` §2.9 y criterio de `V2`,
   `$B/descomposicion.md` §2.6 (§2.2).
5. `$D/12` §2.1, fila `fuentes`: `A1` entre sus consumidores (§2.2).
6. `$D/12` §2.8 y `$B/docs/02-modelo-de-datos.md` §2.4: la vigente del grant la resuelve el paso 6
   desde el piso (§2.2).
7. `$V/docs/02-modelo-de-datos.md` §3.2: las dos filas de suscripción se funden en *llega el aviso*;
   la de grants anclados pasa a *cualquier versión publicada invalida el caché entero* (§2.2).
8. `$B/docs/16-addons.md` §1.2 y `$B/docs/02-modelo-de-datos.md` §2.4: vigencia y tipo de scope son
   de `addon_version` (§2.2).
9. `$V/docs/19-superficies.md` §4 filas 21 y 23, `$B/docs/19-superficies.md` §4 fila 21 y §7 punto
   1: la regla única del botón (§2.3).
10. `$B/docs/10-verticales-planes-billing-options.md` §3.5, `$V/docs/15-entitlements-y-limits.md`
    §2.2 y criterio de `V2`: *baja* es *empeora según la estrategia* (§3.1).
11. `$V/02` §3.2 regla 1 y `$D/12` §3: invalidación y aviso después del commit (§3.2).
12. `$B/descomposicion.md` §3: `B5 ──► B4` y caso de `cobrada` en el criterio de `B4` (§3.3).
13. `$D/12` §2.6: la predecesora no emite desde que su sucesora autorizó (§3.4).
14. `G13` a `V4`: `$V/descomposicion.md` §2.3, §2.8, fila y criterio de `V4`;
    `$B/descomposicion.md` §2.1, §2.5, fila y criterio de `B4`; `$B/docs/20-testing.md` §2 (§3.5).
15. `$B/descomposicion.md` §2.5 y fila de `B10`: la fuente `ADDON` entera la emite `B10` (§3.6).

Dependen de una respuesta: el texto de `G4-2` (§2.2, *si el owner elige la recomendación*) y el
número de `G4-3`.

---

## 6. Key Learnings

1. Un racimo de *ventana del corte* se cierra por **criterio de canal** (*crea o re-autoriza algo
   en el proveedor*), no por lista de rutas: la lista era la que dejaba afuera el checkout sin
   plan. El mismo modo de falla que el consolidado vio en el desempate de motivos.
2. Para cerrar altas por minutos en un sistema condenado, el borde (Cloudflare) es mejor que una
   bandera: no toca código que se va a tirar, y reusar un dato de dominio parecido (`admite_altas`)
   trae efectos que dicen otra cosa (bloquea `T1`, anuncia una discontinuación).
3. Una pregunta que el consolidado marcó como del owner (*¿quién resuelve la vigente del grant?*)
   ya estaba contestada en una celda del contrato (`piso` → *resuelve la vigente de `referencia`*):
   antes de preguntar, releer la firma entera.
4. Dos conteos con el mismo número y objetos distintos (*siete campos* de la fuente, 9h, y *siete
   campos* del §4.1) son una trampa para la regla de vigilancia: la regla debe citar **qué
   preguntas** existen, no cuántos campos.
5. Una fila de invalidación que necesita un dato de la otra épica se puede cerrar invalidando de
   más en un acto raro (publicar una versión borra el caché entero): la dirección segura de la
   regla 2 vuelve innecesario el dato.
6. El botón no necesitaba una regla nueva: su predicado es la condición de `T1` más el registro de
   `T7`/`T8`. Dos espejos enumerando casos divergen; uno citando un predicado no.
7. La separación útil para la frontera es **decide / muestra**: lo que decide plata o acceso cruza
   por consultas declaradas; lo que sólo muestra puede componer las dos épicas sin ser filtración.

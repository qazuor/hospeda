# 03 · El contrato de cobertura

Este archivo reúne la frontera entre las dos épicas: el contrato de cobertura entero, en su forma
vigente (`docs/12-contrato-de-cobertura.md`, sin tachados), las doce dependencias vivas entre
épicas (`DEP`, de `B/descomposicion.md` §2.6) y la lista cerrada de los ítems normativos que son
sólo citables (owner BA y BB). Suma la misma interfaz vista desde la partición del programa (§8,
`docs/11-particion-del-programa.md` §3) y dos secciones de programa de las descomposiciones de las
épicas (§9). Las referencias `§n` sin otro prefijo son a las secciones de este
mismo contrato; `V/NN`, `B/NN`, `NUCLEO/NN` y `16-fase-7…` son los capítulos de las fuentes
congeladas, que quedan como rastro. Los nombres de pieza ya están en su forma del corte del MVP
([`DEC-ARCH-017`](01-decisiones-vigentes.md#dec-arch-017)): donde la fuente decía `V8`, `V9`, `B8`
o `B9` a secas, acá dice la mitad que la partición le asignó.

## 0. La regla de la frontera

> **Este documento es de la frontera, no de una épica.** Lo citan `HOS-1353` y `HOS-1354`, y
> **ninguna de las dos lo puede mutar sola** ([`DEC-ARCH-006`](01-decisiones-vigentes.md#dec-arch-006)). Una copia que una de las dos pueda
> tocar sin que la otra se entere es `F-1B-132` otra vez: seis repartos sobre las mismas tablas y
> ninguno coincide.
>
> **Y la copia no hace falta que nadie la mute, y por eso la regla es más dura que «no la mutes».**
> Cuatro documentos transcribieron esta firma —los dos `spec.md`, la partición §3 y el handoff— y
> **las cuatro divergieron sin que nadie las tocara**: alcanzó con que el contrato avanzara de tres
> campos a cinco (`F-8C1-009`, `F-8dC2-001`). Las cuatro se retiraron y quedaron como remisión.
>
> > **Regla de vigilancia: la firma de `cobertura()` se enuncia acá y en ningún otro documento.**
> > Ningún otro capítulo, `spec.md`, `descomposicion.md` ni documento del paraguas lleva un bloque
> > que enumere sus campos; lo que llevan es un puntero a este §2. Se comprueba con
> > `rg -n "cobertura\(user" .specs/` — fuera de este documento y de los informes de fase, toda
> > aparición tiene que ser prosa que **cite**, nunca un bloque que **defina**.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:12, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:28

## 1. Qué problema resuelve

[`DEC-ARCH-005`](01-decisiones-vigentes.md#dec-arch-005) parte el programa en dos épicas autónomas, y eso sólo sirve si la de verticales
**puede correr sin que exista la de billing**. El punto de contacto no es teórico: el **paso 5**
de la resolución de autorización (cap. 17 §1.2) pregunta *«¿tiene trial, suscripción, cortesía o
grant que lo cubra?»*, y **tres de esas cuatro fuentes son de billing**.

Este contrato es ese paso 5, enunciado una sola vez, para que verticales lo pueda responder hoy y
billing lo pueda responder de verdad mañana **sin que verticales cambie**.

> **En las rutas de escritura de las verticales, ese paso lo agrega [`V5`](10-corte/V5.md#pieza-v5)** ✚ (FASE 5, owner
> 2026-09-30, lote 1 A). Hoy esas rutas chequean el plan con los gates de entitlements y limits
> del cobro viejo; [`U1`](10-corte/U1.md#pieza-u1) los saca y deja la cadena de permiso y propiedad que ya tienen, y `V5`
> suma este paso con el criterio de salida *«ninguna ruta de escritura de vertical sin el paso de
> cobertura»*. Entre las dos, en la rama, un dueño con permiso escribe sin plan: la rama no se
> despliega hasta el corte.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:30, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:32, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:45

### 1.1 El mismo hecho, en cuatro lugares

Lo que verticales necesita de billing no está repartido: es **un hecho**, que el diseño ya pedía
en cuatro lugares distintos con cuatro nombres distintos.

| dónde | cómo se llama ahí |
|---|---|
| cap. 17 §1.2, paso 5 | *«¿tiene trial, suscripción, cortesía o grant que lo cubra?»* |
| cap. 03 §9, transición [`PB2`](04-catalogos.md#trans-v-pb2) | *«se pierde la cobertura»* |
| cap. 15 §6 | *«su plan comercial está `SUSPENDED`»* |
| cap. 02 §3.2 · cap. 15 §4.2 | el disparador del recálculo del conjunto efectivo |

El tercero parece distinto y no lo es: el §21 dice que un plan suspendido queda *«sin entitlements
comerciales»*, así que **suspendido es no tener cobertura**, y los beneficios heredados de Turista
VIP se pierden porque su fuente dejó de otorgar — no por una regla aparte.

> ⚠️ **Esta tabla NO es el censo de quién consume el hecho, y confundirlas costó la regla de
> vigilancia del §4.2.** Lo que enumera son **los cuatro nombres con que el diseño pedía el hecho
> antes de que este contrato existiera**, y por eso es una tabla histórica que no crece: su valor
> es mostrar que eran uno solo. **El censo vivo de quién consume `cubierto` es la fila de la
> tabla del §2.1**, que hoy es más larga que ésta y lo va a seguir siendo. Un lector que quiera
> saber **cuántos lugares hay hoy** tiene que ir al §2.1; contar acá le da una cifra congelada
> el día que nació el documento.

**Una precisión que el primer renglón dejó de cumplir literalmente.** Desde que existen las tres
clases de fuente (§2.4), **el paso 5 ya no pregunta por `cubierto`**: pregunta si hay alguna fuente
de la que resolver capacidades, y eso incluye el piso, que no otorga cobertura. Los otros tres
renglones siguen leyendo `cubierto` sin cambio alguno. El hecho sigue siendo uno; lo que se partió
es la pregunta que el paso 5 le hace.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:47, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:49, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:75

### 1.2 Y no depende de lo que billing todavía no decidió

El capítulo 13 de billing, que ya no existe, tenía abierta una pregunta grande: si el reloj de
cobro es nuestro o del proveedor (la cerró [`DEC-MP-006`](01-decisiones-vigentes.md#dec-mp-006),
abajo; residuo corregido el 2026-10-02).
**Este contrato se escribe igual en los dos mundos** — en los dos hay un título con un estado y
una fecha hasta la cual cubre. Se puede definir hoy sin prejuzgar el 13.

> ✅ **Resuelta el 2026-09-24 por [`DEC-MP-006`](01-decisiones-vigentes.md#dec-mp-006): el reloj es del proveedor.** Este § **no cambia**, y
> eso es justamente lo que vale la pena registrar: **la independencia que afirmaba se cumplió** — el
> contrato se escribió sin saber el desenlace y **no hubo que tocarlo cuando se supo**.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:77, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:79, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:87

## 2. La pregunta, y lo que contesta

```text
cobertura(user, vertical) → {
    cubierto:  sí | no
    fuentes:   [ {
        tipo:       TRIAL | SUSCRIPCIÓN | CORTESÍA | GRANT | BASE | ADDON
        referencia: versiónDePlan | versiónDeAddon        ← NO anulable
        alcance:    VERTICAL | LISTING | USER | GLOBAL
        objetivo:   la ficha, si alcance = LISTING; nada en los otros tres
        desde:      instante | SIN_EMPEZAR                  ← C4, revisión del owner
        hasta:      fecha | NO_VENCE | SIN_FECHA_CONOCIDA | SIN_EMPEZAR
        cobrada:    sí | no, si tipo = SUSCRIPCIÓN; nada en los otros cinco
        piso:       versiónDePlan, si tipo = GRANT; nada en los otros cinco
    } ]
}
```

> **La fuente pasó de cinco campos a seis el 2026-09-25**, con `cobrada` ([`DEC-TRIAL-010`](01-decisiones-vigentes.md#dec-trial-010); FASE 8
> completa, `F-8CA2-006`, `F-8CC1-002`), **y de seis a siete el mismo día, con `piso`** (owner
> 2026-09-25; FASE 9 completa, 9h, contradicción `C-2` del informe `09`): el trinquete del grant
> (§2.8) se aplica en verticales (`V/15` §2) y su piso vive en una tabla de billing
> (`permanent_grant_vertical`, `B/02` §2.4), así que **cruza por acá** —leerlo de esa tabla sería
> el acoplamiento que el §4.2 manda detectar—. La respuesta sigue teniendo **dos**: `cubierto` y
> `fuentes`.
>
> **Y de siete a ocho con `desde`** (revisión del owner, 2026-09-28, C4, `L2-e`, `L2-f1`,
> `L2-f3`): **el instante en que esa fuente empezó a cubrir**, que es el ancla de la cuota
> mensual (`V/15` §7). Una `SUSCRIPCIÓN`, el de su fila (la sucesora de un cambio de plan trae el
> suyo, y eso es lo que corre la fecha del ciclo); un `TRIAL`, el de [`T1`](04-catalogos.md#trans-v-t1); una `CORTESÍA` y un
> `GRANT`, el de su arranque; un `ADDON`, el de su instancia; el `BASE`, el alta de la cuenta
> (**queda escrito así, y se confirma el día que la versión de piso otorgue un entitlement medido**:
> hasta entonces no ancla nada; revisión del owner, casos vecinos, 2026-09-29, caso 11).
> Una fuente con `hasta = SIN_EMPEZAR` trae `desde = SIN_EMPEZAR`: su reloj no arrancó (§2.4).
> **No es una fecha de cobro** (§4): es la del alta de la fuente, no la de ningún pago.

Una sola pregunta, con la vertical **obligatoria en la firma** — no opcional. Es la misma forma estructural que el capítulo 17 §2.2 le dio a toda operación de dominio;
**y cuando la operación es sobre un recurso que guarda su vertical —una ficha, la presencia de un
Partner, una instancia de addon—, quien pregunta le pasa la vertical leída del recurso** (cap. 17
§1.2, precisión 6; FASE 9 completa, contradicción 1 del informe `08` y decisión 7a). Y por el mismo motivo: **una resolución que no se puede invocar sin el dato no tiene un control
que alguien pueda olvidar.**

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:89, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:91, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:131

### 2.1 Qué es cada campo, y quién lo consume

| campo | qué es | quién lo necesita |
|---|---|---|
| **`cubierto`** | si hay al menos una fuente viva **de clase `TÍTULO`** (§2.4). Es el §36 — *«permanece activo mientras al menos una source exista»* | **[`PB1`](04-catalogos.md#trans-v-pb1)**, que publica sólo con `cubierto` verdadero o si dispara [`T1`](04-catalogos.md#trans-v-t1) (`V/03` §9; owner 2026-09-25; FASE 9 vuelta 1, `F-8V1C1-012`); [`PB2`](04-catalogos.md#trans-v-pb2), [`PB3`](04-catalogos.md#trans-v-pb3) y [`PB7`](04-catalogos.md#trans-v-pb7) —**en su primera rama; la segunda de cada una mira el cupo y no este campo**, `V/03` §9—; **[`PB4`](04-catalogos.md#trans-v-pb4), [`PB5`](04-catalogos.md#trans-v-pb5) y [`PB9`](04-catalogos.md#trans-v-pb9), el hard delete del día 180, que desde la FASE 8 completa es una fila** (FASE 9 vuelta 1, §4 punto 2 de `22-verificado-G2`), que lo releen **en el momento de ejecutar** y por eso son lectores propios y no una parte del reloj (§3); el §6 del capítulo 15; el reconciliador; y el reloj de inactividad, que se reinicia cuando **la respuesta** trae este campo en verdadero (`NUCLEO/01` §1.2, hecho 2); **`T1` y [`T6`](04-catalogos.md#trans-v-t6)** de la máquina de trial, cuya guarda es este campo (`V/03` §2; FASE 8 completa, `F-8CC1-011`, owner 2026-09-25); **el reconciliador diario de cobertura**, que lo pregunta una vez por día por cada dueño con fichas fuera de `DRAFT`, `PURGED` **y `MODERATED`** (`V/03` §9, [`DEC-ARCH-009`](01-decisiones-vigentes.md#dec-arch-009); FASE 9 completa, `K-2`); y **los dos avisos previos de retención** —antes del día 90 y antes del día 180—, que lo releen antes de salir y no salen si viene verdadero (`NUCLEO/07` §6; FASE 8 completa, `F-8CA2-015`, owner 2026-09-25) |
| **`fuentes`** | **todas** las fuentes vivas, de las tres clases, no la que manda | el paso 5 de la autorización; el aviso de qué se pierde (cap. 15 §6.3) y el reconciliador, que necesita saber si apagar una deja las otras; **y [`A1`](04-catalogos.md#trans-b-a1) de billing** (`B/03` §8), que lee si en la vertical del objetivo hay un título que no sea de `tipo: TRIAL` antes de vender un addon (FASE 9 vuelta 1, `F-8V1C1-008`) |
| **`tipo`** | `TRIAL` · `SUSCRIPCIÓN` · `CORTESÍA` · `GRANT` · `BASE` · `ADDON` | los avisos, que dicen cosas distintas según por qué se perdió; y la clase, que se deriva de él **y del `hasta`** (§2.4) |
| **`referencia`** | **la referencia, no los valores**: una versión de plan o una versión de addon. **No es anulable** (§2.3) | el paso 6: es cómo verticales sabe qué otorga esa fuente |
| **`alcance`** | `VERTICAL` · `LISTING` · `USER` · `GLOBAL` (§2.7) | el pliegue en dos tramos del conjunto efectivo |
| **`objetivo`** | la ficha, si `alcance = LISTING`; nada en los otros tres | ídem |
| **`desde`** ✚ | el instante en que la fuente empezó a cubrir, o `SIN_EMPEZAR` si su reloj no arrancó (§2, revisión del owner, 2026-09-28, C4) | **la ventana de la cuota mensual** (`V/15` §7), que lo lee **sólo al abrir una ventana nueva**, para fijar el día del ciclo de la siguiente. **Esta fila es el censo de sus consumidores**, con la regla de la de `cubierto` |
| **`hasta`** | uno de cuatro valores, y ninguno es «sin fecha» a secas (§2.6) | los avisos con ventana (cap. 15 §4.4) |
| **`cobrada`** | en una fuente `SUSCRIPCIÓN`, si **esa fila** tiene **al menos un pago acreditado** —un cobro del proveedor aprobado, leído por id (`B/09` §4), o una cuota de pagador manual registrada ([`MP1`](04-catalogos.md#trans-b-mp1), `B/03` §7)—; en los otros cinco `tipo`, nada. **No entra en la clase ni en `cubierto`** (abajo) | **[`T2`](04-catalogos.md#trans-v-t2) y [`T5`](04-catalogos.md#trans-v-t5)** de la máquina de trial, que convierten sólo con una suscripción que ya cobró (`V/03` §2; [`DEC-TRIAL-010`](01-decisiones-vigentes.md#dec-trial-010), owner 2026-09-25; FASE 8 completa, `F-8CA2-006`, `F-8CC1-002`); **y `T6` y [`T8`](04-catalogos.md#trans-v-t8)**, que desde la FASE 9 completa piden un título que convierte para consumir la fila de `trial` (`V/03` §2; owner 2026-09-25, decisión 6c). **Esta fila es el censo de sus consumidores**, con la misma regla que la de `cubierto` (abajo) |
| **`piso`** | en una fuente `GRANT`, **la versión del plan de esa vertical que el grant otorgaba el día que se concedió** —el piso del trinquete (§2.8)—; en los otros cinco `tipo`, nada. Es una versión **del mismo plan** que `referencia`, y ese plan es **de esa vertical** (`B/02` §2.4, `permanent_grant_vertical`, que es de donde billing lo saca). No entra en la clase ni en `cubierto` (owner 2026-09-25; FASE 9 completa, 9h) | **la resolución del paso 6** (`V/15` §2), que aplica el trinquete: resuelve la versión vigente de `referencia` y nunca otorga menos que la de `piso`. Sin el campo, verticales tenía que leer el piso de una tabla de billing |

> **La fila de `cubierto` es EL censo de sus consumidores, y va sin número a propósito.** La
> versión anterior enumeraba seis y omitía a `PB4`, `PB5` y el hard delete —los tres relectores que
> el §3 y `NUCLEO/01` §1.2 declaran—, mientras el §1.1 contaba cuatro y el §4.2 vigilaba contra el
> cuatro. **Tres censos del mismo objeto, y el único mecanismo que existe para detectar que el
> corte se filtra contaba contra el más viejo.** Acá no hay cifra que se pueda caducar: quien
> agregue un consumidor **agrega su sintagma a esta fila en el mismo acto**, y la regla de
> vigilancia del §4.2 pregunta *«¿está en esta fila?»*, nunca *«¿son todavía N?»*. Es la misma
> forma que los cuatro inventarios de `NUCLEO/01` §2.4–§2.6 usan para lo mismo, con la diferencia
> de que aquéllos tienen guard y éste no (§4.2).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:133, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:135, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:156

#### `cobrada`: un bit sobre la fila, y lo lee sólo la máquina de trial

([`DEC-TRIAL-010`](01-decisiones-vigentes.md#dec-trial-010), owner 2026-09-25; FASE 8 completa, `F-8CA2-006`, `F-8CC1-002`.)

**Qué problema resuelve.** [`T2`](04-catalogos.md#trans-v-t2) convertía el trial en cuanto aparecía una fuente `SUSCRIPCIÓN`, y
una suscripción emite desde `ACTIVE` (§2.6), **antes de cualquier cobro**: el primero llega entre
26 y 44 minutos después de autorizar ([`PA-3`](04-catalogos.md#mp-pa-3), `B/12` §4.3). Si se rechazaba, la fila moría en
`CHARGE_DECLINED` y la persona quedaba sin suscripción **y sin trial**, que no se devuelve. La
frontera no distinguía *«autorizó»* de *«cobró»*, así que `T2` no tenía con qué esperar.

**Qué es exactamente.** Un booleano **de la fila**, no de la persona ni del `user + vertical`: la
misma lectura por autorización que `B/12` §4.3 hace para el primer cobro. Lo resuelve billing:
`sí` si esa fila tiene al menos un pago acreditado, `no` si no. En un pagador manual es `sí`
desde que la fila llega a `ACTIVE`, porque [`S29`](04-catalogos.md#trans-b-s29) sólo la lleva ahí con la primera cuota registrada
(`B/03` §3.2). Puede venir en `no` sobre una fila `ACTIVE` que todavía no cobró, sobre una
`CANCEL_SCHEDULED` que se dio de baja antes del primer cobro y sobre una sucesora cuyo primer cobro
difiere [`D8`](02-nucleo.md#inv-d8) (`B/12` §4.3); sobre una `GRACE_PERIOD`,
**casi nunca**: [`S4`](04-catalogos.md#trans-b-s4) exige un pago acreditado (`B/03` §3.2), **salvo sobre la
sucesora cuya predecesora venía pagando**, que desde la FASE 9 completa entra al grace cuando su
primer cobro se rechaza y llega ahí con `cobrada: no` (owner 2026-09-25, decisión 3c).

**Lo que NO cambia, y es lo que lo vuelve seguro:**

1. **La clase no se deriva de él.** Sigue saliendo del `tipo` y del `hasta` (§2.4): una
   `SUSCRIPCIÓN` con `cobrada: no` es de clase `TÍTULO`.
2. **`cubierto` no lo lee.** Quien acaba de autorizar está cubierto, como antes: [`PB3`](04-catalogos.md#trans-v-pb3) le
   republica, el paso 6 le resuelve su plan y el reconciliador diario no ve ninguna diferencia.
   El único consumidor es **la máquina de trial**: la conversión (`T2`,
   [`T5`](04-catalogos.md#trans-v-t5)) y, desde la FASE 9 completa, el consumo de la fila ([`T6`](04-catalogos.md#trans-v-t6), [`T8`](04-catalogos.md#trans-v-t8); decisión 6c).
3. **No reabre [`DEC-TRIAL-008`](01-decisiones-vigentes.md#dec-trial-008).** Aquella decisión rechazó un bit que distinguiera **los estados que
   no emiten fuente** —el que separaría a un `SUSPENDED` de quien no tiene nada—. `cobrada` viaja
   **dentro de una fuente que ya se emite**: no dice nada de las filas que no emiten, y esas
   siguen siendo indistinguibles de no tener nada (§4).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:158, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:160, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:190

### 2.2 `fuentes` es una lista, y eso no es de más

Podría parecer que alcanza con `cubierto`. No alcanza, y el caso está en el diseño: **quitar una
fuente no quita la cobertura si queda otra.** Un reconciliador que no vea las demás apaga
capacidades que la persona sigue teniendo, que es exactamente lo que el capítulo 15 §4 va a
evitar. La lista es lo que permite decidir sin volver a preguntar.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:192, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:194, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:197

### 2.3 `versiónDePlan` es un puntero, y ahí está la división del trabajo

Es la parte más fina del contrato y conviene decirla despacio.

**El paso 6 pregunta qué otorga la fuente. Quién sabe *qué otorga* un plan es verticales** —
`plan_version_entitlement` y `plan_version_limit` son tablas suyas ([`DEC-ARCH-005`](01-decisiones-vigentes.md#dec-arch-005)). **Quién sabe
*cuál plan* tiene esta persona es billing**, porque la suscripción ancla su versión ([`DEC-ARCH-001`](01-decisiones-vigentes.md#dec-arch-001)).

Entonces el contrato devuelve **el puntero y nunca los valores**: billing dice *«esta persona está
cubierta por la versión de plan X»* y verticales sabe qué otorga X. Si el contrato devolviera los
entitlements resueltos, la resolución del capítulo 15 —las cuatro estrategias de agregación, los
scopes, el trinquete— pasaría a vivir del lado de billing, y sería **la segunda fuente** de algo
que tiene que tener una sola.

**Y eso no es una propiedad de `versiónDePlan`: es la regla.** El caso se escribió en lugar de la
regla, y por eso una fuente que no fuera una suscripción no tenía cómo contestar el paso 6.

> **El contrato transporta una REFERENCIA a la declaración de lo que la fuente otorga, y esa**
> **declaración vive siempre del lado de verticales.** `versiónDePlan` es una de esas referencias,
> no la única: un addon transporta su `versiónDeAddon`, y las dos son punteros a tablas de
> verticales.

**Y de dónde sale cada puntero se nombra acá, porque no nombrarlo dejó una fuente con dos
candidatos.** Una fuente `ADDON` transporta **la versión que ancló la INSTANCIA al comprarse**
(`addon_instance`, `B/02` §2.4) y **nunca** la que el producto vende hoy
(`addon_product.version_id`): son dos preguntas distintas —qué se compró y qué se vende— y
confundirlas mueve a todas las instancias vivas cada vez que se publica una versión. Es la misma
separación que `V/10` §2 hace para los planes.

**La referencia no es anulable, y eso es lo que cierra el caso del grant.** Una fuente sin
referencia resoluble admite dos ramas y las dos son malas: fallar cerrado la deja decorativa
—cubre y no otorga nada—, fallar abierto la vuelve *«toda clave de la vertical»*. Las dos ramas
existen porque el campo se puede responder con nada.

> **Una fuente sin referencia resoluble no se puede expresar.**

Es la misma forma estructural que el capítulo 17 §2.2 eligió para la vertical —*«una resolución que
no se puede invocar sin el dato no tiene un control que alguien pueda olvidar»*— aplicada al otro
lado de la misma frontera. No hay rama A ni rama B: hay una fila que no se puede escribir.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:199, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:201, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:237

### 2.4 Las tres clases de fuente, y qué cuenta para `cubierto`

No todas las fuentes hacen lo mismo, y tratarlas igual abre un agujero en cada extremo del ciclo.
**La clase se deriva de dos campos que la fuente ya transporta —el `tipo` y el `hasta`— y no se
transporta ella misma**: hacerlo sería la segunda fuente de un dato que esos dos ya determinan.

| clase | cuándo | ¿cuenta para `cubierto`? | qué es |
|---|---|---|---|
| **`TÍTULO`** | `tipo ∈ {TRIAL, SUSCRIPCIÓN, CORTESÍA, GRANT}` **y `hasta ≠ SIN_EMPEZAR`** | **sí** | la relación comercial que habilita a estar adentro |
| **`BASE`** | `tipo = BASE`, **o cualquier fuente con `hasta = SIN_EMPEZAR`** | **no** | el piso que tiene todo el mundo por existir (§2.5) |
| **`COMPLEMENTO`** | `tipo = ADDON` | **no** | agrega capacidades sobre un título; nunca cobertura |

> **`cubierto` se calcula sólo sobre las fuentes de clase `TÍTULO`.**

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:239, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:241, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:251

#### Un reloj que no arrancó no es un título

Es la mitad de la regla que faltaba, y su ausencia costó caro: **la fuente de trial en `PRE_TRIAL`
es de `tipo: TRIAL`**, así que con la clase derivada sólo del `tipo` quedaba en `TÍTULO` — y como
`PRE_TRIAL` es *«el estado más poblado del sistema»* (`V/03` §2), **`cubierto` pasaba a ser
verdadero para casi toda la plataforma**. En Partner era peor y permanente: sin evento de
activación declarado **nadie sale nunca de `PRE_TRIAL`**, así que `cubierto` no podía volverse
falso jamás.

> **Una fuente cuyo reloj no arrancó no cubre. Habilita a resolver capacidades, no a estar
> adentro.**

**Por qué se deriva del `hasta` y no de un `tipo` nuevo**: `PRE_TRIAL` **no es un `tipo` nuevo** —
la fuente sigue siendo `tipo: TRIAL` y lo único que cambia es a qué versión apunta—, y los avisos
necesitan ese `tipo` para decir *«tu prueba todavía no empezó»* en vez de *«no tenés nada»*. El
`hasta` ya transporta el dato exacto (`SIN_EMPEZAR`, §2.6) y **no hace falta ningún campo nuevo**.

**Y no relaja el paso 5**, que es lo que podría parecer: el paso 5 pregunta por `fuentes`, no por
`cubierto` (`V/17` §1.2, precisión 5). Quien está en `PRE_TRIAL` **sigue pasándolo** y sigue
resolviendo sus capacidades contra la versión de pre-trial. Lo único que deja de tener es
**cobertura**, que es lo que nunca debió tener: no contrató, no probó y no publicó nada.

**El dominio que esta regla crea, recorrido** — seis `tipo` × cuatro `hasta`:

| `tipo` | `fecha` | `NO_VENCE` | `SIN_FECHA_CONOCIDA` | `SIN_EMPEZAR` |
|---|---|---|---|---|
| `TRIAL` | `TÍTULO` — trial corriendo | — imposible: el trial siempre vence | — | **`BASE`** — `PRE_TRIAL` |
| `SUSCRIPCIÓN` | `TÍTULO` — `CANCEL_SCHEDULED` | — | `TÍTULO` — `ACTIVE` | — imposible: una suscripción que no arrancó **no emite fuente** (§2.6) |
| `CORTESÍA` | `TÍTULO` | — | — | — |
| `GRANT` | — | `TÍTULO` | — | — |
| `BASE` | — | `BASE` | — | — |
| `ADDON` | `COMPLEMENTO` | — | `COMPLEMENTO` | — |

**Las tres combinaciones imposibles lo son por una razón escrita, no por omisión**, y es lo que
impide que la regla se vuelva a romper por un extremo que nadie miró.

**Por qué el addon no cuenta, y no es una sutileza.** `B/16` §4.2 dice que *«la suspensión y la
pausa no dejan huérfano a nada»* y que el reloj del addon *«no se congela»* ([`DEC-ADDON-001`](01-decisiones-vigentes.md#dec-addon-001)): una
instancia de addon **viva** convive con una suscripción `SUSPENDED`, a la que el §21 deja *«sin
entitlements comerciales»*. Con `cubierto` definido como *«al menos una fuente viva»*, ese
suspendido quedaría cubierto por su propio addon — **dejó de pagar y sigue adentro**, y el
fail-open lo habría **introducido el arreglo**, que es la forma de defecto que [`DEC-METH-004`](01-decisiones-vigentes.md#dec-meth-004) manda
a evitar.

Y no inventa una regla: escribe una que ya rige en dos capítulos. El §38 exige *«una subscription
válida compatible»* para adquirir un addon, y `B/16` §2.4 declara su única excepción —*«un grant
permanente vale como título en lugar de la suscripción `ACTIVE`»*—. **Un addon nunca fue un título:
era el complemento de uno.**

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:253, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:255, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:300

#### Y el complemento tampoco aporta CAPACIDADES si no hay título

Sacar al addon de `cubierto` cerraba la puerta en un lugar y la dejaba abierta un paso más
adelante: **el paso 6 pliega todas las fuentes vivas**, así que el suspendido perdía la cobertura y
**conservaba lo que su addon otorga**. Es el mismo desenlace, en el paso siguiente.

> **El pliegue del conjunto efectivo DESCARTA las fuentes de clase `COMPLEMENTO` cuando no hay
> ninguna de clase `TÍTULO` viva.** Un complemento agrega sobre un título; sin título no agrega
> sobre nada.

**No es una regla nueva: es la misma que este § ya enuncia**, dicha donde se ejecuta en vez de sólo
donde se define. *«Agrega capacidades sobre un título»* era una frase en el contrato y **una frase
no es un gate**: el capítulo 15 pliega lo que el contrato le da, y le estábamos dando el addon sin
decirle que dependía de otra cosa.

> ⚠️ **Y decirlo acá tampoco alcanza: el gate vive en `V/15` §2.6**, que es el § que define el
> conjunto plegable y al que responden las cuatro estrategias de agregación. Este renglón es la
> definición; aquél es la ejecución, y lleva su guard ([`G-R2`](04-catalogos.md#guard-g-r2), `V/20` §2). La primera versión de
> este arreglo se escribió sólo acá, y el capítulo que pliega siguió diciendo *«suma todas las
> fuentes vivas»* durante toda una vuelta del ciclo.
>
> **Y el gate es más estricto que esta definición, a propósito**: un trial corriendo es `TÍTULO`
> para `cubierto`, pero **no admite complementos** —`V/15` §2.6 los admite sólo con un título que no
> sea de `tipo: TRIAL`—, porque `V/11` §5.3 es el dueño de la regla del trial (FASE 8 completa,
> `F-8CA1-004`, `F-8CA2-011`, `F-8CC1-006`).

**El caso que NO cambia, y conviene decirlo**: un `GRANT` permanente **es** de clase `TÍTULO`, así
que quien tiene *Free Forever* y un addon **conserva los dos**. Es exactamente la excepción que
`B/16` §2.4 ya declaraba —*«un grant permanente vale como título en lugar de la suscripción
`ACTIVE`»*— y acá se cumple sin escribirla aparte.

**Lo que esto NO decide**: si el cliente pierde días de addon que pagó mientras su suscripción está
suspendida. Es una decisión de producto, es legítima, y es otra — congelar el reloj del addon
([`DEC-ADDON-001`](01-decisiones-vigentes.md#dec-addon-001)) se puede decidir cuando se quiera, sin tocar esta regla.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:302, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:304, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:335

### 2.5 El título `BASE`: no tener nada es un estado, no un accidente

`Turista Free`, `Guest` y `TRIAL_EXPIRED` no tienen ninguna de las cuatro fuentes de clase
`TÍTULO`. Sin un piso, el paso 5 le niega a un `TRIAL_EXPIRED` **la operación de suscribirse**, que
es la única forma de volver a tener una: **queda afuera para siempre**, contra la *«recuperación
posible»* que el §21 promete y que `NUCLEO/01` §2.1 cita para los dos `SUSPENDED`.

> **`BASE` es la fuente que toda persona tiene en toda vertical por el solo hecho de existir en la**
> **plataforma.** Transporta la referencia a la **versión de piso** de esa vertical —un `plan` no
> vendible, uno por vertical, con sus entitlements y limits **guardados**— y su `hasta` es
> `NO_VENCE`.

**No tener título no es un accidente: es el estado base de la plataforma.** Todo usuario
autenticado es `Turista Free` sin suscripción real (§14) y todo visitante es `Guest`. Que el paso 5
no tuviera respuesta para el caso más común del sistema era el mismo defecto que `R3` corrigió para
`PRE_TRIAL`, del otro lado del ciclo.

**Tres cosas que esta fuente NO hace, y son las que la vuelven segura:**

1. **No otorga cobertura.** Es de clase `BASE` (§2.4), así que `cubierto` sigue siendo falso para
   un `TRIAL_EXPIRED`, [`PB2`](04-catalogos.md#trans-v-pb2) sigue disparando cuando el trial vence, y el criterio que el §5.1 le
   pone a la implementación de arranque —*«un trial vence de verdad»*— sigue en pie.
2. **No otorga ninguna clave comercial.** La versión de piso otorga lo mínimo para existir,
   **recuperar lo suyo** y volver a contratar — las **tres** cosas de su lista cerrada
   (`V/02` §2.1). Es el mismo punto único de falla que la versión de pre-trial, y lo vigila el
   **mismo guard**: [`G-R3`](04-catalogos.md#val-g-r3) se comprueba sobre las dos versiones no vendibles de cada vertical, no
   sobre una. **La tercera no lo toca**: traer a borrador una ficha propia archivada ([`PB8`](04-catalogos.md#trans-v-pb8)) no
   publica, no cuenta contra ningún limit y no alcanza una ficha ajena, así que no es ni una clave
   comercial ni un entitlement medido.

   **Y que la segunda y la tercera ESTÉN lo vigila el mismo guard por su otra mitad.** Es la mitad
   *(b)* de [G-R3](04-catalogos.md#val-g-r3) (`V/20` §2), y hace falta acá más que en ninguna otra parte: el párrafo de arriba
   dice que sin piso el paso 5 le niega a un `TRIAL_EXPIRED` la operación de suscribirse y **queda
   afuera para siempre**. Un piso presente al que le falte esa clave produce lo mismo un paso más
   adentro, en el 6, y hasta esta pasada **ningún control lo miraba**.
3. **No es un `tipo` que billing resuelva.** El piso lo resuelve verticales, que es de quien son
   las dos tablas de la versión. Billing no conoce `BASE`.

**Consecuencia declarada, porque no decirla sería esconderla**: con un piso siempre presente, **el
paso 5 deja de rechazar a nadie**, y toda la defensa se apoya en el paso 6. Es deliberado — el paso
5 nunca fue el que otorga (`V/17` §1.2 separa los mensajes: el 5 contesta *«sin cobertura»* y el 6
*«sin la capacidad»*) — y es lo que obliga a que el argumento de `V/17` §2.2 se apoye en el paso 6
y no en el 5.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:337, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:339, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:379

### 2.6 `hasta` tiene cuatro valores, y ninguno es «sin fecha» a secas

Con seis tipos de fuente, *«sin fecha»* pasa a significar tres cosas incompatibles, y el aviso no
puede elegir qué decir:

| valor | cuándo | qué tiene que entender el aviso |
|---|---|---|
| **`fecha`** | el fin ya está determinado: `CANCEL_SCHEDULED` con la fecha de [`DEC-SUB-009`](01-decisiones-vigentes.md#dec-sub-009), fin de cortesía, vencimiento de un addon `DÍAS_FIJOS`, fin del trial | **esta fuente deja de emitirse ese día** —el fin de la **emisión**, no el de la cobertura: otra fuente puede tomar su lugar—; **si eso abre una ventana para elegir lo decide `V/15` §4.4**, que se la da al vencimiento de un addon y al fin de una cortesía, y no al fin del trial (FASE 8 completa, `F-8CC1-008`, owner 2026-09-25) |
| **`NO_VENCE`** | grant permanente, título `BASE` | no hay ventana **porque no hay fin por calendario** — que no es lo mismo que *«no se apaga»*: un grant se apaga al revocarse, sin anticipación (§2.8) |
| **`SIN_FECHA_CONOCIDA`** | suscripción `ACTIVE`, addon `MIENTRAS_VIVA_LA_SUSCRIPCIÓN` | no hay ventana **porque todavía no se sabe** |
| **`SIN_EMPEZAR`** | la fuente de trial en `PRE_TRIAL` | no hay ventana **porque el reloj no arrancó** |

`V/15` §4.4 reparte las ventanas **sobre esa diferencia, pero no
la copia**: *«vencimiento de un addon · fin de una cortesía»* tienen ventana; *«revocación de un
grant»* no; **y *«fin del trial»* tampoco, aunque su `hasta` sea una `fecha`** —se aplica en el acto
(`V/15` §4.4)—. Este renglón decía *«exactamente»* y ponía el fin del trial entre los que tienen
ventana, y los dos documentos se contradecían; **manda `V/15` §4.4**, que es el consumidor que
decide la ventana (§2.1, fila `hasta`), y es coherente con la máquina de trial, que agenda su propia
campaña previa ([`T1`](04-catalogos.md#trans-v-t1)) y aplica la pérdida en el acto ([`T3`](04-catalogos.md#trans-v-t3), `V/03` §2) (FASE 8 completa,
`F-8CC1-008`, owner 2026-09-25).

⚠️ **Lo que esto NO cierra, declarado por [`DEC-METH-015`](01-decisiones-vigentes.md#dec-meth-015)**: la fuente `CORTESÍA` de una `PAUSED`
por `COURTESY` tiene `hasta: fecha`, y **lo normal ese día es [`S10`](04-catalogos.md#trans-b-s10)**, que vuelve a `ACTIVE` y
emite `SUSCRIPCIÓN` **con la misma versión anclada** (`B/02` §2.4): no se pierde nada. Como el
estado de la suscripción no cruza (§4), verticales no puede saberlo, y el aviso con ventana que
`V/15` §4.4 le da al fin de una cortesía **anuncia una pérdida que en ese caso no ocurre**. Qué
dice el aviso en ese caso no está escrito; no mueve plata, no da acceso y no borra nada
(`F-8CC1-008`).

> **El `hasta` es el fin de la emisión, no una etiqueta: una fuente con `hasta: fecha` deja de
> aparecer en `fuentes` cuando esa fecha pasa.**

Parece obvio y hay que escribirlo, porque la alternativa ya se materializó una vez. Una fuente se
emite porque **un estado lo dice**, y si ese estado no se puede mover el `hasta` queda en el
pasado y la fuente **sigue contando para `cubierto`** — una cobertura perpetua que no falla
ruidosamente, regala, y que ningún aviso muestra porque el aviso sólo mira la ventana. Fue el
desenlace del trial que quedaba en `TRIAL_ACTIVE` sin salida alcanzable (`V/03` §2). La máquina que
emite la fuente es la responsable de tener salida; este renglón es la segunda línea, para que un
estado atascado se note como fuente que se apaga en vez de como capacidad que no se apaga nunca.

**Y la segunda línea sólo la ve quien pregunta, así que tiene que haber quien pregunte** (FASE 8
completa, `F-8CA1-007`, `F-8CC1-009`, owner 2026-09-25). Que la fecha pase **no es una
transición**: no emite el aviso del §3 ni invalida el caché (`V/02` §3.2), y los consumidores que
actúan —[`PB2`](04-catalogos.md#trans-v-pb2), el caché y el reconciliador de excedentes— no se enteraban hasta que corriera el
job atascado. **Lo que la lleva hasta ellos es el reconciliador diario de cobertura** (`V/03` §9,
[`DEC-ARCH-009`](01-decisiones-vigentes.md#dec-arch-009)): pregunta en vivo una vez por día, encuentra `cubierto` falso contra fichas
publicadas, corre `PB2` e invalida la entrada. Con un día de atraso, y **sólo si la fecha vencida
produce una diferencia de fichas**; lo que no la produce queda declarado en el ⚠️ de ese §.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:381, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:383, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:428

#### Qué emite cada estado de la suscripción — los nueve, sin huecos

El `hasta` estaba enumerado por **situación** y no por **estado**, y así quedaban cuatro de los
nueve estados de la suscripción **sin respuesta declarada**. Uno de ellos es el que la sucesión
volvió frecuente.

| estado (`B/03` §3.1) | ¿emite fuente? | `hasta` | por qué |
|---|---|---|---|
| `PENDING_AUTHORIZATION` | **no** | — | ver abajo |
| `ABANDONED` | **no** | — | [`S3`](04-catalogos.md#trans-b-s3) canceló el preapproval: no hay nada |
| `ACTIVE` | **sí** | `SIN_FECHA_CONOCIDA` | se renueva sola; el fin no está determinado |
| `GRACE_PERIOD` | **sí** | `SIN_FECHA_CONOCIDA` | el §20 da **servicio entero** durante el grace |
| `PAUSED` por `CUSTOMER_REQUEST` | **no** | — | `B/16` §2.2: *«el servicio está detenido»* |
| `PAUSED` por `COURTESY` | **sí**, como `tipo: CORTESÍA` | la fecha de fin de la cortesía | lo sostenemos nosotros ([`DEC-GRANT-003`](01-decisiones-vigentes.md#dec-grant-003)) |
| `SUSPENDED` | **no** | — | el §21 lo deja *«sin entitlements comerciales»* |
| `CANCEL_SCHEDULED` | **sí** | **la fecha** de fin de servicio de [`DEC-SUB-009`](01-decisiones-vigentes.md#dec-sub-009) | es *«un dato nuestro»* y ya está determinado |
| `CANCELLED` | **no** | — | terminada |
| `CHARGE_DECLINED` | **no** | — | terminal, y **[`S16`](04-catalogos.md#trans-b-s16) canceló el preapproval —de nuestro lado, si el proveedor no lo había hecho—** (FASE 9 completa, `C12` del informe `01`; `B/03` §3.2) |

> **Una suscripción esperando autorización NO emite fuente de cobertura.**

**Y es la respuesta cara de las dos.** Emitirla significa **hasta lo que dure la ventana de
autorización de servicio completo gratis, y repetible** —se abandona el checkout y se empieza de
nuevo—, y **esa ventana no es una sola**: **72 horas** con tarjeta y **7 días corridos** con pago
manual (`B/03` §3.4 punto 1, [`DEC-SUB-016`](01-decisiones-vigentes.md#dec-sub-016)), o sea que sobre el pagador manual la respuesta cara
lo es **más del doble**. Y durante una sucesión
significa **los dos planes sumados** hasta que la nueva se autorice. Las dos lecturas cuestan
plata en la misma dirección.

**Y no deja a nadie en la nada**, que es la objeción obvia: a quien recién contrata **le sigue
rigiendo el piso** (§2.5), y a quien está cambiando de plan **lo sigue cubriendo su suscripción
vieja**, que es justamente lo que [`D7`](02-nucleo.md#inv-d7) mantiene viva hasta que la nueva quede autorizada.

**Con una salvedad que conviene decir en vez de suponerla, porque la predecesora se puede morir
sola.** `D7` la mantiene viva contra **nuestras** cancelaciones, no contra los relojes ni contra
el proveedor: de las **nueve** transiciones que la mueven durante la ventana
(recontadas con [`DEC-SUB-021`](01-decisiones-vigentes.md#dec-sub-021), owner 2026-09-25: `GRACE_PERIOD` dejó de ser estado de declaración,
así que [`S6`](04-catalogos.md#trans-b-s6) y [`S24`](04-catalogos.md#trans-b-s24) salen de la cuenta de `B/03` §3.2 y [`S4`](04-catalogos.md#trans-b-s4) entra; **y entra [`S36`](04-catalogos.md#trans-b-s36), la fila 12**,
FASE 9 vuelta 1, M; **y sale [`S27`](90-retirados.md#trans-b-s27)**, que ya no existe: revisión del owner, 2026-09-28, C8),
**tres la sacan de las filas vivas sin que nadie
declare nada** —[`S12`](04-catalogos.md#trans-b-s12), `S16` y **el espejo de la baja que decide el proveedor** (`B/03` §3.2 y
§10.1)—. **[`S13`](04-catalogos.md#trans-b-s13) no**: también la saca, pero alcanza *«a toda fila viva principal del beneficiario,
o sea también a la sucesora»* (`B/03` §3.2) y deja un `GRANT` de clase `TÍTULO`, así que el cliente
no cae al piso (FASE 9 completa, `C-8`).
**`S24` también la saca y tampoco entra en esa cuenta** —ya no es una de las nueve,
pero sigue ocurriendo sobre una predecesora que llegó al grace durante la ventana—: ahí el cliente **pidió la baja él mismo** en medio del grace ([`DEC-SUB-014`](01-decisiones-vigentes.md#dec-sub-014)), así
que caer al piso no es algo que le pase sin que nadie declare nada — es la consecuencia del acto
que acaba de confirmar, y `B/19` §4 fila 8 se lo dice antes. **`S36` también la saca y tampoco
entra en esa cuenta, por la misma razón que `S24`** (FASE 9 vuelta 1, M): desde `ACTIVE` o
`CANCEL_SCHEDULED` es una de las diez y la predecesora deja de emitir en el acto —`S36` corta el
servicio sin pasar por `CANCEL_SCHEDULED`—, pero la revocación **la pidió el cliente** dentro de los
10 días ([`DEC-RF-001`](01-decisiones-vigentes.md#dec-rf-001)), y una persona sólo la registra; caer al piso no le pasa sin que nadie
declare nada — es la consecuencia del arrepentimiento que él mismo ejerció, con el reembolso del
último pago en camino ([`RF1`](04-catalogos.md#trans-b-rf1)).
**La otra terminal, [`S23`](04-catalogos.md#trans-b-s23) desde una `SUSPENDED` de
pagador con tarjeta, que es estado de declaración desde la FASE 8 completa (`F-8CB1-002`), tampoco
entra** (revisión del owner, 2026-09-28, C8: `S27` ya no existe), y no por la causa sino porque no le cambian nada a la
cobertura: `SUSPENDED` ya no emitía ninguna fuente (§2.6), así que el piso lo tenía desde antes de
morir. En esas tres la predecesora deja de
emitir y la sucesora todavía no emite, así que **el cliente cae al piso (§2.5) por lo que le quede
de ventana**, hasta que autorice o abandone. No es un hueco nuevo, ni una consecuencia de que el
cierre de la sucesión pase a correr antes de la autorización —`PENDING_AUTHORIZATION` no emite ni
antes ni después—: es lo que ya pasaba sin estar escrito. **Y se acepta**, porque las tres tienen
la misma causa —el compromiso que sostenía la cobertura **terminó**— y la alternativa es la
respuesta cara del párrafo de arriba. Lo que sí se exige es que la superficie lo diga: `B/19` §4,
filas 16 y 16-bis —**que tienen que decirle que perdió la cobertura y que sus fichas vuelven
cuando autorice**, no sólo que el cambio *«no se ofrece»* (FASE 9 completa, `C-8`)—.

**Y la garantía termina donde termina la sucesión, así que hay que decir qué pasa después.** La
frase de arriba —*«hasta que la nueva se autorice»*— cierra la ventana **anterior** a la
autorización, y hay una ventana **posterior**: cuando la sucesora ya autorizó pero la
cancelación de la predecesora en el proveedor **falló**, `B/03` §3.2 deja las dos filas donde
estaban, con la marca puesta, y `B/03` §3.1 es explícito en que una fila marcada *«conserva el
estado que tenía, y sigue cubriendo a quien estaba cubierto»*. **Emite sólo la
sucesora** (owner 2026-09-25; FASE 8 completa, `F-8CC1-007`, `F-8CA1-012`):
**una fila cuya sucesora ya autorizó —una fila que la apunta por `sucede_a` y salió de
`PENDING_AUTHORIZATION` hacia `ACTIVE`— no emite fuente, en ningún estado posterior de esa
sucesora**: ni en `GRACE_PERIOD` (3c) ni después (FASE 9 vuelta 1, `F-8V1C1-007`; una condición
escrita sobre un estado se rompe cada vez que una decisión abre el estado vecino), aunque su cancelación en el proveedor haya fallado y siga marcada. El cambio de plan
**ocurrió** en el momento en que la sucesora autorizó; lo que falta es sólo la llamada, y eso lo
resuelven el reintento del barrido y la marca, no la cobertura.

> **Dos fuentes `SUSCRIPCIÓN` de clase `TÍTULO` para el mismo `user + vertical` no son posibles**
> (desde el 2026-09-25): en esta rama sólo emite la sucesora, así que `fuentes` nunca devuelve dos `SUSCRIPCIÓN` de clase
> `TÍTULO` para el mismo `user + vertical`.

**En esa rama el cliente no está pagando las dos** (FASE 8 completa, `F-8CC1-007`, `F-8CA1-012`). La
sucesora nació con **el crédito de lo pagado y no usado de la predecesora** ([`DEC-SUB-006`](01-decisiones-vigentes.md#dec-sub-006),
computado al crearla, `B/12` §5.4), que le corrió la fecha de primer cobro: lo que la predecesora
sigue emitiendo durante el incidente es un período **que ya se transfirió como crédito**, y la
sucesora todavía no cobró nada por sí misma. Y si la predecesora está en `GRACE_PERIOD` —llegó ahí
durante la ventana por `S4`, `B/03` §3.2—, su período en curso **ni siquiera se pagó**. En ninguno
de los dos casos el cliente paga dos planes.

**Por eso manda la sucesora**, que es la que tiene el crédito
(owner 2026-09-25; FASE 8 completa, `F-8CC1-007`, `F-8CA1-012`). Un Básico de 5 fichas más un Premium de 20 dan **20**, lo que se paga, y cuando la marca
se resuelve no cae ningún excedente que la persona no esperaba.

**Y la rama es un incidente declarado, con la marca puesta y una persona mirándolo, y su salida es
resolver la cancelación —no elegir qué fuente vale—**. Lo que no puede pasar es que el caso quede
sin nombrar, porque entonces el techo de lo que alguien puede tener depende de si una llamada al
proveedor salió bien.

**Y no es alcanzable por ningún otro camino.** Las **nueve** transiciones que mueven a la
predecesora durante la ventana de autorización —[`S8`](04-catalogos.md#trans-b-s8), [`S9`](04-catalogos.md#trans-b-s9), **`S4`**, `S12`, `S13`, `S16`, el espejo
del
`B/03` §10.1, que es la que la tabla numerada del §3.2 no lista, y `S23` (FASE 8 completa,
`F-8CB1-002`; recontadas con `DEC-SUB-021`; `S27` salió con la revisión del owner, 2026-09-28, C8), **y `S36` desde `ACTIVE` o `CANCEL_SCHEDULED`** (FASE 9
vuelta 1, M)— la dejan en un estado que **no
emite** en
  **siete de los nueve casos; las excepciones son dos**:
`S9`, que la deja emitiendo pero con `tipo: CORTESÍA`, que no es una segunda `SUSCRIPCIÓN`, **y
`S4`, que la deja en `GRACE_PERIOD`, que emite la misma `SUSCRIPCIÓN` que emitía en `ACTIVE`** —una
sola: la sucesora, en `PENDING_AUTHORIZATION`, todavía no emite—. **`S6` —por su tercer evento, el único
que la guarda de la sucesión en curso no frena (`B/03` §3.2)—, `S24` y `S36` siguen pudiendo ocurrir desde
ese grace y no cambian la conclusión**: **las tres** la dejan sin emitir (`SUSPENDED`, `CANCELLED`, `CANCELLED`; `S36`, FASE 9 vuelta 1, M). **Y `S36` sale también de
`PAUSED`** (owner 2026-09-26, `X-2`), alcanzable por `S8`/`S9`: la deja `CANCELLED`, sin emitir, y
tampoco cambia la conclusión. Y en
todas, si
la sucesora autoriza, la predecesora deja de emitir: o ya no emitía, o [`S17`](04-catalogos.md#trans-b-s17) la lleva a
`CANCELLED`.

**Consecuencia sobre el dominio del `hasta`**: `SIN_EMPEZAR` **no puede venir de una
`SUSCRIPCIÓN`**, porque el único estado que lo justificaría no emite fuente. Es la fila
«imposible» de la tabla del §2.4, y ahora tiene su razón escrita.

**Y dos reglas que hace falta decir aparte, porque las implementaciones obvias violan el §4:**

- **El `hasta` de una suscripción `ACTIVE` es `SIN_FECHA_CONOCIDA`, nunca el fin del período.** El
  §4 declara que no cruzan *«ciclos … fechas de cobro»*; poner el fin del período ahí es
  precisamente cruzar la fecha de cobro, y además haría que verticales viera la cobertura vencer
  todos los meses sobre algo que se renueva solo.
- **`SIN_EMPEZAR` no es `NO_VENCE`.** Un consumidor que confundiera los dos le daría cobertura
  perpetua a alguien que ni empezó su prueba, y el error es en la dirección cara: **no falla
  ruidosamente, regala.**

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:430, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:432, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:579

### 2.7 `alcance` y `objetivo`: la firma no cambia, la respuesta sí

Una fuente de alcance `LISTING` —un addon comprado para una ficha— entra en un conjunto que se
resuelve por `user + vertical`, y habilitaría la capacidad en **todas** las fichas. Las dos salidas
obvias tienen costo alto: meter la ficha en la clave del caché *«multiplica el caché por la
cartera»*, y resolver las fuentes `LISTING` aparte *«crea el segundo lugar donde se resuelven
capacidades»*.

Hay una tercera. Las cuatro estrategias de agregación de `V/15` §2.2 —`SUMA`, `MÁXIMO`, `MÍNIMO`,
`MEJOR_DECLARADO`— son **asociativas**, así que plegar primero las fuentes independientes de la
ficha y después las de la ficha da el mismo resultado que plegarlas todas juntas.

> **El conjunto efectivo se pliega en dos tramos: el tramo cacheado por `user + vertical`, con las**
> **fuentes de alcance `VERTICAL`, `USER` y `GLOBAL`; y un delta por ficha, con las de alcance**
> **`LISTING` cuyo `objetivo` es la ficha de la operación.**

No es un segundo lugar que resuelve capacidades: es el **mismo pliegue**, cortado donde el caché
puede cortar. La ficha ya está disponible en ese punto —el paso 4 de `V/17` §1.2 la resolvió antes
de que el paso 6 pregunte—, **la firma `cobertura(user, vertical)` no cambia**, y billing no
necesita saber nada de fichas: sólo devolver el `objetivo` que ya guarda en `addon_instance`.

**El vocabulario de `alcance` es del contrato, y se declara su mapeo** — no se renombra ninguno de
los dos que ya conviven, los cuatro scopes del §40 y el *«scope de verticales»* del §35.1:

| fuente | scope nativo | `alcance` en el contrato |
|---|---|---|
| suscripción, cortesía, trial, `BASE` | — (cubren su vertical) | `VERTICAL` |
| grant | *«scope de verticales»* (§35.1) | una fuente `VERTICAL` **por cada vertical de su scope**, y cada una transporta **el ancla de esa vertical** (§2.8) — nunca la de otra |
| addon | los cuatro del §40 | `LISTING` · `VERTICAL` · `USER` · `GLOBAL` |

**Una fuente `ADDON` de alcance `USER` o `GLOBAL` se emite sólo en las verticales compatibles de su
producto** (`addon_product`, `B/02` §2.4). En una vertical no compatible no se emite, igual que un
grant no transporta el ancla de otra vertical (§2.8). Lo vigila [`G-R2-C`](04-catalogos.md#guard-g-r2-c) (`V/20` §2), gemelo de
[`G-R2-B`](04-catalogos.md#guard-g-r2-b) (owner 2026-09-25; FASE 9 completa, decisión 4e, `F-8CA1-008`). Sin esta línea, un addon
`USER` compatible sólo con Alojamiento aparecía en la respuesta de Gastronomía y el pliegue le daba
sus fotos a Gastronomía: *«no nombran objetivo»* (`V/11` §5.2) no dice a qué no llegan.

**Y el mapeo del addon SÍ colapsa un nombre, así que decir *«no se renombra ninguno»* era falso
para esa fila.** El scope nativo del §40 se llama `VERTICAL_SUBSCRIPTION` —*«el addon que cuelga de
la suscripción de una vertical»*— y acá viaja como `VERTICAL`, que es también el `alcance` de las
fuentes que **cubren** una vertical. Se declara en vez de arreglarse, y con su alcance exacto:

- **El nombre nativo no cambia y sigue siendo el canónico donde vive el dato.** `B/02` §2.4 guarda
  `addon_instance.objetivo` con scope `VERTICAL_SUBSCRIPTION`, y `V/11` §5.2 razona sobre esa
  grafía. Ningún documento las renombra; lo que se renombra es **la etiqueta de transporte** de
  este contrato, y sólo dentro de él.
- **El colapso no cambia ninguna resolución hoy**, y la razón es del §2.7: los dos se pliegan en el
  **mismo tramo**, el cacheado por `user + vertical`. El único `alcance` que el pliegue trata
  distinto es `LISTING`, y ése no colapsa con nada.
- **Lo que sí se pierde es poder distinguirlos del lado de verticales**, porque el `objetivo` viaja
  *«nada en los otros tres»*. Es deliberado —verticales no tiene qué hacer con esa distinción— y es
  la línea a revisar el día que alguna clave se resuelva distinto según de qué cuelga el addon:
  ese día el contrato gana un quinto valor de `alcance`, no un mapa de traducción (`NUCLEO/01`
  §2.3). Es `F-8dA1-010`.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:595, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:597, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:648

### 2.8 Qué referencia transporta un `GRANT`: un plan POR VERTICAL, su versión vigente, y con trinquete

Un grant permanente cruza la frontera, la persona queda cubierta, y cuando el paso 6 pregunta qué
capacidades le da **no había respuesta**: el grant no apuntaba a ningún plan. *Free Forever* era un
nombre comercial sin contenido definido.

> **El grant se ancla a un PLAN POR CADA VERTICAL de su scope, no a una versión, y resuelve la**
> **versión vigente de cada uno —sea vendible o no—, con un trinquete: un grant nunca otorga menos**
> **de lo que otorgaba el día que se concedió.**

**«Uno por vertical» no es un detalle de implementación: sin él el grant filtra entre verticales.**
Un plan pertenece a **una** vertical (`V/02` §2.1: `UNIQUE(vertical, slug)`), y el §2.7 dice que un
grant emite **una fuente por cada vertical de su scope**. Con un solo plan anclado, las dos fuentes
transportaban **la misma referencia** y la segunda vertical resolvía sus capacidades leyendo el
plan de la primera — una clave de una vertical alimentada desde otra, que es exactamente lo que el
§64.10 prohíbe y lo que el scope estructural del capítulo 17 existe para impedir.

Así que **un grant de scope N verticales ancla N planes, uno de cada una**, y cada fuente
transporta el suyo. **Y transporta también su piso**, en el campo `piso` de la firma (§2): la
versión de ese plan que otorgaba el día de la concesión (owner 2026-09-25; FASE 9 completa, 9h).
El trinquete lo aplica verticales; el dato lo guarda billing y cruza por la firma.

**Y la vigente la resuelve verticales, no billing.** En una fuente `GRANT`, billing pone en
`referencia` una versión del plan anclado —la del piso, que es la única que guarda y que la FK
compuesta de `B/02` §2.4 ata a ese plan—, y el paso 6 resuelve de ella la versión vigente del
mismo plan con sus propias tablas. Billing nunca lee `plan_version` (FASE 9 vuelta 1,
`F-8V1C1-004`).

**Y la del piso la valida con `políticaDePlan`, sin pregunta nueva** (FASE 9 vuelta 2,
`F-8V2C1-004`, `F-8V2B3-009`). El piso es *«la versión de ese plan vigente el día que se firmó»*, y
billing no tiene cómo resolver cuál es la vigente de un plan sin leer `plan_version`. No la
resuelve: **la versión la trae el acto** —otorgar, anclar o la herramienta del corte—, y billing
**la acepta sólo si `políticaDePlan(v).vigente` es verdadero, y si no rechaza el acto**. Que la
versión sea de ese plan y el plan de esa vertical lo hace cumplir la base con la FK compuesta de
`B/02` §2.4. Sin la validación, una pantalla abierta desde antes de publicarse una versión nueva
mandaba la vieja, y el trinquete quedaba con un piso más generoso que el aprobado, para siempre.
Qué versión elegir —la del vendible de `rank` más alto, en el corte— lo decide quien firma leyendo
el catálogo, que es una superficie; billing no ordena por `rank`, porque el `rank` es de verticales.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:650, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:652, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:687

#### N anclas no son N grants, y la diferencia se paga al revocar

Es la mitad que la primera versión de esta regla no escribió, y por eso la entidad quedó con un
`plan` singular y tres capítulos diciendo tres cosas distintas.

> **Un grant es UN instrumento —una firma, un motivo, un `includesAddons`, una revocación
> (`NUCLEO/01` §1.5, §35.4)— con UN ANCLA POR CADA VERTICAL de su scope.** Lo que se multiplica es
> el ancla, nunca la concesión. El ancla lleva **el plan de esa vertical** y **el piso del
> trinquete de esa vertical**, y **el scope ES el conjunto de anclas**: no es una columna aparte
> que pueda contradecirlas. `B/02` §2.4 lo escribe como tabla.

Las dos formas que esto descarta, y qué rompe cada una:

| forma | qué rompe |
|---|---|
| **una concesión con UN plan** y un scope plural | es el defecto de arriba: la segunda vertical resuelve leyendo el plan de la primera |
| **N concesiones**, de una vertical cada una | revocar deja de ser un acto: hay que acordarse de las otras N−1, sobre lo que `NUCLEO/08` §3 llama *«la acción administrativa más grave»*. Y el *«scope de verticales»* del §35.1 pasaría a valer siempre uno, sin que nada lo diga |

**El scope *«todas actuales y futuras»* del §35.1 tiene una consecuencia que hay que declarar.** Una
vertical que todavía no existe **no tiene plan que anclar**, y el §2.3 es terminante: *«una fuente
sin referencia resoluble no se puede expresar»*. Entonces **un grant no emite fuente en una
vertical donde no tiene ancla**; extenderlo a una vertical nueva es **anclarle un plan**, que es un
acto de `SUPER_ADMIN` y queda auditado como cualquier otro. No hay rama que decida sola qué plan
regalar en una vertical que nadie miró — y la alternativa, elegirlo automáticamente, es
precisamente lo que *«regalar algo pasa a ser elegir un plan concreto»* vino a impedir.

**Y ese acto no es sólo una escritura: es una de las acciones administrativas del catálogo, y
dispara [`S13`](04-catalogos.md#trans-b-s13).** Las dos mitades son necesarias y ninguna se infiere de *«queda auditado»*:

1. **Está en el catálogo de `NUCLEO/08` §3**, en la fila del grant permanente, con lo que esa
   tabla da: **permiso propio**, registro, y **confirmación explícita** —anclar concede servicio
   gratuito permanente en una vertical nueva, o sea *«una concesión que evita un cobro»*, que es
   la primera de las tres condiciones del §1.1—. Estar en el catálogo es además lo que lo vuelve
   **una capacidad del actor** y no del sujeto (`V/17` §3.2, regla 3): sin esa entrada, los pasos
   5-7 se resolverían **sobre el beneficiario**, que por definición todavía no tiene en esa
   vertical la capacidad que se le está por conceder, y el acto sería inejecutable. Y es lo que
   hace que **un actor de sistema no lo pueda ejecutar** (`V/17` §3.3).
2. **Dispara `S13` sobre la vertical que se ancla** (`B/03` §3.2): el beneficiario queda cubierto
   ahí desde el instante del anclaje, así que **toda fila viva PRINCIPAL suya en esa vertical se
   cancela**, igual que en el otorgamiento. Sin esto el §35.3 —*«cancelar toda obligación de pago
   cubierta»*— queda incumplido **exactamente en la vertical que se acaba de regalar**, y el
   beneficiario la sigue pagando todos los meses. **Sus complementos no los cancela `S13`**: los
   addons que ya compró los conserva —es el *«conserva los dos»* del §2.4—, y el alcance de
   `S13` dice *«principal»* por esa razón (`B/03` §3.2). **Lo que sí les pasa, si el grant lleva
   `includesAddons: true`, es que los compatibles se convierten a costo $0**: [`S20`](04-catalogos.md#trans-b-s20) cancela su
   suscripción de complemento y la instancia pasa a colgar del ancla, sin reembolso del período
   ya cobrado (`B/16` §3.4). Conservarlos y seguir cobrándolos no son lo mismo, y el §35.2 pide
   lo primero sin lo segundo.

**Desanclar no está declarado, y esto no lo declara.** Reducir el scope de un grant sin revocarlo
entero no es una operación de este diseño; si alguna vez se necesita, entra por el catálogo del
`NUCLEO/08` §3 con su propia fila, su confirmación y su transición —cortar servicio en una
vertical es la mitad de *«la acción administrativa más grave»*— y no como un efecto lateral de
borrar una fila.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:689, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:691, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:742

#### Un grant emite mientras está vivo, y revocarlo no borra sus anclas

**La fuente `GRANT` de una vertical existe mientras el ancla de esa vertical esté VIVA**. *Vivo*
acá tiene definición y columna: `permanent_grant.revocado_en` nulo, con el término y su inventario
de consumidores en `NUCLEO/01` §2.4 y la fila en `B/02` §2.4. **Un grant revocado no emite
ninguna fuente**, en ninguna de sus N verticales, desde el instante de la revocación.

**Hay que escribirlo acá, y la razón está tres §§ más arriba.** El §2.6 declara que *«una fuente
se emite porque un estado lo dice, y si ese estado no se puede mover el `hasta` queda en el pasado
y la fuente sigue contando para `cubierto` — una cobertura perpetua que no falla ruidosamente,
regala, y que ningún aviso muestra»*. El grant emite con `hasta: NO_VENCE` y **hasta la FASE
9-bis-4 no tenía ningún estado que se pudiera mover**: la revocación existía como acto y no como
dato. Era literalmente el caso que ese renglón nombra, sobre la única fuente del diseño que no
vence nunca, y nadie lo había leído sobre ella.

**Revocar retira las anclas como TÍTULO, no como FILAS.** Es **una** escritura sobre el
instrumento y las N anclas dejan de ser vivas a la vez —que es lo que *«una revocación sobre un
instrumento con un ancla por cada vertical»* dice—; **las filas de `permanent_grant_vertical` no
se borran**. Dos razones, y las dos son de este mismo §: `addon_instance` apunta al ancla para
saber **en qué vertical** el addon es gratis, y el barrido lee ese ancla **después** de la
revocación (`B/09` §3, cuarta comprobación); y borrarlas sería exactamente *«un efecto lateral de
borrar una fila»*, que el párrafo de arriba acaba de rechazar para el caso vecino.

**Esto no le da al grant una máquina de estados ni una ventana.** `hasta` sigue valiendo
`NO_VENCE`, y `V/15` §4.4 sigue repartiendo bien: *«vencimiento de un addon · fin de una
cortesía»* tienen ventana y *«revocación de un grant»* no — porque una revocación **no se
anticipa**, no porque no exista.

**Los tres pedazos, y ninguno inventa un modo nuevo:**

1. **Cada ancla apunta a un plan, no a una versión.** `UNIQUE(plan_id) WHERE vigente` garantiza que
   *«la vigente»* es unívoca y siempre existe, así que la referencia nunca queda sin resolver
   (§2.3). Y el plan **pertenece a la vertical del ancla**, que es la restricción que la base tiene
   que hacer cumplir: sin ella la fila mala se sigue pudiendo escribir.
2. **Lee la vigente, vendible o no.** `V/02` §2.1 ya tiene los dos modos escritos —*«la pricing lee
   la versión vigente y sólo si es vendible; una suscripción lee su versión anclada, vigente o no,
   vendible o no»*—. El grant es un híbrido: toma *«la vigente»* de la pricing y el *«vendible o
   no»* de la suscripción. **Leerlo como la pricing sería el defecto**: retirar un plan se hace
   publicando una versión no vendible ([`D13`](02-nucleo.md#inv-d13), cap. 10 §3.2), así que el día que se retira Premium
   **todos los `Free Forever` anclados a él se quedarían sin nada**. `V/10` §2 —el capítulo que se
   declara dueño de la regla de lectura— lleva esta lectura en su tabla y el enunciado que la
   admite sin excepción.
3. **El trinquete, y también es por vertical.** Seguir la vigente expone al beneficiario a que el
   plan **empeore**: una versión que reparte distinto le saca algo a quien tiene un «para siempre»,
   sin que nadie lo haya decidido para esa persona. El trinquete es un instrumento que el diseño
   **ya tiene** —el piso de `V/15` §2.5—, aplicado acá: **sigue las mejoras y no sufre los
   recortes.** Cada ancla guarda **su** piso, y se compara contra el plan **de esa misma vertical**:
   un piso único para N verticales compararía las claves de Gastronomía contra lo que otorgaba un
   plan de Alojamiento, que es el mismo cruce por otra puerta.

**Anclar no es ser.** Una suscripción ancla una versión de plan y no es un plan; el grant sigue
siendo la entidad independiente que `NUCLEO/01` §1.5 describe, con su scope, su `includesAddons` y
su firma. Lo que gana es la referencia que toda fuente tiene que tener.

**Y por qué no dejar que el grant declare su propio juego de claves**: sería una segunda forma de
declarar entitlements, que `NUCLEO/02` §1.2 prohíbe, y obligaría a mantener dos catálogos en sincronía
para siempre. Es el defecto que este programa viene a corregir.

**Beneficio operativo**: regalar algo pasa a ser **elegir un plan concreto**, y queda auditado.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:744, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:746, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:807

## 3. El aviso

```text
evento: la cobertura de (user, vertical) cambió
```

Es lo único que billing le **empuja** a verticales. Lleva qué fuente cambió y en qué dirección, y
alimenta **cuatro** cosas que ya existen en el diseño: la transición [`PB2`](04-catalogos.md#trans-v-pb2) de publicación, la lista de
invalidación del caché (cap. 02 §3.2) —que es la **misma lista** que dispara el reconciliador de
excedentes (cap. 15 §4.2), *«una lista, dos consumidores»*—, **el reloj de inactividad**, cuyo
hecho 2 es *«la cobertura se comprueba verdadera»* (`NUCLEO/01` §1.2) — un estado leído, no un
cambio detectado, a diferencia del **evento** de `PB2`, [`PB3`](04-catalogos.md#trans-v-pb3) y [`PB7`](04-catalogos.md#trans-v-pb7), que sí es un cambio— **y la
máquina de trial**, cuyos [`T2`](04-catalogos.md#trans-v-t2) y [`T5`](04-catalogos.md#trans-v-t5) disparan cuando aparece
**un título que convierte** —una fuente viva de clase `TÍTULO` que no es la del trial y que, si es
`SUSCRIPCIÓN`, trae `cobrada: sí` ([`DEC-TRIAL-010`](01-decisiones-vigentes.md#dec-trial-010))— (`V/03` §2 los ata a este mismo aviso). La cuarta faltaba, y quien implementara el emisor contra
esta lista podía no despertar al trial: la persona se suscribía y quedaba con dos títulos hasta
que el trial venciera (FASE 8 completa, `F-8CC1-011`, owner 2026-09-25).

**Y desde `DEC-TRIAL-010` hay un cambio de cobertura que no aparece ni apaga ninguna fuente, y
también lleva aviso** (owner 2026-09-25; FASE 8 completa, `F-8CA2-006`, `F-8CC1-002`): **el primer
pago acreditado de una fila**, que pasa su `cobrada` de `no` a `sí` (§2.1). `cubierto` no se mueve,
pero es el hecho que `T2`, `T5` **y [`T8`](04-catalogos.md#trans-v-t8)** esperan (FASE 9 vuelta 1, `F-8V1A2-010`); sin aviso, `T2` quedaría esperando hasta que [`T3`](04-catalogos.md#trans-v-t3) venciera
el trial. Los otros tres consumidores lo reciben como cualquier otro —recalculan y vuelven a
preguntar— y no encuentran nada que hacer. **Y el reconciliador diario de cobertura no es su red**:
no corre la máquina de trial (`V/03` §9, ⚠️ punto 3).

**El aviso es rápido; la red es el reconciliador diario de cobertura** ([`DEC-ARCH-009`](01-decisiones-vigentes.md#dec-arch-009), owner
2026-09-25; `V/03` §9). El aviso no tiene transporte durable —el outbox del núcleo es de correos—,
así que **perderlo es un caso declarado, no un incidente**, y una vez por día verticales vuelve a
preguntar por cada dueño con fichas fuera de `DRAFT`, `PURGED` **y `MODERATED`** (`F-8CA2-004`), compara con el estado de sus
fichas y, si no coinciden, corre la transición que el aviso habría disparado —`PB7`/`PB3`
republican, `PB2` despublica—, escribe el reloj (hechos 2 y 5) e invalida el caché. **No es un
quinto consumidor del aviso**: no lo escucha; es la pregunta del §2.1 hecha por calendario, y
figura en esa fila. Cubre por igual el aviso perdido, la fecha que vence sin transición (§2.6) y
cualquier camino que nadie previó, **con hasta un día de atraso**. **Y a cada partner con una clave de presencia** —la página o, desde la FASE 9 completa, el carrusel (decisión 7b); la población está en `V/03` §9— le resuelve en vivo las dos claves y, si el caché dice otra cosa, lo invalida: la presencia no tiene máquina (`V/18` §1.6, `V/03` §9; FASE 8 completa, `R13`, owner 2026-09-25). Lo que no cubre —la máquina de
trial, el dueño **sin ninguna ficha publicada** (FASE 9 completa, `B-1`), el caché sin diferencia de fichas— está declarado en el
⚠️ de ese §.

**Quién emite** (FASE 9 vuelta 1, `F-8V1C1-006`, 2026-09-26). **Emite el aviso,
después del commit de su escritura y nunca dentro de su transacción** (abajo, *«el aviso
sale después del commit»*; FASE 9 vuelta 2, `F-8V2C1-002`), **toda escritura que cambia la
respuesta del §2.1 para algún `(user, vertical)`**: que agrega o saca una fuente, o le cambia
`referencia`, `desde` (revisión del owner, 2026-09-28, C4), `hasta`, `alcance`, `objetivo`, `cobrada` o `piso`. Un addon `USER`/`GLOBAL` emite en
cada vertical compatible de su producto (§2.7). **Una fecha que vence sin transición no emite**
(§2.6): la cubre el reconciliador.

> **El censo es la regla de arriba, y no la lista de abajo** (FASE 9 vuelta 2, `F-8V2C1-003`,
> `F-8V2C1-007`, `F-8V2A2-008`). **Todo acto que cambia una fuente emite**, esté o no en la lista.
> La lista se escribió por filas y dejó afuera dos veces a quien la regla ya alcanzaba, así que es
> la auditoría de la regla y no su definición: sirve para buscar, y quien agregue un acto que
> mueve una fuente lo suma acá en el mismo commit.

**La lista auditada**, recorridas el 2026-09-27 las tablas de `B/03` §3.2, §6.1 y §8, la de `V/03`
§2 y el catálogo de `NUCLEO/08` §3, fila por fila, buscando un acto que cambie la respuesta:

- **las filas de `B/03` §3.2** cuyo `desde` y `hacia` emiten distinto según *«qué emite cada
  estado»* (§2.6), el espejo del §10.1 incluido;
- **[`P1`](04-catalogos.md#trans-b-p1)** sobre el primer pago acreditado de una fila;
- **las filas que abren, extienden o cierran una cortesía**;
- **otorgar un grant, anclarle una vertical nueva y revocarlo**, las tres escrituras de la fila
  del grant en `NUCLEO/08` §3. **El anclaje faltaba** (`F-8V2C1-003`), y es la tercera escritura
  que cambia la cobertura (`V/02` §3.2): cuando el beneficiario no tenía suscripción en esa
  vertical, [`S13`](04-catalogos.md#trans-b-s13) no mueve ninguna fila, así que sin esta línea no salía ningún aviso;
- **[`A2`](04-catalogos.md#trans-b-a2), [`A4`](04-catalogos.md#trans-b-a4), [`A5`](04-catalogos.md#trans-b-a5) y [`A6`](04-catalogos.md#trans-b-a6)**;
- ✚ **el cambio de versión de una migración de un plan retirado**, en su fecha de aplicación, por la
  cola de `B/12` §2 (revisión del owner, 2026-09-28, C15; `B/10` §3.7), **y el descenso de un
  downgrade, que viaja por la misma cola: los dos los aplica [`S38`](04-catalogos.md#trans-b-s38)** (`B/03` §3.2; revisión del
  owner, casos vecinos, 2026-09-29, caso 37; el descenso faltaba en esta lista): le cambia la `referencia` a
  la fuente `SUSCRIPCIÓN` sin cambiar el estado de la fila, así que la regla de *«`desde` y `hacia`
  emiten distinto»* no la alcanza. **[`S37`](04-catalogos.md#trans-b-s37), que muta el monto siete días antes, no emite**: el
  monto no es un campo de la fuente;
- **[`T1`](04-catalogos.md#trans-v-t1), `T2`, `T3`, [`T4`](04-catalogos.md#trans-v-t4) y `T5`**, que mueven la fuente de trial, **y [`T6`](04-catalogos.md#trans-v-t6), y `T8`**, que
  llevan de `PRE_TRIAL` a `TRIAL_CONVERTED` y con eso sacan la fuente de pre-trial
  (`F-8V2C1-007`, `F-8V2A2-008`). La que sacan es de clase `BASE`, así que hoy `cubierto` no se
  mueve y ningún consumidor pierde nada; emiten igual, porque la regla mira `fuentes` y no
  `cubierto`. **Las siete**, en las dos implementaciones (revisión del owner,
  2026-09-28, N7: [`T7`](90-retirados.md#trans-v-t7), encender la prueba de una vertical, salió; el número no se reusa).

**Lo que el recorrido descartó**: del catálogo de `NUCLEO/08` §3, el pago manual, confirmar que no
se pagó, cancelar, pausar, reanudar y cambiar de plan emiten **por su fila de `B/03`**, y asentar
un cobro hecho por fuera, por su `P1`; extender un trial es `T4`. Moderar, levantar una marca,
reembolsar, editar una ficha ajena y la postulación de Partner no cambian ninguna fuente.

**El evento no reemplaza la consulta.** El reconciliador *«no se dispara por evento: se dispara
por condición»* (cap. 15 §4.2): el aviso dice que hay que recalcular, y el recálculo vuelve a
preguntar. Un consumidor que decidiera con lo que trae el evento estaría creyéndole a un mensaje
en vez de al estado, que es el error que el capítulo 03 §10 ya prohibió para los eventos del
proveedor.

**El aviso sale después del commit** de lo que cambió la respuesta, igual que la invalidación
(`V/02` §3.2, regla 1): un aviso anterior al commit despierta a un consumidor que vuelve a
preguntar, ve el estado viejo y no hace nada (FASE 9 vuelta 1, `F-8V1C1-003`). **Y vale para cada
emisor, no sólo acá** (FASE 9 vuelta 2, `F-8V2C1-002`): la frase del censo decía *«en el mismo
acto»*, que es lo que el §3.1 tachó para su gemelo, y era lo que leía quien emite. Emitido dentro
de la transacción de `P1`, la máquina de trial relee `cobrada: no`, `T2` no dispara y el aviso ya
se consumió: el residuo del aviso perdido pasaba a ser el camino principal.

**El tercer consumidor es el que más caro paga esa regla, y por eso se dice acá y no sólo allá.**
El reloj de inactividad decide **borrar** —el hard delete del día 180 (`V/02` §4.1)—, así que su
hecho 2 se resuelve **preguntando `cubierto` en la respuesta del §2.1**, nunca leyéndolo del aviso,
y el instante se escribe en `listing.inactiva_desde` (`V/02` §2.5). Y como un push se puede perder,
**los TRES actos que avanzan sobre ese reloj vuelven a preguntar en el momento de ejecutar**:
**las tres filas del reloj**
de `V/03` §9 —[`PB4`](04-catalogos.md#trans-v-pb4), [`PB5`](04-catalogos.md#trans-v-pb5) y **[`PB9`](04-catalogos.md#trans-v-pb9)**, el hard delete del día 180 (`V/02` §4.1 y §4.2 regla 4),
que es el único irreversible— (FASE 9 completa, `K-1`: desde la FASE 8 completa el hard delete es
una fila). El aviso perdido cuesta un
retraso en el reinicio, jamás un archivado —ni un borrado— sobre alguien que ya volvió.
**Y la relectura no restituye**: reinicia el reloj y deja la ficha donde está, así que hasta la
FASE 8 completa el aviso perdido de la vuelta dejaba la ficha de un cliente que paga abajo para
siempre. **La republica el reconciliador diario, al día siguiente** (`F-8CA2-002`, `F-8CC1-005`,
`DEC-ARCH-009`).

**Y desde la FASE 8 completa el reloj recibe del mismo evento un segundo hecho, y ése sí cuelga del
cambio** (`F-8CA2-001`, owner 2026-09-25). Cuando `PB2` baja una ficha porque `cubierto` pasó a
falso, escribe el instante de la caída en `listing.inactiva_desde`: es el **hecho 5** del
`NUCLEO/01` §1.2, **que es del dueño y no de la ficha** —*«el dueño pierde la cobertura en la
vertical»*— **y se escribe en toda ficha suya en esa vertical**; a las que no estaban publicadas,
que `PB2` no toca, se lo escribe **el recálculo que este mismo aviso despierta**, sin transición
(FASE 8 completa, owner 2026-09-25). No contradice la regla de arriba —`PB2` es una transición, y una transición se
dispara por un cambio—, pero tiene la debilidad que la regla vino a tapar para el hecho 2: **si el
aviso de la caída se pierde, ni `PB2` dispara ni el recálculo corre, y
ese día nadie escribe el hecho 5.** Lo escribe el reconciliador diario de cobertura
al día siguiente** (`DEC-ARCH-009`, `V/03` §9): encuentra la ficha publicada sin cobertura, corre
`PB2` y escribe el hecho 5 en todas las fichas del dueño en la vertical, en el mismo acto. **Queda
sin red el dueño sin ninguna ficha publicada** —el que sólo tiene
borradores, que no está en su población, y el que tiene todas sus fichas en
`UNPUBLISHED_BY_BILLING`, `ARCHIVED` o `MODERATED`, que sí está—: ninguno tiene ficha
publicada que delate la diferencia (declarado en el ⚠️ de `V/03` §9; FASE 9 completa, `B-1`). **Y el recálculo tiene una
segunda**: sobre una ficha no publicada no hay estado que
recuerde que antes había cobertura, así que distinguir la relectura en falso que sigue a la caída
de la que sigue a un aviso repetido no está escrito.
**Ésa la aceptó el owner** (`NUCLEO/01` §1.2, ⚠️ punto 3), y es la que obliga al
reconciliador a escribir el hecho 5 **sólo** junto con `PB2`: con un disparo diario, escribirlo cada
vez que relee falso correría el reloj todos los días.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:809, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:811, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:953

### 3.1 El empuje inverso: la ficha llegó a `PURGED`

FASE 9 vuelta 1, `F-8V1A3-003`, `F-8V1C1-001`; owner 2026-09-26, `G2-1` (contra la recomendación:
el owner no acepta ni un cobro de más).

```text
evento: la ficha F llegó a PURGED
```

**Es lo único que verticales le empuja a billing.** Lo emite verticales
**en el mismo acto de [`PB9`](04-catalogos.md#trans-v-pb9) o de [`PB12`](04-catalogos.md#trans-v-pb12), DESPUÉS de su commit y nunca dentro de
su transacción** (FASE 9 vuelta 1, `N-G2V-01`/`N-G4V-05`) (`V/03` §9) —las dos únicas filas que
llegan a `PURGED`— y lleva sólo el id de la ficha. Su único consumidor es [`A6`](04-catalogos.md#trans-b-a6) (`B/03` §8), que desde `K-9` es la única fila que cancela un
addon `LISTING` cuando se borra su ficha: al recibirlo, billing busca las instancias **en
uno de sus dos estados vivos —`PENDING_AUTHORIZATION` o `ACTIVE`, la enumeración de la fila 18 de
`NUCLEO/01` §2— (FASE 9 vuelta 1, `N-G2V-03`)** de scope
`LISTING` con ese `objetivo` y corre `A6` sobre cada una **en ese momento, no en el barrido del día
siguiente**.

**Por qué después del commit, y no «en el mismo acto» a secas** (FASE 9 vuelta 1, `N-G2V-01` y
`N-G4V-05`, dos verificadores que lo encontraron sin verse). Es la regla del aviso (§3, *«el aviso
sale después del commit»*) aplicada a su gemelo: un evento cuyo consumidor relee antes de actuar.
Emitido dentro de la transacción de `PB12`, el empuje llega a `A6` cuando el `PURGED` todavía no
está commiteado; `A6` relee `fichaPurgada`, lee `no`, no cancela, y el empuje ya se consumió. Eso
no pasaba de vez en cuando sino **en todo borrado**: el camino principal caía entero a la red del
barrido, que es la opción 1 de `G2-1` que el owner rechazó. Con el orden fijado, un empuje que sale
llega con el `PURGED` ya visible; y el que no sale —el proceso se cae entre el commit y la emisión—
es el empuje perdido de abajo, con su red. Existe para eso: con sólo la consulta, el cobro mensual de un destaque que cayera
entre el borrado y el barrido entraba.

**No se le cree, igual que al aviso** (*«el evento no reemplaza la consulta»*, arriba): `A6` corre
porque la ficha está en `PURGED`, y lo relee con la consulta `fichaPurgada` del §4.1 antes de
cancelar. **Y no tiene transporte durable** —el outbox del núcleo es de correos, igual que para el
aviso—, así que **perderlo es un caso declarado: la red es la misma consulta `fichaPurgada`, leída
por el barrido diario de billing** por cada instancia viva de scope `LISTING` (`B/09` §3). Con el
empuje perdido vuelve el día de atraso, y con él el cobro que el empuje venía a evitar; lo mismo
para un borrado que no pasa por `PB9` ni por `PB12`
**—desde `G5-2` el admin no tiene ninguno (`NUCLEO/08` §3: *«ningún borrado de ficha sale de otra
fila que `PB9` o `PB12`»*); el que queda es el borrado de la cuenta pedido por el propio usuario,
fuera de esta épica y hecho a mano por soporte con una lista
de pasos (revisión del owner, 2026-09-28, N7, `g1`; `NUCLEO/08` §1, [HOS-1393](https://linear.app/hospeda-beta/issue/HOS-1393)), que borra la fila de la ficha sin pasar por ninguna de las dos
(FASE 9 vuelta 1, §4 punto 1 de `22-verificado-G2`)—**, que
no empuja nada, y la red lo alcanza porque `fichaPurgada` contesta `sí` también cuando la fila no
existe. Está declarado en el NO cierra de `B/16` y en el ⚠️ de `V/03` §9 (punto 8). **Y desde la
FASE 5 ese borrado tampoco queda** (owner 2026-09-30, lote 3 C): la baja manual corre `PB12` por
cada ficha (`NUCLEO/08` §1.3, paso 2), las puertas de borrado y restauración que el código de hoy
tiene fuera del diseño se retiran, y desaparece el borrado físico de fichas y de cuentas. La red
por `fichaPurgada` queda igual, para la fila que falte por la causa que sea.

**No es un quinto consumidor del aviso ni lo reemplaza**: son dos eventos distintos, en
direcciones opuestas, y ninguno lleva el dato del otro. Lo emiten las dueñas de las dos filas —V6 el
de `PB12`, `V9b` el de `PB9`—, y la consulta la construye V6 (`V/descomposicion.md` §2).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:955, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:957, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1008

## 4. Lo que NO cruza la frontera

Declarado en positivo, porque es la mitad del valor de tener un contrato:

**No cruzan** montos, precios, monedas, ciclos, estados de pago, ids del proveedor, fechas de
cobro, medios de pago, comprobantes ni reembolsos.

**Sobre cobros cruza un solo bit, y es declarado**: `cobrada`, *«esta fila ya tiene al menos un pago
acreditado»* (§2.1; [`DEC-TRIAL-010`](01-decisiones-vigentes.md#dec-trial-010), owner 2026-09-25). No dice cuándo, cuánto, cuántos ni cómo
terminó ningún intento, y viaja sólo dentro de una fuente `SUSCRIPCIÓN` que ya se emite. Su único
consumidor es **la máquina de trial** (`V/03`
§2): [`T2`](04-catalogos.md#trans-v-t2) y [`T5`](04-catalogos.md#trans-v-t5), **y desde la FASE 9 completa [`T6`](04-catalogos.md#trans-v-t6) y [`T8`](04-catalogos.md#trans-v-t8)** (decisión 6c).

**Ya no cruza ninguna fecha de una vertical** (revisión del owner, 2026-09-28, C8): las
verticales no se discontinúan y la pregunta `finDeServicio` salió del §4.1.

**Y cruza un instante que no es de cobro: `desde`**, el de la fuente que empezó a cubrir
(revisión del owner, 2026-09-28, C4; §2). Es el alta de la fuente, no la de ningún pago: no dice
cuándo se cobró ni si se cobró, y una suscripción que todavía no cobró lo trae igual. Lo lee sólo
la ventana de la cuota mensual (`V/15` §7), que lo necesita porque la cuota se renueva en la
fecha del ciclo de cada persona y verticales no tenía otra forma de saber cuándo arrancó una
suscripción.

Cuatro ausencias que parecen faltas y son decisiones:

- **El estado exacto de la suscripción no cruza.** Verticales no distingue `ACTIVE` de
  `GRACE_PERIOD`: el §20 y el §21 dicen que durante el grace **el servicio sigue**, así que los dos
  cubren y la diferencia es de billing. Pasarla sería invitar a que alguien escriba una regla de
  producto sobre un estado de cobranza.

  **Y la consecuencia obliga en la dirección que nadie miró: una regla de verticales que se
  condicione sobre un estado de suscripción no es una regla laxa, es una regla que no se puede
  evaluar.** Tres condiciones de la máquina de trial estaban escritas así —*«se autoriza una
  suscripción»*, *«no hay suscripción autorizada»*, *«ya hay una suscripción viva»*— y las tres se
  reescribieron sobre `cubierto` y sobre la clase de las fuentes (`V/03` §2). El guard es
  [`G-R4-B`](04-catalogos.md#guard-g-r4-b) (`V/20` §2). **Lo que esta prohibición cuesta también se declara**: los tres estados
  que no emiten fuente (§2.6) son **indistinguibles de no tener nada** desde el otro lado, y hay
  una regla de producto —a quién le corresponde un trial— donde esa diferencia importaría. **El
  owner decidió pagar ese precio y NO agregar el segundo hecho** ([`DEC-TRIAL-008`](01-decisiones-vigentes.md#dec-trial-008), 2026-09-21):
  el bit que separaría los tres estados es un estado de cobranza con otro nombre, y su costo real
  —que alguien `SUSPENDED` por impago reciba su único trial de por vida en una vertical donde
  nunca publicó— está acotado por `T2`, [`T3`](04-catalogos.md#trans-v-t3) y [`PB2`](04-catalogos.md#trans-v-pb2). El desarrollo está en `V/03` §2. **Esta
  frontera no se vuelve a abrir por este caso. Se abre, lo mínimo, por otro** (revisión del
  owner, 2026-09-28, C14, `L1-c`): la pausa pedida por el dueño detiene el reloj de retención, y
  eso cruza como **una pregunta aparte, `retenciónDetenida`** (§4.1), que no va en `fuentes` ni
  en `cubierto`. La máquina de trial no la lee, así que lo que esta decisión protegía (que nadie
  escriba una regla de producto sobre la cobranza) queda intacto: sus únicos lectores son
  archivar, borrar y los avisos de retención. **Y se abre por otro más** (verificación corta, 2026-09-29, lote M-F): dar de baja una cuenta necesita saber si le queda algo que la pueda cobrar, y eso cruza como otra pregunta aparte, **`puedeCobrarle`** (§4.1), un sí o no sobre la cuenta entera, sin estado, con un solo lector, la acción 24.
- **Tampoco cruza el estado de la instancia de addon**, y por el mismo motivo: `EXPIRED` y
  `CANCELLED` son de billing, y lo único que verticales necesita saber es si la fuente está en la
  lista.
- **El precio del plan no cruza**, aunque la `versiónDePlan` sí. Es exactamente el corte de
  [`DEC-ARCH-005`](01-decisiones-vigentes.md#dec-arch-005): `plan_version` es de verticales, `billing_option` es de billing.
- **No cruzan los valores de lo que otorga una fuente** — ni los del plan, ni los del addon, ni los
  de un grant. Sólo la referencia. Es el §2.3 extendido a las seis fuentes.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1010, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1012, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1068

### 4.1 La dirección inversa, declarada

El §4 enumera con cuidado lo que billing **empuja** a verticales, y **nunca declaró lo que billing
LEE**. Ése resultó ser el acoplamiento real entre las dos épicas, con un agravante medido: **dos de
las columnas que billing lee no existen**. Hoy billing lee tablas de verticales sin contrato que lo
regule, que es exactamente el acoplamiento que el corte en dos épicas venía a impedir.

```text
políticaDePlan(versiónDePlan)  → { díasDeGrace, permitePausa, vigente, vendible }
direcciónDeCambio(versiónOrigen, versiónDestino) → SUBE | BAJA
fichaPurgada(ficha)            → sí | no
ficha(idDeFicha)               → { vertical, dueño, admiteDestaque }
políticaDeAddon(versiónDeAddon) → { addon, vigencia, díasDeVigencia, tipoDeScope }
extenderTrial(user, vertical, días, claveDeCanje) → ACEPTADA | RECHAZADA(motivo)
retenciónDetenida(user, vertical) → { detenida: sí | no, pausaTerminadaEn: instante | NINGUNO,
                                     coberturaPerdidaEn: instante | NINGUNO }   ← de ida: pregunta verticales, contesta billing
puedeCobrarle(user)            → sí | no   ← de ida: pregunta verticales, contesta billing
```

**`situaciónDeVertical` y `finDeServicio` no están en la firma** (revisión del owner, 2026-09-28,
C8: las verticales no se discontinúan). **El contrato es que billing empuja avisos y lee política,
y verticales le pregunta dos cosas, `retenciónDetenida` y `puedeCobrarle`** (revisión del owner,
2026-09-28, C14; verificación corta, 2026-09-29, lote M-F; abajo). **`retenciónDetenida` no contesta
un sí o no**: devuelve también cuándo terminó la última pausa (revisión del owner, casos vecinos, 2026-09-29, caso F-A, abajo), **y desde la FASE 9 vuelta 3 cuándo perdió la cobertura por última vez** (FASE 9 vuelta 3, owner 2026-09-30, lote Q, abajo). **Siguen siendo ocho entradas**: es un campo más de una pregunta que ya existía.

**`retenciónDetenida` es una pregunta de la dirección de ida, y entra por la pausa** (revisión del
owner, 2026-09-28, C14, `L1-c`). Contesta `sí` **sólo** mientras la persona tiene en esa vertical
una suscripción `PAUSED` con motivo `CUSTOMER_REQUEST`, y `no` en cualquier otro caso (una pausa
por `COURTESY` no la detiene: esa fila cubre). **Sus únicos lectores son archivar ([`PB4`](04-catalogos.md#trans-v-pb4) y [`PB5`](04-catalogos.md#trans-v-pb5)),
borrar ([`PB9`](04-catalogos.md#trans-v-pb9)) y los avisos de retención** (`NUCLEO/07` §6), que la releen en el momento de
ejecutar, igual que `cubierto`: con `sí` no archivan, no borran y no avisan. **No va en `fuentes`
ni en `cubierto`**: la máquina de trial, la publicación y el paso 5 no la ven, así que
[`DEC-TRIAL-008`](01-decisiones-vigentes.md#dec-trial-008) queda intacta en lo que protegía (§4). **No cambia el reloj ni lo congela**: la
pausa no escribe nada en verticales, y al reanudar la fila vuelve a emitir, `cubierto` pasa a
verdadero y el hecho 2 reinicia el reloj (`NUCLEO/01` §1.2), que es el *«al volver se reinicia»*
del owner. **Y todo fin de la pausa, por cualquier camino, reinicia el reloj** (revisión del owner,
casos vecinos, 2026-09-29, caso 12): también la baja desde la pausa ([`S22`](04-catalogos.md#trans-b-s22)) o cualquier otra
salida que no vuelva a cubrir. Sin eso `retenciónDetenida` pasaba a `no` y `PB4` y `PB9` corrían al
día siguiente sobre fichas con el reloj arrancado en el hecho 5 del primer día de la pausa, con
más de 180 días. **Ese reinicio no se escribe** (revisión del owner, casos vecinos, 2026-09-29, caso F-A):
**`retenciónDetenida` devuelve también `pausaTerminadaEn`, cuándo terminó la última pausa por
`CUSTOMER_REQUEST` de la persona en esa vertical** (el `fin_real` de su `subscription_pause`,
`B/02` §2.2, o `NINGUNO` si nunca tuvo una), **y sus lectores cuentan desde el más tardío de dos
instantes, `listing.inactiva_desde` y ése** (**y `PB9`, además, desde `coberturaPerdidaEn`, el más tardío de los tres**: FASE 9 vuelta 3, owner 2026-09-30, lote Q), **con la versión de plazos que guarda la ficha**
(`listing.plazos_version`, la de su último hecho), porque el reinicio no escribe otra (revisión del owner, casos vecinos, 2026-09-29, caso H-E). La pausa sigue sin escribir nada en verticales, la
lista de hechos del reloj no cambia y [`G-R6-B`](04-catalogos.md#guard-g-r6-b) tampoco. **Y una pausa vencida cuya reanudación no
se aplicó no deja el reloj detenido sin que nadie lo vea**: la fila sigue `PAUSED`, así que la
respuesta sigue siendo `detenida: sí`, pero el barrido diario de billing la marca para resolver a
mano con `REANUDACIÓN_NO_APLICADA` (`B/09` §3, la quinta comprobación; `B/02` §2.5, motivo 8), que
ya existía y no es un motivo nuevo. Como los lectores preguntan al ejecutar, no hay aviso que perder. **La construye [`B4`](10-corte/B4.md#pieza-b4)**
en la real (lee `subscription_pause`, `B/02`) y **[`V4`](10-corte/V4.md#pieza-v4)** en la de arranque, que contesta `no`
(§5.1); la consumen [`V9b`](20-fase-1/V9b.md#pieza-v9b) (archivar, borrar) y los avisos de retención. Reemplaza la desigualdad
que antes sostenía la pausa contra el borrado ([`D16`](90-retirados.md#inv-d16), `G-R5`), que sale.

**`coberturaPerdidaEn` es el dato que impide que el borrado se adelante a un aviso atrasado** (FASE 9 vuelta 3, owner 2026-09-30, lote Q; `F-8V3A2-006`). Es el instante en que `cubierto` pasó por última vez de `sí` a `no` para esa persona en esa vertical, o `NINGUNO` si nunca pasó. **La implementación real lo guarda en la misma transacción que encola el aviso de esa caída** (§3), así que la pregunta lo contesta aunque el aviso todavía no haya llegado: es lo que el aviso atrasado no puede dar. **Su único lector es `PB9`** (`V/03` §9), que cuenta el plazo de borrado desde el más tardío de tres instantes, `listing.inactiva_desde`, `pausaTerminadaEn` y éste. Sobre una ficha no publicada cuyo hecho 5 todavía no escribió el recálculo, el reloj viejo pierde contra este instante y `PB9` no borra. **`PB4`, `PB5` y los avisos de retención no lo leen**: la decisión es sobre el borrado, que es lo único irreversible. **Con `NINGUNO`, `PB9` no borra en la misma pasada en que ve por primera vez la ficha vencida y sin cobertura** (`V/03` §9): es la regla mientras el dato no exista, y también la de la implementación de arranque, que contesta `NINGUNO` (§5.1). La construye `B4` en la real y `V4` en la de arranque; la consume `V9b`.

**`puedeCobrarle` es la otra pregunta de la dirección de ida, y entra por la baja de una cuenta** (verificación corta, 2026-09-29, lotes M-F y M-G). Contesta `sí` si a la cuenta, en cualquier vertical, le queda **una autorización que todavía puede cobrar**: una suscripción, principal o de complemento, en `PENDING_AUTHORIZATION`, `ACTIVE`, `GRACE_PERIOD`, `PAUSED` o `SUSPENDED`, que son las filas vivas (`NUCLEO/01` §2.4) **menos `CANCEL_SCHEDULED`, que tiene su propia regla abajo; o una `CANCEL_SCHEDULED` o una fila terminal cuyo preapproval canceló una llamada nuestra que ninguna relectura vio todavía `cancelled`** (FASE 9 vuelta 3, owner 2026-09-30, lote D); **o una fila terminal cuyo preapproval canceló el proveedor tras un cobro rechazado** (la `CHARGE_DECLINED` de [`S16`](04-catalogos.md#trans-b-s16) que no mandó llamada, o la `CANCELLED` del espejo tras un rechazo) **mientras no haya pasado el plazo 16 de `NUCLEO/02` §1.5, la ventana de relectura de la cancelación por rechazo (7 días), desde la primera relectura que lo vio `cancelled`** (FASE 9 vuelta 3, owner 2026-09-30, lote AE; verificación, VC3-cobro-02): es la población que el barrido todavía no suelta, porque el proveedor puede deshacer esa cancelación ([`EX-45`](04-catalogos.md#mp-ex-45); `B/09` §3, criterio de exención); **o una marca `CANCELACIÓN_SIN_CONFIRMAR` abierta** sobre una suscripción suya (`B/02` §2.5), porque su cancelación en el proveedor no se confirmó y el preapproval todavía puede cobrar (verificación corta, 2026-09-29, lote N-C); y `no` en cualquier otro caso. **Contesta sobre la cancelación confirmada por Mercado Pago, no sobre el estado de la fila** (FASE 9 vuelta 3, owner 2026-09-30, lote D; [`DEC-ARCH-006`](01-decisiones-vigentes.md#dec-arch-006), 📌): el estado de la fila dice que decidimos cancelar, y no que el proveedor lo aplicó. [`S11`](04-catalogos.md#trans-b-s11) manda la cancelación en el acto, pero si el correo previo o la llamada fallan de forma transitoria el barrido la reintenta hasta 3 días con el preapproval `authorized`, y recién ahí abre la marca (`B/03` §3.2, *«el correo antes de cancelar»*; `B/09` §3, salvedades 1 y 4); lo mismo vale para una fila terminal a la que llevó una transición nuestra *«pase lo que pase con la llamada»*. **Una suscripción deja de contar cuando una relectura de su preapproval lo ve `cancelled`**, que es lo mismo con que el barrido la saca de esas salvedades. **Salvo la que canceló el proveedor tras un cobro rechazado, que deja de contar cuando pasa el plazo 16 desde esa relectura con el preapproval todavía `cancelled`**, que es lo mismo con que el barrido la da por exenta: con eso `puedeCobrarle` no suelta nada que el barrido todavía relea (FASE 9 vuelta 3, owner 2026-09-30, lote AE). **Mientras no esté confirmada, contesta `sí` y la acción 24 espera**: hasta que el barrido la confirme o, pasados los 3 días, abra la marca, con la que sigue contestando `sí` hasta que una persona la resuelva. **Y sobre la que canceló el proveedor tras un rechazo, la acción 24 espera hasta 7 días**, los del plazo 16 (FASE 9 vuelta 3, owner 2026-09-30, lote AE). **El dato es `provider_link.cancelado_visto_en`**, el instante de la primera relectura que vio el preapproval `cancelled`, el mismo que el barrido lee para saber qué fila sigue en las salvedades 1 y 4; una relectura que lo vuelve a ver vivo lo vacía, y la suscripción vuelve a contar (`B/02` §2.2, `B/09` §3; FASE 9 vuelta 3, owner 2026-09-30, lote Z). **Contesta sobre la cuenta entera y sin estado**: un sí o no, con la forma de `fichaPurgada`, así que el estado exacto de la suscripción sigue sin cruzar (§4). **Su único lector es la acción 24, *«dar de baja una cuenta a pedido de su dueño»*** (`NUCLEO/08` §3), que es de verticales ([`V8a`](10-corte/V8a.md#pieza-v8a)) y se rechaza con `sí`: sin esta pregunta, la precondición de la 24 se condicionaba sobre una fila viva, que ninguna regla de verticales puede evaluar (`NUCLEO/01` §2.4, regla 1). **La construye `B4`** en la real, y **`V4`** en la de arranque, que contesta `no`, porque sin billing no hay suscripción (§5.1); la consume `V8a`. **Entra al inventario de consumidores de *«fila viva»*** (`NUCLEO/01` §2.4, fila 27), del lado de billing, que es donde se evalúa, y lo vigila [`G-R1-E`](04-catalogos.md#guard-g-r1-e) (`B/20` §2). **Y al de *«marca abierta»*** (`NUCLEO/01` §2.5, fila 12), por su mitad de la marca, que vigila [`G-R1-F`](04-catalogos.md#guard-g-r1-f) (FASE 9 vuelta 3, F-8V3C1-004, F-8V3D1-002).

**`díasDeTrial` salió de `políticaDePlan` el 2026-09-26** (FASE 9 vuelta 1, `F-8V1C1-015`; la
firma decía `{ díasDeGrace, díasDeTrial, permitePausa, vigente, vendible }`): ningún capítulo de
billing lo lee, y su único consumidor —la máquina de trial— lo lee de su propia tabla, del lado de
verticales. Un campo declarado sin lector es un campo que alguien construye para nadie. **Y las
tres últimas firmas entraron el mismo día** (owner 2026-09-26, `G4-2`, opción 2: lo que decide
entra acá; lo que sólo muestra va a la capa de composición, abajo).

> **El contrato tiene dos direcciones. La inversa transporta política, estado de catálogo y un**
> **único hecho de instancia —que una ficha ya no existe, empujado (§3.1) y consultado**
> **(`fichaPurgada`)—** (FASE 9 vuelta 1; owner
> 2026-09-26, `G2-1`)**, la pertenencia de una ficha (`ficha`) y una sola escritura —la extensión**
> **de un trial, que verticales acepta o rechaza (`extenderTrial`)—; nunca capacidades** (owner
> 2026-09-26, `G4-2`)**: verticales no le dice a billing qué otorga un plan, le dice cómo se comporta.**
> **Y la de ida son dos preguntas que billing contesta, `retenciónDetenida` y `puedeCobrarle`** (verificación corta, 2026-09-29, lote M-F) (revisión del
> owner, 2026-09-28, C14).

**Y una pregunta que no es de catálogo: `fichaPurgada`** (FASE 9 vuelta 1; owner 2026-09-26,
`G2-1`). Contesta `sí` si la ficha está en `PURGED` o su fila no existe, y `no` en cualquier otro
estado. Es el único estado de instancia que billing lee, y lo lee porque [`A6`](04-catalogos.md#trans-b-a6) —la única fila que
cancela un addon `LISTING` al borrarse su ficha (`K-9`)— espera un hecho de verticales. **El hecho
llega empujado** (§3.1), y esta consulta es **su red**: el barrido diario de billing la pregunta por
cada instancia viva de scope `LISTING` y, si da `sí`, corre `A6` (`B/09` §3); y `A6` la relee antes
de cancelar, así que el empuje no se cree solo. `PURGED` es final, así que la pregunta contesta lo
mismo tarde que temprano: lo que cuesta un empuje perdido es el día de atraso, no una respuesta
equivocada. La incluye la fila inexistente a propósito, para que un borrado que no pasa por `PB9`
ni por [`PB12`](04-catalogos.md#trans-v-pb12) también apague el addon. **La construye V6, dueña de `PB12`**, no [`V2`](10-corte/V2.md#pieza-v2): no es una
columna de `V/02` §2.1 sino el estado de la ficha.

**Y lo que decide un addon o un canje: `ficha`, `políticaDeAddon` y `extenderTrial`** (FASE 9
vuelta 1, `F-8V1A3-008`, `F-8V1C1-008`, `F-8V1C1-009`; owner 2026-09-26, `G4-2`). **`ficha` y
`políticaDeAddon` son pertenencia y política**: de una ficha, billing sabe a qué vertical pertenece
y de quién es —lo que [`A1`](04-catalogos.md#trans-b-a1) necesita para validar el objetivo de un addon `LISTING`, y la precisión
6 del cap. 17 manda leer del recurso—, nunca su estado (ése es sólo `fichaPurgada`) **—salvo un sí o no: `admiteDestaque`, si la ficha está en un estado que acepta un addon `LISTING`, que hoy es *«ni `PURGED` ni `MODERATED`»* y lo define verticales, no billing. `A1` lo exige y la firma decía *«nunca su estado»*: sin el campo, `A1` leía la tabla de verticales —la filtración que el §4.2 vigila— o no lo miraba y vendía un destaque que no se ve y que por `G2-3` se sigue cobrando. Devuelve la respuesta y no el estado, con la misma forma que `fichaPurgada` (FASE 9 vuelta 1, `N-G4V-06`; es lo que decide, así que entra acá por `G4-2`)—**; de un addon,
cómo se comporta —cuándo termina la instancia, sobre qué se puede aplicar y de qué `addon` es
versión—, nunca qué otorga. **`extenderTrial` es la única escritura de billing en verticales**: el
canje de una extensión de trial le pide a verticales que corra [`T4`](04-catalogos.md#trans-v-t4), y verticales contesta con el
techo ya aplicado (`V/11` §3) y dentro del lock de la máquina de trial, así que [`T3`](04-catalogos.md#trans-v-t3) y el canje no
se pisan. Billing asienta el canje sólo con `ACEPTADA`; la clave de canje hace idempotente el
reintento. **La guarda verticales, que es quien ejecuta**: la escribe en la misma transacción de
`T4` que aplica la extensión, y a un reintento con una clave ya aplicada contesta `ACEPTADA` sin
volver a correr `T4` (FASE 9 vuelta 3, F-8V3C1-003). La tabla es
`canje_de_trial`, de `V/02` §2.2 (FASE 9 vuelta 3, F-8V3C1-003), y la construye `V4`;
el juego de la dirección inversa (§6.2) trae el caso que reintenta la misma clave.
Las construyen `V2` (`políticaDeAddon`: `addon_version` es de `V/02` §2.1), [`V6`](10-corte/V6.md#pieza-v6)
(`ficha`: es de la ficha, como `fichaPurgada`) y `V4` (la operación, dueña de la máquina de
trial); las consumen [`B10`](20-fase-3/B10.md#pieza-b10) (`A1`) y [`B9b`](20-fase-2/B9b.md#pieza-b9b) (el canje).

**Y publicar una versión de addon cruza por `políticaDeAddon`, sin entrada nueva** (FASE 9 vuelta
3, F-8V3C1-007). Publicar es crear la `addon_version` (lo que otorga, de verticales, `V/02` §2.1) y
re-apuntar `addon_product.version_id` (de billing). Es la acción 20 de `NUCLEO/08` §3, *«publicar
una versión de complemento»*, y escribe en las dos épicas, así que entra en la segunda mitad de la
regla de vigilancia (§4.2) como cualquier escritura. **Cada mitad escribe en la suya**: verticales
crea la versión, y billing re-apunta el producto con un acto propio que recibe el id de la versión
y lo valida con `políticaDeAddon` (que sea versión de ese addon) antes de escribir. Nada escribe en
la otra épica ni lee sus tablas: la única lectura es la pregunta ya declarada. La pantalla es una,
compuesta en la app del panel, como la de plazos (`NUCLEO/02` §1.5). Una versión creada y no
apuntada no la vende nadie, y ninguna instancia comprada cambia: queda anclada a la suya.

> **Las superficies no pasan por acá** (owner 2026-09-26, `G4-2`). La pricing, Mi Suscripción y el
> botón de suscribirse son una **capa de composición**: muestran lo que cada épica resolvió leyendo
> sus consultas públicas —el catálogo vendible y su presentación, el conjunto efectivo del paso 6,
> el predicado del botón (`V/19` §4 fila 23)—, y no deciden nada (`V/19` §1). Por eso pueden leer
> capacidades sin que eso sea una filtración: la regla de vigilancia del §4.2 vigila a las
> **máquinas, guards y barridos** de billing, que son los que deciden. **Si una superficie alguna
> vez decide algo, deja de ser superficie y su lectura entra a este §.**

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1070, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1072, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1207

#### La tercera pregunta: subir o bajar lo contesta verticales

**Es la que faltaba, y su ausencia era el acoplamiento más caro de los dos lados.** La regla que
decide **cuándo se cobra** un cambio de plan está en `B/10` §3.5 y decía, textual (hasta
la FASE 8 completa, `F-8CC1-013`, que lo alineó con el veredicto), que *«la dirección
se deriva del delta entre las dos versiones, **no del `rank`**»* — *«si algo baja, un limit, un
entitlement, una cuota, sigue el camino de downgrade; si nada baja, el de upgrade»*, y **cualquier
baja manda**.

Comparar eso es **leer `plan_version_entitlement` y `plan_version_limit` de las dos versiones**, y
las dos tablas son de verticales. O sea: la única regla que decide **qué se le cobra a alguien y qué
día** exigía que billing leyera exactamente lo que el §4 prohíbe cruzar, dos veces, por escrito.

> **La comparación la hace verticales, que es dueño de las tablas, y billing recibe un VEREDICTO.**

**Un veredicto no es una capacidad**, y por eso esto no debilita la regla de la dirección inversa:
`SUBE`/`BAJA` es una propiedad de **la relación entre dos versiones**, no un valor de ninguna de
las dos. Verticales sigue sin decirle a billing **qué otorga** un plan; le dice **cómo se
comportan dos planes entre sí**, que es la misma clase de dato que `permitePausa`.

**Las dos alternativas, y por qué no**: derivar la dirección del `rank` es barato y **el diseño ya
lo rechazó por escrito** —un plan más caro puede bajar un límite al rediseñarse, y entonces al
cliente **se le recorta algo en silencio mientras se le cobra como mejora**; y un plan retirado no
tiene `rank` comparable, que es el caso donde el
`rank` ni siquiera contesta—. **El veredicto rige TODO cambio de plan, no sólo el del plan
retirado**: el primer motivo —el rediseño que baja un límite— es sobre dos planes vendibles con
`rank`, así que *«el único caso»* contradecía la frase que lo precedía (FASE 8 completa,
`F-8CD1-003`; [`DEC-ARCH-008`](01-decisiones-vigentes.md#dec-arch-008)). Y dejar que billing lea
las dos tablas es **el acoplamiento exacto que partir el programa en dos épicas venía a impedir**:
sería la primera excepción declarada al corte, y la regla de vigilancia del §4.2 se dispara con
ella.

Eso conserva el corte de [`DEC-ARCH-005`](01-decisiones-vigentes.md#dec-arch-005) sin excepción: los entitlements y los limits siguen sin
cruzar hacia billing, igual que los montos siguen sin cruzar hacia verticales.

**Son ocho entradas: siete preguntas y una operación** (revisión del owner, 2026-09-28, C14: entra
`retenciónDetenida`; verificación corta, 2026-09-29, lote M-F: entra `puedeCobrarle`) —**catorce**
campos en **cuatro** consultas (cuatro de `políticaDePlan`, tres de `ficha`, cuatro de
`políticaDeAddon` y tres de `retenciónDetenida`, la de ida, que contesta billing; con
`coberturaPerdidaEn`, FASE 9 vuelta 3, owner 2026-09-30, lote Q; verificación, VC3-VT-06), un
veredicto (`direcciónDeCambio`), **dos sí o no, `fichaPurgada` y `puedeCobrarle`** (la de ida, que
contesta billing; verificación corta, 2026-09-29, lote M-F) y la escritura `extenderTrial`—, **y de
los campos de `políticaDePlan`, los dos últimos son los que importa declarar** (FASE 9 vuelta 1:
`díasDeTrial` salió, `F-8V1C1-015`; `fichaPurgada` entró por `G2-1`; `ficha`, `políticaDeAddon` y
`extenderTrial` por `G4-2`; **`admiteDestaque`, el tercer campo de `ficha`, por `N-G4V-06`**). `vigente`/`vendible` no estaba en la
cuenta original: salió de recorrer el dominio, y **era la diferencia entre que el acoplamiento se
cortara o siguiera llegando**. Sin declararlo se pierde de vista, y el día que billing lea una
columna que verticales cambió nadie se entera hasta que rompe.

**Ninguna columna que esto obligue a crear** (revisión del owner,
2026-09-28, C8): `vertical.admite_altas` sólo la escribía el acto de discontinuar, y sale con él.
**Y desde la FASE 9
vuelta 1 [`S1`](04-catalogos.md#trans-b-s1) lee `vigente`/`vendible`** (el *«también»* se fue con `admiteAltas`, revisión del
owner, 2026-09-28, C8): una versión retirada no admite altas ni sucesiones
aunque se llegue al checkout por un link viejo (`B/03` §3.2; `N-G4V-07`). Otro consumidor de un
campo ya declarado.

**Y quién construye las consultas originales se dice acá, porque no decirlo las dejó sin dueño
durante cuatro días y cuatro vueltas del ciclo. Las construye [`V2`](10-corte/V2.md#pieza-v2)**, la segunda unidad de la épica de
verticales (`V/descomposicion.md` §2.9): de las tres originales quedan dos, `políticaDePlan` y
`direcciónDeCambio` (FASE 9 vuelta 2, `R5`: `finDeServicio` salió; revisión del owner, 2026-09-28,
C8: salió `situaciónDeVertical`); los **cuatro** campos de la primera son columnas de `V/02` §2.1,
que es capítulo suyo, así que es la unidad más temprana en la que **las dos** se pueden escribir.
*(Las otras **seis** entradas dicen su constructor arriba:
`fichaPurgada` y `ficha` en V6, `políticaDeAddon` en V2, `extenderTrial` en V4 —FASE 9 vuelta 1,
`G2-1` y `G4-2`—, y `retenciónDetenida` en [`B4`](10-corte/B4.md#pieza-b4), con la respuesta de arranque en V4 (revisión del
owner, 2026-09-28, C14), y `puedeCobrarle` en `B4`, con la respuesta de arranque en V4 (verificación corta, 2026-09-29, lote M-F).)* **La regla
de `direcciónDeCambio` está escrita en `B/10` §3.5 y eso no la muda de dueño**: el veredicto lo
emite verticales —es la frase de arriba— y su consumidor es [`B8b`](20-fase-2/B8b.md#pieza-b8b), cinco unidades antes que la
unidad a la que ese capítulo pertenece. Un contrato que declara una dirección y no dice quién la
implementa deja la mitad cara sin constructor, que es exactamente lo que pasó con ésta.

**Esto no muta [`DEC-ARCH-006`](01-decisiones-vigentes.md#dec-arch-006): escribe la mitad que faltaba.** Aquella decisión declaró que la
frontera es *un contrato con dos implementaciones*; nunca dijo que fuera de una sola vía.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1209, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1211, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1289

### 4.2 La regla de vigilancia, en las dos direcciones

> **Regla de vigilancia**: si aparece **un lugar que necesita algo de billing y no figura en la
> fila `cubierto` del §2.1 ni en la fila `cobrada` ni en la
> fila `piso` ni en la fila `desde`** (revisión del owner, 2026-09-28, C4) (revisión
> del owner, 2026-09-28, C8: la dirección de ida ya no tiene pregunta) **ni es la pregunta
> `retenciónDetenida` del §4.1** (revisión del owner, 2026-09-28, C14: la dirección de ida vuelve
> a tener una, con lectores cerrados) **ni es la pregunta `puedeCobrarle` del §4.1** (verificación corta, 2026-09-29, lote M-F: la segunda de ida, con un solo lector) —y no es
> este hecho— ([`DEC-TRIAL-010`](01-decisiones-vigentes.md#dec-trial-010): la segunda fila es el censo del segundo dato
> que cruza; la tercera, el del piso del grant, owner 2026-09-25, FASE 9 completa, 9h), es señal de
> que el corte se está filtrando. Se mira, no se resuelve en el lugar.
>
> **Y en la otra dirección**: si billing necesita leer de verticales algo que
> **no contesta ninguna de las preguntas del §4.1** —las consultas y sus
> campos, el veredicto de `direcciónDeCambio` y el sí o no de `fichaPurgada`—, **escribir en
> verticales algo que no sea `extenderTrial`, o recibir de verticales un hecho que no sea el del
> §3.1**, vale lo mismo (FASE 9 vuelta 1, `F-8V1A3-014`; owner 2026-09-26, `G2-1` y `G4-2`). Una
> lectura no declarada es un acoplamiento que nadie está mirando. **Las superficies de la capa de
> composición no entran en esta mitad** (§4.1): la regla vigila a las máquinas, guards y barridos.
> **Sin exención por nombre** (revisión del owner, 2026-09-28, C8): la acción que la tenía, discontinuar una
> vertical, ya no existe. Toda acción que escriba en las dos épicas entra en esta mitad como
> cualquier escritura.

**Las dos mitades estaban ancladas en un número y las dos lo tenían mal**, que es lo peor que le
puede pasar a la única regla que existe para enterarse de que [`DEC-ARCH-005`](01-decisiones-vigentes.md#dec-arch-005) dejó de valer. La
mitad de ida decía *«un quinto lugar»* contra el §1.1, que cuenta cuatro **nombres viejos** y no
consumidores; la mitad de vuelta decía *«los seis campos»* contra un §4.1 que dice, nueve renglones
más arriba, ***«Son siete campos en tres preguntas»*** — y **los dos que no contaba eran
`vigente`/`vendible`, que el mismo § declara *«la diferencia entre que el acoplamiento se cortara o
siguiera llegando»***.

**El arreglo no es corregir los dos números: es sacarle el número a la mitad que puede vivir sin
él.** La mitad de ida pregunta ahora por **pertenencia a un censo que se mantiene** (§2.1), que no
caduca cuando aparece el consumidor siguiente.
 **La mitad de vuelta
tampoco lleva número: cita las preguntas del §4.1, que se escriben enteras en un solo lugar.**
Contaba *«siete campos»* y el veredicto no era ninguno de ellos, así que leída literal señalaba
como filtración la única lectura que el §4.1 construyó para evitar una (FASE 9 vuelta 1,
`F-8V1A3-014`). Y *«siete campos»* ya nombraba otra cosa: los de la fuente (§2, 9h). En la misma
vuelta el §4.1 ganó cuatro entradas (`G2-1`, `G4-2`) y perdió un campo (`F-8V1C1-015`): con un
número, la regla habría caducado dos veces en un día.

> ⚠️ **Y lo que esta regla NO tiene, dicho para que nadie la lea como una defensa ejecutable**:
> **ningún guard del programa tiene por sujeto este contrato.** Recorridos los dos catálogos
> (`V/20` §2 y `B/20` §2), los guards cuentan tablas de transiciones, columnas, claves y montos;
> ninguno compara *«lo que un § afirma»* contra *«lo que otro § enumera»*. La regla de vigilancia
> es **prosa que alguien tiene que leer**, y por eso su enunciado se escribe sin cifras
> congeladas: es lo único que se puede hacer por ella sin un guard.
>
> **Desde la revisión del owner hay uno, y cubre una parte** (2026-09-28, N6, `L1-d`): **[`G14`](04-catalogos.md#guard-g14)**
> (`V/20` §2) falla si el código de una mitad importa el de la otra; las dos importan sólo el
> package del contrato (§7), y lo que ese package exporta es exactamente lo que este documento
> declara. Con eso, una lectura no declarada que pase por un import deja de ser prosa. **Lo que
> sigue siendo prosa**: que una mitad lea las TABLAS de la otra por `@repo/db`, que un import no
> delata; y que un censo de consumidores (la fila de `cubierto`, `cobrada`, `piso` o `desde`) esté
> completo.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1291, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1293, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1357

## 5. Las dos implementaciones

El contrato nace con dos, desde el día uno. Es la **condición B de [`DEC-ARCH-004`](01-decisiones-vigentes.md#dec-arch-004)** aplicada a
esta frontera: *«es lo que prueba que la abstracción no miente»*.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1359, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1361, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1362

### 5.1 La de arranque resuelve el trial de verdad

**No devuelve datos fijos.** Resuelve honestamente las **dos** fuentes que ya viven del lado de
verticales —el trial, con su máquina de estados del capítulo 03 §2, y el título `BASE` del §2.5— y
responde que no a las cuatro de billing: suscripción, cortesía, grant y addon, **y a
`retenciónDetenida` (§4.1) contesta `detenida: no`, `pausaTerminadaEn: NINGUNO` y `coberturaPerdidaEn: NINGUNO`** (FASE 9 vuelta 3, owner 2026-09-30, lote Q), porque sin billing no hay pausa (revisión del owner,
2026-09-28, C14; los dos campos, revisión del owner, casos vecinos, 2026-09-29, caso F-A), **y a `puedeCobrarle` contesta `no`**, porque sin billing no hay suscripción que cobre (verificación corta, 2026-09-29, lote M-F). **Y emite el aviso**
en las transiciones de trial del censo del §3 (*«quién emite»*): es emisor desde el día uno, igual
que la real (§5.2), así que [`PB2`](04-catalogos.md#trans-v-pb2) baja la ficha de un trial vencido en el acto de [`T3`](04-catalogos.md#trans-v-t3) y no al día
siguiente (FASE 9 vuelta 1, `F-8V1C1-006`). **Y devuelve `desde` en las dos fuentes que
resuelve** (revisión del owner, 2026-09-28, C4): el instante de [`T1`](04-catalogos.md#trans-v-t1) en la de trial y el alta de
la cuenta en `BASE`, así que la ventana de la cuota mensual (`V/15` §7) se construye y se prueba
sin billing.

**Por qué esto y no un valor hardcodeado**, que es la parte que más cambia el resultado del
ejercicio:

| implementación | qué pasa |
|---|---|
| contesta **siempre que sí** | es un fail-open, y **la mitad interesante nunca se ejerce**: perder la cobertura, `PB2`, el reconciliador, el aviso de qué se hizo |
| contesta **siempre que no** | todo queda apagado; no se ejerce nada |
| **resuelve el trial** | **los dos caminos se ejercen completos**, porque un trial vence de verdad |

Lo único que se siembra son las versiones de plan del catálogo: una vendible para que el trial
tenga de dónde derivar (cap. 02 §2.1: *«sus limits y entitlements no se guardan: se derivan»*), y
las dos no vendibles que sí guardan lo suyo — la de pre-trial y la de piso. **Eso es un dato, no
una rama en el código** — y la distinción importa, porque una rama es lo que después queda viva.

**Y `cubierto` sigue yendo a falso, por DOS motivos y no uno.** El primero es el conocido: el
título `BASE` no es de clase `TÍTULO`. El segundo se agregó porque su ausencia ya había convertido
a esta implementación en la cuarta fila de la tabla: **la fuente de trial en `PRE_TRIAL` tampoco
cuenta**, porque su reloj no arrancó (§2.4).

**Sin ese segundo motivo, esta implementación contestaba «sí» a casi todo el mundo** —`PRE_TRIAL`
es el estado más poblado del sistema— y con eso **caían las tres defensas del §6 a la vez**: el
default dejaba de negar, el juego de casos compartido no podía distinguir una implementación
correcta de una constante, y el guard de producción quedaba cuidando una salida por la que el
defecto ya no pasaba. Toda la épica de verticales se habría construido, probado y revisado contra
una cobertura que dice que sí.

> **El caso que distingue una implementación correcta de una constante es, concretamente: alguien
> en `PRE_TRIAL` tiene `cubierto: no` y `fuentes` no vacío.** Si ese caso pasa con las dos
> implementaciones y con una que contesta siempre que sí, el juego del §6.2 no está probando nada.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1364, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1366, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1408

### 5.2 La real la escribe la épica de billing

Agrega las otras **cuatro** fuentes —suscripción, cortesía, grant y **addon**— y **no toca nada de
lo construido**: se enchufa como fuente y como emisor del aviso.

**Son cuatro y no tres desde que el addon es una fuente del contrato** (§2.4, clase
`COMPLEMENTO`): este § decía tres contra las cuatro que el §5.1 ya enumeraba, y la que faltaba es
justamente la única que transporta `alcance: LISTING` y `objetivo` — o sea, la que el §2.7 necesita
para que el pliegue por ficha exista.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1410, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1412, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1418

### 5.3 Son dos, y no hay una tercera

**No existe una implementación que lea el billing actual.** Se propuso —un adaptador sobre el
sistema que corre hoy, para que verticales pudiera llegar a producción sin esperar a la otra
épica— y **se descartó porque su premisa no existía**: [`DEC-ARCH-007`](01-decisiones-vigentes.md#dec-arch-007) es explícita en que las dos
llegan juntas, así que nadie necesita que una salga sola.

Queda escrito acá porque la idea es tentadora y va a volver: es código real sobre un sistema
condenado, escrito para tirarlo, resolviendo un problema que el programa no tiene.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1420, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1422, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1430

## 6. Las tres defensas

Ninguna es opcional, y las tres son parte de la decisión ([`DEC-ARCH-006`](01-decisiones-vigentes.md#dec-arch-006)), no una recomendación.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1432, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1434

### 6.1 El default es negar

Una fuente no implementada responde **que no**. Así, **un olvido apaga funciones en vez de
regalarlas** — y regalarlas es lo que nadie descubre hasta que ya pasó.

Este proyecto ya tiene el caso escrito: un fallback comentado como seguro que era el permisivo.

**Y la referencia no anulable del §2.3 sube esta defensa un escalón.** Tal como estaba, cubría el
olvido y no cubría el error: una fuente **implementada** que devolviera un puntero vacío pasaba
igual. Con la referencia no anulable, el default de negar deja de depender de que alguien se
acuerde de negar.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1436, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1438, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1446

### 6.2 Un solo juego de casos corre contra las dos implementaciones

Es lo que convierte *«billing reemplaza la implementación de arranque»* en un evento verificable
en vez de un día de sorpresas. Para cuando llegue, ese juego ya corrió meses contra la otra.

Y vale la regla del capítulo 20 §2.1: **un caso que no puede fallar es un comentario con exit code
0.** El juego incluye el caso que distingue una implementación correcta de una que contesta
siempre lo mismo — **las dos implementaciones lo
pasan, y una constante no: si pasa también con una constante, no está probando nada** (§5.1;
FASE 9 vuelta 2, `F-8V2C1-006`). *«Las dos»* de este § son siempre las dos implementaciones, y el
juego único pasa entero contra las dos.

**Y hay un segundo juego, el de la dirección inversa** (revisión del owner, 2026-09-28, N6,
`L1-d`): corre contra el simulador de lo que billing le lee a verticales y contra la
implementación de verticales, y vive con el primero en el package del contrato (§7.1). Es lo que
deja construir y probar la épica de billing antes de que existan las unidades de verticales que
contestan esas preguntas.

**Los casos de las fuentes de billing no son del juego único** (FASE 9 vuelta 2, `F-8V2C1-006`).
Un caso como *«una suscripción `ACTIVE` cubre»* no lo pasa la de arranque, que contesta que no a
toda fuente de billing, así que en el juego único lo pone en rojo durante toda la épica de
verticales, o lo obliga a condicionarse a la implementación, y condicionado es un caso que no
puede fallar. **Van en un juego propio de la real**, que corre sólo contra ella y trae al menos un
caso que la de arranque no pasaría: es lo que prueba que la real no es la de arranque con otro
nombre.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1448, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1450, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1472

### 6.3 Un guard impide que la implementación de arranque llegue a producción

Es la única de las tres que convierte *«no lo hagas»* en *«no se puede»*, que es la misma razón
por la que [`DEC-ARCH-004`](01-decisiones-vigentes.md#dec-arch-004) pidió su condición A.

**Su dueño es [`V4`](10-corte/V4.md#pieza-v4), la unidad de la épica de verticales**, y no [`B4`](10-corte/B4.md#pieza-b4). No es indiferente: la épica
de verticales **se construye con la implementación de arranque adentro**, porque es la que le
permite avanzar sin billing ([`DEC-ARCH-006`](01-decisiones-vigentes.md#dec-arch-006)). En `B4` la defensa **no existiría durante toda esa
épica**, que es justo cuando la implementación de arranque está viva y es la única que hay.

**Falla sobre un build destinado a producción, no sobre la rama**, así que no se dispara mientras
nada apunte a producción: se puede escribir el día uno y quedarse callado meses. El momento que
protege es **el del merge**, y [`DEC-ARCH-007`](01-decisiones-vigentes.md#dec-arch-007) ya dejó escrito cómo va a ser —*«el PR final a
`staging` va a ser enorme y nadie lo puede revisar de verdad»*—: si ese día quedó algo enganchado a
la implementación de arranque, ése es el día en que entra sin que nadie lo vea.

**Qué pieza es *«la de arranque»* para este guard** (FASE 9 vuelta 2, `F-8V2C1-005`). No es el
módulo entero: la resolución del trial y la del título `BASE` son de verticales **en las dos
implementaciones** (§2.6, §5.2 *«no toca nada de lo construido»*), así que en producción corren
siempre. **Es el cableado que contesta por billing**: el `no` a las cuatro fuentes de billing
(§5.1) **y el `no` de
`retenciónDetenida`** (revisión del owner, 2026-09-28, C14) **y el `no` de `puedeCobrarle`**
(FASE 9 vuelta 3, F-8V3C1-002, F-8V3D1-001). **Son las seis respuestas de arranque que contestan
por billing, las del §5.1: las cuatro fuentes, `retenciónDetenida` y `puedeCobrarle`**, y la fila
de [`G13`](04-catalogos.md#guard-g13) en `V/20` §2 cita este § en vez de repetir la lista. **`G13` lleva un
caso por cada una**, que falla si un build destinado a producción la importa.
La implementación de arranque lo tiene en un módulo propio,
separado de la resolución del trial y de `BASE`, y **`G13` falla si un build destinado a
producción importa ese módulo**. Con el predicado sobre el módulo entero, `G13` se ponía rojo en
el primer build de producción, y la excepción que alguien le agregara para destrabar dejaba pasar
justo ese `no`: `cubierto` falso para todo cliente que paga, y [`PB2`](04-catalogos.md#trans-v-pb2) bajándole las fichas mientras
el proveedor le sigue cobrando.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1474, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1476, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1507

## 7. Lo que este contrato NO decide

- **Cómo se resuelven los entitlements y los limits.** Es el capítulo 15, y es de verticales. Acá
  está de dónde sale el puntero, no qué se hace con él.
- **Qué es una suscripción, una cortesía o un grant por dentro.** Son los capítulos 12 y 14, y son
  de billing. Acá está qué aportan, no cómo funcionan.
- **Quién tiene el reloj de cobro: DECIDIDO el 2026-09-24 por [`DEC-MP-006`](01-decisiones-vigentes.md#dec-mp-006): es del
  proveedor.** Este contrato **no cambió una línea** por eso — que era lo que el §1.2 afirmaba.
- **El domicilio y el nombre están decididos**: §7.1 (`@repo/billing-verticals-contract`,
  [`DEC-ARCH-015`](01-decisiones-vigentes.md#dec-arch-015), FASE 5, lote B); la implementación real
  la inyecta la raíz de composición de `apps/api` (§7.1) (residuo corregido el 2026-10-02).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1509, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1511, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1521

### 7.1 Dónde vive: un package compartido, único punto de comunicación

(Revisión del owner, 2026-09-28, N6, `L1-d`.) **Toda comunicación entre verticales y billing pasa
por un package compartido del monorepo**, y por ningún otro lado. **Se llama
`@repo/billing-verticals-contract`**, en `packages/billing-verticals-contract` (FASE 5, lote B,
2026-09-30, [`DEC-ARCH-015`](01-decisiones-vigentes.md#dec-arch-015)). No depende de ninguna de las
dos mitades ni de `@repo/db`: sólo de la validación y del enum de verticales de `@repo/schemas`.
Tiene cinco cosas (la quinta, revisión del owner, casos vecinos,
2026-09-29, caso G-B):

1. **Las dos interfaces. Lo que verticales le pregunta a billing**: `cobertura` (§2),
   `retenciónDetenida`, **`puedeCobrarle`** (§4.1; faltaba en esta lista desde el lote M-F: verificación corta, 2026-09-29, lote N-C) y el aviso de que la cobertura cambió (§3). **Lo que billing le lee a
   verticales**: `políticaDePlan`, `direcciónDeCambio`, `fichaPurgada`, `ficha`,
   `políticaDeAddon`, la escritura `extenderTrial` (§4.1) y el empuje de la ficha que llegó a
   `PURGED` (§3.1). Los dos eventos llevan la regla *«se emite después del commit»* (§3).
2. **Sus validaciones**: el esquema de cada respuesta, de cada argumento y de cada evento. Una
   respuesta que no valida no se entrega: es el §6.1 del lado de la forma.
3. **Los simuladores de cada lado**, falsos programables en memoria de las dos interfaces, bajo
   una ruta de pruebas que ningún build de producción importa (la técnica de [`G13`](04-catalogos.md#guard-g13), §6.3). **Con
   ellos verticales se prueba entera sin billing, y billing entera sin verticales**: la mitad que
   faltaba era la segunda, porque para la dirección inversa no había falso ni juego de casos.
   **Y mientras la app de la rama está rota, son lo único contra qué probar** (verificación corta,
   2026-09-29, lote N-A): la limpieza del principio borra el sistema viejo antes de construir el
   nuevo (`16-fase-7…` §4.6), y hasta que [`B4`](10-corte/B4.md#pieza-b4) integra la implementación real de billing en la raíz
   de composición de `apps/api` las dos mitades se construyen y se prueban contra estos simuladores.
4. **Los juegos de casos compartidos**: el del §6.2 (la dirección de ida, contra las dos
   implementaciones de `cobertura`) y **uno nuevo de la dirección inversa**, que corre contra el
   simulador y contra la implementación de verticales, con su caso que una constante no pasa.
5. **La interfaz del reloj** ✚ con que el código de producción de las dos mitades lee la hora,
   inyectada. El reloj adelantable que la implementa vive en el package de pruebas compartido
   (`B/20` §5.1, caso 31); la interfaz, que sí importa producción, vive acá porque éste ya es el
   único package que importan las dos mitades. **[`G14`](04-catalogos.md#guard-g14) no cambia**: importar el contrato nunca fue
   cruzar (revisión del owner, casos vecinos, 2026-09-29, caso G-B). **La construye [`B1`](10-corte/B1.md#pieza-b1)**, con el
   reloj adelantable (revisión del owner, casos vecinos, 2026-09-29, caso I-E). La implementación
   real no vive acá: la inyecta la raíz de composición de `apps/api` (abajo; caso J-A). **Y [`V4`](10-corte/V4.md#pieza-v4)
   depende de `B1`**: es la primera unidad de verticales que lee la hora (el vencimiento del
   trial), y `V9b` (los plazos de retención) llega después de `V4`. Es la duodécima dependencia
   entre épicas (FASE 9 vuelta 3, F-8V3C1-006): sin ella `V4` se podía mergear antes de que
   existiera la interfaz y leer la hora del sistema, que el reloj adelantable no mueve. **La FASE 5
   no lo mueve**: el reloj sigue en `B1`, y lo que los jobs necesitan además —el huso del mercado,
   el id de corrida y la correlación— lo construye [`U2`](10-corte/U2.md#pieza-u2), con el outbox (owner 2026-09-30, lote 2 B;
   `NUCLEO/07` §1.4, `NUCLEO/08` §2.4).

**Las implementaciones no viven en el package**: la real de la dirección de ida en la mitad de
billing ([`DEC-ARCH-004`](01-decisiones-vigentes.md#dec-arch-004)), la de la inversa y la de arranque en la de verticales (la de arranque
con su módulo que contesta por billing, que sigue bajo `G13`). **El único lugar que junta las dos
mitades es la raíz de composición de `apps/api`. La implementación real del reloj (la hora del
sistema), que leen las dos mitades, la inyecta esa raíz; en las pruebas se inyecta el reloj
adelantable** (revisión del owner, casos vecinos, 2026-09-29, caso J-A). **La línea de esa raíz que
lo inyecta la escribe `B1`**, la unidad que construye la interfaz y el adelantable (revisión del
owner, casos vecinos, 2026-09-29, caso K-C). Y **`G14`** (`V/20` §2) falla si una mitad
importa a la otra: es lo que vuelve ejecutable la parte de la regla de vigilancia que se ve en un
import (§4.2). **Quién lo construye**: **[`U1`](10-corte/U1.md#pieza-u1) crea el package vacío, la estructura sin contenido, al terminar la limpieza del principio; [`V1`](10-corte/V1.md#pieza-v1) construye `G14` y llena las cuatro primeras cosas, y `B1` la quinta, en paralelo** (verificación corta, 2026-09-29, lote P-C; `16-fase-7…` §4.6);
**`V1` escribe las
interfaces, las validaciones y los simuladores de todas las entradas, las de ida y las de la
dirección inversa, y cada unidad que construye una implementación (§4.1, *«quién construye»*) trae
sólo esa implementación** (FASE 9 vuelta 3, F-8V3C1-005: las dos lecturas daban órdenes distintos,
y con la segunda [`B10`](20-fase-3/B10.md#pieza-b10) no tenía contra qué probar antes de [`V6`](10-corte/V6.md#pieza-v6)), y la épica de billing lo
consume **desde que `V1` lo escribe, cada unidad cuando lee la dirección inversa por
primera vez** (FASE 9 vuelta 3, F-8V3C1-008: `B1` corre en paralelo con `V1`) con el simulador de
la dirección inversa (`V/descomposicion.md`, `B/descomposicion.md` §2).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1525, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1527, .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1585

## 8. La interfaz vista desde la partición del programa: un hecho y un aviso

Es el §3 de la partición (`D/11`), que llega a lo mismo que este contrato desde el otro lado:
verificado capítulo por capítulo, todo lo que el lado verticales necesita del lado billing se
reduce a **un solo hecho**, que el diseño pedía en cuatro lugares distintos con cuatro nombres
distintos y es siempre el mismo. La tabla de esos cuatro lugares es la del §1.1, y no se repite.

**El hecho, enunciado una vez, y en un solo lugar, que es este contrato**: una consulta de
cobertura por `user + vertical`, cuya firma exacta vive en el §2. Su contracara, lo único que
billing le empuja a verticales, es el evento *«la cobertura de (user, vertical) cambió»*, y es el
§3.

> **La partición llevaba una transcripción de la firma, y es la que no hay que volver a
> escribir.** Decía `{ tiene_título_vivo, fuente, hasta_cuándo }` —tres campos, con `fuente` en
> singular, que es exactamente lo que el §2.2 descarta por su nombre (*«quitar una fuente no quita
> la cobertura si queda otra»*), y con tres nombres que no existen en ningún otro documento del
> programa—. Era `F-8C1-009`, y es el mismo generador que `F-8dC2-001` encontró en los dos
> `spec.md`: **una copia no necesita que nadie la mute para divergir, alcanza con que el contrato
> avance**. Se retiró en vez de actualizarse, porque actualizarla dejaba el generador en pie (§0).

**Nada más cruza la frontera.** No cruzan montos, ni estados de pago, ni ids del proveedor, ni
fechas de cobro —sobre cobros cruza un solo bit, `cobrada`, declarado en el §4
([`DEC-TRIAL-010`](01-decisiones-vigentes.md#dec-trial-010))—. **La regla de vigilancia vive en el
§4.2 y la partición la cita, no la repite**: si aparece un lugar que necesita algo de billing y no
figura en la fila `cubierto` del §2.1 ni en su fila `cobrada` —y no es este hecho—, es señal de que
el corte se está filtrando y hay que mirarlo, no resolverlo en el lugar.

> **Ese renglón de la partición decía *«un quinto lugar»* y era la tercera copia de una cifra que
> ya había caducado.** La tabla del §1.1 enumera **los cuatro nombres con que el diseño pedía el
> hecho antes de que el contrato existiera**, y el censo vivo de quién lo consume es la fila
> `cubierto` del §2.1, que hoy es más larga. Es el mismo generador que el recuadro de arriba
> describe para la firma —**una copia no necesita que nadie la mute para divergir**—, aplicado esta
> vez a un conteo en vez de a un bloque de campos. **La mitad inversa de la misma regla llevaba la
> otra cifra caduca** (*«los seis campos»* contra los **siete** del §4.1), y las dos se arreglaron
> sacándole el ordinal a la que puede vivir sin él (§4.2).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:91, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:93, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:97, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:104, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:110, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:118, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:125

### 8.1 El valor por defecto que hace posible construir sin billing

**El trial ya es un título vivo, y el trial no es billing.** Esa es toda la respuesta.

Mientras la épica de billing no exista, `cobertura()` se resuelve con las **dos** fuentes que ya
viven del lado de verticales —el trial y el título `BASE` del §2.5— y las **cuatro** de billing
(suscripción, cortesía, grant y addon) responden que no (§5.1). Con eso:

- la resolución de autorización recorre sus **nueve pasos completos** (cap. 17 §1.2);
- la máquina de publicación tiene su disparador de [`PB2`](04-catalogos.md#trans-v-pb2) vivo,
  alimentado por [`T3`](04-catalogos.md#trans-v-t3);
- el reconciliador de excedentes se prueba entero, disparado por las transiciones de trial;
- y la agregación de limits, los scopes y el excedente no tienen ninguna dependencia que
  defaultear: nunca preguntaron por dinero.

Cuando billing exista, **se agrega como fuente de `cobertura()` y como llamador del
reconciliador.** No se modifica nada de lo construido: se enchufa (§5.2).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:134, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:136, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:138, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:142, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:148

### 8.2 Lo que queda inactivo, declarado y no escondido

Tres cosas del lado verticales no se pueden ejercer hasta que exista billing. Van declaradas acá
para que nadie las descubra como un bug:

1. **El trial nunca convierte.** Las transiciones [`T2`](04-catalogos.md#trans-v-t2) y
   [`T5`](04-catalogos.md#trans-v-t5) del capítulo 03 §2 disparan cuando aparece un título que
   convierte —una suscripción, recién con su primer pago acreditado
   ([`DEC-TRIAL-010`](01-decisiones-vigentes.md#dec-trial-010))—. Sin billing, un trial sólo puede
   vencer.
2. **La reparación de un trial ya vencido no existe.** El capítulo 11 §2.3 la resuelve con una
   cortesía, que es un instrumento de billing. Alguien perjudicado por un error de moderación
   nuestro **después** de que su trial venció no tiene reparación hasta entonces. Mientras el
   trial sigue vivo sí la tiene: la extensión [`T4`](04-catalogos.md#trans-v-t4) es propia del
   trial.
3. **El techo de días de trial cuenta una fuente de tres.** Cuenta las extensiones de `T4` y no
   las que vendrían de un promo o de una cortesía (cap. 11 §3.2), porque esas dos todavía no
   existen. El número no cambia; cambia cuántas cosas suman contra él.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:151, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:153, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:156, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:159, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:163

## 9. El programa: lo que se agregó a las unidades y lo que las ordena

Dos secciones de las descomposiciones de las épicas que no son de ninguna pieza sola: qué agregó
la FASE 5 y a qué unidad, en verticales (`V/descomposicion.md` §2.13), y qué podía construirse
antes de que la pasarela estuviera elegida, en billing (`B/descomposicion.md` §2.3), de la que
queda vigente su tabla de política y forma.

### 9.1 Lo que la FASE 5 agregó, y qué unidad lo construye

(FASE 5, sobre `HOS-1352/docs/38-fase-5/10-decisiones-del-owner.md`, lotes 1 a 6 y el lote de
simplificación del corte, y `20-simplificacion-del-corte.md`.) Recorrido contra la tabla de unidades
de `V/descomposicion.md` §2 con la misma pregunta que su §2.11. Lo que la FASE 5 agregó a
[`U1`](10-corte/U1.md#pieza-u1) está en la fila de `U1` de ese §2.11.

| qué | de dónde | unidad | qué la demuestra |
|---|---|---|---|
| **`U2`, el outbox común**: sobre el precedente del newsletter, con la supresión, la bitácora de correos que `U1` renombró desde `billing_notification_log`, la correlación de punta a punta, el id de corrida y el huso del mercado en los jobs (el reloj sigue en `B1`) | lote 2 A y B | **[`U2`](10-corte/U2.md#pieza-u2)**, del paraguas como `U1`: depende de `U1` y va antes de `V6`, `V9a`, `V9b` (corte del MVP, owner 2026-10-01, AC), `B4` y `B12`, las primeras que encolan. Su fila y su criterio viven en `16-fase-7…` §4.6 | **`V6`, `V9a` y `V9b` (AC) dependen de `U2`** (`V/descomposicion.md` §3) |
| **el paso de cobertura en toda ruta de escritura de vertical**, que `U1` deja con permiso y propiedad solos | lote 1 A | **[`V5`](10-corte/V5.md#pieza-v5)** | **criterio de salida: ninguna ruta de escritura de vertical sin el paso de cobertura** |
| **la ficha ajena `RESTRICTED` contesta `404`**: sale la excepción VIP de `apps/api/docs/error-contract.md` | lote 4 D | **`V5`** | una ficha ajena `RESTRICTED` contesta lo mismo que una inexistente, y el test que fijaba el `403` afirma el `404` |
| **salen la impersonación y `set-role`**: `impersonate` y `set-role` del plugin `admin` de Better Auth, el botón del panel y `USER_IMPERSONATE`; **y `fullAdminRole` queda sin ninguna acción: el plugin sigue sólo como guardia del baneo en el inicio de sesión** (FASE 5, lote de la aplicación, owner 2026-09-30, L; `apps/api/src/lib/auth.ts:76-89` en `origin/staging`) | lote 4 C; lote de la aplicación, L | **`V5`** (el plugin y el permiso) · el botón sale en el mismo cambio | ningún rol del plugin lleva `impersonate` ni `set-role`, el permiso no existe en el enum y el panel no muestra el botón; **`fullAdminRole` no lista ninguna acción sobre `user` ni sobre `session`, y un baneado sigue sin poder iniciar sesión** (L) |
| **el estado nuevo de la ficha reemplaza a `lifecycle_state`, `visibility` y `moderation_state`**, con sus lectores, los disparadores de revalidación y el *«revalida»* de cada fila de `03` §9 | lote 3 A | **[`V6`](10-corte/V6.md#pieza-v6)** | ningún archivo lee las tres columnas viejas; una transición que cambia lo que se ve programa la revalidación que su fila declara; las tres se borran en el paso 3 |
| **los lectores de `owner_suspended`, `plan_restricted` y `billing_unpublished_at`**, retirados en el mismo cambio que la migración que las borra | lote 3 B; S-09 | **`V6`** | fila de las tres columnas de `V/descomposicion.md` §2.12 |
| **las puertas de borrado y restauración fuera del diseño**: `softDelete` del dueño, `delete`, `hardDelete` y `restore` del admin en las tres verticales, y `user/admin/hardDelete.ts` | lote 3 C | **`V6`** (las de fichas) · **[`V8a`](10-corte/V8a.md#pieza-v8a)** (corte del MVP, owner 2026-10-01, Z) (la de cuentas, que reemplaza la acción 24, [ACC:24](02-nucleo.md#acc-24)) | el dueño borra sólo por [`PB12`](04-catalogos.md#trans-v-pb12); el equipo borra una ficha sólo por la acción 23 ([ACC:23](02-nucleo.md#acc-23)), a pedido y con motivo; no queda ruta que borre físicamente una ficha o una cuenta, ni que restaure una ficha |
| **los plazos sin valor, fijados antes del merge de `V6`** | lote 3 D | el owner, antes del merge de **`V6`** | la migración que crea la versión 1 de los plazos no falla en `e2e-pr` |
| **el corte simplificado**: la lista cerrada de cinco fichas, el borrado de las demás, el 4c siempre y el 5b sobre lo borrado; salen la tabla `L1`–`L8`, los recuentos del paso 0, 2 y 3 y el gate de seudónimos compartidos; **la tabla de paso que la migración llena antes de borrar (id de cada ficha borrada, rutas de sus fotos y token de calendario), que el 5b recorre y borra al terminar** (FASE 5, lote de la aplicación, owner 2026-09-30, D)**, sólo en el SQL de la migración del paso 3 y fuera del esquema de Drizzle** (FASE 5, lote de la aplicación, segunda tanda, owner 2026-09-30, P); **y la herramienta del corte que escribe las cinco pruebas** (FASE 5, lote de la aplicación, owner 2026-09-30, B) | S-01, S-02, S-04, S-07, S-08, S-28, S-36, S-67; lote 1 J; lote de la aplicación, B y D; segunda tanda, P | **`V6`** | criterio de `V6` en `V/descomposicion.md` §4 |
| **la postulación propia de Partner**, la de `02` §2.7; `alliance_leads` queda para los otros tipos | lote 4 A | **[`V7`](20-fase-4/V7.md#pieza-v7)** | postularse como Partner crea una postulación nueva y ninguna fila en `alliance_leads`; una postulación de patrocinador sigue entrando por `alliance_leads` |
| **el rol de socio**, con su familia de operaciones, sus permisos y su migración de datos, asignado **en el acto que fija al dueño de la presencia —el reclamo—** (FASE 5, lote de la aplicación, owner 2026-09-30, F), **porque el alta directa del admin no fija dueño y manda el aviso de reclamo** (FASE 5, lote de la aplicación, segunda tanda, owner 2026-09-30, N), y nunca quitado | lote 4 B; lote de la aplicación, F; segunda tanda, N | **`V7`** (el rol, los permisos, la migración y la asignación) · **`V5`** (el paso 3 que pregunta por esa familia) | **aprobar una postulación no asigna ningún rol; reclamar le asigna el rol de socio a la cuenta con que se reclama, y no a la que tiene el correo** (F); **el alta directa del admin no asigna ningún rol ni escribe `owner_user_id`: manda el aviso de reclamo, y el rol llega con el reclamo** (FASE 5, lote de la aplicación, segunda tanda, owner 2026-09-30, N); un socio que pierde la presencia conserva el rol; el paso 3 deja pasar sus operaciones de socio y rechaza las de otra familia |

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:533, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:535, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:541, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:542, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:543, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:544, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:545, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:546, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:547, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:548, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:549, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:550, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:551

### 9.2 Qué se podía hacer antes de la pasarela, y qué sigue vigente

**Las trece unidades de billing tienen diseño y ninguna espera a un tercero**: con
[`DEC-MP-005`](01-decisiones-vigentes.md#dec-mp-005) (la pasarela es Mercado Pago) y
[`DEC-MP-006`](01-decisiones-vigentes.md#dec-mp-006) (su política de cobro, 2026-09-24), lo que
ordena la construcción son sólo las dependencias de `B/descomposicion.md` §3 (FASE 9 completa,
salida 3 de `DEC-METH-004`). Las trece se pueden construir, en ese orden: ninguna queda sin diseño
(el capítulo 13 se repartió y `DEC-MP-006` decidió su política) y ninguna espera la pasarela.

**Lo que sigue vigente de la sección de la fuente es la tabla de política y forma**, con la columna
de la forma ya contestada por Mercado Pago. La política es lo que no cambiaba con la respuesta, y
por eso la especificación se pudo escribir antes de elegir proveedor:

| unidad | política, que sobrevive a las dos respuestas | forma (contestada por Mercado Pago) |
|---|---|---|
| **[`B3`](10-corte/B3.md#pieza-b3)** | hay una ventana entre *«empezamos»* y *«hay compromiso»*, tiene duración máxima, se limpia y el candado es nuestro y va antes | qué vive adentro: un checkout para autorizar un mandato, o la captura de una tarjeta |
| **[`B7`](10-corte/B7.md#pieza-b7)** | el reloj del grace arranca en el **primer rechazo** de una renovación, leído por id —reemplazo de la FASE 8 completa (`R1`) del *«cuando se agotan los reintentos»*: ese instante no emite evento (`GR-3`)—, y eso se observa releyendo, nunca contando días | de quién son esos reintentos — y si son nuestros, **son terreno regulado** |
| **[`B8b`](20-fase-2/B8b.md#pieza-b8b)** (corte del MVP, owner 2026-10-01, Z) | cambiar de ciclo re-autoriza; la pausa es en meses enteros y el reloj que reanuda es nuestro | si hace falta cancelar y recrear — [`DEC-ARCH-004`](01-decisiones-vigentes.md#dec-arch-004) impl. 3: *«si se puede mutar el ciclo de una suscripción viva, `DEC-SUB-006` deja de necesitar el cancelar-y-recrear»* |
| **[`B9b`](20-fase-2/B9b.md#pieza-b9b)** (corte del MVP, owner 2026-10-01, Z) | el orden de aplicación, el piso, y **que un canje o un apilado bajo el piso se rechaza al canjear, con un motivo que dice que el mínimo lo pone Mercado Pago** (owner 2026-09-25, 4b y 9g) | **sin sujeto**: la cortesía se implementa pausando ([`DEC-GRANT-003`](01-decisiones-vigentes.md#dec-grant-003)), y una promo ya no se ejecuta como cortesía |
| **[`B10`](20-fase-3/B10.md#pieza-b10)** | los dos ejes, qué es una suscripción válida, el huérfano | si el huérfano recurrente **existe** — con un cargo puntual no hay autorización suelta que siga cobrando |
| **[`B11`](10-corte/B11.md#pieza-b11)** | el inventario es nuestro y lo que toca plata lo mira una persona | si hace falta leer de a una por id |

**[`B6`](10-corte/B6.md#pieza-b6) ya tiene su columna de política**
([`DEC-MP-006`](01-decisiones-vigentes.md#dec-mp-006), 2026-09-24): **un solo reloj, el del
proveedor**, y el reembolso siempre confirmado por una persona y verificado releyendo
([`DEC-RF-002`](01-decisiones-vigentes.md#dec-rf-002), `B/03` §6.1). Su forma es la de Mercado
Pago: el mandato cobra solo y el reembolso va por `POST /v1/payments/{id}/refunds` con clave
obligatoria (`B/06` §4.6). La fila de `B12` de la fuente está tachada entera: era de la
discontinuación de una vertical, que salió con la revisión del owner, 2026-09-28, C8 (tachada en
los casos vecinos, 2026-09-29, caso 38).

**Y lo que no conviene**: escribir el adaptador contra Mercado Pago «para ir avanzando». Es
exactamente el error que [`DEC-ARCH-004`](01-decisiones-vigentes.md#dec-arch-004) fue a corregir
—la alternativa (3) que descartó, *«acoplarse a la pasarela elegida y aceptar que cambiarla sea una
reescritura»*, es la que **nos trajo hasta acá**—. **Sigue valiendo con la pasarela decidida**:
desde `DEC-MP-005` el adaptador real **es** el de Mercado Pago, pero se escribe detrás de la
interfaz, con [`G12`](04-catalogos.md#guard-g12), y `DEC-MP-005` declara que la elección se revisa
si aparece otra habilitación.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:204, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:206, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:217, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:219, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:245, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:247, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:251, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:252, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:253, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:254, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:255, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:256, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:257, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:261, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:279, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:282

**Lo que de esa sección de la fuente NO es vigente** (la fuente misma lo deja como rastro: *«Este §
describe el estado anterior al 2026-09-24 y se deja como rastro»*, y lo superaron `DEC-MP-005` y
`DEC-MP-006`), y por eso no se especifica acá ni se construye:

- **el conteo previo a la pasarela** —*«sin diseño: 1 (B6)»*, *«con diseño, esperando la pasarela:
  11»*, *«se puede hacer entera hoy: 1 (B2)»*— y la frase *«Doce de trece tienen el diseño escrito.
  Doce de trece no se pueden construir todavía»*, tachados en la fuente y reemplazados por el
  *«ninguna espera a un tercero»* de arriba;
- **«Por qué el alcance es tan ancho»**, la tabla de lo que la pasarela decide con su respuesta de
  Mercado Pago: es la justificación de por qué la elección pesaba, escrita mientras la pasarela no
  estaba elegida; lo que cada fila dice como hecho de Mercado Pago es decisión ya tomada y vive en
  sus decisiones (`DEC-MP-005`, `DEC-MP-006`, [`DEC-ARCH-004`](01-decisiones-vigentes.md#dec-arch-004)
  y las demás que la tabla de política y forma cita);
- **«Lo que sí conviene hacer mientras tanto»** (atomizar las once con diseño, construir `B2` entera
  con su único gate en `V2`, escribir la interfaz del adaptador y `G12` antes de saber la pasarela):
  la fuente lo declara *«sin objeto desde el 2026-09-24»* y tacha sus tres puntos.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:206, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:212, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:221, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:225, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:227, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:231, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:241, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:267, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:269, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:272

## Las dependencias entre épicas (`B/descomposicion.md` §2.6)

Son **doce**, sobre cuatro piezas de verticales (`V2`, `V4`, `V6` y `V9b`) y una de billing
(`B1`, en la fila 14), y las de `V6` y `V9b` no son tempranas. Las filas 8 y 13 de la fuente
están retiradas (la 8 en la FASE 9 vuelta 2, `R5`: la fecha la calculaba billing; la 13 con la
revisión del owner, 2026-09-28, C8) y viven en `90-retirados.md`; sus números no se reusan.

**`B2` no puede existir sin `plan_version`**, que es [`V2`](10-corte/V2.md#pieza-v2) de verticales:
`billing_option` cuelga de ella con `UNIQUE(plan_version_id, ciclo)`. Es el corte de
[`DEC-ARCH-005`](01-decisiones-vigentes.md#dec-arch-005) visto desde abajo — el precio vive en **una sola
tabla hoja** y todo lo que está encima es configuración de capacidades.

**No contradice la autonomía.** `V2` es la **segunda** unidad de la otra épica, y lo que `B2`
necesita es esa unidad mergeada en la rama del paraguas, no la épica terminada. La segunda
dependencia es la de `B4` sobre `V4`, que trae el contrato con su implementación de arranque.

**Y desde la revisión del owner las dependencias que pasan por el contrato son de integración, no
de prueba** (2026-09-28, N6, `L1-d`). El contrato vive en un package compartido del monorepo, que
es el único punto de comunicación entre las dos épicas y trae **el simulador de lo que billing le
lee a verticales** y su juego de casos (§7.1). Con él, las piezas que leen la dirección inversa
(`B8b` con `direcciónDeCambio`, `B9b` con `extenderTrial`, `B10` con `ficha` y
`políticaDeAddon`, y el barrido con `fichaPurgada`) **se construyen y se prueban contra el
simulador antes de que exista la pieza de verticales que contesta**, y esperan a esa pieza sólo
para integrarse. **Lo que no pasa por el contrato sigue siendo dependencia real**: la FK de
`billing_option` a `plan_version` que ata `B2` a `V2`. **El package lo crea [`U1`](10-corte/U1.md#pieza-u1),
vacío (la estructura, sin contenido), al terminar la limpieza del principio; `V1` y `B1` arrancan
en paralelo y cada una llena su parte: `V1` las dos interfaces, sus validaciones, los simuladores
y los juegos de casos (§7.1, puntos 1 a 4), y `B1` la interfaz del reloj (punto 5)**. **`V1`
escribe las interfaces, las validaciones y los simuladores de todas las entradas, de ida y de la
dirección inversa, y cada pieza trae sólo su implementación** (§7.1; FASE 9 vuelta 3,
`F-8V3C1-005`; verificación corta, 2026-09-29, lote P-C; `16-fase-7…` §4.6). **Y `B1` no consume
el simulador desde su arranque**: lo escribe `V1`, que corre en paralelo, así que la primera pieza
de billing que lo lee es la primera que lee la dirección inversa, `B3` (`vigente`/`vendible`,
fila 7), que llega después de `B2`, y `B2` espera a `V2`, que va después de `V1`; lo que `B1`
escribe en el package, la interfaz del reloj, no lee nada de verticales (FASE 9 vuelta 3, R20,
`F-8V3C1-008`). **El grafo de las dependencias no cambia por esto**: las doce siguen, cambia qué se
puede probar antes. **Y desde el lote N-A el simulador es lo único contra qué probar mientras la app
de la rama está rota**, desde la limpieza del principio, que borra el cobro viejo, hasta que `B4`
integra la implementación real (`16-fase-7…` §4.6; verificación corta, 2026-09-29).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:330, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:332, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:340, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:347, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:349, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:356, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:361, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:363

Cada dependencia está medida contra el lector que la pide. **Con el corte del MVP siguen siendo
doce** (corte del MVP, owner 2026-10-01, Z): cambian sus piezas, no su número. La 4 y la 5 pasan a
`B8b`; la 10 a `B9b`; la 12 a `B9a`; y en la 11 el empuje de `PB9` es de `V9b`. **Ninguna pieza
del corte lee a una posterior**: recontado con `41-corte-del-mvp/aristas.py`, que lee esta tabla
por su encabezado.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:365, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:390, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:392

<a id="dep-1"></a>
**DEP:1** — **Lee `B2`**: `billing_option` cuelga de `plan_version`. No es la dirección inversa:
es la tabla misma (la FK de `billing_option` a `plan_version`, con
`UNIQUE(plan_version_id, ciclo)`). **Contra `V2`.**

Pieza dueña del AC: [B2](10-corte/B2.md#pieza-b2) · también: [V2](10-corte/V2.md#pieza-v2) (provee)
Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:375, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:332

<a id="dep-2"></a>
**DEP:2** — **Lee `B4`**: el contrato con su implementación de arranque. Es la dirección de ida.
**Contra `V4`.** Cubre también `puedeCobrarle`, que no suma fila: es una pregunta de la dirección
de ida, como `retenciónDetenida`, y la cubre esta fila (`B4` contra `V4` por la interfaz y la
respuesta de arranque). La flecha inversa, `V8a` que lee lo que contesta `B4`, no es una
dependencia de construcción: verticales se construye contra la respuesta de arranque, como con
`cobertura()` ([`DEC-ARCH-006`](01-decisiones-vigentes.md#dec-arch-006)) (verificación corta,
2026-09-29, lotes M-F y M-G).

Pieza dueña del AC: [B4](10-corte/B4.md#pieza-b4) · también: [V4](10-corte/V4.md#pieza-v4) (provee)
Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:376, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:421

<a id="dep-3"></a>
**DEP:3** — **Lee `B7`**, el reloj del grace: `díasDeGrace` de `políticaDePlan` (§4.1). *«El §20
fija el grace en 10 días y [`DEC-SUB-002`](01-decisiones-vigentes.md#dec-sub-002) lo dejó configurable
**por versión de plan**»* (§1 del contrato). **Contra `V2`.**

Pieza dueña del AC: [B7](10-corte/B7.md#pieza-b7) · también: [V2](10-corte/V2.md#pieza-v2) (provee)
Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:377

<a id="dep-4"></a>
**DEP:4** — **Lee `B8b`**, la pausa (era `B8`: corte del MVP, owner 2026-10-01, Z): `permitePausa`
de `políticaDePlan` (§4.1). Es el tercer término de `puedePausar()` (`NUCLEO/01` §3), que
[`S8`](04-catalogos.md#trans-b-s8) exige. **Contra `V2`.**

Pieza dueña del AC: [B8b](20-fase-2/B8b.md#pieza-b8b) · también: [V2](10-corte/V2.md#pieza-v2) (provee)
Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:378

<a id="dep-5"></a>
**DEP:5** — **Lee `B8b`**, el cambio de plan (era `B8`: corte del MVP, owner 2026-10-01, Z):
`direcciónDeCambio` (§4.1). Es lo que decide si el monto se muta ya o si las capacidades caen al
fin del ciclo. Sin él lo único a mano es el `rank`, que el diseño ya rechazó por escrito.
**Contra `V2`.**

Pieza dueña del AC: [B8b](20-fase-2/B8b.md#pieza-b8b) · también: [V2](10-corte/V2.md#pieza-v2) (provee)
Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:379

<a id="dep-6"></a>
**DEP:6** — **Lee `B12`**, el retiro de un plan: `vigente`/`vendible` de `políticaDePlan` (§4.1);
`admiteAltas` y `finDeServicio` salieron (revisión del owner, 2026-09-28, C8). **Y la
migración** ✚: `vigente`/`vendible` de la versión destino y **`direcciónDeCambio`** para mostrar
a cada cliente si la migración le sube o le baja (revisión del owner, 2026-09-28, C15; `B/10`
§3.7). **Es la misma fila y no una nueva**: la misma pieza contra la misma de verticales, con un
campo ya declarado. **Contra `V2`.**

Pieza dueña del AC: [B12](20-fase-3/B12.md#pieza-b12) · también: [V2](10-corte/V2.md#pieza-v2) (provee)
Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:380

<a id="dep-7"></a>
**DEP:7** — **Lee `B3`**, el alta y la sucesión ([`S1`](04-catalogos.md#trans-b-s1)):
`vigente`/`vendible` de `políticaDePlan` (§4.1). Desde la FASE 9 vuelta 1 `S1` rechaza una
versión retirada (`N-G4V-07`; `B/03` §3.2); `admiteAltas` salió con la revisión del owner,
2026-09-28, C8. No es un campo nuevo: el §4.1 la declara como *«un consumidor más de un campo ya
declarado»*, y no mueve el grafo: `V2` llega antes que `B3`. **Contra `V2`.**

Pieza dueña del AC: [B3](10-corte/B3.md#pieza-b3) · también: [V2](10-corte/V2.md#pieza-v2) (provee)
Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:381, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:395

<a id="dep-9"></a>
**DEP:9** — **Lee `B10`**, [`A1`](04-catalogos.md#trans-b-a1), la venta de un addon: `ficha`
(vertical, dueño **y `admiteDestaque`** del objetivo; FASE 9 vuelta 1, `N-G4V-06`) y
`políticaDeAddon` (`addon`, vigencia, **`díasDeVigencia`**, tipo de scope de la versión), del
§4.1 (owner 2026-09-26, `G4-2`; FASE 9 vuelta 1, `F-8V1A3-008`, `F-8V1C1-008`). **Contra `V6` y
`V2`.** Es una entrada nueva del §4.1, no un campo de las que había. **`V6` llega antes que
`B10`: `V6` es del corte y `B10` de la Fase 3** (Z, AW; residuo corregido el 2026-10-02;
[`DEC-ARCH-017`](01-decisiones-vigentes.md#dec-arch-017)).

Pieza dueña del AC: [B10](20-fase-3/B10.md#pieza-b10) · también: [V6](10-corte/V6.md#pieza-v6) (provee), [V2](10-corte/V2.md#pieza-v2) (provee)
Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:383, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:402, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:405

<a id="dep-10"></a>
**DEP:10** — **Lee `B9b`**, el canje de una extensión de trial (era `B9`: corte del MVP, owner
2026-10-01, Z): `extenderTrial`, **la única escritura** de la dirección inversa: billing asienta el
canje sólo con `ACEPTADA` (owner 2026-09-26, `G4-2`; `F-8V1C1-009`). **Contra `V4`**, que ya era
gate de `B4`.

Pieza dueña del AC: [B9b](20-fase-2/B9b.md#pieza-b9b) · también: [V4](10-corte/V4.md#pieza-v4) (provee)
Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:384, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:405

<a id="dep-11"></a>
**DEP:11** — **Lee `B10`**, [`A6`](04-catalogos.md#trans-b-a6), el addon `LISTING` cuya ficha llegó a
`PURGED`: `fichaPurgada` (§4.1) y el hecho empujado del §3.1 (owner 2026-09-26, `G2-1`). **El
empuje lo consume `B10`, dueña de `A6`** (con OK del owner, 2026-09-26, FASE 9 vuelta 1, K).
**Contra `V6`, y contra `V9b` para el empuje de `PB9`** (era `V9`: corte del MVP, owner
2026-10-01, Z). Como en la 9, `V6` (corte) y `V9b` (Fase 1) llegan antes que `B10` (Fase 3).

Pieza dueña del AC: [B10](20-fase-3/B10.md#pieza-b10) · también: [V6](10-corte/V6.md#pieza-v6) (provee), [V9b](20-fase-1/V9b.md#pieza-v9b) (provee)
Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:385, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:402

<a id="dep-12"></a>
**DEP:12** — **Lee `B9a`**, el piso de un grant, al otorgar, al anclar y en el corte (era `B9`:
corte del MVP, owner 2026-10-01, Z): `políticaDePlan(v).vigente`. Billing acepta la versión que trae
el acto sólo si es la vigente, porque no tiene cómo resolverla sin leer `plan_version` (§2.8;
FASE 9 vuelta 2, `F-8V2C1-004`). Es un consumidor más de un campo ya declarado, y no mueve el
grafo: `V2` llega antes. **Contra `V2`.**

Pieza dueña del AC: [B9a](10-corte/B9a.md#pieza-b9a) · también: [V2](10-corte/V2.md#pieza-v2) (provee)
Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:386, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:408

<a id="dep-14"></a>
**DEP:14** — **La hora del trial, en la otra dirección: la pieza de verticales espera a la de
billing.** **`V4` lee** la interfaz del reloj del package del contrato, que escribe `B1` (§7.1,
punto 5): `V4` es la primera pieza de verticales que lee la hora, y sin la interfaz leería la del
sistema, que el reloj adelantable no mueve (FASE 9 vuelta 3, `F-8V3C1-006`). No es la dirección
inversa ni la de ida: es el package mismo, como la 1 es la tabla. **`V4` espera a `B1`.** No mueve
el grafo: `B1` es la primera pieza de billing, y `V4` llega después de `V3`.

Pieza dueña del AC: [V4](10-corte/V4.md#pieza-v4) · también: [B1](10-corte/B1.md#pieza-b1) (provee)
Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:388, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:416

**El conteo se recorre entero, no se suma.** Se recorrieron los campos del §4.1 uno por uno
buscando su lector, y cada campo que queda tiene un lector en estas filas; los que no aparecen es
porque ningún capítulo de billing los lee (`díasDeTrial` lo consumía la máquina de trial, del otro
lado de la frontera, y por eso salió de la firma: FASE 9 vuelta 1, `F-8V1C1-015`).

> **La regla de vigilancia cuenta contra algo vivo.** Es la del §4.2: **si billing necesita leer
> de verticales algo que no contesta ninguna de las preguntas del §4.1, el corte se está
> filtrando** — se mira, no se resuelve en el lugar. **Lo que hay que vigilar son las preguntas,
> que viven en el § que las declara, sin cifra** (FASE 9 vuelta 1, `F-8V1A3-014`); el número de
> dependencias es su consecuencia y se recuenta desde ahí.

**Y las contra `V2` no mueven el orden.** `V2` **ya era gate de `B2`** y es la **segunda** de la otra épica: esas dependencias llegan
resueltas mucho antes que `B7`, `B8b` y `B12`. Lo que cambia no es el orden: es que dejan de ser
invisibles.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:423, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:430, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:439

## La lista cerrada de ítems sólo citables (owner BA y BB)

Los ítems normativos que **ninguna pieza construye** —reglas de método, de CI, de organización y de
alcance (BA)— y los 📌 que **sólo retiran algo o son notas de registro** (BB) no exigen AC: son
**sólo citables**, y ésta es su lista **cerrada** (owner, 2026-10-01, BA y BB, las dos la 1;
[`DEC-METH-019`](01-decisiones-vigentes.md#dec-meth-019), su tercer 📌). La lista la fija y la
comprueba un script (`spec-consolidada/scripts/defs.py`, `SOLO_CITABLES`): cada id existe en el
inventario, la fila de su letra lo nombra con el fragmento que se cita abajo, y el hash de esa
fila no cambió desde que se escribió. **Un ítem que no está acá y es normativo exige su AC**, en
su pieza dueña.

| ítem | letra | la fila de la letra lo nombra así | qué es |
|---|---|---|---|
| [`INV:17`](02-nucleo.md#inv-17) | BA | `INV:17` | Hospeda gobierna el dominio: un principio de diseño, no se comprueba sobre una ejecución |
| [`INV:33`](02-nucleo.md#inv-33) | BA | `INV:33`–`INV:37` | no implementar supuestos sobre MP sin pruebas: regla de método (el §58 y la matriz de validación) |
| [`INV:34`](02-nucleo.md#inv-34) | BA | `INV:33`–`INV:37` | el código legacy dudoso se reescribe: regla de FASE 5 |
| [`INV:35`](02-nucleo.md#inv-35) | BA | `INV:33`–`INV:37` | sólo se conserva legacy correcto: regla de FASE 5 |
| [`INV:36`](02-nucleo.md#inv-36) | BA | `INV:33`–`INV:37` | la documentación se mantiene desde el minuto cero: regla del programa |
| [`INV:37`](02-nucleo.md#inv-37) | BA | `INV:33`–`INV:37` | cada handoff reconstruye lo realizado: regla del programa |
| [`DEC-CI-001`](01-decisiones-vigentes.md#dec-ci-001) | BA | `DEC-CI-001` con sus 📌1 y 📌2 | `epic/**` es un tipo de rama del proyecto, y no todos los workflows corren ahí |
| [`DEC-CI-001#📌1`](01-decisiones-vigentes.md#dec-ci-001-p1) | BA | `DEC-CI-001` con sus 📌1 y 📌2 | los cambios de CI y el guard de destino entran en un PR propio a `staging` antes de crear la rama épica |
| [`DEC-CI-001#📌2`](01-decisiones-vigentes.md#dec-ci-001-p2) | BA | `DEC-CI-001` con sus 📌1 y 📌2 | la condición corregida del guard de destino `check-umbrella-branch-target.sh` |
| [`DEC-CI-002`](01-decisiones-vigentes.md#dec-ci-002) | BA | `DEC-CI-002` | `develop` no se toca: es una condición adelantada, no un filtro muerto |
| [`DEC-ARCH-005`](01-decisiones-vigentes.md#dec-arch-005) | BA | `DEC-ARCH-005` con su 📌1 | el programa se parte en dos épicas autónomas, Verticales y Billing |
| [`DEC-ARCH-005#📌1`](01-decisiones-vigentes.md#dec-arch-005-p1) | BA | `DEC-ARCH-005` con su 📌1 | la partición sigue en pie aunque la pasarela ya está decidida; *«autónomas»* se lee como épicas que se citan y cruzan por contrato |
| [`DEC-ARCH-017#📌3`](01-decisiones-vigentes.md#dec-arch-017-p3) | BA | `DEC-ARCH-017#📌3` | las cuatro fases posteriores y su orden (AW) |
| [`DEC-MIG-002`](01-decisiones-vigentes.md#dec-mig-002) | BA | `DEC-MIG-002` | las altas nuevas siguen tomándose en el sistema actual durante el rediseño (lo que sobrevive de ella) |
| [`DEC-MIG-005#📌5`](01-decisiones-vigentes.md#dec-mig-005-p5) | BA | `DEC-MIG-005#📌5` | no se devuelve nada a nadie y el trial regalado no se presenta como compensación |
| [`DEC-AUTH-003#📌2`](01-decisiones-vigentes.md#dec-auth-003-p2) | BA | `DEC-AUTH-003#📌2` | «entrar como» el cliente queda para una versión posterior |
| [`DEC-DATA-005#📌4`](01-decisiones-vigentes.md#dec-data-005-p4) | BA | `DEC-DATA-005#📌4` | la baja de cuenta pedida por el usuario queda fuera de esta épica (HOS-1393) |
| [`DEC-MP-008#📌2`](01-decisiones-vigentes.md#dec-mp-008-p2) | BA | `DEC-MP-008#📌2` | la pausa o cancelación hecha por el pagador desde Mercado Pago, pendiente de medición en su momento |
| [`DEC-OBS-001#📌2`](01-decisiones-vigentes.md#dec-obs-001-p2) | BB | `DEC-OBS-001#📌2` | retira la acción 16 del resumen |
| [`DEC-ADDON-004#📌2`](01-decisiones-vigentes.md#dec-addon-004-p2) | BB | `DEC-ADDON-004#📌2` | registra que `S25` a `S28` salieron (C8) |
| [`DEC-SUB-013#📌2`](01-decisiones-vigentes.md#dec-sub-013-p2) | BB | `DEC-SUB-013#📌2` | registra que `S25` a `S28` salieron (C8) |
| [`DEC-MP-003#📌1`](01-decisiones-vigentes.md#dec-mp-003-p1) | BB | `DEC-MP-003#📌1` | corrige una cita ajena atribuida a la decisión |
| [`DEC-SUB-019#📌1`](01-decisiones-vigentes.md#dec-sub-019-p1) | BB | `DEC-SUB-019#📌1` | nota de registro sobre una cita no registrada en la matriz |

**Son 23 ítems: 18 de BA y 5 de BB.** **`DEC-TRIAL-004#📌3`** (teléfono, identificador fiscal y
dispositivo no se guardan) **no está en la lista**: se cubre con **un AC negativo en `V4`** (owner,
BB). La lista es cerrada: agregarle o sacarle un ítem es una decisión del owner, no una edición.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/41-corte-del-mvp/10-decisiones-del-owner.md:105, .specs/HOS-1352-billing-verticals-redesign/docs/41-corte-del-mvp/10-decisiones-del-owner.md:106, .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:8085

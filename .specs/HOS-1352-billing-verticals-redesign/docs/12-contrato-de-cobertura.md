---
title: El contrato de cobertura — la única frontera entre las dos épicas
linear: HOS-1352
statusSource: linear
created: 2026-09-18
updated: 2026-09-25
status: CURRENT
---

# 12 · El contrato de cobertura

> **Este documento es de la frontera, no de una épica.** Lo citan `HOS-1353` y `HOS-1354`, y
> **ninguna de las dos lo puede mutar sola** (`DEC-ARCH-006`). Una copia que una de las dos pueda
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

---

## 1. Qué problema resuelve

`DEC-ARCH-005` parte el programa en dos épicas autónomas, y eso sólo sirve si la de verticales
**puede correr sin que exista la de billing**. El punto de contacto no es teórico: el **paso 5**
de la resolución de autorización (cap. 17 §1.2) pregunta *«¿tiene trial, suscripción, cortesía o
grant que lo cubra?»*, y **tres de esas cuatro fuentes son de billing**.

Este contrato es ese paso 5, enunciado una sola vez, para que verticales lo pueda responder hoy y
billing lo pueda responder de verdad mañana **sin que verticales cambie**.

### 1.1 El mismo hecho, en cuatro lugares

Lo que verticales necesita de billing no está repartido: es **un hecho**, que el diseño ya pedía
en cuatro lugares distintos con cuatro nombres distintos.

| dónde | cómo se llama ahí |
|---|---|
| cap. 17 §1.2, paso 5 | *«¿tiene trial, suscripción, cortesía o grant que lo cubra?»* |
| cap. 03 §9, transición `PB2` | *«se pierde la cobertura»* |
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

### 1.2 Y no depende de lo que billing todavía no decidió

El capítulo 13 tiene abierta una pregunta grande: si el reloj de cobro es nuestro o del proveedor.
**Este contrato se escribe igual en los dos mundos** — en los dos hay un título con un estado y
una fecha hasta la cual cubre. Se puede definir hoy sin prejuzgar el 13.

> ✅ **Resuelta el 2026-09-24 por `DEC-MP-006`: el reloj es del proveedor.** Este § **no cambia**, y
> eso es justamente lo que vale la pena registrar: **la independencia que afirmaba se cumplió** — el
> contrato se escribió sin saber el desenlace y **no hubo que tocarlo cuando se supo**.

---

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

> **La fuente pasó de cinco campos a seis el 2026-09-25**, con `cobrada` (`DEC-TRIAL-010`; FASE 8
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
> suyo, y eso es lo que corre la fecha del ciclo); un `TRIAL`, el de `T1`; una `CORTESÍA` y un
> `GRANT`, el de su arranque; un `ADDON`, el de su instancia; el `BASE`, el alta de la cuenta
> (**queda escrito así, y se confirma el día que la versión de piso otorgue un entitlement medido**:
> hasta entonces no ancla nada; revisión del owner, casos vecinos, 2026-09-29, caso 11).
> Una fuente con `hasta = SIN_EMPEZAR` trae `desde = SIN_EMPEZAR`: su reloj no arrancó (§2.4).
> **No es una fecha de cobro** (§4): es la del alta de la fuente, no la de ningún pago.

Una sola pregunta, con la vertical **obligatoria en la firma** — no opcional~~, no deducible del
recurso~~. Es la misma forma estructural que el capítulo 17 §2.2 le dio a toda operación de dominio;
**y cuando la operación es sobre un recurso que guarda su vertical —una ficha, la presencia de un
Partner, una instancia de addon—, quien pregunta le pasa la vertical leída del recurso** (cap. 17
§1.2, precisión 6; FASE 9 completa, contradicción 1 del informe `08` y decisión 7a). *(Decía «no
deducible del recurso», la frase que el cap. 17 §2.2 tachó.)* Y por el mismo motivo: **una resolución que no se puede invocar sin el dato no tiene un control
que alguien pueda olvidar.**

### 2.1 Qué es cada campo, y quién lo consume

| campo | qué es | quién lo necesita |
|---|---|---|
| **`cubierto`** | si hay al menos una fuente viva **de clase `TÍTULO`** (§2.4). Es el §36 — *«permanece activo mientras al menos una source exista»* | **`PB1`**, que publica sólo con `cubierto` verdadero o si dispara `T1` (`V/03` §9; owner 2026-09-25; FASE 9 vuelta 1, `F-8V1C1-012`); `PB2`, `PB3` y `PB7` —**en su primera rama; la segunda de cada una mira el cupo y no este campo**, `V/03` §9—; **`PB4`, `PB5` y ~~el hard delete del día 180~~ `PB9`, el hard delete del día 180, que desde la FASE 8 completa es una fila** (FASE 9 vuelta 1, §4 punto 2 de `22-verificado-G2`), que lo releen **en el momento de ejecutar** y por eso son lectores propios y no una parte del reloj (§3); el §6 del capítulo 15; el reconciliador; y el reloj de inactividad, que se reinicia cuando **la respuesta** trae este campo en verdadero (`NUCLEO/01` §1.2, hecho 2); **`T1` y `T6`** de la máquina de trial, cuya guarda es este campo (`V/03` §2; FASE 8 completa, `F-8CC1-011`, owner 2026-09-25); **el reconciliador diario de cobertura**, que lo pregunta una vez por día por cada dueño con fichas fuera de `DRAFT`, ~~y~~ `PURGED` **y `MODERATED`** (`V/03` §9, `DEC-ARCH-009`; FASE 9 completa, `K-2`); y **los dos avisos previos de retención** —antes del día 90 y antes del día 180—, que lo releen antes de salir y no salen si viene verdadero (`NUCLEO/07` §6; FASE 8 completa, `F-8CA2-015`, owner 2026-09-25) |
| **`fuentes`** | **todas** las fuentes vivas, de las tres clases, no la que manda | el paso 5 de la autorización; el aviso de qué se pierde (cap. 15 §6.3) y el reconciliador, que necesita saber si apagar una deja las otras; **y `A1` de billing** (`B/03` §8), que lee si en la vertical del objetivo hay un título que no sea de `tipo: TRIAL` antes de vender un addon (FASE 9 vuelta 1, `F-8V1C1-008`) |
| **`tipo`** | `TRIAL` · `SUSCRIPCIÓN` · `CORTESÍA` · `GRANT` · `BASE` · `ADDON` | los avisos, que dicen cosas distintas según por qué se perdió; y la clase, que se deriva de él **y del `hasta`** (§2.4) |
| **`referencia`** | **la referencia, no los valores**: una versión de plan o una versión de addon. **No es anulable** (§2.3) | el paso 6: es cómo verticales sabe qué otorga esa fuente |
| **`alcance`** | `VERTICAL` · `LISTING` · `USER` · `GLOBAL` (§2.7) | el pliegue en dos tramos del conjunto efectivo |
| **`objetivo`** | la ficha, si `alcance = LISTING`; nada en los otros tres | ídem |
| **`desde`** ✚ | el instante en que la fuente empezó a cubrir, o `SIN_EMPEZAR` si su reloj no arrancó (§2, revisión del owner, 2026-09-28, C4) | **la ventana de la cuota mensual** (`V/15` §7), que lo lee **sólo al abrir una ventana nueva**, para fijar el día del ciclo de la siguiente. **Esta fila es el censo de sus consumidores**, con la regla de la de `cubierto` |
| **`hasta`** | uno de cuatro valores, y ninguno es «sin fecha» a secas (§2.6) | los avisos con ventana (cap. 15 §4.4) |
| **`cobrada`** | en una fuente `SUSCRIPCIÓN`, si **esa fila** tiene **al menos un pago acreditado** —un cobro del proveedor aprobado, leído por id (`B/09` §4), o una cuota de pagador manual registrada (`MP1`, `B/03` §7)—; en los otros cinco `tipo`, nada. **No entra en la clase ni en `cubierto`** (abajo) | **`T2` y `T5`** de la máquina de trial, que convierten sólo con una suscripción que ya cobró (`V/03` §2; `DEC-TRIAL-010`, owner 2026-09-25; FASE 8 completa, `F-8CA2-006`, `F-8CC1-002`); **y `T6` y `T8`**, que desde la FASE 9 completa piden un título que convierte para consumir la fila de `trial` (`V/03` §2; owner 2026-09-25, decisión 6c). **Esta fila es el censo de sus consumidores**, con la misma regla que la de `cubierto` (abajo) |
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

#### `cobrada`: un bit sobre la fila, y lo lee sólo la máquina de trial

(`DEC-TRIAL-010`, owner 2026-09-25; FASE 8 completa, `F-8CA2-006`, `F-8CC1-002`.)

**Qué problema resuelve.** `T2` convertía el trial en cuanto aparecía una fuente `SUSCRIPCIÓN`, y
una suscripción emite desde `ACTIVE` (§2.6), **antes de cualquier cobro**: el primero llega entre
26 y 44 minutos después de autorizar (`PA-3`, `B/12` §4.3). Si se rechazaba, la fila moría en
`CHARGE_DECLINED` y la persona quedaba sin suscripción **y sin trial**, que no se devuelve. La
frontera no distinguía *«autorizó»* de *«cobró»*, así que `T2` no tenía con qué esperar.

**Qué es exactamente.** Un booleano **de la fila**, no de la persona ni del `user + vertical`: la
misma lectura por autorización que `B/12` §4.3 hace para el primer cobro. Lo resuelve billing:
`sí` si esa fila tiene al menos un pago acreditado, `no` si no. En un pagador manual es `sí`
desde que la fila llega a `ACTIVE`, porque `S29` sólo la lleva ahí con la primera cuota registrada
(`B/03` §3.2). Puede venir en `no` sobre una fila `ACTIVE` que todavía no cobró, sobre una
`CANCEL_SCHEDULED` que se dio de baja antes del primer cobro y sobre una sucesora cuyo primer cobro
difiere `D8` (`B/12` §4.3); sobre una `GRACE_PERIOD` ~~no, porque `S4` exige un pago acreditado
(`B/03` §3.2)~~ **casi nunca**: `S4` exige un pago acreditado (`B/03` §3.2), **salvo sobre la
sucesora cuya predecesora venía pagando**, que desde la FASE 9 completa entra al grace cuando su
primer cobro se rechaza y llega ahí con `cobrada: no` (owner 2026-09-25, decisión 3c).

**Lo que NO cambia, y es lo que lo vuelve seguro:**

1. **La clase no se deriva de él.** Sigue saliendo del `tipo` y del `hasta` (§2.4): una
   `SUSCRIPCIÓN` con `cobrada: no` es de clase `TÍTULO`.
2. **`cubierto` no lo lee.** Quien acaba de autorizar está cubierto, como antes: `PB3` le
   republica, el paso 6 le resuelve su plan y el reconciliador diario no ve ninguna diferencia.
   El único consumidor es ~~la conversión del trial~~ **la máquina de trial**: la conversión (`T2`,
   `T5`) y, desde la FASE 9 completa, el consumo de la fila (`T6`, `T8`; decisión 6c).
3. **No reabre `DEC-TRIAL-008`.** Aquella decisión rechazó un bit que distinguiera **los estados que
   no emiten fuente** —el que separaría a un `SUSPENDED` de quien no tiene nada—. `cobrada` viaja
   **dentro de una fuente que ya se emite**: no dice nada de las filas que no emiten, y esas
   siguen siendo indistinguibles de no tener nada (§4).

### 2.2 `fuentes` es una lista, y eso no es de más

Podría parecer que alcanza con `cubierto`. No alcanza, y el caso está en el diseño: **quitar una
fuente no quita la cobertura si queda otra.** Un reconciliador que no vea las demás apaga
capacidades que la persona sigue teniendo, que es exactamente lo que el capítulo 15 §4 va a
evitar. La lista es lo que permite decidir sin volver a preguntar.

### 2.3 `versiónDePlan` es un puntero, y ahí está la división del trabajo

Es la parte más fina del contrato y conviene decirla despacio.

**El paso 6 pregunta qué otorga la fuente. Quién sabe *qué otorga* un plan es verticales** —
`plan_version_entitlement` y `plan_version_limit` son tablas suyas (`DEC-ARCH-005`). **Quién sabe
*cuál plan* tiene esta persona es billing**, porque la suscripción ancla su versión (`DEC-ARCH-001`).

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
pausa no dejan huérfano a nada»* y que el reloj del addon *«no se congela»* (`DEC-ADDON-001`): una
instancia de addon **viva** convive con una suscripción `SUSPENDED`, a la que el §21 deja *«sin
entitlements comerciales»*. Con `cubierto` definido como *«al menos una fuente viva»*, ese
suspendido quedaría cubierto por su propio addon — **dejó de pagar y sigue adentro**, y el
fail-open lo habría **introducido el arreglo**, que es la forma de defecto que `DEC-METH-004` manda
a evitar.

Y no inventa una regla: escribe una que ya rige en dos capítulos. El §38 exige *«una subscription
válida compatible»* para adquirir un addon, y `B/16` §2.4 declara su única excepción —*«un grant
permanente vale como título en lugar de la suscripción `ACTIVE`»*—. **Un addon nunca fue un título:
era el complemento de uno.**

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
> definición; aquél es la ejecución, y lleva su guard (`G-R2`, `V/20` §2). La primera versión de
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
(`DEC-ADDON-001`) se puede decidir cuando se quiera, sin tocar esta regla.

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
   un `TRIAL_EXPIRED`, `PB2` sigue disparando cuando el trial vence, y el criterio que el §5.1 le
   pone a la implementación de arranque —*«un trial vence de verdad»*— sigue en pie.
2. **No otorga ninguna clave comercial.** La versión de piso otorga lo mínimo para existir,
   **recuperar lo suyo** y volver a contratar — las **tres** cosas de su lista cerrada
   (`V/02` §2.1). Es el mismo punto único de falla que la versión de pre-trial, y lo vigila el
   **mismo guard**: `G-R3` se comprueba sobre las dos versiones no vendibles de cada vertical, no
   sobre una. **La tercera no lo toca**: traer a borrador una ficha propia archivada (`PB8`) no
   publica, no cuenta contra ningún limit y no alcanza una ficha ajena, así que no es ni una clave
   comercial ni un entitlement medido.

   **Y que la segunda y la tercera ESTÉN lo vigila el mismo guard por su otra mitad.** Es la mitad
   *(b)* de `G-R3` (`V/20` §2), y hace falta acá más que en ninguna otra parte: el párrafo de arriba
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

### 2.6 `hasta` tiene cuatro valores, y ninguno es «sin fecha» a secas

Con seis tipos de fuente, *«sin fecha»* pasa a significar tres cosas incompatibles, y el aviso no
puede elegir qué decir:

| valor | cuándo | qué tiene que entender el aviso |
|---|---|---|
| **`fecha`** | el fin ya está determinado: `CANCEL_SCHEDULED` con la fecha de `DEC-SUB-009`, fin de cortesía, vencimiento de un addon `DÍAS_FIJOS`, fin del trial | ~~hay ventana, y es ésta~~ **esta fuente deja de emitirse ese día** —el fin de la **emisión**, no el de la cobertura: otra fuente puede tomar su lugar—; **si eso abre una ventana para elegir lo decide `V/15` §4.4**, que se la da al vencimiento de un addon y al fin de una cortesía, y no al fin del trial (FASE 8 completa, `F-8CC1-008`, owner 2026-09-25) |
| **`NO_VENCE`** | grant permanente, título `BASE` | no hay ventana **porque no hay fin por calendario** — que no es lo mismo que *«no se apaga»*: un grant se apaga al revocarse, sin anticipación (§2.8) |
| **`SIN_FECHA_CONOCIDA`** | suscripción `ACTIVE`, addon `MIENTRAS_VIVA_LA_SUSCRIPCIÓN` | no hay ventana **porque todavía no se sabe** |
| **`SIN_EMPEZAR`** | la fuente de trial en `PRE_TRIAL` | no hay ventana **porque el reloj no arrancó** |

`V/15` §4.4 reparte las ventanas ~~exactamente por esa diferencia~~ **sobre esa diferencia, pero no
la copia**: *«vencimiento de un addon · fin de una cortesía»* tienen ventana; *«revocación de un
grant»* no; **y *«fin del trial»* tampoco, aunque su `hasta` sea una `fecha`** —se aplica en el acto
(`V/15` §4.4)—. Este renglón decía *«exactamente»* y ponía el fin del trial entre los que tienen
ventana, y los dos documentos se contradecían; **manda `V/15` §4.4**, que es el consumidor que
decide la ventana (§2.1, fila `hasta`), y es coherente con la máquina de trial, que agenda su propia
campaña previa (`T1`) y aplica la pérdida en el acto (`T3`, `V/03` §2) (FASE 8 completa,
`F-8CC1-008`, owner 2026-09-25).

⚠️ **Lo que esto NO cierra, declarado por `DEC-METH-015`**: la fuente `CORTESÍA` de una `PAUSED`
por `COURTESY` tiene `hasta: fecha`, y **lo normal ese día es `S10`**, que vuelve a `ACTIVE` y
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
actúan —`PB2`, el caché y el reconciliador de excedentes— no se enteraban hasta que corriera el
job atascado. **Lo que la lleva hasta ellos es el reconciliador diario de cobertura** (`V/03` §9,
`DEC-ARCH-009`): pregunta en vivo una vez por día, encuentra `cubierto` falso contra fichas
publicadas, corre `PB2` e invalida la entrada. Con un día de atraso, y **sólo si la fecha vencida
produce una diferencia de fichas**; lo que no la produce queda declarado en el ⚠️ de ese §.

#### Qué emite cada estado de la suscripción — los nueve, sin huecos

El `hasta` estaba enumerado por **situación** y no por **estado**, y así quedaban cuatro de los
nueve estados de la suscripción **sin respuesta declarada**. Uno de ellos es el que la sucesión
volvió frecuente.

| estado (`B/03` §3.1) | ¿emite fuente? | `hasta` | por qué |
|---|---|---|---|
| `PENDING_AUTHORIZATION` | **no** | — | ver abajo |
| `ABANDONED` | **no** | — | `S3` canceló el preapproval: no hay nada |
| `ACTIVE` | **sí** | `SIN_FECHA_CONOCIDA` | se renueva sola; el fin no está determinado |
| `GRACE_PERIOD` | **sí** | `SIN_FECHA_CONOCIDA` | el §20 da **servicio entero** durante el grace |
| `PAUSED` por `CUSTOMER_REQUEST` | **no** | — | `B/16` §2.2: *«el servicio está detenido»* |
| `PAUSED` por `COURTESY` | **sí**, como `tipo: CORTESÍA` | la fecha de fin de la cortesía | lo sostenemos nosotros (`DEC-GRANT-003`) |
| `SUSPENDED` | **no** | — | el §21 lo deja *«sin entitlements comerciales»* |
| `CANCEL_SCHEDULED` | **sí** | **la fecha** de fin de servicio de `DEC-SUB-009` | es *«un dato nuestro»* y ya está determinado |
| `CANCELLED` | **no** | — | terminada |
| `CHARGE_DECLINED` | **no** | — | terminal, y ~~el proveedor ya canceló el preapproval~~ **`S16` canceló el preapproval —de nuestro lado, si el proveedor no lo había hecho—** (FASE 9 completa, `C12` del informe `01`; `B/03` §3.2) |

> **Una suscripción esperando autorización NO emite fuente de cobertura.**

**Y es la respuesta cara de las dos.** Emitirla significa **hasta lo que dure la ventana de
autorización de servicio completo gratis, y repetible** —se abandona el checkout y se empieza de
nuevo—, y **esa ventana no es una sola**: **72 horas** con tarjeta y **7 días corridos** con pago
manual (`B/03` §3.4 punto 1, `DEC-SUB-016`), o sea que sobre el pagador manual la respuesta cara
lo es **más del doble**. Y durante una sucesión
significa **los dos planes sumados** hasta que la nueva se autorice. Las dos lecturas cuestan
plata en la misma dirección.

**Y no deja a nadie en la nada**, que es la objeción obvia: a quien recién contrata **le sigue
rigiendo el piso** (§2.5), y a quien está cambiando de plan **lo sigue cubriendo su suscripción
vieja**, que es justamente lo que `D7` mantiene viva hasta que la nueva quede autorizada.

**Con una salvedad que conviene decir en vez de suponerla, porque la predecesora se puede morir
sola.** `D7` la mantiene viva contra **nuestras** cancelaciones, no contra los relojes ni contra
el proveedor: de las ~~**ocho**~~ ~~**diez**~~ ~~**nueve**~~ ~~**diez**~~ **nueve** transiciones que la mueven durante la ventana
(recontadas con `DEC-SUB-021`, owner 2026-09-25: `GRACE_PERIOD` dejó de ser estado de declaración,
así que `S6` y `S24` salen de la cuenta de `B/03` §3.2 y `S4` entra; **y entra `S36`, la fila 12**,
FASE 9 vuelta 1, M; **y sale `S27`**, que ya no existe: revisión del owner, 2026-09-28, C8), ~~**cuatro la sacan de
las filas vivas sin que nadie declare nada** —`S12`, `S13`, `S16` y **el espejo de la baja que
decide el proveedor** (`B/03` §3.2 y §10.1)—~~ **tres la sacan de las filas vivas sin que nadie
declare nada** —`S12`, `S16` y **el espejo de la baja que decide el proveedor** (`B/03` §3.2 y
§10.1)—. **`S13` no**: también la saca, pero alcanza *«a toda fila viva principal del beneficiario,
o sea también a la sucesora»* (`B/03` §3.2) y deja un `GRANT` de clase `TÍTULO`, así que el cliente
no cae al piso (FASE 9 completa, `C-8`). ~~**La octava, `S24`, también la saca y no entra en
esa cuenta**~~ **`S24` también la saca y tampoco entra en esa cuenta** —ya no es una de las nueve,
pero sigue ocurriendo sobre una predecesora que llegó al grace durante la ventana—: ahí el cliente **pidió la baja él mismo** en medio del grace (`DEC-SUB-014`), así
que caer al piso no es algo que le pase sin que nadie declare nada — es la consecuencia del acto
que acaba de confirmar, y `B/19` §4 fila 8 se lo dice antes. **`S36` también la saca y tampoco
entra en esa cuenta, por la misma razón que `S24`** (FASE 9 vuelta 1, M): desde `ACTIVE` o
`CANCEL_SCHEDULED` es una de las diez y la predecesora deja de emitir en el acto —`S36` corta el
servicio sin pasar por `CANCEL_SCHEDULED`—, pero la revocación **la pidió el cliente** dentro de los
10 días (`DEC-RF-001`), y una persona sólo la registra; caer al piso no le pasa sin que nadie
declare nada — es la consecuencia del arrepentimiento que él mismo ejerció, con el reembolso del
último pago en camino (`RF1`). ~~**La novena y la décima**~~ ~~**Las
otras dos terminales —`S23` y
`S27`, desde una `SUSPENDED` de pagador con tarjeta, que es estado de declaración desde la FASE 8
completa (`F-8CB1-002`)— tampoco entran**~~ **La otra terminal, `S23` desde una `SUSPENDED` de
pagador con tarjeta, que es estado de declaración desde la FASE 8 completa (`F-8CB1-002`), tampoco
entra** (revisión del owner, 2026-09-28, C8: `S27` ya no existe), y no por la causa sino porque no le cambian nada a la
cobertura: `SUSPENDED` ya no emitía ninguna fuente (§2.6), así que el piso lo tenía desde antes de
morir. En esas ~~cuatro~~ tres la predecesora deja de
emitir y la sucesora todavía no emite, así que **el cliente cae al piso (§2.5) por lo que le quede
de ventana**, hasta que autorice o abandone. No es un hueco nuevo, ni una consecuencia de que el
cierre de la sucesión pase a correr antes de la autorización —`PENDING_AUTHORIZATION` no emite ni
antes ni después—: es lo que ya pasaba sin estar escrito. **Y se acepta**, porque las ~~cuatro~~ tres tienen
la misma causa —el compromiso que sostenía la cobertura **terminó**— y la alternativa es la
respuesta cara del párrafo de arriba. Lo que sí se exige es que la superficie lo diga: `B/19` §4,
filas 16 y 16-bis —**que tienen que decirle que perdió la cobertura y que sus fichas vuelven
cuando autorice**, no sólo que el cambio *«no se ofrece»* (FASE 9 completa, `C-8`)—.

**Y la garantía termina donde termina la sucesión, así que hay que decir qué pasa después.** La
frase de arriba —*«hasta que la nueva se autorice»*— cierra la ventana **anterior** a la
autorización, y hay una ventana **posterior**: cuando la sucesora ya autorizó pero la
cancelación de la predecesora en el proveedor **falló**, `B/03` §3.2 deja las dos filas donde
estaban, con la marca puesta, y `B/03` §3.1 es explícito en que una fila marcada *«conserva el
estado que tenía, y sigue cubriendo a quien estaba cubierto»*. ~~Las dos emiten.~~ **Emite sólo la
sucesora** (owner 2026-09-25; FASE 8 completa, `F-8CC1-007`, `F-8CA1-012`): ~~**una fila con una sucesora en `ACTIVE` apuntándola (`sucede_a`) no emite
fuente**~~ **una fila cuya sucesora ya autorizó —una fila que la apunta por `sucede_a` y salió de
`PENDING_AUTHORIZATION` hacia `ACTIVE`— no emite fuente, en ningún estado posterior de esa
sucesora**: ni en `GRACE_PERIOD` (3c) ni después (FASE 9 vuelta 1, `F-8V1C1-007`; una condición
escrita sobre un estado se rompe cada vez que una decisión abre el estado vecino), aunque su cancelación en el proveedor haya fallado y siga marcada. El cambio de plan
**ocurrió** en el momento en que la sucesora autorizó; lo que falta es sólo la llamada, y eso lo
resuelven el reintento del barrido y la marca, no la cobertura.

> ~~**Dos fuentes `SUSCRIPCIÓN` de clase `TÍTULO` para el mismo `user + vertical` son posibles, y
> sólo en ese caso.** El contrato no las desempata: `fuentes` las devuelve a las dos y el pliegue
> de `V/15` §2.2 las agrega como a cualquier otro par.~~ **Desde el 2026-09-25 no son posibles:**
> en esta rama sólo emite la sucesora, así que `fuentes` nunca devuelve dos `SUSCRIPCIÓN` de clase
> `TÍTULO` para el mismo `user + vertical`.

~~**No se desempata porque en esa rama el cliente está pagando las dos**, y desempatar sería la
única forma de cobrarle dos planes y darle uno.~~ **La razón que se daba —*«en esa rama el cliente
está pagando las dos»*— es falsa, y se tacha** (FASE 8 completa, `F-8CC1-007`, `F-8CA1-012`). La
sucesora nació con **el crédito de lo pagado y no usado de la predecesora** (`DEC-SUB-006`,
computado al crearla, `B/12` §5.4), que le corrió la fecha de primer cobro: lo que la predecesora
sigue emitiendo durante el incidente es un período **que ya se transfirió como crédito**, y la
sucesora todavía no cobró nada por sí misma. Y si la predecesora está en `GRACE_PERIOD` —llegó ahí
durante la ventana por `S4`, `B/03` §3.2—, su período en curso **ni siquiera se pagó**. En ninguno
de los dos casos el cliente paga dos planes.

~~⚠️ **Y con la razón corregida, la regla de sumar da más capacidad de la pagada**: con `SUMA`, un
Básico de 5 fichas más un Premium de 20 le dan 25 pagando uno solo, hasta que una persona resuelve
la marca y el excedente cae (`F-8CC1-007`); sobre una predecesora en grace, el cupo de un período
impago se suma al de la sucesora (`F-8CA1-012`). **La regla no se cambia acá**: las dos salidas que
proponen los hallazgos —desempatar por la sucesora, que es la que tiene el crédito, o no sumar una
predecesora en `GRACE_PERIOD`— cambian qué cubre el contrato, y **quedan pendientes** con estos dos
casos. Mientras tanto la regla sigue siendo la de arriba: las dos fuentes se agregan.~~
**Cerrado el 2026-09-25 por la primera salida**: manda la sucesora, que es la que tiene el crédito
(owner 2026-09-25; FASE 8 completa, `F-8CC1-007`, `F-8CA1-012`). Un Básico de 5 fichas más un Premium de 20 dan **20**, lo que se paga, y cuando la marca
se resuelve no cae ningún excedente que la persona no esperaba.

~~Tampoco hay decisión de cobertura que tomar:~~ **El otro argumento sigue en pie**: la
rama es un incidente declarado, con la marca puesta y una persona mirándolo, y su salida es
resolver la cancelación —no elegir qué fuente vale—. Lo que no puede pasar es que el caso quede
sin nombrar, porque entonces el techo de lo que alguien puede tener depende de si una llamada al
proveedor salió bien.

**Y no es alcanzable por ningún otro camino.** Las ~~**ocho**~~ ~~**diez**~~ ~~**nueve**~~ ~~**diez**~~ **nueve** transiciones que mueven a la
predecesora durante la ventana de autorización —`S8`, `S9`, ~~`S6`,~~ **`S4`**, `S12`, `S13`, `S16`, ~~`S24`,~~ el espejo
del
`B/03` §10.1, que es la que la tabla numerada del §3.2 no lista, y `S23` ~~y `S27`~~ (FASE 8 completa,
`F-8CB1-002`; recontadas con `DEC-SUB-021`; `S27` salió con la revisión del owner, 2026-09-28, C8), **y `S36` desde `ACTIVE` o `CANCEL_SCHEDULED`** (FASE 9
vuelta 1, M)— la dejan en un estado que **no
emite** en ~~siete de los ocho~~ ~~nueve de los diez casos; la excepción es~~ ~~**siete de los nueve
casos; las excepciones son dos**~~ ~~**ocho de los diez casos; las excepciones son dos**~~ **siete de los nueve casos; las excepciones son dos**:
`S9`, que la deja emitiendo pero con `tipo: CORTESÍA`, que no es una segunda `SUSCRIPCIÓN`, **y
`S4`, que la deja en `GRACE_PERIOD`, que emite la misma `SUSCRIPCIÓN` que emitía en `ACTIVE`** —una
sola: la sucesora, en `PENDING_AUTHORIZATION`, todavía no emite—. **`S6` —por su tercer evento, el único
que la guarda de la sucesión en curso no frena (`B/03` §3.2)—, `S24` y `S36` siguen pudiendo ocurrir desde
ese grace y no cambian la conclusión**: ~~las dos~~ **las tres** la dejan sin emitir (`SUSPENDED`, `CANCELLED`, `CANCELLED`; `S36`, FASE 9 vuelta 1, M). **Y `S36` sale también de
`PAUSED`** (owner 2026-09-26, `X-2`), alcanzable por `S8`/`S9`: la deja `CANCELLED`, sin emitir, y
tampoco cambia la conclusión. Y en
todas, si
la sucesora autoriza, la predecesora deja de emitir: o ya no emitía, o `S17` la lleva a
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

#### ~~Una vertical discontinuada no cubre a nadie~~

~~Desde la fecha de fin de servicio de la vertical, que contestaba `finDeServicio`, el contrato no
emitía en esa vertical ninguna fuente de `tipo` `TRIAL`, `SUSCRIPCIÓN`, `CORTESÍA` ni `GRANT`
(FASE 8 completa, `F-8CC1-001`, `F-8CA2-007`, owner 2026-09-25; FASE 9 vuelta 2, `R5`).~~ **Sacada
entera** (revisión del owner, 2026-09-28, C8): las verticales no se discontinúan, así que no hay
fecha de fin de servicio de una vertical, ni regla de emisión que la lea, ni pregunta que la
cruce. La emisión vuelve a decidirse sólo por el estado de cada fuente (las tres tablas de arriba,
del §2.8 y de `V/03` §2). **Retirar planes sigue existiendo, también todos los de una vertical**
(`B/10` §3), y no toca esta regla: una versión retirada deja de venderse y quien la tiene la
conserva. Discontinuar una vertical queda **fuera de esta versión; si algún día hace falta, se
diseña entonces**, y el diseño viejo está en `DEC-SUB-015`, `DEC-SUB-018`, `DEC-GRANT-010` y
`DEC-ARCH-011`.

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
grant no transporta el ancla de otra vertical (§2.8). Lo vigila `G-R2-C` (`V/20` §2), gemelo de
`G-R2-B` (owner 2026-09-25; FASE 9 completa, decisión 4e, `F-8CA1-008`). Sin esta línea, un addon
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
dispara `S13`.** Las dos mitades son necesarias y ninguna se infiere de *«queda auditado»*:

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
   `includesAddons: true`, es que los compatibles se convierten a costo $0**: `S20` cancela su
   suscripción de complemento y la instancia pasa a colgar del ancla, sin reembolso del período
   ya cobrado (`B/16` §3.4). Conservarlos y seguir cobrándolos no son lo mismo, y el §35.2 pide
   lo primero sin lo segundo.

**Desanclar no está declarado, y esto no lo declara.** Reducir el scope de un grant sin revocarlo
entero no es una operación de este diseño; si alguna vez se necesita, entra por el catálogo del
`NUCLEO/08` §3 con su propia fila, su confirmación y su transición —cortar servicio en una
vertical es la mitad de *«la acción administrativa más grave»*— y no como un efecto lateral de
borrar una fila.

#### Un grant emite mientras está vivo, y revocarlo no borra sus anclas

**La fuente `GRANT` de una vertical existe mientras el ancla de esa vertical esté VIVA** ~~—**y
mientras esa vertical no haya llegado a su fin de servicio**, sin revocar nada: el ancla sigue
viva (§2.6, *«una vertical discontinuada no cubre a nadie»*; FASE 8 completa, `F-8CC1-001`, owner
2026-09-25)—~~ (revisión del owner, 2026-09-28, C8: las verticales no se discontinúan). *Vivo*
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
   publicando una versión no vendible (`D13`, cap. 10 §3.2), así que el día que se retira Premium
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

---

## 3. El aviso

```text
evento: la cobertura de (user, vertical) cambió
```

Es lo único que billing le **empuja** a verticales. Lleva qué fuente cambió y en qué dirección, y
alimenta ~~**tres**~~ **cuatro** cosas que ya existen en el diseño: la transición `PB2` de publicación, la lista de
invalidación del caché (cap. 02 §3.2) —que es la **misma lista** que dispara el reconciliador de
excedentes (cap. 15 §4.2), *«una lista, dos consumidores»*—, **el reloj de inactividad**, cuyo
hecho 2 es *«la cobertura se comprueba verdadera»* (`NUCLEO/01` §1.2) — un estado leído, no un
cambio detectado, a diferencia del **evento** de `PB2`, `PB3` y `PB7`, que sí es un cambio— **y la
máquina de trial**, cuyos `T2` y `T5` disparan cuando aparece ~~una fuente viva de clase `TÍTULO`~~
**un título que convierte** —una fuente viva de clase `TÍTULO` que no es la del trial y que, si es
`SUSCRIPCIÓN`, trae `cobrada: sí` (`DEC-TRIAL-010`)— (`V/03` §2 los ata a este mismo aviso). La cuarta faltaba, y quien implementara el emisor contra
esta lista podía no despertar al trial: la persona se suscribía y quedaba con dos títulos hasta
que el trial venciera (FASE 8 completa, `F-8CC1-011`, owner 2026-09-25).

**Y desde `DEC-TRIAL-010` hay un cambio de cobertura que no aparece ni apaga ninguna fuente, y
también lleva aviso** (owner 2026-09-25; FASE 8 completa, `F-8CA2-006`, `F-8CC1-002`): **el primer
pago acreditado de una fila**, que pasa su `cobrada` de `no` a `sí` (§2.1). `cubierto` no se mueve,
pero es el hecho que ~~`T2` y `T5` esperan~~ `T2`, `T5` **y `T8`** esperan (FASE 9 vuelta 1, `F-8V1A2-010`); sin aviso, `T2` quedaría esperando hasta que `T3` venciera
el trial. Los otros tres consumidores lo reciben como cualquier otro —recalculan y vuelven a
preguntar— y no encuentran nada que hacer. **Y el reconciliador diario de cobertura no es su red**:
no corre la máquina de trial (`V/03` §9, ⚠️ punto 3).

**El aviso es rápido; la red es el reconciliador diario de cobertura** (`DEC-ARCH-009`, owner
2026-09-25; `V/03` §9). El aviso no tiene transporte durable —el outbox del núcleo es de correos—,
así que **perderlo es un caso declarado, no un incidente**, y una vez por día verticales vuelve a
preguntar por cada dueño con fichas fuera de `DRAFT`, ~~y~~ `PURGED` **y `MODERATED`** (`F-8CA2-004`), compara con el estado de sus
fichas y, si no coinciden, corre la transición que el aviso habría disparado —`PB7`/`PB3`
republican, `PB2` despublica—, escribe el reloj (hechos 2 y 5) e invalida el caché. **No es un
quinto consumidor del aviso**: no lo escucha; es la pregunta del §2.1 hecha por calendario, y
figura en esa fila. Cubre por igual el aviso perdido, la fecha que vence sin transición (§2.6) y
cualquier camino que nadie previó, **con hasta un día de atraso**. **Y a cada partner ~~con presencia cargada~~ con una clave de presencia** —la página o, desde la FASE 9 completa, el carrusel (decisión 7b); la población está en `V/03` §9— le resuelve en vivo ~~el entitlement de presencia~~ las dos claves y, si el caché dice otra cosa, lo invalida: la presencia no tiene máquina (`V/18` §1.6, `V/03` §9; FASE 8 completa, `R13`, owner 2026-09-25). Lo que no cubre —la máquina de
trial, el dueño ~~que sólo tiene borradores~~ **sin ninguna ficha publicada** (FASE 9 completa, `B-1`), el caché sin diferencia de fichas— está declarado en el
⚠️ de ese §.

**Quién emite** (FASE 9 vuelta 1, `F-8V1C1-006`, 2026-09-26). **Emite el aviso, ~~en el mismo
acto~~ después del commit de su escritura y nunca dentro de su transacción** (abajo, *«el aviso
sale después del commit»*; FASE 9 vuelta 2, `F-8V2C1-002`), **toda escritura que cambia la
respuesta del §2.1 para algún `(user, vertical)`**: que agrega o saca una fuente, o le cambia
`referencia`, `desde` (revisión del owner, 2026-09-28, C4), `hasta`, `alcance`, `objetivo`, `cobrada` o `piso`. Un addon `USER`/`GLOBAL` emite en
cada vertical compatible de su producto (§2.7). **Una fecha que vence sin transición no emite**
(§2.6): la cubre el reconciliador. ~~**Éste es el censo de emisores, y va sin número, con la regla
de la fila `cubierto`**: quien agregue un emisor agrega su sintagma acá en el mismo acto. Hoy: las
filas de `B/03` §3.2 cuyo `desde` y `hacia` emiten distinto según *«qué emite cada estado»* (§2.6),
el espejo del §10.1 incluido; `P1` sobre el primer pago acreditado de una fila; las filas que abren,
extienden o cierran una cortesía; otorgar y revocar un grant (`NUCLEO/08` §3); `A2`, `A4`, `A5`
y `A6`; y `T1`, `T2`, `T3`, `T4` y `T5`, que mueven la fuente de trial, en las dos
implementaciones.~~

> **El censo es la regla de arriba, y no la lista de abajo** (FASE 9 vuelta 2, `F-8V2C1-003`,
> `F-8V2C1-007`, `F-8V2A2-008`). **Todo acto que cambia una fuente emite**, esté o no en la lista.
> La lista se escribió por filas y dejó afuera dos veces a quien la regla ya alcanzaba, así que es
> la auditoría de la regla y no su definición: sirve para buscar, y quien agregue un acto que
> mueve una fuente lo suma acá en el mismo commit.

**La lista auditada**, recorridas el 2026-09-27 las tablas de `B/03` §3.2, §6.1 y §8, la de `V/03`
§2 y el catálogo de `NUCLEO/08` §3, fila por fila, buscando un acto que cambie la respuesta:

- **las filas de `B/03` §3.2** cuyo `desde` y `hacia` emiten distinto según *«qué emite cada
  estado»* (§2.6), el espejo del §10.1 incluido;
- **`P1`** sobre el primer pago acreditado de una fila;
- **las filas que abren, extienden o cierran una cortesía**;
- **otorgar un grant, anclarle una vertical nueva y revocarlo**, las tres escrituras de la fila
  del grant en `NUCLEO/08` §3. **El anclaje faltaba** (`F-8V2C1-003`), y es la tercera escritura
  que cambia la cobertura (`V/02` §3.2): cuando el beneficiario no tenía suscripción en esa
  vertical, `S13` no mueve ninguna fila, así que sin esta línea no salía ningún aviso;
- **`A2`, `A4`, `A5` y `A6`**;
- ✚ **el cambio de versión de una migración de un plan retirado**, en su fecha de aplicación, por la
  cola de `B/12` §2 (revisión del owner, 2026-09-28, C15; `B/10` §3.7), **y el descenso de un
  downgrade, que viaja por la misma cola: los dos los aplica `S38`** (`B/03` §3.2; revisión del
  owner, casos vecinos, 2026-09-29, caso 37; el descenso faltaba en esta lista): le cambia la `referencia` a
  la fuente `SUSCRIPCIÓN` sin cambiar el estado de la fila, así que la regla de *«`desde` y `hacia`
  emiten distinto»* no la alcanza. **`S37`, que muta el monto siete días antes, no emite**: el
  monto no es un campo de la fuente;
- **`T1`, `T2`, `T3`, `T4` y `T5`**, que mueven la fuente de trial, **y `T6`, ~~`T7`~~ y `T8`**, que
  llevan de `PRE_TRIAL` a `TRIAL_CONVERTED` y con eso sacan la fuente de pre-trial
  (`F-8V2C1-007`, `F-8V2A2-008`). La que sacan es de clase `BASE`, así que hoy `cubierto` no se
  mueve y ningún consumidor pierde nada; emiten igual, porque la regla mira `fuentes` y no
  `cubierto`. ~~Las ocho~~ **Las siete**, en las dos implementaciones (revisión del owner,
  2026-09-28, N7: `T7`, encender la prueba de una vertical, salió; el número no se reusa).

**Lo que el recorrido descartó**: del catálogo de `NUCLEO/08` §3, el pago manual, confirmar que no
se pagó, cancelar, pausar, reanudar y cambiar de plan emiten **por su fila de `B/03`**, y asentar
un cobro hecho por fuera, por su `P1`; extender un trial es `T4`. Moderar, levantar una marca,
reembolsar, editar una ficha ajena y la postulación de Partner no cambian ninguna fuente. ~~**Y el
día del fin de servicio no agrega un emisor**: la regla del §2.6 corta la emisión sin transición,
y lo que corre ese día lo ejecuta el reconciliador diario de cobertura (`V/03` §9; owner
2026-09-27, `R5`).~~ (El día del fin de servicio salió con la revisión del owner, 2026-09-28, C8.)

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
**los TRES actos que avanzan sobre ese reloj vuelven a preguntar en el momento de ejecutar**: ~~las
dos filas de `V/03` §9 —`PB4` y `PB5`— **y el hard delete del día 180** (`V/02` §4.1 y §4.2 regla
4), que no es una fila de ninguna máquina y es el único irreversible~~ **las tres filas del reloj**
de `V/03` §9 —`PB4`, `PB5` y **`PB9`**, el hard delete del día 180 (`V/02` §4.1 y §4.2 regla 4),
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
aviso de la caída se pierde, ~~`PB2` no dispara y~~ ni `PB2` dispara ni el recálculo corre, y**
~~nadie escribe el hecho 5, y no hay relectura que
lo sostenga~~ **ese día nadie escribe el hecho 5. Lo escribe el reconciliador diario de cobertura
al día siguiente** (`DEC-ARCH-009`, `V/03` §9): encuentra la ficha publicada sin cobertura, corre
`PB2` y escribe el hecho 5 en todas las fichas del dueño en la vertical, en el mismo acto. **Queda
sin red el dueño ~~que sólo tiene borradores~~ sin ninguna ficha publicada** —el que sólo tiene
borradores, que no está en su población, y el que tiene todas sus fichas en
`UNPUBLISHED_BY_BILLING`, `ARCHIVED` o `MODERATED`, que sí está—: ninguno tiene ficha
publicada que delate la diferencia (declarado en el ⚠️ de `V/03` §9; FASE 9 completa, `B-1`). **Y el recálculo tiene una
segunda**: sobre una ficha no publicada no hay estado que
recuerde que antes había cobertura, así que distinguir la relectura en falso que sigue a la caída
de la que sigue a un aviso repetido no está escrito. ~~Las dos quedan abiertas en el `NUCLEO/01`
§1.2.~~ **Ésa la aceptó el owner** (`NUCLEO/01` §1.2, ⚠️ punto 3), y es la que obliga al
reconciliador a escribir el hecho 5 **sólo** junto con `PB2`: con un disparo diario, escribirlo cada
vez que relee falso correría el reloj todos los días.

### 3.1 El empuje inverso: la ficha llegó a `PURGED`

FASE 9 vuelta 1, `F-8V1A3-003`, `F-8V1C1-001`; owner 2026-09-26, `G2-1` (contra la recomendación:
el owner no acepta ni un cobro de más).

```text
evento: la ficha F llegó a PURGED
```

**Es lo único que verticales le empuja a billing.** Lo emite verticales ~~**en el mismo acto** de
`PB9` y de `PB12`~~ **el mismo acto de `PB9` o de `PB12`, DESPUÉS de su commit y nunca dentro de
su transacción** (FASE 9 vuelta 1, `N-G2V-01`/`N-G4V-05`) (`V/03` §9) —las dos únicas filas que
llegan a `PURGED`— y lleva sólo el id de la ficha. Su único consumidor es `A6` (`B/03` §8), que desde `K-9` es la única fila que cancela un
addon `LISTING` cuando se borra su ficha: al recibirlo, billing busca las instancias ~~vivas~~ **en
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
para un borrado que no pasa por `PB9` ni por `PB12` ~~—el hard delete del admin, `F-8V1A1-003`—~~
**—desde `G5-2` el admin no tiene ninguno (`NUCLEO/08` §3: *«ningún borrado de ficha sale de otra
fila que `PB9` o `PB12`»*); el que queda es el borrado de la cuenta pedido por el propio usuario,
~~pendiente en `NUCLEO/08` §1~~ **fuera de esta épica y hecho a mano por soporte con una lista
de pasos** (revisión del owner, 2026-09-28, N7, `g1`; `NUCLEO/08` §1, [HOS-1393](https://linear.app/hospeda-beta/issue/HOS-1393)), que borra la fila de la ficha sin pasar por ninguna de las dos
(FASE 9 vuelta 1, §4 punto 1 de `22-verificado-G2`)—**, que
no empuja nada, y la red lo alcanza porque `fichaPurgada` contesta `sí` también cuando la fila no
existe. Está declarado en el NO cierra de `B/16` y en el ⚠️ de `V/03` §9 (punto 8).

**No es un quinto consumidor del aviso ni lo reemplaza**: son dos eventos distintos, en
direcciones opuestas, y ninguno lleva el dato del otro. Lo emiten las dueñas de las dos filas —V6 el
de `PB12`, V9 el de `PB9`—, y la consulta la construye V6 (`V/descomposicion.md` §2).

---

## 4. Lo que NO cruza la frontera

Declarado en positivo, porque es la mitad del valor de tener un contrato:

**No cruzan** montos, precios, monedas, ciclos, estados de pago, ids del proveedor, fechas de
cobro, medios de pago, comprobantes ni reembolsos.

**Sobre cobros cruza un solo bit, y es declarado**: `cobrada`, *«esta fila ya tiene al menos un pago
acreditado»* (§2.1; `DEC-TRIAL-010`, owner 2026-09-25). No dice cuándo, cuánto, cuántos ni cómo
terminó ningún intento, y viaja sólo dentro de una fuente `SUSCRIPCIÓN` que ya se emite. Su único
consumidor es ~~la conversión del trial (`V/03` §2, `T2` y `T5`)~~ **la máquina de trial** (`V/03`
§2): `T2` y `T5`, **y desde la FASE 9 completa `T6` y `T8`** (decisión 6c).

~~**Y cruza una fecha que no es de cobro: la de fin de servicio de una vertical** (owner 2026-09-27,
FASE 9 vuelta 2, `R5`). La calcula billing con el último día ya pagado de la vertical, pero lo que
cruza es **una por vertical**: no dice de quién es ningún pago ni cuándo se cobró, y es la misma
fecha que los tres avisos de `DEC-MP-002` le dicen a todo el mundo. La pregunta es `finDeServicio`
(§4.1).~~ **Ya no cruza ninguna fecha de una vertical** (revisión del owner, 2026-09-28, C8): las
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
  `G-R4-B` (`V/20` §2). **Lo que esta prohibición cuesta también se declara**: los tres estados
  que no emiten fuente (§2.6) son **indistinguibles de no tener nada** desde el otro lado, y hay
  una regla de producto —a quién le corresponde un trial— donde esa diferencia importaría. **El
  owner decidió pagar ese precio y NO agregar el segundo hecho** (`DEC-TRIAL-008`, 2026-09-21):
  el bit que separaría los tres estados es un estado de cobranza con otro nombre, y su costo real
  —que alguien `SUSPENDED` por impago reciba su único trial de por vida en una vertical donde
  nunca publicó— está acotado por `T2`, `T3` y `PB2`. El desarrollo está en `V/03` §2. **Esta
  frontera no se vuelve a abrir por este caso.** **Se abre, lo mínimo, por otro** (revisión del
  owner, 2026-09-28, C14, `L1-c`): la pausa pedida por el dueño detiene el reloj de retención, y
  eso cruza como **una pregunta aparte, `retenciónDetenida`** (§4.1), que no va en `fuentes` ni
  en `cubierto`. La máquina de trial no la lee, así que lo que esta decisión protegía (que nadie
  escriba una regla de producto sobre la cobranza) queda intacto: sus únicos lectores son
  archivar, borrar y los avisos de retención.
- **Tampoco cruza el estado de la instancia de addon**, y por el mismo motivo: `EXPIRED` y
  `CANCELLED` son de billing, y lo único que verticales necesita saber es si la fuente está en la
  lista.
- **El precio del plan no cruza**, aunque la `versiónDePlan` sí. Es exactamente el corte de
  `DEC-ARCH-005`: `plan_version` es de verticales, `billing_option` es de billing.
- **No cruzan los valores de lo que otorga una fuente** — ni los del plan, ni los del addon, ni los
  de un grant. Sólo la referencia. Es el §2.3 extendido a las seis fuentes.

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
retenciónDetenida(user, vertical) → { detenida: sí | no, pausaTerminadaEn: instante | NINGUNO }   ← de ida: pregunta verticales, contesta billing
```

**`situaciónDeVertical` y `finDeServicio` salieron de la firma** (revisión del owner, 2026-09-28,
C8: las verticales no se discontinúan; la firma tenía además
`situaciónDeVertical(vertical) → { admiteAltas }` y
`finDeServicio(vertical) → fecha | NINGUNA`). `admiteAltas` sólo lo escribía el acto de
discontinuar, y `finDeServicio` era la única pregunta de la dirección de ida: **sin ella, el
contrato vuelve a ser que billing empuja avisos y lee política, y verticales ~~no le pregunta nada a
billing~~** **le pregunta una sola cosa, `retenciónDetenida`** (revisión del owner, 2026-09-28, C14,
abajo). Lo que decía de ella queda tachado abajo. **Y `retenciónDetenida` ya no contesta un sí o
no**: la firma decía `retenciónDetenida(user, vertical) → sí | no`, y desde los casos vecinos
devuelve también cuándo terminó la última pausa (revisión del owner, casos vecinos, 2026-09-29, caso F-A, abajo).

**`retenciónDetenida` es la pregunta de la dirección de ida, y entra por la pausa** (revisión del
owner, 2026-09-28, C14, `L1-c`). Contesta `sí` **sólo** mientras la persona tiene en esa vertical
una suscripción `PAUSED` con motivo `CUSTOMER_REQUEST`, y `no` en cualquier otro caso (una pausa
por `COURTESY` no la detiene: esa fila cubre). **Sus únicos lectores son archivar (`PB4` y `PB5`),
borrar (`PB9`) y los avisos de retención** (`NUCLEO/07` §6), que la releen en el momento de
ejecutar, igual que `cubierto`: con `sí` no archivan, no borran y no avisan. **No va en `fuentes`
ni en `cubierto`**: la máquina de trial, la publicación y el paso 5 no la ven, así que
`DEC-TRIAL-008` queda intacta en lo que protegía (§4). **No cambia el reloj ni lo congela**: la
pausa no escribe nada en verticales, y al reanudar la fila vuelve a emitir, `cubierto` pasa a
verdadero y el hecho 2 reinicia el reloj (`NUCLEO/01` §1.2), que es el *«al volver se reinicia»*
del owner. **Y todo fin de la pausa, por cualquier camino, reinicia el reloj** (revisión del owner,
casos vecinos, 2026-09-29, caso 12): también la baja desde la pausa (`S22`) o cualquier otra
salida que no vuelva a cubrir. Sin eso `retenciónDetenida` pasaba a `no` y `PB4` y `PB9` corrían al
día siguiente sobre fichas con el reloj arrancado en el hecho 5 del primer día de la pausa, con
más de 180 días. ~~⚠️ **Cómo se escribe ese reinicio cuando la cobertura no vuelve no está decidido**
(`30-revision-del-owner/17-` §3).~~ **Ese reinicio no se escribe** (revisión del owner, casos vecinos, 2026-09-29, caso F-A):
**`retenciónDetenida` devuelve también `pausaTerminadaEn`, cuándo terminó la última pausa por
`CUSTOMER_REQUEST` de la persona en esa vertical** (el `fin_real` de su `subscription_pause`,
`B/02` §2.2, o `NINGUNO` si nunca tuvo una), **y sus lectores cuentan desde el más tardío de dos
instantes, `listing.inactiva_desde` y ése**, **con la versión de plazos que guarda la ficha**
(`listing.plazos_version`, la de su último hecho), porque el reinicio no escribe otra (revisión del owner, casos vecinos, 2026-09-29, caso H-E). La pausa sigue sin escribir nada en verticales, la
lista de hechos del reloj no cambia y `G-R6-B` tampoco. **Y una pausa vencida cuya reanudación no
se aplicó no deja el reloj detenido sin que nadie lo vea**: la fila sigue `PAUSED`, así que la
respuesta sigue siendo `detenida: sí`, pero el barrido diario de billing la marca para resolver a
mano con `REANUDACIÓN_NO_APLICADA` (`B/09` §3, la quinta comprobación; `B/02` §2.5, motivo 8), que
ya existía y no es un motivo nuevo. Como los lectores preguntan al ejecutar, no hay aviso que perder. **La construye `B4`**
en la real (lee `subscription_pause`, `B/02`) y **`V4`** en la de arranque, que contesta `no`
(§5.1); la consumen `V9` (archivar, borrar) y los avisos de retención. Reemplaza la desigualdad
que antes sostenía la pausa contra el borrado (`D16`, `G-R5`), que sale.

~~**`finDeServicio` salió de `situaciónDeVertical` y es ahora una entrada propia, en la otra
dirección**: la fecha la calculaba billing con la fórmula de `B/10` §4.3, la leían la fuente de
trial, el reconciliador diario de cobertura y `PB9`, y la real la contestaba de
`vertical_discontinuation` (owner 2026-09-27, FASE 9 vuelta 2, `R5`, `Q-FECHA`; verificación,
`N-B-03`).~~ Sale entera con la revisión del owner, 2026-09-28, C8.

**~~`díasDeTrial`~~ salió de `políticaDePlan` el 2026-09-26** (FASE 9 vuelta 1, `F-8V1C1-015`; la
firma decía `{ díasDeGrace, díasDeTrial, permitePausa, vigente, vendible }`): ningún capítulo de
billing lo lee, y su único consumidor —la máquina de trial— lo lee de su propia tabla, del lado de
verticales. Un campo declarado sin lector es un campo que alguien construye para nadie. **Y las
tres últimas firmas entraron el mismo día** (owner 2026-09-26, `G4-2`, opción 2: lo que decide
entra acá; lo que sólo muestra va a la capa de composición, abajo).

> **El contrato tiene dos direcciones. La inversa transporta política ~~y estado de catálogo, nunca~~**
> **~~capacidades~~, estado de catálogo y un único hecho de instancia —que una ficha ya no existe,**
> **empujado (§3.1) y consultado (`fichaPurgada`)—, ~~nunca capacidades~~** (FASE 9 vuelta 1; owner
> 2026-09-26, `G2-1`)**, la pertenencia de una ficha (`ficha`) y una sola escritura —la extensión**
> **de un trial, que verticales acepta o rechaza (`extenderTrial`)—; nunca capacidades** (owner
> 2026-09-26, `G4-2`)**: verticales no le dice a billing qué otorga un plan, le dice cómo se comporta.**
> **Y la de ida es una sola pregunta, `retenciónDetenida`, que billing contesta** (revisión del
> owner, 2026-09-28, C14).
> ~~**Y el § declara además una pregunta de la dirección de ida, `finDeServicio`, que billing
> contesta** (owner 2026-09-27, FASE 9 vuelta 2, `R5`).~~ (Salió con la revisión del owner,
> 2026-09-28, C8.)

**Y una pregunta que no es de catálogo: `fichaPurgada`** (FASE 9 vuelta 1; owner 2026-09-26,
`G2-1`). Contesta `sí` si la ficha está en `PURGED` o su fila no existe, y `no` en cualquier otro
estado. Es el único estado de instancia que billing lee, y lo lee porque `A6` —la única fila que
cancela un addon `LISTING` al borrarse su ficha (`K-9`)— espera un hecho de verticales. **El hecho
llega empujado** (§3.1), y esta consulta es **su red**: el barrido diario de billing la pregunta por
cada instancia viva de scope `LISTING` y, si da `sí`, corre `A6` (`B/09` §3); y `A6` la relee antes
de cancelar, así que el empuje no se cree solo. `PURGED` es final, así que la pregunta contesta lo
mismo tarde que temprano: lo que cuesta un empuje perdido es el día de atraso, no una respuesta
equivocada. La incluye la fila inexistente a propósito, para que un borrado que no pasa por `PB9`
ni por `PB12` también apague el addon. **La construye V6, dueña de `PB12`**, no `V2`: no es una
columna de `V/02` §2.1 sino el estado de la ficha.

**Y lo que decide un addon o un canje: `ficha`, `políticaDeAddon` y `extenderTrial`** (FASE 9
vuelta 1, `F-8V1A3-008`, `F-8V1C1-008`, `F-8V1C1-009`; owner 2026-09-26, `G4-2`). **`ficha` y
`políticaDeAddon` son pertenencia y política**: de una ficha, billing sabe a qué vertical pertenece
y de quién es —lo que `A1` necesita para validar el objetivo de un addon `LISTING`, y la precisión
6 del cap. 17 manda leer del recurso—, nunca su estado (ése es sólo `fichaPurgada`)~~; de un addon,~~ **—salvo un sí o no: `admiteDestaque`, si la ficha está en un estado que acepta un addon `LISTING`, que hoy es *«ni `PURGED` ni `MODERATED`»* y lo define verticales, no billing. `A1` lo exige y la firma decía *«nunca su estado»*: sin el campo, `A1` leía la tabla de verticales —la filtración que el §4.2 vigila— o no lo miraba y vendía un destaque que no se ve y que por `G2-3` se sigue cobrando. Devuelve la respuesta y no el estado, con la misma forma que `fichaPurgada` (FASE 9 vuelta 1, `N-G4V-06`; es lo que decide, así que entra acá por `G4-2`)—**; de un addon,
cómo se comporta —cuándo termina la instancia, sobre qué se puede aplicar y de qué `addon` es
versión—, nunca qué otorga. **`extenderTrial` es la única escritura de billing en verticales**: el
canje de una extensión de trial le pide a verticales que corra `T4`, y verticales contesta con el
techo ya aplicado (`V/11` §3) y dentro del lock de la máquina de trial, así que `T3` y el canje no
se pisan. Billing asienta el canje sólo con `ACEPTADA`; la clave de canje hace idempotente el
reintento. Las construyen `V2` (`políticaDeAddon`: `addon_version` es de `V/02` §2.1), `V6`
(`ficha`: es de la ficha, como `fichaPurgada`) y `V4` (la operación, dueña de la máquina de
trial); las consumen `B10` (`A1`) y `B9` (el canje).

> **Las superficies no pasan por acá** (owner 2026-09-26, `G4-2`). La pricing, Mi Suscripción y el
> botón de suscribirse son una **capa de composición**: muestran lo que cada épica resolvió leyendo
> sus consultas públicas —el catálogo vendible y su presentación, el conjunto efectivo del paso 6,
> el predicado del botón (`V/19` §4 fila 23)—, y no deciden nada (`V/19` §1). Por eso pueden leer
> capacidades sin que eso sea una filtración: la regla de vigilancia del §4.2 vigila a las
> **máquinas, guards y barridos** de billing, que son los que deciden. **Si una superficie alguna
> vez decide algo, deja de ser superficie y su lectura entra a este §.**

#### La tercera pregunta: subir o bajar lo contesta verticales

**Es la que faltaba, y su ausencia era el acoplamiento más caro de los dos lados.** La regla que
decide **cuándo se cobra** un cambio de plan está en `B/10` §3.5 y ~~dice~~ decía, textual (hasta
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
tiene `rank` comparable, ~~que es el único caso donde la regla hace falta~~ que es el caso donde el
`rank` ni siquiera contesta—. **El veredicto rige TODO cambio de plan, no sólo el del plan
retirado**: el primer motivo —el rediseño que baja un límite— es sobre dos planes vendibles con
`rank`, así que *«el único caso»* contradecía la frase que lo precedía (FASE 8 completa,
`F-8CD1-003`; `DEC-ARCH-008`). Y dejar que billing lea
las dos tablas es **el acoplamiento exacto que partir el programa en dos épicas venía a impedir**:
sería la primera excepción declarada al corte, y la regla de vigilancia del §4.2 se dispara con
ella.

Eso conserva el corte de `DEC-ARCH-005` sin excepción: los entitlements y los limits siguen sin
cruzar hacia billing, igual que los montos siguen sin cruzar hacia verticales.

~~**Son siete campos en tres preguntas, y los dos últimos son los que importa declarar.**~~
~~**Son siete entradas: seis preguntas y una operación**~~ ~~**Son ocho entradas: siete preguntas y
una operación**~~ ~~**Son seis entradas: cinco preguntas y una operación**~~ **Son siete entradas:
seis preguntas y una operación** (revisión del owner, 2026-09-28, C14: entra `retenciónDetenida`) —~~doce~~ ~~**trece**~~ ~~**doce**~~ ~~**once**~~ **trece** campos en ~~cuatro~~ ~~**tres**~~ **cuatro** consultas
(`políticaDePlan`, ~~`situaciónDeVertical`,~~ `ficha`, `políticaDeAddon`, **y `retenciónDetenida`, la de ida, que contesta billing**), un veredicto
(`direcciónDeCambio`), ~~un sí o no (`fichaPurgada`), **una fecha que contesta billing
(`finDeServicio`)**~~ **un sí o no (`fichaPurgada`)**, ~~**un sí o no de ida que contesta billing
(`retenciónDetenida`)**~~ y la escritura `extenderTrial`— (revisión del owner, casos vecinos, 2026-09-29, caso F-A: `retenciónDetenida` pasa de un sí o no a dos campos, recontado con script sobre el bloque) (FASE 9 vuelta 2, `R5`, recontado con script
sobre el bloque: `finDeServicio` sale de `situaciónDeVertical` y entra como entrada propia; revisión
del owner, 2026-09-28, C8, recontado con script sobre el bloque: salen `situaciónDeVertical` y
`finDeServicio`), **y de los
campos de `políticaDePlan`, los dos últimos son los que importa declarar** (FASE 9 vuelta 1,
recontado con script sobre el bloque de firmas: `díasDeTrial` salió, `F-8V1C1-015`; `fichaPurgada`
entró por `G2-1`; `ficha`, `políticaDeAddon` y `extenderTrial` por `G4-2`; **`admiteDestaque`, el tercer campo de `ficha`, por `N-G4V-06`**). `vigente`/`vendible` no estaba en la
cuenta original: salió de recorrer el dominio, y **era la diferencia entre que el acoplamiento se
cortara o siguiera llegando**. Sin declararlo se pierde de vista, y el día que billing lea una
columna que verticales cambió nadie se entera hasta que rompe.

~~**Dos columnas que esto obliga a crear**~~ ~~**Una columna que esto obliga a crear** (FASE 9
vuelta 2, `R5`), del lado de verticales, porque `B/10` §4.6 ya la lee y no existía:
`vertical.admite_altas`.~~ **Ninguna columna que esto obligue a crear** (revisión del owner,
2026-09-28, C8): `vertical.admite_altas` sólo la escribía el acto de discontinuar, y sale con él. ~~Tampoco `vertical.fin_de_servicio`, que dejó de ser columna de verticales por `R5`; y desde la
FASE 9 completa `S1` leía `admiteAltas` (owner 2026-09-25, decisión 6a).~~ **Y desde la FASE 9
vuelta 1 `S1` lee `vigente`/`vendible`** (el *«también»* se fue con `admiteAltas`, revisión del
owner, 2026-09-28, C8): una versión retirada no admite altas ni sucesiones
aunque se llegue al checkout por un link viejo (`B/03` §3.2; `N-G4V-07`). Otro consumidor de un
campo ya declarado.

**Y quién construye las tres consultas se dice acá, porque no decirlo las dejó sin dueño durante
cuatro días y cuatro vueltas del ciclo.** **Las construye `V2`**, la segunda unidad de la épica de
verticales (`V/descomposicion.md` §2.9): los ~~**siete**~~ ~~**seis**~~ ~~**cinco**~~ **cuatro** campos de ~~las
dos primeras~~ **la primera** (FASE 9 vuelta 2, `R5`: `finDeServicio` salió; revisión del owner, 2026-09-28, C8: salió
`situaciónDeVertical`, y de las tres originales quedan dos) son columnas de `V/02` §2.1, que es
capítulo suyo, así que es la unidad más temprana en la que ~~las tres~~ **las dos** se pueden escribir. *(Estas
~~tres son las originales~~ **dos quedan de las tres originales**; las otras ~~cuatro~~ ~~cinco~~ ~~**cuatro**~~ **cinco** entradas dicen su constructor arriba:
`fichaPurgada` y `ficha` en V6, `políticaDeAddon` en V2, `extenderTrial` en V4 —FASE 9 vuelta 1,
`G2-1` y `G4-2`—, y `retenciónDetenida` en `B4`, con la respuesta de arranque en V4 (revisión del
owner, 2026-09-28, C14)~~, y `finDeServicio` en `B12`, con la respuesta de arranque en V4 —FASE 9 vuelta 2,
`R5`—~~.)* **La regla
de `direcciónDeCambio` está escrita en `B/10` §3.5 y eso no la muda de dueño**: el veredicto lo
emite verticales —es la frase de arriba— y su consumidor es `B8`, cinco unidades antes que la
unidad a la que ese capítulo pertenece. Un contrato que declara una dirección y no dice quién la
implementa deja la mitad cara sin constructor, que es exactamente lo que pasó con ésta.

**Esto no muta `DEC-ARCH-006`: escribe la mitad que faltaba.** Aquella decisión declaró que la
frontera es *un contrato con dos implementaciones*; nunca dijo que fuera de una sola vía.

### 4.2 La regla de vigilancia, en las dos direcciones

> **Regla de vigilancia**: si aparece **un lugar que necesita algo de billing y no figura en la
> fila `cubierto` del §2.1** ~~—y no es este hecho—~~ **ni en la fila `cobrada`** **ni en la
> fila `piso`** **ni en la fila `desde`** (revisión del owner, 2026-09-28, C4) ~~**ni es la pregunta `finDeServicio` del §4.1** (FASE 9 vuelta 2, `R5`)~~ (revisión
> del owner, 2026-09-28, C8: la dirección de ida ya no tiene pregunta) **ni es la pregunta
> `retenciónDetenida` del §4.1** (revisión del owner, 2026-09-28, C14: la dirección de ida vuelve
> a tener una, con lectores cerrados) —y no es
> este hecho— (`DEC-TRIAL-010`: la segunda fila es el censo del segundo dato
> que cruza; la tercera, el del piso del grant, owner 2026-09-25, FASE 9 completa, 9h), es señal de
> que el corte se está filtrando. Se mira, no se resuelve en el lugar.
>
> **Y en la otra dirección**: si billing necesita leer de verticales algo que ~~no está entre **los
> siete campos** del §4.1~~ **no contesta ninguna de las preguntas del §4.1** —las consultas y sus
> campos, el veredicto de `direcciónDeCambio` y el sí o no de `fichaPurgada`—, **escribir en
> verticales algo que no sea `extenderTrial`, o recibir de verticales un hecho que no sea el del
> §3.1**, vale lo mismo (FASE 9 vuelta 1, `F-8V1A3-014`; owner 2026-09-26, `G2-1` y `G4-2`). Una
> lectura no declarada es un acoplamiento que nadie está mirando. **Las superficies de la capa de
> composición no entran en esta mitad** (§4.1): la regla vigila a las máquinas, guards y barridos.
> ~~**Y tampoco la acción 16 de `NUCLEO/08` §3, *«discontinuar una vertical o acortar su cola»*, que
> es capa de composición** (FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-h`, `N-C-04`):
> orquesta la mitad de verticales (`admite_altas = no`, que escribe verticales en su épica) y la de
> billing (`vertical_discontinuation`, los avisos y `S26`–`S28`, que escribe billing en la suya),
> y queda fuera de las máquinas de las dos épicas. Ninguna mitad escribe en la otra épica, así que
> el acto no suma una escritura al §4.1. **La exención nombra esta acción y sólo ésta**: cualquier
> otra que escriba en las dos épicas entra en esta mitad como cualquier escritura.~~ **Sin exención
> por nombre** (revisión del owner, 2026-09-28, C8): la acción que la tenía, discontinuar una
> vertical, ya no existe. Toda acción que escriba en las dos épicas entra en esta mitad como
> cualquier escritura.

**Las dos mitades estaban ancladas en un número y las dos lo tenían mal**, que es lo peor que le
puede pasar a la única regla que existe para enterarse de que `DEC-ARCH-005` dejó de valer. La
mitad de ida decía *«un quinto lugar»* contra el §1.1, que cuenta cuatro **nombres viejos** y no
consumidores; la mitad de vuelta decía *«los seis campos»* contra un §4.1 que dice, nueve renglones
más arriba, ***«Son siete campos en tres preguntas»*** — y **los dos que no contaba eran
`vigente`/`vendible`, que el mismo § declara *«la diferencia entre que el acoplamiento se cortara o
siguiera llegando»***.

**El arreglo no es corregir los dos números: es sacarle el número a la mitad que puede vivir sin
él.** La mitad de ida pregunta ahora por **pertenencia a un censo que se mantiene** (§2.1), que no
caduca cuando aparece el consumidor siguiente. ~~La mitad de vuelta **sí** lleva número, porque lo
que enumera es un bloque cerrado de tres firmas que el §4.1 escribe entero en un solo lugar: ahí el
riesgo no es que el conteo caduque sino que las dos cifras diverjan, y la defensa es que **el
número vive en el §4.1 y acá se lo cita, nunca se lo repite de memoria**.~~ **La mitad de vuelta
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
> **Desde la revisión del owner hay uno, y cubre una parte** (2026-09-28, N6, `L1-d`): **`G14`**
> (`V/20` §2) falla si el código de una mitad importa el de la otra; las dos importan sólo el
> package del contrato (§7), y lo que ese package exporta es exactamente lo que este documento
> declara. Con eso, una lectura no declarada que pase por un import deja de ser prosa. **Lo que
> sigue siendo prosa**: que una mitad lea las TABLAS de la otra por `@repo/db`, que un import no
> delata; y que un censo de consumidores (la fila de `cubierto`, `cobrada`, `piso` o `desde`) esté
> completo.

---

## 5. Las dos implementaciones

El contrato nace con dos, desde el día uno. Es la **condición B de `DEC-ARCH-004`** aplicada a
esta frontera: *«es lo que prueba que la abstracción no miente»*.

### 5.1 La de arranque resuelve el trial de verdad

**No devuelve datos fijos.** Resuelve honestamente las **dos** fuentes que ya viven del lado de
verticales —el trial, con su máquina de estados del capítulo 03 §2, y el título `BASE` del §2.5— y
responde que no a las cuatro de billing: suscripción, cortesía, grant y addon, **y a
`retenciónDetenida` (§4.1) contesta ~~`no`~~ `detenida: no` y `pausaTerminadaEn: NINGUNO`**, porque sin billing no hay pausa (revisión del owner,
2026-09-28, C14; los dos campos, revisión del owner, casos vecinos, 2026-09-29, caso F-A)~~, **y a
`finDeServicio` (§4.1) contesta `NINGUNA`**, porque sin billing no hay vertical que se discontinúe
(FASE 9 vuelta 2, `R5`)~~ (la pregunta salió con la revisión del owner, 2026-09-28, C8). **Y emite el aviso**
en las transiciones de trial del censo del §3 (*«quién emite»*): es emisor desde el día uno, igual
que la real (§5.2), así que `PB2` baja la ficha de un trial vencido en el acto de `T3` y no al día
siguiente (FASE 9 vuelta 1, `F-8V1C1-006`). **Y devuelve `desde` en las dos fuentes que
resuelve** (revisión del owner, 2026-09-28, C4): el instante de `T1` en la de trial y el alta de
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

### 5.2 La real la escribe la épica de billing

Agrega las otras **cuatro** fuentes —suscripción, cortesía, grant y **addon**— y **no toca nada de
lo construido**: se enchufa como fuente y como emisor del aviso.

**Son cuatro y no tres desde que el addon es una fuente del contrato** (§2.4, clase
`COMPLEMENTO`): este § decía tres contra las cuatro que el §5.1 ya enumeraba, y la que faltaba es
justamente la única que transporta `alcance: LISTING` y `objetivo` — o sea, la que el §2.7 necesita
para que el pliegue por ficha exista.

### 5.3 Son dos, y no hay una tercera

**No existe una implementación que lea el billing actual.** Se propuso —un adaptador sobre el
sistema que corre hoy, para que verticales pudiera llegar a producción sin esperar a la otra
épica— y **se descartó porque su premisa no existía**: `DEC-ARCH-007` es explícita en que las dos
llegan juntas, así que nadie necesita que una salga sola.

Queda escrito acá porque la idea es tentadora y va a volver: es código real sobre un sistema
condenado, escrito para tirarlo, resolviendo un problema que el programa no tiene.

---

## 6. Las tres defensas

Ninguna es opcional, y las tres son parte de la decisión (`DEC-ARCH-006`), no una recomendación.

### 6.1 El default es negar

Una fuente no implementada responde **que no**. Así, **un olvido apaga funciones en vez de
regalarlas** — y regalarlas es lo que nadie descubre hasta que ya pasó.

Este proyecto ya tiene el caso escrito: un fallback comentado como seguro que era el permisivo.

**Y la referencia no anulable del §2.3 sube esta defensa un escalón.** Tal como estaba, cubría el
olvido y no cubría el error: una fuente **implementada** que devolviera un puntero vacío pasaba
igual. Con la referencia no anulable, el default de negar deja de depender de que alguien se
acuerde de negar.

### 6.2 Un solo juego de casos corre contra las dos implementaciones

Es lo que convierte *«billing reemplaza la implementación de arranque»* en un evento verificable
en vez de un día de sorpresas. Para cuando llegue, ese juego ya corrió meses contra la otra.

Y vale la regla del capítulo 20 §2.1: **un caso que no puede fallar es un comentario con exit code
0.** El juego incluye el caso que distingue una implementación correcta de una que contesta
siempre lo mismo — ~~si pasa con las dos, no está probando nada~~ **las dos implementaciones lo
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

### 6.3 Un guard impide que la implementación de arranque llegue a producción

Es la única de las tres que convierte *«no lo hagas»* en *«no se puede»*, que es la misma razón
por la que `DEC-ARCH-004` pidió su condición A.

**Su dueño es `V4`, la unidad de la épica de verticales**, y no `B4`. No es indiferente: la épica
de verticales **se construye con la implementación de arranque adentro**, porque es la que le
permite avanzar sin billing (`DEC-ARCH-006`). En `B4` la defensa **no existiría durante toda esa
épica**, que es justo cuando la implementación de arranque está viva y es la única que hay.

**Falla sobre un build destinado a producción, no sobre la rama**, así que no se dispara mientras
nada apunte a producción: se puede escribir el día uno y quedarse callado meses. El momento que
protege es **el del merge**, y `DEC-ARCH-007` ya dejó escrito cómo va a ser —*«el PR final a
`staging` va a ser enorme y nadie lo puede revisar de verdad»*—: si ese día quedó algo enganchado a
la implementación de arranque, ése es el día en que entra sin que nadie lo vea.

**Qué pieza es *«la de arranque»* para este guard** (FASE 9 vuelta 2, `F-8V2C1-005`). No es el
módulo entero: la resolución del trial y la del título `BASE` son de verticales **en las dos
implementaciones** (§2.6, §5.2 *«no toca nada de lo construido»*), así que en producción corren
siempre. **Es el cableado que contesta por billing**: el `no` a las cuatro fuentes de billing ~~y el
`NINGUNA` de `finDeServicio`~~ (§5.1; revisión del owner, 2026-09-28, C8) **y el `no` de
`retenciónDetenida`** (revisión del owner, 2026-09-28, C14). La implementación de arranque lo tiene en un módulo propio,
separado de la resolución del trial y de `BASE`, y **`G13` falla si un build destinado a
producción importa ese módulo**. Con el predicado sobre el módulo entero, `G13` se ponía rojo en
el primer build de producción, y la excepción que alguien le agregara para destrabar dejaba pasar
justo ese `no`: `cubierto` falso para todo cliente que paga, y `PB2` bajándole las fichas mientras
el proveedor le sigue cobrando.

---

## 7. Lo que este contrato NO decide

- **Cómo se resuelven los entitlements y los limits.** Es el capítulo 15, y es de verticales. Acá
  está de dónde sale el puntero, no qué se hace con él.
- **Qué es una suscripción, una cortesía o un grant por dentro.** Son los capítulos 12 y 14, y son
  de billing. Acá está qué aportan, no cómo funcionan.
- ~~**Quién tiene el reloj de cobro.**~~ **DECIDIDO el 2026-09-24 por `DEC-MP-006`: es del
  proveedor.** Este contrato **no cambió una línea** por eso — que era lo que el §1.2 afirmaba.
- ~~**En qué package vive cada cosa.** Es FASE 5 y tiene su gate propio (`DEC-METH-003`). Lo que
  este documento fija es el contrato, no su domicilio.~~ **El domicilio ya está decidido; el
  nombre, no** (revisión del owner, 2026-09-28, N6, `L1-d`). Abajo, *«dónde vive»*. **El nombre
  del package** y en qué package vive cada implementación sigue siendo FASE 5 (`DEC-METH-003`).

### 7.1 Dónde vive: un package compartido, único punto de comunicación

(Revisión del owner, 2026-09-28, N6, `L1-d`.) **Toda comunicación entre verticales y billing pasa
por un package compartido del monorepo**, y por ningún otro lado. No depende de ninguna de las
dos mitades ni de `@repo/db`: sólo de la validación y del enum de verticales de `@repo/schemas`.
~~Tiene cuatro cosas:~~ Tiene cinco cosas (la quinta, revisión del owner, casos vecinos,
2026-09-29, caso G-B):

1. **Las dos interfaces.** **Lo que verticales le pregunta a billing**: `cobertura` (§2),
   `retenciónDetenida` (§4.1) y el aviso de que la cobertura cambió (§3). **Lo que billing le lee a
   verticales**: `políticaDePlan`, `direcciónDeCambio`, `fichaPurgada`, `ficha`,
   `políticaDeAddon`, la escritura `extenderTrial` (§4.1) y el empuje de la ficha que llegó a
   `PURGED` (§3.1). Los dos eventos llevan la regla *«se emite después del commit»* (§3).
2. **Sus validaciones**: el esquema de cada respuesta, de cada argumento y de cada evento. Una
   respuesta que no valida no se entrega: es el §6.1 del lado de la forma.
3. **Los simuladores de cada lado**, falsos programables en memoria de las dos interfaces, bajo
   una ruta de pruebas que ningún build de producción importa (la técnica de `G13`, §6.3). **Con
   ellos verticales se prueba entera sin billing, y billing entera sin verticales**: la mitad que
   faltaba era la segunda, porque para la dirección inversa no había falso ni juego de casos.
4. **Los juegos de casos compartidos**: el del §6.2 (la dirección de ida, contra las dos
   implementaciones de `cobertura`) y **uno nuevo de la dirección inversa**, que corre contra el
   simulador y contra la implementación de verticales, con su caso que una constante no pasa.
5. **La interfaz del reloj** ✚ con que el código de producción de las dos mitades lee la hora,
   inyectada. El reloj adelantable que la implementa vive en el package de pruebas compartido
   (`B/20` §5.1, caso 31); la interfaz, que sí importa producción, vive acá porque éste ya es el
   único package que importan las dos mitades. **`G14` no cambia**: importar el contrato nunca fue
   cruzar (revisión del owner, casos vecinos, 2026-09-29, caso G-B). **La construye `B1`**, con el
   reloj adelantable (revisión del owner, casos vecinos, 2026-09-29, caso I-E). La implementación
   real no vive acá: la inyecta la raíz de composición de `apps/api` (abajo; caso J-A).

**Las implementaciones no viven en el package**: la real de la dirección de ida en la mitad de
billing (`DEC-ARCH-004`), la de la inversa y la de arranque en la de verticales (la de arranque
con su módulo que contesta por billing, que sigue bajo `G13`). **El único lugar que junta las dos
mitades es la raíz de composición de `apps/api`.** **La implementación real del reloj (la hora del
sistema), que leen las dos mitades, la inyecta esa raíz; en las pruebas se inyecta el reloj
adelantable** (revisión del owner, casos vecinos, 2026-09-29, caso J-A). Y **`G14`** (`V/20` §2) falla si una mitad
importa a la otra: es lo que vuelve ejecutable la parte de la regla de vigilancia que se ve en un
import (§4.2). **Quién lo construye**: `V1` crea el package y `G14`; cada entrada entra con la
unidad que construye su implementación (§4.1, *«quién construye»*), y la épica de billing lo
consume desde `B1` con el simulador de la dirección inversa (`V/descomposicion.md`,
`B/descomposicion.md` §2).

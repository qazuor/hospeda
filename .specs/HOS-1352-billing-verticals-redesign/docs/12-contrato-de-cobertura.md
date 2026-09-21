---
title: El contrato de cobertura — la única frontera entre las dos épicas
linear: HOS-1352
statusSource: linear
created: 2026-09-18
updated: 2026-09-20
status: CURRENT
---

# 12 · El contrato de cobertura

> **Este documento es de la frontera, no de una épica.** Lo citan `HOS-1353` y `HOS-1354`, y
> **ninguna de las dos lo puede mutar sola** (`DEC-ARCH-006`). Una copia que una de las dos pueda
> tocar sin que la otra se entere es `F-1B-132` otra vez: seis repartos sobre las mismas tablas y
> ninguno coincide.

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

**Una precisión que el primer renglón dejó de cumplir literalmente.** Desde que existen las tres
clases de fuente (§2.4), **el paso 5 ya no pregunta por `cubierto`**: pregunta si hay alguna fuente
de la que resolver capacidades, y eso incluye el piso, que no otorga cobertura. Los otros tres
renglones siguen leyendo `cubierto` sin cambio alguno. El hecho sigue siendo uno; lo que se partió
es la pregunta que el paso 5 le hace.

### 1.2 Y no depende de lo que billing todavía no decidió

El capítulo 13 tiene abierta una pregunta grande: si el reloj de cobro es nuestro o del proveedor.
**Este contrato se escribe igual en los dos mundos** — en los dos hay un título con un estado y
una fecha hasta la cual cubre. Se puede definir hoy sin prejuzgar el 13.

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
        hasta:      fecha | NO_VENCE | SIN_FECHA_CONOCIDA | SIN_EMPEZAR
    } ]
}
```

Una sola pregunta, con la vertical **obligatoria en la firma** — no opcional, no deducible del
recurso. Es la misma forma estructural que el capítulo 17 §2.2 le dio a toda operación de dominio,
y por el mismo motivo: **una resolución que no se puede invocar sin el dato no tiene un control
que alguien pueda olvidar.**

### 2.1 Qué es cada campo, y quién lo consume

| campo | qué es | quién lo necesita |
|---|---|---|
| **`cubierto`** | si hay al menos una fuente viva **de clase `TÍTULO`** (§2.4). Es el §36 — *«permanece activo mientras al menos una source exista»* | `PB2`; el §6 del capítulo 15; el reconciliador |
| **`fuentes`** | **todas** las fuentes vivas, de las tres clases, no la que manda | el paso 5 de la autorización; el aviso de qué se pierde (cap. 15 §6.3) y el reconciliador, que necesita saber si apagar una deja las otras |
| **`tipo`** | `TRIAL` · `SUSCRIPCIÓN` · `CORTESÍA` · `GRANT` · `BASE` · `ADDON` | los avisos, que dicen cosas distintas según por qué se perdió; y la clase, que se deriva de él **y del `hasta`** (§2.4) |
| **`referencia`** | **la referencia, no los valores**: una versión de plan o una versión de addon. **No es anulable** (§2.3) | el paso 6: es cómo verticales sabe qué otorga esa fuente |
| **`alcance`** | `VERTICAL` · `LISTING` · `USER` · `GLOBAL` (§2.7) | el pliegue en dos tramos del conjunto efectivo |
| **`objetivo`** | la ficha, si `alcance = LISTING`; nada en los otros tres | ídem |
| **`hasta`** | uno de cuatro valores, y ninguno es «sin fecha» a secas (§2.6) | los avisos con ventana (cap. 15 §4.4) |

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
2. **No otorga ninguna clave comercial.** La versión de piso otorga lo mínimo para existir y para
   volver a contratar. Es el mismo punto único de falla que la versión de pre-trial, y lo vigila el
   **mismo guard**: `G-R3` se comprueba sobre las dos versiones no vendibles de cada vertical, no
   sobre una.
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
| **`fecha`** | el fin ya está determinado: `CANCEL_SCHEDULED` con la fecha de `DEC-SUB-009`, fin de cortesía, vencimiento de un addon `DÍAS_FIJOS`, fin del trial | hay ventana, y es ésta |
| **`NO_VENCE`** | grant permanente, título `BASE` | no hay ventana **porque no hay fin** |
| **`SIN_FECHA_CONOCIDA`** | suscripción `ACTIVE`, addon `MIENTRAS_VIVA_LA_SUSCRIPCIÓN` | no hay ventana **porque todavía no se sabe** |
| **`SIN_EMPEZAR`** | la fuente de trial en `PRE_TRIAL` | no hay ventana **porque el reloj no arrancó** |

`V/15` §4.4 reparte las ventanas exactamente por esa diferencia: *«vencimiento de un addon · fin de
una cortesía»* tienen ventana; *«revocación de un grant»* no.

> **El `hasta` es el fin de la emisión, no una etiqueta: una fuente con `hasta: fecha` deja de
> aparecer en `fuentes` cuando esa fecha pasa.**

Parece obvio y hay que escribirlo, porque la alternativa ya se materializó una vez. Una fuente se
emite porque **un estado lo dice**, y si ese estado no se puede mover el `hasta` queda en el
pasado y la fuente **sigue contando para `cubierto`** — una cobertura perpetua que no falla
ruidosamente, regala, y que ningún aviso muestra porque el aviso sólo mira la ventana. Fue el
desenlace del trial que quedaba en `TRIAL_ACTIVE` sin salida alcanzable (`V/03` §2). La máquina que
emite la fuente es la responsable de tener salida; este renglón es la segunda línea, para que un
estado atascado se note como fuente que se apaga en vez de como capacidad que no se apaga nunca.

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
| `CHARGE_DECLINED` | **no** | — | terminal, y el proveedor ya canceló el preapproval |

> **Una suscripción esperando autorización NO emite fuente de cobertura.**

**Y es la respuesta cara de las dos.** Emitirla significa **hasta 72 horas de servicio completo
gratis, y repetibles** —se abandona el checkout y se empieza de nuevo—, y durante una sucesión
significa **los dos planes sumados** hasta que la nueva se autorice. Las dos lecturas cuestan
plata en la misma dirección.

**Y no deja a nadie en la nada**, que es la objeción obvia: a quien recién contrata **le sigue
rigiendo el piso** (§2.5), y a quien está cambiando de plan **lo sigue cubriendo su suscripción
vieja**, que es justamente lo que `D7` mantiene viva hasta que la nueva quede autorizada.

**Y la garantía termina donde termina la sucesión, así que hay que decir qué pasa después.** La
frase de arriba —*«hasta que la nueva se autorice»*— cierra la ventana **anterior** a la
autorización, y hay una ventana **posterior**: cuando la sucesora ya autorizó pero la
cancelación de la predecesora en el proveedor **falló**, `B/03` §3.2 deja las dos filas donde
estaban, con la marca puesta, y `B/03` §3.1 es explícito en que una fila marcada *«conserva el
estado que tenía, y sigue cubriendo a quien estaba cubierto»*. Las dos emiten.

> **Dos fuentes `SUSCRIPCIÓN` de clase `TÍTULO` para el mismo `user + vertical` son posibles, y
> sólo en ese caso.** El contrato no las desempata: `fuentes` las devuelve a las dos y el pliegue
> de `V/15` §2.2 las agrega como a cualquier otro par.

**No se desempata porque en esa rama el cliente está pagando las dos**, y desempatar sería la
única forma de cobrarle dos planes y darle uno. Tampoco hay decisión de cobertura que tomar: la
rama es un incidente declarado, con la marca puesta y una persona mirándolo, y su salida es
resolver la cancelación —no elegir qué fuente vale—. Lo que no puede pasar es que el caso quede
sin nombrar, porque entonces el techo de lo que alguien puede tener depende de si una llamada al
proveedor salió bien.

**Y no es alcanzable por ningún otro camino.** Las seis transiciones que mueven a la predecesora
durante la ventana de 72 h —las conté sobre la tabla de `B/03` §3.2: `S8`, `S9`, `S6`, `S12`,
`S13` y `S16`— la dejan en un estado que **no emite** en cinco de los seis casos; la excepción es
`S9`, que la deja emitiendo pero con `tipo: CORTESÍA`, que no es una segunda `SUSCRIPCIÓN`. Y en
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
transporta el suyo.

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
   ahí desde el instante del anclaje, así que **toda fila viva suya en esa vertical se cancela**,
   igual que en el otorgamiento. Sin esto el §35.3 —*«cancelar toda obligación de pago
   cubierta»*— queda incumplido **exactamente en la vertical que se acaba de regalar**, y el
   beneficiario la sigue pagando todos los meses.

**Desanclar no está declarado, y esto no lo declara.** Reducir el scope de un grant sin revocarlo
entero no es una operación de este diseño; si alguna vez se necesita, entra por el catálogo del
`NUCLEO/08` §3 con su propia fila, su confirmación y su transición —cortar servicio en una
vertical es la mitad de *«la acción administrativa más grave»*— y no como un efecto lateral de
borrar una fila.

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
declarar entitlements, que `V/02` §1.2 prohíbe, y obligaría a mantener dos catálogos en sincronía
para siempre. Es el defecto que este programa viene a corregir.

**Beneficio operativo**: regalar algo pasa a ser **elegir un plan concreto**, y queda auditado.

---

## 3. El aviso

```text
evento: la cobertura de (user, vertical) cambió
```

Es lo único que billing le **empuja** a verticales. Lleva qué fuente cambió y en qué dirección, y
alimenta dos cosas que ya existen en el diseño: la transición `PB2` de publicación y la lista de
invalidación del caché (cap. 02 §3.2), que es la **misma lista** que dispara el reconciliador de
excedentes (cap. 15 §4.2) — *«una lista, dos consumidores»*.

**El evento no reemplaza la consulta.** El reconciliador *«no se dispara por evento: se dispara
por condición»* (cap. 15 §4.2): el aviso dice que hay que recalcular, y el recálculo vuelve a
preguntar. Un consumidor que decidiera con lo que trae el evento estaría creyéndole a un mensaje
en vez de al estado, que es el error que el capítulo 03 §10 ya prohibió para los eventos del
proveedor.

---

## 4. Lo que NO cruza la frontera

Declarado en positivo, porque es la mitad del valor de tener un contrato:

**No cruzan** montos, precios, monedas, ciclos, estados de pago, ids del proveedor, fechas de
cobro, medios de pago, comprobantes ni reembolsos.

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
  frontera no se vuelve a abrir por este caso.**
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
políticaDePlan(versiónDePlan)  → { díasDeGrace, díasDeTrial, permitePausa, vigente, vendible }
situaciónDeVertical(vertical)  → { admiteAltas, finDeServicio }
direcciónDeCambio(versiónOrigen, versiónDestino) → SUBE | BAJA
```

> **El contrato tiene dos direcciones. La inversa transporta política y estado de catálogo, nunca**
> **capacidades: verticales no le dice a billing qué otorga un plan, le dice cómo se comporta.**

#### La tercera pregunta: subir o bajar lo contesta verticales

**Es la que faltaba, y su ausencia era el acoplamiento más caro de los dos lados.** La regla que
decide **cuándo se cobra** un cambio de plan está en `B/10` §3.5 y dice, textual, que *«la dirección
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
tiene `rank` comparable, que es el único caso donde la regla hace falta—. Y dejar que billing lea
las dos tablas es **el acoplamiento exacto que partir el programa en dos épicas venía a impedir**:
sería la primera excepción declarada al corte, y la regla de vigilancia del §4.2 se dispara con
ella.

Eso conserva el corte de `DEC-ARCH-005` sin excepción: los entitlements y los limits siguen sin
cruzar hacia billing, igual que los montos siguen sin cruzar hacia verticales.

**Son siete campos en tres preguntas, y los dos últimos son los que importa declarar.** `vigente`/`vendible` no estaba en la
cuenta original: salió de recorrer el dominio, y **era la diferencia entre que el acoplamiento se
cortara o siguiera llegando**. Sin declararlo se pierde de vista, y el día que billing lea una
columna que verticales cambió nadie se entera hasta que rompe.

**Dos columnas que esto obliga a crear**, del lado de verticales, porque `B/10` §4.6 ya las lee y
no existen: `vertical.admite_altas` y `vertical.fin_de_servicio`.

**Esto no muta `DEC-ARCH-006`: escribe la mitad que faltaba.** Aquella decisión declaró que la
frontera es *un contrato con dos implementaciones*; nunca dijo que fuera de una sola vía.

### 4.2 La regla de vigilancia, en las dos direcciones

> **Regla de vigilancia**: si aparece un quinto lugar que necesita algo de billing **y no es este
> hecho**, es señal de que el corte se está filtrando. Se mira, no se resuelve en el lugar.
>
> **Y en la otra dirección**: si billing necesita leer de verticales algo que no está en los seis
> campos del §4.1, vale lo mismo. Una lectura no declarada es un acoplamiento que nadie está
> mirando.

---

## 5. Las dos implementaciones

El contrato nace con dos, desde el día uno. Es la **condición B de `DEC-ARCH-004`** aplicada a
esta frontera: *«es lo que prueba que la abstracción no miente»*.

### 5.1 La de arranque resuelve el trial de verdad

**No devuelve datos fijos.** Resuelve honestamente las **dos** fuentes que ya viven del lado de
verticales —el trial, con su máquina de estados del capítulo 03 §2, y el título `BASE` del §2.5— y
responde que no a las cuatro de billing: suscripción, cortesía, grant y addon.

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

Agrega las otras tres fuentes —suscripción, cortesía, grant— y **no toca nada de lo construido**:
se enchufa como fuente y como emisor del aviso.

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
siempre lo mismo — si pasa con las dos, no está probando nada.

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

---

## 7. Lo que este contrato NO decide

- **Cómo se resuelven los entitlements y los limits.** Es el capítulo 15, y es de verticales. Acá
  está de dónde sale el puntero, no qué se hace con él.
- **Qué es una suscripción, una cortesía o un grant por dentro.** Son los capítulos 12 y 14, y son
  de billing. Acá está qué aportan, no cómo funcionan.
- **Quién tiene el reloj de cobro.** Es el capítulo 13, sigue abierto, y este contrato se escribe
  igual en los dos desenlaces (§1.2).
- **En qué package vive cada cosa.** Es FASE 5 y tiene su gate propio (`DEC-METH-003`). Lo que
  este documento fija es el contrato, no su domicilio.

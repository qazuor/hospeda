---
title: El contrato de cobertura — la única frontera entre las dos épicas
linear: HOS-1352
statusSource: linear
created: 2026-09-18
updated: 2026-09-19
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
| **`tipo`** | `TRIAL` · `SUSCRIPCIÓN` · `CORTESÍA` · `GRANT` · `BASE` · `ADDON` | los avisos, que dicen cosas distintas según por qué se perdió; y la clase, que se deriva de él |
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
**La clase se deriva del `tipo` y no se transporta**: transportarla sería la segunda fuente de un
dato que el `tipo` ya determina.

| clase | tipos | ¿cuenta para `cubierto`? | qué es |
|---|---|---|---|
| **`TÍTULO`** | `TRIAL` · `SUSCRIPCIÓN` · `CORTESÍA` · `GRANT` | **sí** | la relación comercial que habilita a estar adentro |
| **`BASE`** | `BASE` | **no** | el piso que tiene todo el mundo por existir (§2.5) |
| **`COMPLEMENTO`** | `ADDON` | **no** | agrega capacidades sobre un título; nunca cobertura |

> **`cubierto` se calcula sólo sobre las fuentes de clase `TÍTULO`.**

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
| grant | *«scope de verticales»* (§35.1) | una fuente `VERTICAL` **por cada vertical de su scope** |
| addon | los cuatro del §40 | `LISTING` · `VERTICAL` · `USER` · `GLOBAL` |

### 2.8 Qué referencia transporta un `GRANT`: el plan, su versión vigente, y con trinquete

Un grant permanente cruza la frontera, la persona queda cubierta, y cuando el paso 6 pregunta qué
capacidades le da **no había respuesta**: el grant no apuntaba a ningún plan. *Free Forever* era un
nombre comercial sin contenido definido.

> **El grant se ancla al PLAN, no a una versión, y resuelve la versión vigente —sea vendible o**
> **no—, con un trinquete: un grant nunca otorga menos de lo que otorgaba el día que se concedió.**

**Los tres pedazos, y ninguno inventa un modo nuevo:**

1. **Se ancla al plan.** `UNIQUE(plan_id) WHERE vigente` garantiza que *«la vigente»* es unívoca y
   siempre existe, así que la referencia nunca queda sin resolver (§2.3).
2. **Lee la vigente, vendible o no.** `V/02` §2.1 ya tiene los dos modos escritos —*«la pricing lee
   la versión vigente y sólo si es vendible; una suscripción lee su versión anclada, vigente o no,
   vendible o no»*—. El grant es un híbrido: toma *«la vigente»* de la pricing y el *«vendible o
   no»* de la suscripción. **Leerlo como la pricing sería el defecto**: retirar un plan se hace
   publicando una versión no vendible (`D13`, cap. 10 §3.2), así que el día que se retira Premium
   **todos los `Free Forever` anclados a él se quedarían sin nada**.
3. **El trinquete.** Seguir la vigente expone al beneficiario a que el plan **empeore**: una versión
   que reparte distinto le saca algo a quien tiene un «para siempre», sin que nadie lo haya decidido
   para esa persona. El trinquete es un instrumento que el diseño **ya tiene** —el piso de `V/15`
   §2.5—, aplicado acá: **sigue las mejoras y no sufre los recortes.**

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
```

> **El contrato tiene dos direcciones. La inversa transporta política y estado de catálogo, nunca**
> **capacidades: verticales no le dice a billing qué otorga un plan, le dice cómo se comporta.**

Eso conserva el corte de `DEC-ARCH-005` sin excepción: los entitlements y los limits siguen sin
cruzar hacia billing, igual que los montos siguen sin cruzar hacia verticales.

**Son seis campos, y el sexto es el que importa declarar.** `vigente`/`vendible` no estaba en la
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

Y `cubierto` sigue yendo a falso cuando el trial vence, porque el título `BASE` no es de clase
`TÍTULO` (§2.4). Si contara, la tabla de arriba tendría una cuarta fila —*«contesta siempre que
sí»*— y sería ésta.

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

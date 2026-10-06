---
title: "FASE 9 · R2 resuelto — el contrato de cobertura"
linear: HOS-1352
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 9
---

# FASE 9 · R2 resuelto — el contrato de cobertura

`DEC-METH-004` exige dos cosas para declarar un racimo resuelto: que el camino de cada hallazgo,
reejecutado sobre el texto corregido, ya no llegue, **y** que la regla corregida se verifique
contra todo el dominio que cuantifica. El dominio de R2 está enumerado en
[`00-dominios-de-los-racimos.md`](./00-dominios-de-los-racimos.md) §R2: **28 casos**, en cuatro
dimensiones. Acá están los 28 recorridos, los ocho caminos reejecutados, y lo que R2 **no** puede
cerrar.

**Este documento no aplica ningún cambio.** No edita el contrato, ni el decision log, ni ningún
capítulo. Es la resolución escrita: qué tiene que decir el contrato, qué columna falta dónde, y
por qué — para que el owner decida cuándo se aplica. Los caminos se reejecutan **contra el texto
tal como este documento lo especifica**, que es la única forma de verificar antes de aplicar.

**No relitiga `DEC-ARCH-004` a `007`.** Que el billing sea nuestro, que haya dos épicas, que la
frontera sea un contrato con dos implementaciones y que se liberen juntas está decidido. Lo que se
resuelve acá es **qué transporta ese contrato**.

---

## 1. Qué tiene que decir el contrato

### 1.0 La frase que ordena todo lo demás

El contrato de hoy transporta `versiónDePlan` y lo justifica bien (§2.3): billing sabe **cuál**
plan tiene esta persona, verticales sabe **qué otorga** ese plan, y devolver el puntero en vez de
los valores es lo que impide que la resolución del capítulo 15 se mude a billing.

El defecto no es esa división del trabajo: es que se escribió el **caso** en vez de la **regla**.

> **La regla es: el contrato transporta una REFERENCIA a la declaración de lo que la fuente**
> **otorga, y esa declaración vive siempre del lado de verticales. `versiónDePlan` es una de**
> **esas referencias, no la única.**

De ahí sale todo lo que sigue: una fuente sin referencia no es una fuente que el contrato no
pueda expresar bien — es una fuente que **no se puede expresar**, y por eso el campo no es
anulable (§1.3).

### 1.1 La forma, completa

```text
cobertura(user, vertical) → {
    cubierto:  sí | no
    fuentes:   [ {
        tipo:       TRIAL | SUSCRIPCIÓN | CORTESÍA | GRANT | ADDON
        referencia: versiónDePlan | versiónDeAddon        ← NO anulable
        alcance:    VERTICAL | LISTING | USER | GLOBAL
        objetivo:   la ficha, si alcance = LISTING; nada en los otros tres
        hasta:      fecha | NO_VENCE | SIN_FECHA_CONOCIDA
    } ]
}
```

Y la dirección inversa, que hoy no está declarada en ninguna parte (§1.7):

```text
políticaDePlan(versiónDePlan) → { díasDeGrace, díasDeTrial, permitePausa,
                                  vigente, vendible }
situaciónDeVertical(vertical) → { admiteAltas, finDeServicio }
```

El aviso no cambia: sigue siendo `la cobertura de (user, vertical) cambió`, y sigue sin reemplazar
la consulta (§3 del contrato).

### 1.2 Los `tipo` son cinco, y la sexta fuente no necesita uno

El §36 tiene seis fuentes y el contrato nombra cuatro. **La corrección no es agregar dos.**

| # | fuente (`NUCLEO/01` §1.6 y §5) | `tipo` en el contrato |
|---|---|---|
| S1 | versión de plan, vía suscripción | `SUSCRIPCIÓN` |
| S2 | herencia de Turista VIP | **ninguno — no cruza** |
| S3 | addon | `ADDON` **(nuevo)** |
| S4 | cortesía temporal | `CORTESÍA` |
| S5 | grant permanente | `GRANT` |
| S6 | trial | `TRIAL` |

**`ADDON` falta y hay que agregarlo.** Sin él, `F-8B3-007` es literal: *«`tipo` sólo admite
`TRIAL · SUSCRIPCIÓN · CORTESÍA · GRANT`: **no hay `ADDON`**»*, y ninguno de sus dos campos de
contenido tiene portador.

**La herencia de Turista VIP NO necesita `tipo`, y dárselo sería un defecto.** No es una fuente
que billing conozca: es un **flag de la versión de plan**. `11-particion-del-programa.md` §2.1 lo
pone en la fila de `plan_version` —*«`rank`, vendible, días de grace, días de trial, permite
pausa, **hereda Turista VIP**»*, lado `VERTICALES`— y `V/02` §2.1 lo repite en la misma columna.
Verticales ya recibe el puntero a esa versión; la herencia se deriva de él sin que cruce nada.

Y se apaga sola por la regla que ya existe: `V/15` §6.2 razona que *«un plan suspendido no otorga
nada»* y el contrato §1.1 lo cierra —*«suspendido es no tener cobertura»*—, así que al
desaparecer la fuente que llevaba el flag, desaparece la herencia. **Darle un `tipo` propio
crearía una segunda declaración de algo que ya está declarado en una columna**, que es el defecto
que el §9 y `V/02` §1.2 vienen a impedir.

### 1.3 `referencia` no es anulable, y eso es lo que cierra el racimo

`F-8A1-004` describe dos ramas y las dos son malas: fallar cerrado deja el grant decorativo,
fallar abierto lo vuelve *«toda clave de la vertical»*. **Las dos ramas existen porque el campo se
puede responder con nada.**

> **Una fuente sin referencia resoluble no se puede expresar.**

Es la misma forma estructural que el capítulo 17 §2.2 eligió para la vertical —*«una resolución
que no se puede invocar sin el dato no tiene un control que alguien pueda olvidar»*— aplicada al
otro lado de la misma frontera. No hay rama A ni rama B: hay una fila que no se puede escribir.

Esto sube un escalón la defensa §6.1. Hoy dice *«una fuente no implementada responde que no»*, que
cubre el olvido y no cubre el error: una fuente **implementada** que devuelve un puntero vacío pasa
igual. Con la referencia no anulable, el default de negar deja de depender de que alguien se
acuerde de negar.

### 1.4 `cubierto` no cuenta los addons — hay dos clases de fuente

**Éste es el punto donde el arreglo cómodo abre un agujero nuevo.** El contrato §2.1 define
`cubierto` como *«si hay **al menos una** fuente viva»*. Agregar `ADDON` a `fuentes` sin tocar esa
definición hace que **un addon vivo, solo, otorgue cobertura**.

No es hipotético y está medido en el diseño: `B/16` §4.2 dice que *«**La suspensión y la pausa no
dejan huérfano a nada**»* y que el reloj del addon *«no se congela»* (`DEC-ADDON-001`). O sea que
una instancia de addon **viva** convive con una suscripción `SUSPENDED`, a la que el §21 deja
*«sin entitlements comerciales»*. Con la definición de hoy, ese suspendido quedaría cubierto por
su propio addon.

> **`cubierto` se calcula sólo sobre las fuentes de clase TÍTULO: `TRIAL`, `SUSCRIPCIÓN`,**
> **`CORTESÍA` y `GRANT`. `ADDON` es de clase COMPLEMENTO: agrega capacidades y nunca cobertura.**

La clase **no es un campo que se transporte**: se deriva del `tipo` y punto. Transportarla sería
la segunda fuente de un dato que el `tipo` ya determina.

Y es exactamente lo que el diseño ya dice en otro lado: el §38 exige *«una subscription válida
compatible»* para adquirir un addon, y `B/16` §2.4 agrega la única excepción —*«Un grant
permanente vale como título en lugar de la suscripción `ACTIVE`»*—. **Un addon nunca fue un
título; era un complemento de uno.** Acá sólo se escribe.

### 1.5 `hasta` tiene tres valores, no dos

Hoy son dos: una fecha, o *«sin fecha para un grant permanente»* (§2.1). Con las cinco fuentes,
**«sin fecha» pasa a significar dos cosas incompatibles**:

| situación | qué significa hoy «sin fecha» | qué necesita el aviso |
|---|---|---|
| grant permanente | no vence nunca | no hay ventana **porque no hay fin** |
| suscripción `ACTIVE` | el fin no está determinado | no hay ventana **porque no se sabe** |
| addon `MIENTRAS_VIVA_LA_SUSCRIPCIÓN` | ídem | ídem |

`V/15` §4.4 reparte las ventanas exactamente por esa diferencia: *«vencimiento de un addon · fin
de una cortesía»* tienen ventana; *«revocación de un grant»* no. Un solo valor para las tres
situaciones vuelve indistinguible *«no hay ventana porque es para siempre»* de *«no hay ventana
porque todavía no se sabe»*, y el aviso no puede elegir qué decir.

> **`hasta` es `fecha`, `NO_VENCE` o `SIN_FECHA_CONOCIDA`.**

Y una regla que hace falta decir aparte, porque la implementación obvia viola el §4 del contrato:
**el `hasta` de una suscripción `ACTIVE` es `SIN_FECHA_CONOCIDA`, nunca el fin del período.** El
§4 declara que no cruzan *«ciclos … fechas de cobro»*; poner el fin del período en `hasta` es
precisamente cruzar la fecha de cobro, y además haría que verticales viera la cobertura vencer
todos los meses sobre algo que se renueva solo. `hasta` toma fecha cuando **el fin ya está
determinado**: `CANCEL_SCHEDULED` con la fecha de fin de servicio de `DEC-SUB-009` —que es *«un
dato nuestro»*, `NUCLEO/01` §2.2—, el fin de una cortesía, el vencimiento de un addon
`DÍAS_FIJOS` o el fin del trial.

### 1.6 `alcance` y `objetivo`: la firma no cambia, la respuesta sí

`F-8A1-003` es el eje del scope: una fuente `LISTING` entra en un conjunto que se resuelve por
`user + vertical` y habilita la capacidad en **todas** las fichas. Las dos salidas que el hallazgo
nombra tienen costo alto: meter la ficha en la clave del caché *«multiplica el caché por la
cartera»*, y resolver las fuentes `LISTING` aparte *«crea el segundo lugar donde se resuelven
capacidades»*.

**Hay una tercera, y no es ninguna de las dos.** Las cuatro estrategias de agregación de `V/15`
§2.2 —`SUMA`, `MÁXIMO`, `MÍNIMO`, `MEJOR_DECLARADO`— son **asociativas**: `MEJOR_DECLARADO` es un
máximo sobre un orden declarado, y los otros tres lo son por definición. Entonces plegar primero
las fuentes independientes de la ficha y después las de la ficha **da el mismo resultado** que
plegarlas todas juntas.

> **El conjunto efectivo se pliega en dos tramos: el tramo cacheado por `user + vertical`, con**
> **las fuentes de alcance `VERTICAL`, `USER` y `GLOBAL`; y un delta por ficha, con las fuentes**
> **de alcance `LISTING` cuyo `objetivo` es la ficha de la operación.**

No es un segundo lugar que resuelve capacidades: es el **mismo pliegue**, cortado donde el caché
puede cortar. Y la ficha ya está disponible en ese punto: el paso 4 de `V/17` §1.2 la resolvió
—*«el recurso: existencia, estado y dueño»*— antes de que el paso 6 pregunte qué otorga el título.
La firma `cobertura(user, vertical)` **no cambia**, y billing no necesita saber nada de fichas:
sólo devolver el `objetivo` que ya guarda en `addon_instance`.

**El vocabulario de `alcance` es del contrato, y se declara su mapeo.** Hoy conviven dos: los
cuatro scopes del §40 —`LISTING`, `VERTICAL_SUBSCRIPTION`, `USER`, `GLOBAL`, enumerados en `B/16`
§4.2— y el *«scope de verticales»* del §35.1 que usa el grant (`B/02` §2.4). No se renombra
ninguno; el contrato declara el suyo y el mapeo:

| fuente | scope nativo | `alcance` en el contrato |
|---|---|---|
| suscripción, cortesía, trial | — (cubren su vertical) | `VERTICAL` |
| grant | *«scope de verticales»* (§35.1) | una fuente `VERTICAL` **por cada vertical de su scope** |
| addon | los cuatro del §40 | `LISTING` · `VERTICAL` · `USER` · `GLOBAL` |

### 1.7 La dirección inversa, declarada

`F-8B3-009` encontró la mitad que faltaba: el §4 enumera con cuidado lo que billing **empuja** y
**nunca declara lo que billing lee**. La regla de vigilancia del mismo §4 —*«si aparece un quinto
lugar que necesita algo de billing y no es este hecho»*— sólo mira en una dirección, y el
acoplamiento real estaba en la otra.

> **El contrato tiene dos direcciones. La inversa transporta política y estado de catálogo,**
> **nunca capacidades: verticales no le dice a billing qué otorga un plan, le dice cómo se**
> **comporta.**

Eso conserva el corte de `DEC-ARCH-005` sin excepción: los entitlements y los limits siguen sin
cruzar hacia billing, igual que los montos siguen sin cruzar hacia verticales.

### 1.8 Lo que sigue sin cruzar

El §4 no se debilita. **Siguen sin cruzar** montos, precios, monedas, ciclos, estados de pago,
ids del proveedor, fechas de cobro, medios de pago, comprobantes y reembolsos. Se agregan dos
prohibiciones que el racimo hace necesarias:

1. **No cruzan los valores de lo que otorga una fuente** — ni los del plan, ni los del addon, ni
   los de un grant. Sólo la referencia. Es el §2.3 extendido a las cinco fuentes.
2. **No cruza el estado de la suscripción, tampoco el de la instancia de addon.** El §4 ya lo dice
   para la primera; la segunda es nueva y por el mismo motivo: `EXPIRED` y `CANCELLED` son de
   billing, y lo único que verticales necesita saber es si la fuente está en la lista.

---

## 2. Qué columna o entidad falta, y dónde

| # | qué falta | dónde | lado | por qué |
|---|---|---|---|---|
| E-1 | `addon_version` + sus tablas de entitlement y limit | `V/02` §2.1 | **VERT.** | vive acá el **30** |
| E-2 | `addon_product.version_id` → `addon_version` | `B/02` §2.4 | BILL. | apunta a los efectos |
| E-3 | `permanent_grant.version_de_plan`, una por vertical | `B/02` §2.4 | BILL. | la ref. del `GRANT` |
| E-4 | `courtesy_grant.subscription_id` | `B/02` §2.4 | BILL. | **pausa** una, y no dice cuál |
| E-5 | `vertical.admite_altas` | `V/02` §2.1 | **VERT.** | `B/10` §4.6 la lee y no existe |
| E-6 | `vertical.fin_de_servicio` | `V/02` §2.1 | **VERT.** | ídem |

### 2.1 E-1 es el corte del catálogo de planes, repetido en el de addons

`11-particion-del-programa.md` §2.1 ya resolvió este mismo problema una vez: *«El corte pasa por
dentro del catálogo de planes, no por afuera»*, y §2.2 lo enuncia — *«**No es por entidad, es por
campo.**»* De las seis entidades del catálogo comercial, cinco no tienen un campo de dinero y
sólo `billing_option` lo tiene.

`addon_product` está hoy del lado equivocado de ese mismo corte, entero. Guarda *«capability,
precio, recurrencia, verticales compatibles, duración, tipo de scope»* (`B/02` §2.4): **precio y
recurrencia son dinero; capability, duración y scope son capacidades.** Partido por el criterio
del §2 —*«es VERTICALES si sólo necesita saber qué puede hacer una cuenta, sin preguntar si
pagó»*—, queda:

| mitad | qué guarda | lado |
|---|---|---|
| `addon_version` | qué otorga y con qué valores, vigencia, tipo de scope | **VERTICALES** |
| `addon_product` | precio, recurrencia, verticales compatibles | **BILLING** |

Y la versión es **inmutable**, por `DEC-ARCH-001` tal cual: *«se versiona lo que tiene efecto»*.
Cambiar de 30 a 40 fotos tiene efecto sobre lo que el cliente puede hacer, así que crea versión —
exactamente como en `plan_version`, y por eso la instancia **ancla** su versión igual que la
suscripción ancla la suya.

Esto cierra además la dimensión que `00-dominios-de-los-racimos.md` declaró no enumerable en su
§5: el glosario dice *«**efectos**»* en plural y `B/02` §2.4 instancia `capability` en singular.
Con `addon_version_entitlement` y `addon_version_limit` —dos tablas, N filas cada una, espejo de
`plan_version_entitlement` y `plan_version_limit`— los efectos son plurales y tienen valor, sin
inventar una segunda forma de declarar capacidades.

### 2.2 E-3 no convierte al grant en un plan

La objeción está escrita en `F-8A3-001`: que un grant apunte a una versión de plan choca con
`NUCLEO/01` §1.5 —*«Se modela como entidad independiente, no como un plan»*— y trae *«el problema
de qué pasa cuando esa versión se retira»*.

**Las dos mitades de la objeción se contestan con reglas que ya existen.**

1. **Anclar no es ser.** Una suscripción ancla una versión de plan y no es un plan. El grant
   sigue siendo una entidad independiente, con su scope, su `includesAddons` y su firma; lo que
   gana es una referencia, que es lo que toda fuente tiene que tener (§1.3).
2. **El retiro ya está resuelto.** `V/02` §2.1 dice que *«una suscripción lee su versión anclada,
   vigente o no, vendible o no»*, y el invariante `D13` de `NUCLEO/04` §3 lo enuncia como regla:
   *«Retirar un plan del catálogo no mueve ninguna suscripción»*. Una versión anclada sigue
   otorgando lo que otorgaba. **El anclaje es exactamente el mecanismo que `plan_version` existe
   para dar**, y un grant que lo usa no necesita ninguna regla nueva para sobrevivir a un retiro.

La alternativa —que el grant declare su propio juego de claves— es la que sí rompe algo: crea *«una
segunda forma de declarar entitlements»*, que es lo que `V/02` §1.2 impide. Por eso la recomendación
es E-3; la decisión sigue siendo del owner (§6, decisión 1) porque agrega una columna a una entidad
que el glosario describe.

### 2.3 E-4 es la columna que el mecanismo de la cortesía ya presupone

`DEC-GRANT-003` implementa la cortesía *«pausando en el proveedor y sosteniendo el servicio de
nuestro lado»*, y `B/14` §4.3 confirma que sobre un grant no se otorga porque *«no queda nada que
no cobrar»*. Las dos frases dicen lo mismo: **una cortesía presupone una suscripción**. La fila de
`courtesy_grant` guarda *«beneficiario, scope, días o meses, inicio, fin, quién lo firmó,
motivo»* — y no dice cuál.

Con la columna, la referencia de `CORTESÍA` es **la versión anclada de la suscripción que pausa**,
y no hace falta inventar nada: es la misma referencia que llevaría `SUSCRIPCIÓN`. Lo que el `tipo`
aporta es la distinción que sí importa: una suscripción `PAUSED` por `CUSTOMER_REQUEST` **no
cubre** —`B/16` §2.2: *«el servicio está detenido»*— y una `PAUSED` por `COURTESY` **sí**, porque
lo sostenemos nosotros. `DEC-GRANT-004` ya fijó que *«el reloj que reanuda lee el motivo, nunca el
estado del proveedor»*; acá la cobertura hace lo mismo.

---

## 3. Los caminos de los hallazgos, reejecutados

### 3.1 Los que SIGUEN llegando

#### `F-8B3-003` — el cobro de única vez de un addon no tiene fila posible · **SIGUE LLEGANDO.**

Recorrido completo sobre el texto corregido:

| paso | qué pasa ahora |
|---|---|
| 1 | *+5 fichas*, `UNA_VEZ` × `MIENTRAS_VIVA…`, sin suscripción de complemento — **igual** |
| 2 | hay que escribir un `payment`, y `payment` guarda *suscripción* — **igual** |
| 3 | colgado de la principal, el `UNIQUE` de `C5` lo rechaza — **igual** |
| 4 | sin colgar de nada, el `receipt` del §54 no tiene contra qué emitirse — **igual** |
| 5 | se pierde el rastro de un cobro real — **llega** |

**Ni un solo paso pasa por el contrato.** El camino es entero de billing: `payment`, `receipt`,
el candado `C5`. Partir `addon_product` (E-1) no le crea una fila al cobro, y nada de lo que el
contrato transporte la crea, porque el dinero **no cruza la frontera** y ésa es la decisión que no
se relitiga.

**De qué depende**: del **capítulo 13**, que no existe. `11-particion-del-programa.md` §7 lo deja
planteado —*«Si el capítulo 13 adopta el cargo puntual como modelo canónico. Está planteado y sin
responder»*— y `B/16` cierra diciendo que *«El checkout de una contratación … es del capítulo
13»*. R2 lo declara y no lo cierra.

#### `F-8C1-003` — las tres defensas sin dueño · **DOS SE CORTAN, LA TERCERA NO.**

| defensa | paso donde se corta | estado |
|---|---|---|
| §6.1 el default es negar | paso 1 | **se corta** — §1.3 le da forma y contenido |
| §6.2 un juego de casos para las dos | paso 2 | **se corta** — §4.4 le da el criterio de terminación |
| §6.3 el guard que la frena | **no se corta** | sigue naciendo en `B4`, épica bloqueada |

El paso 3 del camino dice que durante toda la vida de la épica de verticales *«no existe ningún
mecanismo que impida que la implementación de arranque llegue a producción»*. El argumento para
ponerlo en `B4` está escrito en las dos descomposiciones: mientras la de arranque sea la única
implementación, **el guard fallaría desde el primer día**.

**El argumento se disuelve al mirar contra qué se dispara el guard**, y eso es una propuesta, no
un hecho: `DEC-ARCH-007` dice que ninguna épica llega a producción sola, así que un guard que
falle sobre **un build destinado a producción** —no sobre la rama de la épica— **nunca se dispara
mientras nada apunte a producción**, y se puede escribir en `V4` desde el día uno. Es la misma
forma de la condición A de `DEC-ARCH-004`: convertir *«no lo hagas»* en *«no se puede»*.

**Pero asignar `§6.1`, `§6.2` y `G13` a `V4` es editar `HOS-1353/descomposicion.md`**, que es la
salida 3 de `DEC-METH-004` y no se ejecuta acá. Hasta que eso pase, el paso 3 del camino sigue
llegando. Queda como decisión del owner (§6, decisión 4).

### 3.2 Los que dejan de llegar

#### `F-8A1-004` — un grant cruza la frontera sin nada que diga qué otorga

| paso | qué pasa ahora |
|---|---|
| 1 | `SUPER_ADMIN` otorga el *Free Forever* — **no se firma sin nombrar la versión** (E-3) |
| 3 | devolvería `versiónDePlan: ?` — **inexpresable**: la referencia no es anulable (§1.3) |
| 5-6 | las ramas A y B — **no existen**: no hay fuente sin referencia que ramificar |

**Se corta en el paso 1**, y de nuevo en el 3. El párrafo de cierre del hallazgo —la cortesía con
*«el mismo problema en menor grado»*— se corta en el mismo lugar por E-4 y §2.3.

#### `F-8A3-001` — la fuente `GRANT` no guarda qué otorga

| paso | qué pasa ahora |
|---|---|
| 2 | billing escribe la fila de `permanent_grant` — **no se puede escribir sin la referencia** (E-3) |
| 4 | *«un grant no tiene versión de plan»* — **la tiene, anclada; anclar no es ser** (§2.2) |
| 5 | *«`permanent_grant` tampoco guarda claves»* — **no tiene que guardarlas**: apunta a las del plan |

**Se corta en el paso 2.** Y la disyuntiva que el hallazgo declaró *«no es una elección técnica»*
se resuelve sin la segunda forma de declarar entitlements que temía.

#### `F-8A3-002` — ningún lugar guarda el valor de un addon

| paso | qué pasa ahora |
|---|---|
| 1 | *«escribe la capability … y no tiene dónde escribir el 30»* — **`addon_version_limit`** (E-1) |
| 2 | `addon_instance` tampoco — **no tiene que**: ancla su `addon_version` |
| 3 | `SUMA` sobre las fuentes vivas — el addon aporta **clave y valor** |
| 4 | *«20, o 20 más un valor inventado en el código»* — **50**, con los dos valores en base |

**Se corta en el paso 1.** El segundo filo —*«`addon_product` guarda **una** `capability`,
singular»* contra los *«efectos»* en plural del §39— se corta en el mismo lugar: dos tablas hijas,
N filas cada una.

#### `F-8B3-007` — el contrato no puede transportar ni un addon ni un grant

| paso | qué pasa ahora |
|---|---|
| 1-3 | el grant sin versión de plan — **se corta en el 3** por E-3 y §1.3 |
| 4 | *«no hay `ADDON`»* — **lo hay** (§1.2); la granularidad que falta — **`objetivo`** (§1.6) |
| 5 | *«o el corte no existe, o los addons no otorgan nada»* — **ninguna de las dos** |

**Se corta en el paso 3 la mitad del grant y en el paso 4 la del addon.** La disyuntiva del paso 5
desaparece porque las dos ramas que la componen dejaron de ser las únicas.

#### `F-8A1-003` — una fuente `LISTING` se agrega en un conjunto por `user + vertical`

| paso | qué pasa ahora |
|---|---|
| 3 | la instancia entra como fuente — **entra con `alcance: LISTING` y `objetivo: L1`** |
| 4 | *«La resolución … no lleva ficha»* — **el tramo cacheado ya no la incluye** (§1.6) |
| 5 | el conjunto efectivo de `(user, ALOJAMIENTO)` la tiene — **no la tiene** |
| 6 | el cupo comprado para `L1` se gasta en `L4` — **no llega** |

**Se corta en el paso 4.** Y la ficha está disponible donde hace falta porque el paso 4 de la
resolución de autorización ya la resolvió.

#### `F-8B3-009` — billing lee tablas de verticales, y dos columnas no existen

| paso | qué pasa ahora |
|---|---|
| 1-2 | `puedePausar()`, grace, la intersección — **`políticaDePlan()`**, declarado (§1.7) |
| 3-4 | *«si admite altas, y su fecha de fin de servicio»* sobre `vertical` — **E-5 y E-6** |
| 5 | el listado del §48 — **se corta con el sexto campo de la dirección inversa**, ver §4.3 |
| 6 | *«se disparó cinco veces sin que nadie la haya mirado»* — **mirada, y son seis** |

**Se corta en el paso 3**, salvo el paso 5, que se corta sólo si la dirección inversa enumera
**seis** campos y no cinco — un hallazgo del barrido, no del hallazgo original.

---

## 4. El dominio recorrido — los 28 casos

Los **11 ya probados fallando** llevan `▣`; los **17 que nadie miró** llevan `□`. Éstos últimos
son el centro: cinco de ellos cambiaron algo de la resolución.

### 4.1 Transporte — 6 fuentes × 2 campos de contenido = 12

| # | caso | veredicto |
|---|---|---|
| □ 1 | (`SUSCRIPCIÓN`, referencia) | **cerrado sin cambio** — la versión anclada (`B/02` §2.2) |
| □ 2 | (`SUSCRIPCIÓN`, `hasta`) | **cerrado con regla nueva** — `SIN_FECHA_CONOCIDA` (§1.5) |
| □ 3 | (`TRIAL`, referencia) | **cerrado, con dependencia de R3** — el plan de trial (`V/02` §2.2) |
| □ 4 | (`TRIAL`, `hasta`) | **cerrado** — `trial.fin`, calendario (`V/11` §1.2), reloj nuestro |
| ▣ 5 | (`CORTESÍA`, referencia) | **cerrado con E-4** — la versión de la suscripción que pausa |
| □ 6 | (`CORTESÍA`, `hasta`) | **cerrado** — `courtesy_grant.fin`; se puede acortar, y el aviso lo ve |
| ▣ 7 | (`GRANT`, referencia) | **ABIERTO — decisión del owner** — E-3 es la recomendación (§2.2) |
| □ 8 | (`GRANT`, `hasta`) | **cerrado** — `NO_VENCE`, distinto de `SIN_FECHA_CONOCIDA` (§1.5) |
| ▣ 9 | (`ADDON`, referencia) | **cerrado con `tipo ADDON` + E-1** |
| ▣ 10 | (`ADDON`, `hasta`) | **cerrado** — fecha si `DÍAS_FIJOS`; si no, `SIN_FECHA_CONOCIDA` |
| □ 11 | (herencia VIP, referencia) | **ABIERTO para el plan de trial** — ver abajo |
| □ 12 | (herencia VIP, `hasta`) | **cerrado** — es el `hasta` de la fuente que lleva el flag |

**El caso 11 es el que el barrido destapó.** `hereda Turista VIP` es una columna de `plan_version`
(`11-particion` §2.1), y el plan de trial **es** una `plan_version` (`V/02` §2.1: *«un `plan` con
su versión, marcado no vendible»*). `DEC-TRIAL-001` declara la derivación **de entitlements y de
limits** y el flag no es ninguno de los dos: es una columna hermana de `rank` y de *«días de
grace»*. **Nadie declaró si el plan de trial hereda Turista VIP**, y las dos lecturas son
defendibles — derivarlo del vendible de `rank` más alto, como los entitlements, o declararlo en el
plan de trial como se declara `vendible`. Es un caso del paso 6 —qué otorga el título— así que es
de R2, no de R3. Queda como decisión del owner (§6, decisión 3).

### 4.2 Scope — 4 alcances de fuente × 2 claves de resolución = 8

Las dos claves son las de `V/15` §3.2: una clave **de vertical** resuelve por `user + vertical`,
una clave **global** resuelve por `user`. Y `V/15` §1 es explícito en que los ejes son
independientes — *«Una fuente global puede otorgar una clave de vertical, y una fuente de vertical
puede otorgar una clave global»*—, así que las ocho casillas son legítimas y lo que hay que decir
es **con qué se resuelve cada una**.

| alcance \ clave | **de vertical** (`user + vertical`) | **global** (`user`) |
|---|---|---|
| `LISTING` | ▣ **cerrado** — delta por ficha (§1.6) | □ **cerrado por prohibición** — ver abajo |
| `VERTICAL` | □ **cerrado** — el tramo cacheado | □ **ABIERTO** — falta el pliegue por `user` |
| `USER` | □ **cerrado** — en todas, con la excepción de `V/11` §5.3 | □ **ABIERTO** — ídem |
| `GLOBAL` | □ **cerrado** — ídem | □ **ABIERTO** — ídem |

**`LISTING` × clave global se cierra prohibiéndolo.** Una clave global se resuelve por `user`, sin
vertical y sin ficha; una fuente `LISTING` sólo puede aportar cuando la operación nombra su ficha.
No hay pliegue donde las dos se encuentren, así que **una fuente de alcance `LISTING` no puede
otorgar una clave de scope global**. Es una restricción que el diseño no enuncia y que sale de
cruzar `V/15` §3.2 con §1.6 de este documento.

**Las tres casillas abiertas son la misma falta, y es de `V/02` §3.2.** Una clave global se
resuelve por `user`, o sea plegando las fuentes de **todas** las verticales — y `cobertura` no se
puede invocar sin vertical, por diseño (§2 del contrato). Se resuelve sin tocar la firma, porque
el conjunto de verticales es cerrado: `vertical` es *«el espejo en base del enum de código»*
(`V/02` §2.1), así que la resolución por `user` es el pliegue de `cobertura(user, v)` sobre el
enum. **Lo que falta es el caché.** `V/02` §3.1 dice que lo que se cachea es *«el conjunto
efectivo de un `user + vertical`»* y las siete entradas de invalidación del §3.2 son todas de esa
clave: **no hay entrada de caché ni lista de invalidación para la resolución por `user`**, y
`V/15` §3.3 la necesita para su caso motivador —la insignia global que da el plan premium de
Alojamiento y que se pierde *«en todas las verticales»*—. Es materia del capítulo 02 de
verticales, y R2 la deja nombrada, no resuelta (§5).

### 4.3 La dirección inversa — 5 campos, y apareció un sexto

| # | campo | tabla | veredicto |
|---|---|---|---|
| □ D1 | días de grace | `plan_version` | **cerrado** — existe; cruza por `políticaDePlan()` |
| □ D2 | días de trial | `plan_version` | **cerrado** — ídem |
| □ D3 | permite pausa | `plan_version` | **cerrado** — ídem; lo lee `puedePausar()` (`NUCLEO/01` §3) |
| ▣ D4 | admite altas | `vertical` | **cerrado con E-5** |
| ▣ D5 | fecha de fin de servicio | `vertical` | **cerrado con E-6** |
| — D6 | vigente / vendible de la versión | `plan_version` | **encontrado en el barrido** — ver abajo |

**D1, D2 y D3 existen y ese no era el problema**: el problema es que cruzan una frontera que el §4
declara cerrada, sin que nadie lo declarara. Con §1.7 dejan de ser una lectura directa de tablas
ajenas y pasan a ser el segundo hecho del contrato.

**D6 no estaba contado, y sin él el paso 5 de `F-8B3-009` sigue llegando.** `B/19` §6 pide mostrar
*«las **versiones de plan retiradas** con cuántas suscripciones siguen ancladas»*. Billing ya
tiene la mitad —`subscription` guarda su *«versión de plan anclada»*, `B/02` §2.2— y puede
agrupar por ella sola; lo que no tiene es **cuáles están retiradas**, que son las columnas
`vigente` y `vendible` de `plan_version` (`V/02` §2.1). Es un sexto campo de lectura inversa sobre
columnas que **ya existen**, y por eso `políticaDePlan()` las incluye en §1.1.

**Y hay una colisión de nombres que conviene no heredar.** *«Fecha de fin de servicio»* nombra hoy
dos cosas distintas: la de `subscription`, que es cuándo deja de cubrir un cliente
(`DEC-SUB-009`), y la de `vertical`, que es cuándo cierra una vertical entera (`B/10` §4.6). La
primera viaja en `hasta`; la segunda, en `situaciónDeVertical()`. No se renombra nada acá, pero
las dos no son el mismo dato y ningún documento lo dice.

### 4.4 Las tres defensas — 3

| # | defensa | veredicto |
|---|---|---|
| ▣ §6.1 | el default es negar | **cerrado** — §1.3 lo vuelve estructural en vez de una convención |
| ▣ §6.2 | un juego de casos contra las dos | **cerrado** — criterio de terminación, abajo |
| ▣ §6.3 | el guard que frena la de arranque | **ABIERTO** — forma en §3.1; asignar es salida 3 |

**§6.2 tenía el problema de no poder decir cuándo está completo**, que es lo que `F-8C1-003`
señala al notar que ninguna descomposición declara *«con qué criterio de terminación»*. Con el
contrato de §1.1 el criterio existe y es contable:

1. **un caso por cada `tipo`** — cinco, y la implementación de arranque resuelve `TRIAL` y niega
   los otros cuatro;
2. **un caso por cada valor de `hasta`** — tres, incluido el que distingue `NO_VENCE` de
   `SIN_FECHA_CONOCIDA`, que es el que decide si el aviso promete ventana;
3. **un caso por cada `alcance`** — cuatro, y el de `LISTING` es el que falla si alguien vuelve a
   plegarlo en el tramo cacheado;
4. **un caso de la dirección inversa** por cada uno de los seis campos;
5. **y el caso que `§6.2` exige explícitamente** —*«el caso que distingue una implementación
   correcta de una que contesta siempre lo mismo»*—: un trial que **vence** y hace que `cobertura`
   pase de sí a no por sí sola, que es lo que `HOS-1353/descomposicion.md` §4 ya le pide a `V4`.

El caso 1 es el que la implementación de arranque **no puede pasar entera**, y eso es la
propiedad, no el defecto: `HOS-1354/descomposicion.md` §4 se lo pide a `B4` con esas palabras —
*«hay al menos uno que la de arranque no pasa»*.

### 4.5 El recuento

| dimensión | casos | cerrados | abiertos |
|---|---|---|---|
| transporte | 12 | 10 | 2 |
| scope | 8 | 5 | 3 |
| dirección inversa | 5 | 5 | 0 |
| las tres defensas | 3 | 2 | 1 |
| **total** | **28** | **22** | **6** |

De los **17 que nadie había mirado**, **13 cerraron** y **4 quedaron abiertos** —los tres del
pliegue por `user` y el flag de Turista VIP del plan de trial—, y **cinco de los 17 cambiaron la
resolución**: el `hasta` de la suscripción (§1.5), la prohibición de `LISTING` × clave global
(§4.2), el pliegue por `user` sin caché (§4.2), el flag del plan de trial (§4.1) y el sexto campo
de la dirección inversa (§4.3).

---

## 5. Lo que R2 NO puede cerrar

| # | qué | de qué depende |
|---|---|---|
| 1 | **el cobro de única vez de un addon** (`F-8B3-003`) | del **capítulo 13**, que no existe |
| 2 | **el guard `§6.3`** | de editar `HOS-1353/descomposicion.md` — salida 3 de `DEC-METH-004` |
| 3 | **que exista una fila de `trial` para el paso 5** | de **R3**, que resuelve otro agente |
| 4 | **el caché de la resolución por `user`** | del capítulo 02 de verticales (`V/02` §3.1 y §3.2) |
| 5 | **la referencia del `GRANT`** | de la decisión 1 del §6 |
| 6 | **el flag de Turista VIP del plan de trial** | de la decisión 3 del §6 |

**El 1 es el único que no se puede cerrar aunque el owner decida hoy.** El capítulo 13 es el único
de los 22 sin escribir, y su contenido *«es exactamente lo que espera a la pasarela»*
(`11-particion` §4). Mientras `payment` cuelgue de una suscripción y el §54 exija comprobante por
cada cobro, un addon `UNA_VEZ` sin suscripción de complemento no tiene fila — y eso no se arregla
en la frontera porque el dinero no la cruza.

**El 3 es la adyacencia con R3 y se declara, no se invade.** R3 es el paso 5 —*¿tiene título?*—;
R2 es el paso 6 —*¿qué otorga?*—. Los casos 3 y 4 de §4.1 dan por hecho que hay una fila de
`trial`; si R3 resuelve que `PRE_TRIAL` es un quinto tipo de título acotado (una de las tres
salidas que `F-8A1-002` enumera), **el contrato gana un sexto `tipo`** y la referencia de ese
tipo hay que decidirla con el mismo criterio de §1.0. R2 deja la forma lista para recibirlo y no
lo decide.

**Y el 4 no es una omisión de este documento: es una consecuencia del barrido.** La resolución por
`user` existe en el diseño desde `V/15` §3.2 y nunca tuvo caché ni lista de invalidación. R2 lo
encuentra porque recorrió las ocho casillas; corregirlo es del capítulo 02 de verticales.

---

## 6. Qué requiere decisión del owner

### 1 · La referencia que transporta un `GRANT` · costo bajo, riesgo bajo

Anclar el grant a una versión de plan por cada vertical de su scope (E-3), o dejar que declare su
propio juego de claves. **Recomendada: anclar.** Costo: una columna en `permanent_grant` y un
paso más en el alta —`SUPER_ADMIN` elige qué versión regala—. Riesgo: que alguien lea el anclaje
como *«el grant es un plan»*, que el §2.2 contesta. La alternativa cuesta una segunda forma de
declarar entitlements, que es lo que `V/02` §1.2 prohíbe.

### 2 · Partir `addon_product` por campo · costo medio, riesgo bajo

E-1 y E-2: los efectos a verticales, el precio a billing, con versión inmutable. Costo: tres
entidades nuevas del lado de verticales y una referencia del lado de billing; toca `V/02` §2.1,
`B/02` §2.4 y la ficha de la unidad de cada lado. Riesgo: bajo, porque es el mismo corte que
`11-particion` §2.1 ya hizo con `plan_version` y `billing_option`. **No hacerlo deja el 30 de
*«plan 20 + addon 30 = 50»* sin columna**, que es `F-8A3-002` intacto.

### 3 · Si el plan de trial hereda Turista VIP · costo bajo, riesgo medio

Derivarlo del vendible de `rank` más alto, como los entitlements, o declararlo en el plan de
trial, como `vendible`. Costo: una línea en `DEC-TRIAL-001` o en `V/02` §2.1. **Riesgo medio por
la dirección en la que falla**: si se deriva y el plan premium hereda, el trial regala beneficios
de Turista VIP a quien todavía no pagó nada, y `DEC-ENT-003` además le **bloquea la compra** de
VIP mientras se los demos.

### 4 · Dónde nace el guard `§6.3` · costo bajo, riesgo alto si no se decide

Escribirlo en `V4` como guard de **destino de producción** (§3.1), o dejarlo en `B4` y aceptar
que durante toda la épica de verticales la defensa no existe. Costo: bajo en las dos. **Riesgo
alto en la segunda**, y está escrito en el propio contrato: el proyecto ya tuvo *«un fallback
comentado como seguro que era el permisivo»*, y `DEC-ARCH-006` declara el riesgo de que la
implementación de arranque sobreviva a producción como el motivo de que las tres defensas sean
parte de la decisión.

### 5 · Declarar la dirección inversa dentro del contrato · costo bajo, riesgo bajo

§1.7, con sus seis campos. Costo: una sección del contrato, dos columnas en `vertical` (E-5, E-6).
Riesgo: el hallazgo lo anticipa —*«salvo que ampliar el contrato en la otra dirección se considere
una mutación de `DEC-ARCH-006`»*—. **No es una mutación: es escribir la mitad que faltaba**, y si
no se escribe, billing lee tablas de verticales sin contrato, que es el acoplamiento que el corte
venía a impedir.

### 6 · `cubierto` deja de contar todas las fuentes · costo bajo, riesgo alto si no se decide

§1.4. Costo: una línea en §2.1 del contrato. **Riesgo alto si se agrega `ADDON` sin esto**: un
suspendido con un addon vivo queda cubierto, que es un fail-open **introducido por el arreglo** —
exactamente la forma de defecto que `DEC-METH-004` mandó a evitar.

---

## Lo que este documento NO decide

- **No aplica nada.** Ni el contrato, ni los modelos de datos, ni las descomposiciones, ni el
  decision log. Las cuatro salidas de `DEC-METH-004` siguen pendientes para R2.
- **No invade R3.** El paso 5 —si hay título— es de otro agente; acá está el paso 6, y la
  dependencia está declarada en §5.
- **No escribe el capítulo 13** ni decide si el cargo puntual es su modelo canónico.
- **No reabre `DEC-ARCH-004` a `007`.** La resolución se escribió **dentro** de la partición en
  dos épicas y de la frontera de un solo contrato con dos implementaciones.
- **No renombra nada del PDR.** Ni los cuatro scopes del §40, ni las dos *«fechas de fin de
  servicio»*. Donde había colisión, se declaró el mapeo.

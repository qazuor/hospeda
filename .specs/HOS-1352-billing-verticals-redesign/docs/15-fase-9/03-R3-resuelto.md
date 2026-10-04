---
title: "FASE 9 · R3 resuelto — el trial puede nacer"
linear: HOS-1352
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 9
---

# FASE 9 · R3 resuelto — el trial puede nacer

`DEC-METH-004` exige dos cosas para declarar un racimo resuelto: que el camino de cada hallazgo,
reejecutado sobre el texto corregido, ya no llegue, **y** que la regla corregida se verifique
contra todo el dominio que cuantifica. El dominio de R3 está enumerado en
[`00-dominios-de-los-racimos.md`](./00-dominios-de-los-racimos.md) §R3: **45 casos** — 5 verticales
× 4 estados de trial, más 5 verticales × 5 transiciones. Acá están los 45 recorridos, los tres
caminos reejecutados, y lo que R3 **no** puede cerrar.

**Este documento no aplica ningún cambio.** No edita el PDR, ni el decision log, ni ningún
capítulo. Lo que sigue es la resolución escrita y verificada: qué tiene que decir el paso 5, qué
condición se cae de `T1`, qué fila existe en qué momento, y contra qué se verificó cada afirmación.

**El resultado en una línea.** Los 8 casos que la FASE 8 probó fallando cierran; de los **37 que
nadie había mirado**, 29 cierran y **8 quedan abiertos** — y esos 8 son **un solo hueco visto
desde dos ejes**, que ningún hallazgo de FASE 8 había nombrado: **un trial vencido no tiene título,
así que no puede suscribirse, así que la *«recuperación posible»* del §21 es inalcanzable.**

Los paths se abrevian como en el documento de dominios: `NUCLEO` es `HOS-1352-…/docs/nucleo/`, `V`
es `HOS-1353-verticales-capacidades-y-autorizacion/docs/`, y lo que no lleva prefijo es
`HOS-1352-…/docs/`.

---

## 1. Cómo nace el trial

### 1.1 La idea, en una frase

> **El paso 5 pregunta si hay de dónde resolver capacidades, no cuáles son.** El trial es fuente
> viva desde que la persona entra a la vertical; lo que cambia en `T1` no es **si hay título**,
> sino **a qué versión de plan apunta**.

El defecto que R3 nombra sale de que el paso 5 estaba haciendo el trabajo del paso 6 con el mensaje
del 5. `V/17-autorizacion.md` §1.2 los separa explícitamente —paso 5 falla con *«sin cobertura»*,
paso 6 con *«sin la capacidad»*— y después el paso 5 quedó enunciado de forma que sólo el trial
**ya consumido** lo pasa. Quien todavía no consumió nada no tiene ninguna de las cuatro fuentes, y
entonces no puede ejecutar la operación cuyo objeto es crear la primera.

### 1.2 Las cinco reglas, con su texto concreto

**R3-A · El trial es fuente viva en `PRE_TRIAL` y en `TRIAL_ACTIVE`, y en ningún otro estado.**

| estado del trial | ¿fuente viva? | `versiónDePlan` que devuelve | `hasta` |
|---|---|---|---|
| `PRE_TRIAL` | **sí** | la versión de **pre-trial** de la vertical | sin fecha |
| `TRIAL_ACTIVE` | **sí** | la versión del **plan de trial** | la fecha de fin |
| `TRIAL_CONVERTED` | no | — (el título pasó a ser la suscripción) | — |
| `TRIAL_EXPIRED` | no | — | — |

Las dos filas de abajo son lo que sostiene `PB2`. `V/03-maquinas-de-estado.md` §9 declara que `PB2`
dispara cuando *«se pierde la cobertura»*, con *«trial vencido (T3)»* entre sus causas: si
`TRIAL_EXPIRED` siguiera cubriendo, `PB2` no dispararía nunca y el criterio de terminación que
`12-contrato-de-cobertura.md` §5.1 le pone a la implementación de arranque —*«los dos caminos se
ejercen completos, porque un trial vence de verdad»*— quedaría sin objeto.

Y la fila de arriba no abre la puerta inversa, porque **no hay puerta**: `V/03` §2 dice *«No existe
transición de vuelta a `PRE_TRIAL` ni a `TRIAL_ACTIVE` desde `TRIAL_EXPIRED`»*. Nadie entra a
`PRE_TRIAL`; se empieza ahí. Una cobertura que sólo existe en el estado inicial no puede
**recuperarse** por esta vía, y por lo tanto no desarma ningún disparador de pérdida.

**R3-B · El paso 5 pregunta si hay título; no pregunta qué otorga.**

Texto para `V/17-autorizacion.md` §1.2, fila 5 de la tabla:

> | 5 | **título vivo** | ¿hay **al menos una fuente viva** —trial, suscripción, cortesía o grant—
> para ese `user + vertical`? | sin cobertura |

Y la precisión que va debajo de la tabla, como cuarta de las *«tres precisiones que el orden hace
cumplir»* del §1.2:

> 4. **El paso 5 no decide capacidades: decide si hay de dónde resolverlas.** Una fuente viva es la
>    que el contrato de cobertura devuelve con su `versiónDePlan`; **qué otorga esa versión es el
>    paso 6**. Ahí se separa quien puede publicar de quien sólo puede escribir borradores. Un paso
>    5 que contestara *«sin cobertura»* a alguien que tiene una fuente viva con conjunto efectivo
>    vacío estaría dando el veredicto del 6 con el mensaje del 5 — y ésa es la forma exacta en que
>    el paso 5 dejó de tener respuesta para `PRE_TRIAL`.

**R3-C · `PRE_TRIAL` apunta a una versión de plan propia: la de pre-trial.**

Texto para `V/02-modelo-de-datos.md` §2.1, a continuación de *«El plan de trial no es una entidad
aparte»*:

> **El plan de pre-trial tampoco.** Es un `plan` con su versión, marcado **no vendible**, uno por
> vertical, y es lo que la fuente de trial apunta mientras el trial está en `PRE_TRIAL`. A
> diferencia del de trial, **sus entitlements y limits sí se guardan**: no hay de dónde derivarlos
> —no son los del premium ni los del más bajo— y el §10.3 sólo prohíbe copiar **los del trial**.
> Otorga exactamente tres cosas: lo que `DEC-TRIAL-007` ya prometió —borradores ilimitados, **sin
> ninguna capacidad comercial**—, **la capacidad de activación de la vertical**, y la de contratar
> una suscripción.

Y la regla que ata la tercera columna a la condición de `T1`, para el mismo §2.1:

> **La capacidad de activación está en la versión de pre-trial de una vertical si y sólo si esa
> vertical declara evento de activación y su plan de trial tiene días > 0.** Es la condición de
> `T1` expresada como dato en vez de como rama, y un guard la verifica en las dos direcciones —
> el mismo mecanismo con que el cap. 02 §1.2 verifica el espejo del enum de verticales. Partner,
> que hoy tiene el trial en cero (`DEC-TRIAL-003`) y **ningún evento declarado**
> (`DEC-TRIAL-006`), no la lleva.

**R3-D · `T1` pierde la condición que se contradecía con su propio estado de origen.**

Texto para la fila `T1` de `V/03-maquinas-de-estado.md` §2:

> | T1 | `PRE_TRIAL` | el evento de activación declarado por la vertical | `TRIAL_ACTIVE` | la
> vertical declara evento **y** su plan de trial tiene días de trial > 0 | **crea la fila de
> `trial`**; se asigna el plan de trial; arranca el reloj; se agenda la campaña previa del §10.7 |

Y la precisión, como quinta de las *«cuatro cosas que la tabla fija»*:

> - **`T1` crea la fila, y por eso `PRE_TRIAL` no la tiene.** La condición vieja —*«no hay trial
>   previo para ese `user + vertical`»*— decía lo mismo que su estado de origen **y lo negaba**:
>   con fila en `PRE_TRIAL`, *«no hay trial previo»* es falso siempre, y `T1` no dispara nunca. Se
>   cae por **redundante**, no por permisiva. Lo que impide un segundo trial son dos cosas que
>   siguen intactas: **ninguna transición vuelve a `PRE_TRIAL`** (§2) y la fila que `T1` crea es
>   única de por vida (cap. 02 §2.2).

**R3-E · `PRE_TRIAL` es el estado inicial, se representa por la ausencia de fila, y sigue siendo un
estado real.**

Texto para `NUCLEO/03-maquinas-de-estado.md` §1, regla 2:

> 2. **El estado vive en una columna con dominio restringido** … **y el estado inicial de una
>    máquina cuya fila nace en su primera transición vive afuera de la columna.** Que viva afuera
>    no lo vuelve la ausencia de un estado: es un estado porque tiene reglas declaradas y una
>    salida declarada, no porque tenga fila. Es lo que la máquina de suscripción ya hace con su
>    renglón `(sin fila)`, y lo que la de trial hace con `PRE_TRIAL`.

Y la precisión para `NUCLEO/01-glosario.md` §2.2, pegada a la frase que hoy dice *«`PRE_TRIAL` es
un estado real, no la ausencia de uno»*:

> **Real no quiere decir con fila.** Una fila en `PRE_TRIAL` no llevaría **ni un dato** que su
> ausencia no lleve: el hash del correo normalizado, el piso del trinquete, la referencia al plan
> y las dos fechas se escriben **todos** en `T1` (cap. 02 §2.2). Lo que hace real a `PRE_TRIAL`
> son sus reglas —borradores ilimitados, sin capacidades comerciales, sin consumir trial
> (`DEC-TRIAL-007`)— y su transición de salida, y las dos existen sin fila.

### 1.3 La secuencia completa, paso por paso

Alguien entra a Gastronomía por primera vez. No hay fila de `trial` para ese `user + vertical`.

| # | qué pasa | contra qué |
|---|---|---|
| 1 | `cobertura(user, GASTRONOMÍA)` devuelve `cubierto: sí`, con una fuente: `{ tipo: TRIAL, versiónDePlan: <pre-trial de gastronomía>, hasta: sin fecha }` | `12-contrato…` §2, R3-A |
| 2 | Crea un borrador. Paso 4: el recurso es suyo y está en `DRAFT`. Paso 5: **sí**. Paso 6: la versión de pre-trial otorga crear borrador. Paso 7: el limit es ilimitado | `V/17` §1.2, `DEC-TRIAL-007` |
| 3 | Aprieta publicar. `PB1` declara su vertical en la firma. Paso 5: **sí**, la misma fuente | `V/17` §2.2 |
| 4 | Paso 6: la versión de pre-trial de gastronomía otorga **la capacidad de activación**, porque gastronomía declara evento y su plan de trial tiene días > 0 | R3-C, `DEC-TRIAL-006` |
| 5 | Paso 7: el limit de fichas publicadas de la versión de pre-trial es **1** — es el §64.6, *«máximo una ficha en trial»* | `NUCLEO/04` §2.2, `DEC-TRIAL-001` |
| 6 | `PB1` ejecuta, y **`T1` es su efecto**, en la misma transacción: *«una transición es atómica junto con sus efectos locales»* | `NUCLEO/03` §1, regla 3 |
| 7 | `T1` **crea la fila** con `TRIAL_ACTIVE`, la referencia al plan de trial, el piso del trinquete, las dos fechas y el hash | `V/02` §2.2, R3-D |
| 8 | La transición de trial invalida el conjunto efectivo del `user + vertical`; la próxima lectura resuelve contra el plan de trial | `V/02` §3.2 |
| 9 | La segunda publicación ya no pasa por `PRE_TRIAL`: la fuente es el trial en `TRIAL_ACTIVE`, y el limit que la acota es el del plan de trial | R3-A |

**Y qué contesta el paso 5 para alguien sin título.** Tres respuestas distintas, y ninguna es la
misma:

| quién | paso 5 | dónde falla, y con qué mensaje |
|---|---|---|
| alguien en `PRE_TRIAL` de una vertical con trial encendido | **sí** | no falla: publica, y publicar **es** consumir |
| alguien en `PRE_TRIAL` de Partner (trial en cero, sin evento) | **sí** | **paso 6**, *«sin la capacidad»* — su versión de pre-trial no otorga activación |
| alguien en `TRIAL_EXPIRED` | **no** | **paso 5**, *«sin cobertura»* — correcto para operar, y **es el hueco abierto** del §6 para suscribirse |

El segundo renglón es el que muestra que esto no relaja nada: Partner pasa el paso 5 y **no puede
hacer nada**, porque el conjunto efectivo que su fuente apunta está vacío. Lo único que cambió es
**en qué paso se le contesta que no**, y el paso 6 es el correcto: el `user + vertical` existe, la
capacidad no.

---

## 2. Qué cambia, por archivo y §

Siete cambios. Cinco son de la épica de verticales, uno del núcleo y uno —el único— roza la
frontera y **no se resuelve acá** (§6, ítem 4).

| # | archivo · § | qué cambia | regla |
|---|---|---|---|
| 1 | `V/17-autorizacion.md` §1.2, fila 5 | el paso 5 pregunta por **una fuente viva**, no por una que ya esté cubriendo comercialmente | R3-B |
| 2 | `V/17-autorizacion.md` §1.2, precisiones | se agrega la cuarta: **el paso 5 no decide capacidades** | R3-B |
| 3 | `V/02-modelo-de-datos.md` §2.1 | se declara el **plan de pre-trial**: `plan` no vendible, uno por vertical, con entitlements y limits **guardados**, y la regla del «si y sólo si» de la capacidad de activación | R3-C |
| 4 | `V/03-maquinas-de-estado.md` §2, fila `T1` | **se cae** *«y no hay trial previo para ese `user + vertical`»*; **se agrega** a los efectos *«crea la fila de `trial`»* | R3-D |
| 5 | `V/03-maquinas-de-estado.md` §2, viñetas | se agrega la quinta: `T1` crea la fila, y la condición vieja era redundante y autocontradictoria | R3-D |
| 6 | `NUCLEO/03-maquinas-de-estado.md` §1, regla 2 · `NUCLEO/01-glosario.md` §2.2 | el estado inicial de una máquina cuya fila nace en su primera transición vive **afuera** de la columna, y eso no lo vuelve la ausencia de un estado | R3-E |
| 7 | `12-contrato-de-cobertura.md` §2.1, fila `hasta` | **no se resuelve acá**: `sin fecha` gana un segundo significado y el documento es de la frontera (`DEC-ARCH-006`) | §6.4 |

**Lo que NO cambia, y conviene decirlo porque es lo que más se parece a un arreglo.** La
restricción `UNIQUE(user_id, vertical)` de `V/02` §2.2 **queda exactamente como está**, *«sin
condición de estado»*, y su glosa —*«su sola existencia niega un trial nuevo»*— **pasa a ser
literalmente cierta** por primera vez: ahora la fila existe si y sólo si el trial se consumió.
`F-8A2-002` obligaba a elegir entre tocar esa restricción y desmentir el glosario; la tercera
lectura no toca ninguna de las dos.

Y el catálogo de claves gana un guard, que es la contracara del cambio 3:

> **`G-R3` — la versión de plan de pre-trial de cada vertical no otorga ninguna clave de la clase
> comercial, ni ningún entitlement medido.** Se comprueba sobre el catálogo, en CI, en las dos
> direcciones. Es el único lugar donde un error de siembra se convierte en premium gratis para
> toda la plataforma, y por eso es una verificación automática y no una revisión.

---

## 3. Los caminos de los hallazgos, reejecutados

**Ninguno de los tres sigue llegando.** Los tres cortan, y dos de ellos cortan en un paso
mecánico; el tercero corta porque se decide una de sus dos ramas y deja de ser un dilema.

### 3.1 `F-8A1-002` — corta en el paso 4 de su propio camino

El camino, tal como está escrito en `14-fase-8-adversarial/A1-acceso-cruzado-y-autorizacion.md`:

| paso del hallazgo | qué pasa ahora |
|---|---|
| 1 · un usuario entra a Alojamiento, en `PRE_TRIAL` | **igual** — y ahora `PRE_TRIAL` no tiene fila (R3-E) |
| 2 · crea un borrador y aprieta publicar: `PB1` | **igual** |
| 3 · `PB1` es operación de dominio, la ejecuta la resolución de los nueve pasos | **igual** — no se exime de nada |
| 4 · *«El trial está en `PRE_TRIAL`. **No cubre**»* | **CORTA ACÁ.** Cubre: es fuente viva y apunta a la versión de pre-trial (R3-A) |
| 5 · `PB1` se rechaza por «sin cobertura»; `T1` nunca ocurre | inalcanzable |
| 6 · el mismo paso 5 niega crear el borrador | inalcanzable — y el borrador lo otorga el paso 6 |

Y la salida que el hallazgo anticipó como peor que el problema —*«exentar `PB1` del paso 5»*— **no
se toma**: `PB1` recorre los nueve pasos completos, incluido el 5, incluido el 6 y el 7.

### 3.2 `F-8A2-001` — corta en el paso 3 de su propio camino

| paso del hallazgo | qué pasa ahora |
|---|---|
| 1 · una persona entra a Gastronomía, `PRE_TRIAL`, *«sin capacidades comerciales»* | **igual** — y sigue sin ninguna capacidad **comercial** |
| 2 · pulsa Publicar; ninguna operación resuelve su autorización por su cuenta | **igual** |
| 3 · *«El paso 5 pregunta… **No tiene ninguna de las cuatro**»* | **CORTA ACÁ.** Tiene una: el trial, en `PRE_TRIAL` (R3-A) |
| 4 · la defensa §6.1 ordena que una fuente no implementada responda que no | no aplica: el trial **está** implementado, y responde que sí |
| 5 · la operación se rechaza; `PB1` no ocurre; `T1` tampoco | inalcanzable |
| 6 · lo mismo con Turista y el botón `Empezar` | inalcanzable — `Empezar` es la capacidad de activación de Turista, otorgada por su versión de pre-trial |

La defensa del §6.1 —*«una fuente no implementada responde que no»*— **no se debilita**: las otras
tres fuentes siguen respondiendo que no mientras billing no exista. Lo que cambia es que la fuente
que **sí** está implementada ahora responde con la verdad en los dos estados en que está viva.

### 3.3 `F-8A2-002` — corta en el paso 4, y el dilema se disuelve con una tercera lectura

El hallazgo dice textualmente: *«O `PRE_TRIAL` deja de ser un estado real … o su fila bloquea la
transición T1 … **No hay una tercera lectura**»*. La hay, y es R3-E.

| paso del hallazgo | qué pasa ahora |
|---|---|
| 1 · el estado vive en una columna con dominio restringido | **precisado**: la regla cuantifica sobre los estados que una fila puede llevar (R3-E) |
| 2 · `trial` lleva `UNIQUE(user_id, vertical)` sin condición de estado | **igual, sin tocar** — y su glosa pasa a ser literalmente cierta |
| 3 · si quien está en `PRE_TRIAL` tiene fila, la condición de `T1` es falsa y `T1` no dispara | premisa falsa: `PRE_TRIAL` **no tiene fila**, y la condición se cayó por redundante (R3-D) |
| 4 · si no tiene fila, `PRE_TRIAL` es la ausencia de una fila, *«que es lo que el cap. 03 §2 y el glosario §2.2 niegan»* | **CORTA ACÁ.** Lo que niegan es que sea la ausencia de un **estado**; una fila en `PRE_TRIAL` no llevaría ni un dato (R3-E) |
| 5 · no hay una transición «T0» que cree la fila al entrar a la vertical | **no hace falta una.** La fila la crea `T1`, y la tabla sigue siendo exhaustiva porque el estado inicial no es una fila |

**Por qué la tercera lectura no es un juego de palabras, y se puede verificar.** Dos pruebas
independientes: (1) una fila en `PRE_TRIAL` tendría **todas sus columnas en nulo** salvo el par
`user + vertical`, porque `V/02` §2.2 enumera lo que la fila guarda y **cada uno de esos valores se
escribe en `T1`**; (2) la máquina de suscripción ya empieza así — el documento de dominios lo dice
al contar los estados de `R1`: *«El décimo renglón … —(sin fila)— no es un estado: es el inicial»*.
La diferencia entre las dos máquinas es que la de trial le puso **nombre** a su inicial, y ponerle
nombre no le crea una fila.

---

## 4. El dominio recorrido — los 45 casos

El dominio se cierra **por vertical y por estado**, no por operación: `00-dominios-de-los-racimos.md`
declara que *«no existe la lista de las operaciones de dominio»* y que por eso R3 no se puede cerrar
por esa dimensión. Es un límite declarado, y el §6 lo hereda como ítem 6.

Las verticales y su evento de activación, de `DEC-TRIAL-006`: `A1` alojamiento, `A2` gastronomía y
`A3` experiencia activan **al quedar publicada la ficha**; `A4` turista, con el botón `Empezar`;
`A5` partner **no declara ninguno** y tiene el trial en cero (`DEC-TRIAL-003`).

**`(F8)` marca los 8 casos que la FASE 8 ya había probado fallando.** Los 37 restantes son los que
nadie había mirado, y son el centro de esta sección.

### 4.1 Los 20 pares (vertical, estado): *¿qué contesta el paso 5?*

**`PRE_TRIAL` — los cinco.**

| vertical | qué contesta el paso 5 | veredicto |
|---|---|---|
| `A1` alojamiento `(F8)` | **sí**, fuente trial → versión de pre-trial de alojamiento | **CERRADO** |
| `A2` gastronomía `(F8)` | **sí**, ídem | **CERRADO** |
| `A3` experiencia `(F8)` | **sí**, ídem | **CERRADO** |
| `A4` turista `(F8)` | **sí**; su versión de pre-trial no otorga borradores —Turista no tiene ficha (§6)— sino sólo activación y contratar | **CERRADO** |
| `A5` partner | **sí**, con conjunto efectivo **vacío**: sin evento y con días en cero, no lleva la capacidad de activación (R3-C) | **CERRADO** |

El de Partner es el caso que prueba que la regla no regala nada: pasa el paso 5 y no puede ejecutar
ninguna operación, porque todo cae en el paso 6. Y su alta no lo necesita: `V/17` §3.2 regla 1 pone
*«configurar el plan y el método de pago de un Partner»* entre las doce acciones del `NUCLEO/08`
§3, que son **capacidades del actor**, y no consultan el título del sujeto.

**`TRIAL_ACTIVE` — los cinco.**

| vertical | qué contesta el paso 5 | veredicto |
|---|---|---|
| `A1` · `A2` · `A3` | **sí**, fuente trial → versión del plan de trial, con `hasta` = fecha de fin | **CERRADO** (3 casos) |
| `A4` turista | **sí**, ídem | **CERRADO** |
| `A5` partner | **inalcanzable**: con días en cero `T1` no dispara, así que nadie está acá | **CERRADO-VACÍO** |

El renglón de Partner se vuelve real el día que el owner ponga ese número en distinto de cero, y
`DEC-TRIAL-003` implicación 2 ya declara que eso **es una decisión registrada**, no una edición de
configuración. Con R3-C, encenderlo es agregarle la capacidad de activación a su versión de
pre-trial y declararle su evento — no tocar código.

**`TRIAL_CONVERTED` — los cinco.**

| vertical | qué contesta el paso 5 | veredicto |
|---|---|---|
| `A1`…`A4` | el trial contesta **no**; la cobertura pasa a ser la suscripción, que es billing | **CERRADO-DIFERIDO** (4 casos) |
| `A5` partner | inalcanzable por la misma razón que arriba | **CERRADO-VACÍO** |

*Diferido* y no *abierto*: `11-particion-del-programa.md` §3.2 declara que `T2` y `T5` no disparan
hasta que exista billing, así que hoy nadie está en `TRIAL_CONVERTED`. Lo que R3 sí deja fijado es
la propiedad que hay que conservar cuando existan: **convertir no deja un título residual**. Si la
suscripción muere después, el trial ya es terminal y no vuelve a cubrir — que es exactamente lo que
el §10.2 pide y lo que `PB2` necesita para poder disparar.

**`TRIAL_EXPIRED` — los cinco, y acá están 4 de los 8 abiertos.**

| vertical | qué contesta el paso 5 | veredicto |
|---|---|---|
| `A1` · `A2` · `A3` | **no** — correcto para operar; **incorrecto para suscribirse** | **ABIERTO** (3 casos) |
| `A4` turista | **no**, y encima cae sobre `Turista Free`, que tampoco es un título (§14) | **ABIERTO** |
| `A5` partner | inalcanzable | **CERRADO-VACÍO** |

**Esto es el hueco nuevo, y no lo nombró ningún hallazgo de FASE 8.** `NUCLEO/01-glosario.md` §2.1
promete para `TRIAL_EXPIRED` las mismas consecuencias del §21 que para `SUSPENDED` —*«Mi Cuenta en
sólo lectura, billing accesible, **recuperación posible**»*—. Las dos primeras se salvan si una
lectura no es una operación de dominio; la tercera no se salva de ninguna forma: **suscribirse es
la operación que crea el título, y el paso 5 le exige uno.** Es el mismo defecto de R3 un nivel más
arriba, y se resuelve en el §6, ítem 1.

El renglón de Turista agrega que el hueco **no es del trial**: quien cae de `TRIAL_EXPIRED` cae
sobre `Turista Free`, que `NUCLEO/01` §1.1 define *«sin suscripción real»*, y ninguno de los cuatro
tipos de título lo representa. Es literalmente el camino de `F-8A1-005` —fuera de R3, `ALTA`— visto
desde adentro de R3. Los dos piden el mismo objeto que falta.

### 4.2 Los 25 pares (vertical, transición): *¿el evento que la dispara pasa el paso 5?*

**`T1` — `PRE_TRIAL` → `TRIAL_ACTIVE`.**

| vertical | ¿pasa el paso 5? | veredicto |
|---|---|---|
| `A1` `(F8)` · `A2` `(F8)` · `A3` `(F8)` | **sí** por R3-A; el paso 6 lo otorga; `T1` es efecto de `PB1` | **CERRADO** (3 casos) |
| `A4` turista `(F8)` | **sí**; `Empezar` es una operación de dominio con su vertical declarada | **CERRADO** |
| `A5` partner | `T1` **no puede disparar, y es lo correcto**: `DEC-TRIAL-006` implicación 1 dice que *«una vertical sin evento declarado simplemente no otorga trial, y falla cerrado en vez de abierto»* | **CERRADO-POR-DISEÑO** |

**`T2` — `TRIAL_ACTIVE` → `TRIAL_CONVERTED`.**

| vertical | ¿pasa el paso 5? | veredicto |
|---|---|---|
| `A1`…`A4` | **sí**: el sujeto está cubierto por el trial, y el paso 6 lo otorga porque la versión del plan de trial lleva la capacidad de contratar | **CERRADO-DIFERIDO** (4) |
| `A5` partner | inalcanzable | **CERRADO-VACÍO** |

Que el plan de trial otorgue **contratar** no es una concesión nueva: `V/11-trial.md` §5.2 ya
distingue *«¿puede comprarlo?»* de *«¿le alcanza a la ficha en trial?»*, y lo que el §10.5 prohíbe
durante el trial son los **addons**, nunca la suscripción — suscribirse es lo que el trial existe
para provocar.

**`T3` — `TRIAL_ACTIVE` → `TRIAL_EXPIRED`, y es el segundo caso que nadie había mirado.**

| vertical | ¿pasa el paso 5? | veredicto |
|---|---|---|
| `A1`…`A4` | la pregunta **no aplica**: la dispara el reloj, con un actor de sistema, y los pasos 5, 6 y 7 se evalúan sobre el sujeto | **CERRADO, con una declaración nueva** (4) |
| `A5` partner | inalcanzable | **CERRADO-VACÍO** |

`V/17-autorizacion.md` §3.3 declara al sistema como actor —*«los jobs y los webhooks operan sin
persona detrás»*— y **no dice cómo se evalúan los pasos 5 a 7 cuando el actor es uno de ellos**.
Leídos literalmente, `T3` tendría que preguntarle al sujeto si su conjunto efectivo le otorga
*«vencerme el trial»*, que no es una capacidad de nadie. La resolución usa el mecanismo que el
capítulo ya tiene, sin inventar uno: `V/17` §3.2 regla 3 declara que los pasos 5, 6 y 7 se evalúan
sobre el sujeto **salvo** en una clase declarada de operaciones que son *«capacidades del actor, no
del sujeto»*, y cierra con *«A qué clase pertenece una operación se declara, nunca se infiere»*.

> **Texto propuesto para `V/17-autorizacion.md` §3.3.** Las transiciones que dispara el reloj son
> la **segunda** clase de operaciones evaluadas sobre el actor y no sobre el sujeto. La clase es
> cerrada, se declara transición por transición, y es **disjunta de las doce**: el §3.3 ya dice
> que *«un actor de sistema no puede ejecutar ninguna de las doce acciones del capítulo 08 §3»*.
> La propiedad que la hace segura: **una transición de esta clase nunca otorga.** `T3` quita.

Esto **no es una exención por ruta ni por superficie** —que es lo que `F-8A1-002` anticipó como el
arreglo malo—: es por **actor**, el actor ya está en el capítulo, y su clase no puede ejecutar
ninguna de las doce acciones que conceden servicio.

**`T4` — `TRIAL_ACTIVE` → `TRIAL_ACTIVE`, la extensión.**

| vertical | ¿pasa el paso 5? | veredicto |
|---|---|---|
| `A1`…`A4`, por cortesía de admin | **no aplica**: *«extender un trial»* es una de las doce del `NUCLEO/08` §3 — capacidad del actor | **CERRADO** (4) |
| `A1`…`A4`, por canje de promo | **sí**: el sujeto está en `TRIAL_ACTIVE` y cubierto; el promo es de billing y hoy no existe | **CERRADO-DIFERIDO** |
| `A5` partner | inalcanzable | **CERRADO-VACÍO** |

Las dos vías caen en la misma casilla de la grilla y por eso el bloque son 5 casos y no 10; se
separan acá porque **pasan por lugares distintos de la resolución** y confundirlas es cómo se
justifica una exención. `11-particion…` §3.2 punto 3 ya declara que el techo de días *«cuenta una
fuente de tres»* mientras el promo y la cortesía no existan.

**`T5` — `TRIAL_EXPIRED` → `TRIAL_CONVERTED`, y acá están los otros 4 abiertos.**

| vertical | ¿pasa el paso 5? | veredicto |
|---|---|---|
| `A1` · `A2` · `A3` | **no**: el sujeto no tiene ninguna fuente viva, y la operación que lo dispara es la que crearía la primera | **ABIERTO** (3) |
| `A4` turista | **no**, ídem | **ABIERTO** |
| `A5` partner | inalcanzable | **CERRADO-VACÍO** |

**`T5` no está abierto porque billing no exista.** Que `T2` y `T5` no conviertan hoy está declarado
a propósito en `11-particion…` §3.2 y no es un hallazgo. Lo que está abierto es otra cosa: **el día
que billing exista, `T5` va a seguir sin poder dispararse**, porque el paso 5 le exige al sujeto el
título que la operación viene a crear. Es `F-8A2-001` con la suscripción en lugar del trial.

### 4.3 El recuento

| bloque | casos | cerrados | abiertos |
|---|---|---|---|
| `(vertical, PRE_TRIAL)` | 5 | 5 | 0 |
| `(vertical, TRIAL_ACTIVE)` | 5 | 5 | 0 |
| `(vertical, TRIAL_CONVERTED)` | 5 | 5 | 0 |
| `(vertical, TRIAL_EXPIRED)` | 5 | 1 | **4** |
| `(vertical, T1)` | 5 | 5 | 0 |
| `(vertical, T2)` | 5 | 5 | 0 |
| `(vertical, T3)` | 5 | 5 | 0 |
| `(vertical, T4)` | 5 | 5 | 0 |
| `(vertical, T5)` | 5 | 1 | **4** |
| **total** | **45** | **37** | **8** |

**Los 8 probados fallando por la FASE 8 cierran los 8.** De los 37 que nadie había mirado, **29
cierran y 8 quedan abiertos** — y los 8 son **un solo hueco visto desde dos ejes**: la columna
`TRIAL_EXPIRED` y la fila `T5` son la misma persona, que no puede operar **ni** suscribirse.

Y el recorrido dejó **dos hallazgos que ningún informe de FASE 8 tenía**: el hueco de
`TRIAL_EXPIRED`/`T5` (8 casos) y la ausencia de regla para los pasos 5 a 7 cuando el actor es el
reloj (`T3`, 4 casos, resuelto acá). Los dos salieron de los 37 sin mirar, que es exactamente lo
que `DEC-METH-004` compró al exigir el dominio entero en vez del caso que motivó la regla.

---

## 5. Por qué esto NO es un fail-open

La acusación es legítima y hay que contestarla de frente: **el paso 5 pasa a contestar que sí a
alguien que no tiene nada.** Seis defensas, y la sexta es la que admite el riesgo que esto sí crea.

**1 · El paso 5 nunca fue el que otorga.** `V/17` §1.2 separa los mensajes de falla: el 5 contesta
*«sin cobertura»* y el 6 *«sin la capacidad»*. Lo que el arreglo hace es **devolverle al 6 una
decisión que el 5 estaba tomando de prestado**, no sacar un control. Los nueve pasos se siguen
ejecutando, en orden, en un solo lugar, para toda operación de dominio — el §1.3 queda intacto.

**2 · Ninguna operación queda exenta, por ruta ni por superficie.** `PB1` recorre los nueve pasos.
`Empezar` también. No hay marca de «ruta pública», no hay clase «operaciones que crean cobertura»
evaluadas sin el paso 5, y no hay un servicio que resuelva su autorización por su cuenta. Es la
salida que `F-8A1-002` anticipó como *«peor que el problema»* y **no se toma**.

**3 · Lo que `PRE_TRIAL` otorga es dato del catálogo, no una rama del código.** Un conjunto
efectivo vive en `plan_version_entitlement` y `plan_version_limit`, y el catálogo ya se verifica
contra el código en las dos direcciones (`V/02` §1.2). Una exención por ruta habría vivido en el
código, invisible para el catálogo, que es exactamente la diferencia entre las dos salidas.

**4 · Lo único no-borrador que `PRE_TRIAL` otorga se consume al usarse.** La capacidad de
activación se ejerce una sola vez: la misma transacción que la autoriza dispara `T1`
(`NUCLEO/03` §1, regla 3), y `T1` saca a la persona de `PRE_TRIAL` para siempre, porque ninguna
transición vuelve (`V/03` §2). **No existe un estado en el que esa capacidad se use sin consumir
el trial.**

**5 · Falla cerrado por vertical, sin condiciones especiales en el motor.** Una vertical sin evento
declarado o con días de trial en cero no lleva la capacidad en su versión de pre-trial, y su gente
cae en el paso 6. Es `DEC-TRIAL-006` implicación 1 —*«falla cerrado en vez de abierto»*— convertida
en una fila de catálogo. Y el default del contrato (`12-contrato…` §6.1, *«una fuente no
implementada responde que no»*) no se toca: las otras tres fuentes siguen contestando que no.

**6 · El riesgo que esto SÍ crea, dicho en voz alta.** El arreglo concentra todo en un solo dato:
**si alguien siembra la versión de pre-trial de una vertical con una clave comercial, toda la
plataforma la recibe gratis, para siempre, sin consumir ningún trial.** Es un punto único de falla
que hoy no existe, y por eso el §2 le pone un guard propio (`G-R3`) en vez de una convención. La
comparación honesta no es *«¿esto abre algo?»* sino *«¿abre más o menos que la alternativa?»*: la
exención por ruta abre un agujero **por cada ruta que alguien marque**, y ninguna herramienta lo
cuenta; ésta abre uno solo, en una tabla, que un guard puede contar en cada PR.

**Y una cosa que este documento NO defiende.** Los 8 casos abiertos del §4 **sí** empujan hacia un
fail-open si se resuelven mal: la salida barata para `TRIAL_EXPIRED` es marcar como exentas las
rutas de «Mi Cuenta» y de contratación, que es la misma trampa de `F-8A1-005`. El §6 ítem 1
enumera las salidas caras precisamente para que la barata quede escrita como descartada.

---

## 6. Lo que R3 NO puede cerrar, y qué requiere decisión del owner

**1 · El título de quien ya gastó su trial — 8 de los 45 casos.**
Un `TRIAL_EXPIRED` no tiene fuente viva, así que el paso 5 le niega **la operación de suscribirse**,
que es la única forma de volver. Rompe la *«recuperación posible»* del §21, citada en
`NUCLEO/01` §2.1 para los dos `SUSPENDED`. Tres salidas:

| # | salida | costo | riesgo |
|---|---|---|---|
| a | un **quinto tipo de título** en el contrato, para `Turista Free`, `Guest` y `TRIAL_EXPIRED` | toca la frontera, que **ninguna épica muta sola** (`DEC-ARCH-006`): hay que coordinar con R2 | bajo, y es **la única que también cierra `F-8A1-005`** |
| b | una clase declarada de **operaciones que abren título**: su paso 5 se contesta con la condición de creación, no con la existencia | un párrafo en `V/17` §3 y una lista cerrada | **medio**: la clase puede crecer, y cada miembro es una operación menos verificada |
| c | `TRIAL_EXPIRED` apunta a una versión de **piso de sólo lectura** | simétrico con R3-C, sin tocar la frontera | **alto**: `cubierto` sería verdadero para siempre y `12-contrato…` §5.1 pide que *«un trial vence de verdad»*. **Se desaconseja** |

**Decide el owner.** R3 no la toma porque (a) toca la frontera que `DEC-ARCH-006` protege y (b)
crea una clase de operaciones que este mismo documento acaba de argumentar que hay que mantener
chica.

**2 · La segunda clase de actor: el reloj.**
El §4.2 la resuelve por analogía con las doce acciones administrativas, y es la lectura que menos
inventa — pero **declara una clase nueva en `V/17` §3**, y el propio capítulo dice que *«a qué
clase pertenece una operación se declara, nunca se infiere»*. Costo: un párrafo y la enumeración
transición por transición. Riesgo: bajo mientras la propiedad *«una transición de esta clase nunca
otorga»* se verifique; medio si nadie la verifica. **Pide ratificación, no decisión de fondo.**

**3 · `F-8A2-010` deja de ser inalcanzable el día que esto se aplique.**
Hoy nadie puede disparar `T1`, así que el segundo trial por re-registro es teórico. Después de R3
deja de serlo: un `user_id` nuevo con el mismo correo entra en `PRE_TRIAL` y **publica**. El
hallazgo ya tiene su arreglo escrito —una restricción de unicidad propia para el hash del correo
normalizado— y es `ALTA`, fuera de R3. **R3 no se puede aplicar sin él.** Costo: una restricción.
Riesgo si se olvida: el §10.2 queda incumplido por la puerta exacta que `DEC-TRIAL-004` y el hash
construyeron para tapar.

**4 · `hasta: sin fecha` gana un segundo significado, y el documento es de la frontera.**
`12-contrato-de-cobertura.md` §2.1 define `hasta` como *«la fecha hasta la que cubre, o **sin
fecha** para un grant permanente»*. Con R3-A, la fuente de trial en `PRE_TRIAL` también devuelve
*sin fecha*, y el campo pasa a significar dos cosas distintas. **R3 no lo edita**: el documento es
de la frontera y `DEC-ARCH-006` dice que ninguna épica lo muta sola. Es adyacente a R2 —que está
resolviendo el mismo documento por el lado de `grant` y `addon`— y hay que coordinarlo ahí.
Costo: una fila. Riesgo: bajo, pero **es un cruce de frontera y corresponde mirarlo, no resolverlo
en el lugar** (`12-contrato…` §4, regla de vigilancia).

**Y lo que R3 NO le agrega al contrato, que le importa a R2.** `PRE_TRIAL` **no es un `tipo` nuevo**:
la fuente sigue siendo `tipo: TRIAL` y lo único que cambia es a qué `versiónDePlan` apunta. De las
tres salidas que `F-8A1-002` enumeró, la elegida es la que **no** toca el enum de `tipo` — así que
el contrato no gana un quinto ni un sexto valor por culpa de R3.

**5 · La capacidad de activación no tiene dónde vivir, todavía.**
R3-C la ata a que *«la vertical declara evento de activación»*, y `F-8A3-006` (`ALTA`) midió que ese
valor **no tiene columna en ninguna entidad**: `vertical` es *«el espejo en base del enum»* y
`plan_version` guarda seis columnas que no lo incluyen. R3 **depende** de que esa columna exista.
Costo: una columna o una tabla de configuración por vertical. Riesgo si se olvida: la regla del «si
y sólo si» queda sin lado izquierdo y el guard `G-R3` no la puede verificar.

**6 · El conjunto de operaciones de dominio sigue sin enumerar.**
Es el límite que `00-dominios-de-los-racimos.md` declara en su sección final, y R3 lo hereda: el
dominio se cerró **por vertical y por estado**, no por operación. El §4.1 usó un criterio para
decidir que las lecturas de «Mi Cuenta» no pasan por el paso 5 —escribe estado y es auditable— y
**ese criterio no está escrito en ningún capítulo**: se infirió de cómo `F-8A2-001` clasifica a
`PB1`. Costo de cerrarlo: escribir la definición y enumerar. Riesgo de no cerrarlo: nadie puede
afirmar que revisó todas, que es textualmente lo que el documento de dominios advierte.

**7 · Los entitlements de la versión de pre-trial se guardan, y los del trial se derivan.**
`V/02` §2.1 dice del plan de trial que *«sus limits y entitlements **no se guardan**: se derivan»*,
y R3-C hace lo contrario con el de pre-trial, porque no hay de dónde derivar un conjunto que no es
ni el del premium ni el del más bajo. Es una asimetría deliberada entre dos planes no vendibles de
la misma vertical y **conviene que el owner la ratifique**, porque es el tipo de diferencia que
alguien unifica después sin entender para qué estaba. Costo: una siembra por vertical. Riesgo:
bajo, y acotado por `G-R3`.

---

## Lo que este documento NO decide

- **No resuelve R2.** El paso 6 —*qué otorga el título*— es de R2, y esta resolución **depende** de
  él en un punto: que la fuente de trial pueda transportar su `versiónDePlan`. Eso el contrato ya
  lo hace (`12-contrato…` §2.3); lo que R3 agrega es un segundo sentido para `hasta`, y eso se
  coordina, no se resuelve acá (§6, ítem 4).
- **No declara un hallazgo donde hay una decisión.** Que `T2` y `T5` no conviertan mientras no
  exista billing está declarado a propósito en `11-particion…` §3.2. Lo que R3 abre sobre `T5` es
  otra cosa, y está dicho en el §4.2.
- **No reabre `DEC-ARCH-004` a `007`**, ni `DEC-TRIAL-003` a `007`, ni `DEC-ENT-001`. La resolución
  se escribió **dentro** de las tres decisiones de trial que la tocan: el trial es configurable por
  plan, el disparador se declara por vertical, y `PRE_TRIAL` tiene borradores ilimitados sin
  capacidades comerciales.
- **No aplica nada.** Ni el decision log, ni la matriz, ni los capítulos, ni las sub-specs, ni los
  issues de Linear. El orden lo fija `DEC-METH-004`: las salidas 3 y 4 van al final, con el diseño
  ya firme.
- **No cierra los 8 casos abiertos declarándolos menores.** Son el camino de vuelta de toda la
  cartera que no convierta, y su arreglo barato es el fail-open que el §5 deja escrito como
  descartado.

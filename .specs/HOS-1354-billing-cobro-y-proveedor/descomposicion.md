---
title: Descomposición de la épica de billing
linear: HOS-1354
statusSource: linear
created: 2026-09-18
updated: 2026-09-21
status: CURRENT
---

# Descomposición de HOS-1354

> **Esto no es un plan de fechas ni el atomizado en tareas.** Es el corte en unidades de trabajo y
> el orden que sale de las dependencias del propio diseño. El atomizado de cada unidad se hace
> cuando esa unidad arranca, no ahora.
>
> **Y se hace entera, con la pasarela sin decidir.** Doce de los trece capítulos están escritos, así
> que el reparto no espera a nada. **Lo que sí espera es la construcción**: ver §2.3.
>
> ---
>
> ### ⛔ Antes de empezar a construir: falta decidir la pasarela
>
> **De las trece unidades, nueve llaman a la pasarela**, y ninguna de esas nueve se puede terminar
> sin saber cuál es. La única que se puede hacer **entera** hoy es **B2 (el precio)**; de **B1** se
> puede escribir la interfaz y su guard, no el adaptador real.
>
> No es una demora administrativa: `DEC-ARCH-004` puso el ciclo de vida de nuestro lado, y **cuál
> pasarela sea decide la forma de casi todo el sistema de billing** — si el reloj de cobro es
> nuestro o suyo, si la pausa es nativa, si un addon es una autorización aparte o una línea, si la
> conciliación puede listar o tiene que leer de a una.
>
> Lo que **sí** se puede hacer hoy, y conviene hacer: **atomizar y especificar** las doce unidades
> cuyo diseño está escrito. Su política no cambia con la respuesta.
>
> **Qué la destraba**: los dos textos de la PRUEBA 0 y el mail de habilitación de Mobbex — los dos
> están en manos del owner ([`spec.md`](./spec.md) §7).

## 1. El criterio de corte

**Se corta por lo que sobrevive a la respuesta del capítulo 13**, no por capa técnica ni por
capítulo.

Cortar **por capa** tiene el problema conocido: nada funciona hasta el final, y el primer error de
modelado se descubre con tres capas encima. Cortar **por capítulo** es peor acá que en la otra
épica, porque los tres capítulos transversales —el `02`, el `03` y el `05`— no tienen materia
propia: se reparten entre cinco, seis y cuatro unidades respectivamente.

### 1.1 La restricción que la otra épica no tenía

**Doce de los trece capítulos se escribieron con la forma de Mercado Pago puesta** —el
`preapproval`, su checkout, su pausa nativa—, y `DEC-ARCH-004` llegó **al día siguiente** de casi
todos ellos: los capítulos son del 2026-09-17, la decisión del 18. Lo que esa decisión dice sobre
lo ya escrito está en su implicación 3: *«las 20 decisiones acopladas se revisan, no se
reescriben. En cada una la política sobrevive y lo que se revisa es la forma»*.

**Entonces el corte no puede seguir el mecanismo: tiene que seguir la política.** Una unidad
definida como *«crear el preapproval y mandar al checkout»* **deja de existir** si el 13 contesta
que el cargo puntual contra tarjeta guardada es el modelo canónico. Una definida como *«que exista
un compromiso de cobro vivo, con la ventana en que todavía no lo es»* sobrevive a las dos
respuestas, y lo que cambia adentro es qué se hace en esa ventana.

Las trece unidades de abajo están enunciadas así a propósito. Si el 13 contesta lo contrario de lo
que hoy hace Mercado Pago, **el reparto no se redibuja** — se revisa el interior de las que hablan
con la pasarela, que son nueve. **Que el corte aguante no quiere decir que la construcción pueda
empezar**: son dos cosas distintas, y el §2.3 las separa.

### 1.2 La cadena que ordena

Cada eslabón deja **una pregunta contestada**:

```text
¿cómo se le habla a una pasarela, y cómo miente?   → B1
¿cuánto cuesta?                                     → B2
¿hay un compromiso de cobro vivo?                   → B3
¿esta persona está cubierta?                        → B4
¿qué dinero se movió?                               → B5
¿cómo se mueve el dinero?                           → B6   ← la única bloqueada
¿qué pasa cuando no entra?                          → B7
¿qué pasa cuando el cliente cambia de idea?         → B8
```

Las cinco últimas —concesiones, addons, conciliación, el catálogo que se retira y superficies— no
están en la cadena porque **no la condicionan**: se apoyan en ella.

### 1.3 Tres reglas que valen para las trece

1. **Cada guard va con la pieza que protege, nunca al final.** Un guard que llega después se
   escribe contra código ya escrito, y para entonces hay call sites que lo violan: nace con una
   lista de excepciones, que es exactamente cómo un guard deja de servir. Y cada uno **lleva su
   caso que lo hace fallar a propósito** — un guard que no puede fallar es un comentario con exit
   code 0.
2. **Ninguna unidad le cree a un código de estado.** Toda mutación se verifica releyendo y
   comparando **campo por campo cada campo que se mandó**, y ninguna aserción de test se escribe
   sobre un `2xx`. No es criterio: está medido nueve veces que este proveedor **acepta y
   descarta**, y que un `PUT` con varios campos se aplica a medias con un solo `200` (`EX-20`).
3. **Lo que toca plata no se ejecuta solo.** Toda divergencia de monto, estado o cobro **abre una
   marca `requiere_conciliación`, con su MOTIVO** (`02` §2.5), y la mira una persona. Es el criterio
   del owner —*«toca plata o no toca plata»*— aplicado adentro de la épica que toca plata entera.
   **El motivo es parte de la regla**: el corpus escribe catorce marcas distintas sobre la misma
   casilla y **cinco** dicen *«hay plata del cliente que devolver»*; sin el motivo todas llegaban
   iguales a la bandeja y las que se perdían eran ésas.

---

## 2. Las trece unidades

La columna **⛔** marca las que **llaman a la pasarela**: no se pueden terminar sin saber cuál es.

| # | unidad | ⛔ | qué deja funcionando | capítulos | guards |
|---|---|---|---|---|---|
| **B1** | **El adaptador y el proveedor que miente** | ⛔ | las ocho capacidades como interfaz definida por lo que el dominio necesita, el adaptador falso que reproduce las mentiras medidas, y la regla de releer toda mutación | `06` entero · `20` §2–§3, §6 | `G9` `G10` `G11` `G12` |
| **B2** | **El precio** | ✅ | `billing_option`: el ciclo y su monto, en entero, colgando de la versión de plan y no del plan | `02` §2.1 · `06` §5 | `G7` |
| **B3** | **El alta y su ventana** | ⛔ | hay un compromiso de cobro vivo, y la ventana en que todavía no lo es vence, limpia y no se duplica | `03` §3.1–§3.4, §10 · `05` §1, C6 · `02` §2.2 **y §2.5** · **`01` §2.4, §2.5 y §2.6 (núcleo)** | **`G-R1-A`** **`G-R1-B`** **`G-R1-E`** **`G-R1-F`** |
| **B4** | **El contrato de cobertura, de verdad** | — | `cobertura()` responde con una fuente de billing viva, y el aviso de que cambió sale | [contrato](../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md) §5.2, §6 | `G13` |
| **B5** | **El registro del dinero** | — | qué se cobró, qué se reembolsó y qué se registró a mano, sin que un hecho se aplique dos veces ni un período admita dos pagos | `02` §2.3 · `03` §6, §7, §10.2 · `05` C5 | — |
| **B6** | **Ejecutar el cobro y el reembolso** 🔒 | ⛔ | **BLOQUEADA, y es la única sin diseño** — es el capítulo 13, el único de los 22 sin escribir | `13` *(sin escribir)* | — |
| **B7** | **La mora** | ⛔ | un cobro que no entra abre un reloj que se cierra, el que nunca pagó no recibe diez días gratis, y **el pago que entra en plena sucesión no reactiva, no se pierde y tiene quién lo resuelva** | `03` §4, S4–S7, **S19** · `12` §1, §4, §5 · `05` §3 | **`G-R1-D`** |
| **B8** | **Los cambios del compromiso** | ⛔ | cambiar de plan, de ciclo, pausar y darse de baja, cada uno por su camino y sin pisarse — **incluido el CIERRE de la sucesión con sus cinco escrituras**, y **con la dirección del cambio saliendo de `direcciónDeCambio` (contrato §4.1) y nunca del `rank`** | `03` §5, S8–S12, **S17–S18** · `12` §2, §3, §6, §7 · `02` §2.6 · `05` C2, C4 | **`G-R1-C`** **`G-R5`** |
| **B9** | **Las concesiones** | ⛔ | promos, cortesías y grants componen de forma determinista y se enchufan como fuentes. **`S20` no es de acá**: el grant cancela la principal (`S13`) y el complemento lo apaga **B10**, que llega después en el camino crítico y es donde vive el modelo del addon | `14` entero · `03` S9, S13 · `02` §2.4 · `05` C3 | — |
| **B10** | **Addons** | ⛔ | los dos ejes, qué es una suscripción válida, el addon a costo cero —**el que se elige gratis y el que ya se venía pagando y `S20` convierte**— y el huérfano que sigue cobrando —**con su cobro apagado por `S21`**— | `16` entero · `03` §8 **y `S20` y `S21` de §3.2** · `02` §2.4 · `09` §3 *(tercera y cuarta comprobación, y las salvedades 1 y 4)* · `19` §4 filas 13 y 13-bis | — |
| **B11** | **Conciliación** | ⛔ | lo que creemos coincide con lo que hay, y lo que diverge en silencio aparece | `09` entero | — |
| **B12** | **El catálogo que se retira** | ⛔ | retirar un plan no mueve a nadie, y discontinuar una vertical deja de cobrar antes de dejar de prestar — **incluidas las TRES transiciones que ejecutan el acto**, `S26`, `S27` y `S28` | `10` entero · `03` §3.2, **S26–S28** | — |
| **B13** | **Superficies y la baja** | — | la pricing, Mi Suscripción, la baja self-service, y la lista de lo que hay que decir | `19` entero · `22` §1 | — |

**⛔ nueve · — tres · ✅ una.** Las tres del guion —B4, B5 y B13— no llaman a la pasarela, pero
**dependen de una que sí**, así que tampoco arrancan antes. La única sin ninguna atadura con la
pasarela, ni propia ni heredada, es **B2**: su gate es `V2`, de la otra épica.

### 2.1 Los dos guards que nacieron acá y ya están en el catálogo

Se numeraron en esta descomposición **porque el `20` §2 no los nombraba**, y ahí quedó escrito
*«si el `20` se reescribe, los absorbe»*. **Los absorbió**: desde la FASE 9-bis-4 las dos filas
están en `20` §2 (`DEC-TEST-001`, *«y el catálogo estaba incompleto»*), así que **ya no viven
fuera del catálogo que CI leería**. La tabla queda acá porque **es esta tabla la que les asigna
unidad** —`G12` a `B1`, `G13` a `B4`— y el catálogo cataloga, no reparte trabajo:

| # | qué falla si se rompe | de dónde sale |
|---|---|---|
| **`G12`** | se importa el SDK de la pasarela **fuera del adaptador** | `DEC-ARCH-004`, condición A |
| **`G13`** | la implementación **de arranque** de `cobertura()` llega a producción | contrato §6.3 |

### 2.2 Por qué el adaptador y el proveedor falso son la misma unidad, y van primeros

Porque son las **dos condiciones de `DEC-ARCH-004`** y ninguna de las dos se puede agregar después.

`G12` es el caso de libro de la regla 1: si llega en B5, para entonces hay cuatro unidades que
importan el SDK y el guard nace con su lista de excepciones. Y el adaptador falso es la **condición
B**, que la decisión justifica sin rodeos: *«es lo que prueba que la abstracción no miente — si no
se puede escribir sin filtrar conceptos de Mercado Pago, la interfaz está mal definida»*.

**Y el falso tiene que mentir desde el primer día**, no cuando se acuerde alguien. Un falso escrito
más tarde se escribe contra código que ya asumió un proveedor que se porta bien, y ese código
—medido— no es el que tenemos.

### 2.3 Qué se puede hacer ya, y qué espera a la pasarela

Se venían diciendo como una sola cosa **dos que no lo son**, y conviene separarlas porque llevan a
decisiones opuestas:

| | cuántas | qué significa |
|---|---|---|
| **sin diseño** | **1** — B6 | su capítulo no está escrito y **su política no está decidida**. No se puede ni especificar |
| **con diseño, esperando la pasarela** | **11** | su política está escrita y no cambia. **Se pueden atomizar y especificar hoy**; no se pueden terminar |
| **se puede hacer entera hoy** | **1** — B2 | no llama a la pasarela ni depende de ninguna que llame |

**Doce de trece tienen el diseño escrito. Doce de trece no se pueden construir todavía.** Las dos
frases son ciertas a la vez, y confundirlas es lo que hace que alguien lea *«una sola bloqueada»*
como *«se puede arrancar»*.

#### Por qué el alcance es tan ancho

Porque `DEC-ARCH-004` trajo el ciclo de vida de nuestro lado, y eso **no reduce** la dependencia de
la pasarela: la concentra. **Cuál sea decide la forma de casi todo el sistema**, y cada línea de
abajo es una decisión ya tomada que se escribió sobre una medición de Mercado Pago:

| lo que la pasarela decide | hoy, con Mercado Pago | unidades |
|---|---|---|
| **quién tiene el reloj de cobro** | suyo — el mandato cobra solo | B6, B7 |
| **si la pausa es nativa** | sí, y el reloj que reanuda es nuestro porque no hay auto-reanudación | B8, B9 |
| **si un addon es una autorización aparte o una línea** | aparte: el array de ítems da `400` y se descarta en silencio | B10 |
| **si se puede mutar el ciclo de una suscripción viva** | no — hay que cancelar y recrear | B8 |
| **si el inventario se puede listar** | no: el buscador devuelve un subconjunto plausible, 15 de 69 | B11 |
| **qué miente el falso** | las **quince** filas del `20` §3.2, todas suyas | B1 |
| **el piso y la moneda** | ARS 15 a 2.000.000, y sólo ARS | B2, B9 |

`DEC-ARCH-004` ya lo dijo, y es la parte que no conviene leer como consuelo: **«las pasarelas no
son intercambiables»**, y para cada capacidad hay que declarar qué pasa cuando el proveedor no la
tiene. Eso no se puede declarar contra un proveedor que no está elegido.

#### Política y forma, unidad por unidad

Lo que **no** cambia con la respuesta —y por eso la especificación se puede escribir hoy:

| | política, que sobrevive a las dos respuestas | forma, que espera |
|---|---|---|
| **B3** | hay una ventana entre *«empezamos»* y *«hay compromiso»*, tiene duración máxima, se limpia y el candado es nuestro y va antes | qué vive adentro: un checkout para autorizar un mandato, o la captura de una tarjeta |
| **B7** | el reloj del grace arranca cuando **se agotan** los reintentos, y eso se observa releyendo, nunca contando días | de quién son esos reintentos — y si son nuestros, **son terreno regulado** |
| **B8** | cambiar de ciclo re-autoriza; la pausa es en meses enteros y el reloj que reanuda es nuestro | si hace falta cancelar y recrear — `DEC-ARCH-004` impl. 3: *«si se puede mutar el ciclo de una suscripción viva, `DEC-SUB-006` deja de necesitar el cancelar-y-recrear»* |
| **B9** | el orden de aplicación, el piso, y que un 100 % es una cortesía | si la cortesía se implementa pausando o simplemente no cobrando el ciclo |
| **B10** | los dos ejes, qué es una suscripción válida, el huérfano | si el huérfano recurrente **existe** — con un cargo puntual no hay autorización suelta que siga cobrando |
| **B11** | el inventario es nuestro y lo que toca plata lo mira una persona | si hace falta leer de a una por id |
| **B12** | se deja de cobrar antes de dejar de prestar | cómo se corta el cobro el día 0 |

**B6 no entra en esa tabla porque no tiene la columna izquierda todavía**: dos relojes sobre la
misma autorización **son** el doble cobro que `DEC-ARCH-004` declara como riesgo nuestro, y eso no
se esconde detrás de una interfaz.

#### Lo que sí conviene hacer mientras tanto

1. **Atomizar las once que tienen diseño** (todas menos B6 y B2). Su política no cambia, así que el
   atomizado no se tira.
2. **Construir B2 entera** — `billing_option`, el dinero en entero y `G7`. Su único gate es `V2`.
3. **Escribir la interfaz del adaptador y `G12`.** `DEC-ARCH-004` define esa API **por lo que
   Hospeda necesita, no por lo que una pasarela ofrece**, así que se puede escribir sin saber cuál
   es. Lo que no se puede escribir es el adaptador real ni las mentiras del falso.

**Y lo que no conviene**: escribir el adaptador contra Mercado Pago «para ir avanzando». Es
exactamente el error que `DEC-ARCH-004` fue a corregir — la alternativa (3) que descartó, *«acoplarse
a la pasarela elegida y aceptar que cambiarla sea una reescritura»*, es la que **nos trajo hasta
acá**.

### 2.4 Por qué registrar el dinero y ejecutarlo son dos unidades

Es lo que permite que el bloqueo alcance a una sola.

**Registrar** es qué pasó: la máquina de Pago, la deduplicación por el id del hecho, el orden por la
fecha del hecho, la restricción que impide dos pagos acreditados en un período, el comprobante. Un
pago es un hecho con id y fecha **lo haya ejecutado el proveedor o lo hayamos ejecutado nosotros**,
así que todo eso se escribe hoy.

**Ejecutar** es cómo se mueve: el cargo, el reembolso y cómo se constata un pago manual. Eso es el
13, y arrastra `RF-3` en `UNKNOWN` — el §61 prohíbe implementar sobre una fila abierta.

Sin esta división, **B7 heredaría la falta de diseño** y serían cuatro los capítulos que hay que
escribir en vez de uno. Ojo con lo que esto **no** compra: B5 y B7 siguen esperando a la pasarela
como el resto (§2.3). Lo que la división separa es **poder especificar** de **poder construir**.

### 2.5 Por qué el contrato de cobertura no va al final

Porque es lo que la otra épica está esperando, y porque la defensa §6.2 del contrato —*«un solo
juego de casos corre contra las dos implementaciones»*— sólo vale si la segunda llega **mientras el
juego todavía corre contra la primera**. Un contrato que se implementa al final convierte
*«billing reemplaza la implementación de arranque»* en un día de sorpresas, que es exactamente lo
que esa defensa existe para evitar.

Le alcanza con B3: **una suscripción viva ya es una fuente**. Las otras dos —cortesía y grant— se
enchufan en B9 **sin tocar** lo que B4 dejó, y ésa es su prueba.

**Y acá nace `G13`**, no antes: mientras la de arranque es la única implementación, un guard que
prohíba su llegada a producción falla desde el primer día. Es la misma razón por la que `G1` y `G3`
van primeros en la otra épica, leída al revés.

### 2.6 Las dependencias con la otra épica: son SEIS, sobre dos unidades, y todas tempranas

**B2 no puede existir sin `plan_version`**, que es `V2` de verticales: `billing_option` cuelga de
ella con `UNIQUE(plan_version_id, ciclo)`. Es el corte de `DEC-ARCH-005` visto desde abajo — el
precio vive en **una sola tabla hoja** y todo lo que está encima es configuración de capacidades.

**No contradice la autonomía.** `V2` es la **segunda** unidad de la otra épica, y lo que B2 necesita
es esa unidad mergeada en la rama del paraguas, no la épica terminada. La segunda dependencia es la
de B4 sobre `V4`, que trae el contrato con su implementación de arranque.

**Este § decía *«esas dos, y ninguna más»* y eran seis.** La frase se escribió el **2026-09-18**;
la **dirección inversa del contrato** —lo que billing **LEE** de verticales— se declaró en
`12-contrato…` §4.1 el **2026-09-19**, *al día siguiente*, con **siete campos en tres preguntas**,
y en cuatro días nadie cruzó los dos documentos. Las **cuatro** dependencias que ese § agrega son
todas contra `V2`, que es la unidad que las construye (`V/descomposicion.md` §2.9), y cada una está
medida contra el lector que la pide:

| # | quién lee | qué campo de la dirección inversa | contra |
|---|---|---|---|
| 1 | **B2** — `billing_option` cuelga de `plan_version` | *(no es la dirección inversa: es la tabla misma)* | **V2** |
| 2 | **B4** — el contrato con su implementación de arranque | *(la dirección de ida)* | **V4** |
| 3 | **B7** — el reloj del grace | `díasDeGrace`: *«el §20 fija el grace en 10 días y `DEC-SUB-002` lo dejó configurable **por versión de plan**»* (`12` §1) | **V2** |
| 4 | **B8** — la pausa | `permitePausa`: es el tercer término de `puedePausar()` (`NUCLEO/01` §3), que `S8` exige | **V2** |
| 5 | **B8** — el cambio de plan | `direcciónDeCambio`: es lo que decide si el monto se muta ya o si las capacidades caen al fin del ciclo. Sin él lo único a mano es el `rank`, que el diseño ya rechazó por escrito | **V2** |
| 6 | **B12** — el retiro y la discontinuación | `admiteAltas` y `finDeServicio` (`B/10` §4.6, que ya las lee), y `vigente`/`vendible` | **V2** |

**Y el conteo se recontó entero, no se le sumaron cuatro a dos.** Se recorrieron los **siete**
campos del §4.1 uno por uno buscando su lector, y los que no aparecen en esta tabla es porque **hoy
ningún capítulo de esta épica los lee**: `díasDeTrial` lo consume la máquina de trial, que es de
`V4` y del otro lado de la frontera.

> **La regla de vigilancia sigue en pie y ahora cuenta contra algo vivo.** *«Si aparece una
> séptima»* sería volver a congelar una cifra, que es exactamente el defecto que este § tenía. La
> forma correcta es la del contrato §4.2: **si billing necesita leer de verticales algo que no está
> entre los siete campos del §4.1, el corte se está filtrando** — se mira, no se resuelve en el
> lugar. El número que hay que vigilar es el de los campos, que vive en el § que los declara; el de
> las dependencias es su consecuencia y se recuenta desde ahí.

**Y no mueve el grafo del §3.** Las cuatro nuevas son contra `V2`, que **ya era gate de B2** —la
unidad que arranca primero de esta épica— y es la **segunda** de nueve en la otra: las cuatro
llegan resueltas mucho antes que B7, B8 y B12, que están detrás de la pasarela. Lo que cambia no es
el orden: es que dejan de ser invisibles.

### 2.7 Dónde caen las ocho filas `UNKNOWN`

Las 89 filas de la matriz, recontadas con `contar-filas-de-la-matriz.py`: **49 `VERIFIED`, 19
`NOT_SUPPORTED`, 13 `PARTIALLY_SUPPORTED`, 8 `UNKNOWN`.**

| filas | unidad | qué bloquea de verdad |
|---|---|---|
| `RN-2` `RN-3` `GR-1` `GR-2` `GR-3` | **B7** | son **el mismo hecho, un cobro que falla**, e imposibles de fabricar con Mercado Pago. Y gobiernan el grace **sólo mientras el reloj sea del proveedor**: con el reloj nuestro pasan a ser una nota del adaptador |
| `WH-5` | **B1** | nada crítico — se fuerza con el interruptor del receptor |
| `RF-3` | **B6** | el caso viejo del reembolso. Ya está en la unidad bloqueada |
| `EX-1` | **B3** | nada: la ventana de autorización es nuestra justamente porque esta fila está abierta —y por eso `DEC-SUB-016` la pudo partir en **dos** plazos sin esperar respuesta del proveedor—, y cancelar al vencer **falla hacia el lado seguro sin saber la respuesta** |

**Ninguna de las ocho bloquea una unidad que no estuviera ya bloqueada.** El §61 prohíbe empezar
una capability crítica con su fila abierta, y la única que lo está es B6.

### 2.8 Los seis guards de esta épica que no tenían unidad, más el que llega de la otra

La columna de arriba dejaba **seis** guards de `B/20` §2 sin ninguna unidad que los construya —**los
seis de `R1`**— y `C2` lo venía reportando **tres vueltas seguidas** (`F-8dC2-003` →
`F-8eC2-004`). La **quinta enmienda de `DEC-TEST-001`** decide repartirlos ahora, con tres
condiciones: **la razón va medida y con cita**, **la unidad nace ANTES o CON lo que el guard
vigila, nunca después**, y **lo que no tiene unidad clara se declara sin dueño**. Los seis tienen
unidad medida; lo que el §2.9 trataba aparte eran **dos** secciones sin capítulo, no asignaciones
faltantes, y **las dos quedaron resueltas ahí**.

| guard | unidad | qué construye esa unidad que hace que el guard pueda existir ahí |
|---|---|---|
| **`G-R1-A`** | **B3** | **el acto que escribe `sucede_a`** —la rama de sucesión de `S1`— y los dos candados del `02` §2.2 |
| **`G-R1-B`** | **B3** | **la ventana de autorización** y la columna con la fecha con que nace la fila |
| **`G-R1-E`** | **B3** | **la columna `sucede_a`** y la doctrina de que *«viva»* es parte del predicado |
| **`G-R1-F`** | **B3** | **la entidad `reconciliation_mark`** con su motivo, y `S14`/`S15` |
| **`G-R1-D`** | **B7** | **`S19`**, el pago pendiente — sin él el guard no tiene dominio |
| **`G-R1-C`** | **B8** | **`S18`** con sus cinco escrituras, y el inventario del `02` §2.6 contra el que se verifica |
| **`G-R5`** | **B8** | **el tope de la pausa** (`03` §5), que es el número que puede romperlo |

**Cuatro de los seis caen en B3, y no por comodidad: caen en `02` §2.2.** Ese § es la tabla que
crea `sucede_a`, `sucedida_por`, la fecha de primer cobro con la que nace la fila y la entidad
`reconciliation_mark`, y **es capítulo de B3**. Los cuatro guards que anclan ahí anclan en columnas,
no en caminos, y las columnas nacen todas en el mismo acto.

**`G-R1-A` va con B3 porque vigila un acto, y el acto es `S1`.** Su fila lo dice sin ambigüedad:
*«vigila el ACTO de declarar, no una propiedad permanente de la fila»* (`B/20` §2), y el acto es la
segunda rama de la condición de `S1` —*«no hay otro origen vivo para ese `user + vertical`, **o la
fila declara una sucesión** (`sucede_a`)»*— que vive en `03` §3.2, adentro del `03` §3.1–§3.4 de
B3. B3 es la **tercera** unidad del §3, así que las **ocho** transiciones que después sacan a una
predecesora del conjunto de tres —`S8` y `S9`, `S6`, `S12`, `S13`, `S16`, el espejo del §10.1 y
`S24`— llegan repartidas entre B7, B8 y B9, todas **después**.

**`G-R1-B` va con B3 porque depende de una columna de B3 y compara contra la ventana de B3.** El
catálogo lo dice: es *«`D8` hecho verificable en vez de recordable, y por eso **depende de la
columna** que guarda la fecha con la que nació la fila (`02` §2.2)»*. Y lo que compara esa fecha
contra el **vencimiento de la ventana de autorización** — que es literalmente el nombre de la
unidad: B3 es *«El alta y su ventana»*. La escritura que vigila es el efecto de `S1` (*«si declara
sucesión, nace con fecha de primer cobro posterior al vencimiento de su ventana de autorización»*),
también de B3. No hay ningún momento anterior en que el guard pueda existir, ni ninguno posterior
en que no llegue tarde.

**`G-R1-E` va con B3 porque está anclado en la columna, no en la palabra.** Su fila lo declara:
*«este guard se ancla en la **columna**, no en la palabra: todo predicado que mencione `sucede_a`
tiene que decir además en qué estado está quien lo escribió»*. `sucede_a` y `sucedida_por` nacen en
`02` §2.2 —B3—, y ahí mismo nace la doctrina que hace cumplir: *«el adjetivo «viva» es parte del
predicado y no un adorno»*. **Todos los predicados que cuenta llegan después**: `S19` con **B7**,
`S17` con **B8**, `S20`, `S21` y `A5` con **B10**, y los dos inventarios que su segunda mitad
sumó —*«grant vivo»* y *«ancla viva»*— con **B9** y **B10**. Naciendo en B3 los ve llegar uno por
uno, y cada uno tiene que traer su fila al inventario para pasar; naciendo con el último nace con
lista de excepciones. **Con una salvedad que hay que decir**: el caso que hoy lo hace fallar a
propósito —*«sacándole «viva» a la condición de `S19`»*— es de B7, así que **B3 tiene que traer el
suyo**, sobre los predicados que sí existen en su momento: los **dos índices parciales** del `02`
§2.2, que leen `estado ∈ {vivos}`, y la condición de `S1`.

**`G-R1-F` va con B3 porque la marca y sus dos actos son de B3, y eso ya está medido.** La entidad
`reconciliation_mark` está en `02` §2.2 —B3— con su *«**motivo** (enumeración cerrada, §2.5)»*, y
los dos actos que la abren y la levantan son `S14` y `S15`, que también son de B3: **la FASE
8-bis-4 lo midió y lo declaró suficiente** — *«la mitad *«`S14`–`S16` no caen en ningún rango
numérico»* sigue, y **no la reporto**: `B3` las toma por sección (`03` §3.1–§3.4) y eso alcanza»*
(`20-fase-8-bis-4/C2…`, veredicto de `F-8dC2-004`). Todo lo demás que el guard cuenta llega
después: los **siete** motivos que `S14` trae de los casos que lo disparan, el **listado
accionable** del `19` §6 (**B13**, la anteúltima del camino crítico) y los inventarios de *«marca
abierta»* y *«cortesía diferida»* (**B9**). **Y la tabla que el guard lee es capítulo de B3, desde
esta pasada.** El `02` §2.5 —los catorce motivos— **no figuraba en la columna de capítulos de
ninguna unidad** y era la primera de las dos preguntas del §2.9: `G-R1-F` compara contra esa
enumeración para decidir si un motivo existe, así que quien construyera el guard se encontraba con
una tabla que nadie había sembrado. **La fila faltaba en el reparto, no la respuesta**: el propio
§2.9 ya decía que *«la asignación a B3 no depende de la respuesta —la entidad y sus dos actos son
de B3 igual—, pero la tabla sí necesita dueño»*, y el dueño es el mismo que el de la entidad. El
§2.5 es **el catálogo de una columna que nace en el `02` §2.2**, y las dos únicas cosas que hay que
saber para sembrarlo —qué motivos hay y quién abre cada uno— salen de `S14` y `S15`, que son de
B3. **Con la parte que B3 no puede terminar sola, dicha**: siete de los catorce motivos los abren
actos de otras unidades —`S18` (B8), `S21` (B10) y las seis comprobaciones del `09` §3 (B12)—, así
que B3 siembra la tabla completa y **cada una de esas unidades trae su propia fila viva cuando
llega**, que es la misma forma con que `G-R1-E` recibe sus predicados.

**`G-R1-D` va con B7 porque antes de B7 no tiene dominio, y eso está escrito.** El guard vigila
**cuatro caminos que reactivan** —`S5`, `S7`, el efecto de `MP1` y el de `MP4`— más el reembolso
anticipado del pago que `S19` dejó pendiente. `S4`–`S7` y `S19` son de **B7** por nombre, igual que
`12` §5.3 y `05` §3, que son las otras dos fuentes de su fila. Los otros dos caminos, `MP1` y
`MP4`, viven en `03` §7 y son de **B5**, que corre antes — **y eso no lo manda a B5**, por la razón
que el propio catálogo ya tiene escrita: *«el tercer lugar sólo es real porque `S19` admite las dos
puertas del pago … Un guard cuyo dominio la tabla no puede satisfacer no está en rojo: **está
mirando a otro lado**»* (`B/20` §2). Antes de B7 no existe ni el pago pendiente ni la condición 3
del `05` §3 que decide entre reactivar y retener, así que los dos caminos de B5 **todavía no pueden
producir el daño**. B7 es la unidad más temprana en la que el guard puede fallar, que es el criterio
de la regla 1 leído entero.

**`G-R1-C` va con B8 porque el cierre es de B8, y también el inventario contra el que se verifica.**
Es *«el guard del CIERRE»*, y el cierre es `S18` con sus **cinco** escrituras: `S18` es de B8 por
nombre (*«`03` §5, S8–S12, **S17–S18**»*), y el inventario contra el que el guard comprueba
—*«el inventario contra el que se verifica es `B/02` §2.6»* (`B/20` §2)— **también es capítulo de
B8**. El criterio de terminación de B8 (§4) ya describe cuatro de las cinco escrituras, así que el
guard y su sujeto se escriben en el mismo acto. Y el **sexto camino** que ganó con `DEC-GRANT-010`
—`S25` difiriendo la cortesía con su `saldo_días`— llega **después**: el `saldo_días` cuelga del
`courtesy_grant` (`02` §2.4) y la re-emisión es `S9`, los dos de **B9**, la unidad siguiente del
camino crítico. Naciendo en B8 el guard **ve llegar** ese sexto camino en vez de heredarlo, que es
exactamente lo que su fila pide: *«un guard escrito sobre un camino no mira el segundo»*.

**`G-R5` llega de la otra épica, y llega acá porque el número que puede romperlo es de acá.**
`F-8eC2-004` midió que su única asignación —la celda de `V9` que decía *«el de `D16`»*— estaba en
la épica equivocada, y se confirma: el guard compara **el tope de una pausa**, que declara `03` §5
de esta épica (*«**4 pausas-mes** por pausa»*, y el mismo § dice *«Esa desigualdad es el invariante
`D16` y la vigila **`G-R5`, sobre el número que declara la fila de arriba**»*), contra **el día del
hard delete** del `V/02` §4.1. `V9` construye el segundo número, no el primero — y su fila del §3
la pone *«una vez que estén V4 y V6»*, o sea **antes de que el tope exista**, con lo cual el guard
nacía sin nada contra qué fallar. `03` §5 es capítulo de **B8**, así que B8 es la unidad más
temprana en la que las **dos** cifras existen y el guard puede dar rojo. La advertencia ya estaba
escrita en `B/20` §2 —*«si alguien sube el tope de pausa y el guard sólo vive en el catálogo de la
otra, el cambio se hace sin verlo»*— y esto la aplica al reparto del trabajo. Del lado de
verticales, el retiro de la celda está explicado en
[`V/descomposicion.md`](../HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md) §2.7.

### 2.9 Las dos secciones que ninguna unidad declaraba entre sus capítulos — las dos RESUELTAS

**Ninguna de las dos era un guard sin dueño**: eran secciones que **ninguna unidad declaraba entre
sus capítulos** y que los guards repartidos **leen**. Se anotaron como preguntas para el owner y
**no lo eran**: en las dos faltaba una fila en una tabla de reparto, no había dos políticas entre
las que elegir, y **la unidad se deduce del mismo criterio en los dos casos** — la que construye el
guard que lee la lista y el término que la lista enumera. Quedan resueltas acá, y se deja escrito
lo que las abrió para que nadie lo lea como una asignación inventada.

1. ~~**`02` §2.5 —la tabla de los motivos de la marca— no es capítulo de ninguna unidad.**~~
   **RESUELTA**: la tabla es capítulo de **B3**, y la fila del §2 lo dice (`02` §2.2 **y §2.5**).
   Lo medido que la abrió sigue siendo cierto —`02` §2.1 es de B2, §2.2 de B3, §2.3 de B5, §2.4 de
   B9 y B10, §2.6 de B8, **y §2.5 no aparecía**—, y lo que faltaba era **una fila en el reparto**,
   no una decisión entre dos políticas: el §2.5 es el catálogo de una columna que nace en el §2.2,
   y quien construye `G-R1-F` necesita esa tabla sembrada para que el guard compare contra algo. El
   razonamiento completo está arriba, en la fila de `G-R1-F`.
2. ~~**Los inventarios de `NUCLEO/01` §2.4, §2.5 y §2.6 tampoco lo son.**~~
   **RESUELTA**: los tres son capítulos de **B3**, y la fila del §2 lo dice (`01` §2.4, §2.5 y
   §2.6, núcleo). Lo medido que la abrió sigue siendo cierto y **llevaba dos vueltas reportado**
   —`F-8dC2-002` dice que cuatro capítulos del núcleo no son de ninguna unidad, y el veredicto de
   la FASE 8-bis-4 *«`nucleo/01` entró por `V9`»* es cierto **del §1.2**, los cuatro hechos de
   reinicio, y no de los inventarios del §2—. Lo que faltaba era **una fila en el reparto**, igual
   que en el punto 1, y el dueño se elige con el mismo criterio que allá: **la unidad que construye
   los guards que los leen y los términos que enumeran**.

   **Los dos guards que los cuentan son de B3**, y está escrito arriba: `G-R1-E` vigila los
   inventarios del §2.4 —*«fila viva»*, y desde su segunda mitad *«grant vivo»* y *«ancla viva»*—
   y `G-R1-F` los del §2.5 —*«marca abierta»*— y del §2.6 —*«cortesía diferida»*—. **Y el término
   más temprano de los tres nace en su capítulo**: las dos enumeraciones de *«fila viva»* son la
   de `02` §2.2 —los seis estados de la suscripción— y la de `03` §8, y `reconciliation_mark` con
   su columna anulable también es `02` §2.2. Quien construya los dos guards en B3 sin la tabla
   sembrada se encuentra con un guard que compara contra una enumeración vacía, que es exactamente
   el patrón del punto 1.

   **Lo que B3 no puede terminar solo, dicho igual que en el punto 1**: los inventarios enumeran
   **consumidores**, y la mayoría llega después —`S19` con B7, `S17` con B8, `S20`, `S21` y `A5`
   con B10, *«grant vivo»* y *«ancla viva»* con B9 y B10, y los **diez** de *«cortesía diferida»*
   repartidos entre B8, B9, B11 y B13—. **B3 siembra los tres inventarios y cada unidad trae su
   propia fila cuando llega**, que es literalmente la regla que los tres §§ ya declaran:
   *«quien escribe un consumidor nuevo agrega su fila acá en el mismo acto»*.

   **Y esto no muta el núcleo por una sola épica, que era la parte que costaba.**
   `DEC-ARCH-006` dice que ninguna de las dos lo puede mutar sola, y **los tres §§ son de billing
   por su propio contenido**: el inventario del §2.4 lo declara textualmente —*«Todos están del
   lado de billing y sobre filas de billing»*— y *«marca abierta»* y *«cortesía diferida»* son
   entidades de `B/02`. El único término del §2.4 que es de la frontera, *«fuente viva»*, **no
   tiene inventario que mantener**: se resuelve contra la respuesta del contrato en el momento. Y
   el precedente de que un § del núcleo sea capítulo de una unidad ya existe: el §1.2 es de `V9`.

---

## 3. El orden, y qué se puede hacer en paralelo

```text
B1 ──┐   ⛔ de acá para abajo, todo espera a que se decida la pasarela
     ├──► B3 ──┬──► B4
B2 ──┘   ✅    │
               └──► B5 ──┬──► B7 ──► B8 ──► B9 ──► B10 ──► B13 ──► B12
                         ├──► B11
                         └──► B6  ····  🔒 sin diseño: es el capítulo 13
```

| | |
|---|---|
| **camino crítico** | `B1 → B3 → B5 → B7 → B8 → B9 → B10 → B13 → B12` |
| **en paralelo** | **B2** con B1 (su gate es `V2`, no B1) · **B4** una vez que estén B3 y `V4` · **B11** una vez que esté B5 |
| **sin diseño** | **B6**, y **desde la FASE 9-bis-3 detiene la EJECUCIÓN de un desenlace de B7** — ver §3.1 |
| **lo único que arranca hoy** | **B2**, y la interfaz de B1. **El resto del grafo espera a la pasarela** (§2.3) |

**B5 es la bisagra**: hasta ahí se construye el compromiso, y de ahí en adelante todo lee el
registro del dinero — el grace mira pagos acreditados, la compensación de días mira pagos
acreditados, y la conciliación compara contra ellos. Es también donde la regla *«se cuenta sobre
pagos acreditados, nunca sobre fechas»* pasa a tener un lugar donde vivir: una sola implementación
que mire fechas rompe **el agujero del grace y la compensación de días a la vez**.

**B4 es el hito de integración**, no el final: es donde la frontera deja de ser una definición.

### 3.1 B6 dejó de ser una hoja suelta: la rama 1 del cierre de la sucesión aterriza ahí

**Hasta la FASE 9-bis-2, `B6` podía quedarse sola sin detener nada** porque el reembolso era un
camino excepcional del capítulo 13. Dejó de serlo: `B/12` §5.3 movió el disparador al **cierre de
la sucesión**, `S19` creó el pago retenido, y `DEC-RF-002` declaró el camino **normal** —*«va a
pasar seguido sobre el camino de recuperación que `DEC-SUB-003` diseñó para que no fuera un
muro»*—. Esa rama vive en **B7**, que está en el camino crítico, y su desenlace es un reembolso,
que es **B6**.

**El bloqueo alcanza a la ejecución, no al disparador, y la línea es exacta:**

| qué | de qué unidad es | ¿se puede construir hoy? |
|---|---|---|
| abrir la marca al cerrar la sucesión (`S18`, efecto 5) | **B7** | **sí** — es una escritura nuestra, no toca la pasarela |
| que la marca escale si nadie la mira (`B/09` §3, salvedades 2 y 3) | **B11** | **sí** |
| que el caso aparezca en el listado accionable con qué devolver (`NUCLEO/08` §4.3) | B13 y el núcleo | sí |
| **mover la plata de vuelta**, cuando el pago entró **por el proveedor** | **B6** 🔒 | **no**: el capítulo 13 no está escrito y arrastra `RF-3` en `UNKNOWN` |
| **mover la plata de vuelta**, cuando el pago entró **a mano** (`MP1`, `B/03` §7) | **B7**, con el asiento de `B/02` §2.3 | **sí**: se devuelve por donde entró —una transferencia— y **no toca la pasarela**, así que `B6` no la bloquea. Lo único que faltaba era dónde asentarla, y es un `refund` sobre el `manual_payment` |

O sea: **B7 puede quedar entera y correcta con B6 sin empezar**, y lo que queda pendiente es que
la persona que confirma el reembolso tenga con qué ejecutarlo. Lo que **no** se puede es liberar
el cambio de plan desde grace sin B6 y llamarlo completo: habría casos acumulándose en el canal de
conciliación sin herramienta que los cierre.

**Y el criterio de terminación de B7 quedó describiendo el comportamiento que la tanda
reemplazó.** Su §4 dice *«un pago tardío que llega habiendo otra suscripción viva no reactiva nada
y el evento dice cuál de las cuatro condiciones falló»*. Desde `S19` ese pago **no sólo no
reactiva**: se registra, **queda pendiente**, **sin marca y sin evento crítico** (`B/05` §3, la
excepción), y su destino lo decide el cierre. Una implementación que descarte el pago —o que ponga
la marca al llegar, que es lo que el criterio sugiere— **satisface el criterio al pie de la letra y
pierde la plata**. El §4 queda corregido abajo.

**Y cada unidad trae la pantalla mínima que su propio flujo necesita** —el alta necesita un
checkout—. B13 es la unidad de las superficies que **leen el estado compuesto** y de la lista de lo
que hay que decir, no la que inventa las pantallas de las demás.

---

## 4. Lo que cada unidad tiene que dejar demostrado

No es una lista de tests: es **qué pregunta tiene que poder contestar alguien de afuera** cuando la
unidad se declara terminada.

> **Y hay una condición que vale para las trece y no está en la tabla, porque no depende de qué
> construye cada una**: **una unidad no está terminada mientras algún guard de su columna `guards`
> del §2 no esté escrito y no tenga su caso que lo hace fallar a propósito** (§2.1, *«un guard que
> no puede fallar es un comentario con exit code 0»*). La regla 1 del §1.3 dice **cuándo** va cada
> guard —*«con la pieza que protege, nunca al final»*— y hasta esta pasada **no había ningún lugar
> donde se comprobara que había ido**: la asignación vivía sólo en una columna que nadie consulta
> al declarar una unidad lista. **Los 29 guards están repartidos entre las 22 unidades —13 en esta
> épica y 16 en la otra, contados sobre las dos columnas— y ninguno aparecía en ninguno de los 22
> criterios**, así que la quinta enmienda de `DEC-TEST-001` compró que todos tuvieran dueño y no
> compró que alguno se construya. El desarrollo, del lado de verticales, está en
> [`V/descomposicion.md`](../HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md) §4.
>
> **No se enumeran acá uno por uno a propósito**: duplicar la columna sería un segundo censo del
> mismo conjunto. **La columna es la lista; esto es lo que la vuelve una condición.**
>
> **Y hay una segunda condición de la misma forma, sobre los ESCRITORES** (`DEC-TEST-002`):
> **una unidad no está terminada mientras alguna escritura que sus capítulos le declaran a una de
> sus transiciones no esté implementada.** También vale para las trece, también es independiente de
> qué construye cada una, y también sale de una columna que ya existe — acá la de **capítulos** del
> §2, que es donde está declarado qué escribe cada transición.
>
> **De dónde sale, y es una contrapartida exacta y no una precaución general.** `G-R6` exige que
> *«al menos una transición del corpus»* escriba cada columna que una condición lee, y **el corpus
> son las tablas que los capítulos declaran**, nunca el subconjunto ya construido (`B/20` §2) —
> es lo que impide que el guard nazca en rojo sobre el camino normal entre `B5` y `B8`, donde
> `MP5` lee una fecha cuya tercera escritura es de `S10`, que construye `B8`. **El precio de esa
> elección está dicho en el mismo lugar donde se toma**: un escritor que el capítulo declara y que
> **nadie implementa pasa en verde**, y `B/20` §2 declara que esa clase **ningún guard la vigila**.
>
> **Por qué un criterio y no un guard, que es lo que el owner eligió entre las tres opciones.**
> Un guard que compare escritores **declarados** contra **implementados** sólo puede correr cuando
> exista el código —FASE 10 en adelante—, así que hasta entonces no vigila nada; el criterio, en
> cambio, actúa **en el instante en que la unidad se declara lista**, que es cuando el escritor
> tendría que estar, y no cuando alguien lea un dato vacío en producción. Es exactamente la forma
> del párrafo de arriba aplicada al otro conjunto.
>
> **Y no se enumeran acá tampoco, por la misma razón**: las tablas de transiciones de los capítulos
> ya declaran cada escritura, y copiarlas sería un segundo censo del mismo conjunto. **La
> declaración del capítulo es la lista; esto es lo que la vuelve una condición.**
>
> **Y esto NO revive el guard que `B/20` §2 rechaza sobre la misma dirección.** Allá lo rechazado
> es que **un guard estático** comprueba que un hecho tenga quien lo ejecute: *«pide una
> declaración, y un guard estático sólo puede comprobar que esté»*. Un criterio de terminación no
> es un guard —lo contesta una persona al declarar lista la unidad, con el código delante— así que
> la objeción **no lo alcanza**, y la dirección que allá sigue sin vigilancia automática queda con
> vigilancia humana en el único momento en que se puede ejercer.

| # | la unidad está lista cuando… |
|---|---|
| **B1** | el adaptador falso implementa la interfaz entera **sin nombrar un concepto de Mercado Pago**; importar el SDK afuera **falla**; y el falso **miente** — hay un caso donde acepta una mutación, devuelve `2xx`, **no la aplica**, y el código de arriba lo detecta releyendo |
| **B2** | un monto escrito en código **falla**; un precio con decimales **no se puede guardar**; y cambiar un precio deja demostrable contra un registro cuál era el anterior **sin que ninguna suscripción viva cambie de monto** |
| **B3** | diez altas simultáneas del mismo `user + vertical` dejan **una** fila y **un** id en el proveedor; una ventana que vence **cancela en el proveedor** y no sólo marca la fila; y dos webhooks que llegan al revés dejan **el mismo estado** |
| **B4** | el juego de casos corre contra las dos implementaciones y **hay al menos uno que la de arranque no pasa** — si pasan los dos con las dos, no está probando nada; y la de arranque **no puede llegar a producción** |
| **B5** | un reembolso que emite **tres notificaciones en dos formatos** produce **una** fila; un período con un pago acreditado **rechaza el segundo desde la base**, no desde un chequeo; y un hecho más viejo que el último aplicado **se registra y no se aplica** |
| **B6** | 🔒 **no se puede redactar todavía**: qué hay que demostrar depende de quién tenga el reloj. Lo que sí vale en las dos respuestas: **ningún cobro sale sin su clave de idempotencia persistida antes**, y **nunca hay dos relojes sobre la misma autorización** |
| **B7** | un **primer** cobro rechazado **no da grace**; un cobro que el proveedor está reintentando deja el pago `PENDING` y la suscripción `ACTIVE`; un pago tardío que llega habiendo **otra suscripción viva** para ese `user + vertical` **no reactiva nada** y el evento dice **cuál** de las cuatro condiciones falló — **salvo que esa otra fila sea su propia sucesora viva**, y ahí el pago **se registra y queda pendiente**, **sin marca y sin evento crítico** (`S19`, `05` §3), con su destino decidido por **cómo termina la sucesión** y no por su llegada; y **las SEIS ramas de `12` §5.3 tienen cada una un acto que apaga la bandera** —`S18` con la marca `REEMBOLSO_POR_CONFIRMAR`, en las ramas 1, 5 y 6; `S3` reevaluando; `S13` apagándola; y la 3 la resuelve la persona que ya está mirando la traba— de modo que **ninguna corrida deja un pago «pendiente» para siempre**; y **un pago registrado A MANO sobre una predecesora en sucesión entra por esa misma fila** —no cae en la marca, no reactiva y **no la suspende cuando vence el grace**—, con su devolución asentada igual que la de un cobro del proveedor (`03` §7, `02` §2.3) |
| **B8** | **un cambio hacia una versión de `rank` MAYOR con un solo limit menor sigue el camino de DOWNGRADE** —si sigue el de upgrade, la dirección se está derivando del `rank` en vez de pedírsela a `direcciónDeCambio` (contrato §4.1), y el cliente pierde el aviso previo del excedente—; un downgrade encima de otro **vuelve a preguntar** qué conservar; un aumento cuya fecha cae sobre una pausada se aplica en el **primer cobro posterior a la reanudación** y nunca recortando los 60 días; cancelar estando pausado corta el servicio **ese día**; **una predecesora que se muere sola con la sucesora todavía esperando autorización cierra la sucesión en el acto, y un alta nueva sobre ese `user + vertical` la rechaza la base**; y **un upgrade no le saca nada al cliente**: los complementos y la redención de promo terminan colgando de la sucesora, con el descuento vuelto a aplicar sobre el monto nuevo y verificado releyendo, y **la cortesía vigente NO se re-apunta: se cierra con su saldo de días y `S9` la re-emite sobre la sucesora cuando ésta autoriza** (`02` §2.6, `14` §4.4, `DEC-GRANT-007`) |
| **B9** | un 20 % y ARS 100 sobre ARS 1.000 dan **700 y nunca 720**; un descuento que deja el monto bajo ARS 15 **pausa en vez de mutar**; y agregar cortesía y grant como fuentes **no toca una línea** de lo que dejó B4 |
| **B10** | cancelar el plan **deja vivo** el preapproval de cada addon recurrente, y el barrido **lo ve**; borrar una ficha **dice qué addons se pierden y por cuánto** antes de borrarla; `PERIÓDICO + DÍAS_FIJOS` **no se puede configurar**; y **un addon cuyo título muere mientras su checkout está abierto no llega a cobrar nunca** —se le cancela el preapproval esperando autorización, y si igual autoriza, el barrido lo encuentra vivo con el objetivo muerto (`03` §8, `16` §4.2 y §4.3, `09` §3 cuarta comprobación); y **a un beneficiario de *Free Forever* con `includesAddons: true` no se le cobra ni un peso más por un addon compatible** —su suscripción de complemento queda `CANCELLED` en el mismo acto del otorgamiento, **sin reembolso de lo ya cobrado**, la instancia sigue `ACTIVE` colgando del ancla, y **al revocar el grant se apaga y no vuelve sola**, ni siquiera con scope `USER` o `GLOBAL`, donde el objetivo nunca murió (`S20`, `03` §3.2 y §8, `16` §3.3 y §3.4); y **cuando un addon se apaga, su suscripción de complemento queda `CANCELLED` en el mismo acto** —sin período de gracia, sin fecha de fin de servicio y **sin reembolso automático** de lo ya cobrado—, así que no queda ninguna fila de complemento viva colgando de una instancia terminal (`S21`, `03` §3.2 y §8, `16` §4.4, `09` §3 salvedad 1) |
| **B11** | un barrido que liste desde el buscador del proveedor **no existe**; una suscripción que cobró y cuyo endpoint de cobros devuelve cero **no se reporta como divergencia**; un monto que el proveedor aceptó y no aplicó **aparece**, sin que haya llegado ningún webhook; y **una suscripción TERMINAL con la marca puesta o con un pago pendiente sigue en el barrido**, porque es lo único que hace que el reloj de la marca escale sobre el reembolso que `DEC-RF-002` volvió manual |
| **B12** | retirar un plan **no mueve a nadie** —ni un monto, ni una fecha, ni un entitlement—; y anunciar una discontinuación **corta el cobro el día 0** dejando el servicio prestándose hasta la fecha, nunca al revés |
| **B13** | cancelar cuesta **los mismos pasos o menos** que suscribirse; **nuestro** correo sale antes que el del proveedor; y ninguna pantalla esconde algo que la autorización **no** rechazaría |

---

## 5. Dónde vive cada unidad

Las trece están en Linear como sub-issues de `HOS-1354`, y cada una tiene su ficha publicada. El
estado en vivo —qué está bloqueado, qué se puede empezar, qué está en curso— se lleva en el
**[tablero](https://claude.ai/artifact/VvQ3hGSGZC5nr4ZHc5VqPB)**, que calcula solo cuáles están
listas: una unidad lo está cuando todas sus dependencias están hechas.

| unidad | issue | ficha |
|---|---|---|
| **B1** | [HOS-1364](https://linear.app/hospeda-beta/issue/HOS-1364) | [ficha](https://claude.ai/artifact/XS15EzcyrUFXkHrqRPk7mp) |
| **B2** | [HOS-1365](https://linear.app/hospeda-beta/issue/HOS-1365) | [ficha](https://claude.ai/artifact/W7vHN5g24wAL6UcvPjMNmN) |
| **B3** | [HOS-1366](https://linear.app/hospeda-beta/issue/HOS-1366) | [ficha](https://claude.ai/artifact/SZWTgCVsibxQQBoCv1BqS1) |
| **B4** | [HOS-1367](https://linear.app/hospeda-beta/issue/HOS-1367) | [ficha](https://claude.ai/artifact/PhznPesGdJNckEgUJukffC) |
| **B5** | [HOS-1368](https://linear.app/hospeda-beta/issue/HOS-1368) | [ficha](https://claude.ai/artifact/TCjMHoQtCmbE1GDvJndrKu) |
| **B6** 🔒 | [HOS-1369](https://linear.app/hospeda-beta/issue/HOS-1369) | [ficha](https://claude.ai/artifact/7Rgsqbpv4xexx9dbzbaqwF) |
| **B7** | [HOS-1370](https://linear.app/hospeda-beta/issue/HOS-1370) | [ficha](https://claude.ai/artifact/BxvBsVpS1pypNgdaFqb9ZY) |
| **B8** | [HOS-1371](https://linear.app/hospeda-beta/issue/HOS-1371) | [ficha](https://claude.ai/artifact/UASiMLVL8iS9WVjPD2EU9d) |
| **B9** | [HOS-1372](https://linear.app/hospeda-beta/issue/HOS-1372) | [ficha](https://claude.ai/artifact/Fe1bqQkj8QThu75uKsHjev) |
| **B10** | [HOS-1373](https://linear.app/hospeda-beta/issue/HOS-1373) | [ficha](https://claude.ai/artifact/CcSEbDa1dofcH7KH1RwZp3) |
| **B11** | [HOS-1374](https://linear.app/hospeda-beta/issue/HOS-1374) | [ficha](https://claude.ai/artifact/TCB6UEHbuxKDnLqYkHHmTC) |
| **B12** | [HOS-1375](https://linear.app/hospeda-beta/issue/HOS-1375) | [ficha](https://claude.ai/artifact/TuSxTZSU9xcUTy7Fp9uE6q) |
| **B13** | [HOS-1376](https://linear.app/hospeda-beta/issue/HOS-1376) | [ficha](https://claude.ai/artifact/7rdj5o5UFqbar5vD5ixsLn) |

**Las otras fichas del programa**: [el paraguas](https://claude.ai/artifact/WiHhGp54XspK1mwFpHWjRA) ·
[la épica de verticales](https://claude.ai/artifact/UZzqK6P7ZyfAFuWrw5n4BP) ·
[la épica de billing](https://claude.ai/artifact/Bp6dJstfwqoMzFTLP11BPZ) ·
[el contrato de cobertura](https://claude.ai/artifact/KgHuCs8uTVEtNeuYfuLLJQ) ·
[la descomposición de verticales](../HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md).

---

## 6. Lo que esta descomposición NO decide

- **Cuál es la pasarela**, que es lo que traba la construcción entera. Está en el paso 4 de 6 de la
  evaluación, esperando la PRUEBA 0 y el KYC de Mobbex — **las dos en manos del owner**. Esta
  descomposición dice qué se puede hacer mientras tanto (§2.3); no acelera la decisión.
- **El modelo canónico de cobro.** Es la pregunta de B6, y está planteada en la spec §5.1 con sus
  opciones y una recomendación. Esta descomposición la aísla; no la contesta.
- **Las tareas atómicas de cada unidad.** Se atomiza cuando la unidad arranca, con el estado del
  código de ese momento a la vista.
- **Qué se reescribe y qué se reutiliza.** Es FASE 5 y tiene su gate propio (`DEC-METH-003`) —
  salvo `qzpay`, que `DEC-ARCH-004` ya resolvió: **se absorbe**. Esta descomposición dice **qué hay
  que tener funcionando**, no de dónde sale.
- **Fechas y esfuerzo.** No hay estimaciones acá a propósito: salen del atomizado.
- **Las seis preguntas legales**, que no las contesta el diseño. Lo que sí está cerrado es qué
  depende de cada una, y eso permite implementar el resto sin esperarlas.

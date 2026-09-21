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
   **El motivo es parte de la regla**: el corpus escribe once marcas distintas sobre la misma
   casilla y **tres** dicen *«hay plata del cliente que devolver»*; sin el motivo todas llegaban
   iguales a la bandeja y la que se perdía era ésa.

---

## 2. Las trece unidades

La columna **⛔** marca las que **llaman a la pasarela**: no se pueden terminar sin saber cuál es.

| # | unidad | ⛔ | qué deja funcionando | capítulos | guards |
|---|---|---|---|---|---|
| **B1** | **El adaptador y el proveedor que miente** | ⛔ | las ocho capacidades como interfaz definida por lo que el dominio necesita, el adaptador falso que reproduce las mentiras medidas, y la regla de releer toda mutación | `06` entero · `20` §2–§3, §6 | `G9` `G10` `G11` `G12` |
| **B2** | **El precio** | ✅ | `billing_option`: el ciclo y su monto, en entero, colgando de la versión de plan y no del plan | `02` §2.1 · `06` §5 | `G7` |
| **B3** | **El alta y su ventana** | ⛔ | hay un compromiso de cobro vivo, y la ventana en que todavía no lo es vence, limpia y no se duplica | `03` §3.1–§3.4, §10 · `05` §1, C6 · `02` §2.2 | — |
| **B4** | **El contrato de cobertura, de verdad** | — | `cobertura()` responde con una fuente de billing viva, y el aviso de que cambió sale | [contrato](../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md) §5.2, §6 | `G13` |
| **B5** | **El registro del dinero** | — | qué se cobró, qué se reembolsó y qué se registró a mano, sin que un hecho se aplique dos veces ni un período admita dos pagos | `02` §2.3 · `03` §6, §7, §10.2 · `05` C5 | — |
| **B6** | **Ejecutar el cobro y el reembolso** 🔒 | ⛔ | **BLOQUEADA, y es la única sin diseño** — es el capítulo 13, el único de los 22 sin escribir | `13` *(sin escribir)* | — |
| **B7** | **La mora** | ⛔ | un cobro que no entra abre un reloj que se cierra, el que nunca pagó no recibe diez días gratis, y **el pago que entra en plena sucesión no reactiva, no se pierde y tiene quién lo resuelva** | `03` §4, S4–S7, **S19** · `12` §1, §4, §5 · `05` §3 | — |
| **B8** | **Los cambios del compromiso** | ⛔ | cambiar de plan, de ciclo, pausar y darse de baja, cada uno por su camino y sin pisarse — **incluido el CIERRE de la sucesión con sus cuatro escrituras** | `03` §5, S8–S12, **S17–S18** · `12` §2, §3, §6, §7 · `02` §2.6 · `05` C2, C4 | — |
| **B9** | **Las concesiones** | ⛔ | promos, cortesías y grants componen de forma determinista y se enchufan como fuentes. **`S20` no es de acá**: el grant cancela la principal (`S13`) y el complemento lo apaga **B10**, que llega después en el camino crítico y es donde vive el modelo del addon | `14` entero · `03` S9, S13 · `02` §2.4 · `05` C3 | — |
| **B10** | **Addons** | ⛔ | los dos ejes, qué es una suscripción válida, el addon a costo cero —**el que se elige gratis y el que ya se venía pagando y `S20` convierte**— y el huérfano que sigue cobrando —**con su cobro apagado por `S21`**— | `16` entero · `03` §8 **y `S20` y `S21` de §3.2** · `02` §2.4 · `09` §3 *(tercera y cuarta comprobación, y las salvedades 1 y 4)* · `19` §4 filas 13 y 13-bis | — |
| **B11** | **Conciliación** | ⛔ | lo que creemos coincide con lo que hay, y lo que diverge en silencio aparece | `09` entero | — |
| **B12** | **El catálogo que se retira** | ⛔ | retirar un plan no mueve a nadie, y discontinuar una vertical deja de cobrar antes de dejar de prestar | `10` entero | — |
| **B13** | **Superficies y la baja** | — | la pricing, Mi Suscripción, la baja self-service, y la lista de lo que hay que decir | `19` entero · `22` §1 | — |

**⛔ nueve · — tres · ✅ una.** Las tres del guion —B4, B5 y B13— no llaman a la pasarela, pero
**dependen de una que sí**, así que tampoco arrancan antes. La única sin ninguna atadura con la
pasarela, ni propia ni heredada, es **B2**: su gate es `V2`, de la otra épica.

### 2.1 Los dos guards que el capítulo 20 no nombra

El `20` §2 lista cuatro —`G7`, `G9`, `G10`, `G11`—. **Faltan dos que dos decisiones exigen
explícitamente**, y se numeran acá para poder asignarlos a una unidad; si el `20` se reescribe,
los absorbe:

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

### 2.6 Las dos dependencias con la otra épica, y las dos son tempranas

**B2 no puede existir sin `plan_version`**, que es `V2` de verticales: `billing_option` cuelga de
ella con `UNIQUE(plan_version_id, ciclo)`. Es el corte de `DEC-ARCH-005` visto desde abajo — el
precio vive en **una sola tabla hoja** y todo lo que está encima es configuración de capacidades.

**No contradice la autonomía.** `V2` es la **segunda** unidad de la otra épica, y lo que B2 necesita
es esa unidad mergeada en la rama del paraguas, no la épica terminada. La segunda dependencia es la
de B4 sobre `V4`, que trae el contrato con su implementación de arranque.

Esas dos, y ninguna más. Si aparece una tercera, es la señal del contrato §4: **el corte se está
filtrando, se mira y no se resuelve en el lugar**.

### 2.7 Dónde caen las ocho filas `UNKNOWN`

Las 89 filas de la matriz, recontadas con `contar-filas-de-la-matriz.py`: **49 `VERIFIED`, 19
`NOT_SUPPORTED`, 13 `PARTIALLY_SUPPORTED`, 8 `UNKNOWN`.**

| filas | unidad | qué bloquea de verdad |
|---|---|---|
| `RN-2` `RN-3` `GR-1` `GR-2` `GR-3` | **B7** | son **el mismo hecho, un cobro que falla**, e imposibles de fabricar con Mercado Pago. Y gobiernan el grace **sólo mientras el reloj sea del proveedor**: con el reloj nuestro pasan a ser una nota del adaptador |
| `WH-5` | **B1** | nada crítico — se fuerza con el interruptor del receptor |
| `RF-3` | **B6** | el caso viejo del reembolso. Ya está en la unidad bloqueada |
| `EX-1` | **B3** | nada: la ventana de 72 h es nuestra justamente porque esta fila está abierta, y cancelar al vencer **falla hacia el lado seguro sin saber la respuesta** |

**Ninguna de las ocho bloquea una unidad que no estuviera ya bloqueada.** El §61 prohíbe empezar
una capability crítica con su fila abierta, y la única que lo está es B6.

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
| poner la marca al cerrar la sucesión (`S18`, efecto 4) | **B7** | **sí** — es una escritura nuestra, no toca la pasarela |
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

| # | la unidad está lista cuando… |
|---|---|
| **B1** | el adaptador falso implementa la interfaz entera **sin nombrar un concepto de Mercado Pago**; importar el SDK afuera **falla**; y el falso **miente** — hay un caso donde acepta una mutación, devuelve `2xx`, **no la aplica**, y el código de arriba lo detecta releyendo |
| **B2** | un monto escrito en código **falla**; un precio con decimales **no se puede guardar**; y cambiar un precio deja demostrable contra un registro cuál era el anterior **sin que ninguna suscripción viva cambie de monto** |
| **B3** | diez altas simultáneas del mismo `user + vertical` dejan **una** fila y **un** id en el proveedor; una ventana que vence **cancela en el proveedor** y no sólo marca la fila; y dos webhooks que llegan al revés dejan **el mismo estado** |
| **B4** | el juego de casos corre contra las dos implementaciones y **hay al menos uno que la de arranque no pasa** — si pasan los dos con las dos, no está probando nada; y la de arranque **no puede llegar a producción** |
| **B5** | un reembolso que emite **tres notificaciones en dos formatos** produce **una** fila; un período con un pago acreditado **rechaza el segundo desde la base**, no desde un chequeo; y un hecho más viejo que el último aplicado **se registra y no se aplica** |
| **B6** | 🔒 **no se puede redactar todavía**: qué hay que demostrar depende de quién tenga el reloj. Lo que sí vale en las dos respuestas: **ningún cobro sale sin su clave de idempotencia persistida antes**, y **nunca hay dos relojes sobre la misma autorización** |
| **B7** | un **primer** cobro rechazado **no da grace**; un cobro que el proveedor está reintentando deja el pago `PENDING` y la suscripción `ACTIVE`; un pago tardío que llega habiendo **otra suscripción viva** para ese `user + vertical` **no reactiva nada** y el evento dice **cuál** de las cuatro condiciones falló — **salvo que esa otra fila sea su propia sucesora viva**, y ahí el pago **se registra y queda pendiente**, **sin marca y sin evento crítico** (`S19`, `05` §3), con su destino decidido por **cómo termina la sucesión** y no por su llegada; y **las SEIS ramas de `12` §5.3 tienen cada una un acto que apaga la bandera** —`S18` con la marca `REEMBOLSO_POR_CONFIRMAR`, en las ramas 1, 5 y 6; `S3` reevaluando; `S13` apagándola; y la 3 la resuelve la persona que ya está mirando la traba— de modo que **ninguna corrida deja un pago «pendiente» para siempre**; y **un pago registrado A MANO sobre una predecesora en sucesión entra por esa misma fila** —no cae en la marca, no reactiva y **no la suspende cuando vence el grace**—, con su devolución asentada igual que la de un cobro del proveedor (`03` §7, `02` §2.3) |
| **B8** | un downgrade encima de otro **vuelve a preguntar** qué conservar; un aumento cuya fecha cae sobre una pausada se aplica en el **primer cobro posterior a la reanudación** y nunca recortando los 60 días; cancelar estando pausado corta el servicio **ese día**; **una predecesora que se muere sola con la sucesora todavía esperando autorización cierra la sucesión en el acto, y un alta nueva sobre ese `user + vertical` la rechaza la base**; y **un upgrade no le saca nada al cliente**: los complementos, la redención de promo y la cortesía vigente terminan colgando de la sucesora, con el descuento vuelto a aplicar sobre el monto nuevo y verificado releyendo (`02` §2.6) |
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

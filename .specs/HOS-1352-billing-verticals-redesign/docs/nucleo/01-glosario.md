---
title: Master Spec 01 — Glosario y modelo conceptual
linear: HOS-1352
statusSource: linear
created: 2026-09-17
updated: 2026-09-21
status: CURRENT
fase: 2
capitulo: 1
cierra:
  - M-ARCH-01
  - A-SUB-01
  - A-SUB-02
  - O-ARCH-01
  - S-ARCH-02
---

# 01 · Glosario y modelo conceptual

Este capítulo fija **los nombres**. Todo lo que el resto de la spec use tiene que estar acá, y
nada de lo que esté acá se redefine en otro capítulo.

Existe por una razón concreta: el §63 pide modelar ocho máquinas de estado, y sin un
diccionario único cada épica de FASE 3 inventa el suyo. Es exactamente cómo se llega a lo que
el §1 describe —*«implementaciones divergentes»*, *«conceptos obsoletos»*—.

---

## 1. Las entidades

### 1.1 Persona y acceso

| término | qué es |
|---|---|
| **User** | Cuenta autenticada (§6). Es la unidad de identidad de todo el modelo. |
| **Guest** | Persona sin autenticar (§6). **No es un Turista**: el §36.2 lo dice explícitamente. |
| **Turista** | Un User usando capacidades de turista (§6). Todo User autenticado es `Turista Free` por estado base (§14), **sin suscripción real**. |

### 1.2 Vertical y lo que publica

| término | qué es |
|---|---|
| **Vertical** | Categoría de producto dentro de Hospeda (§6). Hoy: Turista, Alojamiento, Gastronomía, Experiencia, Partner. |
| **Vertical comercial** | La que puede participar de planes y billing (§6). Hoy son las cinco. |
| **Vertical con ficha** | Alojamiento, Gastronomía, Experiencia (§6). |
| **Ficha** | Recurso publicable con **exactamente un** User dueño (§6). No hay multi-dueño. Un User puede tener varias. |
| **Presencia de Partner** | La página propia de Partner Gold (§17.1). El §17.1 ordena **no** forzarla al modelo `Ficha` pese al parecido, así que es una entidad distinta con su propio ciclo de publicación. |
| **Inactividad** (de una ficha) | El tiempo que lleva **sin estar a la vez publicada y cubierta**, contado desde **el más reciente** de los cuatro hechos que la reinician. Es el reloj del §25 —*«desde que queda efectivamente inactiva»*— el que disparan `PB4` (día 90) y `PB5`, y sobre el que se cuenta el día 180 (cap. 02 §4, épica de verticales). **Ese instante es un dato y tiene dónde vivir: la columna `listing.inactiva_desde`** (`V/02` §2.5). |

**Los cuatro hechos que reinician la inactividad, y la lista es cerrada:**

| # | hecho | de dónde se lee | por qué reinicia |
|---|---|---|---|
| 1 | un **acto del dueño** sobre la ficha: crearla, editarla, publicarla, despublicarla, exportarla, reactivarla | el registro append-only de eventos de dominio (cap. 08 §1.3), que ya los guarda todos por el criterio 2 del §1.1 | alguien la está usando, que es lo contrario de estar inactiva |
| 2 | **la cobertura se comprueba verdadera** — un ESTADO leído, nunca un cambio detectado | **la respuesta del contrato** —el campo `cubierto` de [`12-contrato-de-cobertura.md`](../12-contrato-de-cobertura.md) §2.1—, **vuelta a pedir**. El aviso del §3 dice **cuándo** preguntar y no contesta la pregunta | estar cubierto **es** no estar inactivo. Reinicia **por sí solo**, aunque la ficha no vuelva a publicarse —si el cupo no alcanza, por ejemplo— porque lo que terminó es la ausencia, no el cupo |
| 3 | la ficha **vuelve a `PUBLISHED`** — `PB1`, `PB3` o `PB7` (cap. 03 §9, épica de verticales) | la propia máquina | una ficha publicada no acumula inactividad; su reloj arranca recién cuando deja de estarlo |
| 4 | el **fin de servicio** de una vertical discontinuada | la columna `vertical.fin_de_servicio` (`V/02` §2.1), que es de **esta** épica; `B/10` §4 es **quien la lee** (`B/10` §4.6), no de dónde sale. **Lo ejecuta el barrido del día del fin de servicio** (`B/10` §4.3), que es un **camino de servicio** y no una transición | ahí el dueño **no puede** actuar, así que contar su ausencia lo castigaría por una decisión nuestra. `B/10` §4 ya dice que el reloj arranca ahí; acá queda dicho que arranca **ahí y no antes** |

**Que la lista sea cerrada lo verifica un guard, `G-R6-B` (`V/20` §2), y no la memoria del que
escribe.** Una escritura de `listing.inactiva_desde` que no sea uno de estos cuatro lo pone en
rojo, y quien agregue un hecho nuevo agrega su fila acá **en el mismo acto**. Es la misma regla que
los cuatro inventarios del §2.4, §2.5 y §2.6, con la diferencia de que **lo que se enumera acá es el
lado que ESCRIBE, y son hechos y no ejecutores** —un hecho puede tener varios, y el 2 tiene tres—:
la lista de **lectores** de la misma columna vive en `V/02` §2.5 y **la vigila el
mismo guard, con un mensaje propio** (cuarta enmienda de `DEC-TEST-001`). **No la vigila `G-R6`**:
ése cruza las columnas que una condición
**lee** contra las que alguna transición **escribe**, y de estos cuatro hechos **sólo el tercero es
una transición**, así que queda verde por ése solo — está medido y dicho en `V/20` §2.

**El hecho 2 es un ESTADO COMPROBADO y no un cambio detectado, y hasta esta pasada estaba enunciado
de una manera y ejecutado de la otra.** Decía *«`cubierto` pasa a verdadero»* —un cambio— y **sus
dos escrituras declaradas comprueban un valor**: el recálculo escribe *«cuando vuelve a preguntar y
**trae** `cubierto` verdadero»* y `PB4`/`PB5` escriben *«si el `user + vertical` **está** cubierto»*
(`V/02` §4.2 regla 4, `V/03` §9). Los dos enunciados producen sistemas distintos y **no hay una
tercera lectura**, así que queda elegido el que sus ejecuciones ya usaban, por tres razones:

1. **El cambio no es observable donde más hace falta.** El que ejecuta relee *porque el aviso se
   puede haber perdido* —el párrafo de abajo—, y sin el aviso no hay ningún cambio que detectar: lo
   único que tiene delante es un valor. Enunciarlo como cambio vuelve **inejecutable** la única red
   contra el modo de falla que el propio diseño declara frecuente.
2. **El §3 del contrato ya lo ordena así.** Prohíbe decidir con lo que trae el evento y manda
   **preguntar el estado**; un predicado de cambio obliga a recordar el valor anterior, que es
   precisamente la memoria que ese § no quiere que nadie guarde.
3. **Y es lo que vuelve legítimas las escrituras que ya existen.** Con el predicado de cambio, la
   relectura de `PB4`/`PB5` **no es ninguno de los cuatro hechos** —en el momento de archivar
   `cubierto` no cambia, ya vale verdadero— y `G-R6-B` mitad *(a)* se pondría en rojo **sobre la
   red y no sobre el defecto**, con lo que la salida obvia del que lo vea es sacar la relectura y
   reabrir el borrado que `DEC-DATA-002` cerró.

> ⚠️ **Y esto NO toca el evento de `PB3` ni el de `PB7`, que siguen siendo un CAMBIO.** Una
> transición se dispara por un cambio —es lo que la hace una transición— y las dos lo dicen así en
> `V/03` §9. Lo que se separa acá es que **la misma frase estaba nombrando dos cosas distintas**: el
> evento de una máquina, que ocurre una vez y en un instante, y el hecho de un reloj, que cualquiera
> que actúe sobre él tiene que poder comprobar **en el momento de actuar**, las veces que haga falta.

**Y la lista enumera HECHOS, no ejecutores, que es lo que hace bien definida a la mitad *(a)* de
`G-R6-B`.** El guard rechaza *«una escritura que no sea uno de los cuatro hechos»*: la pregunta que
contesta es **de cuál de los cuatro es** la escritura, nunca **quién** la hizo. Un hecho puede tener
más de un ejecutor sin que la lista crezca —el 2 los tiene— y por eso el guard **no** cuenta
escritores: cuenta hechos. *(El propio `V/20` §2 ya declara que ninguno de los dos guards verifica
que los cuatro hechos tengan quien los ejecute; eso es una comprobación distinta y sigue sin
hacerse.)*

**El hecho 2 se lee de la CONSULTA y nunca del aviso, y ésa es la diferencia entre reiniciar el
reloj y creerle a un mensaje.** El §3 del contrato lo prohíbe con todas las letras —*«el evento no
reemplaza la consulta … un consumidor que decidiera con lo que trae el evento estaría creyéndole a
un mensaje en vez de al estado»*— y este reloj **decide**: decide borrar. Así que el aviso hace acá
exactamente lo que hace en los otros dos consumidores que ya cuelgan de él —la invalidación del
caché y el reconciliador, *«una lista, dos consumidores»* (`V/15` §4.2)—: **despierta el recálculo,
y el recálculo vuelve a preguntar**. Si `cubierto` viene verdadero, se escribe el instante en
`listing.inactiva_desde` (`V/02` §2.5).

**Y como un aviso se puede perder, el que ACTÚA vuelve a preguntar antes de actuar.** `PB4`, `PB5`
y el hard delete del día 180 **releen la cobertura del `user + vertical` en el momento de ejecutar**
y, si está cubierta, reinician el reloj en vez de avanzar. Es el mismo §3 aplicado al otro extremo,
y es lo que vuelve el aviso perdido un retraso y no un borrado: sin esta relectura el modo de falla
cae del lado caro —el aviso que no llega deja el reloj corriendo sobre alguien que volvió—, y el
propio diseño ya declara que estos avisos se pierden (`V/02` §3.2, regla 2: *«si la invalidación
falla, la operación de dominio no falla»*). Ahí cuesta rendimiento; acá costaría el contenido.

**Son TRES los que releen, y hasta esta pasada esta línea era la única del corpus que lo decía.**
Los otros cuatro lugares donde el mecanismo está escrito nombraban a **`PB4` y `PB5`** y contaban
*«dos momentos, no en uno»* (`V/02` §4.2 regla 4, `V/02` §2.5, `V/03` §9 dos veces,
`12-contrato…` §3), así que **la lectura mayoritaria del corpus dejaba al día 180 decidiendo con un
aviso que el propio diseño declara que se pierde** — y es el único de los tres que no tiene vuelta:
lo que `PB4` archiva lo recupera `PB8`, y lo que el día 180 borra no lo recupera nada. Los cinco
lugares dicen ahora lo mismo. **Y la relectura que trae la cobertura verdadera no es un escritor
intruso**: escribe el **hecho 2**, del que es uno de sus tres ejecutores, así que `G-R6-B` mitad
*(a)* la acepta por la lista y no por una excepción.

**Y el hecho 4 ya tiene ejecutor declarado, que hasta esta pasada no lo tenía en ninguna de las dos
épicas.** Tener **de dónde leerse** y tener **quién lo escriba** son dos cosas distintas, y el 4
tenía la primera —`vertical.fin_de_servicio`— y no la segunda: `B/10` §4.3 describía el día
(*«arranca el reloj de retención del §25»*, *«y arranca acá, no antes»*) como una afirmación sobre
el reloj, sin ser el efecto de ninguna fila ni de ningún barrido nombrado. Lo único que corre ese
día es `PB2`, y **`PB2` escribiendo esta columna es exactamente el caso con que `V/20` §2 manda
probar `G-R6-B` en rojo**, así que no podía ser. Sin ejecutor, el hard delete caía sobre la fecha
vieja —**hasta 90 días antes** de la que los tres avisos de la discontinuación le prometieron al
cliente—. Lo escribe **el barrido del día del fin de servicio** (`B/10` §4.3), sobre las fichas de
la vertical, en el mismo acto en que `PB2` las despublica y **como escritura suya, no de `PB2`**.

**Los otros tres hechos ya tenían fuente durable y siguen igual**: el 1 sale del registro
append-only de eventos de dominio (cap. 08 §1.3), el 3 de la propia máquina de publicación y el 4
de la columna `vertical.fin_de_servicio` (`V/02` §2.1). El 2 era **el único de los cuatro sin
estado detrás**, y es justamente el que impide que el día 180 alcance a alguien que volvió
(`V/02` §4.1).

**Lo que se retira es que el reloj fuera monótono.** La palabra aparecía **una sola vez en todo
el corpus** —la celda de `PB4`— y sin definición, así que la lectura que una implementación iba a
tomar era la literal: *el tiempo desde que la ficha dejó de estar publicada*, sin nada que lo
reinicie. Con esa lectura, la ficha de alguien que **pausa** su suscripción baja por `PB2` el
primer día de la pausa, cruza el día 90 —el tope de una pausa es de **4 pausas-mes**, unos 120
días (cap. 03 §5, épica de billing)—, y sigue corriendo hasta el hard delete del día 180. Se le
borra el contenido a un cliente que no canceló nada y que usó una función que le vendimos.

**Y la pausa no aparece en la lista de arriba, que es lo que vuelve implementable el arreglo.**
Verticales no sabe —ni puede saber: el §4 del contrato y `DEC-TRIAL-008`— que detrás de la
pérdida de cobertura hay una pausa y no una baja. No le hace falta: el reloj **no se detiene**
durante la pausa, **se reinicia al salir de ella** por el hecho 2, y entre el primer día de la
pausa y ese reinicio hay 120 días como máximo contra los 180 del borrado. Que esa desigualdad
siga siendo cierta **es un invariante, no una coincidencia aritmética**: es `D16` (cap. 04 §3).

### 1.3 Catálogo comercial

| término | qué es |
|---|---|
| **Plan** | Identidad y cosmética: nombre, descripción, orden en la pricing. **Muta libremente**, sin crear versión (`DEC-ARCH-001`). |
| **Versión de plan** | Precio, limits, entitlements, `rank`, flag de vendible, días de grace y días de trial. **Inmutable** (`DEC-ARCH-001`, `DEC-ARCH-002`, `DEC-SUB-002`, `DEC-TRIAL-003`). Toda lectura de configuración comercial resuelve versión primero. |
| **Billing option** | El ciclo y su precio: mensual, trimestral, semestral, anual (§18, §19). |
| **Plan de trial** | El plan especial que se asigna al arrancar un trial (§10.3). **No es elegible** por el User. Deriva sus entitlements del plan vendible de `rank` más alto y sus limits del de `rank` más bajo, y después aplica los overrides declarados (`DEC-TRIAL-001`), con trinquete (`DEC-TRIAL-002`). |
| **`rank`** | El orden explícito de un plan dentro de su vertical (`DEC-ARCH-002`). Participan **sólo los vendibles**. Dos vendibles con el mismo `rank` en la misma vertical es un estado inválido, no un empate a desempatar. |

### 1.4 Compromiso de pago

Acá está `A-SUB-01`, y la respuesta ya la determinó una decisión.

| término | qué es |
|---|---|
| **Suscripción principal** | El compromiso de pago que da acceso a una vertical. **Máximo uno por User + Vertical** (§11) — un **compromiso**, no una fila: durante la ventana de un cambio de plan conviven un origen y su **única** sucesora, y siguen siendo un solo compromiso de pago (cap. 02 (épica de billing) §2.2). |
| **Suscripción de complemento** | El compromiso de pago de **un** addon recurrente. `DEC-ADDON-002` decidió que cada addon recurrente es una autorización aparte en el proveedor, con su propio ciclo, su propio cobro y su propia baja. |

**El adjetivo «main» del §11 es correcto y necesario**, y esto lo cierra: sí existen
suscripciones que no son la principal. Lo que el §11 acota es **sólo** la principal. Las de
complemento no tienen tope propio: su tope es el del addon que las origina.

Y no existen sueltas: el §38 exige *«una subscription válida compatible»* para adquirir un
addon, así que una de complemento **siempre** cuelga de una principal viva. Qué pasa cuando la
principal se va es el capítulo 16 (§41, `E-ADDON-04`).

### 1.5 Concesiones

| término | qué es |
|---|---|
| **Promo code** | Un código que el User canjea. Dos tipos: extensión de trial y descuento (§31). |
| **Cortesía temporal** | N días o meses de servicio sin cobrar, otorgados por `SUPER_ADMIN` (§34, `DEC-GRANT-002`). Se implementa **pausando** en el proveedor y sosteniendo el servicio de nuestro lado (`DEC-GRANT-003`). |
| **Grant permanente** | *Free Forever*. Sólo `SUPER_ADMIN` (§35). Se modela como entidad independiente, no como un plan. |

Las tres se distinguen por **quién la inicia y cuánto dura**: la promo la canjea el User y es
acotada; la cortesía la firma `SUPER_ADMIN` y vence; el grant la firma `SUPER_ADMIN` y no
vence.

> **«No vence» no es «no termina»: el grant termina por revocación y sólo por revocación, y esa
> revocación se guarda.** La cortesía trae su fin escrito en la fila —*«días o meses, inicio,
> fin»*— y el grant no tiene ninguno que anticipe nada, así que lo único que puede apagarlo es un
> acto. Ese acto **deja marca**: `permanent_grant.revocado_en` (cap. 02 (billing) §2.4), que es lo
> que vuelve evaluable *«grant vivo»* (§2.4). Leído como *«no tiene forma de dejar de estar
> vivo»*, este renglón dejaba tres predicados del diseño sin nada contra qué evaluarse.
>
> **Y esa marca guarda TRES cosas: cuándo, quién y POR QUÉ.** El motivo es **texto libre** y entra
> por `DEC-GRANT-008`: revocar *«consume el trial y no se repara»* (`DEC-TRIAL-009`) apoyándose en
> que es una decisión deliberada, y **una decisión deliberada cuyo motivo no se registra es
> indefendible seis meses después** — empezando por ante el beneficiario al que le cortaron el
> servicio sin que hiciera nada. De las tres concesiones de esta tabla es la única cuyo final es
> **un acto de alguien** en vez de un calendario, así que es la única que tiene un *«por qué»* que
> guardar.
>
> **Y un beneficiario tiene a lo sumo UN grant vivo, y lo garantiza la base**, no los **nueve**
> consumidores del término: `UNIQUE(beneficiario) WHERE revocado_en IS NULL` (`DEC-GRANT-009`,
> cap. 02 (billing) §2.4). El índice es **parcial**, así que las revocadas se acumulan sin límite
> — que es exactamente lo que *«revocar marca y no borra»* necesita.

### 1.6 Capacidades

| término | qué es |
|---|---|
| **Entitlement** | Una capability, booleana o **medida** (`DEC-ENT-001`). Puede venir de plan, herencia de Turista VIP, addon, cortesía o grant (§36); mientras al menos una fuente lo otorgue, sigue activo. |
| **Entitlement medido** | El que tiene costo marginal por uso. Declara **dos** cuotas: la del plan y la del trial, menor (`DEC-ENT-001`). La cuota se resetea **todos los meses**, sea cual sea el ciclo de pago, y lo no usado se pierde (`DEC-ENT-002`). |
| **Clase de una clave** | Cuál de **dos** es, y la lista es cerrada: **`COMERCIAL`** o **`DE_ACCESO`**. Se declara **con la clave, en el catálogo**, igual que su scope y su estrategia de agregación (`V/15` §3.4), y por la misma razón que aquéllas: es una propiedad del **significado** de la clave y no de cada plan. Es lo que `G-R3` lee. |
| **Clave de la clase comercial** | La que al ejercerse **produce o sostiene presencia pública** en su vertical, o **consume** un limit o la cuota de un entitlement medido. Es lo que se vende, y es lo que **ninguna de las dos versiones no vendibles** puede otorgar (`V/02` §2.1). Su complemento es **`DE_ACCESO`**: existir, **recuperar lo propio** y **volver a contratar**, que es exactamente lo que la versión de piso otorga y nada más. |
| **Limit** | Un tope numérico con scope explícito. **Se acumulan** entre fuentes (§37). Al desaparecer una fuente se recalcula el límite efectivo. |
| **Addon: producto** | La definición: capability, precio, recurrencia, verticales compatibles, duración, efectos, tipo de scope (§39). |
| **Addon: instancia** | Lo que un User concreto tiene: dueño, objetivo, inicio, fin, estado, pago (§39). |

### 1.7 Registro

| término | qué es |
|---|---|
| **Comprobante** | El PDF que se emite por cada cobro hasta que entre ARCA. **Nunca se lo llama factura fiscal** (§54, `DEC-LEGAL-001`). |
| **Evento de dominio** | El registro de que algo del dominio pasó, no un log técnico (§49). |
| **Outbox** | El registro del intento de notificación, con sus estados y reintentos (§44). |

---

## 2. El glosario de estados · cierra `M-ARCH-01`

El §63 pide ocho máquinas. El capítulo 03 define **nueve** — las ocho del §63 más la
**Postulación de Partner**, que el capítulo 18 §5 declara agregada al núcleo. Acá se fijan **los
nombres** y, sobre todo, se separa la colisión que el PDR trae.

> **Precisado el 2026-09-19 (FASE 8, `F-8C1-011`).** Esta frase decía *«El §63 pide ocho
> máquinas. El capítulo 03 **las** define»*, que hacía coincidir lo que el PDR pide con lo que el
> capítulo entrega, y no coinciden. Las nueve son las secciones §2 a §11 del capítulo 03 **menos
> la §10**, que no es una máquina sino la regla de no-retroceso.

### 2.1 Los dos `SUSPENDED` del PDR son estados distintos

El PDR usa la misma palabra para dos situaciones que no se comportan igual:

- **§10.6** — el trial venció y la persona **no se suscribió**: `TRIAL_ACTIVE -> SUSPENDED`.
- **§20/§21** — el pago falló y el grace se agotó: `GRACE_PERIOD -> SUSPENDED`.

Difieren en tres cosas medibles, y por eso no pueden compartir nombre:

| | trial vencido | impago tras el grace |
|---|---|---|
| ¿hubo dinero de por medio? | **no**, nunca pagó | **sí**, y quedó un cobro sin entrar |
| campaña de recuperación del §10.7 (+1, +5, +15, +30, +60) | **sí** — el §10.7 la define exactamente para este caso | **no** — el §10.7 habla de *«Recovery post-trial»* |
| qué le falta para volver | suscribirse por primera vez | regularizar un pago |

**Se separan así**, y estos son los nombres canónicos:

| estado | qué significa |
|---|---|
| **`TRIAL_EXPIRED`** | El trial terminó sin suscripción. Es el `SUSPENDED` del §10.6. |
| **`SUSPENDED`** | El grace se agotó sin pago. Es el `SUSPENDED` del §20 y §21. |

**Las consecuencias del §21 valen para los dos por igual** —sin listado público, sin edición,
sin creación, sin entitlements comerciales, datos conservados, Mi Cuenta en sólo lectura,
billing accesible, recuperación posible—. Lo que cambia es la comunicación, no el acceso.

**Apartamiento declarado del PDR, registrado como `DEC-ARCH-003`** (2026-09-17, aprobado por el
owner). El §10.6 escribe `SUSPENDED` y esta spec escribe `TRIAL_EXPIRED`; el PDR no se edita
(§3.1), así que la desviación vive en `01-decision-log.md`. Es el tercer apartamiento del
programa, y ya estaba anticipado en el resumen de ese log antes de tener ID propio.

**Y el reloj de retención del §25 arranca igual en los dos.** El §25 dice *«desde que queda
efectivamente inactiva»*, y las dos lo son: día 90 sale del sitio público conservando acceso
del dueño, día 180 hard delete de lo eliminable, con dos avisos previos (`DEC-DATA-001`) y un
tercero el día que se archiva (cap. 07 §6). *«Efectivamente inactiva»* es el término del §1.2:
el reloj corre en los dos **y los dos lo reinician si la cobertura vuelve**, que es lo que
separa a quien se fue de quien volvió.

### 2.2 Los nombres de estado, completos

Lo que sigue es el diccionario; el capítulo 03 dice qué transiciones existen.

| máquina | estados |
|---|---|
| **Trial** | `PRE_TRIAL` · `TRIAL_ACTIVE` · `TRIAL_CONVERTED` · `TRIAL_EXPIRED` |
| **Suscripción** | `PENDING_AUTHORIZATION` · `ABANDONED` · `ACTIVE` · `GRACE_PERIOD` · `PAUSED` · `SUSPENDED` · `CANCEL_SCHEDULED` · `CANCELLED` · `CHARGE_DECLINED`. **`RECONCILIATION_REQUIRED` no está en la lista porque no es un estado**: es la marca `requiere_conciliación` sobre la fila, que conserva el suyo — y **tampoco es un booleano**, es una fila con motivo y reloj (§2.5) |
| **Pago** | `PENDING` · `SUCCEEDED` · `FAILED` · `REFUNDED` · `PARTIALLY_REFUNDED` |
| **Pago manual** | `AWAITING` · `REGISTERED` · `DECLARED_UNPAID` |
| **Addon (instancia)** | `PENDING_AUTHORIZATION` · `ABANDONED` · `ACTIVE` · `EXPIRED` · `CANCELLED` |

> **`ABANDONED` se agregó al escribir el capítulo 03**, no estaba en el primer corte de este
> glosario: `M-SUB-01` exige que la ventana del preapproval sin autorizar tenga duración máxima
> y limpieza, y sin un estado de salida esa ventana no vence nunca.
>
> **La postulación de Partner es la NOVENA máquina, y se agregó al escribir el capítulo 18.** El
> §63 pide ocho y éstas son nueve: `M-PARTNER-01` pregunta textualmente si la postulación *«es una
> entidad con estados propios»*, y lo es — hay una decisión humana en el medio, así que `APROBADA`
> y `RECHAZADA` no son el mismo dato con distinto signo. Se agrega al núcleo en vez de declararse
> en su subdominio, que es la regla del índice.
| **Publicación** | `DRAFT` · `PUBLISHED` · `UNPUBLISHED_BY_BILLING` · `ARCHIVED` |
| **Postulación de Partner** | `PENDIENTE` · `APROBADA` · `RECHAZADA` |
| **Grace** | no es una máquina propia: es el sub-estado `GRACE_PERIOD` de Suscripción, con su reloj |
| **Pausa** | no es una máquina propia: es el sub-estado `PAUSED` de Suscripción, **con un motivo obligatorio** |

**`PAUSED` lleva motivo, y no es un detalle de implementación.** `DEC-GRANT-004` lo fija:
en el proveedor una cortesía y una pausa pedida por el cliente **se ven idénticas**, así que la
intención vive en nuestro lado o no existe. El motivo es un valor cerrado —`CUSTOMER_REQUEST`
o `COURTESY`— y **el reloj que reanuda lee el motivo, nunca el estado del proveedor**.

**`PRE_TRIAL` es un estado real**, no la ausencia de uno: es donde vive quien entró a la
vertical y todavía no publicó, con borradores ilimitados, sin capacidades comerciales y sin
consumir trial (`DEC-TRIAL-007`).

**Real no quiere decir con fila.** Una fila en `PRE_TRIAL` no llevaría **ni un dato** que su
ausencia no lleve: el hash del correo normalizado, el piso del trinquete, la referencia al plan y
las dos fechas se escriben **todos** en `T1` (cap. 02 §2.2, épica de verticales). Lo que hace real
a `PRE_TRIAL` son sus reglas y **sus transiciones de salida —tres: `T1`, `T6` y `T7`** (`V/03`
§2)—, y todas existen sin fila.

**`CANCEL_SCHEDULED` existe aunque el proveedor ya esté cancelado.** `DEC-SUB-009` decidió
cancelar en el proveedor de inmediato y sostener el servicio de nuestro lado hasta el fin del
período pagado: durante esa ventana la suscripción no está ni `ACTIVE` ni `CANCELLED`, y la
fecha de fin de servicio **es un dato nuestro**, no del proveedor.

### 2.3 Dos reglas sobre los nombres

1. **Un estado se llama igual en toda la spec, en la base y en la API.** No hay mapa de
   traducción entre capas. Si hiciera falta uno, es señal de que hay dos vocabularios y
   entonces hay un defecto de diseño, no un problema de nombres.
2. **El vocabulario es cerrado y la base lo restringe.** El §63 pide máquinas explícitas; una
   columna que acepte cualquier cadena no tiene máquina, tiene una convención. El capítulo 02
   fija que cada columna de estado lleva su restricción de dominio.

### 2.4 «Vivo» nombra cuatro conjuntos, y nunca el mismo

La palabra decidía tres cosas caras —el candado del §11, el disparo de `S17` y la condición de
`T6`— y **este capítulo no la definía**, contra su propia regla de que *«todo lo que el resto de
la spec use tiene que estar acá»*. Los dos primeros conjuntos que nombraba difieren en **la mitad
de sus seis estados**, y el último consumidor que la usó eligió el equivocado. Acá se separan, y
cada uno tiene un nombre propio que ya no se puede confundir con los otros.

| término | qué es | dónde se enumera | para qué existe |
|---|---|---|---|
| **fila viva** | una fila —de suscripción o de instancia de addon— que **todavía tiene una autorización de cobro que puede cobrar** | **son dos enumeraciones, una por sujeto.** De la **suscripción**, los **seis**: `PENDING_AUTHORIZATION`, `ACTIVE`, `GRACE_PERIOD`, `PAUSED`, `SUSPENDED`, `CANCEL_SCHEDULED` (cap. 02 (épica de billing) §2.2). De la **instancia de addon**, los **dos**: `PENDING_AUTHORIZATION` y `ACTIVE` (cap. 03 (billing) §8) | el candado del §11: impedir un segundo `INSERT` sobre una autorización que sigue pudiendo cobrar |
| **fuente viva** | una fuente que el contrato de cobertura **devuelve hoy** en `fuentes` | la lista de esa respuesta, resuelta en el momento ([`12-contrato-de-cobertura.md`](../12-contrato-de-cobertura.md) §2) | resolver la cobertura y las capacidades: los pasos 5 y 6 de la autorización |
| **grant vivo** | un `permanent_grant` **que todavía no fue revocado** | **no se enumera con estados: es una columna.** `revocado_en` **nulo** (cap. 02 (billing) §2.4). No hay máquina de estados del grant y no hay más valores que esos dos | contestar **después del acto** si la concesión sigue en pie: los tres backstops de abajo, que corren en el barrido diario y no en el instante de revocar |
| **ancla viva** | una fila de `permanent_grant_vertical` **cuyo grant está vivo** | **no tiene enumeración propia**: el ancla no lleva estado, así que se deriva **entera** del grant (cap. 02 (billing) §2.4) | preguntar por **una vertical concreta**, que es lo que el grant solo no contesta: el título es por vertical |

**Los dos últimos llegaron tarde y por el mismo camino que el resto de este §**: tres predicados
los usaban —la tercera y la cuarta comprobación del barrido y la tercera mitad de la orfandad— y
**el modelo no tenía dónde escribirlos**, así que los tres eran inevaluables. Es la misma forma de
defecto que `S19`: el término estaba en uso, no estaba definido, y su ausencia no la devolvía
ninguna búsqueda **porque el lugar donde faltaba no lo nombraba**. La columna la agrega el cap. 02
(billing) §2.4 y la razón entera está ahí.

> **«Grant vivo» y «ancla viva» son UN conjunto y su proyección, no dos independientes.** Revocar
> es **una** escritura sobre el instrumento y las N anclas dejan de ser vivas **a la vez**; no
> existe un ancla viva de un grant revocado ni un grant vivo sin anclas vivas. Se separan por el
> **sujeto del predicado**, exactamente como las dos enumeraciones de *«fila viva»*: el que
> pregunta por una vertical dice *«ancla viva»*, el que pregunta por el instrumento dice
> *«grant vivo»*.

**Los tres que quedan afuera de la primera lo están por la razón que le da su nombre**:
`ABANDONED`, `CANCELLED` y `CHARGE_DECLINED` **no tienen autorización que pueda cobrar** — `S3`
canceló el preapproval, la suscripción terminó, o el proveedor la canceló de forma terminal.

**Y en la instancia de addon quedan afuera otros tres, por lo mismo**: `ABANDONED`, `EXPIRED` y
`CANCELLED`. **La segunda enumeración se escribió cuando un consumidor la necesitó**, y la
necesitó caro: el `desde` de `A5` decía `ACTIVE` y nada más, así que una instancia que autorizaba
**después** de que su título murió nacía con su preapproval cobrando y ninguna transición la
alcanzaba (cap. 03 (billing) §8). La definición de arriba **ya nombraba los dos sujetos** y sólo
enumeraba uno; el que faltaba es el que se coló. **Las dos enumeraciones no se mezclan**: cuál
aplica lo decide el sujeto del predicado, y todos los del inventario de abajo lo nombran.

#### El inventario de consumidores de «fila viva»

**Esta lista es el control, no un registro.** Es lo único del corpus que convierte *«fila viva»*
de un término en algo verificable, y **quedó corta en el mismo commit que creó su sexto miembro**
—`S19`, que escribió el predicado **sin el adjetivo** y con eso congeló para siempre la fila de
todo cliente que alguna vez abandonó un cambio de plan—. Por eso se mantiene entera y **la
verifica un guard** (`G-R1-E`, `B/20` §2), no la memoria del que escribe.

Todos están del lado de billing y sobre filas de billing, que es la regla 1 de abajo. Se parten en
dos grupos porque **fallan distinto**:

**A · Preguntan «¿ESTA fila es viva?».** El error posible es enumerar mal el conjunto, y se
detecta comparando contra los seis.

| # | quién | dónde | qué pregunta |
|---|---|---|---|
| 1 | el **alcance de `S13`** | cap. 03 (billing) §3.2 | *«toda fila viva **principal** del beneficiario en cada vertical que el acto ancla»* — el adjetivo *«principal»* es parte del predicado: sin él entraban también las **suscripciones de complemento**, que son filas vivas del beneficiario en esa vertical, y el grant cancelaba los addons pagados |
| 2 | el **`desde` de `S17`** | cap. 03 (billing) §3.2 | *«la predecesora, si sigue siendo fila viva»* — las cinco alcanzables |
| 3 | la **condición de cierre de `S18`** | cap. 03 (billing) §3.2 | *«la predecesora ya no es fila viva»* |
| 4 | el **`desde` de `S18`** | cap. 03 (billing) §3.2 | la **sucesora viva**: `ACTIVE`, o `PENDING_AUTHORIZATION` si la predecesora murió sola |
| 5 | la **primera mitad del addon huérfano** | cap. 16 (billing) §4.2 | *«la suscripción de esa vertical dejó de ser fila viva»* |
| 6 | la **condición 3 del pago tardío** | cap. 05 (billing) §3 | *«no hay otra fila viva principal del mismo `user + vertical`»* — las seis, `PENDING_AUTHORIZATION` incluido |
| 17 | la **tercera comprobación del barrido** | cap. 09 (billing) §3 | *«un beneficiario con un ancla viva en la vertical V no debería tener una fila viva **principal** en V, **ni una fila viva DE COMPLEMENTO de un addon compatible con V** si el grant lleva `includesAddons: true`»* — el detector de la ejecución parcial de `S13` **y de `S20`**, que corren en el mismo acto. Las dos mitades enumeran **los seis**: las dos filas son suscripciones. **Y el *«ancla viva»* de su predicado es el OTRO término**, con su propio inventario (más abajo): este comentario enumeraba los dos *«vivos»* que sabía nombrar y dejaba el tercero pasar dentro de la misma frase |
| 18 | el **`desde` de `A5`** | cap. 03 (billing) §8 | *«toda instancia con una autorización que puede cobrar»* — es el **único consumidor cuyo sujeto es SÓLO una instancia de addon** —el 19 la nombra también, pero junto con una suscripción—, así que su enumeración es la de **dos**, no la de seis. Decía `ACTIVE` y nada más, y la mitad que faltaba —`PENDING_AUTHORIZATION`— es la ventana de 72 h por la que un complemento nacía cobrando sobre un título ya muerto |
| 19 | el **alcance de `S20`** | cap. 03 (billing) §3.2 | *«toda fila viva **DE COMPLEMENTO** del beneficiario … cuya instancia esté en uno de sus dos estados vivos»* — es el **único consumidor con dos sujetos a la vez**: enumera **los seis** para la suscripción de complemento y **los dos** para la instancia, y ninguna de las dos enumeraciones sirve para la otra. Es el reverso exacto del 1: `S13` dice *«principal»* para dejar los complementos afuera, `S20` dice *«de complemento»* para que sean los únicos adentro |
| 20 | el **`desde` de `S21`** | cap. 03 (billing) §3.2 | *«toda fila viva **DE COMPLEMENTO** de la que cuelga una instancia de addon»* — enumera **los seis**, los de la suscripción, y **no enumera** el conjunto de la instancia: la nombra por un **estado terminal concreto**, `CANCELLED`, que es su condición. Por eso el 19 sigue siendo *«el único consumidor con dos sujetos a la vez»*: acá el segundo sujeto no aporta una enumeración de *«fila viva»*, aporta su opuesto. **Y no necesita el adjetivo que el 1 sí necesita**: de una fila principal no cuelga ninguna instancia, así que el conjunto queda partido por el sujeto y no por una acotación |

**B · Preguntan «¿hay OTRA fila viva apuntándola?».** El error posible es **omitir el adjetivo**,
y es el que ya ocurrió: sin él el predicado **no tiene forma de dejar de cumplirse**, porque nada
limpia `sucede_a` cuando la sucesora se muere (`B/02` §2.2, cuarto estado de la relación).

| # | quién | dónde | qué pregunta |
|---|---|---|---|
| 7 | la **condición de `S17`** | cap. 03 (billing) §3.2 | *«tiene una sucesora **viva** con `sucede_a` apuntándola»* |
| 8 | la **condición de `S19`** | cap. 03 (billing) §3.2 | ídem — y es el que entró sin el adjetivo |
| 9 | la **tabla de los cuatro estados de la relación** | cap. 03 (billing) §3.2 | qué candado ocupa cada uno |
| 10 | la **salvedad de la fila `authorized × GRACE_PERIOD·SUSPENDED`** | cap. 03 (billing) §10.1 | si marcar es un falso positivo |
| 11 | la **segunda mitad del addon huérfano** | cap. 16 (billing) §4.2 | *«y no hay una fila viva con `sucede_a` apuntándola»* — el único que lo escribió bien desde el principio |
| 12 | la **segunda mitad de la condición 3** | cap. 05 (billing) §3 | *«una sucesora viva que ya autorizó»* |
| 13 | el **sujeto de la regla de `B/12` §5.3** | cap. 12 (billing) §5.3 | *«la predecesora de una sucesión en curso»* |
| 14 | **`G-R1-D`** | cap. 20 (billing) §2 | el mismo predicado, como guard |
| 15 | la **primera comprobación del barrido** | cap. 09 (billing) §3 | *«la predecesora a la que apunta ya no es fila viva»* |
| 16 | la **partición en cuatro por columna** | cap. 02 (billing) §2.2 | la definición operativa de *«sucesión en curso»* |

**El grupo B es el que hay que mirar dos veces, y hay una razón medida.** Un predicado del grupo A
que se equivoque enumera un conjunto y se compara contra seis nombres; uno del grupo B que se
equivoque **parafrasea** —*«tiene una sucesora con `sucede_a` apuntándola»* dice lo mismo que
*«hay una fila viva con `sucede_a` apuntándola»* menos el adjetivo—, y ninguna búsqueda por el
término lo devuelve, porque el término no está. Lo único que lo encuentra es que este inventario
tenga una fila menos que los consumidores, que es la mitad que `G-R1-E` cuenta.

**El 6 entró después que los primeros, y por la razón exacta que este § existe para nombrar.** Su
enumeración decía *«un estado que dé título»* y listaba **cuatro** —el conjunto de
[`12-contrato-de-cobertura.md`](../12-contrato-de-cobertura.md) §2.6—, cuando el peligro que
vigila es **una autorización que puede cobrar**, que es éste. Los dos conjuntos coincidían hasta
que `PENDING_AUTHORIZATION` dejó de emitir fuente, y desde entonces la diferencia entre ellos era
justamente el estado por el que se colaba un doble cobro.

**Y los dos primeros conjuntos no coinciden, con la distancia contada contra la tabla de diez
filas del `12-contrato…` §2.6.** De las **seis** filas vivas **de la suscripción**, **tres no emiten ninguna fuente**:
`PENDING_AUTHORIZATION`, `SUSPENDED` y `PAUSED` cuando el motivo es `CUSTOMER_REQUEST`. Y la
cuarta discrepancia es de otra forma: `PAUSED` por `COURTESY` **sí** emite, pero con `tipo:
CORTESÍA` y no como suscripción — o sea que `PAUSED` es el único de los seis cuya respuesta **no
la decide el estado**, sino el motivo.

Una fila viva no implica una fuente viva, y una fuente viva no implica una fila viva —un grant
permanente y el piso `BASE` no tienen fila de suscripción ninguna—. **Las dos direcciones
fallan**, así que no hay ninguna lectura en la que una sea el proxy de la otra.

**Y «viva» tampoco es «cubre».** Una fuente viva puede ser de clase `BASE` o `COMPLEMENTO`, y
ninguna de las dos cuenta para `cubierto` (`12-contrato…` §2.4): estar en la lista y contar para
la cobertura son dos preguntas, y la segunda se escribe **nombrando la clase**.

#### El inventario de consumidores de «grant vivo» y «ancla viva»

**Es la misma clase de control que el de arriba y existe por la misma razón medida**: los tres
predicados que preguntan por un grant vivo estaban escritos **antes** de que el término tuviera
columna, y ninguno de los tres figuraba en ninguna lista. Se mantiene entero, con la misma regla:
**quien escribe un consumidor nuevo agrega su fila acá en el mismo acto**, y lo vigila la segunda
mitad de `G-R1-E` (`B/20` §2).

**Se parten por el sujeto del predicado**, que es lo único que decide cuál de los dos nombres va.

**A · Preguntan por una VERTICAL concreta → «ancla viva».**

| # | quién | dónde | qué pregunta |
|---|---|---|---|
| 1 | la **tercera comprobación del barrido** | cap. 09 (billing) §3 | *«si un beneficiario tiene un **ancla viva** en la vertical V y además una fila viva principal suya en V —o una de complemento compatible, con `includesAddons: true`— el fan-out no terminó de correr»* |
| 2 | la **tercera mitad de la condición de orfandad** | cap. 16 (billing) §4.2 | *«ningún grant permanente la releva: no hay en esa vertical **un grant vivo** que valga como título»* — nombra el instrumento y **pregunta por una vertical**, así que el conjunto que evalúa es el del ancla |
| 3 | la **excepción del §2.4 de addons** | cap. 16 (billing) §2.4 | *«un grant permanente vale como título en lugar de la suscripción `ACTIVE`»*, y **vale sólo donde el grant ancló** (§4.2): sin ancla viva en esa vertical no hay título |
| 4 | la **incompatibilidad cortesía × grant** | cap. 14 (billing) §4.3 | *«sobre un grant no se otorga cortesía»* — el predicado es *«hay un **ancla viva** en la vertical de esa suscripción»*, porque lo que lo justifica es que no quede obligación de pago, y sobre un grant **revocado** sí queda |

**B · Preguntan por el INSTRUMENTO → «grant vivo».**

| # | quién | dónde | qué pregunta |
|---|---|---|---|
| 5 | la **segunda mitad de la cuarta comprobación del barrido** | cap. 09 (billing) §3 | *«el ancla que era su título ya no es la de un **grant vivo**»* — el sujeto es la instancia y lo que se lee es el grant al que su ancla pertenece |
| 6 | el **evento de `S13`** | cap. 03 (billing) §3.2 | *«`SUPER_ADMIN` otorga un *Free Forever*, o le ancla una vertical nueva a un **grant vivo***»* — anclarle una vertical a uno revocado no es un acto: no hay instrumento al que agregarle nada |
| 7 | el **evento de `S20`** | cap. 03 (billing) §3.2 | ídem — es el mismo acto, y por eso los dos comparten el evento |
| 8 | la **tercera cláusula del evento de `A5`** | cap. 03 (billing) §8 | *«se revoca el grant del que cuelga el ancla que era su título»* — es **el escritor**, no un lector: es el acto que hace que el grant deje de estar vivo, y por eso figura acá |
| 9 | la **invalidación del caché de entitlements** | cap. 02 (verticales) §2.4 | *«se otorga o se revoca … un grant, o se le ancla una vertical nueva a un **grant vivo***»* — es el único consumidor **fuera de billing**, y llega como evento, no como predicado: verticales no lee la columna (regla 1) |

**Tres reglas de uso, porque la ambigüedad ya costó tres críticos distintos:**

1. **Ninguna regla de la épica de verticales se condiciona sobre una fila viva.** No es una
   preferencia: **no puede**, porque *«el estado exacto de la suscripción no cruza»* (`12-contrato…`
   §4) y lo único que verticales recibe es `cubierto` y `fuentes`. Una condición de verticales
   escrita sobre filas vivas es inejecutable del lado que tiene que evaluarla, y el que la escriba
   va a terminar leyendo `cubierto` —que es **otro conjunto**— sin decirlo.
2. **«Vivo» sin calificar no se usa en un predicado.** En prosa explicativa se entiende solo; en
   la columna *condición* de una tabla de transiciones, en el enunciado de un invariante o en el
   de un guard va **«fila viva»**, **«fuente viva de clase `TÍTULO`»**, **«grant vivo»** o
   **«ancla viva»**, nunca la palabra sola. Lo vigila `G-R4-B` (`V/20` §2) para el primer caso,
   que es el que cruza la frontera. **Los dos últimos nombres llegaron después de la regla, y es
   lo que la regla no alcanzó a impedir**: el evento de `S13` decía *«le ancla una vertical nueva
   a **uno vivo**»* —la palabra sola, sobre un sujeto que este capítulo todavía no definía—, y el
   consumidor 17 de abajo citaba *«un **ancla viva**»* enumerando sólo los dos *«vivos»* que sabía
   nombrar. **La regla se cumplía a medias porque el término no existía**: ningún guard puede
   exigir que se califique con un nombre que el glosario no tiene.
3. **Y tampoco se usa una PARÁFRASIS que lo omita, que es el caso que la regla 2 no contemplaba.**
   `S19` no violó la regla 2 —no usó la palabra suelta—: escribió *«tiene una sucesora con
   `sucede_a` apuntándola»*, que dice lo mismo que el predicado correcto **menos el adjetivo**, y
   con eso se saltó el único control que existía. Así que un predicado que mencione `sucede_a`
   **dice además en qué estado está la fila que lo escribió**, y **quien escribe un consumidor
   nuevo agrega su fila al inventario que le corresponda —el de *«fila viva»* o el de
   *«grant vivo»* / *«ancla viva»*— en el mismo acto**, antes de declarar el cambio aplicado. Lo
   vigila `G-R1-E` (`B/20` §2), en sus dos mitades. **Y desde la FASE 9-bis-4 hay dos inventarios
   más en este capítulo** —el de *«marca abierta»* (§2.5) y el de *«cortesía diferida»* (§2.6)—,
   que **no son de `G-R1-E`**: sus sujetos no son conjuntos *«vivos»* sino un caso abierto y un
   instrumento en espera, y los vigila `G-R1-F`.

**El caso testigo, y son dos en direcciones opuestas.** `T6` se escribió con *«ya hay una
suscripción viva»* leyendo las seis filas vivas, y sobre las tres que no emiten fuente eso
significaba **quemarle a alguien su trial único de por vida sin darle nada a cambio**; leerlo como
`cubierto` —el único conjunto que verticales puede observar— dejaba a `T1` disparando sobre esas
mismas tres, con el desenlace opuesto. **El mismo término, dos consumidores, dos daños
opuestos**, y ninguna de las dos lecturas era arreglable sin nombrar la otra.

### 2.5 «Marca abierta»: el otro término que estaba en uso y no estaba definido

**`requiere_conciliación` dejó de ser una columna y pasó a ser un PREDICADO**, así que entra acá
por la misma razón que los cuatro conjuntos del §2.4: el corpus lo usa en la condición de una
transición, en el enunciado de un invariante y en el de un guard, y **este capítulo no lo
definía**.

| término | qué es | dónde se enumera | para qué existe |
|---|---|---|---|
| **marca abierta** | una fila de `reconciliation_mark` **sin `levantada_en`** | **no se enumera con estados: es una columna anulable.** Abierta o levantada, no hay más valores (cap. 02 (billing) §2.2) | contestar *«¿hay un caso que una persona todavía no resolvió sobre esta fila?»* — y **cuál**, porque la marca lleva su `motivo` |
| **`requiere_conciliación`** | el **predicado derivado** *«esta suscripción tiene **al menos una** marca abierta»* | se evalúa sobre las marcas de la fila; **no hay ninguna columna con ese nombre** | conservar verbatim las frases del corpus que ya decían *«la marca `requiere_conciliación`»*, que siguen siendo exactas |

> **El plural es el punto, y por eso el término es *«abierta»* y no *«puesta»*.** El corpus escribe
> **catorce** motivos distintos sobre el mismo sujeto (cap. 02 (billing) §2.5) y **cinco de ellos
> significan *«hay plata del cliente que devolver»***. Con un booleano, dos casos simultáneos eran
> uno solo y `S15` los apagaba juntos; el que se perdía era el del dinero, porque es el que ninguna
> superficie nombraba. *«Puesta»* describe una casilla; *«abierta»* describe **un caso**, que es lo
> que una persona levanta de a uno.

#### El inventario de consumidores de «marca abierta»

**Misma regla que los dos inventarios del §2.4, y acá la vigila `G-R1-F`** (`B/20` §2) —no
`G-R1-E`, cuyo sujeto son los conjuntos *«vivos»*—: quien escribe un consumidor nuevo agrega su
fila acá **en el mismo acto**. Es el **tercero** de los cuatro inventarios del capítulo. Se parten
por lo que preguntan.

**A · Preguntan «¿hay alguna marca abierta sobre esta fila?» — el predicado `requiere_conciliación`.**

| # | quién | dónde | qué pregunta |
|---|---|---|---|
| 1 | el **`desde` de `S15`** | cap. 03 (billing) §3.2 | *«cualquiera **con una marca abierta**»* |
| 2 | la **prohibición de ser sucedida** | cap. 03 (billing) §3.3 y cap. 02 (billing) §2.2 | *«una fila con una marca abierta no puede ser sucedida»*, cualquiera sea el motivo |
| 3 | la **salvedad 2 del barrido** | cap. 09 (billing) §3 | *«una suscripción terminal con al menos una marca abierta»*, hasta que **las levanten todas** |
| 4 | la **condición 3 del pago tardío**, segunda mitad | cap. 05 (billing) §3 | *«la sucesión quedó trabada **con la marca puesta**»* |

**B · Preguntan por UN motivo concreto.**

| # | quién | dónde | qué pregunta |
|---|---|---|---|
| 5 | **`G-R1-C`** | cap. 20 (billing) §2 | *«un pago pendiente por `S19` sin una marca abierta con motivo `REEMBOLSO_POR_CONFIRMAR`»* — **es el consumidor que el booleano volvía vacuo**: la marca sin motivo pasaba el guard |
| 6 | el **listado accionable** | cap. 19 (billing) §6 | ordena por motivo, pone adelante los **cinco** que devuelven plata y muestra **todos los pagos colgados de la marca con su monto total** y **el default de lo que el sistema propone** (`DEC-RF-003`) |
| 7 | el **escalamiento por reloj** | cap. 09 (billing) §3 | *«si sigue abierta pasado su plazo, escala»* — lee `puesta_en`, **por marca**, así que el plazo puede depender del motivo |
| 8 | la **entrada del §22.1 para el reembolso por confirmar** | cap. 08 (núcleo) §4.3 | *«el monto a devolver, el pago que lo origina y por qué puerta entró»* — es el mismo dato que la marca ahora **guarda**, en vez de vivir sólo en un evento que pasa |
| 9 | **`G-R1-F`** | cap. 20 (billing) §2 | que todo escritor nombre un motivo de la tabla, que ningún levantado sea *«la fila»*, **que un hecho con plata sobre una marca abierta del mismo motivo se cuelgue de ELLA** y **que no se levante una marca con pagos colgados sin resolver** |
| 10 | **`S14`, antes de abrir** | cap. 03 (billing) §3.2 | *«¿esta fila ya tiene una marca abierta con ESTE motivo?»* — si la tiene, **le cuelga el pago en vez de abrir una segunda** (cap. 02 (billing) §2.2) |
| 11 | **`S15`, antes de levantar** | cap. 03 (billing) §3.2 | *«¿le queda a esta marca algún pago colgado sin resolver?»* — es la guarda que impide cerrar el caso con plata adentro |

**Y una regla de uso, que es la regla 2 del §2.4 sobre este sujeto**: en la columna *condición* de
una transición, en un invariante o en un guard **no se escribe *«marcada»* ni *«con la marca
puesta»* a secas** cuando lo que importa es **cuál**. Va *«con una marca abierta»* para el
predicado y **el motivo con su nombre** para el caso. La diferencia ya costó un crítico: `S18`
escribía un motivo que la columna no admitía y **las tres ramas que mueven dinero se apoyaban en
él**.

---

### 2.6 «Cortesía diferida»: la que espera a que la sucesora autorice

**Entra acá por la misma razón que las anteriores**: desde `DEC-GRANT-007` hay un predicado en la
columna *evento* de una transición (`S9`), uno en una comprobación del barrido y uno en un guard,
y los tres preguntan lo mismo.

| término | qué es | dónde se enumera | para qué existe |
|---|---|---|---|
| **cortesía diferida** | un `courtesy_grant` con **`saldo_días` no nulo** y **`saldo_cerrado_en` nulo** | **no se enumera con estados: son dos columnas anulables** (cap. 02 (billing) §2.4). Corriente, diferida o **con el saldo cerrado**, no hay más valores | sostener los días que `SUPER_ADMIN` firmó **entre que la suscripción que pausaban muere y la siguiente autoriza** — sea la **sucesora** de un cambio de plan (`DEC-GRANT-007`) o el **alta nueva** de quien perdió su plan porque se discontinuó su vertical (`DEC-GRANT-010`) |
| **cortesía vigente** | un `courtesy_grant` **no diferido** cuyo `fin` todavía no pasó | el `fin` de la fila, contra hoy | el predicado de siempre: *«¿este beneficiario está en cortesía hoy?»* |

> **Una cortesía diferida NO es una cortesía vigente, y los dos términos conviven a propósito.**
> La diferida **no cubre a nadie hoy** —su suscripción está `CANCELLED` y una `CANCELLED` no emite
> ninguna fuente ([`12-contrato-de-cobertura.md`](../12-contrato-de-cobertura.md) §2.6)—, y la
> vigente sí. Es la misma distinción que el §2.4 hace entre *«fila viva»* y *«fuente viva»*: el
> instrumento existe y no está emitiendo. **Y la fila sigue apuntando a la suscripción que
> pausaba**, que es lo que la mantiene resoluble, con **dos** saltos posibles desde ahí: la
> **sucesora** se alcanza por `sucedida_por` (`DEC-GRANT-007`), y el **alta nueva** de quien perdió
> su plan se alcanza por **el beneficiario y la vertical** de esa misma fila, porque ahí no hubo
> sucesión que declarar (`DEC-GRANT-010`, cap. 02 (billing) §2.4).
>
> **Y el saldo CERRADO no es una tercera clase de cortesía: es la diferida que ya no va a
> volver.** El saldo tiene **dos** cierres —la sucesora que abandona el checkout (`S3`,
> `DEC-GRANT-011`) y el grant que pasa a cubrir esa vertical (`S13`, cap. 14 (billing) §4.3)—, los
> dos escriben `saldo_cerrado_en` y su `motivo_cierre` (cap. 02 (billing) §2.4), y **el término los
> deja afuera a propósito**: si *«cortesía diferida»* siguiera siendo *«saldo no nulo»* a secas,
> los **dos** lugares que leen el término para hacer algo —el segundo disparador de `S9` y la sexta
> comprobación del barrido— seguirían persiguiendo un saldo que ya tuvo desenlace.
> **Se estrecha el término en vez de borrar el `saldo_días`** porque los días cerrados son el
> registro de qué se perdió, y el aviso que se le manda al beneficiario los nombra
> (cap. 19 (billing) §4, fila 18, y en el otro cierre la confirmación del §3.1 de este capítulo).

#### El inventario de consumidores de «cortesía diferida»

**Misma regla y mismo guard que el §2.5** —lo vigila `G-R1-F`, que es el que mira los términos que
no son conjuntos *«vivos»*—: quien escribe un consumidor nuevo agrega su fila acá en el mismo acto.

| # | quién | dónde | qué hace con el término |
|---|---|---|---|
| 1 | la **cuarta escritura de `S18`** | cap. 03 (billing) §3.2 | **es el PRIMER ESCRITOR**: cierra la cortesía sobre la predecesora y le escribe `saldo_días` |
| 2 | el **segundo disparador de `S9`** | cap. 03 (billing) §3.2 | *«una sucesora recién autorizada tiene una cortesía diferida esperándola»* — y es el que **borra** el saldo al re-emitir |
| 3 | la **fila de la cortesía** en el inventario del cierre | cap. 02 (billing) §2.6 | declara que **no se re-apunta**: se difiere |
| 4 | la **sexta comprobación del barrido** | cap. 09 (billing) §3 | *«una cortesía diferida cuya sucesora, o cuyo alta nueva, ya está `ACTIVE`»* — `S9` no corrió, por el segundo disparador o por el tercero |
| 5 | **`G-R1-C`** | cap. 20 (billing) §2 | *«un cierre —o una `S25`— que deja una cortesía vigente sin cerrar y sin `saldo_días`»* |
| 6 | el **cruce cortesía × cambio de plan** | cap. 14 (billing) §4.4 | es el § que lo explica entero, con su población y su riesgo aceptado |
| 7 | el **efecto de `S25`** | cap. 03 (billing) §3.2 | **es el SEGUNDO ESCRITOR**: la pausa que no se puede reanudar sobre un plan que ya no se presta difiere la cortesía en vez de perderla (`DEC-GRANT-010`, cap. 14 (billing) §4.6) |
| 8 | el **tercer disparador de `S9`** | cap. 03 (billing) §3.2 | *«un alta nueva del mismo beneficiario y la misma vertical tiene una cortesía diferida esperándola»* — mismo acto que el 2, distinta forma de llegar a la fila: por beneficiario + vertical, porque ahí no hubo sucesión |
| 9 | el **cierre del saldo**, en `S3` y en `S13` | cap. 03 (billing) §3.2 | **son los DOS únicos que SACAN una fila del término**: la sucesora abandonó el checkout (`DEC-GRANT-011`) o un grant pasó a cubrir esa vertical (`B/14` §4.3), el saldo se cierra y esa cortesía deja de ser diferida |
| 10 | la **superficie de «Mi Suscripción»** | cap. 19 (billing) §3 | es el único consumidor que **no** decide nada con el término: lo **muestra** — *«te quedan N días, que empiezan a correr cuando completes el pago»* (`DEC-GRANT-012`) |

---

## 3. Dónde vive la pausa · cierra `A-SUB-02`

El §26 pide **tres** condiciones simultáneas para pausar: suscripción `ACTIVE`, **billing
mensual**, y *«plan que permita pause»*. El §18 reparte esas condiciones en dos entidades
distintas —el ciclo vive en el billing option, la política en el plan—, así que la pregunta
«¿este cliente puede pausar?» se responde en cada lugar donde alguien se acuerde de hacer las
dos preguntas.

**Se resuelve derivando, no declarando dos veces.** La respuesta a esa pregunta es **una sola
función del núcleo**, y es el único lugar del sistema donde se responde:

```text
puedePausar(suscripción) =
      estado == ACTIVE                                  (§26)
  AND billingOption.ciclo == mensual                    (§26)
  AND versiónDePlan.permitePausa                        (§26 + DEC-ARCH-001)
  AND cuotaDePausaDisponible(user, vertical)            (§26.3 + DEC-SUB-004)
  AND NOT hayUnaCortesíaVigente(suscripción)            (DEC-GRANT-004, caso 2 invertido)
```

Cuatro precisiones, cada una con su fundamento:

1. **El flag vive en la versión de plan, no en el plan.** Quitarle la pausa a un plan tiene
   efecto sobre lo que el cliente puede hacer, y `DEC-ARCH-001` fija que lo que tiene efecto se
   versiona. Nadie pierde la pausa retroactivamente.
2. **La cuota se cuenta por `user + vertical`**, sobrevive a cancelar y volver a suscribirse
   (`DEC-SUB-004`), y se expresa en **meses**: los 120 días del §26.3 son 4 pausas-mes y los
   240 son 8 (`DEC-SUB-010`).

   **Y el tope de UNA pausa no es un número libre.** Tiene que quedar por debajo del día del
   hard delete de la retención —180, cap. 02 §4.1 (épica de verticales)— porque **el reloj de
   inactividad no se detiene durante la pausa**: la ficha baja por `PB2` el primer día y `PB4`
   la archiva el 90. Lo que la salva es que la cobertura vuelva antes del 180, y eso es
   verdadero sólo mientras 120 < 180. Es el invariante `D16` (cap. 04 §3) y lo vigila `G-R5`.
   Los 8 acumulados **no** entran en la cuenta: son hasta tres pausas con una reanudación en el
   medio, y cada reanudación reinicia el reloj (§1.2, hecho 2).
3. **El último término no bloquea, avisa.** `DEC-GRANT-004` permite pausar estando en cortesía
   **avisando que la pierde**, y deja que el cliente elija. O sea: la función responde que sí,
   y la superficie está obligada a mostrar la advertencia antes de confirmar.
4. **La pausa se pide en meses enteros** y empieza cuando el cliente la pide (`DEC-SUB-010`).
   No existe la pausa intra-ciclo: con el mínimo de un mes, la pausa que salía estrictamente
   peor que no pausar no se puede expresar.

---

## 4. El criterio Eje 1 / Eje 2 · cierra `O-ARCH-01` y `S-ARCH-02`

Éste es el hueco que hace verificable al §7, y el de consecuencias más largas.

### 4.1 El problema, exactamente

El §7 exige *«un único motor genérico de billing»* y prohíbe un billing por vertical. El §8
define el **Eje 2** como *«Comportamiento específico de vertical»*, o sea que la variación por
vertical es legítima y esperada.

No hay contradicción formal entre las dos. El problema es que **sin un criterio escrito,
cualquier divergencia futura se justifica a sí misma como Eje 2** — que es literalmente cómo el
§5.2 describe lo que pasó: *«En vez de reutilizar correctamente Alojamientos, aparecieron
caminos separados»*. Una regla que no puede ser violada no es una regla.

### 4.2 El criterio

**El Eje 2 es una lista cerrada. Todo lo que no está en ella es Eje 1 y no admite variante por
vertical.**

Se eligió una lista enumerada y no un principio abstracto por una razón: un principio
—*«lo que hace única a la vertical»*— se puede argumentar en los dos sentidos para casi
cualquier pieza, y entonces no descarta nada. Una lista se puede verificar contra una pieza
concreta con una sola pregunta: *¿está adentro?*

**Agregarle un ítem a la lista es una decisión registrada en `01-decision-log.md`**, no una
configuración más. Es el mismo mecanismo con que `DEC-TRIAL-001` acotó los overrides del plan
de trial, y por el mismo motivo: una lista que crece sin control vuelve decorativo al
principio que la contiene.

### 4.3 La lista, completa

Ocho decisiones, cada una con el § que la habilita:

| # | decisión legítimamente por vertical | fundamento |
|---|---|---|
| 1 | **Qué evento activa el trial** | §10.4 lo exige: *«Partner y cualquier vertical futura sin Listing deberán definir su evento funcional equivalente explícitamente»*. Ya tabulado en `DEC-TRIAL-006`. |
| 2 | **Qué recurso publica**, y si publica alguno | §6 le da ficha a tres verticales y se la niega a Turista; §17.1 le da a Partner Gold una presencia que **no** es una ficha. |
| 3 | **Qué sección aporta a Mi Cuenta** | §45: *«Cada vertical aporta menú/sección adecuada»*. |
| 4 | **Qué claves de entitlement y de limit tienen sentido** en ella | §36.1: un entitlement no debe escapar accidentalmente a otra vertical. |
| 5 | **Qué camino de alta admite**: self-service o administrado | §17.3: *«Partner MUST NOT utilizar onboarding self-service»*. |
| 6 | **Si hereda los beneficios de Turista VIP** | §16: *«puede configurar desde DB si hereda»*. |
| 7 | **Qué métodos de pago admite** | §17.2, y con su advertencia textual: *«No: `if partner -> cash`»*. Es configuración por plan, no una rama por vertical. |
| 8 | **Su página de pricing** | §47: *«Cada vertical: pricing propia»*. |

**Todo lo demás es Eje 1**, y la lista de lo que eso incluye no es corta: el alta y la
autorización de una suscripción, el cambio de plan y de ciclo, la pausa, el grace, la
cancelación, el cobro, el reembolso, los promo codes, las cortesías, los grants, la resolución
de entitlements y limits, la conciliación, la auditoría, el outbox y la retención.

### 4.4 Cómo se verifica

Un criterio que nadie puede comprobar vuelve al punto de partida. Esta lista es comprobable
mecánicamente, y la spec lo pide explícitamente:

**Toda pieza que nombre una vertical y no implemente uno de los ocho ítems es una violación del
§7.** Eso es un guard estático, no una revisión de código — la diferencia importa porque el §3.3
declara que este programa atraviesa varias ventanas de contexto, y un criterio que dependa de
que alguien se acuerde no sobrevive a eso.

El capítulo 20 lo detalla junto con el resto de la estrategia de testing. Lo que queda fijado
acá es la regla: **la lista tiene ocho ítems, y crece sólo por decisión registrada.**

### 4.5 La trampa que este criterio evita a propósito

`DEC-METH-003` dejó anotada una trampa para el criterio de FASE 5, y vale igual acá: una regla
del tipo *«no nombra ninguna vertical en su lógica»* mandaría **todo el Eje 2 a incumplimiento
por definición**, porque el §8 define el Eje 2 justamente como comportamiento específico de
vertical.

Por eso el criterio no es *«no nombrar una vertical»* sino *«nombrarla sólo para uno de los
ocho»*. La diferencia es lo que lo hace aplicable en vez de vacuo.

---

## 5. El mapa conceptual, en una figura

```text
User ──┬── es Turista Free siempre (§14, sin suscripción)
       │
       ├── por cada Vertical:
       │     ├── Trial            (uno de por vida, §10.1)
       │     ├── Suscripción principal  (un compromiso, §11 — hasta dos filas durante una sucesión)
       │     │      ├── ancla a → Versión de plan  (DEC-ARCH-001)
       │     │      ├── y a     → Billing option   (§18)
       │     │      └── cubre   → todas las fichas de esa vertical (§12)
       │     └── Fichas          (varias, una por dueño, §6)
       │
       ├── Suscripciones de complemento (una por addon recurrente, DEC-ADDON-002)
       ├── Cortesías temporales         (§34)
       └── Grant permanente             (§35, con su scope de verticales)

Entitlements y limits efectivos = agregación de:
    versión de plan  +  herencia Turista VIP  +  addons  +  cortesía  +  grant
    (§36: mientras al menos una fuente lo otorgue, sigue activo)
```

---

## Lo que este capítulo NO cierra

- **`M-ARCH-02`** (caché e invalidación) es del capítulo 02: depende del modelo de datos.
- **Las transiciones** entre los estados nombrados en §2.2 son del capítulo 03. Acá están los
  nombres, no las reglas de movimiento.
- **Qué pasa cuando una suscripción principal se va y quedan complementos vivos** es del
  capítulo 16 (`E-ADDON-04`).

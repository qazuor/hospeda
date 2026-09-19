---
title: Master Spec 01 — Glosario y modelo conceptual
linear: HOS-1352
statusSource: linear
created: 2026-09-17
updated: 2026-09-19
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

### 1.6 Capacidades

| término | qué es |
|---|---|
| **Entitlement** | Una capability, booleana o **medida** (`DEC-ENT-001`). Puede venir de plan, herencia de Turista VIP, addon, cortesía o grant (§36); mientras al menos una fuente lo otorgue, sigue activo. |
| **Entitlement medido** | El que tiene costo marginal por uso. Declara **dos** cuotas: la del plan y la del trial, menor (`DEC-ENT-001`). La cuota se resetea **todos los meses**, sea cual sea el ciclo de pago, y lo no usado se pierde (`DEC-ENT-002`). |
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
del dueño, día 180 hard delete de lo eliminable, con dos avisos previos (`DEC-DATA-001`).

### 2.2 Los nombres de estado, completos

Lo que sigue es el diccionario; el capítulo 03 dice qué transiciones existen.

| máquina | estados |
|---|---|
| **Trial** | `PRE_TRIAL` · `TRIAL_ACTIVE` · `TRIAL_CONVERTED` · `TRIAL_EXPIRED` |
| **Suscripción** | `PENDING_AUTHORIZATION` · `ABANDONED` · `ACTIVE` · `GRACE_PERIOD` · `PAUSED` · `SUSPENDED` · `CANCEL_SCHEDULED` · `CANCELLED` · `CHARGE_DECLINED`. **`RECONCILIATION_REQUIRED` no está en la lista porque no es un estado**: es la marca `requiere_conciliación` sobre la fila, que conserva el suyo |
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
a `PRE_TRIAL` son sus reglas y su transición de salida, y las dos existen sin fila.

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

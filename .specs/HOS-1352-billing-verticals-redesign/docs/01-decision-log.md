---
title: Decision Log
linear: HOS-1352
statusSource: linear
created: 2026-09-15
updated: 2026-09-15
status: CURRENT
---

# Decision Log

Registro explícito de las decisiones del programa. **Ninguna decisión vive en otro lado**:
ni en un comentario de código, ni en un mensaje de chat, ni en la memoria de un agente.

Si una decisión se aparta del [PDR](./00-PDR.md), el PDR **no se edita**: se registra acá el
apartamiento y por qué.

## Formato

```
### DEC-<AREA>-<NNN> — <título>
- Fecha · Estado · Decide · Problema · Alternativas · Decisión · Motivo ·
  Implicaciones · Reemplaza a · Origen (ID de 1A)
```

Áreas: `TRIAL` · `SUB` · `BILL` · `MP` · `ENT` · `LIM` · `ADDON` · `PROMO` · `AUTH` ·
`DATA` · `MAIL` · `ADMIN` · `ARCH` · `MIG` · `GRANT` · `LEGAL` · `TEST` · `METH`.

Reglas:

- Una decisión `ACCEPTED` sólo se cambia creando otra que la marque `SUPERSEDED`. No se
  edita el texto de una decisión ya aceptada.
- Toda decisión que cierre un ítem de [`04-open-decisions.md`](./04-open-decisions.md) debe
  actualizar ese documento en el mismo commit.
- Una decisión sobre Mercado Pago no puede tomarse mientras su fila de
  [`06-mp-validation-matrix.md`](./06-mp-validation-matrix.md) diga `UNKNOWN` (PDR §61).

> **36 decisiones tomadas por el owner el 2026-09-15**, en una sesión de cierre de 1A.
> Todas con estado `ACCEPTED` salvo donde se indique.

---

## Metodología

### DEC-METH-001 — Los documentos rectores viven en `.specs/HOS-1352-*`

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el PDR pide guardar el documento rector en el repo, sin decir dónde.
- **Alternativas**: (1) `.specs/` con issue paraguas en Linear; (2) `docs/billing-redesign/`.
- **Decisión**: (1).
- **Motivo**: respeta la convención del repo, el macro-estado queda en Linear, y cada épica
  de FASE 3 puede nacer como sub-issue con su propia carpeta.
- **Origen**: FASE 0.

### DEC-METH-002 — Issue paraguas nuevo, no se reusa HOS-1257

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: existía HOS-1257 (paridad de billing) más ~20 issues puntuales de billing.
- **Decisión**: se creó **HOS-1352** como paraguas.
- **Motivo**: HOS-1257 tiene su propio alcance; colgar un rediseño integral de un issue de
  paridad confunde ambos.
- **Implicaciones**: qué issues abiertos quedan absorbidos se clasifica en **FASE 5**.
- **Origen**: FASE 0.

### DEC-METH-003 — Conteos de DB permitidos en FASE 0, sin mirar código

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §67 prohíbe 1B antes de cerrar 1A, pero decisiones de 1A dependen de cuántos
  clientes reales existen.
- **Decisión**: se permiten conteos read-only. Nada de leer código ni comportamiento.
- **Motivo**: son restricciones de realidad, no arquitectura legacy.
- **Implicaciones**: resultados en [`07-facts-inventory.md`](./07-facts-inventory.md), con
  fecha y caducidad explícita.
- **Origen**: `O-METH-01`.

### DEC-METH-004 — No hay criterio fijo para KEEP vs REWRITE: se decide caso por caso

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §2 dice que la carga de la prueba está del lado de conservar, pero sin un
  criterio escrito cada agente lo interpreta distinto y FASE 5 produce clasificaciones
  incomparables.
- **Alternativas**: (1) criterio de 4 puntos verificables; (2) el mismo con cobertura de
  mutación exigida; (3) sin criterio fijo, caso por caso argumentado.
- **Decisión**: (3).
- **Motivo**: decisión del owner. Prioriza flexibilidad ante casos que un criterio rígido
  clasificaría mal.
- **Implicaciones**: **cada clasificación de FASE 5 debe venir con su argumento escrito**, o
  la decisión es irreproducible. El riesgo declarado en `O-METH-02` sigue vigente: dos
  agentes pueden clasificar la misma pieza al revés. Conviene revisar esta decisión al
  empezar FASE 5, con las piezas concretas a la vista.
- **Origen**: `O-METH-02`.

---

## Arquitectura y catálogo

### DEC-ARCH-001 — Planes híbridos: se versiona lo que tiene efecto

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el PDR nunca define si los planes son mutables o inmutables, y define todo lo
  demás encima de esa pregunta.
- **Alternativas**: (1) híbrido: versionar precio, límites y entitlements; mutar lo
  cosmético; (2) versionado total; (3) mutable con efecto inmediato.
- **Decisión**: (1).
- **Motivo**: el pasado no se reescribe donde importa (dinero y capacidad) y no se versiona
  ruido. Bajar un límite no deja clientes excedidos retroactivamente.
- **Implicaciones**: `billing_plans` (identidad y cosmética, muta) +
  `billing_plan_versions` (inmutable) + `billing_subscriptions.plan_version_id`. Migrar una
  suscripción a una versión nueva es un **acto explícito y auditable**, nunca un efecto
  colateral de editar el plan. Toda lectura de configuración resuelve versión.
- **Origen**: `BD-ARCH-01` (BLOCKING).

### DEC-ARCH-002 — Rank explícito por plan; sólo participan los vendibles

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: "el plan más premium" y "el más básico" (§10.3) no son computables sin un
  orden declarado.
- **Decisión**: cada plan declara un `rank`. La derivación del Trial Plan mira **únicamente**
  los planes activos y públicamente elegibles de esa vertical.
- **Motivo**: un plan retirado, interno o de prueba no puede alterar lo que recibe un trial
  sin que nadie se entere.
- **Implicaciones**: hace falta un flag de "vendible" además de "activo". Dos planes
  vendibles con el mismo rank en la misma vertical es un estado inválido y debe fallar en
  validación, no resolverse por desempate arbitrario.
- **Origen**: `OD-ARCH-01`.

### DEC-ARCH-003 — Un plan retirado se archiva con fecha de fin obligatoria

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: qué pasa con los clientes de un plan que deja de venderse.
- **Decisión**: el plan deja de ofrecerse y **hay que declarar cuándo migran los que quedan**.
  No se puede archivar sin fecha.
- **Motivo**: impide acumular planes fantasma con un cliente cada uno.
- **Implicaciones**: llegada la fecha hay que mover gente que no pidió nada — eso dispara
  `DEC-LEGAL-001` (aviso + derecho a cancelar) y la política de cambio de precio (§29).
  El sistema debe alertar antes de que venza la fecha, no el día.
- **Origen**: `M-ARCH-03`.

---

## Trial

### DEC-TRIAL-001 — Derivación con trinquete: en vivo, pero nunca empeora

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §10.3 pide derivación automática; el ejemplo del PDR sube un límite, pero el
  caso que duele es el que baja.
- **Alternativas**: (1) trinquete; (2) snapshot al iniciar; (3) live literal.
- **Decisión**: (1). Se recalcula, así que un entitlement nuevo en Premium llega solo a los
  trials en curso; pero **nunca por debajo de lo que el trial tenía al arrancar**.
- **Motivo**: cumple el espíritu del §10.3 sin dejar a nadie excedido en pleno trial.
- **Implicaciones**: hay que guardar el piso derivado al iniciar el trial y compararlo en
  cada resolución. Interactúa con `DEC-ARCH-001`: el piso se guarda como referencia a
  versiones, no como copia de valores.
- **Origen**: `BD-TRIAL-01` (BLOCKING).

### DEC-TRIAL-002 — Los overrides del Trial Plan se declaran en DB, por vertical

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §10.5 impone 1 ficha en trial; §10.3 dice heredar *exactamente* los limits de
  Basic. Si Basic permite 3, las dos reglas se contradicen.
- **Decisión**: la derivación aplica después **overrides declarados explícitamente en DB**,
  por vertical. `MAX_LISTINGS = 1` es el primero de esa lista.
- **Motivo**: el apartamiento queda escrito y es configurable sin deploy, en vez de escondido
  en código.
- **Implicaciones**: la derivación deja de ser pura y pasa a ser "derivar + aplicar
  overrides". El conjunto de overrides es finito, declarado y auditable.
- **Origen**: `C-TRIAL-01` (BLOCKING).

### DEC-TRIAL-003 — El trial es configurable por plan; Partner lo tiene apagado

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §17 dice que Partner usa el motor de trial; §17.3 lo hace imposible
  (alta administrada, sin evento de publicación).
- **Decisión**: el motor soporta trial en cualquier vertical; **los planes de Partner lo
  tienen en cero hoy**. Encenderlo mañana es cambiar configuración, no código.
- **Motivo**: mantiene el motor genérico sin casos especiales, y deja la puerta abierta.
- **Implicaciones**: si se enciende, hay que declarar el evento de activación de Partner
  (`partner.approved` es el candidato) — ver `DEC-TRIAL-007`.
- **Origen**: `C-TRIAL-02` (BLOCKING).

### DEC-TRIAL-004 — Identidad: el email normalizado bloquea; el resto observa

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §10.2 dice "misma identidad si podemos detectarlo" sin definir la señal.
- **Decisión**: **sólo el email normalizado** (puntos y `+alias`) niega un trial
  automáticamente. Teléfono, CUIT y dispositivo **se registran y alertan al admin, pero no
  bloquean**.
- **Motivo**: el costo de un falso positivo es negarle el trial a un cliente legítimo (dos
  socios del mismo hotel, una familia) y ese cliente se va sin hablar con nadie.
- **Implicaciones**: guardar señales de identidad con fines de bloqueo tiene implicancias de
  datos personales (Ley 25.326) aunque no se bloquee con ellas; hay que declarar la
  finalidad. Con el trial arrancando al publicar, **no hay tarjeta disponible** como señal en
  ese momento.
- **Origen**: `BD-TRIAL-02` (BLOCKING).

### DEC-TRIAL-005 — Pre-trial: borradores ilimitados, sin entitlements, archivado por inactividad

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el estado entre "entró a la vertical" y "publicó" no existía en el modelo.
- **Decisión**: borradores ilimitados, sin capacidades comerciales, sin consumir trial. Tras
  N meses sin actividad se archivan automáticamente.
- **Motivo**: cero fricción para cargar; el trial arranca cuando hay valor real.
- **Implicaciones**: `N` es configuración. Archivar no es borrar: se rige por
  `DEC-DATA-001`.
- **Origen**: `M-TRIAL-01`.

### DEC-TRIAL-006 — El trial arranca cuando la ficha queda VISIBLE

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: si hay moderación previa, "publicar" puede ser *enviar a revisión* o *quedar
  visible*, y un rechazo posterior consumiría el trial de por vida sin dar valor.
- **Decisión**: el reloj empieza cuando la ficha **efectivamente se ve en el sitio**.
- **Motivo**: disuelve el edge case de raíz — un rechazo no consume trial porque el trial
  nunca arrancó — y no hace falta inventar un mecanismo de devolución ni una excepción al
  §10.2.
- **Implicaciones**: el evento de dominio es `listing.became_visible`, no
  `listing.submitted`. Despublicar después **no** detiene el trial (§10.2 sigue vigente).
- **Origen**: `E-TRIAL-01`, `E-TRIAL-02`.

### DEC-TRIAL-007 — El disparador del trial se declara en DB por vertical

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: Turista no tiene ficha, así que no tiene el evento de §10.4; resolverlo con
  un `if` por vertical contradice el §7 (motor genérico).
- **Decisión**: cada vertical declara su `activation_event` en configuración, de un catálogo
  chico de eventos de dominio que el motor ya emite. Para **Turista es
  `vertical.activated`**: el botón "Empezar" que el §47 ya define en la pricing.

  | vertical | activation_event |
  |---|---|
  | accommodation · gastronomy · experience | `listing.became_visible` |
  | partner | `partner.approved` (trial en 0 hoy) |
  | tourist | `vertical.activated` |

- **Motivo**: cero condiciones especiales en el motor; el evento ya está definido en el PDR;
  y como el trial es irrepetible, consumirlo con un click consciente evita el reclamo de
  "me lo gastaron sin avisar".
- **Implicaciones**: el catálogo de eventos es cerrado y validado; una vertical nueva sin
  evento declarado **no otorga trial** (falla cerrado, no abierto).
- **Origen**: `M-TRIAL-02`.

### DEC-TRIAL-008 — El trial no se pausa; las extensiones no tienen techo

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §26 prohíbe pausar un trial; §34.1 dice que una cortesía lo extiende, sin
  decir hasta cuándo.
- **Decisión**: el trial **no admite pausa**. Promos y cortesías lo extienden **sin tope**.
- **Motivo**: decisión del owner; permite acuerdos comerciales puntuales sin pedirle permiso
  al sistema.
- **Implicaciones**: nadie ve el total acumulado de extensiones a menos que se lo consulte
  explícitamente. **Conviene que el admin muestre los días de trial acumulados por
  usuario/vertical**, aunque no los limite, para que un trial de catorce meses sea visible
  antes de que alguien pregunte.
- **Origen**: `OD-TRIAL-01`.

---

## Suscripción

### DEC-SUB-001 — Cambio de plan: la regla de la industria

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §27 y §28 definen "upgrade inmediato / downgrade a fin de ciclo" asumiendo un
  solo eje, pero Plan y BillingOption son independientes: de seis casos reales, cuatro no
  tenían respuesta.
- **Contexto verificado**: se consultó la documentación de Stripe (2026-09-15), de donde copia
  el resto de la industria. Su comportamiento: cambio de precio con el mismo intervalo se
  prorratea en la próxima factura sin mover la fecha; los downgrades se agendan a fin de
  período con *subscription schedules*; y **el cambio de intervalo es la excepción explícita**
  — se acredita el tiempo no usado, se cobra el precio nuevo de inmediato y el ciclo se
  reinicia.
- **Decisión**: se adopta esa regla.

  | | ciclo ↑ | ciclo = | ciclo ↓ |
  |---|---|---|---|
  | **tier ↑** | inmediato | inmediato | inmediato |
  | **tier =** | inmediato | — | inmediato |
  | **tier ↓** | inmediato | fin de ciclo | inmediato |

  Es decir: **subir de tier es inmediato; bajar de tier espera al fin del ciclo; cualquier
  cambio de ciclo se aplica ya**, compensando los días pagados.
- **Motivo**: es lo que el cliente ya conoce de cualquier otro servicio, y no le cierra la
  puerta a quien quiere pasarse a anual hoy.
- **Implicaciones**: **la compensación se hace en días, no en pesos** — el preapproval nuevo
  arranca con su primer cobro corrido por lo ya pagado. Eso evita prorratear dinero, que es
  lo que MP probablemente no soporta. **Depende de FASE 1C**: si MP no permite correr la
  primera fecha de cobro, el plan B declarado es que el cambio de ciclo espere a la
  renovación.
- **Origen**: `BD-SUB-02` (BLOCKING).

### DEC-SUB-002 — Grace configurable en DB por plan, default 10 días

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §20 y §30 fijan 10 días; §9 dice que toda regla comercial sale de DB.
- **Decisión**: valor en configuración, default 10, **configurable por plan**.
- **Motivo**: respeta §9 sin perder el número que el PDR eligió; un plan caro puede tener más
  aire.
- **Origen**: `C-SUB-01`.

### DEC-SUB-003 — Cambiar de plan en grace está permitido y es el camino de recuperación

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: si se bloquea, el gate impide el propio remedio (es el bug ya reportado en
  HOS-348).
- **Decisión**: se permite. Se intenta el cobro del plan nuevo de inmediato: si entra, vuelve
  a `ACTIVE`; si falla, sigue en grace con el plan anterior y no cambia nada.
- **Motivo**: convierte el cambio de plan en una salida del problema en vez de un muro.
- **Implicaciones**: la transacción debe ser atómica — no puede quedar con el plan nuevo y el
  pago fallido.
- **Origen**: `E-SUB-03`.

### DEC-SUB-004 — La ventana de límites de pausa se cuenta por suscripción

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §26.3 define 3 pausas / 120 días / 240 acumulados en 12 meses móviles, sin
  decir sobre qué se cuenta.
- **Decisión**: por **suscripción**.
- **Motivo**: decisión del owner. Los datos viven en la misma fila y es más simple.
- **Implicaciones**: **cancelar y volver a suscribirse resetea el contador**, así que el
  límite es más débil de lo que el §26.3 sugiere. Es aceptable porque re-suscribirse tiene su
  propio costo para el usuario: pierde el trial y tiene que volver a autorizar el débito.
- **Origen**: `OD-SUB-01`.

---

## Entitlements y limits

### DEC-ENT-001 — El trial da todos los entitlements, con cuota reducida en los medidos

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: heredar *todos* los entitlements de Premium regala sin tope las capacidades
  que cuestan plata por uso (IA, destaques), por vertical y por persona.
- **Decisión**: el trial muestra **todas** las funciones, pero los entitlements de consumo
  tienen un **tope propio de trial**, menor al del plan.
- **Motivo**: demuestra el producto completo y acota el costo.
- **Implicaciones**: requiere el modelo de cuotas de `DEC-ENT-004`. Cada entitlement medido
  declara su cuota de plan y su cuota de trial.
- **Origen**: `R-TRIAL-01`.

### DEC-ENT-002 — La herencia de Turista VIP incluye entitlements y limits, y bloquea la compra

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §16 dice "hereda beneficios" sin precisar qué, ni qué pasa si además paga VIP.
- **Decisión**: hereda **entitlements y limits**. Mientras su plan comercial se lo dé, **no
  puede comprar Turista VIP**: la UI no lo ofrece y la API lo rechaza.
- **Motivo**: nunca cobrarle dos veces lo mismo.
- **Implicaciones**: cuando los limits de turista y los de la vertical se superponen hay que
  declarar cuál gana — se resuelve con la `aggregationStrategy` de `M-ENT-01`. Al perder el
  plan comercial recupera la posibilidad de comprar VIP.
- **Origen**: `A-ENT-01`.

### DEC-ENT-003 — Un VIP previo se cancela de inmediato, sin reembolso, con aviso nuestro antes

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el cliente que ya pagaba Turista VIP y contrata un plan comercial que se lo
  regala queda pagando dos veces.
- **Alternativas**: (1) no renovar, conservando el período pago; (2) cancelar con reembolso
  proporcional; (3) cancelar sin reembolso; (4) pausar.
- **Decisión**: (3) — se cancela en el acto y no se devuelve lo ya pagado, **precedido
  siempre por un correo nuestro** que explique qué pasó.
- **Motivo**: decisión del owner. El beneficio lo sigue teniendo gratis por su plan nuevo.
- **Implicaciones y riesgo declarado**: retener plata de un servicio cancelado
  unilateralmente es discutible bajo la Ley de Defensa del Consumidor. **Hoy el riesgo es
  bajo porque todas las suscripciones vivas son mensuales** (se retiene un mes parcial como
  máximo); el día que exista un VIP anual, el monto retenido puede ser de once meses y
  **esta decisión debe revisarse**. Además, si después cancela el plan comercial, se queda
  sin VIP y sin la suscripción que tenía: no se puede reanudar un preapproval cancelado.
- **Origen**: `A-ENT-01` (b).

### DEC-ENT-004 — Las cuotas de consumo son mensuales, independientes del ciclo de pago

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: si la cuota se reseteara "por período de facturación", un plan anual
  entregaría doce meses de IA el primer día.
- **Decisión**: la cuota se resetea **todos los meses**, sea cual sea el ciclo de pago. Lo no
  usado **se pierde**, no se acumula.
- **Motivo**: evita concentrar el costo de IA en los primeros días de un plan anual.
- **Implicaciones**: hace falta un modelo de consumo con contador, ventana mensual y momento
  de reset. Hay que definir si el reset es el día 1 del mes calendario o en el aniversario
  mensual de la suscripción — **pendiente para FASE 2**.
- **Origen**: `OD-ENT-01`.

### DEC-ENT-005 — El visitante sin login no tiene chat de IA

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §36.2 dice que "guest no es equivalente a turista" sin decir qué tiene el
  guest.
- **Decisión**: el chat **requiere cuenta**.
- **Motivo**: cada consumo de IA queda imputado a alguien, lo que hace posible medir, limitar
  y cortar el abuso; y convierte el chat en un motivo para registrarse.
- **Origen**: `A-ENT-02`.

---

## Addons

### DEC-ADDON-001 — Los addons recurrentes quedan condicionados a FASE 1C

- **Fecha**: 2026-09-15 · **Estado**: **PENDING** (condicionada) · **Decide**: owner
- **Problema**: si un preapproval cubre un solo ítem, cada addon recurrente sería un débito
  separado en el resumen del cliente y una conciliación N:1.
- **Decisión**: **no se decide ahora**. Se resuelve cuando la matriz responda si un
  preapproval puede cubrir más de un ítem o si se puede mutar su monto (filas `AD-1`, `AD-2`).
- **Motivo**: la opción buena para el cliente — cobrarlos junto al plan, como hace la
  industria — depende enteramente de esa respuesta.
- **Implicaciones**: **es la única de las 7 decisiones bloqueantes que sigue abierta.**
  Hasta cerrarla, el diseño asume que todo addon puede ser one-time.
- **Origen**: `BD-MP-04` (BLOCKING).

### DEC-ADDON-002 — Dos ejes: cómo se cobra y cuánto dura

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: "one-time o recurrente" (§38) no distingue "+5 fichas" (se cobra una vez,
  dura siempre) de "boost 7 días" (se cobra una vez, dura una semana).
- **Decisión**: `billingKind` (`ONE_TIME` | `RECURRING`) y `grantDuration`
  (`FIXED_DAYS` | `UNTIL_SUBSCRIPTION_ENDS` | `PERPETUAL`) son columnas separadas.
- **Motivo**: con un solo eje ambos addons caen en la misma caja y se implementan igual.
- **Origen**: `A-ADDON-01`.

### DEC-ADDON-003 — Sólo se compran addons con la suscripción confirmada y activa

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §10.5 prohíbe addons en trial y propone "suscribite y comprá", sin definir el
  momento exacto.
- **Decisión**: el addon se habilita cuando el pago del plan se acredita y la suscripción
  queda `ACTIVE`.
- **Motivo**: impide comprar complementos sobre una suscripción que el usuario nunca autorizó
  en MP y que va a quedar abandonada.
- **Implicaciones**: el checkout no puede ofrecer plan + addon en un solo paso. La compra de
  addons es un segundo momento.
- **Origen**: `C-ADDON-01`.

### DEC-ADDON-004 — El reloj del addon sigue corriendo aunque la ficha no esté publicada

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: un "+20 fotos" sobre una ficha despublicada por suspensión no está huérfano
  pero es inútil.
- **Decisión**: el addon vence cuando vence, publicada la ficha o no.
- **Motivo**: decisión del owner. Una fecha de fin y nada más que calcular.
- **Implicaciones**: un cliente suspendido dos meses pierde dos meses de algo que pagó. **Es
  un reclamo previsible**: conviene que el aviso de suspensión lo diga explícitamente.
- **Origen**: `M-ADDON-01`.

### DEC-ADDON-005 — El addon se pierde con la ficha

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: qué pasa con un addon de scope `LISTING` cuando el dueño borra la ficha.
- **Decisión**: borrar la ficha consume el addon. No se libera ni se reasigna.
- **Motivo**: decisión del owner. La regla más simple, sin estados intermedios.
- **Implicaciones**: borrar una ficha por error le cuesta plata al cliente. **La confirmación
  de borrado debe advertir explícitamente qué addons se pierden y por cuánto**, o el reclamo
  entra por soporte.
- **Origen**: `E-ADDON-01`.

---

## Promos y grants

### DEC-PROMO-001 — Stacking: porcentajes primero, montos fijos después, con piso

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §31 permite promos apilables sin definir el orden, y el orden cambia el
  resultado ($10.000 con 20% + $3.000 da $5.000 o $5.600 según cuál va primero).
- **Decisión**: se aplican primero los porcentuales y después los fijos, siempre. Se declara
  un **piso** por debajo del cual el precio final no baja.
- **Motivo**: orden determinista, y es el que más beneficia al cliente, así que no hay
  sorpresa desagradable en el total.
- **Implicaciones**: el piso debe ser compatible con el mínimo que acepte el provider.
- **Origen**: `A-PROMO-01`.

### DEC-PROMO-002 — Cupo total de canjes más ventana de validez

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §31 sólo define un uso por usuario; un código filtrado sin tope global es una
  pérdida abierta.
- **Decisión**: cada código declara cuántos canjes admite en total y entre qué fechas es
  válido.
- **Motivo**: dos defensas independientes — si se filtra lo corta el cupo, si se olvida lo
  apaga la fecha.
- **Origen**: `M-PROMO-02`.

### DEC-PROMO-003 — El scope "todas las verticales futuras" se permite sin restricción

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: un grant con ese scope otorga acceso a verticales que todavía no existen y
  cuyo costo no se conoce.
- **Decisión**: se permite tal cual lo escribe el PDR, sin vencimiento obligatorio.
- **Motivo**: decisión del owner. Es una herramienta real para un acuerdo fundacional.
- **Implicaciones**: **una vertical nueva nace regalada a esa lista.** Conviene que crear una
  vertical liste explícitamente qué grants la alcanzan automáticamente, para que sea una
  decisión consciente y no un descubrimiento posterior.
- **Origen**: `OD-PROMO-01`.

### DEC-GRANT-001 — Free Forever cancela el cobro de inmediato, sin reembolso

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §35.3 dice "cancelar toda obligación de pago cubierta" sin decir qué pasa con
  el período ya pagado ni con una revocación posterior.
- **Decisión**: se corta el cobro en el acto y no se devuelve lo pago. Si el grant se
  **revoca**, no se puede reanudar el débito viejo: hay que pedirle al cliente que autorice
  uno nuevo, con aviso previo.
- **Motivo**: consistente con `DEC-ENT-003`.
- **Implicaciones**: revocar un Free Forever **no restaura el cobro automáticamente** — deja
  al cliente sin suscripción hasta que autorice. Eso debe ser explícito en la UI del admin al
  revocar, y aplica el mismo riesgo de retención de fondos declarado en `DEC-ENT-003`.
- **Origen**: `M-GRANT-01`.

---

## Autorización

### DEC-AUTH-001 — El rol persiste; el acceso se computa aparte

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §12 dice que el rol no equivale a acceso, pero no dice si se revoca al
  suspender — y si se revocara, se rompe el "Mi Cuenta read-only" que promete el §21.
- **Decisión**: seguís siendo HOST aunque estés suspendido. Lo que se apaga es el acceso, no
  la pertenencia.
- **Motivo**: es lo único que hace posible el §21, y evita que recuperar el servicio implique
  reconstruir roles.
- **Implicaciones**: **queda como invariante del diseño.** Ningún flujo de suspensión,
  cancelación o impago puede tocar roles.
- **Origen**: `A-AUTH-01`.

---

## Datos, legal y facturación

### DEC-LEGAL-001 — Baja online y derecho de revocación entran desde el diseño

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el PDR no menciona ninguno de los dos, y ambos son obligatorios en Argentina
  para cobrar por débito automático.
- **Decisión**: **baja online sin gestiones** (tan simple como el alta) y **revocación dentro
  de los 10 días corridos con devolución total** entran en la Master Spec como requisitos de
  primera clase.
- **Motivo**: son requisitos legales duros, no mejoras de UX.
- **Implicaciones**: el detalle normativo exacto (plazos, textos, formas) se verifica al
  implementar. La revocación con devolución total **requiere poder reembolsar** — se cruza
  con la matriz de MP.
- **Origen**: `M-LEGAL-01`.

### DEC-LEGAL-002 — Comprobante no fiscal hasta ARCA, sin fecha de revisión

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: emitir sólo comprobante no fiscal a consumidores finales tiene consecuencias
  impositivas, y el PDR lo dejaba como detalle de implementación que nadie había firmado.
- **Decisión**: se avanza con comprobante no fiscal. Se revisa cuando entre ARCA, sin fecha
  agendada.
- **Motivo**: decisión consciente del owner, que es lo único que se objetaba.
- **Implicaciones**: "cuando entre ARCA" no es una fecha. El riesgo impositivo queda
  registrado y asumido explícitamente.
- **Origen**: `O-LEGAL-01`.

### DEC-DATA-001 — Retención: oculto del público, visible para el dueño, con dos avisos

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §21 promete que los datos se conservan y se puede volver; §25 hace soft
  delete a los 90 días y borrado a los 180.
- **Decisión**: a los 90 días la ficha sale del sitio pero **el dueño la sigue viendo** y
  puede exportarla o reactivarla. Se avisa **antes de los 90 y antes de los 180**.
- **Motivo**: nadie pierde su contenido sin advertencia previa, que es lo que el §21 promete.
- **Implicaciones**: los dos avisos son correos **transaccionales no suprimibles**. Falta
  definir qué es exactamente "dato operativo eliminable" a los 180 (`M-DATA-01`, FASE 2).
- **Origen**: `C-DATA-01`.

### DEC-BILL-001 — Sólo ARS, precio final con impuestos incluidos

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §9 nombra currencies sin definir política de moneda ni de impuestos.
- **Decisión**: una sola moneda (ARS) y **el número que se muestra es el que se cobra**.
- **Motivo**: el mercado es Argentina y la ley de lealtad comercial exige publicar precio
  final al consumidor.
- **Implicaciones**: el esquema **igual guarda la moneda como campo**, así que agregar otra
  más adelante no es un rediseño.
- **Origen**: `M-MP-01`.

---

## Emails

### DEC-MAIL-001 — Las campañas de recuperación corren en paralelo, sin control de superposición

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: la campaña +1/+5/+15/+30/+60 es por vertical; quien abandona varias recibe
  varias secuencias a la vez.
- **Decisión**: cada vertical manda lo suyo cuando le toca, sin cola ni tope global.
- **Motivo**: decisión del owner. Lo más simple de implementar y de razonar por vertical.
- **Implicaciones**: con cinco verticales, hasta cinco correos el mismo día. **El opt-out
  sigue siendo obligatorio** (`M-MAIL-03`) y la campaña debe cortarse al instante si el
  usuario se suscribe. Hoy el riesgo es teórico: sólo una vertical tiene contenido en
  producción.
- **Origen**: `M-TRIAL-03`.

### DEC-MAIL-002 — Toda acción sobre un preapproval va precedida de un correo nuestro

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema** (hallazgo del owner, 2026-09-15): cuando cancelamos, pausamos o modificamos un
  preapproval, **MercadoPago le manda al cliente su propio correo**, que nosotros no
  escribimos ni controlamos. El cliente recibe "tu suscripción fue cancelada" sin contexto y
  no entiende nada.
- **Decisión**: cualquier operación nuestra sobre un preapproval **debe ir precedida de un
  correo nuestro** que explique qué va a ver y por qué.
- **Motivo**: el correo de MP es inevitable; lo único que controlamos es llegar antes.
- **Implicaciones**: aplica a cancelar (`DEC-ENT-003`, `DEC-GRANT-001`), pausar, cambiar de
  ciclo (`DEC-SUB-001`) y a cualquier cambio de monto. **Es un requisito transversal del
  motor**, no de un flujo. Se agregó como `M-MAIL-04` en el análisis 1A.
- **Origen**: `M-MAIL-04` (nuevo, aportado por el owner).

---

## Migración

### DEC-MIG-001 — Coordinación manual de las cinco relaciones vivas

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: qué hacer con lo que hay en producción cuando llegue el motor nuevo.
- **Contexto medido**: cero pagos registrados, 3 trials con preapproval vivo, 2 cortesías.
- **Decisión**: se los contacta, se los da de alta en el motor nuevo y se cancela el
  preapproval viejo. **Cero código de migración.**
- **Motivo**: no hay historial de pagos que preservar. Es lo que el §56 preveía y los números
  lo confirman.
- **Implicaciones**: el diseño nuevo **no carga con compatibilidad hacia atrás**. Aplica
  `DEC-MAIL-002`: los cinco reciben aviso nuestro antes de que MP les escriba. **El primer
  trial vence el 2026-09-26**: si el rediseño no está listo para entonces, esa fecha se
  atiende con el motor actual.
- **Origen**: `BD-MIG-01` (BLOCKING).

---

## Resumen

| | Cantidad |
|---|---|
| Decisiones tomadas | **39** (3 de metodología en FASE 0 + 36 del owner) |
| Bloqueantes cerradas | 6 de 7 |
| Bloqueantes abiertas | **1** — `DEC-ADDON-001`, condicionada a FASE 1C |
| Dependientes de MP, sin decidir | 3 — `BD-MP-01`, `BD-MP-02`, `BD-MP-03` |

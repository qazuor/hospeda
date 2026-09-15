---
title: FASE 1A — Análisis crítico del dominio
linear: HOS-1352
statusSource: linear
created: 2026-09-15
status: CURRENT
phase: 1A
---

# FASE 1A — Análisis crítico del dominio

**Entregado**: 2026-09-15 · **Estado**: esperando respuestas del owner ·
**Bloquea**: FASE 1B (por orden explícito del PDR §67) y FASE 2 (por las 7 decisiones estructurales).

## Cómo se produjo esto

Análisis del [PDR](./00-PDR.md) **sin mirar el código existente**, según §67.
No se consultó la implementación actual, ni memoria de sesiones previas, ni documentación
de billing del repo. Lo único que se miró del sistema vivo son conteos de DB
([`07-facts-inventory.md`](./07-facts-inventory.md)), autorizados por el owner porque varias
decisiones de esta fase dependen de cuántos clientes reales hay — son restricciones de
realidad, no diseño.

Todo lo que sigue es una lectura del PDR contra sí mismo. Donde el PDR no dice, **no se
completó el hueco**: se marcó.

## Nomenclatura

| Prefijo | Significado |
|---|---|
| `BD-` | **BLOCKING DECISION** — frena FASE 2 |
| `OD-` | OPEN DECISION — hay que decidirla, no frena |
| `C-` | Contradicción interna del PDR |
| `A-` | Ambigüedad |
| `E-` | Edge case sin regla |
| `R-` | Riesgo |
| `M-` | Requisito faltante |
| `O-` | Objeción |
| `S-` | Mejora sugerida |
| `MP-` | `PENDING MP VALIDATION` |

Los IDs son **estables**: se pueden citar por número en la respuesta del owner y en el
[Decision Log](./01-decision-log.md).

---

## 1. Modelo de planes y configuración

Es el eje más estructural del documento y el que menos definido está.

### BD-ARCH-01 — ¿Los planes son mutables, o versionados e inmutables?

El PDR construye todo encima de esta pregunta y nunca la formula. Si mañana Basic pasa de 20
a 25 fotos, ¿las subscriptions vigentes ven 25, o siguen viendo el plan con el que contrataron?

Consecuencias de cada rama:

- **Mutables**: esquema simple (`plan` + `subscription.plan_id`), pero el pasado se reescribe.
  Una auditoría de por qué un cliente tenía 20 fotos en marzo se vuelve imposible, y bajar un
  límite deja clientes excedidos retroactivamente.
- **Versionados**: `plan_version` + `subscription.plan_version_id`. Auditable y seguro, pero
  toda lectura de configuración pasa por una resolución de versión, y hay que decidir qué
  dispara una versión nueva (¿el precio? ¿un límite? ¿el copy?).

Toca: esquema de DB, derivación del Trial Plan (§10.3), enforcement de limits (§28.1),
cambios de precio (§29), cacheo, auditoría (§49). **No se puede escribir la Master Spec sin
esta respuesta.**

### C-ARCH-01 — "TODA la configuración en DB" (§9) es inaplicable tal como está escrito

El código va a referenciar claves de entitlement (`AI_CHAT`), claves de limit (`MAX_PHOTOS`) y
verticales como literales: **no hay forma de evaluar un gate sin nombrar la capacidad que
gatea**, y los tipos de TypeScript necesitan la lista de verticales para que el compilador
sirva de algo.

Lo que sí puede vivir 100% en DB es la **asignación**: qué plan otorga qué clave, con qué
valor, en qué vertical, a qué precio, con qué schedule.

Sin acotar el principio, se va a violar en silencio — que es exactamente cómo se llegó a la
situación actual.

→ **S-ARCH-01**: separar explícitamente **catálogo de claves** (código, con un guard de CI que
falle si una clave usada no existe en DB o si una clave de DB no existe en el catálogo) de
**configuración comercial** (DB exclusivamente, sin excepción). El invariante §64.15 pasa a
leerse "toda configuración comercial viene de DB; el catálogo de claves es código verificado
contra DB".

### M-ARCH-01 — Falta estrategia de lectura, cacheo e invalidación

Si cada request evalúa entitlements y limits contra DB, el costo es real. El diseño tiene que
decir qué se cachea, con qué TTL, y qué lo invalida: cambio de plan, webhook, grant, addon,
cron, cambio de configuración. El PDR no lo menciona y es una fuente conocida de
inconsistencias (un entitlement que sigue vivo después de revocado es un bug de seguridad,
no de performance).

### M-ARCH-02 — Falta un glosario canónico de estados y nombres

El PDR usa `SUSPENDED` para dos cosas que se comportan distinto: trial vencido (§10.6) y falta
de pago (§20). Difieren en emails, campaña de recuperación y retención. §63 pide máquinas de
estado; hace falta además un diccionario único de nombres **antes** de escribir la Master Spec,
o cada épica va a inventar los suyos.

### OD-ARCH-01 — ¿Existe jerarquía explícita entre planes?

La derivación del Trial Plan (§10.3) exige saber cuál es "el más premium" y cuál "el más
básico". Eso no es computable sin un `rank` explícito por plan. Y hay que decidir qué planes
participan: ¿sólo los activos y públicamente elegibles?, ¿un plan legacy entra?, ¿un plan
interno de prueba?, ¿qué pasa si dos comparten rank?

### M-ARCH-03 — Falta decir qué pasa cuando un plan se retira del catálogo

Un plan que deja de venderse pero que 30 clientes siguen pagando: ¿se archiva?, ¿se migra?,
¿sigue renovando indefinidamente? Relacionado con `BD-ARCH-01` pero no idéntico.

---

## 2. Trial

### C-TRIAL-01 — §10.3 contra §10.5: dos fuentes para el mismo límite

El Trial Plan debe heredar **exactamente** los limits del plan comercial más básico (§10.3),
pero §10.5 impone **máximo una ficha**. Si Basic permite 3, la derivación produce 3 y la regla
dura dice 1.

O la derivación admite overrides — y entonces no es pura, y hay que decir cuáles y dónde
viven — o el "1" es una regla aparte que se aplica encima. Además el "1" está escrito como
constante en el PDR, lo que choca con §9: debería ser configurable por vertical.

### BD-TRIAL-01 — ¿La derivación del Trial Plan es "live" o "snapshot"?

§10.3 pide que el trial siga automáticamente a Premium y Basic, con el ejemplo de subir de 20
a 25 fotos. El ejemplo elegido sube; el caso que duele es el que baja. Si Basic pasa de 25 a
20 y hay un trial en curso con 23 fotos cargadas, ese usuario queda excedido en pleno trial y
dispara enforcement (§28.1) sin haber hecho nada.

- **Live** es lo que pide el texto literalmente.
- **Snapshot al iniciar el trial** es lo que protege al usuario y lo que hace el resto de la
  industria.

Choca con `BD-ARCH-01`: si los planes son versionados, "live" ya no significa lo mismo.

### R-TRIAL-01 — Regalar *todos* los entitlements de Premium es un riesgo económico

Si Premium incluye capacidades con costo marginal real — chat con IA, importación por IA,
destaques que compiten por inventario finito — el trial las regala sin tope, por vertical, a
cualquiera que publique una ficha. Con cinco verticales, un mismo usuario puede abrir cinco
trials y consumir cinco veces.

→ **S-TRIAL-01**: flag `availableInTrial` por entitlement, y/o cuota de consumo específica de
trial para los entitlements medidos.

### M-TRIAL-01 — Falta el estado "pre-trial"

El trial arranca al publicar (§10.4). El PDR no define qué puede hacer el usuario que entró a
la vertical y **todavía no publicó**: cuántos drafts puede crear, por cuánto tiempo, si puede
editarlos indefinidamente, si tiene algún entitlement, si se le vence algo.

Es un estado real y alcanzable, es donde va a estar mucha gente, y hoy no existe en el modelo.
Sin regla, alguien puede tener 50 borradores para siempre sin consumir nada.

### E-TRIAL-01 — "Publicar" no es un evento atómico

Si hay moderación previa, "publicar" puede significar *enviar a revisión* o *quedar visible*.
Y si la ficha es rechazada **después** de publicada, el usuario consumió su único trial de por
vida sin haber recibido valor. §10.2 dice que el trial no se resetea nunca, sin excepciones.

Hay que decidir explícitamente: cuál es el evento canónico, y si el rechazo por moderación es
una excepción (y quién la autoriza, y cómo se audita).

### E-TRIAL-02 — Publicar y despublicar a los cinco minutos

Por §10.2 el trial sigue corriendo. Conviene decirlo explícito en la spec: es la primera
pregunta que va a hacer un usuario molesto, y la primera que va a intentar responder un agente
sin regla escrita.

### BD-TRIAL-02 — "Volver a registrarse sobre la misma identidad si podemos detectarlo"

§10.2 esconde una decisión entera en un condicional. ¿Qué señal define identidad?

| Señal | Falso positivo típico |
|---|---|
| Email normalizado (`a.b+x@gmail`) | ninguno grave |
| Teléfono verificado | familia, oficina compartida |
| CUIT | dos emprendimientos del mismo titular |
| Payer de MP / tarjeta | matrimonio, socios, contador que paga por varios |
| Device / fingerprint | locutorio, misma casa, misma oficina |

El costo de un falso positivo es **negarle el trial a un cliente legítimo**, y el de un falso
negativo es regalar un trial de más. Además las señales de identidad son datos personales
(Ley 25.326): guardarlas para bloquear tiene implicancias.

### C-TRIAL-02 — ¿Partner tiene trial?

§17 dice que Partner usa el mismo motor "de trial, plans, billing, subscriptions…".
§17.3 dice que Partner **no es self-service**: entra por postulación aprobada por admin o por
alta directa, y el admin configura el plan y el método de pago.

Un trial automático disparado por un evento del usuario no encaja en un alta administrada.
Además Partner no tiene listing estándar (§17.1), así que tampoco tiene el evento de §10.4.
Está escrito como que sí tiene trial y descrito como que no puede tenerlo.

### M-TRIAL-02 — Turista no tiene evento de inicio de trial

Turista no tiene ficha, así que §10.4 no aplica. Si Turista VIP tiene trial, falta su
disparador (¿al intentar usar una capacidad VIP?, ¿al entrar a la pricing?). Si no lo tiene,
hay que decirlo, porque §64.1 habla de trial "por user + vertical" sin excluir ninguna.

### M-TRIAL-03 — Falta política anti-spam de la campaña de recuperación

§10.7 define +1/+5/+15/+30/+60 **por vertical**. Un usuario que abandona dos verticales recibe
dos campañas superpuestas; con cinco verticales, hasta 25 correos de recuperación.

Falta: opt-out (obligatorio para comunicaciones comerciales), tope de correos por usuario por
día, supresión inmediata al suscribirse, supresión por rebote duro, y qué pasa si el usuario
borra la cuenta en el medio.

### OD-TRIAL-01 — Trial, pausa y cortesía

¿Un trial puede pausarse? §26 dice que no. ¿Una cortesía temporal durante trial (§34.1) lo
extiende sin tope? ¿Un trial extendido por promo (§32) más una cortesía se acumulan? ¿Hay un
techo absoluto de días de trial por vertical?

---

## 3. Subscription y máquina de estados

### M-SUB-01 — Faltan estados en el modelo

El PDR nombra `TRIAL_ACTIVE`, `ACTIVE`, `GRACE_PERIOD`, `SUSPENDED`,
`RECONCILIATION_REQUIRED`, más pausa y cancelación programada. Faltan:

- **`NONE`** — el usuario nunca inició esa vertical. Es el estado del 100% de los usuarios al
  registrarse y no está nombrado.
- **`PENDING_AUTHORIZATION`** — Hospeda creó el preapproval y el usuario **todavía no lo
  autorizó** en MP. En el modelo elegido (§5.6) esta ventana **existe siempre**, y es
  exactamente donde se pierde gente. Falta su TTL, su limpieza, qué ve el usuario mientras
  tanto, y qué pasa si vuelve a intentar (ver `M-CONC-01`).
- **`ENDED` / `EXPIRED`** — cancelación ya consumada. Es distinto de suspensión por impago:
  el usuario se fue por decisión propia y la comunicación no puede ser la misma.
- **Distinguir `SUSPENDED_TRIAL_EXPIRED` de `SUSPENDED_PAYMENT_FAILED`** — difieren en emails,
  en campaña de recuperación y en el reloj de retención.

### C-SUB-01 — Grace de 10 días: ¿constante o configurable?

§20 y §30 lo fijan en 10 días. §42.3 habla de "schedule configurable durante 10 días". §9 dice
que toda regla comercial sale de DB. Las tres cosas no pueden ser ciertas a la vez.
Propuesta: valor en DB con default 10, configurable por plan o por vertical.

### A-SUB-01 — ¿La pausa se habilita en el Plan o en el BillingOption?

§26 pide tres condiciones: subscription `ACTIVE`, billing mensual, y "plan que permita pause".
El ciclo vive en el BillingOption (§18) y la política en el Plan. Con dos flags sueltos en dos
entidades, la pregunta "¿este cliente puede pausar?" se responde distinto en cada call site.

→ Relacionado con `S-MP-01`: debería derivarse de capabilities compuestas (plan × billing
option × método de pago), resueltas en un solo lugar.

### E-SUB-01 — Pausa más cancelación programada

El usuario pausa y después cancela. §24 dice que la cancelación se hace efectiva al final del
período ya pagado; §26.4 dice que no se pierden días pagos, con lo cual el fin de período se
corrió hacia adelante. ¿La cancelación espera al fin del período extendido, o corta en la fecha
original? Las dos respuestas son defendibles y producen facturas distintas.

### E-SUB-02 — Pausar estando en GRACE_PERIOD

§26 sólo permite pausar desde `ACTIVE`, así que un usuario con un pago fallido no puede pausar
y se va derecho a suspensión. Probablemente sea lo querido (si no, pausar sería la forma de no
pagar nunca), pero no está dicho y es una queja previsible.

### OD-SUB-01 — Ventana de los límites de pausa

§26.3: 3 pausas, 120 días cada una, 240 acumulados, en 12 meses móviles. ¿La ventana se cuenta
por `user + vertical` o por `subscription`? Si es por subscription, cancelar y re-suscribirse
resetea el contador y el límite no limita nada.

### BD-SUB-02 — ¿Qué es "upgrade" cuando hay dos ejes?

§27 dice upgrade inmediato, §28 downgrade a fin de ciclo. Pero Plan y BillingOption son
independientes (§18), así que un cambio se mueve en dos ejes a la vez:

| | Ciclo ↑ (mensual→anual) | Ciclo = | Ciclo ↓ (anual→mensual) |
|---|---|---|---|
| **Tier ↑** | ? | inmediato | ? |
| **Tier =** | ? | — | ? |
| **Tier ↓** | ? | fin de ciclo | ? |

Cinco celdas sin política. Y hay un caso con precedente conocido de fallar: dos planes de
**distinta vertical al mismo precio** no se pueden ordenar por precio.

Sin la matriz completa la implementación va a improvisar por caso, que es precisamente lo que
produjo la situación actual.

### E-SUB-03 — Upgrade estando en GRACE_PERIOD

Si se permite, hay dos abusos simétricos: upgradear para generar un cobro nuevo que "limpie" el
fallido, o cambiar de plan para esquivar la deuda del ciclo anterior. Hay que decidir si el
cambio de plan exige estar al día.

### M-SUB-02 — Falta una cola de cambios programados

Casos sin regla: downgrade programado seguido de upgrade inmediato; dos downgrades sucesivos;
downgrade programado seguido de cancelación; downgrade programado y luego pausa. Debe existir
a lo sumo **un** cambio programado vigente, con reglas explícitas de reemplazo y cancelación.

### E-SUB-04 — Downgrade programado con cambio de precio en el medio

Si el plan destino cambia de precio entre que se programa el downgrade y que se ejecuta,
¿se aplica el precio vigente al programar o al ejecutar? Y si sube, ¿cuenta como aumento a los
efectos de §29 (notificación y derecho a cancelar)?

### M-SUB-03 — Falta qué pasa cuando una vertical se discontinúa

Con subscriptions activas en ella. Improbable hoy, inevitable en algún momento, y barato de
definir ahora.

---

## 4. Mercado Pago y abstracción de provider

Nada de esta sección es una afirmación sobre MP. Son **hipótesis a comprobar en FASE 1C**;
se listan porque determinan qué alternativas de diseño están disponibles.
Matriz completa en [`06-mp-validation-matrix.md`](./06-mp-validation-matrix.md).

### MP-01 — Ciclos trimestral y semestral (§19)

Verificar qué combinaciones de frecuencia acepta un preapproval, y qué pasa al cambiar de ciclo
sobre uno ya autorizado.

### BD-MP-01 — Mecanismo de pausa

Tres alternativas con consecuencias muy distintas:

1. **Pausa nativa del preapproval** — si existe y si al reanudar respeta el período pagado.
2. **Cancelar y recrear al reanudar** — implica **re-autorización del usuario**: fricción,
   caída, y un agujero donde el cliente simplemente no vuelve.
3. **Mantener activo y compensar con crédito interno** — requiere un modelo de crédito/saldo
   que el PDR no tiene y que arrastra contabilidad propia.

La respuesta define si §26.4 ("no perder días pagos") es siquiera implementable.

### BD-MP-02 — Cortesía temporal durante una subscription (§34.2)

"Mantener servicio sin cobrar" contra un débito automático ya autorizado. Alternativas: bajar
el monto (¿hay piso mínimo?), pausar, cancelar y recrear al final, o cobrar y reembolsar.
Cada una rompe algo distinto: la auditoría, la conciliación, o lo que el cliente ve en el
resumen de su tarjeta.

### BD-MP-03 — Cambios de precio sobre subscriptions vigentes (§29)

Si mutar el monto de un preapproval autorizado no es posible, o exige nueva autorización,
entonces **todo aumento implica re-consentimiento** con su tasa de caída asociada. Eso deja de
ser una decisión técnica y pasa a ser de negocio: define si Hospeda puede actualizar precios
por inflación sin perder la base instalada.

### BD-MP-04 — Addons recurrentes: un preapproval por addon

Si un preapproval cubre un ítem, un usuario con plan más dos addons recurrentes vería **tres
débitos separados** en su resumen, y nosotros tendríamos que conciliar N preapprovals contra
una subscription, con N estados que pueden divergir.

Antes de diseñar addons recurrentes hay que decidir si existen, o si **todo addon es
one-time** y la recurrencia se modela como renovación explícita.

### M-MP-01 — Falta modelo de moneda e impuestos

§9 menciona currencies pero no hay política: ¿un plan puede tener precio en más de una moneda?,
¿qué pasa con el redondeo?, ¿los precios se muestran con IVA incluido?, ¿hay percepciones?
Esto define columnas del esquema de precios, no es presentación.

### S-MP-01 — Modelar capabilities del método de pago, no un provider simétrico

El "provider Manual" (§30) no tiene webhooks, ni pausa, ni prorrateo, ni reembolso automático,
ni conciliación. Tratarlo como un provider más lleva a la sobreabstracción que §57 pide evitar.

Declarar capabilities explícitas — `supportsWebhook`, `supportsPause`, `supportsAmountChange`,
`supportsRefund`, `supportsProration`, `supportsScheduledCancel` — resuelve dos cosas a la vez:
evita la abstracción falsa, y hace que reglas como "sólo mensual se pausa" **deriven de datos**
en vez de ser un `if` que alguien va a olvidar en el quinto call site.

### M-MP-02 — Falta política de checkout pendiente

El usuario hace doble click, o abandona la página de MP y vuelve a intentar media hora después.
¿Se reutiliza el preapproval pendiente?, ¿se cancela y se crea otro?, ¿hay TTL?
Sin regla explícita aparecen preapprovals huérfanos, y en el peor caso dos autorizados.

---

## 5. Entitlements y limits

### M-ENT-01 — Falta `aggregationStrategy` por limit

§37 asume que los limits **suman**: 20 fotos de plan más 30 de addon dan 50. Pero hay limits
donde sumar es directamente incorrecto:

| Limit | Estrategia correcta |
|---|---|
| `MAX_PHOTOS` | SUM |
| `MAX_PHOTO_RESOLUTION` | MAX |
| `FEATURED_DAYS` | SUM o MAX, según el producto |
| `SEARCH_RANK_BOOST` | MAX, nunca SUM |
| `MIN_RESPONSE_TIME_SLA` | MIN |

Cada limit necesita declarar `SUM | MAX | MIN | OVERRIDE`, igual que §28.1 le da
`enforcementStrategy`. Sin esto se va a parchear caso por caso.

### M-ENT-02 — El enforcement no es una feature del downgrade

§28.1 define `enforcementStrategy` sólo en el contexto de downgrade. El mismo mecanismo hace
falta al vencer un addon, al terminar una cortesía, al revocar un grant, al suspender, al
terminar el trial, y — si los planes son mutables (`BD-ARCH-01`) — al cambiar un plan.

Debe ser **un servicio transversal de reconciliación de excedentes**, invocado desde todos
esos puntos, no una rama del flujo de cambio de plan.

### A-ENT-01 — Herencia de Turista VIP (§16): ¿qué se hereda exactamente?

"Hereda beneficios" no dice si son entitlements, limits, o ambos. Y abre tres preguntas que el
PDR no toca:

1. Si un host tiene un plan con herencia y **además** paga Turista VIP por su cuenta: ¿se le
   impide comprarlo?, ¿se le acumula?, ¿se le reembolsa? Cobrarle dos veces por lo mismo es
   un problema de confianza, no de arquitectura.
2. Si su plan de Alojamiento cae en `SUSPENDED`, pierde beneficios VIP que estaba usando **como
   turista**, en una parte del producto que no tiene nada que ver con su impago. ¿Es lo querido?
3. ¿La herencia se evalúa en vivo o se materializa como grants?

### M-ENT-03 — Falta el scope `GLOBAL` para entitlements

Los addons lo tienen (§40), los entitlements no: §36.1 sólo contempla scope de vertical. Pero
un plan de vertical puede otorgar algo genuinamente global — "sin publicidad en el sitio",
"soporte prioritario", "insignia verificada en el perfil". La asimetría va a forzar a
modelarlos como entitlements de vertical que después alguien lee desde otra, que es
precisamente lo que §13 quiere evitar.

### A-ENT-02 — Guest contra Turista en el chat con IA (§36.2)

"Guest no es equivalente a Turista" no dice si el guest tiene chat limitado o no tiene nada.
Afecta al SEO (contenido accesible sin login), al costo de IA (un chat abierto a anónimos es
un grifo) y al abuso.

### OD-ENT-01 — ¿Hay entitlements de consumo, o son todos booleanos?

"AI chat" puede ser un booleano o "N mensajes por mes". Si existen cuotas con reset por período,
hace falta un modelo de consumo — contador, ventana, momento del reset, si sobra se acumula o
se pierde — que el PDR no menciona en ningún lado. Es un subsistema entero, no un campo.

---

## 6. Addons

### A-ADDON-01 — La taxonomía one-time/recurrent (§38) no alcanza

Un addon "+5 fichas" sin duración es permanente mientras exista la subscription: no es one-time
(el efecto dura para siempre) ni recurrente (no se vuelve a cobrar). Hacen falta **dos ejes
separados**:

- `billingKind`: `ONE_TIME` | `RECURRING`
- `grantDuration`: `FIXED_DAYS` | `UNTIL_SUBSCRIPTION_ENDS` | `PERPETUAL`

Con un solo eje, "+5 fichas" y "boost 7 días" terminan en la misma caja y con el mismo código.

### M-ADDON-01 — Falta suspensión (no cancelación) de addons

§41 dice cancelar sólo cuando el addon queda huérfano. Pero un "+20 fotos" sobre una ficha
despublicada por suspensión **no está huérfano** — la ficha existe — y sin embargo es inútil.
El reloj sigue corriendo y el usuario pierde días que pagó.

Falta decidir: ¿se congela el reloj mientras la ficha no está publicada?, ¿se extiende al
reactivar?, ¿se reembolsa?, ¿no se hace nada y se le avisa?

### E-ADDON-01 — Addon con scope LISTING y ficha borrada

¿El addon se libera y puede reasignarse a otra ficha? ¿Se pierde? ¿Puede moverse de ficha por
decisión del usuario, aunque la ficha original exista? Es el caso de soporte más previsible de
todo el sistema de addons y no tiene regla.

### E-ADDON-02 — Free Forever con `includesAddons: true` (§35.2)

El usuario "compra" un addon a $0. ¿Se genera un Payment de monto cero? ¿Se emite comprobante
(§54)? ¿Qué pasa con un addon $0 activo cuando se **revoca** el grant: se corta, se cobra, se
deja correr hasta que venza?

### C-ADDON-01 — Cuándo se habilita la compra de addons

§10.5 prohíbe addons durante trial, y el camino que propone es "suscribirse a Basic y comprar
un addon". Falta el momento exacto: ¿al confirmar el pago, o al crear la subscription pendiente
de autorización? Si es lo segundo, se pueden comprar addons sobre una subscription que nunca
se autoriza (ver `PENDING_AUTHORIZATION` en `M-SUB-01`).

---

## 7. Promos, cortesías y grants

### A-PROMO-01 — `stackable` no define el orden de aplicación

Dos descuentos apilables, uno del 20% y otro de $3.000 fijos, dan resultados distintos según
cuál se aplique primero. Falta una regla determinista de orden y un piso: nunca menos de X,
nunca negativo, y qué pasa si el resultado cae por debajo del mínimo que acepta el provider.

### M-PROMO-01 — Falta qué pasa con una promo activa cuando cambia el plan

Upgrade o downgrade con un descuento de "N cobros" en curso: ¿el descuento se traslada al plan
nuevo, se recalcula sobre el precio nuevo, se pierde? Y con cambio de ciclo: si "3 cobros con
descuento" estaba corriendo en mensual y el usuario pasa a anual, ¿significa tres años?

### E-PROMO-01 — `TRIAL_EXTENSION` aplicado el día del vencimiento

§32 dice que sólo vale durante `TRIAL_ACTIVE`. ¿Qué pasa si el usuario aplica el código el mismo
día que vence, mientras corre el cron de expiración? Es una carrera clásica y necesita una regla
de borde explícita, no una implementación que gane por suerte.

### OD-PROMO-01 — Scope "todas las verticales actuales y futuras"

Aparece en §31, §34 y §35.1. Un grant creado hoy con ese scope otorga automáticamente acceso a
una vertical que todavía no existe, cuyo costo no conocemos y cuyo modelo de negocio puede ser
completamente distinto. ¿Hay tope?, ¿revisión periódica?, ¿vencimiento obligatorio?, ¿se puede
excluir una vertical nueva al crearla?

### M-PROMO-02 — Falta el límite global de uso de un promo code

§31 define máximo un uso por usuario, pero no un cupo total (`maxRedemptions`), ni ventana de
validez, ni corte por presupuesto consumido. Un código filtrado sin cupo es una pérdida abierta.

### M-GRANT-01 — Free Forever y el dinero ya cobrado

§35.3 dice "cancelar toda obligación de pago cubierta". Falta: ¿se reembolsa el período ya
cobrado o se deja correr? ¿Qué pasa exactamente si el grant se **revoca** — vuelve a cobrar
desde cero, con nueva autorización del usuario? ¿El usuario se entera de que le dieron el
grant, y de que se lo sacaron?

---

## 8. Autorización

### M-AUTH-01 — Faltan dos verificaciones en la lista de §13

Además de las ocho enumeradas:

- **Estado de la ficha** — en moderación, rechazada, archivada, soft-deleted. Sin esto el
  modelo autoriza operaciones sobre recursos que no deberían aceptarlas.
- **Estado del usuario** — email no verificado, cuenta suspendida por abuso, baneado. Un
  usuario baneado con subscription activa pasa los ocho checks de §13.

### M-AUTH-02 — Falta el actor administrativo

§48 exige que el admin pueda inspeccionar y operar sobre subscriptions ajenas; el check
"owner" de §13 se lo impide. Hace falta modelar explícitamente la operación administrativa:
quién actúa, en nombre de quién, con qué permiso, y con qué registro de auditoría.

Si queda implícito, cada endpoint va a resolverlo a su manera — y es además un vector de abuso
(un admin comprometido operando sin rastro).

### A-AUTH-01 — ¿Qué pasa con el rol cuando se pierde el acceso?

§12 dice que rol no equivale a acceso activo. Si al suspender se revoca el rol HOST, el usuario
pierde el "Mi Cuenta read-only" que §21 le promete explícitamente.

Propuesta a confirmar: **el rol persiste y el acceso se computa**. Conviene dejarlo escrito
como invariante, porque es exactamente el tipo de regla que un agente futuro va a "optimizar".

### S-AUTH-01 — El scope de vertical debería estar en el tipo, no en el check

§13 advierte sobre la autorización cruzada entre verticales — un usuario con Gastronomía
ejecutando una operación de Alojamiento. Un check en runtime resuelve el caso que alguien se
acordó de escribir; el que se olvidó queda abierto.

La forma de que no vuelva a pasar es que la operación **no se pueda expresar sin vertical**:
firma de servicio que exige un `VerticalContext` obligatorio, más un guard estático en CI que
falle si un servicio de dominio no lo declara. La verificación de runtime queda como segunda
línea, no como única.

---

## 9. Datos, retención y legal

### M-LEGAL-01 — Falta el botón de baja y el derecho de revocación

Para contratación a distancia en Argentina rigen dos cosas que el PDR no menciona en ningún
lado:

- **Derecho de revocación** dentro de los 10 días corridos, sin costo ni justificación.
- **Baja online tan simple como el alta**, accesible sin gestiones telefónicas.

§24 define cancelación al final del período pagado, que no es ninguna de las dos. Son
requisitos duros para cobrar por débito automático, no un detalle de UX, y hay que verificar la
normativa vigente antes de implementar.

### O-LEGAL-01 — "Comprobante no fiscal" es una decisión de riesgo, no un paso neutro

§54 define emitir un comprobante PDF hasta integrar ARCA. Cobrar a consumidores finales sin
emitir comprobante fiscal tiene consecuencias impositivas. No es una objeción al diseño: es
pedir que se registre como **decisión consciente del owner**, con fecha de revisión, en vez de
quedar como detalle de implementación que nadie firmó.

### M-LEGAL-02 — Falta la política de notificación de aumento

§29 dice "avisar, mostrar precio anterior y nuevo, fecha efectiva, permitir cancelación", pero
no el plazo de preaviso, el canal, ni cómo se prueba después que el aviso se envió. Lo último
importa: si un cliente reclama, la evidencia del envío es lo que decide.

### C-DATA-01 — Retención (§25) contra "recuperación posible" (§21)

§21 promete que los datos se conservan y que el usuario puede volver y recuperar el servicio.
§25 hace soft delete a los 90 días y hard delete a los 180.

Falta: ¿el soft delete oculta la ficha también para su dueño, o sólo del público?, ¿se le avisa
antes de cada corte?, ¿puede exportar sus datos antes?

Sin avisos, un cliente que vuelve al día 200 encuentra su contenido borrado sin haber recibido
nunca una advertencia — y el PDR le había prometido lo contrario.

### M-DATA-01 — "Dato operativo eliminable" no está definido

Si la auditoría (§49) guarda snapshots de la ficha, el hard delete no elimina nada. Hace falta
la lista explícita de qué se borra, qué se anonimiza y qué se conserva, y cómo se responde a un
pedido de supresión de datos personales (Ley 25.326), que puede llegar antes de los 180 días.

### R-DATA-01 — La ventana entre +60 y 90 días es silencio total

La campaña de recuperación termina en +60 (§10.7) y el soft delete ocurre a los 90.
Es coherente, pero conviene que el borrado tenga su propio aviso previo, que no es marketing
sino notificación transaccional.

---

## 10. Emails y outbox

### M-MAIL-01 — Toda ventana temporal se computa en `America/Argentina/Buenos_Aires`

Un "-1 día" calculado en UTC se manda el día equivocado para una parte de los destinatarios, y
una ventana de "últimos N días" cuenta mal. Debe ser un **invariante explícito del diseño**,
no una convención que cada job reinventa.

### M-MAIL-02 — Falta idempotencia y deduplicación del envío

El outbox (§44) garantiza que el intento queda registrado, no que sea único. Hace falta una
clave única por `(user, vertical, templateKey, scheduleKey, occurrence)`, para que un job que
corre dos veces — o un retry, o dos instancias — no mande dos veces.

### M-MAIL-03 — Falta jerarquía de supresión

Opt-out, rebote duro, cuenta borrada, tope diario. Y sobre todo: distinguir los correos
**transaccionales no suprimibles** (aviso de aumento, fallo de cobro, vencimiento) de los
**comerciales suprimibles** (recuperación de trial). Mezclarlos es a la vez un problema legal
y de reputación del dominio de envío.

### E-MAIL-01 — Schedules que cambian después de haberse disparado

§10.7 prevé ignorar thresholds mayores a la duración del trial. Falta el caso inverso: el trial
se extiende por promo (§32) o cortesía (§34.1) **después** de haberse enviado el aviso de
"vence en 2 días". ¿Se reprograma la secuencia completa? ¿Se manda una corrección? El usuario
ya recibió un aviso que dejó de ser cierto.

---

## 11. Concurrencia e idempotencia

### M-CONC-01 — Falta clave de idempotencia de negocio en el checkout

§51 nombra "double click" como escenario a cubrir, pero la idempotencia del webhook no lo
resuelve: el doble click ocurre **antes**, del lado nuestro, y produce dos preapprovals.
Hace falta una regla de "un solo intento vivo por user + vertical" con TTL, además de la
idempotencia del lado del provider.

### M-CONC-02 — Falta la regla de no-retroceso de estado

Los webhooks fuera de orden (§51) requieren versionado o timestamp del evento del provider,
más la regla explícita de que un evento viejo **nunca** sobreescribe un estado más nuevo.
§51 lo enuncia como objetivo; falta el mecanismo.

### E-CONC-01 — Casos concretos que la Master Spec debe resolver nominalmente

§52 los enumera en abstracto. En concreto, cada uno necesita una respuesta escrita:

- pago acreditado mientras corre el cron de suspensión;
- cancelación solicitada mientras entra un cobro;
- grant de Free Forever otorgado mientras se ejecuta un cobro;
- addon comprado mientras se aplica un downgrade que reduce su base;
- admin registrando un pago manual mientras el usuario paga por MP (doble cobro real);
- dos webhooks del mismo evento procesados en paralelo por dos instancias.

---

## 12. Admin y observabilidad

### M-ADMIN-01 — §48 sólo pide inspeccionar; falta el catálogo de acciones

Forzar reconciliación, reintentar webhook, registrar o anular un pago manual, otorgar y revocar
grants y cortesías, cancelar, reembolsar, extender un trial, mover un addon de ficha, corregir
un estado. Cada una necesita: permiso propio, registro de auditoría, y confirmación explícita
si es destructiva o mueve dinero.

### R-OBS-01 — Un email a SUPER_ADMIN por cada `RECONCILIATION_REQUIRED` (§22.1)

Un incidente de webhooks genera cientos de correos idénticos y el canal deja de leerse
justo cuando importa. El requisito real es que el SUPER_ADMIN **se entere**, no que reciba un
correo por evento.

→ **S-OBS-01**: dashboard como canal primario con el listado accionable, más un correo agregado
con rate-limit y resumen ("12 casos nuevos en la última hora"), no uno por caso.

### M-OBS-01 — Falta definir el identificador de correlación de punta a punta

§50 lista los campos a loguear, pero no dice quién genera el `correlationId`, ni cómo viaja
desde el click del usuario hasta el webhook que llega tres días después. Sin esa cadena, los
campos están pero no se pueden unir.

---

## 13. Migración y transición

### R-MIG-01 — No se puede detener el cobro de los clientes vigentes durante el rewrite

§2 y §56 hablan de preferir rewrite y de no contaminar la arquitectura nueva por unas pocas
relaciones legacy, pero no de **cómo se convive mientras tanto**. Hay clientes reales con
débitos automáticos activos ([`07-facts-inventory.md`](./07-facts-inventory.md)).

Las opciones son tres y hay que elegir explícitamente: coexistencia de dos motores, corte con
migración asistida, o congelamiento temporal de altas nuevas. Es el riesgo más grande del
programa y el PDR lo deja para FASE 7.

### BD-MIG-01 — ¿Qué se le promete al cliente que hoy paga?

Si la migración es "coordinación manual y nueva subscription" (§56), eso significa pedirle a
un cliente que ya está pagando que **vuelva a autorizar un débito automático**. Algunos no van
a volver.

Es una decisión de negocio, no técnica, y condiciona cuánta compatibilidad hacia atrás
necesita el diseño nuevo — que es justamente lo que §56 quiere evitar cargar.

### M-MIG-01 — Falta criterio de corte para el trial ya consumido

Los usuarios que consumieron trial bajo reglas distintas (otro scope, otra duración, otro
disparador): ¿arrastran el consumo al modelo nuevo, o el contador arranca limpio?
Con el scope nuevo (`user + vertical`) el mapeo no es obvio.

---

## 14. Objeciones a la metodología del propio PDR

### O-METH-01 — El orden 1A → 1B es correcto salvo para los hechos duros

Algunas decisiones de 1A — migración, identidad, alcance del trial — sólo se pueden responder
sabiendo cuántos clientes hay y en qué estado. Por eso el inventario de conteos se hizo en
FASE 0 sin mirar código (acordado con el owner antes de empezar). No cambia el espíritu de
§67: los conteos son restricciones de realidad, no arquitectura.

### O-METH-02 — "La carga de la prueba está del lado de conservar" necesita un criterio escrito

§2 lo enuncia como principio. Sin un criterio operable, cada agente lo va a interpretar
distinto y la FASE 5 va a producir clasificaciones incomparables entre sí.

Criterio propuesto para FASE 5 — se conserva (`KEEP`) **sólo si las cuatro son ciertas**:

1. hay tests que cubren su comportamiento, y esos tests fallan si se lo muta;
2. no nombra `commerce` ni ninguna vertical concreta en su lógica;
3. su interfaz ya habla el dominio nuevo (no hace falta traducir en el borde);
4. no requiere migración de datos para funcionar en el modelo nuevo.

Si falla cualquiera de las cuatro → `REWRITE`. `ADAPT` queda reservado para cuando falla
**sólo** la 3 y el cambio es mecánico.

### S-METH-01 — FASE 1C debería producir sondas versionadas, no sólo conclusiones

Los experimentos contra MP tienen que ser reproducibles por otro agente meses después. Si el
experimento vive sólo en el log, la matriz envejece sin que nadie lo note y volvemos a
discutir lo mismo. Las sondas van versionadas, en `docs/mp-probes/`, marcadas explícitamente
como no-productivas y excluidas de cualquier build.

### S-METH-02 — La matriz MP necesita fecha de caducidad

Un `VERIFIED` de hace seis meses no es `VERIFIED`: MP cambia su API y su comportamiento sin
avisarnos. Cada fila lleva fecha y entorno (sandbox o producción), y se re-verifica antes de
FASE 10. Una fila sin fecha se lee como `UNKNOWN`.

---

## 15. Índice por categoría

Para leer 1A según la estructura que pide el PDR §"Entrega 1A".

**Contradictions**: `C-ARCH-01` · `C-TRIAL-01` · `C-TRIAL-02` · `C-SUB-01` · `C-ADDON-01` · `C-DATA-01`

**Ambiguities**: `A-SUB-01` · `A-ENT-01` · `A-ENT-02` · `A-ADDON-01` · `A-PROMO-01` · `A-AUTH-01`

**Blocking Decisions**: `BD-ARCH-01` · `BD-TRIAL-01` · `BD-TRIAL-02` · `BD-SUB-02` · `BD-MP-01` · `BD-MP-02` · `BD-MP-03` · `BD-MP-04` · `BD-MIG-01`

**Open Decisions**: `OD-ARCH-01` · `OD-TRIAL-01` · `OD-SUB-01` · `OD-ENT-01` · `OD-PROMO-01`

**Edge Cases**: `E-TRIAL-01` · `E-TRIAL-02` · `E-SUB-01` · `E-SUB-02` · `E-SUB-03` · `E-SUB-04` · `E-ADDON-01` · `E-ADDON-02` · `E-PROMO-01` · `E-MAIL-01` · `E-CONC-01`

**Risks**: `R-TRIAL-01` · `R-DATA-01` · `R-OBS-01` · `R-MIG-01`

**Missing Requirements**: `M-ARCH-01` · `M-ARCH-02` · `M-ARCH-03` · `M-TRIAL-01` · `M-TRIAL-02` · `M-TRIAL-03` · `M-SUB-01` · `M-SUB-02` · `M-SUB-03` · `M-MP-01` · `M-MP-02` · `M-ENT-01` · `M-ENT-02` · `M-ENT-03` · `M-ADDON-01` · `M-PROMO-01` · `M-PROMO-02` · `M-GRANT-01` · `M-AUTH-01` · `M-AUTH-02` · `M-LEGAL-01` · `M-LEGAL-02` · `M-DATA-01` · `M-MAIL-01` · `M-MAIL-02` · `M-MAIL-03` · `M-CONC-01` · `M-CONC-02` · `M-ADMIN-01` · `M-OBS-01` · `M-MIG-01`

**Objections**: `O-LEGAL-01` · `O-METH-01` · `O-METH-02`

**Suggested Improvements**: `S-ARCH-01` · `S-TRIAL-01` · `S-MP-01` · `S-AUTH-01` · `S-OBS-01` · `S-METH-01` · `S-METH-02`

**Pending MP Validation**: `MP-01` y toda la sección 4, más [`06-mp-validation-matrix.md`](./06-mp-validation-matrix.md)

---

## 16. Preguntas concretas para el owner

Ordenadas por impacto. Las **[BLOCKING]** frenan FASE 2. Se pueden responder por número.

1. **[BLOCKING]** ¿Los planes son mutables, o versionados e inmutables con las subscriptions
   ancladas a su versión? (`BD-ARCH-01`)
2. **[BLOCKING]** ¿La derivación del Trial Plan es live o snapshot al iniciar el trial?
   (`BD-TRIAL-01`)
3. **[BLOCKING]** El máximo de 1 ficha en trial, ¿es un override del Trial Plan o una regla
   aparte? ¿Configurable por vertical? (`C-TRIAL-01`)
4. **[BLOCKING]** Matriz de cambio de plan: ¿qué celdas de tier × ciclo son upgrade inmediato
   y cuáles a fin de ciclo? (`BD-SUB-02`)
5. **[BLOCKING]** ¿Existen addons **recurrentes**, sabiendo que cada uno sería un débito
   separado en el resumen del cliente? (`BD-MP-04`)
6. **[BLOCKING]** ¿Qué se le promete al cliente que hoy paga: migración transparente o
   re-autorización? (`BD-MIG-01`)
7. **[BLOCKING]** ¿Partner tiene trial, sí o no? (`C-TRIAL-02`)
8. ¿Qué señal define "misma identidad" para el trial de por vida, y qué costo de falso
   positivo estás dispuesto a aceptar? (`BD-TRIAL-02`)
9. ¿Qué puede hacer un usuario que entró a una vertical y todavía no publicó — cuántos
   borradores, por cuánto tiempo? (`M-TRIAL-01`)
10. ¿El trial regala *todos* los entitlements de Premium, incluso los que cuestan plata por uso
    (IA, destaques)? (`R-TRIAL-01`)
11. ¿Turista VIP tiene trial? Si sí, ¿cuál es su evento de inicio? (`M-TRIAL-02`)
12. Herencia Turista VIP: ¿entitlements solamente o también limits? ¿Y qué pasa si el host
    además paga Turista VIP por su cuenta? (`A-ENT-01`)
13. ¿El grace de 10 días es constante o configurable por plan/vertical? (`C-SUB-01`)
14. ¿Se puede hacer upgrade estando en grace por impago? (`E-SUB-03`)
15. Si una ficha es rechazada por moderación después de publicada, ¿se devuelve el trial?
    (`E-TRIAL-01`)
16. Addon sobre una ficha que se borra o se despublica: ¿se congela, se libera, se reembolsa?
    (`M-ADDON-01`, `E-ADDON-01`)
17. Scope "todas las verticales futuras" en grants: ¿sin tope ni vencimiento? (`OD-PROMO-01`)
18. ¿Hay cupo total por promo code, además del límite por usuario? (`M-PROMO-02`)
19. ¿Confirmás avanzar sin comprobante fiscal hasta ARCA, como decisión registrada?
    (`O-LEGAL-01`)
20. Retención: ¿el soft delete del día 90 oculta la ficha también para su dueño? ¿Avisamos
    antes del borrado del día 180? (`C-DATA-01`)
21. ¿Aceptás el criterio operable de los 4 puntos para decidir KEEP vs REWRITE en FASE 5?
    (`O-METH-02`)

---

## 17. Lo que NO se hizo en esta fase

Por prohibición explícita del PDR (§4, §67):

- No se miró el código de billing, ni el esquema, ni las migraciones, ni los tests.
- No se propuso arquitectura, entidades ni esquema de DB — eso es FASE 2.
- No se clasificó nada del sistema actual como KEEP/ADAPT/REWRITE — eso es FASE 5.
- No se ejecutó ninguna prueba contra Mercado Pago — eso es FASE 1C.
- No se completó ningún hueco en silencio: todo lo que el PDR no dice está marcado arriba.

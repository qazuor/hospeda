---
title: FASE 1A — Análisis crítico del dominio
linear: HOS-1352
statusSource: linear
created: 2026-09-15
status: CURRENT
phase: 1A
---

# FASE 1A — Análisis crítico del dominio

**Entregado**: 2026-09-15 · **Estado**: esperando respuestas del owner.

## Cómo se produjo esto

Lectura del [PDR](./00-PDR.md) **contra sí mismo**, según §67: *"NO revisar todavía
implementación para elegir arquitectura"* y §"FASE 1A": *"NO usar código actual para diseñar
la solución. Analizar este documento."*

Lo que **no** se consultó, y no por olvido sino porque el §0 lo prohíbe como fundamento:
código, esquema, migraciones, tests, jobs, superficies, documentación del repo, sistemas de
tracking, memoria de sesiones previas, ni ningún análisis anterior de este mismo programa.
Tampoco se midió nada de producción todavía — ver `O-METH-02`.

Cada `§` citado acá **se verificó contra el texto del PDR antes de escribirlo**. Donde el PDR
no dice, **no se completó el hueco**: se marcó (§67: *"No completar silenciosamente ningún
hueco"*).

## Nomenclatura

| Prefijo | Significado |
|---|---|
| `BD-` | **BLOCKING DECISION** — frena FASE 2 (§0) |
| `OD-` | `OPEN DECISION` — hay que decidirla, no frena (§0) |
| `C-` | Contradicción interna del PDR |
| `A-` | Ambigüedad |
| `E-` | Edge case sin regla |
| `R-` | Riesgo |
| `M-` | Requisito aparentemente olvidado |
| `O-` | Objeción |
| `S-` | Mejora sugerida |
| `MP-` | `PENDING MP VALIDATION` (§0) |

Los IDs son **estables**: se citan por número en la respuesta del owner y en el
[Decision Log](./01-decision-log.md).

---

## 1. Arquitectura, catálogo y configuración

### BD-ARCH-01 — ¿Un plan es mutable, o se versiona y es inmutable?

El PDR **nunca formula esta pregunta** y construye encima de ella por lo menos cuatro cosas:
la derivación del Trial Plan (§10.3), el enforcement de excedentes (§28.1), los cambios de
precio (§29) y el recálculo del límite efectivo (§37).

Concretamente: si mañana el plan Basic pasa de 20 a 25 fotos, ¿las suscripciones vigentes ven
25, o siguen viendo lo que contrataron?

- **Mutable**: esquema simple, pero el pasado se reescribe. No se puede auditar por qué un
  cliente tenía un límite dado en una fecha dada, y **bajar un límite deja clientes excedidos
  retroactivamente**, disparando el enforcement de §28.1 sobre alguien que no hizo nada.
- **Versionado**: cada suscripción queda anclada a una versión del plan. Auditable y seguro,
  pero toda lectura de configuración resuelve versión primero, y hay que definir **qué
  dispara una versión nueva**: ¿el precio?, ¿un límite?, ¿un entitlement?, ¿el texto de
  marketing?

No se puede escribir la Master Spec sin esta respuesta. **BLOCKING.**

### BD-ARCH-02 — "El plan más premium" y "el más básico" no son computables

§10.3 exige derivar los entitlements del *"plan comercial más premium"* de la vertical y los
limits del *"más básico"*. **Ninguno de los dos términos está definido**, y no hay forma de
computarlos sin un orden declarado:

- Por precio no sirve: dos planes pueden costar lo mismo, y el precio vive en el
  BillingOption (§18), no en el Plan — así que un mismo plan tiene cuatro precios.
- Hace falta un **orden explícito por plan**, dentro de la vertical.

Y hay una segunda mitad: **qué planes participan del orden**. ¿Uno retirado del catálogo?
¿Uno interno de prueba? ¿Uno que existe pero no se ofrece? Un plan que nadie puede comprar no
debería poder alterar lo que recibe un trial sin que nadie se entere.

Toca también §27/§28: "upgrade" y "downgrade" necesitan exactamente el mismo orden para
significar algo. **BLOCKING.**

### C-ARCH-01 — §9 es inaplicable tal como está escrito

§9 dice que toda configuración relevante sale *"SI O SI DE DATABASE"*, y prohíbe
explícitamente *"archivos TS"*, *"constantes duplicadas"* y *"listas hardcodeadas"*. Entre lo
que enumera como responsabilidad de la DB están *"verticales"*, *"entitlements"* y
*"limits"*.

Pero **no hay forma de evaluar una capacidad sin nombrarla**: cualquier control de acceso
tiene que preguntar por *una* capacidad concreta, y ese nombre es un literal en código. Lo
mismo para las verticales: §13 exige que las operaciones lleven contexto de vertical
suficiente para impedir autorización cruzada, y eso sólo es verificable si el conjunto de
verticales es conocido en tiempo de compilación.

El propio §9 lo admite a medias en su última línea — *"Código solamente debe contener
comportamiento/algoritmos que no representen configuración comercial"* — pero la frase
anterior es absoluta y va a leerse como absoluta.

Sin acotar el principio se va a violar en silencio, que es exactamente el mecanismo que el §9
dice querer evitar.

→ **S-ARCH-01**: separar dos cosas que hoy el §9 mezcla.
  - **Catálogo de claves** (qué capacidades y qué límites *existen*): vive en código, porque
    el código tiene que poder nombrarlas, con un control automático que falle si una clave
    usada no existe en DB o si una clave de DB no existe en el catálogo.
  - **Configuración comercial** (qué plan otorga qué clave, con qué valor, en qué vertical, a
    qué precio, con qué schedule): DB exclusivamente, sin excepción.

  El invariante §64.15 pasaría a leerse *"toda configuración comercial viene de DB; el
  catálogo de claves es código verificado contra DB"*.

### O-ARCH-01 — §7 y §8 no traen un criterio para distinguirse

§7 exige *"un único motor genérico de billing"* y prohíbe un billing por vertical. §8 define
el **Eje 2** como *"comportamiento específico de vertical"*, o sea que comportamiento
específico de vertical es legítimo y esperado.

Las dos cosas son correctas y no hay contradicción formal. El problema es que **no existe un
criterio escrito para saber de qué lado cae una pieza concreta**, y la enfermedad que el PDR
describe en §5.2 (*"aparecieron caminos separados"*) se justifica a sí misma perfectamente
como "Eje 2".

Sin ese criterio, la regla del §7 no es verificable: cualquier divergencia futura va a pasar
como comportamiento de vertical.

→ **S-ARCH-02**: que el diseño declare qué decisiones son legítimamente por vertical y las
enumere de forma cerrada (por ejemplo: qué evento activa el trial, qué recurso publica, qué
menú aporta, qué limits tienen sentido). Todo lo que no esté en esa lista pertenece al Eje 1 y
no admite variante por vertical. Una vertical nueva que necesite algo fuera de la lista es un
cambio de diseño consciente, no un `if` más.

### M-ARCH-01 — Falta el glosario canónico de estados

El PDR usa `SUSPENDED` para dos situaciones que **no se comportan igual**: trial vencido sin
suscribirse (§10.6) e impago después del grace (§20). Difieren en el correo que corresponde,
en si aplica la campaña de recuperación de §10.7, y en desde cuándo corre el reloj de
retención de §25.

§63 pide modelar explícitamente los estados y transiciones de ocho máquinas. Antes de eso hace
falta **un diccionario único de nombres**, o cada épica de FASE 3 va a inventar los suyos y
volvemos a tener vocabularios divergentes.

### M-ARCH-02 — Falta estrategia de lectura, caché e invalidación

Si cada operación resuelve entitlements y limits contra DB, el costo es real y va a aparecer
una caché. El diseño tiene que decir **qué se cachea, por cuánto, y qué la invalida**: cambio
de plan, webhook, grant, cortesía, addon comprado, addon vencido, cron, cambio de
configuración comercial.

El PDR no lo menciona, y es de las pocas cosas donde un error es **de seguridad y no de
performance**: un entitlement que sigue vivo después de revocado es acceso indebido.

### OD-ARCH-01 — Qué pasa con un plan que se retira del catálogo

El PDR no lo dice en ningún lado. Un plan que deja de venderse pero que todavía tiene clientes
pagando: ¿se archiva y los clientes siguen ahí indefinidamente?, ¿se los migra?, ¿hay fecha?

No es lo mismo que `BD-ARCH-01`: se puede versionar planes y aun así no tener política de
retiro. Y si la respuesta es "se los migra", eso mueve a gente que no pidió nada y dispara la
notificación de §29.

---

## 2. Trial

### C-TRIAL-01 — §10.3 contra §10.5: dos fuentes para el mismo límite

§10.3 ordena que el Trial Plan herede **exactamente** los limits del plan comercial más
básico, y que esos valores **no se copien manualmente** sino que se deriven.

§10.5 ordena que durante el trial haya **máximo una ficha**.

Si el plan más básico permite más de una, las dos reglas se contradicen sobre el mismo valor.
Y §64 las congela a las dos como invariantes (#5 y #6), así que la contradicción queda
escrita dos veces.

Hay dos salidas y hay que elegir explícitamente: o la derivación admite **overrides** — y
entonces deja de ser pura, y hay que decir cuáles son, dónde viven y quién los puede cambiar —
o el "1" es una regla aparte que se aplica encima de la derivación.

Segundo problema, independiente: el "1" está escrito **como constante en el PDR**, lo que
choca con §9 (toda regla comercial desde DB). Debería ser configurable por vertical.

**BLOCKING**: define si la derivación del §10.3 es una función pura o una función más una
tabla de excepciones, y eso cambia el esquema.

### BD-TRIAL-01 — ¿La derivación del Trial Plan es en vivo o congelada al arrancar?

§10.3 pide que el Trial Plan siga automáticamente a Premium y a Basic, con un ejemplo
explícito: si Basic pasa de 20 a 25 fotos, *"Trial debe pasar automáticamente a 25"*.

**El ejemplo elegido sube. El caso que duele es el que baja.** Si Basic pasa de 25 a 20
mientras hay un trial en curso con 23 fotos cargadas, ese usuario queda excedido en mitad del
trial sin haber hecho nada, y dispara el enforcement de §28.1.

- **En vivo** es lo que dice el texto literalmente.
- **Congelado al iniciar** protege al usuario, pero incumple el ejemplo del propio §10.3.
- Una tercera vía es recalcular siempre pero **nunca por debajo de lo que el trial tenía al
  arrancar**.

Se cruza con `BD-ARCH-01`: si los planes se versionan, "en vivo" ya no significa lo mismo.
**BLOCKING.**

### A-TRIAL-01 — Qué es exactamente "publicar" (§10.4)

§10.4 fija el disparador con precisión inusual — *"el trial comienza exactamente al PUBLICAR
la primera ficha"*, y no al registrarse, ni al crear draft, ni al entrar al onboarding, ni al
guardar un formulario parcial — y después agrega: *"La publicación efectiva dispara el consumo
del trial."*

La palabra **"efectiva"** está haciendo un trabajo que el PDR no explica. Si la publicación
es inmediata, "publicar" y "quedar publicado" son el mismo instante y no hay nada que decidir.
Si media cualquier paso entre la acción del usuario y la visibilidad pública, son dos eventos
distintos y hay que elegir cuál consume el trial.

Es una pregunta de producto antes que técnica: **¿la publicación de una ficha es inmediata o
está mediada?** El PDR no lo dice en ningún lado, y de la respuesta depende si `E-TRIAL-01`
existe o no.

### E-TRIAL-01 — Publicación mediada y trial consumido sin contraprestación

Condicionado a `A-TRIAL-01`: si la publicación está mediada y una ficha puede no llegar a
verse, un usuario puede consumir **su único trial de por vida** sin haber recibido nunca el
servicio. §10.2 dice que el trial no se reinicia por nada y no admite excepciones.

Hay que decidirlo explícitamente: o el evento canónico es el que garantiza valor entregado, o
existe una excepción a §10.2 — y entonces hay que decir quién la autoriza y cómo se audita.

### E-TRIAL-02 — Publicar y despublicar enseguida

Por §10.2 el trial no se devuelve por despublicar, así que sigue corriendo sobre una ficha que
ya no se ve. Probablemente sea lo querido, pero **no está escrito**, y es la primera pregunta
que va a hacer un usuario molesto y la primera que un agente sin regla va a resolver por su
cuenta.

### E-TRIAL-04 — Baja reactiva de una ficha ya publicada

> Agregado el 2026-09-15, derivado de `DEC-TRIAL-005`. No estaba en la entrega original.

Con la publicación inmediata, toda moderación es **reactiva**: una ficha inapropiada se baja
después de haber estado visible. Pero §10.2 dice que el trial no se reinicia por despublicar,
sin excepciones, así que esa persona queda **sin ficha y sin trial**.

Falta decidir si eso amerita una excepción al §10.2 y, si la amerita, quién la autoriza y cómo
se audita — o si se acepta como consecuencia de haber publicado algo que no correspondía.

### M-TRIAL-01 — Turista no tiene disparador de trial

§10.4 cierra diciendo: *"Partner y cualquier vertical futura sin Listing deberán definir su
evento funcional equivalente explícitamente."*

**Turista no es Partner ni es futura**: es una vertical actual (§6) sin ficha (§6: *"Turista
NO tiene ficha/listing comercial"*). La frase del §10.4 no la cubre, y §64.1 enuncia el trial
*"por user + vertical"* sin excluir ninguna.

Entonces: ¿Turista tiene trial? Si lo tiene, ¿qué lo dispara? El §47 define un botón
`Empezar` que *"inicia ESA vertical"*, que es el único evento explícito que el PDR le da a
Turista. Si no lo tiene, hay que decirlo, porque hoy el texto no lo excluye.

### M-TRIAL-02 — Falta el estado anterior al trial

§10.4 dice que el trial arranca al publicar y que **no** arranca al registrarse, al crear un
draft ni al entrar al onboarding. O sea que el PDR reconoce explícitamente un estado *"entró a
la vertical y todavía no publicó"* — y después no le asigna ninguna regla.

Falta: cuántos borradores puede tener, por cuánto tiempo, si tiene alguna capacidad mientras
tanto, y si algo de eso vence. Sin regla, alguien puede sostener contenido indefinidamente sin
consumir nada, y es donde va a estar la mayor parte de la gente.

### BD-TRIAL-02 — "La misma identidad si podemos detectarlo" esconde una decisión entera

§10.2 dice que el trial no se reinicia por *"volver a registrarse sobre la misma identidad si
podemos detectarlo"*. El condicional no define **qué señal** cuenta como identidad, y cada
candidata tiene un falso positivo distinto:

| Señal | A quién le niega el trial por error |
|---|---|
| Email normalizado (puntos, `+alias`) | prácticamente a nadie |
| Teléfono verificado | familia, oficina compartida |
| Identificador fiscal | dos emprendimientos del mismo titular |
| Medio de pago / pagador | matrimonio, socios, quien paga por otro |
| Dispositivo / huella de navegador | misma casa, misma oficina, conexión compartida |

La asimetría de costos es fuerte: un **falso negativo** regala un trial; un **falso positivo**
le niega el trial a un cliente legítimo, **que se va sin hablar con nadie**.

Además, guardar señales de identidad con el fin de negar un servicio tiene implicancias de
datos personales (ver `M-LEGAL-02`), incluso si al final no se bloquea con ellas.

**BLOCKING**: define columnas, qué se guarda, con qué finalidad declarada y por cuánto.

### A-TRIAL-02 — "Mientras el user solamente está en trial" (§10.5)

§10.5 dice: *"NO se permite adquirir addons mientras el user solamente está en trial."*

La palabra **"solamente"** abre un caso que el PDR no resuelve. El trial es por `user +
vertical` (§10.1) y un usuario puede tener verticales distintas en estados distintos (§11).
Entonces, un usuario en trial de Gastronomía **y** con suscripción comercial activa de
Alojamiento no está "solamente en trial".

¿Puede comprar un addon de scope `USER` o `GLOBAL` (§40)? Literalmente sí, porque no está
solamente en trial. ¿Y ese addon alcanza a su ficha en trial? Si alcanza, se rompe el
espíritu del §10.5 y del invariante §64.7. Si no alcanza, hay que decir cómo se excluye.

Se cruza con `M-ENT-03`: el PDR no le da scope global a los entitlements, pero sí a los
addons.

### R-TRIAL-01 — Regalar *todos* los entitlements de Premium es un riesgo económico

§10.3 ordena que el Trial Plan otorgue *"exactamente los entitlements del plan comercial más
premium"*. Si alguno de esos entitlements tiene **costo marginal real por uso** — el chat con
IA que el §36.2 menciona es el candidato obvio, y cualquier forma de destaque compite por
inventario finito — el trial lo regala **sin tope**.

Y se multiplica: el trial es por vertical (§10.1) y hay cinco verticales (§6), así que una
misma persona puede abrir cinco trials y consumir cinco veces.

El PDR no distingue entre entitlements booleanos y entitlements medidos, ni le da al trial
ninguna cuota propia.

→ **S-TRIAL-01**: que cada entitlement medido declare su cuota de plan **y** su cuota de
trial, en vez de heredar la del plan premium.

### OD-TRIAL-01 — Trial, pausa y extensiones: ¿hay algún techo?

Tres reglas que no se cruzan en ningún lado del PDR:

- §26 prohíbe pausar un trial (*"NO: trial"*).
- §32 permite extender el trial N días con un promo `TRIAL_EXTENSION`.
- §34.1 dice que una cortesía temporal durante el trial *"extiende el trial"*.

Ninguna de las dos extensiones tiene tope, ni se dice si se acumulan entre sí. Un trial puede
crecer indefinidamente y **nadie lo ve**, porque no hay ningún lugar donde se muestre el total
acumulado de días de trial de una persona.

### M-TRIAL-03 — Falta política anti-spam de la campaña de recuperación

§10.7 define la campaña post-vencimiento en +1, +5, +15, +30 y +60 días, y exige que cada
correo *"indique claramente la vertical"* — o sea, es **por vertical**. Con cinco verticales
(§6), quien abandona varias recibe varias secuencias corriendo en paralelo, y puede recibir
varios correos el mismo día.

Falta: opt-out (obligatorio para comunicación comercial, ver `M-LEGAL-01`), tope de correos
por persona por día, **corte inmediato al suscribirse**, corte por rebote duro, y qué pasa si
la persona borra la cuenta en el medio.

### E-TRIAL-03 — La campaña se dispara y después el trial se extiende

§10.7 prevé el caso de un trial más corto que los thresholds (*"ignorar thresholds
imposibles"*). **Falta el inverso**: ya se mandó el aviso de "vence en 2 días" y después el
trial se extiende por §32 o §34.1.

El usuario recibió un aviso que dejó de ser cierto. ¿Se reprograma la secuencia entera? ¿Se
manda una corrección? ¿Se ignora?

---

## 3. Suscripción, estados y ciclo de vida

### M-SUB-01 — Faltan estados que el propio modelo del PDR vuelve inevitables

El PDR nombra `TRIAL_ACTIVE`, `ACTIVE`, `GRACE_PERIOD`, `SUSPENDED` y
`RECONCILIATION_REQUIRED`, más pausa (§26) y cancelación programada (§24). Faltan por lo
menos cuatro:

- **Ninguno / nunca empezó** — el estado de toda persona recién registrada frente a toda
  vertical. Es el estado más poblado del sistema y no está nombrado.
- **Preapproval creado y todavía no autorizado.** Esto **no es un caso de borde**: el §5.6
  define el modelo como *"Hospeda crea explícitamente el preapproval mediante API"* y *"recién
  después enviamos al usuario a Mercado Pago para completar/autorizar el proceso"*. Esa
  ventana **existe siempre, por diseño**, y es exactamente donde se pierde gente. Falta su
  duración máxima, su limpieza, qué ve el usuario mientras tanto, y qué pasa si vuelve a
  intentar (ver `M-CONC-01`).
- **Cancelación ya consumada** — distinto de suspensión por impago: la persona se fue por
  decisión propia, y ni la comunicación ni la campaña de recuperación pueden ser las mismas.
- **Los dos `SUSPENDED`** — ver `M-ARCH-01`.

### A-SUB-01 — "Main subscription" sugiere que hay otras

§11 dice *"máximo 1 **main** subscription por user + vertical"*. El adjetivo implica que
existen suscripciones no principales, pero el PDR **nunca define qué son**.

El candidato natural son los addons recurrentes de §38, que se cobran periódicamente y por
tanto son una obligación de pago recurrente. Si son suscripciones, el modelo tiene dos clases
y §11 sólo acota una. Si no lo son, conviene sacar la palabra "main" para que nadie modele de
más.

### C-SUB-01 — El grace de 10 días: constante en tres lugares, configurable en el cuarto

- §20 lo fija: *"Duración: **10 días**."*
- §30 lo repite para pagos manuales: *"`GRACE_PERIOD` durante 10 días."*
- §42.3 dice *"Schedule configurable durante 10 días"* — o sea, schedule configurable dentro
  de una ventana fija.
- §9 dice que **toda regla comercial** sale de DB.

Las cuatro no pueden ser ciertas a la vez. Hay que decidir si el 10 es un default configurable
(y por plan, o por vertical, o global) o una constante del dominio que §9 exceptúa.

### A-SUB-02 — ¿Dónde se habilita la pausa: en el Plan o en el BillingOption?

§26 pide tres condiciones simultáneas: suscripción `ACTIVE`, **billing mensual**, y *"plan que
permita pause"*.

Pero §18 separa las dos entidades: el **ciclo** vive en el BillingOption y la **política**
vive en el Plan. Con dos flags en dos entidades distintas, la pregunta "¿este cliente puede
pausar?" se responde en cada lugar donde alguien se acuerde de hacer las dos preguntas.

→ Se cruza con `S-MP-01`: debería resolverse en un solo lugar, derivado de las capacidades
compuestas de plan × billing option × método de pago.

### BD-SUB-01 — "Upgrade" y "downgrade" están definidos sobre un solo eje, y hay dos

§27 dice que el upgrade es inmediato. §28 dice que el downgrade se aplica a fin de ciclo.
Las dos frases asumen que un cambio de plan se mueve en **una** dirección.

Pero §18 separa Plan (tier) de BillingOption (ciclo, precio, moneda), y §19 pide cuatro
ciclos. Un cambio real se mueve en **dos ejes a la vez**:

| | Ciclo ↑ (mensual→anual) | Ciclo = | Ciclo ↓ (anual→mensual) |
|---|---|---|---|
| **Tier ↑** | ? | inmediato (§27) | ? |
| **Tier =** | ? | — | ? |
| **Tier ↓** | ? | fin de ciclo (§28) | ? |

De nueve celdas, una es un no-cambio y **dos tienen política**. Quedan **seis sin definir**, y
son las más frecuentes comercialmente: quien quiere pasarse a anual normalmente también quiere
otro tier.

Además, ordenar los tiers requiere `BD-ARCH-02`, que tampoco está resuelto.

Sin la matriz completa, la implementación va a improvisar caso por caso — que es
exactamente el mecanismo que el §1 describe como origen de la situación actual. **BLOCKING.**

### M-SUB-02 — Falta una cola de cambios programados

§28 introduce un cambio que se aplica en el futuro, y ahí aparece una familia de casos sin
regla: downgrade programado y después upgrade inmediato; dos downgrades sucesivos; downgrade
programado y después cancelación (§24); downgrade programado y después pausa (§26).

Debe existir a lo sumo **un** cambio programado vigente, con reglas explícitas de reemplazo y
de cancelación. Si no, el estado del sistema depende del orden en que llegaron los clicks.

### E-SUB-01 — El precio del plan destino cambia entre que se programa y que se ejecuta

§28 agenda el downgrade a fin de ciclo. §29 permite que los precios cambien. ¿Se aplica el
precio vigente al programar o al ejecutar?

Y si al ejecutar es más caro: **¿cuenta como aumento** a los efectos de §29, con su aviso y su
derecho a cancelar?

### E-SUB-02 — Pausa más cancelación programada

§24 dice que la cancelación se hace efectiva *"al final del período ya pagado"*. §26.4 dice
que el usuario *"no debe perder período ya pagado por estar pausado"*, con lo cual el fin del
período se corrió hacia adelante.

Si alguien pausa y después cancela: ¿la cancelación espera al fin del período extendido, o
corta en la fecha original? Las dos son defendibles y producen resultados económicos
distintos.

### E-SUB-03 — Pausar o cambiar de plan estando en `GRACE_PERIOD`

§26 sólo permite pausar desde `ACTIVE`, así que quien tiene un pago fallido no puede pausar y
va derecho a suspensión. Probablemente sea lo querido — si no, pausar sería la forma de no
pagar nunca — pero **no está escrito**.

El caso simétrico es más delicado: ¿puede cambiar de plan estando en grace? Si se prohíbe, el
control impide el propio remedio, porque cambiarse a un plan más barato es justamente cómo
alguien sale de un impago. Si se permite, hay dos abusos posibles: cambiar de plan para
generar un cobro nuevo que "limpie" el fallido, o para esquivar la deuda del ciclo anterior.

### R-SUB-01 — Durante el grace el servicio queda completo

§20 es explícito: durante el grace el servicio está activo, las fichas publicadas, la edición
activa y **los entitlements activos**, por 10 días. Está bien como política de retención, pero
conviene mirarlo junto a §24 (cancelar conserva el período pagado) y a la posibilidad de
volver a suscribirse: hay que verificar que la combinación no produzca un ciclo donde alguien
sostenga servicio continuo sin completar un pago.

No es una objeción a la duración; es pedir que el diseño demuestre que el ciclo se cierra.

### M-SUB-03 — Falta qué pasa si una vertical se discontinúa

Con suscripciones activas en ella. El PDR contempla verticales nuevas en varios lugares (§16,
§31, §35.1) y nunca la operación inversa. Es barato definirlo ahora y caro después.

### OD-SUB-01 — Sobre qué se cuenta la ventana de límites de pausa

§26.3 define los defaults: máximo 3 pausas por ventana móvil de 12 meses, máximo 120 días por
pausa, máximo 240 días acumulados en la ventana. **No dice sobre qué entidad se cuenta.**

Si se cuenta por `user + vertical`, el límite es real. Si se cuenta por suscripción, cancelar
y volver a suscribirse resetea el contador y el límite no limita nada.

---

## 4. Mercado Pago y abstracción de provider

Nada de esta sección afirma nada sobre Mercado Pago. Son **hipótesis a comprobar en FASE 1C**,
y se listan acá sólo porque determinan qué alternativas de diseño están disponibles. §58 es
terminante: *"NO alcanza documentación. NO alcanza código legacy. NO alcanza memoria. NO
alcanza 'parece soportarlo'."*

La matriz completa está en [`06-mp-validation-matrix.md`](./06-mp-validation-matrix.md).

### MP-01 — Los cuatro ciclos del §19

§19 pide mensual, trimestral, semestral y anual, y marca la implementación como `PENDING MP
VALIDATION`. Hay que verificar qué combinaciones acepta el provider al crear, y qué pasa al
cambiar de ciclo sobre una suscripción ya autorizada (necesario para `BD-SUB-01`).

### BD-MP-01 — Mecanismo de pausa (§26, §26.4)

§26.4 plantea el requisito — *"User no debe perder período ya pagado por estar pausado"* — y
lo marca `PENDING MP VALIDATION` sin proponer mecanismo. Las alternativas tienen consecuencias
muy distintas:

1. **Pausa nativa del provider**, si existe, y si al reanudar respeta el período pagado.
2. **Cancelar y recrear al reanudar** — implica **volver a pedirle autorización al usuario**:
   fricción, caída, y un agujero donde el cliente simplemente no vuelve.
3. **Mantener el cobro activo y compensar con crédito interno** — requiere un modelo de
   saldo que el PDR no tiene y que arrastra contabilidad propia.

La respuesta define si §26.4 es siquiera implementable. **BLOCKING.**

### BD-MP-02 — Cortesía temporal sobre una suscripción viva (§34.2)

§34.2 pide *"mantener servicio sin cobrar durante el período otorgado"* contra un débito
automático ya autorizado, y explícitamente ordena no asumir la implementación.

Alternativas concebibles: bajar el monto (¿hay piso?), pausar, cancelar y recrear al final, o
cobrar y reembolsar. Cada una rompe algo distinto: la auditoría, la conciliación, o lo que el
cliente ve en su resumen. **BLOCKING.**

### BD-MP-03 — Cambios de precio sobre suscripciones vigentes (§29)

§29 contempla que un cambio de precio afecte *"subscriptions existentes"*. Si mutar el monto
de una autorización vigente no es posible, o exige una autorización nueva, **todo aumento
implica re-consentimiento** con su tasa de caída asociada.

Eso deja de ser una cuestión técnica: define si se pueden actualizar precios sin perder la
base instalada. **BLOCKING.**

### BD-MP-04 — Addons recurrentes (§38)

§38 admite addons `recurrent`. Si una autorización de débito sólo puede cubrir **un monto**,
entonces un cliente con plan más dos addons recurrentes ve **tres débitos separados** en su
resumen, y hay que conciliar N autorizaciones contra una suscripción, con N estados que pueden
divergir.

Antes de diseñar addons recurrentes hay que saber si el provider permite un solo cobro
agregado, o si hay que modelarlos como cobros separados, o si conviene que **todo addon sea
one-time** y la recurrencia se modele como una renovación explícita. **BLOCKING.**

### M-MP-01 — Falta el modelo de moneda e impuestos

§9 enumera *"currencies"* en plural y §18 pone *"currency"* en el BillingOption. Pero no hay
ninguna política: ¿un plan puede tener precio en más de una moneda?, ¿qué pasa con el
redondeo?, ¿los precios que se muestran incluyen impuestos?, ¿hay percepciones?

No es presentación: define columnas del esquema de precios. Y se cruza con `M-LEGAL-01`,
porque publicar precio final al consumidor es una obligación, no una preferencia de UX.

### M-MP-02 — Falta política de checkout pendiente

Derivado de la ventana estructural de `M-SUB-01`: la persona hace doble click, o abandona la
página del provider y vuelve media hora después. ¿Se reutiliza la autorización pendiente?, ¿se
cancela y se crea otra?, ¿tiene vencimiento?

Sin regla explícita aparecen autorizaciones huérfanas, y en el peor caso **dos autorizadas
para la misma suscripción**, que es un doble cobro real.

### S-MP-01 — Modelar capacidades del método de pago, no un provider simétrico

§57 pide que el dominio no esté acoplado a Mercado Pago y que se soporte conceptualmente
MercadoPago, Manual y un provider futuro — pero cierra con *"Sin sobrearquitectura"*.

El "provider Manual" del §30 **no tiene** webhooks, ni pausa, ni cambio de monto, ni reembolso
automático, ni conciliación. Tratarlo como un provider más obliga a escribir implementaciones
falsas de todo eso, que es justamente la sobrearquitectura que §57 quiere evitar.

→ Declarar **capacidades explícitas** por método de pago (soporta webhook, soporta pausa,
soporta cambio de monto, soporta reembolso, soporta cancelación programada) resuelve dos cosas
a la vez: evita la abstracción falsa, y hace que reglas como la del §26 ("sólo mensual se
pausa") **deriven de datos** en vez de ser una condición que alguien va a olvidar en el quinto
lugar donde hace falta. Se cruza con `A-SUB-02`.

### S-MP-02 — Un resultado verificado tiene fecha de vencimiento

§61 pide categorizar cada prueba como `VERIFIED`, `NOT_SUPPORTED`, `PARTIALLY_SUPPORTED` o
`UNKNOWN`, y prohíbe implementar mientras diga `UNKNOWN`. No dice nada sobre la antigüedad.

Un `VERIFIED` de hace seis meses no es un `VERIFIED`: un proveedor externo cambia su API y su
comportamiento sin avisarnos. Cada fila debería llevar **fecha y entorno**, re-verificarse
antes de FASE 10, y **una fila sin fecha debería leerse como `UNKNOWN`**.

### S-MP-03 — Las pruebas deben quedar como sondas reproducibles, no como conclusiones

§59 pide registrar request y response y documentar la conclusión. Conviene ir un paso más:
que cada prueba quede como un **script versionado y ejecutable**, marcado como no productivo y
excluido de todo build.

Si el experimento vive sólo en la conclusión, nadie lo puede volver a correr, la matriz
envejece sin que se note, y dentro de seis meses se vuelve a discutir lo mismo sin evidencia.

### M-MP-03 — La matriz mínima del §60 tiene seis huecos

§60 enumera la matriz mínima obligatoria. Faltan seis comportamientos que otras partes del
PDR vuelven necesarios:

1. **Reembolso.** No aparece en §60. Lo necesita `M-LEGAL-01` (derecho de revocación con
   devolución), y es una de las estrategias posibles de `BD-MP-02`.
2. **Qué pasa con una autorización que nunca se completa.** Es el estado estructural de
   `M-SUB-01`, creado por el modelo del §5.6.
3. **Si los eventos del provider traen orden confiable** (versión o timestamp). Sin eso,
   `M-CONC-02` (no-retroceso de estado) no se puede implementar, y §51 pide explícitamente
   cubrir *"out-of-order"*.
4. **Si una autorización puede cubrir más de un monto.** §60 no tiene sección de addons, y de
   esto depende entera `BD-MP-04`.
5. **Qué le comunica el proveedor al cliente por su cuenta** cuando operamos sobre una
   autorización. Es `M-MAIL-04`, y no se puede decidir la política de correos sin saberlo.
6. **Cambio de frecuencia sobre una suscripción ya autorizada.** §60 cubre el cambio de
   *precio* sobre una existente, no el de *ciclo*. Lo necesita `BD-SUB-01`.

Son huecos de la matriz, no del PDR: §60 dice *"matriz mínima"*, así que ampliarla es lo
esperado. Se agregan marcados como tales en
[`06-mp-validation-matrix.md`](./06-mp-validation-matrix.md).

---

## 5. Entitlements y limits

### M-ENT-01 — Falta una estrategia de agregación por limit

§37 asume que los limits **suman**, y da el ejemplo: plan 20 fotos + addon 30 = 50. Pero hay
limits donde sumar es directamente incorrecto. Un tope de resolución, una prioridad de
ordenamiento o un compromiso de tiempo de respuesta no se suman: se toma el mejor, o el peor, o
el que manda.

Cada limit necesita declarar su estrategia de agregación (sumar, máximo, mínimo, reemplazar),
igual que §28.1 ya le da a cada limit un `enforcementStrategy`. Sin eso se va a parchear caso
por caso.

### M-ENT-02 — El enforcement de excedentes no es una función del downgrade

§28.1 define el manejo de excedentes — informar antes, dejar elegir, preferir archivar o
despublicar antes que borrar, `enforcementStrategy` por tipo de limit — **sólo en el contexto
del downgrade**.

El mismo mecanismo hace falta exactamente igual cuando: vence un addon (§38), termina una
cortesía (§34), se revoca un grant (§35), se suspende (§21), termina el trial (§10.6), y —
según cómo se resuelva `BD-ARCH-01` — cuando cambia la configuración de un plan.

Debe ser **un servicio transversal de reconciliación de excedentes** invocado desde todos esos
puntos, no una rama del flujo de cambio de plan.

### A-ENT-01 — Qué se hereda exactamente de Turista VIP (§16)

§16 dice que cada plan/vertical comercial *"puede configurar desde DB si hereda beneficios de
Turista VIP"*. La palabra "beneficios" no distingue entre entitlements y limits, y el PDR los
trata como cosas distintas en todos lados (§36 vs §37).

Y abre tres preguntas que no toca:

1. Si alguien tiene un plan comercial con herencia **y además** paga Turista VIP por su
   cuenta, está pagando dos veces por lo mismo. ¿Se le impide comprarlo?, ¿se le acumula?,
   ¿se le cancela lo que ya paga? Si se le cancela, ¿qué pasa con el período ya cobrado?
2. Si su plan comercial cae en `SUSPENDED` (§21), pierde beneficios que estaba usando **como
   turista**, en una parte del producto que no tiene nada que ver con su impago. ¿Es lo
   querido?
3. ¿La herencia se evalúa en vivo, o se materializa como una concesión propia?

### A-ENT-02 — Qué tiene el visitante sin cuenta (§36.2)

§36.2 dice tres cosas: el chat de ficha corresponde a las verticales comerciales con fichas;
*"Turista autenticado puede utilizar gratuitamente el chat disponible"*; y *"Guest no es
equivalente a Turista"*.

Lo que **no** dice es qué tiene el guest: ¿un chat limitado, o ninguno? Afecta al contenido
accesible sin login, al costo por uso, y al abuso — un consumo de IA que no se puede imputar a
nadie no se puede medir, ni limitar, ni cortar.

### OD-ENT-01 — ¿Existen entitlements medidos, o son todos booleanos?

El PDR trata los entitlements como capacidades (§36) y los limits como números (§37). Pero
"chat con IA" puede ser lo uno o lo otro: un permiso, o "N mensajes por mes".

Si existen cuotas con reset periódico, hace falta un subsistema entero que el PDR no menciona
en ningún lado: contador, ventana, momento del reset, y qué pasa con lo no usado. Y hay una
pregunta de diseño escondida: **si la cuota se resetea "por período de facturación", un plan
anual entregaría doce meses de cuota el primer día.**

Es la respuesta que hace implementable o no a `S-TRIAL-01`.

### E-ENT-01 — Suspensión del plan comercial y beneficios de turista heredados

> Agregado el 2026-09-15, derivado de `DEC-ENT-003`. No estaba en la entrega original.

Si el plan comercial cae en `SUSPENDED` por impago (§21), la persona pierde los beneficios VIP
que estaba usando **como turista**, en una parte del producto que no tiene nada que ver con su
deuda. Y por `DEC-ENT-003` tampoco pudo haberlos comprado mientras el plan se los daba.

Falta decidir si la herencia sobrevive a la suspensión, si se le ofrece comprar VIP en ese
momento, o si simplemente los pierde.

### M-ENT-03 — Los entitlements no tienen scope global; los addons sí

§36.1 sólo contempla que un entitlement no escape de su vertical. §40 en cambio le da a los
addons cuatro scopes, incluido `GLOBAL`.

La asimetría es un problema porque un plan de vertical puede otorgar legítimamente algo que no
es de esa vertical: una insignia en el perfil, ausencia de publicidad en el sitio, atención
prioritaria. Sin scope global, eso se va a modelar como un entitlement de vertical que después
alguien lee desde otra — que es **precisamente el cruce que §13 quiere evitar**.

---

## 6. Addons

### A-ADDON-01 — La taxonomía one-time/recurrent del §38 no alcanza

§38 define dos tipos: `one-time` y `recurrent`. Pero esa palabra sola mezcla **cómo se cobra**
con **cuánto dura**, y los ejemplos del propio §40.1 lo demuestran:

- *"+5 fichas"* (§40.1): se cobra una vez, y el efecto dura mientras exista la suscripción.
  No es "one-time" en el sentido de efímero, ni es recurrente.
- *"Boost 7 días"* (§40.1): se cobra una vez y dura una semana.

Con un solo eje los dos caen en la misma caja y se implementan igual. Hacen falta dos ejes
separados: **cómo se cobra** (una vez / periódicamente) y **cuánto dura la concesión** (N días
fijos / mientras viva la suscripción / permanente).

§39 ya separa correctamente Product de Instance; esto es la misma clase de separación un nivel
más abajo.

### A-ADDON-02 — Qué es una "subscription válida compatible" (§38)

§38 dice que los addons *"Solo pueden adquirirse teniendo una subscription válida
compatible"*, y §10.5 propone el camino *"suscribirse a un plan como Basic y posteriormente
adquirir un addon compatible"*.

"Válida" no está definido, y el estado importa:

- ¿Una suscripción creada pero **todavía no autorizada** (`M-SUB-01`) es válida? Si lo es, se
  pueden comprar complementos sobre algo que nunca se autoriza.
- ¿Una en `GRACE_PERIOD` (§20)? El servicio está activo, así que literalmente sí.
- ¿Una **pausada** (§26)? El servicio está detenido.

"Compatible" sí está definido: §39 dice que el Product declara sus *"compatible verticals"*.

### E-ADDON-01 — Addon de scope `LISTING` sobre una ficha que se borra

§40 define el scope `LISTING` y §40.1 da el ejemplo: *"User selecciona ficha concreta."* §41
dice que al cancelar una vertical no hay que cancelar addons ciegamente, sino verificar si
queda huérfano.

**Falta el caso de la ficha borrada**, que es el más previsible de todo el sistema de addons:
¿el addon se libera y puede reasignarse?, ¿se pierde?, ¿puede moverse de ficha por decisión del
usuario aunque la ficha original exista?

### E-ADDON-02 — Addon útil sobre una ficha que no se ve

§41 ordena cancelar *"solo cuando queda efectivamente huérfano"*. Un addon de fotos sobre una
ficha despublicada por suspensión (§21) **no está huérfano** — la ficha existe, el addon la
apunta — y sin embargo no sirve para nada.

Falta decidir: ¿el reloj sigue corriendo?, ¿se congela?, ¿se extiende al reactivar?, ¿no se
hace nada y se avisa? Si el reloj sigue, alguien suspendido pierde días de algo que pagó, y es
un reclamo previsible.

### E-ADDON-03 — Addon a costo cero bajo Free Forever (§35.2)

§35.2 con `includesAddons: true` dice que *"addons compatibles pueden utilizarse a costo $0"*
y que **no** se activan automáticamente. O sea que la persona "compra" algo a cero.

Falta: ¿se registra un pago de monto cero?, ¿se emite el comprobante del §54 por cero?, y
sobre todo **¿qué pasa con un addon activo a $0 cuando se revoca el grant** — se corta, se
empieza a cobrar, o se deja correr hasta que venza?

### E-ADDON-04 — Vence un addon que sostenía capacidad en uso

§37 dice que al desaparecer una source hay que recalcular el límite efectivo, y que si queda
excedido el enforcement es "controlado". §40.1 da el ejemplo *"+5 fichas"* con scope
`VERTICAL_SUBSCRIPTION`.

Si ese addon vence y la persona tiene fichas publicadas por encima del límite del plan, hay
que aplicar exactamente el mecanismo de §28.1 — que hoy sólo está escrito para el downgrade
(`M-ENT-02`). Y aplica igual al cruce con §12: *"Una subscription cubre todas las fichas del
user dentro de esa vertical. Cantidad controlada mediante limits."*

---

## 7. Promos, cortesías y grants

### A-PROMO-01 — `stackable` no define el orden, y el orden cambia el total

§31 dice que cada promo declara `stackable` y `usableWhileAnotherPromoActive`. §33 admite
descuentos por porcentaje y por monto fijo.

Dos descuentos apilables, uno porcentual y otro fijo, dan **resultados distintos según cuál se
aplique primero**. Falta una regla determinista de orden, y falta un **piso**: nunca por
debajo de X, nunca negativo, y qué pasa si el resultado cae por debajo del mínimo que acepte
el provider (`PENDING MP VALIDATION`).

### M-PROMO-01 — Falta el cupo global de un código

§31 define *"Cada user: máximo un uso de cada código"*. No define cupo total de canjes, ni
ventana de validez, ni corte por presupuesto consumido.

Un código que se filtra sin cupo total es una pérdida abierta: el límite por usuario no limita
nada cuando hay usuarios ilimitados.

### M-PROMO-02 — Falta qué pasa con una promo en curso cuando cambia el plan

§33 admite descuentos de *"N cobros"* y *"forever"*. §27 y §28 permiten cambiar de plan.

¿El descuento se traslada al plan nuevo?, ¿se recalcula sobre el precio nuevo?, ¿se pierde? Y
con cambio de ciclo (§19): si "3 cobros con descuento" estaba corriendo en mensual y la
persona pasa a anual, **¿eso significa tres años?**

### E-PROMO-01 — `TRIAL_EXTENSION` aplicado el día del vencimiento

§32 es terminante: el promo de extensión *"Solo válido durante `TRIAL_ACTIVE`. Nunca después.
Backend debe rechazar."*

Falta la regla de borde: qué pasa si se aplica el mismo día en que vence, mientras corre el
proceso de expiración. Es una carrera clásica y necesita una regla escrita, no una
implementación que gane por suerte.

### A-PROMO-02 — ¿Se combinan promo, cortesía y grant entre sí?

§31 define `stackable` y `usableWhileAnotherPromoActive` **entre promos**. El PDR no dice nada
sobre las otras combinaciones, y las tres coexisten como sources de entitlements en §36:

- promo de descuento + cortesía temporal (§34) sobre el mismo período;
- cortesía temporal + Free Forever (§35);
- promo de extensión de trial (§32) + cortesía durante el trial (§34.1) — ver `OD-TRIAL-01`.

### OD-PROMO-01 — El scope "todas las verticales actuales y futuras"

Aparece tres veces: §31 (promos), §34 (cortesía temporal) y §35.1 (Free Forever).

Una concesión creada hoy con ese scope otorga automáticamente acceso a una vertical que
todavía no existe, cuyo costo no se conoce y cuyo modelo de negocio puede ser completamente
distinto. **Una vertical nueva nace regalada a esa lista.**

¿Hay tope?, ¿revisión periódica?, ¿vencimiento obligatorio?, ¿se puede excluir una vertical
nueva al crearla?

### A-GRANT-01 — Quién otorga una cortesía temporal

§35 es explícito para el Free Forever: *"Solo: `SUPER_ADMIN`."* §34 dice apenas *"Admin puede
otorgar"* para la cortesía temporal.

La diferencia puede ser deliberada — una cortesía tiene fecha de fin y un Free Forever no —
pero no está dicha, y es una autorización con dinero atrás. Hay que confirmarla o
emparejarla.

### M-GRANT-01 — Free Forever y el dinero ya cobrado

§35.3 ordena *"Cancelar toda obligación de pago cubierta"*, y aclara que incluye tanto
MercadoPago como manual. No dice:

- qué pasa con el **período ya cobrado** — ¿se reembolsa, se deja correr?;
- qué pasa exactamente si el grant se **revoca** — ¿vuelve a cobrarse solo? Si cancelar una
  autorización de débito es irreversible (`PENDING MP VALIDATION`), revocar deja a la persona
  **sin grant y sin suscripción**, y hay que pedirle que autorice de nuevo;
- si la persona **se entera** de que le otorgaron el grant, y de que se lo sacaron. §35.4
  enumera qué se audita — super admin, beneficiario, scope, flag de addons, timestamp, motivo,
  suscripciones afectadas — pero auditar no es avisar.

---

## 8. Autorización

### M-AUTH-01 — Faltan dos verificaciones en la lista del §13

§13 enumera ocho verificaciones mínimas: usuario autenticado, owner, rol/permiso, scope de
vertical, estado de acceso, trial/subscription/courtesy activa, entitlement y limits
aplicables. Faltan dos, y las dos son explotables:

- **El estado del recurso.** Una ficha en borrador, archivada o eliminada pasa las ocho si su
  dueño está en regla. El modelo autoriza operaciones sobre recursos que no deberían
  aceptarlas.
- **El estado de la persona.** Email sin verificar, cuenta inhabilitada por abuso. Alguien
  inhabilitado con suscripción activa **pasa las ocho verificaciones**.

### M-AUTH-02 — Falta el actor administrativo

§48 exige que el admin pueda inspeccionar usuarios, suscripciones, pagos, cortesías y grants
ajenos; §34 y §35 le dan capacidad de otorgar; §30 de registrar pagos. Pero la verificación
"owner" del §13 se lo impide por construcción.

Hay que modelar explícitamente la operación administrativa: **quién actúa, en nombre de quién,
con qué permiso, y con qué registro de auditoría**. Si queda implícito, cada punto de entrada
lo resuelve a su manera, y es además un vector de abuso: un admin comprometido operando sin
rastro.

### A-AUTH-01 — Qué pasa con el rol cuando se pierde el acceso

§13 y los invariantes §64.12 y §64.13 dicen que el rol no equivale a acceso activo ni a
entitlement. Lo que no dicen es **si el rol se revoca** al suspender.

Y hay una consecuencia dura: si al suspender se revocara el rol, se rompe el *"Mi Cuenta
read-only"* que §21 promete explícitamente, y recuperar el servicio implicaría reconstruir
roles.

Conviene resolverlo y **dejarlo escrito como invariante**, porque es exactamente el tipo de
regla que alguien va a "optimizar" más adelante sin entender para qué estaba.

### S-AUTH-01 — El scope de vertical debería ser estructural, no un chequeo

§13 advierte sobre el problema con nombre propio: *"un user con Gastronomía activa termina
ejecutando una operación de Alojamientos porque ambos tienen capabilities conceptualmente
parecidas"*, y pide que *"todos los permisos/capabilities relevantes tengan contexto
suficiente"*.

Una verificación en tiempo de ejecución cubre el lugar donde alguien se acordó de escribirla.
El que se olvidó queda abierto, y el §64.10 lo eleva a invariante (*"Una acción en una
vertical no puede afectar otra accidentalmente"*).

→ La forma de que no vuelva a pasar es que la operación **no se pueda expresar sin vertical**:
que la firma de cada servicio de dominio exija el contexto de vertical de manera obligatoria,
con una verificación automática que falle si un servicio no lo declara. El chequeo en tiempo
de ejecución queda como segunda línea, no como única.

---

## 9. Datos, retención y legal

### C-DATA-01 — §21 promete conservación y §25 borra

§21 dice que al suspender los datos se conservan y que la recuperación es posible. §25 hace
soft delete a los 90 días de inactividad efectiva y **hard delete a los 180**.

Falta: ¿el soft delete del día 90 oculta la ficha también **para su dueño**, o sólo del
público?, ¿se avisa antes de cada corte?, ¿puede exportar su contenido antes?

Sin avisos, alguien que vuelve el día 200 encuentra su contenido borrado sin haber recibido
nunca una advertencia, y el §21 le había prometido exactamente lo contrario.

### R-DATA-01 — Entre el día 60 y el día 90 no hay ninguna comunicación

La campaña de recuperación del §10.7 termina en +60 y explícitamente ordena no seguir
(*"finaliza esta campaña automática de recuperación"*). El soft delete del §25 ocurre a los 90.

La coherencia es correcta — dejar de hacer marketing está bien — pero el aviso de que el
contenido se va a ocultar y después a borrar **no es marketing**: es una notificación
transaccional y debería existir igual, con su propia regla de supresión (ver `M-MAIL-03`).

### M-DATA-01 — "Dato operativo eliminable" no está definido

§25 ordena hard delete a los 180 días de *"datos operativos eliminables"*, y manda conservar
auditoría, pagos, registros obligatorios, información legal e historial necesario.

Si la auditoría del §49 guarda eventos de dominio completos, es posible que el contenido
sobreviva ahí y el hard delete no elimine nada. Hace falta la lista explícita de qué se borra,
qué se anonimiza y qué se conserva.

### M-LEGAL-01 — Faltan la baja online y el derecho de revocación

§29 ordena *"cumplir normativa argentina"* e *"investigar normativa actual antes de
implementar"*, pero sólo en el contexto de cambios de precio. Para contratación a distancia
con débito automático hay al menos dos obligaciones más que el PDR **no menciona en ningún
lado**:

- **Derecho de revocación** dentro de un plazo legal, sin costo ni justificación, con
  devolución de lo pagado.
- **Baja online tan simple como el alta**, sin gestiones telefónicas.

§24 define la cancelación al final del período pagado, que **no es ninguna de las dos**: no es
revocación con devolución, y no dice nada sobre la facilidad de la baja.

No corresponde que este análisis afirme el plazo ni el texto exacto de la norma: corresponde
que el diseño los incorpore como requisitos de primera clase y que **se verifiquen con
asesoramiento antes de implementar**. La revocación con devolución además **requiere poder
reembolsar**, que es el hueco `M-MP-03.1` de la matriz.

Lo mismo aplica a §54 y al precio final: publicar al consumidor un precio que no es el que se
cobra tiene consecuencias (ver `M-MP-01`).

### M-LEGAL-02 — Falta la finalidad declarada de las señales de identidad

`BD-TRIAL-02` propone guardar señales para detectar la misma identidad. Guardar datos
personales para negar un servicio requiere declarar la finalidad, el plazo de conservación y
cómo se responde a un pedido de acceso o supresión — que además puede llegar **antes** de los
180 días del §25.

Igual que arriba: hay que verificarlo con asesoramiento, no resolverlo por analogía.

### M-LEGAL-03 — Falta la política de notificación de aumento

§29 pide avisar, mostrar precio anterior y nuevo, fecha efectiva y permitir cancelación. No
pide **plazo de preaviso**, ni **canal**, ni **cómo se prueba después que el aviso se envió**.

Lo último es lo que decide un reclamo: si un cliente dice que no le avisaron, lo que vale es la
evidencia del envío. Se cruza con §44 (el outbox debe dejar registro del intento).

### O-LEGAL-01 — El comprobante no fiscal es una decisión de riesgo, no un paso neutro

§54 ordena que hasta integrar ARCA cada cobro genere un comprobante o recibo PDF y que **no**
se lo llame factura fiscal. §53 difiere ARCA salvo decisión separada.

No es una objeción al diseño: es pedir que quede registrado como **decisión consciente y
firmada**, con sus consecuencias impositivas asumidas, en vez de quedar como un detalle de
implementación. Y que se diga si hay o no fecha de revisión, porque "cuando entre ARCA" no es
una fecha.

---

## 10. Emails y outbox

### M-MAIL-01 — Falta declarar el huso horario como invariante

§10.7 y §42 definen ventanas en días: *"10 días antes"*, *"-1 día"*, *"+60 días"*. Un cálculo
hecho en un huso distinto al del destinatario **manda el correo el día equivocado** para una
parte de la audiencia, y una ventana de "últimos N días" cuenta mal.

Con el mercado declarado como Argentina (§29 nombra su normativa, §6 su terminología), debe
ser un invariante explícito del diseño y no una convención que cada proceso reinventa.

### M-MAIL-02 — El outbox garantiza registro, no unicidad

§44 exige que *"el intento de notificación quede registrado"*, con estados pending,
processing, sent, failed, retry, provider id y attempts. Eso es un registro del intento, no
una garantía de que el intento sea único.

Falta una **clave de deduplicación** por destinatario, vertical, plantilla, schedule y
ocurrencia, para que un proceso que corre dos veces — o un reintento, o dos instancias en
paralelo — no mande dos veces. Se cruza con §51 (idempotencia) y §52 (concurrencia).

### M-MAIL-03 — Falta la jerarquía de supresión, y la distinción transaccional/comercial

§42 pone los schedules en DB y §43 garantiza que un fallo de correo no afecta al dominio. No
hay nada sobre supresión: opt-out, rebote duro, cuenta borrada, tope diario.

Y sobre todo falta la distinción que lo ordena todo:

- **Transaccionales no suprimibles**: aviso de aumento (§29), fallo de cobro (§20), aviso de
  vencimiento, avisos previos al borrado (`C-DATA-01`).
- **Comerciales suprimibles**: la campaña de recuperación del §10.7.

Mezclarlas es a la vez un problema legal y de reputación del dominio de envío. Y si se
suprimen las dos juntas, se dejan de mandar avisos que son obligatorios.

### M-MAIL-04 — Falta decidir qué comunica el proveedor de pagos por su cuenta

El PDR diseña con cuidado qué correos manda Hospeda (§42, §10.7, §42.2, §42.3) y no dice nada
sobre los que pueda mandar el proveedor de pagos cuando se cancela, se pausa o se modifica una
autorización de débito.

Si el proveedor le escribe al cliente por su cuenta, hay un correo que nosotros no redactamos
y no controlamos, con nuestro nombre en el asunto y sin nuestro contexto.

Hay que averiguarlo en FASE 1C (es una fila de la matriz, no una suposición) y, si es así,
decidir la política: **llegar antes con una explicación nuestra** es lo único que se puede
controlar.

---

## 11. Concurrencia e idempotencia

### M-CONC-01 — Falta la clave de idempotencia del lado nuestro

§51 pide diseñar explícitamente para *"double click"*, retries, webhooks duplicados,
out-of-order, jobs duplicados y fallos de red.

Pero la idempotencia del webhook **no resuelve el doble click**: el doble click ocurre antes,
del lado nuestro, y produce dos autorizaciones de débito. Hace falta una regla de negocio de
"un solo intento vivo por persona y vertical", con vencimiento, además de la idempotencia del
lado del provider. Se cruza con `M-MP-02` y con el estado faltante de `M-SUB-01`.

### M-CONC-02 — Falta la regla de no-retroceso de estado

§51 nombra *"out-of-order"* como escenario a cubrir, y §64.18 dice que *"MP gobierna hechos
ocurridos en MP"*. Para poder aplicar eso hace falta un orden confiable de los eventos del
proveedor (`M-MP-03.3`) más la regla explícita de que **un evento viejo nunca sobrescribe un
estado más nuevo**.

§51 enuncia el objetivo; falta el mecanismo.

### E-CONC-01 — Los cruces del §52 necesitan respuesta nominal

§52 los enumera en abstracto — pago + cancelación, pago + pausa, webhook + cambio de plan,
addon + downgrade, admin + cliente, múltiples webhooks — y pide definir límites de
transacción, restricciones únicas, locks, concurrencia optimista e idempotency keys.

Cada uno necesita una respuesta escrita, no una categoría. En concreto:

- un pago se acredita mientras corre el proceso que suspende por falta de pago;
- se solicita la cancelación mientras entra un cobro;
- se otorga un Free Forever mientras se está ejecutando un cobro;
- se compra un addon mientras se aplica un downgrade que reduce su base;
- un admin registra un pago manual (§30) mientras la persona paga por el proveedor — **doble
  cobro real, con dinero de verdad**;
- dos instancias procesan el mismo evento en paralelo.

### M-CONC-03 — §22 describe el juicio pero no quién lo hace

§22 dice que ante un pago tardío hay que evaluar timestamp real, estado del pago, suscripción,
posible suscripción nueva y posibles dobles cobros, y que *"si es seguro: reactivar"*.

Falta decir **qué hace exactamente que sea seguro**. Si el criterio queda implícito, cada
implementación va a trazar la línea en otro lado, y del lado equivocado hay reactivaciones
indebidas o dinero retenido sin servicio.

---

## 12. Admin, auditoría y observabilidad

### M-ADMIN-01 — §48 pide inspeccionar; falta el catálogo de acciones

§48 enumera veintiún cosas que el admin debe poder **inspeccionar**. No enumera ninguna que
pueda **hacer**, aunque el resto del PDR se las asigna: otorgar cortesías (§34) y grants
(§35), registrar o confirmar pagos manuales (§30), aprobar o rechazar postulaciones de Partner
(§17.3), configurar el plan y el método de pago de un Partner (§17.3), y resolver un
`RECONCILIATION_REQUIRED` (§22.1).

Cada acción necesita: **permiso propio, registro de auditoría, y confirmación explícita si es
destructiva o mueve dinero**. Se cruza con `M-AUTH-02`.

### R-OBS-01 — Un correo por cada `RECONCILIATION_REQUIRED` apaga el canal

§22.1 ordena, **siempre** que el sistema llegue a ese estado: registrar evento crítico,
generar información suficiente, **enviar email a `SUPER_ADMIN`**, mostrar alerta en Admin si
corresponde, y evitar decisiones destructivas automáticas.

El requisito real, que el propio §22.1 enuncia al cerrar, es *"que SUPER_ADMIN esté al tanto y
pueda intervenir"*. Un incidente de webhooks genera cientos de eventos idénticos: si cada uno
manda un correo, el canal deja de leerse **justo cuando importa**.

→ **S-OBS-01**: el listado accionable en Admin como canal primario (que §22.1 ya contempla),
más un correo **agregado** con límite de frecuencia y resumen, en vez de uno por evento. Se
cumple el objetivo del §22.1 sin cumplirlo literalmente; por eso va como decisión y no como
detalle.

### M-OBS-01 — Falta quién genera el identificador de correlación

§50 lista los campos que todo log estructurado debe llevar, incluido `correlation id`. No dice
**quién lo genera** ni **cómo viaja** desde el click de la persona hasta un webhook que llega
tres días después.

Sin esa cadena los campos están presentes pero no se pueden unir, que es justamente para lo
que servían.

### M-AUDIT-01 — Falta definir qué es un evento de dominio auditable

§49 pide registrar *"eventos de dominio completos"* y no limitarse a logs técnicos. §35.4
detalla los campos para un caso puntual (Free Forever) y ningún otro.

Falta la lista de qué eventos se auditan y con qué campos mínimos, y falta decir si el registro
de auditoría es **inmutable** — porque si se puede editar, no sirve para lo que §29 y §35.4
lo necesitan.

---

## 13. Partner

### C-PARTNER-01 — §17 le da trial y §17.3 se lo hace imposible

§17 dice que Partner usa el mismo motor de *"trial; plans; billing; subscriptions;
entitlements; limits; promo; courtesy; addons"* y que *"difiere solo en su funcionalidad
específica"*.

§17.3 dice que Partner **no es self-service**, que hay exactamente dos caminos de alta
(postulación aprobada por admin, o alta directa por admin), que *"NO existe tercera opción
self-service"*, y que en ambos el admin configura el plan y el método de pago.

Un trial disparado por una acción del usuario (§10.4) no encaja en un alta administrada. Y
Partner no tiene listing estándar (§6), así que tampoco tiene el evento del §10.4. Está escrito
como que tiene trial y descrito como que no puede tenerlo.

**BLOCKING**: si Partner tiene trial hay que declarar su evento equivalente, como §10.4 exige;
si no lo tiene, el motor tiene que soportar que una vertical no lo tenga sin volverse un caso
especial (§7).

### A-PARTNER-01 — Qué cuentan los limits de Partner

§17.1 dice que Partner Gold *"puede contar con página propia"*, que es *"una presencia pública
similar funcionalmente a una ficha"*, y ordena expresamente **no forzar la entidad Partner
dentro del modelo Listing** sólo por esa semejanza.

Pero medio sistema está escrito sobre fichas: §12 dice que una suscripción cubre todas las
fichas de la vertical y que la cantidad se controla con limits; §40 define el scope `LISTING`;
§10.5 limita a una ficha durante el trial.

Si Partner no tiene fichas, hay que decir **qué cuentan sus limits** y **a qué se aplica un
addon de scope `LISTING`** en su caso — o declarar que esos conceptos no aplican a Partner, que
es una respuesta legítima pero tiene que estar escrita.

### M-PARTNER-01 — Falta el ciclo de vida de la postulación

§17.3 describe el camino A en nueve pasos, incluido *"si rechaza: se comunica
correspondientemente"*. Falta: ¿la postulación es una entidad con estados propios?, ¿se puede
volver a postular después de un rechazo?, ¿hay plazo?, ¿qué pasa si el email ya corresponde a
un usuario existente que **no** es quien postula?

El paso 6 ordena crear el usuario si no existe y pedirle que valide el email y complete el
perfil. Falta qué pasa si nunca lo hace: queda un Partner aprobado con un usuario fantasma.

---

## 14. Migración

### BD-MIG-01 — Qué se le promete a quien hoy está pagando

§56 dice que si migrar automáticamente agrega mucha complejidad o riesgo conviene *"preferir
coordinación manual y nueva subscription"*, y que **no** hay que contaminar la arquitectura
nueva para salvar unas pocas relaciones legacy.

"Nueva subscription" significa, en concreto, pedirle a alguien que ya está pagando que
**vuelva a autorizar un débito automático**. Algunos no lo van a hacer.

Es una decisión de negocio antes que técnica, y condiciona cuánta compatibilidad hacia atrás
tiene que cargar el diseño nuevo — que es justo lo que §56 quiere evitar. **BLOCKING.**

### O-MIG-01 — §56 apoya su conclusión en un número que no da

§56 razona: *"Como hay pocos customers actuales: si migrar automáticamente agrega mucha
complejidad/riesgo: preferir coordinación manual"*.

La premisa *"hay pocos customers actuales"* es una afirmación sobre el estado real del
sistema, **sin número**. Toda la preferencia por la coordinación manual descansa en ella, y
también descansan ahí `BD-MIG-01` y el tamaño del riesgo de `R-MIG-01`.

Antes de apoyarse en esa premisa hay que **medirla**, no heredarla. Ver `O-METH-02`.

### R-MIG-01 — No se puede parar el cobro mientras dura el rediseño

§2 y §56 hablan de preferir rewrite y de no contaminar la arquitectura nueva, pero **no de
cómo se convive mientras tanto**. Si hay débitos automáticos activos, siguen corriendo durante
todo el programa, y §65 pone la implementación en FASE 10.

Las opciones son tres y hay que elegir explícitamente: coexistencia de dos motores, corte con
migración asistida, o congelamiento temporal de altas nuevas. Es el riesgo operativo más
grande del programa y el PDR lo deja para FASE 7.

### M-MIG-01 — Falta el criterio de corte del trial ya consumido

Si alguien consumió un trial bajo reglas distintas — otro alcance, otra duración, otro
disparador — ¿arrastra el consumo al modelo nuevo, o el contador arranca limpio?

§10.1 fija el alcance nuevo en `user + vertical`. Si el alcance anterior era otro, el mapeo no
es obvio, y §64.1 dice que el trial es máximo una vez por `user + vertical` sin período de
gracia para el pasado.

---

## 15. Objeciones a la metodología del propio PDR

### O-METH-01 — "Cerrar todas las decisiones funcionales" no puede completarse en 1A

§0 pide, en orden: definir el dominio, **cerrar todas las decisiones funcionales**, verificar
Mercado Pago, diseñar la arquitectura y recién después contrastar contra el código.

Pero cuatro decisiones funcionales de peso dependen de hechos de Mercado Pago que §58 exige
comprobar experimentalmente y que el propio PDR marca `PENDING MP VALIDATION`: el mecanismo de
pausa (§26.4), la cortesía sobre una suscripción viva (§34.2), el cambio de precio sobre
vigentes (§29) y el efecto económico del upgrade (§27).

No es una contradicción, es una consecuencia: **el paso 2 no cierra del todo antes del paso
3**, y una parte de las decisiones funcionales queda condicionada a FASE 1C por diseño. Conviene
decirlo ahora para que más adelante no se lea como un incumplimiento, y para que esas
decisiones se tomen **una sola vez, después del experimento**, en vez de tomarse ahora y
revisarse después.

### O-METH-02 — Varias decisiones de 1A dependen de números que todavía no se midieron

`BD-MIG-01`, `R-MIG-01`, `O-MIG-01` y el dimensionamiento de `BD-TRIAL-02` dependen de cuántos
clientes reales hay, en qué estado, y con qué compromisos de cobro vivos.

§4 permite explícitamente *"ejecutar queries"* e *"inspeccionar DB"*, así que medirlo no
rompe ninguna prohibición. Pero §67 ordena no empezar FASE 1B hasta que el owner responda 1A, y
una medición de producción está cerca de esa línea.

**Es una pregunta para el owner, no una decisión mía** (pregunta 24): si autoriza conteos
read-only, se miden en el momento de usarlos y se registran con fecha y método; si no, las
decisiones que dependen de ellos se toman sin ese dato y hay que decirlo explícitamente.

Los conteos son restricciones de realidad, no arquitectura legacy: contar filas no es lo mismo
que leer cómo está escrito el sistema, que es lo que §0 y §67 prohíben.

### O-METH-03 — §2 pone la carga de la prueba, pero no dice qué se rinde

§2 dice que *"La carga de prueba debe estar del lado de conservar código legacy. No del lado de
justificar reescribirlo"*, y §"FASE 5" define `KEEP` como *"sólo si estamos prácticamente 100%
seguros"* de cinco cosas.

Esa frase sólo tiene efecto si existe algo **concreto que rendir**. Sin un criterio operable,
la carga se invierte sola, porque conservar nunca requiere defensa activa y reescribir siempre
sí. Y con el programa atravesando varias ventanas de contexto (§3.3), dos piezas equivalentes
se clasifican al revés en sesiones distintas y nadie lo nota.

**No propongo el criterio ahora**, y es deliberado: diseñarlo sin las piezas delante produce
reglas que no encajan. Lo que sí propongo es que **definirlo sea la condición de entrada de
FASE 5** y que, sea cual sea, **toda clasificación lleve su argumento escrito**.

Una trampa concreta a evitar cuando se defina: cualquier criterio del tipo "no nombra ninguna
vertical en su lógica" manda **todo el Eje 2 a `REWRITE` por definición**, porque §8 define el
Eje 2 como comportamiento específico de vertical. El criterio tiene que decir explícitamente
cómo trata al Eje 2.

### S-METH-01 — Falta declarar cuándo una decisión se considera caduca

§3.5 exige distinguir CURRENT, LEGACY, OBSOLETE y SUPERSEDED, y §3.4 pide registrar si una
decisión reemplaza a otra. Falta el caso intermedio: una decisión que sigue vigente pero cuyo
**fundamento** puede haber cambiado.

Varias decisiones de este programa van a apoyarse en condiciones que hoy son ciertas y mañana
no (cuántos clientes hay, qué ciclos existen, qué verticales tienen contenido). Conviene que
cada decisión que dependa de una condición así **la declare explícitamente**, para que se pueda
revisar cuando cambie en vez de sobrevivir por inercia.

---

## 16. Preguntas concretas para el owner

Ordenadas por impacto. Las **[BLOCKING]** frenan FASE 2 (§0). Se pueden responder por número.

1. **[BLOCKING]** ¿Un plan es mutable, o se versiona y las suscripciones quedan ancladas a la
   versión con la que contrataron? Y si se versiona: ¿qué cambio dispara una versión nueva?
   (`BD-ARCH-01`)
2. **[BLOCKING]** ¿Cómo se ordenan los planes para poder decir "el más premium" y "el más
   básico" del §10.3? ¿Y qué planes participan de ese orden — entran los retirados, los
   internos, los que no se ofrecen? (`BD-ARCH-02`)
3. **[BLOCKING]** El máximo de una ficha en trial (§10.5), ¿es un override sobre los limits
   derivados de Basic, o una regla aparte que se aplica encima? ¿Y es configurable por
   vertical, como pide §9? (`C-TRIAL-01`)
4. **[BLOCKING]** La derivación del Trial Plan, ¿es en vivo o se congela al arrancar el trial?
   Concretamente: si Basic **baja** un límite en mitad de un trial, ¿el trial baja también?
   (`BD-TRIAL-01`)
5. **[BLOCKING]** Matriz de cambio de plan: de las seis celdas sin política (tier ↑/=/↓ ×
   ciclo ↑/↓), ¿cuáles son inmediatas y cuáles esperan al fin del ciclo? (`BD-SUB-01`)
6. **[BLOCKING]** ¿Partner tiene trial? Si sí, ¿cuál es su evento de inicio dentro de un alta
   administrada por admin? (`C-PARTNER-01`)
7. **[BLOCKING]** ¿Qué se le promete a quien hoy está pagando: migración transparente, o que
   vuelva a autorizar el débito? (`BD-MIG-01`)
8. **[BLOCKING]** ¿Qué señal define "la misma identidad" para el trial de por vida, y qué
   costo de falso positivo estás dispuesto a aceptar — negarle el trial a un cliente legítimo?
   (`BD-TRIAL-02`)
9. ¿Turista tiene trial? Si sí, ¿lo dispara el botón `Empezar` del §47, o algo más?
   (`M-TRIAL-01`)
10. ¿Qué puede hacer alguien que entró a una vertical y todavía no publicó — cuántos
    borradores, por cuánto tiempo, con qué capacidades? (`M-TRIAL-02`)
11. ¿La publicación de una ficha es inmediata, o media algún paso antes de que se vea?
    (`A-TRIAL-01`; de esto depende `E-TRIAL-01`)
12. ¿El trial regala *todos* los entitlements de Premium, incluso los que cuestan dinero por
    uso? ¿O los medidos llevan una cuota propia de trial? (`R-TRIAL-01`, `OD-ENT-01`)
13. Herencia de Turista VIP (§16): ¿se heredan entitlements, limits, o ambos? ¿Y qué pasa con
    quien además ya paga Turista VIP por su cuenta — se le impide comprarlo, se le cancela, se
    le devuelve? (`A-ENT-01`)
14. ¿El grace de 10 días es una constante del dominio, o un default configurable desde DB? Si
    es configurable: ¿por plan, por vertical, o global? (`C-SUB-01`)
15. ¿Se puede cambiar de plan estando en `GRACE_PERIOD` por impago? (`E-SUB-03`)
16. La ventana de límites de pausa del §26.3, ¿se cuenta por `user + vertical` o por
    suscripción? (`OD-SUB-01`)
17. Un addon de scope `LISTING` sobre una ficha que se borra, o que queda despublicada por
    suspensión: ¿se pierde, se congela el reloj, se libera para reasignar? (`E-ADDON-01`,
    `E-ADDON-02`)
18. ¿Hay cupo total de canjes y ventana de validez por promo code, además del límite de un uso
    por persona? (`M-PROMO-01`)
19. El scope "todas las verticales actuales y futuras" (§31, §34, §35.1): ¿sin tope ni
    vencimiento, aunque eso signifique que una vertical nueva nazca regalada? (`OD-PROMO-01`)
20. Free Forever y el dinero ya cobrado (§35.3): ¿se reembolsa el período en curso o se deja
    correr? ¿Y qué pasa al **revocar** el grant, si la autorización de débito vieja ya no se
    puede reanudar? (`M-GRANT-01`)
21. Cortesía temporal (§34): ¿la puede otorgar cualquier admin, o también es exclusiva de
    `SUPER_ADMIN` como el Free Forever del §35? (`A-GRANT-01`)
22. Retención: ¿el soft delete del día 90 oculta la ficha también para su dueño, o sólo del
    público? ¿Avisamos antes del día 90 y antes del día 180? (`C-DATA-01`)
23. ¿Confirmás avanzar con comprobante no fiscal hasta ARCA como decisión registrada, y con o
    sin fecha de revisión? (`O-LEGAL-01`)
24. ¿Autorizás conteos read-only sobre la base de producción durante 1A, para las decisiones
    que dependen de cuántos clientes reales hay? (`O-METH-02`)
25. ¿Aceptás que el criterio de `KEEP` / `ADAPT` / `REWRITE` se defina **al empezar FASE 5**,
    como su condición de entrada, en vez de ahora? (`O-METH-03`)

---

## 17. Lo que NO se hizo en esta fase

Por prohibición explícita del PDR (§4, §67):

- **No se miró código**, ni esquema, ni migraciones, ni tests, ni jobs, ni superficies.
- No se consultó documentación del repo, sistemas de tracking, ni memoria de sesiones previas.
- No se propuso arquitectura, entidades ni esquema de DB — eso es FASE 2.
- No se clasificó nada del sistema actual como `KEEP` / `ADAPT` / `REWRITE` — eso es FASE 5,
  y su criterio ni siquiera está definido (`O-METH-03`).
- No se ejecutó ninguna prueba contra Mercado Pago — eso es FASE 1C. Toda la sección 4 son
  hipótesis marcadas como tales.
- No se midió nada de producción — está pendiente de `Q-24`.
- **No se completó ningún hueco en silencio**: todo lo que el PDR no dice está marcado arriba
  con un ID.

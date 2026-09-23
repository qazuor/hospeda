---
title: Master Spec 16 — Addons
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-21
status: CURRENT
fase: 2
capitulo: 16
cierra:
  - A-ADDON-01
  - A-ADDON-02
  - E-ADDON-03
  - E-ADDON-04
---

# 16 · Addons

El §39 ya separó bien **producto** de **instancia**, y el capítulo 02 §2.4 los modeló como dos
tablas. Los cuatro huecos de este capítulo están un nivel más abajo, y tres de ellos son la misma
omisión: **el PDR describe el addon por cómo se paga y nunca por cuánto dura.**

---

## 1. Dos ejes, no uno · cierra `A-ADDON-01`

### 1.1 La taxonomía del §38 mezcla dos preguntas

El §38 define dos tipos, *«one-time»* y *«recurrent»*, y los propios ejemplos del §40.1 lo
desarman:

- **«+5 fichas»** se cobra una vez y el efecto dura **mientras exista la suscripción**. No es
  efímero, y no es recurrente.
- **«Boost 7 días»** se cobra una vez y dura **una semana**.

Con un solo eje los dos caen en la misma caja y se implementan igual.

### 1.2 Los dos ejes

**El producto declara los dos, por separado:**

| eje | valores | qué determina |
|---|---|---|
| **cobro** | `UNA_VEZ` · `PERIÓDICO` | si hay una **suscripción de complemento** detrás (`DEC-ADDON-002`) |
| **vigencia** | `DÍAS_FIJOS` · `MIENTRAS_VIVA_LA_SUSCRIPCIÓN` | cuándo termina la **instancia** |

Cada eje tiene una consecuencia y no se pisan: el cobro decide si existe un preapproval propio,
la vigencia decide cuándo se apaga la capacidad.

### 1.3 Las combinaciones que existen son tres, y las otras no son casos raros: no existen

| | `DÍAS_FIJOS` | `MIENTRAS_VIVA_LA_SUSCRIPCIÓN` |
|---|---|---|
| **`UNA_VEZ`** | ✅ *Boost 7 días* | ✅ *+5 fichas* |
| **`PERIÓDICO`** | ❌ | ✅ el addon recurrente del §38 |

**`PERIÓDICO` + `DÍAS_FIJOS` no existe**: cobrar todos los meses algo que dura siete días es, o
una contradicción, o en realidad un addon que se renueva — o sea la casilla de al lado con otra
granularidad. Admitirla obligaría a resolver qué pasa entre el fin de la vigencia y el cobro
siguiente, que es un hueco fabricado por la taxonomía.

**Y no hay vigencia `PERMANENTE`**, aunque parezca la tercera opción natural. Una capacidad
concedida para siempre por un pago único es un pasivo sin fecha de cierre, y **ya existe la
entidad que hace exactamente eso**: el grant permanente del §35, que es una fuente
independiente (cap. 01 §1.5). Dos mecanismos para lo mismo es cómo se llega a lo que el §1
describe.

---

## 2. Qué es una suscripción «válida» · cierra `A-ADDON-02`

### 2.1 La palabra que falta

El §38 dice que los addons *«sólo pueden adquirirse teniendo una subscription válida
compatible»*. **«Compatible» sí está definido** —el §39 hace que el producto declare sus
*«compatible verticals»*—; **«válida» no**, y el estado importa mucho.

### 2.2 Válida es `ACTIVE`, y sólo `ACTIVE`

Comprar un addon **toca plata**, así que se elige hacia dónde falla: **hacia no vender.**

| estado (cap. 03 §3) | ¿vale? | por qué |
|---|---|---|
| `PENDING_AUTHORIZATION` | **no** | se comprarían complementos sobre algo que puede no autorizarse nunca; el capítulo 03 le da su ventana —**72 h o 7 días corridos, según el método de pago**, `B/03` §3.4 punto 1— y después muere |
| **`ACTIVE`** | **sí** | es el único |
| `GRACE_PERIOD` | **no** | el servicio corre, pero hay un cobro que no entró: venderle algo más a quien no pudo pagar lo anterior es agrandarle la deuda |
| `PAUSED` | **no** | el servicio está detenido: no hay nada que complementar. Y `EX-11` midió que estando pausada el proveedor **rechaza toda modificación** |
| `SUSPENDED` | **no** | *«sin entitlements comerciales»* (§21) |
| `CANCEL_SCHEDULED` | **no** | se conoce la fecha en que se va; venderle un addon ahí es fabricar un huérfano con fecha |
| trial, sin suscripción | **no** | §38, invariante §64.7 y capítulo 11 (épica de verticales) §5 |

### 2.3 Por qué `GRACE_PERIOD` no vale si ahí sí se puede cambiar de plan

Parece incoherente con `DEC-SUB-003`, que permite cambiar de plan en grace, y no lo es:

**cambiar de plan en grace es la salida del problema** —bajarse a algo más barato es cómo alguien
se recupera de un impago, y por eso esa decisión lo permite con cobro inmediato—. **Comprar un
addon es lo contrario: gastar más.** La misma regla aplicada a dos actos que van en direcciones
opuestas daría el mismo resultado, y por eso la regla no es el estado: es qué hace el acto.

### 2.4 Y hay una excepción, forzada por el §35.3

**Un grant permanente vale como título en lugar de la suscripción `ACTIVE`.** No es una
concesión: es obligatorio, porque el §35.3 ordena *«cancelar toda obligación de pago cubierta»* —
el beneficiario de *Free Forever* **no tiene suscripción** — y el §35.2 contempla explícitamente
que use addons.

**Y vale en la vertical donde el grant ANCLÓ, no en todas.** Un grant emite una fuente por cada
vertical de su scope y cada una transporta el plan **de esa vertical**
(`12-contrato-de-cobertura.md` §2.8, `B/02` §2.4): es título en Gastronomía porque ancló un plan de
Gastronomía, no por el solo hecho de que el beneficiario tenga un grant. En una vertical donde no
ancló nada **no emite fuente**, así que ahí no hay título que reemplace a la suscripción y el addon
se adquiere como cualquier otro.

**Y vale mientras el grant esté VIVO, que es la otra mitad de la misma frase.** El predicado es
*«hay un **ancla viva** en esa vertical»* (`NUCLEO/01` §2.4): un grant revocado no emite ninguna
fuente, así que deja de ser título en las N verticales a la vez. Se lee sobre
`permanent_grant.revocado_en` (`B/02` §2.4) y no sobre la existencia de la fila del ancla, que
**sobrevive a la revocación** a propósito.

Sin esta excepción, `includesAddons: true` sería una configuración **inalcanzable**: una opción
que existe en la base, se puede encender, y no hace nada. Un control por exclusión que se olvida
de un título nuevo no falla ruidosamente; deja una funcionalidad muerta y nadie se entera.

---

## 3. El addon a costo cero · cierra `E-ADDON-03`

El §35.2 con `includesAddons: true` dice que *«addons compatibles pueden utilizarse a costo $0»*
y que **no** se activan automáticamente. De ahí salen **cuatro** preguntas, y la cuarta es de otro
orden que las tres primeras: **éstas describen el addon que todavía no existe** —alguien con el
grant que después quiere un destaque— y la cuarta es **la que nadie había escrito**, la del addon
que la persona **ya tenía comprado** el día que le cae el grant (§3.4).

### 3.1 No hay pago de cero ni comprobante de cero

**No se registra un `payment`**, porque un `payment` es el registro de **un hecho en el
proveedor**, con su identificador y su fecha (cap. 02 §2.3), y acá no hubo hecho. Un pago de cero
sin contraparte es una fila que después aparece en toda conciliación como una discrepancia que
hay que explicar cada vez.

**Y no se emite comprobante**, porque el §54 lo emite *por cada cobro* y no hubo cobro. Un
comprobante de cero es un documento que certifica que no pasó nada.

**Lo que sí se registra es el origen**: la instancia dice que su título es **el grant**, del mismo
modo que una instancia recurrente dice cuál es su suscripción de complemento. Es un campo que el
modelo ya necesita, no uno nuevo.

### 3.2 «No activarlos automáticamente» significa que los elige la persona

El grant **habilita**; no enciende. La persona elige cuáles de los addons compatibles quiere, uno
por uno, y esa elección es un acto suyo con su registro.

Es coherente con `DEC-GRANT-001`, que ya separó conceder de ejecutar, y evita el desenlace
absurdo de que revocar un grant tenga que apagar quince cosas que el beneficiario nunca pidió.

**Y esta regla rige sobre el addon que NO existe todavía, que es de lo único que habla.** *«Elegir
cuáles quiere»* presupone que no los tiene; *«apagar quince cosas que nunca pidió»* presupone que
el grant las encendió. Para el addon que la persona **ya venía pagando** las dos premisas son
falsas —ya lo eligió, y con plata—, así que ahí no hay nada que encender y la regla **no dice
nada**: lo dice el §3.4, y lo que ese § ordena es **automático a propósito**, porque lo que se
automatiza no es una capacidad nueva sino **el fin de un cobro**.

### 3.3 Al revocar el grant, el addon se corta — y nunca se empieza a cobrar

Tres salidas posibles y una sola defendible:

| salida | qué pasa |
|---|---|
| **empezar a cobrarlo** | se le cobra a alguien un monto que **nunca autorizó**. Es la única verdaderamente inadmisible |
| dejarlo correr hasta que venza | sólo significa algo para `DÍAS_FIJOS`, y es una cortesía que nadie decidió |
| **se corta** ✅ | **la fuente era el grant y el grant se fue** |

**Se corta**, y no hace falta regla nueva: es el §36 tal cual —la capacidad vive *«mientras al
menos una source exista»*— aplicado a una instancia cuya única fuente era el grant.

No es duro en comparación con lo que ya pasa: el capítulo 08 §3 registra que revocar un grant es
**la acción administrativa más grave** porque deja al cliente sin grant y sin suscripción, o sea
sin servicio. El addon es lo menos que pierde, y la confirmación del capítulo 08 §3.1 tiene que
nombrarlo igual.

**Y esto alcanza igual al addon que el §3.4 convirtió a costo $0, que es el caso que duele.** Ahí
la persona **no recibió el addon de regalo: lo venía pagando**, y la revocación se lo apaga sin
devolverle el débito que le cancelamos. **No pasa nada más: no se reanuda la suscripción de
complemento vieja y no se compensa.** Las tres razones ya estaban escritas y ninguna es de acá:
cancelar en el proveedor **es irreversible** (`PA-5`), `DEC-GRANT-001` dice que al revocar *«no se
reanuda el débito viejo: hay que pedirle al cliente que autorice uno nuevo»*, y `DEC-TRIAL-009`
fija el criterio de por qué revocar **no repara** —el acto no es un error sino una decisión
legítima, y la persona **estuvo cubierta de verdad** todo lo que duró el grant—. **Si lo quiere de
nuevo, vuelve a suscribirse.**

**Qué transición lo ejecuta, porque son dos caminos y sólo uno estaba escrito.** Para un addon de
scope `VERTICAL_SUBSCRIPTION` lo ejecuta la condición de huérfano: al caerse el grant deja de
relevarlo la **tercera mitad** del §4.2, el objetivo vuelve a estar muerto y `A5` lo cancela. Para
los otros tres scopes **el objetivo nunca murió** —`LISTING` es una ficha que sigue ahí,
`USER`/`GLOBAL` es la cuenta— así que la condición de huérfano **no se cumple nunca** y, tal como
estaba, *«se corta»* era una frase sin transición que la regla 1 del núcleo no admite. Por eso el
evento de `A5` tiene **una tercera cláusula** —*«se revoca el grant del que cuelga el ancla que
era su título»* (`B/03` §8)— y **cierra los dos casos con una sola regla**: el convertido y el que
el §3.2 dejó elegir gratis desde el principio, que tenía el mismo agujero y nadie lo había
nombrado.

> **Esa cláusula nombra la REVOCACIÓN, y no *«el retiro del ancla»*, por decisión del owner del
> 2026-09-21.** Su primera redacción esperaba un acto —*«retirar un ancla»*— que **no existe en
> ningún catálogo**: el `NUCLEO/08` §3 declara para el grant exactamente **tres** escrituras
> —otorgar, anclarle una vertical nueva, revocar— y tanto el `12-contrato…` §2.8 como el
> `B/02` §2.4 dicen que *«desanclar no está declarado»*. Se eligió **reescribir la cláusula**, no
> declarar un acto nuevo. **La cobertura no se achica**: revocar *«es UNA revocación»* sobre *«UN
> instrumento con UN ANCLA POR CADA VERTICAL»* (`12-contrato…` §2.8), o sea **retira todas las
> anclas de una vez**, así que corta la instancia cualquiera sea el ancla de la que cuelgue y en
> los cuatro scopes. Las otras dos escrituras del catálogo no retiran ninguna: otorgar crea y
> anclar **agrega**. El razonamiento entero está en `B/03` §8, *«el addon cuyo título era el
> ancla»*.
>
> **Y las retira como TÍTULO, no como FILAS.** La revocación escribe `revocado_en` en el
> instrumento (`B/02` §2.4) y las N anclas dejan de ser **anclas vivas** a la vez; sus filas
> siguen existiendo, porque `addon_instance` apunta ahí y la cuarta comprobación del barrido lee
> el ancla **después** de la revocación (`B/09` §3). Sin esa columna, *«se revoca»* era un acto
> que ningún predicado podía leer más tarde.

### 3.4 El addon que la persona YA venía pagando: se convierte a costo $0 en el acto

Las dos frases del §35.2 y del §3.2 —*«pueden utilizarse a costo $0»*, *«habilita; no
enciende»*— están escritas sobre addons **que todavía no existen**. Para el que la persona **ya
tenía comprado** no había acto declarado en ningún capítulo, y la consecuencia no era neutra:
`S13` acota su alcance a *«toda fila viva **principal**»* (`B/03` §3.2), así que **la suscripción
de complemento seguía viva y seguía cobrando** — al beneficiario se le debitaba todos los meses un
addon que su propio flag le declaraba gratis.

> **Al otorgar un *Free Forever* con `includesAddons: true` —y al anclarle una vertical nueva, que
> es el otro disparador de `S13`— los addons compatibles que el beneficiario venía pagando se
> convierten a costo $0: la instancia pasa a colgar del ANCLA como su título y **después** se
> cancela su suscripción de complemento.**

Lo ejecuta **`S20`** (`B/03` §3.2), que es una transición aparte y no una ampliación de `S13`: el
adjetivo *«principal»* del alcance de `S13` **es una acotación con motivo** —sin él los
complementos entraban *«por pertenencia al conjunto»*, que es literalmente lo que el §41 prohíbe—,
y ampliarlo reabriría eso. `S20` **evalúa una condición**, que es lo que el §41 pide.

**Con `includesAddons: false` no corre nada**: el complemento sigue cobrando y el addon sigue
siendo del cliente. El flag no es decorativo en ninguna de sus dos posiciones.

#### Sólo los compatibles, y «compatible» ya estaba definido

El §35.2 dice *«los addons compatibles»*, no *«los addons»*, y **la palabra no se reinterpreta
acá**: compatible es lo que el §39 hace declarar al **producto** —sus *«compatible verticals»*,
`addon_product` en `B/02` §2.4—. `S20` alcanza entonces al complemento cuyo producto declara
compatible **la vertical que el acto ancla**, y para los dos scopes que tienen vertical propia
—`VERTICAL_SUBSCRIPTION` y `LISTING`— pide además que **su objetivo sea de esa vertical**.

**El que no es compatible sigue cobrándose, y no es un olvido**: el grant es título **sólo donde
ancló** (§2.4), así que en una vertical que no ancló no hay título suyo que reemplace nada y el
addon conserva el que ya tenía —una suscripción que el beneficiario sigue pagando y que `S13`
tampoco tocó—. Convertirlo sería regalar el complemento de una vertical que nadie regaló.

> **La fuga del addon `USER`/`GLOBAL` SE DEJA, y está decidido — no es un pendiente.** Un addon
> de scope `USER` o `GLOBAL` compatible con **dos** verticales, en alguien cuyo grant ancla
> **una**, se convierte igual —es un addon compatible— y de paso **queda gratis también en la
> vertical que el grant no ancló**. Es una fuga real, se nombra entera y **se acepta**, por tres
> razones escritas y no por omisión:
>
> 1. **Es la lectura literal del §35.2.** Ese § dice *«los addons compatibles»*, y *«compatible»*
>    es lo que el **producto** declara (§39, `addon_product` en `B/02` §2.4), no *«compatible y
>    además anclado»*. Convertir sólo la mitad del addon pediría una **tercera** noción de
>    compatibilidad —por vertical y por instancia— que ningún § del PDR escribe y que este
>    capítulo acaba de decir que **no se reinterpreta acá**.
> 2. **La población es fina.** Pide las cuatro cosas a la vez: un addon de uno de los **dos**
>    scopes sin vertical propia, un producto que declare **dos o más** verticales compatibles, un
>    grant con `includesAddons: true`, y que ese grant ancle **menos** verticales de las que el
>    producto declara.
> 3. **Acotarla cuesta más de lo que tapa.** La única acotación disponible —exigir que el grant
>    ancle **todas** las verticales que el producto declara— le mete al acto de otorgar una
>    condición que depende del catálogo de addons **del beneficiario**, y la vuelve inestable: un
>    producto que mañana suma una vertical compatible volvería incorrecto un grant ya firmado, y
>    `S20` pasaría a releer el producto para decidir — que es exactamente lo que *«convertir a $0
>    no es volver a comprar»* prohíbe más abajo (*«qué transporta la fuente después de
>    convertirse»*).
>
> **Y no queda como un abierto de `DEC-METH-006`**: ese método admite cerrar con cosas abiertas
> siempre que cada una diga **de qué depende**, y ésta no depende de nada — está elegida. Lo que
> deja es un costo conocido y acotado, del mismo tipo que *«el período ya pagado no se devuelve»*
> de acá abajo: alguien recibe de más, mientras el grant dure. **Y se apaga con el grant, sin
> mecanismo aparte**: al revocarlo, `A5` corta la instancia por su tercera cláusula (§3.3) —en
> las dos verticales a la vez, porque la instancia es una sola—.

#### El período ya pagado no se devuelve

Mismo criterio que `S13` sobre la principal, misma decisión y mismo riesgo declarado: `DEC-GRANT-001`
dice *«se corta el cobro en el acto y no se devuelve lo pagado»*. Entonces, escrito y no implícito:

| qué | qué pasa |
|---|---|
| el período del complemento **ya cobrado** | **no se reembolsa**, y el addon lo sigue usando: el cobro es anterior al regalo |
| un pago del complemento **retenido por `S19`** | **no existe, y por eso `S20` no lo nombra**: `S19` sale de *«la predecesora de una sucesión en curso»* y una fila de complemento nunca lo es. Es la única mitad de `S13` que `S20` no copia, y la diferencia es de población, no de criterio |
| un addon de cobro **`UNA_VEZ`** | **no tiene nada que convertir**: no hay suscripción de complemento (§1.2), ya se pagó entero y **tampoco se devuelve**. Sigue su curso, que es el *«conserva los dos»* del `12-contrato…` §2.4 |

**Por eso el sujeto de `S20` son sólo los `PERIÓDICO`**: son los únicos con una suscripción de
complemento que apagar. Contar los `UNA_VEZ` sería contar una población sin efecto.

#### Qué transporta la fuente después de convertirse

**Nada cambia en la fuente `ADDON`, y eso es el punto.** Sigue transportando **la `addon_version`
que la INSTANCIA ancló al comprarse** y nunca `addon_product.version_id`
([`12-contrato-de-cobertura.md`](../../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md)
§2.3, `B/02` §2.4): son dos preguntas distintas —qué se compró y qué se vende— y **convertir a $0
no es volver a comprar**. Si la conversión releyera el producto, un grant movería a la versión de
hoy un addon comprado hace un año, sin que nadie lo pidiera ni lo notara.

**Lo que sí cambia de referente es el TÍTULO, y eso tiene que ser resoluble igual**, porque el
§2.3 no admite excepciones: *«una fuente sin referencia resoluble no se puede expresar»*. La
instancia registra **el ancla** (`permanent_grant_vertical`), **no *«el grant»***, porque el
título es por vertical (§2.4) y un grant de tres anclas tiene tres títulos distintos: con *«el
grant»* no se podría saber cuál se retira ni a quién corta. Es la columna que `B/16` §3.1 ya daba
por existente y **no existía** —`F-8dA3-007`, `FASE 8-bis-3`—; `B/02` §2.4 la escribe, y la
escribe **una sola vez para los dos orígenes**: el addon elegido gratis del §3.2 y el convertido
de acá.

#### Qué le pasa a la instancia, y son dos casos

| la instancia está | qué le pasa | por qué |
|---|---|---|
| **`ACTIVE`** | **no cambia de estado**: sigue `ACTIVE`, ahora a costo $0, colgando del ancla. **En el acto de la conversión no corre ninguna de `A1`–`A6`** | es un addon comprado que sigue andando; lo único que se apagó es su cobro. En particular **`A5` no corre**, y eso ya estaba resuelto: el grant **releva** al objetivo (§4.2, tercera mitad). La que sí correrá algún día es `A5` **por su tercera cláusula**, cuando se revoque el grant (§3.3) |
| **`PENDING_AUTHORIZATION`** | **no se convierte** —no hay nada comprado todavía— pero **su cobro se cancela igual**, y la instancia muere por `A3` al vencer su ventana. La persona puede elegir el addon gratis en el acto (§3.2) | *«una instancia esperando autorización es una obligación de pago»*: su preapproval está creado y puede completar el checkout sin tener por qué saber que el grant llegó. Es el mismo argumento con el que `PENDING_AUTHORIZATION` entró en el alcance de `S13` y en el `desde` de `A5`. La pantalla de *«esperando que completes el pago»* **deja de ofrecer el enlace en el mismo acto** |

**Y el orden de las dos escrituras es parte de la transición, no una nota de implementación.**
`S20` escribe **primero** el ancla-título sobre la instancia y **después** cancela el cobro, y la
razón es que la cancelación **saca la fila de su propio `desde`** —*«toda fila viva de
complemento»*—: hecha primero, una corrida que muere entre las dos deja la instancia `ACTIVE`,
sin cobro y **con el ancla-título en nulo**, o sea sin el sujeto que la tercera cláusula de `A5`
necesita para apagarla el día que se revoque el grant (§3.3). En `LISTING`, `USER` y `GLOBAL` eso
es **para siempre y sin detector**, porque el objetivo nunca muere (§4.2) y las dos comprobaciones
que podrían verlo miran cosas que en ese estado están sanas. Con el orden declarado, lo que queda
es una instancia ya anclada y un complemento todavía vivo: reanudable, y **es la segunda fila de
la tercera comprobación** (`B/09` §3). El dominio entero está en `B/03` §3.2, *«el orden de las
dos escrituras de `S20`»*.

**Y la condición de huérfano del §4.2 no se toca.** Sus **tres** mitades siguen siendo las mismas
y siguen dando el mismo resultado: el objetivo de un `VERTICAL_SUBSCRIPTION` murió con `S13`, la
tercera mitad —*«ningún grant permanente la releva»*— lo rescata, y por eso *«conserva los dos»*
sigue siendo verdadero. Lo único que cambia es **de dónde sale la plata**, y eso la condición de
orfandad nunca lo miró.

---

## 4. Cuando un addon se apaga · cierra `E-ADDON-04`

### 4.1 No necesita mecanismo propio

Un addon *+5 fichas* que vence deja a la persona con fichas publicadas por encima del límite del
plan. **Eso es exactamente el reconciliador de excedentes del capítulo 15 (épica de verticales) §4**, y el vencimiento
de un addon ya está en la lista que lo dispara (cap. 02 §3.2).

Que el hueco no necesite mecanismo propio **es el resultado**, no una omisión: `M-ENT-02` existía
porque el §28.1 escribía este mecanismo dentro del downgrade, y sacarlo de ahí resuelve éste sin
escribir nada.

Dos precisiones que sí son de acá:

1. **Es uno de los casos con ventana** (cap. 15 (épica de verticales) §4.4): la fecha de vencimiento se conoce de
   antemano, así que el aviso sale **antes** y la persona elige qué baja.
2. **El criterio si no elige es el de `DEC-SUB-008`**: cae lo más reciente primero, y va escrito
   en el aviso.

### 4.2 Cuándo un addon queda huérfano · el §41, concreto

El §41 ordena *«no cancelar ciegamente»* y cancelar *«sólo cuando queda efectivamente
huérfano»*, sin decir qué es eso. **Huérfano es que su objetivo dejó de existir**, y el objetivo
lo da el scope:

| scope (§40) | queda huérfano cuando |
|---|---|
| `LISTING` | la ficha **se borró** — y `DEC-ADDON-001` ya decidió que eso lo **consume**: no se libera ni se reasigna |
| `VERTICAL_SUBSCRIPTION` | la suscripción de esa vertical **dejó de ser fila viva** (`NUCLEO/01` §2.4), **ninguna sucesión la releva** —su `sucedida_por` es nulo (`B/02` §2.2) **y no hay una fila viva con `sucede_a` apuntándola**— **y ningún grant permanente la releva**: no hay en esa vertical un **grant vivo** —o sea un **ancla viva**: una fila de `permanent_grant_vertical` cuyo grant tenga `revocado_en` nulo (`NUCLEO/01` §2.4, `B/02` §2.4)— que valga como título (§2.4) |
| `USER` · `GLOBAL` | la cuenta se borró |

> **«Huérfano» acá es el addon cuyo objetivo murió.** No confundirlo con la *«huérfana»* del
> capítulo 09 §2.2, que es un recurso **del proveedor sin fila nuestra**. Son dos palabras iguales
> con dos sujetos opuestos, y ningún mecanismo de uno sirve para el otro.

**La condición se escribió de nuevo parte por parte, y cada una arregla lo contrario de la
anterior.** Son **tres**: qué significa que el objetivo murió, qué lo releva por sucesión y qué lo
releva por grant.

**Uno: *«dejó de ser fila viva»*, no *«llegó a `CANCELLED`»*.** `CANCELLED` es **uno** de los tres
estados en que una suscripción deja de tener autorización que pueda cobrar; los otros dos son
`ABANDONED` y `CHARGE_DECLINED` (`NUCLEO/01` §2.4). Con la condición atada a `CANCELLED`, el addon
de alguien cuya suscripción murió en `CHARGE_DECLINED` **no quedaba huérfano nunca**, y su
preapproval seguía cobrando todos los meses. **Y el detector del §4.3 no lo alcanzaba**, porque
lo que ese detector busca es *«un addon en estado terminal con su preapproval vivo»* y acá el
addon **no** está en estado terminal: nadie lo declaró huérfano, así que la discrepancia no
existe para el barrido. Fallaba hacia cobrarle a quien ya no es cliente, que es la dirección que
el §4.3 llama la que no puede fallar.

**Dos: *«`sucedida_por` es nulo»*, no *«no tiene sucesora»*.** Un upgrade lleva la predecesora a
`CANCELLED` **siempre**, así que sin esta mitad **todo upgrade cancelaría los addons recurrentes
del cliente en el mismo acto en que mejora su plan** — le cobramos más y le sacamos lo que ya
pagó. Pero *«tiene sucesora»* sólo se podía evaluar buscando una fila con `sucede_a` apuntando a
ésta, y ese puntero **lo limpia `S18` al cerrar la sucesión**: evaluada en cualquier instante
posterior, la condición daba *«huérfano»* siempre, y la salvedad nombraba un estado inalcanzable.
`sucedida_por` es la misma pregunta contra un dato que **no se borra**, así que se puede contestar
tarde: el barrido, una revisión manual o un reconciliador leen lo mismo que el acto.

**Y esa segunda mitad se lee sobre las DOS columnas, porque `sucedida_por` todavía no existe
mientras la sucesión está en curso.** Leerla sólo sobre `sucedida_por` deja pasar el caso
contrario al que arregla: **hasta la FASE 9-bis-3, `S18` sólo la escribía con la sucesora
`ACTIVE`**, y la tabla de ocho transiciones de `B/03` §3.2 enumera **cuatro** por las que la
predecesora deja de ser fila viva **antes** de eso y sola — `S12` (le llegó la fecha de fin de
servicio), `S13` (*Free Forever*), `S16` (el primer cobro de su autorización se rechaza, y
`PA-3` mide que ese cobro llega **entre 26 y 44 minutos** después de autorizar, o sea dentro de la
ventana en que un cambio de plan es legal) y **el espejo de la baja decidida por el proveedor**
(`B/03` §10.1). En las de `S12`, `S16` y el espejo la sucesora sigue viva
esperando autorizar: con una sola columna, el addon de alguien que está **en pleno upgrade** queda
huérfano y se le cancela el preapproval, que es irreversible (`PA-5`) — el mismo daño que la mitad
anterior evita, por una puerta más angosta.

> **Desde que `S18` también sale de `PENDING_AUTHORIZATION` en esos casos** —el arreglo del
> candado `A` vacío, `B/03` §3.2— la ventana de `S12`, `S16` y el espejo se cierra en el acto y
> `sucedida_por` ya está escrita cuando el addon pregunta. **La lectura de dos columnas no sobra por eso**: `S13`
> sigue matando a la sucesora sin que `S18` corra, y la sucesión en curso **normal** —predecesora
> viva, sucesora esperando— es la mayoría de los casos y sólo la contesta `sucede_a`.

Con las dos columnas la línea de tiempo queda cubierta entera, y el predicado parte los **cuatro**
estados de la relación que `B/03` §3.2 enumera en **dos grupos**: **la releva una sucesión** —en
curso, o sea una fila **viva** con `sucede_a` apuntándola; o terminada, o sea `sucedida_por` no
nulo— contra **no hay sucesión que la releve**, que junta *«nunca la hubo»* con *«la que hubo se
murió sin cerrarse»* y es el único grupo en que el addon **puede** quedar huérfano — le falta
todavía pasar la tercera mitad, la del grant. **Los dos casos de ese
último grupo no se distinguen acá a propósito**: para el addon dan el mismo resultado, y por eso
este § cuenta **grupos** donde `B/03` §3.2 cuenta **estados**. Es la misma lectura de dos columnas
que la condición 3 del pago tardío (`B/05` §3) hace por la misma razón, y **no revive lo que la
mitad anterior descartó**: lo que fallaba era `sucede_a` **solo**, porque después del cierre da
*«huérfano»* siempre; acá ese instante lo contesta `sucedida_por`.

**Tres: un grant permanente también releva, y sin esta mitad la mata `S13` por la otra puerta.**
`S13` saca de las filas vivas a la suscripción principal de cada vertical que el grant ancla
(`B/03` §3.2), y un grant **no es una sucesión**: sin esta tercera mitad la condición se cumple
entera en el mismo acto del otorgamiento, `A5` declara huérfano al addon y su preapproval se
cancela *«de inmediato»* — de forma irreversible (`PA-5`) y sin reembolso (`DEC-GRANT-001`). El
beneficiario de *Free Forever* perdería el *«Boost 30 días»* que compró ayer, que es
**exactamente** lo que el contrato dice que no pasa: *«quien tiene *Free Forever* y un addon
**conserva los dos**»*
([`12-contrato-de-cobertura.md`](../../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md)
§2.4). Y no es una excepción nueva: el §2.4 de este capítulo ya declara que **un grant permanente
vale como título en lugar de la suscripción `ACTIVE`**, y *«el objetivo del addon no desapareció»*
es verdadero por la misma razón por la que lo es en una sucesión. **Vale sólo donde el grant
ancló** (§2.4): en una vertical sin ancla no emite fuente, no hay título, y la mitad no aplica.
**Y se vuelve a evaluar como las otras dos**, así que el día que el grant se revoca el addon pasa
a huérfano y se corta — que es lo que §3.3 ya decidía por el otro camino.

> **Esta mitad es la única de las tres que pregunta por algo que hasta la FASE 9-bis-4 no estaba
> en la base.** Las otras dos se leen sobre columnas —el estado de la suscripción, `sucede_a` y
> `sucedida_por`—, y ésta preguntaba por *«un grant vivo»* sobre una entidad que **no declaraba ni
> estado ni revocación**: evaluada el día después del acto, no tenía contra qué contestarse. La
> columna es `permanent_grant.revocado_en` (`B/02` §2.4) y el término quedó definido en
> `NUCLEO/01` §2.4, con su inventario de consumidores. **La lectura no cambió**: lo que cambió es
> que ahora se puede hacer.
>
> **Eso vale para `VERTICAL_SUBSCRIPTION` y para ningún otro scope, y conviene decirlo porque se
> lee como si valiera para los cuatro.** Acá el objetivo **sí** había muerto y lo único que lo
> rescataba era el grant, así que revocarlo devuelve la condición a *«huérfano»*. En
> `LISTING`, `USER` y `GLOBAL` el objetivo **nunca murió** —la ficha y la cuenta siguen ahí—, así
> que un addon de esos scopes cuyo título era el ancla **no queda huérfano al revocar** y esta
> condición no lo alcanza nunca. Lo corta la **tercera cláusula del evento de `A5`**
> —*«se revoca el grant del que cuelga el ancla que era su título»*, `B/03` §8—, que es una puerta
> distinta y hace falta igual. **En `VERTICAL_SUBSCRIPTION` las dos se cumplen en el mismo acto y
> eso no duplica nada**: llegan al mismo `CANCELLED` y la segunda encuentra la instancia ya fuera
> del `desde` de `A5`. **La orfandad mira el OBJETIVO; el corte del §3.3 mira el TÍTULO**, y confundirlos es lo
> que dejaba *«se corta»* sin transición para tres de los cuatro scopes.

**La fila viva es parte del predicado, no un adorno.** En `S13` la sucesora también queda
`CANCELLED` **con su `sucede_a` escrito** (`B/03` §3.2), así que un `sucede_a` apuntándola sin
exigir que quien lo escribe siga vivo volvería a esa predecesora **no huérfana para siempre**, y
*Free Forever* —que el §35.3 manda cancelar *«toda obligación de pago»*— le dejaría los addons
cobrando. Y si la sucesora abandona el checkout (`S3` → `ABANDONED`), deja de ser fila viva y el
addon pasa a huérfano sin que nadie declare nada: **la condición es sobre un estado, así que se
vuelve a evaluar**, igual que el disparador de `S17` y `S18`.

**El re-apunte es un efecto declarado de `S18`, y por eso el orden dejó de importar.** El addon no
se cancela y no se rehace: deja de colgar de la fila vieja y pasa a colgar de la nueva, en el acto
que cierra la sucesión (`B/03` §3.2). Antes decía *«en el mismo acto del upgrade»* sin nombrar
cuál, y era lo único que separaba el camino normal del daño irreversible. Ahora, aunque el
re-apunte se demore, `sucedida_por` ya dice que no hay huérfano.

Es el mismo razonamiento que el contador de promos de `B/14` §2.2, y por la misma razón — **el
objetivo del addon no desapareció, se sucedió**. La suscripción vieja y la nueva son la misma
relación comercial con la persona, y cancelar un addon ahí es **tratar una sucesión como una
baja**.

**Y el complemento es UNA de las DOS cosas que `S18` re-apunta, no la única.** De una suscripción
cuelga además la **redención de promo**, con el mismo modo de falla
—silencioso, sin webhook y sin detector—, y durante una tanda entera la enumeración de efectos de
`S18` nombró sólo a los complementos. **Y cuelga una tercera que desde `DEC-GRANT-007` NO se
re-apunta**: la **cortesía vigente**, que `S18` cierra sobre la predecesora dejándole el saldo de
días, para que `S9` la re-emita sobre la sucesora cuando autorice (`B/14` §4.4). El inventario completo, con qué se re-apunta y qué no, está
en `B/02` §2.6; acá queda dicho para que la promoción del addon **a efecto declarado** no se lea
como que las otras dos ya estaban resueltas.

`DEC-SUB-007` impl. 4 lo había dejado explícitamente abierto —*«hay que decidir si siguen colgando
del cliente o si hay que re-vincularlos»*—. Lo que **no** se decide acá es colgarlos **del
cliente** en vez de la suscripción: es más limpio conceptualmente y es un rediseño de este
capítulo, no una condición. Se discute el día que un addon tenga que sobrevivir a no tener ninguna
suscripción viva.

**Y la condición se evalúa sobre toda instancia con una autorización que puede cobrar, no sólo
sobre las `ACTIVE`.** Son **dos** estados de la instancia: `PENDING_AUTHORIZATION` y `ACTIVE`
(`B/03` §8). Dejar afuera la primera abría la ventana entera del checkout del addon —la misma que
`S3`, con sus **dos** plazos según el método de pago (`B/03` §3.4 punto 1)—: el título moría mientras la instancia esperaba autorización, el disparador del
§4.3 no encontraba a quién aplicarle porque `A5` salía sólo de `ACTIVE`, y después `A2` la llevaba
a `ACTIVE` **con su preapproval cobrando** sobre un objetivo que ya no estaba. Es el argumento con
el que `PENDING_AUTHORIZATION` entró en el alcance de `S13` (`B/03` §3.2), aplicado acá: **una
instancia esperando autorización es una obligación de pago**, y la persona puede completar el
checkout sin tener por qué saber que su título murió. El razonamiento está entero en `B/03` §8,
*«la instancia que autoriza después de que su título murió»*.

**La suspensión y la pausa no dejan huérfano a nada**, y es el punto del §41: el objetivo existe.
Ya no hace falta declararlo aparte —`PAUSED` y `SUSPENDED` son **filas vivas**, así que la
condición de arriba no se cumple—, y se deja escrito porque es la lectura que más se equivoca.
El addon sigue su curso y **su reloj no se congela** (`DEC-ADDON-001`), con la consecuencia ya
registrada de que un suspendido dos meses pierde dos meses de algo que pagó, y con la obligación
de que el aviso de suspensión lo diga.

### 4.3 El huérfano recurrente se cancela en el proveedor, y esto es lo urgente

`DEC-ADDON-002` implicación 6: **cancelar el plan NO cancela los addons.** Cada addon recurrente
es su propio preapproval y **sigue cobrando por su cuenta** hasta que alguien lo cancele.

Entonces, cuando un título **deja de ser fila viva**, la misma causa tiene **tres efectos
distintos** y los tres se disparan del mismo lugar:

| efecto | quién lo hace |
|---|---|
| las capacidades bajan | el reconciliador de excedentes (cap. 15 (épica de verticales) §4) |
| los complementos pueden quedar huérfanos | **se cancelan en el proveedor, de inmediato** — salvo los que una sucesión releva (§4.2), que se re-apuntan a la sucesora y nunca quedaron huérfanos, y los que **releva un grant permanente** en esa vertical (§4.2, tercera mitad), que siguen su curso sin cambiar de objetivo —y, si ese grant lleva `includesAddons: true` y el addon es compatible, **además a costo $0**, con su suscripción de complemento cancelada por `S20` (§3.4)— |
| **y la suscripción de complemento del que sí quedó huérfano pasa a `CANCELLED`** | **`S21`** (`B/03` §3.2): la instancia se apaga por `A5` y su cobro deja de existir **en el mismo acto**, sin período de gracia y sin sostener servicio (§4.4). **No es una llamada más**: el preapproval es el mismo que cancela la fila de arriba |

**El disparador es que la fila salga de las filas vivas, y no un estado de llegada.** Decía
*«cuando un título muere»*, que es la palabra suelta que `NUCLEO/01` §2.4 regla 2 prohíbe en un
predicado, y era lo que dejaba la regla escrita para `CANCELLED` y muda para los otros dos
—`ABANDONED` y **`CHARGE_DECLINED`**—. Las transiciones que la cumplen son **las doce** que en
`B/03` §3.2 sacan a una fila principal de las filas vivas: `S3`, `S12`, `S13`, `S16`, `S17`, **el
espejo de la baja decidida por el proveedor** (`B/03` §10.1, que no tiene fila numerada y es
transición de la misma tabla); desde la FASE 9-bis-4, **`S22`, `S23` y `S24`** —la baja pedida
estando pausado, suspendido o en el grace— más **`S25`**, el fin de una pausa sobre un plan que ya
no se presta (`DEC-SUB-015`); y desde la 9-bis-5, **`S27` y `S28`** —la suspendida y la que esperaba
autorización cuando se discontinuó su vertical (`B/10` §4.3)—. **`S26` no entra**: manda la fila a
`CANCEL_SCHEDULED`, que **sigue siendo fila viva**. Lo que se evalúa en cada una es **la condición del
§4.2**, no el
nombre del estado al que llegó. La lista es para poder auditar que ninguna se olvidó; **y que
hayan entrado cuatro seguidas sin que el predicado cambiara es la prueba de que
se enuncia sobre la condición y no sobre la lista**: lo que hay que actualizar es el conteo, no la
regla. **Y se re-evalúa**, porque es una condición sobre
estados: el caso que lo obliga es una sucesora que autoriza tarde o abandona después de que su
predecesora ya murió (§4.2).

> **«Se re-evalúa» necesita decir CUÁNDO, porque una re-evaluación sin evento no la ejecuta
> nadie** — es la regla 1 del núcleo: lo que la tabla no declara, no pasa. Son **cuatro**
> momentos, y los cuatro son actos ya declarados en otro lado —tres en una tabla de transiciones
> y el cuarto en el catálogo de acciones administrativas:
>
> | momento | de dónde sale | por qué hace falta |
> |---|---|---|
> | **una de las doce transiciones saca al título de las filas vivas** | `B/03` §3.2 | es el disparador directo, el de la tabla de arriba |
> | **muere la sucesora que relevaba** — `S3` la abandona, `S13` la mata o **`S28`** la corta al discontinuarse la vertical | `B/03` §3.2 | la condición del §4.2 pasa de *«la releva una sucesión»* a *«no hay sucesión que la releve»* sin que ninguna transición toque al addon. Es el caso que este § ya nombraba, y el que obliga a mirar **los complementos de la predecesora** (el recuadro de abajo) |
> | **la instancia llega a `ACTIVE` por `A2`** | `B/03` §8 | el orden inverso: el título ya estaba muerto cuando el addon autorizó. `A2` no mira el título —la validez se evalúa al comprar (§2.2)—, así que si `A5` no alcanzó a la instancia mientras esperaba, éste es el instante en que la condición vuelve a ser evaluable |
> | **se revoca el grant** | `NUCLEO/08` §3, fila del grant permanente | es el único acto que apaga la **tercera mitad** del §4.2, y sin él *«se vuelve a evaluar»* era una promesa sin momento: el addon del beneficiario quedaba relevado por un grant que ya no existe, y su preapproval —si el §3.4 no lo había convertido— seguía cobrando. **Y es uno solo, no dos**: la redacción anterior decía *«o se retira el ancla de esa vertical»* y ese acto **no está declarado** (`12-contrato…` §2.8, `B/02` §2.4), así que nombrarlo agregaba un momento que nadie podía producir. Revocar retira **todas** las anclas del instrumento, que es la población entera que esta mitad necesita |
>
> **La lista no agrega ninguna transición al disparador de arriba**: las doce son las que
> sacan a **la principal** de las filas vivas, el cuarto momento no es una transición de esa
> tabla, y los cuatro son los instantes en que la **condición del §4.2** se vuelve a leer. Un
> momento de re-evaluación no es una puerta a la orfandad: es cuándo se pregunta.
>
> **Y el backstop de los cuatro es la cuarta comprobación de cero llamadas de `B/09` §3** —una
> instancia viva cuyo objetivo ya cumple la condición de este §—, que es lo que cubre la corrida
> en que ninguno de los tres se ejecutó. Hace falta porque ese estado es **indetectable por
> comparación**: la instancia dice `ACTIVE`, el proveedor dice `authorized`, y para el barrido
> eso coincide.
>
> **Y hay que decir sobre QUÉ filas se evalúa, porque en el caso que obliga a re-evaluar no son
> las de la transición.** El disparador ocurre sobre una fila; los complementos que hay que mirar
> son:
>
> 1. **los que cuelgan de esa fila** — el caso directo;
> 2. **y, si esa fila era una sucesora, los que cuelgan de su predecesora** — la que su `sucede_a`
>    apunta.
>
> **El 2 no es un borde: es el único camino por el que el caso del §4.2 se cumple.** Los
> complementos cuelgan de la **predecesora** hasta que `S18` los re-apunta, y `S18` no corrió
> —murió primero la predecesora por `S12`, `S13`, `S16` o el espejo, con la sucesora todavía
> esperando autorización—. Cuando después **la sucesora abandona** (`S3` → `ABANDONED`) la
> condición del §4.2 se cumple **sobre la predecesora**, pero la transición ocurrió sobre la
> sucesora, **que no tiene ningún complemento colgando**: evaluar sólo sus huérfanos no devuelve
> nada, y los de la predecesora se quedan cobrando todos los meses sin que nadie los mire. Es
> justamente el *«el addon pasa a huérfano sin que nadie declare nada»* del §4.2 — la frase que
> promete la re-evaluación y no decía sobre qué.
>
> El **backstop** de esto es la primera comprobación de cero llamadas de `B/09` §3, que ve la
> sucesión abierta sobre una fila muerta y abre la marca con motivo
> `SUCESIÓN_ABIERTA_SOBRE_FILA_MUERTA` (`B/02` §2.5); pero la marca es una persona, no una
> cancelación, y lo que acá no puede fallar es el preapproval que sigue cobrando.

**Falla hacia cobrar de más, y por eso es el que no puede fallar.** Un excedente sin reconciliar
es una capacidad regalada; un preapproval huérfano sin cancelar es un débito mensual a alguien
que ya no es cliente — y como mutar o cancelar no emite webhook, nadie se entera desde adentro.
Lo que lo hace detectable es el barrido del capítulo 09, que compara contra **nuestro** inventario
(`DEC-CONC-002`): un addon en estado terminal con su preapproval vivo es una discrepancia que el
barrido ve.

**Ese detector cubre una mitad y la otra no se ve por comparación.** Busca la instancia
**terminal** con el preapproval **vivo**, o sea el caso en que `A5` corrió y la llamada no se
aplicó. El caso en que `A5` **no corrió** —instancia viva, objetivo muerto— tiene los dos lados
diciendo lo mismo, `ACTIVE` contra `authorized`, así que ninguna de las cinco comparaciones lo
ve. Ésa es la **cuarta comprobación de cero llamadas** de `B/09` §3, que delega en la condición
del §4.2 en vez de reescribirla.

**Y eso obligó a acotar la exención de los terminales del capítulo 09 §3**, porque tal como
estaba escrita apagaba este detector en el mismo acto que lo encendía: `A5` lleva al addon
huérfano a `CANCELLED` (`B/03` §8), o sea a un estado terminal, y *«los estados terminales no se
barren»* lo sacaba del barrido justo cuando pasaba a ser observable. La salvedad está allá y la
razón es **quién canceló el preapproval**: lo que exime a una fila terminal no es la palabra
*«terminal»* sino que su autorización haya quedado imposibilitada de cobrar **sin depender de una
llamada nuestra**, y el preapproval de un **complemento** lo cancelamos siempre nosotros, con una
llamada que puede fallar sin emitir nada. **Esa asimetría no parte suscripciones contra
complementos**, y creerlo fue el error de la versión anterior de esta frase: hay terminales de
suscripción que también dependen de una llamada nuestra —`S12`, `S3`, `S13`, **`S20`**, **`S21`**
y la lápida del corte—, y `B/09` §3 las devuelve al barrido con la misma condición de corte.
**`S20` es además la prueba de que la asimetría no parte por ahí**: es una suscripción **de
complemento** que llega a terminal por una llamada nuestra, o sea las dos cosas a la vez.

> **Las seis no vuelven todas por la misma puerta, y `S21` es la que se sale.** Cinco entran por
> la **salvedad 4** —la que mira quién canceló—; `S21` entra por la **salvedad 1**, porque su
> fila de complemento es terminal **al mismo tiempo que su instancia**, que es exactamente el
> sujeto que la 1 selecciona, con la misma condición de corte. Es el reverso de `S20`, que entra
> por la 4 **y no por la 1** precisamente porque allá la instancia sobrevive (`B/09` §3). Contarla
> en las dos sería barrer dos veces la misma fila.

### 4.4 Y qué le pasa a su suscripción de complemento: `CANCELLED` en el acto

Un addon recurrente son **dos cosas**: la **instancia** —la capacidad encendida— y la
**suscripción de complemento** —el débito mensual, con su preapproval propio (`DEC-ADDON-002`)—.
El §4.2 y el §4.3 dicen qué le pasa a la primera y **nadie decía en qué estado queda la segunda**:
ninguna transición de `B/03` §3.2 la llevaba a un estado terminal por esta causa, y `B/09` §3 lo
tenía declarado abierto. El agravante es que **el barrido la selecciona por el estado terminal de
su instancia** (salvedad 1): el proceso que la vigila la encontraba por un lado y ella misma no
tenía estado declarado por el otro.

> **Decisión del owner, 2026-09-21 (`DEC-ADDON-004`): `CANCELLED` en el acto, junto con la instancia. Sin período
> de gracia y sin sostener servicio.** Lo ejecuta **`S21`** (`B/03` §3.2).

**La razón, escrita y no implícita: el addon COMPLEMENTA algo que ya no está.** Sostener días de
un destaque sobre una ficha despublicada —o sobre una vertical que el cliente ya no tiene— **no le
da nada a nadie**, y deja viva una fila que el barrido tiene que seguir mirando. Y no es una
intuición suelta: el contrato ya **descarta las fuentes de clase `COMPLEMENTO` cuando no queda
ninguna de clase `TÍTULO` viva**
([`12-contrato-de-cobertura.md`](../../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md)
§2.4), así que lo que un período de gracia sostendría no sería capacidad: sería la **fila de un
cobro**.

**Por qué no se aplica el patrón de `DEC-SUB-009`, que es la alternativa que había que descartar.**
Esa decisión cancela ya en el proveedor y **sostiene el servicio de nuestro lado** hasta el fin del
período pagado, eligiendo la dirección del fallo: *«regala unos días de servicio, y se corrige sin
mover un peso»*. Acá ese criterio **no tiene de qué agarrarse**, y `A5` es la prueba: **la
capacidad ya está apagada** en el mismo acto, así que los «días regalados» no existen como
servicio. Lo único que la alternativa agregaría es un `CANCEL_SCHEDULED` con su reloj y su fecha de
fin de servicio como dato nuestro (`DEC-SUB-009` implicación 3) sobre una fila que ya no otorga
nada. **Y si hubiera que devolver lo pagado, eso se resuelve por la vía del reembolso** —que tiene
su regla y su confirmación humana (`DEC-RF-002`)— y **no forzando a la máquina a sostener un estado
vacío**. El razonamiento completo, con las tres razones separadas, está en `B/03` §3.2,
*«el complemento que sobrevive a su instancia»*.

**Cubre las dos puertas, no una.** El evento de `S21` se ata al estado de llegada de la instancia
—`CANCELLED`—, que es donde confluyen **las tres cláusulas del evento de `A5`**: se da de baja,
**queda huérfana** (la condición del §4.2, con sus **tres** mitades) o **se revoca el grant del que
cuelga el ancla que era su título** (§3.3). La orfandad mira el **objetivo** y la revocación mira el **título**, y
atarse a una sola habría dejado el cobro vivo en los tres scopes —`LISTING`, `USER` y `GLOBAL`—
donde el objetivo nunca muere. **`A6` entra por la misma puerta y con la misma razón**: la ficha se
borró, el addon *«se consume»* (`DEC-ADDON-001`) y su cobro no tiene a qué complementar. **`A3` no
entra** —la instancia va a `ABANDONED` y la fila de complemento ya tiene su propia transición,
`S3`, con la misma ventana y sus **dos** plazos (`B/03` §3.4 punto 1)— y **`A4` tampoco**, porque su población es vacía: un
preapproval propio existe sólo si el cobro es `PERIÓDICO`, y `PERIÓDICO` + `DÍAS_FIJOS` no existe
(§1.2 y §1.3).

**El preapproval es UNO, y esto no agrega una segunda cancelación.** El de un addon recurrente es
el de su **suscripción de complemento** (`DEC-ADDON-002`, `B/02` §2.4; `B/09` §3 lo dice con todas
las letras: *«son dos entidades con dos columnas de estado»*), así que la llamada que `A5` y `A6`
ya declaran —con la regla de relectura de `S17`— **es la de esta fila**. `S21` **no manda nada al
proveedor**: escribe el estado local que faltaba. Duplicarla serían dos llamadas por el mismo
recurso; omitir la fila dejaba el estado sin declarar, que es lo que este § cierra.

**El período ya cobrado no se reembolsa — con DOS excepciones declaradas, y las dos son de
`DEC-RF-004`.** La regla vale donde el complemento se pierde **por un acto del propio cliente**;
**no** vale cuando la instancia llega a `CANCELLED` por la **tercera** cláusula de `A5` —**se revoca
el grant que era su título**—, ni cuando llega por la **segunda** —**queda huérfana**— **y a su
título lo mató la discontinuación de la vertical**: `S25`, `S27` o `S28` (la ampliación del
2026-09-23). En las dos el cliente no hizo nada y pierde días que pagó. Los **cuatro** disparadores
de `S21` están enumerados uno por uno, con el lado de cada uno —y el segundo con su reparto interno—
en `B/03` §3.2, *«la propuesta del 14 depende del disparador»*. **Y el resto no es todo *«un acto
del cliente»*, que es la parte que no hay que leer de más**: quedan del lado de la regla **dos**
caminos nuestros —`S17`, y `S12` cuando su `CANCEL_SCHEDULED` lo puso `S26`— **por mecanismo y no
por criterio**, porque ahí la transición que mata al título no nombra su causa; el § de `B/03` los
enumera y la fila de `B/19` §6 los dice en voz alta para que quien resuelve pueda apartarse. Lo que
sigue es la regla para ese resto.

Igual que `DEC-GRANT-001` lo dice para `S13` y el §3.4
para `S20`, y por las tres reglas que `DEC-RF-002` enumera: *«reembolsar»* mueve dinero y lleva
permiso y confirmación explícita (`NUCLEO/08` §3), la línea del owner es *«toca plata o no toca
plata»* (`B/09` §2.4), y `S14` prohíbe toda decisión destructiva automática. Si en un caso concreto
corresponde devolver, entra por esa vía **y la confirma una persona**; nunca lo decide la máquina.

**Y esa vía tiene desde ahora quién la dispare, que es lo que le faltaba para existir.** Cuando el
último cobro del complemento paga **un período que todavía no terminó**, `S21` abre la marca
`requiere_conciliación` con motivo **`COMPLEMENTO_CON_PERÍODO_COBRADO`** (`B/02` §2.5, motivo 14)
con ese pago colgado, y el listado accionable la muestra con **el default que le corresponde a su
rama** —**devolver** cuando se revocó el grant y cuando la orfandad la causó la discontinuación,
**NO devolver** en el resto, que es la regla del párrafo de arriba escrita (`DEC-RF-004`)— más el
pago y el monto (`B/19` §6). Hasta acá esa frase nombraba
una vía que **ninguna transición ni comprobación del corpus abría**, y desde que la enumeración de
motivos es **cerrada** eso dejó de ser una omisión discutible: `G-R1-F` rechaza una marca cuyo
motivo no esté en esa tabla (`B/20` §2), y ninguno de los trece era éste. **La marca no decide
nada** —lo que trae es una propuesta, que según la rama es devolver o no devolver (`DEC-RF-004`), y
la confirma una persona en los cuatro disparadores— **y tampoco agrega una
comprobación al barrido**: la
escribe la transición, en el mismo acto.

**Y el barrido gana una puerta y no gana una comprobación.** `S21` agrega **una** fila a la tabla
de puertas a un estado terminal de `B/09` §3 —que hoy tiene **quince**, desde que `S22`, `S23`,
`S24`, `S25` y las **dos** terminales de la discontinuación, `S27` y `S28`, le agregaron las suyas
(`B/03` §3.2)—, y su veredicto es **no exenta**: el
preapproval lo dejó sin poder cobrar **una llamada nuestra** —la de `A5` o `A6`—, que puede fallar
sin emitir nada (`EX-15`). Vuelve al barrido por la **salvedad 1**, no por la 4, porque su fila es
terminal **junto con su instancia**, que es justo el sujeto que la 1 selecciona — **y, cuando `S21`
abre la marca del motivo 14, también por la 2**, que es la que le pone reloj al caso mientras nadie
lo resuelve. **Y `S21` no
agrega ninguna comprobación de cero llamadas**: la corrida que ejecuta `A5` y muere antes de `S21`
la cubre esa misma salvedad 1, que es la única que ve una fila de complemento todavía `ACTIVE`
colgando de una instancia terminal. (Las comprobaciones son **seis** desde `DEC-GRANT-007`
—`B/09` §3, recontadas sobre ese §—; ninguna de las seis es de `S21`.)

---

## Lo que este capítulo NO cierra

- **Mover un destaque de una ficha a otra** queda fuera de alcance: el PDR no lo cubre y
  `DEC-ADDON-001` lo dejó anotado como tal.
- **Qué pasa con una suscripción de complemento cuando la principal se va** es el §41 en su otra
  dirección, y está resuelto en §4.2, §4.3 y §4.4: no lo decide el estado de la principal sino si
  el objetivo del addon sobrevive — y cuando no sobrevive, **la fila de complemento queda
  `CANCELLED` en el acto** (`S21`, §4.4). **El caso en que la principal se va porque cae un grant lo
  resuelve el §3.4**, y ahí la respuesta es la otra: el objetivo sobrevive y lo que se apaga es
  el cobro.
- **El checkout de una contratación** —y el `init_point` roto de `EX-37`, que alcanza a cada
  addon— es del capítulo 13.
- **Cómo se resuelve una tarjeta que se cambia sobre N preapprovals** y queda a medias
  (`DEC-ADDON-002`, implicación 3) es del capítulo 13.

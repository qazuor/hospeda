---
title: Master Spec 16 — Addons
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-20
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
| `PENDING_AUTHORIZATION` | **no** | se comprarían complementos sobre algo que puede no autorizarse nunca; el capítulo 03 le da 72 h y después muere |
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

Sin esta excepción, `includesAddons: true` sería una configuración **inalcanzable**: una opción
que existe en la base, se puede encender, y no hace nada. Un control por exclusión que se olvida
de un título nuevo no falla ruidosamente; deja una funcionalidad muerta y nadie se entera.

---

## 3. El addon a costo cero · cierra `E-ADDON-03`

El §35.2 con `includesAddons: true` dice que *«addons compatibles pueden utilizarse a costo $0»*
y que **no** se activan automáticamente. De ahí salen tres preguntas.

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
| `VERTICAL_SUBSCRIPTION` | la suscripción de esa vertical **dejó de ser fila viva** (`NUCLEO/01` §2.4) **y ninguna sucesión la releva**: su `sucedida_por` es nulo (`B/02` §2.2) **y no hay una fila viva con `sucede_a` apuntándola** |
| `USER` · `GLOBAL` | la cuenta se borró |

> **«Huérfano» acá es el addon cuyo objetivo murió.** No confundirlo con la *«huérfana»* del
> capítulo 09 §2.2, que es un recurso **del proveedor sin fila nuestra**. Son dos palabras iguales
> con dos sujetos opuestos, y ningún mecanismo de uno sirve para el otro.

**Las dos mitades de la condición se escribieron de nuevo, y cada una arreglaba lo contrario de
la otra.**

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
`ACTIVE`**, y la tabla de seis transiciones de `B/03` §3.2 enumera **tres** por las que la
predecesora deja de ser fila viva **antes** de eso y sola — `S12` (le llegó la fecha de fin de
servicio), `S13` (*Free Forever*) y `S16` (el primer cobro de su autorización se rechaza, y
`PA-3` mide que ese cobro llega **entre 26 y 44 minutos** después de autorizar, o sea dentro de la
ventana en que un cambio de plan es legal). En las de `S12` y `S16` la sucesora sigue viva
esperando autorizar: con una sola columna, el addon de alguien que está **en pleno upgrade** queda
huérfano y se le cancela el preapproval, que es irreversible (`PA-5`) — el mismo daño que la mitad
anterior evita, por una puerta más angosta.

> **Desde que `S18` también sale de `PENDING_AUTHORIZATION` en esos dos casos** —el arreglo del
> candado `A` vacío, `B/03` §3.2— la ventana de `S12` y `S16` se cierra en el acto y `sucedida_por`
> ya está escrita cuando el addon pregunta. **La lectura de dos columnas no sobra por eso**: `S13`
> sigue matando a la sucesora sin que `S18` corra, y la sucesión en curso **normal** —predecesora
> viva, sucesora esperando— es la mayoría de los casos y sólo la contesta `sucede_a`.

Con las dos columnas la línea de tiempo queda cubierta entera, y el predicado parte los **cuatro**
estados de la relación que `B/03` §3.2 enumera en **dos grupos**: **la releva una sucesión** —en
curso, o sea una fila **viva** con `sucede_a` apuntándola; o terminada, o sea `sucedida_por` no
nulo— contra **no hay sucesión que la releve**, que junta *«nunca la hubo»* con *«la que hubo se
murió sin cerrarse»* y es el único grupo en que el addon queda huérfano. **Los dos casos de ese
último grupo no se distinguen acá a propósito**: para el addon dan el mismo resultado, y por eso
este § cuenta **grupos** donde `B/03` §3.2 cuenta **estados**. Es la misma lectura de dos columnas
que la condición 3 del pago tardío (`B/05` §3) hace por la misma razón, y **no revive lo que la
mitad anterior descartó**: lo que fallaba era `sucede_a` **solo**, porque después del cierre da
*«huérfano»* siempre; acá ese instante lo contesta `sucedida_por`.

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

**Y el complemento es UNA de las tres cosas que `S18` re-apunta, no la única.** De una suscripción
cuelgan además la **redención de promo** y la **cortesía vigente**, con el mismo modo de falla
—silencioso, sin webhook y sin detector—, y durante una tanda entera la enumeración de efectos de
`S18` nombró sólo a los complementos. El inventario completo, con qué se re-apunta y qué no, está
en `B/02` §2.6; acá queda dicho para que la promoción del addon **a efecto declarado** no se lea
como que las otras dos ya estaban resueltas.

`DEC-SUB-007` impl. 4 lo había dejado explícitamente abierto —*«hay que decidir si siguen colgando
del cliente o si hay que re-vincularlos»*—. Lo que **no** se decide acá es colgarlos **del
cliente** en vez de la suscripción: es más limpio conceptualmente y es un rediseño de este
capítulo, no una condición. Se discute el día que un addon tenga que sobrevivir a no tener ninguna
suscripción viva.

**La suspensión y la pausa no dejan huérfano a nada**, y es el punto del §41: el objetivo existe.
Ya no hace falta declararlo aparte —`PAUSED` y `SUSPENDED` son **filas vivas**, así que la
condición de arriba no se cumple—, y se deja escrito porque es la lectura que más se equivoca.
El addon sigue su curso y **su reloj no se congela** (`DEC-ADDON-001`), con la consecuencia ya
registrada de que un suspendido dos meses pierde dos meses de algo que pagó, y con la obligación
de que el aviso de suspensión lo diga.

### 4.3 El huérfano recurrente se cancela en el proveedor, y esto es lo urgente

`DEC-ADDON-002` implicación 6: **cancelar el plan NO cancela los addons.** Cada addon recurrente
es su propio preapproval y **sigue cobrando por su cuenta** hasta que alguien lo cancele.

Entonces, cuando un título **deja de ser fila viva**, la misma causa tiene **dos efectos
distintos** y los dos se disparan del mismo lugar:

| efecto | quién lo hace |
|---|---|
| las capacidades bajan | el reconciliador de excedentes (cap. 15 (épica de verticales) §4) |
| los complementos pueden quedar huérfanos | **se cancelan en el proveedor, de inmediato** — salvo los que una sucesión releva (§4.2), que se re-apuntan a la sucesora y nunca quedaron huérfanos |

**El disparador es que la fila salga de las filas vivas, y no un estado de llegada.** Decía
*«cuando un título muere»*, que es la palabra suelta que `NUCLEO/01` §2.4 regla 2 prohíbe en un
predicado, y era lo que dejaba la regla escrita para `CANCELLED` y muda para los otros dos
—`ABANDONED` y **`CHARGE_DECLINED`**—. Las transiciones que la cumplen son **las cinco** que en
`B/03` §3.2 sacan a una fila principal de las filas vivas: `S3`, `S12`, `S13`, `S16` y `S17`, y
lo que se evalúa en cada una es **la condición del §4.2**, no el nombre del estado al que llegó.
La lista de transiciones es para poder auditar que ninguna se olvidó; si mañana entra una sexta,
el predicado ya la cubre. **Y se re-evalúa**, porque es una condición sobre estados: el caso que
lo obliga es una sucesora que autoriza tarde o abandona después de que su predecesora ya murió
(§4.2).

**Falla hacia cobrar de más, y por eso es el que no puede fallar.** Un excedente sin reconciliar
es una capacidad regalada; un preapproval huérfano sin cancelar es un débito mensual a alguien
que ya no es cliente — y como mutar o cancelar no emite webhook, nadie se entera desde adentro.
Lo que lo hace detectable es el barrido del capítulo 09, que compara contra **nuestro** inventario
(`DEC-CONC-002`): un addon en estado terminal con su preapproval vivo es una discrepancia que el
barrido ve.

**Y eso obligó a acotar la exención de los terminales del capítulo 09 §3**, porque tal como
estaba escrita apagaba este detector en el mismo acto que lo encendía: `A5` lleva al addon
huérfano a `CANCELLED` (`B/03` §8), o sea a un estado terminal, y *«los estados terminales no se
barren»* lo sacaba del barrido justo cuando pasaba a ser observable. La salvedad está allá y la
razón es la asimetría de quién canceló: los tres terminales de una **suscripción** están exentos
porque algo ya garantiza que su autorización no puede cobrar, y el preapproval de un
**complemento** lo cancelamos nosotros, con una llamada que puede fallar sin emitir nada.

---

## Lo que este capítulo NO cierra

- **Mover un destaque de una ficha a otra** queda fuera de alcance: el PDR no lo cubre y
  `DEC-ADDON-001` lo dejó anotado como tal.
- **Qué pasa con una suscripción de complemento cuando la principal se va** es el §41 en su otra
  dirección, y está resuelto en §4.2 y §4.3: no lo decide el estado de la principal sino si el
  objetivo del addon sobrevive.
- **El checkout de una contratación** —y el `init_point` roto de `EX-37`, que alcanza a cada
  addon— es del capítulo 13.
- **Cómo se resuelve una tarjeta que se cambia sobre N preapprovals** y queda a medias
  (`DEC-ADDON-002`, implicación 3) es del capítulo 13.

---
title: Master Spec 15 — Entitlements y limits
linear: HOS-1353
statusSource: linear
created: 2026-09-17
updated: 2026-09-20
status: CURRENT
fase: 2
capitulo: 15
cierra:
  - A-ENT-02
  - E-ENT-01
  - M-ENT-01
  - M-ENT-02
  - M-ENT-03
---

# 15 · Entitlements y limits

El §36 dice que un entitlement puede venir de cinco fuentes y que *«permanece activo mientras al
menos una source exista»*. El §37 dice que los limits *«pueden acumularse»* y da un ejemplo que
suma. Los dos son correctos y ninguno alcanza: **el PDR describe la agregación con un caso y la
deja sin regla general.**

Este capítulo la escribe, y cierra los cinco huecos que salen de ahí.

---

## 1. Tres cosas con scope, y confundirlas es el error de fondo

Antes de cualquier regla hay que separar tres niveles que el PDR mezcla, porque los cinco huecos
de este capítulo aparecen en las junturas:

| nivel | qué tiene scope | dónde se declara |
|---|---|---|
| **la clave** | si la capacidad es **de vertical** o **global** (§3) | el catálogo de claves, o sea código (cap. 02 §1.2) |
| **la fuente** | a qué alcanza lo que otorga: una ficha, una vertical, el usuario, todo (§40, §35.1) | la base |
| **la operación** | **siempre tiene vertical**, sin excepción (cap. 17 §2) | la firma |

**Una fuente global puede otorgar una clave de vertical, y una fuente de vertical puede otorgar
una clave global.** No son el mismo eje y no se derivan uno del otro.

---

## 2. Cómo se agrega cada limit · cierra `M-ENT-01`

### 2.1 El §37 generaliza un caso particular

El ejemplo del §37 es *plan 20 fotos + addon 30 = 50*, y para las fotos está bien. Pero hay
limits donde sumar es **directamente incorrecto**: un tope de resolución, una prioridad de
ordenamiento, un compromiso de tiempo de respuesta. Sumar dos compromisos de respuesta da un
número que no significa nada.

### 2.2 Cada clave declara su estrategia, y son dos familias

**La estrategia de agregación se declara con la clave, en el catálogo**, y la lista es cerrada:

| familia | estrategia | cómo resuelve | ejemplo |
|---|---|---|---|
| **acumula** | `SUMA` | suma todas las fuentes del **conjunto plegable** (§2.6) | fotos, fichas, destaques |
| **no acumula** | `MÁXIMO` | gana el número más alto | días de retención, tamaño de archivo |
| | `MÍNIMO` | gana el número más bajo | un compromiso de tiempo de respuesta |
| | `MEJOR_DECLARADO` | la clave declara un orden sobre sus valores posibles y gana el mejor | nivel de soporte: `correo` → `prioritario` → `dedicado` |

> **Las cuatro estrategias pliegan el MISMO conjunto de fuentes, y ese conjunto no es el que el
> contrato devuelve.** Es el que queda **después** del descarte del §2.6. Decirlo una vez acá evita
> tener que repetir la condición en cada fila.

**Las tres de «no acumula» son la misma regla dicha tres veces: gana la fuente más favorable.**
Lo que cambia es cómo se define *favorable* —más alto, más bajo, o un orden declarado— y eso es
una propiedad del significado de la clave, no de cada plan.

### 2.3 Por qué la estrategia vive con la clave y no con el plan

**Si la declarara el plan, dos planes de la misma vertical podrían declarar estrategias distintas
para la misma clave**, y entonces el límite efectivo dependería de qué plan tenés. Es decir: la
clave significaría dos cosas. Eso es exactamente la fuente duplicada que el §9 y el capítulo 02
§1.2 vienen a impedir.

*«Las fotos se suman»* no es una decisión comercial: es qué son las fotos. Cambiarlo es un
release, y está bien que lo sea, porque cambiar `SUMA` por `MÁXIMO` le altera el límite efectivo
a toda la cartera de una vez.

### 2.4 Cuando no acumula, gana el cliente

Ante dos fuentes que discrepan, **el resultado favorece al cliente**. La alternativa —que gane la
peor— significa que **comprar un addon puede dejarte peor que antes**, y eso no se puede defender
ante nadie.

### 2.5 Dos mecanismos que NO son esto

Conviene decirlo porque se parecen y resolverlos con la agregación rompe las dos decisiones que
los crearon:

1. **Los overrides del plan de trial** (`DEC-TRIAL-001`) **reemplazan**, no agregan. La
   resolución de trial es *derivar → aplicar overrides*, en ese orden, y el override no compite
   con las fuentes: se aplica sobre el resultado.
2. **El trinquete** (`DEC-TRIAL-002`) es un **piso**, no una fuente. Se compara al final contra
   las versiones vigentes al arrancar el trial, y sólo puede subir el resultado.

**El trinquete tiene un segundo sujeto, y es el mismo mecanismo.** Un `permanent_grant` se ancla a
**un plan por cada vertical de su scope** y resuelve, en cada una, la **versión vigente** de su
plan (`12-contrato-de-cobertura.md` §2.8, `B/02` §2.4), así que sigue las mejoras del plan —y
quedaría expuesto a sus recortes—. Su piso es **lo que ese plan otorgaba el día que se firmó el
grant**, guardado en el ancla:

> **Un grant nunca otorga menos de lo que otorgaba el día que se concedió.**

Se compara igual que el del trial —al final, y sólo puede subir el resultado—, y por la misma razón
de fondo: una versión nueva que reparte distinto **le sacaría algo a quien tiene un «para
siempre», sin que nadie lo haya decidido para esa persona**. La diferencia con el del trial es sólo
contra qué se compara: el del trial, contra las versiones vigentes al arrancar; el del grant,
contra las vigentes al firmarlo.

**Y se compara POR VERTICAL, que es la parte que la resolución no puede deducir sola.** La
resolución de un `user + vertical` toma **la fuente `GRANT` de esa vertical** —con el plan de esa
vertical y el piso de esa vertical— y **ninguna otra**. Un piso único para un grant de scope plural
compararía las claves de Gastronomía contra lo que otorgaba un plan de Alojamiento, que es el mismo
cruce que el ancla por vertical vino a cerrar, entrando por el trinquete en vez de por la
referencia. Lo vigila `G-R2-B` (`V/20` §2).

### 2.6 El conjunto plegable: sin título, los complementos se descartan

`cobertura(user, vertical)` devuelve **todas** las fuentes vivas, de las **tres clases** que el
contrato define —`TÍTULO`, `BASE` y `COMPLEMENTO`— y lo hace a propósito
(`12-contrato-de-cobertura.md` §2.1 y §2.4): el aviso de qué se pierde (§6.3) y el reconciliador
(§4) necesitan verlas todas, incluso las que no van a otorgar nada. **Lo que este capítulo pliega
no es esa lista.**

> **El conjunto plegable de un `user + vertical` son sus fuentes de clase `TÍTULO` y `BASE`, más
> las de clase `COMPLEMENTO` SÓLO SI hay al menos una de clase `TÍTULO` viva. Sin título, los
> complementos se descartan y no entran en ninguna de las cuatro estrategias del §2.2.**

Es la regla del contrato §2.4 —*«un complemento agrega sobre un título; sin título no agrega sobre
nada»*— escrita **donde se ejecuta**. El pliegue lo hace este capítulo; una regla de pliegue que
viva sólo en el contrato es una frase, y **una frase no es un gate**.

**Qué pasa sin ella, y está medido en el contrato §2.4**: el reloj de un addon *«no se congela»*
con la suspensión (`B/16` §4.2, `DEC-ADDON-001`), así que una instancia **viva** convive con una
suscripción `SUSPENDED` a la que el §21 deja *«sin entitlements comerciales»*. Con las estrategias
sumando *«todas las fuentes vivas»*, ese suspendido pierde la cobertura y **conserva lo que su
addon otorga**: dejó de pagar y sigue adentro. El descarte de `cubierto` cerraba la puerta un paso
antes; ésta es la del paso 6.

**Tres casos que NO cambian, y conviene decirlos porque se parecen:**

1. **Un `GRANT` permanente es de clase `TÍTULO`.** Quien tiene *Free Forever* y un addon
   **conserva los dos** — es la excepción que `B/16` §2.4 ya declaraba (*«un grant permanente vale
   como título en lugar de la suscripción `ACTIVE`»*), y acá se cumple sin escribirla aparte.
2. **El piso no rescata a nadie.** La fuente `BASE` que toda persona tiene en toda vertical
   (`12-contrato…` §2.5) **no es un título**: si contara, el gate no descartaría nunca nada y
   volvería a ser decorativo.
3. **El descarte es del pliegue, no del contrato.** `cubierto` ya se calculaba sólo sobre los
   `TÍTULO`; esto es el paso siguiente y opera sobre **capacidades**. Los dos son necesarios y
   ninguno reemplaza al otro.

**Y es la misma condición en los dos tramos del pliegue.** El conjunto efectivo se pliega en el
tramo cacheado por `user + vertical` y un delta por ficha (`12-contrato…` §2.7); un addon de
alcance `LISTING` entra en ese delta **sólo si el `user + vertical` tiene título vivo**. El corte
en dos tramos es por dónde puede cortar el caché, no una segunda regla de admisión: si el descarte
sólo rigiera en el primero, el suspendido conservaría sus addons de ficha.

**Y el descarte NO necesita un disparador nuevo para el reconciliador de excedentes**, que es lo
primero que parece faltar: cuando muere el último título, **el conjunto efectivo baja sin que
ninguna fuente se haya apagado** —el addon sigue vivo—, y el §4.2 se dispara por el recálculo, no
por el apagado. El recálculo ya ocurre: *«toda transición de la máquina de suscripción»* está en
la lista de invalidación (cap. 02 §3.2) y la suspensión es una. Lo que baja lo reconcilia el §4.3
como cualquier otra baja.

**El guard** — `G-R2`, en la lista de `V/20` §2: **ninguna de las cuatro estrategias recibe una
fuente de clase `COMPLEMENTO` cuando el conjunto no tiene ninguna de clase `TÍTULO` viva.** Se
comprueba sobre la resolución y no sobre cada call site, porque `V/17` §1.3 ya obliga a que los
pasos se resuelvan **en un solo lugar**; ese lugar es el sujeto del guard. Sin guard la regla queda
donde estaba: escrita y nunca ejercida.

---

## 3. El scope global de una clave · cierra `M-ENT-03`

### 3.1 La asimetría

El §36.1 sólo contempla que un entitlement **no escape** de su vertical. El §40 en cambio le da a
los addons cuatro scopes, incluido `GLOBAL`. Y un plan de vertical puede otorgar legítimamente
algo que no es de esa vertical: una insignia en el perfil, ausencia de publicidad en el sitio,
atención prioritaria.

**Sin scope global eso se modela como una clave de vertical que después alguien lee desde otra**,
que es precisamente el cruce que el §13 quiere evitar. La falta de la capacidad no evita el
problema: lo empuja a resolverse mal.

### 3.2 La regla

**Cada clave de entitlement y de limit declara su scope en el catálogo: de vertical, o global.**
Simétrico con los addons del §40.

Y la defensa contra el cruce es estructural, no un chequeo:

| scope de la clave | cómo se resuelve |
|---|---|
| **de vertical** | por `user + vertical` |
| **global** | por `user` |

**Una clave de vertical no se puede leer desde otra vertical porque su resolución pide la
vertical**, igual que el capítulo 17 §2 hizo con las operaciones. No hay un control que alguien
pueda olvidar: hay una resolución que no se puede invocar sin el dato.

### 3.3 Una clave global otorgada por un plan de vertical se pierde con ese plan

Es el caso que motiva todo esto —la insignia que da el plan premium de Alojamiento— y no necesita
regla nueva: el §36 ya dice que la capacidad vive *«mientras al menos una source exista»*. Si la
única fuente era ese plan y el plan se va, la insignia se va, **en todas las verticales**, porque
la clave es global.

El scope de la clave dice **dónde vale**; la fuente dice **por cuánto tiempo**. Son preguntas
distintas y cada una la contesta quien corresponde.

### 3.4 Y cada clave declara además su CLASE, que es lo que `G-R3` lee

**`G-R3` prohíbe que las dos versiones no vendibles otorguen *«una clave de la clase comercial»*
(cap. 02 §2.1), y hasta esta pasada el corpus no decía qué hace comercial a una clave.** No estaba
en el glosario —donde *«entitlement medido»*, la otra mitad del mismo predicado, **sí** tiene
entrada (`NUCLEO/01` §1.6)— ni era un atributo que este capítulo declarara. Así que el guard **no se
podía formar**: o no se construía —y las dos versiones que toda la plataforma recibe quedaban sin
vigilancia, que es el punto único de falla que el cap. 02 §2.1 declara— o el que lo construyera
**inventaba la clasificación**, clave por clave, con un criterio que nadie escribió y que la clave
siguiente resolvería distinto.

**La clase es el CUARTO atributo que una clave declara en el catálogo, y la lista de valores es
cerrada:**

| clase | qué es | ejemplos |
|---|---|---|
| **`COMERCIAL`** | su ejercicio **produce o sostiene presencia pública** en la vertical, o **consume** un limit o la cuota de un entitlement medido | publicar una ficha (`PB1`), destacarla, las fotos, la prioridad de ordenamiento |
| **`DE_ACCESO`** | su ejercicio **no** produce presencia pública y **no** consume nada: sólo deja **existir**, **recuperar lo propio** y **volver a contratar** | *«contratar una suscripción»* y *«recuperar lo suyo»* — las dos claves del piso (cap. 02 §2.1) |

**Vive con la clave y no con el plan por la razón del §2.3, palabra por palabra.** Si la declarara
el plan, dos planes de la misma vertical podrían declarar clases distintas para la misma clave y
entonces **la clave significaría dos cosas** — y acá el desenlace es peor que un límite ambiguo: es
que `G-R3` dé verde sobre un catálogo y rojo sobre el mismo catálogo según qué plan mire.

**Y no contradice *«lo único que vive en código es el conjunto de nombres»*** (`NUCLEO/02` §1.2),
que es el apartamiento con que el §64.15 quedó reescrito. Esa frase prohíbe que en código vivan
**valores, precios y asignaciones** —*«qué plan otorga qué clave, con qué valor, en qué vertical, a
qué precio»*, que es la otra columna de esa misma tabla—, no que una clave declare qué es. El scope
y la estrategia de agregación ya viven ahí desde la FASE 9 por esa misma lectura; la clase es el
cuarto del mismo tipo y **no dice qué otorga ningún plan**.

**Y hay que decir con precisión qué gana el guard con esto y qué NO gana**, porque leerlo de más
sería la forma que `DEC-TEST-001` rechazó. **Gana** poder preguntar *«¿esta clave está declarada
`COMERCIAL`?»* sobre el catálogo, sin entender qué significa la clave — la misma comprobación
estructural que `G-R6` hace sobre columnas (`B/20` §2). **No gana** verificar que la clasificación
esté bien juzgada: un desarrollador que declare `DE_ACCESO` a la clave de publicar rompe el guard
igual que uno que le declare el scope equivocado, y contra eso el control es la revisión del PR, no
el guard. **Lo que cambia no es que la clasificación sea infalible: es que se hace UNA vez, en el
catálogo, a la vista, en vez de reinventarse adentro del guard en cada clave.**

**Y el atributo vive donde viven los otros tres: en el catálogo de claves, que es código
(`NUCLEO/02` §1.2).** Hay que decirlo porque `G-R3` lo lee y `G-R3` se construye en **`V2`**,
mientras que este § es capítulo de **`V3`**: **el atributo está desde `V1`**, que es la unidad que
deja el catálogo de claves funcionando (`descomposicion.md` §2), así que el guard **no nace antes
que el dato que compara** — que es exactamente el error que `G-R5` cometió y el criterio 2 de la
quinta enmienda de `DEC-TEST-001` prohíbe. Lo que este § agrega es **la regla**, no el lugar; son
dos preguntas distintas, como ya quedó escrito para `G-R6-B` y `G-R5`.

**Las dos claves del piso quedan clasificadas acá y no en el guard**, que es lo que impide que el
que lo construya tenga que decidirlo: *«contratar una suscripción»* y *«recuperar lo suyo»* son
**`DE_ACCESO`**, y el argumento de tres premisas que el cap. 02 §2.1 escribe para la segunda
—no publica, no cuenta contra ningún limit, su objeto es una ficha que la persona ya tenía— deja de
ser un razonamiento sobre un caso y pasa a ser **la aplicación del criterio de esta tabla**.

---

## 4. El excedente es un servicio transversal · cierra `M-ENT-02`

### 4.1 El §28.1 lo define en el lugar equivocado

El §28.1 define el manejo de excedentes —informar antes, dejar elegir, preferir archivar o
despublicar antes que borrar, una `enforcementStrategy` por tipo de limit— **sólo en el contexto
del downgrade**. Y hace falta idéntico cuando vence un addon (§38), termina una cortesía (§34),
se revoca un grant (§35), se suspende (§21), termina el trial (§10.6) o se mueve a alguien a una
versión de plan nueva (`DEC-ARCH-001`).

### 4.2 No se dispara por evento: se dispara por condición

Enumerar seis puntos de invocación es cómo se olvida el séptimo. **El reconciliador de excedentes
se dispara cuando el conjunto efectivo de un `user + vertical` se recalcula, y actúa cuando el
conjunto y el límite dejaron de coincidir — en las DOS direcciones.**

Y no hace falta una lista nueva: **es la misma lista que invalida el caché** (cap. 02 §3.2), con
sus siete entradas. Una lista, dos consumidores. Que a veces se dispare sin nada que hacer es
gratis; que falte un disparo es una capacidad regalada o un límite incumplido.

**Que actuara *«sólo si algo bajó»* era la mitad del trabajo, y la que faltaba costaba caro.** El
que baja de plan recibe el enforcement en el acto; el que **vuelve a subir y paga el plan entero**
no recibía nada: su `cubierto` nunca cambió —un upgrade es una sucesión y la cobertura no se
interrumpe (`12-contrato…` §2.6)—, así que ninguna transición de publicación disparaba y sus
fichas del excedente **se quedaban abajo para siempre**, hasta que el reloj de retención las
archivaba y las borraba. **Paga el plan grande y recibe el chico** (`DEC-DATA-003`,
`F-8eA2-001`). La dirección que faltaba es la que ejecuta la segunda rama de `PB3` y de `PB7`
(cap. 03 §9).

**Y no cambia el nombre ni el guard.** Sigue siendo *«el reconciliador de excedentes»* —lo nombran
así `G5` (cap. 20 §2), el `12-contrato…` §3 y el cap. 02 §3.2— y `G5` sigue verificando lo mismo:
*«ninguna fuente se apaga sin pasar por el reconciliador»*. Restituir **no es apagar una fuente**,
así que la dirección nueva no le agrega ninguna obligación al guard ni cambia lo que cuenta.

**El guard**: ninguna fuente se apaga sin pasar por el reconciliador. Se comprueba sobre los
efectos declarados de las transiciones del capítulo 03, igual que el guard de roles del capítulo
17 §4.4.

### 4.3 Qué hace cuando algo bajó, y qué hace cuando vuelve a alcanzar

**Nunca borra.** Archiva, despublica o deshabilita — el §28.1 es explícito y el borrado definitivo
le corresponde al reloj de retención del §25, no al enforcement.

**El criterio de selección es el mismo que ya fijó `DEC-SUB-008` para las fichas: cae lo más
reciente primero, hasta entrar en el límite, y el criterio va escrito en el aviso.** Se
generaliza a todo limit contable en vez de inventar un segundo criterio, porque dos criterios
distintos para la misma clase de problema es cómo se vuelve impredecible.

**Y para la dirección contraria no se inventa un segundo criterio tampoco: se recorre el mismo al
revés.**

> **Vuelve primero lo que cayó al final.** Como cae lo más reciente primero, sube **lo menos
> reciente de lo que está abajo**, y se sigue subiendo hacia lo más reciente hasta llenar el cupo.
> **El criterio va escrito en el aviso**, igual que el de bajada.

**Es el mismo criterio y no uno nuevo, y eso se puede verificar en el resultado**: con el recorrido
inverso, **lo que queda arriba depende sólo del límite y no del camino**. Quien bajó de cinco a dos
y volvió a cuatro termina con exactamente las cuatro que tendría si hubiera contratado cuatro de
entrada; con cualquier otro orden el resultado depende de por cuántos planes pasó, que es
literalmente lo que `DEC-SUB-008` compró al escribir un criterio. **Y vale para todo limit
contable**, no sólo para las fichas, por la misma generalización del párrafo de arriba.

**El caso de las fichas tiene además dos orígenes y una sola cola.** `PB3` y `PB7` (cap. 03 §9)
compiten por el mismo cupo: las candidatas de los dos estados entran **en la misma cola ordenada**,
sin que el origen desempate. **Y el cupo cuenta sólo las fichas en `PUBLISHED`** (cap. 03 §9; FASE
8 completa, owner 2026-09-25). El desarrollo, con la razón, está en el cap. 03 §9, *«cuáles vuelven,
cuando el cupo no alcanza para todas»*.

### 4.4 La ventana para elegir existe sólo cuando la fecha se sabía

El §28.1 pide *«informar antes»* y *«dejar elegir»*. Se puede cuando la fecha era conocida, y no
se puede cuando no:

| disparador | ¿hay ventana? |
|---|---|
| downgrade programado (`DEC-SUB-008`) · vencimiento de un addon · fin de una cortesía | **sí** — la fecha se conoce de antemano y el aviso sale antes |
| revocación de un grant · suspensión · fin del trial | **no** — se aplica en el acto, y el aviso dice **qué se hizo** y cómo revertirlo |

**Prometer una ventana que a veces no existe es peor que no prometerla**: el cliente que no la
recibe supone que hubo un error. Por eso la fila de abajo no intenta simular una — dice lo que
pasó.

**La restitución del §4.3 no entra en esta tabla, y no por omisión**: el §28.1 pide *«informar
antes»* y *«dejar elegir»* sobre lo que se **quita**, y restituir no quita nada. Su aviso sale
**después** y dice qué volvió y con qué criterio (`V/19` §4, fila 19). El único caso en que el
dueño podría no querer lo que le devolvimos —una ficha que prefería no tener pública— lo resuelve
él en un acto con **`PB6`**, *«el dueño despublica»* (cap. 03 §9), y el riesgo está aceptado por
escrito en `DEC-DATA-003`. (Esa decisión nombra `PB1` para ese acto; `PB1` es la que **publica**,
y la que despublica es `PB6`. Acá va la fila que ejecuta lo que la decisión describe.)

---

## 5. El visitante sin cuenta · cierra `A-ENT-02`

### 5.1 Lo que el §36.2 dice y lo que no

Dice tres cosas: el chat de ficha corresponde a las verticales comerciales con fichas; *«Turista
autenticado puede utilizar gratuitamente el chat disponible»*; y *«Guest no es equivalente a
Turista»*. **No dice qué tiene el guest.**

Y el riesgo está nombrado en el hueco: **un consumo de IA que no se puede imputar a nadie no se
puede medir, ni limitar, ni cortar.**

### 5.2 La regla, y es por clase y no por clave

**El visitante sin cuenta no recibe ningún entitlement medido.** De los booleanos recibe
únicamente los de lectura pública.

Se enuncia por **clase** a propósito: una clave medida que se agregue mañana no necesita una
decisión nueva ni puede quedar habilitada por omisión. Una regla por clave se olvida en la
siguiente.

### 5.3 Por qué no una cuota chica para el guest

Una cuota necesita a quién imputarla. Sin cuenta, lo único disponible son señales del navegador o
de la red, que **se eluden trivialmente** y que además harían falta construir como subsistema
propio. Se pagaría un mecanismo nuevo por un control que no controla.

**La fricción que esto agrega es un registro, y el registro es gratis**: por el §14 todo usuario
autenticado es `Turista Free` sin suscripción real. Se elige fallar hacia **un paso más** antes
que hacia **un costo que nadie puede pagar ni cortar**.

Y así el *«Guest no es equivalente a Turista»* del §36.2 pasa a ser operativo: **ésa es
exactamente la diferencia.**

---

## 6. La suspensión y los beneficios heredados de turista · cierra `E-ENT-01`

### 6.1 La trampa que dejó `DEC-ENT-003`

`DEC-ENT-003` decidió que un plan comercial puede heredar los beneficios de Turista VIP y que,
mientras se los dé, **la persona no puede comprar VIP**. El residuo: si ese plan cae en
`SUSPENDED` por impago (§21), pierde beneficios que usaba **como turista**, en una parte del
producto ajena a su deuda — y por esa misma decisión tampoco pudo haberlos comprado.

### 6.2 La mitad grave se resuelve sola, y hay que decirlo

**El bloqueo de compra se levanta en el mismo instante de la suspensión.** `DEC-ENT-003` lo ata a
que *«su plan comercial se lo dé»*, y un plan suspendido no otorga nada: el §21 dice *«sin
entitlements comerciales»*. La propia decisión ya lo prevé —*«al perder el plan comercial,
recupera la posibilidad de comprarlo»*—, y una suspensión es perder lo que el plan da.

Queda escrito acá porque la lectura contraria es fácil y cara: si alguien interpretara el bloqueo
como atado a *«tiene un plan comercial»* en vez de a *«el plan se lo está dando»*, el suspendido
quedaría sin el beneficio **y sin poder comprarlo**, que es el peor desenlace posible y no lo
quiso nadie.

### 6.3 Y la otra mitad: sí, los pierde

**Los pierde.** El §21 es explícito, el beneficio venía de un plan que no se está pagando, y
sostenerlo convertiría la suspensión en una consecuencia parcial cuyo alcance habría que negociar
clave por clave.

Dos obligaciones que vienen con eso, y no son cosméticas:

1. **El aviso de suspensión nombra lo que pierde como turista**, no sólo lo que pierde como
   anfitrión. Es la parte que no espera, y es la que lo lleva a soporte si se entera usándola.
2. **Si compra VIP estando suspendido, la pantalla de compra dice que al regularizar se le va a
   cancelar** por `DEC-ENT-004` —de inmediato y sin reembolso—, porque su plan vuelve a dárselo
   gratis. Sin ese aviso, le cobramos algo que nosotros mismos le sugerimos comprar.

---

## Lo que este capítulo NO cierra

- **Cuáles son las claves de cada vertical** —el ítem 4 del Eje 2 (cap. 10 §1)— es configuración,
  no diseño: acá está que el subconjunto se declara por vertical y que cada clave lleva **cuatro**
  atributos declarados —scope, estrategia de agregación, `enforcementStrategy` y **clase** (§3.4)—.
  *(Eran tres hasta esta pasada; la clase entró porque sin ella el predicado de `G-R3` no se podía
  formar.)*
- **Si el mes de una cuota corre por calendario o por aniversario** sigue abierto desde
  `DEC-ENT-002` (implicación 2).
- **Qué es una suscripción «válida» para comprar un addon** (`A-ADDON-02`) es del capítulo 16 (épica de billing).
- **El orden de aplicación entre promo, cortesía y grant** (`A-PROMO-01`, `A-PROMO-02`) es del
  capítulo 14 (épica de billing): acá se agregan **capacidades**, allá se compone **dinero**.

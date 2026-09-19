---
title: Master Spec 15 — Entitlements y limits
linear: HOS-1353
statusSource: linear
created: 2026-09-17
updated: 2026-09-17
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
| **acumula** | `SUMA` | suma todas las fuentes vivas | fotos, fichas, destaques |
| **no acumula** | `MÁXIMO` | gana el número más alto | días de retención, tamaño de archivo |
| | `MÍNIMO` | gana el número más bajo | un compromiso de tiempo de respuesta |
| | `MEJOR_DECLARADO` | la clave declara un orden sobre sus valores posibles y gana el mejor | nivel de soporte: `correo` → `prioritario` → `dedicado` |

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
se dispara cuando el conjunto efectivo de un `user + vertical` se recalcula, y actúa sólo si
algo bajó.**

Y no hace falta una lista nueva: **es la misma lista que invalida el caché** (cap. 02 §3.2), con
sus siete entradas. Una lista, dos consumidores. Que a veces se dispare sin nada que hacer es
gratis; que falte un disparo es una capacidad regalada o un límite incumplido.

**El guard**: ninguna fuente se apaga sin pasar por el reconciliador. Se comprueba sobre los
efectos declarados de las transiciones del capítulo 03, igual que el guard de roles del capítulo
17 §4.4.

### 4.3 Qué hace cuando algo bajó

**Nunca borra.** Archiva, despublica o deshabilita — el §28.1 es explícito y el borrado definitivo
le corresponde al reloj de retención del §25, no al enforcement.

**El criterio de selección es el mismo que ya fijó `DEC-SUB-008` para las fichas: cae lo más
reciente primero, hasta entrar en el límite, y el criterio va escrito en el aviso.** Se
generaliza a todo limit contable en vez de inventar un segundo criterio, porque dos criterios
distintos para la misma clase de problema es cómo se vuelve impredecible.

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
  no diseño: acá está que el subconjunto se declara por vertical y que cada clave lleva scope,
  estrategia de agregación y `enforcementStrategy`.
- **Si el mes de una cuota corre por calendario o por aniversario** sigue abierto desde
  `DEC-ENT-002` (implicación 2).
- **Qué es una suscripción «válida» para comprar un addon** (`A-ADDON-02`) es del capítulo 16 (épica de billing).
- **El orden de aplicación entre promo, cortesía y grant** (`A-PROMO-01`, `A-PROMO-02`) es del
  capítulo 14 (épica de billing): acá se agregan **capacidades**, allá se compone **dinero**.

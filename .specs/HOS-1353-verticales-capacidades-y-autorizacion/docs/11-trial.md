---
title: Master Spec 11 — Trial
linear: HOS-1353
statusSource: linear
created: 2026-09-17
updated: 2026-09-17
status: CURRENT
fase: 2
capitulo: 11
cierra:
  - A-TRIAL-02
  - E-TRIAL-02
  - E-TRIAL-03
  - E-TRIAL-04
  - M-TRIAL-03
  - OD-TRIAL-01
  - S-TRIAL-01
---

# 11 · Trial

La máquina está en el capítulo 03 §2 y sus cinco transiciones no se repiten acá. Este capítulo
resuelve **los siete huecos que quedaron alrededor de ella**, y todos son variantes de la misma
pregunta: el §10.2 dice que el trial **no se devuelve nunca**, y no dice qué hacer en los casos
donde eso se siente injusto o se puede explotar.

La respuesta de fondo es una sola y conviene tenerla a la vista antes de los casos:

> **El trial no vuelve. Lo que puede haber es reparación hacia adelante.** Nada rebobina la
> máquina; lo que existe es extenderla mientras está viva, o compensar después con otro
> instrumento.
>
> Es lo que permite sostener el §10.2 sin excepciones —y por lo tanto sin un camino por donde se
> recupere un trial— y al mismo tiempo arreglar lo que rompimos nosotros.

---

## 1. El reloj del trial es calendario · cierra `E-TRIAL-02`

### 1.1 El caso

Publicar y despublicar enseguida. Por §10.2 el trial no se devuelve por despublicar, así que
sigue corriendo sobre una ficha que ya no se ve. El capítulo 03 lo tiene mecánicamente resuelto
—PB6 baja la ficha a `DRAFT` y no toca el trial— pero **no dice si el reloj sigue corriendo**, y
ésa es la parte que el usuario va a preguntar.

### 1.2 La regla

**El reloj del trial es una ventana de calendario que arranca en T1 y no la detiene nada.** No la
detiene despublicar, ni borrar la ficha, ni dejar de entrar, ni crear otra. El §26 ya prohíbe
pausar un trial; esto es la misma regla dicha sobre el reloj en vez de sobre el estado.

La alternativa —que el reloj corra sólo mientras hay algo publicado— se descarta por lo que
habilita: publicar un día, despublicar, y volver seis meses después con el trial intacto. Eso es
exactamente el reseteo que el §10.2 enumera para prohibirlo.

**Lo que sí queda abierto y sin costo es volver a publicar.** Desde `DRAFT` se vuelve por PB1
dentro de la ventana que quede, sin consumir nada nuevo: el trial ya está consumido, lo que
corre es su reloj. Eso es lo que hace tolerable la regla.

**Y se dice en el momento de despublicar, no en los términos.** Que el reloj no se detiene es la
primera pregunta de alguien molesto, y un aviso en el acto la convierte en una decisión
informada. Es el mismo criterio que `DEC-TRIAL-006` aplicó al botón *Empezar*.

---

## 2. Una baja que decidimos nosotros · cierra `E-TRIAL-04`

### 2.1 El caso

`DEC-TRIAL-005` eliminó la revisión previa: se publica y se ve. Toda moderación es entonces
**reactiva**, y como §10.2 no admite devolver el trial, alguien puede quedar **sin ficha y sin
trial**. El hueco preguntaba si eso amerita una excepción al §10.2.

### 2.2 No hay excepción, porque no son el mismo caso

Hay dos bajas distintas y tratarlas igual es el error:

| | la baja fue **justificada** | la baja fue **error nuestro** |
|---|---|---|
| qué pasó | publicó algo que no correspondía | la moderación se equivocó |
| quién causó la pérdida | la persona | nosotros |
| qué corresponde | **nada**: el trial se consumió al publicar | **reparar**, porque el daño lo hicimos nosotros |

**Devolver el trial en el primer caso convertiría la baja en un reseteo gratis**, y le daría un
trial nuevo justamente a quien publicó spam. Ése es el desenlace que se elige evitar.

### 2.3 Y la reparación no rebobina la máquina

El capítulo 03 §2 es terminante: no existe transición de vuelta a `TRIAL_ACTIVE` desde
`TRIAL_EXPIRED`, y es lo que hace cumplir al §10.2. **La reparación no necesita una.**

| cuándo se repara | con qué | por qué alcanza |
|---|---|---|
| el trial **sigue vivo** | una extensión por los días perdidos: es **T4**, la transición que ya existe | el trial nunca murió; sólo se corre su fecha de fin |
| el trial **ya venció** | una **cortesía temporal** sobre la suscripción que tome después (§34, `DEC-GRANT-002`) | no hay trial que extender, y la cortesía es el instrumento que el PDR ya tiene para sostener servicio sin cobrar |

**Las dos las firma `SUPER_ADMIN` con motivo escrito**, porque las dos entregan servicio sin
cobrar y eso es el invariante `D11` del capítulo 04: lo que toca plata lo confirma una persona.
Y las dos quedan en `domain_event` como lo que son —la corrección de un acto nuestro—, no como
una excepción al §10.2, que sigue sin tener ninguna.

---

## 3. El techo de días de trial · cierra `OD-TRIAL-01`

### 3.1 El caso

Tres reglas del PDR que no se cruzan en ningún lado: el §26 prohíbe pausar un trial, el §32
permite extenderlo N días con un promo y el §34.1 dice que una cortesía durante el trial también
lo extiende. **Ninguna de las dos extensiones tiene tope, y no se dice si se acumulan.** Un trial
puede crecer indefinidamente y, peor, **nadie lo ve**: no hay ningún lugar donde se muestre el
total acumulado.

### 3.2 Hay techo, y es un número configurable

**Cada vertical declara un máximo de días de trial acumulados por `user + vertical`**, en base y
no en código (§9). Toda extensión cuenta contra ese mismo techo, venga de un promo del §32 o de
una cortesía del §34.1: **se acumulan, y acumulan contra un único número.**

Sin un techo único, dos instrumentos distintos con tope propio se suman y el total vuelve a no
tener límite — que es el hueco tal cual estaba planteado.

### 3.3 Qué pasa con la extensión que no entra

**Se rechaza entera. No se trunca, y el promo no se consume.**

Truncar es la opción que suena amable y es la deshonesta: la persona canjea un código que dice
*«+15 días»*, recibe cinco y cree que recibió quince. Rechazar con el motivo a la vista —*«tu
trial ya llegó a su máximo»*— es explicable, y no gastarle el canje le deja el código para
cuando le sirva.

### 3.4 El techo ata al promo y no ata a `SUPER_ADMIN`

**Un canje de promo es self-service y el techo lo frena en seco. Una extensión firmada por
`SUPER_ADMIN` puede pasarlo**, y queda registrada como lo que es: una excepción con nombre y
motivo.

No es una grieta en la regla, es la regla `D11` otra vez: extender un trial entrega servicio sin
cobrar, y lo que toca plata lo confirma una persona. La diferencia entre las dos filas no es
«automático contra manual» sino **quién responde por el día regalado**.

### 3.5 La mitad del hueco que era la visibilidad

El hueco dice *«nadie lo ve»*, y eso es la mitad del problema. **El total acumulado de días de
trial, con su origen, se muestra en dos lugares**: en *Mi Suscripción* para la persona, que el
§46 obliga a dar *«claridad total de scope»*, y en el panel del §48 para quien administra. Un
techo que nadie puede consultar antes de otorgar se choca recién al otorgar.

---

## 4. La cuota del trial en los entitlements medidos · cierra `S-TRIAL-01`

### 4.1 Lo que ya estaba decidido, y lo que faltaba

`DEC-ENT-001` decidió el fondo: el trial muestra **todas** las funciones del plan premium, y los
entitlements **medidos** declaran **dos cuotas**, la del plan y la del trial, menor. Es un
apartamiento declarado del *«exactamente»* del §10.3 y vive en el decision log.

Faltaban dos cosas que esa decisión no cubrió, y son las que cierran el hueco.

### 4.2 La cuota del trial se resuelve por `user + vertical`, y por eso se multiplica

El trial es por vertical (§10.1) y hay cinco (§6), así que una misma persona puede abrir cinco
trials y consumir **cinco cuotas de trial**. El techo real de lo que regala el sistema por
persona es:

```text
costo máximo por persona = cuota_de_trial(clave) × cantidad de verticales con trial encendido
```

**No se agrega un tope global por usuario**, y es una decisión, no un olvido. Un tope global
pediría una segunda regla de agregación —qué pasa cuando una vertical ya consumió y otra no— para
acotar un peor caso que ya está acotado y es chico. Lo que sí hace falta es que **el número de
arriba sea visible para quien fija la cuota**: es una multiplicación, no una sorpresa.

### 4.3 La cuota del trial no se resetea

`DEC-ENT-002` fijó que las cuotas se resetean **todos los meses, sea cual sea el ciclo de pago**.
Un trial no tiene ciclo de pago, así que esa decisión no lo alcanza, y acá se completa:

**La cuota de trial es una sola para todo el trial, no una cuota mensual.**

El motivo es directo: con reset mensual, un trial extendido a noventa días entregaría **tres
veces** la cuota de trial, y el techo de la §3 dejaría de proteger lo único que tenía sentido que
protegiera. Las dos reglas tienen que leerse juntas o ninguna limita nada.

**Y la cuota de trial no participa del trinquete** de `DEC-TRIAL-002`: es un valor propio del
trial, no un limit derivado del plan premium. Ya estaba en la implicación 5 de `DEC-ENT-001`; se
repite porque es el error más fácil de cometer al implementar la derivación.

---

## 5. Addons con un trial en el medio · cierra `A-TRIAL-02`

### 5.1 El caso

El §10.5 dice *«no se permite adquirir addons mientras el user solamente está en trial»*. La
palabra **«solamente»** abre un caso que el PDR no resuelve: alguien en trial de Gastronomía
**y** con suscripción comercial viva de Alojamiento no está solamente en trial.

### 5.2 Son dos preguntas y tienen respuestas distintas

**¿Puede comprarlo?** **Sí.** El §38 pide *«una subscription válida compatible»* y la tiene. La
palabra «solamente» del §10.5 hace exactamente ese trabajo: lo que se prohíbe es comprar
teniendo **nada más que** un trial.

**¿Le alcanza a la ficha en trial?** **No.** Y no por una excepción, sino porque **un addon
alcanza lo que dice su scope, y un trial no es el objetivo de ningún scope**:

| scope (§40) | a qué apunta | qué pasa con el trial |
|---|---|---|
| `LISTING` | una ficha concreta que la persona elige | la ficha en trial **no es elegible como objetivo** |
| `VERTICAL_SUBSCRIPTION` | la suscripción de una vertical | el trial **no es una suscripción**: no hay a qué apuntar |
| `USER` · `GLOBAL` | no nombran objetivo | acá está el problema real, y es la regla de abajo |

### 5.3 La regla que hace falta, y es una sola

**Un addon de scope `USER` o `GLOBAL` no aporta nada a una vertical cuyo único título es un
trial.**

Sin ella, la resolución de entitlements —que es por `user + vertical`, capítulo 02 §3.1— sumaría
el addon en **todas** las verticales, trial incluido, y rompería el invariante §64.7 sin que
ninguna línea de código diga «trial». La persona conserva el addon en cada vertical donde tenga
una suscripción real y **sólo se apaga en la que está probando**.

**Falla hacia que el trial reciba de menos**, que es lo que el §10.5 pide, y es explicable en una
frase: este beneficio corre donde tenés una suscripción.

**Se cruza con `M-ENT-03`** —el scope global de entitlements, capítulo 15— y es la misma forma de
razonar: un alcance que no nombra destino tiene que decir explícitamente a qué **no** llega, o
llega a todo por omisión.

---

## 6. La campaña de recuperación · cierra `M-TRIAL-03`

### 6.1 Lo que ya resolvió el capítulo 07

La campaña del §10.7 —+1, +5, +15, +30, +60— está clasificada como **comercial y suprimible**
(cap. 07 §4.1), y de ahí salen cuatro de las cinco cosas que el hueco pedía: **opt-out**
(suprime lo comercial), **rebote duro** y **cuenta borrada** (suprimen todo), y el **tope diario
por destinatario**, que no es global a propósito. Nada de eso se redefine acá.

### 6.2 Lo que falta es la superposición, y no se resuelve suprimiendo

El §10.7 exige que cada correo *«indique claramente la vertical»*, o sea que la campaña es **por
vertical**. Con cinco verticales, quien abandona tres tiene tres secuencias corriendo en paralelo
y sus hitos caen **el mismo día**, porque los tres arrancan de su propio T3.

Dejar que el tope diario resuelva eso sería **suprimir dos de tres**, en silencio y por un
criterio arbitrario. La regla es la otra:

**Una sola pieza por persona y por hito, que nombra todas las verticales que le corresponden.**

La consolidación pasa **antes** que la supresión del capítulo 07, así que el tope diario nunca se
dispara por esta causa. Y el §10.7 se sigue cumpliendo literalmente: un correo que nombra tres
verticales las indica claramente a las tres.

### 6.3 El corte al suscribirse es por vertical

T2 y T5 ya cortan la campaña al autorizarse una suscripción (cap. 03 §2). Lo que hay que decir
acá, porque es donde se equivoca: **corta la de esa vertical y ninguna otra.** Quien se suscribe
a Alojamiento y sigue sin suscribirse en Gastronomía tiene que seguir recibiendo la de
Gastronomía — el trial que no convirtió es el de allá.

Con la consolidación de §6.2 eso se ve directo: la pieza del hito siguiente sale nombrando una
vertical menos.

### 6.4 Y la campaña termina

Después del contacto de +60 la campaña **finaliza** (§10.7: *«no continuar enviando
indefinidamente»*). No se reanuda por nada: ni porque la persona vuelva a entrar, ni porque
publique un borrador. Lo que sí puede pasar es que **arranque otra campaña, la de otra vertical**,
por su propio T3.

---

## 7. El cruce que no existe · disuelve `E-TRIAL-03`

El hueco preguntaba qué hacer cuando la campaña ya se disparó y **después** el trial se extiende:
la persona recibió un aviso que dejó de ser cierto.

**Hay que separar las dos campañas del §10.7, porque sólo una de las dos tiene el problema:**

- **La campaña PREVIA** —10, 5, 2 días antes y el día del vencimiento— **sí** puede quedar
  desmentida por una extensión, y **ya está resuelta**: T4 la **re-agenda** contra la fecha nueva
  (cap. 03 §2). Si el aviso de «faltan 2 días» ya salió, vuelve a salir contra la fecha nueva.
  El sujeto más el hito son la clave de una-sola-vez del capítulo 07 §2, así que la ocurrencia
  nueva es un envío nuevo y no un duplicado suprimido.
- **La campaña de RECUPERACIÓN** —+1 a +60— **no puede quedar desmentida, porque el cruce es
  imposible por construcción.** Arranca en T3, o sea con el trial ya en `TRIAL_EXPIRED`, y la
  única transición que extiende es **T4**, que exige `TRIAL_ACTIVE`. Entre las dos no hay
  camino.

**Y las dos vías de extensión lo confirman por separado:** el §32 es terminal sobre el promo
—*«Sólo válido durante `TRIAL_ACTIVE`. Nunca después. Backend debe rechazar.»*— y una cortesía
sobre alguien en `TRIAL_EXPIRED` no tiene nada que extender: el §34.1 extiende **el trial**, y ahí
ya no hay uno. Lo que un administrador puede darle a esa persona es una cortesía sobre la
suscripción que tome después (§34.2) o un grant (§35), y **ninguna de las dos revive la campaña**.

**El hueco se disuelve, no se contesta.** Y queda como invariante de implementación: si algún día
apareciera un camino que extienda un trial vencido, este cruce volvería a existir — así que ese
camino **no se abre sin reabrir esto**.

---

## Lo que este capítulo NO cierra

- **`BD-TRIAL-01`** —qué pasa cuando la versión de la que deriva el plan de trial cambia en mitad
  de un trial— sigue abierto desde `DEC-TRIAL-001`.
- **El evento de activación de Partner** queda diferido, no respondido (`DEC-TRIAL-003`): hoy su
  trial está en cero y encenderlo es una decisión registrada.
- **Si el mes de la cuota corre por calendario o por aniversario** es del capítulo 15
  (`DEC-ENT-002`, implicación 2). Acá sólo se fijó que la del trial **no** es mensual.
- **Qué significa exactamente archivar** un borrador pre-trial depende de `C-DATA-01`
  (`DEC-TRIAL-007`), y sigue abierta.

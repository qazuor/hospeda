---
title: Master Spec 11 — Trial
linear: HOS-1353
statusSource: linear
created: 2026-09-17
updated: 2026-09-25
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

La máquina está en el capítulo 03 §2 y sus ~~**siete**~~ **ocho** transiciones (la octava, `T8`:
owner 2026-09-25, FASE 9 completa, decisión 6c) no se repiten acá. Este capítulo
resuelve **los ocho huecos que quedaron alrededor de ella**, y todos son variantes de la misma
pregunta: el §10.2 dice que el trial **no se devuelve nunca**, y no dice qué hacer en los casos
donde eso se siente injusto o se puede explotar. El octavo —el §8, el día que una vertical
enciende su trial— es el único que no pregunta por una persona sino por **un cambio de
configuración**, y es por eso que tardó en aparecer. **El §9 no es un noveno hueco**: es una regla
del owner que no estaba escrita —suscribirse durante el trial lo termina, y lo termina el cobro—
(`DEC-TRIAL-010`, owner 2026-09-25), **con su segunda puerta —suscribirse antes de publicar— cerrada
en el §9.4** (FASE 9 completa, 6c).

La respuesta de fondo es una sola y conviene tenerla a la vista antes de los casos:

> **El trial no vuelve. Lo que puede haber es reparación hacia adelante.** Nada rebobina la
> máquina; lo que existe es extenderla mientras corre —o sea en `TRIAL_ACTIVE`—, o compensar
> después con otro instrumento.
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

**La baja por moderación tiene fila desde la FASE 8 completa**: es `PB10`, que lleva la ficha a
`MODERATED`, y de ahí sólo un admin la saca, a `DRAFT` (`PB11`; cap. 03 §9; `F-8CA2-004`, owner
2026-09-25). **Ninguna de las dos toca la máquina de trial**: lo que sigue vale igual.

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
| el trial está en **`TRIAL_ACTIVE`** | una extensión por los días perdidos: es **T4**, la transición que ya existe | el trial nunca murió; sólo se corre su fecha de fin |
| el trial **ya venció** | una **cortesía temporal** sobre la suscripción que tome después (§34, `DEC-GRANT-002`) | no hay trial que extender, y la cortesía es el instrumento que el PDR ya tiene para sostener servicio sin cobrar |

**Las dos las firma `SUPER_ADMIN` con motivo escrito**, porque las dos entregan servicio sin
cobrar y eso es el invariante `D11` del capítulo 04: lo que toca plata lo confirma una persona.
Y las dos quedan en `domain_event` como lo que son —la corrección de un acto nuestro—, no como
una excepción al §10.2, que sigue sin tener ninguna.

### 2.4 Y revocar un grant NO entra acá, aunque se le parezca

**Es el caso que más se parece a éste y se resuelve al revés** (`DEC-TRIAL-009`, owner,
2026-09-21), así que la diferencia va escrita o las dos reglas se leen como una contradicción.

Recibir un *Free Forever* consume el trial de esa vertical —`T2` si estaba corriendo, `T6` si
todavía no—, y **revocarlo no lo devuelve**. El beneficiario queda sin grant, sin suscripción y
sin trial. Suena a la columna derecha de la tabla de §2.2 —*«la pérdida la causamos nosotros»*—
y **no lo es**, por dos razones que hay que leer juntas:

| | la moderación equivocada | la revocación de un grant |
|---|---|---|
| **qué fue el acto** | **un error**: la moderación se equivocó | **una decisión legítima y deliberada**: se termina una concesión que nunca se debió |
| **qué recibió la persona** | **nada** — le bajamos la ficha y el trial se consumió publicando algo que sí correspondía | **cobertura completa del plan anclado, todo el tiempo que duró el grant**, que es estrictamente más de lo que un trial da |

**El trial no se perdió: se gastó, y se gastó recibiendo algo mejor.** Ésa es la lectura literal
de por qué `T6` existe —quien está cubierto no necesita una prueba— y acá la persona **estuvo
cubierta de verdad**. Reparar sería devolver una prueba a alguien que ya tuvo el producto entero.

**Lo que sí corresponde, y es lo único**: que la confirmación de revocar lo diga
(`NUCLEO/08` §3.1). Se declara, no se repara.

**Lo que esto NO autoriza**: leerlo al revés para el caso de la moderación. Ahí la persona no
recibió nada y el acto fue un error, así que la reparación del §2.3 sigue intacta.

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

**Y la extensión firmada por `SUPER_ADMIN` es de esta épica, no de billing** (owner 2026-09-26,
P2; FASE 9 vuelta 1). Es la cortesía durante el trial del §34.1 y la acción *«extender un trial»*
de `NUCLEO/08` §3: corre `T4` (`03` §2) con **origen `SUPER_ADMIN` y motivo obligatorio**, pasa el
techo y suma al total acumulado con su origen (§3.5), con permiso propio y auditoría; la construye
**V4**. **No pasa por `extenderTrial`**, que sigue siendo sólo del canje (`12-contrato…` §4.1):
así el techo se saltea donde vive, por quien firma, y no por un parámetro que llegue del otro
lado del contrato.

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
                           × meses que el techo de días permite   ← revisión del owner, C4 (§4.3)
```

**No se agrega un tope global por usuario**, y es una decisión, no un olvido. Un tope global
pediría una segunda regla de agregación —qué pasa cuando una vertical ya consumió y otra no— para
acotar un peor caso que ya está acotado y es chico. Lo que sí hace falta es que **el número de
arriba sea visible para quien fija la cuota**: es una multiplicación, no una sorpresa.

### 4.3 La cuota del trial ~~no se resetea~~ se renueva cada mes, desde el día en que arrancó

`DEC-ENT-002` fijó que las cuotas se resetean **todos los meses, sea cual sea el ciclo de pago**.
Un trial no tiene ciclo de pago, así que esa decisión no lo alcanza, y acá se completa:

~~**La cuota de trial es una sola para todo el trial, no una cuota mensual.**~~

~~El motivo es directo: con reset mensual, un trial extendido a noventa días entregaría **tres
veces** la cuota de trial, y el techo de la §3 dejaría de proteger lo único que tenía sentido que
protegiera. Las dos reglas tienen que leerse juntas o ninguna limita nada.~~

**La cuota de trial se renueva cada mes, desde el día en que arrancó la prueba** (revisión del
owner, 2026-09-28, C4, `L2-f1`, contra la recomendación, que era una sola cuota para toda la
prueba). Es la regla de la ventana de `15` §7 con el ancla en `T1`: la prueba que arrancó el 10
renueva la cuota el 10 de cada mes mientras dure. **El costo se acepta y se declara**: una prueba
extendida a noventa días entrega tres cuotas de trial, así que el techo de días de la §3 acota
ahora cuántas cuotas se regalan, no una sola. El peor caso de la §4.2 se multiplica por los meses
que el techo permite.

**Y la cuota de trial no participa del trinquete** de `DEC-TRIAL-002`: es un valor propio del
trial, no un limit derivado del plan premium. Ya estaba en la implicación 5 de `DEC-ENT-001`; se
repite porque es el error más fácil de cometer al implementar la derivación.

---

## 5. Addons con un trial en el medio · cierra `A-TRIAL-02`

### 5.1 El caso

El §10.5 dice *«no se permite adquirir addons mientras el user solamente está en trial»*. La
palabra **«solamente»** abre un caso que el PDR no resuelve: alguien en trial de Gastronomía
**y** con un título comercial en Alojamiento —una fuente viva de clase `TÍTULO` que no es un
trial— no está solamente en trial. Se dice así y no *«con suscripción viva»* porque la frase
tiene que ser evaluable del lado de verticales: ~~los dos sentidos de *«vivo»*~~ **dos de los cuatro
sentidos de *«vivo»* —fila viva y fuente viva—** están separados en
el cap. 01 (núcleo) §2.4 (FASE 9 completa, `C-14`), y el que nombra filas de suscripción no cruza la frontera.

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

T2 y T5 ya cortan la campaña cuando **aparece ~~una fuente viva de clase `TÍTULO`~~ un título que
convierte** en esa vertical (cap. 03 §2) —**una suscripción, recién con su primer pago
acreditado** (`DEC-TRIAL-010`, §9)—. Lo que hay que decir acá, porque es donde se equivoca: **corta la de esa vertical y
ninguna otra.** Quien se suscribe a Alojamiento y sigue sin suscribirse en Gastronomía tiene que
seguir recibiendo la de Gastronomía — el trial que no convirtió es el de allá.

**Y el disparador es la aparición del título, no la autorización de una suscripción**, que es
como estaba escrito y dejaba afuera tres formas de quedar cubierto: la cortesía, el grant, y la
suscripción que **se recupera** desde `SUSPENDED` o **se reanuda** desde `PAUSED` sin que se
autorice nada nuevo. En los tres casos la persona está cubierta y la campaña le sigue pidiendo que
se suscriba. La fuente de la que sale la vertical es la misma que la del corte, así que la regla de
*«esa vertical y ninguna otra»* no cambia. **Y para una suscripción nueva el disparador ya no es su
aparición sino su primer pago acreditado** (`DEC-TRIAL-010`, §9): entre la autorización y ese
cobro la campaña previa sigue agendada, y sus hitos se cuentan en días, no en los minutos de
`PA-3`.

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
  **Y vuelve a salir porque la ocurrencia de la clave de una-sola-vez del capítulo 07 §2 lleva la
  fecha objetivo vigente**, no sólo el sujeto y el hito: al correrse la fecha cambia la ocurrencia,
  así que el envío nuevo no es un duplicado suprimido. Con una ocurrencia de sujeto más hito a
  secas, `T4` dejaría al cliente **sin** el aviso que la extensión acaba de volver a hacer
  corresponder.
- **La campaña de RECUPERACIÓN** —+1 a +60— **no puede quedar desmentida, porque el cruce es
  imposible por construcción.** Arranca en T3, o sea con el trial ya en `TRIAL_EXPIRED`, y la
  única transición que extiende es **T4**, que exige `TRIAL_ACTIVE` **y la fecha de fin sin
  pasar**. Entre las dos no hay camino. *(Sólo el estado no alcanzaba: con el job de `T3`
  atrasado, la máquina seguía en `TRIAL_ACTIVE` con el trial vencido, y un canje lo revivía;
  cap. 03 §2, `T4`; FASE 9 vuelta 2, `F-8V2A2-003`.)*

**Y las dos vías de extensión lo confirman por separado:** el §32 es terminal sobre el promo
—*«Sólo válido durante `TRIAL_ACTIVE`. Nunca después. Backend debe rechazar.»*— y una cortesía
sobre alguien en `TRIAL_EXPIRED` no tiene nada que extender: el §34.1 extiende **el trial**, y ahí
ya no hay uno. Lo que un administrador puede darle a esa persona es una cortesía sobre la
suscripción que tome después (§34.2) o un grant (§35), y **ninguna de las dos revive la campaña**.
**Si esa suscripción es de plan ~~anual~~ no mensual —trimestral, semestral o anual—, la cortesía
no está disponible y queda el grant**: la cortesía temporal sólo existe sobre planes mensuales y en
meses enteros (FASE 8 completa, `F-8CB1-001`, `DEC-GRANT-003` impl. 6, `B/14` §4.7; FASE 9
completa, contradicción 1 de `03` §R4.5).

**El hueco se disuelve, no se contesta.** Y queda como invariante de implementación: si algún día
apareciera un camino que extienda un trial vencido, este cruce volvería a existir — así que ese
camino **no se abre sin reabrir esto**.

---

## 8. ~~El día que una vertical enciende su trial~~ Los días de prueba de una vertical no pasan de cero a más ni al revés

~~Esta sección decía qué pasaba el día que una vertical encendía su prueba (sus días de 0 a más de
0): la cohorte de ex-clientes volvía a ser elegible, la regla de `T7` le escribía consumida la fila
a quien ya había ejercido el evento, y el procedimiento eran tres pasos en un solo acto (declarar el
evento, publicar la versión con días > 0 y ejecutar `T7`); dejaba sin declarar el apagado.~~
**Sale entera** (revisión del owner, 2026-09-28, N7): **encender o apagar la prueba de una vertical queda fuera de esta
versión.** El panel, que es donde se editan los días de prueba, **rechaza pasar una vertical de 0
días a más de 0, y de más de 0 a 0** (es una validación de *«publicar una versión de plan»*,
`NUCLEO/02` §1.4: los días de prueba cuelgan de la versión y no son un plazo de la lista del §1.5;
revisión del owner, 2026-09-28, N1); dentro de más de 0 los días se pueden cambiar como cualquier
plazo. Hoy la única vertical en cero es Partner (`DEC-TRIAL-003`), y queda en cero. Con eso `T7` no
tiene disparador y sale de la máquina (cap. 03 §2; el número no se reusa), y la fila de *«no
declara evento, o días = 0»* del cap. 03 §2 pasa a ser un estado final. Si algún día hace falta
encender una vertical, se diseña entonces, y este texto tachado es el punto de partida.

---

## 9. Suscribirse durante el trial termina el trial

(`DEC-TRIAL-010`, owner 2026-09-25; FASE 8 completa, racimo `R12`: `F-8CA2-006`, `F-8CC1-002`.)

### 9.1 La regla, que el owner ya había decidido y no estaba escrita

> **Suscribirse durante el trial termina el trial.** Si el primer cobro sale bien, **los días que
> quedaban se pierden**: la persona eligió pagar antes.

La ejecuta `T2` (cap. 03 §2): la suscripción que ya cobró es un título que convierte, y
`TRIAL_CONVERTED` no tiene vuelta. **No se difiere el primer cobro al fin del trial** para
respetar los días: una fecha futura se convierte sola en un *free trial* del proveedor (`EX-38`),
que es lo que `HOS-1012` eliminó.

### 9.2 Lo que termina el trial es el cobro, no la autorización

**Si el primer cobro se rechaza, el trial sigue**, con los días que le quedaban. El rechazo lleva
la suscripción a `CHARGE_DECLINED` (`S16`, `B/03` §3.2) y la persona queda en `TRIAL_ACTIVE`, como
si no se hubiera suscripto: *«un primer cobro rechazado no es una suscripción con un problema, es
un alta que no ocurrió»* (`B/12` §4.4), y un alta que no ocurrió no consume el trial. Lo que lo
hace posible es un campo del contrato, `cobrada` (`12-contrato…` §2.1), porque la frontera no
distinguía *«autorizó»* de *«cobró»*.

**Mientras el cobro no llega** —entre 26 y 44 minutos en un alta (`PA-3`)— la persona tiene el
trial y la suscripción a la vez, y el pliegue los suma. Está declarado donde se pliega (cap. 15
§2.6) y en la máquina (cap. 03 §2, *«los 26–44 minutos»*).

### 9.3 Lo que la superficie tiene que decir

Las dos mitades se dicen **antes de confirmar el checkout** de alguien en trial: que al acreditarse
el primer cobro **pierde los días que le quedaban**, y que si ese cobro se rechaza **sigue en su
trial**. Es la fila 19-bis de `B/19` §4.

### 9.4 Y suscribirse antes de publicar tampoco quema el trial

(Owner 2026-09-25; FASE 9 completa, decisión 6c, `R12-OWNER-1`.)

La regla del §9.2 tenía una segunda puerta. Quien se suscribe **antes de publicar** —el orden normal
de quien entra pagando— y publica en la ventana de su primer cobro disparaba `T6`, que pedía sólo
`cubierto` verdadero: la fila de `trial` nacía consumida, el cobro se rechazaba y la persona quedaba
**sin suscripción y sin trial**, sin haberlo usado nunca.

> **`T6` exige un título que convierte, como `T2`, y la fila la consume `T8` al primer pago
> acreditado** (cap. 03 §2). Si el cobro se rechaza, la persona sigue en `PRE_TRIAL` y su próxima
> publicación arranca el trial por `T1`: un alta que no ocurrió no consume el trial, por ninguna de
> las dos puertas.

**Y la superficie empuja al camino que no la necesita**, que es la mitad que agregó el owner: **el
botón de suscribirse de una vertical en la que la persona todavía no publicó la manda a publicar**
**si publicar le arrancaría el trial** (la regla, escrita sólo en `V/19` §4 fila 23; FASE 9 vuelta 1,
`F-8V1D1-004`)
—y eso arranca el trial— en vez de al checkout (`V/19` §4, fila 23; su espejo, `B/19` §4). `T8`
queda como red para quien llega al checkout por otro camino.

---

## Lo que este capítulo NO cierra

- **`BD-TRIAL-01`** —qué pasa cuando la versión de la que deriva el plan de trial cambia en mitad
  de un trial— sigue abierto desde `DEC-TRIAL-001`.
- **El evento de activación de Partner** queda diferido, no respondido (`DEC-TRIAL-003`): hoy su
  trial está en cero ~~y encenderlo es una decisión registrada. **Qué hay que hacer el día que se
  encienda sí está resuelto, y es el §8** — lo que falta es **cuál** es el evento, no el
  procedimiento~~ **y no se enciende en esta versión** (revisión del owner, 2026-09-28, N7; §8).
- ~~**Si el mes de la cuota corre por calendario o por aniversario** es del capítulo 15
  (`DEC-ENT-002`, implicación 2). Acá sólo se fijó que la del trial **no** es mensual.~~ **Cerrado**
  (revisión del owner, 2026-09-28, C4): por la fecha del ciclo de cada persona (`15` §7), y la del
  trial **también** es mensual, desde el día en que arrancó (§4.3, `L2-f1`).
- **Qué significa exactamente archivar** un borrador pre-trial depende de `C-DATA-01`
  (`DEC-TRIAL-007`), y sigue abierta.

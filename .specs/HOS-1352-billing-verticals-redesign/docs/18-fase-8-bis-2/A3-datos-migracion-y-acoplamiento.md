---
title: "FASE 8-bis-2 · A3 — datos, migración y acoplamiento"
linear: HOS-1352
statusSource: linear
created: 2026-09-20
updated: 2026-09-20
status: CURRENT
fase: 8
---

# FASE 8-bis-2 · A3 — datos, migración y acoplamiento

Tercera pasada A3, sobre el texto que la **9-bis** produjo. El vector no cambia —columnas que
hacen falta y no existen, columnas que existen y nadie escribe, datos que dos lugares declaran
distinto, restricciones que no se pueden cumplir, caché e invalidación, y todo punto donde una
épica necesita algo de la otra sin que el contrato lo declare— pero el **encargo** sí: la regla
nueva (`DEC-METH-008`) manda recorrer **el dominio que el arreglo CREA**, y preguntar por escrito
**qué premisa de otro arreglo se vuelve falsa**. Esas dos preguntas produjeron cinco de los seis
críticos de abajo; ninguno sale de mirar el problema viejo.

**Diecisiete hallazgos: 6 `CRITICA`, 6 `ALTA`, 4 `MEDIA`, 1 `BAJA`.**

**Atribución, que es el dato que mide si el ciclo converge: de los 6 críticos, los 6 los
introdujo la tanda de arreglos de la 9-bis.** Ninguno es un defecto preexistente. La proporción
de la 8-bis (25 de 25 en A y B) **se repite en este vector**. Lo que sí cambió es la **forma**:
en la 8-bis los críticos salían de arreglos que no se habían leído entre sí; acá cinco de los
seis salen de un arreglo que **quedó escrito en un solo lado de una frontera de dos lados**. Es
un modo de falla distinto y más barato de cerrar, y está desarrollado en el §«El dominio del
arreglo» al final.

Los ejes nuevos que la instrucción manda recorrer se recorrieron: la tabla `tipo` × `hasta` del
contrato §2.4 (24 celdas, verificadas una por una — `F-8cA3-016`), los nueve estados de la
suscripción cruzados con los seis **vivos** de `B/02` §2.2 (`F-8cA3-001`), `T6` y `S17` como
transiciones nuevas (`F-8cA3-001`, `F-8cA3-007`), y `sucede_a` nulo/no nulo contra las
operaciones de datos.

---

## CRITICA

### F-8cA3-001 — `T6` pregunta por «una suscripción viva» y el contrato esconde justo los tres estados donde la respuesta importa: el trial colgado vuelve, y el que abandona un checkout quema su trial de por vida

**Qué se rompe.** Dos desenlaces, los dos caros, y los dos sobre el mismo hueco.

1. Alguien con la suscripción **`SUSPENDED` por impago** publica una ficha. `T6` no puede
   reconocerlo —su estado no cruza la frontera—, así que dispara `T1`: entra en `TRIAL_ACTIVE`
   con 30 días de servicio completo **encima de una deuda**, y queda sin salida alcanzable, que es
   exactamente el defecto que `T6` vino a cerrar.
2. Alguien **empieza un checkout y publica antes de terminarlo**. Si `T6` sí lo reconoce —su fila
   está en `PENDING_AUTHORIZATION`, que `B/02` §2.2 cuenta entre los **vivos**—, le escribe la
   fila de `trial` **consumida**. Después abandona el checkout, la fila pasa a `ABANDONED`, y esa
   persona se queda **sin suscripción y sin trial**, para siempre: la fila es única de por vida y
   ninguna transición vuelve.

Las dos ramas salen de la misma frase, y **no hay una tercera**: o `T6` lee el estado de la
suscripción —que la frontera prohíbe— o lee `cubierto` —y entonces la rama 1 es la que corre—.

**El camino.**

1. La condición de `T6` es, textual: `V/03` §2 — *«| T6 | `PRE_TRIAL` | el evento de activación
   declarado por la vertical | `TRIAL_CONVERTED` | **ya hay una suscripción viva** para ese
   `user + vertical` | **crea la fila de `trial`, consumida**, sin reloj y sin campaña |»*.
2. *«Viva»* está definido, y son **seis** estados: `B/02` §2.2 — *«**Los «vivos» siguen siendo los
   mismos seis**: `PENDING_AUTHORIZATION`, `ACTIVE`, `GRACE_PERIOD`, `PAUSED`, `SUSPENDED` y
   `CANCEL_SCHEDULED`»*.
3. **Tres de esos seis no emiten fuente de cobertura**, y eso es el arreglo 16:
   `12-contrato-de-cobertura.md` §2.6 — *«| `PENDING_AUTHORIZATION` | **no** | — |»*,
   *«| `PAUSED` por `CUSTOMER_REQUEST` | **no** | — |»*, *«| `SUSPENDED` | **no** | — |»*, con la
   regla en negrita: *«**Una suscripción esperando autorización NO emite fuente de cobertura.**»*
4. Y el estado tampoco cruza por ningún otro lado: `12-contrato…` §4 — *«**El estado exacto de la
   suscripción no cruza.** Verticales no distingue `ACTIVE` de `GRACE_PERIOD` … Pasarla sería
   invitar a que alguien escriba una regla de producto sobre un estado de cobranza»*. La dirección
   inversa del §4.1 transporta tres preguntas y **ninguna** devuelve el estado de una suscripción.
5. Entonces lo único que verticales puede consultar es `cubierto`, que *«cuenta sólo las de clase
   `TÍTULO`»* (`12-contrato…` §2.1, §2.4). Con `cubierto` como condición, `T6` **no dispara** para
   los tres estados invisibles.
6. Y `T1` sí dispara sobre ellos, porque **su condición no ganó nada**: `V/03` §2 — *«| T1 |
   `PRE_TRIAL` | el evento de activación declarado por la vertical | `TRIAL_ACTIVE` | **la vertical
   declara evento y su plan de trial tiene días de trial > 0** | … |»*. Las dos condiciones son del
   **catálogo**; ninguna mira al sujeto.
7. La fila queda en `TRIAL_ACTIVE` sin salida, y el propio capítulo describe el desenlace como si
   estuviera cerrado: `V/03` §2 — *«`T3` no puede vencerlo porque exige que no haya suscripción
   autorizada, y `T2` espera **un evento que ya ocurrió**»*. Para un `SUSPENDED` las dos siguen
   valiendo.
8. La rama 2 se apoya en que la fila de `trial` **no se devuelve nunca**: `V/02` §2.2 —
   *«**`UNIQUE(user_id, vertical)`** — sin condición de estado … el trial es único **de por
   vida**, así que la fila sobrevive a todo y su sola existencia niega un trial nuevo»*— y `V/02`
   §4.1, *«Se conserva íntegro, siempre»*.
9. Y abandonar un checkout no es un borde: el propio contrato lo describe como conducta normal y
   repetible. `12-contrato…` §2.6 — *«**hasta 72 horas de servicio completo gratis, y repetibles**
   —se abandona el checkout y se empieza de nuevo—»*.

**Dónde lo permite el diseño.** Las nueve citas de arriba, más la que muestra que la premisa de
`T6` es falsa justo para estos casos: `V/03` §2 — *«**Y consumirlo es lo correcto, no un
castigo**: … Lo que no pierde es nada: **no necesita probar lo que ya está pagando**»*. Un
`PENDING_AUTHORIZATION` no está pagando nada, y un `ABANDONED` no pagó nunca.

**Severidad.** `CRITICA`, por las dos mitades y por separado: la rama 1 es *alguien que dejó de
pagar conserva servicio* —es el mismo desenlace de `F-8bA3-002`, que la 9-bis declaró cerrado— y
la rama 2 es *un dato se pierde sin vuelta*, sobre el único activo del modelo que ningún capítulo
permite restituir.

**¿Es nuevo, o es el arreglo?** **Es el arreglo, y son dos que se cruzan.** `T6` es el **arreglo
8**; el mapa de los nueve estados que saca `PENDING_AUTHORIZATION`, `SUSPENDED` y
`PAUSED`/`CUSTOMER_REQUEST` de la cobertura es el **arreglo 16**. Cada uno es correcto solo. El
8 se escribió con un predicado —*«hay una suscripción viva»*— que el 16 volvió **inobservable
desde el lado que tiene que evaluarlo**, y los dos se escribieron en la misma tanda.

---

### F-8cA3-002 — `addon_product.version_id` sigue declarado como «la referencia que transporta una fuente `ADDON`», así que publicar una versión nueva mueve todas las instancias vivas — el arreglo entró en verticales y la frase que lo rompe quedó en billing

**Qué se rompe.** El mismo desenlace que `F-8bA3-003` midió y que el arreglo 10 vino a cerrar:
quien compró *«+30 fotos»* pasa a tener lo que diga la versión nueva, sin comprar nada y sin que
nadie se lo avise. La columna que lo impide **ya existe**; lo que no se corrigió es la frase que
le dice a billing que use la otra.

**El camino.**

1. El arreglo entró del lado de verticales, completo y con su razón escrita: `V/02` §2.1 — *«El
   anclaje vive en `addon_instance` (`B/02` §2.4), igual que la suscripción ancla la suya, y **la
   referencia que el contrato transporta para una fuente `ADDON` es la de la INSTANCIA, nunca la
   del producto**»*.
2. La columna se creó: `B/02` §2.4 — *«| **`addon_instance`** | producto, **la `addon_version` que
   ANCLÓ al comprarse**, dueño, **objetivo** …| … **la versión anclada no es anulable** |»*.
3. **Y en la misma tabla, dos renglones más arriba, la frase vieja sigue entera**: `B/02` §2.4 —
   *«| **`addon_product`** | … más **`version_id`** → `addon_version` … | `version_id` **no es
   anulable**: **es la referencia que transporta una fuente `ADDON`** |»*.
4. Las dos frases son normativas, dicen lo contrario, y **nadie las dirime**: el contrato §2.1
   sólo dice *«`referencia` … una versión de plan o una versión de addon»* y §2.3 *«un addon
   transporta su `versiónDeAddon`»*, sin nombrar columna.
5. **Y quien escribe la fuente es billing**, que es de quien es `addon_instance` y `addon_product`
   (`B/02` §2.4) y quien implementa la mitad real del contrato (`12-contrato…` §5.2). O sea: el
   lado que va a implementarlo lee, en su propio capítulo, la instrucción equivocada.
6. `addon_product` **sigue sin estar declarado inmutable** en ningún lado —lo inmutable es
   `addon_version` (`V/02` §2.1)—, así que *«publicar una versión nueva»* sigue pudiendo ser
   *«mover `addon_product.version_id`»*.
7. Y no hay red: la entrada de invalidación que el arreglo 4 agregó —*«se publica una versión
   nueva de un `addon_version`»* (`V/02` §3.2)— invalida el caché, pero **invalidar un caché no
   deshace un cambio de lo que se compró**; sólo hace que la lectura siguiente devuelva el valor
   nuevo más rápido.

**Severidad.** `CRITICA`. Alguien recibe de más o de menos lo que pagó, por el mismo mecanismo
que `DEC-ARCH-001` fue a evitar, y con la mitad del arreglo puesta.

**¿Es nuevo, o es el arreglo?** Es el arreglo: **el 10**. El defecto que arregla es
`F-8bA3-003`; lo que quedó abierto es que el arreglo se escribió en `V/02` §2.1 y en la fila de
`addon_instance`, y **no se releyó la fila de al lado**, que es la que sostiene la afirmación
contraria.

---

### F-8cA3-003 — En la mañana del corte `cubierto` nunca CAMBIA, así que `PB2` no dispara: la población existente se queda publicada sin cobertura y sin ningún motivo para contratar

**Qué se rompe.** El capítulo 21 de verticales declara, como consecuencia determinada y no como
rama, que *«las fichas publicadas de Alojamiento se despublican la mañana del corte»*, y sobre eso
apoya la decisión de **no sembrar nada** y de resolverlo con llamadas. En un sistema recién
desplegado **`cubierto` no pasa de verdadero a falso: nace falso**, y `PB2` está atado al
**cambio**. Si no dispara, la población existente amanece con sus fichas **publicadas y sin
cobertura**, indefinidamente, y la palanca entera del plan del corte —*«la ficha vuelve sola
cuando contratan»*— deja de existir: nadie necesita contratar para tener lo que ya tiene.

**El camino.**

1. `PB2` se disparaba por una lista y ahora se dispara por el cambio — es el arreglo 9: `V/03` §9
   — *«| PB2 | `PUBLISHED` | **`cubierto` pasa a falso** | `UNPUBLISHED_BY_BILLING` |»* y
   *«**`PB2` y `PB3` se disparan por el CAMBIO de `cubierto`, no por una lista de transiciones**»*.
2. El mecanismo es el aviso de billing, y está dicho: `V/03` §9 — *«**El contrato ya emite el
   hecho** —*«la cobertura de (user, vertical) cambió»*(`12-contrato…` §3)— así que atarse a él
   **no agrega un mecanismo: usa el que estaba**»*.
3. El aviso es de billing y sólo sale cuando **algo cambia** del lado de billing:
   `12-contrato-de-cobertura.md` §3 — *«`evento: la cobertura de (user, vertical) cambió` … Lleva
   qué fuente cambió y en qué dirección»*.
4. En la mañana del corte **no hay nada del lado de billing que pueda cambiar**: `V/21` §2.1 —
   *«**El sistema nuevo no hereda una sola fila.**»*— y `B/21` §2.4, ídem. No hay suscripción, no
   hay cortesía, no hay trial: no hay fuente que se apague, así que no hay aviso.
5. Y el capítulo 21 afirma lo contrario como si fuera deducido: `V/21` §2.4 — *«`PRE_TRIAL` **no
   cubre** … y `PB2` se dispara **por el cambio de `cubierto`** (`V/03` §9), así que **las fichas
   publicadas de Alojamiento se despublican la mañana del corte**. **No es una ambigüedad entre
   dos ramas: es una consecuencia.**»* La deducción usa la mitad *«no cubre»* y se saltea la mitad
   *«cambia»*, que es la que el arreglo 9 acababa de convertir en el disparador.
6. La salida que parece equivalente —evaluar por condición en vez de por evento— está declarada
   **para otro consumidor y sólo para él**: `V/15` §4.2 — *«El reconciliador de excedentes **no se
   dispara por evento: se dispara por condición**»*, y el contrato §3 lo subraya: *«El evento no
   reemplaza la consulta»*. Ninguno de los dos dice eso de `PB2`; `V/03` §9 dice lo contrario, con
   su razón escrita.
7. Y el reconciliador de excedentes tampoco lo tapa: *«actúa **sólo si algo bajó**»* (`V/15` §4.2),
   y en el primer recálculo de la historia del sistema no hay contra qué comparar.

**Dónde lo permite el diseño.** Las citas de arriba, más las dos que muestran que todo el plan
del corte descansa en el disparo:

- `16-fase-7-del-paraguas.md` §4.2 — *«Las fichas publicadas de Alojamiento **se despublican la
  mañana del corte** —es una consecuencia, no una falla (`V/21` §2.4)— y **vuelven solas cuando
  cada dueño contrata**. **El aviso va ANTES del paso 1**»*.
- `DEC-MIG-003`, precisión del 2026-09-20 — *«Sin filas, todo el mundo queda en `PRE_TRIAL`; como
  un reloj que no arrancó no da cobertura, **las fichas publicadas de Alojamiento se despublican
  la mañana del corte**. **Se acepta** … **No se les siembra nada** — hay que llamarlos igual»*.
  La decisión del owner está tomada **sobre un efecto que el mecanismo no produce**.

**Severidad.** `CRITICA`. Es acceso a algo que no corresponde —ficha publicada, cobertura cero—
para el 100 % de la población existente de la vertical con datos, y no falla ruidosamente: el
sistema se ve perfecto la mañana del corte. Y la dirección del error es la cara: nadie va a
contratar para recuperar algo que no perdió.

**¿Es nuevo, o es el arreglo?** **Es el arreglo, y son dos.** El **arreglo 9** cambió el
disparador de `PB2` de una lista de transiciones a un cambio de `cubierto`; el **arreglo 22**
escribió, tres días después, un plan de corte cuyo primer efecto es ese disparo. El 22 cita al 9
por número de sección y usa la mitad de su enunciado.

---

### F-8cA3-004 — La regla que descarta los complementos sin título se escribió en el contrato, y el capítulo que ejecuta el pliegue sigue diciendo «todas las fuentes vivas»

**Qué se rompe.** El suspendido conserva las capacidades que le da su addon. Es literalmente el
desenlace que el arreglo 2 midió y declaró cerrado, y sobrevive porque el arreglo se escribió en
el documento que **define** y no en el que **ejecuta** — que es, palabra por palabra, el
diagnóstico que el propio arreglo hace de por qué la versión anterior no alcanzaba.

**El camino.**

1. El arreglo 2, en el contrato: `12-contrato-de-cobertura.md` §2.4 — *«**El pliegue del conjunto
   efectivo DESCARTA las fuentes de clase `COMPLEMENTO` cuando no hay ninguna de clase `TÍTULO`
   viva.** Un complemento agrega sobre un título; sin título no agrega sobre nada.»*
2. Su propio diagnóstico de por qué la versión anterior falló: *«**No es una regla nueva: es la
   misma que este § ya enuncia**, dicha **donde se ejecuta** en vez de sólo donde se define.
   *«Agrega capacidades sobre un título»* era una frase en el contrato y **una frase no es un
   gate**: **el capítulo 15 pliega lo que el contrato le da**, y le estábamos dando el addon sin
   decirle que dependía de otra cosa.»*
3. **Y quedó escrita en el contrato otra vez.** El capítulo 15 —el que pliega— no la tiene. Su
   única regla de pliegue sigue diciendo lo contrario: `V/15` §2.2 — *«| **acumula** | `SUMA` |
   **suma todas las fuentes vivas** | fotos, fichas, destaques |»*. `descarta`, `COMPLEMENTO` y
   `TÍTULO` **no aparecen en ninguna línea del capítulo 15**.
4. Y el contrato le entrega las tres clases, a propósito: `12-contrato…` §2.1 — *«| **`fuentes`** |
   **todas** las fuentes vivas, **de las tres clases**, no la que manda |»*. O sea que el capítulo
   15 recibe el addon del suspendido y su única regla escrita le dice que lo sume.
5. El desenlace está medido en el mismo §2.4: *«una instancia de addon **viva** convive con una
   suscripción `SUSPENDED`, a la que el §21 deja *«sin entitlements comerciales»* … **dejó de pagar
   y sigue adentro**»*.

**Dónde lo permite el diseño.** Las cinco citas, más la que cierra la puerta a que el contrato lo
resuelva por su cuenta: `12-contrato…` §2.3 — *«Si el contrato devolviera los entitlements
resueltos, la resolución del capítulo 15 —las cuatro estrategias de agregación, los scopes, el
trinquete— pasaría a vivir del lado de billing»*. El filtrado **tiene** que ocurrir en el capítulo
15, y el capítulo 15 no lo dice.

**Severidad.** `CRITICA`. Alguien que dejó de pagar accede a capacidades que no le corresponden, y
es el fail-open que el §2.4 declara haber cerrado dos veces.

**¿Es nuevo, o es el arreglo?** Es el arreglo: **el 2**. El defecto anterior era el mismo, y su
arreglo repitió el modo de falla que él mismo nombra —*«una frase no es un gate»*— en el documento
de al lado.

---

### F-8cA3-005 — `permanent_grant` guarda UN plan y el contrato exige UNO POR VERTICAL: la segunda vertical de un *Free Forever* resuelve sus capacidades leyendo el plan de la primera

**Qué se rompe.** Exactamente lo que el arreglo 6 fue a cerrar, y con las palabras del propio
contrato: *«una clave de una vertical alimentada desde otra»*. El beneficiario de un grant de
scope dos verticales recibe, en la segunda, las claves de la primera — que pueden ser más o menos,
y en ninguna dirección son las suyas.

**El camino.**

1. La regla, en el contrato: `12-contrato-de-cobertura.md` §2.8 — *«**El grant se ancla a un PLAN
   POR CADA VERTICAL de su scope**»* y *«Así que **un grant de scope N verticales ancla N planes,
   uno de cada una**, y cada fuente transporta el suyo.»*
2. Su razón, medida ahí mismo: *«Con un solo plan anclado, las dos fuentes transportaban **la misma
   referencia** y la segunda vertical resolvía sus capacidades leyendo el plan de la primera — una
   clave de una vertical alimentada desde otra, que es exactamente lo que el §64.10 prohíbe»*.
3. **Y la fila sigue teniendo uno.** `B/02` §2.4 — *«| **`permanent_grant`** | beneficiario,
   **scope de verticales**, `includesAddons`, quién lo firmó, motivo, suscripciones afectadas
   (§35.4), **el `plan` que otorga** y **el piso del trinquete** | ídem; **el plan no es
   anulable** |»*. Un `scope de verticales` en plural y **un** `plan` en singular, en la misma
   celda.
4. El bullet que desarrolla la columna lo confirma en singular: `B/02` §2.4 —
   *«**`permanent_grant.plan_id`, y NO una versión.** El grant resuelve **la versión vigente de ese
   plan**»*. `plan_id`, no `plan_ids`; y el piso del trinquete, igual de singular.
5. Un plan pertenece a **una** vertical, así que con una columna el problema es estructural, no de
   uso: `V/02` §2.1 — *«| **`plan`** | … | `UNIQUE(vertical, slug)` |»*, que el contrato §2.8 cita
   como la razón del arreglo.
6. **Y hay una tercera forma, incompatible con las otras dos.** El capítulo 21 de billing propone
   resolverlo con **N filas** en vez de N planes en una: `B/21` §2.4 — *«**Con una precisión que no
   es de forma: una fila por cada vertical de su scope.** Un grant ancla **un plan por vertical**
   (`12-contrato…` §2.8)»*. Con N filas, `scope de verticales` de `B/02` §2.4 pasa a valer siempre
   uno, y ninguna restricción lo dice; ni existe un `UNIQUE(beneficiario, vertical)` que impida dos
   grants pisándose.

**Dónde lo permite el diseño.** Las seis citas de arriba. Las tres formas conviven: **un grant con
N planes** (contrato §2.8), **un grant con un plan y scope plural** (`B/02` §2.4) y **N grants de
un plan cada uno** (`B/21` §2.4). El único que describe una tabla es el segundo, y es el que
produce el defecto.

**Severidad.** `CRITICA`. Alguien accede a claves de una vertical que no le fueron concedidas —o
pierde las que sí—, sobre un instrumento que el diseño describe como *«para siempre»*, y sobre el
invariante §64.10 que el capítulo 17 entero existe para sostener. Además es el **caso del corte**:
las dos `comp` medidas se escriben como `permanent_grant` (`DEC-MIG-003`), así que la primera
ejecución de esta fila es la noche del corte.

**¿Es nuevo, o es el arreglo?** Es el arreglo: **el 6**. La regla *«un plan por vertical»* se
escribió en el contrato y la entidad que tiene que guardarlos **no se tocó**; la tercera forma
(`B/21` §2.4) se escribió en la misma tanda, citando la regla, y con otra solución.

---

### F-8cA3-006 — La entidad `listing` no tiene de dónde salir: las 12 filas de Alojamiento medidas no tienen camino declarado al modelo nuevo, y todo el plan del corte las supone ahí y publicadas

**Qué se rompe.** El capítulo 21 de verticales declara tres veces que no se escribe ninguna fila,
y el plan del corte se apoya, palabra por palabra, en que **las fichas existen en el modelo nuevo y
están en estado `PUBLISHED`**. Entre las dos cosas falta un mapeo que ningún capítulo escribe: ni
qué tabla legacy se convierte en `listing`, ni cómo se traduce su visibilidad actual a los cuatro
estados del capítulo 03 §9, ni quién lo ejecuta ni en qué paso del corte. Si no se hace, las 12
fichas **no existen** para el sistema nuevo; si se hace mal, el estado con el que amanecen decide
si están arriba o abajo, y nadie declaró cuál es el correcto.

**El camino.**

1. `listing` es una entidad de la épica de verticales, con columnas y restricción propias:
   `V/02` §2.5 — *«| **`listing`** | vertical, **un solo `owner_user_id`** (§6), **estado del cap.
   03 §9**, contenido | la FK al dueño no es anulable |»*. **Es la única aparición de la palabra
   `listing` en los once capítulos de `HOS-1353`** (verificado: `rg -n "listing"` sobre
   `HOS-1353-…/docs/*.md` devuelve una línea).
2. Su columna de estado tiene dominio cerrado y cuatro valores: `V/03` §9, transiciones `PB1`…`PB6`
   sobre `DRAFT`, `PUBLISHED`, `UNPUBLISHED_BY_BILLING` y `ARCHIVED`.
3. Lo medido son **12 filas de alojamiento y 22 usuarios** —`07-facts-inventory.md`, sección
   *«Contenido y usuarios»*, medición del 2026-09-15 contra producción—. **Cuántas de las 12 están
   publicadas no se contó**, y la consulta 3 del mismo documento no lo pregunta.
4. El capítulo 21 de verticales **no las menciona**. Su §4 —*«Lo que NO se migra, y no es una
   omisión»*— enumera *«Gastronomía, experiencia y partner: cero filas»* y `commerce`, y **no dice
   nada de las 12 de Alojamiento**. Su §2.4 cierra con *«del lado de verticales **no se escribe
   ninguna fila**, así que *«el sistema nuevo no hereda una sola fila»* sigue siendo literal acá»*.
5. Y al mismo tiempo el §2.4 las da por existentes y publicadas: *«el evento que los sacaría **ya
   ocurrió**: `T1` dispara con *«la ficha queda publicada»* … y **sus fichas ya están
   publicadas**»*, *«**las fichas publicadas de Alojamiento se despublican la mañana del corte**»*,
   *«la ficha de cada uno está abajo **desde el corte hasta que esa persona contrata**»*.
6. El documento del corte hereda el supuesto sin agregar el paso: `16-fase-7-del-paraguas.md` §4.2
   tiene **cuatro pasos** —cancelar, verificar, desplegar, sembrar las lápidas— y ninguno toca
   fichas.
7. Y el camino de vuelta depende del estado exacto: **`PB1` sale sólo de `DRAFT`** y
   **`UNPUBLISHED_BY_BILLING` sólo sale por `PB3` o `PB4`** (`V/03` §9). Una ficha que amanezca en
   el estado equivocado no tiene cómo volver a `DRAFT`, así que su dueño **no puede republicarla a
   mano** ni disparar su propio `T1`.

**Dónde lo permite el diseño.** Las citas de arriba, más la que muestra que el hueco es del
capítulo y no del lector: `V/21`, encabezado — *«Este capítulo es corto por una razón que está
medida: **no hay casi nada que migrar**»*, con los tres huecos que cierra (`M-MIG-01`, `O-MIG-01`,
`R-MIG-01`) todos sobre la cartera de suscripciones. El contenido nunca fue el sujeto de ninguno.

**Severidad.** `CRITICA`. Es el único lugar del programa donde hay **contenido real de clientes
reales** —12 filas, medidas— y el camino de ese contenido al modelo nuevo no está escrito en
ninguna parte. La dirección del error es la peor de las dos: un mapeo que nadie diseñó, ejecutado
la noche del corte, sobre datos que no tienen copia en el sistema nuevo.

**¿Es nuevo, o es el arreglo?** **Lo destapó el arreglo 22.** El hueco es anterior —`listing`
aparece una sola vez desde que se escribió el capítulo 02—, pero hasta la 9-bis nadie había
preguntado *«cómo amanece la población existente»*. El arreglo 22 hizo la pregunta, la contestó
para el **estado de cobertura** de las personas, y **dejó sin contestar la mitad que es de datos**:
de dónde salen las filas sobre las que ese estado se aplica. La frase *«el programa nunca preguntó
esto»* con la que abre `V/21` §2.4 sigue siendo cierta para esta mitad.

---

## ALTA

### F-8cA3-007 — `T1` y `T6` disparan con el mismo evento desde el mismo estado y sus condiciones no son disjuntas: la máquina de trial dejó de ser determinista

**Qué se rompe.** Para toda persona que ya tiene una suscripción viva en una vertical con evento y
trial > 0, el acto de publicar habilita **dos** transiciones distintas hacia **dos** estados
distintos, y ningún capítulo dice cuál gana. Una lleva a `TRIAL_CONVERTED` con la fila consumida;
la otra a `TRIAL_ACTIVE` sin salida.

**El camino.**

1. `V/03` §2, las dos filas, verbatim en sus columnas *desde* / *evento* / *condición*:
   - `T1`: `PRE_TRIAL` · *«el evento de activación declarado por la vertical»* · *«la vertical
     declara evento **y** su plan de trial tiene días de trial > 0»*;
   - `T6`: `PRE_TRIAL` · *«el evento de activación declarado por la vertical»* · *«**ya hay una
     suscripción viva** para ese `user + vertical`»*.
2. **Mismo origen, mismo evento**, y las condiciones se pueden satisfacer las dos a la vez: la de
   `T1` es del catálogo y la de `T6` del sujeto. Nada las excluye.
3. `T1` **no ganó la condición negativa** que el texto de `T6` supone. El párrafo explicativo dice
   *«`T6` cierra el caso»* (`V/03` §2) y la fila de `T1` quedó igual.
4. La regla del núcleo que gobierna las tablas **no exige guardas disjuntas**: `NUCLEO/03` §1,
   regla 1 — *«**La tabla de transiciones es exhaustiva.** Lo que no está, no pasa»*. Dice qué
   pasa con lo que **falta**, nada con lo que **sobra**. `NUCLEO` — la regla 1 no tiene la mitad de
   unicidad; es de la pasada C.
5. La rama mala es la de `F-8cA3-001`: si gana `T1`, la fila queda en `TRIAL_ACTIVE` sin salida
   alcanzable.

**Severidad.** `ALTA`. El desenlace caro está contado en `F-8cA3-001`; lo que este hallazgo agrega
es que **ni siquiera para los tres estados que sí se ven** la máquina decide sola. No llega a
`CRITICA` por sí solo porque su peor rama ya está contada.

**¿Es nuevo, o es el arreglo?** Es el arreglo: **el 8**. `T6` es una transición nueva, y el dominio
que crea —los pares `(estado de origen, evento)` que ahora tienen dos salidas— es exactamente lo
que `DEC-METH-008` manda recorrer. Se recorrió: es el único par con dos salidas en las tres
máquinas de verticales.

---

### F-8cA3-008 — `T6` escribe una fila de `trial` que la entidad no puede expresar: no tiene inicio, no tiene fin y no tiene piso del trinquete

**Qué se rompe.** La transición nueva declara que la fila nace *«consumida, sin reloj»*, y la
entidad `trial` declara cinco datos que toda fila lleva y ninguno admite nulo. Tres de los cinco
no tienen valor posible en `T6`. La fila o no se puede escribir, o se escribe con valores
inventados que después se muestran: el total acumulado de días de trial es **obligatorio en dos
superficies**.

**El camino.**

1. La entidad: `V/02` §2.2 — *«| **`trial`** | `user`, vertical, estado del cap. 03 §2, referencia
   al plan de trial, **referencia a las versiones vigentes al arrancar** (el piso del trinquete),
   **inicio**, **fin** y **el hash irreversible del correo normalizado** (§4.1) |»*. Ninguna nota
   de anulabilidad en ninguna de las ocho.
2. Los efectos de `T6`: `V/03` §2 — *«**crea la fila de `trial`, consumida**, **sin reloj** y sin
   campaña»*. Sin reloj es sin `inicio` y sin `fin`.
3. El piso del trinquete son *«las versiones vigentes **al arrancar**»* — y `T6` no arranca nada.
   Tampoco hay a qué apuntar: `V/02` §2.2 exige que sea **referencia** y no copia.
4. *«Referencia al plan de trial»* tampoco es obvia: la fuente de un `TRIAL_CONVERTED` **no está
   viva** (`V/03` §2, tabla de estados: *«| `TRIAL_CONVERTED` | no | — | — |»*), así que la
   referencia no se usa nunca y se escribe igual.
5. Y lo que se escriba se muestra: `V/11` §3.5 — *«**El total acumulado de días de trial, con su
   origen, se muestra en dos lugares**: en *Mi Suscripción* para la persona … y en el panel del
   §48»*.

**Severidad.** `ALTA`. Una restricción que no se puede cumplir sobre la única fila del modelo que
*«se conserva íntegra, siempre»* (`V/02` §4.1), y que además alimenta dos superficies. No llega a
`CRITICA` porque el valor que se muestre mal es cero días, en la dirección barata.

**¿Es nuevo, o es el arreglo?** Es el arreglo: **el 8**. La forma de fila que `T6` necesita no
existía antes de `T6`.

---

### F-8cA3-009 — La lápida se escribe en `CANCELLED`, y `CANCELLED` es uno de los tres estados que el barrido NO recorre: el cobro viejo que llega tarde no lo levanta nadie, y la marca con reloj tampoco escala

**Qué se rompe.** La lápida cumple la mitad que el arreglo 21 midió —el cobro viejo deja de
imputarse a la suscripción nueva— y **queda sin la segunda mitad**: nadie mira ese cobro. El
capítulo 09 nombra al barrido como quien lo encuentra, y el mismo capítulo excluye del barrido
exactamente el estado en el que la lápida vive. El cliente pagó dos veces —el cobro viejo y su
suscripción nueva— y ningún mecanismo del diseño levanta la mano.

**El camino.**

1. La lápida y el mecanismo que se le atribuye: `B/21` §2.5 — *«**El compromiso viejo se conserva
   como una `subscription` en `CANCELLED` con su `provider_link`** … Con la lápida, **el barrido
   del cap. 09 encuentra el id** y resuelve *«cancelado durante el corte»* en vez de
   *«huérfana»*.»*
2. El barrido no la recorre: `B/09` §3 — *«**Los estados terminales no se barren**: `CANCELLED`,
   `ABANDONED` y `CHARGE_DECLINED` no pueden divergir hacia nada que nos importe, y barrerlos es
   gastar llamadas sobre la parte de la cartera que más crece.»* Y su encabezado acota el universo
   antes: *«Por cada suscripción de nuestro inventario **que no esté en un estado terminal**»*.
3. La marca que sí alertaría también vive en el barrido: `B/09` §2.4 — *«**Toda divergencia de
   monto, estado o cobro pone la marca `requiere_conciliación` y la mira una persona**»*— y su
   reloj, que es el arreglo 19, se evalúa ahí: `B/09` §3 — *«**Una fila con la marca
   `requiere_conciliación` SÍ se barre** … **La marca lleva reloj.** Si sigue puesta pasado su
   plazo, **escala**»*. Sobre una fila `CANCELLED` la premisa *«sí se barre»* es falsa, así que el
   reloj no corre y la escalada no ocurre.
4. Y *«cancelado durante el corte»* **no es un desenlace declarado en ningún capítulo**: no está en
   `B/09` §2.4 (que sólo declara re-vincular y marcar), ni en `B/03`, ni en `B/21`. Lo que pasa con
   la plata de ese cobro tampoco: `B/21` §2.5 se detiene en *«hace **reconocible** un cobro
   viejo»*, y `16-fase-7-del-paraguas.md` §4.2 repite *«**reconocible**»*.

**Dónde lo permite el diseño.** Las cuatro citas, más la que dice que el caso es esperable y no
hipotético: `B/21` §2.5 — *«Si alguna emite un cobro después del corte —**porque la cancelación se
aceptó y no se aplicó**, o porque el cobro ya estaba en vuelo—»*, que es el modo de falla que
`D5`, `EX-15` y toda la conciliación existen para vigilar.

**Severidad.** `ALTA`. Alguien paga de más y el diseño llega hasta *«reconocible»*. No es
`CRITICA` porque el daño que el arreglo 21 midió —la imputación al ciclo nuevo, *«pagó dos veces y
el sistema registra una»*— **sí queda cerrado**: el `UNIQUE(proveedor, id_del_proveedor)` de
`provider_link` hace que el webhook resuelva. Lo que queda abierto es que nadie lo mire.

**¿Es nuevo, o es el arreglo?** Es el arreglo: **el 21**, cruzado con el **19**. La lápida se
diseñó eligiendo `CANCELLED` por una razón buena y escrita —*«**no compite por el candado del
§11**, porque `CANCELLED` no está entre los estados vivos»* (`B/21` §2.5)— y esa misma elección la
saca del barrido, que es el otro conjunto que se define por el mismo eje. El arreglo 19, que le
puso reloj a la marca, se escribió en la sección que la lápida no alcanza.

---

### F-8cA3-010 — El veredicto `SUBE | BAJA` se calcula sobre una tabla que lleva DOS cuotas, y la del trial no le corresponde a nadie que esté cambiando de plan

**Qué se rompe.** Una versión nueva que **sólo** baja la cuota de trial de un entitlement medido
—un cambio que no afecta a ningún cliente que esté pagando— hace que
`direcciónDeCambio(origen, destino)` devuelva `BAJA`. El cliente que se cambia a esa versión entra
por el camino de downgrade: **el monto se muta ya** y las capacidades suben recién al fin del
ciclo. Paga el precio nuevo por capacidades que todavía no tiene, por una diferencia que no es
suya.

**El camino.**

1. La tabla guarda las dos cuotas en la misma fila: `V/02` §2.1 — *«| **`plan_version_entitlement`**
   | qué clave otorga, y para las medidas **dos cuotas**: la del plan y la del trial
   (`DEC-ENT-001`) | `UNIQUE(plan_version_id, clave)` |»*.
2. La regla de dirección incluye explícitamente la cuota: `B/10` §3.5 — *«**si algo baja** —un
   limit, un entitlement, **una cuota de un entitlement medido**— el cambio sigue el camino de
   downgrade (`DEC-SUB-008`)»*, y cierra *«**Cualquier baja manda.**»*
3. La comparación pasó a ser del lado de verticales, sobre esas mismas tablas:
   `12-contrato-de-cobertura.md` §4.1 — *«Comparar eso es **leer `plan_version_entitlement` y
   `plan_version_limit` de las dos versiones** … **La comparación la hace verticales, que es dueño
   de las tablas, y billing recibe un VEREDICTO.**»*
4. El veredicto tiene **dos** valores y ninguna forma de decir *«bajó algo que no te toca»*:
   `direcciónDeCambio(versiónOrigen, versiónDestino) → SUBE | BAJA` (§4.1).
5. Y la cuota de trial es, por decisión, un número distinto y no comparable con el del plan:
   `V/11` §4.3 — *«**La cuota de trial es una sola para todo el trial, no una cuota mensual**»* y
   *«**la cuota de trial no participa del trinquete** … es un valor propio del trial, no un limit
   derivado del plan premium»*.
6. El costo del camino equivocado está fijado: `B/10` §3.5 — *«el monto se muta ya, las capacidades
   bajan al fin del ciclo»*, contra *«si nada baja, sigue el camino de upgrade (`DEC-SUB-007`):
   inmediato»*.

**Severidad.** `ALTA`. Decide qué se le cobra a alguien y qué día, sobre un dato que no le
pertenece. No llega a `CRITICA` porque el monto que se cobra es el del plan que eligió: lo que se
desalinea es **cuándo** se cobra contra cuándo se entrega.

**¿Es nuevo, o es el arreglo?** **Lo creó el arreglo 7.** `B/10` §3.5 es anterior, pero mientras la
comparación era una intención sin dueño no tenía dominio. Al declararla como pregunta del contrato
—con firma, con dueño y con un veredicto de dos valores— se fijó que el dominio de la comparación
es *«las dos tablas enteras»*, y `DEC-ENT-001` había puesto adentro una columna que significa otra
cosa.

---

### F-8cA3-011 — El grant lee el catálogo de una quinta forma, y el capítulo que declara las formas de leer dice que sólo hay cuatro y que ninguna las mezcla

**Qué se rompe.** El capítulo 10 se declara la regla única de lectura del catálogo para toda la
Parte II, enumera cuatro lectores y cierra con un invariante: *«ninguna lectura las mezcla»*. El
grant, tal como el arreglo 6 lo escribió, es un quinto lector y **mezcla las dos** a propósito.
Quien implemente siguiendo el capítulo 10 va a implementar la lectura de la pricing, y el contrato
mide qué pasa entonces: el día que se retira Premium, todos los *Free Forever* anclados a él **se
quedan sin nada**.

**El camino.**

1. `V/10` §2 se declara exhaustivo: *«Acá va **la única regla de lectura** que el resto de la Parte
   II va a usar sin repetirla»*, con cuatro filas: la pricing, una suscripción viva, la derivación
   del plan de trial y la comparación de tiers.
2. Y cierra con el invariante: *«Las cuatro filas dicen lo mismo de cuatro formas: **el catálogo es
   lo que se puede comprar hoy; la suscripción es lo que se compró.** Son dos preguntas distintas y
   **ninguna lectura las mezcla**.»*
3. El grant es la quinta y mezcla: `12-contrato-de-cobertura.md` §2.8 — *«**Lee la vigente,
   vendible o no.** … **El grant es un híbrido: toma *«la vigente»* de la pricing y el *«vendible o
   no»* de la suscripción.**»*
4. Con la rama equivocada medida en el mismo párrafo: *«**Leerlo como la pricing sería el
   defecto**: retirar un plan se hace publicando una versión no vendible (`D13`, cap. 10 §3.2), así
   que el día que se retira Premium **todos los `Free Forever` anclados a él se quedarían sin
   nada**»*.
5. Y hay un sexto y un séptimo lector que tampoco están en las cuatro filas: la **versión de piso**
   y la de **pre-trial**, que `V/02` §2.1 declara no vendibles y que se leen en toda resolución.
   Una lectura *«no vendible»* no entra en ninguna de las cuatro.

**Severidad.** `ALTA`. Es una contradicción entre el contrato de frontera y el capítulo que se
declara dueño de la regla, sobre un caso cuya rama mala el propio contrato mide como *«se quedarían
sin nada»* — y `V/10` es el que un implementador va a leer, porque es el que dice ser la regla.

**¿Es nuevo, o es el arreglo?** Es el arreglo: **el 6**. El modo de lectura híbrido lo creó él, y
el capítulo cuyo invariante vuelve falso no se tocó.

---

### F-8cA3-012 — La lista de invalidación creció a diez entradas y el guard que la hace cumplir sigue mirando sólo transiciones: las tres entradas nuevas no son transiciones de ninguna máquina

**Qué se rompe.** Las tres entradas que el arreglo 4 agregó son **publicaciones de catálogo**, no
transiciones. El guard del reconciliador está definido sobre *«los efectos declarados de las
transiciones del capítulo 03»*, así que no puede comprobar ninguna de las tres. Y el reconciliador
de excedentes es el que aplica la baja: publicar una versión de piso que retira una clave que la
plataforma entera tenía **baja capacidades sin que nada las reconcilie**.

**El camino.**

1. La lista quedó en **diez** entradas (contadas sobre la tabla de `V/02` §3.2), y las tres últimas
   son publicaciones de catálogo: *«se publica una versión nueva de la de PISO o de la de
   PRE-TRIAL»*, *«se publica una versión nueva de un plan al que hay GRANTS anclados»*, *«se
   publica una versión nueva de un `addon_version`»*.
2. El reconciliador se engancha a esa lista y a nada más: `V/15` §4.2 — *«**es la misma lista que
   invalida el caché** (cap. 02 §3.2), con sus **siete entradas**. Una lista, dos consumidores.»*
   El número quedó congelado en siete; la lista tiene diez.
3. El guard mira otra cosa: `V/15` §4.2 — *«**El guard**: ninguna fuente se apaga sin pasar por el
   reconciliador. **Se comprueba sobre los efectos declarados de las transiciones del capítulo
   03**, igual que el guard de roles del capítulo 17 §4.4.»* Ninguna de las tres entradas nuevas es
   una transición del capítulo 03.
4. Y el guard mide *«se apaga»*, no *«otorga menos»*: una versión nueva que reparte distinto no
   apaga ninguna fuente. Es el caso exacto de las tres entradas nuevas.
5. El capítulo mismo declara la consecuencia de un hueco acá: `V/02` §3 — *«es de las pocas cosas
   donde **un error es de seguridad y no de rendimiento**»*.
6. Y el texto que justifica la ampliación **cuenta mal sus propias filas**: `V/02` §3.2 —
   *«**Las cuatro últimas son de la FASE 9 y ninguna entraba por las siete de arriba.**»* Las
   últimas son tres filas, no cuatro; la cuenta sale de contar fuentes (piso, pre-trial, grant,
   addon) sobre una tabla que juntó las dos primeras en un renglón.

**Severidad.** `ALTA`. El caché se invalida —eso el arreglo 4 sí lo cerró— y el excedente no se
reconcilia, así que lo que queda mal es el límite, no el acceso. Por eso no es `CRITICA`.

**¿Es nuevo, o es el arreglo?** Es el arreglo: **el 4**. Agregó tres entradas a una lista con **dos
consumidores** y releyó uno. El segundo consumidor quedó con el número viejo en el texto y con un
guard cuyo sujeto no alcanza a las entradas nuevas.

---

## MEDIA

### F-8cA3-013 — «La única fila que el sistema nuevo sí escribe» son tres clases de fila, y la precisión de `DEC-MIG-003` volvió a contar una

**Qué se rompe.** La noche del corte se ejecuta contra una lista. Tres documentos dicen que esa
lista tiene **un** ítem, y la misma decisión que lo dice enumera **dos** más en el párrafo de
arriba. Lo que puede quedar sin escribirse son las dos cortesías, que son el *Free Forever* de dos
cuentas.

**El camino.**

1. `B/21` §2.5 — *«**Ésta es la única fila que el sistema nuevo sí escribe**, y no contradice *«no
   se hereda ninguna fila»*: no se hereda **nada vivo**.»*
2. Y en la sección inmediatamente anterior, `B/21` §2.4 — *«**Las dos cortesías se escriben como
   `permanent_grant`**, exactamente como el *Free Forever* del diseño nuevo»*, con la precisión de
   que van **una fila por cada vertical de su scope** — o sea, dos o más.
3. `DEC-MIG-003` dice las dos cosas, la segunda como precisión de la 9-bis: *«Las dos cortesías se
   escriben como `permanent_grant`»* y, más abajo, *«**Ninguna fila VIVA del sistema viejo pasa al
   nuevo. La única que se escribe es una lápida**»*.
4. `V/21` §2.4 lo repite desde el otro lado: *«**La única excepción del programa es la lápida del
   `B/21` §2.5**»*.
5. Y el orden del corte sólo tiene el paso de las lápidas: `16-fase-7-del-paraguas.md` §4.2, paso 4
   — *«**sembrar las lápidas** (`B/21` §2.5) con los ids cancelados»*. Los grants no son un paso.

**Severidad.** `MEDIA`. El sujeto son dos cuentas del propio owner y `DEC-MIG-003` dice que **se
pueden regenerar**, así que el daño es recuperable. Lo que queda mal es el conteo del checklist de
la única noche del programa que no tiene vuelta atrás.

**¿Es nuevo, o es el arreglo?** Es el arreglo: la **precisión de `DEC-MIG-003`** y el **21**. La
precisión se escribió para corregir una frase que había quedado *«literalmente falsa en un punto»*
y la volvió a dejar falsa en otro, porque contó la excepción que el hallazgo le señaló y no las que
ya estaban en su propio texto.

---

### F-8cA3-014 — Tres documentos cuentan los campos de la dirección inversa de tres maneras, y la regla de vigilancia se apoya en el número más viejo

Es **`F-8bA3-012` siguiendo llegando**, con un tercer conteo. Se anota acá porque el arreglo 7 lo
cambió y el número que la regla consume no se movió.

**El camino.**

1. `12-contrato-de-cobertura.md` §4.1, después del arreglo 7: *«**Son siete campos en tres
   preguntas**, y los dos últimos son los que importa declarar.»*
2. `12-contrato-de-cobertura.md` §4.2, la regla que consume el número, sin tocar: *«si billing
   necesita leer de verticales algo que no está en **los seis campos** del §4.1, vale lo mismo»*.
3. `V/02` §2.1, también sin tocar: *«Son dos de **los seis campos** de la dirección inversa del
   contrato (`12-contrato-de-cobertura.md` §4.1)»*.
4. Y el tercer valor, del veredicto, no es un campo de ninguna de las dos estructuras:
   `direcciónDeCambio(…) → SUBE | BAJA` devuelve un escalar, así que *«siete campos en tres
   preguntas»* cuenta 5 + 2 y deja la tercera pregunta fuera de la cuenta que la regla usa.

**Severidad.** `MEDIA`. No falla ejecutando; deja sin sujeto contable a la única regla que vigila
la dirección que `F-8cA3-010` y `F-8cA3-011` acaban de mostrar que sigue abierta.

**¿Es nuevo, o es el arreglo?** Es el arreglo: **el 7**. Agregó la tercera pregunta, corrigió el
conteo en la línea de arriba y dejó los dos lugares que lo consumen con el número viejo.

---

### F-8cA3-015 — «Cuántas fichas están publicadas» no se midió nunca, y si la respuesta es cero el arreglo 22 se queda sin las dos razones por las que se eligió

**Qué se rompe.** La instrucción de esta pasada no es *«esto no está medido»*: es *«si esa medición
vuelve al revés, qué se rompe»*. Acá se rompe la **elección** entre las dos opciones, no su
ejecución. El arreglo 22 eligió *«despublicar y llamar»* sobre *«sembrar un trial»* con dos
argumentos, y los dos dependen de que haya fichas publicadas.

**El camino.**

1. Lo medido: **12 filas de alojamiento y 22 usuarios**, `07-facts-inventory.md`, sección
   *«Contenido y usuarios»*, 2026-09-15. La consulta 3 que el documento deja escrita cuenta
   `accommodations WHERE deleted_at IS NULL` y **no filtra por estado de publicación**. Ninguna de
   las cuatro consultas del documento pregunta cuántas están publicadas.
2. El primer argumento del arreglo 22 supone que hay varias: `V/21` §2.4 — *«**Qué se pierde, dicho
   sin adornos**: la ficha de cada uno está abajo **desde el corte hasta que esa persona
   contrata**»*. Con cero publicadas no se pierde nada, y entonces el costo de la alternativa
   —sembrar— tampoco se estaba comparando contra nada.
3. El segundo es el que decide: `V/21` §2.4 — *«**Y qué se gana, que no es sólo ahorrarse la
   siembra**: el camino de vuelta —perder la cobertura, recuperarla, y que la ficha se republique
   sola— **se ejercita el primer día**, sobre un puñado de casos conocidos y con el owner al
   teléfono. Es exactamente cuando conviene descubrir que falla, si falla.»* Con cero publicadas,
   `PB2` no tiene sujeto, `PB3` tampoco, y el camino de vuelta **no se ejercita ningún día**.
4. Y el número que el programa retiró es de esta misma familia: la instrucción de esta pasada
   registra que *«las doce fichas del catálogo»* se retiró **por no ser una medición**. La cuenta
   que falta es la misma cuenta.

**Severidad.** `MEDIA`. No rompe nada ejecutando; deja una decisión del owner (`DEC-MIG-003`,
*«No se les siembra nada»*) apoyada en un efecto cuyo tamaño nadie contó, y con `F-8cA3-003`
encima el efecto puede además no existir.

**¿Es nuevo, o es el arreglo?** Es el arreglo: **el 22**. Es el primero que razona sobre fichas
publicadas, y lo hace sin un conteo, en el mismo ciclo en que el programa retiró otro número por
esa razón exacta.

---

### F-8cA3-016 — La tabla `tipo` × `hasta` anuncia tres combinaciones imposibles con razón escrita y tiene dos: las otras trece celdas son guiones que no se distinguen de un olvido

**Qué se rompe.** La tabla es el instrumento con el que el arreglo 1 declara haber recorrido su
propio dominio, y su frase de cierre es precisamente que las imposibles *«lo son por una razón
escrita, no por omisión»*. Recorrida celda por celda —24 celdas, 6 `tipo` × 4 `hasta`— hay **9**
con clase asignada, **2** marcadas imposibles con su razón, y **13** con un guion pelado. La
propiedad que la tabla afirma tener no se cumple para 13 de 24.

**El camino.**

1. `12-contrato-de-cobertura.md` §2.4, la tabla, y su cierre: *«**Las tres combinaciones imposibles
   lo son por una razón escrita, no por omisión**, y es lo que impide que la regla se vuelva a
   romper por un extremo que nadie miró.»*
2. Las que llevan razón son **dos**: *«— imposible: el trial siempre vence»* (`TRIAL` × `NO_VENCE`)
   y *«— imposible: una suscripción que no arrancó **no emite fuente** (§2.6)»* (`SUSCRIPCIÓN` ×
   `SIN_EMPEZAR`).
3. Las trece restantes son un guion sin texto: `TRIAL`×`SIN_FECHA_CONOCIDA`,
   `SUSCRIPCIÓN`×`NO_VENCE`, `CORTESÍA`×{`NO_VENCE`, `SIN_FECHA_CONOCIDA`, `SIN_EMPEZAR`},
   `GRANT`×{`fecha`, `SIN_FECHA_CONOCIDA`, `SIN_EMPEZAR`}, `BASE`×{`fecha`,
   `SIN_FECHA_CONOCIDA`, `SIN_EMPEZAR`}, `ADDON`×{`NO_VENCE`, `SIN_EMPEZAR`}.
4. **Doce de las trece las recorrí y son efectivamente imposibles** por reglas escritas en otro
   lado (`courtesy_grant` guarda *«días o meses, inicio, fin»* — `B/02` §2.4; el grant es
   permanente — §2.8; el addon tiene dos vigencias y sólo dos — §2.6).
5. **La decimotercera no lo es**, y es `BASE` × `fecha`: en una vertical discontinuada el piso
   tiene fin, con fecha, escrito en su propia fila (`B/10` §4.3, *«La fecha de fin de servicio es
   una sola para toda la vertical»*). Es `F-8bA3-014`, que sigue llegando y que la tabla nueva
   deja como guion.

**Severidad.** `MEDIA`. Doce de trece están bien y la que no ya tiene ID. Lo que queda mal es la
**afirmación de exhaustividad**, que es lo que hace que nadie vuelva a recorrer la tabla — y es el
único instrumento con el que `DEC-METH-008` se puede comprobar sobre este arreglo.

**¿Es nuevo, o es el arreglo?** Es el arreglo: **el 1**. La tabla la creó él, y su valor entero
está en la frase que no se cumple.

---

## BAJA

### F-8cA3-017 — «Las dos escriben filas del esquema nuevo» no tiene antecedente: el checklist de la noche irreversible termina en una frase que no dice cuáles son las dos

**Qué se rompe.** El §4.2 del documento del corte es el único procedimiento paso a paso de la
única noche que el programa declara sin vuelta atrás. Su último párrafo cierra con un plural cuyo
sujeto no está en el texto.

**El camino.**

1. `16-fase-7-del-paraguas.md` §4.2, último párrafo: *«**Y hay un quinto acto que no es del
   sistema: las llamadas.** Las fichas publicadas de Alojamiento **se despublican la mañana del
   corte** … y vuelven solas cuando cada dueño contrata. **El aviso va ANTES del paso 1**, no
   después … **Las dos escriben filas del esquema nuevo, así que las dos van después de
   desplegar** — y por eso el paso 3 no es el final del corte, aunque lo parezca.»*
2. El párrafo nombra **un** acto nuevo (las llamadas), y las llamadas no escriben filas de ningún
   esquema. La tabla de arriba tiene cuatro pasos y sólo uno escribe (el 4).
3. El §4.2 declara además *«**El paso 4 es la única escritura del corte, y es a mano**»* — que es
   incompatible con *«las dos escriben»* en cualquier lectura.

**Severidad.** `BAJA`. Es una frase rota en un procedimiento, no un defecto de diseño. Se anota
porque el procedimiento se ejecuta una sola vez y su §4.3 declara que *«el punto de no retorno
está entre el paso 2 y el paso 3»*: qué actos van después del 3 no es cosmético.

**¿Es nuevo, o es el arreglo?** Es el arreglo: **el 23**, y probablemente el rastro de una edición
que sacó uno de los dos sujetos (las lápidas y los `permanent_grant` del `F-8cA3-013` son los dos
candidatos, y son exactamente las dos escrituras que el corte tiene).

---

## El dominio del arreglo: qué premisa de OTRO arreglo estoy volviendo falsa

La pregunta obligatoria de `DEC-METH-008`, contestada por escrito sobre los tres arreglos que esta
pasada me asignó, más los que resultaron estar cruzados con ellos.

| arreglo | premisa que da por cierta | qué otro arreglo la vuelve falsa | dónde queda |
|---|---|---|---|
| **8** (`T6`) | *«verticales puede saber si hay una suscripción viva»* | **16** (los nueve estados: `PENDING_AUTHORIZATION`, `SUSPENDED` y `PAUSED`/`CUSTOMER_REQUEST` **no emiten fuente**) más el §4 del contrato, que nunca cruzó el estado | `F-8cA3-001` |
| **8** (`T6`) | *«`T1` ya no aplica a quien tiene suscripción»* | ninguno: `T1` **nunca tuvo** esa condición, y el arreglo la supuso | `F-8cA3-007` |
| **22** (despublicar y llamar) | *«`PB2` dispara la mañana del corte»* | **9** (`PB2` se dispara por el **CAMBIO** de `cubierto`, no por su valor) | `F-8cA3-003` |
| **22** (despublicar y llamar) | *«las fichas existen y están publicadas en el modelo nuevo»* | ninguno: es la mitad de datos que el arreglo no contestó, y que `V/21` declara vacía | `F-8cA3-006` |
| **10** (`addon_instance` ancla) | *«la referencia de una fuente `ADDON` sale de la instancia»* | **el propio 10**, que dejó la afirmación contraria en la fila de `addon_product` | `F-8cA3-002` |
| **21** (la lápida) | *«el barrido del cap. 09 la encuentra»* | la regla preexistente *«los estados terminales no se barren»*, más el **19**, que puso el reloj de la marca dentro del barrido | `F-8cA3-009` |
| **`DEC-MIG-003` precisada** | *«la única fila que se escribe es la lápida»* | el propio texto de `B/21` §2.4 y de la decisión, que escriben además los `permanent_grant` | `F-8cA3-013` |
| **2** (descartar `COMPLEMENTO`) | *«esto queda dicho donde se ejecuta»* | ninguno: el arreglo se escribió donde se define, que es el defecto que él mismo diagnostica | `F-8cA3-004` |
| **6** (un plan por vertical) | *«`permanent_grant` puede anclar N planes»* y *«el grant lee como ninguna de las cuatro formas»* | la fila de `B/02` §2.4 (un `plan_id`) y el invariante de `V/10` §2 (*«ninguna lectura las mezcla»*) | `F-8cA3-005`, `F-8cA3-011` |
| **7** (`direcciónDeCambio`) | *«las dos tablas describen lo que el plan otorga»* | `DEC-ENT-001`, que metió la **cuota de trial** en `plan_version_entitlement` | `F-8cA3-010` |
| **4** (cuatro entradas de invalidación) | *«una lista, dos consumidores»* | el propio 4, que agregó entradas que **no son transiciones** al consumidor cuyo guard sólo mira transiciones | `F-8cA3-012` |

**Lo que este cuadro mide, y es el dato de la pasada.** En la 8-bis los críticos salían de
arreglos que **no se habían leído entre sí**. Acá, **nueve de las once filas** son de otra forma:
el arreglo se escribió **en un solo lado de una frontera que tiene dos**, y el otro lado sigue
diciendo lo de antes. Cinco veces esos dos lados son **dos épicas** (contrato ↔ `B/02`,
contrato ↔ `V/10`, `V/02` ↔ `B/02`, `V/03` ↔ contrato §2.6, `V/21` ↔ `V/03`); dos veces son **dos
secciones del mismo archivo** (`B/02` §2.4 consigo mismo, `B/21` §2.4 con §2.5). Es un modo de
falla más chico y más mecánico que el de la vuelta anterior, y tiene una condición de corte que se
puede comprobar: **un arreglo no está aplicado hasta que las dos puntas de su referencia dicen lo
mismo.**

---

## Los quince hallazgos de la 8-bis, reejecutados sobre el texto nuevo

Cada uno se volvió a recorrer contra los capítulos corregidos. **Siete cortan, seis siguen llegando
y dos cortan a medias.** Los que siguen **no cuentan como hallazgos nuevos** y conservan su ID.

| ID | veredicto | dónde corta, o en qué paso sigue llegando |
|---|---|---|
| `F-8bA3-001` — `PRE_TRIAL` es `TÍTULO`, todos cubiertos en Partner | **CORTA** | paso 2: la clase ya no sale sólo del `tipo`. `12-contrato…` §2.4 — *«`BASE` \| `tipo = BASE`, **o cualquier fuente con `hasta = SIN_EMPEZAR`**»* |
| `F-8bA3-002` — trial colgado en `TRIAL_ACTIVE` | **CORTA A MEDIAS** | corta para los 3 de 6 estados vivos que emiten fuente; **sigue** para `PENDING_AUTHORIZATION`, `SUSPENDED` y `PAUSED`/`CUSTOMER_REQUEST` → `F-8cA3-001` |
| `F-8bA3-003` — `addon_instance` sin columna de versión | **CORTA A MEDIAS** | la columna existe (`B/02` §2.4, *«la `addon_version` que ANCLÓ al comprarse»*); **sigue** la frase de `addon_product` que dice ser la referencia transportada → `F-8cA3-002` |
| `F-8bA3-004` — cuatro fuentes fuera de la lista de invalidación | **SIGUE** (1 de 4) | cortan las tres de catálogo (`V/02` §3.2, entradas 8-10). **Sigue el punto 4**: cambiar `vertical.evento_de_activacion` cambia el conjunto efectivo de toda la vertical y no tiene entrada. Y el guard del segundo consumidor no alcanza a las nuevas → `F-8cA3-012` |
| `F-8bA3-005` — billing lee entitlements para decidir upgrade/downgrade | **CORTA** | paso 5: `direcciónDeCambio` existe y devuelve un veredicto (`12-contrato…` §4.1). Queda que **`B/10` §3.5 no se actualizó** y sigue describiendo la comparación del lado de billing, y que el dominio de la comparación trae la cuota de trial → `F-8cA3-010` |
| `F-8bA3-006` — `admite_altas` y `fin_de_servicio` los escribe billing | **SIGUE** | paso 1: §4.1 sigue declarándolas como lectura (`situaciónDeVertical`) y `B/10` §4.3 sigue escribiéndolas (*«La vertical deja de admitir altas y trials»*). Y la segunda mitad empeoró: ahora **ni `T1` ni `T6`** leen ninguna de las dos |
| `F-8bA3-007` — el trinquete del grant necesita dos referencias | **SIGUE** | paso 3: el contrato sigue transportando **un** campo (*«`referencia: versiónDePlan \| versiónDeAddon`»*, §2), el piso vive en `permanent_grant.piso_del_trinquete` (`B/02` §2.4) y quien lo aplica es `V/15` §2.5. Verticales tiene que leer una fila de billing que la dirección inversa no declara |
| `F-8bA3-008` — el `alcance` del addon se lo pide a billing | **SIGUE** | paso 3: el tipo de scope sigue en `addon_version` / VERTICALES (`V/02` §2.1) y el contrato §2.7 sigue pidiéndole a billing *«sólo devolver el `objetivo` que ya guarda en `addon_instance`»*. `B/02` §2.4 sigue con *«el objetivo corresponde al tipo de scope del producto»*, que billing no puede verificar solo |
| `F-8bA3-009` — `UNIQUE(hash, vertical)` y el cambio de correo | **SIGUE** | paso 5: `V/02` §2.2 no ganó ninguna línea sobre qué pasa al cambiar de correo, ni sobre qué se contesta cuando la restricción hace fallar una publicación |
| `F-8bA3-010` — `G-R3` en CI sobre un catálogo que no vive en CI | **SIGUE** | paso 1: `V/02` §2.1 sigue diciendo *«Se comprueba sobre el catálogo, en CI»* sobre un sujeto que son filas de `plan_version_entitlement` y de `vertical` |
| `F-8bA3-011` — la derivación del plan de trial se queda sin fuente | **SIGUE** | paso 1: `V/02` §2.1 sigue con *«no se guardan: se derivan»* y `V/10` §2 sigue leyendo *«vigentes y vendibles»*. Cerrada a altas, la derivación no tiene entradas |
| `F-8bA3-012` — «seis campos» y la firma tiene siete | **SIGUE**, con un tercer conteo | §4.1 dice ahora *«siete campos en tres preguntas»*; §4.2 y `V/02` §2.1 siguen en seis → `F-8cA3-014` |
| `F-8bA3-013` — las tres columnas de `vertical` sin dueño declarado | **SIGUE** | paso 1: `V/02` §2.1 sigue sin nota de inmutabilidad, sin quién escribe y sin si vuelven atrás. Y ahora hay una cuarta columna sin fila: el techo de días de trial acumulados (`V/11` §3.2, *«en base y no en código»*) |
| `F-8bA3-014` — el `hasta` de `BASE` es `NO_VENCE` y en una vertical discontinuada vence | **SIGUE** | paso 1: §2.6 sigue con *«\| `NO_VENCE` \| grant permanente, **título `BASE`** \|»* y la tabla nueva del §2.4 deja `BASE` × `fecha` como guion (ver `F-8cA3-016`) |
| `F-8bA3-015` — las no vendibles necesitan un `rank` que no significa nada | **SIGUE** | paso 1: `V/02` §2.1 sigue listando `rank` entre lo inmutable sin marcarlo opcional, y el `UNIQUE` sigue condicionado a `vendible AND vigente` |

**Y dos de la FASE 8 que siguen y que esta pasada volvió a cruzar** (con su ID viejo, sin
desarrollar): `F-8A3-016` —`V/17` §1.1 sigue cerrando con *«Quedan **nueve pasos** y una
precondición»* y la tabla del §1.2 sigue numerando **1 a 7**— y `F-8A3-006` —cuatro de los cinco
valores de configuración siguen sin dónde vivir—.

---

## Ataques que intenté y el diseño resistió

**1. «El recuento de invariantes está mal otra vez.»** No. Lo recorrí entero contra
`NUCLEO/04` §3 y §5: base `D2 D3 D8 D15`, guard `D8 D9 D10 D12`, y las que quedan sin ninguno de
los dos apoyos son `D2 D15 D9 D10 D8`, o sea cinco, así que servicio son **diez**. 4 + 4 + 10 =
**18 apoyos** sobre 15 invariantes, con `D3`, `D8` y `D12` apoyados dos veces. 37 + 15 = **52**, y
*«diez los sostiene la base»* son 6 + 4. **Los cuatro números cierran.** Es el único conteo del
material que se recontó con script y es el único que no encontré roto — la diferencia con
`F-8cA3-012` y `F-8cA3-014`, que son conteos hechos a mano, es exactamente ésa.

**2. «La tabla `tipo` × `hasta` tiene una celda que regala cobertura.»** No. Recorrí las 24. Las
nueve asignadas son correctas contra sus fuentes (`V/03` §2 para las dos de `TRIAL`, §2.6 para las
dos de `SUSCRIPCIÓN`, `B/02` §2.4 para `CORTESÍA` y `GRANT`, §2.5 para `BASE`, `B/16` para
`ADDON`), y ninguna asigna `TÍTULO` a algo que no lo sea. Lo que falla es la afirmación de
exhaustividad, no una celda (`F-8cA3-016`), y la única celda mal es un guion donde debería haber
una entrada — que además ya tiene ID viejo.

**3. «Las dos claves parciales partidas por `sucede_a` dejan pasar un compromiso de más.»** No.
Recorrí `sucede_a` nulo y no nulo contra los seis vivos y contra las operaciones de escritura:
el máximo es dos filas y un compromiso, *«una sucesora no puede ser sucedida mientras viva, sin
ninguna regla extra, porque la segunda sucesora colisiona con la primera»* (`B/02` §2.2), y el
razonamiento de por qué **no** se sacó `PENDING_AUTHORIZATION` de los vivos sigue siendo correcto.
La lápida en `CANCELLED` no compite por el candado, y eso está verificado en el propio §2.5. Lo
que la inclusión de `PENDING_AUTHORIZATION` en los vivos sí rompe es `T6`, y eso es
`F-8cA3-001` — pero no rompe la clave.

**4. «El anclaje de la instancia de addon se puede evadir borrando el producto.»** No encontré la
vía: `addon_instance` guarda **la versión anclada, no anulable** (`B/02` §2.4), así que la
referencia sobrevive a cualquier cosa que le pase al producto, y `addon_version` es inmutable
(`V/02` §2.1). El ataque que sí funciona es el de `F-8cA3-002`, y no es una evasión: es que la otra
columna sigue declarada como la que se transporta.

**5. «La excepción de `CANCEL_SCHEDULED` sobre una fila marcada se puede forzar.»** No. Exige
*«una relectura del preapproval por su id [que] confirma que efectivamente está cancelado»*
(`B/02` §2.2), y el razonamiento de por qué la versión anterior era insegura —*«la divergencia más
probable sobre una `CANCEL_SCHEDULED` es justamente que esa cancelación no se aplicó»*— está
escrito y es correcto. `D6` prohíbe el buscador, no la lectura por id, y `RC-2` la mide confiable.
Es de lo mejor resuelto de la tanda.

**6. «La fecha de primer cobro guardada se puede falsear mandando una futura.»** No, y es el
arreglo 13 bien hecho: se guarda *«**LA QUE EL PROVEEDOR CONFIRMÓ**, no la que mandamos»* y se
escribe *«en esa misma relectura, que ya ocurre»* (`B/02` §2.2). El guard lee la columna. El
argumento de por qué guardar la que mandamos *«verificaba el único dato que no podía estar mal»*
es el tipo de razonamiento que esta fase existe para encontrar, escrito por adelantado.

**7. «El orden del corte deja una ventana en la que un cobro cae en el vacío.»** No: el paso 1
corre en el sistema **viejo**, que sigue arriba hasta el paso 3, y la ventana está declarada con su
dirección — *«Si entra un cobro en vuelo, **lo registra el viejo**, que es exactamente lo que
queremos»* (`16-fase-7…` §4.2). El orden inverso está descartado por escrito y con su razón. Lo que
falla del corte no es el orden: es qué pasa con el cobro **después** del paso 3 (`F-8cA3-009`) y
qué fichas hay para despublicar (`F-8cA3-003`, `F-8cA3-006`).

**8. «No migrar deja un derecho vivo que el sistema nuevo no ve.»** Sobre la cartera de
suscripciones, no: `V/21` §2.3 enumera lo que se pierde y lo mide, `B/21` §2.5 cierra el único
rastro que hacía falta, y las tres `abandoned` no tienen nada vivo (medido: 3 de 3 sin preapproval,
`07-facts-inventory.md`, cuarta consulta). El derecho que sí queda sin camino no es una fila de
billing: es el **contenido** de las 12 filas de alojamiento, y es `F-8cA3-006`.

**9. «Un `Guest` recibe algo del piso que no le corresponde.»** No por esta vía: `V/15` §5.2 lo
cierra **por clase** —*«El visitante sin cuenta no recibe ningún entitlement medido»*— y sigue
igual. La mitad que queda abierta es `RES-01`, declarada fuera de alcance por esta pasada.

**10. «El caché sirve una decisión que toca plata.»** No. `V/02` §3.3 sigue entero —*«**Nunca es la
fuente de una decisión que toca plata.** Cobrar, reembolsar, otorgar y revocar leen de la base»*— y
ninguno de los arreglos de esta tanda lo tocó. El defecto del caché es de **falta de
invalidación**, no de uso indebido, y está en `F-8cA3-012`.

---

## Fuera de mi vector

Lo que vi y le toca a otro agente. No lo desarrollo.

**`NUCLEO` · La regla 1 del capítulo 03 del núcleo declara la tabla de transiciones *«exhaustiva»*
y no dice nada sobre guardas superpuestas.** Con `T6` el programa tiene su primer par
`(estado, evento)` con dos salidas, y la regla que gobierna cómo se leen las máquinas no tiene la
mitad que lo resuelve. La instancia concreta es `F-8cA3-007`; la regla es de la pasada C.

**Autorización · `V/17` §3.5 declara que *«toda operación corre la resolución»* y los pasos 6 y 7
leen el conjunto efectivo, que es lo único que se cachea.** Con el paso 5 que *«ya no rechaza a
nadie»*, toda lectura del sistema pasa por el pliegue y por un conteo de limits. Es diseño de
autorización y de rendimiento: A1.

**Billing · `direcciónDeCambio` toma dos versiones de plan y un cambio de ciclo no cambia de
versión** (`billing_option` cuelga de `plan_version`, `UNIQUE(plan_version_id, ciclo)`), así que
`direcciónDeCambio(v, v)` devuelve `SUBE` por *«nada baja»* y todo cambio de ciclo —incluido anual
→ mensual— entra por el camino inmediato de `DEC-SUB-007`. Si eso es lo querido o no es de B1.

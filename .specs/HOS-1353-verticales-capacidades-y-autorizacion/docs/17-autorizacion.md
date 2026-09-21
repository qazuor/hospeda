---
title: Master Spec 17 — Autorización
linear: HOS-1353
statusSource: linear
created: 2026-09-17
updated: 2026-09-19
status: CURRENT
fase: 2
capitulo: 17
cierra:
  - A-AUTH-01
  - M-AUTH-01
  - M-AUTH-02
  - S-AUTH-01
---

# 17 · Autorización

El §13 da una lista de ocho verificaciones mínimas y un problema con nombre propio: *«un user
con Gastronomía activa termina ejecutando una operación de Alojamientos porque ambos tienen
capabilities conceptualmente parecidas»*. Este capítulo cierra los cuatro huecos que quedaron
alrededor de esa lista, y los cuatro son la misma pregunta vista de costados distintos:
**¿alcanza con verificar?**

La respuesta que lo ordena todo:

> **Una verificación cubre el lugar donde alguien se acordó de escribirla.** Por eso lo que se
> puede volver estructural se vuelve estructural, lo que no se pueda se verifica en **un** lugar,
> y encima va un guard que falla cuando alguien no lo hizo.
>
> Es el escalón del capítulo 04 §1 aplicado acá: base antes que servicio, servicio antes que
> guard, guard antes que nada.

---

## 1. La lista del §13, corregida · cierra `M-AUTH-01`

### 1.1 Faltan dos, y sobra una

El §13 enumera ocho: usuario autenticado, owner, rol/permiso, scope de vertical, estado de
acceso, trial/suscripción/cortesía activa, entitlement y limits aplicables.

**Faltan dos, y las dos son explotables tal como está la lista:**

| falta | quién pasa las ocho sin merecerlo |
|---|---|
| **el estado del recurso** | una ficha en borrador, archivada o eliminada acepta operaciones si su dueño está en regla |
| **el estado de la persona** | alguien con el correo sin verificar o **inhabilitado por abuso** pasa las ocho con su suscripción al día |

**Y sobra una: el scope de vertical sale de la lista de verificaciones**, porque pasa a ser
estructural (§2). Una verificación que no puede faltar no es una verificación.

Quedan **nueve pasos y una precondición**.

### 1.2 El orden, y por qué ése

El orden no es preferencia: **va de lo que no depende de nada hacia lo que depende de todo**, y
encima corre una segunda regla —**cada paso revela lo mínimo**— que decide qué contesta cuando
falla.

| # | paso | qué pregunta | si falla |
|---|---|---|---|
| — | **contexto de vertical** | *(precondición estructural, §2)* | la operación no se puede expresar |
| 1 | **quién es** | ¿hay un actor? | no autenticado |
| 2 | **estado de la persona** | ¿esta cuenta puede operar hoy? | inhabilitada, o correo sin verificar |
| 3 | **permiso** | ¿pertenece a la familia de operaciones? | sin permiso |
| 4 | **el recurso: existencia, estado y dueño** | ¿existe, está en un estado que acepta esto, y es del sujeto? | **no existe** — las tres juntas |
| 5 | **fuente viva** | ¿hay **al menos una fuente viva** para ese `user + vertical`? | sin cobertura |
| 6 | **entitlement** | ¿su conjunto efectivo otorga esta capacidad? | sin la capacidad |
| 7 | **limits** | ¿le queda cupo? | excedido |

**Cinco precisiones que el orden hace cumplir:**

1. **El paso 4 responde «no existe» a las tres cosas.** Un recurso ajeno, uno archivado y uno
   inexistente son indistinguibles desde afuera. Contestar *«no es tuyo»* confirma que el
   identificador existe, y eso es información que el que pregunta no tenía.

   **«Desde afuera» es la mitad que hay que decir, porque `ARCHIVED` dejó de ser un estado
   sin salida.** El paso 4 pregunta tres cosas y una es *«¿está en un estado que acepta
   esto?»*: una ficha `ARCHIVED` **acepta de su dueño verla, exportarla y reactivarla**
   —`PB8`, cap. 03 §9— y rechaza todo lo demás. Es lo que `DEC-DATA-001` promete con *«el
   dueño la sigue viendo»* y lo que el §4.1 de este capítulo ya sostiene al no revocarle el
   rol. Sin esta línea, *«archivado responde no existe»* se lee como que lo responde
   **también al dueño**, y entonces la promesa no la puede cumplir nadie y `PB8` es
   inalcanzable.
2. **El estado de la persona va ANTES del permiso.** Al revés, una cuenta inhabilitada puede
   averiguar qué permisos tiene probando operaciones: las que contestan *«sin cobertura»* las
   tiene, las que contestan *«sin permiso»* no.
3. **Los limits van últimos porque son los únicos que necesitan contar.** Todos los pasos
   anteriores se responden con lo que ya está resuelto; éste lee datos. Ponerlo antes hace
   trabajo que la mayoría de los rechazos no necesita.
4. **El paso 5 no decide capacidades: decide si hay de dónde resolverlas.** Una fuente viva es la
   que el contrato de cobertura devuelve con su referencia (cap. 01 (núcleo) §2.4 — y **no** es
   una *fila* viva, que es otra cosa y no cruza la frontera); **qué otorga esa referencia es el
   paso 6**. Ahí se separa quien puede publicar de quien sólo puede escribir borradores. Un paso 5 que
   contestara *«sin cobertura»* a alguien que tiene una fuente viva con conjunto efectivo vacío
   estaría dando el veredicto del 6 con el mensaje del 5 — y ésa es la forma exacta en que el paso
   5 dejó de tener respuesta para `PRE_TRIAL`.
5. **El paso 5 pregunta por `fuentes`, no por `cubierto`.** Son dos cosas distintas desde que el
   contrato tiene tres clases de fuente (`12-contrato…` §2.4): `cubierto` cuenta sólo las de clase
   `TÍTULO`, y el paso 5 acepta cualquiera — incluido el piso, que toda persona tiene en toda
   vertical (`12-contrato…` §2.5). **La consecuencia hay que decirla en voz alta: el paso 5 ya no
   rechaza a nadie, y toda la defensa se apoya en el paso 6.** Es deliberado, y es lo que le
   devuelve al 6 una decisión que el 5 estaba tomando de prestado. Lo que sostiene la defensa es
   que **lo que otorga cada versión es dato del catálogo, no una rama del código** (§1.3 y `V/02`
   §1.2), y que un guard verifica que las dos versiones no vendibles de cada vertical —la de
   pre-trial y la de piso— no otorguen ninguna clave comercial.

### 1.3 Los nueve se resuelven en un solo lugar

**No hay nueve verificaciones repartidas: hay una resolución de autorización que las ejecuta en
orden, y es la única que las ejecuta.** Es el invariante §64.14 —*«los servicios validan
vertical, acceso, entitlement y limits»*— en su forma aplicable: no que cada servicio las haga,
sino que **ninguno las haga por su cuenta**.

Repartidas, la pregunta *«¿este camino verifica el estado del recurso?»* tiene tantas respuestas
como caminos, y `M-AUTH-01` existe justamente porque dos de los pasos faltaban en la lista
canónica. Si la lista canónica puede estar incompleta, una copia suya en cada servicio está
incompleta en lugares distintos.

---

## 2. El scope de vertical es estructural · cierra `S-AUTH-01`

### 2.1 Por qué no puede ser un chequeo

El §64.10 lo eleva a invariante: *«una acción en una vertical no puede afectar otra
accidentalmente»*. La palabra es **accidentalmente**, y un chequeo en tiempo de ejecución no
protege contra accidentes: protege contra los que alguien previó.

### 2.2 La forma

**Ninguna operación de dominio se puede expresar sin su contexto de vertical.** Es obligatorio en
la firma, no un parámetro opcional ni un valor que se deduzca del recurso.

Y se apoya en algo que el núcleo ya decidió: **la resolución de entitlements y limits es por
`user + vertical`** (cap. 02 §3.1). No existe *«resolvé las capacidades de esta persona»* sin
decir en cuál vertical. Las dos cosas juntas son lo que cierra el caso del §13: para que alguien
con Gastronomía ejecute algo de Alojamiento, la operación tendría que haber sido invocada
**declarando Alojamiento**, y ahí su conjunto efectivo es el de Alojamiento — donde no tiene nada.

**Dónde se le contesta que no, con precisión, porque cambió.** No en el paso 5: desde que existe el
título `BASE` (`12-contrato…` §2.5) esa persona **sí** tiene una fuente en Alojamiento, la de piso,
y el paso 5 la deja pasar. Se le contesta en el **paso 6**, porque la versión de piso de Alojamiento
no otorga ninguna capacidad comercial. La regla del §64.10 —*«una acción en una vertical no puede
afectar otra accidentalmente»*— se sigue cumpliendo con el mismo rigor, y por la misma razón de
fondo: **la resolución es por `user + vertical`**, así que declarar Alojamiento es resolver contra
Alojamiento. Lo único que se movió es en qué paso se materializa el rechazo.

### 2.3 El guard, y su gemelo

**Un guard falla si una operación de dominio no declara su contexto de vertical.** Es
verificación automática, no revisión de código: el §3.3 declara que este programa atraviesa
varias ventanas de contexto, y una regla que dependa de que alguien se acuerde no sobrevive a
eso.

Tiene un gemelo en el capítulo 01 §4.4, y los dos juntos forman la pinza:

| guard | qué prohíbe |
|---|---|
| cap. 01 §4.4 | **nombrar** una vertical fuera de los ocho ítems del Eje 2 |
| éste | **no nombrarla** en una operación de dominio |

Uno acota quién **puede** hablar de verticales; el otro obliga a que las operaciones lo hagan.

### 2.4 El caso global, que parece la excepción y no lo es

Un addon de scope `USER` o `GLOBAL` (§40) y un entitlement de scope global (`M-ENT-03`,
capítulo 15) no pertenecen a ninguna vertical. Parece que rompen la regla y no la rompen:

**lo global es la FUENTE, nunca la operación.** La persona siempre actúa *en* una vertical —
publica una ficha de gastronomía, edita su presencia de partner—, y lo que resuelve si una
fuente global le aporta ahí es la resolución del paso 6. El capítulo 11 §5.3 ya usó exactamente
esto para decidir que un addon global **no** aporta a una vertical cuyo único título es un trial.

La regla, entonces, no tiene excepciones: **toda operación tiene vertical; algunas fuentes no.**

---

## 3. El actor administrativo · cierra `M-AUTH-02`

### 3.1 El problema

El §48 exige que el admin inspeccione usuarios, suscripciones, pagos, cortesías y grants
**ajenos**; el §34 y el §35 le dan capacidad de otorgar; el §30 de registrar pagos. Y la
verificación *owner* del §13 se lo impide por construcción.

El hueco además nombra el riesgo: si queda implícito, *«cada punto de entrada lo resuelve a su
manera, y es además un vector de abuso: un admin comprometido operando sin rastro»*.

### 3.2 Actor y sujeto son dos campos, siempre, y casi siempre coinciden

**Toda operación lleva dos identidades: quién la ejecuta (`actor`) y sobre quién recae
(`sujeto`).** En una operación normal son la misma persona.

Eso no agrega un modo especial: **lo elimina.** El paso 4 del §1.2 sigue diciendo lo mismo —*el
recurso es del sujeto*— y no se salta nunca. Lo que autoriza que `actor ≠ sujeto` es un permiso,
no una excepción a la lista.

**Cuatro reglas, y ninguna es opcional:**

1. **`actor ≠ sujeto` exige un permiso de esa acción concreta**, no una condición general de
   «es administrador». Las doce acciones del capítulo 08 §3 llevan permiso propio, una por una.
2. **Toda operación con `actor ≠ sujeto` es auditable sin excepción**, con los campos del
   capítulo 08 §1.2. El `actor` es uno de ellos, y es lo que convierte *«alguien otorgó esta
   cortesía»* en *«esta persona la otorgó»*.
3. **El admin no hereda los entitlements del sujeto.** Los pasos 5, 6 y 7 se evalúan **sobre el
   sujeto**, así que un administrador no puede hacerle a un cliente algo que el cliente no podría
   hacer. La excepción está declarada y es acotada: **las doce acciones del capítulo 08 §3 son
   capacidades del actor**, no del sujeto — otorgar una cortesía no consulta si el cliente tiene
   derecho a una, porque su objeto es dárselo. **A qué clase pertenece una operación se declara,
   nunca se infiere.**
4. **No existe la impersonación.** El administrador no «entra como» el cliente. La diferencia es
   todo el punto: impersonar hace que el registro diga que el cliente lo hizo, y ése es
   exactamente el rastro que el hueco pide que no se pierda.

### 3.3 El actor no siempre es una persona

Dos actores más, y nombrarlos evita que alguien los trate como ausencia de actor:

| actor | qué es |
|---|---|
| **el visitante sin cuenta** | el `Guest` del §6 es **un actor del modelo, no la falta de uno** — igual que `PRE_TRIAL` es un estado real y no la ausencia de uno (`DEC-TRIAL-007`). Qué puede hacer es `A-ENT-02`, capítulo 15 |
| **el sistema** | los jobs y los webhooks operan sin persona detrás. Llevan su propio identificador de actor y sus dos identificadores de correlación (cap. 08 §2.3) |

**Un actor de sistema no puede ejecutar ninguna de las doce acciones del capítulo 08 §3.** Las
doce mueven dinero o conceden servicio, y eso es el invariante `D11`: lo que toca plata lo
confirma una persona. Un job que pudiera otorgar una cortesía convierte ese invariante en una
sugerencia.

### 3.4 Cuando el actor es el reloj, los pasos 5 a 7 se evalúan sobre el ACTOR

El §3.3 declara al sistema como actor y no decía **cómo se evalúan los pasos 5, 6 y 7 cuando el
actor es uno**. Es un hueco con caso concreto: `T3` —el vencimiento del trial— **la dispara el
reloj**, y esos tres pasos preguntan por el título, las capacidades y el cupo **de alguien que no
existe**.

> **Las transiciones disparadas por el reloj son una segunda clase de operación, evaluada por
> analogía con las doce acciones administrativas: los pasos 5, 6 y 7 se resuelven sobre la
> capacidad del ACTOR, no sobre la del sujeto.**

**La clase se declara transición por transición**, nunca se infiere — es la regla que este mismo
capítulo ya enuncia en el §3.2, regla 3: *«a qué clase pertenece una operación se declara, nunca
se infiere»*. Dejarla inferida sería incumplir la regla con la que se la resuelve.

**Y lleva guard, que no es opcional**, porque es lo único que sostiene la propiedad que la vuelve
segura:

> **Una transición de esta clase nunca otorga. `T3` quita.**

Sin verificarlo, la clase es **una puerta abierta con un cartel que dice no pasar**: su riesgo es
bajo mientras la propiedad se compruebe y medio si nadie la comprueba. La alternativa descartada
—que cada transición del reloj resuelva por su cuenta— es exactamente cómo se generan las
exenciones por ruta: cada job inventando su propia respuesta al paso 5.

### 3.5 Qué operación pasa por el paso 5 — el criterio ahora, la lista después

El conjunto de operaciones de dominio **nunca se enumeró**. Lo único enumerado son las **12
acciones administrativas**, que son **la excepción, no el conjunto**. Y hay una regla en uso que
nadie había escrito: para decidir que las lecturas de «Mi Cuenta» no pasan por el paso 5 se usó el
criterio *«escribe estado y es auditable»*, inferido de cómo se clasifica a `PB1` y ausente de
todo capítulo.

**Se escribe el criterio ahora y la enumeración se arma durante la implementación**, en tres
partes:

1. **El criterio**, y son **dos preguntas distintas** que antes venían pegadas:
   - **¿corre la resolución?** **Toda operación la corre**, escriba o no. No hay operación exenta.
   - **¿pasa por el paso 5?** Sólo si **escribe estado del negocio y es auditable**. Una lectura
     que no muta nada **no pasa por el 5** — y **sí por los otros ocho**.

   > ⚠️ **Los nueve pasos no vienen en bloque, y decir que una lectura «no es de dominio» la
   > sacaba de los nueve.** Con eso **ninguna lectura tenía autorización**: ni el paso 4
   > —existencia, estado y **dueño**—, ni el 3, ni el 2. Leer el borrador de otra persona, su «Mi
   > Cuenta» o los datos que el §48 le muestra al admin **no atravesaba ningún control declarado**.
   > Es la exención por superficie que el §5 descarta por escrito, entrando **con forma de
   > criterio** — que es peor, porque no se ve.

   **Por qué una lectura no pasa por el paso 5, y sí por el 4**: el 5 pregunta si hay de dónde
   resolver capacidades **comerciales**, y leer no consume ninguna. El 4 pregunta **si el recurso
   es del sujeto**, que es exactamente lo que una lectura tiene que responder. Son preguntas
   distintas y sacarlas juntas fue el error.
2. **La enumeración** se arma sola a medida que se construyen las superficies. Enumerar operaciones
   **contra el diseño en papel produce una lista que la implementación va a contradecir**: las
   operaciones aparecen al construir las superficies, no antes, así que una lista escrita hoy nace
   desactualizada.
3. **Un guard que lo hace cumplir**: toda operación de dominio **declara** si pasa por el paso 5, y
   **el build falla si alguna no lo declara**.

> ⚠️ **El guard no es un adorno: es lo único que vuelve segura la postergación.** Sin él, alguien
> agrega una operación dentro de ocho meses, no se pregunta nada, y nadie se entera — la fábrica de
> exenciones por ruta. Con él, *«nadie puede afirmar que revisó todas»* se convierte en **«el build
> no pasa si hay una sin clasificar»**, y la enumeración queda **completa por construcción**.

---

## 4. El rol no se toca al perder el acceso · cierra `A-AUTH-01`

### 4.1 La decisión

**Perder el acceso NUNCA revoca un rol.** Ni la suspensión por impago, ni el vencimiento del
trial, ni la cancelación, ni la pausa, ni la discontinuación de una vertical (cap. 10 §4).

### 4.2 Por qué, en tres razones que apuntan al mismo lado

1. **El §21 promete tres cosas que necesitan el rol vivo**: *«Mi Cuenta read-only»*, *«billing
   accesible»* y *«recuperación posible»*. Sin rol no hay a qué entrar ni desde dónde
   regularizar, y la promesa queda escrita y sin cumplir.
2. **Los invariantes §64.12 y §64.13 dicen que el rol no equivale a acceso activo ni a
   entitlement.** Si perder el acceso revocara el rol, las tres cosas pasarían a moverse juntas y
   los dos invariantes quedarían sin objeto: serían el mismo dato con tres nombres.
3. **Recuperar exigiría reconstruir lo que se destruyó**, adivinando qué roles tenía. El §21
   cierra con *«recuperación posible»*, y una recuperación que tiene que adivinar no es posible:
   es una reconstrucción a ojo. No se borra lo que después hay que reponer.

**Positivamente**: el rol dice **a qué familia de operaciones pertenece** la persona; el estado
de acceso dice **si hoy puede ejecutarlas**. Son dos ejes independientes, y los pasos 3 y 5 del
§1.2 están separados justamente para que puedan discrepar.

### 4.3 La mitad que sin la otra rompe todo

Si el rol no se revoca nunca, **una autorización que decidiera sólo por rol dejaría operar a un
suspendido**. Las dos mitades van juntas o ninguna funciona:

| mitad | dónde vive |
|---|---|
| el rol sobrevive a la pérdida de acceso | acá, y el guard de §4.4 |
| **ninguna autorización decide sólo por rol** | invariantes §64.12 y §64.13, guard (cap. 04 §2.3) |

### 4.4 Y queda como invariante, porque es de los que alguien va a «optimizar»

`A-AUTH-01` pedía textualmente dejarlo escrito *«porque es exactamente el tipo de regla que
alguien va a optimizar más adelante sin entender para qué estaba»*. Su forma verificable:

**Ninguna transición de la máquina de suscripción ni de la de trial escribe roles.**

Es un guard, no una convención: se comprueba sobre los efectos declarados de las transiciones del
capítulo 03, que están enumerados uno por uno. Una transición que agregue un efecto sobre roles
falla.

---

## Lo que este capítulo NO cierra

- **Qué tiene el visitante sin cuenta** (`A-ENT-02`) es del capítulo 15. Acá está que es un actor
  real, no cuáles son sus capacidades.
- **El scope global de entitlements** (`M-ENT-03`) es del capítulo 15. Acá está que lo global es
  la fuente y nunca la operación.
- **Cómo se agrega cada limit y cómo se hace cumplir un excedente** (`M-ENT-01`, `M-ENT-02`) son
  del capítulo 15: el paso 7 pregunta si queda cupo, no cómo se calculó.
- **Las superficies** —qué se oculta en la UI— son del capítulo 19, y con la regla del §45 por
  delante: *«autorización backend jamás depende de ocultar UI»*.

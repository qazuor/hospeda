---
title: Master Spec 17 — Autorización
linear: HOS-1353
statusSource: linear
created: 2026-09-17
updated: 2026-09-25
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
| **el estado de la persona** | alguien con el correo sin verificar ~~o **inhabilitado por abuso**~~ pasa las ocho con su suscripción al día |

*(«Inhabilitado por abuso» sale de la lista: no tenía columna, transición ni acción que lo
escribiera, y un control sin dato es peor que ninguno porque cada implementación lo llena distinto.
**El abuso se trata ficha por ficha con `MODERATED`** (`PB10`, cap. 03 §9) — owner 2026-09-25; FASE
9 completa, decisión 8b, `F-8CA1-010`.)*

**Y sobra una: el scope de vertical sale de la lista de verificaciones**, porque pasa a ser
estructural (§2). Una verificación que no puede faltar no es una verificación.

Quedan ~~**nueve pasos y una precondición**~~ **nueve verificaciones, en siete pasos y una
precondición**: el paso 4 junta dueño y estado del recurso, y el 5 el estado de acceso y la fuente
activa (FASE 9 vuelta 1, contradicción (e): el nueve contaba verificaciones y se leyó como pasos).

### 1.2 El orden, y por qué ése

El orden no es preferencia: **va de lo que no depende de nada hacia lo que depende de todo**, y
encima corre una segunda regla —**cada paso revela lo mínimo**— que decide qué contesta cuando
falla.

| # | paso | qué pregunta | si falla |
|---|---|---|---|
| — | **contexto de vertical** | *(precondición estructural, §2)* — **en una operación sobre ~~una ficha~~ un recurso que guarda su vertical, la vertical se lee ~~de la ficha~~ del recurso y nunca del pedido** (precisión 6) | la operación no se puede expresar — y si el pedido declara otra vertical que la ~~de la ficha~~ del recurso, **no existe**, con la respuesta del paso 4 |
| 1 | **quién es** | ¿hay un actor ~~?~~ **autenticado**? El `Guest` es un actor (§3.3) y **falla acá**, salvo en una lectura de lo ajeno en estado público (precisión 7) (FASE 9 vuelta 1, `F-8V1A1-006`) | no autenticado |
| 2 | **estado de la persona** | ¿esta cuenta puede operar hoy? | ~~inhabilitada, o~~ correo sin verificar (FASE 9 completa, 8b) |
| 3 | **permiso** | ¿pertenece a la familia de operaciones? | sin permiso |
| 4 | **el recurso: existencia, estado y dueño** | ¿existe, está en un estado que acepta esto, y es del sujeto? **Si el sujeto no es el dueño, el recurso existe sólo en estado público** (precisión 7) **y sólo para una operación que no escribe: una escritura exige `sujeto = dueño`** (FASE 9 vuelta 2, `F-8V2A1-001`). **El sujeto no lo elige el pedido** (precisión 8) | **no existe** — las tres juntas |
| 5 | **fuente viva** | ¿hay **al menos una fuente viva** para ese `user + vertical`? | sin cobertura |
| 6 | **entitlement** | ¿su conjunto efectivo otorga esta capacidad? | sin la capacidad |
| 7 | **limits** | ¿le queda cupo? | excedido |

~~**Cinco precisiones que el orden hace cumplir:**~~ ~~**Seis precisiones que el orden hace cumplir**
(la sexta, FASE 8 completa, `F-8CA1-001`, owner 2026-09-25):~~ ~~**Siete precisiones que el orden
hace cumplir**~~ **Ocho precisiones que el orden hace cumplir** (la sexta, FASE 8 completa,
`F-8CA1-001`, owner 2026-09-25; la séptima, FASE 9 completa, decisión 8c; la octava, FASE 9 vuelta
2, `F-8V2A1-002`):

1. **El paso 4 responde «no existe» a las tres cosas.** Un recurso ajeno, uno archivado y uno
   inexistente son indistinguibles desde afuera. Contestar *«no es tuyo»* confirma que el
   identificador existe, y eso es información que el que pregunta no tenía.

   **«Desde afuera» es la mitad que hay que decir, porque `ARCHIVED` dejó de ser un estado
   sin salida.** El paso 4 pregunta tres cosas y una es *«¿está en un estado que acepta
   esto?»*: una ficha `ARCHIVED` **acepta de su dueño verla, exportarla y reactivarla**
   —`PB8`, cap. 03 §9— **y borrarla** —`PB12`, desde la FASE 8 completa (`F-8CA2-004`)— y rechaza todo lo demás.
   **Y una ficha `MODERATED` acepta de su dueño verla, exportarla, editarla y borrarla, y no
   publicarla** (revisión del owner, 2026-09-28, `g3`): la levanta el admin (`PB11`/`PB13`), y
   borrarla es `PB12`, con correo de confirmación (cap. 03 §9). Es lo que `DEC-DATA-001` promete con *«el
   dueño la sigue viendo»* y lo que el §4.1 de este capítulo ya sostiene al no revocarle el
   rol. Sin esta línea, *«archivado responde no existe»* se lee como que lo responde
   **también al dueño**, y entonces la promesa no la puede cumplir nadie y `PB8` es
   inalcanzable.

   **Y el paso 4 es sólo el primero de los dos que `PB8` tiene que pasar: el otro es el 6.**
   `PB8` escribe estado y es auditable, así que pasa por los ~~nueve~~ **siete** (§3.5), y su población
   declarada —*«el que quiere su ficha de vuelta sin pagar todavía»* (cap. 03 §9)— **no tiene
   ninguna fuente de clase `TÍTULO`**: su conjunto efectivo es la **versión de piso**. Por la
   precisión 5 de más abajo, el 5 la deja pasar y **el 6 es el único que decide**, así que
   habilitarla en el 4 y no en el 6 dejaba la promesa exactamente igual de inalcanzable, una
   puerta más adentro. La versión de piso la otorga: es la **tercera** cosa de su lista
   cerrada, *«recuperar lo suyo»* (cap. 02 §2.1), y **que la otorgue no es un hecho del catálogo de
   hoy sino una obligación con guard** — la mitad *(b)* de `G-R3` (cap. 20 §2) falla si falta.
   **Y lo mismo para `PB12`, el borrado del dueño**: también escribe estado y pasa por el 6, y la
   misma fila 3 del piso lo otorga —verla, exportarla, reactivarla **y borrarla**—, así que el
   dueño borra su ficha con o sin plan (FASE 8 completa, owner 2026-09-25).
   Y es lo mismo para **exportar**, que `V/02`
   §4.2 regla 3 usa para justificar el borrado: es una lectura, no pasa por el 5 y **sí por los
   otros ~~ocho~~ seis, y por la precondición** (§3.5).
2. **El estado de la persona va ANTES del permiso.** Al revés, una cuenta ~~inhabilitada~~ **con el
   correo sin verificar** puede
   averiguar qué permisos tiene probando operaciones: las que contestan *«sin cobertura»* las
   tiene, las que contestan *«sin permiso»* no. *(Decía «inhabilitada»; el estado de la persona
   quedó en el correo sin verificar — FASE 9 completa, 8b.)*

   **Lo que el paso 2 deja pasar con el correo sin verificar es una lista cerrada**: verificar el
   correo o cambiarlo —**salvo que la cuenta tenga un vínculo de Partner: un correo nunca
   verificado no se cambia llevándose vínculos** (cap. 18 §2.4; owner 2026-09-27, FASE 9 vuelta 2,
   `R7`)—; las lecturas de lo propio —Mi Cuenta, su billing y sus fichas (§3.5)—;
   exportar, `PB8` y `PB12`; regularizar un cobro —cambiar la tarjeta, pagar la cuota—; y **darse
   de baja**. Todo lo demás —publicar, contratar, comprar, editar lo público— lo rechaza. Sin esta
   lista el paso 2 bloqueaba justo la recuperación que `DEC-DATA-001` promete y la baja, que deja a
   la persona cobrando (FASE 9 vuelta 1, `F-8V1A1-007`). *«Contratar»* es `DE_ACCESO` (cap. 15) y
   queda **afuera** a propósito: sin correo probado ni el aviso previo al cobro ni el comprobante
   tienen destino.
3. **Los limits van últimos porque son los únicos que necesitan contar.** Todos los pasos
   anteriores se responden con lo que ya está resuelto; éste lee datos. Ponerlo antes hace
   trabajo que la mayoría de los rechazos no necesita. **Y contar no alcanza si se cuenta afuera**:
   en una transición que ocupa cupo —`PB1`, `PB3`, `PB7`— los pasos 5 a 7 se evalúan **dentro de
   un lock por `user + vertical`** que `PB2` también toma, o dos publicaciones simultáneas leen el
   mismo conteo y pasan las dos (cap. 03 §9, *«publicar ocupa cupo bajo un lock»*; FASE 8
   completa, `F-8CA1-006`, `F-8CA2-010`, `F-8CA2-009`, owner 2026-09-25).
4. **El paso 5 no decide capacidades: decide si hay de dónde resolverlas.** Una fuente viva es la
   que el contrato de cobertura devuelve con su referencia (cap. 01 (núcleo) §2.4 — y **no** es
   una *fila* viva, que es otra cosa y no cruza la frontera); **qué otorga esa referencia es el
   paso 6**. Ahí se separa quien puede publicar de quien sólo puede escribir borradores. **Y
   publicar pide además la condición de su transición**, que no es un paso de esta cadena sino de
   la máquina: `PB1` publica sólo si el dueño está cubierto o si esa publicación dispara `T1`, y si
   no, no publica y la pantalla dice *«suscribite para publicar»* (cap. 03 §9, cap. 19 §4 fila 21;
   FASE 8 completa, owner 2026-09-25). La cadena contesta *«¿puede?»*; la fila, *«¿esta transición
   ocurre?»* (cap. 03 §1 regla 1, núcleo). Un paso 5 que
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
6. **En una operación sobre una ficha, la vertical no viene del pedido: se lee de la ficha**
   (FASE 8 completa, `F-8CA1-001`, owner 2026-09-25). Es el primer paso de la cadena —la fila de
   la precondición— y va **antes de mirar la cobertura**, porque los pasos 5 a 7 se resuelven
   sobre `user + vertical` y la vertical tiene que ser la verdadera antes de preguntar nada con
   ella. Si el pedido declara otra, **no existe**: la misma respuesta que el paso 4 da a una ficha
   ajena, por la misma razón de la precisión 1 —contestar *«es de otra vertical»* confirma que el
   identificador existe—. En el contrato de errores de la API es **404 y no 403**, y sale **en el
   escalón de existencia**, después de la autenticación y del permiso de ruta
   (`apps/api/docs/error-contract.md`, *«the order is the contract»*): la vertical se resuelve
   primero, y el rechazo por no coincidir se entrega con el del paso 4.

   **El caso que cierra**: con Alojamiento pago, publicar una ficha de Gastronomía **declarando**
   Alojamiento pasaba los pasos 5 a 7 contra Alojamiento, publicaba gratis y consumía cupo de la
   vertical equivocada; como `PB2` mira el cambio de `cubierto` **de la vertical de la ficha**, que
   nunca cambió, nada la bajaba, y editarla cada 89 días reiniciaba el único reloj que la
   alcanzaba (`F-8CA1-001`). El dato para comparar ya existía: `listing` guarda su vertical
   (`V/02` §2.5).

   **Vale para todo recurso que guarda su vertical, no sólo para la ficha** (owner 2026-09-25;
   FASE 9 completa, decisión 7a): **la ficha y su contenido** —fotos, FAQ, horarios, leídos como
   operaciones sobre la ficha y no sobre un recurso aparte—, **la presencia de Partner** —la que el
   §2.4 nombra como *«edita su presencia de partner»*— y **la instancia de addon**. Sin esto, subir
   fotos a la página de Partner declarando Alojamiento contaba el cupo contra el plan de
   Alojamiento. **Y la vertical de una ficha es inmutable desde el alta** (`V/02` §2.5): *«nunca una
   ficha debería poder cambiar de vertical»*. Leerla del recurso no alcanzaba si el recurso la podía
   cambiar: la edición que movía una ficha publicada de Alojamiento a Gastronomía se autorizaba
   contra la vertical anterior y la dejaba publicada sin cobertura en la nueva. Lo vigila la mitad
   *(c)* de `G2` (cap. 20 §2).
7. **Lo ajeno existe sólo en estado público** (owner 2026-09-25; FASE 9 completa, decisión 8c,
   `F-8CA1-011`). El paso 4 pregunta *«¿es del sujeto?»*, y un turista que lee la ficha publicada
   de María no es su dueño: leído al pie de la letra, contestaba *«no existe»* y cada superficie
   pública se hacía su exención —la *«exención por superficie»* que el §3.5 descarta—, con el riesgo
   de que por una se colara un borrador ajeno. **Cuando el sujeto no es el dueño, el recurso existe
   sólo si está en un estado público, y la lista es cerrada**: una ficha en **`PUBLISHED`**, y una
   presencia de Partner ~~**con la clave vigente y sin moderar**~~ **con la clave de esa
   superficie** —«página propia» para la página, «presencia en el carrusel» para el carrusel (cap.
   18 §1.2)— **vigente y sin moderar** (cap. 18 §1.6; FASE 9 vuelta 1, `F-8V1A1-004`). Todo lo demás —el
   borrador, la archivada, la moderada, la presencia sin la clave o moderada— es, para quien no es
   el dueño, lo mismo que no existir: la respuesta de la precisión 1.

   **Y vale sólo para lo que no escribe** (FASE 9 vuelta 2, `F-8V2A1-001`). La precisión se
   escribió para el turista que lee, y su texto no lo decía: una escritura con `actor = sujeto ≠
   dueño` sobre una ficha `PUBLISHED` ajena no disparaba ninguna regla del §3.2, que se activan
   todas con `actor ≠ sujeto`, y pasaba los pasos 5 a 7 con el plan de quien escribía. **Una
   escritura exige `sujeto = dueño`, y sobre lo ajeno —público o no— contesta *«no existe»***, la
   misma respuesta de la precisión 1, sin una segunda. Es escritura todo lo que muta el recurso o
   algo que cuelga de él: editar la ficha o su contenido, subir fotos, despublicarla, y **comprar
   un addon de alcance `LISTING` con esa ficha de objetivo**. Lo ajeno sólo se escribe con una
   acción administrativa, que tiene su permiso (§3.2 regla 1).
8. **El sujeto no viene del pedido: se lee de la sesión o del recurso** (FASE 9 vuelta 2,
   `F-8V2A1-002`). Es la regla de la precisión 6 aplicada a la otra identidad. Nadie escribía de
   dónde salía el sujeto, y con el paso 4 preguntando *«¿es del sujeto?»* y el §3.5 sacando del
   paso 6 las lecturas de lo propio, un sujeto tomado del pedido dejaba a cualquier cuenta leer el
   billing de otra. Dos casos, y la operación declara en cuál está, como declara su clase (§3.2
   regla 3):
   - **en una operación que no es de `actor ≠ sujeto`** —todas, salvo las acciones de `NUCLEO/08`
     §3 y las inspecciones del §3.2 regla 1—, **`sujeto = actor`, siempre**. El pedido no lo
     decide, y lo ajeno cae en el paso 4;
   - **en una de `actor ≠ sujeto`, el sujeto es el dueño del recurso sobre el que opera, leído del
     recurso** —la cuenta misma, si el recurso es una cuenta—. Si el pedido declara otro, **no
     existe**, igual que la vertical en la precisión 6.

### 1.3 Los ~~nueve~~ siete pasos se resuelven en un solo lugar

**No hay nueve verificaciones repartidas** (son nueve verificaciones, en los siete pasos del §1.2)**: hay una resolución de autorización que las ejecuta en
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
la firma, no un parámetro opcional ~~ni un valor que se deduzca del recurso~~. **Y en una operación
sobre ~~una ficha~~ un recurso que guarda su vertical —la ficha y su contenido, la presencia de
Partner, la instancia de addon—, ese contexto es la vertical ~~de la ficha, leída de la ficha~~ del
recurso, leída del recurso**: la que el pedido
declare no decide nada, y si no coincide la operación responde *no existe* (§1.2, precisión 6;
FASE 8 completa, `F-8CA1-001`, owner 2026-09-25; generalizada por la FASE 9 completa, decisión 7a). *«No se deduce del recurso»* dejaba la defensa
de este § apoyada en que la vertical declarada fuera la verdadera, y nada lo comprobaba.

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

> **Y la tercera cosa que la versión de piso otorga —*«recuperar lo suyo»*, cap. 02 §2.1— no abre
> este cruce por otra puerta**, por dos razones independientes: es **por vertical**, porque hay una
> versión de piso por vertical y la resolución es por `user + vertical`; y su objeto es **una ficha
> propia**, que el **paso 4** ya exige antes de llegar al 6. El de Gastronomía sigue sin poder
> tocar nada de Alojamiento, y el que sí tiene una ficha archivada en Alojamiento puede traerla a
> borrador — que es distinto de publicarla, y publicar es `PB1`.

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

**Y éste tiene una segunda mitad** (FASE 8 completa, `F-8CA1-001`, owner 2026-09-25): falla si una
operación **sobre ~~una ficha~~ un recurso que guarda su vertical** toma su contexto de vertical
**del pedido y no ~~de la ficha~~ del recurso**. La
primera mitad sólo mira que la vertical se declare, y declararla no era el defecto: el defecto era
que nadie comparaba la declarada con la del recurso (`G2`, cap. 20 §2). **Y una tercera** (owner
2026-09-25; FASE 9 completa, decisión 7a): falla si una operación **escribe la vertical de un
recurso que ya existe**, porque leerla del recurso no protege nada si el recurso la puede cambiar.

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

~~**Cuatro reglas, y ninguna es opcional:**~~ **Cinco reglas, y ninguna es opcional** (la quinta, owner
2026-09-26, `G5-1`):

1. **`actor ≠ sujeto` exige un permiso de esa acción concreta**, no una condición general de
   «es administrador». Las ~~doce~~ ~~**trece**~~ ~~**catorce**~~ ~~**quince**~~ ~~**dieciséis**~~ ~~**quince**~~ ~~**dieciséis**~~ **veintiuna** acciones del capítulo 08 §3 llevan permiso propio, una por una
   (la decimotercera, moderar una ficha —**o la presencia de un Partner**, desde la FASE 9 completa,
   decisión 7c—: FASE 8 completa, `F-8CA2-004`, owner 2026-09-25; **la decimocuarta, asentar un cobro
   o una devolución que ya ocurrió por fuera de nuestro flujo**: owner 2026-09-25, FASE 9 completa,
   decisión 5a; **la decimoquinta, editar el contenido de una ficha ajena** —sin publicar, destacar
   ni borrar—: owner 2026-09-26, `G5-2`; ~~**la decimosexta, discontinuar una vertical** **o acortar
   su cola**, de `SUPER_ADMIN`: owner 2026-09-27, FASE 9 vuelta 2, `Q-ACC16`; acortar la cola, la
   misma acción con el mismo permiso, FASE 9 vuelta 2, verificación, `V2-g`~~; la decimosexta salió
   con la revisión del owner, 2026-09-28, C8: las verticales no se discontinúan, y su número no se
   reusa; **la decimoséptima, migrar a los clientes de un plan retirado o cancelar una migración
   anunciada, de `SUPER_ADMIN`**: revisión del owner, 2026-09-28, C15; **de la decimoctava a la
   vigesimosegunda, las cinco del catálogo (publicar una versión de plan, fijar el precio de un
   ciclo, publicar una versión de complemento, crear o cerrar un código promocional y cambiar un
   plazo), de `SUPER_ADMIN`**: la misma revisión, N1, C9 y `L1-f`).

   **Y una lectura con `actor ≠ sujeto` también exige el suyo** (FASE 9 vuelta 2, `F-8V2A1-002`).
   Las ~~quince~~ ~~dieciséis~~ ~~quince~~ ~~dieciséis~~ veintiuna son escrituras, y las inspecciones del §48 no tenían ninguno: la única pieza a mano
   era el permiso de familia de leer lo propio, que cualquier cliente tiene. **Cada entidad que el
   §48 manda inspeccionar —usuarios, suscripciones, pagos, cortesías, grants y las demás de su
   lista— tiene su permiso de inspección**, y ninguno es *«es administrador»*. **No son filas de
   `NUCLEO/08` §3**: aquel catálogo es de escrituras, y el §3.3 le prohíbe sus filas al actor de
   sistema, que lee todo el tiempo. Su sujeto sale del recurso inspeccionado (§1.2, precisión 8),
   y la lectura pasa por los pasos de una lectura de lo propio **de ese sujeto** (§3.5). Cuáles
   son, uno por uno, se enumera con la superficie del admin, como la lista de operaciones del §3.5
   punto 2.
2. **Toda operación con `actor ≠ sujeto` es auditable sin excepción**, con los campos del
   capítulo 08 §1.2. El `actor` es uno de ellos, y es lo que convierte *«alguien otorgó esta
   cortesía»* en *«esta persona la otorgó»*.
3. **El admin no hereda los entitlements del sujeto.** Los pasos 5, 6 y 7 se evalúan **sobre el
   sujeto**, así que un administrador no puede hacerle a un cliente algo que el cliente no podría
   hacer. La excepción está declarada y es acotada: **las ~~doce~~ ~~trece~~ ~~catorce~~ ~~quince~~
   ~~catorce primeras~~ ~~quince acciones del capítulo 08 §3 —las catorce primeras y la decimosexta—~~ ~~catorce primeras acciones del capítulo 08 §3~~ ~~**quince acciones del capítulo 08 §3, las catorce primeras y la decimoséptima,**~~ **veinte acciones del capítulo 08 §3, las catorce primeras y de la decimoséptima a la vigesimosegunda,** son
   capacidades del actor** (FASE 9 vuelta 2, `F-8V2A1-004` ~~y `Q-ACC16`~~; la decimosexta salió con la revisión del owner, 2026-09-28, C8; la decimoséptima entró con la misma revisión, C15, y las cinco del catálogo con N1 y C9: su sujeto es el catálogo, no un cliente), no del sujeto —
   otorgar una cortesía no consulta si el cliente tiene derecho a una, porque su objeto es
   dárselo. **A qué clase pertenece una operación se declara, nunca se infiere.**

   **La decimoquinta, editar el contenido de una ficha ajena, no está en la excepción** (FASE 9
   vuelta 2, `F-8V2A1-004`): **sus pasos 5 a 7 se evalúan sobre el sujeto, el dueño de la
   ficha**. Su objeto no es darle algo al cliente, sino hacer por él lo que él mismo podría, y el
   contenido tiene cupo —fotos, secciones—. Sobre el actor, el paso 6 la rechazaba siempre —el admin
   no tiene fuentes y resuelve contra el piso— o, leída como *«el permiso ya es la capacidad»*,
   dejaba una ficha por encima del cupo de su dueño sin cortesía ni plata. Sobre el sujeto,
   soporte le restaura a la dueña de un plan de diez fotos hasta diez.

   ~~**La decimosexta, discontinuar una vertical, sí está en la excepción** (owner 2026-09-27, FASE 9
   vuelta 2, `Q-ACC16`). El criterio es el de la decimoquinta leído al revés: su objeto no es
   hacer por un cliente lo que él mismo podría, porque ningún cliente puede discontinuar una
   vertical, y no recae sobre un dueño con cupo, sino sobre la vertical entera y todos sus dueños
   a la vez. Sobre el sujeto, los pasos 5 a 7 no tendrían a quién preguntarle; sobre el actor,
   el permiso de `SUPER_ADMIN` es la capacidad.~~ (Sale con la acción: revisión del owner,
   2026-09-28, C8.)
4. **No existe la impersonación.** El administrador no «entra como» el cliente. La diferencia es
   todo el punto: impersonar hace que el registro diga que el cliente lo hizo, y ése es
   exactamente el rastro que el hueco pide que no se pierda. **«Entrar como» se va a agregar en una
   versión posterior, y no es esto** (revisión del owner, 2026-09-28, C7): un admin que le maneja la
   ficha a quien no sabe hacerlo, **con todo registrado como hecho por el admin en nombre del
   cliente** (actor el admin, sujeto el cliente), que es exactamente lo que esta regla protege
   (*«lo que este capítulo NO cierra»*).
5. **Una acción administrativa nunca tiene `actor = sujeto`: el paso 3 la rechaza** (*«sin
   permiso»*) y la hace otra cuenta con el permiso (owner 2026-09-26, `G5-1`; FASE 9 vuelta 1,
   `F-8V1A1-001`). Con roles aditivos, la persona que confirma podía ser la interesada —un `ADMIN`
   que además es cliente registrándose su propia cuota— y `D11` (*«lo que toca plata lo confirma
   una persona»*) se cumplía a la letra sin proteger nada: la regla lo vuelve lo que quiso decir,
   ~~**otra** persona~~ **otra cuenta** (no otra persona: ver abajo). Es una regla sin lista, vale para las ~~quince~~ ~~dieciséis~~ ~~quince~~ ~~dieciséis~~ veintiuna acciones del capítulo 08 §3, y su
   costo es de una sola vez: quien administra y además es cliente necesita una segunda cuenta —la de
   admin separada de la de cliente— para que lo suyo lo opere otra. Lo prueba un caso de `V5`.
   **La regla compara cuentas, no personas** (owner 2026-09-26, `Y-2`; FASE 9 vuelta 1, `N-1` de
   `25-verificado-G5`): impide el error de operarse a sí mismo con la misma cuenta, y no impide a
   una persona interesada con dos —desde `juan-admin`, registrar el pago manual de `juan-cliente`
   cumple `actor ≠ sujeto` y el paso 3 no lo rechaza—; con un owner que opera solo, su cuenta de
   admin puede ser la única con el permiso. **Se declara, con detector**: el resumen de
   `DEC-OBS-001` lista cada acción administrativa que mueve plata con su actor y su sujeto
   (`NUCLEO/08` §4.1), y la revisión es humana. **La confirmación por una segunda persona** —la
   acción queda pendiente hasta que otra cuenta de staff la confirme— **entra cuando haya otra
   persona con el permiso**: hoy bloquearía la operación, porque no hay segunda persona.
   ~~**En la decimosexta, discontinuar una vertical, el sujeto es la vertical** (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-s`):
   el acto recae sobre la vertical y todos sus dueños a la vez, así que `actor = sujeto` no se da y
   la regla se cumple sola. El resumen de `DEC-OBS-001` la muestra con la vertical y cuántos dueños
   alcanza, y el `SUPER_ADMIN` que además es dueño en esa vertical queda visible ahí. **Sin regla
   nueva**: queda declarado en *«lo que este capítulo NO cierra»*.~~ (Sale con la acción: revisión
   del owner, 2026-09-28, C8.)
   **En la decimoséptima, migrar a los clientes de un plan retirado, la cohorte puede incluir la
   cuenta del propio `SUPER_ADMIN` que la lanza**: esa fila se excluye y el acto sigue para las
   demás. No se le escribe fila de alcance, la previsualización la muestra excluida con esta
   regla como razón, y otra cuenta con el permiso la puede migrar en otro acto (`B/10` §3.7
   punto 1; revisión del owner, casos vecinos, 2026-09-29, caso 24).

### 3.3 El actor no siempre es una persona

Dos actores más, y nombrarlos evita que alguien los trate como ausencia de actor:

| actor | qué es |
|---|---|
| **el visitante sin cuenta** | el `Guest` del §6 es **un actor del modelo, no la falta de uno** — igual que `PRE_TRIAL` es un estado real y no la ausencia de uno (`DEC-TRIAL-007`). Qué puede hacer es `A-ENT-02`, capítulo 15. **No pasa del paso 1** salvo en la lectura pública, y el paso 2 no le aplica: no tiene cuenta (FASE 9 vuelta 1, `F-8V1A1-006`) |
| **el sistema** | los jobs y los webhooks operan sin persona detrás. Llevan su propio identificador de actor y sus dos identificadores de correlación (cap. 08 §2.3) |

**Un actor de sistema no puede ejecutar ninguna de las ~~doce~~ ~~trece~~ ~~catorce~~ ~~quince~~ ~~dieciséis~~ ~~quince~~ ~~dieciséis~~ veintiuna acciones del capítulo 08 §3.** ~~Las
doce mueven dinero o conceden servicio~~ Doce mueven dinero o conceden servicio, y eso es el invariante `D11`: lo que toca plata lo
confirma una persona. La decimotercera, moderar una ficha (`PB10`/`PB11`, cap. 03 §9) **o la
presencia de un Partner** (cap. 18 §1.6; FASE 9 completa, 7c), no toca
plata: le quita a alguien su presencia pública por decisión nuestra, y la decisión es de un admin
por cómo está escrita (FASE 8 completa, `F-8CA2-004`, owner 2026-09-25). **La decimocuarta,
asentar un cobro o una devolución que ya ocurrió por fuera de nuestro flujo, es plata** —registra
la que entró o salió sin pasar por nosotros, y corre `P1` o cierra un `refund`— y cae en `D11` por
la misma razón que las doce (owner 2026-09-25; FASE 9 completa, decisión 5a). **La decimoquinta,
editar el contenido de una ficha ajena, no toca plata ni publica**: es una escritura sobre lo
ajeno, y su rastro vale sólo si el actor es la persona que la decidió, que es lo que el §3.2 regla 2
exige (owner 2026-09-26, `G5-2`). ~~**La decimosexta, discontinuar una vertical, es plata**: cancela
en el proveedor cada suscripción viva de la vertical (`B/10` §4.1, *«toca plata»*), y cae en `D11`
por la misma razón que las doce (owner 2026-09-27, FASE 9 vuelta 2, `Q-ACC16`); **acortar su cola
también**, que es la misma acción y reembolsa (FASE 9 vuelta 2, verificación, `V2-g`).~~ (La
decimosexta salió con la revisión del owner, 2026-09-28, C8.) **La decimoséptima, migrar a los
clientes de un plan retirado, es plata**: le cambia el precio a cada cliente alcanzado en su
renovación, y cae en `D11` por la misma razón que las doce (revisión del owner, 2026-09-28, C15);
**lo que aplica después, fila por fila, es `S37`, una transición y no una ejecución de sistema de
la acción**: lo que la persona firmó al anunciar es la migración entera, como la re-emisión de una
cortesía diferida que hace `S9` con la firma original (confirmado por el owner: revisión del owner,
casos vecinos, 2026-09-29, caso 23; y lo mismo vale para `S38`, que en la renovación aplica el
cambio de versión que `S37` encoló, caso 37). **Las cinco del catálogo, de la decimoctava
a la vigesimosegunda, también las decide y las confirma una persona** (revisión del owner,
2026-09-28, N1 y C9): fijar un precio mueve plata y cae en `D11` igual; lo que un plazo o una
versión nueva cambia después lo aplican las transiciones de siempre, con la versión que cada reloj
guarda (`NUCLEO/02` §1.5). Un job que
pudiera otorgar una cortesía convierte ese invariante en una sugerencia.

~~**La excepción que no es una acción nueva: el reintento de la mitad de billing de la
decimosexta** (FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-i`, `N-C-05`). Si esa mitad
falla, la acción la reintenta sola hasta que entra (`Q-ALTAS-b`, `B/10` §4.3), y el reintento lo
corre un proceso. **Lleva la firma y la correlación del `SUPER_ADMIN` que confirmó el acto**, como
la re-emisión de una cortesía diferida que hace `S9` con la firma original (`NUCLEO/08` §3, la
tabla del enrutado): el acto ya lo decidió y lo confirmó una persona, y el reintento termina lo
que ella firmó sin decidir nada. Por eso no es una ejecución de sistema de una de las dieciséis. **La
excepción es ésta sola**: vale para la mitad de billing del acto que esa persona confirmó, sobre
esa vertical, y no para ninguna otra fila de la tabla.~~ **Sin excepción** (revisión del owner,
2026-09-28, C8): el reintento era de la mitad de billing de discontinuar una vertical, y la acción
salió. Ningún actor de sistema ejecuta una fila de la tabla.

### 3.4 Cuando el actor es el reloj, los pasos 5 a 7 se evalúan sobre el ACTOR

El §3.3 declara al sistema como actor y no decía **cómo se evalúan los pasos 5, 6 y 7 cuando el
actor es uno**. Es un hueco con caso concreto: `T3` —el vencimiento del trial— **la dispara el
reloj**, y esos tres pasos preguntan por el título, las capacidades y el cupo **de alguien que no
existe**.

> **Las transiciones disparadas por el reloj son una segunda clase de operación, evaluada por
> analogía con las ~~doce~~ ~~trece~~ ~~catorce~~ ~~quince~~ ~~catorce~~ ~~quince~~ ~~catorce~~ ~~quince~~ veinte acciones administrativas
> que son capacidad del actor (§3.2 regla 3; FASE 9 vuelta 2, `F-8V2A1-004`; ~~`Q-ACC16`~~ la decimosexta salió con la revisión del owner, 2026-09-28, C8; la decimoséptima entró con la misma revisión, C15; las cinco del catálogo, con N1 y C9): los pasos 5, 6 y 7 se
> resuelven sobre la capacidad del ACTOR, no sobre la del sujeto.**

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

**Y las transiciones del sistema que dispara un EVENTO no son de esta clase, y se declaran acá**
(FASE 8 completa, `F-8CA1-009`, owner 2026-09-25). Son **`PB2`, `PB3` y `PB7`** (cap. 03 §9), **el
reconciliador de excedentes** (cap. 15 §4.2) y **el reconciliador diario de cobertura** (cap. 03
§9, `DEC-ARCH-009`) cuando las corre: su actor es el sistema, pero su evento es un cambio de
cobertura o de cupo, no el paso del tiempo —`PB7` lo dice de sí misma en el cap. 03 §9, y el
reconciliador diario corre por calendario pero no cambia el evento de ninguna—.

> **En ellas los pasos 5, 6 y 7 se evalúan sobre el SUJETO, que es el dueño de la ficha, con el
> sistema como actor.** Es la regla general del §3.2 —*«los pasos 5, 6 y 7 se evalúan sobre el
> sujeto»*— sin caer en ninguna de las dos excepciones: las ~~doce~~ ~~trece~~ ~~catorce~~ ~~quince~~
> ~~catorce~~ ~~quince~~ ~~catorce~~ ~~quince~~ veinte acciones del cap. 08 §3 que son capacidad del actor —las catorce primeras ~~y la
> decimosexta, `Q-ACC16`~~ ~~**y la decimoséptima**~~ **y de la decimoséptima a la vigesimosegunda** (revisión del owner, 2026-09-28, N1 y C9: de la decimoctava a la vigesimosegunda, las cinco del catálogo)— (la decimoquinta no lo es: §3.2 regla 3; FASE 9 vuelta 2, `F-8V2A1-004`; la decimosexta salió con la revisión del owner, 2026-09-28, C8, y la decimoséptima entró con C15) y la clase del reloj de este §.

**No es una clase nueva: es declarar que no están en ninguna de las dos excepciones**, que es lo
que la regla 3 del §3.2 exige hacer por escrito. Y es la lectura que las filas ya pedían: `PB3` y
`PB7` publican *«y el cupo alcanza»*, y el cupo es del dueño. Evaluado sobre el actor —la analogía
con el reloj, que era la única disponible—, el paso 7 miraba el cupo de un actor que no tiene
ninguno y la restitución publicaba sin límite. **Y la propiedad *«nunca otorga»* no las alcanza**:
`PB3` y `PB7` otorgan, y por eso mismo su paso 7 se evalúa sobre quien paga el cupo.

> ⚠️ **Lo que esto NO cierra, declarado por `DEC-METH-015`**: la regla 1 del §3.2 exige, cuando
> `actor ≠ sujeto`, **un permiso de esa acción concreta**, y está escrita para una persona. Cómo lo
> cumple un actor de sistema —en esta clase y en la del reloj, que tienen el mismo `actor ≠
> sujeto`— no está escrito. No da acceso a ninguna persona: el §3.3 ya le prohíbe al sistema las
> ~~doce~~ ~~trece~~ ~~catorce~~ ~~quince~~ ~~dieciséis~~ ~~quince~~ ~~dieciséis~~ veintiuna acciones del cap. 08 §3 (~~`Q-ACC16`~~ revisión del owner, 2026-09-28, C8, C15, N1 y C9).

### 3.5 Qué operación pasa por el paso 5 — el criterio ahora, la lista después

El conjunto de operaciones de dominio **nunca se enumeró**. Lo único enumerado son las ~~**12**~~ ~~**13**~~ ~~**14**~~ ~~**15**~~ ~~**16**~~ ~~**15**~~ ~~**16**~~ **21**
**acciones administrativas** (la 13, moderar una ficha: FASE 8 completa, `F-8CA2-004`; la 14, asentar un cobro o una devolución hecha por fuera: FASE 9 completa, 5a; la 15, editar el contenido de una ficha ajena: owner 2026-09-26, `G5-2`; ~~la 16, discontinuar una vertical: owner 2026-09-27, FASE 9 vuelta 2, `Q-ACC16`~~ la 16 salió con la revisión del owner, 2026-09-28, C8, y su número no se reusa; la 17, migrar a los clientes de un plan retirado: la misma revisión, C15; de la 18 a la 22, las cinco del catálogo: la misma revisión, N1 y C9), que son **la excepción, no el conjunto**. Y hay una regla en uso que
nadie había escrito: para decidir que las lecturas de «Mi Cuenta» no pasan por el paso 5 se usó el
criterio *«escribe estado y es auditable»*, inferido de cómo se clasifica a `PB1` y ausente de
todo capítulo.

**Se escribe el criterio ahora y la enumeración se arma durante la implementación**, en tres
partes:

1. **El criterio**, y son **dos preguntas distintas** que antes venían pegadas:
   - **¿corre la resolución?** **Toda operación la corre**, escriba o no. No hay operación exenta.
   - **¿pasa por el paso 5?** Sólo si **escribe estado del negocio y es auditable**. Una lectura
     que no muta nada **no pasa por el 5** — y **sí por los otros ~~ocho~~ seis, y por la precondición**.

   > ⚠️ **Los ~~nueve~~ siete pasos no vienen en bloque, y decir que una lectura «no es de dominio» la
   > sacaba de los ~~nueve~~ siete.** Con eso **ninguna lectura tenía autorización**: ni el paso 4
   > —existencia, estado y **dueño**—, ni el 3, ni el 2. Leer el borrador de otra persona, su «Mi
   > Cuenta» o los datos que el §48 le muestra al admin **no atravesaba ningún control declarado**.
   > Es la exención por superficie que el §5 descarta por escrito, entrando **con forma de
   > criterio** — que es peor, porque no se ve.

   **Por qué una lectura no pasa por el paso 5, y sí por el 4**: el 5 pregunta si hay de dónde
   resolver capacidades **comerciales**, y leer no consume ninguna. El 4 pregunta **si el recurso
   es del sujeto**, que es exactamente lo que una lectura tiene que responder. Son preguntas
   distintas y sacarlas juntas fue el error.

   **Y las lecturas de lo propio no pasan tampoco por el 6** (owner 2026-09-25; FASE 9 completa,
   decisión 8d, `F-8CA1-013`). Es el caso simétrico del 5: *leer lo propio no consume capacidad
   comercial*, así que no hay clave que pedirle al conjunto efectivo. Sin esto un `SUSPENDED`
   —que resuelve contra la versión de piso, cuyas tres filas no incluyen *«leer Mi Cuenta»* ni
   *«leer mi billing»* (`V/02` §2.1)— no podía ver cómo regularizar, que desde `DEC-SUB-021` es
   cambiar la tarjeta. **La excepción es cerrada**: **Mi Cuenta, su billing y sus fichas**. Una
   lectura comercial sobre lo propio —una estadística paga— **no** es *«lo propio»* en este sentido
   y sigue pasando por el 6. Una lectura de lo propio pasa por ~~**siete** pasos: todos menos el 5 y
   el 6~~ **cinco** pasos —todos menos el 5 y el 6—, y por la precondición (FASE 9 vuelta 1,
   contradicción (e)). **«Lo propio» es del sujeto, y el sujeto no lo elige el pedido** (§1.2,
   precisión 8; FASE 9 vuelta 2, `F-8V2A1-002`): leer el billing de otra cuenta con el permiso de
   familia de leer el suyo contesta *«no existe»*, y leerlo como admin pide el permiso de
   inspección de esa entidad (§3.2 regla 1).

   **Y cuando el recurso es ajeno, el 4 contesta con la precisión 7 del §1.2** (owner 2026-09-25;
   FASE 9 completa, decisión 8c): existe sólo en estado público —una ficha `PUBLISHED`, una
   presencia de Partner ~~con la clave vigente y sin moderar~~ **con la clave de esa superficie**
   —«página propia» para la página, «presencia en el carrusel» para el carrusel (cap. 18 §1.2)—
   **vigente y sin moderar** (FASE 9 vuelta 1, `F-8V1A1-004`)—, **y sólo para leer: una escritura
   sobre lo ajeno contesta *«no existe»*** (FASE 9 vuelta 2, `F-8V2A1-001`). Es la lista que el diseño ya usaba sin
   haberla escrito, y escribirla acá es lo que impide que cada superficie pública se haga su
   exención (el ⚠️ de arriba).
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
trial, ni la cancelación, ni la pausa ~~, ni la discontinuación de una vertical (cap. 10 §4)~~ (las verticales no se discontinúan: revisión del owner, 2026-09-28, C8).

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

**Y ningún rol es una fuente.** El conjunto efectivo sale **sólo** de las fuentes que devuelve
`cobertura()` (`12-contrato…` §2): `TRIAL`, `SUSCRIPCIÓN`, `CORTESÍA`, `GRANT`, `BASE` y
`ADDON`. El cargador del código de hoy, que le da a `SUPER_ADMIN`, `ADMIN`, `EDITOR` y
`CLIENT_MANAGER` el conjunto entero con limits en `-1` antes de que corra el chequeo, **se
retira**, se reutilice o no el resto del cargador. Lo que el staff necesita en su trabajo lo da
el §3.2 regla 1, acción por acción, nunca un conjunto (FASE 9 vuelta 1, `F-8V1A1-002`). Lo vigila
la segunda mitad de `G6` (cap. 20 §2).

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
- **La misma persona con dos cuentas** (owner 2026-09-26, `Y-2`; declarado por `DEC-METH-015`;
  FASE 9 vuelta 1, `N-1`). La regla 5 del §3.2 compara cuentas: una persona con una cuenta de staff
  y otra de cliente opera lo suyo desde la primera y la regla no lo ve. **Causa**: con un solo
  operador, la confirmación por una segunda persona bloquea la operación, y vincular las cuentas de
  una persona lo declara el propio interesado, así que lo elude quien quiera eludirlo. **Lo que queda
  es el detector** —el resumen de `DEC-OBS-001` lista cada acción que mueve plata con actor y sujeto,
  `NUCLEO/08` §4.1—, que no distingue a la persona: la revisión es humana. La confirmación por una
  segunda persona entra cuando haya otra persona con el permiso.
- ~~**El `SUPER_ADMIN` que es dueño en la vertical que discontinúa** (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-s`; declarado
  por `DEC-METH-015`).~~ **Sale** (revisión del owner, 2026-09-28, C8): la acción 16 ya no existe.
- **«Entrar como» el cliente** (revisión del owner, 2026-09-28, C7): **no está en esta versión y
  se va a agregar**. Su condición queda escrita hoy: **se registra como hecho por el admin en
  nombre del cliente** (actor el admin, sujeto el cliente, nunca `actor = sujeto` en el registro,
  §3.2 regla 5), así que no es la impersonación de la regla 4. **Cuando se diseñe se reabre la
  frase *«ni las que se agreguen»* de `NUCLEO/08` §3**: si publicar en nombre del cliente le
  arranca la prueba al cliente o no. No agrega unidades ni guards en esta versión.
- **Discontinuar una vertical** (revisión del owner, 2026-09-28, C8): **fuera de esta versión; si
  algún día hace falta, se diseña entonces**. No hay acción administrativa que la haga, ni permiso
  que la pida. Retirar planes, también todos los de una vertical, sigue siendo posible y no es una
  acción de esta tabla sino una publicación del catálogo.

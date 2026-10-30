---
title: "FASE 8 vuelta 1 · A1 — acceso cruzado y autorización"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 8
---

# FASE 8 vuelta 1 · A1 — acceso cruzado y autorización

Ataqué quién puede hacer qué sobre qué: los nueve pasos del cap. 17 y su orden, actor y sujeto,
las catorce acciones administrativas del `NUCLEO/08` §3, el cruce de roles en una misma cuenta
(admin y anfitrión, admin y partner), el guest, la precisión 7 (*«lo ajeno existe sólo en estado
público»*), la presencia de Partner con sus dos claves, la herencia de Turista VIP, el objetivo de
un addon `LISTING`, el caché del conjunto efectivo, las superficies que ofrecen algo que la
autorización niega, y lo que el corte le deja a quien no le corresponde. Medí todo contra el
worktree de la spec (`47e8c3ea85`), y contra el código actual sólo donde el diseño calla sobre algo
que el código ya hace.

Son **9 hallazgos**: **0 CRITICA, 5 ALTA, 4 MEDIA y 0 BAJA**. La idea más grave: el diseño vigila
que un **tercero** no opere sin permiso, pero no dice nada de la cuenta que se administra **a sí
misma** —un admin que también es cliente puede asentarse un cobro, reembolsarse o levantarse una
moderación con su propio permiso—, y tampoco retira el bypass de staff que hoy le da a esa misma
cuenta todas las claves gratis.

Regla de lectura: cada hallazgo se apoya en una cita textual copiada literal de una sola línea del
archivo, con su `archivo:línea` (rutas relativas a la raíz del worktree). Donde cito el código
actual es porque el diseño no lo menciona, y el silencio es el hallazgo.

## ALTA

### F-8V1A1-001 — Un admin que también es cliente se administra a sí mismo sin ningún control

**Qué se rompe.** Todo el control sobre las catorce acciones está escrito para `actor ≠ sujeto`.
Cuando la misma cuenta es admin y cliente (los roles son aditivos), `actor = sujeto`, la regla 1
no aplica, y las catorce siguen siendo *«capacidades del actor»* que no pasan por los pasos 5-7. La
confirmación explícita la da la misma persona interesada, así que `D11` —*«lo confirma una
persona»*— se cumple a la letra y no protege nada. Tres de las catorce mueven plata hacia afuera o
evitan un cobro: asentar un cobro, reembolsar y registrar un pago manual.

**El camino.**

1. Juan es `ADMIN` con permiso de asentar cobros y de reembolsar, y además es Partner Gold con
   pagador manual en su propia cuenta personal.
2. Juan asienta sobre su propia suscripción *«un cobro que ya ocurrió fuera de nuestro flujo»*
   (motivo 19): crea el `payment` y corre `P1`. Su suscripción queda cubierta un período sin que
   haya entrado un peso.
3. O al revés: Juan paga con tarjeta su plan de Alojamiento, se reembolsa el pago confirmando
   `RF2` con su propio permiso, y la fila sigue cubierta hasta que el proveedor mueva algo.
4. La confirmación explícita la aprieta él. El registro de auditoría dice que el actor fue Juan y
   el sujeto fue Juan: es el único detector, y es tardío —alguien tiene que ir a buscarlo—.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:290`
  — "Lo que autoriza que `actor ≠ sujeto` es un permiso,"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:307`
  — "no del sujeto — otorgar una cortesía no consulta si el cliente tiene"
- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:147`
  — "Cada acción lleva tres cosas: permiso propio, registro de auditoría, y confirmación explícita"
- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:165`
  — "asentar un cobro o una devolución que ya ocurrió fuera de nuestro flujo"
- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:138`
  — "Lo que toca plata lo confirma una persona"
- `apps/api/CLAUDE.md:685` (código actual)
  — "Roles are **additive** since HOS-296 (`user_role`, PK `(userId, role)`). Adding"

`rg -n -i "sí mism[oa] |autoconce|actor = sujeto"` sobre el núcleo y las dos épicas no encuentra
ninguna regla sobre una acción administrativa cuyo beneficiario es el propio actor.

**Qué haría falta decidir o escribir.** Si una acción del catálogo puede tener `actor = sujeto`, y
si no, dónde se rechaza (el paso 3 es el candidato natural). Si se admite para algunas (moderar la
propia ficha no parece defendible; asentar el propio cobro menos), qué segunda firma llevan. Es
decisión del owner: hoy la única cuenta con esos permisos puede ser la suya, y el costo de la regla
es operativo.

### F-8V1A1-002 — El bypass de staff del código actual pasa el guard del invariante 13

**Qué se rompe.** El invariante 13 es *rol ≠ entitlement*, y su guard (`G6`) verifica otra cosa:
que ninguna **autorización decida** sólo por rol. El código de hoy no decide por rol: **carga** el
conjunto entero de claves para `SUPER_ADMIN`, `ADMIN`, `EDITOR` y `CLIENT_MANAGER` antes de que el
chequeo corra, así que el chequeo decide por clave y el guard da verde. El diseño nunca nombra ese
bypass, y la decisión de qué código se reutiliza está diferida a la FASE 5. Una implementación que
reutilice el cargador conserva el bypass con el guard en verde.

**El camino.**

1. Juan es `EDITOR` del sitio y además anfitrión de Alojamiento, sin suscripción.
2. El cargador del conjunto efectivo le da, por su rol, todas las claves con limits en `-1`.
3. Juan publica veinte fichas y las destaca. El paso 6 pregunta por la clave y la encuentra; el
   paso 7 cuenta contra `-1`. `G6` no ve nada porque ninguna autorización menciona el rol.
4. No hay cobro, no hay trial consumido y no hay aviso: el contrato ni siquiera se consultó para
   lo que el rol ya había resuelto.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:74`
  — "que ninguna autorización decida sólo por rol"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:304`
  — "Los pasos 5, 6 y 7 se evalúan"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:88`
  — "TRIAL | SUSCRIPCIÓN | CORTESÍA | GRANT | BASE | ADDON"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:405`
  — "Qué se reescribe y qué se reutiliza del código actual."
- `apps/api/CLAUDE.md:593` (código actual)
  — "`SUPER_ADMIN`, `ADMIN`, `EDITOR`, and `CLIENT_MANAGER` bypass entitlement"
- `apps/api/CLAUDE.md:594` (código actual)
  — "grants them the full unlimited set (all"

`rg -n -i "staff|EDITOR|CLIENT_MANAGER|INV-6"` sobre las dos épicas, el núcleo, el contrato y el
corte da cero.

**Qué haría falta decidir o escribir.** Una línea que retire el bypass por nombre (el conjunto
efectivo sale **sólo** de las seis fuentes del contrato, y un rol no es una fuente), y que `G6`
tenga una segunda mitad cuyo predicado sea el del invariante 13: ninguna construcción del conjunto
efectivo lee un rol. Si el owner quiere que el staff vea todo en su trabajo de admin, eso ya lo da
la regla 3 del cap. 17 §3.2 por acción, no por conjunto.

### F-8V1A1-003 — Las escrituras del admin fuera del catálogo: permitidas por el cap. 17, prohibidas por el núcleo

**Qué se rompe.** El cap. 17 dice que `actor ≠ sujeto` necesita *«un permiso de esa acción
concreta»*, y la superficie de admin lee *«todo, de cualquier persona»*. El núcleo dice lo
contrario para las escrituras: la que no tiene fila en el catálogo *«no tiene permiso que
pedir»*. El código actual tiene justamente esas escrituras —crear una ficha a nombre de un dueño,
editarla, el `isFeatured` manual, el hard delete del admin, restaurar— y ninguna es una de las
catorce. Dos implementadores divergen, y el que las conserva hace daño en tres lugares:

- **Publicar por el dueño consume su trial.** `PB1` dice *«el dueño publica»*, y `T1` se consume al
  ejercer el evento. Si lo ejerce el admin, el trial de por vida de Juan se va sin que él viera el
  aviso de la fila 1 del cap. 19.
- **El `isFeatured` manual destaca gratis**, sin la clave comercial *«destacarla»* y sin pasar por
  el paso 6. La columna sobrevive al corte: `B/21` §4 retira `featured_by_entitlement` y no
  la nombra.
- **El hard delete del admin no es `PB9` ni `PB12`**, así que no corre `A6`, que es la **única**
  fila que cancela el addon `LISTING` de una ficha borrada: el preapproval del destaque sigue
  cobrando sobre una ficha que ya no existe.

**El camino.**

1. Juan, dueño en `PRE_TRIAL`, le pide a soporte que le cargue la ficha. El admin la crea con el
   `ownerId` de Juan y la publica desde el panel.
2. Si la implementación siguió al cap. 17 (hay permiso de la acción), `PB1` corre, dispara `T1` y
   el trial de Juan arranca hoy sin que él lo haya decidido. No vuelve nunca.
3. Si siguió al núcleo, el admin no puede cargar ni corregir nada de ninguna ficha, y soporte
   pierde la herramienta que hoy usa.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:176`
  — "Lo que no se puede es ejecutar una escritura que no"
- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:177`
  — "una escritura sin fila no tiene permiso que pedir, no es capacidad"
- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:178`
  — "así que sus pasos 5-7 caen sobre el sujeto y la vuelven inejecutable"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:44`
  — "todo lo anterior, de cualquier persona, **como actor distinto del sujeto**"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:217`
  — "Se consume al ejercer el evento de activación o con el primer pago"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2484`
  — "es la ÚNICA fila que ejecuta el borrado de la ficha"
- `packages/schemas/src/entities/accommodation/accommodation.http.schema.ts:322` (código actual)
  — "The admin path keeps manual isFeatured control via"

Además, *«inejecutable»* es falso por su propia regla: si los pasos 5-7 caen sobre un sujeto que
paga, pasan.

**Qué haría falta decidir o escribir.** Si el admin tiene escrituras sobre la ficha ajena fuera de
las catorce (cargar, corregir, destacar a mano, borrar) y, si las tiene, cuáles son filas nuevas
del catálogo. Y dos reglas que no dependen de esa decisión: un acto del admin nunca es *«el dueño
publica»* (no dispara `T1`), y ningún borrado de ficha sale de otra fila que `PB9`/`PB12`. Lo mismo
para las lecturas del §48: qué permiso pide cada una, porque el catálogo es sólo de escrituras.

### F-8V1A1-004 — «La clave vigente» de la precisión 7 no dice cuál: un Silver puede tener página

**Qué se rompe.** Desde la decisión 7b la presencia de Partner tiene **dos** claves: la página
(sólo Gold) y el carrusel (Gold y Silver). La precisión 7 —que es la regla del paso 4 que ejecuta la
resolución única— dice que la presencia ajena existe si tiene *«la clave vigente»*, en singular, y
el cap. 18 formula la lectura de la página sobre el *«entitlement de presencia pública»*, que es el
nombre que la tabla del §1.2 **tachó**. Quien implementa el paso 4 contra el cap. 17 o la spec lee
«tiene una clave de presencia» y le abre la página propia a todo Silver.

**El camino.**

1. Juan paga Partner Silver: su conjunto efectivo tiene *«presencia en el carrusel»* y no tiene
   *«página propia»*.
2. Un turista abre `/{lang}/partners/juan/`. El paso 4 pregunta si la presencia ajena está *«con la
   clave vigente y sin moderar»*: tiene una, no está moderada, existe.
3. Juan tiene la página que sólo Gold compra, pagando Silver, en el camino principal de todo
   Silver. Ningún guard compara qué clave mira la lectura de la página.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:177`
  — "presencia de Partner **con la clave vigente y sin moderar**"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:173`
  — "Partner con la clave vigente y sin moderar. Todo lo demás contesta como inexistente."
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/18-partner.md:43`
  — "| plan | ~~presencia pública~~ página propia | **presencia en el carrusel** |"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/18-partner.md:120`
  — "el partner tiene HOY el entitlement de presencia pública (§1.2), desde el caché del conjunto"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/18-partner.md:125`
  — "(§1.2: la otorgan Gold y Silver), leída del mismo caché y con el mismo reconciliador."

**Qué haría falta decidir o escribir.** Que la precisión 7 diga **por superficie** qué clave hace
existir la presencia ajena (la página, con *«página propia»*; el carrusel, con *«presencia en el
carrusel»*), y que el cap. 18 §1.6 use el nombre de la clave que la tabla dejó en pie. Es texto, no
decisión: la decisión 7b ya está tomada.

### F-8V1A1-005 — «Hereda Turista VIP» es una columna que `G-R3` no mira y que el contrato no sabe transportar

**Qué se rompe.** El diseño declara que las dos versiones no vendibles (piso y pre-trial) son un
punto único de falla y las cubre con `G-R3`, que mira **claves**. Pero la herencia de Turista VIP no
es una clave: es una columna de `plan_version`, *«declarada en base»* para cada vertical, y sólo el
plan de trial tiene su valor escrito (no hereda). Nadie dice qué valor tienen el piso y el
pre-trial, y ningún guard lo mira. Además la herencia es la única capacidad que se resuelve en una
vertical desde **otra**, y el contrato —que responde por `user + vertical`— no tiene cómo llevar a
`cobertura(user, Turista)` la versión de Alojamiento que hereda: cada implementador arma su propio
cruce, y decide solo si cuenta el piso, el pre-trial o una fuente `COMPLEMENTO`.

**El camino.**

1. Se siembra la versión de piso de Alojamiento con la columna en verdadero (el valor por defecto
   no está escrito; basta con copiar la fila del premium al crearla).
2. Toda persona tiene la fuente `BASE` en toda vertical. La resolución de Turista, que busca en las
   otras verticales alguna versión que herede, la encuentra en cada cuenta.
3. Toda la plataforma recibe Turista VIP gratis. Y como un plan que le da VIP **bloquea la compra
   de VIP** (`DEC-ENT-003`), además nadie lo puede comprar. `G-R3` da verde porque ninguna clave
   comercial se agregó a la versión de piso.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:48`
  — "si permite pausa, si hereda Turista VIP"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/10-verticales-planes-billing-options.md:42`
  — "| 6 | hereda Turista VIP | no aplica: es el origen | declarado en base (§16) |"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:277`
  — "ninguna de las dos versiones no vendibles de una vertical otorga una clave de la"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:272`
  — "alguien le siembra una clave comercial a la de piso o a la de pre-trial"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:529`
  — "vertical distinta de la suya —la herencia de Turista VIP, las claves globales"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/15-entitlements-y-limits.md:460`
  — "mientras se los dé, **la persona no puede comprar VIP**."

`rg -n -i "VIP"` sobre el contrato da una sola línea, la histórica del §1.1.

**Qué haría falta decidir o escribir.** El valor de la columna en el piso y en el pre-trial (el
mismo razonamiento del plan de trial lleva a *«no hereda»*), una mitad de `G-R3` que lo vigile, y
cómo llega la herencia a la resolución de Turista: qué fuentes de otras verticales cuentan (sólo
`TÍTULO` que no sea `TRIAL`, parece) y quién lo pregunta. Si hace falta un campo o una consulta
nueva en la frontera, es del contrato y lo firman las dos épicas (`DEC-ARCH-006`).

## MEDIA

### F-8V1A1-006 — El guest es un actor, así que el paso 1 no rechaza a nadie y el piso le da suscribirse

**Qué se rompe.** El paso 1 pregunta *«¿hay un actor?»* y falla con *«no autenticado»*; el cap. 17
declara que el guest **es** un actor. Leído junto, el paso 1 no rechaza nunca y la escritura de un
guest llega al paso 3 y sale con 403, no con 401. El repo ya tiene este defecto con nombre: el guest
lleva un UUID real y un guard que pregunta por el id deja pasar al guest. Además el piso *«le da
respuesta al paso 5»* al guest, y el piso otorga *«contratar una suscripción»*, mientras el cap. 15
dice que el guest recibe sólo los booleanos de lectura pública. El paso 2 (correo sin verificar)
tampoco dice qué hace con alguien que no tiene correo.

**El camino.**

1. Un visitante sin cuenta llama a `POST /protected/...` para publicar la ficha de Juan.
2. El paso 1 pregunta si hay actor: hay, el guest. El paso 2 no tiene respuesta para él.
3. Según cómo se lea, sale un 403 (contra el contrato de errores, que pide 401 primero) o avanza
   hasta el paso 6 con el piso y su *«contratar una suscripción»*. No hay acceso a lo ajeno —el
   paso 4 lo corta—, pero la respuesta y el conjunto efectivo del guest quedan a gusto del que lo
   implementa.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:69`
  — "| 1 | **quién es** | ¿hay un actor? | no autenticado |"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:320`
  — "es **un actor del modelo, no la falta de uno**"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:223`
  — "Es lo que le da respuesta al paso 5 a un `TRIAL_EXPIRED`, a un `Turista Free` y a un `Guest`."
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/15-entitlements-y-limits.md:433`
  — "El visitante sin cuenta no recibe ningún entitlement medido.** De los booleanos recibe"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:309`
  — "`Turista Free` y un `Guest` **no pueden suscribirse**"

**Qué haría falta decidir o escribir.** Que el paso 1 pregunte *«¿es un actor autenticado?»* (el
guest falla ahí con 401, salvo en las lecturas públicas, que entran por la precisión 7), qué hace
el paso 2 con el guest, y sacar al guest de la población del piso o decir que su piso es otro.

### F-8V1A1-007 — El correo sin verificar bloquea hasta la lectura de lo propio y la recuperación

**Qué se rompe.** El paso 2 rechaza el correo sin verificar, *«toda operación»* corre la
resolución y ninguna está exenta, y la lectura de lo propio saltea el 5 y el 6 pero **no** el 2.
Quien cambió su correo y no verificó el nuevo (o el usuario que crea la aprobación de una
postulación, que nace sin verificar) no puede ver Mi Cuenta, ni exportar, ni traer a borrador una
ficha archivada (`PB8`), ni borrarla: justo los actos que el diseño promete para la retención.

**El camino.**

1. Juan cambia el correo de su cuenta y el correo de verificación se le va a spam.
2. Su ficha estaba archivada. Juan entra a recuperarla: el paso 2 lo rechaza en `PB8`, en la
   exportación y en la lectura de su propia ficha.
3. El reloj de inactividad sigue y los avisos de retención salen al correo sin verificar. El día
   180 `PB9` borra el contenido de una persona que intentó recuperarlo.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:70`
  — "| 2 | **estado de la persona** | ¿esta cuenta puede operar hoy? |"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:396`
  — "**Toda operación la corre**, escriba o no. No hay operación exenta."
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:419`
  — "Una lectura de lo propio pasa por **siete** pasos: todos menos el 5 y"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:514`
  — "es el hard delete** (cap. 02 §4.1): borra el contenido de esa ficha"

**Qué haría falta decidir o escribir.** Qué operaciones acepta el paso 2 con el correo sin
verificar: como mínimo reenviar la verificación y cambiar el correo; y si la lectura de lo propio,
la exportación y `PB8` entran en esa lista. Es un borrado en un camino plausible, pero con 180 días
y tres avisos por delante, por eso MEDIA.

### F-8V1A1-008 — En una vertical sin altas, la superficie manda a suscribirse a quien billing rechaza

**Qué se rompe.** La fila 21 del cap. 19 de verticales le dice *«suscribite para publicar»* a quien
no puede arrancar trial, y **nombra** entre las causas *«la vertical no admite altas»*. Pero en esa
vertical `S1` no admite suscripciones nuevas y la fila 20 de billing dice que el checkout no se
ofrece. Las dos superficies le dan a la misma persona instrucciones opuestas, y la de verticales
le ofrece algo que la autorización de billing niega.

**El camino.**

1. Gastronomía entra en discontinuación: desde el día 0 no admite altas.
2. Juan tenía un borrador ahí y aprieta Publicar. `PB1` no publica (no está cubierto y `T1` no
   dispara) y la pantalla dice que publicar pide una suscripción en esa vertical.
3. Juan va a suscribirse y el checkout le dice que la vertical ya no admite altas. No hay camino, y
   el mensaje que recibió primero es falso.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:67`
  — "ya consumió su trial, la vertical no admite altas, o el hash de su correo ya tiene fila"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:67`
  — "que la ficha **sigue en borrador** y que publicar pide una suscripción en esa vertical"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:994`
  — "la vertical que no admite altas no admite suscripciones nuevas ni sucesiones"

**Qué haría falta decidir o escribir.** Partir la fila 21 por causa: con la vertical sin altas el
mensaje es el de la fila 20 de billing (*«ya no admite altas»*, con la fecha), no *«suscribite»*.
No mueve plata ni da acceso: es una superficie que promete lo que la autorización niega.

### F-8V1A1-009 — Nada exige que la ficha objetivo de un addon `LISTING` sea del comprador

**Qué se rompe.** `A1` controla la cobertura **del comprador** en la vertical del objetivo, y la
restricción de `addon_instance` sólo pide que el objetivo corresponda al scope del producto. No hay
paso 4 escrito para la ficha objetivo: nada dice que tenga que ser **propia**. El contrato, a su
vez, pliega el delta por ficha con las fuentes **del sujeto de la operación**, así que un addon
cuyo objetivo es una ficha ajena queda inerte: cobra y no otorga. Y si un implementador arma el
delta buscando en `addon_instance` por objetivo en vez de por las fuentes del dueño, la capacidad
aparece en la ficha de otro.

**El camino.**

1. Juan, con Gastronomía paga, compra un destaque mensual y el formulario manda como objetivo el id
   de la ficha de María (un id equivocado, o uno puesto a mano en el pedido).
2. `A1` mira `cobertura(Juan, Gastronomía)`: cubierto, no es trial. La instancia nace con objetivo
   en la ficha de María y el preapproval empieza a cobrarle a Juan.
3. La ficha de María no se destaca (sus fuentes no traen el addon de Juan) y la de Juan tampoco.
   Juan paga todos los meses por nada, y nada lo detecta: la ficha objetivo existe, así que el addon
   nunca queda huérfano.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:493`
  — "el objetivo corresponde al tipo de scope del producto"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2479`
  — "en `cobertura(user, vertical del objetivo)`, ninguna fuente de clase `TÍTULO`"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:623`
  — "`LISTING` cuyo `objetivo` es la ficha de la operación."
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:628`
  — "sólo devolver el `objetivo` que ya guarda en `addon_instance`."

**Qué haría falta decidir o escribir.** Que `A1` pase el paso 4 sobre la ficha objetivo (propia, no
`PURGED` ni `MODERATED`, y de la vertical del producto), con la respuesta *«no existe»* si es ajena,
y una restricción en `addon_instance` que ate el dueño de la instancia al dueño de la ficha. Es
MEDIA porque el dinero perdido es del propio comprador y requiere un pedido mal formado.

## Ataques que intenté y el diseño resistió

- **Operar sobre otra vertical declarándola en el pedido**: la precisión 6 lee la vertical del
  recurso, la generaliza a contenido, presencia e instancia de addon, y `G2` tiene tres mitades.
- **Mover una ficha de vertical después de publicarla**: la vertical es inmutable desde el alta y lo
  vigila la mitad *(c)* de `G2`.
- **Filtrar existencia con 403 contra 404**: el paso 4 contesta *«no existe»* a ajeno, archivado e
  inexistente; la presencia sin clave o moderada contesta 404, y la migración retira el 410 de hoy.
- **Un suspendido que conserva capacidades por su addon**: el pliegue descarta `COMPLEMENTO` sin
  `TÍTULO`, y el trial no admite complementos.
- **Un suspendido que conserva VIP desde el caché de Turista**: la invalidación es por `user` en
  todas sus verticales (regla 3 del cap. 02 §3.2).
- **Un grant de dos verticales que alimenta una con el plan de la otra**: un ancla y un piso por
  vertical, y el piso cruza en el campo `piso`.
- **El trial como fuente de VIP gratis**: el plan de trial declara que no hereda.
- **Un job que otorga una cortesía**: el §3.3 del cap. 17 le prohíbe al sistema las catorce.
- **Dos publicaciones simultáneas que pasan el cupo**: los pasos 5-7 van dentro del lock por
  `user + vertical`, que `PB2` también toma.
- **El corte regalando cobertura**: no siembra trials ni suscripciones; las únicas filas de título
  son los dos grants del owner, y el orden de su escritura está fijado.

## Fuera de mi vector

- **Cancelar un addon de única vez**: la lista de invalidación del cap. 02 §3.2 dice *«se activa o
  vence un addon»*; la llegada a `CANCELLED` por `A5` (baja) no es un vencimiento. En los
  recurrentes la cubre `S21` como transición de suscripción; en los de única vez no vi qué la cubre.
  Le toca a quien ataque el caché o los addons.
- **Camino B de Partner (alta directa del admin)**: la regla *«nada se vincula hasta que la
  dirección se prueba»* del cap. 18 §2.4 está escrita para la aprobación de una postulación; no
  encontré que valga para el alta directa.
- **El dueño con la ficha en `UNPUBLISHED_BY_BILLING` tras el corte**: el cap. 21 dice que *«volver
  a publicar»* le arranca el trial, pero `PB1` sale sólo de `DRAFT` y desde ese estado no hay
  acto del dueño que la lleve a publicar. Le toca a máquinas de estado o migración.

## Key Learnings

1. El control de `actor ≠ sujeto` no dice nada del caso `actor = sujeto` con permisos de admin: con
   roles aditivos, la cuenta que se administra a sí misma es la forma más barata de saltearlo.
2. Un guard cuyo predicado es «ninguna autorización decide por rol» no ve un cargador que convierte
   el rol en claves antes de la autorización; el invariante 13 necesita su propio predicado.
3. Cuando una clave se parte en dos (la presencia de Partner en página y carrusel), las frases que
   la nombran en singular fuera de su capítulo —la precisión 7— quedan ambiguas y la ambigüedad
   se resuelve del lado caro.
4. Un punto único de falla vigilado por claves no cubre las capacidades que viven en columnas de la
   misma versión (la herencia de VIP).
5. Las superficies de dos épicas que describen la misma pantalla (suscribirse en una vertical sin
   altas) pueden contradecirse aunque cada una sea coherente con su propia épica.

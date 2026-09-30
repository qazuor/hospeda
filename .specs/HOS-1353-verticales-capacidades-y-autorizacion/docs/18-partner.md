---
title: Master Spec 18 — Partner
linear: HOS-1353
statusSource: linear
created: 2026-09-17
updated: 2026-09-30
status: CURRENT
fase: 2
capitulo: 18
cierra:
  - A-PARTNER-01
  - M-PARTNER-01
---

# 18 · Partner

El §17 es terminante: Partner *«usa el mismo motor de trial, plans, billing, subscriptions,
entitlements, limits, promo, courtesy, addons»* y *«difiere sólo en su funcionalidad
específica»*. El capítulo 10 §1 ya ubicó esa diferencia dentro de la lista cerrada del Eje 2: no
tiene trial, no es self-service, y lo que publica no es una ficha.

Quedan dos huecos, y los dos salen de lo mismo: **medio PDR está escrito sobre fichas, y Partner
no tiene.**

---

## 1. Qué cuentan los limits de Partner · cierra `A-PARTNER-01`

### 1.1 El problema

El §17.1 dice que Partner Gold *«puede contar con página propia»*, que es *«una presencia pública
similar funcionalmente a una ficha»*, y ordena expresamente **no forzar la entidad Partner dentro
del modelo Listing** por esa semejanza.

Pero el §12 dice que una suscripción cubre todas las fichas de la vertical y que *«la cantidad se
controla mediante limits»*; el §40 define el scope `LISTING`; el §10.5 limita a una ficha durante
el trial. Los tres hablan de algo que Partner no tiene.

### 1.2 «Cuántas presencias» no es un limit: es un entitlement booleano

La presencia es **cero o una**, y lo que decide cuál es **el plan**, no un número:

| plan | ~~presencia pública~~ página propia | **presencia en el carrusel** |
|---|---|---|
| **Gold** | sí | **sí** |
| **Silver** | no | **sí** |
| los demás | no | no |

*(La tabla tenía una sola columna, *«presencia pública»*, y leída a la letra sacaba a Silver del
carrusel **también cuando paga** —lo único que compra—, o lo dejaba sin regla. **El carrusel es una
clave propia, *«presencia en el carrusel»*, que otorgan Gold y Silver**, con el mismo caché y el
mismo reconciliador que la página (§1.6) — owner 2026-09-25; FASE 9 completa, decisión 7b.)*

Modelarlo como un limit —*«máximo 1 presencia»*— invita a preguntar qué pasaría con 2, y la
respuesta es que no es una cantidad: es una capacidad que se tiene o no se tiene. **Es un
entitlement booleano**, y encaja sin excepciones en la resolución del capítulo 15.

### 1.3 Lo que los limits de Partner sí cuentan

**Cuentan lo que hay ADENTRO de la presencia**: fotos, secciones, enlaces — lo mismo que un limit
cuenta dentro de una ficha, donde tenga sentido.

No hace falta regla nueva: el capítulo 10 §1, ítem 4 del Eje 2, ya dice que **cada vertical
declara qué claves tienen sentido en ella**. Partner declara su subconjunto, y *«máximo de
fichas»* simplemente no está en él. Una clave que una vertical no declara no vale cero: **no
existe para esa vertical**.

### 1.4 Un addon de scope `LISTING` no es compatible con Partner, y eso no es un caso especial

El §39 hace que cada producto de addon declare sus *«compatible verticals»*. Un producto de scope
`LISTING` **no lista a Partner**, y con eso alcanza: la incompatibilidad es **un dato**, no una
rama de código que alguien tenga que escribir ni un control que pueda olvidarse.

**Y no hace falta un quinto scope para la presencia.** Un addon que agrande la presencia —*«+10
fotos en mi página»*— usa **`VERTICAL_SUBSCRIPTION`**, y es exacto: como Partner tiene **una sola
presencia por suscripción**, ese scope la identifica sin ambigüedad. **Y ahora lo garantiza la
base**: una cuenta es dueña de un solo Partner, por una unicidad sobre `owner_user_id` (cap. 02
§2.7; regla 5 del §2.4), así que la suscripción de `user + Partner` enciende una sola presencia
(FASE 9 vuelta 3, owner 2026-09-30, lote B). El §40 dice *«como mínimo»*
cuatro scopes, así que agregar uno sería legítimo; no se agrega porque no hace falta.

### 1.5 Y el §10.5 no se cruza HOY

*«Máximo una ficha durante trial»* no alcanza a Partner por una razón anterior: **Partner no tiene
trial.** Sus planes lo tienen en cero (`DEC-TRIAL-003`) y no declara evento de activación
(`DEC-TRIAL-006`).

**La garantía se escribe sobre las ~~TRES~~ ~~CUATRO~~ TRES salidas de `PRE_TRIAL`** (revisión del owner, 2026-09-28, N7: `T7` salió)**, no sobre `T1` sola.** Razonar por
enumeración con la enumeración corta es exactamente cómo una garantía se vuelve falsa sin que
nadie la toque: `T1` y `T6` comparten el evento de activación —que Partner no declara—, ~~`T7`
espera **el encendido**, que todavía no ocurrió,~~ **y `T8` —desde la FASE 9 completa, 6c— pide días
de trial > 0 y el evento ya ejercido** (`V/03` §2). Ninguna de las ~~tres~~ ~~cuatro~~ tres puede ocurrir, y
**la razón es la configuración de hoy, no una propiedad de Partner**: ~~las tres~~ ~~las cuatro~~ las tres dependen de dos
números y una declaración (FASE 9 vuelta 1, `F-8V1A2-010`) que ~~`DEC-TRIAL-003` planifica cambiar~~
**esta versión no deja cambiar**: el panel no pasa los días de prueba de una vertical de 0 a más de
0 (revisión del owner, 2026-09-28, N7; cap. 11 §8).

~~Dos párrafos decían qué pasaba el día que Partner encendiera su trial: el procedimiento del
cap. 11 §8 (declarar el evento, publicar la versión con días > 0 y ejecutar `T7` en un solo acto),
a quiénes alcanzaba `T7`, y que un partner dado de alta por el camino B no tenía el hecho de la
postulación, así que la declaración del evento tenía que decir qué contaba para él.~~ **Salen con
`T7`** (revisión del owner, 2026-09-28, N7): Partner no enciende su trial en esta versión.

### 1.6 La presencia no tiene máquina de estados: la lectura pregunta por el entitlement

FASE 8 completa, racimo `R13`: `F-8CA1-005`, `F-8CA2-005`, `F-8CA3-006`, `F-8CA2-012`,
`F-8CA1-014`; owner 2026-09-25.

**El hueco**: este capítulo decía que el ciclo de publicación de la presencia era del capítulo 19,
y el 19 decía que era de éste. Ninguno lo tenía, así que **un Gold que dejaba de pagar, o que
bajaba a Silver, seguía publicado**: `PB2` es de fichas (cap. 03 §9) y el reconciliador de
excedentes trabaja con limits (cap. 15 §4.2), y la presencia no es ninguna de las dos cosas —es el
entitlement booleano del §1.2—.

> **La página propia de Partner Gold no tiene máquina de estados. La lectura pública pregunta si
> el partner tiene HOY el entitlement ~~de presencia pública~~ **«página propia»** (§1.2; FASE 9 vuelta 1, `F-8V1A1-004`), desde el caché del conjunto
> efectivo que ya existe (cap. 02 §3), y si no lo tiene responde que no existe: 404.**

**Y la misma regla gobierna el carrusel, con su propia clave** (owner 2026-09-25; FASE 9 completa,
decisión 7b). El carrusel de la home lista **a quien tiene hoy la clave *«presencia en el
carrusel»*** (§1.2: la otorgan Gold y Silver), leída del mismo caché y con el mismo reconciliador.
Es una clave de clase `COMERCIAL` (cap. 15 §3.4): produce presencia pública. Sin ella el carrusel
no tenía regla —`rg` de *«carrusel»* sobre las dos épicas, el núcleo, el contrato y el log daba
cero— y un Silver que dejaba de pagar seguía en la home.

**Y las dos se ven sólo si la presencia no está moderada** (owner 2026-09-25; FASE 9 completa,
decisión 7c). La presencia lleva **un bit de moderación**, escrito **sólo** por la misma acción
administrativa que `PB10` y `PB11` —moderar o levantar la moderación, con motivo (`NUCLEO/08` §3)—,
y la lectura pasa a ser *«tiene la clave **y** no está moderada»*. **Sigue sin haber máquina**: es
una condición más en la lectura, y el bit se lee en vivo, no desde el caché. **Y no tiene los dos
niveles de la moderación de fichas** (`V/03` §9, *«la moderación en dos niveles»*): la presencia
se modera o no, sin pedido de arreglo (revisión del owner, casos vecinos, 2026-09-29, caso 14). Sin él, la única forma
de bajar una página por contenido inadecuado era **cancelarle la suscripción** —mover plata para
moderar—, que es lo que el código de hoy evita a propósito al revocar sin tocar el cobro.

- **El contenido se conserva.** No se baja, no se archiva y no se borra nada: lo único que cambia
  es la respuesta de la lectura.
- **Lo que hoy archiva la presencia sale con el cobro viejo** (FASE 5, owner 2026-09-30, lote 1 D,
  `F5-U1-044`, `F5-API-016`). `U1` borra las columnas de pago de `partners` (~~entre ellas
  `subscription_status`, y `plan_id` y `subscription_id`, que llevan las FK~~ **las seis:
  `subscription_status`, `plan_id`, `subscription_id`, `unpaid_notice_sent_at`,
  `payment_review_state` y `payment_confirmed_through`**; `plan_id` y `subscription_id` llevan las
  FK; **`starts_at` y `ends_at` quedan hasta `V7`**: FASE 5, lote de la aplicación, owner
  2026-09-30, H; **y `V7` las borra con su migración, junto con sus lectores del panel**: FASE 5,
  lote de la aplicación, segunda tanda, owner 2026-09-30, O; **y en la misma migración, `tier` con
  su índice, y sus lectores —la página pública y las tres rutas del socio— pasan a leer la
  clave**: FASES 6 y 7, pase de la FASE 6, owner 2026-09-30, J; FASES 6 y 7, verificación, 2026-09-30, F7), sus FK a tablas del cobro viejo, y los tres crons de partner
  (`partner-expiry` y `partner-unpaid-reaper`, que la archivan, y `partner-payment-review`). **Desde
  `U1` hasta `V7` la lectura pública no muestra ninguna presencia**: la que la vuelve a mostrar es
  la regla de este §, que construye `V7`. No tiene población: hoy Partner tiene cero filas.
- **Si vuelve a Gold, la página reaparece sola**, sin ninguna transición: la próxima lectura
  encuentra la clave en el conjunto efectivo.
- **404 y no otra respuesta**: un partner que no tiene la clave —**o cuya presencia está moderada**,
  7c— es indistinguible desde afuera de
  uno que no existe, que es la precisión 1 del paso 4 del cap. 17 §1.2 —y su precisión 7: lo ajeno
  existe sólo en estado público (FASE 9 completa, 8c)—. El código de hoy responde
  410 al partner revocado, y la migración lo cambia (`V/21` §4; `F-8CA1-014`).
- **La invalidación la llevan el aviso y el reconciliador diario** (`DEC-ARCH-009`). El aviso
  alcanza los casos de este hueco sin nada nuevo: toda transición de la suscripción y todo cambio
  de plan invalidan la entrada del `user + vertical` (cap. 02 §3.2), así que el Gold que pasa a
  `SUSPENDED` y el que baja a Silver dejan de tener la clave en la próxima lectura. **Y si el aviso
  se pierde, o la fuente vence por fecha sin transición**, la red es el reconciliador diario de
  cobertura, que desde esta decisión incluye a cada partner ~~con presencia cargada~~ **con una clave
  de presencia** —la página o el carrusel (FASE 9 completa, 7b)—: resuelve en
  vivo ~~el entitlement~~ las claves, las compara con el caché y, si no coinciden, invalida (cap. 03 §9, con hasta
  un día de atraso).

**Por qué alcanza sin máquina**: la visibilidad de la página es exactamente *«¿el conjunto efectivo
otorga la clave?»* —**y, desde la FASE 9 completa, *«y no está moderada»***, 7c—, y esa pregunta ya tiene dueño, fuente y caché. Lo que faltaba no era un estado:
era que alguien la hiciera en la lectura.

> ⚠️ **Lo que esto NO cierra, declarado con su causa por `DEC-METH-015`** (ninguno mueve plata en
> el camino principal, da acceso indebido ni borra datos):
>
> 1. **La presencia no tiene reloj de retención.** No tiene `inactiva_desde` ni ninguna fila de
>    `PB4`/`PB5`/`PB9` que la alcance, así que el contenido de un partner que dejó de ser Gold se
>    conserva sin fin (`F-8CA3-006`). La decisión dice que se conserva; hasta cuándo no. **Salvo que pida la baja**: la acción 25 la vacía en la baja de cuenta manual (`NUCLEO/08` §1.3 y §3; verificación corta, 2026-09-29, lote N-G).
> 2. **Cerrado** (revisión del owner, 2026-09-28, N7): **el contenido de la presencia vive en la
>    tabla de partners de hoy** (`partners`; cap. 02 §2.7, fila `partner`), y **el bit de moderación
>    es una columna de esa tabla**. La retención de la presencia (punto 1) sigue declarada. Lo que
>    decía:
>    **La entidad del contenido de la presencia no está declarada en el cap. 02 §2.5**, que declara
>    sólo `listing` (`F-8CA3-006`). ~~La regla de arriba no la necesita —lee el entitlement, no el
>    contenido—, pero el modelo no está escrito.~~ **La regla de la lectura no la necesita —lee el
>    entitlement—, pero la población del reconciliador y el bit de moderación sí** (FASE 9 completa,
>    contradicción 3 del informe `08`; decisión 7c): hasta que la entidad se declare, la población
>    se lee como *«todo `user + Partner` cuya entrada del caché otorga una clave de presencia, o que
>    tiene en Partner una fuente de clase `TÍTULO`»* (cap. 03 §9), y **el bit de moderación es una
>    columna de esa entidad que el modelo todavía no escribe**. La migración del bit no tiene
>    población: hoy Partner tiene cero filas (medido en el inventario de hechos del programa).
> 3. **Entre la pérdida de la clave y la invalidación**, si el aviso se pierde, la página sigue
>    visible hasta la corrida siguiente del reconciliador: hasta un día, el costo que
>    `DEC-ARCH-009` aceptó.
> 4. **El caché de la respuesta, no el de entitlements** (FASE 9 completa, `B3` del informe `08`;
>    declarado por `DEC-METH-015`, FASE 9 completa). La página pública se sirve desde el caché del
>    borde, y la invalidación de este § vacía el del conjunto efectivo, no ése. Como no hay escritura
>    que dispare una purga, la bajada se ve con hasta la duración de su clase de caché de atraso (hoy
>    ~2 h), además del día del punto 3. **Causa**: la regla cambia la respuesta y no escribe nada. No
>    mueve plata, no da acceso a ninguna persona y no borra nada. *(Con el bit de moderación sí hay
>    una escritura: purgar el borde en ese acto es libertad de implementación.)*

---

## 2. El ciclo de vida de la postulación · cierra `M-PARTNER-01`

### 2.1 Sí es una entidad con estados propios, y es la novena máquina

El §63 pide ocho máquinas y el capítulo 03 las tiene. Ésta es la novena **al agregarse** —hoy son
**diez**, con el reembolso (`NUCLEO/01` §2; owner 2026-09-25, FASE 9 completa, decisión 5a): el
ordinal *«novena»* es de cuándo se agregó, no una cuenta que este § recuente—, y se agrega al
núcleo en vez de declararse acá — **`postulacion` está en el capítulo 01 §2.2 y sus transiciones en
el capítulo 03 §11**.

Se agrega porque tiene lo que define a una máquina: estados con reglas de movimiento que hay que
impedir. La alternativa —leerla de dos fechas, como se hizo con la vertical en el capítulo 10
§4.6— no alcanza acá: hay una decisión humana en el medio, y *«aprobada»* y *«rechazada»* no son
el mismo dato con distinto signo.

**Es una entidad propia, no la lista de postulaciones de hoy** (FASE 5, owner 2026-09-30, lote 4
A, `F5-SUP-006`, `F5-AUT-018`). El código ya tiene una, `alliance_leads`, con un formulario
público, cuatro estados y un campo que mezcla a Partner con otros tipos (patrocinadores, editores,
proveedores). **`V7` crea `postulacion` (cap. 02 §2.7) sólo para Partner**, con la restricción de
la base, el captcha y la excepción de la cadena de `PP1`, y **`alliance_leads` queda para los otros
tipos, fuera de este programa**. Hoy hay cero partners, así que nada migra de una a la otra.

### 2.2 Se puede volver a postular, con una espera

**Un rechazo no es definitivo.** Las circunstancias de un negocio cambian, y un rechazo
permanente convierte una decisión de un día en una condena.

**Pero hay una espera configurable entre un rechazo y una postulación nueva** (§9: es
configuración, no una constante). Sin ella, rechazar no cierra nada: la postulación vuelve al día
siguiente y el panel del admin se convierte en un bucle.

**Y la espera nunca bloquea al admin**: el camino B del §17.3 —alta directa— no pasa por la
postulación, así que si el admin cambia de opinión, la da de alta y listo. La espera acota al que
insiste, no al que decide.

**Y el admin puede anular una espera** (owner 2026-09-27, FASE 9 vuelta 2, `R7`; `F-8V2A2-005`).
El formulario es público y la guarda mira un correo que nadie probó: un tercero que carga la
dirección de otro negocio le ocupa el lugar con una `PENDIENTE`, y cuando el admin rechaza esa
basura le arranca la espera al dueño real. Anularla deja que el dueño real se postule por el
camino A. Es la misma acción administrativa que aprueba y rechaza (`NUCLEO/08` §3), sobre la
misma postulación y con el mismo permiso, así que no suma una fila al catálogo.

**Y la guarda es una restricción de la base, no un chequeo** (owner 2026-09-27, FASE 9 vuelta 2,
`R7`). Como chequeo, dos envíos simultáneos del mismo correo pasaban los dos y dejaban dos
`PENDIENTE`, y aprobadas, dos filas de Partner. La forma está en el cap. 02 §2.7.

### 2.3 Una postulación pendiente no vence: se pone visible

**Nada rechaza una postulación por el paso del tiempo.** Un vencimiento automático es un rechazo
silencioso —nadie la miró y la persona recibe un no—, y el §17.3 exige que un rechazo **se
comunique**.

Lo que sí pasa: **pasados N días sin resolverse aparece marcada como atrasada** en el panel del
§48. Falla hacia que alguien la vea, nunca hacia contestar por omisión.

### 2.4 El correo que ya pertenece a otra persona · el borde que el §17.3 no cubre

El §17.3 dice, en su paso 5, *«comprobar si existe User Hospeda con el email»* y en el 6 qué
hacer **si no existe**. No dice qué hacer si existe — y el formulario de postulación es público,
así que **cualquiera puede escribir cualquier dirección**.

**La regla: la postulación no vincula nada hasta que la dirección se prueba.**

| caso | qué pasa al aprobar |
|---|---|
| el correo **no** corresponde a ningún usuario | se crea el usuario y se le manda la validación — el §17.3 tal cual |
| el correo **sí** corresponde a un usuario | se le manda **a esa dirección** un aviso para que reclame el Partner, y **nada se vincula hasta que alguien con acceso a ella lo haga** **—con sesión, y a la cuenta con que la inició (abajo; owner 2026-09-27, FASE 9 vuelta 2, `R7`)—** |

**La única prueba de que el postulante es dueño de la dirección es que pueda leerla**, y es la
misma prueba que el §17.3 ya exige en la otra rama. Acá se aplica a la que quedó sin escribir.

Sin esto, cargar el correo de un tercero alcanza para colgarle un Partner que no pidió — o, peor,
para que quien apruebe crea que lo pidió.

**Quién postula.** El formulario es público y un visitante sin cuenta postula (cap. 17 §1.2
precisión 9; `DEC-AUTH-005`). **Una cuenta con sesión y el correo sin verificar, en cambio, no
postula como si no tuviera cuenta: se le pide verificar el correo antes** (cap. 19 §4 fila 34;
FASE 9 vuelta 3, owner 2026-09-30, lote AJ; verificación, VC3-VT-10).

**Leer la casilla prueba la casilla, no la cuenta** (owner 2026-09-27, FASE 9 vuelta 2, `R7`;
`F-8V2A1-003`). La regla vinculaba al usuario *que ya tenía ese correo*, verificado o no, y ese
usuario podía ser una cuenta que otro creó con esa dirección sin poder verificarla: la dueña de la
casilla reclamaba, el Partner quedaba en la cuenta del ocupante, y el ocupante se cambiaba el
correo y se lo llevaba. ~~Tres~~ Cinco reglas lo cierran (las dos últimas, FASE 9 vuelta 3, owner
2026-09-30, lotes A y B; `DEC-AUTH-004`):

1. **El reclamo exige sesión y vincula a la cuenta que reclama.** El link llega a la casilla, y
   quien lo abre inicia sesión en su cuenta, que es la que queda en `owner_user_id`. Nunca se
   vincula a una cuenta por tener la dirección.
2. **Si la cuenta que reclama es la de ese correo y no lo tiene verificado, el reclamo lo
   verifica**: el link llega sólo a quien lee la casilla, y esa persona es la de la sesión. Si
   reclama desde otra cuenta, la cuenta con esa dirección no se toca: nada prueba que la
   controle quien leyó el link. **Y al verificarla, el reclamo cierra todas sus sesiones y
   credenciales previas** (FASE 9 vuelta 3, owner 2026-09-30, lote A; `F-8V3A1-001`): queda viva
   sólo la sesión del reclamo y la credencial con que se abrió; toda otra sesión se cierra, y
   toda otra credencial se borra: la contraseña, si la sesión no se abrió con ella, y las cuentas
   vinculadas (Google, Facebook) que no la abrieron, con la misma capacidad con que la baja de
   cuenta borra las credenciales (`NUCLEO/08` §3, acción 24). La cuenta podía ser de un ocupante que la
   creó con esa dirección sin poder verificarla, y la dueña de la casilla entró recuperando el
   acceso: sin esto el ocupante seguía adentro con su sesión y, con el correo ya verificado, la
   regla 3 no lo frenaba.
3. **Un correo nunca verificado no se cambia llevándose vínculos.** Una cuenta con un vínculo de
   Partner y el correo sin verificar no puede cambiar el correo: el paso 2 del cap. 17 §1.2 la
   deja verificarlo, no cambiarlo. **El cambio se rechaza mientras haya vínculo, y la pantalla lo deriva a
   soporte** (owner 2026-09-27, FASE 9 vuelta 2, `R7-b`): quien escribió mal su correo lo corrige
   con una persona que puede verificar quién es, y el vínculo no se suelta en silencio.
4. **El reclamo escribe `owner_user_id` sólo si está nulo, y el link de reclamo es de un solo
   uso** (FASE 9 vuelta 3, owner 2026-09-30, lote A; `F-8V3A1-002`). Lo gasta el primer reclamo
   que escribe el vínculo: desde ahí el vínculo ya no es nulo, así que el link no tiene nada que
   escribir y no hace falta otra marca. **Un Partner ya reclamado no se reclama de nuevo por
   link**: quien abre un link ya usado ve que ese Partner ya tiene dueño, y la pantalla lo deriva
   a soporte: *«este Partner ya tiene dueño; si no fuiste vos, escribinos a soporte»* (FASE 9
   vuelta 3, owner 2026-09-30, lote AG). Sin esto, cualquiera que leyera el aviso después (una
   casilla compartida, un ex
   empleado) movía el Partner a su cuenta, y la dueña seguía pagando una suscripción sin página.
   **Y el link lleva un secreto de un solo uso que viaja sólo en el aviso** (FASE 9 vuelta 3, owner 2026-09-30, lote AA): lo
   genera el acto que manda el aviso, al azar y sin derivarse del id del Partner ni del correo, y
   la base guarda sólo su hash (`partner.secreto_de_reclamo`, cap. 02 §2.7), nunca el secreto. Un
   link con el secreto equivocado, o sin él, contesta lo mismo que uno de un Partner que no
   existe. ~~El reclamo que escribe el vínculo vacía la columna, así que el mismo secreto no vuelve a
   servir.~~ **El reclamo que escribe el vínculo conserva el hash, y el secreto sólo reclama con
   `owner_user_id` nulo** (FASE 9 vuelta 3, owner 2026-09-30, lote AG; verificación, VC3-VT-01):
   con el vínculo ya escrito, el mismo secreto no vuelve a reclamar. **Un link ya usado, con el
   secreto correcto, muestra la pantalla de arriba; con uno equivocado o sin él, contesta como un
   Partner que no existe.** Vaciar la columna hacía que el link usado contestara *«no existe»*, que
   es lo contrario de la pantalla que el owner aprobó, y sólo quien tiene el secreto aprende que
   ese Partner ya tiene dueño. Sin el secreto, leer la casilla no probaba nada: cualquiera que
   armara el link con el id
   del Partner lo reclamaba.
5. **Una cuenta, un Partner** (FASE 9 vuelta 3, owner 2026-09-30, lote B; `F-8V3A2-002`). La base
   no deja que una cuenta sea dueña de dos: una unicidad sobre `owner_user_id` donde no es nulo
   (cap. 02 §2.7). **El reclamo de un segundo Partner desde una cuenta que ya es dueña de uno se
   rechaza, y la pantalla lo deriva a soporte**: el segundo negocio se reclama con otra cuenta. El
   link no se gasta, porque el vínculo no se escribió. Sin esto, la suscripción es por `user +
   vertical` y un Gold encendía todas las presencias de la cuenta pagando una.

### 2.5 El usuario fantasma es inofensivo, porque la suscripción va última

El hueco lo nombra: *«queda un Partner aprobado con un usuario fantasma»* si nunca valida ni
completa el perfil. **No pasa nada, y ésa es la propiedad que hay que preservar deliberadamente:**

**el orden es aprobar → reclamar la cuenta → configurar plan y método → recién ahí la
suscripción.** Es el orden del §17.3, y el paso 8 —*«enviar link para completar
subscription/pago»*— es el último de los nueve.

De ahí sale que un Partner sin reclamar **no publica nada y no se le cobra nada**: no hay
presencia publicada porque no hay quién la cargue, y no hay suscripción porque nadie autorizó un
débito. Lo único que existe es una fila.

**Y ~~aprobar asigna~~ el rol de socio se da en el acto que fija al dueño de la presencia** (FASE
5, owner 2026-09-30, lote 4 B, `F5-AUT-025`, contra la recomendación; **a qué cuenta y en qué
acto: FASE 5, lote de la aplicación, owner 2026-09-30, F**): **el reclamo** (§2.4), que lo da a la
cuenta con que se reclama~~, **o el alta directa del admin con dueño** (camino B)~~; **no al aprobar
la postulación**. **El alta directa del admin (camino B) no fija dueño: crea el Partner con
`owner_user_id` nulo, manda el aviso de reclamo, y el rol llega con el reclamo**, como en el camino
A; `owner_user_id` lo sigue escribiendo sólo el reclamo (cap. 02 §2.7) (FASE 5, lote de la aplicación, segunda tanda, owner 2026-09-30, N). Es un rol nuevo con su familia de operaciones y sus permisos, y llega con su
migración de datos; el paso 3 de la cadena pregunta por esa familia en toda operación del dueño de
un Partner (cap. 17 §1.2). **No se quita** cuando el socio pierde la página o el carrusel: perder
el acceso nunca revoca un rol (cap. 17 §4.1). ~~⚠️ **A qué cuenta se asigna no está decidido**:
aprobar no conoce la cuenta del dueño hasta el reclamo (§2.4), y el camino B no aprueba ninguna
postulación; vuelve al owner (`HOS-1352/docs/38-fase-5/14-aplicacion-verticales-capitulos.md` §5).~~
Darlo al aprobar lo recibía la cuenta que tiene el correo, y no la que reclama: Juan postula con
`juan@almacen.com`, una cuenta vieja con ese correo es de otra persona, y Juan, que reclama desde
la suya, quedaba dueño sin el rol.

**No vence, y queda visible.** Igual que la pendiente del §2.3: aparece como no reclamada en el
panel ~~y el admin puede darla de baja~~ y no se da de baja: es inofensiva y ninguna fila la saca
de ahí (FASE 9 vuelta 1, `F-8V1A2-005`). Un vencimiento automático no evitaría ningún daño —no hay
ninguno— y agregaría un estado más.

---

## 3. Lo demás de Partner no es de Partner

Vale la pena cerrar con esto porque es el §17 y es lo que este capítulo **no** contiene:

el alta y la autorización de la suscripción, el cambio de plan, la pausa, el grace, la
cancelación, el cobro, el reembolso, los promo codes, las cortesías, los grants, la resolución de
entitlements y limits, la conciliación, la auditoría, el outbox y la retención **son idénticos a
los de cualquier otra vertical**. Están en los capítulos que les corresponden y no tienen variante
Partner.

Los pagos manuales del §17.2 tampoco son una excepción: son un **método de pago declarado por
plan**, y el propio §17.2 lo dice con su advertencia textual —*«No: `if partner -> cash`»*—. Que
hoy sólo los use Partner es un hecho de la configuración, no del diseño.

---

## Lo que este capítulo NO cierra

- ~~**El ciclo de publicación de la presencia** es del capítulo 19: acá está que existe, que la da
  el plan Gold y que no es una ficha.~~ **La presencia no tiene ciclo de publicación: lo cierra el
  §1.6**, y el capítulo 19 remite acá (FASE 8 completa, `R13`, owner 2026-09-25). Lo que el §1.6
  deja declarado con su causa está en su ⚠️. **Y el carrusel y la bajada deliberada del admin
  tampoco**: el carrusel lee su propia clave y la presencia moderada no se ve (§1.6; FASE 9 completa,
  7b y 7c).
- **Cómo se registra un pago manual** es del capítulo 13 (épica de billing).
- **Si algún día Partner enciende su trial** (fuera de esta versión: el panel no deja pasar sus
  días de 0 a más de 0, revisión del owner, 2026-09-28, N7), tiene que declarar su evento de activación
  (`DEC-TRIAL-003`, implicación 1), y ahí el §10.5 pasa a alcanzarlo. **Cuál** es ese evento sigue
  abierto, y **qué hay que hacer ese día también**: el procedimiento del capítulo 11 §8 y `T7`
  salieron con el encendido (revisión del owner, 2026-09-28, N7); se diseña si algún día hace falta.
- **La lista de aprobadas sin reclamar sólo crece** (FASE 9 vuelta 1, `F-8V1A2-005`). **Causa**:
  no hay daño que evitar (§2.5), y una baja sería un estado más.

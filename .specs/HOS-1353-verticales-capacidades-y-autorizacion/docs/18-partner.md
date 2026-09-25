---
title: Master Spec 18 — Partner
linear: HOS-1353
statusSource: linear
created: 2026-09-17
updated: 2026-09-17
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

| plan | presencia pública |
|---|---|
| **Gold** | sí |
| los demás | no |

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
presencia por suscripción**, ese scope la identifica sin ambigüedad. El §40 dice *«como mínimo»*
cuatro scopes, así que agregar uno sería legítimo; no se agrega porque no hace falta.

### 1.5 Y el §10.5 no se cruza HOY

*«Máximo una ficha durante trial»* no alcanza a Partner por una razón anterior: **Partner no tiene
trial.** Sus planes lo tienen en cero (`DEC-TRIAL-003`) y no declara evento de activación
(`DEC-TRIAL-006`).

**La garantía se escribe sobre las TRES salidas de `PRE_TRIAL`, no sobre `T1` sola.** Razonar por
enumeración con la enumeración corta es exactamente cómo una garantía se vuelve falsa sin que
nadie la toque: `T1` y `T6` comparten el evento de activación —que Partner no declara— y `T7`
espera **el encendido**, que todavía no ocurrió (`V/03` §2). Ninguna de las tres puede ocurrir, y
**la razón es la configuración de hoy, no una propiedad de Partner**: las tres dependen de dos
números y una declaración que `DEC-TRIAL-003` planifica cambiar.

**El día que Partner encienda su trial, el §10.5 pasa a alcanzarlo y el procedimiento ya está
escrito**: capítulo 11 §8 — declarar el evento, publicar la versión con días `> 0` y ejecutar
`T7`, los tres como **un solo acto**. Para Partner el candidato a evento de activación es la
aprobación del admin (`DEC-TRIAL-003`, implicación 1), así que `T7` alcanzaría a ~~**los partners ya
aprobados**~~ **los partners que ya ejercieron el hecho que se declare**, que es lo correcto: ya fueron clientes y no les corresponde estrenar el trial el día
que se enciende.

**Y eso no son todos los partners ya aprobados** (FASE 8 completa, `F-8CA2-012`, owner
2026-09-25). `T7` busca en el registro el hecho declarado (`V/03` §2), y **el camino B del §17.3
—alta directa del admin— no pasa por la postulación** (§2.2): si el hecho que se declare es la
aprobación de la postulación (`PP2`, cap. 03 §11), un partner del camino B no lo tiene, y `T7` no
lo alcanza. **Hoy no cambia nada**, porque los días están en cero y ninguna de las tres salidas de
`PRE_TRIAL` puede ocurrir; **es una condición del encendido**: el paso 1 del cap. 11 §8.3 —declarar
el evento— tiene que decir también qué cuenta como *«ya ejerció»* para un partner del camino B.

### 1.6 La presencia no tiene máquina de estados: la lectura pregunta por el entitlement

FASE 8 completa, racimo `R13`: `F-8CA1-005`, `F-8CA2-005`, `F-8CA3-006`, `F-8CA2-012`,
`F-8CA1-014`; owner 2026-09-25.

**El hueco**: este capítulo decía que el ciclo de publicación de la presencia era del capítulo 19,
y el 19 decía que era de éste. Ninguno lo tenía, así que **un Gold que dejaba de pagar, o que
bajaba a Silver, seguía publicado**: `PB2` es de fichas (cap. 03 §9) y el reconciliador de
excedentes trabaja con limits (cap. 15 §4.2), y la presencia no es ninguna de las dos cosas —es el
entitlement booleano del §1.2—.

> **La página propia de Partner Gold no tiene máquina de estados. La lectura pública pregunta si
> el partner tiene HOY el entitlement de presencia pública (§1.2), desde el caché del conjunto
> efectivo que ya existe (cap. 02 §3), y si no lo tiene responde que no existe: 404.**

- **El contenido se conserva.** No se baja, no se archiva y no se borra nada: lo único que cambia
  es la respuesta de la lectura.
- **Si vuelve a Gold, la página reaparece sola**, sin ninguna transición: la próxima lectura
  encuentra la clave en el conjunto efectivo.
- **404 y no otra respuesta**: un partner que no tiene la clave es indistinguible desde afuera de
  uno que no existe, que es la precisión 1 del paso 4 del cap. 17 §1.2. El código de hoy responde
  410 al partner revocado, y la migración lo cambia (`V/21` §4; `F-8CA1-014`).
- **La invalidación la llevan el aviso y el reconciliador diario** (`DEC-ARCH-009`). El aviso
  alcanza los casos de este hueco sin nada nuevo: toda transición de la suscripción y todo cambio
  de plan invalidan la entrada del `user + vertical` (cap. 02 §3.2), así que el Gold que pasa a
  `SUSPENDED` y el que baja a Silver dejan de tener la clave en la próxima lectura. **Y si el aviso
  se pierde, o la fuente vence por fecha sin transición**, la red es el reconciliador diario de
  cobertura, que desde esta decisión incluye a cada partner con presencia cargada: resuelve en
  vivo el entitlement, lo compara con el caché y, si no coinciden, invalida (cap. 03 §9, con hasta
  un día de atraso).

**Por qué alcanza sin máquina**: la visibilidad de la página es exactamente *«¿el conjunto efectivo
otorga la clave?»*, y esa pregunta ya tiene dueño, fuente y caché. Lo que faltaba no era un estado:
era que alguien la hiciera en la lectura.

> ⚠️ **Lo que esto NO cierra, declarado con su causa por `DEC-METH-015`** (ninguno mueve plata en
> el camino principal, da acceso indebido ni borra datos):
>
> 1. **La presencia no tiene reloj de retención.** No tiene `inactiva_desde` ni ninguna fila de
>    `PB4`/`PB5`/`PB9` que la alcance, así que el contenido de un partner que dejó de ser Gold se
>    conserva sin fin (`F-8CA3-006`). La decisión dice que se conserva; hasta cuándo no.
> 2. **La entidad del contenido de la presencia no está declarada en el cap. 02 §2.5**, que declara
>    sólo `listing` (`F-8CA3-006`). La regla de arriba no la necesita —lee el entitlement, no el
>    contenido—, pero el modelo no está escrito.
> 3. **Entre la pérdida de la clave y la invalidación**, si el aviso se pierde, la página sigue
>    visible hasta la corrida siguiente del reconciliador: hasta un día, el costo que
>    `DEC-ARCH-009` aceptó.

---

## 2. El ciclo de vida de la postulación · cierra `M-PARTNER-01`

### 2.1 Sí es una entidad con estados propios, y es la novena máquina

El §63 pide ocho máquinas y el capítulo 03 las tiene. Ésta es la novena, y se agrega al núcleo en
vez de declararse acá — **`postulacion` está en el capítulo 01 §2.2 y sus transiciones en el
capítulo 03 §11**.

Se agrega porque tiene lo que define a una máquina: estados con reglas de movimiento que hay que
impedir. La alternativa —leerla de dos fechas, como se hizo con la vertical en el capítulo 10
§4.6— no alcanza acá: hay una decisión humana en el medio, y *«aprobada»* y *«rechazada»* no son
el mismo dato con distinto signo.

### 2.2 Se puede volver a postular, con una espera

**Un rechazo no es definitivo.** Las circunstancias de un negocio cambian, y un rechazo
permanente convierte una decisión de un día en una condena.

**Pero hay una espera configurable entre un rechazo y una postulación nueva** (§9: es
configuración, no una constante). Sin ella, rechazar no cierra nada: la postulación vuelve al día
siguiente y el panel del admin se convierte en un bucle.

**Y la espera nunca bloquea al admin**: el camino B del §17.3 —alta directa— no pasa por la
postulación, así que si el admin cambia de opinión, la da de alta y listo. La espera acota al que
insiste, no al que decide.

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
| el correo **sí** corresponde a un usuario | se le manda **a esa dirección** un aviso para que reclame el Partner, y **nada se vincula hasta que alguien con acceso a ella lo haga** |

**La única prueba de que el postulante es dueño de la dirección es que pueda leerla**, y es la
misma prueba que el §17.3 ya exige en la otra rama. Acá se aplica a la que quedó sin escribir.

Sin esto, cargar el correo de un tercero alcanza para colgarle un Partner que no pidió — o, peor,
para que quien apruebe crea que lo pidió.

### 2.5 El usuario fantasma es inofensivo, porque la suscripción va última

El hueco lo nombra: *«queda un Partner aprobado con un usuario fantasma»* si nunca valida ni
completa el perfil. **No pasa nada, y ésa es la propiedad que hay que preservar deliberadamente:**

**el orden es aprobar → reclamar la cuenta → configurar plan y método → recién ahí la
suscripción.** Es el orden del §17.3, y el paso 8 —*«enviar link para completar
subscription/pago»*— es el último de los nueve.

De ahí sale que un Partner sin reclamar **no publica nada y no se le cobra nada**: no hay
presencia publicada porque no hay quién la cargue, y no hay suscripción porque nadie autorizó un
débito. Lo único que existe es una fila.

**No vence, y queda visible.** Igual que la pendiente del §2.3: aparece como no reclamada en el
panel y el admin puede darla de baja. Un vencimiento automático no evitaría ningún daño —no hay
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
  deja declarado con su causa está en su ⚠️.
- **Cómo se registra un pago manual** es del capítulo 13 (épica de billing).
- **Si algún día Partner enciende su trial**, tiene que declarar su evento de activación
  (`DEC-TRIAL-003`, implicación 1), y ahí el §10.5 pasa a alcanzarlo. **Cuál** es ese evento sigue
  abierto; **qué hay que hacer ese día** no: es el capítulo 11 §8, y los partners ~~ya aprobados~~
  que ya ejercieron el hecho declarado quedan resueltos por `T7` — **los del camino B, sólo si la
  declaración dice qué cuenta para ellos** (§1.5; `F-8CA2-012`).

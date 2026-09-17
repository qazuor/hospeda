---
title: Master Spec 18 — Partner
linear: HOS-1352
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

### 1.5 Y el §10.5 nunca se cruza

*«Máximo una ficha durante trial»* no alcanza a Partner por una razón anterior: **Partner no tiene
trial.** Sus planes lo tienen en cero (`DEC-TRIAL-003`) y no declara evento de activación
(`DEC-TRIAL-006`), así que la transición T1 no puede ocurrir.

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

- **El ciclo de publicación de la presencia** es del capítulo 19: acá está que existe, que la da
  el plan Gold y que no es una ficha.
- **Cómo se registra un pago manual** es del capítulo 13.
- **Si algún día Partner enciende su trial**, tiene que declarar su evento de activación
  (`DEC-TRIAL-003`, implicación 1), y ahí el §10.5 pasa a alcanzarlo.

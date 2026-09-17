---
title: Master Spec 02 — Modelo de datos
linear: HOS-1352
statusSource: linear
created: 2026-09-17
updated: 2026-09-17
status: CURRENT
fase: 2
capitulo: 2
cierra:
  - C-ARCH-01
  - S-ARCH-01
  - M-ARCH-02
  - M-DATA-01
---

# 02 · Modelo de datos

Las entidades, sus relaciones y **las restricciones que hacen cumplir los invariantes**. No es
un DDL: no hay tipos ni índices acá, porque eso es decisión de implementación. Lo que sí hay es
qué guarda cada cosa, cómo se relaciona y **qué la base tiene que impedir por sí sola**.

Los nombres de estado salen del capítulo 01 y las transiciones del 03.

---

## 1. Qué sale de la base y qué no · cierra `C-ARCH-01` y `S-ARCH-01`

### 1.1 El §9 no se puede cumplir tal como está escrito

El §9 es terminante: toda configuración relevante sale *«SI O SI DE DATABASE»*, y prohíbe
*«archivos TS»*, *«constantes duplicadas»* y *«listas hardcodeadas»*. Entre lo que enumera están
**verticales**, **entitlements** y **limits**.

Y no se puede, por una razón que no es de comodidad: **no hay forma de evaluar una capacidad sin
nombrarla**. Cualquier control de acceso pregunta por *una* capacidad concreta, y ese nombre es
un literal en el código. Lo mismo con las verticales: el §13 exige que las operaciones lleven
contexto de vertical suficiente para impedir autorización cruzada, y eso sólo es verificable si
el conjunto de verticales se conoce al compilar.

El propio §9 lo admite a medias en su última línea —*«Código solamente debe contener
comportamiento/algoritmos que no representen configuración comercial»*— pero la frase anterior
es absoluta y se va a leer como absoluta. **Un principio que se va a violar en silencio es peor
que uno acotado**, y el silencio es exactamente lo que el §9 dice querer evitar.

### 1.2 La separación

Son dos cosas distintas y el §9 las trata como una:

| | **Catálogo de claves** | **Configuración comercial** |
|---|---|---|
| **qué es** | qué capacidades, qué límites y qué verticales **existen** | qué plan otorga qué clave, con qué valor, en qué vertical, a qué precio, con qué schedule |
| **dónde vive** | **en el código** | **en la base, sin excepción** |
| **por qué ahí** | el código tiene que poder nombrarlas, y el §13 exige verificarlas al compilar | es lo que cambia sin deploy, y es lo que el §9 viene a proteger |
| **quién lo cambia** | un desarrollador, en un release | un administrador, en cualquier momento |

**El catálogo no es una lista suelta: está verificado contra la base.** Un control automático
falla si una clave usada en código no existe en la base, **y también al revés** — si una clave
de la base no existe en el catálogo. Las dos direcciones, porque cada una es un defecto
distinto: la primera es un permiso que nunca se puede otorgar, la segunda es configuración que
nadie va a leer.

**Esto reescribe el invariante §64.15.** El PDR dice *«Toda configuración comercial viene de
DB»*; la forma aplicable es **«toda configuración comercial viene de la base; el catálogo de
claves es código verificado contra la base»**. Es un apartamiento acotado y declarado, no una
excepción abierta: **lo único que vive en código es el conjunto de nombres. Ningún valor, ningún
precio, ninguna asignación.**

### 1.3 Lo que queda del lado de la base, completo

Todo lo que el §9 enumera menos los tres nombres de arriba: planes, planes de trial, billing
options, precios, duración de trial, schedules de correo, qué entitlement da cada plan, qué
límite, herencia, ajustes de pausa, métodos de pago admitidos, políticas de promo, addons, y
cualquier regla comercial configurable.

---

## 2. Las entidades

### 2.1 Catálogo comercial

```text
vertical (catálogo, espejo del enum)
    │
    └──< plan ──< plan_version ──┬──< billing_option
                                 ├──< plan_version_entitlement
                                 └──< plan_version_limit
```

| entidad | qué guarda | restricciones |
|---|---|---|
| **`vertical`** | el espejo en base del enum de código | el guard de §1.2 verifica las dos direcciones |
| **`plan`** | identidad y cosmética: vertical, slug, nombre, descripción, orden en la pricing. **Muta libremente** (`DEC-ARCH-001`) | `UNIQUE(vertical, slug)` |
| **`plan_version`** | lo que tiene efecto y por eso **es inmutable**: `rank`, si es vendible, días de grace, días de trial, si permite pausa, si hereda Turista VIP | **`UNIQUE(vertical, rank) WHERE vendible`** — dos vendibles con el mismo rank es un estado inválido, no un empate a desempatar (`DEC-ARCH-002`) |
| **`billing_option`** | el ciclo y su precio: mensual, trimestral, semestral o anual (§19), monto y moneda | `UNIQUE(plan_version_id, ciclo)` |
| **`plan_version_entitlement`** | qué clave otorga, y para las medidas **dos cuotas**: la del plan y la del trial (`DEC-ENT-001`) | `UNIQUE(plan_version_id, clave)`; la clave existe en el catálogo |
| **`plan_version_limit`** | qué clave limita y con qué valor | ídem |

**El precio cuelga de la versión, no del plan**, y eso es lo que hace cumplible al §29: cambiar
un precio crea una versión nueva, así que *«mostrar precio anterior/nuevo»* pasa a ser
demostrable contra un registro en vez de una afirmación (`DEC-ARCH-001`).

**La moneda existe en el modelo aunque hoy tenga un solo valor.** Está medido que el proveedor
sólo acepta ARS —`USD` y `BRL` dan `400` (`EX-18`)—, pero el §57 pide que el dominio no quede
acoplado a Mercado Pago. La columna existe con una restricción que hoy admite un valor; sacarla
obligaría a una migración de esquema el día que haya un segundo proveedor, y agregarle un valor
a la restricción no obliga a nada.

**El plan de trial no es una entidad aparte.** Es un `plan` con su versión, marcado **no
vendible**, uno por vertical. Sus limits y entitlements **no se guardan**: se derivan en cada
resolución, del plan vendible de `rank` más alto y del más bajo, más los overrides declarados
(`DEC-TRIAL-001`) y el trinquete (`DEC-TRIAL-002`). El §10.3 es explícito en que no se copien.

### 2.2 Compromiso y ciclo de vida

| entidad | qué guarda | restricciones |
|---|---|---|
| **`trial`** | `user`, vertical, estado del cap. 03 §2, referencia al plan de trial, **referencia a las versiones vigentes al arrancar** (el piso del trinquete), inicio y fin | **`UNIQUE(user_id, vertical)`** — sin condición de estado. Es el §10.1 y el §10.2: el trial es único **de por vida**, así que la fila sobrevive a todo y su sola existencia niega un trial nuevo |
| **`subscription`** | `user`, vertical, versión de plan anclada, billing option, estado, período actual, fecha de fin de servicio, clase (principal o de complemento) | **`UNIQUE(user_id, vertical) WHERE clase = principal AND estado ∈ {vivos}`** — es el §11, **impuesto por la base y no por un chequeo** |
| **`subscription_pause`** | suscripción, **motivo** (`CUSTOMER_REQUEST` o `COURTESY`), meses pedidos, inicio, fin previsto, fin real | a lo sumo una sin `fin_real` por suscripción |
| **`provider_link`** | el id del proveedor de una suscripción, cuál es el proveedor, y **la última `version` del recurso que aplicamos** | **`UNIQUE(proveedor, id_del_proveedor)`**. Es la condición de que la conciliación exista: `DEC-CONC-002` la apoya en **nuestro** inventario, y una suscripción cuyo id se pierde **es invisible para el barrido** |

> La `version` es el contador monótono por recurso que trae cada evento (`EX-2`). Guardarla es lo
> que permite descartar un evento viejo sin gastar una relectura (cap. 03 §10.1) y lo que hace
> visible el caso en que el recurso cambió **sin** que el proveedor avisara — mutar el monto lo
> salta sin emitir ninguna entrega (`EX-15`).

**El piso del trinquete se guarda como referencia a versiones, nunca como copia de valores.** El
§10.3 prohíbe copiar a mano y una copia además queda desactualizada (`DEC-TRIAL-002`).

**Los «vivos» de la restricción del §11 son**: `PENDING_AUTHORIZATION`, `ACTIVE`,
`GRACE_PERIOD`, `PAUSED`, `SUSPENDED` y `CANCEL_SCHEDULED`. Quedan afuera `ABANDONED`,
`CANCELLED` y `RECONCILIATION_REQUIRED` — el último a propósito: si una suscripción necesita
intervención humana, la persona tiene que poder contratar de nuevo sin esperar a que alguien
resuelva un caso.

### 2.3 Dinero

| entidad | qué guarda | restricciones |
|---|---|---|
| **`payment`** | suscripción, monto, moneda, estado del cap. 03 §6, **id del hecho en el proveedor**, fecha del hecho, monto reembolsado acumulado | **`UNIQUE(proveedor, id_del_hecho)`** — es la deduplicación del cap. 03 §10.2 |
| **`refund`** | pago, monto, motivo, estado, quién lo confirmó | el acumulado nunca supera el monto del pago |
| **`manual_payment`** | suscripción, estado del cap. 03 §7, quién lo registró, cuándo, comprobante | |
| **`receipt`** | pago, número, PDF. **Comprobante no fiscal** (§54, `DEC-LEGAL-001`) | `UNIQUE(numero)`, sin huecos |
| **`idempotency_key`** | la clave, a qué operación corresponde, su resultado | **`UNIQUE(clave)`**, y se persiste **antes** de la primera llamada al proveedor (`DEC-CONC-001`) |

**El monto es entero**, en la unidad mínima de la moneda. No hay decimales de punto flotante en
ninguna columna de dinero.

### 2.4 Capacidades y concesiones

| entidad | qué guarda | restricciones |
|---|---|---|
| **`addon_product`** | capability, precio, recurrencia, verticales compatibles, duración, tipo de scope (§39, §40) | |
| **`addon_instance`** | producto, dueño, **objetivo** (ficha, suscripción de vertical, usuario o global), estado, inicio, fin, su suscripción de complemento si es recurrente | el objetivo corresponde al tipo de scope del producto |
| **`promo_code`** | código, tipo, valor, scope de verticales, **cupo total**, ventana de validez, stackable, usable con otra activa (§31, `DEC-PROMO-001`) | `UNIQUE(codigo)` |
| **`promo_redemption`** | código, user, cuándo, sobre qué suscripción | **`UNIQUE(promo_code_id, user_id)`** — es el §31, *«Cada user: máximo un uso de cada código»* |
| **`courtesy_grant`** | beneficiario, scope, días o meses, inicio, fin, quién lo firmó, motivo | el que firma es `SUPER_ADMIN` (`DEC-GRANT-002`) |
| **`permanent_grant`** | beneficiario, scope de verticales, `includesAddons`, quién lo firmó, motivo, suscripciones afectadas (§35.4) | ídem |

**Las concesiones no modifican el plan ni la suscripción: son fuentes independientes.** El §36
dice que un entitlement sigue activo *«mientras al menos una source exista»*, y eso sólo se puede
calcular si cada fuente es su propia fila. Una cortesía que editara la suscripción sería
irreversible sin adivinar qué había antes.

### 2.5 Publicación

| entidad | qué guarda | restricciones |
|---|---|---|
| **`listing`** | vertical, **un solo `owner_user_id`** (§6), estado del cap. 03 §9, contenido | la FK al dueño no es anulable: una ficha sin dueño no es un estado válido |

**No hay multi-dueño y el modelo no lo deja expresar.** El §6 lo dice y la forma de cumplirlo es
una columna, no una tabla de relación con un chequeo de cardinalidad.

### 2.6 Registro

| entidad | qué guarda | restricciones |
|---|---|---|
| **`domain_event`** | qué pasó, sobre qué entidad, quién lo causó, cuándo, **qué campos cambiaron** — no una copia del contenido | append-only |
| **`outbox`** | destinatario, plantilla, estado (`pending`, `processing`, `sent`, `failed`, `retry`), id del proveedor, intentos (§44) | |

**`domain_event` guarda referencias y deltas, no copias del contenido**, y ésa es una decisión de
modelo con consecuencia directa en la retención — se explica en §4.

---

## 3. Caché e invalidación · cierra `M-ARCH-02`

El PDR no lo menciona, y es de las pocas cosas donde **un error es de seguridad y no de
rendimiento**: un entitlement que sigue vivo después de revocado es acceso indebido.

### 3.1 Qué se cachea

**El conjunto efectivo de entitlements y limits de un `user + vertical`.** Es lo caro: agregar
versión de plan, herencia de Turista VIP, addons, cortesía y grant, cada uno con su vigencia.
Nada más se cachea: ni el catálogo, ni los planes, ni el estado de una suscripción.

### 3.2 Se invalida por evento, no por tiempo

**La invalidación es explícita, y el vencimiento por tiempo es una red, nunca el mecanismo.** Un
TTL como defensa principal deja una ventana en la que un permiso revocado sigue funcionando, y
esa ventana es exactamente el error de seguridad que este punto viene a evitar.

Invalidan la entrada de un `user + vertical`:

| evento | por qué |
|---|---|
| cambio de plan o de ciclo | cambia la versión anclada |
| toda transición de la máquina de suscripción | `ACTIVE`, `SUSPENDED` y `PAUSED` otorgan cosas distintas |
| toda transición de la máquina de trial | ídem |
| se otorga o se revoca una cortesía o un grant | son fuentes independientes (§2.4) |
| se activa o vence un addon | ídem |
| se publica una versión nueva de un plan al que hay suscripciones ancladas | cambia lo que esa versión otorga |
| cambia un override del plan de trial | la derivación deja de dar lo mismo |

**Dos reglas sobre la invalidación:**

1. **Invalidar es borrar, no recalcular.** Recalcular dentro de la transacción que causó el
   cambio la vuelve más lenta y más frágil; la próxima lectura lo recalcula sola.
2. **Si la invalidación falla, la operación de dominio no falla** —igual que con el correo
   (§43)— **pero la entrada se marca sospechosa y la próxima lectura la ignora.** Es la
   dirección segura: se paga rendimiento, nunca acceso.

### 3.3 Lo que el caché nunca hace

**Nunca es la fuente de una decisión que toca plata.** Cobrar, reembolsar, otorgar y revocar
leen de la base. El caché sirve para responder *«¿puede hacer esto?»* en el camino de lectura,
no para decidir un movimiento de dinero.

---

## 4. Retención: qué se borra, qué se anonimiza, qué se conserva · cierra `M-DATA-01`

El §25 ordena soft delete a los 90 días y hard delete a los 180 de *«datos operativos
eliminables»*, y manda conservar auditoría, pagos, registros obligatorios, información legal e
historial necesario. Nunca define qué es eliminable.

**El riesgo concreto que esto cierra**: si la auditoría del §49 guardara eventos de dominio
*completos* con su contenido, el hard delete no eliminaría nada y la promesa del §25 sería
decorativa. Por eso `domain_event` guarda **referencias y campos que cambiaron, no copias**
(§2.6). Es una decisión de modelo tomada para que la retención sea posible.

### 4.1 La lista

| | qué | por qué |
|---|---|---|
| **Se borra** al día 180 | el contenido publicable de la ficha (textos, fotos, FAQ, horarios), los borradores, las preferencias de la cuenta y las señales de identidad no bloqueantes (`DEC-TRIAL-004`) | es lo que el §25 llama operativo: sirve para prestar el servicio y el servicio terminó |
| **Se anonimiza** al día 180 | los datos personales que hayan quedado **dentro** de un evento de dominio o de un registro de outbox: nombre, correo, teléfono, dirección | el evento tiene que seguir existiendo —dice que algo pasó y cuándo— pero no necesita decir de quién para eso |
| **Se conserva íntegro, siempre** | pagos, reembolsos, comprobantes, el vínculo con el proveedor, y **la fila de `trial`** | los cuatro primeros son obligación legal y contable; el quinto es el §10.2: el trial no se devuelve, así que la evidencia de que se consumió **tiene que sobrevivir al borrado** o el borrado se convierte en la forma de conseguir otro |

### 4.2 Tres reglas que la lista necesita

1. **Anonimizar no es borrar la fila.** El evento conserva su tipo, su fecha, su entidad y su
   causa; lo que se reemplaza es el dato personal.
2. **La fila de `trial` sobrevive al borrado de la cuenta.** Es la única entidad de este modelo
   que lo hace, y la razón está en el §10.2. Conserva el `user + vertical` y las fechas; lo
   personal se anonimiza con el resto.
3. **El día 90 no borra nada.** La ficha sale del sitio público, **el dueño la sigue viendo** y
   puede exportarla o reactivarla suscribiéndose (`DEC-DATA-001`). Poder exportar antes es lo que
   hace defendible el hard delete del día 180, y los dos avisos previos son correos
   transaccionales no suprimibles.

---

## 5. Las restricciones que sostienen los invariantes

El §64 lista 37 invariantes. Estos son los que **la base puede hacer cumplir sola**, y por eso
son los que no dependen de que ningún camino de código se acuerde:

| invariante del §64 | restricción |
|---|---|
| 1 · trial máximo una vez por `user + vertical` | `UNIQUE(user_id, vertical)` en `trial`, sin condición de estado |
| 2 · borrar ficha no devuelve trial | la fila de `trial` no se borra nunca (§4.1) |
| 8 · máximo una suscripción principal por vertical | `UNIQUE` parcial sobre los estados vivos |
| 11 · una ficha tiene un único dueño | columna no anulable, no tabla de relación |
| 19 · los webhooks son idempotentes | `UNIQUE(proveedor, id_del_hecho)` en `payment` |
| 26 · producto ≠ instancia | son dos tablas, y la instancia no repite ningún campo del producto |
| — · toda columna de estado tiene dominio cerrado | restricción de dominio por columna (cap. 03 §1.2) |

**Los demás no los puede sostener la base** —dependen de la resolución en el servicio— y son el
capítulo 04. Lo que importa es la distinción: los de arriba **no admiten un camino que los
esquive**, los otros sí, y por eso los otros necesitan estar en un solo lugar.

---

## Lo que este capítulo NO cierra

- **`OD-ARCH-01`** (retiro de un plan del catálogo) es del capítulo 10: acá está el flag de
  vendible, que es la mitad del mecanismo; falta la política.
- **Los tipos, los índices y el plan de migración** son de FASE 4 y FASE 7.
- **Qué hace el sistema con una vertical discontinuada** (`M-SUB-03`) es del capítulo 10.

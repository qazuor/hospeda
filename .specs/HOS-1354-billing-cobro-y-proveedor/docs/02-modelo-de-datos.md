---
title: Master Spec 02 — Modelo de datos
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-19
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

La mitad de billing del capítulo 02 del programa. La otra mitad vive en la épica de verticales; lo transversal, en el núcleo.

---

## 2. Las entidades

### 2.1 Catálogo comercial

**Las otras cinco entidades del catálogo comercial — `vertical`, `plan`, `plan_version`, `plan_version_entitlement` y `plan_version_limit` — viven en la épica de verticales. Acá sólo `billing_option`.**

| entidad | qué guarda | restricciones |
|---|---|---|
| **`billing_option`** | el ciclo y su precio: mensual, trimestral, semestral o anual (§19), monto y moneda | `UNIQUE(plan_version_id, ciclo)` |

**El precio cuelga de la versión, no del plan**, y eso es lo que hace cumplible al §29: cambiar
un precio crea una versión nueva, así que «mostrar precio anterior/nuevo» pasa a ser
demostrable contra un registro en vez de una afirmación (`DEC-ARCH-001`).

**La moneda existe en el modelo aunque hoy tenga un solo valor.** Está medido que el proveedor
sólo acepta ARS —`USD` y `BRL` dan `400` (`EX-18`)—, pero el §57 pide que el dominio no quede
acoplado a Mercado Pago. La columna existe con una restricción que hoy admite un valor; sacarla
obligaría a una migración de esquema el día que haya un segundo proveedor, y agregarle un valor
a la restricción no obliga a nada.

### 2.2 Compromiso y ciclo de vida

| entidad | qué guarda | restricciones |
|---|---|---|
| **`subscription`** | `user`, vertical, versión de plan anclada, billing option, estado, período actual, fecha de fin de servicio, clase (principal o de complemento) | **`UNIQUE(user_id, vertical) WHERE clase = principal AND estado ∈ {vivos}`** — es el §11, **impuesto por la base y no por un chequeo** |
| **`subscription_pause`** | suscripción, **motivo** (`CUSTOMER_REQUEST` o `COURTESY`), meses pedidos, inicio, fin previsto, fin real | a lo sumo una sin `fin_real` por suscripción |
| **`provider_link`** | el id del proveedor de una suscripción, cuál es el proveedor, y **la última `version` del recurso que aplicamos** | **`UNIQUE(proveedor, id_del_proveedor)`**. Es la condición de que la conciliación exista: `DEC-CONC-002` la apoya en **nuestro** inventario, y una suscripción cuyo id se pierde **es invisible para el barrido** |

> La `version` es el contador monótono por recurso que trae cada evento (`EX-2`). Guardarla es lo
> que permite descartar un evento viejo sin gastar una relectura (cap. 03 §10.1) y lo que hace
> visible el caso en que el recurso cambió **sin** que el proveedor avisara — mutar el monto lo
> salta sin emitir ninguna entrega (`EX-15`).

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
| **`promo_redemption`** | código, user, cuándo, sobre qué suscripción | **`UNIQUE(promo_code_id, user_id)`** — es el §31, «Cada user: máximo un uso de cada código» |
| **`courtesy_grant`** | beneficiario, scope, días o meses, inicio, fin, quién lo firmó, motivo, **la suscripción que pausa** | el que firma es `SUPER_ADMIN` (`DEC-GRANT-002`); la suscripción **no es anulable** |
| **`permanent_grant`** | beneficiario, scope de verticales, `includesAddons`, quién lo firmó, motivo, suscripciones afectadas (§35.4), **el `plan` que otorga** y **el piso del trinquete** | ídem; el plan **no es anulable** |

**Las concesiones no modifican el plan ni la suscripción: son fuentes independientes.** El §36
dice que un entitlement sigue activo «mientras al menos una source exista», y eso sólo se puede
calcular si cada fuente es su propia fila. Una cortesía que editara la suscripción sería
irreversible sin adivinar qué había antes.

**Las dos concesiones ganaron la columna que las vuelve resolubles**, y es la misma regla en los
dos casos: `12-contrato-de-cobertura.md` §2.3 declara que **una fuente sin referencia resoluble no
se puede expresar**, así que ninguna de las dos columnas admite nulo.

- **`courtesy_grant.subscription_id`** — el mecanismo ya la presuponía y la fila no la guardaba.
  `DEC-GRANT-003` implementa la cortesía *«pausando en el proveedor y sosteniendo el servicio de
  nuestro lado»* y `B/14` §4.3 confirma que sobre un grant no se otorga porque *«no queda nada que
  no cobrar»*: las dos frases dicen que **una cortesía presupone una suscripción**, y la fila no
  decía cuál. Con la columna, la referencia que transporta el `tipo: CORTESÍA` es **la versión
  anclada de la suscripción que pausa** — la misma que llevaría `SUSCRIPCIÓN`. Lo que el `tipo`
  aporta es la distinción que sí importa: una `PAUSED` por `CUSTOMER_REQUEST` **no cubre** (`B/16`
  §2.2, *«el servicio está detenido»*) y una `PAUSED` por `COURTESY` **sí**, porque lo sostenemos
  nosotros.
- **`permanent_grant.plan_id`, y NO una versión.** El grant resuelve **la versión vigente de ese
  plan, vendible o no**, y `UNIQUE(plan_id) WHERE vigente` garantiza que esa versión es unívoca y
  siempre existe. Anclar a una versión fija lo dejaría congelado; leer *«la vigente y sólo si es
  vendible»*, como la pricing, lo dejaría **sin nada** el día que se retira el plan, porque retirar
  un plan se hace publicando una versión no vendible (`D13`, cap. 10 §3.2).
- **`permanent_grant.piso_del_trinquete`** — **la referencia a la versión que estaba vigente el día
  que se firmó**, nunca una copia de sus valores, por la misma razón que el piso del trial (`V/02`
  §2.2: el §10.3 prohíbe copiar a mano, y una copia además queda desactualizada). Seguir la versión
  vigente expone al beneficiario a que el plan **empeore**: una versión que reparte distinto
  le saca algo a quien tiene un «para siempre», sin que nadie lo haya decidido para esa persona.
  **Un grant nunca otorga menos de lo que otorgaba el día que se concedió**, y el instrumento no es
  nuevo: es el piso de `V/15` §2.5 aplicado acá.

**Anclar no es ser.** Una suscripción ancla una versión de plan y no es un plan: el grant sigue
siendo la entidad independiente que `NUCLEO/01` §1.5 describe. Y el retiro ya estaba resuelto —
`D13`: *«retirar un plan del catálogo no mueve ninguna suscripción»*. La alternativa, que el grant
declarara su propio juego de claves, es la que sí rompe algo: crea **una segunda forma de declarar
entitlements**, que `V/02` §1.2 impide.

---

## 4. Retención: qué se borra, qué se anonimiza, qué se conserva · cierra `M-DATA-01`

### 4.1 La lista

| | qué | por qué |
|---|---|---|
| **Se conserva íntegro, siempre** | pagos, reembolsos, comprobantes, el vínculo con el proveedor | los cuatro primeros son obligación legal y contable |

---

## 5. Las restricciones que sostienen los invariantes

El §64 lista 37 invariantes. Estos son los que **la base puede hacer cumplir sola**, y por eso
son los que no dependen de que ningún camino de código se acuerde:

| invariante del §64 | restricción |
|---|---|
| 8 · máximo una suscripción principal por vertical | `UNIQUE` parcial sobre los estados vivos |
| 19 · los webhooks son idempotentes | `UNIQUE(proveedor, id_del_hecho)` en `payment` |
| 26 · producto ≠ instancia | son dos tablas, y la instancia no repite ningún campo del producto |
| — · toda columna de estado tiene dominio cerrado | restricción de dominio por columna (cap. 03 §1.2) |

**Los demás no los puede sostener la base** —dependen de la resolución en el servicio— y son el
capítulo 04 (núcleo). Lo que importa es la distinción: los de arriba **no admiten un camino que los
esquive**, los otros sí, y por eso los otros necesitan estar en un solo lugar.

---
title: Master Spec 04 — Invariantes
linear: HOS-1352
statusSource: linear
created: 2026-09-17
updated: 2026-09-19
status: CURRENT
fase: 2
capitulo: 4
---

# 04 · Invariantes

El §64 lista 37 *«invariantes fundamentales»*. Este capítulo hace tres cosas con esa lista:
**dice dónde se hace cumplir cada uno**, **separa los que no son invariantes del sistema**, y
**nombra los que ninguna decisión sostiene todavía**.

Lo que un invariante necesita para existir de verdad es un lugar donde no se pueda esquivar. Un
invariante enunciado y no impuesto es una intención.

---

## 1. Los cuatro lugares donde se hace cumplir algo

| nivel | qué significa | cuándo corresponde |
|---|---|---|
| **base** | una restricción de la base lo impide | cuando el invariante es una propiedad de los datos y **no admite ningún camino que lo esquive** |
| **servicio** | hay **un** lugar en el dominio que lo evalúa | cuando depende de estado resuelto en el momento |
| **guard** | una verificación automática falla en CI | cuando es una propiedad del código, no de los datos |
| **no verificable** | nadie lo comprueba | cuando es una regla de método o una intención; **se declara como tal** |

La regla de reparto: **base antes que servicio, servicio antes que guard, guard antes que
nada.** Bajar un nivel exige una razón escrita, porque cada escalón agrega un camino por donde
el invariante se puede perder.

---

## 2. Los 37 del §64, repartidos

### 2.1 Los que sostiene la base (6)

| # | invariante | restricción |
|---|---|---|
| 1 | trial máximo una vez por `user + vertical` | `UNIQUE(user_id, vertical)` en `trial`, **sin condición de estado** |
| 2 | borrar ficha no devuelve trial | la fila de `trial` no se borra nunca, ni siquiera en el hard delete del día 180 (cap. 02 §4) |
| 8 | máximo una suscripción principal por vertical | **dos** `UNIQUE` parciales sobre los estados vivos, partidos por `sucede_a` (cap. 02 (épica de billing) §2.2). El invariante cuenta **compromisos, no filas** — ver `D15` |
| 11 | una ficha tiene un único dueño | columna no anulable, no tabla de relación |
| 19 | los webhooks son idempotentes | `UNIQUE(proveedor, id_del_hecho)` |
| 26 | producto de addon ≠ instancia de addon | dos tablas, y la instancia no repite ningún campo del producto |

### 2.2 Los que sostiene un servicio (14)

| # | invariante | dónde vive |
|---|---|---|
| 3 | el trial comienza al publicar | la transición T1 del cap. 03, con el evento que declara cada vertical (`DEC-TRIAL-006`) |
| 4 | el trial usa el plan de trial de su vertical | la misma T1 |
| 5 | el plan de trial deriva dinámicamente | **la resolución de limits**, en un solo lugar: derivar → aplicar overrides → comparar contra el piso (`DEC-TRIAL-001`, `DEC-TRIAL-002`) |
| 6 | máximo una ficha en trial | el primer override de esa misma lista (`DEC-TRIAL-001`) |
| 7 | no se compran addons en trial | la condición de A1 (cap. 03 §8) |
| 9 | verticales simultáneas en estados distintos | es una consecuencia del modelo: todo cuelga de `user + vertical` |
| 10 | una acción en una vertical no afecta a otra | **el scope de vertical es estructural**, no un chequeo — capítulo 17 |
| 14 | los servicios validan vertical, acceso, entitlement y limits | la resolución de autorización, capítulo 17 |
| 20 | existe conciliación | capítulo 09 |
| 21 | una divergencia que necesita intervención notifica a `SUPER_ADMIN` | `S14`, que **pone la marca `requiere_conciliación`** sin mover el estado |
| 22 | la cancelación normal conserva el período pagado | S11 + S12, con **nuestra** fecha de fin de servicio (`DEC-SUB-009`) |
| 23 | sólo los planes mensuales pueden pausarse | `puedePausar()`, un solo lugar (cap. 01 §3) |
| 24 | la pausa puede terminar anticipadamente | S10, el mismo reloj para el fin previsto y el anticipado (`DEC-SUB-010`) |
| 30 | sólo `SUPER_ADMIN` otorga *Free Forever* | la autorización de esa operación, y **también la cortesía temporal** (`DEC-GRANT-002`) |

### 2.3 Los que sostiene un guard (5)

| # | invariante | qué verifica |
|---|---|---|
| 12 | rol ≠ acceso activo | que ninguna autorización decida sólo por rol |
| 13 | rol ≠ entitlement | ídem |
| 15 | toda configuración comercial viene de la base | **reescrito por el cap. 02**: el catálogo de claves es código verificado contra la base en las dos direcciones; ningún valor, precio ni asignación vive en código |
| 16 | los archivos de configuración no son fuente de negocio | el mismo guard que el 15 |
| 32 | Commerce no existe en la arquitectura nueva | el §55 pide eliminarlo de código, esquema, tipos, tests, docs, specs, comentarios y naming; es una búsqueda automática, no una revisión |

**El 15 y el 16 son el mismo invariante enunciado dos veces**, y el cap. 02 explicó por qué su
forma literal es inaplicable: no hay manera de evaluar una capacidad sin nombrarla.

### 2.4 Los que son del programa, no del sistema (7)

| # | invariante | qué es en realidad |
|---|---|---|
| 17 | Hospeda gobierna el dominio | un **principio de diseño**: orienta el reparto de responsabilidades, no se comprueba sobre una ejecución |
| 18 | MP gobierna los hechos ocurridos en MP | ídem; su forma operable es la regla de no-retroceso del cap. 03 §10 |
| 33 | no implementar supuestos sobre MP sin pruebas | **regla de método**: es el §58 y su gate es la matriz de validación |
| 34 | el código legacy dudoso se reescribe | **regla de FASE 5** (`DEC-METH-003`) |
| 35 | sólo se conserva legacy correcto | ídem |
| 36 | la documentación se mantiene desde el minuto cero | **regla del programa** (§3) |
| 37 | cada handoff reconstruye lo realizado | ídem (§3.3, §66) |

**Que el §64 mezcle las dos clases no es un defecto del PDR**: las siete son obligaciones
reales. Lo que sí sería un defecto es tratarlas como si fueran verificables sobre el sistema y
darlas por cumplidas porque nadie las contradijo. **Cinco de las 37 no se pueden comprobar
ejecutando nada.**

### 2.5 Los cinco de *Free Forever* (27, 28, 29) y los dos restantes (25, 31)

| # | invariante | dónde |
|---|---|---|
| 25 | el correo nunca controla una transacción de dominio | capítulo 07, con **una excepción decidida**: `DEC-MAIL-001` bloquea la acción **sólo antes de cancelar**, porque ahí el correo del proveedor hace daño. La excepción está declarada y acotada a un caso |
| 27 | *Free Forever* no activa addons automáticamente | capítulo 14 |
| 28 | *Free Forever* puede incluir addons gratis | ídem, por el flag `includesAddons` (§35.2) |
| 29 | *Free Forever* puede tener scope parcial o global | ídem, y el scope *«todas las futuras»* se permite sin tope (`DEC-PROMO-002`) |
| 31 | Partner no es self-service | capítulo 18 |

> El 25 merece una nota, porque es el único invariante del §64 que una decisión de este programa
> contradice de frente. El §43 dice *«Si falla mail: acción de dominio permanece»*, y
> `DEC-MAIL-001` decidió que antes de cancelar **sí** bloquea. El motivo está medido: el correo
> del proveedor llega primero, con su marca, y dice *«por un pago no realizado o por opción del
> vendedor»* — o sea que a alguien que canceló por su voluntad le llega un aviso que insinúa
> mora. La excepción **no debilita el invariante en ningún otro punto**: en el resto del sistema
> el correo no bloquea nada.

---

## 3. Los invariantes que agregan las decisiones

El §64 se escribió antes de las 45 decisiones. Éstos no están en su lista y tienen el mismo
peso, porque romperlos rompe algo que ya se decidió:

| # | invariante | de dónde sale | dónde se hace cumplir |
|---|---|---|---|
| D1 | **Una suscripción se ancla a una versión de plan, y moverla es un acto explícito** | `DEC-ARCH-001` | servicio: ninguna lectura de configuración comercial toma valores del plan, siempre de la versión |
| D2 | **Dos versiones vendibles y vigentes no comparten `rank` dentro de una vertical** | `DEC-ARCH-002`, cap. 10 §2 | base |
| D3 | **Una pausa siempre tiene motivo, y el reloj lee el motivo y nunca al proveedor** | `DEC-GRANT-004` | base (dominio cerrado) + servicio |
| D4 | **El candado de idempotencia se persiste ANTES de la primera llamada al proveedor** | `DEC-CONC-001` | servicio; si se genera al reintentar, no hay nada que comparar |
| D5 | **Toda mutación en el proveedor se verifica releyendo y comparando campo por campo** | `EX-20`, `EX-15` | servicio: el código de estado **nunca** cierra una mutación |
| D6 | **El buscador del proveedor no es fuente de verdad de nada** | `RC-1`, `DEC-CONC-002` | servicio: el inventario a conciliar sale de nuestra base |
| D7 | **La suscripción vieja se cancela sólo al recibir el webhook de que la nueva quedó autorizada** | `DEC-SUB-006` | servicio; al revés, el cliente que abandona el checkout se queda sin nada |
| D8 | **Una fecha de primer cobro futura es la precondición de seguridad de todo cambio de plan o de ciclo.** Toda sucesora nace con fecha de primer cobro **a un día como mínimo** | `DEC-SUB-006` | **base**: la fecha con la que nació la fila se guarda en `subscription`, y un guard la verifica |
| D9 | **El `reason` que se manda al proveedor es copy para el cliente, nunca un identificador interno** | `EX-19`, `DEC-MAIL-001` | guard |
| D10 | **El `init_point` crudo del proveedor no se muestra nunca sin sanear** | `EX-37` | guard |
| D11 | **Lo que toca plata lo confirma una persona** | `DEC-CONC-001`, `DEC-CONC-002`, `DEC-RF-001` | servicio |
| D12 | **El trial no se le pide al proveedor: el reloj del trial es nuestro** | `DEC-TRIAL-002`, cap. 03 §2 | guard + servicio |
| D13 | **Retirar un plan del catálogo no mueve ninguna suscripción** | cap. 10 §3.2 | servicio: retirar publica una versión no vendible y ninguna lectura de suscripción pasa por la vigente |
| D14 | **Anunciada la discontinuación de una vertical, no se emite un cobro más en ella** | cap. 10 §4.2 | servicio: el anuncio cancela en el proveedor en el mismo acto, y el servicio se sostiene del lado nuestro |
| D15 | **Una sucesión es un compromiso, no dos: a lo sumo una sucesora viva por `user + vertical`, y una sucesora no puede ser sucedida** | cap. 02 (épica de billing) §2.2 | **base**: los dos índices parciales, partidos por `sucede_a` |

**`D8` subió de nivel, y el motivo es el que el §1 usa para todo lo demás.** Era un invariante *de
servicio*, o sea recordable: sin una columna que guardara la fecha con la que nació la fila no había
forma de comprobar que se cumplió **ni de escribir el guard**, y su incumplimiento **es
literalmente el doble cobro**. El §1 define el nivel «base» como el que **no admite ningún camino
que lo esquive**, y ése es el nivel que corresponde a la precondición del mecanismo más caro del
sistema. Releer la fecha del proveedor no era alternativa: lo prohíbe `D6` y además un guard tiene
que poder correr sin red.

**D5, D9 y D10 son las tres que más se parecen entre sí y no lo son.** D5 es sobre *verificar*
después de escribir; D9 y D10 son sobre *qué se manda* y *qué se muestra*. Las tres existen
porque este proveedor tiene el mismo modo de falla —acepta y no aplica, o devuelve algo que
parece válido y no lo es— en tres momentos distintos.

---

## 4. Lo que ningún invariante cubre todavía

Tres cosas que el §64 no nombra, que ninguna decisión resolvió, y que **no se completan acá**
(§67):

1. **Qué pasa cuando una suscripción principal muere y quedan complementos vivos.** El §41 dice
   que un addon se cancela *«solo cuando queda efectivamente huérfano»*, y con `DEC-ADDON-002`
   cada addon recurrente es una suscripción aparte que **no se cancela sola**. Es `E-ADDON-04`,
   capítulo 16.
2. ~~**Qué hace el sistema con una vertical discontinuada.**~~ **Cerrado por el capítulo 10 §4**,
   y dejó los invariantes `D14` y `D13` arriba.
3. **Si el silencio del cliente vale como aceptación de un aumento.** Es `M-LEGAL-03`, y
   **cambia el diseño, no la redacción**: si no alcanza, `DEC-MP-002` necesita aceptación activa
   y a quien no responda no se lo puede aumentar. Capítulo 22, y pide revisión profesional.

---

## 5. El resumen del reparto

| nivel | cuántos del §64 | cuántos de las decisiones |
|---|---|---|
| base | 6 | 2 |
| servicio | 14 | 11 |
| guard | 5 | 3 |
| principio o regla de método, **no verificable ejecutando** | 7 | 0 |
| en un capítulo de subdominio | 5 | 0 |
| **total** | **37** | **14** |

> Las celdas de la columna derecha suman **16 apoyos** sobre **14 invariantes**, y no es un error
> de conteo: **`D3` y `D12` se sostienen en dos niveles a la vez**. `D3` necesita que la base
> restrinja el dominio del motivo **y** que el servicio lo lea en vez de leer al proveedor; `D12`
> necesita un guard que impida pedirle un trial al proveedor **y** un servicio que lleve el reloj.
> Un invariante con dos apoyos no está contado de más: está apoyado dos veces.

**Cincuenta y un invariantes, y ocho los sostiene la base.** El resto depende de que exista un
único lugar donde se evalúen — que es, en una línea, de qué se trata el §7.

> **Corregido el 2026-09-19 — FASE 8** (`F-8A1-016`, `F-8A3-016`, `F-8C1-012`). Estas dos frases
> decían **«suma 14 sobre 12»** y **«Cuarenta y nueve»**, y las dos son **anteriores a `D13` y
> `D14`**, que el §4 de este capítulo declara agregados al cerrar el capítulo 10 §4. Al agregarlos
> se actualizaron las celdas de la tabla y su total, y no estas dos líneas. La aritmética que
> dirime: la tabla del §3 tiene **14 filas** (`D1`…`D14`), 37 + 14 = **51**, y el «ocho los
> sostiene la base» lo corrobora (6 de la izquierda + 2 de la derecha). Cuatro de los ocho
> informes de FASE 8 dijeron 49 y dos dijeron 51: **dirimió la aritmética del documento, no la
> mayoría**.

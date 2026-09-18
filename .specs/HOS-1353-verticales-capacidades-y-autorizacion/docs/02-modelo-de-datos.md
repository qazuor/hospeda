---
title: Master Spec 02 — Modelo de datos
linear: HOS-1353
statusSource: linear
created: 2026-09-17
updated: 2026-09-18
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

La mitad de verticales del capítulo 02 del programa. La otra mitad vive en la épica de billing; lo transversal, en el núcleo.

---

## 2. Las entidades

### 2.1 Catálogo comercial

**`billing_option` vive en la épica de billing. Acá quedan las otras cinco entidades del catálogo comercial.**

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
| **`plan_version`** | lo que tiene efecto y por eso **es inmutable**: `rank`, si es vendible, días de grace, días de trial, si permite pausa, si hereda Turista VIP | **`UNIQUE(plan_id) WHERE vigente`** — cada plan tiene exactamente una versión vigente · **`UNIQUE(vertical, rank) WHERE vendible AND vigente`** — dos vendibles con el mismo rank es un estado inválido, no un empate a desempatar (`DEC-ARCH-002`) |
| **`plan_version_entitlement`** | qué clave otorga, y para las medidas **dos cuotas**: la del plan y la del trial (`DEC-ENT-001`) | `UNIQUE(plan_version_id, clave)`; la clave existe en el catálogo |
| **`plan_version_limit`** | qué clave limita y con qué valor | ídem |

**«Vendible» sin «vigente» no alcanza, y las dos restricciones van juntas.** Un plan tiene varias
versiones y sólo una es la actual; sin marcar cuál, una versión vieja sigue ocupando un `rank` que
el plan ya no usa y la pricing encuentra como comprable algo que se retiró. Las dos preguntas del
catálogo se separan así: **la pricing lee la versión vigente y sólo si es vendible; una suscripción
lee su versión anclada, vigente o no, vendible o no.** El capítulo 10 §2 lo desarrolla y §3 lo usa
para retirar un plan sin mecanismo nuevo.

**El plan de trial no es una entidad aparte.** Es un `plan` con su versión, marcado **no
vendible**, uno por vertical. Sus limits y entitlements **no se guardan**: se derivan en cada
resolución, del plan vendible de `rank` más alto y del más bajo, más los overrides declarados
(`DEC-TRIAL-001`) y el trinquete (`DEC-TRIAL-002`). El §10.3 es explícito en que no se copien.

### 2.2 Compromiso y ciclo de vida

| entidad | qué guarda | restricciones |
|---|---|---|
| **`trial`** | `user`, vertical, estado del cap. 03 §2, referencia al plan de trial, **referencia a las versiones vigentes al arrancar** (el piso del trinquete), inicio, fin y **el hash irreversible del correo normalizado** (§4.1) | **`UNIQUE(user_id, vertical)`** — sin condición de estado. Es el §10.1 y el §10.2: el trial es único **de por vida**, así que la fila sobrevive a todo y su sola existencia niega un trial nuevo |

**El piso del trinquete se guarda como referencia a versiones, nunca como copia de valores.** El
§10.3 prohíbe copiar a mano y una copia además queda desactualizada (`DEC-TRIAL-002`).

### 2.5 Publicación

| entidad | qué guarda | restricciones |
|---|---|---|
| **`listing`** | vertical, **un solo `owner_user_id`** (§6), estado del cap. 03 §9, contenido | la FK al dueño no es anulable: una ficha sin dueño no es un estado válido |

**No hay multi-dueño y el modelo no lo deja expresar.** El §6 lo dice y la forma de cumplirlo es
una columna, no una tabla de relación con un chequeo de cardinalidad.

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
leen de la base. El caché sirve para responder «¿puede hacer esto?» en el camino de lectura,
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
| **Se conserva íntegro, siempre** | **la fila de `trial`** — que guarda **un hash irreversible del correo normalizado, no el correo** | el quinto es el §10.2: el trial no se devuelve, así que la evidencia de que se consumió **tiene que sobrevivir al borrado** o el borrado se convierte en la forma de conseguir otro |

**El hash existe porque el correo es a la vez el único bloqueo y el primer dato que se anonimiza.**
`DEC-TRIAL-004` decidió que sólo el correo normalizado niega un trial nuevo, y este mismo capítulo
anonimiza el correo al día 180: la fila sobreviviría **sin poder reconocer a nadie**, que es
exactamente el desenlace que conservarla venía a evitar. Un hash sirve para lo único que hace
falta —«¿este correo ya consumió?», nunca «¿cuál era?»— y no hay nada que anonimizar en él. El
capítulo 22 §3 lo encontró y deja la pregunta legal formulada.

### 4.2 Tres reglas que la lista necesita

1. **Anonimizar no es borrar la fila.** El evento conserva su tipo, su fecha, su entidad y su
   causa; lo que se reemplaza es el dato personal.
2. **La fila de `trial` sobrevive al borrado de la cuenta.** Es la única entidad de este modelo
   que lo hace, y la razón está en el §10.2. Conserva el `user + vertical`, las fechas y **el hash
   del correo normalizado**; lo personal se anonimiza con el resto. El hash **no** se anonimiza —
   es lo que hace que sobrevivir sirva de algo.
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
| 11 · una ficha tiene un único dueño | columna no anulable, no tabla de relación |
| — · toda columna de estado tiene dominio cerrado | restricción de dominio por columna (cap. 03 §1.2) |

**Los demás no los puede sostener la base** —dependen de la resolución en el servicio— y son el
capítulo 04 (núcleo). Lo que importa es la distinción: los de arriba **no admiten un camino que los
esquive**, los otros sí, y por eso los otros necesitan estar en un solo lugar.

---

## Lo que esta mitad NO cierra

- **`OD-ARCH-01`** (retiro de un plan del catálogo) lo cerró el capítulo 10: acá está el flag de
  vendible y el de vigente, que son el mecanismo; **la política es de la épica de billing**.
- **Qué hace el sistema con una vertical discontinuada** (`M-SUB-03`) lo cerró el capítulo 10 §4,
  **en la épica de billing**. De acá sale lo único que el modelo necesitaba: la fila de `vertical`
  no se borra nunca.

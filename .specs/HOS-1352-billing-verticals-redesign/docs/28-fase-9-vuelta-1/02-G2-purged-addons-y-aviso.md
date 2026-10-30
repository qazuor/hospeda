---
title: "FASE 9 vuelta 1 · G2: el fin de la ficha, el addon y el aviso de cobertura"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 9
---

# FASE 9 vuelta 1 — G2: el fin de la ficha, el addon y el aviso de cobertura

Grupo G2 de la resolución. Toma los racimos **R2**, **R3** y **R9** del consolidado
(`27-fase-8-vuelta-1/00-hallazgos.md`) y los hallazgos sueltos de `A2` (§3 del consolidado). Los
IDs salieron de un script contra el consolidado: **17** (R2: 5, R3: 2, R9: 4, sueltos de `A2`:
6). Todas las citas se verificaron con script contra el worktree de la spec el 2026-09-26.

Convención de rutas en las citas: `V/` = `.specs/HOS-1353-verticales-capacidades-y-autorizacion/`,
`B/` = `.specs/HOS-1354-billing-cobro-y-proveedor/`, `D/` =
`.specs/HOS-1352-billing-verticals-redesign/docs/`. El texto nuevo propuesto va entre comillas
dobles “así”; las citas del diseño vigente, entre comillones con su `archivo:línea`.

---

## 1. Resumen

| hallazgo | ¿sigue llegando? | salida | capítulos afectados |
|---|---|---|---|
| `F-8V1A3-003` (R2) | sí | owner (G2-1) | contrato §4.1, `B/03` §8, `B/09` §3, `B/16` §4.2 |
| `F-8V1C1-001` (R2) | sí | owner (G2-1) | ídem |
| `F-8V1A2-002` (R2) | sí | aplicación | `V/03` §9 |
| `F-8V1C1-013` (R2) | sí | aplicación | `V/03` §9 |
| `F-8V1D1-009` (R2) | sí | aplicación | `N/01` §2.4 (inventario de fila viva) |
| `F-8V1B1-002` (R3) | sí | owner (G2-2) | `B/03` `S32`/`S33`, `B/16` §4.2, `B/19` fila 10 |
| `F-8V1A2-007` (R3) | sí | owner (G2-3) | `B/16` §4.2 y NO cierra, `V/19` §4, `N/07` §6 |
| `F-8V1C1-006` (R9) | sí | aplicación | contrato §3 y §5.1, `B/03` §3.2 |
| `F-8V1C1-010` (R9) | sí | declarar | `V/03` §2 y §9 (⚠️) |
| `F-8V1A2-010` (R9) | sí | aplicación | `V/03` §2, `V/18` §1, contrato §3 |
| `F-8V1C1-012` (R9) | sí | aplicación | contrato §2.1 |
| `F-8V1A2-003` | sí | owner (G2-4) | `V/03` §2 (`T7`) |
| `F-8V1A2-004` | sí | aplicación | `V/spec.md` |
| `F-8V1A2-005` | sí | aplicación (+ declarar) | `V/03` §11, `V/18` §2.5 |
| `F-8V1A2-006` | sí | aplicación | `N/07` §6, `V/03` §2 (`T3`) |
| `F-8V1A2-008` | sí | aplicación | `V/03` §9 (`PB2`, reconciliador) |
| `F-8V1A2-009` | sí | aplicación | `V/03` §2 (el `UNIQUE` del hash) |

Conteo: **17 siguen llegando, 0 no**. Salidas: **11 aplicación**, **5 owner** (en 4 preguntas),
**1 declarar**. `F-8V1A2-005` es aplicación con un residuo declarado.

---

## 2. Racimos

### 2.1 R2 · la llegada a `PURGED` no llega a billing

**Causa.** `K-9` sacó el borrado de la ficha de la orfandad de `A5` y se lo dejó sólo a `A6`,
cuyo evento es un hecho de verticales. Ese hecho no tiene canal, las notas del emisor siguen
apuntando a `A5` y el inventario de fila viva no conoce a `A6`.

**Verificación de que el camino llega (sobre el texto vigente).**

| cita | dónde |
|---|---|
| «es la ÚNICA fila que ejecuta el borrado de la ficha» | `B/docs/03-maquinas-de-estado.md:2484` |
| «El borrado de la ficha ya no es orfandad: es sólo el evento de `A6`» | `B/docs/03-maquinas-de-estado.md:2483` |
| «Es lo único que billing le **empuja** a verticales.» | `D/12-contrato-de-cobertura.md:812` |
| «La inversa transporta política y estado de catálogo, nunca» | `D/12-contrato-de-cobertura.md:946` |
| «el addon `LISTING` que apuntaba a ella **queda huérfano** (`A5`)» | `V/docs/03-maquinas-de-estado.md:514` |
| «es **cualquier llegada a `PURGED`**, así que `PB9` también deja huérfano al» | `V/docs/03-maquinas-de-estado.md:683` |
| «es el **único consumidor cuyo sujeto es SÓLO una instancia de addon**» | `D/nucleo/01-glosario.md:571` |

**Un eslabón más que ningún agente nombró: el detector también quedó ciego.** La cuarta
comprobación de cero llamadas del barrido es la que ve una instancia viva con el objetivo muerto,
y **delega** en la condición del `B/16` §4.2, de la que `K-9` sacó el borrado:

| cita | dónde |
|---|---|
| «Y una cuarta, que tampoco le pregunta nada al proveedor: la instancia de addon viva cuyo» | `B/docs/09-conciliacion.md:447` |
| «corrió: se abre la **marca** con motivo **`ADDON_SIN_APAGAR`** (`B/02` §2.5).» | `B/docs/09-conciliacion.md:453` |
| «**El borrado de la ficha ya no está en esta fila**: lo ejecuta sólo `A6`» | `B/docs/16-addons.md:428` |

O sea que el *«El barrido del cap. 09 no mira `PURGED`»* de `F-8V1A3-003` es peor de lo que dice:
la única red que existía para *«`A5` no corrió»* dejó de ver este caso en el mismo acto de `K-9`.

**Dominio declarado (DEC-METH-004).** Toda llegada a `PURGED` y todo otro fin de una ficha que
es objetivo de un addon `LISTING` vivo:

1. `PB9` desde `ARCHIVED` (día 180);
2. `PB12` desde `DRAFT`;
3. `PB12` desde `PUBLISHED`;
4. `PB12` desde `UNPUBLISHED_BY_BILLING`;
5. `PB12` desde `ARCHIVED`;
6. `MODERATED` → `PURGED` (no existe: NO cierra 1 de `V/03` §9);
7. hard delete del admin fuera de `PB9`/`PB12` (`F-8V1A1-003`, de otro grupo);
8. borrado de la cuenta pedido por el usuario (proceso pendiente, `N/08`);
9. discontinuación de la vertical;
10. la instancia en `PENDING_AUTHORIZATION` en vez de `ACTIVE`;
11. la instancia de única vez (`UNA_VEZ`, sin preapproval);
12. la fila de complemento pausada por `S32` cuando la ficha se borra.

**Recorrido contra la propuesta** (opción recomendada de G2-1: consulta `fichaPurgada` leída por
el barrido; la aplicación de las notas vale para cualquier opción):

| # | caso | con la propuesta |
|---|---|---|
| 1–5 | `PB9` y las cuatro de `PB12` | la ficha queda `PURGED`, que es final; el barrido lee `fichaPurgada: sí` y corre `A6`. Se lee igual el día 1 que el día 300: no hay aviso que perder |
| 6 | `MODERATED` | no llega a `PURGED` por ninguna fila; el addon es de R3 (G2-3), no de acá |
| 7 | hard delete del admin | si la fila desaparece, `fichaPurgada` contesta `sí` (la regla la incluye a propósito): el addon se apaga aunque el acto sea el que `F-8V1A1-003` discute |
| 8 | borrado de la cuenta | si borra filas de ficha, lo cubre el caso 7; si no, el proceso está pendiente (`N/08`) y se declara ahí, no acá |
| 9 | discontinuación | la principal muere antes (`S12`/`S27`/`S28`) y la orfandad de `A5` corre con el motivo 15; si la ficha llega después a `PB9`, `A6` encuentra la instancia ya `CANCELLED` y no hace nada |
| 10 | instancia `PENDING_AUTHORIZATION` | está en el `desde` de `A6` («`ACTIVE` —**o `PENDING_AUTHORIZATION`**») y el barrido la selecciona igual |
| 11 | única vez | `A6` la consume igual (`DEC-ADDON-001`); no hay preapproval que cancelar, así que un día de atraso no mueve plata |
| 12 | complemento en `PAUSED` por `S32` | la instancia sigue `ACTIVE` (`S32` no la toca), `A6` corre y `S21` cierra la pausa con `fin_real` |

La cita del caso 10 está en `B/docs/03-maquinas-de-estado.md:2484`. La del caso 8:

| cita | dónde |
|---|---|
| «el borrado de la cuenta pedido por el propio usuario, que `V/02` §4.2 regla 2» | `D/nucleo/08-auditoria-y-observabilidad.md:87` |

**Propuesta de texto — aplicación sin decisión (cualquier opción de G2-1).**

1. `V/docs/03-maquinas-de-estado.md` §9, nota de `PB9`. Tachar “**Es también *«la ficha se borró»*
   de `B/16` §4.2**, igual que `PB12`: el addon `LISTING` que apuntaba a ella **queda huérfano**
   (`A5`)”. Texto nuevo: “**Es también *«se borra la ficha destino»* de `A6`** (`B/03` §8), igual
   que `PB12`: desde `K-9` `A6` es la única fila que cancela el addon `LISTING` que apuntaba a
   ella; la orfandad de `A5` ya no mira el borrado”.
2. Ídem, nota de `PB12`. Tachar “Es *«la ficha se borró»* de `B/16` §4.2, así que el addon
   `LISTING` que apuntaba a ella **queda huérfano** (`A5`) —y es”. Texto nuevo: “Es”, de modo que
   quede “Es *«se borra la ficha destino»* de `A6` (`B/03` §8)”, seguido de “, la única fila que
   cancela el addon `LISTING` que apuntaba a ella (`K-9`)”.
3. Ídem, *«la moderación y el borrado del dueño»*, el párrafo que empieza *«Es el evento que
   `B/16` §4.2 llama»*. Texto nuevo: “Es el evento que `A6` (`B/03` §8) llama *«se borra la ficha
   destino»*, y desde `K-9` es la única fila que lo ejecuta: la orfandad de `A5` (`B/16` §4.2) ya
   no mira el borrado. **No es el único**: `PB9` llega al mismo `PURGED`, así que también dispara
   `A6`.” Y a continuación la frase de cómo lo lee billing que fije G2-1.
4. `D/nucleo/01-glosario.md`, inventario de fila viva, fila 18. Tachar “es el **único consumidor
   cuyo sujeto es SÓLO una instancia de addon** —el 19 la nombra también, pero junto con una
   suscripción—”. Texto nuevo: “es **uno de los dos consumidores cuyo sujeto es SÓLO una
   instancia de addon** —el otro es el 23, el `desde` de `A6`; el 19 y el 24 la nombran junto con
   una suscripción—”.
5. Ídem, fila nueva en el grupo A: “| 23 ✚ | el **`desde` de `A6`** | cap. 03 (billing) §8 |
   *«`ACTIVE` —o `PENDING_AUTHORIZATION`»*: los **dos** de la instancia, la misma enumeración que
   el 18. Entró con `K-9` (FASE 9 completa), cuando el borrado salió de `A5`: si el conjunto vivo
   de la instancia cambia, cambian los dos |”.
6. **Recorriendo el dominio del inventario aparece un tercer consumidor faltante, del mismo
   tipo**: el `desde` de `S32` (*«toda fila viva DE COMPLEMENTO en `ACTIVE` … con su instancia
   viva»*), que entró con 4a. Fila nueva: “| 24 ✚ | el **`desde` de `S32`** | cap. 03 (billing)
   §3.2 | la fila de complemento en `ACTIVE` **y** su instancia viva: dos sujetos, como el 19
   (FASE 9 completa, 4a) |”. Y en la fila 19, tachar “es el **único consumidor con dos sujetos a
   la vez**” por “es **uno de los dos consumidores con dos sujetos a la vez** —el otro es el
   24—”. `G-R1-E` cuenta filas contra consumidores: se recuenta en el mismo acto.

La propuesta de texto de G2-1 (canal) está en §4, con cada opción.

**Cómo deja de llegar cada miembro.**

- `F-8V1A2-002` y `F-8V1C1-013`: las tres menciones de `V/03` §9 pasan a `A6` (ediciones 1–3).
  Queda una sola lectura para el implementador de V6/V9: el borrado es el evento de `A6`.
- `F-8V1D1-009`: ediciones 4–5; el 6 cierra el mismo defecto para `S32`.
- `F-8V1A3-003` y `F-8V1C1-001`: dependen de G2-1. Con la opción recomendada, `A6` tiene un
  evento que billing puede leer y que no se pierde, y la cuarta comprobación vuelve a ver el caso.

### 2.2 R3 · el addon recurrente sólo muere por orfandad o borrado

**Causa.** Un addon recurrente tiene su propio preapproval y sólo lo apagan la orfandad (ninguna
principal viva) o `A6`. Todo estado **sin servicio** que deja viva a la principal —y toda ficha
objetivo que no se ve sin llegar a `PURGED`— lo deja cobrando. La decisión 4a tapó uno solo de
esos estados: la pausa pedida por el cliente.

**Verificación.**

| cita | dónde |
|---|---|
| «La suspensión no entra**: sigue como dice el párrafo de arriba.» | `B/docs/16-addons.md:666` |
| «tu suscripción se suspendió y ya no se te va a cobrar; para reactivarla» | `B/docs/19-superficies.md:116` |
| «**La suspensión y la pausa no dejan huérfano a nada**, y es el punto del §41: el objetivo existe.» | `B/docs/16-addons.md:651` |
| «Un cliente suspendido dos meses **pierde dos meses de algo que pagó**» | `D/01-decision-log.md:750` |
| «el addon **vence cuando vence**, esté la ficha publicada o no.» | `D/01-decision-log.md:743` |
| «una principal del mismo `user` pasa a `PAUSED` con motivo `CUSTOMER_REQUEST`» | `B/docs/03-maquinas-de-estado.md:174` |
| «un pagador con tarjeta **no vuelve por acá**» | `B/docs/03-maquinas-de-estado.md:149` |
| «Sale del sitio público, **no cuenta para el cupo** y **no devuelve el trial**» | `V/docs/03-maquinas-de-estado.md:515` |
| «es la única salida de `MODERATED`**: el dueño no la republica» | `V/docs/03-maquinas-de-estado.md:516` |

**La decisión 4a, aplicada y medida.** 4a ya está en el texto (`S32`, `S33`, `B/03` §5, `B/16`
§4.2), así que no hay nada que aplicar de ella; lo que pide la consigna es decir qué deja sin
cubrir. El texto de 4a, en una línea:

| cita | dónde |
|---|---|
| «se pausan también sus addons recurrentes de esa vertical, por los mismos meses» | `D/26-fase-9-completa/10-decisiones-del-owner.md:31` |

Deja sin cubrir **tres**
cosas, las tres fuera de su pregunta (que era la pausa del cliente) y no contra ella:

1. **La suspensión** (`F-8V1B1-002`): la principal queda `SUSPENDED`, que es fila viva y no emite
   fuente; `S32` no la tiene como evento. Es la pregunta G2-2.
2. **La ficha objetivo que no se ve con la principal viva** (`F-8V1A2-007`): `MODERATED`, la
   segunda rama de `PB2` (excedente), y —recorriendo el dominio— `DRAFT` por `PB6` y `ARCHIVED`
   por `PB5` desde un borrador. Es la pregunta G2-3.
3. **Un residuo de la propia 4a, que ningún agente vio**: un complemento que **autoriza durante
   la pausa** de su principal. `A1` exige principal `ACTIVE` al comprar, pero si la persona pausa
   (`S8`) dentro de la ventana de autorización del addon, el complemento llega a `ACTIVE` por
   `A2`/`S2` **después** de `S32`, cuyo evento ya pasó, y cobra hasta que la principal vuelva. Está
   acotado por el tope de la pausa (4 pausas-mes) y necesita comprar y pausar en la misma ventana:
   se declara (§5, edición 17).

**Dominio declarado.** Estados sin servicio del título y de la ficha objetivo, cruzados con el
eje de cobro del addon (`PERIÓDICO` con preapproval contra `UNA_VEZ` / `DÍAS_FIJOS`).

| # | estado | recurrente (preapproval) hoy | única vez hoy |
|---|---|---|---|
| a | principal `PAUSED · CUSTOMER_REQUEST` | `S32` lo pausa (4a) ✔; residuo del punto 3 | reloj no se congela, acotado (`DEC-ADDON-001`) ✔ |
| b | principal `PAUSED · COURTESY` | la cortesía emite título: cobra y recibe ✔ | ✔ |
| c | principal `GRACE_PERIOD` | el servicio sigue ✔ | ✔ |
| d | principal `CANCEL_SCHEDULED` | servicio hasta el fin; después `S12` → orfandad ✔ | ✔ |
| e | principal `SUSPENDED` | **cobra sin tope y sin detector** ✗ | pierde días, acotado ✔ |
| f | principal terminal sin relevo | orfandad `A5` + `S21` ✔ | ✔ |
| g | título = ancla de grant, revocado | tercera cláusula de `A5` ✔ | ✔ |
| h | vertical discontinuada | `S26`/`S27`/`S28` → orfandad, motivo 15 ✔ | ✔ |
| i | ficha `DRAFT` por `PB6` (acto del dueño) | **cobra sin servicio, sin tope** ✗ | acotado ✔ |
| j | ficha `UNPUBLISHED_BY_BILLING`, rama 1 | es un título sin servicio: casos a, e, f | — |
| k | ficha `UNPUBLISHED_BY_BILLING`, rama 2 (excedente) | **cobra sin servicio, sin tope** ✗ | acotado ✔ |
| l | ficha `ARCHIVED` por `PB4` | viene de la rama 1: casos a, e, f | — |
| m | ficha `ARCHIVED` por `PB5` (borrador inactivo) | **cobra sin servicio, sin tope** ✗ | acotado ✔ |
| n | ficha `MODERATED` | **cobra sin servicio, sin tope** ✗ (no hay reloj) | acotado ✔ |
| o | ficha `PURGED` | `A6`: es R2 | `A6` ✔ |

**Recorrido contra la propuesta** (recomendaciones de G2-2 y G2-3):

- **e** con G2-2 opción 1: `S6` pausa el complemento por `S32`; la vuelta con tarjeta es la
  sucesión desde `SUSPENDED`, `S18` re-apunta y `S33` reanuda; la del pagador manual es `S7`, y
  `S33` reanuda; si la principal termina (`S23`, `S27`), la orfandad lo lleva a `CANCELLED` desde
  `PAUSED` por `S21`. Ningún camino deja un débito.
- **i, k, m, n** con G2-3 opción 1: siguen cobrando, pero el acto que los causa se lo dice al dueño
  y le ofrece la baja (primera cláusula de `A5`), que siempre tiene a mano. El débito deja de ser
  **invisible**; sigue sin tope, y eso queda declarado con su causa (§41 del PDR: el objetivo
  existe).
- **a** (residuo), **b, c, d, f, g, h, j, l, o**: sin cambio.

**Propuesta de texto.** Depende de G2-2 y G2-3 (§4). La única edición independiente es la del
residuo de 4a (§5, edición 17).

**Cómo deja de llegar cada miembro.** `F-8V1B1-002`: con G2-2 opción 1 el complemento deja de
cobrar al suspender y el aviso de la fila 10 pasa a ser verdad; con la opción 2 sigue cobrando y
el aviso deja de prometer lo contrario. `F-8V1A2-007`: con G2-3 opción 1 el cobro queda dicho en
el acto y declarado; con la 2 se pausa.

### 2.3 R9 · el aviso de cobertura sin censo de emisores

**Causa.** El contrato mantiene un censo de **consumidores** (la fila `cubierto` del §2.1) y no uno
de **emisores**; y las dos listas de quién espera el aviso del primer pago se escribieron antes de
`T8`.

**Verificación.**

| cita | dónde |
|---|---|
| «lo construido**: se enchufa como fuente y como emisor del aviso.» | `D/12-contrato-de-cobertura.md:1090` |
| «Y si es el primer pago acreditado de una suscripción, emite el aviso de cobertura» | `B/docs/03-maquinas-de-estado.md:1721` |
| «No devuelve datos fijos.** Resuelve honestamente las **dos** fuentes que ya viven del lado de» | `D/12-contrato-de-cobertura.md:1053` |
| «pero es el hecho que `T2` y `T5` esperan; sin aviso, `T2` quedaría esperando hasta que `T3` venciera» | `D/12-contrato-de-cobertura.md:827` |
| «La máquina de trial no la corre.** `DEC-ARCH-009` nombra `PB2`, `PB3` y `PB7`.» | `V/docs/03-maquinas-de-estado.md:1117` |
| «Si se pierde el aviso del primer pago** (`12-contrato…` §3), `T2` no dispara, el trial sigue» | `V/docs/03-maquinas-de-estado.md:192` |
| «agregue un consumidor **agrega su sintagma a esta fila en el mismo acto**» | `D/12-contrato-de-cobertura.md:134` |
| «sólo si el dueño está cubierto** —`cubierto` verdadero en esa vertical—» | `V/docs/03-maquinas-de-estado.md:506` |

Contado con `rg` sobre `B/`, `V/` y el contrato: la única fila que declara emitir el aviso es `P1`
(`B/03:1721`); ninguna otra transición de suscripción, cortesía, grant, addon o trial lo dice.

**Dominio declarado.** Dos listas cerradas:

- **emisores**: toda escritura que cambia la respuesta del §2.1 —las filas de `B/03` §3.2 que
  cambian lo que emite la fila (tabla *«qué emite cada estado»* del contrato §2.6), `P1` sobre el
  primer pago, las filas de cortesía y de grant, `A2`/`A4`/`A5`/`A6` y las transiciones de trial
  que mueven la fuente de trial (`T1`–`T5`);
- **consumidores**: los del §3 (`PB2`/`PB3`/`PB7`, la lista de invalidación y el reconciliador de
  excedentes, el reloj, la máquina de trial) y los de la fila `cubierto` del §2.1.

**Recorrido.**

| elemento | hoy | con la propuesta |
|---|---|---|
| emisores de billing salvo `P1` | sin declarar | los alcanza el predicado del censo (edición 7) y la frase de `B/03` §3.2 (edición 9) |
| `T1`–`T5` en la implementación de arranque | sin declarar | edición 8 |
| fecha que vence sin transición | no emite (§2.6) | sigue sin emitir; se dice en el censo que su red es el reconciliador |
| `T2`, `T5` como consumidores del primer pago | en la lista | sin cambio |
| `T8` como consumidor del primer pago | falta | edición 10 |
| pérdida del aviso de `T8` | sin declarar | declarada (edición 11) |
| `PB1` como consumidor de `cubierto` | falta | edición 12 |
| resto de la fila `cubierto` | completo (recorrido con `rg` sobre `V/03`, `V/15`, `V/17`, `V/02`) | sin cambio |

**Propuesta de texto** (ediciones 7–12 de §5).

**Cómo deja de llegar cada miembro.** `F-8V1C1-006`: ediciones 7–9. `F-8V1A2-010` (su mitad del
contrato): edición 10; su mitad de ordinales va en §3. `F-8V1C1-010`: edición 11 (declarado: es un
residuo —necesita un aviso perdido y una segunda publicación sin cobertura, y lo que regala es un
trial, no cobra nada—). `F-8V1C1-012`: edición 12.

---

## 3. Hallazgos sueltos

### 3.1 `F-8V1A2-003` · `T7` consume el trial de quien publicó con una suscripción que nunca cobró

**Sigue llegando.** La guarda de `T7` no mira con qué título se publicó, contra la regla del
trial:

| cita | dónde |
|---|---|
| «la persona **ya ejerció el hecho que la vertical declara como evento de activación**» | `V/docs/03-maquinas-de-estado.md:57` |
| «y un alta que no ocurrió no consume el trial» | `V/docs/03-maquinas-de-estado.md:137` |

Es del owner (G2-4): toca el alcance de `DEC-TRIAL-010` sobre `T7`.

**Dominio.** Quien ejerció el evento en una vertical con días en cero, por el título que lo cubría:
suscripción que cobró, suscripción que nunca cobró, grant, cortesía. Sólo la segunda es la del
hallazgo; las otras tres fueron clientes y `T7` acierta.

### 3.2 `F-8V1A2-004` · `V/spec.md` describe `T8` al revés

**Sigue llegando.** El spec contra la guarda de la tabla:

| cita | dónde |
|---|---|
| «quien pagó sin haber publicado consume su fila por `T8`, al primer pago» | `V/spec.md:220` |
| «la persona **ya ejerció el evento de activación** en esa vertical» | `V/docs/03-maquinas-de-estado.md:58` |

Aplicación: edición 13.

### 3.3 `F-8V1A2-005` · la postulación de Partner tiene dos actos que su tabla no declara

**Sigue llegando.**

| cita | dónde |
|---|---|
| «panel y el admin puede darla de baja. Un vencimiento automático no evitaría ningún daño» | `V/docs/18-partner.md:259` |
| «habilita postular de nuevo pasada la espera configurable» | `V/docs/03-maquinas-de-estado.md:1140` |
| «nada se vincula hasta que alguien con acceso a ella lo haga» | `V/docs/18-partner.md:237` |

**Propuesta, la que no agrega estados**: el reclamo no es una transición de la postulación sino el
acto que vincula (cap. 18 §2.4), así que *«sin reclamar»* se lee como `APROBADA` sin vínculo; la
baja de una aprobada sin reclamar se tacha, porque el propio capítulo la llama inofensiva y no
tiene fila; la espera y la unicidad de `PENDIENTE` pasan a la guarda de `PP1`. Ediciones 14–15, y
el residuo (la lista del panel crece) se declara.

### 3.4 `F-8V1A2-006` · las campañas del trial piden suscribirse en una vertical que no admite altas

**Sigue llegando.** `T3` arranca la campaña sin mirar `admite_altas`, y el catálogo no pide
relectura:

| cita | dónde |
|---|---|
| «arranca la campaña de recuperación y el reloj de retención» | `V/docs/03-maquinas-de-estado.md:53` |
| «+1, +5, +15, +30, +60 días, y **termina ahí**» | `D/nucleo/07-outbox-y-notificaciones.md:226` |

La forma ya existe en el mismo catálogo: los previos de retención releen antes de salir.
Aplicación: edición 16. No mueve plata ni da acceso.

### 3.5 `F-8V1A2-008` · `PB2` decide con una lectura hecha antes del lock

**Sigue llegando.**

| cita | dónde |
|---|---|
| «`PB2` entra después y encuentra la ficha recién publicada entre las que baja.» | `V/docs/03-maquinas-de-estado.md:756` |
| «compara con el estado de sus fichas y, si no coinciden, corre la transición que el aviso habría» | `V/docs/03-maquinas-de-estado.md:999` |

En ningún lado dice que `PB2` relea adentro. Aplicación sin decisión: es `B/05` §2 `C1`, que
`PB1` ya aplica, llevada a `PB2`. Edición 18.

### 3.6 `F-8V1A2-009` · `T6` y `T8` escriben la misma fila de `trial` sin lock

**Sigue llegando.** El lock no alcanza a `T8`, y el choque con el `UNIQUE` es la falla que el
capítulo ya describió:

| cita | dónde |
|---|---|
| «Toda transición que ocupa cupo —`PB1`, `PB3` y `PB7`— toma un lock por `user + vertical` y» | `V/docs/03-maquinas-de-estado.md:746` |
| «con `PB1` y `T6` en la misma transacción, **la persona pagaba y no podía» | `V/docs/03-maquinas-de-estado.md:307` |

Propuesta sin lock nuevo: el choque se lee como la guarda de hash en falso. Edición 19.

### 3.7 `F-8V1A2-010` · ordinales vencidos alrededor de `T1`–`T8`

**Sigue llegando.**

| cita | dónde |
|---|---|
| «Las tres consecuencias del par, recorridas** — la mitad de catálogo × los dos valores de» | `V/docs/03-maquinas-de-estado.md:252` |
| «La tercera fila es nueva y es deliberada.** `T6` no repetía la mitad de catálogo, así que en una» | `V/docs/03-maquinas-de-estado.md:264` |
| «cuarta fila de la tabla de arriba y el efecto buscado.» | `V/docs/03-maquinas-de-estado.md:282` |
| «La tercera fila no es un estado final: `T7` la cierra el día del encendido» | `V/docs/03-maquinas-de-estado.md:332` |
| «la razón es la configuración de hoy, no una propiedad de Partner**: las tres dependen de dos» | `V/docs/18-partner.md:90` |

La tabla tiene seis filas (contadas). Propuesta: nombrar las filas por su contenido, no por su
ordinal, para que la próxima fila no las vuelva a correr. Edición 20; la mitad del contrato es la
edición 10.

---

## 4. Preguntas al owner

### G2-1 · ¿Por dónde se entera billing de que una ficha llegó a `PURGED`?

Hoy no se entera: `A6` espera un hecho que ningún canal le trae, y el detector que cubría a `A5`
tampoco lo ve desde `K-9`. Toca `DEC-ARCH-006` (el contrato), así que es del owner. **Coordinar con
el grupo que tiene R8**: los dos amplían el §4.1.

1. **Una consulta más en el contrato, leída por el barrido diario.** `fichaPurgada(ficha) → sí |
   no` en el §4.1 (`sí` si está en `PURGED` o su fila no existe). El barrido de billing la pregunta
   por cada instancia viva de scope `LISTING` y, si da `sí`, corre `A6`.
   - Costo: una consulta, una frase en `A6`, una mitad en la cuarta comprobación. Ningún
     transporte: `PURGED` es final, así que la pregunta contesta lo mismo tarde que temprano.
   - Riesgo: hasta un día de atraso. Si el cobro mensual del complemento cae en ese día, entra un
     cobro; `S21` lo pone delante de una persona con la marca del motivo 14 (propuesta *no
     devolver*, que la persona puede cambiar). Se declara.
   - Impacto: contrato §4.1 y §4.2 (el conteo de campos y el principio de la dirección inversa),
     `B/03` §8 (`A6`), `B/09` §3, `B/16` §4.2, `V/03` §9. Lo construye V6 (dueña de `PB12`).
2. **Un hecho empujado de verticales a billing en el mismo acto de `PB9`/`PB12`, con la opción 1
   como red.**
   - Costo: el primer empuje en esa dirección —hoy el contrato tiene uno solo, el aviso, y sin
     transporte durable—, más todo lo de la opción 1 para cubrir el hecho perdido.
   - Riesgo: dos mecanismos para lo mismo; el hecho sin red es el mismo agujero de hoy.
   - Impacto: contrato §3 y §4.1, `V/03` §9, `B/03` §8, `B/09` §3.

**Recomendación: 1.** Se apoya en un estado final y no en un mensaje, que es la regla del propio
contrato (*«el evento no reemplaza la consulta»*); reusa el barrido que ya relee por id en la
decisión 3c; y el único costo es un día acotado, visible y con una persona delante. La 2 compra
ese día con un mecanismo que igual necesita la 1 debajo. **Si el owner no acepta ni un cobro de
más**, la 2 es la posición honesta: es el único camino a cero atraso.

**Juan.** Juan borra «Cabañas del Río», que tenía un destaque mensual, el día 10 de su período.
Con la 1, el día 11 el barrido lee `fichaPurgada: sí` y corre `A6`: se cancela el preapproval del
destaque y `S21` lleva su complemento a `CANCELLED`. Si lo hubiera borrado el día 29 y el cobro
fuera el 30, ese cobro entraba y una persona lo vería con la propuesta de no devolver.

**Texto a aplicar si elige 1.**

- Contrato §4.1, bloque de firmas: agregar la línea “fichaPurgada(ficha) → sí | no”. Después del
  bloque, párrafo nuevo: “**Y una cuarta, que no es de catálogo: `fichaPurgada`.** Contesta `sí`
  si la ficha está en `PURGED` o su fila no existe, y `no` en cualquier otro estado. Es el único
  estado de instancia que billing lee, y lo lee porque `A6` —la única fila que cancela un addon
  `LISTING` al borrarse su ficha (`K-9`)— espera un hecho de verticales que ningún otro camino le
  trae. `PURGED` es final, así que la pregunta se puede hacer tarde: no necesita transporte ni red.
  La construye V6, dueña de `PB12`.”
- Contrato §4.1, recuadro del principio: tachar “La inversa transporta política y estado de
  catálogo, nunca capacidades” por “La inversa transporta política, estado de catálogo y un único
  hecho de instancia —que una ficha ya no existe—, nunca capacidades”. Y tachar “Son siete campos
  en tres preguntas” por “Son ocho campos en cuatro preguntas”; en el §4.2, tachar “**los siete
  campos** del §4.1” por “los campos que el §4.1 cuenta”.
- `B/03` §8, evento de `A6`: después de “o `PB12`, el dueño (`V/03` §9)—” agregar “, **que billing
  lee en el barrido diario con la consulta `fichaPurgada` del contrato §4.1**: si una instancia viva
  de scope `LISTING` da `sí`, corre `A6`. Si la cancelación falla, la instancia sigue viva y la
  corrida siguiente vuelve a leer lo mismo”.
- `B/09` §3, cuarta comprobación: después de “ya cumple la condición de orfandad del `B/16` §4.2”
  agregar “, **o, en scope `LISTING`, su ficha da `fichaPurgada: sí`** (contrato §4.1) —en ese caso
  el barrido corre primero `A6` y marca sólo si `A6` no se pudo ejecutar—”; y donde dice que cuesta
  cero llamadas, agregar “al proveedor; la mitad de `fichaPurgada` es una consulta interna”.
- `B/16` §4.2, viñeta de `A6`: agregar “Billing lo lee por `fichaPurgada` (contrato §4.1) en el
  barrido diario, con hasta un día de atraso”.
- `B/16`, *«Lo que este capítulo NO cierra»*, viñeta nueva: “**El destaque de una ficha borrada
  puede cobrar una vez más.** `A6` corre en el barrido diario, no en el acto del borrado: si el
  cobro del complemento cae entre las dos cosas, entra, y `S21` lo pone delante de una persona con
  el motivo 14. **Causa**: el contrato no transporta hechos de verticales a billing (G2-1, owner
  2026-09-26).”
- `V/03` §9, la frase que sigue a la edición 3: “Billing lo lee con la consulta `fichaPurgada` del
  contrato §4.1, en su barrido diario.”

### G2-2 · ¿Qué le pasa al addon recurrente cuando la principal queda `SUSPENDED`?

Hoy sigue cobrando todos los meses sin dar nada, sin tope y sin detector, y el aviso de suspensión
dice que ya no se le cobra. `DEC-ADDON-001` aceptó que el suspendido **pierda días** de un addon
con fecha de fin; un preapproval mensual no tiene fecha de fin, así que esto no reabre esa
decisión: pregunta lo que no tuvo delante. **Cancelarlo no es una opción**: el §41 del PDR manda
cancelar un addon sólo cuando queda huérfano, y el propio `A5` lo repite:

| cita | dónde |
|---|---|
| «§41: **sólo** cuando queda efectivamente huérfano, no por cancelar la vertical.» | `B/docs/03-maquinas-de-estado.md:2483` |

1. **La suspensión pausa el complemento, como la pausa del cliente (4a extendida).** `S6` se suma
   al evento de `S32`; la pausa no tiene `fin_previsto`; `S33` reanuda cuando vuelve a haber
   principal `ACTIVE`.
   - Costo: una cláusula en el evento de `S32`, `S7` en el de `S33`, una frase sobre el
     `fin_previsto` nulo, el texto del aviso. Ninguna fila ni estado nuevo.
   - Riesgo: el `PUT paused` puede fallar (lo cubre la marca `PAUSA_NO_APLICADA`, como en 4a); y un
     complemento que no se reanuda cuando la principal vuelve falla hacia **no** cobrar, sin
     detector, y se declara. El motivo de esa pausa queda `CUSTOMER_REQUEST` aunque la causa sea la
     mora: ninguna fila lo lee en una fila de complemento (`S10`/`S25` exigen principal, y `S6` no
     toma una `PAUSED · CUSTOMER_REQUEST`), y se dice en la nota.
   - Impacto: `B/03` `S32`, `S33` y §5; `B/16` §4.2; `B/19` fila 10.
2. **Sigue cobrando, y el aviso lo dice** (lectura literal de `DEC-ADDON-001` impl. 2).
   - Costo: el texto del aviso y una viñeta en el NO cierra.
   - Riesgo: débito mensual sin tope sobre alguien sin servicio; el reclamo entra por soporte o
     por contracargo, que es un evento de `S6` para esa fila de complemento.
   - Impacto: `B/19` fila 10, `B/16` NO cierra.

**Recomendación: 1.** No agrega mecanismo —usa `S32`/`S33` enteros—, respeta el §41 (no cancela)
y cumple `DEC-SUB-019` (*«la suspensión corta el cobro»*) sobre todo el cobro y no sólo el de la
principal; y Juan recupera su destaque al volver sin volver a comprarlo. **La posición contraria
es defendible**: `DEC-ADDON-001` impl. 2 ya decidió que el suspendido pierde lo que pagó, y la 2 es
su lectura literal con un aviso honesto; lo que la 2 no resuelve es que el débito no tiene fin.

**Juan.** Alojamiento (ARS 18.000) y destaque recurrente (ARS 3.000). Rechaza el de 18.000, entra
el de 3.000, pasan los diez días y corre `S6`. Con la 1, en el mismo acto el destaque pasa a
`PAUSED` y el correo dice que no se le cobra nada, destaque incluido. Dos meses después vuelve por
el checkout: `S18` re-apunta el destaque a su suscripción nueva y `S33` lo reanuda. Con la 2, el
correo dice que el destaque sigue cobrándose hasta que lo dé de baja.

**Texto a aplicar si elige 1.**

- `B/03` §3.2, `S32`, evento: después de “`S8`, o `S35`” agregar “— **o pasa a `SUSPENDED` por
  `S6`**, por cualquiera de sus cinco eventos (owner 2026-09-26, G2-2)”. En el `desde`, cláusula
  `USER`/`GLOBAL`: tachar “que no esté `PAUSED`” por “que no esté `PAUSED` ni `SUSPENDED`”. En la
  nota, agregar: “**Por `S6` la pausa no tiene `fin_previsto`**: la suspensión no tiene fin, así
  que la quinta comprobación de `B/09` §3 no la selecciona. El motivo queda `CUSTOMER_REQUEST`
  porque ninguna fila lo lee en una fila de complemento.”
- `B/03` §3.2, `S33`, evento: después de “o esa sucesora autoriza después (`S2`)” agregar “, o la
  principal vuelve de `SUSPENDED` por `S7`”.
- `B/03` §5, primer párrafo: tachar “junto con su principal” por “junto con su principal pausada
  por el cliente o suspendida”.
- `B/16` §4.2: tachar “**La suspensión no entra**: sigue como dice el párrafo de arriba.” por “**Y
  la suspensión también** (owner 2026-09-26, G2-2): `S6` pausa los complementos recurrentes por la
  misma fila `S32`, sin fecha de fin, y la vuelta los reanuda (`S33`). El párrafo de arriba —*«su
  reloj no se congela»*— queda para el addon de única vez.”
- `B/19` §4, fila 10: después de “ya no se te va a cobrar” agregar “—tampoco tus addons
  recurrentes, que quedan pausados y vuelven cuando vuelvas—”, y tachar “y los **días de addon**
  que se le van a ir” por “y los **días de addon de única vez** que se le van a ir”.
- `B/03` §5, *«Lo que esta mitad NO cierra»* (o el NO cierra de `B/16`): “**El complemento que no
  se reanuda al volver de una suspensión no tiene detector**: su pausa no tiene `fin_previsto`, así
  que la quinta comprobación no lo ve. Falla hacia no cobrar. **Causa**: la suspensión no tiene
  fecha de fin (G2-2).”

### G2-3 · ¿El destaque de una ficha que no se ve, con la principal viva, se sigue cobrando?

Casos i, k, m y n del dominio de R3: ficha `MODERATED`, bajada por excedente, despublicada por el
dueño (`PB6`) o archivada desde borrador (`PB5`). La ficha existe, así que el §41 impide
cancelar; y `MODERATED` no tiene reloj.

1. **Se sigue cobrando, y el acto que lo causa lo dice y ofrece la baja.** El aviso de moderar
   (hoy sin fila, NO cierra 3 de `V/03` §9), el del excedente y la confirmación de `PB6` nombran los
   destaques recurrentes sobre esa ficha —los lee de `fuentes`: `alcance: LISTING` y `objetivo`— y
   dicen que siguen cobrándose hasta que los dé de baja (primera cláusula de `A5`).
   - Costo: textos en `V/19` §4 y `N/07` §6, y una viñeta en el NO cierra de `B/16`. Ninguna
     lectura nueva a través de la frontera.
   - Riesgo: el débito sigue sin tope si la persona no actúa; queda dicho y declarado.
   - Impacto: `V/19` §4 (fila nueva de moderación; filas de excedente y de despublicar), `N/07` §6,
     `B/16` NO cierra; cierra en parte el NO cierra 3 de `V/03` §9.
2. **El complemento se pausa mientras su ficha no esté `PUBLISHED`.** Billing lee el estado de la
   ficha (la consulta de G2-1 ampliada a `estadoDeFicha`) y `S32`/`S33` ganan esos eventos.
   - Costo: una consulta más ancha, dos eventos más, un `PUT` con rama de fallo por cada
     moderación, excedente o despublicación, y un día de atraso.
   - Riesgo: vaivén con la restitución (`PB3` republica y reanuda, el excedente vuelve y pausa).
   - Impacto: contrato §4.1, `B/03` `S32`/`S33`, `B/09` §3, `B/16` §4.2.

**Recomendación: 1.** En los cuatro casos la causa es un acto del dueño (despublicar, bajar de
plan, dejar el borrador) o una sanción justificada (`V/11` §2.2), el dueño tiene la baja a mano, y
lo que faltaba no era un mecanismo sino que alguien se lo dijera. **Si el owner elige la opción 1
de G2-1 y quiere el lado robusto**, la 2 cuesta menos que desde cero porque la consulta ya existe;
sigue siendo bastante más mecanismo para un caso que el dueño controla.

**Juan.** Un admin modera «Cabañas del Río», que tiene destaque mensual. Con la 1, el aviso de
moderación le dice: *«tu destaque sobre esta ficha se sigue cobrando mientras esté moderada;
podés darlo de baja desde Mi Suscripción»*. Juan lo da de baja: `A5` por su primera cláusula. Con
la 2, el destaque se pausa al día siguiente y se reanuda cuando un admin levanta la moderación y
Juan la vuelve a publicar.

**Texto a aplicar si elige 1.**

- `V/19` §4, fila nueva: “| al **moderar** una ficha (`PB10`) | el motivo; que la ficha no se ve
  hasta que un admin levante la moderación; y **los destaques recurrentes sobre esa ficha, que se
  siguen cobrando hasta que los dé de baja** | `V/03` §9, `DEC-ADDON-001` |”. En la fila del
  excedente y en la confirmación de despublicar, la misma frase sobre los destaques.
- `N/07` §6, fila *«excedente por downgrade»*: agregar “y los destaques recurrentes de las fichas
  que baja, que se siguen cobrando”.
- `B/16`, NO cierra, viñeta nueva: “**Un destaque recurrente sobre una ficha que no se ve con la
  principal viva se sigue cobrando** —`MODERATED`, excedente, `DRAFT` por `PB6`, `ARCHIVED` por
  `PB5`—. El acto que lo causa lo dice y ofrece la baja. **Causa**: el objetivo existe (§41 del
  PDR) y la causa es un acto del dueño o una sanción (owner 2026-09-26, G2-3).”

### G2-4 · ¿`T7` consume el trial de quien publicó sólo con una suscripción que nunca cobró?

Población: vertical con días en cero, suscripción, publicación en los minutos antes del primer
cobro, cobro rechazado, y la vertical enciende su trial después.

1. **Sí, y se declara.** `T7` queda como está; su ⚠️ nombra la población con su causa.
   - Costo: un punto en el ⚠️ de `V/03` §2. Riesgo: esa persona pierde un trial que no usó; no
     paga nada. Impacto: `V/03` §2.
2. **No: `PB1` guarda en el registro del evento si el título que lo cubría convertía, y `T7` lee
   sólo esos.**
   - Costo: un dato más en el registro y una guarda más en `T7`.
   - Riesgo: **abre el agujero contrario**. En una vertical con días en cero `T8` no dispara (su
     guarda pide días > 0), así que quien publicó con `cobrada: no` y **después cobró** no tiene
     fila; con el dato tomado al publicar, `T7` tampoco se la escribe y recibe un trial siendo
     cliente. Taparlo pide leer la historia de cobro, que `DEC-TRIAL-008` cerró.
   - Impacto: `V/03` §2 y §9, `V/02` (el registro).

**Recomendación: 1.** Es un residuo de borde (no mueve plata, no da acceso, no borra) y la
alternativa cambia un error por el opuesto. **Posición contraria**: `DEC-TRIAL-010` dice que un
alta que no ocurrió no consume, y la 1 lo incumple para esta población.

**Juan.** Partner con días en cero. Juan se suscribe, publica a los diez minutos, el primer cobro
se rechaza y la ficha baja. Meses después Partner enciende un trial de 14 días: con la 1, `T7` le
escribe la fila consumida y Juan no tiene trial; con la 2 lo tiene, y también lo tendría Pedro,
que en el mismo caso sí pagó.

**Texto a aplicar si elige 1.** `V/03` §2, en *«la tercera fila no es un estado final»* (con el
nombre nuevo de la edición 20), ⚠️ nuevo: “**`T7` consume también el trial de quien publicó sólo
con una suscripción que nunca cobró** (owner 2026-09-26, G2-4; declarado por `DEC-METH-015`). Con
días en cero, `T8` no dispara, y el registro del evento no dice con qué título se publicó.
**Causa**: saber si fue cliente es leer historia de cobro, que `DEC-TRIAL-008` cerró. Pierde un
trial que no usó y no paga nada.”

---

## 5. Trabajo de aplicación sin decisión

R2 (cualquier opción de G2-1):

1. `V/03` §9, nota de `PB9`: `A5` → `A6` (§2.1, edición 1).
2. `V/03` §9, nota de `PB12`: ídem (§2.1, edición 2).
3. `V/03` §9, *«la moderación y el borrado del dueño»*: el párrafo del evento (§2.1, edición 3).
4. `N/01` §2.4, inventario de fila viva, fila 18: retirar el *«único»* (§2.1, edición 4).
5. `N/01` §2.4, fila 23 nueva, el `desde` de `A6` (§2.1, edición 5).
6. `N/01` §2.4, fila 24 nueva, el `desde` de `S32`, y retirar el *«único»* de la fila 19; recontar
   `G-R1-E` (§2.1, edición 6).

R9:

7. Contrato §3, después del párrafo *«El aviso es rápido»*, apartado nuevo **«Quién emite»**:
   “**Emite el aviso, en el mismo acto, toda escritura que cambia la respuesta del §2.1 para algún
   `(user, vertical)`**: que agrega o saca una fuente, o le cambia `referencia`, `hasta`, `alcance`,
   `objetivo`, `cobrada` o `piso`. Un addon `USER`/`GLOBAL` emite en cada vertical compatible de su
   producto (§2.7). **Una fecha que vence sin transición no emite** (§2.6): la cubre el
   reconciliador. **Éste es el censo de emisores, y va sin número, con la regla de la fila
   `cubierto`**: quien agregue un emisor agrega su sintagma acá en el mismo acto. Hoy: las filas de
   `B/03` §3.2 cuyo `desde` y `hacia` emiten distinto según *«qué emite cada estado»* (§2.6), el
   espejo del §10.1 incluido; `P1` sobre el primer pago acreditado de una fila; las filas que abren,
   extienden o cierran una cortesía; otorgar y revocar un grant (`NUCLEO/08` §3); `A2`, `A4`, `A5`
   y `A6`; y `T1`, `T2`, `T3`, `T4` y `T5`, que mueven la fuente de trial, en las dos
   implementaciones.”
8. Contrato §5.1, al final del primer párrafo: “**Y emite el aviso** en las transiciones de trial
   del censo del §3: es emisor desde el día uno, igual que la real (§5.2), así que `PB2` baja la
   ficha de un trial vencido en el acto de `T3` y no al día siguiente.”
9. `B/03` §3.2, antes de la tabla: “Las filas de esta tabla que cambian lo que la fila emite
   (`12-contrato…` §2.6) emiten el aviso del §3 del contrato en el mismo acto; el censo de
   emisores está allá y no se copia acá.”
10. Contrato §3, segundo párrafo: tachar “pero es el hecho que `T2` y `T5` esperan” por “pero es el
    hecho que `T2`, `T5` **y `T8`** esperan”.
11. `V/03` §9, ⚠️ del reconciliador, punto 3: agregar al final “**Y, desde 6c, si se pierde el del
    primer pago de quien publicó en `PRE_TRIAL` con una suscripción sin cobrar, `T8` no escribe la
    fila consumida y nadie la escribe después**: si alguna vez publica sin cobertura, `T1` le
    arranca un trial siendo alguien que ya fue cliente. Necesita un aviso perdido y una segunda
    publicación sin cobertura, y regala un trial, no cobra.” Y en `V/03` §2, ⚠️ punto 4, agregar
    “; si la persona estaba en `PRE_TRIAL`, `T8` tampoco dispara (§9, ⚠️ punto 3)”.
12. Contrato §2.1, fila `cubierto`, al principio de la columna de consumidores: agregar “**`PB1`**,
    que publica sólo con `cubierto` verdadero o si dispara `T1` (`V/03` §9; owner 2026-09-25);”.

Sueltos:

13. `V/spec.md` §(la línea 220): tachar “y quien pagó sin haber publicado consume su fila por `T8`,
    al primer pago” por “quien publicó con una suscripción que todavía no cobró consume su fila por
    `T8`, al primer pago, y quien pagó sin haber publicado sigue en `PRE_TRIAL` y la consume `T6`
    cuando publique”.
14. `V/03` §11: la condición de `PP1` pasa a “no hay otra postulación `PENDIENTE` del mismo correo,
    ni una `RECHAZADA` del mismo correo dentro de la espera configurable”; en la nota de `PP3`,
    tachar “habilita postular de nuevo pasada la espera configurable” por “la espera la mira
    `PP1`”. Párrafo nuevo debajo de la tabla: “**Reclamar no es una transición de esta máquina**: es
    el acto que vincula el Partner a un usuario (cap. 18 §2.4), y la postulación sigue `APROBADA`.
    El panel lee *«aprobada sin reclamar»* como `APROBADA` sin ese vínculo: un dato, no un estado.”
    Dónde vive el vínculo lo declara `V/02` junto con el resto de la cuenta de Partner.
15. `V/18` §2.5: tachar “y el admin puede darla de baja” por “y no se da de baja: es inofensiva y
    ninguna fila la saca de ahí”. NO cierra del capítulo: “**La lista de aprobadas sin reclamar
    sólo crece.** **Causa**: no hay daño que evitar (§2.5), y una baja sería un estado más.”
16. `N/07` §6, fila *«trial por vencer»*: agregar “**Si la vertical ya no admite altas**, salen
    igual —el trial sigue hasta `T3`— pero **sin invitar a suscribirse**: dicen que la vertical
    cierra”. Fila *«trial vencido — recuperación»*: agregar “**No arranca si la vertical no admite
    altas** cuando corre `T3`, **y se corta** si deja de admitirlas: cada envío relee
    `vertical.admite_altas` antes de salir, como los previos de retención releen la cobertura”. En
    `V/03` §2, efecto de `T3`: tachar “arranca la campaña de recuperación” por “arranca la campaña
    de recuperación **si la vertical admite altas** (`NUCLEO/07` §6)”.
17. `B/16`, NO cierra (residuo de 4a, §2.2 punto 3): “**Un complemento que autoriza durante la
    pausa de su principal cobra hasta que ella vuelva.** `S32` corre cuando la principal se pausa;
    si el complemento llega a `ACTIVE` después (`A2`), nadie lo pausa. Acotado por el tope de la
    pausa. **Causa**: el evento de `S32` es el paso a `PAUSED`, no el estado (FASE 9 vuelta 1).”
18. `V/03` §9, nota de `PB2`: después de “**Toma el mismo lock que `PB1`, en las dos ramas**”
    agregar “, **y dentro del lock relee `cubierto` —primera rama— y el cupo —segunda— antes de
    escribir**: si la relectura ya no da la condición, `PB2` no ocurre (la regla de `B/05` §2,
    `C1`, igual que `PB1`)”. En el párrafo del reconciliador, después de “corre la transición que el
    aviso habría disparado”, agregar “—que relee su condición dentro del lock—”.
19. `V/03` §2, *«el hash que ya consumió»*, al final del recuadro: “**El mismo `UNIQUE` resuelve la
    carrera entre dos escrituras de la fila** —`T8` al acreditarse el pago y `T6` en un `PB1`
    simultáneo, o `T1` contra `T8`—: la que choca **no es un error**, es la guarda de hash leída
    tarde. No dispara, y la transacción que la contenía sigue con esa lectura: en `PB1`, publica
    sólo si la persona está cubierta.”
20. `V/03` §2: tachar “**Las tres consecuencias del par, recorridas**” por “**Las consecuencias del
    par, recorridas**”; “**La tercera fila es nueva y es deliberada.**” por “**La fila de *«no
    declara evento, o días = 0»* es nueva y es deliberada.**”; “que es la cuarta fila de la tabla
    de arriba” por “que es la fila de *«la vertical no admite altas»* de la tabla de arriba”; el
    título “La tercera fila no es un estado final” por “La fila de los días en cero no es un estado
    final”. `V/18` §1: tachar “las tres dependen de dos números y una declaración” por “las cuatro
    dependen de dos números y una declaración”.

---

## 6. Key Learnings

1. `K-9` movió una responsabilidad entre dos filas de billing y dejó ciego al detector de la
   primera sin tocarlo: la cuarta comprobación **delega** en la condición de `B/16` §4.2, y una
   delegación hereda en silencio todo lo que se le saca al delegado. Cuando se achica un
   predicado, hay que buscar quién lo delega, no sólo quién lo copia.
2. Contra un estado **final** (`PURGED`) una consulta tardía es tan buena como un evento: no se
   pierde y no necesita red. Es la salida más barata cuando falta un canal hacia un hecho
   irreversible.
3. El §41 del PDR (*«sólo cuando queda efectivamente huérfano»*) descarta cancelar un addon por
   suspensión o moderación: el lugar para cortar el cobro sin tocar el objetivo es **pausar**, que
   es lo que 4a ya hizo para la pausa del cliente.
4. `DEC-ADDON-001` razonó sobre un addon con fecha de fin; un preapproval mensual no tiene esa
   premisa. Una decisión cuyo motivo es *«una fecha de fin y nada más que calcular»* no alcanza a
   los productos sin fecha de fin, y eso no es reabrirla.
5. Los censos sin número (la fila `cubierto`) funcionan para consumidores y no existían para
   emisores: un contrato con un solo evento necesita los dos, porque el que falta es el que nadie
   cablea.
6. El dominio del inventario de *«fila viva»* tenía un segundo faltante del mismo tipo que el del
   hallazgo (`S32`, que entró con 4a): recorrer el dominio encuentra lo que el hallazgo puntual no.
7. Una opción que corrige una población con un dato tomado en el momento equivocado (el bit de
   `PB1` para `T7`) puede abrir el error opuesto en la población vecina; conviene recorrerla contra
   las dos antes de recomendarla.

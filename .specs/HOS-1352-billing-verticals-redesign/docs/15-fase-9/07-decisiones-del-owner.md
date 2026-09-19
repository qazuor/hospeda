---
title: "FASE 9 · las decisiones del owner, una por una"
linear: HOS-1352
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 9
---

# FASE 9 — las decisiones del owner

Los cinco racimos resueltos dejaron **37 decisiones** que sólo puede tomar el owner. Este
documento las lleva **una por una**, con lo que se decidió y por qué.

**No reemplaza al decision log.** Las que resulten ser decisiones de arquitectura o de producto se
promueven a `01-decision-log.md` con su `DEC-` propia; el resto vive acá, que es donde la FASE 9
las va a buscar para aplicar el texto.

## Estado

| | |
|---|---|
| total | **37** |
| ya contestadas antes de abrir esta tanda | **4** |
| contestadas en la tanda | **1** |
| pendientes | **32** |

### Las cuatro que se contestaron antes, sin estar en la lista

| origen | qué | dónde quedó |
|---|---|---|
| `R5` #4 | autorizar la cuarta consulta read-only | corrida el 2026-09-19; resultado en `07-facts-inventory.md` |
| `R6` #2 (parte) | qué workflows corren en `epic/**` | `DEC-CI-001` |
| `R6` #4 | si `lighthouse` y `a11y-sweep` corren por PR | `DEC-CI-001` — **no corren** |
| — | qué se hace con los guards viejos y de dónde salen los nuevos | `DEC-METH-005` |

---

## D-01 · Un addon, solo, ¿da cobertura? — `R2` #6

**Decidido: NO. Las fuentes se parten en dos clases y `cubierto` cuenta sólo las de TÍTULO.**

> **`cubierto` se calcula sólo sobre `TRIAL`, `SUSCRIPCIÓN`, `CORTESÍA` y `GRANT`. `ADDON` es de**
> **clase COMPLEMENTO: agrega capacidades y nunca cobertura.**

**El problema que evita**, y estaba medido en el diseño, no era hipotético: `B/16` §4.2 dice que
*«la suspensión y la pausa no dejan huérfano a nada»* y que el reloj del addon *«no se congela»*
(`DEC-ADDON-001`). Con `cubierto` definido como *«al menos una fuente viva»* (contrato §2.1), en
cuanto `R2` agregue `ADDON` a las fuentes **un suspendido queda cubierto por su propio addon**:
dejó de pagar y sigue adentro. Es un fail-open **introducido por el arreglo**, que es la forma de
defecto que `DEC-METH-004` manda a evitar.

**Por qué esta salida y no congelar el reloj del addon**: porque **no inventa una regla, escribe
una que ya rige en dos capítulos**. El §38 exige *«una subscription válida compatible»* para
adquirir un addon, y `B/16` §2.4 declara su única excepción —*«un grant permanente vale como
título en lugar de la suscripción `ACTIVE`»*—. **Un addon nunca fue un título: era el complemento
de uno.**

**Lo que NO cierra, y queda separado a propósito**: si el cliente pierde días de addon que pagó
mientras su suscripción está suspendida. Es una decisión de producto, es legítima, y es otra —
congelar el reloj (`DEC-ADDON-001`) se puede decidir cuando el owner quiera, sin tocar esto.

- **Costo**: una línea en el §2.1 del contrato.
- **La clase no se transporta**: se deriva del `tipo`. Transportarla sería una segunda fuente de un
  dato que el `tipo` ya determina.
- **Dónde se aplica**: `12-contrato-de-cobertura.md` §2.1, más el §1.4 de
  [`02-R2-resuelto.md`](./02-R2-resuelto.md).

---

## D-02 · Los addons de una suscripción sucedida — `R1` #4

**Decidido: se RE-APUNTAN a la sucesora.** No se cancelan y no se rehacen: el addon deja de colgar
de la fila vieja y pasa a colgar de la nueva, en el mismo acto del upgrade. **Y lo mismo para el
contador de «N cobros» de una promo** (`B/14` §2.2).

**El argumento, en una línea**: *el objetivo del addon no desapareció, se sucedió*. La suscripción
vieja y la nueva son la misma relación comercial con la persona — que es exactamente lo que `R1`
acaba de modelar con `sucede_a`. Cancelar un addon ahí es **tratar una sucesión como una baja**.

**Qué pasaba si no se decidía**, y por eso el riesgo era alto: `B/16` §4.3 **cancela en el
proveedor, de inmediato, los addons recurrentes** que colgaban de la fila vieja. El cliente mejora
su plan y **pierde en el mismo acto addons que pagó**. `DEC-SUB-007` impl. 4 lo había dejado
**explícitamente abierto** —*«hay que decidir si siguen colgando del cliente o si hay que
re-vincularlos»*— como el hueco `E-ADDON-04`, y nadie volvió.

**Por qué importaba ahora y no antes**: mientras el candado de `R1` bloqueaba el upgrade, esto era
teórico. `R1` lo volvió ejecutable.

**Lo que NO se decidió acá**: colgar los addons **del cliente** en vez de la suscripción. Es más
limpio conceptualmente y es **un rediseño del capítulo 16**, no una decisión de esta fase. Se
discute el día que un addon tenga que sobrevivir a no tener ninguna suscripción viva.

- **Costo**: medio — el cambio 18 del §2 de [`05-R1-resuelto.md`](./05-R1-resuelto.md), más el
  contador de promos de `B/14` §2.2.
- **Dónde se aplica**: `B/16` §4.3 y `B/14` §2.2.

---

## D-03 · La fecha de primer cobro de la sucesora se GUARDA — `R1` #5

**Decidido: se agrega la columna.** `subscription` guarda la fecha de primer cobro con la que
nació la fila.

**Qué convierte**: `D8` —*«una fecha de primer cobro futura es la precondición de seguridad de todo
cambio de plan o de ciclo»* (`NUCLEO/04` §3)— pasa de **invariante recordable** a **verificable**.
Sin la columna no hay forma de comprobar que se cumplió **ni de escribir el guard `G-R1-B`**, y su
incumplimiento **es literalmente el doble cobro**.

**El argumento que lo decide es del propio programa**: el capítulo 04 clasifica cada invariante por
quién lo sostiene, y define el nivel «base» como **el que no admite ningún camino que lo esquive**.
Un invariante *de servicio*, para la precondición del mecanismo más caro del sistema, es el nivel
equivocado. Hoy hay **ocho** sostenidos por la base; éste es el noveno.

**Por qué no releerla del proveedor**: lo prohíbe `D6`, *«el buscador del proveedor no es fuente de
verdad de nada»*. Y no serviría igual: un guard tiene que poder correr sin red.

- **Costo**: bajo — una columna, en un modelo que todavía no existe.
- **Dónde se aplica**: `B/02-modelo-de-datos.md` §2.2 (la tabla `subscription`) y `NUCLEO/04` §3
  (subir `D8` de nivel).

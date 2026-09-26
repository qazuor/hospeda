---
title: "FASE 9 vuelta 1 · las decisiones del owner"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 9
---

# FASE 9 vuelta 1 — las decisiones del owner

Las preguntas de los cinco grupos (`01-` a `05-`), contestadas por el owner una por una el
2026-09-26. Cada fila nombra la opción elegida con su número en el documento del grupo, que es
donde están las opciones enteras, el costo y el ejemplo con Juan.

| pregunta | qué pregunta | elige | ¿la recomendada? |
|---|---|---|---|
| `G1-1` | por qué camino estrena el trial el dueño del corte, cuya ficha queda abajo | **1** — `PB1` sale también de `UNPUBLISHED_BY_BILLING`, sólo si arranca un trial | sí |
| `G1-2` | cómo nacen la ficha borrada por su dueño y la `REJECTED` de moderación | **1** — la borrada nace `PURGED` con el contenido borrado; `REJECTED` no se traduce y se lista | sí |
| `G1-3` | qué plan anclan los dos grants del owner | **1** — el vendible de `rank` más alto de Alojamiento, en la vertical en que tenían `comp` | sí |
| `G1-4` | qué se hace con lo pagado en el sistema viejo por un período o un addon que el corte corta | **1** — se acepta y se declara; el trial de `2g` lo compensa de hecho y el aviso lo dice | **no** (la recomendada era la 2, devolver completo antes del corte; el owner eligió la posición coherente con `2a` y `2d`) |
| `G1-5` | qué pasa en `PURGED` con las reseñas de terceros y la conexión de calendario | **1** — las reseñas se conservan sin mostrarse; el calendario se desconecta y su token se revoca y se borra | sí |
| `G2-1` | por dónde se entera billing de que una ficha llegó a `PURGED` | **2** — un hecho empujado de verticales a billing en el mismo acto de `PB9`/`PB12`, con la consulta `fichaPurgada` leída por el barrido como red | **no** (la recomendada era la 1, sólo la consulta con hasta un día de atraso; el owner no acepta ni un cobro de más) |
| `G2-2` | qué le pasa al addon recurrente cuando la principal queda `SUSPENDED` | **1** — la suspensión pausa el complemento por `S32` (4a extendida) y `S33` lo reanuda al volver | sí |
| `G2-3` | si el destaque de una ficha que no se ve, con la principal viva, se sigue cobrando | **1** — se sigue cobrando, y el acto que lo causa lo dice y ofrece la baja | sí |
| `G2-4` | si `T7` consume el trial de quien publicó sólo con una suscripción que nunca cobró | **1** — sí, y se declara en el ⚠️ de `T7` | sí |
| `G3-1` | si el cobro en vuelo del corte que sale bien se le propone devolver | **2** — no se devuelve: se asienta sobre la lápida sin marca y se declara en el «NO cierra» de `B/21` | **no** (la recomendada era la 1; el owner eligió la posición coherente con `2d` y con su `G1-4`) |
| `G3-2` | dónde vive el cobro de un preapproval desconocido que no nombra ninguna fila | **1** — una lápida de recepción con la forma de fila de R6, con el `payment` y la marca colgados | sí |
| `G4-1` | si se cierran las ventas, vieja y nueva, durante la ventana del corte | **1** — una regla de Cloudflare cierra las rutas de alta: en el viejo desde el paso 0b, en el nuevo hasta el paso 5 | sí |
| `G4-2` | cómo entran al contrato las lecturas y la escritura legítimas que hoy no están | **2** — mixto: lo que decide (`ficha`, `políticaDeAddon`, `extenderTrial`) al §4.1; lo que muestra, a una capa de composición declarada | sí |
| `G4-3` | cuánto vale la red de tiempo del caché de entitlements | **1** — 15 minutos | sí |
| `G5-1` | si una acción administrativa puede tener `actor = sujeto` | **1** — no, nunca: el paso 3 la rechaza y la hace otra cuenta con el permiso | sí |
| `G5-2` | si el admin tiene escrituras sobre fichas ajenas fuera de las catorce | **2** — una fila nueva, «editar el contenido de una ficha ajena» (sin publicar, destacar ni borrar): las acciones administrativas pasan de 14 a 15 | sí |
| `G5-3` | si la vuelta anticipada de una pausa sigue libre | **2** — se acepta y se declara, con detector: el barrido lista en el resumen las pausas de menos de un ciclo que cruzaron una fecha de cobro salteada | **no** (la recomendada era la 1, volver en el aniversario mensual; el owner mantiene «volver cuando quiera» del §26.2 a la letra) |
| `G5-4` | cómo se ejecuta una revocación hasta que entre el botón | **1** — construir ya la fila de la revocación (dentro de los 10 días; cancela el preapproval, corta el servicio en el acto y crea `RF1` por el total) | sí |
| `G5-5` | qué unidad construye `G13` | **1** — `V4`, como dice el contrato | sí |
| 📌 A | precisar el «Problema» de `DEC-ARCH-005` (la pasarela ya está decidida) | **OK** al texto de `05-…` §6 | — |
| 📌 B | precisar la parte 3 de `DEC-RF-001` (el reintento de un parcial nunca supera lo confirmado) | **OK** al texto de `05-…` §6 | — |

**Resumen**: 19 preguntas y 2 OK de registro. **4 elegidas contra la recomendación**: `G1-4`, `G2-1`, `G3-1` y `G5-3`. Las acciones administrativas pasan de **14 a 15** (`G5-2`).

## Segunda tanda de OK (2026-09-26, tarde)

| ítem | qué | respuesta |
|---|---|---|
| A–G | siete cambios al log propuestos por G2 y G5 (`12-` y `15-` §3): implicación en `DEC-ARCH-006`; 📌 en `DEC-RF-008`, `DEC-TEST-001`, `DEC-SUB-010` y `DEC-RF-001` parte 4; nuevas `DEC-AUTH-002` y `DEC-AUTH-003` | **OK** a las siete |
| H | implicación en `DEC-ARCH-006` por `G4-2` (`14-` §3) | **OK** |
| I | 📌 en `DEC-MIG-002` por `G4-1` (`14-` §3) | **OK** |
| J | la revocación del token de calendario de `G1-5`: `V9` para `PB9`, `V6` para `PB12` | **OK** |
| K | la unidad de billing que consume el empuje de `G2-1`: `B10`, dueña de `A6` | **OK** |
| L | la unidad que construye la acción 15 de `G5-2`: `V8` | **OK** |
| M | `S36` dispara `S18` cuando la fila es predecesora de una sucesión en curso, como `S23` y `S24` | **OK** |
| P1 | el detector de la cortesía diferida con la sucesora ya en `GRACE_PERIOD` (`17-` §2) | **1** — el detector queda en `ACTIVE` y el hueco se declara en `B/09` §3 |
| P2 | por dónde extiende un trial `SUPER_ADMIN` (`17-` §3) | **1** — acción de verticales fuera del contrato: `T4` con origen `SUPER_ADMIN` y motivo obligatorio, pasa el techo; la construye `V4` |

## Tercera tanda: el cierre de los casos vecinos (`26-` y `27-`)

| pregunta | qué | elige | ¿la recomendada? |
|---|---|---|---|
| `X-1` | quién cancela el preapproval de una lápida de recepción | **1** — la cancela el handler al escribirla, y entra en la salvedad 4 (el barrido reintenta) | sí |
| `X-2` | si `S36` (la revocación) sale también de `PAUSED` | **1** — sí: cancela el preapproval pausado (`EX-11`), corta el servicio como `S22`, cierra la pausa y crea `RF1` por el total | sí |
| `Y-1` | qué se hace con la `Preference` del upgrade del sistema viejo, que no vence | **1** — la herramienta del corte las vence por API (`expire` de qzpay) en el paso 1a y las relee; pide una medición en el paso 0 (fila nueva de la matriz, con OK aparte) | sí |
| `Y-2` | si la regla 5 de `V/17` protege contra la misma persona con dos cuentas | **1** — se declara, con detector: el resumen de `DEC-OBS-001` lista cada acción administrativa que mueve plata, con actor y sujeto | sí |
| L1–L6 | log: implicaciones 4 y 5 de `DEC-ARCH-006` (orden del empuje; `admiteDestaque`), 📌 de `DEC-SUB-010` (detector por regalo neto), 📌 de `DEC-RF-001` parte 4 (`S36` desde `PAUSED`), 📌 en `DEC-AUTH-002` (cuentas, no personas; detector); matriz: fila nueva `UNKNOWN` para medir el `expire` de la `Preference` (98 → 99, 5 `UNKNOWN`) | **OK** a las seis | — |
| cláusula de `Y-2` | que el 📌 de `DEC-AUTH-002` diga que la confirmación por una segunda persona entra cuando haya otra persona con el permiso | **sí** | sí |
| 📌 `DEC-CONC-002` | la lápida de recepción cancela su preapproval y entra en la salvedad 4 (`X-1`) | **OK** | — |

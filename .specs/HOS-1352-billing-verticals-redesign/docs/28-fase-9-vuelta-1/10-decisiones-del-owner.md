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

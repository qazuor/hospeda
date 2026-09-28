---
title: "FASE 9 vuelta 2 · las decisiones del owner sobre la verificación"
linear: HOS-1352
statusSource: linear
created: 2026-09-27
updated: 2026-09-27
status: CURRENT
fase: 9
---

# FASE 9 vuelta 2: las decisiones del owner sobre la verificación

La verificación de la vuelta 2 ([`20-veredictos.md`](./20-veredictos.md)) dejó 55 caminos que
dejan de llegar, 1 que sigue (`F-8V2B3-002`), 13 casos vecinos nuevos y ninguno CRITICA. El owner
eligió cerrar la vuelta antes de pasar a la FASE 5 (2026-09-27, noche) y contestó las diez
preguntas del § 4 de `20-` en dos lotes con letras. Cada fila nombra la opción elegida; el texto de
las opciones está en el informe que se cita.

| pregunta | qué pregunta | elige | ¿la recomendada? |
|---|---|---|---|
| `V2-a` | con qué fecha se decide que un cobro sobre la lápida del corte es posterior al corte (`F-8V2B3-002`, `21-` P1) | **1**: la fecha del pago que aprobó el registro, no el `date_created` del registro; el paso 0 mide qué campo del pago, leído por id, la trae; si no hay campo confiable, vuelve al owner | sí |
| `V2-b` | `S22` desde `PAUSED · COURTESY` sobre una sucesora que vive del crédito (`21-` P2) | **1**: con crédito sin consumir va a `CANCEL_SCHEDULED` con fin en el fin del crédito, como `S11` desde `R17` | sí |
| `V2-c` | la selección de `S32` en la baja suma `CANCEL_SCHEDULED` a la exclusión (`21-` P3, `23-` P5) | **1**: confirmada, es lo aplicado por el grupo A (`11-` §1) | sí |
| `V2-d` | `S26` y el complemento `USER`/`GLOBAL` (`N-A-01`, `21-` P4) | **1**: `S26` aplica la selección de `S32`, como `S11`, y el `S12` de esos complementos abre el motivo 15 | sí |
| `V2-e` | el `USER`/`GLOBAL` cuyo último título sin pausar muere por otra vía (`N-A-03`, `21-` P5) | **1**: cuando uno de los catorce disparadores saca una principal de las filas vivas y la orfandad no se cumple sólo porque las otras compatibles están `PAUSED` o `SUSPENDED`, corre `S32` sobre el complemento | sí |
| `V2-f` | el cobro por debajo del esperado (`16-` §5, `23-` P1) | **1**: una línea del resumen de `DEC-OBS-001` con el sujeto y la diferencia, sin marca y sin mover el conteo de motivos | sí |
| `V2-g` | acortar la cola de una vertical discontinuada no tiene fila en el catálogo (`18-` §5, `23-` P2) | **1**: entra en la fila 16 como «discontinuar una vertical o acortar su cola», mismo instrumento y permiso; la confirmación dice cuántos compromisos se reembolsan; no mueve conteos | sí |
| `V2-h` | la acción 16 escribe en verticales fuera del contrato (`N-C-04`, `23-` P3) | **1**: la acción 16 se declara capa de composición, fuera de las máquinas de las dos épicas, y la exención la nombra a ella sola | sí |
| `V2-i` | quién reintenta la mitad de billing de la acción 16 (`N-C-05`, `23-` P4) | **1**: automático, con la firma y la correlación del `SUPER_ADMIN` que confirmó, como la re-emisión de `S9`, dicho en `V/17` §3.3 como la excepción que no es una acción nueva | sí |
| `V2-j` | Outlook en la lista del seudónimo de `R23` (`22-` P1) | **Ninguna de las tres todavía**: el owner pide investigar en la web qué proveedores hay que listar para normalizar, y medir o probar lo que la web no confirme. La respuesta se registra en [`25-lista-de-proveedores-del-seudonimo.md`](./25-lista-de-proveedores-del-seudonimo.md) y vuelve al owner antes de aplicarse | n/a (pide información antes de elegir) |
| `V2-k` | un guard para la lista cerrada de `PURGED` (`22-` P2) | **1**: un guard que recorre el esquema (FK a las tres tablas y `entity_type`) y falla si una tabla no tiene fila en `V/02` §4.1, con la forma de `G-R6-B` | sí |
| `V2-l` | la clase del correo de la alerta de precio cerrada (`22-` P3, `23-` P5) | **1**: transaccional, es lo aplicado | sí |

Ninguna se eligió contra la recomendación.

## `V2-j`, contestada con el informe de `25-` (2026-09-28)

La investigación mostró que Outlook, Hotmail y Live no ignoran los puntos (tres fuentes
secundarias coinciden, ninguna en contra) y que el diseño de `R23` los quitaba. El owner contestó
un lote de cuatro:

| pregunta | qué pregunta | elige | ¿la recomendada? |
|---|---|---|---|
| `V2-j1` | qué se normaliza en los dominios de Microsoft consumidor | **1**: sólo se quita el `+alias`; los puntos quedan y los dominios (outlook, hotmail, live, msn y sus variantes por país) no se unifican; si la medición de `V2-j4` muestra que ignora los puntos, vuelve al owner | sí |
| `V2-j2` | la lista cerrada de proveedores | **1**: la del §5 de `25-` (Gmail unifica googlemail, quita puntos y `+`; Microsoft sólo `+`; Proton e iCloud unifican sus dominios y quitan `+`, puntos sujetos a medición; el resto tal cual) | sí |
| `V2-j3` | el `+alias` en dominios propios (Workspace, Microsoft 365, Fastmail) | **1**: se quita el `+alias` en todos los dominios | sí |
| `V2-j4` | cómo se mide lo que la web no confirma | **1**: en el paso 0 del corte, la distribución de dominios de la tabla de usuarios y la prueba de unos 30 correos del §4 de `25-`, con cuentas de prueba que crea el owner; fila nueva de matriz con OK del owner | sí |

## Los casos vecinos del tramo billing (2026-09-28)

Salieron al aplicar (`26-aplicacion-verificacion-billing.md` §5) y pedían elegir. El owner contestó
un lote:

| pregunta | qué pregunta | elige | ¿la recomendada? |
|---|---|---|---|
| `V2-m` | si el corte espera la medición de `V2-a` | **1**: el paso 1b no arranca sin ese dato, como `EX-42` con el 1a; si no aparece, vuelve al owner antes del corte | sí |
| `V2-n` | cómo sabe `S21`, hasta 60 días después, que al `USER`/`GLOBAL` lo canceló `S26` | **1**: lo deduce de que la vertical de la principal tiene una fila en `vertical_discontinuation`; el `S12`-vía-`S26` de `LISTING` y `VERTICAL_SUBSCRIPTION` pasa también del motivo 14 al 15 | sí |
| `V2-o` | `S36` sobre un pago retenido por `S19` | **1**: `S36` lo devuelve por `RF1` y la rama 6 no abre marca sobre ese pago | sí |
| `V2-p` | la marca 7 sobre la sonda del manifiesto nace proponiendo devolver | **1**: se declara; el owner la levanta sin devolver, sin motivo nuevo | sí |
| `V2-q` | la marca 22 abierta sobre un complemento que `S7` ya canceló | **1**: la levanta una persona después de ver que el complemento ya no cobra | sí |
| `V2-r` | el detector sobre un plan anual del sistema viejo | **1**: el paso 0 cuenta las suscripciones anuales vivas del viejo; fila nueva de matriz con OK del owner | sí |

Los arreglos de texto sin decisión que lista `20-` § 4 se aplican en la misma tanda.

## Los casos vecinos del tramo de verticales (2026-09-28)

Salieron al aplicar (`27-aplicacion-verificacion-verticales.md` §5 y lo que ese tramo decidió por
su cuenta). El owner contestó un lote:

| pregunta | qué pregunta | elige | ¿la recomendada? |
|---|---|---|---|
| `V2-s` | el sujeto de la acción 16 | **1**: el sujeto es la vertical; el resumen de `DEC-OBS-001` muestra la vertical y cuántos dueños alcanza; el `SUPER_ADMIN` que además es dueño en esa vertical queda declarado y visible en ese resumen, sin regla nueva | sí |
| `V2-t` | las páginas de destino en el paso 4c del corte | **1**: el 4c suma una purga por destino (22) | sí |
| `V2-u` | `PB4`, `PB6` y `PB12` con la carrera de `PB10` | **1**: las tres toman el lock, como `PB10`; se vacía la excepción de las que sólo liberan cupo | sí |
| `V2-v` | Fastmail y Yandex quedaban «tal cual» con `+` documentado | **1**: se suman a la regla del `+`, coherente con `V2-j3` | sí |
| `V2-w` | la medición de `V2-j4` lee correos de producción | **1**: restricción escrita: la herramienta sólo cuenta dominios y no exporta ni guarda casillas | sí |
| `V2-x` | las cinco elecciones que el tramo de verticales hizo por su cuenta (dominio no nombrado = dominio propio; lo «a medir» no se aplica sin medir; `G-R9` en V6; `revalidation_config` en lo que `PURGED` no toca; `PB9` espera el hecho 4) | **1**: confirmadas | sí |

## El lote del log y la matriz, y los últimos casos vecinos (2026-09-28)

El owner aprobó en un lote lo propuesto en `28-aplicacion-verificacion-cierre.md` §6 y contestó los
casos vecinos que dejó esa tanda (§ casos vecinos de `28-`). Contestó «a» en los cinco casos
vecinos, que se leyó como la opción 1, la recomendada.

| pregunta | qué pregunta | elige | ¿la recomendada? |
|---|---|---|---|
| `V2-y` | las tres filas de matriz (`EX-48`, `EX-49`, `EX-50`) y los quince 📌 del log | **1**: aprobado todo | sí |
| `V2-z1` | la regla de `V2-n` manda al motivo 15 también una baja por `S11` pedida antes del anuncio | **1**: se acepta, escrito como costo en `B/03` | sí |
| `V2-z2` | `PB5` tiene la carrera de `PB4`, `PB6`, `PB10` y `PB12` | **1**: toma el lock, como `V2-u` | sí |
| `V2-z3` | el tope de purgas del borde no está escrito | **1**: se verifica en el paso 0 junto a `EX-49`, sin fila nueva | sí |
| `V2-z4` | `EX-50` pide también el `expire_date` del anual | **1**: se acorta al conteo; si hay anuales vivos, el vencimiento se mide ahí | sí |
| `V2-z5` | «la baja tiene CUATRO filas» en `B/03` | **1**: se deja, cuenta filas | sí |

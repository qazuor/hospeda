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

Los arreglos de texto sin decisión que lista `20-` § 4 se aplican en la misma tanda.

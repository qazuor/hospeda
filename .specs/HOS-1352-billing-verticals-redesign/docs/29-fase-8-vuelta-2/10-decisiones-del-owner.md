---
title: "FASE 8 vuelta 2 · las decisiones del owner"
linear: HOS-1352
statusSource: linear
created: 2026-09-27
updated: 2026-09-27
status: CURRENT
fase: 9
---

# FASE 8 vuelta 2 — las decisiones del owner

La vuelta 2 es la última del tope de `DEC-METH-013`. Dejó una crítica de dinero
(`F-8V2B1-001`, racimo R1 de [`00-hallazgos.md`](./00-hallazgos.md)), que la atribución
([`01-atribucion.md`](./01-atribucion.md)) dictaminó **preexistente**. Por las cláusulas 3 y 4 de
esa decisión, el owner elige su destino caso por caso y la lee antes. Las preguntas salen del §6
del consolidado y se contestan una por vez. Cada fila nombra la opción elegida.

| pregunta | qué pregunta | elige | ¿la recomendada? |
|---|---|---|---|
| `R1-a` | qué pasa con el complemento recurrente cuando la principal pasa a `CANCEL_SCHEDULED` por la baja (`S11`) | **1** — `S11` cancela en el proveedor, en el mismo acto y con la misma regla que la principal, los complementos recurrentes que dependen de ella (la selección de `S32`); siguen dando servicio hasta el fin de servicio y `S12` los cierra | sí |
| `R1-b` | si al addon recurrente se le devuelve la plata cuando la orfandad la causó una revocación (`S36`) | **1** — `S36` entra a la lista de `B/16` §4.3 (catorce); el último cobro del addon se devuelve por `RF1` sólo si cae dentro de sus propios 10 días corridos; si no, motivo 14, no se devuelve | sí |
| `R2` | si «no devolver» de `G3-1` se sostiene con la población real (registro que reintenta un ciclo, cancelación que se deshace, altas que siguen) | **1** — «no devolver» vale sólo para la ventana del corte; un cobro sobre una lápida posterior al día del corte abre marca y propone devolver; el paso 0 mide si cancelar corta el reciclado y si la cancelación releída horas después sigue `cancelled`; la población se lee de la re-verificación y no se fija; un detector corre después del corte, con dueño y fecha | sí (precisa `G3-1`, no lo revierte) |
| `R4` | qué identidad, ejecutor de recuperación, detector y devolución tiene el cobro de un addon de única vez | **1** — la clave de `/v1/orders` sale del pedido del cliente y no de la llamada (el doble clic reusa la orden); `A3` reenvía con la misma clave antes de abandonar; el barrido suma la comprobación «orden pagada sin instancia viva» → marca; la devolución va por la acción administrativa 14 | sí |
| `R5` | quién ejecuta sobre las fichas lo del día del fin de servicio (hecho 4, `PB2`, invalidación) y quién escribe `vertical.fin_de_servicio` | **1** — billing sólo avisa: la cobertura cae a falso por el contrato §2.6 con el aviso que ya existe, y verticales ejecuta `PB2`, el hecho 4 y la invalidación; `fin_de_servicio` lo calcula billing y verticales lo lee por una pregunta nueva del §4.1; el contrato conserva `extenderTrial` como única escritura | sí |
| `R9` | qué pasa en `PURGED` con lo que cuelga de la ficha además de reseñas y calendario | **1** — `G1-5` generalizado por dueño del dato: lo del tercero se conserva (la conversación queda en sólo lectura con «esta ficha ya no existe», la FK admite ficha ausente); la alerta de precio se cierra con aviso al turista; lo del dueño que sólo sirve a la ficha (promociones, listados externos, ocupación, datos de IA) se borra con el contenido; lista cerrada en el capítulo | sí |
| `R15` | si la cartera del corte que contrata sin publicar consume su trial | **1** — una ficha que vuelve por `PB3`/`PB7` bajo un título que paga cuenta como ejercicio del evento para `T8` y consume el trial; no cambia qué es publicar para `T1`; se define el lock de la máquina de trial | sí |
| `R17` | si el crédito de `DEC-SUB-006` cuenta como período pagado para la baja | **1** — cuenta: `fin_de_servicio = max(fórmula, fin del crédito)`; la cortesía re-emitida por `S9` arranca al agotarse el crédito; `S36` sobre una sucesora sin pagos devuelve el de la predecesora por `sucedida_por` (precisa lo cerrado el 2026-09-25 sobre `S11`, que pensaba sólo en la ventana de 72 h) | sí |
| `R21` | si el titular de una autorización que sólo conoce el proveedor entra a la población a avisar | **1** — el manifiesto del 1b trae el pagador (`payer_email`) y esa persona entra a la población a avisar y a la lista del owner; lo que pierde queda declarado como en `G1-4` | sí |
| `R7` | a qué cuenta vincula el reclamo de un Partner aprobado | **1** — el reclamo exige sesión y vincula a la cuenta que reclama; si la cuenta del correo no está verificada, el reclamo la verifica (el link llega sólo a quien lee la casilla); un correo nunca verificado no puede cambiarse llevándose vínculos; la guarda de `PP1` pasa a restricción de la base y el admin puede anular una espera | sí |

**Resumen**: 10 preguntas, todas con la opción recomendada. El resto de los racimos (R3, R6, R8,
R10–R14, R16, R18–R20, R22–R28) es escritura sin decisión de producto (consolidado §6).

## Por qué `R1-a`

Juan se da de baja el 10/10 y su principal queda en `CANCEL_SCHEDULED`, con servicio hasta el
31/10. Hasta ahora el preapproval de su destaque recurrente seguía vivo, así que el proveedor le
cobraba otro mes el 20/10, y el motivo 14 proponía quedarse con ese cobro. Con la opción 1 los dos
preapprovals se cancelan el 10/10, el destaque se sigue viendo hasta el 31/10, y Juan no paga nada
de más. No agrega mecanismo: replica lo que `S11` ya hace con la principal (`DEC-SUB-009`) y lo que
`G2-2` hizo con la pausa y la suspensión.

**Descartadas**: la 2 (dejar el cobro y que el motivo 14 proponga devolver: plata que entra y sale,
con devolución manual por `DEC-RF-002`) y la 3 (declarar en un «NO cierra»: plata cobrada de más en
el camino principal de la baja, contra la razón de `DEC-SUB-009`).

## Pendiente de aplicar

Se aplica en la FASE 9 de esta vuelta, junto con el gemelo generado `F-8V2D1-001`
(`S36` no figura en la lista de disparadores de orfandad de `B/16` §4.3).

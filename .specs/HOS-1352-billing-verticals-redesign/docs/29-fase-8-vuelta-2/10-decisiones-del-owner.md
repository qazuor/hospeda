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
| `R18` | qué hace el espejo con una fila que cobró mientras `S6`/`S3` ya mandaban cancelar | **1** — la lleva a `CANCEL_SCHEDULED`: recibe el período pagado y termina al final; la pantalla le dice que para seguir se vuelve a suscribir (precedente del owner: `S7`) | sí |
| `R20` | quién compara el importe efectivamente cobrado (`F-8V2B3-001`) | **1** — el barrido compara el importe de cada cobro aprobado contra el esperado de su período y abre un motivo nuevo, el 24, que propone devolver la diferencia; la promo se decrementa sólo si el cobro salió con el descuento | sí |
| `Q-ALTAS` | quién escribe `vertical.admite_altas` el día del anuncio de una discontinuación | **1** — el acto del `SUPER_ADMIN` tiene dos mitades: verticales escribe `admite_altas = no` y billing la fecha y los avisos; la acción administrativa existente orquesta, primero verticales y después billing | sí |
| `R24` | cómo se cierra una vertical sin planes vendibles (`F-8V2A3-005`) | **1** — `T1` exige una versión vigente y vendible, la pantalla dice que la vertical no tiene planes disponibles, y se tacha en `B/10` §4.1 que retirar todos los vendibles cierra la vertical: cerrarla es discontinuarla | sí |
| `Q-FECHA` | dónde guarda billing la fecha de fin de servicio (pregunta 1 de `13-`) | **1** — una fila de billing por vertical discontinuada (anuncio y fecha), escrita por el acto del día 0 y reescrita por el acortamiento de `B/10` §4.4; se deriva de la decisión `R5` («verticales la lee por una pregunta»), que descarta la copia en verticales | sí (derivada de `R5`, sin pregunta aparte) |
| `R11-3b` | a qué vertical se anclan los dos grants del owner en el 3b | **Alojamiento**, a la letra de `G1-3`. Hecho aportado por el owner: las dos `comp` que existen son suyas y de Alojamiento, y no va a otorgar otra hasta terminar el programa. Se revierte la corrección «de la vertical en que tenían `comp`» y no hace falta medirlo en el paso 0 | no (la recomendada era dejar la corrección y medir; el owner aporta el hecho que la vuelve innecesaria) |
| `R21-b` | cuándo recibe el aviso previo el titular que sólo conoce el proveedor | **1** — una pasada de sólo lectura sobre el proveedor antes del aviso previo lista las autorizaciones vivas con su `payer_email` y suma a la población a los titulares desconocidos por la base; el 1b cancela después, como está | sí |
| `R3-G4-1` | si la frontera del paso 3 de `G4-1` incluye el 4 y el 4b (el orden nuevo de R3) | **1** — sí; el efecto no cambia porque el backup restaura las lápidas; va con el 📌 de `DEC-MIG-003` | sí |
| `R1-c` | los días de addon pagados que pasan del fin de servicio de la principal (residuo de `R1-a`) | **2** — el orden queda fijo: `S21` toma el complemento en la fecha de fin, antes que su `S12`, y abre el motivo 14, que propone **no devolver**; una persona ve el caso y puede apartarse | **no** (la recomendada era la 1, marca que propone devolver la parte proporcional) |
| `R7-b` | qué hace el cambio de un correo nunca verificado en una cuenta con vínculo de Partner | **1** — se rechaza mientras haya vínculo y la pantalla deriva a soporte (lo ya aplicado) | sí |
| `R23` | en qué dominios se sacan puntos y `+alias` para el seudónimo del trial | **1** — sólo en una lista cerrada de proveedores que los ignoran (Gmail, Outlook y los que se midan); en los demás el correo se compara tal cual; cambiar la lista no recalcula filas viejas y se declara (precisa `DEC-TRIAL-004`) | sí |
| `R25` | si el asiento de un cobro sobre una lápida emite comprobante | **1** — sí, por `DEC-LEGAL-001`; queda en su fila sin enviarse (lo ya aplicado) | sí |
| `R27` | dónde va el paso 4c (revalidar las páginas públicas) | **1** — después del 4b, fuera de la rama de aborto (lo ya aplicado) | sí |
| `R9-b` | cuándo se cuenta que Gastronomía y Experiencia den cero | **1** — también antes del 1a, y el corte no arranca si ahí ya aparece una fila; el paso 2 queda como segundo control | sí |
| `R18-b` | qué pasa con los complementos cuando el espejo de `R18` (y `S7`) lleva la principal a `CANCEL_SCHEDULED` | **1** — el espejo y `S7` cancelan los complementos como `S11` (`R1-a`) | sí |
| `Q-ALTAS-b` | qué pasa si falla la mitad de billing del acto de discontinuar | **1** — la acción reintenta la mitad de billing hasta que entra y le muestra al admin que el acto quedó a medias; nunca deshace la mitad de verticales | sí |
| `Q-ACC16` | si el acto de discontinuar una vertical entra al catálogo de acciones administrativas | **1** — sí, acción 16 «discontinuar una vertical», permiso de `SUPER_ADMIN`, auditada y con confirmación; se recuentan las quince y sus espejos | sí |
| `Q-ANUNCIO` | qué instante cuenta como anuncio si la mitad de billing entra tarde | **1** — el de billing, que es cuando salen los avisos; las altas quedan cerradas de más y nadie recibe menos aviso del prometido | sí |
| `Q-ESTADO` | si las nueve decisiones con 📌 del lote suman su marca al *Estado* | **1** — sí, por la convención del log; el contador «precisadas sin SUPERSEDED» pasa a 44 | sí |
| `Q-UNKNOWN` | si se arman ya las filas de `EX-43`…`EX-47` en las tablas de `UNKNOWN` de billing | **1** — sí, escritura sin decisión | sí |

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

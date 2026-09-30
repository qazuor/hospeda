---
title: "FASE 8 vuelta 3 · las decisiones del owner"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 9
---

# FASE 8 vuelta 3 — las decisiones del owner

La vuelta 3 es la excepción declarada de `DEC-METH-016` al tope de `DEC-METH-013`. Dejó una
crítica levantada (`F-8V3A1-001`, racimo R1 de [`00-hallazgos.md`](./00-hallazgos.md)), que la
atribución ([`01-atribucion.md`](./01-atribucion.md)) dictaminó **preexistente**, y que el
consolidador propuso bajar a ALTA. Por las cláusulas 3 y 4 de `DEC-METH-013`, el owner elige su
destino y la lee antes. Las preguntas salen del §6 del consolidado y se contestan en lotes con
letras. Cada fila nombra la opción elegida.

| lote | racimo | qué pregunta | elige | ¿la recomendada? |
|---|---|---|---|---|
| A | R1 (`F-8V3A1-001`) | qué se hace con la única crítica: el reclamo de Partner verifica la cuenta del ocupante y el ocupante sigue adentro | **1**: baja a ALTA y se arregla en el diseño; reclamar verifica la cuenta y cierra todas sus sesiones y credenciales previas, y el link de reclamo se consume una sola vez | sí |
| B | R1 (`F-8V3A2-002`) | si una cuenta puede ser dueña de más de un Partner | **1**: una cuenta, un Partner; la base lo impide y el reclamo de un segundo deriva a soporte (el segundo negocio se reclama con otra cuenta) | sí |
| C | R2 | cómo se ordena la prueba gratis del corte respecto del catálogo que la define | **1**: el catálogo se carga en el paso 3, antes de las pruebas, como ya se hizo con los plazos; sin paso nuevo | sí |
| D | R4 | cuándo se puede dar de baja una cuenta con suscripción (`puedeCobrarle` en la ventana de reintento de la cancelación) | **1**: `puedeCobrarle` contesta sobre la cancelación confirmada por Mercado Pago; mientras no la confirme, contesta «sí» y la baja espera (hasta 3 días) | sí |
| E | R6 | qué hace el reenvío tardío de `A3` sobre una compra de addon mientras `EX-43` siga `UNKNOWN` | **1**: `A3` sólo confirma, nunca crea; sin id de orden abandona sin reenviar; la comprobación de órdenes pagadas busca también por el identificador del pedido (se mide si el proveedor lo permite); una pantalla nueva con una compra del mismo producto sin resolver no deja comprar otra; la misma identidad de compra da el candado del addon recurrente | sí |
| F | R8 (`F-8V3C2-004`) | si las anuales vivas el día del corte vuelven al owner antes del 1b o se sostiene «no se devuelve» | **3**: se sostiene «no se devuelve» para todas y el guion se reescribe sin «la prueba lo compensa». Hecho aportado por el owner: no hay anuales vivas en el sistema viejo ni las va a haber antes del corte | **no** (la recomendada era la 1, que vuelvan al owner con el monto a la vista; el owner aporta el hecho que la vuelve innecesaria) |
| G | R8 (`F-8V3B3-001`) | qué detector tiene el titular que sólo conoce el proveedor, si el `GET` trae el `payer_email` vacío | **1**: se mide en sandbox si otra lectura trae el pagador (búsqueda sin filtro, pago asociado); si ninguna, la declaración dice que no tiene detector | sí |
| H | R10 (`F-8V3A3-006`) | si la baja de cuenta conserva el seudónimo mientras la pregunta 5 al abogado sigue abierta | **1**: se conserva hasta la respuesta; si es en contra, soporte los borra todos con una tarea puntual (se anota quién y cuándo) | sí |
| I | R13 (`F-8V3A1-005`) | si postular un Partner exige cuenta | **2**: se postula sin cuenta, como segunda excepción del guest en el paso 1, con límites contra el abuso (qué límites: lote siguiente) | **no** (la recomendada era la 1, que postular exija cuenta) |
| J | R14 | qué se hace con lo que una restauración del corte no deshace (altas del paso 6, pagos asentados antes de un aborto, la promoción a `main`) | **2**: se declara con su causa en el «NO cierra» del corte; las tres situaciones exigen una falla previa | **no** (la recomendada era la 1, tres reglas en el procedimiento del corte) |
| K | R17 (`F-8V3B3-002`) | si `EX-45` (cancelación del proveedor que se deshace) condiciona la exención del barrido | **1**: el barrido sigue releyendo unos días una suscripción cancelada por rechazo antes de darla por terminada; el plazo entra a la lista cerrada de plazos | sí |
| L | R27 | si la revocación alcanza al addon de única vez comprado en la ventana | **1**: sí; se devuelve por un camino de devolución de órdenes, confirmando en sandbox cómo se devuelve una orden | sí |
| M | R13 (sigue de I) | qué límites tiene la postulación sin cuenta | **1**: captcha (Turnstile, que el sitio ya usa) y una sola postulación abierta por correo, la guarda de `PP1` que ya pasa a restricción de la base | sí |
| N | R3 (`F-8V3A3-002`) | qué pasa con `owner_suspended`, `plan_restricted` y `billing_unpublished_at`, que `U1` borra y la traducción del corte lee | **1**: sobreviven a `U1` como excepción temporal y nombrada que los guards de limpieza admiten hasta el corte; las borra una migración posterior al paso 3, después de la clasificación | sí |
| O | R22 | qué hace `PB13` con el lugar que la moderación cedió | **1**: la ficha que vuelve de la moderación entra a la misma cola ordenada que `PB3`/`PB7`; si le toca, recupera su lugar y la otra vuelve a esperar | sí |

## Lo que no pidió decisión

El resto de los racimos (R5, R7, R9, R11, R12, R15, R16, R18 a R21, R23 a R26, R28 a R30, y la
parte de aplicación de R1, R3, R6, R13 y R17) es trabajo de escritura sin decisión de producto,
según el §6 del consolidado. Va a la tanda de aplicación.

## Contra la recomendación

Cuatro de quince: F (con un hecho aportado por el owner que la vuelve innecesaria), I, J y, por
arrastre de I, la pregunta M existe. La J deja declaradas en el «NO cierra» del corte tres
situaciones con daño de clase crítica que exigen una falla previa.

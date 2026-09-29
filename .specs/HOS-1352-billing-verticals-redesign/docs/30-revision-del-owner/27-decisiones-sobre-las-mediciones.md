---
title: "Revisión del owner · decisiones sobre las mediciones del 29/09"
linear: HOS-1352
statusSource: linear
created: 2026-09-29
updated: 2026-09-29
status: CURRENT
fase: 9
---

# Revisión del owner · decisiones sobre las mediciones del 29/09

Tomadas con el owner el 2026-09-29 (tarde), después de aplicar a la matriz el lote de
[`25-lote-matriz-mediciones-2026-09-29.md`](./25-lote-matriz-mediciones-2026-09-29.md)
([`26-`](./26-aplicacion-lote-matriz-mediciones.md)). **Todavía no están aplicadas** al diseño, al log
ni a la matriz: van en la tanda que lleva lo medido al diseño, con el OK del owner ya dado
(*«va, anotalo»*).

| ID | Tema | Elección | ¿La recomendada? |
|---|---|---|---|
| M-1 | medir `WH-4` (la escalera completa de reintentos), `WH-2` (la demora larga) y `WH-3` (el desorden a volumen) | **no se miden**: el diseño ya asume lo peor (demora, desorden, entrega que no llega) y se defiende releyendo por id y con el barrido. Owner: *«lleva días medir, y incluso no sé si lo lograremos, pero decís que importa poco [...] dejémoslo, no lo hacemos»* | sí |
| M-2 | qué se hace con el canal IPN | **se escucha y se guarda, sin actuar**, a propuesta del owner: *«lo escuchamos y lo guardamos, pero sin hacer nada más; en el futuro podemos revisar esa data y ver si realmente no nos sirve de nada, o nos estamos perdiendo de algo»*. Con tres agregados: (a) ninguna decisión lee esa tabla, y el guard que prohíbe decidir con el cuerpo de un aviso (`G17`) la nombra explícitamente; (b) retención técnica, no configurable, de **180 días**; (c) un issue en Linear para revisar, **tres meses después del corte** ([HOS-1399](https://linear.app/hospeda-beta/issue/HOS-1399), creado el 2026-09-29), lo guardado de IPN contra lo recibido por Webhooks, y decidir con ese dato si se apaga. El panel de la aplicación de producción queda como está (IPN activo). Reemplaza la condición de G-D (lote G, caso 4 de `18-`): ya no depende de la medición | no (la recomendada era apagar IPN en el panel el día del corte y descartarlo explícitamente en el receptor) |
| M-3 | `EX-13` (la firma de las entregas IPN) | **se cierra sin medir**: con M-2 nada actúa sobre una entrega IPN, así que su firma no importa | sí (consecuencia de M-2) |
| M-4 | `EX-46` (adónde va un reintento después de cambiar la URL) | **no se mide**: si el día del corte se pierde un reintento, el barrido diario lo relee | sí |
| M-5 | `EX-54` (el correo de Mercado Pago al subir el monto) | **no se mide**: el tercer aviso de la migración dice en general que Mercado Pago también va a mandar un aviso del cambio de monto, sin citar su texto | sí |

**Consecuencia**: no queda ninguna medición pendiente. Lo que sigue es la tanda que lleva lo medido
al diseño: los diez puntos de impacto de `25-` §4, más M-1 a M-5 (y sus filas de la matriz y del
log).

## Lote L · lo que pidió elegir la tanda que llevó las mediciones al diseño (2026-09-29)

Decisiones de [`28-aplicacion-mediciones-al-diseno.md`](./28-aplicacion-mediciones-al-diseno.md) §3.

| Letra | Decisión de `28-` | Tema | Elección | ¿La recomendada? |
|---|---|---|---|---|
| A | 1 | la baja que el cliente da desde la app de Mercado Pago (N8, `EX-52`) | **2**: se deja como está; corta el servicio en el acto, como una baja del proveedor | **no** (la recomendada era tratarla como una baja pedida desde Hospeda, con el servicio hasta el fin del período pagado) |
| B | 2 | qué se guarda de Webhooks para comparar con IPN (M-2, HOS-1399) | **1**: cada entrega de Webhooks también se guarda en la misma tabla, con su canal y los mismos 180 días, sin que nadie la lea; la tabla cambia a un nombre que diga los dos canales | sí |
| C | 3 | reintentar con otra tarjeta un complemento de pago único (`EX-30`, `EX-41`) | **1**: un rechazo cierra la compra en el acto (abandonada) y el segundo intento arranca un pedido nuevo | sí |
| D | 4 | el receptor de hoy fuerza reintentos sin fin sobre suscripciones que el proveedor canceló | **1**: no se abre issue; el receptor viejo desaparece en el corte | sí |
| E | — | el lote de `28-` §4 para el log, la matriz y `contar-filas-de-la-matriz.py` | **1**: OK, con lo que suman A, B y C | sí |

Contra la recomendación: **A**. Consecuencia aceptada: quien cancela desde la app de Mercado Pago
pierde los días que ya pagó, y la misma baja tiene dos resultados según dónde se dio.

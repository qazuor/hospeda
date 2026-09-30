---
title: "Revisión del owner · decisiones sobre la verificación corta"
linear: HOS-1352
statusSource: linear
created: 2026-09-29
updated: 2026-09-29
status: CURRENT
fase: 9
---

# Revisión del owner · decisiones sobre la verificación corta

Los ocho hallazgos que BLOQUEAN de [`30-verificacion-cobro.md`](./30-verificacion-cobro.md) y
[`31-verificacion-verticales-y-transversal.md`](./31-verificacion-verticales-y-transversal.md),
decididos con el owner el 2026-09-29. **Todavía no están aplicados.**

## Lote M (2026-09-29)

| Letra | Hallazgo | Tema | Elección | ¿La recomendada? |
|---|---|---|---|---|
| A | `VC-cobro-01` | la fila de alcance `PENDIENTE` de una suscripción que termina por otro camino | **1**: toda llegada a un estado terminal (y la muerte de la predecesora en una sucesión) pasa su fila de alcance `PENDIENTE` a `FUERA`, con un tercer motivo, «terminó», en el mismo acto; y se escribe qué estados entran a la cohorte al anunciar | sí |
| B | `VC-cobro-02` | el pagador manual en una migración | **1**: sobre un pagador manual `S37` no muta ni relee; encola el cambio de versión para la fecha de aplicación y pasa la fila a `APLICADA`, y `S38` cambia la versión antes de que `MP5` abra la cuota de ese período | sí |
| C | `VC-cobro-03` | el barrido entre `S37` y `S38` | **1**: línea gemela de la del downgrade en `B/14` §2.4 y `B/09` §3 (entre `S37` y su `S38`, el monto esperado es el precio de lista de la versión destino para su ciclo, sin promos), y el motivo 24 deriva el precio de la versión que rige el período que cubre el cobro | sí |
| D | `VC-cobro-04` | `G16` (a) y `qzpay` vivo hasta el corte | **1**: (a) se acota al package del cobro (su `package.json` y sus imports), y se nombra la unidad o el paso que borra el cobro viejo después del corte | sí |
| E | `VC-VT-01` | `G8` y los 1229 archivos de código vivo | **1** (propuesta del orquestador, distinta de las tres de `31-`): `G8` nace con la lista medida de esos archivos como pendientes, que sólo puede achicarse (un trinquete): toda aparición nueva de la palabra falla, cada unidad que reescribe un archivo lo saca de la lista, y la épica no cierra con la lista sin vaciar. La lista la genera un script | sí |
| F | `VC-VT-02` | la acción 24 condicionada sobre una fila viva | **1**: una entrada nueva en la dirección de ida del contrato, que billing contesta con sí o no sobre la cuenta entera («¿le queda algo que todavía pueda cobrarle?»), y entra al inventario de «fila viva» del lado de billing; la 24 sigue en `V8` | sí |
| G | `VC-VT-03` | la 24 trabada por `CANCEL_SCHEDULED` | **1**: la precondición pregunta por una autorización que puede cobrar (sin `CANCEL_SCHEDULED`); la fila `CANCEL_SCHEDULED` termina sola por `S12` sobre la cuenta ya seudonimizada | sí |
| H | `VC-VT-04` | los avisos de retención y `pausaTerminadaEn` | **1**: la fila «retención» de `nucleo/07` §6 cuenta los avisos previos desde el más tardío de los dos instantes, con la versión de plazos de la ficha, y la fecha objetivo de la ocurrencia sale de esa cuenta | sí |

## Lote N · lo que pidió elegir la tanda que aplicó el lote M (2026-09-29)

Decisiones de [`33-aplicacion-lote-m-y-menores.md`](./33-aplicacion-lote-m-y-menores.md) §3.

| Letra | Decisión de `33-` | Tema | Elección | ¿La recomendada? |
|---|---|---|---|---|
| A | D-1 | quién borra el sistema viejo | **Reformulada por el owner**: *«ya habíamos definido que no conviven nunca los 2 sistemas, así que esta pregunta no tiene sentido [...] tenemos que estar 100 % seguros de eliminarlo por completo y no dejar código basura»*. Entre sus dos caminos (limpieza total al principio, o borrar a medida que se avanza) eligió **limpieza total al principio**: la primera unidad de la épica borra todo el cobro viejo (`qzpay`, rutas, crons, adaptador) y renombra o borra todo lo que nombra el agrupamiento viejo; recién después se construye lo nuevo. Consecuencias: `G8` y `G16` miran todo el repo sin listas de pendientes de código (el trinquete de M-E y la pregunta de D-1 desaparecen; se revisa qué queda de las tres entradas); las mitades se construyen contra el simulador del contrato mientras la app en la rama está rota; y se rehace el orden de los pasos 3 y 4b del corte, porque el receptor viejo desaparece con el despliegue del paso 3 | sí (la recomendada entre las dos del owner) |
| B | D-2 | el `402` que no llega | **1**: el segundo pedido reenvía con la misma clave y el mismo cuerpo; un `409` muestra «tu pago anterior se está procesando, probá en unos minutos», sin abrir un pedido nuevo | sí |
| C | D-3 | un cobro que llega después de la acción 24 | **1**: la 24 se rechaza con una `CANCELACIÓN_SIN_CONFIRMAR` abierta (suma a `puedeCobrarle`), y si igual llega un cobro, `P1` deja nombre y correo nulos y el comprobante sin enviar, como sobre una lápida | sí |
| D | D-4 | verificar la URL de IPN en el 4b | **1**: la herramienta del corte hace un pago chico con la tarjeta del owner, verifica la entrega IPN guardada y lo devuelve | sí |
| E | D-5 | el cliente `PARA_RESOLVER` | **1**: recibe sólo el anuncio con un texto de «te vamos a contactar»; su fila sale a `FUERA` al resolverse o si termina; cancelar la migración la pasa a `CANCELADA` | sí |
| F | D-6 | el correo de `PB12` cuando soporte corre la 24 enseguida | **1**: el outbox guarda la dirección al encolar, y la supresión por cuenta dada de baja no alcanza a lo encolado antes | sí |
| G | D-7 | la presencia de un Partner que se da de baja | **1**: acción administrativa 25, que la vacía, dentro de la baja manual | sí |
| H | D-8 | la versión de plazos el día del corte | **1**: la migración estructural crea la versión 1 con los quince valores; el 3a sólo la verifica | sí |
| I | D-9 | cuando muere el título que ancla la cuota | **1**: la ventana en curso sigue hasta su fin y la próxima arranca con el ancla nueva | sí |
| J | — | el lote de `33-` §4 para el log | **1**: OK, con lo que sumen A a I | sí |

## Lote O · lo que pidió elegir la tanda que aplicó el lote N (2026-09-29)

Decisiones de [`34-aplicacion-lote-n.md`](./34-aplicacion-lote-n.md) (N-A-1 y N-A-2).

| Letra | Decisión de `34-` | Tema | Elección | ¿La recomendada? |
|---|---|---|---|---|
| A | N-A-1 | quién hace la limpieza total del principio | **1**: una unidad propia del paraguas, antes de `V1` y `B1`, que hace sólo la limpieza; las dependencias entre épicas siguen en 11 | sí |
| B | N-A-2 | el hueco del corte entre el paso 3 y el 4b | **1**: el receptor nuevo sirve la misma ruta que el viejo (`/api/v1/webhooks/mercadopago`); el borde la cierra durante el corte (el proveedor recibe error y reintenta) y la abre cuando están las lápidas; el 4b sólo verifica; `EX-46` queda sin sujeto | sí |

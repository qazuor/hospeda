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

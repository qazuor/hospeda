---
title: "Revisión del owner sobre la presentación · las decisiones"
linear: HOS-1352
statusSource: linear
created: 2026-09-28
updated: 2026-09-28
status: CURRENT
fase: 9
---

# Revisión del owner sobre la presentación: las decisiones

El owner leyó la presentación «Verticales y cobro, rediseñados»
(<https://claude.ai/artifact/QnbPFvMXQKPh1J86eM3JXf>), dejó 15 comentarios (aplicados al artifact,
todavía no al repo) y 9 notas nuevas ([`00-puntos.md`](./00-puntos.md)). El impacto de cada punto
sobre el diseño está en [`01-impacto-producto.md`](./01-impacto-producto.md) y
[`02-impacto-cobro-y-proceso.md`](./02-impacto-cobro-y-proceso.md). Este registro junta lo que el
owner decidió; se aplica al diseño en una tanda posterior, y lo que toca log y matriz va con su OK.

## Los 15 comentarios del artifact

Decididos por el owner al escribirlos (el texto de cada uno y la respuesta están en `00-puntos.md`,
C1 a C15). Quedan abiertas las preguntas que las respuestas le devolvieron (C2 herramienta del
corte, C3 la palabra en el documento, C4 las dos precisiones, C9 plazos técnicos, C10 al levantar la
baja, C12 varias fichas durante la prueba, C13 cadencia en producción) y las que traen los informes
de impacto.

## Las notas nuevas y las respuestas (2026-09-28, noche)

| punto | qué pregunta o pide | decide |
|---|---|---|
| N2 | ¿se mantiene qzpay? | **Se saca.** Todo el cobro nuevo se escribe **bien encapsulado en un package compartido del monorepo**, de modo que mañana se pueda publicar como package npm propio sin reescribirlo. qzpay queda sólo como referencia |
| N7 | los 13 ítems «sin resolver, declarado» | **Se resuelven ahora los seis propuestos** (baja de cuenta, señales que sólo observan, dónde vive el contenido de Partner, la ficha moderada, el espacio entre archivado y borrado, los avisos de retención sobre ficha moderada o borrada); **se saca** encender o apagar la prueba de una vertical; los otros seis quedan declarados |
| N8 | cancelar o pausar desde Mercado Pago | **Se mide** si se puede distinguir una cancelación o pausa hecha por el cliente del lado de Mercado Pago, y con eso se decide cómo manejarla |
| N9 | el filtro de la URL de avisos | **Se mide de nuevo** todo lo que haga falta, con los dos canales de avisos apuntados al receptor |
| C12 | avisos del corte | **El sistema no avisa nada del corte**: el owner les avisa en persona. Hay que **recordárselo** cuando se acerque el corte |
| N5 | reparto con Codex y OpenCode | **Por ahora no se hace nada** |

## Los tres ítems del §12 que pedían decisión (2026-09-28, noche)

| punto | qué pregunta | elige | ¿la recomendada? |
|---|---|---|---|
| g1 | baja de cuenta pedida por el usuario | **2**: fuera de esta épica; mientras tanto la hace soporte a mano con una lista de pasos escrita y se corrige la FAQ. Se implementa después de terminar HOS-1352: [HOS-1393](https://linear.app/hospeda-beta/issue/HOS-1393) | **no** (la recomendada era la 1, la baja mínima ahora) |
| g2 | teléfono, CUIT y dispositivo, que sólo observaban | **1**: no se guardan; la consulta legal queda sólo por el seudónimo del correo. Seguimiento futuro: [HOS-1394](https://linear.app/hospeda-beta/issue/HOS-1394) | sí |
| g3 | qué puede hacer el dueño con una ficha moderada | **1**: verla, exportarla, editarla y borrarla, no publicarla (la levanta el administrador); al borrarla, correo de confirmación | sí |

Los otros tres ítems a resolver se aplican como texto, sin objeción del owner: el contenido de Partner vive en la tabla de partners de hoy; con los relojes que guardan su plazo, el borrado cae en la fecha anunciada al archivar y nunca antes; los avisos de retención releen el estado de la ficha y no salen sobre una moderada, una borrada ni con la pausa deteniendo el reloj.

## Lote 1: la forma (2026-09-28, noche)

| punto | qué pregunta | elige | ¿la recomendada? |
|---|---|---|---|
| L1-a | varias fichas a la vista el día del corte, con una prueba de una ficha | **No se diseña**: hoy no hay ningún dueño con más de una ficha a la vista; si aparece alguno, se decide en ese momento (hecho del owner) | n/a (hecho del owner) |
| L1-b | las fichas que el sistema viejo tenía bajadas por falta de pago | **1**: nacen en borrador; cae entera la regla de quien contrata sin publicar | sí |
| L1-c | cómo sabe verticales que la pausa detiene la retención | **1**: una pregunta nueva del contrato, «¿tiene el reloj detenido?», que leen sólo archivar, borrar y los avisos de retención | sí |
| L1-d | el único punto de comunicación entre verticales y billing | **1**: un package compartido del monorepo con las dos interfaces, validaciones, simuladores y juegos de casos, y un control que prohíbe que una mitad importe a la otra | sí |
| L1-e | cómo nace el catálogo de producción el día del corte | **1**: una migración de datos única del corte, que corre una vez y nunca más es fuente | sí |
| L1-f | acciones administrativas para editar el catálogo | **1**: cinco nuevas, sólo súper admin, auditadas y con confirmación: publicar versión de plan, fijar precio de un ciclo, publicar complemento, crear o cerrar código promocional, cambiar un plazo (15 → 20) | sí |
| L1-g | migrar un plan retirado a un cliente anual | **1**: se aplica en su renovación | sí |
| L1-h | cancelar una migración ya anunciada | **1**: sí, para los que no se aplicaron, con correo «ya no cambia nada» | sí |

## Lote 2: las reglas (2026-09-28, noche)

| punto | qué pregunta | elige | ¿la recomendada? |
|---|---|---|---|
| L2-a | «commerce» en la historia de migraciones y el ledger de seed | **1** (después de pedir más detalle): el día del corte se reemplaza toda la historia por una foto de la base tal como queda, y en producción se anota como aplicada; lo mismo con las migraciones de datos. Se ensaya antes en staging, con backup | sí |
| L2-b | «commerce» en el PDR, que no se edita | **1**: exento por nombre, con la causa escrita | sí |
| L2-c | «commerce» en el producto (rol, permisos, tabla de contactos, tipo de partner) | **1**: entran en la limpieza como trabajo de verticales, con su migración de datos; el tipo de partner se renombra a lo que es (nombre a definir con el owner) | sí |
| L2-d | «commerce» en la presentación, engram y las memorias | **1**: se reescribe como «el agrupamiento viejo de Gastronomía y Experiencia»; engram y memorias se limpian a mano | sí |
| L2-e | la cuota por fecha de ciclo cuando se cambia de plan | **1**: la ventana en curso sigue hasta su fin con el cupo del plan nuevo menos lo gastado; la fecha nueva rige desde la siguiente | sí |
| L2-f1 | la cuota durante la prueba gratis | **2**: también se renueva cada mes, desde el día en que arrancó la prueba | **no** (la recomendada era una sola cuota para toda la prueba, como decía el diseño) |
| L2-f2 | altas del 29, 30 o 31 | **1**: renueva el último día de los meses cortos y vuelve a su día cuando existe | sí |
| L2-f3 | un complemento que suma cuota | **1**: suma a la cuota del plan que lo cubre y se renueva el mismo día | sí |
| L2-g | plazos técnicos configurables | **1**: ninguno | sí |
| L2-h | cómo un reloj no adelanta una fecha ya avisada | **1**: cada reloj guarda la versión de plazos con la que arrancó | sí |
| L2-i | al levantar la baja de moderación | **1**: la ficha vuelve a donde estaba (publicada si hay cobertura y cupo; borrador si era borrador); pasar a «sólo pedido de arreglo» sigue la misma regla | sí |

## Lote 3: el proceso (2026-09-28, noche)

| punto | qué pregunta | elige | ¿la recomendada? |
|---|---|---|---|
| L3-a | dónde vive la herramienta del día del corte | **1**: script suelto, fuera de los dos sistemas, que habla directo con Mercado Pago (lee, cancela y arma la lista de a quién avisa el owner); se archiva después | sí |
| L3-b | `staging` sin interruptores | **1**: la épica entra a `staging` recién al final, lista para el corte; desde ahí `staging` queda congelado para `main` hasta el corte; los arreglos urgentes van a `main` como hoy | sí |
| L3-c | la lista de mentiras del Mercado Pago falso | **1**: una sola lista cerrada en el repo con sólo mentiras medidas (cada una con su medición y su prueba); las reglas propias en otra lista | sí |
| L3-d | cadencia de la batería contra Mercado Pago en producción | **1, más** poder correrla a mano cuando se quiera | sí (con un agregado del owner) |
| L3-e | pruebas de punta a punta para reducir el smoke manual | **1**: Mercado Pago falso como servidor, reloj que se puede adelantar, y recorte sección por sección del checklist de smoke; queda manual lo que no se puede simular | sí |
| L3-f | volver a consultar a Mercado Pago siempre | **1**: un control que falla si una decisión sale de un aviso sin releer, extendido a las acciones administrativas | sí |
| L3-g | los dos canales de avisos de Mercado Pago | **Se analiza y se mide antes de decidir.** Hecho del owner: el filtro se agregó porque a veces llegaban dos avisos del mismo hecho, uno por cada canal. Si se aceptan los dos, hay que garantizar que un aviso duplicado no produzca ningún efecto doble | n/a (pide medición) |

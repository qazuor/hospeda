# Revisión del owner · los 50 casos vecinos, decididos

Las decisiones del owner sobre los casos vecinos de
[`14-aplicacion-transversal-y-lote.md`](./14-aplicacion-transversal-y-lote.md) §3, pedidas en lotes
con letras. La columna «Caso» es el número de ese §3. Todavía no están aplicadas al diseño.

## Lote A · el corte y su proceso (2026-09-29)

| Letra | Caso | Tema | Elección | ¿La recomendada? |
|---|---|---|---|---|
| A | 1 | el correo de baja del sistema viejo cuando el script cancela | **1**: no se toca el viejo; el owner lo anticipa en su aviso en persona | sí |
| B | 2 | la constancia de que se avisó la pérdida | **2**: no se registra nada | **no** (la recomendada era anotar a quién llamó y cuándo en la lista del script) |
| C | 3 | dónde vive el script del corte | **1**: versionado en `scripts/cutover/`; archivarlo es borrarlo en un commit posterior al corte | sí |
| D | 4 | si el orden de despliegue cierra el pendiente de `rollout` | **1**: cerrado en lo que hace a ramas; el orden es el §4.2 de `D/16` | sí |
| E | 5 | el paso 4c puede quedar sin sujeto | **1**: se mide en el paso 0; si da cero, el paso se saltea | sí |
| F | 6 | un dueño con más de una ficha a la vista | **1**: recuento en el paso 0 que vuelve al owner si da más de cero, sin ser gate | sí |
| G | 7 | los pasos de la baja de cuenta manual | **1**: se escriben antes del corte, en orden: baja del cobro, `PB12` por ficha, la cuenta | sí |
| H | 8 | `G8` nace rojo hasta el paso 6 | **1**: lista de pendientes cerrada (las dos historias) que el paso 6 vacía; un build para producción después del corte falla si no está vacía | sí |
| I | 9 | las once migraciones de datos del seed que importan la configuración | **1**: se congelan con sus valores adentro hasta que el paso 6 las saque | sí |

Contra la recomendación: **B**. Consecuencia: si un cliente reclama después que no le avisaron,
no hay registro que lo muestre.

## Lote B · verticales (2026-09-29)

| Letra | Caso | Tema | Elección | ¿La recomendada? |
|---|---|---|---|---|
| A | 10 | qué `desde` ancla con más de un título vivo | **1**: el del título que da la cuota; con dos, el que arrancó primero | sí |
| B | 11 | el `desde` del título `BASE` es el alta de la cuenta | **1**: queda escrito así; se confirma el día que la versión de piso otorgue un entitlement medido | sí |
| C | 12 | una pausa que termina sin volver | **1**: todo fin de pausa, por cualquier camino, reinicia el reloj de retención | sí |
| D | 13 | una ficha moderada desde `ARCHIVED` | **1**: vuelve por el origen de su archivado | sí |
| E | 14 | los dos niveles de moderación y la presencia de Partner | **1**: sólo fichas | sí |
| F | 15 | el correo de confirmación del borrado | **1**: sale en todo `PB12` | sí |
| G | 16 | un guard para `retenciónDetenida` | **1**: una mitad más de `G-R6-B` | sí |
| H | 17 | la prueba del corte en una vertical con días en cero | **1**: sin prueba automática; el owner agrega: *«lo probamos en staging con fichas de prueba»* | sí, con agregado |
| I | 18 | la numeración de los hechos del reloj | **1**: no se renumera | sí |
| J | 19 | el nombre del tipo de partner | **1**: `business`, con la etiqueta «Comercio» en español sin cambios | sí |

## Lote C · cobro, primera mitad (2026-09-29)

| Letra | Caso | Tema | Elección | ¿La recomendada? |
|---|---|---|---|---|
| A | 20 | cuándo `S37` muta el monto | **1**: siete días antes de la fecha de aplicación; plazo técnico, no configurable | sí |
| B | 21 | «a 30 y a 7 días» | **1**: antes de la fecha de renovación de cada cliente | sí |
| C | 22 | la migración como fila propia | **1**: sigue siendo la decimoséptima, aparte de «publicar una versión de plan» | sí |
| D | 23 | `S37` la corre el sistema | **1**: es una transición que aplica lo que la persona firmó al anunciar, no una fila de la tabla de acciones | sí |
| E | 24 | una cohorte que incluye la cuenta del propio `SUPER_ADMIN` | **1**: se excluye su fila; el acto sigue | sí |
| F | 25 | cancelar durante los siete días | **1**: no se deshace la mutación; se manda un correo que lo explica | sí |
| G | 26 | `PARA_RESOLVER` sin plazo | **1**: sin plazo, con la antigüedad visible en el listado del panel | sí |
| H | 27 | una cortesía temporal el día de la migración | **1**: espera, como está | sí |
| I | 28 | lo que queda afuera de las dos listas del falso | **1**: va a la segunda lista, como comportamiento medido | sí |
| J | 29 | tres cifras de la presentación que el repo no sostiene | **1**: se corrige la presentación al publicarla | sí |

## Lote D · cobro, segunda mitad (2026-09-29)

| Letra | Caso | Tema | Elección | ¿La recomendada? |
|---|---|---|---|---|
| A | 30 | las dependencias del package del cobro | **2**, con la regla del owner: *«siempre que sea simple evitar la dependencia de otro package de Hospeda, evitalo; si es complejo, la dejamos y en el futuro se reverá»*, porque *«no quiero demorar la salida de esta épica por eso»*. La promesa de N2 se reescribe: package compartido del repo; publicarlo en npm pediría reescribir sus dependencias internas. `G16` deja de mirar esas dependencias; la prohibición de `qzpay` sigue | **no** (la recomendada era sólo el contrato y packages npm) |
| B | 31 | dónde vive el reloj adelantable | **1**: un package de pruebas compartido que importan las dos mitades | sí |
| C | 32 | la regla de smoke del `CLAUDE.md` | **1**: se actualiza a medida que exista el E2E de cada sección | sí |
| D | 33 | la autorización mensual de la batería en producción | **1**: la custodia el owner y la renueva cada mes | sí |
| E | 34 | qué correo manda Mercado Pago cuando la migración sube el monto | **1**: una fila nueva de la matriz | sí |
| F | 35 | `G17` no verifica que la lectura sea del mismo acto | **2** (tras la explicación: la regla escrita sola no alcanza): cada lectura por id lleva su instante, y la decisión rechaza una lectura anterior al comienzo del acto. Queda una ventana de milisegundos entre releer y actuar, que cubre el barrido | sí (la recomendada pasó a ser la 2 al responder la pregunta del owner) |
| G | 36 | la fila 6 de dependencias creció | **1**: queda así | sí |
| H | 37 | la cola de `B/12` §2 sin transición para el descenso | **1**: se nombra | sí |
| I | 38 | la fila de `B12` de la discontinuación en `$B/descomposicion.md` §2.3 | **1**: se tacha | sí |
| J | 39 | el receptor nuevo y el descarte de IPN | `WH-6` **se mide antes de cerrar el diseño** (paso 2 del handoff); si no se llega a medir, **1**: el receptor registra los IPN sin actuar | sí, con agregado |
| K | 40 | `M-SUB-03` en el frontmatter de `B/10` | **1**: la etiqueta dice «cerrado: no se discontinúan verticales» | sí |

## Lote E · lo transversal (2026-09-29)

| Letra | Caso | Tema | Elección | ¿La recomendada? |
|---|---|---|---|---|
| A | 41 | el corpus del diseño y el resto del repo nombran la palabra | **1**: al cerrar HOS-1352 los informes históricos salen del repo (quedan en el historial de git; lo que importe se resume en Linear) y el diseño vigente se reescribe una vez, sin tachados ni la palabra; el `CLAUDE.md` y el i18n entran en la limpieza de `V1` | sí |
| B | 42 | los datos de planes de desarrollo y de las pruebas | **1**: datos de demostración, fuera del dual-write; sale la rama de configuración de billing de `check-seed-dual-write.sh` y de la regla del `CLAUDE.md` | sí |
| C | 43 | cinco plazos sin valor inicial | **1**: los fija el owner antes del ensayo del corte en staging, y la migración única del catálogo falla si alguno está vacío | sí |
| D | 44 | el piso de 60 días de `DEC-MP-002` | **1**: queda en 60; se puede alargar, no acortar | sí |
| E | 45 | si alargar un plazo alcanza a los relojes ya arrancados | **1**: no los alcanza; cada reloj cuenta con su versión | sí |
| F | 46 | configurar el 90 y el 180 frente al §25 del PDR | **1**: se declara como el décimo apartamiento del PDR | sí |
| G | 47 | una pantalla o dos para los plazos | **1**: una sola, compuesta en la app del panel | sí |
| H | 48 | `plazos_version` sin guard de escritores | **1**: se extiende la mitad *(a)* de `G-R6-B` a esa columna | sí |
| I | 49 | el catálogo de claves sigue en código | **1**, con agregado del owner: *«los entitlements siguen declarándose en el código, pero los límites podrían ir por db»* Aclarado: los **valores** de los límites viven en la base (ya era así) y las **claves**, de límites y de entitlements, siguen en el código | sí, con agregado aclarado |
| J | 50 | la cota de `G-R5-B` | **1**: atada al plazo de borrado, no a 6 meses literales | sí |

## Resumen

50 casos decididos. Contra la recomendación: **A-B** (caso 2, sin constancia del aviso) y **D-A**
(caso 30, el package del cobro puede depender de packages internos cuando evitarlo no sea simple).
Con agregado del owner: **B-H** (17), **D-J** (39), **E-I** (49).
En el Lote F (casos nuevos de `17-`), contra la recomendación: **F-C** (soporte puede borrar todo).

## Lote F · lo que salió al aplicar los casos 1 a 19 (2026-09-29)

Casos vecinos nuevos de [`17-aplicacion-casos-corte-y-verticales.md`](./17-aplicacion-casos-corte-y-verticales.md) §3.

| Letra | Caso de `17-` | Tema | Elección | ¿La recomendada? |
|---|---|---|---|---|
| A | 1 | cómo se reinicia el reloj cuando la pausa termina sin volver | **1**: no se escribe nada; `retenciónDetenida` devuelve también cuándo terminó la última pausa y los lectores cuentan desde el más tardío de los dos instantes; `G-R6-B` no cambia. Y el barrido diario marca para resolver a mano una pausa vencida cuya reanudación no se aplicó | sí |
| B | 2 | `G8` y el build del paso 3 | **1**: la regla «falla con la lista llena» se enciende con el commit del paso 6 | sí |
| C | 3 | quién ejecuta la baja de cuenta manual | **2**, ampliada por el owner: *«que soporte pueda borrar todo»*. Soporte (una persona del equipo con el permiso en el panel) hace los tres pasos: cancela el cobro (la acción que ya existe), borra cada ficha con `PB12` y borra la cuenta, a pedido del dueño y con motivo. Suma lo que falte al catálogo de acciones y precisa el *«sin borrar»* de `G5-2` (que sigue valiendo para la edición de contenido ajeno) | **no** (la recomendada era que el dueño borre sus fichas y soporte haga los pasos 1 y 3) |
| D | 4 | el script del corte bajo `G8` | **1**: arma el valor viejo sin escribir la palabra de corrido, como el propio guard | sí |

Nota del registro: `17-` §3 caso 3 decía que soporte no tenía una acción para dar de baja la
suscripción de otro; es inexacto, la acción *«cancelar una suscripción»* existe (`nucleo/08` §3).
Lo que no existía era borrar una ficha ajena ni la cuenta.

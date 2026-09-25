---
title: "FASE 9 completa · lo que decidió el owner sobre los 33 puntos"
linear: HOS-1352
statusSource: linear
created: 2026-09-25
updated: 2026-09-25
status: CURRENT
fase: 9
---

# FASE 9 completa — decisiones del owner

Registro de las respuestas del owner a los puntos «al owner» de los informes `01`–`09`, en el orden
en que se trataron. **Todavía no están aplicadas a los capítulos ni al log**: se aplican en tanda
cuando termine la ronda, porque varias contradicciones de texto dependen de ellas.

| # | punto | origen | decisión |
|---|---|---|---|
| 1 | el correo *«antes de cancelar»* que agota sus reintentos (`failed`) traba `S17` y `S6` para siempre | [`04`](./04-R5-R7-correo-y-conciliacion.md) §R5.5.1 | **opción 1**: un correo obligatorio en `failed` no bloquea; se cancela igual y se escala como no-entregable, igual que sin destinatario. Precisa `DEC-MAIL-001` |
| 2a | las tablas viejas de billing y sus columnas copiadas | [`02`](./02-R2-el-corte.md) `AO-1` | **no se conserva nada**: el historial viejo no se guarda ni se congela. *«Recién arrancamos; a los clientes que hay los contactamos en persona, de a uno, y se vuelven a suscribir. Guardarlo sólo deja basura que después cuesta limpiar.»* **Contra la recomendación** (congelar en solo lectura). Consecuencia a escribir: lo que el corte lea del sistema viejo (la siembra de trials consumidos) corre **antes** de retirar esas tablas |
| 2b | la re-vinculación de un cobro desconocido | `02` `AO-2` | **opción 1**: re-vincula sólo si el `external_reference` nombra una fila nuestra sin otro vínculo vivo; todo otro desconocido abre marca |
| 2c | vuelta atrás al sistema viejo después del paso 3 | `02` `AO-3` | **sólo hacia adelante**: *«no va a pasar»* |
| 2d | la diferencia que cobra la rama de aborto a quien se re-suscribe | `02` `AO-4` | **no se devuelve**: quien se re-suscribe arranca un trial nuevo desde cero. **Contra la recomendación** (resolverlo hablando, `DEC-MIG-004`). **Aclarado por el owner**: *«cuando en producción pasemos del sistema viejo al nuevo, a los clientes que haya en ese momento les hablamos y los tomamos como clientes nuevos que recién arrancan: tendrán su trial y luego se suscribirán»*. El trial nuevo es el del sistema nuevo, cuando el corte termina |
| 2e | aborto con la migración ya aplicada | `02` `AO-5` | **backup antes de migrar; si se aborta, se restaura el backup**. Es la opción 2 del informe; su costo (perder lo que el viejo anotó en la ventana) queda sin objeto por 2a |
| 2f | la completitud del recorrido de MP | `02` `AO-6` | **opción 1**: en el paso 2, si el conteo no iguala el `total` del paginado o falta un id conocido, el corte no avanza |
| 2g | qué trials siembra el corte (retoma `07` R12-OWNER-3 y el choque con 2d) | [`07`](./07-R12-R14-trial-y-cupos.md) R12-OWNER-3 | **el corte NO siembra trials consumidos.** *«A los clientes ya suscriptos les regalamos el trial de nuevo: los tomamos como clientes nuevos. Sólo les respetamos la ficha para que no la tengan que cargar de nuevo; la suscripción es como si recién arrancaran.»* Revierte la regla de capítulo del 25/09 *«el corte siembra trials consumidos»* (`V/21`, consolidado §5 R12) y vuelve innecesario leer las tablas viejas en el corte. Se mantiene lo que toca fichas (`inactiva_desde`) |
| 3a | *«cambiá la tarjeta»* no está medido como salida del grace | [`01`](./01-R1-R3-R8-grace-S6-y-cambio-de-plan.md) §4 #1 | **opción 2**: la frase de `DEC-SUB-021` queda condicionada a `GR-1`, se mide con el próximo rechazo mensual real, y la pantalla y los correos del grace no prometen que el reintento use la tarjeta nueva |
| 3b | la vuelta del suspendido con tarjeta pierde la promo | `01` §4 #2 | **opción 1**: se acepta y se dice en el aviso de suspensión. **Anotado para el futuro**: ver cómo mejorarlo |
| 3c | el primer cobro fallido de una sucesora declarada en `ACTIVE`/`CANCEL_SCHEDULED` deja a la persona sin nada | `01` §4 #3 | **opción 2 del informe — contra la recomendación**: si falla el primer cobro de una sucesora cuya predecesora venía pagando, la sucesora entra en **grace** (`S4`), no muere (`S16`). **Más un control del owner**: el barrido diario relee su preapproval por id (`D17`); si el proveedor lo **canceló** o lo **pausó**, el grace termina en el acto —`S6`, cancelación de nuestro lado de lo que quede vivo, aviso de suspensión con *«volvé a suscribirte»*—, con la misma forma que `DEC-MP-008`. Así el riesgo de `PA-6` queda acotado a un día. Recomendación del orquestador: aceptarlo y avisarlo antes de confirmar, porque la 2 se apoya en `PA-6` sin medir. Posición del owner: que Juan, que venía pagando, no quede sin nada. (Primera presentación con las opciones mal numeradas; re-preguntado.) Pide entrada en el log: precisa `DEC-SUB-021` y `DEC-MP-008` |
| 3d | *«todavía no se sabe»* sin cota (`F-8CB3-004`) | `01` §4 #4 | **opción 2**: a los 3 días, marca |
| 4a | los addons recurrentes cobran durante una pausa pedida por el cliente (`F-8CC1-004`) | [`03`](./03-R4-R6-cortesia-promos-y-addons.md) AL OWNER 1 | **opción 1**: se pausan también sus addons recurrentes de esa vertical, por los mismos meses (`USER`/`GLOBAL` sólo si no queda título en otra vertical compatible); el complemento gana `PAUSED` |
| 4b | una promo que deja el monto bajo el piso del proveedor traba la pausa | `03` AL OWNER 2 | **opción 1**: ese canje o ese apilado se rechaza al canjear, con el motivo en pantalla |
| 4c | el addon `LISTING` muere por una sucesora abandonada | `03` AL OWNER 3 | **opción 1**: huérfano sólo si **ninguna** principal de ese `user + vertical` está viva y no hay ancla viva |
| 4d | addons `USER`/`GLOBAL` cobran sin título (absorbe `07` R12-OWNER-2) | `03` AL OWNER 4, `07` R12-OWNER-2 | **opción 1**: huérfanos si en ninguna vertical compatible hay principal viva **y cobrada** ni ancla viva |
| 4e | un addon `USER`/`GLOBAL` se emite en verticales no compatibles (`F-8CA1-008`) | `03` AL OWNER 5 | **opción 1**: contrato §2.7, se emite sólo en las verticales compatibles de su producto, con guard gemelo de `G-R2-B` |
| 5a | el reembolso sin estados y lo hecho por fuera sin acto (`F-8CB1-015`, motivos 18 y 19) | [`04`](./04-R5-R7-correo-y-conciliacion.md) §R7.5.1 | **opción 1**: máquina mínima de `refund` (`REQUESTED → CONFIRMED → EXECUTED \| FAILED`) y una acción administrativa nueva, *«asentar un cobro o una devolución que ya ocurrió por fuera»* (el catálogo pasa de 13 a 14) |
| 5b | levantar una moderación larga borra la ficha en días | [`05`](./05-R9-F8CA2004-reloj-y-publicacion.md) `OW-1` | **opción 1**: `PB11` reinicia el reloj (sexto hecho; la lista cerrada pasa de cinco a seis) |
| 5c | la agenda de llamados del corte vence el día 180 | `05` `OW-2` | **no se hace nada especial, y se declara para que no se vuelva a reportar**: *«tenemos 180 días para que lo hagan, es un montón de tiempo»*. Va al «NO cierra» de `V/21` como decisión del owner |
| 6a | `S1` no exige que la vertical admita altas | [`06`](./06-R10-R11-cobertura.md) AL OWNER `S1` | **opción 1**: `S1` exige `admiteAltas` para el alta nueva y la sucesión; la pricing no ofrece planes de esa vertical; mensaje *«esta vertical ya no admite altas»* |
| 6b | el caché de grant, cortesía y trial el día del fin de servicio (γ) | `06` AL OWNER γ | **opción 1**: fila nueva en `V/02` §3.2 — llega `fin_de_servicio` → se invalida toda la vertical, lo ejecuta el barrido del día |
| 6c | `T6` quema el trial de quien se suscribe antes de publicar | [`07`](./07-R12-R14-trial-y-cupos.md) R12-OWNER-1 | **opción 1** (`T6` exige un título que convierte; fila nueva `T8` consume el trial al primer pago) **y además, del owner**: el botón de suscribirse es inteligente — **si el usuario todavía no publicó en esa vertical, lo manda a publicar** (arranca el trial) en vez de al checkout. `T8` queda como red para quien llega al checkout por otro camino. Va a `V/19` y `B/19` |
| 7a | la vertical de un recurso: cambiar la de una ficha, la presencia de Partner, las fotos | [`08`](./08-R13-F8CA1001-partner-y-vertical-de-la-ficha.md) Owner 1 | **opción 1**: la precisión 6 vale para todo recurso que guarda su vertical, y **la vertical de una ficha es inmutable desde el alta** (*«nunca una ficha debería poder cambiar de vertical»*); tercera mitad de `G2` |
| 7b | el carrusel de Partners no tiene regla | `08` Owner 2 | **opción 1**: clave propia *«presencia en el carrusel»* (la otorgan Gold y Silver), mismo caché y mismo reconciliador que la página |
| 7c | el admin no puede bajar una página de Partner sin cancelar el cobro | `08` Owner 3 | **opción 1**: bit de moderación de la presencia, escrito por la misma acción administrativa que `PB10`; se ve si tiene la clave **y** no está moderada |
| 8a | un plan suspendido sigue dando beneficios en otra vertical (`F-8CA1-002`, `F-8CA1-003`) | [`09`](./09-resto-y-registro.md) `AO-1` | **opción 1**: la invalidación es por `user`, no por `user + vertical` (`V/02` §3.2, regla 3) |
| 8b | «inhabilitado por abuso» no existe (`F-8CA1-010`) | `09` `AO-2` | **opción 1**: se saca del paso 2; el abuso se trata ficha por ficha con `MODERATED` |
| 8c | qué puede leer un visitante de lo ajeno (`F-8CA1-011`) | `09` `AO-3` | **opción 1**: en el paso 4, lo ajeno existe sólo en estado público (`PUBLISHED`; presencia de Partner con la clave vigente y sin moderar) |
| 8d | el suspendido no puede leer lo suyo (`F-8CA1-013`) | `09` `AO-4` | **opción 1**: las lecturas de lo propio (Mi Cuenta, su billing, sus fichas) no consultan el paso 6 |
| 8e | el registro de eventos guarda el texto que el día 180 promete borrar (`F-8CA3-004`) | `09` `AO-5` | **opción 1**: en los campos de contenido el evento guarda sólo el nombre del campo; y se corrige `N/01:54` |
| 8f | la cuota manual impaga de quien se va queda viva (`F-8CB2-005`) | `09` `AO-6` | **opción 1**: tercera cláusula de `MP3` → `DECLARED_UNPAID` sin efecto sobre la suscripción, en las 10 salidas del dominio |

**Ronda completa: los 33 puntos tienen respuesta** (32 filas: `4d` absorbe `R12-OWNER-2`). Cinco
quedaron contra la recomendación del orquestador o con agregado del owner: `2a`, `2d`, `2g`, `3c` y
`6c`.

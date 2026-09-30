# FASE 5 — decisiones del owner

> Programa HOS-1352. Respuestas del owner a los lotes del [consolidado](./00-consolidado.md), con las
> opciones tal como se le plantearon. Se registran acá al recibirlas; se llevan al diseño, al log y a
> las descomposiciones en una aplicación aparte.

## Antes del lote 1 — las premisas del corte

El owner fijó, antes de contestar, las premisas del corte: sin convivencia entre la versión vieja y
la nueva; un usuario que entre durante el corte no se diseña; sólo importan cinco cuentas (tres en
prueba o pagando y dos de cortesía), con una ficha cada una; y a esas cinco les avisa el owner por
privado, sin nada programado. Registradas como [`DEC-MIG-007`](../01-decision-log.md). Todo caso
fuera de ellas se descarta citándola.

## Lote 1 — lo que bloquea `U1` (2026-09-30)

| letra | racimo | elegida | contra la recomendación | qué decide |
|---|---|---|---|---|
| A | `R5-01` | 3 | no | `U1` saca los gates de entitlement y limits de las rutas de las verticales y deja la cadena de permiso y propiedad que ya tienen; `V5` agrega el paso de cobertura y suma el criterio de salida *«ninguna ruta de escritura de vertical sin el paso de cobertura»* |
| B | `R5-02` | 1 | no | `billing_notification_log` sobrevive con nombre neutro: `U1` la renombra, le saca la columna y la FK de cliente del cobro, y su índice pasa del extra `004` a uno propio |
| C | `R5-03` | 2 | no | `U1` saca de la rama las migraciones de datos del seed que usan el cobro viejo, **condicionado a una lectura previa del runner**: que tolere filas del registro sin archivo y qué hace `--baseline-stamp` en una base nueva sin ellas |
| D | `R5-04` | 1 | no | `U1` borra las columnas de pago de `partners`, sus FK y los tres crons de partner; la lectura pública queda sin presencia visible hasta `V7` |
| E | `R5-05` | 1 | no | lista cerrada: `U1` borra `users.service_suspended`, `owner_promotions.plan_restricted` y `experiences.has_active_subscription` con sus lectores; tipo de cambio, patrocinios y promociones del dueño quedan; los valores de `entity_type_enum` van con `R5-09`. **Sin conteo previo** de promociones ocultas (`DEC-MIG-007`: cinco cuentas) |
| F | `R5-06` | 1 | no | `U1` retira `is_featured` y `featured_by_entitlement` en las tres tablas; el destaque vuelve sólo como complemento pagado, y la home queda sin destacados hasta entonces |
| G | `R5-07` | 1 | no | `U1` borra `archive-abandoned-drafts` aunque no sea cobro. El complemento 3 (que el guard de `V5` mire también la máquina de la ficha) **no se eligió** |
| H | `R5-08` | 2 | no | `U1` reescribe los extras `032` (nombre y comentarios) y `033` (comentario), y la lista de pendientes de `G8` deja de cubrir `extras/` (una línea en `V/20`) |
| I | `R5-09` | 1 | **sí** | todo en `U1`: se recrean los tipos de la base sin los valores del cobro viejo (incluido el enum de permisos, unos 790 valores) y una migración de datos saca las filas de roles y overrides con esos permisos |
| J | nueva | 1 | no | las fichas de las cuentas que no son las cinco de `DEC-MIG-007` **se borran en el corte**, sin conservar nada: la migración sólo carga las cinco |

**Contra la recomendación: I.** La recomendada era la 2 (los tipos que sólo usan tablas del cobro se
borran con ellas; los valores de permisos y de `entity_type_enum` quedan sin lectores y la
resolución los rechaza), por costo y riesgo menores. El owner eligió la 1: la base queda sin
vocabulario del cobro viejo, al precio de recrear el enum de permisos en `U1`.

**Condición de C, cumplida el 2026-09-30** (lectura del runner sobre `origin/staging` `35e2d63e81`,
sólo lectura): el runner calcula los pendientes en un solo sentido, disco menos registro
(`packages/seed/src/data-migrations/discover.ts:243-256`), así que **ignora sin error las filas del
registro sin archivo**; el checksum se guarda y no se verifica (`ledger.ts:14-16`).
`--baseline-stamp` sólo sella lo que está en disco (`baselineStamp.ts:134-158`). Ningún guard exige
numeración contigua (ya hay un hueco en `0063`, `real-directory-identity.guard.test.ts:67-84`), y
`scripts/check-seed-dual-write.sh` no mira borrados en `data-migrations/`. Sin imports entre
migraciones; `helpers/billingCleanupGuards.ts` sólo lo usa `0068`, del mismo conjunto, y
`helpers/trialPlanMigration.ts` lo usan `0073`–`0075`, que no están en él. La única pérdida es
`0092-hos-1084-backfill-accommodation-subscription-cache.ts` (`contentOnly`, `required`): una base
nueva deja de correr ese relleno, **y no importa**, porque su tabla, `entity_subscriptions`, se retira
con el cobro viejo (`B/docs/21-migracion.md:439`). C queda decidida sin volver al owner.

## Lote 2 — `V1`, `B1` y la infraestructura común (2026-09-30)

Planteado ya filtrado contra `DEC-MIG-007`: la pregunta de `R5-13` se reformuló porque el corte
escribe sólo cinco cuentas.

| letra | racimo | elegida | contra la recomendación | qué decide |
|---|---|---|---|---|
| A | `R5-10` | 1 | no | el outbox lo construye **una unidad nueva del paraguas**, después de `U1` y antes de cualquier unidad que encole, sobre el precedente del newsletter; incluye la supresión y absorbe la bitácora de correos renombrada en el lote 1 B |
| B | `R5-11` | 1 | no | la correlación de punta a punta, el id de corrida y el huso del mercado en los jobs los agrega la misma unidad del outbox; el reloj sigue en `B1` |
| C | `R5-12` | 1 | no | las bases de desarrollo, de tests de integración y del e2e nocturno pasan a armarse con `db:migrate`, como `e2e-pr`: una sola fuente para las filas de referencia |
| D | `R5-13` | 2 | no | el catálogo va en la migración como SQL generado por un script TypeScript y vigilado por un guard que lo regenera y compara; las pruebas y los seudónimos de las cinco cuentas los escribe después el script del corte, con la función de la aplicación, y se verifican a mano. Se resigna que sea todo una sola operación atómica: con cinco filas no importa |
| E | `R5-14` | 1 | no | quedan para `B1` las variables de Mercado Pago salvo `STATEMENT_DESCRIPTOR`; `U1` borra las cuatro de rate limit del cobro y las diez que sólo usa el sistema viejo (`U1-021`) |

Consecuencia de A: **las unidades pasan de 23 a 24**. La nueva va entre `U1` y las primeras que
encolan (`V6`, `V9`, `B4`, `B12`), y su id y dependencias se fijan al aplicar.

## Lote 3 — `V6` y el corte (2026-09-30)

Filtrado contra `DEC-MIG-007` y la J del lote 1, **se descartan sin volver al owner**:

- `R5-18` (las fichas de cuentas de staff pierden la exención): no son de las cinco cuentas; por la J
  del lote 1 se borran en el corte.
- `R5-22` (`M-1`, el titular que sólo conoce el proveedor sin pago aprobado): las cinco cuentas las
  conoce el owner; no hace falta detector (`DEC-MIG-007`, punto 3).

| letra | racimo | elegida | contra la recomendación | qué decide |
|---|---|---|---|---|
| A | `R5-15` | 1 | no | el estado nuevo de la ficha reemplaza a `lifecycle_state`, `visibility` y `moderation_state`: `V6` migra los lectores y los disparadores de revalidación, y cada fila de `V/03` §9 dice si revalida; las viejas se borran en el paso 3 |
| B | `R5-16` | 1 | no | `V6` retira los lectores de las tres columnas que sobreviven en el mismo cambio que la migración que las borra, reemplazados por el estado nuevo; se corrige el texto *«sólo las usa el cobro viejo»* (`16-` §4.6, `V/21`) |
| C | `R5-17` | 1 | no | se retiran todas las puertas de borrado y restauración fuera del diseño: el borrado del dueño pasa a ~~`PB9`~~ `PB12` (corregido en la aplicación, 2026-09-30: la opción 1 de `R5-17` dice *«el del diseño»*, que es `PB12`, `V/03:498`), el del equipo a la acción 23 (a pedido y con motivo), y desaparece el borrado físico de fichas y de cuentas |
| D | `R5-19` | 1 | no | los plazos sin valor los fija el owner **antes del merge de `V6`**, no antes del ensayo del corte |
| E | `R5-20` | 1 | no | el paso 3 despliega con `HOSPEDA_CRON_ADAPTER` apagado y los crons se prenden al confirmar el corte (paso 5); se acepta que los del resto de la plataforma paren esas horas |
| F | `R5-21` | 1 | no | el paso 3 se escribe como tres actos: apagar lo viejo, `hops db-migrate --pull` sobre el mismo commit que la imagen, levantar la imagen nueva; se exige la igualdad de commit |

Pendiente anunciado al owner: un lote propio de **simplificación del corte** a la luz de
`DEC-MIG-007` (clasificación de fichas `L1`–`L8`, restauraciones, recuentos del paso 0, gates del
seudónimo), después de los lotes 4 a 6.

## Lotes 4, 5 y 6 — producto, `B6` y textos (2026-09-30)

| letra | racimo | elegida | contra la recomendación | qué decide |
|---|---|---|---|---|
| A | `R5-23` | 2 | no | `V7` crea la postulación propia de Partner (la de `V/02` §2.7); `alliance_leads` queda para los otros tipos (patrocinadores, editores, proveedores), fuera de este programa |
| B | `R5-24` | 2 | **sí** | se crea un **rol de socio** con su familia de operaciones, sus permisos y su migración de datos, asignado al aprobar la postulación; el paso 3 de la cadena pregunta por esa familia. Por `V/17` (*«perder el acceso nunca revoca un rol»*), el rol **no se quita** cuando el socio pierde su presencia |
| C | `R5-25` | 1 | no | vale el diseño: salen `impersonate` y `set-role` del plugin `admin` de Better Auth, el botón y el permiso `USER_IMPERSONATE`; HOS-354 se cierra o se reescribe como el *«entrar como»* de una versión posterior |
| D | `R5-26` | 1 | no | `V5` pasa a `404` la respuesta a una ficha ajena `RESTRICTED` (la excepción VIP de `error-contract.md`) y su test |
| E | `R5-29` | 1 | no | `trial` y las tablas de sólo agregar nacen sin `deleted_at` |
| F | `R5-27` | 1 | no | las devoluciones de una misma orden se serializan; el id de la nueva sale por resta contra las registradas; sale de `RF3` la rama *«de su mismo monto»* para órdenes; un `409` es error de programación (clave mal derivada), no *«ya estaba hecha»*; se corrige la nota de `RF2` sobre `RF-6`, que es del pago |
| G | `R5-28` | 1 | no | se corrigen las siete frases de una vez; en `AUT-016` se corrige sólo la razón (`banned`, `ban_reason`, `ban_expires` existen y son de Better Auth) y esas columnas se conservan |

**Contra la recomendación: B.** La recomendada era declarar el paso 3 vacuo para Partner y dejar que
lo cubra la propiedad del paso 4, como hoy (una línea). El owner eligió crear el rol: la cadena queda
igual para todas las cuentas, al precio de un rol, sus permisos, su migración y la asignación al
aprobar. El choque que la recomendación señalaba (quitar el rol al perder la presencia) se resuelve
no quitándolo, como manda `V/17`.

## Lote de simplificación del corte (2026-09-30)

Sobre [`20-simplificacion-del-corte.md`](./20-simplificacion-del-corte.md): 78 piezas (38 RETIRAR,
18 SIMPLIFICAR, 22 MANTENER).

| letra | elegida | contra la recomendación | qué decide |
|---|---|---|---|
| A | 1 | no | las cuentas que se conservan son **una lista cerrada que fija el owner**, cada una con su única ficha; si entra alguien que quiere conservar, lo suma; si trae más de una ficha, vuelve al owner. **La lista se fija en el momento en que se esté listo para el corte** (aclaración del owner), no antes |
| B | 1 | no | una sola regla bloquea toda escritura en el sitio viejo y en el nuevo, desde antes de cancelar nada hasta abrir el sistema nuevo; sólo queda abierta la entrada de avisos de Mercado Pago. Salen la lista de rutas, la espera de 30 minutos y los recuentos repetidos |
| C | 1 | no | se retira el rastro de los débitos viejos (lápidas, regla del día del corte, detector y su segunda corrida, mediciones del corte, pasada del correo, vencimiento de links, Worker que cierra la entrada): un cobro tardío de un débito viejo se trata como cualquier débito desconocido, se anota, se cancela y le aparece al owner marcado para decidir la devolución |
| D | 1 | no | abortar el corte es restaurar la base y volver a la imagen vieja, sin reabrir la venta; las cinco cuentas esperan el reintento y el owner les avisa. Sale la prueba en producción del paso 0 |
| E | 1 | no | OK a las 32 consecuencias directas de `DEC-MIG-007` y la J, y a los cambios del log del §11: `DEC-MIG-004` SUPERSEDED por `DEC-MIG-007`; se precisan `DEC-MIG-002`, `DEC-MIG-003`, `DEC-MIG-005`, `DEC-MIG-006`, `DEC-CONC-002` y `DEC-ARCH-014` |

Con esto quedan contestados todos los lotes de la FASE 5. Lo que sigue es la **aplicación**: llevar
las decisiones de este archivo al diseño (núcleo, contrato, `16-`, las dos épicas), al log, a la
matriz y a las descomposiciones (una unidad nueva, la del outbox: 24).

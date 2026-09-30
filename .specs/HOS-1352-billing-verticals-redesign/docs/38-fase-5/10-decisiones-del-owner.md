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

**Pendiente de C**: la lectura del runner del seed, de sólo lectura, antes de escribir `U1`. Si el
runner no tolera filas del registro sin archivo, C vuelve al owner.

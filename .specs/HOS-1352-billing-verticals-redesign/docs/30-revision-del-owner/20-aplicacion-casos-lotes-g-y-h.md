---
title: "Revisión del owner · lotes G y H de casos vecinos, y el lote final del log y la matriz"
linear: HOS-1352
statusSource: linear
created: 2026-09-29
updated: 2026-09-29
status: CURRENT
fase: 9
---

# Revisión del owner · lotes G y H de casos vecinos, y el lote final del log y la matriz

Los lotes G (cuatro casos, nuevos de [`18-`](./18-aplicacion-casos-cobro.md) §3) y H (siete, nuevos
de [`19-`](./19-aplicacion-casos-transversal-y-lote.md) §3) de
[`16-casos-vecinos-decididos.md`](./16-casos-vecinos-decididos.md), todos con la recomendada.
Medido y editado en el worktree `hospeda-spec-hos-1352-billing-redesign` sobre el HEAD
`02562d9681`, sin commits. Leídos antes, enteros, los registros de las tres tandas de casos
anteriores ([`17-`](./17-aplicacion-casos-corte-y-verticales.md), [`18-`](./18-aplicacion-casos-cobro.md)
y [`19-`](./19-aplicacion-casos-transversal-y-lote.md)): no pisé nada suyo, y el §4 de éste
reemplaza al §4 de `19-` como lote para el owner. Abreviaturas: `B/` es `HOS-1354…/docs`, `V/` es
`HOS-1353…/docs`, `D/12` el contrato, `D/16` la FASE 7 del paraguas, `nucleo/` el núcleo, `$V/` y
`$B/` la raíz de cada sub-spec.

**Forma**: tachado y fechado `(revisión del owner, casos vecinos, 2026-09-29, caso G-A)` a
`caso H-G`. En el texto nuevo no escribí la palabra (las mediciones la buscaron con el patrón
armado en partes) ni em dashes. No hay números nuevos: ninguna transición, acción, motivo ni
guard.

## 1. Qué se aplicó

### G-A · `S38` se aplica en `GRACE_PERIOD` y espera en `SUSPENDED` hasta `S7`

El `desde` de `S38` suma `GRACE_PERIOD`; el evento suma la vuelta a `ACTIVE` con la fecha ya
pasada, por `S7` desde la suspensión y por `S10` desde la pausa, que es la espera que la fila ya
declaraba y no tenía evento que la disparara. El ⚠️ del hueco queda tachado, con dos bordes nuevos
declarados (§3, puntos 1 y 2):

- `B/03:188` «o la fila vuelve a `ACTIVE` con esa fecha ya pasada»
- `B/03:188` «una suspendida espera a volver por `S7`»
- `B/03:188` «Dos bordes quedan sin escribir»
- `S7`, para que quien la construya lo vea: `B/03:157` «al volver a `ACTIVE` lo aplica `S38`»
- La tabla del grace (§4): `B/03:1623` «Y un cambio programado cuya fecha llega se aplica igual»
- `B/12:225` «Y el estado en que la fecha encuentra a la fila, que no es una colisión»
- `B/12:230` «Ninguna de las cuatro colisiones cambia»
- `B/10:196` «ya mutó el monto y la fecha de aplicación encuentra a la fila en»
- Lo que `B/10` no cierra: `B/10:245` «con el monto ya mutado, la fecha la aplica»

**Las colisiones del `B/12` §2.2 no cambian**: las cuatro son lo que llega encima del cambio (otro
downgrade, un upgrade, una baja, una pausa), y G-A es con qué estado llega su fecha. La 3 sigue
absorbiéndolo desde la grace y la suspensión (`S24`, `S23`), y la regla general de dos cláusulas
tampoco se mueve: lo escribí como párrafo aparte, no como tercera cláusula. **En las tablas de
`B/03`**: la del §3.1 (los nueve estados), la de las salidas de `SUSPENDED` y la de *«qué mueve la
fecha del próximo cobro»* no cambian (`S38` es el mismo estado y no mueve la fecha); `§3.3.1` dice
que en `GRACE_PERIOD` no se **ofrece** cambiar de plan, y eso sigue: G-A aplica un cambio pedido
antes de entrar. **Las transiciones vivas siguen en 34**, recontadas (§2).

`B/10` §3.7 punto 7 (*«pausados y en gracia esperan»*) y la fila de `plan_migration_subscription`
en `B/02` (*«la fecha de aplicación se recalcula mientras la fila está `PAUSED` o en
`GRACE_PERIOD`»*) hablan del día de `S37`, con la fila en `PENDIENTE`; no los contradice, y lo
dejé dicho en el punto 7.

### G-B · la interfaz del reloj vive en el package del contrato

El package del contrato pasa de cuatro cosas a cinco:

- `D/12:1489` «Tiene cinco cosas»
- `D/12:1506` «La interfaz del reloj»
- `B/20:733` «lee el código de producción vive en el package del contrato»
- `$B/descomposicion.md:127` «y la interfaz del reloj que lee producción, en el package del contrato»

`G14` no cambia: importar el contrato nunca fue cruzar.

### G-C · la batería relee `RP7` a `RP11` sin mutar

- `B/20:651` «La batería las relee sobre sujetos que ya existen, sin mutar»
- Lo que no vigila: `B/20:679` «las que no se puedan releer sobre un sujeto existente»
- `$B/descomposicion.md:127` «releídas sobre sujetos existentes, sin mutar»

Cuáles no se pueden releer se sabe al construir la batería (`B1`); por eso no las nombré.

### G-D · dónde registra el receptor los IPN, condicional a `WH-6`

- `B/06:494` «de medir `WH-6`»
- `B/06:495` «cuerpo y el instante, que ninguna transición lee»

No la sumé al modelo de `B/02`: es condicional, y entra el día que se sepa que `WH-6` no se mide.

### H-A · la tercera entrada de la lista de pendientes de `G8`

La lista pasa a tener tres entradas: las dos historias y **las carpetas del programa en `.specs/`
(`HOS-1352-…`, `HOS-1353-…` y `HOS-1354-…`)**. El paso 6 saca las dos historias y enciende la
regla para ellas (F-B, sin cambio); el commit del cierre de HOS-1352 saca la tercera y extiende la
regla a la lista entera. Lo que el caso 8 decía que eran dos, *«y ninguna más»*, *«no admite una
tercera»* y *«un build … falla si no está vacía»*, quedó tachado donde lo decía:

- `V/20:56` «tres entradas y ninguna más»
- `V/20:56` «y las carpetas del programa en `.specs/`»
- `V/20:56` «una cuarta entrada»
- `V/20:56` «La tercera entrada la saca el commit del cierre de HOS-1352»
- El criterio de `V1`: `$V/descomposicion.md:560` «cuarta entrada a la lista falla»
- `$V/descomposicion.md:560` «y salvo en las carpetas del programa en»
- La fila de la limpieza: `$V/descomposicion.md:484` «y hasta el cierre de HOS-1352, en las carpetas del programa»
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:403` «y una tercera entrada, las carpetas del programa en»
- El invariante 32: `nucleo/04:78` «y hasta el cierre de HOS-1352 las carpetas del programa en»
- `nucleo/04:78` «el commit del cierre le saca la tercera»
- El paso 6: `D/16:145` «salen de la lista de pendientes de `G8` esas dos historias»
- `D/16:145` «En la lista queda la tercera entrada»
- La tarea del cierre: `.specs/HOS-1352-billing-verticals-redesign/spec.md:193` «El mismo commit saca de la lista de pendientes de»

**Leí *«la carpeta de specs»* de `16-` como *«las carpetas del programa»*, que es lo que la opción
(a) de `19-` §3 punto 1 nombraba.** La lectura literal, `.specs/` entero, no es la misma: hoy la
palabra está en 74 archivos versionados de `.specs/`, 28 del programa y **46 de otras 37 specs**,
y en 4 de `.qtm/` (medido en el worktree sobre `02562d9681`). Va como caso vecino (§3, punto 4).

### H-B · el log y la matriz se quedan y se reescriben al cierre

Sumado a la tarea del cierre que la tanda 3 escribió en la spec del paraguas, con su espejo en la
limpieza de `V1`:

- `.specs/HOS-1352-billing-verticals-redesign/spec.md:182` «Salvo el decision log y la matriz»
- `.specs/HOS-1352-billing-verticals-redesign/spec.md:189` «se quedan en el repositorio y se reescriben una vez»
- `V/21:540` «El decision log y la matriz tampoco entran acá»

### H-C · qué escribe la acción 24

Escrita en su fila y en el §1.3, con sus espejos. **Al aplicarla apareció un choque** con el
modelo de verticales, que va marcado ⚠️ en los dos lados y como caso vecino (§3, punto 3): la FK
de `trial.user_id` es `ON DELETE RESTRICT`, y `V/02` §2.4 ya decía que el borrado de la cuenta
seudonimiza la fila de `user` y no la borra.

- `nucleo/08:203` «Qué escribe: borra la fila de la cuenta y sus sesiones»
- `nucleo/08:203` «Choca con `V/02` §2.4»
- El ⚠️ del §1.3: `nucleo/08:89` «lo dice la vigesimocuarta del §3 para la baja manual»
- `nucleo/08:117` «Qué escribe borrar la cuenta está en su fila del §3»
- `V/02:409` «Eso choca con esta FK»
- `V/02:791` «para la baja manual lo»
- `$V/descomposicion.md:482` «y borrar una cuenta borra su fila y sus sesiones»

`DEC-DATA-005` (*«los datos personales no se tocan»*) habla de la retención, no del borrado de la
cuenta, que esa decisión declara *«otro proceso»*; no la contradice.

### H-D · la clase y la unidad de las acciones 23 y 24, confirmadas

- `nucleo/08:202` «confirmadas por el owner (revisión del owner, casos vecinos, 2026-09-29, caso H-D)»
- `nucleo/08:203` «confirmadas por el owner (caso H-D)»
- `$V/descomposicion.md:482` «confirmado por el owner, casos vecinos, caso H-D»
- `V/17:386` «confirmado por el owner, caso H-D»

### H-E · después de una pausa, la versión de plazos que guarda la ficha

La excepción a *«un reloj que se reinicia guarda la versión vigente»*: el reinicio por fin de
pausa no se escribe, así que no hay dónde guardar otra.

- `nucleo/02:181` «Salvo el reinicio por el fin de una pausa, que no se escribe»
- `D/12:1106` «con la versión de plazos que guarda la ficha»
- `V/02:873` «con la versión de plazos que guarda la ficha»

### H-F · la app del panel lee las dos mitades por la API

- `V/19:88` «La app del panel lee las dos mitades por la API, sin importar ninguna»
- `B/19:218` «La app del panel lee las dos mitades por la API, sin importar ninguna»
- `nucleo/02:209` «que lee las dos mitades por la API sin importar ninguna»
- La fila de `G14`: `V/20:58` «La app del panel no junta las dos»

### H-G · el correo de `PB12` cuando borra soporte

El mismo correo, con una línea más; el catálogo de `nucleo/07` §6 no suma fila:

- `nucleo/07:253` «es el mismo correo con una línea más»
- `V/03:493` «y cuando la borra soporte lleva una línea más»

## 2. Conteos que cambiaron

| qué | antes | ahora | cómo se contó | espejos corregidos |
|---|---|---|---|---|
| cosas del package del contrato (`D/12` §7.1) | 4 | **5** (la interfaz del reloj) | leídas; `rg "cuatro cosas"` sobre el diseño vigente: sólo `D/12` lo cuantifica | `D/12` |
| entradas de la lista de pendientes de `G8` | 2 | **3** (las carpetas del programa) | por construcción | `V/20`, `$V/spec.md`, `$V/descomposicion.md` (dos filas), `nucleo/04`, `D/16`, `HOS-1352/spec.md` |
| estados del `desde` de `S38` | 1 | **2** (`ACTIVE`, `GRACE_PERIOD`) | leída la fila | `B/12`, `B/10` |
| puntos de la tarea del cierre de HOS-1352 | 2 | **4** (el log y la matriz; la tercera entrada de `G8`) | leídos | la spec del paraguas |
| transiciones vivas de la Suscripción | 34 | **34** | script sobre las filas `S<n>` de `B/03` §3.2 sin tachar: 34 vivas, `S25`–`S28` retiradas | sin cambio |
| 📌 del lote para el log, si el owner lo aprueba | 16 | **17** (entra `DEC-ARCH-006`) | contadas en el §4 | sólo el log |
| decisiones precisadas sin `SUPERSEDED`, si el owner aprueba el §4 | 58 | **66**, igual que con `19-` | `contar-precisadas.py` sobre una copia del log con las diecisiete líneas de *Estado* simuladas: `DEC-ARCH-006` ya estaba precisada | sólo el log |

**Lo que no se movió**: los 33 guards (18 · 15; `G14` no cambia en G-B ni en H-F); las 23 acciones
administrativas y sus clases (H-D confirma, no mueve); los 24 motivos (G-D no marca nada); las
siete entradas del contrato y sus trece campos (la interfaz del reloj no es una entrada de §4.1);
los cinco hechos del reloj; los 15 plazos; las once dependencias entre épicas; el catálogo de
correos de `nucleo/07` §6 (H-G es una línea del mismo correo); los 17 pasos del corte; las
colisiones del `B/12` §2.2, cuatro; las dos listas del falso, 13 y 11; y la cosa sin cerrar de la
migración en el «NO cierra» de `B/10`, una.

## 3. Casos vecinos (piden decisión, no los decidí)

1. **`S7` que deja la fila en `CANCEL_SCHEDULED` con un cambio programado vencido** (G-A). `S7`
   vuelve a `CANCEL_SCHEDULED` cuando el cobro entró sobre un preapproval que `S6` ya canceló: la
   persona recibe el período que pagó y `S12` la termina. `CANCEL_SCHEDULED` no es un `desde` de
   `S38`, así que el cambio no se aplica y el período pagado corre con las capacidades viejas.
   Dos formas: aplicarlo al entrar a `CANCEL_SCHEDULED` por `S7`, o descartarlo como la colisión 3.
   Recomiendo **aplicarlo**: el período se pagó con el monto ya mutado, y descartarlo le regala las
   capacidades que ya no paga, que es lo que G-A evitó en la grace.
2. **El pagador con tarjeta suspendido no vuelve por `S7`** (G-A). Vuelve como sucesora
   (`DEC-SUB-019`), y la cola es de la predecesora, que `S17` cierra. Recomiendo **declararlo como
   la colisión 2**: el cambio muere con la fila vieja, porque la sucesora eligió su plan en el
   checkout; y en una migración, su fila de alcance queda `APLICADA` sin que la versión haya
   cambiado en la predecesora, lo que conviene decir en `B/10` §3.7 para que nadie lo lea como un
   error.
3. **La acción 24 borra la fila de la cuenta, y la base no la deja** (H-C). `V/02` §2.4: la FK de
   `trial.user_id` a `user` es `ON DELETE RESTRICT` (FASE 8 completa, `F-8CA3-008`), elegida para
   que el hash del correo del trial sobreviva; con ella, borrar la fila de una cuenta que tuvo un
   trial, que es casi todo dueño, falla. Dos formas: **(a)** la 24 seudonimiza la fila de `user`
   (sin credenciales, sin sesiones, con lo personal reemplazado) en vez de borrarla, que es lo que
   `V/02` ya decía; **(b)** se borra y la FK pasa a `SET NULL` o `CASCADE`, que rompe la regla 2 de
   `V/02` §4.2 o reabre el segundo trial. Recomiendo **(a)**: cumple lo que el owner pidió (lo
   personal no queda) sin tocar `DEC-TRIAL-004`. Y dos precisiones que la misma elección pide:
   *«en lo que sobrevive a la cuenta»* no enumera dónde está lo personal fuera de `user` (el
   cliente de billing, el pagador de un cobro), y *«no toca los cobros»* convive con eso: conviene
   decir si el correo del pagador en un cobro se seudonimiza o se queda.
4. **Qué cubre la tercera entrada de `G8`** (H-A). Escribí las carpetas del programa. Si fuera
   `.specs/` entero, el commit del cierre tendría que reescribir también 46 archivos de 37 specs
   ajenas; con las carpetas del programa, esos 46 y los 4 de `.qtm/` fallan `G8` desde que `V1` lo
   construye, y **la limpieza de `V1` no los nombra** (`V/21` §4 nombra el rol, los permisos, la
   tabla de contactos, el tipo de partner, el `CLAUDE.md` raíz y el i18n). Recomiendo confirmar las
   carpetas del programa y **sumar a la limpieza de `V1` las specs ajenas y `.qtm/`**, medidos.
5. **Qué unidad construye la interfaz del reloj** (G-B). `D/12` §7.1 dice que cada entrada entra
   con la unidad que construye su implementación; el reloj adelantable es de `B1`, y la
   implementación de producción (la hora del sistema) no tiene unidad escrita. Recomiendo `B1`,
   con el adelantable.

**Fuera de lo que este registro puede editar**: el caso 29 de `18-` (la presentación) sigue en el
paso 4 de `03-handoff.md`.

## 4. Para el log y la matriz (pide OK del owner)

**Es el lote final, autocontenido**: reemplaza al §4 de `19-`, que consolidaba `17-` y `18-`, y
suma G y H sin duplicar. Donde una decisión recibía propuestas de más de una tanda, va un solo 📌
con el texto junto. **Cada ID grepeado el 2026-09-29 sobre `02562d9681`** en
`01-decision-log.md` y en la matriz: existen los diecisiete `DEC` de abajo y `WH-6`; **`EX-54` no
existe** (la última `EX` es `EX-53`); **`casos vecinos` no aparece ni en el log ni en la matriz**,
así que ningún ID tiene todavía un 📌 de éstos. Cada 📌 suma a su *Estado*: *«precisada el
2026-09-29, con OK del owner (revisión del owner, casos vecinos, <casos>; ver su 📌)»* donde hoy
dice `ACCEPTED` a secas, o *«y precisada…»* donde ya había precisiones.

**Hoy en `ACCEPTED` a secas, y por eso suman a la cifra**: `DEC-MIG-006`, `DEC-DATA-006`,
`DEC-DATA-007`, `DEC-ARCH-012`, `DEC-ARCH-013`, `DEC-SUB-023`, `DEC-TEST-003` y `DEC-DATA-008`.
Las otras nueve (`DEC-DATA-005`, `DEC-ENT-002`, `DEC-TEST-001`, `DEC-ARCH-007`, `DEC-SUB-008`,
`DEC-ARCH-004`, `DEC-RF-008`, `DEC-AUTH-003` y `DEC-ARCH-006`) ya están contadas.

### 4.1 Los 📌

1. **`DEC-MIG-006`** (casos 5 y 6): *«En el paso 0 se toman dos recuentos sobre la cartera vieja:
   si el sistema viejo servía alguna ficha que el corte hace nacer `PURGED` o en `DRAFT`, y si da
   cero el paso 4c se saltea; y cuántos dueños tienen más de una ficha a la vista en la misma
   vertical, que no es gate y vuelve al owner si da más de cero.»*
2. **`DEC-DATA-006`** (casos 12, F-A y H-E): *«Todo fin de la pausa, por cualquier camino,
   reinicia el reloj, también una baja desde la pausa. Ese reinicio no se escribe:
   `retenciónDetenida` devuelve también cuándo terminó la última pausa por `CUSTOMER_REQUEST` de la
   persona en esa vertical, y sus lectores cuentan desde el más tardío de dos instantes,
   `listing.inactiva_desde` y ése, con la versión de plazos que guarda la ficha
   (`listing.plazos_version`), porque el reinicio no escribe otra. La lista de hechos del reloj y
   `G-R6-B` no cambian. Una pausa vencida cuya reanudación no se aplicó la pone delante de una
   persona el barrido diario, con el motivo `REANUDACIÓN_NO_APLICADA`, que ya existía.»*
   **Razón**: la decisión dice *«al volver»*, y la baja desde la pausa dejaba correr `PB4` y `PB9`
   al día siguiente; y *«un reloj que se reinicia guarda la versión vigente»* no alcanzaba a un
   reinicio que no se escribe.
3. **`DEC-DATA-007`** (casos 13, 14, 15 y H-G): *«Una ficha moderada desde `ARCHIVED` vuelve por
   el origen de su archivado. Los dos niveles valen sólo para fichas: la presencia de Partner
   conserva su bit sin niveles. Y el correo de confirmación del borrado sale en todo `PB12`, no
   sólo sobre una moderada; cuando la borra soporte a pedido del dueño es el mismo correo, con una
   línea que dice que fue a su pedido, sin fila nueva en el catálogo.»*
4. **`DEC-ARCH-012`** (casos 8, 9, 19, 41, F-B, F-D, H-A y H-B): *«El tipo de partner se renombra
   a `business`, con la etiqueta "Comercio" en español sin cambios, y la migración de datos de V1
   reescribe los que tienen el valor viejo. Hasta el cierre de HOS-1352 `G8` lleva una lista de
   pendientes cerrada con tres entradas: la historia de migraciones, las migraciones de datos del
   seed y las carpetas del programa en `.specs/`. El paso 6 del corte saca las dos historias y en
   el mismo commit enciende la regla que hace fallar un build destinado a producción con una de
   ellas en la lista, así que el despliegue del paso 3 no falla por ella; el commit del cierre de
   HOS-1352 saca la tercera y extiende la regla a la lista entera. Las 11 migraciones de datos del
   seed que importaban el archivo de configuración de planes se congelan con sus valores adentro
   hasta que el paso 6 las saca. El script del corte arma el valor viejo sin escribir la palabra de
   corrido, como el propio `G8`, y no entra a la lista. El `CLAUDE.md` raíz y los archivos de i18n
   que la nombran entran en la limpieza de V1. Y al cerrar HOS-1352 los informes históricos del
   programa salen del repositorio (quedan en el historial de git; lo que importe se resume en
   Linear), el diseño vigente se reescribe una vez, sin tachados ni la palabra, y este log y la
   matriz de validación se quedan y se reescriben sin la palabra, con el OK del owner a esa
   reescritura.»* **Razón**: reemplaza *«con un nombre a definir con el owner»*, y la decisión
   decía que el corpus se reescribe o se borra sin decir cuándo ni qué pasa con el log.
5. **`DEC-ARCH-013`** (casos 9, 42, 43 y 49): *«Las 11 migraciones de datos del seed que
   importaban el archivo borrado se congelan con sus valores adentro, en el mismo cambio que lo
   borra, y salen en el paso 6 del corte. Los datos de planes que usan desarrollo y las pruebas son
   datos de demostración, fuera del dual-write: en el mismo cambio salen la rama del archivo en
   `scripts/check-seed-dual-write.sh` y la mención a los planes de billing en la regla del
   `CLAUDE.md` raíz. La migración única del catálogo falla si alguno de los cinco plazos sin valor
   escrito está vacío, y el owner los fija antes del ensayo del corte en staging. Y las claves, de
   los entitlements y de los límites, siguen en el código; los valores viven en la base.»*
   **Razón**: la decisión dice *«El catálogo de claves sigue en código»* y su *Origen* anota que
   el owner no lo decidió explícitamente; ahora lo decidió, con el agregado de los límites.
6. **`DEC-DATA-005`** (casos 7, F-C y H-C; F-C contra la recomendación): *«La lista de pasos de la
   baja de cuenta manual se escribe antes del corte, en este orden: la baja del cobro, `PB12` por
   cada ficha y la cuenta (`NUCLEO/08` §1.3). Los tres los hace soporte desde el panel, a pedido
   del dueño y con motivo: el primero con "cancelar una suscripción", que ya existía, el segundo
   con la acción 23, "borrar una ficha ajena a pedido de su dueño", que corre `PB12`, y el tercero
   con la 24, "borrar una cuenta a pedido de su dueño", que se rechaza mientras le cuelgue una
   suscripción viva o una ficha fuera de `PURGED`. La 24 borra la fila de la cuenta y sus
   sesiones, seudonimiza lo personal (nombre, correo y teléfono) en lo que sobrevive a la cuenta y
   no toca el registro de auditoría, que conserva el actor y el sujeto por id, ni los cobros. La
   baja desde Mi Cuenta sigue fuera de la épica (HOS-1393).»* **Razón**: la decisión decía
   *«soporte a mano»* y no decía qué escribe el borrado de la cuenta. **Ojo**: el choque de
   *«borra la fila»* con la FK `ON DELETE RESTRICT` de `trial.user_id` (§3, punto 3) está abierto;
   si el owner elige seudonimizar la fila, esta frase cambia antes de escribirse.
7. **`DEC-ENT-002`** (casos 10 y 11): *«Con más de un título vivo ancla el que da la cuota; con
   dos, el que arrancó primero. El `BASE` ancla en el alta de la cuenta, y se confirma el día que
   la versión de piso otorgue un entitlement medido.»*
8. **`DEC-TEST-001`** (casos 16 y 48): *«`G-R6-B` suma una tercera mitad: un lector de
   `listing.inactiva_desde` que decide archivar, borrar o avisar y no consulta
   `retenciónDetenida`. Y su mitad de escritores vigila también `listing.plazos_version`, que se
   escribe sólo junto con `inactiva_desde`. El catálogo sigue en 33 guards.»*
9. **`DEC-ARCH-007`** (casos 3 y 4): *«`rollout` queda cerrado: las ramas son el §4.4 de la FASE 7
   del paraguas y el orden de despliegue el §4.2. El script del corte vive versionado en
   `scripts/cutover/` y se borra en un commit posterior al corte.»*
10. **`DEC-SUB-023`** (casos 20 a 27 y G-A): *«`S37` muta el monto siete días antes de la fecha de
    aplicación, un plazo técnico y no configurable. Los correos van al anunciar y 30 y 7 días
    antes de la fecha de renovación de cada cliente. La migración sigue siendo la acción 17, aparte
    de publicar una versión de plan, y lo que aplica fila por fila (`S37` y `S38`) es una
    transición que aplica lo que la persona firmó al anunciar. Si la cohorte incluye la cuenta del
    propio `SUPER_ADMIN`, esa fila se excluye y el acto sigue. Cancelar no deshace una mutación ya
    hecha: a quien está dentro de sus siete días le sale un correo que lo explica. `PARA_RESOLVER`
    no tiene plazo, y el panel muestra su antigüedad. Una cortesía temporal vigente el día de la
    migración espera a volver. Y que pausados y en grace esperen es del día de `S37`: si `S37` ya
    mutó el monto, la fecha de aplicación la aplica `S38` igual en `GRACE_PERIOD`, y al volver por
    `S7` en `SUSPENDED`.»* **Razón**: la decisión dice *«pausados y en grace esperan a volver»* sin
    distinguir el día de la mutación del de la aplicación.
11. **`DEC-SUB-008`** (casos 37 y G-A): *«El descenso programado lo aplica `S38`, la transición de
    la cola de `B/12` §2 que también aplica el cambio de versión de una migración: pasa la fila a
    la versión destino, aplica la elección de qué conservar y emite el aviso de cobertura. Si la
    fecha llega con la fila en `GRACE_PERIOD`, se aplica igual, porque el servicio sigue y el monto
    ya se mutó; en `SUSPENDED` espera y se aplica al volver por `S7`; en `PAUSED` espera a la
    reanudación, como ya estaba.»* **Razón**: la decisión dice *«baja los entitlements al fin del
    ciclo»* y ninguna transición lo hacía, ni decía qué pasa si el fin del ciclo encuentra a la
    fila en mora.
12. **`DEC-ARCH-004`** (caso 30, contra la recomendación): *«El package del cobro es un package
    compartido del repo; publicarlo en npm pediría reescribir sus dependencias internas. Puede
    depender de packages internos de Hospeda con la regla del owner: "siempre que sea simple evitar
    la dependencia de otro package de Hospeda, evitalo; si es complejo, la dejamos y en el futuro
    se reverá", porque "no quiero demorar la salida de esta épica por eso". `G16` no mira esas
    dependencias; la prohibición de `@qazuor/qzpay` sigue.»* **Razón**: su 📌 del 2026-09-28 dice
    *«de modo que se pueda publicar como package npm propio sin reescribirlo»*, y eso deja de ser
    cierto.
13. **`DEC-TEST-003`** (casos 28, 31, 32, 33, 35 y G-C): *«La segunda lista del falso lleva
    también el comportamiento medido que no es mentira ni regla exigida (`RC-7`, `GR-3`, `PS-2`,
    `PS-6` y el campo `last_charged` de `RC-5`): son once, no seis. La batería las relee sobre
    sujetos que ya existen, sin mutar, y las que no se puedan releer así se declaran "vigiladas a
    mano". El reloj adelantable vive en un package de pruebas compartido que importan las dos
    mitades. La regla de smoke del `CLAUDE.md` raíz se actualiza, en el mismo cambio, a medida que
    cada sección del checklist sale del manual. La autorización mensual de la batería en producción
    la custodia el owner y la renueva cada mes. Y cada lectura por id lleva su instante: la
    decisión rechaza una lectura anterior al comienzo del acto, que es el de la decisión sobre ese
    sujeto; va dentro del tipo, así que `G17` conserva sus dos predicados. Queda una ventana de
    milisegundos entre releer y actuar, porque Mercado Pago no ofrece compare-and-swap, y la cubre
    el barrido.»* **Razón**: la decisión dice *«seis reglas propias»*.
14. **`DEC-DATA-008`** (casos 43, 44, 45, 46, 47, 50 y H-F): *«Configurar el 90 y el 180, que el
    §25 del PDR fija, es un apartamiento declarado del PDR, el décimo; el PDR no se edita. Los
    cinco plazos sin valor escrito (el `N` de `PB5`, los avisos previos de retención, el techo de
    días de prueba, la postulación de Partner atrasada y la espera tras un rechazo) los fija el
    owner antes del ensayo del corte en staging, y la migración única del catálogo falla si alguno
    está vacío. El mínimo de `DEC-MP-002` queda en 60 días: se puede alargar, no acortar. Alargar
    un plazo tampoco alcanza a los relojes ya arrancados: cada uno cuenta con su versión. Los
    plazos de las dos mitades van en una sola pantalla, compuesta en la app del panel, que lee las
    dos mitades por la API sin importar ninguna, así que `G14` no la marca. Y la cota de `G-R5-B`
    queda atada al plazo de borrado, no a 6 meses literales.»* **Razón**: su campo *Sin decidir*
    dice que el apartamiento del §25 lo decide el owner y que *«hasta entonces no se suma al
    `## Resumen`»*: ya lo decidió (caso 46).
15. **`DEC-RF-008`** (casos F-C y H-D): *«Las acciones administrativas pasan de veintiuna a
    veintitrés vivas: entran la 23, borrar una ficha ajena a pedido de su dueño, que corre `PB12`
    y se evalúa sobre el sujeto como la 15, y la 24, borrar una cuenta a pedido de su dueño, que es
    capacidad del actor; las dos con permiso propio, auditoría, motivo y confirmación por
    destructivas, y las dos las construye `V8`, como la 15. La clase y la unidad las confirmó el
    owner.»* **Razón**: su último 📌 dice *«de dieciséis a veintiuna vivas»*.
16. **`DEC-AUTH-003`** (caso F-C): *«El "sin borrar" de la acción 15 vale para la edición de
    contenido: borrar una ficha ajena a pedido de su dueño es la acción 23, otra fila con su
    permiso.»* **Razón**: la decisión dice *«sin publicar, destacar ni borrar»*, y desde F-C
    soporte borra.
17. **`DEC-ARCH-006`** (caso G-B) ✚: *«El package del contrato tiene una quinta cosa: la interfaz
    del reloj con que el código de producción de las dos mitades lee la hora, inyectada. El reloj
    adelantable que la implementa vive en el package de pruebas compartido. `G14` no cambia:
    importar el contrato nunca fue cruzar.»* **Razón**: su 📌 del 2026-09-28 enumera lo que el
    package tiene (*«las dos interfaces, sus validaciones, los simuladores de cada lado y los dos
    juegos de casos»*), y quedaría corto. Ya está precisada, así que no suma a la cifra.

### 4.2 El `## Resumen` del log

18. **Fila *«Apartamientos declarados del PDR»***: de 9 a **10**, *«2026-09-29: suma
    `DEC-DATA-008`, del §25, los 90 y 180 días de la retención que pasan a ser configurables (casos
    vecinos, caso 46)»*; y sale el *«serían 10 si el owner declara…»*.
19. **Fila *«Precisadas sin `SUPERSEDED`»***: de 58 a **66**, sumando `DEC-MIG-006`,
    `DEC-DATA-006`, `DEC-DATA-007`, `DEC-ARCH-012`, `DEC-ARCH-013`, `DEC-SUB-023`, `DEC-TEST-003` y
    `DEC-DATA-008`, recontado con `contar-precisadas.py`.
20. **Una fila *«Casos vecinos de la revisión del owner»***: *«0 nuevas, 17 📌, 0 `SUPERSEDED`,
    del 2026-09-29, sobre los 65 casos vecinos decididos (`30-revision-del-owner/16-`: los 50 de
    los lotes A a E, y los lotes F, G y H, de cuatro, cuatro y siete); registros `17-`, `18-`,
    `19-` y `20-`.»*

### 4.3 La matriz

21. **Fila nueva `EX-54`** (`UNKNOWN`, caso 34): *«¿Qué correo le manda el proveedor al pagador
    cuando le SUBIMOS el monto de un preapproval, con qué texto y en qué momento respecto de la
    mutación?»* `EX-3` lo midió al bajar (*«El vendedor Hospeda cambió el monto»*). Se mide con una
    mutación hacia arriba sobre un preapproval de prueba, leyendo la casilla del pagador.
    **Razón**: que el tercer correo de la migración lo anticipe con el texto exacto (`B/10` §3.7
    punto 4). Sus espejos son los que lista `15-` §3 (`spec.md` del paraguas, `$B/spec.md`, `B/06`
    y `$B/descomposicion.md` §2.7, que además tendría que darle unidad).
22. **Un 📌 en `WH-6`** (casos 39 y G-D): *«Se mide antes de cerrar el diseño (paso 2 del
    handoff). Si no se llega a medir, el receptor nuevo registra los avisos IPN sin actuar hasta
    que esta fila esté medida (`B/06`, "lo que este capítulo NO cierra"). Dónde los registra se
    decide después de medirla; si no se llega a medir, en una tabla propia, sólo de altas, con el
    canal, el cuerpo y el instante, que ninguna transición lee.»* No cambia su estado.

### 4.4 Las cifras que resultarían, contadas con script

Simulado sobre copias del log y de la matriz en el scratchpad de la sesión, con las diecisiete
líneas de *Estado* marcadas y `EX-54` insertada después de `EX-53`:

| | hoy | con el lote entero |
|---|---|---|
| decisiones | 134 | **134** (ninguna nueva) |
| precisadas sin `SUPERSEDED` | 58 | **66** |
| con `SUPERSEDED` en su *Estado* | 11 | **11** |
| apartamientos declarados del PDR | 9 | **10** |
| 📌 de los casos vecinos | 0 | **17** en el log y **1** en la matriz |
| filas de la matriz | 111 | **112** |
| `VERIFIED` · `PARTIALLY_SUPPORTED` · `NOT_SUPPORTED` · `UNKNOWN` | 55 · 17 · 23 · 16 | **55 · 17 · 23 · 17** |

Las `UNKNOWN` quedarían en `PA-6`, `GR-2`, `WH-6`, `RC-8`, `RF-3`, `EX-42` a `EX-50`, `EX-52`,
`EX-53` y `EX-54`.

**Sin propuesta**: los casos 1, 2, 17 y 18 (de `17-`); 29, 36, 38 y 40 (de `18-`); 44 y 45 van
dentro del 📌 de `DEC-DATA-008` y no tocan `DEC-MP-002`, cuyo 📌 del 2026-09-28 ya dice que el
plazo se cambia sin bajar de ese mínimo. Y ninguno de los cinco casos vecinos del §3 de éste: si
el owner los decide antes de escribir el lote, el 3 cambia la frase señalada del punto 6.

## Key Learnings

1. Una lista de colisiones responde *«qué llega encima»*; el estado en que llega la fecha es otra
   pregunta, y se escribe aparte para no reabrir una regla general que estaba bien.
2. Aplicar una elección que dice *«borra la fila»* obliga a leer las FK de esa tabla: la de
   `trial.user_id` era `RESTRICT` a propósito, y el choque no se veía desde el capítulo de
   auditoría.
3. *«La carpeta de specs»* y *«las carpetas del programa»* difieren en 46 archivos de 37 specs
   ajenas: una frase corta de una decisión merece una medición antes de convertirse en patrón de
   un guard.

---
title: "Revisión del owner · lote J de casos vecinos, y el lote final del log y la matriz"
linear: HOS-1352
statusSource: linear
created: 2026-09-29
updated: 2026-09-29
status: CURRENT
fase: 9
---

# Revisión del owner · lote J de casos vecinos, y el lote final del log y la matriz

El lote J (tres casos, nuevos de [`21-`](./21-aplicacion-casos-lote-i.md) §3) de
[`16-casos-vecinos-decididos.md`](./16-casos-vecinos-decididos.md), los tres con la recomendada.
Es la última tanda de la ronda de casos vecinos. Medido y editado en el worktree
`hospeda-spec-hos-1352-billing-redesign` sobre el HEAD `7d74ea3fda`, sin commits. Leídos antes,
enteros, `16-` y `21-` (con su §3, que origina este lote); no pisé nada de `17-` a `21-`, y el §4
de éste **reemplaza al §4 de `21-`** como lote para el owner. Abreviaturas: `B/` es
`HOS-1354…/docs`, `V/` es `HOS-1353…/docs`, `D/12` el contrato, `nucleo/` el núcleo, `$V/` y `$B/`
la raíz de cada sub-spec.

**Forma**: tachado y fechado `(revisión del owner, casos vecinos, 2026-09-29, caso J-A)` a
`caso J-C`. En el texto nuevo no escribí la palabra ni em dashes. No hay números nuevos ni nombres
nuevos: ninguna transición, acción, motivo, guard ni entrada del contrato.

## 1. Qué se aplicó

### J-A · la implementación real del reloj la inyecta la raíz de composición de `apps/api`

En el §7.1 del contrato, en la quinta cosa del package y en el párrafo de las implementaciones, que
ya decía que la raíz de composición es el único lugar que junta las dos mitades; en `B/20` §5.1; y
en la fila de `B1`:

- `D/12:1512` «real no vive acá: la inyecta la raíz de composición de `apps/api` (abajo; caso J-A)»
- `D/12:1518` «La implementación real del reloj (la hora del sistema), que leen las dos mitades, la inyecta esa raíz»
- `D/12:1519` «en las pruebas se inyecta el reloj adelantable»
- `B/20:737` «la inyecta la raíz de composición de `apps/api`, el único lugar que junta las dos mitades»
- `$B/descomposicion.md:127` «cuya implementación real inyecta la raíz de composición de `apps/api`, y en las pruebas el adelantable»

`G14` no cambia: la raíz de composición ya importaba las dos mitades, y el reloj real no suma una
excepción a *«las implementaciones no viven en el package»*.

### J-B · las specs de fuera: se borran las canceladas, las sin issue, las de `.qtm/` y la `In Review`

Tachado en `V/21` §4 lo que `21-` había dejado como *«vuelve al owner»* y el juicio de `.qtm/` por
issue o por commits; escrita la regla completa; y su espejo en la fila de la limpieza:

- `V/21:554` «~~Una carpeta de `.qtm/` es del sistema retirado y se juzga igual»
- `V/21:558` «Lo que la regla no cubría lo decidió el owner»
- `V/21:559` «una spec en `In Review` se trata como implementada y se borra»
- `V/21:560` «una spec con el issue `Canceled` y una cuyo issue ya no existe en Linear se borran»
- `V/21:562` «y las carpetas de `.qtm/` se borran todas»
- `V/21:563` «Se reescriben sólo las de un issue en `In Progress` o en `Backlog`»
- `$V/descomposicion.md:484` «se borran la de un issue `Done`, `In Review` o `Canceled`, la de un issue que ya no existe y todas las de `.qtm/`»

Sobre la lista medida en `21-` §1 (50 archivos), la regla deja: **se borran 39 archivos** (22 de
`Done`, 1 de `In Review`, 9 de `Canceled`, 3 de issues que no existen y 4 de `.qtm/`) en **28
carpetas**, y **se reescriben 11** (6 de `In Progress` y 5 de `Backlog`) en 11 carpetas. Contado
con script sobre las filas de esa tabla (22 + 1 + 9 + 3 + 4 = 39; 6 + 5 = 11; 39 + 11 = 50). Es la
foto del 2026-09-29: la regla se aplica con el estado leído el día de la limpieza.

`SPEC-309` de `.qtm/`, que `21-` §3 dejaba para verificar contra los commits, ya no pide
verificación: se borra con el resto de `.qtm/`.

### J-C · los datos de facturación de una cuenta dada de baja se conservan tal cual

Declarado donde se describe la acción 24 y la seudonimización, con la razón del owner:

- `nucleo/08:203` «se conservan tal cual, y la seudonimización no los alcanza: son datos de comprobantes que la ley obliga a guardar»
- `nucleo/08:117` «tampoco los datos de facturación de la cuenta, que se conservan tal cual porque la ley obliga a guardar los comprobantes»
- `V/02:415` «La seudonimización no alcanza a los datos de facturación de la cuenta»
- `V/02:803` «y conservando tal cual los datos de facturación, que la ley obliga a guardar (caso J-C; §2.4)»
- `$V/descomposicion.md:482` «los datos de facturación de la cuenta, el nombre y el correo de su cliente de billing, se conservan tal cual»

**Y un ⚠️ en `nucleo/08` §3 y `V/02` §2.4, porque al aplicarlo apareció una contradicción** (§3,
punto 1): el modelo nuevo no tiene dónde guardar esos datos aparte de la fila de `user`, que la
misma acción reemplaza.

- `nucleo/08:203` «En el modelo nuevo esos datos no tienen fila propia»
- `V/02:418` «el `billing_customers` del sistema viejo no sobrevive al corte»

## 2. Conteos que cambiaron

| qué | antes | ahora | cómo se contó | espejos corregidos |
|---|---|---|---|---|
| grupos de la limpieza de `V1` que vuelven al owner | 3 (`In Review`, `Canceled`, sin issue) y el juicio de `.qtm/` | **0** | leída la regla de `V/21` §4 | `V/21`, `$V/descomposicion.md` |
| archivos de fuera del programa que se borran, sobre la foto de `21-` §1 | 22 decididos, 17 al owner | **39** (y 11 se reescriben) | suma con script de las filas de la tabla de `21-` §1 | sin espejo: la foto vive en `21-` |

**Lo que no se movió**: los 33 guards (18 · 15); las 23 acciones administrativas; las 34
transiciones vivas de la Suscripción; los 24 motivos; las siete entradas del contrato y las cinco
cosas del package (el reloj real no vive en él); los cinco hechos del reloj; los 15 plazos; las
once dependencias entre épicas; el catálogo de correos; los 17 pasos del corte; las tres entradas
de la lista de pendientes de `G8`; los 50 archivos de fuera del programa.

## 3. Casos vecinos (piden decisión, no los decidí)

### Lo que BLOQUEA (sin decidirlo, el diseño queda contradictorio)

1. **Dónde viven los datos de facturación que J-C conserva.** El modelo nuevo de billing no tiene
   una entidad de cliente: sus entidades (`B/02`) son la suscripción, los cobros, el comprobante y
   lo demás, y la suscripción apunta a `user`. El cliente de billing con nombre y correo es el
   `billing_customers` del sistema viejo (`@qazuor/qzpay-drizzle`,
   `packages/drizzle/src/schema/customers.schema.ts`, columnas `email` y `name`), que el corte no
   conserva (`B/21` §4, *«no se conserva nada»*). Así que hoy el nombre y el correo de quien paga
   sólo viven en la fila de `user`, y el diseño dice a la vez que la acción 24 los reemplaza (I-C) y
   que se conservan tal cual (J-C). Tres formas:
   - **(a)** el comprobante (`receipt`) guarda una copia del nombre y el correo de quien paga al
     emitirse, y la acción 24 sigue reemplazándolos en `user`. **Pros**: conserva lo que la razón
     del owner nombra, el comprobante, y deja I-C intacto. **Contras**: suma dos columnas a
     `receipt` en `B/02` y una copia que el §10.3 de ese capítulo mira con desconfianza, aunque acá
     la copia es el punto (es lo que el documento certificó ese día). **Impacto**: `B/02`, la
     unidad que emite el comprobante, y el 📌 de `DEC-DATA-005`.
   - **(b)** la acción 24 no reemplaza el nombre ni el correo de una cuenta que tuvo cobros.
     **Pros**: ninguna columna nueva. **Contras**: deshace la mitad de I-C para casi toda cuenta
     paga, y la cuenta dada de baja sigue siendo identificable. **Impacto**: `nucleo/08` §3, `V/02`
     §2.4 y el 📌 de `DEC-DATA-005`.
   - **(c)** se declara que viven en Mercado Pago (el pagador del preapproval). **Contras**: no
     cubre a los pagadores manuales (Partner, efectivo, transferencia), que no tienen pagador en el
     proveedor, y no es un dato nuestro.

   Recomiendo **(a)**. Nota lateral, no es otro caso: el comprobante es *«no fiscal»*
   (`DEC-LEGAL-001`), así que qué ley obliga a guardarlo y por cuánto tiempo es una pregunta para
   el pliego legal, no para el diseño.

### Lo MENOR (se puede resolver en la implementación)

1. **Los estados de Linear que la regla de J-B no nombra.** El equipo Hospeda tiene diez estados
   (leído con `list_issue_statuses` el 2026-09-29) y la regla nombra cinco: `Done`, `In Review` y
   `Canceled` se borran; `In Progress` y `Backlog` se reescriben. Quedan `Todo`, `Working on`,
   `User Action Pending`, `On Hold` y `Duplicate`. **Hoy ninguna de las 37 carpetas está en esos
   cinco** (`21-` §1), pero la regla se lee el día de la limpieza. Recomiendo seguir el tipo que
   Linear les da: `Duplicate` (tipo `duplicate`) como `Canceled`, se borra; `Todo` (`unstarted`) y
   los tres `started` como `In Progress`, se reescriben.
2. **Qué unidad escribe la inyección del reloj real en la raíz de composición** (J-A). `B1`
   construye la interfaz y el adelantable; la línea de la raíz que inyecta la hora del sistema la
   puede escribir `B1` o la primera unidad cuyo código de producción lea el reloj. No cambia
   ningún contrato ni guard.

## 4. Para el log y la matriz (pide OK del owner)

**Es el lote final, autocontenido**: reemplaza al §4 de `21-` (que reemplazaba al de `20-`, al de
`19-`, y consolidaba `17-` y `18-`) y suma J sin duplicar. Donde una decisión recibía propuestas de
más de una tanda, va un solo 📌 con el texto junto. **Cada ID grepeado el 2026-09-29 sobre
`7d74ea3fda`** en `01-decision-log.md` y en la matriz: existen los diecisiete `DEC` de abajo y
`WH-6`; **`EX-54` no existe** (la última `EX` es `EX-53`); **`casos vecinos` no aparece ni en el
log ni en la matriz**, así que ningún ID tiene todavía un 📌 de éstos. El log y la matriz no
cambiaron desde `a816654987`. Cada 📌 suma a su *Estado*: *«precisada el 2026-09-29, con OK del
owner (revisión del owner, casos vecinos, <casos>; ver su 📌)»* donde hoy dice `ACCEPTED` a secas,
o *«y precisada…»* donde ya había precisiones.

**Hoy en `ACCEPTED` a secas, y por eso suman a la cifra**: `DEC-MIG-006`, `DEC-DATA-006`,
`DEC-DATA-007`, `DEC-ARCH-012`, `DEC-ARCH-013`, `DEC-SUB-023`, `DEC-TEST-003` y `DEC-DATA-008`.
Las otras nueve (`DEC-DATA-005`, `DEC-ENT-002`, `DEC-TEST-001`, `DEC-ARCH-007`, `DEC-SUB-008`,
`DEC-ARCH-004`, `DEC-RF-008`, `DEC-AUTH-003` y `DEC-ARCH-006`) ya están contadas.

**Lo que suma J**: una frase en tres 📌 que ya estaban (`DEC-ARCH-006` por J-A, `DEC-ARCH-012` por
J-B y `DEC-DATA-005` por J-C), marcadas con ✚ J. Ninguna cifra se mueve.

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
4. **`DEC-ARCH-012`** (casos 8, 9, 19, 41, F-B, F-D, H-A, H-B, I-D y J-B) ✚ J: *«El tipo de
   partner se renombra a `business`, con la etiqueta "Comercio" en español sin cambios, y la
   migración de datos de V1 reescribe los que tienen el valor viejo. Hasta el cierre de HOS-1352
   `G8` lleva una lista de pendientes cerrada con tres entradas: la historia de migraciones, las
   migraciones de datos del seed y las carpetas del programa en `.specs/` (HOS-1352, HOS-1353 y
   HOS-1354, y ninguna otra). El paso 6 del corte saca las dos historias y en el mismo commit
   enciende la regla que hace fallar un build destinado a producción con una de ellas en la lista,
   así que el despliegue del paso 3 no falla por ella; el commit del cierre de HOS-1352 saca la
   tercera y extiende la regla a la lista entera. Las 11 migraciones de datos del seed que
   importaban el archivo de configuración de planes se congelan con sus valores adentro hasta que
   el paso 6 las saca. El script del corte arma el valor viejo sin escribir la palabra de corrido,
   como el propio `G8`, y no entra a la lista. El `CLAUDE.md` raíz y los archivos de i18n que la
   nombran entran en la limpieza de V1, y también las specs de otros issues y `.qtm/`, según el
   estado de su issue en Linear el día de la limpieza, con la regla del owner, "specs viejas e
   implementadas, las borramos directamente": se borra entera la carpeta de un issue `Done`,
   `In Review` (su código ya está mergeado; el smoke que falta vive en el issue) o `Canceled`, la de
   un issue que ya no existe y todas las de `.qtm/`; se reescribe sin la palabra sólo la de un
   issue en `In Progress` o `Backlog`. Y al cerrar HOS-1352 los informes históricos del programa
   salen del repositorio (quedan en el historial de git; lo que importe se resume en Linear), el
   diseño vigente se reescribe una vez, sin tachados ni la palabra, y este log y la matriz de
   validación se quedan y se reescriben sin la palabra, con el OK del owner a esa reescritura.»*
   **Razón**: reemplaza *«con un nombre a definir con el owner»*, y la decisión decía que el corpus
   se reescribe o se borra sin decir cuándo, ni qué pasa con el log ni con las specs ajenas al
   programa (medidas: 50 archivos, 46 de otras 37 specs y 4 de `.qtm/`). **Si el owner decide el
   menor 1 del §3 antes de escribir el lote**, esta frase suma los estados que hoy no nombra.
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
6. **`DEC-DATA-005`** (casos 7, F-C, H-C, I-C y J-C; F-C contra la recomendación; I-C corrige la
   elección de H-C) ✚ J: *«La lista de pasos de la baja de cuenta manual se escribe antes del
   corte, en este orden: la baja del cobro, `PB12` por cada ficha y la cuenta (`NUCLEO/08` §1.3).
   Los tres los hace soporte desde el panel, a pedido del dueño y con motivo: el primero con
   "cancelar una suscripción", que ya existía, el segundo con la acción 23, "borrar una ficha ajena
   a pedido de su dueño", que corre `PB12`, y el tercero con la 24, "dar de baja una cuenta a
   pedido de su dueño", que se rechaza mientras le cuelgue una suscripción viva o una ficha fuera
   de `PURGED`. La 24 no borra la fila de la cuenta: la seudonimiza. Reemplaza su nombre, su correo
   y su teléfono, cierra sus sesiones y la deja sin acceso; no toca el registro de auditoría, que
   conserva el actor y el sujeto por id, ni los cobros; y la fila de `trial` que la apunta sigue,
   con su FK `ON DELETE RESTRICT` y el hash del correo, así que la traba contra repetir la prueba
   no se pierde. Los datos de facturación de la cuenta, el nombre y el correo de su cliente de
   billing, se conservan tal cual: son datos de comprobantes que la ley obliga a guardar. La baja
   desde Mi Cuenta sigue fuera de la épica (HOS-1393).»* **Razón**: la decisión decía *«soporte a
   mano»* y no decía qué escribe la baja de la cuenta; la frase que proponía `20-` (*«la 24 borra
   la fila de la cuenta y sus sesiones»*) chocaba con la FK `ON DELETE RESTRICT` de
   `trial.user_id`, que el owner mantuvo (caso I-C). **Ojo**: la última frase no se puede escribir
   así mientras el bloqueante 1 del §3 siga abierto, porque en el modelo nuevo esos datos sólo
   viven en la fila que la misma acción reemplaza. **Si el owner lo decide antes de escribir el
   lote**, esta frase suma dónde viven (con la recomendada, *«copiados en el comprobante al
   emitirse»*).
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
10. **`DEC-SUB-023`** (casos 20 a 27, G-A, I-A e I-B): *«`S37` muta el monto siete días antes de
    la fecha de aplicación, un plazo técnico y no configurable. Los correos van al anunciar y 30 y
    7 días antes de la fecha de renovación de cada cliente. La migración sigue siendo la acción 17,
    aparte de publicar una versión de plan, y lo que aplica fila por fila (`S37` y `S38`) es una
    transición que aplica lo que la persona firmó al anunciar. Si la cohorte incluye la cuenta del
    propio `SUPER_ADMIN`, esa fila se excluye y el acto sigue. Cancelar no deshace una mutación ya
    hecha: a quien está dentro de sus siete días le sale un correo que lo explica. `PARA_RESOLVER`
    no tiene plazo, y el panel muestra su antigüedad. Una cortesía temporal vigente el día de la
    migración espera a volver. Y que pausados y en grace esperen es del día de `S37`: si `S37` ya
    mutó el monto, la fecha de aplicación la aplica `S38` igual en `GRACE_PERIOD`, y al volver por
    `S7` en `SUSPENDED`, vuelva a `ACTIVE` o a `CANCEL_SCHEDULED`. Un pagador con tarjeta
    suspendido vuelve como sucesora: el cambio de versión muere con la fila vieja, y su fila de
    alcance queda `APLICADA` sin que la predecesora haya cambiado de versión.»* **Razón**: la
    decisión dice *«pausados y en grace esperan a volver»* sin distinguir el día de la mutación del
    de la aplicación.
11. **`DEC-SUB-008`** (casos 37, G-A, I-A e I-B): *«El descenso programado lo aplica `S38`, la
    transición de la cola de `B/12` §2 que también aplica el cambio de versión de una migración:
    pasa la fila a la versión destino, aplica la elección de qué conservar y emite el aviso de
    cobertura. Si la fecha llega con la fila en `GRACE_PERIOD`, se aplica igual, porque el servicio
    sigue y el monto ya se mutó; en `SUSPENDED` espera y se aplica al volver por `S7`, también
    cuando `S7` la devuelve a `CANCEL_SCHEDULED` porque el cobro entró sobre un preapproval ya
    cancelado; en `PAUSED` espera a la reanudación, como ya estaba. Un pagador con tarjeta
    suspendido no vuelve por `S7` sino como sucesora, y el cambio muere con la fila vieja, como
    cuando llega un upgrade: la sucesora eligió su plan en el checkout y nace sin cola.»*
    **Razón**: la decisión dice *«baja los entitlements al fin del ciclo»* y ninguna transición lo
    hacía, ni decía qué pasa si el fin del ciclo encuentra a la fila en mora.
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
15. **`DEC-RF-008`** (casos F-C, H-D e I-C): *«Las acciones administrativas pasan de veintiuna a
    veintitrés vivas: entran la 23, borrar una ficha ajena a pedido de su dueño, que corre `PB12`
    y se evalúa sobre el sujeto como la 15, y la 24, dar de baja una cuenta a pedido de su dueño,
    que la seudonimiza y no la borra, y es capacidad del actor; las dos con permiso propio,
    auditoría, motivo y confirmación por destructivas, y las dos las construye `V8`, como la 15.
    La clase y la unidad las confirmó el owner.»* **Razón**: su último 📌 dice *«de dieciséis a
    veintiuna vivas»*.
16. **`DEC-AUTH-003`** (caso F-C): *«El "sin borrar" de la acción 15 vale para la edición de
    contenido: borrar una ficha ajena a pedido de su dueño es la acción 23, otra fila con su
    permiso.»* **Razón**: la decisión dice *«sin publicar, destacar ni borrar»*, y desde F-C
    soporte borra.
17. **`DEC-ARCH-006`** (casos G-B, I-E y J-A) ✚ J: *«El package del contrato tiene una quinta
    cosa: la interfaz del reloj con que el código de producción de las dos mitades lee la hora,
    inyectada. La construye `B1`, junto con el reloj adelantable que la implementa, que vive en el
    package de pruebas compartido. La implementación real, la hora del sistema, no vive en el
    package: la inyecta la raíz de composición de `apps/api`, el único lugar que junta las dos
    mitades, y en las pruebas se inyecta el adelantable. `G14` no cambia: importar el contrato
    nunca fue cruzar.»* **Razón**: su 📌 del 2026-09-28 enumera lo que el package tiene (*«las dos
    interfaces, sus validaciones, los simuladores de cada lado y los dos juegos de casos»*), y
    quedaría corto. Ya está precisada, así que no suma a la cifra.

### 4.2 El `## Resumen` del log

18. **Fila *«Apartamientos declarados del PDR»***: de 9 a **10**, *«2026-09-29: suma
    `DEC-DATA-008`, del §25, los 90 y 180 días de la retención que pasan a ser configurables (casos
    vecinos, caso 46)»*; y sale el *«serían 10 si el owner declara…»*.
19. **Fila *«Precisadas sin `SUPERSEDED`»***: de 58 a **66**, sumando `DEC-MIG-006`,
    `DEC-DATA-006`, `DEC-DATA-007`, `DEC-ARCH-012`, `DEC-ARCH-013`, `DEC-SUB-023`, `DEC-TEST-003` y
    `DEC-DATA-008`, recontado con `contar-precisadas.py`.
20. **Una fila *«Casos vecinos de la revisión del owner»***: *«0 nuevas, 17 📌, 0 `SUPERSEDED`,
    del 2026-09-29, sobre los 73 casos vecinos decididos (`30-revision-del-owner/16-`: los 50 de
    los lotes A a E, y los lotes F, G, H, I y J, de cuatro, cuatro, siete, cinco y tres); registros
    `17-` a `22-`.»*

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

Simulado de nuevo sobre copias del log y de la matriz de `7d74ea3fda` en el scratchpad de la
sesión (`aplic22/log-sim.md`, `aplic22/matriz-sim.md`, con `aplic22/sim.py`): las diecisiete líneas
de *Estado* marcadas, un 📌 por decisión, `EX-54` insertada después de `EX-53` y el 📌 de `WH-6`.
Contadas con `contar-precisadas.py` y `contar-filas-de-la-matriz.py`, y las decisiones y los
`SUPERSEDED` con un script sobre los encabezados `### DEC-` y su *Estado*:

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
`EX-53` y `EX-54`. El lote J no mueve ninguna cifra: sus tres casos caen en 📌 que ya estaban
(`DEC-ARCH-006`, `DEC-ARCH-012` y `DEC-DATA-005`).

**Sin propuesta**: los casos 1, 2, 17 y 18 (de `17-`); 29, 36, 38 y 40 (de `18-`); 44 y 45 van
dentro del 📌 de `DEC-DATA-008` y no tocan `DEC-MP-002`, cuyo 📌 del 2026-09-28 ya dice que el
plazo se cambia sin bajar de ese mínimo. `DEC-TRIAL-004` tampoco: I-C deja su traba como estaba.
`DEC-LEGAL-001` tampoco por J-C: la razón del owner no cambia que el comprobante sea no fiscal.

## Key Learnings

1. Una decisión del owner puede nombrar una entidad que el diseño nuevo ya no tiene: *«el cliente
   de billing»* es `billing_customers` del sistema viejo, que el corte no conserva, y el modelo
   nuevo no tiene cliente. Antes de declarar que algo *«se conserva»*, hay que buscar dónde vive en
   el modelo nuevo, no en el código de hoy.
2. Una regla que se lee sobre un estado externo el día de su aplicación (Linear) tiene que cubrir
   todos los estados posibles, no sólo los que la foto de hoy muestra: el equipo tiene diez y la
   regla nombra cinco.
3. Cerrar un *«vuelve al owner»* deja sin objeto una verificación que venía colgada (la de
   `SPEC-309` por commits): al aplicar, hay que barrer lo que dependía de la rama cerrada.

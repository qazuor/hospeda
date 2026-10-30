---
title: "Revisión del owner · lote I de casos vecinos, y el lote final del log y la matriz"
linear: HOS-1352
statusSource: linear
created: 2026-09-29
updated: 2026-09-29
status: CURRENT
fase: 9
---

# Revisión del owner · lote I de casos vecinos, y el lote final del log y la matriz

El lote I (cinco casos, nuevos de [`20-`](./20-aplicacion-casos-lotes-g-y-h.md) §3) de
[`16-casos-vecinos-decididos.md`](./16-casos-vecinos-decididos.md), todos con la recomendada; el D
con el agregado del owner, y el C **corrige la elección de H-C**. Medido y editado en el worktree
`hospeda-spec-hos-1352-billing-redesign` sobre el HEAD `f6f074963d`, sin commits. Leídos antes,
enteros, `16-` y `20-` (con su §3, que origina este lote); no pisé nada de `17-` a `20-`, y el §4
de éste **reemplaza al §4 de `20-`** como lote para el owner. Abreviaturas: `B/` es
`HOS-1354…/docs`, `V/` es `HOS-1353…/docs`, `D/12` el contrato, `nucleo/` el núcleo, `$V/` y `$B/`
la raíz de cada sub-spec.

**Forma**: tachado y fechado `(revisión del owner, casos vecinos, 2026-09-29, caso I-A)` a
`caso I-E`. En el texto nuevo no escribí la palabra (las mediciones la buscaron con el patrón
armado en partes) ni em dashes. No hay números nuevos: ninguna transición, acción, motivo ni guard.
**Sí hay un nombre nuevo**: la acción 24 pasa a llamarse *«dar de baja una cuenta a pedido de su
dueño»* (I-C), con sus dieciocho espejos.

## 1. Qué se aplicó

### I-A · `S38` se aplica también en el `CANCEL_SCHEDULED` en que la dejó `S7`

El `desde` de `S38` suma ese estado, acotado a la fila que dejó ahí `S7` (una `CANCEL_SCHEDULED`
por `S11` no tiene cola: la baja la absorbió, colisión 3); el evento es el mismo, la vuelta por
`S7`; y el ⚠️ de los dos bordes queda tachado, con los dos decididos:

- `B/03:188` «y `CANCEL_SCHEDULED` cuando la dejó ahí `S7`»
- `B/03:188` «el evento es el mismo»
- `B/03:188` «se aplica igual: el período que se sostiene hasta `S12` se pagó con el monto ya mutado»
- `B/03:188` «Decididos los dos bordes»
- `S7`: `B/03:157` «vuelva a `ACTIVE` o a `CANCEL_SCHEDULED`»
- `B/12:231` «se aplica igual»
- `B/10:198` «también si `S7` la devuelve a»
- Lo que `B/10` no cierra: `B/10:253` «vuelva a `ACTIVE` o a `CANCEL_SCHEDULED` (caso I-A)»

### I-B · el pagador con tarjeta que vuelve como sucesora: el cambio muere con la fila vieja

Como la colisión 2 (un upgrade): la sucesora eligió su plan en el checkout y nace sin cola. En una
migración, su fila de alcance queda `APLICADA` sin que la predecesora haya cambiado de versión, y
lo dejé dicho en `B/10` §3.7 para que nadie lo lea como un error:

- `B/03:188` «y el cambio muere con la fila vieja, como en la colisión 2»
- `B/12:234` «cambio muere con la fila vieja, como en la colisión 2»
- `B/10:201` «su fila de alcance queda `APLICADA`, porque `S37`»

**Las cuatro colisiones del `B/12` §2.2 no cambian**: I-A e I-B van en el párrafo aparte de G-A
(*«el estado en que la fecha encuentra a la fila»*), y la regla general de dos cláusulas tampoco
se mueve (*«una fila que no vuelve no lo aplica nunca»* ya cubría a la predecesora).

### I-C · la acción 24 seudonimiza la cuenta, no la borra (corrige H-C)

Tachado lo que H-C escribió (*«borra la fila de la cuenta y sus sesiones»*) en sus cuatro lugares
(`nucleo/08` §1.3 y §3, `V/02` §2.4 y §4.1, `$V/descomposicion.md` §2.11) y alineado con `V/02`
§2.4: la fila de `user` no se borra, se seudonimiza (nombre, correo y teléfono reemplazados,
sesiones cerradas, sin acceso); no toca el registro de auditoría ni los cobros; y la fila de
`trial` sigue apuntándola, con su FK `ON DELETE RESTRICT`, así que la traba contra repetir la
prueba sigue. Los dos ⚠️ del choque quedaron tachados.

- `nucleo/08:203` «la fila de la cuenta no se borra, se seudonimiza»
- `nucleo/08:203` «así que la traba contra repetir la prueba no se pierde»
- `nucleo/08:117` «Qué escribe dar de baja la cuenta está en su fila del §3»
- `V/02:411` «no borra la fila de `user`: la seudonimiza»
- `V/02:796` «seudonimizando la fila de `user` sin borrarla»
- `$V/descomposicion.md:482` «y dar de baja una cuenta no borra su fila»

**El nombre**: *«borrar una cuenta»* dejaba de ser cierto, así que la renombré a *«dar de baja una
cuenta a pedido de su dueño»*, que es como el §1.3 ya llamaba al proceso entero (*«la baja de
cuenta manual»*). Grepeados los espejos del nombre con `rg -i "borrar (una|la) cuenta"` sobre el
diseño vigente, sin informes históricos: **dieciocho, en siete archivos**, todos tachados:

- `nucleo/08:116` «dar de baja una cuenta a pedido de su dueño»
- La fila: `nucleo/08:203` «dar de baja una cuenta a pedido de su dueño»
- El conteo de la tabla: `nucleo/08:207` «dar de baja una cuenta (caso I-C), las dos»
- `$V/spec.md:213` «dar de baja una cuenta (caso I-C) a pedido»
- `$V/descomposicion.md:61` «dar de baja una cuenta (caso I-C), las dos»
- `$V/descomposicion.md:482` ««dar de baja una cuenta a pedido de su dueño» (caso I-C)»
- `$V/descomposicion.md:482` «dar de baja una cuenta con una suscripción viva»
- `V/17:352` «dar de baja una cuenta (caso I-C), las dos»
- `V/17:372` «dar de baja una cuenta (caso I-C), con los casos»
- `V/17:472` «borran o dan de baja (caso I-C)»
- `V/17:543` «dar de baja una cuenta (caso I-C) a pedido»
- `V/03:804` «dar de baja la cuenta (caso I-C)»
- `B/19:206` «dar de baja una cuenta (caso I-C) a pedido»
- `B/03:881`, `:2068`, `:2094`, `:2163` y `:2470`: los cinco conteos de la tabla de acciones,
  con la misma frase; por ejemplo `B/03:2470` «dar de baja una cuenta (caso I-C) a pedido»

**Lo que no renombré, y por qué**: *«el borrado de la cuenta pedido por el propio usuario»*
(`nucleo/08` §1.3, `V/02` §4, `V/03`, `V/22`, `D/12`, `B/16`) es la baja desde Mi Cuenta de
HOS-1393, otro proceso, sin diseñar; *«el dueño no puede borrar su cuenta en esta versión»* habla
de ese mismo proceso; y la pregunta 5 del pliego legal es un documento para el abogado, que el
caso no toca. El log y la matriz no se editan: el nombre nuevo entra por los 📌 del §4.

### I-D · la tercera entrada de `G8` es sólo el programa; el resto entra en la limpieza de `V1`

- `V/20:56` «La tercera entrada son sólo esas tres carpetas»
- `V/21:544` «Y entran en esta limpieza las specs de fuera del programa»
- `V/21:548` «50 archivos versionados, 46 de otras 37 specs»
- `V/21:549` «Se borra la carpeta entera»
- `V/21:551` «Cómo se distingue»
- `V/21:558` «vuelve al owner»
- La fila de la limpieza: `$V/descomposicion.md:484` «y las specs de fuera del programa y `.qtm/` que lo nombran»
- `$V/descomposicion.md:484` «ningún archivo de otra spec ni de `.qtm/` la nombra»
- El criterio de `V1`: `$V/descomposicion.md:560` «y sólo en ellas: una spec de otro issue»
- `$V/spec.md:403` «sólo esas: las specs de otros issues»

`nucleo/04` §3, invariante 32, ya decía *«y ninguna otra cosa»*: no cambia. **Cómo se distingue**,
escrito en `V/21` §4: por el estado del issue que la carpeta nombra en su `linear:`, **leído el día
que `V1` hace la limpieza**, no el de hoy. `Done` se borra; `In Progress` y `Backlog` se
reescriben. Lo que la regla del owner no cubre vuelve a él (§3, punto 2).

**La lista, medida el 2026-09-29** sobre `f6f074963d` (`git ls-files .specs .qtm` sin las tres
carpetas del programa, filtrado con `rg -il` y el patrón armado en partes: 50 archivos; y el
programa, 28), con el estado leído en Linear ese día (`list_issues` por estado y `get_issue`; sin
ejecutar nada en el repo). Por carpeta, los archivos entre paréntesis:

| estado en Linear | qué le toca | cuáles (archivos) | carpetas | archivos |
|---|---|---|---|---|
| `Done` | **se borra entera** | `HOS-43-occupancy-calendar` (1), `HOS-139-poi-categories-model` (1), `HOS-142-poi-catalog-import` (1), `HOS-172-partners-not-visible` (1), `HOS-277-alliance-leads` (1), `HOS-296-multi-role-capabilities` (3), `HOS-373-editor-unsaved-changes-and-focus` (1), `HOS-373-unsaved-changes-guard-and-invalid-field-focus` (1), `HOS-376-proveedores-uso-y-valoraciones` (2), `HOS-377-partner-mentions-log` (2), `HOS-385-textfield-wrapper` (1), `HOS-393-editor-faq-ia-data` (1), `HOS-974-funcionalidades-de-comercio` (3), `HOS-1156-publicar-una-pagina-por-vertical` (3) | 14 | 22 |
| `In Progress` | se reescribe | `HOS-27-e2e-nightly-suite-repair` (1), `HOS-369-web-performance-edge-cache` (1), `HOS-374-editor-web-authoring` (1), `HOS-374-editor-web-posts-events` (1), `HOS-583-host-editable-translations` (1), `HOS-1063-estadisticas-del-aliado` (1) | 6 | 6 |
| `Backlog` | se reescribe | `HOS-11-feature-flags-audit-and-toggles` (1), `HOS-15-visual-email-template-editor` (1), `HOS-55-multi-unit-accommodation-capacity` (1), `HOS-107-sponsors-consolidation` (1), `HOS-120-admin-editable-role-permissions` (1) | 5 | 5 |
| `In Review` | **vuelve al owner** | `HOS-1077-permisos-por-vertical` (1) | 1 | 1 |
| `Canceled` | **vuelve al owner** | `HOS-20-iva-tax-handling` (1), `HOS-36-direct-booking-model` (1), `HOS-56-cross-user-data-transfer` (1), `HOS-278-alliance-approval-provisioning` (1), `HOS-589-comercio-como-alojamiento` (1), `HOS-1060-galerias-privadas` (1), `HOS-1062-precio-por-aliado-y-cobro-externo` (1), `HOS-1074-claves-editar-publicar` (1), `HOS-1183-publish-button-reads-the-verdict` (1) | 9 | 9 |
| el issue no existe en Linear | **vuelve al owner** | `HOS-131-account-menu-ia` (2), `HOS-134-expand-mi-cuenta-discovery-doors` (1) | 2 | 3 |
| `.qtm/` | se juzga por su issue o sus commits | `.qtm/specs/SPEC-028-iva-tax-handling` (2; migró a `HOS-20`, `Canceled`), `.qtm/tasks/SPEC-309-featured-listing-addon-source-and-hardening` (2; sin issue `HOS-` medido) | 2 | 4 |
| **total** | | | **39** (37 de `.specs/` y 2 de `.qtm/`) | **50** |

Contado con script sobre la lista (22 · 6 · 5 · 1 · 9 · 3 · 4 = 50). `get_issue` de `HOS-131` y
`HOS-134` contestó *«Could not find referenced Issue»*, y una búsqueda por título con archivados no
los encontró.

### I-E · la interfaz del reloj la construye `B1`

- `D/12:1510` «La construye `B1`»
- `B/20:735` «La construye `B1`, con el adelantable»
- `$B/descomposicion.md:127` «que construye esta unidad (casos vecinos, casos G-B e I-E)»

## 2. Conteos que cambiaron

| qué | antes | ahora | cómo se contó | espejos corregidos |
|---|---|---|---|---|
| estados del `desde` de `S38` | 2 | **3** (`ACTIVE`, `GRACE_PERIOD`, y `CANCEL_SCHEDULED` por `S7`) | leída la fila | `B/03` (`S38`, `S7`), `B/12`, `B/10` |
| espejos del nombre de la acción 24 | 18 con *«borrar una/la cuenta»* | **0 vivos** | `rg -n -i "borrar (una\|la) cuenta"` sobre el diseño vigente, sacando lo tachado con un script: quedan sólo los del proceso de HOS-1393 y el pliego | los dieciocho del §1 |
| archivos que `G8` marcaría fuera del programa | sin nombrar en `V1` | **50**, en `V/21` §4 | `git ls-files` + `rg -il`, el patrón armado en partes | `V/21`, `V/20`, `$V/descomposicion.md` (dos filas), `$V/spec.md` |
| transiciones vivas de la Suscripción | 34 | **34** | script sobre las filas `S<n>` de `B/03` §3.2 sin tachar | sin cambio |

**Lo que no se movió**: los 33 guards (18 · 15); las 23 acciones administrativas (I-C renombra la
24, no suma ni saca); los 24 motivos; las siete entradas del contrato (la interfaz del reloj sigue
siendo la quinta cosa del package, no una entrada de §4.1); los cinco hechos del reloj; los 15
plazos; las once dependencias entre épicas; el catálogo de correos; los 17 pasos del corte; las
cuatro colisiones del `B/12` §2.2; las dos listas del falso, 13 y 11; las tres entradas de la lista
de pendientes de `G8`.

## 3. Casos vecinos (piden decisión, no los decidí)

1. **Dónde vive la implementación de producción del reloj** (I-E). `D/12` §7.1 dice que las
   implementaciones no viven en el package del contrato, y la del reloj (la hora del sistema) la
   usan las dos mitades, que no pueden importarse (`G14`). Dos formas: **(a)** la inyecta la raíz de
   composición de `apps/api`, el único lugar que ya junta las dos mitades; **(b)** se declara la
   excepción y vive junto a la interfaz, en el package. Recomiendo **(a)**: no abre una excepción
   a una regla que hoy no tiene ninguna, y es donde ya se inyectan las otras implementaciones.
2. **Lo que la regla del owner no cubre en la limpieza de `V1`** (I-D). *«Specs viejas e
   implementadas, las borramos»* y *«la que sigue en curso se reescribe»* dejan afuera tres grupos,
   que escribí en `V/21` §4 como *«vuelve al owner»*: **`In Review`** (`HOS-1077`, implementada y
   con el smoke pendiente), **`Canceled`** (nueve carpetas, nueve archivos, más `SPEC-028` de
   `.qtm/`, que migró a `HOS-20`, cancelado) y **issues que ya no existen** (`HOS-131`, `HOS-134`,
   tres archivos; el `spec.md` de `HOS-134` dice `status: in-progress`, pero `HOS-277` describe su
   trabajo como hecho). Recomiendo **borrar las canceladas y las que no existen** (nadie las va a
   implementar y quedan en el historial de git) y **tratar `In Review` como implementada**: su
   código ya está mergeado, y lo que falta es el smoke, que vive en el issue y no en la carpeta.
   Y `SPEC-309` de `.qtm/` no tiene issue `HOS-` medido: el `CLAUDE.md` raíz la describe como
   entregada (la sección del destaque por entitlement), y verificarlo contra los commits es parte
   de la limpieza, no de este registro.
3. **Qué pasa con lo personal fuera de la fila de `user`** (I-C). La seudonimización de la acción
   24 alcanza a la fila de `user`; *«no toca los cobros»* deja el correo del pagador en un cobro. No
   está dicho qué pasa con el cliente de billing de esa cuenta (su nombre y su correo), que no es un
   cobro. Recomiendo **dejarlo como está y declararlo**: es el registro de quién pagó, con el mismo
   valor probatorio que el cobro, y `DEC-DATA-005` ya no toca lo personal en la retención.

## 4. Para el log y la matriz (pide OK del owner)

**Es el lote final, autocontenido**: reemplaza al §4 de `20-` (que reemplazaba al de `19-`, que
consolidaba `17-` y `18-`), suma I sin duplicar y **corrige el 📌 de `DEC-DATA-005` que `20-` dejó
señalado** (su **Ojo**). Donde una decisión recibía propuestas de más de una tanda, va un solo 📌
con el texto junto. **Cada ID grepeado el 2026-09-29 sobre `f6f074963d`** en `01-decision-log.md`
y en la matriz: existen los diecisiete `DEC` de abajo y `WH-6`; **`EX-54` no existe** (la última
`EX` es `EX-53`); **`casos vecinos` no aparece ni en el log ni en la matriz**, así que ningún ID
tiene todavía un 📌 de éstos. El log y la matriz no cambiaron desde `a816654987`. Cada 📌 suma a su
*Estado*: *«precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, <casos>;
ver su 📌)»* donde hoy dice `ACCEPTED` a secas, o *«y precisada…»* donde ya había precisiones.

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
4. **`DEC-ARCH-012`** (casos 8, 9, 19, 41, F-B, F-D, H-A, H-B e I-D): *«El tipo de partner se
   renombra a `business`, con la etiqueta "Comercio" en español sin cambios, y la migración de
   datos de V1 reescribe los que tienen el valor viejo. Hasta el cierre de HOS-1352 `G8` lleva una
   lista de pendientes cerrada con tres entradas: la historia de migraciones, las migraciones de
   datos del seed y las carpetas del programa en `.specs/` (HOS-1352, HOS-1353 y HOS-1354, y
   ninguna otra). El paso 6 del corte saca las dos historias y en el mismo commit enciende la regla
   que hace fallar un build destinado a producción con una de ellas en la lista, así que el
   despliegue del paso 3 no falla por ella; el commit del cierre de HOS-1352 saca la tercera y
   extiende la regla a la lista entera. Las 11 migraciones de datos del seed que importaban el
   archivo de configuración de planes se congelan con sus valores adentro hasta que el paso 6 las
   saca. El script del corte arma el valor viejo sin escribir la palabra de corrido, como el propio
   `G8`, y no entra a la lista. El `CLAUDE.md` raíz y los archivos de i18n que la nombran entran en
   la limpieza de V1, y también las specs de otros issues y `.qtm/`: con la regla del owner, "specs
   viejas e implementadas, las borramos directamente", la de un issue terminado se borra entera y
   la que sigue en curso se reescribe sin la palabra, según el estado de su issue en Linear el día
   de la limpieza. Y al cerrar HOS-1352 los informes históricos del programa salen del repositorio
   (quedan en el historial de git; lo que importe se resume en Linear), el diseño vigente se
   reescribe una vez, sin tachados ni la palabra, y este log y la matriz de validación se quedan y
   se reescriben sin la palabra, con el OK del owner a esa reescritura.»* **Razón**: reemplaza
   *«con un nombre a definir con el owner»*, y la decisión decía que el corpus se reescribe o se
   borra sin decir cuándo, ni qué pasa con el log ni con las specs ajenas al programa (medidas: 50
   archivos, 46 de otras 37 specs y 4 de `.qtm/`). **Si el owner decide el §3 punto 2 antes de
   escribir el lote**, esta frase suma qué pasa con las canceladas, las `In Review` y las que ya no
   existen.
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
6. **`DEC-DATA-005`** (casos 7, F-C, H-C e I-C; F-C contra la recomendación; I-C corrige la
   elección de H-C) ✎ **corregido respecto de `20-`**: *«La lista de pasos de la baja de cuenta
   manual se escribe antes del corte, en este orden: la baja del cobro, `PB12` por cada ficha y la
   cuenta (`NUCLEO/08` §1.3). Los tres los hace soporte desde el panel, a pedido del dueño y con
   motivo: el primero con "cancelar una suscripción", que ya existía, el segundo con la acción 23,
   "borrar una ficha ajena a pedido de su dueño", que corre `PB12`, y el tercero con la 24, "dar de
   baja una cuenta a pedido de su dueño", que se rechaza mientras le cuelgue una suscripción viva o
   una ficha fuera de `PURGED`. La 24 no borra la fila de la cuenta: la seudonimiza. Reemplaza su
   nombre, su correo y su teléfono, cierra sus sesiones y la deja sin acceso; no toca el registro de
   auditoría, que conserva el actor y el sujeto por id, ni los cobros; y la fila de `trial` que la
   apunta sigue, con su FK `ON DELETE RESTRICT` y el hash del correo, así que la traba contra
   repetir la prueba no se pierde. La baja desde Mi Cuenta sigue fuera de la épica (HOS-1393).»*
   **Razón**: la decisión decía *«soporte a mano»* y no decía qué escribe la baja de la cuenta; y
   la frase que proponía `20-` (*«la 24 borra la fila de la cuenta y sus sesiones»*) chocaba con la
   FK `ON DELETE RESTRICT` de `trial.user_id`, que el owner mantuvo (caso I-C).
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
17. **`DEC-ARCH-006`** (casos G-B e I-E) ✚: *«El package del contrato tiene una quinta cosa: la
    interfaz del reloj con que el código de producción de las dos mitades lee la hora, inyectada.
    La construye `B1`, junto con el reloj adelantable que la implementa, que vive en el package de
    pruebas compartido. `G14` no cambia: importar el contrato nunca fue cruzar.»* **Razón**: su 📌
    del 2026-09-28 enumera lo que el package tiene (*«las dos interfaces, sus validaciones, los
    simuladores de cada lado y los dos juegos de casos»*), y quedaría corto. Ya está precisada, así
    que no suma a la cifra. **Si el owner decide el §3 punto 1 antes de escribir el lote**, esta
    frase suma dónde vive la implementación de producción.

### 4.2 El `## Resumen` del log

18. **Fila *«Apartamientos declarados del PDR»***: de 9 a **10**, *«2026-09-29: suma
    `DEC-DATA-008`, del §25, los 90 y 180 días de la retención que pasan a ser configurables (casos
    vecinos, caso 46)»*; y sale el *«serían 10 si el owner declara…»*.
19. **Fila *«Precisadas sin `SUPERSEDED`»***: de 58 a **66**, sumando `DEC-MIG-006`,
    `DEC-DATA-006`, `DEC-DATA-007`, `DEC-ARCH-012`, `DEC-ARCH-013`, `DEC-SUB-023`, `DEC-TEST-003` y
    `DEC-DATA-008`, recontado con `contar-precisadas.py`.
20. **Una fila *«Casos vecinos de la revisión del owner»***: *«0 nuevas, 17 📌, 0 `SUPERSEDED`,
    del 2026-09-29, sobre los 70 casos vecinos decididos (`30-revision-del-owner/16-`: los 50 de
    los lotes A a E, y los lotes F, G, H e I, de cuatro, cuatro, siete y cinco); registros `17-`,
    `18-`, `19-`, `20-` y `21-`.»*

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

Simulado sobre copias del log y de la matriz en el scratchpad de la sesión (`aplic21/log-sim.md`,
`aplic21/matriz-sim.md`), con las diecisiete líneas de *Estado* marcadas y `EX-54` insertada
después de `EX-53`; contadas con `contar-precisadas.py` y `contar-filas-de-la-matriz.py`:

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
`EX-53` y `EX-54`. El lote I no mueve ninguna cifra: sus cinco casos caen en 📌 que ya estaban
(`DEC-SUB-023`, `DEC-SUB-008`, `DEC-DATA-005`, `DEC-RF-008`, `DEC-ARCH-012` y `DEC-ARCH-006`).

**Sin propuesta**: los casos 1, 2, 17 y 18 (de `17-`); 29, 36, 38 y 40 (de `18-`); 44 y 45 van
dentro del 📌 de `DEC-DATA-008` y no tocan `DEC-MP-002`, cuyo 📌 del 2026-09-28 ya dice que el
plazo se cambia sin bajar de ese mínimo. `DEC-TRIAL-004` tampoco: I-C deja su traba como estaba.

## Key Learnings

1. Una elección del owner que corrige otra obliga a tachar la anterior en todos sus lugares y
   también en la propuesta para el log, que todavía no está escrita: el 📌 de `20-` iba a llevar
   la frase equivocada al log.
2. Cuando una acción deja de hacer lo que su nombre dice, renombrarla cuesta dieciocho espejos en
   siete archivos; el grep tiene que separar el nombre de la acción del proceso homónimo de otro
   issue (el borrado desde Mi Cuenta de HOS-1393), que no cambia.
3. El estado de una spec ajena vive en Linear y cambia: la regla de la limpieza tiene que decir
   *cuándo* se lee (el día de la limpieza), no copiar la foto de hoy. Y dos issues nombrados en
   `linear:` ya no existen, así que *«leer el estado»* puede no tener respuesta.

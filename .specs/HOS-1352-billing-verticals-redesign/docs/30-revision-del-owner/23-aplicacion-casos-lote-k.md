---
title: "Revisión del owner · lote K de casos vecinos, y el lote final del log y la matriz"
linear: HOS-1352
statusSource: linear
created: 2026-09-29
updated: 2026-09-29
status: CURRENT
fase: 9
---

# Revisión del owner · lote K de casos vecinos, y el lote final del log y la matriz

El lote K (tres casos, nuevos de [`22-`](./22-aplicacion-casos-lote-j.md) §3) de
[`16-casos-vecinos-decididos.md`](./16-casos-vecinos-decididos.md), los tres con la recomendada.
Es la última tanda de la ronda de casos vecinos. Medido y editado en el worktree
`hospeda-spec-hos-1352-billing-redesign` sobre el HEAD `abafb960f0`, sin commits. Leídos antes,
enteros, `16-` y `22-` (con su §3, que origina este lote); no pisé nada de `17-` a `22-`, y el §4
de éste **reemplaza al §4 de `22-`** como lote para el owner. Abreviaturas: `B/` es
`HOS-1354…/docs`, `V/` es `HOS-1353…/docs`, `D/12` el contrato, `nucleo/` el núcleo, `$V/` y `$B/`
la raíz de cada sub-spec.

**Forma**: tachado y fechado `(revisión del owner, casos vecinos, 2026-09-29, caso K-A)` a
`caso K-C`. En el texto nuevo no escribí la palabra ni em dashes. No hay números nuevos: ninguna
transición, acción, motivo, guard ni entrada del contrato. Sí hay dos nombres nuevos, las dos
columnas de `receipt` (`nombre_pagador` y `correo_pagador`).

## 1. Qué se aplicó

### K-A · el comprobante guarda una copia del nombre y el correo de quien paga

**El modelo** (`B/02` §2.3): la fila de `receipt` suma las dos columnas, con su restricción (van
juntas; nulas sólo sobre una lápida; nadie las reescribe después de emitir):

- `B/02:372` «y una copia del nombre y el correo de quien paga, `nombre_pagador` y `correo_pagador`, escrita al emitirse»
- `B/02:372` «Las dos columnas del pagador van juntas, las dos nulas o las dos escritas, y son nulas sólo en el comprobante de un cobro sobre una lápida»
- `B/02:372` «ninguna transición ni acción las reescribe después de emitir»

**De dónde se copian al emitir**, en un párrafo nuevo del mismo §, con la razón de que no sea la
copia a mano que el §10.3 prohíbe:

- `B/02:387` «El comprobante guarda una copia del nombre y el correo de quien paga, y la copia es el punto»
- `B/02:389` «de la fila de `user` dueña del cobro que se certifica, leída en la misma transacción que escribe el `receipt`»
- `B/02:390` «En un cobro de suscripción, y en la cuota de un pagador manual, es el `user` de la suscripción»
- `B/02:391` «en el pago del addon de única vez, que no tiene suscripción, es el dueño de la `addon_instance`»
- `B/02:392` «Sobre una lápida no hay `user` del que copiar, así que las dos columnas quedan nulas»
- `B/02:395` «ésta es lo que el documento certificó el día que se emitió, nadie la lee para decidir nada y no se actualiza nunca»
- `B/02:399` «Es lo que conserva los datos de facturación de una cuenta dada de baja»

Y en la retención (`B/02` §4.1), que ya conservaba los comprobantes íntegros:

- `B/02:1230` «Los comprobantes se conservan con el nombre y el correo de quien pagó»

**Quién los copia**: los tres emisores del comprobante, en su celda de efectos (`MP4` hereda de
`MP1`, *«Y emite el comprobante, igual que `MP1`»*), y la unidad `B5`, que construye el registro
del dinero y el comprobante:

- `B/03:1758` «con la copia del nombre y el correo de quien paga, leídos de la fila de `user` dueña del cobro en esta misma transacción»
- `B/03:1758` «y sin nombre ni correo del pagador, porque no hay `user` del que copiarlos»
- `B/03:1862` «con la copia del nombre y el correo del `user` de la suscripción, leídos en esta misma transacción»
- `$B/descomposicion.md:131` «y cada comprobante guarda la copia del nombre y el correo de quien paga, leídos de su `user` al emitirse y nunca reescritos»
- `$B/descomposicion.md:779` «un comprobante emitido lleva el nombre y el correo que la cuenta tenía ese día, y reemplazar después los de la fila de `user` no los cambia»

**Los ⚠️ de `22-`, retirados** (tachados) en `nucleo/08` §3 y `V/02` §2.4, y J-C alineado: *«los
datos de facturación se conservan»* quiere decir que viven en el comprobante. *«de su cliente de
billing»*, que nombraba una entidad que el modelo nuevo no tiene, quedó tachado por *«de quien
pagó»*:

- `nucleo/08:203` «~~⚠️ En el modelo nuevo esos datos no tienen fila propia»
- `nucleo/08:203` «Viven en el comprobante: cada `receipt` guarda una copia del nombre y el correo de quien paga»
- `nucleo/08:117` «y viven en ellos: cada comprobante copia el nombre y el correo de quien paga al emitirse»
- `V/02:417` «~~⚠️ En este modelo no tienen fila propia»
- `V/02:421` «Viven en el comprobante: cada `receipt` guarda una copia del nombre y el correo de quien paga»
- `V/02:806` «en la copia que guarda cada comprobante (caso K-A)»
- `$V/descomposicion.md:482` «viven en la copia que cada comprobante guarda al emitirse, que la baja no toca»

**Cómo quedó el recuento de campos**: el diseño no lleva un conteo de columnas de `receipt` ni de
campos del modelo de billing (grepeado *«columnas»*, *«campos»* y *«entidades»* en `B/02`: el único
conteo de entidades es el de *«las otras cinco»* del catálogo comercial, que no cambia). `receipt`
pasa de guardar cuatro cosas (las dos referencias al cobro, número y PDF) a seis. **Ninguna entidad
nueva**: el modelo sigue sin cliente.

### K-B · la limpieza sigue el tipo de estado de Linear

Releídos los estados del equipo Hospeda con `list_issue_statuses` el 2026-09-29: diez, con su tipo.
`In Review` es de tipo `started`, así que la regla por tipo lleva una excepción, que es la
decisión de J-B:

| estado | tipo en Linear | qué le pasa a la carpeta | de dónde sale |
|---|---|---|---|
| `Done` | `completed` | se borra | regla del owner (caso I-D) |
| `Canceled` | `canceled` | se borra | caso J-B |
| `Duplicate` | `duplicate` | se borra | caso K-B |
| `In Review` | `started` | se borra | caso J-B (la excepción) |
| `In Progress` | `started` | se reescribe | regla del owner (caso I-D) |
| `Working on`, `User Action Pending`, `On Hold` | `started` | se reescribe | caso K-B |
| `Todo` | `unstarted` | se reescribe | caso K-B |
| `Backlog` | `backlog` | se reescribe | regla del owner (caso I-D) |

- `V/21:565` «Y un estado que esa lista no nombra sigue el tipo que Linear le da»
- `V/21:568` «Se borra la carpeta de un issue en un estado de tipo terminado»
- `V/21:570` «Se reescribe la de un issue en un estado de tipo en curso (`started`)»
- `V/21:573` «La única excepción es `In Review`, que es de tipo en curso y se borra por la decisión de arriba»
- `$V/descomposicion.md:484` «y un estado que esa lista no nombra sigue el tipo que Linear le da»

Sobre la foto de `21-` §1 no cambia nada: ninguna de las 37 carpetas estaba en los cinco estados
nuevos, así que siguen **39 archivos que se borran y 11 que se reescriben**.

### K-C · la línea de la raíz de composición que inyecta el reloj real la escribe `B1`

En el contrato, en `B/20` §5.1 y en la fila de `B1`, entregable y aceptación:

- `D/12:1519` «La línea de esa raíz que lo inyecta la escribe `B1`»
- `B/20:738` «La línea de esa raíz que inyecta el reloj real la escribe `B1`»
- `$B/descomposicion.md:127` «y la línea de esa raíz que inyecta el reloj real también la escribe esta unidad»
- `$B/descomposicion.md:775` «la raíz de composición de `apps/api` inyecta la hora del sistema como reloj real, en la línea que escribe esta unidad»

`G14` no cambia: esa línea vive en la raíz, que ya juntaba las dos mitades.

## 2. Conteos que cambiaron

| qué | antes | ahora | cómo se contó | espejos corregidos |
|---|---|---|---|---|
| lo que guarda `receipt` | 4 (dos referencias, número, PDF) | **6** | leída la fila de `B/02` §2.3 | sin espejo: no hay otro conteo de sus columnas |
| ⚠️ abiertos por J-C | 2 (`nucleo/08` §3, `V/02` §2.4) | **0** | `rg -n "22-\` §3"` sobre el diseño: sólo quedan dentro de tachados | `$V/descomposicion.md` (su *«con el ⚠️ de dónde viven»*, tachado) |
| estados de Linear que la limpieza de `V1` nombra | 5 de 10 | **10 de 10** | `list_issue_statuses`, equipo Hospeda | `$V/descomposicion.md` |

**Lo que no se movió**: los 33 guards (18 · 15); las 23 acciones administrativas; las 34
transiciones vivas de la Suscripción; los 24 motivos; las siete entradas del contrato y las cinco
cosas del package; los cinco hechos del reloj; los 15 plazos; las once dependencias entre épicas;
el catálogo de correos; los 17 pasos del corte; las tres entradas de la lista de pendientes de
`G8`; los 50 archivos de fuera del programa (39 se borran, 11 se reescriben); las entidades de
billing.

## 3. Casos vecinos

### Lo que BLOQUEA

Nada. Al aplicar K no apareció ninguna contradicción que deje el diseño sin poder leerse de una
sola forma.

### Para la implementación (no piden decisión)

1. **El tipo `triage` de Linear.** Linear tiene un sexto tipo de estado, `triage`, que el equipo
   Hospeda no usa hoy (no está entre los diez). Si alguien lo activa antes de la limpieza, la
   regla de `V/21` §4 no lo nombra; lo natural es tratarlo como `unstarted` (se reescribe), y lo
   resuelve quien haga la limpieza en `V1` leyendo los estados ese día.
2. **Qué imprime el PDF del comprobante.** El modelo guarda la copia; que el PDF muestre ese nombre
   y ese correo, y no los de la fila de `user` al momento de generarlo, es de `B5` y no cambia el
   modelo.
3. **Qué ley obliga a guardar el comprobante y por cuánto tiempo** sigue siendo la nota lateral de
   `22-` §3: el comprobante es no fiscal (`DEC-LEGAL-001`) y la pregunta es del pliego legal.

## 4. Para el log y la matriz (pide OK del owner)

**Es el lote final, autocontenido**: reemplaza al §4 de `22-` (que reemplazaba al de `21-`, `20-`
y `19-`, y consolidaba `17-` y `18-`) y suma K sin duplicar. Donde una decisión recibía propuestas
de más de una tanda, va un solo 📌 con el texto junto. **Cada ID grepeado el 2026-09-29 sobre
`abafb960f0`** en `01-decision-log.md` y en la matriz: existen los diecisiete `DEC` de abajo y
`WH-6`; **`EX-54` no existe** (la última `EX` es `EX-53`); **`casos vecinos` no aparece ni en el
log ni en la matriz**, así que ningún ID tiene todavía un 📌 de éstos. El log y la matriz no
cambiaron desde `a816654987`. Cada 📌 suma a su *Estado*: *«precisada el 2026-09-29, con OK del
owner (revisión del owner, casos vecinos, <casos>; ver su 📌)»* donde hoy dice `ACCEPTED` a secas,
o *«y precisada…»* donde ya había precisiones.

**Hoy en `ACCEPTED` a secas, y por eso suman a la cifra**: `DEC-MIG-006`, `DEC-DATA-006`,
`DEC-DATA-007`, `DEC-ARCH-012`, `DEC-ARCH-013`, `DEC-SUB-023`, `DEC-TEST-003` y `DEC-DATA-008`.
Las otras nueve (`DEC-DATA-005`, `DEC-ENT-002`, `DEC-TEST-001`, `DEC-ARCH-007`, `DEC-SUB-008`,
`DEC-ARCH-004`, `DEC-RF-008`, `DEC-AUTH-003` y `DEC-ARCH-006`) ya están contadas.

**Lo que suma K**: una frase en tres 📌 que ya estaban, marcadas con ✚ K: `DEC-DATA-005` por K-A
(resuelve el **Ojo** que `22-` le dejaba), `DEC-ARCH-012` por K-B y `DEC-ARCH-006` por K-C.
**Ninguna cifra se mueve.** **Grepeado si K-A pide un 📌 en otra decisión de datos de billing**:
`receipt` y *«comprobante»* aparecen en el log sólo en `DEC-LEGAL-001` (y en menciones de paso en
decisiones de sucesión y reembolso). `DEC-LEGAL-001` decide que el comprobante es no fiscal y su 📌
del 2026-09-27 dice que el de una lápida queda sin enviarse; no enumera lo que el comprobante
guarda, y K-A no cambia ninguna de las dos cosas (la copia nula sobre la lápida es consecuencia de
ese 📌, no una excepción nueva). **No lleva 📌.** Ninguna decisión del log fija las columnas de
`receipt`: viven en `B/02`.

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
4. **`DEC-ARCH-012`** (casos 8, 9, 19, 41, F-B, F-D, H-A, H-B, I-D, J-B y K-B) ✚ K: *«El tipo de
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
   issue en `In Progress` o `Backlog`; y un estado que no se nombra sigue el tipo que Linear le
   da: uno terminado, cancelado o duplicado (`Duplicate`) se borra, y uno en curso, sin empezar o
   backlog (`Todo`, `Working on`, `User Action Pending`, `On Hold`) se reescribe, con `In Review`
   como única excepción. Y al cerrar HOS-1352 los informes históricos del programa salen del
   repositorio (quedan en el historial de git; lo que importe se resume en Linear), el diseño
   vigente se reescribe una vez, sin tachados ni la palabra, y este log y la matriz de validación
   se quedan y se reescriben sin la palabra, con el OK del owner a esa reescritura.»*
   **Razón**: reemplaza *«con un nombre a definir con el owner»*, y la decisión decía que el corpus
   se reescribe o se borra sin decir cuándo, ni qué pasa con el log ni con las specs ajenas al
   programa (medidas: 50 archivos, 46 de otras 37 specs y 4 de `.qtm/`).
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
6. **`DEC-DATA-005`** (casos 7, F-C, H-C, I-C, J-C y K-A; F-C contra la recomendación; I-C corrige
   la elección de H-C) ✚ K: *«La lista de pasos de la baja de cuenta manual se escribe antes del
   corte, en este orden: la baja del cobro, `PB12` por cada ficha y la cuenta (`NUCLEO/08` §1.3).
   Los tres los hace soporte desde el panel, a pedido del dueño y con motivo: el primero con
   "cancelar una suscripción", que ya existía, el segundo con la acción 23, "borrar una ficha ajena
   a pedido de su dueño", que corre `PB12`, y el tercero con la 24, "dar de baja una cuenta a
   pedido de su dueño", que se rechaza mientras le cuelgue una suscripción viva o una ficha fuera
   de `PURGED`. La 24 no borra la fila de la cuenta: la seudonimiza. Reemplaza su nombre, su correo
   y su teléfono, cierra sus sesiones y la deja sin acceso; no toca el registro de auditoría, que
   conserva el actor y el sujeto por id, ni los cobros; y la fila de `trial` que la apunta sigue,
   con su FK `ON DELETE RESTRICT` y el hash del correo, así que la traba contra repetir la prueba
   no se pierde. Los datos de facturación de la cuenta, el nombre y el correo de quien pagó, se
   conservan tal cual, porque son datos de comprobantes que la ley obliga a guardar: viven en el
   comprobante, que guarda una copia de los dos al emitirse, copiados de la fila de `user` dueña
   del cobro, y que nadie reescribe después; la 24 reemplaza los de `user` y la copia queda como
   estaba. La baja desde Mi Cuenta sigue fuera de la épica (HOS-1393).»* **Razón**: la decisión
   decía *«soporte a mano»* y no decía qué escribe la baja de la cuenta; la frase que proponía `20-`
   (*«la 24 borra la fila de la cuenta y sus sesiones»*) chocaba con la FK `ON DELETE RESTRICT` de
   `trial.user_id`, que el owner mantuvo (caso I-C). **El Ojo de `22-` queda resuelto**: la frase
   de J-C ya no dice *«de su cliente de billing»*, que nombraba una entidad que el modelo nuevo no
   tiene, y dice dónde viven esos datos (caso K-A, `B/02` §2.3).
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
17. **`DEC-ARCH-006`** (casos G-B, I-E, J-A y K-C) ✚ K: *«El package del contrato tiene una quinta
    cosa: la interfaz del reloj con que el código de producción de las dos mitades lee la hora,
    inyectada. La construye `B1`, junto con el reloj adelantable que la implementa, que vive en el
    package de pruebas compartido. La implementación real, la hora del sistema, no vive en el
    package: la inyecta la raíz de composición de `apps/api`, el único lugar que junta las dos
    mitades, en una línea que también escribe `B1`, y en las pruebas se inyecta el adelantable.
    `G14` no cambia: importar el contrato nunca fue cruzar.»* **Razón**: su 📌 del 2026-09-28
    enumera lo que el package tiene (*«las dos interfaces, sus validaciones, los simuladores de cada
    lado y los dos juegos de casos»*), y quedaría corto. Ya está precisada, así que no suma a la
    cifra.

### 4.2 El `## Resumen` del log

18. **Fila *«Apartamientos declarados del PDR»***: de 9 a **10**, *«2026-09-29: suma
    `DEC-DATA-008`, del §25, los 90 y 180 días de la retención que pasan a ser configurables (casos
    vecinos, caso 46)»*; y sale el *«serían 10 si el owner declara…»*.
19. **Fila *«Precisadas sin `SUPERSEDED`»***: de 58 a **66**, sumando `DEC-MIG-006`,
    `DEC-DATA-006`, `DEC-DATA-007`, `DEC-ARCH-012`, `DEC-ARCH-013`, `DEC-SUB-023`, `DEC-TEST-003` y
    `DEC-DATA-008`, recontado con `contar-precisadas.py`.
20. **Una fila *«Casos vecinos de la revisión del owner»***: *«0 nuevas, 17 📌, 0 `SUPERSEDED`,
    del 2026-09-29, sobre los 76 casos vecinos decididos (`30-revision-del-owner/16-`: los 50 de
    los lotes A a E, y los lotes F, G, H, I, J y K, de cuatro, cuatro, siete, cinco, tres y tres);
    registros `17-` a `23-`.»*

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

Simulado de nuevo sobre copias del log y de la matriz de `abafb960f0` (`git show HEAD:…`) en el
scratchpad de la sesión (`aplic23/log-sim.md`, `aplic23/matriz-sim.md`, con `aplic23/sim.py`, el de
`22-` sin cambios porque K no suma IDs): las diecisiete líneas de *Estado* marcadas, un 📌 por
decisión, `EX-54` insertada después de `EX-53` y el 📌 de `WH-6`. Contadas con
`contar-precisadas.py` y `contar-filas-de-la-matriz.py` sobre la copia de hoy y la simulada, y las
decisiones y los `SUPERSEDED` con un script sobre los encabezados `### DEC-` y su *Estado*:

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
`EX-53` y `EX-54`. El lote K no mueve ninguna cifra: sus tres casos caen en 📌 que ya estaban
(`DEC-DATA-005`, `DEC-ARCH-012` y `DEC-ARCH-006`).

**Sin propuesta**: los casos 1, 2, 17 y 18 (de `17-`); 29, 36, 38 y 40 (de `18-`); 44 y 45 van
dentro del 📌 de `DEC-DATA-008` y no tocan `DEC-MP-002`, cuyo 📌 del 2026-09-28 ya dice que el
plazo se cambia sin bajar de ese mínimo. `DEC-TRIAL-004` tampoco: I-C deja su traba como estaba.
`DEC-LEGAL-001` tampoco, ni por J-C ni por K-A (arriba).

## Key Learnings

1. Resolver *«se conserva»* con una copia en el documento no choca con la regla de no copiar a
   mano cuando la copia es lo que el documento certificó: la prueba es que nadie la lee para
   decidir y nunca se reescribe. Hay que declararlo en el modelo, o el §10.3 la vuelve sospechosa.
2. Una columna nueva sobre una entidad con escritores excepcionales (la lápida sin `user`) pide
   declarar su nulidad en el mismo cambio: el caso raro ya estaba escrito en `P1`, y sin mirarlo
   la restricción habría nacido falsa.
3. Una regla por tipo de estado de Linear no cubre sola una decisión ya tomada contra el tipo:
   `In Review` es `started` y se borra, así que la regla nueva lleva la excepción nombrada.

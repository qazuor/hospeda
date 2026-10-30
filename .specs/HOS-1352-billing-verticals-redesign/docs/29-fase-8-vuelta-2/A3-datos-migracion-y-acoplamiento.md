---
title: "FASE 8 vuelta 2 · A3 — datos, migración y acoplamiento"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 8
---

# FASE 8 vuelta 2 · A3 — datos, migración y acoplamiento

Ataqué el modelo de datos de verticales (`V/02` entero: catálogo, `trial`, `listing`,
`inactiva_desde`, caché e invalidación, retención), la migración de verticales (`V/21`), su espejo
de billing (`B/21`), lo legal (`V/22`), entitlements y limits (`V/15`), la lectura del catálogo
(`V/10` y `B/10`), el glosario del núcleo en su definición de inactividad, la dirección inversa
del contrato de cobertura (§4.1 y §4.2), el procedimiento del corte (`16-fase-7…` §4) y las dos
`descomposicion.md`. Donde el diseño calla sobre algo que el código ya hace, medí el esquema actual
de `packages/db`. Todo medido contra el HEAD `1cccd9119d` del worktree
`hospeda-spec-hos-1352-billing-redesign`.

Son **6 hallazgos**: **0 CRITICA, 2 ALTA, 3 MEDIA y 1 BAJA**. La idea más grave: el hecho 4 del
reloj de inactividad —el que protege el contenido cuando se discontinúa una vertical— tiene como
ejecutor un barrido de billing que escribe `listing.inactiva_desde`, el contrato llama filtración
a toda escritura de billing en verticales salvo `extenderTrial`, y ninguna de las dos
descomposiciones le da unidad a esa escritura. Muy cerca queda el borrado de las `L1` en el paso 3
del corte: toca objetos externos que el backup de la rama de aborto no restaura, y esa rama
declara que no existe ninguno.

Regla de lectura: cada hallazgo se apoya en una cita textual copiada literal de una sola línea del
archivo, con su `archivo:línea` (rutas relativas a la raíz del worktree).

## CRITICA

Ninguno.

## ALTA

### F-8V2A3-001 — El hecho 4 del reloj no tiene quien lo construya: su ejecutor es una escritura que el contrato prohíbe

**Qué se rompe.** El glosario del núcleo le asigna el hecho 4 (el fin de servicio de una
vertical discontinuada) al barrido del día del fin de servicio, que es de billing (`B/10` §4.3).
Ese barrido escribe `listing.inactiva_desde` en cada ficha de la vertical y corre `PB2`, o sea
que escribe en una tabla de verticales y ejecuta una transición de verticales. El contrato,
en su regla de vigilancia, dice que billing escribiendo en verticales algo que no sea
`extenderTrial` es una filtración, y declara `extenderTrial` como la única escritura de billing en
verticales. Las descomposiciones reparten esto así: `B12` (billing) se lleva el barrido pero sólo
con «invalida el caché», y `V3` se lleva la invalidación. **La escritura del hecho 4 no figura en
ninguna unidad.** Un implementador de `B12` que respeta el contrato no toca `listing`; uno de `V9`
cree que la escribe billing. Sin esa escritura, el propio glosario dice qué pasa: el hard delete
cae hasta 90 días antes de la fecha que promete la discontinuación.

**El camino.**

1. Juan tiene una ficha de Gastronomía sin cobertura desde hace 150 días. `PB4` se la archivó el
   día 90 y le llegaron los avisos de retención. Todavía podía suscribirse y recuperarla.
2. El `SUPER_ADMIN` anuncia la discontinuación de Gastronomía. `S1` deja de admitir altas y Juan
   se queda sin el camino de volver a contratar.
3. Llega el fin de servicio. El barrido de `B12` baja fichas e invalida el caché, que es lo que
   su criterio de aceptación le pide. Como el contrato no le permite escribir `inactiva_desde`,
   no la escribe, y `V9` tampoco porque cree que esa escritura es de billing.
4. Juan ya no estaba cubierto, así que el hecho 5 no ocurre sobre él. Su `inactiva_desde` sigue
   siendo la de hace 150 días.
5. Unos 30 días después, `PB9` le borra el contenido y la ficha queda `PURGED`, que es final. El
   diseño le promete que el reloj «arranca acá, no antes», o sea el día 180 contado desde el fin
   de servicio.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:57`
  — "Lo ejecuta el barrido del día del fin de servicio"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/10-verticales-planes-billing-options.md:315`
  — "`listing.inactiva_desde` a cada ficha de la vertical con el instante del fin de servicio"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:362`
  — "el 1, el 2 y el 4, y a éste lo ejecuta la otra épica"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1066`
  — "`extenderTrial` es la única escritura de billing en verticales"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1166`
  — "verticales algo que no sea `extenderTrial`, o recibir de verticales un hecho"
- `.specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:138`
  — "el barrido del día invalida el caché de la vertical entera"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:376`
  — "el fin de servicio invalida la vertical entera"
- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:182`
  — "vieja —hasta 90 días antes de la que los tres avisos de la discontinuación le prometieron al"
- Silencio: `rg -n "inactiva|listing" .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md`
  no devuelve nada. En la fila V9 de la descomposición de verticales (línea 62) aparecen los ejecutores de los
  hechos 5 y 6, pero no el del 4.

**Qué haría falta decidir o escribir.** Hay que decidir de qué lado vive la escritura del hecho 4
(y la corrida de `PB2` de ese día). Si queda en billing, tiene que entrar al §4.1 del contrato como
segunda escritura declarada y a la fila de `B12`. Si pasa a verticales, necesita un disparador
que no dependa de billing, por ejemplo que `V9` o `V6` lean `vertical.fin_de_servicio`, y una
fila en la unidad que corresponda.

### F-8V2A3-002 — El borrado de las `L1` en el paso 3 toca objetos externos y la rama de aborto dice que no hay ninguno

**Qué se rompe.** Según la tabla de traducción del corte, toda ficha vieja con `deleted_at` nace
`PURGED` «con el contenido borrado como en `PB12`». `PB12` incluye las fotos en el almacenamiento
externo y la revocación, en el proveedor, del token de calendario. Eso corre en la migración
estructural del paso 3, antes de que se sepa si el paso 3 termina sano. La rama de aborto restaura
el backup del 2b y afirma que la sonda de la entrega es el único objeto del proveedor que el
backup no puede pisar. Pero las fotos borradas en el almacenamiento externo y los tokens revocados
tampoco vuelven con el backup. Después de un aborto, el sistema viejo arranca con filas que apuntan
a fotos que ya no existen y a calendarios desconectados. Esas fichas soft-deleted el sistema viejo
las puede restaurar (`apps/api/src/routes/accommodation/admin/restore.ts`, código actual). Nada lo
detecta.

Hay además una segunda lectura con daño: si se toma «migración estructural» como SQL puro, el
implementador borra el contenido en la base y deja las fotos en el almacenamiento externo, ya sin
ninguna fila que las nombre y sin nadie que las borre nunca. Eso contradice lo que el §4.1 dice que
se borra.

**El camino.**

1. Juan borra su alojamiento por error una semana antes del corte. En el sistema viejo queda con
   `deleted_at`, restaurable por un admin.
2. En el paso 3 corre la migración: la fila de Juan es `L1`, así que se borran sus fotos del
   almacenamiento externo y se revoca el token de su calendario en el proveedor.
3. El despliegue no queda sano y se toma la rama de aborto. Se restaura el backup del 2b y la fila
   de Juan vuelve con sus referencias a medios, sin nada detrás.
4. Juan pide que le restauren el alojamiento y el admin lo hace desde el panel viejo. La ficha
   vuelve sin fotos y con el calendario muerto. Ningún paso del procedimiento lo había anunciado.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:170`
  — "`PURGED`, con el contenido borrado como en `PB12` (`G1-2`)"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:614`
  — "«Fotos» incluye su copia en el almacenamiento externo."
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:614`
  — "La conexión de calendario se desconecta, y su token se revoca en el proveedor y se borra"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:59`
  — "incluido el borrado del contenido de las `L1`"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:277`
  — "Lo que el backup no puede pisar es un objeto del proveedor,"

**Qué haría falta decidir o escribir.** Hay que definir si el borrado externo de las `L1` corre
dentro del paso 3 o después del paso 5, cuando ya no puede haber aborto. Si corre dentro, la rama
de aborto tiene que declarar esa pérdida con su población. También hay que decir quién borra
físicamente las fotos: la migración o una herramienta del corte.

## MEDIA

### F-8V2A3-003 — `listing` no tiene correspondencia física escrita y la tabla de traducción sólo sirve para `accommodations`

**Qué se rompe.** El modelo tiene una sola entidad `listing`, con `vertical` inmutable. La
migración traduce «por las columnas viejas de `accommodations`» y a las otras tres verticales las
despacha con «cero filas, se re-cuentan». No se dice qué pasa si ese recuento no da cero, y
`DEC-MIG-002` sigue tomando altas. Las tablas viejas de gastronomía y experiencia no tienen
`billing_unpublished_at`, `owner_suspended` ni `plan_restricted`, que son las columnas de `L5` y
`L7`; experiencia tiene en cambio `has_active_subscription` (código actual). `B/21` §1.3 pide
clasificar con `L1`–`L8` «en las cinco verticales», y en dos de ellas las columnas no existen.
Tampoco está escrito si `listing` es una tabla nueva a la que hay que llevar contenido, medios,
FAQ y reseñas, o si son columnas nuevas sobre las tres tablas actuales.

**El camino.**

1. Juan da de alta un restaurante en el sistema viejo en octubre, por la regla de `DEC-MIG-002`.
2. El día del corte el recuento de `B/21` §1.3 da una gastronomía.
3. Un implementador aplica la tabla sólo a `accommodations`, como está escrita. La ficha de Juan
   queda sin estado de nacimiento y sin `inactiva_desde`, que es no anulable: o la migración falla
   en el paso 3, o la ficha no pasa al modelo nuevo.
4. Otro implementador improvisa una clase con las columnas que sí hay. Dos cortes distintos para
   el mismo dato.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:165`
  — "las columnas viejas de `accommodations` (las otras tres verticales tienen cero filas y se"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:73`
  — "Y cuenta fichas por dueño en las cinco verticales, con la clase `L1`–`L8` de `V/21` §2.4."
- `packages/db/src/schemas/experience/experiences.dbschema.ts:234`
  — "Denormalized flag driven by the SPEC-239 binary-subscription lifecycle hook." (código actual)
- Silencio: `rg -n "accommodations|gastronomies|experiences\b|tabla nueva|nueva tabla"` sobre
  `$V` y `$D/nucleo` sólo encuentra la línea 165 de V/21.

**Qué haría falta decidir o escribir.** Falta escribir la correspondencia de `listing` con las tres
tablas actuales y la regla para una fila de gastronomía o experiencia que aparezca en el recuento.
Puede ser una tabla de traducción propia, o una condición que frene el corte si el recuento no da
cero.

### F-8V2A3-004 — El seudónimo del correo no tiene función escrita: ni clave, ni alcance de la normalización

**Qué se rompe.** Toda la defensa del trial de por vida y la pregunta 5 al abogado descansan en
un «seudónimo determinístico del correo normalizado». Ningún capítulo dice cómo se calcula. Si es
un hash sin clave, cualquiera lo recalcula, y eso es lo que el pliego legal tiene que evaluar. Si
es un HMAC con un secreto, perder o rotar el secreto deja todas las filas de `trial` sin reconocer a
nadie, y no hay detector. La normalización «puntos y `+alias`» tampoco dice sobre qué dominios se
aplica. Sacar los puntos en un dominio propio junta dos casillas distintas, y a una persona real
se le niega el trial, que es el falso positivo que `DEC-TRIAL-004` eligió evitar.

**El camino.**

1. El implementador de `V9` usa un HMAC con un secreto de entorno, porque así el abogado recibe un
   seudónimo con clave.
2. Meses después se redeploya con el secreto regenerado. Los hashes nuevos no coinciden con los
   guardados.
3. Juan, que borró su cuenta después de consumir el trial, vuelve con el mismo correo. La guarda de
   `T1` no encuentra fila y le da un segundo trial. El `UNIQUE` tampoco lo ve.
4. En el sentido contrario: Ana (`ana.maria@hotel.com`) consumió su trial y su colega María
   (`anamaria@hotel.com`) queda sin trial.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:674`
  — "Pero no es irreversible en el sentido que importa: es un seudónimo determinístico"
- `.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:444`
  — "Sólo el email normalizado — puntos y `+alias` — niega el trial"
- Silencio: `rg -n -i "hmac|salt|pepper|función de hash|sha-?256|misma función"` sobre `$D/nucleo`,
  `$V`, `$B` y el contrato no devuelve ninguna definición. El único «misma función» está en un
  párrafo tachado de V/21 (línea 327).

**Qué haría falta decidir o escribir.** Falta decir con qué función y con qué clave se calcula el
seudónimo, qué pasa si esa clave rota, y en qué dominios se sacan los puntos. Las dos primeras
respuestas cambian lo que se le pregunta al abogado.

### F-8V2A3-005 — Retirar todos los planes deja la vertical abierta a trials sin nada de donde derivarlos

**Qué se rompe.** `B/10` §4.1 afirma que, retirados todos los planes vendibles, la vertical
«queda cerrada a altas» y nadie arranca un trial. Pero retirar un plan es publicar una versión no
vendible, y eso no escribe `vertical.admite_altas`. `T1` no mira si existen vendibles: mira la
columna. Con la columna en `sí` y cero versiones vigentes y vendibles, `T1` dispara, crea la fila
de `trial` (única de por vida) y la derivación de `V/10` §2 no encuentra ni el `rank` más alto ni
el más bajo. Ningún capítulo dice qué otorga ese trial.

**El camino.**

1. El owner retira los tres planes de Gastronomía para relanzar la pricing el mes siguiente y deja
   `admite_altas` como estaba, porque `B/10` §4.1 dice que la vertical ya queda cerrada.
2. Juan publica su primera ficha. Se dan todas las guardas de `T1`: evento, días > 0, sin
   cobertura, `admite_altas`, hash libre.
3. Nace su fila de `trial`, con el trial consumido de por vida, y la derivación no tiene fuente.
   O Juan recibe sólo los overrides, o la resolución falla. En los dos casos se quemó su único
   trial sin haber probado nada.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/10-verticales-planes-billing-options.md:131`
  — "Retirados todos los planes vendibles la vertical queda cerrada a altas"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/10-verticales-planes-billing-options.md:94`
  — "las versiones vigentes y vendibles, la de `rank` más alto y la más baja"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:51`
  — "la vertical declara evento y su plan de trial tiene días de trial > 0"
- Silencio: `rg -n "sin fuente|ninguna vendible|no hay vendible|derivación.*vac"` sobre `V/11` y
  `V/03` no devuelve nada.

**Qué haría falta decidir o escribir.** Hay dos caminos: que `T1` exija también al menos una
versión vigente y vendible, o que retirar el último vendible escriba `admite_altas = no` (o
un guard de catálogo que impida ese estado). Cualquiera de los dos obliga a corregir la afirmación
de `B/10` §4.1.

## BAJA

### F-8V2A3-006 — `V/21` §2.4 afirma y niega en el mismo párrafo que `PB2` corre sobre las fichas del corte

**Qué se rompe.** El paréntesis dice que sobre las fichas publicadas `PB2` escribe el hecho 5
«dentro del primer día, cuando la corrida del reconciliador la despublica». El paréntesis que viene
a continuación dice que desde R1 ninguna ficha preexistente nace `PUBLISHED` y que `PB2` no corre
sobre ellas. Es texto vencido que quedó sin tachar.

**El camino.**

1. El implementador de `V6` lee el primer paréntesis y agrega una corrida de `PB2` sobre las fichas
   del corte en la primera pasada del reconciliador.
2. Esas fichas ya nacieron `UNPUBLISHED_BY_BILLING`, así que `PB2` no tiene desde dónde salir y
   termina en una transición no declarada (regla 1 del núcleo). Juan, dueño de una de ellas, no ve
   ningún daño, pero el incidente queda registrado.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:236`
  — "dentro del primer día, cuando la corrida del reconciliador la despublica"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:243`
  — "escritura `C`, así que `PB2` no corre sobre ellas en el corte"

**Qué haría falta decidir o escribir.** Tachar el primer paréntesis.

## Ataques que intenté y el diseño resistió

- **Estados viejos sin traducción**: la tabla `L1`–`L8` cubre los cuatro valores de
  `LifecycleStatusEnum` (`DRAFT`, `ACTIVE`, `INACTIVE`, `ARCHIVED`) y los tres de visibilidad
  (código actual, `packages/schemas/src/enums/lifecycle-state.enum.ts`). Sobre `accommodations`
  no queda ninguna fila sin clase.
- **Borrado masivo en la primera corrida por `created_at`**: lo para la escritura `C`
  (`inactiva_desde` = instante del corte, `V/21` §2.4). Y un corte abortado no la consume porque
  se restaura el backup.
- **Dueño nulo al pasar a `listing`**: `accommodations.owner_id` ya es `NOT NULL` con
  `ON DELETE RESTRICT` (código actual), así que la FK no anulable del modelo se cumple.
- **Perder el rastro del trial por el borrado de la cuenta**: `trial.user_id` va con
  `ON DELETE RESTRICT`, y hay un trigger en extras que rechaza todo `DELETE` sobre `trial`
  (`V/02` §5). El residuo, el proceso de baja que falta, está declarado.
- **Carrera entre dos escrituras de la fila de `trial`**: el `UNIQUE(hash, vertical)` resuelve el
  choque como la guarda leída tarde (`V/03` §2).
- **Caché con capacidades de un plan cuya versión cambió**: una versión nueva de cualquier plan
  invalida el caché entero, porque quién está anclado no cruza (`V/02` §3.2). Y la invalidación va
  después del commit.
- **Billing leyendo `plan_version_entitlement` para decidir la dirección de un cambio**: lo corta
  `direcciónDeCambio`, que es un veredicto y no una capacidad (contrato §4.1).
- **Los grants del 3b sin plan al que anclar**: el catálogo es el paso 3a, verificado contra
  `G-R3` antes del 3b (`16-fase-7…` §4.2).

## Fuera de mi vector

- **Pago diferido de una `Preference` de addon del sistema viejo** que llega sin lápida ni marca
  (`16-fase-7…` §4.3): está declarado. Si la declaración alcanza le toca al vector de conciliación
  del corte.
- **El trial «regalado» a los clientes actuales por `2g`**: es una decisión del owner y la leí como
  dato.

## Key Learnings

1. Un hecho del reloj que ejecuta la otra épica choca con la regla de vigilancia del contrato,
   que sólo admite una escritura de billing en verticales. Hay que cruzar el glosario del núcleo
   con §4.2 del contrato y con las filas de las dos descomposiciones.
2. Una migración que «borra como `PB12`» hereda los efectos externos de `PB12`, y ninguno de ellos
   vuelve con el backup de la rama de aborto.
3. La tabla de traducción del corte está escrita sobre una sola tabla física. Las otras verticales
   tienen columnas distintas en el código actual, así que «cero filas» es una medición que vence y
   no una regla.
4. «Seudónimo determinístico» sin función escrita deja abiertas dos cosas que pesan: la rotación de
   una clave y el alcance de la normalización.
5. Retirar todos los planes y cerrar a altas son dos escrituras distintas, y `T1` sólo mira la
   segunda.

---
title: "FASE 8 vuelta 1 · A3 — datos, migración y acoplamiento"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 8
---

# FASE 8 vuelta 1 · A3 — datos, migración y acoplamiento

Ataqué el modelo de datos de las dos épicas y del núcleo (claves, `UNIQUE`, FK compuestas,
columnas que dos capítulos ubican distinto), el corte de la FASE 7 del paraguas (qué se respeta
de la cartera, en qué estado amanece, orden de pasos, rama de aborto), el acoplamiento entre
verticales y billing contra las tres preguntas del §4.1 del contrato y el aviso del §3, y la
retención del día 180. Contrasté lo que el diseño afirma del sistema actual contra el esquema
real del repo (`packages/db/src/schemas/`), sólo para verificar premisas de la migración.

Son **15 hallazgos**: **0 CRITICA, 5 ALTA, 7 MEDIA y 3 BAJA**. La idea más grave: el corte
«respeta la ficha» pero no dice en qué estado de la máquina nueva nace cada ficha vieja, y de esa
elección dependen un borrado sin el aviso del archivado, la republicación de lo que el dueño o un
admin bajaron, y el trial que el owner decidió regalar y que, tal como está escrito, no se alcanza.

Regla de lectura: cada hallazgo se apoya en una cita textual copiada literal del archivo, con su
`archivo:línea`. Los prefijos son los del documento base: `D/` es
`.specs/HOS-1352-billing-verticals-redesign/docs`, `V/` es
`.specs/HOS-1353-verticales-capacidades-y-autorizacion` y `B/` es
`.specs/HOS-1354-billing-cobro-y-proveedor`. Las rutas de código son relativas a la raíz del
worktree. Las citas van en tablas para no romper el largo de línea.

## ALTA

### F-8V1A3-001 — El corte respeta la ficha pero no dice en qué estado nace

**Qué se rompe.** La ficha vieja es la única fila viva que cruza el corte, y la máquina nueva
tiene seis estados. El sistema actual guarda el estado de una ficha en varias columnas
independientes (`lifecycle_state`, `moderation_state`, `visibility`, `deleted_at`,
`billing_unpublished_at`, `is_featured`, `owner_suspended`, `plan_restricted`). Ningún capítulo
dice cómo se traducen. `V/21` §2.4 razona como si toda ficha amaneciera `PUBLISHED`, y la única
escritura del corte sobre fichas que el diseño declara es `inactiva_desde`. Dos implementadores
van a mapear distinto, y varios mapeos plausibles dañan:

- una ficha vieja archivada que nace `ARCHIVED` la borra `PB9` el día 180 **sin que haya salido
  nunca el aviso del archivado**, que `PB9` da por garantizado porque «sale sólo de ahí»;
- una ficha con `deleted_at` (soft-deleted por su dueño) que cuenta como «ficha que ya existía»
  vuelve a aparecer en el panel del dueño;
- una ficha que el dueño despublicó a propósito (`INACTIVE` sin `billing_unpublished_at`) mapeada
  a `UNPUBLISHED_BY_BILLING` la republica `PB3` en cuanto contrata, que es exactamente el defecto
  que la columna `billing_unpublished_at` existe para evitar hoy;
- una ficha `REJECTED` o `PENDING` de moderación (el default es `PENDING`) mapeada por su
  `lifecycle_state` a `PUBLISHED` publica contenido que un admin no aprobó;
- `is_featured`, que el dueño hoy prende con el entitlement de destaque, no aparece en ninguna
  lista de lo que se retira: si sobrevive, la ficha sigue destacada sin la capacidad comercial.

**El camino.**

1. Juan tiene dos alojamientos: uno publicado y otro que él mismo despublicó en agosto.
2. El corte migra los dos. El implementador los mapea por `lifecycle_state` a `PUBLISHED` y a
   `UNPUBLISHED_BY_BILLING` (la única forma «no publicada» que no es borrador).
3. El reconciliador del primer día baja el publicado. Juan contrata por teléfono.
4. `PB3` republica **los dos**: el que Juan había retirado vuelve al sitio público.
5. Variante: si el implementador eligió `ARCHIVED` para el segundo, a los 180 días del corte `PB9`
   lo borra, y el aviso «al archivar» nunca salió porque ninguna transición lo archivó.

**La evidencia.**

| dónde | cita |
|---|---|
| `V/docs/02-modelo-de-datos.md:341` | «vertical, **un solo `owner_user_id`** (§6), estado del cap. 03 §9, contenido, **`inactiva_desde`**» |
| `V/docs/21-migracion.md:148` | «despublica la primera corrida del reconciliador diario de cobertura» |
| `V/docs/21-migracion.md:223` | «**Lo que sí se escribe es un valor de columna sobre filas que ya existen**» |
| `V/docs/03-maquinas-de-estado.md:514` | «**Exige `ARCHIVED`**: sale sólo de ahí, así que el aviso del archivado salió siempre antes» |
| `packages/db/src/schemas/accommodation/accommodation.dbschema.ts:124` | «`lifecycleState = INACTIVE` alone cannot tell those apart: the owner's» |
| `B/docs/21-migracion.md:279` | «(owner 2026-09-25; FASE 9 completa, `2a`; cierra `F-8CB3-014`, `F-8CA3-007`, `F-8CC2-007`): **no» |

`B/21` §4 retira `featured_by_entitlement` por nombre, pero no `is_featured`; y en `V/` no
aparece ninguna de las columnas de estado del sistema actual (búsqueda sin resultados de
`lifecycle`, `moderation_state`, `deleted_at`, `is_featured`).

**Qué haría falta decidir o escribir.** Una tabla de traducción cerrada, en `V/21` §2.4, de cada
combinación de columnas del sistema actual a uno de los seis estados, con qué se hace con las
soft-deleted y con `is_featured`. Si una ficha puede nacer `ARCHIVED`, decidir qué pasa con el
aviso del archivado (o prohibir ese origen). La traducción de la moderación es decisión del owner.

### F-8V1A3-002 — El trial que el owner regaló a la cartera no se alcanza desde su ficha

**Qué se rompe.** La decisión `2g` es que los clientes actuales «estrenan el trial» y que su
próxima publicación lo arranca por `T1`. Pero su ficha amanece publicada, el reconciliador la
lleva a `UNPUBLISHED_BY_BILLING`, y desde ese estado **el dueño no tiene ninguna transición**:
`PB1` (publicar, que es lo que dispara `T1`) sale sólo de `DRAFT`, y `PB6` (despublicar a
borrador) sale sólo de `PUBLISHED`. El guion del corte, además, es «se los llama, contratan»:
contratar lo cubre, `T1` exige `cubierto` falso, `T6` y `T8` no escriben nada porque el evento no
se ejerció en el sistema nuevo, y la persona paga desde el primer cobro, entre 26 y 44 minutos
después de autorizar. Lo que el owner decidió regalar se cobra.

**El camino.**

1. Juan tenía un alojamiento publicado. El corte lo migra y el reconciliador lo baja a
   `UNPUBLISHED_BY_BILLING`.
2. El owner lo llama; Juan quiere «volver a publicar» como le dijeron. No hay botón: su ficha no
   está en `DRAFT`.
3. El botón de suscribirse de la fila 23 lo manda «a publicar» si «todavía no publicó en esa
   vertical», o al checkout si se lee que ya publicó. En el primer caso no tiene qué publicar; en
   el segundo, contrata.
4. Contrata. `PB3` le republica la ficha. A los 26–44 minutos MercadoPago le cobra el primer mes.
5. El trial sólo es alcanzable creando una ficha nueva, o esperando al día 90 (`PB4` →
   `ARCHIVED`, `PB8` → `DRAFT`, `PB1` → `T1`): noventa días con la ficha abajo.

**La evidencia.**

| dónde | cita |
|---|---|
| `V/docs/21-migracion.md:152` | «> **Y eso es lo que se hace: se despublican. No se siembra nada.** Se les avisa **antes** del corte,» |
| `V/docs/21-migracion.md:153` | «> se los llama, contratan, y la ficha vuelve sola por `PB3` cuando la cobertura vuelve.» |
| `V/docs/21-migracion.md:156` | «vertical (`V/19`; owner 2026-09-25, FASE 9 completa, `6c`)— les arranca el trial como a» |
| `V/docs/03-maquinas-de-estado.md:516` | «el dueño no la republica —`PB1` sale sólo de `DRAFT`— y el sistema tampoco» |
| `V/docs/03-maquinas-de-estado.md:508` | «**`cubierto` pasa a verdadero**, **o el cupo vuelve a alcanzar sin que `cubierto` cambie**» |
| `V/docs/03-maquinas-de-estado.md:364` | «encendido sigue resolviendo a quien ejerció el evento **en el sistema nuevo**.» |
| `V/docs/19-superficies.md:69` | «cuando la persona todavía no publicó en esa vertical» |
| `D/12-contrato-de-cobertura.md:145` | «26 y 44 minutos después de autorizar» |
| `V/docs/21-migracion.md:355` | «estrena el trial en el sistema nuevo, aunque ya lo hubiera usado. **Causa**: decisión del owner,» |

**Qué haría falta decidir o escribir.** Si la ficha vieja publicada nace `DRAFT` (o si existe una
transición del dueño desde `UNPUBLISHED_BY_BILLING` a `DRAFT`), y qué lee la fila 23 como «ya
publicó» para un dueño migrado. Es la ejecución de una decisión del owner (`2g`): si él prefiere
que el guion telefónico siga siendo «contratan», tiene que saber que eso los hace pagar sin trial.

### F-8V1A3-003 — `A6` espera «cualquier llegada a `PURGED`» y el contrato no tiene ese canal

**Qué se rompe.** `A6` es la única fila que cancela un addon `LISTING` cuando su ficha se borra,
y su evento es una transición de verticales (`PB9` o `PB12`). El contrato declara un solo empuje
(billing → verticales, el aviso) y, en la dirección inversa, tres consultas de catálogo. No hay
ningún canal por el que billing se entere de que una ficha llegó a `PURGED`. Un implementador lo
resuelve leyendo la tabla de fichas (acoplamiento que la regla de vigilancia manda detectar), otro
llamando a billing desde la transacción de `PB12`, y un tercero no lo resuelve: el addon sigue
`ACTIVE` y su suscripción de complemento **sigue cobrando todos los meses sobre una ficha que no
existe**. La orfandad de `A5` no lo rescata, porque desde `K-9` el borrado ya no es orfandad y el
dueño que sigue pagando su principal no queda huérfano.

**El camino.**

1. Juan paga su plan de Alojamiento y un destaque mensual (addon `LISTING`, `PERIÓDICO`) sobre su
   ficha A.
2. Juan borra la ficha A (`PB12`): pasa a `PURGED`.
3. Nada en el contrato avisa a billing. `A5` no aplica: la principal de Juan sigue viva.
4. El preapproval del destaque cobra el mes siguiente, y el siguiente. El barrido del cap. 09 no
   mira `PURGED`.

**La evidencia.**

| dónde | cita |
|---|---|
| `B/docs/03-maquinas-de-estado.md:2484` | «se borra la ficha destino —**cualquier llegada a `PURGED`**: `PB9`, el día 180, o `PB12`, el dueño (`V/03` §9)—» |
| `B/docs/16-addons.md:460` | «**Es cualquier llegada a `PURGED`** —`PB9`, el hard delete del día 180, **o** `PB12`—» |
| `D/12-contrato-de-cobertura.md:812` | «Es lo único que billing le **empuja** a verticales.» |
| `D/12-contrato-de-cobertura.md:941` | «políticaDePlan(versiónDePlan)  → { díasDeGrace, díasDeTrial, permitePausa, vigente, vendible }» |
| `D/12-contrato-de-cobertura.md:1019` | «siete campos** del §4.1, vale lo mismo. Una lectura no declarada es un acoplamiento que nadie» |

**Qué haría falta decidir o escribir.** Declarar en el contrato el hecho que cruza de verticales a
billing («la ficha X llegó a `PURGED`»), con su transporte y su red (hoy el aviso no tiene
transporte durable y su red es el reconciliador, que no corre la máquina de addons), y ponerlo en
el censo que vigila la regla del §4.2.

### F-8V1A3-004 — El corte no tiene un paso que siembre el catálogo nuevo

**Qué se rompe.** El sistema nuevo no funciona sin catálogo en la base: las cinco filas de
`vertical` con su evento, `admite_altas` y `fin_de_servicio`; por vertical, los planes vendibles,
el de trial, el de pre-trial y el de piso con sus versiones y claves. El paso 3b escribe dos
grants cuyas anclas exigen un `plan` no anulable de esa vertical, y desde el primer minuto toda
persona resuelve su fuente `BASE` contra la versión de piso («una fuente sin referencia resoluble
no se puede expresar»). El procedimiento del corte enumera las escrituras del paso 3 y no incluye
el catálogo. Los guards que lo vigilan (`G-R3`, el espejo del enum) corren **en CI**, contra el
catálogo de prueba, no contra el que se escriba en producción ese día. Un catálogo parcial o con
valores equivocados pasa en verde: con `admite_altas` falso o sin evento de activación, `T1` no
dispara para nadie y todo el que publique paga sin trial; sin versión de piso, el default «negar»
deja a toda la plataforma sin poder ni contratar.

**El camino.**

1. El paso 3 despliega el esquema nuevo. El catálogo lo carga una migración de datos que corre
   después, o a mano, fuera del procedimiento.
2. El paso 3b intenta escribir los grants del owner: la FK compuesta sobre `plan(id, vertical)`
   falla, o se escribe contra el plan que exista en ese momento.
3. Si el catálogo quedó con `admite_altas` en falso para Alojamiento, Juan publica un borrador
   nuevo después del corte: `T1` no dispara y `PB1` le dice «suscribite para publicar».
4. Juan contrata y paga desde el primer cobro. Ningún guard de producción avisa.

**La evidencia.**

| dónde | cita |
|---|---|
| `D/16-fase-7-del-paraguas.md:124` | «recién acá, y sólo si el paso 2 cerró» |
| `D/16-fase-7-del-paraguas.md:125` | «**escribir los dos `permanent_grant`** de las cortesías del owner (`B/21` §2.4)» |
| `D/16-fase-7-del-paraguas.md:160` | «a mano del corte. Las otras dos —`inactiva_desde` en toda ficha preexistente (`V/21` §2.4) y los» |
| `B/docs/02-modelo-de-datos.md:498` | «el plan **no es anulable** y **pertenece a esa vertical** —**FK compuesta sobre `plan(id, vertical)`**» |
| `V/docs/02-modelo-de-datos.md:210` | «apunta (`12-contrato-de-cobertura.md` §2.5) para toda persona en toda vertical. A diferencia del de» |
| `D/12-contrato-de-cobertura.md:214` | «> **Una fuente sin referencia resoluble no se puede expresar.**» |
| `V/docs/02-modelo-de-datos.md:288` | «> Se comprueba sobre el catálogo, en CI. Cada mitad tiene su dominio y conviene no leerlos de más:» |

**Qué haría falta decidir o escribir.** Un paso del corte, entre el 3 y el 3b, que siembre el
catálogo de producción, y una verificación de `G-R3` y del espejo **contra la base de producción**
como condición para seguir al 3b. Qué plan anclan los dos grants del owner es decisión suya.

### F-8V1A3-005 — La rama de aborto restaura el backup encima de lo que el sistema nuevo cobró

**Qué se rompe.** La rama de aborto cubre «el paso 3» y restaura el backup del 2b si el paso 3
«alcanzó a escribir algo», y enumera sólo las escrituras del corte (migración, `inactiva_desde`,
grants). Pero el propio documento admite que durante el rollout del paso 3 un cliente puede
contratar. Una suscripción creada por el sistema nuevo tiene un preapproval vivo en MercadoPago;
al restaurar, la base vuelve al esquema viejo sin esa fila, y el handler viejo confirma como
procesado el webhook de un preapproval que no conoce. Es exactamente el escenario que el §4.1 del
propio documento define como el punto de no retorno: un cobro sin servicio ni asiento. Además no
está definido cuándo termina el paso 3: el punto de no retorno está «entre el paso 2 y el paso 3»,
pero la rama de aborto se dispara por fallas «del paso 3».

**El camino.**

1. Paso 3: el sistema nuevo arranca y atiende tráfico. Juan, cliente nuevo, contrata el plan
   Básico: preapproval autorizado con nuestro `external_reference`.
2. El paso 3b falla. Se declara aborto y se restaura el backup del 2b.
3. MercadoPago cobra a Juan. El webhook llega al sistema viejo, que responde `local_row_not_found`
   como procesado; MercadoPago no reintenta.
4. Juan pagó, no tiene servicio y Hospeda no tiene ni la fila ni el cobro.

**La evidencia.**

| dónde | cita |
|---|---|
| `D/16-fase-7-del-paraguas.md:190` | «la cancelación, un recorrido que el control del paso 2 no da por completo, o el paso 3— (FASE 9» |
| `D/16-fase-7-del-paraguas.md:197` | «algo —la migración estructural, `inactiva_desde`, los dos grants—, se restaura el backup del paso» |
| `D/16-fase-7-del-paraguas.md:137` | «que no conoce (`local_row_not_found`), y MercadoPago no reintenta. Si no se apaga, el cliente que» |
| `D/16-fase-7-del-paraguas.md:138` | «contrata en esa ventana espera hasta el barrido diario.» |
| `D/16-fase-7-del-paraguas.md:104` | «> **Una autorización viva cobra DESPUÉS del despliegue que borró el código capaz de reconocerla.**» |
| `D/16-fase-7-del-paraguas.md:201` | «viejo anotó entre el backup y la restauración se pierde, y no importa: tampoco se conserva» |
| `D/16-fase-7-del-paraguas.md:217` | «una ubicación declarada: está entre el paso 2 y el paso 3.**» |

**Qué haría falta decidir o escribir.** Que el sistema nuevo no acepte altas ni checkouts hasta
cerrar el paso 4 (o hasta que se declare el corte terminado), o que la rama de aborto cancele en el
proveedor todo preapproval creado por el sistema nuevo antes de restaurar. Y fijar qué hecho marca
el fin del paso 3.

## MEDIA

### F-8V1A3-006 — Las restricciones de `plan_version` no se pueden escribir sobre sus columnas

**Qué se rompe.** Tres cosas del mismo renglón no cierran contra las columnas declaradas:

- `UNIQUE(vertical, rank) WHERE vendible AND vigente` está en `plan_version`, que no guarda
  `vertical` (vive en `plan`). Un índice parcial no cruza tablas: o se denormaliza la vertical en
  la versión, o el invariante de `DEC-ARCH-002` baja a servicio sin que nadie lo declare.
- `plan_version` es «inmutable», pero `vigente` cambia de valor en la versión vieja cada vez que
  se publica una nueva. Un implementador pone la marca en la versión y rompe la inmutabilidad; otro
  pone un puntero en `plan` y la restricción `UNIQUE(plan_id) WHERE vigente` deja de tener forma.
- `B/02` pide una FK compuesta sobre `plan_version(id, plan_id)`, que exige `UNIQUE(id, plan_id)`
  en `plan_version`; `V/02` declara explícitamente la gemela de `plan` y no ésta.

**El camino.** Juan (administrador) publica una versión nueva del plan Pro con `rank` 2. La vieja
tiene que dejar de ser vigente: si la base no tiene la vertical en la versión, nada impide que
quede otra vendible y vigente con `rank` 2 en Alojamiento, y la derivación del trial toma la que
encuentre primero.

**La evidencia.**

| dónde | cita |
|---|---|
| `V/docs/02-modelo-de-datos.md:48` | «lo que tiene efecto y por eso **es inmutable**: `rank`, si es vendible, días de grace, días de trial» |
| `V/docs/02-modelo-de-datos.md:48` | «**`UNIQUE(vertical, rank) WHERE vendible AND vigente`** — dos vendibles con el mismo rank es un estado inválido» |
| `V/docs/02-modelo-de-datos.md:48` | «**`UNIQUE(plan_id) WHERE vigente`** — cada plan tiene exactamente una versión vigente» |
| `V/docs/02-modelo-de-datos.md:47` | «**`UNIQUE(id, vertical)`**, para la FK compuesta del ancla de un grant de billing» |
| `B/docs/02-modelo-de-datos.md:498` | «**y es una versión de ese mismo plan: FK compuesta sobre `plan_version(id, plan_id)`**» |

**Qué haría falta decidir o escribir.** Dónde vive la vigencia (marca mutable declarada como
excepción a la inmutabilidad, o puntero en `plan`), cómo se expresa la unicidad de `rank` por
vertical y la `UNIQUE(id, plan_id)` que la FK de billing necesita.

### F-8V1A3-007 — `subscription` guarda vertical, versión y billing option sin atarlos entre sí

**Qué se rompe.** La suscripción lleva tres columnas que deben ser coherentes —la vertical, la
versión anclada y la billing option— y la base no las ata: no hay FK compuesta de la billing
option a su versión ni de la versión a la vertical. El diseño aplicó ese criterio al ancla del
grant con el argumento exacto («sin ella la fila mala se sigue pudiendo escribir») y declaró que el
invariante 10 lo sostiene la base sólo por esa mitad. Una fila puede cobrar el precio de una
versión, otorgar otra y cubrir una vertical distinta de la del plan: el mismo cruce que el
invariante 10 prohíbe, adentro de una fuente `SUSCRIPCIÓN`.

**El camino.** Una sucesión (`S18`) de Juan de Básico a Pro escribe la versión nueva y deja la
billing option de Básico. El preapproval cobra el precio de Básico, el contrato emite la versión de
Pro, y el barrido compara el monto contra «el precio de la versión» sin que la base haya impedido
la fila.

**La evidencia.**

| dónde | cita |
|---|---|
| `B/docs/02-modelo-de-datos.md:47` | «`user`, vertical, versión de plan anclada, billing option, estado, **la fecha del próximo cobro**» |
| `B/docs/02-modelo-de-datos.md:31` | «el ciclo y su precio: mensual, trimestral, semestral o anual (§19), monto y moneda» |
| `D/12-contrato-de-cobertura.md:776` | «(§2.3). Y el plan **pertenece a la vertical del ancla**, que es la restricción que la base tiene» |
| `B/docs/02-modelo-de-datos.md:1143` | «Es la mitad del §64.10 que el scope estructural del cap. 17 **no** alcanza» |
| `D/nucleo/04-invariantes.md:32` | «La regla de reparto: **base antes que servicio, servicio antes que guard, guard antes que» |

**Qué haría falta decidir o escribir.** Las FK compuestas (billing option → su versión; versión →
plan de esa vertical) en `B/02` §2.2 y §5, o la razón escrita de por qué bajan a servicio.

### F-8V1A3-008 — Billing lee de verticales cosas que no están entre los siete campos

**Qué se rompe.** La regla de vigilancia del §4.2 dice que toda lectura de billing fuera de los
siete campos es un acoplamiento no mirado. El diseño vigente ya tiene cuatro:

- `A1` evalúa `cobertura(user, vertical del objetivo)`: billing lee la vertical (y para validar el
  objetivo, el dueño) de una ficha, que es tabla de verticales;
- la vigencia y el tipo de scope de un addon: `V/02` los pone en `addon_version` (verticales),
  mientras `B/16` dice que «el producto declara» la vigencia y `B/02` valida el objetivo contra
  «el tipo de scope del producto». O viven en billing y `V/02` está mal, o billing los lee de
  verticales para calcular el fin de la instancia y validar el objetivo;
- «sólo se re-apunta a otra versión del mismo `addon`» exige leer `addon_version.addon_id`;
- la pricing de billing enumera los planes de una vertical con nombre, descripción y orden, y
  `políticaDePlan` sólo contesta sobre una versión dada.

**El camino.** Juan compra un «Boost 7 días» para su ficha. Billing, para escribir la instancia,
necesita la vigencia (¿de `addon_product` o de `addon_version`?) y la vertical de la ficha. Un
implementador lo lee de las tablas de verticales; la regla del §4.2 dice que eso es la filtración
que había que detectar, y ningún guard la ve.

**La evidencia.**

| dónde | cita |
|---|---|
| `B/docs/03-maquinas-de-estado.md:2479` | «en `cobertura(user, vertical del objetivo)`, ninguna fuente de clase `TÍTULO` que no sea de `tipo: TRIAL`» |
| `V/docs/02-modelo-de-datos.md:64` | «qué otorga y con qué valores, vigencia, tipo de scope» |
| `B/docs/16-addons.md:40` | «**El producto declara los dos, por separado:**» |
| `B/docs/02-modelo-de-datos.md:493` | «el objetivo corresponde al tipo de scope del producto; **la versión anclada no es anulable**» |
| `B/docs/02-modelo-de-datos.md:492` | «**Y sólo se re-apunta a otra versión DEL MISMO `addon`**» |
| `B/docs/19-superficies.md:292` | «1. **Lee la versión vigente y vendible, nada más** (§2). Un plan retirado no aparece, aunque haya» |

**Qué haría falta decidir o escribir.** Dónde viven vigencia y tipo de scope (una sola respuesta
en `V/02` y `B/02`), y agregar al §4.1 las lecturas legítimas (vertical y dueño de un recurso,
linaje del addon, enumeración de la pricing) o sacarlas de billing.

### F-8V1A3-009 — La lista de invalidación del caché pide datos que sólo tiene billing

**Qué se rompe.** El caché es de verticales, y tres filas de su lista de invalidación dependen de
hechos que el contrato no transporta: «cambio de ciclo» (los ciclos no cruzan), «toda transición
de la máquina de suscripción» (el estado no cruza, y el aviso sólo sale si cambia la cobertura) y
«un plan al que hay suscripciones o grants anclados» (saber quién está anclado es leer
`subscription` o `permanent_grant_vertical`, que el contrato dice que leer es acoplamiento). Quien
implemente por el aviso deja filas sin disparador; quien lea las tablas de billing rompe el corte.
El caso con daño es el grant: si al publicar una versión peor del plan anclado no se invalida a
sus beneficiarios, el caché sigue otorgando lo viejo hasta la red de tiempo, y es lo que el
capítulo llama error de seguridad.

**El camino.** Juan tiene un *Free Forever* anclado al plan Premium. El admin publica una versión
nueva que le agrega una foto. Verticales no sabe que Juan está anclado a ese plan sin leer la tabla
de anclas de billing; si no lo lee, la entrada de Juan no se borra y ve la versión vieja hasta el
TTL.

**La evidencia.**

| dónde | cita |
|---|---|
| `V/docs/02-modelo-de-datos.md:493` | «cambio de plan o de ciclo» |
| `V/docs/02-modelo-de-datos.md:494` | «toda transición de la máquina de suscripción» |
| `V/docs/02-modelo-de-datos.md:501` | «**se publica una versión nueva de un plan al que hay GRANTS anclados**» |
| `D/12-contrato-de-cobertura.md:896` | «**No cruzan** montos, precios, monedas, ciclos, estados de pago, ids del proveedor, fechas de» |
| `D/12-contrato-de-cobertura.md:103` | «> (`permanent_grant_vertical`, `B/02` §2.4), así que **cruza por acá** —leerlo de esa tabla sería» |

**Qué haría falta decidir o escribir.** Qué transporte ejecuta cada fila (el aviso, un evento
nuevo declarado en el contrato, o «invalidar a todos» para las publicaciones de catálogo), y sacar
de la lista lo que verticales no puede observar.

### F-8V1A3-010 — El borrado del día 180 enumera cuatro clases de contenido y la ficha tiene más

**Qué se rompe.** `PB9` y `PB12` borran «textos, fotos, FAQ, horarios» y «nada más», y conservan
todo «lo de la persona». Una ficha del sistema tiene además reseñas de terceros, datos de IA,
ocupación, SEO, información de admin y la conexión de calendario con tokens OAuth del dueño, y las
fotos viven también en un almacenamiento externo. Ninguna de esas cosas está en una de las dos
listas. Dos implementadores borran distinto: uno deja los tokens de Google Calendar de un dueño
cuya ficha ya no existe para siempre; otro, leyendo «hard delete» como `DELETE` de la fila, se
lleva en cascada las reseñas que escribieron otros usuarios.

**El camino.** La ficha de Juan llega a `PURGED` el día 180. Juan había conectado su Google
Calendar. El implementador borra lo enumerado; la fila de sincronización con sus tokens queda, y el
sync sigue intentando escribir sobre una ficha purgada.

**La evidencia.**

| dónde | cita |
|---|---|
| `V/docs/02-modelo-de-datos.md:574` | «el contenido de ESA ficha —textos, fotos, FAQ, horarios— y sus borradores, y nada más» |
| `V/docs/02-modelo-de-datos.md:576` | «el usuario, sus preferencias, sus señales de identidad» |
| `packages/db/src/schemas/accommodation/accommodationCalendarSync.dbschema.ts:17` | «The `access_token_*`/`refresh_token_*` columns store OPAQUE ciphertext.» |
| `packages/db/src/schemas/accommodation/accommodation_review.dbschema.ts:23` | «.references(() => accommodations.id, { onDelete: 'cascade' }),» |

**Qué haría falta decidir o escribir.** Una lista cerrada, por tabla, de qué borra `PURGED`, qué
conserva y qué se desconecta (integraciones), incluido el almacenamiento externo de las fotos.
Qué pasa con las reseñas de terceros es decisión del owner.

### F-8V1A3-011 — La lista de llamados sale de las suscripciones y la despublicación alcanza a más

**Qué se rompe.** El costo de «no migrar» se midió en suscripciones: «tres llamadas», con un
umbral de «unas veinte» suscripciones. Pero lo que el corte hace efectivo el primer día es bajar
**toda ficha publicada de un dueño sin cobertura**, con o sin suscripción vieja. El procedimiento
dice que el aviso va antes del paso 1 y no dice a quién. La medición de contenido que sostiene
«gastronomía, experiencia y partner: cero filas» es del 2026-09-15, la consulta reproducible sólo
cuenta alojamientos, y la re-verificación que `B/21` pide antes de implementar mira tablas de
billing, no fichas. Con `DEC-MIG-002` tomando altas y las verticales comerciales a la venta, el
número de fichas que se bajan puede crecer sin que ninguna condición de caducidad lo mire.

**El camino.** Juan publicó un alojamiento en 2025 y nunca tuvo suscripción (la ficha se creó
antes del cobro, o su trial ya se había perdido en otro esquema). No figura en las tres llamadas.
El reconciliador del primer día le baja la ficha; Juan se entera por el aviso previo al día 90.

**La evidencia.**

| dónde | cita |
|---|---|
| `V/docs/21-migracion.md:58` | «**tres llamadas** y dos cuentas propias» |
| `V/docs/21-migracion.md:313` | «> Con ocho filas *«no migrar»* son tres llamadas; **el umbral medido está en unas veinte**, y» |
| `V/docs/21-migracion.md:323` | «- **Gastronomía, experiencia y partner**: cero filas. El rediseño de esas tres verticales no» |
| `D/07-facts-inventory.md:149` | «UNION ALL SELECT 'alojamientos', count(*)::text FROM accommodations WHERE deleted_at IS NULL;» |
| `B/docs/21-migracion.md:68` | «corte descarta sin nombrar hasta ahora —compras de addon, canjes de promo, grants de destaque y» |
| `D/16-fase-7-del-paraguas.md:171` | «**El aviso va ANTES del paso 1**, no después: es lo único que» |

**Qué haría falta decidir o escribir.** Que la población del aviso sea «todo dueño con ficha
publicada el día del corte», medida por vertical el día del corte, y que la condición de caducidad
de `V/21` §2.5 cuente fichas y no sólo suscripciones.

### F-8V1A3-012 — La lápida no dice qué versión, billing option ni vertical lleva

**Qué se rompe.** La lápida es una `subscription` en `CANCELLED`, y una `subscription` guarda
vertical, versión anclada y billing option. Los planes viejos no existen en el catálogo nuevo (no
se conserva nada del sistema viejo), así que el implementador tiene que inventar a qué versión
ancla la lápida: si la ancla al plan nuevo más parecido, afirma que Juan tuvo contratado algo que
nunca existió; si deja las columnas nulas, contradice su obligatoriedad donde la tenga.

**El camino.** El paso 4 siembra la lápida del preapproval cancelado de Juan (plan `owner-pro`
viejo). No hay `owner-pro` en el catálogo nuevo. El implementador la ancla al Pro nuevo; el día
que el barrido la relee, compara contra un precio que Juan nunca pagó.

**La evidencia.**

| dónde | cita |
|---|---|
| `B/docs/21-migracion.md:129` | «> **El compromiso viejo se conserva como una `subscription` en `CANCELLED` con su `provider_link`,» |
| `B/docs/02-modelo-de-datos.md:47` | «`user`, vertical, versión de plan anclada, billing option, estado, **la fecha del próximo cobro**» |
| `B/docs/21-migracion.md:280` | «se conserva nada** —ni se transcribe, ni se congela en solo lectura, ni se exporta—. Eso abarca» |
| `D/16-fase-7-del-paraguas.md:126` | «**sembrar las lápidas** (`B/21` §2.5) con los ids cancelados» |

**Qué haría falta decidir o escribir.** Qué columnas son anulables en una lápida (o un tipo de fila
propio), y que el barrido la trate sólo por su `provider_link`.

## BAJA

### F-8V1A3-013 — El núcleo pone el invariante 2 entre los que sostiene la base

**Qué se rompe.** `NUCLEO/04` §2.1 lista el invariante 2 bajo «los que sostiene la base», con una
«restricción» que es una regla de comportamiento. `V/02` §5 declara que ninguna restricción impide
un `DELETE` directo sobre `trial`. El conteo del núcleo (6 de base) queda sobre una afirmación que
la épica desmiente.

**El camino.** Un script de limpieza borra filas de `trial` de Juan; la base lo deja. El núcleo
decía que eso no tenía camino.

**La evidencia.**

| dónde | cita |
|---|---|
| `D/nucleo/04-invariantes.md:45` | «la fila de `trial` no se borra nunca, ni siquiera en el hard delete del día 180» |
| `V/docs/02-modelo-de-datos.md:733` | «> restricción declarada impide un `DELETE` directo sobre `trial`**. Hasta que exista una, esa mitad» |

**Qué haría falta decidir o escribir.** Bajar el 2 a «servicio» en el núcleo hasta que exista la
restricción, o declararla.

### F-8V1A3-014 — La regla de vigilancia inversa, leída literal, dispara sobre el veredicto

**Qué se rompe.** La regla dice que toda lectura de billing fuera de «los siete campos» es
filtración. Los siete son los de `políticaDePlan` y `situaciónDeVertical`; la tercera pregunta,
`direcciónDeCambio`, devuelve un veredicto que no es ninguno de los siete. Leída al pie de la letra,
la regla señala como filtración la única lectura que el §4.1 construyó para evitar una.

**El camino.** Un revisor aplica la regla a `B8`, que consume el veredicto para el cambio de plan
de Juan, y la marca como acoplamiento no declarado.

**La evidencia.**

| dónde | cita |
|---|---|
| `D/12-contrato-de-cobertura.md:984` | «**Son siete campos en tres preguntas, y los dos últimos son los que importa declarar.**» |
| `D/12-contrato-de-cobertura.md:1019` | «siete campos** del §4.1, vale lo mismo. Una lectura no declarada es un acoplamiento que nadie» |

**Qué haría falta decidir o escribir.** Que la regla cite «las tres preguntas del §4.1» en vez de
«los siete campos».

### F-8V1A3-015 — Una fila de invalidación contradice la inmutabilidad de la versión

**Qué se rompe.** La fila «se publica una versión nueva de un plan al que hay suscripciones
ancladas» se justifica con «cambia lo que esa versión otorga». Una versión es inmutable y la
suscripción lee su versión anclada: publicar otra no cambia lo que otorga la anclada. La fila es
inocua (invalidar de más cuesta rendimiento), pero su razón es falsa y compite con la de los grants,
que sí es verdadera.

**El camino.** Un implementador la lee como «las versiones mutan» y relaja la inmutabilidad de
`plan_version` para que la fila tenga sentido, que es el camino al «+30 fotos» que el anclaje vino a
cerrar para Juan.

**La evidencia.**

| dónde | cita |
|---|---|
| `V/docs/02-modelo-de-datos.md:498` | «se publica una versión nueva de un plan al que hay suscripciones ancladas» |
| `V/docs/02-modelo-de-datos.md:72` | «**La versión es inmutable**, por `DEC-ARCH-001` tal cual: *«se versiona lo que tiene efecto»*.» |

**Qué haría falta decidir o escribir.** Borrar la fila o corregir su razón.

## Ataques que intenté y el diseño resistió

- **`inactiva_desde` con `created_at` en el corte**: la escritura `C` lo cierra y el aborto no la
  cuenta dos veces (el reintento escribe con su instante).
- **Colisión del corte con `UNIQUE(user_id, vertical)` o con el hash**: desde `2g` el corte no
  escribe filas de `trial`, así que no hay nada que choque.
- **Orden entre los grants del owner y el reconciliador**: fijado en el paso 3b, antes del 4.
- **La lápida compitiendo por el candado del §11**: `CANCELLED` no es estado vivo.
- **Recuento de los siete campos**: cinco de `políticaDePlan` más dos de `situaciónDeVertical`
  cierran, y `V/02` y el contrato dicen lo mismo.
- **Los 37 invariantes del núcleo**: 6 + 14 + 5 + 7 + 5 = 37, y cada tabla cuenta sus filas.
- **Retención sobre datos de la persona**: `DEC-DATA-005` se lee igual en `V/02` §4 y en
  `NUCLEO/08` §1.3; el delta de contenido guarda sólo el nombre del campo.
- **Retiro de tablas viejas antes del paso 1b**: las dos épicas llegan juntas en un despliegue
  (`DEC-ARCH-007`), así que el código viejo sigue vivo hasta el paso 3.
- **Salidas de `PRE_TRIAL` (cuatro)**: `T1`, `T6`, `T7` y `T8`, contadas contra la tabla.

## Fuera de mi vector

- El seudónimo determinístico del correo como dato personal (cap. 22, consulta legal).
- La FK `ON DELETE RESTRICT` de `trial.user_id` choca con el `hardDelete` genérico de
  `BaseCrudService` si alguien lo expone para usuarios; el proceso de baja de cuenta sigue sin
  diseñar (`V/02` §4.1, declarado).
- El manifiesto de sondas con medición abierta del paso 1b y su cobro sobre la tarjeta del owner.

## Key Learnings

1. Cuando la migración «respeta» filas vivas, la pregunta que falta casi siempre es **en qué
   estado de la máquina nueva nacen**; un solo valor de columna declarado no alcanza.
2. Una decisión del owner que promete algo a la cartera hay que recorrerla contra la máquina de
   estados desde el estado en que la cartera amanece, no desde el estado inicial genérico.
3. El contrato de cobertura declara los flujos de catálogo en las dos direcciones, pero no los
   **eventos** de verticales hacia billing; `A6` es el primero que lo necesita.
4. Los guards de catálogo corren en CI; el catálogo de producción del día del corte no tiene
   verificación declarada.
5. Una rama de aborto con restauración de backup tiene que contar las escrituras de los clientes,
   no sólo las del procedimiento.

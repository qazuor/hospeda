# Impacto A · Producto y verticales

Alcance: C1, C3, C4, C5, C6, C7, C9, C10, C11, C12, C14, N1, N6 y la pregunta N7.

Medido sobre el worktree del diseño en `377a7c568b` y sobre hospeda2 en `cd4e59164b`. Sin editar nada.

Abreviaturas de rutas (las mismas que usa el diseño):

- `D/` = `.specs/HOS-1352-billing-verticals-redesign/docs/`
- `V/` = `.specs/HOS-1353-verticales-capacidades-y-autorizacion/`
- `B/` = `.specs/HOS-1354-billing-cobro-y-proveedor/`
- `log` = `D/01-decision-log.md`, `contrato` = `D/12-contrato-de-cobertura.md`, `corte` = `D/16-fase-7-del-paraguas.md`
- `vivo:N` = línea N de `explicacion/vivo.txt` (el artifact con los 15 cambios)

---

## Resumen en una tabla

| punto | qué hace con el diseño | choca con | tamaño |
|---|---|---|---|
| C1 | nada: el repo ya dice «motor único» | ninguno | chico |
| C3 | agranda el alcance de `G8` a todo el repo y a la historia; saca la excepción histórica del PDR §55.1 | **PDR §55.1** (no editable), historia de migraciones Drizzle, ledger de seed, `COMMERCE_OWNER`, `commerce_leads`, 7 permisos | grande |
| C4 | cierra la pregunta abierta de `DEC-ENT-002` (calendario o aniversario); pide un dato que hoy no cruza | contrato §4 (*«no cruzan fechas»*); `V/11` §4.3 (la cuota del trial no se renueva) | mediano |
| C5 | el artifact ya sacó el caso borde R15; en el repo sigue vivo | se simplifica con C12 | chico/mediano |
| C6 | nada: el repo ya lo tiene (`V/17` §4.3, `G6`) | ninguno | chico |
| C7 | queda declarado para después; hay que escribir hoy la condición | `NUCLEO/08` §3: *«ni las que se agreguen»* | chico |
| C9 + C11 | mecanismo nuevo: tabla de plazos, historial, validación cruzada, relojes que guardan su plazo | `G-R5`, `G-R5-B` (guards de CI sobre valores que pasan a la base); 152 menciones de 90/180 | grande |
| C10 | marca nueva «pedido de arreglo», dos salidas de `MODERATED`, avisos | `PB11` → `DRAFT`; ítem del §12 sobre la ficha moderada | mediano/grande |
| C12 | revierte R1/`G1-1`: el corte escribe un trial ACTIVO por dueño con ficha a la vista | `DEC-MIG-005` §3 en su fundamento, `V/21` §2.4 entero, `corte` §4.2, guion, `PB1`, `T8`/R15 | grande |
| C14 | verticales tiene que ver la pausa: abre la frontera | `DEC-DATA-002`, `DEC-TRIAL-008`, contrato §4 | mediano/grande |
| N1 | borra `packages/billing/src/config` (3378 líneas); el catálogo se edita desde el panel | invariante 15/16 (ya lo pedía); dual-write de seed; 11 data-migrations que importan esa config | grande |
| N6 | pone domicilio al contrato: un package compartido con puertos, esquemas, falsos y los dos juegos de casos | contrato §7 (*«en qué package vive cada cosa: FASE 5»*) | mediano |
| N7 | 13 ítems: 6 se resuelven ahora, 6 quedan declarados, 1 se saca con otra simplificación | ver la tabla del final | variable |

---

## C1 · ¿El código es el mismo para todas las verticales?

1. **Qué dice hoy el repo.** `V/docs/10-verticales-planes-billing-options.md:31-50` (tabla de los
   ocho ítems) y `:52-60`: *«Tres verticales que coinciden en ... no pueden justificar una sola
   línea de código separado»*. `G1` (`V/spec.md:398`) deja nombrar una vertical sólo a quien
   implementa uno de los ocho ítems. El ítem 1 es una columna, `vertical.evento_de_activacion`
   (`V/docs/02-modelo-de-datos.md:46`, `:212`).
2. **Qué pide el owner.** Confirmar la respuesta del artifact: motor único, y algunas de las 8
   diferencias tienen código por opción.
3. **Qué cambiar.** Nada de reglas. La respuesta del artifact coincide con el repo: el código se
   bifurca **por la opción declarada en la base** (evento `PUBLICAR`/`EMPEZAR`/ninguno, alta
   self-service/administrada, medio de pago manual), no por el nombre de la vertical. Las opciones
   que tienen código propio son la 1 (dos disparadores de `T1`), la 2 (ficha contra presencia de
   Partner, unidad V7), la 5 (postulación de Partner) y la 7 (pago manual, `MP1`). Las 3, 4, 6 y 8
   son datos. Opcional: una frase en `V/10` §1.1 que diga *«código por opción, nunca por
   vertical»*, que es lo que `G1` vigila.
4. **Sub-preguntas.** Ninguna.
5. **Tamaño.** Chico (texto opcional).

---

## C3 · «commerce» desaparece por completo, ni como histórico

1. **Qué dice hoy el repo.**
   - El PDR (no editable) tiene la excepción: `D/00-PDR.md:1957-1975`, §55.1 *«Solo conservar
     referencias realmente necesarias para: auditoría; migration history; comprender datos legacy.
     Marcadas inequívocamente: LEGACY u OBSOLETE»*.
   - El diseño la heredó: `V/docs/21-migracion.md:427-429` y `B/docs/21-migracion.md:427`
     (*«con la excepción histórica del §55.1 ... Eso es trabajo de FASE 5»*).
   - `G8` vigila sólo **fuentes activas**: `V/spec.md:402`, `V/docs/20-testing.md:56`
     (*«aparece `commerce` en fuentes activas»*); invariante 32 en `D/nucleo/04-invariantes.md:78`.
   - El propio corpus del diseño nombra la palabra: `D/08-phase-1b-code-discovery.md` 66 veces,
     `D/00-PDR.md` 7, informes de fase unas 40 más.
2. **Qué pide el owner.** Sin excepción histórica: datos reescritos o borrados, y un guard que
   falle **en todo el repositorio**. Pregunta abierta: ¿también en el documento (el artifact)?
3. **Qué cambiar.**
   - **Log**: decisión nueva (propongo `DEC-META-00x` o `DEC-ARCH-012`) que declara el
     **apartamiento del PDR §55.1**, con cita del owner. El PDR no se edita: el apartamiento va al
     resumen de apartamientos.
   - **`G8`**: predicado nuevo, *«aparece `commerce`, sin distinguir mayúsculas, en cualquier
     archivo versionado»*. Lista de exenciones **cerrada y con causa** (ver sub-pregunta 1). El
     propio guard tiene que construir el patrón sin escribir la palabra literal, o se exime a sí
     mismo por nombre: si no, falla sobre su propio texto.
   - **Invariante 32** (`NUCLEO/04:78`): pasa de *«fuentes activas»* a *«todo el repositorio»*.
   - **`V/21` y `B/21` línea 427**: se reescriben (la excepción desaparece).
   - **FASE 5 (filtro por sujeto)**: la medición real es más grande que el billing. En hospeda2,
     fuera de `.claude/worktrees`, hay **1204 archivos y 14.152 apariciones**. No es sólo billing:
     - rol `COMMERCE_OWNER` (`packages/schemas/src/enums/role.enum.ts:39`) y **7 permisos**
       `commerce.*` (`permission.enum.ts`), con filas vivas en `role_permission` (renombrar un
       permiso es migrar filas reales, gotcha ya conocido del repo);
     - la tabla `commerce_leads` (formulario de alta de gastronomía y experiencia) y la feature de
       admin `apps/admin/src/features/commerce/` (con símbolos `eCommerce`);
     - `PartnerTypeEnum` tiene un valor `'commerce'` (`partner-type.enum.ts`), que es un **tipo de
       partner**, no billing;
     - `ProductDomainEnum` `'commerce'` (éste sí muere con el modelo nuevo);
     - **historia de migraciones**: 10 SQL y 99 snapshots de `packages/db/src/migrations/` la
       nombran (`commerce_listing_subscriptions`, `commerce_leads`, `COMMERCE_OWNER`);
     - **ledger de seed**: 15 data-migrations llevan la palabra **en el nombre del archivo**
       (`0061-hos-688-commerce-vertical-catalogue.ts`, etc.), y ese nombre está guardado en
       `seed_migrations` de producción: renombrar el archivo lo hace correr de nuevo;
     - otras specs (`.specs/HOS-974-funcionalidades-de-comercio`, HOS-1077, HOS-277...), 21
       archivos de i18n, el `CLAUDE.md` raíz (sección *«Commerce subscription isolation»*).
   - **Casos borde**: nace uno, el de la historia de migraciones (sub-pregunta 1).
   - **Linear**: comentario de decisión en HOS-1352; y probablemente issues de FASE 5 para el rol
     y los permisos, que son de verticales y no de billing.
4. **Sub-preguntas para el owner.**
   1. **¿Qué hacemos con la historia de migraciones y el ledger de seed, que no se pueden
      reescribir sin tocar producción?**
      - (a) **Exención cerrada de dos rutas**: `packages/db/src/migrations/**` y los nombres de
        archivo de `packages/seed/src/data-migrations/**` ya aplicados. Costo: casi nada. Riesgo:
        la palabra sigue en el repo, en archivos que nadie lee a mano.
      - (b) **Squash**: se reemplaza toda la historia Drizzle por una línea base nueva y se marca
        aplicada en producción; lo mismo con el ledger de seed. Costo: una operación delicada sobre
        `__drizzle_migrations` y `seed_migrations` de producción el día del corte. Riesgo: medio
        (un error ahí rompe el próximo `db:migrate`).
      - (c) **Squash sólo de seed** (el ledger es nuestro, más fácil) y exención para Drizzle.
      - **Recomiendo (b) el día del corte**: el corte ya retira las tablas de billing y deja la
        historia vieja sin sujeto, y es el único momento en que la base se toca a propósito. Si el
        owner no quiere ese riesgo, (a).
      - Juan: su ficha no se entera de nada. Lo que cambia es si un desarrollador que corre `rg
        commerce` dentro de un año encuentra 110 archivos de migraciones (a) o ninguno (b).
   2. **¿El PDR queda exento?** No se puede editar (regla del programa). Opciones: (a) exento
      por nombre, con causa; (b) sacarlo del repo y guardarlo en Linear o como artifact. Recomiendo
      (a): es el documento fundacional y la regla de no editarlo es más vieja que ésta.
   3. **¿El rol `COMMERCE_OWNER`, los permisos `commerce.*`, `commerce_leads` y el tipo de partner
      `'commerce'` entran?** Son producto, no cobro, y renombrarlos es migrar filas vivas.
      Recomiendo que sí entren (el owner dijo *«por completo»*), pero **como trabajo de FASE 5 de
      verticales**, con su data-migration, y que el tipo de partner se renombre a su significado
      real (un comercio local, `shop`/`local_business`, a definir con él).
   4. **La pregunta del owner: ¿sacar la palabra también del documento?** Sí. El artifact tiene la
      sección *«Qué pasa con commerce»* (`vivo:140-141`). Opciones: (a) reescribirla como *«el
      agrupamiento viejo de Gastronomía y Experiencia»*; (b) dejarla porque el artifact no vive en
      el repo. Recomiendo (a): la razón del owner (*«una referencia marcada como histórica igual
      confunde»*) vale igual fuera del repo. Lo mismo para engram y las memorias, que el PDR §55
      también nombra: limpieza a mano, sin guard posible.
5. **Tamaño.** Grande (mecanismo de exención o squash, varias unidades de FASE 5, y un
   apartamiento del PDR).

---

## C4 · La cuota mensual se renueva por la fecha del ciclo de la persona

1. **Qué dice hoy el repo.**
   - `log:590-616`, `DEC-ENT-002`: mensual siempre, lo no usado se pierde. Implicación 2: *«Falta
     definir si el mes corre por calendario o por aniversario de la suscripción»*.
   - Abierto en tres lugares: `V/docs/15-entitlements-y-limits.md:512`, `V/spec.md:436`,
     `V/docs/11-trial.md:513`. Y `D/nucleo/07-outbox-y-notificaciones.md:124` lo cruza con el huso.
   - **`V/docs/11-trial.md:221-230`, §4.3: *«La cuota de trial es una sola para todo el trial, no
     una cuota mensual»*** (para que un trial extendido a 90 días no entregue tres cuotas).
   - Contrato §2 (`contrato:84-96`): la fuente trae `hasta`, **no trae desde cuándo existe**. Y §4
     (`contrato:1046`): *«No cruzan ... fechas de cobro»*.
2. **Qué pide el owner.** Aniversario: alta del 15, renueva siempre el 15, también en anual. Del
   29 al 31, el último día del mes. Si la fuente no es suscripción, cuenta el día que arrancó.
3. **Qué cambiar.**
   - **Log**: 📌 en `DEC-ENT-002` cerrando la implicación 2 (aniversario, con la regla del 29-31 y
     el huso del mercado de la implicación 4).
   - **Choque 1, con `V/11` §4.3.** El artifact (`vivo:154`) dice *«En la prueba, una cortesía o un
     regalo, el día que cuenta es aquel en que arrancó esa fuente»*, que se lee como si la cuota del
     trial se renovara. El repo dice que no se renueva. **Recomiendo mantener el repo** (el motivo
     sigue en pie) y corregir el artifact: la regla del arranque vale para cortesía y regalo, no
     para la prueba.
   - **Choque 2, con el contrato.** Verticales es dueña de la cuota (`V/15`) y no sabe cuándo
     arrancó una suscripción. Hace falta un dato nuevo en la fuente: **`desde`**, el instante en
     que esa fuente empezó a cubrir. No es una fecha de cobro (es la del alta, no la de ningún
     pago), pero hay que declararlo en §4 como se declaró `cobrada`. Pasa de siete campos a ocho;
     el censo de consumidores (§2.1) gana la fila `desde` (su único lector: la ventana de cuota de
     V3); el censo de emisores (§3) gana *«cambia `desde`»*; la regla de vigilancia §4.2 lo nombra.
     La implementación de arranque lo devuelve para `TRIAL` y `BASE`.
   - **Modelo**: una fila de ventana de cuota por persona, vertical y clave medida
     (`desde`, `hasta`, consumo), en `V/02`. **La ventana nueva se abre sólo cuando vence la
     actual**, leyendo el ancla en ese momento. Así un cambio de plan que recrea la suscripción
     (`DEC-SUB-005`/`-007` cancelan y recrean, o sea `desde` nuevo) no reinicia el consumo a mitad
     de mes: el ancla nueva rige desde la renovación siguiente.
   - **Unidades**: V3 (resolución y ventana), V4 (`desde` en la de arranque), B4 (`desde` en la
     real). Test: el alta del 31 renueva el 28/29 de febrero y el 31 de marzo; anual renueva
     mensual; cambio de plan no regala cuota.
   - **Linear**: decisión en HOS-1353; nota en HOS-1354 por el campo nuevo.
4. **Sub-preguntas.**
   1. **Cuando Juan cambia de plan y la suscripción se recrea, ¿qué pasa con la cuota del mes?**
      - (a) **La ventana en curso sigue hasta su fin y el ancla nueva rige desde la siguiente.**
        Costo: la ventana guarda su propio fin. Riesgo: ninguno de plata.
      - (b) **Se reinicia en el acto con el ancla nueva.** Costo: nada. Riesgo: regala hasta una
        cuota por cambio de plan.
      - (c) **El ancla es de la persona, fija para siempre** (la del primer título que tuvo en la
        vertical). Costo: una columna más; no necesita `desde` en el contrato si verticales la
        anota al ver la primera fuente, pero un aviso perdido la corre un día.
      - **Recomiendo (a).** Juan se suscribió el 15 y gasta 80 de 100 consultas de chat; el 20
        sube a Premium (fila nueva, `desde` = 20). Con (a) la ventana en curso sigue hasta el 15 del
        mes siguiente con el cupo de Premium menos lo ya gastado, y desde ahí renueva siempre el
        20. Con (b) el 20 arranca una ventana nueva con el cupo entero.
   2. **Si Juan tiene plan y un complemento de «+50 consultas», ¿cuál es el ancla?** Recomiendo:
      la del título que lo cubre; el complemento suma a la ventana del título (es la regla de
      *«el complemento no habilita solo»*). Alternativa: ventanas separadas por fuente, más código.
5. **Tamaño.** Mediano (una regla, un campo del contrato y sus espejos, una tabla).

---

## C5 · «Quien paga sin publicar y le vuelve la ficha sola»

1. **Qué dice hoy el repo.** `V/docs/03-maquinas-de-estado.md:58` (`T8`, con la extensión
   *«o le volvió una ficha por `PB3` o `PB7` bajo un título que paga»*), `:244-271` (§ *«La vuelta
   bajo un título que paga cuenta para `T8`»*, `R15`), `:582` (`PB3` evalúa `T8` adentro,
   `N-B-01`), `:1286-1290` (residuo declarado), `V/docs/21-migracion.md:447-455` (NO cierra:
   *«Quien contrata sin publicar paga desde el primer cobro»*).
2. **Qué pide el owner.** Sólo una explicación.
3. **Qué cambiar.** Por C5 sola, nada. **Pero el artifact ya sacó este caso borde** (estaba en
   `v1:272` y en la tabla `v1:582-585`; en `vivo` no está), y conserva la frase de riesgo
   `vivo:2038`. El repo tiene que decidir lo mismo, y depende de C12: su único sujeto era **el
   dueño del corte que contrata por teléfono sin publicar**. Con C12 ese dueño amanece en
   `TRIAL_ACTIVE`, y al contratar convierte por `T2`, como cualquiera. Ver C12 punto 3 para las
   condiciones en que R15 se puede borrar.
4. **Sub-preguntas.** Van en C12 (sub-pregunta 2).
5. **Tamaño.** Chico por sí; lo que se borra se cuenta en C12.

---

## C6 · «Ningún rol da capacidades»

1. **Qué dice hoy el repo.** `V/docs/17-autorizacion.md:590-596`: *«Y ningún rol es una fuente
   ... El cargador del código de hoy, que le da a `SUPER_ADMIN`, `ADMIN`, `EDITOR` y
   `CLIENT_MANAGER` el conjunto entero con limits en `-1` ... se retira»*. Guard: segunda mitad de
   `G6` (`V/spec.md:401`). En hospeda2 ese cargador es `isStaffBypassRole` y
   `buildStaffUnlimitedResult` en `apps/api/src/middlewares/entitlement.ts:47,455,779-791`.
2. **Qué pide el owner.** Explicación. Sin cambio de regla.
3. **Qué cambiar.** Nada en el diseño. Una consecuencia que conviene tener a la vista para el
   corte: las cuentas de staff que hoy «ven todo habilitado» dejan de verlo el día del corte; las
   dos cuentas del owner quedan cubiertas por los `permanent_grant` del paso 3b. Si hay otra cuenta
   de staff con fichas propias, necesita un regalo o un plan: medirlo en la re-verificación de
   `B/21` §1.3 (hoy no se cuenta).
4. **Sub-preguntas.** Ninguna.
5. **Tamaño.** Chico.

---

## C7 · «Entrar como» el cliente, en una versión posterior

1. **Qué dice hoy el repo.** Nada sobre operar la cuenta de otro, salvo la acción 15 (editar
   contenido ajeno sin publicar): `D/nucleo/08-auditoria-y-observabilidad.md:166`. Y dos reglas que
   lo cierran **también para el futuro**: `NUCLEO/08:187-190`, *«Dos cosas que ninguna fila de esta
   tabla hace, **ni las que se agreguen**: un acto de un actor distinto del dueño nunca es «el dueño
   publica», así que no ejerce el evento de activación ni dispara `T1`»*; y `DEC-AUTH-003`
   (`log:6199`): *«el admin edita el contenido de una ficha ajena con una acción propia, y nada
   más»*. El modelo de dos identidades existe: `V/17` §3.2 (`:322-400`).
2. **Qué pide el owner.** Que se agregue después, registrado como hecho por el admin en nombre del
   cliente.
3. **Qué cambiar.**
   - **Hoy**: agregarlo a los *«NO cierra»* de `V/17` y `V/spec.md` §7 como pendiente declarado,
     con su condición (actor admin, sujeto cliente, nunca `actor = sujeto` en el registro).
   - **Choque a resolver cuando se diseñe**: *«ni las que se agreguen»* de `NUCLEO/08:187`. Si el
     admin publica en nombre del cliente, o arranca la prueba del cliente (y entonces esa frase
     cae), o no la arranca (y entonces el admin no puede publicar la ficha de quien no tiene plan).
     No se decide ahora; se deja escrito que esa frase se reabre.
   - Nada de unidades ni guards en esta versión. El modelo de auditoría ya soporta actor ≠ sujeto.
4. **Sub-preguntas.** Ninguna para esta versión. Para cuando se diseñe: ¿publicar en nombre de
   Juan le arranca la prueba a Juan? (recomendaría sí, con el consentimiento de Juan registrado,
   porque si no el servicio no sirve para quien más lo necesita).
5. **Tamaño.** Chico (texto).

---

## C9 y C11 · Todo plazo en días o meses se configura desde el panel

C11 repite C9 para 90 y 180. Se tratan juntos.

1. **Qué dice hoy el repo.**
   - 90/180 son números fijos del PDR §25, con su reloj en `listing.inactiva_desde`
     (`V/docs/03-maquinas-de-estado.md:583,588`). En el corpus de verticales y núcleo aparecen
     **152 veces**.
   - Algunos plazos ya son configuración, pero **de dos clases distintas**:
     - **por versión de plan, inmutables** (se cambian publicando otra versión): días de prueba,
       días de gracia, si permite pausa (`DEC-TRIAL-003`, `DEC-SUB-002`, `DEC-ARCH-001`);
     - **sueltos, sin tabla**: el `N` de `PB5` (`V/03:584`, *«N es configuración, validada menor
       que 6 meses»*), la espera de postulación de Partner y el *«N días»* de atrasada
       (`V/docs/18-partner.md:209,234`), el techo de días de prueba por vertical (`V/11` §3).
   - **Dos guards comparan valores de configuración en CI**: `G-R5` (tope de pausa contra el día
     180) y `G-R5-B` (`N` de `PB5` < 6 meses), `V/docs/20-testing.md:66-67`.
2. **Qué pide el owner.** El súper admin configura desde el panel todo plazo en días o meses; el
   panel rechaza valores que se contradicen; un cambio no adelanta una fecha ya anunciada; cada
   cambio se registra. Fuera: los técnicos y los de Mercado Pago o la ley.
3. **Qué cambiar.**
   - **Log**: decisión nueva (`DEC-DATA-006` o similar) con las cuatro reglas, y 📌 en
     `DEC-DATA-001` (los 90/180 pasan a ser valores iniciales).
   - **Modelo** (`NUCLEO/02` y `V/02`, `B/02`): una tabla de **plazos versionados** (clave,
     valor, unidad, quién, cuándo, valor anterior), con el catálogo de claves en código (como el de
     entitlements) y los valores en la base. Cada mitad es dueña de sus claves: retención, `PB5`,
     avisos de retención, techo de prueba, campaña de prueba y Partner son de verticales; ventana
     de alta, límites de pausa, aviso de migración (C15) y cronograma de cobro son de billing.
   - **La regla que más cuesta: *«un cambio nunca adelanta una fecha ya anunciada»*.** Hoy el día
     90 se calcula en cada corrida como `inactiva_desde + 90`, así que acortar el plazo adelanta
     todo lo que ya se avisó. Para cumplirla, cada reloj tiene que **guardar el plazo con el que
     arrancó** (o la versión de plazos vigente al arrancar), y alargar tiene que beneficiar a
     todos: la lectura queda `max(plazo guardado, plazo vigente)`. Toca `PB4`, `PB5`, `PB9`, los
     tres avisos de retención, la campaña de la prueba y la de recuperación.
   - **Guards que dejan de poder correr en CI**: `G-R5`, `G-R5-B` (y las condiciones de catálogo
     de `G-R3` si N1 se aplica) comparan valores que ahora vive en la base y se editan en
     producción. Pasan a ser **validaciones del panel** (la que rechaza lo contradictorio), y el
     guard de CI queda, si queda, sobre los datos de desarrollo. `G-R5` además muere por C14.
   - **Validaciones cruzadas mínimas**: archivar < borrar; `PB5` < borrar; cada aviso antes de su
     hecho; gracia < ciclo más corto que se ofrece; aviso de migración ≥ mínimo legal del aumento.
   - **Superficie**: una pantalla de plazos en el panel (V8 y B13), y una acción administrativa
     nueva en `NUCLEO/08` §3, *«cambiar un plazo»*, con permiso propio de súper admin y auditoría.
   - **Texto**: las 152 menciones pasan a decir *«el plazo de archivado (90 días al inicio)»*.
     Casi todo es reemplazo, pero hay que revisarlo a mano: varias frases razonan con la
     aritmética (*«4 pausas-mes ≈ 120 días contra los 180»*, `log:3431-3435`) y esas caen.
   - **Linear**: decisión en HOS-1352 (es de las dos mitades).
4. **Sub-preguntas.**
   1. **La pregunta del owner: ¿algún plazo técnico también?** Los técnicos son: 15 minutos del
      caché, 26 horas del vigía del proceso diario, reintentos de 3 días, los 30 minutos de espera
      del corte. Opciones: (a) ninguno configurable; (b) sólo verlos en el panel, sin editarlos;
      (c) todos. **Recomiendo (a)**: cada uno protege un invariante (el de 15 minutos es el techo
      de un permiso revocado que sigue vivo) y cambiarlo sin entender el porqué es exactamente la
      optimización peligrosa. Juan no los ve nunca.
   2. **¿Cómo se guarda el plazo en cada reloj?** (a) cada reloj guarda el valor al arrancar;
      (b) guarda la versión de plazos vigente; (c) no se guarda y se acepta que acortar adelante
      fechas (contra lo pedido). **Recomiendo (b)**: una columna por reloj en vez de tres, y el
      historial ya existe. Juan recibió el aviso de que su ficha se borra el 10 de marzo; el admin
      baja el plazo de 180 a 120; la versión anclada al reloj de Juan sigue diciendo 180.
5. **Tamaño.** Grande (tabla nueva, relojes que cambian de forma, dos guards que se mudan al
   panel, una acción administrativa).

---

## C10 · Moderación en dos niveles

1. **Qué dice hoy el repo.** Un solo nivel. `V/docs/03-maquinas-de-estado.md:589`, `PB10`:
   `DRAFT`, `PUBLISHED`, `UNPUBLISHED_BY_BILLING` o `ARCHIVED` → `MODERATED`. `:590`, `PB11`: la
   única salida, a `DRAFT`. La presencia de Partner tiene un bit de moderación (`V/18` §1.6). Hay 41
   menciones de `MODERATED` en el corpus.
2. **Qué pide el owner.** A elección del admin y cambiable: pedir arreglo sin bajar (marca al
   costado, no estado) o bajar hasta que se arregle. Listado de pendientes. Pregunta: al levantar
   la baja, ¿publicada si está cubierto, o borrador?
3. **Qué cambiar.**
   - **Log**: decisión nueva de moderación (supera en parte a la de la FASE 8 completa,
     `F-8CA2-004`, que creó `PB10`/`PB11`).
   - **Modelo** (`V/02`): una entidad nueva, **el pedido de arreglo**, pegada a la ficha o a la
     presencia de Partner: motivo, fecha sugerida (opcional), estado (abierto, el dueño avisó que
     corrigió, cerrado), quién y cuándo. Mismo patrón que la marca de conciliación de billing
     (`DEC-CONC-003`): una marca, no un estado.
   - **Máquina** (`V/03` §9): `PB10` sigue; nace una transición **de `MODERATED` a pedido de
     arreglo** (bajar el nivel). Y la salida de `MODERATED` se redefine según la sub-pregunta 1.
   - **Operación del dueño**: *«avisé que corregí»*, que pasa por los siete pasos como cualquier
     escritura sobre lo propio.
   - **Acción administrativa** `NUCLEO/08` §3: la fila *«moderar o levantar»* pasa a *«pedir
     arreglo, bajar, cambiar de nivel o levantar»*, sigue siendo **una** acción con un permiso.
   - **Avisos** (`NUCLEO/07` §6): pedido de arreglo, cambio de nivel, levantada. Esto **cierra la
     mitad del ítem del §12** *«tampoco tienen aviso el levantar una moderación»* (ver N7).
   - **Invariante nuevo, sin guard nuevo**: ningún proceso automático baja una ficha por
     moderación. Ya lo cubre *«los procesos automáticos no ejecutan acciones administrativas»*.
   - **Superficies**: listado en el panel (antigüedad, fecha sugerida vencida, dueño avisó), y en
     Mi Cuenta el pedido con su motivo. `V/19`, V8.
   - **Retención**: el pedido no toca el reloj (la ficha sigue publicada y cubierta). Bajar a
     `MODERATED` sigue como hoy; el hecho de *«levantar reinicia el reloj»* se mantiene.
   - **Billing**: nada. `admiteDestaque` sigue siendo *«ni `PURGED` ni `MODERATED`»*
     (`contrato:1157`), así que una ficha con pedido de arreglo sigue aceptando un destaque.
4. **Sub-preguntas.**
   1. **La del owner: al levantar la baja, ¿vuelve publicada o a borrador?**
      - (a) **A borrador**, como hoy (`PB11`). Costo: nada. Riesgo: Juan tiene que volver a
        publicar; si su prueba venció y no paga, no puede.
      - (b) **Vuelve a donde estaba**: si antes de moderarla estaba publicada o bajada por billing,
        nace `UNPUBLISHED_BY_BILLING` y `PB3` la sube en el acto si está cubierto y tiene cupo; si
        era un borrador, vuelve a borrador. Costo: `PB10` guarda de dónde venía (la misma idea que
        el evento de `PB4` para `PB7`). Riesgo: bajo; reusa `PB3`, no inventa un camino de
        publicación.
      - (c) **Elige el admin** en cada caso. Costo: una opción más en el panel. Riesgo: dos
        admins deciden distinto lo mismo.
      - **Recomiendo (b)**, y que la salida *«bajar el nivel a pedido de arreglo»* use la misma
        regla: así las dos salidas de `MODERATED` terminan igual y no hay dos caminos que mantener.
        Juan tenía la cabaña publicada y pagando; se la bajaron por una foto; la cambia, avisa, el
        admin levanta: con (b) vuelve sola; con (a) tiene que entrar a publicarla.
   2. **¿Qué puede hacer Juan sobre su ficha `MODERATED`?** (es un ítem del §12, ver N7). Si no
      puede editarla, no puede arreglar lo que le piden. Recomiendo: verla, exportarla y editarla;
      no publicarla; y **sí** borrarla (`PB12` desde `MODERATED`), porque es suya.
5. **Tamaño.** Mediano/grande (una entidad, una transición, una operación del dueño, avisos,
   panel).

---

## C12 · El día del corte, las fichas a la vista nacen publicadas y la prueba arranca ese día

1. **Qué dice hoy el repo** (todo en sentido contrario).
   - **R1 / `G1-1`**, elegida opción 1 de tres: `D/28-fase-9-vuelta-1/01-G1-el-corte-y-la-ficha-vieja.md:685-707`.
     La opción 3 de esa misma tabla es **exactamente C12**, y el análisis ya le había puesto
     precio: *«una escritura nueva del corte con hash, reloj y campaña, contra «el corte no escribe
     filas de trial». Riesgo: el reloj corre aunque la llamada tarde, sólo una ficha entra en el
     cupo del trial»*.
   - `V/docs/21-migracion.md:156-196`: tabla de nacimiento, `L7` y `L8` (lo que estaba a la vista)
     nacen `UNPUBLISHED_BY_BILLING`.
   - `V/21:228-240`: *«no se siembra nada»*; el camino que se les nombra es *«publicar su ficha»*.
   - `V/21:287-296`: **§ «Por qué no sembrarles un trial, que era la alternativa»**, que argumenta
     contra lo que el owner eligió ahora.
   - `V/21:319-322`: *«Del lado de verticales el corte no escribe ninguna fila nueva»*.
   - `log:5882-5971`, `DEC-MIG-005`, punto 3: *«El corte no siembra trials consumidos»*. Sigue
     siendo verdad literal (no se siembran consumidos), pero ahora se siembran **activos**.
   - `V/03:580`, `PB1`: desde `UNPUBLISHED_BY_BILLING` *«Es el camino ... de la cartera del
     corte»*.
   - `V/03:58` y `:244-271`, `T8` y R15: existen por el dueño del corte que contrata sin publicar.
   - `corte:200-235`: el guion (*«el día X queda en pausa»*, *«tocar publicar»*); paso 4c
     (revalidar todas las fichas nacidas `UNPUBLISHED_BY_BILLING`, más 22 purgas de destino).
   - `V/spec.md:420-428` (§6): todavía dice *«las publicadas de Alojamiento las baja la primera
     corrida del reconciliador»*, anterior a R1. Ya estaba viejo.
   - `G1-4` (`D/28.../01:752-773`, `corte:229`): lo pagado en el viejo se pierde y la prueba lo
     compensa. No cambia.
2. **Qué pide el owner.** Las fichas a la vista nacen como recién creadas y publicadas; la prueba
   del dueño arranca ese día. Pregunta: con varias a la vista, ¿quedan todas publicadas?
3. **Qué cambiar.**
   - **Log**: decisión nueva `DEC-MIG-006` que **supera a `G1-1`** (R1) y precisa `DEC-MIG-005`
     punto 3: *«el corte no siembra trials consumidos; siembra uno activo a cada dueño con una
     ficha a la vista, en esa vertical»*. `G1-1` no tiene `DEC` propio: vive en informes de fase
     y en capítulos, así que el SUPERSEDED se escribe en `DEC-MIG-006` citándolo.
   - **Escritura nueva del corte, en la migración del paso 3**: por cada `(dueño, vertical)` con al
     menos una `L8`, una fila de `trial` en `TRIAL_ACTIVE`, reloj desde el instante del corte, plan
     de trial derivado, **seudónimo del correo calculado con la misma función que `T1`**, y la
     campaña previa agendada. Es *«una fila de trial que ninguna transición produce»*, lo mismo que
     el rastro que la FASE 9 completa tachó (`V/21:393-396`): los guards que enumeran los
     escritores de `trial` y de `inactiva_desde` (`G-R4`, `G-R6-B`) tienen que admitir este
     escritor por su lugar, como admiten la escritura `C`.
   - **Tabla de nacimiento** (`V/21` §2.4): `L8` → `PUBLISHED` **una por dueño y vertical** (la de
     `created_at` más viejo, que es el orden de vuelta ya escrito), el resto de sus `L8` →
     `UNPUBLISHED_BY_BILLING`. `L7` y `L5` (bajadas por el cobro viejo, no a la vista) → ver
     sub-pregunta 2. `L1`-`L4`, `L6` sin cambio.
   - **Precondiciones nuevas del corte** (`corte` paso 0 y paso 2):
     - la lista de proveedores del seudónimo tiene que estar **cerrada y medida antes del corte**
       (Proton, Yahoo, Gmail/iCloud): la primera prueba del sistema nuevo ya no es la del primer
       cliente nuevo, es la del corte. Esto convierte un ítem declarado del §12 en un gate;
     - recuento de **dos cuentas con el mismo seudónimo en la misma vertical** entre los dueños a
       la vista: la restricción única rechaza la segunda y la migración del paso 3 se cae. Si da
       más de cero, se decide antes, a mano.
   - **Las dos cuentas del owner**: la migración les escribe trial (tienen `L8`) y el 3b les
     escribe el grant: `T2` convierte, la prueba queda consumida. Inofensivo, son suyas y
     *«regenerables»*; se declara. Alternativa: excluirlas en la migración por la lista del 3b.
   - **Guion** (`corte:221-235`): puntos 1 y 2 se reescriben (el artifact ya lo hizo,
     `vivo:1708-1711`). Punto 3 (`G1-4`) sin cambio.
   - **Paso 4c**: sólo las fichas que nacen fuera del sitio (las `L8` de más, `L1`, y `L5`/`L7` si
     aplica). Las 22 purgas de destino, sólo si algún dueño tenía más de una a la vista (el
     artifact ya lo dice, `vivo:1826-1838`).
   - **Máquinas**: `PB1` (`V/03:580`) pierde la mención *«la cartera del corte»* y **conserva** la
     rama desde `UNPUBLISHED_BY_BILLING` por `C5` (quien quedó en `PRE_TRIAL` por un primer cobro
     rechazado). **R15 se puede borrar entero** (la extensión de la guarda de `T8`, la evaluación
     de `T8` dentro de `PB3`/`PB7` de `N-B-01`, el residuo `V/03:1286-1290` y el NO cierra
     `V/21:447-455`) **si ninguna ficha del corte nace `UNPUBLISHED_BY_BILLING` bajo un dueño en
     `PRE_TRIAL`**. Razonamiento: fuera del corte, a `UNPUBLISHED_BY_BILLING` sólo se llega desde
     `PUBLISHED`, y a `PUBLISHED` desde un `PB1` (que ya ejerció el evento) o desde una vuelta; así
     `T8` siempre encuentra el evento ejercido y no necesita la vuelta. Eso depende de la
     sub-pregunta 2.
   - **Casos borde**: cae *«la cartera que contrata sin publicar»* (R15) si se cumple lo anterior;
     el de *«fichas de antes del lanzamiento en el orden de vuelta»* pasa a decidir también cuál
     queda publicada; nace *«dos cuentas con el mismo seudónimo en la cartera»* (gate del corte);
     el riesgo *«el reloj corre aunque la llamada tarde»* se declara (lo acota el aviso previo).
   - **Textos que quedan viejos**: `V/21:86-99`, `:156-167`, `:221-240`, `:287-310`, `:319-322`;
     `V/spec.md:420-428`; `corte:200-205`; `V/03:580`; la frase de riesgo del artifact
     `vivo:2038` (*«Un cliente que contrata sin publicar paga desde el primer cobro»*), que ya no
     describe al cliente del corte.
   - **Tests** (V4, V6, la herramienta del corte): la migración sobre una base con `L1`-`L8`, un
     dueño con tres `L8` (una publicada, dos abajo, un trial), un dueño sólo con borradores (sin
     trial), repetir la migración no escribe dos trials, contratar durante esa prueba convierte por
     `T2`.
   - **Linear**: decisión en HOS-1352; actualizar el procedimiento del corte en su issue.
4. **Sub-preguntas.**
   1. **La del owner: con varias fichas a la vista, ¿quedan todas publicadas durante la prueba?**
      - (a) **Una sola**, la cargada hace más tiempo; las demás vuelven al contratar. Es lo que ya
        dice el artifact (`vivo:1785`). Costo: nada, es la regla de cualquier prueba. Riesgo: el
        dueño ve bajar fichas que tenía arriba.
      - (b) **Todas**, sólo para la prueba del corte. Costo: un ajuste por fila de trial
        (*«cupo de fichas de esta prueba = las que tenía a la vista»*), porque si no el
        reconciliador de excedentes las baja al día siguiente. Riesgo: una excepción a
        *«clientes nuevos»* y a la protección de *«una sola ficha durante la prueba»*.
      - (c) **Todas, hasta la llamada**: se publican todas y el excedente se aplica con aviso a los
        N días. Costo: una ventana con fecha y su aviso. Riesgo: medio, más mecanismo que (b).
      - **Recomiendo (a)**, y medir antes cuántos dueños tienen más de una a la vista (hoy son
        doce alojamientos y no está contado por dueño). Si es uno o dos, se les dice en la
        llamada. Juan tiene dos cabañas publicadas: con (a), el día del corte queda arriba la que
        cargó primero; la otra vuelve sola el día que contrata.
   2. **¿Cómo nacen las fichas `L5`/`L7` (bajadas por el cobro viejo, no a la vista)?**
      - (a) **`DRAFT`.** Costo: el dueño las publica a mano después de contratar. Riesgo: bajo.
        Gana: R15 se borra entero (arriba).
      - (b) **`UNPUBLISHED_BY_BILLING`**, como hoy. Costo: R15 se queda, para el dueño que sólo
        tenía `L5`/`L7`. Riesgo: ninguno nuevo.
      - (c) **Como si estuvieran a la vista** (publicadas y con prueba). Riesgo: le publica a
        alguien una ficha que el sistema viejo tenía bajada.
      - **Recomiendo (a)**, sujeto a medir la población (probablemente cero). Juan tenía una
        cabaña bajada en el viejo porque no pagaba: nace en borrador, y si quiere publicarla, la
        publica y le arranca la prueba como a cualquier cliente nuevo.
5. **Tamaño.** Grande (una escritura nueva del corte con dos gates, la tabla de nacimiento, cinco
   capítulos y el procedimiento del corte), aunque **simplifica** R15 si se elige (a) en la 2.

---

## C14 · La pausa pedida por el dueño detiene el reloj de retención

1. **Qué dice hoy el repo.** `log:3386-3456`, `DEC-DATA-002`: el reloj **sí corre** durante la
   pausa y se reinicia al reanudar, porque *«tomado al pie de la letra, «el reloj no corre durante
   la pausa» exige que verticales vea la pausa; y una `PAUSED` por `CUSTOMER_REQUEST` no emite
   ninguna fuente, así que sería el segundo hecho cruzando la frontera que `DEC-TRIAL-008` rechazó»*.
   La seguridad sale de una desigualdad (tope de pausa ≈ 120 días < 180), vigilada por `D16` y el
   guard `G-R5` (`V/docs/20-testing.md:66`, `:219-229`; `V/02:881`). Contrato §4
   (`contrato:1063-1080`): *«Esta frontera no se vuelve a abrir por este caso»*.
2. **Qué pide el owner.** Mientras la pausa pedida por él dura, sus fichas no se archivan, no se
   borran ni reciben avisos de retención; al volver, el reloj se reinicia. Se saca la validación
   pausa contra borrado.
3. **Qué cambiar.**
   - **Choque explícito**: posición del diseño (`DEC-DATA-002`, `DEC-TRIAL-008`: la pausa no
     cruza); posición del owner (el reloj se detiene de verdad). Gana el owner, y hay que abrir la
     frontera **lo mínimo**.
   - **Contrato**: una pregunta nueva de la dirección de ida, que contesta billing y pregunta
     verticales (la misma forma que tenía `finDeServicio`, que C8 saca):
     `retenciónDetenida(user, vertical) → sí | no`, *«sí»* sólo con una suscripción `PAUSED` por
     pedido del cliente. **Sus únicos lectores son `PB4`, `PB5`, `PB9` y los tres avisos de
     retención**, que ya releen `cubierto` en el momento de ejecutar (`contrato:956-962`) y ahora
     releen también esto. No va en `fuentes` ni en `cubierto`, así que la máquina de trial no lo ve
     y `DEC-TRIAL-008` queda intacta en lo que protegía (que nadie escriba reglas de producto sobre
     la cobranza). La de arranque contesta `no`.
   - **No hace falta reloj congelado**: como los lectores preguntan al ejecutar, un aviso perdido
     no importa. Al reanudar, `cubierto` pasa a verdadero y el hecho 2 reinicia el reloj, que ya
     existe.
   - **Log**: decisión nueva que **supera** la parte *«el reloj sí corre»* de `DEC-DATA-002` y
     precisa `DEC-TRIAL-008` (el segundo hecho cruza, con un solo tipo de lector).
   - **Lo que se borra**: el invariante `D16`, el guard `G-R5` (su fila en `V/20` §2 y su
     asignación a `B8`, `V/descomposicion.md:252-260`), el párrafo aritmético de `DEC-DATA-002`.
     Nace el guard que el artifact ya nombra (`vivo:1693`): *«el reloj no avanza mientras hay una
     pausa del dueño»*, que se puede formular como *«todo lector de `inactiva_desde` que decide
     archivar, borrar o avisar consulta `retenciónDetenida`»*.
   - **Límites de pausa** (C9): quedan libres de la cota contra el borrado.
   - **Unidades**: V9 (lectores), V4 (respuesta de arranque), B4 (la real), B8 (pierde `G-R5`).
4. **Sub-preguntas.**
   1. **¿Por dónde cruza el dato?** (a) la pregunta aparte de arriba; (b) un campo nuevo en la
      respuesta de `cobertura`, visible para todos sus consumidores; (c) billing escribe en
      verticales «reloj detenido» al pausar y al reanudar. **Recomiendo (a)**: un solo tipo de
      lector, sin estado nuevo, sin aviso que se pueda perder. (b) invita a que otra regla lo lea;
      (c) es una segunda escritura de billing en verticales y un dato que se desincroniza. Juan
      pausa tres meses: el día que su ficha cumpliría 90 días, `PB4` pregunta, billing contesta
      *«sí»*, no archiva; Juan vuelve, `cubierto` pasa a verdadero, el reloj arranca de cero.
5. **Tamaño.** Mediano/grande (una entrada del contrato y sus censos, una decisión que supera
   otra, un guard que muere y otro que nace).

---

## N1 · El archivo de configuración de planes desaparece: todo en la base

1. **Qué dice hoy el repo y el código.**
   - **Diseño**: ya lo pide. `D/nucleo/02-modelo-de-datos.md:48-78`, §1.2-1.3: *«toda
     configuración comercial viene de la base; el catálogo de claves es código verificado contra
     la base ... Ningún valor, ningún precio, ninguna asignación»*. El artifact lo repite
     (`vivo:78`).
   - **Pero el diseño no dice cómo llegan los valores a la base**. El corte dice *«las
     data-migrations del catálogo nuevo»* (`corte` paso 3a, `:129`) y el inventario de guards dice
     que `check-seed-dual-write.sh` **sobrevive** (`D/15-fase-9/04-inventario-de-guards.md:93`).
     **Y el catálogo de acciones administrativas no tiene ninguna para editar el catálogo**:
     `NUCLEO/08` §3 no nombra *«publicar una versión de plan»*, *«fijar precios»*, addons ni
     promos, aunque `B/10` §3.3 dice que retirar *«es publicar una versión nueva»*. Nadie tiene el
     permiso de hacerlo.
   - **Código de hoy**: `packages/billing/src/config/` son 11 archivos, **3378 líneas**
     (`plans.config.ts` 1507, con `monthlyPriceArs`, `trialDays`, entitlements y limits;
     `trial-plans`, `addons`, `promo-codes`, `commerce-*`, `partner-tier-plans`, `limits`,
     `entitlements`). `ALL_PLANS` lo leen el seed (`required/billingPlans.seed.ts`,
     `trialPlans.seed.ts`, `commercePlan.seed.ts`, `testUsers.seed.ts`), la API
     (`subscription-checkout.service.ts`, `addon.checkout.ts`, `cron/jobs/apply-scheduled-plan-changes.ts`),
     el admin y `config-drift-check.ts`. El middleware de entitlements ya lee de la base
     (`planService.getBySlug`). **11 data-migrations de seed importan `@repo/billing`**, 9 de ellas
     la config (`0004`, `0005`, `0045`, `0061`, `0073`-`0075`, `helpers/trialPlanMigration.ts`...).
     `scripts/check-seed-dual-write.sh:81-155` vigila esos archivos de config como datos de seed.
2. **Qué pide el owner.** Que no exista ese archivo: 100 % de la configuración de planes en la base.
3. **Qué cambiar.**
   - **Log**: 📌 al invariante 15/16 (`NUCLEO/02` §1.2): *«no existe archivo de valores, ni como
     baseline de seed; la fuente de los valores de producción es el panel»*. Y decisión de cómo
     nace el catálogo el día del corte (sub-pregunta 1).
   - **Acciones administrativas nuevas** (`NUCLEO/08` §3): *«publicar una versión de plan»*
     (incluye retirar y deshacer; de verticales, V2), *«fijar el precio de un ciclo»* (de billing,
     B2; sobre clientes existentes es un aumento y va por `DEC-MP-002`), *«publicar una versión de
     complemento»*, *«crear o cerrar un código promocional»*, y *«cambiar un plazo»* (C9). Súper
     admin, auditadas, con confirmación que dice qué cambia (la del precio mueve plata).
   - **Validaciones que hoy son guards de CI y pasan a ser del panel**: `G3` en su dirección
     *«clave de la base que no está en el catálogo»* (mejor como restricción de la base: FK o
     `CHECK` contra el enum), `G-R3` (piso y pre-trial sin claves comerciales, `V/20:297,333`),
     rango único por vertical (`V/10:112`), y que cada plan tenga exactamente una versión vigente.
     **Sin esto, un error de carga en el panel le regala una capacidad paga a toda la plataforma y
     ningún guard lo ve**, que es el caso borde que el artifact ya describe (`vivo:171`). El guard
     de CI puede quedar sobre los datos de desarrollo.
   - **Superficies**: editor de catálogo en el panel (V8 para planes y claves; B13 para precios y
     promos). Hoy no está en ninguna unidad.
   - **Seed**: los fixtures de planes para desarrollo y pruebas pasan a ser **datos de
     demostración** (exentos del dual-write), porque en producción los edita el panel y un
     baseline en archivo se desalinearía el primer día. Cambian `check-seed-dual-write.sh` (sale la
     rama de config de billing) y la regla del `CLAUDE.md` raíz, que nombra *«a billing
     plan/limit/entitlement»* como sujeto del dual-write. Los 18 usuarios de prueba siguen
     funcionando con esos fixtures.
   - **Las 11 data-migrations que importan la config** no compilan cuando la config se borra. Como
     el corte retira las tablas de billing viejas, esas migraciones quedan sin sujeto: se congelan
     (sus valores se escriben adentro) o se retiran con un squash del ledger (se cruza con C3,
     sub-pregunta 1).
   - **Lo que se borra**: `packages/billing/src/config/**` entero (3378 líneas),
     `utils/config-drift-check.ts`, `validation/config-validator.ts`, los seeders `required/billing*`
     y `trialPlans`/`commercePlan`/`partnerPlan`. Es filtro 1 de FASE 5 (el sujeto muere).
   - **Lo que queda en código** (y hay que confirmarlo, sub-pregunta 3): el catálogo de **claves**
     de entitlement y limit con sus cuatro atributos (`V/15`), porque hay código que las respeta.
4. **Sub-preguntas.**
   1. **¿Cómo nace el catálogo de producción el día del corte?**
      - (a) **Una data-migration única del corte**, con los valores, que no se edita nunca más; de
        ahí en adelante, sólo el panel. Costo: un archivo con valores, ejecutado una vez. Riesgo:
        bajo; es reproducible en staging y revisable.
      - (b) **El súper admin lo carga a mano en el panel** entre el despliegue y la apertura de
        altas (paso 5), verificado por las validaciones del panel. Costo: ninguno de código; tiempo
        del corte. Riesgo: medio, un error de tipeo en producción el día más delicado.
      - (c) **Exportar desde el panel de staging e importar en producción** con una herramienta.
        Costo: la herramienta. Riesgo: bajo, pero es código nuevo para una vez.
      - **Recomiendo (a)**, dicho con la tensión a la vista: es un archivo con valores, pero es
        historia (se ejecuta una vez y nunca más es fuente de nada), no configuración. Si el owner
        lo lee como el archivo que no quiere, (c). Juan no ve la diferencia: el día del corte la
        página de precios muestra lo mismo por cualquiera de las tres.
   2. **¿Los fixtures de desarrollo son datos de demostración, fuera del dual-write?** Recomiendo
      sí; la alternativa (dual-write) obliga a una data-migration por cada cambio de un plan que en
      producción ya se cambia por el panel, o sea dos fuentes de verdad.
   3. **¿El catálogo de claves (nombres de capacidades y límites) sigue en código?** Recomiendo
      sí: si una clave no tiene código que la respete, cargarla en el panel no hace nada.
5. **Tamaño.** Grande (acciones y superficies nuevas, validaciones que se mudan de CI a la base, el
   seed, el guard de dual-write y 3378 líneas que se borran).

---

## N6 · La comunicación verticales-billing pasa por un único lugar con interfaz clara

1. **Cómo es hoy.**
   - **En el diseño** (`contrato`, `DEC-ARCH-006` en `log:2291`):
     - **Qué cruza, de billing a verticales**: la pregunta `cobertura(user, vertical)` con sus dos
       campos y siete campos por fuente (`contrato:84-96`), y un evento *«la cobertura cambió»*
       (§3). La pregunta `finDeServicio` sale con C8.
     - **Qué cruza, de verticales a billing** (§4.1, `contrato:1096-1105`): `políticaDePlan`,
       `direcciónDeCambio`, `ficha`, `fichaPurgada`, `políticaDeAddon`, la escritura
       `extenderTrial`, `situaciónDeVertical` (que C8 vacía) y el evento *«la ficha llegó a
       `PURGED`»* (§3.1).
     - **Cómo se prueba verticales sin billing**: la implementación de arranque (§5.1), que
       resuelve de verdad el trial y `BASE` y contesta *«no»* a las cuatro fuentes de billing; un
       juego único de casos corre contra la de arranque y la real, con un caso que una constante no
       pasa (§6.2); `G13` impide que el módulo que contesta por billing llegue a producción (§6.3).
     - **Cómo se prueba billing sin verticales**: **no está escrito**. Billing depende de cuatro
       unidades de verticales en doce puntos (`vivo:1648-1650`), y para la dirección inversa no hay
       ni falso, ni juego de casos, ni implementación de arranque. B2 necesita V2 y B4 necesita V4.
     - **Dónde vive**: en ningún lado todavía: *«En qué package vive cada cosa. Es FASE 5»*
       (`contrato:1452`). `DEC-ARCH-006` punto 2: *«Verticales no depende de un `@repo/billing`:
       depende de un contrato que billing satisface»*.
     - **Qué lo vigila**: la regla de vigilancia §4.2 es **prosa**: *«ningún guard del programa
       tiene por sujeto este contrato»* (`contrato:1302-1307`).
     - **El transporte de los eventos**: tampoco. *«El aviso no tiene transporte durable (el
       outbox del núcleo es de correos)»* (`contrato:881`), y la red es el reconciliador.
   - **En el código de hoy** (lo que el rediseño reemplaza): no hay frontera. `@repo/billing` lo
     importan 135 archivos de `apps/api`, 22 de admin, 16 de web, 11 de service-core y 18 de seed;
     verticales lee billing por `owner-entitlement.ts`, `entity_subscriptions` y
     `subscriptionMatchesDomain`.
2. **Qué pide el owner.** Un solo lugar (servicio o package compartido), con interfaz clara, para
   probar verticales sin billing (simulando el comunicador) y billing sin verticales.
3. **Qué cambiar.** Lo que el diseño ya tiene es la mitad de verticales; falta el domicilio, la
   mitad de billing y que la regla deje de ser prosa. Propuesta:
   - **Un package de contrato** (nombre a decidir, p. ej. `@repo/coverage-contract`), sin
     dependencias de `@repo/db` ni de ninguna de las dos mitades; sólo Zod y el enum de verticales
     de `@repo/schemas`. Exporta:
     - **tipos y esquemas Zod** de todo lo que cruza: respuesta de `cobertura` y sus fuentes (más
       `desde` si C4, más `retenciónDetenida` si C14), `políticaDePlan`, `ficha`,
       `políticaDeAddon`, `direcciónDeCambio`, el resultado de `extenderTrial`, y los dos eventos;
     - **dos puertos** (interfaces): `CoveragePort` (lo que verticales le pregunta a billing) y
       `CatalogPort` (lo que billing le pregunta a verticales, incluida la escritura
       `extenderTrial`); y un puerto de eventos con la regla *«se emite después del commit»*;
     - bajo un subpath `/testing`: **falsos programables en memoria de los dos puertos**, y **los
       dos juegos de casos** como funciones parametrizadas (`correr juego de cobertura contra
       esta fábrica`, `correr juego de catálogo contra esta fábrica`), con el caso que una
       constante no pasa en cada uno.
   - **Dónde viven las implementaciones**: la real de `CoveragePort` en el package de billing
     (`DEC-ARCH-004`); `CatalogPort` y la de arranque de `CoveragePort` en el de verticales (la de
     arranque es lógica real de verticales más el módulo que contesta *«no»*, que sigue bajo
     `G13`). El único lugar que junta las dos es la raíz de composición de `apps/api`.
   - **Guard de frontera nuevo (convierte en ejecutable la mitad de §4.2)**: el package de
     verticales no importa el de billing ni al revés; los dos importan sólo el contrato. Y `/testing`
     no entra en un build de producción (misma técnica que `G13`). Queda sin guard la otra mitad
     de la filtración: que billing lea **tablas** de verticales por `@repo/db`. Se cierra partiendo
     los modelos de `@repo/db` por dueño y aplicando la misma regla de imports.
   - **Lo nuevo de verdad es el lado de billing**: un juego de casos del `CatalogPort` que corre
     contra el falso y contra la implementación de verticales, así B2, B8, B9 y B10 se construyen y
     prueban antes de que V2, V4 y V6 existan.
   - **Log**: 📌 en `DEC-ARCH-006` (el contrato tiene domicilio, dos puertos y dos juegos); el §7
     del contrato deja de decir *«es FASE 5»*.
   - **Unidades**: el package nace con V1 (tipos, enum) y crece con V2/V4/V6; B1 o B2 lo consumen
     desde el día uno con el falso. Cambia el orden de `B/descomposicion.md` §2 (B2 ya no espera a
     V2 para probarse, sólo para integrarse).
4. **Sub-preguntas.**
   1. **¿Package o servicio?**
      - (a) **Package de contrato compartido**, con puertos, esquemas, falsos y juegos. Costo: un
        package chico y un guard de imports. Riesgo: bajo.
      - (b) **Carpeta dentro de `service-core`**, sin package, con guard por ruta. Costo: menor.
        Riesgo: la frontera es una convención de carpetas, fácil de saltar con un import relativo.
      - (c) **Servicio aparte** (proceso con API interna). Costo: alto: red, transacciones que hoy
        comparten base, latencia en el paso 5 de cada autorización. Riesgo: alto, sin beneficio a
        esta escala.
      - **Recomiendo (a).** Juan publica su cabaña: el paso 5 de la autorización llama a
        `CoveragePort` en el mismo proceso; en las pruebas de verticales ese puerto es el falso o
        la de arranque, en las de billing el `CatalogPort` es el falso y nadie necesita la base de
        verticales.
   2. **¿Cómo se llama el package?** No hay convención establecida para esto (los packages son
      por dominio: `billing`, `db`, `schemas`). Recomiendo un nombre que diga *«frontera»* y no
      *«billing»*, para que ninguna mitad lo sienta propio.
5. **Tamaño.** Mediano (un package, un guard, un juego de casos nuevo; el contrato no cambia de
   contenido, cambia de domicilio).

---

## N7 · Qué hacemos con cada ítem «sin resolver, declarado» del §12 de la parte 1

Son 13 ítems (`vivo:522-534`). Primero lo que pidió el owner sobre C8: **C8 no vuelve irrelevante
ninguno de estos 13**. Los que la discontinuación afectaba ya no estaban en el §12 del artifact
(comparado con `v1`). Donde C8 sí vuelve irrelevantes residuos declarados es **en el repo**, fuera
de esta lista: `PB9` con el hecho 4 pendiente (`N-B-03`), `DEC-GRANT-010`, `DEC-SUB-015`,
`DEC-SUB-018`, el correo de la pausa alcanzada por una discontinuación (`NUCLEO/07:244`) y la
exención de la acción 16 en la regla de vigilancia (`contrato:1273-1279`). Eso es del informe de C8.

| # | ítem | propuesta | por qué |
|---|---|---|---|
| 1 | Admin maneja la ficha de un cliente | **Dejar declarado** (C7), con la condición escrita | Futuro por decisión del owner; no bloquea |
| 2 | Baja de cuenta pedida por el usuario | **Resolver ahora** (decisión, abajo) | Toca plata y hay una promesa pública |
| 3 | Consulta legal del seudónimo y de teléfono/CUIT/dispositivo | **Resolver ahora la mitad**: sacar las señales que sólo observan | Simplifica; la consulta queda sólo por el seudónimo |
| 4 | Medición de proveedores de correo | **Dejar declarado, pero pasa a gate del corte** | Con C12 la primera prueba es la del corte |
| 5 | Evento de activación de Partner y apagar una prueba encendida | **Sacarlo**: fuera de esta versión, y el panel no deja cambiar 0 ↔ >0 | Mismo criterio que C8; borra `T7` |
| 6 | Capacidades y límites de cada vertical | **Dejar declarado**, como dato del owner antes del corte | Es configuración (y con N1, panel) |
| 7 | Página de Partner sin retención, y dónde vive su contenido | **Resolver ahora el «dónde vive»** (texto); la retención queda declarada | Es modelo de datos, chico |
| 8 | Página de Partner visible hasta un día más dos horas | **Dejar declarado** | No mueve plata ni da acceso a nada privado |
| 9 | Qué puede hacer el dueño sobre una ficha moderada; avisos de levantar y de borrar | **Resolver ahora** | C10 lo necesita: sin editar no hay arreglo |
| 10 | El lock cubre publicar, no todos los límites | **Dejar declarado** | Una unidad de más; costo de cerrarlo alto |
| 11 | Espacio entre archivado y borrado sin garantía | **Resolver ahora**, con el mecanismo de C9 | Sale gratis si los relojes guardan su plazo |
| 12 | Dueño sin ficha publicada que pierde la cobertura y el aviso | **Dejar declarado** | Requiere aviso perdido; la relectura evita el borrado indebido de quien volvió |
| 13 | Avisos de retención sobre ficha moderada o borrada | **Resolver ahora** | Una relectura más, el patrón que ya existe |

Detalle de los que se resuelven o se sacan:

**Ítem 2 · Baja de cuenta.**

- **Hoy**: `NUCLEO/08` §1 la declara pendiente (`contrato:1030-1032`). Y **la web de producción
  promete una que no existe**: `packages/i18n/src/locales/es/faq.json:224-225`, *«Desde Mi Cuenta >
  Configuración > Eliminar cuenta. Eliminamos tus datos personales en un plazo máximo de 30 días»*;
  no hay ese código en `apps/api` ni en `apps/web`. Choca además con *«Nunca se borra ni se
  anonimiza nada de la persona»* (`vivo:391`).
- **Por qué no puede quedar declarado**: con el cobro nuestro, una cuenta que se borra con una
  autorización viva en Mercado Pago **sigue cobrando** sin nadie del otro lado.
- **Opciones**:
  - (a) **Mínimo ahora**: borrar la cuenta exige no tener compromisos vivos (primero la baja, con
    el flujo que existe); después corre `PB12` sobre cada ficha (así sale el empuje a billing y
    muere el destaque), se anonimiza el usuario y se conserva lo que la ley pida (pagos) y el
    seudónimo según la consulta legal. Costo: una operación y su pantalla. Riesgo: bajo.
  - (b) **Fuera de esta versión**, y se corrige la FAQ: la baja la hace soporte a mano con una
    lista de pasos escrita. Costo: casi nada. Riesgo: la ley de datos personales da derecho a
    pedirla; hacerlo a mano escala mal pero a esta escala alcanza.
  - (c) **Diseño completo** con exportación y plazos. Costo: alto.
  - **Recomiendo (a)**. Juan pide irse: primero cancela su suscripción, después borra la cuenta, sus
    fichas quedan `PURGED` y sus datos anonimizados.

**Ítem 3 · Señales que sólo observan.** Teléfono, CUIT y dispositivo nunca bloquean (`vivo:229`) y
por eso piden finalidad y plazo legal. **Sacarlas** (no guardarlas) deja la consulta legal reducida
al seudónimo del correo y borra un requisito de implementación. Con 22 usuarios el abuso es
teórico; se agregan cuando haya abuso medido. Opciones: (a) sacarlas; (b) guardarlas con finalidad
y plazo tras la consulta; (c) guardarlas ya. Recomiendo (a).

**Ítem 5 · Encender o apagar la prueba de una vertical.** Hoy sólo Partner está en cero. Lo que
existe para encenderla es `T7` (`V/03:57`), su caso borde (`vivo:281`) y una pregunta sin evento
de Partner. Con C9 los días de prueba se editan desde el panel, así que el panel es quien tendría
que impedir el salto. Opciones: (a) fuera de esta versión, el panel rechaza pasar una vertical de 0
a más de 0 y al revés, y se borra `T7`; (b) diseñarlo ahora (evento de Partner, qué cuenta como
ejercido, apagado); (c) dejarlo como está. Recomiendo (a), con el mismo argumento que el owner usó
en C8: no se construye lo que no se va a usar.

**Ítem 7 · Dónde vive el contenido de Partner.** Es una línea en `V/02`: nombrar la tabla de hoy
(la de partners) como la de la presencia. La falta de retención queda declarada: el owner no la
pidió.

**Ítem 9 · La ficha moderada.** C10 obliga: si Juan no puede editar la ficha bajada, no puede
corregirla. Propuesta: verla, exportarla y editarla, no publicarla (sale sólo por la acción del
admin), y borrarla (`PB12` gana `MODERATED` en su `desde`). Los avisos: el de levantar lo trae C10;
el de *«borraste tu ficha»* es un correo de confirmación más en `NUCLEO/07` §6.

**Ítem 11 · Espacio entre archivado y borrado.** Si C9 hace que cada reloj guarde su plazo y el
archivado escribe la fecha de borrado que anuncia, `PB9` borra en esa fecha anunciada, nunca antes,
aunque el archivado haya corrido tarde. Se cierra con el mismo cambio de C9, sin mecanismo aparte.

**Ítem 13 · Avisos de retención sobre ficha moderada o borrada.** Los avisos ya releen `cubierto`
antes de salir (`contrato:119`); agregar la relectura del estado de la ficha (no salen sobre
`MODERATED` ni `PURGED`) y, con C14, de `retenciónDetenida`. Una línea en `NUCLEO/07` §6.

**Tamaño de N7**: chico para 4, 6, 7, 8, 10, 12, 13; mediano para 2, 3, 5, 9, 11 (el 11 va dentro
de C9).

---

## Choques con decisiones vigentes, en una lista

1. **C3 contra el PDR §55.1** (excepción histórica). El PDR no se edita: va como apartamiento.
2. **C4 contra `V/11` §4.3** (la cuota del trial no se renueva): recomiendo que gane el repo y se
   corrija el artifact (`vivo:154`).
3. **C4 contra el contrato §4** (*«no cruzan fechas»*): `desde` no es fecha de cobro, se declara.
4. **C12 contra `G1-1`/R1 y el fundamento de `DEC-MIG-005` punto 3** (`V/21:287-296`, *«por qué
   no sembrarles un trial»*). Gana el owner; se registra como `DEC-MIG-006`.
5. **C14 contra `DEC-DATA-002` y `DEC-TRIAL-008`** (*«esta frontera no se vuelve a abrir por este
   caso»*, `contrato:1080`). Gana el owner; se abre con una pregunta de un solo tipo de lector.
6. **C7 (futuro) contra `NUCLEO/08:187`**, *«ni las que se agreguen»*. Queda escrito que se reabre.
7. **C9 y N1 contra `G-R5`, `G-R5-B` y `G-R3`**: guards de CI sobre valores que se mudan a la
   base; pasan a ser validaciones del panel.
8. **N1 contra el inventario de guards** (`check-seed-dual-write.sh` *«sobrevive»*): sobrevive,
   pero pierde su rama de billing y los planes salen de su jurisdicción.
9. **Artifact contra repo, ya aplicado en el artifact y no en el repo**: C5 (R15 sacado), C12
   (nacen publicadas), C10, C14, C4. **Y una inconsistencia que quedó dentro del artifact**: la
   frase de riesgo `vivo:2038` ya no describe al cliente del corte.

---

## Resumen

Del lado producto, lo que más mueve el diseño son cuatro puntos. **C12** revierte R1 y pone en el
corte una escritura nueva (un trial activo por dueño con ficha a la vista), con dos gates nuevos
(seudónimos medidos y sin duplicados) y, si las `L5`/`L7` nacen en borrador, permite borrar R15
entero. **C14** abre la frontera con una pregunta de un solo lector (`retenciónDetenida`) y
borra `D16` y `G-R5`. **C9/N1** llevan los valores al panel, y con eso tres guards de CI se
convierten en validaciones de la base, aparecen acciones administrativas que el catálogo no tenía
(nadie podía publicar una versión de plan) y los relojes tienen que guardar su plazo para no
adelantar fechas anunciadas. **C3** es más grande que el billing: rol, permisos, una tabla de
leads, un tipo de partner, 15 nombres del ledger de seed y la historia de migraciones.

N6 ya tenía media respuesta (el contrato y la implementación de arranque); falta el domicilio (un
package de contrato con dos puertos, falsos y dos juegos de casos), la mitad de billing (probar sin
verticales) y un guard de imports que vuelva ejecutable la regla de vigilancia. De N7, seis ítems
se resuelven ahora (el más urgente, la baja de cuenta, por plata y por una promesa pública de la
FAQ), seis quedan declarados y uno se saca (encender la prueba de una vertical, borra `T7`).

## Key Learnings

1. `G1-1` (R1) ya había analizado C12 como su opción 3 y le había puesto precio (escritura del
   corte con hash, reloj y campaña; una sola ficha en el cupo); la decisión del owner la revierte
   y hay que registrarla como `DEC-MIG-006`, porque `G1-1` no tiene `DEC` propio.
2. R15 (`T8` con la vuelta bajo un título que paga) existe sólo por fichas del corte nacidas
   `UNPUBLISHED_BY_BILLING` bajo un dueño en `PRE_TRIAL`; fuera del corte, `T8` siempre encuentra
   el evento ejercido. Si C12 y `L5`/`L7` → `DRAFT`, se borra entero.
3. La pausa que detiene el reloj (C14) no se podía hacer sin cruzar la frontera, y por eso el
   diseño había elegido una desigualdad (`D16`/`G-R5`); la salida mínima es una pregunta de ida
   leída sólo por `PB4`, `PB5`, `PB9` y los avisos de retención.
4. El artifact dice que la cuota de la prueba ancla en su arranque, pero `V/11` §4.3 dice que la
   cuota del trial no se renueva: son incompatibles y conviene corregir el artifact.
5. «Un cambio de plazo no adelanta fechas anunciadas» (C9) obliga a que cada reloj guarde su plazo
   o la versión de plazos; y eso, gratis, cierra el ítem del §12 sobre el espacio entre archivado
   y borrado.
6. Con N1 y C9, los guards que comparan valores de configuración en CI (`G-R3`, `G-R5`, `G-R5-B`)
   dejan de ver producción: tienen que ser validaciones del panel o restricciones de la base.
7. El catálogo de acciones administrativas de `NUCLEO/08` §3 no tiene ninguna para editar el
   catálogo de planes, precios, complementos ni promos: con N1 es un hueco que bloquea.
8. «commerce» en hospeda2 no es sólo billing: rol `COMMERCE_OWNER`, 7 permisos `commerce.*`, la
   tabla `commerce_leads`, el tipo de partner `'commerce'`, 15 nombres de data-migrations
   ledgerados en producción y 109 archivos de historia Drizzle; 1204 archivos en total.
9. La FAQ de producción (`faq.json:224-225`) promete «Eliminar cuenta» y borrado en 30 días, y ese
   código no existe; con el cobro propio, borrar una cuenta con autorización viva seguiría
   cobrando.
10. El contrato no tiene domicilio ni un falso de la dirección inversa: hoy se puede probar
    verticales sin billing, pero no billing sin verticales.

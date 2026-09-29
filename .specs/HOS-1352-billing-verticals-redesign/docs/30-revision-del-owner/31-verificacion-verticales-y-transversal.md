---
title: "Revisión del owner · verificación de lo aplicado: verticales, núcleo y lo transversal"
linear: HOS-1352
statusSource: linear
created: 2026-09-29
updated: 2026-09-29
status: CURRENT
fase: 9
---

# Revisión del owner · verificación de lo aplicado: verticales, núcleo y lo transversal

Verificación adversarial de los mecanismos nuevos que entraron por los casos vecinos (registros
`17-` y `19-` a `23-`) en el tramo de verticales, el núcleo, el contrato en lo que toca a
verticales, la FASE 7 del paraguas y la spec del paraguas. Leído y medido en el worktree
`hospeda-spec-hos-1352-billing-redesign` sobre el HEAD `262adc4638`, con las mediciones de código
también sobre `origin/staging` (`35e2d63e81`, del 2026-09-29). **Sólo lectura**: no se editó el
diseño, el log ni la matriz. El cobro (`S37`, `S38`, `A7`, `provider_notification`, el
comprobante) lo cubre el otro verificador; acá aparece sólo donde cruza. Abreviaturas: `B/` es
`HOS-1354…/docs`, `V/` es `HOS-1353…/docs`, `D/12` el contrato, `D/16` la FASE 7 del paraguas,
`nucleo/` el núcleo, `$V/` y `$B/` la raíz de cada sub-spec.

Para buscar la palabra del agrupamiento viejo se armó el patrón en partes, como hace el propio
`G8`, y el texto de este informe no la escribe.

## 1. Qué se verificó

| # | mecanismo | dominio corrido | veredicto |
|---|---|---|---|
| 1 | acción 23, borrar una ficha ajena a pedido de su dueño | los cinco estados de salida de `PB12` (incluido `MODERATED`), actor distinto del sujeto y reglas 1 a 5 de `V/17` §3.2, evaluación de los pasos 5 a 7 sobre el sujeto, lock, empuje a billing y `A6`, auditoría con motivo, confirmación por destructiva, dueño con fichas en varias verticales | **LIMPIO** |
| 2 | acción 24, dar de baja una cuenta (seudonimiza, no borra) | la traba de `trial.user_id` `ON DELETE RESTRICT`, los datos de facturación en la copia del comprobante, la cuenta del propio `SUPER_ADMIN` (regla 5), un dueño con fichas y suscripciones en varias verticales, un Partner, y su precondición contra cada estado de la suscripción | **HALLAZGO** (VC-VT-02, VC-VT-03, VC-VT-07) |
| 3 | la baja de cuenta manual de `nucleo/08` §1.3 | los tres pasos en orden, corridos seguidos por soporte sobre un dueño con suscripción `ACTIVE` mensual y anual, `PAUSED`, `SUSPENDED` y en `GRACE_PERIOD`, con los correos que cada paso encola | **HALLAZGO** (VC-VT-03, VC-VT-06) |
| 4 | el correo de `PB12` en todo `PB12`, con la línea extra cuando borra soporte | los cinco estados de salida; el borrado por el dueño y por la acción 23; el paso 5b del corte (no es `PB12`, no manda correo, coherente con que el corte no avisa); el orden con el paso 3 de la baja | **HALLAZGO** (VC-VT-06) |
| 5 | el conteo de acciones vivas (23) y sus espejos | la tabla de `nucleo/08` §3 recontada (23 vivas, la 16 tachada); las 21 que son capacidad del actor (14 + 6 + la 24); las dos sobre el sujeto (15 y 23); `V/17` reglas 1, 3 y 5, §3.3, §3.4 y su ⚠️, §3.5; `B/03` y `B/19` §6; `$V/spec.md` §3.7 | **LIMPIO** en las cifras; dos espejos del nombre viejo (VC-VT-11) |
| 6 | `retenciónDetenida` con `pausaTerminadaEn` | los siete caminos que escriben `fin_real` (`S10`, `S22`, `S13`, `S17`, el espejo, `S36` y `S6` sobre una pausa por cortesía); la pausa vencida sin reanudar (motivo 8, `detenida: sí`); una segunda pausa; una pausa en otra vertical; `S22` a `CANCEL_SCHEDULED` con crédito; los cuatro lectores (`PB4`, `PB5`, `PB9` y los avisos de retención); la versión de plazos de la ficha; la mitad *(d)* de `G-R6-B` | **HALLAZGO** (VC-VT-04, VC-VT-05) |
| 7 | `G8` con tres entradas de pendientes | todo archivo versionado del repositorio, medido fuera de las tres entradas, del `CLAUDE.md` raíz, del i18n y de las specs; el script del corte; la regla que enciende el paso 6 y extiende el cierre; el build del paso 3 | **HALLAZGO** (VC-VT-01, VC-VT-11) |
| 8 | la limpieza de `V1` por estado de Linear | los diez estados del equipo con su tipo, la excepción `In Review`, `Duplicate`, las canceladas, las sin issue, `.qtm/`; el tipo `triage` (declarado para la implementación en `23-` §3) | **LIMPIO** |
| 9 | plazos configurables | la lista cerrada (15), los cinco sin valor (3, 4, 7, 8 y 9) contra la migración única del 3a, el piso de 60, alargar contra relojes arrancados, la pantalla única por la API y `G14`, `plazos_version` bajo la mitad *(a)* de `G-R6-B`, la cota de `G-R5-B`, y el orden del corte entre el paso 3 y el 3a | **HALLAZGO** (VC-VT-08) |
| 10 | el décimo apartamiento del PDR | `nucleo/02` §1.5, el 📌 de `DEC-DATA-008` y la fila del `## Resumen` del log (diez, enumerados: ocho más `DEC-ARCH-012` y `DEC-DATA-008`) | **LIMPIO** |
| 11 | el tipo de partner `business` | el enum (`PartnerTypeEnum`, tres valores), la etiqueta «Comercio», la migración de datos de `V1`, y toda columna que guarda un valor de ese enum | **HALLAZGO** (VC-VT-10) |
| 12 | la moderación en dos niveles, sólo fichas, y la vuelta desde `ARCHIVED` por el origen | `PB10`, `PB11` y `PB13` con cada origen de archivado (`PB4` y `PB5`); ninguna ficha nace `ARCHIVED` en el corte, así que siempre hay evento de origen; la presencia de Partner con su bit | **LIMPIO** |
| 13 | el `desde` con más de un título y el del `BASE` | una prueba y una suscripción antes de `T2`; una cortesía sobre una suscripción; el `BASE` sin entitlement medido; la muerte del título que ancla | **HALLAZGO** (VC-VT-09) |
| 14 | la tarea del cierre de HOS-1352 y su coherencia con `G8` | los cuatro puntos de `spec.md`, las dos sub-specs cerradas antes que el paraguas (cubiertas por la tercera entrada), el PDR exento, el log y la matriz que se quedan | **LIMPIO** |

**Resumen del §1**: 14 mecanismos, 6 limpios, 8 con hallazgo; 11 hallazgos, 4 que bloquean y 7
menores.

## 2. Hallazgos

### VC-VT-01 · `G8` falla en unos 1229 archivos de código vivo que ni la lista ni la limpieza de `V1` cubren · **BLOQUEA**

**El caso.** `V1` construye `G8` al principio de la épica. El guard falla en cualquier archivo
versionado que nombre la palabra, salvo el PDR y las tres entradas de la lista. La limpieza de `V1`
nombra el rol, los siete permisos, la tabla de contactos, el tipo de partner, el `CLAUDE.md` raíz,
el i18n y las specs de fuera. Pero el código de hoy nombra la palabra en muchos más lugares.
Medido el 2026-09-29 con `git grep -il` sobre `origin/staging` (`35e2d63e81`), sacando `.specs/`,
`.qtm/`, las dos historias, el `CLAUDE.md` raíz y `packages/i18n`: **1229 archivos versionados**
(430 en `apps/api`, 344 en `apps/web`, 110 en `packages/service-core`, 97 en `packages/schemas`,
73 en `apps/admin`, 60 en `packages/seed`, 36 en `packages/billing`, 22 en `packages/db` fuera de
las migraciones, entre otros), y **326 rutas que la llevan en el nombre del archivo**. Son
identificadores del sistema viejo que corre hasta el corte: el middleware de entitlements de la
vertical, el alta de la suscripción, el reconciliador de visibilidad, el enum de tipos de entidad,
los guards de `scripts/` (uno con la palabra en el nombre del archivo), `docs/billing` y el
`specs-prioritization.csv` de la raíz. Y una parte nombra un **valor de la base**: el dominio de
producto viejo de las suscripciones, que el código viejo tiene que seguir leyendo hasta el corte.

La premisa con que se decidió la lista fue otra: que hasta el paso 6 sólo la nombraban las dos
historias. `V1` no puede quedar lista con su criterio, y el guard queda rojo sobre la rama del
paraguas desde que existe hasta que la última unidad retire el código viejo.

- `$V/descomposicion.md:560` «en cualquier archivo que no sea el PDR falla»
- `V/20:56` «en cualquier archivo versionado del repositorio»
- `V/20:56` «tres entradas y ninguna más»
- La premisa de la lista: `30-revision-del-owner/14-aplicacion-transversal-y-lote.md:208` «Hasta el paso 6 la historia de migraciones y el ledger del seed nombran la palabra, así que un `G8` que falla en todo el repo nace rojo»
- El código viejo de billing muere después: `B/21:431` «De este lado lo nombran el dominio de producto viejo de las suscripciones y sus planes, que mueren con el modelo nuevo»
- `B/21:421` «se retiran con el código que las lee»

**Con Juan**: el día que `V1` mergea en la rama del paraguas, el CI de Juan (que está haciendo `V2`)
queda rojo por `G8` en 1229 archivos que su unidad no toca.

**Recomendación** (elige el owner):

1. **`V1` renombra todo el código vivo en el mismo cambio**, y lo que tenga que nombrar un valor de
   la base lo arma en partes, como el script del corte (F-D). Pros: el guard nace verde y no
   cambia la lista. Contras: `V1` crece a un renombre de más de mil archivos sobre código que otras
   unidades van a reescribir o borrar después. Impacto: la fila de la limpieza y el criterio de
   `V1`.
2. **Una cuarta entrada: el código del sistema viejo, hasta el paso 3 o el 6**, con la misma
   mecánica de la lista. Pros: sigue el patrón elegido. Contras: reabre *«ninguna más»* por segunda
   vez, y hay que delimitar qué es «código del sistema viejo» con rutas, no con criterio.
3. **`G8` corre sobre la rama sólo desde que la última unidad retira el código viejo**, y `V1` lo
   construye apagado para el resto del repo. Pros: ningún renombre inútil. Contras: deja sin
   vigilancia la escritura nueva de la palabra durante la épica.

Recomiendo la **2**, acotada por rutas medidas y con la salida en el commit del paso 6: es el mismo
mecanismo, con fecha de fin, y no le carga a `V1` un renombre que el resto de la épica deshace.

### VC-VT-02 · la acción 24 se condiciona sobre una fila viva, y verticales no puede evaluarla · **BLOQUEA**

**El caso.** La 24 la construye `V8`, de verticales, y se rechaza *«mientras a la cuenta le cuelgue
una suscripción viva, principal o de complemento»*. El glosario prohíbe exactamente eso: ninguna
regla de verticales se condiciona sobre una fila viva, porque el estado de la suscripción no cruza
el contrato. Ninguna entrada del contrato contesta *«¿esta cuenta tiene una suscripción viva?»*
(la de ida es una sola pregunta, `retenciónDetenida`), la fila de la 24 no suma una dependencia
hacia billing (`19-` §2: *«las once dependencias entre épicas»* sin cambio) y la precondición no
figura en el inventario de consumidores de *«fila viva»*, que vigila `G-R1-E`.

- `nucleo/08:203` «Se rechaza mientras a la cuenta le cuelgue una suscripción viva, principal o de complemento, o una ficha fuera de `PURGED`»
- `$V/descomposicion.md:482` «dar de baja una cuenta con una suscripción viva o una ficha fuera de `PURGED` se rechaza»
- `nucleo/01:648` «Ninguna regla de la épica de verticales se condiciona sobre una fila viva.»
- `D/12:1028` «El estado exacto de la suscripción no cruza.»
- `B/20:60` «o un consumidor nuevo de *«fila viva»*, *«grant vivo»* o *«ancla viva»* **no figura** en el inventario»

**Con Juan**: soporte abre el panel para dar de baja la cuenta de Juan. `V8` tiene que decidir si a
Juan le cuelga una suscripción viva, y para eso o lee las tablas de billing (la filtración que
`D/12` §4.2 vigila) o no lo mira (y la precondición no existe).

**Recomendación**: **(a)** una entrada nueva en la dirección de ida, que billing contesta con un sí o
no sobre la cuenta entera (sin estado), y entra al inventario de *«fila viva»* del lado de billing;
**(b)** mover la 24 a billing, que ya ve sus filas, con `PB12` y la precondición de las fichas
leídas por el contrato (`fichaPurgada` por ficha); **(c)** partir la precondición: la de las fichas
en `V8` y la de la suscripción en la acción 1 de billing. Recomiendo **(a)**: es lo mínimo, tiene la
forma de `retenciónDetenida` y deja la acción en `V8`, que el owner confirmó (H-D). El conjunto que
contesta es el de VC-VT-03.

### VC-VT-03 · después del paso 1, una suscripción `ACTIVE` queda viva hasta su fin de servicio, y la 24 se rechaza hasta entonces · **BLOQUEA**

**El caso.** El paso 1 dice que toda suscripción viva *«termina»*. Desde `ACTIVE`, cancelar es
`S11`, que va a `CANCEL_SCHEDULED` y sostiene el servicio hasta su fecha de fin; y
`CANCEL_SCHEDULED` es uno de los seis estados de *«fila viva»*. Así que, con la precondición a la
letra, la 24 queda rechazada hasta que `S12` corra en la fecha de fin: hasta un ciclo entero. La
razón que el propio §1.3 da para el orden (*«una cuenta que se borra con una autorización viva
sigue cobrando»*) ya la cumple `S11`, que cancela en el proveedor de inmediato: el conjunto de la
precondición es más ancho que su razón.

- `nucleo/08:101` «toda suscripción viva de la cuenta, principal o de complemento, termina por los caminos que ya existen»
- `nucleo/08:103` «una cuenta que se borra con una autorización viva sigue cobrando»
- `B/03:888` «| `ACTIVE` | `S11` | `CANCEL_SCHEDULED` |»
- `B/03:896` «`CANCEL_SCHEDULED` **ya está dada de baja**»
- `nucleo/01:501` «De la **suscripción**, los **seis**: `PENDING_AUTHORIZATION`, `ACTIVE`, `GRACE_PERIOD`, `PAUSED`, `SUSPENDED`, `CANCEL_SCHEDULED`»

**Con Juan**: Juan tiene un anual de Alojamiento pagado en enero y en marzo pide la baja. Soporte
cancela (queda `CANCEL_SCHEDULED` hasta enero del año siguiente), borra sus dos fichas con la 23, y
la 24 se rechaza **diez meses**. `PAUSED`, `SUSPENDED` y `GRACE_PERIOD` no tienen el problema:
`S22`, `S23` y `S24` van a `CANCELLED` en el acto (salvo el crédito sin consumir de `S22`).

**Recomendación**: **(a)** la precondición pregunta por *«una autorización que puede cobrar»* (la
misma enumeración que el consumidor 6 del inventario, sin `CANCEL_SCHEDULED`), y la fila
`CANCEL_SCHEDULED` termina sola por `S12` sobre la cuenta ya seudonimizada; **(b)** se deja como
está y se declara que la baja de una cuenta con período pagado espera a su fin; **(c)** una forma de
cortar el período en el acto a pedido del dueño, que hoy sólo existe dentro del arrepentimiento
(`S36`). Recomiendo **(a)**: cumple la razón escrita del orden y no agrega transición. Se decide
junto con VC-VT-02, porque define qué contesta la entrada nueva.

### VC-VT-04 · los avisos de retención cuentan sobre `inactiva_desde`, y el contrato les pide el más tardío · **BLOQUEA**

**El caso.** El contrato dice que los lectores de `retenciónDetenida` son cuatro (archivar, borrar
y los avisos de retención) y que cuentan desde el más tardío entre `inactiva_desde` y
`pausaTerminadaEn`. `PB4`, `PB5` y `PB9` se alinearon (F-A). La fila *«retención»* del catálogo de
correos no: sigue diciendo que los tres avisos se cuentan sobre `listing.inactiva_desde`. Y como el
reinicio por fin de pausa no se escribe, ningún hecho mueve la fecha objetivo del aviso, que es la
que va en su ocurrencia.

- `D/12:1090` «Sus únicos lectores son archivar (`PB4` y `PB5`), borrar (`PB9`) y los avisos de retención»
- `D/12:1105` «y sus lectores cuentan desde el más tardío de dos instantes»
- `nucleo/07:248` «los tres contados sobre `listing.inactiva_desde`»
- `V/03:485` «o sobre el fin de la última pausa que devuelve `retenciónDetenida`, el más tardío»

**Con Juan**: Juan pausa su suscripción de Gastronomía el 1 de febrero (el hecho 5 escribe
`inactiva_desde` ese día) y el 1 de junio da la baja desde la pausa (`S22`). `PB4` archiva el 30 de
agosto (1 de junio más 90). El aviso previo al archivado, contado sobre el 1 de febrero, apuntaba
al 2 de mayo: durante la pausa no salió (`detenida: sí`), y después o sale en junio anunciando un
archivado del 2 de mayo que no va a pasar, o no sale nunca, y el 30 de agosto la ficha se archiva
sin el aviso previo, que es transaccional y no suprimible.

**Recomendación**: la fila *«retención»* de `nucleo/07` §6 cuenta los dos avisos previos desde el
más tardío de los dos instantes, con la versión de plazos de la ficha, y la fecha objetivo de su
ocurrencia (§2) sale de esa cuenta. Es texto en un solo capítulo, sin elección de producto; lo marco
**BLOQUEA** porque hoy dos capítulos dicen dos cosas distintas sobre el mismo lector.

### VC-VT-05 · la mitad *(d)* de `G-R6-B` no ve a un lector que consulta la pausa e ignora `pausaTerminadaEn` · **MENOR**

**El caso.** La *(d)* falla sobre un lector de retención que **no consulta** `retenciónDetenida`.
Desde F-A la regla tiene dos mitades: no actuar con `detenida: sí`, y contar desde el más tardío. Un
`PB9` que consulta, mira sólo `detenida` y cuenta sobre `inactiva_desde` pasa la *(d)* y reproduce
el caso 12: con Juan del caso anterior, el día siguiente a la baja desde la pausa borra una ficha
con el reloj arrancado en febrero.

- `V/20:70` «no consulta `retenciónDetenida`»
- `D/12:1102` «Ese reinicio no se escribe»

**Recomendación**: el predicado de la *(d)* pasa a *«no consulta `retenciónDetenida` o no cuenta
desde el más tardío de los dos instantes»*, con el mismo mensaje. No toca la mitad de escritores,
que es lo que F-A dejó sin cambio.

### VC-VT-06 · el correo de `PB12` con la línea extra puede no llegar si soporte corre el paso 3 enseguida · **MENOR**

**El caso.** Los tres pasos de la baja los hace soporte, y nada lo obliga a esperar entre el 2 y el
3. El correo de `PB12` se encola en la transacción del borrado y lo manda un proceso aparte; la
jerarquía de supresión suprime todo sobre una *«cuenta borrada»*. El diseño no dice si una cuenta
dada de baja por la 24 es *«cuenta borrada»* para esa jerarquía, ni si el destinatario de una fila
ya encolada es la dirección del momento de encolar o la de la cuenta al enviar, que la 24 acaba de
reemplazar por un seudónimo.

- `nucleo/08:110` «Los tres pasos los hace soporte, a pedido del dueño y con motivo»
- `nucleo/07:35` «La transición escribe su estado **y** la fila de outbox en la misma transacción»
- `nucleo/07:155` «**cuenta borrada** | todo»
- `nucleo/07:253` «Cuando la borra soporte con la acción 23, es el mismo correo con una línea más»

**Con Juan**: soporte borra las dos fichas de Juan con la 23 y un minuto después da de baja la
cuenta con la 24. Los dos correos de confirmación (con la línea *«a pedido suyo»*, H-G) se suprimen
o salen hacia el seudónimo, según cómo lo implemente quien construya el envío.

**Recomendación**: declarar que la fila de outbox guarda la dirección al encolarse y que la
supresión por *«cuenta borrada»* no alcanza a lo encolado antes de la 24; o que la 24 se rechaza
mientras la cuenta tenga correos transaccionales pendientes. Recomiendo la primera, que no frena a
soporte.

### VC-VT-07 · la baja manual de un Partner no dice qué pasa con su presencia y su postulación · **MENOR**

**El caso.** Los tres pasos nombran suscripciones, fichas y la cuenta. Un Partner no tiene fichas:
tiene una presencia (fotos, secciones, enlaces) y, si vino por el formulario, una postulación. La
24 no pregunta por la presencia, no hay acción que la borre (la moderación sólo escribe su bit y
conserva el contenido), y la baja del cobro la deja sin la clave de la página, así que no se ve.
Queda guardada sin plazo, colgando de una cuenta seudonimizada.

- `nucleo/08:108` «La cuenta, al final, cuando ya no le cuelga ni un cobro ni una ficha con contenido»
- `V/18:133` «El contenido se conserva.»

**Con Juan**: Juan es Partner (un comercio de Colón) y pide la baja. Soporte cancela su suscripción
de Partner y da de baja la cuenta; la presencia con sus fotos y su logo queda en la base para
siempre. No expone nada ni mueve plata.

**Recomendación**: declararlo en `nucleo/08` §1.3 (la presencia se conserva sin mostrarse, como el
contenido de una moderada) o sumar a la lista un paso que la vacíe. Recomiendo declararlo: el
owner pidió *«que soporte pueda borrar todo»*, y hoy la presencia es la única cosa del dueño que ese
*«todo»* no alcanza.

### VC-VT-08 · la escritura `C` y la prueba del corte guardan una versión de plazos que nace después, en el 3a · **MENOR**

**El caso.** `listing.plazos_version` no es anulable y se escribe junto con `inactiva_desde`,
también por la escritura `C`, que corre en la migración estructural del paso 3. La primera versión
de los plazos nace en la migración única del catálogo, en el paso 3a, que corre **después** de la
estructural. La prueba gratis que escribe el mismo paso 3 guarda también su versión (plazos 5 y 7).
Las dos escrituras apuntan a una versión que todavía no existe.

- `V/02:430` «que se escribe junto con `inactiva_desde`, por los mismos hechos y por la escritura `C`, y nunca sola»
- `nucleo/02:163` «la primera versión de los plazos de cada mitad nace en el paso 3a»
- `D/16:138` «corren en el carril de datos del despliegue, después de la migración estructural»

**Recomendación**: que la migración estructural cree la versión 1 de los plazos, con los quince
valores (los cinco sin valor ya fijados por el owner), y el 3a sólo la verifique; o que la escritura `C`
guarde el id de la versión 1, conocido de antemano, y el 3a la cree con ese id. Se resuelve en la
implementación de `V6` y `V9`, pero conviene escribirlo en el paso 3, que hoy no nombra los plazos.

### VC-VT-09 · cuando muere el título que ancla la cuota, ninguna regla dice cómo sigue la ventana · **MENOR**

**El caso.** Con dos títulos que dan cuota ancla el que arrancó primero, y el ejemplo del propio
capítulo es una prueba y una suscripción antes de `T2`. Minutos después `T2` convierte y la prueba
deja de ser título: el ancla pasa al alta de la suscripción. La regla 5 dice qué pasa con la
ventana en curso al cambiar de plan, no al cambiar de título ancla.

- `V/15:519` «Con más de un título vivo, ancla el que da la cuota; si dos la dan, el que arrancó primero»
- `V/15:534` «Al cambiar de plan, la ventana en curso sigue hasta su fin»

**Con Juan**: Juan arranca la prueba el 5 y contrata el 20. Del 5 al 20 renueva el 5; desde la
conversión, el ancla es el 20. No está escrito si la ventana que arrancó el 5 sigue hasta el 5 del
mes siguiente con la cuota de la suscripción (como la regla 5) o se corta el 20.

**Recomendación**: extender la regla 5 a *«cambia el título que ancla»*, con el mismo tratamiento.

### VC-VT-10 · la migración del tipo de partner no nombra la otra columna que guarda ese valor · **MENOR**

**El caso.** La migración de datos de `V1` reescribe a `business` *«todo partner que tenga el valor
viejo»*. El valor vive además en `alliance_leads.partner_type`, un `varchar(30)` que el código
valida contra el mismo `PartnerTypeEnum` (medido en hospeda2 el 2026-09-29:
`packages/db/src/schemas/alliance/alliance_lead.dbschema.ts:105` y
`packages/schemas/src/entities/alliance-lead/alliance-lead.schema.ts:15`). Una postulación de
alianza guardada con el valor viejo deja de validar cuando el enum ya no lo tiene.

- `V/21:529` «y la migración de datos de `V1` reescribe a»

**Recomendación**: que la migración de `V1` reescriba toda columna que guarde un valor de
`PartnerTypeEnum`, no sólo la de `partners`, y que el criterio de `V1` lo diga.

### VC-VT-11 · dos espejos desalineados: la lista «en dos» y el nombre viejo de la 24 · **MENOR**

**El caso.** Texto que quedó atrás de H-A y de I-C:

- La lista de `G8` tiene tres entradas desde H-A, y `D/16` §4.2 dice que el script no entra a ella porque tiene dos: `D/16:308` «que sigue en dos»
- La 24 no borra la cuenta desde I-C, y dos lugares la siguen llamando así. `V/19:44` «borrar una ficha suya por `PB12` o su cuenta»
- `V/17:433` «si quien pide borrar su cuenta es a la vez del equipo»

**Recomendación**: *«que tiene tres»* en `D/16`, y *«o dar de baja su cuenta»* en los otros dos. El
grep de I-C (`borrar (una|la) cuenta`) no los veía por el posesivo.

## 3. Lo que corrí y salió limpio, en una línea cada uno

- **La 23 sobre una ficha `MODERATED`**: la borra sólo a pedido del dueño, con la misma fila; moderar sigue sin borrar.
- **La cuenta del propio `SUPER_ADMIN`**: la regla 5 rechaza la 24 con actor igual a sujeto y la hace otra cuenta; con una sola cuenta con el permiso, no se puede, que es el costo ya declarado de la regla.
- **`trial.user_id`**: la fila de `user` no se borra, así que el `RESTRICT` no dispara y el hash sigue trabando la segunda prueba.
- **Un dueño con fichas en varias verticales**: `PB12` va por ficha con el lock de cada `user + vertical`, y el paso 6 de la 23 lo autoriza el piso en cada una.
- **`pausaTerminadaEn`**: los siete caminos de fin de pausa escriben `fin_real`; una pausa vencida sin reanudar queda con `detenida: sí` y la marca el motivo 8; una segunda pausa y una pausa en otra vertical se resuelven por `(user, vertical)` y por el más tardío.
- **La versión de plazos después de una pausa**: la de la ficha, en `nucleo/02`, `D/12` y `V/02` §4.2; la fila de `listing` de `V/02` §2.5 dice la regla general, y la excepción está en el mismo capítulo.
- **Los plazos**: cinco sin valor, piso de 60 en la regla 4 del panel, alargar no alcanza, cota de `G-R5-B` atada al plazo 2; coherentes entre `nucleo/02`, `nucleo/08` §3 (la 22), `V/20` y `DEC-DATA-008`.
- **La limpieza por estado de Linear**: los diez estados caen en una de las dos ramas, con `In Review` como única excepción.
- **El cierre de HOS-1352**: la tercera entrada sale en el mismo commit que reescribe las tres carpetas, y hasta entonces cubre a las sub-specs ya cerradas.

## Resumen

14 mecanismos verificados: 6 limpios y 8 con hallazgo. Once hallazgos:

- **VC-VT-01 · BLOQUEA**: `G8` falla en ~1229 archivos de código vivo que ni la lista ni la limpieza de `V1` cubren.
- **VC-VT-02 · BLOQUEA**: la 24 (de `V8`) se condiciona sobre una fila viva, que verticales no puede evaluar.
- **VC-VT-03 · BLOQUEA**: tras cancelar un `ACTIVE`, la fila queda `CANCEL_SCHEDULED` (viva) y la 24 se rechaza hasta un ciclo.
- **VC-VT-04 · BLOQUEA**: los avisos de retención cuentan sobre `inactiva_desde` y el contrato les pide el más tardío.
- **VC-VT-05 · MENOR**: la *(d)* de `G-R6-B` no ve a quien consulta la pausa e ignora `pausaTerminadaEn`.
- **VC-VT-06 · MENOR**: el correo de `PB12` con la línea extra puede suprimirse o ir al seudónimo si la 24 corre enseguida.
- **VC-VT-07 · MENOR**: la baja manual de un Partner no dice qué pasa con su presencia.
- **VC-VT-08 · MENOR**: la escritura `C` y la prueba del corte guardan una versión de plazos que nace en el 3a.
- **VC-VT-09 · MENOR**: la ventana de la cuota no tiene regla cuando muere el título que ancla.
- **VC-VT-10 · MENOR**: la migración a `business` no nombra `alliance_leads.partner_type`.
- **VC-VT-11 · MENOR**: `D/16` dice que la lista sigue en dos, y dos espejos llaman «borrar su cuenta» a la 24.

## Key Learnings

1. Una lista de excepciones de un guard se decidió sobre una premisa (*«sólo las dos historias
   nombran la palabra»*) que nadie midió contra el código: un `git grep` de un minuto daba 1229
   archivos.
2. Pasar un paso manual a una acción del panel la pone bajo las reglas de su épica: la 24 heredó
   una precondición sobre filas de billing que el glosario le prohíbe a verticales.
3. *«Fila viva»* incluye `CANCEL_SCHEDULED`; usarla como *«todavía cobra»* convierte una baja de un
   día en una de diez meses.
4. Cuando una regla elige *«no escribir nada»*, cada lector tiene que leer el campo nuevo, y el
   catálogo de correos es un lector que no está en la tabla de transiciones: por eso se escapó.

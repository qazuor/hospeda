# HOS-1352 · Lote BK a BV para el owner

Salida del triage de los abiertos de la spec consolidada (55 `AB` de los nueve archivos
`_trabajo/abiertos/g*.md` + 37 `EF` de los informes de los redactores y un hallazgo propio). Fuentes
leídas en `f80c0f2715` (sin cambios hasta `ed2a44a166`). Inventario y clasificación: `triage.json`
(lo arma `construir.py` desde `inventario.py`; sale 1 si un abierto queda sin clase). Grafo de cada
opción: `aristas_triage.py` (copia de `41-corte-del-mvp/aristas.py` con flechas extra por
`EXTRA=`), base 60 flechas, 0 violaciones.

Ejemplo fijo: **Juan**, anfitrión de una cabaña en Colón, se suscribe al Básico la semana siguiente
al corte.

Doce preguntas, agrupadas por causa. Lo que no está acá es residuo (se corrige sin preguntar), error
de herramienta o dato operativo con dueño y momento ya escritos (ver el final).

---

## BK · Lo muerto de una decisión que ningún 📌 tacha

**Contexto.** `DEC-METH-019` punto 7 (log:7920) manda adjudicar *«las filas `MIXTO` y los 📌 que
caen en prosa»*. Quedan afuera tres familias con texto superado y sin tachar, que hoy la consolidada
copia enteras:

- las cuatro `SUPERSEDED EN PARTE`, que dicen en su *Estado* qué cae: `DEC-MIG-001` (log:399, *«lo
  que se cae es el destino»*), `DEC-MIG-002` (:2655), `DEC-DATA-002` (:3694, *«se cae que el reloj
  corre durante la pausa»*) y `DEC-MP-003` (:4676, *«se cae el motivo `PROVIDER_DUNNING`»*);
- las precisadas *«por otra decisión»* (log:8002): seis decisiones, siete pares —`DEC-SUB-019`,
  `DEC-METH-006` (metodología, no exige AC), `DEC-MP-008`, `DEC-RF-007`, `DEC-ADDON-003` y
  `DEC-ADDON-004`—, y `DEC-DATA-004`, cuyo cuerpo dice *«cinco consumidores»* (log:4469) cuando su
  propio *Estado* dice seis (log:4450; `V/02` §2.5 l.575-578: *«queda por corregir en el log»*);
- la fila `EX-46` de la matriz (`D/06`:403), que todavía dice que *«el borde la cierra»* durante el
  corte, cuando `D/16`:922-923 ya lo tachó por S-40 y S-45.

El log y la matriz no se editan (`DEC-METH-019`, implicaciones 1 y 4), así que la única vía es la
adjudicación. Ya existe el formato: `DEC-MIG-002#📌1` sale con *«Parte sin efecto»* y «[…]»
(`01-decisiones-vigentes.md`:6543).

1. **Ampliar el punto 7 a esas tres familias**: un veredicto `PARCIAL` con cita y hash, la
   consolidada omite lo muerto con «[…]» y la nota, y el owner revisa sólo lo que cambie el sentido
   (como en AI). Costo: unos trece veredictos y una pasada de `trazar.py`. Riesgo: bajo; lo que cae
   ya está escrito en cada *Estado* o en la decisión que precisa. **Recomendada**: es AI aplicado a
   texto que AI no nombró, sin redactar nada nuevo.
2. Dejar el texto entero con el *Estado* arriba. Costo: cero. Riesgo: quien implementa lee
   `PROVIDER_DUNNING` o *«el reloj corre durante la pausa»* y construye lo que ya no va.
3. Reescribir esas decisiones como texto nuevo en la consolidada. Riesgo: es redactar diseño, que el
   punto 8 prohíbe.

*Juan* pausa dos meses. Con la 2, quien implementa `V6` lee en `DEC-DATA-002` que el reloj de
retención corre durante la pausa y archiva su ficha al día 90; con la 1 esa frase no está y manda
`DEC-DATA-006`. Grafo: no lo toca.

---

## BL · Una pieza anterior llama a algo que construye una posterior

**Contexto** (todo verificado):

- `S36` (`B5`) *«dispara `S18`»* (`B/03`:186); `S6` por su tercer evento: *«la sucesora la corta
  `S31`»* (:156); `S7` y `MP5`: *«lo aplica `S38`»* (:157, :1875). `S18`, `S31` y `S38` son de
  `B8b` (`B/desc`:820, :829, :836), y el *«Lista cuando»* de `B7` pide *«las SEIS ramas … tres con
  `S18`»* (:1020).
- La rama de sucesión de `S1` queda *«sin ruta hasta `B8b`»* (Z; `B/desc`:803) y no dice si su cuerpo
  se escribe en `B3`.
- La mitad `fichaPurgada` de la cuarta comprobación (`B/09`:601-611, `B5`) corre `A6`, que es de
  `B10` (`D/16`:961).
- El aviso *«al archivar»* sale con el acto de `PB4`/`PB5` (`V6`, corte), pero los tres avisos son de
  `V9b` (`V/desc`:73), y la Fase 1 es aditiva (`D/16`:1063-1064); la única excepción declarada es AU.
- El punto 8 del *«Lista cuando»* de `B1` *«ve el grace vencer»* (`B/desc`:1014), y el grace es de
  `B7` (:141), posterior en el grafo.

AS ya dijo que esas ramas *«se implementan enteras al corte sobre el esquema vacío»* y movió `S20`,
`S21`, `S32` y `S33`; Z dejó `S18`, `S31`, `S38` y el cierre de la sucesión en `B8b`, con `G-R1-C`.

1. **Regla: la pieza anterior escribe su rama entera y la llamada contra una interfaz interna, y la
   posterior trae la implementación sin tocar código anterior; si lo llamado ya existe cuando llega
   la anterior, la anterior lo hace entero; y un criterio que necesita la implementación real va al
   *«Lista cuando»* de la posterior.** Aplicada: `B5` y `B7` llaman a `S18`/`S31`/`S38` por
   interfaz y prueban con filas sembradas que la llamada ocurre, y `B8b` la implementa; `B3` escribe
   la rama de sucesión de `S1` sin ruta y `B8b` agrega la ruta; `B5` escribe la cuarta comprobación
   entera y llama a `A6` por interfaz, y `B10` la implementa; `V6` encola el aviso *«al archivar»*
   con su plantilla en `PB4`/`PB5` (el outbox ya existe: `U2→V6`) y `V9b` suma los dos previos y el
   job; el punto 8 de `B1` pasa al *«Lista cuando»* de `B7`. Costo: bajo. Riesgo: interfaces sin
   implementación real hasta la Fase 2 o 3, inalcanzables al corte (sin ruta de sucesión no hay
   predecesoras; sin venta de destaques no hay instancias `LISTING`). Grafo: sin flechas nuevas, 0
   violaciones. **Recomendada**: cumple AS (rama entera), Z (lo llamado sigue en `B8b`) y *«aditiva»*
   sin otra excepción como AU.
2. La posterior agrega la llamada cuando llega. Costo: nulo al corte. Riesgo: rompe *«aditiva»* —`B8b`
   edita `S36`, `S6`, `S7` y `MP5`, `V9b` edita `PB4`/`PB5`— y pide excepciones nuevas; el
   *«Lista cuando»* de `B7` no se puede demostrar al corte.
3. Mover al corte lo llamado, como AS hizo con `S20`. Costo: alto (`B5`/`B7` con el cierre de la
   sucesión, `B5` con `A6`). Riesgo: contradice Z y AA, y `G-R1-C` llegaría después del código que
   vigila. Dejarlo como dependencia en vez de moverlo no cierra: `B8b→B5`, `B10→B5` y `V9b→V6` dan
   violación y ciclo, y `B7→B1` da ciclo (verificado).

*Juan* revoca a los cinco días (`S36`). Como no hay ruta de sucesión hasta `B8b`, no pudo pedir
Premium: la llamada a `S18` existe y no se ejerce sobre su fila. Si su cabaña queda inactiva, el
aviso *«al archivar»* le llega desde `V6`, con o sin `V9b`.

---

## BM · El cambio de precio al corte (acción 19)

**Contexto.** `DEC-ARCH-001`: la versión de plan, precio incluido, es inmutable (log:205-209), y
`B/02` §2.1 (l.34-36) dice *«cambiar un precio crea una versión nueva»*. Pero la acción 19 es *«el
monto de una `billing_option` de una versión de plan»*, y sobre una versión con clientes *«va por
`DEC-MP-002`»* (`NUCLEO/08`:209). `DEC-MP-002`: el aumento rige ya para los nuevos y alcanza a los
existentes tras 60 días, con tres contactos (al anunciar, a 30 y a 7), mutando en la fecha de cada
uno y registrando a quién. Al corte nadie lo aplica: *«el aumento y la migración»* son de `B12`
(Fase 3, `B/desc`:693), aunque el *«Lista cuando»* de `B2` dice que fijar un precio mayor *«anuncia
el aumento con la fecha de cada uno»* (:689). Y un monto por debajo de ARS 15 *«no es aplicable por
este camino»* (`DEC-MP-001` impl. 4, log:1080).

1. **Al corte, la acción 19 fija precios sólo sobre una versión sin clientes; sobre una con clientes
   se rechaza y se publica una versión nueva (la acción de `V2`) con sus precios, que rige para las
   altas nuevas (`DEC-MP-002`, parte 1). El aviso y la mutación a los ya anclados (parte 2) llegan
   con `B12`, y esa cláusula del *«Lista cuando»* de `B2` pasa al de `B12`. Un monto menor que ARS 15
   se rechaza con su mensaje**, como el canje bajo el piso (owner, 4b y 9g). Costo: un aumento a la
   cartera existente espera a la Fase 3. Riesgo: bajo; al corte la cartera son las cinco cuentas más
   las altas nuevas, y `DEC-MP-002` impl. 1b ya prevé que un aumento tarda en rendir. Grafo: sin
   flechas (`V2→B2` ya existe). **Recomendada**: respeta `DEC-ARCH-001` y no anuncia nada que nadie
   va a aplicar.
2. `B2` anuncia al corte y `B12` aplica, con una regla como AC: `B12` mergeada antes del segundo
   contacto (día 30) del primer aumento anunciado. Costo: un gate de fecha más sobre la Fase 3.
   Riesgo: si la Fase 3 se atrasa, un cliente avisado no recibe los otros dos contactos, contra
   `DEC-MP-002`.
3. `B2` trae el job que muta en la fecha. **Inviable**: el job lee suscripciones (`B3`), muta por el
   adaptador (`B1`) y encola (`U2`), y `B2` va antes que `B3`; `B3→B2` da ciclo (verificado).
4. Editar el monto de la `billing_option` vigente. Riesgo: rompe `DEC-ARCH-001` y el *«demostrable
   contra un registro»* de `B/02` §2.1.

*Juan* está anclado a la versión 1 del Básico. La semana del corte, el `SUPER_ADMIN` sube el
mensual. Con la 1, las altas nuevas se anclan a la versión 2 con el precio nuevo y Juan sigue pagando
el de la 1 hasta que `B12` le avise con su propia fecha, por lo menos 60 días después.

---

## BN · Qué pieza crea una tabla que usan dos piezas del corte

**Contexto.** AP decide el esquema de lo posterior y AV puso `payment` en `B5`, *«su primer
llamador»*, pero nada decide entre dos piezas del corte:

- `manual_payment` e `idempotency_key` están en `B/02` §2.3 (l.381, :384), capítulo de `B5`
  (`B/desc`:139), y las usa antes `B3`: `S1` abre la primera cuota del pagador manual y `INV:D4`
  persiste la clave antes de llamar al proveedor;
- `reconciliation_mark_payment` está en §2.2 (l.58), capítulo de `B3`, con FK a `payment` o a
  `manual_payment`;
- el índice parcial de `refund` (`B/02`:380, `B5`) lo exige `B6` (`B/desc`:140, :1019);
- `domain_event` (`NUCLEO/02`:262) no tiene pieza, y `V9a` escribe en ella desde el día del corte
  (`V/desc`:72). Hoy no existe en el código (búsqueda sobre el worktree).

1. **Regla: cada tabla nace con todas sus restricciones (AD) en la primera pieza del grafo que la
   escribe o la referencia. Si una FK suya apunta a una tabla que nace después, nace con la dueña de
   la tabla destino, y la rama que la escribe se completa ahí y se prueba con filas sembradas (AS).**
   Aplicada: `B3` crea `manual_payment` e `idempotency_key`; `B5` crea `payment` (AV), `refund` con
   su índice parcial y `reconciliation_mark_payment`, y completa la rama de `S14` que cuelga un pago;
   `V9a` crea `domain_event` (INFERIDO: ninguna pieza anterior la escribe). Costo: mover tres tablas
   de capítulo. Riesgo: bajo; todo sigue antes del corte. Grafo: sin flechas (verificado).
   **Recomendada**: es el criterio de AV, *«su primer llamador»*, hecho regla.
2. Cada pieza crea las tablas de su capítulo, y quien las usa antes espera. **Inviable**: `B5→B3`
   da ciclo (verificado). La variante que pasa las ramas de `S1`, `S3` y `S16` a `B5` deja a `B3` sin
   el pagador manual, y su *«Lista cuando»* no se cumple en su PR.
3. Una migración única con todo el esquema al principio. Costo: alto. Riesgo: contradice el reparto
   por pieza de AP y AV, y la fila de `U1` (*«ningún código nuevo»*).

*Juan* se suscribe: `B3` persiste su clave de idempotencia antes de llamar a Mercado Pago. Si revoca,
su devolución nace en `refund` con el índice que impide dos devoluciones de la misma orden esperando
su id.

---

## BO · Cómo se revoca una cortesía temporal

**Contexto.** La acción 1 es *«otorgar o revocar una cortesía temporal»*, y revocar *«deja al
cliente sin la cortesía que le quedaba»* (`NUCLEO/08` §3), pero en `B/03` §3.2 ninguna fila sale de
`PAUSED · COURTESY` por una revocación: `S10` (llega el fin o la persona vuelve antes), `S35`, `S22`
y `S6`. `S10` es de `B8b` y la acción 1 es de `B9b`; las dos están en la Fase 2.

1. **Revocar es reanudar antes del fin por un acto del `SUPER_ADMIN`: un tercer evento de `S10`, con
   `fin_real` y la relectura, sin reembolso y con el aviso a la persona; lo agrega `B9b`, con su fila
   en `B/19` §4.** Costo: una cláusula y su test. Riesgo: bajo; reusa el reloj de `S10`. Grafo: sin
   flechas (`B8b→B9b` ya existe). **Recomendada.**
2. Una transición propia `PAUSED · COURTESY → ACTIVE`. Costo: una fila y su test. Riesgo: duplica
   `S10`.
3. Sacar *«revocar»* de la acción 1. Costo: un 📌. Riesgo: una cortesía dada por error dura hasta su
   fin.

A *Juan* le otorgan por error seis meses de cortesía. Con la 1, el `SUPER_ADMIN` la revoca, su
suscripción vuelve a `ACTIVE` y el correo le dice qué día se le cobra.

---

## BP · Cuándo se corta el Turista VIP que el plan nuevo hereda

**Contexto.** `DEC-ENT-004` (log:683-684): *«Se corta el VIP en el acto y no se devuelve lo ya
pagado. El beneficio lo sigue teniendo gratis por el plan nuevo»*, con el motivo *«el servicio no se
interrumpe»*. No dice qué acto, y `B/03` §3.2 no tiene la fila (lo que la tabla no declara no se
escribe, `NUCLEO/03` §1 regla 1). BC le dio la pieza: `B3`, dueña de `S1` y `S2`.

1. **En `S2`, cuando el plan comercial pasa a `ACTIVE`, con una cláusula nueva que cancela la
   suscripción de Turista VIP, con el correo antes.** Costo: una cláusula y su test. Riesgo: bajo.
   **Recomendada**: es la única que cumple *«el servicio no se interrumpe»*: en `S1` el plan todavía
   no da nada.
2. En `S1`, al nacer la fila pendiente. Riesgo: si la ventana vence (`S3`), queda sin VIP y sin plan,
   sin devolución.
3. Al primer pago acreditado. Riesgo: lo dispara un evento de `B5`, posterior a `B3`; dejarlo en
   `B3` pide `B5→B3`, ciclo (verificado), así que pasaría a `B5`, contra BC.

*Juan* también pagaba Turista VIP. Si abandona el checkout del Básico, conserva el VIP que pagó; si
lo autoriza, el VIP se corta en ese momento y el Básico se lo sigue dando.

---

## BQ · Qué cubre el ensayo del corte

**Contexto.** El ensayo es verde *«cuando cada verificación que este §4.2 nombra pasó, en su
orden»* (`D/16`:146, :1055), y la rama de aborto es parte del §4.2 (l.432-494), pero ninguna línea
dice que el ensayo la recorra; el momento 3 sólo pide releer *«las dos situaciones que una
restauración no deshace»* (:1050). Y el paso 0 son *«tres cosas y ninguna en producción»*, pero la
medición de `EX-49` lee la distribución de dominios de la tabla de usuarios de producción y es gate
del corte real (:1064).

**Q1. ¿El ensayo recorre la rama de aborto?**

1. **Sí, una vez, en `staging`, sobre la misma copia: una falla provocada después del 1b, y se
   verifica restaurar el 2b, la imagen vieja, los inversos (b) y (c) y la regla del 0b puesta hasta
   el reintento.** Costo: una corrida más del ensayo. Riesgo: ninguno sobre producción.
   **Recomendada**: es la única red que ve esa rama antes del día del corte.
2. No: la rama corre por primera vez, si hace falta, el día del corte. Riesgo: una restauración
   nunca probada, sobre producción.

**Q2. ¿Con qué etiqueta se registra la medición de `EX-49`?**

1. **`prod`**: lee datos de producción, no muta nada, y es gate del corte real. **Recomendada.**
2. `staging`, a la letra de *«ninguna en producción»*. Riesgo: se da por medido sin haber leído la
   tabla real.

*Juan* todavía no existe el día del corte: si el 1b deja sin cancelar el débito de una de las tres
cuentas y se aborta, las cinco cuentas esperan el reintento con el sitio en sólo lectura. Y si
después Juan se registra con una casilla de Outlook con puntos, la lista medida sobre producción
decide si su seudónimo los ignora.

---

## BR · Los correos: la flecha de `U2` y las filas que faltan

**Contexto.** *«El correo se encola dentro de la transacción de dominio»* (`NUCLEO/07` §1.1), y el
outbox es de `U2`, que *«va antes de las primeras unidades que encolan, `V6`, `V9`, `B4` y `B12`»*
(§1.4, l.69-70). Pero encolan antes `B3` (el correo *«antes de cancelar»* y el de alta,
`B3.md`:757), `B5` (:686), `B7` (:515) y `V4` (los avisos del trial, `V4.md`:453), y `aristas.py`
sólo tiene `U2→V6`, `V9a`, `V9b`, `B4` y `B12`. Con eso, `B3` o `V4` se pueden mergear antes que
`U2`. Lo mismo `V7` (el aviso de reclamo, `PP2`, y el rechazo, `PP3`). Y el catálogo de correos no
tiene fila para los dos correos inmediatos a `SUPER_ADMIN` (`NUCLEO/08`:518): el `refund` de una
revocación que llega a `FAILED` (`RF5`) y el `COBRO_DUPLICADO` (motivo 20).

1. **Dos flechas, `U2→B3` y `U2→V4`, que por transitividad cubren `B5`, `B6`, `B7`, `B8a`, `B11`,
   `B13a`, `V5` a `V9b` y `V7`; y dos filas en el catálogo del §6: *«reembolso de revocación
   fallido»* y *«cobro duplicado detectado»*, transaccionales, no suprimibles, a `SUPER_ADMIN` y al
   producirse el evento** (dueña `B11`, por `DEC-OBS-001`). Costo: dos flechas, dos filas y su
   plantilla. Riesgo: ninguno; `U2` sólo depende de `U1`. Grafo: 63 flechas, 0 violaciones y sin
   ciclo (verificado). **Recomendada.**
2. Las flechas, y una sola fila genérica *«evento grave»*. Riesgo: el correo no dice qué hacer en
   cada caso.
3. Sin flechas: `U2` se mergea por costumbre antes que `B1`. Riesgo: nada lo impide; una pieza que
   encola sin outbox no compila o no manda.

*Juan* abandona el checkout: `S3` le encola el correo del alta sin completar en el outbox de `U2`,
que existe porque `B3` lo espera.

---

## BS · Regla para los detalles que las fuentes dejan a la implementación

**Contexto.** Diecinueve abiertos piden cosas que las fuentes no fijan a propósito o porque son de
implementación: la ruta, el permiso y el `error.code` de cada acto y de cada rechazo (las acciones
3, 4, 8, 11, 13, 14, 18 y la 24 por precondición, el plazo que contradice a otro, el Turista VIP
heredado que BJ dejó abierto, las rutas de `B2`, `B3` y las nueve de billing); el nombre de la
tabla del outbox y de la bitácora; dónde vive `coberturaPerdidaEn`; el plazo de `processing`, la
frecuencia de envío y la cadencia del job de la ventana; dónde vive el script del SQL generado y el
caché del conjunto efectivo; las listas que viven en el código (las diez variables de `U1-021`, las
tres tablas de `is_featured`, las variables de Mercado Pago); el texto de los avisos que la fuente
deja a producto; los labels de Linear; quién escribe la sección del checklist de smoke de cada fase
posterior; y las credenciales y el monto del pago chico del 4b. `B/19` dice que no conviene
anticipar los endpoints (*«Lo que este capítulo NO cierra»*).

1. **Lo propone el PR de la pieza dueña siguiendo lo escrito del repo, lo aprueba la revisión de
   contexto fresco del momento 1 (y el owner en el PR cuando es texto al cliente o un permiso nuevo),
   y queda escrito en la sección de la pieza en la consolidada al mergear.** Lo escrito del repo:
   `apps/api/docs/route-architecture.md` (tres tiers), `apps/api/docs/error-contract.md` (el orden, y
   un `error.code` propio por causa en cada rechazo de regla de negocio), `PermissionEnum`,
   `@repo/i18n`, el registro de `packages/config`. Defaults: las listas que viven en el código las
   saca el PR del código o del registro y las lista en su descripción; `kind-spec` más las `area-*`
   de cada fila; cada pieza posterior escribe la sección de su fase en el checklist, con el formato
   de `B13a`; credenciales por variables de entorno de la sesión de quien opera, nunca versionadas;
   el monto del 4b lo aprueba el owner antes del ensayo, como el del 5c. **No entra en la regla** lo
   que es regla comercial (va a la base, PDR §9) ni lo que cambia comportamiento. Costo: bajo.
   Riesgo: dos piezas nombran distinto el mismo rechazo; lo ataja la revisión. **Recomendada.**
2. Una tabla única de rutas, permisos y códigos antes de la primera pieza. Costo: una vuelta de
   diseño. Riesgo: anticipa lo que `B/19` dice que no conviene.
3. Convención sin registro. Riesgo: la consolidada deja de ser la única fuente (`DEC-METH-019`).

*Juan* pide la baja estando en grace: el PR de `B8a` fija la ruta del tier protegido y, si el estado
no la admitiera, el código, y los deja escritos en `B8a`.

---

## BT · Las mediciones de producción que nadie corrió

**Contexto.** Dos premisas de migraciones del corte dependen de datos de producción sin medir:
si `partners` tiene dos filas con el mismo `owner_user_id` no nulo (el `UNIQUE` parcial de AB;
*«Lo que la propuesta no pudo verificar»*, punto 1; `V/02` §2.7 dice *«cero filas»*, medido antes),
y cuántas filas vivas tienen el rol de dueño de comercio, sus permisos y la tabla de contactos que
`U1` borra *«después de mover sus filas vivas»*, sin destino escrito (`V/desc`:496).

1. **Regla: la pieza que las necesita mide con `hops psql --target=prod`, en sólo lectura y contando,
   antes de su merge, y deja el número en el PR. Si da cero, no hay nada que decidir; si no, vuelve al
   owner con el número antes del merge.** Una salida vacía de `hops psql` no es un cero: se repite.
   Costo: una consulta por caso. Riesgo: ninguno. **Recomendada.**
2. Confiar en las mediciones viejas. Riesgo: la migración se rompe en el ensayo.
3. Que la migración decida sola (deduplicar o reasignar). Riesgo: una regla de datos sin decisión
   que puede vincular mal un Partner o perder un contacto.

A *Juan* no lo alcanza: es anfitrión y no tiene rol de comercio. Si la medición encontrara una cuenta
con el rol viejo por una ficha de Gastronomía, el owner decide a dónde va con el número a la vista.

---

## BU · Dónde vive la ventana `N` del resumen de conciliación

**Contexto.** `DEC-OBS-001`: *«un resumen cada `N` minutos … `N` es configuración (§9)»*. El PDR §9
(l.615-650) dice que la configuración del dominio sale de la base y nunca de variables de entorno ni
de constantes. La lista de plazos de `NUCLEO/02` §1.5 es cerrada y no la incluye.

1. **Una clave más en la tabla versionada de plazos de billing (`B2`), que cambia la acción 22, con
   valor inicial que fija el owner antes del merge de `B11`.** Costo: sumar una clave a la lista
   cerrada. Riesgo: bajo. Grafo: `B2` va antes que `B11`. **Recomendada**: es la única que cumple §9.
2. Una variable de entorno. Riesgo: contradice §9; cambiarla pide un redeploy.
3. Una constante. Riesgo: contradice *«configuración»*.

Un incidente de webhooks abre cien eventos sobre la suscripción de *Juan*: el `SUPER_ADMIN` recibe un
resumen a los `N` minutos que dice la versión de plazos vigente, no cien correos.

---

## BV · La fecha límite de la Fase 1

**Contexto.** `V9b` tiene que estar mergeada antes de *«la primera fecha en que un aviso de retención
podría salir»* (AC, AW), *«según los plazos que el owner fija antes del merge de `V6`»*
(`V/desc`:73), sin la cuenta. Las fichas del corte nacen con `inactiva_desde` = el instante del
corte (`NUCLEO/01`, fila `C`), y el primer aviso de `V9b` es el previo al archivado.

1. **Límite = instante del corte + plazo 1 − plazo 4, con la versión 1 de los plazos; la Fase 1 se
   mergea a producción antes de esa fecha, y el gate de la fase la verifica contra ese número.**
   Vale con BL-1, porque el aviso *«al archivar»* ya sale desde `V6`; con BL-2 el límite baja a
   corte + el menor entre el plazo 1 y el `N` de `PB5`. Costo: ninguno. Riesgo: bajo; cada reloj
   guarda la versión con que arrancó, así que un cambio de plazo posterior no adelanta la fecha.
   **Recomendada.**
2. Esa fecha menos un margen fijo (por ejemplo, dos semanas). Costo: un número más. Riesgo: bajo.
3. Sin fórmula: lo decide el owner a ojo. Riesgo: el primer aviso puede salir sin código.

La ficha de *Juan* nace después del corte, así que su reloj arranca más tarde: el límite lo ponen las
cinco fichas que escribe el corte.

---

## Lo que no va al owner

### Residuos de fuente (22, verificados; se corrigen sin preguntar)

Dos vías. El log y la matriz no se editan (`DEC-METH-019` impl. 1 y 4): sus residuos van por
**adjudicación** (`PARCIAL` en `_trabajo/adjudicacion.json`, como `DEC-MIG-002#📌1`). El resto se
corrige **en la fuente**, como AY, y eso pide un SHA congelado nuevo y otra pasada de `inventario.py`,
`adjudicar.py` y `trazar.py`, porque los hashes de línea caducan. El texto exacto de cada uno está en
`triage.json` (campo `correccion`).

| id | vía | dónde | qué | autoridad |
|---|---|---|---|---|
| AB-g1-2 | adjudicación | DEC-ARCH-017#📌1 (log:7833) | sumar a lo muerto «promos y cortesías, `B9a`» | BG |
| EF-g5-1 | adjudicación | DEC-ARCH-014#📌7 (log:7561-7564) | la cola es del 📌6 (letra F) | su propio `Origen` |
| EF-g5-3 | adjudicación | DEC-TRIAL-010#📌1 (log:6155) | «igual que `T7`»: `T7` salió | N7 |
| EF-g6-1 | adjudicación | DEC-DATA-005#📌6 (log:6068-6069) | `CANCEL_SCHEDULED` sí traba la 24 | lote D (`NUCLEO/08`:214) |
| AB-g3-1 | fuente | `B/20`:510, :517-519 | M8 tiene fila: `EX-51` | C13 (`D/06`:408) |
| EF-g5-2 | fuente | `V/desc`:496 | `G16` nace en `B1` | F-8V3D1-003 (`D/16`:769-772) |
| EF-g6-2 | fuente | `V/desc`:67, :711 | la migración de `partners` es de `V6` | AB, AP |
| EF-g2-1 | fuente | `nucleo/01`:714 | ocho → nueve | R4, R20 |
| EF-g2-2 | fuente | `nucleo/02`:250-252 | `V9` → `V6`; `V8`/`B13` → `V8a`/`B13a` (inferido) | BD, Z |
| EF-g2-3 | fuente | `nucleo/04`:207-210 | `E-ADDON-04` está cerrado | `B/16` §4 |
| EF-g2-4 | fuente | `D/12`:1518-1521 | el nombre del package está decidido | `DEC-ARCH-015` |
| EF-g2-5 | fuente | `D/12`:1127, :1132, :1188, :1284, :1558 | piezas sin partir | Z, AC, BD |
| EF-g2-6 | fuente | `D/12`:79 | el capítulo 13 ya no existe | `DEC-MP-006` |
| EF-g2-7 | fuente | `B/desc`:344 | `B8`/`B9` → `B8b`/`B9b` | Z |
| EF-g2-8 | fuente | `B/desc`:404-405 | `V6` llega antes que `B10` | Z, AW |
| EF-g2-9 | fuente | `B/desc`:440-441 | once piezas; `B8a`/`B8b` | Z |
| EF-g8-1 | fuente | `V/20`:63, `B/20`:393 | `G-R2-C` es de `B4` | AA, AV |
| EF-g8-2 | fuente | `B/03`:186, `B/16`:793-795 | once, sin ordinales | C8 |
| EF-g9-1 | fuente | `B/desc`:145 | `S20` es de `B9a` | AS, AV |
| EF-g9-2 | fuente | `B/desc`:1027 | `A3` no reenvía | lote E (`B/03`:2536) |
| EF-g9-3 | fuente | `B/desc`:149 | pausas con regalo neto positivo | L3 |
| AB-g9-2 | fuente (mapeo inferido) | `B/desc`:152 y §2.12 | cada superficie con la fase de su acto | BH, AU |

### Errores de redacción o de herramienta

- **`cobertura.py`, `tipos()`** (AB-g4-1, AB-g5-12, AB-g7-12): los tipos *«derivados del texto»* por
  `MIG_RX` y `SMOKE_RX` atan a la dueña aunque la pieza no tenga nada que probar con ese tipo. El
  arreglo: un tipo de migración derivado del texto obliga sólo si la dueña crea el esquema; si no,
  pasa a la pieza de *«también»* con rol `provee` (`V6` para `PASO:3`/`3a`; `B3` para
  `DEC-MP-009`); para `CORTE` se queda en smoke manual o guard (BE); el smoke deducido por la palabra
  sale (`GATE:M1`). `V6.md` ya tiene los tests de migración (l.805-932).
- **`trazar.py`, R17** (AB-g2-1): que cuente todo `Origen:` del archivo, no sólo los de bloques
  anclados (R6 sigue mirando los bloques de ítem). Sin verificar corriendo el script.
- **Redacción** (lo resuelven las fuentes): `S14` lee promos por el monto esperado del motivo 24
  (`B/09`:185) y cortesías por el motivo 12 (AB-g7-5); *«compra»* es la identidad
  `UNIQUE(dueño, producto, objetivo)` sobre `addon_instance` (`B/02` §2.4; AB-g7-6); `V5` retira
  `USER_IMPERSONATE` con el precedente de `U1` (`V/17` §4.3: enum recreado más migración de datos;
  AB-g6-1, inferido); la dueña del `db:migrate` de las bases de desarrollo y de tests ya es `V1` en el
  mapa (AB-g5-8).
- **Sin acción**: `D/06`:303 y :418-436 (prosa de `RF-1` y la fila huérfana ya saldada; la matriz no
  se toca); `DEC-MIG-002#📌1` (ya adjudicado, falso positivo); `D/16`:291 (ya tachado y explicado);
  la dueña de `ACC:22` (convención de una sola dueña, con `V6` en *«también»*).

### Datos operativos con dueño y momento escritos

- **Los plazos 3, 4, 7, 8 y 9** (AB-g2-2 = AB-g6-7): quedan en `80-abiertos` con dueño **el owner**
  y momento **antes del merge de `V6`** (`DEC-DATA-008#📌5`, log:7359; `NUCLEO/02`:194). La migración
  del paso 3 falla con uno vacío (`DEC-DATA-008#📌3`), así que `V6` no cierra sin ellos.

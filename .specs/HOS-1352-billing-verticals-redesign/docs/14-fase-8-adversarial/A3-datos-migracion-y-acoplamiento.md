---
title: "FASE 8 · A3 — datos, migración, huecos y acoplamiento"
linear: HOS-1353
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 8
---

# FASE 8 · A3 — datos, migración, huecos y acoplamiento

Pasada adversarial A3 sobre la épica **HOS-1353**, con el núcleo y la frontera como material de
apoyo. El encargo es el del §65: **intentar romper el diseño** antes de que exista código.

**Límite declarado de esta pasada**: la FASE 5 no está hecha, así que la migración se ataca contra
lo **medido** —`07-facts-inventory.md` del 2026-09-15, re-verificado el 2026-09-17— y nunca contra
el código legacy, que no leí. Ningún hallazgo de abajo depende de cómo está escrito el sistema
actual; los que rozan ese terreno lo dicen en su propio texto.

Diecisiete hallazgos: **5 CRITICA**, **6 ALTA**, **4 MEDIA**, **2 BAJA**.

---

## CRITICA

### F-8A3-001 — La fuente `GRANT` no guarda qué otorga, así que *Free Forever* no otorga nada

**Qué se rompe** — `cobertura()` puede devolver una fuente de tipo `GRANT`, y el paso 6 de la
autorización no tiene de dónde leer qué capacidades da. Un *Free Forever* firmado por
`SUPER_ADMIN` deja a la persona **cubierta y sin un solo entitlement**: pasa el paso 5 y falla el
6 en todas las claves.

**El camino.**

1. `SUPER_ADMIN` otorga un grant permanente a un User sin suscripción (§35, `DEC-GRANT-001`).
2. Billing escribe la fila de `permanent_grant` y emite el aviso de cambio de cobertura.
3. El User intenta publicar. La resolución del capítulo 17 §1.2 llega al paso 5: `cobertura()`
   responde `cubierto: sí`, `fuentes: [{ tipo: GRANT, versiónDePlan: ?, hasta: sin fecha }]`.
4. El paso 6 pregunta qué otorga esa fuente. El contrato dice que lo sabe por el puntero
   `versiónDePlan` — y un grant **no tiene versión de plan**: el glosario lo modela como entidad
   independiente justamente para que no sea un plan.
5. `permanent_grant` tampoco guarda claves: su fila no tiene ni una columna de entitlement ni de
   limit. No hay tercera opción: la agregación del capítulo 15 no tiene qué agregar.

**Dónde lo permite el diseño.**

- `HOS-1354-…/docs/02-modelo-de-datos.md` §2.4 — la fila completa de la entidad:
  *«`permanent_grant` | beneficiario, scope de verticales, `includesAddons`, quién lo firmó,
  motivo, suscripciones afectadas (§35.4)»*.
- `HOS-1352-…/docs/12-contrato-de-cobertura.md` §2.1 — *«`versiónDePlan` | **la referencia, no los
  valores** | el paso 6: es cómo verticales sabe qué otorga esa fuente»*.
- `HOS-1352-…/docs/nucleo/01-glosario.md` §1.5 — *«**Grant permanente** | *Free Forever*. Sólo
  `SUPER_ADMIN` (§35). **Se modela como entidad independiente, no como un plan**»*.
- `HOS-1352-…/docs/nucleo/01-glosario.md` §5 — la figura pone *«Grant permanente (§35, con su
  scope de verticales)»* como fuente de la agregación, al mismo nivel que la versión de plan.

**Severidad** — `CRITICA`. El contrato entrega un puntero que para esta fuente no existe, y la
entidad que lo reemplazaría no guarda el dato. Se arregla en el modelo, no en el código.

**Necesita decisión del owner** — **sí**. Hay dos desenlaces con consecuencia distinta: que un
grant apunte a una versión de plan (y entonces *Free Forever* es «este plan, gratis y para
siempre», con el problema de qué pasa cuando esa versión se retira), o que declare su propio juego
de claves (y entonces hay una segunda forma de declarar entitlements, que es lo que el §9 y el
capítulo 02 §1.2 vienen a impedir). No es una elección técnica.

---

### F-8A3-002 — Ningún lugar guarda el valor de un addon: el ejemplo del §37 no se puede almacenar

**Qué se rompe** — *«plan 20 fotos + addon 30 = 50»* es el ejemplo con el que el PDR define la
acumulación y con el que el capítulo 15 abre. El **30** no tiene columna en ninguna entidad de
ninguna de las dos épicas. La estrategia `SUMA` suma el valor del plan con nada.

**El camino.**

1. Un administrador crea un producto de addon *«+30 fotos»*. `addon_product` guarda *capability,
   precio, recurrencia, verticales compatibles, duración, tipo de scope*. Escribe la capability
   —la clave— y **no tiene dónde escribir el 30**.
2. Un User compra el addon. `addon_instance` guarda *producto, dueño, objetivo, estado, inicio,
   fin, su suscripción de complemento*. Tampoco.
3. El capítulo 15 §2.2 resuelve el limit de fotos: `SUMA` sobre las fuentes vivas. La versión de
   plan aporta 20 vía `plan_version_limit`; el addon aporta una clave sin valor.
4. El resultado es 20, o 20 más un valor inventado en el código — que es configuración comercial
   en código, prohibida por el capítulo 02 §1.2.

Y hay un segundo filo en el mismo camino: `addon_product` guarda **una** `capability`, singular.
Un addon que otorgue una capacidad booleana **y** suba un limit no se puede expresar, y el §39
—*«capability, precio, recurrencia, verticales compatibles, duración, efectos, tipo de scope»*—
nombra *efectos* en plural, que el modelo no tiene.

**Dónde lo permite el diseño.**

- `HOS-1354-…/docs/02-modelo-de-datos.md` §2.4 — *«`addon_product` | capability, precio,
  recurrencia, verticales compatibles, duración, tipo de scope (§39, §40)»* y *«`addon_instance` |
  producto, dueño, **objetivo** (ficha, suscripción de vertical, usuario o global), estado,
  inicio, fin, su suscripción de complemento si es recurrente»*.
- `HOS-1353-…/docs/15-entitlements-y-limits.md` §2.1 — *«El ejemplo del §37 es plan 20 fotos +
  addon 30 = 50, y para las fotos está bien»*.
- `HOS-1352-…/docs/nucleo/01-glosario.md` §1.6 — *«**Addon: producto** | La definición: capability,
  precio, recurrencia, verticales compatibles, duración, **efectos**, tipo de scope (§39)»*. El
  glosario declara *efectos* y la tabla del modelo no lo instancia.

**Severidad** — `CRITICA`. Es el modelo de datos contra el comportamiento en su forma más directa:
un capítulo describe una cuenta que el modelo no puede hacer.

**Necesita decisión del owner** — **no**. Es un campo faltante; la FASE 9 lo cierra decidiendo de
qué lado de la frontera vive: el valor de un addon es configuración de capacidades —o sea
verticales, por el criterio de la partición §2— y la tabla que lo guardaría está en billing.

---

### F-8A3-003 — El trial de por vida se apoya en `user_id`, y el borrado cambia el `user_id`

**Qué se rompe** — el invariante §64.1 está declarado como sostenido **por la base**, y la
restricción declarada es `UNIQUE(user_id, vertical)`. Esa restricción no puede impedir un segundo
trial de la misma persona después de un borrado de cuenta, porque la cuenta nueva tiene otro
`user_id`. El hash del correo —que es el dato que sí lo impediría— **no lleva ninguna restricción
de unicidad en el modelo**, así que el bloqueo queda en un camino de servicio que nadie declaró.

**El camino.**

1. Una persona consume su trial de Alojamiento. Queda la fila de `trial` con su `user_id`, sus
   fechas y el hash del correo normalizado.
2. Pide el borrado de su cuenta. Al día 180 —o antes, si el pedido de supresión llega antes,
   caso que el capítulo 22 §2.3 declara posible— se borra el `user` y la fila de `trial`
   sobrevive, por regla explícita.
3. Se registra de nuevo con **el mismo correo**. Se crea un `user` con un `user_id` nuevo.
4. Publica una ficha. La condición de T1 es *«no hay trial previo para ese `user + vertical`»*, y
   con el `user_id` nuevo **no lo hay**. La restricción `UNIQUE(user_id, vertical)` acepta la
   segunda fila sin objeción.
5. Trial nuevo entregado, con el capítulo 04 §2.1 afirmando que la base lo impedía.

**Dónde lo permite el diseño.**

- `HOS-1352-…/docs/nucleo/04-invariantes.md` §2.1 — *«| 1 | trial máximo una vez por `user +
  vertical`|`UNIQUE(user_id, vertical)`en`trial`, **sin condición de estado** |»*.
- `HOS-1353-…/docs/02-modelo-de-datos.md` §2.2 — la única restricción declarada de la entidad es
  esa misma, y el hash aparece como columna sin restricción: *«…y **el hash irreversible del
  correo normalizado** (§4.1) | **`UNIQUE(user_id, vertical)`** — sin condición de estado»*.
- `HOS-1353-…/docs/02-modelo-de-datos.md` §4.2 regla 2 — *«**La fila de `trial` sobrevive al
  borrado de la cuenta.** Es la única entidad de este modelo que lo hace»*.
- `HOS-1353-…/docs/22-lo-legal.md` §3.2 — *«**Se guarda un hash irreversible del correo
  normalizado, no el correo.**… comparar un candidato contra lo consumido»*. La comparación está
  escrita; la restricción que la haría inevitable, no.

**Esto no es la implicación 1 de `DEC-TRIAL-004`**, que ya concede que *«se esquiva con una segunda
dirección de correo»*. Acá el correo es **el mismo**, y es exactamente el caso que el capítulo 22
§3 dice haber cerrado.

**Severidad** — `CRITICA`. El capítulo 04 clasifica este invariante en el nivel **base**, que es
el único nivel que *«no admite ningún camino que lo esquive»*, y el camino existe. La
clasificación es lo que se rompe, no sólo el dato.

**Necesita decisión del owner** — **no** para el defecto. **Sí** de refilo: la respuesta legal
pendiente (§3.3 del capítulo 22) decide si el hash puede existir, y con ella se decide si el
invariante baja de nivel o desaparece.

---

### F-8A3-004 — La migración deja afuera las tres relaciones con trial y transcribe dos que no lo tienen

**Qué se rompe** — el conjunto que el capítulo 21 transcribe —*«cinco relaciones»*— no coincide
con el conjunto de personas que consumieron un trial. Tres usuarios con trial quedan sin fila y
reciben un trial nuevo en el sistema nuevo; dos cortesías perpetuas quedan descritas por una regla
que sólo sabe escribir filas de `trial`.

**El camino.**

1. El inventario medido del 2026-09-15 cuenta **ocho** suscripciones vivas: 3 `trialing`
   (alojamiento, con trial), 2 `comp` (alojamiento, **sin** trial), 2 `abandoned` (alojamiento,
   **con** trial) y 1 `abandoned` (turista, **con** trial).
2. El propio inventario titula *«Detalle de las cinco que importan»* y lista las 3 `trialing` más
   las 2 `comp`. Las tres `abandoned` no entran.
3. El capítulo 21 §2.2 adopta ese cinco: *«Son cinco relaciones y se transcriben una por una a
   mano»*. La tabla de §2.3 tiene exactamente dos filas: *«su trial sigue corriendo»* y *«su trial
   ya terminó»*.
4. **Los tres `abandoned` tienen `trial_end` no nulo** y no se transcriben. En el sistema nuevo
   publican una ficha, T1 encuentra que *«no hay trial previo»*, y reciben un trial completo.
   Son 3 de los 22 usuarios de producción.
5. **Las dos `comp` no tienen trial** y sí tienen `current_period_end` en el **año 2126**: son
   servicio perpetuo sin vínculo con el proveedor. La regla de §2.3 no las describe —no hay trial
   que transcribir— y ninguna de las dos mitades del capítulo 21 dice que se conviertan en un
   `permanent_grant` o en un `courtesy_grant`. Si se transcriben literalmente según §2.3 se
   escriben como trial; si no se transcriben, esas dos personas pierden su concesión.

**Dónde lo permite el diseño.**

- `HOS-1352-…/docs/07-facts-inventory.md`, «Suscripciones vivas» — la tabla que cuenta
  `abandoned | alojamiento | 2 | 0 | **2**` y `abandoned | turista | 1 | 0 | **1**` en la columna
  *«con trial»*, y el encabezado *«Detalle de las cinco que importan»* que las excluye.
- `HOS-1353-…/docs/21-migracion.md` §2.2 — *«**Son cinco relaciones y se transcriben una por una a
  mano** (`DEC-MIG-001`: cero código de migración)»*.
- `HOS-1353-…/docs/21-migracion.md` §2.3 — la tabla de dos filas, ambas condicionadas a que exista
  un trial.
- `HOS-1352-…/docs/04-open-decisions.md`, bloque **Migración** — *«no hay criterio de corte porque
  no hay cohorte: son cinco filas y se transcriben a mano»*. El cinco está congelado en el registro
  de huecos, no sólo en el capítulo.

**Severidad** — `CRITICA`. Tres trials regalados y dos concesiones perpetuas sin destino escrito,
sobre una base de 22 usuarios. Y el número «cinco» está citado en cuatro documentos, así que el
error no se corrige en un lugar.

**Necesita decisión del owner** — **sí** para las dos `comp`: decidir en qué instrumento del modelo
nuevo aterriza un servicio perpetuo heredado es una decisión comercial, no una transcripción.
**No** para las tres `abandoned`: son filas que faltan.

---

### F-8A3-005 — Dos de las nueve máquinas de estado no tienen entidad en ningún modelo de datos

**Qué se rompe** — la **Postulación de Partner** —la novena máquina, con tres estados y tres
transiciones— y la **Presencia de Partner** —declarada entidad distinta de `Ficha`, *«con su propio
ciclo de publicación»*— no aparecen en ninguna de las tres mitades del capítulo 02. La consecuencia
operativa más concreta: **un Partner Gold que deja de pagar no se despublica**, porque `PB2` mueve
`listing` y su presencia no es un `listing`.

**El camino.**

1. El capítulo 01 §2.2 declara nueve máquinas y agrega la postulación con su razón escrita.
2. El capítulo 03 §11 le da tres transiciones, y el capítulo 18 §2 le agrega datos obligatorios:
   el correo postulado, la marca de *atrasada* pasados N días, la espera configurable tras un
   rechazo, y el estado *aprobada sin reclamar* que el panel del §48 tiene que listar.
3. El capítulo 02 de verticales define, en §2.5, **una sola** entidad de publicación: `listing`.
   Una búsqueda por `postulaci` y por `presencia` sobre las tres mitades del capítulo 02 —núcleo,
   verticales y billing— no devuelve una sola línea.
4. La máquina de Publicación del capítulo 03 §9 se abre diciendo *«Es la máquina de la ficha»*.
   `PB2` la mueve *«se pierde la cobertura»* → `UNPUBLISHED_BY_BILLING`.
5. Un Partner Gold cae en `SUSPENDED`. `cobertura()` pasa a `no`. `PB2` recorre sus `listing` y
   no encuentra ninguno: Partner no publica fichas. **Su página sigue online.**
6. Lo mismo al revés con la postulación: sin entidad, los dos controles que el capítulo 18 declara
   —*«nada vence por tiempo, así que la visibilidad es el único control»*— no tienen sobre qué
   filas correr.

**Dónde lo permite el diseño.**

- `HOS-1352-…/docs/nucleo/01-glosario.md` §1.2 — *«**Presencia de Partner** | La página propia de
  Partner Gold (§17.1). El §17.1 ordena **no** forzarla al modelo `Ficha` pese al parecido, así que
  es una entidad distinta con su propio ciclo de publicación»*.
- `HOS-1353-…/docs/02-modelo-de-datos.md` §2.5 — la sección entera: una tabla con una fila,
  `listing`.
- `HOS-1353-…/docs/03-maquinas-de-estado.md` §9 — *«Es la máquina de la ficha»*.
- `HOS-1353-…/docs/19-superficies.md`, «Lo que este capítulo NO cierra» — *«**El ciclo de
  publicación de la presencia de Partner** (cap. 18…): que existe y que la da el plan Gold está
  decidido; **cómo se publica es diseño de producto, no de billing**»*. Es el hueco reconocido y
  empujado fuera de las dos épicas: ni el 18 ni el 19 lo toman.
- `HOS-1353-…/descomposicion.md` §2, unidad **V7** — *«la postulación con su máquina, la presencia
  como entitlement booleano, y el reclamo por correo»*, sin ninguna entidad que crear y sin guard.

**Severidad** — `CRITICA`. Una máquina de estados sin columna de estado no es una máquina, y el
capítulo 03 §1 regla 2 del núcleo lo dice con esas palabras. Además deja una superficie pública
pagada que no se apaga al dejar de pagarse.

**Necesita decisión del owner** — **no** para la postulación: es una tabla que falta. **Sí** para
la presencia: si su ciclo de publicación es el mismo de `listing` o uno propio cambia si `PB2`
puede reutilizarse, y eso es la diferencia entre una entidad y cuatro estados nuevos.

---

## ALTA

### F-8A3-006 — Cinco valores de configuración que los capítulos exigen «en base» no tienen dónde vivir

**Qué se rompe** — el §9 y el capítulo 02 §1.2 son terminantes: ningún valor en código. Cinco
valores por vertical que los capítulos declaran configurables no tienen columna en ninguna
entidad, y la única entidad candidata —`vertical`— está declarada como espejo del enum y nada más.
Al implementar, los cinco terminan como constantes en código y `G3` no los ve, porque `G3` verifica
**claves**, no valores.

**El camino** — los cinco, cada uno con su capítulo:

1. **El techo de días de trial acumulados.** Capítulo 11 §3.2: *«**Cada vertical declara un máximo
   de días de trial acumulados por `user + vertical`**, en base y no en código (§9)»*. No hay
   columna. `plan_version` guarda *«días de trial»*, que es otra cosa: la duración inicial.
2. **El evento de activación de cada vertical.** Ítem 1 del Eje 2, tabulado en `DEC-TRIAL-006` y
   condición de T1 —*«la vertical declara evento»*—. No hay columna.
3. **La espera entre un rechazo de postulación y la siguiente.** Capítulo 18 §2.2: *«hay una espera
   configurable… (§9: es configuración, no una constante)»*. No hay columna ni entidad.
4. **El `N` de `PB5`.** Capítulo 03 §9: *«`DEC-TRIAL-007`; `N` es configuración»*. No hay columna.
5. **Los overrides del plan de trial.** El capítulo 02 §2.1 los usa en la derivación —*«más los
   overrides declarados (`DEC-TRIAL-001`)»*— y el §3.2 los trata como mutables, con su propio
   evento de invalidación: *«| cambia un override del plan de trial | la derivación deja de dar lo
   mismo |»*. No hay entidad que los guarde, y si vivieran en `plan_version` no podrían cambiar:
   `plan_version` es inmutable por `DEC-ARCH-001`, y entonces «cambiar un override» sería
   «publicar una versión nueva», que ya es **otra** entrada de esa misma lista de siete.

**Dónde lo permite el diseño.**

- `HOS-1353-…/docs/02-modelo-de-datos.md` §2.1 — *«| **`vertical`** | el espejo en base del enum de
  código | el guard de §1.2 verifica las dos direcciones |»*, y la fila de `plan_version` con sus
  seis columnas: *«`rank`, si es vendible, días de grace, días de trial, si permite pausa, si
  hereda Turista VIP»*.
- Las cuatro citas de arriba, en sus capítulos.

**Severidad** — `ALTA`. Falla en producción de la forma más previsible: configuración comercial en
código, que es la causa que el §1 del PDR nombra para abrir este programa.

**Necesita decisión del owner** — **no**. Son columnas o una tabla de configuración por vertical.
Lo que sí necesita decisión es el punto 5, porque cruza con la inmutabilidad de `plan_version`.

---

### F-8A3-007 — `T4` es una escritura de billing sobre una máquina de verticales

**Qué se rompe** — el contrato de cobertura declara que lo único que billing le empuja a verticales
es un aviso, y que lo único que verticales le pregunta a billing es un hecho. `T4` viola las dos
direcciones a la vez: un promo o una cortesía —instrumentos de billing, capítulo 14— **escriben la
fecha de fin de un trial**, que es una entidad de verticales, y además re-agendan su campaña. No
es una lectura de cobertura: es un comando.

**El camino.**

1. Un User en `TRIAL_ACTIVE` de Gastronomía canjea un promo de extensión (§32).
2. El promo es de billing: `promo_code` y `promo_redemption` son entidades de
   `HOS-1354-…/docs/02-modelo-de-datos.md` §2.4.
3. `T4` tiene que ejecutarse sobre la fila de `trial`, que es de verticales: correr la fecha de
   fin y **re-agendar** la campaña previa.
4. Antes de escribir hay que evaluar el techo del capítulo 11 §3.2, que es configuración de
   verticales, y decidir si se rechaza entera (§3.3: *«Se rechaza entera. No se trunca, y el promo
   no se consume»*) — o sea que verticales tiene que poder **devolverle un veredicto a billing**
   que decide si el canje se consume.
5. Ninguna de esas dos direcciones está en el contrato. El aviso de cobertura no sirve: la
   cobertura **no cambió** —seguía y sigue cubierto por el trial—, sólo se movió una fecha.

**Dónde lo permite el diseño.**

- `HOS-1353-…/docs/03-maquinas-de-estado.md` §2 — *«| T4 | `TRIAL_ACTIVE` | **promo de extensión o
  cortesía** | `TRIAL_ACTIVE` | sólo durante `TRIAL_ACTIVE` (§32) | corre la fecha de fin;
  **re-agenda** la campaña previa |»*.
- `HOS-1352-…/docs/12-contrato-de-cobertura.md` §3 — *«Es lo único que billing le **empuja** a
  verticales»*, sobre el evento de cambio de cobertura.
- `HOS-1352-…/docs/11-particion-del-programa.md` §3 — *«**Nada más cruza la frontera.** … Si mañana
  aparece un quinto lugar que necesita algo de billing y no es este hecho, es una señal de que el
  corte se está filtrando y hay que mirarlo, no resolverlo en el lugar»*.
- La partición §3.2, punto 3, **ve la mitad del problema y no la otra**: *«El techo de días de
  trial cuenta una fuente de tres… porque esas dos todavía no existen. El número no cambia; cambia
  cuántas cosas suman contra él»*. Declara que las fuentes faltan; no declara que cuando existan
  van a necesitar **escribir** del otro lado de la frontera.

**Severidad** — `ALTA`. No rompe la épica de verticales por sí sola —mientras billing no exista,
`T4` sólo la dispara un `SUPER_ADMIN`—, pero el día que billing se «enchufa» descubre que el puerto
es de sólo lectura. Y el mismo camino existe para la reparación del capítulo 11 §2.3, donde
verticales necesita **pedir** una cortesía.

**Necesita decisión del owner** — **no**. Es el contrato que le falta una operación; la FASE 9
decide su forma.

---

### F-8A3-008 — Las filas migradas nacen sin campaña, sin piso de trinquete y sin hash

**Qué se rompe** — `T1` no es sólo un cambio de estado: declara tres efectos y el modelo declara
tres columnas que sólo `T1` llena. La regla de migración es *«el estado se transcribe, no se
reinterpreta»*, que es exactamente **no** ejecutar la transición. Las filas migradas quedan
estructuralmente distintas de las nativas y nada las distingue.

**El camino.**

1. Se transcribe a mano la fila de un `trialing` cuyo trial sigue corriendo, en `TRIAL_ACTIVE` con
   su fecha de fin.
2. **La campaña previa no se agenda**, porque agendarla es un efecto de `T1`. Esa persona no
   recibe los avisos de 10, 5, 2 y 0 días — que el capítulo 07 §4.1 clasifica como
   **transaccionales no suprimibles**, o sea correos que teníamos la obligación de mandar.
3. **El piso del trinquete queda vacío.** El modelo pide *«referencia a las versiones vigentes al
   arrancar (el piso del trinquete)»*, y las versiones vigentes cuando ese trial arrancó, en
   agosto de 2026, no existen: el catálogo nuevo se siembra durante la implementación. Sin piso,
   `DEC-TRIAL-002` no tiene contra qué comparar, o compara contra las versiones de hoy y protege
   algo que no es lo prometido.
4. **El hash del correo normalizado queda vacío**, y con él el único bloqueo que `DEC-TRIAL-004`
   reconoce. Esas cinco personas pueden borrarse y volver (ver `F-8A3-003`, que acá se agrava:
   ni siquiera hay hash que consultar).
5. Nada marca la fila como migrada —y es deliberado: §2.3 dice *«No hace falta una marca de «viene
   de antes»»*—, así que las columnas vacías se leen como un defecto de escritura, no como una
   procedencia.

**Dónde lo permite el diseño.**

- `HOS-1353-…/docs/03-maquinas-de-estado.md` §2 — los efectos de `T1`: *«se asigna el plan de
  trial; arranca el reloj; **se agenda la campaña previa del §10.7**»*.
- `HOS-1353-…/docs/02-modelo-de-datos.md` §2.2 — las columnas: *«referencia al plan de trial,
  **referencia a las versiones vigentes al arrancar** (el piso del trinquete), inicio, fin y **el
  hash irreversible del correo normalizado**»*.
- `HOS-1353-…/docs/21-migracion.md` §2.3 — el título de la sección: *«La regla de transcripción:
  el estado se transcribe, no se reinterpreta»*, y su tabla, que escribe estado y fecha y nada más.

**Severidad** — `ALTA`. Son cinco filas, pero son **las únicas cinco** que existen: el 100 % de la
cartera inicial del sistema nuevo nace con tres columnas vacías.

**Necesita decisión del owner** — **no**.

---

### F-8A3-009 — Nadie ejecuta la migración: no es una unidad de trabajo, y cada mitad delega en la otra

**Qué se rompe** — la migración es un capítulo de las dos épicas y **no es una unidad de ninguna**.
La descomposición de verticales tiene nueve unidades y ninguna la incluye; la mitad billing del
capítulo 21 delega el procedimiento en una sección que vive en la épica de verticales, que a su
vez declara que el procedimiento *«es FASE 7»*. Al llegar el día, no hay dueño ni orden.

**El camino.**

1. `HOS-1353-…/descomposicion.md` §2 lista V1 a V9. El capítulo 21 no aparece en la columna
   *capítulos* de ninguna, y §4 —*«lo que cada unidad tiene que dejar demostrado»*— no tiene una
   sola línea sobre las cinco filas.
2. `HOS-1354-…/docs/21-migracion.md` §3.2 punto (a) dice, sobre las cinco relaciones vivas:
   *«se coordinan a mano (`DEC-MIG-001`) y **se transcriben según §2.3**»*. El §2.3 no está en ese
   documento: está en la mitad verticales.
3. El núcleo declara que *«las dos épicas no se referencian entre sí»* y que lo único que cruza es
   el contrato de cobertura. Esta referencia cruzada no es el contrato.
4. La mitad verticales cierra con *«Cómo se ejecuta la transcripción de las cinco —quién, cuándo,
   con qué verificación— es FASE 7: acá está qué se escribe, no el procedimiento»*. Las dos mitades
   apuntan hacia afuera.
5. Además hay un orden que nadie declara y que no es indiferente: las filas de `subscription`
   (billing) anclan una `plan_version` (verticales, unidad V2), así que la mitad billing de la
   migración **no puede correr antes** de que verticales haya sembrado el catálogo. Ninguna de las
   dos mitades lo dice.

**Dónde lo permite el diseño.**

- `HOS-1353-…/descomposicion.md` §2, la tabla de nueve unidades y §4, la tabla de criterios.
- `HOS-1354-…/docs/21-migracion.md` §3.2 (a), citado arriba.
- `HOS-1352-…/docs/nucleo/00-indice.md` — *«**Y las dos épicas no se referencian entre sí.** Lo
  único que cruza es el contrato de cobertura»*.
- `HOS-1353-…/docs/21-migracion.md`, «Lo que este capítulo NO cierra».

**Severidad** — `ALTA`. Un procedimiento manual de cinco filas es barato **si alguien lo hace**.
Repartido entre dos épicas que se declaran no referenciadas, es el candidato natural a
descubrirse el día del despliegue.

**Necesita decisión del owner** — **no**.

---

### F-8A3-010 — El §65 exige `jobs` y la épica de verticales no define ni uno

**Qué se rompe** — `jobs` es un área obligatoria del §65 y el índice del núcleo la asigna a *«cada
subdominio»*. El capítulo 03 del núcleo repite la delegación. **Ningún capítulo de verticales
define un job**: no hay horario, no hay idempotencia, no hay qué pasa si una corrida se solapa con
la anterior. Y el diseño depende de cinco relojes que sólo un job puede mover.

**El camino.**

1. Los cinco relojes, todos de verticales: `T3` (*«llega la fecha de fin»*), la campaña previa y la
   de recuperación del §10.7, `PB4` (día 90 de inactividad), `PB5` (N meses de borrador inactivo) y
   el reloj de retención de 90/180 días del capítulo 02 §4.
2. Una búsqueda por `job`, `cron` e `idempot` sobre los once capítulos de `HOS-1353-…/docs/`
   devuelve tres apariciones y ninguna define un job: una es un ejemplo negativo sobre permisos
   (capítulo 17 §3.3), otra es una capa de testing y la tercera es una mención de *«reloj de
   retención»* dentro de otro tema.
3. El capítulo 07 del núcleo deja la obligación explícita y sin dueño: *«**Un proceso que corre en
   UTC tiene que convertir**, y eso incluye a los jobs»*, y la clave de deduplicación de un aviso
   de schedule es `trial:<id>:pre:-2d` — que alguien tiene que calcular en alguna corrida.
4. En producción esto aparece como el modo de falla clásico: dos corridas solapadas mandan dos
   avisos —el capítulo 07 §2 lo previene con una restricción de unicidad, que es la mitad del
   problema— y una corrida caída deja trials vencidos sin expirar, con fichas publicadas sin
   cobertura, que es `PB2` que nunca ocurre.

Lo mismo, con menos consecuencia inmediata, vale para **`services`** y **`API`**: el capítulo 19 de
verticales se titula *«Superficies: API, Web y Admin»* y su §2 —*«Qué lee cada superficie»*—
quedó con **una sola fila**, la de Admin. No hay un endpoint nombrado en toda la épica.

**Dónde lo permite el diseño.**

- `HOS-1352-…/docs/00-PDR.md`, FASE 2 — la lista de áreas obligatorias incluye, textualmente,
  `services`, `API` y `jobs`.
- `HOS-1352-…/docs/nucleo/00-indice.md`, «Las áreas que el §65 exige, y dónde quedaron» — *«| jobs |
  cada subdominio |»* y *«| services · API | cada subdominio, más el `19` de cada épica |»*.
- `HOS-1352-…/docs/nucleo/03-maquinas-de-estado.md`, «Lo que esta mitad NO cierra» — *«**Los
  relojes**, como jobs concretos con su horario y su idempotencia, son de cada subdominio»*.
- `HOS-1353-…/docs/19-superficies.md` §2 — la tabla con una fila.

**Severidad** — `ALTA`. Es el hueco que el encargo describe como *«lo que cayó entre dos
capítulos»*: cada capítulo delegó en el siguiente y el último delegó en el núcleo.

**Necesita decisión del owner** — **no**.

---

### F-8A3-011 — El techo de días de trial no se puede hacer cumplir ni mostrar

**Qué se rompe** — el capítulo 11 exige dos cosas del mismo dato: **frenar** una extensión que
supere el techo, y **mostrar** el total acumulado *«con su origen»* en dos superficies. La fila de
`trial` guarda *inicio* y *fin*, y nada más. No hay entidad de extensión, no hay contador, no hay
origen.

**El camino.**

1. Un User recibe una extensión de 10 días firmada por `SUPER_ADMIN` (capítulo 11 §3.4: puede pasar
   el techo) y después canjea un promo de 15 (§3.3: el techo lo frena en seco).
2. Para decidir hay que saber cuántos días acumuló. La fila sólo tiene `fin`, que ya incluye la
   extensión anterior, y `inicio`. La resta da los días **actuales**, que no es lo mismo: los días
   base del plan pueden haber cambiado, y el capítulo 21 §2.1 midió que las duraciones históricas
   ya son heterogéneas —*«una de 30 días y dos de 90»*—.
3. Peor con el origen: §3.5 obliga a mostrar de dónde salió cada día —promo, cortesía o firma de
   `SUPER_ADMIN`—. La resta no tiene origen, y el único registro que lo tendría es
   `domain_event`, que el capítulo 02 §2.6 define como *«qué campos cambiaron — **no una copia del
   contenido**»* y **append-only**: reconstruir un saldo replayando la auditoría convierte al
   registro en una proyección, que es justamente lo que no es.
4. Y hay un desenlace peor que el error de cuenta: el capítulo 11 §3.5 declara que *«Un techo que
   nadie puede consultar antes de otorgar se choca recién al otorgar»*, que es exactamente el
   estado en que el modelo lo deja.

**Dónde lo permite el diseño.**

- `HOS-1353-…/docs/11-trial.md` §3.2 y §3.5, citados arriba.
- `HOS-1353-…/docs/02-modelo-de-datos.md` §2.2 — la fila de `trial`, completa.
- `HOS-1352-…/docs/nucleo/02-modelo-de-datos.md` §2.6 — la definición de `domain_event`.
- `HOS-1353-…/docs/19-superficies.md` §4, fila 4 — *«Mi Suscripción y el panel | el **total
  acumulado de días de trial** y su origen»*. La superficie está obligada a mostrar un dato que
  ninguna entidad guarda.

**Severidad** — `ALTA`. Es un capítulo que describe una consulta que el modelo no puede responder,
y la superficie que la muestra ya está comprometida.

**Necesita decisión del owner** — **no**.

---

## MEDIA

### F-8A3-012 — `versiónDePlan` es un puntero uniforme que miente para la fuente que hoy es la única

**Qué se rompe** — el contrato entrega `versiónDePlan` como *«cómo verticales sabe qué otorga esa
fuente»*. Para la fuente `TRIAL` —la única que existe durante toda la épica de verticales— ese
puntero apunta a un plan cuyos entitlements y limits **no están guardados**. Un consumidor que haga
lo que el contrato dice —resolver el puntero contra `plan_version_entitlement`— obtiene cero filas
y cero capacidades para todos los usuarios en trial.

**El camino.**

1. `cobertura()` devuelve `{ tipo: TRIAL, versiónDePlan: <la versión del plan de trial> }`.
2. El paso 6 resuelve qué otorga esa versión leyendo `plan_version_entitlement` y
   `plan_version_limit`.
3. El capítulo 02 §2.1 dice que del plan de trial *«Sus limits y entitlements **no se guardan**: se
   derivan en cada resolución»*. Las dos tablas están vacías para esa versión.
4. El resultado correcto sólo sale de un camino distinto —derivar, aplicar overrides, comparar
   contra el piso—, y saber cuál camino tomar exige preguntar *«¿esta versión es la del plan de
   trial?»*, que es una rama que el contrato presenta como inexistente.

**Dónde lo permite el diseño.**

- `HOS-1352-…/docs/12-contrato-de-cobertura.md` §2.1 y §2.3 — *«el contrato devuelve **el puntero y
  nunca los valores**»*.
- `HOS-1353-…/docs/02-modelo-de-datos.md` §2.1 — *«**El plan de trial no es una entidad aparte.**…
  Sus limits y entitlements **no se guardan**: se derivan en cada resolución»*.

**Severidad** — `MEDIA`. Es un borde que quien implemente V4 encuentra en el primer test, y se
resuelve dentro del diseño actual. Pero está en la pieza que el contrato define como su parte *«más
fina»*, así que conviene que esté escrito y no descubierto.

**Necesita decisión del owner** — **no**.

---

### F-8A3-013 — Siete entradas de invalidación, cuatro de billing, y un aviso que no las distingue

**Qué se rompe** — el capítulo 02 §3.2 invalida el caché por siete eventos y el capítulo 15 §4.2
dispara el reconciliador de excedentes con **esa misma lista** —*«una lista, dos consumidores»*—.
Cuatro de los siete ocurren del lado de billing, y el único canal declarado es un aviso de que *«la
cobertura cambió»*. Una de esas cuatro —activar o vencer un addon— **no es un cambio de cobertura**
en absoluto: `addon` no es uno de los cuatro `tipo` del contrato.

**El camino.**

1. Un User cubierto por una suscripción activa compra un addon de *«+30 fotos»*.
2. Su cobertura no cambia: estaba cubierto antes y después, por la misma fuente, hasta la misma
   fecha. El evento del contrato **no tiene qué decir**: ninguna fuente cambió de estado.
3. La entrada 5 de la lista de siete exige invalidar igual: *«| se activa o vence un addon | ídem
   |»*. Sin invalidación, el conjunto efectivo cacheado sigue diciendo 20 fotos.
4. El caso simétrico es peor: cuando el addon **vence**, el conjunto efectivo baja y el
   reconciliador de excedentes tiene que correr. Si no corre, quedan publicadas fotos por encima
   del límite — y el guard `G5` (*«ninguna fuente se apaga sin pasar por el reconciliador»*) es un
   guard **de verticales** que tendría que verificar los efectos declarados de transiciones que
   viven en la épica de billing.

**Dónde lo permite el diseño.**

- `HOS-1353-…/docs/02-modelo-de-datos.md` §3.2 — la tabla de siete entradas.
- `HOS-1353-…/docs/15-entitlements-y-limits.md` §4.2 — *«**es la misma lista que invalida el
  caché** (cap. 02 §3.2), con sus siete entradas. Una lista, dos consumidores»* y *«**El guard**:
  ninguna fuente se apaga sin pasar por el reconciliador. Se comprueba sobre los efectos declarados
  de las transiciones del capítulo 03»*.
- `HOS-1352-…/docs/12-contrato-de-cobertura.md` §2.1 — *«| **`tipo`** | `TRIAL` · `SUSCRIPCIÓN` ·
  `CORTESÍA` · `GRANT` |»*. El addon no está.
- `HOS-1352-…/docs/12-contrato-de-cobertura.md` §3 — *«Lleva qué fuente cambió y en qué
  dirección»*.

**Severidad** — `MEDIA`. El caché fallando hacia sostener una capacidad ya revocada es, por el
propio §3 del capítulo 02, *«un error de seguridad y no de rendimiento»*; pero el camino concreto
aparece recién con addons, que son de la otra épica y llegan después.

**Necesita decisión del owner** — **no**.

---

### F-8A3-014 — Mi Cuenta quedó del lado de billing, y la partición se la había asignado a verticales

**Qué se rompe** — el reparto declara que *Mi Cuenta* va a verticales. El desarme la dejó en la
mitad billing, unida en una fila con *Mi Suscripción*. La mitad verticales del capítulo 19 quedó
con una sola fila —Admin— y sin la superficie principal del usuario. El ítem 3 del Eje 2 —*«Qué
sección aporta a Mi Cuenta»*, que es **comportamiento por vertical**— queda descrito sólo en la
épica que no lo implementa.

**El camino.**

1. Se implementa V8 (*«Superficies»*) leyendo el capítulo 19 de verticales, que es lo que la spec
   de la épica declara autosuficiente: *«ninguno de ellos necesita leer uno de la épica de billing
   para estar completo»*.
2. El capítulo dice qué mira el Admin y qué frases hay que decir. No dice qué lee Mi Cuenta ni qué
   aporta cada vertical a su menú.
3. La descomposición sí la pide —V8 *«Mi Cuenta, los mensajes que hay que decir, el panel de
   postulaciones»*—, así que la unidad tiene un criterio sin capítulo que lo defina.

**Dónde lo permite el diseño.**

- `HOS-1352-…/docs/11-particion-del-programa.md` §4, fila 19 — *«**PARTIDO** — **Mi Cuenta**, los
  mensajes de trial y de excedente y las postulaciones a verticales; la pricing, Mi Suscripción y
  la baja a billing»*.
- `HOS-1354-…/docs/19-superficies.md` §2 — *«| **Mi Cuenta** (§45) · **Mi Suscripción** (§46) | la
  **versión anclada** de la suscripción, su estado, y el conjunto efectivo de entitlements y limits
  |»*.
- `HOS-1353-…/docs/19-superficies.md` §2 — la tabla con una fila, la de Admin.
- `HOS-1353-…/spec.md` §2 — *«**Son de esta épica**: ningún otro documento los contiene, y ninguno
  de ellos necesita leer uno de la épica de billing para estar completo»*.

**Severidad** — `MEDIA`. La verificación del desarme contó **encabezados** —105 de 105— y esto es
una fila de tabla, que es la granularidad que esa verificación no alcanzaba.

**Necesita decisión del owner** — **no**.

---

### F-8A3-015 — Tres capítulos reclaman cerrar el mismo hueco y sólo uno lo contiene

**Qué se rompe** — al partir un capítulo, el frontmatter `cierra:` se duplicó literal en las dos o
tres mitades. La regla del programa es que un hueco se marca cerrado *«con el capítulo que lo
cerró»*, en singular. Hoy `04-open-decisions.md` no puede resolverse contra los documentos: para
varios huecos hay tres candidatos y dos no tienen una línea del tema.

**El camino.**

1. El núcleo `03-maquinas-de-estado.md` declara `cierra: M-SUB-01, M-CONC-02`. Su contenido son
   las seis reglas de lectura. `M-SUB-01` es *«la ventana del preapproval sin autorizar»* —
   materia de billing— y el registro de huecos lo confirma: *«`M-SUB-01` **cerrado por el cap.
   03** (los cuatro estados que pedía, más `ABANDONED`; y las 72 h, la limpieza y el reintento…)»*.
   Nada de eso está en el documento que dice cerrarlo.
2. `21-migracion.md` de verticales y `21-migracion.md` de billing declaran **los mismos tres**
   huecos: `M-MIG-01`, `O-MIG-01`, `R-MIG-01`. El primero está sólo en la mitad verticales; los
   otros dos, sólo en la de billing.
3. Igual con el capítulo 02: las tres mitades —núcleo, verticales y billing— declaran idénticamente
   `C-ARCH-01`, `S-ARCH-01`, `M-ARCH-02` y `M-DATA-01`. `M-ARCH-02` (caché) está sólo en la mitad
   verticales.
4. La consecuencia operativa llega en FASE 9: quien quiera verificar que un hueco está cerrado
   abre el capítulo que lo declara y puede abrir el que no lo tiene.

**Dónde lo permite el diseño.**

- `HOS-1352-…/docs/nucleo/00-indice.md`, «Cuándo un hueco se considera cerrado» — *«Un hueco se
  cierra cuando un capítulo dice qué pasa en todos sus casos, y en el **mismo commit** se marca
  cerrado en `04-open-decisions.md` **con el capítulo que lo cerró**»*.
- Los frontmatter de `nucleo/03`, `HOS-1353/21`, `HOS-1354/21`, y de las tres mitades del `02`.

**Severidad** — `MEDIA`. No falla en producción; falla en la trazabilidad, que es lo único que
sostiene la afirmación *«los 72 huecos están cerrados»*.

**Necesita decisión del owner** — **no**.

---

## BAJA

### F-8A3-016 — Dos conteos que el propio material contradice: nueve pasos sobre siete, 51 sobre 49

**Qué se rompe** — nada en ejecución. Pero los dos números son los que el programa usa como
verificación —*«poder preguntar **una vez** si están todos»*— y ninguno de los dos se puede contar
contra su propia tabla.

**El camino.**

1. El capítulo 17 §1.1 cierra con *«Quedan **nueve pasos** y una precondición»* y la tabla de §1.2
   numera del **1 al 7**. La diferencia está en que la fila 4 agrupa tres verificaciones. Quien
   lea *«el paso 5»* en el contrato de cobertura y en la partición obtiene *«título vivo»* de la
   tabla, que es lo correcto — pero *«el paso 6»* y *«el paso 9»* no se resuelven igual.
2. La spec de la épica repite el nueve y enumera siete: *«**Nueve pasos**… 1. quién es · 2. estado
   de la persona · 3. permiso · 4. el recurso… · 5. **título vivo** · 6. entitlement · 7. limits»*.
3. El índice del núcleo y la spec de la épica dicen *«los 51 invariantes numerados»*; el capítulo
   04 cierra con *«**Cuarenta y nueve invariantes**, y ocho los sostiene la base»*. Los dos son
   correctos bajo criterios distintos —51 filas, 49 invariantes distintos, porque `D3` y `D12` se
   apoyan dos veces— y el capítulo lo explica; lo que no existe es un solo número citable.

**Dónde lo permite el diseño.**

- `HOS-1353-…/docs/17-autorizacion.md` §1.1 y §1.2.
- `HOS-1352-…/docs/nucleo/04-invariantes.md` §5, nota final, contra `nucleo/00-indice.md` («los 51,
  con quién sostiene cada uno») y `HOS-1353-…/spec.md` §2.1.

**Severidad** — `BAJA`. Falta precisión, no falla.

**Necesita decisión del owner** — **no**.

---

### F-8A3-017 — Referencias internas que el desarme dejó apuntando a secciones que se mudaron de épica

**Qué se rompe** — algunas secciones citan `§` que después del desarme viven en la otra épica o en
ningún lado. Quien siga la referencia no encuentra nada, y la regla de escritura del programa
—verificar la cita antes de escribirla— deja de ser comprobable.

**El camino** — tres ejemplos medidos:

1. `HOS-1353-…/docs/02-modelo-de-datos.md` §3.2 justifica una entrada con *«son fuentes
   independientes (§2.4)»*. El §2.4 de ese capítulo no existe: se fue entero a la mitad billing,
   donde efectivamente dice *«**Las concesiones no modifican el plan ni la suscripción: son fuentes
   independientes.**»*.
2. `HOS-1354-…/docs/21-migracion.md` §3.2 (a) remite a *«§2.3»*, que está en la mitad verticales
   (ver `F-8A3-009`).
3. `HOS-1353-…/docs/02-modelo-de-datos.md` salta de §2.2 a §2.5 sin §2.3 ni §2.4, y de §5 a «Lo
   que esta mitad NO cierra» — correcto por el reparto, e indistinguible de un corte accidental
   para quien lo lea sin la tabla de la partición al lado.

**Dónde lo permite el diseño.**

- `HOS-1352-…/docs/11-particion-del-programa.md` §4.1 — declara que los capítulos **sí** se
  movieron y que la verificación fue *«105 de 105 encabezados presentes en alguna mitad»*. Los
  encabezados se verificaron; las **referencias cruzadas** a esos encabezados, no — y la propia
  sección nombra ese riesgo al citar la versión vieja: *«Mover 21 archivos… cuesta el riesgo de
  perder referencias cruzadas —hay decenas—»*.

**Severidad** — `BAJA`.

**Necesita decisión del owner** — **no**.

---

## Ataques que intenté y el diseño resistió

Van acá porque el owner necesita saber qué se probó y aguantó, no sólo qué se rompió.

**1. «El trinquete del plan de trial se puede saltar cambiando el catálogo a mitad de un trial.».**
No: el piso se guarda como *«referencia a las versiones vigentes al arrancar»* y el capítulo 02
§2.2 prohíbe explícitamente copiar valores —*«El piso del trinquete se guarda como referencia a
versiones, nunca como copia de valores»*—, así que republicar una versión peor no mueve el piso.
El ataque sólo funciona sobre las filas migradas, y por otro motivo (`F-8A3-008`).

**2. «Un addon global regala capacidades en la vertical que sólo tiene un trial.»** No: el
capítulo 11 §5.3 lo cierra con una regla explícita —*«Un addon de scope `USER` o `GLOBAL` no aporta
nada a una vertical cuyo único título es un trial»*— y además explica por qué la falta de esa
regla habría roto el §64.7 *«sin que ninguna línea de código diga «trial»»*. Es de los puntos mejor
defendidos del material.

**3. «Una clave de entitlement de una vertical se puede leer desde otra.»** No, y no por un
chequeo: la resolución es por `user + vertical` y **no se puede invocar sin la vertical**
(capítulo 15 §3.2, capítulo 17 §2.2). La defensa es estructural y el guard `G2` la cubre por el
otro lado. No encontré forma de expresar la operación sin el dato.

**4. «Un `UNPUBLISHED_BY_BILLING` se puede confundir con un `DRAFT` y republicarse de más.»** No:
el capítulo 03 §9 separa los dos estados con su razón escrita —*«Si billing bajara la ficha a
`DRAFT`, al recuperar la cobertura no habría forma de saber cuáles republicar»*— y `PB3` sólo sale
del primero. El criterio de V6 en la descomposición lo verifica explícitamente.

**5. «La campaña de recuperación se puede desmentir extendiendo el trial después.»** No: el
capítulo 11 §7 demuestra que el cruce es imposible por construcción —`T3` deja `TRIAL_EXPIRED` y
`T4` exige `TRIAL_ACTIVE`— y lo confirma por las dos vías de extensión por separado. El ataque
requiere abrir un camino que el diseño no tiene, y el capítulo deja escrito que abrirlo reabre
esto.

**6. «El borrado del día 180 destruye la evidencia del trial consumido.»** Parcialmente resistido:
el capítulo 22 §3 **ya encontró** ese defecto y lo corrigió con el hash. Lo que queda sin resolver
no es el borrado sino la restricción, y eso es `F-8A3-003`.

**7. «Las cinco relaciones migradas arrastran duraciones heterogéneas que el modelo no puede
representar.»** No: transcribir **la fecha de fin** en vez de la duración lo disuelve, y el
capítulo 21 §2.3 lo argumenta bien —*«escribir la fecha de fin hace que la heterogeneidad de 30 y
90 días no haya que representarla en ningún lado»*—. El problema de esas filas es otro
(`F-8A3-008`).

**8. «La cortesía se confunde con una pausa del cliente y el reloj la reanuda mal.»** No:
`DEC-GRANT-004` y el capítulo 01 §2.2 imponen motivo obligatorio con dominio cerrado y la regla
*«el reloj que reanuda lee el motivo, nunca el estado del proveedor»*. Es un invariante con dos
apoyos (`D3`), base y servicio.

**9. Sobre las filas `UNKNOWN` de la matriz.** De las 8 vigentes, ninguna condiciona el modelo de
datos de verticales. La única que roza mi vector es **`EX-1`** —si una autorización creada y nunca
completada vence, y si se puede reusar—. **Si vuelve al revés de lo supuesto** (que un `pending`
**no** vence nunca), lo que se rompe no es el modelo sino `F-8A3-004`: las tres filas `abandoned`
dejarían de ser «intentos muertos» y pasarían a ser autorizaciones potencialmente reusables, con
lo cual excluirlas de la migración deja de ser una omisión y pasa a ser un riesgo de cobro. El
hallazgo no depende de esa medición; su severidad sí.

---

## Fuera de mi vector

Lo que vi y le toca a otro agente. No lo desarrollo.

**`NUCLEO` · La excepción del §64.25 tiene un segundo filo que el capítulo 04 no nombra.**
`DEC-MAIL-001` hace que el correo **bloquee** antes de cancelar, y el capítulo 04 §2.5 lo declara
acotado *«al único punto donde el correo del proveedor hace daño»*. Pero el capítulo 07 §5.3 dice
que sale gratis porque *«si el correo falla, no se cancela y se reintenta»* — o sea que un outbox
trabado deja suscripciones viejas vivas indefinidamente junto a las nuevas. Es máquinas y
huérfanos: A2.

**`NUCLEO` · `RECONCILIATION_REQUIRED` está en la máquina de Suscripción y en los efectos de la
regla 1 del capítulo 03.** Esa regla dice que **toda** transición no declarada emite
`RECONCILIATION_REQUIRED` *«si tocaba plata o estado»*, incluidas las de las máquinas de
verticales — que no tienen ese estado. Qué emite un trial cuando alguien intenta una transición
inexistente no está dicho. Es A2.

**Autorización · el paso 2 pregunta por «el estado de la persona»** —inhabilitada, correo sin
verificar— y **ninguna entidad del modelo guarda ese estado**. Lo dejo acá porque el vector de
acceso es de A1, aunque la mitad de datos es mía: la fila faltante es `user`, que ninguna de las
tres mitades del capítulo 02 define.

**Autorización · el actor `Guest` «lleva un UUID real»** en el repo actual y el capítulo 17 §3.3 lo
declara *«un actor del modelo, no la falta de uno»* sin decir cómo se representa. Cruce con el
contrato de error del proyecto. Es A1.

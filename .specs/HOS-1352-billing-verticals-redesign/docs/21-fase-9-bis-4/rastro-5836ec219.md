---
title: FASE 9-bis-4 — Rastro por aparición de la familia de la retención
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 9-bis-4
---

# Rastro por aparición · `5836ec219`

Cumple la parte 2 de `DEC-METH-011`: **por cada aparición que NO se corrigió y que vive en un
párrafo que ninguno de los seis commits tocó**, van el archivo, el §, la cita y **por qué sigue
siendo correcta**. No hay agregados: cada línea se puede tomar sola y mostrarse falsa.

## Los seis commits

| sha | qué cierra |
|---|---|
| `5ac5e92c9` | `F-8eA3-002` — el reloj de inactividad gana columna y deja de leerse del aviso |
| `62a30cafa` | `F-8eA3-001` — la ocurrencia de todo schedule lleva la fecha objetivo |
| `52efd38fb` | `F-8eA2-002` — `S10` gana rama de fallo, y el barrido su quinta comprobación |
| `afa4590c2` | `F-8eA1-001` — el piso otorga *«recuperar lo suyo»* y `PB8` se vuelve ejecutable |
| `8ed89adf8` | `F-8eA2-001` / `DEC-DATA-003` — la segunda rama de `PB3` y `PB7`, y el criterio de orden |
| `5836ec219` | las **tres** apariciones que este mismo recorrido encontró falsas (ver §3) |

## 1. Qué se grepeó

**Términos NUEVOS** (los que las correcciones definen): `inactiva_desde` · *«la respuesta del
contrato»* como fuente del hecho 2 · *«la fecha objetivo vigente»* en la ocurrencia · la **rama de
fallo de `S10`** · la **quinta** comprobación de cero llamadas · *«recuperar lo suyo»* en la
versión de piso · la **segunda rama** de `PB3` y de `PB7` · *«vuelve primero lo que cayó al
final»*.

**Términos VIEJOS que se retiran**, grepeados aparte porque el consumidor no actualizado no
aparece buscando el nuevo: *«el aviso del contrato»* como fuente del hecho 2 · *«monótono»* ·
*«el sujeto más el hito»* · *«cuatro comprobaciones de cero llamadas»* · *«ninguna capacidad
comercial, y la de contratar una suscripción»* (la lista de **dos**) · *«reactivarla
suscribiéndose»* · *«actúa sólo si algo bajó»* · *«por eso `PB3` pide las dos cosas»*.

**Alcance**: los **39 archivos** del corpus —las dos épicas con sus `spec.md` y
`descomposicion.md`, el núcleo, el contrato, el corte, la partición y el decision log—, con y sin
backticks, **incluidos los archivos que los commits tocan**.

**Medido sobre el árbol en `5836ec219`**: **337** líneas con al menos una aparición; **150** en
párrafos que algún commit de esta tanda tocó; **187** en párrafos que ninguno tocó, que son las que
van abajo, una por una. La partición se calculó con los rangos `+` de
`git diff --unified=0 5ac5e92c9^..HEAD`, no a ojo, y las 187 se verificaron contra esta lista: no
falta ninguna y no sobra ninguna.

## 2. Las 187 apariciones no corregidas, una por una

### `NUCLEO/01-glosario.md`

- **L50 · §1.2** — «Los cuatro hechos que reinician la inactividad, y la lista es cerrada» → siguen
  siendo **cuatro**: la corrección le dio al hecho 2 una fuente distinta, no agregó ni quitó hechos.
- **L54 · §1.2, hecho 1** — «un acto del dueño sobre la ficha: … exportarla, reactivarla» → sigue
  correcta **y recién ahora es ejecutable**: `afa4590c2` le dio al dueño sin título la capacidad de
  ejecutar `PB8`, que era el acto que esta celda nombraba y que el paso 6 rechazaba.
- **L56 · §1.2, hecho 3** — «la ficha vuelve a `PUBLISHED` — `PB1`, `PB3` o `PB7`» → sigue correcta:
  la celda enumera **transiciones**, no sus eventos, y las tres siguen siendo las que llevan a
  `PUBLISHED`. La segunda rama de `PB3`/`PB7` las hace disparar más seguido, no las reemplaza.
- **L82 · §1.2** — «Lo que se retira es que el reloj fuera monótono» → sigue correcta y es
  justamente la premisa que `62a30cafa` fue a cobrar: un reloj no monótono es el que obliga a
  meter la fecha objetivo en la ocurrencia.
- **L93 · §1.2** — «se reinicia al salir de ella por el hecho 2» → verdadera; lo que `52efd38fb`
  agregó es la vigilancia de que ese salir **ocurra**, no una excepción a la frase.
- **L95 · §1.2** — «es `D16` (cap. 04 §3)» → sigue correcta: `D16` existe y sigue siendo el
  invariante de esa desigualdad. Su alcance exacto se escribió en `NUCLEO/04` §3, no acá.
- **L199 y L201 · §2.1** — «*«efectivamente inactiva»* … es el término del §1.2» → sigue correcta:
  el término no cambió de definición, ganó una columna donde vivir.
- **L237 · §2.2** — «con borradores ilimitados, sin capacidades comerciales y sin consumir trial»
  → habla de **`PRE_TRIAL`**, no de la versión de piso. La lista que pasó de dos a tres es la del
  piso (`V/02` §2.1); ésta no se tocó.
- **L417 · §3** — «el reloj de inactividad no se detiene durante la pausa» → sigue correcta: la
  corrección no detiene el reloj, le da dónde vivir y de dónde leerse.
- **L419 · §3** — «verdadero sólo mientras 120 < 180 … lo vigila `G-R5`» → sigue correcta para lo
  que afirma. Es **la primera** de las dos premisas; la segunda la nombra la línea siguiente.
- **L421 · §3** — «cada reanudación reinicia el reloj (§1.2, hecho 2)» → sigue correcta, y es
  exactamente la premisa cuya ejecución `52efd38fb` puso bajo vigilancia. El texto afirma el efecto
  de una reanudación que ocurre; no afirma que ocurra siempre.

### `NUCLEO/03-maquinas-de-estado.md`

- **L100 · §1 regla 7** — «`PB7` y `PB8` salen las dos de `ARCHIVED`» → sigue correcta; lo que se
  corrigió, en la misma línea lógica pero en el hunk tocado, es cuántos **eventos** tiene `PB7`.

### `NUCLEO/04-invariantes.md`

- **L67 · §2.2, invariante 24** — «la pausa puede terminar anticipadamente | S10, el mismo reloj
  para el fin previsto y el anticipado» → sigue correcta: `S10` sigue siendo la transición y el
  reloj sigue siendo uno solo. Una rama de fallo no cambia ni el sujeto ni el reloj.
- **L144 · §3** — «`D16` existe porque la alternativa era una premisa que envejece sola» → sigue
  correcta; el párrafo que acota su alcance se agregó debajo, sin contradecirlo.
- **L268, L275 y L278 · §5** — el recorrido del reparto: «`D8 D9 D10 D12 D15 D16` (6)» y «*«diez los
  sostiene la base»* no cambia, porque `D16` es guard» → siguen correctas: `D16` **sigue siendo de
  clase guard** y no se agregó ningún invariante, así que los tres conteos no se mueven. La quinta
  comprobación del barrido **no es un invariante**: vive en `B/09` §3.

### `NUCLEO/07-outbox-y-notificaciones.md`

- **L62, L65 y L68 · §2** — «La clave de deduplicación … `(destinatario, plantilla, ocurrencia)` …
  ocurrencia es lo que identifica *este* envío» → siguen correctas: la clave **no cambió de forma**.
  Lo que cambió es qué es la ocurrencia de un schedule, que es la fila de abajo.
- **L70 · §2** — el encabezado «tipo de correo | qué es la ocurrencia» → correcto; es el
  encabezado de la tabla cuyo contenido sí se corrigió.
- **L218 · §6** — «excedente por downgrade … se despublican las publicadas más recientemente» →
  sigue correcta: es el criterio de **bajada**, que no se toca. Su espejo de subida se agregó como
  fila propia, no reemplazándola.

### `NUCLEO/08-auditoria-y-observabilidad.md`

- **L289 · Lo que NO cierra** — «Qué hace el reconciliador para detectar … es el capítulo 09» →
  sigue correcta: habla del **barrido de conciliación** de billing, no del reconciliador de
  excedentes de verticales. Son dos cosas con nombres parecidos y el § remite al capítulo correcto.

### `11-particion-del-programa.md`

- **L127 y L132 · §3.1** — «el reconciliador de excedentes se prueba entero, disparado por las
  transiciones de trial» / «No se modifica nada de lo construido: se enchufa» → siguen correctas:
  la dirección nueva se dispara con **la misma lista** de siete entradas, así que no agrega ningún
  punto de invocación que la implementación de arranque no ejerza.
- **L134 · §3.2** — el título «Lo que queda inactivo, declarado y no escondido» → *«inactivo»* acá
  es el alcance del programa, no el reloj de la ficha. Homónimo.
- **L174 · §4** — «el §4.1 reutiliza el reconciliador de verticales, no lo duplica» → sigue
  correcta, y con la dirección nueva lo es **más**: hay un solo reconciliador con dos direcciones.

### `12-contrato-de-cobertura.md`

- **L95 · §2.1** — «el reconciliador, que necesita saber si apagar una deja las otras» → sigue
  correcta: describe la dirección de **bajada**, que no cambió.
- **L105 · §2.2** — «Un reconciliador que no vea las demás apaga…» → ídem: argumento sobre apagar.
- **L250 · §2.5** — «Transporta la referencia a la versión de piso de esa vertical» → sigue
  correcta: `BASE` sigue apuntando a la misma versión; lo que cambió es qué otorga esa versión.
- **L559 · §3** — «El evento no reemplaza la consulta. El reconciliador *«no se dispara por evento:
  se dispara por condición»*» → sigue correcta y es **la regla que `5ac5e92c9` fue a cumplir**, no
  una que contradiga.
- **L694 · §5.1** — «la mitad interesante nunca se ejerce: perder la cobertura, `PB2`, el
  reconciliador, el aviso» → sigue correcta: enumera lo que un fail-open no ejerce, y la dirección
  de subida tampoco se ejercería. La lista queda corta hacia abajo, no falsa.
- **L700 · §5.1** — «las dos no vendibles que sí guardan lo suyo — la de pre-trial y la de piso» →
  sigue correcta: las dos siguen guardando sus entitlements, y el piso ahora guarda **uno más**.

### `01-decision-log.md` *(no se edita — `DEC-METH-011` y las reglas de esta fase lo prohíben)*

- **L522 y L529 · `DEC-TRIAL-007`** — «archivado por inactividad» → sigue correcta: `PB5` sigue
  archivando el borrador por inactividad, ahora leyendo `inactiva_desde`.
- **L531 · `DEC-TRIAL-007`** — «sin ninguna capacidad comercial» → es la decisión sobre
  **`PRE_TRIAL`**, no sobre el piso. No la toca `afa4590c2`.
- **L757, L760, L763, L767, L771 y L773 · `DEC-PROMO-001`** — las seis apariciones de *«cupo»* son
  el **cupo de canjes de un código de promoción**. Homónimo exacto del cupo de fichas y sin
  relación con `PB3`/`PB7`.
- **L879 · `DEC-DATA-001`** — «exportarla o reactivarla suscribiéndose» → **es la redacción que
  `afa4590c2` corrigió en los capítulos**, y acá queda como está porque el log es el registro
  fechado de lo que se decidió ese día. El capítulo que la ejecuta —`V/02` §4.2 regla 3— dice ahora
  por qué esa forma describía una salida más angosta que la que el diseño tiene.
- **L892 · `DEC-DATA-001`** — «"archivar" un borrador por inactividad» → sigue correcta.
- **L1146 · `DEC-SUB-007`** y **L1164, L1208 · `DEC-SUB-008`** — «se despublican primero las
  publicadas MÁS RECIENTEMENTE» → siguen correctas: el criterio de bajada no se tocó. El de subida
  es su inverso y se escribió en los capítulos, sin enmendar esta decisión.
- **L1399 · `DEC-CONC-001`** — «un reconciliador que barra los estados intermedios» → habla del
  barrido de billing. Homónimo.
- **L1870 · `DEC-ARCH-003`** — «*«efectivamente inactiva»* y las dos situaciones lo son» → sigue
  correcta.
- **L2115 · `DEC-ARCH-006`** — «reconciliador de excedentes, el aviso de qué se hizo» → ídem L694.
- **L3023 · `DEC-DATA-002`** — «su promesa de que el cliente *«puede reactivarla»* por fin tiene las
  dos filas que la ejecutan» → **sigue correcta y era incompleta, no falsa**: tenía las filas y le
  faltaba el entitlement. Eso es exactamente `F-8eA1-001`, y lo cerró `afa4590c2`.
- **L3027, L3031 y L3071 · `DEC-DATA-002`** — las tres apariciones de *«inactividad»* describen el
  defecto original y el criterio del owner. Siguen siendo el registro correcto de ese día.
- **L3035 · `DEC-DATA-002`** — «`PB7` (`ARCHIVED` → `PUBLISHED`, al volver `cubierto` y haber
  cupo)» → sigue correcta para **la rama que esa decisión creó**; la segunda rama la crea
  `DEC-DATA-003`, que es posterior y está escrita aparte.
- **L3039 · `DEC-DATA-002`** — «cuatro hechos de reinicio y lista cerrada» → siguen cuatro.
- **L3042 · `DEC-DATA-002`** — «monótono» → correcta: es lo que se retiró.
- **L3044 · `DEC-DATA-002`** — «si el cliente vuelve con un plan más chico y el cupo no alcanza, el
  reloj se reinicia igual» → sigue correcta, y es **independiente** de la segunda rama: el reinicio
  cuelga del hecho y no de la transición.
- **L3061 · `DEC-DATA-002`** — «vuelve sola por `PB7` y nunca se borra» → **era falsa para el
  excedente el día que se escribió**, y `8ed89adf8` la volvió verdadera dándole a `PB7` la segunda
  rama. La línea del log se deja como registro; el capítulo dice por qué.
- **L3062, L3063 y L3065 · `DEC-DATA-002`** — las tres sobre `D16`/`G-R5` → siguen correctas: el
  invariante y el guard existen y comparan lo que dicen comparar. Lo que `52efd38fb` agregó es la
  vigilancia de **la otra** premisa, que esta decisión nombra (*«y cada reanudación reinicia»*) y
  no le asigna guard.
- **L3117 · `DEC-ADDON-003`** — «Las comprobaciones de cero llamadas siguen siendo cuatro: se
  ampliaron dos, no se agregó ninguna» → **sigue correcta como afirmación sobre lo que hizo esa
  decisión**: `DEC-ADDON-003` no agregó ninguna. El total pasó a cinco por `52efd38fb`, que es
  posterior, y los tres textos que congelaban el cuatro **fuera** del log se recontaron.
- **L3210 · `DEC-SUB-012`** — «`DEC-DATA-002` acaba de volverlo no-monótono — cuatro hechos» →
  sigue correcta.
- **L3212 · `DEC-SUB-012`** — «crea una segunda dependencia sobre una cifra que `G-R5` no vigila» →
  sigue correcta, y es el **mismo razonamiento** que `52efd38fb` aplicó al tiempo real de una fila.
- **L3408, L3415, L3421, L3422, L3437 y L3438 · `DEC-DATA-003`** — el enunciado de la decisión que
  este commit implementa. Siguen correctas por construcción; lo único que el capítulo escribe y la
  decisión no es **el criterio de orden**, que la propia decisión manda escribir.
- **L3412 y L3416 · `DEC-DATA-003`** — «el reconciliador le despublica tres» / «El reconciliador
  tampoco lo levanta» → describen el estado **antes** del arreglo. Correctas como diagnóstico.
- **L3417 · `DEC-DATA-003`** — «*«actúa sólo si algo bajó»* (`V/15` §4.2)» → **cita textual de lo
  que `V/15` §4.2 decía**, y es la frase que `8ed89adf8` retiró de ese §. La cita del log sigue
  siendo fiel a lo que citaba.
- **L3429 · `DEC-DATA-003`** — «A mano, reusando `PB8`» → alternativa descartada; sigue descrita
  correctamente.
- **L3440 · `DEC-DATA-003`** — «`DEC-SUB-008` ya exige un criterio *«escrito y predecible»*» →
  sigue correcta y es el precedente que el criterio nuevo aplica.
- **L3449 · `DEC-DATA-003`** — «(`S10` sin rama de fallo) y `F-8eA1-001` (`PB8` inejecutable contra
  el piso)» → correcta como enunciado de los críticos que quedaban; los dos están cerrados por
  `52efd38fb` y `afa4590c2`.

### `V/spec.md`

- **L153 · §3.6** — la precisión del paso 4 → **se corrigió en el mismo commit** (hunk tocado) para
  agregarle el paso 6; la línea de la cita queda como estaba porque sigue siendo verdadera.
- **L202 · §3.10** — «Cae lo más reciente primero» → criterio de bajada, intacto; su inverso se
  agregó debajo, en el hunk tocado.
- **L269 · §4.1** — «el reconciliador de excedentes corre disparado por las transiciones de trial»
  → sigue correcta: la dirección nueva usa los mismos disparadores.
- **L277 · §4.2** — título «Lo que queda inactivo» → homónimo, alcance del programa.
- **L312 · §5** — «`G5` | una fuente de entitlements se apaga sin pasar por el reconciliador» →
  sigue correcta **sin cambios**: restituir no apaga ninguna fuente, así que `G5` cuenta lo mismo.

### `V/descomposicion.md`

- **L62 · §2, unidad V9** — «el reloj de 90 y 180 días con sus cuatro hechos de reinicio … y los
  tres avisos | … | el de `D16`» → siguen **cuatro** hechos y **tres** avisos; lo que la unidad gana
  es una columna y una relectura, que no cambian ninguno de los dos conteos ni su guard.
- **L95 y L96 · §2.4** — «lo que hace es despublicar, y su criterio —cae lo más reciente primero—
  sólo se puede verificar con fichas de verdad» → sigue correcta: el argumento es **por qué el
  excedente va con publicación**, y la dirección nueva lo refuerza (también republica fichas).

### `V/02-modelo-de-datos.md`

- **L132 · §2.1** — «…capacidad comercial—, la capacidad de activación de la vertical, y la de
  contratar una…» → es la lista de la versión de **pre-trial**. La que pasó a tres es la del piso.
- **L173 · §2.1** — «El plan de piso tampoco, y tiene el mismo tratamiento que el de pre-trial» →
  sigue correcta: sus entitlements se siguen guardando, ahora uno más.
- **L210 · §2.1** — «si alguien le siembra una clave comercial a la de piso o a la de pre-trial…» →
  sigue correcta: *«recuperar lo suyo»* **no es** una clave comercial, y el aviso del guard vale
  igual.
- **L302 y L309 · §3.2** — las dos entradas de invalidación de caché de las versiones no vendibles
  → siguen correctas y ahora importan más: la tercera cosa del piso también viaja por ahí.
- **L346 y L347 · §4.1** — «Los dos días se cuentan sobre la misma inactividad … los cuatro hechos
  que la reinician» → siguen correctas; la columna se declaró en el párrafo de abajo, tocado.
- **L403 · §4.2 regla 4** — «Lo que reinicia la inactividad es `cubierto` pasando a verdadero» →
  sigue correcta: lo que cambió es **de dónde se lee** ese hecho, no cuál es.
- **L404 · §4.2 regla 4** — «`PB7` no llegue a disparar porque el cupo no alcanza» → sigue
  correcta: con la segunda rama, `PB7` dispara **cuando el cupo vuelva**, y hasta entonces la regla
  4 sigue siendo lo que impide el borrado.
- **L418 · §4.2 regla 4** — «la desigualdad es el invariante `D16`» → sigue correcta.

### `V/03-maquinas-de-estado.md`

- **L48 · §2, `T5`** — «la publicación la restituye `PB3`, por el cambio de `cubierto`» → sigue
  correcta: `T5` es un cambio de cobertura, o sea **la primera** rama de `PB3`.
- **L93 · §2** — «el mismo mecanismo que el §9 ya eligió para `PB2` y `PB3`: atarse al hecho que el
  contrato emite» → sigue correcta para el mecanismo del que habla (el hecho del contrato); la rama
  nueva de `PB3` se ata al recálculo del cupo, que es el otro consumidor de la misma lista.
- **L103 · §2** — «ahora alcanza también a quien … reanuda (`S10`)» → sigue correcta: `T2` mira
  fuentes, y `S10` sigue siendo la transición que devuelve la fuente al reanudar.
- **L234 · §2** — «sin capacidades comerciales y sin consumir trial (`DEC-TRIAL-007`)» →
  `PRE_TRIAL`, no el piso.
- **L293 · §9, `PB2`** — «o el excedente tras un downgrade, que no cambia `cubierto` y sí el cupo»
  → **sigue correcta y es el modelo de la rama nueva**: la de `PB3` es su simétrica exacta.
- **L304 · §9** — «`PB3` enumeraba tres y no conocía `S2`» → registro histórico del arreglo 9 de la
  9-bis-2. Correcto.
- **L354 · §9** — «La distinción es lo que hace posible PB3» → sigue correcta, y con dos ramas
  `PB3` la necesita **más**: sin ella, la restitución por cupo tampoco sabría cuáles subir.
- **L357 y L359 · §9** — el criterio de bajada y su `DEC-SUB-008` → intactos; el de subida está en
  la sección siguiente.
- **L410 · §9** — el encabezado «| `PB7` | `PB8` |» de la tabla comparativa → encabezado; su
  contenido se amplió con la fila *«con qué la autoriza»* en el hunk tocado.
- **L418 · §9** — «`PB7` no puede ignorar el origen, y ésa es toda la razón por la que lo mira» →
  sigue correcta **en las dos ramas**: el borrador de `PB5` no es candidato ni cuando vuelve la
  cobertura ni cuando vuelve el cupo.
- **L433, L434, L435 y L436 · §9** — «Las dos reinician el reloj, y `PB7` ni siquiera hace falta
  que dispare … si el cupo no alcanza y la ficha se queda abajo, el reloj se reinicia igual» →
  siguen correctas, y ahora esa ficha además **tiene cómo volver** cuando el cupo se libere.
- **L442 · §9** — «al reanudar … el reloj se reinicia y `PB7` la republica sola» → sigue correcta;
  la condición de cupo que siempre tuvo se explicitó en los avisos, no en esta frase.
- **L445 · §9** — «Que las dos cifras sigan en ese orden es `D16`» → sigue correcta.
- **L450, L451 y L452 · §9, punto 1** — «`PB7` no es el evento de activación … restituir no es
  publicar» → sigue correcta **en las dos ramas**: la rama del cupo tampoco es un acto del dueño.
- **L458 · §9, punto 3** — «`PB7` no es una transición de la clase del reloj» → sigue correcta; la
  frase que la sostenía (*«la dispara un cambio de cobertura»*) se corrigió en `5836ec219`, que es
  lo que la deja verdadera con las dos ramas.
- **L466 · §9** — «Una ficha publicada y cubierta no acumula inactividad» → sigue correcta.

### `V/10-verticales-planes-billing-options.md`

- **L120 · §2.1** — «las dos no vendibles de cada vertical —la de piso y la de pre-trial— son el
  caso extremo del mismo problema» → sigue correcta: siguen siendo dos y siguen siendo el caso
  extremo; la tercera cosa del piso no es comercial y no cambia ese argumento.

### `V/15-entitlements-y-limits.md`

- **L126 y L163 · §2.6** — las dos apariciones del reconciliador en el pliegue del conjunto → hablan
  del descarte de complementos sin título, o sea de **bajar**. Intactas.
- **L231 · §4.2** — «Enumerar seis puntos de invocación es cómo se olvida el séptimo» → sigue
  correcta: la dirección nueva **no agrega ningún punto de invocación**, usa la misma lista.
- **L253 · §4.2** — «El guard: ninguna fuente se apaga sin pasar por el reconciliador» → sigue
  correcta sin cambios, por la misma razón que `G5` en `V/20` §2.
- **L262 · §4.3** — «El criterio de selección es el mismo que ya fijó `DEC-SUB-008` … cae lo más
  reciente primero» → intacta: es la mitad de bajada, y la de subida se escribió debajo.
- **L293 · §4.4** — «downgrade programado (`DEC-SUB-008`) · vencimiento de un addon · fin de una
  cortesía | sí» → sigue correcta: la tabla enumera disparadores que **quitan**, y la restitución
  no quita. El párrafo que lo dice se agregó debajo.

### `V/17-autorizacion.md`

- **L70 · §1.2, paso 7** — «limits | ¿le queda cupo? | excedido» → el cupo del paso 7 es el mismo
  concepto y sigue igual: `PB3`/`PB7` lo **leen**, no lo cambian.
- **L80, L81 y L84 · §1.2, precisión 1** — «una ficha `ARCHIVED` acepta de su dueño verla,
  exportarla y reactivarla … y entonces la promesa no la puede cumplir nadie y `PB8` es
  inalcanzable» → **siguen correctas y eran insuficientes, no falsas**: hablaban del paso 4. La
  mitad del paso 6 se agregó debajo, en el hunk tocado, sin enmendar ninguna de las tres.
- **L118 · §1.2, precisión 5** — «un guard verifica que las dos versiones no vendibles … no
  otorguen ninguna clave comercial» → sigue correcta: `G-R3` no cambió y *«recuperar lo suyo»* no
  es una clave comercial ni un entitlement medido.
- **L154, L155 y L156 · §2.2** — «esa persona sí tiene una fuente en Alojamiento, la de piso … la
  versión de piso de Alojamiento no otorga ninguna capacidad comercial» → **siguen correctas**, y
  el blockquote que se agregó debajo dice por qué la tercera cosa del piso no abre ese cruce: es
  por vertical y exige ser dueño, que el paso 4 ya comprueba.
- **L253 · §3.4** — «esos tres pasos preguntan por el título, las capacidades y el cupo de alguien
  que no…» → sigue correcta; el sujeto es el actor-reloj y no cambió.
- **L368 · Lo que NO cierra** — «el paso 7 pregunta si queda cupo, no cómo se calculó» → sigue
  correcta y es justamente por qué el criterio de orden vive en el cap. 03 y en el 15, no acá.

### `V/19-superficies.md`

- **L62 · §4, fila 8** — «el aviso de excedente | el criterio: cae lo más reciente primero» → sigue
  correcta: es el aviso de la bajada. El de la subida es la fila 19, agregada.

### `V/20-testing.md`

- **L54 · §2, `G5`** — «una fuente de entitlements se apaga sin pasar por el reconciliador» → sigue
  correcta sin cambios: restituir no apaga nada.
- **L59 · §2, `G-R3`** — «otorga una clave de la clase comercial o un entitlement medido» → sigue
  correcta: la tercera cosa del piso no es ninguna de las dos, y el guard se verificó contra ella
  explícitamente en `V/02` §2.1.
- **L64 y L66 · §2, `G-R5`** — el enunciado del guard y «vigila una desigualdad entre dos números de
  configuración» → siguen correctas, y el párrafo que acota qué **no** vigila se agregó debajo.
- **L97 · §2** — «si alguien siembra una de esas dos versiones con una clave comercial, toda la
  plataforma…» → sigue correcta.

### `V/21-migracion.md`

- **L104 y L121 · §2.4** — «`PB2` les baja las fichas y `PB3` se las devuelve» / «la ficha vuelve
  sola por `PB3` cuando la cobertura vuelve» → siguen correctas: el caso del corte **es** una
  pérdida y recuperación de cobertura, o sea la primera rama de `PB3`.
- **L124, L125 y L126 · §2.4** — «la que la devuelve ya no es `PB3` sino `PB7`, con el mismo
  disparador y el mismo desenlace» → sigue correcta: las dos filas siguen compartiendo disparador
  **y ahora comparten los dos**, así que la frase es más verdadera que antes, no menos.

### `B/descomposicion.md`

- **L221 · §2.4** — «la deduplicación por el id del hecho» → es la deduplicación de **pagos del
  proveedor** (`UNIQUE(proveedor, id_del_hecho)`), no la del outbox. Homónimo.

### `B/02-modelo-de-datos.md`

- **L51 · §2.2** — «La `version` es el contador monótono por recurso» → *«monótono»* acá es el
  contador de versiones del preapproval. Homónimo exacto del término retirado.
- **L232 · §2.3** — «es la deduplicación del cap. 03 §10.2» → la de pagos. Homónimo.
- **L271 · §2.4** — «`promo_code` … cupo total» → el cupo de canjes. Homónimo.

### `B/03-maquinas-de-estado.md`

- **L556 y L573 · §3.2** — «su detector cuesta cero llamadas» y «tercera comprobación de cero
  llamadas» → siguen correctas: la quinta se agregó **al final**, así que ningún ordinal previo se
  mueve. El *«las otras tres»* de ese mismo párrafo sí se recontó a cuatro, en el hunk tocado.
- **L794 · §5** — «Entra por S8 o S9, sale por S10» → sigue correcta: `S10` sigue siendo la única
  salida, que es precisamente por qué su rama de fallo era obligatoria.
- **L808 · §5** — «el reloj de inactividad de verticales no se detiene» → sigue correcta.
- **L941, L942 y L945 · §7.1** — «Ya no es monótono … Lo que se retiró en esa decisión fue, textual,
  *«que el reloj fuera monótono»*» → siguen correctas; el argumento es por qué el tope de la
  reapertura **no** puede ser el día 180, y no depende de dónde viva el reloj.
- **L947 y L951 · §7.1** — «`G-R5` compara esas dos cifras y nada más … es exactamente el modo de
  falla que `DEC-DATA-002` escribió `D16` para cerrar» → **siguen correctas y anticipaban el
  hallazgo**: es el mismo razonamiento que `52efd38fb` aplicó al tiempo real de una fila `PAUSED`.
- **L1227 · §7.2** — «`MP5` no lleva ninguna suscripción a un estado terminal…» → sigue correcta;
  la línea de arriba, que congelaba el conteo en cuatro, se recontó a cinco.
- **L1400 · §10** — «contador monótono por recurso — el mismo preapproval llegó con `version` 4, 6,
  7 y 8» → homónimo, el contador del proveedor.

### `B/05-idempotencia-y-concurrencia.md`

- **L33 · §1** — «Deduplicación por id del hecho» → la de pagos. Homónimo.
- **L103 · §C4** — «`DEC-SUB-008` fijó que el downgrade muta el monto ya» → sigue correcta.

### `B/09-conciliacion.md`

- **L215, L254, L281, L318 y L331 · §3** — las cinco apariciones de «cuesta cero llamadas» son las
  de las comprobaciones **1 a 4**, una por una. Siguen correctas: cada una sigue costando cero
  llamadas, y la quinta se agregó con la misma propiedad y después de las cuatro.
- **L419 · §4** — «un reconciliador que vea subir el contador y vaya a buscar el cobro» →
  reconciliador de billing. Homónimo.

### `B/10-verticales-planes-billing-options.md`

- **L48 y L96 · §3** — «`DEC-SUB-008` si algo le baja» / «el camino de downgrade» → bajada. Intactas.
- **L164 · §4.3** — «es el cuarto de los hechos que reinician la inactividad» → sigue correcta:
  siguen siendo cuatro y el cuarto sigue siendo ése. Su fuente se precisó en `NUCLEO/01` §1.2 —la
  columna `vertical.fin_de_servicio`, que es de verticales— sin cambiar quién la lee, que es este §.

### `B/12-suscripcion.md`

- **L117, L139 y L152 · §2 y §3.1** — las tres apariciones de `DEC-SUB-008` son sobre **cuándo se
  muta el monto** en un downgrade. Nada que ver con el criterio de selección de fichas.

### `B/14-promos-cortesias-y-grants.md`

- **L83 · §2.1** — «bajar de plan (downgrade) muta el monto ya» → ídem.
- **L290 · Lo que NO cierra** — «El cupo y la ventana de validez de un código» → cupo de canjes.
  Homónimo.

### `B/16-addons.md`

- **L326, L377 y L498 · §4** — las tres apariciones del reconciliador de excedentes son sobre
  **capacidades que bajan** al vencer o quedar huérfano un addon. La dirección nueva no las toca.
- **L337 · §4.1** — «El criterio si no elige es el de `DEC-SUB-008`: cae lo más reciente primero» →
  sigue correcta: es el excedente **del addon**, y es bajada.
- **L531, L555 y L570 · §4.3** — «la cuarta comprobación de cero llamadas» y «la primera» → siguen
  correctas: los ordinales 1 a 4 no se movieron. La frase que congelaba el **total** en cuatro, en
  L658 de este mismo archivo, sí se recontó.

### `B/20-testing.md`

- **L60 · §2, `G-R5`** — la referencia cruzada del guard → sigue correcta: el guard es el mismo y su
  definición sigue en `V/20` §2. Lo que se acotó es qué **no** vigila, y se escribió en las dos
  puntas (`NUCLEO/04` §3 y `V/20` §2).
- **L135 · §2** — «si esa fila es la predecesora de una sucesión en curso, reactivarla…» →
  *«reactivar»* acá es reactivar **una suscripción** con un pago tardío. Homónimo del `PB8` de
  fichas.
- **L238 · §5** — «(`DEC-SUB-007`, `DEC-SUB-008`)» → listado de decisiones cubiertas por E2E.
  Sigue correcta.

## 3. Lo que el recorrido encontró FALSO, y se corrigió (commit `5836ec219`)

Tres de las 190 apariciones que el recorrido levantó **no** se podían justificar, y las tres viven
en párrafos que ninguno de los cinco commits de arreglo tocó. Van acá porque son la evidencia de
que este rastro no es decorativo:

1. **`B/22` §1.2** — *«La clave de una-sola-vez del capítulo 07 §2 —el sujeto más el hito,
   `sub:<id>:aumento:-30d`— hace que cada aviso sea localizable»*. Es la **prueba legal** de que se
   avisó, apoyada en la forma retirada de la ocurrencia. Con ella, dos anuncios sucesivos del mismo
   aumento comparten ocurrencia y el segundo no llega a encolarse: la evidencia que ese § promete
   no existiría. **El término viejo, en el capítulo que más caro paga que esté mal.**
2. **`B/03` §7.1** — *«la ficha que `PB4` hubiera archivado vuelve sola por `PB7`»*, sin la
   condición de cupo. Cuarta copia de la misma promesa incondicional; las otras tres se corrigieron
   en `8ed89adf8`.
3. **`V/03` §9, punto 3** — *«a `PB7` la dispara un cambio de cobertura, igual que a `PB3`»*. Con la
   segunda rama son **dos** disparadores, y el punto necesita afirmar que **ninguno** es el reloj
   para sostener que `PB7` no es una transición de esa clase.

## 4. Para el owner

1. **`DEC-DATA-003` nombra `PB1` donde corresponde `PB6`.** En *«El riesgo aceptado»* dice que el
   dueño que no quiera la ficha pública *«tiene `PB1` y la despublica»*; `PB1` es
   `DRAFT → PUBLISHED`, o sea la que **publica**, y la que despublica es `PB6`
   (`PUBLISHED → DRAFT`). Escribí `PB6` en `V/15` §4.4 con la aclaración al lado, porque es lo que
   ejecuta lo que la decisión describe. **No toqué el log.** Si el owner prefiere, la decisión puede
   corregirse en su lugar y la aclaración de `V/15` se retira.
2. **`PB7` recibió la segunda rama y la decisión sólo nombra `PB3`.** No lo traté como decisión
   nueva: la mitad `UNPUBLISHED_BY_BILLING` del `desde` de `PB4` **es** la población del excedente,
   así que sin la rama en `PB7` el borrado del día 180 sobre el que paga de más sigue vivo un
   estado más adentro, y *«vuelve sola por `PB7` y nunca se borra»* (`DEC-DATA-002`) queda falsa
   para ese sujeto. Queda declarado acá por si el owner lo lee como una extensión y no como la
   condición de que la decisión se cumpla.
3. **El criterio de orden se escribió como el inverso exacto del de bajada** —*«vuelve primero lo
   que cayó al final»*—, con la propiedad verificable de que el conjunto publicado depende sólo del
   cupo y no del camino, y **sin que el origen desempate** entre `PB3` y `PB7`. `DEC-DATA-003`
   obliga a escribirlo pero no elige cuál; si el owner quiere otro, cambia en tres lugares
   (`V/03` §9, `V/15` §4.3 y los dos avisos).

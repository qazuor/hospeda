---
title: "FASE 8 · C2 — liberación, coexistencia y migración del conjunto"
linear: HOS-1352
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 8
---

# FASE 8 · C2 — liberación, coexistencia y migración del conjunto

Pasada final sobre el **conjunto**. No ataco ninguna de las dos mitades: ataco si este programa,
como programa, **se puede terminar y liberar**. Existe porque `DEC-ARCH-007` implicación 2 pide
*«una revisión final sobre el conjunto antes del despliegue»*.

Diecisiete hallazgos: **7 CRITICA**, **6 ALTA**, **3 MEDIA**, **1 BAJA**.

**Límite declarado.** La FASE 5 no está hecha. Todo lo de abajo se apoya en los documentos del
programa, en las mediciones fechadas que ellos citan, y en **archivos de configuración del repo
que sí leí** — `.github/workflows/*.yml`. **No leí el código de billing actual**, y ningún
hallazgo depende de cómo está escrito. Donde rozo ese terreno lo digo en el propio texto.

**No relitigo** `DEC-ARCH-004`, `005`, `006` ni `007`. Que se libere junto no se discute. Lo que
ataco es si el **mecanismo** elegido para hacerlo cumplir cumple.

---

## CRITICA

### F-8C2-001 — La migración tiene un punto de no retorno y nadie eligió de qué lado empieza

**Qué se rompe** — las tres relaciones con compromiso de cobro vivo pasan por una ventana en la
que, o hay dos autorizaciones cobrando, o el cliente no tiene nada y no puede volver. Las dos
operaciones que componen esa ventana son irreversibles y ningún documento declara su orden.

**El camino.**

1. Llega FASE 10. `DEC-MIG-001` manda: *«Se los contacta, se los da de alta en el motor nuevo y
   se cancela el compromiso viejo»*, y agrega que los tres en trial *«tienen que volver a
   autorizar el débito»*.
2. «Dar de alta en el motor nuevo» es la unidad **B3**: una fila que nace en
   `PENDING_AUTHORIZATION` y un checkout que el cliente tiene que completar. El diseño le da
   **72 h**, y si no las completa, `S3` la lleva a `ABANDONED` **y cancela el preapproval en el
   proveedor**.
3. «Cancelar el compromiso viejo» es una cancelación en el proveedor, y está medido que cancelar
   es irreversible (`PA-5`).
4. Orden A — cancelar primero: entre la cancelación y la autorización nueva el cliente no tiene
   título vivo. Si abandona el checkout, no hay vuelta: su preapproval viejo ya no existe y el
   nuevo se canceló a las 72 h. El trial transcripto lo cubre hasta su fecha de fin, y dos de los
   tres vencen en noviembre.
5. Orden B — autorizar primero: durante hasta 72 h hay **dos** preapprovals vivos del mismo
   pagador, y está medido que el proveedor los deja convivir (`EX-6`). Si el cobro del viejo cae
   en esa ventana, cobró.
6. **Ningún documento elige.** El 21 de verticales escribe qué fila se transcribe; el 21 de
   billing dice que se coordinan a mano; `DEC-MIG-001` describe el acto; ninguno de los tres dice
   qué se hace primero ni qué se le dice al cliente mientras tanto.

**Dónde lo permite el diseño.**

- `HOS-1352-…/docs/01-decision-log.md`, `DEC-MIG-001` — *«Se los contacta, se los da de alta en el
  motor nuevo y se cancela el compromiso viejo. **Cero código de migración.**»*, e implicación 2:
  *«Los tres en trial **tienen que volver a autorizar el débito**. Alguno puede no volver.»*
- `HOS-1354-…/docs/21-migracion.md` §3.2 (a) — *«No hay nada que parar ni que coexistir: se
  coordinan a mano (`DEC-MIG-001`) y se transcriben según §2.3.»*
- `HOS-1352-…/docs/11-particion-del-programa.md` §6.3 — *«No es la coexistencia de dos sistemas en
  producción —no la hay— sino **la espera**»*. La coexistencia que el documento niega es
  exactamente la que estas tres relaciones necesitan durante la ventana.
- `HOS-1352-…/docs/07-facts-inventory.md` — *«Las tres `trialing` son las **únicas** con vínculo
  vivo al proveedor de pagos en toda la base»*, con primer cobro el 2026-09-26, el 2026-11-25 y el
  2026-11-30.

**Severidad** — `CRITICA`.

**Necesita decisión del owner** — **sí**. Qué se le promete a una de esas tres personas durante la
ventana —y quién absorbe el costo si abandona el checkout— es comercial, no técnico.

---

### F-8C2-002 — `DEC-MIG-001` y el §2.3 describen dos operaciones distintas sobre las mismas cinco filas

**Qué se rompe** — la migración leída como **una** operación se contradice consigo misma: la
decisión manda dar de alta y re-autorizar; la regla de transcripción manda escribir una fila de
`trial` con la fecha que ya tenía. Las dos no pueden ser ciertas a la vez para la misma persona, y
la que se ejecute decide si el viejo preapproval sigue cobrando o si el cliente pierde días
prometidos.

**El camino.**

1. La persona del compromiso 2 tiene trial hasta el **2026-11-25**.
2. Por el §2.3 se le escribe *«una fila de `trial` en `TRIAL_ACTIVE` con la fecha de fin que ya
   tenía»*. Con eso está cubierta hasta noviembre y **no necesita re-autorizar nada**: el paso 5
   de la autorización le responde que sí por la fuente `TRIAL`.
3. Por `DEC-MIG-001` hay que darle alta en el motor nuevo y **cancelar el compromiso viejo**. Si
   no se le cancela —porque su trial lo cubre y nadie ve urgencia—, el preapproval viejo llega a
   su fecha y cobra, contra un sistema que ya no lo conoce.
4. Si se le cancela y no se le da alta nueva, cuando el trial venza no hay `T2` ni `T5` que
   convierta: queda en `TRIAL_EXPIRED` con sus fichas en `UNPUBLISHED_BY_BILLING`.
5. Y hay un orden que ninguna de las dos mitades declara y que no es indiferente: la fila de
   `trial` pide *«referencia al plan de trial»* y *«referencia a las versiones vigentes al
   arrancar»*, que son filas de `plan_version` — la unidad **V2** de la otra épica. La mitad
   billing no puede correr antes de que verticales haya sembrado el catálogo, y **ninguna de las
   dos lo dice**.
6. El §2.3 al que la mitad billing remite **no existe en su archivo**: `HOS-1354-…/21` salta de
   §1.3 a §3. La mitad verticales no tiene §1 ni §3. **Ninguna de las dos mitades contiene la
   operación completa**, y el núcleo declara que *«las dos épicas no se referencian entre sí»*.

**Dónde lo permite el diseño.**

- `HOS-1353-…/docs/21-migracion.md` §2.3 — la tabla de dos filas, *«el estado se transcribe, no se
  reinterpreta»*.
- `HOS-1353-…/docs/02-modelo-de-datos.md` §2.2 — las columnas de `trial`: *«referencia al plan de
  trial, **referencia a las versiones vigentes al arrancar** (el piso del trinquete), inicio, fin
  y el hash irreversible del correo normalizado»*.
- `HOS-1352-…/docs/nucleo/00-indice.md` — *«**Y las dos épicas no se referencian entre sí.** Lo
  único que cruza es el contrato de cobertura»*.
- `HOS-1353-…/docs/21-migracion.md`, «Lo que este capítulo NO cierra» — *«Cómo se ejecuta la
  transcripción de las cinco —quién, cuándo, con qué verificación— es FASE 7»*.

**Severidad** — `CRITICA`.

**Necesita decisión del owner** — **sí**. Si las cinco se transcriben *o* se dan de alta de nuevo
son dos promesas distintas a cinco personas reales, y hoy el programa hace las dos.

---

### F-8C2-003 — Los PRs donde el diseño dice que se revisa no disparan ningún workflow

**Qué se rompe** — el mecanismo que convierte *«no lo hagas»* en *«no se puede»* hace, medido,
exactamente lo contrario: el camino correcto no tiene ninguna verificación automática y el camino
prohibido tiene la completa. Toda la revisión del programa ocurre sin CI, y el único PR que la
tiene es el que el propio diseño declara irrevisable.

**El camino.**

1. `DEC-ARCH-007` punto 2: las sub-épicas *«cortan de esa rama y mergean a esa rama. Nunca a
   `staging` directamente»*. Punto 4: *«La revisión ocurre en los PRs de sub-épica → paraguas»*.
2. Medido sobre `.github/workflows/` de este repo, el 2026-09-19: **doce workflows declaran
   `branches:` y ninguno nombra `epic/**` ni un comodín**. `ci.yml` corre en `pull_request` a
   `main` y a `staging`; `e2e-pr.yml` y `lighthouse.yml` a `staging` y `main`; `a11y-sweep.yml` y
   `smoke-gate-sync.yml` sólo a `staging`; `codeql.yml` sólo a `main`.
3. Un PR de `spec/HOS-1353-v1-…` hacia `epic/HOS-1352-verticales-billing` dispara **cero** checks:
   ni lint, ni typecheck, ni tests, ni los 53 guards, ni e2e, ni el validador de título.
4. Un PR de esa misma rama hacia `staging` —el camino que la decisión prohíbe— dispara **todos**.
   Nada en el repo lo bloquea: las protecciones del `CLAUDE.md` cubren `main` y `staging` como
   destino de *push*, no como destino de *PR desde una rama de sub-épica*.
5. El merge periódico obligatorio de `staging` hacia el paraguas tampoco corre nada, por la misma
   razón: su destino no es `staging`.
6. Resultado: durante todo el programa, **revisión humana sin CI** en cada PR; y al final, **CI
   sin revisión humana posible** en un solo PR que la decisión describe como *«enorme»*.

**Dónde lo permite el diseño.**

- `HOS-1352-…/docs/01-decision-log.md`, `DEC-ARCH-007` punto 4 — *«El PR final a `staging` va a ser
  enorme y nadie lo puede revisar de verdad: tiene que ser el merge de algo ya revisado pieza por
  pieza, no el momento de mirar.»*
- `HOS-1352-…/docs/11-particion-del-programa.md` §6.1 — *«Es una excepción declarada al flujo de 6
  pasos del `CLAUDE.md` del repo… Queda escrita acá para que el próximo agente que entre no la
  «corrija».»* La excepción se declaró en la spec; **no se declaró en la herramienta**.
- Medición propia: `.github/workflows/ci.yml` (`on: pull_request: branches: [main, staging]`),
  `e2e-pr.yml`, `lighthouse.yml`, `a11y-sweep.yml`, `codeql.yml`, `smoke-gate-sync.yml`.

**Severidad** — `CRITICA`.

**Necesita decisión del owner** — **no** para el arreglo. **Sí** para el momento: el paraguas
*«nace cuando exista el primer código»*, y si nace antes de que los workflows lo conozcan, el
primer PR del programa ya entra sin verificación.

---

### F-8C2-004 — El merge periódico de `staging` resuelve texto sobre un código que el paraguas borra

**Qué se rompe** — la única mitigación declarada del riesgo principal de `DEC-ARCH-007` atiende el
modo de falla equivocado. Resuelve **conflictos de texto**; lo que se acumula es **divergencia
semántica**, y no hay nada que la note porque en esa rama no corre nada (`F-8C2-003`).

**El camino.**

1. El paraguas vive meses esperando la pasarela. Mientras tanto `staging` no se detiene: es el
   repo entero, con su ritmo.
2. Cada tanto se mergea `staging` → paraguas, *«periódicamente y como obligación»*. El merge trae
   código nuevo escrito contra el sistema actual: lecturas de suscripción, de entitlements, de
   plan.
3. El paraguas, del otro lado, está **eliminando** ese sistema: el §55 ordena sacar `commerce` de
   *«code, schema, types, tests, docs, specs, artifacts, comments, prompts, memory, Engram, TODO,
   naming»*, y el modelo nuevo reemplaza las entidades de dinero enteras.
4. Un archivo que el paraguas **borró** y `staging` no tocó no produce conflicto: git lo deja
   borrado. Un archivo que `staging` agregó y llama a lo borrado **tampoco** produce conflicto: se
   agrega limpio y roto. En los dos casos el merge sale verde.
5. Y no hay verificación: en esa rama no corre ni typecheck. La primera vez que alguien lo ve es
   el PR final a `staging`, que es el que nadie puede revisar.
6. El documento nombra el riesgo con precisión —*«una rama que vive meses acumula conflictos con
   todo lo que entre a `staging` mientras tanto»*— y le asigna el remedio de los conflictos, que
   es la mitad que git resuelve sola.

**Dónde lo permite el diseño.**

- `HOS-1352-…/docs/11-particion-del-programa.md` §6.3 — *«El riesgo… es **la espera**… Lo acotan el
  merge periódico de `staging` hacia el paraguas y la integración continua; **cómo se integra sin
  activar** es materia de la FASE 7 de cada épica.»*
- `HOS-1352-…/docs/02-worklog.md` — la misma frase, con el agregado: *«quedó sin resolver a
  propósito»*.
- `HOS-1352-…/docs/00-PDR.md` §55 — la lista de fuentes de las que hay que eliminar `commerce`.

**Severidad** — `CRITICA`.

**Necesita decisión del owner** — **no**.

---

### F-8C2-005 — No hay rollback, y la palabra no aparece en ningún documento de diseño

**Qué se rompe** — el programa reemplaza el sistema de cobro entero en **un solo despliegue** y no
declara ninguna forma de volver. La fase que tenía que escribirla se partió entre dos épicas, y la
unidad que despliega no es ninguna de las dos.

**El camino.**

1. `DEC-ARCH-007` implicación 3: *«La FASE 10 se desarrolla en paralelo y **despliega una sola
   vez**.»* La unidad que llega a `staging` —y después a `main`— es el paraguas entero.
2. El §65 pone `rollback`, `rollout`, `coexistence`, `staging` y `feature flags` como contenido
   obligatorio de la **FASE 7**.
3. `DEC-ARCH-007` implicación 4: *«Las fases 5, 6 y 7 sí se parten limpio: cada épica hace su gap
   analysis, su decisión de rewrite/reuse y su estrategia.»*
4. Medido con `rg` sobre los tres cuerpos de diseño —núcleo, `HOS-1353/`, `HOS-1354/`— más los
   documentos del paraguas, el 2026-09-19: **`feature flag` aparece cero veces**, **`rollback`
   aparece cero veces**, **`rollout` aparece cero veces**. Las únicas apariciones de las tres
   están en el propio §65 del PDR, enumerándolas como pendientes.
5. Las dos descomposiciones cubren **dos** de los diez ítems de la FASE 7 —orden de
   implementación y grafo de dependencias— y declaran por escrito que no cubren los demás.
6. O sea: la estrategia de despliegue del programa se partió entre dos épicas que, por decisión,
   **no despliegan**; y el que despliega no tiene fase que se la escriba.

**Dónde lo permite el diseño.**

- `HOS-1352-…/docs/00-PDR.md`, FASE 7 — *«Definir: implementation order; dependency graph;
  migration; rollout; coexistence; staging; feature flags; rollback; observability; acceptance
  gates.»*
- `HOS-1352-…/docs/01-decision-log.md`, `DEC-ARCH-007` implicaciones 3 y 4.
- `HOS-1353-…/descomposicion.md` §6 y `HOS-1354-…/descomposicion.md` §6 — *«Fechas y esfuerzo. No
  hay estimaciones acá a propósito»*, y ninguna de las dos nombra rollout, rollback ni flags.

**Severidad** — `CRITICA`.

**Necesita decisión del owner** — **sí**. Un despliegue único e irreversible del sistema de cobro
es una elección de riesgo, no un detalle de ejecución, y hoy está tomada por omisión.

---

### F-8C2-006 — La primera unidad exige trabajo de FASE 5 con su gate cerrado

**Qué se rompe** — `V1` es la única unidad que el grafo declara sin dependencias, y su lista de
guards incluye `G8`, que falla *«si aparece `commerce` en fuentes activas»*. Hacer que `G8` pase
es ejecutar el §55 sobre el árbol de fuentes: clasificar y tocar código existente. Eso es FASE 5,
tiene un gate que `DEC-METH-003` declara **de entrada**, y ese gate no se abrió.

**El camino.**

1. `HOS-1353-…/descomposicion.md` §3: *«nada arranca antes que `V1` | y `V1` no depende de
   nada»*. `V1` es lo primero que se construye en todo el programa.
2. Su columna de guards es `G1 G3 G8`, y la regla 1 de esa misma descomposición dice que *«cada
   guard va con la pieza que protege, nunca al final»*, con su caso que lo hace fallar a propósito.
3. `G8` no vigila código nuevo: vigila que **no quede** `commerce` en fuentes activas. Si al
   escribirse `V1` todavía queda, `G8` falla desde el primer día — y un guard que falla desde el
   primer día *«nace con una lista de excepciones»*, que es el antipatrón que la propia §2.1 de
   esa descomposición nombra.
4. Medido: la palabra `commerce` aparece en **cinco** lugares de todo el diseño de las dos
   épicas — `G8` en `20-testing.md` §2, `G8` en `spec.md` §5, el invariante 32 del núcleo, y las
   dos notas gemelas de los capítulos 21. Las dos notas dicen lo mismo: *«Eso es trabajo de FASE 5
   y de código, no de datos»*.
5. **Ninguna de las 22 unidades de trabajo de las dos descomposiciones es «sacar `commerce`».** Ni
   `V1`, cuya lista de §4 —*«lo que la unidad tiene que dejar demostrado»*— no menciona `G8` en
   absoluto.
6. Y `DEC-METH-003` implicación 1 es terminante: *«No se clasifica ninguna pieza antes de haber
   tomado esa decisión. Empezar a clasificar «mientras tanto» equivale a elegir la alternativa (3)
   sin decirlo.»*

**Dónde lo permite el diseño.**

- `HOS-1353-…/descomposicion.md` §2 (fila `V1`, columna guards), §2.1 y §4 (criterio de `V1`).
- `HOS-1353-…/docs/20-testing.md` §2 — *«| G8 | aparece `commerce` en fuentes activas | invariante
  §64.32, §55 |»*.
- `HOS-1352-…/docs/01-decision-log.md`, `DEC-METH-003` implicaciones 1 y 2.
- `HOS-1353-…/docs/21-migracion.md` §4 y `HOS-1354-…/docs/21-migracion.md` §4 — las dos notas.
- `HOS-1353-…/descomposicion.md` §6 — *«Qué se reescribe y qué se reutiliza. Es FASE 5 y tiene su
  gate propio (`DEC-METH-003`).»* El grafo de orden **no incluye ese gate**.

**Severidad** — `CRITICA`.

**Necesita decisión del owner** — **sí**, y es la decisión que destraba empezar: abrir el gate de
FASE 5, que `DEC-METH-003` dice que se toma con el inventario de 1B terminado — y 1B **está
terminado** (132 hallazgos).

---

### F-8C2-007 — Decidir la pasarela no destraba nueve unidades: reabre la FASE 1C entera

**Qué se rompe** — el programa lee la elección de pasarela como el evento que libera las nueve
unidades bloqueadas. Lo que en realidad sigue, si la elegida no es Mercado Pago, es **repetir la
FASE 1C completa**: las 49 filas `VERIFIED` son de Mercado Pago, el §58 prohíbe escribir código
productivo de billing antes de medirlas, y `DEC-ARCH-007` declara que la 1C **no se parte**. Ese
costo no está en ninguna descomposición ni en el mecanismo de liberación.

**El camino.**

1. La evaluación lo dice, y es el único lugar donde está: *«Cambiar de pasarela no invalida un solo
   capítulo de la spec. Lo que cambia es **qué filas de la matriz quedan en `VERIFIED` y cuáles
   vuelven a `UNKNOWN`**.»* Y el §4 del mismo documento: *«Se corre **la misma matriz** contra cada
   candidato.»*
2. Son **49 filas `VERIFIED`** sobre 89, más 13 parciales y 19 `NOT_SUPPORTED`, todas medidas
   contra un proveedor. Con otro proveedor, 81 filas cerradas vuelven a abrirse.
3. El §58 no admite atajo: *«ANTES DE IMPLEMENTAR CÓDIGO PRODUCTIVO DE BILLING: debemos comprobar
   experimentalmente absolutamente todas las variantes necesarias. NO alcanza documentación.»* Y
   el §61: *«No comenzar implementación de una capability crítica mientras siga `UNKNOWN`.»*
4. `DEC-ARCH-007` implicación 5: *«La FASE 1C no se parte: es billing entera, y se va con
   `HOS-1354`.»* O sea que el reinicio de 1C es un bloque indivisible delante de la FASE 10 de
   billing, que es **la mitad del despliegue único**.
5. La descomposición de billing describe el desbloqueo sin ese paso: *«Doce de trece tienen el
   diseño escrito. Doce de trece no se pueden construir todavía»*, y su §2.3 enumera lo que la
   pasarela decide — pero no que decidirla obliga a volver a medir.
6. Y el instrumento para medir tiene su propio costo declarado: Mobbex con el alta en **revisión
   manual de KYC desde el 2026-09-18**, y la batería de sondas escrita y sin poder correr.

**Dónde lo permite el diseño.**

- `HOS-1352-…/docs/10-evaluacion-de-proveedor.md`, «Lo que NO cambia si cambiamos de proveedor» y
  §4.
- `HOS-1352-…/docs/00-PDR.md` §58 y §61.
- `HOS-1352-…/docs/01-decision-log.md`, `DEC-ARCH-007` implicación 5.
- `HOS-1354-…/descomposicion.md` §2.3 y §6 — *«Cuál es la pasarela, que es lo que traba la
  construcción entera… Esta descomposición dice qué se puede hacer mientras tanto; no acelera la
  decisión.»*

**Severidad** — `CRITICA`.

**Necesita decisión del owner** — **no** para el hecho. **Sí** para la consecuencia: si el costo
de re-medir 81 filas pesa en la elección de pasarela, es un insumo del paso 5 de la evaluación que
hoy no está escrito ahí.

---

## ALTA

### F-8C2-008 — Once guards de CI vigilan el modelo que el programa borra

**Qué se rompe** — el paso 4 de la liberación —el PR del paraguas a `staging`— es la **primera
vez** que el programa se enfrenta a las defensas que el repo construyó alrededor del sistema que
viene a reemplazar. Eso pasa en el PR que el propio diseño declara demasiado grande para revisar.

**El camino.**

1. Medido sobre `.github/workflows/ci.yml` el 2026-09-19: el job `guards` tiene **53 pasos
   nombrados**, y **once** nombran explícitamente el modelo de billing actual — `product-domain`,
   `'commerce'`, `preapproval`, `MercadoPago`, `billing_prices.trial_days`, `add-on`,
   `subscription domain comparisons`, `billing plan/subscription create`.
2. Ese job corre en `pull_request` a `main` y a `staging`. Por `F-8C2-003`, no corre en el
   paraguas.
3. El programa borra el vocabulario que esos once vigilan: el §55 saca `commerce` de fuentes
   activas, `DEC-ARCH-004` mete la pasarela detrás de un adaptador con un guard propio que prohíbe
   importar su SDK afuera, y el modelo nuevo no tiene `product_domain` ni `billing_prices`.
4. En el PR final los once se encuentran, a la vez, con un árbol donde su sujeto no existe. Cada
   uno es una decisión: se retira, se reescribe contra el modelo nuevo, o se lo excepciona.
5. Ninguna de las dos épicas lista esos guards. El capítulo 20 de cada una enumera **los suyos**
   —`G1`–`G13`— y ninguno de los dos menciona que el repo ya tiene 53 corriendo.

**Límite de este hallazgo, declarado**: leí los **nombres** de los pasos en el workflow, no los
scripts. La afirmación es *cuándo se ejecutan por primera vez contra el modelo nuevo*, no que
alguno vaya a fallar. Saber cuál falla es FASE 5 y no está hecha.

**Dónde lo permite el diseño.**

- Medición propia: `.github/workflows/ci.yml`, job `guards`, 53 pasos `- name:`.
- `HOS-1352-…/docs/00-PDR.md` §55 y `DEC-ARCH-004` condición A.
- `HOS-1353-…/docs/20-testing.md` §2 y `HOS-1354-…/docs/20-testing.md` §2 — las dos listas de
  guards del programa, sin una línea sobre los del repo.

**Severidad** — `ALTA`.

**Necesita decisión del owner** — **no**.

---

### F-8C2-009 — La épica que «arranca ya» no puede certificarse terminada sin la épica bloqueada

**Qué se rompe** — `DEC-ARCH-007` define *«terminada»* como *«lista y **verificada** contra el
contrato»*. El capítulo que dice cómo se verifica verticales declara cuatro capas obligatorias, y
**dos dependen de la pasarela sin elegir**. Con esa definición, verticales no puede declararse
terminada aunque termine, y el hito que dispara la liberación conjunta no tiene criterio.

**El camino.**

1. `HOS-1353-…/docs/20-testing.md` §1 declara las cuatro capas del §62. La tercera dice, textual:
   *«**sandbox del proveedor** (§62.3) | «suite real más pequeña pero obligatoria» | **Mercado
   Pago sandbox**»*.
2. La primera —dominio e integración— corre *«contra base real, **proveedor falso**»*. El
   proveedor falso es la unidad **B1** de la otra épica, marcada ⛔: *«de B1 se puede escribir la
   interfaz y su guard, no el adaptador real»*, y *«el falso tiene que mentir desde el primer
   día»* con *«las quince filas del `20` §3.2, todas suyas»* — de Mercado Pago.
3. O sea que la épica declarada independiente del dinero tiene **dos de sus cuatro capas de
   verificación atadas a una pasarela que no está elegida**.
4. Y el capítulo está roto por el desarme de una forma que lo hace difícil de notar: su propia
   introducción promete *«qué tiene que mentir el proveedor falso (§3)»*, y el archivo **no tiene
   §3 ni §4**: va de §2.1 a §5, y el §5 empieza en el ítem **7**.
5. La verificación del desarme contó *«105 de 105 encabezados presentes en **alguna** mitad»* — y
   `§3` está presente, en la mitad billing. La introducción que lo promete quedó en la otra.

**Dónde lo permite el diseño.**

- `HOS-1353-…/docs/20-testing.md` §1 (la tabla de cuatro capas) y su introducción.
- `HOS-1354-…/descomposicion.md` §2 (fila `B1`, ⛔) y §2.2.
- `HOS-1352-…/docs/01-decision-log.md`, `DEC-ARCH-007` implicación 1 — *«**«Terminada» para una
  épica no significa «en producción»**: significa **lista y verificada contra el contrato**»*.
- `HOS-1352-…/docs/11-particion-del-programa.md` §4.1 — *«105 de 105 encabezados presentes en
  alguna mitad»*.

**Severidad** — `ALTA`. El defecto de costura en sí es de C1; lo que reporto es que el hito de
liberación se apoya en un criterio que la épica bloqueada tiene que entregar.

**Necesita decisión del owner** — **no**.

---

### F-8C2-010 — La FASE 7 se partió por épica y el que despliega es el paraguas

**Qué se rompe** — de los diez ítems que el §65 le exige a la FASE 7, **cuatro** tienen algo
escrito y **seis** no tienen dónde vivir, porque se repartieron entre dos épicas que por decisión
no despliegan, y el paraguas —que sí— no tiene FASE 7.

**El camino.**

1. `DEC-ARCH-007` implicación 4 reparte: *«Las fases 5, 6 y 7 sí se parten limpio.»*
2. Implicación 3: *«La FASE 10 se desarrolla en paralelo y despliega **una sola vez**.»* La unidad
   de despliegue es el paraguas.
3. Medido, ítem por ítem del §65 FASE 7:

   | ítem | dónde está |
   |---|---|
   | implementation order | ✅ las dos descomposiciones, §3 |
   | dependency graph | ✅ las dos descomposiciones, §3 |
   | migration | ⚠️ los dos capítulos 21, y no es unidad de trabajo de nadie (`F-8A3-009`) |
   | rollout | ❌ cero apariciones |
   | coexistence | ❌ declarada inexistente (`11` §6.3), y `F-8C2-001` la necesita |
   | staging | ⚠️ sólo como obligación de merge hacia el paraguas |
   | feature flags | ❌ cero apariciones |
   | rollback | ❌ cero apariciones |
   | observability | ✅ núcleo `08` |
   | acceptance gates | ⚠️ el §4 de cada descomposición, por unidad y no por release |

4. El §65 abre con *«NO saltar fases»*. El estado medido del handoff dice *«3 a 10 ⬜ sin
   empezar»*, y la única fase entre el diseño y el código es justamente la que se partió.

**Dónde lo permite el diseño.**

- `HOS-1352-…/docs/00-PDR.md` §65, FASE 7 y su apertura *«NO saltar fases»*.
- `HOS-1352-…/docs/01-decision-log.md`, `DEC-ARCH-007` implicaciones 3 y 4.
- `HOS-1352-…/docs/03-handoff.md`, «Estado por fase, medido» — *«3 a 10 | épicas →
  implementación | ⬜ sin empezar»*.

**Severidad** — `ALTA`.

**Necesita decisión del owner** — **no** para el reparto; **sí** para quién escribe la FASE 7 del
paraguas, que hoy no es de nadie.

---

### F-8C2-011 — El desarme del trabajo se publicó antes de la FASE 8

**Qué se rompe** — las 22 unidades están creadas en Linear con su ficha, y un tablero calcula
cuáles están *«listas»* con un predicado que sólo mira dependencias. Ese tablero va a decir que
`V1` está lista, y `V1` está bloqueada por el gate de FASE 5 (`F-8C2-006`) y su diseño acaba de
recibir 38 hallazgos CRITICA que nadie resolvió.

**El camino.**

1. Las dos descomposiciones se escribieron el **2026-09-18**; los seis informes de FASE 8 son del
   **2026-09-19**. El desarme es anterior al ataque.
2. `HOS-1353-…/descomposicion.md` §5 y `HOS-1354-…/descomposicion.md` §5 listan **9 + 13 = 22
   sub-issues** de Linear (`HOS-1355`…`HOS-1376`), cada uno con su ficha publicada, más cinco
   fichas de programa.
3. Las dos describen el tablero con las mismas palabras: *«calcula solo cuáles están listas: una
   unidad lo está **cuando todas sus dependencias están hechas**»*.
4. El predicado no tiene lugar para: el gate de FASE 5, la FASE 7 que falta, los hallazgos de
   FASE 8, ni la elección de pasarela salvo por la marca ⛔ de la tabla.
5. Y las correcciones de la FASE 9 no llegan solas a esas 22 fichas: varios CRITICA cambian el
   **modelo de datos** —`F-8B3-001` (el `UNIQUE`), `F-8A2-002` (`PRE_TRIAL`), `F-8A3-001` y
   `F-8A3-002` (qué otorga un grant, el valor de un addon)— y por lo tanto cambian el contenido de
   `V2`, `V3`, `V4` y `B3`, que ya están escritas y publicadas.
6. Nadie es dueño de esa propagación: la FASE 9 manda actualizar *«Decision Log; Master Spec;
   Handoff; Worklog»* y **no nombra las descomposiciones, las fichas ni los issues**.

**Dónde lo permite el diseño.**

- `HOS-1353-…/descomposicion.md` §5 y `HOS-1354-…/descomposicion.md` §5.
- `HOS-1352-…/docs/00-PDR.md`, FASE 9 — *«Resolver findings. Actualizar: Decision Log; Master
  Spec; Handoff; Worklog.»*
- Medición propia: 38 `CRITICA` sobre 110 hallazgos, contadas con `rg` sobre los seis informes.

**Severidad** — `ALTA`.

**Necesita decisión del owner** — **no**.

---

### F-8C2-012 — La premisa que abarata la migración no la mide nadie

**Qué se rompe** — `DEC-MIG-002` declara por escrito cuál es la premisa a vigilar y **no crea
ningún mecanismo de vigilancia**: no hay umbral, no hay consulta agendada, no hay dueño y no hay
qué se hace si se pasa. La decisión se apoya en una declaración del owner —*«van a ser muy
pocas»*— que no es una medición y no tiene forma de dejar de ser cierta a la vista.

**El camino.**

1. `DEC-MIG-002`: *«Lo que esta decisión NO afirma: que la transcripción manual escale. Es barata
   **porque son pocas**, y esa premisa es la que hay que vigilar, no la decisión.»*
2. El riesgo declarado: *«la cohorte a transcribir crece mientras dure el rediseño. Hoy son 5;
   cada alta nueva suma una. **Si el ritmo de altas se acelera hay que volver a mirar esto**.»*
3. `04-open-decisions.md`, «Para revisar más adelante», repite el disparador con las mismas
   palabras —*«Si el ritmo de altas se acelera»*— y no lo convierte en nada: ni un número, ni una
   fecha, ni una consulta.
4. La única consulta escrita del programa es la del `07-facts-inventory.md`, que fue pensada para
   medirse dos veces y **cuya propia caducidad está declarada para el 2026-09-26**.
5. Y la regla de transcripción que abarata la cohorte está medida como incompleta: el §2.3 escribe
   una fila de `trial` y nada más (`F-8B3-006`), así que cada alta nueva entra a una cohorte cuya
   regla no cubre su compromiso de cobro.
6. El resultado es una premisa que sólo puede fallar en silencio: el día que alguien vuelva a
   correr la consulta, la cohorte ya creció lo que creció.

**Dónde lo permite el diseño.**

- `HOS-1352-…/docs/01-decision-log.md`, `DEC-MIG-002`, «Lo que esta decisión NO afirma» y «El
  riesgo, declarado».
- `HOS-1352-…/docs/04-open-decisions.md`, «Para revisar más adelante», fila `DEC-MIG-002`.
- `HOS-1354-…/docs/21-migracion.md` §1.3 — *«esta medición vale mientras el hecho no cambie, y
  **este hecho cambia solo**»*.

**Severidad** — `ALTA`.

**Necesita decisión del owner** — **sí**, en un punto chico: cuál es el número a partir del cual
la coordinación manual deja de ser barata. Sin ese número la vigilancia no se puede delegar.

---

### F-8C2-013 — La FASE 9 corrige capítulos sobre los que ya se escribió código

**Qué se rompe** — el programa tiene dos líneas de tiempo que nunca se reconcilian hacia atrás. El
diseño avanza por ramas de spec que van a `staging`; el código avanza en el paraguas. La FASE 9 va
a editar capítulos que para entonces ya tendrán código escrito contra su versión anterior, y la
regla del §65 —*«Si código contradice spec: STOP»*— no tiene quién la dispare.

**El camino.**

1. `DEC-ARCH-007` punto 1: *«Los documentos siguen yendo por su rama de spec, que sí va a
   `staging` normalmente: **son documentación y no despliegan nada**.»*
2. La FASE 9 tiene por encargo *«Resolver findings»* sobre 110 hallazgos, y resolverlos es
   **editar los capítulos**: el modelo de datos, las tablas de transiciones, el contrato.
3. Esas ediciones entran a `staging` por su propia rama. Llegan al paraguas recién en el merge
   periódico siguiente.
4. El código que ya se escribió contra el texto viejo no se marca de ninguna forma. Nada lista
   «qué unidades se construyeron contra una versión de capítulo que cambió después».
5. El §65 declara la regla correcta —*«Si código contradice spec: STOP. No adaptar silenciosamente
   la spec al código»*— y la escribe para el sentido inverso: protege a la spec del código. El
   sentido que este flujo produce es el otro, y no tiene regla.
6. El caso concreto ya existe: las 22 fichas se publicaron el 2026-09-18 y la FASE 8 es del
   2026-09-19 (`F-8C2-011`).

**Dónde lo permite el diseño.**

- `HOS-1352-…/docs/01-decision-log.md`, `DEC-ARCH-007` punto 1.
- `HOS-1352-…/docs/00-PDR.md`, FASE 9 y FASE 10.

**Severidad** — `ALTA`.

**Necesita decisión del owner** — **no**.

---

## MEDIA

### F-8C2-014 — La rama de integración no tiene nacimiento verificable ni cota

**Qué se rompe** — *«nace cuando exista el primer código»* no es una condición que alguien pueda
comprobar: el primer código es, por el grafo, `V1` de verticales, y `V1` está detrás del gate de
FASE 5 (`F-8C2-006`). Y una vez nacida, nada declara cuándo la espera dejó de ser tolerable.

**El camino.**

1. La regla es la misma en cuatro documentos: *«nace cuando exista el primer código, no antes»*.
2. Lo único construible hoy es `V1` (verticales) y `B2` (billing), cuyo gate es `V2` — o sea que
   la rama nace del lado de verticales y se queda sola ahí mientras dure el bloqueo de la pasarela.
3. `DEC-ARCH-007` declara el riesgo —*«si una épica termina meses antes… su código espera»*— y no
   le pone ni cota ni revisión: no hay un *«si a los N meses billing sigue bloqueada, se vuelve a
   mirar la decisión»*.
4. La consecuencia práctica es que la decisión de liberar junto se toma una vez, y la condición
   que la hacía razonable —que las dos terminen parecido— nunca se vuelve a evaluar.

**Dónde lo permite el diseño.**

- `HOS-1352-…/docs/11-particion-del-programa.md` §6.1 y §6.3; `HOS-1352-…/spec.md`, «Cómo se
  libera»; `HOS-1352-…/docs/03-handoff.md`; `DEC-ARCH-007` punto 1.
- `HOS-1353-…/descomposicion.md` §3 y `HOS-1354-…/descomposicion.md` §2.3.

**Severidad** — `MEDIA`.

**Necesita decisión del owner** — **sí** si se quiere una cota; **no** si se acepta que la espera
no tiene techo.

---

### F-8C2-015 — La capacidad con riesgo de plataforma vence sin fecha legible

**Qué se rompe** — el programa se puede liberar y perder después, sin aviso, la capacidad que el
derecho de revocación necesita. No es una medición que caduque: es una que **no se puede tomar** y
cuyo canal de consulta se cerró.

**El camino.**

1. `HOS-1354-…/spec.md` §5.3: *«De las ocho capacidades, la única que vive en una API anunciada
   como discontinuada es **reembolsar** — y es justamente la que el derecho de revocación
   necesita. La guía de migración del proveedor **excluye explícitamente a las suscripciones**.»*
2. `R-MP-01` pide tres datos: si la discontinuación alcanza a las lecturas, en qué fecha, y por
   qué endpoint se reembolsa un cobro originado por un mandato.
3. El 2026-09-19 el canal que los contestaba dejó de existir: *«el centro **no da acceso a una
   persona** — deriva a un bot de IA»*. El documento saca la conclusión correcta: *«un proveedor
   al que no se le puede preguntar nada técnico fuera de la documentación es un proveedor con el
   que cada `UNKNOWN` se queda `UNKNOWN`»*.
4. `RF-3` —reembolsar un pago de más de 180 días— sigue `UNKNOWN` y es una de las ocho.
5. Para la liberación, eso significa que una de las ocho capacidades puede desaparecer en una
   fecha que no conocemos, después del despliegue único y sin rollback (`F-8C2-005`).

**Dónde lo permite el diseño.**

- `HOS-1354-…/spec.md` §5.3; `HOS-1352-…/docs/10-evaluacion-de-proveedor.md` §5.0.1, consecuencias
  2 y 3.

**Severidad** — `MEDIA`.

**Necesita decisión del owner** — **no**.

---

### F-8C2-016 — El programa no declara qué significa «resuelto» para un hallazgo de FASE 8

**Qué se rompe** — la FASE 9 recibe 110 hallazgos y su encargo es de una línea: *«Resolver
findings»*. No hay criterio de salida, no hay lista de los que bloquean la FASE 10, y no hay forma
de preguntar con un script cuántos piden al owner — porque los seis informes escriben esa línea de
tres formas distintas.

**El camino.**

1. Medido sobre los seis informes: **110 hallazgos — 38 `CRITICA`, 45 `ALTA`, 22 `MEDIA`, 5
   `BAJA`**.
2. De los 38 `CRITICA`: **13 declaran que necesitan una decisión del owner sin matiz, 13 declaran
   las dos cosas** (sí para una parte del hallazgo, no para otra) **y 12 declaran que no**. O sea
   que entre 13 y 26 decisiones del owner entran a FASE 9, y ninguna está agendada.
3. Ese conteo hubo que hacerlo con tres expresiones distintas, porque los informes escriben
   *«**Severidad** — `X`.»*, *«**Severidad.** `X` —…»* y *«**Severidad**: `X`.»*. Lo mismo con la
   línea del owner. **Un programa que se verifica contando no puede contar sus propios hallazgos
   con una sola consulta.**
4. Y falta la puerta: ningún documento dice *«la FASE 10 no arranca con un `CRITICA` abierto»*, al
   modo en que el §61 sí lo dice para una fila `UNKNOWN` de la matriz.

**Dónde lo permite el diseño.**

- `HOS-1352-…/docs/00-PDR.md`, FASE 9 — *«Resolver findings. Actualizar: Decision Log; Master
  Spec; Handoff; Worklog.»*, contra el §61 — *«No comenzar implementación de una capability
  crítica mientras siga `UNKNOWN`.»*
- Medición propia sobre `docs/14-fase-8-adversarial/*.md`.

**Severidad** — `MEDIA`.

**Necesita decisión del owner** — **sí**: cuál es la condición de salida de FASE 9.

---

## BAJA

### F-8C2-017 — Tres documentos del paraguas dan tres conteos distintos del decision log

**Qué se rompe** — nada en ejecución. Pero el paraguas es el documento que el §66 manda leer
primero, y el número que muestra es el que quedó viejo.

**El camino** — `HOS-1352-…/spec.md`, «Orden de lectura obligatorio», dice **48 decisiones**; el
worklog del 2026-09-18 dice *«el log queda en **49** decisiones, recontadas con `rg`»*;
`nucleo/00-indice.md` y el «Resumen» del propio log dicen **50**. Los tres se escribieron con la
regla del programa —*«los conteos se recuentan con script, nunca a mano»*— y los tres son el
recuento correcto **de su día**; lo que falta es que el de arriba se actualice cuando el de abajo
cambia.

**Dónde lo permite el diseño.**

- `HOS-1352-…/spec.md`, tabla de orden de lectura, fila 2; `HOS-1352-…/docs/02-worklog.md`, «Qué se
  produjo»; `HOS-1352-…/docs/nucleo/00-indice.md`, «De dónde sale cada afirmación», punto 2.

**Severidad** — `BAJA`.

**Necesita decisión del owner** — **no**.

---

## Lo que el §65 exige y hoy no tiene dónde vivir

Inventario **medido** el 2026-09-19 sobre los tres cuerpos de diseño, no estimado. La columna
«dónde lo manda» es la tabla de `nucleo/00-indice.md`, «Las áreas que el §65 exige, y dónde
quedaron».

| área del §65 (FASE 2) | dónde lo manda el índice | qué hay, medido |
|---|---|---|
| **manual payments** | `13` — billing | **no existe el capítulo.** Es la única área mandada a un capítulo sin escribir |
| **jobs** | «cada subdominio» | billing define **dos** barridos con cadencia e idempotencia (`09` §6); **verticales define cero** teniendo cinco relojes (`F-8A3-010`); el núcleo delega |
| **services** | «cada subdominio, más el `19`» | **ninguna sección de servicios en ninguna de las dos épicas** |
| **API** | ídem | **cero endpoints de Hospeda nombrados** en las dos épicas. Los cinco aciertos de `endpoint\|/api/` en billing son del proveedor, no nuestros |
| **UI · Admin** | `19`, partido | verticales quedó con **una fila** en su §2 y su §4 numerada `1, 2, 4, 8, 9` |
| **migration** | `21`, partido | los dos capítulos existen; **no es unidad de trabajo de ninguna de las 22** (`F-8A3-009`, y acá `F-8C2-002`) |
| **testing** | `20`, partido | verticales perdió el `§3` que su propia introducción promete y su `§5` empieza en el ítem 7 (`F-8C2-009`) |
| **provider · MP** | `06` — billing | escrito, y **condicionado a una pasarela sin elegir** (`F-8C2-007`) |
| las otras 24 áreas | su capítulo | tienen capítulo escrito |

Y el §65 **FASE 7**, que es la fase entre este diseño y el código, con sus diez ítems:

| ítem | estado medido |
|---|---|
| implementation order · dependency graph | ✅ las dos descomposiciones §3 |
| observability | ✅ núcleo `08` |
| migration · staging · acceptance gates | ⚠️ parcial, sin dueño de release |
| **rollout · coexistence · feature flags · rollback** | ❌ **cero apariciones** en todo el diseño |

**Cuatro de diez cubiertos, cuatro con cero apariciones.** `rollback`, `rollout` y `feature flag`
sólo existen en el propio §65 del PDR, enumerándose como pendientes; `coexistence` existe una vez,
para declarar que no la hay.

---

## Las mediciones con fecha de vencimiento

Ocho, con qué se apoya en cada una. Las dos primeras ya están reportadas (`F-8B3-018`); van acá
porque el encargo pide el inventario completo, no sólo lo nuevo.

| # | medición | cuándo caduca | qué se apoya en ella |
|---|---|---|---|
| 1 | `07-facts-inventory.md` — 0 pagos, 8 vivas, 3 compromisos, 22 usuarios (2026-09-15, re-verificada 2026-09-17) | **2026-09-26**, por su propio texto: *«este hecho cambia solo»* | `DEC-MIG-001`, `DEC-MIG-002`, `O-MIG-01`, `R-MIG-01`, la premisa del §56, las cifras de `DEC-ARCH-005` y el §5 de la partición |
| 2 | los otros dos primeros cobros — **2026-11-25** y **2026-11-30** | esas fechas | nada los vigila: el `21` §3.2 (b) sólo agenda el del 2026-09-26 |
| 3 | las **49 filas `VERIFIED`** de la matriz | **no por tiempo: por decisión.** `S-MP-02` — *«una fila caduca cuando cambia lo que la sostiene»*, y la pasarela es eso | los capítulos `05`, `06`, `09`, `12`, `14`, `16` y las 20 decisiones acopladas (`F-8C2-007`) |
| 4 | las **8 `UNKNOWN`**, cinco de ellas el mismo hecho | dependen de un sujeto vivo en producción con la tarjeta real del owner; y `04-open-decisions` declara que si la PRUEBA 0 vuelve negativa *«esas mediciones se tiran»* | `B7` entera, el diseño del grace, y el §61 como puerta de FASE 10 |
| 5 | `EX-33` / `EX-29` — la fecha de primer cobro futura | **nunca fue una garantía**: tres éxitos sobre un mecanismo que la propia matriz declara no identificado | `D8`, `DEC-SUB-006`, `DEC-SUB-007` — todo cambio de plan y de ciclo (`F-8B1-004`) |
| 6 | `R-MP-01` — la discontinuación de `/v1/payments` | **fecha desconocida y no consultable**: el canal técnico se cerró el 2026-09-19 | la capacidad 6, reembolsar, que es la que el derecho de revocación necesita (`F-8C2-015`) |
| 7 | KYC de Mobbex (en revisión desde 2026-09-18) y formulario comercial de MP (enviado 2026-09-19) | **sin SLA, sin fecha** | las nueve unidades ⛔ de billing, la FASE 1C y por lo tanto la mitad del despliegue único |
| 8 | 22 usuarios · 8 suscripciones todas mensuales | declarado «para revisar», sin disparador | `DEC-TRIAL-004` (*«cuando la base crezca dos órdenes»*), `DEC-ENT-004` y `DEC-GRANT-001` (*«el día que exista un ciclo anual»*), y `F-8B1-005` |

**El patrón**: seis de las ocho no caducan por el paso del tiempo sino **por un evento que el
propio programa va a provocar** —elegir pasarela, vender el primer anual, crecer la base—. Un
disparador por fecha no las cubre; lo que las cubriría es atar cada medición al acto que la
invalida, que es lo que `S-METH-01` enuncia y ningún documento instrumenta.

---

## Ataques que intenté y el diseño resistió

Ocho, y valen tanto como los hallazgos: son los lugares donde el mecanismo aguanta.

**1. «Alguien libera una épica sola por accidente.»** No encontré el camino. La regla está escrita
cuatro veces —`DEC-ARCH-007`, la partición §6, y las dos specs §4.3 / §6— y el contrato §5.3
explica, con nombre y apellido, por qué no hay una tercera implementación que lo permitiría. El
agujero que encontré (`F-8C2-003`) es de **herramienta**, no de intención: nadie va a decidir mal,
pero nada verifica.

**2. «La partición deja a verticales dependiendo de un precio.»** No. Busqué un campo de dinero que
verticales necesite leer y no hay: `billing_option` es la única hoja con monto, y el plan de trial
deriva de `rank` y `vendible`, que son columnas de `plan_version`. El corte por dentro del catálogo
es correcto y está bien argumentado. La filtración que sí existe va en la otra dirección
(`F-8B3-009`) y le toca a C1.

**3. «La migración arrastra historial de pagos.»** No: **cero pagos en la historia del sistema**,
medido y re-verificado sin un solo cambio. `DEC-MIG-001` se apoya en una premisa verificada, no
heredada, y ese trabajo está bien hecho.

**4. «Gastronomía, Experiencia y Partner tienen algo que migrar.»** No: cero filas en las tres,
medido. La afirmación *«su deuda es de código, no de datos»* se sostiene.

**5. «El trial no alcanza como implementación de arranque del contrato.»** No. La tabla de tres
filas del contrato §5.1 descarta el fail-open y el fail-closed con su razón, y la defensa §6.2
—*«un caso que no puede fallar es un comentario con exit code 0… si pasa con las dos, no está
probando nada»*— es de lo mejor escrito del programa.

**6. «El PR final se puede revisar por partes.»** Lo intenté y no hay forma dentro del flujo
declarado — y el diseño **ya lo sabe**: lo dice con esas palabras. El problema no es que no lo
hayan visto; es dónde pusieron el remedio (`F-8C2-003`).

**7. «Se puede empezar por `B2` en vez de `V1`.»** No. `B2` depende de `V2` por
`UNIQUE(plan_version_id, ciclo)`, y `V2` depende de `V1`. Verifiqué el grafo en los dos sentidos y
las dos dependencias cruzadas que la descomposición de billing declara —`B2`→`V2` y `B4`→`V4`— son
las únicas que encontré.

**8. «El §55 se puede diferir a después del despliegue.»** No, y es una buena decisión: `G8` es un
guard de `V1` y el invariante 32 está en la lista del §64. Diferirlo produce exactamente el guard
con lista de excepciones que las dos descomposiciones prohíben en su regla 1. Lo que falta no es la
regla: es que nadie sea dueño del trabajo (`F-8C2-006`).

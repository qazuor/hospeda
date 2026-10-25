# Árbol Linear de HOS-1787 · de los sub-specs a issues

Fuentes: los `## Criterio de aceptación` de `sub-specs/*.md` (ACs nominales `AC:<n>:<k>`), `docs/06-guards.md` (guards
`G-FAC-*`, cada uno con una hoja dueña), y los hijos y relaciones que ya existen en Linear (informados por el orquestador
el 2026-10-25; el preflight de sólo lectura de `crear_arbol.py --dry-run` los encontró a todos). Cada nodo es una issue:
`↻HOS-n` = existente que se reusa; sin marca = issue a crear. Las hojas son unidades de PR con objetivo de ~400 líneas
authored; el tamaño final se comprueba al implementar. Sólo las hojas llevan ACs o guards. Cada hoja lleva su etapa entre
corchetes (DEC-FAC-082). Validar: `python3 chequeo.py` (exit 0 = árbol sano). Mismo método que
`HOS-1352/docs/42-arbol-linear/`.

Estadísticas: 77 nodos · 10 existentes reusados · 65 hojas de PR · 97 ACs y 13 guards
cubiertos (exactamente una hoja por ítem) · por etapa: `pre-corte` 15 · `mvp` 49 ·
`post-mvp` 1 · smoke de staging en 1.B9, 9.3, 5.6.

Relacionada, sin bloquear y fuera del árbol: **HOS-1810** («una ficha = un local físico = una dirección», DEC-FAC-081).

- **HOS-1787 ↻HOS-1787** — Rubros de ficha (BusinessLine) y renombrado de Gastronomía a «Comer y salir» (venue)
  - **1 ↻HOS-1801** — 1 · Renombrado `gastronomy` → `venue` ← HOS-1798
    - **1.A** — 1 · Etapa A · Renombrado lógico, varios PRs verdes (subgrupo)
      - **1.A1** — 1 · Guard temporal de frontera y tipos de @repo/schemas a Venue* (etapa A, PR 1/5) `[pre-corte]` · 1 AC · G-FAC-T1 ← HOS-1798
      - **1.A2** — 1 · Modelos, servicios y utilidades de dominio a Venue* (etapa A, PR 2/5) `[pre-corte]` · 1 AC ← 1.A1
      - **1.A3** — 1 · Web: componentes, hooks y archivos a Venue* (etapa A, PR 3/5) `[pre-corte]` · 1 AC ← 1.A2
      - **1.A4** — 1 · Admin: config consolidada y formularios a Venue* (etapa A, PR 4/5) `[pre-corte]` · 1 AC ← 1.A3
      - **1.A5** — 1 · Namespace i18n gastronomy → venue (etapa A, PR 5/5) `[pre-corte]` · 1 AC ← 1.A4
    - **1.B** — 1 · Etapa B · Renombrado físico en la umbrella epic/HOS-1801-renombrado-fisico (subgrupo)
      - **1.B0** — 1 · Extender check-umbrella-branch-target.sh y cortar la umbrella epic/HOS-1801-renombrado-fisico (etapa B, PR previo a staging) `[pre-corte]` · 1 AC ← 1.A5
      - **1.B1** — 1 · Las cinco migraciones editadas y el catálogo que nace venue (etapa B, tramo 1/9, PR a la umbrella) `[pre-corte]` · 1 AC ← 1.B0
      - **1.B2** — 1 · Migración física de renombrado escrita a mano y extras 026/032 (etapa B, tramo 2/9, PR a la umbrella) `[pre-corte]` · 3 AC ← 1.B1
      - **1.B3** — 1 · Contratos de API, URLs, redirects 302 y QR de un salto (etapa B, tramo 3/9, PR a la umbrella) `[pre-corte]` · 1 AC · G-FAC-R2 ← 1.B2
      - **1.B4** — 1 · Seed, fixtures, usuarios de prueba e ids de What's New y del tour (etapa B, tramo 4/9, PR a la umbrella) `[pre-corte]` · 1 AC ← 1.B3
      - **1.B5** — 1 · Valores visibles, tile de la home, cache tags y G-FAC-R1 (etapa B, tramo 5/9, PR a la umbrella) `[pre-corte]` · 3 AC · G-FAC-R1 ← 1.B4
      - **1.B6** — 1 · Guards atados al nombre: una mutación posterior por guard (etapa B, tramo 6/9, PR a la umbrella) `[pre-corte]` · 1 AC ← 1.B5
      - **1.B7** — 1 · Ensayo del paso 3 del corte sobre un clon de prod-main (etapa B, tramo 7/9, PR a la umbrella) `[pre-corte]` · 1 AC ← 1.B6
      - **1.B8** — 1 · Marcha atrás escrita y runbook de la ventana de staging (etapa B, tramo 8/9, PR a la umbrella) `[pre-corte]` · 1 AC ← 1.B7
      - **1.B9** — 1 · PR de la umbrella a staging, ventana de mantenimiento, smoke y compuerta del corte (etapa B, tramo 9/9, PR de la umbrella a staging) `[pre-corte]` · 3 AC · smoke staging ← 1.B8
  - **2 ↻HOS-1802** — 2 · Catálogos, columna `business_lines` y tipos `PUB`/`BOLICHE` ← 1
    - **2.1** — 2 · Tipos PUB y BOLICHE: enum, ADD VALUE, etiquetas y descripciones (PR 1/5) `[mvp]` · 1 AC ← 1.B9
    - **2.2** — 2 · Catálogo de secciones, rasgos, campos, rubros y reglas, con G-FAC-02 (PR 2/5) `[mvp]` · 2 AC · G-FAC-02 ← 2.1
    - **2.3** — 2 · Columna business_lines: CHECK, default, backfill, GIN y verificación de seed (PR 3/5) `[mvp]` · 4 AC · G-FAC-01 ← 2.2
    - **2.4** — 2 · Validador, opciones de rubro y contrato del rechazo 400 (PR 4/5) `[mvp]` · 3 AC · G-FAC-07, G-FAC-09 ← 2.3
    - **2.5** — 2 · Dimensiones de reseña en el catálogo y validateReviewDimensions (PR 5/5) `[mvp]` · 2 AC ← 2.4
  - **3 ↻HOS-1803** — 3 · Resolvedor de secciones y paso de autorización ← 2
    - **3.1** — 3 · Resolvedor puro de secciones y predicado isGranted (PR 1/12) `[mvp]` · 1 AC ← 2.5
    - **3.2** — 3 · Paso 4b en la cadena de autorización de fichas (PR 2/12) `[mvp]` · 1 AC ← 3.1
    - **3.3** — 3 · Rutas de la carta con sección, rasgos e intención (PR 3/12) `[mvp]` · 2 AC ← 3.2
    - **3.4** — 3 · Menú del día, eventos y lecturas protegidas por la cadena, con G-FAC-06 (PR 4/12) `[mvp]` · 1 AC · G-FAC-06 ← 3.3
    - **3.5** — 3 · Endpoint de estados de secciones para el editor del dueño (PR 5/12) `[mvp]` · 1 AC ← 3.4
    - **3.6** — 3 · PATCH multisección, migración de experiencia al resolvedor y G-FAC-04 (PR 6/12) `[mvp]` · 2 AC · G-FAC-04 ← 3.5
    - **3.7** — 3 · Contenido absent para el dueño: lectura y vaciado sólo del dueño (PR 7/12) `[mvp]` · 2 AC ← 3.6
    - **3.8** — 3 · Lector público único por vertical y proyector genérico (PR 8/12) `[mvp]` · 1 AC ← 3.7
    - **3.9** — 3 · Chat de IA, folleto, /carta/, QR de mesa y enlace de carta pago (PR 9/12) `[mvp]` · 3 AC ← 3.8
    - **3.10** — 3 · Validación de reseñas por dimensiones en las rutas de alta (PR 10/12) `[mvp]` · 1 AC ← 3.9
    - **3.11** — 3 · Recálculo votedOnly, test golden de experiencia y publicación de dimensiones (PR 11/12) `[mvp]` · 2 AC ← 3.10
    - **3.12** — 3 · Estados degradados del resolvedor y G-FAC-03 (PR 12/12) `[mvp]` · 1 AC · G-FAC-03 ← 3.11
  - **4 ↻HOS-1804** — 4 · Sección `nightInfo` ← 2, 3
    - **4.1** — 4 · Listas planas de tipos derivadas del enum (PR 1/5) `[mvp]` · 1 AC ← 2.5
    - **4.2** — 4 · Columnas de nightInfo, schemas Zod y validación en servidor (PR 2/5) `[mvp]` · 4 AC ← 4.1, 3.6
    - **4.3** — 4 · nightInfo en el purge, en la lista de la acción 15 y G-FAC-10 (PR 3/5) `[mvp]` · 2 AC · G-FAC-10 ← 4.2
    - **4.4** — 4 · «Abierto ahora» con turnos que cruzan la medianoche (PR 4/5) `[mvp]` · 1 AC ← 4.3
    - **4.5** — 4 · nightInfo en la ficha pública: «De noche» e insignia +N (PR 5/5) `[mvp]` · 2 AC ← 4.4, 3.12
  - **9 ↻HOS-1805** — 9 · Copy neutro del embudo ← 1, 2
    - **9.1** — 9 · Copy neutro del embudo en la web (es/en/pt) (PR 1/3) `[mvp]` · 2 AC ← 1.B9, 2.1
    - **9.2** — 9 · Correos neutros: serie de prueba y recordatorio de renovación (PR 2/3) `[mvp]` · 1 AC ← 9.1
    - **9.3** — 9 · What's New de lanzamiento y smoke del embudo en staging (PR 3/3) `[mvp]` · 1 AC · smoke staging ← 9.2
  - **5 ↻HOS-1806** — 5 · Editor del dueño ← 3, 4, 9
    - **5.1** — 5 · Registro del editor derivado del catálogo y G-FAC-08 (PR 1/8) `[mvp]` · 1 AC · G-FAC-08 ← 3.12, 4.5
    - **5.2** — 5 · Estados absent y locked en el editor y en el hub (PR 2/8) `[mvp]` · 1 AC ← 5.1
    - **5.3** — 5 · menuUrl dentro de la carta y upsell de la carta corregido (PR 3/8) `[mvp]` · 2 AC ← 5.2
    - **5.4** — 5 · Widget de QR de mesa y paso del tour según el rasgo menu.qr (PR 4/8) `[mvp]` · 1 AC ← 5.3
    - **5.5** — 5 · Aviso antes de bajar de plan con el resolvedor simulado (PR 5/8) `[post-mvp]` · 1 AC ← 3.12
    - **5.6** — 5 · Alta y rubros: preselección, opciones y mensajes de rechazo (PR 6/8) `[mvp]` · 3 AC · smoke staging ← 5.4, 9.2
    - **5.7** — 5 · Ciclo de vida de los rubros en edición y resumen de lo oculto (PR 7/8) `[mvp]` · 2 AC ← 5.6
    - **5.8** — 5 · What's New de rubros y G-FAC-05 (PR 8/8) `[mvp]` · G-FAC-05 ← 5.7
  - **6 ↻HOS-1807** — 6 · Web pública ← 3, 4, 9, HOS-1797
    - **6.1** — 6 · Ficha por catálogo, breadcrumb y JSON-LD por tipo (PR 1/12) `[mvp]` · 1 AC ← 3.12, 4.5
    - **6.2** — 6 · Slugs reservados por los segmentos estáticos de cada vertical (PR 2/12) `[mvp]` · 1 AC ← 6.1
    - **6.3** — 6 · Badge «abierto ahora» calculado en el cliente (PR 3/12) `[mvp]` · 1 AC ← 6.2
    - **6.4** — 6 · Chat de IA de la ficha: prompt neutral y reglas duras de edad (PR 4/12) `[mvp]` · 1 AC ← 6.3
    - **6.5** — 6 · Comparativa de planes generada desde el catálogo en el web (PR 5/12) `[mvp]` · 1 AC ← 6.4
    - **6.6** — 6 · Reseñas en la web: formulario con dimensiones y promedios en la ficha (PR 6/12) `[mvp]` · 1 AC ← 6.5
    - **6.7** — 6 · Comodidades y características de noche en el seed con dual-write (PR 7/12) `[mvp]` · 1 AC ← 6.6
    - **6.8** — 6 · Colecciones /rubro/[rubro]/ y listado general con la paginación compartida (PR 8/12) `[mvp]` · 1 AC ← 6.7, HOS-1797, 9.2
    - **6.9** — 6 · Crawl, sitemap y colección vacía (PR 9/12) `[mvp]` · 1 AC ← 6.8
    - **6.10** — 6 · Filtros por colección y chips de tipo según fichas reales (PR 10/12) `[mvp]` · 1 AC ← 6.9
    - **6.11** — 6 · Cache: purga por cambio de rubros y revalidación por cambio de plan (PR 11/12) `[mvp]` · 2 AC ← 6.10
    - **6.12** — 6 · Menú «Comer y salir», textos aprobados y tile de la home (PR 12/12) `[mvp]` · 1 AC ← 6.11
  - **7 ↻HOS-1808** — 7 · Admin ← 2, 3, 4
    - **7.1** — 7 · Rubros en el formulario consolidado y en el listado del admin (PR 1/5) `[mvp]` · 1 AC ← 2.5, 3.12
    - **7.2** — 7 · menuUrl fuera del admin y nightInfo no editable desde el admin (PR 2/5) `[mvp]` · 2 AC ← 7.1, 4.2
    - **7.3** — 7 · Registro y aviso al dueño de un cambio de rubros de un tercero (PR 3/5) `[mvp]` · 2 AC ← 7.2
    - **7.4** — 7 · Corrección de rubros por REQUEST_FIX y vista de soporte sobre el dueño (PR 4/5) `[mvp]` · 2 AC ← 7.3
    - **7.5** — 7 · Moderación de reseñas de venue con dimensiones votadas (PR 5/5) `[mvp]` · 1 AC ← 7.4
  - **8 ↻HOS-1809** — 8 · Migración del editor de alojamiento al catálogo ← 3

## Etapas (DEC-FAC-082)

| etapa | significa | label de Linear | hojas |
|---|---|---|---|
| `pre-corte` | mergeada antes de que HOS-1352 promueva `staging` → `main` | `pre-corte-1352` (nuevo) | 15 |
| `mvp` | antes del lanzamiento v1; puede caer después del corte | `pre_v1_product` | 49 |
| `post-mvp` | después del v1 | `post_v1` | 1 |

Todo HOS-1801 es `pre-corte`; el resto es `mvp`, salvo `5.5` (aviso antes de bajar de plan, `post-mvp`, DEC-FAC-083).
`chequeo.py` exige que una hoja `pre-corte` sólo dependa de hojas `pre-corte` y una `mvp` nunca de una `post-mvp`. Para
eso, `5.6` depende de `5.4` (ya no de `5.5`) y `5.5` depende sólo del resolvedor (`3.12`). Los hijos existentes reciben el
label de la etapa más temprana de sus hojas: HOS-1801 +pre-corte-1352, HOS-1802 +pre_v1_product, HOS-1803 +pre_v1_product, HOS-1804 +pre_v1_product, HOS-1805 +pre_v1_product, HOS-1806 +pre_v1_product, HOS-1807 +pre_v1_product, HOS-1808 +pre_v1_product, HOS-1809 +post_v1.

## Reglas del árbol

- Los hijos 1-9 de Linear se reusan tal cual; el 8 (HOS-1809) no tiene sub-spec todavía y no lleva hojas.
- **Sub-spec 1, dos etapas** (DEC-FAC-030). La **etapa A** (`1.A1`…`1.A5`) son PRs normales a `staging`, cada uno verde,
  cortados por familia de símbolos con todos sus consumidores y sin alias temporales; G-FAC-T1 vigila que los literales
  viejos sólo bajen. La **etapa B** es un único merge a `staging` y se integra en la umbrella
  `epic/HOS-1801-renombrado-fisico` (DEC-FAC-077, convención `epic/**` de DEC-CI-001): `1.B0` es un PR normal a `staging`
  que extiende `scripts/check-umbrella-branch-target.sh` (hoy vigila **una** umbrella, `UMBRELLA_BRANCH`); después se
  corta la umbrella de `staging`; `1.B1`…`1.B8` son PRs de tramo a la umbrella (CI rojo admitido entre tramos); `staging` se
  mergea en la umbrella periódicamente; `1.B9` es **el PR de la umbrella a `staging`**, con CI completo verde, la ventana
  de mantenimiento y el smoke. HOS-1801 bloquea a HOS-1352 (DEC-FAC-084).
- Dentro de cada hijo las hojas encadenan en el orden de implementación que describe su sub-spec. Entre hijos, una hoja
  sólo depende de hojas de hijos **upstream**, y cada relación de hijos queda materializada por al menos una arista entre
  hojas. Donde la spec lo permite, la arista es más fina que «salida → entrada» (p. ej. `4.2 ← 3.6`, `9.1 ← 2.1`,
  `5.6 ← 9.2` y `6.8 ← 9.2` por DEC-FAC-076, `7.2 ← 4.2` por DEC-FAC-078).
- G-FAC-05 nace incremental en `5.8`; las hojas `6.6`, `7.1`, `7.2`, `7.5` y la post-MVP `5.5` suman sus archivos a su
  escaneo en el PR que los migra.
- Las hojas de más de cuatro AC no existen (máximo 4).
- Labels: `kind-spec` y `source-agent` (como HOS-1352), las `area-*` de cada hoja, el label de su etapa, y
  `status-needs-smoke-staging` sólo en 1.B9, 9.3, 5.6, las hojas cuyos ACs exigen smoke.

## Cambios en los ACs

- **Partidos al tokenizar** (mismo texto, sólo cortado y re-puntuado): los de G-FAC-R1/R2 (`AC:1:1`/`AC:1:2`) y los cuatro
  guards del sub-spec 2 (`AC:2:1`…`AC:2:3`), con el texto reordenado; `AC:3:8`/`AC:3:9`, `AC:4:1`/`AC:4:2`,
  `AC:4:3`/`AC:4:4`, `AC:4:5`/`AC:4:6`, `AC:5:1`…`AC:5:4`, `AC:5:9`/`AC:5:10` y los de `/carta/` y de filtros del 6.
- **Fusionados** (y renumerados): el viejo `AC:1:12` («`db:migrate` desde cero con las cinco editadas») se fusionó en
  `AC:1:3`; el viejo `AC:6:6` (302 de `/carta/`) en `AC:3:10`, porque lo implementa `3.9`.
- **Nuevos**: `AC:1:15`…`AC:1:19` (etapa A, uno por PR), `AC:1:20` (retiro de G-FAC-T1), `AC:1:21` (guard de la umbrella),
  `AC:2:11` (preselección del servidor, DEC-FAC-079), `AC:2:12` (contrato del 400 de rubros), `AC:5:11` (smoke del alta como
  boliche, movido del 9 por DEC-FAC-080). Guard nuevo: G-FAC-T1.

## Contradicciones que quedan en la spec

1. **3 ↔ 4**: `AC:3:2` y `AC:3:3` nombran `nightInfo`, que nace en el sub-spec 4, y el 4 depende del 3. El árbol prueba
   esos ACs en el 3 con secciones que ya existen y deja la parte literal de `nightInfo` en `AC:4:3`.
2. `AC:6:13` verifica la tile de la home, que se renombra en el sub-spec 1 (`1.B5`): es una verificación, no trabajo del 6.

Resueltas en esta vuelta: 7 sin el 4 (DEC-FAC-078), smoke del 9 (DEC-FAC-080), G-FAC-05 (incremental), alta entre la columna
y el selector (DEC-FAC-079), etapa A sin criterio (ACs y G-FAC-T1), duplicados, 400 sin AC (`AC:2:12`) y la regla «una ficha
= un local físico» (HOS-1810, DEC-FAC-081).

## Relaciones que crea `crear_arbol.py` entre issues existentes

- **HOS-1804 bloquea HOS-1808**: DEC-FAC-078: el admin necesita las columnas y el selector derivado del 4.
- **HOS-1801 bloquea HOS-1352**: DEC-FAC-084: el renombrado bloquea el corte V6 de HOS-1352.

## Creación

`python3 crear_arbol.py` imprime el plan sin crear nada (con `LINEAR_API_KEY` también corre el preflight de sólo lectura).
`python3 crear_arbol.py --apply` requiere `LINEAR_API_KEY` y valida en Linear el team HOS, los labels, los hijos existentes,
las issues externas y los títulos antes de la primera mutación. Después, sólo si falta cada cosa: crea el label
`pre-corte-1352`; crea las issues nuevas de padres a hijos y registra cada identificador en `creados.json` (en una
reanudación también reconoce la marca `Árbol HOS-1787 — clave:` en la descripción remota); crea las relaciones
`blocked by` de las issues nuevas (incluidas las que apuntan a HOS-1798 y HOS-1797) y las dos relaciones de arriba entre
issues existentes; y **agrega** a cada hijo existente el label de su etapa sin quitar los que ya tiene. Fuera de eso, las
issues existentes y las externas no se tocan.

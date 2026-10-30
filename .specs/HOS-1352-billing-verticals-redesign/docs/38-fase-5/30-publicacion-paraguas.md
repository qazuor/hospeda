---
title: "FASE 5 · publicación del grupo del paraguas"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 5
---

# FASE 5 · publicación del grupo del paraguas

Publicación de la FASE 5 aplicada (commits `7a224777ad..73e6f0b167`) en el grupo del paraguas:
tablero, paraguas, contrato, presentación y ficha de `U1`, más la ficha nueva de `U2`. Sin commits,
sin push y sin tocar Linear. Los HTML publicados quedan en el scratchpad de la sesión
(`pub-paraguas/`).

## 1. Cifras usadas, recontadas con script

- Decisiones del log: `rg -o "^### DEC-[A-Z]+-\d+" 01-decision-log.md | sort -u | wc -l` → **142**
  (125 funcionales y 17 de metodología; precisadas sin `SUPERSEDED` 71, `SUPERSEDED` 12,
  apartamientos 11, según el resumen del log).
- Matriz: `python3 contar-filas-de-la-matriz.py` → **117 = 63 · 16 · 24 · 14**; esperan medición 9,
  no se miden 9 (5 de ellas `UNKNOWN`).
- Unidades 24, guards 34 = 18 · 15 · 1, dependencias entre épicas 12: tomadas de
  `27-` §6 y `28-` §1, que las recontaron con script, y cruzadas contra `16-` §4.6.
- Casos borde de la presentación: `class="chip"` sobre el HTML publicado → **45** (eran 52; salieron
  siete del corte y el resumen del §10 de la parte 3 pasó de 11 filas a 4).

## 2. Qué cambió en cada artifact

### Ficha nueva de `U2` · <https://claude.ai/artifact/SSqQ7sSpUXzfiTCUbM8fGb>

- Creada en la familia visual de la ficha de `U1` (mismos tokens, tipografía y secciones), con el
  contenido de `16-` §4.6 (fila y párrafo de `U2`), `NUCLEO/07` §1 a §4 (§1.4) y `NUCLEO/08` §2.4.
  Icon `mail`. La issue de Linear figura como «por crear».

### Tablero · <https://claude.ai/artifact/VvQ3hGSGZC5nr4ZHc5VqPB>

- Grafo: nodo `U2` (paraguas, depende de `U1`, sin guards, sin issue, con link a su ficha); `V6`,
  `V9`, `B4` y `B12` suman la dependencia sobre `U2`; `V1` suma `G18`; el estado suma `U1` y `U2`
  en `pending`. El cálculo de «listas» no cambió: `U2` queda «lista» cuando `U1` esté hecha.
- El renglón de la unidad y el link a Linear se muestran sin issue cuando no hay (`U2`).
- Lede 23 → 24 unidades, contador 0 de 24, paraguas 0/2; textos de las tres secciones con `U2`;
  el párrafo de dependencias entre épicas aclara que las esperas sobre `U2` no se cuentan.
- El bloque de estado reescrito: FASE 5 cerrada, `U2`, `U1` más grande, nombre del package, corte
  simplificado, `EX-57`/`EX-58` medidas y `EX-59` en parte, lo que sigue.
- El guardado propio del tablero (`save()`) publicaba `"<!doctype html>"+documentElement.outerHTML`,
  que envolvía la página dos veces en cada tilde (el publicado anterior estaba doble). Ahora arma el
  documento en la forma del contrato de runtime (skeleton exacto + contenido del body).
- Pie: «FASE 5 aplicada».

### Paraguas · <https://claude.ai/artifact/WiHhGp54XspK1mwFpHWjRA>

- Navegación y pie con `U2`; lede con las dos unidades del paraguas.
- Sección «Las unidades del paraguas: U1 y U2»: `U1` crecida (lista de la FASE 5), las tres columnas
  que viven hasta `V6` por sus lectores fuera del cobro, y un párrafo de `U2`; 23 → 24 unidades.
- Tabla de decisiones: suma `DEC-ARCH-015` y `DEC-MIG-007`.
- Párrafo del corte reescrito entero contra `DEC-MIG-007` y la simplificación: cinco cuentas, borrado
  del resto con tabla de paso, regla única en el borde, tres actos, sin lápidas/Worker/detector,
  abortar = restaurar + imagen vieja con la regla puesta hasta el reintento, dos situaciones
  declaradas.
- Estado: 1C con 117 = 63 · 16 · 24 · 14 y la lista de 14 `UNKNOWN`; 3 y 4 con 24 unidades; fila
  nueva «5 · gap analysis» cerrada; «6 y 7» con lo que sigue; 139 → 142 decisiones con 71 · 12 · 11
  y las tres contra la recomendación de la FASE 5; tarjetas 24 unidades y 34 guards (18 · 15 · 1);
  «Lo próximo» reescrito.

### Contrato · <https://claude.ai/artifact/KgHuCs8uTVEtNeuYfuLLJQ>

- Párrafo nuevo: en las rutas de escritura de las verticales el paso de cobertura lo agrega `V5`
  (lote 1 A), con el hueco de la rama.
- Párrafo nuevo tras el empuje de `PURGED`: desde la FASE 5 no queda otro camino al borrado (lote 3 C).
- Punto 5 del package: la FASE 5 no mueve el reloj; huso, id de corrida y correlación son de `U2`.
- Nombre del package: `@repo/billing-verticals-contract` (`DEC-ARCH-015`), con su README.
- Pie: «FASE 5 aplicada».

### Presentación · <https://claude.ai/artifact/QnbPFvMXQKPh1J86eM3JXf>

- Intro: lede, tarjeta 23 → 24 piezas, punto 7 de «En pocas palabras» (cinco cuentas, el resto se
  borra), «Dónde estamos y qué sigue» (comparación hecha, qué sigue, 24 piezas).
- Parte 1: la impersonación apagada sale en la pieza de autorización (lote 4 C); desaparece el
  borrado físico (lote 3 C); alta directa de Partner sin dueño (N); rol de socio dado en el reclamo y
  nunca quitado (4 B y F); §12 «No se migran filas» reescrito sin el umbral de veinte.
- Parte 2: la línea de clientes actuales del 1.1 con las cinco cuentas; en 6.5, las devoluciones de
  una misma orden de a una (4 F, J y M).
- Parte 3: §1 suma la comparación con el código y las premisas del corte; §2 con 24 piezas, la
  limpieza crecida, pieza nueva «la cola de correos», esperas de V6/V9/B4/B12, conciliación sin
  marcas ni detector del corte; §3 con 34 controles (18 · 15 · 1) y el control 34.
- §4 «El día del corte» reescrito entero (13 pasos contra la tabla viva de `16-` §4.2, fichas,
  pagos, cortesías, purga que siempre corre, Juan y Luis, rama de aborto simplificada, dos
  situaciones declaradas); §5 con las tres cosas del paso 0 y las tres mediciones del 30/09 ya
  hechas; §6 (a) hecha; §7, §8 y §9 sin lo que salió y con las tres decisiones contra la
  recomendación de la FASE 5 (1 I, 4 B y aplicación A); §10 con 4 casos borde; conmutador 52 → 45.

### Ficha de `U1` · <https://claude.ai/artifact/DAqq2XU5iLpm3p9Mb9wGNq>

- Navegación y pie con `U2`; lede y pull con el nombre del package y `U2` como dependiente.
- 23 → 24 unidades; tarjetas nuevas (6 columnas de `partners`, ~790 valores de permisos, 14
  variables); punto 3 con `DEC-ARCH-015` y el README; punto 4 nuevo con los diez ítems de la FASE 5.
- «La excepción de las tres columnas» reescrita: viven hasta `V6` por sus lectores fuera del cobro
  (lote 3 B); sale la razón de `L5`/`L7`.
- Guards 33 → 34 (18 · 15 · 1, `G18` de `V1`, `U2` sin guards); criterio de «lista» suma el punto 4;
  «Mientras tanto» con los tres huecos de la rama; «Dependen de ella» suma `U2`.

## 3. Sin cambios

Ninguno del grupo: los cinco tenían contenido superado por la FASE 5 y se republicaron.

## 4. Verificación de lo publicado

Releído cada uno con `Artifact read` (`path: index.html`, versiones `1790803019-63fe`,
`1790803022-b698`, `1790803024-b431`, `1790803027-7bfb`, `1790803030-44d8` y `1790802691-13ad`):
un solo `<!doctype>`, un `<html>` y un `<body>` por página (el segundo `<!doctype` del tablero es
el literal de `save()`), y presentes «FASE 5 aplicada», el nombre del package, «0 de 24 hechas»,
«45 casos borde» y el link a la ficha de `U2` en tablero, paraguas y `U1`.

## 5. Residuos vistos en la fuente (no se editaron)

- `HOS-1352/spec.md:146` — «FASE 5 · gap analysis · FASE 6 · rewrite/reuse · FASE 7 · estrategia |
  ⬜ **se parten limpio**: cada épica hace la suya». La FASE 5 se hizo una sola vez, a nivel programa,
  y está cerrada (`38-fase-5/`, `03-handoff.md:50`). Vale lo segundo; las publicaciones lo siguen.
- `16-fase-7-del-paraguas.md:450` — «4b son ~~dos cosas~~ ~~tres cosas~~ dos cosas, cada una con su
  inverso», enumeradas como (b) y (c) porque la (a) salió: la cifra está bien, la numeración quedó
  corrida. Cosmético.
- La presentación decía «Y antes de implementar nada, se vuelve a medir la cartera» (parte 3, §6).
  No encontré esa regla viva en `16-`, `12-`, `07-` ni en las `spec.md` (`rg` sin resultados); quedó
  como estaba y no se agregó nada. Si no tiene fuente, conviene sacarla en la próxima publicación.
- `03-handoff.md:118` y `:162` — «`EX-46` y sus espejos todavía dicen "el barrido lo relee"»: la
  frase no aparece en la fila de `EX-46` (`06-`) ni en sus espejos de `$B/spec.md` y
  `$B/descomposicion.md` (`rg` fuera de registros e históricos: sólo `B/09:801` y `:810`, que hablan
  de otra relectura), y `VF5-06` reescribió esos tres el mismo día (`28-` §5). El pendiente parece
  viejo; no lo verifiqué más allá de ese `rg`.

## 6. Linear que tendría contenido para actualizar (no se tocó)

- **HOS-1352** (paraguas): comentario de progreso de la FASE 5 (142 decisiones, matriz 117 = 63 · 16
  · 24 · 14, 24 unidades, 34 guards, `U2`, corte simplificado por `DEC-MIG-007`) y los links a esta
  publicación, incluida la ficha de `U2`.
- **HOS-1400** (`U1`): la descripción debe sumar el punto 4 (los diez ítems de los lotes 1 y 2 E y la
  H de la aplicación), el nombre del package, la nueva razón de las tres columnas (viven hasta `V6`),
  guards 34 = 18 · 15 · 1 y `U2` como dependiente.
- **Issue nueva de `U2`** (sub-issue de HOS-1352): el contenido de su ficha. Al crearla, falta poner
  su id en el tablero (`iss` del nodo `U2`) y en la ficha de `U2` («issue por crear»).
- Fuera de este grupo, pero visto: **HOS-354** (impersonación, lote 4 C) se cierra o se reescribe, y
  las issues de `V6`, `V9`, `B4` y `B12` suman la espera sobre `U2`.

## Segunda pasada: HOS-1401 y HOS-1400

Se creó la issue de `U2`, **HOS-1401**, sub-issue de HOS-1352. Esta pasada puso su id en los
artifacts y actualizó la descripción de HOS-1400 (`U1`). Sin commits ni push. Los HTML están en el
scratchpad de la sesión (`link-paraguas/`).

### Artifacts que cambiaron

- **Ficha de `U2`** (versión `1790803287-8cd6`): el eyebrow pasó de «Unidad U2 del paraguas
  HOS-1352 · issue por crear» a «HOS-1401 · unidad U2 del paraguas HOS-1352», igual que el de `U1`;
  «Dónde vive» dice ahora `HOS-1401` con link a Linear en vez de «La issue todavía no está creada»;
  el pie suma «HOS-1401 en Linear ↗», como el de `U1`.
- **Tablero** (versión `1790803289-23c5`): el nodo `U2` pasó de `iss:""` a `iss:"HOS-1401"`, así que
  el renglón muestra «U2 · HOS-1401» y aparece el link «Linear ↗», igual que en los demás nodos. El
  bloque `<script id="state">` quedó idéntico (mismo hash antes y después) y la capacidad `artifact`
  se mantuvo.

Cada cambio se hizo con un script que exige una sola coincidencia por reemplazo, sobre el HTML sin el
envoltorio del servicio. Releído lo publicado: la ficha de `U2` tiene un solo `<!doctype>`, un
`<html>` y un `<body>`. El tablero tiene dos de cada uno: el envoltorio más el literal de `save()`.

### Artifacts sin cambios

- **Paraguas** y **ficha de `U1`**: nombran a `U2` y enlazan su ficha, pero ninguno menciona su issue
  como pendiente ni sin id. No se republicaron.
- **Contrato** y **presentación**: no formaban parte de esta pasada y no se revisaron.

### HOS-1400: el patch, por sección

Un solo `save_issue` con nueve reemplazos anclados. Releído con `get_issue`: estado Backlog, sin
prioridad, las mismas cinco etiquetas y el mismo padre (HOS-1352).

- **Callout inicial**: la FASE 5 ya se hizo; ya no queda nada del programa antes de escribir código.
- **Deja funcionando, punto 3**: nombre `@repo/billing-verticals-contract` en
  `packages/billing-verticals-contract` (`DEC-ARCH-015`), sin contenido, con `description` y
  `README.md`.
- **Punto 4 nuevo**, con la lista de la ficha: gates de entitlement fuera de las rutas de verticales,
  `billing_notification_log` renombrada (la absorbe `U2`), unas cincuenta migraciones de datos del
  seed fuera, las seis columnas de pago de `partners` con sus FK y tres crons,
  `service_suspended` / `plan_restricted` / `has_active_subscription`, `is_featured` /
  `featured_by_entitlement`, `archive-abandoned-drafts`, extras `032` y `033`, enums recreados
  (incluido permisos) y 14 variables de entorno.
- **Párrafo de las migraciones del seed**: reescrito según la ficha (ya no están en la rama, las 11 del
  archivo de planes entre ellas).
- **Por qué una unidad propia**: suma `U2` (HOS-1401) y pasa de 23 a **24 unidades**.
- **La excepción de las tres columnas**: la razón nueva (lectores fuera del cobro, viven hasta `V6`);
  sale la de `L5` y `L7`.
- **Por qué `G8` sí y `G16` no**: guards **34** (18 · 15 · 1), `G18` de `V1`, `U2` sin guards.
- **Mientras tanto**: los tres huecos que deja el punto 4 en la rama.
- **Está lista cuando**: suma el criterio del punto 4.
- **Dependen de ella**: `V1`, `B1` y `U2` (HOS-1401); `B2` por `V2` sigue.
- **Pie**: «Escrita el 30/09/2026 contra el diseño vigente (FASE 5,
  `.specs/HOS-1352-billing-verticals-redesign/docs/38-fase-5/`)».

Linear movió el cierre de una negrita en «**Siguen vivas hasta** `V6`», porque normaliza el código
dentro de negritas, igual que en «**Filas** `UNKNOWN`». Es cosmético.

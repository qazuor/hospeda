---
title: "FASE 9 completa · salida 3: la spec y la descomposición de verticales, recorridas enteras"
linear: HOS-1352
statusSource: linear
created: 2026-09-25
updated: 2026-09-25
status: CURRENT
fase: 9
---

# FASE 9 completa — salida 3 de `DEC-METH-004` en la épica de verticales

Carril: `V/spec.md` y `V/descomposicion.md` (`V` = `HOS-1353-verticales-capacidades-y-autorizacion/`),
recorridos **enteros** contra el diseño vigente: capítulos `V/*`, núcleo, contrato, log, las
decisiones del owner de [`10`](./10-decisiones-del-owner.md), los registros `11`, `12`, `13`, `15`,
`16` y `17`, y el consolidado `25-fase-8-completa/00` §5. Las líneas son las del texto **después**
de aplicar. Lo que cambió de sentido quedó tachado al lado, con la fecha; `updated: 2026-09-25` en
los dos archivos. No se commiteó.

## 1. Cambios en `V/spec.md`

| línea | qué | cierra |
|---|---|---|
| `:6` | `updated` | — |
| `:59` | `18`: la presencia con página y carrusel, cada una con su clave, y el bit de moderación | 7b, 7c |
| `:60` | `19`: el botón de suscribirse que manda a publicar | 6c |
| `:61` | `20`: ~~dieciocho~~ **diecinueve** guards | 4e (`G-R2-C`) |
| `:62` | `21`: el corte ya no siembra trials; la escritura `C` | 2g |
| `:63` | `22`: ~~hash irreversible~~ **seudónimo determinístico** | `C-1` (lo pedían `11` §5 y `17` §5) |
| `:71` | ~~51~~ **54** invariantes (37 + `D1`–`D17`, `N/04` §3) | recuento: la cifra era anterior a `D15`–`D17` |
| `:116-120` | nota: el catálogo de addons partido por campo y las dos columnas de `vertical` | FASE 8 (`F-8CA3-011`), 6a; sin cambio de sentido |
| `:155-184` (§3.6) | la precondición se lee del recurso y la vertical es inmutable; *«Tres precisiones»* tachado; `PB12` junto a `PB8`; **precisión 7** (lo ajeno sólo público); paso 2 ~~inhabilitada~~ **correo sin verificar**; el lock en los limits; qué pasos recorre una lectura, y la de lo propio sin el 6 | 7a, 8c, 8b, `R14`, 8d, `F-8CA2-004` |
| `:217-223` (§3.9) | el trial se consume al ejercer el evento o con el primer pago; `T6`/`T8`; el botón | `DEC-TRIAL-010`, 6c |
| `:280-283` (§4) | la enumeración de consumidores de `cubierto` tachada: ya había caducado (faltaban `T1`, `T6` y el reconciliador diario), que es el defecto que el mismo párrafo describe | recorrido de esta pasada |
| `:288-290` (§4) | cruza también `piso` | 9h |
| `:313-315` (§4.1) | el reconciliador diario de cobertura entre lo que se ejerce sin billing | `DEC-ARCH-009` |
| `:323-329` (§4.2, punto 1) | `T8` y la guarda de `T6` quedan inactivas sin billing; el botón sólo ejerce su rama de publicar | 6c |
| `:356-358`, `:375` (§5) | ~~dieciocho~~ **diecinueve**, ~~once~~ **doce** `G-R*` (siguen **cuatro** referencias cruzadas: `G-R2-C` no lo es, `B/20` §6) | 4e |
| `:365` (§5, fila `G2`) | las tres mitades de `G2` | `F-8CA1-001`, 7a |
| `:385-393` (§6) | ~~«nada que migrar y nada que romper»~~: no transcribe ninguna fila (ni de `trial`); lo único que toca de lo existente son las fichas —escritura `C`, la despublicación por el reconciliador, 410→404— | 2g, `C-7`, `F-8CA1-014` |

## 2. Cambios en `V/descomposicion.md`

| línea | qué | cierra |
|---|---|---|
| `:6` | `updated` | — |
| `:55` (V2) | `situaciónDeVertical.admiteAltas` la lee también `S1` | 6a |
| `:56` (V3) | invalidación por `user`; la de una vertical entera, que invoca el barrido de `B12`; el trinquete lee `piso` de la fuente | 8a, 6b, 9h |
| `:57` (V4) | la firma entera (siete campos, con `piso`); las ocho transiciones; `T6` y `T8` | 9h, 6c, `DEC-TRIAL-010` |
| `:58` (V5) | precisiones 6 y 7, paso 2, lecturas de lo propio | 7a, 8c, 8b, 8d |
| `:59` (V6) | población Partner del reconciliador; **la máquina entera**: lock, `MODERATED`/`PB10`/`PB11`, `PB11` como sexto hecho, `PB12`, vertical inmutable, **escritura `C`**; capítulo `21` §2.4 | `R13`/7b, `R14`, `F-8CA2-004`, 5b, 7a, `F-8CA3-002` |
| `:60` (V7) | página y carrusel con su clave, bit de moderación, 404 y no 410; capítulo `21` §4 | 7b, 7c, `F-8CA1-014` |
| `:61` (V8) | el botón inteligente; filas 20 a 22 del `19` §4 | 6c |
| `:62` (V9) | ~~cinco~~ **seis** hechos (el sexto, `PB11`); ~~hash~~ **seudónimo**; el registro de actos del dueño sin el texto de contenido; capítulo `08` §1.1–§1.2 del núcleo | 5b, `C-1`, 8e |
| `:107` (§2.5) | ~~cinco~~ **seis** hechos | 5b |
| `:115-118` (§2.5) | `PB11` ejecutor único del sexto; la escritura `C` nace con la columna | 5b |
| `:137-139` (§2.5) | ~~quinto~~ **séptimo** hecho; el sexto ya lo probó | 5b |
| `:189-201`, `:211` (§2.6) | ~~nueve~~ **diez** máquinas; ~~seis~~ **siete** de billing; ~~«ocho tablas»~~ **las otras nueve máquinas, en siete tablas más** (el «ocho» contaba máquinas) | 5a |
| `:268` (§2.8) | ~~nueve~~ **diez** máquinas | 5a |
| `:316-323` (§2.9) | **`C10`**: la cita tachada de `B/10` §3.5 reemplazada por el texto vigente; criterio y conclusión sin cambio | `C10` del informe `01` |
| `:337` (§2.9) | *«hoy 31»* | 4e |
| `:341-407` (**§2.10 nuevo**) | el censo de lo que agregó la FASE 9 completa, con su unidad; la escritura `C` a V6; la acción de moderar con dos sujetos; **`G-R2-C` a `B10`** (propuesta) | ver §3 |
| `:444-449` (§4) | ~~30~~ **31** guards; `G-R2-C` todavía en ninguna columna | 4e |
| `:461` (§4) | ~~nueve~~ **diez** máquinas | 5a |
| `:478-484` (§4, criterios) | V3 (invalidación por `user`, vertical entera, `piso`), V4 (`T6`/`T8`), V5 (8b, 7a, 8c, 8d), V6 (lock, reconciliador, `PB11`), V7 (carrusel, moderada → 404), V8 (botón), V9 (seudónimo, `PB9` sólo contenido, eventos sin texto) | ídem |

**Cada § citado se verificó que existe**: `N/02` §1, `V/10` §1–§2, `V/15` §1–§4 y §2.5–§2.6,
`V/02` §2.1, §2.2, §2.5, §3, §4, `V/03` §2, §9, §11, `V/11`, `V/17` §1.1, §1.2, §3.4, §3.5, `V/18`
§1.6, `V/19` §4, `V/21` §2.4 y §4, `V/22` §3, `N/01` §1.2, `N/08` §1.1–§1.2 y §3, contrato §2, §2.1,
§2.5, §2.7, §4.1, §4.2, §5.1, §6.3, `B/03` §5, §6.1, §7.2, `B/10` §3.5, `B/descomposicion` §2.3,
§2.8, §4. Ninguno falta.

## 3. Asignaciones que hizo esta pasada — **tres elecciones para el orquestador**

Todas las reglas nuevas de la épica tienen unidad (tabla del §2.10). Tres no la tenían o tenían una
dudosa, y la elegí yo:

1. **La escritura `C` del corte → V6.** `V/21` no estaba en la columna de ninguna fila. V6 crea
   `listing.inactiva_desde` (`V/02` §2.5) en la migración estructural donde `C` escribe, y construye
   `G-R6-B`, que ya la admite.
2. **La acción de moderar, con dos sujetos (`PB10`/`PB11` en V6, el bit de la presencia en V7).**
   La construye la primera de las dos que llegue y la otra le agrega su sujeto: **no agrega arista
   al grafo del §3**. La alternativa (V7 espera a V6) es una dependencia por una fila de catálogo.
3. **`G-R2-C` → `B10`, contra la sugerencia de `15` §3/§4 (7) y `17` §5 (V3, «con `G-R2-B`»).** El
   dato que compara —las verticales compatibles— vive en `addon_product` (`B/02` §2.4), de billing, y
   **ninguna fuente lo transporta**: en V3 el guard leería billing (regla 2 del §1.1) o no tendría
   contra qué fallar, porque la implementación de arranque no emite addons. `G-R2-B` sí puede vivir
   en V3 porque su dato (`referencia`, `piso`) viaja en la fuente. Es el argumento del §2.7 con
   `G-R5`. **Hasta que `B/descomposicion.md` lo escriba en `B10`, `G-R2-C` sigue sin unidad** y
   `B/20` §6 sigue en 1. Si el orquestador prefiere V3, el §2.10 hay que reescribirlo y la fila de
   V3 gana `G-R2-C` (17 → 18 en esta épica).

## 4. Lo que NO apliqué, y por qué

- **§2.8, *«que su rojo sea informativo hasta que las nueve estén»***: es la cita de una salida
  descartada, fechada; no la toqué.
- **§2.6, *«los cuatro pares con dos destinos»***: `V/20` §2 sigue diciendo cuatro con `T8` (que no
  comparte `(desde, evento)`); no recontado contra `B/03` §3.2 con `S32`–`S35`: es la lista de otro
  carril.
- **`V/descomposicion.md` tiene 522 líneas.** Es un documento de diseño, no código; `B/descomposicion`
  ya pasa de 600. Lo dejo dicho.

## 5. Citas fuera de carril que quedaron desalineadas

| archivo:línea | dice | tendría que decir | causa |
|---|---|---|---|
| `V/20:355-356` | *«Qué unidad lo construye no está asignado todavía: es de la descomposición … queda anotado para ella»* | *«La descomposición lo propone para **`B10`** (`descomposicion.md` §2.10): su dato, las verticales compatibles, es de `addon_product` y ninguna fuente lo transporta; `V/20` conserva la fila, como la de `G-R5`»* | §3.3 |
| `V/20:59` (fila `G-R2-C`, *de dónde sale*) | — | agregar *«Lo construye `B10` (`descomposicion.md` §2.10)»*, como la fila de `G-R5` nombra `B8` | §3.3 |
| `B/20:366` (*sin unidad*) | *«por su capítulo le corresponde la de `G-R2-B`, `V3`; la asignación es de `V/descomposicion.md`»* | *«`V/descomposicion.md` §2.10 lo propone para `B10`, y la asignación la escribe `B/descomposicion.md`»*; y, cuando se escriba, **sin unidad 1 → 0** y *con unidad* 30 → 31 | §3.3 |
| `B/descomposicion.md` §2 fila `B10` (columna guards `—`) | — | **`G-R2-C`**, con un § que dé la razón (la del `V/descomposicion.md` §2.10) | §3.3 |
| `B/descomposicion.md:634` | *«Los ~~29~~ 30 guards … 13 en esta»* | *«31 … **14** en esta»* (con `G-R2-C` en `B10`) | 4e |
| `B/descomposicion.md` fila `B13` | — | el espejo del botón inteligente (`B/19` §4), si no lo tiene | 6c |
| `B/descomposicion.md` fila `B12` | — | que el barrido del día del fin de servicio **invoca la invalidación de la vertical entera** (`V/02` §3.2; `B/10` §4.3) | 6b |
| `B/descomposicion.md` fila `B4` | — | la firma de siete campos (`piso`) y un caso de `GRANT` con piso en el juego del contrato §6.2 (ya lo listó `17` §5) | 9h |
| `V/18:191` (§2.1) | *«es la novena máquina»*; *«El §63 pide ocho»* | la postulación es una de las **diez** (`N/01` §2): *«la novena máquina»* es ordinal de cuando se agregó; conviene una nota *(hoy diez, con el reembolso: 5a)* | 5a |

## 6. Linear: qué issues quedan desactualizados (para la salida 4)

Por lo que cambió en las dos sub-specs; no leí las descripciones en Linear.

| issue | unidad | qué le falta |
|---|---|---|
| `HOS-1353` | la épica | 19 guards (no 18); seudónimo; 54 invariantes; §3.6 con precisiones 6–7, paso 2 y lecturas de lo propio; §3.9 conversión con el primer pago y `T8`; §6 la escritura `C` |
| `HOS-1356` | V2 | `admiteAltas` leída por `S1` (6a) |
| `HOS-1357` | V3 | invalidación por `user` (8a) y por vertical entera (6b); `piso` en el trinquete (9h); criterio de terminación nuevo |
| `HOS-1358` | V4 | `T8`, la guarda de `T6` (6c); firma de siete campos (9h); criterio nuevo |
| `HOS-1359` | V5 | precisiones 6 (generalizada, inmutable) y 7, paso 2, lecturas de lo propio; `G2` con tres mitades; criterio nuevo |
| `HOS-1360` | V6 | la máquina entera (`PB10`–`PB12`, `MODERATED`/`PURGED`), el lock, `PB11` como sexto hecho, la población Partner del reconciliador, **la escritura `C` y el capítulo `21` §2.4**; la acción de moderar compartida con V7; criterios nuevos |
| `HOS-1361` | V7 | clave del carrusel, bit de moderación, 404 y no 410 (`21` §4); criterio nuevo |
| `HOS-1362` | V8 | el botón inteligente y las filas 20–23 del `19` §4 |
| `HOS-1363` | V9 | seis hechos; seudónimo; eventos sin texto de contenido (8e) |
| `HOS-1373` | `B10` | `G-R2-C`, si el orquestador confirma §3.3 |
| `HOS-1375` · `HOS-1376` · `HOS-1367` | `B12` · `B13` · `B4` | la invalidación de la vertical (6b) · el espejo del botón (6c) · la firma con `piso` (9h) — si su sub-spec no lo recoge ya |

Las fichas publicadas (artifacts del §5 de la descomposición y la de la épica) arrastran lo mismo.

## 7. Listas cerradas recontadas

```text
$ rg -o "^\| \*{0,2}(G[0-9]+|G-R[0-9]+(-[A-Z])?)\*{0,2} " V/docs/20-testing.md | sort -u | wc -l
19            # 7 con id propio (G1-G6, G8) + 12 G-R*
$ rg -o "^\| \*\*V[0-9]\*\* \| \*\*[^|]+\| [^|]+\| [^|]+\| (.*) \|$" -r '$1' V/descomposicion.md   # columna guards
V1: G1 G3 G8 · V2: G-R3 · V3: G-R2 G-R2-B · V4: G-R4 G-R4-B G-R6 · V5: G2 G4 G6 G-R3-B G-R3-C
V6: G5 G-R6-B G-R5-B → 17 en esta épica; G-R2-C en ninguna (propuesto B10)
$ rg -n "cincuenta y cuatro" HOS-1352-…/docs/nucleo/04-invariantes.md    # 37 + 17 = 54
$ python3 (conteo de ~~ por párrafo/fila, fuera de bloques de código) → 0 desbalanceados en los dos
$ npx markdownlint-cli2 V/spec.md V/descomposicion.md → 0 issues
```

| lista | antes (en estos archivos) | ahora |
|---|---|---|
| guards del catálogo `V/20` §2 | 18 | **19** (`G-R*`: 11 → **12**; referencias cruzadas: 4, sin cambio) |
| guards del programa | 30 | **31** (17 aquí + 13 allá + `G-R2-C` sin unidad) |
| hechos de reinicio | 5 (+ `C`) | **6** (+ `C`) |
| máquinas | 9 | **10** (3 aquí, 7 en billing en 5 tablas) |
| invariantes del núcleo | 51 | **54** |
| transiciones de trial | 7 | **8** (citadas, no contadas en la spec) |
| publicación | — | 6 estados / 12 transiciones (citadas en la fila de V6) |

Búsqueda final de cifras viejas en los dos archivos, fuera de tachados:
`rg -n -P "(?<!~~)\b(nueve|ocho) (máquinas|tablas)|(?<!~~)(cinco|cuatro) hechos|(?<!~~)dieciocho|hash irreversible"`
→ sólo apariciones tachadas o el *«nueve pasos»* de la autorización, que es correcto.

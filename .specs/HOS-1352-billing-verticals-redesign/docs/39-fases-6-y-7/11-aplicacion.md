---
title: "FASES 6 y 7 · 11 · Aplicación del lote al diseño"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 7
---

# FASES 6 y 7 · 11 · Aplicación del lote

Aplica al diseño las respuestas del owner del 2026-09-30 (A a G, todas la recomendada, y lo derivado
del §2.3 de la propuesta) de [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md), según el
§4 de [`00-propuesta.md`](./00-propuesta.md). Siglas como en la propuesta: `D`, `V/`, `B/`, `16-`.
Las líneas del §1 son las del archivo después de aplicar A–G; las de los §5 y §6 (el lote del pase, H–J, y el lote de la aplicación, K–M, que llegaron en la misma pasada) son las finales, y corren las del §1 hacia abajo. **No se tocaron**: el PDR, la matriz, los
informes históricos (`37-…`, `38-fase-5/0*`, `F5/01`, `F5/02`) ni `20-pase-fase-6.md`. Sin commits.

## 1. Qué cambió, por archivo

### `D/01-decision-log.md`

- l.7365: *Estado* de `DEC-ARCH-014` suma la precisión de las FASES 6 y 7 (F); los punteros del lote
  C y del lote de la aplicación se corrigen tachando (`~~último~~ antepenúltimo`, `~~último~~
  penúltimo`), porque el 📌 nuevo pasa a ser el último.
- l.7470-7483: 📌 nuevo en `DEC-ARCH-014` (F): `U3`, el script del corte, 25 unidades, sin guards ni
  dependencias entre épicas nuevas; y el reapunte de la regla de smoke en `U1` (B).
- l.7511: `DEC-METH-018` nueva (G): la FASE 6 cerrada por absorción en la 5 más el pase, que corre
  en paralelo a `U1` y **vuelve al owner sólo si sale `REWRITE` o cambia el alcance de una unidad**.
- l.7563: `DEC-ARCH-016` nueva (A a E y lo derivado D-1 a D-5): los cinco gates de aceptación.
- l.7656: *Decisiones tomadas* ~~142~~ **144**.
- l.7657: *De metodología* ~~17~~ **18**.
- l.7658: *Funcionales* ~~125~~ **126**.
- l.7659: *Precisadas sin `SUPERSEDED`*: nota de recuento; sigue en **71**.
- l.7677: fila nueva *«FASES 6 y 7»*: 2 nuevas, 1 📌, 0 `SUPERSEDED`.

### `D/16-fase-7-del-paraguas.md`

- l.22-26: *«cinco ítems resueltos»* tachado; los seis resueltos y la FASE 7 del paraguas cerrada.
- l.32-34: *«Sigue pendiente `acceptance gates`»* tachado; apunta al §4.7.
- l.56: §1, fila `acceptance gates`: ~~—~~ el §4.7.
- l.79-90: §2, *«Cómo se lee desde las FASES 6 y 7»*: la rama es `epic/HOS-1352-verticales-billing`
  y nace para `U1` (D-1); nace con el CI encendido (A); para `U3` la fecha del §2 es la de su
  diseño, ya escrito (F).
- l.146: §4.2 paso 0, *«El ensayo, definido»*: copia de producción con correos reescritos y la
  lista real de las cinco (C), imagen vieja desplegada, verde según D-5, la parte de `staging` del
  checklist nuevo adentro (B), el script de `U3` (F).
- l.158: paso 5, la columna *«por qué»* suma *«y el smoke de producción del 5c»* (B).
- l.160: fila nueva **5c**, el smoke de producción del checklist nuevo (B).
- l.376-381: *«las herramientas del corte»*, punto 1: *«Es de esta FASE 7… fecha del §2»* tachado;
  lo construye `U3` (F).
- l.789-814: §4.6, la cifra ~~24~~ **25** unidades con `U3`, y el párrafo *«Antes de la primera
  fila»*: el CI por el PR `[NOSPEC:epic-ci]` (A), el reapunte de la regla de smoke en `U1` (B) y los
  tres guards sin destino a la lista de `U1` si el pase los manda (G).
- l.818: fila `U1`: la regla de smoke reapuntada (B) y su PR como primero con CI completo (A).
- l.820: fila nueva **`U3`** (F).
- l.831: reparto de guards: *«ni `U3`»*, siguen 34.
- l.851-852: párrafo de `U2`: *«tiene 24 unidades»* tachado; 24 y, con `U3`, 25.
- l.854-868: párrafo nuevo de **`U3`**: dónde vive, dependencias (ninguna de código), quién la
  espera (el ensayo y los pasos 1a, 1b y 2), sin dependencias entre épicas ni guards.
- l.896-984: **§4.7 nuevo, «Los gates de aceptación»**: los cinco momentos (D-2 con D y A; D-3; el
  ensayo con C y D-5; D-4; E) y el smoke manual del cobro nuevo (B).
- l.993-1001: §5: *«Uno de los seis… trabajo pendiente»* tachado; ninguno, la FASE 7 del paraguas
  cerrada.

### `D/../spec.md` (HOS-1352)

- l.19: *«dos unidades propias»* tachado; tres.
- l.24-28: `U3` agregada; *«24 unidades»* tachado; **25**.
- l.150: fila FASE 5 · 6 · 7: ~~⬜~~ ✅ las tres, la 6 por absorción con el pase G (`DEC-METH-018`),
  la 7 con los gates (`DEC-ARCH-016`).
- l.151: fila FASE 8 · 9: ~~⬜~~ ✅ sobre el conjunto, en tres vueltas; la 3 cerró el 2026-09-30.
  **Respaldo**: `D/03-handoff.md`, *«Histórico: 2026-09-30 — FASE 8 y FASE 9 vuelta 3, cerradas»*.
- l.160-163: la línea de decisiones, ~~142~~ **144** (18 y 126).
- FASE 10 queda ⬜, sin tocar.

### `V/descomposicion.md`

- l.561: §3, fila *«`U3`, fuera del grafo»*.
- l.584: §4, *«24 unidades»* tachado; **25**, con `U3` sin guards.
- l.619-630: §4, párrafo nuevo: las dos condiciones son parte del gate por unidad de `16-` §4.7
  (D-2), con la fila `UNKNOWN` (D) y el CI (A); el gate de épica (D-3).
- l.676-680: §6, la razón caduca: *«Es FASE 5 y tiene su gate propio»* tachado; FASE 5 más el pase
  de la FASE 6 (`DEC-METH-018`).

### `B/descomposicion.md`

- l.139: §2, fila `B13`: suma el checklist del sistema nuevo en `docs/billing/`, en dos partes (B).
- l.463-470: §2.7, *«no está escrito en ninguna decisión, y no se decide acá»* tachado; la regla de D.
- l.733: §3, fila *«`U3`, fuera del grafo»*.
- l.801: §4, *«24 unidades»* tachado; **25**, *«ni `U3`»*.
- l.849-860: §4, el mismo párrafo del gate por unidad que en `V/`.
- l.875: §4, fila `B13`: el checklist nuevo existe, en dos partes (B).
- l.925-929: §6, la razón caduca, como en `V/`.

### `V/docs/20-testing.md`

- l.6: `updated` al 2026-09-30.
- l.361-366: §2.1, *«romperlo una vez no alcanza: se rompe contra el job»* (D-2).
- l.372-378: §5, los e2e en el gate por unidad y el de épica (D-2, D-3); el smoke manual es de `B13`.

### `B/docs/20-testing.md`

- l.6: `updated` al 2026-09-30.
- l.457-462: §2.1, igual que en `V/20`.
- l.696-701: §4.1, la batería cierra las filas `UNKNOWN` de una unidad terminada (D).
- l.772-781: §5.1 punto 4: `B13` escribe el checklist del sistema nuevo en `docs/billing/`, en dos
  partes (B); la regla del `CLAUDE.md` ya apunta ahí desde `U1`; los viejos siguen en `staging`.

### Lo que el §4 de la propuesta nombra y no es un archivo del diseño

- `.qtm/specs/SPEC-143-billing-testing-coverage/docs/`: los tres checklists ya estaban restaurados
  (`10-`, *«Hecho en el acto»*). No se tocaron.
- **Linear, pendiente, no hecho acá**: la issue de `U3` como sub-issue de `HOS-1352` (F), y la
  etiqueta `status-needs-smoke-prod` en `HOS-1352` y en ninguna unidad (D-2, E).

## 2. Cifras recontadas

| cifra | antes | después | comando |
|---|---|---|---|
| decisiones | 142 | **144** | `rg -o "^### DEC-[A-Z]+-\d+" $D/01-decision-log.md \| sort -u \| wc -l` |
| de metodología | 17 | **18** | `rg -o "^### DEC-METH-\d+" $D/01-decision-log.md \| sort -u \| wc -l` |
| funcionales | 125 | **126** | la diferencia de las dos de arriba |
| IDs repetidos | 0 | **0** | el mismo `rg` con `sort \| uniq -d` |
| precisadas sin `SUPERSEDED` | 71 | **71** con A–G; **73** con M | script en Python sobre el campo *Estado* de cada bloque (`precisad\|recontad\|enmendad\|cerrad` y sin `SUPERSEDED`) |
| unidades | 24 | **25** | `U1`, `U2`, `U3` + 9 + 13, por las tablas de `16-` §4.6 y los dos §2 |
| dependencias entre épicas | 12 | **12** | filas no tachadas de la tabla de `B/descomposicion.md` §2.6: 1 a 7, 9 a 12 y 14 |
| guards | 34 | **34** con A–G; **35** con H | `U3` no suma; `G19` sí: 19 + 15 + 1, con un script en Python que junta los ids de la columna *guards* de las dos tablas de unidades (§2 de cada descomposición), sin lo tachado ni los paréntesis en cursiva, más `G8` de `U1` |

## 3. Residuos vistos

- `D/01` l.7365, *Estado* de `DEC-ARCH-014`: los punteros *«ver su antepenúltimo 📌»* (lote P) y
  *«ver su penúltimo 📌»* (lotes 1 y 2) ya estaban corridos antes de este lote; sólo corregí los dos
  que este 📌 corría. No los toqué: lo anoto.
- `D/01`, fila *«Decisiones de arquitectura del owner»* del resumen: dice **4**, cuenta sólo las del
  2026-09-18; es un conteo congelado anterior, no de este lote.
- `B/descomposicion.md` §2.7, encabezado: *«trece filas `UNKNOWN`»*, cuando la matriz tiene 14. No
  es de este lote.
- `16-` §5 se sigue titulando *«Lo que este documento todavía no contesta»* aunque ahora dice
  *«ninguno»*. No lo renombré: cambiar un título es de la tarea de cierre.

## Vuelve al owner

*(Las tres las contestó el owner el mismo día, todas la recomendada: «Lote de la aplicación (K–M)» de `10-decisiones-del-owner.md`, aplicado en el §6. Quedan tachadas.)*

1. ~~**Si `U3` puede mergearse en la rama antes que `U1`.**~~ **Cerrada: K.** El lote dice *«sin dependencias de
   código»* y *«se mergea antes del ensayo»*, pero no el orden respecto de `U1`, y el PR de `U1` es
   el primero de la rama con CI completo (A). Quedó marcado con ⚠️ en `16-` §4.6, párrafo de `U3`.
2. ~~**Qué recorta `B13` en la rama.**~~ **Cerrada: L.** `B/20` §5.1 punto 4 dice que `B13` recorta *«el checklist de
   staging»* sección por sección y actualiza la regla del `CLAUDE.md`, y el lote le suma escribir el
   checklist nuevo *«junto con el recorte que ya tiene»*. Pero `U1` borra `.qtm/` en la rama, así
   que ahí el checklist viejo ya no existe cuando llega `B13`: el recorte, leído a la letra, no
   tiene sujeto en la rama. Lo apliqué a la letra y no elegí una lectura.
3. ~~**📌 en `DEC-CI-001` y `DEC-TEST-002`.**~~ **Cerrada: M.** La propuesta dice que `DEC-ARCH-016` *«precisa»* a las
   dos. Lo escribí en las implicaciones de `DEC-ARCH-016`, sin 📌 en ellas, porque el lote sólo
   nombra el 📌 de `DEC-ARCH-014`; ponérselos movería la cifra de precisadas (hoy ninguna de las dos
   está contada).

## 5. Lote del pase de la FASE 6 (H–J), y los `ADAPT` que no volvieron

Origen de cada enmienda: *«(FASES 6 y 7, pase de la FASE 6, owner 2026-09-30, <letra>)»*; los
`ADAPT` que no volvieron llevan la letra **G** (*«lo que no vuelve al owner se aplica»*), porque
no son una elección nueva. Líneas finales.

### H · el actor de sistema, reescrito en `V5`, y `G19`

- `V/descomposicion.md` l.58: fila `V5` del §2, el actor de sistema reescrito; guards, **`G19`**.
- `V/descomposicion.md` l.637: fila `V5` del §4, un actor de sistema no ejecuta ninguna de las 25 y
  `G19` rojo ante uno armado fuera de la fábrica.
- `V/docs/17-autorizacion.md` l.576-592: §3.3, *«Cómo se cumple, y no por lista»*; `updated` al
  2026-09-30.
- `V/docs/20-testing.md` l.60: fila nueva **`G19`**. El id es el siguiente libre de la numeración
  `G`, con el precedente escrito en la fila de `G18`.
- Conteo de guards, **~~34~~ 35**, **~~18~~ 19** de verticales: `V/descomposicion.md` l.584-585;
  `B/descomposicion.md` l.801-802; `B/docs/20-testing.md` l.390-392 (filas de `V/20`, guards
  distintos y con unidad); `V/spec.md` l.66 (~~veinte~~ **veintiún guards**), l.390 (~~Diez~~
  **Once** con id propio) y l.392 (~~veinte~~ **veintiuno**); `16-` l.828 (fila `U2`), l.839 (el
  reparto) y l.840 (*«ni `U3`»*); `D/01` l.7496 (📌 F de `DEC-ARCH-014`, *«que siguen en 34»*
  tachado).

### I · los tres guards sin destino

- `16-` l.751-757: §4.6 punto 4, bullet nuevo: `U1` borra los dos de `product-domain` con su
  cableado y reescribe el texto del ternario.
- `16-` l.821: el párrafo *«Antes de la primera fila»*: el condicional tachado; tienen destino.
- `V/descomposicion.md` l.54 (fila `V1` del §2) y l.633 (fila `V1` del §4): `V1` retira el ternario
  con `G1`, y el caso de `HOS-1079` hace fallar a `G1`.
- `V/docs/20-testing.md` l.50: fila `G1`, el caso de `HOS-1079` y el retiro del ternario.

### J · `partners.tier`

- `V/descomposicion.md` l.60 (fila `V7` del §2) y l.639 (fila `V7` del §4): `V7` la borra con su
  índice en la migración de `starts_at` y `ends_at`, y sus lectores pasan a la clave.

### Los `ADAPT` que no volvieron (G)

| pieza | unidad | dónde quedó |
|---|---|---|
| `AUT-003`, lista *«sólo `SUPER_ADMIN`»* rechazada al escribir y restada al resolver | `V5` | §2 l.58; §4 l.637 |
| `AUT-004`, la acción 26 sobre la ruta de roles | `V5` | §2 l.58 |
| `AUT-010`, el paso 2 en el contrato de errores | `V5` | §2 l.58 |
| `AUT-027`, el permiso de la acción y el sujeto en las rutas de 15 y 23 | `V5` | §2 l.58 (en `V8` ya estaba: pasos 5 a 7 sobre el dueño) |
| `AUT-015`, `accounts` en la acción 24 | `V8` | §2 l.61; §4 l.640 |
| `BD-013`, la prueba de los favoritos en la acción 24 | `V8` | §4 l.640 |
| `BD-009`, el `UNIQUE` parcial de `partners.owner_user_id` | `V7` | §2 l.60; §4 l.639 |
| `BD-014`, la prueba de `set_updated_at` | `V1` | §2 l.54; §4 l.633 |
| `BD-010`, `BD-026` | `V6`; `U1` | ya estaban en su unidad: no se tocaron |
| `AUT-113`, el permiso de la acción 13 | la primera de `V6` y `V7` que llegue | §2 l.59 y l.60; §4 l.638 y l.639 (agregado en el §7) |

### En el log y en `spec.md`

- `D/01` l.7575: `DEC-METH-018`, campo nuevo *«Resultado del pase»*: el pase se hizo, 13 `KEEP` ·
  11 `ADAPT` · 1 `REWRITE` · 4 ya no se conservan, y H–J lo cerraron. **Va como campo y no como
  📌**: la decisión es de hoy y el owner fijó las precisadas en 73 con M; un 📌 la habría llevado a
  74.
- `D/01` l.7718: fila *«FASES 6 y 7»* del resumen, con el lote del pase.
- `spec.md` l.150: FASE 6, *«que corre en paralelo…»* tachado; el pase se hizo y lo cerraron H a J.

## 6. Lote de la aplicación (K–M)

Origen: *«(FASES 6 y 7, lote de la aplicación, owner 2026-09-30, <letra>)»*. Líneas finales.

- **K**, `16-` l.873-876: el ⚠️ del párrafo de `U3` tachado; entra después de `U1`, en paralelo con
  `V1`, `B1` y `U2`, y sólo tiene que estar mergeada antes del ensayo. `16-` l.829: fila `U3`.
  `V/descomposicion.md` l.561 y `B/descomposicion.md` l.733: la fila *«`U3`, fuera del grafo»*.
  `D/01` l.7496-7499: el 📌 F de `DEC-ARCH-014` lo suma.
- **L**, el recorte del checklist viejo de `B13`, tachado con su origen: `B/docs/20-testing.md`
  l.766-772 (§5.1 punto 4); `B/descomposicion.md` l.139 (fila `B13` del §2); `16-` l.988-992
  (§4.7, el smoke manual); `D/01` l.7659 (`DEC-ARCH-016`).
- **M**, 📌 en `DEC-CI-001` (`D/01` l.2721, *Estado*; l.2771, el 📌) y en `DEC-TEST-002` (l.5268,
  *Estado*; l.5289, el 📌); `DEC-ARCH-016` apunta a los dos (l.7676); **precisadas sin
  `SUPERSEDED` ~~71~~ 73** (l.7700), recontado con el script del §2: suman `DEC-CI-001` y
  `DEC-TEST-002`.

### Vuelve al owner, de H a M

Nada. ~~Un residuo sin unidad: `AUT-113`, el permiso de moderación de dos niveles de la acción 13, el
pase lo da `ADAPT` sin nombrar unidad (*«declararlo es `AUT-001`»*), y no lo asigné.~~ (`AUT-113`
quedó en `V6` y `V7` por la verificación ajena, §4: ver el §7.)

## 7. La verificación ajena (`21-verificacion.md`)

Origen de cada enmienda: *«(FASES 6 y 7, verificación, 2026-09-30, F<n>)»*; la de `AUT-113`,
*«§4»*. F14 (el handoff) no es de esta aplicación: lo hace el coordinador.

| hallazgo | qué se hizo | dónde |
|---|---|---|
| F1 | la cifra de decisiones de la tabla de documentos, ~~142~~ **144**, con `DEC-METH-018` y `DEC-ARCH-016` | `spec.md` l.89 |
| F2 | lo mismo en el índice del núcleo, ~~142~~ **144** (145 encabezados menos la plantilla); `updated` | `nucleo/00-indice.md` l.44 |
| F3 | la regla del catálogo de `V/20`: ~~diecinueve~~ **veintiuno** | `V/spec.md` l.414 |
| F4 | 📌 en `DEC-TEST-003` por L y B, con su *Estado*; `DEC-TEST-003` en el *Dónde* de `DEC-ARCH-016`; la fila *«FASES 6 y 7»* del resumen del log | `D/01`, `DEC-TEST-003`, `DEC-ARCH-016` y el resumen |
| F5 | la razón caduca, tachada y remitida a `DEC-METH-018` (en `B/`, con el *«salvo `qzpay`»*) | `V/spec.md` l.457; `B/spec.md` l.342 |
| F6 | la celda de la FASE 8 · 9 sigue ✅, y dice que la final sobre el conjunto se hizo: la completa *«sobre el núcleo, las dos épicas y el contrato»* (`DEC-METH-014`) y la vuelta 3 *«entera y desde cero»* (`DEC-METH-016`) | `spec.md` l.151 |
| F7 | J en el capítulo de Partner (`tier` y su índice en la migración de `V7`); `updated` | `V/docs/18-partner.md` §1.6 |
| F8 | ~~16~~ **17** que ya tenían unidad, con `G19` | `B/docs/20-testing.md`, fila *«con unidad»* |
| F9 | `codeql` en el gate de épica | `V/docs/20-testing.md` §5 |
| F10 | los punteros del *Estado* de `DEC-ARCH-014`, por lote y no por ordinal; la mención de F suma K | `D/01`, `DEC-ARCH-014` |
| F11 | el disparador de la tarea de cierre (E) | `spec.md`, *«Al cerrar HOS-1352»* |
| F12 | 📌 en `DEC-ARCH-014` (I) y en `DEC-ENT-006` (J), con su *Estado*; el resumen los suma | `D/01` |
| F13 | recontado con script: la tabla del §2.7 tiene 13 de las 14 `UNKNOWN`; la que falta, `EX-49`, es del paso 0 del corte. El encabezado sigue en trece, con la nota | `B/descomposicion.md` §2.7 |
| §4 | `AUT-113`: un solo permiso de la acción 13 para la ficha y la presencia, que declara la primera de `V6` y `V7` que llegue; los dos niveles, sólo en la ficha (📌 de `DEC-DATA-007`); en §4, que ninguna ruta de moderación lea `ACCOMMODATION_MODERATION_CHANGE` ni `PARTNER_MANAGE` | `V/descomposicion.md` §2 y §4, `V6` y `V7` |

**Cifras recontadas al final, con script**: decisiones **144** (18 de metodología, 126 funcionales,
0 repetidos); precisadas sin `SUPERSEDED` **73** y `SUPERSEDED` **12** (los tres 📌 nuevos caen
sobre decisiones ya contadas); guards **35** (19 · 15 · 1); unidades **25**; dependencias entre
épicas **12**; matriz **117 = 63 · 16 · 24 · 14** (`contar-filas-de-la-matriz.py`); 📌 de la fila
*«FASES 6 y 7»* del resumen, **6** (`DEC-ARCH-014` con F y K, y con I; `DEC-CI-001`;
`DEC-TEST-002`; `DEC-TEST-003`; `DEC-ENT-006`).

## Key Learnings

1. **Insertar una fila en una tabla por texto puede dejarla fuera de orden**: la fila de `U3` quedó
   entre `U1` y `U2` porque el ancla era el final de la de `U1`; lo vi recién al listar las filas
   por número de línea, y la moví.
2. **Un comando con `|` adentro de una celda de tabla la parte en columnas**: el `rg … | sort -u |
   wc -l` citado en el resumen del log rompió MD056 y MD038; en una celda va sin la tubería o
   escapada.
3. **El recuento de *precisadas* se puede automatizar**: un script sobre el campo *Estado* de cada
   bloque (precisada, recontada, enmendada o cerrada, y sin `SUPERSEDED`) dio 71, lo mismo que la
   cifra a mano; antes de este lote nadie lo había corrido así.
4. **Un 📌 nuevo corre los punteros ordinales del *Estado*** (*«último»*, *«penúltimo»*): cada 📌
   agregado vuelve falso el *«ver su último 📌»* del anterior, y dos ya estaban corridos antes.
5. **La propuesta pedía decidir la fila `UNKNOWN` sin decir en qué unidades cae**: el diseño sólo
   ata con certeza `GR-2` a `B7`; `PA-6` y `RC-8` los nombré como filas y no les asigné unidad.
6. **Contar guards por la columna *guards* exige filtrar las tablas de cinco columnas**: el primer
   script contó `G8` en `V1` porque leía también la tabla del §4, de dos columnas, donde `G8`
   aparece en el texto del criterio; con el filtro dio 34, y 35 con `G19`.
7. **Un 📌 sobre una decisión nacida el mismo día mueve la cifra de precisadas**: el resultado del
   pase entró en `DEC-METH-018` como campo propio para que la cifra quede en la que fijó el owner
   (73), y está dicho en el resumen del log.
8. **Tachar la consecuencia sin tachar la decisión madre deja el log diciendo las dos cosas**: L se
   aplicó en cuatro espejos y no en `DEC-TEST-003`, que era de donde salía el recorte; lo encontró
   la verificación ajena (F4).
9. **Un espejo de cifra fuera del registro es el que queda viejo**: `spec.md:89`, el índice del
   núcleo y `V/spec.md:414` repetían cifras que el registro movió en otro renglón del mismo archivo.

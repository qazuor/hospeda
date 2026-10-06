---
title: "FASES 6 y 7 · 32 · Publicación del grupo de cobro"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 7
---

# FASES 6 y 7 · 32 · Publicación del grupo de cobro

Publica en los artifacts y en Linear lo que las FASES 6 y 7 cambiaron del cobro, desde
`bfc6367909` hasta `0be493e57a`: `B/descomposicion.md`, `B/docs/20-testing.md`, `B/spec.md` y
`16-fase-7-del-paraguas.md` §4.6 y §4.7, con los lotes A–M de
[`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md). Siglas: `B/` es
`.specs/HOS-1354-billing-cobro-y-proveedor/`. Sin commits.

## 1. Cifras recontadas con script antes de escribirlas

| cifra | valor | cómo |
|---|---|---|
| decisiones | **144** (18 de metodología) | `rg -o "^### DEC-[A-Z]+-\d+"` sobre `01-decision-log.md`, con `sort -u` y `wc -l` |
| unidades | **25** | `U1`, `U2`, `U3` en `16-` §4.6, más 9 de verticales y 13 de billing |
| guards | **35 = 19 · 15 · 1** | ids de la columna *guards* de las tablas de cinco columnas de las dos descomposiciones, sin tachados ni cursivas, más `G8` de `U1` |
| dependencias entre épicas | **12** | filas no tachadas de `B/descomposicion.md` §2.6: 1 a 7, 9 a 12 y 14 |
| matriz | **117 = 63 · 16 · 24 · 14** | `contar-filas-de-la-matriz.py` |
| esperan medición | **9** | la misma salida: `PA-6`, `GR-2`, `RC-8`, `RF-3`, `EX-43`, `EX-44`, `EX-45`, `EX-47`, `EX-49` |

## 2. Artifacts

| artifact | versión | cambio |
|---|---|---|
| Épica de billing | 14 | fila `B13` de la tabla *«qué suma»*: el checklist de smoke nuevo en `docs/billing/`, en dos partes, y el recorte viejo retirado (B, L) |
| Épica de billing | 14 | título de la sección: suma *«y las FASES 6 y 7»* |
| Épica de billing | 14 | camino crítico: `U3`, el script del corte ([HOS-1402](https://linear.app/hospeda-beta/issue/HOS-1402)), fuera del grafo, después de `U1` y en paralelo con `V1`, `B1` y `U2`; 25 unidades; el PR `[NOSPEC:epic-ci]` antes de la rama (A, F, K) |
| Épica de billing | 14 | *«Lo que queda sin medir»*: las trece filas no bloquean *ni impiden terminar* con sus dos ramas y una prueba por rama (D) |
| Épica de billing | 14 | *«Cómo se comprueba»*: ~~34: 18~~ **35: 19** · 15 · 1, con `G19` de `V5` (H); `U2` y `U3` no suman |
| Épica de billing | 14 | párrafo nuevo: el gate por unidad (guards enchufados y rotos contra el job, e2e, `CI Pass`, fila `UNKNOWN`, `Done` al mergear, smoke sólo en `HOS-1352`) |
| Épica de billing | 14 | párrafo nuevo: el ensayo sobre una copia de producción con correos reescritos (C), las dos partes del smoke (B) y la aceptación del programa (E) |
| Épica de billing | 14 | pie: *«(FASES 6 y 7)»* |
| B5 | 10 | *«Depende de»*: `RC-8` no tiene que cerrar para declarar terminada B5 (D); pie; envoltorio duplicado limpio |
| B7 | 11 | *«Depende de»*: la pregunta abierta al owner sobre las filas `UNKNOWN`, reemplazada por la regla de D; *«Está lista cuando»*: `GR-2`, `PA-6` y `RC-8` con sus dos ramas y una prueba por rama; pie |
| B13 | 10 | sección *«El recorte del checklist de smoke manual»* reescrita como *«El checklist de smoke del sistema nuevo»*: dos partes, el paso 5c, `docs/billing/`, la regla del `CLAUDE.md` desde `U1`; el recorte, retirado (B, L); *«Está lista cuando»* cambia su última condición; pie; envoltorio duplicado limpio |
| B2 | 8 | sólo el envoltorio duplicado: texto idéntico |
| B3 | 9 | sólo el envoltorio duplicado: texto idéntico |
| B8 | 11 | sólo el envoltorio duplicado: texto idéntico |

Releídos después de publicar: los siete tienen un solo doctype, un solo `<html>` y un solo `<body>`.

**Sin cambios**: B1, B4, B6, B9, B10, B11 y B12. Ninguno nombra una cifra del programa ni el
recorte del checklist; B6 se apoya en `RF-3` y B11 en `EX-43` a `EX-47`, pero la fuente sólo ata
la regla de D a `GR-2`, `PA-6` y `RC-8` (`B/descomposicion.md` §2.7), y no se la extendí.

## 3. Linear

Cada una con la línea *«Actualizada el 30/09/2026 contra el diseño vigente (FASES 6 y 7, …)»*.
Sin tocar estado, prioridad, etiquetas ni relaciones.

| issue | cambio |
|---|---|
| HOS-1354 | bullet de B13: ~~el recorte del checklist de smoke~~, el checklist nuevo en dos partes |
| HOS-1354 | sección nueva *«Lo que sumaron las FASES 6 y 7»*: `U3` y 25 unidades, el PR `[NOSPEC:epic-ci]`, el gate por unidad con la fila `UNKNOWN`, el smoke de B13, el ensayo y la aceptación |
| HOS-1354 | guards del programa: ~~34: 18~~ **35: 19** · 15 · 1, con `G19`; ni `U2` ni `U3` suman |
| HOS-1354 | las dos condiciones de terminación: parte del gate por unidad, guards rotos contra el job |
| HOS-1354 | la matriz: las trece filas no impiden terminar (D) |
| HOS-1370 (B7) | el aviso de arriba: la pregunta al owner, tachada y contestada |
| HOS-1370 (B7) | filas de la matriz: *«no está escrito en ninguna decisión»* tachado; la regla de D con `GR-2`, `PA-6` y `RC-8` |
| HOS-1368 (B5) | filas `UNKNOWN`: `RC-8` no tiene que cerrar para terminar la unidad (D) |
| HOS-1376 (B13) | el recorte del checklist, tachado con su origen (L); párrafo nuevo del checklist en dos partes (B) |
| HOS-1376 (B13) | *Capítulos*: suma `16-` §4.7 |
| HOS-1376 (B13) | *«Está lista cuando»*: la condición del recorte, tachada; el checklist nuevo existe en sus dos partes |

**Sin cambios**: HOS-1364 (B1, releída: no nombra cifras del programa), HOS-1365 a HOS-1367,
HOS-1369 y HOS-1371 a HOS-1375.

## 4. Residuos vistos en la fuente (sin editar)

- `B/descomposicion.md` §2.7, encabezado: sigue en *«trece filas `UNKNOWN`»* con 14 en la matriz;
  la nota de F13 lo explica (`EX-49` es de verticales). No es un error, pero el número del título
  y el de la matriz no coinciden.
- `B/docs/20-testing.md` §5.1 punto 4: un tachado anidado dentro de una negrita
  (*«`B13` escribe~~, junto con ese recorte,~~ el checklist»*), que se lee bien pero rompe el
  patrón de tachar oraciones enteras.
- La regla D sólo nombra `GR-2`, `PA-6` y `RC-8`, y dice *«cualquier otra unidad que se apoye en
  una fila que el proveedor no deja fabricar»*. B6 (`RF-3`) y B11 (`EX-43` a `EX-47`) se apoyan
  en filas `UNKNOWN` y la fuente no dice si les vale; `EX-44`, `EX-45` y `EX-47` se miden antes
  de B11, así que la pregunta es sobre todo `RF-3` y `EX-43`.
- `HOS-1354` en Linear conserva la sección *«Lo que sumaron la revisión del owner, la FASE 9
  vuelta 3 y la FASE 5»* con su título; lo nuevo va en una sección aparte, no fundido.

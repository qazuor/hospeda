---
title: "FASES 6 y 7 · decisiones del owner"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 7
---

# FASES 6 y 7 · decisiones del owner

Respuestas del owner, 2026-09-30, al lote del §3 de
[`00-propuesta.md`](./00-propuesta.md). Todas son la recomendada. Con ellas el owner aprobó también
lo derivado del §2.3 de la propuesta.

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| A | cuándo se enciende el CI en la rama del paraguas | 1 | sí | un PR chico a `staging` (`[NOSPEC:epic-ci]`, cambios `C-1` a `C-8` y el guard de destino) antes de crear `epic/HOS-1352-verticales-billing` |
| B | el smoke manual del cobro nuevo | 1 | sí | checklist nuevo en dos partes (`staging` dentro del ensayo, producción después del paso 5 con la tarjeta del owner); lo escribe `B13` en `docs/billing/`; los tres checklists viejos se restauran en la rama de spec |
| C | sobre qué datos se ensaya el corte | 2 | sí | copia de producción restaurada en `staging`, correos reescritos a una casilla que no entrega, la lista real de las cinco; se borra al terminar |
| D | una fila `UNKNOWN` y la terminación de una unidad | 1 | sí | termina con las dos ramas escritas y una prueba por rama contra el falso; la batería sigue midiendo y la rama que no vale se borra |
| E | cuándo se acepta el programa después del corte | 2 | sí | primer cobro real de una cuenta suscripta después del corte y siete días de barrido sin divergencia sin explicar; si nadie se suscribe, se revisa a los 30 días |
| F | quién construye el script del corte | 1 | sí | unidad nueva del paraguas `U3`, sin dependencias de código; lista cuando corre entera contra la cuenta de pruebas; se mergea antes del ensayo; el programa pasa a **25 unidades** |
| G | el pase que le falta a la FASE 6 | 1 | sí | un agente aplica la plantilla de `DEC-METH-017` a las 29 piezas de los informes 01 y 02 y a los tres guards sin destino, en paralelo a `U1`; vuelve al owner sólo lo que sale `REWRITE` o cambia el alcance de una unidad |

## Lote del pase de la FASE 6 (H–J)

Respuestas del owner, 2026-09-30, a la sección «Vuelve al owner» de
[`20-pase-fase-6.md`](./20-pase-fase-6.md). Todas son la recomendada.

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| H | el actor de sistema (`AUT-005`) | 1 | sí | se reescribe en `V5`: rol `SYSTEM`, identificador por job, permisos explícitos, la fábrica rechaza las 25 acciones administrativas, las ~30 copias pasan a la fábrica y un guard nuevo falla ante un actor de sistema armado fuera de ella; la cadena también rechaza `_isSystemActor` en las 25 |
| I | los tres guards sin destino | 1 | sí | `U1` borra `check-product-domain-vocabulary` y `check-product-domain-raw-sql` (con sus entradas en `package.json` y `ci.yml`) y reescribe el texto de `check-no-binary-vertical-ternary`; `V1` lo retira cuando entra `G1`, con el caso de `HOS-1079` entre los que hacen fallar a `G1` |
| J | la columna `tier` de `partners` (`BD-018`) | 1 | sí | `V7` la borra con su índice en la misma migración que `starts_at`/`ends_at`, y sus lectores pasan a leer la clave |

## Lote de la aplicación (K–M)

Respuestas del owner, 2026-09-30, a «Vuelve al owner» de [`11-aplicacion.md`](./11-aplicacion.md).
Todas son la recomendada.

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| K | el orden de `U3` respecto de `U1` | 1 | sí | `U3` entra después de `U1`, en paralelo con `V1`, `B1` y `U2`; sólo tiene que estar mergeada antes del ensayo; `U1` sigue siendo el primer PR de la rama |
| L | el recorte del checklist viejo que hacía `B13` | 1 | sí | se retira por quedar sin sujeto: el checklist viejo vive en `staging` y gobierna al sistema viejo hasta el corte; el nuevo de `B13` lo reemplaza con el corte |
| M | 📌 en `DEC-CI-001` y `DEC-TEST-002` | 1 | sí | se les pone el 📌 por la precisión de `DEC-ARCH-016`; las precisadas sin `SUPERSEDED` pasan de 71 a 73 |

## Hecho en el acto

- **B**, la restauración: los tres checklists de `SPEC-143` volvieron a la rama de spec con el
  contenido de `origin/staging` (idéntico al de antes de `471a54b7a`), en su propio commit.

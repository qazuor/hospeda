---
title: "Congelamiento y CI del paraguas · decisiones del owner"
linear: HOS-1352
statusSource: linear
created: 2026-10-01
updated: 2026-10-01
status: CURRENT
fase: 10
---

# Congelamiento y CI del paraguas · decisiones del owner

Respuestas del owner, 2026-10-01. **N** y **O** son del congelamiento del sistema viejo (transitorio,
no del diseño del sistema nuevo); **P** y **Q** son del guard de destino de `epic/**`
(`DEC-ARCH-007` / `DEC-CI-001`). Todas son la recomendada.

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| N | el mecanismo del congelamiento de las altas pagas nuevas del sistema viejo | la recomendada | sí | un setting en `billing_settings`, editable desde el admin sin deploy |
| O | el alcance del congelamiento | la recomendada | sí | congela sólo las altas self-service (start-paid, incluidos los trials nuevos; el self-checkout de comercio; la compra de addons); quedan habilitadas las acciones del admin (provisionar comercio, link y pago manual de partner), el upgrade de quien ya paga, renovaciones, webhooks, dunning y cancelaciones; los trials que ya corren convierten solos (Mercado Pago cobra al vencer, sin pasar por la API) y no se frenan; se implementa sobre `staging` (no hotfix a `main`) y después se promueve `staging → main` entero, sin smoke previo — los PRs no-billing promovidos se smokean directo en `main` en los días siguientes, y el billing viejo no se smokea porque se reescribe entero |
| P | el guard de destino de `epic/**` (C-4 de `DEC-CI-001`) | la recomendada | sí | se acepta la condición corregida del snippet de `15-fase-9/01-R6-resuelto.md` §1 (que ponía en rojo todo PR a `staging` el día que nace la épica, bloqueaba el PR final del propio paraguas y dejaba pasar una rama de unidad cortada de un commit viejo de la épica): **falla si HEAD trae algún commit de la rama épica que el destino todavía no tiene**; el PR cuya head es la rama épica queda exento; si la rama épica no existe en el remoto, sale 0; si no puede consultar el remoto, falla; implementada en el PR #3436 (`scripts/check-umbrella-branch-target.sh`, con 12 tests) |
| Q | el fin de la rama `epic/HOS-1352-verticales-billing` | la recomendada | sí | se borra apenas se mergea a `staging`; si no, el guard de P bloquea la promoción `staging → main`, que trae los commits de la épica que `main` todavía no tiene |

## Estado de implementación

- **P**: el PR [#3436](https://github.com/qazuor/hospeda/pull/3436) (`[NOSPEC:epic-ci] ci: run ci on
  epic/** umbrella branches and guard their targets`, `chore/epic-ci` → `staging`) implementa el
  guard de destino corregido junto con los cambios `C-1` a `C-8` de `DEC-CI-001`. CI verde
  (`CI Pass` en `SUCCESS` sobre el rollup completo), todavía sin mergear.
- **N** y **O**: el PR del congelamiento está en curso.

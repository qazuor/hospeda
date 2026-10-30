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
| R | el trial de alojamiento que nace al publicar por primera vez (HOS-1012), que `start-paid` no cubre | la recomendada | sí | se congela también: con el setting prendido, un anfitrión sin trial ni suscripción no puede hacer su primera publicación (la ficha queda en borrador con aviso), y `/trial/reactivate` y `/trial/reactivate-subscription` responden el mismo 409; quien ya tiene trial o suscripción publica normal; las acciones del admin quedan exentas. Motivo: el corte (`DEC-MIG-007`) borra las fichas de todas las cuentas salvo cinco |
| S | agregar un comercio a un plan que el dueño ya paga | la recomendada | sí | queda libre: no crea suscripción ni cobro |
| T | el guard de P bloquea toda promoción `staging → main` mientras exista la rama épica | la recomendada | sí | el guard cuenta sólo los commits propios de la épica (los que no están en `staging`): falla si HEAD trae un commit de la épica que no está ni en el destino ni en `staging`; la rama épica recién creada se borró para promover #3447 y se recrea después del arreglo |

## Estado de implementación

- **P**: el PR [#3436](https://github.com/qazuor/hospeda/pull/3436) (`[NOSPEC:epic-ci] ci: run ci on
  epic/** umbrella branches and guard their targets`, `chore/epic-ci` → `staging`) implementa el
  guard de destino corregido junto con los cambios `C-1` a `C-8` de `DEC-CI-001`. CI verde
  (`CI Pass` en `SUCCESS` sobre el rollup completo), todavía sin mergear.
- **N**, **O**, **R** y **S**: PR [#3437](https://github.com/qazuor/hospeda/pull/3437)
  (`feat/freeze-paid-signups` → `staging`); R se está sumando. **Sin smoke de staging**, por
  decisión del owner (2026-10-01): el billing viejo se reescribe entero.

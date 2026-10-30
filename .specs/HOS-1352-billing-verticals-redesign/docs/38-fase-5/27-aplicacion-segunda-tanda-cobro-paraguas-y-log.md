---
title: "FASE 5 · segunda tanda del lote de la aplicación — cobro, paraguas y log"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 5
---

# FASE 5 · segunda tanda del lote de la aplicación: cobro, paraguas y log

Fuente: la última sección de [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md)
(«Lote de la aplicación, segunda tanda», letras M a P, todas la recomendada), con el contexto de
[`24-`](./24-aplicacion-lote-de-aplicacion-cobro.md) §5 (M) y
[`23-`](./23-aplicacion-lote-de-aplicacion-verticales.md) §5 (N, O y P). Origen escrito en cada
cambio: `(FASE 5, lote de la aplicación, segunda tanda, owner 2026-09-30, <letra>)`. Sin commits.

## 1. Archivos tocados

- `.specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md`
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md`
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md`
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md`
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md`
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md`
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md`
- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md`
- `.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md`

## 2. Qué se aplicó

### M · el barrido manda la devolución que el índice frenó

- `B/03:1851` («`RF2`») «la manda el barrido en su corrida siguiente, cuando ya no queda ninguna
  de esa orden esperando su id».
- `B/09:875` (§3) «Y el barrido manda la devolución de una orden que la base frenó» — párrafo nuevo
  tras el de las órdenes: mira las filas `CONFIRMED` sin llamada después de reenviar las llamadas
  sin respuesta, y la manda sólo si ninguna de la orden espera su id.
- `B/05:98` (§1.2) «La segunda, la que la».
- `B/desc:854` (criterio de `B11`, dueño del barrido) «y la devolución de una orden que la base
  frenó la manda el barrido en su corrida siguiente».
- El ⚠️ que apuntaba a la pregunta: el único vivo, en `B/03:1851`, ya lo había tachado la aplicación
  de J; `rg` sobre `$B` no encuentra otro ⚠️ vivo de esta pregunta.

### N · el alta directa no fija dueño

- `nucleo/08:195` «el alta directa de un Partner por el admin no fija dueño» — tachado *«, o el alta
  directa del admin con dueño»*.

### O · `V7` borra `starts_at` y `ends_at`

- `16-:716` (§4.6) «y las borra `V7` con su migración».
- `B/21:508` «y las borra `V7` con su migración».

### P · la tabla de paso, fuera del esquema de Drizzle

- `16-:137` (paso 3) «La tabla de paso vive sólo en el SQL de esta migración».
- `16-:144` (paso 5b) «La tabla vive sólo en el SQL de la migración del paso 3».

### Log

- `DEC-RF-008` (M): *Estado* y `01:6497` «segunda tanda, M;».
- `DEC-ENT-006` (N y O): *Estado* y `01:6641` «segunda tanda, N y».
- `DEC-MIG-003` (P; ahí vive la tabla de paso, y `DEC-MIG-006` remite a su 📌): *Estado* y
  `01:3112` «Precisado el 2026-09-30, con OK del owner».
- Resumen: «letras M a P, con OK del owner: caen» (precisadas, sigue en 71) y «Y la segunda tanda
  del lote de la aplicación» (fila FASE 5: 0 nuevas, 3 📌 sobre 3 decisiones).

### Mecánicos

- `B/desc:794` «~~**33**~~ **34** repartidos» y `B/desc:795` «~~**17**~~ **18** en la otra» y «es
  `G18`, de `V1`**, y por eso».
- `B/20:390` «~~**19**~~ **20** |» (entra `G18` a las filas de `V/20` §2), `B/20:391` «`G18`, de
  `V1`: el control», `B/20:392` «el 34 es `G18`, con su fila» y «y `G18` (`V1`».
- `$D/38-fase-5/25-` no se editó (histórico), aunque diga «19».

## 3. Lo que no se aplicó y por qué

- N, O y P no tienen menciones en `$B` salvo `B/21:508` (O). `12-contrato-de-cobertura.md` no nombra
  ninguna de las cuatro letras: no se tocó.

## 4. Para otro dueño

Nada.

## 5. Vuelve al owner

Nada.

## 6. Conteos

- Decisiones del log (`python3`, encabezados `### DEC-` fuera de bloques de código): **142**, 142
  distintas, 17 de metodología; la cabecera ya decía 142 = 125 + 17, sin cambio.
- Guards por la columna *guards* de las dos tablas de unidades (`python3`, ids sin tachar, sin
  menciones en prosa): verticales **18** (`V1` 4 con `G18`, `V3` 2, `V4` 4, `V5` 5, `V6` 3), cobro
  **15** (`B1` 7, `B2` 1, `B3` 4, `B7` 1, `B8` 1, `B10` 1), `U1` **1** (`G8`): **34**.
- Orígenes de esta tanda (`python3`, `segunda tanda, owner 2026-09-30, <letra>` con saltos de línea
  normalizados): **12** — M 5, N y O 1, N 1, O 2, P 3.
- `git diff --stat` sobre los nueve archivos: 48 inserciones, 18 borrados.
- `npx markdownlint-cli2` sobre los nueve archivos: **0** antes y **0** después; este registro: 0.

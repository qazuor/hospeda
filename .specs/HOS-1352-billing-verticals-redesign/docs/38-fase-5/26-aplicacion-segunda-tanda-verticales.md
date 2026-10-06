---
title: "FASE 5 · aplicación de la segunda tanda del lote de la aplicación — épica de verticales"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 5
---

# FASE 5 · segunda tanda del lote de la aplicación: épica de verticales

Fuente: [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md), *«Lote de la aplicación,
segunda tanda»* (letras M a P), con el contexto de
[`23-aplicacion-lote-de-aplicacion-verticales.md`](./23-aplicacion-lote-de-aplicacion-verticales.md)
§5, preguntas 1, 2 y 3. Letras de esta épica: N, O y P, más un arreglo mecánico de la cuenta de
guards. Origen escrito en cada cambio: `(FASE 5, lote de la aplicación, segunda tanda, owner
2026-09-30, <letra>)`. `$V` = `.specs/HOS-1353-verticales-capacidades-y-autorizacion`.

## 1. Archivos tocados

- `$V/descomposicion.md`
- `$V/docs/02-modelo-de-datos.md`
- `$V/docs/17-autorizacion.md`
- `$V/docs/18-partner.md`
- `$V/docs/20-testing.md`
- `$V/docs/21-migracion.md`

## 2. Qué se aplicó

### N · el alta directa del admin no fija dueño

- `$V/docs/02-modelo-de-datos.md:632` «el reclamo, que es el único que lo fija: el alta directa
  del admin»: tacha *«el reclamo, o el alta directa del admin con dueño»*.
- `$V/docs/02-modelo-de-datos.md:641` «tampoco el alta directa del admin, que no fija dueño y manda
  el aviso de reclamo»: en la restricción de `owner_user_id` de la fila `partner`.
- `$V/docs/02-modelo-de-datos.md:647` «y crea el `partner` con `owner_user_id` nulo, como la
  aprobación»: en el párrafo del camino B.
- `$V/docs/17-autorizacion.md:76` «el alta directa del admin no fija dueño: manda el aviso de
  reclamo»: paso 3 de la cadena, tacha la versión de F.
- `$V/docs/17-autorizacion.md:702` «el alta directa del admin no fija dueño: manda el aviso de
  reclamo, y el»: §4.1, tacha la versión de F.
- `$V/docs/18-partner.md:355` «El alta directa del admin (camino B) no fija dueño»: §2.5, tacha
  *«o el alta directa del admin con dueño (camino B)»*.
- `$V/descomposicion.md:60` «porque el alta directa del admin no fija dueño: manda el aviso de
  reclamo»: fila `V7` del §2.
- `$V/descomposicion.md:540` «porque el alta directa del admin no fija dueño y manda el aviso de
  reclamo»: fila del rol de socio, con su criterio (*«el alta directa del admin no asigna ningún
  rol ni escribe `owner_user_id`»*) y el origen *«segunda tanda, N»*.
- `$V/descomposicion.md:626` «y el alta directa del admin deja el Partner con `owner_user_id` nulo
  y sin rol asignado»: criterio de salida de `V7`.
- ⚠️ que apuntaran a esta pregunta: no quedaba ninguno vivo; el de `V/18` §2.5 ya estaba tachado
  por F.

### O · `V7` borra `starts_at` y `ends_at`

- `$V/docs/02-modelo-de-datos.md:627` «y `V7` las borra con su migración,»: con sus lectores del
  panel (el formulario, la tabla y la ficha de Partner del admin).
- `$V/docs/18-partner.md:144` «y `V7` las borra con su migración, junto con sus lectores del
  panel»: §1.6.
- `$V/descomposicion.md:60` «y la migración que borra `partners.starts_at` y `partners.ends_at`,
  con sus lectores del panel»: fila `V7`.
- `$V/descomposicion.md:626` «y después de `V7` no existen: ni la base ni ningún archivo del panel
  las nombra»: criterio de salida de `V7`.

Los lectores del panel, verificados en `origin/staging`: `PartnerForm.tsx`,
`partners.columns.tsx`, `partners.schemas.ts` y `routes/_authed/partners/$id.tsx` en
`apps/admin/src`. `PaymentReviewCard.tsx` también lee `startsAt`, pero sale con las columnas de
pago en `U1`.

### P · la tabla de paso vive fuera del esquema de Drizzle

- `$V/docs/21-migracion.md:348` «La tabla de paso vive sólo en el SQL de esa migración»: con que
  ni `G-R9` ni el control de drift la ven.
- `$V/docs/20-testing.md:72` «La tabla de paso del corte no entra en su recorrido»: nota en la fila
  de `G-R9`.
- `$V/descomposicion.md:59` «una tabla que vive sólo en el SQL de esa migración, fuera del esquema
  de Drizzle»: fila `V6` del §2.
- `$V/descomposicion.md:538` «sólo en el SQL de la migración del paso 3 y fuera del esquema de
  Drizzle»: fila del corte simplificado, con el origen *«segunda tanda, P»*.
- `$V/descomposicion.md:625` «y `packages/db/src/schemas/` no la declara, así que `G-R9` y el
  control de drift siguen verdes»: criterio de salida de `V6`.

### Arreglo mecánico · la cuenta de guards

- `$V/descomposicion.md:66` «dos de sus ~~tres~~ cuatro guards»: `V1` lleva `G1`, `G3`, `G14` y
  `G18`.
- `$V/descomposicion.md:584` «y entra `G18`, de `V1`, por el lote de la aplicación E: 34»: la
  cadena del paréntesis terminaba en 33 y la cifra de cabecera ya decía 34.

## 3. Lo que no se aplicó y por qué

- El paso 3 de la cadena (`V/17:76`) y el §4.1 (`V/17:702`) conservan *«el acto que fija al dueño
  de la presencia»*: con N ese acto es sólo el reclamo, y así quedó escrito.
- La cifra de cabecera de `V/desc` §5 (34 = 18 + 15 + 1) ya era correcta; sólo estaban mal la
  cuenta de `V1` en el §2.1 y la cadena del paréntesis.

## 4. Para otro dueño

Ninguno.

## 5. Vuelve al owner

Nada.

## 6. Conteos

```text
# guards por columna (python3 sobre la columna `guards` del §2, sin tachados ni cursivas)
V/desc: 18 → G1 G2 G3 G4 G5 G6 G13 G14 G18 G-R2 G-R2-B G-R3-B G-R3-C G-R4 G-R4-B G-R6 G-R6-B G-R9
B/desc: 15 → G7 G9 G10 G11 G12 G15 G16 G17 G-R1-A..F G-R2-C
paraguas: 1 (G8, en U1) → 34; sin ids repetidos entre unidades

# marcas de esta tanda (rg -c -F "segunda tanda" <archivo>)
descomposicion.md: 8 · 02: 4 · 17: 2 · 18: 2 · 20: 1 · 21: 1 → 18

# git diff --stat -- $V
6 files changed, 35 insertions(+), 23 deletions(-)

# markdownlint-cli2, desde la raíz del worktree, sobre los seis archivos
antes: 0 issues (según 23- §6) · después: 0 issues
```

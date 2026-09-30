---
title: "FASES 6 y 7 · publicación de los artifacts y las issues de la épica de verticales"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 7
---

# FASES 6 y 7 · publicación: la épica de verticales y sus fichas

Republicación de los artifacts de verticales y de sus descripciones en Linear después de las FASES 6
y 7 (commits `bfc6367909..0be493e57a`). Fuentes: [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md)
(lotes A–G, H–J y K–M), [`20-pase-fase-6.md`](./20-pase-fase-6.md),
[`11-aplicacion.md`](./11-aplicacion.md), [`21-verificacion.md`](./21-verificacion.md), el diff de
`$V` (`.specs/HOS-1353-verticales-capacidades-y-autorizacion`) y
[`16-fase-7-del-paraguas.md`](../16-fase-7-del-paraguas.md) §4.6 y §4.7.

Cifras recontadas con script antes de escribirlas: decisiones **144**
(`rg -o "^### DEC-[A-Z]+-\d+"` sobre `01-decision-log.md`, `sort -u`, `wc -l`); matriz
**117 = 63 · 16 · 24 · 14** (`contar-filas-de-la-matriz.py`); guards **35 = 19 · 15 · 1**, sobre la
columna `guards` de las dos tablas de unidades, sin lo tachado ni lo entre paréntesis en cursiva
(`V1` 4, `V3` 2, `V4` 4, `V5` **6**, `V6` 3; `B1` 7, `B2` 1, `B3` 4, `B7` 1, `B8` 1, `B10` 1; `G8`
en `U1`); unidades **25** (9 + 13 + `U1`, `U2`, `U3`); dependencias entre épicas **12** (la
verificación de `21-` las contó sobre `B/descomposicion.md` §2.6 y no cambiaron). `HOS-1402` (`U3`)
existe en Linear y es hija de `HOS-1352`.

Método: `read` sin `path` para habilitar la republicación, `read` con `path` para el archivo; se sacó
el envoltorio del servicio y se aplicaron los cambios con un script que exigía exactamente una
coincidencia por reemplazo. Publicadas con `url` y sin `icon`, y releídas con `read` + `path`: un
`<!doctype>`, un `<html>` y un `<body>` en cada una, y la marca *«(FASES 6 y 7)»* en todas menos
`V3`. En Linear, `save_issue` con `patch` anclado sobre un `get_issue` recién hecho, releído en la
respuesta; estado, prioridad, etiquetas y relaciones sin tocar; ningún timeout.

## 1. Artifacts republicados

### Épica — <https://claude.ai/artifact/UZzqK6P7ZyfAFuWrw5n4BP> (versión 11)

- Lede: el diseño cerrado después de las FASES 6 y 7, no de la FASE 5.
- Recuadro: *«la FASE 5 y el pase de la FASE 6 ya decidieron qué se reescribe»*; entra `U3`, el script
  del corte (`HOS-1402`), después de `U1` y en paralelo con `V1`.
- Sección nueva *«Lo que cambió el 30/09 (noche): las FASES 6 y 7»*: actor de sistema y `G19` (H);
  los ADAPT de `V5`; el guard del ternario que retira `V1` con el caso de `HOS-1079` (I);
  `partners.tier` en `V7` (J); el permiso único de la acción 13; la acción 24 con `accounts`; el gate
  por unidad y de la épica, con la regla D; el PR `[NOSPEC:epic-ci]`; 25 unidades y 35 guards.
- Sección de la FASE 5: *«pasa a 24 unidades»* → *«pasó a 24 (hoy 25, con `U3`)»*; *«pasan a 34»* →
  *«pasaron a 34 (hoy 35, con `G19`)»*.
- *«Cómo se comprueba»*: veinte → **veintiún** guards, diez → **once** con id propio (con `G19`),
  dieciocho → **diecinueve** acá, 34 → **35** (19 · 15 · 1); el guard cuenta enchufado en
  `pnpm check:guards` y en el job `guards`, roto contra el job.
- Tabla de unidades, fila `V5`: suma `G19`.
- Pie: *«(FASES 6 y 7)»*.

### V1 — <https://claude.ai/artifact/Xy46L4orTxa3MwSaNGgK6o> (versión 6)

- Sección nueva *«Con `G1` sale el guard del ternario»*: `V1` retira
  `check-no-binary-vertical-ternary.sh` en el PR de `G1`, con el caso de `HOS-1079` (I); y la prueba
  del trigger de `set_updated_at` (`BD-014`).
- *«Está lista cuando»*: los dos criterios nuevos.
- Pie: *«(FASES 6 y 7)»*. Queda *«Es el guard número 34 del programa»* sobre `G18`: es un ordinal y
  sigue siendo cierto.

### V3 — <https://claude.ai/artifact/N4tGbpDdCGUZB6zJUSH3t6> (versión 7)

- Sólo limpieza del envoltorio: se sacaron el `<!doctype>`, el `<html lang="es">`, el `<head>` y el
  `<body>` propios que venían dentro del esqueleto del servicio. El texto quedó idéntico (comparado
  sin etiquetas contra la versión anterior). El pie sigue en *«(FASE 9 vuelta 3)»*: las FASES 6 y 7
  no tocan `V3`.

### V5 — <https://claude.ai/artifact/KsjdENgkcaJaz49Qk9h1dX> (versión 10)

- Lede: suma el actor de sistema reescrito; cinco → **seis** guards, con `G19`.
- Subsección nueva *«El actor de sistema se reescribe, y `G19` lo vigila»* (H): fábrica única con
  `SYSTEM`, identificador por job, permisos explícitos, rechazo de las 25 acciones al construirse,
  las copias a la fábrica, `G19`, y la cadena que rechaza `_isSystemActor`.
- Subsección nueva *«Lo que el pase de la FASE 6 dejó para adaptar en la cadena»*: `AUT-003`,
  `AUT-004`, `AUT-010`, `AUT-027`.
- *«Está lista cuando»*: los criterios del actor de sistema, `G19` y `AUT-003`; *«cinco guards»* →
  *«seis»*.
- Pie: *«(FASES 6 y 7)»*.

### V6 — <https://claude.ai/artifact/Lqmv2r3Vt53ugG2iBKnJEY> (versión 11)

- *«La moderación en dos niveles»*: párrafo nuevo de la acción 13 con un solo permiso para la ficha y
  la presencia, que declara la primera de `V6` y `V7` (`AUT-113`).
- *«Está lista cuando»*: moderar una ficha pide el mismo permiso que la presencia, y ninguna ruta lee
  `ACCOMMODATION_MODERATION_CHANGE`.
- Pie: *«(FASES 6 y 7)»*.

### V7 — <https://claude.ai/artifact/G9qtHb2DN8upN9QzaE7ueb> (versión 8)

- Recuadro: en la misma migración que `starts_at`/`ends_at`, `tier` con su índice, y sus lectores
  pasan a leer la clave (J).
- Presencia: la acción 13 con permiso único (`AUT-113`); ninguna ruta de moderación lee
  `PARTNER_MANAGE`.
- Regla 5 del reclamo: la unicidad es un `UNIQUE` parcial que hoy falta (`BD-009`).
- *«Está lista cuando»*: `tier` inexistente, Gold que baja a Silver pierde su página, segunda fila con
  el mismo `owner_user_id` rechazada, y el permiso de moderar.
- Pie: *«(FASES 6 y 7)»*.

### V8 — <https://claude.ai/artifact/SqXumRq9YrBQpqiyoNTYGq> (versión 9)

- Acción 24: borra las filas de `accounts` en la misma transacción (`AUT-015`) y escribe la prueba del
  trigger de favoritos (`BD-013`).
- *«Está lista cuando»*: sin filas en `accounts` y sin favoritos, y sus pruebas lo afirman.
- Pie: *«(FASES 6 y 7)»*.

## 2. Artifacts sin cambios

- **V2** — <https://claude.ai/artifact/DhWZPJ72BxssRMYp2WTQ6R>: el diff de `$V` no toca su fila ni su
  criterio. Ninguna cifra vieja (sus *«ocho de las doce dependencias»* siguen valiendo).
- **V4** — <https://claude.ai/artifact/AfAufifn4m4qurfC4fKgYa>: sin cambios en su fila ni en su
  criterio; sus *«cuatro guards»* siguen siendo cuatro.
- **V9** — <https://claude.ai/artifact/5Nc7PT6fyh67GoL7Lfmwcd>: sin cambios. Su *«18, 9 de
  verticales»* son plazos, no guards.

## 3. Issues de Linear tocadas

Todas con una línea final *«Actualizada el 30/09/2026 contra el diseño vigente (FASES 6 y 7,
`.specs/HOS-1352-billing-verticals-redesign/docs/39-fases-6-y-7/`): …»*.

| issue | unidad | qué cambió |
|---|---|---|
| HOS-1353 | épica | recuadro (FASE 5 y pase de la FASE 6, `DEC-METH-017`/`-018`; `U3` con `HOS-1402`); sección nueva de las FASES 6 y 7; 24 → 25 unidades y 34 → 35 guards en la sección de la FASE 5; fila `V5` con `G19`; *«Cómo se comprueba»* 21 guards, once con id, 19 acá, 35; gate por unidad en las condiciones de terminación; matriz 16 → **14** `UNKNOWN` y *«las otras quince»* → *«trece»*, con la regla D y el PR `[NOSPEC:epic-ci]` |
| HOS-1355 | `V1` | *«Deja funcionando»* con el retiro del guard del ternario y `BD-014`; sección nueva *«Con `G1` sale el guard del ternario»*; dos criterios; gate por unidad |
| HOS-1359 | `V5` | *«Deja funcionando»* desde las FASES 6 y 7; `G19` en *«Guards que nacen acá»*; dos secciones nuevas (actor de sistema; ADAPT de la cadena); criterios de `G19` y `AUT-003`; cinco → seis guards; gate por unidad. Un segundo `patch` corrigió dos cursivas anidadas que Linear había roto alrededor de `SUPER_ADMIN` |
| HOS-1360 | `V6` | `AUT-113` en *«Deja funcionando»*, en la sección de moderación y en *«Está lista cuando»*; gate por unidad |
| HOS-1361 | `V7` | `tier` con su índice en el recuadro y en *«Deja funcionando»*; `BD-009` en la regla 5; `AUT-113` en la presencia; tres criterios; gate por unidad |
| HOS-1362 | `V8` | acción 24 con `accounts` (`AUT-015`) y la prueba de favoritos (`BD-013`); el criterio; gate por unidad |

## 4. Issues de Linear sin cambios

- **HOS-1356** (`V2`), **HOS-1357** (`V3`), **HOS-1358** (`V4`) y **HOS-1363** (`V9`): leídas; ninguna
  menciona 24 unidades, 34 guards, 142 decisiones ni una FASE pendiente, y las FASES 6 y 7 no les
  cambian el alcance. El residuo que el registro de la FASE 5 anotó en `HOS-1357` (*«queda el gate de
  la FASE 5»*) ya no está: hoy dice *«ya se cumplió el 30/09/2026»*.

## 5. Residuos vistos

El primero se corrigió porque estaba en una issue que esta tanda reescribía; los demás no se
editaron.

1. **HOS-1353 decía *«117 filas, 16 `UNKNOWN`»*** y *«las otras quince»*, desde antes de estas fases:
   la matriz tiene 14 `UNKNOWN` y 16 `PARTIALLY_SUPPORTED`. Se corrigió en la issue (es su propio
   texto, arriba); el registro de la FASE 5 lo había dado por coincidente.
2. **El gate por unidad quedó escrito en seis issues y no en las cuatro sin cambios** (`HOS-1356`,
   `HOS-1357`, `HOS-1358`, `HOS-1363`) ni en ninguna ficha `V*`: la épica lo dice una vez para las
   nueve, que es donde la descomposición lo pone (§4, remitido a `16-` §4.7).
3. **`$V/docs/20-testing.md:59`**, fila de `G18`: *«contarlo lleva el total del programa de 33 a 34»*.
   Es historia de esa fila y es cierta; no nombra el 35 de `G19`, que está en su propia fila.
4. **Ninguna ficha ni issue de verticales linkea la ficha de `U3`**, porque no hay: `U3` sólo tiene
   issue (`HOS-1402`). Si se publica una ficha, van links en el recuadro de la épica, en su sección de
   las FASES 6 y 7 y en `HOS-1353`.

---
title: Sub-spec 4 · Sección nightInfo (los tipos nuevos pasaron al sub-spec 2)
linear: HOS-1804 (hijo de HOS-1787)
statusSource: linear
created: 2026-10-25
status: draft
revised: 2026-10-25 (resolución de la vuelta 3)
---

# 4 · `nightInfo` (los tipos `PUB`/`BOLICHE` nacen en el sub-spec 2)

Decisiones: DEC-FAC-010 (preselección), 015, 018, 021, 031, 034, 036, 038, y de la vuelta 2: 040, 045, 050, 052,
058, y de la vuelta 3: 074 (lista de la acción 15). **Depende de 2 y 3** (F-V2-041): su criterio de aceptación es el 409 `SECTION_ABSENT` del paso 4b, que nace en
el 3.

## Tipos nuevos: se movieron

`PUB` y `BOLICHE` (enum TS, `ADD VALUE`, etiquetas, descripciones, `Record` exhaustivos) se agregan en el
**sub-spec 2** (DEC-FAC-045), porque la matriz tipo → rubros y G-FAC-02 regla 5 los necesitan. Queda acá, por ser
del mismo frente:
- **Listas planas que no fallan al compilar** (F-V1-038): `GASTRONOMY_TYPES` inline en
  `gastronomia/index.astro:177-187` (renombrado por el sub-spec 1), `DEFAULT_GASTRONOMY_TYPES` en
  `lib/listing-summary/summary.catalogs.ts:16` y el selector de tipo de la config consolidada del admin pasan a
  derivarse del enum (o del catálogo), con un test que compare contra `Object.values`.
- La regla de DEC-FAC-045 vale también acá: ninguna migración de este hijo usa `BOLICHE` ni `PUB` como valor del
  enum.

## Sección `nightInfo` (forma final, DEC-FAC-036, DEC-FAC-058)

Campos nuevos en `venues`, todos opcionales, todos en `fields` de la sección `nightInfo` (DEC-FAC-040):

| campo | tipo | nota |
|---|---|---|
| `entry_kind` | enum `free` / `paid` / `varies` | |
| `entry_note_i18n` | JSONB del patrón `*_i18n` de la vertical | texto corto (p. ej. «gratis hasta la 1»); se edita **dentro** de la sección `nightInfo`, no por la común `translations` (F-V2-006) |
| `entry_price_from` | integer (centavos) | precio «desde»; dinero en entero. CHECK `entry_price_from >= 0` y `entry_price_from IS NULL OR entry_kind = 'paid'` |
| `entry_price_updated_at` | fecha | la fija el servidor **sólo cuando el valor cambia** (un PATCH que reenvía el mismo precio no la mueve); se muestra «aprox., actualizado <mes>». Pasar de `paid` a otro valor borra precio y fecha. No se oculta un precio viejo: la fecha ya lo dice |
| `min_age` | smallint nullable | vacío = no informado (no `0`); Zod entre **13 y 30**; es la **menor** edad que aplica (si difiere por género o por noche, la diferencia va a la nota). Insignia «+N» con **texto legal fijo y traducido** (Ley 24.788; textos aprobados en DEC-FAC-068, tabla del sub-spec 6). La sugerencia de 18 para BOLICHE sale de `typeRules.BOLICHE.fieldDefaults` del catálogo (DEC-FAC-050), no de un `if` de tipo |
| `dress_code` | enum `casual` / `smart_casual` / `elegant` / `no_restrictions` | lista cerrada: la etiqueta se traduce sola. Etiquetas aprobadas (DEC-FAC-068): es «Informal (sin ojotas ni musculosa)» · «Sport elegante» · «Elegante» · «Sin restricciones»; en «Casual» · «Smart casual» · «Formal» · «No dress code»; pt «Casual» · «Esporte fino» · «Social» · «Sem restrições» |
| `dress_code_note_i18n` | JSONB `*_i18n`, opcional | ídem `entry_note_i18n` |

- **Horario**: se usa el **horario único** de la ficha. Limitación escrita: no se modelan noches distintas con
  horarios propios (un boliche que abre sólo viernes y sábado lo expresa con turnos en esos días).
- **«Abierto ahora» con turnos nocturnos** (DEC-FAC-052, F-V2-014): el cálculo de `gastronomy-hours.ts` (→
  `venue-hours.ts`) evalúa hoy el turno que envuelve la medianoche contra la entrada de **hoy**, con un docblock que
  lo justifica por un supuesto que la noche rompe («every real overnight schedule … repeats across consecutive
  days», `:102-107`). Pasa a: un turno pertenece al día en que **empieza**; está abierto si el turno de hoy contiene
  `now` (`[open, 24:00)` cuando envuelve) **o** si el turno de ayer envuelve y `now < close`. Test con viernes y
  sábado 23:30–06:00: sábado 03:00 abierto, domingo 03:00 abierto, viernes 03:00 cerrado. Prod no tiene datos de la
  vertical que el cambio altere (DEC-FAC-027). Cómo se muestra el badge en páginas cacheadas: sub-spec 6.
- **Presentación** (DEC-FAC-050, F-V2-026): `nightInfo` declara `headingWhenMultiLineKey` («De noche»); el
  componente lo usa cuando el resolvedor devuelve `multiLine: true` (más de un rubro con secciones propias en estado
  ≠ `absent`). Nunca compara rubros. Un resto-bar básico (carta `locked`) conserva el título.
- Sección no común, del rubro `nightlife`; sin clave de entitlement (gratis en todos los planes); grupo `property`
  (sub-spec 2). Slug y `labelKey` del editor se fijan en la tarea, en el `Record` de presentación del web.
- Escritura del dueño por el PATCH de la ficha: la sección se detecta con `sectionsTouchedByBody` (campos no nulos)
  y se evalúa sobre los rubros resultantes del pedido (sub-spec 3, DEC-FAC-021).
- Entra al contexto del chat de IA (con las reglas duras de edad de DEC-FAC-053) y al JSON-LD sólo cuando está
  `available` (sub-specs 3 y 6).
- Schemas Zod en `@repo/schemas`; validación en servidor de las reglas de arriba.

## En `PURGED` (F-V1-017, F-V2-023)

Los campos de `nightInfo` son contenido del dueño: PB9/PB12 los borran junto con el resto del contenido de la ficha
(coordinado con V6/V9 de HOS-1352), incluidas `entry_note_i18n` y `dress_code_note_i18n`. Viven en la fila de
`venues`, así que no agregan filas a G-R9; lo que garantiza que entren al `SET` del purge
(`listing-purge.model.ts:84-99`) es el guard nuevo **G-FAC-10** (toda columna de una tabla de ficha está en el
`SET` del purge o en la lista cerrada de columnas de sistema/clasificación).

**Acción 15** (DEC-FAC-074, F-V3-007): las siete columnas de `nightInfo` entran también a
`LISTING_SUPPORT_EDIT_CONTENT_FIELDS` (`packages/service-core/src/services/listing/listing-support-edit.ts:141-183`),
la copia a mano del purge que decide qué puede escribir soporte; G-FAC-10 compara las dos listas. `entry_price_updated_at`
la fija el servidor, pero es contenido (se borra con el purge) y está en ambas.

## Criterio de aceptación

- **AC:4:1** — Migraciones aplicadas desde cero con todas las pendientes juntas.
- **AC:4:2** — Tipos visibles en alta, filtros y chips (listas derivadas, con su test).
- **AC:4:3** — `nightInfo` editable sólo en fichas con rubro `nightlife`: en las demás, 409 `SECTION_ABSENT` al
  dueño; 404 a un tercero.
- **AC:4:4** — `nightInfo` renderizada en la ficha pública sólo cuando está `available`, con «De noche» cuando
  `multiLine`.
- **AC:4:5** — La insignia «+N» muestra el texto legal fijo; `min_age` vacío no muestra nada.
- **AC:4:6** — `min_age` 12 o 31 → 400.
- **AC:4:7** — Reenviar el mismo precio no mueve `entry_price_updated_at`; pasar a `free` borra el precio.
- **AC:4:8** — «Abierto ahora» con el calendario viernes/sábado de arriba.
- **AC:4:9** — PB9/PB12 borran `nightInfo`; G-FAC-10 en verde con su mutación.
- **AC:4:10** — Soporte (acción 15) edita la nota de entrada de un boliche ajeno y el cambio se aplica y queda registrado.

---
title: "FASE 5 · 14 · Aplicación — capítulos de la épica de verticales"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 5
---

# FASE 5 · 14 · Aplicación en los capítulos de la épica de verticales

Aplicación de [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md) y de
[`20-simplificacion-del-corte.md`](./20-simplificacion-del-corte.md) en los capítulos de
`HOS-1353` que no son la migración. Siglas: `V/NN` = `HOS-1353-…/docs/NN-*.md`. Todo lo que cambia
está tachado al lado de lo nuevo, o es un párrafo nuevo, con su origen entre paréntesis
(`FASE 5, owner 2026-09-30, lote N X` o `FASE 5, simplificación del corte, S-NN`). Las líneas son
las del worktree al terminar esta aplicación.

## 1. Archivos tocados

- `V/02-modelo-de-datos.md`
- `V/03-maquinas-de-estado.md`
- `V/17-autorizacion.md`
- `V/18-partner.md`
- `V/19-superficies.md`
- `V/20-testing.md`

Revisados y **sin cambios**: `V/10-verticales-planes-billing-options.md`, `V/11-trial.md`,
`V/15-entitlements-y-limits.md`, `V/22-lo-legal.md` (§3).

## 2. Qué se aplicó

### Lote 1

**A · gates de entitlement fuera de las rutas (`R5-01`)**

- `V/17:272` «En la rama, entre la limpieza del principio y esta resolución, las rutas de las verticales no» — `U1` los saca, deja permiso y propiedad, y `V5` agrega el paso de cobertura con su criterio de salida.

**C · migraciones de datos del seed (`R5-03`)** — fuera del foco, pero `G8` citaba las 11 congeladas:

- `V/20:56` «menos las que usan el cobro viejo, que `U1` saca de la rama»

**D · partners-pago y sus crons (`R5-04`)**

- `V/18:138` «Lo que hoy archiva la presencia sale con el cobro viejo» — columnas de pago, FK, los tres crons (`partner-expiry`, `partner-unpaid-reaper`, `partner-payment-review`), y la lectura pública sin presencia visible hasta `V7`.
- `V/02:621` «pago y sus FK a tablas del cobro viejo»

**E y F · columnas del cobro en tablas que sobreviven, y destaque (`R5-05`, `R5-06`)**

- `V/02:473` «Lo que la limpieza del principio les saca antes a esas tablas y a `users`» — lista cerrada: `is_featured` y `featured_by_entitlement` en las tres tablas, `experiences.has_active_subscription`, `users.service_suspended` y `owner_promotions.plan_restricted`; *«Ninguna ficha nace destacada»*.
- `V/19:108` «La home no tiene destacados hasta que exista el complemento de destaque»

**G · `archive-abandoned-drafts` (`R5-07`)**

- `V/17:694` «Y el proceso de hoy que archiva borradores y revoca un rol sale»
- `V/17:752` «El guard sigue mirando esas dos máquinas y no la de la ficha» — el complemento 3 no se eligió.
- `V/03:491` «no es esta fila: lo borra `U1`» — en la nota de `PB5`.

**H · `G8` y los extras (`R5-08`)** — la línea de `V/20`:

- `V/20:56` «sin el carril de extras (`packages/db/src/migrations/extras/**`)»

**I · enums recreados (`R5-09`, contra la recomendación)**

- `V/17:733` «Y los permisos del cobro viejo salen de la base, no sólo del código»

**J · las fichas de las demás cuentas se borran en el corte** (va junto con S-01/S-02, abajo).

### Lote 3

**A · el estado nuevo reemplaza a las tres columnas; cada fila de §9 dice si revalida (`R5-15`)**

- `V/02:451` «que reemplaza a `lifecycle_state`, `visibility` y `moderation_state`»
- `V/03:526` «Qué filas revalidan» — el criterio (revalida la fila que llega a `PUBLISHED` o sale de ahí, por la precisión 7 de `V/17` §1.2), después del commit, y `V6` migra lectores y disparadores.
- Las trece filas, una por una:
  - `V/03:487` (`PB1`), `V/03:489` (`PB3`), `V/03:493` (`PB7`) «Revalida: sí**, llega a `PUBLISHED`»
  - `V/03:488` (`PB2`), `V/03:492` (`PB6`) «Revalida: sí**, sale de `PUBLISHED`»
  - `V/03:490` (`PB4`) «Revalida: sí cuando sale de `PUBLISHED`**; desde `UNPUBLISHED_BY_BILLING`, no»
  - `V/03:491` (`PB5`) «Revalida: no**, `DRAFT` no es público»
  - `V/03:494` (`PB8`) «Revalida: no**, ni `ARCHIVED` ni `DRAFT` son públicos»
  - `V/03:495` (`PB9`) «Revalida: no**, sale de `ARCHIVED`, que ya no se veía»
  - `V/03:496` (`PB10`) «Revalida: sí cuando sale de `PUBLISHED`**; desde los otros tres, no»
  - `V/03:497` (`PB11`) «Revalida: no**, ni `MODERATED` ni `DRAFT` son públicos»
  - `V/03:498` (`PB12`) «Revalida: sí cuando sale de `PUBLISHED`**; desde los otros cuatro, no»
  - `V/03:499` (`PB13`) «Revalida: no por sí misma»

**B · los lectores de las tres columnas que sobreviven, y el texto *«sólo las usa el cobro viejo»* (`R5-16`)**

- `V/02:467` «siguen vivas hasta la migración estructural de `V6`» — y la razón `L5`/`L7` sale (S-09).
- `V/02:469` «retira esos lectores en el mismo cambio que la migración que las borra»
- La frase *«sólo las usa el cobro viejo»* no está en mis archivos (está en `16-` §4.6 y `V/21`); en `V/02` se corrige su gemela, la razón *«columnas de `L5` y `L7`»* (arriba), y se dice que era falsa.

**C · se retiran las puertas de borrado y restauración (`R5-17`)**

- `V/03:539` «Ninguna otra puerta borra ni restaura una ficha» — dueño en **`PB12`**, equipo en la acción 23 (a pedido y con motivo, que corre `PB12`), sin borrado físico.
- `V/02:795` «Las puertas de borrado de hoy, fuera de `PB9` y `PB12`, se retiran todas»
- `V/02:778` «Tampoco la escribe el borrado del dueño de hoy» — en la fila de favoritos, que remite a las puertas.
- `V/02:442` «Y el borrado físico de cuentas que el panel tiene hoy desaparece»
- **`PB9` → `PB12`**: `10-decisiones-del-owner.md` dice *«el borrado del dueño pasa a `PB9`»*. Apliqué `PB12` desde el principio, porque la opción elegida (`R5-17`, opción 1) dice *«pasa a ser el del diseño»* y ése es `PB12` (su fila en `V/03` §9); el coordinador lo confirmó después como error de transcripción. En ningún archivo quedó escrito `PB9` en ese sentido.

### Lotes 4 a 6

**A · postulación propia de Partner (`R5-23`)**

- `V/18:213` «Es una entidad propia, no la lista de postulaciones de hoy»
- `V/02:617` «es una tabla nueva, sólo de Partner; no es `alliance_leads`»
- `V/19:90` «Lee `postulacion`, no la lista de `alliance_leads` que el panel tiene hoy»

**B · rol de socio (`R5-24`, contra la recomendación)**

- `V/17:76` «En Partner también: la familia es la del rol de socio» — en la fila del paso 3.
- `V/17:690` «Tampoco el rol de socio» — no se quita al perder la presencia.
- `V/18:347` «Y aprobar asigna el rol de socio»
- `V/18:351` «A qué cuenta se asigna no está decidido» — ver §5, punto 1.

**C · impersonación (`R5-25`)**

- `V/17:473` «Y la impersonación que el código de hoy tiene apagada sale entera» — `impersonate`, `set-role`, el botón, `USER_IMPERSONATE` y HOS-354.

**D · `404` a una ficha ajena `RESTRICTED` (`R5-26`)**

- `V/17:204` «La excepción VIP del contrato de errores de hoy sale»

**E · `trial` y las tablas de sólo agregar sin `deleted_at` (`R5-29`)**

- `V/02:987` «Y `trial` nace sin `deleted_at`, y las tablas de sólo agregar también»

**G · las siete frases (`R5-28`)** — tres son de mis archivos:

- `BD-007`: `V/02:451` «dueño, en la columna `owner_id` que las tres tablas ya tienen»; `V/02:307` «es el nombre lógico de la tabla `users` del código».
- `BD-011`: `V/02:788` «29 con FK y 9 con `entity_type`»; `V/20:71` «29 con FK y 9 con `entity_type` (FASE 5».
- `AUT-016`, sólo la razón: `V/17:51` «ninguna transición ni acción del diseño lo escribe. Columna sí tiene» — `banned`, `ban_reason` y `ban_expires` se conservan.

### Simplificación del corte (`L1`–`L8`)

- **S-01** (la tabla de traducción sale) y **S-02** (nacen las cinco, se borra el resto):
  - `V/02:451` «y, si es la única ficha de una de las cinco cuentas de la lista cerrada del owner»
  - `V/02:465` «la migración carga una lista» (la tabla de traducción salió, con S-09)
  - `V/02:778` «y la tabla de traducción del corte, que la leía para `L1`, salió»
  - `V/03:248` «las fichas que no son de las cinco cuentas de la lista»
  - `V/03:487` «salió con la simplificación del corte, S-02» (nota de `PB1`: sale *«o en `DRAFT`»*)
  - `V/03:517` «La ficha que ya existía el día del corte y es la única de una de las cinco»
  - `V/03:524` «Y ese borrado no es `PB12` ni `PB9`»
  - `V/19:70` «toda otra cuenta, cuyas fichas se borraron en el corte»
- **S-08** (una ficha por cuenta): `V/03:998` «desempate entre fichas del corte de un mismo dueño no tiene población» — nota; la regla queda.
- **S-09** (las tres columnas sobreviven por sus lectores, no por `L5`/`L7`): `V/02:467` (arriba).
- **S-12** (la prueba activa, a las cinco, por el script del corte): `V/02:314` «que escribe el script del corte con la función de la aplicación, después de la migración» y «toda cuenta que no es de las cinco»; `V/03:376` «cada una de las cinco cuentas de la lista cerrada, y la escribe el script del».

## 3. Lo que no se aplicó y por qué

- **`L1`–`L8` en `V/15`**: no hay. Las dos apariciones de *«corte»* en `V/15` son el corte del pliegue en dos tramos (`V/15:196`), no el corte del sistema; las de `L2-e`/`L2-f*` son letras de la revisión del owner del 2026-09-28.
- **Detector en `V/17`**: no hay detector del corte. Las dos apariciones (`V/17` §3.2 regla 5 y *«lo que este capítulo NO cierra»*) son el resumen de `DEC-OBS-001` que lista las acciones que mueven plata con actor y sujeto: es producto, no se toca. El detector del titular (S-38, S-42) vive en `16-` y `B/21`.
- **S-14** (escritura `C`) y **S-35** (lista de proveedores del seudónimo, `V/02` §2.2): MANTENER, sin cambios.
- **Lote 1 B** (la bitácora de correos), **lote 2** entero y **lote 5** (`B6`): ninguna línea de mis archivos los nombra.
- **Lote 3 D, E, F** (plazos antes del merge de `V6`, crons apagados en el paso 3, los tres actos del paso 3): no aparecen en mis archivos.
- **Lote 6 G, las otras cuatro frases** (`BD-025`, `BD-028`, `SUP-013`, `API-011`): son de `16-`, `V/21` y del inventario `F-1B-014`, no de mis archivos.
- **`V/10`, `V/11`, `V/22`**: ninguna decisión les cambia una línea. `V/22` habla de *«borrado de la cuenta»* como seudonimización, que ya coincide con el lote 3 C.

## 4. Para otro dueño

1. **`$D/38-fase-5/10-decisiones-del-owner.md:77`** (lote 3 C): *«el borrado del dueño pasa a `PB9`»* → *«el borrado del dueño pasa a `PB12`»* (lo confirmó el coordinador).
2. **`V/descomposicion.md`**:
   - fila `V5`: sumar el criterio de salida *«ninguna ruta de escritura de vertical sin el paso de cobertura»* (lote 1 A); sacar `impersonate`, `set-role`, el botón y `USER_IMPERSONATE` (lote 4 C); pasar a `404` la sección VIP de `apps/api/docs/error-contract.md` y su test (lote 4 D).
   - fila `V6`: migrar lectores y disparadores de revalidación al estado nuevo; retirar los lectores de `billing_unpublished_at`, `owner_suspended` y `plan_restricted` en el cambio de la migración que las borra (lote 3 A, B); retirar las rutas `accommodation/protected/softDelete.ts` y `{accommodation,gastronomy,experience}/admin/{delete,hardDelete,restore}.ts` (lote 3 C).
   - fila `V7`: la tabla `postulacion` propia y el rol de socio con su familia, permisos, migración de datos y asignación (lote 4 A, B).
   - fila `V4`: `trial` sin `deleted_at` (lote 4 E).
   - fila `V8` (o la que tenga la acción 24): retirar `user/admin/hardDelete.ts` (`USER_HARD_DELETE`) (lote 3 C).
3. **`16-fase-7-del-paraguas.md` §4.6** (alcance de `U1`): las columnas de pago de `partners` con sus FK y los tres crons; la lista cerrada del lote 1 E; `is_featured` y `featured_by_entitlement` en las tres tablas; `archive-abandoned-drafts`; la recreación de los enums con la migración de datos de roles y overrides. Y la razón *«sólo las usa el cobro viejo»* / *«para `L5` y `L7`»* (lote 3 B, S-09).
4. **`V/21-migracion.md` §2.4**: la tabla de traducción sale (S-01), y la frase *«que sólo lee la tabla de traducción del corte (`L1`)»* de `V/02` §4.1 ya no tiene contraparte.
5. **`B/21-migracion.md` §4**: *«como `featured_by_entitlement` y `is_featured`»* pasa de ejemplo a lista cerrada (lote 1 E y F).
6. **Linear, HOS-354**: cerrarla o reescribirla como el *«entrar como»* de una versión posterior (lote 4 C). Lo decide quien opere Linear.

## 5. Vuelve al owner

### 1 · A qué cuenta se le asigna el rol de socio

La decisión dice *«asignado al aprobar la postulación»*. Pero **aprobar no conoce la cuenta del
dueño**: `owner_user_id` es nulo hasta el reclamo, y el reclamo vincula a la cuenta **que reclama
con sesión**, no a la que tiene el correo (`V/18` §2.4, reglas 1 y 2). Y el camino B (alta directa
del admin) no aprueba ninguna postulación.

*Ejemplo*: Juan postula a `juan@almacen.com`. Hay una cuenta vieja con ese correo que creó otra
persona. El admin aprueba. Si el rol se asigna al aprobar, lo recibe la cuenta vieja; Juan
reclama desde su cuenta y queda dueño del Partner, sin el rol, y el paso 3 le contesta *«sin
permiso»*.

1. **Asignarlo en el acto que escribe `owner_user_id`**: el reclamo (camino A) y el alta directa
   con dueño (camino B). Costo: una línea en `V/18` §2.4 y en `V/17`; el texto *«al aprobar»* se
   lee como *«al quedar dueño de un Partner aprobado»*. Riesgo bajo: el rol llega siempre a la
   cuenta que controla el Partner. **Recomendada**.
2. **Asignarlo al aprobar sólo si el correo ya es de una cuenta, y en el reclamo en la otra
   rama.** Costo parecido. Riesgo: el caso del ejemplo; la regla 1 de `V/18` §2.4 existe
   justamente para no vincular por tener la dirección.
3. **Al aprobar, a la cuenta del correo, como dice la letra.** Costo cero. Riesgo alto: contradice
   *«nada se vincula hasta que la dirección se prueba»* y deja sin rol al dueño real.

### 2 · El criterio de qué filas de §9 revalidan

El lote 3 A pide que cada fila diga si revalida, sin dar el criterio. Apliqué el que se deriva de
`V/17` §1.2 precisión 7 (sólo `PUBLISHED` se ve desde afuera): revalida la fila que llega a
`PUBLISHED` o sale de ahí. Así **`PB9` no revalida**, y `F5-SUP-020` la listaba entre las que sí.

*Ejemplo*: la ficha de Juan se archivó a los 90 días (`PB4` revalidó y la página desapareció). A
los 180 se purga (`PB9`); no hay página pública que refrescar.

1. **Lo aplicado: sólo las que entran o salen de `PUBLISHED`.** Costo: ninguno más. Riesgo bajo:
   si algún día otro estado se vuelve público, la precisión 7 y esta regla cambian juntas.
   **Recomendada**.
2. **Toda fila revalida.** Costo: purgas del borde sin efecto (`PB5`, `PB8`, `PB9`, `PB11`) contra
   el tope de purgas. Riesgo: ninguno de producto.
3. **La 1, más `PB9`**, como listaba `F5-SUP-020`. Costo: una purga por ficha purgada. Riesgo:
   ninguno; es redundante.

### 3 · La lista cerrada de las columnas de pago de `partners`

El lote 1 D dice *«las columnas de pago de `partners`»* sin lista. En `origin/staging`
(`partner.dbschema.ts`) hay seis que sólo sirven al cobro viejo o a sus tres crons y dos de
vigencia que leen los crons y el panel. Escribí *«entre ellas `subscription_status`, `plan_id` y
`subscription_id`»* en `V/18` y `V/02`, sin cerrar la lista.

*Ejemplo*: Juan es socio Gold. Si `ends_at` queda y nadie la escribe, el panel le muestra una
fecha de fin que ya no significa nada.

1. **Las seis**: `subscription_status`, `plan_id`, `subscription_id`, `unpaid_notice_sent_at`,
   `payment_review_state` y `payment_confirmed_through`; `starts_at`, `ends_at` y
   `lifecycle_state` quedan hasta `V7`. Costo bajo. Riesgo: dos columnas de vigencia sin escritor
   entre `U1` y `V7` (cero filas hoy). **Recomendada**.
2. **Las seis y también `starts_at` y `ends_at`.** Costo: el panel de partners pierde esas dos
   fechas. Riesgo bajo.
3. **Que `U1` la cierre al implementar.** Riesgo: lo que el lote N-A rechazó (*«100 % seguros»*).

## 6. Conteos

```text
# marcas de origen de la FASE 5 por archivo (0 antes en los diez)
rg -o 'FASE 5' .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/<archivo>.md | wc -l
  02: 15 · 03: 20 · 17: 9 · 18: 3 · 19: 3 · 20: 3 → 53
  10, 11, 15, 22: 0

# filas de V/03 §9 con su revalidación: 13 de 13
rg -c 'Revalida:' .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md  → 13
rg -c '^\| \*{0,2}PB[0-9]+' (misma ruta)                                                               → 13

# diff
git diff --stat -- <los seis>  → 6 files changed, 188 insertions(+), 34 deletions(-)

# markdownlint-cli2 (desde la raíz del worktree), sobre los seis tocados
antes (HEAD, copiados al scratchpad con la misma config): 0 issues
después: 0 issues
```

Las citas de §2 se verificaron con `rg -n -F` sobre cada archivo.

---
title: "FASE 5 · aplicación del lote de la aplicación — épica de verticales"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 5
---

# FASE 5 · aplicación del lote de la aplicación: épica de verticales

Fuente: [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md), *«Lote de la aplicación»*
(letras A a L), con el contexto de [`21-cruces.md`](./21-cruces.md) §5. Letras de esta épica: A,
B, D, E, F, G, H y L. Origen escrito en cada cambio: `(FASE 5, lote de la aplicación, owner
2026-09-30, <letra>)`. `$V` = `.specs/HOS-1353-verticales-capacidades-y-autorizacion`.

## 1. Archivos tocados

- `$V/spec.md`
- `$V/descomposicion.md`
- `$V/docs/02-modelo-de-datos.md`
- `$V/docs/03-maquinas-de-estado.md`
- `$V/docs/17-autorizacion.md`
- `$V/docs/18-partner.md`
- `$V/docs/20-testing.md`
- `$V/docs/21-migracion.md`

## 2. Qué se aplicó

### A · el bloqueo de toda escritura queda hasta el reintento (contra la recomendación)

- `$V/docs/21-migracion.md:96` «queda puesta hasta el reintento»: en el resumen de §2.4, junto a
  la rama de aborto, con la opción recomendada nombrada.

### B · la herramienta del corte de `V6` escribe las cinco pruebas

- `$V/spec.md:439` «el script suelto del»: §4.3, la herramienta de `V6` reemplaza al script.
- `$V/docs/21-migracion.md:100` «la herramienta del corte de `V6`, que es del sistema nuevo»
  (resumen de §2.4).
- `$V/docs/21-migracion.md:184` «la herramienta del corte de `V6`, después de la migración del paso 3»
  (las dos cuentas de cortesía).
- `$V/docs/21-migracion.md:491` «La herramienta del corte de `V6`, después de la migración estructural»
  y `:495` «la herramienta de `V6`, del sistema nuevo, como las del 4c» (*«la prueba gratis que
  escribe el corte»*).
- `$V/docs/21-migracion.md:507` «en la herramienta del corte de `V6` (FASE 5», `:518` «la herramienta
  dos veces no escribe dos», `:523` «herramienta del corte de `V6` (FASE 5, lote de la aplicación,
  owner 2026-09-30, B)—», `:543` «la herramienta del corte de `V6` escribe y se verifican».
- `$V/docs/02-modelo-de-datos.md:314` «la herramienta del corte de `V6`, del sistema nuevo» (fila
  `trial`).
- `$V/docs/03-maquinas-de-estado.md:377` «la herramienta del corte de `V6` con la función».
- `$V/descomposicion.md:59` (fila `V6` del §2) «el script suelto del corte sigue sin importar
  código»; `:478` «correr ~~el script~~ la herramienta dos veces»; `:514` «escribe después cada
  prueba»; `:538` fila del corte simplificado; `:625` criterio de `V6` «les escribe a sus dueños la
  prueba».

### D · la tabla de paso del 5b

- `$V/docs/21-migracion.md:104` «que los lee de la tabla de paso que la migración llenó antes de
  borrarlas» (resumen de §2.4).
- `$V/docs/21-migracion.md:343` «De dónde lo lee el 5b: de una tabla de paso»: tacha el ⚠️ que lo
  mandaba al owner. Con la corrección del coordinador: `:350` «no la contiene» (el backup del 2b es
  anterior al paso 3; el aborto restaura las fichas sin la tabla y la migración del reintento la
  vuelve a llenar). No se escribió «el backup la incluye» en ningún archivo.
- `$V/descomposicion.md:59` «leídos de esa tabla de paso» (fila `V6` del §2); `:538` «la tabla de
  paso que la migración llena antes de borrar»; `:625` «y antes de borrar, la migración del paso 3
  deja en la tabla de paso».

### E · la tabla de claves como SQL generado, y `G18`

- `$V/docs/20-testing.md:59` «| **G18** ✚ |»: fila nueva del catálogo de guards. Id: `G18`, el
  siguiente libre de la numeración `G` (`G1`–`G8` y `G13`, `G14` son de esta épica; `G10`–`G12` y
  `G15`–`G17` de la de billing; medido con `rg -o` sobre las tres specs).
- `$V/docs/20-testing.md:52` «que vigila `G18`» (fila `G3`).
- `$V/spec.md:66` «**veinte guards**»; `:390` «Diez guards con id propio»; `:409` «| `G18` ✚ |».
- `$V/descomposicion.md:54` «**`G18`** *(el SQL generado» (columna de guards de `V1`) y «que viaja
  en la migración como SQL generado por el mismo script» (qué deja funcionando `V1`); `:620` «y la
  tabla de claves llega a la base como SQL generado» (criterio de `V1`); `:487` «ese guard es
  `G18`» (fila del catálogo, `V2`); `:583` «~~33~~ 34 guards» y «~~**17**~~ **18** en esta épica».

### F · el rol de socio, en el acto que fija al dueño

- `$V/docs/18-partner.md:350` «el rol de socio se da en el acto que fija al dueño»: tacha el ⚠️ que
  lo mandaba al owner.
- `$V/docs/17-autorizacion.md:76` y `:700` «en el acto que fija al dueño de la presencia —el
  reclamo».
- `$V/docs/02-modelo-de-datos.md:629` «El rol de socio se da en el acto que fija al dueño».
- `$V/descomposicion.md:60` «asignado ~~al aprobar la postulación~~ en el acto» (fila `V7`); `:540`
  «asignado ~~al aprobar la postulación~~ **en el acto» y «aprobar una postulación no asigna ningún
  rol; reclamar»; `:626` criterio de `V7`, misma cita.

### G · qué pasos refrescan la página pública

- `$V/docs/03-maquinas-de-estado.md:538` «El criterio lo confirmó el owner». No había ninguna marca
  «a confirmar» en `V/03` §9 (las trece notas «Revalida:» ya llevaban `lote 3 A`); se agregó la
  confirmación al párrafo del criterio.

### H · las seis columnas de `partners`

- `$V/docs/02-modelo-de-datos.md:622` «las seis, lista cerrada» y `:626` «quedan hasta `V7`».
- `$V/docs/18-partner.md:140` «las seis:» (con `starts_at` y `ends_at` hasta `V7`).
- `$V/descomposicion.md:626` «y `starts_at` y `ends_at` de `partners`» (criterio de `V7`).

### L · `fullAdminRole` sin ninguna acción

- `$V/docs/17-autorizacion.md:480` «Y el rol de administrador del plugin queda sin ninguna acción» y
  `:486` «del baneo en el inicio de sesión». Cita verificada en `origin/staging`
  (`apps/api/src/lib/auth.ts:76-89`, `fullAdminRole`; `noAdminRole` en `:92`).
- `$V/spec.md:465` «queda sin ninguna acción».
- `$V/descomposicion.md:533` «`fullAdminRole` queda sin ninguna acción» (fila de §2.13) y `:624`
  «`fullAdminRole` no lista ninguna acción —ni» (criterio de salida de `V5`).

## 3. Lo que no se aplicó y por qué

- **C, I, J, K**: no son de esta épica (C es del corte en `16-`; I, J y K, del cobro).
- **D en `V/02`**: `V/02` no describe tablas de la migración del corte; la tabla de paso quedó en
  `V/21` y `V/desc`.
- **E en `V/02`**: `V/02` no describe cómo se escribe la tabla de claves (vive en `NUCLEO/02` §1.2 y
  §1.4); quedó en la fila `G3` de `V/20`.
- **A fuera de `V/21`**: ningún otro archivo de `$V` describe la rama de aborto con la regla.

## 4. Para otro dueño

1. **`B/descomposicion.md:794`**: dice «~~33~~ 34 guards —… **33** repartidos … **17** en la otra».
   Con `G18` en la columna de `V1`, propuesto: «**34** repartidos» y «~~**17**~~ **18** en la otra
   *(entra `G18`, de `V1`: FASE 5, lote de la aplicación, owner 2026-09-30, E)*». Sujeto a la
   pregunta 4 de abajo.
2. **`B/docs/20-testing.md:391`**: el guard 34 va sin id; propuesto nombrarlo `G18` y citar
   `V/20` §2.
3. **`25-aplicacion-lote-de-aplicacion-nucleo-y-log.md` §5**: su opción 1 dice *«19 de
   verticales»*; con la columna de hoy son **18** (17 + `G18`). Conviene alinear la cifra.

## 5. Vuelve al owner

### 1 · La tabla de paso y el recorrido de `G-R9`

`G-R9` recorre `packages/db/src/schemas/` y exige fila en la lista de `PURGED` para toda tabla con
FK a una ficha **o con una columna `entity_type`**. La tabla de paso nombra fichas ya borradas, así
que no puede tener FK; pero si se declara en el esquema de Drizzle con una columna de vertical
llamada `entity_type`, `G-R9` la pide en la lista, y si se declara ahí, borrarla en el 5b deja el
esquema distinto de la base. *Ejemplo*: la ficha de Juan, con doce fotos, entra a la tabla de paso;
`V6` agrega la tabla al esquema con `entity_type` y el CI se pone rojo por una tabla que vive dos
días.

1. **Que viva sólo en el SQL de la migración del paso 3, fuera del esquema de Drizzle**, y la borre
   el 5b. Costo: nada. Riesgo: bajo; ni `G-R9` ni el control de drift la ven. **Recomendada.**
2. **En el esquema, con fila en la lista de `PURGED`** («no aplica: se borra en el 5b»). Costo: una
   fila y una migración más para sacarla. Riesgo: bajo.
3. **En el esquema, sin `entity_type`**. Costo: nada. Riesgo: medio, depende de un nombre de
   columna.

### 2 · El alta directa del admin «con dueño» y la regla de `owner_user_id`

F da el rol en *«el reclamo, o el alta directa del admin con dueño»*. Pero `V/02` §2.7 (fila
`partner`) dice que `owner_user_id` **lo escribe sólo el acto de reclamar** y que *«ninguna otra
escritura lo toca»*. Si el alta directa fija un dueño sin reclamo, esa restricción tiene una
excepción que nadie escribió. *Ejemplo*: el admin da de alta el Partner de Juan desde el panel; si
elige la cuenta de Juan a mano, escribe `owner_user_id` sin que Juan pruebe la casilla.

1. **El alta directa tampoco escribe el dueño: manda el aviso de reclamo, y el rol llega con el
   reclamo**; *«con dueño»* se lee como *«cuando queda con dueño»*. Costo: una frase. Riesgo:
   bajo; conserva *«nada se vincula hasta que la dirección se prueba»*. **Recomendada.**
2. **El alta directa escribe `owner_user_id` y da el rol en el mismo acto**, como excepción
   escrita en `V/02` y en la guarda. Costo: una excepción. Riesgo: medio; un admin vincula una
   cuenta que no probó la dirección.

### 3 · Qué hace `V7` con `starts_at` y `ends_at`

H las deja *«hasta la unidad de socios»* sin decir qué hace ella. *Ejemplo*: Juan es socio Gold; el
panel le muestra un `ends_at` que nadie escribe.

1. **`V7` las borra con su migración**, junto con sus lectores del panel. Costo: bajo. Riesgo:
   bajo (cero filas hoy). **Recomendada.**
2. **`V7` las vuelve a escribir** desde la presencia. Costo: medio. Riesgo: una fecha que el
   diseño no usa.

### 4 · `G18` en `V1`, condicionado a la pregunta de `25-` §5

La consigna fijó el guard en los criterios de `V1`, y así quedó (columna, criterio, conteos). Es
la opción 1 que `25-` §5 le pregunta al owner. Si el owner elige otra unidad (`V6` o `U1`), hay que
mover la fila de `V1` en `V/desc` §2 y §4, el *«lo construye `V1`»* de `V/20` y `V/spec` §5, y el
reparto 18 + 15 + 1 de `V/desc:583`. No es una pregunta nueva: se contesta con la de `25-`.

## 6. Conteos

```text
# marcas del lote de la aplicación por archivo (rg -c -F "lote de la aplicación" <archivo>)
spec.md: 6 · descomposicion.md: 14 · 02: 3 · 03: 2 · 17: 2 · 18: 2 · 20: 2 · 21: 9 → 40
(el párrafo de L en V/17 parte la frase en dos líneas y no entra en este conteo)

# ids G existentes en las tres specs (rg -o "\bG1[0-9]\b|\bG2[0-9]\b" … | sort | uniq -c)
G10..G17 presentes; G18 y siguientes, ausentes antes de este cambio

# filas contadas del catálogo de V/20 §2 (sin G-R3, G-R5 tachado ni G-R5-B)
antes 19 → después 20

# git diff --stat -- $V
8 files changed, 119 insertions(+), 58 deletions(-)

# markdownlint-cli2, desde la raíz del worktree, sobre los ocho archivos
antes: 0 issues · después: 0 issues
```

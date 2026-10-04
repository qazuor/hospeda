---
title: "FASE 5 · aplicación — cruces entre los ocho registros"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 5
---

# FASE 5 · cruces de la aplicación

Entrada: los ocho registros `11-aplicacion-paraguas.md` … `18-aplicacion-log-y-matriz.md` y el diff
sin commitear del worktree. Rutas cortas: `$D` = `.specs/HOS-1352-billing-verticals-redesign/docs`,
`V/` = `.specs/HOS-1353-verticales-capacidades-y-autorizacion`, `B/` =
`.specs/HOS-1354-billing-cobro-y-proveedor`. Todas las citas son `archivo:línea` sobre el árbol de
trabajo al cerrar este registro.

## 1. Arreglos aplicados (18)

### 1.1 «Para otro dueño» que faltaban y eran mecánicos

- `$D/06-mp-validation-matrix.md:405` (`EX-48`, columna *«para qué»*): «sin sujeto desde el
  2026-09-30: la lápida del corte y su ventana salieron» (S-40, S-41, S-57). La columna seguía
  nombrando la ventana del corte como vigente.
- `$D/06-mp-validation-matrix.md:407` (`EX-50`, ídem): «sin sujeto desde el 2026-09-30: el detector
  posterior al corte salió con la lápida del corte» (S-42, S-58).
- `$D/06-mp-validation-matrix.md:415` (`EX-58`, pedido de `16-` §4): «la rama salió: las
  devoluciones de una orden van de a una y el id sale por resta» (lote 5 F).
- `V/descomposicion.md:623` (criterio de `V4`, pedido de `12-`, `14-` y `16-`): «y `trial` no tiene
  `deleted_at`: una fila no se esconde con un borrado lógico» (lote 4 E).
- `B/descomposicion.md:854` (criterio de `B11`, pedido de `17-`): «la salvedad 4 del barrido cuenta
  once filas terminales y una sola lápida» y «las de una misma orden salen de a una» (S-40, S-70,
  lote 5 F).
- `$D/11-particion-del-programa.md:183` (fila 07): «que depende de `U1` y va antes de `V6`, `V9`,
  `B4` y `B12`» (lote 2 A). Era el único lugar que describía `U2` sin sus dependencias.

### 1.2 Menciones vivas del corte retirado

- `V/docs/21-migracion.md:193`: «la tabla de ocho clases salió: FASE 5, simplificación del corte,
  S-01». El encabezado de *«En qué estado nace cada ficha»* seguía remitiendo a las filas `L5`, `L7`
  y `L8` de una tabla tachada.

### 1.3 Cifras discordantes

- **Matriz** (recuento con script: 117 · 63 · 16 · 24 · 14). Cinco lugares citaban el recuento
  anterior a las mediciones del 30/09 (61 `VERIFIED`, 16 `UNKNOWN`):
  - `B/descomposicion.md:420` «~~quince~~ trece filas `UNKNOWN`» (13 = 14 menos `EX-49`, que es de
    verticales; recontadas sobre la tabla del §2.7).
  - `B/descomposicion.md:424` «~~61~~ 63 `VERIFIED`» y «~~16~~ 14 `UNKNOWN`».
  - `B/descomposicion.md:445` y `:446`, filas `EX-57` y `EX-59`: «en sandbox y con ventana: ya no es»
    y «Ya no es `UNKNOWN`: la medición del 2026-09-30».
  - `B/spec.md:256` «~~61~~ 63 `VERIFIED`» y «~~16~~ 14».
  - `$D/../spec.md:90` y `:142` «~~101~~ 103 cerradas» y «~~16~~ 14 `UNKNOWN`».
  - `B/docs/06-proveedor.md:27` «~~**101**~~ **103** medidas» y `:28` «quedan catorce `UNKNOWN` y
    trece».
- **Dependencias entre épicas.** Contadas con script sobre la tabla de `B/descomposicion.md` §2.6:
  **doce** filas vivas (1 a 7, 9 a 12 y 14; la 8 y la 13 tachadas). El log decía *«siguen en once»*
  en los 📌 de O-A y P-C de `DEC-ARCH-014` y en el de `DEC-ARCH-006`, escritos antes de la fila 14
  (FASE 9 vuelta 3, `F-8V3C1-006`). Como el log no edita el contenido de sus entradas, la corrección
  va al final del 📌 de la FASE 5 de `DEC-ARCH-014`: `$D/01-decision-log.md:7341` «son **doce**, no
  once como dicen los 📌 de O-A y P-C». `16-`, `V/desc` y `B/desc` ya decían doce.

### 1.4 La corrección conocida

- `$D/38-fase-5/10-decisiones-del-owner.md:77`, lote 3 C: «~~`PB9`~~ `PB12` (corregido en la
  aplicación, 2026-09-30: la opción 1 de `R5-17` dice *«el del diseño»*, que es `PB12`,
  `V/03:498`)». Es la única edición en ese archivo.

## 2. «Para otro dueño» que ya estaban aplicados

Verificado en el archivo destino, sin tocar:

| pedido (registro) | dónde ya está |
|---|---|
| `V/21` §2.4, *«sólo las usa el cobro viejo»* y la razón `L5`/`L7` (`11-`, `14-`) | `V/21:259` y `:269`, `$D/16-…:658` |
| `V/20` §2, `G8` sin `extras/` (`11-`, `12-`) | `V/docs/20-testing.md:56` |
| `U2` en las dos descomposiciones, 24 unidades (`11-`, `12-`) | `V/desc:59`, `:62`, `:530`, `:559`, `:560`, `:583`; `B/desc:130`, `:138`, `:707`, `:725`, `:794` |
| plazos antes del merge de `V6` (`11-`) | `$D/nucleo/02:189`, `$D/16-…:137`, `V/desc:488`, `:537` |
| `trial` sin `deleted_at` en `V/02` (`12-`, `16-`) | `V/docs/02-modelo-de-datos.md:987` (§5) |
| pruebas del corte después de la migración (`12-`, `13-`) | `$D/16-…:137` (con el ⚠️ que la manda al owner), `$D/nucleo/02:101-106`, glosario `:77` |
| `PB12` y no `PB9` en `V/03` §9 y `V/desc` (`12-`, `13-`, `14-`) | `V/03:542`, `V/desc:391`, `:536`, `:625` |
| cada fila de `V/03` §9 dice si revalida (`13-`) | `V/03:491-498` |
| `V/17` y `error-contract.md` (lote 4 D), familia del socio (4 B), `alliance_leads` (4 A) (`13-`, `14-`) | `V/17`, `V/02`, `V/18`, `V/19` y `V/desc` (`rg -c "lote 4 [ABD]"`) |
| filas `V5`, `V6`, `V7` de `V/desc` (`14-`) | `V/desc:624`, `:625`, `:626` |
| alcance de `U1` en `16-` §4.6 (`14-`) | `$D/16-…:754` y siguientes (partners, destacados, `archive-abandoned-drafts`, enums, `U1-021`) |
| tabla de traducción fuera de `V/02` §4.1 (`14-`) | `V/02:451`, `:778` |
| `B/21` §4 lista cerrada de columnas (`14-`) | `B/21:500` |
| `B/03` §6.1 `RF2` y `RF3` (`15-`, `17-`) | `B/03:1851-1852` |
| lápida del corte en `B/02`, `B/05`, `B/06`, `B/09`, `B/16` (`15-`) | sin menciones vivas (barrido del §3) |
| `16-` §4.2 no reparte la lápida a `B11` (`15-`) | `$D/16-…:363` |
| umbral de veinte en `V/21` §2.5 (`15-`) | sin menciones vivas |
| matriz: `EX-42`, `EX-48`, `EX-50`, `EX-44`, `EX-45`, `EX-47`, `EX-59`, `EX-40` (`15-`) | filas 399-416 |
| `B/09` §3 salvedad 4 y §2.4 (`16-`) | `B/09:319`, `:325`, `:288` |
| `B/06:453`, `EX-44` y `EX-45` sin *«cobro sobre la lápida del corte»* (`17-`) | `B/06:460`; matriz `:401-402` |
| fila `B6` (`16-`) | `B/desc:849` |
| log: `DEC-MIG-002`, `-004`, `-005`, `DEC-CONC-002` y el §11 de `20-` (`11-`, `15-`, `16-`) | 📌 de la FASE 5 y fila `SUPERSEDED` del resumen |

## 3. Menciones y cifras que quedan

1. **El log conserva texto vivo del corte retirado dentro de 📌 ya superados** —la lápida del corte
   (`01-decision-log.md:3364`, `:6336`, `:6355`, `:6359`), el Worker (`:3057`), `L1`–`L8`
   (`:3034`, `:6763`, `:6767`), el umbral de unas veinte (`:3087`, `:3341`)—. No se tocan: el log
   no edita el contenido de sus entradas, y cada uno lo supera un 📌 de la FASE 5 o la marca
   `SUPERSEDED` de `DEC-MIG-004` (`:3314`, `:6365-6380`, `:7346`).
2. `$D/38-fase-5/10-decisiones-del-owner.md:83` nombra la clasificación `L1`–`L8`: es histórico y
   su única edición permitida era la de la línea 77.
3. **`origen_de_lápida` con un solo valor** (`B/02:99`, `B/05:348` y los capítulos de S-70): queda
   así hasta la pregunta **I**.
4. **El guard del catálogo del lote 2 D no está entre los 33** (`$D/nucleo/02:101`, `$D/16-…:137`,
   `B/21:178`): contarlo lo volvería 34. Va con la pregunta **E**, porque su opción recomendada lo
   extiende a la tabla de claves.
5. **Quién escribe las cinco pruebas**: `$D/16-…:379` y `V/desc:478` la dan a `V6`; queda ligado a
   la pregunta **B**.
6. **La baja física de cuentas** (`user/admin/hardDelete.ts`) quedó en `V8` (`V/desc:536`) y la
   puerta del plugin de administración no tiene unidad: pregunta **L**.
7. **Linear, HOS-354** (cerrarla o reescribirla como el *«entrar como»* de una versión posterior,
   lote 4 C): no es texto del repositorio; queda para quien opere Linear.

## 4. Conteos finales

| qué | cifra | comando |
|---|---|---|
| decisiones del log | **142** | `rg -o "^### DEC-[A-Z]+-\d+" $D/01-decision-log.md \| sort -u \| wc -l` |
| matriz | **117 filas · 63 `VERIFIED` · 16 `PARTIALLY_SUPPORTED` · 24 `NOT_SUPPORTED` · 14 `UNKNOWN`** (9 esperan medición; 9 no se miden por decisión, 5 de ellas `UNKNOWN`) | `cd $D && python3 contar-filas-de-la-matriz.py` |
| unidades | **24** | barrido de citas vivas (`\b2[2-4] unidades`) en las specs, las descomposiciones, `16-` y el núcleo: todas dicen 24 |
| guards | **33** | ídem (`V/desc:583`, `B/desc:794`, `$D/16-…:763`) |
| dependencias entre épicas | **12** | filas vivas de la tabla de `B/descomposicion.md` §2.6, contadas con `python3` |
| tachados | 0 líneas con `~~~~`; 0 párrafos con `~~` impar; 0 filas de tabla ni encabezados con `~~` impar | script sobre los 32 archivos, contra `HEAD` |
| markdownlint | **0** errores en los 32 archivos del diff | `npx markdownlint-cli2 <archivos>` |

Las líneas sueltas con `~~` impar son tachados que cruzan un salto de línea dentro de un párrafo,
como ya pasaba en `HEAD`; ninguno queda abierto al terminar su párrafo.

## 5. Preguntas al owner

Deduplicadas de los ocho registros y filtradas contra `DEC-MIG-007`: ninguna la contesta la premisa
(la **D** toca cuentas fuera de las cinco, pero su borrado ya lo decidiste en el lote 1 J; lo que
falta es de dónde sale la lista).

### A · Si abortamos el corte, ¿hasta cuándo sigue el bloqueo de toda escritura? (`11-`)

Elegiste que abortar sea restaurar y volver al sistema viejo *«sin reabrir la venta»*, y que una
regla bloquee toda escritura *«hasta abrir el sistema nuevo»*. Si abortamos, el nuevo no se abre ese
día. Juan, que vive del sitio, no puede ni entrar a editar su ficha mientras la regla siga.

1. **La regla queda hasta el reintento.** Costo: nada. Riesgo: si el reintento tarda días, toda la
   plataforma queda en sólo lectura ese tiempo.
2. **La regla se levanta al abortar.** Costo: nada. Riesgo: el sistema viejo vuelve a vender por su
   checkout; quien se suscriba no está en tu lista y en el reintento pierde su débito y su ficha.
3. **Se levanta la regla general y, hasta el reintento, se bloquean sólo las rutas de venta del
   viejo** (checkout, reintento, cambio de plan, cambio de medio de pago, compra de complemento).
   Costo: una lista corta de rutas, sólo para el aborto. Riesgo: olvidar una.

**Recomendada: 3**, la única que cumple *«sin reabrir la venta»* sin dejar el sitio congelado por un
plazo que nadie fijó.

### B · Qué herramienta escribe las cinco pruebas del corte (`11-`, `13-`)

Elegiste que las pruebas gratis y sus seudónimos los escriba *«el script del corte, con la función de
la aplicación»*. Pero ese script, por decisión anterior, no importa código de ningún sistema, y la
función del seudónimo es del sistema nuevo. Para escribir la prueba de Juan hay que usarla.

1. **La escribe la herramienta del corte de la unidad de publicación (`V6`)**, que es del sistema
   nuevo, como ya pasa con los regalos de cortesía; el script suelto sigue sin importar nada.
   Costo: bajo. Riesgo: bajo.
2. **El script suelto importa la función.** Costo: bajo. Riesgo: rompe la regla de que el script no
   dependa de ningún sistema.
3. **El script reimplementa la función.** Costo: dos copias de una función que no puede cambiar.
   Riesgo: medio, que las dos normalicen distinto un correo.

**Recomendada: 1**.

### C · Un aviso de Mercado Pago en los minutos entre apagar lo viejo y levantar lo nuevo (`11-`)

Sin el Worker del borde, la ruta de avisos queda abierta, pero en ese rato no la atiende ningún
servidor. El Worker garantizaba un `500`, el único código que medimos que Mercado Pago reintenta. Si
un cobro de Juan (una de las tres cuentas con débito) avisa justo ahí y no se reintenta, no te
aparece para decidir la devolución.

1. **Declararlo y aceptarlo**: son minutos y tres cuentas que conocés; si pasa, lo ves en tu cuenta
   de Mercado Pago o te lo dice la persona. Costo: nada. Riesgo: bajo.
2. **Medir en sandbox si Mercado Pago reintenta con el servidor caído**, antes del ensayo. Costo: una
   medición y una fila de la matriz. Riesgo: bajo.
3. **Un Worker mínimo sólo para ese rato.** Costo: volver a construir y ensayar lo que retiraste.
   Riesgo: bajo.

**Recomendada: 1**, por los puntos 3 y 4 de `DEC-MIG-007`.

### D · De dónde saca el paso 5b qué fotos borrar y qué tokens de calendario revocar (`11-`, `13-`)

La migración del paso 3 borra las filas de las fichas que no son de las cinco; el 5b, días después,
borra sus fotos y revoca sus tokens. Sin la fila, no queda en la base qué fotos eran de la ficha de
Juan, que no está en la lista y tenía doce fotos y el calendario conectado.

1. **La migración, antes de borrar, copia a una tabla de paso** el id de cada ficha, las rutas de sus
   fotos y su token; el 5b la recorre y la borra al terminar. Costo: una tabla temporal. Riesgo:
   bajo; el backup la incluye, así que un aborto la restaura con las fichas, y el token no sale de la
   base.
2. **Antes del paso 3, con todo bloqueado, la herramienta del corte guarda la lista en un archivo
   fuera de la base.** Costo: bajo. Riesgo: tokens de calendario de terceros en un archivo que hay
   que custodiar y borrar a mano.
3. **El 5b barre el almacenamiento y borra toda foto que ninguna fila nombra.** Costo: listar todo.
   Riesgo: no resuelve los tokens (el de Juan queda vivo) y puede borrar algo que otra tabla nombra
   sin clave foránea.

**Recomendada: 1.** Los dos registros recomendaban distinto (`11-` la 2, `13-` la 1); gana la 1
porque no saca credenciales de terceros de la base.

### E · La tabla de claves del catálogo, ¿también como SQL generado y vigilado? (`12-`)

El lote 2 D resolvió que el catálogo de producción viaje como SQL generado por un script y vigilado
por un control que lo regenera y compara, porque una migración no puede llamar código. La tabla de
claves tiene el mismo problema y llega antes, con la unidad `V1`. Si `V1` agrega la clave que deja a
Juan destacar su ficha y la migración no la escribe, el panel no la puede asignar a ningún plan.

1. **El mismo mecanismo y el mismo control para las dos cargas.** Costo: bajo, es la pieza que el
   lote 2 D ya pide. Riesgo: bajo.
2. **SQL a mano en cada migración que agrega una clave, sin control.** Costo: nada hoy. Riesgo:
   código y tabla se separan en silencio.
3. **La carga el seed de datos requeridos.** Costo: bajo. Riesgo: contradice el lote 2 C (una sola
   fuente para las filas de referencia).

**Recomendada: 1.** Consecuencia a confirmar con ella: ese control todavía no figura entre los 33
guards; contarlo los lleva a 34.

### F · A qué cuenta se le da el rol de socio (`14-`)

La decisión dice *«asignado al aprobar la postulación»*, pero al aprobar todavía no se sabe cuál es
la cuenta del dueño: se sabe recién cuando alguien reclama con sesión. Juan postula con
`juan@almacen.com`; existe una cuenta vieja con ese correo que creó otra persona. Si el rol se da al
aprobar, lo recibe la cuenta vieja, y Juan, que reclama desde la suya, queda dueño sin el rol.

1. **Darlo en el acto que fija al dueño**: el reclamo, o el alta directa del admin con dueño. Costo:
   una línea en dos capítulos. Riesgo: bajo.
2. **Al aprobar si el correo ya es de una cuenta, y en el reclamo si no.** Costo: parecido. Riesgo:
   el caso de Juan.
3. **Al aprobar, a la cuenta del correo.** Costo: nada. Riesgo: alto, vincula por tener la dirección
   y deja sin rol al dueño real.

**Recomendada: 1**.

### G · Qué pasos de la ficha refrescan su página pública (`14-`)

El lote 3 A pide que cada paso de la ficha diga si refresca la página, sin dar el criterio. Se aplicó
*«refresca el que entra o sale de publicada»*, así que el borrado automático del día 180 no refresca.
La ficha de Juan se archivó a los 90 días (ahí se refrescó y desapareció); a los 180 se borra y no
hay página que refrescar.

1. **Lo aplicado: sólo los que entran o salen de publicada.** Costo: nada más. Riesgo: bajo.
2. **Todos refrescan.** Costo: purgas del borde sin efecto contra su tope. Riesgo: ninguno de
   producto.
3. **Lo aplicado más el día 180.** Costo: una purga por ficha borrada. Riesgo: ninguno; es redundante.

**Recomendada: 1**.

### H · Qué columnas de pago de los socios borra la limpieza (`14-`)

El lote 1 D dice *«las columnas de pago de `partners`»* sin lista. Hay seis que sólo sirven al cobro
viejo y dos fechas de vigencia que leen los crons y el panel. Juan es socio Gold: si `ends_at` queda
y nadie la escribe, el panel le muestra una fecha que ya no significa nada.

1. **Las seis** (`subscription_status`, `plan_id`, `subscription_id`, `unpaid_notice_sent_at`,
   `payment_review_state`, `payment_confirmed_through`); las fechas quedan hasta la unidad de socios.
   Costo: bajo. Riesgo: dos fechas sin escritor un tiempo (hoy, cero filas).
2. **Las seis y también `starts_at` y `ends_at`.** Costo: el panel pierde esas dos fechas. Riesgo:
   bajo.
3. **Que la limpieza la cierre al implementar.** Riesgo: lo que ya rechazaste (*«100 % seguros»*).

**Recomendada: 1**.

### I · La columna que dice de qué clase de lápida es una fila, ¿sale? (`15-`, `16-`)

Con la lápida del corte afuera, `origen_de_lápida` sólo puede valer `RECEPCIÓN`. A Juan le entra un
cobro de un débito viejo: su fila ya dice `clase = LÁPIDA`, y además `origen_de_lápida = RECEPCIÓN`,
que no distingue nada.

1. **Sale la columna**: `clase = LÁPIDA` alcanza. Costo: tachar la columna y su restricción en tres
   capítulos. Riesgo: si vuelve otra lápida, una migración la agrega.
2. **Queda con un solo valor.** Costo: nada. Riesgo: alguien la lee creyendo que decide algo.

**Recomendada: 1**.

### J · Cómo se asegura que dos devoluciones de una misma compra salgan de a una (`16-`)

El lote 5 F decidió serializarlas, y el diseño no usa candados distribuidos: todo se resuelve con una
restricción de la base o con una relectura. Si a Juan le devolvemos dos cosas de la misma compra, la
segunda tiene que esperar a que la primera tenga su id.

1. **Una restricción de la base**: a lo sumo una devolución de la orden esperando su id. Costo: un
   índice parcial. Riesgo: una llamada que nunca responde deja la orden esperando hasta que el
   barrido la reenvía, que ya está diseñado.
2. **Un candado de fila durante la llamada.** Costo: bajo. Riesgo: una transacción abierta mientras
   se espera al proveedor.
3. **Que sólo el barrido mande las de órdenes, de a una.** Costo: la devolución sale al otro día.
   Riesgo: más lenta.

**Recomendada: 1**.

### K · Si el reintento de cancelar un débito viejo repite el correo (`17-`)

La excepción *«sin correo»* del reintento era de la lápida del corte, que salió, y no quedó dicho qué
pasa con la de recepción. A Juan le entra un cobro de un débito viejo: se anota, se intenta el
correo y se manda cancelar; la cancelación no se aplica y el barrido la reintenta al otro día.

1. **Como toda cancelación nuestra**: el correo sale una vez, antes del primer intento, y no se
   repite si se entregó. Costo: nada. Riesgo: si no había destinatario, el reintento lo intenta de
   nuevo sin efecto.
2. **El reintento sobre esa lápida sale sin correo.** Costo: una excepción escrita. Riesgo: si el
   primero falló, Juan no recibe ninguno.

**Recomendada: 1**.

### L · El plugin de administración de cuentas todavía tiene permiso de borrarlas (visto por `18-`)

El rol de administrador del plugin `admin` de Better Auth (`apps/api/src/lib/auth.ts:76-89` en
`origin/staging`) lista, además de `impersonate` y `set-role` (que ya decidiste sacar), `ban`,
`delete`, `set-password`, `create` y `update`. Hoy toda ruta del plugin contesta `403`, pero
`user: delete` es una puerta de borrado físico de cuentas, y el lote 3 C dice que ésas desaparecen.
Si mañana alguien habilita esas rutas, un clic borra la cuenta de Juan entera.

1. **Sacar también `delete`** en la misma unidad que saca `impersonate` y `set-role` (`V5`, la de
   autorización), y dejar el resto como está. Costo: una línea. Riesgo: bajo.
2. **Dejar el rol del plugin vacío**: nada del plugin queda permitido. Costo: verificar que ningún
   flujo use `ban` o `set-password` del plugin (el rechazo de sesión por baneo, que conservaste, no
   depende del rol). Riesgo: medio, romper algo que hoy nadie mide.
3. **Dejarlo como está**, porque hoy contesta `403`. Costo: nada. Riesgo: la puerta queda escrita,
   contra el lote 3 C.

**Recomendada: 1.** Con ella, la baja física de cuentas del panel (`user/admin/hardDelete.ts`)
sigue en `V8`, que construye la acción que la reemplaza (`V/desc:536`).

---
title: "FASE 5 · aplicación del lote de la aplicación — épica del cobro"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 5
---

# FASE 5 · lote de la aplicación en la épica del cobro (`$B`)

Fuente: la última sección de [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md)
(«Lote de la aplicación», letras A a L) y las preguntas de [`21-cruces.md`](./21-cruces.md) §5.
Letras de esta épica: I, J, K, E, H, y A y C donde `B/21` las menciona. Origen escrito en cada
cambio: `(FASE 5, lote de la aplicación, owner 2026-09-30, <letra>)`. Sin commits.

## 1. Archivos tocados

- `.specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md`
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md`
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md`
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md`
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md`
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md`
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md`

`spec.md` no se tocó: no nombra la columna, la serialización ni el conteo total de guards (su
fila de `B/20` cuenta los diecisiete de este catálogo, que no cambian).

## 2. Qué se aplicó

### I · sale `origen_de_lápida` y su restricción

- `B/02:56` «Sale la columna `origen_de_lápida` y su restricción: `clase = LÁPIDA` alcanza para
  reconocer la fila» — tachada la oración de la columna, su valor único y la ⚠️ de S-70.
- `B/02:106` «`clase = LÁPIDA`, sin columna de origen».
- `B/05:356` «`clase = LÁPIDA` (FASE 5, lote de la aplicación» — en la tabla de desempate,
  tachado `origen_de_lápida = RECEPCIÓN`.
- `B/21:202` «y después la columna entera».
- `B/21:268` «`clase = LÁPIDA`; FASE 5, lote de la».
- `B/21:315` «sale la columna `origen_de_lápida`: `clase =».
- `B/02:94`, `B/02:99`, `B/05:375`, `B/21:227`, `B/21:245`, `B/21:309`, `B/21:344`, `B/21:380` y
  `B/desc:137` ya estaban tachadas enteras (texto de la lápida del corte): no se tocaron.

### J · un índice parcial serializa las devoluciones de una orden

- `B/03:1851` («`RF2`») «La serialización la impone una restricción de la base» — reemplaza la ⚠️
  que dejó la aplicación anterior (tachada).
- `B/02:380` (restricciones de `refund`) «a lo sumo una devolución de la misma orden esperando su
  id».
- `B/05:92` (§1.2) «también se serializa con la base, no con un lock».
- `B/desc:132` (fila `B6` de la tabla de unidades) «lo impone un índice parcial de la base».
- `B/desc:849` (criterio de `B6`) «y la que espera la frena la base, no un chequeo».

### K · el reintento sobre la lápida de recepción no repite el correo

- `B/09:357` «sigue la regla de toda cancelación nuestra, la del punto 1» — tachada la ⚠️ que
  lo mandaba al owner.

### E · guards de 33 a 34

- `B/20:391` «~~**33**~~ **34** (el 34 es» — sin fila nueva: el control es del catálogo y de la
  tabla de claves de `V1`, no de `B/20`.
- `B/20:392` «el 34, el control del SQL generado» — la fila «con unidad» sigue contando los 33 de
  la tabla y dice que el 34 no entra en ese recuento.
- `B/desc:794` «~~33~~ 34 guards».
- `B/desc:795` «y entra el control que regenera y compara».

### H · la lista cerrada de columnas de `partners`

- `B/21:505` «en una lista cerrada de seis» — las seis columnas nombradas; `starts_at` y `ends_at`
  quedan.

### A y C · en `B/21`

- `B/21:400` (A, §2 rollback) «queda puesta» — tras un aborto, la regla que bloquea toda escritura
  queda hasta el reintento; se escribe que fue contra la recomendación.
- `B/21:619` (C, «NO cierra») «Salvo el aviso que llegue entre apagar lo viejo» — declarado y
  aceptado, con `DEC-MIG-007` puntos 3 y 4.

## 3. Lo que no se aplicó y por qué

- **B, D, F, G, L**: no aparecen en `$B` (sin menciones vivas de la herramienta que escribe las
  pruebas, la tabla de paso del 5b, el rol de socio, el refresco de la página ni el plugin
  `admin`). `rg -n 'tabla de paso|5b|fotos|calendario' $B/docs/21-migracion.md` no da ninguna
  línea viva sobre el paso 5b.

## 4. Para otro dueño

1. **`V/20` §2 y `V/descomposicion.md`** (dueño: épica de verticales): la fila y la unidad del
   guard 34, el control que regenera y compara el SQL generado del catálogo y de la tabla de
   claves (lote 2 D y lote de la aplicación E). `B/20:392` dice que su unidad la escribe esa
   épica; mientras no esté, `B/descomposicion.md:794-795` cuenta 34 con 33 repartidos.
2. **`$D/38-fase-5/10-decisiones-del-owner.md`** no hace falta tocarlo: la letra E ya dice 33 → 34.

## 5. Vuelve al owner

1. **Quién vuelve a mandar la devolución que la base frenó (J).** El índice impide que la segunda
   devolución de la orden persista su llamada mientras la primera espera su id; lo escrito cubre
   que el barrido reenvía una llamada **ya persistida** sin respuesta, pero no nombra quién manda
   la segunda, que quedó en `CONFIRMED` sin llamada. Ejemplo: a Juan le confirmamos dos
   devoluciones de la misma compra a la vez; la primera sale, la segunda choca con el índice.
   1. **El barrido la manda** en la corrida que relee la orden, cuando ya no hay ninguna esperando.
      Costo: una rama del barrido. Riesgo: bajo; sale al otro día.
   2. **Quien confirmó la primera, al recibir su id, manda la siguiente de la orden.** Costo: bajo.
      Riesgo: si ese proceso muere, la segunda espera al barrido igual.
   3. **La segunda falla visible y la vuelve a confirmar una persona.** Costo: nada. Riesgo: pasos
      de más para la persona.

   **Recomendada: 1**, que reusa lo ya diseñado y no deja la fila sin dueño.

## 6. Conteos

- Orígenes escritos por letra, normalizando saltos de línea (script `python3` con
  `re.finditer(r'lote de la aplicación, owner 2026-09-30, ([A-L])', …)` sobre `$B`): **18** — I 6,
  J 5, E 3, K 1, H 1, A 1, C 1.
- `rg -n -o '.{0,60}origen_de_lápida.{0,60}' $B | wc -l`: 17 líneas con el nombre, todas tachadas
  o diciendo que la columna sale.
- `git diff --stat -- $B`: 7 archivos.
- `npx markdownlint-cli2` sobre los 7 archivos: **0** problemas después, y **0** antes (las versiones de
  `HEAD`, lintadas con `.markdownlint-cli2.jsonc` del repo). Este registro: 0.

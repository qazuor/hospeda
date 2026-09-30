---
title: "FASE 5 · aplicación del lote de la aplicación — paraguas"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 5
---

# FASE 5 · aplicación del «Lote de la aplicación» en el paraguas

Fuente: [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md), «Lote de la aplicación»
(letras A a L), con el contexto de [`21-cruces.md`](./21-cruces.md) §5. Origen escrito en cada
cambio: `(FASE 5, lote de la aplicación, owner 2026-09-30, <letra>)`.

## 1. Archivos tocados

- `docs/16-fase-7-del-paraguas.md` (único).
- `docs/11-particion-del-programa.md` y `spec.md`: leídos, sin cambios (ver §3).

## 2. Qué se aplicó

### A · la regla que bloquea toda escritura, después de un aborto (elegida contra la recomendación)

- `16-fase-7-del-paraguas.md:132` (paso 0b) «o, si el corte se aborta, hasta el reintento».
- `16-fase-7-del-paraguas.md:384` (herramientas del corte, punto 5; se tacha el ⚠️) «y, si se
  aborta, queda puesta hasta el reintento».
- `16-fase-7-del-paraguas.md:427` (§4.2, la rama de aborto; se tacha el ⚠️) «Después de un aborto,
  la regla del 0b que bloquea toda escritura queda puesta hasta el».
- `16-fase-7-del-paraguas.md:430` «Elegida contra la recomendación», con la recomendada (levantar
  la regla general y bloquear sólo las rutas de venta del viejo) y el costo declarado.

### B · la herramienta que escribe las cinco pruebas

- `16-fase-7-del-paraguas.md:137` (paso 3; se tacha «el script del corte» y el ⚠️) «la herramienta
  del corte de `V6` escribe las cinco pruebas» y «La herramienta de `V6` es del sistema nuevo».
- `16-fase-7-del-paraguas.md:380` (herramientas del corte, punto 4, `V6`; se tacha el ⚠️) «con la
  herramienta del corte de `V6`, que es la que puede usar».
- El punto 1 (el script suelto) no cambia: ya dice que no importa código de ningún sistema.

### C · un aviso sin servidor entre apagar y levantar

- `16-fase-7-del-paraguas.md:137` (paso 3; se tacha el ⚠️) «cuando la ruta no la atiende ningún
  servidor, se declara y se acepta».
- `16-fase-7-del-paraguas.md:141` (paso 4b; se tacha «vuelve al owner») «un aviso en ese rato se
  declara y se acepta».
- `16-fase-7-del-paraguas.md:178` (se tacha «vuelve al owner») «**se declara y se acepta**, paso 3
  y §4.3».
- `16-fase-7-del-paraguas.md:531` (§4.3, párrafo nuevo con causa, daño y por qué se acepta)
  «puede perderse, y se declara y se acepta».

### D · la tabla de paso de las fichas borradas

- `16-fase-7-del-paraguas.md:137` (paso 3) «la migración copia a una tabla de paso» y «leyendo la
  tabla de paso que la migración llenó».
- `16-fase-7-del-paraguas.md:144` (paso 5b; se tacha el ⚠️) «y el 5b saca la lista de lo que borra
  de la tabla de paso».
- `16-fase-7-del-paraguas.md:380` (dueño: `V6`) «Y la tabla de paso de las fichas borradas».

### E · guards 33 → 34

- `16-fase-7-del-paraguas.md:775` (fila de `U2`) «~~33~~ 34 guards», con el guard nuevo nombrado
  (el control del SQL generado del catálogo y de la tabla de claves de `V1`) y tachado «y la FASE 5
  no agrega ninguno», que dejó de ser cierto.

### H · las seis columnas de `partners`

- `16-fase-7-del-paraguas.md:713` (§4.6, lista de `U1`) «las seis del cobro viejo».
- `16-fase-7-del-paraguas.md:715` «quedan hasta la unidad de socios».

## 3. Lo que no se aplicó y por qué

- **L**: ni `16-` §4.6 ni la lista de `U1` nombran `impersonate`, `set-role` ni el plugin `admin`
  (`rg` sin resultados en los tres archivos). La decisión cae en `V5`.
- **F, G, I, J, K**: ninguno de los tres archivos los menciona.
- **E en `11-` y `spec.md`**: ninguno cuenta los guards (sólo `11-:196` nombra `G1`…`G11` sin
  total).
- **`spec.md`**: ya dice *«Ninguna pregunta del owner queda abierta»*; con este lote vuelve a ser
  cierto, sin cambio.
- **D, *«el backup la incluye»***: se escribió en su forma exacta en el tiempo, no literal. El
  backup del 2b es **anterior** a la migración del paso 3, así que no contiene la tabla de paso; lo
  que la cruce quiso decir (un aborto restaura fichas y tabla juntas, coherentes) se cumple igual:
  el 2b trae las fichas sin la tabla, y la migración del reintento la vuelve a llenar
  (`16-:144`). *(Lo derivé y lo marco; no elige nada.)*

## 4. Para otro dueño

- `$V` (dueño de `V6`): la herramienta del corte de `V6` gana las cinco pruebas con seudónimo (B) y
  la tabla de paso (D: la llena la migración estructural del paso 3, la recorre y la borra el 5b).
  Si `V/21` §2.4 o la descomposición de `V6` describen el 5b leyendo filas de fichas, o las pruebas
  escritas por el script suelto, hay que alinearlos. Texto propuesto: *«Antes de borrar las fichas
  que no son de las cinco, la migración copia a una tabla de paso el id de cada una, las rutas de
  sus fotos y su token de calendario; el 5b la recorre y la borra al terminar (FASE 5, lote de la
  aplicación, owner 2026-09-30, D).»*
- Dueño de la lista de guards (`V/20` §2): el control que regenera y compara el SQL generado del
  catálogo y de la tabla de claves cuenta como guard: 34 (E).
- Dueño del log (`DEC-MIG-007`): A queda contra la recomendación; si el log registra el aborto, que
  diga que la regla del 0b queda puesta hasta el reintento.

## 5. Vuelve al owner

Nada: ninguna letra obligó a elegir algo no decidido.

## 6. Conteos

- `rg -o -F "lote de la aplicación, owner 2026-09-30" docs/16-fase-7-del-paraguas.md | wc -l` → 15
  orígenes escritos.
- `git diff --stat -- docs/16-fase-7-del-paraguas.md` → 32 inserciones, 11 borrados.
- `npx markdownlint-cli2 docs/16-fase-7-del-paraguas.md`: 0 antes (sobre `HEAD`), 0 después.

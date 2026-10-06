---
title: "FASE 9 completa · salida 3 — las sub-specs de billing, recorridas enteras"
linear: HOS-1352
statusSource: linear
created: 2026-09-25
updated: 2026-09-25
status: CURRENT
fase: 9
---

# FASE 9 completa — salida 3 de `DEC-METH-004`: `HOS-1354/spec.md` y `descomposicion.md`

Carril: `B/spec.md` y `B/descomposicion.md` (`HOS-1354-billing-cobro-y-proveedor/`), y este
registro. Se recorrieron **enteros** contra las decisiones del owner de
[`10`](./10-decisiones-del-owner.md), los registros `11`, `12`, `13`, `15`, `16` y `17`, el
consolidado `25-fase-8-completa/00-hallazgos.md` §5 y las entradas del log del 2026-09-24/25
(`DEC-MP-005` a `DEC-ARCH-011`). No se tocó ningún capítulo, el log, la matriz, el núcleo, el
contrato ni la otra épica. No se commiteó. Las líneas son las del texto **después** de editar.
Lo que cambió de sentido quedó tachado con `~~…~~`; lo nuevo lleva *«owner 2026-09-25»* cuando es
una decisión del owner y *«FASE 9 completa, salida 3»* cuando es corrección o asignación de esta
pasada. `updated: 2026-09-25` en los dos. `markdownlint-cli2` con la config del repo: **0 issues**;
tachados balanceados por párrafo y por fila: **0 desbalanceados**.

## 1. El hallazgo que ordena el resto

**Las dos sub-specs describían el estado de la mañana del 2026-09-24.** Las dos seguían diciendo
que la pasarela no estaba decidida, que el capítulo 13 era el único sin escribir, que **B6 era la
unidad sin diseño** y que la construcción entera esperaba la PRUEBA 0 y la cuenta de Mobbex. Ese
mismo día `DEC-MP-005` fijó Mercado Pago, `DEC-MP-006` puso el reloj del lado del proveedor, el
13 se repartió (`nucleo/00-indice.md`) y `DEC-RF-007` sacó a `RF-3` del camino. **Nadie volvió a
leer la descomposición** — los agentes de la FASE 9 completa la tocaban por partes —, así que
B6 seguía 🔒 en cinco lugares (§1.2, §2, §2.3, §3, §3.1, §4, §5), y su criterio de terminación
decía *«no se puede redactar todavía»*.

## 2. Cambios, por archivo

### `spec.md`

| línea | qué | cierra |
|---|---|---|
| 6 | `updated` | — |
| 17-28 | recuadro de apertura: *«uno sin escribir… quién tiene el reloj»* tachado → 13 repartido, `DEC-MP-005`, `DEC-MP-006` | salida 3 (estado del 24/09) |
| 30-44 | §1 retitulado *«Qué la bloqueaba, y ya no»*; recuadro ✅; *«No es el diseño…»* y *«sigue sin decidirse»* tachados | `DEC-MP-005`, `DEC-MP-006` |
| 61 | `03`: ~~siete~~ **ocho** (Suscripción `S1`–`S35`, …, **Reembolso** §6.1, …) | 5a, `DEC-RF-008` (máquinas 9→10 en el programa) |
| 64 | `09`: ~~tres~~ **cuatro** modos de «cero cobros» | `B/09` §4 reescrito el 24/09 (`RC-5`) |
| 68 | `16`: los addons siguen a su título | 4a, 4c, 4d, 4e (`DEC-ADDON-007`) |
| 71 | `21`: no se migra; de su billing no se conserva nada | 2a, 2d, 2g (`DEC-MIG-005`) |
| 180-184 | §4: la fuente `GRANT` lleva `piso`; siete campos; sigue siendo un puntero | 9h |
| 196-200 | §5.1: *«el único de los 22 sin escribir»* tachado → repartido, con dónde | 13 repartido |
| 219-251 | §5.2: *«ocho filas `UNKNOWN`»* → **seis**, recontadas (98 · 55/14/23/6); tabla nueva con qué condiciona cada una; el párrafo *«con el reloj nuestro…»* tachado | matriz del 25/09; 3a, 3c, `DEC-SUB-020`, `DEC-RF-007` |
| 269-288 | §7: los tres pedidos al owner tachados (sin objeto); lo que sí le queda: pedir la habilitación de pagos automáticos (`DEC-MP-006` cláusula 1) y medir `GR-1` (3a) | salida 3; 3a |

### `descomposicion.md`

| línea | qué | cierra |
|---|---|---|
| 6 | `updated` | — |
| 19-48 | recuadro ✅ nuevo; el *«⛔ Antes de empezar…»* retitulado y tachado donde dejó de ser cierto; *«Qué la destraba»* tachado | `DEC-MP-005`, `DEC-MP-006` |
| 78-81 | §1.1: el 13 contestó lo mismo que hace MP; el reparto no se redibujó | `DEC-MP-006` |
| 91 | §1.2: B6 *«← la única bloqueada»* → ya no | ídem |
| 115 | §1.3 regla 3: ~~veinte~~ **veintidós** marcas | 3d, `F-8CB2-003` |
| 129 | **B3**: `S1` exige `admiteAltas` (alta y sucesión); preapproval sin plan del proveedor; capítulo `10` §4.6 | 6a, `DEC-MP-007` |
| 130 | **B4**: siete campos (`cobrada`, `piso`); vertical discontinuada no cubre; capítulos contrato §2, §2.6 | 9h, `R11` |
| 131 | **B5**: `RF1`, `RF4`, acción 14; `S29`; `MP3` tercera cláusula; capítulos `03` §6.1, `S29` | 5a, 8f; `S29` sin unidad |
| 132 | **B6**: ~~BLOQUEADA, sin diseño, `13` sin escribir~~ → `RF2`/`RF3`/`RF5` sobre `06` §4.6, sin reloj nuestro, `DEC-RF-007`; 🔒 tachado | `DEC-MP-006`, `DEC-RF-007`, 5a |
| 133 | **B7**: `S6` cancela el preapproval; sucesora de 3c al grace con la relectura diaria; 9a; marca 21; capítulos **`09` §3 (esas filas) y §6.2** | `DEC-SUB-019`, `DEC-MP-008`, `DEC-SUB-020`, 3c, 9a, 3d |
| 134 | **B8**: desde `GRACE_PERIOD` no se declara sucesión | `DEC-SUB-021` |
| 135 | **B9**: canje bajo el piso se rechaza; `S34`, `S35`; `piso` del `GRANT` | 4b, 9g, 9h; `S34`/`S35` sin unidad |
| 136 | **B10**: los addons siguen a su título; `S32`, `S33` en la columna | 4a, 4c, 4d, 4e, `K-9`; `S32`/`S33` sin unidad |
| 137 | **B11**: precondición de re-vinculación | 2b |
| 138 | **B12**: `S25` (sin unidad hasta hoy) y la invalidación del caché el día del fin de servicio; ~~S26–S28~~ S25–S28 | 6b; `S25` sin unidad |
| 139 | **B13**: 3a, 3b, 6c, 6a, acción 14 | 3a, 3b, 6c, 6a, 5a |
| 144-156 | párrafo nuevo: **las 35 transiciones de la Suscripción, cada una con su unidad** | salida 3 (verificación S1–S35) |
| 183-196 | §2.3: recuadro ✅; tabla tachada (0 / 0 / 13) y la frase *«Doce de trece…»* tachada | `DEC-MP-005`, `DEC-MP-006` |
| 233 | *«Política y forma»*, fila B9: ~~un 100 % es una cortesía~~ → canje bajo el piso se rechaza; la columna de forma pierde sujeto | 4b, 9g (pendiente `15` §4 (8), `17` §5) |
| 240-257 | B6 ya tiene columna izquierda; *«Lo que sí conviene hacer mientras tanto»* tachada entera | `DEC-MP-006` |
| 262-264 | *«lo que no conviene»* sigue valiendo, con el adaptador de MP detrás de la interfaz | `DEC-MP-005` |
| 274-289 | §2.4: *«Eso es el 13, y arrastra `RF-3`»* tachado → qué queda de ejecutar y quién | 13 repartido, `DEC-RF-007` |
| 303, 327-335 | §2.6: ~~SEIS~~ **OCHO** dependencias; filas 7 (B3 lee `admiteAltas`) y 8 (B4 lee `finDeServicio`) | 6a; `F-8CC1-001` (contrato §4.1 ya las nombraba) |
| 354-380 | §2.7: ~~ocho~~ **seis** `UNKNOWN`, tabla recontada; ⚠️ lo que queda abierto sobre el §61 y B7 (ver §4) | matriz del 25/09 |
| 445-450 | §2.8 `G-R1-F`: ~~once~~ **doce** motivos de `S14` (el 22) | `F-8CB2-003` |
| 453 | ~~veinte~~ **veintidós** motivos | recuento |
| 461-463 | ~~nueve de los veinte~~ **diez de los veintidós** abren otros actos (el 21, con B7) | 3d |
| 528 | §2.9: ~~cinco~~ **seis** hechos | 5b (pendiente de `11` §5, `17` §5) |
| 544-548 | §2.9: ~~diez~~ **once** consumidores de *«cortesía diferida»*, repartidos por unidad | `S31` en `N/01` §2.6 |
| 564-578 | §3: grafo (B6 con diseño), fila *«en paralelo»* suma B6, *«sin diseño»* y *«lo único que arranca hoy»* tachados | `DEC-MP-006` |
| 600-612 | §3.1: recuadro ✅; fila `S18` ~~B7~~ **B8** (error de la tabla, `S18` es de B8); fila del reembolso por el proveedor ~~no~~ **sí**; el reembolso a mano se asienta por `RF4`, que construye B5 | salida 3; 5a |
| 645-647 | §4: ~~30~~ **31** guards, 30 repartidos, **`G-R2-C` sin unidad** | 4e (recuento `B/20` §2) |
| 690-700 | criterios de terminación de B3, B4, B5, **B6 (redactado)**, B7, B8, B9, B10, B11, B12 y B13 | ver §3 |
| 718 | §5: B6 ~~🔒~~ | `DEC-MP-006` |
| 742-745 | §6: el modelo canónico de cobro ~~no se contesta~~ → decidido | `DEC-MP-006` |
| 752-753 | §6: ~~seis~~ **cinco** preguntas legales de esta épica | C-11 (`B/22` §4) |

## 3. Qué quedó viejo en los criterios de terminación (§4), y por qué importa

- **B6** decía *«no se puede redactar todavía»*: la pregunta del reloj se contestó el 24/09. Se
  redactó sobre `B/06` §4.6 y `B/03` §6.1: clave persistida antes, `EXECUTED` sólo por relectura,
  el `2084` no marca como no reembolsable, y pasado el plazo la operación no se ofrece.
- **B7** decía *«un primer cobro rechazado no da grace»* sin la excepción de 3c: una
  implementación que lo cumpliera al pie de la letra **dejaba sin nada a Juan**, que es exactamente
  lo que `DEC-SUB-022` vino a impedir. Se agregaron también `DEC-SUB-019`, 9a y 3d.
- **B8** pedía que *«la redención de promo termine colgando de la sucesora, con el descuento vuelto
  a aplicar»*: **la FASE 8 completa (`R6`, pendiente 7) decidió que la promo se pierde en todo
  cambio de plan** (`B/02` §2.6, `B/14` §2.2). El criterio exigía construir lo contrario del diseño
  vigente. Tachado; se agregó `DEC-SUB-021`.
- **B9** pedía que *«un descuento que deja el monto bajo ARS 15 pause en vez de mutar»*: 4b lo
  invirtió (se rechaza al canjear). Mismo defecto: el criterio pedía lo revertido.
- **B10** decía *«donde el objetivo nunca murió»* para `USER`/`GLOBAL`: 4d lo desmiente (`B/16`
  §3.3). Se agregaron 4a, 4c, 4d, 4e y `K-9`.
- **B3**, **B4**, **B5**, **B11**, **B12**, **B13**: se agregó lo que las decisiones del 25/09 les
  asignan (6a; 9h y `R11`; 5a; 2b; `S25` y 6b; 3a, 3b, 6c, 6a y la acción 14).

## 4. Verificación: cada decisión y regla nueva tiene quien la construya

| decisión / regla | unidad | nota |
|---|---|---|
| `S1`–`S35` | todas con unidad (§2, párrafo nuevo) | **`S25` y `S29` no figuraban en ninguna fila**; `S32`–`S35` no existían. Asignación de esta pasada: `S25` → B12, `S29` → B5, `S32`/`S33` → B10, `S34`/`S35` → B9 |
| `RF1`–`RF5` (5a) | `RF1`, `RF4` → B5; `RF2`, `RF3`, `RF5` → B6 | la máquina es de registro; lo que va al proveedor es de B6 |
| acción administrativa 14 (5a) | B5 (el acto) · B13 (la superficie de Admin) | |
| 3c (`DEC-SUB-022`) + el control del barrido | B7 | el control vive en `B/09` §3; se asignó a B7 con el precedente de B9/B10 |
| 9a (el barrido corre `S4`) | B7 | ídem |
| 3d (marca 21, `B/09` §6.2) | B7 | ídem |
| 4a (`S32`, `S33`) | B10 | |
| 4b / 9g | B9 (regla) · B13 (pantalla, `B/19` 7-bis) | |
| 4c, 4d, 4e, `K-9` | B10 | 4e del lado billing; el guard gemelo es `G-R2-C` (ver abajo) |
| 6a (`S1` y la pricing) | B3 · B13 | dependencia nueva B3 → `V2` (`admiteAltas`) |
| 6b (invalidar el caché el día del fin de servicio) | B12 | lo ejecuta el barrido del día de `B/10` §4.3; el caché es de verticales (`V/02` §3.2) |
| 6c (el botón inteligente) | B13 (`B/19` fila 21) | `T8` es de verticales |
| 8f (`MP3` tercera cláusula) | B5 | |
| 9h (`piso`) | B4 (el campo) · B9 (lo llena, con los grants) | el juego único §6.2 necesita un caso `GRANT` con piso (criterio de B4) |
| 2b (re-vinculación) | B11 (`B/09` §2.4) | |
| `DEC-SUB-019`, `DEC-MP-008`, `DEC-SUB-020` (`S6`) | B7 | `P6`/`P7` → B5; `S12` segundo evento, `S31` → B8 |
| `DEC-SUB-021` | B8 | |
| `DEC-MP-007` | B3 | |
| **bit de moderación de Partner, clave de carrusel, invalidación por `user`, reconciliador de cobertura, lock por `user + vertical`, `PURGED`/`MODERATED`, `T8`, 7a, 8b–8e** | **ninguna de billing** | son de la épica de verticales (`V/17`, `V/18`, `V/02` §3.2, `V/03` §2 y §9); no piden unidad acá |
| **`G-R2-C`** | **sin unidad** | vive en `V/20` §2; su unidad natural es `V3` (con `G-R2-B`); la asignación es de `V/descomposicion.md`. La descomposición de billing lo cuenta en su §4 |
| **2c, 2e, 2f** (el corte: sólo hacia adelante, backup, completitud) | **ninguna unidad** | son pasos del corte (`D/16` §4.2), no construcción de billing. **`B/21` no es capítulo de ninguna unidad de B1–B13**, y no lo era antes de hoy: lo dejo dicho, no lo asigno (ver §6) |

**Citas por § verificadas**: cada § que la descomposición cita —`B/02` §2.2–§2.6, `B/03` §3.1–§3.4,
§4, §5, §6, §6.1, §7, §8, §10, `B/05` §1/§3/C1–C6, `B/06` §4.6, `B/09` §2.4/§3/§4/§6.2,
`B/10` §4.3/§4.6, `B/12` §1–§7, `B/14` §1.3/§2.2/§4.4, `B/16` §3.3/§3.4/§4.2–§4.4, `B/19` §4/§6,
`B/20` §2/§3.2, `B/22` §1/§4, contrato §2/§2.6/§2.7/§4.1/§5.2/§6, `N/01` §1.2/§2.4–§2.6— existe
con ese número (`rg -n "^#{1,4} "` sobre cada capítulo).

## 5. Lo que NO apliqué, y por qué

- **Si el §61 exige cerrar `RN-3`, `GR-1` y `GR-2` antes de declarar terminada B7.** `DEC-MP-006`
  las declaró *«bloqueantes»* de diseño; después el diseño del grace se escribió sobre ellas
  (`DEC-SUB-019`, `-021`, `-022`) y `GR-1` quedó condicionando lo que se promete (3a). **Ninguna
  decisión dice si bloquean la terminación de B7.** Lo dejé dicho en `descomposicion.md` §2.7 y no
  lo decidí: **es para el owner**, con la forma de `DEC-RF-007` como precedente.
- **Las asignaciones de esta pasada** (`S25` → B12, `S29` → B5, `S32`/`S33` → B10, `S34`/`S35` → B9,
  las filas del barrido de 9a/3c/3d → B7, `RF` partido entre B5 y B6) están marcadas como
  *«propuesta, no decisión del owner»*. La alternativa real para las del barrido es B11 (tiene el
  `09` entero), pero obligaría a mover B11 detrás de B7 en el grafo; con B7 el grafo no cambia.
- **No renumeré secciones** de la descomposición: `V/descomposicion.md`, `B/20` y `N/01` citan
  §2.1, §2.6, §2.8, §2.9 y §3.

## 6. Citas fuera del carril, con el texto propuesto

- **`V/descomposicion.md:193-195`**: *«`B/descomposicion.md` §2.3 mide que hoy «lo único que
  arranca es B2 y la interfaz de B1»»* → esa medición quedó tachada el 25/09 (la pasarela está
  decidida). Propuesta: *«…y en `B/descomposicion.md` §3 las primeras unidades de billing son B1 y
  B2, ninguna de las dos con tabla de transiciones»* — la conclusión del párrafo no cambia.
- **`V/descomposicion.md`**: asignar unidad a `G-R2-C` (`V3`, con `G-R2-B`), como ya piden `15` §4
  (7) y `17` §5. Con eso `B/20` §2 vuelve a *«sin unidad: 0»* y el §4 de la descomposición de
  billing tiene que volver a decir *«los 31 repartidos»*.
- **`B/02` §2.5, fila 22**: `15` §2 dice que si falla el `PUT` del complemento en `S32` se abre la
  marca 22, pero la columna *«quién abre la marca»* de la fila 22 nombra sólo `S8` y `S9`. Si `S32`
  la abre, falta agregarlo ahí (y `S14` seguiría en doce: es el mismo motivo). Carril billing.
- **`B/22` §2.2 / el botón de arrepentimiento**: `RF1` nace de *«la persona revoca dentro de los 10
  días»*, y **ninguna unidad tiene `B/22` §2** en su columna (B13 tiene sólo el §1). Hoy la pregunta
  4 del pliego lo deja fuera de alcance; si el owner lo mete, necesita unidad (B13 es la natural).
- **`B/21`**: no es capítulo de ninguna unidad. Lo que construye billing de ahí (la re-vinculación,
  2b) vive en `B/09` §2.4 y va con B11; el resto es el corte del paraguas (`D/16`). **Si el
  orquestador quiere que la descomposición lo diga**, texto propuesto para su §6: *«`B/21` no es de
  ninguna unidad: su regla de re-vinculación está en `B/09` §2.4 (B11) y el corte es del paraguas
  (`D/16` §4.2)»*.
- **Históricos con la cifra vieja de la matriz** (89 filas, 8 `UNKNOWN`): `04-open-decisions.md:156`
  y `:326`, `10-evaluacion-de-proveedor.md:39-40`, `03-handoff.md:1075`, `:1262`. Son de fecha; no
  piden corrección salvo que el orquestador quiera una nota.

## 7. Issues de Linear que quedan desactualizados (para la salida 4)

Inferido de lo que cambió en la sub-spec; **no releí las fichas ni los issues**.

| issue | unidad | qué está viejo |
|---|---|---|
| `HOS-1354` | épica | la pasarela y el reloj *«sin decidir»*, el 13 *«sin escribir»*, *«8 `UNKNOWN`»*, los pedidos al owner (PRUEBA 0, Mobbex) |
| `HOS-1369` | **B6** | **todo**: dice bloqueada y sin diseño; hoy es `RF2`/`RF3`/`RF5` sobre `B/06` §4.6, sin reloj nuestro, con criterio redactado. Quitar 🔒 y el estado bloqueado del tablero |
| `HOS-1370` | B7 | criterio *«un primer cobro rechazado no da grace»* sin la excepción de 3c; faltan `DEC-SUB-019`, 9a, 3d y las filas del barrido que ahora le tocan |
| `HOS-1371` | B8 | criterio que re-apunta la redención de promo (revertido por `R6`); falta `DEC-SUB-021` |
| `HOS-1372` | B9 | criterio *«bajo ARS 15 pausa en vez de mutar»* (revertido por 4b); faltan `S34`, `S35` y el `piso` |
| `HOS-1373` | B10 | faltan `S32`, `S33`, 4c, 4d, 4e y `K-9`; *«el objetivo nunca murió»* |
| `HOS-1368` | B5 | faltan la máquina de `refund` (`RF1`, `RF4`), la acción 14, `S29` y `MP3` 8f |
| `HOS-1366` | B3 | falta `S1` con `admiteAltas` (6a) y `DEC-MP-007` |
| `HOS-1367` | B4 | faltan `piso` (siete campos) y el caso `GRANT` en el juego único; la vertical discontinuada |
| `HOS-1374` | B11 | falta la precondición de re-vinculación (2b) |
| `HOS-1375` | B12 | faltan `S25` y la invalidación del caché el día del fin de servicio (6b) |
| `HOS-1376` | B13 | faltan 3a, 3b, 6a, 6c y la acción 14 |
| el tablero | — | calcula *«lista»* con B6 bloqueada y con *«B2 es lo único que arranca»* |

## 8. Listas cerradas recontadas

Comando, sobre los dos archivos y **quitando lo tachado de cada línea antes de buscar**:

```text
python3 - <<'EOF'
import re
pats=[r'(cuatro|cinco) hechos', r'(doce|trece) acciones', r'(siete|ocho|nueve) máquinas',
      r'(quince|dieciséis|diecinueve|veinte|veintiún) (motivos|marcas)', r'S1[–-]S(2\d|3[0-4])\b',
      r'T1[–-]T[1-7]\b', r'(cinco|seis) campos', r'(ocho|8) filas .?UNKNOWN', r'\b(29|30) guards',
      r'diez de .cortesía', r'\bSEIS\b']
for f in ['spec.md','descomposicion.md']:
    for i,l in enumerate(open(f),1):
        s=re.sub(r'~~.*?~~','',l)
        for p in pats:
            for m in re.finditer(p,s): print(f,i,m.group(0))
EOF
descomposicion.md 694 SEIS     ← las seis ramas de B/12 §5.3, otra lista: correcta
```

| lista | valor vigente | en mis archivos |
|---|---|---|
| hechos del reloj | 6 (+ `C`) | corregida `descomposicion.md:528` |
| acciones administrativas | 14 | ninguna cita del número; nombrada como *«la acción 14»* |
| máquinas | 10 en el programa; **7 + la regla** en `B/03` | `spec.md:61`: siete → ocho (las siete máquinas de billing más la regla) |
| motivos de marca | 22 (7 SÍ) | `descomposicion.md:115`, `:453`, `:461-463`; `S14` 12, otros 10 |
| suscripción | `S1`–`S35` | párrafo nuevo con las 35 y su unidad |
| trial | `T1`–`T8` | sin citas en mis archivos |
| firma del contrato | 7 campos | `spec.md:180-184` |
| filas de la matriz | 98 · 55 / 14 / 23 / 6 `UNKNOWN` | `spec.md` §5.2, `descomposicion.md` §2.7 (`contar-filas-de-la-matriz.py`) |
| guards | 31 distintos, 30 con unidad | `descomposicion.md:645-647` (recuento de `B/20` §2) |
| dependencias con verticales | 8 (antes 6) | `descomposicion.md` §2.6 |
| consumidores de *«cortesía diferida»* | 11 (`N/01` §2.6) | `descomposicion.md:544-548` |
| preguntas legales de esta épica | 5 | `descomposicion.md:752-753` |

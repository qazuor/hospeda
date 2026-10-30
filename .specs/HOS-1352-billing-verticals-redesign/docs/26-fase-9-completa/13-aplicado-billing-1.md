---
title: "FASE 9 completa · aplicado en billing, carril 1"
linear: HOS-1352
statusSource: linear
created: 2026-09-25
updated: 2026-09-25
status: CURRENT
fase: 9
---

# FASE 9 completa — aplicado en billing, carril 1

Carril: todo `B/*` salvo `B/21`, `B/14`, `B/16` y las sub-specs. Fuente de las decisiones:
[`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md). No se tocó el log, la matriz, el
núcleo, el contrato ni ningún archivo fuera del carril. Las líneas son las del texto **después** de
aplicar. `updated:` pasó a 2026-09-25 en los diez archivos tocados.

## 1. Cambios, por archivo

### `B/02-modelo-de-datos.md`

| línea | qué | cierra |
|---|---|---|
| 303-306 | *«Ninguna regla la lee»* tachado → *«una sola regla la lee: el corte de la ventana de `B/12` §5.4»* | C-R7-4 (`04`) |
| 327 | `refund`: estados de la máquina mínima, por dónde se ejecutó y quién lo asentó; sólo `EXECUTED` suma al acumulado | 5a |
| 427-429 | `RN-3` degradado a *«observado el 2026-09-24, no registrado en la matriz»* | C2 (`01`) |
| 498 | `permanent_grant_vertical`: FK compuestas plan↔vertical y piso↔plan | C-3 (`09`) |
| 868 | título del §2.5: veinte → veintidós motivos | 3d, `F-8CB2-003` |
| 880-883 | nota de recuento (21 y 22) | ídem |
| 888, 901-908 | *«otras diecinueve»* → veintiún; `S14` abre 12 de 22; otros actos 10 | recuento |
| 927 (fila 16) | *«antes de la tercera»* → *«antes de los 3 días»* | C-R5-5 (`04`) |
| 929 (fila 18) | el asiento por la acción administrativa 14 y `RF4` | 5a, C-R7-1 |
| 930 (fila 19) | asentar = crear `payment` en `PENDING` y correr `P1`, con la acción 14 | 5a, C-R7-1 |
| 932-933 | filas nuevas **21** `COBRO_DEL_PERÍODO_SIN_RESOLVER` y **22** `PAUSA_NO_APLICADA` | 3d, `F-8CB2-003` |
| 969 | *«tiene veinte»* → *«tuvo»* (histórico) | recuento |
| 980-988 | párrafo de recuento: 22 filas; 7 SÍ, 3 puede, 12 no; `S14` 12, otros 10 | recuento |

### `B/03-maquinas-de-estado.md`

| línea | qué | cierra |
|---|---|---|
| 56 | `CHARGE_DECLINED`: *«lo canceló el proveedor»* → *«`S16` la canceló, de nuestro lado o ya el proveedor»* | C-R12-2 (`07`) |
| 71-76 | nota sobre la premisa de §3.1 y la excepción 3c a la lectura «por autorización» | C-R12-2, 3c |
| 86-98 | salidas de `SUSPENDED`: preapproval ya cancelado con tarjeta; **cinco** salidas (la sucesión de `G-R1-A`) | C6 (`01`) |
| 118-123 | veinte → veintidós marcas | recuento |
| 141 (`S1`) | exige `admiteAltas` para alta y sucesión; mensaje *«esta vertical ya no admite altas»* | 6a |
| 144 (`S4`) | rama de la sucesora cuya predecesora venía pagando → `S4`; relectura diaria y `S6` en el acto sobre `cancelled`/`paused` | 3c |
| 146 (`S6`) | cuarto evento `MP2`; quinto evento `cancelled` sobre la sucesora de 3c; *«todavía no se sabe»* → marca 21 a los 3 días; guarda de sucesión por eventos 1, 2, 4, 5; correo `failed` no bloquea; aviso *«volvé a suscribirte»* | C8, 3c, 3d, decisión 1 |
| 148-149 (`S8`, `S9`) | `PUT paused` confirmado por relectura; si no, no ocurre y marca 22 (en `S9`, aviso a `SUPER_ADMIN`) | `F-8CB2-003` |
| 151 (`S11`) | `RN-3` degradado | C2 |
| 154 (`S14`) | once de veinte → doce de veintidós | recuento |
| 156 (`S16`) | guarda complementaria de `S4` con la excepción de 3c | 3c |
| 157 (`S17`) | correo `failed` no bloquea | decisión 1 |
| 208 | §*«el primer rechazo…»*: la excepción de la sucesora | 3c |
| 255 | ⚠️ punto 4: el `paused` del proveedor no cede a `S16` | `R12-BORDE-1` (`07`) |
| 264-300 | correo antes de cancelar: **tres** ramas (la tercera, `failed`); `A3` en la salvedad 1 y en la población (*«`A3`, `A5` y `A6`»*) | decisión 1, C-R5-2 |
| 322-324 | precisión 1: *«en toda fila»* | C-R5-4 |
| 334-346 | precisión 3: la fila `failed` es la tercera rama; en `S6`/`S17` el correo se encola en transacción propia con el hecho que dispara | decisión 1, C-R5-1 |
| 502 | `CHARGE_DECLINED` en el cierre de la sucesión | C-R12-2 |
| 785 | `S25`: la cobertura no vuelve por un alta nueva en vertical discontinuada | 6a, contradicción 3 de `06` |
| 804, 1887, 1996-2001, 2022, 2091, 2398 | acciones administrativas trece → catorce | recuento (5a) |
| 1448, 1466 | §3.3.1: *«cambiá tu tarjeta»* condicionado a `GR-1`, sin prometer | 3a |
| 1547-1583 | §4: guarda de la sucesión salvo el tercer evento; salvedad del 2.º evento cerrada; sucesora de 3c con su control; *«cuándo entra»*, *«cómo sale mal»* y *«qué se puede hacer adentro»* (condicionado a `GR-1`) | C4, 3c, C8, 3a |
| 1756-1784 | **§6.1 nuevo**: máquina mínima de `refund` (`RF1`-`RF5`, cuatro estados) | 5a (y productor para `DB-4`) |
| 1795 (`MP2`) | declarado como cuarto evento de `S6`, sólo en grace | C8 (`F-8CB2-009`) |
| 1796 (`MP3`) | tercera cláusula: las diez salidas → `DECLARED_UNPAID` sin efecto | 8f |
| 2452 (`A3`) | relectura y cancelación con correo, como `S3` | C-R5-2 |
| 2657-2704 | §10.1: `authorized`×`ACTIVE`, `paused`×`PAUSED`, `cancelled`×terminal (nada); `authorized`×`PAUSED` exige pausa confirmada; `cancelled` sobre la sucesora de 3c es `S6`; once → catorce filas; §10.2 *«sobre el mismo recurso»* | C-4 (`09`), `F-8CB2-003`, 3c, `DB-2` |
| 2857-2885 | «NO cierra»: R3-c, `S6`/`S17` sin plazo transitorio, contracargo sobre `SUSPENDED` con sucesión, grace de la sucesora de 3c hasta un día | bordes R3-c (`01`), R5.5.2-1 y R7.5.2-3 (`04`), 3c |

### `B/05-idempotencia-y-concurrencia.md`

| línea | qué | cierra |
|---|---|---|
| 164-170 | `C3`: la reintenta el barrido 3 días y abre el 16 | C-R5-6 |
| 273-277 | `S7` puede ir a `CANCEL_SCHEDULED` | C7 (`01`) |
| 284 | *«otros doce»* → veintiún motivos | recuento |
| 300 | fila 1 del desempate: toda transición a `CANCELLED` salvo *Free Forever*, con `S21`, `S25`, `S27`, `S31` | C-5 (`09`) |
| 427-438 | «NO cierra»: el capítulo 13 no existe; `RF-3`/`DEC-RF-007` y `RF4` | C-R7-5 |

### `B/06-proveedor.md`

| línea | qué | cierra |
|---|---|---|
| 239 | el camino manual del reembolso tiene acto (`RF4`) | 5a |
| 408 | `RN-3` leído el 2026-09-24; no bloquea | C11 (`01`) |
| 409 | `GR-1` condiciona la salida de `DEC-SUB-021`; se mide con el próximo rechazo mensual | 3a |
| 421 | *«tres de las cinco»* → cuatro de las seis | C11 |

### `B/09-conciliacion.md`

| línea | qué | cierra |
|---|---|---|
| 71-82 | §2.4: precondición de re-vinculación; otro desconocido abre el motivo 6 | 2b |
| 99-107 | veinte → veintidós motivos | recuento |
| 126-135 | §3: la sucesora en grace de 3c se relee y corre `S6` sobre `cancelled`/`paused` | 3c |
| 170 (lápida) | la canceló el viejo en 1b y la verificó el paso 2; sigue en la salvedad 4 | C-6 (`09`), `CT-2` (`02`) |
| 177, 180 | `A3` en la salvedad 1 | C-R5-2 |
| 180 | *«`S3`, `S23`, `S24`, `S27`, `S28` y `S31` entran sólo cuando hubo llamada»* | C-R5-4 |
| 187, 195 | reintento: tres ramas del correo; lápida sin transición y sin correo | decisión 1, C-R5-3 |
| 611 | selección de pagos acreditados incluye `PARTIALLY_REFUNDED` | C-R7-3 |
| 782-790 | §6.2: a los 3 días, marca 21 | 3d |
| 805-809 | *«toda búsqueda de suscripciones»* y sus dos excepciones | C-R7-2 |
| 876 | «NO cierra»: la nota de la corrida + marca a los 3 días | 3d |
| 927-938 | «NO cierra»: `COBRO_DUPLICADO` casi sin población; fila que falla siempre | bordes R7.5.2-1 y -2 (`04`) |

### `B/10-verticales-planes-billing-options.md`

| línea | qué | cierra |
|---|---|---|
| 149-154 | día 0: `S1` exige `admite_altas`; la pricing deja de ofrecer | 6a |
| 383-386 | §4.6: quién lee `admite_altas` en billing (`S1`) | 6a, contradicción 4 de `06` |

### `B/12-suscripcion.md`

| línea | qué | cierra |
|---|---|---|
| 46-51 | el reloj cuenta desde la lectura, no desde la fecha del rechazo | borde R1-b (`01`) |
| 54 | fecha de la regla nueva: 2026-09-25 | C13 |
| 63-70 | *«los reintentos caen dentro del grace»* invertido; lo que se resigna | C3 |
| 145-153 | §1.5: la ventana mensual sí cambia el diseño; salida condicionada a `GR-1` | C3, 3a |
| 272-288 | §4.3: la sucesora cuya predecesora venía pagando va a `S4`, con el control del barrido | 3c |
| 304 | nota sobre la premisa *«el proveedor ya canceló»* | C-R12-2 |
| 329-333 | *«días y no minutos»* → minutos de `PA-3`; ⚠️ remitido al «NO cierra» | C5, R8-a |
| 395-397 (§4.5.1) | nota de 3c sobre *«cada reintento muere sin grace»* | 3c |
| 683-690 | veinte → veintidós motivos, diecinueve → veintiún | recuento |
| 863-874 | §5.4: el ⚠️ pasa al «NO cierra»; el `failed` ya no deja cobrando a las dos | R8-b, decisión 1 |
| 1046-1076 | «NO cierra»: `GR-3` ya condiciona; R1-a, R8-a, R8-b | bordes (`01`), 3a |

### `B/19-superficies.md`

| línea | qué | cierra |
|---|---|---|
| 115 | fila **9** nueva: avisos y correos del grace no prometen | 3a |
| 116 | fila 10: *«si tenías una promo, al volver la perdés»* (anotado a mejorar); mismo aviso para la sucesora de 3c | 3b, 3c |
| 128-129 | filas 16 y 16-bis: perdió la cobertura | C-8 (`09`) |
| 131 | fila 17-bis: sin prometer, condicionado a `GR-1` | 3a |
| 136 | fila **20** nueva: *«esta vertical ya no admite altas»* | 6a |
| 198 | acciones administrativas trece → catorce | recuento (5a) |
| 206, 251 | veinte → veintidós motivos | recuento |
| 290-294 | §7 pricing: no ofrece planes de una vertical que no admite altas | 6a |
| 310-320 | «NO cierra»: R3-d; la promo perdida, anotado para el futuro | borde R3-d (`01`), 3b |

### `B/20-testing.md`

| línea | qué | cierra |
|---|---|---|
| 62, 244 | nueve → diez máquinas (la de `refund`) | recuento (5a) |
| 88-99 | `G-R1-A`: la salida con tarjeta condicionada a `GR-1`; nota de 3c | 3a, 3c |
| 463-470 | ⚠️ las mentiras de la conciliación no están en el stub | `DB-3` (`09`) |
| 530 | lista E2E renumerada (8 → 7) | `DB-3` |

### `B/22-lo-legal.md`

| línea | qué | cierra |
|---|---|---|
| 135-139 | *«las seis … las otras tres»* → cinco del pliego, las otras dos | C-11 (`09`) |
| 146 | «NO cierra»: las cinco preguntas de esta épica | C-11 |

## 2. Decisiones que tomé donde el informe dejaba opción (sin decisión del owner)

- **R1-a**: el informe prefería corregir `B/09` para que el barrido corra `S4` sobre un rechazo; lo
  **declaré** en el «NO cierra» de `B/12` (su opción 2), porque la instrucción de este carril es
  declarar bordes y la opción 1 agrega un disparador nuevo a una fila del barrido.
- **R1-b**: apliqué la lectura propuesta (*«desde que lo leímos»*). El informe dice que el owner
  puede preferir la inversa; queda para su OK.
- **C-R5-2**: elegí que `A3` **sí** cancela (la corrección primaria), no la inversa.
- **2b**: el desconocido que no cumple la precondición abre el motivo 6 existente
  (`TRANSICIÓN_NO_DECLARADA`), no un motivo nuevo, para no mover más el catálogo.
- **Nombres de motivos nuevos**: `COBRO_DEL_PERÍODO_SIN_RESOLVER` (21, lo abre el barrido, **no**) y
  `PAUSA_NO_APLICADA` (22, lo abre `S14`, **no**). La numeración de eventos de `S6`: 4.º `MP2`
  (como `01` C8), 5.º `cancelled` sobre la sucesora de 3c.
- **3c, alcance**: *«venía pagando»* = sucesión declarada desde `ACTIVE` o `CANCEL_SCHEDULED` con al
  menos un pago acreditado en la predecesora; no alcanza a la sucesora de una `SUSPENDED` ni al
  pagador manual.
- **5a, forma**: `RF1`-`RF5` en un §6.1 nuevo de `B/03`; `FAILED` cubre también *«la persona no lo
  confirma»*. Con eso las máquinas pasan de nueve a diez.
- **8f**: conté las diez salidas del informe; `S31` ya cierra la primera cuota por la segunda
  cláusula y lo dije.

## 3. Lo que NO apliqué, y por qué

- **4a-4d y las contradicciones del informe `03` salvo `F-8CB2-003`**: fuera de mi carril por
  instrucción.
- **6b (γ, el caché el día del fin de servicio)** y **6c (el botón inteligente y `T8`)**: no están
  entre las decisiones asignadas a este carril, aunque tocan `B/10` §4.3 y `B/19`. Quien las aplique
  necesita escribir en `B/10` §4.3 *«el barrido del día invalida las entradas de la vertical»* y en
  `B/19` §4 la fila del botón.
- **La pantalla de cambio de plan no avisa *«si el primer cobro no entra…»***: era la opción 1 de
  3c; el owner eligió la 2, así que el aviso sobra (lo dije en `B/12` §4.3).

## 4. Citas fuera del carril, con el texto propuesto

**Log (`D/01`)**, para el orquestador:

1. `DEC-MAIL-001`, 📌: *«Un correo obligatorio que agota sus reintentos (`failed` definitivo) no
   bloquea: se cancela igual y se escala como no-entregable, igual que sin destinatario (owner
   2026-09-25; FASE 9 completa, decisión 1).»*
2. `DEC-SUB-021`, 📌: *«La frase "los reintentos del proveedor cobran con ella" está condicionada a
   `GR-1`; se mide con el próximo rechazo mensual real, y la pantalla y los correos del grace no la
   prometen (3a). Y la sucesora declarada en `ACTIVE` o `CANCEL_SCHEDULED` cuya predecesora venía
   pagando va a `S4` y no a `S16` si su primer cobro falla (3c, contra la recomendación).»* Y la
   inversión de `:5197-5198` (*«cae dentro de nuestro grace»*) → *«nuestro grace cae dentro de la
   ventana»* (C3).
3. `DEC-MP-008`, 📌: *«Misma forma para la sucesora en grace de 3c: si el barrido relee su
   preapproval `cancelled` o `paused`, `S6` en el acto, cancelación de nuestro lado y aviso con
   "volvé a suscribirte" (owner 2026-09-25).»*
4. `DEC-SUB-019` `:5064-5065`: `RN-3` como fuente de *«`next_payment_date` avanza sobre un
   rechazado»* → *«observado el 2026-09-24, no registrado»* (C2), o registrarlo en la matriz.
5. `DEC-ARCH-008`, 📌 (C9) y `DEC-CONC-002` 📌, nota al pie *«once el día de la decisión; trece
   hoy»* (C-R5-6).
6. Entradas nuevas o precisiones para 2b, 3b, 3d, 5a, 6a y 8f, si el orquestador las registra.

**Matriz (`D/06`)**: C1 (tachar *«de 24 h»* y *«está bloqueada»* en `GR-3`; el 🚧 de `RC-7`); C2
(`RN-3`, registrar la observación con fecha y sujeto o dejar la degradación); `GR-1`: anotar que
condiciona `DEC-SUB-021` (3a).

**Núcleo**:

- `N/07:225` y `:48-52` (decisión 1): la tercera rama del correo, *«`failed` no bloquea»*.
- `N/08` §3: la fila 14 (5a; asignada a otro carril). `N/08:286-287` (`DB-4`): el reembolso que falla
  sobre una revocación tiene ahora productor, `RF5` → `FAILED` (`B/03` §6.1).
- `N/04:144` (`D17`): el listado `/authorized_payments/search?preapproval_id=` como segunda
  excepción declarada (la mitad de `F-8CB3-004` que la decisión 3d no cubre).
- `N/01:499`: `CHARGE_DECLINED` *«lo canceló `S16`, de nuestro lado o ya el proveedor»* (C-R12-2).
- **Motivos, veinte → veintidós**: `N/01:666`, `N/01:695`, `N/03:41`, `N/04:64`, `N/08:148`,
  `N/08:310`; y `D/03-handoff.md:161` (*«19»*).
- **Máquinas, nueve → diez**: `N/01:356`, `N/00:101`, `N/03:81`; `V/descomposicion.md:185-186`,
  `:204`, `:261`.

**Contrato (`D/12`)**: `:416` C12 (*«`S16` canceló el preapproval —de nuestro lado, si el proveedor
no lo había hecho—»*); `:436-449` C-8 (sacar `S13` de las que dejan en el piso).

**Otros carriles**: `B/21:169-172` (2b: el candidato plausible ya no es regla); `B/14` §2.2 (3b: nombrar
el caso de la vuelta del suspendido); `B/16` «NO cierra» (borde R7.5.2-4, contracargo de un addon) y
§4.3 (3c: la sucesora ya no muere por `S16` en ese caso, así que el addon re-apuntado no queda
huérfano); `V/10:92` y `V/02:117` (6a: la pricing no ofrece planes sin `admiteAltas`; billing sí lee
`admite_altas`); `V/descomposicion.md:310` (C10); `B/descomposicion.md:99`, `:381`, `:390` (veinte
motivos, sub-spec).

## 5. Recuentos de listas cerradas

| lista | antes | ahora | comando |
|---|---|---|---|
| motivos de marca (`B/02` §2.5) | 20 | **22**: 7 SÍ, 3 puede, 12 no; `S14` abre 12, otros actos 10 | script de abajo, sobre la tabla |
| filas del espejo (`B/03` §10.1) | 11 | **14** | ídem |
| eventos de `S6` | 3 | **5** | lectura de la fila; ninguna otra cita del número en el corpus (`rg "tres eventos"` sobre `$W`) |
| acciones administrativas (`N/08` §3) | 13 | **14** | `rg -o ".{0,60}\btrece\b.{0,60}"` sobre `$W` sin tachados; corregidas las de `B/03` y `B/19` |
| máquinas de estado | 9 | **10** | `rg "(ocho\|nueve) máquinas"` sobre `$W` |
| filas de `refund` (`B/03` §6.1) | — | 5 | script |
| preguntas legales de `B/22` §4 | «seis» | **cinco** | lectura de la tabla |
| filas `UNKNOWN` «un cobro que falla» (`B/06` §11) | «tres de cinco» | **cuatro de seis** | lectura de la tabla |

```python
# motivos (B/02 §2.5) y espejo (B/03 §10.1)
L = open("02-modelo-de-datos.md").read().split("\n")
a = [i for i, l in enumerate(L) if l.startswith("| # | `motivo`")][0]
rows = []
for l in L[a + 2:]:
    if not l.startswith("|"): break
    rows.append([x.strip() for x in l.split("|")[1:-1]])
# len(rows) == 22; plata sin tachados: SI 7, puede 3, no 12; S14 = 2,3,5,6,7,8,12,17,18,19,20,22
L = open("03-maquinas-de-estado.md").read().split("\n")
a = [i for i, l in enumerate(L) if l.startswith("| leído en el proveedor | lo nuestro |")][0]
# filas hasta la primera línea que no empieza con "|": 14
```

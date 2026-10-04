---
title: "FASE 9 completa · barrido final: 9a, 9g, 9h, pendientes fuera de carril y listas cerradas"
linear: HOS-1352
statusSource: linear
created: 2026-09-25
updated: 2026-09-25
status: CURRENT
fase: 9
---

# FASE 9 completa — barrido final

Carril: todo el corpus de capítulos —`V/*`, `B/*`, `N/*`, `C` (`D/12`), `D/16`, `D/13`, `D/04`—
**salvo** el log (`D/01`), la matriz (`D/06`), el PDR, los informes `D/14`…`D/25` y `26/00`–`16`, y
las sub-specs (`spec.md`, `descomposicion.md`). Fuentes: las filas `9a`, `9g` y `9h` de
[`10`](./10-decisiones-del-owner.md) y los pendientes *«fuera de carril»* de
[`11`](./11-aplicado-verticales-contrato-nucleo.md) §5, [`12`](./12-aplicado-el-corte.md) §4,
[`13`](./13-aplicado-billing-1.md) §3-4, [`15`](./15-aplicado-billing-2.md) §3-4 y
[`14`](./14-propuesta-log-y-matriz.md) §5.1-5.2. Rutas: `V/` es `HOS-1353-…/docs/`, `B/` es
`HOS-1354-…/docs/`, `N/` es `D/nucleo/`, `C` es el contrato. Las líneas son las del texto
**después** de aplicar. Lo que cambió de sentido quedó tachado; lo nuevo lleva *«owner 2026-09-25;
FASE 9 completa, &lt;ID&gt;»*. `updated: 2026-09-25` en los 18 archivos tocados (sólo `D/04` lo
tenía viejo). No se commiteó.

## 1. Las tres elecciones llevadas al owner

| fila | dónde | qué |
|---|---|---|
| **9a** | `B/09:123` (§3, fila *«cobros del período»*) | si la lectura del §4 da *«intentó y se rechazó»* sobre el período en curso de una fila `ACTIVE` con al menos un pago acreditado, **corre `S4`**; el reloj cuenta desde esa lectura (9b) |
| **9a** | `B/03:146` (fila `S4`, columna evento) | en un pagador con tarjeta, el evento lo trae el aviso releído por id **o el barrido** |
| **9a** | `B/12:53-57` (§1.2) | párrafo nuevo: el aviso del primer rechazo perdido entero lo lee el barrido |
| **9a** | `B/12:1063-1075` («NO cierra») | el borde R1-a **tachado** y remitido al arreglo; **declaración nueva**: la sucesora de 3c cuyo primer rechazo se pierde entero no entra por la rama del barrido (el owner la acotó a *«al menos un pago acreditado»* en la fila), y queda `ACTIVE` hasta que la comparación de estado lea `paused`/`cancelled` — declarado por `DEC-METH-015`, FASE 9 completa |
| **9g** | `B/19:113` (fila 7-bis) | el texto de pantalla tachado → *«…del mínimo que Mercado Pago permite cobrar»*: el mínimo lo pone Mercado Pago, no nosotros |
| **9g** | `B/14:79-81` (§1.3 regla 2) | el motivo en pantalla dice que el mínimo es del proveedor (`PC-2`) |
| **9h** | `C:93` (la firma) | campo nuevo `piso: versiónDePlan, si tipo = GRANT; nada en los otros cinco` — **siete campos** |
| **9h** | `C:99-106` (nota bajo la firma) | *«de seis a siete el mismo día, con `piso`»*; por qué cruza (el trinquete se aplica en verticales, el dato vive en billing) |
| **9h** | `C:127` (§2.1, fila nueva `piso`) | qué es y quién lo consume (la resolución del paso 6, `V/15` §2) |
| **9h** | `C:683-685` (§2.8) | cada fuente `GRANT` transporta también su piso por la firma |
| **9h** | `C:1013-1016` (§4.2, regla de vigilancia de ida) | *«ni en la fila `piso`»*: tercer censo de lo que cruza |
| **9h** | `V/15:104-106`, `:117-120` | el piso se **lee del campo `piso` de la fuente**, nunca de la tabla de billing |
| **9h** | `V/10:96` | fila del grant: *«y la versión de su piso, que le llega en el campo `piso`»* |
| **9h** | `B/02:498`, `:750-752` | `permanent_grant_vertical` queda como **origen del dato**; cruza por la firma |

## 2. Pendientes fuera de carril que cayeron en este carril

Verificado cada uno contra el texto actual; los que ya había aplicado otra tanda se marcan
*«ya estaba»*.

| pendiente (origen) | dónde | estado |
|---|---|---|
| 6b en `B/10` §4.3 (`13` §3, `15` §3) | `B/10:277-282` | **aplicado**: el barrido del día invalida el caché de la vertical entera |
| 6c, fila espejo del botón en `B/19` §4 (`11` §5, `13` §3) | `B/19:137` (fila 21) | ya estaba (tanda `15`) |
| `N/01` precisión 3 → `S35` (`15` §4 (1)) | `N/01:844` | **aplicado**: *«(**`S35`**)… del capítulo 03 §3.2»*; la fila existe en `B/03:177` |
| `N/01` precisión 3, *«cortesía sobre cortesía»* → `S34` (`15` §4 (3)) | — | sin sujeto: `N/01` no nombra ese cruce |
| `N/01:59` fila `C`, *«por corte que termina»* (`12` §4.3) | `N/01:60` | **aplicado** (`2e`) |
| `N/01:66` paréntesis de la fila de `trial` (`12` §4.3) | `N/01:68-72` | ya estaba (tanda `11`, `2g`) |
| `N/01:770` destino de plan anual (`15` §4 (2)) | `N/01:770-772` y `:796` | **aplicado**: no mensual, `DESTINO_DE_PLAN_NO_MENSUAL` (también el renglón 9 del inventario) |
| `N/01:499` `CHARGE_DECLINED` (`13` §4) | `N/01:531-534` | ya estaba |
| `V/11:354` plan anual (`15` §4 (5)) | `V/11:354-357` | **aplicado**: no mensual |
| `N/08:195` *«destino es de plan anual»* (hallado en el barrido) | `N/08:195` | **aplicado** |
| `V/15:157` *«viva y cobrada»* con la lectura de 3c (`15` §4 (6)) | `V/15:164-165` | **aplicado**: *«cobrada»* se lee como en `S4` (9e) |
| *«cinco hechos»* → seis (`11` §5) | `B/20:63`, `B/20:291-300`, `B/03:1894-1895` | **aplicado**; en `B/20:291` además *«dos son transiciones enteras (el 3 y el 6) y otro a medias»* y el predicado queda verde también por `PB11` |
| *«nueve máquinas»* → diez (`11` §5) | `B/20:280-282` | **aplicado** (y *«cuatro tablas»* → cinco, con `RF`) |
| `B/10` §4.6 *«novena máquina»* (hallado en el barrido) | `B/10:374-378` | **aplicado**: título *«~~novena~~ undécima»*; el núcleo cuenta diez |
| *«hash irreversible»* en el pliego (`11` §5, `C-1`) | `D/13:135`, `:145-168`, `:195` | **aplicado**: seudónimo determinístico; la rama del *«no»* **cambia un mecanismo**; tabla de urgencias. **Es la corrección que tenía que ir antes de mandar el pliego** |
| `D/04:398` (`11` §5, `C-1`) | `D/04:398-402` | **aplicado** |
| `D/04:408` *«las doce acciones»* (hallado en el barrido) | `D/04:411` | **aplicado**: catorce hoy |
| `B/02:493` `C-3` (`11` §5) | `B/02:498` | ya estaba (FK compuestas); 9h le agrega que es el origen del campo `piso` |
| `B/19` filas 16/16-bis, *«perdió la cobertura»* (`11` §5, `C-8`) | `B/19:128-129` | ya estaba (tanda `13`) |
| `B/03:736` la cobertura no vuelve (`11` §5, 6a) | `B/03:793-800` | ya estaba (tanda `13`) |
| `B/10` §4.6 quién lee `admite_altas` (`11` §5, 6a) | `B/10:386-389` | ya estaba (tanda `13`) |
| `V/10:92`, `V/02:117` billing lee `admite_altas` por `S1` (`13` §4) | `V/10:92`, `V/02:116-122` | ya estaba (tanda `11`) |
| `V/03:929` `C-7` (`12` §4.4) | `V/03:966-972` | ya estaba (tanda `11`) |
| `N/02:88` `C-10` (`12` §4.5) | `N/02:88-89` | ya estaba (tanda `11`) |
| `D/16:139`, `V/21` `C-7` (`11` §5) | `D/16:167-171`, `V/21:145-151` | ya estaba (tanda `12`) |
| `D/16` fuera del rango editable (`14` §5.2) | — | resuelto: lo editó la tanda `12` |
| número de motivo nuevo (`14` §5.2) | — | resuelto por la tanda `13` (21 y 22) |
| `N/00` §2 `C-13` (`14` §5.1) | `N/00:42-51` | **aplicado**: **124** decisiones (`rg -c "^### DEC-"` sobre el log de hoy = 125, menos la plantilla), y `DEC-MIG-002` entra como superada en parte (`C-9`, que el log ya escribió en su *Estado*) |
| `N/04:144` `D17`, segunda excepción (`13` §4) | `N/04:144` | **aplicado**: el listado `/authorized_payments/search` no es lectura por id; se declara, con su control de completitud y la marca de 3d |
| `N/07` tercera rama del correo (`13` §4) | `N/07:54-58`, `:201-205`, `:234` | ya estaba (tanda `11`) |
| `N/08` fila 14 y `DB-4` (`13` §4) | `N/08` §3 | ya estaba (tanda `11`) |
| motivos veinte → veintidós y máquinas nueve → diez en `N/*` (`13` §4) | — | ya estaba; el barrido de §4 no encontró ninguna cita viva |
| `C:416` `C12`, `C:436-449` `C-8` (`13` §4) | `C:428`, `C:446-471` | ya estaba |
| `B/21:169-172`, `B/14` §2.2 (3b), `B/16` (`13` §4) | — | ya estaba (tanda `15`) |
| `B/09` §2.4 y `:147` (`12` §4.1-4.2), `B/02` §4.1 (`12` §4.6) | — | ya estaba (tandas `13` y `15`) |

## 3. Lo que NO se aplicó

- **Nada de las sub-specs**, por instrucción (lista en §5).
- **El log y la matriz**, por instrucción (lista en §5).
- **`D/03-handoff.md:161`** (*«19»* motivos) y **`D/03:1120`** (*«las ocho máquinas»*): `D/03` no
  está en este carril.
- **`D/13` §1, *«cero pagos cobrados en toda la historia del sistema»*** (medición del 17/09): la
  tanda `12` declaró en `B/21`/`V/21` que hay pagos desde el 26/09 (`CT-6`). El pliego la da con su
  fecha, así que no es falsa como está; **conviene que el owner decida si la actualiza antes de
  mandarlo**. No se tocó.
- **`D/04:387-388`** (*«seis preguntas … tres cambian diseño, tres cambian un número»*): con `C-1`
  la pregunta 5 cambia un mecanismo, así que el reparto dejó de ser 3/3. Es un resumen de cierre
  histórico; no se reescribió.

## 4. Listas cerradas, recontadas

Comando (desde `.specs/`, sobre `HOS-1352`, `HOS-1353` y `HOS-1354`, excluyendo
`docs/1[4-9]-*` y `docs/2[0-6]-*`, y **quitando los tachados de cada línea antes de buscar**):
`scratchpad/listas.py` (patrones: `(cuatro|cinco) hechos|reinicios`, `(doce|trece) acciones`,
`(ocho|nueve|siete) máquinas`, `(diecinueve|veinte|veintiún) motivos`, rangos `S1–S2x/S3[0-4]`,
`T1–T[1-7]`, `PB1–PB(≤11)`, `(31|treinta y un…) transiciones`, `(siete) transiciones de trial`,
`(once|diez|trece) transiciones de publicación`, `(cinco|siete) estados de publicación`,
`seis campos`). Más un `rg -o` complementario para `31 filas/transiciones`, `trece acciones`, etc.

| lista | valor vigente | citas vivas del número viejo en este carril | resultado |
|---|---|---|---|
| hechos del reloj | **6** (+ `C`) | `B/20:63`, `:291`, `B/03:1894` | corregidas; quedan `V/03:693` (*«los otros cinco»*, correcto) y rastros históricos (*«`DEC-DATA-002` le puso cuatro»*) |
| acciones administrativas | **14** | `D/04:408` | corregida |
| máquinas | **10** | `B/20:280`, `B/10:376` | corregidas; `N/01:23` y `:379`, `V/18:193`, `D/05:144` hablan del §63 (*«pide ocho»*), correcto |
| motivos de marca | **22** | ninguna | `B/05:291` *«los otros veintiún»* es correcto |
| suscripción | **S1–S35** | ninguna | — |
| trial | **T1–T8** | ninguna | — |
| publicación | **6 estados / 12 transiciones** | ninguna | — |
| firma del contrato | **7 campos** (9h) | ninguna | `C:1025` y `D/11:126` citan *«los seis campos»* del §4.1 como error histórico ya corregido, no la firma |

## 5. Citas fuera de carril, con el texto propuesto

**Log (`D/01`)** — para el orquestador, con OK del owner:

1. **9a** — `DEC-MP-008`, 📌 bajo *«sólo en bordes —un webhook de cobro fallido que se perdió, y la
   fila sigue `ACTIVE` cuando el proveedor pausa»*: *«**Corregido** (owner 2026-09-25; FASE 9
   completa, 9a): si la lectura del barrido (`B/09` §4) da "intentó y se rechazó" sobre el período
   en curso de una fila `ACTIVE` con al menos un pago acreditado, corre `S4`. Queda como borde la
   sucesora de 3c sin pago propio (`B/12` «NO cierra»).»*
2. **9g** — `DEC-PROMO-001` (o la 📌 de 4b): *«el motivo en pantalla dice que el mínimo lo pone
   Mercado Pago, no nosotros (9g)»*.
3. **9h** — `DEC-ARCH-006` o `DEC-GRANT-00x` (la del trinquete del grant), 📌: *«La firma de
   `cobertura()` gana `piso: versiónDePlan, si tipo = GRANT` (siete campos): el piso del trinquete
   cruza la frontera en vez de leerse de `permanent_grant_vertical` (owner 2026-09-25; FASE 9
   completa, 9h, `C-2` del informe 09)»*.
4. `:3401` *«una de las doce acciones»*, `:3216`/`:3395`/`:4014` *«cuatro hechos»*, `:1940`
   *«ocho máquinas»*: son texto de decisiones fechadas; si el log agrega nota de recuento, que
   diga catorce / seis / diez.

**Sub-specs**:

- `V/spec.md:63`: *«el hash irreversible del correo»* → *«el seudónimo determinístico del correo»*
  (`C-1`).
- `V/descomposicion.md:62`, `:107`: *«cinco hechos»* → *«seis hechos»* (5b).
- `V/descomposicion.md:185-186`, `:204`, `:261`, `:377`: *«nueve máquinas»* → *«diez máquinas»*
  (5a).
- `V/descomposicion.md:310` (`C-10`); y asignar unidad a `G-R2-C` (con `G-R2-B`, `V3`), con lo que
  `B/20` §6 vuelve a *«sin unidad: 0»*.
- `B/descomposicion.md:456`: *«cinco hechos»* → *«seis hechos»*.
- `B/descomposicion.md:99`, `:381`, `:390`: *«veinte motivos»* → *«veintidós motivos»*.
- `B/descomposicion.md:199` (fila `B9`): *«un 100 % es una cortesía»* → *«un canje bajo el piso se
  rechaza, con el motivo que dice que el mínimo es de Mercado Pago (4b, 9g)»*.
- `B/descomposicion.md`: la unidad de la máquina de suscripción gana `S32`–`S35`; **la unidad del
  barrido gana la rama de 9a** (`S4` desde la fila *«cobros del período»*); **la unidad que
  implementa `cobertura()` (las dos, arranque y real) gana el campo `piso`** (9h) — y el juego
  único de casos del contrato §6.2 necesita un caso de `GRANT` con piso.

**Otros**: `D/03-handoff.md:161` (*«19»* → 22 motivos) y `:1120` (*«las ocho máquinas»* → diez).

## 6. Verificaciones

- **Tachados**: en los 18 archivos, conteo de `~~` par por párrafo (y por fila en las tablas),
  fuera de bloques de código: **cero desbalanceados**.
- **markdownlint**: `npx markdownlint-cli2` con `.markdownlint-cli2.jsonc` del repo, corrido desde
  la raíz sobre los 18 archivos: **0 issues**.

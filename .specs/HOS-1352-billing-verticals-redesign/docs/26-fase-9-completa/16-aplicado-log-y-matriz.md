---
title: "FASE 9 completa · aplicado: el log de decisiones y la matriz de MP"
linear: HOS-1352
statusSource: linear
created: 2026-09-25
updated: 2026-09-25
status: CURRENT
fase: 9
---

# FASE 9 completa — aplicado en el log y la matriz

Aplica la propuesta [`14`](./14-propuesta-log-y-matriz.md) (§2, §3 y §4) a `01-decision-log.md`
(`D/01`) y `06-mp-validation-matrix.md` (`D/06`), con la autorización del owner y **una
modificación suya sobre `DEC-MIG-005`**. Suma las notas para el log de los registros
[`11`](./11-aplicado-verticales-contrato-nucleo.md) §5, [`12`](./12-aplicado-el-corte.md) §4,
[`13`](./13-aplicado-billing-1.md) §4 y [`15`](./15-aplicado-billing-2.md) §4 que registran
decisiones del owner o correcciones de registro y no estaban en la propuesta. No se tocó ningún
otro archivo. Las líneas son las del árbol **después** de aplicar.

## 0. La modificación del owner sobre `DEC-MIG-005`

- **No se declara apartamiento del PDR §25 y no va al pliego del abogado.** El bloque *«⚠️
  Apartamiento del PDR, a confirmar por el owner»* de la propuesta se reemplazó por un bullet con
  **las dos posiciones**: la del orquestador (declararlo como noveno apartamiento y consultarlo en
  `13-pliego-consulta-legal.md`) y la del owner, que decide, citada textual: *«no conservamos nada
  de los clientes actuales además de su user, sus preferencias y su ficha; todo lo que es billing va
  de cero, como si fueran clientes nuevos. No hace falta abogado: son personas que conozco, amigos
  míos.»*
- **Qué SÍ se conserva, explícito**: bullet nuevo *«Qué SÍ se conserva, y qué no»* —el usuario, sus
  preferencias y sus fichas; todo lo de billing arranca de cero—. El título pasó de *«no conserva
  nada del sistema viejo»* a *«de su billing no se conserva nada … se conservan el usuario, sus
  preferencias y sus fichas»*, y el punto 1 de la *Decisión* dice *«Del billing del sistema viejo»*.
  El 📌 de `DEC-MIG-003` (punto 5) repite la frase.
- **El Resumen no suma un noveno apartamiento**: la fila sigue en **8**, con una nota que dice por
  qué `DEC-MIG-005` no suma.

## 1. Cambios en `D/01`

### Entradas nuevas (🆕), al final, después de `DEC-METH-015`

| línea | entrada | cierra |
|---|---|---|
| `:5536` | `DEC-SUB-022` — la sucesora de quien venía pagando entra en grace; el barrido corta el grace | 3c |
| `:5582` | `DEC-MIG-005` — la cartera vieja como clientes nuevos (con la modificación de §0) | 2a, 2d, 2g |
| `:5655` | `DEC-RF-008` — máquina mínima de `refund` y acción administrativa 14 | 5a |
| `:5687` | `DEC-ADDON-007` — los addons siguen a su título | 4a, 4c, 4d, 4e |
| `:5721` | `DEC-AUTH-001` — vertical inmutable, lo ajeno sólo público, lo propio sin paso 6, caché por `user` | 7a, 8a–8d (+ `F-8CA1-001`) |
| `:5760` | `DEC-ENT-006` — la presencia de Partner, sin máquina, con carrusel y bit de moderación | 7b, 7c (+ `R13`) |
| `:5785` | `DEC-ARCH-011` — la vertical que no admite altas no admite suscripciones; el fin de servicio invalida el caché | 6a, 6b (+ `R11`) |

Texto: el de la propuesta §2.1, §2.3, §2.8, §2.9, §2.11, §2.12 y §2.14, sin cambios salvo
`DEC-MIG-005` (§0 de este registro y la aclaración de 2d, §3 abajo).

### Precisiones (📌R) y correcciones (✏️) sobre entradas existentes

| entrada | *Estado* | cuerpo | ítem de `14` |
|---|---|---|---|
| `DEC-PROMO-001` | puntero, `:759` | 📌 tras la implicación 5, `:781` | §2.10 (4b) |
| `DEC-DATA-001` | puntero, `:869` | — (ya tenía 📌) | §2.23 |
| `DEC-SUB-006` | puntero, `:1027` | — (ya tenía 📌) | §2.23 |
| `DEC-CONC-002` | puntero, `:1420` | nota `C-R5-6` + segundo 📌, `:1468-1488` | §2.16 (2b, 3d) |
| `DEC-MAIL-001` | puntero, `:1490-1493` | segundo 📌 en el punto 1, `:1553` | §2.7 (1) |
| `DEC-MIG-002` | **SUPERSEDED EN PARTE por `DEC-MIG-003`**, `:2297` | — | §2.6 (`C-9`) |
| `DEC-MIG-003` | puntero, `:2574-2578` | segundo 📌 del orden del corte, `:2631` | §2.4 (2b, 2c, 2e, 2f, 2g; `C-7`) |
| `DEC-ARCH-008` | puntero | — | §2.22 (`C9`) |
| `DEC-MIG-004` | puntero | 📌, `:2930` | §2.5 (2d, 5c; `CT-5`, `C-7`, `C-10`) |
| `DEC-DATA-002` | puntero | 📌 en el punto 2, `:3220` | §2.17 (5b + hecho 5 de `R9`) |
| `DEC-ADDON-003` | puntero a `DEC-ADDON-007` | — | **nota de `15` §4 (12)**, ver §3 |
| `DEC-ADDON-004` | puntero a `DEC-ADDON-007` | — | **nota de `15` §4 (12)**, ver §3 |
| `DEC-SUB-013` | puntero | 📌, `:3559` | §2.19 (8f) |
| `DEC-TEST-001` | puntero (cifras) | — | §2.20 (`K-7`) |
| `DEC-DATA-004` | puntero (cifra) | — | §2.20 (`K-7`) |
| `DEC-SUB-017` | puntero | — (ya tenía 📌) | §2.23 |
| `DEC-RF-007` | puntero a `DEC-RF-008` | — | §2.8 |
| `DEC-SUB-019` | puntero | 📌 registro, `:5210` | §2.21 (`C2`) |
| `DEC-MP-008` | puntero a `DEC-SUB-022` | — | §2.2 |
| `DEC-SUB-021` | puntero | 📌, `:5336` | §2.2 (3a, 3b, 3c; `C3`) |
| `DEC-DATA-005` | puntero | 📌, `:5386` | §2.18 (8e) |
| `DEC-ARCH-009` | puntero | 📌, `:5424` | §2.13 |
| `DEC-TRIAL-010` | puntero | 📌, `:5456` | §2.15 (6c, 2g; `C-R12-1`) |

Los punteros de *Estado* sobre una sola línea se aplicaron con un script que exige exactamente una
aparición de `**Estado**: ACCEPTED ·` en la línea *Fecha* de cada entrada nombrada (13 de 13); los
de varias líneas y todos los cuerpos, a mano sobre su ancla.

### El Resumen (`:5813-5831`)

| fila | antes | ahora |
|---|---|---|
| Decisiones tomadas | 117 | **124** (las siete nuevas encabezan la fila) |
| De metodología | 15 | 15, con la nota de `09` `C-15` (once `METH` bajo el encabezado funcional) |
| Funcionales | 102 | **109** |
| Precisadas sin `SUPERSEDED` | 2 (eran 11) | **26**: 6 por otra decisión + 20 con 📌 o puntero del owner |
| `SUPERSEDED` | 5 | **6** (`DEC-MIG-002` en parte) |
| Condicionadas a FASE 1C | 1 | **2** (`DEC-SUB-021` a `GR-1`) |
| Apartamientos del PDR | 8 | **8** — `DEC-MIG-005` no suma, por decisión del owner |
| Decisiones de la FASE 9 completa *(fila nueva)* | — | 7 nuevas, 15 precisiones, 8 correcciones de registro |

La propuesta decía **24** precisadas y **13** precisiones de esta tanda; son **26** y **15** por los
dos punteros a `DEC-ADDON-007` (§3).

## 2. Cambios en `D/06`

- Frontmatter: `updated: 2026-09-25` (`:6`).
- `GR-3` (`:202`): tres reemplazos de §3.1 — *«ventana de ~~24 h~~ un ciclo»*, *«(sobre `1 days`: es
  un ciclo)»*, y *«~~está bloqueada…~~ se destrabó el 2026-09-24, al tercer intento»*.
- `RC-7` (`:281`): *«+ ~~24 h exactas~~ un ciclo»* y el 🚧 tachado.
- `RN-3` (`:194`): 📌 de registro, *«observado, no registrado»* (§3.2).
- `GR-1` (`:200`): 📌, condiciona a `DEC-SUB-021` (3a).
- `PA-6` (`:177`): 📌, `DEC-SUB-022` no la necesita para decidir; decide cuánto dura el grace (3c).
- `RC-1` (`:275`): 📌, el recorrido sin filtro lo verifica el gate del paso 2 (2f). **Sin fila
  nueva**, como argumenta la propuesta §3.3.
- *«Qué espera cada decisión»* (`:533-535`): `A-PROMO-01` tachada y decidida; dos filas nuevas,
  `DEC-SUB-021` → `GR-1` y `DEC-SUB-022` → `PA-6`.

Ninguna fila se agregó, se quitó ni cambió de estado. Recuento, desde `D`:

```text
$ python3 contar-filas-de-la-matriz.py
filas contadas: 98
  VERIFIED                55
  PARTIALLY_SUPPORTED     14
  NOT_SUPPORTED           23
  UNKNOWN                  6
sin cerrar (UNKNOWN): PA-6, RN-3, GR-1, GR-2, RC-8, RF-3
```

## 3. Notas de los otros registros

**Aplicadas** (decisión del owner o corrección de registro, no estaban en la propuesta):

- **`12` §3, interpretación de 2d** → en `DEC-MIG-005` punto 2 va la aclaración textual del owner
  que `10` fila 2d ya registra (*«…los tomamos como clientes nuevos que recién arrancan: tendrán su
  trial y luego se suscribirán»*) y que el trial nuevo es el del sistema nuevo cuando el corte
  termina. Con eso la duda de `12` (*«si el owner quiso otra cosa…»*) queda contestada por el propio
  owner.
- **`15` §4 (12), `DEC-ADDON-004`** → como *precisión por otra decisión* (puntero en *Estado*, la
  forma que el log usa cuando la precisión la escribe la decisión nueva), **y también
  `DEC-ADDON-003`**, cuyo punto 4 afirma *«La condición de huérfano no se toca»*, que `DEC-ADDON-007`
  deja de hacer valer. Registran 4a/4c/4d, decisiones del owner.

**Ya cubiertas por la propuesta** (no se duplicaron): de `11` §5, `K-7`, `DEC-ARCH-009`,
`DEC-MAIL-001`, el sexto hecho en `DEC-DATA-002`; de `12` §4.7, todas (`DEC-MIG-003`, #15/`CT-5`,
`C-7`, `DEC-MIG-002`, `C-10`, `DEC-TRIAL-010`, 5c); de `13` §4, las seis del log y las tres de la
matriz; de `15` §4 (10), 4a, que registra `DEC-ADDON-007` punto 1.

**No aplicadas**, con su razón:

| nota | por qué no |
|---|---|
| `11` §5: *«la décima máquina (5a), si el log los cuenta»* | el log no cuenta máquinas vigentes; la única cita (*«transiciones de ocho máquinas»*, en una entrada del 2026-09-21) era exacta en su fecha, y `DEC-METH-012` no pide tocarla |
| `15` §4 (11): 📌 en `DEC-GRANT-003` *«ya no se ejecuta como cortesía»* | `DEC-GRANT-003` no dice en ninguna parte que una promo bajo el piso se ejecute como cortesía; 4b quedó registrada en `DEC-PROMO-001`, la entrada que nombra el piso del apilado. Y `DESTINO_DE_PLAN_ANUAL` no aparece en el log |
| `15` §4 (13): 📌 en `DEC-GRANT-004`, *«los cruces 1 y 3 tienen fila (`S35`, `S34`)»* | `S34` y `S35` son **forma elegida por el agente** de billing 2 (su §2), no decisión del owner |
| `15` §4 (12), la cola *«el borrado de la ficha lo ejecuta sólo `A6` (`K-9`)»* | **elección del agente** de billing 2 entre las dos salidas de `K-9` (su §2); `11` §4 la había dejado para el orquestador |
| `15` §2: *«cobrada»* = pago acreditado **o** sucesora de una que venía pagando | **lectura del agente**; `DEC-ADDON-007` punto 3 dice *«viva y cobrada»* sin precisarlo |
| `13` §2: 2b abre el motivo 6 `TRANSICIÓN_NO_DECLARADA` | **elección del agente**; `DEC-CONC-002` dice sólo *«abre marca»* |
| `13` §2: nombres y números de los motivos 21 `COBRO_DEL_PERÍODO_SIN_RESOLVER` y 22 `PAUSA_NO_APLICADA` | **elección del agente**; el 📌 de `DEC-CONC-002` (3d) dice *«un motivo nuevo»*, sin número, como la propuesta |
| `13` §2: alcance de 3c, forma `RF1`-`RF5` de 5a, numeración de los eventos de `S6`, las diez salidas de 8f | forma elegida por el agente; lo que el owner decidió ya está en `DEC-SUB-022`, `DEC-RF-008` y el 📌 de `DEC-SUB-013` |
| `13` §2: R1-a (declarar en vez de corregir `B/09`), R1-b (*«desde que lo leímos»*), `C-R5-2` (`A3` sí cancela) | **elecciones del agente** donde el informe dejaba opción; `13` pide el OK del owner para R1-b |
| `15` §2: texto de pantalla de 4b | propuesta del agente, no del owner |

## 4. Verificaciones

- **IDs nuevos sin colisión**: `rg -n -o 'DEC-(SUB-022|MIG-005|RF-008|ADDON-007|AUTH-00[0-9]|ENT-006|ARCH-011)' .specs`
  fuera de `26-fase-9-completa/` → **cero** antes de aplicar.
- **Cada ID enmendado se grepeó en `$W`** antes de tocarlo (archivos que lo citan): `SUB-021` 23,
  `MP-008` 17, `MIG-003` 23, `MIG-004` 28, `MIG-002` 24, `MAIL-001` 26, `RF-007` 14, `PROMO-001` 8,
  `ARCH-009` 23, `TRIAL-010` 16, `CONC-002` 21, `DATA-002` 31, `DATA-005` 16, `SUB-013` 18,
  `DATA-004` 8, `TEST-001` 26, `SUB-019` 23, `ARCH-008` 15, `DATA-001` 21, `SUB-006` 42, `SUB-017` 9,
  `ADDON-003`/`-004` (17 para `-004`). Las líneas de `D/01` coincidían con las que midió la
  propuesta: nadie había tocado el log.
- **Anclas de la propuesta verificadas**: `«unas 20 (`B/21`§2.4, hoy 8)»` existe (`:2921`), *«Once
  filas»* existe en `DEC-CONC-002`, y `B/09:180` sigue diciendo **trece de las catorce** tras billing
  1, así que la nota `C-R5-6` es exacta.
- **Recuento del Resumen**, con script (lee los `### DEC-`, junta el campo *Estado* hasta el
  siguiente bullet y busca 📌 *Precisado/Cerrado* en el cuerpo; excluye la plantilla del formato):

```text
decisiones 124 · METH 15 · funcionales 109 · SUPERSEDED 6 · precisadas 26
diferencia entre las 26 del script y las 26 que lista la fila del Resumen: ninguna
```

  Apartamientos: la fila sigue nombrando ocho entradas; ninguna se agregó.

## 5. Pendiente para el orquestador (fuera de este carril)

- `nucleo/00-indice.md:42-45` (`09` `C-13`): texto de la propuesta §5.1, ahora con **124** y
  `DEC-MIG-002` en parte (§2.6 quedó aplicado).
- **Reglas del owner sin entrada** que la propuesta §5.2 lista y no se registraron: `R14` (lock por
  `user + vertical`), `F-8CA2-004` (`MODERATED` y `PURGED` por el dueño; entra sólo como cita en el
  📌 de `DEC-ARCH-009`), `R6` y `R7`.
- `B/02` §4.1 (*«Se conserva íntegro, siempre: pagos…»*, `12` §4.6): con la posición del owner de
  §0, conviene la aclaración de que habla del `payment` del modelo nuevo. Es carril billing.
- `D/13-pliego-consulta-legal.md`: **no se agrega** la pregunta del §25 (decisión del owner). Verificado: hoy el pliego no cita el §25
  (`rg -n "§ ?25"` → cero).

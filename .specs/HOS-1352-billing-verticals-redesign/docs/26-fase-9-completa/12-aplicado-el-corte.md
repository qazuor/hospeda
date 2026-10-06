---
title: "FASE 9 completa · registro de aplicación — el corte (D/16, B/21, V/21)"
linear: HOS-1352
statusSource: linear
created: 2026-09-25
updated: 2026-09-25
status: CURRENT
fase: 9
---

# FASE 9 completa · aplicado: el corte

Carril: `D/16-fase-7-del-paraguas.md`, `B/21-migracion.md`, `V/21-migracion.md`. Fuentes: la tabla
del owner ([`10`](./10-decisiones-del-owner.md)), el informe [`02`](./02-R2-el-corte.md) (CT-1..CT-7,
DB-1..DB-7) y el [`09`](./09-resto-y-registro.md) (C-6, C-7, C-9, C-10 y su DB-5). Las líneas son
las del archivo **después** de editar. Nada se borró sin rastro: lo que cambia de sentido está
tachado con `~~…~~` y el texto nuevo lleva *owner 2026-09-25; FASE 9 completa, <ID>*. Frontmatter
`updated: 2026-09-25` en los tres (`CT-7`). `markdownlint-cli2` sobre los tres: 0 issues.

## 1. Cambios, por archivo

### `D/16-fase-7-del-paraguas.md`

| línea | qué | cierra |
|---|---|---|
| 6 | `updated` | `CT-7` |
| 18-22 | *«un ítem resuelto … los otros cinco»* tachado → dos resueltos (orden del corte y rollback), cuatro pendientes | `2c` |
| 44 | fila `rollback` de la tabla de huérfanos: `—` tachado → §4.3, sólo hacia adelante | `2c` |
| 83-85 | §3: *«Y ésa fue la conclusión»*, sólo hacia adelante pasado el paso 3 | `2c` |
| 120 | paso 1a: los planes salen del proveedor, no de `billing_mp_plan` | `DB-3` |
| 121 | paso 1b: *«que no sean sondas»* tachado → incluidas salvo las enumeradas; definición de *«vivo»* (`pending`, `authorized`, `paused`) | `DB-1`, `DB-2` |
| 122 | paso 2: control de completitud (conteo = `total` del paginado, y todo id conocido aparece; si no, no avanza) | `2f` |
| 123 | paso **2b** nuevo: backup de la base | `2e` |
| 125 | paso **3b** nuevo: los dos `permanent_grant`, antes del paso 4 | `DB-7` |
| 128-132 | párrafo: las sondas también se cancelan, salvo manifiesto versionado en `mp-probes/` (borde declarado) | `DB-1` |
| 134-138 | párrafo: el contenedor viejo no atiende webhook ni crons durante el rollout (borde declarado) | `DB-5` (informe 02) |
| 146-152 | la ventana 1→3: *«tres suscripciones … lo registra el viejo»* tachado → el viejo registra lo que conoce; lo sólo-del-proveedor lo recoge la marca de re-vinculación; lo que anote el viejo no se conserva | `CT-3`, `2a` |
| 159-165 | *«El paso 4 es la única escritura del corte»* tachado → única escritura **a mano**; `inactiva_desde` y los grants los hace el sistema nuevo en el paso 3; **el corte no escribe filas de `trial`** | `CT-1`, `2g` |
| 167-171 | las llamadas: *«se despublican la mañana del corte»* tachado → las despublica la primera corrida del reconciliador, dentro del primer día | `C-7` |
| 188-191 | título de la rama de aborto tachado → *«si algo falla después del paso 1b»* (incluye el paso 2) | `DB-4` |
| 196-202 | punto 2: *«no se desplegó nada»* tachado → si el paso 3 escribió algo, se restaura el backup del 2b; el reintento escribe `C` con su instante | `2e` (cierra `AO-5`) |
| 208-213 | punto 4: *«no está decidido»* tachado → la diferencia no se devuelve; quien se re-suscribe arranca un trial nuevo desde cero, en el sistema nuevo al terminar el corte | `2d` |
| 216-225 | §4.3: *«sigue sin escribirse»* tachado; decisión sólo-hacia-adelante + «NO cierra» declarado (defecto grave arreglado bajo presión) | `2c` (cierra `AO-3`) |
| 229-233 | §5: *«Cinco de los seis»* tachado → cuatro, nombrados | `2c` |

### `B/21-migracion.md`

| línea | qué | cierra |
|---|---|---|
| 6 | `updated` | `CT-7` |
| 66-71 | §1.3: la re-verificación cuenta soft-deleted, addons, promos, grants de destaque y `entity_subscriptions`; ya no para conservar sino para saber a quién llamar | `DB-5` (informe 09), `2a` |
| 73-76 | §1.3: 📌 *«Caducó el 2026-09-26»*: *«cero pagos»* y *«no hay débitos»* son de la medición del 17/09 | `CT-6` |
| 80-84 | **reorden**: nuevo `## 2.` con §2.4 y §2.5 (antes iban después del §3 sin encabezado). Sin renumerar, porque todo el corpus cita `B/21` §2.4/§2.5; nota de rastro | `C-10` (parte del orden) |
| 105-108 | §2.4: el orden grants/paso 4 *«que hay que fijar»* tachado → fijado: paso 3b | `DB-7` |
| 121-127 | §2.5: *«única fila de billing»* tachado → única fila **de rastro**; los grants son filas nuevas pero no rastro; la fila de `trial` de verticales tachada | `2g` |
| 139-157 | §2.5: *«el candidato más plausible…»* tachado → **regla de re-vinculación** en blockquote + por qué ya no hay candidato plausible; la precondición va al cap. 09 §2.4 | `2b` (cierra `AO-2`, `F-8CB3-008`, caso A12, rama sondas) |
| 165-172 | §2.5: *«hecha a mano y sin nadie que verifique»* tachado → la del viejo en 1b, verificada por el paso 2; se barre igual y no mueve cifras del cap. 09 | `CT-2`, `C-6` (mitad `B/21`) |
| 197-201 | §2.5: el rollback del programa ya está decidido (sólo hacia adelante; backup antes) | `2c`, `2e` |
| 213-214 | §3.1: *«cero pagos»* con su fecha y su caducidad | `CT-6` |
| 236-238 | §3.2 (c): *«sigue abierto»* tachado → cerrado por el log | `C-9` |
| 239-243 | §3.3: título nuevo, título viejo tachado como rastro | `C-9` |
| 252 | tabla §3.3: *«(§2.4)»* tachado → `V/21` §2.5 | `C-10` |
| 256-264 | §3.3: *«declarada … en `04-open-decisions`»* tachado → cerrada por `DEC-MIG-002` + `DEC-MIG-003` + `DEC-MIG-004` #16 | `C-9` |
| 269-286 | §4: fila de `trial` tachada (`2g`); *«no hay ninguno»* tachado → hay desde el 26/09 y no se conservan; **viñeta nueva**: tablas viejas y columnas que las copian, no se conserva nada, el corte no necesita leerlas | `2g`, `CT-6`, `2a` (cierra `AO-1`) |
| 295-305 | «NO cierra»: la línea de altas nuevas tachada; **dos declaraciones nuevas**: contracargo sin comprobante del lado de Hospeda (`2a`), y la precondición del cap. 09 §2.4 todavía no escrita allá | `C-9`, `2a`, `2b` |

### `V/21-migracion.md`

| línea | qué | cierra |
|---|---|---|
| 6 | `updated` | `CT-7` |
| 62-65 | §2.3: *«Nada de plata»* tachado → hay pagos desde el 26/09 y no se conservan | `CT-6`, `2a` |
| 66-80 | §2.3: *«Ya no se pierde»* tachado → el trial de los clientes actuales se pierde a propósito; cita del owner; revierte la regla del 25/09 | `2g` |
| 89-99 | §2.4: *«amanece ahí todo el que no tenía…»* tachado → el 100 % amanece en `PRE_TRIAL`, otra vez | `2g` |
| 113, 119-122 | punto 1 cita el paso 3b; punto 3 *«no está fijado»* tachado → fijado | `DB-7` |
| 133-143 | las dos `comp`: el párrafo de la fila consumida tachado → `T6` dispara al publicar (un `GRANT` convierte), fila nace consumida; declarado | `2g` |
| 145-151 | *«`PB2` se dispara por el cambio … la mañana del corte»* tachado → el reconciliador diario, dentro del primer día | `C-7` |
| 154-158 | el blockquote de las llamadas suma el camino del cliente nuevo (publicar o el botón de `6c` arranca `T1`) | `2g` (y cita `6c`) |
| 175-181 | escritura `C`: se mantiene con `2g`; la de un corte abortado no cuenta (restauración); *«el mismo día»* tachado → dentro del primer día | `2e`, `C-7` |
| 189-196 | ⚠️ de la agenda: *«sigue abierto … lo decide el owner»* tachado → sin tratamiento especial, decisión del owner | `5c` |
| 204-208 | *«La fila de `trial` consumida que el corte sí escribe»* tachado → el corte no siembra ningún trial | `2g` |
| 225-234 | *«Consecuencia sobre la regla»*: la fila de `trial` y las *«dos clases»* tachadas → verticales no escribe fila nueva; las nuevas son lápida + dos grants | `2g` |
| 240-252 | apartado *«El rastro de que ya fue cliente»*: blockquote **Revertido** con la cita del owner; declara qué pierde sujeto | `2g` |
| 254-308 | todo el apartado revertido tachado, párrafo por párrafo, viñeta por viñeta e ítem por ítem (su «NO cierra» 1-4 incluido) | `2g` |
| 331-334 | §4 Partner: la revocación del admin pasa al bit de moderación de la presencia | `7c` (ver §4) |
| 345-354 | «NO cierra»: **dos declaraciones nuevas**: la agenda del día 180 sin tratamiento especial, y el trial de los clientes actuales no se preserva | `5c`, `2g` |

## 2. Coherencia entre las tres fuentes del corte

Verificado leyendo las tres después de editar:

- **Escrituras del corte**: las tres dicen lo mismo — a mano, sólo las lápidas (paso 4); del sistema
  nuevo en el paso 3, `inactiva_desde` (escritura `C`) y los dos `permanent_grant` (paso 3b);
  **ninguna fila de `trial`**. `D/16:159-165`, `B/21:121-127` y `:269-274`, `V/21:225-234`.
- **Despublicación de la cartera**: el reconciliador diario, dentro del primer día, en `D/16:167-171`,
  `V/21:145-151` y `:179-180`.
- **Orden grants/paso 4**: paso 3b en `D/16:125`, `B/21:105-108`, `V/21:119-122`.
- **Rollback**: sólo hacia adelante pasado el paso 3, rama de aborto con backup antes: `D/16:216-225`
  y `:196-202`, `B/21:197-201`, `V/21:175-178`.
- **Datos viejos**: no se conserva nada; el corte no los lee: `B/21:275-286`, `D/16:151-152`,
  `V/21:62-65`.
- **Re-vinculación**: la regla vive en `B/21` §2.5; `D/16:128-132` y `:146-152` la citan.
- Con `V/03:353-362` (otro carril, ya editada por su pasada) coincide: *«el corte NO
  escribe filas de `trial`… su próxima publicación arranca un trial por `T1`»*.

## 3. Lo que no apliqué, y por qué

| ítem | motivo |
|---|---|
| `CT-4` | es una nota 📌 en `DEC-MIG-003` del log — fuera de carril. Además su texto propuesto (*«el trial consumido ya no se pierde»*) **quedó invertido por `2g`**: ver §4 |
| `CT-5` | nota en `DEC-MIG-004` #15/#16 del log — fuera de carril (§4) |
| `DB-6` (informe 02) | **pierde sujeto por `2g`**: ya no hay censo de filas de `trial`. Lo dice la nota de revertido (`V/21:240-252`) |
| `DB-5` del 09, mitad *«precisar que una suscripción incluye las soft-deleted»* en `V/21` §2.4 | pierde sujeto por `2g` (misma nota). La otra mitad (`B/21` §1.3) sí se aplicó, reorientada por `2a` |
| `AO-4` recomendación (`DEC-MIG-004`, resolverlo hablando) | el owner decidió otra cosa (`2d`); se escribió `2d` |
| `AO-1` recomendación (congelar en solo lectura + valor neutro en columnas) | el owner decidió `2a` (no se conserva nada); no se escribió el valor neutro: las columnas se retiran con el código que las lee (FASE 5) y el sistema nuevo no las lee |
| `AO-5` recomendación (reescribir en el reintento) | el owner decidió `2e` (backup y restauración) |
| `C-10`, renumerar `B/21` | **no renumeré**: §2.4/§2.5 se citan en decenas de documentos (`rg` sobre `.specs`: 21 archivos). Resolví el orden con un `## 2.` propio y el reordenamiento físico; los números quedan |
| interpretación de `2d` | la tabla dice *«quien se re-suscribe arranca un trial nuevo desde cero»*. Como el proveedor no repite el trial en el sistema viejo (`HOS-1012`), escribí que ese trial es **el del sistema nuevo cuando el corte termina**, consecuencia de `2g`. **Si el owner quiso otra cosa, hay que corregir `D/16:208-213`** |

## 4. Pendiente fuera de carril (texto propuesto)

1. **`B/09` §2.4 — precondición de la re-vinculación (`2b`)**, carril de billing. Después de *«sólo
   dice de quién es»*: *«**Y sólo si el `external_reference` del preapproval nombra una fila nuestra
   que no tenga otro `provider_link` vivo** (owner 2026-09-25; FASE 9 completa, `2b`). Todo otro
   desconocido abre la marca `requiere_conciliación` y lo mira una persona. Cada preapproval del
   sistema nuevo nace con nuestro `external_reference` (`PA-2`); lo que viene del sistema viejo no
   lo nombra.»* Qué motivo de marca lleva lo decide esa pasada (`TRANSICIÓN_NO_DECLARADA` u otro):
   **si es uno nuevo, cambia el recuento de motivos**.
2. **`B/09:147` — `C-6`**: *«una persona a mano, verificada por relectura en el paso 2 del corte
   (`D/16` §4.2), pero sin idempotencia ni registro de nuestro lado; se barre igual»*. No mueve
   *«trece de las catorce»* ni `B/03:2577`.
3. **`NUCLEO/01-glosario.md:66`**: el paréntesis *«(verticales escribe la fila de `trial` consumida
   de cada dueño existente, `V/21` §2.4 …)»* → tachar y agregar *«(desde `2g` verticales no escribe
   filas de `trial` en el corte; owner 2026-09-25, FASE 9 completa)»*. Y en la fila `C` (`:59`),
   precisar *«una vez **por corte que termina**: un corte abortado se restaura del backup (`2e`)»*.
4. **`V/03:929` (y `:847-850` según el informe 09) — `C-7`**: el caso de la mitad `PUBLISHED` de
   `PB4` es *«una ficha publicada sin cobertura que el reconciliador todavía no bajó»*.
5. **`N/02-modelo-de-datos.md:88` — `C-10`**: *«se explica en §4»* → *«se explica en `V/02` §4»*.
6. **`B/02` §4.1** (*«Se conserva íntegro, siempre: pagos…»*): aclarar que habla de `payment` del
   modelo nuevo; los pagos del sistema viejo no se conservan (`2a`). Hoy un lector puede leerla como
   obligación sobre `billing_payments`.
7. **Log `D/01`** (con OK del owner, lo aplica el orquestador):
   - `DEC-MIG-003`, 📌 2026-09-25: *«desde el 2026-09-26 hay pagos bajo el sistema viejo y **no se
     conservan**, ni las tablas ni sus columnas copiadas (`2a`); el corte **no siembra trials
     consumidos** (`2g`, revierte la regla de capítulo del 25/09); escribe `inactiva_desde` y los
     dos `permanent_grant`. Rama de aborto: backup antes del paso 3 y restauración (`2e`); pasado el
     paso 3, sólo hacia adelante (`2c`); la diferencia que cobra la rama de aborto no se devuelve,
     quien se re-suscribe arranca trial nuevo desde cero (`2d`); el paso 2 controla la completitud
     del recorrido (`2f`)»*. Reemplaza el texto de `CT-4`, que decía lo contrario sobre el trial.
   - `DEC-MIG-004` #15 (`CT-5`): *«desde el 2026-09-24 el censo sale del proveedor; un cobro en
     vuelo entre el paso 3 y el 4 puede ser de alguien que la base no conoce, y lo recoge la marca
     de la re-vinculación (`B/21` §2.5, `2b`)»*.
   - `DEC-MIG-003` `:2579` y `DEC-MIG-004` #1 `:2840` (`C-7`): nota de precisión — la cartera la
     baja el reconciliador diario dentro del primer día, no `PB2` por evento ni *«la mañana»*.
   - `DEC-MIG-002` (`C-9`): *Estado* → *«SUPERSEDED EN PARTE por `DEC-MIG-003`»* (lleva a 6 los
     `SUPERSEDED` del resumen).
   - `:2850` (`C-10`): *«`B/21` §2.4»* → *«`V/21` §2.5»*.
   - `DEC-TRIAL-010` (`C-R12-1` del informe 07): si se agrega el punto *«Y el corte»*, que diga
     **que el corte no siembra** (`2g`), no lo contrario.
   - Una entrada o 📌 para `5c`: la agenda de llamados no tiene tratamiento especial.

## 5. Listas cerradas

No moví ninguna de las listas cerradas del programa (hechos del reloj, acciones administrativas,
motivos de marca, eventos de `S6`, estados). Los conteos propios que sí cambiaron, dentro del
carril:

- **Ítems huérfanos pendientes de la FASE 7**: 5 → 4 (`D/16` §0 y §5). Busqué citas fuera:
  `rg -n -i 'cinco de los seis|otros cinco siguen|cinco ítems huérfanos' .specs --glob
  '!**/1[4-9]-*/**' --glob '!**/2[0-6]-*/**'` → **cero**.
- **Pasos del orden del corte**: 6 → 8 filas (se agregan `2b` y `3b`). Ninguna cita cuenta las
  filas: `rg -n -i 'seis (filas|pasos)' .specs` (sin los informes históricos) da seis líneas y
  ninguna habla de los pasos del corte).
- **Números de sección de `B/21`**: sin cambio (§2.4 y §2.5 se conservan); por eso las citas
  `B/21 §2.4`/`§2.5` del corpus (21 archivos con `rg -c`) siguen resolviendo.

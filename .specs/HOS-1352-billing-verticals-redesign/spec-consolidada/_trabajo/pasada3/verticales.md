# Pasada 3 · verticales

> Generado por `scripts/pasada3.py` sobre el HEAD `eac01d9148`; fuentes `17f9702675` → `c7a3fac900`. Los archivos generados (01, 04, B4–B7) no se editan a mano: lo que les toca se arregla en su generador (`scripts/generadores/`).

| qué | cuántos |
|---|---|
| Ítems nuevos a definir (R1) | 0 |
| AC y tests nuevos (R7 · R7b · R18) | 1 |
| Ítems con contenido de fuente cambiado desde 17f9702675 | 3 |
| Citas sobre texto cambiado (reanclar.py, sin remapear) | 12 |
| Secciones R17 sin citar asignadas | 1 |
| Origen corrido (R6): el bloque cita una línea cuyo texto cambió | 0 |
| Lo que la redacción tiene que cambiar después del lote BY a CB | 5 |
| R17 cubierto | 0 |
| R17 parcial | 0 |
| R17 ausente | 1 |

## `10-corte/U3.md`

### Lo que la redacción tiene que cambiar después del lote BY a CB

- **`10-corte/U3.md`**: cerrar el monto del 4b (operativo: el owner, antes del ensayo).

## `10-corte/V1.md`

### Lo que la redacción tiene que cambiar después del lote BY a CB

- **`10-corte/V1.md`**: sacar de *Abiertos* el `db:migrate` (ya tiene su AC, l.417) y la ubicación
  del script (BS).

## `10-corte/V3.md`

### AC y tests nuevos (R7 · R7b · R18)

- `DEC-AUTH-001#📌2` — D/01-decision-log.md:6669 · **nuevo desde 17f9702675** — dueña **V3**; también: —; falla: R18 ≥1 de cualquier tipo de la lista cerrada; R7; R7b; tipos exigidos: ≥1 de cualquier tipo de la lista cerrada

### Ítems con contenido de fuente cambiado desde 17f9702675

- **dueña del AC**: `DEC-AUTH-001` (ACCEPTED) — vieja `D/01-decision-log.md:6618` → nueva `D/01-decision-log.md:6626` — cambio: {+invalida por `user`: **vive en el Redis que la API ya usa**, no en la memoria del proceso, porque en un redeploy conviven dos contenedores y con varias instancias una invalidación no alcanzaría a las otras; **si Redis no responde, se lee la resolución en vivo**; y un contador de entradas sospechosas va en los logs estructurados. Dónde: `V/02` §3.4; `V/descomposicion.md` §2 y §4 (`V3`); `41-corte-del-mvp/10-decisiones-del-owner.md`, CB.+}
- **define**: `FILA:V3` (VIVO) — vieja `V/descomposicion.md:63` → nueva `V/descomposicion.md:63` — cambio: [-BC)-] … {+BC); **y el caché del conjunto efectivo en el Redis de la API, invalidado por `user`, leído en vivo si Redis no responde, con un contador de entradas sospechosas en los logs** (corte del MVP, owner 2026-10-02, CB; `02` §3.4)+}
- **define**: `LISTA:V3` (VIVO) — vieja `V/descomposicion.md:714` → nueva `V/descomposicion.md:714` — cambio: [-marco)*-] … {+marco)*; **y una revocación invalida la entrada del `user` en Redis, y con Redis caído la lectura sale en vivo y contesta lo mismo** (corte del MVP, owner 2026-10-02, CB)+}

### Citas sobre texto cambiado (reanclar.py, sin remapear)

- línea 36: `V/descomposicion.md:63` — texto en 17f9702675: «| **V3** | **La resolución de capacidades** | *«¿qué puede hacer esta cuenta en esta vertical?»* tiene respuesta: agregación, scopes, caché e invalidación — **la invalidación por `user`, en todas sus verticales, y no por» — candidata en c7a3fac900: `V/descomposicion.md:63` «| **V3** | **La resolución de capacidades** | *«¿qué puede hacer esta cuenta en esta vertical?»* tiene respuesta: agregación, scopes, caché e invalidación —**la invalidación por `user`, en todas sus verticales, y no por»
- línea 52: `V/descomposicion.md:714` — texto en 17f9702675: «| **V3** | una clave que suma y una que no acumulan **distinto**, y la que no acumula **favorece al cliente**; y revocar una fuente invalida el caché de ~~ese `user + vertical`~~ **ese `user` en todas sus verticales** —u» — candidata en c7a3fac900: `V/descomposicion.md:714` «| **V3** | una clave que suma y una que no acumulan **distinto**, y la que no acumula **favorece al cliente**; y revocar una fuente invalida el caché de ~~ese `user + vertical`~~ **ese `user` en todas sus verticales** —u»

### Secciones R17 sin citar asignadas

- `V/02-modelo-de-datos.md:736–746` ### 3.4 Dónde vive ✚ — §3.4 — por qué acá: `V/descomposicion.md:63`, capítulos de V3: `02` §3 — **contenido ausente** (6%)

### Lo que la redacción tiene que cambiar después del lote BY a CB

- **`10-corte/V3.md`**: el caché según CB (Redis, lectura en vivo si falla, contador); sacar las dos
  superficies de §6.3 (CA).

## `10-corte/V5.md`

### Lo que la redacción tiene que cambiar después del lote BY a CB

- **`10-corte/V5.md`**: el carril de `USER_IMPERSONATE` (enum recreado y migración de datos de roles
  y overrides, en el PR que retira sus lectores); sacarlo de *Abiertos*.

## `10-corte/V6.md`

### Citas sobre texto cambiado (reanclar.py, sin remapear)

- línea 851: `V/02-modelo-de-datos.md:577` — texto en 17f9702675: «exacta, que es la que el cap. 20 §2 y `B/20` §2 citan. *(`DEC-DATA-004` `H1` los llama *«la lista de los cinco consumidores»*; esa» — candidata en c7a3fac900: `V/02-modelo-de-datos.md:577` «exacta, que es la que el cap. 20 §2 y `B/20` §2 citan.*(`DEC-DATA-004` `H1` los llama *«la lista de los cinco consumidores»*; ~~esa»
- línea 851: `V/02-modelo-de-datos.md:578` — texto en 17f9702675: «cifra del log queda por corregir en el log.)*» — candidata en c7a3fac900: `V/02-modelo-de-datos.md:578` «cifra del log queda por corregir en el log~~ esa cifra del log la omite la adjudicación de `DEC-DATA-004` (corte del MVP, owner 2026-10-02, BK; residuo corregido el 2026-10-02, segunda vuelta del triage).)*»
- línea 940: `V/15-entitlements-y-limits.md:425` — texto en 17f9702675: «escrito en `DEC-DATA-003`. (Esa decisión nombra `PB1` para ese acto; `PB1` es la que **publica**,» — candidata en c7a3fac900: `V/15-entitlements-y-limits.md:425` «escrito en `DEC-DATA-003`. ~~(Esa decisión nombra `PB1` para ese acto; `PB1` es la que **publica**,»
- línea 940: `V/15-entitlements-y-limits.md:426` — texto en 17f9702675: «y la que despublica es `PB6`. Acá va la fila que ejecuta lo que la decisión describe.)» — candidata en c7a3fac900: `V/15-entitlements-y-limits.md:426` «y la que despublica es `PB6`. Acá va la fila que ejecuta lo que la decisión describe.)~~ (La decisión decía `PB1` hasta la FASE 9-bis-4; hoy dice `PB6`: residuo corregido el 2026-10-02, segunda vuelta del triage.)»

## `20-fase-1/V9b.md`

### Citas sobre texto cambiado (reanclar.py, sin remapear)

- línea 554: `V/22-lo-legal.md:61` — texto en 17f9702675: «Tres piezas que por separado están bien y juntas se anulan:» — candidata en c7a3fac900: `V/22-lo-legal.md:61` «Tres piezas (la 2 ya no aplica desde `DEC-DATA-005`; residuo corregido el 2026-10-02, segunda vuelta del triage) que por separado están bien y juntas se anulan:»

## `20-fase-4/V7.md`

### Citas sobre texto cambiado (reanclar.py, sin remapear)

- línea 539: `V/18-partner.md:143` — texto en 17f9702675: «FK; **`starts_at` y `ends_at` quedan hasta `V7`**: FASE 5, lote de la aplicación, owner» — candidata en c7a3fac900: `V/18-partner.md:143` «FK; ~~**`starts_at` y `ends_at` quedan hasta `V7`**~~ **`starts_at` y `ends_at` quedan hasta el corte**: FASE 5, lote de la aplicación, owner»
- línea 539: `V/18-partner.md:144` — texto en 17f9702675: «2026-09-30, H; **y `V7` las borra con su migración, junto con sus lectores del panel**: FASE 5,» — candidata en c7a3fac900: `V/18-partner.md:144` «2026-09-30, H; ~~**y `V7` las borra con su migración, junto con sus lectores del panel**~~ **y la migración de `V6` las borra al corte, junto con sus lectores del panel** (corte del MVP, owner 2026-10-01, AB y AP; residu»
- línea 561: `V/18-partner.md:222` — texto en 17f9702675: «proveedores). **`V7` crea `postulacion` (cap. 02 §2.7) sólo para Partner**, con la restricción de» — candidata en c7a3fac900: `V/18-partner.md:222` «proveedores). ~~**`V7` crea `postulacion` (cap. 02 §2.7) sólo para Partner**~~ **`V6` crea `postulacion` (cap. 02 §2.7) al corte, sólo para Partner, y `V7` la escribe** (corte del MVP, owner 2026-10-01, AP; residuo corre»
- línea 792: `V/21-migracion.md:692` — texto en 17f9702675: «(`HOS-1352`, `HOS-1353` y `HOS-1354`), así que el resto falla desde que `V1` construye el guard y» — candidata en c7a3fac900: `V/21-migracion.md:692` «(`HOS-1352`, `HOS-1353` y `HOS-1354`), así que el resto falla desde que ~~`V1`~~ `U1` construye el guard (lote O-A; residuo corregido el 2026-10-02, segunda vuelta del triage) y»
- línea 792: `V/21-migracion.md:698` — texto en 17f9702675: «carpeta nombra en su `linear:`, leído en Linear el día que `V1` hace la limpieza, no antes,» — candidata en c7a3fac900: `V/21-migracion.md:698` «carpeta nombra en su `linear:`, leído en Linear el día que ~~`V1`~~ `U1` hace la limpieza, no antes,»

### Lo que la redacción tiene que cambiar después del lote BY a CB

- **`20-fase-4/V7.md`**: cerrar el outbox (BR por transitividad); dejar sólo los plazos 8 y 9 como
  operativos.

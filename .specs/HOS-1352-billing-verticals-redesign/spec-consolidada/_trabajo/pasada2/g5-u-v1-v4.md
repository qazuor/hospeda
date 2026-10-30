# Pasada 2 · g5-u-v1-v4

> Generado por `scripts/pasada2.py` sobre el HEAD `9b40071800`; fuentes `f80c0f2715` → `17f9702675`. Los archivos generados (01, 04, B4–B7) no se editan a mano: lo que les toca se arregla en su generador (`scripts/generadores/`).

| qué | cuántos |
|---|---|
| Ítems nuevos a definir (R1) | 0 |
| AC y tests nuevos (R7 · R7b · R18) | 1 |
| Ítems con contenido de fuente cambiado desde f80c0f2715 | 4 |
| Citas sobre texto cambiado (reanclar.py, sin remapear) | 4 |
| Secciones R17 sin citar asignadas | 72 |
| R17 cubierto | 14 |
| R17 parcial | 7 |
| R17 ausente | 51 |

## `10-corte/U1.md`

### Ítems con contenido de fuente cambiado desde f80c0f2715

- **dueña del AC**: `DEC-ARCH-016` (ACCEPTED) — vieja `D/01-decision-log.md:7664` → nueva `D/01-decision-log.md:7695` — cambio: {+1)**, sobre el momento 3 (*«qué es un ensayo verde»*) y el paso 0: **el ensayo recorre la rama de aborto una vez, en `staging`, sobre la misma copia**: una falla provocada después del 1b, y se verifica restaurar el 2b, la imagen vieja, los inversos (b) y (c) y la regla del 0b puesta hasta el reintento (Q1); y **la medición de `EX-49` se registra con la etiqueta `prod`**: lee datos de producción sin mutar nada y es gate del corte real, aunque el paso 0 decía *«ninguna en producción»* (Q2). Dónde: `16-fase-7-del-paraguas.md` §4.2 (el paso 0 y la rama de aborto) y §4.7, momento 3; `41-corte-del …(cortado)

### Citas sobre texto cambiado (reanclar.py, sin remapear)

- línea 108: `V/descomposicion.md:496` — texto en f80c0f2715: «| **la limpieza del agrupamiento viejo de Gastronomía y Experiencia en el producto**: el rol de dueño de comercio, sus siete permisos, la tabla de contactos de alta y el tipo de partner, **con su migración de datos**; **» — candidata en 17f9702675: `V/descomposicion.md:496` «| **la limpieza del agrupamiento viejo de Gastronomía y Experiencia en el producto**: el rol de dueño de comercio, sus siete permisos, la tabla de contactos de alta y el tipo de partner, **con su migración de datos**;**»

### Secciones R17 sin citar asignadas

- `B/21-migracion.md:477–580` ## 4. Lo que NO se migra, y no es una omisión — §4 — por qué acá: `D/16-fase-7-del-paraguas.md` §4.6 punto 1: `U1` borra «el archivo de configuración de planes y lo que lo lee (`B/21` §4)» — **parcial** (21% del texto en la spec; sobre todo en `01-decisiones-vigentes.md`): revisar qué falta

## `10-corte/U2.md`

### AC y tests nuevos (R7 · R7b · R18)

- `DEC-ARCH-017#📌7` — D/01-decision-log.md:7963 · **nuevo desde f80c0f2715** — dueña **U2**; también: B7 (implementa), B9a (implementa), V9a (usa); falla: R18 ≥1 de cualquier tipo de la lista cerrada; R7; R7b; tipos exigidos: ≥1 de cualquier tipo de la lista cerrada

### Ítems con contenido de fuente cambiado desde f80c0f2715

- **define**: `FILA:U2` (VIVO) — vieja `D/16-fase-7-del-paraguas.md:846` → nueva `D/16-fase-7-del-paraguas.md:851` — cambio: [-`B1`-] … {+`B1`; **y crea `domain_event` (`NUCLEO/02` §2.6), el registro de auditoría de `NUCLEO/08` §1, con todas sus restricciones —append-only y sin `deleted_at`—, porque es ancestro de todas las piezas que lo escriben** (corte del MVP, owner 2026-10-02, BW)+} … [-correos)*-] … {+correos)*; **y `domain_event` existe, append-only y sin `deleted_at`, y el evento lleva la correlación acuñada en el borde** (corte del MVP, owner 2026-10-02, BW)+}
- **define**: `LISTA:U2` (VIVO) — vieja `D/16-fase-7-del-paraguas.md:846` → nueva `D/16-fase-7-del-paraguas.md:851` — cambio: [-`B1`-] … {+`B1`; **y crea `domain_event` (`NUCLEO/02` §2.6), el registro de auditoría de `NUCLEO/08` §1, con todas sus restricciones —append-only y sin `deleted_at`—, porque es ancestro de todas las piezas que lo escriben** (corte del MVP, owner 2026-10-02, BW)+} … [-correos)*-] … {+correos)*; **y `domain_event` existe, append-only y sin `deleted_at`, y el evento lleva la correlación acuñada en el borde** (corte del MVP, owner 2026-10-02, BW)+}

### Citas sobre texto cambiado (reanclar.py, sin remapear)

- línea 35: `D/16-fase-7-del-paraguas.md:846` — texto en f80c0f2715: «| **U2** ✚ | **el outbox común** (FASE 5, owner 2026-09-30, lote 2 A y B; `NUCLEO/07` §1.4, `NUCLEO/08` §2.4): el mecanismo de `NUCLEO/07` §1 y §2 construido sobre el precedente del newsletter, **la supresión del §4 de e» — candidata en 17f9702675: `D/16-fase-7-del-paraguas.md:851` «| **U2** ✚ | **el outbox común** (FASE 5, owner 2026-09-30, lote 2 A y B; `NUCLEO/07` §1.4, `NUCLEO/08` §2.4): el mecanismo de `NUCLEO/07` §1 y §2 construido sobre el precedente del newsletter,**la supresión del §4 de e»
- línea 53: `D/16-fase-7-del-paraguas.md:846` — texto en f80c0f2715: «| **U2** ✚ | **el outbox común** (FASE 5, owner 2026-09-30, lote 2 A y B; `NUCLEO/07` §1.4, `NUCLEO/08` §2.4): el mecanismo de `NUCLEO/07` §1 y §2 construido sobre el precedente del newsletter, **la supresión del §4 de e» — candidata en 17f9702675: `D/16-fase-7-del-paraguas.md:851` «| **U2** ✚ | **el outbox común** (FASE 5, owner 2026-09-30, lote 2 A y B; `NUCLEO/07` §1.4, `NUCLEO/08` §2.4): el mecanismo de `NUCLEO/07` §1 y §2 construido sobre el precedente del newsletter,**la supresión del §4 de e»

## `10-corte/V1.md`

### Secciones R17 sin citar asignadas

- `V/10-verticales-planes-billing-options.md:31–50` ## 1. Las cinco verticales contra los ocho ítems del Eje 2 — §1 — por qué acá: `V/descomposicion.md:61`, capítulos de V1: `10` §1 — **contenido ausente** (0%)
- `V/10-verticales-planes-billing-options.md:51–68` ### 1.1 Lo que la tabla hace visible — §1.1 — por qué acá: `V/descomposicion.md:61`, capítulos de V1: `10` §1 — **contenido ausente** (2%)
- `V/10-verticales-planes-billing-options.md:69–86` ### 1.2 Lo que NO está en la tabla, y por qué — §1.2 — por qué acá: `V/descomposicion.md:61`, capítulos de V1: `10` §1 — **contenido ausente** (0%)

## `10-corte/V2.md`

### Secciones R17 sin citar asignadas

- `V/02-modelo-de-datos.md:23–24` ## 2. Las entidades — §2 — también: V4, V6 — por qué acá: encabezado de `02` §2: sus subsecciones son de V2, V4 y V6 (`V/descomposicion.md:62`, `:64`, `:66`) — encabezado (sin cuerpo propio): falta sólo la cita
- `V/02-modelo-de-datos.md:25–304` ### 2.1 Catálogo comercial — §2.1 — por qué acá: `V/descomposicion.md:62`, capítulos de V2: `02` §2.1 — **contenido ausente** (5%)
- `V/10-verticales-planes-billing-options.md:87–111` ## 2. Qué se lee del catálogo, y desde dónde — §2 — por qué acá: `V/descomposicion.md:62`, capítulos de V2: `10` §2 — **contenido ausente** (1%)
- `V/10-verticales-planes-billing-options.md:112–148` ### 2.1 Las dos últimas filas son de la FASE 9, y una mezcla a propósito — §2.1 — por qué acá: `V/descomposicion.md:62`, capítulos de V2: `10` §2 — **contenido ausente** (9%)

## `10-corte/V3.md`

### Secciones R17 sin citar asignadas

- `V/02-modelo-de-datos.md:651–655` ## 3. Caché e invalidación · cierra `M-ARCH-02` — §3 — por qué acá: `V/descomposicion.md:63`, capítulos de V3: `02` §3 — **contenido ausente** (4%)
- `V/02-modelo-de-datos.md:656–661` ### 3.1 Qué se cachea — §3.1 — por qué acá: `V/descomposicion.md:63`, capítulos de V3: `02` §3 — **parcial** (30% del texto en la spec; sobre todo en `10-corte/V3.md`): revisar qué falta
- `V/02-modelo-de-datos.md:662–729` ### 3.2 Se invalida por evento, no por tiempo — §3.2 — por qué acá: `V/descomposicion.md:63`, capítulos de V3: `02` §3 — **contenido ausente** (6%)
- `V/02-modelo-de-datos.md:730–737` ### 3.3 Lo que el caché nunca hace — §3.3 — por qué acá: `V/descomposicion.md:63`, capítulos de V3: `02` §3 — **contenido ausente** (12%)
- `V/15-entitlements-y-limits.md:29–44` ## 1. Tres cosas con scope, y confundirlas es el error de fondo — §1 — por qué acá: `V/descomposicion.md:63`, capítulos de V3: `15` §1–3 — **contenido ausente** (4%)
- `V/15-entitlements-y-limits.md:45–46` ## 2. Cómo se agrega cada limit · cierra `M-ENT-01` — §2 — por qué acá: `V/descomposicion.md:63`, capítulos de V3: `15` §1–3 — encabezado (sin cuerpo propio): falta sólo la cita
- `V/15-entitlements-y-limits.md:47–53` ### 2.1 El §37 generaliza un caso particular — §2.1 — por qué acá: `V/descomposicion.md:63`, capítulos de V3: `15` §1–3 — **contenido ausente** (0%)
- `V/15-entitlements-y-limits.md:54–73` ### 2.2 Cada clave declara su estrategia, y son dos familias — §2.2 — por qué acá: `V/descomposicion.md:63`, capítulos de V3: `15` §1–3 — **contenido ausente** (4%)
- `V/15-entitlements-y-limits.md:74–84` ### 2.3 Por qué la estrategia vive con la clave y no con el plan — §2.3 — por qué acá: `V/descomposicion.md:63`, capítulos de V3: `15` §1–3 — **contenido ausente** (0%)
- `V/15-entitlements-y-limits.md:85–90` ### 2.4 Cuando no acumula, gana el cliente — §2.4 — por qué acá: `V/descomposicion.md:63`, capítulos de V3: `15` §1–3 — **contenido ausente** (0%)
- `V/15-entitlements-y-limits.md:91–126` ### 2.5 Dos mecanismos que NO son esto — §2.5 — por qué acá: `V/descomposicion.md:63`, capítulos de V3: `15` §1–3 — **contenido ausente** (11%)
- `V/15-entitlements-y-limits.md:127–228` ### 2.6 El conjunto plegable: sin título, los complementos se descartan — §2.6 — por qué acá: `V/descomposicion.md:63`, capítulos de V3: `15` §1–3 — **contenido ausente** (10%)
- `V/15-entitlements-y-limits.md:229–230` ## 3. El scope global de una clave · cierra `M-ENT-03` — §3 — por qué acá: `V/descomposicion.md:63`, capítulos de V3: `15` §1–3 — encabezado (sin cuerpo propio): falta sólo la cita
- `V/15-entitlements-y-limits.md:231–241` ### 3.1 La asimetría — §3.1 — por qué acá: `V/descomposicion.md:63`, capítulos de V3: `15` §1–3 — **contenido ausente** (0%)
- `V/15-entitlements-y-limits.md:242–264` ### 3.2 La regla — §3.2 — por qué acá: `V/descomposicion.md:63`, capítulos de V3: `15` §1–3 — **contenido ausente** (8%)
- `V/15-entitlements-y-limits.md:265–277` ### 3.3 Una clave global otorgada por un plan de vertical se pierde con ese plan — §3.3 — por qué acá: `V/descomposicion.md:63`, capítulos de V3: `15` §1–3 — **contenido ausente** (0%)
- `V/15-entitlements-y-limits.md:278–333` ### 3.4 Y cada clave declara además su CLASE, que es lo que `G-R3` lee — §3.4 — por qué acá: `V/descomposicion.md:63`, capítulos de V3: `15` §1–3 — **contenido ausente** (3%)
- `V/15-entitlements-y-limits.md:430–431` ## 5. El visitante sin cuenta · cierra `A-ENT-02` — §5 — por qué acá: ⚠ fuera del `15` §1–3 de la fila de V3 (`V/descomposicion.md:63`); asignada por la regla del orquestador de la pasada 2 (V/15 → V3): confirmar — encabezado (sin cuerpo propio): falta sólo la cita
- `V/15-entitlements-y-limits.md:432–440` ### 5.1 Lo que el §36.2 dice y lo que no — §5.1 — por qué acá: ⚠ fuera del `15` §1–3 de la fila de V3 (`V/descomposicion.md:63`); asignada por la regla del orquestador de la pasada 2 (V/15 → V3): confirmar — **contenido ausente** (0%)
- `V/15-entitlements-y-limits.md:441–449` ### 5.2 La regla, y es por clase y no por clave — §5.2 — por qué acá: ⚠ fuera del `15` §1–3 de la fila de V3 (`V/descomposicion.md:63`); asignada por la regla del orquestador de la pasada 2 (V/15 → V3): confirmar — **contenido ausente** (0%)
- `V/15-entitlements-y-limits.md:450–464` ### 5.3 Por qué no una cuota chica para el guest — §5.3 — por qué acá: ⚠ fuera del `15` §1–3 de la fila de V3 (`V/descomposicion.md:63`); asignada por la regla del orquestador de la pasada 2 (V/15 → V3): confirmar — **contenido ausente** (2%)
- `V/15-entitlements-y-limits.md:465–466` ## 6. La suspensión y los beneficios heredados de turista · cierra `E-ENT-01` — §6 — por qué acá: ⚠ fuera del `15` §1–3 de la fila de V3 (`V/descomposicion.md:63`); asignada por la regla del orquestador de la pasada 2 (V/15 → V3): confirmar — encabezado (sin cuerpo propio): falta sólo la cita
- `V/15-entitlements-y-limits.md:467–473` ### 6.1 La trampa que dejó `DEC-ENT-003` — §6.1 — por qué acá: ⚠ fuera del `15` §1–3 de la fila de V3 (`V/descomposicion.md:63`); asignada por la regla del orquestador de la pasada 2 (V/15 → V3): confirmar — **parcial** (18% del texto en la spec; sobre todo en `01-decisiones-vigentes.md`): revisar qué falta
- `V/15-entitlements-y-limits.md:474–496` ### 6.2 La mitad grave se resuelve sola, y hay que decirlo — §6.2 — por qué acá: ⚠ fuera del `15` §1–3 de la fila de V3 (`V/descomposicion.md:63`); asignada por la regla del orquestador de la pasada 2 (V/15 → V3): confirmar — **contenido ausente** (3%)
- `V/15-entitlements-y-limits.md:497–512` ### 6.3 Y la otra mitad: sí, los pierde — §6.3 — por qué acá: ⚠ fuera del `15` §1–3 de la fila de V3 (`V/descomposicion.md:63`); asignada por la regla del orquestador de la pasada 2 (V/15 → V3): confirmar — **contenido ausente** (2%)
- `V/15-entitlements-y-limits.md:513–566` ## 7. La ventana de la cuota mensual · cierra la implicación 2 de `DEC-ENT-002` — §7 — por qué acá: ⚠ fuera del `15` §1–3 de la fila de V3 (`V/descomposicion.md:63`); asignada por la regla del orquestador de la pasada 2 (V/15 → V3): confirmar — **parcial** (18% del texto en la spec; sobre todo en `10-corte/V3.md`): revisar qué falta
- `V/15-entitlements-y-limits.md:567–594` ## Lo que este capítulo NO cierra — §NC — por qué acá: ⚠ fuera del `15` §1–3 de la fila de V3 (`V/descomposicion.md:63`); asignada por la regla del orquestador de la pasada 2 (V/15 → V3): confirmar — **ya cubierto, falta sólo la cita** (91% del texto en la spec; sobre todo en `80-abiertos.md`)

## `10-corte/V4.md`

### Ítems con contenido de fuente cambiado desde f80c0f2715

- **define**: `FILA:V4` (VIVO) — vieja `V/descomposicion.md:64` → nueva `V/descomposicion.md:64` — cambio: [-§4.1)-] … {+§4.1); **y encola los avisos del trial en el outbox de `U2`, que la precede** (corte del MVP, owner 2026-10-02, BR)+}

### Citas sobre texto cambiado (reanclar.py, sin remapear)

- línea 57: `V/descomposicion.md:64` — texto en f80c0f2715: «| **V4** | **El contrato de cobertura y el trial** | hay títulos vivos de verdad, y `cobertura()` responde **con la firma entera del contrato §2** —hoy ~~siete campos, con `piso` (9h)~~ ocho campos, con `piso` (9h) y `de» — candidata en 17f9702675:`V/descomposicion.md:64` «| **V4** | **El contrato de cobertura y el trial** | hay títulos vivos de verdad, y `cobertura()` responde **con la firma entera del contrato §2** —hoy ~~siete campos, con `piso` (9h)~~ ocho campos, con `piso` (9h) y `de»

### Secciones R17 sin citar asignadas

- `V/descomposicion.md:293–320` ### 2.8 El predicado global de `G-R6`, y por qué el reparto no lo tocaba — §2.8 — por qué acá: `V/descomposicion.md:184`: `G-R6` → V4 en la tabla de guards — **contenido ausente** (9%)
- `V/02-modelo-de-datos.md:305–446` ### 2.2 Compromiso y ciclo de vida — §2.2 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `02` §2.2 — **contenido ausente** (9%)
- `V/11-trial.md:44–45` ## 1. El reloj del trial es calendario · cierra `E-TRIAL-02` — §1 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — encabezado (sin cuerpo propio): falta sólo la cita
- `V/11-trial.md:46–52` ### 1.1 El caso — §1.1 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **contenido ausente** (0%)
- `V/11-trial.md:53–72` ### 1.2 La regla — §1.2 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **contenido ausente** (0%)
- `V/11-trial.md:73–74` ## 2. Una baja que decidimos nosotros · cierra `E-TRIAL-04` — §2 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — encabezado (sin cuerpo propio): falta sólo la cita
- `V/11-trial.md:75–86` ### 2.1 El caso — §2.1 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **contenido ausente** (0%)
- `V/11-trial.md:87–99` ### 2.2 No hay excepción, porque no son el mismo caso — §2.2 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **contenido ausente** (0%)
- `V/11-trial.md:100–114` ### 2.3 Y la reparación no rebobina la máquina — §2.3 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **contenido ausente** (1%)
- `V/11-trial.md:115–141` ### 2.4 Y revocar un grant NO entra acá, aunque se le parezca — §2.4 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **parcial** (31% del texto en la spec; sobre todo en `01-decisiones-vigentes.md`): revisar qué falta
- `V/11-trial.md:142–143` ## 3. El techo de días de trial · cierra `OD-TRIAL-01` — §3 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — encabezado (sin cuerpo propio): falta sólo la cita
- `V/11-trial.md:144–151` ### 3.1 El caso — §3.1 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **contenido ausente** (0%)
- `V/11-trial.md:152–160` ### 3.2 Hay techo, y es un número configurable — §3.2 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **contenido ausente** (0%)
- `V/11-trial.md:161–169` ### 3.3 Qué pasa con la extensión que no entra — §3.3 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **contenido ausente** (0%)
- `V/11-trial.md:170–187` ### 3.4 El techo ata al promo y no ata a `SUPER_ADMIN` — §3.4 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **contenido ausente** (5%)
- `V/11-trial.md:188–196` ### 3.5 La mitad del hueco que era la visibilidad — §3.5 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **contenido ausente** (0%)
- `V/11-trial.md:197–198` ## 4. La cuota del trial en los entitlements medidos · cierra `S-TRIAL-01` — §4 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — encabezado (sin cuerpo propio): falta sólo la cita
- `V/11-trial.md:199–206` ### 4.1 Lo que ya estaba decidido, y lo que faltaba — §4.1 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **contenido ausente** (4%)
- `V/11-trial.md:207–222` ### 4.2 La cuota del trial se resuelve por `user + vertical`, y por eso se multiplica — §4.2 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **contenido ausente** (0%)
- `V/11-trial.md:223–247` ### 4.3 La cuota del trial ~~no se resetea~~ se renueva cada mes, desde el día en que arrancó — §4.3 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **contenido ausente** (9%)
- `V/11-trial.md:248–249` ## 5. Addons con un trial en el medio · cierra `A-TRIAL-02` — §5 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — encabezado (sin cuerpo propio): falta sólo la cita
- `V/11-trial.md:250–259` ### 5.1 El caso — §5.1 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **contenido ausente** (12%)
- `V/11-trial.md:260–274` ### 5.2 Son dos preguntas y tienen respuestas distintas — §5.2 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **contenido ausente** (0%)
- `V/11-trial.md:275–293` ### 5.3 La regla que hace falta, y es una sola — §5.3 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **contenido ausente** (2%)
- `V/11-trial.md:294–295` ## 6. La campaña de recuperación · cierra `M-TRIAL-03` — §6 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — encabezado (sin cuerpo propio): falta sólo la cita
- `V/11-trial.md:296–302` ### 6.1 Lo que ya resolvió el capítulo 07 — §6.1 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **contenido ausente** (0%)
- `V/11-trial.md:303–317` ### 6.2 Lo que falta es la superposición, y no se resuelve suprimiendo — §6.2 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **contenido ausente** (0%)
- `V/11-trial.md:318–338` ### 6.3 El corte al suscribirse es por vertical — §6.3 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **contenido ausente** (0%)
- `V/11-trial.md:339–347` ### 6.4 Y la campaña termina — §6.4 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **contenido ausente** (0%)
- `V/11-trial.md:348–385` ## 7. El cruce que no existe · disuelve `E-TRIAL-03` — §7 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **contenido ausente** (3%)
- `V/11-trial.md:386–403` ## 8. ~~El día que una vertical enciende su trial~~ Los días de prueba de una vertical no pasan de cero a más ni al revés — §8 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **contenido ausente** (11%)
- `V/11-trial.md:404–407` ## 9. Suscribirse durante el trial termina el trial — §9 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **ya cubierto, falta sólo la cita** (100% del texto en la spec; sobre todo en `04-catalogos.md`)
- `V/11-trial.md:408–417` ### 9.1 La regla, que el owner ya había decidido y no estaba escrita — §9.1 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **parcial** (41% del texto en la spec; sobre todo en `01-decisiones-vigentes.md`): revisar qué falta
- `V/11-trial.md:418–430` ### 9.2 Lo que termina el trial es el cobro, no la autorización — §9.2 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **contenido ausente** (12%)
- `V/11-trial.md:431–436` ### 9.3 Lo que la superficie tiene que decir — §9.3 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **contenido ausente** (0%)
- `V/11-trial.md:437–459` ### 9.4 Y suscribirse antes de publicar tampoco quema el trial — §9.4 — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **parcial** (38% del texto en la spec; sobre todo en `04-catalogos.md`): revisar qué falta
- `V/11-trial.md:460–474` ## Lo que este capítulo NO cierra — §NC — por qué acá: `V/descomposicion.md:64`, capítulos de V4: `11` entero — **ya cubierto, falta sólo la cita** (82% del texto en la spec; sobre todo en `80-abiertos.md`)

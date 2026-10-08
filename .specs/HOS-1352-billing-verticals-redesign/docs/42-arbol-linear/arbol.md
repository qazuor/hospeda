# Árbol Linear de HOS-1352 — de la spec consolidada a issues

Fuentes: `spec-consolidada/10-corte/` y `20-fase-*/` (ACs nominales), `docs/41-corte-del-mvp/aristas.py` (dependencias entre piezas), el árbol real de Linear y, desde el 2026-10-07, el grafo de hojas reparado (las dos auditorías de dependencias) con las decisiones del corte del MVP (CR a DD y Coord-1 a Coord-11 en `docs/41-corte-del-mvp/10-decisiones-del-owner.md`). Cada nodo es una issue: `↻HOS-n` = contenedor existente que se reusa; `HOS-n` = hoja ya creada; *(nueva)* = issue a crear. Las hojas son unidades de PR; sólo las hojas llevan ACs. Cada hoja declara su fase (`corte`: hecha, mvp, fase-1 a fase-4), si es la salida de su pieza (`salida`) y, en el MVP, qué usa de cada hoja de la que depende (`por_que`). Validar: `python3 chequeo.py` (exit 0 = árbol sano).

Estadísticas: 264 nodos · 28 existentes reusados · 210 hojas de PR · 528 ACs cubiertas (exactamente una hoja por AC).

Por fase: 21 hechas · **131 del MVP por hacer (322 AC)** · 5 de la Fase 1 · 27 de la Fase 2 · 10 de la Fase 3 · 16 de la Fase 4. Camino crítico del MVP: **24 hojas**; calendario: **14 olas, 64 PRs** (abajo).

- **HOS-1352 ↻HOS-1352** — Rediseño integral de Verticales, Billing, Trials, Entitlements, Limits y Complementos
  - **HOS-1353 ↻HOS-1353** — Épica Verticales — capacidades, entitlements, limits y autorización, sin dependencia de la pasarela
    - **HOS-1362 ↻HOS-1362** — V8 · Superficies
      - **V8a** — V8a · Superficies, al corte ← V6
        - **V8a.1 `HOS-1491`** — V8a · Superficies, botones y mensajes de fichas (PR 1/4, parte 1/2) · 3 AC ← V6.1
        - **V8a.1b `HOS-1492`** — V8a · Superficies, botones y mensajes de fichas (PR 1/4, parte 2/2) · 3 AC ← V6.5, V8a.1
        - **V8a.2 `HOS-1493`** — V8a · Acciones 15 y 23 (PR 2/4) · 3 AC ← V6.5
        - **V8a.3 `HOS-1494`** — V8a · Acción 24: la baja de cuenta (PR 3/4) · 4 AC ← V6.11, V8a.2
        - **V8a.4 `HOS-1495`** — V8a · Salida (PR 4/4) · 1 AC ← V8a.1b, V8a.3
      - **V8b** — V8b · Superficies de Partner (Fase 4) ← V6, V7, V8a
        - **V8b.1 `HOS-1496`** — V8b · Panel de postulaciones y filas de presencia (PR 1/2, parte 1/2) · 3 AC · **Fase 4** ← V6.13, V7.6, V8a.4
        - **V8b.1b `HOS-1497`** — V8b · Panel de postulaciones y filas de presencia (PR 1/2, parte 2/2) · 2 AC · **Fase 4** ← V8b.1
        - **V8b.2 `HOS-1498`** — V8b · Acción 25 y salida (PR 2/2) · 2 AC · **Fase 4** ← V8b.1b
    - **HOS-1363 ↻HOS-1363** — V9 · Retención
      - **V9a** — V9a · El registro de los actos del dueño ← U2, V4, V6
        - **V9a.1 `HOS-1499`** — V9a · El registro de hechos de contenido (corte) (PR 1/1, parte 1/2) · 3 AC
        - **V9a.1b `HOS-1500`** — V9a · El registro de hechos de contenido (corte) (PR 1/1, parte 2/2) · 2 AC ← V6.9, V9a.1, V9a.1c
        - **V9a.1c *(nueva)*** — V9a · Editar FAQ, fotos y las demás subentidades es un acto del dueño (V9a.1c) · 2 AC ← V9a.1
      - **V9b** — V9b · Retención ← U2, V4, V6, V9a
        - **V9b.1 `HOS-1501`** — V9b · El borrado del día 180 (PR 1/5) · 3 AC · **Fase 1** ← U2.4, V4.7, V6.13, V9a.1b
        - **V9b.2 `HOS-1502`** — V9b · Calendario, borrados remotos y plazos (PR 2/5) · 2 AC · **Fase 1** ← V9b.1
        - **V9b.3 `HOS-1503`** — V9b · PB9, PB8 y PURGED bajo el lock (PR 3/5) · 4 AC · **Fase 1** ← V9b.2
        - **V9b.4 `HOS-1504`** — V9b · El reloj, los avisos y la llegada de la Fase 1 (PR 4/5) · 4 AC · **Fase 1** ← V9b.3
        - **V9b.5 `HOS-1505`** — V9b · Salida (PR 5/5) · 1 AC · **Fase 1** ← V9b.4
    - **V1 ↻HOS-1355** — V1 · El catálogo y su doble guard ← U1
      - **V1.1 `HOS-1430`** — V1 · Catálogo de verticales y de claves (PR 1/4) · 2 AC · ✓ hecha ← U1.6
      - **V1.2 `HOS-1431`** — V1 · Guards del catálogo: G3, G18 y G1 (PR 2/4) · 3 AC · ✓ hecha ← V1.1
      - **V1.3 `HOS-1432`** — V1 · El package del contrato: interfaces, validaciones y simuladores (PR 3/4) · 2 AC · ✓ hecha ← V1.2
      - **V1.4 `HOS-1433`** — V1 · Trigger de set_updated_at y salida (PR 4/4) · 2 AC · ✓ hecha ← V1.3
    - **V2 ↻HOS-1356** — V2 · El catálogo de planes ← V1
      - **V2.1 `HOS-1434`** — V2 · Plan mutable y versión inmutable (PR 1/5) · 2 AC
      - **V2.2 `HOS-1435`** — V2 · Las tres consultas del contrato de planes (PR 2/5) · 3 AC ← V2.1
      - **V2.3 `HOS-1436`** — V2 · Acción 18: publicar una versión de plan (PR 3/5) · 2 AC ← B2.1, V2.1
      - **V2.4 `HOS-1437`** — V2 · Catálogo de producción y seed (PR 4/5) · 2 AC ← V2.3
      - **V2.5 `HOS-1438`** — V2 · Salida (PR 5/5) · 1 AC ← V2.2, V2.4
    - **V3 ↻HOS-1357** — V3 · La resolución de capacidades ← V2
      - **V3.1 `HOS-1439`** — V3 · Agregación de limits y descartes (PR 1/4) · 2 AC ← V2.1
      - **V3.2 `HOS-1440`** — V3 · Scope de claves y resolución del plan de trial (PR 2/4) · 3 AC ← V3.1
      - **V3.3 `HOS-1441`** — V3 · Caché del conjunto efectivo en Redis (PR 3/4) · 2 AC ← V3.2
      - **V3.4 `HOS-1442`** — V3 · Verticales simultáneas, cuota mensual y salida (PR 4/4) · 3 AC ← V3.3
    - **V4 ↻HOS-1358** — V4 · El contrato de cobertura y el trial ← B1, U2, V3
      - **V4.1 `HOS-1443`** — V4 · La fila de trial y el seudónimo (PR 1/7) · 3 AC ← V2.1
      - **V4.2 `HOS-1444`** — V4 · T1: el arranque del trial (PR 2/7) · 2 AC ← V3.4, V4.1, V4.5
      - **V4.3 `HOS-1445`** — V4 · T2 a T4, la acción 11 y el vencimiento (PR 3/7) · 4 AC ← V4.2
      - **V4.4 `HOS-1446`** — V4 · T6 y T8: suscripción sin cobrar y primer pago (PR 4/7) · 1 AC ← V4.2, V4.3, V6.1
      - **V4.5 `HOS-1447`** — V4 · La implementación de arranque y G13 (PR 5/7) · 2 AC ← V4.1
      - **V4.6 `HOS-1448`** — V4 · Guards de racimos, reloj y avisos en el outbox (PR 6/7) · 3 AC ← V4.3, V4.4
      - **V4.7 `HOS-1449`** — V4 · El trial de punta a punta y salida (PR 7/7) · 2 AC ← B3.12, V4.6
    - **V5 ↻HOS-1359** — V5 · La autorización ← V4
      - **V5.G1** — V5 · Los siete pasos y el sujeto (subgrupo)
        - **V5.1 `HOS-1455`** — V5 · Paso 4: lo ajeno, lo archivado y lo inexistente (PR 1/10) · 3 AC ← V4.5, V6.8a
        - **V5.2 `HOS-1456`** — V5 · La vertical del recurso, lo público y las conversaciones (PR 2/10) · 4 AC ← V5.1
      - **V5.G2** — V5 · El actor administrativo (subgrupo)
        - **V5.3 `HOS-1457`** — V5 · Acciones administrativas, sujeto y paso de cobertura (PR 3/10) · 3 AC ← V5.2
        - **V5.4 `HOS-1458`** — V5 · Sin impersonación y fullAdminRole (PR 4/10) · 2 AC
      - **V5.G3** — V5 · El actor de sistema y el rol (subgrupo)
        - **V5.5 `HOS-1459`** — V5 · Fábrica de actor de sistema y G19 (PR 5/10) · 2 AC ← V5.3
        - **V5.6 `HOS-1460`** — V5 · SUPER_ADMIN: permisos, acción 26 y concesiones (PR 6/10) · 3 AC ← B9a.1, V5.3
        - **V5.7 `HOS-1461`** — V5 · El guest y la lectura pública (PR 7/10) · 1 AC ← V5.1
      - **V5.G4** — V5 · Guards de autorización (subgrupo)
        - **V5.8 `HOS-1462`** — V5 · G6 y G4: el rol no decide y no escribe (PR 8/10) · 3 AC ← V4.6, V5.3
        - **V5.9 `HOS-1463`** — V5 · G-R3-B, G-R3-C y G2 (PR 9/10) · 3 AC ← V4.6, V5.2, V5.3
      - **V5.G5** — V5 · Salida (subgrupo)
        - **V5.10 `HOS-1464`** — V5 · Salida (PR 10/10) · 1 AC ← V5.4, V5.5, V5.6, V5.7, V5.8, V5.9
    - **V6 ↻HOS-1360** — V6 · Publicación y excedente ← U2, V5
      - **V6.G1** — V6 · Publicar y despublicar (subgrupo)
        - **V6.1 `HOS-1471`** — V6 · PB1, el lock y PB2 (PR 1/13) · 4 AC ← V4.3, V5.3, V6.8a, V6.9
        - **V6.2 `HOS-1472`** — V6 · Los avisos al archivar (PR 2/13) · 1 AC ← V6.1, V6.4
      - **V6.G2** — V6 · El excedente (subgrupo)
        - **V6.3 `HOS-1473`** — V6 · Excedente en las dos direcciones y G5 (PR 3/13) · 3 AC ← V6.1
        - **V6.4 `HOS-1474`** — V6 · PB4, PB5 y las salidas de ARCHIVED (PR 4/13) · 3 AC ← V6.3, V6.9
      - **V6.G3** — V6 · Moderación y borrado (subgrupo)
        - **V6.5 `HOS-1475`** — V6 · Moderación en dos niveles y PB12 (PR 5/13) · 3 AC ← V6.4
        - **V6.6 `HOS-1476`** — V6 · G-R9, G-R6-B y la corrida de reintentos (PR 6/13) · 3 AC ← V6.5
        - **V6.7 `HOS-1477`** — V6 · Sin puertas de borrado fuera del diseño (PR 7/13) · 1 AC ← V6.5
      - **V6.G4** — V6 · El modelo listing y su migración (subgrupo)
        - **V6.8a `HOS-1478`** — V6 · El modelo aditivo sobre las tres tablas (V6.8a) · 1 AC
        - **V6.9 `HOS-1479`** — V6 · La migración del paso 3, su herramienta y la medición (PR 9/13) · 4 AC ← V2.4, V4.2, V6.8a
        - **V6.9b *(nueva)*** — V6 · Las seis columnas viejas salen con sus lectores (V6.9b) · 1 AC ← V5.2, V6.2, V6.6, V6.7, V6.9
        - **V6.10 `HOS-1480`** — V6 · Plazos de verticales y la acción 22 (PR 10/13) · 1 AC
        - **V6.11 `HOS-1481`** — V6 · La migración de partners para V7 (PR 11/13) · 2 AC ← V6.10
      - **V6.G5** — V6 · Pasos del corte (subgrupo)
        - **V6.12 `HOS-1482`** — V6 · Pasos 5b, 4c y 6 (PR 12/13) · 3 AC ← V6.9
      - **V6.G6** — V6 · Salida (subgrupo)
        - **V6.13 `HOS-1483`** — V6 · Consultas del contrato y salida (PR 13/13) · 2 AC ← V6.11, V6.12, V6.9b
    - **V7 ↻HOS-1361** — V7 · Partner ← B5, V5
      - **V7.1 `HOS-1484`** — V7 · Postulación: PP1, PP2 y PP3 (PR 1/6, parte 1/2) · 4 AC · **Fase 4** ← B5.9, V5.10
      - **V7.1b `HOS-1485`** — V7 · Postulación: PP1, PP2 y PP3 (PR 1/6, parte 2/2) · 3 AC · **Fase 4** ← V7.1
      - **V7.2 `HOS-1486`** — V7 · El reclamo y su link (PR 2/6) · 4 AC · **Fase 4** ← V7.1b
      - **V7.3 `HOS-1487`** — V7 · Alta admin y rol de socio (PR 3/6) · 3 AC · **Fase 4** ← V7.2
      - **V7.4 `HOS-1488`** — V7 · Presencia y moderación (PR 4/6) · 2 AC · **Fase 4** ← V7.3
      - **V7.5 `HOS-1489`** — V7 · Leads, lectores y acción 6 (PR 5/6) · 3 AC · **Fase 4** ← V7.4
      - **V7.6 `HOS-1490`** — V7 · Salida (PR 6/6) · 1 AC · **Fase 4** ← V7.5
  - **HOS-1354 ↻HOS-1354** — Épica Billing — cobro, suscripción y proveedor detrás de un adaptador
    - **HOS-1371 ↻HOS-1371** — B8 · Los cambios del compromiso
      - **B8a** — B8a · La baja ← B7
        - **B8a.1 `HOS-1568`** — B8a · La baja desde ACTIVE (S11) (PR 1/5) · 3 AC ← B7.5
        - **B8a.2 `HOS-1569`** — B8a · S12: el fin programado (PR 2/5) · 2 AC ← B5.6
        - **B8a.3 `HOS-1570`** — B8a · Bajas desde SUSPENDED y GRACE_PERIOD (PR 3/5) · 3 AC ← B7.2, B7.4b, B8a.1
        - **B8a.4 `HOS-1571`** — B8a · Los cobros que cruzan la baja (PR 4/5) · 2 AC ← B8a.1, B8a.3
        - **B8a.5 `HOS-1572`** — B8a · Las prohibidas y salida (PR 5/5) · 3 AC ← B8a.2, B8a.4
        - **B8a.6 *(nueva)*** — B8a · S12 por un contracargo (Fase 2) · 1 AC · **Fase 2** ← B8a.5
      - **B8b** — B8b · Los cambios del compromiso (después) ← B7, B8a, V2
        - **B8b.1 `HOS-1573`** — B8b · Pausar y reanudar (S8 y S10) (PR 1/6, parte 1/2) · 4 AC · **Fase 2** ← B7.9, B8a.5, V2.5
        - **B8b.1b `HOS-1574`** — B8b · Pausar y reanudar (S8 y S10) (PR 1/6, parte 2/2) · 3 AC · **Fase 2** ← B8b.1
        - **B8b.2 `HOS-1575`** — B8b · La sucesión: S17, S18 y sus ramas (PR 2/6, parte 1/2) · 4 AC · **Fase 2** ← B8b.1b
        - **B8b.2b `HOS-1576`** — B8b · La sucesión: S17, S18 y sus ramas (PR 2/6, parte 2/2) · 3 AC · **Fase 2** ← B8b.2
        - **B8b.3 `HOS-1577`** — B8b · La cola del cambio (S38) y sus colisiones (PR 3/6, parte 1/2) · 4 AC · **Fase 2** ← B8b.2b
        - **B8b.3b `HOS-1578`** — B8b · La cola del cambio (S38) y sus colisiones (PR 3/6, parte 2/2) · 4 AC · **Fase 2** ← B8b.3
        - **B8b.4 `HOS-1579`** — B8b · G-R1-C y la implementación real (PR 4/6) · 2 AC · **Fase 2** ← B8b.3b
        - **B8b.5 `HOS-1580`** — B8b · El panel y lo que hay que decir (PR 5/6) · 2 AC · **Fase 2** ← B8b.4
        - **B8b.6 `HOS-1581`** — B8b · Punta a punta y salida (PR 6/6) · 2 AC · **Fase 2** ← B8b.5
    - **HOS-1372 ↻HOS-1372** — B9 · Las concesiones
      - **B9a** — B9a · Los grants ← B4, B8a, V2
        - **B9a.1 `HOS-1582`** — B9a · Otorgar el grant corta el cobro (S13) (PR 1/5, parte 1/2) · 3 AC ← B4.2, B7.7
        - **B9a.1b `HOS-1583`** — B9a · Otorgar el grant corta el cobro (S13) (PR 1/5, parte 2/2) · 2 AC ← B9a.1
        - **B9a.2 `HOS-1584`** — B9a · Revocar, fugas y límites (PR 2/5) · 2 AC ← B9a.1
        - **B9a.3 `HOS-1585`** — B9a · Scope, piso y fuentes reales (PR 3/5) · 3 AC ← B9a.1
        - **B9a.4 `HOS-1586`** — B9a · El cobro que entra después y el fan-out (PR 4/5) · 1 AC ← B9a.3
        - **B9a.5 `HOS-1587`** — B9a · Salida (PR 5/5) · 1 AC ← B9a.1b, B9a.2, B9a.4
        - **B9a.6 *(nueva)*** — B9a · Revocar y la fuga de USER/GLOBAL (Fase 2) · 2 AC · **Fase 2** ← B9a.5
        - **B9a.7 *(nueva)*** — B9a · El grant a quien paga: cobro posterior, fan-out y rama 4 (Fase 2) · 3 AC · **Fase 2** ← B9a.6
      - **B9b** — B9b · Promos y cortesías (después) ← B8b, B9a, V4
        - **B9b.1 `HOS-1588`** — B9b · Composición de promos, piso y canje de extensión de trial (al corte) · 3 AC ← B11.3, B5.1, V4.7
        - **B9b.2 `HOS-1589`** — B9b · Cupo, ventana y contador de la promo (S30) (al corte) · 3 AC ← B9b.1
        - **B9b.3 `HOS-1590`** — B9b · Cortesías temporales y sus cruces (Fase 2) · 3 AC · **Fase 2** ← B9b.4, B8b.6, B9a.5
        - **B9b.4 `HOS-1591`** — B9b · La acción 21, el aviso del canje y salida de la rebanada (al corte) · 2 AC ← B13a.4, B13a.9, B9b.2, V5.6
        - **B9b.5 `HOS-1592`** — B9b · La cortesía temporal auditada, re-emisión, textos y salida (Fase 2) · 3 AC · **Fase 2** ← B9b.3, B9a.6
    - **HOS-1376 ↻HOS-1376** — B13 · Superficies y la baja
      - **B13a** — B13a · Superficies y la baja, al corte ← B5, B7, B8a, B9a
        - **B13a.1 `HOS-1617`** — B13a · La baja self-service y los avisos del grace (PR 1/8) · 3 AC ← B7.8, B8a.3
        - **B13a.2 `HOS-1618`** — B13a · Fichas borradas: qué se pierde (PR 2/8) · 2 AC ← B3.5, V6.5
        - **B13a.3 `HOS-1619`** — B13a · Confirmaciones de grants y anclas (Fase 2) · 1 AC · **Fase 2** ← B13a.8, B9a.6
        - **B13a.4 `HOS-1620`** — B13a · Mi Suscripción y la cortesía diferida (PR 4/8) · 3 AC ← B13a.1, B5.7b
        - **B13a.5 `HOS-1621`** — B13a · Botones, pricing y ninguna pantalla esconde (PR 5/8) · 3 AC ← B13a.4, B5.3, V5.3, V8a.1
        - **B13a.6 `HOS-1622`** — B13a · Avisos de renovación y smoke del sistema nuevo (PR 6/8) · 2 AC ← B3.11, B5.1
        - **B13a.7 `HOS-1623`** — B13a · Las tres filas del corte: 10-bis, 11 y 22 (PR 7/8) · 2 AC ← B13a.1, B7.8
        - **B13a.8 `HOS-1624`** — B13a · La cancelación de punta a punta y salida (PR 8/8) · 2 AC ← B13a.10, B13a.2, B13a.5, B13a.6, B13a.7, B8a.5
        - **B13a.9 *(nueva)*** — B13a · Limpieza del cobro viejo en la web · 3 AC
        - **B13a.10 *(nueva)*** — B13a · Limpieza del cobro viejo en el admin y el guard de endpoints · 2 AC ← B13a.9, V3.4
        - **B13a.11 *(nueva)*** — B13a · El contracargo en el listado accionable (Fase 2) · 1 AC · **Fase 2** ← B13a.8, B5.2b
        - **B13a.12 *(nueva)*** — B13a · La fila 10-bis del pago manual tardío (Fase 4) · 1 AC · **Fase 4** ← B13a.8, B5.4b
      - **B13b** — B13b · Las superficies de addons (después) ← B10, B13a
        - **B13b.1 `HOS-1625`** — B13b · Moderación, despublicado y el editor (Fase 3) (PR 1/1) · 4 AC · **Fase 3** ← B10.4, B13a.8
    - **B1 ↻HOS-1364** — B1 · El adaptador y el proveedor que miente ← U1
      - **B1.1 `HOS-1506`** — B1 · La interfaz del dominio y el package compartido (PR 1/7) · 2 AC · ✓ hecha ← U1.6
      - **B1.2 `HOS-1507`** — B1 · Relectura e instante: ninguna decisión vieja (PR 2/7) · 3 AC · ✓ hecha ← B1.1
      - **B1.3 `HOS-1508`** — B1 · Guards del adaptador: G9 a G12, G16 y G17 (PR 3/7, parte 1/2) · 3 AC · ✓ hecha ← B1.2
      - **B1.3b `HOS-1509`** — B1 · Guards del adaptador: G9 a G12, G16 y G17 (PR 3/7, parte 2/2) · 3 AC · ✓ hecha ← B1.3
      - **B1.4 `HOS-1510`** — B1 · El falso: listas cerradas, mentiras y reglas (PR 4/7) · 3 AC
      - **B1.6 `HOS-1512`** — B1 · La batería de vigilancia al proveedor (Fase 4) · 3 AC · **Fase 4** ← B1.7
      - **B1.7 `HOS-1513`** — B1 · Salida (PR 7/7) · 1 AC ← B1.4
    - **B2 ↻HOS-1365** — B2 · El precio ← V2
      - **B2.1 `HOS-1514`** — B2 · billing_option cuelga de la versión (PR 1/4) · 3 AC ← V2.1
      - **B2.2 `HOS-1515`** — B2 · Acción 19: fijar el precio (Fase 2) · 4 AC · **Fase 2** ← B2.4
      - **B2.3 `HOS-1516`** — B2 · La tabla de plazos y su versión 1 (PR 3/4) · 4 AC ← V2.1
      - **B2.4 `HOS-1517`** — B2 · Salida (PR 4/4) · 1 AC ← B2.1, B2.3
    - **B3 ↻HOS-1366** — B3 · El alta y su ventana ← B1, B2, U2, V2
      - **B3.1 `HOS-1518`** — B3 · El alta nace pendiente, con candado y preapproval (PR 1/11, parte 1/2) · 4 AC ← B1.4, B3.9, V2.2
      - **B3.1b `HOS-1519`** — B3 · El alta nace pendiente, con candado y preapproval (PR 1/11, parte 2/2) · 1 AC ← B1.4, B3.1
      - **B3.2 `HOS-1520`** — B3 · La sucesión antes de B8b y el invariante 8 (PR 2/11) · 2 AC ← B3.1
      - **B3.3 `HOS-1521`** — B3 · Activación, ventana y sus ramas (PR 3/11, parte 1/2) · 3 AC ← B2.3, B3.1b
      - **B3.3b `HOS-1522`** — B3 · Activación, ventana y sus ramas (PR 3/11, parte 2/2) · 2 AC ← B3.3
      - **B3.4 `HOS-1523`** — B3 · La marca y el catálogo de motivos (PR 4/11) · 4 AC ← B3.3b
      - **B3.5 `HOS-1524`** — B3 · Rechazos, espejos y avisos sin estado (PR 5/11, parte 1/2) · 3 AC ← B3.4
      - **B3.5b `HOS-1525`** — B3 · Rechazos, espejos y avisos sin estado (PR 5/11, parte 2/2) · 3 AC ← B3.5
      - **B3.6 `HOS-1526`** — B3 · Receptor real, ensayo y producción (PR 6/11) · 4 AC ← B3.12, B3.5b, U3.3
      - **B3.7 `HOS-1527`** — B3 · Los guards de sucesión: G-R1-A/B/E/F (PR 7/11) · 4 AC ← B3.4
      - **B3.8 `HOS-1528`** — B3 · Turista VIP (PR 8/11) · 3 AC ← B3.3, V3.4
      - **B3.9 `HOS-1529`** — B3 · Esquema de lo que llega después y migraciones (PR 9/11) · 3 AC ← B2.1, V2.2
      - **B3.10 `HOS-1530`** — B3 · Ramas escritas sin ruta y apoyos (PR 10/11) · 3 AC ← B3.3, B3.5, B3.7, B3.9
      - **B3.11 `HOS-1531`** — B3 · Salida (PR 11/11) · 1 AC ← B3.10, B3.2, B3.6, B3.8
      - **B3.12 `HOS-1511`** — B3 · El falso como servidor HTTP con reloj (antes B1.5) · 1 AC ← B1.4, B3.5b
      - **B3.13 *(nueva)*** — B3 · El predicado de CC sobre la acción 19 (Fase 2) · 1 AC · **Fase 2** ← B3.11, B2.2
      - **B3.14 *(nueva)*** — B3 · El alta del pagador manual (Fase 4) · 1 AC · **Fase 4** ← B3.11
    - **B4 ↻HOS-1367** — B4 · El contrato de cobertura, de verdad ← B3, B5, U2, V4
      - **B4.1 `HOS-1532`** — B4 · La cobertura sale de la fuente (PR 1/5) · 3 AC ← B3.9, B5.1, V4.5
      - **B4.2 `HOS-1533`** — B4 · El aviso de cambio de cobertura (PR 2/5) · 2 AC ← B4.1
      - **B4.3 `HOS-1534`** — B4 · Retención y puedeCobrarle (PR 3/5) · 4 AC ← B4.2
      - **B4.4 `HOS-1535`** — B4 · El juego del contrato y anotar cancelación (PR 4/5) · 1 AC ← B4.3
      - **B4.5 `HOS-1536`** — B4 · Salida (PR 5/5) · 2 AC ← B4.4, V2.3
    - **B5 ↻HOS-1368** — B5 · El registro del dinero ← B3
      - **B5.1 `HOS-1537`** — B5 · El pago P1 y la deduplicación de hechos (PR 1/9) · 4 AC ← B3.5b, B5.8
      - **B5.2 `HOS-1538`** — B5 · Comprobantes, reintentos y provider_notification (PR 2/9, parte 1/2) · 4 AC ← B5.1
      - **B5.2b `HOS-1539`** — B5 · El contracargo: P6 y P7 (Fase 2) · 2 AC · **Fase 2** ← B5.9, B7.10, B8a.6
      - **B5.3 `HOS-1540`** — B5 · El reembolso y la acción 14 (PR 3/9) · 4 AC ← B5.2
      - **B5.4 `HOS-1541`** — B5 · El pago manual MP1 a MP5 (Fase 4, parte 1/2) · 4 AC · **Fase 4** ← B5.9, B3.14
      - **B5.4b `HOS-1542`** — B5 · El pago manual MP1 a MP6 (Fase 4, parte 2/2) · 4 AC · **Fase 4** ← B5.4
      - **B5.5 `HOS-1543`** — B5 · La revocación (S36) (PR 5/9, parte 1/2) · 3 AC ← B5.3, B7.1
      - **B5.5b `HOS-1544`** — B5 · La revocación (S36) (PR 5/9, parte 2/2) · 1 AC ← B5.5
      - **B5.6 `HOS-1545`** — B5 · La orfandad (A5) y S21 (PR 6/9, parte 1/2) · 3 AC ← B5.5
      - **B5.6b `HOS-1546`** — B5 · La orfandad (A5) y S21 (PR 6/9, parte 2/2) · 4 AC ← B5.5, B5.6, B8a.2, B9a.1
      - **B5.7 `HOS-1547`** — B5 · Las llamadas BL y la rama S14 (PR 7/9, parte 1/2) · 2 AC ← B5.5, B5.6b, B7.4b
      - **B5.7b `HOS-1548`** — B5 · Las llamadas BL y la rama S14 (PR 7/9, parte 2/2) · 2 AC ← B5.1
      - **B5.8 `HOS-1549`** — B5 · El esquema y los builds (PR 8/9) · 1 AC ← B3.4
      - **B5.9 `HOS-1550`** — B5 · Salida (PR 9/9) · 3 AC ← B3.12, B5.5, B5.5b, B5.7, B5.7b, B5.8, B7.4b, B8a.4
      - **B5.10 *(nueva)*** — B5 · La orfandad por revocación de un grant (Fase 2) · 1 AC · **Fase 2** ← B5.9, B9a.6
    - **B6 ↻HOS-1369** — B6 · Ejecutar el cobro y el reembolso ← B1, B5
      - **B6.1 `HOS-1551`** — B6 · El refund y su confirmación (PR 1/4) · 4 AC · **Fase 2** ← B1.7, B5.9
      - **B6.2 `HOS-1552`** — B6 · Relectura y excepciones del refund (PR 2/4) · 3 AC · **Fase 2** ← B6.1
      - **B6.3 `HOS-1553`** — B6 · Una vez, idempotencia y mandato (PR 3/4, parte 1/2) · 3 AC · **Fase 2** ← B6.2
      - **B6.3b `HOS-1554`** — B6 · Una vez, idempotencia y mandato (PR 3/4, parte 2/2) · 2 AC · **Fase 2** ← B6.3
      - **B6.4 `HOS-1555`** — B6 · Salida (PR 4/4) · 1 AC · **Fase 2** ← B6.3b
    - **B7 ↻HOS-1370** — B7 · La mora ← B5, V2
      - **B7.1 `HOS-1556`** — B7 · Entra a grace (PR 1/9, parte 1/2) · 4 AC ← B5.1, V2.2
      - **B7.1b `HOS-1557`** — B7 · Entra a grace (PR 1/9, parte 2/2) · 1 AC ← B7.1, B7.2
      - **B7.2 `HOS-1558`** — B7 · Sale de grace (PR 2/9) · 3 AC ← B7.1
      - **B7.3 `HOS-1559`** — B7 · Pausa y contracargo espejo (PR 3/9) · 2 AC ← B7.2
      - **B7.4 `HOS-1560`** — B7 · Manual, sucesión y banderas (PR 4/9, parte 1/2) · 1 AC ← B7.2
      - **B7.4b `HOS-1561`** — B7 · Manual, sucesión y banderas (PR 4/9, parte 2/2) · 3 AC ← B7.4
      - **B7.5 `HOS-1562`** — B7 · Complementos en la mora (PR 5/9) · 4 AC ← B5.6, B7.4, B7.6
      - **B7.6 `HOS-1563`** — B7 · Configuración del grace (PR 6/9) · 3 AC ← B7.2, B8a.2, V2.2
      - **B7.7 `HOS-1564`** — B7 · BL y punta a punta (PR 7/9, parte 1/2) · 2 AC ← B7.4
      - **B7.7b `HOS-1565`** — B7 · BL y punta a punta (PR 7/9, parte 2/2) · 2 AC ← B3.12, B7.3, B7.4
      - **B7.8 `HOS-1566`** — B7 · Turista VIP en mora (PR 8/9) · 2 AC ← B7.4
      - **B7.9 `HOS-1567`** — B7 · Salida (PR 9/9) · 1 AC ← B7.1b, B7.4b, B7.5, B7.7, B7.7b, B7.8
      - **B7.10 *(nueva)*** — B7 · El contracargo en la mora (Fase 2) · 3 AC · **Fase 2** ← B7.9
      - **B7.11 *(nueva)*** — B7 · El pagador manual en la mora (Fase 4) · 3 AC · **Fase 4** ← B7.9, B5.4
    - **B10 ↻HOS-1373** — B10 · Addons ← B9b, V2, V6, V9b
      - **B10.1 `HOS-1593`** — B10 · A1, A2 y A3: comprar y vencer la ventana (PR 1/4) · 4 AC · **Fase 3** ← B9b.5, V2.5, V6.13, V9b.5
      - **B10.2 `HOS-1594`** — B10 · A4, A6 y A7: vencimiento, purga y rechazo (PR 2/4) · 4 AC · **Fase 3** ← B10.1
      - **B10.3 `HOS-1595`** — B10 · Acción 20 y el gratis bajo grant (PR 3/4) · 4 AC · **Fase 3** ← B10.2
      - **B10.4 `HOS-1596`** — B10 · Punta a punta y salida (PR 4/4) · 2 AC · **Fase 3** ← B10.3
    - **B11 ↻HOS-1374** — B11 · Conciliación ← B4, B5
      - **B11.G1** — B11 · El barrido y sus lápidas (subgrupo)
        - **B11.1 `HOS-1602`** — B11 · Inventario desde nuestra base y re-vinculación (PR 1/10) · 3 AC ← B3.4
        - **B11.2 `HOS-1603`** — B11 · Lápida, sondas del manifiesto y reintentos (PR 2/10) · 4 AC ← B11.1, B5.2
      - **B11.G2** — B11 · Las comparaciones (subgrupo)
        - **B11.3 `HOS-1604`** — B11 · Estado, monto y los cobros del período (PR 3/10) · 4 AC ← B11.2, B5.3, B7.1
        - **B11.4 `HOS-1605`** — B11 · Pagos acreditados, órdenes y refunds (PR 4/10) · 3 AC ← B11.1, B5.3
        - **B11.5 `HOS-1606`** — B11 · CHARGED_BACK, exención y la cancelación vista (PR 5/10) · 2 AC ← B11.4, B4.3, B5.3
        - **B11.11 *(nueva)*** — B11 · El contracargo completo y el reenvío de refunds (Fase 2) · 3 AC · **Fase 2** ← B11.10, B5.2b, B6.3
      - **B11.G3** — B11 · Las marcas (subgrupo)
        - **B11.6 `HOS-1607`** — B11 · Escalamiento y resumen agregado (PR 6/10) · 2 AC ← B11.5
        - **B11.7 `HOS-1608`** — B11 · Ventana del resumen y los dos correos (PR 7/10) · 2 AC ← B11.6
      - **B11.G4** — B11 · Las pruebas sembradas (subgrupo)
        - **B11.8 `HOS-1609`** — B11 · Cero llamadas y la fila sin dueño (PR 8/10) · 2 AC ← B11.1
        - **B11.9 `HOS-1610`** — B11 · Creaciones duplicadas, ping y corrida a medias (PR 9/10) · 2 AC ← B11.1
      - **B11.G5** — B11 · Salida (subgrupo)
        - **B11.10 `HOS-1611`** — B11 · Salida de la pieza (PR 10/10) · 1 AC ← B11.3, B11.7, B11.8, B11.9
    - **B12 ↻HOS-1375** — B12 · El catálogo que se retira ← B13b, U2, V2
      - **B12.1 `HOS-1612`** — B12 · Retirar un plan y la acción 17 (PR 1/5) · 1 AC · **Fase 3** ← B13b.1, U2.4, V2.5
      - **B12.2 `HOS-1613`** — B12 · El aviso, la cohorte y cancelar la migración (PR 2/5) · 3 AC · **Fase 3** ← B12.1
      - **B12.3 `HOS-1614`** — B12 · S37 en los dos pagadores (PR 3/5) · 2 AC · **Fase 3** ← B12.2
      - **B12.4 `HOS-1615`** — B12 · El aumento anclado y la cola visible (PR 4/5) · 2 AC · **Fase 3** ← B12.3
      - **B12.5 `HOS-1616`** — B12 · Punta a punta y salida (PR 5/5) · 2 AC · **Fase 3** ← B12.4
  - **U1 ↻HOS-1400** — U1 · La limpieza del principio
    - **U1.1 `HOS-1416`** — U1 · Sacar el cobro viejo y su esquema (PR 1/6) · 2 AC · ✓ hecha
    - **U1.2 `HOS-1417`** — U1 · Sacar el agrupamiento viejo y reescribir documentos (PR 2/6) · 2 AC · ✓ hecha ← U1.1
    - **U1.3 `HOS-1418`** — U1 · G8 nace con la limpieza (PR 3/6) · 2 AC · ✓ hecha ← U1.2
    - **U1.4 `HOS-1419`** — U1 · Soltar enredos: seed, guards del repo y smoke (PR 4/6) · 4 AC · ✓ hecha ← U1.3
    - **U1.5 `HOS-1420`** — U1 · El package del contrato nace vacío (PR 5/6) · 1 AC · ✓ hecha ← U1.4
    - **U1.6 `HOS-1421`** — U1 · Momento 1 y salida (PR 6/6) · 2 AC · ✓ hecha ← U1.5
  - **U2 ↻HOS-1401** — U2 · El outbox común ← U1
    - **U2.1 `HOS-1422`** — U2 · Encolar el correo, deduplicar y dar dueño a processing (PR 1/4) · 4 AC · ✓ hecha ← U1.6
    - **U2.2 `HOS-1423`** — U2 · Entrega: escala sin trabar, supresión y bitácora (PR 2/4) · 3 AC · ✓ hecha ← U2.1
    - **U2.2b `HOS-1627`** — U2 · Ingesta de rebotes duros del proveedor (hoja nueva, antes de la salida) · 1 AC · ✓ hecha ← U2.2
    - **U2.3 `HOS-1424`** — U2 · Huso, correlación y domain_event (PR 3/4) · 3 AC · ✓ hecha ← U2.2
    - **U2.4 `HOS-1425`** — U2 · Salida (PR 4/4) · 1 AC · ✓ hecha ← U2.3, U2.2b
  - **U3 ↻HOS-1402** — U3 · El script del corte ← U1
    - **U3.1 `HOS-1426`** — U3 · Censo y cancelaciones en el proveedor (PR 1/4) · 4 AC · ✓ hecha ← U1.6
    - **U3.2 `HOS-1427`** — U3 · Manifiesto, script suelto e inversos (PR 2/4) · 3 AC · ✓ hecha ← U3.1
    - **U3.3 `HOS-1428`** — U3 · Sondas del 4b: Webhooks e IPN (PR 3/4) · 2 AC ← B3.5b
    - **U3.4 `HOS-1429`** — U3 · Salida (PR 4/4) · 1 AC ← U3.3

## Reglas del árbol

- `U1`, `V1` y `B1` conservan sus padres reales en Linear. Construyen el package compartido del contrato sin crear un contenedor duplicado.
- `V5`, `V6` y `B11` llevan un nivel extra: subgrupos `G1..Gn` entre la pieza y las hojas.
- Las piezas divididas (`V8a/b`, `V9a/b`, `B8a/b`, `B9a/b`, `B13a/b`) son issues nuevas bajo su contenedor existente.
- **Cada hoja depende de la hoja que crea lo que usa** (`por_que` lo dice por dependencia), sin ciclos; y **cada salida depende de todas las hojas de su pieza en su fase**. Desde el 2026-10-07 ya no rige «la hoja 1 de una pieza espera la salida de sus predecesoras»: describía un orden, no un uso, y estiraba el camino crítico (69 hojas en el árbol original, 24 en el reparado).
- **Fases.** Una hoja nunca depende de una hoja de una fase posterior. Las AC del corte que se difieren viven en hojas propias de su fase dentro de la misma pieza (por ejemplo `B7.10`, Fase 2; `B7.11`, Fase 4), así cada issue de Linear es de una sola fase.
- Las hojas de más de cuatro AC se dividen en dos tramos; el segundo lleva sufijo `b`. El límite de AC es una señal de revisión de tamaño, no una estimación de líneas.
- Labels: sólo del team HOS; las issues nuevas arrastran `kind-spec`, `source-agent` y las `area-*` de su unidad.

## Calendario de olas del MVP

Un grupo = un PR: ≤3 hojas y ≤8 AC, de una sola pieza (así las piezas de plata `B3`, `B4`, `B5`, `B7` y `B11` nunca se mezclan con otras). Una ola arranca cuando todas sus dependencias están mergeadas. El calendario es una cota: el orden real lo da `docs/43-implementacion/siguiente.py`.

Camino crítico: B13a.8 ← B13a.5 ← B13a.4 ← B13a.1 ← B8a.3 ← B8a.1 ← B7.5 ← B7.6 ← B8a.2 ← B5.6 ← B5.5 ← B5.3 ← B5.2 ← B5.1 ← B3.5b ← B3.5 ← B3.4 ← B3.3b ← B3.3 ← B3.1b ← B3.1 ← B3.9 ← B2.1 ← V2.1

### Ola 1 — 6 PRs, 11 hojas, 23 AC

| PR | hojas | AC |
|---|---|---|
| 1.1 | B1.4 (HOS-1510) + B1.7 (HOS-1513) | 4 |
| 1.2 | B13a.9 (nueva) | 3 |
| 1.3 | V2.1 (HOS-1434) + V2.2 (HOS-1435) | 5 |
| 1.4 | V5.4 (HOS-1458) | 2 |
| 1.5 | V6.10 (HOS-1480) + V6.11 (HOS-1481) + V6.8a (HOS-1478) | 4 |
| 1.6 | V9a.1 (HOS-1499) + V9a.1c (nueva) | 5 |

### Ola 2 — 3 PRs, 8 hojas, 20 AC

| PR | hojas | AC |
|---|---|---|
| 2.1 | B2.1 (HOS-1514) + B2.3 (HOS-1516) + B2.4 (HOS-1517) | 8 |
| 2.2 | V3.1 (HOS-1439) + V3.2 (HOS-1440) + V3.3 (HOS-1441) | 7 |
| 2.3 | V4.1 (HOS-1443) + V4.5 (HOS-1447) | 5 |

### Ola 3 — 4 PRs, 10 hojas, 24 AC

| PR | hojas | AC |
|---|---|---|
| 3.1 | V3.4 (HOS-1442) | 3 |
| 3.2 | V5.1 (HOS-1455) + V5.2 (HOS-1456) + V5.7 (HOS-1461) | 8 |
| 3.3 | B3.9 (HOS-1529) + B3.1 (HOS-1518) + B3.1b (HOS-1519) | 8 |
| 3.4 | V2.3 (HOS-1436) + V2.4 (HOS-1437) + V2.5 (HOS-1438) | 5 |

### Ola 4 — 5 PRs, 9 hojas, 23 AC

| PR | hojas | AC |
|---|---|---|
| 4.1 | B13a.10 (nueva) | 2 |
| 4.2 | B3.3 (HOS-1521) + B3.3b (HOS-1522) + B3.8 (HOS-1528) | 8 |
| 4.3 | V4.2 (HOS-1444) + V4.3 (HOS-1445) | 6 |
| 4.4 | V5.3 (HOS-1457) + V5.5 (HOS-1459) | 5 |
| 4.5 | B3.2 (HOS-1520) | 2 |

### Ola 5 — 2 PRs, 4 hojas, 15 AC

| PR | hojas | AC |
|---|---|---|
| 5.1 | B3.4 (HOS-1523) + B3.5 (HOS-1524) | 7 |
| 5.2 | V6.9 (HOS-1479) + V6.1 (HOS-1471) | 8 |

### Ola 6 — 8 PRs, 15 hojas, 35 AC

| PR | hojas | AC |
|---|---|---|
| 6.1 | B3.5b (HOS-1525) + B3.12 (HOS-1511) + B3.7 (HOS-1527) | 8 |
| 6.2 | B11.1 (HOS-1602) + B11.8 (HOS-1609) + B11.9 (HOS-1610) | 7 |
| 6.3 | B5.8 (HOS-1549) | 1 |
| 6.4 | V4.4 (HOS-1446) + V4.6 (HOS-1448) | 4 |
| 6.5 | V6.3 (HOS-1473) + V6.4 (HOS-1474) + V6.2 (HOS-1472) | 7 |
| 6.6 | V8a.1 (HOS-1491) | 3 |
| 6.7 | V6.12 (HOS-1482) | 3 |
| 6.8 | V9a.1b (HOS-1500) | 2 |

### Ola 7 — 6 PRs, 11 hojas, 29 AC

| PR | hojas | AC |
|---|---|---|
| 7.1 | V4.7 (HOS-1449) | 2 |
| 7.2 | B5.1 (HOS-1537) + B5.2 (HOS-1538) | 8 |
| 7.3 | U3.3 (HOS-1428) + U3.4 (HOS-1429) | 3 |
| 7.4 | V5.8 (HOS-1462) + V5.9 (HOS-1463) | 6 |
| 7.5 | V6.5 (HOS-1475) + V6.6 (HOS-1476) + V6.7 (HOS-1477) | 7 |
| 7.6 | B3.10 (HOS-1530) | 3 |

### Ola 8 — 8 PRs, 15 hojas, 39 AC

| PR | hojas | AC |
|---|---|---|
| 8.1 | B11.2 (HOS-1603) | 4 |
| 8.2 | B5.3 (HOS-1540) + B5.7b (HOS-1548) | 6 |
| 8.3 | V6.9b (nueva) + V6.13 (HOS-1483) | 3 |
| 8.4 | B13a.2 (HOS-1618) | 2 |
| 8.5 | B3.6 (HOS-1526) + B3.11 (HOS-1531) | 5 |
| 8.6 | B4.1 (HOS-1532) + B4.2 (HOS-1533) | 5 |
| 8.7 | B7.1 (HOS-1556) + B7.2 (HOS-1558) + B7.1b (HOS-1557) | 8 |
| 8.8 | V8a.1b (HOS-1492) + V8a.2 (HOS-1493) | 6 |

### Ola 9 — 6 PRs, 14 hojas, 34 AC

| PR | hojas | AC |
|---|---|---|
| 9.1 | B11.3 (HOS-1604) + B11.4 (HOS-1605) | 7 |
| 9.2 | B13a.6 (HOS-1622) | 2 |
| 9.3 | B4.3 (HOS-1534) + B4.4 (HOS-1535) + B4.5 (HOS-1536) | 7 |
| 9.4 | B5.5 (HOS-1543) + B5.5b (HOS-1544) + B5.6 (HOS-1545) | 7 |
| 9.5 | B7.3 (HOS-1559) + B7.4 (HOS-1560) + B7.4b (HOS-1561) | 6 |
| 9.6 | V8a.3 (HOS-1494) + V8a.4 (HOS-1495) | 5 |

### Ola 10 — 4 PRs, 9 hojas, 20 AC

| PR | hojas | AC |
|---|---|---|
| 10.1 | B8a.2 (HOS-1569) | 2 |
| 10.2 | B11.5 (HOS-1606) + B11.6 (HOS-1607) + B11.7 (HOS-1608) | 6 |
| 10.3 | B7.7 (HOS-1564) + B7.7b (HOS-1565) + B7.8 (HOS-1566) | 6 |
| 10.4 | B9b.1 (HOS-1588) + B9b.2 (HOS-1589) | 6 |

### Ola 11 — 3 PRs, 7 hojas, 16 AC

| PR | hojas | AC |
|---|---|---|
| 11.1 | B11.10 (HOS-1611) | 1 |
| 11.2 | B7.6 (HOS-1563) + B7.5 (HOS-1562) + B7.9 (HOS-1567) | 8 |
| 11.3 | B9a.1 (HOS-1582) + B9a.1b (HOS-1583) + B9a.2 (HOS-1584) | 7 |

### Ola 12 — 4 PRs, 10 hojas, 23 AC

| PR | hojas | AC |
|---|---|---|
| 12.1 | B8a.1 (HOS-1568) + B8a.3 (HOS-1570) + B8a.4 (HOS-1571) | 8 |
| 12.2 | B5.6b (HOS-1546) + B5.7 (HOS-1547) | 6 |
| 12.3 | B9a.3 (HOS-1585) + B9a.4 (HOS-1586) + B9a.5 (HOS-1587) | 5 |
| 12.4 | V5.6 (HOS-1460) + V5.10 (HOS-1464) | 4 |

### Ola 13 — 3 PRs, 5 hojas, 14 AC

| PR | hojas | AC |
|---|---|---|
| 13.1 | B5.9 (HOS-1550) | 3 |
| 13.2 | B8a.5 (HOS-1572) | 3 |
| 13.3 | B13a.1 (HOS-1617) + B13a.4 (HOS-1620) + B13a.7 (HOS-1623) | 8 |

### Ola 14 — 2 PRs, 3 hojas, 7 AC

| PR | hojas | AC |
|---|---|---|
| 14.1 | B13a.5 (HOS-1621) + B13a.8 (HOS-1624) | 5 |
| 14.2 | B9b.4 (HOS-1591) | 2 |

## Creación

`python3 crear_arbol.py` imprime el plan sin crear nada. `python3 crear_arbol.py --apply` requiere `LINEAR_API_KEY` y valida en Linear el team HOS, los labels, los padres existentes y los títulos antes de la primera mutación. Crea de padres a hijos y registra cada identificador en `creados.json` tras recibirlo; en una reanudación también reconoce la marca de clave en la descripción remota. Las dependencias de nodos nuevos se crean como relaciones `blocked by`. Los issues existentes conservan título, descripción, labels, relaciones y padre: los cambios del 2026-10-07 sobre issues ya creadas (relaciones, estados, descripciones, `B1.5` → `B3.12` y `V6.8` → `V6.8a`) se aplican a mano, con la lista exacta que acompaña al PR.

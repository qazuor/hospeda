# Barrido general de propagación · pasada 10

Inventario reconstruido desde los commits de pasadas 7, 8 y 9 y los artefactos de
vuelta-4 a vuelta-6, más las dos reglas de vuelta-7. No se agregaron decisiones de producto.

Rutas sin prefijo: `spec-consolidada/`. D: `HOS-1352/docs`; V: `HOS-1353`; B: `HOS-1354`.
Los nombres completos de las raíces figuran en `barrido-fuentes.md`. Las líneas de hallazgo
son las del barrido y pueden desplazarse al regenerar; los IDs de decisión/AC son estables.

Se buscaron varias formulaciones por cada regla con `rg --hidden -n -i -g '*.md'`,
más una segunda pasada `rg -U` con espacios/saltos de línea. Alcance: **todos** los `.md`
de consolidada (incluidos 01, 04, 80 y `_trabajo`), `scripts/generadores/g8/src/`,
y las fuentes vivas de las tres épicas. Los informes/históricos hallados se preservan:
no gobiernan la norma vigente y el RUNBOOK prohíbe editarlos. Una coincidencia no equivale
por sí sola a un residuo vivo: se contrastaron tachados, población y decisiones posteriores.

Evidencia: `inventario-reglas.md`, `busquedas-spec.json`, `R*-rg.txt`,
`busquedas-multilinea.json`, `R*-multilinea-rg.txt`, `busquedas-fuentes.json`,
`barrido-fuentes.md` y `g-sandbox/barrido-generadores.md`.

| Regla | Lugares encontrados (archivo:línea o ID estable) | Corregido o por qué no |
|---|---|---|
| R01 · Precios/catálogo: paso 3 carga, 3a verifica | 00-indice.md:133,1398; 10-corte/B2.md:32,230,302; 01-decisiones-vigentes.md:2102 (DEC-MP-002📌2/📌5) | Ya vigente. El texto viejo de 01 queda sólo como Parte sin efecto; D/41/20-aplicacion.md:49,71 es informe histórico y el RUNBOOK prohíbe editarlo. |
| R02 · Aumento: S37 siete días antes; reintento desde S37 | 80-abiertos.md:355,451; 01-decisiones-vigentes.md:1934 (DEC-MP-001); B/docs/22-lo-legal.md:87; 10-corte/B9a.md:721 | Corregidos 80, B22 y generador g1; B9a/B2 ya vigentes. Se conserva que ningún cobro sale antes de la fecha efectiva. |
| R03 · Tres correos de aumento B12; editor B13a | 10-corte/B2.md:70,373; 20-fase-3/B12.md:576; B/descomposicion.md:1077 | Ya vigente; tablas B13a enumeran contenido del catálogo, no reasignan construcción. |
| R04 · S16: alta nueva salvo predecesora con checkout abierto | 10-corte/B13a.md:182,623,1042; 10-corte/B3.md:426; 04-catalogos.md:1678,4707; B/docs/19-superficies.md:138 | Corregidos fuente, g-secciones de B13a, AC y TEST. 04:4707 es S3/alta manual, no la excepción S16; se conserva. |
| R05 · promo_redemption nace B3 con instante de canje | 10-corte/B3.md:967; 20-fase-2/B8b.md:296; 10-corte/B9a.md:178,241 | Esquema ya completo. Las menciones de FK/contador son consumidores, no definiciones incompletas del esquema. |
| R06 · BY cierra S15: lectura por interfaz que implementa B5 | 10-corte/B3.md:391,1447; 80-abiertos.md:640; 10-corte/B5.md:1198 | Ya vigente; duda histórica está explícitamente cerrada por BY. |
| R07 · CK: aviso postcommit sin outbox ni entrega durable | scripts/generadores/g8/src/B4.md:34,130,354,400; 10-corte/B9a.md:1216; 03-contrato-de-cobertura.md:849 | Ya vigente. Encolados de correos U2 se conservan; la red diaria no incorpora trial ni otras poblaciones. |
| R08 · coberturaPerdidaEn atómico con pérdida, no con aviso | 04-catalogos.md:927,964; V/docs/03-maquinas-de-estado.md:1282,1325; scripts/generadores/g8/src/B4.md:53,327 | Corregidas ambas fuentes V03 y regenerado g3. Contrato y g8 ya vigentes. |
| R09 · RF4 admite transferencia o referencia del panel | 02-nucleo.md:1158; 01-decisiones-vigentes.md:9642 (DEC-RF-008); 04-catalogos.md:4554,5308; scripts/generadores/g8/src/B5.md:273,1009; D/nucleo/08-auditoria-y-observabilidad.md:204 | Corregidos núcleo, fuente y g1; nuevo pin RF008📌8, cobertura y TEST:B5:6 con ambos comprobantes. MP6 de 04:5308 trata específicamente transferencia de vuelta y se conserva. |
| R10 · MP5 avisa al admin también primera cuota, idempotente | scripts/generadores/g8/src/B5.md:307,1024; 10-corte/B3.md:244; 04-catalogos.md (TRANS:B:MP5) | Ya vigente; abrir primera cuota sin S4 no elimina el aviso propio de MP5. |
| R11 · RF3 UNA_VEZ confirma releyendo orden por id | 20-fase-3/B10.md:215; B/docs/16-addons.md:144; scripts/generadores/g8/src/B6.md:134,462; 04-catalogos.md:4540 | Corregida fuente B16 y regenerado B10. RF3 y g8 ya distinguen pago de suscripción/orden UNA_VEZ. |
| R12 · S19 retenido no reactiva; S5 grace/P1 active sin retención | scripts/generadores/g8/src/B7.md:187,205,1617; 04-catalogos.md:2815 | Precisado Dado de AC:B7:8 sin pago retenido. AC:B7:9 y TEST:B7:6 ya separan ramas; g8 regenerado. |
| R13 · Moderación vuelve por PB11/PB13 según origen y reinicia reloj | 02-nucleo-glosario.md:389; 10-corte/V6.md:159,397; 04-catalogos.md:1317; D/nucleo/01-glosario.md:439 | Corregidos glosario fuente y manual. Los relatos de daño histórico y PB11 aplicado sólo a DRAFT siguen siendo correctos. |
| R14 · V9b dos previos; al archivar V6 | 20-fase-1/V9b.md:40,232; 10-corte/V9a.md:75; V/descomposicion.md:73 | Corregidas cabeceras de fuente y V9b; AC de los tres correos conserva el reparto explícito. trazar detectó y cerró la copia manual residual. |
| R15 · PURGED dedup por evento; previos por fecha objetivo | 20-fase-1/V9b.md:637; 02-nucleo-outbox.md:108; 10-corte/U2.md:168 | Ya vigente. Los tres correos de retención no son el correo de alerta cerrada por PURGED. |
| R16 · BAJA según estrategia del limit, no siempre menor | 10-corte/B8a.md:329; 20-fase-2/B8b.md:488; 10-corte/V2.md:41,165,608; B/descomposicion.md:1069 | Corregidos criterio B8 fuente/manual. V2 ya acota menor a SUMA/MAX y prueba MIN por separado. |
| R17 · 19 plazos; clave 19 antes merge B2 | 01-decisiones-vigentes.md:4651 (DEC-DATA-008📌4/📌7, letra BU); 30-el-corte.md:452; D/nucleo/02-modelo-de-datos.md:189 | G1 omite mandato dieciocho y gate B11. Relato fechado quince→dieciocho y letra BU con caducidad parcial se conservan. |
| R18 · domain_event lo crea U2, BW | 80-abiertos.md:589; 10-corte/U2.md:225; 10-corte/V9a.md:208; 01-decisiones-vigentes.md:14043 (letra BN) | Ya vigente. BN conserva historia con advertencia de reemplazo por BW. |
| R19 · Aumento conserva promo entre S37/S38; retiro no | 20-fase-2/B8b.md:144; B/docs/12-suscripcion.md:271; 20-fase-3/B12.md:351,445; 01-decisiones-vigentes.md:1926 | Corregida fuente/generalización B8b por regeneración; AC:B12:4 acotado a retiro, aumento cubierto por AC9. DEC-SUB-023📌2 delimita versión retirada: sin promos sigue correcto. |
| R20 · Contracargo visible; fuera de propuesta devolución | 10-corte/B13a.md:1092; 04-catalogos.md:4570 | Ya vigente. Se resuelve sin devolver; ninguna otra copia viva oculta el pago por defecto. |
| R21 · Trece dependencias, BC suma V7→B5 | 00-indice.md:673; 10-corte/U1.md:803; 10-corte/U2.md:454; 01-decisiones-vigentes.md:6199 (DEC-ARCH-014📌6/📌8); D/16-fase-7-del-paraguas.md:886,904; V/descomposicion.md:623; B/descomposicion.md:892,912 | Corregidas copias fuente/manual y g1. Nuevo pin ARCH014📌8, cobertura en V7/DEP15; doce reglas del falso o doce acciones canceladoras son otros conjuntos. |
| R22 · Reintento clave nueva: cita B09 §7 | 10-corte/B11.md:1733; 04-catalogos.md:2202,2815; 80-abiertos.md:239 | Ya vigente. Las otras citas §6 son escalada de cobro indeterminado y no recuperación de creación; se conservan. |
| R23 · VIP: cancelar tras sent; transitorio espera, definitivo escala | 10-corte/B3.md:563,1270; scripts/generadores/g8/src/B7.md:559,1760; 01-decisiones-vigentes.md:14064 (BP/CA) | TEST:B3:26 ya no confunde encolado con envío; «correo antes» remite a regla común, no promete que encolar alcance. |
| R24 · U1: excepción producción readonly antes merge | 10-corte/U1.md:780,790; 01-decisiones-vigentes.md (BT) | Ya vigente. Los demás smokes siguen en ventanas del corte. |
| R25 · BASE pasa paso5; falta capacidad falla paso6 | 10-corte/V5.md:1356; 04-catalogos.md:781; V/docs/17-autorizacion.md:143,155 | Ya vigente. Mencionar conjuntamente pasos 5 y 6 para caché no mezcla sus causas de rechazo. |
| R26 · Citas de lista de piezas §4.6 | 10-corte/V8a.md:648; 10-corte/V9a.md:311; 20-fase-4/V7.md:1067; 20-fase-4/V8b.md:306 | Revisadas contra fuente congelada. D16 no sumó líneas en esta pasada. Las citas 951/952 de B2/B3 señalan sus propias piezas y no son residuos de V8a/V8b. |
| R27 · AP precisada BG/AV: esquemas B3; payment B5 | 01-decisiones-vigentes.md:6516 (AP, DEC-ARCH-017📌1); 10-corte/B3.md:599; 20-fase-3/B10.md:168 | Advertencia parcial ya vigente. B10 describe FK del modelo, no asigna su creación a B10. |
| R28 · Generador: precisar también puede reemplazar AP/BN/BU/CC | scripts/generadores/g1/omisiones.py:177; scripts/generadores/g1/canarios_g1.py:137 | Reglas previas y canarios preservados. Pasada10 agrega cinco casos de propagación: rojo 5 fallas, verde 0. |
| R29 · CF: predicado/test PR B3; AC B2 | 20-fase-2/B8b.md:179; B/docs/12-suscripcion.md:304; 01-decisiones-vigentes.md:14201 (CC/CF); 10-corte/B3.md:719 | Corregida fuente B12 y regenerado B8b. CC histórico lleva caducidad parcial; el AC sigue B2. |
| R30 · Guard entorno sólo sondas que mutan | 10-corte/B1.md:357,360,636,769; 04-catalogos.md:6742; B/docs/20-testing.md:648; B/docs/06-proveedor.md:402 | Corregidos AC/Seguridad B1, fuente general B20 y g3. Presupuesto exacto sólo si mueve plata; lecturas no heredan guard mutante. |

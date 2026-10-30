# Pasada 10 · fuentes · barrido general

Alcance: todos los `.md` bajo HOS-1352/docs, HOS-1353 y HOS-1354. Ejecutadas 30 búsquedas `rg --hidden -n -i -g '*.md'` con múltiples formulaciones por regla; patrones, exit codes y todas las coincidencias crudas en `/tmp/hos1352-p10-fuentes-rg.json`, script reproducible `/tmp/hos1352-p10-fuentes-scan.py`. Se revisó contexto, tachados multilineales y decisiones posteriores; una coincidencia cruda no equivale a texto normativo vivo. Los informes de aplicación/verificación, PDR y matriz permanecen intactos según RUNBOOK.

Abreviaturas: D = `.specs/HOS-1352-billing-verticals-redesign/docs`; V = `.specs/HOS-1353-verticales-capacidades-y-autorizacion`; B = `.specs/HOS-1354-billing-cobro-y-proveedor`. Líneas corresponden al estado posterior a esta edición, antes del re-congelado.

| Regla | Lugares encontrados archivo:línea | Resultado |
|---|---|---|
| R01 BM: paso 3 carga; 3a verifica | D/01-decision-log.md:1467,1503; D/41-corte-del-mvp/00-propuesta.md:198,266,380; D/41-corte-del-mvp/20-aplicacion.md:49,71; D/16-fase-7-del-paraguas.md:152; B/descomposicion.md:823 | Fuentes de diseño ya corregidas. D01 conserva 📌 BM antiguo, reemplazado explícitamente por 📌5; G omite residuo. D41/20 es informe histórico de aplicación: no editar por RUNBOOK. |
| R02 aumento S37 siete días antes y reintento desde S37 | B/docs/22-lo-legal.md:87; B/docs/14-promos-cortesias-y-grants.md:742; B/docs/03-maquinas-de-estado.md:187 | Corregido B22:87 tachando el instante viejo y agregando S37, siete días y prohibición de cobrar antes. B14 ya cuenta reintento desde S37. |
| R03 correos aumento B12 / editor B13a | B/docs/19-superficies.md:122; B/descomposicion.md:136,1077 | Sin copia vieja viva: superficie enumera mensajes; descomposición asigna B12. |
| R04 S16 excepción predecesora con sucesión | B/docs/19-superficies.md:138; B/docs/03-maquinas-de-estado.md:70,71,2212; B/docs/12-suscripcion.md:374,378 | Corregida fila 19 de superficie: S18 y checkout abierto. B03:70 ya tiene excepción; 2212 es primer pago manual vencido, no S16. |
| R05 promo_redemption código/user/instante/suscripción en B3 | B/descomposicion.md:137; B/docs/02-modelo-de-datos.md (tabla promo_redemption) | Sin copia vieja viva; BG ya ubica esquema B3. |
| R06 S15 interfaz lectura BY/B5 | B/descomposicion.md:137,139; D/41-corte-del-mvp/10-decisiones-del-owner.md (BY) | Ya explícito BY; dudas históricas de aplicación no gobiernan. |
| R07 CK cobertura después commit sin outbox durable | D/12-contrato-de-cobertura.md (§3); B/descomposicion.md:138,892; D/41-corte-del-mvp/00-propuesta.md:45 | Ya corregidas fuentes de diseño por pasada 8/9; encolados de correos se conservan porque CK no los retira. |
| R08 coberturaPerdidaEn transacción pérdida | V/docs/03-maquinas-de-estado.md:1282,1325; B/descomposicion.md:731 | Corregidas ambas copias vivas V03, tachando encolado y agregando persistencia de pérdida antes del aviso sin entrega durable. Bdescomposición ya correcto. |
| R09 RF4 comprobante O referencia panel | D/01-decision-log.md:6566,6622; D/nucleo/08-auditoria-y-observabilidad.md:204; B/docs/03-maquinas-de-estado.md:1853 | Corregida ACC14 núcleo, y nuevo DEC-RF-008📌8 con remisión Estado; cuerpo original intacto. RF4 ya correcto. |
| R10 MP5 aviso admin incluida primera cuota | B/docs/03-maquinas-de-estado.md:1875,2117; B/docs/19-superficies.md (falta de pago) | Sin regla viva que excluya primera cuota: MP5 declara ambas cláusulas y el aviso corresponde a cuota sin pago; omisión de prueba estaba en spec. |
| R11 RF3 UNA_VEZ relee orden | B/docs/16-addons.md:144; B/docs/03-maquinas-de-estado.md:1852 | Corregido B16 tachando «releyendo el pago» y agregando orden por id. RF3 ya explicita excepción UNA_VEZ y relectura de orden. |
| R12 S19 retenido no reactiva/S5 o P1 sólo acreditado no retenido | B/docs/03-maquinas-de-estado.md:155,156; B/docs/09-conciliacion.md | Sin copia vieja viva; guardas y tratamiento del pago retenido presentes en fuente, corrección era simplificación de prueba. |
| R13 levantar moderación restaura estado previo | D/nucleo/01-glosario.md:439; V/descomposicion.md:717; V/docs/03-maquinas-de-estado.md:670,721 | Corregido glosario, PB11/PB13 según estado y reloj. Vdescomposición ya correcto; V03:670 tachado multilineal; 721 explica daño histórico que motivó reiniciar reloj. |
| R14 V9b dos avisos previos; archivar V6 | V/descomposicion.md:73,600,717 | Corregida primera cláusula fila V9b («tres» viejo) aunque BL posterior ya la precisaba. Tres avisos totales en catálogo de correos siguen siendo correctos. |
| R15 PURGED dedup id evento / previos fecha objetivo | D/nucleo/07-outbox-y-notificaciones.md:108,274 | Sin copia vieja viva de atribución de los tres a schedule: texto sobre retención total no es alerta cerrada por PURGED; regla general distingue ocurrencias. |
| R16 BAJA estrategia de limit | B/descomposicion.md:1069; V/descomposicion.md:713 | Corregido criterio B8 genérico «menor» por estrategia SUMA/MAX/MIN/MEJOR_DECLARADO. V3 ya acota menor a SUMA/MAX y tiene caso MIN separado. |
| R17 diecinueve plazos y clave19 antes merge B2 | D/nucleo/02-modelo-de-datos.md:189,191,198; D/16-fase-7-del-paraguas.md:152; D/01-decision-log.md:7434 | Diseño ya diecinueve/B2; pins históricos dieciocho/B11 quedan intactos, actualizados por precisiones posteriores y G. |
| R18 domain_event U2 BW | D/41-corte-del-mvp/10-decisiones-del-owner.md (BW); V/descomposicion.md (V9a); D/16-fase-7-del-paraguas.md (U2) | Sin copia vieja viva; BN se lee con BW, que ya es corrección explícita. |
| R19 S37/S38 aumento conserva promo viva | B/docs/12-suscripcion.md:271; B/docs/14-promos-cortesias-y-grants.md:311; B/docs/09-conciliacion.md:185 | Corregida ventana gemela B12, distingue retiro sin promo/aumento con promo. B14 y B09 ya corregidos pasada7. Downgrade sin promo conserva su regla propia. |
| R20 contracargo visible listado/excluido devolución | B/docs/03-maquinas-de-estado.md:1854; B/docs/19-superficies.md (§6) | Fuente ya visible y resuelto sin devolver; error de vista era de spec. |
| R21 trece dependencias entre épicas | D/16-fase-7-del-paraguas.md:886,904; V/descomposicion.md:623; B/descomposicion.md:892,912; D/01-decision-log.md:7659 | Corregidas cinco copias vivas «doce», y nuevo DEC-ARCH-014📌8/Estado que precisa recuentos históricos (13ª V7 depende B5, BC). Recuentos fechados antes de BC permanecen como historia. |
| R22 clave nueva cita B09 §7 | B/docs/09-conciliacion.md (§7) | Cita equivocada sólo spec; fuente define recuperación en su sección correcta. |
| R23 cancelar VIP sólo tras correo enviado o excepción definitiva | B/docs/03-maquinas-de-estado.md:152 (§1.1/precisiones cancelar); D/nucleo/07-outbox-y-notificaciones.md:222,268 | «Con el correo antes» vigente no significa sólo encolado; regla común ya exige envío/bloqueo transitorio y excepción definitiva. Sin copia vieja viva. |
| R24 U1 producción sólo lectura premerge BT | D/41-corte-del-mvp/10-decisiones-del-owner.md (BT); D/16-fase-7-del-paraguas.md (U1) | Fuente BT ya explícita; generalización smoke era de spec. |
| R25 BASE paso5 pasa/falta capacidad paso6 | V/docs/17-autorizacion.md:143,155,312 | Ya correcto y explícito. No se altera la fuente. |
| R26 citas líneas §4.6 | D/16-fase-7-del-paraguas.md (§4.6) | No es regla de fuente; líneas absolutas se reanclan tras nuevo congelado. |
| R27 AP/BG/AV reparto tablas | B/descomposicion.md:137,138,139; D/41-corte-del-mvp/10-decisiones-del-owner.md (AP/BG/AV) | AP histórico reemplazado en parte; fuentes operativas ya B3/B5. G conserva texto vigente y marca retiro parcial. |
| R28 generador precisión puede reemplazar | sin coincidencias de LETRAS_MUERTAS/LETRAS_VIVAS_REVISADAS en fuentes | Regla de generador, fuera de fuentes. |
| R29 CC test/predicado PR B3; AC B2 | B/descomposicion.md:136,137,828,834; B/docs/12-suscripcion.md:304 | Corregidas cláusula B12 «test en B2» y síntesis CC: tacha atribución ambigua de test B2 y agrega PR B3/AC B2 según CF. Resto ya explícito. |
| R30 guard entorno sólo mutaciones | B/docs/20-testing.md:648; B/docs/06-proveedor.md:402,403 | Corregida generalización B20: sólo operación mutante abre users/me; sólo lectura exenta; presupuesto sólo si mueve plata, monto exacto. B06 ya correcto. |

## Archivos editados (12)

- D/01-decision-log.md
- D/16-fase-7-del-paraguas.md
- D/nucleo/01-glosario.md
- D/nucleo/08-auditoria-y-observabilidad.md
- V/descomposicion.md
- V/docs/03-maquinas-de-estado.md
- B/descomposicion.md
- B/docs/12-suscripcion.md
- B/docs/16-addons.md
- B/docs/19-superficies.md
- B/docs/20-testing.md
- B/docs/22-lo-legal.md

Verificado: `git diff --check` exit 0. Markdownlint con `node_modules/.bin/markdownlint-cli2` directamente, sólo los 12 archivos, exit 0: 12 files, 0 issues; salida `/tmp/hos1352-p10-fuentes-lint.txt`. Nuevos pins movidos antes de `---`, conservando intacto el texto histórico. Sin commits ni regeneración desde este grupo. Pendiente root: re-congelado/reanclado, generación y verificación RUNBOOK. Los nuevos 📌 son RF008#8 y ARCH014#8; deben recibir inventario/adjudicación/cobertura. No se modificaron PDR, matriz ni informes.

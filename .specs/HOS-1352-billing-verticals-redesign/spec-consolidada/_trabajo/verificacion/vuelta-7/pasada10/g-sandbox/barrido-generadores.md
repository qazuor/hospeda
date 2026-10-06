# Barrido G, pasada 10

Prefijo de rutas: `spec-consolidada/`. Líneas previas al re-congelado.

| Regla | Lugares encontrados | Resultado |
|---|---|---|
| R02 mutación aumento S37 siete días antes | `01-decisiones-vigentes.md:1976`; `scripts/adjudicar.py`; `scripts/generadores/g1/omisiones.py` | PARCIAL del cuerpo DEC-MP-001; omitir timing antiguo y citar BZ/CC. No tocar decision log histórico. |
| R17 diecinueve plazos | `01-decisiones-vigentes.md:4664`; `scripts/adjudicar.py`; `scripts/generadores/g1/omisiones.py` | Ampliar PARCIAL de DEC-DATA-008📌4: quitar mandato migración con dieciocho, evidencia BU. El relato histórico «pasa de quince a dieciocho» permanece por alcance temporal. |
| R17 valor plazo19 antes B2 | `01-decisiones-vigentes.md:4716`; `scripts/adjudicar.py`; `scripts/generadores/g1/omisiones.py` | PARCIAL de DEC-DATA-008📌7, omitir merge B11 y citar BX. |
| R09 RF4 comprobante o referencia panel | `01-decisiones-vigentes.md:9647`; `scripts/adjudicar.py`; `scripts/generadores/g1/omisiones.py` | PARCIAL del cuerpo DEC-RF-008, quitar requisito exclusivo de comprobante; cita RF4. |
| R21 trece dependencias | `01-decisiones-vigentes.md:6211`; `scripts/adjudicar.py`; `scripts/generadores/g1/omisiones.py` | PARCIAL DEC-ARCH-014📌6; cita BC en B/descomposición §2.6. |
| R08 persistir cobertura con pérdida, no encolado | `04-catalogos.md:927,964` | Fuente V/03 PB9 avisada a F; g3 regenera desde fuente corregida. No hardcode obsoleto en generadores. |
| R30 guard entorno mutantes | `04-catalogos.md:6741` | Fuente B/20 avisada a F; copia general a regenerar g3. |
| R19 promo en aumento | `01-decisiones-vigentes.md:1926` (DEC-SUB-023📌2) | No corregir: este bloque delimita expresamente migración de versión retirada; sin promos es correcto allí. BZ cubre aumento distinto. |
| R04 S16 excepción predecesora | `04-catalogos.md:4707` | No corregir: explica S3 ABANDONED de alta manual, no S16 de predecesora; excepción vigente presente en `04:1679`. |
| R27/R18/R17/R29 marcas AP/BN/BU/CC | `01-decisiones-vigentes.md:13771,14016,14087,14174`; `scripts/generadores/g1/omisiones.py:249` y siguientes | Ya llevan caducidad parcial; texto histórico citable conserva advertencia. Canarios existentes validan quitar cada advertencia. |
| R01 paso3 carga /3a verifica | `01-decisiones-vigentes.md:2126,2183`; `scripts/adjudicar.py` y g1 omisiones | Ya parcial/omitido; menciones viejas en notas explican historia. Canarios paso3 existentes pasan. |

Método: inspección de diffs pasadas7–9 y búsquedas `rg -n --hidden` en 01,04 y scripts/generadores (sin tomar los canarios como reglas vivas); búsqueda por varias formulaciones listadas en `/tmp/hos1352-p10-reglas.md`. Cambios de generador se limitan a cinco clasificaciones/omisiones. Sandbox bajo `/tmp/hos1352-p10-g/repo/.specs/…` conserva estructura y lee fuentes del SHA congelado mediante Git. No se regeneró spec real.

# Inventario de reglas cambiadas, pasadas 7–10

Fuentes: diffs 8a1d8902c2, c63c3a4ee2, 3c3e88b9b5, bba93a3d34, 5e2c53c177, 04a8fc09f6, 8201c4472b, 5381f75796, 98a1a80735; adjudicaciones vueltas 4–6. R26 es corrección de cita, no regla semántica. R28 es regla del generador.

| ID | Pasada | Regla actual | Formulaciones de búsqueda viejas/vecinas |
|---|---|---|---|
| R01 | 7/9 | Precios/catálogo carga paso 3, 3a verifica | carga el paso 3a; 3a los carga; se carga en el 3a; no esta migración |
| R02 | 7/10 | Aumento muta S37 siete días antes; S38 aplica versión/fecha efectiva | mutación en la fecha efectiva; cambio se ejecuta en la fecha efectiva; reintento desde fecha efectiva |
| R03 | 7 | Tres correos aumento B12, editor precios B13a | tres correos del aumento también; B13a.*aumento |
| R04 | 7 | S16 alta nueva salvo predecesora sucesión: S18 y terminar checkout existente | reintento es un alta nueva; S16.*alta nueva |
| R05 | 7 | promo_redemption nace en B3 con instante canje, código,user,suscripción | promo_redemption; instante del canje |
| R06 | 7 | S15 lee reconciliation_mark_payment por interfaz B5, BY cierra duda | BL por inferencia; rama que la lee; reconciliation_mark_payment |
| R07 | 7/8/9 | Cobertura emite después commit sin durable ni outbox; reconciliador diario acotado, dependencia U2 transitiva | aviso.*encola; encola.*cobertura; B4.*outbox; aviso.*durable |
| R08 | 8 | coberturaPerdidaEn persiste transacción pérdida, independiente aviso | misma transacción que encola; con el encolado del aviso |
| R09 | 7 | RF4 acepta comprobante transferencia O referencia panel | comprobante de la transferencia; RF4 |
| R10 | 7 | MP5 aviso admin al abrir cuota sin pago, incluida primera sin S4; idempotente | primera cuota; MP5; aviso de falta de pago |
| R11 | 7 | RF3 UNA_VEZ relee orden por id para comprobar refund ejecutado | relectura por id del pago; RF3; UNA_VEZ |
| R12 | 7 | Pago retenido S19 inhibe S6 sin reactivar; acreditado no retenido S5 GRACE/P1 ACTIVE | pendiente de S19; S6 no ocurre; ocurre y corre S5 |
| R13 | 7 | Levantar moderación restaura estado previo y reloj; PB13 si publicada/billing | deja en DRAFT; levantar la moderación; PB11 |
| R14 | 7 | V9b dos avisos previos; al archivar V6 PB4/PB5 | los tres avisos; tres avisos.*V9b |
| R15 | 7 | PURGED alerta cerrada dedup por id evento dominio; avisos previos schedule fecha objetivo | dos avisos previos y el de la alerta cerrada; fecha objetivo; alerta cerrada |
| R16 | 7 | BAJA por limit peor según estrategia SUMA/MAX menor, MIN mayor, MEJOR_DECLARADO peor | rank MAYOR con un solo limit menor; limit menor |
| R17 | 7/8 | 19 plazos; valor clave19 antes merge B2 (resto cinco antes V6) | dieciocho valores; dieciocho plazos; merge de B11 |
| R18 | 7/8 | domain_event nace U2 BW, no V9a BN | V9a.*domain_event; domain_event.*V9a |
| R19 | 7 | Entre S37/S38 monto destino menos promo viva cuando motivo aumento; retiro sin promos | destino para su ciclo, sin promos; ventana gemela |
| R20 | 7 | Contracargo visible listado; excluido propuesta devolución por defecto; resolver sin devolver | contracargo y no en la vista; contracargo.*defecto |
| R21 | 7 | Grafo entre épicas trece dependencias | las doce siguen; doce dependencias; doce del |
| R22 | 7 | B11 reintento clave nueva cita B/09 §7 | B/09 §6; nueva acuñada |
| R23 | 8 | VIP cancelar S2 tras sent; transitorio espera misma fila, definitivo/no entregable permite y escala | correo encolado antes de la cancelación; correo antes; VIP |
| R24 | 8 | TEST U1:24 producción readonly antes merge excepción smoke ventanas corte | smoke.*no como gate; sólo.*ventanas del corte |
| R25 | 8 | BASE pasa autorización paso5; falta capacidad rechaza paso6 | paso 5/6; sin fuente que otorgue la capacidad |
| R26 | 8 | Citas lista piezas V8a955 V9a957 V7 954 V8b956 (líneas congelado época) | lista de piezas, l. 953; lista de piezas, l. 950; §4.6 (l. 951; §4.6 (l. 952 |
| R27 | 8 | AP parcial BG promos/cortesías B3; AV addons B3 y payment nace B5 con columna | promos y cortesías, en B9a; addons, en B4; le agrega a payment |
| R28 | 8/9 | Generador marca retiro parcial AP/BN/BU/CC; precisa puede reemplazar | precisar nunca corrige; LETRAS_MUERTAS; LETRAS_VIVAS_REVISADAS |
| R29 | 9 | CC predicado/test escribe PR B3; AC sigue B2; S38 destino cuenta cliente | predicado.*B2; y su test.*, en B2 |
| R30 | 10 | Guard entorno sólo sondas mutantes; sólo lectura producción permitida | fuera de staging; producción.*aborta; guard de entorno; sólo staging |

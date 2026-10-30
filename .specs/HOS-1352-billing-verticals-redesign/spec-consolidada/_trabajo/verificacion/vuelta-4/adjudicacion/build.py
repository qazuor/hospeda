"""Render de la adjudicación. Sólo escribe en este directorio; no modifica insumos."""
from pathlib import Path
import json
import re
from collections import Counter

OUT = Path(__file__).resolve().parent
ROOT = OUT.parent
P = '.specs/HOS-1352-billing-verticals-redesign/'
B = '.specs/HOS-1354-billing-cobro-y-proveedor/'
V = '.specs/HOS-1353-verticales-capacidades-y-autorizacion/'
raw = (ROOT / 'hallazgos-todos.txt').read_text()
reports = {m[1]: m[2] for m in re.finditer(r'^(?:CAN\? )?\[((?:VB-\d+|VA-A\d+|G[12])-\d+)\] (.*)', raw, re.M)}
unicos = []

def fix(file, sale, entra, source=False, where=None):
    base = ROOT / ('v/fuentes' if source else 'pristina')
    text = (base / file).read_text()
    assert text.count(sale) == 1, (file, sale, text.count(sale))
    line = text[:text.index(sale)].count('\n') + 1
    generated = not source and file in [f'10-corte/B{i}.md' for i in range(4, 8)]
    result = dict(archivo=file, linea=line, generado=generated,
                  donde_va=where or (f'v/generadores/g8/src/{Path(file).name}; regenerar con g8, sin editar la salida' if generated else None),
                  sale=sale, entra=entra)
    if generated:
        src = ROOT / 'v/generadores/g8/src' / Path(file).name
        # g8 expande enlaces sin cambiar la prosa. Guardar también la edición literal de src.
        to_src = lambda s: re.sub(r'\[([A-Z][A-Za-z0-9:#📌-]*)\]\([^\n)]*\)', r'{{\1}}', s)
        src_sale = sale if sale in src.read_text() else to_src(sale)
        src_entra = to_src(entra)
        assert src.read_text().count(src_sale) == 1, (src, src_sale)
        result['linea_generador'] = src.read_text()[:src.read_text().index(src_sale)].count('\n') + 1
        result['correccion_generador'] = dict(archivo=str(src.relative_to(ROOT)),
                                             linea=result['linea_generador'], sale=src_sale, entra=src_entra)
    return result

def add(ids, verdict, severity, summary, evidence, corrections=(), source_corrections=(), cause='', related=()):
    ids = ids.split()
    x = dict(id='H4-' + ids[0], grupo=None, miembros=['H4-' + i for i in ids],
             veredicto=verdict, clase_final=severity, relacionados=list(related), resumen=summary,
             verificadores=list(dict.fromkeys(i.rsplit('-', 1)[0] for i in ids)), respaldo='adjudicador',
             evidencia=evidence, correccion=list(corrections), correccion_fuente=list(source_corrections) or None,
             pregunta_owner=None, causa=cause, patron='P-F' if verdict == 'FUENTE' else 'P-AC',
             informes_originales={i: reports[i] for i in ids})
    unicos.append(x)
    return x

add('VA-A6-1 VB-08-3', 'REAL', 'BLOQUEA',
    'B2 asigna la carga de precios al paso 3a y excluye la migración estructural del paso 3; también lo exige en el AC y el smoke.',
    [B+'descomposicion.md:136 y :823 corrigen explícitamente «los carga la migración estructural del paso 3 y los verifica el 3a».',
     P+'docs/16-fase-7-del-paraguas.md:152–153 y :1130: catálogo con precios dentro del paso 3; 3a verifica.',
     'pristina/10-corte/B2.md:345–346 agrega «no esta migración»; :229 y :480 prescriben la carga en 3a.'],
    [fix('10-corte/B2.md','   carga el paso 3a y no se cambian durante el corte','   carga la migración estructural del paso 3, los verifica el 3a y no se cambian durante el corte'),
     fix('10-corte/B2.md','precios vigentes hoy, que carga el paso 3a y que no cambian durante el corte.','precios vigentes hoy, que carga la migración estructural del paso 3, verifica el 3a y no cambian durante el corte.'),
     fix('10-corte/B2.md','(BM): **los precios del corte son los vigentes hoy**, los carga el paso 3a y no se cambian durante el','(BM, con el residuo corregido en `B/descomposicion.md` §2): **los precios del corte son los vigentes hoy**, los carga la migración estructural del paso 3, los verifica el 3a y no se cambian durante el'),
     fix('10-corte/B2.md','- **Los precios del corte** son los vigentes hoy: las filas de `billing_option` las carga el paso 3a\n  del corte, no esta migración ([DEC-MP-002#📌2](../01-decisiones-vigentes.md#dec-mp-002-p2)).','- **Los precios del corte** son los vigentes hoy: las filas de `billing_option` las carga la migración\n  estructural del paso 3 con el catálogo; el paso 3a sólo las verifica (`B/descomposicion.md` §2;\n  `16-fase-7-del-paraguas.md` §4.2, pasos 3 y 3a, y §4.7, residuo corregido el 2026-10-02).'),
     fix('10-corte/B2.md','los valores de los plazos 10 a 19, y carga los precios vigentes hoy en las `billing_option`.','los valores de los plazos 10 a 19 y los precios vigentes hoy en las `billing_option`, cargados\npor la migración estructural del paso 3.'),
     fix('10-corte/B2.md','paso 3a y no se cambian durante el corte; **la acción 19 no se usa','paso 3 y el paso 3a sólo los verifica; no se cambian durante el corte; **la acción 19 no se usa')],
    [fix(P+'docs/01-decision-log.md','precios del corte son los vigentes hoy**: los carga el paso 3a y no se cambian durante el corte, y','precios del corte son los vigentes hoy**: los carga la migración estructural del paso 3 y los verifica el 3a; no se cambian durante el corte, y',True),
     fix(P+'docs/41-corte-del-mvp/10-decisiones-del-owner.md','**Los precios del corte son los vigentes hoy**: los carga el paso 3a y no se cambian durante el corte;','**Los precios del corte son los vigentes hoy**: los carga la migración estructural del paso 3 y los verifica el 3a; no se cambian durante el corte;',True)],
    'La consolidación dejó el reparto antiguo en B2 pese a la corrección expresa de la fuente. El log y la fila histórica BM conservan residuos secundarios: se proponen también para evitar su reintroducción.',
    ['H3-VB14-5: residuo de la misma familia ya corregido en la fuente del corte; aquí se adjudica B2, no se reabre aquel archivo.'])

add('VA-A6-3','REAL','BLOQUEA','ESQ:6 omite el instante del canje de promo_redemption, que debe nacer con su esquema en B3.',
    [B+'docs/02-modelo-de-datos.md:577: «código, user, cuándo, sobre qué suscripción».',
     P+'docs/41-corte-del-mvp/10-decisiones-del-owner.md: BG traslada el esquema a B3; no elimina columnas.',
     'pristina/10-corte/B3.md:961–966 enumera la unicidad y el contador, sin el instante; AC:B3:29 remite a ESQ:6.'],
    [fix('10-corte/B3.md','N cobros o forever—, y `promo_redemption` (`UNIQUE(promo_code_id, user_id)`, con `cobros_restantes`','N cobros o forever—, y `promo_redemption`, que guarda el código, el user, el instante del canje\ny la suscripción sobre la que se canjeó (`UNIQUE(promo_code_id, user_id)`, con `cobros_restantes`')],
    cause='Compresión del modelo a restricciones y contador, perdiendo un dato de auditoría obligatorio.')

add('VA-A9-1','REAL','BLOQUEA','AC:B8b:7 toma cualquier número menor como downgrade, incluso cuando mejora una clave MÍNIMO.',
    [B+'docs/10-verticales-planes-billing-options.md:110–117: BAJA significa empeora según estrategia; MÍNIMO baja con un número mayor.',
     'pristina/20-fase-2/B8b.md:488–492 no limita la estrategia; AC:V2:4 sí distingue la favorabilidad.'],
    [fix('20-fase-2/B8b.md','- **Dado** un cambio hacia una versión de `rank` MAYOR con un solo limit menor','- **Dado** un cambio hacia una versión de `rank` MAYOR en el que un limit empeora según su\n  estrategia —menor en `SUMA`/`MÁXIMO`, mayor en `MÍNIMO` o peor en `MEJOR_DECLARADO`—,\n  por lo que `direcciónDeCambio` devuelve `BAJA`')],cause='Ejemplo numérico convertido en condición general sin estrategia.')

add('VB-03-3','REAL','MENOR','03-contrato conserva «las doce siguen», aunque la fuente ya corrigió el recuento a trece.',
    [B+'descomposicion.md:361 tacha «once» y «doce» y deja «trece».',
     'pristina/03-contrato-de-cobertura.md:1780; DEP:15 está incluida, no falta una dependencia.'],
    [fix('03-contrato-de-cobertura.md','**El grafo de las dependencias no cambia por esto**: las doce siguen','**El grafo de las dependencias no cambia por esto**: las trece siguen')],
    cause='Copia anterior a la corrección del residuo.',related=['H2-VB03-5: señaló este residuo secundario en la fuente; ahora la fuente congelada ya dice trece.'])

add('VB-06-3','FUENTE','BLOQUEA','LISTA:V6 copia la salida incondicional de MODERATED a DRAFT que aún conserva la descomposición; DEC-DATA-007 ya la reemplazó.',
    [V+'descomposicion.md:717: la cláusula viva dice «levantar la moderación la deja en DRAFT con el reloj reiniciado».',
     P+'docs/01-decision-log.md:7076–7080 y su 📌: retorno según estado previo; PB11/PB13.',
     'pristina/10-corte/V6.md:159–160 copia la cláusula; AC:V6:11 ya conserva la distinción.'],
    source_corrections=[fix(V+'descomposicion.md','y levantar la moderación la deja en `DRAFT` con el reloj reiniciado** (`PB11`, hecho 6; 5b)','y levantar la moderación la devuelve a su estado previo: `DRAFT` si era borrador (`PB11`), `UNPUBLISHED_BY_BILLING` con `PB3` en el mismo acto si estaba publicada o bajada por billing (`PB13`), y si estaba archivada, según el origen de su archivado, como fija el 📌 de `DEC-DATA-007`; se reinicia el reloj**',True)],
    cause='Residuo vivo de la descomposición, anterior a DEC-DATA-007; corregir fuente, re-congelar y resincronizar LISTA:V6.')

add('VB-07-4','REAL','MENOR','V9a atribuye los tres avisos de retención a V9b; BL asigna «al archivar» a V6.',
    [P+'docs/41-corte-del-mvp/10-decisiones-del-owner.md:137, BL: V6 encola al archivar; V9b suma dos avisos previos y el job.',
     'pristina/10-corte/V9a.md:47–49 conserva el reparto correcto; :74–75 lo contradice sólo en Fuera de alcance.'],
    [fix('10-corte/V9a.md','- el reloj, `PB9`, el empuje a billing, la lista cerrada de `PURGED` y los tres avisos: `V9b`\n  ([FILA:V9b](../20-fase-1/V9b.md#fila-v9b)), en la Fase 1;','- el reloj, `PB9`, el empuje a billing, la lista cerrada de `PURGED` y los dos avisos previos: `V9b`\n  ([FILA:V9b](../20-fase-1/V9b.md#fila-v9b)), en la Fase 1; el aviso «al archivar» lo encola `V6`\n  en `PB4`/`PB5`, con su plantilla (BL);')],cause='Resumen de alcance anterior a BL.')

add('VB-08-4','REAL','BLOQUEA','B2 aún sitúa la mutación del aumento en la fecha efectiva; BZ y el 📌 de CC la sitúan siete días antes por S37.',
    [P+'docs/01-decision-log.md:1478–1499: el 📌 de CC precisa que el cobro, no la mutación, espera a la fecha efectiva.',
     'pristina/20-fase-3/B12.md: S37 siete días antes; B2:66, :296 y :378 contradicen esa regla.'],
    [fix('10-corte/B2.md','tres contactos, la fecha efectiva de cada cliente por su ciclo y la mutación del monto en esa fecha—,','tres contactos, la fecha efectiva de cada cliente por su ciclo y la mutación del monto por `S37`\n  siete días antes de esa fecha—,'),
     fix('10-corte/B2.md','relectura, en la fecha efectiva y no cuando se decide; un precio nuevo por debajo de ARS 15 no es','relectura, por `S37` siete días antes de la fecha efectiva; ningún cobro sale al precio nuevo antes\n  de esa fecha (BZ y [DEC-MP-002#📌4](../01-decisiones-vigentes.md#dec-mp-002-p4)); un precio nuevo por debajo de ARS 15 no es'),
     fix('10-corte/B2.md','El aviso a los ya anclados, sus contactos a 30 y a 7 días y la mutación en la fecha efectiva de cada\ncliente llegan con','El aviso a los ya anclados, sus contactos a 30 y a 7 días y la mutación por `S37` siete días antes de\nla fecha efectiva de cada cliente llegan con')],cause='No se propagó la precisión posterior del 📌 de CC.')

add('VB-08-5','REAL','BLOQUEA','La sección UI de B2 manda los tres correos del aumento a B13a, contradiciendo el reparto vigente a B12.',
    [P+'docs/01-decision-log.md:1471–1472, BM: aviso y mutación a ya anclados llegan con B12.',
     'pristina/10-corte/B2.md:69–70 los asigna correctamente a B12, pero :370 los da a B13a.'],
    [fix('10-corte/B2.md','[`B13a`](B13a.md#fila-b13a) (`B/descomposicion.md` §2.10, l. 690 y 693), y los tres correos del aumento también\n([DEC-MP-002](../01-decisiones-vigentes.md#dec-mp-002); `B/19` §4 fila 12).','[`B13a`](B13a.md#fila-b13a) (`B/descomposicion.md` §2.10); los tres correos del aumento\nlos construye [`B12`](../20-fase-3/B12.md#fila-b12), por BM\n([DEC-MP-002#📌2](../01-decisiones-vigentes.md#dec-mp-002-p2); `B/19` §4 fila 12).')],cause='Asignación de superficie que no incorporó BM.')

add('VB-08-6','REAL','BLOQUEA','AC:B3:17 impone alta nueva al reintentar S16 sin exceptuar la predecesora con checkout de sucesión abierto.',
    [B+'docs/03-maquinas-de-estado.md:166: excepción «terminar el checkout que ya está abierto»; S18 cierra la sucesión en el acto.',
     'pristina/10-corte/B3.md:418 excluye una sucesora de pagador previo, no una predecesora; :426 pierde la excepción.'],
    [fix('10-corte/B3.md','reintento es un alta nueva; y lo que se le dice sale del `status_detail` de ese único intento.','reintento es un alta nueva, **salvo que la fila fuera la predecesora de una sucesión**: en ese caso\n  `S18` cierra la sucesión en el acto por la interfaz interna que implementa `B8b`, la sucesora ocupa\n  el candado `A` y el reintento es terminar el checkout ya abierto (BL). Lo que se le dice sale del\n  `status_detail` de ese único intento. La prueba incluye ambas poblaciones y verifica la llamada\n  a la interfaz de `S18` con filas sembradas.')],cause='Pérdida de una excepción al resumir la transición; preservar BL al llevarla al AC.')

add('VB-08-7','REAL','MENOR','B3 vuelve a presentar como inferencia abierta el lector de S15 que BY ya resolvió.',
    [P+'docs/41-corte-del-mvp/10-decisiones-del-owner.md:168, BY: BL vale también para leer.',
     'pristina/10-corte/B3.md:1432–1434 registra el cierre, :1442–1445 repite la duda anterior.'],
    [fix('10-corte/B3.md','Nuevo en esta pasada (`_trabajo/abiertos/pasada2-g7.md`):\n\n- La guarda de `S15` que lee `reconciliation_mark_payment`, una tabla que nace en `B5`: BN habla de la\n  rama que la **escribe**; para la que la **lee**, apliqué BL por inferencia ([AC:B3:15](#ac-b3-15)).','La duda de `_trabajo/abiertos/pasada2-g7.md` sobre la lectura de `reconciliation_mark_payment`\npor `S15` **quedó cerrada por BY**: BL vale también para leer ([AC:B3:15](#ac-b3-15)); `B3` llama\na la interfaz interna y `B5` la implementa sobre su tabla.')],cause='Registro de abierto no retirado tras decisión expresa.')

add('VB-09-2','REAL','BLOQUEA','B4 exige encolar el aviso de cobertura después del commit; confunde la escritura atómica del outbox con su envío.',
    [P+'docs/nucleo/07-outbox-y-notificaciones.md:33–40: estado y outbox en una transacción; envío afuera.',
     P+'docs/12-contrato-de-cobertura.md:907: el aviso sale después del commit.',
     'pristina/10-corte/B4.md:349–350 y :391–392; mismo texto en g8/src/B4.md. AC:B4:2 no requiere la escritura tardía.'],
    [fix('10-corte/B4.md','- **Outbox**: el aviso de que la cobertura cambió se encola en el outbox común de `U2`, después del\n  commit;','- **Outbox**: el aviso de que la cobertura cambió se encola en el outbox común de `U2` dentro de\n  la misma transacción que el cambio de estado; sólo su envío sale después del commit;'),
     fix('10-corte/B4.md','El primer pago acreditado de una `ACTIVE` sin pagos deja el aviso en el outbox de `U2` sólo después\ndel commit; el consumidor que relee al recibirlo ve `cobrada: sí`.','El primer pago acreditado de una `ACTIVE` sin pagos escribe el estado y el aviso en el outbox de\n`U2` en la misma transacción: un rollback no deja ninguno; un commit deja ambos. El envío ocurre\nsólo después del commit; el consumidor que relee al recibirlo ve `cobrada: sí`.')],cause='Error en prosa y test de g8/src, no en la expansión de placeholders de g8/gen.py.')

add('VB-09-3 VA-A7-1','REAL','BLOQUEA','AC:B5:10 exige comprobante de transferencia y omite la referencia del panel admitida por RF4.',
    [B+'docs/03-maquinas-de-estado.md:1853: «con el comprobante de la transferencia o la referencia del panel».',
     'pristina/10-corte/B5.md:273–274 ya omite la alternativa, sin canario. El catálogo prístino sí la conserva.',
     'VA-A7-1 es mixto: la denuncia sobre 04-catalogos es VA-A7 plantado; la de B5 es este defecto real.'],
    [fix('10-corte/B5.md','Entonces nace el `refund` en `EXECUTED` por `RF4`, con quién la asentó, por dónde y el comprobante de\nla transferencia;','Entonces nace el `refund` en `EXECUTED` por `RF4`, con quién la asentó, por dónde y el comprobante de\nla transferencia **o la referencia del panel**;')],cause='El resumen del AC eliminó una alternativa de evidencia; g8/src requiere corrección.')

add('VB-09-4','REAL','BLOQUEA','AC:B5:13 y TEST:B5:7 no exigen el aviso al admin al abrir una cuota sin pago, incluida la primera sin S4.',
    [B+'docs/03-maquinas-de-estado.md:2441–2453: el aviso de falta de pago sale al abrir la cuota, también la primera.',
     'pristina/10-corte/B5.md:305–310 y :1019–1020 omiten el efecto; 04-catalogos conserva la obligación.'],
    [fix('10-corte/B5.md','en `SUSPENDED`, `GRACE_PERIOD`, `CANCEL_SCHEDULED` o `PAUSED`.','en `SUSPENDED`, `GRACE_PERIOD`, `CANCEL_SCHEDULED` o `PAUSED`. Al abrir la cuota sin pago se\nencola el aviso de falta de pago al admin, incluida la primera cuota del alta que no pasa por `S4`.'),
     fix('10-corte/B5.md','cuota lleva a `ACTIVE` por `S29` con un solo avance de fecha.','cuota lleva a `ACTIVE` por `S29` con un solo avance de fecha. Al abrirse una cuota sin pago, tanto\nla primera del alta como las posteriores, se comprueba un único aviso de falta de pago al admin;\nla deduplicación no encola otro aviso al reintentar `MP5`.')],cause='Efecto obligatorio presente en catálogo pero ausente del contrato verificable de la pieza.')

add('VB-09-6','REAL','BLOQUEA','AC:B6:5 generaliza la relectura del pago y omite que RF3 confirma UNA_VEZ leyendo su orden por id.',
    [B+'docs/03-maquinas-de-estado.md:1852: la relectura para UNA_VEZ es la de su orden por id.',
     'pristina/10-corte/B6.md:134 y :460–461; el test sólo cubre la obtención de id y el 409.'],
    [fix('10-corte/B6.md','Entonces pasa a `EXECUTED` sólo si la relectura por id del pago muestra acreditadas las devoluciones','Entonces pasa a `EXECUTED` sólo si la relectura por id del pago —o de su orden por id, si es una\ninstancia `UNA_VEZ`— muestra acreditadas las devoluciones'),
     fix('10-corte/B6.md','queda como error y la fila no pasa a `EXECUTED`.','queda como error y la fila no pasa a `EXECUTED`. Para `RF3`, el falso exige la relectura de la\norden por id: sólo con las devoluciones de esa fila acreditadas y sumando el monto confirmado\npasa a `EXECUTED`; con una parte pendiente sigue en `CONFIRMED`.')],cause='Excepción específica de la orden perdida al resumir RF3.')

add('VB-10-2','REAL','BLOQUEA','TEST:B7:6 corre S5 sobre un pago retenido por S19 y sobre ACTIVE; AC:B7:9 arrastra la misma mezcla de ramas.',
    [B+'docs/03-maquinas-de-estado.md:155–156: S5 requiere sus condiciones y GRACE_PERIOD; sobre ACTIVE corresponde P1.',
     B+'docs/03-maquinas-de-estado.md:169: S19 retiene sin reactivar mientras la sucesión siga en curso.',
     'pristina/10-corte/B7.md:204–206 y :1614–1616; AC:B7:16–17 conserva la retención.'],
    [fix('10-corte/B7.md','`S6`**: si hay un pago del período pendiente de `S19`, o la relectura muestra un cobro acreditado del\nperíodo, `S6` no ocurre y corre lo que dice [AC:B7:8](#ac-b7-8) (`S5`, y `P1` sobre una fila `ACTIVE`).','`S6`**: con un pago del período pendiente de `S19`, `S6` no ocurre y el pago sigue retenido, sin\nreactivar mientras la sucesión siga en curso. Si la relectura muestra un cobro acreditado del período\nque no queda retenido, `S6` no ocurre: corre `S5` con sus condiciones sobre `GRACE_PERIOD`,\no `P1` sobre `ACTIVE`, como dice [AC:B7:8](#ac-b7-8).'),
     fix('10-corte/B7.md','Un `paused` sin `PUT` nuestro sobre `ACTIVE` y sobre `GRACE_PERIOD` corre `S6`; nunca `S8`; con un\npago del período pendiente de `S19`, o con un cobro acreditado en la relectura del falso, `S6` no\nocurre y corre `S5`.','Un `paused` sin `PUT` nuestro sobre `ACTIVE` y sobre `GRACE_PERIOD`, cumplidas las guardas, corre\n`S6`, nunca `S8`. Con un pago del período pendiente de `S19`, no corre `S6` ni se reactiva:\nel pago sigue retenido mientras la sucesión siga en curso. Con un cobro acreditado en la relectura\ndel falso que no queda retenido, no corre `S6`: en `GRACE_PERIOD` corre `S5` con sus condiciones\ny en `ACTIVE` corre `P1`.')],cause='Una corrección previa fusionó «pago retenido» y «cobro que reactiva».',
    related=['H3-VB10-4: la corrección de vuelta 3 incorporó las guardas pero agrupó mal sus desenlaces; éste es el defecto residual, no una re-adjudicación del anterior.'])

add('VB-11-1','FUENTE','BLOQUEA','B9a copia «sin promos» para toda ventana S37–S38; el capítulo B/14 no incorporó la excepción del aumento con promo viva de BZ.',
    [B+'docs/14-promos-cortesias-y-grants.md:311 coincide con pristina/10-corte/B9a.md:307, dentro de g-secciones.',
     P+'docs/01-decision-log.md:1478–1482, BZ: el aumento conserva promo viva.',
     'pristina/10-corte/B11.md:1484–1486 y 20-fase-3/B12.md conservan la excepción.'],
    source_corrections=[fix(B+'docs/14-promos-cortesias-y-grants.md','**Entre `S37` y el `S38` que aplica ese cambio, el monto esperado es el precio de lista de la versión destino para su ciclo, sin promos**','**Entre `S37` y el `S38` que aplica ese cambio, el monto esperado es el precio de lista de la versión destino para su ciclo, sin promos, salvo si el motivo es «aumento»: en ese caso conserva y descuenta la promo viva (BZ; `DEC-MP-002`)**',True)],
    cause='Residuo del capítulo vivo; secciones/gen.py transcribe fielmente. Corregir fuente, re-congelar y regenerar secciones.')

add('VB-11-2','FUENTE','BLOQUEA','El cierre de pendientes de B/14 mantiene el reintento de aumento desde fecha efectiva, aunque la regla vigente ya cuenta desde S37.',
    [B+'docs/14-promos-cortesias-y-grants.md:741–742 coincide con pristina/10-corte/B9a.md:720–721 dentro de g-secciones.',
     B+'docs/09-conciliacion.md:185 tacha el cómputo desde fecha efectiva y deja desde S37.',
     'pristina/10-corte/B9a.md:294–298 ya lleva la regla correcta; no es un problema del generador.'],
    source_corrections=[fix(B+'docs/14-promos-cortesias-y-grants.md','reintento de monto de un aumento corren desde su fecha efectiva (§2.4).','reintento de monto de un aumento corren desde `S37`, la transición que muta el monto siete días antes de la fecha efectiva (BZ; `B/09` §3; `DEC-MP-002` y su 📌 de CC).',True)],
    cause='El cierre histórico no se sincronizó al corregir §2.4 y B/09.',
    related=['H3-VB13-6 trataba la atribución en 80-abiertos. La fuente actual B/09 ya precisó S37; este residuo distinto persiste en B/14.'])

add('VB-11-4','REAL','BLOQUEA','V9b usa una clave de schedule para la alerta cerrada por PURGED, que es correo de evento.',
    [P+'docs/nucleo/07-outbox-y-notificaciones.md:102–103 diferencia fecha objetivo de schedule e id de evento; :281: alerta cerrada cuando llega a PURGED.',
     'pristina/20-fase-1/V9b.md:637–639 agrupa los dos avisos previos y la alerta cerrada bajo schedule.'],
    [fix('20-fase-1/V9b.md','- Los dos avisos previos y el de la alerta cerrada se encolan en el outbox común de `U2`, con la\n  clave de schedule que lleva la fecha objetivo (`NUCLEO/07` §2); el *«al archivar»* lo encola `V6`','- Los dos avisos previos se encolan en el outbox común de `U2` con la clave de schedule que lleva\n  la fecha objetivo; el aviso de alerta cerrada por `PURGED` usa como ocurrencia el id del evento\n  de dominio que lo causó (`NUCLEO/07` §2). El *«al archivar»* lo encola `V6`')],cause='Agrupación de correos con identidades de ocurrencia distintas.')

add('VB-12-2','REAL','MENOR','AC:B11:23 remite al §6 de conciliación para una regla del §7.',
    [B+'docs/09-conciliacion.md:1083 encabeza §7 «Frecuencia y orden»; :1089 contiene el barrido de creaciones.',
     'pristina/10-corte/B11.md:1733 cita §6; :1737 ya tiene Origen correcto. El AC está fuera de g-secciones.'],
    [fix('10-corte/B11.md','nueva acuñada y persistida antes de llamar (`B/09` §6, `B/05` §1).','nueva acuñada y persistida antes de llamar (`B/09` §7, `B/05` §1).')],cause='Referencia de sección corrida; la conducta está bien.')

add('VB-12-3','REAL','BLOQUEA','TEST:B13a:8 oculta de la vista por defecto un pago contracargado; debe mostrarlo y excluirlo sólo de la propuesta de devolución.',
    [B+'docs/19-superficies.md:241–251: default significa devolver todos; el contracargado se muestra y se resuelve sin devolver.',
     'pristina/10-corte/B13a.md:1087–1088 cambia «fuera del default» por «no en la vista por defecto»; AC:B13a:9 sí lo muestra.'],
    [fix('10-corte/B13a.md','contracargo y no en la vista por defecto.','contracargo visible en el listado, excluido de la propuesta de devolución por defecto; se resuelve\nsin devolver.')],cause='El test interpreta una propuesta económica como un filtro visual.')

add('VB-13-4','REAL','MENOR','80-abiertos cierra el creador de domain_event con BN en lugar de BW, que corrigió expresamente esa asignación.',
    [P+'docs/41-corte-del-mvp/10-decisiones-del-owner.md:156, BW: U2 crea domain_event; precisa BN.',
     'pristina/80-abiertos.md:589 apunta a BN; AC:U2:11 y TEST:U2:11 implementan el cierre correcto.'],
    [fix('80-abiertos.md','| AB-g6-4 · V9a · Qué pieza crea `domain_event`, el registro donde `V9a` escribe los actos del dueño | `g6-v5-v9.md`:69 | [BN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bn) |','| AB-g6-4 · V9a · Qué pieza crea `domain_event`, el registro donde `V9a` escribe los actos del dueño | `g6-v5-v9.md`:69 | [BW](01-decisiones-vigentes.md#own-41-corte-del-mvp-t10-bw): `U2`; precisa la aplicación de BN |')],cause='Enlace a la letra anterior, no a la que resolvió el abierto.')

add('VB-14-1','FUENTE','BLOQUEA','30-el-corte copia los dieciocho plazos del paso 3 de la fuente, que no incorporó la clave 19 de BU/BX.',
    [P+'docs/16-fase-7-del-paraguas.md:152 mantiene vivo «con los dieciocho valores» (quince está tachado).',
     P+'docs/nucleo/02-modelo-de-datos.md:195–198 ya dice diecinueve; BU agrega la clave 19, BX exige su valor antes del merge de B2.',
     'pristina/30-el-corte.md:452–456 copia el residuo; 02-nucleo y AC:B2:6 conservan la clave 19.'],
    source_corrections=[fix(P+'docs/16-fase-7-del-paraguas.md','con los ~~quince~~ dieciocho valores','con los ~~quince~~ ~~dieciocho~~ diecinueve valores',True),
                        fix(P+'docs/16-fase-7-del-paraguas.md','**antes del merge de `V6`** (FASE 5, owner 2026-09-30, lote 3 D; S-78)','**antes del merge de `V6`**; **el valor de la clave 19 de billing lo fija antes del merge de `B2` (BU, BX)** (FASE 5, owner 2026-09-30, lote 3 D; S-78)',True)],
    cause='Residuo vivo del paso 3; no exige una nueva decisión del owner.')

# Atribución semántica manual por cada fila de canarios.txt. No se usa cercanía de líneas.
matches = [
 ['VB-01-2'], ['VB-02-1','VA-A1-1'], ['VB-03-2','VA-A1-2','VA-A6-4'],
 ['VB-04-1'], ['VB-05-1'], ['VB-06-1'], ['VB-07-2'], ['VB-08-2'], ['VB-09-1'],
 ['VB-10-3'], ['VB-11-3','VA-A10-1'], ['VB-12-4'], ['VB-13-2'], ['VB-14-2'],
 ['G1-2'], ['G1-3'], ['G2-5','VB-13-1'], ['G2-3','VA-A10-2'],
 ['VB-01-1'], ['VB-02-2'], ['VB-03-1'], ['VB-04-2'], ['VB-05-2','VA-A4-3'],
 ['VB-06-4','VA-A4-1'], ['VB-07-1','VA-A3-2','VA-A4-4'], ['VB-08-1'], ['VB-09-5'],
 ['VB-10-1'], ['VB-11-5','VA-A4-2'], ['VB-12-1'], ['VB-13-3'], ['VB-14-3'],
 ['G1-1'], [], ['G1-4','VA-A2-1','VA-A3-1'], ['G1-6','VB-06-2'],
 ['G2-1','VB-07-3'], ['VA-A6-2'], ['G2-2','VA-A7-1'], ['VA-A8-1'], ['G2-6'],
 ['G1-5','G2-4','VA-A10-3']
]
canarios=[]
lines=(ROOT/'canarios.txt').read_text().splitlines()
assert len(lines)==len(matches)==42
for n,(line,ids) in enumerate(zip(lines,matches),1):
    block,where,kind,before,after,source,meaning = line.split(' | ')
    detectors=list(dict.fromkeys(i.rsplit('-',1)[0] for i in ids))
    note=''
    if n==33:note='G1-1 denuncia la cláusula plantada sobre catálogo cerrado del evento de activación; no denuncia por separado todas las ubicaciones de auditoría. Detección parcial del canario compuesto, contada una vez.'
    if n==34:note='Ningún informe final denuncia la pérdida del recordatorio al owner. VA-A2 reporta el contador Redis, que es VA-A3, no este canario.'
    if n==35:note='VA-A3-1 confirma la omisión aunque la heurística no lo marcó CAN?. VA-A2-1 también la detecta desde otro bloque.'
    if n==39:note='VA-A7-1 es mixto: detecta el canario sólo en 04-catalogos; su denuncia de B5 subsiste en pristina y se adjudica por separado.'
    canarios.append(dict(numero=n,bloque=block,donde=where,tipo=kind,detectado_por=detectors,
                         detectado=bool(ids),por_su_bloque=block in detectors,nota=note,
                         hallazgos=ids,regla=meaning,fuente=source,sale=before,entra=after))

por_id={m:x for x in unicos for m in x['miembros']}
dups={x['id']:x['miembros'] for x in unicos if len(x['miembros'])>1}
classified={i.removeprefix('H4-') for i in por_id}
classified.update(i for c in canarios for i in c['hallazgos'])
assert set(reports)-classified == {'VA-A5-1'}, set(reports)-classified
assert not any(x['veredicto']=='OWNER' for x in unicos)
counts=Counter(x['veredicto']+' '+x['clase_final'] if x['veredicto']=='REAL' else x['veredicto'] for x in unicos)
payload=dict(unicos=unicos,por_id=por_id,duplicados=dups,canarios=canarios,
             metadatos=dict(vuelta=4,fuente_congelada='9149b84a255efc94473ace4458541f4d2278da8d',
                            referencia_lineas='pristina/',ultima_letra_owner='CJ',
                            resumen=dict(counts),informes_finales=26,
                            excluidos='G2-cruces, G2-decisiones, G2-items, G2-patrones y VA-A7-cotejo* son evidencia auxiliar, no hallazgos. VA-A5 declara cero hallazgos.',
                            validacion='Todos los sale literales existen una sola vez en el archivo base y su línea se calculó contra pristina o la fuente congelada; propuestas no aplicadas.'))
(OUT/'hallazgos.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')

rows=['# Canarios de la vuelta 4 (HOS-1352): quién detectó cada uno','',
      'Copia ciega `v/s/5586fad7/`; 42 canarios. Atribución por el contenido semántico del hallazgo, no por línea ni por CAN?.',
      'Sólo cuentan los 26 informes finales; no los volcados de rg ni los cotejos auxiliares. Una detección parcial de un canario compuesto cuenta una vez y se aclara.', '',
      '| # | bloque | tipo | dónde (copia) | detectado por | su bloque |','|---|---|---|---|---|---|']
for c in canarios:
    rows.append(f"| {c['numero']} | {c['bloque']} | {c['tipo']} | {c['donde']} | {', '.join(c['detectado_por']) or '**NO DETECTADO**'} | {'sí' if c['por_su_bloque'] else 'no'} |")
rows += ['', 'Balance: 41/42 detectados; VB 28/28, G 4/4, VA 9/10. Por su propio bloque: 37/42 (VB 28/28, G 4/4, VA 5/10).', '', '## Evidencia por canario', '']
for c in canarios:
    rows += [f"{c['numero']}. {c['bloque']} / {c['tipo']}: {c['regla']}",
             f"   Hallazgos: {', '.join('['+i+']' for i in c['hallazgos']) or 'ninguno'}. Fuente: {c['fuente']}."]
    if c['nota']: rows.append('   '+c['nota'])
rows += ['', 'El canario VA-A2 no se corrige en la spec real: pristina/30-el-corte.md:905–906 conserva el recordatorio.',
         'Los canarios no se incorporan al conteo de no-canarios ni generan correcciones contra HEAD.']
(OUT/'canarios-resultado.txt').write_text('\n'.join(rows)+'\n')

rows=['# Correcciones propuestas — vuelta 4', '',
      'No aplicadas. Líneas de la spec: copia pristina (HEAD), nunca la copia con canarios. Cada bloque sale/entra es literal; aplicar por contenido, porque las líneas cambiarán al aplicar correcciones anteriores.',
      'B4–B7 se corrigen en v/generadores/g8/src y se regeneran. Un error de contenido de src se clasifica REAL: g8/gen.py sólo expande enlaces y prefijos y no introdujo estas reglas.',
      'Las propuestas en fuentes requieren corregir la fuente, un nuevo congelado y sincronizar/regenerar las salidas; no parchear los tramos g-secciones.', '']
byfile={}
for x in unicos:
    for c in x['correccion']: byfile.setdefault(c['archivo'],[]).append((x,c))
def show(x,c):
    rows = [f"{x['id']} · {x['veredicto']} {x['clase_final']} · línea {c['linea']}",
            x['resumen'], 'Destino: '+(c['donde_va'] or c['archivo']),
            'sale:\n```text\n'+c['sale']+'\n```','entra:\n```text\n'+c['entra']+'\n```','']
    if 'correccion_generador' in c:
        g = c['correccion_generador']
        rows += [f"Edición literal a realizar en {g['archivo']}:{g['linea']} (la anterior describe la salida esperada):",
                 'sale:\n```text\n'+g['sale']+'\n```','entra:\n```text\n'+g['entra']+'\n```','']
    return rows
for f,items in sorted(byfile.items()):
    rows += ['## '+f,'']
    for x,c in sorted(items,key=lambda it:it[1]['linea']): rows+=show(x,c)
rows += ['## En las fuentes','',
         'Cuatro únicos FUENTE. Además se alinean los dos residuos históricos de BM ligados al REAL de B2, sin contarlos como otro hallazgo.', '']
for x in unicos:
    if x['correccion_fuente']:
        rows += ['### '+x['id'],'',x['causa'],'']
        for c in x['correccion_fuente']:
            rows += ['Archivo fuente: '+c['archivo']]+show(x,c)
        if x['veredicto']=='FUENTE':
            targets={'H4-VB-06-3':'10-corte/V6.md:159–160 (LISTA:V6)',
                     'H4-VB-11-1':'10-corte/B9a.md:307 (g-secciones, regenerar secciones/gen.py)',
                     'H4-VB-11-2':'10-corte/B9a.md:720–721 (g-secciones, regenerar secciones/gen.py)',
                     'H4-VB-14-1':'30-el-corte.md:452–456 (paso 3)'}
            rows += ['Salida a sincronizar tras el re-congelado: '+targets[x['id']]+'.','']
rows += ['## FALSO','', 'Ningún único no-canario queda FALSO en esta vuelta. Se revisaron los FALSO de vueltas 1–3; ninguno corresponde a los reclamos actuales.',
         'VA-A5-1 informa cero hallazgos: no es un FALSO. Los volcados auxiliares tampoco son hallazgos.', '',
         '## OWNER y GENERADOR','', 'OWNER: 0. Última letra vigente: CJ; no se crea owner.txt.',
         'GENERADOR: 0. No se detectó una regla del código que introdujera un defecto no-canario: los de B4–B7 ya están en g8/src y los residuos de B9a están en B/14.', '',
         '## Validación','', 'Se validaron las coincidencias literales únicas y las líneas de todas las propuestas, además de la cobertura de todos los hallazgos finales. No se ejecutaron generadores contra la spec ni tests del producto: este entregable adjudica documentos y no implementa billing.']
(OUT/'correcciones.txt').write_text('\n'.join(rows)+'\n')

patterns='''# Patrones — adjudicación de vuelta 4

Resultado: 22 únicos no-canarios: 13 REAL BLOQUEA, 5 REAL MENOR, 4 FUENTE, 0 FALSO, 0 GENERADOR y 0 OWNER.

P-F · Fuente fiel con residuo vivo. V/descomposicion:717 conserva la salida incondicional a DRAFT; B/14:311 conserva «sin promos» sin BZ; B/14:742 conserva fecha efectiva; P/16:152 conserva dieciocho plazos. Las decisiones posteriores resuelven los cuatro. No pedir una letra nueva, no corregir a mano g-secciones y no culpar a su limpieza de tachados.

P-AC · La condensación de una transición pierde ramas. S16 distingue predecesora de sucesora; RF3 distingue pago de orden; RF4 admite comprobante o referencia; MP5 avisa al admin incluso sin S4. Mantener estas distinciones en el AC y probar las alternativas, sin tratar la cita al catálogo como reemplazo del criterio.

P-RET · Una corrección anterior también requiere verificación semántica. H3-VB10-4 incorporó guardas a B7, pero el texto resultante mezcla pago retenido con pago que reactiva. El test de vuelta 4 exige S5 donde S19 lo prohíbe y también sobre ACTIVE. Se corrigen AC y test juntos; no se reabre el hallazgo anterior como si no se hubiera atendido.

P-T · Separar instante de escritura, envío y cobro. B4 escribe outbox dentro de la transacción y envía después; B2 muta por S37 siete días antes y cobra desde la fecha efectiva. V9b debe distinguir la ocurrencia de un schedule de la de un evento de purga.

P-REF · Repartos y referencias residuales. BL, BY, BW y BM ya resolvieron avisos, interfaces y creación de domain_event. El alcance resumido y el registro de abiertos deben llevar la misma decisión que los AC. El conteo de trece dependencias y la referencia a §7 no cambian comportamiento, pero deben sincronizarse.

P-G · Archivo generado no equivale a defecto GENERADOR. g8/gen.py: expand() cambia placeholders y prefijos; el contenido errado está en src/B4–B7. secciones/gen.py: limpiar() elimina tachados, no inventa excepciones de decisiones posteriores. Sus dos residuos de B9a están vivos en B/14. G1 y G2 sólo denunciaron canarios en esta vuelta; los defectos GENERADOR de vuelta 3 no se vuelven a contar.

P-C · Medición de canarios. VB: 28/28, todos por su bloque. G: 4/4, todos por su bloque. VA: 9/10, cinco por su bloque. El recordatorio operativo al owner (VA-A2) quedó sin detectar. G1 detectó sólo una cláusula del canario compuesto VA-A1: no prueba que se hayan revisado todas sus ubicaciones. No atribuir VA-A3 a VA-A2 como «propio» porque VA-A2 lo haya reportado.

P-EXT · Extracción no es adjudicación. hallazgos-todos incluye volcados G2-* y VA-A7-cotejo*. Sólo los 26 informes finales definen hallazgos. VA-A3-1 es canario confirmado sin marca CAN?. VA-A7-1 contiene a la vez un canario de catálogo y un REAL en B5; se divide por regla y ubicación, no se descarta entero.

Duplicados: VA-A6-1 + VB-08-3 (precios del corte); VB-09-3 + componente B5 de VA-A7-1 (evidencia de RF4). El componente de catálogo de VA-A7-1 cuenta para VA-A7 y no como otro REAL.

Verificado: lectura de los tres skills de dominio; reglas QZ de estilo/permisos; adapter del proyecto; hallazgos finales, diff de canarios, fuente congelada y copia pristina; decisiones posteriores hasta CJ; adjudicaciones 1–3; clasificación del destino de las correcciones. Todas las propuestas sale/entra coinciden literalmente con sus insumos y sus líneas se calculan sobre pristina o la fuente, no sobre la copia ciega.

Límites: no se verificó implementación del producto ni comportamiento de Mercado Pago. No se ejecutó el build de producto del adapter, porque no valida esta adjudicación documental. No se usaron git, trackers, subagentes ni escrituras externas a adjudicacion. Propuestas no aplicadas; el re-congelado y la regeneración corresponden a la fase de corrección autorizada posteriormente.
'''
(OUT/'patrones.txt').write_text(patterns)
print(json.dumps(dict(unicos=len(unicos),por_veredicto=dict(counts),canarios_detectados=sum(c['detectado'] for c in canarios),propio=sum(c['por_su_bloque'] for c in canarios),correcciones=sum(len(x['correccion']) for x in unicos)),ensure_ascii=False))

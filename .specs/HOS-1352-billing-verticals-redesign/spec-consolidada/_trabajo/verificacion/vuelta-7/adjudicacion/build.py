from pathlib import Path
import json
import re
from collections import Counter

ROOT = Path('/home/qazuor/.cache/hos1352/vuelta-7')
OUT = ROOT / 'adjudicacion'
P = '.specs/HOS-1352-billing-verticals-redesign/docs/'
B = '.specs/HOS-1354-billing-cobro-y-proveedor/docs/'
SHA = '5381f7579687651df168575c85f144f9b48daea7'

# Asociaciones adjudicadas por contenido, no calculadas por distancia de línea.
MAP = {
 1:'VB-01-2', 2:'VB-02-3', 3:'VB-03-2 VA-A1-1', 4:'VB-04-2',
 5:'VB-05-2', 6:'VB-06-1 VA-A4-2', 7:'VB-07-2 VA-A5-1', 8:'VB-08-3',
 9:'VB-09-1 VA-A2-1', 10:'VB-10-1', 11:'VB-11-1', 12:'VB-12-1 VA-A8-1',
 13:'VB-13-1', 14:'G1-1', 15:'G2-7 VA-A10-1', 16:'VB-01-1',
 17:'VB-02-1', 18:'VB-03-1', 19:'VB-04-1', 20:'VB-05-1',
 21:'VB-06-2', 22:'VB-07-1', 23:'VB-08-4', 24:'VB-09-3',
 25:'VB-10-2', 26:'VB-11-2 VA-A6-2', 27:'VB-12-2', 28:'VB-13-4',
 29:'VB-14-3', 30:'VB-14-2', 31:'G1-2', 32:'G2-1 VA-A3-2',
 33:'VB-09-2 VA-A6-1 G1-6', 34:'VB-02-2 VA-A1-3', 35:'VB-14-1',
 36:'VA-A3-1', 37:'G1-5 G1-9', 38:'VA-A5-2 G1-8 G2-6',
 39:'VB-08-1 VA-A10-4 G1-7 G2-4',
 40:'VA-A9-1 VA-A10-3 G1-3 G2-10 G2-11',
 41:'VB-02-4 VA-A1-2 VA-A7-1 VA-A8-2 VA-A10-2 G2-2 G2-3 G2-8 G2-9',
 42:'VB-04-3 VB-13-2 VA-A4-1',
}
PARTIAL = {42: ['G1-4', 'G2-5']}
reports = {}
for path in sorted((ROOT / 'v/salidas').glob('*.txt')):
    if not re.fullmatch(r'(VB-\d+|VA-A\d+|G[12])', path.stem):
        continue
    body = path.read_text().split('## Hallazgos')[1].split('## Resumen')[0]
    rows = [s.strip() for s in body.splitlines() if ' · ' in s]
    for n, row in enumerate(rows, 1):
        reports[f'{path.stem}-{n}'] = row

canarios = []
for n, line in enumerate((ROOT / 'canarios.txt').read_text().splitlines(), 1):
    block, location, kind, old, new, source, rule = line.split(' | ')
    ids = MAP[n].split()
    detectors = sorted({i.rsplit('-', 1)[0] for i in ids})
    canarios.append(dict(numero=n, bloque=block, tipo=kind, ubicacion=location,
        detectores=detectors, propio=block in detectors, hallazgos=ids,
        fuente=source, confirmacion=rule,
        hallazgos_parciales=PARTIAL.get(n, []), sale=old, entra=new,
        informes_originales={i: reports[i] for i in ids + PARTIAL.get(n, [])}))

def correction(file, line, old, new):
    text = (ROOT / 'pristina' / file).read_text()
    assert text.count(old) == 1, (file, line, 'sale no único')
    actual = text[:text.index(old)].count('\n') + 1
    assert actual == line, (file, line, actual)
    return dict(archivo=file, linea=line, generado=False, donde_va=None, sale=old, entra=new)

def finding(id, member, verdict, severity, summary, evidence, corrections, source_corrections,
            related, cause, pattern):
    return dict(id=id, grupo=None, miembros=['H7-' + member], veredicto=verdict,
        clase_final=severity, relacionados=related, resumen=summary,
        verificadores=[member.rsplit('-', 1)[0]], respaldo='adjudicador', evidencia=evidence,
        correccion=corrections, correccion_fuente=source_corrections, pregunta_owner=None,
        causa=cause, patron=pattern, informes_originales={member: reports[member]})

unicos = [finding('H7-VB-08-2', 'VB-08-2', 'REAL', 'BLOQUEA',
    'AC:B1:20 y Seguridad extienden el guard de entorno a toda sonda, incluidas las de sólo lectura; la fuente lo exige a lo que muta.',
    [B+'06-proveedor.md:214–220: GET /users/me distingue el entorno; «Todo lo que mute algo abre con ese guard».',
     B+'06-proveedor.md:402–408: «toda sonda que mute»; la batería hereda los dos guards de esa tabla, sin ampliar su alcance.',
     B+'20-testing.md:663–664, 672: RP7–RP11 se releen sin mutar; la batería conserva el alcance de los guards del capítulo 06.',
     P+'01-decision-log.md:7187–7213 (DEC-TEST-003 y su 📌): la batería y la autorización mensual no agregan el guard a toda lectura. Las letras del corte tampoco lo amplían.',
     'pristina/10-corte/B1.md:357–364, 635, 768–770: el AC y Seguridad difieren de su propia tabla; la inferencia marcada sólo justifica abortar ante una cuenta equivocada.',
     'Vuelta 2, H2-VA8-11 (REAL MENOR): pidió llevar los guards a un AC, pero su entra introdujo «toda sonda o mutación». Se conserva el AC y se corrige ese alcance. No fue un FALSO anterior.',
     'pristina/10-corte/B1.md:917–921: TEST:B1:19 ya sitúa el aborto antes de la primera mutación; no exige extenderlo a las lecturas. B1 es manual, no salida g8 ni tramo g-secciones.'],
    [correction('10-corte/B1.md',357,
       '- **Cuando** va a hacer una sonda o una mutación contra el proveedor, y cuando va a hacer una que mueve\n  plata',
       '- **Cuando** va a hacer una operación que muta algo en el proveedor, y cuando va a hacer una sonda\n  que mueve plata'),
     correction('10-corte/B1.md',359,
       '- **Entonces** toda sonda o mutación abre con `GET /users/me` y aborta, sin mandar nada, si la cuenta no',
       '- **Entonces** toda operación que muta algo abre con `GET /users/me` y aborta, sin mandar nada, si la cuenta no'),
     correction('10-corte/B1.md',768,
       'van como AC propio ([AC:B1:20](#ac-b1-20)): toda sonda o mutación contra el proveedor abre con',
       'van como AC propio ([AC:B1:20](#ac-b1-20)): toda operación que muta algo en el proveedor abre con')],
    [], ['H2-VA8-11'], 'Ampliación de un cuantificador al convertir la regla en AC.', 'P-ALCANCE'),
 finding('H7-VB-13-3', 'VB-13-3', 'REAL', 'BLOQUEA',
    '80-abiertos:355 conserva el comienzo del reintento en la fecha efectiva; la fuente congelada actual exige contarlo desde S37, siete días antes.',
    [B+'14-promos-cortesias-y-grants.md:739–742: la pregunta anterior está tachada y el cierre vivo dice «desde `S37`», siete días antes de la fecha efectiva.',
     P+'01-decision-log.md:1478–1499: BZ define la migración S37/S38; el 📌 de CC precisa expresamente que la mutación es siete días antes y que ningún cobro sale al nuevo precio antes de la fecha efectiva.',
     P+'41-corte-del-mvp/10-decisiones-del-owner.md:169: BZ remite a S37/S38; se leyó además el 📌 que la aplica, no sólo la fila.',
     'pristina/10-corte/B11.md:250 y 80-abiertos.md:355: el cuerpo operativo conserva S37, pero el resumen del cierre declara otro origen del plazo.',
     'Vuelta 3, H3-VB13-6 (REAL MENOR): ordenó copiar «fecha efectiva» porque ésa era entonces la fuente citada. La fuente del SHA actual ya fue corregida a S37; no se reabre la decisión del owner ni se vuelve a juzgar el mismo congelado.',
     '80-abiertos es redacción manual: no corresponde cambiar g1, g3, g8 ni g-secciones. Aunque no tenga AC propios, el resumen del cierre no debe postergar siete días una regla vigente.'],
    [correction('80-abiertos.md',355,
      'y los 3 días del reintento de monto corren desde su fecha efectiva (`B/14` §2.4), como dice la fuente',
      'y los 3 días del reintento de monto corren desde `S37`, que muta el monto siete días antes de la fecha efectiva (`B/14`, cierre de «El instante del aumento de precio»; `B/09` §3; `DEC-MP-002` y su 📌 de CC), como dice la fuente')],
    [], ['H3-VB13-6'], 'Resumen que no acompañó la corrección posterior de su fuente.', 'P-CONGELADO'),
 finding('H7-VB-13-5', 'VB-13-5', 'FUENTE', None,
    '80-abiertos:451 transcribe fielmente el residuo de B/22:87 que sitúa la mutación en la fecha efectiva. El 📌 de CC ya lo reemplaza por S37 siete días antes.',
    [B+'22-lo-legal.md:87: contiene literalmente «llegada la fecha efectiva **el monto se muta automáticamente**». El texto está vivo, no tachado.',
     'pristina/80-abiertos.md:451 (453 en la copia ciega): misma fila, salvo el enlace de DEC-MP-002. La divergencia ya está en la fuente.',
     P+'01-decision-log.md:1495–1499: precisión expresa de CC sobre la parte 3; se muta por S37 siete días antes, pero el primer cobro al precio nuevo espera la fecha efectiva.',
     B+'22-lo-legal.md:92–94: el riesgo aceptado es la falta de aceptación activa; corregir cuándo se muta no cambia esa decisión ni requiere otra letra.',
     'Vuelta 4, H4-VB-08-4: corrigió el mismo residuo temporal en B2. Esta ubicación de B/22 es adicional. No es un fallo del generador ni una decisión OWNER pendiente.'],
    [], [dict(archivo=B+'22-lo-legal.md', linea=87,
      sale='llegada la fecha efectiva **el monto se muta automáticamente**; el cliente no acepta nada, puede cancelar antes',
      entra='**`S37` muta el monto automáticamente siete días antes de la fecha efectiva**, y **ningún cobro sale al precio nuevo antes de esa fecha** (`DEC-MP-002`, 📌 de CC, leído con BZ); el cliente no acepta nada, puede cancelar antes',
      propagacion=dict(archivo='80-abiertos.md', linea=451, generado=False,
        donde_va='Primero en B/docs/22-lo-legal.md:87; re-congelar y actualizar la transcripción manual.',
        sale='llegada la fecha efectiva **el monto se muta automáticamente**; el cliente no acepta nada, puede cancelar antes',
        entra='**`S37` muta el monto automáticamente siete días antes de la fecha efectiva**, y **ningún cobro sale al precio nuevo antes de esa fecha** (`DEC-MP-002`, 📌 de CC, leído con BZ); el cliente no acepta nada, puede cancelar antes'))],
    ['H4-VB-08-4'], 'Residuo vivo en una tabla legal anterior al 📌 de CC, copiado fielmente.', 'P-FUENTE')]

for u in unicos:
    for c in u['correccion_fuente']:
        txt = (ROOT/'v/fuentes'/c['archivo']).read_text()
        assert txt.count(c['sale']) == 1
        assert txt[:txt.index(c['sale'])].count('\n')+1 == c['linea']
        pc = c['propagacion']
        correction(pc['archivo'], pc['linea'], pc['sale'], pc['entra'])

assigned = [i for c in canarios for i in c['hallazgos'] + c['hallazgos_parciales']]
assigned += [next(iter(u['informes_originales'])) for u in unicos]
assert len(assigned) == len(set(assigned))
assert set(assigned) == set(reports), (set(reports)-set(assigned), set(assigned)-set(reports))
assert len(canarios) == 42

summary = dict(canarios_detectados=sum(bool(c['detectores']) for c in canarios),
               canarios_propios=sum(c['propio'] for c in canarios))
summary.update({'REAL BLOQUEA':2, 'REAL MENOR':0, 'FUENTE':1, 'FALSO':0, 'GENERADOR':0, 'OWNER':0})
types = {}
for t in ['VB', 'G', 'VA']:
    cs = [c for c in canarios if c['bloque'].startswith(t)]
    types[t] = dict(total=len(cs), detectados=sum(bool(c['detectores']) for c in cs), propios=sum(c['propio'] for c in cs))
summary['por_tipo'] = types
data = dict(unicos=unicos, canarios=canarios, resumen=summary,
    alcance=dict(fuentes_sha=SHA, spec='pristina', informes=26,
      hallazgos_reportados=len(reports), ocurrencias_canarias=len(assigned)-3,
      ocurrencias_no_canarias=3, unicos_no_canarios=3,
      exclusiones='Los auxiliares G1-*, G2-* (corpus, patrones, búsquedas y cotejos) son evidencia de trabajo, no informes finales ni hallazgos adicionales. hallazgos-todos.txt mezcla esos auxiliares con los 26 informes: CAN? no decide nada.',
      criterio_semantico='G1-4 y G2-5 son efectos parciales del canario 42: detectan el ordinal perdido, no la pérdida de enforcementStrategy. Se conservan asociados, pero no se cuentan como detección semántica completa.',
      verificacion='Cotejo documental de informes, diff de canarios, fuente congelada sin tachados vivos, precisiones aplicables y antecedentes. Cada sale y línea de las correcciones se valida literalmente contra pristina; propuestas de fuente contra el congelado. Sin git, tracker, edición de spec, ejecución de generadores ni pruebas de producto.'))
(OUT/'hallazgos.json').write_text(json.dumps(data, ensure_ascii=False, indent=4)+'\n')

lines = ['# Canarios — vuelta 7', '',
 'Numeración: orden de canarios.txt. Asociación semántica contra canarios.diff, informes finales, pristina y fuentes congeladas. CAN? no se usa como veredicto.', '',
 '| Nº | Bloque | Tipo | Ubicación plantada | Detectado por | Por su bloque |',
 '|---|---|---|---|---|---|']
for c in canarios:
    lines.append(f"| {c['numero']} | {c['bloque']} | {c['tipo']} | {c['ubicacion']} | {', '.join(c['detectores'])} | {'sí' if c['propio'] else 'no'} |")
lines += ['', 'Resultado: 42/42 detectados; 39/42 por su propio bloque.',
 'VB: 28/28, propios 28/28. G: 4/4, propios 4/4. VA: 10/10, propios 7/10.',
 'Por operación: MODIFICA 18/18, AGREGA 14/14, OMITE 10/10.', '',
 'No detectados por el bloque propio:',
 '- 35 / VA-A2: purga de portada; lo detecta VB-14-1. VA-A2-1 trata el primer instante de cancelación (canario 9), no esta purga.',
 '- 37 / VA-A5: soporte como actor del borrado; lo detecta G1 en dos copias (G1-5 y G1-9). VA-A5 detecta otros canarios, no éste.',
 '- 38 / VA-A8: ausencia de mínimo de reembolso; lo detectan VA-A5-2, G1-8 y G2-6. VA-A8 detecta último ciclo y correo de disputa, no la regla del mínimo.', '',
 'Detecciones parciales: G1-4 y G2-5 advierten la pérdida de «cuarto» dentro del canario 42, pero no identifican la omisión de enforcementStrategy. No se los incluye como detectores semánticos completos. Sí se conserva su asociación con el canario; no son defectos de pristina.', '',
 'El canario 9 cuenta como detectado también por VA-A2: calificó MENOR el conflicto porque AC y TEST conservaban el primer instante. La severidad elegida no invalida la detección.', '',
 'Confirmación por canario (ítems de los informes finales):']
for c in canarios:
    lines += ['', f"{c['numero']:02}. {c['confirmacion']}",
        '    Detectado en: '+', '.join(c['hallazgos'])+'.', '    Fuente: '+c['fuente']+'.']
    if c['hallazgos_parciales']:
        lines.append('    Efectos parciales: '+', '.join(c['hallazgos_parciales'])+'.')
(OUT/'canarios-resultado.txt').write_text('\n'.join(lines)+'\n')

def literal(c):
    return ['SALE (literal):', '```text', c['sale'], '```', 'ENTRA (literal):', '```text', c['entra'], '```']
lines = ['# Correcciones propuestas — vuelta 7', '',
    'Sólo propuestas. Líneas de la spec real en pristina, nunca de la copia ciega. Fuente congelada: '+SHA+'.',
    'Dos REAL BLOQUEA; un FUENTE; cero REAL MENOR, FALSO, GENERADOR y OWNER.',
    'Los canarios no requieren correcciones: pristina ya conserva las reglas originales.', '']
for file in sorted({c['archivo'] for u in unicos for c in u['correccion']}):
    lines += ['## '+file, '']
    for u in unicos:
        for c in u['correccion']:
            if c['archivo'] != file: continue
            lines += [f"### {u['id']} · {u['veredicto']} {u['clase_final']} · línea {c['linea']}", '',
                u['resumen'], 'Generado: no. Destino de aplicación futura: el archivo manual de la spec.', ''] + literal(c) + ['']
lines += ['## En las fuentes', '', '### H7-VB-13-5 · FUENTE', '', unicos[2]['resumen'],
    'No corregir aisladamente la transcripción. Primero corregir B/22, volver a congelar las fuentes y sincronizar la copia. No hace falta decisión de producto: el 📌 de CC ya resolvió el instante.', '']
for c in unicos[2]['correccion_fuente']:
    lines += [f"Fuente: {c['archivo']}:{c['linea']}", ''] + literal(c) + ['']
    pc = c['propagacion']
    lines += [f"Propagación después del re-congelado: {pc['archivo']}:{pc['linea']} (línea actual de pristina; manual, no generado).", ''] + literal(pc) + ['']
lines += ['## FALSO', '', 'Ninguno entre los tres hallazgos no canarios. G1-4 y G2-5 son detecciones parciales de una alteración plantada, no falsos defectos de la spec real.', '',
 '## Antecedentes y aplicación', '',
 '- H7-VB-08-2 corrige una ampliación introducida en la propuesta H2-VA8-11. Se conserva su objetivo de tener AC y prueba de los guards.',
 '- H7-VB-13-3 se apoya en la fuente actual ya corregida; H3-VB13-6 juzgó una fuente anterior que aún decía «fecha efectiva».',
 '- H7-VB-13-5 es otra ubicación del residuo temporal tratado en vuelta 4, H4-VB-08-4; no reabre BZ/CC.',
 '- Ninguna corrección REAL toca archivos generados. Los cambios plantados dentro de g1/g3/secciones/g8 no demuestran defectos de sus reglas.',
 '- TEST:B1:19 ya habla de abortar antes de la primera mutación; no requiere ampliar el guard a las lecturas.',
 '- Verificación realizada: los cuatro reemplazos REAL y la corrección de fuente/propagación existen una sola vez y comienzan en las líneas declaradas. No se aplicaron.']
(OUT/'correcciones.txt').write_text('\n'.join(lines)+'\n')

patterns = '''# Patrones — vuelta 7

Verificado

- 26 informes finales, {reports} ocurrencias: {canaries} corresponden a canarios (incluidas dos detecciones parciales del 42) y 3 a hallazgos no canarios, todos únicos. No hay duplicados no canarios por fusionar. Los originales quedan en hallazgos.json.
- Los 42 canarios tienen al menos una detección semántica. Cobertura propia 39/42: VB 28/28, G 4/4 y VA 7/10. Los tres faltantes propios fueron cubiertos por cruces.
- P-ALCANCE: «toda sonda que mute» pasó a «toda sonda o mutación». Una corrección anterior extendió la obligación al convertirla en criterio. Al trasladar reglas hay que conservar su cuantificador y separar el guard de entorno del de presupuesto.
- P-CONGELADO: un resumen conservó el texto que vuelta 3 había exigido copiar, aunque la fuente actual ya dice S37. Los veredictos anteriores dependen del congelado que juzgaron; no prevalecen sobre una precisión posterior.
- P-FUENTE: la tabla legal sigue diciendo mutación en la fecha efectiva. La spec la copia fielmente; la regla vigente ya fue precisada por CC. Corregir la fuente y re-congelar, sin abrir otra decisión OWNER.
- Las alteraciones de ordinal en G1-4/G2-5 detectan un efecto del canario 42, pero no su pérdida funcional. Contarlas como detección de enforcementStrategy exageraría la cobertura semántica de esos verificadores.
- No hay GENERADOR confirmado: las diferencias reportadas en las salidas generadas son plantadas y están ausentes en pristina. No atribuir al código del generador una mutación posterior de su salida.
- hallazgos-todos.txt contiene también corpus, patrones y búsquedas auxiliares. Sus coincidencias y rótulos CAN? no son hallazgos adjudicados. El universo de informes finales quedó particionado íntegramente y sin doble asignación.

Alcance y límites

Se verificaron documentos y propuestas de reemplazo, no la implementación de billing. Las fuentes se leyeron descartando tachados, incluidos los multilínea; para los plazos se contrastaron BZ y el 📌 de CC que precisa su aplicación. No se usaron git, tracker, red, subagentes ni generadores en ejecución. Sólo se escribieron archivos en adjudicacion/. El build de producto del adapter no corresponde a esta adjudicación documental y no se ejecutó.

Pendiente de aplicación: los dos REAL y el residuo FUENTE. No se editó pristina, la copia ciega, la fuente congelada ni la spec real. No hay OWNER, por lo que no se crea owner.txt.
'''.format(reports=len(reports), canaries=len(assigned)-3)
(OUT/'patrones.txt').write_text(patterns)
print(json.dumps(dict(resumen=summary, informes=len(reports), particion_completa=True,
    reemplazos_reales_validados=sum(len(u['correccion']) for u in unicos)), ensure_ascii=False, indent=2))

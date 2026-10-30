from pathlib import Path
import json,re,collections
ROOT=Path('/home/qazuor/.cache/hos1352/vuelta-5')
OUT=ROOT/'adjudicacion'
P='.specs/HOS-1352-billing-verticals-redesign/docs/'
B='.specs/HOS-1354-billing-cobro-y-proveedor/'
V='.specs/HOS-1353-verticales-capacidades-y-autorizacion/'
reports={}
for p in sorted((ROOT/'v/salidas').glob('*.txt')):
    if not re.fullmatch(r'(G[12]|VA-A\d+|VB-\d+)',p.stem): continue
    h=p.read_text().split('## Hallazgos',1)[1].split('## Resumen',1)[0]
    for i,t in enumerate(h.strip().split('\n\n'),1):
        if not t.startswith('Sin hallazgos:'): reports[f'{p.stem}-{i}']=t
# Correspondencia adjudicada por contenido, no por distancia a las líneas plantadas.
cm={
1:['VB-01-1'],2:['VB-01-2','VA-A1-1'],3:['VB-02-3'],4:['VB-02-1','VA-A1-3'],
5:['VB-03-2'],6:['VB-03-3','VA-A1-2'],7:['VB-04-3'],8:['VB-04-2'],
9:['VB-05-2'],10:['VB-05-1'],11:['VB-06-3'],12:['VB-06-1','VA-A4-2'],
13:['VB-07-3','VA-A5-1'],14:['VB-07-1'],15:['VB-08-2','VA-A6-1'],16:['VB-08-3'],
17:['VB-09-1'],18:['VB-09-2'],19:['VB-10-2'],20:['VB-10-1'],21:['VB-11-3'],22:['VB-11-2','VA-A10-2'],
23:['VB-12-1'],24:['VB-12-2'],25:['VB-13-2'],26:['VB-13-1'],27:['VB-14-3'],28:['VB-14-1'],
29:['G1-3'],30:['G1-2'],31:['G2-7'],32:['G2-1'],33:['VB-02-2','VA-A1-4'],34:['G1-4','VB-14-2'],
35:['G1-1','VA-A3-1'],36:['VA-A4-1'],37:['VB-07-2'],38:['VB-08-1','VA-A6-2'],39:['G2-3'],
40:['G2-2','G2-4','VA-A8-1'],41:['G2-8','G2-9','VA-A9-1','VA-A10-3'],42:['G2-5','G2-6','VA-A10-1','VB-11-1']}
can=[]
for n,row in enumerate((ROOT/'canarios.txt').read_text().splitlines(),1):
    c=row.split(' | '); ids=cm[n]; vs=list(dict.fromkeys(x.rsplit('-',1)[0] for x in ids))
    note=''
    if n==34: note='VA-A2 denunció el transporte de cobertura, no el monto del smoke. G1 y VB-14 sí denuncian la aprobación previa perdida.'
    if n==37: note='VA-A5 detectó el filtro corporativo de VB-07, no la aleatoriedad del secreto. VB-07-2 sí detecta este canario.'
    if n==39: note='VA-A7 declaró cero hallazgos. G2-3 detecta exactamente la prohibición de comprobante omitida en MP6.'
    can.append(dict(numero=n,bloque=c[0],donde=c[1],tipo=c[2],detectado_por=vs,detectado=True,por_su_bloque=c[0] in vs,nota=note,hallazgos=ids,regla=c[-1],fuente=c[-2],sale=c[3],entra=c[4]))

unicos=[]
def patch(file,sale,entra,generated=False,dest=None):
    t=(ROOT/'pristina'/file).read_text()
    assert t.count(sale)==1,(file,sale,t.count(sale))
    return dict(archivo=file,linea=t[:t.index(sale)].count('\n')+1,generado=generated,donde_va=dest,sale=sale,entra=entra)
def entry(ids,ver,clase,resumen,evidencia,correccion=(),relacionados=(),causa='',patron='',owner=None,gen=None):
    x=dict(id='H5-'+ids[0],grupo=None,miembros=['H5-'+i for i in ids],veredicto=ver,clase_final=clase,relacionados=list(relacionados),resumen=resumen,verificadores=list(dict.fromkeys(i.rsplit('-',1)[0] for i in ids)),respaldo='adjudicador',evidencia=evidencia,correccion=list(correccion),correccion_fuente=[],pregunta_owner=owner,causa=causa,patron=patron,informes_originales={i:reports[i] for i in ids})
    if gen: x['correccion_generador']=gen
    unicos.append(x)

entry(['VB-06-2'],'REAL','BLOQUEA',
'TEST:V5:10 permite rechazar en el paso 5 a quien tiene BASE pero no la capacidad; el rechazo corresponde al paso 6.',
[V+'docs/17-autorizacion.md:143–163: el paso 5 pregunta por fuentes y acepta BASE; ya no rechaza a nadie. El paso 6 decide la capacidad.',
'pristina/10-corte/V5.md:575–594 conserva la distinción; :1356–1357 permite 5/6 y por ello puede aprobar una implementación equivocada.'],
[patch('10-corte/V5.md','**TEST:V5:10** — Ruta API, una por ruta de escritura de vertical: un dueño con permiso y sin fuente que\notorgue la capacidad es rechazado en el paso 5/6.',
'**TEST:V5:10** — Ruta API, una por ruta de escritura de vertical: un dueño con permiso y con BASE,\npero sin fuente que otorgue la capacidad exigida, pasa el paso 5 y es rechazado en el paso 6\npor falta de esa capacidad; no responde «sin cobertura».')],
causa='El test mezcla existencia de fuentes con lo que otorgan; la cita al contrato no desambigua su resultado aceptado.',patron='P-TEST')
entry(['VB-08-4'],'REAL','BLOQUEA',
'TEST:B3:28 sólo exige encolar el correo antes de cancelar el VIP; puede aprobar la llamada mientras el correo sigue pendiente.',
[B+'docs/03-maquinas-de-estado.md:290–318 y :355–362: falla transitoria espera la misma fila; sent permite llamar; no-entregable o failed definitivo permiten llamar y escalar.',
P+'41-corte-del-mvp/10-decisiones-del-owner.md:141 (BP) y '+P+'01-decision-log.md:7998–8003: cancelación del VIP en S2 con correo antes.',
'pristina/10-corte/B3.md:1268–1271: el falso sólo exige el encolado; la regla viva distingue encolar de enviar.'],
[patch('10-corte/B3.md','**TEST:B3:28** — Integración: con una suscripción de Turista VIP paga y un plan que lo hereda en\n`PENDING_AUTHORIZATION`, el VIP sigue vivo; al correr `S2` sobre el plan, el VIP queda cancelado en el\nmismo acto, sin `refund`, con el correo encolado antes de la cancelación en el falso, y la cobertura del\nbeneficio sigue sin corte.',
'**TEST:B3:28** — Integración: con una suscripción de Turista VIP paga y un plan que lo hereda en\n`PENDING_AUTHORIZATION`, el VIP sigue vivo. Con entrega normal, al correr `S2` sobre el plan se\ncancela el VIP, sin `refund`: el falso recibe la cancelación sólo después de que el correo sale\ny su fila queda `sent`; la cobertura del beneficio sigue sin corte. Con el correo pendiente por\nfalla transitoria, el falso no recibe la cancelación; al salir ese mismo correo se permite la\nllamada, sin encolar otro. Con no-entregable o `failed` definitivo, la llamada sale igual y el\ncaso queda registrado y escalado, según `B/03` §1.1 y `DEC-MAIL-001`.')],
causa='Encolado durable no demuestra que el correo precedió la llamada externa.',patron='P-TEST')
entry(['VB-04-1'],'REAL','MENOR',
'El resumen de smoke de U1 omite la excepción BT: TEST:U1:24 mide producción antes del merge.',
[P+'16-fase-7-del-paraguas.md:1076–1082 y owner BT (:145): conteos read-only antes del merge.',
'pristina/10-corte/U1.md:780–786 ya lo exige; :790 generaliza que ningún smoke es gate de pieza.'],
[patch('10-corte/U1.md','- Los smoke de esta pieza corren en las ventanas del corte, no como gate de la pieza: el ensayo en',
'- Salvo `TEST:U1:24`, que mide producción en sólo lectura antes del merge y deja el número en el\n  PR (BT), los smoke de esta pieza corren en las ventanas del corte, no como gate de la pieza: el ensayo en')],
causa='Resumen no actualizado después de agregar el test BT; los AC y el test ya son correctos.',patron='P-RESUMEN')
for id,file,old,new,target in [
('VB-07-4','20-fase-4/V7.md','lista de piezas, l. 950','lista de piezas, l. 954','V7'),
('VB-07-5','10-corte/V8a.md','§4.6 (l. 951)','§4.6 (l. 955)','V8a'),
('VB-07-6','20-fase-4/V8b.md','§4.6 (l. 952,','§4.6 (l. 956,','V8b'),
('VB-07-7','10-corte/V9a.md','lista de piezas, l. 953','lista de piezas, l. 957','V9a')]:
    entry([id],'REAL','MENOR',f'La cita final de {target} apunta a la fila de otra pieza en la lista del corte.',
    [P+'16-fase-7-del-paraguas.md:950–957: V3=950, V4=951, V5=952, V6=953, V7=954, V8a=955, V8b=956 y V9a=957.',
    f'pristina/{file}: la referencia inicial es correcta; sólo se cambia la referencia final denunciada.'],
    [patch(file,old,new)],causa='Número de línea residual; no modifica el reparto normativo.',patron='P-REF')

for id,letter,line,oid,note,proof in [
('G1-5','AP',13745,'OWN:41-corte-del-mvp:t3:AP',
'las asignaciones de promos y cortesías a `B9a` y de addons a `B4`, incluida la columna de `payment`, fueron reemplazadas: BG lleva el esquema de promos y cortesías a `B3`; AV lleva el modelo de addons a `B3` y hace nacer `payment` en `B5` con la columna de instancia. Se conserva el resto de AP',
[P+'41-corte-del-mvp/10-decisiones-del-owner.md:59, :73 (AV) y :111 (BG).',P+'01-decision-log.md:7933–7938 (📌 AV) y :7957–7961 (📌 BG): reemplazos expresos de la aplicación de AP.']),
('G1-6','BN',13989,'OWN:41-corte-del-mvp:t9:BN',
'la aplicación que hacía crear `domain_event` a `V9a` fue reemplazada por BW: la crea `U2`. Se conserva la regla general de BN y sus otras asignaciones',
[P+'41-corte-del-mvp/10-decisiones-del-owner.md:139 y :156 (BW).',P+'01-decision-log.md:8011–8022 (📌 BW): corrige la premisa y asigna domain_event a U2; también precisa BL para la rama 4 de B7.']),
('G1-7','BU',14059,'OWN:41-corte-del-mvp:t9:BU',
'el momento de fijar el valor inicial fue reemplazado por BX: antes del merge de `B2`, no de `B11`. Se conservan la clave versionada y la acción 22 de BU',
[P+'41-corte-del-mvp/10-decisiones-del-owner.md:146 y :157 (BX).',P+'01-decision-log.md:7446–7451 (📌 BX): adelanta expresamente el gate a B2.'])]:
    file='01-decisiones-vigentes.md'; sale=(ROOT/'pristina'/file).read_text().splitlines()[line-1]
    mark=f'- ⚠️ **Caducada en parte**: {note}. Sólo citable; la parte reemplazada no se implementa.'
    entry([id],'GENERADOR','MENOR',f'G1 deja {letter} sin marca de caducidad parcial pese al reemplazo explícito de su aplicación.',
    proof+[f'pristina/{file}:{line}: salida histórica sin marca; las decisiones implementables sí conservan la precisión posterior.',
    'v/generadores/g1/gen01.py:376–398: own_render sólo marca los ids presentes en MUERTAS; :482–484 excluye «precisa» de CORRIGE. :530–551 busca correcciones por ese vocabulario o tachados. v/generadores/g1/omisiones.py:170–246 no declara este id.'],
    [patch(file,sale,sale+'\n'+mark,True,'v/generadores/g1/omisiones.py → omisiones.json; v/generadores/g1/gen01.py')],
    relacionados=['H3-G1-3 (vuelta 3, GENERADOR): corrigió otras cinco letras caducadas; AP/BN/BU son casos nuevos del mismo mecanismo, no se readjudican las cinco resueltas.', 'La corrección de contenido del DEC/📌 ya está aplicada. Se adjudica sólo la falta de marca del registro histórico, no se reabre ese contenido.'],
    causa='La regla «precisar nunca corrige» es demasiado amplia. Estas precisiones reemplazan una aplicación o un plazo; el barrido por palabras no las detecta y el registro declarativo no las cubre.',patron='P-GEN',
    gen={'id_a_declarar':oid,'alcance':'en parte','texto':note,
    'cambio':'Agregar el id a LETRAS_MUERTAS con evidencia literal de la precisión posterior, regenerar omisiones.json y 01. Revisar cada candidato «precisa» semánticamente; exigir que un reemplazo tenga marca o una justificación explícita en LETRAS_VIVAS_REVISADAS. No convertir toda precisión aditiva (p.ej. BY sobre BL) en caducidad.',
    'validacion':'La salida lleva la marca sólo sobre la parte sustituida; se mantienen el texto histórico y los DEC/📌 efectivos. El verificador falla al retirar esa entrada declarativa.'})

entry(['VA-A2-1','VB-03-1'],'OWNER',None,
'El contrato y DEC-ARCH-009 dicen aviso de cobertura no durable; B/descomposicion y B4 exigen encolarlo en el outbox de U2.',
[P+'12-contrato-de-cobertura.md:835–845: aviso no durable y reconciliador diario; :828–833: el primer pago también avisa, y el reconciliador no corre la máquina de trial.',
P+'01-decision-log.md:6149–6171 (DEC-ARCH-009): el owner eligió reconciliador; hacer durable el aviso es la alternativa descartada.',
B+'descomposicion.md:138: exige explícitamente encolar el aviso de cobertura, invocando FASE 5 lote 2 A.',
P+'38-fase-5/10-decisiones-del-owner.md:55 y '+P+'01-decision-log.md:2477–2485 (📌 de U2): asignan constructor y correlación del outbox; no cambian expresamente DEC-ARCH-009 ni deciden transporte de eventos.',
P+'38-fase-5/00-consolidado.md:228–237 y 12-aplicacion-nucleo-y-contrato.md:32–43: la pregunta y su aplicación refieren a correos, supresión y bitácora.',
'pristina/03-contrato-de-cobertura.md:849 y pristina/10-corte/B4.md:129, :349–350 y :391–392 conservan las dos reglas. v/generadores/g8/src/B4.md contiene la misma obligación: no es introducida por g8/gen.py.'],
relacionados=['H4-VB-09-2 (vuelta 4, REAL BLOQUEA): corrigió en g8/src/B4 el encolado después del commit. Está aplicado. No se vuelve a contar aquel orden; la nueva pregunta es si corresponde un transporte durable en absoluto.'],
causa='Dos capítulos vivos mandan transportes incompatibles. La atribución a A no basta para inferir una revocación de DEC-ARCH-009: ni su fila ni el 📌 la deciden. No se puede elegir una política por fecha de la descomposición.',patron='P-OWNER',owner='CK — ¿El aviso de cobertura conserva el transporte no durable de DEC-ARCH-009 o se vuelve durable, con contrato y límites propios? Ver owner.txt; no aplicar cambios normativos hasta la decisión.')

assigned=[i for x in unicos for i in x['informes_originales']]+[i for ids in cm.values() for i in ids]
assert len(assigned)==len(set(assigned)), 'doble clasificación'
assert set(assigned)==set(reports),(set(reports)-set(assigned),set(assigned)-set(reports))
assert len(can)==42
counts=collections.Counter(x['veredicto']+(' '+x['clase_final'] if x['veredicto']=='REAL' else '') for x in unicos)
for k in ['REAL BLOQUEA','REAL MENOR','FUENTE','FALSO','GENERADOR','OWNER']: counts.setdefault(k,0)
meta=dict(vuelta=5,fuente_congelada='8a1d8902c2f1c6cd50de18affee40a6d5b3dd56b',referencia_lineas='pristina/',ultima_letra_owner='CJ',siguiente_letra_propuesta='CK',resumen=dict(counts),informes_finales=26,hallazgos_finales=len(reports),excluidos='Archivos auxiliares G1/G2: barridos, muestras, cruces y comparaciones no son informes finales. VA-A7 declara cero hallazgos. CAN? no decide la clasificación.',validacion='Cada sale existe una sola vez y la línea se calculó contra pristina. Informes finales particionados exhaustivamente en canarios o no-canarios, sin doble conteo. Propuestas no aplicadas. Revisión documental: no se ejecutó build de producto ni generadores.')
data=dict(unicos=unicos,por_id={mid:x for x in unicos for mid in x['miembros']},duplicados={x['id']:x['miembros'] for x in unicos if len(x['miembros'])>1},canarios=can,metadatos=meta)
(OUT/'hallazgos.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')

lines=['# Canarios — vuelta 5','',
'Numeración: orden de canarios.txt. Detección semántica en los 26 informes finales; no se atribuyen detecciones por coincidencia de archivo o cercanía de línea. Las ubicaciones de esta tabla son las plantadas; las correcciones no-canarias usan pristina.','',
'| Nº | Bloque | Tipo | Ubicación plantada | Detectado por | Por su bloque |','|---|---|---|---|---|---|']
for c in can: lines.append(f"| {c['numero']} | {c['bloque']} | {c['tipo']} | {c['donde']} | {', '.join(c['detectado_por'])} | {'sí' if c['por_su_bloque'] else 'no'} |")
lines+=['','Balance: 42/42 detectados; VB 28/28, G 4/4, VA 10/10. Por su propio bloque: 39/42 (VB 28/28, G 4/4, VA 7/10).','','## Evidencia por canario','']
for c in can:
    lines += [f"{c['numero']}. {c['bloque']} / {c['tipo']}: {c['regla']}",f"   Hallazgos: {', '.join('['+i+']' for i in c['hallazgos'])}. Fuente: {c['fuente']}."]
    if c['nota']: lines.append('   '+c['nota'])
lines+=['','Los 42 se excluyen de los no-canarios. canarios.diff confirma que los cambios no están en pristina. Los compuestos se cuentan una vez aunque se denuncien varias de sus ubicaciones; G2-2 y G2-4 son dos denuncias de VA-A8, no dos canarios.','VA-A7 no detectó el suyo ni otro; VA-A2 no detectó canarios; VA-A5 detectó VB-07/AGREGA, no el suyo.']
(OUT/'canarios-resultado.txt').write_text('\n'.join(lines)+'\n')

lines=['# Correcciones propuestas — vuelta 5','','No aplicadas. Referencia: pristina (HEAD sin canarios). Los bloques sale/entra son literales y sus líneas fueron verificadas. Aplicar por contenido; las líneas cambian al introducir correcciones previas.','Los GENERADOR incluyen el efecto esperado en la salida sólo para revisión: se corrige g1, nunca 01-decisiones-vigentes.md a mano. B4 queda pendiente de CK; si se cambia, se hace en g8/src/B4.md y se regenera.','']
byfile=collections.defaultdict(list)
for x in unicos:
    for c in x['correccion']: byfile[c['archivo']].append((x,c))
for file,pairs in sorted(byfile.items()):
    lines += ['## '+file,'']
    for x,c in sorted(pairs,key=lambda z:z[1]['linea']):
        lines += [f"{x['id']} · {x['veredicto']} {x['clase_final']} · línea {c['linea']}",x['resumen'],f"Destino: {c['donde_va'] or c['archivo']}",'sale:','```text',c['sale'],'```','entra:','```text',c['entra'],'```']
        if x.get('correccion_generador'): lines += ['Regla que falla: '+x['causa'],'Cambio en generador: '+json.dumps(x['correccion_generador'],ensure_ascii=False)]
        lines += ['Evidencia: '+'; '.join(x['evidencia']),'']
lines += ['## En las fuentes','','No hay no-canarios adjudicados FUENTE en esta vuelta. No se proponen parches incondicionales a la fuente.','CK está pendiente: DEC-ARCH-009 y P/12 §3 frente a B/descomposicion:138. Resolver y aplicar la letra en las fuentes, crear un nuevo congelado y sincronizar la consolidada. owner.txt enumera alcance y opciones; no parchear B4 para imponer una elección sin decisión.','Las letras históricas AP, BN y BU tienen precisiones suficientes en la fuente: el defecto es que g1 no marca su caducidad parcial, no falta una nueva letra.','','## FALSO','','Ninguno entre los no-canarios de esta vuelta. Se consultaron los FALSO de las vueltas 1–4; ninguno corresponde a estos hallazgos. Los canarios no son FALSO: son defectos deliberados de la copia ciega, ausentes en HEAD.','','## Pendiente de owner','','H5-VA-A2-1 / H5-VB-03-1 → CK (owner.txt). La corrección H4-VB-09-2 está aplicada y no se repite: revisar su premisa tras la decisión CK.']
(OUT/'correcciones.txt').write_text('\n'.join(lines)+'\n')
print(json.dumps(meta,ensure_ascii=False,indent=2))

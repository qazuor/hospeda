from pathlib import Path
import re,json,collections
ROOT=Path('/home/qazuor/.cache/hos1352/vuelta-6'); OUT=ROOT/'adjudicacion'
P='.specs/HOS-1352-billing-verticals-redesign/docs/'
reports={}
for line in (ROOT/'hallazgos-todos.txt').read_text().splitlines():
 m=re.match(r'(?:CAN\? )?\[((?:G[12]|VA-A\d+|VB-\d+)-\d+)\] (.*)',line)
 if m and not m[2].startswith('Sin hallazgos'): reports[m[1]]=m[2]
# Asociaciones adjudicadas por contenido, no por distancia entre números de línea.
refs=[
'VB-01-3','VB-02-3','VB-03-1','VB-04-2','VB-05-3 VA-A4-1','VB-06-2','VB-07-3','VB-08-1','VB-09-1','VB-10-2','VB-11-3','VB-12-4','VB-13-1','VB-14-2',
'G1-1','G1-4','G2-5 VB-12-2 VA-A10-1','G2-1',
'VB-01-2','VB-02-1 VA-A1-3','VB-03-2','VB-04-1','VB-05-1','VB-06-1','VB-07-1','VB-08-2','VB-09-2','VB-10-1','VB-11-2 VA-A9-1','VB-12-1','VB-13-2','VB-14-3',
'VA-A1-2 VB-02-2','G1-5 G1-6 VB-14-1','VA-A3-1','G1-3 VA-A4-2 VB-05-2','VB-07-2','VA-A6-1','G2-3 VA-A7-2','G2-4','','G1-2 G2-2 G2-6 VA-A1-1 VA-A7-1 VA-A10-2 VB-02-4 VB-12-3']
can=[]
for n,(line,rs) in enumerate(zip((ROOT/'canarios.txt').read_text().splitlines(),refs),1):
 block,loc,tipo,sale,entra,src,meaning=line.split(' | ')
 members=rs.split(); detectors=sorted({x.rsplit('-',1)[0] for x in members})
 can.append(dict(numero=n,bloque=block,tipo=tipo,ubicacion=loc,detectores=detectors,propio=block in detectors,hallazgos=members,fuente=src,confirmacion=meaning))
assert len(can)==42
assigned=[x for c in can for x in c['hallazgos']]
non=['VB-01-1','VA-A2-1','VB-11-1','G1-7']
assert set(assigned+non)==set(reports),(set(reports)-set(assigned+non))
assert len(assigned)==len(set(assigned))
def correction(file,sale,entra,generated=False,where=None):
 text=(ROOT/'pristina'/file).read_text(); assert text.count(sale)==1,(file,sale)
 return dict(archivo=file,linea=text[:text.index(sale)].count('\n')+1,generado=generated,donde_va=where,sale=sale,entra=entra)
def finding(id,members,verdict,grade,summary,evidence,changes,cause,pattern,related=[]):
 return dict(id=id,grupo=None if len(members)==1 else id,miembros=['H6-'+m for m in members],veredicto=verdict,clase_final=grade,relacionados=related,resumen=summary,verificadores=sorted({x.rsplit('-',1)[0] for x in members}),respaldo='adjudicador',evidencia=evidence,correccion=changes,correccion_fuente=[],pregunta_owner=None,causa=cause,patron=pattern,informes_originales={m:reports[m] for m in members})
h=[]
h.append(finding('H6-INDICE-PRECIOS',['VB-01-1','VA-A2-1'],'REAL','BLOQUEA','El índice atribuye la carga de precios al paso 3a; la migración del paso 3 los carga y el 3a sólo verifica.',[
 P+'41-corte-del-mvp/10-decisiones-del-owner.md:138: BM ya dice que carga el paso 3 y verifica el 3a.',P+'01-decision-log.md:1502–1510: el 📌 declara expresamente residual atribuir la carga al 3a; no cambia precios ni la prohibición hasta M5.',
 'pristina/30-el-corte.md: la secuencia del paso 3/3a conserva ese reparto; 00-indice.md lo contradice en dos lugares.',
 'Vuelta 4, H4-VA-A6-1 corrigió el mismo reparto en B2 y la fuente. Estas dos ubicaciones del índice siguen presentes: son residuo adicional, no reapertura de la decisión.'
 ],[correction('00-indice.md','los carga el paso 3a y no se cambian','los carga la migración estructural del paso 3 y el paso 3a sólo los verifica; no se cambian'),correction('00-indice.md','los carga el [paso 3a](30-el-corte.md#paso-3a) y no se cambian','los carga la migración estructural del paso 3 y el [paso 3a](30-el-corte.md#paso-3a) sólo los verifica; no se cambian')],
 'Dos resúmenes manuales conservaron el reparto anterior a la precisión del log.','P-RESUMEN',['H4-VA-A6-1']))
h.append(finding('H6-VB-11-1',['VB-11-1'],'REAL','BLOQUEA','TEST:B9a:2 exige encolar el aviso de cobertura, aunque CK exige emitirlo después del commit sin entrega durable.',[
 P+'01-decision-log.md:6182–6191: CK ratifica emisión después del commit sin entrega durable; U2 es sólo de correos.',P+'41-corte-del-mvp/10-decisiones-del-owner.md:234: CK resuelve el transporte; no deja una excepción para grants.',P+'12-contrato-de-cobertura.md:850–877: todo cambio de fuente emite; otorgar, anclar y revocar grants están incluidos.',
 'pristina/10-corte/B9a.md:1216: texto manual fuera del tramo g-secciones, que termina en :724. El test exige un efecto diferente; la precisión de CK no se trasladó a este test.'
 ],[correction('10-corte/B9a.md','Anclar V corre `S13` sólo sobre V; otorgar, anclar y revocar encolan cada uno el aviso de cobertura;\nen una vertical sin ancla la fuente `GRANT` no aparece.',
 'Anclar V corre `S13` sólo sobre V; otorgar, anclar y revocar emiten cada uno el aviso de cobertura\ndespués del commit, sin entrega durable y sin usar el outbox de `U2`, que es sólo de correos (CK).\nLa prueba observa el aviso después del commit y comprueba que un rollback no lo emite;\nen una vertical sin ancla la fuente `GRANT` no aparece.')],
 'El test conservó encolado donde la arquitectura ratificada exige emisión no durable.','P-TEST'))
cc='**Letra CC**'
h.append(finding('H6-G1-7',['G1-7'],'GENERADOR','MENOR','g1 omite la marca de caducidad parcial de CC: CF traslada predicado y test al PR de B3, conservando el AC de B2.',[
 P+'41-corte-del-mvp/10-decisiones-del-owner.md:182 y :201: CC conserva el requisito, CF reemplaza explícitamente el PR que escribe predicado y prueba.',P+'01-decision-log.md:8068–8077: el 📌 de CF confirma el reemplazo; no es sólo una inferencia de las filas.',
 'v/generadores/g1/omisiones.py:287–288: CF:CC está clasificada «fuera de alcance», pendiente de adjudicación propia. No hay entrada de CC en LETRAS_MUERTAS (:173).',
 'v/generadores/g1/gen01.py, precisiones_sin_revision(): acepta «fuera de alcance» y sólo exige marca para clase «reemplazo». Esta combinación deja pasar la falta de advertencia.',
 'Vuelta 5, H5-G1-5/6/7: AP, BN y BU recibieron marcas; CF:CC quedó explícitamente diferida. No se re-adjudican esas tres letras.',
 'Impacto MENOR: CF y su 📌 sí están transcritos y el registro de letras es sólo citable. Es defecto de señalización de texto parcialmente superado, no cambio del requisito comercial.'
 ],[correction('01-decisiones-vigentes.md',cc,cc+'\n\n> ⚠️ **Caducada en parte**: CF reemplaza la ubicación del predicado y su test: los escribe el PR de `B3`. El AC sigue siendo de `B2`; se conserva que un `S38` encolado cuenta como cliente de la versión destino. Véase [CF](#own-41-corte-del-mvp-t14-cf).',True,
 'g1/omisiones.py: clasificar CF:CC como reemplazo y agregar OWN:41-corte-del-mvp:t12:CC a LETRAS_MUERTAS con alcance «en parte», evidencia fila CF y sin inferencia. Regenerar omisiones.json y 01-decisiones-vigentes.md con g1; la inserción expresa el resultado requerido, no se aplica a mano.')],
 'La excepción de alcance provisional elude la comprobación de marca que ya protege los otros reemplazos.','P-GENERADOR',['H5-G1-5','H5-G1-6','H5-G1-7']))
stats={'canarios_detectados':sum(bool(c['detectores']) for c in can),'canarios_propios':sum(c['propio'] for c in can),'REAL BLOQUEA':2,'REAL MENOR':0,'FUENTE':0,'FALSO':0,'GENERADOR':1,'OWNER':0}
data=dict(unicos=h,canarios=can,resumen=stats,alcance={'fuentes_sha':'3c3e88b9b59cb7d766bc34848b8ffd657eb95770','spec':'pristina','informes':26,'hallazgos_reportados':len(reports),'ocurrencias_canarias':len(assigned),'ocurrencias_no_canarias':4,'unicos_no_canarios':3,'exclusiones':'Búsquedas auxiliares G1-rg-*, G2-*, VA-A8-verificacion y declaraciones «Sin hallazgos» no son hallazgos adicionales.'})
(OUT/'hallazgos.json').write_text(json.dumps(data,ensure_ascii=False,indent=4)+'\n')
lines=['# Canarios — vuelta 6','','Numeración: orden de canarios.txt. Asociación semántica contrastada con canarios.diff, informes finales, pristina y fuentes congeladas. CAN? no se usa como veredicto.','','| Nº | Bloque | Tipo | Ubicación plantada | Detectado por | Por su bloque |','|---|---|---|---|---|---|']
for c in can: lines.append(f"| {c['numero']} | {c['bloque']} | {c['tipo']} | {c['ubicacion']} | {', '.join(c['detectores']) or 'NADIE'} | {'sí' if c['propio'] else 'no'} |")
lines+=['','Balance: 41/42 detectados; VB 28/28, G 4/4, VA 9/10. Por su propio bloque: 38/42 (VB 28/28, G 4/4, VA 6/10).','','## Evidencia por canario','']
for c in can:
 lines += [f"{c['numero']}. {c['bloque']} / {c['tipo']}: {c['confirmacion']}",f"   Hallazgos: {', '.join('['+m+']' for m in c['hallazgos']) or 'ninguno'}. Fuente: {c['fuente']}."]
lines+=['','Precisiones de adjudicación:','- VA-A2 fue detectado por G1 y VB-14; el hallazgo de VA-A2 sobre precios es real pero no detecta el canario de borrado del ensayo.','- VA-A5 fue detectado por VB-07; VA-A5 declara cero hallazgos.','- VA-A8 fue detectado por G2. Su bloque vio la abreviación, pero la descartó porque B8a conserva la regla: el auxiliar VA-A8-verificacion.txt explica esa decisión. No se cuenta una observación descartada como detección de defecto.','- VA-A9 no fue detectado: su informe detecta la cortesía del canario VB-11 AGREGA, no la omisión de «ni justificación».','- VB-02-2 sí detecta VA-A1 aunque la extracción no le haya puesto CAN?.','- Los hallazgos del genérico de status_detail son un único canario VA-A10, con siete verificadores y ocho ocurrencias.','- Los 42 cambios plantados se excluyen de las correcciones de pristina; incluso el no detectado ya tiene el texto correcto allí.']
(OUT/'canarios-resultado.txt').write_text('\n'.join(lines)+'\n')
lines=['# Correcciones propuestas — vuelta 6','','Todas las líneas son de pristina. No se modificó la spec real ni los generadores. Aplicar cada reemplazo sobre esa base; las líneas posteriores pueden desplazarse.']
for file in sorted({c['archivo'] for x in h for c in x['correccion']}):
 lines+=['',f'## {file}']
 for x in h:
  for c in x['correccion']:
   if c['archivo']!=file:continue
   lines+=['',f"{x['id']} · {x['veredicto']} {x['clase_final']} · línea {c['linea']}",f"Generado: {'sí' if c['generado'] else 'no (tramo manual)'}." ]
   if c['donde_va']:lines += ['Dónde va: '+c['donde_va']]
   lines+=['','SALE literal:','```',c['sale'],'```','ENTRA literal:','```',c['entra'],'```']
lines+=['','## En las fuentes','','Sin correcciones necesarias para los tres únicos adjudicados. BM, CF y CK y sus 📌 ya resuelven las reglas; no se requiere re-congelado ni nuevas letras. El texto histórico de CC se conserva con advertencia parcial en el generador.','','## FALSO','','Ningún hallazgo no canario resultó FALSO. Las declaraciones de cero hallazgos y las búsquedas auxiliares no se adjudican como falsos. Las omisiones plantadas tampoco son defectos de pristina.']
(OUT/'correcciones.txt').write_text('\n'.join(lines)+'\n')
(OUT/'patrones.txt').write_text('''# Patrones — vuelta 6

P-RESUMEN: una precisión aplicada a la pieza y al procedimiento puede dejar resúmenes manuales anteriores en el índice. H6-INDICE-PRECIOS tiene dos ubicaciones y dos detectores; es un único defecto. Antecedente: H4-VA-A6-1, sin reabrir lo ya resuelto.

P-TEST: comprobar el verbo del efecto, no sólo su emisor. Encolar y emitir después del commit sin entrega durable no son equivalentes. TEST:B9a:2 quedó anterior a CK; su tramo es manual aunque B9a contenga también secciones generadas.

P-GENERADOR: una exclusión provisional de alcance no prueba vigencia semántica. CF:CC estaba explícitamente pendiente, mientras la validación aceptaba «fuera de alcance». Registrar el reemplazo parcial y su evidencia; conservar la regla comercial y la titularidad del AC. No marcar toda CC como retirada. Antecedentes: H5-G1-5/6/7, ya corregidos para AP/BN/BU.

P-CANARIO: una cláusula plantada puede seguir existiendo en otro bloque. Eso limita el alcance de una acusación de ausencia global, pero no borra la discrepancia puntual que mide el canario. VA-A8 descartó el cambio de C2 por encontrar una regla equivalente en B8a; G2 sí lo reportó. Se distingue detección de defecto de mera observación descartada.

P-EXTRACCION: hallazgos-todos.txt incluye salidas de rg como si fueran informes y dos declaraciones de ausencia como ítems. Sólo 26 archivos finales determinan detectores y hallazgos. Conciliación exhaustiva en hallazgos.json: cada ocurrencia sustantiva pertenece a un canario o a uno de los tres únicos.

Verificado: informes finales, diff de canarios, correspondencia con pristina, fuentes citadas, precisiones de BM/CF/CK y código de g1. Los tachados no se usaron como autoridad vigente. Consultados los hallazgos y antecedentes de las vueltas 1 a 5.
Inferido: severidad BLOQUEA de las dos contradicciones manuales por alterar procedimiento y efecto exigido al test; severidad MENOR del defecto de señalización de g1 porque la regla vigente de CF sí está presente.
Pendiente: aplicar las propuestas y regenerar g1 en una tarea posterior autorizada. No se ejecutaron generadores ni pruebas de producto; ésta es una adjudicación documental y el adapter sólo declara build de producto, ajeno a este alcance. Sin git, tracker, red ni cambios fuera de adjudicacion/. No hay OWNER; no se crea owner.txt.
''')
print(json.dumps(stats,ensure_ascii=False)); print('Hallazgos sustantivos',len(reports),'canarios',len(assigned),'no canarios',len(non))
for x in h:
 for c in x['correccion']:print(x['id'],c['archivo'],c['linea'])

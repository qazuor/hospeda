from pathlib import Path
import sys,json,copy
C=Path('.specs/HOS-1352-billing-verticals-redesign/spec-consolidada').resolve();P=C/'_trabajo/verificacion/vuelta-7/pasada10'
sys.path.insert(0,str(C/'scripts'))
from comun import SHA,lines,line_hash,B,D,V
from reanclar import Mapa,git_show
old='5381f7579687651df168575c85f144f9b48daea7'
f=C/'scripts/generadores/secciones/fuentes.json';j=json.loads(f.read_text());report=[];maps={}
for dest,refs in j.items():
 for ref in refs:
  path,n=ref
  if path not in maps:maps[path]=Mapa(git_show(old,path),git_show(SHA,path))
  nn,state,cand=maps[path](n)
  if nn is None:
   assert cand==n,(path,n,cand)
   nn=n;state='REVISADA: mismo bloque editado, misma línea'
  ref[1]=nn;report.append(dict(destino=dest,fuente=path,anterior=n,nueva=nn,estado=state))
f.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n');(P/'reanclaje-secciones.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
f=C/'_trabajo/cobertura-lectura.json';j=json.loads(f.read_text())
for id,entry in j['entradas'].items():
 for group in [entry,*entry.get('tambien',[])]:
  for cita in group['citas']:
   if cita['archivo']==V+'descomposicion.md' and cita['linea']==73:
    txt=cita['cita']
    if txt=='el empuje a billing después del commit) y los tres avisos':cita['cita']='el empuje a billing después del commit)'
    if txt=='y los tres avisos, que encola en `U2`':cita['cita']='los dos avisos previos, que encola en `U2`'
def cite(path,fragment):
 found=[i for i,l in enumerate(lines(path),1) if fragment in l];assert len(found)==1,(fragment,found);n=found[0]
 return dict(archivo=path,linea=n,cita=fragment,hash=line_hash(path,n))
log=D+'01-decision-log.md'
a=copy.deepcopy(j['entradas']['DEC-RF-008']);a['citas'][0]=cite(log,'La devolución por fuera que se asienta con `RF4` admite');a['lote']='pasada10';a['razon']='RF4 y acción 14: B5 provee el asiento, B13a la superficie; precisión del catálogo vigente.';j['entradas']['DEC-RF-008#📌8']=a
j['entradas']['DEC-ARCH-014#📌8']={'pieza':'V7','citas':[cite(log,'**son trece desde BC**'),cite(B+'descomposicion.md','| 15 ✚ |')], 'razon':'La precisión numérica identifica la dependencia 15 de V7 sobre B5 para la acción 6 (BC), ya ejercida por AC:V7:17; no agrega una dependencia.', 'tambien':[], 'tipos':[], 'lote':'pasada10'}
f.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n')
# New pins trace the existing acceptance contracts, with genuine tests of their rule.
f=C/'scripts/generadores/g8/src/B5.md';t=f.read_text();t=t.replace('Fuente: {{TRANS:B:RF4}} · {{ACC:14}} · {{DEC-RF-008}} · {{LISTA:B5}}','Fuente: {{TRANS:B:RF4}} · {{ACC:14}} · {{DEC-RF-008}} · {{DEC-RF-008#📌8}} · {{LISTA:B5}}').replace('Fuente: {{TRANS:B:RF1}} · {{TRANS:B:RF4}} · {{DEC-RF-008}} · {{INV:D11}}','Fuente: {{TRANS:B:RF1}} · {{TRANS:B:RF4}} · {{DEC-RF-008}} · {{DEC-RF-008#📌8}} · {{INV:D11}}');f.write_text(t)
f=C/'20-fase-4/V7.md';t=f.read_text();a='Fuente: [ACC:6](../02-nucleo.md#acc-6), [LISTA:V7](#lista-v7), [DEP:15](../03-contrato-de-cobertura.md#dep-15)';b='Fuente: [ACC:6](../02-nucleo.md#acc-6), [DEP:15](../03-contrato-de-cobertura.md#dep-15)'
for text in [a,b]:
 assert t.count(text)==1;t=t.replace(text,text+', [DEC-ARCH-014#📌8](../01-decisiones-vigentes.md#dec-arch-014-p8)')
f.write_text(t)
print('Revisados anclajes secciones; citas V9b actualizadas; dos pins cubiertos')

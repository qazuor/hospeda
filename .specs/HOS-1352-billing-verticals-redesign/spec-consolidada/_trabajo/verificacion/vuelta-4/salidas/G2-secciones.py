from pathlib import Path
import re,json,difflib
V=Path.cwd();S=V/'s/5586fad7';F=V/'fuentes'
refs=json.loads((V/'generadores/secciones/fuentes.json').read_text())
shorts={}
for p in F.rglob('*.md'):
 q=str(p.relative_to(F));sh=q.replace('.specs/HOS-1354-billing-cobro-y-proveedor/docs/','B/').replace('.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/','V/').replace('.specs/HOS-1352-billing-verticals-redesign/docs/','D/').replace('.specs/HOS-1354-billing-cobro-y-proveedor/','B/')
 shorts[sh]=q

def txt(p,a,b): return '\n'.join((F/p).read_text().splitlines()[a-1:b])
def body(p,n):
 ls=(F/p).read_text().splitlines();hs=[i for i,l in enumerate(ls,1) if re.match(r'^#{1,6} ',l)]
 a=max((i for i in hs if i<=n),default=1);b=min((i for i in hs if i>a),default=len(ls)+1)-1
 return a,b,txt(p,a+1,b)
def tokens(t):
 t=re.sub(r'~~.*?~~','',t,flags=re.S)
 t=re.sub(r'\[([^\]]*)\]\(([^)\s]*)\)',lambda m:m[1]+' '+m[2],t)
 t=re.sub(r'^#{1,6} .*','',t,flags=re.M)
 t=re.sub(r'^---\s*$','',t,flags=re.M)
 t=t.replace('*(fila retirada:','').replace('[…]','')
 return re.findall(r'\w+|[^\w\s*`()#>|-]',t)
checks=[]
for rel in refs:
 ls=(S/rel).read_text().splitlines();start=next(i for i,l in enumerate(ls) if '<!-- g-secciones: inicio' in l)+1;end=next(i for i,l in enumerate(ls) if '<!-- g-secciones: fin' in l);prev=start
 for i in range(start,end):
  if not ls[i].startswith('Origen: '):continue
  cites=re.findall(r'(\.specs/[^,:]+):(\d+)',ls[i]);source='\n'.join(body(p,int(n))[2] for p,n in cites)
  checks.append((rel,prev+1,i,';'.join(p+':'+n for p,n in cites),source,'\n'.join(ls[prev:i])))
  prev=i+1
ls=(S/'04-catalogos.md').read_text().splitlines()
covered={}
rows=json.loads((V/'salidas/G2-tablas.json').read_text())['covered']
for i,l in enumerate(ls):
 m=re.search(r'`([BVD]/[^:`]+):(\d+)–(\d+)`',l)
 if not m or not (l.startswith('**Texto de la fuente') or l.startswith('Texto de ')):continue
 sh,a,b=m.groups();a=int(a);b=int(b);p=shorts[sh]
 j=i+1
 while j<len(ls) and not (ls[j].startswith(('**Texto de la fuente','Origen:','<a id=','## ')) or ls[j].startswith('### ')):j+=1
 source=txt(p,a+1,b)
 # Catalog row tables are transformed into their own items; omit those complete tables here.
 sl=source.splitlines();out=[];k=0
 while k<len(sl):
  if sl[k].startswith('|'):
   z=k+1
   while z<len(sl) and sl[z].startswith('|'):z+=1
   if not any(a+1+q in rows.get(p,[]) for q in range(k,z)):out.extend(sl[k:z])
   k=z
  else:out.append(sl[k]);k+=1
 source='\n'.join(out)
 checks.append(('04-catalogos.md',i+1,j,p+':'+str(a)+'–'+str(b),source,'\n'.join(ls[i+1:j])))
 covered.setdefault(p,[]).append([a,b])
# LOCK bodies have a source-section citation rather than an explicit range label.
for i,l in enumerate(ls):
 if not l.startswith('### `LOCK:'):continue
 j=i+1
 while j<len(ls) and not ls[j].startswith('Origen:'):j+=1
 p,n=re.findall(r'(\.specs/[^,:]+):(\d+)',ls[j])[0];a,b,source=body(p,int(n))
 z=i+1
 while z<j and (not ls[z].strip() or ls[z].startswith('- **')):z+=1
 stop=next((k for k in range(z,j) if ls[k].startswith('**Texto de la fuente')),j)
 checks.append(('04-catalogos.md',z+1,stop,p+':'+str(a)+'–'+str(b),source,'\n'.join(ls[z:stop])))
res=[]
for rel,a,b,cit,source,actual in checks:
 aa,bb=tokens(actual),tokens(source)
 dif=[]
 for op,i,j,p,q in difflib.SequenceMatcher(None,aa,bb,autojunk=False).get_opcodes():
  if op!='equal':dif.append({'op':op,'salida':' '.join(aa[i:j]),'fuente':' '.join(bb[p:q]),'contexto':' '.join(aa[max(0,i-12):i])})
 if dif:res.append({'rel':rel,'a':a,'b':b,'cit':cit,'diff':dif})
(V/'salidas/G2-secciones.json').write_text(json.dumps({'checks':len(checks),'diff':res,'ranges':covered},ensure_ascii=False,indent=2))
print('CHECKS',len(checks),'DIFF',len(res))
for r in res:
 print(r['rel'],r['a'],r['b'],r['cit'])
 for d in r['diff']:print(d)

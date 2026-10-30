import json,re,collections
from pathlib import Path
V=Path.cwd();F=V/'fuentes';S=V/'s/b249f841';r=json.loads((V/'salidas/G2-audit.json').read_text())
rows=collections.defaultdict(set)
for x in r['items']:
 if len(x)==4:rows[x[2]].add(x[3])
out=[];tables=0
for p,ns in rows.items():
 L=(F/p).read_text().splitlines();seen=set()
 for n in sorted(ns):
  if not L[n-1].startswith('|'):continue
  a=n-1;b=n
  while a and L[a-1].startswith('|'):a-=1
  while b<len(L) and L[b].startswith('|'):b+=1
  if a in seen:continue
  seen.add(a);tables+=1
  for j in range(a+2,b):
   first=L[j].split('|')[1].strip()
   if j+1 not in ns and re.sub(r'[\s*`✚]','',re.sub(r'~~.*?~~','',first)) and not first.startswith('~~'):
    out.append([p,j+1,L[j]])
print('TABLES',tables,'uncatalogued live rows',len(out))
for x in out:print(x)
# Record all output/source equality lines for stratified sample, retain whole statement.
short={('B/' if '1354' in str(p) else 'V/' if '1353' in str(p) else 'D/')+p.name:p for p in F.rglob('*.md') if '/docs/' in str(p)}
def norm(s):return re.sub(r'\s+',' ',s).strip()
def clean(s):
 s=re.sub(r'~~.*?~~','',s,flags=re.S)
 s=re.sub(r'\[([^\]]*)\]\(([^)\s]*)\)',lambda m:m[1]+(' (`'+m[2]+'`)' if m[2] else ''),s)
 return norm(s)
samples=[]
# 40 catalog items spread over every family and the complete file.
items=[x for x in r['items'] if len(x)==4]
selected=sorted(set(round(i*(len(items)-1)/39) for i in range(40)))
L=(S/'04-catalogos.md').read_text().splitlines()
for ix in selected:
 x=items[ix];a=x[0]-1;b=items[ix+1][0]-1 if ix+1<len(items) else len(L)
 body=[(j+1,l) for j,l in enumerate(L[a:b],a) if re.match(r'^- \*\*(desde|evento|hacia|condición|efectos|nota|qué|Comportamiento|Conclusión|Estado|regla|por qué|situación|motivo)',l)]
 samples.append({'archivo':'04-catalogos.md','item':x[1],'linea':x[0],'fuente':x[2]+':'+str(x[3]),'campos_cotejados':len(body)})
# 40 lines per piece, evenly distributed across substantive lines, mapped to source.
for rel,st in r['stats'].items():
 if rel=='04-catalogos.md':continue
 L=(S/rel).read_text().splitlines();valid=[];p=None;mapping={}
 for i in range(st['start']-1,st['end']):
  l=L[i];m=re.match(r'^#+ (B/[^ ]+) · ',l)
  if m:
   p=short[m[1]];mapping={clean(s):j+1 for j,s in enumerate(p.read_text().splitlines()) if s.strip()}
  if p and 45<len(l)<750 and not l.startswith(('Origen:','#','<!--')) and clean(l) in mapping:
   valid.append((i+1,l,str(p.relative_to(F)),mapping[clean(l)]))
 for ix in sorted(set(round(i*(len(valid)-1)/39) for i in range(40))):
  n,l,p,j=valid[ix];samples.append({'archivo':rel,'linea':n,'fuente':p+':'+str(j),'texto':l})
(V/'salidas/G2-muestra.json').write_text(json.dumps(samples,ensure_ascii=False,indent=2))
print('MUESTRA',collections.Counter(x['archivo'] for x in samples))
print('SAMPLE TEXTS')
for x in samples:
 if x['archivo']=='04-catalogos.md':print(x)
print('MARKER COUNTS')
for pat in ['~~',r'\\\|','📌','retirad',r'\[…\]']:
 hits=[]
 for rel,st in r['stats'].items():
  for n,l in enumerate((S/rel).read_text().splitlines(),1):
   if st['start']<=n<=st['end'] and re.search(pat,l):hits.append((rel,n,l))
 print(pat,len(hits))
 if pat=='~~':print(hits)

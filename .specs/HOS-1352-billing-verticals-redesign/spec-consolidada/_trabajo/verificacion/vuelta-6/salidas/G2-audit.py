from pathlib import Path
import re,json,collections,difflib
V=Path.cwd(); S=V/'s/b249f841'; F=V/'fuentes'
files=['04-catalogos.md',*json.loads((V/'generadores/secciones/fuentes.json').read_text())]
source={str(p.relative_to(F)):p.read_text().splitlines() for p in F.rglob('*.md')}
def clean(t):
 t=re.sub(r'~~.*?~~','',t,flags=re.S)
 t=re.sub(r'\[([^\]]*)\]\(([^)\s]*)\)',lambda m:m[1]+(' (`'+m[2]+'`)' if m[2] else ''),t)
 return re.sub(r'\s+',' ',t).strip()
def norm(t): return re.sub(r'\s+',' ',t).strip()
def cells(t):
 return [x.strip() for x in re.split(r'(?<!\\)\|(?=(?:[^`]*`[^`]*`)*[^`]*$)',t.strip().strip('|'))]
short={('B/' if '1354' in p else 'V/' if '1353' in p else 'D/')+p.split('/docs/')[-1]:p for p in source if '/docs/' in p}
short.update({'B/descomposicion.md':next(p for p in source if '1354' in p and p.endswith('/descomposicion.md'))})
report={'stats':{},'cells':[],'prose':[],'sections':[],'unmatched':[],'items':[]}
for rel in files:
 L=(S/rel).read_text().splitlines(); start=0;end=len(L)
 if rel!='04-catalogos.md':
  start=next(i for i,l in enumerate(L) if '<!-- g-secciones: inicio' in l)+1
  end=next(i for i,l in enumerate(L) if '<!-- g-secciones: fin' in l)
 report['stats'][rel]={'total':len(L),'start':start+1,'end':end,'nonblank':sum(bool(l.strip()) for l in L[start:end])}
 if rel=='04-catalogos.md':
  anchors=[i for i,l in enumerate(L) if l.startswith('<a id=')]
  for a,z in zip(anchors,anchors[1:]+[len(L)]):
   title=next(l for l in L[a:z] if l.startswith('### ')); origin=next((l for l in L[a:z] if l.startswith('Origen: ')),None)
   if not origin: continue
   refs=re.findall(r'(\.specs/[^ ,]+):(\d+)',origin);p,n=refs[0];n=int(n)
   row=source[p][n-1]
   report['items'].append([a+1,title,p,n])
   if not row.startswith('|'): continue
   h=n-2
   while h>=0 and not (source[p][h].startswith('|') and h+1<len(source[p]) and re.match(r'^\|\s*:?-',source[p][h+1])):h-=1
   if h<0: report['cells'].append([title,'NO HEADER']);continue
   hs=cells(source[p][h]);cs=cells(row)
   for k,(header,c) in enumerate(zip(hs,cs)):
    if k==0 and header=='#':continue
    pat=re.compile(r'^- \*\*'+re.escape(clean(header))+r'\*\*(?: \([^)]*\))?: (.*)')
    found=[(i+1,pat.match(L[i])[1]) for i in range(a,z) if pat.match(L[i])]
    expected=clean(c) or '—'
    if not found or clean(found[0][1])!=expected:
     report['cells'].append([title,p,n,header,expected,found])
  # all explicit copied ranges, distinguish tables extracted into individual items
  for i,l in enumerate(L):
   m=re.search(r'`([BVD]/[^`]+):(\d+)–(\d+)`, sin lo tachado',l)
   if not m:continue
   p=short[m[1]];a,b=int(m[2]),int(m[3]); stop=i+1
   while stop<len(L) and not (L[stop].startswith(('Origen:','<a id=','**Texto de la fuente','## ')) or re.match(r'^### .* — ',L[stop])):stop+=1
   actual='\n'.join(L[i+1:stop]);expected='\n'.join(source[p][a:b])
   # tables with extracted rows omitted by contract
   exp_lines=expected.splitlines(); j=0;kept=[]
   while j<len(exp_lines):
    if exp_lines[j].startswith('|'):
     k=j
     while k<len(exp_lines) and exp_lines[k].startswith('|'):k+=1
     if any(x[2]==p and a+j+1<=x[3]<=a+k for x in report['items']):j=k;continue
    if exp_lines[j].strip()!='---':kept.append(exp_lines[j])
    j+=1
   expected=clean('\n'.join(kept))
   if expected!=clean(actual):report['prose'].append([i+1,p,a,b,expected,clean(actual)])
 else:
  heads=[i for i in range(start,end) if re.match(r'^#+ B/',L[i])]
  for i,z in zip(heads,heads[1:]+[end]):
   m=re.match(r'^#+ (B/[^ ]+) · (.*)',L[i]);p=short[m[1]];title=m[2]
   candidates=[j for j,l in enumerate(source[p]) if re.match(r'^#+ ',l) and clean(re.sub(r'^#+ ','',l))==title]
   if title=='sección de título retirado, lo que sigue vivo de su cuerpo':candidates=[j for j,l in enumerate(source[p]) if re.match(r'^#+ ',l) and not clean(re.sub(r'^#+ ','',l))]
   if len(candidates)!=1:report['sections'].append([rel,i+1,title,'AMBIGUOUS',candidates]);continue
   a=candidates[0];b=next((j for j in range(a+1,len(source[p])) if re.match(r'^#+ ',source[p][j])),len(source[p]))
   actual='\n'.join(l for l in L[i+1:z] if not l.startswith('Origen:'));expected='\n'.join(l for l in source[p][a+1:b] if l.strip()!='---')
   if clean(actual)!=clean(expected):report['sections'].append([rel,i+1,p,a+1,b,clean(expected),clean(actual)])
   report['items'].append([rel,i+1,title,p,a+1,b])
(V/'salidas/G2-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('STATS',report['stats']);print('ITEMS',len(report['items']))
for k in ['cells','prose','sections']:
 print(k,len(report[k]));
 for x in report[k]: print(str(x)[:550])

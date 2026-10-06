from pathlib import Path
import re,json,collections
V=Path.cwd(); S=V/'s/2e9ef99e'; F=V/'fuentes'
files=['04-catalogos.md']+list(json.loads((V/'generadores/secciones/fuentes.json').read_text()))
def clean(t):
 t=re.sub(r'~~.*?~~', '',t,flags=re.S)
 return re.sub(r'\[([^\]]*)\]\(([^)\s]*)\)',lambda m:m[1]+' (`'+m[2]+'`)' if m[2] else m[1],t)
def norm(t):return re.sub(r'\s+','',re.sub(r'[*`]', '',t))
src={str(p.relative_to(F)):p.read_text().splitlines() for p in F.rglob('*.md')}
live_lines={p:re.sub(r'~~.*?~~',lambda m:'\n'*m[0].count('\n'),'\n'.join(ls),flags=re.S).splitlines() for p,ls in src.items()}
live={p:clean('\n'.join(ls)) for p,ls in src.items()}
short={('B/' if '1354' in p else 'V/' if '1353' in p else 'D/')+p.split('/docs/')[-1]:p for p in src if '/docs/' in p}
short.update({('B/' if '1354' in p else 'V/')+'descomposicion.md':p for p in src if p.endswith('/descomposicion.md') and ('1354' in p or '1353' in p)})
def cells(t):return [c.strip() for c in re.split(r'(?<!\\)\|(?=(?:[^`]*`[^`]*`)*[^`]*$)',t.strip().strip('|'))]
def section(p,n):
 ls=src[p]; a=max(i for i in range(n) if re.match(r'^#+ ',ls[i])); b=next((i for i in range(a+1,len(ls)) if re.match(r'^#+ ',ls[i])),len(ls));return a,b
results={};details=[];samples=[]
for f in files:
 ls=(S/f).read_text().splitlines();lo=0;hi=len(ls)
 if f!='04-catalogos.md':
  lo=next(i for i,l in enumerate(ls) if '<!-- g-secciones: inicio' in l);hi=next(i for i,l in enumerate(ls) if '<!-- g-secciones: fin' in l)+1
 results[f]={'lines':len(ls),'scope':[lo+1,hi],'content_lines':0,'fields':0,'sections':0}
 # all lines scanned; copy-bearing lines checked against cleaned source section/range/row
 if f!='04-catalogos.md':
  prev=lo+1
  for i in range(lo,hi):
   if not ls[i].startswith('Origen:'):continue
   refs=re.findall(r'(\.specs/[^,:]+):(\d+)',ls[i]);chunks=[];covered=[]
   for p,n in refs:
    a,b=section(p,int(n));chunks.append(clean('\n'.join(src[p][a+1:b])));covered.append((p,a,b))
   out='\n'.join(l for l in ls[prev:i] if not re.match(r'^#+ ',l))
   source=norm('\n'.join(chunks));output=norm(out)
   for j in range(prev,i):
    l=ls[j].strip()
    if not l or re.match(r'^#+ |^\[…\]$|^\|[\s:|-]+$',l):continue
    results[f]['content_lines']+=1
    q=norm(l)
    if q not in source and not l.startswith('*(fila retirada:'):
     details.append((f,j+1,'OUTPUT_NOT_IN_SECTION',l,refs))
   for p,a,b in covered:
    for k in range(a+1,b):
     l=src[p][k].strip();q=norm(clean(live_lines[p][k]))
     if not q or re.match(r'^---$|^\|[\s:|-]+$',q):continue
     if q not in output:
      if l.startswith('|') and '~~' in l:
       cs=[norm(clean(c)) for c in cells(l)];cs=[c for c in cs if c and c not in ('—','-')]
       if all(c in output or re.fullmatch(r'\([^)]*\)|✚',c) for c in cs):continue
      details.append((f,prev+1,'SOURCE_NOT_IN_OUTPUT',p+':'+str(k+1),l))
   results[f]['sections']+=len(refs);samples.append((f,prev+1,i+1,refs))
   prev=i+1
 else:
  anchors=[i for i,l in enumerate(ls) if l.startswith('<a id=')]+[len(ls)]
  for ai,bi in zip(anchors,anchors[1:]):
   orig=next((ls[i] for i in range(ai,bi) if ls[i].startswith('Origen:')),None)
   if not orig:continue
   refs=re.findall(r'(\.specs/[^,:]+):(\d+)',orig);p,n=refs[0];n=int(n)
   if not src[p][n-1].startswith('|'):continue
   cs=cells(src[p][n-1]); h=next((src[p][k] for k in range(n-2,-1,-1) if src[p][k].startswith('|') and k+1<len(src[p]) and re.match(r'^\|\s*:?-',src[p][k+1])),None)
   if not h:continue
   hs=cells(h);fields=[]
   if len(cs)!=len(hs):
    naive=[c.strip() for c in src[p][n-1].strip().strip('|').split('|')]
    if len(naive)==len(hs):cs=naive
    else:
     details.append((f,ai+1,'SOURCE_TABLE_SHAPE',p,n,len(hs),len(cs)));continue
   for i in range(ai+1,bi):
    if ls[i].startswith('**Texto de la fuente'):break
    m=re.match(r'^- \*\*(.*?)\*\*(?: \([^)]*\))?: (.*)',ls[i])
    if m and m[1] in hs:
     results[f]['fields']+=1; fields.append(m[1]);expected=norm(clean(cs[hs.index(m[1])]))
     actual=norm(m[2]);
     if actual!=expected and not (not expected and actual=='—'):
      details.append((f,i+1,'CELL_DIFFERENCE',m[1],actual,expected,p,n))
   for j,hdr in enumerate(hs):
    if j==0 and hdr=='#':continue
    if hdr not in fields:details.append((f,ai+1,'MISSING_FIELD',hdr,p,n))
   samples.append((f,ai+1,bi,refs[:1]))
  # generic all copied lines, source lookup over corpus (later local range checks)
  allsource=norm('\n'.join(live.values()))
  for i,l in enumerate(ls):
   if not l.strip() or re.match(r'^#|^<a |^Origen:|^Texto de |^\*\*Texto de la fuente|^- \*\*|^  - \*\*|^\|[\s:|-]+$',l):continue
   results[f]['content_lines']+=1
   if len(norm(l))>8 and norm(l) not in allsource:details.append((f,i+1,'PROSE_NOT_IN_CORPUS',l))
(V/'salidas/G2-comparacion.json').write_text(json.dumps({'results':results,'details':details,'samples':samples},ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2));print('DISCREPANCIAS',len(details));print('\n'.join(str(x)[:1100] for x in details))

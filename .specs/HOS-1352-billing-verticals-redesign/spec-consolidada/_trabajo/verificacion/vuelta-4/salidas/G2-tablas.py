from pathlib import Path
import re,json
V=Path.cwd();S=V/'s/5586fad7'; F=V/'fuentes'
def norm(t):
 t=re.sub(r'~~.*?~~','',t,flags=re.S)
 t=re.sub(r'\[([^\]]*)\]\(([^)\s]*)\)',lambda m:m[1]+' '+m[2],t)
 return re.sub(r'\s+',' ',re.sub(r'[*`()]+','',t)).strip()
def cells(l):
 return re.split(r'(?<!\\)\|(?=(?:[^`]*`[^`]*`)*[^`]*$)',l.strip().strip('|'))
ls=(S/'04-catalogos.md').read_text().splitlines(); starts=[i for i,l in enumerate(ls) if l.startswith('<a id=')];out=[]; covered={}; count=0
for a,b in zip(starts,starts[1:]+[len(ls)]):
 block=ls[a:b]; title=next((l for l in block if l.startswith('### ')),''); origin=next((l for l in block if l.startswith('Origen: ')),'')
 if not origin: continue
 p,n=re.findall(r'(\.specs/[^,:]+):(\d+)',origin)[0];n=int(n); src=(F/p).read_text().splitlines(); row=src[n-1];covered.setdefault(p,[]).append(n)
 if not row.startswith('|'):continue
 count+=1
 h=n-2
 while h>=0 and not (src[h].startswith('|') and h+1<len(src) and re.match(r'^\|\s*:?-',src[h+1])):h-=1
 if h<0:out.append((a+1,'no header'));continue
 headers=cells(src[h]); vals=cells(row)
 if len(headers)!=len(vals):out.append((a+1,'cell count',len(headers),len(vals)));continue
 fields={}
 for j,l in enumerate(block):
  if l.startswith('**Texto de la fuente'):break
  m=re.match(r'^- \*\*(.*?)\*\*(?: \([^)]*\))?: (.*)',l)
  if m:fields[norm(m[1])]=(a+j+1,m[2])
 dif=[]
 for k,v in zip(headers,vals):
  k=norm(k)
  if k=='#':continue
  if k not in fields:dif.append(('missing',k,v));continue
  ln,actual=fields[k]
  if norm(v)!=norm(actual) and not(norm(v)=='' and actual=='—'):dif.append((ln,k,actual,v))
 if dif:out.append((title,p,n,dif))
print('ROWS',count,'DIFFERENCES',len(out))
for x in out:print(x)
(V/'salidas/G2-tablas.json').write_text(json.dumps({'count':count,'diff':out,'covered':covered},ensure_ascii=False,indent=2))

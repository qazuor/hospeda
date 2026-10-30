from pathlib import Path
import json,re
v=Path(__file__).resolve().parent.parent; spec=v/'s/c1c03210';src=v/'fuentes';data=json.loads((v/'salidas/G2-catalogo-audit.json').read_text());L=(spec/'04-catalogos.md').read_text().splitlines()
def clean(s):
 s=re.sub(r'~~.*?~~','',s,flags=re.S)
 return re.sub(r'\[([^\]]*)\]\(([^)\s]*)\)',lambda m:m[1]+' (`'+m[2]+'`)' if m[2] else m[1],s)
def norm(s):return re.sub(r'[\s*`#]','',s)
locs={(r['source'],r['source_line']) for r in data['items']};tables=set();missing=[];locks=[];secondary=[]
for r in data['items']:
 f=r['source'];n=r['source_line'];sl=(src/f).read_text().splitlines();a=r['line']-1;b=next((i for i in range(a+1,len(L)) if L[i].startswith('<a id=')),len(L));actual='\n'.join(L[a:b])
 if r['id'].startswith('LOCK:'):
  end=next((i for i in range(n,len(sl)) if re.match(r'^#+ ',sl[i])),len(sl));exp=clean('\n'.join(sl[n:end]));exp=re.sub(r'^---\s*$','',exp,flags=re.M)
  locks.append([r['id'],n+1,end,[x for x in exp.splitlines() if norm(x) and norm(x) not in norm(actual)]])
 if sl[n-1].startswith('|'):
  a=n-1
  while a>0 and sl[a-1].startswith('|'):a-=1
  b=n
  while b<len(sl) and sl[b].startswith('|'):b+=1
  tables.add((f,a,b))
 # Every secondary guard occurrence: live cell contents must occur within this same item.
 for short,k in re.findall(r'\*\*También en `([VB]/[^`]+)` §2\*\* \(línea (\d+)\)',actual):
  ff='.specs/'+('HOS-1353-verticales-capacidades-y-autorizacion/' if short.startswith('V/') else 'HOS-1354-billing-cobro-y-proveedor/')+'docs/'+short[2:];row=(src/ff).read_text().splitlines()[int(k)-1];cs=re.split(r'(?<!\\)\|',row.strip('|'))
  secondary.append([r['id'],short,k,[c for c in cs[1:] if norm(clean(c)) and norm(clean(c)) not in norm(actual)]])
for f,a,b in sorted(tables):
 sl=(src/f).read_text().splitlines()
 for i in range(a+2,b):
  if (f,i+1) in locs:continue
  c=clean(sl[i]);first=c.split('|')[1]
  if re.search(r'\w',first):missing.append([f,i+1,sl[i]])
print('LOCKS',json.dumps(locks,ensure_ascii=False));print('SECONDARY',json.dumps(secondary,ensure_ascii=False));print('TABLES',len(tables),'UNREPRESENTED',json.dumps(missing,ensure_ascii=False))
(v/'salidas/G2-complemento-audit.json').write_text(json.dumps({'locks':locks,'secondary':secondary,'tables':len(tables),'unrepresented':missing},ensure_ascii=False,indent=2))

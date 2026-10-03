from pathlib import Path
import re,json
v=Path(__file__).resolve().parent.parent; spec=v/'s/c1c03210'; src=v/'fuentes'
def clean(s):
 s=re.sub(r'~~.*?~~','',s,flags=re.S)
 return re.sub(r'\[([^\]]*)\]\(([^)\s]*)\)',lambda m:m[1]+' (`'+m[2]+'`)' if m[2] else m[1],s)
def norm(s):return re.sub(r'[\s*`#]','',s)
def cells(s):
 s=s.strip();s=s[1:] if s.startswith('|') else s;s=s[:-1] if s.endswith('|') else s
 out=[];cur='';tick=False;i=0
 while i<len(s):
  c=s[i]
  if c=='\\' and i+1<len(s) and s[i+1]=='|':cur+='\\|';i+=2;continue
  if c=='`':tick=not tick
  if c=='|' and not tick:out.append(cur.strip());cur=''
  else:cur+=c
  i+=1
 out.append(cur.strip());return out
L=(spec/'04-catalogos.md').read_text().splitlines(); starts=[i for i,l in enumerate(L) if l.startswith('<a id=')]+[len(L)]; records=[]; diffs=[]; locations=set(); omissions=json.loads((v/'generadores/g3/omisiones.json').read_text())
for a,b in zip(starts,starts[1:]):
 block=L[a:b]; origin=next((l for l in block if l.startswith('Origen:')),None)
 if not origin:continue
 f,n=re.findall(r'(\.specs/[^,:]+):(\d+)',origin)[0];n=int(n); sl=(src/f).read_text().splitlines(); title=next(l for l in block if l.startswith('### '));cid=re.search('`([^`]+)`',title)[1];locations.add((f,n)); issues=[]; cnt=0
 if sl[n-1].startswith('|'):
  h=max(i for i in range(n-1) if sl[i].startswith('|') and i+1<len(sl) and re.match(r'^\|\s*:?-',sl[i+1])); hs=cells(sl[h]);cs=cells(sl[n-1]);
  if len(hs)!=len(cs):
   naive=[c.strip() for c in sl[n-1].strip().strip('|').split('|')]
   if len(naive)==len(hs):cs=naive
   else:issues.append(['CELLCOUNT',len(hs),len(cs)])
  for k,(hh,cc) in enumerate(zip(hs,cs)):
   if k==0 and hh=='#':continue
   expected=clean(cc) or '—'
   for o in omissions.get(cid,[]):expected=expected.replace(o['de'],o['a'])
   pref='- **'+clean(hh)+'**'; candidates=[(a+j+1,l) for j,l in enumerate(block) if l.startswith(pref+':') or l.startswith(pref+' (')]
   cnt+=1
   if not candidates:issues.append(['MISSING_FIELD',hh,expected]);continue
   actual=candidates[0][1].split(': ',1)[-1]
   if norm(actual)!=norm(expected):issues.append(['FIELD',candidates[0][0],hh,actual,expected])
 records.append({'id':cid,'line':a+1,'source':f,'source_line':n,'fields':cnt,'issues':issues})
 if issues:diffs.append(records[-1])
# Prose ranges: each explicit range checked both ways, excluding item tables (their fields checked above).
prefix={'B':'.specs/HOS-1354-billing-cobro-y-proveedor/docs/','V':'.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/','D':'.specs/HOS-1352-billing-verticals-redesign/docs/'}
prose=[]
for i,l in enumerate(L):
 m=re.search(r'(?:Texto de |\*\*Texto de la fuente.*?\()`([BVD])/([^`]+):(\d+)–(\d+)`',l)
 if not m:continue
 p,short,aa,bb=m.groups();f=prefix[p]+short
 if short=='descomposicion.md':f=prefix[p].replace('docs/','')+short
 aa=int(aa);bb=int(bb);sl=(src/f).read_text().splitlines();j=i+1
 if bb>len(sl):print('RANGE_EXCEEDS_SOURCE',i+1,f,aa,bb,len(sl));bb=len(sl)
 while j<len(L) and not (L[j].startswith(('Origen:','<a id=','**Texto de la fuente','## ')) or L[j].startswith('### ')):j+=1
 actual='\n'.join(L[i+1:j]);original=sl[aa:bb];kept=[];k=aa
 while k<bb:
  if sl[k].startswith('|'):
   e=k+1
   while e<bb and sl[e].startswith('|'):e+=1
   if not any((f,q+1) in locations for q in range(k,e)):kept+=sl[k:e]
   k=e
  else:kept.append(sl[k]);k+=1
 expected=clean('\n'.join(kept)); expected=re.sub(r'^---\s*$','',expected,flags=re.M)
 issues=[];en=norm(expected);an=norm(actual)
 for t in expected.splitlines():
  if norm(t) and norm(t) not in an:issues.append(['SOURCE',t])
 for z,t in enumerate(L[i+1:j],i+2):
  if norm(t) and norm(t) not in en:issues.append(['OUTPUT',z,t])
 prose.append({'line':i+1,'source':f,'range':[aa,bb],'issues':issues})
(v/'salidas/G2-catalogo-audit.json').write_text(json.dumps({'items':records,'prose':prose},ensure_ascii=False,indent=2))
print('ITEMS',len(records),'FIELDS',sum(r['fields'] for r in records),'DIFFERING',len(diffs));print(json.dumps(diffs,ensure_ascii=False,indent=2));print('PROSE',len(prose),'DIFFERING',sum(bool(p['issues']) for p in prose));print(json.dumps([p for p in prose if p['issues']],ensure_ascii=False,indent=2))

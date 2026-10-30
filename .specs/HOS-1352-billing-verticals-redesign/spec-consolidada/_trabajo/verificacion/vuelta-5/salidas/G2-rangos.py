exec(open('salidas/G2-auditar.py').read().split('results={};')[0])
ls=(S/'04-catalogos.md').read_text().splitlines(); issues=[];checks=[]
for i,l in enumerate(ls):
 m=re.search(r'`([BVD]/[^`]+):(\d+)–(\d+)`',l)
 if not m:continue
 p=short[m[1]];a,b=map(int,m.group(2,3));j=i+1
 while j<len(ls) and not re.match(r'^#{1,3} |^<a |^Origen:|^\*\*Texto de la fuente',ls[j]):j+=1
 out=norm('\n'.join(ls[i+1:j]));original=src[p][a:b];livechunk=clean('\n'.join(original));cleanlines=livechunk.splitlines()
 for q in cleanlines:
  nq=norm(q)
  if not nq or nq=='---' or re.match(r'^\|[\s:|-]+$',q):continue
  if l.startswith('Texto de ') and q.startswith('|'):continue # catalog table rows are separate items
  if nq not in out:
   issues.append((i+1,m[1]+':'+str(a)+'–'+str(b),q))
 checks.append([i+1,j,p,a,b])
print('Rangos',len(checks),'Diferencias',len(issues))
for x in issues:print(str(x)[:1600])
(V/'salidas/G2-rangos.json').write_text(json.dumps({'checks':checks,'issues':issues},ensure_ascii=False,indent=2))

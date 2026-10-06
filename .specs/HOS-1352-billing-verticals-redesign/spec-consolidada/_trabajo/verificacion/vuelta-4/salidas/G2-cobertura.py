from pathlib import Path
import re,json
V=Path.cwd();F=V/'fuentes';S=V/'s/5586fad7'
refs=json.load(open('generadores/secciones/fuentes.json'));rows=json.load(open('salidas/G2-tablas.json'))['covered'];ranges=json.load(open('salidas/G2-secciones.json'))['ranges']
def clean(t):return re.sub(r'~~.*?~~','',t,flags=re.S)
for rel,cites in refs.items():
 print('SECCIONES',rel)
 for p in sorted(set(p for p,n in cites)):
  ls=(F/p).read_text().splitlines();hs=[i for i,l in enumerate(ls,1) if re.match(r'^#{1,6} ',l)]
  included={max(i for i in hs if i<=n) for q,n in cites if q==p}
  for a,b in zip(hs,hs[1:]+[len(ls)+1]):
   if a in included:continue
   live=clean('\n'.join(ls[a:b-1])).strip()
   if re.sub(r'[\s*`>|:-]','',live):print('NO CITADA',p,a,b-1,ls[a-1],live[:150])
print('FILAS CATALOGO NO COPIADAS dentro de tablas alcanzadas')
for p,ns in rows.items():
 ls=(F/p).read_text().splitlines();seen=set()
 for n in ns:
  if not ls[n-1].startswith('|'):continue
  a=n-1;b=n
  while a>0 and ls[a-1].startswith('|'):a-=1
  while b<len(ls) and ls[b].startswith('|'):b+=1
  for i in range(a+2,b):
   if i+1 in ns or i in seen:continue
   seen.add(i);l=ls[i]
   first=re.split(r'(?<!\\)\|',l)[1]
   if not re.sub(r'[*`\s✚]','',clean(first)):continue
   # duplicates of guards appear as secondary fields
   if re.search(r'G\d+|G-R',first):continue
   print(p,i+1,l[:250])
print('RANGOS CATALOGO',sum(map(len,ranges.values())))

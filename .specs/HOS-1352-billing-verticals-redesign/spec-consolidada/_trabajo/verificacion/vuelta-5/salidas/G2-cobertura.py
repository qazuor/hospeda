exec(open('salidas/G2-auditar.py').read().split('results={};')[0])
cat=(S/'04-catalogos.md').read_text();out=norm(cat);ls=cat.splitlines();ranges=collections.defaultdict(list)
for l in ls:
 for m in re.finditer(r'`([BVD]/[^`]+):(\d+)–(\d+)`',l):ranges[short[m[1]]].append(tuple(map(int,m.group(2,3))))
for a,b in [(21,1446),(1447,1519),(1520,1739),(1906,2529),(2549,2687),(2688,3062)]:ranges[short['B/03-maquinas-de-estado.md']].append((a,b))
for a,b in [(91,479),(655,1351)]:ranges[short['V/03-maquinas-de-estado.md']].append((a,b))
for l in ls:
 if l.startswith('Origen:'):
  p,n=re.findall(r'(\.specs/[^,:]+):(\d+)',l)[0];a,b=section(p,int(n));ranges[p].append((a+1,b))
issues=[];count=0
for p,rs in ranges.items():
 for k in sorted({k for a,b in rs for k in range(a-1,b)}):
  t=clean(live_lines[p][k] if k<len(live_lines[p]) else '').strip();q=norm(t)
  if not q or q=='---' or re.match(r'^#+ |^\|[\s:|-]+$',t):continue
  count+=1
  if t.startswith('|'):
   # headings and retired identifiers aren't normative fields
   cs=cells(t)
   if k+1<len(src[p]) and re.match(r'^\|[\s:|-]+$',src[p][k+1]):continue
   if '~~' in src[p][k] and not norm(clean(cells(src[p][k])[0])):continue
   for c in cs:
    if len(norm(c))<5:continue
    if norm(c) not in out:issues.append((p,k+1,c))
  elif q not in out:issues.append((p,k+1,t))
print('Lineas fuente comprobadas',count,'pendientes',len(issues))
for x in issues:print(str(x)[:750])
(V/'salidas/G2-cobertura.json').write_text(json.dumps({'count':count,'issues':issues},ensure_ascii=False,indent=2))

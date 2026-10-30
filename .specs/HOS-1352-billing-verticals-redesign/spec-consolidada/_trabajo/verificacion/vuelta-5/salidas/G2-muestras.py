exec(open('salidas/G2-auditar.py').read().split('results={};')[0])
res={}
for f in files[1:]:
 ls=(S/f).read_text().splitlines();lo=next(i for i,l in enumerate(ls) if '<!-- g-secciones: inicio' in l);hi=next(i for i,l in enumerate(ls) if '<!-- g-secciones: fin' in l)
 candidates=[i for i in range(lo+1,hi) if len(ls[i].strip())>45 and not re.match(r'^#+ |^Origen:|^\|[\s:|-]+$',ls[i])]
 picks=[candidates[round(i*(len(candidates)-1)/39)] for i in range(40)]
 anomalies={'10-corte/B11.md':[249,1159],'10-corte/B13a.md':[224,405]}
 picks=sorted(set(picks+anomalies.get(f,[])));pairs=[]
 for i in picks:
  origin=next(l for l in ls[i:hi] if l.startswith('Origen:'));refs=re.findall(r'(\.specs/[^,:]+):(\d+)',origin);hits=[]
  for p,n in refs:
   a,b=section(p,int(n));raw='\n'.join(src[p][a+1:b]);nq=norm(ls[i]);cl=clean(raw)
   if nq in norm(cl):
    single=[k+1 for k in range(a+1,b) if k<len(live_lines[p]) and nq in norm(clean(live_lines[p][k]))]
    hits.append([p,single or [a+1,b]])
  pairs.append({'spec_line':i+1,'text':ls[i],'source':hits or refs,'match':bool(hits)})
 res[f]=pairs
(V/'salidas/G2-muestra-secciones.json').write_text(json.dumps(res,ensure_ascii=False,indent=2))
for f,ps in res.items():
 print(f,len(ps),'cotejos',sum(p['match'] for p in ps),'coinciden; diferencias',[(p['spec_line'],p['text'][:100]) for p in ps if not p['match']])
# Validate cited sections exactly cover manifests
manifest=json.loads((V/'generadores/secciones/fuentes.json').read_text())
for f,expect in manifest.items():
 ls=(S/f).read_text().splitlines();lo=next(i for i,l in enumerate(ls) if '<!-- g-secciones: inicio' in l);hi=next(i for i,l in enumerate(ls) if '<!-- g-secciones: fin' in l)
 actual=[(p,int(n)) for l in ls[lo:hi] if l.startswith('Origen:') for p,n in re.findall(r'(\.specs/[^,:]+):(\d+)',l)]
 print(f,'CITAS',actual==[tuple(v) for v in expect])

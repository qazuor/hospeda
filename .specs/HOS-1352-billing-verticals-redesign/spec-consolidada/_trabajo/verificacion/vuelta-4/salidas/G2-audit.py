from pathlib import Path
import re,json,difflib
V=Path.cwd(); S=V/'s/5586fad7'; F=V/'fuentes'
refs=json.loads((V/'generadores/secciones/fuentes.json').read_text())
paths=['04-catalogos.md']+list(refs)
sources={str(p.relative_to(F)):p.read_text() for p in F.rglob('*.md')}
def live(t):
    return re.sub(r'~~.*?~~','',t,flags=re.S)
def norm(t):
    t=re.sub(r'\[([^\]]*)\]\(([^)\s]*)\)',lambda m:m[1]+' '+m[2],t)
    return re.sub(r'\s+',' ',re.sub(r'[*`#]','',t)).strip()
def clean(t): return norm(live(t))
def short(p):
    return p.replace('.specs/HOS-1354-billing-cobro-y-proveedor/docs/','B/').replace('.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/','V/').replace('.specs/HOS-1352-billing-verticals-redesign/docs/','D/')
def sec(p,n):
    ls=sources[p].splitlines(); heads=[i for i,l in enumerate(ls,1) if re.match(r'^#{1,6} ',l)]
    a=max([i for i in heads if i<=n],default=1); b=min([i for i in heads if i>a],default=len(ls)+1)-1
    return a,b,'\n'.join(ls[a:b])
# Each output line is searched in its cited section(s), while tracking all lines including metadata.
results={}; examples=[]
for rel in paths:
    ls=(S/rel).read_text().splitlines(); start=0; end=len(ls)
    if rel!='04-catalogos.md':
        start=next(i for i,l in enumerate(ls) if '<!-- g-secciones: inicio' in l)+1
        end=next(i for i,l in enumerate(ls) if '<!-- g-secciones: fin' in l)
        chunks=[]; prev=start
        for i in range(start,end):
            if ls[i].startswith('Origen: '):
                cites=re.findall(r'(\.specs/[^,:]+):(\d+)',ls[i]); txt='\n'.join(sec(p,int(n))[2] for p,n in cites)
                chunks.append((prev,i,txt,cites));prev=i+1
        bad=[]; checked=0
        for a,b,txt,cites in chunks:
            ctxt=clean(txt)
            for i in range(a,b):
                l=ls[i]; nl=norm(l)
                if not nl or l.startswith('#') or nl=='[…]': continue
                checked+=1
                if nl not in ctxt:
                    # link neutralization adds parentheses; normalize those too for searching
                    nl=re.sub(r'[()]','',nl); ct=re.sub(r'[()]','',ctxt)
                    if nl not in ct: bad.append([i+1,l,cites])
        results[rel]={'total':len(ls),'range':[start+1,end],'checked':checked,'unmatched':bad}
    else:
        allsrc='\n'.join(clean(t) for t in sources.values()); bad=[]; checked=0
        for i,l in enumerate(ls):
            if not l.strip() or l.startswith(('#','<a ','Origen:','Texto de ','**Texto de ')):continue
            if re.match(r'- \*\*(Pieza dueña|Fuente de la asignación|Adjudicación|Traslado a pieza|Test mínimo|Dónde corre|Qué es|Valor del enum|También en)',l):continue
            checked+=1
            val=re.sub(r'^\s*- \*\*.*?\*\*(?: \([^)]*\))?: ','',l)
            val=norm(val)
            if val and val not in allsrc and re.sub(r'[()]','',val) not in re.sub(r'[()]','',allsrc):bad.append([i+1,l])
        results[rel]={'total':len(ls),'checked':checked,'unmatched':bad}
(V/'salidas/G2-audit.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
for rel,r in results.items():
    print(rel,'total',r['total'],'checked',r['checked'],'unmatched',len(r['unmatched']))
    for x in r['unmatched']:print(x)

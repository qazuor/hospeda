import re, json, collections
from pathlib import Path
V=Path(__file__).resolve().parent.parent
S=V/'s/2e9ef99e/01-decisiones-vigentes.md'
txt=S.read_text(); ls=txt.splitlines()
def norm(t):
    t=re.sub(r'\]\([^\s)]*\)',']',t)
    return re.sub(r'\s+',' ',t.replace('\\|','|')).strip()
def live(t): return re.sub(r'~~.*?~~','',t,flags=re.S)
anchors=list(re.finditer(r'^<a id="([^"]+)"></a>',txt,re.M))
blocks=[]
for k,m in enumerate(anchors):
    t=txt[m.end():anchors[k+1].start() if k+1<len(anchors) else len(txt)]
    o=re.search(r'^Origen: (.*):(\d+)$',t,re.M)
    if not o: continue
    p,n=o.group(1),int(o.group(2)); src=(V/'fuentes'/p).read_text().splitlines()
    start=txt[:m.start()].count('\n')+1
    blocks.append(dict(id=m.group(1),start=start,text=t,path=p,n=n,src=src))
out=[]; stats=collections.Counter(); candidates=[]
log=V/'fuentes/.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md'
L=log.read_text().splitlines()
for b in blocks:
    ident=b['id']; n=b['n']; src=b['src']; t=b['text']
    if ident.startswith('own-'):
        stats['owner']+=1
        cells=re.split(r'(?<!\\)\|',src[n-1].strip())[1:-1]
        rows=re.findall(r'^- \*\*.*?\*\*: (.*)$',t,re.M)
        for i,(c,r) in enumerate(zip(cells[1:],rows)):
            stats['cells']+=1
            if norm(live(c)) not in (norm(r),'' if r=='—' else None):
                out.append({'kind':'owner_cell','id':ident,'line':b['start'],'source':c,'output':r})
        if len(rows)!=len(cells)-1: out.append({'kind':'owner_count','id':ident,'line':b['start'],'cells':len(cells),'rows':len(rows)})
        continue
    stats['pin' if re.search(r'-p\d+$',ident) else 'dec']+=1
    # Whole decision context, independently delimited by the next heading.
    a=n-1
    while a>0 and not re.match(r'^### DEC-',src[a]): a-=1
    z=a+1
    while z<len(src) and not re.match(r'^#{1,3} ',src[z]): z+=1
    context=norm(live('\n'.join(src[a:z])))
    for j,line in enumerate(t.splitlines(),b['start']):
        if not line.strip() or re.match(r'^(#{1,4} |Origen:|Dueña|También:|Tests mínimos:|Cobertura:|Estado en el inventario:|> \*\*(Parte sin efecto|Texto reubicado)|Retiradas|Fuente:)',line): continue
        if '→ ver' in line or 'retirado:' in line: continue
        parts=line.split('[…]')
        for part in parts:
            nn=norm(part).strip(' >-*.,;:')
            if len(nn)<15: continue
            stats['lines_checked']+=1
            if nn not in context: out.append({'kind':'line_not_in_live_context','id':ident,'line':j,'output':line})
    b['a']=a; b['z']=z
# Search source lines absent from all output blocks of that decision (incl. pins).
groups=collections.defaultdict(list)
for b in blocks:
    if b['id'].startswith('dec-'): groups[re.sub(r'-p\d+$','',b['id'])].append(b)
for ident,bs in groups.items():
    b=bs[0]; ctx=norm('\n'.join(x['text'] for x in bs))
    for n in range(b['a'],b['z']):
        line=live(b['src'][n]); nn=norm(line).strip(' >-*.,;:')
        if len(nn)>40 and nn not in ctx:
            candidates.append({'id':ident,'source_line':n+1,'source':line})
(V/'salidas/G1-comparacion.json').write_text(json.dumps({'stats':dict(stats),'differences':out,'missing_candidates':candidates},ensure_ascii=False,indent=2))
(V/'salidas/G1-bloques.json').write_text(json.dumps([{k:v for k,v in b.items() if k not in ('src','text')} for b in blocks],ensure_ascii=False,indent=2))
print(dict(stats)); print('differences',len(out),'source candidates',len(candidates))
print(json.dumps(out,ensure_ascii=False,indent=2))
O=json.loads((V/'generadores/g1/omisiones.json').read_text())
reverse=[]
for ident,bs in groups.items():
    b=bs[0]; original='\n'.join(b['src'][b['a']:b['z']]); cleaned=live(original)
    for cid,ops in O.items():
        if cid.split('#')[0].lower()!=ident: continue
        for op in ops:
            fragment=op.get('de',op.get('cita',''))
            # Compare omissions as declared data, never import or execute the generators.
            needle=re.compile(r'\s+'.join(re.escape(w) for w in norm(fragment).split()))
            cleaned=needle.sub(lambda m:op.get('a','[…]'),norm(cleaned))
    generated=norm('\n'.join(x['text'] for x in bs))
    # 8-word windows detect full-line omissions and changed fragments without assuming line breaks.
    words=norm(cleaned).split()
    missing=[]
    for j in range(len(words)-7):
        frag=' '.join(words[j:j+8])
        if frag not in generated: missing.append(j)
    runs=[]
    for j in missing:
        if runs and j<=runs[-1][-1]+1: runs[-1].append(j)
        else:runs.append([j])
    for run in runs:
        frag=' '.join(words[run[0]:run[-1]+8])
        reverse.append({'id':ident,'text':frag})
(V/'salidas/G1-reverso.json').write_text(json.dumps(reverse,ensure_ascii=False,indent=2))
print('reverse runs',len(reverse))

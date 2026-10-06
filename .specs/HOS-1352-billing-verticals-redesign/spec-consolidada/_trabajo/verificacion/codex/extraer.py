import re,glob,os
can=[l.rstrip('\n').split(' | ') for l in open('v3-canarios.txt') if l.strip()]
clocs=[]
for c in can:
    for loc in c[1].split(', '):
        f,n=loc.rsplit(':',1); clocs.append((f.split('/')[-1],int(n)))
# omit-canary keywords to catch source-side reports
kw=['nunca es negativo','no se arregla aparte','prendida por defecto','A igual instante','no se detiene','no gasta','cambio voluntario','sin padre','sin fecha']
out=[];n=0
for f in sorted(glob.glob('v3/salidas/*.txt')):
    vid=os.path.basename(f)[:-4]; t=open(f).read()
    sec=t.split('## Hallazgos',1)[1].split('## Resumen',1)[0] if '## Hallazgos' in t else t
    items=[x.strip() for x in re.split(r'\n\s*\n',sec) if x.strip()]
    for i,it in enumerate(items,1):
        refs=[(m.group(1).split('/')[-1],int(m.group(2)),int(m.group(3) or m.group(2))) for m in re.finditer(r'([\w\-/]+\.md):(\d+)(?:[-–](\d+))?',it)]
        spec_refs=[r for r in refs]
        iscan=any(rf==cf and ra-4<=cn<=rb+4 for rf,ra,rb in refs for cf,cn in clocs) or any(k in it for k in kw)
        n+=1
        out.append(('CAN? ' if iscan else '')+f'[{vid}-{i}] '+it)
open('v3-hallazgos-todos.txt','w').write('\n\n'.join(out))
print('total',n,'posibles-canario',sum(o.startswith('CAN?') for o in out))

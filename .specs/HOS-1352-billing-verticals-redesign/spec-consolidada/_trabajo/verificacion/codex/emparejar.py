import re,glob,os
can=[l.rstrip('\n').split(' | ') for l in open('v3-canarios.txt') if l.strip()]
outs={os.path.basename(f)[:-4]:open(f).read() for f in glob.glob('v3/salidas/*.txt')}
refs={}
for vid,t in outs.items():
    for m in re.finditer(r'([\w\-/]+\.md):(\d+)(?:[-–](\d+))?',t):
        f=m.group(1).split('/')[-1]; a=int(m.group(2)); b=int(m.group(3) or a)
        refs.setdefault(vid,[]).append((f,a,b))
tot=0
for i,c in enumerate(can,1):
    blk,locs,typ=c[0],c[1],c[2]
    hits=set()
    for loc in locs.split(', '):
        f,n=loc.rsplit(':',1); f=f.split('/')[-1]; n=int(n)
        for vid,rs in refs.items():
            if any(rf==f and ra-4<=n<=rb+4 for rf,ra,rb in rs): hits.add(vid)
    own = any(h==blk or (blk.startswith('VA') and h==blk) or (blk=='G1' and h=='G1') or (blk=='G2' and h=='G2') for h in hits)
    tot+=bool(hits)
    print(f"{i:2} {blk:6} {typ:8} {locs[:60]:60} -> {','.join(sorted(hits)) or '—'}  {'propio' if own else ''}")
print('detectados (por línea):',tot)

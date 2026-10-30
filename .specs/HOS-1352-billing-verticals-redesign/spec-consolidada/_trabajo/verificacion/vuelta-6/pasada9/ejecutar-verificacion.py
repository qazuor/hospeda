from pathlib import Path
import json, os, subprocess, sys

W = Path('/home/qazuor/projects/WEBS/hospeda-spec-hos-1352-billing-redesign')
C = W / '.specs/HOS-1352-billing-verticals-redesign/spec-consolidada'
P = C / '_trabajo/verificacion/vuelta-6/pasada9'
ENV = dict(os.environ, PYTHONDONTWRITEBYTECODE='1', npm_config_manage_package_manager_versions='false')
COV = ['scripts/cobertura.py','_trabajo/inventario.json','_trabajo/adjudicacion.json','_trabajo/cobertura-lectura.json','_trabajo/cobertura.json']
def run(name, args, cwd=C):
    with (P / (name + '.log')).open('w') as f:
        r = subprocess.run(args, cwd=cwd, env=ENV, stdout=f, stderr=subprocess.STDOUT)
    entry = dict(check=name, command=args, cwd=str(cwd), exit=r.returncode)
    with (P/'ejecuciones.jsonl').open('a') as f:
        f.write(json.dumps(entry, ensure_ascii=False)+'\n')
    print(name, 'exit', r.returncode, flush=True)
    if r.returncode:
        print((P/(name+'.log')).read_text()[-7000:])
        sys.exit(r.returncode)

if __name__ == '__main__':
    phase=sys.argv[1]
    if phase=='prepare':
        run('inventario', ['python3','scripts/inventario.py','--json','_trabajo/inventario.json'])
        run('asignar', ['python3','scripts/asignar.py','_trabajo/inventario.json','_trabajo/adjudicacion.json','_trabajo/asignacion.json'])
        run('adjudicar', ['python3','scripts/adjudicar.py','_trabajo/inventario.json','_trabajo/adjudicacion.json'])
        run('reanclar', ['python3','scripts/reanclar.py','--desde=3c3e88b9b59cb7d766bc34848b8ffd657eb95770','--escribir','--reporte='+str(P/'reanclaje.json')])
    if phase in ('prepare','coverage'):
        run('reanclar-cobertura',['python3',*COV,'--reanclar=3c3e88b9b59cb7d766bc34848b8ffd657eb95770'])
        run('sellar-cobertura',['python3',*COV,'--sellar'])
    if phase=='generate':
        for name,file,args in [('omisiones-g1','g1/omisiones.py',[]),('generar-g1','g1/gen01.py',[]),('generar-g3','g3/gen.py',[]),('generar-g8','g8/gen.py',['B4','B5','B6','B7']),('generar-secciones','secciones/gen.py',[])]:
            run(name,['python3','scripts/generadores/'+file,*args])
    if phase=='check':
        checks=[('trazar',['scripts/trazar.py','_trabajo/inventario.json','_trabajo/adjudicacion.json','.','--cobertura=_trabajo/cobertura.json']),('canarios',['scripts/canarios.py']),('canarios-cobertura',['scripts/canarios_cobertura.py']),('canarios-g1',['scripts/generadores/g1/canarios_g1.py']),('canarios-g3',['scripts/generadores/g3/canarios_g3.py']),('canarios-secciones',['scripts/generadores/secciones/canarios_secciones.py']),('aristas',['scripts/aristas.py']),('contar',['scripts/contar.py']),('cobertura',['scripts/cobertura.py'])]
        checks=[(name, COV if name=='cobertura' else ['../docs/41-corte-del-mvp/'+name+'.py'] if name in ('aristas','contar') else args) for name,args in checks]
        for name,args in checks: run(name,['python3',*args])
        run('markdownlint',['pnpm','exec','markdownlint-cli2',str(C/'**/*.md')],W)

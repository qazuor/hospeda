from pathlib import Path
import subprocess,json
C=Path('.specs/HOS-1352-billing-verticals-redesign/spec-consolidada')
P=C/'_trabajo/verificacion/vuelta-7/pasada10'
patterns={
'R01':r'carga.{0,60}3a|3a.{0,60}carga|no esta migración',
'R02':r'mut.{0,80}fecha efectiva|cambio se ejecuta|reintent.{0,100}fecha efectiva|desde su fecha efectiva',
'R03':r'tres correos|B13a.{0,80}aumento',
'R04':r'alta nueva|checkout ya abierto',
'R05':r'promo_redemption|instante del canje',
'R06':r'BL por inferencia|rama que la.{0,10}lee|reconciliation_mark_payment',
'R07':r'aviso.{0,100}encola|encola.{0,100}cobertura|B4.{0,80}outbox|aviso.{0,50}durable',
'R08':r'misma transacción que encol|con el encolado del aviso|coberturaPerdidaEn',
'R09':r'comprobante de la transferencia|comprobante.{0,35}transferencia|RF4',
'R10':r'primera cuota|MP5|aviso de falta de pago',
'R11':r'relectura por id del pago|RF3',
'R12':r'pendiente de.{0,5}S19|S6.{0,8}no ocurre|ocurre y corre.{0,5}S5',
'R13':r'deja en.{0,5}DRAFT|levantar la moderación|levantar.*moder|PB11',
'R14':r'los tres avisos|tres avisos.{0,80}V9b|aviso.{0,10}al archivar',
'R15':r'alerta cerrada|fecha objetivo',
'R16':r'limit menor|limit.{0,20}menor|rank.{0,10}MAYOR',
'R17':r'dieciocho|18 plazos|merge.{0,15}B11',
'R18':r'V9a.{0,60}domain_event|domain_event.{0,60}V9a|crea.{0,10}domain_event',
'R19':r'destino para su ciclo|ventana gemela|sin promos',
'R20':r'contracargo.{0,80}defecto|contracargo y no en la vista',
'R21':r'doce.{0,60}depend|las doce|doce del|trece.{0,40}depend',
'R22':r'B/09.{0,5}§6|nueva acuñada',
'R23':r'correo encolado antes de la cancelación|VIP|vip',
'R24':r'no como gate|ventanas del corte|TEST:U1:24',
'R25':r'paso 5/6|sin fuente que|sin fuente comercial|pasos 5 y 6',
'R26':r'lista de piezas, l\. 95[03]|§4\.6 \(l\. 95[12]',
'R27':r'promos y cortesías, en.{0,5}B9a|addons, en.{0,5}B4|le agrega a.{0,5}payment',
'R28':r'precisar nunca corrige|Caducada en parte|LETRAS_MUERTAS|LETRAS_VIVAS_REVISADAS',
'R29':r'predicado.{0,100}B2|su test.{0,30}B2',
'R30':r'fuera de.{0,5}staging|producción.{0,80}aborta|guard de entorno|sólo staging|toda sonda|todas las sondas'
}
results={}
for key,pattern in patterns.items():
 cmd=['rg','--hidden','-n','-i','-g','*.md',pattern,str(C)]
 r=subprocess.run(cmd,text=True,capture_output=True);assert r.returncode in (0,1)
 (P/(key+'-rg.txt')).write_text(r.stdout)
 live='\n'.join(x for x in r.stdout.splitlines() if '/_trabajo/' not in x)
 Path('/tmp/hos1352-'+key+'.txt').write_text(live+'\n')
 results[key]={'pattern':pattern,'exit':r.returncode,'all_lines':len(r.stdout.splitlines()),'live_lines':len(live.splitlines())}
(P/'busquedas-spec.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v['live_lines'] for k,v in results.items()}))

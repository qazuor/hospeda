from pathlib import Path
import re,json,collections
V=Path.cwd();r=json.loads((V/'salidas/G2-audit.json').read_text());m=json.loads((V/'salidas/G2-muestra.json').read_text())
B='.specs/HOS-1354-billing-cobro-y-proveedor/docs/';Vt='.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/'
findings=[
('04-catalogos.md',1116,'y **devuelve el trial** (§10.2).',f'contradice {Vt}03-maquinas-de-estado.md:493 («y **no devuelve el trial** (§10.2).»)'),
('04-catalogos.md',3358,'el `status_detail` de ese único intento, con un mapa',f'más débil que {B}03-maquinas-de-estado.md:166 («con un mapa y un genérico obligatorio»; omite la respuesta obligatoria para motivos fuera del mapa, vigente también en DEC-MP-004)'),
('04-catalogos.md',4542,'corre **`P3` o `P4`** sobre el pago, según el acumulado (§6).',f'más débil que {B}03-maquinas-de-estado.md:1852 («según el acumulado (§6); se escribe *«por el proveedor»*.»; RF3 pierde la escritura del canal de ejecución que refund exige en EXECUTED, {B}02-modelo-de-datos.md:380)'),
('04-catalogos.md',6293,'listado accionable tiene que mostrarle es el pago y el monto.',f'más débil que {B}05-idempotencia-y-concurrencia.md:192 («listado accionable tiene que mostrarle es el pago, el monto y **desde cuándo la fila estaba en»; continúa en :193 «grace**.»; C2 omite el comienzo del grace necesario para decidir la devolución por el servicio recibido)'),
('10-corte/B13a.md',89,'la **versión vigente** del plan de la suscripción',f'contradice {B}19-superficies.md:45 («la **versión anclada** de la suscripción»; cambia la versión que leen Mi Cuenta y Mi Suscripción)'),
('10-corte/B13a.md',182,'derivado del `status_detail` con un mapa explícito:',f'más débil que {B}19-superficies.md:138 («derivado del `status_detail` con un mapa explícito y un **texto genérico obligatorio** para lo que no esté en el mapa:»; omite el mensaje obligatorio para rechazos no mapeados)'),
]
lines=['# G2 · spec → fuente · 04-catalogos.md + g-secciones de B9a, B10, B11, B12, B13a, B8b','','## Hallazgos','']
for f,n,q,c in findings:lines.append(f'{f}:{n} · «{q}» · {c} · BLOQUEA\n')
lines+=['## Resumen','','| archivo | líneas recorridas | afirmaciones normativas revisadas (aprox.) | BLOQUEA | MENOR |','|---|---|---:|---:|---:|']
for f,st in r['stats'].items():
 L=(V/'s/b249f841'/f).read_text().splitlines();body=L[st['start']-1:st['end']]
 # Estimate by copied cells/table rows and substantive prose paragraphs, not physical wrapped lines.
 units=0;prose=False
 for l in body:
  if not l.strip():prose=False;continue
  if l.startswith(('#','Origen:','<','Texto de ','**Texto de la fuente')):continue
  if re.match(r'^\|[\s:|\-]+$',l):continue
  if l.startswith('|') or re.match(r'^\s*(?:[-*]|\d+\.) ',l):units+=1;prose=False
  elif not prose:units+=1;prose=True
 n=sum(x[0]==f for x in findings)
 lines.append(f'| {f} | 1–{st["total"]} | ≈{units} | {n} | 0 |')
lines+=['','Total: **6 BLOQUEA, 0 MENOR**. Se cuentan las dos omisiones del texto genérico por separado porque están en dos transcripciones distintas.','','Recorrido instrumental de los siete archivos completos. El juicio de fidelidad de las seis piezas se limita a los tramos g-secciones asignados a G2; no se adjudican sus AC externos. Tramos cotejados: '+ '; '.join(f'{f}:{st["start"]}–{st["end"]}' for f,st in r['stats'].items() if f!='04-catalogos.md')+'.','','Cotejo exhaustivo de 292 ítems tabulares del catálogo, sus columnas, 3 apariciones secundarias de guards, 6 candados completos, 102 rangos explícitos de prosa del catálogo y 107 secciones de las piezas. Comparación independiente; no se importó ni ejecutó ningún generador. Se admitió sólo la limpieza anunciada (tachados, neutralización de enlaces, espacios, separadores y notas de filas retiradas). Las diferencias materiales se verificaron sobre las líneas originales.','','Clases de error buscadas en toda la salida con `rg --hidden` y contrastadas con las fuentes:','','- Tachados enteros, parciales y multilínea que sobreviven como vivos: ninguna diferencia adicional en los cuerpos cotejados; no queda ningún delimitador `~~` en el alcance generado. Se verificaron también títulos retirados con cuerpo vivo y las notas «sale» de filas retiradas.','- Celdas partidas por `\\|` o por barras dentro de código: sin hallazgos. Se cotejaron las columnas completas; no hay `\\|` en los tramos generados. La búsqueda de fuente devuelve 168 líneas en el corpus completo, fuera de esos tramos copiados.','- Texto adjunto al bloque equivocado: sin hallazgos. Los 102 rangos del catálogo se contrastaron con sus límites citados; los seis candados con sus secciones fuente; las 107 secciones con sus títulos y capítulos.','- Letras del owner o 📌 retirados presentados como vigentes: sin hallazgo adicional. Se buscaron las 42 líneas con 📌 del alcance y las referencias de retiro, contrastando el texto vivo. EX-46 conserva la omisión autorizada por BK; no se confunde esa omisión con pérdida de texto vigente. Se consultaron el decision log y las decisiones del corte, incluidas BM, CF y CG.','- Omisiones de texto vivo: cuatro hallazgos (S16, RF3, C2 y fila 19 de B13a). Los capítulos declarados enteros no pierden secciones. Se revisaron 34 tablas fuente; los tres guards sin fila principal propia en B/20 están copiados como apariciones secundarias en el catálogo.','- Sustituciones que cambian una regla: dos hallazgos (PB6 y versión leída por Mi Cuenta/Mi Suscripción). Las fuentes vivas no autorizan esos cambios.','- Contradicciones internas: búsqueda cruzada en toda s/b249f841 por PB6, el mensaje genérico, el canal del refund y el inicio del grace; los hallazgos anteriores no se duplican por sus otras manifestaciones. B13a contradice además su explicación inmediata: «la suscripción es lo que se compró» (:92–94).','','Muestra estratificada: **40 ítems de 04-catalogos.md**, distribuidos del principio al final y entre todas las familias; se cotejaron las celdas completas o, en C2, toda la sección. Se agregaron PB6, RF3 y todos los demás candados al detectar diferencias. Detalle de los 40 (línea de inicio → fuente):','']
for x in m:
 if x['archivo']=='04-catalogos.md':lines.append(f'- {x["item"].removeprefix("### ")} · :{x["linea"]} → {x["fuente"]}.')
lines+=['','En cada una de las seis piezas se seleccionaron además **40 afirmaciones/líneas de prosa o tabla**, repartidas a lo largo de su bloque. Cada par siguiente es línea de la pieza → línea de la fuente indicada (el texto íntegro está en `G2-muestra.json`):','']
for f in r['stats']:
 if f=='04-catalogos.md':continue
 groups=collections.defaultdict(list)
 for x in m:
  if x['archivo']==f:
   p,n=x['fuente'].rsplit(':',1);groups[p].append(f'{x["linea"]}→{n}')
 for p,pairs in groups.items():lines.append(f'- {f}, fuente {p}: '+', '.join(pairs)+'.')
lines+=['','Estrato de precisiones con 📌: se cotejaron además, entre otras, las celdas RC-5 (:8770), GR-3 (:8337) y EX-46 (:9647), junto con sus precisiones vivas y los tachados de la fuente. La muestra de prosa sin 📌 y de tablas se complementa con los 102 rangos y las 107 secciones completos; no se usó la muestra como sustituto del barrido.','','Evidencia auxiliar en salidas/: `G2-audit.json`, `G2-muestra.json`, `G2-clases-rg.txt`, `G2-decisiones-rg.txt`, `G2-cruces-spec.txt` y los scripts independientes de cotejo. No se usaron git, trackers ni subagentes. No se leyó fuera de V: las skills externas del brief y las skills comunes no se abrieron por esa restricción. No hay AGENTS.md ni .qz/project.json dentro de V en la búsqueda realizada.','','## Key Learnings:','','- La igualdad debe comprobarse también en prosa: C2 pierde una obligación fuera de las tablas.','- Que no sobrevivan delimitadores de tachado no demuestra fidelidad: una negación borrada, una escritura omitida o una versión sustituida cambian la implementación.']
(V/'salidas/G2.txt').write_text('\n'.join(lines)+'\n')
print('WROTE',V/'salidas/G2.txt');print('\n'.join(lines[19:34]))

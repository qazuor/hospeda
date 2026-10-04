---
title: "FASES 6 y 7 · publicación del grupo del paraguas"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 7
---

# FASES 6 y 7 · publicación del grupo del paraguas

Publicación de las FASES 6 y 7 cerradas (commits `bfc6367909..0be493e57a`) en el grupo del
paraguas: tablero, paraguas, presentación, fichas de `U1` y `U2`, la ficha nueva de `U3`, y las
issues HOS-1352, HOS-1400, HOS-1401 y HOS-1402. Sin commits ni push. Los HTML quedan en el
scratchpad de la sesión (`pub67-paraguas/`).

## 1. Cifras usadas, recontadas con script

- Decisiones: `rg -o "^### DEC-[A-Z]+-\d+" 01-decision-log.md | sort -u | wc -l` da **144**;
  con `DEC-METH`, **18**; funcionales, **126**. Precisadas sin `SUPERSEDED` 73, `SUPERSEDED` 12 y
  apartamientos 11, según el resumen del log (l.7727 y l.7736).
- Matriz: `python3 contar-filas-de-la-matriz.py` da **117 = 63 · 16 · 24 · 14**; esperan medición
  9 y no se miden 9, 5 de ellas `UNKNOWN`.
- Guards: la columna *guards* de la tabla del §2 de `V/descomposicion.md`, sin lo tachado ni los
  paréntesis en cursiva, da `G19` en `V5` y ningún otro cambio. Con `11-` §7 y `21-` §1, el total
  es **35 = 19 · 15 · 1**.
- Unidades **25** y dependencias entre épicas **12**: de `11-` §7 y `21-` §1, cruzadas con
  `16-` §4.6.

## 2. Qué cambió en cada artifact

### Ficha nueva de `U3`

- URL: <https://claude.ai/artifact/NGgcaALco8MR4FjKe3ozhU>, versión `1790807851-d9f9`, icon
  `script`.
- Es de la familia visual de `U1` y `U2`: mismos tokens, tipografía y secciones. Eyebrow
  «HOS-1402 · unidad U3 del paraguas HOS-1352» y título «El script del corte».
- El contenido sale de `16-` §4.2, *«las herramientas del corte»*, punto 1, de las filas 1a, 1b y 2,
  del párrafo del censo y del manifiesto de sondas, y de §4.6 (la fila y el párrafo de `U3`).
- Tiene link a HOS-1402 en «Dónde vive» y en el pie.

### Tablero · <https://claude.ai/artifact/VvQ3hGSGZC5nr4ZHc5VqPB>

- Versión `1790807938-51cf`.
- Nodo nuevo `U3`: `side:"u"`, `iss:"HOS-1402"`, `deps:["U1"]`, `g:[]`, `off:true` y ficha
  enlazada. Ningún nodo lo tiene en `deps`, así que no bloquea a nadie.
- `V5` suma `G19`.
- El bloque de estado suma `"U3":"pending"`. El hash del resto quedó igual: `c1e6dbbccbe0` antes,
  después y en lo publicado.
- La cabecera pasa a 25 unidades y tres del paraguas, «0 de 25» y «Paraguas 0/3».
- El primer bloque *hold* se reescribe con las FASES 6 y 7 cerradas (`DEC-METH-018`, `DEC-ARCH-016`,
  `U3`) y lo que sigue (`[NOSPEC:epic-ci]`, la rama y `U1`). El bloque de la FASE 5 queda como
  segundo *hold*, sin su frase «falta sólo escribir los *acceptance gates*».
- La sección del paraguas pasa a titularse «sus tres unidades» y suma `U3`. Las dependencias entre
  épicas aclaran que `U3` tampoco suma ninguna.
- El pie dice «FASES 6 y 7 aplicadas».
- Conserva la capacidad `artifact` y el contrato `0.2.52`.

### Paraguas · <https://claude.ai/artifact/WiHhGp54XspK1mwFpHWjRA>

- Versión `1790807990-f11c`.
- La navegación y el pie suman `U3`. El lede pasa a tres unidades y a «gates de aceptación
  escritos».
- La sección «Las unidades del paraguas: U1, U2 y U3» suma un párrafo de `U3` y pasa de 24 a 25
  unidades.
- En la tabla de ramas, la rama nace para recibir el PR de `U1`, con el CI ya encendido por
  `[NOSPEC:epic-ci]`.
- Sección nueva «Cuándo algo se da por bueno»: los cinco momentos de `16-` §4.7 y el checklist
  nuevo en dos partes de `B13`.
- La tabla de decisiones suma `DEC-ARCH-016` y `DEC-METH-018`.
- Estado: la fila «3 y 4» pasa a 25 unidades. La fila «6 y 7 ⬜» se parte en «6 · rewrite/reuse ✅»
  y «7 · estrategia ✅».
- Decisiones de 142 a 144 (126 · 18 · 73), con las dos de las FASES 6 y 7. Tarjetas: 25 unidades
  y 35 guards (19 · 15 · 1).
- «Lo próximo» se reescribe con `[NOSPEC:epic-ci]`, la rama, `U1` y el paralelo `V1`, `B1`, `U2`
  y `U3`.

### Presentación · <https://claude.ai/artifact/QnbPFvMXQKPh1J86eM3JXf>

- Versión `1790808084-6f68`.
- Intro: la tarjeta pasa de 24 a 25 piezas, con tres comunes. «Dónde estamos y qué sigue» dice que
  la estrategia de salida está completa, y los pasos pasan a ser: encender los controles, construir
  empezando por la limpieza, 25 piezas, ensayar sobre una copia de producción y el día del cambio.
- Parte 3 §2: 25 piezas y una subsección nueva, «Y el script del corte (1 pieza)».
- Parte 3 §3: la rama «nace para recibir el primer código, la limpieza». Los controles pasan de 34
  a 35 (19 · 15 · 1) y la viñeta de permisos suma el control 35, el actor de sistema.
- Parte 3 §4, el ensayo: se define como copia de producción con correos reescritos, la imagen vieja
  al arrancar, el script del corte y la parte de pruebas del smoke nuevo, y es verde sin tocar nada
  a mano.
- Parte 3 §6:
  - (b) pasa a ser «La revisión de lo que se conserva: hecha», con 13 · 11 · 1 · 4.
  - (c) pasa a ser «Las condiciones para dar algo por bueno: escritas», con los cinco momentos y el
    smoke nuevo en dos partes.
  - Las ramas nacen con los controles encendidos. «Esto se escribe antes» pasa a «quedó escrito
    antes».
  - El script es la tercera pieza común, y la construcción arranca por el cambio que enciende los
    controles.
- El pie dice «FASES 6 y 7 aplicadas».

### Ficha de `U1` · <https://claude.ai/artifact/DAqq2XU5iLpm3p9Mb9wGNq>

- Versión `1790807898-849b`.
- Navegación y pie con `U3`. El *pull* suma `U3` y el PR `[NOSPEC:epic-ci]`.
- Las unidades pasan de 24 a 25, con tres del paraguas.
- El punto 4 suma un ítem (I): borra los dos guards `check-product-domain-*`, con `package.json`,
  `check:guards` y `ci.yml`, y reescribe el texto del del ternario.
- Párrafo nuevo (B): reapunta la regla de smoke del `CLAUDE.md` raíz.
- Los guards pasan de 34 a 35 (19 · 15 · 1), con `G19` de `V5`; `U2` y `U3` no suman.
- «Está lista cuando» suma el CI completo. «Dependen de ella» suma `U3`.

### Ficha de `U2` · <https://claude.ai/artifact/SSqQ7sSpUXzfiTCUbM8fGb>

- Versión `1790807866-934f`.
- Navegación y pie con `U3`. Las unidades pasan de 24 a 25 (tres del paraguas) y los guards del
  programa de 34 a 35.
- El pie dice «FASE 5 aplicada; cifras al día con las FASES 6 y 7».

## 3. Sin cambios

- **Contrato** · <https://claude.ai/artifact/KgHuCs8uTVEtNeuYfuLLJQ>: el diff
  `bfc6367909..0be493e57a` no toca `12-contrato-de-cobertura.md`, y el artifact no nombra unidades
  del paraguas salvo `U1`, `U2` y el package, que no cambiaron. No se republicó; su pie sigue en
  «FASE 5 aplicada», que para él es cierto.

## 4. Verificación de lo publicado

Releído cada uno con `Artifact read` y `path: index.html`, en las versiones de arriba:

- Paraguas, presentación, `U1`, `U2` y `U3` tienen un solo `<!doctype>`, un `<html>` y un `<body>`.
  El tablero tiene dos de cada uno: el envoltorio y el literal de `save()`.
- El link a la ficha de `U3` aparece en tablero (2), paraguas (3), `U1` (4) y `U2` (2).
- No queda ningún «0 de 24», «34 guards», «24 unidades» ni «FASE 5 aplicada)» en los republicados.
  El «34» que queda en el paraguas es el de las transiciones vivas de la suscripción, que sigue en
  34.

## 5. Linear

Cada issue se tocó con `save_issue` y `patch` anclado sobre un `get_issue` del momento. Releídas en
la respuesta: estado, prioridad, etiquetas, padre y relaciones intactos.

- **HOS-1352**, reescrita por secciones con `replace_range`:
  - El callout: FASES 5, 6 y 7 cerradas, 25 unidades y las tres del paraguas; lo que sigue es
    `[NOSPEC:epic-ci]` y después `U1`.
  - La rama: nace para `U1`, con el CI encendido antes.
  - «La unidad del paraguas: U1» pasa a «Las unidades del paraguas: U1, U2 y U3», con las tres
    fichas.
  - Las decisiones suman `DEC-ARCH-015`, `DEC-ARCH-016` y `DEC-METH-018`. `DEC-MIG-005` se reescribe
    con `DEC-MIG-007`: sale la tabla de 15 filas, el Worker que contestaba `500` y las cuatro
    situaciones, y entra el corte simplificado con sus dos situaciones.
  - La matriz pasa de 61 · 16 · 24 · 16 a 63 · 16 · 24 · 14.
  - Las filas del estado pasan a «5 ✅», «6 ✅» y «7 ✅», y «3 y 4» a 25 unidades.
  - Las cifras pasan de 139 a 144 decisiones (126 · 18 · 73 · 12 · 11), y de 23 unidades y 33 guards
    a 25 y 35.
  - «Qué sigue» es el PR `[NOSPEC:epic-ci]`, la rama con `U1`, el paralelo `V1`, `B1`, `U2` y `U3`,
    y los recordatorios de `V6` y del ensayo.
  - Se agregó la línea de actualización. La etiqueta `status-needs-smoke-prod` ya estaba y no se
    tocó.
- **HOS-1400** (`U1`):
  - El callout nombra las FASES 5, 6 y 7 y el PR `[NOSPEC:epic-ci]`.
  - El punto 4 suma el ítem I, los dos guards y el ternario.
  - Párrafo nuevo con el reapunte de la regla de smoke (B).
  - 25 unidades con `U3`, y 35 guards (19 · 15 · 1) con `G19`.
  - «Está lista cuando» suma el CI. «Dependen de ella» suma `U3` (HOS-1402).
  - Se agregó la línea de actualización.
- **HOS-1401** (`U2`): 25 unidades con `U3`, 35 guards con `G19` y la línea de actualización.
- **HOS-1402** (`U3`): coincidía con el diseño en lo esencial. Se le sumaron:
  - el link a la ficha;
  - en la completitud, que todo id conocido (base y manifiestos de sonda) aparezca en el recorrido
    (§4.2, paso 2);
  - que de la base vieja lee sólo los ids conocidos, que no le escribe a nadie y la excepción de las
    sondas con medición abierta;
  - la línea de actualización.

## 6. Residuos vistos en la fuente (no se editaron)

- `16-` §4.6, fila `U3`, columna *«la unidad está lista cuando…»*: no nombra la condición de los
  ids conocidos que el paso 2 del §4.2 exige al mismo script. La ficha y HOS-1402 siguen a la fila
  en el criterio de «lista» y ponen la condición en «qué deja funcionando».
- `03-handoff.md`, *«Última actualización»*: sigue en la FASE 5 (*«Parar y hablar con el owner
  cómo se sigue»*). Es el F14 de `11-` §7, que queda para el coordinador.
- `16-` §5 se sigue titulando *«Lo que este documento todavía no contesta»* aunque dice
  *«ninguno»*. Ya lo anota `11-` §3.
- La presentación dice *«Y antes de implementar nada, se vuelve a medir la cartera»* (parte 3, §6).
  El handoff lo anota sin fuente viva. La regla más cercana es `01-decision-log.md:81`, *«cualquier
  conteo de producción se vuelve a medir en el momento de usarlo»*. Quedó como estaba.

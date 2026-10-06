---
title: "FASES 6 y 7 · 21 · Verificación ajena de la aplicación A–M"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 7
---

# FASES 6 y 7 · 21 · Verificación ajena de la aplicación

- **Qué es**: la verificación de lo que [`11-aplicacion.md`](./11-aplicacion.md) aplicó al diseño
  con los tres lotes del owner de [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md)
  (A–G, H–J, K–M), contra [`00-propuesta.md`](./00-propuesta.md) y
  [`20-pase-fase-6.md`](./20-pase-fase-6.md). Sobre el working tree del worktree
  `hospeda-spec-hos-1352-billing-redesign`, con los cambios sin commitear (`git diff`, nueve
  archivos del diseño más la carpeta `39-fases-6-y-7/`).
- **Siglas**: `D` = `.specs/HOS-1352-billing-verticals-redesign/docs`, `V/` =
  `.specs/HOS-1353-verticales-capacidades-y-autorizacion`, `B/` =
  `.specs/HOS-1354-billing-cobro-y-proveedor`, `16-` = `D/16-fase-7-del-paraguas.md`.
- **No edita nada**: sólo este informe. Los arreglos propuestos son mecánicos; ninguno elige.
- **Método de las búsquedas**: texto de cada `.md` de las tres specs aplanado a una línea, con lo
  tachado (`~~…~~`, también cuando cruza renglones) reemplazado por blancos antes de buscar, y los
  informes históricos (`D/0[2-9]-`, `D/1[0-5]-`, `D/1[7-9]-…/`, `D/2*-`, `D/3*-`) descartados.

## 1. Cifras, recontadas con script

| cifra | esperada | medida | comando |
|---|---|---|---|
| decisiones | 144 | **144** | `rg -o "^### DEC-[A-Z]+-\d+" D/01-decision-log.md` con `sort -u` y `wc -l` |
| de metodología | 18 | **18** | lo mismo con `DEC-METH`; repetidos, 0 |
| funcionales | 126 | **126** | la diferencia |
| precisadas sin `SUPERSEDED` | 73 | **73** | Python sobre el campo *Estado* de cada bloque (`precisad`, `recontad`, `enmendad`, `cerrad`, sin `SUPERSEDED`); `SUPERSEDED`, 12. Suman `DEC-CI-001` y `DEC-TEST-002`; `DEC-METH-018` y `DEC-ARCH-016`, no |
| guards | 35 = 19 · 15 · 1 | **19 · 15 · 1** | ids de la columna *guards* de las dos tablas del §2 (V l.54-62, B l.127-139), sin lo tachado ni lo entre paréntesis en cursiva, más `G8` de `U1` |
| unidades | 25 | **25** | 9 + 13 + `U1`, `U2`, `U3` |
| dependencias entre épicas | 12 | **12** | filas vivas de `B/descomposicion.md` §2.6: 1-7, 9-12 y 14 |
| matriz | 117 = 63 · 16 · 24 · 14 | **117 = 63 · 16 · 24 · 14** | `python3 contar-filas-de-la-matriz.py` |

Las cifras de los archivos que el registro nombra están bien. Los espejos que no nombra, no: F1 a
F3.

## 2. Hallazgos

Severidad: **BLOQUEA** = un renglón vigente dice lo contrario de lo decidido o una cifra vigente
es falsa; **MENOR** = falta un espejo sin contradicción, un residuo previo o una elección menor
declarada.

### F1 · BLOQUEA · `D/../spec.md:89`, la cifra de decisiones en la tabla de documentos

- **Cita**: *«~~**139 decisiones**~~ **142 decisiones** (al 2026-09-28, … y de la FASE 5,
  `DEC-METH-017`, `DEC-ARCH-015` y `DEC-MIG-007`)»*.
- **Qué vale**: 144. El registro actualizó la cifra de la l.160-163 del mismo archivo y no ésta.
- **Arreglo**: `~~**142 decisiones**~~ **144 decisiones**` y, al final del paréntesis, *«; y de las
  FASES 6 y 7, `DEC-METH-018` y `DEC-ARCH-016`»*.

### F2 · BLOQUEA · `D/nucleo/00-indice.md:44`, la misma cifra en el índice del núcleo

- **Cita**: *«~~**139** al 2026-09-30~~ **142** al 2026-09-30, con las tres de la FASE 5»*.
- **Qué vale**: 144 (145 encabezados con la plantilla).
- **Arreglo**: `~~**142** al 2026-09-30~~ **144** al 2026-09-30, con las dos de las FASES 6 y 7
  —`DEC-METH-018` y `DEC-ARCH-016`— (recontado con script: 145 encabezados menos la plantilla), y
  el 142, con las tres de la FASE 5 …` (el resto como está).

### F3 · BLOQUEA · `V/spec.md:414`, la regla que vale para el catálogo de `V/20` §2

- **Cita**: *«Y la regla que vale para los ~~…~~ ~~veintiuno~~ diecinueve (revisión del owner,
  2026-09-28, N1 y C9)»*.
- **Qué vale**: veintiuno, la cifra que el mismo archivo da en l.66 y l.392. Ya estaba corrida en
  uno antes de este lote (el handoff la anota como residuo, *«diecinueve» por veinte*); con `G19`
  queda corrida en dos, y es el único espejo del catálogo de `V/20` que H no movió.
- **Arreglo**: tachar *diecinueve* y escribir **veintiuno**, con el origen *«(con `G18`: FASE 5,
  lote de la aplicación, E; con `G19`: FASES 6 y 7, pase de la FASE 6, H)»*.

### F4 · BLOQUEA · `D/01-decision-log.md:7084-7085` y `:7098-7099`, `DEC-TEST-003` sigue mandando el recorte que L retiró

- **Cita**, decisión: *«cada sección del checklist de smoke manual que tenga su prueba de punta a
  punta sale del manual»*. Y su 📌 del 2026-09-29 (casos vecinos, caso 32): *«La regla de smoke del
  `CLAUDE.md` raíz se actualiza, en el mismo cambio, a medida que cada sección del checklist sale
  del manual»*.
- **Qué vale**: L retiró el recorte *«por quedar sin sujeto»*, y B pone el reapunte de la regla en
  `U1`, de una vez. El registro tachó el recorte en `B/20` §5.1, `B/descomposicion.md` fila `B13`,
  `16-` §4.7 y `DEC-ARCH-016`, pero no en la decisión de donde sale (`DEC-TEST-003` es la del
  *«checklist… sale del manual»*, y el caso 32 es el mismo que citaba el punto 4 de `B/20` §5.1).
  Hoy el log dice las dos cosas.
- **Arreglo**: un 📌 en `DEC-TEST-003` con *«(FASES 6 y 7, lote de la aplicación, owner
  2026-09-30, L y B)»*: el recorte del checklist viejo se retira por quedar sin sujeto; la regla
  del `CLAUDE.md` raíz la reapunta `U1`, de una vez, al checklist del sistema nuevo de `B13`; y la
  marca en su *Estado*. **No mueve las precisadas**: `DEC-TEST-003` ya está contada (73 se
  queda). Mover la fila *«FASES 6 y 7»* del resumen de ~~3 📌~~ a **4 📌** y sumar `DEC-TEST-003`
  a *Dónde* de `DEC-ARCH-016`.

### F5 · MENOR · `V/spec.md:457` y `B/spec.md:342`, la razón caduca en las dos sub-specs

- **Cita**: *«Qué se reescribe y qué se reutiliza del código actual. Es FASE 5 y tiene su gate
  propio (`DEC-METH-003`)»* (`B/`: *«Es FASE 5, con su gate propio»*).
- **Qué vale**: es la misma frase que D-6 y `DEC-METH-018` punto 5 declaran caduca y que el
  registro tachó en las dos descomposiciones (§6). La conclusión sigue bien; la razón, no.
  `DEC-METH-018` nombra sólo las descomposiciones, así que no es contradicción de la letra, pero la
  frase es la misma.
- **Arreglo**: tachar *«Es FASE 5 y tiene su gate propio»* y remitir a `DEC-METH-018` con la misma
  redacción que el §6 de cada descomposición; en `B/` conservar el *«salvo `qzpay`»*.

### F6 · MENOR · `D/../spec.md:151`, la FASE 8 · 9 pasa a ✅ sin decisión del lote

- **Cita**: *«~~⬜ cada épica la suya, más una final sobre el conjunto~~ ✅ sobre el conjunto, en
  tres vueltas»*.
- **Qué vale**: ninguna letra A–M la toca, y la propuesta (§4.1) sólo manda la fila de las FASES 5,
  6 y 7. El aplicador lo respalda en `D/03-handoff.md` (*«FASE 8 y FASE 9 vuelta 3, cerradas»*) y
  es fiel a los hechos, pero además **reescribe el plan** (*«cada épica la suya»* desaparece). Es
  una elección sin decisión.
- **Arreglo**: devolver la celda a como estaba y llevar el cambio al owner en el próximo lote, o
  que el owner lo ratifique; sin tocar nada más.

### F7 · MENOR · `V/docs/18-partner.md:139-145`, J no llegó al capítulo de Partner

- **Cita**: *«`starts_at` y `ends_at` quedan hasta `V7` … **y `V7` las borra con su migración,
  junto con sus lectores del panel**: FASE 5, lote de la aplicación, segunda tanda, owner
  2026-09-30, O»*.
- **Qué vale**: J pone `partners.tier` y su índice en esa misma migración y pasa sus lectores a la
  clave. Está en `V/descomposicion.md` l.60 y l.639 y en `DEC-METH-018`; el capítulo, que es donde
  vive el espejo del lote O, no lo dice.
- **Arreglo**: sumar *«; **y en la misma migración, `tier` con su índice, y sus lectores —la
  página pública y las tres rutas del socio— pasan a leer la clave**: FASES 6 y 7, pase de la FASE
  6, owner 2026-09-30, J»* después de la cita del lote O; `updated` al 2026-09-30.

### F8 · MENOR · `B/docs/20-testing.md:391`, *«los 16 que ya la tenían»* lista 17

- **Cita**: *«más los ~~**15**~~ **16** … que ya la tenían — `G1` `G3` … **y `G18` (`V1`** …) **y
  `G19` (`V5`** …)»*.
- **Qué vale**: la lista tiene 17 ids con `G19` (16 sin él). La suma de la fila (3 + 17 + 13 +
  `G-R2-C` + `G-R9` = 35) cierra sólo con 17.
- **Arreglo**: `~~**16**~~ **17**`, o sacar `G19` de esa lista y sumarlo junto a `G15`-`G17` como
  *«que nacen con unidad»*; la primera es la mecánica.

### F9 · MENOR · `V/docs/20-testing.md:373-378`, el gate de épica sin `codeql`

- **Cita**: *«el PR final de la épica no se abre sin `e2e-pr`, `lighthouse` y `a11y-sweep` con
  `success` fechado después del último merge»*.
- **Qué vale**: D-3 y `16-` §4.7, momento 2, nombran cuatro: `e2e-pr`, `codeql`, `lighthouse` y
  `a11y-sweep`.
- **Arreglo**: sumar `codeql` a la lista.

### F10 · MENOR · `D/01-decision-log.md:7381`, los punteros ordinales del *Estado* de `DEC-ARCH-014`

- **Cita**: lote P, *«ver su antepenúltimo 📌»*; lotes 1 y 2, *«ver su penúltimo 📌»*; lote C,
  *«ver su ~~último~~ antepenúltimo 📌»*; lote de la aplicación H y E, *«ver su ~~último~~
  penúltimo 📌»*.
- **Qué vale**: los 📌 están en este orden (l.7416, 7430, 7442, 7470, 7477, 7486): O, P, lotes 1-2,
  C, H y E, F. C y H-E quedaron bien; P es el segundo y lotes 1-2 el tercero, y ya estaban mal
  antes de este lote (el registro lo anota en su §3). Ahora hay dos *«antepenúltimo»* y dos
  *«penúltimo»* en el mismo campo. Además el *Estado* nombra sólo la letra F, y el mismo 📌 lleva
  también K.
- **Arreglo**: nombrar cada 📌 por su lote en vez de por ordinal (*«ver su 📌 del lote P»*, …) y
  sumar *«y K del lote de la aplicación»* a la mención de F.

### F11 · MENOR · `D/../spec.md:188-191`, la tarea de cierre no nombra su disparador

- **Cita**: *«**Es una tarea del cierre del programa, no de ahora** … Al cerrar HOS-1352:»*.
- **Qué vale**: E fija el disparador (primer cobro real de una cuenta suscripta después del corte
  y siete días de barrido sin divergencia sin explicar; revisión a los 30 días). Está en `16-`
  §4.7, momento 5, que apunta acá; la sección apuntada no apunta de vuelta.
- **Arreglo**: una línea después de la primera oración: *«Corre cuando el programa se da por
  aceptado (`docs/16-fase-7-del-paraguas.md` §4.7, momento 5; FASES 6 y 7, owner 2026-09-30,
  E)»*.

### F12 · MENOR · I y J quedaron sólo en el campo *«Resultado del pase»* de `DEC-METH-018`

- **Dónde**: `D/01-decision-log.md:7575-7590`.
- **Qué vale**: I agranda la lista de `U1`, que gobiernan los 📌 de `DEC-ARCH-014`; J agranda la
  migración de `V7` que fijó el 📌 del lote O de `DEC-ENT-006`. Ninguna de las dos decisiones lo
  ve. La elección de no poner 📌 en `DEC-METH-018` está justificada (M fijó 73 y un 📌 ahí daría
  74), pero no alcanza a estas dos: **ya están contadas, así que un 📌 en cada una no mueve 73**.
  Es una elección del aplicador, declarada a medias.
- **Arreglo**: un 📌 en `DEC-ARCH-014` (I) y otro en `DEC-ENT-006` (J), cada uno con la marca en
  su *Estado*; la fila *«FASES 6 y 7»* del resumen suma los dos. Si el owner prefiere no
  agregarlos, basta con escribir en `11-aplicacion.md` §5 que se eligió así.

### F13 · MENOR · `B/descomposicion.md:420`, *«trece filas `UNKNOWN`»*

- **Qué vale**: la matriz tiene 14 `UNKNOWN`, 9 que esperan medición. Es previo a este lote (el
  registro lo anota), pero la regla nueva de D quedó escrita debajo de ese encabezado.
- **Arreglo**: el recuento del §2.7 con el script, y el encabezado con la cifra que dé.

### F14 · MENOR · `D/03-handoff.md:50-60`, el *«próximo paso»* vigente quedó atrás

- **Cita**: *«La implementación arranca por `U1`»* y el residuo *«`spec.md:146` (FASE 5 todavía
  ⬜)»*.
- **Qué vale**: con A, antes de `U1` va el PR `[NOSPEC:epic-ci]` a `staging`; y la FASE 5 ya está
  ✅. El handoff no está en el alcance de la aplicación (se escribe al cerrar la sesión), así que no
  es un error del aplicador; lo anoto para que el handoff de cierre lo recoja.
- **Arreglo**: en el handoff de cierre de esta sesión.

## 3. Lo que se verificó y está bien

- **A–G**: cada una en todos los lugares que nombra el §4 de la propuesta, más `16-` §2 (D-1) y los
  §4 de las dos descomposiciones (D-2). El PR `[NOSPEC:epic-ci]` sin `HOS-1352` (A), el checklist
  en dos partes con el 5c y los tres viejos restaurados (B), la copia de producción que se borra
  (C), la regla `UNKNOWN` en `B/descomposicion.md` §2.7, `B/20` §4.1 y `16-` §4.7 (D), el cierre a
  los siete días con revisión a los 30 (E), `U3` con 25 unidades en todos sus espejos (F) y
  `DEC-METH-018` con sus cinco puntos (G). Los agregados propios están marcados *«lo derivé y lo
  marco»* (`16-` §4.6 sobre a qué apunta la regla; `16-` §4.2, fila 5c; `16-` §4.7, el smoke), y
  sus citas existen: `38-fase-5/20-simplificacion-del-corte.md` §13 (*«Quedan 8»*, l.240), el
  congelamiento de `16-` §4.4 (l.630) y el valor armado sin escribir la palabra de `16-` §4.2
  (l.374).
- **H**: `V/17` §3.3 (las cuatro capas), `V/descomposicion.md` V5 §2 y §4, `G19` en `V/20` §2 con
  el predicado de la opción 1 del pase (`_isSystemActor` o `Object.values(PermissionEnum)` fuera de
  la fábrica) y los cinco espejos del conteo. Ningún renglón vigente del diseño da al actor de
  sistema como `SUPER_ADMIN`.
- **I**: `16-` §4.6 punto 4 y el párrafo *«Antes de la primera fila»*; `V1` en §2 y §4; `G1` en
  `V/20`. `DEC-METH-005` (`HOS-1079`) no lo contradice.
- **K**: `16-` §4.6 fila y párrafo de `U3`, las filas *«`U3`, fuera del grafo»* de las dos
  descomposiciones y el 📌 F de `DEC-ARCH-014`.
- **L**: tachado con su origen en `B/20` §5.1, `B/descomposicion.md` fila `B13`, `16-` §4.7 y
  `DEC-ARCH-016`. Falta la decisión madre: F4.
- **M**: los dos 📌 con su *Estado*; la fila de precisadas en 73 con su nota.
- **`status-needs-smoke-*`**: sólo en `HOS-1352` en los cuatro lugares que lo dicen; ninguno lo
  contradice.
- **markdownlint**: los nueve archivos del diff y los cuatro de `39-fases-6-y-7/`, 0 issues.

## 4. `AUT-113`, la unidad del permiso de moderación

**Veredicto: se deriva sin elegir. La unidad es la primera de `V6` y `V7` que llegue, y la otra le
agrega su sujeto al mismo permiso.**

Por qué se deriva:

1. **Quién declara un permiso ya está escrito**: `AUT-001` (KEEP) fija la unidad *«cada unidad que
   construye una acción; el patrón, `V5`»* (`20-pase-fase-6.md:126`). La pregunta es entonces quién
   construye la acción 13, y no quién declara el permiso.
2. **Quién construye la acción 13 ya está escrito**: *«`PB10`/`PB11` (la ficha, **V6**) y el bit
   de la presencia (**V7**) los escribe **la misma** acción administrativa del `NUCLEO/08` §3, y V6
   y V7 corren en paralelo después de V5. **La construye la primera de las dos que llegue, con su
   sujeto; la segunda le agrega el suyo.**»* (`V/descomposicion.md:436-441`). Lo confirman las
   filas de las dos unidades (`V/descomposicion.md:59`, *«`MODERATED`, con `PB10` y `PB11` —la
   acción administrativa de moderar»*; `:60`, *«el bit de moderación y su escritura por la acción
   administrativa de moderar, la misma de `PB10`/`PB11`»*), la tabla de acciones
   (`D/nucleo/08-auditoria-y-observabilidad.md:227`, *«sobre una ficha o sobre la presencia de un
   Partner, que es la misma acción con el mismo permiso»*) y el propio informe de la FASE 5, que
   ya le ponía `V6`, `V7` (`D/38-fase-5/01-permisos-y-roles.md:267`).
3. **Lo que la acción reemplaza también se reparte solo**: `COMMERCE_MODERATION_CHANGE` sale con
   `U1` (es uno de los siete `commerce.*`); `ACCOMMODATION_MODERATION_CHANGE`, con las rutas de
   ficha que rehace `V6`; `PARTNER_MANAGE` en `routes/partners/admin/revoke.ts`, con la escritura
   del bit que construye `V7`. *(Este punto lo derivo y lo marco: el diseño no nombra los tres
   permisos viejos en las filas de las unidades.)*

**Una corrección de texto, no de unidad**: el pase escribe *«un permiso con dos niveles para ficha
y presencia»* (`20-pase-fase-6.md:177`). El 📌 de `DEC-DATA-007` dice lo contrario en lo de los
niveles: *«Los dos niveles valen sólo para fichas: la presencia de Partner conserva su bit sin
niveles»*. El permiso es uno para los dos sujetos; los niveles, sólo en la ficha. Al aplicarlo,
escribir eso y no la frase del pase.

**Aplicación propuesta**, como los `ADAPT` que no volvieron (G: *«lo que no vuelve al owner se
aplica»*):

- `V/descomposicion.md` §2, filas `V6` y `V7`: *«**y el permiso propio de la acción 13, uno solo
  para la ficha y la presencia, que declara la primera de `V6` y `V7` que llegue (§2.10); los dos
  niveles, sólo en la ficha** (`AUT-113`) (FASES 6 y 7, pase de la FASE 6, owner 2026-09-30, G:
  lo que no vuelve al owner se aplica; `39-fases-6-y-7/20-pase-fase-6.md`)»*.
- `V/descomposicion.md` §4, filas `V6` y `V7`: *«moderar una ficha y moderar la presencia piden el
  mismo permiso, y ninguna ruta de moderación lee `ACCOMMODATION_MODERATION_CHANGE` ni
  `PARTNER_MANAGE`»*, cada una con su mitad.
- `11-aplicacion.md` §5, tabla de los `ADAPT` que no volvieron: la fila de `AUT-113`, y sacar el
  *«residuo sin unidad»* del final.

## Resumen

**14 hallazgos: 4 BLOQUEA (F1-F4) y 10 MENOR (F5-F14).** Los cuatro que bloquean tienen arreglo
mecánico y ninguno pide una decisión nueva: tres cifras en espejos que el registro no nombró
(`spec.md:89`, `nucleo/00-indice.md:44`, `V/spec.md:414`) y un 📌 en `DEC-TEST-003` que baje L y
B a la decisión de donde sale el recorte, sin mover las 73 precisadas. `AUT-113` se deriva: `V6` y
`V7`, la primera que llegue.

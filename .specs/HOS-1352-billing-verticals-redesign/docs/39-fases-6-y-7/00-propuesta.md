---
title: "FASES 6 y 7 · 00 · Propuesta de cierre: rewrite/reuse y acceptance gates"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 7
---

# FASES 6 y 7 · 00 · Propuesta de cierre

- **Qué es**: el trabajo para cerrar formalmente las dos fases que la tabla de estado de la spec
  todavía muestra abiertas (`spec.md:146`, *«FASE 5 · gap analysis · FASE 6 · rewrite/reuse ·
  FASE 7 · estrategia | ⬜ se parten limpio»*): la FASE 6 entera y el único ítem que le queda a la
  FASE 7 del paraguas, `acceptance gates` (`16-fase-7-del-paraguas.md:843-848`).
- **No decide nada ni edita nada**: el PDR, el log, la matriz y el diseño quedan como están. Lo que
  hay que decidir va en el §3, en lote; lo que se escribiría con las recomendadas, en el §4.
- **Siglas**: `D` = `.specs/HOS-1352-billing-verticals-redesign/docs`, `V/` =
  `.specs/HOS-1353-verticales-capacidades-y-autorizacion`, `B/` =
  `.specs/HOS-1354-billing-cobro-y-proveedor`, `16-` = `D/16-fase-7-del-paraguas.md`, `F5/` =
  `D/38-fase-5/`. Las citas `archivo:línea` son sobre la rama `spec/HOS-1352-billing-verticals-redesign`
  en `bfc6367909`; las de código, sobre `origin/staging` en `73ef18f475`.
- **Conteos**: la matriz con `contar-filas-de-la-matriz.py` (117 filas: 63 `VERIFIED` · 16
  `PARTIALLY_SUPPORTED` · 24 `NOT_SUPPORTED` · 14 `UNKNOWN`; 9 esperan medición); las piezas de la
  FASE 5 con `rg -c` sobre los informes (§1.3).

---

## 1. FASE 6 · rewrite/reuse

### 1.1 Qué pide el PDR

`D/00-PDR.md:2506-2524`, entera: *«NO buscar maximizar reutilización. Buscar maximizar: claridad;
consistencia; mantenibilidad; corrección; testabilidad»*, y *«ante duda razonable entre seguir
refactorizando una pieza problemática y reescribirla limpiamente, preferir reescribir. No debemos
terminar otra vez con una mitad vieja y una mitad nueva.»*

No pide un entregable distinto del de la FASE 5: pide **un criterio de desempate** sobre la
clasificación que la FASE 5 produce (`KEEP · ADAPT · REWRITE · DELETE · MISSING`,
`D/00-PDR.md:2466-2504`), inclinado a `REWRITE`, con la carga de prueba del lado de conservar
(`D/00-PDR.md:139-173`, §2).

### 1.2 Qué la cubre ya

| lo que pide la FASE 6 | dónde quedó cubierto | cita |
|---|---|---|
| no quedar con *«una mitad vieja y una mitad nueva»* en el cobro | todo el sistema viejo sale de la rama al principio, antes de construir el nuevo | `DEC-ARCH-014` (log l.7363); `16-:657-731` |
| la decisión sobre el cobro viejo, pieza por pieza | se lista como `DELETE` citando el lote N, sin rediscutir | `DEC-METH-017` punto 1 (log l.6232-6233); `F5/05-lo-que-borra-u1.md`; `F5/00-consolidado.md:493-495` (§5.2, 42 piezas) |
| la plantilla del PDR aplicada donde tiene sentido | *«se aplica sólo a lo que el diseño conserva de fuera del billing viejo»* | `DEC-METH-017` punto 3 (log l.6238-6239) |
| la trampa del Eje 2 (todo a `REWRITE` por no ser genérico) | se exime de *«genérico»* y *«usable por todas»* al comportamiento que vive en el módulo de su vertical | `DEC-METH-017` punto 4 (log l.6240-6243) |
| `qzpay` | se absorbe, queda sólo como referencia de lectura | `DEC-ARCH-004`; `B/descomposicion.md:905-907` |
| API, rutas y crons que se conservan | **KEEP** factories con `ResponseFactory`, revalidación con `@repo/cache-tags`, `@repo/logger`, día de mercado de `@repo/utils`; **ADAPT** raíz de composición e infraestructura de crons; ninguna sale `REWRITE`, y lo que habría que reescribir (el outbox) el diseño lo da por nuevo | `F5/03-api-rutas-y-crons.md:38-43` |
| web, admin y Eje 2 que se conservan | tabla con veredicto y condición que decide, nueve piezas | `F5/04-web-admin-y-eje-2.md:173-188` (§7) |

**La hipótesis se confirma en su mayor parte**: la FASE 6 no es un documento que falte, porque
`DEC-METH-017` metió su criterio dentro de la FASE 5 y `DEC-ARCH-014` le sacó de encima el caso
que la motivaba (el cobro viejo, que ya no se reutiliza en nada). Y las dos descomposiciones ya la
remiten a la FASE 5: *«Qué se reescribe y qué se reutiliza. Es FASE 5»* (`V/descomposicion.md:662`,
`B/descomposicion.md:905`).

### 1.3 Qué NO está cubierto

**Uno: dos de los cinco informes de la FASE 5 no aplicaron la plantilla a lo que conservan.**
`DEC-METH-017` punto 3 la exige sobre lo que el diseño conserva de fuera del cobro viejo, y el punto
5 (con `DEC-METH-003` implicación 4, log l.135) exige argumento escrito para toda clasificación. Los
informes 03 y 04 lo hicieron (arriba). Los informes 01 y 02 clasificaron sólo en las cuatro
categorías del punto 2 (confirma, contradice, falta, adaptar), con argumento, y **no dieron el
veredicto `KEEP`/`ADAPT`/`REWRITE`** a ninguna de las piezas que conservan. Contado con script:

| informe | piezas `CONFIRMA`/`ADAPTAR` (lo que se conserva) | apariciones de `KEEP` o `REWRITE` |
|---|---|---|
| `F5/01-permisos-y-roles.md` | 14 (`AUT-001`, 002, 003, 004, 005, 007, 008, 010, 014, 015, 018, 019, 026, 027) | 0 |
| `F5/02-base-de-datos.md` | 15 (`BD-006`, 008, 009, 010, 012, 013, 014, 018, 024, 025, 026, 030, 031, 032, 033) | 0 |
| `F5/03-api-rutas-y-crons.md` | (aplicada) | 10 |
| `F5/04-web-admin-y-eje-2.md` | (aplicada) | 4 |

No es una formalidad: **ahí está exactamente la pregunta de la FASE 6**. El mecanismo de
autorización se conserva con tres piezas `ADAPTAR` de severidad ALTA (`AUT-003`, nada impide dar
suelto un permiso *«sólo `SUPER_ADMIN`»*; `AUT-004`, un `ADMIN` puede asignarse `SUPER_ADMIN`;
`AUT-005`, el actor de sistema es un `SUPER_ADMIN` con todos los permisos;
`F5/01-permisos-y-roles.md:51`, `:62`, `:74`). Cuando una pieza que se conserva necesita tres
arreglos ALTA en su núcleo, *«ante duda razonable, preferir reescribir»* es una pregunta que alguien
tiene que contestar con argumento, y nadie la contestó.

**Dos: tres guards del repo quedaron sin destino.** El inventario de guards de la FASE 9 dejó a
propósito para la FASE 6 *«qué hacer con el script (borrarlo, archivarlo, dejarlo como
documentación histórica)»* de los siete `MUERE` (`D/15-fase-9/04-inventario-de-guards.md:185`).
La FASE 5 le dio destino `DELETE` en `U1` a cuatro de los siete y a los seis `REVISAR`
(`F5-U1-018`, `F5/05-lo-que-borra-u1.md:146-150`). **Tres no están en ninguna lista**:

| guard | qué pasa si nadie lo toca | observación |
|---|---|---|
| `check-product-domain-vocabulary.sh` | después de `U1` no queda ningún `productDomain`; el script saltea los directorios que no existen (`if [ ! -d "$dir" ]; then continue`) y sale 0 **sobre nada** | un guard que no puede fallar, que es lo que el programa prohíbe (`B/descomposicion.md:790-791`) |
| `check-product-domain-raw-sql.sh` | ídem, con `product_domain` | ídem |
| `check-no-binary-vertical-ternary.sh` | sigue vivo: recorre `apps/api/src` buscando `=== 'gastronomy' ? … : …`, una forma que el modelo nuevo también puede escribir | el inventario lo da `MUERE` (ancla en `ProductDomainEnum`), pero la FASE 9 lo cita como **la defensa estática que ya existe** contra la duplicación por vertical (`D/15-fase-9/01-R6-resuelto.md:844-849`). Las dos lecturas nunca se reconciliaron |

Los tres corren hoy en `ci.yml` (`origin/staging:.github/workflows/ci.yml:290`, `:292`, `:331`).

**Tres, una razón caduca**: las dos descomposiciones dicen *«Es FASE 5 y tiene su gate propio»*
(`V/descomposicion.md:662`, `B/descomposicion.md:905`). La conclusión sigue bien (no la decide la
descomposición), pero la razón quedó a medias: la FASE 5 ya pasó y no cubrió 01 y 02.

### 1.4 Veredicto

**Cerrada por absorción, con un faltante acotado.** La FASE 6 vive dentro de la FASE 5 por
`DEC-METH-017` y el cobro viejo la esquiva por `DEC-ARCH-014`. **Falta un pase corto**: el
veredicto `KEEP`/`ADAPT`/`REWRITE` con argumento sobre **29 piezas** de 01 y 02 (de las que las que
pesan son el núcleo de autorización y los mecanismos de base que el diseño da por buenos) y el
destino de **3 guards** del repo. Es trabajo de un agente sobre dos informes que ya existen, no una
fase nueva. **No bloquea `U1`**: `U1` borra y no toca ninguna de esas piezas, salvo los tres guards
si el pase los manda a su lista. Cuándo se hace es la pregunta **G** del §3.

---

## 2. FASE 7 · acceptance gates

### 2.1 Qué es, y qué significa «antes de que nazca la rama»

El PDR lo nombra y no lo define: *«Definir: … acceptance gates. Todavía no implementar hasta
aprobación.»* (`D/00-PDR.md:2528-2543`). En este programa, un **gate de aceptación** es el momento
en que algo se da por bueno y el trabajo siguiente puede apoyarse en él, con una condición que
alguien de afuera puede comprobar. Hay cinco momentos:

1. **por unidad**: una de las 24 unidades se da por terminada;
2. **por épica, antes del PR final**: la rama del paraguas se da por lista para entrar a `staging`;
3. **antes del ensayo del corte**: `staging` tiene el sistema nuevo y se ensaya el corte;
4. **antes del corte real**: se arranca el paso 1 en producción, que es irreversible;
5. **después del corte**: el programa se da por aceptado y `HOS-1352` se cierra.

**«La rama» es `epic/HOS-1352-verticales-billing`**, la rama de integración del paraguas:
*«Existe una rama de integración del paraguas — `epic/HOS-1352-verticales-billing` — que nace
cuando exista el primer código, no antes»* (`DEC-ARCH-007` punto 1, log l.2594-2595; `spec.md:48`).
El primer código es `U1`: *«Ninguna otra unidad de las dos épicas arranca antes de que esta limpieza
esté mergeada en la rama del paraguas»* (`16-:757-758`). El plazo del §2 de `16-` (*«Se escribe
ANTES de que nazca la rama del paraguas»*, `16-:69`) vence, entonces, **cuando se crea
`epic/HOS-1352-verticales-billing` para recibir el PR de `U1`**. Medido hoy:
`git ls-remote --heads origin 'epic/*'` devuelve **0**. La ventana está abierta.

### 2.2 Qué existe para cada momento, y qué falta

#### Momento 1 · por unidad

**Existe, y es fuerte**:

- el *«la unidad está lista cuando…»* de cada una (`V/descomposicion.md:618-628`,
  `B/descomposicion.md:842-856`, y la fila `U1` en `16-:775`);
- *«una unidad no está terminada mientras algún guard de su columna … no esté escrito y no tenga su
  caso que lo hace fallar a propósito»* (`V/descomposicion.md:576-578`, `B/descomposicion.md:788-791`);
- el criterio de los escritores declarados (`DEC-TEST-002`, log l.5258;
  `V/descomposicion.md:607-616`);
- la regla de enchufado de cada guard en `pnpm check:guards` y en el job `guards` de `ci.yml`
  (`C-5`, `D/15-fase-9/01-R6-resuelto.md:180-192`);
- *«una unidad que reemplaza un flujo de billing adapta sus e2e en el mismo PR»*
  (`D/15-fase-9/01-R6-resuelto.md:859-860`);
- las filas que se miden **antes de construir** la unidad que las lee: `EX-44`, `EX-45` y `EX-47`
  antes de `B11`, `EX-58` antes de `B6` (`B/descomposicion.md:450-452`).

**Falta**:

- **el CI que lo compruebe no corre en la rama.** `DEC-CI-001` (log l.2719) decidió que `ci.yml`,
  `e2e-pr.yml`, `validate-pr-title.yml`, `validate-docs.yml` y `codeql.yml` corran en `epic/**`, y
  el guard de destino `check-umbrella-branch-target.sh`. **No está aplicado** (log l.2759; tabla
  `C-1` a `C-8` en `D/15-fase-9/01-R6-resuelto.md:813-826`), y medido hoy `ci.yml` de
  `origin/staging` sólo dispara hacia `main` y `staging` (líneas 14-24) y el guard de destino no
  existe. **Sin eso, el PR de `U1` entra a la rama sin lint, typecheck, tests ni guards**, y *«la
  rama sigue compilando»* (`16-:746`) no lo comprueba nadie. `DEC-CI-001` deja la aplicación al
  owner. Pregunta **A**;
- **qué hace una fila `UNKNOWN` con la terminación de una unidad** no está escrito:
  *«Si el §61 exige tenerlas cerradas antes de declarar terminada B7 no está escrito en ninguna
  decisión, y no se decide acá»* (`B/descomposicion.md:463-464`). Pregunta **D**;
- **el estado en Linear de una unidad terminada** no está escrito. Se deriva (§2.3, D-2).

#### Momento 2 · por épica, antes del PR final

**Existe**:

- *«"Terminada" … significa lista y verificada contra el contrato»* (`DEC-ARCH-007`
  implicación 1; `B/spec.md:301`);
- `B4` corre el juego de casos contra las dos implementaciones del contrato
  (`B/descomposicion.md:847`);
- la revisión ocurre en los PRs de sub-épica hacia el paraguas, no en el final (`V/spec.md:379-380`);
- el `e2e-pr.yml` y la obligación de correr por `workflow_dispatch` `lighthouse.yml` y
  `a11y-sweep.yml` sobre el paraguas antes del PR final (`D/15-fase-9/01-R6-resuelto.md:727-733`,
  chequeo 7);
- la revisión final de diseño sobre el conjunto (`spec.md:147`), ya hecha (FASE 8 vuelta 3).

**Falta**: juntarlo en **una** lista con nombre, porque hoy está en cuatro documentos y ninguno
dice *«el PR final no se abre hasta…»*. Es derivable, no es elección (§2.3, D-3).

#### Momento 3 · antes del ensayo del corte

**Existe**: el ensayo es el paso 0 (`16-:131`); las dos situaciones que una restauración no deshace
*«se releen antes del ensayo»* (`16-:584-588`); los plazos sin valor los fija el owner antes del
merge de `V6` (`16-:137`); `EX-49` se mide en el paso 0 (`16-:131`).

**Falta**:

- **qué es un ensayo «verde»**, y **sobre qué datos corre**. `16-:131` dice *«el despliegue ensayado
  entero en `staging` y verde»*, y ningún documento dice con qué base, ni qué cuenta como verde
  (búsqueda de *«ensay»* en `V/21`, `B/21`, `nucleo/` y el log: sólo aparece como condición, nunca
  definido). Pregunta **C**;
- **quién construye el script del corte.** `16-:331-361` lo describe (censo, cancelación, relectura,
  completitud, manifiesto; en `scripts/cutover/`) y dice *«Es de esta FASE 7 del paraguas y va con
  la fecha del §2»*, pero **ninguna de las 24 unidades lo construye** (las otras herramientas del
  corte sí tienen unidad: `V6` y `B9`, `16-:375-397`). Pregunta **F**.

#### Momento 4 · antes del corte real

**Existe, y está simplificado**: los **8 gates** que quedaron después de la simplificación del corte
(`F5/20-simplificacion-del-corte.md:235-241`): el ensayo, la lista del seudónimo, el 0b verificado,
la relectura, la completitud, el journal, el 3a y el 4b. El punto de no retorno está ubicado entre
el paso 2 y el paso 3 (`16-:489-490`).

**Falta**: **el smoke manual de billing que el repositorio exige no tiene instrumento para este
programa.** Es `F-8cC2-005` (ALTA, `D/18-fase-8-bis-2/C2-liberacion-coexistencia-y-migracion.md:397`),
marcado *«[repo, no diseño]»* en cuatro pasadas y **nunca resuelto**:

- el `CLAUDE.md` raíz exige el smoke manual de staging a todo PR de billing y el de producción a
  todo cambio del *billing CORE* (`CLAUDE.md:552-564`), con tres checklists en
  `.qtm/specs/SPEC-143-billing-testing-coverage/`;
- esos tres archivos existen en `origin/staging` y **esta rama de spec ya los borró**
  (`471a54b7a`, *«borrar todo el material de billing previo al PDR»*, que no está en `staging`);
  cuando el PR de la spec entre a `staging`, el sistema viejo, que cobra hasta el corte, se queda
  sin el instrumento de su propio gate;
- `U1` borra `.qtm/` entero (`DEC-ARCH-012`, 📌 del 29/09);
- el nivel de producción es **insatisfacible por construcción** para un reemplazo: pide observar en
  producción, antes de promover, algo que sólo existe después de promover;
- y el recorte del checklist que hace `B13` (`B/docs/20-testing.md:752-758`) recorta **el del
  sistema viejo**; nadie escribe el del nuevo, aunque el mismo capítulo lista lo que *«queda manual,
  porque no se puede simular»*: el checkout real, los correos del proveedor, el borde y los horarios
  reales (`B/docs/20-testing.md:760-766`).

Pregunta **B**.

#### Momento 5 · después del corte

**Existe**: el paso 6 y la foto (`16-:145`); la tarea de cierre del programa (`spec.md`, *«Al cerrar
HOS-1352»*); la batería mensual en producción (`DEC-TEST-003`, log l.7053); el mecanismo de
etiquetas `status-needs-smoke-*` del repo (`CLAUDE.md`, *«Smoke-gate labels for any spec»*).

**Falta**: **cuándo se da por aceptado el programa**. Nada dice qué observación retira la etiqueta
de smoke de `HOS-1352` ni cuándo corre la tarea de cierre, que saca los informes del repositorio y
reescribe el diseño sin tachados. Pregunta **E**.

### 2.3 Lo derivable, que se propone y no se pregunta

- **D-1 · «la rama»** es `epic/HOS-1352-verticales-billing` y nace para recibir `U1` (§2.1).
- **D-2 · el gate por unidad, completo**: los criterios del §4 de su descomposición (o la fila de
  `16-:775` para `U1`); sus guards escritos, enchufados en los dos lugares y rotos a propósito
  contra el job; `DEC-TEST-002`; sus e2e adaptados en el mismo PR; el PR hacia la rama con `CI Pass`
  concluido en `SUCCESS` sobre el rollup completo; y una revisión de contexto fresco antes del
  merge (regla del repo). **En Linear, la unidad pasa a `Done` al mergearse en la rama del
  paraguas**: es lo que `DEC-ARCH-007` implicación 1 llama *«terminada»*, y la automatización nativa
  de Linear lo hace sola con el `[HOS-N]` del título. **Las etiquetas `status-needs-smoke-*` van
  sólo en `HOS-1352`**, nunca en las unidades: si no, 24 issues quedan meses en *In Review* con una
  etiqueta que nadie va a retirar, que es el caso de los 220 que el `CLAUDE.md` describe.
- **D-3 · el gate de épica, antes del PR final a `staging`**: las 24 unidades en `Done`; `staging`
  mergeado hacia el paraguas y verde en su último `push`; `e2e-pr`, `codeql`, y `lighthouse` y
  `a11y-sweep` por `workflow_dispatch` con conclusión `success` fechada después del último merge al
  paraguas (chequeo 7); y el merge lo decide el owner, como todo merge a `staging`.
- **D-4 · el gate antes del corte real**: los 8 de `F5/20-…:240-241`, con el ensayo definido como lo
  diga la pregunta **C** y el smoke de staging, si la pregunta **B** lo pone, adentro del ensayo.
- **D-5 · qué es «verde» en el ensayo**, cualquiera sea la base: el ensayo arranca con la **imagen
  vieja** desplegada en `staging` (si no, no se ensaya el apagado del viejo ni el acto de migrar), y
  es verde cuando **cada verificación que el §4.2 ya nombra pasó, en su orden, sin tocar nada a
  mano fuera de lo que el paso dice**; cualquier intervención no escrita lo vuelve rojo y se
  escribe antes del reintento.
- **D-6 · la razón caduca de las descomposiciones** (§1.3, tres) apunta a este documento y a la
  decisión que cierre la FASE 6.

---

## 3. Preguntas al owner

Siete, en lote. Filtradas contra `DEC-MIG-007` (*«Las premisas del corte»*: sin convivencia, cinco
cuentas, avisa el owner por privado): ninguna reabre un caso del corte que esas premisas descartan.

### A · Cuándo se enciende el CI en la rama del paraguas

**El problema**: `DEC-CI-001` (*«`epic/**` es tipo de rama»*) decidió que el CI corra en la rama del
paraguas, y dejó para vos cuándo se aplica. Hoy no está aplicado, así que el primer PR del programa
(`U1`, el borrado del cobro viejo) entraría sin lint, typecheck, tests ni guards.

1. **Un PR chico a `staging` antes de crear la rama** (los cambios `C-1` a `C-8`, más el guard de
   destino). Costo: unas veinte líneas en cinco workflows y un script, con su propio CI. Riesgo:
   bajo; el merge periódico de `staging` hacia el paraguas va a ser ruidoso en los dos jobs que
   miran el diff, y eso ya está declarado. El título lleva `[NOSPEC:epic-ci]` y no `HOS-1352`, para
   que la automatización de Linear no cierre el paraguas al mergear. **(Recomendada)**: la rama nace
   de `staging` con el disparador ya puesto, y el PR de `U1` es el primero que corre CI completo.
   Es lo que pide el propio recorrido de la FASE 9 (`D/15-fase-9/01-R6-resuelto.md:611`).
2. **Como primer commit de la rama, antes del PR de `U1`**. Costo: el mismo. Riesgo: ese commit no
   pasa por CI ni por revisión, y el guard que impide que una rama del paraguas apunte a `staging`
   vive sólo adentro del paraguas, así que en `staging` no frena nada.
3. **Adentro del PR de `U1`**. Costo: ninguno extra. Riesgo: el PR más grande del programa (unos
   1229 archivos) se valida con un disparador que trae él mismo, y no medí si GitHub lo toma de la
   rama base o del PR.

**Con Juan**: `U1` saca los gates de plan de las rutas donde Juan edita su alojamiento. Si un import
queda colgado, con la 1 el PR de `U1` queda rojo y no entra; con la 3 puede entrar sin haber corrido
nada, y `V1` y `B1` arrancan sobre una rama que no compila.

### B · El smoke manual del cobro nuevo

**El problema**: el repositorio exige smoke manual de staging y de producción a todo cambio de
billing, con tres checklists que esta rama de spec ya borró y que `U1` borra con `.qtm/`; y los
checklists describen el sistema viejo. Para el sistema nuevo no hay smoke escrito (`F-8cC2-005`,
*«la rama borró los checklists»*, ALTA, nunca resuelto).

1. **Un checklist nuevo, del sistema nuevo, en dos partes**: la de `staging` se ejecuta dentro del
   ensayo del corte; la de producción, después del paso 5, con la tarjeta del owner y un monto
   aprobado de antemano: un checkout real por la página de la aplicación, su devolución, el correo
   que manda Mercado Pago, la caché del borde y los horarios de los crons el primer día. Vive en
   `docs/billing/` (no en `.specs/`, que sale al cierre), lo escribe `B13` junto con el recorte que
   ya tiene, y `U1` reapunta la regla del `CLAUDE.md` en la rama. **Y los tres checklists viejos se
   restauran en esta rama de spec antes de que su PR entre a `staging`**: gobiernan al sistema viejo
   hasta el corte. Costo: `B13` crece un documento; el corte suma un paso de mirar. Riesgo: bajo.
   **(Recomendada)**: cubre exactamente lo que el propio diseño declara que no se puede simular, y
   no deja al sistema viejo sin su gate mientras todavía cobra.
2. **Sin smoke manual**: alcanzan el E2E, la batería que vigila al proveedor y la verificación del
   paso 4b; la regla del `CLAUDE.md` se borra en `U1`. Costo: ninguno. Riesgo: el checkout real, los
   correos del proveedor, el borde y los horarios no los mira nadie antes del primer cliente.
3. **Mantener el checklist viejo hasta el corte y escribir el nuevo después**. Costo: bajo ahora.
   Riesgo: el corte sale sin gate manual del sistema nuevo, y el viejo igual pierde el suyo si no se
   restauran los archivos.

**Con Juan**: después del corte a Juan se le termina la prueba y va a suscribirse. Con la 2, Juan es
la primera persona que carga una tarjeta en la página real de Mercado Pago contra el sistema nuevo;
con la 1, lo hizo el owner una hora después del paso 5 y, si algo fallaba, se enteró antes que Juan.

### C · Sobre qué datos se ensaya el corte

**El problema**: el paso 0 exige *«el despliegue ensayado entero en `staging` y verde»*, y nada dice
con qué base. La migración del paso 3 borra las fichas de todas las cuentas que no son las cinco y
tres columnas viejas; si en producción falla, el corte aborta y la plataforma queda en sólo lectura
hasta el reintento, como elegiste (`DEC-MIG-002`, 📌 del lote A).

1. **La base de `staging` como está**, con una lista de cinco cuentas de `staging` armada para el
   ensayo. Costo: bajo. Riesgo: la migración se prueba sobre filas que no se parecen a las de
   producción; lo que falle por la forma real de los datos aparece el día del corte.
2. **Una copia de la base de producción restaurada en `staging`, con los correos reescritos a una
   casilla que no entrega**, y la lista real de las cinco. Se borra al terminar el ensayo. Costo:
   restaurar y reescribir una columna. Riesgo: datos personales en `staging` mientras dura el
   ensayo. **(Recomendada)**: es el único ensayo que prueba la migración que borra, sobre lo que va
   a borrar; y el costo de que falle en producción es la plataforma entera en sólo lectura.
3. **Una copia de producción sin tocar**. Costo: el más bajo de las copias. Riesgo: los crons que se
   prenden en el paso 5 del ensayo les mandan correos reales a clientes reales desde `staging`.

**Con Juan**: la ficha de Juan en producción tiene doce fotos y el calendario conectado. En `staging`
ninguna ficha se le parece. Con la 1, el ensayo del paso 5b borra fotos de fichas de prueba y el día
del corte es la primera vez que la herramienta recorre una ficha como la de Juan; con la 2, ya la
recorrió en el ensayo. *(Qué cuenta como «verde» no es pregunta: lo propongo derivado en D-5.)*

### D · Qué hace una fila `UNKNOWN` con la terminación de una unidad

**El problema**: el PDR prohíbe *empezar* una capability crítica con su fila `UNKNOWN` (§61), y nada
dice si una unidad se puede *dar por terminada* apoyándose en una. Quedan nueve que esperan
medición, y tres no se pueden fabricar a voluntad (`GR-2`, *«pago tardío tras suspender»*; `PA-6`,
*«cancela ante primer rechazo»*; `RC-8`, *«estado del contracargo»*). El diseño ya les escribió las
dos ramas.

1. **La unidad termina si cada fila `UNKNOWN` en la que se apoya tiene sus dos ramas escritas y una
   prueba por rama contra el proveedor falso**; la batería semanal la sigue midiendo y, cuando
   cierra, la rama que no vale se borra. Costo: una prueba más por rama. Riesgo: la rama que al
   final vale sólo se probó contra el falso. **(Recomendada)**: es la forma que el diseño ya usa
   (`B/descomposicion.md:452`, *«cada una tiene escritas sus dos ramas»*), y esperar una medición que
   no se puede provocar puede no terminar nunca.
2. **La unidad no termina hasta que sus filas cierren**. Costo: `B7`, `B5` y `B6` quedan abiertas
   hasta que la tarjeta de alguien rechace sola o llegue un contracargo. Riesgo: el programa entero
   espera un evento que nadie controla.
3. **La unidad termina como en la 1, pero el corte no avanza con filas abiertas**. Costo: el corte
   queda atado a los mismos eventos. Riesgo: igual que la 2, un paso más tarde.

**Con Juan**: a Juan le rechazan la tarjeta y lo suspendemos; a la semana paga por fuera. Si
Mercado Pago lo reactiva o no es `GR-2`. Con la 1, las dos respuestas están programadas y probadas,
y la que no sea se borra cuando se mida; con la 2, `B7` no se cierra hasta que a alguien le pase lo
de Juan de verdad.

### E · Cuándo se da por aceptado el programa después del corte

**El problema**: nada dice qué observación retira la etiqueta de smoke de producción de `HOS-1352` y
dispara la tarea de cierre (sacar los informes del repositorio y reescribir el diseño sin tachados).

1. **Al terminar el paso 6 y el smoke de producción del mismo día**. Costo: ninguna espera. Riesgo: el
   primer cobro real del sistema nuevo pasa con el programa ya cerrado y el diseño ya reescrito.
2. **Cuando el sistema nuevo acreditó su primer cobro real de una cuenta que se suscribió después
   del corte, y el barrido diario corrió siete días seguidos sin una divergencia sin explicar**.
   Costo: el cierre espera a que alguien pague, que con cinco cuentas en prueba es al terminar la
   primera prueba. Riesgo: si nadie se suscribe, el cierre se demora; se revisa a los 30 días.
   **(Recomendada)**: el cobro es lo único que el sistema nuevo no puede haber hecho antes, y es lo
   que el programa existe para hacer.
3. **Después de la primera renovación**, un ciclo después del primer cobro. Costo: el cierre se
   demora más de un mes. Riesgo: `G8` y los informes históricos esperan todo ese tiempo.

**Con Juan**: con la 1, `HOS-1352` dice *Done* y Juan todavía no le pagó nada al sistema nuevo; con
la 2, se cierra la semana después de que Juan pagó y el barrido lo leyó bien siete días seguidos.

### F · Quién construye el script del corte

**El problema**: el script que cancela todos los preapprovals vivos del proveedor (pasos 1a, 1b y 2)
está descripto en `16-` y **no lo construye ninguna de las 24 unidades**; el texto dice que va *«con
la fecha del §2»*, o sea antes de que nazca la rama.

1. **Una unidad nueva del paraguas, `U3`**, sin dependencias de código (habla directo con la API del
   proveedor), lista cuando corre entera contra la cuenta de pruebas: censo sin filtro, cancelación,
   relectura por id, completitud contra el `total` del paginado y manifiesto; mergeada en la rama
   antes del ensayo. *«La fecha del §2»* se lee como la de su diseño, que ya está escrito. Costo: una
   unidad más, 25. Riesgo: bajo. **(Recomendada)**: es la única herramienta del corte sin dueño y
   es la que toca lo irreversible.
2. **Dentro de `V6`**, que ya tiene la herramienta del corte. Costo: ninguna unidad nueva. Riesgo:
   mete lo del proveedor en verticales, en la unidad más cargada del programa.
3. **Escribirlo ahora, antes de crear la rama**, a la letra. Costo: frena `U1`. Riesgo: se escribe
   sin el CI de la rama, meses antes del ensayo que lo usa.

**Con Juan**: Juan tiene un débito vivo en el sistema viejo. El script es lo que lo cancela el día
del corte; con la 1, antes del ensayo alguien ya lo corrió contra la cuenta de pruebas y comprobó que
no se le escapa ninguno; sin dueño, la primera corrida seria es el ensayo.

### G · El pase que le falta a la FASE 6

**El problema**: la FASE 5 no dio veredicto `KEEP`/`ADAPT`/`REWRITE` a lo que conserva en
autorización y base (29 piezas de los informes 01 y 02), y tres guards del repo quedaron sin
destino. El núcleo de autorización se conserva con tres arreglos ALTA y nadie se preguntó con
argumento si conviene reescribirlo, que es la pregunta de la FASE 6.

1. **Un pase corto ahora, en paralelo a `U1`**: un agente aplica la plantilla (`DEC-METH-017`,
   *«el criterio de la FASE 5»*) a las 29 piezas y a los tres guards, con argumento escrito; te
   vuelve sólo lo que sale `REWRITE` o cambia el alcance de una unidad. Costo: una sesión de agente
   sobre dos informes que existen. Riesgo: bajo; no frena `U1`, que no toca esas piezas.
   **(Recomendada)**: cierra la FASE 6 con la carga de prueba donde la puso `DEC-METH-003`
   (*«criterio de FASE 5 como gate»*), antes de que `V5` se atomice.
2. **Al atomizar cada unidad** (`V5` para autorización, `V2` y `V6` para base), como condición de
   entrada. Costo: ninguno ahora. Riesgo: lo decide quien implementa y con apuro, y la carga de
   prueba se da vuelta sola, que es lo que `DEC-METH-003` quiso evitar.
3. **Darla por cerrada como está**: confirma o adaptar, con argumento, alcanza. Costo: ninguno.
   Riesgo: *«una mitad vieja y una mitad nueva»* justo en la autorización, y dos guards que pasan
   en verde sobre nada después de `U1`.

**Con Juan**: lo que hoy decide si Juan puede editar su ficha es un actor de sistema con todos los
permisos y un bypass por permiso genérico. Con la 3 eso se remienda en `V5` sin que nadie haya
comparado remendar contra reescribir; con la 1, la comparación está escrita antes de que `V5` escriba
una línea.

---

## 4. Qué se escribiría con las recomendadas

Nada de esto está aplicado. Es la lista para la aplicación, con OK del owner al log.

### 4.1 En el diseño

| archivo | sección | cambio |
|---|---|---|
| `D/16-fase-7-del-paraguas.md` | frontmatter y párrafo inicial (l.17-30) | *«los seis ítems resueltos»*; la FASE 7 del paraguas, cerrada |
| ídem | §1, fila `acceptance gates` (l.53) | apunta a un §4.7 nuevo |
| ídem | **§4.7 nuevo, «Los gates de aceptación»** | los cinco momentos del §2.1 con su condición: D-2, D-3, D-4, D-5, A, D y E |
| ídem | §4.2 paso 0 (l.131) | el ensayo corre sobre una copia de producción con los correos reescritos (C), arranca con la imagen vieja y es verde según D-5; la parte de `staging` del checklist nuevo (B) va adentro |
| ídem | §4.2, **un paso 5c** después del 5 | el smoke de producción del checklist nuevo (B), con monto aprobado de antemano |
| ídem | §4.2, *«las herramientas del corte»*, punto 1 (l.331-361) | lo construye `U3` (F); sale *«va con la fecha del §2»* |
| ídem | §4.6, antes de la fila `U1` | la rama nace de `staging` con `C-1` a `C-8` ya mergeados (A); la regla del `CLAUDE.md` sobre smoke se reapunta en `U1` (B); y, si el pase G lo decide, los guards que mueren van a la lista de `U1` |
| ídem | §4.6, tabla de unidades y conteo (l.769-771) | fila `U3`; 25 unidades |
| ídem | §5 (l.837-853) | ningún ítem pendiente |
| `spec.md` | tabla de estado (l.146) | FASE 5, 6 y 7: ✅, con la FASE 6 *«cerrada por absorción en la 5 (`DEC-METH-017`) y el pase de G»* |
| `V/descomposicion.md` | §4, conteo de unidades (l.583) y §6 (l.662) | 25 unidades; la razón de *«qué se reescribe»* apunta a la decisión nueva de FASE 6 |
| `B/descomposicion.md` | §2.7 (l.463-464) | la frase *«no está escrito»* se reemplaza por la regla de D; §4 conteo (l.794); §6 (l.905), como arriba |
| `B/docs/20-testing.md` | §5.1 punto 4 (l.752-758) | `B13` escribe el checklist del sistema nuevo en `docs/billing/`, en dos partes |
| `.qtm/specs/SPEC-143-billing-testing-coverage/docs/` | los tres checklists | se restauran en esta rama de spec desde `origin/staging` antes del PR (B) |
| `F5/01-permisos-y-roles.md`, `F5/02-base-de-datos.md` | ninguno | no se editan: el pase G escribe su propio informe |

Linear: la issue de `U3` como sub-issue de `HOS-1352` (F); la etiqueta `status-needs-smoke-prod` en
`HOS-1352` y en ninguna unidad (D-2, E).

### 4.2 En el log (sin tocarlo acá)

- **`DEC-METH-018` — La FASE 6 queda absorbida por la 5, con un pase sobre lo que la 5 no
  clasificó**: registra el veredicto del §1.4 y la elección de G; declara que las descomposiciones
  dejan de remitir *«qué se reescribe»* a la FASE 5.
- **`DEC-ARCH-016` — Los gates de aceptación del programa**: los cinco momentos, lo derivado (D-2 a
  D-5) y las elecciones de A, B, C, D y E. Precisa a `DEC-CI-001` (su implicación 1 queda
  contestada) y a `DEC-TEST-002` (una segunda condición de terminación, sobre las filas `UNKNOWN`).
- **`DEC-ARCH-014`**, 📌: la unidad `U3` y las 25 unidades (F).
- La matriz no cambia.

---

## Key Learnings

1. **La FASE 6 no faltaba como documento, faltaba como veredicto**: `DEC-METH-017` metió su criterio
   en la FASE 5 y `DEC-ARCH-014` le sacó el cobro viejo, pero dos de los cinco informes (01 y 02,
   29 piezas) clasificaron sólo en las cuatro categorías del punto 2 y nunca dieron
   `KEEP`/`ADAPT`/`REWRITE`, justo donde la pregunta pesa: el núcleo de autorización con tres
   `ADAPTAR` ALTA.
2. **Un guard con `continue` sobre directorios inexistentes muere en verde**: después de `U1`,
   `check-product-domain-vocabulary.sh` y `check-product-domain-raw-sql.sh` no tienen sujeto y salen
   0 sobre nada; ninguno está en la lista de `U1`, y el inventario de la FASE 9 le había dejado su
   destino a la FASE 6.
3. **`DEC-CI-001` está `ACCEPTED` y sin aplicar**: `ci.yml` de `origin/staging` sigue disparando sólo
   hacia `main` y `staging`. Si la rama nace así, el PR de `U1` (unos 1229 archivos) entra sin CI y
   *«la rama sigue compilando»* no lo comprueba nadie.
4. **`F-8cC2-005` estuvo cuatro pasadas etiquetado *«[repo, no diseño]»* y nunca se resolvió**: esta
   rama de spec ya borró los checklists de smoke que gobiernan al sistema viejo mientras cobra, y
   `U1` borra `.qtm/`; el smoke de producción del `CLAUDE.md` es insatisfacible para un reemplazo.
5. **El script del corte es la única herramienta del corte sin unidad**, y es la que toca lo
   irreversible; su texto la fecha *«con la fecha del §2»*, que a la letra frenaría `U1`.
6. **«La rama» es `epic/HOS-1352-verticales-billing`**, nace con el primer código, que es `U1`
   (`DEC-ARCH-007` punto 1; `16-:757-758`); hoy `git ls-remote --heads origin 'epic/*'` da 0.
7. **La FASE 9 citó como defensa viva un guard que su propio inventario daba por muerto**
   (`check-no-binary-vertical-ternary`): dos documentos del mismo programa lo leen al revés y nadie
   los reconcilió.

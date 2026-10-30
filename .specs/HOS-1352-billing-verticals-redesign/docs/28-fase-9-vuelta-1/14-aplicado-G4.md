---
title: "FASE 9 vuelta 1 · G4 aplicado — la frontera, las ventas del corte y el botón"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 9
---

# FASE 9 vuelta 1 — G4 aplicado

Aplicación de `04-G4-frontera-ventas-y-boton.md` (§2, §3 y la lista del §5) con las decisiones
del owner de `10-decisiones-del-owner.md`: **G4-1 = 1**, **G4-2 = 2**, **G4-3 = 1**, las tres
recomendadas. Tenidas en cuenta: `G2-1` (la consulta `fichaPurgada` y el empuje del §3.1 del
contrato), `G3-2` (la lápida de recepción), `G5-2` (15 acciones), `G5-4` (`S36`), `G5-5` (`G13`
en `V4`) y `G1` (`origen_de_lápida`, `L1`–`L8`), que se citan y no se redefinen. Fui el único
agente editando. Rutas: `V/` = `.specs/HOS-1353-…/`, `B/` = `.specs/HOS-1354-…/`, `D/` =
`.specs/HOS-1352-…/docs/`. Las líneas son las del worktree al cerrar esta pasada.

## 1. Qué se aplicó

### 1.1 La lista del §5 y las decisiones

| ítem / decisión | archivo:línea | estado |
|---|---|---|
| 1 · `D/16` §4.2: filas 0b y 5, fila 3 enmendada, cierre del párrafo de la ventana, punto 2 de la rama de aborto (`G4-1`) | `D/16-fase-7-del-paraguas.md:123` (0b), `:128` (fila 3), `:132` (fila 5), `:167-170` (ventana), `:268-273` (aborto) | hecho. Además: punto 5 del guion del aviso (`:216-218`, *«no puede suscribirse ni comprar»*, que el texto de `G4-1` pedía decir *«en el mismo aviso previo»*) y la herramienta 5 del corte (`:244-246`, la regla del borde no es código de ninguna épica) |
| 2 · `D/16` §4.3: pago de `Preference` con acreditación diferida | `D/16-fase-7-del-paraguas.md:313-319` | hecho |
| 3 · `D/12` §4.2: la regla cita las preguntas; el párrafo del número | `D/12-contrato-de-cobertura.md:1132-1138` (regla), `:1153-1162` (párrafo) | hecho, **ampliado con lo de G2 y G4-2**: la mitad de vuelta nombra además la única escritura (`extenderTrial`) y el único hecho recibido (el del §3.1), y excluye la capa de composición |
| 4 · `díasDeTrial` sale; *«seis campos y un veredicto»*; la cifra en todo el alcance | contrato `:997` (firma), `:1006-1012` (nota), `:1089-1095` (el párrafo del conteo), `:1111-1115` (quién construye), `:587-589` (§2.6, el renglón de `finDeServicio`); `V/02:125-133`; `V/descomposicion.md:321-335` (§2.9) y `:504` (criterio de `V2`); `B/descomposicion.md:323`, `:343-344`, `:350-355`, `:365-370` (§2.6) | hecho, **con la cifra recontada**: el texto de mi documento (*«seis campos y un veredicto en tres preguntas»*) ya no era cierto después de G2. Ver §1.2 |
| 5 · contrato §2.1, fila `fuentes`: `A1` | `D/12-contrato-de-cobertura.md:120` | hecho |
| 6 · la vigente del grant la resuelve el paso 6 | contrato `:690-695` (§2.8); `B/docs/02-modelo-de-datos.md:754-757` | hecho |
| 7 · `V/02` §3.2: filas de suscripción fundidas en *«llega el aviso»*; grants → caché entero | `V/docs/02-modelo-de-datos.md:508-509`, `:516`; y la regla 3 (`:552-557`), que decía *«la única fila que no es de un user es la del fin de servicio»* y ahora son dos | hecho. El tachado de la fila de grants se partió en tramos: la celda ya tenía un tachado propio y `~~` no anida |
| 8 · vigencia y tipo de scope son de `addon_version` | `B/docs/16-addons.md:40-43`; `B/docs/02-modelo-de-datos.md:512` | hecho |
| 9 · la regla única del botón | `V/docs/19-superficies.md:68` (fila 21), `:70` (fila 23); `B/docs/19-superficies.md:138` (fila 21), `:299-302` (§7 punto 1) | hecho. Además, los **espejos** que repetían *«a quien todavía no publicó lo manda a publicar»* sin condición ahora citan la regla: `V/spec.md:62`, `:234-236`; `V/descomposicion.md:61` (fila V8) y `:510` (criterio de V8); `V/docs/03-maquinas-de-estado.md:228-230`; `V/docs/11-trial.md:488-489`; `B/descomposicion.md:139` (fila B13). El criterio de V8, leído literal, probaba el lazo cerrado |
| 10 · *baja* es *empeora según la estrategia* | `B/docs/10-verticales-planes-billing-options.md:103-107`; `V/docs/15-entitlements-y-limits.md:71-72`; criterio de `V2` en `V/descomposicion.md:504` | hecho |
| 11 · invalidación y aviso después del commit | `V/docs/02-modelo-de-datos.md:539-544` (regla 1); contrato `:872-875` (§3) | hecho |
| 12 · `B5 ──► B4` y el caso de `cobrada` | `B/descomposicion.md:592-595` (diagrama), `:603` (fila *en paralelo*), `:722` (criterio de B4) | hecho |
| 13 · la predecesora no emite desde que su sucesora autorizó | contrato `:479-483` | hecho |
| 14 · `G13` a `V4` | ya lo había aplicado G5 (`G5-5`); faltaban dos cosas que corregí: el criterio de `B4` todavía decía *«la de arranque no puede llegar a producción»* (`B/descomposicion.md:722`, tachado) y el criterio de `V4` no lo decía (`V/descomposicion.md:506`, agregado) | hecho |
| 15 · la fuente `ADDON` entera la emite `B10` | `B/descomposicion.md:298-302` (§2.5) y `:136` (fila B10) | hecho |
| **G4-1 (1)** | ítems 1 y 2 | hecho |
| **G4-2 (2)** · las tres firmas al §4.1 | contrato `:1001-1003` (firmas), `:1015-1018` (recuadro del principio, ampliado), `:1032-1053` (párrafo de las tres y la capa de composición) | hecho. Ver §4 punto 1 (quién construye `ficha`) |
| G4-2 · la capa de composición en los dos cap. 19 | `V/docs/19-superficies.md:45`; `B/docs/19-superficies.md:46` | hecho, como fila de la tabla del §2 de cada uno |
| G4-2 · quién construye y quién consume | `V/descomposicion.md:55` (V2, `políticaDeAddon`), `:57` (V4, `extenderTrial`), `:59` (V6, `ficha`), `:326-335` (§2.9); `B/descomposicion.md:339-341` (§2.6, filas 9 a 11) y `:359-363`; `B/descomposicion.md:136` (B10) | hecho |
| G4-2 · el canje pasa por `extenderTrial` | `B/docs/14-promos-cortesias-y-grants.md:341-346`; `V/docs/03-maquinas-de-estado.md:54` (`T4`) | hecho |
| **G4-3 (1)** · la red de tiempo vale 15 minutos | `V/docs/02-modelo-de-datos.md:497-501` (§3.2) y `:543` (regla 1) | hecho |

### 1.2 El recuento del §4.1

Recontado con un script sobre el bloque de firmas del contrato, después de mis cambios: **7
entradas** —6 preguntas y 1 operación—, con **12 campos** en 4 consultas (`políticaDePlan` 4,
`situaciónDeVertical` 2, `ficha` 2, `políticaDeAddon` 4), **un veredicto** (`direcciónDeCambio`),
**un sí o no** (`fichaPurgada`, de G2) y **una escritura** (`extenderTrial`). El texto del
contrato lo dice así (`:1089-1095`) y deja constancia de qué entró por quién.

**Donde había cifra se sacó en vez de corregirla**, que es lo que el §4.2 ahora pide: `V/02:125`,
el §2.6 del contrato (`:587`) y la regla de vigilancia citada en `B/descomposicion.md` §2.6.
El único lugar que conserva una cifra viva es el párrafo del conteo del propio §4.1, que es
donde el bloque se escribe entero.

**No toqué la firma de la fuente** (7 campos, con `cobrada` y `piso`, 9h): `V/descomposicion.md:57`
(*«hoy siete campos, con `piso`»*), `B/descomposicion.md:130` (*«los siete campos de la fuente»*)
y `B/spec.md:182` son de esa firma, no del §4.1, y siguen siendo exactos.

### 1.3 Pendientes heredados

| pendiente | archivo:línea | estado |
|---|---|---|
| (1) `B/21`: la lápida era la *«única»* fila `CANCELLED` sin transición | `B/docs/21-migracion.md:213-218` | hecho: *«~~La lápida es la única…~~ Las lápidas son las únicas… y son dos»* —la del corte y la de recepción—, citando `origen_de_lápida` sin redefinirla. El criterio que el párrafo defiende no cambia |
| (2) `D/16`: las sondas del manifiesto caían en la marca de re-vinculación | `D/16-fase-7-del-paraguas.md:137-144` | hecho: caen en una lápida de recepción (no tienen lápida del corte, no nombran fila), con `PAGO_TARDÍO_RECHAZADO` y un solo caso por sonda (`B/09` §2.4) |
| (3) `D/07`: falta la consulta 3 de la población del aviso | `D/07-facts-inventory.md:151-158` | hecho, como párrafo después del bloque SQL: una consulta por tabla de ficha de cada vertical, por dueño y por clase `L1`–`L8`, en lugar del `count(*)` de alojamientos. No escribí SQL: las columnas de las otras verticales no están verificadas |
| (4) unidades sin dueño | §4, abajo | listadas, **no asignadas** |

**markdownlint** (`npx markdownlint-cli2`) sobre los 17 archivos tocados: **0 issues**, exit 0.

## 2. Lo que dejó declarado una opción contra la recomendación

Ninguna: las tres decisiones de G4 fueron las recomendadas. Lo que queda declarado por la opción
elegida está escrito igual: el residuo de la `Preference` con acreditación diferida en `D/16` §4.3
(`G4-1` no lo cierra; causa: la acreditación diferida no se midió).

## 3. Propuestas para el log y la matriz

**Para `01-decision-log.md`** (lo aplica el orquestador con OK del owner):

1. **`DEC-ARCH-006`**, implicación nueva (convive con la de `G2-1` que propuso G2):

   > **Implicación (FASE 9 vuelta 1, owner 2026-09-26, `G4-2`).** La dirección inversa del
   > contrato gana tres entradas: `ficha(idDeFicha) → { vertical, dueño }` y
   > `políticaDeAddon(versiónDeAddon) → { addon, vigencia, díasDeVigencia, tipoDeScope }`, que
   > consume `A1`, y `extenderTrial(user, vertical, días, claveDeCanje) → ACEPTADA | RECHAZADA`, la
   > **única escritura** de billing en verticales, que corre `T4` dentro del lock del trial. Sale
   > `díasDeTrial` de `políticaDePlan`, que no tenía lector en billing. Las superficies (pricing,
   > Mi Suscripción, el botón) son una **capa de composición**: leen de las dos épicas porque no
   > deciden, y si deciden algo su lectura entra al §4.1. La regla de vigilancia del §4.2 cita las
   > preguntas del §4.1, sin cifra.

2. **`DEC-MIG-002`**, precisión:

   > 📌 Precisado el 2026-09-26, con OK del owner (FASE 9 vuelta 1, `G4-1`): durante la ventana
   > del corte —del paso 0b al paso 5 de `16-fase-7-del-paraguas.md` §4.2— **no hay altas**, ni en
   > el sistema viejo ni en el nuevo: una regla de Cloudflare cierra las rutas que crean o
   > re-autorizan algo en el proveedor. No contradice esta decisión: su alcance es el rediseño, y
   > el corte es su final.

**Para `06-mp-validation-matrix.md`**: ninguna. El residuo de la `Preference` con acreditación
diferida no se midió y queda declarado en `D/16` §4.3; si el owner quiere cerrarlo, sería una fila
nueva de medición, no una corrección.

## 4. Residuos y choques con otros grupos

1. **`ficha` la construye V6, no V2** como decía mi documento (*«las construyen `V2` (las dos
   consultas)»*). `políticaDeAddon` lee `addon_version`, que es de `V/02` §2.1 (V2); pero `ficha`
   lee la ficha, que es de V6 —el mismo razonamiento con que G2 le dio `fichaPurgada` a V6—. Queda
   escrito así en el contrato y en las descomposiciones; **no se midió si V6 llega antes que
   `B10`**, que es su consumidor, y está dicho en `B/descomposicion.md` §2.6.
2. **Unidades que quedaron sin dueño** (pendiente 4; no las asigno, son del owner):
   - **la revocación del token de calendario en `PURGED`** (`G1-5`): la piden `PB9` y `PB12`.
     Candidatas: **V9** para la rama de `PB9` y **V6** para la de `PB12`, que son sus dueñas.
   - **la unidad de billing que consume el empuje de `G2-1`** (el hecho *«la ficha llegó a
     `PURGED`»*, contrato §3.1). Candidata: **la que construye `A6`** —`B10`, la de addons—; G2 no
     lo escribió porque `A6` ya tiene unidad. Queda marcado como *«no asignado»* en la fila 11 de
     `B/descomposicion.md` §2.6.
   - **la fila 15 de las acciones administrativas** (*«editar el contenido de una ficha ajena»*,
     `G5-2`). Candidatas: **V6** (la ficha) o **V8** (superficies).
   - **si `S36` dispara `S18`** cuando la fila revocada es la predecesora de una sucesión en curso
     (`G5-4`). `S23` y `S24` lo hacen; la forma sugiere que sí, y habría que recorrer `G-R1-C`
     sobre ella.
3. **`V/21:198`** (bloque de G1, *«el botón de suscribirse, que manda a publicar a quien todavía
   no publicó»*) no cita la regla única. No lo toqué porque es un recuadro de otro grupo sobre el
   dueño del corte, que en general cumple las condiciones de `T1`; si el owner quiere los espejos
   en cero, es una frase.
4. **`B/09:592`** condiciona la cortesía de `S18` a *«esa sucesora está en `ACTIVE`»*: la misma
   forma que `F-8V1C1-007` corrigió en el contrato (una condición sobre un estado que 3c abrió al
   grace). Es de otro sujeto (la cortesía, no la fuente) y no estaba en mi lista; lo dejo
   señalado.
5. **Las dos filas de invalidación que fundí** (*«cambio de plan o de ciclo»* y *«toda transición
   de la máquina de suscripción»*) aparecen contadas en el párrafo de `V/02` §3.2 *«ninguna entraba
   por las siete de arriba»*. No recontré esa frase: es un conteo histórico de la FASE 9 completa
   y la fila tachada sigue en la tabla.
6. **G4-2 no dice por dónde extiende un trial `SUPER_ADMIN`** (`V/11` §3.4: la extensión firmada
   puede pasar el techo). Si también es un acto de billing, pasa por `extenderTrial` con otra
   semántica de techo; si es un acto de verticales, no cruza. No lo decidí.

## Key Learnings

1. Un documento de resolución escrito antes que otro grupo aplique trae cifras que ya no son
   ciertas (*«seis campos y un veredicto en tres preguntas»*): la cifra se recuenta con script
   sobre el texto vigente, nunca se copia del documento.
2. La corrección más barata de un conteo que caduca dos veces en un día es sacarlo: el §4.1
   perdió un campo y ganó cuatro entradas el mismo 26/09, y sólo el párrafo del propio bloque
   conserva el número.
3. Un criterio de terminación que repite una regla de producto sin su condición (V8: *«a quien no
   publicó lo manda a publicar»*) se aprueba construyendo el bug; los espejos de una regla única
   se buscan también en las descomposiciones.
4. Cuando otro grupo ya aplicó un ítem que es tuyo (`G13`), igual hay que recorrerlo: G5 había
   movido la fila y los catálogos, pero el criterio de B4 seguía pidiendo el guard y el de V4 no.
5. El constructor de una consulta nueva sale de la tabla que lee, no del grupo de consultas al
   que se parece: `ficha` y `fichaPurgada` leen la ficha (V6); `políticaDeAddon`, `addon_version`
   (V2).
6. Insertar un recuadro al lado de otro recuadro rompe MD028 y el orden del razonamiento: la
   prosa nueva va después del párrafo que la motiva, no pegada al bloque de firmas.

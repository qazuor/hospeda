---
title: "FASE 8-bis-3 · C2 — liberación, coexistencia y migración del conjunto"
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 8
---

# FASE 8-bis-3 · C2 — liberación, coexistencia y migración del conjunto

Cuarta pasada sobre el **conjunto**. No ataco ninguna de las dos mitades: ataco si este programa,
**como programa**, se puede empezar, se puede liberar, puede convivir con el sistema que reemplaza
y tiene vuelta atrás.

**Nueve hallazgos: 1 `CRITICA`, 5 `ALTA`, 3 `MEDIA`.** Los nueve declaran su atribución y, cuando
corresponde, si el grep de `DEC-METH-009` los encontraba.

La reejecución de mis 12 hallazgos de la 8-bis-2 está en la **§4** y **no cuenta como hallazgos
nuevos**: **2 retirados por `DEC-MIG-004`, 0 cortan, 10 siguen llegando.**

**Límites declarados.**

1. **Mediciones del repo: 2026-09-21**, sobre el worktree
   `hospeda-spec-hos-1352-billing-redesign`, rama `spec/HOS-1352-billing-verticals-redesign`,
   **`HEAD = 5548028fa`**, árbol limpio. **Nunca sobre `/home/qazuor/projects/WEBS/hospeda2/`.**
2. **No vuelvo sobre la población de producción por ningún ángulo.** `DEC-MIG-004` la cerró con
   causa y es la tercera pasada que la redescubre. Mis dos `CRITICA` de la 8-bis-2 —`F-8cC2-001` y
   `F-8cC2-002`— son los ítems **#16** y **#17** de su tabla, y quedan retirados. **Ninguno de los
   nueve hallazgos de abajo depende de cuántos usuarios hay en producción, de si alguno ya pagó, ni
   de si la cohorte crece.**
3. **No relitigo** `DEC-ARCH-004/005/006/007`, `DEC-MIG-002`, `DEC-MIG-003`, `DEC-MIG-004`,
   `DEC-GRANT-006`, `DEC-TRIAL-008`, `DEC-RF-002`, `D-26` ni `D-28`. Ataco si el **mecanismo**
   elegido para cada una cumple, y si los capítulos que no las nombran quedaron consistentes con
   ellas.
4. **El núcleo es de `C1`.** Lo marco `NUCLEO` donde aparece.
5. **No cito un número que no medí.** Los que vienen de otro documento llevan su fuente. El
   recuento de los seis informes de A y B lo hizo el orquestador (`rg -c "^### F-8d"`): **66
   hallazgos, 17 `CRITICA`**; yo verifiqué el total con la misma consulta y me dio los mismos 66
   (A1 10 · A2 11 · A3 14 · B1 7 · B2 13 · B3 11).

---

## 1. Lo que la tanda tocó, y dónde NO llegó — medido antes de buscar nada

Mi vector empieza por una medición mecánica, porque es la que decide dónde mirar: **qué archivos
tocaron los ocho commits de la tanda** (`1ca12d709` → `50c3e2196`), sobre
`git show --name-only`.

| documento | ¿lo tocó algún commit de la tanda? | último commit que lo tocó |
|---|---|---|
| `16-fase-7-del-paraguas.md` — **el corte** | **no** | `e6f4ff3a7`, 2026-09-20 |
| `11-particion-del-programa.md` — **la partición** | **no** | `12b521126`, 2026-09-18 |
| `HOS-1353/spec.md` · `HOS-1354/spec.md` | **no** | `12b521126`, 2026-09-18 |
| `HOS-1353/descomposicion.md` | **no** | `9adea48c9`, 2026-09-18 |
| `HOS-1354/descomposicion.md` | **no** | `20483a829`, 2026-09-19 |

**Los cinco documentos de mi vector son exactamente los cinco que la tanda no tocó.** No es un
reproche: es dónde busqué.

### 1.1 Y el grep de `DEC-METH-009` no los puede alcanzar, medido término por término

`rg -o` sobre cada término que la tanda redefine, contra el documento del corte, el de la
partición y los cuatro documentos de implementación (`spec.md` × 2, `descomposicion.md` × 2):

| término | cap. 16 | cap. 11 | los 4 docs |
|---|---|---|---|
| `permanent_grant_vertical` · `piso_del_trinquete` · `addon_product` | 0 · 0 · 0 | 0 · 0 · 0 | 0 · 0 · 0 |
| `sucede_a` · `sucedida_por` | 0 · 0 | 0 · 0 | 0 · 0 |
| `S17` · `S18` · `S19` · `S13` | 0 · 0 · 0 · 0 | 0 · 0 · 0 · 0 | 0 · 0 · 0 · **1** |
| «fila viva» · «fuente viva» · `cubierto` | 0 · 0 · 0 | 0 · 0 · 0 | 0 · 0 · **2** |
| `T1` · `T6` · `TÍTULO` · `COMPLEMENTO` | 0 · 0 · 0 · 0 | 0 · 0 · 0 · 0 | 0 · 0 · 0 · 0 |
| «terminal» · «pago tardío» · «reembolso» | 0 · 0 · 0 | 0 · 0 · 0 | 0 · **2** · **4** |
| `vendible` | 0 | **3** | **4** |
| **«los tres»** | **2** | 0 | 3 |

Verifiqué los tres no-ceros chicos a mano: el único `S13` es la columna de capítulos de `B9`; los
dos `cubierto` son **la firma del contrato copiada en los dos `spec.md`**, que es
`F-8dC2-001`; y el `T6` que la consulta cruda contaba era una colisión de substring dentro de una
URL de artifact (`5Nc7PT6fyh…`), así que el real es cero.

**Lectura, y es la del §1 de las instrucciones**: sobre el documento del corte, **20 de 21 términos
dan cero**, y el único que no da cero es *«los tres»* — el que `DEC-MIG-004` ya retiró con causa.
La regla, ejecutada perfectamente, **no habría producido ni una aparición que resolver** en el
documento que describe la noche irreversible del programa. Eso es `F-8dC2-009`, y no es lo mismo
que *«la regla no se aplicó»*.

---

## 2. Hallazgos

## CRITICA

### F-8dC2-001 — Los dos `spec.md` llevan una COPIA de la firma del contrato con tres campos de cinco: sin `objetivo` el pliegue por ficha no existe, y un addon comprado para una ficha habilita la capacidad en toda la cartera

**Qué se rompe.** Quien compró *«+30 fotos»* para **una** ficha las tiene en **todas**. El contrato
de cobertura tiene un campo —`objetivo`— cuya única razón de existir es impedir exactamente eso, y
**los dos documentos de cabecera de las dos épicas publican una firma del contrato que no lo
tiene**. Un implementador que construya `cobertura()` desde la spec de su propia épica devuelve una
lista de fuentes sobre la que el pliegue en dos tramos de `V/15` **no se puede calcular**, y el
único camino que queda es el que el contrato descartó por escrito.

**El camino.**

1. **El contrato, que es la fuente.** `12-contrato-de-cobertura.md` §2 declara la firma con
   **cinco** campos por fuente: *«`tipo` … `referencia: versiónDePlan | versiónDeAddon ← NO
   anulable` … `alcance: VERTICAL | LISTING | USER | GLOBAL` … `objetivo: la ficha, si alcance =
   LISTING; nada en los otros tres` … `hasta`»*.
2. **Y declara qué pasa sin el `objetivo`**, en su §2.7, con todas las letras: *«Una fuente de
   alcance `LISTING` —un addon comprado para una ficha— entra en un conjunto que se resuelve por
   `user + vertical`, y **habilitaría la capacidad en todas las fichas**»*. La solución es el
   pliegue en dos tramos: *«el tramo cacheado por `user + vertical` … y **un delta por ficha**, con
   las de alcance `LISTING` cuyo `objetivo` es la ficha de la operación»*.
3. **Los dos `spec.md` publican otra firma.** Medido, una aparición en cada uno y son idénticas:
   `HOS-1353/spec.md` §4 y `HOS-1354/spec.md` §4 —

   ```text
   cobertura(user, vertical) → { cubierto, fuentes: [ { tipo, versiónDePlan, hasta } ] }
   ```

   **Tres campos de cinco.** Falta `alcance`, falta `objetivo`, y `versiónDePlan` es el nombre que
   el contrato §2.3 **ya no usa** — *«El contrato transporta una REFERENCIA … `versiónDePlan` es
   una de esas referencias, no la única: un addon transporta su `versiónDeAddon`»*.
4. **Y el conteo de fuentes también quedó viejo, en los dos y en el capítulo de la partición.**
   `HOS-1353/spec.md` §4.1: *«La implementación de arranque del contrato resuelve esa fuente de
   verdad y **niega las otras tres**»*. `HOS-1354/spec.md` §4: *«Lo que esta épica implementa son
   **tres de las cuatro fuentes**»*. El contrato §5.1 dice otra cosa desde `4f34afa1a`: *«Resuelve
   honestamente las **dos** fuentes que ya viven del lado de verticales —el trial … y el título
   `BASE` del §2.5— y responde que no a **las cuatro** de billing: suscripción, cortesía, grant y
   addon»*.
5. **La segunda mitad del daño es la simétrica, y el contrato también la escribe.** Sin `BASE` en
   la implementación de arranque, `TRIAL_EXPIRED` no tiene ninguna fuente en el paso 5, y el §2.5
   dice qué pasa: *«el paso 5 le niega a un `TRIAL_EXPIRED` **la operación de suscribirse**, que es
   la única forma de volver a tener una: **queda afuera para siempre**»*.
6. **Y esto es, textualmente, la forma de defecto que el propio contrato existe para impedir.** Su
   encabezado: *«Lo citan `HOS-1353` y `HOS-1354`, y **ninguna de las dos lo puede mutar sola**
   (`DEC-ARCH-006`). **Una copia que una de las dos pueda tocar sin que la otra se entere es
   `F-1B-132` otra vez**»*. Las dos copias existen, las dos divergieron, y **ninguna de las dos
   épicas tuvo que tocar el contrato para que pasara**: alcanzó con que el contrato avanzara y las
   copias no.
7. **No es un detalle de redacción de un resumen**: `HOS-1353/spec.md` §4 se titula *«El contrato
   con la épica de billing»* y abre con *«**Todo lo que esta épica necesita** de HOS-1354 es un
   hecho y un aviso»*. Es la declaración de la frontera de esa épica, y el bloque de código es su
   enunciado.

**Dónde lo permite el diseño.**

- `HOS-1353/spec.md` §4 y §4.1 · `HOS-1354/spec.md` §4 (la firma, y los dos conteos de fuentes).
- `HOS-1352/docs/12-contrato-de-cobertura.md` §2 (la firma de cinco campos), §2.3 (la referencia),
  §2.5 (el `BASE` y el `TRIAL_EXPIRED`), §2.7 (el `objetivo` y las dos salidas descartadas), §5.1
  (las dos fuentes de la implementación de arranque) y el encabezado (`DEC-ARCH-006`, `F-1B-132`).
- Medición propia: `rg -c "versiónDePlan"` sobre los cuatro documentos de implementación → **2**,
  uno por `spec.md`; `rg -c "12-contrato-de-cobertura"` → 2 · 2 · 2 · 1.

**Severidad.** `CRITICA` — *«alguien accede a algo que no le corresponde»* en la dirección de
regalar (la capacidad de una ficha en toda la cartera) y en la de negar (`TRIAL_EXPIRED` sin
operación de suscribirse). Las dos consecuencias las escribe el contrato, no las deduzco yo. **Y
no duplica a `F-8dA1-010`**, que ataca el **vocabulario** de `alcance` dentro del contrato: acá el
campo no está.

**¿Es nuevo, o es el arreglo?** **Nuevo, y no es un arreglo de la 9-bis-2: la divergencia nace en
la FASE 9.** Medido con `git log -S`: `alcance:    VERTICAL` y `referencia: versiónDePlan` entran
al contrato en **`4f34afa1a`** (*«las cinco decisiones del contrato, aplicadas juntas»*), y los dos
`spec.md` no se tocan desde **`12b521126`** (2026-09-18). Lo que la tanda hizo fue **ensanchar la
brecha sin crearla**: el arreglo 6 redefinió qué `referencia` transporta un `ADDON` y el arreglo 4
qué transporta un `GRANT`, las dos sobre un campo que las copias ni nombran.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí, y es el caso más limpio de la pasada.**
El término que el arreglo 6 redefine es `versiónDePlan` / `referencia`, y
`rg "versiónDePlan"` sobre los documentos que ese commit **no** toca devuelve **dos** apariciones,
una en cada `spec.md`, las dos dentro de la firma. La obligación 3 —*«cada aparición se
resuelve»*— habría obligado a mirar el bloque entero y a ver que le faltan dos campos. **La regla
existía, alcanzaba, y no se ejecutó sobre estos dos archivos.**

---

## ALTA

### F-8dC2-002 — Cuatro capítulos del núcleo no son de ninguna de las 22 unidades de trabajo, y la tanda escribió en tres: las doce acciones administrativas, el correo que `DEC-RF-002` obliga a reescribir y el invariante `D15` no tienen quién los construya

**Qué se rompe.** El programa puede declararse terminado —las **22** unidades hechas, el tablero
que *«calcula solo cuáles están listas»* en verde— **sin que exista una sola de las doce acciones
administrativas del sistema**, sin su permiso propio, sin su registro de auditoría y sin su
confirmación explícita. Entre esas doce está *«reembolsar»*, que `DEC-RF-002` acaba de convertir en
el final de un **camino normal**, y *«revocar un grant permanente»*, que el mismo catálogo llama
*«la acción administrativa más grave»*.

**El camino, medido sobre la columna «capítulos» de las dos descomposiciones.**

1. **Las 22 unidades citan estos capítulos**: del lado verticales `02`, `03`, `10`, `11`, `15`,
   `17`, `18`, `19`, `22` §3 y el contrato; del lado billing `02`, `03`, `05`, `06`, `09`, `10`,
   `12`, `13`, `14`, `16`, `19`, `20`, `22` §1 y el contrato. **Una sola cita al núcleo**: `V1`,
   *«`02` §1 (núcleo)»*.
2. **`docs/nucleo/` tiene siete capítulos.** De los cuatro que llevan producto y no método —`01`
   glosario, `04` invariantes, `07` outbox y notificaciones, `08` auditoría y observabilidad—
   **ninguno aparece en ninguna de las 22 filas.** (`00` son reglas de escritura y `02`/`03` son
   *«el método del modelo de datos y de las máquinas de estado»*, `11-particion…` §4.1.)
3. **Y la partición sí los había repartido.** `11-particion-del-programa.md` §4: *«| 04 |
   invariantes | **PARTIDO** … | 07 | outbox y notificaciones | **PARTIDO** — el mecanismo es
   compartido; del catálogo de correos, los dos del trial a verticales y el resto a billing | 08 |
   auditoría y observabilidad | **PARTIDO** …»*. El reparto se hizo; la descomposición no lo
   recogió.
4. **La tanda escribió en tres de los cuatro.** `1ca12d709` y `3692d5deb` tocan
   `nucleo/04-invariantes.md`; `49eb99f34`, `3692d5deb` y `99e9d4e24` tocan
   `nucleo/01-glosario.md`; `99e9d4e24` toca `nucleo/07-outbox-y-notificaciones.md`; `1c972a07b`
   toca `nucleo/08-auditoria-y-observabilidad.md`. **Cinco de los ocho commits aterrizan en
   capítulos que ninguna unidad construye.**
5. **Qué hay concretamente en esos capítulos, hoy.** `NUCLEO/08` §3 lleva las **doce** acciones
   administrativas con su regla —*«Cada acción lleva tres cosas: permiso propio, registro de
   auditoría, y confirmación explícita si es destructiva o mueve dinero»*— y su última fila es la
   que la tanda reescribió: *«| **reembolsar** | `DEC-RF-001` · `DEC-RF-002` | **sí, sin
   excepción** … No hay ninguna operación automática sobre dinero |»*. `NUCLEO/07` §6 es la fila de
   correo que `B/12` §5.3 manda reescribir —*«Alcanza a `NUCLEO/07` §6, fila «cambio de plan con
   una cuota en reintento», y a `B/19` §4, fila 15»*—: **la segunda mitad tiene unidad (`B13`,
   *«`19` entero»*) y la primera no.** `NUCLEO/04` lleva `D15`, el invariante que el arreglo 10
   extendió con `sucedida_por`.
6. **Y el billing pierde además dos secciones enteras de su capítulo 02.** Las unidades citan
   `02` §2.1, §2.2, §2.3 y §2.4; **`B/02` §4 (retención) y `B/02` §5 (las restricciones que
   sostienen los invariantes) no los cita ninguna.** El §5 es donde la tanda registró
   `UNIQUE(permanent_grant_id, vertical)` contra el invariante 10, y el §4 es donde tendría que
   estar la retención de `sucedida_por`, la columna que el arreglo 10 declara que *«no la limpia
   nadie»*.
7. **El efecto sobre la liberación, que es lo que hace esto mío**: `descomposicion.md` §5 dice que
   el estado vivo *«se lleva en el tablero, que calcula solo cuáles están listas: una unidad lo
   está cuando todas sus dependencias están hechas»*. Un inventario que no contiene una pieza no
   puede reportar que falta.

**Dónde lo permite el diseño.**

- `HOS-1353/descomposicion.md` §2 (la tabla de nueve) y `HOS-1354/descomposicion.md` §2 (la tabla
  de trece), columna «capítulos».
- `HOS-1352/docs/11-particion-del-programa.md` §4 (el reparto de `01`, `04`, `07` y `08`).
- `HOS-1352/docs/nucleo/08-auditoria-y-observabilidad.md` §3 y §3.1 ·
  `HOS-1352/docs/nucleo/07-outbox-y-notificaciones.md` §6 (citado desde `B/12` §5.3) ·
  `HOS-1352/docs/nucleo/04-invariantes.md` `D15`.
- `HOS-1354/docs/02-modelo-de-datos.md` §4 y §5.
- Medición propia: la columna «capítulos» de las 22 filas; `git show --name-only` sobre los ocho
  commits de la tanda.

**Severidad.** `ALTA` — no mueve plata por sí solo. Lo que rompe es que **el inventario de trabajo
del programa no contiene el panel administrativo del sistema de cobro**, y esa ausencia es
invisible para el único mecanismo de estado que el programa tiene. **No lo marco `CRITICA`** porque
el daño exige además que nadie lo note al construir, y porque el criterio *«alguien accede a algo
que no le corresponde»* sólo se cumpliría si las doce acciones se implementaran sin sus permisos,
que es una consecuencia probable y no una que el diseño declare.

**¿Es nuevo, o es el arreglo?** **Es el arreglo a medias, y conviene separar las dos mitades.** La
ausencia de `01`, `04`, `07` y `08` del inventario es **anterior**: las dos descomposiciones son
del 2026-09-18/19 y nunca los tuvieron; es la misma familia que `F-8cC2-008` («el corte no es ítem
de ninguna unidad») y que `F-8bC2-014` (la propagación diferida). **Lo que la tanda agrega es el
peso**: `DEC-RF-002` y `1c972a07b` metieron adentro de `NUCLEO/08` §3 el desenlace de un camino que
la propia decisión declara *«un camino **normal**, no excepcional, así que va a pasar seguido»*, y
`99e9d4e24` metió en `NUCLEO/07` §6 la mitad de un correo cuya otra mitad sí tiene constructor.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No, y la razón importa.** El término que el
cierre redefine es *«reembolso»* / *«reembolsar»*, y `rg` sobre los cuatro documentos de
implementación da **4** apariciones — todas dentro de `B5`/`B6` de la descomposición de billing,
ninguna sobre el panel de administración. La regla busca **términos en capítulos**; la ausencia de
un capítulo entero del inventario de trabajo **no es una aparición que resolver**. Es el mismo modo
que `F-8dB3-001` nombra para `S13`: la regla encuentra apariciones equivocadas, no ausencias.

---

### F-8dC2-003 — Los seis guards que la tanda creó no tienen unidad: son 11 de 24 sin dueño, contra la regla 1 que las dos descomposiciones declaran para las 22

**Qué se rompe.** Las dos descomposiciones abren con la misma regla y con el mismo argumento: un
guard que llega después **nace roto**. La tanda creó **seis guards nuevos** y ninguno tiene unidad,
así que los seis van a llegar al final por construcción — que es exactamente el desenlace que la
regla describe: *«se escribe contra código ya escrito, y para entonces hay call sites que lo
violan: nace con una lista de excepciones, que es exactamente cómo un guard deja de servir»*.

**El camino, medido el 2026-09-21.**

1. **La regla, en los dos lados y con el mismo texto.** `HOS-1354/descomposicion.md` §1.3 regla 1 y
   `HOS-1353/descomposicion.md` §1.1 regla 1: *«**Cada guard va con la pieza que protege, nunca al
   final.**»*
2. **Los guards asignados son trece**, y los conté sobre la columna «guards» de las 22 filas:
   `G1` `G3` `G8` (`V1`), `G2` `G4` `G6` (`V5`), `G5` (`V6`), `G9` `G10` `G11` `G12` (`B1`), `G7`
   (`B2`), `G13` (`B4`).
3. **El catálogo tiene veinticuatro.** `V/20` §2 lista catorce —los siete numerados más `G-R2`,
   `G-R2-B`, `G-R3`, `G-R3-B`, `G-R3-C`, `G-R4`, `G-R4-B`— y `B/20` §2 lista nueve —`G7`, `G9`,
   `G10`, `G11`, `G-R1-A`, `G-R1-B`, `G-R1-C`, `G-R1-D` y `G-R4`, que figura en los dos—, más
   `G12` y `G13`, que la propia descomposición numera porque *«el `20` §2 no los nombra»*.
4. **Entonces son once sin dueño**: `G-R1-A`, `G-R1-B`, `G-R1-C`, `G-R1-D`, `G-R2`, `G-R2-B`,
   `G-R3`, `G-R3-B`, `G-R3-C`, `G-R4`, `G-R4-B`. **Ninguno de los once aparece en ninguna de las 22
   filas** — medido con `rg "G-R"` sobre los cuatro documentos de implementación: **cero**.
5. **Y seis de los once son de esta tanda.** Comparado contra `110528b49` (el commit anterior a la
   tanda): antes había **cinco** R-guards —`G-R1-A`, `G-R1-B`, `G-R3`, `G-R3-B`, `G-R3-C`— y ahora
   hay **once**. Los seis nuevos son **`G-R1-C`**, **`G-R1-D`**, **`G-R2`**, **`G-R2-B`**,
   **`G-R4`** y **`G-R4-B`**.
6. **El programa sabe que esto hay que decidirlo explícitamente, y lo hizo una vez.**
   `HOS-1353/descomposicion.md` §2.3 existe sólo para eso: *«Esta tabla dejó a **V4 sin guards**, y
   la descomposición de billing encontró el que le correspondía: **`G13`** … **No puede nacer
   acá.** … Nace en **B4** de la otra épica …**Queda anotado acá para que nadie lo lea como un
   olvido.»* Se hizo el ejercicio para **un** guard, y quedaron once sin hacer.
7. **Y uno de los seis nuevos es el que peor tolera no tener dueño.** `G-R4` se define en `V/20` §2
   como *«sobre las nueve máquinas, **en las dos épicas**»*, y `B/20` §2 lo repite con una nota:
   *«El catálogo de guards es una sola numeración partida en dos capítulos, así que un guard del
   núcleo tiene que figurar en los dos o **la mitad de su dominio queda sin vigilar en el
   papel**»*. Un guard que cruza la frontera y no tiene unidad en ninguna de las dos épicas sólo
   puede aparecer en el PR final, que `DEC-ARCH-007` ya describió: *«va a ser enorme y nadie lo
   puede revisar de verdad»*.

**Dónde lo permite el diseño.**

- `HOS-1353/descomposicion.md` §1.1 regla 1, §2 (columna guards) y §2.3.
- `HOS-1354/descomposicion.md` §1.3 regla 1, §2 (columna guards) y §2.1.
- `HOS-1353/docs/20-testing.md` §2 y `HOS-1354/docs/20-testing.md` §2 (los dos catálogos).
- Medición propia: `rg -o "G-R[0-9]+(-[A-Z])?"` sobre los dos `20-testing.md` en `110528b49` y en
  `HEAD`; `rg "G-R"` sobre los cuatro documentos de implementación → 0.

**Severidad.** `ALTA` — los once guards son la mitad de las defensas estructurales del programa y
llegan con la garantía de nacer con excepciones, sobre las reglas más nuevas y menos asentadas del
diseño. No mueve plata por sí solo; **quita las defensas que impiden que otras cosas la muevan.**

**¿Es nuevo, o es el arreglo?** **Es el arreglo, y son seis arreglos distintos**: el 5 (`G-R2`), el
4 (`G-R2-B`), el de `NUCLEO/03` regla 7 (`G-R4`), el 3 (`G-R4-B`), el 8 (`G-R1-C`) y el 12
(`G-R1-D`). Cada uno cerró su defecto **agregando una fila al catálogo de guards** y ninguno tocó
el documento que reparte el trabajo. La mitad preexistente —los cinco R-guards de la 9-bis y la
9-bis-2— es `F-8bC2-014` intacta.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término que cada arreglo redefine
es el de su regla (`sucedida_por`, `cubierto`, `COMPLEMENTO`, …), y los cuatro documentos de
implementación no nombran ninguno: la tabla del §1.1 lo mide, **cero apariciones de los 21
términos**. El nombre del guard tampoco sirve, porque **el guard es nuevo**: no hay apariciones
viejas que resolver. Es la misma limitación que `F-8dC2-002`: la regla vigila capítulos y el
reparto del trabajo no es un capítulo.

---

### F-8dC2-004 — La rama 1 del cierre de la sucesión aterriza en `B6`, la única unidad sin diseño y bloqueada, y el grafo declara que `B6` «no detiene a ninguna otra»

**Qué se rompe.** El cliente que cambia de plan estando en mora, paga la cuota vieja, y a quien el
diseño le promete la devolución, **no la puede recibir hasta que exista el capítulo 13** — que no
está escrito, no tiene política decidida y arrastra una fila de medición abierta. La descomposición
de billing declara que ese bloqueo alcanza a **una sola unidad** y que *«no detiene a ninguna
otra»*; desde esta tanda detiene el camino normal de otra.

**El camino.**

1. **La rama existe y devuelve plata.** `B/12` §5.3, primera fila de las cuatro: *«| **la sucesora
   autoriza** (`S2`) → `S17` mata a la predecesora y `S18` cierra | **se reembolsa, y lo confirma
   una persona** (`DEC-RF-002`) … |»*.
2. **Y el propio `DEC-RF-002` declara que es frecuente**: *«**El costo, aceptado con los ojos
   abiertos**: la persona **espera a que alguien mire**, y este es un camino **normal**, no
   excepcional, así que va a pasar seguido sobre el camino de recuperación que `DEC-SUB-003` diseñó
   para que no fuera un muro.»*
3. **Confirmar no es ejecutar, y ejecutar es `B6`.** `HOS-1354/descomposicion.md` §2.4: *«**Ejecutar**
   es cómo se mueve: el cargo, **el reembolso** y cómo se constata un pago manual. Eso es el 13, y
   arrastra `RF-3` en `UNKNOWN` — el §61 prohíbe implementar sobre una fila abierta.»* Y la fila
   `B6` de su §2: *«**BLOQUEADA, y es la única sin diseño** — es el capítulo 13, el único de los 22
   sin escribir»*.
4. **El grafo dice lo contrario de lo que ahora pasa.** §3: *«| **sin diseño** | **B6**, y **no
   detiene a ninguna otra** |»*, con `B6` colgando de `B5` como hoja. El camino crítico es
   `B1 → B3 → B5 → B7 → B8 → B9 → B10 → B13 → B12` y **no pasa por `B6`**.
5. **Pero la rama vive en `B7`.** La tabla de unidades le da a `B7` *«`03` §4, S4–S7 · `12` §1,
   §4, **§5** · `05` §3»*, y las cuatro ramas están en `B/12` **§5.3**. O sea: una unidad del camino
   crítico tiene un desenlace declarado que sólo se puede ejecutar desde la unidad que **no se
   puede ni especificar**.
6. **Y el criterio de terminación de `B7` describe el comportamiento que la tanda reemplazó.** §4:
   *«**B7** | … y **un pago tardío que llega habiendo otra suscripción viva** para ese
   `user + vertical` **no reactiva nada** y el evento dice **cuál** de las cuatro condiciones
   falló»*. Desde el arreglo 12 ese pago **no sólo no reactiva**: se registra, **queda pendiente**
   (`S19`), **sin marca y sin evento crítico** (`B/05` §3, la excepción), y su destino lo decide el
   cierre. Una implementación que descarte el pago —o que ponga la marca, que es lo que el criterio
   sugiere— **satisface el criterio al pie de la letra** y pierde la plata. El criterio de
   terminación de la unidad quedó **compatible con el defecto**.
7. **Y hay una segunda ambigüedad de reparto, medida sobre la tabla de transiciones.** `B/03` §3.2
   contiene **las diecinueve** filas `S1`–`S19` — lo conté con `rg "^\| S[0-9]+"`, y los
   encabezados de `B/03` confirman que §3.2 va de `S1` a `S19` sin subsecciones nuevas. Las
   unidades direccionan esa tabla **de dos formas a la vez**: `B3` la toma **por sección**
   (*«`03` §3.1–§3.4»*, o sea las diecinueve) y `B7`, `B8` y `B9` la toman **por número**
   (`S4–S7`, `S8–S12`, `S9`, `S13`). **`S14` a `S19` no caen en ningún rango numérico**, y las dos
   filas que la tanda agregó —`S18` y `S19`— caen sólo en `B3`, la unidad *«El alta y su ventana»*,
   cuyos tres criterios de terminación no nombran ni una sucesión, ni un pago retenido, ni un
   reembolso.

**Dónde lo permite el diseño.**

- `HOS-1354/descomposicion.md` §2 (filas `B3`, `B6`, `B7`, `B8`, `B9`), §2.4, §2.7, §3 y §4.
- `HOS-1354/docs/12-suscripcion.md` §5.3 (la tabla de cuatro ramas).
- `HOS-1354/docs/03-maquinas-de-estado.md` §3.2 (`S18`, `S19`).
- `HOS-1354/docs/05-idempotencia-y-concurrencia.md` §3 (la excepción de la condición 3).
- `HOS-1352/docs/01-decision-log.md`, `DEC-RF-002` («El costo, aceptado con los ojos abiertos»).
- Medición propia: `rg -n "^\| S[0-9]+" 03-maquinas-de-estado.md` → 19 filas, todas dentro de §3.2.

**Severidad.** `ALTA`. El dinero que no vuelve ya está contado cuatro veces por A y B
(`F-8dA2-001`, `F-8dB1-005`, `F-8dB2-003`, `F-8dB3-003`), y **no lo vuelvo a contar**: los cuatro
atacan **quién dispara** el reembolso. Lo que agrego es **quién lo construye** — y la respuesta es
la única unidad que el programa declara imposible de empezar. No lo marco `CRITICA` porque el
criterio de plata ya está adjudicado a esos cuatro.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 12 y el 13, más `DEC-RF-002`.** Antes de la
tanda el reembolso era un camino excepcional del capítulo 13 y `B6` podía quedarse sola sin
detener nada; el arreglo 13 movió el disparador al cierre de la sucesión, el 12 creó `S19`, y
`DEC-RF-002` declaró el camino **normal**. Las tres afirmaciones de la descomposición —*«no detiene
a ninguna otra»*, el camino crítico sin `B6`, y el criterio de terminación de `B7`— eran ciertas el
2026-09-19 y dejaron de serlo el 21.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No con el término de la regla, sí con uno de
los dos que la decisión nombra.** El término que el arreglo 12 redefine es `S19`, y
`rg "S19"` sobre los cuatro documentos de implementación devuelve **cero**. Pero `DEC-RF-002` nombra
*«reembolsar»* explícitamente, y `rg "reembolso"` sobre esos mismos cuatro documentos devuelve
**cuatro** apariciones, dos de ellas en `B6` (*«Ejecutar el cobro y el reembolso 🔒»* y *«el cargo,
el reembolso y cómo se constata un pago manual»*). Resolver esas dos apariciones era leer que la
ejecución está bloqueada. **La regla alcanzaba por el término de la decisión, no por el de la
transición**, que es la misma distinción que `F-8dB3-001` mide para `S13`.

---

### F-8dC2-005 — El paso 4 del corte, que el checklist llama «la única escritura», ahora incluye dos ejecuciones de la acción administrativa más grave del catálogo y dos referencias no anulables que ninguna cortesía heredada puede resolver

**Qué se rompe.** El único procedimiento escrito de la noche irreversible del programa afirma que
su cuarto paso es *«la única escritura del corte»* y que consiste en sembrar lápidas. Desde el
arreglo 4, escribir las dos cortesías del owner exige, por cada una: una fila de `permanent_grant`,
**una fila de `permanent_grant_vertical` por vertical**, y en cada ancla **dos referencias no
anulables a tablas de la otra épica** — el `plan` y la versión que era vigente *«el día que se
firmó»*. Ese día, para una cortesía heredada, es anterior a que el catálogo nuevo existiera: **la
columna no admite nulo y no tiene valor verdadero.**

**El camino.**

1. **El checklist.** `16-fase-7-del-paraguas.md` §4.2: *«| 4 | **sembrar las lápidas** (`B/21`
   §2.5) con los ids cancelados | el sistema **nuevo** | …»*, y el párrafo que lo cierra: *«**El
   paso 4 es la única escritura del corte, y es a mano.**»*
2. **Pero la migración escribe además las dos cortesías.** `B/21` §2.4: *«**Las dos cortesías se
   escriben como `permanent_grant`, exactamente como el *Free Forever* del diseño nuevo**»*. Eso ya
   lo medí en la 8-bis-2 (`F-8cC2-004`, paso 5) y **no es lo que agrego**.
3. **Lo que la tanda cambió es la forma de esa escritura.** `B/21` §2.4, párrafo nuevo del
   `1ca12d709`: *«**Con una precisión que no es de forma: un ANCLA por cada vertical de su scope,
   sobre UNA sola fila de grant.** … Lo que se multiplica es la fila de
   `permanent_grant_vertical`, **nunca la concesión**.»*
4. **Y la entidad nueva no admite nulos en ninguna de sus dos referencias.** `B/02` §2.4:
   *«| **`permanent_grant_vertical`** | **el ancla, una por vertical del scope**: el grant, la
   vertical, **el `plan` que otorga en esa vertical** y **el piso del trinquete de esa vertical** |
   **`UNIQUE(permanent_grant_id, vertical)`**; el plan **no es anulable** y **pertenece a esa
   vertical**; el piso tampoco es anulable |»*.
5. **El `piso_del_trinquete` está definido por una fecha que la migración no tiene.** `B/02` §2.4:
   *«**`permanent_grant_vertical.piso_del_trinquete`** — **la referencia a la versión de ESE plan
   que estaba vigente el día que se firmó**, nunca una copia de sus valores»*. Las dos cortesías
   del owner se firmaron en el sistema viejo, y del sistema viejo **no se transcribe ninguna fila**
   (`B/21` §2.4). La única versión que existe es la que el paso 3 acaba de sembrar, así que la
   columna se va a llenar con un valor que **no es el que su definición dice**, y el trinquete —el
   instrumento que garantiza que *«un grant nunca otorga menos de lo que otorgaba el día que se
   concedió»*— queda anclado al día del corte. Nadie lo declaró.
6. **Y escribir esas filas es, por definición del propio contrato, un acto administrativo con
   firma.** `12-contrato…` §2.8: *«**Beneficio operativo**: regalar algo pasa a ser **elegir un
   plan concreto**, y queda auditado»*, y *«extenderlo a una vertical nueva es **anclarle un
   plan**, que es un acto de `SUPER_ADMIN` y queda auditado como cualquier otro»*. El catálogo del
   núcleo clasifica *«otorgar o revocar un **grant permanente**»* como *«**sí**, y **la más
   grave**»* y le exige *«permiso propio, registro de auditoría, y confirmación explícita»*
   (`NUCLEO/08` §3). **El paso 4 «a mano» del corte incluye dos de esos actos**, sobre una
   plataforma desplegada minutos antes, con el panel que los soporta sin unidad que lo construya
   (`F-8dC2-002`).
7. **Y el orden interno del paso quedó forzado y no está escrito.** Las anclas apuntan a `plan` y a
   `plan_version`, que son tablas de verticales, así que **el catálogo tiene que estar sembrado
   antes** — y la siembra es parte del paso 3, el que el checklist escribe con una palabra:
   *«| 3 | **desplegar** | — | recién acá, y sólo si el paso 2 cerró |»*.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/16-fase-7-del-paraguas.md` §4.2 (pasos 3 y 4, y *«la única escritura del corte»*).
- `HOS-1354/docs/21-migracion.md` §2.4 (las dos cortesías, el ancla por vertical).
- `HOS-1354/docs/02-modelo-de-datos.md` §2.4 (`permanent_grant`, `permanent_grant_vertical`,
  `piso_del_trinquete`).
- `HOS-1352/docs/12-contrato-de-cobertura.md` §2.8 y §5.1 (la siembra del catálogo).
- `HOS-1352/docs/nucleo/08-auditoria-y-observabilidad.md` §3 y §3.1.

**Severidad.** `ALTA` — no mueve plata: las dos cortesías son cuentas del owner y
`DEC-GRANT-001` ya declaró que un grant no devuelve nada. Lo que rompe es la **afirmación de
exhaustividad** del único procedimiento irreversible del programa, sobre un paso que además ganó,
sin que nadie lo anotara, dos actos que el catálogo del núcleo clasifica como los más graves del
sistema. **Es el mismo defecto que `F-8cC2-004`, con sujeto nuevo**: aquél contaba tres clases de
escritura, ésta agrega la cuarta y su orden.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 4.** Antes de `1ca12d709` el grant era una fila
con un `plan_id` y un `piso_del_trinquete` adentro, y escribir una cortesía heredada eran dos
filas. El arreglo la convirtió en **1 + N filas con 2N referencias no anulables**, tocó `B/21`
§2.4 para decirlo, y no tocó el documento que cuenta las escrituras del corte.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No, con el término que la regla manda
elegir.** El término redefinido es `permanent_grant`, y `rg "permanent_grant"` sobre
`16-fase-7-del-paraguas.md` devuelve **cero**: el documento del corte habla de *«sembrar las
lápidas»* y de *«la única escritura»*, y **no nombra ni una sola entidad del modelo**. La tabla del
§1.1 lo mide para los 21 términos. Es la forma de defecto que la regla, por construcción, no puede
ver: **un documento que hace una afirmación cuantificada sobre un conjunto sin nombrar a sus
miembros es invisible a una búsqueda por miembro.**

---

### F-8dC2-006 — La lápida es un `CANCELLED` que ninguna transición escribe y cuya cancelación en el proveedor la hizo una persona a mano: es la séptima puerta de la exención enumerada del barrido, y la única con su contraejemplo escrito en el mismo capítulo que la crea

**Qué se rompe.** La única fila que el sistema nuevo escribe el día del corte queda **fuera del
barrido para siempre**, por una exención que la tanda convirtió en una garantía enumerada — y cuya
garantía es, palabra por palabra, lo contrario de lo que la lápida existe para cubrir. Si uno de
los tres preapprovals no quedó realmente cancelado, el único mecanismo que el diseño declara para
lo que *«diverge en silencio»* tiene escrito que a esa fila no la mira, y el primer aviso es el
cobro.

**El camino.**

1. **Qué es la lápida.** `B/21` §2.5: *«**El compromiso viejo se conserva como una `subscription`
   en `CANCELLED` con su `provider_link`, escrita DESPUÉS de cancelarlo en el proveedor.**»* Y es
   *«**la única fila que el sistema nuevo sí escribe**»*.
2. **El barrido no la mira.** `B/09` §3: *«**Los estados terminales de una SUSCRIPCIÓN no se
   barren**: `CANCELLED`, `ABANDONED` y `CHARGE_DECLINED` no pueden divergir hacia nada que nos
   importe»*.
3. **Y la tanda convirtió esa exención en una garantía con nombres.** El mismo §3, párrafo escrito
   por `f5731fd65`: *«**Y la exención vale por la razón que hace terminal a cada uno, no por la
   palabra «terminal».** En los tres, la autorización quedó imposibilitada de cobrar por algo que
   ya ocurrió **y que no depende de que una llamada nuestra haya salido bien**: `S3` canceló el
   preapproval al vencer la ventana, `S12` y `S17` lo cancelan sobre una fila cuyo preapproval
   `S11` ya canceló … y en `CHARGE_DECLINED` **lo canceló el proveedor**»*.
4. **La lápida no entra por ninguna de las tres puertas, ni por ninguna otra de la tabla.**
   `F-8dB3-001` contó las puertas *«sobre la tabla de `B/03` §3.2»* y le dieron seis —`S3`, `S12`,
   `S13`, `S16`, `S17` y el espejo—. **La lápida es una séptima y no está en esa tabla**: la
   escribe una persona a mano en el paso 4 del corte, sin transición, sobre una fila que nunca
   estuvo viva en el sistema nuevo.
5. **Y su cancelación es exactamente el caso que la garantía excluye.** El paso 1 del corte es
   *«cancelar los tres preapprovals en el proveedor»* hecho a mano, y el propio §4.2 describe qué
   clase de acto es: *«Cancelarlos después exige hacerlo a mano contra la API del proveedor, **sin
   idempotencia, sin registro y sin nadie que verifique**»*. Depende, literalmente, *«de que una
   llamada nuestra haya salido bien»*.
6. **El contraejemplo está escrito en el capítulo que crea la lápida.** `B/21` §2.5: *«Si alguna
   emite un cobro después del corte —**porque la cancelación se aceptó y no se aplicó**, o porque
   el cobro ya estaba en vuelo—»*. `B/09` §3 afirma de esa misma fila que la autorización *«quedó
   imposibilitada de cobrar»*. **Los dos capítulos describen la misma fila y se contradicen.**
7. **Lo que queda es la asimetría de la detección.** El paso 2 del corte —*«verificar releyendo
   cada uno por su id»*— es real y bueno, pero ocurre **antes** de que la fila exista y no deja
   rastro en el sistema nuevo; y `B/21` §2.5 le atribuye el trabajo al barrido —*«Con la lápida, el
   barrido del cap. 09 **encuentra el id**»*— cuando el barrido tiene escrito que no la recorre. Lo
   que sí la encuentra es el otro camino, el del §2.2: *«toda suscripción que cobra emite un
   webhook, así que uno que llegue de un preapproval desconocido **es** la detección»*. O sea: la
   lápida funciona, **pero por un mecanismo distinto del que su capítulo le atribuye, y sólo
   después del cobro**.

**Dónde lo permite el diseño.**

- `HOS-1354/docs/09-conciliacion.md` §2.2, §2.3 y §3 (la exención y su justificación enumerada).
- `HOS-1354/docs/21-migracion.md` §2.5 (la lápida, y las dos causas de cobro posterior).
- `HOS-1352/docs/16-fase-7-del-paraguas.md` §4.2 (pasos 1, 2 y 4).
- Medición propia: `rg -oin "lápida|lapida"` sobre los tres cuerpos de diseño → **5**
  apariciones, **4** en `B/21` (§2.5 y §4) y **1** en `V/21` §2.4. **Cero en `B/09`**, el capítulo
  que la lápida necesita para hacer su trabajo.

**Severidad.** `ALTA`. **No lo marco `CRITICA` y digo por qué**: el daño en plata de un preapproval
que sobrevive a su cancelación ya está contado como `CRITICA` en `F-8dB3-001`, por la puerta de
`S13`; los tres sujetos de la lápida son la población conocida que `DEC-MIG-004` resuelve por
teléfono; y el paso 2 del corte sí verifica, una vez. Lo que agrego es que **la enumeración que la
tanda escribió se declara exhaustiva y deja afuera la única fila `CANCELLED` de todo el sistema que
ninguna transición produce** — y que esa clase de fila no es única del corte: cualquier escritura
manual futura hereda el mismo agujero.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el de la familia de `CHARGE_DECLINED`
(`f5731fd65`)**, el mismo párrafo que `F-8dB3-001` ataca por otras dos puertas. Antes la exención
era una regla sin justificación; el arreglo la volvió una garantía enumerada, y una garantía
enumerada es falsable. Lo que agrego a `F-8dB3-001` es que su recuento se hizo *«sobre la tabla de
`B/03` §3.2»*, y **la lápida no está en ninguna tabla**.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí.** El término cuya población el arreglo
redefine es `CANCELLED` —lo mismo que concluye `F-8dB3-001` desde el otro lado—, y
`rg "CANCELLED" 21-migracion.md` sobre el capítulo que `f5731fd65` **no** toca devuelve la frase
*«una `subscription` en `CANCELLED` con su `provider_link`»* de una. Resolver esa aparición era
preguntarse por qué puerta entra esa fila, y la respuesta es *«por ninguna»*. **La regla
alcanzaba.**

---

## MEDIA

### F-8dC2-007 — El capítulo que declara qué se puede construir sin billing sigue diciendo «una sola fuente» y «las otras tres», y enuncia el disparador viejo de `T2` y `T5`

**Qué se rompe.** `11-particion-del-programa.md` §3.1 es el argumento entero de por qué la épica de
verticales puede arrancar sola. Tres de sus afirmaciones dejaron de ser ciertas y **ninguna se
puede verificar desde el capítulo**: quien lo lea para decidir qué construir primero va a
dimensionar mal la implementación de arranque y va a esperar de `T2`/`T5` un disparador que ya no
tienen.

**El camino.**

1. *«Mientras la épica de billing no exista, `cobertura()` se resuelve con **una sola fuente** —el
   trial— y **las otras tres** (suscripción, cortesía, grant) responden que no»* (§3.1). El
   contrato §5.1 dice **dos** y **cuatro**: *«Resuelve honestamente las **dos** fuentes que ya
   viven del lado de verticales —el trial … y el título `BASE` del §2.5— y responde que no a las
   cuatro de billing: suscripción, cortesía, grant y addon»*.
2. **Y la diferencia tiene consecuencia de construcción, no de redacción.** El `BASE` *«no es un
   `tipo` que billing resuelva. **El piso lo resuelve verticales**»* (§2.5), y para resolverlo hace
   falta **la versión de piso sembrada por vertical** (§5.1). O sea: la épica que *«no pregunta por
   dinero»* tiene una fuente propia más de la que su capítulo de partición le cuenta, con una
   siembra que ningún criterio de terminación de `V2` ni de `V4` nombra.
3. *«**El trial nunca convierte.** Las transiciones `T2` y `T5` del capítulo 03 §2 disparan
   **cuando se autoriza una suscripción**»* (§3.2, punto 1). Desde el arreglo 2, `V/03` §2 dice
   otra cosa: `T2` dispara con *«**aparece una fuente viva de clase `TÍTULO` que no es la del
   trial**»* y `T5` con *«**aparece una fuente viva de clase `TÍTULO`**»*. La conclusión del
   capítulo sigue siendo cierta —las otras fuentes `TÍTULO` son todas de billing— pero **la razón
   que la sostiene es la que el contrato §4 prohíbe expresamente**: *«una regla de verticales que
   se condicione sobre un estado de suscripción no es una regla laxa, **es una regla que no se
   puede evaluar**»*, y el guard que lo vigila es `G-R4-B`.
4. **El capítulo 11 no está en el dominio de ese guard.** `G-R4-B` mira *«una condición o un evento
   de una máquina de la épica de verticales»* (`V/20` §2), y el §3.2 del capítulo 11 no es una
   máquina: es la descripción de una. Nada lo vigila.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/11-particion-del-programa.md` §3, §3.1 y §3.2.
- `HOS-1352/docs/12-contrato-de-cobertura.md` §2.5, §4 y §5.1.
- `HOS-1353/docs/03-maquinas-de-estado.md` §2 (`T2`, `T5`) · `HOS-1353/docs/20-testing.md` §2
  (`G-R4-B`).
- Medición propia: `rg -n "versiónDePlan|otras tres|una sola fuente"` sobre el capítulo 11 →
  líneas 119–120.

**Severidad.** `MEDIA`. No rompe nada ejecutando y la conclusión del capítulo —que verticales
arranca sola— **sigue siendo correcta**. Lo que queda mal es que las tres razones que la sostienen
envejecieron, y una de ellas envejeció **hacia la formulación que el contrato prohíbe**. Es la
misma clase de defecto que mi propia nota de método describe: una razón caduca debajo de una
conclusión correcta no la revisa nadie.

**¿Es nuevo, o es el arreglo?** **Mitad y mitad, y las dos mitades importan.** El conteo de fuentes
quedó viejo en `4f34afa1a` (FASE 9, el commit que introdujo `BASE`), así que esa mitad es **nueva y
no es de la 9-bis-2**. El disparador de `T2`/`T5` **es el arreglo 2** (`49eb99f34`), que reescribió
las cuatro filas de la máquina de trial sobre `cubierto` y las clases de fuente.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No, y por dos razones distintas.** Para la
mitad del arreglo 2, el término redefinido es `TÍTULO` / `cubierto`, y `rg` sobre
`11-particion-del-programa.md` da **cero** para los dos: el capítulo escribe el disparador en
castellano (*«cuando se autoriza una suscripción»*) y no nombra ninguna de las dos palabras. Para
la otra mitad la regla ni siquiera aplica, porque el defecto no lo introdujo esta tanda. **Un
arreglo que reemplaza una frase por un término sólo es grepeable desde el término nuevo, y los
lugares que hay que arreglar son justamente los que todavía usan la frase vieja.**

---

### F-8dC2-008 — El párrafo que el arreglo 2 agregó a la migración afirma «nadie tiene un título vivo la mañana del corte», y la otra mitad del mismo capítulo 21 escribe dos `permanent_grant` para ese mismo corte

**Qué se rompe.** El único párrafo del programa que verifica explícitamente el efecto de la guarda
nueva `T1`/`T6` sobre el corte llega a la conclusión correcta por un camino que su propio capítulo
hermano desmiente, y declara que vale *«sin ramas»* cuando hay dos cuentas que toman la otra rama.
El desenlace no es grave —son las dos cuentas del owner— pero **la afirmación que el párrafo
existe para hacer es falsa**, y el mismo razonamiento es el que se va a reusar la próxima vez.

**El camino.**

1. **El párrafo, que la tanda agregó.** `V/21` §2.4, texto nuevo de `49eb99f34`: *«**Y la guarda
   nueva del par `T1`/`T6` no cambia esta conclusión, que es lo que hay que verificar.** Desde que
   `T1` exige `cubierto` **falso** y `T6` lo exige **verdadero** (`V/03` §2), el mismo evento
   podría mandar a alguien a `TRIAL_CONVERTED` en vez de a `TRIAL_ACTIVE` — pero **no la mañana del
   corte**: las ocho suscripciones se cancelan (§2.1), así que **nadie tiene un título vivo** y la
   única de las dos que puede disparar es `T1`. Lo de abajo vale sin ramas.»*
2. **La otra mitad del mismo capítulo 21 escribe dos títulos vivos en ese mismo corte.** `B/21`
   §2.4: *«**Las dos cortesías se escriben como `permanent_grant`, exactamente como el *Free
   Forever* del diseño nuevo**»*.
3. **Y un `GRANT` es de clase `TÍTULO`, con `hasta: NO_VENCE`.** `12-contrato…` §2.4, tabla del
   dominio: *«| `GRANT` | — | **`TÍTULO`** | — | — |»* en la columna `NO_VENCE`. Para las dos
   cuentas del owner `cubierto` es **verdadero** en cuanto el grant existe, así que la que puede
   disparar es **`T6`**, no `T1` — y `T6` *«**crea la fila de `trial`, consumida**, sin reloj y sin
   campaña»* (`V/03` §2).
4. **Nadie escribió el orden que decidiría cuál de las dos.** El corte escribe las lápidas en el
   paso 4 y `B/21` §2.4 no dice **cuándo** se escriben los dos grants. Si van en la misma tanda
   manual, las dos cuentas del owner amanecen cubiertas y su trial se consume; si van después, no.
   **El resultado depende de un orden que ningún documento fija**, sobre el mismo paso 4 que
   `F-8dC2-005` mide.
5. **Y hay una segunda incoherencia adentro del párrafo, contra el párrafo que está dos arriba.**
   `V/21` §2.4 ya había establecido que **ninguna** de las dos puede disparar: *«Y el evento que
   los sacaría **ya ocurrió**: `T1` dispara con «la ficha queda publicada», que es la
   **transición** de publicar, y sus fichas ya están publicadas.»* Si el evento ya ocurrió y no
   vuelve a ocurrir, *«la única de las dos que puede disparar es `T1`»* es falso también por ese
   lado: no dispara ninguna. La conclusión de abajo —las fichas se despublican— **se sostiene
   igual**, y por el primer argumento, no por el segundo.

**Dónde lo permite el diseño.**

- `HOS-1353/docs/21-migracion.md` §2.4 (los dos párrafos).
- `HOS-1354/docs/21-migracion.md` §2.4 (las dos cortesías como `permanent_grant`).
- `HOS-1352/docs/12-contrato-de-cobertura.md` §2.4 (la clase de un `GRANT`).
- `HOS-1353/docs/03-maquinas-de-estado.md` §2 (`T1`, `T6`).
- Medición propia: `git diff 110528b49 HEAD -- HOS-1353/docs/21-migracion.md` → **+6 líneas**, el
  párrafo citado y nada más.

**Severidad.** `MEDIA`. Las dos afectadas son cuentas del owner *«sin cliente real detrás,
regenerables de cero»* (`B/21` §2.4), y tener *Free Forever* vuelve irrelevante haber consumido el
trial **mientras el grant exista**. El caso en que deja de ser irrelevante —revocar el grant deja a
alguien sin grant y con el trial gastado— es `F-8dA1-001`, y **no lo duplico**: lo suyo es la
máquina, lo mío es que el capítulo de la migración afirme que esa rama no existe el día del corte.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 2.** El párrafo entero lo agregó `49eb99f34`
para verificar precisamente esto.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No hacía falta: la regla se ejecutó.** Este
es el único caso de mi vector donde el commit **sí** fue al capítulo que no estaba tocando —
`49eb99f34` edita `V/21` y ningún otro arreglo lo hace— y escribió una resolución explícita de la
aparición. **Lo que falló es el paso 3, no el 2**: *«cada aparición se resuelve»* incluye resolverla
**bien**, y la resolución que se escribió razona sobre las ocho suscripciones canceladas sin mirar
las dos filas que la otra mitad del mismo capítulo 21 escribe en el mismo acto. Es el dato que
`DEC-METH-009` necesita para no leerse como una garantía: **la búsqueda es mecánica y la resolución
no lo es.**

---

### F-8dC2-009 — El grep de `DEC-METH-009` no puede alcanzar el documento del corte ni el inventario de trabajo, y el único término que sí llega es el que `DEC-MIG-004` ya retiró

**Qué se rompe.** La regla que esta pasada existe para medir **no tiene alcance sobre mi vector
entero**, y eso no se ve hasta que se mide: cinco documentos del programa —el corte, la partición,
los dos `spec.md` y las dos `descomposicion.md`— describen el sistema **sin nombrar ni una entidad,
ni un estado, ni una transición**. Una búsqueda por término no produce sobre ellos ninguna
aparición que resolver, así que un arreglo puede cumplir las tres obligaciones al pie de la letra y
dejar los cinco intactos y falsos.

**El camino.**

1. **La regla.** `DEC-METH-009`: *«**Buscarlo con `rg` sobre los capítulos que el commit NO
   toca**, las dos épicas y el núcleo»*, y *«**Cada aparición se resuelve**»*.
2. **La medición**, la tabla del §1.1 de este informe: 21 términos redefinidos por la tanda, contra
   `16-fase-7-del-paraguas.md`, `11-particion-del-programa.md` y los cuatro documentos de
   implementación. **Sobre el documento del corte, 20 de 21 dan cero.** Sobre la partición, 20 de
   21 dan cero. Sobre los cuatro documentos de implementación, 17 de 21 dan cero y los cuatro
   restantes suman 9 apariciones, de las cuales **2 son el hallazgo `F-8dC2-001`** y las otras 7
   son columnas de capítulos y menciones de `B5`/`B6`.
3. **El único término que llega al corte es *«los tres»***, con 2 apariciones — y es exactamente el
   que `DEC-MIG-004` retiró con causa: *«| **16** | el paso 1 cancela «los tres» y el conjunto
   crece con las altas nuevas | …|»*. O sea: **la regla, ejecutada perfectamente sobre el documento
   más caro de equivocar del programa, habría producido una sola aparición, y sobre la única
   pregunta que el owner ya cerró.**
4. **Y el alcance declarado de la regla excluye el inventario de trabajo por definición.** Dice
   *«los capítulos … las dos épicas y el núcleo»*. Los dos `descomposicion.md` y los dos `spec.md`
   **no son capítulos**, así que ni siquiera están en el conjunto que la regla manda barrer — y son
   los documentos donde `F-8dC2-001`, `F-8dC2-002`, `F-8dC2-003` y `F-8dC2-004` viven.
5. **Lo que la regla sí cubrió, para no leer esto como que no sirve.** De mis nueve hallazgos,
   **dos** los encontraba la regla ejecutándola —`F-8dC2-001` con `versiónDePlan` y `F-8dC2-006`
   con `CANCELLED`—, **uno** lo encontraba por el término de la decisión y no por el de la
   transición (`F-8dC2-004`, con *«reembolso»*), **uno** lo tuvo delante y lo resolvió mal
   (`F-8dC2-008`) y **cinco** son inalcanzables. **Proporción: 3 de 9 alcanzables, 1 de 9
   ejecutada.**
6. **Y esto no es el quinto modo que `DEC-METH-009` ya declara no cubrir.** La decisión declara una
   sola exclusión: *«el quinto modo —**un arreglo apoyado en una premisa propia y verdadera que
   envejece sola**—. Ninguna búsqueda de texto lo encuentra»*. Lo de acá es otra cosa: no es una
   premisa que envejece, es **un documento que no contiene ningún término buscable**. Falta
   declararlo igual que aquél.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/01-decision-log.md`, `DEC-METH-009` («Decisión», puntos 2 y 3, y «Lo que NO
  cubre») y `DEC-MIG-004` (fila #16).
- `HOS-1352/docs/16-fase-7-del-paraguas.md` entero; `HOS-1352/docs/11-particion-del-programa.md`
  entero; los dos `spec.md` y las dos `descomposicion.md`.
- Medición propia: la tabla del §1.1, `rg -o` término por término, con los tres no-ceros chicos
  verificados a mano.

**Severidad.** `MEDIA` — es un defecto de método, no de sistema: nadie paga de más por esto. Lo
reporto porque **es la pregunta que la pasada existe para contestar** (§1 de las instrucciones), y
porque la respuesta *«la regla no alcanza»* pide una regla distinta y no una ejecución más
prolija.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: `DEC-METH-009` misma.** No podía existir antes del
2026-09-20, porque la regla no existía. Es la obligación 1 de `DEC-METH-008` aplicada a la propia
`DEC-METH-009`: el dominio que la regla crea es *«el conjunto de documentos sobre los que un `rg`
por término produce apariciones»*, y ese conjunto no incluye a los cinco documentos donde vive la
liberación del programa.

**¿Lo habría encontrado el grep?** No aplica: el sujeto **es** el grep.

---

## 3. Dos cosas que verifiqué de otros informes, porque las iba a usar

**`F-8dA1-007` — *«cinco documentos dicen «las dos» [versiones no vendibles]»*.** La verifiqué
contra el texto del contrato porque `F-8dC2-005` se apoya en la siembra del catálogo. `12-contrato…`
§5.1 dice, textual: *«Lo único que se siembra son las versiones de plan del catálogo: una vendible
… y **las dos no vendibles** que sí guardan lo suyo — la de pre-trial y la de piso»*, y `V/20` §2
define `G-R3` sobre *«una de las **dos versiones no vendibles** de una vertical»*. **La cita de A1
es correcta.** No la uso como hallazgo propio; la registro porque el paso 4 del corte escribe
anclas contra ese catálogo y el número de versiones cambia qué hay que sembrar antes.

**`F-8dB3-001` — las seis puertas a un estado terminal.** La recorrí sobre `B/03` §3.2 y sobre el
párrafo de `B/09` §3. **Las dos citas son correctas** y su recuento de seis está bien hecho *sobre
la tabla*. `F-8dC2-006` no lo contradice: agrega una puerta que **no está en la tabla**, así que el
recuento de B3 sigue siendo el correcto para el sujeto que midió.

---

## 4. Mis 12 hallazgos de la 8-bis-2, reejecutados sobre el texto y el repo de hoy

**No son hallazgos de esta pasada.** Cada camino se volvió a correr.

| id | veredicto | dónde corta, o por qué sigue llegando |
|---|---|---|
| `F-8cC2-001` · la cohorte de altas nuevas y «los tres» | **RETIRADO** | es el ítem **#16** de `DEC-MIG-004`, declarado con causa. No vuelvo sobre él |
| `F-8cC2-002` · el corte no tiene paso para un período ya pagado | **RETIRADO** | ítem **#17** de `DEC-MIG-004`, ídem |
| `F-8cC2-003` · el corte no es idempotente: `PA-5` da `400` al reintentar | **SIGUE entero** | `16-fase-7…` sin tocar desde `e6f4ff3a7`; `PA-5` sigue `VERIFIED`. El gate del paso 2 sigue con una sola salida escrita |
| `F-8cC2-004` · el paso 3 no es un acto y el 4 no es la única escritura | **SIGUE, y empeoró** | `F-8dC2-005`: la escritura de las cortesías pasó de 2 filas a `1 + N` con `2N` referencias no anulables, y el paso 4 ganó dos actos de `SUPER_ADMIN` |
| `F-8cC2-005` · la rama borró las tres checklists de smoke del billing | **SIGUE entero** | medido hoy: `rg -c "SPEC-143-billing-testing-coverage" CLAUDE.md` → **3**, y el directorio sigue sin existir en la rama |
| `F-8cC2-006` · el paso 1 trata al sistema viejo como herramienta y es un actor | **SIGUE entero** | ningún commit de la tanda tocó el corte ni agregó un documento que declare qué hace el sistema actual cuando se lo toca |
| `F-8cC2-007` · la ventana paso 1 → paso 3 deja a los tres sin servicio | **SIGUE**, y con una atenuación ahora explícita | `DEC-MIG-004` le da el remedio humano (*«se la llama»*) pero no acota la ventana del **operador**, que es la que medí |
| `F-8cC2-008` · ni el corte ni la lápida son ítem de ninguna de las 22 unidades | **SIGUE, y ensanchado** | recontado hoy sobre los cuatro documentos de implementación: *«lápida»* **0**, *«FASE 7»* **0**, *«16-fase-7»* **0**. Y `F-8dC2-002` mide que la ausencia no es del corte: son **cuatro capítulos del núcleo** los que no están |
| `F-8cC2-009` · `staging` se declara cubierto por un §4 que no lo nombra | **SIGUE entero** | recontado hoy sobre los tres cuerpos de diseño: `rollout` **0** · `coexistence` **0** · `feature flag` **0** · `acceptance gate` **0** · `rollback` **5**. **Idéntico a la 8-bis y a la 8-bis-2: tres mediciones seguidas sin mover un solo conteo** |
| `F-8cC2-010` · el arreglo 22 cambió el conjunto de personas a llamar | **RESPONDIDO en su parte de fondo** | `DEC-MIG-004` declara el mecanismo humano para *«usuarios, fichas y pagos»*, que es el conjunto ancho. Queda la discrepancia de conteo, que es `F-8cC2-011` |
| `F-8cC2-011` · el umbral se compara contra un conteo que es 5 y 8 | **SIGUE** | `DEC-MIG-004` lo cita como **8** (*«el umbral ya está medido: unas 20 (`B/21` §2.4, hoy 8)»*) y `04-open-decisions.md` sigue diciendo 5. La decisión eligió uno sin decir que elegía |
| `F-8cC2-012` · el punto de no retorno está adentro del paso 3, no antes | **SIGUE entero** | `16-fase-7…` §4.3 sin tocar; `packages/db/CLAUDE.md` sigue con *«Migrations are forward-only - no rollback support»* |

**Conteo: 2 retirados · 0 cortan · 1 respondido en su fondo · 9 siguen llegando.**

Y un dato que corresponde a esta sección y no a un hallazgo: **la fecha límite que la FASE 7 se
pone a sí misma vence pasado mañana.** `16-fase-7…` §2: *«**Se escribe ANTES de que nazca la rama
del paraguas**»*, y `D-28` pone el nacimiento el **2026-09-23**. Hoy es el **2026-09-21**. En los
ocho commits de la tanda **no hay una línea** de los cinco ítems huérfanos.

---

## 5. Ataques que intenté y el diseño resistió

Seis, y valen tanto como los hallazgos.

**1. «Un corte con una sucesión abierta o un pago de `S19` sin resolver rompe todo.»** Lo armé y
**no existe**. El corte cancela en el sistema **viejo** (paso 1) y el esquema nuevo no tiene una
sola fila hasta el paso 4: *«El sistema nuevo no hereda una sola fila»* (`B/21` §2.4) y *«La única
excepción del programa es la lápida»* (`V/21` §2.4). No hay `sucede_a` que apuntar, no hay `S18`
que correr y no hay pago que retener, porque `S19` necesita una predecesora en `GRACE_PERIOD` o
`SUSPENDED` y ninguna existe. **El corte es inmune a la familia entera de la sucesión, y lo es por
construcción, no por suerte.** Lo que sí tocó el corte de esa familia es lo que quedó **alrededor**
del esquema: la escritura del grant (`F-8dC2-005`) y la exención del barrido (`F-8dC2-006`).

**2. «`DEC-GRANT-006` retiró el `scope` y `B/21` §2.4 sigue escribiendo «cada vertical de su
scope»: la migración escribe una columna que no existe.»** Lo verifiqué contra el texto y
**no se sostiene**. `DEC-GRANT-006` retira el `scope` de **`courtesy_grant`**, y `B/21` §2.4 escribe
las dos cortesías heredadas como **`permanent_grant`**, que es otro instrumento. Y para el grant el
`scope` tampoco es una columna sino un derivado declarado: *«**El scope de verticales NO es una
columna: son sus anclas**»* (`B/02` §2.4) y *«**el scope ES el conjunto de anclas**: no es una
columna aparte que pueda contradecirlas»* (`12-contrato…` §2.8). La frase *«cada vertical de su
scope»* es correcta con el significado nuevo. **Los dos instrumentos quedaron bien separados, y la
asimetría está argumentada** en `DEC-GRANT-006` con un criterio que se puede evaluar: revocar se
puede olvidar, vencer no.

**3. «`DEC-TRIAL-008` agranda la frontera: quien está `SUSPENDED` recibe trial, así que algo de
cobranza cruzó.»** No, y es lo contrario. La decisión **rechaza** el segundo hecho justamente para
que no cruce, y el contrato §4 lo escribe con el costo declarado: *«**El owner decidió pagar ese
precio y NO agregar el segundo hecho** … **Esta frontera no se vuelve a abrir por este caso.**»*
Medí la frontera después de la tanda y sigue siendo **un hecho y un aviso**; lo único que se le
agregó es la dirección inversa del §4.1, que es de la FASE 9 y está declarada. **La partición
aguantó la tanda entera.**

**4. «Las dependencias entre épicas ya no son dos: el ancla del grant crea una tercera.»** Lo
intenté con ganas, porque `HOS-1354/descomposicion.md` §2.6 se juega entero ahí —*«Esas dos, y
ninguna más. Si aparece una tercera, es la señal del contrato §4»*— y **`B9` sí necesita `plan` y
`plan_version`, que son de `V2`**. Pero la dependencia **no la creó esta tanda**: nació con
`DEC-GRANT-005` el 2026-09-19, cuando el grant se ancló al plan. El arreglo 4 la **profundizó** —le
agregó el `piso_del_trinquete` y la restricción *«el plan pertenece a esa vertical»*— y esa mitad
sí es nueva, pero ya la tiene `F-8dA3-003` desde el lado de la lectura inversa. **No duplico un
hallazgo ajeno para subirle el conteo al mío**: lo dejo anotado en la §6 para `C1`.

**5. «El orden del corte está mal: con `S19` y el pago en vuelo habría que desplegar primero.»**
No. El argumento del §4.2 sigue siendo el mejor del programa —*«Si entra un cobro en vuelo, **lo
registra el viejo** … Al revés, con el despliegue primero, ese mismo cobro cae en el vacío»*— y la
tanda **lo refuerza**: ahora el sistema nuevo tiene todavía más lugares donde un pago desconocido
puede ser mal imputado (`B/05` §3, `S19`, la re-vinculación automática del `B/09` §2.4). Cancelar
antes sigue siendo lo correcto.

**6. «El paraguas se puede partir ahora que `B6` bloquea todo: que salga verticales sola.»** Lo
intenté por tercera vez y **falla igual**, y esta vez con un argumento nuevo en contra: la
implementación de arranque del contrato **resuelve dos fuentes** (§5.1) y su guard `G13` nace en
`B4`, o sea del lado que está bloqueado. Sacar verticales sola exigiría o bien la tercera
implementación que §5.3 descartó, o bien liberar sin `G13`, que es *«la única de las tres [defensas]
que convierte «no lo hagas» en «no se puede»»* (§6.3). **La partición aguanta.**

---

## 6. Fuera de mi vector

- **`NUCLEO` → `C1`** — `nucleo/04`, `nucleo/07` y `nucleo/08` no son de ninguna de las 22 unidades
  (`F-8dC2-002`), y `nucleo/00-indice.md` es el documento que declara qué vive ahí. La decisión de
  si el núcleo se construye como unidad propia, se reparte, o se declara *«no construible»* toca el
  índice del núcleo, que es de `C1`. Y los cinco ítems huérfanos de la FASE 7 —`rollout`,
  `coexistence`, `feature flags`, `rollback`, `acceptance gates`— siguen con **cero apariciones**
  en `nucleo/`, tercera medición consecutiva sin cambio.

- **[`C1` — la costura]** `HOS-1354/docs/21-migracion.md` **sigue con sus secciones fuera de
  orden**: §1 → §1.3 → §3 → §3.3 → **§2.4** → §2.5 → §4. Y el §3.3 sigue declarando **abierta**
  —*«No se completa en silencio (§67). Queda declarada como decisión del owner»*— una pregunta que
  `DEC-MIG-002` cerró y que `DEC-MIG-004` volvió a cerrar. Es el tercer informe que lo reporta,
  intacto.

- **[`C1` — la costura]** La tercera dependencia entre épicas del §4 de arriba: `B9` sobre `V2`.
  Compone con `F-8dA3-003` (la lectura de `plan.vertical`) y con `F-8dA1-004` (el trinquete
  resuelto sobre un piso que la fuente no transporta). Los tres miran la misma columna desde tres
  lados; **si son uno o tres defectos lo decide el que deduplica**, y no soy yo.

- **[`A2` / `B2` — máquinas]** `F-8dC2-004` supone que `S18` puede correr; si `F-8dB1-002` tiene
  razón y la base rechaza su escritura, la rama 1 no llega ni a poner la marca y el reembolso no
  tiene ni siquiera un caso que confirmar. La mitad *«la transición no puede ejecutarse»* es de
  ellos; la mitad *«la unidad que la ejecuta no existe»* es mía.

- **[repo, no diseño]** `F-8cC2-005` sigue entero y su ventana se acorta: el gate manual del
  billing que el `CLAUDE.md` del repo declara *«no negociable»* apunta a tres archivos que esta
  misma rama borró, y el PR que lo va a destapar es el que `DEC-ARCH-007` describe como el que
  *«nadie puede revisar de verdad»*.

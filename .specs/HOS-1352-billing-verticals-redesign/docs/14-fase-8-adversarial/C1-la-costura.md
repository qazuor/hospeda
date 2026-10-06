---
title: "FASE 8 · C1 — la costura: capítulos partidos, contrato e invariantes"
linear: HOS-1352
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 8
---

# FASE 8 · C1 — la costura

Pasada final sobre el **conjunto**. No ataco ninguna de las dos mitades: ataco **la costura** —lo
que se perdió al partir los once capítulos, el contrato de cobertura como objeto propio, los
invariantes del núcleo leídos de una vez, y las seis reglas de lectura del núcleo aplicadas a las
nueve máquinas.

Catorce hallazgos: **3 `CRITICA`**, **5 `ALTA`**, **5 `MEDIA`**, **1 `BAJA`**.

**Método, para que sea refutable.** Los originales del desarme no se perdieron: viven en
`966189003^` (los 22 capítulos de `09-master-spec/`, retirados en `966189003` y `9796d4e2b`). Todo
lo que digo abajo sobre «qué se perdió» está **medido contra esos originales**, encabezado por
encabezado, fila por fila y elemento por elemento, no estimado. El inventario completo está en
[Lo que el desarme perdió](#lo-que-el-desarme-perdió).

---

## CRITICAS

### F-8C1-001 — La regla que gobierna las tres partes es falsa desde el día que se escribió

**Qué se rompe.** El índice del núcleo declara que **el núcleo es el único lugar donde algo se
define** y que las épicas no redefinen una entidad. Medido: de las **24 entidades** del modelo, el
núcleo define **2** y las épicas definen **22** localmente, con sus restricciones de unicidad. La
regla no describe el diseño: lo contradice. Y ya produjo un hallazgo mal fundado — `F-8B3-019`
razona *«el capítulo 02 es, por la regla del índice, el único lugar donde una entidad se define»*
sobre un capítulo 02 del núcleo que **ya no define ninguna entidad de negocio**.

**El camino.**

1. Alguien de FASE 9 toma la regla al pie de la letra: para agregar una columna a `subscription`,
   va al núcleo. En el núcleo no está `subscription`: está `domain_event` y `outbox`, y nada más.
2. Busca dónde sí está, y la encuentra en la épica de billing — o sea en el lugar donde la regla
   dice que **no** puede estar. Concluye, razonablemente, que la regla ya no rige, y a partir de
   ahí la segunda mitad de la regla —*«si una épica necesita algo que el núcleo no tiene, se
   agrega al núcleo, no se declara localmente»*— tampoco.
3. La épica de verticales necesita cinco valores de configuración por vertical que hoy no tienen
   columna (`F-8A3-006`). Los declara localmente, que es lo que la regla prohíbe y lo que el
   desarme ya hizo 22 veces.
4. Y en paralelo, dos reglas que **apuntan a «el capítulo 02» en singular** dejan de resolver: la
   regla 2 del capítulo 03 (*«el capítulo 02 fija la restricción»*) y el guard `G3` del capítulo
   02 §1.2. «El capítulo 02» es hoy **tres documentos con contenidos disjuntos**.

**Dónde lo permite el diseño.**

`HOS-1352/docs/nucleo/00-indice.md`, «Cómo se relacionan las tres partes» —el documento se
actualizó el 2026-09-18, o sea **el mismo día del desarme**, y la frase quedó:

> **El núcleo es el único lugar donde algo se define.** Los capítulos de las dos épicas describen
> comportamiento y **referencian** el núcleo; no redefinen una entidad, un estado ni un invariante.
> Si una épica necesita algo que el núcleo no tiene, se agrega al núcleo — no se declara
> localmente.

Contra la medición, entidad por entidad:

| documento | entidades que define |
|---|---|
| `nucleo/02-modelo-de-datos.md` §2.6 | **2**: `domain_event`, `outbox` |
| `HOS-1353/docs/02-modelo-de-datos.md` §2.1, §2.2, §2.5 | **7**: `vertical`, `plan`, `plan_version`, `plan_version_entitlement`, `plan_version_limit`, `trial`, `listing` |
| `HOS-1354/docs/02-modelo-de-datos.md` §2.1–§2.4 | **15**: `billing_option`, `subscription`, `subscription_pause`, `provider_link`, `payment`, `refund`, `manual_payment`, `receipt`, `idempotency_key`, `addon_product`, `addon_instance`, `promo_code`, `promo_redemption`, `courtesy_grant`, `permanent_grant` |

Y `HOS-1352/docs/11-particion-del-programa.md` §4 es la decisión que lo ordenó así — fila 02:
*«**PARTIDO** — §2.1 menos `billing_option`, §2.5 y §3 a verticales; §2.2, §2.3 y §2.4 a
billing»*. O sea: **el reparto aprobado manda exactamente lo que el índice prohíbe**, y los dos
documentos son del mismo día.

**Severidad** — `CRITICA`.

**Necesita decisión del owner.** **Sí.** Las dos salidas son opuestas y las dos tienen costo: o el
núcleo recupera el capítulo 02 entero (y entonces el corte de `DEC-ARCH-005` deja de pasar por
dentro del modelo de datos, que es su §2.1), o la regla se reescribe para decir qué se define en el
núcleo y qué en una épica — y entonces hay que decir **quién** decide de qué lado cae una entidad
nueva, que es justamente lo que la regla venía a evitar.

---

### F-8C1-002 — Tres de las seis reglas de lectura del núcleo sólo tienen remedio del lado de billing

**Qué se rompe.** El capítulo 03 del núcleo declara **seis reglas que valen para las nueve
máquinas**, y es el único artefacto compartido que gobierna a las dos épicas a la vez. Medido:
**tres de las seis** (la 1, la 3 y la 6) se resuelven contra secciones o estados que existen
**únicamente** en la épica de billing. La épica de verticales —que es la que arranca primero, y la
única que va a tener código durante meses— hereda tres reglas sin nada con qué cumplirlas.

**El camino.**

1. **Regla 1.** *«Un intento de transición que la tabla no declara no se ejecuta: se registra como
   evento de dominio y, si tocaba plata o estado, emite `RECONCILIATION_REQUIRED`.»* Alguien
   intenta `ARCHIVED → PUBLISHED` (el caso de `F-8A2-008`) o `TRIAL_EXPIRED → TRIAL_ACTIVE`. Eso
   **cambia estado**, así que la regla pide emitir `RECONCILIATION_REQUIRED`. Ese valor no existe
   en ninguna máquina de verticales: es un estado de la máquina de **Suscripción**
   (`HOS-1354/docs/03` §3.1) y su tratamiento es el capítulo 09, también de billing. Las tres
   máquinas de verticales no tienen a dónde emitirlo, y el §22.1 que lo define no vive en su épica.
2. **Regla 3.** *«Una transición es atómica junto con sus efectos locales»*, y el propio texto
   deriva su desarrollo: *«el capítulo 05 (épica de billing) lo desarrolla para el proveedor»*. El
   capítulo 05 es `BILLING` entero por el reparto. La épica de verticales tiene tres máquinas, un
   reconciliador y cinco relojes, y **ninguna regla de aislamiento entre dos transiciones
   concurrentes** — que es exactamente `F-8A2-013`, visto desde su causa y no desde su síntoma.
3. **Regla 6.** *«Grace y Pause… se describen en §4 y §5.»* El §4 y el §5 del capítulo 03 viven en
   `HOS-1354`. La regla está escrita sin decirlo: un lector del núcleo —que es el documento
   **compartido**— sigue la referencia y no llega a ninguna parte desde la otra épica.

**Dónde lo permite el diseño.**

`HOS-1352/docs/nucleo/03-maquinas-de-estado.md` §1, las tres reglas, textuales:

> 1. **La tabla de transiciones es exhaustiva.** Lo que no está, no pasa. Un intento de transición
>    que la tabla no declara **no se ejecuta**: se registra como evento de dominio y, si tocaba
>    plata o estado, emite `RECONCILIATION_REQUIRED` (§22.1).
> 3. **Una transición es atómica junto con sus efectos locales.** […] el capítulo 05 (épica de
>    billing) lo desarrolla para el proveedor.
> 6. **Grace y Pause no son máquinas independientes** […] Se describen en §4 y §5.

Y el encabezado del mismo documento declara el alcance sin excepción: *«las seis reglas de lectura
que valen para todas las máquinas»*.

El reparto que lo produjo: `HOS-1352/docs/11-particion-del-programa.md` §4, fila 05 —
*«idempotencia y concurrencia | **BILLING**»*— y su remate: *«**Cinco capítulos son billing sin una
sola fisura**: 05, 06, 09, 12 y 14»*.

**Severidad** — `CRITICA`.

**Necesita decisión del owner.** **Sí.** `F-8A2-013` ya lo plantea para la regla 3 («¿el capítulo
05 pasa a `nucleo/` o verticales escribe el suyo?»). Lo que agrego es que **no es una regla: son
tres**, y que el remedio de la regla 1 —`RECONCILIATION_REQUIRED`— es un **estado del vocabulario
común** que hoy sólo una máquina posee. Decidir sólo por el 05 deja las otras dos abiertas.

---

### F-8C1-003 — Las tres defensas del contrato son «ninguna opcional», y ninguna tiene dueño de este lado

**Qué se rompe.** El contrato de cobertura es lo único que cruza la frontera y vive afuera de las
dos épicas para que ninguna lo mute sola. Declara **tres defensas** y dice que *«ninguna es
opcional»* y que las tres son **parte de la decisión**, no una recomendación. Medido: de las tres,
**ninguna está asignada a una unidad de la épica que arranca**, y la única que convierte *«no lo
hagas»* en *«no se puede»* nace en la épica **bloqueada por la pasarela**. El contrato entra en
producción con sus tres defensas a cargo del lado que todavía no puede construir.

**El camino.**

1. **Defensa §6.1 — «el default es negar».** No tiene guard, ni caso, ni unidad. La descomposición
   de verticales la nombra dentro de `V4` sólo como propiedad de la implementación de arranque. Es
   una convención, que es el escalón que el capítulo 04 §1 obliga a **declarar como tal** cuando se
   baja a él, con razón escrita. No hay razón escrita.
2. **Defensa §6.2 — «un solo juego de casos corre contra las dos implementaciones».** Sólo la
   descomposición de billing la nombra, y para justificar el orden de `B4`. **Ninguna de las dos
   descomposiciones declara quién escribe ese juego de casos**, ni en qué unidad, ni con qué
   criterio de terminación. La tabla §4 de la descomposición de verticales —*«lo que cada unidad
   tiene que dejar demostrado»*— no lo menciona en `V4` ni en ninguna otra.
3. **Defensa §6.3 — «un guard impide que la implementación de arranque llegue a producción».** Es
   `G13`. Nace en `B4`, épica de billing, y las dos descomposiciones lo dicen con el mismo
   argumento: mientras la de arranque sea la única implementación, el guard falla desde el primer
   día. El argumento es correcto. La consecuencia que nadie escribió es que **durante toda la vida
   de la épica de verticales no existe ningún mecanismo que impida que la implementación de
   arranque llegue a producción**, y `DEC-ARCH-007` sólo lo impide como política, no como forma.
4. Y `G13` no está en el catálogo de guards: el capítulo 20 —el capítulo que se presenta como *«los
   guards, en un solo lugar… lo que permite preguntar «¿están todos?» una vez»*— lista once, y
   `G12` y `G13` se numeran en una **descomposición**, que es un documento de plan, no de diseño.

**Dónde lo permite el diseño.**

`HOS-1352/docs/12-contrato-de-cobertura.md` §6, el encabezado:

> Ninguna es opcional, y las tres son parte de la decisión (`DEC-ARCH-006`), no una recomendación.

§6.3:

> Es la única de las tres que convierte *«no lo hagas»* en *«no se puede»*, que es la misma razón
> por la que `DEC-ARCH-004` pidió su condición A.

`HOS-1353/descomposicion.md` §2.3:

> Esta tabla dejó a **V4 sin guards** […] Nace en **B4** de la otra épica, que es donde aparece la
> segunda implementación. Queda anotado acá para que nadie lo lea como un olvido.

`HOS-1354/descomposicion.md` §2.1, que admite que el catálogo no los tiene:

> El `20` §2 lista cuatro —`G7`, `G9`, `G10`, `G11`—. **Faltan dos que dos decisiones exigen
> explícitamente**, y se numeran acá para poder asignarlos a una unidad; si el `20` se reescribe,
> los absorbe.

**Severidad** — `CRITICA`.

**Necesita decisión del owner.** **Sí.** `DEC-ARCH-006` declaró las tres defensas parte de la
decisión. Que dos de las tres no tengan dueño y la tercera dependa de la épica bloqueada es, en los
hechos, una modificación de esa decisión tomada por el reparto de unidades. Hay que decidir si el
contrato se libera con menos defensas que las que declara, o si `§6.2` y `§6.1` ganan dueño en
`V4`.

---

## ALTAS

### F-8C1-004 — Cuatro de los once capítulos `PARTIDO` no se partieron nunca, y el reparto no se corrigió

**Qué se rompe.** La tabla del §4 de la partición es **la decisión del owner del 2026-09-18** sobre
por dónde pasa el corte, y dice `PARTIDO` en once filas. El desarme partió **siete**. Los otros
cuatro —`01` glosario, `04` invariantes, `07` outbox, `08` auditoría— quedaron **enteros en el
núcleo**, con el reparto de su contenido escrito en la tabla y nunca ejecutado ni retractado. Las
dos anomalías ya encontradas —`F-8A2-013` (verticales sin capítulo de concurrencia) y `F-8A3-014`
(Mi Cuenta del lado equivocado)— son instancias de lo mismo: **el desarme ejecutado no coincide con
el reparto decidido, y no hay ningún lugar donde eso se pueda ver.**

**El camino.**

1. La tabla del §4 declara `PARTIDO` en: 01, 02, 03, 04, 07, 08, 10, 19, 20, 21 y 22. Son **once**.
2. El §4.1 del mismo documento —la corrección que se escribió **ese mismo día** para arreglar el
   otro error de esa sección— dice: *«Los siete capítulos mixtos se partieron de verdad»*. Son
   **siete**: 02, 03, 10, 19, 20, 21, 22. Verificado contra los archivos que hoy existen.
3. Los cuatro restantes viven enteros en `nucleo/`. Para dos de ellos —01 y 04— el índice sí
   escribió un motivo (*«un glosario en dos mitades deja de ser un glosario»*). Para **07 y 08 no
   hay ni una línea**, y su fila del §4 sigue describiendo un reparto que no ocurrió: *«del catálogo
   de correos, los dos del trial a verticales y el resto a billing»* y *«del catálogo de acciones
   admin, la postulación de Partner y la extensión de trial a verticales»*.
4. La consecuencia no es cosmética. Alguien de FASE 9 que quiera saber **qué le toca a verticales**
   abre la tabla del §4 —que es la fuente declarada del reparto— y lee cuatro filas que describen
   mitades que no existen. Y al revés: el §4.1 existe precisamente como el registro de que la
   sección se equivocó una vez, y **no registra esta segunda divergencia**, así que quien lo lea va
   a creer que la corrección ya alcanzó a todo.

**Dónde lo permite el diseño.**

`HOS-1352/docs/11-particion-del-programa.md` §4, la tabla completa. Y §4.1, que corrige lo otro y
no esto:

> **Corregido el 2026-09-18, el mismo día.** Esta sección decía que los capítulos quedaban donde
> estaban y que la tabla era sólo un índice de lectura. […] **Lo que efectivamente se hizo** […]
> Los siete capítulos mixtos se partieron de verdad, y **los originales se retiraron**.

Contra `nucleo/00-indice.md`, «Las tres partes», que lista los siete del núcleo —00, 01, 02, 03,
04, 07, 08— sin marcar que cuatro de ellos figuran como `PARTIDO` en el reparto aprobado.

**Severidad** — `ALTA`.

**Necesita decisión del owner.** **Sí**, en un punto acotado: si el reparto decidido es el que
manda —y entonces 07 y 08 tienen mitades pendientes— o si el ejecutado es el que manda, y entonces
la tabla del §4 tiene cuatro filas que hay que reescribir. No se puede dejar con las dos versiones
vivas, porque es la única tabla que dice de quién es cada cosa.

---

### F-8C1-005 — Las cuatro «listas únicas» se partieron y las dos mitades siguen diciendo que están completas

**Qué se rompe.** Hay cuatro secciones en el programa cuyo **valor entero es estar completas y en
un solo lugar** — lo dicen ellas mismas. El desarme las partió y **copió verbatim en las dos
mitades la frase que afirma la completitud**. Hoy hay ocho documentos, cada uno con una lista
parcial y con una oración que dice que la lista está junta. Quien lea cualquiera de los ocho va a
creer que la tiene entera.

**El camino.** Las cuatro, medidas contra el original:

| sección | qué afirma de sí misma | original | verticales | billing |
|---|---|---|---|---|
| cap. 19 §4 «lo que hay que decir» | *«la lista […] que nadie tiene junta»* | 14 filas | 5 (1, 2, 4, 8, 9) | 9 (3, 5, 6, 7, 10–14) |
| cap. 20 §2 «los guards, en un solo lugar» | *«lo que permite preguntar «¿están todos?» una vez en vez de siete»* | 11 filas | 7 (G1–G6, G8) | 4 (G7, G9–G11) |
| cap. 20 §5 «E2E: lo que hoy se hace a mano» | *«los flujos críticos»* | 8 ítems | **1**, numerado `7.` | 7 (1–6, 8) |
| cap. 22 §4 «el resumen, para llevar a la consulta» | *«Las seis preguntas»* | 6 filas | **1** (la 5) | 5 (1, 2, 3, 4, 6) |

Y lo que queda alrededor de cada mitad:

1. **Cap. 19 §4.1 — «Dos reglas sobre cómo se dicen»** quedó **sólo en billing**. Son las reglas
   que gobiernan la redacción de **los catorce** avisos, incluidos los cinco de verticales: *«la
   confirmación dice qué va a pasar, no pregunta si estás seguro»* y *«cada aviso lleva la fecha de
   ese cliente, no una global»*. La mitad verticales tiene sus cinco filas y ninguna de las dos
   reglas.
2. **Cap. 20 §5 de verticales** es un encabezado y **un solo elemento de lista ordenada numerado
   `7.`**, sin el párrafo que lo introduce y sin el que lo cierra —*«Lo que E2E no reemplaza es el
   smoke contra el proveedor real»*—, que quedó sólo en billing.
3. **Cap. 22 §4 de verticales** es una tabla de una fila, y el bullet que la sigue, verbatim en las
   dos mitades, dice: *«**Las seis preguntas**, por definición»*. La mitad billing remata su tabla
   de cinco filas con *«**Las seis** piden revisión profesional»*.

**Dónde lo permite el diseño.**

`HOS-1353/docs/19-superficies.md` y `HOS-1354/docs/19-superficies.md`, encabezado **idéntico en las
dos**:

> el más largo en una sola cosa: **la lista de lo que hay que decirle a la gente**, que los
> capítulos anteriores fueron dejando y **que nadie tiene junta**.

`HOS-1353/docs/20-testing.md` §2 y `HOS-1354/docs/20-testing.md` §2, **idéntico en las dos**:

> Los capítulos anteriores fueron dejando guards y cada uno explicó el suyo. Acá está la lista, que
> es lo que permite preguntar *«¿están todos?»* una vez en vez de siete.

`HOS-1353/docs/22-lo-legal.md`, «Lo que este capítulo NO cierra», bajo una tabla de una fila:

> - **Las seis preguntas**, por definición.

Y la verificación que no podía verlo: `HOS-1352/docs/11-particion-del-programa.md` §4.1 —*«105 de
105 encabezados presentes en alguna mitad»*—. Los cuatro encabezados están. **Lo que se partió es
lo de adentro, y la frase que afirma que no se partió viajó a las dos mitades.**

**Severidad** — `ALTA`.

**Necesita decisión del owner.** **No.** Es reparación: o la lista vuelve a un solo lugar (el
núcleo, o un documento de frontera como el contrato), o la frase de completitud se retira de las
ocho mitades y cada una dice cuántas filas tiene y dónde están las otras.

---

### F-8C1-006 — «Las dos épicas no se referencian entre sí» es falso 33 veces, y lo escribió el desarme

**Qué se rompe.** El índice del núcleo declara que lo único que cruza entre las dos épicas es el
contrato de cobertura. Medido sobre los archivos de hoy: **33 referencias cruzadas explícitas** —16
de verticales hacia billing, 17 de billing hacia verticales— y **ninguna es el contrato**. Trece de
ellas apuntan a un **capítulo** de la otra épica. Las anotaciones *«(épica de billing)»* y *«(épica
de verticales)»* que las marcan **las insertó el propio desarme**, así que el documento que declara
que no existen y los documentos que las contienen son del mismo día y del mismo autor.

**El camino.**

1. La regla existe para que cada épica se pueda leer sola. Las dos specs la repiten como propiedad:
   `HOS-1353/spec.md` §2 dice *«ninguno de ellos necesita leer uno de la épica de billing para estar
   completo»*.
2. Medido, por archivo:

| épica | referencias a la otra | dónde |
|---|---|---|
| `HOS-1353` → billing | **16** | `spec.md` 3 · `02` 4 · `03` 2 · `10` 1 · `15` 2 · `18` 1 · `descomposicion.md` 1 |
| `HOS-1354` → verticales | **17** | `spec.md` 2 · `02` 2 · `03` 1 · `12` 1 · `14` 3 · `16` 4 · `19` 3 · `descomposicion.md` 1 |

3. Y no son todas decorativas. `HOS-1353/docs/15` cierra delegando dos huecos a los capítulos 14 y
   16 de billing; `HOS-1354/docs/16` §4.2 **reutiliza el reconciliador del capítulo 15 de
   verticales**; `HOS-1354/docs/21` §3.2(a) manda transcribir *«según §2.3»*, que está en la otra
   épica (`F-8A3-009`). Una referencia cruzada que dice *«esto lo resuelve un capítulo que no
   tenés»* es, operativamente, una dependencia.
4. La regla de vigilancia que debería haberlo detectado está escrita **sin destinatario**: el
   contrato §4 dice *«si aparece un quinto lugar […] Se mira, no se resuelve en el lugar»*. Nadie
   es «se». No hay guard, no hay unidad, no hay revisión periódica, y el umbral —«un quinto
   lugar»— ya se pasó por treinta.

**Dónde lo permite el diseño.**

`HOS-1352/docs/nucleo/00-indice.md`, «Cómo se relacionan las tres partes»:

> **Y las dos épicas no se referencian entre sí.** Lo único que cruza es el contrato de cobertura
> ([`12-contrato-de-cobertura.md`](../12-contrato-de-cobertura.md)), que vive afuera de las dos
> justamente para que ninguna lo pueda mutar sola.

`HOS-1352/docs/12-contrato-de-cobertura.md` §4:

> **Regla de vigilancia**: si aparece un quinto lugar que necesita algo de billing **y no es este
> hecho**, es señal de que el corte se está filtrando. Se mira, no se resuelve en el lugar.

**Severidad** — `ALTA`.

**Necesita decisión del owner.** **No** para el conteo. **Sí** para una cosa: la regla de
vigilancia es hoy la única defensa declarada contra la filtración del corte y no tiene
destinatario. Decidir si eso es un guard, una unidad o una revisión de FASE 9 es una decisión de
método, no de diseño.

---

### F-8C1-007 — `G7` quedó entero en billing, y vigila dos invariantes que verticales ya incumple

**Qué se rompe.** El invariante §64.15 —*«toda configuración comercial viene de la base»*— y su
gemelo §64.16 son, según el capítulo 04 del núcleo, **invariantes de nivel guard**, y ese guard es
`G7`. El reparto mandó `G7` **entero a billing**. La épica de verticales queda con siete guards que
su propia spec presenta como el conjunto completo, y **sin el único que vigila el invariante que
`F-8A3-006` ya midió que va a incumplir** en cinco valores de configuración distintos.

**El camino.**

1. `F-8A3-006` mide cinco valores que los capítulos de verticales declaran configurables y que no
   tienen columna en ninguna entidad: el techo de días de trial, el evento de activación de cada
   vertical, la espera tras un rechazo de postulación, el `N` de `PB5` y los overrides del plan de
   trial.
2. Quien implemente `V1`…`V9` los escribe como constantes, porque no hay dónde más.
3. El guard que falla ante eso es `G7` —*«un valor comercial vive en código»*—, y vive en
   `HOS-1354/docs/20-testing.md`. La unidad que lo construye es `B2`, de la otra épica.
4. `G3`, que sí está en verticales, **no lo atrapa**: verifica **claves** contra la base en las dos
   direcciones, no **valores**. `F-8A3-006` lo dice con esas palabras.
5. Resultado: la épica que arranca primero construye nueve unidades enteras sin ninguna defensa
   mecánica contra el defecto que el §1 del PDR nombra como la causa de este programa.

**Dónde lo permite el diseño.**

`HOS-1352/docs/nucleo/04-invariantes.md` §2.3, que clasifica los dos invariantes en nivel guard:

> | 15 | toda configuración comercial viene de la base | […] ningún valor, precio ni asignación vive
> en código |
> | 16 | los archivos de configuración no son fuente de negocio | el mismo guard que el 15 |

`HOS-1352/docs/11-particion-del-programa.md` §4, fila 20:

> **PARTIDO** — los guards `G1` a `G6` y `G8` a verticales; `G7`, `G9`, `G10`, `G11`, el proveedor
> falso y la suite de sandbox a billing

`HOS-1353/spec.md` §5, que presenta el subconjunto como el conjunto:

> **Siete guards**, y cada uno **lleva un caso que lo hace fallar a propósito**

**Severidad** — `ALTA`.

**Necesita decisión del owner.** **No.** `G7` no es un guard de dinero: es un guard de
configuración, y el invariante que sostiene rige en las dos épicas. El reparto lo mandó a billing
por asociación con el precio, que es lo que el propio §2.2 de la partición advierte que no hay que
hacer (*«no es «lo que menciona a billing»»*).

---

### F-8C1-008 — La mitad verticales del cap. 20 promete un §3 que no tiene y declara una capa ajena

**Qué se rompe.** El capítulo 20 abre declarando las **dos** cosas que resuelve, y la mitad
verticales conservó esa declaración **entera** mientras se quedó con una sola. Además su tabla de
las cuatro capas de testing incluye una capa —la suite de sandbox del proveedor— cuyo contenido, su
alcance y su límite viven en la otra épica. Quien implemente `V1`…`V9` leyendo este capítulo cree
tener una estrategia de testing completa y le faltan dos de sus cuatro capas.

**El camino.**

1. La apertura, verbatim en la mitad verticales: *«Este capítulo dice qué va en cada una y, sobre
   todo, resuelve las dos cosas que el §62 deja sin decir […]: **qué tiene que mentir el proveedor
   falso (§3)** […] **qué son exactamente los guards (§2)**»*. El documento **no tiene §3**: salta
   de §2.1 a §5.
2. Su §1 declara cuatro capas y una de ellas es *«**sandbox del proveedor** (§62.3) | «suite real
   más pequeña pero obligatoria» | Mercado Pago sandbox»*. El §4, que dice qué es esa suite y qué
   prueba, está en billing.
3. Su §5 es el encabezado más **un solo ítem numerado `7.`** (ver `F-8C1-005`).
4. Y el §6 —*«Una regla que atraviesa las cuatro capas: ninguna aserción se escribe sobre un código
   de estado»*— quedó **sólo en billing**, aunque su título declara alcance sobre las cuatro capas
   que la mitad verticales también enumera.
5. La consecuencia concreta: `HOS-1353/docs/20-testing.md` §1 afirma que la capa de dominio e
   integración cubre *«**carreras** e **idempotencia**»*, y `F-8A2-013` ya midió que ningún capítulo
   de esa épica dice contra qué regla se comprueban. Las dos mitades del mismo defecto —no hay
   regla, y el capítulo que la traía se fue— se tocan acá.

**Dónde lo permite el diseño.**

`HOS-1353/docs/20-testing.md`, apertura y §1, citados arriba; y su índice real de secciones: `1`,
`2`, `2.1`, `5`. Contra `HOS-1354/docs/20-testing.md`, que tiene `1`, `2`, `2.1`, `3`, `3.1`, `3.2`,
`3.3`, `4`, `5`, `6`.

`HOS-1352/docs/11-particion-del-programa.md` §4, fila 20, que reparte los guards y la suite de
sandbox y **no dice nada** de las capas ni del §6.

**Severidad** — `ALTA`.

**Necesita decisión del owner.** **No.**

---

## MEDIAS

### F-8C1-009 — `cobertura()` tiene dos firmas vivas, y la que está fuera del contrato es la superada

**Qué se rompe.** El contrato existe para que la frontera tenga **una** definición. Hay dos, las
dos `CURRENT`, las dos actualizadas el 2026-09-18, y **la de afuera es la que el propio contrato
argumenta que está mal**. La partición —que es el documento que la gente va a leer primero, porque
es el que explica el corte— devuelve `fuente` en singular; el contrato devuelve `fuentes` como
lista y dedica su §2.2 a explicar por qué el singular no alcanza.

**El camino.**

1. `11-particion-del-programa.md` §3 declara: `cobertura(user, vertical) → { tiene_título_vivo,
   fuente, hasta_cuándo }`. Tres campos,`fuente` singular.
2. `12-contrato-de-cobertura.md` §2 declara: `cobertura(user, vertical) → { cubierto, fuentes: [ {
   tipo, versiónDePlan, hasta } ] }`. Campos distintos, y`fuentes` es una lista de objetos.
3. El contrato §2.2 se titula *«`fuentes` es una lista, y eso no es de más»* y da el caso concreto
   —*«quitar una fuente no quita la cobertura si queda otra»*— o sea que la firma de la partición
   es exactamente la que el contrato descarta con su nombre.
4. Y la tabla *«el mismo hecho, en cuatro lugares»* está **duplicada literal** en los dos
   documentos (partición §3 y contrato §1.1). `DEC-ARCH-006` protege al contrato de que una épica lo
   mute sola; nada protege a esta copia, que ya divergió.

**Dónde lo permite el diseño.**

`HOS-1352/docs/11-particion-del-programa.md` §3:

> ```text
> cobertura(user, vertical) → { tiene_título_vivo, fuente, hasta_cuándo }
> ```

`HOS-1352/docs/12-contrato-de-cobertura.md` §2.2:

> Podría parecer que alcanza con `cubierto`. No alcanza […] **quitar una fuente no quita la
> cobertura si queda otra.**

**Severidad** — `MEDIA`.

**Necesita decisión del owner.** **No.**

---

### F-8C1-010 — El catálogo de guards dice once, las descomposiciones dicen trece, y la spec dice siete

**Qué se rompe.** El capítulo 20 §2 se declara *«los guards, en un solo lugar»*, y hoy hay **tres
conteos vivos** del mismo conjunto. El más chico —siete— es el que la spec de la épica que arranca
presenta como su verificación completa; el más grande —trece— vive en documentos de plan que el
diseño no gobierna.

**El camino.**

1. Capítulo 20, original y suma de las dos mitades: **once** (`G1`–`G11`).
2. `HOS-1354/descomposicion.md` §2.1 agrega `G12` (SDK fuera del adaptador, condición A de
   `DEC-ARCH-004`) y `G13` (la implementación de arranque en producción, contrato §6.3): **trece**.
   Los dos salen de decisiones aprobadas, no de una ocurrencia.
3. `HOS-1353/spec.md` §5: *«**Siete guards**»*, presentados como la respuesta a *«cómo se comprueba
   que está bien»*.
4. Nada obliga a que los tres conteos converjan: la descomposición lo admite —*«si el `20` se
   reescribe, los absorbe»*— en condicional, sin dueño ni fecha. Y `G12` y `G13` son los guards de
   las dos condiciones que `DEC-ARCH-004` y `DEC-ARCH-006` declaran obligatorias, o sea los dos que
   menos pueden vivir en un documento de plan.

**Dónde lo permite el diseño.** `HOS-1353/docs/20-testing.md` §2 y `HOS-1354/docs/20-testing.md`
§2 (siete + cuatro); `HOS-1354/descomposicion.md` §2.1; `HOS-1353/spec.md` §5.

**Severidad** — `MEDIA`.

**Necesita decisión del owner.** **No.**

---

### F-8C1-011 — Cuántas máquinas de estado hay: cuatro respuestas vivas, y dos de las «nueve» no son máquinas

**Qué se rompe.** El capítulo 03 del núcleo es el documento que dice cómo se leen **las nueve
máquinas**, y el número nueve no cierra contra ninguna otra parte del material. Es el mismo defecto
que `F-8A1-016` y `F-8A3-016` señalan para los pasos y los invariantes, sobre el tercer conteo que
el programa usa como verificación.

**El camino.**

1. **Nueve**: `nucleo/03` (*«las seis reglas de lectura que valen para las nueve máquinas»*) y
   `nucleo/01` §2.2, cuya tabla tiene nueve filas.
2. **Siete con tabla de transiciones**: Trial (T1–T5), Publicación (PB1–PB6), Postulación (PP1–PP3),
   Suscripción (S1–S15), Pago (P1–P5), Pago manual (MP1–MP3), Addon (A1–A6). Grace y Pausa **no
   tienen tabla de transiciones**: son tablas de propiedades. Y el propio `nucleo/01` §2.2 las
   declara *«no es una máquina propia»* en las dos filas, así que el nueve incluye dos que el mismo
   documento dice que no lo son — con la consecuencia directa de que **la regla 1 del núcleo, «la
   tabla de transiciones es exhaustiva», es inaplicable a dos de las nueve**.
3. **Ocho**: el §63 del PDR, y `HOS-1354/docs/10` §4.6 —*«El §63 pide ocho máquinas y el capítulo 03
   las tiene»*—, que quedó caduco (lo anotó `B2` sin desarrollarlo).
4. **Diez**: la suma de las dos specs. `HOS-1353/spec.md` §2 dice *«**tres**: Trial, Publicación y
   Postulación de Partner»* y `HOS-1354/spec.md` §2 dice *«**siete**: Suscripción, Grace, Pausa,
   Pago, Pago manual, Addon, **y la regla de no-retroceso**»* — que cuenta una **regla** como
   máquina.

**Dónde lo permite el diseño.** `nucleo/03-maquinas-de-estado.md`, encabezado y §1 regla 6;
`nucleo/01-glosario.md` §2.2, últimas dos filas; `HOS-1353/spec.md` §2; `HOS-1354/spec.md` §2;
`HOS-1354/docs/10-verticales-planes-billing-options.md` §4.6.

**Severidad** — `MEDIA`.

**Necesita decisión del owner.** **No.**

---

### F-8C1-012 — Los invariantes son 51, no 49: la corrección dada por verificada invierte el error

**Qué se rompe.** El conteo de invariantes es el único número del programa cuya utilidad declarada
es *«poder preguntar **una vez** si están todos»*. Los seis informes de FASE 8 llegaron a **dos
conclusiones opuestas** sobre cuál es el número correcto, y la que se adoptó como verificada —que
el total es 49 y el error está en el índice— es **la equivocada**. Si FASE 9 la aplica, va a
«corregir» tres lugares que hoy dicen bien y va a dejar en pie el único que dice mal.

**El camino.** La aritmética, contra la tabla del propio capítulo:

1. La tabla del §5 tiene dos columnas. La izquierda —los del §64— suma `6 + 14 + 5 + 7 + 5 = 37`,
   que coincide con su fila total.
2. La derecha —los de las decisiones— tiene **catorce** filas, `D1` a `D14`, contadas sobre la tabla
   del §3. Su fila total dice **14**, correcto.
3. `37 + 14 = 51`. El párrafo de cierre dice **«Cuarenta y nueve»**, que es `37 + 12`.
4. El **12** viene de la nota inmediatamente anterior: *«La columna de la derecha suma 14 sobre 12
   invariantes»*. Esa nota está caduca: la columna suma **16** (`2 + 11 + 3`) y los invariantes son
   **14**. Los dos números están corridos exactamente en dos, que son `D13` y `D14` — agregados
   después, por el capítulo 10, y el propio §4 del capítulo lo dice: *«**Cerrado por el capítulo 10
   §4**, y dejó los invariantes `D14` y `D13` arriba»*.
5. O sea: al agregar `D13` y `D14` se actualizó la columna derecha del §5 y su fila total, y **no**
   se actualizaron ni la nota ni el cierre. El **49** es el residuo de esa actualización a medias.
6. Corroboración independiente dentro del mismo párrafo: *«y **ocho** los sostiene la base»*. Base
   son `6` del §64 más `D2` y `D3` = **8**. Ese ocho **sólo cierra con 14 invariantes de decisión**,
   o sea con 51.
7. Y el 51 no está solo: lo dicen `nucleo/00-indice.md` dos veces y `HOS-1353/spec.md` §2.1. Dicen
   49 **una** vez, en la última línea del capítulo 04.

Dos conteos menores del mismo capítulo arrastran el mismo defecto y conviene arreglarlos en el
mismo acto: el §2.4 titula una tabla de **siete** filas y el párrafo que la sigue dice *«**Cinco**
de las 37 no se pueden comprobar ejecutando nada»* (el §5 dice siete); y el §2.5 se titula *«Los
**cinco** de *Free Forever* (27, 28, 29)»* sobre **tres** invariantes.

**Dónde lo permite el diseño.**

`HOS-1352/docs/nucleo/04-invariantes.md` §5, la nota y el cierre:

> La columna de la derecha suma 14 sobre 12 invariantes, y no es un error de conteo: **`D3` y `D12`
> se sostienen en dos niveles a la vez**.
>
> **Cuarenta y nueve invariantes, y ocho los sostiene la base.**

Contra su propia tabla del §3, `D1`…`D14`, y contra `nucleo/00-indice.md`: *«| `04` | invariantes |
**los 51**, con quién sostiene cada uno |»*.

**Severidad** — `MEDIA`.

**Necesita decisión del owner.** **No.** Pero sí necesita que FASE 9 **no** aplique la corrección
que venía declarada como verificada: el índice dice bien y el capítulo dice mal, no al revés.
`F-8B2` y `F-8B3` llegaron a esta misma cuenta por separado; `F-8A1-016` y `F-8A3-016` la
declararon al revés. Lo reporto para dirimirlo, no para repetirlo.

---

### F-8C1-013 — Glosario e invariantes no se tocaron en el desarme, y sus referencias no resuelven

**Qué se rompe.** De los siete capítulos del núcleo, **dos no se actualizaron el día del desarme**:
`01-glosario` y `04-invariantes` llevan `updated: 2026-09-17`; los otros cinco llevan `2026-09-18`.
Son exactamente los dos que citan capítulos de las épicas **sin la anotación de épica** que el
desarme agregó en todos los demás. Son también los dos documentos que más se citan desde las dos
épicas, y el `04` es el que existe para poder preguntar **una vez** si los invariantes están todos.

**El camino.**

1. `nucleo/04-invariantes.md` cita, sin decir de qué épica: *«capítulo 09»*, *«capítulo 14»*,
   *«capítulo 15»*, *«capítulo 16»*, *«capítulo 17»*, *«capítulo 18»*, *«cap. 10 §3.2»*, *«cap. 03
   §8»*, *«cap. 03 §9»*, *«cap. 03 §10»*, *«cap. 01 §3»* y *«cap. 02 §4»*.
2. Algunas de esas resuelven a un solo documento (17 y 18 son verticales enteros; 09, 14 y 16 son
   billing enteros). **Otras no.** *«cap. 03 §8»*, *«§9»* y *«§10»* son tres secciones que después
   del desarme viven en **dos épicas distintas**: la §9 en verticales, la §8 y la §10 en billing.
   *«cap. 02 §4»* resuelve a **dos documentos con contenidos distintos**: la retención de verticales
   y la de billing.
3. Un lector de la épica de verticales que siga *«cap. 02 §4»* desde el invariante 2 —*«borrar ficha
   no devuelve trial»*— llega a la §4 correcta por suerte, porque está de su lado. Un lector de
   billing llega a una §4 de una fila que no habla de trials.
4. El mismo capítulo 04 es el que fija que bajar un invariante de nivel *«exige una razón
   escrita»*. Es el documento donde una referencia que no resuelve cuesta más.

**Dónde lo permite el diseño.** Los frontmatter: `nucleo/01-glosario.md` y `nucleo/04-invariantes.md`
con `updated: 2026-09-17`, contra `nucleo/00`, `02`, `03` con `2026-09-18` — y el commit
`5d2f10f36` («poner al día todo lo que el desarme dejó obsoleto»), que agregó las anotaciones de
épica en los demás y no en estos dos.

**Severidad** — `MEDIA`.

**Necesita decisión del owner.** **No.**

---

## BAJA

### F-8C1-014 — El capítulo 02 del núcleo salta de §1.3 a §2.6 y su única referencia interna apunta afuera

**Qué se rompe.** Nada en ejecución. Pero el capítulo 02 del núcleo es el que las dos épicas citan
por número de sección, y el suyo quedó con un solo hueco de numeración y una referencia que no
resuelve contra sí mismo.

**El camino.**

1. El documento va `§1`, `§1.1`, `§1.2`, `§1.3`, `§2.6`. No hay `§2`, ni `§2.1`–`§2.5`, ni `§3`, ni
   `§4`, ni `§5`: se fueron a las épicas.
2. `§2.6` se titula *«Registro»* y cierra diciendo *«se explica en §4»*. El `§4` no está en el
   documento: está, con contenidos distintos, en las dos épicas.
3. Su sección final, *«Lo que esta mitad NO cierra»*, quedó con **un solo bullet** (los tipos, los
   índices y el plan de migración) de los tres que tenía el original — los otros dos viajaron con la
   mitad de verticales, correctamente.

**Dónde lo permite el diseño.** `HOS-1352/docs/nucleo/02-modelo-de-datos.md`, §2.6:

> **`domain_event` guarda referencias y deltas, no copias del contenido**, y ésa es una decisión de
> modelo con consecuencia directa en la retención — se explica en §4.

**Severidad** — `BAJA`.

**Necesita decisión del owner.** **No.**

---

## La causa común de las cuatro convergencias

Las cuatro convergencias no comparten un tema: comparten una **forma**, y la forma es la misma en
las cuatro.

**En las cuatro, una regla se validó contra el caso que la motivó y después se escribió como
cuantificador universal sobre un dominio que incluye el caso donde es falsa.**

| convergencia | la regla | el caso que la validó | el caso que la rompe |
|---|---|---|---|
| el contrato no transporta `grant` ni `addon` | *«el contrato devuelve el puntero y nunca los valores»* | `SUSCRIPCIÓN`, que ancla una versión de plan | `GRANT` y `CORTESÍA`, que no la tienen; `ADDON`, que no es un `tipo` |
| el `UNIQUE` de suscripción viva | *«máximo una principal por `user + vertical`», impuesto por la base* | dos altas simultáneas del mismo cliente | el upgrade, donde `D7` exige que la vieja siga viva mientras nace la nueva |
| el trial no puede nacer | *«ninguna operación resuelve su autorización por su cuenta»* | toda operación de quien **ya tiene** título | la operación que **crea** el título |
| el preapproval huérfano | *«los estados terminales no se barren: no pueden divergir hacia nada que nos importe»* | una suscripción cancelada de las dos puntas | una fila terminal con su vínculo de proveedor vivo |

Y hay un segundo rasgo compartido, que es el que explica **por qué nadie lo vio antes de esta
fase**: **las cuatro son una contradicción entre dos capítulos, no un defecto dentro de uno.**

- El contrato (`12`) contra el glosario (`nucleo/01` §1.5) y el modelo de billing (`02` §2.4).
- El modelo de billing (`02` §2.2) contra `D7` del núcleo (`04` §3) y `DEC-SUB-006`.
- La autorización (`17` §1.2) contra las máquinas (`03` §2 y §9).
- Los addons (`16` §4.3) contra la conciliación (`09` §3).

**Cuatro de cuatro cruzan un límite de capítulo. Ninguna es visible leyendo un capítulo entero.**

De ahí sale el quinto defecto, que ninguno de los seis informes nombró: **el programa no tiene
ningún lugar donde una regla se verifique contra el dominio completo que cuantifica.** Su único
mecanismo de cierre es por hueco y por capítulo — el índice lo dice textual: *«Un hueco se cierra
cuando **un capítulo** dice qué pasa en todos sus casos»*. Eso comprueba que un capítulo cubre
**sus** casos. No comprueba que una regla cubra **los suyos**, porque los suyos están repartidos en
otros capítulos.

El único artefacto que podría haber hecho ese chequeo —el documento donde las nueve máquinas, las
veinticuatro entidades y los cincuenta y un invariantes estaban uno al lado del otro— es
exactamente el que el desarme retiró. El índice del núcleo lo dice del glosario y de los
invariantes y no extrajo la consecuencia general:

> **No se parte**: un glosario en dos mitades deja de ser un glosario, y 51 invariantes numerados de
> corrido pierden lo único que los hace útiles, que es poder preguntar **una vez** si están todos.

Ese argumento vale igual para las reglas. Y las cuatro convergencias son la factura: cuatro reglas
que sólo se podían comprobar preguntando una vez, en un programa que a partir del 2026-09-18 sólo
puede preguntar por capítulo. `F-8C1-001`, `F-8C1-002` y `F-8C1-005` son tres instancias del mismo
quinto defecto, y `F-8C1-012` es lo que pasa cuando el número que sirve para preguntar una vez deja
de cerrar.

---

## Lo que el desarme perdió

Inventario **medido** contra los originales de `966189003^`, no estimado. Los siete capítulos que
se partieron de verdad son 02, 03, 10, 19, 20, 21 y 22.

**Lo que NO se perdió** — y es la mayor parte:

| medición | resultado |
|---|---|
| encabezados de los 7 capítulos partidos | **0 perdidos**. Los dos que el diff marca son `## Lo que este capítulo NO cierra`, renombrado a `## Lo que esta mitad NO cierra` en las dos mitades |
| filas de tabla, comparadas por su primera celda | **0 perdidas** sobre 243 filas de los 7 capítulos |
| filas cuyo texto cambió | **18**, todas por la anotación de épica agregada a una referencia cruzada |
| volumen de texto | **1,06x a 1,29x** por capítulo, **1,13x** agregado. La afirmación del §4.1 se reproduce exactamente |

**Lo que sí se perdió o se degradó** — todo medible, nada de esto lo veía la verificación por
encabezados:

| # | qué | cuánto |
|---|---|---|
| 1 | Listas «únicas y en un solo lugar» partidas, con la frase de completitud **copiada a las dos mitades** | **4** (cap. 19 §4 · cap. 20 §2 · cap. 20 §5 · cap. 22 §4) |
| 2 | Listas ordenadas que quedaron con **un solo elemento** | **1**: `HOS-1353/docs/20-testing.md` §5, un ítem numerado `7.` |
| 3 | Huecos de numeración en listas ordenadas | **1**: `HOS-1354/docs/20-testing.md` §5, `1,2,3,4,5,6,8` |
| 4 | Tablas que quedaron con **una sola fila de datos** | **7** (V·02 ×2, V·19 ×2, V·22 ×1, B·02 ×2) — de las cuales **3** son degradaciones reales: cap. 19 §2 (`F-8A3-014`), cap. 22 §4, y cap. 02 §4.1 de billing (`F-8B3-013`) |
| 5 | Secciones que un capítulo promete en su apertura y no contiene | **1**: `HOS-1353/docs/20-testing.md`, que anuncia su §3 |
| 6 | Reglas que quedaron **enteras de un lado** cuando las necesitan los dos | **4**: cap. 19 §4.1 (billing) · cap. 20 §6 (billing) · `G7` (billing) · cap. 05 entero, que es la regla 3 del núcleo (billing) |
| 7 | Capítulos declarados `PARTIDO` que **no se partieron** | **4** de 11: `01`, `04`, `07`, `08` |
| 8 | Entidades definidas fuera del núcleo, contra la regla del índice | **22** de 24 |
| 9 | Referencias cruzadas entre épicas, contra la regla de que no existen | **33** (16 + 17), **13** de ellas a un capítulo de la otra épica |
| 10 | Capítulos del núcleo no actualizados por el desarme | **2**: `01-glosario`, `04-invariantes` |
| 11 | Frontmatter `cierra:` duplicado en las mitades | ya medido en `F-8A3-015`; confirmo el alcance: `02` en **3** documentos, `03` en **3**, `21` en **2** |

**La lectura de esa tabla.** La verificación del desarme —105 de 105 encabezados, y el volumen— es
honesta y **pasa**: reproduje las dos y dan lo que el §4.1 dice. Lo que se perdió está una
granularidad **por debajo** del encabezado y una **por encima** de la fila: se perdieron **la
completitud de una lista** (ítems 1–3), **la asignación de una celda** (ítem 4: `Mi Cuenta ·
Mi Suscripción` era **una celda con dos superficies**, y el reparto mandaba cada una a un lado) y
**el alcance de una regla** (ítem 6). Ninguna de esas tres cosas es contable por encabezados, y
ninguna de las tres tenía por qué serlo: la verificación se diseñó contra el riesgo que el §4.1
nombra —*«105 encabezados podían perderse en el camino»*— y ese riesgo no se materializó.

---

## Ataques que intenté y el diseño resistió

Van acá porque el owner necesita saber qué probé y aguantó, y porque **dos de ellos corrigen
hallazgos de esta misma fase**.

1. **Reproducir la verificación del desarme para desmentirla.** Extraje los 22 originales de
   `966189003^` y comparé encabezado por encabezado y fila por fila contra las mitades de hoy.
   **0 encabezados perdidos, 0 filas perdidas por clave.** La afirmación *«105 de 105»* es cierta
   para lo que afirma. Y el volumen —*«entre 1,06x y 1,29x»*— dio exactamente 1,06 (cap. 03) a 1,29
   (cap. 20). No encontré ni un caso de contenido borrado.

2. **`F-8A1` dice que la lista del cap. 19 §4 de verticales perdió el 3, el 5, el 6 y el 7.** **No
   es así.** La mitad verticales tiene `1, 2, 4, 8, 9` y la de billing tiene `3, 5, 6, 7, 10, 11,
   12, 13, 14`: la unión es 1–14, completa. El defecto real de esa sección es otro y es el de
   `F-8C1-005` — la frase que afirma que la lista está junta viajó a las dos mitades.

3. **`F-8A1` dice que falta `G7` en la numeración de los guards.** **No falta**: está en
   `HOS-1354/docs/20-testing.md` §2, por reparto explícito del §4 de la partición. Lo que sí es un
   defecto es que verticales lo necesita (`F-8C1-007`), no que se haya perdido.

4. **Sacarle al contrato algo que no debía cruzar.** Busqué un monto, un precio, un id del
   proveedor, una fecha de cobro o un estado de pago viajando de billing hacia verticales. **No
   hay ninguno.** La declaración del §4 se cumple en su dirección declarada, y la distinción
   `ACTIVE`/`GRACE_PERIOD` está argumentada y sostenida. Las filtraciones reales van en la otra
   dirección (`F-8B3-009`) o por entidades que el contrato no contempla (`F-8B3-007`).

5. **Encontrar una regla compartida que el desarme haya duplicado y después divergido.** Revisé las
   secciones que aparecen en las dos mitades de los siete capítulos partidos. **Todas son idénticas
   salvo la anotación de épica**: cap. 19 §1, cap. 20 §1 y §2.1, cap. 22 §1. La única duplicación
   que sí divergió está **fuera** de los capítulos: la firma de `cobertura()` entre la partición y
   el contrato (`F-8C1-009`).

6. **`puedePausar()` como candidato a romperse en el corte.** Es el caso de prueba perfecto —tres
   condiciones repartidas entre `plan_version` (verticales) y `billing_option` (billing)— y **el
   diseño lo resolvió bien**: la función vive entera en `nucleo/01` §3 y las dos épicas la
   referencian sin copiarla. Es un ejemplo de lo que `F-8C1-001` debería haber sido en todos lados.

7. **Los ocho ítems del Eje 2.** Intenté encontrar un noveno declarado de contrabando en una épica,
   o uno perdido en el corte. **Los ocho están completos en `nucleo/01` §4.3**, y `HOS-1353/spec.md`
   §3.1 los repite los ocho sin agregar ni sacar. La regla de que la lista crece sólo por decisión
   registrada se sostiene.

8. **Las doce acciones administrativas.** El cap. 17 §3.2 exime a *«las doce acciones del capítulo
   08 §3»* de los pasos 5, 6 y 7 — una excepción por enumeración que se rompe si el número no
   cierra. Conté la tabla de `nucleo/08` §3: **son doce**. Cierra.

9. **Los capítulos 10 y 21 como candidatos a pérdida.** Los dos son `PARTIDO` con reparto fino. **0
   encabezados, 0 filas y 0 ítems de lista perdidos en los dos.** El cap. 21 tiene su defecto
   —`F-8A3-009` y `F-8B3-006`— pero no es una pérdida del desarme: es una referencia cruzada, que es
   otra cosa.

10. **El conteo de 72 huecos técnicos.** Intenté convertirlo en un hallazgo y **está declarado**:
    `04-open-decisions.md` lo anota explícitamente como no verificado, con las dos extracciones que
    dieron 71 y 88 y la razón de no corregirlo. No lo reporto.

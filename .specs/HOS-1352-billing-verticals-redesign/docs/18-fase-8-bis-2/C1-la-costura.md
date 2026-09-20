---
title: "FASE 8-bis-2 · C1 — la costura: capítulos partidos, el contrato, los invariantes"
linear: HOS-1352
statusSource: linear
created: 2026-09-20
updated: 2026-09-20
status: CURRENT
fase: 8
---

# FASE 8-bis-2 · C1 — la costura

Tercera pasada `C1`, corrida **después** de A y B y sobre sus seis informes. Vector: lo que se
rompe **entre** documentos — los capítulos que el desarme partió, el contrato de frontera, el
núcleo y los invariantes. **El núcleo es mío**, y adopto los defectos que A y B marcaron `NUCLEO`.

**Dieciséis hallazgos: 1 `CRITICA`, 6 `ALTA`, 6 `MEDIA`, 3 `BAJA`.**

Más las dos secciones del encargo propio: **la deduplicación de los críticos** (§2) y **las
contradicciones entre informes con su veredicto** (§3).

Abreviaturas como en los demás: `NUCLEO` es `HOS-1352-…/docs/nucleo/`, `V` es
`HOS-1353-…/docs/`, `B` es `HOS-1354-…/docs/`, y lo que no lleva prefijo es `HOS-1352-…/docs/`.

**Lo que medí yo, y cómo.** Todos los conteos de este informe salen de recorrer la tabla citada
sobre el worktree `/home/qazuor/projects/WEBS/hospeda-spec-hos-1352-billing-redesign` el
2026-09-20: 24 celdas en la tabla de clases del `12-contrato…` §2.4; 10 filas (9 estados +
`(sin fila)`) en `B/03` §3.1; 8 filas y sus dos comodines en `B/03` §10.1; 10 filas / 3 en negrita
en `V/02` §3.2; 12 filas y 16 actos en `NUCLEO/08` §3; 10 guards en `V/20` §2 y **6 en `B/20` §2**;
15 filas en `NUCLEO/04` §3. **Ningún número de este informe viene de otro informe** — donde cito
uno ajeno, lo digo y lo vuelvo a contar.

---

## 1. Los hallazgos

### CRITICA

### F-8cC1-001 — Una pausa del catálogo cruza el día 90, la ficha cae en `ARCHIVED`, y `ARCHIVED` no tiene salida: al día 180 se borra el contenido de un cliente que no canceló nada

**Qué se rompe.** Alguien toma la pausa más larga que el catálogo le vende —**cuatro
pausas-mes**, o sea unos 120 días—. Su ficha baja por `PB2` el día que empieza la pausa, cruza el
día 90, `PB4` la manda a `ARCHIVED`, y **la tabla de publicación no tiene ninguna fila que salga
de `ARCHIVED`**. Cuando reanuda y vuelve a pagar, `PB3` no la alcanza: su `desde` es
`UNPUBLISHED_BY_BILLING`. Y el reloj de retención sigue: **al día 180 se borra «el contenido
publicable de la ficha (textos, fotos, FAQ, horarios)»**. El cliente no canceló, no dejó de pagar
y no hizo nada fuera de lo que el producto ofrece.

**El camino.**

1. La pausa larga es un producto, no un borde. `NUCLEO/01` §3, precisión 2: *«La cuota se cuenta
   por `user + vertical` … y se expresa en **meses**: los 120 días del §26.3 son **4 pausas-mes**
   y los 240 son 8»*. `B/03` §5 lo repite: *«**4 pausas-mes** por pausa»*.
2. Durante la pausa la suscripción **no emite fuente**, y eso es el arreglo 16:
   `12-contrato-de-cobertura.md` §2.6 — *«| `PAUSED` por `CUSTOMER_REQUEST` | **no** | — | `B/16`
   §2.2: *«el servicio está detenido»* |»*.
3. Sin ninguna otra fuente de clase `TÍTULO`, `cubierto` pasa a falso y `PB2` despublica:
   `V/03` §9 — *«| PB2 | `PUBLISHED` | **`cubierto` pasa a falso** | `UNPUBLISHED_BY_BILLING` |»*.
   Hasta acá es lo querido.
4. **El día 90 llega antes que el fin de la pausa.** `V/03` §9 — *«| PB4 | `PUBLISHED` o
   **`UNPUBLISHED_BY_BILLING`** | **día 90 de inactividad** | `ARCHIVED` |»*. 120 > 90, y qué
   cuenta como *«inactividad»* **no está definido en ningún capítulo**: lo verifiqué con
   `rg -n "inactividad"` sobre los once capítulos de `HOS-1353` — **una sola aparición, la de esta
   misma celda**. La lectura natural —la ficha no está publicada— es la que se cumple.
5. **`ARCHIVED` no tiene salida.** `rg -n "ARCHIVED"` sobre los once capítulos de `HOS-1353`
   devuelve **dos líneas**, las dos en `V/03` §9 y las dos en la columna `hacia`: `PB4` y `PB5`.
   **Ninguna fila de ninguna tabla del programa tiene `ARCHIVED` en su columna `desde`.** Y
   `NUCLEO/03` §1 regla 1 dice qué pasa entonces: *«La tabla de transiciones es
   exhaustiva. Lo que no está, no pasa. Un intento de transición que la tabla no declara **no se
   ejecuta**: se registra como evento de dominio y, si tocaba plata o estado, **pone la marca
   `requiere_conciliación`**»*. Reactivar una ficha archivada **es un incidente**, no una
   operación.
6. Y dos documentos la prometen igual, los dos en una nota y ninguno en una tabla:
   - `V/03` §9, nota de `PB4`: *«el dueño la sigue viendo y puede exportarla o **reactivarla**»*;
   - `V/02` §4.2 regla 3: *«La ficha sale del sitio público, el dueño la sigue viendo y puede
     exportarla o **reactivarla suscribiéndose** (`DEC-DATA-001`)»*. El cliente **ya está
     suscripto**: la única vía declarada no aplica.
7. **El reloj no se detiene en el 90.** `V/02` §4.1 — *«| **Se borra** al día 180 | el contenido
   publicable de la ficha (textos, fotos, FAQ, horarios), los borradores … |»*. A los 180 días de
   *«inactividad»* —dos meses después de que el cliente volvió a pagar— su contenido se borra.
8. Y la justificación del borrado se apoya en la mitad que no existe: `V/02` §4.2 regla 3 —
   *«**Poder exportar antes es lo que hace defendible el hard delete del día 180**»*. La frase
   completa ofrece dos salidas, exportar y reactivar; la segunda no es ejecutable.

**Dónde lo permite el diseño.** Las ocho citas de arriba. Las tres piezas viven en tres
documentos con tres dueños y **ninguna es incorrecta sola**: el tope de la pausa es del núcleo
(`NUCLEO/01` §3) y de billing (`B/03` §5); la no-emisión de la pausa es del **contrato** (§2.6);
el reloj de archivado y el de retención son de verticales (`V/03` §9, `V/02` §4).

**Severidad.** `CRITICA` — *«un dato se pierde sin vuelta»*, sobre el contenido real de un cliente
que está al día, por usar una función que el catálogo le vende. Y falla en silencio: el día 90 no
avisa nada al que está pausado, porque los dos avisos previos de `DEC-DATA-001` se diseñaron para
alguien que se fue.

**¿Es nuevo, o es el arreglo?** **El callejón sin salida es viejo y el camino que lleva a él es
nuevo.** Que `ARCHIVED` no tenga fila de salida es `F-8A2-008` de la FASE 8, que nunca estuvo en
un racimo y que las instrucciones excluyen de esta pasada — **por eso no lo reporto**. Lo que
reporto es que **el arreglo 16 le construyó una entrada nueva y cara**: al declarar que una
`PAUSED` por `CUSTOMER_REQUEST` **no emite fuente**, convirtió una pausa voluntaria en una pérdida
de cobertura, y con el arreglo 9 —`PB2` por el cambio de `cubierto`— esa pérdida despublica. Antes
de los dos, el sujeto del callejón era una ficha abandonada; ahora es la de un cliente que paga.
Es la obligación 1 de `DEC-METH-008` sobre el arreglo 16: su dominio nuevo no es sólo *«qué emite
cada estado»*, es **qué reloj arranca en cada estado que dejó de emitir**.

---

### ALTA

### F-8cC1-002 — «Vivo» nombra dos conjuntos, el glosario no define ninguno, y es la raíz de tres de los catorce críticos de esta pasada

**Qué se rompe.** `NUCLEO/00` fija la regla del programa: *«**El núcleo es el único lugar donde
algo se define.** Los capítulos de las dos épicas describen comportamiento y **referencian** el
núcleo»*. La palabra **«vivo»** decide hoy tres cosas caras —el candado del §11, el disparo de
`S17` y la condición de `T6`— y **el glosario no la define**. Los dos conjuntos que la palabra
nombra hoy difieren en **cuatro de seis** estados, y el último consumidor que la usó eligió el
equivocado.

**El camino.**

1. `NUCLEO/01` es el capítulo que *«fija los nombres»* y declara que *«todo lo que el resto de la
   spec use tiene que estar acá»*. Lo verifiqué: **«vivo» y «viva» no aparecen en `NUCLEO/01`**
   como término definido; su §2.2 lista los nueve estados de la suscripción y no los clasifica.
2. El primer conjunto lo define **billing, para el candado**: `B/02` §2.2 — *«Los «vivos» siguen
   siendo los mismos seis: `PENDING_AUTHORIZATION`, `ACTIVE`, `GRACE_PERIOD`, `PAUSED`,
   `SUSPENDED` y `CANCEL_SCHEDULED`»*. Su propósito está escrito: impedir un segundo `INSERT`.
3. El segundo lo define **el contrato, para la cobertura**: `12-contrato…` §2.6, la tabla de los
   nueve estados. **Cuatro de los seis «vivos» no emiten fuente**: `PENDING_AUTHORIZATION`,
   `SUSPENDED`, `PAUSED` por `CUSTOMER_REQUEST`, y —fuera del candado— `CHARGE_DECLINED`.
4. `T6` usa la palabra sin decir cuál: `V/03` §2 — *«**ya hay una suscripción viva** para ese
   `user + vertical`»*, y justifica con *«no necesita probar lo que ya está pagando»*, que es el
   segundo conjunto. La condición nombra el primero, porque es el único enumerado.
5. `S17` la usa por tercera vez y con un tercer alcance: `B/03` §3.2 — *«la **predecesora**, en
   **cualquier estado vivo**»* (seis) contra `G-R1-A`, que admite **tres** (`B/20` §2).
6. Y el contrato **prohíbe** resolver la ambigüedad del lado que la sufre: §4 — *«El estado exacto
   de la suscripción no cruza»*. Verticales no puede evaluar ninguno de los dos conjuntos.

**Dónde lo permite el diseño.** `NUCLEO/00` (*«el único lugar donde algo se define»*),
`NUCLEO/01` §2.2 (los nombres, sin clasificación), `B/02` §2.2, `12-contrato…` §2.6 y §4,
`V/03` §2 (`T6`), `B/03` §3.2 (`S17`), `B/20` §2 (`G-R1-A`).

**Severidad.** `ALTA` — por sí sola es una definición que falta; sus consecuencias ya están
contadas como `CRITICA` por A2, A3 y B2 (`F-8cA2-002`, `F-8cA3-001`, `F-8cB2-001`) y como `MEDIA`
por A1 y B3. No la subo para no contar el mismo daño dos veces; la reporto porque **es lo único
de los cinco que se arregla en un solo lugar**, y ese lugar es el núcleo.

**¿Es nuevo, o es el arreglo?** **Mitad y mitad, y la mitad nueva es medible.** Los dos conjuntos
existían; lo que hizo el **arreglo 16** fue **volver medible la distancia entre ellos** —cuatro de
seis— y el **arreglo 8** fue el primer consumidor que se equivocó. Antes del 16 nadie podía decir
en cuánto diferían, así que el defecto no era alcanzable como afirmación.

---

### F-8cC1-003 — La regla de vigilancia del §4.2 tuvo cuatro disparadores en esta tanda y nadie la corrió; el contrato sigue diciendo «cuatro lugares»

**Qué se rompe.** El contrato trae un detector explícito del defecto que esta fase existe para
buscar —*«si aparece un quinto lugar que necesita algo de billing y no es este hecho, es señal de
que el corte se está filtrando»*— y **es el único instrumento del programa que se dispara solo
cuando la frontera se filtra**. Esta tanda le agregó **cuatro** lugares nuevos y el §1.1 del
contrato sigue enumerando **cuatro**. La regla no falló: nadie la aplicó, y el resultado es que
tres informes de esta pasada encontraron por separado lo que la regla habría señalado de una vez.

**El camino.**

1. La regla, textual: `12-contrato…` §4.2 — *«**Regla de vigilancia**: si aparece un quinto lugar
   que necesita algo de billing **y no es este hecho**, es señal de que el corte se está
   filtrando. **Se mira, no se resuelve en el lugar.**»*
2. El censo contra el que se compara es el §1.1, *«El mismo hecho, en cuatro lugares»*: `V/17`
   §1.2 paso 5 · `V/03` §9 `PB2` · `V/15` §6 · `V/02` §3.2 y `V/15` §4.2.
3. **Los cuatro lugares nuevos, que conté sobre el texto vigente:**

   | # | quién | qué necesita de billing | qué arreglo lo creó | ¿está en el §1.1? |
   |---|---|---|---|---|
   | 5 | **`T6`** (`V/03` §2) | *«ya hay una suscripción **viva**»* — un estado de suscripción, que el §4 prohíbe cruzar | **8** | no |
   | 6 | **`PB3`** (`V/03` §9) | *«`cubierto` pasa a **verdadero**»* — la dirección inversa del mismo hecho | **9** | no (ver `F-8cC1-004`) |
   | 7 | **`G5`** (`V/15` §4.2, `V/20` §2) | *«los efectos declarados de las **transiciones del capítulo 03**»*, que incluyen la máquina de suscripción, que vive en `B/03` | preexistente, **agravado por el 4** | no |
   | 8 | **el trinquete del grant** (`V/15` §2.5) | *«el piso … **guardado en la fila**»*, y la fila es `permanent_grant` (`B/02` §2.4) | **6** | no |

4. Ninguno se *«miró»*: los cuatro se resolvieron **en el lugar**, que es lo que la regla prohíbe
   con esas palabras. `T6` escribió su propia condición; `PB3` se ató al mismo evento; `G5` quedó
   con un sujeto que no alcanza; y `V/15` §2.5 lee una columna de billing sin declararla.
5. Y la mitad inversa de la regla tiene el mismo problema de sujeto: dice *«algo que no está en
   **los seis campos** del §4.1»* y el §4.1, después del arreglo 7, dice *«Son **siete campos** en
   tres preguntas»*. La regla cuantifica sobre un número que el § que la alimenta desmiente
   dieciséis líneas más arriba (es `F-8cA3-014`, y lo confirmé: `12-contrato…` líneas 476 y
   492-493, más `V/02` §2.1, que también dice seis).

**Dónde lo permite el diseño.** `12-contrato…` §1.1, §4.1 y §4.2; `V/03` §2 y §9; `V/15` §2.5 y
§4.2; `V/20` §2; `B/02` §2.4.

**Severidad.** `ALTA` — es el único detector declarado del modo de falla dominante de esta tanda
(A3 lo midió: *«nueve de las once filas»* de su cuadro son un arreglo escrito en un solo lado de
una frontera de dos), y quedó apagado por un censo congelado. No es `CRITICA` porque no abre
acceso ni mueve plata: deja de señalar a los que sí.

**¿Es nuevo, o es el arreglo?** **Lo introdujo la tanda entera, y es la obligación 2 de
`DEC-METH-008` con un instrumento ya escrito.** Cada uno de los cuatro arreglos podía haber
corrido la regla sobre su propio cambio; ninguno lo hizo. La regla existe desde antes y **es
anterior a `DEC-METH-008`**, así que la pregunta obligatoria de la 9-bis llegó a un programa que
ya tenía la mitad del control construido y no lo conectó.

---

### F-8cC1-004 — `PB3` es el quinto consumidor de `cubierto`, no figura en el contrato, y para él «el default es negar» falla en la dirección cara

**Qué se rompe.** El contrato enumera quién necesita `cubierto` y lista tres consumidores; el
arreglo 9 agregó un cuarto —`PB3`— y es **el único que OTORGA**. Toda la arquitectura de defensas
del §6 está escrita suponiendo que un olvido apaga: *«un olvido apaga funciones en vez de
regalarlas»*. Con `PB3` adentro eso deja de ser cierto en un caso concreto y ya medido por el
propio diseño: **el que recontrata paga y su ficha no vuelve nunca**, y no la puede sacar a mano
porque `PB1` sale sólo de `DRAFT`.

**El camino.**

1. El censo del contrato: `12-contrato…` §2.1, fila `cubierto`, columna *«quién lo necesita»* —
   *«`PB2`; el §6 del capítulo 15; el reconciliador»*. **`PB3` no está.** Verificado sobre el
   texto: el contrato nombra `PB3` **cero veces**.
2. `PB3` lo consume, y en la dirección contraria: `V/03` §9 — *«| PB3 |
   `UNPUBLISHED_BY_BILLING` | **`cubierto` pasa a verdadero** | `PUBLISHED` | y el cupo alcanza
   |»*.
3. La primera defensa del contrato está escrita con una sola dirección en la cabeza:
   `12-contrato…` §6.1 — *«Una fuente no implementada responde **que no**. Así, **un olvido apaga
   funciones en vez de regalarlas** — y regalarlas es lo que nadie descubre hasta que ya pasó»*.
4. Para `PB3` el olvido no apaga una función: **deja abajo la ficha de alguien que acaba de
   pagar**, y el daño es exactamente el que el arreglo 9 declara haber cerrado: `V/03` §9 —
   *«`PB3` enumeraba tres y **no conocía `S2`**, así que **el que recontrataba después de cancelar
   pagaba y su ficha no volvía nunca** — y tampoco podía sacarla a mano, porque `PB1` sale sólo de
   `DRAFT`»*.
5. Y no hay red del otro lado: el reconciliador de excedentes *«actúa **sólo si algo bajó**»*
   (`V/15` §4.2), o sea que nunca republica nada.

**Dónde lo permite el diseño.** `12-contrato…` §2.1 (el censo), §6.1 (la defensa asimétrica),
`V/03` §9 (`PB3` y su razón), `V/15` §4.2.

**Severidad.** `ALTA` — alguien paga y no recibe lo que pagó, en el camino normal de recontratar,
y la defensa que el contrato declara para cubrir el olvido empuja hacia ese desenlace en vez de
alejarse de él. No es `CRITICA` porque no hay cobro indebido y la ficha no se pierde: queda abajo
hasta que alguien lo note — salvo que cruce el día 90, y entonces es `F-8cC1-001`.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 9.** Antes `PB3` salía de una lista
cerrada de tres transiciones y no leía `cubierto`; el arreglo lo ató al mismo hecho que `PB2` y
**no agregó la fila al censo del contrato ni revisó el §6.1**, que es lo único que declara qué
pasa cuando una fuente no está.

---

### F-8cC1-005 — El correo que `B/12` §5.3 llama «lo que hace aceptable la decisión» no dice lo que el arreglo 15 decidió

**Qué se rompe.** El diseño aceptó que a un cliente en mora que cambia de plan **le entre un cobro
que ya le habían perdonado**, y lo aceptó con una condición explícita: que se le avise antes. El
arreglo 15 agregó después que ese cobro **se reembolsa**. El catálogo de correos del núcleo —el
único lugar donde ese aviso está declarado— **no lo dice**, y la superficie tampoco. El cliente
recibe el aviso que el diseño exige y le falta la mitad que lo vuelve aceptable.

**El camino.**

1. La condición, textual: `B/12` §5.3 — *«**El aviso previo no es un adorno: es lo que hace
   aceptable la decisión.** Un cobro que sorprende es un reclamo; uno anunciado es un trámite. **El
   correo va al catálogo de `NUCLEO/07`.**»*
2. La fila del catálogo, textual: `NUCLEO/07` §6 — *«| **cambio de plan con una cuota en
   reintento** | transaccional | **antes de confirmar el cambio**, mientras la predecesora siga
   viva | cap. 12 §5.3 (épica de billing) |»*, y el párrafo que la explica: *«Se decidió perdonar
   el período impago y **no cancelar la predecesora antes de tiempo** … así que su cuota sigue en
   `recycling` y **puede entrar**.»*
3. **El reembolso no está en ninguna de las dos.** `NUCLEO/07` no contiene la palabra en esa fila
   ni en su párrafo; lo verifiqué sobre el archivo entero.
4. La superficie repite el alcance corto: `B/19` §4, fila 15, dice que se le promete *«que **el
   cobro de la cuota impaga puede entrar igual**, antes de confirmar»* (cita tomada de
   `F-8cB2-003`, verificada por mí contra `B/19`).
5. Los dos desenlaces del arreglo 15 quedan sin anunciar, y son opuestos:
   - si el reembolso sale, el cliente vio salir plata que nadie le dijo que volvería;
   - si la sucesión no se consuma —`S3` a las 72 h—, el reembolso lo deja **sin el pago que lo
     salvaba** y camino a `SUSPENDED`, que es `F-8cB2-003`. **Ese desenlace es el que el aviso
     tendría que nombrar y es el único que el cliente puede evitar**, porque depende de que
     termine el checkout.

**Dónde lo permite el diseño.** `NUCLEO/07` §6 (la fila y su párrafo), `B/12` §5.3 (la condición y
el reembolso), `B/19` §4 fila 15.

**Severidad.** `ALTA` — la decisión de cobrar algo perdonado se tomó *«a cambio de»* un aviso, y
el aviso declarado no cubre lo que después se decidió hacer con esa plata. No es `CRITICA` porque
el daño de dinero ya está contado en `F-8cB1-005`, `F-8cB3-002` y `F-8cB2-003`; lo que se rompe
acá es la contraprestación con la que se compró la decisión.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 15.** El aviso y su fila son anteriores
y eran correctos para lo que entonces se decidía. El arreglo agregó un efecto nuevo sobre el mismo
hecho y **no releyó el catálogo que su propio § nombra por nombre**. Es la obligación 2 de
`DEC-METH-008` con el destino escrito en la misma oración.

---

### F-8cC1-006 — `D8` está contado en «base» y por la definición del §1 del propio capítulo no lo está: el recuento con script verificó la aritmética, no la clasificación

**Qué se rompe.** El resumen del §5 dice *«Cincuenta y dos invariantes, y **diez los sostiene la
base**»*, y uno de esos diez es `D8` —la precondición del doble cobro—. El §1 del mismo capítulo
define *«base»* como *«una restricción de la base lo impide … **no admite ningún camino que lo
esquive**»*. Lo que `D8` tiene en la base es **una columna que guarda un valor**, y una columna no
impide nada. El invariante más caro del sistema está contado en el nivel más fuerte y apoyado en
el más débil.

**El camino.**

1. La definición del nivel: `NUCLEO/04` §1 — *«| **base** | una restricción de la base lo impide |
   cuando el invariante es una propiedad de los datos y **no admite ningún camino que lo
   esquive** |»*.
2. La celda de `D8`: `NUCLEO/04` §3 — *«**base**: la fecha **que el proveedor confirmó** se guarda
   en `subscription` (cap. 02 §2.2, épica de billing), y un guard la compara contra esa ventana»*.
   **«Se guarda» no es «lo impide».**
3. El párrafo que promueve el nivel lo dice sin notarlo: *«sin una columna que guardara la fecha
   con la que nació la fila **no había forma de comprobar** que se cumplió ni de escribir el
   guard»*. Comprobar es el nivel **guard**; el §1 reserva *«base»* para lo que **impide**.
4. Y un `CHECK` no lo salvaría: la ventana de autorización es **configuración global** (`B/03`
   §3.4 punto 1), no una columna de la fila, así que no hay predicado por fila que escribir. Lo
   midió `F-8cB2-009` y lo confirmé contra `B/03` §3.4.
5. **Y esto sobrevivió a dos verificaciones de esta misma tanda.** El propio §5 declara el método:
   *«**Los conteos se recorren enteros con un script, o no se tocan.**»* Y `F-8cA3-001` de esta
   pasada lo recorrió otra vez y lo declaró el único conteo sano: *«Los cuatro números cierran … es
   el único que no encontré roto»*. Las dos verificaciones son de la **aritmética** —4+4+10 = 18
   sobre 15, 37+15 = 52— y ninguna de las dos comprueba **si cada celda merece su nivel**, que es
   lo único que el §1 define.

**Dónde lo permite el diseño.** `NUCLEO/04` §1, §3 (`D8` y su párrafo) y §5; `B/02` §2.2;
`B/03` §3.4; `B/20` §1 y §2 (`G-R1-B`).

**Severidad.** `ALTA` — el invariante cuyo incumplimiento `B/02` §2.2 llama *«literalmente el
doble cobro»* está contado como imposible de esquivar y es evitable por cualquier camino que no
pase por el guard, que además `F-8cB3-007` mide que está en la capa equivocada. No es `CRITICA`
porque la regla de `B/12` §5.2 sigue siendo correcta: lo que falta es el apoyo, no la regla.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 13**, que es el que creó la columna y
con ella la promoción de nivel — el §5 lo registra: *«mudó `D8` de servicio a base, dándole además
un guard»*. Y lo que agrega esta pasada es el método: **una razón caduca bajo una conclusión
correcta no la revisa nadie**, y acá el recuento correcto es lo que hace invisible la celda mal
clasificada.

---

### F-8cC1-007 — `M-DATA-01` se declara cerrado en tres archivos, las dos mitades contestan distinto, y las entidades del núcleo quedan gobernadas por la regla de una sola épica

**Qué se rompe.** La retención tiene tres dueños declarados y ninguno es el núcleo, aunque las dos
entidades que la retención tiene que tocar —`domain_event` y `outbox`— **son del núcleo**. La
mitad de verticales contesta las tres preguntas del título; la mitad de billing contesta una. El
resultado es que **nada de lo que billing guarda se borra ni se anonimiza nunca**, y el hueco está
marcado cerrado tres veces, así que nadie lo va a volver a abrir.

**El camino.**

1. **Tres cierres del mismo hueco.** Verificado sobre los frontmatters y los encabezados:
   - `NUCLEO/02`, frontmatter: `cierra: … M-DATA-01`;
   - `V/02` §4: *«Retención: qué se borra, qué se anonimiza, qué se conserva · cierra
     `M-DATA-01`»*;
   - `B/02` §4: **el mismo título, palabra por palabra**, y el mismo `cierra`.
2. Las dos mitades no dicen lo mismo. `V/02` §4.1 tiene **tres** filas —se borra, se anonimiza, se
   conserva—. `B/02` §4.1 tiene **una**: *«Se conserva íntegro, siempre | pagos, reembolsos,
   comprobantes, el vínculo con el proveedor»* (contado por mí; es la mitad que `F-8cB3-020`
   reporta).
3. **Y las entidades que la regla tiene que tocar son del núcleo.** `NUCLEO/02` §2.6 declara
   `domain_event` y `outbox` y es el único lugar donde están definidas. La regla que las anonimiza
   vive en `V/02` §4.1 — *«los datos personales que hayan quedado **dentro** de un evento de
   dominio o de un registro de outbox: nombre, correo, teléfono, dirección»*—, o sea **en una
   épica**, para una entidad de las dos.
4. Por el corte de `DEC-ARCH-005`, billing escribe sus propios `domain_event` y sus propias filas
   de `outbox` —`NUCLEO/08` §1.1 declara auditable *«todo lo que mueve dinero»*—, y la mitad de
   billing que declara cerrar el hueco dice que **todo se conserva íntegro, siempre**. Nada las
   anonimiza.
5. Y la promesa que eso vuelve falsa está escrita en el núcleo, no en una épica: `NUCLEO/08` §1.3
   — *«La única escritura posterior admitida es **la anonimización del día 180** (cap. 02 §4.1),
   que reemplaza datos personales»*. **Esa cita no resuelve**: hay dos `cap. 02 §4.1` y sólo uno
   tiene esa regla.
6. Y `NUCLEO/02` se cita a sí mismo un § que el desarme se llevó: §2.6 — *«`domain_event` guarda
   referencias y deltas, no copias … se explica en **§4**»*. `NUCLEO/02` no tiene §4.

**Dónde lo permite el diseño.** Las seis citas de arriba, en `NUCLEO/02` (frontmatter y §2.6),
`NUCLEO/08` §1.3, `V/02` §4 y §4.1, `B/02` §4 y §4.1.

**Severidad.** `ALTA` — el §25 promete un hard delete y la mitad de billing declara lo contrario
sobre entidades que llevan nombre, correo, teléfono y dirección, con el hueco marcado cerrado tres
veces. No es `CRITICA` por el criterio de esta fase: no se pierde un dato, no se cobra mal y nadie
accede a lo ajeno **dentro del sistema** — el riesgo es legal, y el capítulo 22 tiene su propio
carril.

**¿Es nuevo, o es el arreglo?** **Preexistente, y de una clase que ningún arreglo de la 9-bis
tocó.** Lo reporto acá porque es de la costura y porque la mitad que `F-8cB3-020` vio —la tabla de
una fila— se lee como un capítulo incompleto, y no lo es: es un hueco **repartido entre tres
documentos**, cada uno de los cuales declara haberlo cerrado.

---

### MEDIA

### F-8cC1-008 — El catálogo de guards es UNA numeración partida en dos épicas sin referencia cruzada, y dos informes de esta misma pasada leyeron el hueco como un guard faltante

**Qué se rompe.** Los dos capítulos 20 abren su §2 con la misma frase —*«Acá está la lista, que es
lo que permite preguntar «¿están todos?» una vez en vez de siete»*— sobre **dos listas distintas
que comparten una sola numeración**, y ninguna nombra a la otra. La pregunta que el § existe para
contestar no se puede contestar con ninguno de los dos documentos, y esta pasada tiene la prueba:
**dos agentes independientes concluyeron que `G7` no existe.** Existe.

**El camino.**

1. `V/20` §2, contado por mí: **diez** guards — `G1`, `G2`, `G3`, `G4`, `G5`, `G6`, `G8`, `G-R3`,
   `G-R3-B`, `G-R3-C`. **`G7` no está.**
2. `B/20` §2, contado por mí: **seis** — **`G7`**, `G9`, `G10`, `G11`, `G-R1-A`, `G-R1-B`.
   Textual: *«| G7 | un valor comercial vive **en código** | invariantes §64.15 y §64.16 |»*.
3. O sea: `G1`…`G11` es **una** secuencia repartida **7 / 4** entre las dos épicas, con `G8` de un
   lado y `G7`, `G9`, `G10`, `G11` del otro. Ninguno de los dos §2 lo dice; sólo el encabezado del
   capítulo menciona que hay otra mitad.
4. **La consecuencia está medida en esta pasada**, y por dos agentes ciegos entre sí:
   - `F-8cA1` «Fuera de mi vector»: *«el catálogo de `V/20` §2 lista **diez** guards …, **`G7` no
     existe**»*;
   - `F-8cA2` «Fuera de mi vector» punto 4: *«`V/20` §2 … `G-R3-C`: **no hay `G7`**. El § se
     presenta como «lo que permite preguntar «¿están todos?» una vez en vez de siete», y un hueco
     en la numeración es exactamente lo que impide contestarlo»*.
5. **Y no es sólo la numeración.** El §1 —la tabla de las cuatro capas, que es la que define qué
   es un guard (*«propiedades del código, no de una ejecución … el árbol de fuentes, en CI»*)— está
   **duplicada palabra por palabra** en los dos archivos, igual que el §2.1 entero. Es una
   definición sin dueño: `F-8cB3-007` y `F-8cB2-009` construyen su hallazgo sobre ella, y
   corregirla en un archivo la deja intacta en el otro. `NUCLEO/00` prohíbe exactamente esto:
   *«El núcleo es el único lugar donde algo se define … no redefinen una entidad, un estado ni un
   invariante»*.
6. Y hay una tercera cardinalidad, ésta sí sana en sí misma: `HOS-1353/spec.md` §5 dice
   *«**Siete guards**»* y **su lista tiene siete filas** (`G1`-`G6`, `G8`). No es un conteo mal
   hecho: es una foto anterior a los tres guards `G-R3*`.

**Dónde lo permite el diseño.** `V/20` §1, §2 y §2.1; `B/20` §1, §2 y §2.1;
`HOS-1353/spec.md` §5; `NUCLEO/00`, *«Cómo se relacionan las tres partes»*.

**Severidad.** `MEDIA` — no abre acceso ni mueve plata. Lo reporto en este nivel y no más abajo
porque **es un defecto con daño observado**: dos de las seis lecturas adversariales de esta tanda
concluyeron mal sobre él, y la conclusión equivocada —*«falta un guard»*— habría mandado a
escribir uno que ya existe.

**¿Es nuevo, o es el arreglo?** **Lo produjo el desarme** (`DEC-ARCH-005`, 2026-09-18), no la
9-bis. Lo que la 9-bis agregó son **cinco guards más** repartidos por el mismo criterio —los tres
`G-R3*` de un lado y los dos `G-R1*` del otro— sin que nadie reconstruyera la lista única.

---

### F-8cC1-009 — La máquina de suscripción tiene un décimo estado sin nombre en el glosario, y la regla de default del espejo es inejecutable sobre él

**Qué se rompe.** `NUCLEO/03` regla 2 declara que el estado inicial de una máquina cuya fila nace
en su primera transición **es un estado**. La máquina de suscripción tiene uno y **el glosario no
lo nombra**: `NUCLEO/01` §2.2 lista nueve. Por eso tres documentos cuentan distinto, y por eso la
regla de cierre del espejo —*«lo que no figura acá es divergencia real, y ahí la marca es la
respuesta correcta»*— **no se puede ejecutar sobre él**: la marca es *«una marca booleana **sobre
la fila**»* y este caso es precisamente el que no tiene fila.

**El camino.**

1. `NUCLEO/03` §1 regla 2: *«el estado inicial de una máquina cuya fila nace en su primera
   transición **vive afuera de la columna**. Que viva afuera no lo vuelve la ausencia de un
   estado: **es un estado porque tiene reglas declaradas y una salida declarada, no porque tenga
   fila**. Es lo que la máquina de suscripción ya hace con su renglón `(sin fila)`»*.
2. `NUCLEO/01` §2.2, el diccionario: *«| **Suscripción** | `PENDING_AUTHORIZATION` · `ABANDONED` ·
   `ACTIVE` · `GRACE_PERIOD` · `PAUSED` · `SUSPENDED` · `CANCEL_SCHEDULED` · `CANCELLED` ·
   `CHARGE_DECLINED` |»* — **nueve, y `(sin fila)` no está**. La máquina de trial sí tiene el suyo
   nombrado: `PRE_TRIAL`, y el mismo § lo defiende (*«`PRE_TRIAL` es un estado real … Real no
   quiere decir con fila»*).
3. `B/03` §3.1 lo pone en su tabla como un renglón más y después cuenta sin él: *«| *(sin fila)* |
   **el estado inicial es la ausencia de fila** …|»*, y *«`CHARGE_DECLINED` entra y
   `RECONCILIATION_REQUIRED` sale, así que **siguen siendo nueve**»*. **Diez filas, nueve
   contados.**
4. El par `authorized × (sin fila)` **existe y tiene nombre propio en el programa**: es la
   huérfana. `NUCLEO/08` §2.2 — *«Cuando la cadena se corta —un webhook de un preapproval que no
   conocemos— eso **es** la detección de una huérfana»*; `B/09` §2.2 dice lo mismo.
5. No figura en la tabla de `B/03` §10.1, así que le aplica el default: *«divergencia real, y ahí
   **la marca** es la respuesta correcta»*.
6. **Y la marca no se puede poner.** `B/03` §3.1 — *«`requiere_conciliación` es una marca booleana
   **sobre la fila**»*; `S14` mueve *«el mismo estado»* de una fila que acá no existe. La regla de
   default nombra un mecanismo que este caso no tiene, y lo que sí lo atiende —el camino de
   huérfanas de `B/09` §2.2— vive en otro § y no está referenciado desde el §10.1.

**Dónde lo permite el diseño.** `NUCLEO/03` §1 regla 2; `NUCLEO/01` §2.2; `B/03` §3.1, §3.2
(`S14`) y §10.1; `NUCLEO/08` §2.2; `B/09` §2.2.

**Severidad.** `MEDIA` — el caso **sí** tiene atención declarada, por el otro camino, así que no
se pierde un cobro. Lo roto es que la regla de cierre del espejo afirma cubrir un caso que no
puede cubrir, y que el estado que lo produce no tiene nombre en el único lugar que fija los
nombres.

**¿Es nuevo, o es el arreglo?** **Lo volvió alcanzable el arreglo 18.** Antes del arreglo no había
una regla de default sobre los pares no enumerados, así que el par sin fila no caía en ninguna
parte; el arreglo escribió una que lo alcanza y le asigna un mecanismo que no existe para él. La
mitad del glosario es preexistente y es lo que hace que el arreglo no lo pudiera ver: **contó
sobre nueve porque el diccionario tiene nueve.**

---

### F-8cC1-010 — `NUCLEO/08` §3 dice «doce acciones» y su tabla enumera dieciséis actos; la regla que exige «un permiso de esa acción concreta» cuantifica sobre actos

**Qué se rompe.** La única regla que impide que un administrador opere sobre una cuenta ajena con
*«una condición general de «es administrador»»* se apoya en un catálogo cerrado, y el catálogo
está contado por filas mientras la regla cuantifica por actos. Cuatro filas nombran **dos actos
cada una**, y en los cuatro casos los dos actos son **opuestos** —uno da y el otro saca—, que es
precisamente la distinción que un permiso por acción concreta existe para hacer.

**El camino.**

1. La regla: `V/17` §3.2 regla 1 — *«**`actor ≠ sujeto` exige un permiso de esa acción concreta**,
   no una condición general de «es administrador». **Las doce acciones del capítulo 08 §3 llevan
   permiso propio, una por una**»*.
2. El catálogo, contado por mí sobre `NUCLEO/08` §3: **doce filas**. Contado por acto: **dieciséis**
   — cuatro filas llevan una conjunción:
   *«otorgar **o revocar** una cortesía temporal»*, *«otorgar **o revocar** un grant permanente»*,
   *«aprobar **o rechazar** una postulación de Partner»*, *«**pausar o reanudar**»*.
3. Y los pares no son simétricos ni en peligro ni en efecto. El propio § lo escribe para uno:
   *«otorgar o revocar un **grant permanente** | **sí**, y la más grave: **revocar** deja al
   cliente **sin grant y sin suscripción**, o sea sin servicio»*. La columna *«¿destructiva o mueve
   dinero?»* está contestada **para la fila**, no para cada acto, así que la confirmación
   explícita que el § exige *«si es destructiva o mueve dinero»* queda declarada igual para otorgar
   que para revocar.
4. Y el mismo catálogo es la lista de excepciones del reparto `actor ≠ sujeto`: `V/17` §3.2 regla
   3 evalúa los pasos 5, 6 y 7 sobre el sujeto *«con la excepción acotada a las doce»*. Una
   excepción acotada a un conjunto que no se sabe si tiene doce o dieciséis elementos no está
   acotada.

**Dónde lo permite el diseño.** `NUCLEO/08` §3 (la tabla y sus dos reglas del §3.1); `V/17` §3.2
reglas 1 y 3; `V/19` §2.

**Severidad.** `MEDIA` — no abre acceso por sí solo: el catálogo existe y es cerrado. Lo que queda
sin decidir es si hacen falta doce permisos o dieciséis, y el error cae del lado caro en cuatro
casos concretos, porque el acto peligroso de cada par es el segundo.

**¿Es nuevo, o es el arreglo?** **Preexistente en el núcleo, y lo volvió portante el arreglo 3.**
Antes, por `D-23`, una inspección no era operación de dominio y el catálogo se leía como una lista
de referencia; desde que `V/17` §3.5 metió toda operación en la resolución, **el catálogo es el
cuantificador de dos reglas de autorización** y su cardinalidad decide. `F-8cA1-005` lo apoya en la
tabla, no en el conteo, y lo marcó `NUCLEO`: lo adopto acá.

---

### F-8cC1-011 — Tres de las diez entradas de la lista de invalidación no invalidan «la entrada de un `user + vertical`»: invalidan todas, y el segundo consumidor de la lista es un reconciliador que despublica

**Qué se rompe.** La lista de `V/02` §3.2 tiene un encabezado que declara su alcance —*«Invalidan
**la entrada de un `user + vertical`**»*— y el arreglo 4 le agregó tres filas cuyo alcance es **la
plataforma entera**. Como la misma lista es el disparador del reconciliador de excedentes
(*«una lista, dos consumidores»*), cualquiera de esas tres entradas dispara, por su letra, **un
recálculo y una reconciliación de excedentes sobre toda la cartera** — y el reconciliador
despublica. Ningún documento dice qué hace el sistema en ese caso.

**El camino.**

1. El encabezado, textual: `V/02` §3.2 — *«Invalidan **la entrada de un `user + vertical`**:»*.
2. Las tres filas nuevas, contadas por mí sobre la tabla de diez:
   - *«se publica una versión nueva de la de PISO o de la de PRE-TRIAL»* — el propio § dice que
     *«las otorga **todo el mundo**»*;
   - *«se publica una versión nueva de un plan al que hay GRANTS anclados»*;
   - *«se publica una versión nueva de un `addon_version`»*.
3. El segundo consumidor y lo que hace: `V/15` §4.2 — *«es la **misma lista** que invalida el
   caché (cap. 02 §3.2) … Una lista, dos consumidores»*— y `V/15` §4.3 — *«Nunca borra. **Archiva,
   despublica o deshabilita**»*, con el criterio *«cae lo más reciente primero»*.
4. Y la regla de invalidación es *«borrar, no recalcular»* (`V/02` §3.2, regla 1), justificada en
   que *«la próxima lectura lo recalcula sola»* — un argumento que vale para una entrada y no para
   la cartera entera.
5. El caso no es hipotético: la razón escrita de la entrada del piso es **retirar una clave
   comercial mal sembrada**, o sea un recorte que alcanza a todos. El reconciliador *«actúa sólo
   si algo bajó»*: bajó, para todos.
6. `F-8cA1` lo dejó anotado como *«Fuera de mi vector → Datos (A3)»* y A3 no lo tomó. Lo verifiqué
   sobre los seis informes: **ninguno lo desarrolla**.

**Dónde lo permite el diseño.** `V/02` §3.2 (el encabezado, la tabla de diez filas y las dos
reglas), `V/15` §4.2 y §4.3.

**Severidad.** `MEDIA` — la dirección es la segura en el caso que la entrada viene a cubrir (se
retira algo que sobraba), y el excedente que el reconciliador baja es real. Lo que falta es que
alguien haya decidido que una publicación de catálogo puede despublicar fichas de toda la
plataforma en una corrida, con el criterio *«cae lo más reciente primero»* aplicado a la cartera.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 4.** Las siete originales cuelgan de una
suscripción o de un trial y por eso el encabezado era exacto; las tres nuevas *«no cuelgan de
ninguno»*, que es su razón de ser, y **eso es también por qué el encabezado dejó de valer**. El
arreglo escribió la regla general (*«si una fuente puede cambiar lo que otorga sin que cambie
ninguna fila del `user + vertical`, necesita su propia entrada»*) y no revisó la oración que
declara el alcance de la lista.

---

### F-8cC1-012 — `NUCLEO/03` regla 1 declara la tabla exhaustiva y no dice nada sobre guardas superpuestas; `T1`/`T6` es el primer par del programa con dos salidas

**Qué se rompe.** Las seis reglas de lectura del núcleo son *«la diferencia entre una máquina de
estados y una convención»*, y cubren lo que **falta** en una tabla y nada de lo que **sobra**. Con
`T6` el programa tiene su primer par `(origen, evento)` con dos filas y dos destinos, y la regla
que gobierna cómo se leen todas las máquinas no tiene con qué dirimirlo. El resultado es que el
desenlace depende del orden en que una implementación recorra dos filas.

**El camino.**

1. `NUCLEO/03` §1 regla 1: *«**La tabla de transiciones es exhaustiva.** Lo que no está, no
   pasa.»* Dice qué pasa con lo que falta; nada sobre dos filas que aplican a la vez.
2. Las otras cinco tampoco: la 2 es sobre la columna de estado, la 3 sobre atomicidad, la 4 sobre
   el evento de dominio, la 5 sobre el proveedor y la 6 sobre grace y pausa. **Ninguna es de
   precedencia**, y las recorrí una por una.
3. El par: `V/03` §2, `T1` y `T6` comparten `desde: PRE_TRIAL` y `evento: el evento de activación
   declarado por la vertical`, y sus condiciones no son disjuntas — una es del catálogo (*«la
   vertical declara evento y su plan de trial tiene días de trial > 0»*) y la otra del sujeto
   (*«ya hay una suscripción viva»*).
4. Los dos destinos son incompatibles y los dos son caros: `TRIAL_ACTIVE` sin salida alcanzable
   (`F-8cA1-001`) o `TRIAL_CONVERTED` con el trial quemado (`F-8cA2-002`).
5. Y es el primero: lo verifiqué recorriendo las cinco tablas de transiciones del programa —`V/03`
   §2, §9 y §11, `B/03` §3.2 y §8— buscando pares `(desde, evento)` repetidos. **`T1`/`T6` es el
   único.** `S14` y `S15` comparten *«cualquiera»* como origen pero tienen eventos distintos y
   ninguna mueve la columna de estado.

**Dónde lo permite el diseño.** `NUCLEO/03` §1, las seis reglas; `V/03` §2, filas `T1` y `T6`.

**Severidad.** `MEDIA` — el daño concreto ya está contado por A1, A2 y A3 en sus propios IDs; lo
que aporta este hallazgo es que **la corrección no es de `V/03`**: una regla de precedencia es del
núcleo, porque la siguiente máquina que tenga dos salidas para un par la va a necesitar igual.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 8**, y es el dominio que crea en su
forma más directa: una transición nueva sobre un par ya ocupado. A2 y A3 lo marcaron `NUCLEO` y lo
mandaron a esta pasada; lo adopto.

---

### F-8cC1-013 — `D7` y `D15` se enuncian sin excepción y tres transiciones declaradas producen la excepción; el apoyo de base de `D15` hace cumplir la mitad que no es el invariante

**Qué se rompe.** Dos invariantes del §3 del núcleo afirman más de lo que el diseño cumple, y en
los dos casos la diferencia no es de redacción: es el sujeto de un defecto crítico ya reportado.
Un invariante sobre-enunciado es peor que uno ausente, porque quien lo lee deja de buscar el caso.

**El camino.**

1. **`D7`**: *«La suscripción vieja se cancela **sólo** al recibir el webhook de que la nueva quedó
   autorizada»* (`NUCLEO/04` §3). Tres transiciones declaradas de `B/03` §3.2 la cancelan por otra
   causa y antes de ese webhook: `S12` (*«llega la fecha de fin de servicio»*), `S13`
   (*«`SUPER_ADMIN` otorga *Free Forever*»*) y `S16` (*«el primer cobro se rechaza»* →
   `CHARGE_DECLINED`, terminal). `D7` **no declara ninguna excepción**, así que o las tres lo
   violan o el enunciado es más fuerte que la decisión que lo sostiene (`DEC-SUB-006`, que habla
   del orden del cambio de plan y no de toda muerte posible).
2. **`D15`**: *«a lo sumo **una sucesora viva** por `user + vertical`, y una sucesora no puede ser
   sucedida»*, apoyado en *«**base**: los dos índices parciales, partidos por `sucede_a`»*. Los dos
   índices hacen cumplir el *«a lo sumo una»* en cada mitad. **Lo que ninguno hace cumplir es que
   la mitad `A` esté ocupada**, y ése es el contenido real del invariante 8 del §64 —*«máximo una
   suscripción principal por vertical»*, que `NUCLEO/04` §2.1 dice que *«cuenta **compromisos, no
   filas**»*—. Un candado `A` **vacío** cumple los dos índices y deja al usuario con cero
   compromisos registrados y dos autorizaciones cobrando.
3. Las dos consecuencias están reportadas y son las mismas: `F-8cB1-001` y `F-8cB3-001`. Lo que
   falta acá es la mitad de enunciado.

**Dónde lo permite el diseño.** `NUCLEO/04` §3 (`D7`, `D15`) y §2.1 (invariante 8); `B/03` §3.2
(`S12`, `S13`, `S16`, `S17`); `B/02` §2.2 (los dos candados).

**Severidad.** `MEDIA` — el daño ya está contado dos veces como `CRITICA`; lo que se reporta es el
texto que impide verlo. `B1` los dejó marcados `NUCLEO` y los adopto con su clasificación.

**¿Es nuevo, o es el arreglo?** **`D15` y su apoyo son de la tanda del candado y `D7` es
anterior**; lo que la 9-bis agregó es `S17`, que hizo que *«se cancela sólo al recibir el
webhook»* pasara de ser una intención sin ejecutor a ser una transición con condición de disparo —
y con eso volvió comparables el enunciado y la tabla, que es lo que destapa la diferencia.

---

### BAJA

### F-8cC1-014 — El índice del núcleo sigue diciendo «51 invariantes» en dos lugares y el capítulo 04 dice 52

**Qué se rompe.** El único documento que se presenta como *«el mapa»* de las tres partes describe
el capítulo de invariantes con un número que ese capítulo corrigió.

**El camino.**

1. `NUCLEO/00`, *«Las tres partes»*: *«No se parte: un glosario en dos mitades deja de ser un
   glosario, y **51 invariantes** numerados de corrido pierden lo único que los hace útiles»*.
2. La misma tabla, dos líneas más abajo: *«| `04` | invariantes | **los 51**, con quién sostiene
   cada uno |»*.
3. `NUCLEO/04` §5, corregido el 2026-09-19 por la propia 9-bis: *«**Cincuenta y dos invariantes**,
   y diez los sostiene la base»*, con el recuento entero y su nota de método.
4. Los dos archivos llevan `status: CURRENT`. El `00` tiene `updated: 2026-09-18` y el `04`
   `updated: 2026-09-19`.

**Dónde lo permite el diseño.** `NUCLEO/00`, dos líneas; `NUCLEO/04` §5.

**Severidad.** `BAJA` — es un conteo en un índice. Lo reporto porque el propio §5 del `04` declaró
el método (*«los conteos se recorren enteros con un script, o no se tocan»*) y **el script recorrió
el capítulo y no sus consumidores**, que es la misma forma de `V/15` §4.2 con *«sus siete
entradas»*.

**¿Es nuevo, o es el arreglo?** **Es la tercera corrección de registro de la 9-bis**, que recontó
el §5 del `04` y no tocó el `00`.

---

### F-8cC1-015 — Tres referencias del núcleo apuntan a secciones que el desarme se llevó, y cinco apuntan a un «cap. NN» que existe en las dos épicas con contenido distinto

**Qué se rompe.** El núcleo es el documento que las dos épicas *«referencian»*, y una parte de sus
propias referencias no resuelve. Dos clases distintas, y la segunda es la que puede mandar a leer
la mitad equivocada.

**El camino.**

1. **Referencias a un § que ya no está en el archivo** (las verifiqué una por una contra los
   encabezados de cada archivo):
   - `NUCLEO/02` §2.6 — *«se explica en **§4**»*. `NUCLEO/02` tiene §1 y §2.6, y nada más.
   - `NUCLEO/03` §1 regla 6 — *«Se describen en **§4 y §5**»*, sobre Grace y Pausa.
     `NUCLEO/03` tiene un solo §. Las dos secciones están en `B/03`.
   - `NUCLEO/02` numera su única sección de entidades **§2.6** sin que existan §2.1 a §2.5.
2. **Referencias a un «cap. NN» que existe en las dos épicas**, sin calificar cuál, medidas con
   `rg -o "cap\. *[0-9]+"` sobre los siete archivos del núcleo: `NUCLEO/04` §2.1 *«cap. 02 §4»*,
   `NUCLEO/04` §2.2 *«cap. 03»* y *«cap. 03 §8»*, `NUCLEO/04` §3 *«cap. 10 §2»*, *«cap. 10 §3.2»*
   y *«cap. 10 §4.2»*, y `NUCLEO/08` §1.3 *«cap. 02 §4.1»*.
3. **La peor es la última**, y por eso tiene hallazgo propio (`F-8cC1-007`): hay dos `cap. 02
   §4.1`, los dos con el mismo título, y sólo uno contiene la regla que la frase invoca.
4. El núcleo sabe distinguir cuando quiere: `NUCLEO/01` §1.4 escribe *«cap. 02 (épica de billing)
   §2.2»* y `NUCLEO/07` §6 escribe *«cap. 12 §5.3 (épica de billing)»*. La calificación existe y
   se aplica en unos lugares y no en otros.

**Dónde lo permite el diseño.** `NUCLEO/02` §2.6; `NUCLEO/03` §1 regla 6; `NUCLEO/04` §2.1, §2.2 y
§3; `NUCLEO/08` §1.3.

**Severidad.** `BAJA` — ninguna manda hoy a un contenido contradictorio salvo la de `NUCLEO/08`,
que va con su propio ID. Lo reporto junto porque es el rastro medible del desarme y porque el
mismo rastro ya produjo un defecto de contenido.

**¿Es nuevo, o es el arreglo?** **Lo produjo el desarme del 2026-09-18**, que verificó *«105 de 105
encabezados presentes en alguna mitad»* —o sea que nada se perdió— y **no verificó las referencias
internas**, que es la otra mitad de partir un documento.

---

### F-8cC1-016 — `NUCLEO/08` §4.3 congela «las cuatro condiciones del cap. 05 §3», que es exactamente el conjunto que la contradicción del pago tardío obliga a cambiar

**Qué se rompe.** El núcleo le exige al listado accionable que diga *«cuál de las cuatro
condiciones falló»*, y con eso fija por número el contenido de un § de billing que esta pasada
encuentra contradicho por otro capítulo. Cualquier arreglo del pago tardío cambia el conjunto, y el
núcleo se entera si alguien se acuerda.

**El camino.**

1. `NUCLEO/08` §4.3 — *«Cada entrada lleva: **cuál de las cuatro condiciones del cap. 05 §3
   falló**, cuando el caso es un pago tardío — sin eso, quien lo mire tiene que rehacer el
   diagnóstico entero.»*
2. `B/05` §3 tiene hoy cuatro condiciones, contadas por mí, y la tercera es la que la
   contradicción de `F-8cB1-005` / `F-8cB3-002` (dictaminada en el §3.2) obliga a reescribir: su sujeto es
   *«un estado que dé título»* y el peligro que vigila es *«una autorización que puede cobrar»*.
3. El mismo `B/05` §3 declara el contrato con el núcleo: *«**Si falla cualquiera**, se pone la
   marca … y el evento crítico dice **cuál** falló»*. Los dos documentos se referencian por el
   número.
4. Es la misma forma de `V/15` §4.2 con *«sus siete entradas»*, que esta pasada reportó cuatro
   veces (`F-8cA1-008`, `F-8cA2-008`, `F-8cA3-012`, `F-8cA2-015`): **una cardinalidad escrita en la
   prosa de quien no es dueño de la lista.**

**Dónde lo permite el diseño.** `NUCLEO/08` §4.3; `B/05` §3.

**Severidad.** `BAJA` — hoy los dos números coinciden y nada falla. Se reporta porque el §3 de
`B/05` es el sujeto de una contradicción abierta y su conjunto de condiciones va a cambiar.

**¿Es nuevo, o es el arreglo?** **Preexistente**, y lo vuelve relevante el arreglo 15, que puso a
`B/05` §3 en colisión con `B/12` §5.3.

---

## 2. Deduplicación de los críticos — el encargo

**Los 24 IDs `CRITICA` de A y B son 15 defectos distintos. Uno de los 15 baja a `ALTA` por el
criterio escrito de esta fase, así que quedan 14; con el `CRITICA` de esta pasada, el conteo de
esta vuelta es 15 defectos críticos distintos.**

El punto de partida es el recuento del orquestador, que verifiqué: A1 3, A2 3, A3 6, B1 5, B2 4,
B3 3 = **24**.

### 2.1 El mapa: qué ID colapsa en cuál

| # | defecto distinto | IDs `CRITICA` que lo reportan | otros IDs del mismo defecto | arreglo |
|---|---|---|---|---|
| **1** | **`PB2` no dispara la mañana del corte**: en `t = 0` no hay nada que dispare el recálculo, así que las fichas de la cartera quedan publicadas sin cobertura | `F-8cA1-003`, `F-8cA2-001`, `F-8cA3-003` | `F-8cB3-009` (`ALTA`) | 9 + 22 (+23) |
| **2** | **`T1` gana el par y deja una fuente `TÍTULO` perpetua**: quien contrata antes de publicar opera con el plan más caro sin fecha de fin | `F-8cA1-001` | `F-8cA2-005`, `F-8cA3-007` (`ALTA`) | 8 |
| **3** | **`T6` dispara sobre un estado que no cubre y quema el trial de por vida** —y su rama espejo, que `T6` no pueda evaluarlo y `T1` corra sobre un `SUSPENDED` | `F-8cA2-002`, `F-8cA3-001`, `F-8cB2-001` | `F-8cA1-012` (`MEDIA`) | 8 × 16 |
| **4** | **El grant ancla UN plan y su scope son N verticales**: la segunda vertical resuelve contra el plan de la primera | `F-8cA1-002`, `F-8cA3-005` | `F-8cA1-013`, `F-8cA3-011` (adyacentes) | 6 |
| **5** | **El gate que descarta los `COMPLEMENTO` sin título vive en el contrato y no en `V/15`**, que sigue diciendo *«suma todas las fuentes vivas»* | `F-8cA3-004` | `F-8cA1-007` (`ALTA`) | 2 |
| **6** | **`addon_product.version_id` sigue declarado como la referencia que transporta la fuente `ADDON`** | `F-8cA3-002` | `F-8cB3-008` (`ALTA`) | 10 |
| **7** | **La entidad `listing` no tiene camino declarado al modelo nuevo** | `F-8cA3-006` | — | 22 (lo destapó) |
| **8** | **La predecesora muere en un estado no vivo → `S17` inalcanzable → `sucede_a` eterno → candado `A` vacío → dos autorizaciones cobrando** | `F-8cB1-001`, `F-8cB3-001` | `F-8cB1-008`, `F-8cB2-006` (`ALTA`), `F-8cA1-015` (`MEDIA`) | 11·12 |
| **9** | **`S13` no alcanza a una sucesora en `PENDING_AUTHORIZATION`**: el beneficiario de *Free Forever* queda pagando | `F-8cB1-002` | — | 11·12 |
| **10** | **`S17` limpia `sucede_a` en el mismo acto**, así que *«y no tiene sucesora»* es inalcanzable y los addons del upgrade se cancelan | `F-8cB1-004`, `F-8cB2-002` | `F-8bB1-012` (sigue llegando) | 11·12 |
| **11** | **`B/05` §3 y `B/12` §5.3 dan veredictos opuestos sobre el mismo cobro** | `F-8cB1-005`, `F-8cB3-002` | — | 15 |
| **12** | **La regla del arreglo 15 nombra a la sucesora y el cobro le llega a la predecesora**: `S5` se aplica igual y el reembolso nunca se dispara | `F-8cA2-003` | — | 15 (con vocabulario de 11·12) |
| **13** | **El reembolso del arreglo 15 supone que la sucesión siempre termina**: si el cliente abandona, se le devolvió el pago que lo salvaba | `F-8cB2-003` | — | 15 |
| **14** | **Un addon cuyo título cae en `CHARGE_DECLINED` no queda huérfano nunca**: cobra todos los meses con su capacidad apagada | `F-8cB2-004` | — | 2 × 20 × (el racimo de `CHARGE_DECLINED`) |
| **15** | **La lápida no existe entre el paso 3 y el paso 4 del corte** | `F-8cB3-003` | — | 21 × 23 |
| — | ~~**El espejo de los «ocho pares»**~~ → **baja a `ALTA`**, ver §3.3 | `F-8cB1-003` | `F-8cA1-009`, `F-8cA2-004`, `F-8cB2-005`, `F-8cB3-004` (los cuatro ya `ALTA`) | 18 |

**Las cuatro fusiones que el orquestador anticipó, verificadas:** el espejo del §10.1 lo levantaron
**los seis** (uno como `CRITICA`, cinco como `ALTA`); `S17` limpiando `sucede_a` lo levantaron A2,
B1, B2 y B3 — pero **no sobre el mismo defecto**: B1 y B2 lo levantan sobre los addons (#10), B3 y
B1 sobre el candado vacío (#8), y A2 sobre el sujeto de la regla del pago tardío (#12). `PB2` la
mañana del corte lo levantaron A1, A2, A3 y B3 (#1). Y `T1`/`T6` lo levantaron A1, A2 y A3, con
**dos desenlaces opuestos** que por eso quedan como dos defectos (#2 y #3).

### 2.2 Dos decisiones de agrupamiento que conviene declarar, porque cambian el número

1. **#2 y #3 no se fusionan, aunque comparten raíz.** Los dos salen del arreglo 8 y del mismo par
   `(PRE_TRIAL, evento de activación)`. Los separo porque **las correcciones son distintas y
   ninguna cierra la otra**: #2 se cierra con una regla de precedencia y una condición negativa en
   `T1`; #3 se cierra definiendo *«viva»* contra un conjunto que verticales pueda observar
   (`F-8cC1-002`). Quien arregle uno y no el otro deja el sistema roto en la dirección contraria,
   que es exactamente la forma de defecto que esta fase mide.
2. **#11 y #12 no se fusionan.** Las dos terminan en *«`S5` reactiva la predecesora y no hay
   reembolso»*, y las dos vienen del arreglo 15. Pero #11 es *«otro capítulo dice lo contrario»* y
   #12 es *«este capítulo nombra la fila equivocada»*: **borrar la nota de `B/05` §3 no arregla
   #12, y corregir el sujeto en `B/12` §5.3 no arregla #11.** Son dos escrituras distintas.

### 2.3 La proporción que la fase existe para medir

| | 8-bis | 8-bis-2 |
|---|---|---|
| `CRITICA`, contados por ID | 28 | **24** (A y B) **+ 1** (`C1`) |
| `CRITICA`, **defectos distintos** | no se midió | **15** |
| **atribuidos a la tanda de arreglos anterior** | **25 de 25** en A y B | **15 de 15** |

**Los quince son atribuibles a un arreglo de la 9-bis.** Ninguno es un defecto preexistente que
haya llegado entero. Recorrí los quince y el único caso limítrofe es el #7 (`listing`), que A3
clasifica bien: el hueco es anterior y **lo destapó** el arreglo 22 al hacer por primera vez la
pregunta *«cómo amanece la población existente»*; sin ese arreglo el hueco no era alcanzable como
afirmación. Lo mismo vale para mi `F-8cC1-001`: el callejón de `ARCHIVED` es de la FASE 8 y **la
entrada nueva la construyó el arreglo 16**.

**Y el modo cambió, que es el dato que la 8-bis no podía dar.** En la 8-bis los 25 eran arreglos
que **no habían recorrido su propio dominio**. Acá, clasificando los 15 por modo de falla:

| modo | cuántos | cuáles |
|---|---|---|
| el arreglo se escribió **en un solo lado de una frontera de dos** | **6** | #4, #5, #6, #9, #11, #14 |
| el arreglo **volvió falsa la premisa de otro arreglo** | **5** | #1, #3, #13, #15, y mi `F-8cC1-001` |
| el arreglo **declaró su dominio recorrido y lo recorrió a medias** | **3** | #8, #10, #2 |
| el arreglo **abrió una pregunta y contestó una mitad** | **2** | #7, #12 |

**La obligación 1 de `DEC-METH-008` funcionó y la 2 no se ejecutó.** Los tres arreglos que traen su
dominio escrito —la tabla de 6 × 4, los nueve estados, los dos valores de `sucede_a`— dejaron su
propio dominio en orden y **los tres se rompen contra el dominio del arreglo de al lado**. Ninguno
de los 15 se habría evitado con más recorrido interno; **once de los 15 se detectan con una
búsqueda de texto por el término que el arreglo redefine, sobre los capítulos que el commit no
toca** — es la mecánica que `B1` propone al cerrar su informe, y la confirmo contando: `sucede_a`,
«sucesora», «viva», «barrido», «cubierto», `plan_id`, `version_id`, «pago tardío».

---

## 3. Las contradicciones entre informes, con veredicto — el encargo

Verifiqué cada una **contra el texto del capítulo**, nunca contra el informe que la cita.

### 3.1 El dominio del espejo: 36 o 40 · **los dos conteos son correctos y el programa tiene dos respuestas**

**Lo que dice cada uno.** A1: 36, cubre 20, faltan 16. B1: 36, cubre 20, faltan 16, con la tabla
fila por fila. B2: 36, cubre 20, faltan 16, con la tabla por estado del proveedor. B3: 36, cubre
20, faltan 16, y declara haber recorrido *«36 de 36»*. **A2: 40, cubre 21, faltan 19.**

**Lo conté yo sobre `B/03` §10.1 y §3.1**, fila por fila y comodín por comodín:

| estado del proveedor | qué cubre la tabla | con 9 estados nuestros | con 10 |
|---|---|---|---|
| `pending` | uno explícito + *«cualquier otro»* | 9 | 10 |
| `authorized` | `PENDING_AUTHORIZATION`, `PAUSED`, `GRACE_PERIOD`, `SUSPENDED` | 4 | 4 |
| `paused` | `ACTIVE` | 1 | 1 |
| `cancelled` | `CANCEL_SCHEDULED` + *«cualquier estado vivo que no sea `CANCEL_SCHEDULED`»* (5) | 6 | 6 |
| | | **20 de 36** | **21 de 40** |

**Veredicto: ninguno de los cinco se equivocó al contar. La diferencia es un décimo estado, y el
programa lo declara dos veces de las dos maneras.**

- **36 es el dominio que el capítulo declara.** `B/03` §3.1 cierra con *«así que **siguen siendo
  nueve**»*, y todo el resto del corpus cuenta nueve —el contrato §2.6 titula *«los nueve, sin
  huecos»*—. Contra ese texto, A1, B1, B2 y B3 aciertan.
- **40 es el dominio que la regla tiene que contestar.** La tabla del §3.1 tiene **diez filas** y
  la décima es `(sin fila)`; `NUCLEO/03` §1 regla 2 declara que eso **es un estado**; y el par
  `authorized × (sin fila)` es un caso real con nombre propio en el programa —la huérfana de
  `B/09` §2.2 y de `NUCLEO/08` §2.2—. Contra ese texto, A2 acierta.
- **Y el desacuerdo esconde el defecto que ninguno de los cinco nombró**: sobre ese décimo estado
  la regla de default del §10.1 **no se puede ejecutar**, porque la marca es *«una marca booleana
  sobre la fila»* y ahí no hay fila. Va como `F-8cC1-009`.

**Consecuencia práctica, y es la única que importa para el arreglo**: los 16 pares que los cuatro
enumeran son **los 16 que hay que resolver**, porque el par 17 al 19 —los de `(sin fila)`— no se
resuelven con una fila de esa tabla sino remitiendo al camino de huérfanas. **Quien arregle el
§10.1 tiene que escribir 16 filas y una remisión, no 19 filas.**

### 3.2 `B/05` §3 vs `B/12` §5.3 · **manda `B/12` §5.3; `B/05` §3 usa el criterio equivocado, y se puede decir por qué**

Tres informes la levantan con el mismo par de citas (`F-8cB1-005`, `F-8cB3-002`, y `F-8cA2-003`
desde el otro lado). Los tres describen bien el choque y **ninguno dictamina**. Dictamino.

**Las dos citas, verificadas contra el texto:**

- `B/05` §3, condición 3: *«no hay otra fila principal del mismo `user + vertical` **en un estado
  que dé título** —`ACTIVE`, `GRACE_PERIOD`, `PAUSED`, `CANCEL_SCHEDULED`—, ni una sucesora de esta
  fila ya autorizada»*, más la nota *«**Y una sucesora en `PENDING_AUTHORIZATION` no bloquea, a
  propósito.** Todavía no puede cobrar —`D8` le exige fecha de primer cobro futura— y el pago tardío
  que reactiva a la predecesora **es la evidencia de que la sucesión ya no hace falta**»*.
- `B/12` §5.3: *«**`S5` no se aplica sobre una fila que ya declaró sucesión.** El pago entra, se
  registra, y **se reembolsa**»*.

**Veredicto: manda `B/12` §5.3, y `B/05` §3 tiene que cambiar su condición 3, no borrar su nota.**
Cuatro razones, en orden de peso:

1. **`B/05` §3 contradice su propia justificación.** La condición 3 existe, textual, porque *«si la
   hay, el pago es de una suscripción superada y **reactivar le daría dos**»*. Una sucesora en
   `PENDING_AUTHORIZATION` es exactamente una suscripción que va a superar a ésta: reactivar le da
   dos. La nota exime el caso que la condición describe.
2. **La condición enumera el conjunto equivocado, y se puede fechar cuándo dejó de servir.** Su
   sujeto es *«un estado que **dé título**»* y el peligro que vigila es *«una **autorización que
   puede cobrar**»*. Los dos conjuntos coincidían hasta que el **arreglo 16** declaró que
   `PENDING_AUTHORIZATION` **no emite fuente** (`12-contrato…` §2.6). Desde ese día hay un estado
   que no da título y sí tiene una autorización viva, y es el único que la condición deja pasar.
3. **El argumento de la nota es de tiempo, no de seguridad.** *«Todavía no puede cobrar»* es cierto
   —y el **arreglo 14** lo hizo más cierto: *«ninguna puede cobrar antes de que su propia ventana se
   cierre»*—, pero el daño no es que la sucesora cobre **ahora**: es que la predecesora vuelva a
   `ACTIVE` con el crédito de la sucesora ya computado en cero, que es lo que `B/12` §5.3 mide
   (*«paga un período entero que **no le compra nada**, y la fórmula que lo ignoró ya no se puede
   corregir»*). La nota contesta una pregunta que nadie hizo.
4. **La premisa empírica de la nota es falsa.** *«El pago tardío que reactiva a la predecesora es la
   evidencia de que la sucesión ya no hace falta»*: ese pago no es un acto del cliente, es una cuota
   en `recycling` que el proveedor reintenta solo —`B/12` §5.3 lo mide y lo llama así—. El cliente
   que abrió el checkout sigue pudiendo autorizarlo, y si lo hace, `S17` cancela la fila que el pago
   acaba de reactivar.

**Y un dato que los tres informes pasaron por alto y que explica por qué la colisión es invisible
al leer:** `B/05` §3 admite dos estados en su condición 1 —*«`GRACE_PERIOD` **o** `SUSPENDED`»*— y
su desenlace declarado nombra **una sola transición**: *«**Si las cuatro se cumplen**, entra
`SUSPENDED → ACTIVE` (**S7**)»*. Lo conté sobre el texto: **`S5` no aparece ni una vez en `B/05`**.
`B/12` §5.3 prohíbe `S5`; `B/05` §3 nombra `S7`. Leídos al pie de la letra **no se contradicen** —y
ahí está el problema: el caso que el §3 admite por su condición 1 y no nombra en su desenlace es
justamente el de `GRACE_PERIOD`, cuya única reactivación posible es `S5`. **La contradicción está
tapada por una incompletitud**, y quien implemente el §3 va a escribir la reactivación para los dos
estados porque la condición 1 los admite a los dos.

### 3.3 La severidad del espejo: `CRITICA` (B1) contra `ALTA` (A1, A2, B2, B3) · **manda `ALTA`**

`F-8cB1-003` lo clasifica `CRITICA` y lo declara honestamente: *«La cadena tiene un eslabón
argumental … Lo clasifico igual por consistencia, no por agregarle nada»*. `F-8cB2-005` argumenta
lo contrario con el criterio de esta fase a la vista, y `F-8cA2-004` dice que es *«el hallazgo que
más cerca quedó de `CRITICA`»*.

**Veredicto: `ALTA`.** El criterio de esta fase es *«alguien paga de más o de menos, alguien accede
a algo que no le corresponde, o un dato se pierde sin vuelta»*, y los tres son propiedades **del
defecto**, no de lo que el defecto deja de detectar. Lo que este defecto produce por sí solo es
bloquear el cambio de plan a toda la cartera y saturar el canal de conciliación; el cobro
equivocado que después no se ve **es un segundo defecto, que existe con o sin éste**. Bajarlo no lo
hace menos urgente: cuatro de cinco informes lo ponen primero entre sus `ALTA`, y es el de mayor
volumen de la pasada.

**Consecuencia sobre el conteo**: los críticos distintos pasan de 15 a **14** desde A y B.

### 3.4 Dos severidades más, dictaminadas

| defecto | quién dice qué | veredicto |
|---|---|---|
| **el descarte del `COMPLEMENTO` sin título** | `F-8cA3-004` `CRITICA` · `F-8cA1-007` `ALTA` | **`CRITICA`**. A1 baja por *«la regla existe y es obligatoria, y quien lea el contrato la cumple»* — y ése es **el argumento que el propio contrato rechaza** al diagnosticarse: *«una frase no es un gate: el capítulo 15 pliega lo que el contrato le da»*. Quien implementa el pliegue abre `V/15`, y `V/15` dice *«suma todas las fuentes vivas»* |
| **`addon_product.version_id`** | `F-8cA3-002` `CRITICA` · `F-8cB3-008` `ALTA` | **`CRITICA`**. Los dos describen el mismo desenlace —*«alguien recibe de más o de menos lo que pagó»*—, y eso es *«paga de más o de menos»* por el criterio literal de la fase. La columna que lo impide existe y la frase que manda usar la otra está **en la misma tabla, dos filas más arriba**: no hay ninguna lectura en la que el implementador tenga un tercer lugar que lo dirima |

### 3.5 Una afirmación de dos informes que es falsa contra el texto: *«`G7` no existe»*

`F-8cA1` («Fuera de mi vector») y `F-8cA2` («Fuera de mi vector», punto 4) concluyen, por separado,
que en el catálogo de guards **falta `G7`**. **Existe.** Está en `B/20` §2: *«| G7 | un valor
comercial vive **en código** | invariantes §64.15 y §64.16 |»*.

**Veredicto: los dos se equivocan, y el error es diagnóstico de un defecto real.** `G1`…`G11` es
**una** numeración repartida 7 / 4 entre las dos épicas, y cada capítulo 20 presenta su mitad con
la frase *«lo que permite preguntar «¿están todos?» una vez en vez de siete»*. Va como
`F-8cC1-008`. Lo que **no** corresponde hacer es escribir un `G7` nuevo, que es adónde lleva la
lectura de los dos informes.

### 3.6 El diagnóstico del racimo más grande está incompleto en los cuatro informes que lo levantan

`F-8cA1-003`, `F-8cA2-001`, `F-8cA3-003` y `F-8cB3-009` coinciden en la conclusión —**la mañana del
corte no se despublica nada**— y en la causa: *«un cambio necesita un valor anterior»* y nadie lo
guarda.

**La conclusión es correcta. La causa está a medias, y la diferencia decide el arreglo.**

1. **El valor anterior sí existe, y es `listing.estado`.** `PB2` es una transición con `desde:
   PUBLISHED`. Una ficha en `PUBLISHED` es la afirmación de que `cubierto` era verdadero cuando se
   publicó, y el `desde` es lo que vuelve idempotente la evaluación: correrla dos veces no hace
   nada la segunda. Por eso en **todas** las demás instancias de `PB2` —una suscripción que cae en
   `SUSPENDED`, un trial que vence— la transición funciona sin que nadie guarde nada.
2. **Lo que falta en `t = 0` no es memoria: es un disparador.** Lo dice el paso que los cuatro
   informes recorren bien: la lista de `V/02` §3.2 **no tiene una entrada para «el sistema
   arranca»** y un usuario que no toca nada no recalcula nada. Y no hay barrido: `F-8A2-005` lo
   nombra desde la FASE 8 y `F-8cA2` lo re-confirma en esta pasada (*«no existe ningún proceso
   periódico que compare publicación contra cobertura»*).
3. **Por qué importa.** Con el diagnóstico *«falta el valor anterior»*, el arreglo obvio es guardar
   `cubierto` en una columna — una fuente nueva de un dato derivado, que es exactamente lo que el
   contrato §2.4 acaba de rechazar para la clase de fuente (*«hacerlo sería la segunda fuente de un
   dato que esos dos ya determinan»*). Con el diagnóstico *«falta el disparador»*, el arreglo es una
   entrada en la lista de `V/02` §3.2 o el barrido que `F-8A2-005` viene pidiendo desde la FASE 8, y
   **el mismo barrido cierra `F-8cA3-006`** —las fichas que amanecen en el estado equivocado— y la
   mitad de `F-8cC1-004`.

---

## 4. Ataques que intenté y el diseño resistió

- **Hacer que las dos implementaciones del contrato (§5) den respuestas distintas sobre el mismo
  sujeto, para probar que la abstracción miente.** No pasa, y el caso testigo está bien elegido:
  *«alguien en `PRE_TRIAL` tiene `cubierto: no` y `fuentes` no vacío»* distingue la implementación
  de arranque **de una constante y de la real a la vez**, que es lo único que el §6.2 necesita.
  Recorrí los seis `tipo` buscando uno donde la de arranque tuviera que mentir y no hay: las dos
  que resuelve —trial y `BASE`— son las dos que viven del lado de verticales.
- **Conseguir cobertura perpetua confundiendo `SIN_EMPEZAR` con `NO_VENCE`.** Cerrado dos veces y
  bien: la tabla del §2.4 manda `TRIAL × SIN_EMPEZAR` a `BASE`, y el §2.6 escribe la advertencia
  aparte —*«`SIN_EMPEZAR` no es `NO_VENCE` … el error es en la dirección cara: **no falla
  ruidosamente, regala**»*—. Es el único lugar del corpus donde una regla trae escrita **la
  dirección** de su propio error.
- **Colar una clave de una vertical en otra por la ruta del caché.** No se puede: la clave del
  caché es `user + vertical` (`V/02` §3.1) y el pliegue de la ficha es un delta aparte (§2.7 del
  contrato), así que la ficha nunca entra en la clave. El argumento de asociatividad de las cuatro
  estrategias es correcto y lo verifiqué contra `V/15` §2.2: `SUMA`, `MÁXIMO`, `MÍNIMO` y
  `MEJOR_DECLARADO` son las cuatro asociativas.
- **Romper la deduplicación del outbox haciendo que dos verticales compartan ocurrencia.** No: la
  ocurrencia de un correo de schedule es *«el sujeto más el hito»* con el id del trial o de la
  suscripción, y los dos son por `user + vertical`. Y el caso que la regla **deja pasar a
  propósito** —el aviso que vuelve a salir tras una extensión— está escrito con su razón.
- **Usar la excepción del §22.1 (`DEC-OBS-001`) para que un doble cobro real quede dentro de la
  ventana de agregación.** Cerrado: la lista de excepciones es cerrada y contiene exactamente
  *«un doble cobro real detectado»* y *«un reembolso que falló sobre una revocación»*. Es lo único
  que sigue funcionando con la cartera entera marcada (`F-8cB1-003`), y conviene decirlo: la
  excepción no depende de la marca.
- **Que la invalidación fallida del caché deje vivo un entitlement revocado.** No: `V/02` §3.2
  regla 2 falla en la dirección segura —*«la entrada se marca sospechosa y la próxima lectura la
  ignora … se paga rendimiento, nunca acceso»*— y ninguno de los 23 arreglos la tocó.
- **Conseguir una cortesía que no arrancó, para explotar la celda `CORTESÍA × SIN_EMPEZAR` que la
  tabla del §2.4 deja muda.** No existe por dato: `courtesy_grant` guarda *«días o meses, inicio,
  fin»* (`B/02` §2.4) y `S9` la ejecuta pausando **en el acto**. La celda está vacía y es
  inalcanzable, aunque el § no lo diga (eso es el conteo de `F-8cA1-010` / `F-8cA2-010` /
  `F-8cA3-016`, no un agujero).
- **Perder la correlación entre la intención y el webhook que llega tres días después.** No: el
  §2.2 del `NUCLEO/08` recupera la cadena por `provider_link` y declara, con dos mediciones
  (`EX-19`, `RC-1`), por qué **no** viaja en el `external_reference`. Es de lo mejor razonado del
  núcleo y ningún arreglo lo movió.
- **Hacer que el estado exacto de la suscripción cruce la frontera por una puerta lateral.** Lo
  busqué en las tres preguntas de la dirección inversa (§4.1) y en los siete campos de la fuente
  (§2): no cruza. **La consecuencia es un defecto —`T6` necesita ese dato y no lo tiene
  (`F-8cA3-001`)— pero la frontera aguanta**, y aguantar es lo correcto: la alternativa es la que
  el §4 rechaza con su razón escrita.
- **Que `cubierto` quede verdadero para un `TRIAL_EXPIRED` por la puerta del título `BASE`.** No:
  `BASE` es de clase `BASE` y el §2.5 declara las tres cosas que la fuente **no** hace, con el
  guard `G-R3` comprobándose *«sobre las dos versiones no vendibles de cada vertical, no sobre
  una»*. La simetría entre la versión de piso y la de pre-trial está bien construida.
- **Encontrar un cuarto documento que redefina algo del núcleo.** Recorrí los siete archivos del
  núcleo contra los veinticuatro capítulos buscando redefiniciones y encontré **dos**, las dos en
  el capítulo 20: la tabla de las cuatro capas y el §2.1, duplicados palabra por palabra
  (`F-8cC1-008`). El resto de los capítulos **referencia y no redefine**, que es la regla del
  `NUCLEO/00`, y eso incluye a los dos capítulos 02 y a los dos 03, que declaran en su primera
  línea qué mitad son.

---

## 5. Fuera de mi vector

- **`B/22` y `V/22` (lo legal)** — no los recorrí. `M-LEGAL-03` sigue declarado abierto en
  `NUCLEO/04` §4 punto 3 y *«cambia el diseño, no la redacción»*; si la respuesta profesional
  vuelve al revés, `DEC-MP-002` y el catálogo de correos del `NUCLEO/07` §6 cambian los dos.
- **El capítulo 13 (Pagos)** — de mi vector, lo único que esta tanda le agregó es que
  `NUCLEO/08` §4.3 le fija por adelantado el vocabulario del diagnóstico (*«las cuatro
  condiciones»*, `F-8cC1-016`) y que `NUCLEO/07` §6 le fija un correo que todavía no dice lo que
  tiene que decir (`F-8cC1-005`).
- **`C2`** — la coexistencia y el orden del corte. `F-8cC1-001` toca el reloj de retención y lo
  reporto por el lado del dato que se pierde; el resto del §4 del `16-fase-7` lo dejo a `C2`, que
  ya tiene los cuatro hallazgos de `B3` sobre el mismo §.

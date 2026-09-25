---
title: "FASE 8-bis · C1 — la costura: capítulos partidos, el contrato, el núcleo y los invariantes"
linear: HOS-1352
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 8
---

# FASE 8-bis · C1 — la costura

Pasada C, después de A y B, y **sobre su material además del mío**. El vector es lo que ninguno de
los seis podía ver desde adentro de su épica: la costura entre los capítulos partidos, el contrato
de cobertura como única frontera declarada, `docs/nucleo/` —que es de esta pasada y de nadie más— y
los invariantes.

**Once hallazgos nuevos: 1 `CRITICA`, 6 `ALTA`, 3 `MEDIA`, 1 `BAJA`.** Siete de los once son de
`NUCLEO` o de la frontera, que es el material que tiene un solo dueño.

Y tres entregables que no son hallazgos y valen tanto como ellos: **las siete contradicciones entre
los seis informes** (§2), **las doce convergencias, nombradas una sola vez con su causa** (§3), y
**la deduplicación del conteo de críticos** (§3.1) — que es el número del que `DEC-METH-006` hace
depender si el ciclo sigue.

La tesis que ordena los once:

> **Los dos racimos que más movieron el diseño se invalidaron la premisa el uno al otro, y ninguno
> de los dos lo sabe.** `R3` volvió al trial una fuente viva en `PRE_TRIAL`; `R2` construyó el
> título `BASE` sobre la frase *«`Turista Free`, `Guest` y `TRIAL_EXPIRED` no tienen ninguna de las
> cuatro fuentes de clase `TÍTULO`»*, que `R3` vuelve falsa para dos de esos tres sujetos. Y el
> `BASE` que sobró de esa premisa es lo que apagó el paso 5, que es de donde salen los tres
> `CRITICA` de `A1`.

Los paths se abrevian como en los otros informes: `NUCLEO` es `HOS-1352-…/docs/nucleo/`, `V` es
`HOS-1353-verticales-capacidades-y-autorizacion/docs/`, `B` es
`HOS-1354-billing-cobro-y-proveedor/docs/`, y lo que no lleva prefijo es `HOS-1352-…/docs/`.

**Lo que no recuento como mío.** Que `PRE_TRIAL` es fuente de clase `TÍTULO` y que por eso
`cubierto` es verdadero para casi toda la plataforma está medido por `F-8bA2-001` y `F-8bA3-001`;
que nadie limpia `sucede_a` está medido por `F-8bB1-001`, `F-8bB2-002` y `F-8bB3-003`. Los cito y
construyo encima; no los vuelvo a contar.

---

## 1. Los hallazgos

### CRITICA

### F-8bC1-001 — Las tres defensas del §6 del contrato pierden su sujeto a la vez: la implementación de arranque **es** la cuarta fila que el §5.1 dice no tener

**Qué se rompe.** El contrato se escribió con tres defensas para que la frontera no mienta, y el
documento nombra explícitamente el desenlace que las anularía: una implementación que *«contesta
siempre que sí»*. Ese desenlace **ya ocurrió** —no por `BASE`, que es de donde el contrato lo vio
venir, sino por la fuente de trial en `PRE_TRIAL`—, y con él caen las tres a la vez: el default deja
de negar, el juego de casos compartido deja de poder distinguir una implementación correcta de una
constante, y el guard de producción queda protegiendo una salida por la que ya no pasa el defecto.
Toda la épica de verticales se construye, se testea y se revisa contra una cobertura que dice que sí
a casi todo el mundo, y `DEC-ARCH-007` ya declaró que el PR que la lleva a producción *«va a ser
enorme y nadie lo puede revisar de verdad»*.

**El camino.**

1. `V/03` §2 declara que el trial es **fuente viva en `PRE_TRIAL`**, con `hasta: SIN_EMPEZAR`, y
   cierra: *«**Y `PRE_TRIAL` no es un `tipo` nuevo del contrato**: la fuente sigue siendo `tipo:
   TRIAL`.»*
2. `12-contrato-de-cobertura.md` §2.4 deriva la clase del `tipo` y pone `TRIAL` en `TÍTULO`, que
   **sí** cuenta para `cubierto`. Es `F-8bA2-001` / `F-8bA3-001`, verificado.
3. **Ahí empieza lo que nadie siguió.** El §5.1 define la implementación de arranque: *«Resuelve
   honestamente las **dos** fuentes que ya viven del lado de verticales —el trial, con su máquina de
   estados del capítulo 03 §2, y el título `BASE` del §2.5— y responde que no a las cuatro de
   billing»*. Con el trial vivo en `PRE_TRIAL`, esa implementación devuelve `cubierto: sí` para toda
   persona que todavía no consumió su trial en esa vertical —*«el estado más poblado del sistema»*
   (`V/03` §2)— y, en Partner, para **toda** la base de usuarios y para siempre.
4. El propio §5.1 dice qué es eso, en su última línea: *«Si contara, la tabla de arriba tendría una
   cuarta fila —**«contesta siempre que sí»**— y sería ésta.»* La tabla clasifica esa fila como
   **fail-open**, y le pone el costo: *«la mitad interesante nunca se ejerce: perder la cobertura,
   `PB2`, el reconciliador, el aviso de qué se hizo»*.
5. **Defensa 1 (§6.1, el default es negar)**: *«Una fuente no implementada responde **que no**. Así,
   **un olvido apaga funciones en vez de regalarlas**»*. La fuente que más responde ya no es una no
   implementada: es la implementada, y responde que sí.
6. **Defensa 2 (§6.2, un solo juego de casos para las dos implementaciones)**: su propia condición de
   validez es *«El juego incluye el caso que distingue una implementación correcta de una que
   contesta siempre lo mismo — **si pasa con las dos, no está probando nada**»*. Ese caso **no se
   puede escribir**: la implementación real (§5.2) *«agrega las otras tres fuentes … y **no toca nada
   de lo construido**»*, o sea que sólo suma fuentes. Si la de arranque ya contesta que sí para un
   sujeto, la real también. El caso discriminante no existe para ningún sujeto en `PRE_TRIAL`, que
   son casi todos.
7. **Defensa 3 (§6.3, el guard)**: *«Falla sobre un build destinado a producción, no sobre la rama,
   así que no se dispara mientras nada apunte a producción: se puede escribir el día uno y quedarse
   callado meses. El momento que protege es **el del merge**»*. Protege contra que la implementación
   de arranque **llegue**; no protege contra que el diseño entero se haya validado contra ella
   durante esos meses. Y lo que llega al merge es lo que las defensas 1 y 2 no pudieron distinguir.
8. Desenlace: el defecto de `F-8bA2-001` no tiene ninguno de los tres filtros que el contrato puso
   para que un defecto de la frontera no llegue a producción, porque es el mismo hecho el que los
   desarma.

**Dónde lo permite el diseño.**

`12-contrato-de-cobertura.md` §5.1, la tabla y su cierre:

> | contesta **siempre que sí** | es un fail-open, y **la mitad interesante nunca se ejerce** … |
> | **resuelve el trial** | **los dos caminos se ejercen completos**, porque un trial vence de verdad |

Y en el mismo lugar:
> Y `cubierto` sigue yendo a falso cuando el trial vence, porque el título `BASE` no es de clase
> `TÍTULO` (§2.4). **Si contara, la tabla de arriba tendría una cuarta fila —*«contesta siempre que
> sí»*— y sería ésta.**

El razonamiento es correcto y **mira la fuente equivocada**: cerró la puerta de `BASE` y no releyó
el §2 del capítulo 03 de verticales, donde el trial acababa de pasar a cubrir desde antes de empezar.

`12-contrato-de-cobertura.md` §6.2:

> El juego incluye el caso que distingue una implementación correcta de una que contesta siempre lo
> mismo — **si pasa con las dos, no está probando nada.**

`12-contrato-de-cobertura.md` §5.2:

> Agrega las otras tres fuentes —suscripción, cortesía, grant— y **no toca nada de lo construido**

`V/03-maquinas-de-estado.md` §2: *«| `PRE_TRIAL` | **sí** | la versión de **pre-trial** de la
vertical | `SIN_EMPEZAR` |»* y *«la fuente sigue siendo `tipo: TRIAL`»*.

**Severidad.** `CRITICA` — es el mecanismo por el cual el acceso que `F-8bA2-001` y `F-8bA3-001`
describen llega a producción sin que ninguna de las tres defensas de la frontera lo pueda ver, y las
tres son *«parte de la decisión (`DEC-ARCH-006`), no una recomendación»*.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo, y lo introdujeron los dos racimos sin
componerse.** `R2` escribió las tres defensas y el argumento de la cuarta fila; `R3` produjo la
cuarta fila desde la otra punta del ciclo. Es exactamente lo que el §1 de las instrucciones pide
buscar —*«qué regla corregida en un capítulo contradice ahora a otro capítulo que nadie volvió a
leer»*— con el agravante de que el capítulo que nadie volvió a leer **es el propio §5 del contrato**,
a tres secciones del §2.4 que sí se corrigió.

---

### ALTA

### F-8bC1-002 — El candado `A` vacío y el candado `B` consumido son el mismo hecho, y compuestos dejan como única salida del cliente la que cobra dos veces

**Qué se rompe.** `F-8bB1-001` y `F-8bB2-002` leen la misma columna sin limpiar y llegan a
conclusiones opuestas, **y las dos son ciertas simultáneamente**. Leídas juntas dejan de ser dos
defectos y pasan a ser un embudo: al cliente que ya hizo un cambio de plan, el diseño le **cierra**
el camino de la sucesión y le **abre** el del alta nueva, que es el que deja dos preapprovals
cobrando. No es un borde que alguien pueda encontrar: es la ruta que queda.

**El camino.**

1. Tras el primer upgrade queda **una fila viva, `ACTIVE`, con `sucede_a` no nulo**, y nada la
   devuelve a `NULL`: medido por `F-8bB2-002` con `rg` sobre las tres épicas —*«las veintiséis
   apariciones de `sucede_a`/`sucesora`/`sucesión` son la columna, las dos claves, los dos guards,
   `D15`, el re-apuntado de addons y promos, y la condición 3 de `B/05` §3»*— y confirmado por
   `F-8bB1-001` y `F-8bB3-003`.
2. **Puerta 1, la sucesión: cerrada.** El candado `B` (`sucede_a IS NOT NULL AND estado ∈ {vivos}`)
   está ocupado por esa misma fila, y `G-R1-A` y `D15` lo prohíben por escrito además del índice.
   Es `F-8bB2-002`.
3. **Puerta 2, el alta nueva: abierta.** El candado `A` (`sucede_a IS NULL AND estado ∈ {vivos}`)
   está **vacío**, porque no hay ninguna fila que cumpla su predicado. La condición de `S1` —*«no hay
   otro **origen** vivo»*— se satisface. Es `F-8bB1-001`.
4. **Puerta 3, cancelar y volver a contratar: cerrada por tiempo.** `S11` lleva a
   `CANCEL_SCHEDULED`, que está **entre los seis vivos**, así que el candado `A` rechaza el alta
   hasta `S12`: hasta el fin del período pagado, que en un anual son doce meses. Es el paso 6 de
   `F-8bB3-003`.
5. **La composición.** Un cliente que quiere subir de plan por segunda vez prueba la puerta 1 y
   recibe un error; prueba la 3 y le dicen que espere un año; la 2 funciona. Y la 2 es la que deja
   **dos filas principales vivas con dos preapprovals autorizados**, que es el §11 violado sin que
   ninguna clave lo vea.
6. La consecuencia sobre la severidad es directa: `F-8bB3-003` la baja a `ALTA` con el argumento
   *«nadie paga de más por esto **sin elegirlo**»*. Compuesta, esa premisa se cae: el cliente no
   elige entre pagar una vez y pagar dos; elige entre el único camino que el sistema le deja abierto
   y no cambiar de plan.

**Dónde lo permite el diseño.**

`B/02-modelo-de-datos.md` §2.2, los dos candados y la garantía que se da por probada:

> **El máximo de filas principales vivas pasa de una a dos, y no a un número abierto.** Dos,
> exactamente: un origen y su única sucesora.

Y en el mismo lugar:
> **una sucesión no es una cadena**: al indexar `B` sobre `(user_id, vertical)` —y no sobre
> `sucede_a`— una sucesora no puede ser sucedida **mientras viva**, sin ninguna regla extra

Las dos frases son ciertas **durante** la sucesión. La primera deja de serlo cuando el origen muere
(la sucesora libera `A`); la segunda deja de serlo como garantía cuando *«mientras viva»* pasa a ser
*«para siempre»*, porque la sucesora **es** la suscripción del cliente.

`B/03-maquinas-de-estado.md` §3.2, condición de `S1`; §3.3, *«arrepentirse no es una transición: es
una sucesión»*. `B/20-testing.md` §2, `G-R1-A`. `NUCLEO/04-invariantes.md` §3, `D15`.

**Severidad.** `ALTA`, y **no suma al conteo de críticos**: la causa ya está contada como `CRITICA`
por `F-8bB1-001`. Lo que este hallazgo agrega es que el desenlace no es alcanzable por accidente
sino por diseño del embudo, y que la severidad `ALTA` de `F-8bB3-003` descansa en una premisa que la
composición desmiente.

**¿Es nuevo, o es el arreglo?** Es el arreglo, y es **lo que ninguno de los tres podía ver**: `B1`
recorrió la mitad `sucede_a IS NULL`, `B2` la mitad `IS NOT NULL`, y `B3` las dos sin componerlas
con el bloqueo temporal de `CANCEL_SCHEDULED`. El embudo sólo aparece leyendo los tres.

---

### F-8bC1-003 — `NUCLEO`: la marca `requiere_conciliación` no existe en la épica de verticales, y la regla 1 del núcleo prescribe ahí un remedio sin sede

**Qué se rompe.** La regla 1 del capítulo 03 del núcleo es la regla de lectura de **las nueve
máquinas**, y dice qué pasa con un intento de transición que la tabla no declara: se pone la marca
`requiere_conciliación` y se emite el §22.1. **Tres de las nueve máquinas viven en verticales, y ahí
la marca no existe**: ni la columna, ni la transición que la pone, ni la que la levanta, ni el
canal. Un intento no declarado sobre Trial, Publicación o Postulación de Partner **no tiene ningún
desenlace escrito**, ni siquiera el de marcar.

**El camino.**

1. `NUCLEO/03-maquinas-de-estado.md` §1, regla 1, sin acotar a ninguna máquina: *«La tabla de
   transiciones es exhaustiva. Lo que no está, no pasa. Un intento de transición que la tabla no
   declara **no se ejecuta**: se registra como evento de dominio y, si tocaba plata o estado, **pone
   la marca `requiere_conciliación`** y emite el §22.1.»*
2. Medido hoy sobre los once capítulos de `HOS-1353`: `requiere_concilia` aparece **cero veces**, y
   `22.1` aparece **cero veces**. En `HOS-1354` la marca aparece en cinco capítulos
   (`02`, `03`, `05`, `09`, `19`).
3. La sede que el núcleo le conoce es de billing, y sólo de billing: `NUCLEO/01` §2.2 la describe
   *«sobre la fila»* de Suscripción; `NUCLEO/04` §2.2 sostiene el invariante 21 en **`S14`**, una
   transición de `B/03`; `NUCLEO/08` §3 lista *«levantar la marca»* entre las acciones
   administrativas y la funda en `S15`.
4. Entonces, del lado de verticales, la regla 1 manda escribir una columna que ninguna tabla de
   `V/02` tiene y emitir por un canal que ningún capítulo de `V` nombra. Y **no se puede tomar
   prestada la de billing**: `12-contrato…` §4 declara que el estado de la suscripción no cruza, y
   `DEC-ARCH-006` impide que verticales agregue nada al contrato sola.
5. El caso concreto ya está reportado y sin dueño: `F-8bA2-008` describe un `T1` **cuya condición se
   cumple** y cuyo `INSERT` muere contra la `UNIQUE(hash_del_correo_normalizado, vertical)`, y cierra
   *«Ninguna regla dice qué pasa, qué se le contesta, ni si eso pone la marca `requiere_conciliación`»*.
   La respuesta medida es: la regla existe, y su remedio no tiene dónde escribirse de ese lado.
6. Y el segundo caso es peor porque cruza las dos: `F-8bA2-007` mide que nadie declaró que `PB1` y
   `T1` compartan transacción. Si `PB1` confirma y `T1` no, el intento fallido es exactamente el
   sujeto de la regla 1 — y deja una ficha `PUBLISHED` sin fila de trial, sin marca y sin nada que la
   encuentre.

**Dónde lo permite el diseño.**

`NUCLEO/03-maquinas-de-estado.md` §1, regla 1 (citada arriba), aplicada a *«todas»* las máquinas:
*«Seis reglas que valen para todas.»*

`NUCLEO/01-glosario.md` §2.2: *«**`RECONCILIATION_REQUIRED` no está en la lista porque no es un
estado**: es la marca `requiere_conciliación` **sobre la fila**»* — dentro de la fila de la máquina
**Suscripción**, y en ninguna otra de las siete filas de esa tabla.

`NUCLEO/04-invariantes.md` §2.2: *«| 21 | una divergencia que necesita intervención notifica a
`SUPER_ADMIN` | **`S14`**, que pone la marca `requiere_conciliación` sin mover el estado |»*.

`12-contrato-de-cobertura.md` §4: *«**El estado exacto de la suscripción no cruza.**»*

**Severidad.** `ALTA` — no abre un acceso por sí mismo; deja sin desenlace declarado a la única
regla que cubre lo que pasa cuando una máquina de verticales no puede ejecutar lo que se le pide, y
la FASE 9 acaba de darle a esas máquinas su primer modo de falla real (`T1` ahora escribe una fila y
choca contra una restricción). `A3` lo anotó *«fuera de mi vector»* mirando sólo la mitad del
cambio 8; medido, el hueco es de la regla, no del cambio.

**¿Es nuevo, o es el arreglo?** **Lo agrandó el arreglo.** Antes del cambio 8, la regla 1 no
prescribía ningún remedio concreto: el hueco era parejo para las nueve máquinas. Al darle un remedio
—la marca— se lo dio **en el vocabulario de una sola épica**, y la otra quedó con una regla que la
nombra y un remedio que no puede ejecutar.

---

### F-8bC1-004 — `NUCLEO`: el vocabulario del contrato no está en el glosario, y hay dos listas cerradas de las fuentes de un entitlement que no se contienen

**Qué se rompe.** `NUCLEO/01` abre declarando que fija **los nombres** y que *«todo lo que el resto
de la spec use tiene que estar acá»*. El documento que la FASE 9 volvió el eje del diseño —el
contrato— introdujo **cuatro vocabularios cerrados** y ninguno de los cuatro está en el glosario.
Peor: el glosario y el contrato tienen cada uno **su propia lista cerrada de de dónde viene un
entitlement**, con distinta cardinalidad y sin que una contenga a la otra. Ésa es la causa de que la
herencia de Turista VIP —que el núcleo enumera como fuente— no tenga `tipo`, y por lo tanto tampoco
clase, y por lo tanto no pueda entrar ni a `cubierto` ni a `fuentes`.

**El camino.**

1. Medido hoy sobre `NUCLEO/01`, `NUCLEO/03` y `NUCLEO/04`: `cubierto`, `TÍTULO`, `COMPLEMENTO`,
   `SIN_EMPEZAR`, `NO_VENCE`, `SIN_FECHA_CONOCIDA` y `alcance` aparecen **cero veces en los tres**.
   `BASE` como clase de fuente, cero. El núcleo entero menciona el contrato **una sola vez**, en
   `NUCLEO/00` línea 62, y sólo para decir que vive afuera.
2. `NUCLEO/01` §5, el mapa conceptual, enumera las fuentes de un entitlement efectivo: *«versión de
   plan + herencia Turista VIP + addons + cortesía + grant»* — **cinco**. `NUCLEO/01` §1.6 repite la
   misma lista para el término `Entitlement`.
3. `12-contrato-de-cobertura.md` §2.4 enumera **seis** `tipo`s como lista cerrada —`TRIAL`,
   `SUSCRIPCIÓN`, `CORTESÍA`, `GRANT`, `BASE`, `ADDON`— y declara *«**La clase se deriva del `tipo`**
   y no se transporta»*.
4. **Ninguna de las dos listas contiene a la otra.** El núcleo tiene *«herencia Turista VIP»* y
   *«versión de plan»*, que no son `tipo`s; el contrato tiene `TRIAL`, `SUSCRIPCIÓN` y `BASE`, que no
   están en el núcleo. La intersección efectiva son tres: cortesía, grant y addon.
5. La consecuencia ya está medida, desde el otro lado: la reejecución de `F-8A1-005` en `A1` registra
   que `F-8A1-009` *«llega en el paso 3 de su camino, y **empeoró**: §2.4 declara seis tipos como
   lista cerrada y «la clase se deriva del `tipo`», así que la herencia —que no tiene `tipo`— ahora
   tampoco tiene clase»*. La causa no es del capítulo 15: es que la lista cerrada se escribió en un
   documento que el glosario no conoce.
6. Y la misma falta de sede produce la colisión que `F-8bA2-011` reporta: **«vivo»** nombra los seis
   estados del candado en `B/02` §2.2 y las *«fuentes vivas»* del contrato §2.1. Dos conjuntos, una
   palabra, y el capítulo cuyo trabajo es impedir eso —`NUCLEO/01` §2.3, *«Un estado se llama igual
   en toda la spec … Si hiciera falta un mapa de traducción, es señal de que hay dos vocabularios»*—
   no tiene ninguna de las dos palabras.

**Dónde lo permite el diseño.**

`NUCLEO/01-glosario.md`, apertura: *«Este capítulo fija **los nombres**. Todo lo que el resto de la
spec use tiene que estar acá, y nada de lo que esté acá se redefine en otro capítulo.»*

`NUCLEO/00-indice.md`: *«**El núcleo es el único lugar donde algo se define.** Los capítulos de las
dos épicas describen comportamiento y **referencian** el núcleo; no redefinen una entidad, un estado
ni un invariante. Si una épica necesita algo que el núcleo no tiene, se agrega al núcleo — no se
declara localmente.»*

El contrato no es una épica, así que la regla no lo nombra — y es el único documento del programa
que define vocabulario cerrado fuera del núcleo. `DEC-ARCH-006` lo protege de que una épica lo mute
sola; nada dice qué pasa cuando el núcleo cambia debajo.

**Severidad.** `ALTA` — es la causa estructural de tres defectos ya reportados (`F-8A1-009` que
sigue llegando, `F-8bA2-011`, y la mitad de vocabulario de `F-8bA1-014`), y de que la frase del §2.5
del contrato —*«`Turista Free`, `Guest` y `TRIAL_EXPIRED` no tienen ninguna de las cuatro fuentes de
clase `TÍTULO`»*— se haya podido escribir sin que nada la contrastara contra `V/03` §2.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo.** Las tres clases (cambio 1), los cuatro
valores de `hasta` (cambio 3) y los cuatro de `alcance` son todos de la FASE 9, y los cuatro se
escribieron en el contrato. `NUCLEO/01` no se tocó desde el 2026-09-19 salvo por la precisión de
`F-8C1-011`, que es sobre el conteo de máquinas.

---

### F-8bC1-005 — «Las dos épicas no se referencian entre sí» es falso veinticinco veces, y la regla de vigilancia del contrato se dispara el día en que se escribe

**Qué se rompe.** La premisa sobre la que descansa todo el corte —que la única cosa que cruza la
frontera es el contrato— es refutable con un `rg`. Medido hoy: **veinticinco referencias cruzadas
explícitas** en el texto de las dos épicas, de las cuales **doce** son citas a capítulos concretos de
la otra épica y varias son delegaciones de comportamiento, no punteros de alcance. Más **dos claves
foráneas no anulables** que cruzan. El contrato no es *la* frontera: es una de al menos catorce.

**El camino.**

1. `NUCLEO/00-indice.md` lo declara sin condición: *«**Y las dos épicas no se referencian entre sí.**
   Lo único que cruza es el contrato de cobertura, que vive afuera de las dos justamente para que
   ninguna lo pueda mutar sola.»*
2. Medido: `V/` menciona *«épica de billing»* **10** veces; `B/` menciona *«épica de verticales»*
   **15**. De las 25, **12** son citas de sección a capítulos de la otra épica (`cap. 11`, `cap. 15`,
   `cap. 17`, `cap. 18` desde billing), repartidas en `B/12`, `B/14`, `B/16` y `B/19`.
3. Tres de esas doce no son punteros: son **delegaciones**.
   - `B/16` §4: *«**Eso es exactamente el reconciliador de excedentes del capítulo 15 (épica de
     verticales) §4**»* — el comportamiento de una operación de billing se define por un mecanismo de
     verticales.
   - `B/14` §2: *«**Ya está resuelto en el capítulo 11 (épica de verticales) §3**: las dos extienden,
     acumulan contra un único techo»* — la regla de un instrumento de billing vive en verticales.
   - `B/19` §4, filas 10 y 11: qué se le muestra al cliente al suspenderlo y al comprar Turista VIP
     suspendido sale de *«cap. 15 §6.3 (épica de verticales)»*.
4. Y dos dependencias estructurales, que `F-8bB3-008` ya nombró desde su lado: `addon_product.version_id`
   → `addon_version` es *«no anulable»* (`B/02` §2.4) y `billing_option` lleva
   `UNIQUE(plan_version_id, ciclo)` (`B/02` §2.1). Son claves foráneas de billing hacia tablas de
   verticales, no lecturas por contrato.
5. El detector que el diseño declara tiene umbral **uno**: `12-contrato…` §4.2 — *«si aparece un
   **quinto lugar** que necesita algo de billing y no es este hecho, es señal de que el corte se está
   filtrando»*, y en la otra dirección *«**Una lectura no declarada es un acoplamiento que nadie está
   mirando.**»* Medido hoy, la regla está en doce, no en uno.
6. `PB2` lo muestra en una sola fila: `V/03` §9 enumera sus causas como *«trial vencido (T3),
   suspensión (S6) **(épica de billing)**, cancelación consumada (S12) **(épica de billing)**, o
   excedente tras un downgrade **(épica de billing)**»* — tres de las cuatro causas de una transición
   de verticales son transiciones de billing nombradas por su id, que es precisamente lo que el
   contrato existe para no tener que hacer (el evento que cruza es *«la cobertura cambió»*, no `S6`).

**Dónde lo permite el diseño.** `NUCLEO/00-indice.md`, sección *«Cómo se relacionan las tres
partes»*; `12-contrato-de-cobertura.md` §3, §4 y §4.2; `V/03-maquinas-de-estado.md` §9, `PB2`;
`B/16-addons.md` §4; `B/14-promos-cortesias-y-grants.md` §2; `B/19-superficies.md` §4;
`B/02-modelo-de-datos.md` §2.1 y §2.4.

**Severidad.** `ALTA` — no falla en ejecución. Falla la premisa de `DEC-ARCH-005` y `DEC-ARCH-006`,
que es de donde sale la autorización para escribir dos épicas que no se leen — y que es exactamente
el permiso bajo el cual se produjeron `F-8bA2-004` (una lista congelada en `V/03` que `B/03` dejó
corta), `F-8bB3-004` y la mitad de `F-8bA3-005`. Es la condición de posibilidad de los defectos de
costura, no uno más de ellos.

**¿Es nuevo, o es el arreglo?** **Mitad y mitad.** Las referencias cruzadas son del desarme del
2026-09-18. Lo que la FASE 9 agregó es el §4.1 y su regla de vigilancia, que **declaran enumerado**
el acoplamiento: antes era invisible, ahora hay un documento que afirma haberlo contado y que cuenta
seis campos contra veinticinco referencias y dos claves foráneas.

---

### F-8bC1-006 — Los dieciséis guards viven en dos inventarios de dos épicas que no se leen, con la numeración partida, y el núcleo —que declara el nivel «guard»— no tiene ninguno

**Qué se rompe.** `NUCLEO/04` §1 declara **guard** uno de los cuatro niveles donde se hace cumplir un
invariante, y §2.3 apoya cinco invariantes del §64 y tres de las decisiones en ese nivel. **El núcleo
no tiene capítulo de guards y no puede listar ninguno.** Los dieciséis existentes están repartidos en
dos inventarios de dos épicas que tienen prohibido referenciarse, sobre **una sola serie numérica**
partida de forma que ninguno de los dos es contiguo. La pregunta que `NUCLEO/04` existe para poder
hacer —*«¿están todos?»*— no se puede hacer sobre la mitad de sus propios niveles.

**El camino.**

1. Medido hoy: `V/20` §2 lista **diez** — `G1`, `G2`, `G3`, `G4`, `G5`, `G6`, `G8`, `G-R3`,
   `G-R3-B`, `G-R3-C`. `B/20` §2 lista **seis** — `G7`, `G9`, `G10`, `G11`, `G-R1-A`, `G-R1-B`.
   Total **16**.
2. La serie `G1`…`G11` es **una sola** y está partida por épica: verticales tiene el hueco en el 7,
   billing en el 8. Ninguno de los dos capítulos puede explicar su propio hueco, porque ninguno puede
   citar al otro. Los cinco restantes (`G-R1-*`, `G-R3-*`) no continúan ninguna serie.
3. `HOS-1353/spec.md` dice **«siete guards»** dos veces (§ del índice de capítulos y §5). Era cierto
   para `G1`…`G6` + `G8`; `V/20` §2 hoy lista diez. Tres cardinalidades vivas, que es lo que `A1`
   anotó *«fuera de mi vector»* para verticales; medido sobre el programa entero, son cuatro.
4. **Un invariante del núcleo sostenido por dos guards de dos épicas.** `NUCLEO/04` §2.3 pone los
   invariantes 15 y 16 —*«toda configuración comercial viene de la base»*— en el nivel guard, con la
   glosa *«el catálogo de claves es código verificado contra la base en las dos direcciones»*. Eso es
   `G3` (`V/20`: *«una clave usada en código no existe en la base, o una de la base no existe en el
   catálogo»*) **y** `G7` (`B/20`: *«un valor comercial vive en código»*). Los dos capítulos de
   testing lo ignoran mutuamente; el núcleo cita a ninguno de los dos por su nombre.
5. Lo mismo con `D9`, `D10` y `D12`, que `NUCLEO/04` §3 declara sostenidos por guard: son `G9`, `G10`
   y `G11`, los tres de billing, los tres sin que el núcleo los nombre.
6. Consecuencia operativa, ya visible: `F-8bA1-006`, `F-8bA2-005` y `F-8bB1-009` reportan tres guards
   nuevos que **no se pueden ejecutar donde el diseño los puso**. Ninguno de los tres se detecta desde
   un inventario, porque no hay inventario: se detectan leyendo un capítulo de testing a la vez.

**Dónde lo permite el diseño.** `NUCLEO/04-invariantes.md` §1 (el nivel guard y la regla *«base antes
que servicio, servicio antes que guard»*), §2.3 y §3. `V/20-testing.md` §2. `B/20-testing.md` §2.
`HOS-1353/spec.md`. `DEC-METH-005` — *«Los guards nuevos salen de lo que la épica pide»*, que es
exactamente la regla que produce dos inventarios y ningún tercero.

**Severidad.** `ALTA` — el nivel guard sostiene ocho invariantes del núcleo y no tiene ningún lugar
donde se lo pueda contar, en un programa cuya regla de método es *«los conteos se cuentan, no se
estiman»* y cuyo capítulo de invariantes se justifica por *«poder preguntar **una vez** si están
todos»*.

**¿Es nuevo, o es el arreglo?** **Lo agrandó el arreglo.** El desarme dejó dos `20-testing.md`; la
FASE 9 agregó cinco guards (cambio 22) repartidos entre los dos sin tocar ningún inventario común, y
el conteo de `HOS-1353/spec.md` quedó tres atrás.

---

### F-8bC1-007 — `NUCLEO`: `D7` declara sostén «servicio» y no hay ninguno, y la regla 1 del núcleo choca de frente con `B/03` §10.1 sobre el mismo acto

**Qué se rompe.** Dos defectos del núcleo que `B2` marcó `NUCLEO` y que adopto porque se resuelven
juntos: el invariante más caro del cambio de plan declara un sostén que no existe, y la regla que
decide qué pasa mientras no exista dice lo contrario de lo que dice el capítulo que la ejecuta.

**El camino, mitad 1 — `D7` sin sede.**

1. `NUCLEO/04-invariantes.md` §3: *«| `D7` | **La suscripción vieja se cancela sólo al recibir el
   webhook de que la nueva quedó autorizada** | `DEC-SUB-006` | **servicio**; al revés, el cliente que
   abandona el checkout se queda sin nada |»*.
2. `NUCLEO/04` §1 define ese nivel: *«**servicio** | hay **un** lugar en el dominio que lo evalúa»*.
   La celda de `D7` **no nombra ningún lugar**: nombra el motivo por el que la regla es así.
3. Medido sobre `B/03-maquinas-de-estado.md` §3.2, las dieciséis transiciones `S1`…`S16`: **ninguna
   tiene como evento la autorización de una sucesora**. Desde `ACTIVE` salen `S4`, `S8`, `S9`, `S11`,
   `S13` y `S16`, y los seis eventos son otros. Es `F-8bB2-001`.
4. No hay restricción (`B/02` §5 no la lista) ni guard (`G-R1-A` y `G-R1-B` miran el nacimiento de la
   sucesora, no la muerte de la predecesora). `D7` no está sostenido en ningún nivel, y la columna
   afirma que sí.

**El camino, mitad 2 — regla 1 contra §10.1.**

5. `NUCLEO/03-maquinas-de-estado.md` §1, regla 1: *«La tabla de transiciones es exhaustiva. **Lo que
   no está, no pasa.** Un intento de transición que la tabla no declara **no se ejecuta** … pone la
   marca `requiere_conciliación` y emite el §22.1.»*
6. `B/03-maquinas-de-estado.md` §10.1: *«**Nunca se escribe el estado que trae el evento** … se
   **relee el recurso por su id** en el proveedor y **se escribe lo leído**, junto con la `version` de
   esa lectura.»*
7. **Gobiernan el mismo acto y dan resultados opuestos**: escribir un estado que la tabla no declara.
   `F-8bB2-005` mide que **seis de los ocho pares** (nuestro estado, lo leído) no tienen transición, y
   que la regla 1 los convierte en marca — con lo cual *«se escribe lo leído»* es inejecutable para
   seis octavos de su dominio.
8. Y la elección no es simétrica. El §64.18 —*«MP gobierna los hechos ocurridos en MP»*, que
   `NUCLEO/04` §2.4 declara *«su forma operable es la regla de no-retroceso del cap. 03 §10»*— dice
   que para un hecho del proveedor gana §10.1. La regla 1 está escrita para intentos que nacen de
   nuestro lado. **Que el núcleo no distinga las dos clases de intento es el defecto**; que billing
   tenga seis pares sin transición es otro, y es de billing.

**Dónde lo permite el diseño.** `NUCLEO/04-invariantes.md` §1 y §3 (`D7`, `D15`);
`NUCLEO/03-maquinas-de-estado.md` §1, reglas 1 y 5; `B/03-maquinas-de-estado.md` §3.2 y §10.1;
`B/02-modelo-de-datos.md` §5.

**Severidad.** `ALTA` — por sí mismo no cobra de más; es el andamiaje declarado de `F-8bB2-001`
(`CRITICA`, doble cobro en el camino normal) y de `F-8bB2-005` (`CRITICA`, servicio completo gratis
indefinido). Una columna que dice *«servicio»* sobre un invariante que nada ejecuta es peor que una
vacía, porque afirma que alguien lo cuida.

**¿Es nuevo, o es el arreglo?** **Las dos mitades son del arreglo.** `D7` es anterior, pero su sostén
sólo se volvió inexistente cuando `R1` creó el par de filas que hay que resolver sin agregar la
transición que las resuelve; y la regla 1 ganó su remedio —la marca— en el cambio 8, que es lo que
convirtió el choque con §10.1 de un silencio en una contradicción con desenlace.

---

## 2. Las contradicciones ENTRE los seis informes

Dos agentes que dicen cosas incompatibles sobre el mismo texto son el síntoma de que el corte se
filtró. Son siete, y cada una tiene consecuencia sobre qué va a hacer la FASE 9.

### C-01 — Tres informes escriben «cerró» sobre el texto donde un cuarto encuentra un `CRITICA`

- `A1` `F-8bA1-001` (`CRITICA`): *«un suspendido conserva lo que su addon otorga»*, porque el paso 6
  agrega **todas** las fuentes vivas y el addon lleva su `addon_version` con sus dos tablas.
- `A2` §3, ataque 9: *«**Mantener cubierto a un suspendido con su propio addon vivo.** Cerrado por
  `D-01` / `12-contrato…` §2.4 … La defensa es explícita y trae su propio contraejemplo escrito.»*
- `A3` §Ataques, 1: *«No, y está cerrado con su razón escrita … **Es de lo mejor resuelto del
  material.**»*
- `B3` §3, ataque 5: *«probé el camino inverso —que el addon cubra—, que es `D-01` y está
  explícitamente cerrado.»*

**Quién tiene razón**: los cuatro, sobre preguntas distintas. `cubierto` está cerrado; **otorgar** no.
`12-contrato…` §2.4 dice *«agrega capacidades **sobre un título**; nunca cobertura»* y *«sobre un
título»* no tiene mecanismo en ningún lado.

**Por qué importa**: la sección *«ataques que resistieron»* existe para que la FASE 9 no vuelva a
gastar ahí. Tres de seis informes la cierran. La causa del desajuste es `D-04`: los tres ataques
están formulados sobre `cubierto` porque ése **era** el sujeto del paso 5 antes de que `D-04` lo
cambiara, y ninguno reformuló la pregunta sobre el paso 6.

### C-02 — `A2` mide que la atomicidad de `PB1`+`T1` no se aplicó a ningún capítulo; `A3` construye dos hallazgos sobre esa atomicidad como hecho

- `A2` `F-8bA2-007`: *«`03-R3-resuelto.md` §1.3 paso 6 lo afirma —«`PB1` ejecuta, y **`T1` es su
  efecto**, en la misma transacción»— y **eso no se aplicó a ningún capítulo**: la fila de `PB1` en
  `V/03` §9 no menciona a `T1`, y la de `T1` no menciona a `PB1`.»*
- `A3` `F-8bA3-002`, paso 3: *«Publica. `PB1` ejecuta y **`T1` es su efecto, en la misma
  transacción**»*, citando el mismo informe de FASE 9.
- `A3` `F-8bA3-009`, paso 3: ídem, y su desenlace —*«Una colisión de hash **revierte la publicación
  entera**»*— **depende** de que la atomicidad exista.

**Verificado contra el texto**: `V/03` §9, fila `PB1`, y `V/03` §2, fila `T1`. Ninguna nombra a la
otra. **`A2` tiene razón sobre el capítulo y `A3` razona sobre un informe de resolución.**

**Por qué importa**: `F-8bA3-009` es `ALTA` bajo la rama *«revierte todo»*. Sin atomicidad, la rama
real es la de `F-8bA2-007` —ficha publicada, sin trial, sin nada que la baje— que es estrictamente
peor. La FASE 9 no puede resolver `F-8bA3-009` sin resolver primero `F-8bA2-007`, y los dos informes
no lo dicen.

### C-03 — El segundo trial: `A2` y `B3` lo declaran cerrado por los dos lados; `A3` mide una puerta abierta que regala trials

- `A2` §3, ataque 1: *«Cortado en la base por la `UNIQUE(hash_del_correo_normalizado, vertical)`
  nueva … **Lo que queda es el modo de falla, no el segundo trial.**»*
- `B3` §3, ataque 6: *«**Cerrado por los dos lados.**»*
- `A3` `F-8bA3-009`: *«**Y el cambio de correo no está resuelto en ninguna dirección.** Si el hash se
  actualiza al cambiar de correo, quien consumió su trial con el correo X, se mudó a Y y vuelve con X
  **recibe un trial nuevo**, que es la puerta exacta que la restricción vino a tapar.»*

**Quién tiene razón**: `A3`. `V/02` §2.2 declara la restricción y no dice qué le pasa al hash cuando
la persona cambia de correo, y las dos ramas están sin escribir. Dos de seis informes dan por cerrado
un ataque que un tercero mide abierto.

### C-04 — La severidad del trinquete del grant se bajó de `CRITICA` con un argumento que un tercer informe refuta

- `A1` `F-8bA1-005` (`ALTA`): *«**No es `CRITICA` porque falla hacia dar de menos, no hacia dar de
  más.**»*
- `A3` `F-8bA3-007` (`ALTA`): mismo razonamiento.
- `B3` `F-8bB3-005` (`ALTA`) agrega la rama que los otros dos no vieron: *«billing emite el piso como
  una segunda fuente `GRANT` … Dos fuentes con el mismo plan detrás **duplican fotos, fichas y
  destaques**. Es un fail-open, y la dirección cara: **no falla ruidosamente, regala.**»*

**Por qué importa**: la rama que `A1` descarta *por definición* es la que `B3` mide *disponible*. Las
tres severidades se fijaron cada una sobre medio dominio. El dominio entero es *«o incumple una
promesa comercial en silencio, o regala el doble de los limits acumulables»*, y ninguno de los tres
lo evaluó así.

### C-05 — `B3` baja a `ALTA` un defecto que su propio paso 5 describe como doble cobro

- `B3` `F-8bB3-003`: *«**Severidad.** `ALTA` — no es `CRITICA` por el criterio declarado: **nadie
  paga de más por esto sin elegirlo**.»*
- El paso 5 del mismo hallazgo: *«la sucesora tiene `sucede_a` no nulo, así que `A` está libre y **el
  `INSERT` entra**. El resultado es peor que el bloqueo: **dos compromisos principales vivos con dos
  preapprovals autorizados**.»*
- `B1` `F-8bB1-001` (`CRITICA`) describe el mismo `INSERT`: *«Es el doble cobro literal.»*

**Por qué importa**: es `F-8bC1-002`. Compuesto con el bloqueo del candado `B` y con el bloqueo
temporal de `CANCEL_SCHEDULED`, *«sin elegirlo»* deja de ser cierto: el cliente elige entre la única
puerta abierta y no cambiar de plan.

### C-06 — Tres cardinalidades para lo que le falta a la lista de siete invalidaciones

- `A1` `F-8bA1-010`: **dos** (la versión de piso y la de pre-trial).
- `A2` `F-8bA2-010`: **tres** (las dos anteriores más el grant anclado al plan).
- `A3` `F-8bA3-004`: **cuatro** (las tres anteriores más `addon_version`), y agrega las **tres
  columnas de `vertical`** como quinta familia.

**Quién tiene razón**: `A3`, y la diferencia no es cosmética: `V/15` §4.2 dice *«**es la misma lista**
que invalida el caché … **Una lista, dos consumidores**»*, así que el número que se use al corregir
decide cuántos disparos le faltan **también** al reconciliador de excedentes. Corregir con el número
de `A1` deja tres agujeros en los dos consumidores.

### C-07 — `A1` y `A2` leen el mismo guard nuevo (`G-R3-C`) encontrando dos defectos distintos, y ninguno menciona al otro

- `A1` `F-8bA1-009`: el guard **cuantifica sobre el conjunto que tiene que cerrar** — recorre las
  operaciones *declaradas* de dominio, así que la que no se declara no está en el dominio del guard.
- `A2` §4, ítem 4: el predicado **no dice nada sobre el valor declarado**, así que *«la exención por
  ruta que todo el capítulo 17 existe para impedir pasa a ser una casilla obligatoria en vez de algo
  prohibido»*.

No es una contradicción: son **dos agujeros independientes del mismo guard**, y cerrar uno no cierra
el otro. Lo anoto acá porque los dos informes lo presentan como *«el»* defecto de `G-R3-C`, y la
FASE 9 va a corregir el que lea primero.

---

## 3. Las convergencias: un defecto, varios vectores

Los seis son ciegos entre sí, así que un mismo defecto aparece hasta tres veces con tres IDs. Acá va
cada uno **una sola vez, con su causa**. Ninguna de estas doce es un hallazgo nuevo mío.

| # | el defecto, una vez | llegan por | la causa, una vez |
|---|---|---|---|
| **V-01** | `PRE_TRIAL` es fuente de clase `TÍTULO`, así que `cubierto` es verdadero para casi toda la plataforma y en Partner para siempre | `F-8bA2-001`, `F-8bA3-001` | `R3` volvió viva la fuente del trial antes de empezar y `R2` definió `cubierto` sobre la clase; cada uno es correcto solo. Mi `F-8bC1-001` agrega que eso desarma las tres defensas del §6 |
| **V-02** | Quien se suscribe antes de publicar queda con un trial en `TRIAL_ACTIVE` sin salida alcanzable, y su título no vence nunca | `F-8bA2-002`, `F-8bA3-002` | `T1` perdió su condición vieja y no ganó ninguna sobre la suscripción; `T2` espera un evento ya ocurrido y `T3` exige que no haya suscripción |
| **V-03** | Nadie limpia `sucede_a`: el candado `A` queda vacío y el `B` consumido | `F-8bB1-001`, `F-8bB2-002`, `F-8bB3-003` | La sucesión se diseñó como una **ventana** y la columna se quedó como un **estado permanente**. Compuesto en `F-8bC1-002` |
| **V-04** | El trinquete del grant necesita dos referencias y el contrato transporta una | `F-8bA1-005`, `F-8bA3-007`, `F-8bB3-005` | `D-05` copió el mecanismo del trinquete del trial **y no su domicilio**: el piso del trial vive en `trial`, tabla de verticales, y nunca cruza; el del grant vive en `permanent_grant`, tabla de billing, y tiene que cruzar por un campo único |
| **V-05** | El mapa estado→fuente no tiene capítulo dueño | `F-8bA2-011`, `F-8bB1-006`, `F-8bB3-004`, y la reejecución de `F-8B2-012` en `B2` | `NUCLEO/01` §2.2 posee los nueve estados; `12-contrato…` §2.4 posee los seis `tipo`s; el §4 del contrato prohíbe que el estado cruce, así que **sólo billing puede escribirlo**; ninguna sección de billing lo escribe; y `DEC-ARCH-006` impide que verticales lo agregue. Medido: de los nueve estados de Suscripción, el contrato §2.6 responde por **`ACTIVE`** y **`CANCEL_SCHEDULED`**, y `B/02` §2.4 por `PAUSED` vía el motivo. Quedan **seis sin respuesta declarada** |
| **V-06** | La lista de siete invalidaciones quedó corta | `F-8bA1-010`, `F-8bA2-010`, `F-8bA3-004` | Su única entrada de catálogo cuantifica sobre *«planes **al que hay suscripciones ancladas**»*, y los cuatro anclajes que la FASE 9 creó —`BASE`, `PRE_TRIAL`, el grant al plan, `addon_version`— **no son suscripciones**. Ver `C-06` para la cardinalidad |
| **V-07** | La dirección inversa dice seis campos y la firma enumera siete | `F-8bA1-012`, `F-8bA3-012`, `F-8bB3-008` | La prosa fundió `vigente`/`vendible` en un campo y la regla de vigilancia del §4.2 se enunció sobre el número, no sobre la firma. `B3` agrega lo que falta de verdad: el delta de entitlements, el `rank` y `versiónVigenteDe(plan)` |
| **V-08** | La clase de actor «disparada por el reloj» no tiene dónde declararse | `F-8bA1-006`, `F-8bA1-007`, `F-8bA1-008`, `F-8bA2-005`, `F-8bA2-006` | `V/17` §3.4 creó una clase que *«se declara transición por transición, nunca se infiere»* sobre tablas de cinco columnas, ninguna de clase. Cinco hallazgos de dos agentes, una línea de causa |
| **V-09** | La marca `requiere_conciliación` apaga el barrido, congela la salida del cliente y no tiene plazo | `F-8bB1-005`, `F-8bB2-007`, `F-8bB3-001` | El cambio 14 de `R1` compró silencio con el **único** mecanismo de vigilancia, apoyado en la premisa *«hay una persona mirándola»* que nada sostiene: lo único que se emite es el correo del §22.1 |
| **V-10** | La condición de `S16` es histórica por `user + vertical` y el hecho del proveedor es por preapproval | `F-8bB1-007`, `F-8bB2-003`, `F-8bB3-004` | La condición se copió de `B/12` §4.3, escrita para un **alta**, donde *«por `user + vertical`»* es la lectura correcta; sobre una sucesión y sobre un cliente que vuelve, excluye justo el caso en que el hecho ocurre |
| **V-11** | *«En el mismo acto del upgrade»* no nombra un instante | `F-8bB1-010`, `F-8bB2-009` | El upgrade no es un acto: es una ventana de 72 h con dos instantes, y el re-apunte es seguro en uno solo |
| **V-12** | La *«ventana reducida»* del §5.4 es un mecanismo y se declaró *«un número, no un mecanismo»* | `F-8bB1-013`, `F-8bB2-013` | La duración de la ventana es la condición de `S3` y vive en las opciones **globales** de billing; una ventana por fila exige columna y exige que la limpieza la lea |

### 3.1 La deduplicación del conteo de críticos

`DEC-METH-006` hace depender el cierre del ciclo del número de `CRITICA` nuevos, y las instrucciones
son explícitas: *«inflarlo hace otra vuelta entera de trabajo»*. Los seis informes suman **25**
(`A1` 3, `A2` 3, `A3` 5, `B1` 7, `B2` 5, `B3` 2). Cinco pares son **el mismo defecto contado dos
veces**:

| par | por qué es uno solo |
|---|---|
| `F-8bA2-001` ≡ `F-8bA3-001` | `V-01`: la misma fuente, la misma clase, el mismo desenlace |
| `F-8bA2-002` ≡ `F-8bA3-002` | `V-02`: el mismo trial colgado, las mismas dos salidas cerradas |
| `F-8bB1-005` ≡ `F-8bB3-001` | `V-09`: las dos direcciones del mismo apagado del barrido — cobro divergente que sigue, servicio gratis que no cesa |
| `F-8bB1-007` ≡ `F-8bB2-003` | `V-10`: la misma condición histórica de `S16`, dos consecuencias |
| `F-8bB1-001` ≡ `F-8bB2-002` | `V-03`: la misma columna sin limpiar; `F-8bC1-002` muestra que son un embudo, no dos caminos |

**Distintos: 20.** Más `F-8bC1-001`, que es nuevo y de esta pasada: **21**.

Y la conclusión que ese número obliga: **la pasada produjo `CRITICA` nuevos, así que `DEC-METH-006`
no cierra el ciclo.** No lo cierra ni siquiera con el conteo deduplicado, ni siquiera descontando los
cinco que `A` y `B` marcaron `NUCLEO` para que los adoptara esta pasada.

---

## 4. El núcleo y los invariantes

`docs/nucleo/` es de esta pasada. Los conteos se verificaron **con un script**, no a mano, tal como
lo pide el §6 de las instrucciones.

### F-8bC1-008 — `NUCLEO`: el §5 congeló **cuatro** números, no dos, y el §2.4 tiene un quinto — es la segunda vez consecutiva que esta tabla se corrige y queda mal

**Severidad.** `MEDIA`.

**Qué se rompe.** `NUCLEO/04` §5 es el resumen del reparto, y su columna derecha describe el estado
del §3 **anterior a la FASE 9**. `A2` (*«Fuera de mi vector»*, 1) y `B1` (`NUCLEO` 2) reportaron dos
celdas. Medidas las cinco, **son cuatro las que están mal, más una quinta en el §2.4**, y la que
ninguno vio es la que revela por qué: `D8` no se **agregó** al nivel base, se **mudó** desde
servicio, así que corregir sólo `base` y el `total` deja la tabla sumando peor que antes.

**La medición**, `grep '^| D[0-9]' nucleo/04-invariantes.md` sobre la tabla del §3:

| | el §5 dice | medido hoy | por qué |
|---|---|---|---|
| filas de la tabla del §3 | **14** | **15** | `D15` lo agregó el cambio 7 |
| nivel **base**, columna derecha | **2** | **4** | `D2`, `D3`, `D15` y **`D8`** |
| nivel **servicio**, columna derecha | **11** | **10** | `D8` **se fue** de acá: `D1`, `D3`, `D4`, `D5`, `D6`, `D7`, `D11`, `D12`, `D13`, `D14` |
| nivel **guard**, columna derecha | 3 | **3** ✔ | `D9`, `D10`, `D12` — la única que está bien |
| la nota de los apoyos | *«**16 apoyos** sobre **14** invariantes»* | **17 sobre 15** | `D3` y `D12` siguen con dos apoyos cada uno; 4 + 10 + 3 = 17 |
| el cierre del capítulo | *«**Cincuenta y un** invariantes, y **ocho** los sostiene la base»* | **52**, y **10** | 37 + 15 = 52; 6 + 4 = 10 |

La columna izquierda (los 37 del §64) **sí cierra**, recontada sección por sección: §2.1 seis filas,
§2.2 catorce, §2.3 cinco, §2.4 siete, §2.5 cinco. 6 + 14 + 5 + 7 + 5 = 37 ✔.

**Y el quinto número, que nadie reportó y está en otra sección.** `NUCLEO/04` §2.4 se titula *«Los que
son del programa, no del sistema **(7)**»*, tiene **siete filas**, dice dos líneas más abajo *«**las
siete** son obligaciones reales»*, y cierra: *«**Cinco de las 37** no se pueden comprobar ejecutando
nada.»* El §5 asigna **7** a esa categoría. Cinco contra siete, en un párrafo que se contradice a sí
mismo a dos oraciones de distancia.

**Dónde lo permite el diseño.** `NUCLEO/04-invariantes.md` §2.4, §3 y §5, y la nota al pie del §5:

> **Corregido el 2026-09-19 — FASE 8** (`F-8A1-016`, `F-8A3-016`, `F-8C1-012`). Estas dos frases
> decían **«suma 14 sobre 12»** y **«Cuarenta y nueve»** … **dirimió la aritmética del documento, no
> la mayoría**.

**Es la segunda vez, y es la misma forma.** Aquella corrección tocó exactamente las dos frases que le
señalaron y no recontó la tabla; ésta tiene que tocar cinco celdas y una sección distinta. La lección
está en el propio pie: *«dirimió la aritmética del documento»*. Lo que falta es que la aritmética se
**corra**, no que se argumente.

**¿Es nuevo, o es el arreglo?** Lo introdujo el arreglo: `D15` (cambio 7) y la subida de `D8` a base
(cambio 10) son los dos de la FASE 9, y ninguno de los dos volvió al §5. El desajuste del §2.4 es
anterior y nunca se reportó.

---

### F-8bC1-009 — `NUCLEO`: `00-indice.md` dice «51 invariantes» dos veces, y una de ellas es la frase que justifica poder contarlos

**Severidad.** `MEDIA`.

**Qué se rompe.** Los dos informes que tocaron el conteo abrieron `04` y ninguno abrió `00`. El
índice del núcleo carga el número **dos veces**, y la primera está dentro del argumento de por qué el
núcleo no se parte:

> `NUCLEO/00-indice.md`: *«un glosario en dos mitades deja de ser un glosario, y **51 invariantes**
> numerados de corrido pierden lo único que los hace útiles, que es poder preguntar **una vez** si
> están todos.»*

Y en el mismo lugar:
> *«| `04` | [invariantes](./04-invariantes.md) | **los 51**, con quién sostiene cada uno |»*

Son **52** (§F-8bC1-008). El documento que argumenta que hay que poder preguntar una vez si están
todos es el que responde mal esa pregunta, en las dos veces que la responde.

**Dónde lo permite el diseño.** `NUCLEO/00-indice.md`, sección *«Las tres partes»* y la tabla del
núcleo.

**¿Es nuevo, o es el arreglo?** Es el arreglo: `D15` lo desactualizó el 2026-09-19, igual que al §5
del `04`, y el `00` no se tocó desde el 2026-09-18 — su `updated` lo dice.

---

### F-8bC1-010 — `NUCLEO`: el método de conteo de decisiones que `00-indice.md` declara reproducible no produce su propio número, y hay tres cardinalidades vivas

**Severidad.** `MEDIA`.

**Qué se rompe.** Las decisiones registradas son **la fuente de diseño número 2 de las tres** que el
núcleo admite (`NUCLEO/00`, *«De dónde sale cada afirmación»*), y su cardinalidad es lo único que
permite preguntar si alguna quedó sin leer. El núcleo declara el método exacto con el que la contó y
**el método no da su número**.

**La medición.**

1. `NUCLEO/00-indice.md`: *«**una decisión registrada** en `01-decision-log.md` — son **54** al
   2026-09-19, recontadas con `rg -c "^### DEC-"` menos la plantilla del formato, y las `SUPERSEDED`
   no cuentan»*.
2. Ejecutado hoy sobre `01-decision-log.md`: `grep -c '^### DEC-'` da **61**. Menos la plantilla
   (`### DEC-<AREA>-<NNN> — <título>`, línea 26) da **60**. Menos las `SUPERSEDED` —que el propio
   resumen del log enumera como **3**: `DEC-SUB-001`, `DEC-SUB-005` y `DEC-MIG-001` en parte— da
   **57**. No 54.
3. El resumen del propio `01-decision-log.md` dice *«| Decisiones tomadas | **60** |»* y *«|
   `SUPERSEDED` | **3** |»*, con la misma glosa metodológica: *«Recontadas el 2026-09-16 leyendo los
   encabezados, no a mano: la tabla venía arrastrando **un error de uno** desde antes de esta
   sesión.»*
4. Y `NUCLEO/04` §3 abre con un tercero: *«El §64 se escribió antes de **las 45 decisiones**.»*

**Tres cardinalidades vivas** —45, 54 y 60— para el mismo conjunto, y la única que declara su método
es la que no lo cumple. El log agrega que la FASE 9 sumó seis (`DEC-GRANT-005`, `DEC-CONC-003`,
`DEC-SUB-011`, `DEC-MIG-003`, `DEC-METH-006`, `DEC-METH-007`) más `DEC-METH-007`, y ninguno de los
dos números del núcleo se movió.

**Dónde lo permite el diseño.** `NUCLEO/00-indice.md`, *«De dónde sale cada afirmación»*, punto 2;
`NUCLEO/04-invariantes.md` §3; `01-decision-log.md`, §Resumen (sólo lectura, no lo edito).

**¿Es nuevo, o es el arreglo?** Es el arreglo en el sentido estricto: las seis decisiones de la
FASE 9 desactualizaron los dos números del núcleo el mismo día en que se escribieron.

---

### BAJA

### F-8bC1-011 — `NUCLEO`: `02-modelo-de-datos.md` conserva la numeración del documento del que se lo cortó, y su única sección de contenido es un `### 2.6` sin `## 2`

**Qué se rompe.** Nada en ejecución. Pero el capítulo 02 del núcleo tiene `## 1` con `§1.1`, `§1.2` y
`§1.3`, y a continuación **`### 2.6 Registro`** — sin `## 2`, sin `§2.1` a `§2.5`. Es el residuo del
desarme del 2026-09-18: las secciones que se fueron a las épicas se llevaron sus números y las que
quedaron conservaron los suyos. Cualquier cita a *«`NUCLEO/02` §2.x»* es hoy indistinguible de una
cita rota, y ya hay dos consumidores que citan esa sección por número: `F-8B3-019` y `F-8bB3-012`
—*«`nucleo/02` §2.6 sigue sin `ocurrencia`»*—, y `V/02` §3.2, que `F-8A3-017` mide justificando una
entrada con *«son fuentes independientes (§2.4)»* donde `V/02` no tiene §2.4 y la frase vive en
`B/02` §2.4.

Es el mismo residuo que `A1` anotó para `V/19` §4 (*«sigue numerada `1, 2, 4, 8, 9`»*) y que `A3`
reportó como `F-8A3-017`, del lado del núcleo, que es el único que no tiene dueño en las dos épicas.

**Dónde lo permite el diseño.** `NUCLEO/02-modelo-de-datos.md`, entre *«### 1.3 Lo que queda del lado
de la base, completo»* y *«### 2.6 Registro»*.

**Severidad.** `BAJA` — falta de precisión, y ninguna consecuencia salvo que las citas por número al
núcleo no se pueden verificar.

**¿Es nuevo, o es el arreglo?** Es anterior a la FASE 9, del desarme. Lo reporto porque el núcleo es
de esta pasada y nadie más lo puede reportar.

---

## Ataques que intenté y el diseño resistió

Los caminos de costura que probé y que cierran. Van con su sostén, porque es lo que permite no
volver a gastarlos.

1. **Que una épica pudiera mutar el contrato sola.** Cerrado por `DEC-ARCH-006` y por el domicilio:
   `12-contrato-de-cobertura.md` vive en `HOS-1352-…/docs/`, fuera de las dos. Intenté encontrar una
   copia del contrato dentro de alguna épica —que sería `F-1B-132` otra vez— y **no hay ninguna**: las
   dos lo citan por su path. La defensa estructural es real y está bien elegida.

2. **Que la referencia de una fuente pudiera llegar vacía.** Cerrado, y bien: *«Una fuente sin
   referencia resoluble no se puede expresar»* (§2.3), implementado como columnas no anulables en
   `permanent_grant` y `courtesy_grant` en vez de como una rama. Lo que **no** cierra es que *«la
   vigente siempre existe»* se apoye en una `UNIQUE` —que garantiza *«a lo sumo una»*—, y eso ya es
   `F-8bB3-006`.

3. **Que los valores de un plan cruzaran hacia billing por el contrato.** No cruzan: el §4 lo enumera
   en positivo y la dirección inversa transporta *«política y estado de catálogo, nunca
   capacidades»*. El corte de `DEC-ARCH-005` está bien trazado **en el contrato**. Lo que lo viola es
   `B/10` §3.5, que no pasa por el contrato — y ése es `F-8bA3-005` / `F-8bB3-008`, más las doce
   referencias cruzadas de `F-8bC1-005`.

4. **Hacer que un invariante del núcleo quedara sin sostén al partir el programa.** Recorrí los
   cincuenta y dos contra sus sedes declaradas. Los del §64 resisten: cada uno nombra un capítulo o
   una restricción que hoy existe. De los quince de decisiones, catorce nombran una sede localizable.
   El único que no es `D7` — y es `F-8bC1-007`.

5. **Que el desarme hubiera perdido un encabezado.** `NUCLEO/00` declara *«105 de 105 encabezados
   presentes en alguna mitad»*. No encontré ninguno huérfano: los siete capítulos partidos (`02`,
   `03`, `10`, `19`, `20`, `21`, `22`, y `02`/`03` en tres piezas por el núcleo) tienen las dos
   mitades escritas y con su frase de encabezado. Lo que falta no es un encabezado: es la numeración
   (`F-8bC1-011`) y la referencia cruzada (`F-8bC1-005`).

6. **Que las dos implementaciones del contrato pudieran divergir sin que nada lo notara.** La defensa
   §6.2 está bien concebida y su criterio —*«un caso que no puede fallar es un comentario con exit
   code 0»*— es el correcto. Lo que la vacía no es su diseño: es que su sujeto discriminante
   desapareció (`F-8bC1-001`).

7. **Que `cubierto` pudiera volverse verdadero para un `TRIAL_EXPIRED` por el título `BASE`.**
   Cerrado por tres lados independientes: `BASE` no es clase `TÍTULO` (§2.4), `PRE_TRIAL` no tiene
   transición de entrada (`V/03` §2), y la fila de `trial` es única de por vida. El §2.5 punto 1 lo
   dice y se verifica contra la definición del §2.4. **El agujero simétrico existe y es del otro
   extremo del ciclo** (`V-01`), no de éste.

8. **Que el vocabulario de estados tuviera dos nombres en dos capas.** `NUCLEO/01` §2.3 regla 1
   —*«Un estado se llama igual en toda la spec, en la base y en la API»*— se cumple: los nueve nombres
   de Suscripción son idénticos en `NUCLEO/01` §2.2, en `B/02` §2.2 y en `B/03` §3.1, incluido
   `CHARGE_DECLINED` que entró en la FASE 9. La colisión que sí hay es de la palabra **«vivo»**, que no
   es un estado sino un predicado, y eso es `F-8bA2-011` con la causa en `F-8bC1-004`.

9. **Que `RECONCILIATION_REQUIRED` hubiera sobrevivido como estado en algún lado.** El cambio 8 se
   aplicó completo: la palabra aparece en `NUCLEO/01` §2.2 **sólo para decir que no está en la
   lista**, y en ningún dominio de columna. Es de los cambios mejor ejecutados de la FASE 9. Lo que
   no se ejecutó es su contracara en verticales (`F-8bC1-003`).

10. **Que el §7 del PDR —«un único motor genérico»— hubiera quedado sin criterio verificable al
    partir el programa.** No: `NUCLEO/01` §4 conserva la lista cerrada de ocho ítems del Eje 2, su
    regla de crecimiento por decisión registrada, y su guard (`G1` en `V/20` §2). El criterio sigue
    entero y sigue siendo comprobable mecánicamente. Lo que no se puede contar es el conjunto de
    guards que lo incluye (`F-8bC1-006`).

11. **Que el `hasta` de una `ACTIVE` dejara cruzar la fecha de cobro.** Cerrado explícitamente y con
    su razón: *«El `hasta` de una suscripción `ACTIVE` es `SIN_FECHA_CONOCIDA`, nunca el fin del
    período»*, porque *«poner el fin del período ahí es precisamente cruzar la fecha de cobro»*. La
    regla anticipa la implementación obvia y la nombra. Es el mejor párrafo del §2.6.

---

## Fuera de mi vector

Lo que vi y le toca a `C2` o a la FASE 9.

- **`C2` (liberación y coexistencia).** `F-8bC1-005` mide doce citas cruzadas y dos claves foráneas
  entre las épicas. `DEC-ARCH-007` dice que las dos se liberan juntas, así que hoy el acoplamiento no
  bloquea nada — pero el **orden de merge** de las dos ramas sí depende de él, y ninguno de los dos
  `21-migracion.md` ni `16-fase-7-del-paraguas.md` lo declara. Si `B/16` §4 delega en `V/15` §4, la
  rama de billing no compila sin la de verticales, y el PR *«enorme»* de `DEC-ARCH-007` tiene un
  orden obligatorio que nadie escribió.

- **`C2`.** `F-8bB3-011` mide que el umbral que hace caducar *«no se migra»* se cruza solo el
  2026-09-26, dentro de una semana, y que el umbral que la FASE 9 declaró **el que manda** —*«si
  alguna fila ya cobró»*— no llegó a ningún capítulo. Es una fecha, no un hallazgo de costura, pero
  es la única cosa de todo el material que tiene vencimiento calendario.

- **FASE 9, y es una sola medición.** `F-8bB1-003` y `F-8bB2-010` convergen en que **qué hace el
  proveedor con una `start_date` ya vencida al momento de autorizar no tiene fila en la matriz**, y
  de eso depende si `D8` —la precondición de seguridad del mecanismo más caro del sistema— vale
  durante su ventana o sólo durante su primer día. Los dos informes la piden y los dos declaran que
  es una sonda de sandbox sin costo. Lo anoto acá porque es la **única medición nueva** que las dos
  pasadas de billing piden, y porque `NUCLEO/04` §3 apoya `D8` en un nivel (`base`) que esa medición
  puede volver inalcanzable.

- **FASE 9.** Las cinco marcas `NUCLEO` de `A` y `B` están adoptadas en este informe: la de `A2` y la
  de `B1` sobre los conteos → `F-8bC1-008`; la de `A2` sobre `UNIQUE(user_id, vertical)` vs. el hash
  → la anoto acá sin ID propio, porque es una celda del §2.1 de `NUCLEO/04` y de `V/02` §5 que hay que
  actualizar con la segunda restricción, no un defecto de razonamiento; la de `A3` sobre
  `RECONCILIATION_REQUIRED` → `F-8bC1-003`; las dos de `B2` (`D7` y el choque regla 1 / §10.1) →
  `F-8bC1-007`; la de `B3` sobre el nivel de `D8` → absorbida en `F-8bC1-008` y en `F-8bB1-002`, que
  ya la reporta con su camino.

- **`A2` / FASE 9.** `NUCLEO/07` §2 sigue con las dos frases enfrentadas (*«el reloj no entra en la
  clave»* contra *«La ocurrencia entonces incluye la fecha objetivo vigente»*). Es del núcleo y por lo
  tanto mío, pero **no lo cuento como hallazgo nuevo**: ya está registrado como `F-8A2-011` y `A2`
  mide que sigue llegando. Lo que esta pasada agrega es la sede: la contradicción se resuelve en
  `NUCLEO/07`, no en `V/11`, y `NUCLEO/02` §2.6 —que es donde vive la entidad `outbox`— sigue sin
  listar la columna `ocurrencia` sobre la que `NUCLEO/07` §2 declara una restricción de unicidad
  (`F-8B3-019`, que sigue llegando).

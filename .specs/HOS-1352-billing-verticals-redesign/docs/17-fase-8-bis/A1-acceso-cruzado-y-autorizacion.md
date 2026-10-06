---
title: "FASE 8-bis · A1 — acceso cruzado y autorización"
linear: HOS-1353
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 8
---

# FASE 8-bis · A1 — acceso cruzado y autorización

Segunda pasada adversarial sobre `HOS-1353`, con el mismo vector —**que una cuenta llegue a algo
que no le corresponde**: otra vertical, otro plan, otra ficha, otro sujeto— y sobre el texto que la
FASE 9 produjo.

**Catorce hallazgos nuevos. Tres `CRITICA`, siete `ALTA`, tres `MEDIA`, uno `BAJA`.**

La tesis que los ordena, y que es la respuesta a la pregunta que organiza la fase:

> **Los tres cambios que más tocaron este vector movieron el rechazo del paso 5 al paso 6, y el
> paso 6 no heredó las defensas que el 5 sostenía.** `cubierto` se apagó para el addon y el addon
> siguió otorgando; el paso 5 dejó de rechazar y la lectura dejó de pasar por la resolución; el
> grant ganó una referencia que vale para una sola vertical y su scope vale para varias.

Los tres `CRITICA` son uno de cada uno de esos tres cambios, y los tres los **introdujo el
arreglo**.

Los paths se abrevian como en el documento de dominios: `NUCLEO` es `HOS-1352-…/docs/nucleo/`, `V`
es `HOS-1353-verticales-capacidades-y-autorizacion/docs/`, `B` es
`HOS-1354-billing-cobro-y-proveedor/docs/`, y lo que no lleva prefijo es `HOS-1352-…/docs/`.

---

## CRITICAS

### F-8bA1-001 — `cubierto` se apagó para el addon; el paso 6 no, y un suspendido conserva lo que su addon otorga

**Qué se rompe.** Una persona deja de pagar, su suscripción queda `SUSPENDED`, el §21 la deja *«sin
entitlements comerciales»*, `PB2` le baja las fichas — **y las capacidades que compró con un addon
siguen encendidas**, porque el addon sigue siendo una fuente viva y el paso 6 agrega todas las
fuentes vivas. Es exactamente el desenlace que `D-01` existe para evitar, en el paso siguiente al
que `D-01` arregló.

**El camino.**

1. La persona tiene una suscripción de Alojamiento y compra un addon —*«+30 fotos»*, o un booleano
   de destaque—. `addon_instance` queda viva, con su `addon_version` anclada.
2. Deja de pagar. La suscripción cae en `SUSPENDED`. El addon **no se apaga**: `B/16` §4.2 dice que
   *«la suspensión y la pausa no dejan huérfano a nada»* y que su reloj *«no se congela»*
   (`DEC-ADDON-001`), citado textualmente por el contrato §2.4.
3. `cobertura(user, ALOJAMIENTO)` devuelve `cubierto: no` —correcto, `D-01`— y `fuentes` con **dos
   entradas**: la de clase `BASE` y la de clase `COMPLEMENTO` del addon. `fuentes` son *«**todas**
   las fuentes vivas, de las tres clases»* (§2.1).
4. Paso 5: **pasa**. Ya no pregunta por `cubierto`, pregunta si hay alguna fuente, y hay dos.
5. Paso 6: el conjunto efectivo se agrega sobre *«todas las fuentes vivas»* (`V/15` §2.2). La fuente
   `ADDON` lleva su `referencia` —una `addon_version`, no anulable (§2.3)— y esa versión tiene sus
   propias `addon_version_entitlement` y `addon_version_limit` (`V/02` §2.1). **El addon otorga.**
6. Paso 7: con estrategia `SUMA` el cupo del addon se suma a cero y queda el cupo del addon.
7. La persona opera con lo que el addon le da, en una vertical donde no tiene ningún título. Lo
   mismo vale para un `TRIAL_EXPIRED` y para un `Turista Free` con un addon `USER`/`GLOBAL`.

**Dónde lo permite el diseño.**

`12-contrato-de-cobertura.md` §2.4 declara la propiedad **y no la implementa en ningún lado**:

> | **`COMPLEMENTO`** | `ADDON` | **no** | agrega capacidades **sobre un título**; nunca cobertura |

*«Sobre un título»* es una condición sin mecanismo: nada en el paso 6 pregunta si queda un título.
Y el mismo §2.4 declara que el arreglo se detiene en `cubierto`:

> **`cubierto` se calcula sólo sobre las fuentes de clase `TÍTULO`.**

La única regla del diseño que alguna vez apaga un addon por falta de título es `V/11` §5.3, y cubre
**un solo caso**, no el de un suspendido ni el de un `TRIAL_EXPIRED`:

> **Un addon de scope `USER` o `GLOBAL` no aporta nada a una vertical cuyo único título es un
> trial.**

Una vertical donde el único título es un trial está cubierta; una donde **no hay ningún título** no
lo está. Y `V/15` §2.2 agrega sin condición:

> | **acumula** | `SUMA` | **suma todas las fuentes vivas** | fotos, fichas, destaques |

**Severidad.** `CRITICA` — acceso a capacidades pagas por alguien que dejó de pagar, sobre el
instrumento que `B/16` §2.4 declara explícitamente que **nunca fue un título**.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo, y hacen falta los dos.** `D-01` sacó al
addon de `cubierto`; con el paso 5 preguntando por `cubierto` —como preguntaba antes— el suspendido
se caía en el paso 5 y no llegaba nunca al 6. `D-04` cambió la pregunta del paso 5 a *«¿hay alguna
fuente?»* (`V/17` §1.2, precisión 5), y con eso el camino al paso 6 quedó abierto para exactamente
el sujeto que `D-01` venía a frenar. El fail-open no se cerró: **se mudó un paso más adelante.**

---

### F-8bA1-002 — El grant se ancla a UN plan y su scope son VARIAS verticales: la referencia de una alimenta a las otras

**Qué se rompe.** Un *Free Forever* con scope de dos verticales emite una fuente en cada una, y las
dos transportan la **misma** `versiónDePlan` — que pertenece a una sola vertical. El paso 6 de la
segunda vertical resuelve capacidades leyendo `plan_version_entitlement` de un plan de la primera.
Es una clave de una vertical alimentada desde otra: el §64.10 y la defensa estructural de `V/15`
§3.2, rotos por el camino que el diseño declara imposible.

**El camino.**

1. `SUPER_ADMIN` otorga un grant permanente con *«scope de verticales»* = {Alojamiento,
   Gastronomía}, que es la forma que el §35.1 le da.
2. Por `D-05`, el grant **se ancla a un plan** y resuelve su versión vigente. Se elige el Premium de
   **Alojamiento**, porque es el contenido que se quiere regalar.
3. `cobertura(user, GASTRONOMÍA)` devuelve, por el mapeo del contrato, una fuente
   `{ tipo: GRANT, alcance: VERTICAL, referencia: <plan_version de Alojamiento>, hasta: NO_VENCE }`.
4. Paso 5: pasa. Paso 6: resuelve el conjunto efectivo de `(user, GASTRONOMÍA)` leyendo las dos
   tablas de una versión de plan de Alojamiento.
5. La persona ejecuta en Gastronomía capacidades declaradas por un plan de Alojamiento — incluidas
   las que Gastronomía **no declara** y que por `V/18` §1.3 *«no existen para esa vertical»*.
6. Y el cupo: `plan_version_limit` de Alojamiento pasa a acotar fichas de Gastronomía.

**Dónde lo permite el diseño.**

`12-contrato-de-cobertura.md` §2.7 declara el abanico:

> | grant | *«scope de verticales»* (§35.1) | una fuente `VERTICAL` **por cada vertical de su
> scope** |

y §2.8 declara el ancla, en singular:

> **El grant se ancla al PLAN, no a una versión, y resuelve la versión vigente** … `UNIQUE(plan_id)
> WHERE vigente` garantiza que *«la vigente»* es unívoca y siempre existe

Un `plan` pertenece a **una** vertical, y la base lo impone: `V/02` §2.1,

> | **`plan`** | identidad y cosmética: **vertical**, slug, nombre … | `UNIQUE(vertical, slug)` |

Nada en §2.8 dice que un grant lleve un plan **por cada vertical de su scope**, y `NUCLEO/01` §1.5
lo sigue describiendo como una entidad sola: *«Grant permanente | Free Forever. Sólo `SUPER_ADMIN`
(§35). Se modela como entidad independiente, no como un plan.»*

Del otro lado, `V/15` §3.2 declara que esto no puede pasar:

> **Una clave de vertical no se puede leer desde otra vertical porque su resolución pide la
> vertical** … No hay un control que alguien pueda olvidar: hay una resolución que no se puede
> invocar sin el dato.

Y tiene razón sobre la **clave**; lo que el arreglo agregó es una **fuente** que entra por la puerta
correcta con contenido de otra vertical adentro. La resolución pidió Gastronomía y se la dieron.

**Severidad.** `CRITICA` — acceso indebido a capacidades y a cupos de una vertical no concedida,
sobre el instrumento más caro del sistema, y por la única grieta de una defensa que el diseño
declara sin grietas.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo.** Antes de `D-05` el grant no tenía
referencia —ése era `F-8A1-004`, con sus dos ramas malas—. `D-05` le dio una, y le dio **una sola**,
sin volver a leer el §2.7, que ya decía que la misma fuente se emite varias veces. Es literalmente
*«qué regla corregida en un capítulo contradice a otro que nadie volvió a leer»*: las dos reglas
están en el **mismo documento**, a cinco párrafos de distancia.

---

### F-8bA1-003 — El criterio del paso 5 saca a toda LECTURA de la única resolución de autorización, y con ella al paso 4

**Qué se rompe.** El criterio dice que una operación es de dominio si *«escribe estado del negocio y
es auditable»*, y que *«una lectura que no muta nada no lo es»*. Los nueve pasos vienen en bloque y
son *«la única»* resolución que existe. Entonces **ninguna lectura tiene autorización**: ni el paso
4 —existencia, estado y **dueño**—, ni el paso 3 —permiso—, ni el paso 2. Leer la ficha en borrador
de otra persona, su *Mi Cuenta*, o los datos que el §48 le muestra al admin, no atraviesa ningún
control declarado.

**El camino.**

1. Una persona pide el borrador `L-ajeno`, que no es suyo. Es una lectura: no muta nada.
2. Por el criterio del §3.5, **no es una operación de dominio**, así que no recorre los nueve pasos.
3. `V/17` §1.3 no deja una segunda puerta: la resolución de autorización *«es la única que las
   ejecuta»*, y los nueve van en orden y en bloque. No existe *«los pasos 1 a 4 para lecturas»*.
4. El paso 4 —el único lugar del diseño donde se pregunta **si el recurso es del sujeto**— no corre.
5. `V/19` §1 confirma que no hay nada más atrás: *«Todo lo que la UI esconde tiene que estar
   rechazado por la resolución de autorización del capítulo 17»*. Lo que la resolución no mira, no
   lo mira nadie.
6. El mismo camino vale para el admin del §48, que *«inspecciona usuarios, suscripciones, pagos,
   cortesías y grants **ajenos**»*: todas lecturas, ninguna operación de dominio, y por lo tanto el
   permiso propio que `V/17` §3.2 regla 1 exige para `actor ≠ sujeto` no tiene quién lo ejecute.
7. Y en el borde de abajo: si *«escribe estado del negocio»* no alcanza a un borrador, **crear y
   editar borradores tampoco pasa por el paso 4**, y `DEC-TRIAL-007` los promete ilimitados para
   todo el mundo en `PRE_TRIAL`.

**Dónde lo permite el diseño.**

`V/17` §3.5, punto 1, el criterio entero:

> 1. **El criterio**: una operación es de dominio —y por lo tanto recorre los nueve pasos— si
>    **escribe estado del negocio y es auditable**. Una lectura que no muta nada no lo es.

Contra `V/17` §1.2, que justifica el paso 4 con un caso que **sólo se manifiesta leyendo**:

> 1. **El paso 4 responde «no existe» a las tres cosas.** Un recurso ajeno, uno archivado y uno
>    inexistente son indistinguibles desde afuera. Contestar *«no es tuyo»* confirma que el
>    identificador existe

y contra §1.3:

> **No hay nueve verificaciones repartidas: hay una resolución de autorización que las ejecuta en
> orden, y es la única que las ejecuta.**

**Severidad.** `CRITICA` — acceso de lectura a recursos y a datos de otra persona, sin ningún
control declarado, en un diseño cuyo paso 4 existe justamente para que un recurso ajeno conteste lo
mismo que uno inexistente.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo.** El criterio es `D-23`, escrito en la
FASE 9 para justificar que *«las lecturas de Mi Cuenta no pasan por el paso 5»*. La necesidad era
real y la formulación es más ancha que la necesidad: para eximir del **paso 5** eximió de **la
operación de dominio**, y los nueve pasos no se pueden partir. Peor: es la misma salida que
`F-8A1-005` y `R3` §5 descartaron por escrito —*«marcar las rutas públicas como exentas de la
resolución»*—, ahora con forma de criterio en vez de forma de marca, y por lo tanto sin la marca que
un guard podría contar.

---

## ALTAS

### F-8bA1-004 — El §2.2 justifica la lista de fuentes con una regla que `BASE` vuelve siempre verdadera

**Qué se rompe.** El único párrafo que explica **para qué** el contrato devuelve una lista dice que
*«quitar una fuente no quita la cobertura si queda otra»*, y que el reconciliador necesita ver las
demás para no apagar de más. Con `BASE` presente siempre, *«queda otra»* es verdadero siempre. Un
reconciliador escrito contra ese párrafo **nunca apaga nada**, y el excedente que el capítulo 15 §4
existe para hacer cumplir no se hace cumplir nunca.

**El camino.**

1. Una persona en `SUSPENDED` pierde su única suscripción como fuente.
2. El aviso del §3 dispara el recálculo del `user + vertical`.
3. El reconciliador consulta `cobertura(user, vertical)`. `cubierto: no`, y `fuentes` con `BASE`
   adentro —y con el addon, por `F-8bA1-001`.
4. Aplica la regla del §2.2 tal como está escrita: quitar una fuente no quita la cobertura **si
   queda otra**, y queda otra. No apaga.
5. Las fichas que excedían el límite siguen publicadas, los cupos siguen en el valor alto, y el
   guard `G5` —*«ninguna fuente se apaga sin pasar por el reconciliador»*— **pasa**: la fuente pasó
   por el reconciliador, que decidió no hacer nada.

**Dónde lo permite el diseño.**

`12-contrato-de-cobertura.md` §2.2, sin tocar desde que existen las tres clases:

> Podría parecer que alcanza con `cubierto`. No alcanza, y el caso está en el diseño: **quitar una
> fuente no quita la cobertura si queda otra.** Un reconciliador que no vea las demás apaga
> capacidades que la persona sigue teniendo

y §2.1, que le asigna `fuentes` —las tres clases— al mismo consumidor:

> | **`fuentes`** | **todas** las fuentes vivas, de las tres clases, no la que manda | … y el
> reconciliador, que necesita saber si apagar una deja las otras |

Contra §2.5, que declara la consecuencia y no la persigue hasta acá:

> **`BASE` es la fuente que toda persona tiene en toda vertical por el solo hecho de existir en la
> plataforma.**

`V/15` §4.2 define el disparo sobre otra cosa —*«se dispara cuando el conjunto efectivo … se
recalcula, y actúa sólo si algo bajó»*—, así que el diseño tiene **dos** enunciados de qué lee el
reconciliador y el del contrato quedó fail-open.

**Severidad.** `ALTA` — capacidades y cupos que sobreviven a la pérdida del título, por un párrafo
que la corrección volvió falso y nadie releyó. No es `CRITICA` porque `V/15` §4.2 da la lectura
correcta y un implementador puede elegirla; el defecto es que el contrato de la frontera dice la
otra.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo.** El §2.2 era verdadero cuando todas las
fuentes eran títulos. `D-01` y `D-04` partieron las fuentes en tres clases y corrigieron `cubierto`
(§2.1, §2.4, §2.5) sin volver al §2.2, que razona sobre `fuentes`.

---

### F-8bA1-005 — El trinquete del grant necesita un dato que el contrato no transporta, así que no se puede calcular

**Qué se rompe.** `D-05` protege al beneficiario de un *Free Forever* con un trinquete: *«nunca
otorga menos de lo que otorgaba el día que se concedió»*. El piso de ese trinquete es un segundo
puntero —las versiones vigentes al firmar— y **el contrato transporta un solo campo de referencia**.
Verticales, que es quien calcula el trinquete, no recibe el dato. El trinquete no se aplica, y un
grant *«para siempre»* pierde lo que una versión nueva del plan le recorte.

**El camino.**

1. Se firma un *Free Forever* anclado al plan Premium de Alojamiento. El piso queda registrado del
   lado de billing, en `permanent_grant`.
2. Seis meses después se publica una versión nueva del Premium que reparte distinto y saca una
   clave.
3. `cobertura(user, ALOJAMIENTO)` devuelve `{ tipo: GRANT, referencia: <la vigente>, alcance,
   objetivo, hasta }`. Son los cinco campos del §2, y ninguno es el piso.
4. `V/15` §2.5 le pide a verticales comparar contra *«lo que ese plan otorgaba el día que se firmó
   el grant»*. Verticales no lo tiene y no hay campo por donde pedirlo.
5. Rama A: no compara, y el grant pierde la clave — el daño exacto que el trinquete se escribió para
   evitar. Rama B: alguien agrega un campo al contrato para pasar el piso, y eso es mutar la
   frontera desde una sola épica.

**Dónde lo permite el diseño.**

`12-contrato-de-cobertura.md` §2, la forma completa de una fuente:

```text
tipo · referencia · alcance · objetivo · hasta
```

y §4, que cierra la puerta a un segundo puntero de contenido:

> **No cruzan los valores de lo que otorga una fuente** — ni los del plan, ni los del addon, ni los
> de un grant. **Sólo la referencia.** Es el §2.3 extendido a las seis fuentes.

Contra `V/15` §2.5, que pone el cálculo del lado de verticales:

> Su piso es **lo que ese plan otorgaba el día que se firmó el grant**, guardado en la fila. Se
> compara igual que el del trial —al final, y sólo puede subir el resultado—

El precedente del trial funciona porque su piso vive en una tabla **de verticales**: `V/02` §2.2,
*«`trial` … referencia a las versiones vigentes al arrancar (el piso del trinquete)»*. El del grant
vive en una tabla de billing y tiene que cruzar. `D-05` copió el mecanismo y no el domicilio.

**Severidad.** `ALTA` — una promesa comercial declarada *«para siempre»* que el diseño no puede
cumplir, y cuyo arreglo obvio toca el documento que `DEC-ARCH-006` declara inmutable por una sola
épica. No es `CRITICA` porque falla hacia dar de menos, no hacia dar de más.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo.** El trinquete del grant es `D-05`; antes
no existía porque el grant no tenía a qué anclarse.

---

### F-8bA1-006 — La clase «disparada por el reloj» se declara transición por transición y ninguna tabla de transiciones tiene dónde declararla

**Qué se rompe.** `V/17` §3.4 crea una clase de operación cuya seguridad depende enteramente de un
guard, y la clase *«se declara transición por transición, nunca se infiere»*. **No existe el lugar
donde se declara.** Las tablas de transiciones de `V/03` §2, §9 y §11 tienen cinco columnas —desde,
evento, hacia, condición, efectos— y ninguna es la clase. Sin el dato, `G-R3-B` no tiene sobre qué
cuantificar: se aplica la defensa y no defiende, que es literalmente lo que `V/02` §2.1 dice de un
guard sin su columna.

**El camino.**

1. Se escribe `G-R3-B`: *«una transición disparada por el reloj otorga algo, en vez de quitar»*.
2. Para correr, el guard necesita el conjunto de transiciones de esa clase. Lo lee de… ningún lado.
3. La implementación obvia es inferirlo del evento —*«si el evento es una fecha, es del reloj»*—, y
   eso es exactamente lo que §3.4 prohíbe citándose a sí mismo: *«Dejarla inferida sería incumplir
   la regla con la que se la resuelve»*.
4. La otra implementación obvia es una lista en el código del guard, que es una segunda fuente del
   dato y queda desactualizada en la primera transición nueva.
5. En cualquiera de las dos, la propiedad que vuelve segura a la clase no se comprueba, y §3.4 ya
   dijo qué es la clase sin comprobación: *«una puerta abierta con un cartel que dice no pasar»*.

**Dónde lo permite el diseño.**

`V/17` §3.4:

> **La clase se declara transición por transición**, nunca se infiere … **Y lleva guard, que no es
> opcional**, porque es lo único que sostiene la propiedad que la vuelve segura

`V/20` §2 lo inscribe como si el dato existiera:

> | `G-R3-B` | una transición **disparada por el reloj** otorga algo, en vez de quitar | cap. 17 §3.4 |

Y `V/03` §2 es la tabla donde tendría que estar: `| # | desde | evento | hacia | condición |
efectos |`. Cinco columnas, ninguna de clase.

El diseño ya resolvió este mismo problema una vez y por eso se puede citar el criterio: `V/02` §2.1,
sobre `vertical.evento_de_activacion`,

> Sin ella el lado izquierdo del «si y sólo si» no se puede leer, y el guard **no verifica nada** —
> se aplicaría la defensa y no defendería, sin que nada lo avise.

**Severidad.** `ALTA` — deja sin efecto el único mecanismo que hace segura una clase de operación
que **saltea los pasos 5, 6 y 7 sobre el sujeto**. No es `CRITICA` porque por sí solo no abre un
acceso: lo abre la transición del reloj que algún día otorgue y que nadie vea.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo.** La clase, el guard y la obligación de
declarar son `D-19`, enteros de la FASE 9.

---

### F-8bA1-007 — Los pasos 5, 6 y 7 «sobre el actor» no tienen respuesta cuando el actor es el reloj: `BASE` es por persona

**Qué se rompe.** `V/17` §3.4 decide que cuando el actor es el reloj los tres pasos se resuelven
*«sobre la capacidad del ACTOR»*. El reloj no es una persona, no tiene `user`, y `cobertura(user,
vertical)` **no se puede invocar para él**: el título `BASE` es *«la fuente que toda **persona**
tiene … por el solo hecho de existir en la plataforma»*. La analogía con las doce acciones
administrativas se rompe justo en la pieza que la hacía funcionar: el admin tiene un permiso
declarado por acción; el reloj no tiene nada declarado.

**El camino.**

1. Llega la fecha de fin de un trial. El reloj dispara `T3`.
2. `T3` es una transición que escribe estado del negocio y es auditable, así que por el criterio del
   §3.5 **es una operación de dominio** y recorre los nueve pasos.
3. Paso 5 sobre el actor: ¿qué fuente tiene el reloj en Alojamiento? Ninguna, y no porque no le
   corresponda: porque la firma del contrato pide un `user` y el reloj no tiene uno.
4. Paso 6 sobre el actor: ¿qué conjunto efectivo? Se resuelve por `user + vertical` (`V/02` §3.1).
   Misma pared.
5. Paso 7 sobre el actor: ¿qué cupo?
6. Rama A: `T3` no se puede ejecutar y un trial no vence nunca — `PB2` no dispara y una ficha sin
   cobertura queda publicada para siempre. Rama B: el job resuelve por su cuenta que los tres pasos
   no aplican, que es la **alternativa que §3.4 descarta con nombre**: *«cada job inventando su
   propia respuesta al paso 5»*.

**Dónde lo permite el diseño.**

`V/17` §3.4:

> **Las transiciones disparadas por el reloj son una segunda clase de operación, evaluada por
> analogía con las doce acciones administrativas: los pasos 5, 6 y 7 se resuelven sobre la
> capacidad del ACTOR, no sobre la del sujeto.**

La analogía se apoya en §3.2, regla 1, que para el admin **sí** dice dónde vive la capacidad:

> **`actor ≠ sujeto` exige un permiso de esa acción concreta** … Las doce acciones del capítulo 08
> §3 llevan permiso propio, una por una.

Para el reloj no hay equivalente: `NUCLEO/08` §3 enumera doce acciones **de persona**, y §3.3 del
propio capítulo 17 le prohíbe al actor de sistema ejecutar cualquiera de ellas. Y el título que
hoy le da respuesta al paso 5 a todo el mundo está definido sobre personas —`12-contrato…` §2.5—,
así que el actor que el §3.4 manda evaluar es el único que no puede ser evaluado.

**Severidad.** `ALTA` — o una máquina de trial que no vence, o una exención por ruta por cada job,
sobre el paso del que ahora depende toda la defensa. No es `CRITICA` porque las dos ramas se
manifiestan como funcionalidad rota antes que como acceso, y la rama B se detecta al escribir el
segundo job.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo**, y por partida doble: la regla de
evaluar sobre el actor es `D-19`, y el hecho de que las personas sí tengan respuesta al paso 5 es
`D-04`. Antes de las dos, nadie decía que esos pasos corrieran para el reloj y nadie tenía
respuesta, así que el hueco era parejo; ahora es un hueco de uno solo, y se lee como si estuviera
resuelto.

---

### F-8bA1-008 — §3.4 resuelve el reloj y deja al webhook, que es el actor de sistema que SÍ otorga

**Qué se rompe.** §3.3 declara **un** actor de sistema con dos formas —*«los jobs y los webhooks»*—
y §3.4 resuelve sólo la mitad de los jobs disparados por el reloj. La otra mitad es la que importa
para la seguridad de la clase: las transiciones que dispara un webhook de billing **otorgan**
(`PB3` republica, `T5` restituye la publicación), así que la propiedad que `G-R3-B` vigila —*«una
transición de esta clase nunca otorga»*— **no se les puede extender**, y no hay ninguna otra regla
que diga cómo se evalúan sus pasos 5 a 7.

**El camino.**

1. Billing emite el aviso del §3 del contrato: *«la cobertura de (user, vertical) cambió»*.
2. Verticales recalcula y dispara `PB3`: `UNPUBLISHED_BY_BILLING` → `PUBLISHED`.
3. `PB3` escribe estado del negocio y es auditable: por el criterio del §3.5 es una operación de
   dominio y recorre los nueve pasos.
4. ¿Sobre quién se evalúan los pasos 5, 6 y 7? El actor es el sistema. §3.4 sólo habla del **reloj**;
   un webhook no es el reloj. No hay regla.
5. Si alguien lo clasifica en la clase del §3.4 para tener una regla, `G-R3-B` falla: `PB3`
   **otorga** — restituye una publicación.
6. Si no lo clasifica, los tres pasos se evalúan sobre el sujeto, y entonces `PB3` depende de que el
   sujeto ya tenga la cobertura recuperada en el momento exacto en que el aviso llega, que es la
   carrera que el propio §3 del contrato prohíbe resolver creyéndole al mensaje.

**Dónde lo permite el diseño.**

`V/17` §3.3 declara al actor sin partirlo:

> | **el sistema** | los jobs y **los webhooks** operan sin persona detrás. Llevan su propio
> identificador de actor y sus dos identificadores de correlación |

§3.4 sólo cubre una parte, y lo dice en su propio título: *«Cuando el actor es **el reloj**…»*, con
un único caso concreto, `T3`.

Y `V/03` §9 pone las transiciones que otorgan del lado del sistema:

> | PB3 | `UNPUBLISHED_BY_BILLING` | **se recupera la cobertura** | `PUBLISHED` | S5, S7, T5 |

**Severidad.** `ALTA` — el hueco que §3.4 vino a tapar sigue abierto para la mitad de los actores de
sistema, y es la mitad donde la propiedad que lo volvía seguro no se cumple.

**¿Es nuevo, o es el arreglo?** **Es un hueco que el arreglo dejó al cerrar su gemelo.** Antes de
`D-19` los dos casos estaban igual de abiertos; ahora uno está resuelto y el otro se lee como
resuelto por analogía — y la analogía es justamente la que no se puede hacer, porque la propiedad
del guard no vale del otro lado.

---

### F-8bA1-009 — `G-R3-C` cuantifica sobre el conjunto que tiene que cerrar, así que su mensaje afirma más que su predicado

**Qué se rompe.** El guard que vuelve segura la postergación de la enumeración está enunciado como
*«toda **operación de dominio** declara si pasa por el paso 5»*. Su dominio de cuantificación es el
conjunto de operaciones de dominio, que es exactamente lo que nadie sabe cuál es: si alguien escribe
una operación y no la declara operación de dominio, **no está en el conjunto que el guard recorre**
y el build pasa. La afirmación *«la enumeración queda completa por construcción»* es más fuerte que
lo que el predicado puede verificar.

**El camino.**

1. Dentro de ocho meses alguien agrega un endpoint que publica algo, o que mueve un estado.
2. No declara nada, porque para declarar hay que saber que la regla existe — que es precisamente el
   supuesto que el guard viene a eliminar.
3. `G-R3-C` recorre las operaciones **declaradas** como de dominio y no encuentra ninguna sin
   declarar su paso 5: todas las que mira lo declaran.
4. El build pasa. La operación nueva no recorre los nueve pasos, y nadie se entera — *«la fábrica de
   exenciones por ruta»*, que es el desenlace que el mismo párrafo dice haber conjurado.
5. La única implementación que cierra de verdad es otra: cuantificar sobre **todas** las piezas de
   superficie y exigir que cada una declare si es de dominio. El guard no está enunciado así.

**Dónde lo permite el diseño.**

`V/17` §3.5, punto 3 y su advertencia:

> 3. **Un guard que lo hace cumplir**: toda **operación de dominio** declara si pasa por el paso 5,
>    y **el build falla si alguna no lo declara**.
>
> ⚠️ … *«nadie puede afirmar que revisó todas»* se convierte en **«el build no pasa si hay una sin
> clasificar»**, y la enumeración queda **completa por construcción**.

Contra la regla que el propio capítulo de testing fija, `V/20` §2.1:

> el **texto con que falla no puede afirmar más de lo que el predicado verifica.** Un guard que dice
> *«ninguna operación cruza verticales»* y sólo mira una forma sintáctica está mintiendo con
> precisión, que es peor que no estar.

**Severidad.** `ALTA` — es lo único que `D-23` pone entre la postergación y la fábrica de exenciones,
y tal como está enunciado no lo impide. No es `CRITICA` porque la corrección es de enunciado y no
cambia ninguna decisión.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo.** El guard es `D-23`, y su motivo declarado
es hacer segura una postergación que la misma decisión creó.

---

### F-8bA1-010 — Las dos versiones no vendibles nuevas no tienen evento de invalidación: un recorte del piso no llega nunca

**Qué se rompe.** La versión de piso es fuente de **toda persona en toda vertical**, y la de
pre-trial lo es del estado más poblado del sistema. Las dos son nuevas, y la lista de invalidación
del caché —que `V/02` §3.2 declara *«el mecanismo»*, con el TTL como *«una red, nunca»*— **no tiene
una entrada que las alcance**. Corregir una siembra de más en el piso no invalida nada: el
entitlement que se acaba de sacar sigue otorgándose desde el caché, que es textualmente *«un error
de seguridad y no de rendimiento»*.

**El camino.**

1. Alguien siembra en la versión de piso de Alojamiento una clave que no debía. `G-R3` corre en CI y
   —supongamos el peor caso realista— el error entra por una migración de datos que el guard mira
   sobre el catálogo del árbol de fuentes, no sobre la fila de producción.
2. Toda la plataforma la recibe gratis, que es el punto único de falla que `V/02` §2.1 declara.
3. Se detecta. Se publica una versión nueva del plan de piso, sin la clave.
4. La lista de invalidación tiene siete entradas y la que se le parece es *«se publica una versión
   nueva de un plan **al que hay suscripciones ancladas**»*. **Al plan de piso no hay ninguna
   suscripción anclada**: no es vendible y nadie se suscribe a él; se llega por la fuente `BASE`,
   que no ancla nada.
5. Ninguna entrada invalida. Las entradas de caché vivas siguen devolviendo la clave.
6. El mismo camino vale para la versión de pre-trial, y ahí es peor: `PRE_TRIAL` **no tiene fila**
   (`V/03` §2), así que no hay ninguna *«transición de la máquina de trial»* que invalidar mientras
   la persona esté en ese estado.

**Dónde lo permite el diseño.**

`V/02` §3.2, la lista completa y su regla:

> **La invalidación es explícita, y el vencimiento por tiempo es una red, nunca el mecanismo.**

Y las dos últimas filas de su lista:

> | se publica una versión nueva de un plan **al que hay suscripciones ancladas** | cambia lo que esa
> versión otorga |
> | cambia un override del plan de trial | la derivación deja de dar lo mismo |

La lista fue mantenida para el plan de trial —tiene su propia fila— y no para las dos versiones que
la FASE 9 agregó. Y `V/02` §2.1 dice qué hay en juego:

> ⚠️ **Las dos versiones no vendibles son un punto único de falla** … Si alguien le siembra una clave
> comercial a la de piso o a la de pre-trial, **toda la plataforma la recibe gratis, para siempre**

**Severidad.** `ALTA` — un entitlement revocado que sigue vivo, sobre las dos fuentes de alcance más
ancho del sistema, por el mecanismo que el capítulo declara que es el único. No es `CRITICA` porque
no da acceso por sí mismo: prolonga indefinidamente uno que ya se dio.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo.** Las dos versiones son de la FASE 9
(`D-04` y `R3`), y la lista de invalidación es un consumidor que nadie volvió a leer.

---

## MEDIAS

### F-8bA1-011 — Nadie implementa la fuente `ADDON`: el §5.1 dice cuatro y el §5.2 agrega tres

**Qué se rompe.** Con seis tipos de fuente, las dos implementaciones del contrato cubren cinco. La
de arranque resuelve dos y niega cuatro; la real *«agrega las otras **tres**»* y nombra las tres que
no incluyen el addon. La fuente `ADDON` no tiene dueño declarado, y por el §6.1 una fuente no
implementada responde que no: el addon nunca otorga nada.

**El camino.**

1. `V4` construye la implementación de arranque: trial + `BASE`, y niega suscripción, cortesía,
   grant y addon (§5.1).
2. `B4` construye la real, siguiendo el §5.2 al pie: agrega suscripción, cortesía y grant.
3. Nadie agrega el addon. Por §6.1 sigue respondiendo que no.
4. Se vende un addon, se cobra, la instancia queda viva en `addon_instance`, y el contrato nunca la
   devuelve como fuente: el paso 6 no la ve.

**Dónde lo permite el diseño.**

`12-contrato-de-cobertura.md` §5.1:

> Resuelve honestamente las **dos** fuentes que ya viven del lado de verticales … y responde que no
> a **las cuatro de billing: suscripción, cortesía, grant y addon**.

§5.2, que no las recupera todas:

> Agrega **las otras tres fuentes** —suscripción, cortesía, grant— y **no toca nada de lo
> construido**

**Severidad.** `MEDIA` — falla en la dirección segura (el §6.1 niega), así que no es acceso indebido;
pero es un producto cobrado que no entrega, y la asimetría 4/3 se lee como un descuido de redacción
justo donde el §6.2 promete que *«un solo juego de casos corre contra las dos implementaciones»*.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo.** `ADDON` entró al contrato con `D-01` y
`D-10`; el §5.1 se actualizó a cuatro y el §5.2 quedó en tres.

---

### F-8bA1-012 — La dirección inversa declara siete campos y se cuenta como seis; la regla de vigilancia cuantifica sobre los seis

**Qué se rompe.** El §4.1 escribe dos firmas con **siete** nombres y su prosa dice *«son seis campos,
y el sexto es el que importa declarar»*. El §4.2 monta la regla de vigilancia sobre ese número:
*«algo que no está en los seis campos del §4.1»*. Quien la convierta en un inventario o en un guard
va a contar seis contra una lista de siete, y el campo que sobre —cualquiera de los dos que la prosa
fundió en uno— va a quedar del lado equivocado de la regla.

**El camino.**

1. `políticaDePlan` declara cinco: `díasDeGrace, díasDeTrial, permitePausa, vigente, vendible`.
2. `situaciónDeVertical` declara dos: `admiteAltas, finDeServicio`. Son siete.
3. La prosa cuenta seis porque toma `vigente`/`vendible` como *«el sexto»*: una sola cosa con dos
   nombres.
4. El documento de dominios enumera la misma dimensión con **cinco** (`D1`…`D5`,
   `00-dominios-de-los-racimos.md` §R2, dimensión D).
5. Tres cardinalidades vivas para el mismo conjunto, y la regla de vigilancia —que es el único
   detector declarado del acoplamiento inverso— se enuncia sobre una de ellas.

**Dónde lo permite el diseño.**

`12-contrato-de-cobertura.md` §4.1:

```text
políticaDePlan(versiónDePlan)  → { díasDeGrace, díasDeTrial, permitePausa, vigente, vendible }
situaciónDeVertical(vertical)  → { admiteAltas, finDeServicio }
```

> **Son seis campos, y el sexto es el que importa declarar.** `vigente`/`vendible` no estaba en la
> cuenta original

y §4.2:

> **Y en la otra dirección**: si billing necesita leer de verticales algo que no está en **los seis
> campos** del §4.1, vale lo mismo.

**Severidad.** `MEDIA` — no falla en ejecución; falla al construir el único detector del acoplamiento
que el corte en dos épicas existe para impedir, y es el tipo de número que termina en el mensaje de
un guard.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo.** La dirección inversa entera es `D-06`.

---

### F-8bA1-013 — Qué otorga la versión de pre-trial tiene tres declaraciones distintas, y `G-R3` verifica contra una cuarta

**Qué se rompe.** La versión de pre-trial es una de las dos fuentes que el diseño declara punto único
de falla, y **no hay un solo lugar que diga qué contiene**. `V/02` §2.1 dice *«exactamente tres
cosas»*; el recorrido de `R3` le agrega un limit medido que no está entre esas tres; y `G-R3` prohíbe
*«ningún entitlement medido»* en ella. Las tres afirmaciones no se pueden cumplir juntas, y la que se
va a aflojar es el guard, porque es la única que rompe el build.

**El camino.**

1. Alguien siembra la versión de pre-trial de Gastronomía.
2. Lee `V/02` §2.1: otorga *«exactamente tres cosas»* — borradores ilimitados, la capacidad de
   activación, y contratar una suscripción.
3. Corre `PB1` y el paso 7 pregunta por el cupo de fichas publicadas. Por `NUCLEO/04` §2.2 el §64.6
   exige *«máximo una ficha en trial»*, y `PB1` se autoriza **contra la fuente de pre-trial**, no
   contra la del plan de trial: la fila de `trial` todavía no existe. El limit tiene que estar en la
   versión de pre-trial, y no está entre las tres.
4. Lo agrega. Corre `G-R3`: *«ningún entitlement medido»*. El limit de fichas es medido. Falla.
5. Sale por lo barato: le agrega a `G-R3` una excepción. El guard que vigila el punto único de falla
   nace con una lista de excepciones.

**Dónde lo permite el diseño.**

`V/02` §2.1, la declaración cerrada:

> Otorga **exactamente tres cosas**: lo que `DEC-TRIAL-007` ya prometió —borradores ilimitados, **sin
> ninguna capacidad comercial**—, **la capacidad de activación de la vertical**, y la de contratar
> una suscripción.

El guard, en el mismo §2.1 y repetido en `V/20` §2:

> **`G-R3` — ninguna de las dos versiones no vendibles de una vertical otorga una clave de la clase
> comercial ni ningún entitlement medido**

Y el recorrido que la FASE 9 dio por bueno, `15-fase-9/03-R3-resuelto.md` §1.3, paso 5:

> | 5 | Paso 7: el limit de fichas publicadas **de la versión de pre-trial es 1** — es el §64.6,
> *«máximo una ficha en trial»* | `NUCLEO/04` §2.2, `DEC-TRIAL-001` |

**Severidad.** `MEDIA` — no abre un acceso por sí mismo; deja sin contenido acordado a la tabla que
el diseño llama punto único de falla, y empuja al guard que la vigila hacia la escape hatch.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo.** La versión de pre-trial, su lista de
tres, y `G-R3` son todos de `R3`/`D-04`.

---

## BAJA

### F-8bA1-014 — El paso 5 conserva un mensaje de rechazo que el mismo §1.2 declara inalcanzable

**Qué se rompe.** Nada en ejecución. Pero la fila 5 de la tabla del §1.2 sigue declarando *«si falla:
sin cobertura»*, y cinco párrafos abajo el mismo §1.2 dice que **el paso 5 ya no rechaza a nadie**.
Un mensaje de error para un rechazo imposible es lo que termina en el nombre de un test, en el texto
de un guard y en la cadena de i18n de una pantalla que nadie va a ver — y afirma un rechazo que el
predicado no puede producir, que es lo que `V/20` §2.1 prohíbe.

**Dónde lo permite el diseño.**

`V/17` §1.2, la tabla:

> | 5 | **título vivo** | ¿hay **al menos una fuente viva** para ese `user + vertical`? | sin
> cobertura |

y la precisión 5, inmediatamente debajo:

> **La consecuencia hay que decirla en voz alta: el paso 5 ya no rechaza a nadie, y toda la defensa
> se apoya en el paso 6.**

**Severidad.** `BAJA` — falta precisión, no falla. Se corrige poniendo `—` en la columna, que además
es lo que hace visible de un vistazo que el diseño ahora tiene **un** paso que puede rechazar por
cobertura y no dos.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo**, `D-04`.

---

## Los 16 hallazgos de la FASE 8, reejecutados sobre el texto nuevo

Esto **no cuenta como hallazgos nuevos**. Cada camino se volvió a correr paso por paso sobre el
texto de hoy.

| ID | título, en corto | ¿corta? | dónde |
|---|---|---|---|
| `F-8A1-001` | la vertical del recurso nunca se compara con la declarada | **NO** | llega entero. `V/17` §1.2 paso 4 sigue enumerando tres cosas y §2.2 sigue prohibiendo *«un valor que se deduzca del recurso»*. No pertenece a ningún racimo, así que la FASE 9 no lo miró |
| `F-8A1-002` | el paso 5 no tiene título para `PRE_TRIAL` | **SÍ** | corta en el paso 4 de su camino: el trial **es** fuente viva en `PRE_TRIAL` y apunta a la versión de pre-trial (`V/03` §2, `12-contrato…` §2.6) |
| `F-8A1-003` | una fuente `LISTING` se agrega en un conjunto por `user + vertical` | **SÍ** | corta en el paso 5 de su camino: el pliegue en dos tramos del contrato §2.7 deja el delta de `L1` fuera de una operación sobre `L4` |
| `F-8A1-004` | un grant cruza sin nada que diga qué otorga | **SÍ** | corta en el paso 4 de su camino: `D-05` le da plan + versión vigente + trinquete (§2.8). **Su sucesor es `F-8bA1-002`**, que es el mismo instrumento por el eje de la vertical |
| `F-8A1-005` | Guest y Turista Free sin título → exención por superficie | **MITAD** | corta en el paso 5 para `Turista Free` (título `BASE`, §2.5). **Sigue llegando en el paso 1 para el `Guest`** — es `RES-01`, y ver la nota de abajo |
| `F-8A1-006` | la cobertura del trial se lee del estado escrito, no del reloj | **NO** | llega en el paso 4 de su camino. `hasta` ganó cuatro valores (§2.6) y sigue asignado a *«los avisos con ventana»*, no a la decisión; `SIN_FECHA_CONOCIDA` para una `ACTIVE` confirma que verticales **no puede** contrastar |
| `F-8A1-007` | la invalidación del caché es el único mecanismo y sus dos fallas dan acceso vivo | **NO** | llega entero por los dos caminos. `V/02` §3.2 regla 2 está sin tocar y el aviso del §3 sigue sin mecanismo de entrega. **`F-8bA1-010` le agrega un tercer camino** |
| `F-8A1-008` | `PAUSED` sin respuesta, y una cortesía se ve igual que una pausa | **MITAD** | corta la mitad de la cortesía: ahora es un `tipo` propio con `referencia` propia (§2.1, §2.6), así que billing la distingue y el contrato la transporta. **Sigue llegando la mitad de la pausa pedida por el cliente**: si una `PAUSED` devuelve o no una fuente `SUSCRIPCIÓN` no está escrito |
| `F-8A1-009` | la herencia de Turista VIP es la única fuente cuyo destino es otra vertical | **NO** | llega en el paso 3 de su camino, y **empeoró**: §2.4 declara seis tipos como lista cerrada y *«la clase se deriva del `tipo`»*, así que la herencia —que no tiene `tipo`— ahora tampoco tiene clase, y no puede entrar ni a `cubierto` ni a `fuentes` |
| `F-8A1-010` | el estado del sujeto no lo verifica ningún paso | **NO** | llega en el paso 3 de su camino. §3.2 sigue asignando **5, 6 y 7** al sujeto y deja el paso 2 sin asignar; §3.4 agregó un tercer reparto y tampoco lo tocó |
| `F-8A1-011` | las cuatro reglas de `actor ≠ sujeto` no tienen ni un guard | **NO** | llega en el paso 4 de su camino. El catálogo de `V/20` §2 sumó `G-R3`, `G-R3-B` y `G-R3-C`; ninguno mira si una operación con `actor ≠ sujeto` registra auditoría ni si la clase *«capacidad del actor»* está en una lista cerrada |
| `F-8A1-012` | `G1` y `G2` usan el mismo verbo con sentidos opuestos | **NO** | llega entero: la tabla de `V/17` §2.3 está sin tocar |
| `F-8A1-013` | la regla *«no vincula nada»* la incumple su propia tabla | **NO** | llega entero: `V/18` no se modificó en esta tanda (`updated: 2026-09-17`) |
| `F-8A1-014` | la espera tras un rechazo se ancla en la identidad que el postulante elige | **NO** | ídem |
| `F-8A1-015` | una `APROBADA` sin reclamar es un portador permanente | **NO** | ídem |
| `F-8A1-016` | *«nueve pasos»* se enumera como siete | **NO** | llega. §1.1 sigue diciendo *«nueve pasos y una precondición»*, la tabla de §1.2 sigue teniendo siete filas, y `HOS-1353/spec.md` §3.6 sigue titulando *«Nueve pasos»* sobre siete. Lo único corregido es el conteo de las precisiones, que pasó de tres a cinco |

**Tres cortan enteros** (`002`, `003`, `004`), **dos cortan a la mitad** (`005`, `008`) y **once
siguen llegando**.

### Sobre `RES-01` — profundización, no hallazgo nuevo

`08-residuos-del-paso-1.md` deja para esta pasada qué rechaza al `Guest` si el paso 1 lo admite, y
manda recorrer juntos los pasos 1, 2 y 3. Recorridos:

- **Paso 1** lo rechaza hoy: su falla declarada es *«no autenticado»* y un `Guest` no lo está, contra
  el §3.3 que lo declara *«un actor del modelo, no la falta de uno»*.
- **Paso 2** lo rechazaría si pasara el 1: pregunta *«¿esta cuenta puede operar hoy?»* con *«correo
  sin verificar»* entre sus fallas, y un `Guest` no tiene correo.
- **Paso 3** también: pregunta por un permiso, y `V/15` §5.2 le da booleanos de lectura pública, no
  permisos.
- **Y el paso 5 ya no lo rechazaría**, porque `BASE` es *«de toda persona»* — aunque un visitante sin
  cuenta no es una persona del modelo de datos y no tiene `user` con el que invocar la firma.

**El residuo que esta pasada agrega es que `D-23` lo resuelve sin querer, y por la puerta prohibida**:
por el criterio del §3.5 la lectura pública no es una operación de dominio, así que el `Guest` nunca
entra a la resolución y los pasos 1, 2 y 3 no lo rechazan porque no corren. Eso destraba la lectura
pública **y es la exención por superficie que `F-8A1-005` y `R3` §5 descartaron por escrito**, con
forma de criterio en vez de forma de marca. Es el mismo defecto que `F-8bA1-003` reporta desde el
otro lado; `RES-01` se cierra o no según cómo se corrija aquél, no por separado.

---

## Ataques que intenté y el diseño resistió

Vale tanto como la lista de arriba: son los caminos que probé sobre el texto nuevo y que cierran.

- **Publicar apoyándose en el título `BASE`, sin consumir trial.** Cierra en el paso 6: la versión de
  piso otorga *«ninguna capacidad comercial, y la de contratar una suscripción»* (`V/02` §2.1), y
  `G-R3` lo vigila **sobre las dos** versiones no vendibles. La defensa se mudó de paso y no se
  perdió.
- **El ataque que el §2.2 previó al revés: declarar Gastronomía teniendo Gastronomía para operar en
  Gastronomía.** Sigue cerrado, y ahora el capítulo dice **dónde** —*«se le contesta en el paso 6»*—
  en vez de apoyarse en un paso 5 que ya no rechaza. El argumento se rehizo, no se dejó caducar.
- **Revivir un trial vencido por la puerta que `BASE` abrió.** Cierra por tres lados a la vez:
  `BASE` no es clase `TÍTULO` así que `cubierto` sigue en falso (§2.4), `PRE_TRIAL` no tiene
  transición de entrada (`V/03` §2), y la fila de `trial` es única de por vida. `PB2` sigue
  disparando.
- **Un segundo trial re-registrándose con el mismo correo.** Cerrado por
  `UNIQUE(hash_del_correo_normalizado, vertical)` (`V/02` §2.2), y declarado **condición de
  aplicación** —no tarea suelta— justo porque `T1` recién ahora dispara de verdad.
- **Usar el addon `LISTING` de una ficha en otra ficha del mismo dueño.** Cerrado por el pliegue en
  dos tramos (§2.7), y cerrado bien: sin meter la ficha en la clave del caché y sin crear un segundo
  lugar donde se resuelven capacidades. `F-8A1-003` corta acá.
- **Confundir `SIN_EMPEZAR` con `NO_VENCE` para darle cobertura perpetua a alguien en `PRE_TRIAL`.**
  Cerrado por `D-20`, y con la dirección del error escrita en el propio §2.6: *«no falla
  ruidosamente, regala»*.
- **Publicar en Partner estando en `PRE_TRIAL`.** Cerrado en el paso 6 por dato y no por rama: sin
  evento declarado y con días en cero, su versión de pre-trial no lleva la capacidad de activación, y
  el «si y sólo si» va con guard en las dos direcciones.
- **Expresar una fuente sin referencia para que el paso 6 falle abierto.** Cerrado
  estructuralmente: *«Una fuente sin referencia resoluble no se puede expresar»* (§2.3). No hay rama
  A ni rama B, hay una fila que no se puede escribir.
- **Que un job otorgue una cortesía o un grant.** Sigue cerrado por §3.3 contra `D11`, y `D-19` no lo
  aflojó: la clase del reloj *«nunca otorga»*.
- **Impersonar al cliente para lavar el rastro.** §3.2 regla 4, intacta.
- **Comprar un addon estando sólo en trial y usarlo en la vertical del trial.** Sigue cerrado por
  scope (`V/11` §5.2 y §5.3). Lo que **no** cierra es la vertical sin **ningún** título, y ése es
  `F-8bA1-001`.
- **Acumular roles hasta que el paso 3 deje de filtrar.** Sigue cerrado: el rol no equivale a acceso
  (§64.12, §64.13, `G6`), y `G4` sigue impidiendo que una transición escriba roles.

---

## Fuera de mi vector

Lo que vi y le toca a otro. No lo perseguí.

- **`NUCLEO`.** `NUCLEO/08` §3 enumera las **doce acciones administrativas** y la tabla tiene **doce
  filas**, pero `V/17` §3.2 regla 1 las describe como *«las doce acciones … llevan permiso propio, una
  por una»* mientras varias filas son **pares** (*«otorgar **o revocar** una cortesía»*, *«pausar **o
  reanudar**»*, *«aprobar **o rechazar**»*). Doce filas no son doce acciones si cuatro de ellas
  nombran dos, y el permiso *«de esa acción concreta»* de la regla 1 cuantifica sobre las acciones,
  no sobre las filas. Es de la pasada C.
- **Costura (`C1`).** El conteo de guards tiene **tres** cardinalidades vivas en el texto de hoy:
  `HOS-1353/spec.md` §5 dice *«siete guards»* y lista siete (`G1`…`G6`, `G8`); `V/20` §2 lista **diez**
  (esos siete más `G-R3`, `G-R3-B` y `G-R3-C`); y el documento de dominios contaba trece sumando los
  de las dos descomposiciones. `F-8C1-010` ya registraba el desajuste y la FASE 9 lo agrandó sin
  actualizar la spec.
- **Costura (`C1`).** `V/19` §2 sigue con la tabla reducida a una sola fila (Admin) y §4 sigue
  numerada `1, 2, 4, 8, 9`. Es el mismo residuo del desarme que `F-8A1`/FASE 8 mandó a `A3`, y sigue
  sin tocar: el capítulo se presenta como *«la lista de lo que hay que decirle a la gente»* y la lista
  está partida.
- **Máquinas y carreras (`A2`).** `T2` y `T5` disparan *«se autoriza una suscripción»*, que sigue
  siendo un hecho más específico que el único aviso que el contrato deja cruzar (*«la cobertura
  cambió»*). Con seis tipos de fuente el aviso ahora podría llevar el `tipo`, pero el §3 sigue
  diciendo sólo *«qué fuente cambió y en qué dirección»*.
- **Datos (`A3`).** `V/21` §2.1 decide que **no se migra ninguna fila**, y `V/02` §2.2 mantiene
  `UNIQUE(hash_del_correo_normalizado, vertical)` *«sin condición de estado»*. Las seis personas que
  el §2.3 dice que *«podrían repetir trial»* al no migrarse son, en el sistema nuevo, seis correos sin
  fila: correcto. Lo que no miré es si alguna de las dos `comp` del owner entra como grant con el
  mismo correo y colisiona con algo.

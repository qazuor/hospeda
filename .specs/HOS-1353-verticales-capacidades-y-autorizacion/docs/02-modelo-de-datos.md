---
title: Master Spec 02 — Modelo de datos
linear: HOS-1353
statusSource: linear
created: 2026-09-17
updated: 2026-09-20
status: CURRENT
fase: 2
capitulo: 2
cierra:
  - C-ARCH-01
  - S-ARCH-01
  - M-ARCH-02
  - M-DATA-01
---

# 02 · Modelo de datos

La mitad de verticales del capítulo 02 del programa. La otra mitad vive en la épica de billing; lo transversal, en el núcleo.

---

## 2. Las entidades

### 2.1 Catálogo comercial

**`billing_option` vive en la épica de billing. Acá quedan las otras cinco entidades del catálogo comercial.**

```text
vertical (catálogo, espejo del enum)
    │
    └──< plan ──< plan_version ──┬──< billing_option
                                 ├──< plan_version_entitlement
                                 └──< plan_version_limit

addon_version ──┬──< addon_version_entitlement
                └──< addon_version_limit
```

| entidad | qué guarda | restricciones |
|---|---|---|
| **`vertical`** | el espejo en base del enum de código, **su evento de activación**, **si admite altas** y **su fecha de fin de servicio** | el guard de §1.2 verifica las dos direcciones |
| **`plan`** | identidad y cosmética: vertical, slug, nombre, descripción, orden en la pricing. **Muta libremente** (`DEC-ARCH-001`) | `UNIQUE(vertical, slug)` |
| **`plan_version`** | lo que tiene efecto y por eso **es inmutable**: `rank`, si es vendible, días de grace, días de trial, si permite pausa, si hereda Turista VIP | **`UNIQUE(plan_id) WHERE vigente`** — cada plan tiene exactamente una versión vigente · **`UNIQUE(vertical, rank) WHERE vendible AND vigente`** — dos vendibles con el mismo rank es un estado inválido, no un empate a desempatar (`DEC-ARCH-002`) |
| **`plan_version_entitlement`** | qué clave otorga, y para las medidas **dos cuotas**: la del plan y la del trial (`DEC-ENT-001`) | `UNIQUE(plan_version_id, clave)`; la clave existe en el catálogo |
| **`plan_version_limit`** | qué clave limita y con qué valor | ídem |
| **`addon_version`** | **qué otorga un addon y con qué valores**: vigencia, tipo de scope. **Inmutable** | una instancia **ancla** su versión, igual que una suscripción ancla la suya |
| **`addon_version_entitlement`** | qué clave otorga el addon | `UNIQUE(addon_version_id, clave)`; la clave existe en el catálogo |
| **`addon_version_limit`** | qué clave limita y con qué valor | ídem |

**El catálogo de addons se parte por el mismo corte que el de planes, y por el mismo criterio.**
El §11.2 del programa ya lo enunció —*«**No es por entidad, es por campo**»*— y `addon_product`
había quedado entero del lado equivocado. Guardaba *«capability, precio, recurrencia, verticales
compatibles, duración, tipo de scope»*: **precio y recurrencia son dinero; capability, duración y
scope son capacidades.**

| mitad | qué guarda | lado |
|---|---|---|
| `addon_version` | qué otorga y con qué valores, vigencia, tipo de scope | **VERTICALES** |
| `addon_product` | precio, recurrencia, verticales compatibles | **BILLING** |

**Sin este corte, el «30» del PDR no tiene dónde vivir.** El ejemplo del §38 es concreto —*«plan 20
fotos + addon 30 = 50»*— y ningún lugar del modelo guardaba qué otorga un addon; el lado verticales
tendría que **preguntarle a billing qué otorga un addon**, que es el acoplamiento que el corte en
dos épicas venía a impedir.

**La versión es inmutable**, por `DEC-ARCH-001` tal cual: *«se versiona lo que tiene efecto»*.
Cambiar de 30 a 40 fotos tiene efecto sobre lo que el cliente puede hacer, así que crea versión.

**Y la instancia la ancla de verdad, que hasta ahora no podía.** *«La instancia ancla su versión»*
estaba escrito en las dos épicas y **ninguna tabla lo permitía**: el único camino a `addon_version`
era `addon_product.version_id`, que es del **producto**. Re-apuntarlo —que es cómo se publica una
versión nueva— **movía todas las instancias vivas a la vez**, así que quien compró *«+30 fotos»*
pasaba a tener lo que dijera la versión nueva, **sin comprar nada y sin que nadie se lo avisara**.
El anclaje vive en `addon_instance` (`B/02` §2.4), igual que la suscripción ancla la suya, y **la
referencia que el contrato transporta para una fuente `ADDON` es la de la INSTANCIA, nunca la del
producto**.

**Y los efectos son plurales y con valor, sin inventar una segunda forma de declarar capacidades**:
`addon_version_entitlement` y `addon_version_limit` son el espejo exacto de las dos tablas del
plan. El glosario decía *«**efectos**»* en plural y el modelo instanciaba `capability` en singular;
acá se cierra.

**Consecuencia útil**: partido así, **un addon puede otorgar sin que billing intervenga**, que es
lo que hace implementable que el addon sea un complemento que agrega capacidades y **nunca**
cobertura (`12-contrato-de-cobertura.md` §2.4).

**«Vendible» sin «vigente» no alcanza, y las dos restricciones van juntas.** Un plan tiene varias
versiones y sólo una es la actual; sin marcar cuál, una versión vieja sigue ocupando un `rank` que
el plan ya no usa y la pricing encuentra como comprable algo que se retiró. Las dos preguntas del
catálogo se separan así: **la pricing lee la versión vigente y sólo si es vendible; una suscripción
lee su versión anclada, vigente o no, vendible o no.** El capítulo 10 §2 lo desarrolla y §3 lo usa
para retirar un plan sin mecanismo nuevo.

**Las dos columnas de `vertical` no son de adorno: son la mitad declarada de la frontera.**
`admite_altas` y `fin_de_servicio` las **lee billing** (`B/10` §4.6) y hasta ahora no existían en
ninguna entidad. Son dos de los seis campos de la dirección inversa del contrato
(`12-contrato-de-cobertura.md` §4.1), que transporta **política y estado de catálogo, nunca
capacidades**.

**El plan de trial no es una entidad aparte.** Es un `plan` con su versión, marcado **no
vendible**, uno por vertical. Sus limits y entitlements **no se guardan**: se derivan en cada
resolución, del plan vendible de `rank` más alto y del más bajo, más los overrides declarados
(`DEC-TRIAL-001`) y el trinquete (`DEC-TRIAL-002`). El §10.3 es explícito en que no se copien.

**Con una excepción, y es la única: `hereda Turista VIP` se DECLARA en el plan de trial, no se
deriva.** Igual que `vendible`, es un valor escrito en su versión.

**Importa la dirección en la que falla si se derivara.** El plan premium hereda, así que derivar
esa columna como se derivan las demás **regala beneficios de Turista VIP a alguien que todavía no
pagó nada** — y `DEC-ENT-003` **además le bloquea la compra de VIP** mientras se los estamos dando
gratis. No sólo se regala: **se impide vender eso mismo** durante todo el trial. El fondo es que
los entitlements del trial se derivan porque **el objetivo es que la persona pruebe el producto**,
y VIP es otra cosa: un beneficio cruzado, de otra vertical, que se vende aparte. Derivarlo mete
**una decisión comercial adentro de una derivación técnica**, donde nadie la ve.

**Y el valor declarado es que NO lo hereda.** La razón que decide es la misma `DEC-ENT-003`:
regalarlo durante el trial **bloquea la venta de VIP justo en los días en que esa persona está más
interesada en la plataforma**, que es el peor momento posible para no poder venderle algo. La
segunda es que al terminar el trial habría que sacárselo, y eso no se percibe como *«se terminó la
prueba»* sino como **que le sacaron algo**: la relación de pago arrancaría con una pérdida en vez
de con una ganancia. El argumento en contra —mostrar el valor completo levanta la conversión— es
real y se contradice con el primero: **no sirve mostrarle el valor de algo que no se le puede
cobrar mientras se lo mostrás**. Es un valor declarado, no una derivación, así que cambiarlo el día
que se quiera probar lo contrario es **una línea**.

**El plan de pre-trial tampoco.** Es un `plan` con su versión, marcado **no vendible**, uno por
vertical, y es lo que la fuente de trial apunta mientras el trial está en `PRE_TRIAL`. A diferencia
del de trial, **sus entitlements y limits sí se guardan**: no hay de dónde derivarlos —no son los
del premium ni los del más bajo— y el §10.3 sólo prohíbe copiar **los del trial**. Otorga
exactamente tres cosas: lo que `DEC-TRIAL-007` ya prometió —borradores ilimitados, **sin ninguna
capacidad comercial**—, **la capacidad de activación de la vertical**, y la de contratar una
suscripción.

> **La capacidad de activación está en la versión de pre-trial de una vertical si y sólo si esa
> vertical declara evento de activación y su plan de trial tiene días > 0.**

Es la **mitad de catálogo** de la condición de `T1` —que `T6` comparte palabra por palabra
(`V/03` §2)— expresada **como dato en vez de como rama**, y un guard la verifica en las dos
direcciones — el mismo mecanismo con que el §1.2 verifica el espejo del enum de verticales. La
otra mitad de esas dos condiciones es del **sujeto** —`cubierto`, y es lo que las vuelve
disjuntas— y no puede vivir en el catálogo: se resuelve por persona y en el momento.
Partner, que hoy tiene el trial en cero (`DEC-TRIAL-003`) y **ningún evento declarado**
(`DEC-TRIAL-006`), no la lleva — y por lo tanto **ninguna de las tres transiciones que salen de
`PRE_TRIAL` dispara ahí hoy**, que es lo que impide quemarle el trial a alguien antes de que la
vertical lo ofrezca. **Son tres y no dos**: `T1` y `T6` esperan el evento de activación, que
Partner no declara, y `T7` espera **el encendido**, que todavía no ocurrió. El día que ocurra,
`T7` es justamente la que resuelve a quien ya ejerció el evento (`V/03` §2, cap. 11 §8) — así que
esta frase es verdadera **por la configuración de hoy**, no por una propiedad de Partner.

**Y esa condición necesita una columna que no existía**: `vertical.evento_de_activacion`. Sin
ella el lado izquierdo del «si y sólo si» no se puede leer, y el guard **no verifica nada** — se
aplicaría la defensa y no defendería, sin que nada lo avise. Va en `vertical` y no en una tabla de
configuración porque `vertical` es exactamente donde el diseño ya pone el espejo del enum, y hoy
**hay una sola cosa que configurar**; si mañana aparece la segunda, pasar de columna a tabla es
trivial.

**La asimetría entre los dos planes no vendibles es deliberada, y conviene que quede el porqué.**

| plan | sus limits y entitlements |
|---|---|
| **de trial** | **no se guardan: se derivan** |
| **de pre-trial** | **se guardan** |

El de trial **tiene de dónde derivarse** —el vendible de `rank` más alto y el más bajo, dos
extremos concretos—. El de pre-trial **no es ninguno de los dos**: es un conjunto mínimo propio,
lo justo para que alguien exista y llegue a publicar, y **no hay fórmula que lo produzca**. Queda
escrito porque es el tipo de diferencia que alguien unifica después sin entender para qué estaba:
dentro de seis meses alguien ve dos planes no vendibles de la misma vertical, uno que deriva y otro
que no, **lo toma por una inconsistencia** y los unifica — y al hacerlo, o el pre-trial pasa a
otorgar lo del premium, o el trial deja de derivarse.

**El plan de piso tampoco, y tiene el mismo tratamiento que el de pre-trial.** Es un `plan` con su
versión, marcado **no vendible**, **uno por vertical**, y es lo que la fuente `BASE` del contrato
apunta (`12-contrato-de-cobertura.md` §2.5) para toda persona en toda vertical. A diferencia del de
trial, **sus entitlements y limits sí se guardan**: no hay de dónde derivarlos —no son los del
premium ni los del más bajo— y el §10.3 sólo prohíbe copiar **los del trial**.

Otorga exactamente lo mínimo para que alguien exista en la plataforma, **pueda recuperar lo suyo**
y pueda volver a contratar. Son **tres** cosas y la lista es cerrada:

| # | qué otorga | para qué |
|---|---|---|
| 1 | **ninguna capacidad comercial** | es la mitad en negativo, y la vigila `G-R3` |
| 2 | **contratar una suscripción** | sin esto la *«recuperación posible»* del §21 no tiene por dónde ocurrir. **Que esté la vigila `G-R3`** |
| 3 | **recuperar lo suyo**: sobre una ficha **propia**, verla, exportarla y **reactivarla a borrador** (`PB8`, cap. 03 §9) | sin esto la mitad de la defensa del hard delete del día 180 es inejecutable — §4.2, regla 3. **Que esté la vigila `G-R3`** |

Es lo que le da respuesta al paso 5 a un `TRIAL_EXPIRED`, a un `Turista Free` y a un `Guest`.

**La tercera se agrega porque `PB8` la necesita y nadie más se la puede dar, y hay que decir de
dónde sale el agujero.** `PB8` es una operación de dominio: escribe estado del negocio y es
auditable, así que pasa por **los nueve pasos** (cap. 17 §3.5). El capítulo 17 se ocupó de su
**paso 4** —*«una ficha `ARCHIVED` acepta de su dueño verla, exportarla y reactivarla»*, §1.2
precisión 1— y **no del 6**, sobre un diseño que declara dos veces que *«el paso 5 ya no rechaza a
nadie y toda la defensa se apoya en el paso 6»* (cap. 17 §1.2 precisión 5, `12-contrato…` §2.5).
Y su población declarada es **la que no tiene ninguna fuente de clase `TÍTULO`**: *«el que quiere
su ficha de vuelta sin pagar todavía»* (cap. 03 §9). Su conjunto efectivo **es** esta versión, así
que si acá no está, el paso 6 la rechaza — y como el hecho 1 del reloj de inactividad es *«un acto
del dueño … reactivarla»* (cap. 01 §1.2, núcleo), esa persona no puede ejecutar **ninguno** de los
cuatro reinicios y el día 180 le borra el contenido. **Es exactamente el sujeto del borrado.**

**Y no toca `G-R3` por el lado que prohíbe, que es lo que hay que verificar antes de agregar nada
acá.** El guard falla si esta versión otorga *«una clave de la clase comercial o un entitlement
medido»* (cap. 20 §2). **Recuperar lo suyo no es ninguna de las dos**: no publica nada —`PB8` va a
`DRAFT`, y publicar sigue siendo `PB1`, que sí es comercial—, no cuenta contra ningún limit, y su
objeto es **una ficha que la persona ya tenía**, nunca una nueva. Es del mismo tipo que *«contratar
una suscripción»*: una capacidad de **recuperación**, que es literalmente para lo que esta versión
existe.

**Y por el lado que OTORGA sí lo toca, que es la pregunta que agregar esta fila obligaba a hacerse
y no se hizo.** *«¿Esto rompe el guard?»* y *«¿quién se entera si esto no está?»* son dos preguntas
distintas, y hasta esta pasada el guard sólo contestaba la primera: su enunciado era **negativo
entero** —*«ninguna … otorga»*— más un *«si y sólo si»* cuyo dominio es **una sola clave**, la de
activación. Las filas 2 y 3 de la tabla de arriba no nombraban ningún guard, así que **un catálogo
sembrado sin ellas pasaba en verde**. El desenlace está escrito dos párrafos más arriba para la fila
3 —*«esa persona no puede ejecutar **ninguno** de los cuatro reinicios y el día 180 le borra el
contenido»*— y en el `12-contrato…` §2.5 para la fila 2 —*«queda afuera para siempre»*—. Es el mismo
punto único de falla que el aviso de abajo declara, **leído en el sentido que nadie había escrito**:
ahí la plataforma entera recibe de más, acá la población que menos puede defenderse recibe de menos.

> ⚠️ **Las dos versiones no vendibles son un punto único de falla, y por eso llevan guard.** Si
> alguien le siembra una clave comercial a la de piso o a la de pre-trial, **toda la plataforma la
> recibe gratis, para siempre, sin consumir ningún trial**; y si alguien siembra la de piso **sin**
> lo que tiene que otorgar, la recuperación y el alta quedan inejecutables sin que nada lo señale.
> Las vigila el mismo guard, con **tres** mitades:
>
> **`G-R3` — (a)** ninguna de las dos versiones no vendibles de una vertical otorga una clave de la
> clase comercial ni ningún entitlement medido; **(b)** la versión de piso de cada vertical **otorga
> las dos claves de las filas 2 y 3** de la lista cerrada de arriba; **(c)** la capacidad de
> activación está en la de pre-trial **si y sólo si** la vertical declara evento y su plan de trial
> tiene días > 0.
>
> **El mensaje nombra la mitad que falló** —*«clave de más»*, *«clave de piso que falta»* o
> *«activación fuera del si y sólo si»*—, nunca uno solo para las tres: son tres arreglos distintos
> y un texto único afirmaría más de lo que el predicado verificó en esa corrida. Es la misma
> condición con la que `G-R6-B` vigila sus mitades (cap. 20 §2 y §2.1).
>
> Se comprueba sobre el catálogo, en CI. Cada mitad tiene su dominio y conviene no leerlos de más:
> *(a)* alcanza **las dos** versiones no vendibles; *(b)* alcanza **sólo la de piso**, porque es la
> única cuya lista de lo que otorga el corpus declara cerrada; *(c)* es un bicondicional sobre **una**
> clave. Es una verificación automática y no una revisión, porque es el único lugar donde un error
> de siembra no lo ve nadie.

### 2.2 Compromiso y ciclo de vida

| entidad | qué guarda | restricciones |
|---|---|---|
| **`trial`** | `user`, vertical, estado del cap. 03 §2, referencia al plan de trial, **referencia a las versiones vigentes al arrancar** (el piso del trinquete), inicio, fin y **el hash irreversible del correo normalizado** (§4.1) | **`UNIQUE(user_id, vertical)`** — sin condición de estado. Es el §10.1 y el §10.2: el trial es único **de por vida**, así que la fila sobrevive a todo y su sola existencia niega un trial nuevo |

**El piso del trinquete se guarda como referencia a versiones, nunca como copia de valores.** El
§10.3 prohíbe copiar a mano y una copia además queda desactualizada (`DEC-TRIAL-002`).

**Y el hash del correo normalizado lleva su propia restricción de unicidad**, aparte de la de
`(user_id, vertical)`:

> **`UNIQUE(hash_del_correo_normalizado, vertical)`**, sin condición de estado.

**Sin ella el §10.2 queda incumplido por la puerta exacta que `DEC-TRIAL-004` y el hash
construyeron para tapar.** Alguien se registra de nuevo con el mismo correo, obtiene un `user_id`
nuevo, entra en `PRE_TRIAL` y **publica**: trial gratis, las veces que quiera. La restricción de
`(user_id, vertical)` no lo ve, porque el `user_id` es otro.

**Es una condición de aplicación, no una tarea suelta.** Hasta ahora el segundo trial por
re-registro era teórico porque **nadie podía disparar `T1`**; en el momento en que `T1` dispara,
deja de serlo. Aplicar el arreglo del trial primero y la restricción después abre una ventana —de
días o semanas— en la que la puerta está abierta, y no hace falta mala fe para encontrarla: se
descubre sola.

### 2.5 Publicación

| entidad | qué guarda | restricciones |
|---|---|---|
| **`listing`** | vertical, **un solo `owner_user_id`** (§6), estado del cap. 03 §9, contenido, **`inactiva_desde`** | la FK al dueño no es anulable: una ficha sin dueño no es un estado válido. **`inactiva_desde` no es anulable**: una ficha nace con el instante de su creación, que es el hecho 1 |

**No hay multi-dueño y el modelo no lo deja expresar.** El §6 lo dice y la forma de cumplirlo es
una columna, no una tabla de relación con un chequeo de cardinalidad.

**`inactiva_desde` es dónde vive el reloj del §25, y sin ella el hard delete del día 180 no es
implementable.** La inactividad es un término del núcleo —cap. 01 §1.2— definida como *«el más
reciente de los cuatro hechos que la reinician»*, y **un «más reciente de cuatro» no se deriva de
ninguna máquina**: tres de los cuatro hechos no son transiciones de publicación y el cuarto es de
la otra épica. Lo que decide **la única operación irreversible sobre datos del cliente de todo el
programa** no puede ser un valor que nadie guarda.

**Se escribe en los cuatro hechos y en ninguna otra parte.** Cada uno de los cuatro del cap. 01
§1.2 le pone el instante en que ocurrió; nada más la toca. No es una columna denormalizada de algo
que esté en otro lado —es **la** fuente— y por eso no cae en la advertencia del cap. 03 §9 sobre
el origen de `PB4`/`PB5`, que sí está en el registro append-only y ahí la columna sería una
segunda fuente.

**Y que sea cerrada lo verifica un guard, `G-R6-B` (cap. 20 §2), no la memoria del que escribe.**
Quien agregue un escritor nuevo agrega su hecho a la lista del cap. 01 §1.2 **en el mismo acto**, o
el guard se pone en rojo. La lista **no** la vigila `G-R6`: ése cruza las columnas que una condición
**lee** contra las que alguna transición **escribe**, y de estos cuatro hechos **uno solo es una
transición**, así que queda verde por ése y no mira a los otros tres — está dicho en el cap. 20 §2 y
es el motivo entero de que exista `G-R6-B`.

**Y la leen cinco consumidores, y esta lista también es cerrada**: `PB4`
(día 90) y `PB5` (N meses) del cap. 03 §9, el día 180 del §4.1 de este capítulo, los **dos avisos
previos** de schedule del cap. 07 §6 (núcleo) y la fecha que el cap. 19 §4 fila 18 obliga a
imprimirle al cliente — que es **`inactiva_desde` + 180** y hasta esta pasada no tenía de dónde
salir. *(El quinto **es** el aviso al archivar, el que `DEC-DATA-002` agregó: los avisos de
retención son **tres** —`NUCLEO/07` §6— y acá entran **dos por el schedule y el tercero por la
superficie que imprime su fecha**, que es por qué el renglón dice «dos» sin contradecir al núcleo.
Este párrafo decía además que eran «los mismos cinco que el cap. 01 §1.2 enumera», y **ese § no los
enumera**: enumera los cuatro hechos que la escriben y nombra de paso a tres de estos cinco —`PB4`,
`PB5` y el día 180— al pedirles que relean antes de actuar.)*

**Y que esta mitad sea cerrada lo verifica el mismo guard que la otra, `G-R6-B` (cap. 20 §2), con
un mensaje propio.** Es la mitad que la cuarta enmienda de `DEC-TEST-001` le sumó, y la razón es
que **falla peor que la de escritores**: un escritor de más mueve el reloj, y **un lector que no
figura acá decide con él** — y el lector más caro de esta columna es el hard delete del §4.1. Quien
agregue una lectura de `inactiva_desde` agrega su fila **en el mismo acto**.

---

## 3. Caché e invalidación · cierra `M-ARCH-02`

El PDR no lo menciona, y es de las pocas cosas donde **un error es de seguridad y no de
rendimiento**: un entitlement que sigue vivo después de revocado es acceso indebido.

### 3.1 Qué se cachea

**El conjunto efectivo de entitlements y limits de un `user + vertical`.** Es lo caro: agregar
versión de plan, herencia de Turista VIP, addons, cortesía y grant, cada uno con su vigencia.
Nada más se cachea: ni el catálogo, ni los planes, ni el estado de una suscripción.

### 3.2 Se invalida por evento, no por tiempo

**La invalidación es explícita, y el vencimiento por tiempo es una red, nunca el mecanismo.** Un
TTL como defensa principal deja una ventana en la que un permiso revocado sigue funcionando, y
esa ventana es exactamente el error de seguridad que este punto viene a evitar.

Invalidan la entrada de un `user + vertical`:

| evento | por qué |
|---|---|
| cambio de plan o de ciclo | cambia la versión anclada |
| toda transición de la máquina de suscripción | `ACTIVE`, `SUSPENDED` y `PAUSED` otorgan cosas distintas |
| toda transición de la máquina de trial | ídem |
| se otorga o se revoca una cortesía o un grant, **o se le ancla una vertical nueva a un grant vivo** | son fuentes independientes (§2.4). **El anclaje es la tercera escritura que cambia la cobertura** (`12-contrato…` §2.8) e invalida **la entrada de esa vertical**, que es justo la que hasta ese instante no tenía fuente `GRANT` |
| se activa o vence un addon | ídem |
| se publica una versión nueva de un plan al que hay suscripciones ancladas | cambia lo que esa versión otorga |
| cambia un override del plan de trial | la derivación deja de dar lo mismo |
| **se publica una versión nueva de la de PISO o de la de PRE-TRIAL** | las otorga **todo el mundo**, y no cuelgan de ninguna suscripción: ninguna fila de arriba las alcanza |
| **se publica una versión nueva de un plan al que hay GRANTS anclados** | un grant lee **la versión vigente** (`12-contrato…` §2.8), así que una versión nueva lo cambia sin tocar ninguna suscripción. **El ancla es por vertical**: invalida la entrada de **esa** vertical del beneficiario, no la de las otras verticales de su scope |
| **se publica una versión nueva de un `addon_version`** | es lo que otorga el addon, y desde el corte por campo ya no vive en billing |

**Las cuatro últimas son de la FASE 9 y ninguna entraba por las siete de arriba.** La lista se
escribió cuando toda fuente colgaba de una suscripción o de un trial, y **las cuatro nuevas no
cuelgan de ninguno**. El caso más caro está medido contra el propio capítulo, que declara que un
error acá *«es de seguridad y no de rendimiento»*: **si a la versión de piso se le sembró una clave
comercial —el escenario exacto que `G-R3` dice vigilar—, retirarla no invalidaba nada** y toda la
plataforma la seguía recibiendo desde el caché.

**La regla detrás, para que no vuelva a faltar una**: si una fuente puede cambiar **lo que otorga**
sin que cambie **ninguna fila del `user + vertical`**, necesita su propia entrada. Las siete
originales cubrían el caso contrario.

**Dos reglas sobre la invalidación:**

1. **Invalidar es borrar, no recalcular.** Recalcular dentro de la transacción que causó el
   cambio la vuelve más lenta y más frágil; la próxima lectura lo recalcula sola.
2. **Si la invalidación falla, la operación de dominio no falla** —igual que con el correo
   (§43)— **pero la entrada se marca sospechosa y la próxima lectura la ignora.** Es la
   dirección segura: se paga rendimiento, nunca acceso.

### 3.3 Lo que el caché nunca hace

**Nunca es la fuente de una decisión que toca plata.** Cobrar, reembolsar, otorgar y revocar
leen de la base. El caché sirve para responder «¿puede hacer esto?» en el camino de lectura,
no para decidir un movimiento de dinero.

---

## 4. Retención: qué se borra, qué se anonimiza, qué se conserva · cierra `M-DATA-01`

El §25 ordena soft delete a los 90 días y hard delete a los 180 de *«datos operativos
eliminables»*, y manda conservar auditoría, pagos, registros obligatorios, información legal e
historial necesario. Nunca define qué es eliminable.

**El riesgo concreto que esto cierra**: si la auditoría del §49 guardara eventos de dominio
*completos* con su contenido, el hard delete no eliminaría nada y la promesa del §25 sería
decorativa. Por eso `domain_event` guarda **referencias y campos que cambiaron, no copias**
(§2.6). Es una decisión de modelo tomada para que la retención sea posible.

### 4.1 La lista

**Los dos días se cuentan sobre la misma inactividad**, que es un término del núcleo y no una
frase de esta tabla: cap. 01 §1.2 la define y enumera **los cuatro hechos que la reinician**. El
que más importa acá es el segundo —**`cubierto` pasando a verdadero**—, porque es el que impide
que el día 180 alcance a alguien que volvió.

**Y se cuentan sobre una columna, no sobre una derivación: `listing.inactiva_desde`** (§2.5). El
día 90 es `inactiva_desde + 90` y el 180 es `inactiva_desde + 180`; **el trabajo que hace el reloj
es de la columna, y las transiciones sólo la leen**. El hecho 2 se resuelve **preguntándole al
contrato**, nunca leyendo el aviso que lo empuja (`12-contrato…` §3), y `PB4` y `PB5` vuelven a
preguntar en el momento de archivar (cap. 03 §9).

| | qué | por qué |
|---|---|---|
| **Se borra** al día 180 | el contenido publicable de la ficha (textos, fotos, FAQ, horarios), los borradores, las preferencias de la cuenta y las señales de identidad no bloqueantes (`DEC-TRIAL-004`) | es lo que el §25 llama operativo: sirve para prestar el servicio y el servicio terminó |
| **Se anonimiza** al día 180 | los datos personales que hayan quedado **dentro** de un evento de dominio o de un registro de outbox: nombre, correo, teléfono, dirección | el evento tiene que seguir existiendo —dice que algo pasó y cuándo— pero no necesita decir de quién para eso |
| **Se conserva íntegro, siempre** | **la fila de `trial`** — que guarda **un hash irreversible del correo normalizado, no el correo** | el quinto es el §10.2: el trial no se devuelve, así que la evidencia de que se consumió **tiene que sobrevivir al borrado** o el borrado se convierte en la forma de conseguir otro |

**El hash existe porque el correo es a la vez el único bloqueo y el primer dato que se anonimiza.**
`DEC-TRIAL-004` decidió que sólo el correo normalizado niega un trial nuevo, y este mismo capítulo
anonimiza el correo al día 180: la fila sobreviviría **sin poder reconocer a nadie**, que es
exactamente el desenlace que conservarla venía a evitar. Un hash sirve para lo único que hace
falta —«¿este correo ya consumió?», nunca «¿cuál era?»— y no hay nada que anonimizar en él. El
capítulo 22 §3 lo encontró y deja la pregunta legal formulada.

### 4.2 Cuatro reglas que la lista necesita

1. **Anonimizar no es borrar la fila.** El evento conserva su tipo, su fecha, su entidad y su
   causa; lo que se reemplaza es el dato personal.
2. **La fila de `trial` sobrevive al borrado de la cuenta.** Es la única entidad de este modelo
   que lo hace, y la razón está en el §10.2. Conserva el `user + vertical`, las fechas y **el hash
   del correo normalizado**; lo personal se anonimiza con el resto. El hash **no** se anonimiza —
   es lo que hace que sobrevivir sirva de algo.
3. **El día 90 no borra nada.** La ficha sale del sitio público, **el dueño la sigue viendo** y
   puede **exportarla o reactivarla a borrador sin pagar nada** (`DEC-DATA-001`, `PB8`). Poder
   exportar antes es lo que hace defendible el hard delete del día 180, y los avisos son correos
   transaccionales no suprimibles: **tres**, uno antes del día 90, uno **al archivar** y uno antes
   del día 180 (cap. 07 §6, núcleo).

   **La salida NO es «suscribiéndose», y decirlo así describía una salida más angosta que la que
   el diseño tiene.** Ésa era la redacción de `DEC-DATA-001`, escrita cuando la única vuelta
   imaginable era volver a contratar; la población declarada de `PB8` es literalmente la contraria
   —*«el que quiere su ficha de vuelta sin pagar todavía»* (cap. 03 §9)—. Quien leyera la versión
   vieja entendía que para recuperar la ficha hay que pagar, que es justo lo que `PB8` vino a
   desmentir.

   **Y las dos salidas que esta regla ofrece son ejecutables, que antes de la 9-bis-3 valía
   sólo para una y hasta la 9-bis-4 valía sólo a medias para la otra.** Reactivar estaba prometido
   acá y en la nota de `PB4` y **no lo ejecutaba ninguna tabla**: `ARCHIVED` no aparecía en la
   columna `desde` de ninguna máquina del programa, así que por la regla 1 del cap. 03 §1 (núcleo)
   reactivar era un incidente y no una operación. Hoy lo ejecutan **`PB7`** —sola, cuando la
   cobertura vuelve **o cuando el cupo vuelve a alcanzar**— y **`PB8`** —a pedido del dueño, hacia
   `DRAFT`— (cap. 03 §9). **Y desde esta pasada el dueño tiene con qué ejecutar `PB8`**: la
   versión de piso otorga *«recuperar lo suyo»* (§2.1), sin lo cual el paso 6 de la autorización
   rechazaba a la única población para la que esta salida existe. La frase importa entera: **el
   hard delete del día 180 se defiende con las dos salidas, y para el sujeto del borrado las dos
   tienen que ser alcanzables, no sólo estar escritas.**
4. **La vuelta reinicia el reloj, y el reinicio cuelga del hecho, no de la transición.** Lo que
   reinicia la inactividad es **`cubierto` pasando a verdadero** (cap. 01 §1.2, hecho 2), aunque
   `PB7` no llegue a disparar porque el cupo no alcanza. Sin esta regla, el que reanuda con un
   plan más chico se queda con la ficha archivada **y con el reloj del día 180 corriendo**, que es
   el mismo desenlace que la regla 3 viene a evitar.

   **El reinicio es una escritura en `inactiva_desde` (§2.5) y se ejecuta en dos momentos, no en
   uno**: cuando el recálculo que el aviso despierta vuelve a preguntar y trae `cubierto`
   verdadero, y —como red— cuando `PB4` o `PB5` releen antes de archivar (cap. 03 §9). Los dos
   preguntan; **ninguno de los dos le cree al aviso** (`12-contrato…` §3).

   **Su caso testigo es la pausa, y es la razón por la que estas dos reglas se escribieron
   juntas.** Alguien pausa hasta 4 pausas-mes —unos 120 días, `B/03` §5—, `PB2` le baja la ficha
   el primer día y `PB4` se la archiva el 90. El reloj **no se detiene** durante la pausa
   —verticales no sabe que hay una pausa detrás, y `DEC-TRIAL-008` con el §4 del contrato deciden
   que no lo sepa—, así que lo único que separa a ese cliente del borrado es que **120 < 180** y
   que reanudar reinicie. Las dos cifras son configuración: la desigualdad es el invariante `D16`
   (cap. 04 §3, núcleo) y la vigila un guard.

---

## 5. Las restricciones que sostienen los invariantes

El §64 lista 37 invariantes. Estos son los que **la base puede hacer cumplir sola**, y por eso
son los que no dependen de que ningún camino de código se acuerde:

| invariante del §64 | restricción |
|---|---|
| 1 · trial máximo una vez por `user + vertical` | `UNIQUE(user_id, vertical)` en `trial`, sin condición de estado |
| 2 · borrar ficha no devuelve trial | la fila de `trial` no se borra nunca (§4.1) |
| 11 · una ficha tiene un único dueño | columna no anulable, no tabla de relación |
| — · toda columna de estado tiene dominio cerrado | restricción de dominio por columna (cap. 03 §1.2) |

**Los demás no los puede sostener la base** —dependen de la resolución en el servicio— y son el
capítulo 04 (núcleo). Lo que importa es la distinción: los de arriba **no admiten un camino que los
esquive**, los otros sí, y por eso los otros necesitan estar en un solo lugar.

---

## Lo que esta mitad NO cierra

- **`OD-ARCH-01`** (retiro de un plan del catálogo) lo cerró el capítulo 10: acá está el flag de
  vendible y el de vigente, que son el mecanismo; **la política es de la épica de billing**.
- **Qué hace el sistema con una vertical discontinuada** (`M-SUB-03`) lo cerró el capítulo 10 §4,
  **en la épica de billing**. De acá sale lo único que el modelo necesitaba: la fila de `vertical`
  no se borra nunca.

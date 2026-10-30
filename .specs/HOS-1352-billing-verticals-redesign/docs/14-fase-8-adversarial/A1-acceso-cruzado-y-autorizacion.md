---
title: "FASE 8 · A1 — acceso cruzado y autorización"
linear: HOS-1353
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 8
---

# FASE 8 · A1 — acceso cruzado y autorización

Pasada adversarial sobre HOS-1353 con un solo vector: **que una cuenta llegue a algo que no le
corresponde** — otra vertical, otro plan, otra ficha — y los bordes de la resolución de
autorización que lo permiten.

Dieciséis hallazgos. Cuatro `CRITICA`, siete `ALTA`, cuatro `MEDIA`, uno `BAJA`.

El patrón que los une, y que conviene leer antes que los casos: **el capítulo 17 defiende muy bien
el eje «vertical declarada contra título vivo» y no defiende ninguno de los otros tres ejes que el
propio modelo abre** — recurso contra vertical, fuente contra alcance, y sujeto contra actor. Los
cuatro `CRITICA` son uno de cada uno.

---

## CRITICAS

### F-8A1-001 — El contexto de vertical se declara y nunca se compara con la vertical del recurso

**Qué se rompe.** Un usuario con cobertura de Gastronomía publica, edita y mantiene publicada una
ficha de **Alojamiento** que es suya. Nunca se le cobró Alojamiento. Es exactamente el caso que el
§13 nombra con todas las letras y que el capítulo 17 declara cerrado.

**El camino.**

1. Una persona es dueña de dos fichas: una de Alojamiento (`L-aloj`) y una de Gastronomía
   (`L-gastro`). El modelo lo permite sin excepción: `listing` guarda vertical y un solo
   `owner_user_id`, y un User puede tener varias.
2. Tiene una suscripción viva **sólo en Gastronomía**. En Alojamiento está `TRIAL_EXPIRED`, o
   `SUSPENDED`, o nunca entró.
3. Invoca la operación de publicar declarando `vertical = GASTRONOMÍA` y `listingId = L-aloj`.
4. Paso 1 ✔ hay actor. Paso 2 ✔ la cuenta opera. Paso 3 ✔ tiene el permiso de la familia
   «publicar». Paso 4 ✔ **existe, está en `DRAFT`, y es del sujeto** — las tres cosas que el paso
   4 pregunta son ciertas.
5. Paso 5 ✔ `cobertura(user, GASTRONOMÍA)` responde que sí. Paso 6 ✔ las claves de Gastronomía
   otorgan publicar. Paso 7 ✔ el cupo de fichas de Gastronomía está libre porque `L-gastro` es la
   única que contó.
6. `L-aloj` queda `PUBLISHED`. Los nueve pasos se ejecutaron enteros y ninguno preguntó de qué
   vertical es `L-aloj`.

Y el mismo camino al revés vale para el cupo: `L-aloj` no cuenta contra ningún limit de
Alojamiento, porque el paso 7 cuenta en la vertical **declarada**.

**Dónde lo permite el diseño.**

`HOS-1353/docs/17-autorizacion.md` §1.2, la fila del paso 4, enumera exactamente tres cosas y la
vertical no es una de ellas:

> | 4 | **el recurso: existencia, estado y dueño** | ¿existe, está en un estado que acepta esto,
> y es del sujeto? | **no existe** — las tres juntas |

Y §2.2 prohíbe explícitamente la comparación que lo atraparía:

> **Ninguna operación de dominio se puede expresar sin su contexto de vertical.** Es obligatorio
> en la firma, no un parámetro opcional **ni un valor que se deduzca del recurso**.

El cierre del §2.2 muestra que el ataque previsto era el otro:

> para que alguien con Gastronomía ejecute algo de Alojamiento, la operación tendría que haber
> sido invocada **declarando Alojamiento**, y ahí el paso 5 no encuentra título.

Eso supone un atacante que declara la vertical **que le falta**. El que declara la que **tiene**
pasa los nueve. La estructura garantiza que la vertical esté presente; no garantiza que sea
verdadera, y la única fuente de verdad disponible —la columna `vertical` de `listing`
(`HOS-1353/docs/02-modelo-de-datos.md` §2.5)— está declarada fuera de la resolución.

**Severidad.** `CRITICA` — acceso indebido a una capacidad de una vertical no cubierta, por el
camino que el capítulo declara cerrado.

**Necesita decisión del owner.** **Sí.** La corrección obvia —el paso 4 verifica que la vertical
del recurso sea la declarada— choca de frente con el «ni un valor que se deduzca del recurso» del
§2.2, que es la forma con que `S-AUTH-01` se cerró. Hay que decidir si «declarar» y «coincidir»
son dos obligaciones o una.

---

### F-8A1-002 — El paso 5 no tiene título para `PRE_TRIAL`, así que el trial no puede nacer

**Qué se rompe.** La primera publicación de cualquier usuario se rechaza. Como publicar **es** el
evento que enciende el trial en las tres verticales con ficha, el trial no se puede activar nunca y
la épica no arranca: el 100 % de la base instalada queda sin camino de entrada.

**El camino.**

1. Un usuario entra a Alojamiento. Su máquina de trial está en `PRE_TRIAL`, que es un estado real
   con borradores ilimitados y **sin capacidades comerciales**.
2. Crea un borrador y aprieta publicar: la transición `PB1`.
3. `PB1` es una operación de dominio, así que la ejecuta la resolución de autorización — el §1.3
   dice que es la única que ejecuta los nueve pasos y que ningún servicio los hace por su cuenta.
4. Paso 5 pregunta si tiene trial, suscripción, cortesía o grant que lo cubra.
   `cobertura(user, ALOJAMIENTO)` en la implementación de arranque resuelve honestamente la única
   fuente que existe: el trial. El trial está en `PRE_TRIAL`. **No cubre.**
5. `PB1` se rechaza por «sin cobertura». `T1` nunca ocurre, porque su evento de activación es
   justamente el `PB1` que se acaba de negar.
6. El mismo paso 5 niega antes incluso crear el borrador, que también es una operación de dominio,
   y que `DEC-TRIAL-007` promete ilimitado.

**Dónde lo permite el diseño.**

`HOS-1353/docs/17-autorizacion.md` §1.2:

> | 5 | **título vivo** | ¿tiene trial, suscripción, cortesía o grant que lo cubra? | sin cobertura |

Y §1.3 no deja una puerta por fuera:

> **No hay nueve verificaciones repartidas: hay una resolución de autorización que las ejecuta en
> orden, y es la única que las ejecuta.**

Del otro lado, `HOS-1353/docs/03-maquinas-de-estado.md` §9, `PB1`:

> publicar es quedar visible, y es **el evento que consume el trial** en las verticales con ficha

Y `HOS-1352/docs/12-contrato-de-cobertura.md` §5.1 confirma que la implementación de arranque no
disimula el hueco:

> **No devuelve datos fijos.** Resuelve honestamente la única fuente que ya existe del lado de
> verticales —el trial, con su máquina de estados del capítulo 03 §2— y responde que no a las
> otras tres.

**Severidad.** `CRITICA` — no es un borde: es el camino feliz de cada alta. Y la salida previsible
es peor que el problema: exentar `PB1` del paso 5 deja a la publicación como la **única** operación
sin verificación de cobertura, que es el fail-open que `PB2` existe para corregir después.

**Necesita decisión del owner.** **Sí.** Hay que decidir qué es `PRE_TRIAL` frente al paso 5 — un
quinto tipo de título acotado, un conjunto de operaciones declaradas pre-título, o un orden en el
que `T1` corre antes que el paso 5 de la operación que lo dispara. Las tres cambian el capítulo 17.

---

### F-8A1-003 — Una fuente de scope `LISTING` se agrega en un conjunto por `user + vertical`

**Qué se rompe.** El addon comprado para **una** ficha habilita la capacidad en **todas** las
fichas del dueño en esa vertical. Se paga uno y se usan diez.

**El camino.**

1. Una persona tiene seis fichas publicadas de Alojamiento.
2. Compra un addon de scope `LISTING` —el §40 lo define y el capítulo 11 §5.2 dice que apunta a
   *«una ficha concreta que la persona elige»*— y elige `L1`. Paga uno.
3. La instancia de addon queda viva y entra como fuente en la agregación del capítulo 15 §2.
4. La resolución del conjunto efectivo es **por `user + vertical`**: no lleva ficha. Se cachea con
   esa misma clave.
5. Invoca la operación sobre `L4`. Paso 6 pregunta *«¿su conjunto efectivo otorga esta
   capacidad?»* y el conjunto efectivo del par `(user, ALOJAMIENTO)` la tiene, porque una fuente
   viva la otorga.
6. `L4` usa la capacidad. Y con un limit de estrategia `SUMA`, el cupo extra que el addon compró
   para `L1` queda disponible para gastarlo en `L4`.

**Dónde lo permite el diseño.**

`HOS-1353/docs/15-entitlements-y-limits.md` §1 declara que la fuente puede alcanzar una ficha:

> | **la fuente** | a qué alcanza lo que otorga: **una ficha**, una vertical, el usuario, todo
> (§40, §35.1) | la base |

Pero §3.2 sólo define **dos** resoluciones, y ninguna tiene dimensión de ficha:

> | **de vertical** | por `user + vertical` |
> | **global** | por `user` |

Y `HOS-1353/docs/02-modelo-de-datos.md` §3.1 fija que lo que se cachea es exactamente eso:

> **El conjunto efectivo de entitlements y limits de un `user + vertical`.**

El capítulo 15 §1 avisa que los tres niveles de scope no se derivan uno del otro —*«no son el
mismo eje»*— y después resuelve sobre el eje de la **clave**, dejando el de la **fuente** sin un
mecanismo propio. El scope `LISTING` queda declarado en la base y sin nadie que lo lea.

**Severidad.** `CRITICA` — acceso a una capacidad sobre un recurso que no la pagó. Es además el
modo de falla que la plataforma ya tuvo (`featured_listing_addon_grants` existe justamente por
esto), así que no es hipotético.

**Necesita decisión del owner.** **Sí.** Meter la ficha en la clave del conjunto efectivo
multiplica el caché por la cartera de cada dueño y le agrega una tercera dimensión a la
invalidación del capítulo 02 §3.2. La alternativa —resolver las fuentes `LISTING` fuera del
conjunto efectivo— crea el segundo lugar donde se resuelven capacidades, que es lo que el §1.3
prohíbe. Es una elección con costo en las dos direcciones.

---

### F-8A1-004 — Un grant permanente cruza la frontera sin nada que diga qué otorga

**Qué se rompe.** El contrato de cobertura transporta *qué otorga una fuente* en un solo campo
—`versiónDePlan`— y **un grant no tiene versión de plan**. El titular de un *Free Forever* llega al
paso 6 con una fuente viva y un puntero vacío: o no puede hacer nada (y el grant no sirve), o
alguien lee `cubierto: sí` como permiso y el grant otorga todo lo que exista.

**El camino.**

1. `SUPER_ADMIN` otorga un *Free Forever* con scope de Alojamiento. No hay suscripción: el grant
   es una entidad independiente.
2. La persona invoca una operación de Alojamiento.
3. Paso 5: `cobertura(user, ALOJAMIENTO)` devuelve `cubierto: sí` con
   `fuentes: [ { tipo: GRANT, versiónDePlan: ?, hasta: sin fecha } ]`.
4. Paso 6 tiene que preguntar qué otorga esa fuente. Lo único que recibió es un puntero a una
   versión de plan que para un grant no existe.
5. Rama A (fallar cerrado): el conjunto efectivo queda vacío, la persona está cubierta y no puede
   hacer nada, y `PB3` nunca la republica. El grant es decorativo.
6. Rama B (fallar abierto, que es la que alguien va a escribir para que la rama A no pase):
   `cubierto: sí` se toma como suficiente y el grant otorga **toda** clave de la vertical,
   ignorando su scope parcial del §35.1 y el flag `includesAddons` del §35.2.

La cortesía temporal tiene el mismo problema en menor grado: existe una versión de plan detrás
(la de la suscripción pausada), pero el contrato no dice si el grant la hereda ni cuál es.

**Dónde lo permite el diseño.**

`HOS-1352/docs/12-contrato-de-cobertura.md` §2.1 declara los cuatro tipos y el único campo de
contenido:

> | **`tipo`** | `TRIAL` · `SUSCRIPCIÓN` · `CORTESÍA` · `GRANT` | los avisos … |
> | **`versiónDePlan`** | **la referencia, no los valores** | el paso 6: es cómo verticales sabe
> qué otorga esa fuente |

Y §2.3 insiste en que el puntero es toda la división del trabajo:

> billing dice *«esta persona está cubierta por la versión de plan X»* y verticales sabe qué
> otorga X.

Mientras `HOS-1352/docs/nucleo/01-glosario.md` §1.5 dice que el grant no es un plan:

> **Grant permanente** | *Free Forever*. Sólo `SUPER_ADMIN` (§35). **Se modela como entidad
> independiente, no como un plan.**

Y el capítulo 15 §2.2 agrega el grant a la agregación de limits como una fuente viva más, sin decir
de dónde saca sus valores.

**Severidad.** `CRITICA` — la rama B es acceso indebido sobre el instrumento más caro del sistema;
la rama A rompe un producto que el §35 promete. Y el arreglo toca el contrato, que
`DEC-ARCH-006` declara inmutable por una sola épica.

**Necesita decisión del owner.** **Sí.** El contrato es la frontera y ninguna de las dos épicas lo
puede mutar sola. Hay que decidir si un grant se modela como una versión de plan no vendible (y
entonces deja de ser *«entidad independiente»*), o si el contrato gana un campo de contenido (y
entonces parte de la resolución se muda a billing, que es lo que §2.3 dice querer evitar).

---

## ALTAS

### F-8A1-005 — El Guest y el Turista Free no tienen título, y la salida es una exención por superficie

**Qué se rompe.** La lectura pública del catálogo y el chat gratis del turista autenticado se
rechazan en la resolución canónica. Lo que se va a construir para destrabarlos —una marca de
«ruta pública» que saltea la resolución— es el lugar donde el próximo endpoint que **sí** debía
estar cerrado queda abierto sin que nada lo note.

**El camino.**

1. Un visitante sin cuenta pide la ficha pública de un alojamiento. Es una operación de dominio.
2. Paso 1 pregunta *«¿hay un actor?»* y responde «no autenticado». El visitante es un actor del
   modelo, pero la pregunta del paso 1 no es «¿hay actor?» en el sentido del modelo: su falla
   declarada es *no autenticado*. El Guest se cae en el primer paso.
3. Supongamos que pasa. Paso 2 pregunta si la cuenta puede operar hoy: un Guest no tiene correo
   verificado ni estado de inhabilitación. Paso 3 pregunta por un permiso que un Guest no tiene.
4. Paso 5 pregunta por un título vivo. Un Guest no tiene trial, ni suscripción, ni cortesía, ni
   grant. **Sin cobertura.**
5. Con un `Turista Free` autenticado pasa lo mismo desde el paso 5: el §14 lo define **sin
   suscripción real**, y ninguno de los cuatro tipos de título lo representa. El chat que el
   §36.2 promete gratis se rechaza.
6. Para destrabarlo alguien marca las rutas públicas como exentas de la resolución. A partir de
   ahí, «¿este camino verifica?» vuelve a tener tantas respuestas como caminos.

**Dónde lo permite el diseño.**

`HOS-1353/docs/17-autorizacion.md` §1.2:

> | 1 | **quién es** | ¿hay un actor? | **no autenticado** |

§3.3, que sí lo declara actor:

> el `Guest` del §6 es **un actor del modelo, no la falta de uno**

Y `HOS-1353/docs/15-entitlements-y-limits.md` §5.2 le da capacidades reales:

> De los booleanos recibe únicamente **los de lectura pública**.

Las tres afirmaciones no se pueden cumplir a la vez: un actor real con booleanos de lectura
pública no puede fallar el paso 1 por «no autenticado» ni el paso 5 por «sin cobertura», y el
capítulo no declara ninguna operación fuera de la resolución.

**Severidad.** `ALTA` — falla real, y su arreglo natural es el fail-open que todo el capítulo
existe para impedir.

**Necesita decisión del owner.** **No** en cuanto al problema; **sí** en cuanto a la forma. La
opción barata (marcar rutas públicas) es la mala; la buena (que `Turista Free` y `Guest` sean
títulos de pleno derecho en el paso 5, con conjunto efectivo propio) agrega un quinto tipo al
contrato de cobertura, y eso vuelve a tocar la frontera.

---

### F-8A1-006 — La cobertura de un trial se lee del estado escrito y no del reloj

**Qué se rompe.** Entre el instante en que un trial vence y el instante en que corre el job que
escribe `T3`, la autorización otorga **todo** lo que el plan de trial deriva del plan premium. La
ventana no tiene tope declarado en ningún lado.

**El camino.**

1. Un trial de Alojamiento termina a las 03:00. Nadie se suscribió.
2. El job que dispara `T3` corre cada N horas y N no está fijado en ninguna parte: los relojes son
   *«de cada subdominio»* y el capítulo 11 no define el suyo.
3. A las 03:05 la persona invoca una operación. Paso 5: `cobertura(user, ALOJAMIENTO)` resuelve el
   trial por **su máquina de estados**, que sigue diciendo `TRIAL_ACTIVE` porque nadie la movió.
   Responde `cubierto: sí`, con `hasta` en el pasado.
4. Nada en el contrato obliga al consumidor a mirar `hasta`: el campo está declarado para *«los
   avisos con ventana»*, no para la decisión.
5. Paso 6 otorga los entitlements del plan de trial. La ficha sigue `PUBLISHED` porque `PB2` se
   dispara desde `T3`, que no ocurrió.
6. Todo esto vale igual para `hasta` de una suscripción: el contrato devuelve un booleano que
   billing calculó con su propio reloj, y verticales no tiene con qué contradecirlo.

**Dónde lo permite el diseño.**

`HOS-1353/docs/03-maquinas-de-estado.md` §2, transición `T3`, cuyo evento es un reloj:

> | T3 | `TRIAL_ACTIVE` | **llega la fecha de fin** | `TRIAL_EXPIRED` | no hay suscripción
> autorizada | publicación → `UNPUBLISHED_BY_BILLING`; arranca la campaña de recuperación … |

`HOS-1352/docs/12-contrato-de-cobertura.md` §2.1 asigna `hasta` a los avisos y `cubierto` a la
decisión:

> | **`cubierto`** | si hay **al menos una** fuente viva … | el paso 5 de la autorización; `PB2` …
> | **`hasta`** | la fecha hasta la que cubre … | **los avisos con ventana** (cap. 15 §4.4) |

Y `HOS-1352/docs/nucleo/03-maquinas-de-estado.md` cierra derivando el reloj a cada subdominio:

> **Los relojes**, como jobs concretos con su horario y su idempotencia, son de cada subdominio.

**Severidad.** `ALTA` — es un fail-open acotado en el tiempo, pero la cota no está escrita y el
programa ya eligió en otro lugar que *«gana el estado escrito, nunca la hora»* (`E-PROMO-01`),
así que el sesgo por defecto es no mirar el reloj.

**Necesita decisión del owner.** **No.** Se resuelve dentro del diseño: o el paso 5 compara `hasta`
contra el reloj antes de aceptar `cubierto`, o el capítulo 11 fija la cadencia máxima del job y la
declara como la ventana aceptada.

---

### F-8A1-007 — La invalidación del caché es el único mecanismo, y sus dos fallas terminan en acceso vivo

**Qué se rompe.** Un entitlement revocado sigue otorgando. El capítulo 02 lo nombra como *«un error
de seguridad y no de rendimiento»* y después deja el único mecanismo que lo evita sin respaldo.

**El camino.** Dos caminos distintos al mismo final.

*Camino A — la invalidación falla.* `SUPER_ADMIN` revoca un grant. La transacción de dominio
escribe. La invalidación del caché falla porque el caché no responde. La regla dice que la entrada
se marca sospechosa — pero marcar es **escribir en el caché**, que es justo lo que acaba de fallar.
El capítulo no dice dónde vive la marca. La entrada sobrevive otorgando lo revocado.

*Camino B — el aviso se pierde.* Billing suspende una suscripción y emite el evento *«la cobertura
de (user, vertical) cambió»*. El evento no llega: no hay mecanismo de entrega declarado para él —el
outbox del núcleo es el de correo, con su estado y sus reintentos, y el aviso del contrato no está
adentro. Nada falló del lado de verticales, así que no hay nada que marcar sospechoso. La entrada
de caché es válida, el recálculo no se dispara, `PB2` no ocurre y la ficha de un suspendido sigue
publicada.

En los dos casos el único que podría corregir es el vencimiento por tiempo, y el diseño lo
descarta explícitamente como mecanismo.

**Dónde lo permite el diseño.**

`HOS-1353/docs/02-modelo-de-datos.md` §3.2:

> **La invalidación es explícita, y el vencimiento por tiempo es una red, nunca el mecanismo.** Un
> TTL como defensa principal deja una ventana en la que un permiso revocado sigue funcionando, y
> esa ventana es exactamente el error de seguridad que este punto viene a evitar.

Y la regla 2 del mismo §3.2, que es la que no se sostiene sola:

> **Si la invalidación falla, la operación de dominio no falla** … **pero la entrada se marca
> sospechosa y la próxima lectura la ignora.** Es la dirección segura: se paga rendimiento, nunca
> acceso.

`HOS-1352/docs/12-contrato-de-cobertura.md` §3 declara el aviso sin decir cómo se entrega ni qué
pasa si no llega:

> Es lo único que billing le **empuja** a verticales.

**Severidad.** `ALTA` — acceso indebido con duración no acotada, por dos caminos que el diseño
reconoce a medias.

**Necesita decisión del owner.** **No.** Es diseño interno: dónde vive la marca de sospecha (fuera
del caché), y si el aviso viaja por un mecanismo con acuse —o si hay un reconciliador periódico del
caché, que es lo que la plataforma ya hace con `entity-subscription-cache-reconcile`.

---

### F-8A1-008 — `PAUSED` no tiene respuesta en el contrato, y una cortesía se ve igual que una pausa

**Qué se rompe.** El contrato transporta un booleano donde el modelo declara tres resultados
distintos. `PAUSED` es el que nadie escribió: o un cliente en pausa conserva todo sin pagar, o una
cortesía —que se **implementa pausando**— le apaga el servicio a quien se lo estábamos regalando.

**El camino.**

1. `SUPER_ADMIN` otorga una cortesía temporal. Se implementa pausando en el proveedor y
   sosteniendo el servicio del lado nuestro. La suscripción queda `PAUSED` con motivo `COURTESY`.
2. Otro cliente pide una pausa del §26. Su suscripción queda `PAUSED` con motivo
   `CUSTOMER_REQUEST`.
3. Verticales pregunta `cobertura(user, vertical)` por los dos. El contrato devuelve `cubierto`
   y el tipo de fuente. El motivo de la pausa **no cruza**: el contrato declara que el estado
   exacto de la suscripción no cruza, y el motivo es parte de ese estado.
4. Si billing contesta `sí` para los dos, el cliente que pausó por voluntad propia conserva sus
   entitlements durante hasta ocho meses-pausa sin pagar.
5. Si contesta `no` para los dos, `PB2` despublica las fichas del beneficiario de la cortesía, que
   es exactamente lo contrario de lo que una cortesía es.
6. Y si billing desambigua por dentro, el capítulo 02 §3.2 igual quedó sin poder expresar lo que
   afirma: que `PAUSED` otorga algo distinto de `ACTIVE` y de `SUSPENDED`.

**Dónde lo permite el diseño.**

`HOS-1353/docs/02-modelo-de-datos.md` §3.2 declara tres resultados:

> | toda transición de la máquina de suscripción | `ACTIVE`, `SUSPENDED` y `PAUSED` **otorgan
> cosas distintas** |

`HOS-1352/docs/12-contrato-de-cobertura.md` §4 admite dos, y sólo justifica el par `ACTIVE` /
`GRACE_PERIOD`:

> **El estado exacto de la suscripción no cruza.** Verticales no distingue `ACTIVE` de
> `GRACE_PERIOD` … Pasarla sería invitar a que alguien escriba una regla de producto sobre un
> estado de cobranza.

Y `HOS-1352/docs/nucleo/01-glosario.md` §2.2 explica por qué el motivo es indispensable y por qué
vive sólo de nuestro lado:

> en el proveedor una cortesía y una pausa pedida por el cliente **se ven idénticas**, así que la
> intención vive en nuestro lado o no existe.

**Severidad.** `ALTA` — una de las dos ramas es servicio gratis, la otra es cortar el servicio de
un beneficiario. Las dos son reales y la elección no está escrita.

**Necesita decisión del owner.** **Sí.** «Una pausa del cliente, ¿cubre?» es una decisión de
producto, no de diseño: define si pausar es suspender el cobro conservando la presencia pública o
suspender las dos cosas.

---

### F-8A1-009 — La herencia de Turista VIP es la única fuente cuyo destino es otra vertical

**Qué se rompe.** Los beneficios de Turista VIP que otorga un plan de Alojamiento no llegan a
ninguna parte, o llegan por un camino que el capítulo 15 declara imposible. En el segundo caso, la
defensa estructural contra el cruce entre verticales tiene una excepción no declarada, y una
excepción no declarada es por donde se cuelan las demás.

**El camino.**

1. Una versión de plan de **Alojamiento** lleva el flag «hereda Turista VIP», que el capítulo 10
   declara ítem 6 del Eje 2 y configuración en base.
2. La persona usa una capacidad de la vertical **Turista** — el chat, un descuento, lo que el VIP
   dé.
3. Paso 6 resuelve el conjunto efectivo de `(user, TURISTA)`. Las fuentes vivas de ese par son las
   de Turista: no hay ninguna, porque su título de Alojamiento es una fuente de `(user,
   ALOJAMIENTO)`.
4. Rama A: la herencia no llega y el ítem 6 del Eje 2 no hace nada.
5. Rama B: la resolución de `(user, TURISTA)` alcanza una fuente anclada en Alojamiento. Eso es,
   literalmente, una clave de una vertical alimentada desde otra: la operación que §3.2 dice que
   no se puede invocar.
6. Y el capítulo 15 §6 confirma que la rama B es la intención: el suspendido *«pierde beneficios
   que usaba como turista»* por impago de su plan de anfitrión.

**Dónde lo permite el diseño.**

`HOS-1353/docs/15-entitlements-y-limits.md` §3.2 declara la defensa sin excepciones:

> **Una clave de vertical no se puede leer desde otra vertical porque su resolución pide la
> vertical** … No hay un control que alguien pueda olvidar: hay una resolución que no se puede
> invocar sin el dato.

§3.1 enumera los dos cruces legítimos y no incluye el de vertical a vertical:

> **Una fuente global puede otorgar una clave de vertical, y una fuente de vertical puede otorgar
> una clave global.**

Y `HOS-1352/docs/nucleo/01-glosario.md` §5 lista la herencia como una fuente más, sin scope:

> Entitlements y limits efectivos = agregación de: versión de plan + **herencia Turista VIP** +
> addons + cortesía + grant

**Severidad.** `ALTA` — o una funcionalidad vendida que no se entrega, o la única grieta de una
defensa que el diseño declara sin grietas.

**Necesita decisión del owner.** **No.** Se resuelve en el capítulo 15: declarar que las claves
heredables de VIP son de scope **global** (y entonces §3.3 ya las cubre entera, incluida su
pérdida al suspender), o admitir explícitamente el tercer cruce y decir cuál es su regla.

---

### F-8A1-010 — El estado del sujeto no lo verifica ningún paso

**Qué se rompe.** Con `actor ≠ sujeto` siempre disponible, nadie pregunta si el **sujeto** puede
recibir lo que se le hace. Una cuenta inhabilitada por abuso recupera capacidades por vía
administrativa, y el único paso que mira el estado de una persona mira al actor.

**El camino.**

1. Una cuenta queda **inhabilitada por abuso**. Su rol no se toca: perder el acceso nunca revoca
   un rol, y la inhabilitación se hace valer en el paso 2.
2. Un administrador con el permiso de «extender un trial» —una de las doce acciones, y de las que
   el capítulo 08 clasifica como *no destructiva*— ejecuta la extensión con
   `actor = admin, sujeto = la cuenta inhabilitada`.
3. Paso 2 pregunta *«¿esta cuenta puede operar hoy?»*. La cuenta que evalúa es la del **actor**:
   la lista está construida sobre el actor, cuyo paso 1 es «¿hay un actor?». El admin está en
   regla.
4. Paso 3 ✔ el admin tiene el permiso de esa acción concreta. Paso 4 ✔ el recurso es del sujeto.
5. Los pasos 5, 6 y 7 se evalúan sobre el sujeto — pero esos tres preguntan por **cobertura,
   capacidad y cupo**, no por el estado de la persona. Y para las doce acciones ni siquiera corren:
   son capacidades del actor.
6. El trial de una cuenta inhabilitada queda extendido. El mismo camino vale para otorgar una
   cortesía, configurar un Partner o cambiar de plan a alguien cuya cuenta está cerrada.

**Dónde lo permite el diseño.**

`HOS-1353/docs/17-autorizacion.md` §1.2, paso 2, formulado sobre quien opera:

> | 2 | **estado de la persona** | ¿esta cuenta puede operar hoy? | inhabilitada, o correo sin
> verificar |

§3.2, que reparte los pasos entre actor y sujeto y deja el 2 sin asignar:

> **El admin no hereda los entitlements del sujeto.** Los pasos **5, 6 y 7** se evalúan **sobre el
> sujeto**

Y la excepción que saca del camino incluso esos tres:

> **las doce acciones del capítulo 08 §3 son capacidades del actor**, no del sujeto

**Severidad.** `ALTA` — confusión de identidad con consecuencia concreta: el estado que sanciona a
una cuenta no se consulta en ninguna operación que recaiga sobre ella.

**Necesita decisión del owner.** **No.** Es un paso 2 desdoblado: el estado del actor y el estado
del sujeto son dos preguntas, y sólo una está en la lista.

---

### F-8A1-011 — Las cuatro reglas de `actor ≠ sujeto` no tienen ni un guard entre los siete

**Qué se rompe.** El §3 es la única sección del capítulo 17 que no baja a ningún nivel de
imposición. Sus cuatro reglas quedan en «convención», que es el escalón que el capítulo 04 llama
*no verificable* y obliga a declarar como tal. La regla que se pierde primero es la auditoría: una
operación administrativa nueva que se olvide de registrarse pasa CI sin que nada falle, y el rastro
que el hueco `M-AUTH-02` pedía no existe justo para la operación que lo necesitaba.

**El camino.**

1. Se agrega una acción administrativa número trece — por ejemplo, forzar el reclamo de un Partner
   aprobado desde el panel del §48.
2. Quien la escribe declara que es *capacidad del actor*, porque la regla dice que la clase **se
   declara, nunca se infiere** y no hay nada que valide la declaración.
3. Con eso, los pasos 5, 6 y 7 no corren sobre el sujeto.
4. Se olvida el registro de auditoría. Ningún guard de los siete mira si una operación con
   `actor ≠ sujeto` escribe evento: `G1` mira verticales, `G2` contexto, `G3` claves, `G4` roles,
   `G5` el reconciliador, `G6` decisiones por rol, `G8` `commerce`.
5. Queda una operación que un administrador puede ejecutar sobre la cuenta de cualquiera, sin
   rastro, y que declara por sí misma que no se le aplican los pasos de cobertura.

**Dónde lo permite el diseño.**

`HOS-1353/docs/17-autorizacion.md` §3.2, las cuatro reglas, todas enunciadas y ninguna asignada a
un nivel:

> **Cuatro reglas, y ninguna es opcional:** … 2. **Toda operación con `actor ≠ sujeto` es
> auditable sin excepción** … **A qué clase pertenece una operación se declara, nunca se infiere.**

`HOS-1353/spec.md` §5 lista los siete guards y ninguno toca el §3.

Y `HOS-1352/docs/nucleo/04-invariantes.md` §1 fija que eso es una degradación que exige razón
escrita:

> La regla de reparto: **base antes que servicio, servicio antes que guard, guard antes que
> nada.** Bajar un nivel exige una razón escrita

El propio capítulo 17 abre con la tesis contraria a lo que hace en su §3: *«Una verificación cubre
el lugar donde alguien se acordó de escribirla»*, y de ahí el guard. El §2 tiene el suyo, el §4
tiene el suyo, el §3 no.

**Severidad.** `ALTA` — es el vector de abuso que `M-AUTH-02` nombra textualmente (*«un admin
comprometido operando sin rastro»*) y quedó sin ninguna barrera mecánica.

**Necesita decisión del owner.** **No.** Son dos guards nuevos, del mismo tipo que los siete que ya
existen: uno que exige registro en toda operación con `actor ≠ sujeto`, otro que exige que la
clase «capacidad del actor» esté en una lista cerrada y no sea un flag libre.

---

## MEDIAS

### F-8A1-012 — `G1` y `G2` usan el mismo verbo con sentidos opuestos

**Qué se rompe.** La pinza que protege el scope estructural está descrita con una tabla en la que
los dos guards prohíben lo mismo y su contrario. Quien la implemente de la tabla escribe dos
predicados que se contradicen, y el que sobreviva va a ser el que no rompa el build — o sea,
el permisivo.

**El camino.**

1. `G2` obliga a que toda operación de dominio **nombre** su vertical.
2. `G1` falla si una pieza **nombra** una vertical sin implementar uno de los ocho ítems del Eje 2.
3. Publicar una ficha, editar, contar un cupo: ninguna implementa uno de los ocho ítems. Con la
   tabla en la mano, toda operación de dominio viola `G1` justamente por cumplir `G2`.
4. Quien lo note afloja `G1` —le agrega una excepción para «operaciones de dominio»— y desde ahí
   el guard nace con una lista de excepciones, que es lo que la descomposición §2.1 dice que es
   exactamente cómo un guard deja de servir.

**Dónde lo permite el diseño.**

`HOS-1353/docs/17-autorizacion.md` §2.3:

> | cap. 01 §4.4 | **nombrar** una vertical fuera de los ocho ítems del Eje 2 |
> | éste | **no nombrarla** en una operación de dominio |

La distinción que los reconcilia existe, pero está en otro documento y con otras palabras:
`HOS-1352/docs/nucleo/01-glosario.md` §4.5 aclara que «nombrar» es mencionar **una** vertical
concreta, no tomar la vertical como dato. La tabla del §2.3 no la reproduce.

**Severidad.** `MEDIA` — no falla en producción; falla al construir la única defensa estructural
del capítulo, y la corrección natural la debilita.

**Necesita decisión del owner.** **No.** Es precisión: los dos predicados son sobre cosas distintas
—un literal de vertical contra un parámetro de vertical— y la tabla tiene que decirlo.

---

### F-8A1-013 — La regla «no vincula nada hasta que la dirección se prueba» la incumple su propia tabla

**Qué se rompe.** En la rama de la tabla donde el correo **no** corresponde a ningún usuario, el
diseño crea el usuario y le cuelga el Partner antes de cualquier prueba de que alguien pueda leer
esa casilla. Es la mitad del caso que §2.4 vino a cerrar, resuelta al revés.

**El camino.**

1. El formulario de postulación es público y acepta cualquier dirección.
2. Alguien postula un negocio real usando la dirección de un tercero que todavía no tiene cuenta
   en Hospeda.
3. El admin aprueba. Por la primera fila de la tabla: se crea el usuario y se le manda la
   validación.
4. Ya existe una cuenta Hospeda a nombre de esa dirección, con un Partner asociado, sin que nadie
   con acceso a la casilla haya hecho nada.
5. El titular real de la dirección, cuando quiera registrarse, se encuentra con que su correo ya
   está tomado por una cuenta que no creó y que arrastra una entidad comercial.

**Dónde lo permite el diseño.**

`HOS-1353/docs/18-partner.md` §2.4 enuncia la regla y después la contradice en la primera fila de
su propia tabla:

> **La regla: la postulación no vincula nada hasta que la dirección se prueba.**
>
> | el correo **no** corresponde a ningún usuario | **se crea el usuario** y se le manda la
> validación — el §17.3 tal cual |
> | el correo **sí** corresponde a un usuario | … **nada se vincula hasta que alguien con acceso a
> ella lo haga** |

Y el cierre del §2.4 dice que el riesgo es el mismo en las dos ramas:

> Sin esto, cargar el correo de un tercero alcanza para colgarle un Partner que no pidió

**Severidad.** `MEDIA` — no da acceso a nadie, pero ocupa la identidad de un tercero y deja un
Partner aprobado atado a una cuenta que su titular nunca pidió.

**Necesita decisión del owner.** **No.** Es aplicar la misma regla a la rama que quedó con la
redacción del §17.3: crear la cuenta en estado no reclamado, o no crearla hasta la validación.

---

### F-8A1-014 — La espera tras un rechazo se ancla en la única identidad que el postulante elige

**Qué se rompe.** La espera configurable entre un rechazo y una postulación nueva no acota a nadie:
el formulario es anterior a la cuenta, así que la única clave posible es el correo, y el correo lo
pone quien postula. El panel del admin vuelve al bucle que la espera existe para cortar.

**El camino.**

1. Alguien postula. El admin rechaza. Arranca la espera.
2. El mismo día la persona postula de nuevo con `nombre+1@…`, o con otra dirección cualquiera.
3. No hay `user` al que atar la espera, y las otras señales de identidad —teléfono, identificador
   fiscal, dispositivo— están decididas como **observables que nunca bloquean**.
4. La postulación entra como nueva. El panel recibe una `PENDIENTE` por día, que es exactamente lo
   que §2.2 describe como el desenlace sin espera.

**Dónde lo permite el diseño.**

`HOS-1353/docs/18-partner.md` §2.2 declara la espera y el bucle que evita:

> **Pero hay una espera configurable entre un rechazo y una postulación nueva** (§9: es
> configuración, no una constante). Sin ella, rechazar no cierra nada: la postulación vuelve al
> día siguiente y el panel del admin se convierte en un bucle.

§2.4 fija que el formulario es público y sin identidad probada:

> el formulario de postulación es público, así que **cualquiera puede escribir cualquier
> dirección**.

**Severidad.** `MEDIA` — el daño es operativo (ruido en el panel del §48), pero el mecanismo no
cumple su función declarada y nadie lo va a notar hasta que el panel esté lleno.

**Necesita decisión del owner.** **No** si se acepta que la espera es un freno cosmético y se
declara como tal; **sí** si se quiere que frene de verdad, porque frenar exige una señal de
identidad bloqueante y `DEC-TRIAL-004` ya decidió que ninguna de las disponibles bloquea.

---

### F-8A1-015 — Una `APROBADA` sin reclamar es un portador permanente sobre una casilla ajena

**Qué se rompe.** El aviso de reclamo no vence porque nada vence por tiempo en esta máquina. Queda
un enlace que vincula un Partner a quien lo presente, vivo para siempre, en una casilla que puede
cambiar de manos.

**El camino.**

1. Se aprueba una postulación cuyo correo pertenece a un usuario existente. Sale el aviso para
   reclamar el Partner.
2. Nadie lo reclama. La `APROBADA` no vence: el capítulo declara que es inofensiva porque no
   publica nada ni se le cobra nada.
3. Pasan dos años. La dirección es corporativa y la persona que la usaba se fue; o el dominio
   caducó y otro lo registró; o la casilla quedó en un buzón compartido.
4. Quien hoy lee esa casilla encuentra el aviso y reclama el Partner. La vinculación se ejecuta
   contra la única prueba que el diseño exige: poder leer la dirección.
5. La propiedad de una entidad comercial cambia de manos sin que nadie ejecute una operación de
   transferencia y sin que el paso 4 tenga nada que verificar, porque el Partner no era de nadie.

**Dónde lo permite el diseño.**

`HOS-1353/docs/18-partner.md` §2.5:

> **No vence, y queda visible.** … Un vencimiento automático **no evitaría ningún daño** —no hay
> ninguno— y agregaría un estado más.

Y §2.4 fija que leer la casilla es la prueba completa:

> **La única prueba de que el postulante es dueño de la dirección es que pueda leerla**

El §2.5 evalúa el daño de una `APROBADA` sin reclamar como *«lo único que existe es una fila»*. No
lo es: existe también el aviso, y el aviso es una capacidad al portador cuya vigencia es la de la
casilla, no la de la decisión.

**Severidad.** `MEDIA` — probabilidad baja con el volumen actual de Partner, consecuencia alta por
caso.

**Necesita decisión del owner.** **No.** Es la vigencia del enlace de reclamo, que es una decisión
de implementación del §2.4 — el estado `APROBADA` puede seguir sin vencer aunque su aviso venza.

---

## BAJA

### F-8A1-016 — «Nueve pasos» se enumera como siete

**Qué se rompe.** Nada, en ejecución. Pero el número es el que va a terminar en el nombre de un
test o en el mensaje de un guard, y el mensaje va a afirmar más de lo que el predicado verifica.

**El camino.** El §1.1 cierra diciendo que quedan nueve pasos y una precondición. La tabla del §1.2
tiene siete filas numeradas más la precondición. La cuenta cierra sólo si el paso 4 se lee como
tres verificaciones (existencia, estado, dueño), que es como está escrito — pero entonces «los
nueve se resuelven en un solo lugar» y «los nueve pasos» del `spec.md` §3.6 nombran una lista que
en ningún lado tiene nueve elementos, y la spec de la épica los enumera del 1 al 7.

**Dónde lo permite el diseño.**

`HOS-1353/docs/17-autorizacion.md` §1.1:

> Quedan **nueve pasos y una precondición**.

contra la tabla inmediatamente siguiente en §1.2, cuyas filas numeradas van de 1 a 7, y contra
`HOS-1353/spec.md` §3.6, que titula *«Nueve pasos»* y lista siete.

**Severidad.** `BAJA` — falta precisión, no falla.

**Necesita decisión del owner.** **No.**

---

## Ataques que intenté y el diseño resistió

Vale tanto como la lista de arriba: son los caminos que probé y que el diseño cierra de verdad.

- **Acumular roles hasta que el paso 3 deje de filtrar.** Una cuenta que es host, proveedor y
  partner a la vez acumula roles que nunca se revocan, y el paso 3 converge a «sí». No alcanza: el
  paso 5 es por `user + vertical`, así que un rol sobreviviente en una vertical sin cobertura no
  compra nada. Los pasos 3 y 5 están separados exactamente para eso (§4.2).
- **Averiguar permisos desde una cuenta inhabilitada, probando operaciones.** El paso 2 va antes
  que el paso 3 y el §1.2 lo justifica con este ataque nominal. Cerrado.
- **Distinguir un recurso ajeno de uno inexistente.** El paso 4 responde «no existe» a las tres
  cosas, y la descomposición lo convierte en criterio de aceptación de `V5` (*«un recurso ajeno,
  uno archivado y uno inexistente contestan lo mismo»*). Cerrado, y con verificación.
- **Que un admin herede los entitlements del cliente para hacerle algo que el cliente no podría.**
  §3.2 regla 3 lo prohíbe de frente y declara las doce excepciones por enumeración, no por
  inferencia. Cerrado — el hueco que quedó es el de `F-8A1-011`, que es la falta de guard, no la
  falta de regla.
- **Que un job otorgue una cortesía o un grant.** §3.3 lo cierra contra `D11`: un actor de sistema
  no puede ejecutar ninguna de las doce. Cerrado.
- **Impersonar al cliente para lavar el rastro de una acción administrativa.** §3.2 regla 4
  elimina la impersonación y explica exactamente por qué. Cerrado.
- **Comprar un addon estando sólo en trial, y usarlo en la vertical del trial.** El capítulo 11
  §5.2 y §5.3 lo cierran por scope y no por un chequeo: `LISTING` no puede apuntar a una ficha en
  trial, `VERTICAL_SUBSCRIPTION` no tiene a qué apuntar, y `USER`/`GLOBAL` tienen regla explícita.
  Cerrado, y bien.
- **Un addon `LISTING` sobre Partner, que no tiene fichas.** El capítulo 18 §1.4 lo cierra por
  dato —las verticales compatibles del producto— sin rama de código. Cerrado.
- **Extender un trial ya vencido para revivir la campaña de recuperación.** El capítulo 11 §7 lo
  disuelve por construcción: `T4` exige `TRIAL_ACTIVE` y la campaña arranca en `T3`. Cerrado.
- **Conseguir un segundo trial borrando la cuenta.** El capítulo 22 §3 encontró ese defecto antes
  que yo y lo corrigió con el hash irreversible, con la pregunta legal formulada. Cerrado.
- **Usar la UI para llegar a algo que el backend no expone.** El capítulo 19 §1 no admite matices y
  la descomposición lo convierte en criterio de `V8`. Cerrado.
- **Leer una clave de una vertical desde otra.** El capítulo 15 §3.2 lo hace estructuralmente
  imposible. Cerrado — con la única excepción de `F-8A1-009`, que el capítulo no declara.

---

## Fuera de mi vector

Lo que vi y le toca a otro. No lo perseguí.

- **`NUCLEO` — la cuenta de invariantes no cierra.** `nucleo/04-invariantes.md` §5 tiene una tabla
  que suma 37 + 14 = 51 y cierra el párrafo siguiente con *«Cuarenta y nueve invariantes»*,
  mientras el índice (`nucleo/00-indice.md`) dice *«los 51»*. Y §2.4 titula una tabla de **siete**
  filas y la resume como *«Cinco de las 37 no se pueden comprobar ejecutando nada»*. Los dos
  números viven en el capítulo que existe para poder preguntar **una vez** si están todos.
- **`NUCLEO` — falta `G7`.** La lista de guards de `HOS-1353/docs/20-testing.md` §2 y de
  `spec.md` §5 va `G1 G2 G3 G4 G5 G6 G8`. Un hueco en una numeración presentada como completa se
  lee como un guard perdido en el desarme de las épicas, no como una decisión.
- **Estados / carreras (agente A2).** La cadencia del job que dispara `T3` no está fijada en ningún
  capítulo, y `nucleo/03-maquinas-de-estado.md` la deriva a cada subdominio, donde el capítulo 11
  no la toma. Es la causa raíz de mi `F-8A1-006` y probablemente de más cosas del lado de ellos.
- **Estados / carreras (agente A2).** `T2` y `T5` disparan *«se autoriza una suscripción»*, que es
  un hecho de billing más específico que el único aviso que el contrato deja cruzar (*«la cobertura
  cambió»*). O el aviso lleva el tipo de fuente con suficiente precisión para distinguir una
  autorización nueva de una recuperación, o las dos transiciones no tienen quién las dispare.
- **Datos / acoplamiento (agente A3).** `HOS-1353/docs/19-superficies.md` quedó con la tabla de §2
  reducida a una sola fila (Admin) y la lista de §4 numerada `1, 2, 4, 8, 9` — faltan el 3, el 5,
  el 6 y el 7. El capítulo se presenta como *«la lista de lo que hay que decirle a la gente, que
  nadie tiene junta»*, y la lista está partida. Parece residuo del desarme del 2026-09-18.
- **Datos / acoplamiento (agente A3).** `nucleo/02-modelo-de-datos.md` salta de §1.3 a §2.6 sin
  §2.1–§2.5: la numeración del núcleo quedó con los huecos que se llevaron las épicas, así que una
  referencia cruzada a «cap. 02 §2.x» no resuelve contra el núcleo ni contra una épica sola.

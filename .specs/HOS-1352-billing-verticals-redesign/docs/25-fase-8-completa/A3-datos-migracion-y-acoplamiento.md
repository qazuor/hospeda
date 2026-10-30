---
title: "FASE 8 completa · A3 — datos, migración y acoplamiento (lado verticales)"
linear: HOS-1352
statusSource: linear
created: 2026-09-24
updated: 2026-09-24
status: CURRENT
fase: 8
---

# FASE 8 completa · A3 — datos, migración y acoplamiento (lado verticales)

Ataqué el modelo de datos de verticales (`V/02`), la migración (`V/21` y su espejo `B/21`), el
testing que vigila esas columnas (`V/20`), el pliego legal (`V/22`) y el registro del núcleo
(`NUCLEO/02`, `NUCLEO/08`), contrastándolos con el esquema que existe hoy en `packages/db`. El foco
fue lo que se pierde: contenido que se borra antes de tiempo, filas que la migración no sabe cómo
sembrar, constraints que no sostienen lo que el texto dice y registros que la ley pide conservar.

Son **13 hallazgos**: **2 `CRITICA`**, **5 `ALTA`**, **5 `MEDIA`** y **1 `BAJA`**. Los cinco
defectos de migración que `DEC-MIG-004` ya retiró con causa (tabla de `01-decision-log.md:2786-2792`)
**no se repiten**; donde un hallazgo roza uno de ellos, digo en qué se diferencia.

**La idea más grave, en una línea:** `listing.inactiva_desde` **no se escribe cuando la ficha deja
de estar cubierta** (el diseño lo prohíbe a propósito), así que el reloj del borrado arranca hasta
90 días **antes** de la caída, y un cliente que pausa 120 días pierde el contenido: `D16` y `G-R5`
vigilan una desigualdad (120 < 180) que no es la que protege.

Regla de lectura: cada hallazgo se apoya en una cita textual. Donde una medición de la matriz
sostiene el ataque, va su id de fila (en este vector ninguno depende del proveedor).

---

## CRITICA

### F-8CA3-001 — El reloj del borrado arranca antes de que la ficha quede inactiva: una pausa legítima borra contenido

**Qué se rompe.** El hard delete del día 180 cae sobre el contenido de un cliente que **pausó** su
suscripción (función vendida, tope de 4 pausas-mes ≈ 120 días) **antes de que la pausa termine**.
Irreversible: lo que borra el día 180 no lo recupera `PB8` ni `PB7`.

**El camino.**

1. Juan publica su alojamiento el 1-mar (`PB1`, hecho 3): `inactiva_desde = 1-mar`. Paga todos los
   meses, no edita nada.
2. El 30-may (día 90) corre `PB4` sobre la ficha `PUBLISHED`, relee la cobertura, la encuentra
   verdadera, **no archiva** y reinicia: `inactiva_desde = 30-may` (hecho 2).
3. El 27-ago (89 días después) Juan pausa por 120 días. `cubierto` pasa a falso y `PB2` baja la
   ficha a `UNPUBLISHED_BY_BILLING`. **`PB2` no escribe la columna**: `inactiva_desde` sigue en 30-may.
4. El 28-ago (30-may + 90) corre `PB4`: relee, `cubierto` falso, **archiva**.
5. El 26-nov (30-may + 180) corre el hard delete: relee, `cubierto` sigue falso (la pausa dura hasta
   el 25-dic), **borra el contenido publicable**.
6. El 25-dic Juan reanuda. `PB7` devuelve una ficha `ARCHIVED` sin textos ni fotos.

La pausa quedó 30 días por debajo de su tope, `D16` está en verde y el contenido se borró a los 91
días de la caída, no a los 180.

**Dónde lo permite el diseño.**

La columna se escribe **sólo** en los cuatro hechos, y la caída de cobertura no es uno:

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:296` §2.5:

> **Se escribe en los cuatro hechos y en ninguna otra parte.**

`PB2` escribiendo la columna es exactamente el caso con que se prueba `G-R6-B` en **rojo**:

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:129-133` §2:

> *(a)* Se le agrega la escritura a **`PB2`** —la ficha que cae al perder cobertura (cap. 03 §9)—,
> que es el escritor de más creíble de todos

Y toda la protección de la pausa **supone** que el reloj arranca el primer día de la pausa:

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:158-161` §1.2:

> el reloj **no se detiene** durante la pausa, **se reinicia al salir de ella** por el hecho 2, y
> entre el primer día de la pausa y ese reinicio hay 120 días como máximo contra los 180 del
> borrado. Que esa desigualdad siga siendo cierta **es un invariante**

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:142` (`D16`):

> **El tope de una pausa, en días, es menor que el día del hard delete.** Hoy son **4 pausas-mes**
> —unos 120 días […]— contra **180**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:511-513` §4.2:

> así que lo único que separa a ese cliente del borrado es que **120 < 180** y que reanudar reinicie.

Lo que el reloj guarda al caer es **el último reinicio**, y sobre una ficha publicada y cubierta ese
reinicio lo produce `PB4` cada 90 días (`V/03:319-320`: *«si el `user + vertical` está cubierto, no
archivan y **reinician el reloj**»*). La antigüedad del reloj en el instante de la caída va de 0 a
~90 días, así que la desigualdad que protege es `tope_pausa + 90 < 180`, que con 120 es **falsa**.

El diseño ya reconoció este mismo mecanismo **para un solo caso**, la discontinuación, y le puso
escritor propio por esa razón:

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:137-139` §1.2:

> Sin ejecutor, el hard delete caía sobre la fecha vieja —**hasta 90 días antes** de la que los tres
> avisos de la discontinuación le prometieron al cliente—.

La pausa, la suspensión por impago y la cancelación tienen el mismo mecanismo y no tienen ese escritor.
`G-R5` (`V/20:64`) compara las dos cifras de catálogo y queda en verde.

**Severidad**: `CRITICA`. Borrado irreversible del contenido de un cliente que usó una función que
se le vendió, dentro del tope que el catálogo le promete. El mismo camino alcanza a todo `SUSPENDED`
y a todo `CANCELLED` que vuelve entre el día 91 y el 180 desde la caída. El PDR lo cuenta *«desde que
queda efectivamente inactiva»* (`00-PDR.md:1199`).

**Necesita decisión del owner**: **no**. Es una corrección de diseño: o se sella el instante de la
caída (que `G-R6-B` hoy prohíbe, con su razón), o `D16`/`G-R5` pasan a vigilar `tope + 90 < 180`, o
la relectura del día 180 mira algo más que `cubierto` en ese instante. Elegir entre las tres es de
diseño; lo que no se puede es dejar el invariante midiendo otra cosa.

---

### F-8CA3-002 — El corte no dice con qué valor nace `inactiva_desde` en las fichas existentes, y el valor que la propia regla sugiere las borra al día siguiente

**Qué se rompe.** Las fichas de Alojamiento que existen hoy (12 medidas) tienen que tener
`inactiva_desde` no nulo en el modelo nuevo. Nadie declara el valor. La regla de la columna dice
*«el instante de su creación»*, que es `accommodations.created_at`; con ese valor, toda ficha creada
más de 180 días antes del corte **se archiva y se borra en la primera corrida** después del corte,
antes de que la llamada del owner ocurra.

**El camino.**

1. Pedro tiene un alojamiento creado en marzo de 2026. El corte (FASE 10) ocurre en, digamos,
   enero de 2027.
2. Para que la tabla acepte la fila, la migración estructural tiene que sembrar `inactiva_desde`.
   El implementador lee *«una ficha nace con el instante de su creación»* y usa `created_at`.
3. La mañana del corte, Pedro está en `PRE_TRIAL` y `PB2` le despublica la ficha (`V/21` §2.4, que
   lo da por consecuencia aceptada).
4. Primera corrida de `PB4`: `created_at + 90` pasó hace meses, relee, `cubierto` falso, archiva.
5. Primera corrida del hard delete: `created_at + 180` pasó, relee, `cubierto` falso, **borra el
   contenido**. Los tres avisos de retención (antes del 90, al archivar, antes del 180) se cuentan
   sobre la misma columna y caen en el pasado.
6. Cuando el owner lo llama y Pedro contrata, `PB7` le devuelve una ficha vacía.

Aunque el valor sembrado fuera el instante del corte, el mismo §2.4 sólo cubre la demora de la
llamada **hasta el día 90**; si la agenda de llamados pasa del día 180, el borrado llega igual.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:284` §2.5:

> **`inactiva_desde` no es anulable**: una ficha nace con el instante de su creación, que es el hecho 1

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:146-147` §2.4:

> del lado de verticales **no se escribe ninguna fila**, así que *«el sistema nuevo no hereda una
> sola fila»* sigue siendo literal acá.

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:123-126` §2.4:

> **Y vuelve sola aunque la llamada tarde.** El procedimiento depende de que alguien llame, así que
> puede pasarse del día 90: ahí `PB4` archiva la ficha y la que la devuelve ya no es `PB3` sino
> **`PB7`**

(no hay frase equivalente para el día 180, y `PB7` no devuelve contenido borrado).

**Relación con `DEC-MIG-004`.** Esa decisión retiró el defecto #7 así:

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:2789`:

> | **7** | la entidad `listing` no tiene camino declarado al modelo nuevo | no lo necesita: no se transcribe ninguna |

La razón («no se transcribe ninguna») contradice el propio §2.4 y a `DEC-MIG-003`
(`01-decision-log.md:2536-2537`: *«se avisa antes, se los llama, contratan, y la ficha vuelve
sola»*): **la ficha sobrevive al corte**, así que su fila existe en el modelo nuevo y alguien tiene
que sembrarle el reloj. No reabro la política de la llamada; señalo que la llamada **no puede
arreglar** lo que este paso rompe, porque lo rompe antes de que suene el teléfono y de forma
irreversible.

**Severidad**: `CRITICA`. Pérdida irreversible del contenido de clientes reales en el acto del
corte, con el valor más literal que el texto ofrece.

**Necesita decisión del owner**: **sí**, pero chica: confirmar que el retiro del #7 no alcanza a la
siembra del reloj. La corrección en sí (declarar `inactiva_desde := instante del corte` y el día 180
como límite de la agenda de llamados) es de diseño.

---

## ALTA

### F-8CA3-003 — El `UNIQUE` del hash del correo vuelve imposible la escritura de `T6`: quien vuelve y paga no puede publicar

**Qué se rompe.** Una persona que borró su cuenta y vuelve con el mismo correo **paga** una
suscripción y no puede publicar: la fila que `T6` tiene que escribir choca con el `UNIQUE` del hash.
El diseño no dice qué pasa con esa violación.

**El camino.**

1. Ana usó su trial de Alojamiento en 2027 y después pidió borrar su cuenta. Su fila de `trial`
   sobrevive con `hash(ana@…)` (`V/02` §4.2 regla 2).
2. En 2028 se registra de nuevo con el mismo correo. `user_id` nuevo, `PRE_TRIAL`, sin fila.
3. Contrata un plan antes de publicar: `cubierto` verdadero.
4. Publica. Dispara `T6`, que **escribe la fila de `trial` ya consumida**. La fila lleva
   `hash(ana@…)` y la vertical Alojamiento, que ya existen: **violación de `UNIQUE`**.
5. Si `PB1` y `T6` van en la misma transacción, la publicación falla siempre. Si no, la ficha se
   publica y Ana queda sin fila de `trial`, en `PRE_TRIAL` para siempre: el día que cancele,
   `T1` intenta de nuevo el mismo `INSERT`.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:267`:

> **`UNIQUE(hash_del_correo_normalizado, vertical)`**, sin condición de estado.

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:247-249`:

> `T6` cierra el caso escribiendo la fila **ya consumida**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:265`:

> **`T1` crea la fila, y por eso `PRE_TRIAL` no la tiene.**

El `UNIQUE` se pensó para **negar** un trial y se aplica también a la escritura que **registra** uno
ya consumido. Ninguna máquina tiene un destino para *«el hash ya consumió»*: el único efecto
declarado es el rechazo de la base. Rastrillé `hash` en `V/03`, `V/11`, `V/17` y `V/20`: la
restricción sólo aparece mencionada, sin rama de conflicto.

**Severidad**: `ALTA`. Operación principal (publicar) inejecutable para una persona que pagó; la
población es acotada (cuentas borradas que vuelven) y se puede destrabar a mano.

**Necesita decisión del owner**: **no**. Falta declarar la rama: `T1`/`T6` sobre un hash ya
consumido (el trial no se otorga, la publicación sigue).

---

### F-8CA3-004 — O los actos de edición no están en el registro de eventos, o el registro guarda el contenido que el día 180 promete borrar

**Qué se rompe.** El hecho 1 del reloj (editar, exportar) dice leerse del registro append-only de
eventos, pero el criterio de qué es auditable **no incluye** editar ni exportar. Hay dos lecturas y
las dos rompen algo:

- **Si no se registran**, el hecho 1 no tiene la fuente que se declara.
- **Si se registran** con el campo obligatorio *«qué cambió, con su valor anterior y el nuevo»*, el
  texto de la ficha queda copiado en un registro **sin `delete`**, y el hard delete del día 180 no
  borra nada. La anonimización sólo alcanza *«nombre, correo, teléfono, dirección»*.

**El camino (la segunda lectura).**

1. Laura edita la descripción de su ficha: el evento guarda `descripcion: "<texto viejo>" → "<texto nuevo>"`.
2. Laura deja de pagar; al día 180 el hard delete borra el contenido publicable de la ficha.
3. El registro append-only conserva las dos versiones del texto, para siempre. Si Laura pidió la
   supresión, sus textos siguen en la base.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:54`:

> | 1 | un **acto del dueño** sobre la ficha: crearla, editarla, publicarla, despublicarla, exportarla,
> reactivarla | el registro append-only de eventos de dominio (cap. 08 §1.3), que ya los guarda todos
> por el criterio 2 del §1.1 |

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:40-41` §1.1:

> 2. **cambia el acceso de alguien** — cualquier transición de las máquinas del capítulo 03, un
>    grant, una cortesía, un cambio de plan;

(editar y exportar no son transiciones).

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:57` §1.2:

> | **qué cambió** | los campos que cambiaron, con su valor anterior y el nuevo — **no una copia del contenido** |

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:66`:

> **Append-only: sin `update` y sin `delete`.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:443`:

> | **Se anonimiza** al día 180 | los datos personales que hayan quedado **dentro** de un evento de
> dominio o de un registro de outbox: nombre, correo, teléfono, dirección |

Para un campo de texto, *«el valor anterior y el nuevo»* **es** una copia del contenido: la
excepción del §1.2 no se puede cumplir sobre ese tipo de campo.

**Severidad**: `ALTA`. Según cómo se implemente, o el reloj pierde una fuente, o la promesa del §25
(y un pedido de supresión) queda incumplida sin que nada lo muestre.

**Necesita decisión del owner**: **no**. Hay que declarar si los actos del hecho 1 son eventos y, si
lo son, qué guardan de un campo de texto (sólo el nombre del campo, sin valor).

---

### F-8CA3-005 — Al abogado se le pregunta por un hash «irreversible» que no lo es, y la otra respuesta sí cambia el mecanismo

**Qué se rompe.** La pregunta legal 5 lleva una premisa técnica falsa. Un hash **determinístico**
del correo normalizado (tiene que serlo, porque hay un `UNIQUE` sobre él) reconoce a una persona
concreta a partir de su correo: **ésa es su función**. Si el abogado contesta «sí» creyendo que el
dato no se puede asociar a nadie, el diseño conserva un identificador personal después de un pedido
de supresión apoyado en una respuesta dada sobre otro hecho.

**El camino.**

1. El pliego describe el hash como algo que *«no se puede leer de vuelta»* y sin *«nada que
   anonimizar»*.
2. Cualquiera con acceso a la base y un correo candidato (el de un reclamo, una lista, la tabla de
   usuarios de otro sistema) calcula el hash y confirma si esa persona tuvo trial y en qué vertical.
3. La respuesta legal se da sobre la premisa 1 y se aplica sobre el hecho 2.

Y la rama contraria no es gratis como dice el pliego: si **no** se puede conservar, hay que borrar
el hash de una fila que el modelo declara *«íntegra, siempre»*. Eso es un escritor nuevo sobre esa
fila, una columna anulable y un `UNIQUE` que deja de bloquear para esa persona.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:75-76` §3.2:

> | **sirve para lo único que tiene que servir** | comparar un candidato contra lo consumido. […]
> | **sobrevive a la anonimización** | no hay nada que anonimizar: no se puede leer de vuelta |

(la primera fila describe exactamente cómo re-identificar; la segunda dice que no se puede).

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:92-96` §3.3:

> - **si no se puede** — **el trial de por vida deja de ser sostenible tras un borrado** […] y **no
>   cambiaría ningún mecanismo**, sólo lo que se promete.

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:444`:

> | **Se conserva íntegro, siempre** | **la fila de `trial`** — que guarda **un hash irreversible del
> correo normalizado, no el correo** |

**Severidad**: `ALTA`. Es el gate legal de la parte de observación (`M-LEGAL-02`) y está planteado
de forma que puede habilitar una retención que no corresponde.

**Necesita decisión del owner**: **no**. Es corregir la redacción del pliego (decir «seudónimo
determinístico que reconoce a quien vuelve con el mismo correo») y la columna de consecuencias.

---

### F-8CA3-006 — La presencia de Partner no tiene entidad, ni máquina, ni reloj: si Gold deja de pagar, la página sigue arriba

**Qué se rompe.** La presencia de Partner Gold es por definición **otra entidad** que la ficha. El
modelo de datos no la declara, ninguna máquina la despublica al perder cobertura (`PB2` es de la
ficha) y la retención *«idéntica a cualquier otra vertical»* no tiene columna sobre la cual correr.
Los dos capítulos que podrían declararla se remiten el uno al otro.

**El camino.**

1. Un partner contrata Gold y publica su presencia.
2. Deja de pagar: la suscripción pasa a `SUSPENDED` y `cubierto` es falso.
3. `PB2` baja **fichas**; la presencia no es una ficha y no tiene transición equivalente. Sigue
   pública, con el beneficio comercial de Gold, sin cobertura.
4. Nunca entra en el reloj del §25: no tiene `inactiva_desde`.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:47`:

> | **Presencia de Partner** | […] El §17.1 ordena **no** forzarla al modelo `Ficha` pese al
> parecido, así que es una entidad distinta con su propio ciclo de publicación. |

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/18-partner.md:186-187`:

> - **El ciclo de publicación de la presencia** es del capítulo 19

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:79-81`:

> - **El ciclo de publicación de la presencia de Partner** (cap. 18, épica de verticales): […] cómo
>   se publica es diseño de producto, no de billing.

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/18-partner.md:172-176`:

> la conciliación, la auditoría, el outbox y la retención **son idénticos a los de cualquier otra
> vertical**

`V/02` §2.5 declara una sola entidad publicable (`listing`, línea 284) y `V/03` §9 es *«la máquina de
la ficha»* (línea 287). Rastrillé «presencia» en las dos épicas y el núcleo: ninguna tabla, ninguna
transición.

**Severidad**: `ALTA`. Beneficio comercial sin pago, sin fecha de fin; hoy Partner tiene 0 filas
(`07-facts-inventory.md:110`), así que no hay plata perdida todavía.

**Necesita decisión del owner**: **no** para declarar la entidad y su `PB2`; el ciclo de producto
de la presencia sí puede necesitarla.

---

### F-8CA3-007 — Los cobros que el sistema viejo empieza a tener no tienen dónde conservarse, y la limpieza de FASE 5 se los lleva

**Qué se rompe.** El diseño declara que no hay pagos que conservar, pero ese dato **caduca por
diseño**: el primer cobro de la historia ocurre bajo el sistema actual el 2026-09-26, y las altas de
`DEC-MIG-002` son todas con tarjeta. La conservación legal de pagos se declara **sólo para la tabla
nueva**; las tablas viejas no tienen destino, y el filtro 1 de FASE 5 elimina lo que opera sobre
sujetos que no sobreviven (`product_domain`, qzpay).

**El camino.**

1. El 2026-09-26 MercadoPago cobra el primer ciclo de una de las tres `trialing`, bajo el sistema
   actual (fila en `billing_payments`).
2. Mientras dura el rediseño entran altas nuevas (`DEC-MIG-002`), todas cobradas.
3. Corte: se cancelan las suscripciones y se escribe la lápida (sin pagos). El sistema nuevo arranca
   con `payment` vacío.
4. FASE 5 retira el código (y con él el esquema) de lo que cuelga de qzpay.
5. Un contracargo, un reclamo o una inspección pide el comprobante de ese cobro: no está en el
   modelo nuevo y el viejo se retiró.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:62-63` §1.3:

> esta medición vale mientras el hecho no cambie, y **este hecho cambia solo** — el 2026-09-26 (§3).

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:213`:

> - **Los pagos**: no hay ninguno.

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:917`:

> | **Se conserva íntegro, siempre** | pagos, reembolsos, comprobantes, el vínculo con el proveedor |
> los cuatro primeros son obligación legal y contable |

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:2606-2608` (`DEC-METH-007`):

> **Filtro 1 — POR SUJETO**: sobrevive el código **cuyo sujeto sobrevive**. […] Si el diseño elimina
> `product_domain`, todo lo que opera sobre `product_domain` se va, **sea bueno o malo**.

**Distinción con `DEC-MIG-004` #17.** Ese retiro (`01-decision-log.md:2792`) dice que *«si alguien
pagó un período, se le resuelve hablando»*: responde qué se le debe **al cliente**. No responde qué
pasa con **el registro** del cobro, que es una obligación con terceros y no se resuelve por teléfono.

**Severidad**: `ALTA`. Pérdida de registros de pago que el propio diseño llama obligación legal;
la población es chica y se puede resolver con una exportación manual si alguien se acuerda.

**Necesita decisión del owner**: **no**. Falta declarar en el corte que las tablas de cobro viejas
quedan en solo lectura (o se exportan) con la misma retención que `payment`.

---

## MEDIA

### F-8CA3-008 — «La fila de `trial` no se borra nunca» figura como restricción de base, y ninguna restricción la sostiene frente al borrado de la cuenta

**Qué se rompe.** El §5 pone el invariante 2 entre los que *«la base puede hacer cumplir sola»*,
pero no hay constraint que impida un `DELETE`, y la FK a `user` no tiene comportamiento declarado.
Hoy `accommodations.owner_id` es `onDelete: 'restrict'`
(`packages/db/src/schemas/accommodation/accommodation.dbschema.ts:134-136`). Con `cascade` el borrado
de la cuenta se lleva la fila de `trial` (se cae el §10.2); con `restrict` la cuenta no se puede
borrar (se cae la supresión); con `set null` la fila no *«conserva el `user`»*.

**El camino.** 1) Carla pide borrar su cuenta. 2) El implementador eligió `ON DELETE CASCADE` porque
nada dice lo contrario. 3) La fila de `trial` desaparece con la cuenta, y con ella el hash. 4) Carla
se registra de nuevo con el mismo correo y tiene otro trial.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:526`:

> | 2 · borrar ficha no devuelve trial | la fila de `trial` no se borra nunca (§4.1) |

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:457-459` §4.2:

> 2. **La fila de `trial` sobrevive al borrado de la cuenta.** […] Conserva el `user + vertical`, las
>    fechas y **el hash del correo normalizado**

**Severidad**: `MEDIA`. Dos implementadores lo resuelven distinto y una de las opciones reabre el
segundo trial.

**Necesita decisión del owner**: **no**.

---

### F-8CA3-009 — El día 180 es de una ficha y lo que borra y anonimiza es de la persona

**Qué se rompe.** El disparador del día 180 es por `listing`, pero la lista incluye datos **de la
cuenta**: *«las preferencias de la cuenta»* y *«las señales de identidad»* se borran, y los datos
personales dentro de eventos y outbox se anonimizan. Nada dice de qué eventos. Un dueño con dos
fichas, una archivada y otra paga y publicada, pierde las preferencias de la cuenta y (según la
lectura) ve anonimizados los eventos de su suscripción viva, incluido el aviso de aumento que
`NUCLEO/08` §1.3 quiere poder **demostrar** con destinatario. Al revés, los datos personales de la
fila de `user` no aparecen en ninguno de los tres renglones.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:442-443`:

> | **Se borra** al día 180 | el contenido publicable de la ficha (textos, fotos, FAQ, horarios), los
> borradores, las preferencias de la cuenta y las señales de identidad no bloqueantes […]
> | **Se anonimiza** al día 180 | los datos personales que hayan quedado **dentro** de un evento de
> dominio o de un registro de outbox […]

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:66-68`:

> el §29 tiene que poder **demostrar** que se avisó un aumento con su precio anterior, su precio
> nuevo y su fecha efectiva

**Severidad**: `MEDIA`. Ambigüedad de alcance con consecuencia en datos de clientes activos y en la
prueba del §29.

**Necesita decisión del owner**: **no**.

---

### F-8CA3-010 — El piso del trinquete de un ancla no está atado al plan de esa ancla: el cruce entre verticales vuelve por la segunda columna

**Qué se rompe.** `permanent_grant_vertical` protege con la base que **el plan** pertenece a la
vertical del ancla, y declara *«no anulable»* para el piso sin exigir que el piso sea una versión
**de ese plan**. Un piso sembrado con la versión premium de Gastronomía sobre un ancla de Alojamiento
hace que el trinquete compare y conserve claves de otra vertical, que es el cruce que el mismo § dice
cerrar. Además, *«el plan pertenece a esa vertical»* sólo es expresable como FK compuesta sobre
`plan(id, vertical)`, y `V/02` §2.1 no declara esa unicidad: la restricción de billing depende de
una de verticales que nadie escribió.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:417`:

> **`UNIQUE(permanent_grant_id, vertical)`**; el plan **no es anulable** y **pertenece a esa
> vertical**; el piso tampoco es anulable.

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:611-613`:

> **Hay un piso por ancla y se compara contra el plan de su propia vertical**: uno solo para N
> verticales compararía las claves de una contra lo que otorgaba el plan de otra.

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:43` (restricciones
de `plan`: sólo `UNIQUE(vertical, slug)`).

**Severidad**: `MEDIA`. Requiere un error de siembra o de UI de admin, pero es exactamente la clase
de error que el § declara que la base tiene que impedir. `G-R2-B` (`V/20:58`) mira la fuente
`GRANT`, no el piso.

**Necesita decisión del owner**: **no**.

---

### F-8CA3-011 — `addon_version` no tiene de qué ser versión

**Qué se rompe.** El catálogo de planes tiene `plan ──< plan_version`; el de addons tiene
`addon_version` suelta, sin entidad madre. La única relación es `addon_product.version_id`, del lado
de billing. Entonces: *«publicar una versión nueva de un `addon_version`»* (disparador de
invalidación) no tiene sujeto; nada impide que un producto se re-apunte a una versión que otorga
otra cosa por completo; y dos productos pueden compartir versión. El linaje que la inmutabilidad
promete no está en ninguna tabla.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:36-38`:

```text
addon_version ──┬──< addon_version_entitlement
                └──< addon_version_limit
```

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:386`:

> | **se publica una versión nueva de un `addon_version`** | es lo que otorga el addon […] |

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:411`:

> más **`version_id`** → `addon_version` (épica de verticales), que es **la versión que se vende hoy**

**Severidad**: `MEDIA`. Dos implementadores modelan el linaje distinto, y la invalidación del caché
(que el propio capítulo llama de seguridad) depende de ese linaje.

**Necesita decisión del owner**: **no**.

---

### F-8CA3-012 — «Qué se pierde» se midió sobre un subconjunto: las consultas excluyen lo borrado y no cuentan addons ni concesiones

**Qué se rompe.** La afirmación *«el trial ya consumido de seis personas»* y *«el sistema nuevo no
hereda una sola fila»* descansan en consultas que filtran `deleted_at IS NULL` sobre
`billing_subscriptions` y que nunca contaron compras de addons, canjes de promo, grants de destaque
(`featured_listing_addon_grants`) ni `entity_subscriptions`. Una suscripción con trial que fue
soft-deleted es un trial consumido que no está en la cuenta, y una compra de addon es algo vivo que
el corte no nombra.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/07-facts-inventory.md:138`:

> FROM billing_subscriptions WHERE deleted_at IS NULL GROUP BY 1,2,3 ORDER BY 1,2,3;

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:64-65`:

> - **El «trial ya consumido» de seis personas** —las tres `abandoned` y las tres `trialing`—, que
>   sin migrarlo **podrían repetir trial**.

El esquema actual tiene las tablas que no se contaron:
`packages/db/src/schemas/billing/billing_addon_purchase.dbschema.ts`,
`featured_listing_addon_grant.dbschema.ts`, `entity_subscription.dbschema.ts`.

**Severidad**: `MEDIA`. Puede no cambiar nada (payments = 0 sugiere pocas compras), pero la cifra
que decide *«no migrar»* y el umbral de ~20 se apoyan en una medición que no mira todo lo que el
corte descarta.

**Necesita decisión del owner**: **no**. Se agrega a la re-verificación que `B/21` §1.3 ya exige.

---

## BAJA

### F-8CA3-013 — `DEC-MIG-002` sigue diciendo «se transcriben a mano» y no está marcada como superada

**Qué se rompe.** `DEC-MIG-003` decide que no se transcribe nada y `DEC-MIG-004` #16 trata a las
altas nuevas por teléfono, pero `DEC-MIG-002` sigue `ACCEPTED` con la transcripción como decisión y
remite a un procedimiento (§2.3 de `DEC-MIG-001`) que dejó de existir. Un lector de esa entrada
implementa lo contrario.

**Dónde.**

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:2239-2241`:

> - **Decisión**: **(1)**. Se siguen tomando altas en el sistema actual, y **se transcriben a mano
>   cuando el rediseño esté listo**, con el mismo procedimiento del §2.3 que `DEC-MIG-001` fijó

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:2499` (sólo supersede a `DEC-MIG-001`).

**Severidad**: `BAJA`. Registro.

**Necesita decisión del owner**: **no**.

---

## Ataques que intenté y el diseño resistió

- **Referencia de una fuente `ADDON` apuntando al producto (y moviendo a todos los compradores al
  publicar).** Cerrado: la instancia ancla la versión y el contrato transporta esa
  (`12-contrato…:154`, `B/02:412`, `B/02:435`).
- **Dos grants vivos para la misma persona.** Lo impide la base:
  `UNIQUE(beneficiario) WHERE revocado_en IS NULL` (`B/02:416`).
- **Segundo trial por re-registro con otro `user_id`.** Cerrado por `UNIQUE(hash, vertical)`
  (`V/02:267`), con el costo que describe F-8CA3-003.
- **Un addon de scope `LISTING` sobre Partner.** Es dato del producto, no rama de código
  (`V/18:62-66`).
- **Datos de Gastronomía/Experiencia/Partner que el corte pierda.** 0·0·0 medidos
  (`07-facts-inventory.md:108-110`), y la caducidad por las altas nuevas está cubierta por
  `DEC-MIG-004` #16.
- **Estados actuales de `accommodations` sin mapeo** (`lifecycle_state`, `moderation_state`,
  `owner_suspended`, `plan_restricted`, `billing_unpublished_at`). Es el #7 que `DEC-MIG-004` retiró
  con causa. No lo repito; sólo la siembra del reloj (F-8CA3-002) no está alcanzada por esa causa.
- **El valor anterior y el nuevo en la auditoría de un cambio de precio.** Es número, no contenido
  personal, y sobrevive a la anonimización (`NUCLEO/08:71-73`).

## Fuera de mi vector

- `PB4` sale también de `PUBLISHED` y, sobre una ficha cubierta, **escribe** el reloj cada 90 días
  (`V/03:296`, `V/03:319-320`): es el escritor que hace que la columna nunca esté más atrasada que 90
  días. Si alguien «simplifica» `PB4` para que sólo mire `UNPUBLISHED_BY_BILLING`, F-8CA3-001 empeora
  sin techo. Le toca a quien revise las máquinas de verticales.
- La lápida (`B/21:156-157`) es una `subscription` `CANCELLED` sin transición que la produzca; el
  propio § lo reconoce (`B/21:181-185`). Le toca al vector de conciliación.

## Key Learnings

1. Una columna de reloj que **no se escribe en el instante en que el reloj empieza** no mide ese
   intervalo: mide desde el último reinicio. Un invariante de la forma `tope < plazo` sobre esa
   columna tiene que sumar el atraso máximo de la columna, o verifica otra cosa.
2. El diseño ya había encontrado este defecto para la discontinuación (glosario §1.2, *«hasta 90
   días antes»*) y le dio escritor propio sólo a ese caso. Buscar el mismo mecanismo en los casos
   hermanos (pausa, suspensión, cancelación) fue lo que lo destapó.
3. «No se transcribe ninguna fila» no implica «no hay que sembrar ninguna columna»: una fila que
   sobrevive al corte (la ficha) necesita valores nuevos, y el valor literal de la regla puede ser
   el que borra.
4. Un `UNIQUE` pensado para **negar** algo también rechaza la escritura que **registra** ese algo
   como ya ocurrido: hay que revisar cada `INSERT` que la restricción alcanza, no sólo el que motivó
   ponerla.
5. «Valor anterior y nuevo» en un registro append-only es una copia del contenido cuando el campo es
   texto; la retención tiene que decir qué se guarda de cada tipo de campo.
6. Las mediciones de producción que sostienen «no migrar» filtraban `deleted_at IS NULL` y no
   contaban addons ni concesiones: cuando una cifra decide no hacer nada, hay que mirar qué dejó
   afuera la consulta.

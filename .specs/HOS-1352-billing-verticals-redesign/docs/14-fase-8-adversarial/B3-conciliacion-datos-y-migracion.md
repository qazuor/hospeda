---
title: "FASE 8 · B3 — conciliación, datos, migración y acoplamiento"
linear: HOS-1354
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 8
---

# FASE 8 · B3 — conciliación, datos, migración y acoplamiento

Pasada adversarial B3 sobre la épica **HOS-1354**. Vector: el mecanismo de conciliación, la
pérdida de datos, el plan de migración, los huecos entre capítulos y el acoplamiento no
declarado — incluido si el modelo del capítulo 02 alcanza para lo que los otros capítulos
dicen que el sistema hace.

Se leyeron los 7 capítulos del núcleo, los 12 escritos de HOS-1354, la partición, el contrato
de cobertura, las 89 filas de la matriz de validación y los huecos ya declarados. Nada de lo
que ya figura como abierto en `04-open-decisions.md` se reporta como hallazgo nuevo.

**19 hallazgos**: 8 `CRITICA`, 8 `ALTA`, 2 `MEDIA`, 1 `BAJA`. Ordenados por severidad.

---

## Hallazgos

### F-8B3-001 — El `UNIQUE` de suscripción viva vuelve imposible el cambio de plan y de ciclo

**Qué se rompe.** El único camino que el diseño tiene para cambiar de ciclo o de plan
—cancelar y recrear— no se puede ejecutar: la base rechaza la fila nueva mientras la vieja
sigue viva, y el diseño exige que siga viva hasta que la nueva quede autorizada.

**El camino.**

1. Un cliente mensual de Alojamiento pide pasar a anual. `DEC-SUB-006` manda cancelar y
   recrear, porque está medido que mutar `frequency` sobre una viva no aplica (`EX-4`).
2. Para no dejarlo sin nada si abandona el checkout, `D7` prohíbe cancelar la vieja antes de
   recibir el webhook de que la nueva quedó autorizada. Entonces la vieja sigue `ACTIVE`.
3. Se intenta crear la nueva. Nace en `PENDING_AUTHORIZATION`, que está en la lista de estados
   vivos, y la restricción parcial de unicidad la rechaza.
4. La transición S1 lleva además la misma condición como precondición de servicio, así que
   tampoco hay un camino que esquive la base: el diseño se bloquea a sí mismo dos veces.
5. Resultado: ningún cliente puede cambiar de ciclo ni de plan por el camino que el capítulo
   06 declara como el único disponible. Lo mismo alcanza a `DEC-SUB-007` (upgrade).

**Dónde lo permite el diseño.**

`HOS-1354/docs/02-modelo-de-datos.md` §2.2: *«**`UNIQUE(user_id, vertical) WHERE clase =
principal AND estado ∈ {vivos}`** — es el §11, **impuesto por la base y no por un chequeo**»*,
y a continuación *«Los «vivos» de la restricción del §11 son: `PENDING_AUTHORIZATION`,
`ACTIVE`, `GRACE_PERIOD`, `PAUSED`, `SUSPENDED` y `CANCEL_SCHEDULED`»*.

`nucleo/04-invariantes.md` §3, `D7`: *«**La suscripción vieja se cancela sólo al recibir el
webhook de que la nueva quedó autorizada** (`DEC-SUB-006`) · servicio; al revés, el cliente que
abandona el checkout se queda sin nada»*.

`HOS-1354/docs/03-maquinas-de-estado.md` §3.2, S1: condición *«no hay otra viva para ese
`user + vertical`»*.

**Severidad.** `CRITICA` — obliga a rediseñar: o la restricción cambia de forma (p. ej.
excluyendo `PENDING_AUTHORIZATION`, con el costo de admitir dos pendientes), o `D7` cae, o
aparece un concepto de «reemplazo» que hoy no existe en el modelo.

**Necesita decisión del owner.** Sí. Las tres salidas tienen costo distinto y una de ellas
debilita el §11, que es un invariante del §64.

---

### F-8B3-002 — El candado contra el único doble cobro real no se puede construir

**Qué se rompe.** El capítulo 05 lleva a la base el único de los seis cruces que mueve dinero
real, con un `UNIQUE` que el modelo del capítulo 02 no puede expresar: la columna que la clave
necesita no existe, y las dos filas que tiene que comparar viven en dos tablas distintas.

**El camino.**

1. Un anfitrión avisa que pagó por transferencia. Un admin abre el registro manual.
2. En paralelo, el cobro del proveedor —que llega con retraso variable, medido entre ~100 s y
   ~33 min— se acredita para ese mismo período.
3. La defensa declarada es `UNIQUE(subscription_id, período) WHERE el pago está acreditado`.
   Pero `payment` guarda *suscripción, monto, moneda, estado, id del hecho en el proveedor,
   fecha del hecho y monto reembolsado acumulado*: **no hay columna de período**, y la fecha
   del hecho no lo determina —el cobro del ciclo llega tarde y por adelantado—.
4. Y aunque existiera, el registro manual no es una fila de `payment` sino de `manual_payment`,
   otra tabla. **Una restricción de unicidad no abarca dos tablas.**
5. Queda sólo la relectura previa, que el propio capítulo 05 describe como *«para que el admin
   entienda»* y no como la red. Sin la red, el doble cobro con dinero real entra por la ventana
   de la carrera, que es exactamente lo que el cruce venía a cerrar.

**Dónde lo permite el diseño.**

`HOS-1354/docs/05-idempotencia-y-concurrencia.md` §2, C5: *«Es el único de los seis que produce
un doble cobro con dinero real, y por eso es el único que se lleva a la base:
**`UNIQUE(subscription_id, período) WHERE el pago está acreditado`**. (…) La restricción es la
red; la relectura es para que el admin entienda lo que pasó en vez de ver un error»*.

`HOS-1354/docs/02-modelo-de-datos.md` §2.3: *«**`payment`** | suscripción, monto, moneda, estado
del cap. 03 §6, **id del hecho en el proveedor**, fecha del hecho, monto reembolsado acumulado»*
y, como fila aparte, *«**`manual_payment`** | suscripción, estado del cap. 03 §7, quién lo
registró, cuándo, comprobante»*. El §5 del mismo capítulo, que lista lo que la base sostiene
sola, **no incluye esta restricción**.

**Severidad.** `CRITICA` — pérdida de plata del cliente, y el mecanismo declarado no existe.

**Necesita decisión del owner.** No en cuanto al problema; sí si la salida es unificar
`payment` y `manual_payment` en una sola tabla con método de pago, porque eso cambia el modelo.

---

### F-8B3-003 — El cobro de única vez de un addon no tiene fila posible

**Qué se rompe.** El camino que el propio PDR recomienda —plan barato más addon— no se puede
registrar: un addon de cobro `UNA_VEZ` no tiene suscripción propia, y `payment` cuelga de una
suscripción. O la plata queda sin fila, o se cuelga de la principal y colisiona con el candado
del hallazgo anterior.

**El camino.**

1. Alguien con plan Basic compra *+5 fichas*: cobro `UNA_VEZ`, vigencia
   `MIENTRAS_VIVA_LA_SUSCRIPCIÓN`. Por `DEC-ADDON-002` sólo los `PERIÓDICO` tienen preapproval
   propio, así que este addon **no tiene suscripción de complemento**.
2. El cobro entra. Hay que escribir un `payment`, y `payment` guarda *suscripción*.
3. Si se cuelga de la principal: el período en curso ya tiene un pago acreditado —el del
   ciclo—, así que el `UNIQUE` de C5 rechaza la fila del addon. La plata entró y no se registra.
4. Si no se cuelga de nada: la fila queda huérfana, el `receipt` —que cuelga de `pago`— no se
   puede emitir contra nada, y el §54 obliga a emitir comprobante por cada cobro.
5. En los dos desenlaces se pierde el rastro de un cobro real, que es la definición de pérdida
   de plata de este vector.

**Dónde lo permite el diseño.**

`HOS-1354/docs/16-addons.md` §1.3: la casilla `UNA_VEZ` × `MIENTRAS_VIVA_LA_SUSCRIPCIÓN`
—*«✅ *+5 fichas**»*— y §1.2: *«**cobro** | `UNA_VEZ` · `PERIÓDICO` | si hay una **suscripción
de complemento** detrás (`DEC-ADDON-002`)»*.

`HOS-1354/docs/03-maquinas-de-estado.md` §8, A2: *«recurrente: su propio preapproval
(`DEC-ADDON-002`). **De única vez: su propio cobro**»*.

`HOS-1354/docs/02-modelo-de-datos.md` §2.3: `payment` guarda *«suscripción, monto…»*;
`receipt` guarda *«pago, número, PDF»* con *«`UNIQUE(numero)`, sin huecos»*.

**Severidad.** `CRITICA` — un cobro real sin fila, o sin comprobante obligatorio.

**Necesita decisión del owner.** No. Es un hueco de modelo; la forma de cerrarlo es diseño.

---

### F-8B3-004 — El precio efectivo no vive en ninguna tabla, y la conciliación lo compara igual

**Qué se rompe.** El barrido diario compara *monto vigente* contra `transaction_amount` del
proveedor. Ese «monto vigente» no está guardado en ningún lado: hay que recomputarlo, y
recomputarlo mal en la misma dirección en que se computó al mutar hace que el barrido **valide
un error en vez de encontrarlo**. Es el único caso que el diseño declara sin ninguna otra vía
de aviso.

**El camino.**

1. Un cliente tiene una promo porcentual de 20 % por 3 cobros sobre un plan de ARS 10.000. Al
   contratar se muta el monto del preapproval a 8.000.
2. `subscription` guarda *«versión de plan anclada, billing option, estado, período actual,
   fecha de fin de servicio, clase»*. No guarda monto. `promo_redemption` guarda *«código,
   user, cuándo, sobre qué suscripción»*. No guarda el monto resultante ni cuántos cobros
   quedan.
3. Al tercer cobro hay que restaurar el precio entero. Nadie sabe que iba en el tercero.
4. El barrido lee 8.000 del proveedor y tiene que decidir si eso es correcto. Para saberlo
   recompone: precio de `billing_option` de la versión anclada, más los porcentuales, más los
   fijos, más el piso de ARS 15. Si el contador ya debía estar en cero, el barrido recompone
   8.000 igual que la mutación original y **dice que todo coincide**.
5. Y al revés, si la recomposición difiere de lo que se mutó por cualquier motivo —un aumento
   de `DEC-MP-002` ya aplicado, un descuento que cayó bajo el piso y se ejecutó como pausa—, el
   barrido emite `RECONCILIATION_REQUIRED` sobre cartera sana, todos los días, hasta que alguien
   deje de mirar el listado. Las dos direcciones son caras y ninguna es detectable.

**Dónde lo permite el diseño.**

`HOS-1354/docs/09-conciliacion.md` §3: *«monto vigente | `transaction_amount` |
`RECONCILIATION_REQUIRED` — **es el caso que no avisa por ningún canal**»*.

`HOS-1354/docs/12-suscripcion.md` §3.2: *«`DEC-MP-002` fijó que **el precio vive en la
suscripción, no sólo en el plan** (implicación 2)»*. El decision log lo dice igual:
*«Durante la ventana conviven dos precios para el mismo plan, y lo que se cobra es el de la
suscripción»*.

`HOS-1354/docs/02-modelo-de-datos.md` §2.2 y §2.4: ni `subscription` ni `promo_redemption`
tienen columna de monto.

`HOS-1354/docs/14-promos-cortesias-y-grants.md` §2.2: *«el contador de **N cobros** | **sigue
donde estaba**»* — un contador que hay que persistir.

**Severidad.** `CRITICA` — el barrido es el único detector del caso que el proveedor no avisa
(`EX-15`), y sobre el dato que no tiene queda ciego o ruidoso.

**Necesita decisión del owner.** No.

---

### F-8B3-005 — La re-vinculación automática no tiene regla de emparejamiento

**Qué se rompe.** Lo único que la conciliación hace sin una persona es re-vincular una
huérfana. El capítulo no dice **con qué suscripción** se la vincula, y la justificación de que
sea automática —*«no cambia plata ni estado»*— sólo es cierta si el emparejamiento es correcto.
Un emparejamiento equivocado imputa cobros ajenos y sostiene a la persona equivocada.

**El camino.**

1. Llega un webhook de un preapproval que no resuelve a ninguna suscripción nuestra. Ése es el
   detector de huérfanas del §2.2, y es el error vivo que el §5 convierte en caso de uso.
2. El sistema debe decidir de quién es. Lo único disponible para identificar es lo que el
   capítulo 05 §1.2 nombró: **correo del pagador y estado**, porque el buscador ignora nuestra
   referencia (`RC-1`).
3. El correo del pagador en el proveedor puede no ser el de la cuenta: el pagador es quien puso
   la tarjeta, no necesariamente el titular. Dos cuentas del mismo correo, una cuenta que pagó
   con la tarjeta de otro, o un anfitrión con dos verticales, dan más de un candidato.
4. El sistema reescribe el `external_reference` apuntando a la suscripción equivocada. Está
   medido que se puede hacer sobre una viva (`EX-19`), así que no falla.
5. A partir de ahí, cada cobro de ese preapproval entra como pago de una suscripción que no es
   la suya: extiende el período de quien no pagó, y deja al que sí pagó en `GRACE_PERIOD` hasta
   `SUSPENDED`. **Y el barrido no lo encuentra**, porque el vínculo ahora existe y es
   consistente consigo mismo.

**Dónde lo permite el diseño.**

`HOS-1354/docs/09-conciliacion.md` §2.4: *«**Sólo se repara el vínculo automáticamente.**
Re-vincular una huérfana reescribiendo su `external_reference` **no cambia plata ni estado**:
sólo dice de quién es»*. El capítulo no define cómo se elige el destino.

`HOS-1354/docs/05-idempotencia-y-concurrencia.md` §1.2: *«La que sí la tiene es **«¿este pagador
tiene alguna suscripción autorizada que yo no tenga registrada?»**, por correo del pagador y
estado»*.

`nucleo/04-invariantes.md` §3, `D11`: *«**Lo que toca plata lo confirma una persona**»* — y esta
operación se declara exenta por no tocar plata.

**Severidad.** `CRITICA` — imputa cobros de una persona a otra, y el propio mecanismo de
detección queda cegado después del error.

**Necesita decisión del owner.** Sí, si la salida es que la re-vinculación deje de ser
automática: eso contradice la única excepción que el capítulo 09 se concedió.

---

### F-8B3-006 — La migración transcribe el trial y deja los tres compromisos de cobro sin vínculo

**Qué se rompe.** El capítulo 21 de billing manda transcribir las cinco relaciones vivas
«según §2.3». Ese §2.3 **no existe en ese capítulo**: vive en la otra épica y escribe una fila
de `trial`, nada más. Ninguna regla, en ninguna de las dos épicas, escribe el `provider_link`
de los tres preapprovals vivos — y sin esa fila la conciliación del sistema nuevo no los ve.

**El camino.**

1. Se termina FASE 10. Se transcriben a mano las cinco relaciones. La única regla escrita es la
   del trial: se escribe una fila de `trial` con la fecha de fin que ya tenía.
2. Las tres `trialing` son *«las únicas con vínculo vivo al proveedor de pagos en toda la
   base»*. Ese vínculo es un id de preapproval que hoy vive en una columna del sistema viejo.
3. Nada manda escribir `subscription` ni `provider_link` para ellas, y el capítulo 21 declara
   que **ninguna de las tres opciones del hueco hace falta para éstas**.
4. Llega el 2026-11-25. El proveedor cobra. El webhook entra por un preapproval desconocido.
5. Eso **es** el detector de huérfanas del capítulo 09 §2.2 funcionando — sobre un cliente que
   pagó, sin suscripción, sin versión de plan anclada, sin billing option y sin cobertura. Se
   le cobró y no tiene servicio, y el único camino automático que existe es el del hallazgo
   F-8B3-005, que necesita una suscripción destino que no se creó.
6. `DEC-MIG-002` (2026-09-19) decidió seguir tomando altas durante el rediseño, así que la
   cohorte sin regla de transcripción crece con cada alta nueva, cada una con su preapproval.

**Dónde lo permite el diseño.**

`HOS-1354/docs/21-migracion.md` §3.2(a): *«**Las cinco relaciones vivas.** No hay nada que parar
ni que coexistir: se coordinan a mano (`DEC-MIG-001`) y **se transcriben según §2.3**. Ninguna
de las tres opciones que el hueco planteaba (…) hace falta para éstas»*. El archivo salta de
§1.3 a §3: **no tiene §2**.

`HOS-1353/docs/21-migracion.md` §2.3, la regla completa: *«su trial **sigue corriendo** → una
fila de `trial` en `TRIAL_ACTIVE` con la fecha de fin que ya tenía»* / *«su trial **ya
terminó** → una fila de `trial` consumida»*. Dos filas, las dos de `trial`.

`HOS-1354/docs/09-conciliacion.md` §2.1: *«guardar ese id deja de ser una comodidad y pasa a ser
**la condición de que la conciliación exista**. Una suscripción cuyo id se pierde es invisible
para el barrido, y sólo reaparece si cobra y emite un webhook»*.

`HOS-1352/docs/07-facts-inventory.md`: *«Las tres `trialing` son las **únicas** con vínculo vivo
al proveedor de pagos en toda la base»*, con primer cobro el 2026-09-26, el 2026-11-25 y el
2026-11-30.

**Severidad.** `CRITICA` — el plan de migración deja el sistema en un estado que el diseño
nuevo declara imposible: plata cobrada contra una suscripción que no existe.

**Necesita decisión del owner.** No para escribir la regla que falta. Sí para el orden: el
capítulo 21 §3.2(b) sólo pone bajo vigilancia el cobro del 2026-09-26, y los otros dos caen en
fecha desconocida respecto de FASE 10.

---

### F-8B3-007 — El contrato de cobertura no puede transportar ni un addon ni un grant

**Qué se rompe.** Verticales resuelve el conjunto efectivo agregando addons, cortesías y
grants, que son entidades de billing. El contrato —lo único que cruza— tiene cuatro tipos de
fuente sin addon, y devuelve un puntero a versión de plan que un grant no tiene. Dos de los
instrumentos del §36 no caben por el único canal que existe.

**El camino.**

1. *Free Forever*: `SUPER_ADMIN` firma un grant. La transición S13 lleva la suscripción a
   `CANCELLED` — el beneficiario **no tiene suscripción**.
2. Verticales pregunta `cobertura(user, vertical)`. Billing tiene que responder una fuente de
   tipo `GRANT` con su `versiónDePlan`, porque ése es *«cómo verticales sabe qué otorga esa
   fuente»*.
3. `permanent_grant` guarda *«beneficiario, scope de verticales, `includesAddons`, quién lo
   firmó, motivo, suscripciones afectadas»*. **No guarda ninguna versión de plan**, y la
   suscripción que la tenía anclada está `CANCELLED`. El campo se responde con nada, o con el
   puntero de una suscripción muerta — que otorgaría exactamente lo que el cliente dejó de
   pagar, que no es lo que un grant significa.
4. Addons: el cliente compra *+30 fotos*. Verticales tiene que agregar `SUMA` sobre esa fuente.
   `tipo` sólo admite `TRIAL · SUSCRIPCIÓN · CORTESÍA · GRANT`: **no hay `ADDON`**. Y `cobertura`
   se invoca con `(user, vertical)`, mientras que un addon de scope `LISTING` alcanza **a una
   ficha**, granularidad que la firma no tiene.
5. Resultado: o verticales lee `addon_instance`, `courtesy_grant` y `permanent_grant`
   directamente —y entonces el corte no existe—, o los addons no otorgan nada, que es la
   funcionalidad central del §10.5.

**Dónde lo permite el diseño.**

`HOS-1352/docs/12-contrato-de-cobertura.md` §2 y §2.1: *«`fuentes`: [ { tipo, versiónDePlan,
hasta } ]»*, *«**`tipo`** | `TRIAL` · `SUSCRIPCIÓN` · `CORTESÍA` · `GRANT`»*, *«**`versiónDePlan`**
| **la referencia, no los valores** | el paso 6: es cómo verticales sabe qué otorga esa fuente»*,
y §4: *«**Nada más cruza la frontera.**»*

`HOS-1353/docs/02-modelo-de-datos.md` §3.1: *«Es lo caro: agregar versión de plan, herencia de
Turista VIP, **addons, cortesía y grant**, cada uno con su vigencia»*.

`HOS-1353/docs/15-entitlements-y-limits.md` §2.2: *«`SUMA` | suma todas las fuentes vivas |
fotos, fichas, destaques»*, con el ejemplo del §37 *«plan 20 fotos + addon 30 = 50»*.

`HOS-1354/docs/03-maquinas-de-estado.md` §3.2, S13: *«`SUPER_ADMIN` otorga *Free Forever* →
`CANCELLED` (…) el acceso pasa a darlo el grant»*.

**Severidad.** `CRITICA` — la frontera declarada no soporta dos de las cinco fuentes del §36, y
`DEC-ARCH-006` dice que ninguna épica puede mutar el contrato sola.

**Necesita decisión del owner.** Sí: ampliar el contrato toca `DEC-ARCH-006` y la definición
del corte de `DEC-ARCH-005`.

---

### F-8B3-008 — El preapproval huérfano de un addon cae justo donde el barrido no mira

**Qué se rompe.** El caso que el capítulo 16 llama *«el que no puede fallar»* —un débito
mensual a alguien que ya no es cliente— se declara detectable por el barrido, y el barrido está
escrito para saltear exactamente las filas donde ese caso vive.

**El camino.**

1. Un anfitrión con un addon recurrente borra su ficha. El addon queda huérfano y pasa a
   `CANCELLED` (A6). Su preapproval sigue vivo en el proveedor y sigue cobrando.
2. La cancelación en el proveedor se intenta «de inmediato», pero está medido que el proveedor
   acepta y no aplica en cinco de ocho operaciones, y que cancelar no emite nada que releer
   solo. Si no se aplicó, nadie se entera desde adentro.
3. El capítulo 16 dice que lo detecta el barrido del 09: *«un addon en estado terminal con su
   preapproval vivo es una discrepancia que el barrido ve»*.
4. El capítulo 09 barre *«por cada suscripción de nuestro inventario **que no esté en un estado
   terminal**»*, y declara que los terminales *«no pueden divergir hacia nada que nos importe»*.
5. La fila está en estado terminal. **No se barre.** El débito mensual a un ex-cliente sigue
   indefinidamente, sin webhook, sin barrido y sin reclamo hasta que la persona mira su
   resumen.

**Dónde lo permite el diseño.**

`HOS-1354/docs/16-addons.md` §4.3: *«**Falla hacia cobrar de más, y por eso es el que no puede
fallar.** (…) Lo que lo hace detectable es el barrido del capítulo 09, que compara contra
**nuestro** inventario (`DEC-CONC-002`): **un addon en estado terminal con su preapproval vivo
es una discrepancia que el barrido ve**»*.

`HOS-1354/docs/09-conciliacion.md` §3: *«Por cada suscripción de nuestro inventario **que no
esté en un estado terminal**»* y *«**Los estados terminales no se barren**: `CANCELLED` y
`ABANDONED` no pueden divergir hacia nada que nos importe, y barrerlos es gastar llamadas sobre
la parte de la cartera que más crece»*.

**Severidad.** `CRITICA` — plata que sale de la cuenta de una persona todos los meses, con la
defensa declarada apuntando a un barrido que la excluye por regla escrita.

**Necesita decisión del owner.** No. Es una contradicción entre dos capítulos; hay que elegir
cuál cede y el costo de barrer terminales está cuantificado en el propio §3.

---

### F-8B3-009 — Billing lee tablas de verticales, y dos de las columnas que lee no existen

**Qué se rompe.** El contrato declara una frontera de una sola dirección —billing le empuja un
hecho a verticales— y billing necesita leer, como mínimo, tres campos de `plan_version` y dos
de `vertical`, que son tablas de la otra épica. Dos de esos cinco campos no están declarados en
ningún modelo de datos, de ninguna de las dos épicas.

**El camino.**

1. Billing resuelve `puedePausar()` y los días de grace. Los dos salen de `plan_version`
   —*«días de grace, días de trial, si permite pausa»*—, que es una tabla de verticales.
2. Billing compone capacidades como intersección de proveedor, **versión de plan** y billing
   option. Lee `plan_version` otra vez.
3. El capítulo 10 de billing discontinúa una vertical, y declara que su situación se lee de
   *«dos datos con fecha sobre su propia fila —si admite altas, y su fecha de fin de
   servicio»*.
4. `vertical`, en el modelo de verticales, guarda *«el espejo en base del enum de código»*. No
   tiene ninguna de las dos columnas, y el modelo de billing no declara ninguna tabla
   `vertical`.
5. El listado del §48 tiene que mostrar *«las versiones de plan retiradas con cuántas
   suscripciones siguen ancladas»*: una consulta que une `plan_version` (verticales) con
   `subscription` (billing) y que ninguna de las dos épicas puede responder sola.
6. Consecuencia práctica: la sub-épica de billing no puede avanzar sin que alguien agregue
   columnas a tablas de la otra, y la regla de vigilancia del contrato —*«si aparece un quinto
   lugar (…) es señal de que el corte se está filtrando»*— ya se disparó cinco veces sin que
   nadie la haya mirado.

**Dónde lo permite el diseño.**

`HOS-1352/docs/12-contrato-de-cobertura.md` §4: *«**No cruzan** montos, precios, monedas,
ciclos, estados de pago, ids del proveedor, fechas de cobro, medios de pago, comprobantes ni
reembolsos»* — la lista es de lo que billing empuja; la dirección inversa no se declara.

`HOS-1352/docs/11-particion-del-programa.md` §2.1: *«`plan_version` | `rank`, vendible, días de
grace, días de trial, permite pausa, hereda Turista VIP | **VERTICALES**»* y *«`vertical` | el
espejo en base del enum de código | **VERTICALES**»*.

`HOS-1354/docs/06-proveedor.md` §7: *«`capacidades(suscripción) = capacidades del PROVEEDOR de
su método de pago ∩ lo que su **VERSIÓN DE PLAN** habilita ∩ lo que su BILLING OPTION admite`»*.

`HOS-1354/docs/10-verticales-planes-billing-options.md` §4.6: *«su situación se lee de **dos
datos con fecha** sobre su propia fila —si admite altas, y su fecha de fin de servicio—»*.

`HOS-1354/docs/19-superficies.md` §6: *«las **versiones de plan retiradas** con cuántas
suscripciones siguen ancladas»*.

**Severidad.** `ALTA` — se arregla dentro del diseño actual declarando la dirección
verticales → billing y agregando las dos columnas, pero hoy el capítulo 10 describe una
operación sobre datos inexistentes.

**Necesita decisión del owner.** No, salvo que ampliar el contrato en la otra dirección se
considere una mutación de `DEC-ARCH-006`.

---

### F-8B3-010 — El aumento programado no tiene entidad: no se sabe a quién falta aplicárselo

**Qué se rompe.** `DEC-MP-002` exige registrar a quién se le aplicó el aumento para que un
fallo parcial no deje media cartera migrada sin que se sepa cuál. Nada en el modelo guarda el
aumento pendiente, su fecha efectiva por cliente, ni si ya se aplicó — y esa fecha además se
mueve.

**El camino.**

1. Se anuncia un aumento. Cada cliente tiene **su** fecha efectiva, derivada de su ciclo. Salen
   tres avisos con esa fecha.
2. Un cliente pausa. Al reanudar, la fecha efectiva *«se corre hacia adelante, nunca hacia
   atrás»*, y si no se cumplieron los 60 días se espera al siguiente cobro. Esa fecha nueva es
   un dato mutable por cliente.
3. El job que muta los montos corre y falla a la mitad —un `500` del proveedor, un despliegue—.
4. Para retomar hay que saber quién quedó. `subscription` guarda *«versión de plan anclada,
   billing option, estado, período actual, fecha de fin de servicio, clase»*: ni el precio
   nuevo, ni la fecha efectiva, ni la marca de aplicado.
5. La única traza es el `domain_event` de cada mutación, que es append-only y sirve para
   demostrar lo hecho, **no para enumerar lo que falta**: la ausencia de un evento no se
   distingue de un cliente que no estaba alcanzado.
6. Y la clave de deduplicación del aviso —`sub:<id>:aumento:-30d`— tiene que incluir la fecha
   objetivo vigente para que el aviso vuelva a salir cuando la fecha se corre. Esa fecha
   tampoco está guardada.

**Dónde lo permite el diseño.**

`01-decision-log.md`, `DEC-MP-002` implicación 3: *«El proceso que aplica el aumento falla para
el lado bueno (…) Pero **hay que registrar a quién se le aplicó**, para que un fallo parcial no
deje media cartera migrada sin que se sepa cuál»*.

`HOS-1354/docs/12-suscripcion.md` §6.4: *«Si la pausa fue larga, la fecha efectiva se corre
**hacia adelante**, nunca hacia atrás. (…) Se aplica en el **primer cobro posterior a la
reanudación**, y si entre el aviso original y ese cobro no se cumplieron los 60 días, se espera
al siguiente»*.

`nucleo/07-outbox-y-notificaciones.md` §2: *«La ocurrencia entonces incluye **la fecha objetivo
vigente**, no un contador — y al correrse la fecha, cambia la ocurrencia y el aviso vuelve a
salir»*.

`HOS-1354/docs/02-modelo-de-datos.md` §2.2: la lista de campos de `subscription`.

**Severidad.** `ALTA` — media cartera migrada sin forma de saber cuál, y avisos legales cuya
clave de unicidad depende de un dato que no se persiste.

**Necesita decisión del owner.** No.

---

### F-8B3-011 — `refund` no guarda el id del proveedor: `RF-6` y `RF-7` no se pueden aplicar

**Qué se rompe.** Las tres filas de reembolso medidas en producción —`RF-6`, `RF-7`, `RF-8`—
imponen tres obligaciones sobre la tabla `refund`, y la tabla no tiene ninguna de las tres
columnas. El resultado concreto: un reembolso reentregado no se puede reconocer, y las tres
notificaciones de un mismo reembolso no se pueden deduplicar por el id del hecho.

**El camino.**

1. Se reembolsa un cobro. `RF-6` mide que la repetición con la misma clave devuelve **`200` con
   cuerpo vacío y sin el refund original**, y concluye textualmente *«hay que tenerlo
   guardado»*.
2. `refund` guarda *«pago, monto, motivo, estado, quién lo confirmó»*. No guarda el id del
   reembolso en el proveedor ni la clave de idempotencia usada. No hay dónde tenerlo guardado.
3. Llegan las notificaciones. `RF-7` mide **tres entregas en dos formatos por reembolso**, y las
   tres traen **el id del PAGO**, no el del reembolso.
4. La regla de deduplicación es *«se deduplica por **el id del hecho**, no por el tipo de
   evento»*, sostenida por `UNIQUE(proveedor, id_del_hecho)` **en `payment`**. Ese id ya existe:
   es el del cobro original. La primera notificación de reembolso choca contra la fila que ya
   está y se descarta como duplicada.
5. `refund` no tiene un `UNIQUE` equivalente, así que la alternativa —dejar pasar las tres— crea
   tres filas de reembolso para un solo hecho, y *«el acumulado nunca supera el monto del pago»*
   falla o sobre-cuenta.
6. Y con `RF-8`: ante un `2084` la regla es *«reintenta con otro monto o cae al total»*. Cada
   reintento necesita una clave nueva, porque la misma clave con el mismo cuerpo devuelve el
   resultado anterior. `refund` guarda *el monto ejecutado* y no *el pedido*, así que una
   revocación que terminó devolviendo 14 de 15 queda indistinguible de un parcial pedido por
   alguien — que es justo lo que el §54 y `DEC-RF-001` necesitan poder demostrar.

**Dónde lo permite el diseño.**

`06-mp-validation-matrix.md`, `RF-6`: *«la repetición devuelve **`200`, no `201`** (…) y **no
devuelve el refund original** en el cuerpo, así que hay que tenerlo guardado»*.

`06-mp-validation-matrix.md`, `RF-7`: *«**SÍ, tres entregas por reembolso**: `?data.id=<pago>…`
(Webhooks), `?id=<pago>&topic=payment` e `?id=…&topic=merchant_order` (los dos, **IPN**)»*.

`HOS-1354/docs/03-maquinas-de-estado.md` §10.2: *«**se deduplica por el id del hecho**, no por el
tipo de evento — está medido que un mismo reembolso emite tres notificaciones en dos formatos
(`RF-7`)»*.

`HOS-1354/docs/02-modelo-de-datos.md` §2.3: *«**`refund`** | pago, monto, motivo, estado, quién
lo confirmó | el acumulado nunca supera el monto del pago»*, y §5, que sólo declara
`UNIQUE(proveedor, id_del_hecho)` **en `payment`**.

**Severidad.** `ALTA` — pérdida del rastro del dinero devuelto, en la capacidad que además es
la única con riesgo de plataforma.

**Necesita decisión del owner.** No.

---

### F-8B3-012 — El barrido no compara reembolsos

**Qué se rompe.** El capítulo 09 enumera cinco cosas que compara y ninguna es el estado de
reembolso del pago. Un reembolso ejecutado del lado del proveedor —por soporte del proveedor,
por una disputa, o por nuestra propia secuencia de reintentos de `RF-8`— nunca se detecta, y
después de doce meses ya no se puede ni consultar.

**El camino.**

1. Un pago de ARS 18.000 se reembolsa en el panel del proveedor por un reclamo, o entra un
   reembolso parcial que nuestro reintento de `RF-8` disparó y del que perdimos la respuesta.
2. Hay webhook —`RF-7` mide tres—, pero el hallazgo F-8B3-011 muestra que se descartan como
   duplicados del pago o se duplican. Supongamos que se pierden.
3. El barrido diario corre. Compara estado, monto vigente, fecha del próximo cobro, cobros del
   período y la `version` del recurso. **Ninguna de las cinco mira `transaction_amount_refunded`
   ni el estado del pago.**
4. Nuestra fila dice `SUCCEEDED` con reembolsado acumulado en cero. La del proveedor dice
   `refunded`. La divergencia es permanente y silenciosa.
5. Pasados doce meses, el buscador de pagos del proveedor ya no cubre el período: *«el histórico
   es nuestro o no existe»*. Nuestro histórico dice que cobramos plata que devolvimos.

**Dónde lo permite el diseño.**

`HOS-1354/docs/09-conciliacion.md` §3: la tabla completa de lo que compara — estado, monto
vigente, fecha del próximo cobro, cobros del período, `version` del recurso.

`HOS-1354/docs/09-conciliacion.md` §6.1: *«**Más allá de doce meses, la única fuente somos
nosotros.** (…) El histórico es nuestro o no existe — y eso alcanza al histórico de reembolsos
(`DEC-RF-001`)»*.

`HOS-1354/docs/06-proveedor.md` §10: *«la única capacidad del diseño que vive en una API
anunciada como discontinuada es la 6, **reembolsar**»*.

**Severidad.** `ALTA` — divergencia de dinero que ningún mecanismo del diseño puede encontrar.

**Necesita decisión del owner.** No.

---

### F-8B3-013 — La retención de billing quedó con una fila, y sus entidades sin clasificar

**Qué se rompe.** Al partir el capítulo 02 por épica, la mitad de billing de la lista de
retención se quedó con la fila *«se conserva»* y perdió las otras dos. Las entidades de dinero
que no están en esa fila —`subscription`, `promo_redemption`, `addon_instance`,
`courtesy_grant`, `manual_payment`, `idempotency_key`— **no están en ninguna de las tres
categorías**, en ninguna de las dos épicas.

**El camino.**

1. Un anfitrión borra su cuenta. Corre el reloj del §25: día 90 soft delete, día 180 hard
   delete de *«lo eliminable»*.
2. La mitad de verticales define qué se borra (contenido de la ficha, borradores, preferencias),
   qué se anonimiza (datos personales dentro de eventos y outbox) y qué se conserva (la fila de
   `trial`).
3. La mitad de billing define **sólo** qué se conserva: pagos, reembolsos, comprobantes y el
   vínculo con el proveedor.
4. `subscription` no figura en ninguna lista. Si se borra, `payment` —que se conserva— apunta a
   una suscripción inexistente, y la cadena de correlación del núcleo —*«webhook → id del
   proveedor → `provider_link` → suscripción → el evento de dominio que la creó»*— se corta
   justo en el eslabón que se conservó a propósito.
5. `manual_payment` no figura tampoco, y es el registro de un cobro real: si se borra, el §54 se
   queda sin respaldo del comprobante que sí se conservó.
6. Y el outbox, que la mitad de verticales anonimiza al día 180, es la evidencia con la que el
   capítulo 22 de **billing** dice que se prueba un aviso de aumento. La prueba de un requisito
   legal la gobierna una regla de la otra épica que su dueño nunca revisó.

**Dónde lo permite el diseño.**

`HOS-1354/docs/02-modelo-de-datos.md` §4.1, la tabla entera: *«**Se conserva íntegro, siempre** |
pagos, reembolsos, comprobantes, el vínculo con el proveedor | los cuatro primeros son
obligación legal y contable»*. Una sola fila, bajo el título *«qué se borra, qué se anonimiza,
qué se conserva»*.

`HOS-1353/docs/02-modelo-de-datos.md` §4.1: las tres filas, ninguna de las cuales nombra una
entidad de billing.

`nucleo/08-auditoria-y-observabilidad.md` §2.2: *«webhook → id del proveedor → `provider_link` →
suscripción → el evento de dominio que la creó → la correlación original»*.

`HOS-1354/docs/22-lo-legal.md` §1.2: *«el outbox guarda destinatario, plantilla, estado,
identificador del proveedor e intentos»* como prueba del aviso.

**Severidad.** `ALTA` — pérdida de datos por omisión de clasificación, y ruptura de la cadena
de correlación que el núcleo diseñó explícitamente.

**Necesita decisión del owner.** No.

---

### F-8B3-014 — El addon a costo cero declara un campo de origen que el modelo no tiene

**Qué se rompe.** Revocar un grant tiene que cortar los addons cuya única fuente era ese grant.
Nada guarda de qué fuente vino una instancia de addon, así que la revocación no puede
distinguir un addon regalado de uno comprado — y la confirmación del §19 tiene que enumerar
cuáles corta.

**El camino.**

1. Un beneficiario de *Free Forever* con `includesAddons: true` enciende tres addons a costo
   cero, uno por uno, como manda el §35.2.
2. El capítulo 16 dice que lo que se registra es el origen: *«la instancia dice que su título es
   el grant»*, y afirma que *«es un campo que el modelo ya necesita, no uno nuevo»*.
3. `addon_instance` guarda *«producto, dueño, objetivo, estado, inicio, fin, **su suscripción de
   complemento si es recurrente**»*. El único campo de origen que existe apunta a una
   suscripción, y un addon regalado no tiene ninguna.
4. Se revoca el grant. El sistema tiene que cortar los tres y dejar en pie cualquier addon que
   la persona hubiera pagado aparte. No puede: no hay columna que los separe.
5. `permanent_grant` guarda *«suscripciones afectadas»* y no *addons afectados*, así que tampoco
   se puede llegar desde el otro lado.
6. El §19 exige que la confirmación diga **qué addons corta**, y esa pantalla no se puede
   escribir.

**Dónde lo permite el diseño.**

`HOS-1354/docs/16-addons.md` §3.1: *«**Lo que sí se registra es el origen**: la instancia dice
que su título es **el grant**, del mismo modo que una instancia recurrente dice cuál es su
suscripción de complemento. **Es un campo que el modelo ya necesita, no uno nuevo**»*.

`HOS-1354/docs/02-modelo-de-datos.md` §2.4: *«**`addon_instance`** | producto, dueño, **objetivo**
(ficha, suscripción de vertical, usuario o global), estado, inicio, fin, su suscripción de
complemento si es recurrente»*; *«**`permanent_grant`** | beneficiario, scope de verticales,
`includesAddons`, quién lo firmó, motivo, suscripciones afectadas»*.

`HOS-1354/docs/19-superficies.md` §4, fila 13: *«la confirmación de **revocar un grant** | que
deja al cliente **sin servicio**, y **qué addons corta**»*.

**Severidad.** `ALTA` — la acción administrativa que el capítulo 08 declara la más grave no
puede ejecutarse correctamente ni anunciarse.

**Necesita decisión del owner.** No.

---

### F-8B3-015 — `manual_payment` no guarda monto: el pago manual no se puede comprobar ni reembolsar

**Qué se rompe.** El §30 es un método de pago de primera clase —*«mismo motor de Subscription»*—
y su registro no guarda cuánta plata entró. Sin monto no hay comprobante del §54, no hay
reembolso posible, no se puede verificar la condición 2 del pago tardío, y el rastro de la plata
de Partner no existe.

**El camino.**

1. Un Partner paga por transferencia. El admin registra el pago (MP1) y la suscripción sale de
   `GRACE_PERIOD`.
2. `manual_payment` guarda *«suscripción, estado, quién lo registró, cuándo, comprobante»*. No
   guarda monto ni moneda. El «comprobante» es lo que el cliente subió, no un dato estructurado.
3. El §54 obliga a emitir un comprobante no fiscal **por cada cobro**. `receipt` cuelga de
   `pago`, no de `manual_payment`, y no hay monto que imprimir.
4. El Partner ejerce el derecho de revocación. `DEC-RF-001` hace de eso una sola operación:
   reembolso total más cancelación. `refund` cuelga de `pago` y el capítulo 06 declara que el
   proveedor «Manual» implementa la capacidad 6, reembolsar. **No hay fila sobre la cual
   reembolsar, ni monto que devolver.**
5. Meses después, un reclamo. El rastro es: alguien registró algo, en tal fecha, sin decir de
   cuánto.

**Dónde lo permite el diseño.**

`HOS-1354/docs/02-modelo-de-datos.md` §2.3: *«**`manual_payment`** | suscripción, estado del cap.
03 §7, quién lo registró, cuándo, comprobante»*; *«**`receipt`** | pago, número, PDF»*;
*«**`refund`** | pago, monto, motivo, estado, quién lo confirmó»*.

`HOS-1354/docs/06-proveedor.md` §1: *««Manual» implementa 2, 5, 6 y 7 (…) y por eso el §30 puede
decir *«Mismo motor de Subscription. Payment method distinto.»*»* — la 6 es reembolsar.

`HOS-1354/docs/05-idempotencia-y-concurrencia.md` §3, condición 2: *«el monto coincide con el
esperado para el período que cubre»*.

**Severidad.** `ALTA` — pérdida del rastro de la plata en el único método de pago no
automatizado.

**Necesita decisión del owner.** No.

---

### F-8B3-016 — Dos capítulos ejecutan transiciones que la tabla exhaustiva no declara

**Qué se rompe.** La regla 1 del núcleo dice que lo que no está en la tabla no pasa, y que un
intento no declarado emite `RECONCILIATION_REQUIRED`. Dos capítulos posteriores describen
transiciones que no están en la tabla. Literalmente aplicada, la regla convierte dos caminos de
negocio normales en incidentes que despiertan a `SUPER_ADMIN`.

**El camino.**

1. Un alta cuyo primer cobro falla, sin ningún pago acreditado para ese `user + vertical`: el
   capítulo 12 manda **`ACTIVE` → `SUSPENDED` directo**, sin pasar por grace. La tabla tiene
   S4 (`ACTIVE`→`GRACE_PERIOD`) y S6 (`GRACE_PERIOD`→`SUSPENDED`), y ninguna transición
   `ACTIVE`→`SUSPENDED`.
2. Se discontinúa una vertical. El capítulo 10 manda que **cada suscripción viva** pase a
   `CANCEL_SCHEDULED`, y aclara que una en `GRACE_PERIOD` *«sale por la misma puerta que las
   demás, en la misma fecha»*. La tabla sólo tiene S11, desde `ACTIVE`. No hay
   `GRACE_PERIOD`→`CANCEL_SCHEDULED`, ni desde `PAUSED`, ni desde `SUSPENDED`.
3. En los dos casos, la implementación que respete la regla 1 registra el intento, no lo
   ejecuta y emite `RECONCILIATION_REQUIRED` — sobre cartera sana, en el caso 2 sobre toda la
   vertical a la vez.
4. La implementación que no la respete agrega las transiciones en silencio, y entonces la
   exhaustividad de la tabla deja de ser verdad, que es lo único que la hacía útil.

**Dónde lo permite el diseño.**

`nucleo/03-maquinas-de-estado.md` §1, regla 1: *«**La tabla de transiciones es exhaustiva.** Lo
que no está, no pasa. Un intento de transición que la tabla no declara **no se ejecuta**: se
registra como evento de dominio y, si tocaba plata o estado, emite `RECONCILIATION_REQUIRED`»*.

`HOS-1354/docs/12-suscripcion.md` §4.3: *«Una suscripción cuyo **primer** cobro falla, para un
`user + vertical` **sin ningún pago acreditado**, no pasa por `GRACE_PERIOD`: **va directo a
`SUSPENDED`**»*.

`HOS-1354/docs/10-verticales-planes-billing-options.md` §4.3 y §4.5: *«cada suscripción viva se
cancela en el proveedor de inmediato y **pasa a `CANCEL_SCHEDULED`**»* / *«Una suscripción en
`GRACE_PERIOD` al momento del anuncio (…) **Sale por la misma puerta que las demás, en la misma
fecha**»*.

`HOS-1354/docs/03-maquinas-de-estado.md` §3.2: la tabla S1–S15.

**Severidad.** `ALTA` — falla real en producción, se arregla agregando las transiciones.

**Necesita decisión del owner.** No.

---

### F-8B3-017 — Un reembolso total deja en pie un comprobante numerado sin huecos

**Qué se rompe.** El comprobante se emite por cada cobro, con numeración correlativa sin
huecos, y el modelo no tiene forma de anular uno. Una revocación —que por `DEC-RF-001` es
reembolso total más cancelación— deja un comprobante vigente por plata que se devolvió.

**El camino.**

1. Se cobra. Se emite el comprobante número N.
2. El cliente ejerce la revocación dentro del plazo. Se reembolsa el total y se cancela.
3. `receipt` guarda *«pago, número, PDF»* con `UNIQUE(numero)` y *«sin huecos»*. No tiene
   estado, no tiene anulación, y no existe una entidad de nota de crédito.
4. Borrar la fila abre un hueco en la numeración, que la propia restricción prohíbe. Dejarla es
   sostener un documento que dice que se cobró algo que se devolvió.
5. El §54 difiere ARCA, así que el comprobante no es fiscal — pero es el único documento que el
   cliente recibe, y la contabilidad del hallazgo F-8B3-012 lo toma como la verdad del período.

**Dónde lo permite el diseño.**

`HOS-1354/docs/02-modelo-de-datos.md` §2.3: *«**`receipt`** | pago, número, PDF. **Comprobante no
fiscal** (§54, `DEC-LEGAL-001`) | `UNIQUE(numero)`, **sin huecos**»*.

`HOS-1354/docs/22-lo-legal.md`, cierre: *«**El comprobante no fiscal** ya lo decidió
`DEC-LEGAL-001` y no se reabre: se emite por cada cobro, **nunca se lo llama factura fiscal**»*.

**Severidad.** `MEDIA` — borde que alguien va a encontrar en la primera revocación real, y que
crece de golpe el día que entre ARCA.

**Necesita decisión del owner.** No, pero conviene que entre en el pliego legal, que hoy tiene
seis preguntas y ninguna sobre la anulación de un comprobante.

---

### F-8B3-018 — La medición que sostiene toda la migración caduca el 2026-09-26 y la cohorte ya crece

**Qué se rompe.** El capítulo 21 declara abierta una decisión que se cerró el 2026-09-19 en la
dirección que agranda el problema, y su propia medición vence en siete días. La premisa
*«no hay casi nada que migrar»* deja de ser verificada sin que nada avise.

**El camino.**

1. El capítulo 21 §3.3 declara *«la única que este capítulo abre en vez de cerrar»*: qué pasa
   con las altas nuevas durante el rediseño.
2. `04-open-decisions.md` la cierra el 2026-09-19 con `DEC-MIG-002`: **se siguen tomando altas**
   y se transcriben a mano. El capítulo 21 sigue diciendo que está abierta.
3. La opción elegida es la #1 de la tabla del propio capítulo, cuyo riesgo declarado es *«la
   cohorte a transcribir crece: hoy son 5 y la regla de §2.3 sólo es barata mientras sean
   pocas»* — y esa regla, por F-8B3-006, no cubre el compromiso de cobro.
4. El 2026-09-26 vence el primer trial y se ejecuta el primer cobro de la historia del sistema.
   Ese día la foto de *«0 pagos registrados»* deja de ser cierta, y con ella la afirmación de
   que no hay historial que preservar.
5. Nada en el diseño agenda esa re-medición salvo la regla general `S-METH-01`.

**Dónde lo permite el diseño.**

`HOS-1354/docs/21-migracion.md` §1.3: *«esta medición vale mientras el hecho no cambie, y **este
hecho cambia solo** — el 2026-09-26 (§3)»*, y §3.3: *«Queda declarada como decisión del owner
(…) **la única que este capítulo abre en vez de cerrar**»*.

`04-open-decisions.md`: *«`OD-MIG-01` (…) ✅ **CERRADA por `DEC-MIG-002`** (2026-09-19): se
siguen tomando altas en el sistema actual y se transcriben a mano al terminar»*.

**Severidad.** `MEDIA` — no falla sola, pero deja la premisa central de la migración sin
vigilancia y el capítulo desincronizado con la decisión que lo gobierna.

**Necesita decisión del owner.** No. Sí pide un disparador de re-medición con fecha.

---

### F-8B3-019 — El núcleo declara un `UNIQUE` sobre una columna que su propio modelo no lista

**Qué se rompe.** El mecanismo que garantiza que un correo salga una sola vez se apoya en una
clave de tres partes con restricción de unicidad. El modelo de datos del núcleo enumera los
campos del outbox y no incluye la tercera.

**El camino.**

1. El capítulo 07 define la clave `(destinatario, plantilla, ocurrencia)` como *«una columna con
   restricción de unicidad»*.
2. El capítulo 02 del núcleo lista `outbox` como *«destinatario, plantilla, estado (…), id del
   proveedor, intentos (§44)»*. No hay `ocurrencia`.
3. Quien implemente desde el capítulo 02 crea la tabla sin la columna y el dedup no existe: un
   job que corre dos veces manda dos avisos, con el §44 perfectamente cumplido, que es
   exactamente el desenlace que el capítulo 07 vino a evitar.

**Dónde lo permite el diseño.**

`nucleo/07-outbox-y-notificaciones.md` §2: *«**La clave de deduplicación, y es una columna con
restricción de unicidad:** `(destinatario, plantilla, ocurrencia)`»*.

`nucleo/02-modelo-de-datos.md` §2.6: *«**`outbox`** | destinatario, plantilla, estado (`pending`,
`processing`, `sent`, `failed`, `retry`), id del proveedor, intentos (§44)»*.

**Severidad.** `BAJA` — falta precisión; el mecanismo está definido y sólo hay que reflejarlo en
el modelo. Se reporta porque el capítulo 02 es, por la regla del índice, el único lugar donde
una entidad se define.

**Necesita decisión del owner.** No.

---

## Ataques que intenté y el diseño resistió

Nueve ataques que no produjeron hallazgo, y por qué. El owner necesita saber qué aguantó tanto
como qué se rompió.

1. **Conciliar contra el buscador del proveedor.** Intenté construir el caso del barrido que
   termina en verde habiendo procesado media cartera. No se puede: el capítulo 09 §1 prohíbe el
   buscador para todo, con la medición de `cancelled` devolviendo *«15 de 69»*, y §2.1 ancla el
   inventario en nuestra base. El ataque está cerrado antes de empezar.

2. **Los tres modos de «cero cobros».** Intenté que la conciliación concluya *«no cobró»* sobre
   un lag de indexación. El §4 lo impide por regla escrita: se concluye desde
   `charged_quantity`, nunca desde el endpoint de cobros, y el caso inverso —ver subir el
   contador y no encontrar el cobro— está declarado como no-divergencia.

3. **Webhooks fuera de orden.** Intenté producir un retroceso de estado con dos entregas
   invertidas. No hay retroceso posible: el evento nunca es la fuente, se relee por id, y los
   dos caminos convergen. La `version` se usa sólo para ahorrar relecturas y para detectar el
   cambio mudo de `EX-15`, que es el uso correcto.

4. **La heterogeneidad de los trials al migrar.** Intenté romper la transcripción con las tres
   duraciones distintas (una de 30 días, dos de 90) y con las dos filas cuyo fin de período cae
   antes que el fin de trial. Transcribir **la fecha** y no la duración absorbe las tres, y el
   `UNIQUE(user_id, vertical)` sin condición de estado hace que la fila sola niegue un trial
   nuevo. Es la parte más limpia del plan de migración.

5. **Componer nuestro grace con el del proveedor sin saber cuánto dura el suyo.** Intenté el
   caso de las ventanas concéntricas que suspenden a alguien a quien el proveedor todavía le va
   a cobrar bien. El capítulo 12 §1.2 lo resuelve sin el número: el reloj arranca cuando el
   proveedor deja de reintentar, observado por relectura. *«Un número que no se usa no puede
   estar mal»* es correcto acá.

6. **Sacarle un monto al contrato de cobertura.** Intenté encontrar un precio, un estado de pago
   o una fecha de cobro cruzando la frontera de billing hacia verticales. No hay ninguno: la
   distinción `ACTIVE`/`GRACE_PERIOD` se declara explícitamente como no cruzable y el puntero a
   versión de plan no arrastra `billing_option`. La filtración que encontré va en la otra
   dirección (F-8B3-009) y por entidades que el contrato no contempla (F-8B3-007).

7. **El `external_reference` como portador de correlación.** Intenté romper la cadena de tres
   días haciendo que el proveedor reescriba la referencia. El núcleo ya lo previó: la
   correlación **no viaja hacia afuera**, se recupera por `provider_link`, justamente porque el
   campo es reescribible (`EX-19`) y el buscador lo ignora (`RC-1`).

8. **Retirar un plan para mover clientes sin avisar.** Intenté que sacar algo de la pricing
   moviera dinero ajeno. El anclaje por versión lo impide de raíz, y la cola de versiones vivas
   es una condición derivada visible en el §48, no un estado que se acumule en silencio.

9. **La anonimización del día 180 como forma de recuperar un trial.** Intenté que borrar la
   cuenta devuelva el trial. El hash irreversible del correo normalizado lo cierra, y está
   declarado explícitamente como el único dato que no se anonimiza.

---

## Lo que cae en el hueco del capítulo 13

El 13 (Pagos) está sin escribir a propósito. Lo que falta ahí, visto desde este vector, no es
sólo la mecánica del cobro: **el capítulo 09 concilia pagos que ningún capítulo define.**

1. **Qué es un `payment` y a qué período corresponde.** Es el dato del que dependen tres
   hallazgos: el candado de C5 (F-8B3-002), la condición 4 del pago tardío, y la comparación de
   *cobros del período* del barrido. Hoy el período es un concepto que cuatro capítulos usan y
   ninguno define.

2. **Contracargos y disputas.** No aparecen en ningún capítulo. La máquina de pago tiene cinco
   estados y ninguno es «disputado»; el barrido no mira el estado de reembolso (F-8B3-012); el
   §65 tampoco los nombra. Es plata que se va sin que nadie la haya devuelto.

3. **El cobro de única vez.** `EX-30` midió que `/v1/orders` cobra de verdad y que un addon de
   única vez *«no necesita ninguna habilitación especial ni pasa por `preapproval`»*. Qué
   entidad registra ese cobro, y cómo se concilia algo que no tiene preapproval, es del 13 — y
   sin eso F-8B3-003 no tiene salida.

4. **El bucle de reintento de `RF-8`.** *«Reintenta con otro monto o cae al total»* no tiene
   cota, ni regla de qué monto probar, ni dónde se registra la diferencia entre lo pedido y lo
   ejecutado. Es el único lugar del diseño donde una regla de reintento manipula el monto.

5. **El pago manual completo.** Monto, moneda, comprobante y reembolso (F-8B3-015). El §65 lo
   lista como área obligatoria —*«manual payments»*— y el índice del núcleo lo manda al 13.

6. **`RF-3`**, ya declarado: reembolsar un pago de más de 180 días. Alcanza a la reparación de
   una divergencia vieja, que es material de conciliación.

7. **La numeración y la anulación de comprobantes** (F-8B3-017).

Y una observación de método: **la conciliación se escribió antes que su objeto.** Mientras el
13 no exista, el capítulo 09 no puede declararse cerrado, porque tres de sus cinco comparaciones
—monto vigente, cobros del período y, si se agrega, reembolsos— hablan de entidades cuyo
contenido define el capítulo que falta.

---

## Fuera de mi vector

Lo que vi y le toca a otro agente.

- **[B1 — doble cobro]** El bucle de `RF-8` necesita una clave de idempotencia nueva en cada
  reintento, porque `RF-6` mide que la misma clave con el mismo cuerpo devuelve el resultado
  anterior. Un reintento por timeout —no por `2084`— con clave nueva es un segundo reembolso
  real sobre el mismo saldo.

- **[B1 — doble cobro]** El capítulo 10 §4.3 cancela **todas** las suscripciones de una vertical
  en un solo acto. Si esa ejecución falla a la mitad, no hay forma de saber cuáles quedaron
  vivas: es el mismo problema de `DEC-MP-002` implicación 3 (F-8B3-010) sobre una operación que
  el capítulo declara irreversible.

- **[B2 — máquinas y carreras]** El capítulo 12 §4.4 deja anotado y sin resolver que `ABANDONED`
  hoy cubre dos muertes distintas —*«nadie autorizó en 72 h»* y *«intentó y lo rechazaron»*— y
  que al cliente se le dice algo distinto en cada caso.

- **[B2 — máquinas y carreras]** `D7` obliga a que la vieja siga viva mientras la nueva se
  autoriza. Además del bloqueo de base (F-8B3-001), la ventana admite que el cliente abandone el
  checkout y quede con una `PENDING_AUTHORIZATION` de 72 h encima de una `ACTIVE`, con dos
  preapprovals vivos durante ese tiempo.

- **`NUCLEO`** — `nucleo/04-invariantes.md` no cuenta igual en tres lugares: el índice del núcleo
  dice *«los 51»*, la tabla del §3 lista `D1`…`D14` (catorce), la nota del §5 dice *«suma 14
  sobre 12 invariantes»* y el cierre dice *«Cuarenta y nueve invariantes»*. El conteo consistente
  es 37 + 14 = 51. Un invariante que no se puede contar no se puede preguntar si está todo, que
  es lo único que el propio capítulo dice que los hace útiles.

- **`NUCLEO`** — `nucleo/02-modelo-de-datos.md` perdió su §1 de entidades al partirse: pasa de
  §1.3 a §2.6 sin §2.1–§2.5, y el §2.6 se titula *«Registro»* como si fuera la última subsección
  de una lista que no está. Es cosmético, pero el capítulo 02 es el único lugar donde una entidad
  se define y su numeración es lo que las otras dos épicas citan.

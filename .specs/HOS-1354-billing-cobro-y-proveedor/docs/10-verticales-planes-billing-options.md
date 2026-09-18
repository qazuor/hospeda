---
title: Master Spec 10 — Verticales, planes y billing options
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-18
status: CURRENT
fase: 2
capitulo: 10
cierra:
  - OD-ARCH-01
  - M-SUB-03
---

# 10 · Verticales, planes y billing options

Mitad **BILLING** del capítulo 10 (`09-master-spec/10-verticales-planes-billing-options.md`).

Abre la Parte II. Acá empieza a describirse **comportamiento**, y la regla del índice rige desde
la primera línea: este capítulo **referencia** el núcleo y no redefine nada. Los nombres salen
del capítulo 01 (núcleo), las entidades y restricciones del 02, los estados del 03.

Lo que sí define es lo que ningún capítulo anterior podía definir: **qué diferencia
legítimamente a una vertical de otra, plan por plan**, y **qué pasa cuando algo del catálogo
deja de venderse** — un plan (`OD-ARCH-01`) o una vertical entera (`M-SUB-03`).

---

## 3. Retiro de un plan del catálogo · cierra `OD-ARCH-01`

### 3.1 La pregunta, exactamente

El PDR no la menciona en ningún lado. Un plan que deja de venderse pero que todavía tiene
clientes pagando: ¿se archiva y siguen ahí indefinidamente?, ¿se los migra?, ¿hay fecha?

`DEC-ARCH-002` dejó la mitad del mecanismo —el flag de vendible— y anotó que la política seguía
abierta. Esta sección es la política.

### 3.2 Retirar y migrar son dos actos, y sólo uno toca plata

**Retirar un plan no mueve a nadie.** Es el acto de sacarlo del catálogo: deja de aparecer en la
pricing, deja de participar del `rank`, deja de alimentar la derivación del plan de trial. Para
quien ya lo tiene **no cambia nada**: mismo precio, mismos entitlements, mismos limits, misma
fecha de renovación. No toca plata.

**Migrar a un cliente a otro plan sí toca plata** —otro precio, otras capacidades— y por eso es
un acto distinto, explícito, por cliente o por cohorte, que pasa por los caminos que ya existen:
`DEC-MP-002` si el precio le sube, `DEC-SUB-008` si algo le baja.

Separarlos es la decisión. Fundirlos en uno —*«retirar el plan migra a los que quedan»*— haría
que sacar algo de la pricing moviera dinero ajeno como efecto colateral, que es exactamente lo
que `DEC-ARCH-001` fue a evitar cuando ancló cada suscripción a su versión.

### 3.3 Cómo se retira, mecánicamente

**Retirar es publicar una versión nueva marcada no vendible.** No hace falta ningún mecanismo
nuevo: la versión es inmutable (`DEC-ARCH-001`), así que un cambio con efecto se expresa
publicando otra, y el flag de vendible tiene efecto (`DEC-ARCH-002`, implicación 4).

Consecuencias, todas ya provistas por el núcleo:

1. **Queda fechado y auditado solo.** La versión nueva tiene su fecha de publicación y su
   registro en `domain_event`; no hay que agregar una columna de «fecha de retiro».
2. **Las suscripciones vivas no se mueven**, porque cada una está anclada a la versión que
   compró y ninguna lectura de suscripción pasa por la vigente.
3. **El `rank` se libera** en cuanto la vigente deja de ser vendible, así que un plan nuevo puede
   ocupar ese lugar sin renumerar (`DEC-ARCH-002`, implicación 3).
4. **Se puede deshacer**, publicando otra versión vendible. Volver atrás no es un caso especial:
   es el mismo acto.

### 3.4 No hay fecha de vencimiento, y eso es la decisión

**Un plan retirado sostiene a sus clientes por tiempo indefinido.** No se fija plazo, no se
programa una migración automática, no caduca.

Se eligió hacia dónde falla: **hacia que el cliente siga pagando lo que pagaba, con lo que
tenía.** El costo es una cola larga de versiones vivas que nadie puede comprar. La alternativa
—un plazo tras el cual el sistema mueve solo a los que quedan— falla hacia mover dinero y
capacidad de gente que no pidió nada, y encima dispara el aviso del §29 por una razón
administrativa nuestra.

**La cola es acotada y visible, no infinita ni silenciosa.** Una versión retirada se extingue
cuando la deja su última suscripción, y eso es una condición derivada —cuántas suscripciones
siguen ancladas a ella—, no un estado guardado. El listado de administración del §48 la muestra
por versión retirada, que es lo que convierte la cola en algo que alguien puede decidir atacar
en vez de algo que se acumula sin que nadie lo sepa.

### 3.5 Un cliente en un plan retirado que quiere cambiar

Es el borde real del retiro, y necesita regla propia: **su versión no participa del `rank`**
(`DEC-ARCH-002`), así que la pregunta *«¿es upgrade o downgrade?»* no tiene respuesta por orden.

**La dirección se deriva del delta entre las dos versiones, no del `rank`:**

- **si algo baja** —un limit, un entitlement, una cuota de un entitlement medido— el cambio sigue
  el camino de downgrade (`DEC-SUB-008`): el monto se muta ya, las capacidades bajan al fin del
  ciclo y el excedente se avisa antes de tocarlo;
- **si nada baja**, sigue el camino de upgrade (`DEC-SUB-007`): inmediato.

**Cualquier baja manda.** Un cambio en el que suben tres claves y baja una es un downgrade a
todos los efectos, porque el excedente que hay que avisar existe igual y el camino de upgrade no
lo contempla.

**Y la ventana de 60 días de `DEC-MP-002` no aplica acá.** Esa ventana protege a quien **no
eligió** el precio nuevo. El que elige un plan lo acepta en el acto, con su precio a la vista.
Confundir los dos casos haría imposible cambiar de plan por voluntad propia sin esperar dos
meses.

---

## 4. Vertical discontinuada · cierra `M-SUB-03`

### 4.1 La pregunta, y por qué no es la misma que la anterior

El PDR contempla verticales nuevas en §16, §31 y §35.1, y **nunca la operación inversa**. Una
vertical con suscripciones activas que deja de ser un producto.

**Retirar todos los planes de una vertical NO es discontinuarla**, y confundirlos es la trampa de
esta sección. Retirados todos los planes vendibles la vertical queda **cerrada a altas**: nadie
nuevo entra, nadie nuevo arranca un trial —la derivación del §10.3 se queda sin fuente, y no
poder probar algo que después no se puede comprar es la respuesta correcta—, y **todos los que
están adentro siguen exactamente igual, indefinidamente** (§3.4). Eso es un estado estable y
puede durar años.

Discontinuar es otra cosa: **el servicio se deja de prestar.** Las fichas se bajan, la sección de
Mi Cuenta se va, la pricing desaparece. Y eso **toca plata**, porque hay gente pagando por algo
que va a dejar de recibir.

### 4.2 La regla que ordena todo lo demás

**Se deja de cobrar antes de dejar de prestar. Nunca al revés.**

Cobrar por un servicio ya retirado es el único desenlace que es a la vez una falla legal y una
falla de reputación, y es el que se elige evitar aun al costo de regalar servicio. Todo lo que
sigue sale de acá.

### 4.3 Cómo se discontinúa

Es un acto de `SUPER_ADMIN`, con registro escrito, y se ejecuta en este orden:

**Día 0 — el anuncio.** La vertical deja de admitir altas y trials. Y en el mismo acto, **cada
suscripción viva se cancela en el proveedor de inmediato** y pasa a `CANCEL_SCHEDULED`
(`DEC-SUB-009`), con su fecha de fin de servicio sostenida de nuestro lado. Desde ese instante
**el proveedor no emite un cobro más** en la vertical. Lo mismo con cada suscripción de
complemento viva en ella (`DEC-ADDON-002`: cada addon recurrente es su propia autorización, así
que cada una se cancela por su cuenta).

**La fecha de fin de servicio es una sola para toda la vertical**, y es:

```text
fin de servicio = max( día 60 desde el anuncio,
                       el último día ya pagado por cualquier compromiso vivo en la vertical )
```

**Los tres avisos de `DEC-MP-002`** —al anunciar, a 30 días y a 7 días— con la fecha de fin de
servicio, qué pasa con la ficha y cómo exportarla.

**El día del fin de servicio.** Las fichas pasan a `UNPUBLISHED_BY_BILLING` por PB2 del capítulo
03 §9, las suscripciones consuman su `CANCELLED`, y arranca el reloj de retención del §25 con sus
dos avisos previos (`DEC-DATA-001`): día 90 fuera del sitio público conservando el acceso del
dueño, día 180 hard delete de lo eliminable.

### 4.4 Por qué esa fórmula y no un prorrateo

**El piso de 60 días** es el de `DEC-MP-002`. Perder el servicio entero es estrictamente peor
para el cliente que un aumento de precio, así que la antelación no puede ser menor. Y como el
cobro ya se cortó el día 0, esos días se prestan **sin cobrar**: un mensual recibe hasta dos
meses libres. Ése es el costo elegido de la regla del §4.2.

**El techo —el último día ya pagado— existe porque no hay prorrateo.** El capítulo 06 (épica de
billing) dejó *prorratear* explícitamente **fuera** de las ocho capacidades de proveedor, por
decisión de diseño. Cortar un período ya cobrado exigiría devolver la parte no prestada, o sea un
reembolso por cada compromiso de la cartera. Honrar el término completo cuesta servicio y no
cuesta ninguna operación de dinero; truncarlo cuesta una operación de dinero por cliente. Se elige
lo primero.

**El costo de esa elección, declarado**: un anual vendido el día antes del anuncio sostiene la
vertical abierta doce meses más. Por eso hay una salida, y es explícita: **`SUPER_ADMIN` puede
acortar la cola reembolsando** la parte no prestada de los compromisos que se extienden más allá
de la fecha que se quiera fijar. Es un acto por caso, nunca automático — es el criterio de
siempre: lo que toca plata no se ejecuta solo.

### 4.5 Los cuatro bordes

1. **Nadie se migra a otra vertical.** Mover una ficha de Gastronomía a Experiencia es una
   decisión de producto por ficha, no un trabajo por lotes. La discontinuación no la toma.
2. **No hay reembolso por la suscripción**, y es honesto justamente porque no se cobró nada por
   servicio no prestado: lo pagado se presta entero. Es la misma dirección que `DEC-SUB-009`,
   `DEC-GRANT-001` y `DEC-ENT-004`.
3. **Una suscripción en `GRACE_PERIOD` al momento del anuncio no se perdona ni se persigue más
   fuerte.** La deuda es por servicio ya prestado y sigue su camino normal del §22; lo que no
   pasa es que el reloj del grace la empuje a `SUSPENDED` por efecto de la discontinuación. Sale
   por la misma puerta que las demás, en la misma fecha.
4. **La fila de `vertical` no se borra nunca.** Pasa a estar cerrada a altas y con fecha de fin de
   servicio cumplida, y ahí queda. Borrarla dejaría huérfano a cada pago, comprobante y evento de
   dominio que la nombra, y además rompería el guard de las dos direcciones del capítulo 02 §1.2,
   que falla si una clave de la base no está en el catálogo de código **y al revés**. Es la
   excepción histórica del §55.1, marcada como tal.

### 4.6 Por qué esto no es una novena máquina de estado

El §63 pide ocho máquinas y el capítulo 03 las tiene. La vertical **no agrega una**: su situación
se lee de **dos datos con fecha** sobre su propia fila —si admite altas, y su fecha de fin de
servicio— y de ahí salen las tres situaciones posibles sin que haya transiciones que restringir
más allá de que ninguno de los dos vuelva atrás solo.

| admite altas | fin de servicio | situación |
|---|---|---|
| sí | sin fecha | **en operación** |
| no | sin fecha | **cerrada a altas** — todos los planes retirados (§4.1); estable, puede durar años |
| no | con fecha | **discontinuándose**, y cumplida la fecha, **discontinuada** |

**La reversibilidad es de papel.** Revocar el anuncio antes de la fecha deja la fila como estaba,
pero **no deshace las cancelaciones en el proveedor**: cada cliente tendría que volver a
autorizar. El anuncio es el punto sin retorno, y ése es el motivo de que lo firme `SUPER_ADMIN`
por escrito y no sea un botón más del panel.

---

## Lo que este capítulo NO cierra

- **El detalle del cambio de plan** —cómo se ejecuta contra el proveedor, qué se compensa— es del
  capítulo 12 (épica de billing). Acá está sólo la regla de dirección para el caso del plan
  retirado.
- **Qué pasa si la fecha de un aumento cae sobre una suscripción en mora** sigue abierto: lo dejó
  anotado `DEC-MP-002` y no lo cierra este capítulo.

---
title: "FASE 8 · A2 — máquinas de estado, carreras y huérfanos"
linear: HOS-1353
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 8
---

# FASE 8 · A2 — máquinas de estado, carreras y huérfanos

Pasada adversarial A2 sobre HOS-1353. Vector: transiciones rotas, carreras, huérfanos, el reloj y
la reentrada. Dieciocho hallazgos, ordenados por severidad.

Lo que **no** está acá, por encargo: acceso cruzado y autorización (A1), datos, migración y
acoplamiento (A3). Lo que se cruzó con esos vectores está al final.

---

## CRITICA

### F-8A2-001 — El evento que enciende el trial exige el título que el trial crea: T1 no se puede disparar

**Qué se rompe** — La única fuente viva de la épica nunca arranca. Nadie puede publicar su primera
ficha, así que nadie llega a `TRIAL_ACTIVE`, así que la implementación de arranque del contrato
responde «no cubierto» para todo el mundo, para siempre.

**El camino.**

1. Una persona entra a Gastronomía. Está en `PRE_TRIAL`, *«sin capacidades comerciales»*.
2. Pulsa *Publicar* sobre su borrador. Publicar es una operación de dominio: escribe estado, es
   auditable, y por el cap. 17 §1.3 **ninguna operación resuelve su autorización por su cuenta**.
3. La resolución corre sus nueve pasos. El paso 5 pregunta *«¿tiene trial, suscripción, cortesía o
   grant que lo cubra?»*. No tiene ninguna de las cuatro.
4. La defensa §6.1 del contrato ordena que una fuente no implementada responda que no, así que
   `cobertura(user, Gastronomía) = { cubierto: no }`.
5. La operación se rechaza con *«sin cobertura»*. PB1 no ocurre. Y como PB1 **es** el evento de
   activación de la vertical, T1 tampoco.
6. Lo mismo con Turista: el evento es pulsar *Empezar*, que también escribe estado y también pasa
   por los nueve pasos.

**Dónde lo permite el diseño.**

- `HOS-1353/docs/17-autorizacion.md` §1.2: `| 5 | **título vivo** | ¿tiene trial, suscripción,
  cortesía o grant que lo cubra? | sin cobertura |` — y §1.3: *«No hay nueve verificaciones
  repartidas: hay una resolución de autorización que las ejecuta en orden, y es la única que las
  ejecuta.»*
- `HOS-1353/docs/03-maquinas-de-estado.md` §9, PB1: *«publicar es quedar visible, y es el evento
  que consume el trial en las verticales con ficha»*.
- `HOS-1353/docs/03-maquinas-de-estado.md` §2: *«`PRE_TRIAL` … es donde vive quien entró a la
  vertical y todavía no publicó, con borradores ilimitados, sin capacidades comerciales y sin
  consumir trial»*.
- `HOS-1352/docs/12-contrato-de-cobertura.md` §6.1: *«Una fuente no implementada responde que
  no.»*

La única excepción declarada al paso 5 son **las doce acciones del capítulo 08 §3**, y el cap. 17
§3.2 regla 3 cierra la puerta a inferir otras: *«A qué clase pertenece una operación se declara,
nunca se infiere.»* Publicar una ficha no está entre las doce.

**Severidad** — `CRITICA`. No es un borde: es el camino feliz de la unidad V4, y el criterio de
terminación de V4 (*«un trial vence de verdad»*) no se puede ni empezar a ejercer.

**Necesita decisión del owner** — Sí. Hay al menos tres salidas y cambian el diseño de distinta
forma: declarar una clase de operaciones que crean cobertura y se evalúan sin el paso 5; darle a
`PRE_TRIAL` un título propio en el contrato; o mover el evento de activación a un acto anterior al
publish. La tercera contradice `DEC-TRIAL-006` y `DEC-TRIAL-005`.

---

### F-8A2-002 — `PRE_TRIAL` no se puede representar: la fila que lo guardaría niega su propio T1

**Qué se rompe** — O `PRE_TRIAL` deja de ser un estado real —contra lo que el glosario y el cap. 03
afirman dos veces— o su fila bloquea la transición T1 que tenía que dispararse desde él. No hay una
tercera lectura, y ninguna transición del cap. 03 §2 crea esa fila.

**El camino.**

1. El estado de una máquina *«vive en una columna con dominio restringido»* (núcleo cap. 03 §1.2).
   La columna de estado de Trial vive en la tabla `trial`.
2. `trial` lleva `UNIQUE(user_id, vertical)` **sin condición de estado**, y el cap. 02 explica para
   qué: *«su sola existencia niega un trial nuevo»*.
3. Si una persona en `PRE_TRIAL` tiene fila, entonces al publicar su primera ficha la condición de
   T1 —*«no hay trial previo para ese `user + vertical`»*— es falsa. T1 no dispara nunca.
4. Si no tiene fila, `PRE_TRIAL` es exactamente la ausencia de una fila, que es lo que el cap. 03
   §2 y el glosario §2.2 niegan con todas las letras.
5. Y no hay una transición «T0» que cree la fila al entrar a la vertical: la tabla de transiciones
   es exhaustiva (núcleo cap. 03 §1.1) y su primera fila es T1.

**Dónde lo permite el diseño.**

- `HOS-1353/docs/02-modelo-de-datos.md` §2.2: *«**`UNIQUE(user_id, vertical)`** — sin condición de
  estado … el trial es único **de por vida**, así que la fila sobrevive a todo y su sola existencia
  niega un trial nuevo»*.
- `HOS-1353/docs/03-maquinas-de-estado.md` §2, T1: condición *«no hay trial previo para ese `user +
  vertical`»*; y más abajo: *«**`PRE_TRIAL` es el estado más poblado del sistema** y es un estado
  real, no la ausencia de uno»*.
- `HOS-1352/docs/nucleo/03-maquinas-de-estado.md` §1.2: *«El estado vive en una columna con dominio
  restringido.»*

**Severidad** — `CRITICA`. Toca el modelo de datos y la máquina a la vez, y el criterio de
terminación de V4 (*«un segundo trial para el mismo `user + vertical` **es imposible**»*) se apoya
justo en la restricción que crea el conflicto.

**Necesita decisión del owner** — Sí. Separar «hay fila» de «se consumió el trial» significa o bien
una columna de consumo con su propia restricción parcial, o bien sacar `PRE_TRIAL` de la tabla
`trial` y aceptar que es la ausencia de fila. La segunda contradice `DEC-TRIAL-007`.

---

### F-8A2-003 — El reconciliador de excedentes no puede evaluar su propio disparador

**Qué se rompe** — El reconciliador *«actúa sólo si algo bajó»*, y la política de caché borra
justamente el valor contra el cual habría que comparar. Encima sólo corre cuando alguien lee: para
quien no vuelve a entrar, el excedente no se reconcilia nunca.

**El camino.**

1. Un administrador cambia un override del plan de trial. Es uno de los siete eventos que invalidan
   el conjunto efectivo de `user + vertical`.
2. *«Invalidar es borrar, no recalcular»* — la entrada de caché de esas personas desaparece.
3. El reconciliador se dispara *«cuando el conjunto efectivo … se recalcula, y actúa sólo si algo
   bajó»*. El recálculo ocurre en la próxima lectura, y en ese momento **el conjunto anterior ya no
   existe en ningún lado**: fue borrado en el paso 2 y el modelo no guarda historia del conjunto
   efectivo (`domain_event` registra *«los campos que cambiaron»* de una transición, y cambiar un
   override no es una transición de ninguna de las nueve máquinas).
4. Sin término de comparación, «algo bajó» es incalculable. Las dos implementaciones posibles
   fallan para lados opuestos: comparar contra nada y no actuar nunca —límite incumplido—, o actuar
   siempre —despublicar fichas que estaban dentro del límite.
5. Y aunque el paso 4 se resolviera: si esa persona no vuelve a entrar, nadie lee, nadie recalcula,
   y su ficha excedente queda publicada indefinidamente. No hay job que barra a los afectados.

**Dónde lo permite el diseño.**

- `HOS-1353/docs/15-entitlements-y-limits.md` §4.2: *«El reconciliador de excedentes se dispara
  cuando el conjunto efectivo de un `user + vertical` se recalcula, y actúa sólo si algo bajó»*, y
  *«que falte un disparo es una capacidad regalada o un límite incumplido»*.
- `HOS-1353/docs/02-modelo-de-datos.md` §3.2, regla 1: *«**Invalidar es borrar, no recalcular.**
  Recalcular dentro de la transacción que causó el cambio la vuelve más lenta y más frágil; la
  próxima lectura lo recalcula sola.»*

**Severidad** — `CRITICA`. Las dos reglas cierran huecos distintos (`M-ENT-02` y `M-ARCH-02`), las
dos están bien por separado, y compuestas dejan al reconciliador sin poder decidir. Es rediseño de
una de las dos, no un ajuste.

**Necesita decisión del owner** — Sí: o la invalidación deja un rastro de lo que había, o el
reconciliador deja de necesitar el delta y pasa a comparar el conjunto efectivo contra el consumo
real —que es otra cosa y otro costo.

---

### F-8A2-004 — El reloj de retención arranca en T3 y nada lo detiene: borra el contenido de quien volvió

**Qué se rompe** — Pérdida de datos de un cliente en regla. El hard delete del día 180 no tiene
ninguna condición de cancelación declarada, y la transición que restituye la publicación (PB3) no
declara ningún efecto sobre ese reloj.

**El camino.**

1. El trial de una persona vence. T3 dispara y, entre sus efectos, *«arranca … el reloj de
   retención»*.
2. Día 90: la ficha sale del sitio público. *«El dueño la sigue viendo y puede exportarla o
   reactivarla suscribiéndose.»*
3. Día 170 la persona se suscribe. T5 mueve el trial a `TRIAL_CONVERTED` y *«se restituye la
   publicación»*; PB3 devuelve la ficha a `PUBLISHED`. **Ninguno de los dos toca el reloj de
   retención**: ni T5 ni PB3 lo declaran entre sus efectos, y la tabla de transiciones es
   exhaustiva.
4. Día 180: el reloj de retención cumple y borra *«el contenido publicable de la ficha (textos,
   fotos, FAQ, horarios), los borradores, las preferencias de la cuenta»* de alguien que está
   pagando desde hace diez días y cuya ficha está publicada.
5. La variante sin billing es peor y es la que se va a ver primero en las pruebas: como T2 y T5
   están inactivas por diseño, **todo trial que vence camina inevitablemente al hard delete**, sin
   que exista ninguna transición capaz de frenarlo.

**Dónde lo permite el diseño.**

- `HOS-1353/docs/03-maquinas-de-estado.md` §2, T3, efectos: *«publicación →
  `UNPUBLISHED_BY_BILLING`; arranca la campaña de recuperación y **el reloj de retención**»*. T5
  declara *«corta la campaña de recuperación; se restituye la publicación»* — y nada más.
- `HOS-1353/docs/02-modelo-de-datos.md` §4.1: la tabla de qué se borra al día 180; y §4.2 regla 3:
  *«El día 90 no borra nada … puede exportarla o reactivarla suscribiéndose.»*
- `HOS-1352/docs/nucleo/01-glosario.md` §2.1: *«el reloj de retención del §25 arranca igual en los
  dos … día 180 hard delete de lo eliminable»*.

**Severidad** — `CRITICA`. Es la única pérdida de datos irreversible del diseño y el único reloj del
programa sin condición de parada escrita.

**Necesita decisión del owner** — Sí, para fijar qué evento cancela el reloj y qué pasa con el
período ya corrido: recuperar cobertura el día 179, ¿reinicia los 180 o los descuenta?

---

## ALTA

### F-8A2-005 — Carrera T3 contra PB1: una ficha publicada sin cobertura que ningún backstop vuelve a mirar

**Qué se rompe** — Queda una ficha visible al público perteneciente a alguien sin ningún título
vivo, y no existe ningún proceso que la encuentre después.

**El camino.**

1. El job del reloj de trials corre y toma el trial de una persona cuya fecha de fin llegó. Lee sus
   fichas `PUBLISHED` para bajarlas.
2. En ese mismo instante, la persona publica una ficha desde el navegador. Su paso 5 leyó el trial
   todavía `TRIAL_ACTIVE` y lo autorizó.
3. El job escribe `TRIAL_EXPIRED` y baja las fichas que enumeró. La del paso 2 no estaba en la
   enumeración.
4. La transacción del paso 2 confirma: la ficha queda `PUBLISHED`.
5. PB2 dispara por el evento *«se pierde la cobertura»*, que ya ocurrió y no vuelve a ocurrir. El
   reconciliador se dispara por recálculo del conjunto efectivo, que también ya ocurrió. **No hay
   reloj periódico que compare publicación contra cobertura**: el cap. 15 §4.2 es explícito en que
   el disparo es por condición, no agendado.
6. La ficha sigue en el sitio público indefinidamente.

**Dónde lo permite el diseño.**

- `HOS-1353/docs/03-maquinas-de-estado.md` §9, PB2: *«`PUBLISHED` | **se pierde la cobertura** |
  `UNPUBLISHED_BY_BILLING`»* — el disparador es el hecho de perderla, no el estado de no tenerla.
- `HOS-1353/docs/15-entitlements-y-limits.md` §4.2: *«No se dispara por evento: se dispara por
  condición … cuando el conjunto efectivo de un `user + vertical` se recalcula»*.
- `HOS-1352/docs/nucleo/03-maquinas-de-estado.md` §1.3: *«Una transición es atómica junto con sus
  efectos locales»* — atómica, que no es lo mismo que serializada contra otra transición
  concurrente sobre el mismo sujeto. Ninguna regla de lectura lo exige.

**Severidad** — `ALTA`. Se arregla dentro del diseño actual, pero exige o una serialización
declarada sobre el trial o un reconciliador periódico que hoy no existe en ningún capítulo.

**Necesita decisión del owner** — No. Es una precisión de diseño, no una elección de producto.

---

### F-8A2-006 — Carrera T3 contra T4: muere un trial recién extendido, o revive el cruce «imposible»

**Qué se rompe** — El argumento de que la campaña de recuperación nunca puede quedar desmentida es
un argumento sobre estados, y se cae en cuanto dos transiciones tocan el trial a la vez.

**El camino, en sus dos órdenes.**

1. Orden A. El job de vencimiento lee el trial: `TRIAL_ACTIVE`, fecha de fin cumplida. Antes de que
   escriba, la persona canjea un promo de extensión y T4 confirma, corriendo la fecha diez días. El
   job escribe `TRIAL_EXPIRED` sobre un trial cuya fecha de fin ahora es futura. La persona compró
   diez días y recibió la campaña de recuperación.
2. Orden B. T4 lee `TRIAL_ACTIVE` y valida su condición. El job confirma primero y escribe
   `TRIAL_EXPIRED`. T4 confirma después y deja el trial en `TRIAL_ACTIVE` con fecha futura — con la
   campaña de recuperación ya encolada por T3, que *«no se reanuda por nada»* y tampoco se cancela
   por nada, porque el único corte declarado son T2 y T5.
3. El orden B es exactamente *«un camino que extienda un trial vencido»*, que el cap. 11 §7 declara
   inexistente y deja como invariante de implementación.

**Dónde lo permite el diseño.**

- `HOS-1353/docs/11-trial.md` §7: *«La campaña de RECUPERACIÓN … **no puede quedar desmentida,
  porque el cruce es imposible por construcción.** Arranca en T3 … y la única transición que
  extiende es **T4**, que exige `TRIAL_ACTIVE`. Entre las dos no hay camino.»* Y su cierre: *«si
  algún día apareciera un camino que extienda un trial vencido, este cruce volvería a existir — así
  que ese camino **no se abre sin reabrir esto**»*.
- `HOS-1353/docs/03-maquinas-de-estado.md` §2, T3 y T4: ninguna declara condición de concurrencia ni
  re-verificación de su guarda al confirmar.

**Severidad** — `ALTA`. El hueco `E-TRIAL-03` está declarado *disuelto* sobre una premisa que la
concurrencia rompe, así que hoy figura como cerrado y no lo está en el borde.

**Necesita decisión del owner** — No. Es disciplina de transición, no política.

---

### F-8A2-007 — `UNPUBLISHED_BY_BILLING` es una trampa cuando la causa fue un limit y no la cobertura

**Qué se rompe** — Una ficha bajada por excedente no vuelve nunca, aunque el excedente se resuelva.
PB3 está atada a recuperar la **cobertura**, y quien bajó la ficha fue un **limit**.

**El camino.**

1. Un administrador baja un override del plan de trial, o publica una versión nueva del plan del que
   el trial deriva. El conjunto efectivo de la persona baja: de dos fichas permitidas a una.
2. El reconciliador actúa y despublica la más reciente. Por PB2, la ficha queda en
   `UNPUBLISHED_BY_BILLING` — es la única salida de `PUBLISHED` que el sistema puede tomar, ya que
   PB6 es del dueño y PB4 es el reloj de los 90 días.
3. El administrador revierte el override. El conjunto efectivo vuelve a dos fichas. La cobertura
   nunca cambió: el trial siguió vivo todo el tiempo.
4. PB3 dispara *«se recupera la cobertura»*, con tres disparadores declarados: S5, S7 y T5. Ninguno
   ocurrió, y ninguno puede ocurrir: no hubo evento de cobertura.
5. El dueño tampoco puede sacarla: PB1 sale sólo de `DRAFT`, y la ficha está en
   `UNPUBLISHED_BY_BILLING`. Por la regla 1 del núcleo, lo que la tabla no declara no pasa.
6. La ficha queda atrapada en un estado del que sólo el sistema sale, con la condición de salida ya
   consumida.

**Dónde lo permite el diseño.**

- `HOS-1353/docs/03-maquinas-de-estado.md` §9: `| PB3 | UNPUBLISHED_BY_BILLING | **se recupera la
  cobertura** | PUBLISHED | S5, S7, T5 |`y`| PB1 | **`DRAFT`** | el dueño publica | PUBLISHED |`.
- `HOS-1353/docs/15-entitlements-y-limits.md` §4.1: el excedente hace falta *«cuando vence un addon
  … se revoca un grant … o se mueve a alguien a una versión de plan nueva»* — casos que bajan
  capacidades sin tocar la cobertura.
- `HOS-1352/docs/nucleo/03-maquinas-de-estado.md` §1.1: *«Lo que no está, no pasa.»*

**Severidad** — `ALTA`. El motivo declarado por el que `UNPUBLISHED_BY_BILLING` existe —*«hace
posible PB3»*— sólo se cumple para la mitad de las causas que llevan a él.

**Necesita decisión del owner** — No, salvo que se decida que el dueño pueda republicar a mano desde
ese estado, que sí es producto.

---

### F-8A2-008 — `ARCHIVED` no tiene salida, y dos capítulos prometen volver de ahí

**Qué se rompe** — Todo lo que entra a `ARCHIVED` queda ahí para siempre. La promesa de reactivar se
hace dos veces y no hay ninguna transición que la ejecute. Y el reconciliador declara dos acciones
—archivar y deshabilitar— que la máquina de publicación no le da.

**El camino.**

1. Una ficha en `UNPUBLISHED_BY_BILLING` llega al día 90. PB4 la lleva a `ARCHIVED`, y la nota de la
   propia transición dice que el dueño *«puede exportarla o reactivarla»*.
2. La persona se suscribe. T5 dispara y *«se restituye la publicación»*, que sólo puede significar
   PB3 — cuyo origen es `UNPUBLISHED_BY_BILLING`, no `ARCHIVED`.
3. No hay ninguna fila de la tabla cuyo origen sea `ARCHIVED`. Por la regla 1, de ahí no se sale.
4. Lo mismo, con otro sujeto, para PB5: un borrador de alguien en `PRE_TRIAL` que pasa N meses sin
   actividad se archiva, y como el evento de activación del trial es publicar, esa persona pierde
   para siempre la posibilidad de encender su trial **con esa ficha**.
5. Y el reconciliador *«archiva, despublica o deshabilita»*. Archivar es PB4, cuyo único disparador
   declarado es el reloj de los 90 días; «deshabilitar» no corresponde a ningún estado de la máquina.
   El reconciliador declara un repertorio que la máquina no tiene.

**Dónde lo permite el diseño.**

- `HOS-1353/docs/03-maquinas-de-estado.md` §9, PB4 y PB5; ninguna fila de la tabla parte de
  `ARCHIVED`.
- `HOS-1353/docs/02-modelo-de-datos.md` §4.2 regla 3: *«puede exportarla o **reactivarla
  suscribiéndose**»*.
- `HOS-1353/docs/15-entitlements-y-limits.md` §4.3: *«**Nunca borra.** Archiva, despublica o
  deshabilita»*.

**Severidad** — `ALTA`. Es un estado terminal no declarado como terminal, contra dos promesas
escritas.

**Necesita decisión del owner** — No para PB4/PB3. Sí para decidir si desarchivar es un acto del
dueño, un efecto de recuperar cobertura, o las dos cosas.

---

### F-8A2-009 — La postulación de Partner no tiene entidad, ni unicidad, ni estado «reclamada»

**Qué se rompe** — La novena máquina es la única sin tabla. Nada impide N postulaciones simultáneas
con el mismo correo, nada distingue una aprobada reclamada de una sin reclamar —que es justo la
lista que el panel tiene que mostrar— y «darla de baja» no es ninguna de las tres transiciones.

**El camino.**

1. El formulario del §17.3 es público. Alguien lo completa cien veces con el mismo correo. PP1 crea
   cien `PENDIENTE`: el cap. 02 de verticales modela `vertical`, `plan`, `plan_version`, sus dos
   tablas hijas, `trial` y `listing`, y **no modela `postulacion`**, así que no hay restricción de
   unicidad que lo impida ni dominio cerrado sobre su columna de estado.
2. Ninguna vence: *«Ninguna transición la dispara el tiempo.»* El único control es la visibilidad en
   el panel, que ahora tiene cien filas del mismo sujeto.
3. La espera configurable no ayuda: corre *«entre un rechazo y una postulación nueva»*, o sea recién
   después de PP3, y sobre un sujeto que ningún capítulo nombra —¿el correo, la razón social, la
   dirección IP?
4. El admin aprueba una. PP2 no vincula nada: manda un aviso para reclamar. Cuando alguien lo
   reclama, **el estado sigue siendo `APROBADA`**: no existe una cuarta transición ni un cuarto
   estado.
5. El cap. 19 §6 le exige al panel mostrar *«las aprobadas sin reclamar»*. El panel no puede
   calcularlo desde la máquina, porque reclamada y sin reclamar son el mismo estado.
6. El cap. 18 §2.5 dice que *«el admin puede darla de baja»*. No hay transición que lo haga.

**Dónde lo permite el diseño.**

- `HOS-1353/docs/02-modelo-de-datos.md` §2: las entidades modeladas; `postulacion` no está en
  ninguna.
- `HOS-1353/docs/03-maquinas-de-estado.md` §11: las tres transiciones, y *«**Ninguna transición la
  dispara el tiempo.**»*
- `HOS-1353/docs/18-partner.md` §2.2: *«hay una espera configurable entre un rechazo y una
  postulación nueva»*; §2.5: *«aparece como no reclamada en el panel y el admin puede darla de
  baja»*.
- `HOS-1353/docs/19-superficies.md` §6: *«las **postulaciones de Partner atrasadas** y las
  **aprobadas sin reclamar**»*.
- `HOS-1352/docs/nucleo/03-maquinas-de-estado.md` §1.2: *«El capítulo 02 fija la restricción.»*

**Severidad** — `ALTA`. El diseño eligió deliberadamente que nada venza y que la visibilidad sea el
único control; ese control lee una distinción que el modelo no guarda.

**Necesita decisión del owner** — Sí, en un punto: qué identifica a una postulación para efectos de
unicidad y de la espera. Elegir el correo tiene consecuencias que el capítulo 18 §2.4 ya rozó.

---

### F-8A2-010 — T1 se dispara dos veces para la misma persona y la restricción de base que se cita no lo ve

**Qué se rompe** — El invariante §64.1 figura entre los seis *«que sostiene la base»*, y la
restricción que lo sostiene sólo cubre el caso que nadie intenta. El caso que el diseño entero viene
a impedir —volver a registrarse— queda del lado del servicio, sin decirlo.

**El camino.**

1. Una persona consume su trial en Alojamiento. Fila de `trial` con `user_id = A`.
2. Borra la cuenta, o pasan los 180 días. La fila sobrevive, conservando *«el `user + vertical`, las
   fechas y el hash del correo normalizado»*.
3. Se registra de nuevo con el mismo correo. Obtiene `user_id = B`.
4. Publica una ficha. La condición de T1 pregunta si hay trial previo para ese `user + vertical`.
   `UNIQUE(user_id, vertical)` no la ve: `B` es otro usuario y la fila nueva entra sin conflicto.
5. Lo único que puede bloquearlo es comparar el hash del correo contra las filas consumidas, y eso
   es una lectura del servicio: **ni el cap. 02 §5 ni el cap. 04 §2.1 declaran una restricción de
   unicidad sobre el hash**. Cualquier camino que no haga esa comparación —por ejemplo el alta de
   Partner del §17.3, que crea usuarios— la esquiva.
6. T1 dispara por segunda vez para la misma persona. El §10.2 queda incumplido por el camino que
   `DEC-TRIAL-004` y el cap. 22 §3 construyeron el hash justamente para tapar.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/nucleo/04-invariantes.md` §2.1: `| 1 | trial máximo una vez por`user + vertical` |
  `UNIQUE(user_id, vertical)` en `trial`, **sin condición de estado** |` — clasificado como
  sostenido por la base.
- `HOS-1353/docs/02-modelo-de-datos.md` §5: la tabla de restricciones repite `UNIQUE(user_id,
  vertical)` y no menciona el hash.
- `HOS-1353/docs/22-lo-legal.md` §3.2: el hash *«sirve para … comparar un candidato contra lo
  consumido»* — una comparación, no una restricción.

**Severidad** — `ALTA`. Por el escalón del cap. 04 §1, bajar de base a servicio *«exige una razón
escrita»* y acá no hay ninguna, porque nadie notó que había bajado.

**Necesita decisión del owner** — No. Es clasificación de invariante, y la solución obvia es que el
hash lleve su propia restricción.

---

### F-8A2-011 — El outbox no tiene estado para retirar un aviso que dejó de corresponder

**Qué se rompe** — T4 *«re-agenda»* la campaña previa, y la fila vieja sigue en `pending` con su
fecha vieja. El cliente recibe *«faltan 2 días»* dos veces, una de ellas contra una fecha que ya no
existe. La alternativa —no agendar nada en T1— vacía la palabra «re-agenda».

**El camino.**

1. T1 declara entre sus efectos *«se agenda la campaña previa»*: cuatro hitos, a 10, 5, 2 y 0 días
   del vencimiento.
2. El correo *«se encola dentro de la transacción de dominio»*, así que esos hitos son filas de
   outbox escritas en T1.
3. Faltando 3 días, la persona canjea un promo de extensión. T4 **re-agenda**: escribe las filas
   nuevas contra la fecha nueva.
4. Las cuatro filas viejas siguen ahí. Los estados posibles del outbox son `pending`, `processing`,
   `sent`, `failed` y `retry`: **ninguno significa «ya no corresponde»**. No hay forma de retirarlas
   sin borrarlas, y borrar contradice que el outbox es el registro del intento (§44).
5. Al día siguiente sale la fila vieja de «faltan 2 días» y desmiente el canje que la persona acaba
   de hacer — que es exactamente lo que el cap. 11 §7 dice que T4 resuelve.

**Dónde lo permite el diseño.**

- `HOS-1353/docs/03-maquinas-de-estado.md` §2, T1 (*«se agenda la campaña previa»*) y T4 (*«**re-
  agenda** la campaña previa»*).
- `HOS-1352/docs/nucleo/07-outbox-y-notificaciones.md` §1: *«El §44 fija los estados: `pending`,
  `processing`, `sent`, `failed`, `retry`»*; §1.1: *«La transición escribe su estado **y** la fila
  de outbox en la misma transacción.»*

**Severidad** — `ALTA`. Es la reentrada del reloj del trial, y el capítulo 11 apoya en ella el cierre
de `E-TRIAL-03`.

**Necesita decisión del owner** — No.

---

### F-8A2-012 — La pieza consolidada de recuperación no tiene clave de deduplicación expresable

**Qué se rompe** — La ocurrencia de un correo de schedule es *«el sujeto más el hito»*, y la pieza
consolidada tiene tres sujetos. O se registra como enviada la de un solo trial —y las otras dos
quedan pendientes para siempre, o se re-mandan— o hace falta una forma de clave que el capítulo 07
no define.

**El camino.**

1. Una persona abandona tres verticales. Sus tres T3 caen el mismo día y arrancan tres campañas.
2. Al hito +5, el cap. 11 §6.2 obliga a mandar *«una sola pieza por persona y por hito, que nombra
   todas las verticales»*, consolidando **antes** de la supresión.
3. La restricción de unicidad del outbox es `(destinatario, plantilla, ocurrencia)` con ocurrencia
   `trial:<id>:pre:-2d`, o sea un solo `<id>` de trial.
4. La pieza se encola con la ocurrencia del trial de Gastronomía. Los hitos +5 de Alojamiento y de
   Experiencia no tienen fila: la próxima corrida del job los encuentra pendientes y vuelve a
   consolidar, o los da por no correspondidos y no salen nunca.
5. El caso se agrava con el corte por vertical del §6.3: cuando una de las tres convierte, la pieza
   del hito siguiente *«sale nombrando una vertical menos»* — y su clave cambia de sujeto, con lo
   que la deduplicación deja de reconocer la serie.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/nucleo/07-outbox-y-notificaciones.md` §2: *«`(destinatario, plantilla,
  ocurrencia)`»*, y para los de schedule *«el sujeto más el hito:`trial:<id>:pre:-2d`»*.
- `HOS-1353/docs/11-trial.md` §6.2: *«**Una sola pieza por persona y por hito, que nombra todas las
  verticales que le corresponden.**»*

Nota de paso: el mismo §2 se contradice a sí mismo en cuatro párrafos — *«el reloj no entra en la
clave»* y, más abajo, *«la ocurrencia entonces incluye la fecha objetivo vigente»*. Cuál de las dos
rige decide si F-8A2-011 manda un correo de más o de menos.

**Severidad** — `ALTA`. Toca la única garantía de «una sola vez» del programa, y la consolidación es
la respuesta declarada a `M-TRIAL-03`.

**Necesita decisión del owner** — No.

---

### F-8A2-013 — Esta épica se quedó sin capítulo de concurrencia, y sus máquinas son «leer y escribir»

**Qué se rompe** — Cada invariante que el cap. 04 clasifica como «servicio» es, en esta épica, una
lectura seguida de una escritura sin nada en el medio. No hay un solo capítulo del lado verticales
que diga cómo se serializa nada.

**El camino.**

1. El reparto del programa manda el capítulo 05 —*«idempotencia y concurrencia»*— entero a billing,
   y lo enumera entre los *«cinco capítulos … billing sin una sola fisura»*.
2. Del lado verticales quedan tres máquinas, un reconciliador, el reloj del trial, el reloj de
   retención y el planificador de campañas, sin ninguna regla de concurrencia propia. La única que
   hay es la regla 3 del núcleo, que habla de atomicidad de una transición, no de aislamiento entre
   dos.
3. Instancia 1: dos pestañas publican dos fichas a la vez durante un trial. Las dos pasan el paso 7,
   las dos escriben. El invariante §64.6 —*«máximo una ficha en trial»*— lo sostiene *«el primer
   override»*, o sea el servicio, sin restricción de base. Quedan dos fichas publicadas en trial y
   **nada las detecta**: el reconciliador sólo actúa si algo bajó, y acá no bajó nada.
4. Instancia 2: dos canjes de promo simultáneos contra el techo de días de trial. Los dos leen el
   acumulado, los dos verifican que entran, los dos escriben. El techo se pasa, los dos promos se
   consumen, y la regla *«se rechaza entera … y el promo no se consume»* se incumple en las dos
   mitades a la vez.
5. Instancia 3: las dos carreras de F-8A2-005 y F-8A2-006.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/11-particion-del-programa.md` §4: `| 05 | idempotencia y concurrencia | **BILLING**
  |`, y *«**Cinco capítulos son billing sin una sola fisura**: 05, 06, 09, 12 y 14.»*
- `HOS-1352/docs/nucleo/04-invariantes.md` §2.2: los catorce invariantes cuya sede es «un servicio»,
  entre ellos el 6 y el 7.
- `HOS-1353/docs/20-testing.md` §1: la capa de dominio e integración dice cubrir *«**carreras** e
  **idempotencia**»*, sin que ningún capítulo de esta épica diga contra qué regla se comprueban.

**Severidad** — `ALTA`. No es un defecto de una transición: es una categoría de defensa que el corte
entre épicas dejó de un solo lado.

**Necesita decisión del owner** — Sí, en la forma: si el capítulo 05 pasa a `nucleo/` o si la épica
de verticales escribe el suyo. Las dos épicas lo necesitan y la partición lo dio por billing.

---

## MEDIA

### F-8A2-014 — PB4 archiva la ficha de un cliente que paga: la transición no pregunta por la cobertura

**Qué se rompe** — Un anfitrión con su suscripción al día que no toca su ficha durante 90 días la ve
desaparecer del sitio público. La transición lo permite tal como está escrita.

**El camino.**

1. PB4 declara dos orígenes: `PUBLISHED` **o** `UNPUBLISHED_BY_BILLING`. Su disparador es *«día 90
   de inactividad»* y no tiene columna de condición.
2. Una ficha estable —un hotel cuyo contenido no cambia— está `PUBLISHED` y cubierta.
3. A los 90 días sin actividad, PB4 la manda a `ARCHIVED` y *«sale del sitio público»*.
4. Por F-8A2-008 no vuelve, y por el cap. 01 §2.1 el reloj de los 90 días estaba pensado para las
   inactivas por `TRIAL_EXPIRED` o `SUSPENDED`, no para las cubiertas.
5. «Inactividad» tampoco está definida: ¿de la ficha, de la cuenta, de la vertical?

**Dónde lo permite el diseño.**

- `HOS-1353/docs/03-maquinas-de-estado.md` §9:
  ``| PB4 | **`PUBLISHED`** o `UNPUBLISHED_BY_BILLING` | día 90 de inactividad | `ARCHIVED` |``.
- `HOS-1352/docs/nucleo/01-glosario.md` §2.1: *«el reloj de retención del §25 arranca igual en los
  dos»* — los dos siendo `TRIAL_EXPIRED` y `SUSPENDED`.

**Severidad** — `MEDIA`. Borde que alguien va a encontrar, y la corrección es acotar el origen de
PB4.

**Necesita decisión del owner** — No, salvo para definir qué cuenta como actividad.

---

### F-8A2-015 — La ventana del trial no declara su borde, y dos avisos dependen de cuál sea

**Qué se rompe** — Hasta 24 horas de diferencia en cuándo vence un trial, según se lea la ventana
como N×24 h desde T1 o como el fin del N-ésimo día de calendario. El aviso del día 0 y el de +1 caen
de un lado o del otro.

**El camino.**

1. El cap. 11 §1.2 fija que el reloj es *«una ventana de calendario que arranca en T1»*, y T1 ocurre
   en un instante: alguien publica a las 23:50 del martes.
2. El cap. 07 §3 fija que *«toda ventana expresada en días se computa en el huso del mercado»* y que
   *««tres días antes» significa un día del calendario, no 72 horas»* — pero lo dice sobre los
   avisos, no sobre el fin del trial.
3. Con la lectura «fin del N-ésimo día», esa persona pierde el martes entero y recibe N−1 días y
   diez minutos. Con la otra, recibe N días exactos y su trial vence a las 23:50.
4. El hito *«0 días antes»* del catálogo de correos y el hito *«+1»* de la campaña de recuperación
   se calculan contra ese mismo borde. En una lectura caen en días distintos; en la otra, el aviso
   del día 0 sale cuando el trial ya venció.
5. Lo mismo para T4: *«corre la fecha de fin»* N días — ¿sobre la fecha o sobre el instante?

**Dónde lo permite el diseño.**

- `HOS-1353/docs/11-trial.md` §1.2: *«**El reloj del trial es una ventana de calendario que arranca
  en T1 y no la detiene nada.**»*
- `HOS-1352/docs/nucleo/07-outbox-y-notificaciones.md` §3 y §6: los hitos *«10, 5, 2 y 0 días
  antes»* y *«+1, +5, +15, +30, +60 días»*.

**Severidad** — `MEDIA`. No rompe nada solo; produce un día de diferencia que después se discute
cliente por cliente.

**Necesita decisión del owner** — No.

---

### F-8A2-016 — La derivación del plan de trial se queda sin fuente si no hay versión vendible vigente

**Qué se rompe** — Retirar el último plan vendible de una vertical —un acto del lado verticales, sin
una sola línea de dinero— deja a todos los trials vivos de esa vertical sin nada de donde derivar
sus entitlements y sus limits.

**El camino.**

1. El plan de trial *«no es una entidad aparte»* y sus limits y entitlements *«no se guardan: se
   derivan»* del plan vendible de `rank` más alto y del más bajo.
2. Retirar un plan es *«publicar una versión no vendible»*. El mecanismo son las columnas `vendible`
   y `vigente` de `plan_version`, que son de esta épica.
3. Se retiran los dos últimos planes vendibles de Experiencia mientras hay trials corriendo.
4. La derivación pide *«las versiones vigentes y vendibles, la de `rank` más alto y la más baja»*.
   No hay ninguna. El paso está indefinido: no hay regla que diga qué resuelve la derivación con
   conjunto vacío.
5. El trinquete tampoco cubre: es *«un piso, no una fuente»*, y se compara **al final** contra el
   resultado. Sin resultado no hay con qué comparar.

**Dónde lo permite el diseño.**

- `HOS-1353/docs/02-modelo-de-datos.md` §2.1: *«Sus limits y entitlements **no se guardan**: se
  derivan en cada resolución, del plan vendible de `rank` más alto y del más bajo»*.
- `HOS-1353/docs/10-verticales-planes-billing-options.md` §2:
  ``| **la derivación del plan de trial** | las versiones **vigentes y vendibles**, la de `rank` más alto y la más baja |``.
- `HOS-1353/docs/15-entitlements-y-limits.md` §2.5: *«El trinquete … es un **piso**, no una fuente.
  Se compara al final.»*

**Severidad** — `MEDIA`. Requiere un acto administrativo poco frecuente, y se rompe entero cuando
ocurre.

**Necesita decisión del owner** — No.

---

### F-8A2-017 — G5 vigila transiciones, y dos de los siete disparadores no son transiciones

**Qué se rompe** — El guard que garantiza que *«ninguna fuente se apaga sin pasar por el
reconciliador»* se comprueba sobre los efectos declarados de las transiciones del cap. 03. Dos de las
siete entradas de la lista que dispara el recálculo no son transiciones de ninguna máquina, así que
el guard no puede verlas y su mensaje afirma más de lo que su predicado verifica.

**El camino.**

1. La lista de siete que invalida el caché incluye *«se publica una versión nueva de un plan al que
   hay suscripciones ancladas»* y *«cambia un override del plan de trial»*. Las dos son escrituras
   de configuración, no transiciones.
2. G5 *«se comprueba sobre los efectos declarados de las transiciones del capítulo 03»*.
3. Un administrador cambia un override y baja las capacidades de todos los trials de la vertical.
   Ese camino no aparece en ninguna tabla de transiciones, así que G5 pasa en verde.
4. La regla del cap. 20 §2.1 se incumple: *«el texto con que falla no puede afirmar más de lo que el
   predicado verifica»*, y el texto de G5 dice «ninguna fuente», no «ninguna transición».

**Dónde lo permite el diseño.**

- `HOS-1353/docs/15-entitlements-y-limits.md` §4.2: *«**El guard**: ninguna fuente se apaga sin pasar
  por el reconciliador. Se comprueba sobre los efectos declarados de las transiciones del capítulo
  03.»*
- `HOS-1353/docs/02-modelo-de-datos.md` §3.2: la tabla de siete eventos.
- `HOS-1353/docs/20-testing.md` §2.1: *«el texto con que falla no puede afirmar más de lo que el
  predicado verifica»*.

**Severidad** — `MEDIA`. El guard sirve para lo que cubre; el problema es que se lo lee como si
cubriera las siete.

**Necesita decisión del owner** — No.

---

## BAJA

### F-8A2-018 — «Cae lo más reciente primero» no dice qué fecha, y republicar reordena la cola

**Qué se rompe** — El criterio se eligió por predecible y se obliga a escribirlo en el aviso. Con dos
fechas posibles —cuándo se publicó por primera vez y cuándo se publicó la vez vigente— el cliente que
despublicó y republicó una ficha vieja ve caer primero la que considera la más antigua.

**El camino.**

1. El dueño publica la ficha A en enero y la B en marzo.
2. En abril despublica A por PB6 y la vuelve a publicar en mayo por PB1.
3. Baja el límite a una ficha. El reconciliador despublica *«las publicadas más recientemente»*.
4. Con la fecha de la publicación vigente cae A; con la de la primera publicación cae B. El aviso
   dice el criterio y no dice la fecha, así que no permite anticipar cuál.

**Dónde lo permite el diseño.**

- `HOS-1353/docs/15-entitlements-y-limits.md` §4.3: *«cae lo más reciente primero, hasta entrar en el
  límite, y el criterio va escrito en el aviso»*.
- `HOS-1353/docs/03-maquinas-de-estado.md` §9: *«se despublican **las publicadas más recientemente**
  … y **el criterio va escrito en el aviso** — si el cliente no puede leerlo, deja de ser
  predecible»*.

**Severidad** — `BAJA`. Falta precisión; no falla.

**Necesita decisión del owner** — No.

---

## Ataques que intenté y el diseño resistió

1. **Reentrada del job de vencimiento a la mitad de una tanda.** Si el reloj del trial muere después
   de procesar 400 trials de 10.000, la re-corrida no los toca dos veces: la guarda de T3 exige
   origen `TRIAL_ACTIVE` y los 400 ya están en `TRIAL_EXPIRED`. La regla 1 del núcleo —*«un intento
   de transición que la tabla no declara no se ejecuta»*— cierra la puerta sin necesidad de un
   candado. El agujero no es la reentrada del job sino la carrera con otro actor (F-8A2-005).
2. **Doble T1 por doble click sobre la misma ficha.** Intenté hacer que una persona consumiera dos
   trials de la misma vertical con dos publicaciones simultáneas. `UNIQUE(user_id, vertical)` sin
   condición de estado lo impide en la base, que es el nivel correcto: una de las dos transacciones
   muere. El problema con esa restricción es otro y está en F-8A2-002 y F-8A2-010.
3. **Extender un trial ya vencido con una cortesía.** El cap. 11 §7 lo cierra bien: *«una cortesía
   sobre alguien en `TRIAL_EXPIRED` no tiene nada que extender»*, y las dos vías —§32 y §34.1— se
   cierran por separado. El ataque sólo funciona por la carrera de F-8A2-006, no por el diseño.
4. **Recuperar el trial borrando y recreando la ficha.** Bien cerrado, en tres niveles a la vez: el
   §10.2, la fila que no se borra nunca y PB6 que explícitamente *«no devuelve el trial»*. El reloj
   de calendario del cap. 11 §1.2 cierra además la variante lenta —publicar, despublicar, volver en
   seis meses— nombrándola como el motivo de la regla.
5. **Hacer que el correo transaccional bloquee una transición de trial.** No se puede: el correo se
   encola dentro de la transacción y se manda afuera, y la única excepción declarada
   (`DEC-MAIL-001`) está acotada a la cancelación, que es de la otra épica.
6. **Dejar una `PENDIENTE` de Partner colgada para siempre como daño.** El cap. 18 §2.5 demuestra
   que es inofensiva, y el argumento se sostiene: la suscripción es el último de los nueve pasos,
   así que un Partner sin reclamar no publica ni cobra. El defecto de esa zona es el de F-8A2-009 —
   que el panel no puede calcular la lista— no que la fila exista.
7. **Colar una operación sin vertical para escaparle al paso 5.** El scope estructural del cap. 17
   §2 lo impide de verdad: la firma no se puede expresar sin la vertical, y G2 lo comprueba. El
   §2.4 anticipa además el caso global y lo resuelve sin excepción.
8. **Aprovechar que T2/T5 están inactivas para dejar un trial en un estado intermedio.** No hay
   estado intermedio: la máquina tiene cuatro estados y todos son alcanzables por una sola
   transición. La inactividad declarada de T2 y T5 no crea un estado colgado, crea un camino menos.

---

## Fuera de mi vector

Anotado y no perseguido. Los dos primeros son `NUCLEO`.

1. **`NUCLEO` — El §2 del capítulo 07 se contradice sobre si la fecha entra en la clave de
   deduplicación.** *«Y el reloj no entra en la clave»* contra *«La ocurrencia entonces incluye la
   fecha objetivo vigente»*, cuatro párrafos después. Lo toqué al pasar en F-8A2-012 porque decide
   su desenlace, pero el defecto es del núcleo y lo comparten las dos épicas.
2. **`NUCLEO` — El cap. 08 §1.3 declara `domain_event` append-only *«sin `update` y sin `delete`»* y
   en la línea siguiente admite un `update` al día 180.** Si el append-only se hiciera cumplir en la
   base —que es lo que la palabra sugiere— la anonimización sería imposible; si no se hace cumplir
   en la base, el append-only es una convención. Es materia del agente de datos.
3. **Acceso cruzado (A1) — la espera de re-postulación se puede usar contra un tercero.** Si la
   espera del cap. 18 §2.2 se lleva por correo, cualquiera puede postular con el correo de un
   competidor, dejar que lo rechacen, y quemarle la ventana. El §2.4 resolvió el caso gemelo —que el
   correo ya pertenezca a alguien— y este quedó del otro lado.
4. **Datos (A3) — `trial.user_id` queda apuntando a una cuenta borrada.** La fila *«sobrevive al
   borrado de la cuenta»* conservando el `user + vertical`; qué pasa con esa referencia es del
   modelo, no de la máquina.
5. **Acoplamiento (A3) — `postulacion` no aparece en ningún capítulo de modelo de datos de ninguna
   de las dos épicas.** Lo reporto como defecto de máquina en F-8A2-009; que además falte del
   reparto del cap. 11 §4 es materia del agente de acoplamiento.

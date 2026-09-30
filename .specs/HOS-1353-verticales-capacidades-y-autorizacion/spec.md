---
title: Verticales — capacidades, entitlements, limits y autorización
linear: HOS-1353
statusSource: linear
created: 2026-09-18
updated: 2026-09-25
type: feature
areas:
  - api
  - db
  - web
  - admin
parent: HOS-1352
---

# Verticales — capacidades, entitlements, limits y autorización

> **Esta épica se sostiene sola.** No espera a que la de billing esté definida, y su diseño vive
> acá adentro — no en otro documento. Se puede implementar sin saber con qué pasarela vamos a
> cobrar.
>
> **Pero no sale a producción sola** (`DEC-ARCH-007`). La autonomía es para **desarrollar**: las
> dos épicas llegan juntas y terminadas. Acá **«terminada» significa lista y verificada contra el
> contrato**, esperando a la otra — no desplegada.

## 1. De dónde sale

El programa [HOS-1352](../HOS-1352-billing-verticals-redesign/spec.md) quedó detenido por una sola
cosa: ~~**no está decidida la pasarela.** Mercado Pago niega el cobro a demanda con un `403`
comercial y el candidato que sí lo documenta tiene el alta en revisión de KYC.~~ **la pasarela
no estaba decidida.** Tachado 2026-09-26: ya lo está. Mercado Pago es el proveedor y lo que no
hace lo suple el diseño (`DEC-MP-005`); el mandato del proveedor es el modelo canónico, sin
destino pendiente de cargo puntual (`DEC-MP-006`).

**Ese bloqueo alcanza al dinero y no alcanza a las capacidades.** `DEC-ARCH-005` parte el programa
en dos épicas autónomas y ésta es la que arranca. El corte, con su fundamento, está en
[`11-particion-del-programa.md`](../HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md).

**La frontera, en una línea:**

> Es de esta épica si sólo necesita saber **qué puede hacer una cuenta**, sin preguntar si pagó.

Es el criterio del owner —*«toca plata o no toca plata»*—, y no hubo que inventarlo: el capítulo 15
ya lo había escrito al cerrar, separando su materia de la de promos y cortesías con las palabras
exactas — *«acá se agregan **capacidades**, allá se compone **dinero**»*.

---

## 2. El diseño de esta épica

Once capítulos, en [`docs/`](./docs/). **Son de esta épica**: ningún otro documento los contiene,
~~y ninguno de ellos necesita leer uno de la épica de billing para estar completo~~ **y citan a
billing donde el comportamiento cruza** (`NUCLEO/00`: las dos épicas se citan entre sí); lo que
cruza por contrato es la cobertura (`12-contrato…`) (FASE 9 vuelta 1, `F-8V1D1-008`).

| # | capítulo | qué resuelve |
|---|---|---|
| `02` | [modelo de datos](./docs/02-modelo-de-datos.md) | el catálogo de planes **sin el precio**, la ficha, el caché del conjunto efectivo, la retención |
| `03` | [máquinas de estado](./docs/03-maquinas-de-estado.md) | **tres**: Trial, Publicación y Postulación de Partner |
| `10` | [verticales y planes](./docs/10-verticales-planes-billing-options.md) | el Eje 2 como lista cerrada, y qué se lee del catálogo desde dónde |
| `11` | [trial](./docs/11-trial.md) | el reloj de calendario, el techo de días, la reparación, la campaña de recuperación |
| `15` | [entitlements y limits](./docs/15-entitlements-y-limits.md) | las cuatro estrategias de agregación, el scope, el excedente, el visitante sin cuenta |
| `17` | [autorización](./docs/17-autorizacion.md) | los ~~nueve~~ siete pasos, el scope estructural, actor ≠ sujeto, el rol que no se revoca |
| `18` | [Partner](./docs/18-partner.md) | la presencia —la página y el carrusel, cada uno con su clave, y su bit de moderación (owner 2026-09-25; FASE 9 completa, 7b y 7c)— y la postulación |
| `19` | [superficies](./docs/19-superficies.md) | Mi Cuenta, los mensajes de trial y de excedente, las postulaciones, **y el botón de suscribirse que manda a publicar a quien todavía no publicó** (owner 2026-09-25; FASE 9 completa, 6c) **si publicar le arrancaría el trial, con la regla escrita sólo en `19` §4 fila 23** (FASE 9 vuelta 1, `F-8V1D1-004`) |
| `20` | [testing](./docs/20-testing.md) | las cuatro capas y ~~**diecisiete guards**~~ ~~**dieciocho guards**~~ ~~**diecinueve guards**~~ ~~**veinte guards**~~ ~~**veintiún guards**~~ **diecinueve guards** (revisión del owner, 2026-09-28: `G-R3` y `G-R5-B` pasan a ser validaciones del panel, por N1 y C9, y conservan su fila sin contarse; antes, en la misma revisión, la cifra se mantuvo: sale `G-R5` por C14 y entra `G14` por N6; `G-R5-B`, FASE 8 completa; `G-R2-C`, owner 2026-09-25, FASE 9 completa, 4e; `G13`, que vino de `B/20` §2: owner 2026-09-26, `G5-5`; `G-R9`, la lista cerrada de `PURGED`: FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-k`) |
| `21` | [migración](./docs/21-migracion.md) | el trial ya consumido —~~que el corte sembraba~~ **que el corte no siembra: los dueños del sistema viejo arrancan como clientes nuevos** (owner 2026-09-25; FASE 9 completa, 2g)—, cómo amanece la población existente, **con su ficha a la vista publicada y una prueba gratis activa desde el día del corte** (revisión del owner, 2026-09-28, C12), la escritura `C` de `inactiva_desde`, y por qué no hay deuda de datos |
| `22` | [lo legal](./docs/22-lo-legal.md) | ~~las señales de identidad y~~ el ~~hash irreversible~~ **seudónimo determinístico** del correo (FASE 9 completa, `C-1`); las señales que sólo observaban (teléfono, identificador fiscal, dispositivo) no se guardan (revisión del owner, 2026-09-28, N7, `g2`) |

### 2.1 Lo que cita y no contiene

Tres cosas, y ninguna la bloquea — las tres están escritas y cerradas:

| qué | dónde | por qué no está acá |
|---|---|---|
| **el núcleo** — reglas de escritura, glosario, invariantes, outbox, auditoría, y el método del modelo de datos y de las máquinas | [`docs/nucleo/`](../HOS-1352-billing-verticals-redesign/docs/nucleo/) | es vocabulario y método común. Partirlo lo rompe: un glosario en dos mitades deja de ser un glosario, y los ~~51~~ **54** invariantes numerados de corrido (37 + `D1`–`D17`, `NUCLEO/04` §3; recontado en la salida 3 de la FASE 9 completa) pierden lo único que los hace útiles — poder preguntar **una vez** si están todos |
| **el contrato de cobertura** | [`12-contrato-de-cobertura.md`](../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md) | es **la frontera**, y por eso tiene una sola fuente que ninguna de las dos épicas puede mutar sola |
| **el PDR y el decision log** | [`docs/`](../HOS-1352-billing-verticals-redesign/docs/) | son las fuentes del programa entero |

---

## 3. Las definiciones declaradas

Lo que esta épica da por fijado. Cada una con su capítulo; ninguna se re-litiga acá.

### 3.1 Qué diferencia legítimamente a una vertical de otra

**El Eje 2 es una lista cerrada de ocho ítems y todo lo demás es Eje 1.** Los ocho: el evento que
activa el trial, qué publica, la sección de Mi Cuenta, qué claves tienen sentido, el camino de
alta, si hereda Turista VIP, los métodos de pago admitidos y si tiene pricing propia.

**La consecuencia, que es el corazón del rediseño**: Alojamiento, Gastronomía y Experiencia
**coinciden en siete de los ocho** y difieren sólo en cuál subconjunto de claves tiene sentido —
configuración en base, no comportamiento. **Tres verticales que coinciden en siete ítems no
justifican una sola línea de código separado** (cap. 10 §1.1).

Las dos que sí difieren de verdad son **Turista** (no publica nada, y es el origen de la herencia
en vez de su destino) y **Partner** (no tiene trial, no es self-service, y su presencia no es una
ficha). Las dos caen dentro de la lista cerrada.

**Lo que NO es Eje 2 aunque lo parezca**: los ciclos que ofrece un plan, el grace, la pausa, los
días de trial y los overrides. Son **valores** configurables por plan, y el Eje 2 es variación de
*comportamiento*, no de *valores*.

### 3.2 Qué sale de la base y qué sale del código

**El catálogo de claves es código; la configuración comercial es base.** Una clave existe porque
hay código que la respeta; qué plan la otorga y con qué valor es un dato.

El guard va en **las dos direcciones**: una clave usada en código que no está en la base falla, y
una de la base que no está en el catálogo también (`G3`). Cada dirección es un defecto distinto —
un permiso que nunca se puede otorgar, y configuración que nadie va a leer.

### 3.3 El catálogo de planes es de esta épica, menos el precio

De las seis entidades del catálogo comercial, **cinco no tienen un solo campo de dinero**:
`vertical`, `plan`, `plan_version` —que guarda `rank`, vendible, días de grace, días de trial,
permite pausa, hereda VIP—, `plan_version_entitlement` y `plan_version_limit`. **El precio vive en
una sola tabla hoja, `billing_option`**, que es de la otra épica.

*(Desde la FASE 8 el catálogo de addons se parte por el mismo corte, por campo: `addon` y
`addon_version` —qué otorga, vigencia, scope— son de esta épica, y `addon_product` —precio,
recurrencia y **verticales compatibles**— de la otra (cap. 02 §2.1). ~~Y `vertical` guarda
`admite_altas`, que billing lee por la dirección inversa del contrato §4.1; la fecha de fin de
servicio la calcula billing y verticales la pregunta por `finDeServicio` (owner 2026-09-27, FASE 9
vuelta 2, `R5`).~~ (Salen con la revisión del owner, 2026-09-28, C8: las verticales no se
discontinúan.)
Nota de la salida 3 de la FASE 9 completa, sin cambio de sentido.)*

**Eso es lo que vuelve independiente al trial**: deriva su plan del vendible de `rank` más alto y
del más bajo, y las dos columnas están en `plan_version`. **Un trial se resuelve entero sin que
exista un precio en la base.**

### 3.4 Cómo se agrega un limit

**La estrategia se declara con la clave, no con el plan**, y la lista es cerrada: `SUMA`,
`MÁXIMO`, `MÍNIMO` y `MEJOR_DECLARADO`. Las tres últimas son la misma regla dicha de tres formas:
**gana la fuente más favorable**.

Vive con la clave porque, si la declarara el plan, dos planes de la misma vertical podrían
declarar estrategias distintas para la misma clave y **la clave significaría dos cosas**.

**Cuando no acumula, gana el cliente.** La alternativa es que comprar un addon te deje peor que
antes, y eso no se puede defender ante nadie.

### 3.5 Qué scope tiene una clave

**Cada clave declara si es de vertical o global.** Y la defensa contra el cruce entre verticales es
**estructural, no un chequeo**: una clave de vertical se resuelve por `user + vertical`, así que
no se puede invocar sin la vertical. No hay un control que alguien pueda olvidar.

**El scope de la clave dice dónde vale; la fuente dice por cuánto tiempo.**

### 3.6 Cómo se autoriza una operación

**~~Nueve~~ Siete pasos, en un orden que no es preferencia** (son nueve verificaciones agrupadas en
siete pasos y una precondición: FASE 9 vuelta 1, contradicción (e)): va de lo que no depende de nada hacia lo que
depende de todo, y cada paso revela lo mínimo.

1. quién es · 2. estado de la persona · 3. permiso · 4. el recurso: existencia, estado y dueño ·
5. ~~**título vivo**~~ **fuente viva** (el paso 5 acepta el piso, que no es título: cap. 17 §1.2, precisión 5) · 6. entitlement · 7. limits — con el **contexto de vertical** como precondición
estructural, no como paso.

**Y la precondición se lee del recurso, nunca del pedido**: en una operación sobre algo que guarda
su vertical —la ficha y su contenido, la presencia de Partner, la instancia de addon— la vertical
es la del recurso, y si el pedido declara otra, **no existe**. **La vertical de una ficha es
inmutable desde el alta** (cap. 17 §1.2, precisión 6; la mitad *(c)* de `G2`) — FASE 8 completa,
`F-8CA1-001`; owner 2026-09-25, FASE 9 completa, 7a.

~~Tres precisiones que el orden hace cumplir:~~ **Las precisiones que el orden hace cumplir** —el
cap. 17 §1.2 tiene ~~siete~~ ~~ocho~~ nueve (la octava, FASE 9 vuelta 2, `F-8V2A1-002`; la novena, `PP1` como segunda excepción del guest, FASE 9 vuelta 3, owner 2026-09-30, lotes I y M); éstas son las que esta spec necesita para leerse sola (salida 3 de la
FASE 9 completa)—:

- **El paso 4 responde «no existe» a las tres cosas.** Un recurso ajeno, uno archivado y uno
  inexistente son indistinguibles desde afuera; decir *«no es tuyo»* confirma que el id existe.
  **Para su dueño no**: una ficha `ARCHIVED` le acepta verla, exportarla y reactivarla (`PB8`)
  **—y borrarla, `PB12`—**, que es lo que `DEC-DATA-001` promete (cap. 17 §1.2, precisión 1). **Y le alcanza el paso 6
  aunque no pague nada**, porque la versión de piso otorga *«recuperar lo suyo»* (cap. 02 §2.1):
  sin eso la promesa era inejecutable justo para la población a la que se le borra el contenido.
- **Lo ajeno existe sólo en estado público** (precisión 7; owner 2026-09-25, FASE 9 completa, 8c):
  para quien no es el dueño, el recurso existe sólo si es una ficha `PUBLISHED` o una presencia de
  Partner ~~con la clave vigente y sin moderar~~ **con la clave de esa superficie** —«página propia»
  para la página, «presencia en el carrusel» para el carrusel (cap. 18 §1.2)— **vigente y sin
  moderar** (FASE 9 vuelta 1, `F-8V1A1-004`). Todo lo demás contesta como inexistente. **Y sólo
  para leer: una escritura exige `sujeto = dueño`, y sobre lo ajeno contesta *«no existe»*** (FASE 9
  vuelta 2, `F-8V2A1-001`).
  **Las conversaciones, las reseñas y los comentarios son de quien los escribe**, y el turista
  los crea sólo sobre una ficha `PUBLISHED`; sobre otra contesta *«no existe»*, sin exención por
  superficie (FASE 9 vuelta 3, `F-8V3A1-003`).
- **El sujeto no lo elige el pedido** (precisión 8; FASE 9 vuelta 2, `F-8V2A1-002`): fuera de las
  operaciones de `actor ≠ sujeto` es el actor, y en ellas es el dueño del recurso, leído del
  recurso.
- **El estado de la persona va antes del permiso**, porque al revés una cuenta ~~inhabilitada~~ **con
  el correo sin verificar** puede averiguar qué permisos tiene probando operaciones. *(«Inhabilitado
  por abuso» salió del paso 2: no tenía dato que lo escribiera, y el abuso se trata ficha por ficha
  con `MODERATED` — owner 2026-09-25, FASE 9 completa, 8b.)*
- **Los limits van últimos** porque son los únicos que necesitan contar — **y, en una transición
  que ocupa cupo, los pasos 5 a 7 se evalúan dentro de un lock por `user + vertical`** (cap. 03 §9;
  FASE 8 completa, `R14`, owner 2026-09-25).

**Qué pasos recorre una lectura**: toda operación corre la resolución, pero una lectura no pasa
por el paso 5, y **una lectura de lo propio —Mi Cuenta, su billing, sus fichas— tampoco por el 6**,
así que un suspendido puede ver cómo regularizar (cap. 17 §3.5; owner 2026-09-25, FASE 9 completa,
8d).

**Y los ~~nueve~~ siete se resuelven en un solo lugar.** El invariante no es que cada servicio los haga: es
que **ninguno los haga por su cuenta**.

### 3.7 Actor y sujeto

**Toda operación lleva dos identidades** y casi siempre coinciden. Lo que autoriza que difieran es
**un permiso de esa acción concreta**, nunca una condición general de «es administrador».

**El admin no hereda los entitlements del sujeto**: los pasos 5, 6 y 7 se evalúan sobre el sujeto,
y la excepción son las catorce primeras acciones de `NUCLEO/08` §3 ~~**y la decimosexta,
discontinuar una vertical** (owner 2026-09-27, FASE 9 vuelta 2, `Q-ACC16`)~~ (la decimosexta salió con la revisión del owner, 2026-09-28, C8) **y la decimoséptima, migrar a los clientes de un plan retirado** (la misma revisión, C15), **y de la decimoctava a la vigesimosegunda, las cinco del catálogo** (la misma revisión, N1 y C9), **y la vigesimocuarta, ~~borrar una cuenta~~ **dar de baja una cuenta** (caso I-C) a pedido de su dueño** (revisión del owner, casos vecinos, 2026-09-29, caso F-C), **y la vigesimoquinta, vaciar la presencia de un Partner a pedido de su dueño** (verificación corta, 2026-09-29, lote N-G), **y la vigesimosexta, ~~asignar~~ asignar o quitar el rol `SUPER_ADMIN` a una cuenta (el nombre, lote AC), cuyo permiso, como el de las otras filas *«sólo `SUPER_ADMIN`»*, viene sólo con el rol y no se da suelto** (FASE 9 vuelta 3, owner 2026-09-30, lote P): la decimoquinta,
editar el contenido de una ficha ajena, se evalúa sobre el dueño (cap. 17 §3.2 regla 3; FASE 9 vuelta 2,
`F-8V2A1-004`), **y la vigesimotercera, borrar una ficha ajena a pedido de su dueño, también** (caso F-C). **Y leer lo ajeno pide el permiso de inspección de esa entidad**, que no es una
fila de aquel catálogo (cap. 17 §3.2 regla 1; `F-8V2A1-002`).
**Y no existe la impersonación** — impersonar hace que el registro diga que lo hizo el cliente, y
ése es exactamente el rastro que no se puede perder. **Y una acción administrativa nunca tiene
`actor = sujeto`**: el paso 3 la rechaza y la hace otra cuenta con el permiso (cap. 17 §3.2 regla
5; owner 2026-09-26, `G5-1`). **Compara cuentas, no personas**: se declara, con detector en el
resumen de `DEC-OBS-001`, y la confirmación por una segunda persona entra cuando haya otra persona
con el permiso (owner 2026-09-26, `Y-2`).

### 3.8 El rol no se toca al perder el acceso

**Perder el acceso NUNCA revoca un rol**: ni la suspensión, ni el vencimiento del trial, ni la
cancelación, ni la pausa.

**El rol dice a qué familia de operaciones pertenece la persona; el estado de acceso dice si hoy
puede ejecutarlas.** Son dos ejes independientes, y los pasos 3 y 5 están separados para que
puedan discrepar.

Va con su mitad obligatoria: **ninguna autorización decide sólo por rol** (`G6`). Las dos juntas o
ninguna funciona. **Y ningún rol es una fuente**: el conjunto efectivo sale sólo de las fuentes de
`cobertura()`, y el cargador que le da el conjunto entero al staff se retira (cap. 17 §4.3; la
segunda mitad de `G6`; FASE 9 vuelta 1, `F-8V1A1-002`).

### 3.9 El trial

**Es único de por vida por `user + vertical`**, impuesto por una restricción de base sin condición
de estado. **El reloj es de calendario y no lo detiene nada** — ni despublicar, ni borrar la ficha,
ni dejar de entrar.

**Se consume al ejercer el evento de activación o con el primer pago, nunca con una autorización.**
Una suscripción convierte el trial recién con su primer pago acreditado (`T2`, `T5`;
`DEC-TRIAL-010`), y **suscribirse antes de publicar no lo quema**: `T6` exige un título que
convierte, ~~y quien pagó sin haber publicado consume su fila por `T8`, al primer pago~~ quien
publicó con una suscripción que todavía no cobró consume su fila por `T8`, al primer pago, y quien
pagó sin haber publicado sigue en `PRE_TRIAL` y la consume `T6` cuando publique (FASE 9 vuelta 1,
`F-8V1A2-004`) ~~—**salvo que le haya vuelto una ficha por `PB3` o `PB7` bajo esa suscripción: eso
cuenta como ejercicio del evento para `T8`, que la consume al primer pago** (owner 2026-09-27, FASE
9 vuelta 2, `R15`)—~~ (la salvedad `R15` salió: revisión del owner, 2026-09-28, C12, `L1-b`). La superficie
lo evita antes: **el botón de suscribirse de quien todavía no publicó en esa vertical lo manda a
publicar** **si publicar le arrancaría el trial**, que arranca su trial (cap. 03 §2, cap. 19 §4
fila 23, donde está la regla entera; owner 2026-09-25, FASE 9 completa, 6c; FASE 9 vuelta 1,
`F-8V1D1-004`).

**El trial no vuelve; lo que hay es reparación hacia adelante.** Mientras sigue vivo se extiende;
si ya venció, la reparación es un instrumento de la otra épica.

**Y tiene techo**: cada vertical declara un máximo de días acumulados, en base y no en código.

### 3.10 El excedente

**No se dispara por evento: se dispara por condición** — cuando el conjunto efectivo de un
`user + vertical` se recalcula y **dejó de coincidir con el límite, en cualquiera de las dos
direcciones**. Enumerar puntos de invocación es cómo se olvida el séptimo.

**Nunca borra**: archiva, despublica o deshabilita. **Cae lo más reciente primero**, y el criterio
va escrito en el aviso.

**Y vuelve primero lo que cayó al final**, hasta llenar el cupo, con el criterio escrito en el
aviso también. Es el mismo criterio recorrido al revés, no un segundo criterio: con él **lo que
queda arriba depende sólo del límite y no del camino**. Sin esa mitad, el que vuelve a subir de
plan paga el grande y recibe el chico, porque su cobertura nunca se interrumpió y no hay cambio
que disparar (`DEC-DATA-003`).

**La ventana para elegir existe sólo cuando la fecha se sabía.** Prometer una ventana que a veces
no existe es peor que no prometerla: cuando no la hay, el aviso dice **qué se hizo** y cómo
revertirlo.

### 3.11 El visitante sin cuenta

**Es un actor del modelo, no la falta de uno.** **No recibe ningún entitlement medido**, y de los
booleanos sólo los de lectura pública — enunciado **por clase** para que una clave medida nueva no
quede habilitada por omisión.

No hay cuota chica para el guest porque **una cuota necesita a quién imputarla**, y sin cuenta lo
único disponible se elude trivialmente.

---

## 4. El contrato con la épica de billing

Todo lo que esta épica necesita de HOS-1354 es **un hecho y un aviso**: una consulta de cobertura
por `user + vertical`, y el evento que avisa que esa cobertura cambió. Los dos están definidos —y
**sólo** definidos— en
[`12-contrato-de-cobertura.md`](../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md):
**la firma exacta, con todos sus campos y su tabla de qué es cada uno, es su §2**; el aviso es su
§3; y **cuáles fuentes cuentan para `cubierto` y cuáles no** es su §2.4.

> **Acá no va una copia de la firma, y la ausencia es el arreglo.** `DEC-ARCH-006` protege al
> contrato de que una épica lo mute sola, pero **una copia no necesita que nadie la mute para
> divergir: alcanza con que el contrato avance**. Ésta existió y divergió — publicaba **tres campos
> de cinco**, sin `alcance` y sin `objetivo`, y sin `objetivo` el pliegue en dos tramos del §2.7 no
> se puede calcular, así que **un addon comprado para una ficha habilitaba su capacidad en toda la
> cartera** (`F-8dC2-001`). El campo que haga falta acá se lee allá.

El mismo hecho lo pedía el diseño en cuatro lugares con cuatro nombres, **antes de que el contrato
existiera**: el paso 5 de la autorización, la transición `PB2` de publicación, la pérdida de
beneficios de turista al suspender, y el disparador del recálculo del conjunto efectivo. **Eso es
una tabla histórica y no el censo de quién lo consume**, que vive en la fila `cubierto` del
contrato §2.1 y hoy es más larga ~~—lleva además `PB3`, `PB7`, `PB4`, `PB5` y el hard delete del día
180—~~ **—no se enumera acá: esa enumeración ya había caducado (le faltaban `T1`, `T6` y el
reconciliador diario de cobertura), que es el defecto que este párrafo describe; salida 3 de la FASE
9 completa—**. Contar acá para saber cuántos hay da una cifra congelada, que es lo que le pasó a la regla de
vigilancia del §4.2 del contrato.

**Nada más cruza la frontera**: ni montos, ni estados de pago, ni ids del proveedor, ni fechas de
cobro —sobre cobros cruza un solo bit, `cobrada`, declarado en el contrato §4 (`DEC-TRIAL-010`)—.
**Y desde la FASE 9 completa cruza también `piso`**, en la fuente `GRANT`: una versión de plan, no
dinero, para que el trinquete del grant no tenga que leer una tabla de billing (contrato §2.1;
owner 2026-09-25, 9h).
Ni siquiera el estado exacto de la suscripción — esta épica no distingue `ACTIVE` de
`GRACE_PERIOD`, porque durante el grace el servicio sigue.

### 4.1 Cómo se construye sin que exista billing

**El trial ya es un título vivo, y el trial no es billing.** La implementación de arranque del
contrato resuelve de verdad las **dos** fuentes que ya viven de este lado —el trial, con su máquina
del capítulo 03 §2, y el título `BASE` del contrato §2.5— y responde que no a las **cuatro** de
billing: suscripción, cortesía, grant y addon (contrato §5.1).

**El piso no es un agregado cosmético a esa lista.** Sin `BASE`, un `TRIAL_EXPIRED` no tiene
ninguna fuente en el paso 5 y el paso le niega **la operación de suscribirse**, que es la única
forma de volver a tener un título: queda afuera para siempre (contrato §2.5). Y el piso **no
devuelve `cubierto` a verdadero** —es de clase `BASE`, no `TÍTULO`—, así que `PB2` sigue disparando
cuando el trial vence.

**Y otorga TRES cosas, no dos** (cap. 02 §2.1): ninguna capacidad comercial, contratar una
suscripción, y **recuperar lo suyo** —ver, exportar y traer a borrador una ficha propia archivada
(`PB8`)—. La tercera es la que vuelve ejecutable la defensa del hard delete del día 180 para quien
no vuelve a pagar, que es exactamente su sujeto.

Con eso se construye y se prueba **entero**: la autorización recorre sus ~~nueve~~ siete pasos, la máquina de
publicación tiene vivo su `PB2` alimentado por `T3`, el reconciliador de excedentes corre disparado
por las transiciones de trial, **el reconciliador diario de cobertura compara el contrato con las
fichas una vez por día (`V/03` §9, `DEC-ARCH-009`)**, y la agregación de limits y los scopes no tienen ninguna dependencia
que defaultear porque nunca preguntaron por dinero.

**No es un stub de datos fijos, y la diferencia decide el ejercicio**: un simulacro que contesta
siempre que sí es un fail-open y **deja sin ejercer la mitad interesante** —perder la cobertura—;
uno que contesta siempre que no deja todo apagado.

### 4.2 Lo que queda inactivo, declarado y no escondido

1. **El trial nunca convierte.** `T2` y `T5` disparan ~~al autorizarse una suscripción~~ cuando
   aparece un título que convierte —una suscripción, recién con su primer pago acreditado
   (`DEC-TRIAL-010`, `V/03` §2)—, y sin billing no aparece ninguno. **Lo mismo `T8`, y la guarda
   de `T6` que pide un título que convierte** (owner 2026-09-25; FASE 9 completa, 6c): sin billing
   no hay primer pago, así que el trial se consume sólo por `T1` y la rama de `T6`/`T8` con
   suscripción queda sin ejercer hasta `B4`. **Y el botón de suscribirse no tiene checkout al que
   mandar**: su rama *«mandar a publicar»* sí se ejerce.
2. **No hay reparación de un trial ya vencido**, porque se hace con una cortesía. Alguien
   perjudicado por un error de moderación **después** de que su trial venció no tiene reparación
   hasta que exista billing. Mientras el trial sigue vivo sí la tiene: la extensión `T4`.
3. **El techo de días de trial cuenta una fuente de tres**: las extensiones de `T4`, no las que
   vendrían de un promo o de una cortesía. El número no cambia; cambia cuántas cosas suman.

### 4.3 Cómo se integra con la otra épica

**El código de esta épica no va a `staging` por su cuenta** (`DEC-ARCH-007`). Corta de la rama de
integración del paraguas —`epic/HOS-1352-verticales-billing`— y mergea ahí. La unidad que llega a
`staging` es el paraguas, con las dos épicas adentro.

**La revisión ocurre en esos PRs**, los de esta épica hacia el paraguas. El PR final a `staging` va
a ser demasiado grande para revisarse de verdad: tiene que ser el merge de algo ya revisado.

Y una obligación que es la que hace viable todo lo anterior: **`staging` se mergea periódicamente
hacia la rama del paraguas**, nunca al revés hasta el final. Sin eso, una rama que vive meses
acumula conflictos con todo lo que entre al repo mientras tanto.

---

## 5. Cómo se comprueba que está bien

**~~Siete~~ ~~Ocho~~ Nueve guards con id propio de esta épica** —`G1`-`G6`, `G8`, **`G13`** (el octavo lo construye `V4`: owner 2026-09-26, `G5-5`) **y `G14`** (el noveno, la frontera del package del contrato; lo construye `V1`: revisión del owner, 2026-09-28, N6)—, y cada uno **lleva un caso que lo
hace fallar a propósito**, porque un guard que no puede fallar es un comentario con exit code 0.
**~~Siete~~ ~~Ocho~~ Nueve NO es el total**: el catálogo del capítulo `20` §2 lista ~~**diecisiete**, y los diez~~ ~~**dieciocho**, y los once~~ ~~**diecinueve**~~ ~~**veinte**~~ ~~**veintiuno**~~ **diecinueve** (recontado el 2026-09-28 sobre la tabla: decía veinte sin `G-R9`; sale `G-R5` por C14 y entra `G14` por N6; **y `G-R3` y `G-R5-B` pasan a ser validaciones del panel**, por N1 y C9) —el decimonoveno es
`G-R2-C` (owner 2026-09-25; FASE 9 completa, 4e), y el vigésimo, `G13`, que vino de `B/20` §2—, y los ~~**doce**~~ **diez** que no
están en esta tabla son los `G-R*` —los racimos de la FASE 9 y sus ~~**cuatro**~~ **tres** referencias cruzadas (sale `G-R5`, C14)
con billing—, que se numeran ahí y no acá. Esta lista es **la porción con id propio**; la lista entera
es la del `20` §2, que es el único lugar donde se puede preguntar *«¿están todos?»*:

| # | falla si |
|---|---|
| `G1` | una pieza **nombra una vertical** sin implementar uno de los ocho ítems del Eje 2 |
| `G2` | una operación de dominio **no declara** su contexto de vertical; **o toma la vertical del pedido y no del recurso; o escribe la vertical de un recurso que ya existe** (tres mitades con tres mensajes: FASE 8 completa, `F-8CA1-001`; owner 2026-09-25, FASE 9 completa, 7a) |
| `G3` | una clave de código no está ~~en la base, **o una de la base no está en el catálogo**~~ **en el catálogo**; la otra dirección pasa a ser una restricción de la base (revisión del owner, 2026-09-28, N1; `NUCLEO/02` §1.4) |
| `G4` | una transición de suscripción o de trial **escribe roles** |
| `G5` | una fuente de entitlements **se apaga sin pasar** por el reconciliador de excedentes |
| `G6` | una autorización **decide sólo por rol**; **o una construcción del conjunto efectivo lee un rol** (segunda mitad, mensaje propio: FASE 9 vuelta 1, `F-8V1A1-002`) |
| `G8` | ~~aparece `commerce` en fuentes activas~~ **aparece el nombre del agrupamiento viejo de Gastronomía y Experiencia en cualquier archivo del repositorio, con el PDR como única exención por nombre** (revisión del owner, 2026-09-28, C3, `L2-a` y `L2-b`), **y hasta el corte con una lista de pendientes cerrada, las dos historias, que el paso 6 del corte ~~vacía~~ saca; un build destinado a producción después del corte falla si ~~no está vacía~~ le queda una** (revisión del owner, casos vecinos, 2026-09-29, caso 8), **regla que enciende el mismo commit del paso 6** (caso F-B); **y una tercera entrada, las carpetas del programa en `.specs/`, hasta el commit del cierre de HOS-1352, que la saca y extiende la regla a la lista entera** (revisión del owner, casos vecinos, 2026-09-29, caso H-A)**, sólo esas: las specs de otros issues y `.qtm/` las limpia ~~`V1`~~ la limpieza del principio** (caso I-D; lote N-A)**, que hace `U1`, la unidad del paraguas, y construye este guard en el mismo cambio** (verificación corta, 2026-09-29, lote O-A)~~**; y un trinquete de archivos, la lista medida del código que la nombra el día que nace el guard, que sólo se achica y que el cierre exige vacío** (verificación corta, 2026-09-29, lote M-E)~~; **sin lista de pendientes de código: el código del sistema viejo sale de la rama en la limpieza del principio, antes de construir lo nuevo** (verificación corta, 2026-09-29, lote N-A; `16-fase-7…` §4.6) |
| `G13` | ~~la implementación **de arranque** de `cobertura()` llega a producción~~ **un build destinado a producción importa una de las seis respuestas de arranque que contestan por billing: las cuatro fuentes, `retenciónDetenida` y `puedeCobrarle`** (`V/20` §2; FASE 9 vuelta 3, `F-8V3C1-002`, `F-8V3D1-001`) (contrato §6.3; lo construye `V4`: owner 2026-09-26, `G5-5`) |
| `G14` ✚ | **una mitad importa a la otra** fuera del package del contrato (contrato §7.1; lo construye `V1`: revisión del owner, 2026-09-28, N6, `L1-d`) |

**`G1` y `G2` son la pinza**: uno acota quién **puede** nombrar una vertical, el otro obliga a que
las operaciones **lo hagan**. Por separado, cada uno deja pasar lo que el otro atrapa.

Y la regla que vale para los ~~diecisiete~~ ~~dieciocho~~ ~~diecinueve~~ ~~veinte~~ ~~veintiuno~~ diecinueve (revisión del owner, 2026-09-28, N1 y C9): **el texto con que falla no puede afirmar más de lo que el
predicado verifica.**

---

## 6. Por qué tampoco carga deuda de datos

El capítulo 21 midió que **Gastronomía, Experiencia y Partner tienen cero filas**, y que **no hay
un solo pago histórico**. Los tres compromisos de cobro vivos están del otro lado de la frontera.

Esta épica es independiente **por diseño** —no pregunta por dinero— y también **por datos**: no
~~tiene nada que migrar y nada que romper~~ **transcribe ninguna fila del sistema viejo** —ni
siquiera de `trial`: el corte no siembra trials consumidos (owner 2026-09-25; FASE 9 completa,
2g)—. **Lo único que toca de lo existente son las fichas**, y sin migrarlas: toda ficha que existe
el día del corte nace con `listing.inactiva_desde` en el instante del corte —la escritura `C` de
`NUCLEO/01` §1.2—, ~~las publicadas de Alojamiento las baja la primera corrida del reconciliador
diario de cobertura~~ **las que estaban a la vista nacen `PUBLISHED`, como recién creadas, y el
corte le escribe a su dueño una prueba gratis activa que arranca ese día; las que el sistema viejo
tenía bajadas por falta de pago nacen en `DRAFT`** (revisión del owner, 2026-09-28, C12, `L1-b`:
es la única fila nueva de verticales que escribe el corte, una prueba activa, no transcrita de
ninguna), y la página del partner sin presencia pasa de responder 410 a 404 (`V/21`
§2.4 y §4). *(Decía «nada que migrar y nada que romper», y la escritura `C` es una escritura sobre
filas existentes; salida 3 de la FASE 9 completa.)*

---

## 7. Lo que esta spec NO decide

- **El orden de implementación.** Sale de las dependencias entre capítulos, no de acá.
- **Cuáles son las claves de entitlement y de limit de cada vertical.** Es configuración: acá está
  que el subconjunto se declara por vertical y que cada clave lleva scope, estrategia y
  `enforcementStrategy` — no cuál es.
- ~~**Si el mes de una cuota corre por calendario o por aniversario.** Sigue abierto desde
  `DEC-ENT-002`.~~ **Cerrado** (revisión del owner, 2026-09-28, C4): por la fecha del ciclo de
  cada persona, también en anual y en la prueba gratis (`15` §7).
- **Qué se reescribe y qué se reutiliza del código actual.** Es FASE 5 y tiene su gate propio
  (`DEC-METH-003`).
- **«Entrar como» el cliente** (revisión del owner, 2026-09-28, C7): no está en esta versión y se
  va a agregar; su condición (se registra como hecho por el admin en nombre del cliente) está en
  `17` (*«lo que este capítulo NO cierra»*) y en `NUCLEO/08` §3.
- **La baja de cuenta pedida por el usuario** (revisión del owner, 2026-09-28, N7, `g1`): fuera de
  esta épica; la hace soporte a mano con una lista de pasos, y se corrige la FAQ
  ([HOS-1393](https://linear.app/hospeda-beta/issue/HOS-1393); `NUCLEO/08` §1). **La lista se
  escribe antes del corte, en este orden: la baja del cobro, `PB12` por cada ficha y la cuenta**
  (revisión del owner, casos vecinos, 2026-09-29, caso 7; `NUCLEO/08` §1.3).
- **Nada de la épica de billing.** Su primera pregunta —si el cargo puntual es el modelo canónico—
  ~~está planteada en [HOS-1354](https://linear.app/hospeda-beta/issue/HOS-1354) y sin responder.~~
  **se planteó en [HOS-1354](https://linear.app/hospeda-beta/issue/HOS-1354) y está respondida**
  (tachado 2026-09-26): no lo es; el modelo canónico es el mandato del proveedor (`DEC-MP-006`),
  sobre Mercado Pago (`DEC-MP-005`).

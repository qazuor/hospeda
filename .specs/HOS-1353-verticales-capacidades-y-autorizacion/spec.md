---
title: Verticales — capacidades, entitlements, limits y autorización
linear: HOS-1353
statusSource: linear
created: 2026-09-18
type: feature
areas:
  - api
  - db
  - web
  - admin
parent: HOS-1352
---

# Verticales — capacidades, entitlements, limits y autorización

> **Esta épica se puede implementar sin saber con qué pasarela vamos a cobrar.** Es la mitad del
> programa HOS-1352 que no pregunta por dinero, y por eso no comparte su bloqueo.

## 1. De dónde sale esta épica

El programa [HOS-1352](../HOS-1352-billing-verticals-redesign/spec.md) quedó detenido por una
sola cosa: **no está decidida la pasarela.** Mercado Pago niega el cobro a demanda con un `403`
comercial y el candidato que sí lo documenta tiene el alta en revisión de KYC.

**Ese bloqueo alcanza al dinero y no alcanza a las capacidades.** El owner decidió el 2026-09-18
partir el programa en dos épicas. El corte, con su fundamento y el reparto capítulo por capítulo,
está en
[`docs/11-particion-del-programa.md`](../HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md).
Esta spec es el alcance de la mitad que arranca.

**El diseño ya está escrito.** La Master Spec de FASE 2 tiene 21 de sus 22 capítulos, y los de
esta épica están completos. Esta spec **no rediseña nada**: declara qué entra, qué contrato tiene
con la otra mitad, qué se puede construir hoy y con qué se comprueba que está bien.

---

## 2. La frontera, que es lo primero que hay que tener claro

> **Es de esta épica si sólo necesita saber QUÉ PUEDE HACER una cuenta, sin preguntar si pagó.**

Es el criterio del owner —*«toca plata o no toca plata»*—, y el capítulo 15 ya lo había escrito
al cerrar, separando su materia de la del 14: *«acá se agregan **capacidades**, allá se compone
**dinero**»*.

**El punto donde el reparto se equivoca si se hace por nombre**: «plan» suena a billing y no lo
es. De las seis entidades del catálogo comercial (cap. 02 §2.1), **cinco no tienen un solo campo
de dinero** — `vertical`, `plan`, `plan_version`, `plan_version_entitlement` y
`plan_version_limit`. El precio vive en una sola tabla hoja, `billing_option`, que es la única de
las seis que **no** es de esta épica.

---

## 3. Las definiciones declaradas

Lo que sigue son las definiciones que esta épica da por fijadas. Cada una tiene su fuente, y
ninguna se re-litiga acá: si algo hay que cambiar, se cambia en su capítulo.

### 3.1 Qué diferencia legítimamente a una vertical de otra

**El Eje 2 es una lista cerrada de ocho ítems y todo lo demás es Eje 1** (cap. 01 §4). Los ocho:
el evento que activa el trial, qué publica, la sección de Mi Cuenta, qué claves tienen sentido, el
camino de alta, si hereda Turista VIP, los métodos de pago admitidos y si tiene pricing propia.

**La consecuencia medida**: Alojamiento, Gastronomía y Experiencia **coinciden en siete de los
ocho** y difieren sólo en cuál subconjunto de claves tiene sentido — que es configuración en base,
no comportamiento. **Tres verticales que coinciden en siete ítems no justifican una sola línea de
código separado** (cap. 10 §1.1).

Las dos que sí difieren son **Turista** (no publica nada, y es el origen de la herencia en vez de
su destino) y **Partner** (no tiene trial, no es self-service, y su presencia no es una ficha).

**Lo que NO es Eje 2, aunque lo parezca**: los ciclos que ofrece un plan, el grace, la pausa, los
días de trial y los overrides. Todos son **valores** configurables por plan, y el Eje 2 es
variación de **comportamiento**, no de valores (cap. 10 §1.2).

### 3.2 Qué sale de la base y qué sale del código

**El catálogo de claves es código; la configuración comercial es base** (cap. 02 §1). Una clave de
entitlement o de limit existe porque hay código que la respeta; **qué plan la otorga y con qué
valor** es un dato.

Y el guard va en **las dos direcciones**: una clave usada en código que no existe en la base
falla, y una clave de la base que no existe en el catálogo también (`G3`).

### 3.3 Cómo se agrega un limit

**La estrategia se declara con la clave, no con el plan** (cap. 15 §2), y la lista es cerrada:
`SUMA`, `MÁXIMO`, `MÍNIMO` y `MEJOR_DECLARADO`. Las tres últimas son la misma regla dicha de tres
formas: **gana la fuente más favorable**.

**Vive con la clave y no con el plan** porque, si la declarara el plan, dos planes de la misma
vertical podrían declarar estrategias distintas para la misma clave y **la clave significaría dos
cosas**.

**Cuando no acumula, gana el cliente.** La alternativa es que comprar un addon te deje peor que
antes.

### 3.4 Qué scope tiene una clave

**Cada clave declara si es de vertical o global** (cap. 15 §3), simétrico con los addons del §40.

Y la defensa contra el cruce entre verticales **es estructural, no un chequeo**: una clave de
vertical se resuelve por `user + vertical`, así que **no se puede invocar sin la vertical**. No
hay un control que alguien pueda olvidar.

**El scope de la clave dice dónde vale; la fuente dice por cuánto tiempo.** Son preguntas
distintas.

### 3.5 Cómo se autoriza una operación

**Nueve pasos, en un orden que no es preferencia** (cap. 17 §1.2): va de lo que no depende de nada
hacia lo que depende de todo, y cada paso revela lo mínimo.

1. quién es · 2. estado de la persona · 3. permiso · 4. el recurso: existencia, estado y dueño ·
5. título vivo · 6. entitlement · 7. limits — con el **contexto de vertical** como precondición
estructural, no como paso.

**Tres precisiones que el orden hace cumplir:**

- **El paso 4 responde «no existe» a las tres cosas.** Un recurso ajeno, uno archivado y uno
  inexistente son indistinguibles desde afuera; decir *«no es tuyo»* confirma que el id existe.
- **El estado de la persona va antes del permiso**, porque al revés una cuenta inhabilitada puede
  averiguar qué permisos tiene probando operaciones.
- **Los limits van últimos** porque son los únicos que necesitan contar.

**Y los nueve se resuelven en un solo lugar.** El invariante no es que cada servicio los haga:
es que **ninguno los haga por su cuenta**.

### 3.6 Actor y sujeto

**Toda operación lleva dos identidades** y casi siempre coinciden (cap. 17 §3.2). Lo que autoriza
que difieran es **un permiso de esa acción concreta**, nunca una condición general de «es
administrador».

**El admin no hereda los entitlements del sujeto**: los pasos 5, 6 y 7 se evalúan sobre el sujeto.
**Y no existe la impersonación** — impersonar hace que el registro diga que lo hizo el cliente, y
ése es exactamente el rastro que no se puede perder.

### 3.7 El rol no se toca al perder el acceso

**Perder el acceso NUNCA revoca un rol** (cap. 17 §4): ni la suspensión, ni el vencimiento del
trial, ni la cancelación, ni la pausa.

**El rol dice a qué familia de operaciones pertenece la persona; el estado de acceso dice si hoy
puede ejecutarlas.** Son dos ejes independientes, y los pasos 3 y 5 están separados justamente
para que puedan discrepar.

Va con su mitad obligatoria: **ninguna autorización decide sólo por rol** (`G6`). Las dos juntas o
ninguna funciona.

### 3.8 El trial

**Es único de por vida por `user + vertical`**, impuesto por una restricción de base sin condición
de estado (cap. 02 §2.2). **El reloj es de calendario y no lo detiene nada** — ni despublicar, ni
borrar la ficha, ni dejar de entrar (cap. 11 §1).

**El trial no vuelve; lo que hay es reparación hacia adelante** (cap. 11). Mientras sigue vivo se
extiende; si ya venció, la reparación es un instrumento de la otra épica.

**Y tiene techo**: cada vertical declara un máximo de días acumulados, en base y no en código
(cap. 11 §3.2).

**Su plan no es una entidad aparte**: es un plan marcado no vendible, y sus valores **no se
guardan, se derivan** del plan vendible de `rank` más alto y del más bajo, más los overrides y el
trinquete (cap. 02 §2.1).

### 3.9 El excedente

**No se dispara por evento: se dispara por condición** (cap. 15 §4.2) — cuando el conjunto
efectivo de un `user + vertical` se recalcula y algo bajó. Enumerar puntos de invocación es cómo
se olvida el séptimo.

**Nunca borra**: archiva, despublica o deshabilita. **Cae lo más reciente primero**, y el criterio
va escrito en el aviso.

**La ventana para elegir existe sólo cuando la fecha se sabía.** Prometer una ventana que a veces
no existe es peor que no prometerla: cuando no la hay, el aviso dice **qué se hizo** y cómo
revertirlo.

### 3.10 El visitante sin cuenta

**Es un actor del modelo, no la falta de uno** (cap. 17 §3.3). **No recibe ningún entitlement
medido**, y de los booleanos sólo los de lectura pública — enunciado **por clase** para que una
clave medida nueva no quede habilitada por omisión (cap. 15 §5).

No hay cuota chica para el guest porque **una cuota necesita a quién imputarla**, y sin cuenta lo
único disponible se elude trivialmente.

---

## 4. El contrato con la épica de billing

Todo lo que esta épica necesita de HOS-1354 es **un hecho y un aviso**:

```text
cobertura(user, vertical) → { tiene_título_vivo, fuente, hasta_cuándo }

evento: la cobertura de (user, vertical) cambió
```

El mismo hecho aparece en cuatro lugares del diseño y es siempre el mismo: el paso 5 de la
autorización, la transición `PB2` de publicación, la pérdida de beneficios de turista al
suspender (cap. 15 §6) y el disparador del recálculo del conjunto efectivo.

**Nada más cruza la frontera**: ni montos, ni estados de pago, ni ids del proveedor, ni fechas de
cobro. **Si aparece un quinto lugar que necesita algo de billing y no es este hecho, es una señal
de que el corte se está filtrando** — se mira, no se resuelve en el lugar.

### 4.1 El valor por defecto que hace posible construir hoy

**El trial ya es un título vivo, y el trial no es billing.** Mientras HOS-1354 no exista,
`cobertura()` se resuelve con esa única fuente y las otras tres —suscripción, cortesía, grant—
responden que no.

Con eso se construye y se prueba **entero**: la autorización recorre sus nueve pasos, la máquina
de publicación tiene vivo su disparador de `PB2` alimentado por `T3`, el reconciliador de
excedentes corre disparado por las transiciones de trial, y la agregación de limits y los scopes
no tienen ninguna dependencia que defaultear porque nunca preguntaron por dinero.

**Cuando billing exista se enchufa**: se agrega como fuente de `cobertura()` y como llamador del
reconciliador. No se modifica nada de lo construido.

### 4.2 Lo que queda inactivo, declarado y no escondido

1. **El trial nunca convierte.** `T2` y `T5` disparan al autorizarse una suscripción.
2. **No hay reparación de un trial ya vencido**, porque se hace con una cortesía. Alguien
   perjudicado por un error de moderación **después** de que su trial venció no tiene reparación
   hasta que exista billing. Mientras el trial sigue vivo sí la tiene: la extensión `T4`.
3. **El techo de días de trial cuenta una fuente de tres**: las extensiones de `T4`, no las que
   vendrían de un promo o de una cortesía. El número no cambia; cambia cuántas cosas suman.

---

## 5. El alcance, por capítulo

**Enteros de esta épica**: `11` trial · `15` entitlements y limits · `17` autorización ·
`18` Partner.

**Las mitades que le tocan de los partidos**:

| capítulo | qué entra |
|---|---|
| `01` glosario | identidad y acceso, vertical y lo que publica, capacidades; las filas de trial, publicación y postulación del glosario de estados |
| `02` modelo de datos | §2.1 **menos `billing_option`**, `listing` (§2.5), el caché y su invalidación (§3), las reglas de retención de ficha y el hash de trial (§4) |
| `03` máquinas de estado | trial (§2), publicación (§9), postulación de Partner (§11) |
| `04` invariantes | los de acceso, trial y roles — incluido `D12`, que afirma justamente que **el reloj del trial es nuestro y no se le pide al proveedor** |
| `10` verticales y planes | el Eje 2 (§1) y la lectura del catálogo (§2) |
| `19` superficies | Mi Cuenta, los mensajes de trial y de excedente, las postulaciones |
| `20` testing | los guards `G1` a `G6` y `G8`, y el E2E del trial completo |
| `21` migración | el trial ya consumido |
| `22` lo legal | las señales de identidad y el hash irreversible del correo |

**Compartido con la otra épica** (no se puede partir sin duplicarlo): el `00` índice, el criterio
Eje 1 / Eje 2 del `01` §4, el mecanismo de outbox del `07`, y el criterio de auditoría y
correlación del `08`.

---

## 6. Cómo se comprueba que está bien

**Siete guards**, y cada uno **lleva un caso que lo hace fallar a propósito** (cap. 20 §2.1) —
porque un guard que no puede fallar es un comentario con exit code 0:

| # | falla si |
|---|---|
| `G1` | una pieza **nombra una vertical** sin implementar uno de los ocho ítems del Eje 2 |
| `G2` | una operación de dominio **no declara** su contexto de vertical |
| `G3` | una clave de código no existe en la base, **o una de la base no existe en el catálogo** |
| `G4` | una transición de suscripción o de trial **escribe roles** |
| `G5` | una fuente de entitlements **se apaga sin pasar** por el reconciliador de excedentes |
| `G6` | una autorización **decide sólo por rol** |
| `G8` | aparece `commerce` en fuentes activas |

**`G1` y `G2` son la pinza**: uno acota quién **puede** nombrar una vertical, el otro obliga a que
las operaciones **lo hagan**. Por separado, cada uno deja pasar lo que el otro atrapa.

Y la regla que vale para los siete: **el texto con que falla no puede afirmar más de lo que el
predicado verifica.**

---

## 7. Por qué esta épica tampoco carga deuda de datos

El capítulo 21 midió que **Gastronomía, Experiencia y Partner tienen cero filas**, y que **no hay
un solo pago histórico**. Los tres compromisos de cobro vivos que existen están del otro lado de
la frontera.

Es decir: esta épica es independiente **por diseño** —no pregunta por dinero— y también **por
datos** — no tiene nada que migrar y nada que romper.

---

## 8. Lo que esta spec NO decide

- **El orden de implementación.** Es el próximo paso, y sale de las dependencias entre capítulos,
  no de esta declaración de alcance.
- **Cuáles son las claves de entitlement y de limit de cada vertical.** Es configuración, y el
  capítulo 15 es explícito: acá está que el subconjunto se declara por vertical y que cada clave
  lleva scope, estrategia y `enforcementStrategy` — no cuál es.
- **Si el mes de una cuota corre por calendario o por aniversario.** Sigue abierto desde
  `DEC-ENT-002`.
- **Qué se reescribe y qué se reutiliza del código actual.** Es FASE 5 y tiene su gate propio
  (`DEC-METH-003`).
- **Nada de la épica de billing.** Su primera pregunta —si el cargo puntual es el modelo canónico—
  está planteada en [HOS-1354](https://linear.app/hospeda-beta/issue/HOS-1354) y sin responder.

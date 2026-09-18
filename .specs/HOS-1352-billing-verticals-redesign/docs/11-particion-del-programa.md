---
title: La partición del programa en dos épicas
linear: HOS-1352
statusSource: linear
created: 2026-09-18
updated: 2026-09-18
status: CURRENT
---

# 11 · La partición del programa en dos épicas

> **Decisión del owner, 2026-09-18.** El programa se parte en dos épicas bajo la épica
> principal: **Verticales**, que se puede implementar ya, y **Billing**, que espera a que se
> pueda medir la pasarela. Lo que sigue no decide si partir: decide **por dónde pasa el corte**,
> y lo declara de una sola forma para que no aparezcan seis repartos como pasó con `qzpay`
> (`F-1B-132`).

---

## 1. Por qué se parte, y qué lo destrabó

La épica principal está bloqueada por una sola cosa: **no sabemos con qué pasarela vamos a
cobrar.** `DEC-ARCH-004` puso el ciclo de vida de nuestro lado y dejó al proveedor detrás de un
adaptador, pero el adaptador de referencia sigue sin decidirse: Mercado Pago niega el cobro a
demanda con un `403` comercial, y el candidato que sí lo documenta —Mobbex— tiene el alta en
revisión manual de KYC desde el 2026-09-18.

**Ese bloqueo alcanza al dinero y no alcanza a las capacidades.** Qué puede hacer una cuenta, qué
publica cada vertical, cómo se agregan los limits, quién está autorizado a qué: nada de eso
necesita saber con qué pasarela se cobra. Se estaba esperando por una razón que no aplicaba a la
mitad del programa.

**Y hay una medición que lo confirma desde otro ángulo.** De los 21 capítulos escritos de la
Master Spec, **ocho no citan ni una sola medición del proveedor** —índice, glosario, verticales,
trial, entitlements, autorización, Partner y migración—, contados con `rg`. Esos ocho son, casi
exactamente, la épica que arranca hoy. El corte no hubo que inventarlo: ya estaba en el material.

---

## 2. La frontera, en una línea

> **Es BILLING si necesita saber un precio, ejecutar o interpretar un cobro, o hablar con la
> pasarela.**
> **Es VERTICALES si sólo necesita saber qué puede hacer una cuenta, sin preguntar si pagó.**

Es el criterio del owner —*«toca plata o no toca plata»*— aplicado a este reparto. Y no es una
formulación nueva: el capítulo 15 de la Master Spec ya la había escrito al cerrar, distinguiendo
su materia de la del capítulo 14 con las palabras exactas — *«acá se agregan **capacidades**,
allá se compone **dinero**»*.

### 2.1 El corte pasa por dentro del catálogo de planes, no por afuera

Es el punto donde el reparto se equivoca si se hace por nombre. «Plan» suena a billing y no lo
es: de las seis entidades del catálogo comercial (cap. 02 §2.1), **cinco no tienen un solo campo
de dinero**.

| entidad | qué guarda | lado |
|---|---|---|
| `vertical` | el espejo en base del enum de código | **VERTICALES** |
| `plan` | vertical, slug, nombre, descripción, orden en la pricing | **VERTICALES** |
| `plan_version` | `rank`, vendible, días de grace, días de trial, permite pausa, hereda Turista VIP | **VERTICALES** |
| `plan_version_entitlement` | qué clave otorga, y las dos cuotas de las medidas | **VERTICALES** |
| `plan_version_limit` | qué clave limita y con qué valor | **VERTICALES** |
| **`billing_option`** | **el ciclo y su precio: monto y moneda** | **BILLING** |

El propio capítulo 02 lo dice al pie de esa tabla: *«El precio cuelga de la versión, no del
plan»*. O sea que el precio vive en **una sola tabla hoja**, y todo lo que está encima de ella es
configuración de capacidades.

**Esto es lo que vuelve independiente al trial.** Su plan se deriva *«del plan vendible de `rank`
más alto y del más bajo»* (cap. 02 §2.1), y `rank` y `vendible` son columnas de `plan_version`.
La derivación no toca `billing_option` en ningún punto: **un trial se puede resolver entero sin
que exista un precio en la base.**

### 2.2 Lo que el corte NO es

- **No es por entidad, es por campo.** El mismo `plan_version` sostiene el `rank` (verticales) y
  cuelga del `billing_option` (billing). Cortar por tabla obliga a elegir mal.
- **No es «lo que menciona a billing».** Un capítulo que dice *«ver capítulo 12»* no es billing.
  La pregunta es qué necesita para **funcionar**, no a quién nombra.
- **No es una separación de despliegue.** Son dos épicas de trabajo sobre el mismo sistema, no
  dos sistemas.

---

## 3. La interfaz entre las dos épicas: un hecho y un aviso

Verificado capítulo por capítulo, todo lo que el lado verticales necesita del lado billing se
reduce a **un solo hecho**, que aparece en cuatro lugares distintos y es siempre el mismo:

| dónde aparece | cómo se llama ahí |
|---|---|
| cap. 17 §1.2, paso 5 | *«¿tiene trial, suscripción, cortesía o grant que lo cubra?»* |
| cap. 03 §9, transición PB2 | *«se pierde la cobertura»* |
| cap. 15 §6 | *«su plan comercial está `SUSPENDED`»* |
| cap. 02 §3.2 · cap. 15 §4.2 | el disparador del recálculo del conjunto efectivo |

**El hecho, enunciado una vez:**

```text
cobertura(user, vertical) → { tiene_título_vivo, fuente, hasta_cuándo }
```

Y su contracara, que es lo único que billing le empuja a verticales:

```text
evento: la cobertura de (user, vertical) cambió
```

**Nada más cruza la frontera.** No cruzan montos, ni estados de pago, ni ids del proveedor, ni
fechas de cobro. Si mañana aparece un quinto lugar que necesita algo de billing y no es este
hecho, es una señal de que el corte se está filtrando y hay que mirarlo, no resolverlo en el
lugar.

### 3.1 El valor por defecto que hace posible construir sin billing

**El trial ya es un título vivo, y el trial no es billing.** Esa es toda la respuesta.

Mientras la épica de billing no exista, `cobertura()` se resuelve con una sola fuente —el trial—
y las otras tres (suscripción, cortesía, grant) responden que no. Con eso:

- la resolución de autorización recorre sus **nueve pasos completos** (cap. 17 §1.2);
- la máquina de publicación tiene su disparador de PB2 vivo, alimentado por `T3`;
- el reconciliador de excedentes se prueba entero, disparado por las transiciones de trial;
- y la agregación de limits, los scopes y el excedente no tienen ninguna dependencia que
  defaultear: nunca preguntaron por dinero.

Cuando billing exista, **se agrega como fuente de `cobertura()` y como llamador del
reconciliador.** No se modifica nada de lo construido: se enchufa.

### 3.2 Lo que queda inactivo, declarado y no escondido

Tres cosas del lado verticales no se pueden ejercer hasta que exista billing. Van declaradas acá
para que nadie las descubra como un bug:

1. **El trial nunca convierte.** Las transiciones `T2` y `T5` del capítulo 03 §2 disparan cuando
   se autoriza una suscripción. Sin billing, un trial sólo puede vencer.
2. **La reparación de un trial ya vencido no existe.** El capítulo 11 §2.3 la resuelve con una
   cortesía, que es un instrumento de billing. Alguien perjudicado por un error de moderación
   nuestro **después** de que su trial venció no tiene reparación hasta entonces. Mientras el
   trial sigue vivo sí la tiene: la extensión `T4` es propia del trial.
3. **El techo de días de trial cuenta una fuente de tres.** Cuenta las extensiones de `T4` y no
   las que vendrían de un promo o de una cortesía (cap. 11 §3.2), porque esas dos todavía no
   existen. El número no cambia; cambia cuántas cosas suman contra él.

---

## 4. El reparto, capítulo por capítulo

`VERTICALES` · `BILLING` · `PARTIDO` (cada mitad va a su épica) · `COMPARTIDO` (las dos lo
necesitan igual y no se puede partir sin duplicarlo).

| # | capítulo | lado |
|---|---|---|
| 00 | índice y reglas de escritura | **COMPARTIDO** |
| 01 | glosario y modelo conceptual | **PARTIDO** — identidad, vertical y capacidades a verticales; catálogo comercial, compromiso de pago y concesiones a billing |
| 02 | modelo de datos | **PARTIDO** — §2.1 menos `billing_option`, §2.5 y §3 a verticales; §2.2, §2.3 y §2.4 a billing |
| 03 | las máquinas de estado | **PARTIDO** — trial, publicación y postulación de Partner a verticales; suscripción, grace, pausa, pago, pago manual, addon y el no-retroceso a billing |
| 04 | invariantes | **PARTIDO** — los de acceso, trial y roles a verticales; los de dinero y proveedor a billing; los de método, compartidos |
| 05 | idempotencia y concurrencia | **BILLING** |
| 06 | abstracción de proveedor | **BILLING** |
| 07 | outbox y notificaciones | **PARTIDO** — el mecanismo es compartido; del catálogo de correos, los dos del trial a verticales y el resto a billing |
| 08 | auditoría y observabilidad | **PARTIDO** — el criterio y la correlación son compartidos; del catálogo de acciones admin, la postulación de Partner y la extensión de trial a verticales |
| 09 | conciliación | **BILLING** |
| 10 | verticales, planes y billing options | **PARTIDO** — el Eje 2 y la lectura del catálogo a verticales; el retiro de un plan y la vertical discontinuada a billing |
| 11 | trial | **VERTICALES** |
| 12 | suscripción | **BILLING** |
| 13 | pagos | **BILLING** — es el único sin escribir, y su contenido es exactamente lo que espera a la pasarela |
| 14 | promos, cortesías y grants | **BILLING** |
| 15 | entitlements y limits | **VERTICALES** — con la salvedad del §6, que lee el estado de la suscripción a través de `cobertura()` |
| 16 | addons | **BILLING** — el §4.1 reutiliza el reconciliador de verticales, no lo duplica |
| 17 | autorización | **VERTICALES** |
| 18 | Partner | **VERTICALES** |
| 19 | superficies | **PARTIDO** — Mi Cuenta, los mensajes de trial y de excedente y las postulaciones a verticales; la pricing, Mi Suscripción y la baja a billing |
| 20 | testing | **PARTIDO** — los guards `G1` a `G6` y `G8` a verticales; `G7`, `G9`, `G10`, `G11`, el proveedor falso y la suite de sandbox a billing |
| 21 | migración | **PARTIDO** — el trial ya consumido a verticales; el conteo de pagos y el riesgo de cobro durante el rediseño a billing |
| 22 | lo legal | **PARTIDO** — las señales de identidad y el hash del correo a verticales; el aumento, la revocación y el botón de arrepentimiento a billing |

**Cinco capítulos son billing sin una sola fisura**: 05, 06, 09, 12 y 14. Ninguna de sus
secciones sobrevive sin la pasarela.

**Tres son verticales enteros**: 11, 17 y 18.

### 4.1 Los capítulos no se reescriben ni se mueven

Quedan donde están, con su numeración. Esta tabla es el índice de lectura de cada épica, no una
instrucción de mudanza. Mover 21 archivos para expresar un reparto cuesta el riesgo de perder
referencias cruzadas —hay decenas— y no compra nada: una épica puede leer «el capítulo 17 entero
y el §2.1 del 02» perfectamente bien.

---

## 5. Un dato de migración que refuerza la elección

El capítulo 21 midió que **Gastronomía, Experiencia y Partner tienen cero filas** y que **no hay
un solo pago histórico**. Las tres verticales que el rediseño viene a ordenar no cargan ninguna
deuda de datos.

Es decir: la épica de verticales no sólo es independiente **por diseño** —no pregunta por
dinero— sino también **por datos**: no tiene nada que migrar y nada que romper. Los tres
compromisos de cobro vivos que existen están del otro lado de la frontera.

---

## 6. Lo que esta partición NO decide

- **Cuál es la pasarela.** Sigue en [`10-evaluacion-de-proveedor.md`](./10-evaluacion-de-proveedor.md),
  paso 4 de 6, esperando la PRUEBA 0 y el KYC de Mobbex.
- **Si el capítulo 13 adopta el cargo puntual como modelo canónico.** Está planteado y sin
  responder; es la primera pregunta de la épica de billing cuando arranque.
- **Qué se reescribe y qué se reutiliza del código actual.** Eso es FASE 5 y tiene su gate propio
  (`DEC-METH-003`), que la partición no toca.
- **El orden de implementación dentro de la épica de verticales.** Es su spec, no ésta.

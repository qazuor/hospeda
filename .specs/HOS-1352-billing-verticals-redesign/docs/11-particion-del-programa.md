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
reduce a **un solo hecho**, que el diseño pedía en cuatro lugares distintos con cuatro nombres
distintos y es siempre el mismo:

| dónde aparece | cómo se llama ahí |
|---|---|
| cap. 17 §1.2, paso 5 | *«¿tiene trial, suscripción, cortesía o grant que lo cubra?»* |
| cap. 03 §9, transición PB2 | *«se pierde la cobertura»* |
| cap. 15 §6 | *«su plan comercial está `SUSPENDED`»* |
| cap. 02 §3.2 · cap. 15 §4.2 | el disparador del recálculo del conjunto efectivo |

**El hecho, enunciado una vez** — y **enunciado en un solo lugar, que no es éste**: una consulta de
cobertura por `user + vertical`, cuya firma exacta vive en el §2 de
[`12-contrato-de-cobertura.md`](./12-contrato-de-cobertura.md). Su contracara, lo único que billing
le empuja a verticales, es el evento *«la cobertura de (user, vertical) cambió»*, y es el §3 del
mismo documento.

> **Este capítulo llevaba una transcripción de la firma y es la que hay que no volver a escribir.**
> Decía `{ tiene_título_vivo, fuente, hasta_cuándo }` — tres campos, con `fuente` en singular, que
> es exactamente lo que el contrato §2.2 descarta por su nombre (*«quitar una fuente no quita la
> cobertura si queda otra»*), y con tres nombres que no existen en ningún otro documento del
> programa. Era `F-8C1-009`, y es el mismo generador que `F-8dC2-001` encontró en los dos
> `spec.md`: **una copia no necesita que nadie la mute para divergir, alcanza con que el contrato
> avance**. Se retira en vez de actualizarse, porque actualizarla deja el generador en pie.

**Nada más cruza la frontera.** No cruzan montos, ni estados de pago, ni ids del proveedor, ni
fechas de cobro. **La regla de vigilancia vive en el contrato §4.2 y acá se la cita, no se la
repite**: si aparece **un lugar que necesita algo de billing y no figura en la fila `cubierto` del
contrato §2.1** —y no es este hecho—, es señal de que el corte se está filtrando y hay que mirarlo,
no resolverlo en el lugar.

> **Este renglón decía *«un quinto lugar»* y era la tercera copia de una cifra que ya había
> caducado.** La tabla de arriba enumera **los cuatro nombres con que el diseño pedía el hecho
> antes de que el contrato existiera**, y el censo vivo de quién lo consume es la fila `cubierto`
> del contrato §2.1, que hoy es más larga. Es el mismo generador que el recuadro de arriba describe
> para la firma —**una copia no necesita que nadie la mute para divergir**—, aplicado esta vez a un
> conteo en vez de a un bloque de campos. **La mitad inversa de la misma regla llevaba la otra
> cifra caduca** (*«los seis campos»* contra los **siete** del §4.1), y las dos se arreglaron
> sacándole el ordinal a la que puede vivir sin él.

### 3.1 El valor por defecto que hace posible construir sin billing

**El trial ya es un título vivo, y el trial no es billing.** Esa es toda la respuesta.

Mientras la épica de billing no exista, `cobertura()` se resuelve con las **dos** fuentes que ya
viven del lado de verticales —el trial y el título `BASE` del contrato §2.5— y las **cuatro** de
billing (suscripción, cortesía, grant y addon) responden que no (contrato §5.1). Con eso:

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
| 02 | modelo de datos | **PARTIDO** — §2.1 menos `billing_option`, §2.5 y §3 a verticales; §2.2, §2.3, §2.4 y **§2.6** a billing. El **§2.6** —qué cuelga de una suscripción y qué le pasa cuando otra la sucede— es nuevo de la FASE 9-bis-3 y toma un número que ninguna de las dos mitades usaba, porque el §2.5 ya es de verticales |
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

### 4.1 Los capítulos SÍ se movieron, y esta sección decía lo contrario

> **Corregido el 2026-09-18, el mismo día.** Esta sección decía que los capítulos quedaban donde
> estaban y que la tabla era sólo un índice de lectura. **Era correcto mientras las dos specs sólo
> declaraban alcance, y dejó de serlo cuando el owner pidió que fueran autónomas**: si los
> capítulos se quedan en un lugar **y además** cada spec los absorbe, hay dos fuentes para lo
> mismo — exactamente lo que esta partición viene a evitar. Se conserva el texto viejo tachado
> abajo porque el registro de qué se creía en cada momento es parte de este programa.

**Lo que efectivamente se hizo** (`DEC-ARCH-005`, y el desarme se ejecutó el 2026-09-18):

| dónde | qué |
|---|---|
| `HOS-1353-…/docs/` | **11 capítulos**, los de verticales |
| `HOS-1354-…/docs/` | **13 capítulos**, los de billing |
| `HOS-1352-…/docs/nucleo/` | **7**: reglas de escritura, glosario, invariantes, outbox, auditoría, y el método del modelo de datos y de las máquinas de estado |

Los siete capítulos mixtos se partieron de verdad, y **los originales se retiraron**: dejarlos
habría sido la segunda fuente. `09-master-spec/` ya no existe.

**Lo que sí se conservó de la decisión vieja son los números**: verticales tiene los capítulos 11,
15, 17 y 18, salteados. Son identificadores, no orden, y renumerarlos rompería las decenas de
referencias cruzadas que existen entre capítulos.

**Y el riesgo que la versión vieja nombraba era real**: al partir, 105 encabezados podían perderse
en el camino. Por eso el desarme se verificó antes de retirar ningún original — 105 de 105
presentes en alguna mitad, y el volumen de texto entre 1,06x y 1,29x del de partida.

> ~~Quedan donde están, con su numeración. Esta tabla es el índice de lectura de cada épica, no una
> instrucción de mudanza. Mover 21 archivos para expresar un reparto cuesta el riesgo de perder
> referencias cruzadas —hay decenas— y no compra nada.~~

---

## 5. Un dato de migración que refuerza la elección

El capítulo 21 midió que **Gastronomía, Experiencia y Partner tienen cero filas** y que **no hay
un solo pago histórico**. Las tres verticales que el rediseño viene a ordenar no cargan ninguna
deuda de datos.

Es decir: la épica de verticales no sólo es independiente **por diseño** —no pregunta por
dinero— sino también **por datos**: no tiene nada que migrar y nada que romper. Los tres
compromisos de cobro vivos que existen están del otro lado de la frontera.

---

## 6. Autónomas para desarrollar, juntas para liberar

**«Autónomas» significa que ninguna espera a la otra para avanzar. No significa que una pueda salir
a producción sola.** Las dos llegan **juntas y terminadas** (`DEC-ARCH-007`).

Hay que decirlo con todas las letras porque la ambigüedad ya costó: una sesión llegó a proponer
construir un adaptador sobre el billing actual —código real sobre un sistema condenado, escrito
para tirarlo— para que verticales pudiera llegar sola. **Esa premisa nunca existió.**

### 6.1 El flujo de ramas lo hace cumplir

No es una regla que alguien tenga que recordar: **es la forma del flujo**. Misma lógica que la
condición A de `DEC-ARCH-004` — convertir *«no lo hagas»* en *«no se puede»*.

| | |
|---|---|
| **la rama de integración** | `epic/HOS-1352-verticales-billing`, **nace cuando exista el primer código**. Los documentos siguen yendo por su rama de spec, que sí va a `staging`: son documentación y no despliegan nada |
| **las sub-épicas** | cortan de ella y mergean **a ella**. Nunca a `staging` directamente |
| **`staging` → paraguas** | periódicamente y **como obligación**, nunca al revés hasta el final |
| **dónde se revisa** | **en los PRs de sub-épica → paraguas**. El PR final a `staging` va a ser enorme y nadie lo puede revisar de verdad: es el merge de algo ya revisado, no el momento de mirar |

**Es una excepción declarada** al flujo de 6 pasos del `CLAUDE.md` del repo, que exige que toda
rama salga de `staging` y vuelva a `staging`. Queda escrita acá para que el próximo agente que
entre no la «corrija».

### 6.2 Qué significa «terminada» para una épica

**No significa «en producción».** Significa **lista y verificada contra el contrato**, esperando a
la otra.

### 6.3 Y el riesgo cambia de forma

No es la coexistencia de dos sistemas en producción —no la hay— sino **la espera**: si una épica
termina meses antes, su código espera, y una rama que vive meses acumula conflictos con todo lo que
entre a `staging` mientras tanto. Lo acotan el merge periódico de `staging` hacia el paraguas y la
integración continua; **cómo se integra sin activar** es materia de la FASE 7 de cada épica.

---

## 7. Lo que esta partición NO decide

- ~~**Cuál es la pasarela.**~~ **DECIDIDA el 2026-09-24 por `DEC-MP-005`: Mercado Pago.** La PRUEBA 0
  y el KYC de Mobbex que este punto esperaba **nunca recibieron respuesta**, así que
  [`10-evaluacion-de-proveedor.md`](./10-evaluacion-de-proveedor.md) se cerró en el paso 4 de 6 sin
  completarse.
- ~~**Si el capítulo 13 adopta el cargo puntual como modelo canónico.**~~ **RESPONDIDA el 2026-09-24
  por `DEC-MP-006`: no.** El modelo canónico es el **mandato del proveedor**, porque `EX-31` midió que
  el cargo puntual contra credencial guardada **no está habilitado para nuestra aplicación** (`403` en
  las cuatro formas de pedirlo). Queda declarado como destino, no descartado.
- **Qué se reescribe y qué se reutiliza del código actual.** Eso es FASE 5 y tiene su gate propio
  (`DEC-METH-003`), que la partición no toca.
- **El orden de implementación dentro de la épica de verticales.** Es su spec, no ésta.

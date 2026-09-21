---
title: Master Spec 03 — Las máquinas de estado
linear: HOS-1352
statusSource: linear
created: 2026-09-17
updated: 2026-09-21
status: CURRENT
fase: 2
capitulo: 3
cierra:
  - M-SUB-01
  - M-CONC-02
---

# 03 · Las máquinas de estado

La mitad de núcleo del capítulo 03 del programa: las siete reglas de lectura que valen para todas las máquinas. Las máquinas mismas viven en la épica de verticales (Trial, Publicación, Postulación de Partner) o en la de billing (Suscripción, Grace, Pausa, Pago, Pago manual, Addon, la regla de no-retroceso).

El §63 pide ocho explícitamente: Trial, Subscription, Payment, Manual Payment, Addon,
Publication, Grace y Pause, *«aunque finalmente no utilicemos librería de state machines»*. Acá
son **nueve**: la postulación de Partner (§11) se agregó al escribir el capítulo 18 (épica de
verticales), con su razón escrita.

Los nombres salen del capítulo 01 (núcleo) y **no se redefinen acá**. Lo que este capítulo agrega
son las **transiciones**: qué evento mueve de dónde a dónde, bajo qué condición, y con qué efecto.

---

## 1. Cómo se leen estas máquinas

Siete reglas que valen para todas. Están acá arriba porque son la diferencia entre una
máquina de estados y una convención.

1. **La tabla de transiciones es exhaustiva.** Lo que no está, no pasa. Un intento de
   transición que la tabla no declara **no se ejecuta**: se registra como evento de dominio y,
   si tocaba plata o estado, **pone la marca `requiere_conciliación`** y emite el §22.1.
   **La marca no es un estado**, y ésa es la diferencia que la hace correcta: la fila conserva el
   estado que tenía, así que quien resuelve el caso no tiene que adivinar a dónde volver, y
   escribirla no es en sí misma una decisión destructiva automática — que es lo que el §22.1
   prohíbe.
2. **El estado vive en una columna con dominio restringido** —el §63 pide máquinas explícitas; una
   columna que acepta cualquier cadena no tiene máquina, tiene una costumbre, y el capítulo 02 fija
   la restricción— **y el estado inicial de una máquina cuya fila nace en su primera transición
   vive afuera de la columna.** Que viva afuera no lo vuelve la ausencia de un estado: **es un
   estado porque tiene reglas declaradas y una salida declarada, no porque tenga fila.** Es lo que
   la máquina de suscripción ya hace con su renglón `(sin fila)`, y lo que la de trial hace con
   `PRE_TRIAL`.
3. **Una transición es atómica junto con sus efectos locales.** Los efectos remotos —el
   proveedor, el correo— nunca están dentro de esa transacción: el §43 lo ordena para el correo
   (*«Si falla mail: acción de dominio permanece»*) y el capítulo 05 (épica de billing) lo desarrolla para el
   proveedor.
4. **Toda transición deja un evento de dominio** (§49), con quién la causó y qué la disparó.
5. **Ninguna máquina consulta el estado del proveedor para decidir.** Consulta el suyo. Lo que
   el proveedor dice entra siempre por §10, la regla de no-retroceso.
6. **Grace y Pause no son máquinas independientes**, y el §63 las nombra igual. Son sub-estados
   de Suscripción **con reloj propio y datos propios**, y se modelan aparte por eso: un estado
   sin reloj no puede vencer solo, y los dos vencen. Se describen en §4 y §5.
7. **Dos filas que comparten `(desde, evento)` tienen guardas disjuntas.** La regla 1 dice qué
   pasa con lo que **falta** en una tabla y no decía nada de lo que **sobra**: dos filas que
   aplican a la vez sobre el mismo par dejan el desenlace en manos del **orden en que una
   implementación recorra la tabla**, que es exactamente la diferencia entre una máquina de
   estados y una convención. **No se dirime por precedencia**, porque una precedencia es una
   séptima cosa que hay que acordarse de leer: se exige que **las condiciones no se puedan
   satisfacer las dos a la vez**, y una tabla que no lo cumpla es un defecto de la tabla.

   **Qué pasa si igual se solapan**: el intento **cae en la regla 1** —no se ejecuta, se registra
   como evento de dominio y, si tocaba plata o estado, pone la marca—. Elegir una de las dos sería
   convertir un defecto de diseño en un comportamiento, y convertirlo **en silencio**.

   **Es una propiedad del texto, no de una ejecución, así que la vigila un guard**: `G-R4`, sobre
   las tablas de transiciones de las nueve máquinas, en las dos épicas. Los pares con dos filas y
   dos destinos distintos que el diseño declara hoy son **tres**, en dos tablas:

   | par | las dos filas | qué las separa |
   |---|---|---|
   | `(PRE_TRIAL, evento de activación de la vertical)` | `T1` / `T6` (`V/03` §2) | el booleano `cubierto`: una exige que **no** haya fuente viva de clase `TÍTULO` y la otra que **sí** |
   | `(GRACE_PERIOD, entra el pago)` | `S5` / `S19` (`B/03` §3.2) | si la fila **es la predecesora de una sucesión en curso**: `S5` exige que no, `S19` que sí |
   | `(SUSPENDED, entra el pago)` | `S7` / `S19` | el mismo booleano |

   **Los tres son disjuntos por construcción y no por acuerdo**, que es la única forma en que la
   regla se cumple sin una precedencia: difieren en el valor de **un booleano**, no en una
   combinación que alguien tenga que evaluar en orden. **Que sean tres y no cuatro no es una
   afirmación de este capítulo: es lo que `G-R4` cuenta en cada PR**, y por eso la regla no
   depende de que alguien vuelva a recorrer las nueve tablas a mano.

   **Compartir el `desde` no es compartir el par, y hay siete casos vivos que lo piden dicho.**
   `T7` (`V/03` §2) sale también de `PRE_TRIAL`, pero su evento es **el encendido de los días de
   trial de la vertical** —un cambio de catálogo— y no el evento de activación de la persona. Su
   par, `(PRE_TRIAL, encendido)`, tiene **una sola** fila. `S18` (`B/03` §3.2) sale desde la
   FASE 9-bis-3 también de `PENDING_AUTHORIZATION`, que comparte `desde` con `S2` y con `S3`: su
   evento es **que la predecesora dejó de ser fila viva sin `S17`**, y ninguna otra fila lo
   declara, así que sus dos pares tienen **una sola** fila cada uno. **Y `A5` (`B/03` §8) sale
   desde la misma pasada también de `PENDING_AUTHORIZATION`**, que en la máquina de addon comparte
   `desde` con `A2` y con `A3`: sus eventos son **los tres** que declara desde `DEC-ADDON-003`
   —darse de baja, **quedar huérfano** y **que se revoque el grant del que cuelga el ancla que era
   su título**—, y ninguna
   otra fila de esa tabla declara ninguno de los tres, así que **cada uno de sus pares tiene una
   sola fila**. **Que el tercero y el segundo se cumplan a la vez —lo que pasa al revocar, en el
   scope `VERTICAL_SUBSCRIPTION`— no es lo que esta regla prohíbe**: son dos eventos de la misma
   fila y con el mismo destino, no dos filas sobre un par. **Y `PB7` y `PB8` (`V/03` §9)
   salen las dos de `ARCHIVED`**, que desde la FASE 9-bis-3 dejó de ser un estado sin salida: los
   eventos de `PB7` son **dos** desde `DEC-DATA-003` —**el cambio de `cubierto`** y **que el cupo
   vuelva a alcanzar sin que `cubierto` cambie**— y el de `PB8` es **el acto del dueño de
   reactivarla**; los **tres** son distintos entre sí y de todo lo demás, así que cada uno de esos
   **tres** pares tiene **una sola** fila. **Las dos ramas de `PB7` tampoco compiten entre ellas**:
   son dos eventos de la misma fila con el mismo destino, igual que las dos de `PB2` y las dos de
   `PB3`. **Y `S20` y
   `S21` (`B/03` §3.2) salen las dos de *«toda fila viva de complemento»***, que es el mismo
   `desde` escrito con las mismas palabras: sus eventos son **otorgar o anclar un grant** y **que
   su instancia llegue a `CANCELLED`**, distintos entre sí y de todo lo demás, y además **no se
   pueden satisfacer a la vez** —`S20` declara que la instancia **no** cambia de estado—, así que
   cada uno de esos dos pares tiene **una sola** fila. **Y las dos filas de la baja que la
   FASE 9-bis-4 agregó (`B/03` §3.2) son los casos sexto y séptimo**: `S22` sale de `PAUSED`, que
   comparte `desde` con `S10` y con `S13`, y `S23` sale de `SUSPENDED`, que lo comparte con `S7`,
   con `S19` y con `S13`. **Su evento es el de la baja** —*«pide la baja»*, el mismo de `S11`—, que
   ninguna de esas filas declara: el de `S10` es *«llega el fin, o la persona vuelve antes»*, el de
   `S7` y `S19` es *«entra el pago»* y el de `S13` es el otorgamiento de un grant. Así que cada uno
   de esos dos pares tiene **una sola** fila. En los siete casos no hay guardas que
   dirimir y la tabla de arriba **sigue teniendo tres entradas**. Lo que este guard cuenta son
   **pares**, no estados de origen.

---

## Lo que esta mitad NO cierra

- **Las restricciones de base** que hacen cumplir estas máquinas son del capítulo 02.
- **Qué correo sale en cada transición** es del capítulo 07 (núcleo).
- **Los relojes**, como jobs concretos con su horario y su idempotencia, son de cada subdominio.

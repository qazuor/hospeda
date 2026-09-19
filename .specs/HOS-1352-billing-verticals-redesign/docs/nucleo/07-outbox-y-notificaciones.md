---
title: Master Spec 07 — Outbox y notificaciones
linear: HOS-1352
statusSource: linear
created: 2026-09-17
updated: 2026-09-19
status: CURRENT
fase: 2
capitulo: 7
cierra:
  - M-MAIL-01
  - M-MAIL-02
  - M-MAIL-03
  - M-MAIL-04
---

# 07 · Outbox y notificaciones

El §42 pone los schedules en la base, el §43 garantiza que un fallo de correo no afecta al
dominio, y el §44 exige que el intento quede registrado.

Los cuatro huecos que este capítulo cierra son las cuatro cosas que esos tres párrafos dan por
resueltas y no lo están: **cuándo** se manda, **una sola vez**, **a quién sí y a quién no**, y
**qué manda el proveedor por su cuenta**.

---

## 1. El outbox

El §44 fija los estados: `pending`, `processing`, `sent`, `failed`, `retry`, más el id del
proveedor y los intentos. Esta spec agrega tres cosas que el §44 no dice.

### 1.1 El correo se encola dentro de la transacción de dominio, y se manda afuera

La transición escribe su estado **y** la fila de outbox en la misma transacción. Lo que queda
afuera es el **envío**, que lo hace un proceso aparte leyendo la cola.

Es lo que hace cierto al §43 —*«Si falla mail: acción de dominio permanece»*— sin perder el
aviso: si el envío se cae, la fila sigue en `pending` y se reintenta. Encolar dentro y mandar
afuera es la única combinación que no pierde ninguno de los dos.

### 1.2 `processing` necesita dueño y vencimiento

Un estado `processing` sin nada más es una fila que se queda trabada para siempre cuando el
proceso que la tomó muere. Lleva **quién la tomó** y **hasta cuándo**; vencido ese plazo,
vuelve a `pending`.

### 1.3 Un `failed` definitivo que era obligatorio se escala

El §43 dice que el dominio no se frena, no que nadie se entere. Si un correo **transaccional no
suprimible** (§4) agota sus reintentos, eso es un evento que mira una persona — porque el
cliente no recibió algo que teníamos la obligación de mandarle.

---

## 2. Que se mande una sola vez · cierra `M-MAIL-02`

El §44 garantiza que el intento quede **registrado**. No garantiza que sea **único**, y no es lo
mismo: un job que corre dos veces, un reintento, o dos instancias en paralelo mandan dos correos
con el §44 perfectamente cumplido.

**La clave de deduplicación, y es una columna con restricción de unicidad:**

```text
(destinatario, plantilla, ocurrencia)
```

Donde **ocurrencia** es lo que identifica *este* envío y no otro de la misma plantilla:

| tipo de correo | qué es la ocurrencia |
|---|---|
| de **schedule** (avisos previos, campaña, recordatorios de renovación) | el sujeto más el hito: `trial:<id>:pre:-2d`, `sub:<id>:renov:-5d` |
| de **evento** (cobro fallido, cancelación, aumento aplicado) | el id del evento de dominio que lo causó |

**La clave se calcula antes de encolar, no antes de enviar.** Si se calculara al enviar, dos
procesos ya habrían encolado dos filas y la restricción llegaría tarde.

**Y el reloj no entra en la clave.** Un aviso de «faltan 2 días» tiene una sola ocurrencia por
trial, aunque el job corra cada hora — si la fecha del cálculo entrara en la clave, correrlo dos
veces el mismo día seguiría mandando dos.

**Un caso que esto tiene que dejar pasar a propósito**: si el trial se extiende (T4 del cap. 03),
el aviso de «faltan 2 días» **corresponde de nuevo** contra la fecha nueva. La ocurrencia
entonces incluye la fecha objetivo vigente, no un contador — y al correrse la fecha, cambia la
ocurrencia y el aviso vuelve a salir. Es deliberado: `DEC-TRIAL-*` deja la campaña re-agendada, y
sin esto la extensión dejaría al cliente sin aviso.

---

## 3. El huso horario es un invariante · cierra `M-MAIL-01`

El §10.7 y el §42 definen todas sus ventanas en días: *«10 días antes»*, *«-1 día»*, *«+60
días»*. **Un cálculo hecho en otro huso manda el correo el día equivocado**, y una ventana de
«últimos N días» cuenta mal.

**El invariante**: toda ventana expresada en días se computa en el huso del mercado —
`America/Argentina/Buenos_Aires` —, y **el instante se guarda siempre en UTC**. El PDR fija el
mercado sin ambigüedad: el §29 nombra la normativa argentina y el §6 su terminología.

Tres consecuencias operativas:

1. **«Tres días antes» significa un día del calendario, no 72 horas.** El límite del día es
   medianoche del huso del mercado.
2. **Un proceso que corre en UTC tiene que convertir**, y eso incluye a los jobs: el error no se
   ve en un servidor en UTC y sí se ve en la máquina de quien desarrolla, o al revés.
3. **Se cruza con la cuota mensual de `DEC-ENT-002`**: el momento del reset es una ventana
   temporal y se computa igual, en el huso del mercado.

---

## 4. Transaccional o comercial, y quién suprime a quién · cierra `M-MAIL-03`

El §42 y el §43 no dicen nada sobre supresión: ni opt-out, ni rebote duro, ni cuenta borrada, ni
tope diario. Y falta la distinción que ordena todo lo demás.

### 4.1 Las dos clases

| clase | cuáles | se suprimen |
|---|---|---|
| **Transaccional, no suprimible** | aviso de aumento (§29), fallo de cobro y avisos del grace (§20, §42.3), vencimiento de trial (§10.7 pre), los dos avisos previos al borrado (`DEC-DATA-001`), confirmación de una operación que el cliente pidió, y el aviso que **precede** a una cancelación (`DEC-MAIL-001`) | **no**, salvo por §4.2 |
| **Comercial, suprimible** | la campaña de recuperación post-trial del §10.7 (+1, +5, +15, +30, +60) | **sí** |

**Mezclarlas es a la vez un problema legal y de reputación del dominio de envío**, y si se
suprimen las dos juntas se dejan de mandar avisos obligatorios. Los dos avisos de
`DEC-DATA-001` son el ejemplo exacto: si cayeran bajo el opt-out comercial, se dejaría de avisar
justo a quien está por perder su contenido.

### 4.2 La jerarquía de supresión, en orden

| # | causa | suprime | por qué |
|---|---|---|---|
| 1 | **rebote duro** | **todo**, incluso lo transaccional | la dirección no existe: no hay a quién mandarle |
| 2 | **cuenta borrada** | todo | ídem |
| 3 | **opt-out** | sólo lo comercial | es una preferencia sobre marketing, no sobre la relación contractual |
| 4 | **tope diario** | sólo lo comercial | protege la reputación del dominio sin tocar obligaciones |

**Un rebote duro sobre un correo obligatorio no es un no-envío: es un evento.** Se registra como
no entregable y se escala (§1.3), porque el cliente no recibió algo que teníamos que mandarle y
alguien tiene que poder llegar por otra vía.

### 4.3 El tope diario cuenta por destinatario, no global

Un tope global convierte un pico de actividad en correos perdidos para gente que no tuvo nada que
ver. Por destinatario, el que recibe mucho es el que se frena.

---

## 5. Lo que el proveedor manda por su cuenta · cierra `M-MAIL-04`

Está medido sobre la casilla real del owner: **43 correos del proveedor en un día**. Le escribe
al cliente **por su cuenta y siempre primero** en cuatro momentos: **alta**, **cambio de monto**,
**pausa** y **cancelación** (`EX-3`).

### 5.1 Tres de esos correos afirman cosas que sus propios datos desmienten

| lo que dice | lo que pasó |
|---|---|
| *«Pagaste la suscripción»*, en el alta | el correo sale ~18 s después de autorizar y **el cobro llega ~26 min más tarde**; en dos sujetos medidos **no llegó nunca** |
| *«Cobramos $15 para validar tu tarjeta»* | el cargo registrado es de **$0** |
| el rechazo `2084`, *«no se puede reembolsar»* | sí se puede: sobre el mismo pago, ARS 5 se rechazó y ARS 14 entró |

### 5.2 Y dos son ambiguos de una forma que nos cuesta plata

- **`paused` y `cancelled` llegan idénticos**: los dos dicen *«por un pago no realizado o por
  opción del vendedor»*. Una **cortesía** y una **mora** son indistinguibles para el cliente.
- **Los cuatro lo mandan a nuestra puerta** (*«contactá con el vendedor»*): **no hay
  autogestión**, todo cae en nuestro soporte. Hay que dimensionarlo así, no como excepción.

### 5.3 Las tres reglas, ya decididas

1. **Los correos falsos se ANTICIPAN, no se desmienten** (`DEC-MAIL-001`). Desmentir es una pelea
   que se pierde: el suyo llega primero y con su marca. El nuestro de alta avisa que va a llegar
   uno diciendo que ya pagó, y da la fecha del primer cobro real.
2. **Nuestro correo bloquea la acción sólo antes de cancelar.** Es la excepción declarada al
   §64.25, acotada al único punto donde el correo del proveedor hace daño. Y **sale gratis**: la
   cancelación de la vieja ocurre cuando llega el webhook de que la nueva quedó autorizada, que
   es un momento que controlamos — si el correo falla, no se cancela y se reintenta, y el estado
   intermedio no es destructivo porque las dos conviven (`EX-6`).
3. **Nuestra comunicación desambigua lo que el proveedor dejó ambiguo**: si pausamos por
   cortesía, se dice; si es por mora, se dice.

### 5.4 El `reason` es copy, no un identificador

Está medido que **el `reason` es el texto que el cliente ve** en el asunto y el encabezado del
correo del proveedor, y que **se puede reescribir** sobre una suscripción viva (`EX-3`, `EX-19`).

**Nunca lleva un slug interno ni un id.** Es un invariante (`D9` del cap. 04) y se vigila con un
guard, porque es el tipo de campo que alguien completa con lo que tiene a mano.

---

## 6. El catálogo de correos

Todos los schedules salen de la base (§42). Los valores de abajo son **defaults**, no constantes.

| momento | clase | schedule default | de dónde sale |
|---|---|---|---|
| trial por vencer | transaccional | 10, 5, 2 y 0 días antes | §10.7 |
| trial vencido — recuperación | **comercial** | +1, +5, +15, +30, +60 días, y **termina ahí** | §10.7 |
| renovación por venir | transaccional | 5 y 1 día antes | §42.2 |
| cobro fallido / grace | transaccional | configurable dentro de la ventana, **relativo al vencimiento** | §42.3, `DEC-SUB-002` |
| aumento de precio | transaccional | **3 contactos**: al anunciar, a 30 días y a 7 días, cada uno con **la fecha de ese cliente** | `DEC-MP-002` |
| antes de cancelar | transaccional | **bloquea la acción** | `DEC-MAIL-001` |
| excedente por downgrade | transaccional | al pedirlo, **con el criterio escrito**: se despublican las publicadas más recientemente | `DEC-SUB-008` |
| reanudación tras pausa | transaccional | al reanudar. **Dice una sola cosa: qué día se le cobra** | `DEC-SUB-010` |
| pausa por cortesía | transaccional | al otorgarla y al vencer; desambigua el correo del proveedor | `DEC-GRANT-003` |
| pierde la cortesía al pausar | transaccional | antes de confirmar, y **el cliente elige** | `DEC-GRANT-004` |
| retención | transaccional | antes del día 90 y antes del día 180 | `DEC-DATA-001` |
| **cambio de plan con una cuota en reintento** | transaccional | **antes de confirmar el cambio**, mientras la predecesora siga viva | cap. 12 §5.3 (épica de billing) |

**El último no es un aviso más: es la condición bajo la cual se aceptó la decisión.** Se decidió
perdonar el período impago y **no cancelar la predecesora antes de tiempo** —cancelarla
contradice `D7`, y si el cliente abandona el checkout se queda sin nada—, así que su cuota sigue
en `recycling` y **puede entrar**. Un cobro que sorprende es un reclamo; uno anunciado es un
trámite.

**El schedule del grace es relativo al vencimiento y no absoluto**: como la ventana es
configurable por plan, un schedule con días fijos se cae fuera de la ventana en los planes con
grace más corto (`DEC-SUB-002`).

---

## Lo que este capítulo NO cierra

- **El texto de cada correo** no es parte de esta spec.
- **Qué pasa si un cliente responde un correo** — no hay canal de entrada modelado, y el §5.2
  mide que el proveedor manda todo a nuestra puerta. Queda anotado como superficie de soporte
  del capítulo 19, no como hueco de notificaciones.

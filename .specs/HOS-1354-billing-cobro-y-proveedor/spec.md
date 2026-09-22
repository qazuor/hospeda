---
title: Billing — cobro, suscripción y proveedor detrás de un adaptador
linear: HOS-1354
statusSource: linear
created: 2026-09-18
updated: 2026-09-21
type: feature
areas:
  - billing
  - api
  - db
parent: HOS-1352
---

# Billing — cobro, suscripción y proveedor detrás de un adaptador

> **Esta épica se sostiene sola en su diseño, y está bloqueada en un punto.** Trece capítulos
> escritos, uno sin escribir, y el que falta es el que más depende de con qué pasarela vamos a
> cobrar.
>
> **No sale a producción sola** (`DEC-ARCH-007`): las dos épicas llegan juntas y terminadas.

## 1. Qué la bloquea, exactamente

**No es el diseño: es que no está decidida la pasarela.** `DEC-ARCH-004` puso el ciclo de vida de
nuestro lado y dejó la pasarela detrás de un adaptador — al proveedor se le pide **cobrar,
reembolsar, leer y avisar**, y nada más. Pero el adaptador de referencia sigue sin decidirse:

| | |
|---|---|
| **Mercado Pago** | niega el cobro a demanda con un `403 "The application is not authorized to perform this type of payment"` en **las cuatro variantes** del request. Es un portón comercial, no un error del pedido. La PRUEBA 0 (§5.0 del documento 10) son dos textos ya redactados que **el owner tiene que enviar** |
| **Mobbex** | documenta el cobro a demanda **con monto libre** —exactamente lo que `DEC-ARCH-004` necesita— pero el alta propia quedó en **revisión manual de KYC**. Sin entidad aprobada no hay token. La batería de sondas está escrita y lista |
| **el resto de la plaza** | búsqueda externa del 2026-09-18: **ningún proveedor argentino ofrece el cobro a demanda como self-service**; los cinco relevados exigen alta comercial previa |

**Lo que NO la bloquea**: casi todo el diseño. Suscripción, grace, pausa, promos, cortesías,
grants, addons, conciliación, idempotencia y las máquinas de estado del dinero **ya están
escritos**.

## 2. El diseño de esta épica

Trece capítulos en [`docs/`](./docs/), y **cinco de ellos son billing sin una sola fisura** —
ninguna de sus secciones sobrevive sin la pasarela.

| # | capítulo | qué resuelve |
|---|---|---|
| `02` | [modelo de datos](./docs/02-modelo-de-datos.md) | `billing_option` —donde vive el precio—, suscripción, pausa, el vínculo con el proveedor, el dinero, addons y concesiones |
| `03` | [máquinas de estado](./docs/03-maquinas-de-estado.md) | **siete**: Suscripción, Grace, Pausa, Pago, Pago manual, Addon, y la regla de no-retroceso |
| `05` | [idempotencia y concurrencia](./docs/05-idempotencia-y-concurrencia.md) | los tres mecanismos, los seis cruces del §52, y qué hace seguro a un pago tardío |
| `06` | [proveedor](./docs/06-proveedor.md) | las ocho capacidades, las cinco reglas duras de trato, el riesgo de plataforma |
| `09` | [conciliación](./docs/09-conciliacion.md) | las cuatro partes, los tres modos de «cero cobros», y el bug vivo que pasa a ser caso de uso |
| `10` | [retiro de plan y vertical discontinuada](./docs/10-verticales-planes-billing-options.md) | retirar no mueve a nadie; discontinuar **deja de cobrar antes de dejar de prestar** |
| `12` | [suscripción](./docs/12-suscripcion.md) | el grace, la cola de cambios programados, el precio que cambia entre programar y ejecutar |
| `14` | [promos, cortesías y grants](./docs/14-promos-cortesias-y-grants.md) | el orden de aplicación y el piso, y cómo se combinan entre sí |
| `16` | [addons](./docs/16-addons.md) | dos ejes, qué es una suscripción «válida», el addon a costo cero, el huérfano **y el estado en que queda su cobro** |
| `19` | [superficies](./docs/19-superficies.md) | la pricing, Mi Suscripción y la baja |
| `20` | [testing](./docs/20-testing.md) | las cuatro capas y **quince guards** —`G7`, `G9`–`G13`, los seis de `R1` y las tres referencias cruzadas—, el proveedor falso que **tiene que mentir**, y la suite de sandbox |
| `21` | [migración](./docs/21-migracion.md) | la premisa del §56 medida, y el cobro durante el rediseño |
| `22` | [lo legal](./docs/22-lo-legal.md) | el aumento, la revocación y el botón de arrepentimiento |

**Falta el `13` (Pagos)**, el único de los 22 sin escribir. Ver §5.

### 2.1 Lo que cita y no contiene

| qué | dónde |
|---|---|
| **el núcleo** — reglas de escritura, glosario, invariantes, outbox, auditoría, y el método del modelo de datos y de las máquinas | [`docs/nucleo/`](../HOS-1352-billing-verticals-redesign/docs/nucleo/) |
| **el contrato de cobertura** — la frontera con la otra épica | [`12-contrato-de-cobertura.md`](../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md) |
| **el PDR, el decision log y la matriz del proveedor** | [`docs/`](../HOS-1352-billing-verticals-redesign/docs/) |

---

## 3. Las definiciones declaradas

### 3.1 Al proveedor se le piden cuatro cosas, y el ciclo de vida es nuestro

`DEC-ARCH-004`. **Cobrar, reembolsar, leer y avisar.** El package concentra el dominio entero —el
reloj de la pausa, el dunning, los reintentos, las cortesías y el candado contra el doble cobro— y
**la pasarela queda como un detalle al fondo**.

Dos condiciones que lo hacen exigible: un **guard estático** que prohíba importar el SDK fuera del
adaptador, y un **adaptador falso en memoria desde el día uno** — que es lo que prueba que la
abstracción no miente.

**Y las pasarelas NO son intercambiables.** La API no expone el mínimo común denominador: **para
cada capacidad se declara qué pasa cuando el proveedor no la tiene** — se emula, se degrada, o se
bloquea la función del producto. Un adaptador que finge paridad es peor que ninguno, porque el
código de arriba le cree.

### 3.2 El riesgo se trasladó hacia nosotros, y está declarado

Con el ciclo de vida de nuestro lado, **un doble cobro es nuestro bug y es plata de un cliente
real**. Está medido que ni Mercado Pago ni Mobbex ofrecen idempotencia en la creación, así que
**el candado es nuestro y va antes de llamar al proveedor** (`DEC-CONC-001`).

Se aceptó el trade por dos razones: un bug nuestro se arregla y uno del proveedor no, y **nadie
puede testear lo que no controla**.

### 3.3 El código de estado no cierra ninguna mutación

**Toda mutación se verifica releyendo y comparando campo por campo.** No es criterio: es medición
—de ocho operaciones que el PDR pediría, **cinco devuelven `2xx` y no aplican nada**—. No es un
proveedor que rechaza lo que no soporta: es uno que **acepta y descarta**.

Y no alcanza con releer «la» mutación: un `PUT` con varios campos **se aplica a medias con un solo
`200`**. El que falla no arrastra al que funciona.

### 3.4 Las cuatro decisiones de mecanismo que ya están tomadas

| | |
|---|---|
| **la pausa** | es la **nativa del proveedor**, en **meses enteros**, y los días no usados del ciclo en curso se pierden — con ciclos enteros el cliente vuelve el mismo día del mes, así que lo perdido se compensa con lo que gana al volver. **El reloj que la reanuda es nuestro** (`DEC-SUB-010`) |
| **la cortesía temporal** | se implementa **pausando** en el proveedor y sosteniendo el servicio de nuestro lado. Es la única de las cuatro estrategias medidas que **no mueve un peso** (`DEC-GRANT-003`) |
| **cada addon recurrente** | es **una autorización aparte**, no una línea del monto del plan. Subir el monto toca plata cada vez, en el punto exacto donde el proveedor acepta sin aplicar — y esa mutación **no emite aviso** (`DEC-ADDON-002`) |
| **el cambio de precio** | se muta el monto de la autorización vigente; el aviso previo se cumple **de nuestro lado** (`DEC-MP-001`) |

### 3.5 Nunca se le pide un trial al proveedor

Está medido que **una fecha de primer cobro futura se convierte en un free trial sola**: el request
no lo nombra, el objeto queda con uno, y al comprador se le anuncia *«Tu prueba gratis comenzó»*.

Como la fecha futura es la **precondición de seguridad** de todo cambio de plan y de ciclo, no se
puede evitar: **se anticipa, no se desmiente**. Y el guard tiene que mirar la relectura, porque
**en el payload no hay nada que ver**.

### 3.6 La copy del proveedor no sostiene ninguna decisión

Tres textos suyos contradicen sus propios datos. **Regla para soporte, que sale directo de la
medición: ante un reclamo, mirar el PAGO, nunca el correo.**

### 3.7 El proveedor falso tiene que mentir

No alcanza con que responda bien: **tiene que reproducir los modos de falla medidos** —aceptar y no
aplicar, responder `2xx` sobre lo que descartó— porque un doble tiene que fallar como el original.
El e2e que corre hoy contra un stub honesto **no puede, por construcción, detectar divergencias**
con el proveedor real.

---

## 4. El contrato con la épica de verticales

Esta épica **entrega** un hecho y un aviso, y nada más: una consulta de cobertura por
`user + vertical`, y el evento que avisa que esa cobertura cambió. Los dos están definidos —y
**sólo** definidos— en
[`12-contrato-de-cobertura.md`](../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md):
**la firma exacta, con todos sus campos y su tabla de qué es cada uno, es su §2**; el aviso es su
§3; qué emite cada uno de los nueve estados de la suscripción, su §2.6.

> **Acá no va una copia de la firma, y la ausencia es el arreglo.** `DEC-ARCH-006` protege al
> contrato de que una épica lo mute sola, pero **una copia no necesita que nadie la mute para
> divergir: alcanza con que el contrato avance**. Ésta existió y divergió — publicaba **tres campos
> de cinco**, sin `alcance` y sin `objetivo`, que son justamente los dos que esta épica tiene que
> llenar para que un addon comprado para una ficha no habilite su capacidad en toda la cartera
> (`F-8dC2-001`). El campo que haga falta acá se lee allá.

**Lo que esta épica implementa son cuatro de las seis fuentes** —suscripción, cortesía, grant y
addon—; las otras dos, el trial y el título `BASE`, son de la otra épica y ya existen (contrato
§5.1 y §5.2). Se enchufa: **no modifica nada de lo construido**.

**Y devuelve un puntero, nunca los valores.** Quién sabe *qué otorga* un plan es verticales;
quién sabe *cuál plan* tiene esta persona es esta épica. Devolver los entitlements resueltos
mudaría la resolución del capítulo 15 para este lado y sería la segunda fuente de algo que tiene
que tener una sola.

**No cruzan la frontera** montos, precios, estados de pago, ids del proveedor ni fechas de cobro.
Ni siquiera el estado exacto de la suscripción: verticales no distingue `ACTIVE` de
`GRACE_PERIOD`, porque durante el grace **el servicio sigue**.

---

## 5. Lo que no se puede cerrar todavía

### 5.1 El capítulo 13 (Pagos), y la pregunta que lo gobierna

Es el único de los 22 sin escribir, y se difirió a propósito. **La primera pregunta cuando esta
épica arranque:**

> **¿El capítulo 13 adopta el cargo puntual contra tarjeta guardada como modelo canónico, tratando
> el mandato del proveedor —lo que Mercado Pago hace hoy— como modo degradado?**

No se puede esquivar, porque decide **quién tiene el reloj**, y eso no se esconde detrás de una
interfaz: **dos relojes sobre la misma autorización son el doble cobro** que `DEC-ARCH-004`
declara como riesgo nuestro.

**Un costo que la decisión no enumeró** y que trajo la búsqueda externa: si el reloj es nuestro,
**los reintentos también lo son, y son terreno regulado** — hay códigos de rechazo que no se pueden
reintentar nunca, hay techo de intentos por ventana y hay multas por excederlo. Hoy eso lo absorbe
Mercado Pago dentro del `preapproval`.

### 5.2 Las ocho filas que siguen `UNKNOWN`

De las 89 de la matriz, contadas con `contar-filas-de-la-matriz.py`. **Cinco son el mismo hecho —
un cobro que falla** — y con Mercado Pago resultó **imposible de fabricar**: `RN-2`, `RN-3`,
`GR-1`, `GR-2`, `GR-3`. Más `WH-5`, `RF-3` y `EX-1`.

**Y hay una consecuencia de la pregunta de arriba que conviene tener presente**: esas cinco
gobiernan el diseño del grace **sólo mientras el reloj sea del proveedor**. Con el reloj nuestro
dejan de ser bloqueantes de diseño y pasan a ser una nota del adaptador de Mercado Pago.

### 5.3 El riesgo de plataforma

**De las ocho capacidades, la única que vive en una API anunciada como discontinuada es
reembolsar** — y es justamente la que el derecho de revocación necesita. La guía de migración del
proveedor **excluye explícitamente a las suscripciones**. Su interfaz no puede filtrar el nombre de
ningún endpoint hacia el dominio.

---

## 6. Cómo se integra, y cómo se libera

**El código de esta épica no va a `staging` por su cuenta** (`DEC-ARCH-007`). Corta de la rama de
integración del paraguas —`epic/HOS-1352-verticales-billing`— y mergea ahí. La unidad que llega a
`staging` es el paraguas, con las dos épicas adentro.

**«Terminada» no significa «en producción»**: significa lista y verificada contra el contrato.

Y la obligación que hace viable todo lo anterior: **`staging` se mergea periódicamente hacia la
rama del paraguas**, nunca al revés hasta el final.

---

## 7. Lo que necesita del owner para destrabar

1. **Enviar los dos textos de la PRUEBA 0** (§5.0 de
   [`10-evaluacion-de-proveedor.md`](../HOS-1352-billing-verticals-redesign/docs/10-evaluacion-de-proveedor.md))
   — el formulario comercial pide una facturación esperada que decide él, y los dos necesitan el ID
   de aplicación.
2. **Avisar cuando llegue el mail de habilitación de Mobbex**, para vincular la entidad y sacar el
   `x-access-token`. La batería de sondas está escrita, con su gatillo, su orden y sus trampas.
3. **Responder la pregunta del §5.1** cuando haya con qué medirla.

---

## 8. Lo que esta spec NO decide

- **Cuál es la pasarela.** Está en el paso 4 de 6 de la evaluación.
- **El modelo canónico de cobro.** Es §5.1, y está planteado con sus tres opciones y una
  recomendación.
- **El orden de implementación.** Sale de las dependencias entre capítulos.
- **Qué se reescribe y qué se reutiliza del código actual.** Es FASE 5, con su gate propio
  (`DEC-METH-003`) — salvo `qzpay`, que `DEC-ARCH-004` ya resolvió: **se absorbe**.
- **Nada de la épica de verticales.** Su diseño se sostiene solo en
  [HOS-1353](../HOS-1353-verticales-capacidades-y-autorizacion/spec.md).

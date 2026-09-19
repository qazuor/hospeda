---
title: "FASE 8-bis · el consolidado: 112 hallazgos, 23 defectos críticos distintos"
linear: HOS-1352
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 8
---

# FASE 8-bis — el consolidado

Ocho informes, ocho vectores, tres pasadas. **Los conteos salen de un script sobre los ocho
archivos**, no de los índices que los agentes devolvieron — uno de ellos se contradijo a sí mismo
en el suyo.

---

## 1. Los números

| informe | vector | hallazgos | CRÍT | ALTA | MEDIA | BAJA |
|---|---|---|---|---|---|---|
| `A1` | acceso cruzado y autorización | 14 | 3 | 7 | 3 | 1 |
| `A2` | máquinas, carreras y huérfanos | 13 | 3 | 8 | 2 | 0 |
| `A3` | datos, migración y acoplamiento | 15 | 5 | 6 | 3 | 1 |
| `B1` | doble cobro y pérdida de pago | 14 | 7 | 5 | 2 | 0 |
| `B2` | máquinas, idempotencia y carreras | 17 | 5 | 8 | 4 | 0 |
| `B3` | conciliación, datos y migración | 12 | 2 | 7 | 2 | 1 |
| `C1` | la costura | 11 | 1 | 7 | 3 | 1 |
| `C2` | liberación, coexistencia y migración | 16 | 2 | 9 | 4 | 1 |
| | **total** | **112** | **28** | **57** | **23** | **5** |

**Los 28 críticos son 23 defectos distintos.** Cinco pares son el mismo defecto contado por dos
agentes ciegos entre sí:

| par | el defecto |
|---|---|
| `F-8bA2-001` ≡ `F-8bA3-001` | `PRE_TRIAL` cuenta para `cubierto` |
| `F-8bA2-002` ≡ `F-8bA3-002` | el trial colgado en `TRIAL_ACTIVE` |
| `F-8bB1-001` ≡ `F-8bB2-002` | `sucede_a` no se limpia nunca |
| `F-8bB1-005` ≡ `F-8bB3-001` | la marca apaga el detector y no tiene cota |
| `F-8bB1-007` ≡ `F-8bB2-003` | «ningún pago acreditado antes» es histórico |

---

## 2. El resultado que decide el próximo paso

**De los 25 críticos de las pasadas A y B, 25 los atribuyen sus propios informes a un cambio de la
FASE 9. Ninguno es un defecto preexistente que la primera pasada hubiera dejado pasar.**

> **La condición de corte del ciclo mide un STOCK de defectos, y el generador de críticos es EL
> ACTO DE ARREGLAR.**

**La causa es precisa y está medida.** La definición de «resuelto» exige recorrer *«todo su
dominio»*, y **los 327 casos enumerados son el dominio del PROBLEMA, nunca el del ARREGLO**. El
caso testigo: al partir el `UNIQUE` del §11 por `sucede_a`, el dominio pasó de **90 a 180 pares** y
la resolución verificó **los 90 de antes**. La mitad nueva contenía el doble cobro que el arreglo
venía a cerrar.

**Su complemento**, que ningún informe individual podía ver: **`R2` construyó el título `BASE`
sobre la premisa «`Turista Free`, `Guest` y `TRIAL_EXPIRED` no tienen ninguna fuente `TÍTULO`», y
`R3` la volvió falsa para dos de los tres.** La pregunta que nadie hizo al resolver por racimos es
**«¿qué premisa de OTRO racimo estoy volviendo falsa?»**.

---

## 3. Los 23 defectos críticos, por familia

**Cada uno lleva su decisión, y la toma el owner**: se arregla ahora, o se declara con su causa y
de qué depende. **El agente no elige por su cuenta.**

### Familia 1 · La cobertura y el paso 5 — 7 defectos

| # | ids | qué se rompe | decisión |
|---|---|---|---|
| **1** | `A2-001` ≡ `A3-001` | `PRE_TRIAL` es fuente de clase `TÍTULO`, así que **casi toda la plataforma está `cubierta`** y `PB2` no puede despublicar a nadie que no haya consumido su trial. En Partner no dispara nunca | PENDIENTE |
| **2** | `A1-001` | `cubierto` se apagó para el addon y **el paso 6 no**: un suspendido conserva lo que su addon otorga. Es el fail-open que el arreglo cerró, un paso más adelante | PENDIENTE |
| **3** | `A1-003` | el criterio del paso 5 saca a **toda lectura** de la resolución única, y con ella al **paso 4**, el único que pregunta si el recurso es del sujeto | PENDIENTE |
| **4** | `A3-004` | las **cuatro fuentes nuevas** no están en la lista de invalidación del caché: un recorte no llega nunca | PENDIENTE |
| **5** | `C1-001` | las **tres defensas del §6** del contrato pierden su sujeto a la vez | PENDIENTE |
| **6** | `A1-002` | el grant se ancla a **un** plan y su scope son **varias** verticales: la referencia de una alimenta a las otras | PENDIENTE |
| **7** | `A3-005` | billing tiene que leer **entitlements y limits** de verticales para decidir si un cambio es upgrade o downgrade. Rompe el corte entre las dos épicas | PENDIENTE |

### Familia 2 · El trial — 3 defectos

| # | ids | qué se rompe | decisión |
|---|---|---|---|
| **8** | `A2-002` ≡ `A3-002` | quien se suscribe **antes de publicar** queda con un trial colgado en `TRIAL_ACTIVE` **que no vence nunca** | PENDIENTE |
| **9** | `A2-003` | `PB3` vuelve sólo por tres caminos: **el que recontrata después de cancelar paga y su ficha no se republica nunca** | PENDIENTE |
| **10** | `A3-003` | `addon_instance` no tiene con qué anclar su versión: **publicar una versión nueva cambia lo que ya se compró** | PENDIENTE |

### Familia 3 · El candado y la sucesión — 8 defectos

| # | ids | qué se rompe | decisión |
|---|---|---|---|
| **11** | `B1-001` ≡ `B2-002` | **nada limpia `sucede_a`**: terminado un cambio de plan, el candado `A` queda **vacío** (se puede abrir un alta nueva y quedar con **dos autorizaciones cobrando**) y el `B` queda **consumido** (nadie cambia de plan dos veces) | PENDIENTE |
| **12** | `B2-001` | **ninguna transición cancela a la predecesora** cuando la sucesora queda autorizada: el invariante que lo exige quedó sin ejecutor | PENDIENTE |
| **13** | `B1-002` | la fecha de primer cobro que se guarda es **la que mandamos**, no la que el proveedor escribió, y el capítulo prohíbe leer esa: el invariante **no subió a verificable** | PENDIENTE |
| **14** | `B1-003` | *«un día como mínimo»* contra una ventana de **72 h**: toda sucesora autorizada después del primer día **nace con la fecha ya vencida**, y está medido que no se puede mover | PENDIENTE |
| **15** | `B1-004` | el cobro de la cuota en reintento **reactiva a la predecesora**, y el crédito de la sucesora ya se computó en cero | PENDIENTE |
| **16** | `B1-006` | el contrato no dice qué emite una suscripción **esperando autorización**: o son 72 h de servicio completo gratis y repetibles, o son dos planes sumados durante toda la sucesión | PENDIENTE |
| **17** | `B2-004` | la excepción que deja suceder a una baja programada **marcada** se apoya, textualmente, en el hecho que la marca puede estar denunciando | PENDIENTE |
| **18** | `B2-005` | **seis de los ocho pares** (estado nuestro, estado del proveedor) no tienen transición declarada: la regla de no-retroceso no puede escribir lo que lee | PENDIENTE |

### Familia 4 · La marca de conciliación — 2 defectos

| # | ids | qué se rompe | decisión |
|---|---|---|---|
| **19** | `B1-005` ≡ `B3-001` | una fila marcada **cubre, no se barre y no tiene reloj**: apaga el único detector de una divergencia de monto, congela la salida del cliente, y el servicio gratis **no tiene cota** | PENDIENTE |
| **20** | `B1-007` ≡ `B2-003` | *«ningún pago acreditado antes»* es **histórico y sin ventana**: corta al que nunca pagó y deja afuera a **todo cliente que vuelve** | PENDIENTE |

### Familia 5 · El corte y la migración — 3 defectos

| # | ids | qué se rompe | decisión |
|---|---|---|---|
| **21** | `B3-002` | *«no se migra»* se llevó puesta la regla que hacía **resoluble el id viejo**: un cobro viejo vuelve como huérfano y se imputa a la suscripción nueva. **Es una omisión de aplicación, no un defecto de diseño** | PENDIENTE |
| **22** | `C2-001` | el día del corte **toda la cartera existente queda en `PRE_TRIAL`**, y el evento que la sacaría de ahí **ya ocurrió** | PENDIENTE |
| **23** | `C2-002` | la decisión de no migrar **no eliminó el punto de no retorno: lo subió de escala**, y nadie declara el orden entre cancelar y desplegar | PENDIENTE |

---

## 4. Lo que NO es un defecto de diseño y no necesita decisión

Son omisiones de aplicación: cosas ya decididas que no se pegaron. **Se aplican, no se discuten.**

| qué | dónde |
|---|---|
| `R5-G` — el compromiso viejo se conserva con su vínculo al proveedor | `B/21-migracion.md`; es el defecto **21** |
| `R5-D`, su mitad *«una fila por vertical de su scope»* | `B/21-migracion.md`; toca el defecto **6** |
| el resumen de invariantes quedó en «16 apoyos sobre 14» y «51, ocho de base» | `NUCLEO/04` §5; el real es **52 y 10**, y hay que **recorrerlo entero**: un apoyo se **mudó**, no se agregó |

---

## 5. Los límites de esta pasada, declarados

1. **El capítulo 13 (Pagos) sigue sin existir.** Lo que cae en ese hueco está señalado en cada
   informe de billing.
2. **Nada se verificó ejecutando.** Es diseño en papel; los caminos son argumentales y están
   sostenidos en citas textuales, que es lo que los vuelve refutables.
3. **`RES-01`** —la mitad `Guest` de un hallazgo de la FASE 8— se profundizó y **no se contó como
   nuevo**: ya estaba nombrada con su decisión.

---
title: Master Spec 02 — Modelo de datos
linear: HOS-1352
statusSource: linear
created: 2026-09-17
updated: 2026-09-25
status: CURRENT
fase: 2
capitulo: 2
cierra:
  - C-ARCH-01
  - S-ARCH-01
  - M-ARCH-02
  - M-DATA-01
---

# 02 · Modelo de datos

La mitad de núcleo del capítulo 02 del programa: el método que rige para las dos épicas (qué sale de la base y qué no) y el registro de eventos. Las mitades de verticales y de billing viven en sus respectivas épicas.

Las entidades, sus relaciones y **las restricciones que hacen cumplir los invariantes**. No es
un DDL: no hay tipos ni índices acá, porque eso es decisión de implementación. Lo que sí hay es
qué guarda cada cosa, cómo se relaciona y **qué la base tiene que impedir por sí sola**.

Los nombres de estado salen del capítulo 01 (núcleo) y las transiciones del 03.

---

## 1. Qué sale de la base y qué no · cierra `C-ARCH-01` y `S-ARCH-01`

### 1.1 El §9 no se puede cumplir tal como está escrito

El §9 es terminante: toda configuración relevante sale *«SI O SI DE DATABASE»*, y prohíbe
*«archivos TS»*, *«constantes duplicadas»* y *«listas hardcodeadas»*. Entre lo que enumera están
**verticales**, **entitlements** y **limits**.

Y no se puede, por una razón que no es de comodidad: **no hay forma de evaluar una capacidad sin
nombrarla**. Cualquier control de acceso pregunta por *una* capacidad concreta, y ese nombre es
un literal en el código. Lo mismo con las verticales: el §13 exige que las operaciones lleven
contexto de vertical suficiente para impedir autorización cruzada, y eso sólo es verificable si
el conjunto de verticales se conoce al compilar.

El propio §9 lo admite a medias en su última línea —*«Código solamente debe contener
comportamiento/algoritmos que no representen configuración comercial»*— pero la frase anterior
es absoluta y se va a leer como absoluta. **Un principio que se va a violar en silencio es peor
que uno acotado**, y el silencio es exactamente lo que el §9 dice querer evitar.

### 1.2 La separación

Son dos cosas distintas y el §9 las trata como una:

| | **Catálogo de claves** | **Configuración comercial** |
|---|---|---|
| **qué es** | qué capacidades, qué límites y qué verticales **existen** | qué plan otorga qué clave, con qué valor, en qué vertical, a qué precio, con qué schedule |
| **dónde vive** | **en el código** | **en la base, sin excepción** |
| **por qué ahí** | el código tiene que poder nombrarlas, y el §13 exige verificarlas al compilar | es lo que cambia sin deploy, y es lo que el §9 viene a proteger |
| **quién lo cambia** | un desarrollador, en un release | un administrador, en cualquier momento |

**El catálogo no es una lista suelta: está verificado contra la base.** Un control automático
falla si una clave usada en código no existe en la base, **y también al revés** — si una clave
de la base no existe en el catálogo. Las dos direcciones, porque cada una es un defecto
distinto: la primera es un permiso que nunca se puede otorgar, la segunda es configuración que
nadie va a leer. **Desde la revisión del owner (2026-09-28, N1) las dos direcciones siguen, y se
reparten distinto**: la primera la mira `G3` contra el catálogo, en CI; la segunda es una
**restricción de la base** (§1.4), porque la base de producción se edita desde el panel y CI no la
ve.

**Esto reescribe el invariante §64.15.** El PDR dice *«Toda configuración comercial viene de
DB»*; la forma aplicable es **«toda configuración comercial viene de la base; el catálogo de
claves es código verificado contra la base»**. Es un apartamiento acotado y declarado, no una
excepción abierta: **lo único que vive en código es el conjunto de nombres. Ningún valor, ningún
precio, ninguna asignación.**

### 1.3 Lo que queda del lado de la base, completo

Todo lo que el §9 enumera menos los tres nombres de arriba: planes, planes de trial, billing
options, precios, duración de trial, schedules de correo, qué entitlement da cada plan, qué
límite, herencia, ajustes de pausa, métodos de pago admitidos, políticas de promo, addons, y
cualquier regla comercial configurable. **Y los plazos que deciden cuándo pasa algo** (§1.5;
revisión del owner, 2026-09-28, C9).

### 1.4 Los valores nacen una vez y después sólo los cambia el panel · revisión del owner, N1

(Revisión del owner, 2026-09-28, N1, `L1-e` y `L1-f`.) **La configuración de planes vive 100 % en
la base.** El §1.2 ya lo decía; lo que faltaba era cómo llegan los valores y quién los cambia.

1. **No existe archivo de valores, ni como punto de partida del seed.** El archivo de configuración
   de planes de hoy (`packages/billing/src/config/`, 11 archivos y 3378 líneas medidas en
   hospeda2 el 2026-09-28) **se borra entero**, con lo que lo lee sólo para eso; la lista está en
   `B/21` §4.
2. **El catálogo de producción nace el día del corte con una migración de datos única** (`L1-e`):
   corre una vez, en el paso 3a del corte (`16-fase-7…` §4.2), y **nunca más es fuente de nada**.
   Es historia y no configuración: el paso 6 del mismo corte la reemplaza con la foto de la base.
3. **Después, los valores sólo cambian por cinco acciones administrativas** (`L1-f`;
   `NUCLEO/08` §3, de la 18 a la 22): **publicar una versión de plan, fijar el precio de un ciclo,
   publicar una versión de complemento, crear o cerrar un código promocional y cambiar un plazo**.
   Sólo `SUPER_ADMIN`, auditadas y con una confirmación que dice qué cambia. Sin ellas nadie tenía
   el permiso de publicar una versión de plan, aunque `B/10` §3 dice que retirar es publicar una.
4. **El catálogo de claves sigue en código** (§1.2): una clave sin código que la respete no hace
   nada aunque se cargue en el panel.

**Lo que antes miraba un guard de CI y ahora lo rechaza el panel o la base.** Un guard de CI lee el
repositorio, y el catálogo de producción ya no está ahí: un error de carga en el panel le podía
regalar una capacidad paga a toda la plataforma sin que ningún guard lo viera.

| lo que se rechaza | antes | ahora |
|---|---|---|
| una clave de la base que no está en el catálogo | `G3`, segunda dirección | **restricción de la base**: la tabla de claves la escribe la migración desde el catálogo, y toda asignación apunta a ella por FK |
| lo que las dos versiones no vendibles otorgan, las dos claves del piso, la capacidad de activación y la herencia de VIP (`V/02` §2.1) | `G-R3`, sus cuatro mitades | **validación de *«publicar una versión de plan»***, con el mismo nombre y cada mitad con su mensaje (`V/20` §2) |
| dos versiones vendibles y vigentes con el mismo `rank` en una vertical | restricción de la base (`V/10` §2) | **la misma restricción**, y el panel la chequea antes para dar el mensaje |
| un plan sin exactamente una versión vigente | regla escrita (`V/10` §2) | **restricción de la base** (a lo sumo una) y **validación del panel** (al menos una) |
| los días de prueba de una vertical que pasan de cero a más o al revés | regla escrita (`V/11` §8) | **validación de *«publicar una versión de plan»*** |
| una gracia que no es menor que el ciclo más corto que ofrece la versión | ninguno | **validación de *«publicar una versión de plan»* y de *«fijar el precio de un ciclo»*** |
| un plazo que contradice a otro | `G-R5-B` | **validación de *«cambiar un plazo»*** (§1.5) |

**Las mismas validaciones corren en el paso 3a del corte sobre la base de producción**, después de
la migración única del catálogo, y si no dan, el corte no sigue (`16-fase-7…` §4.2). **Qué pasa con
los datos de planes que usan desarrollo y las pruebas no está decidido**
(`30-revision-del-owner/14-` §5).

### 1.5 Los plazos que deciden cuándo pasa algo · revisión del owner, C9 y C11

(Revisión del owner, 2026-09-28, C9, C11, `L2-g` y `L2-h`.) **Todo plazo en días o meses que decide
cuándo pasa algo lo configura el `SUPER_ADMIN` desde el panel**, con la acción *«cambiar un plazo»*
(`NUCLEO/08` §3, la vigesimosegunda). **Los números del diseño pasan a ser valores iniciales**:
donde un capítulo dice 90 o 180 días, 60 días de aviso o los días de una campaña de correos, se lee
*«el plazo, con ese valor al inicio»*.

**La lista, cerrada.** Cada mitad es dueña de sus claves, como del resto de su catálogo.

| # | plazo | mitad | valor inicial | qué decide | qué reloj guarda la versión |
|---|---|---|---|---|---|
| 1 | archivado por inactividad | verticales | 90 días | `PB4` (`V/03` §9) | la ficha (`V/02` §2.5) |
| 2 | borrado por inactividad | verticales | 180 días | `PB9` | la ficha |
| 3 | archivado de un borrador, el `N` de `PB5` | verticales | sin valor escrito | `PB5` | la ficha |
| 4 | los dos avisos previos de retención | verticales | sin valor escrito | cuántos días antes del archivado y del borrado sale cada uno (`NUCLEO/07` §6) | la ficha |
| 5 | la campaña previa al vencimiento de la prueba | verticales | 10, 5, 2 y 0 días antes | `NUCLEO/07` §6 | la fila de `trial`, al arrancar (`T1`) |
| 6 | la campaña de recuperación | verticales | +1, +5, +15, +30 y +60 días | `NUCLEO/07` §6 | la fila de `trial`, al vencer (`T3`) |
| 7 | el techo de días de prueba acumulados, por vertical | verticales | sin valor escrito | hasta dónde se extiende una prueba (`V/11` §3) | la fila de `trial`, al arrancar |
| 8 | la postulación de Partner atrasada | verticales | sin valor escrito | cuándo se marca en el panel (`V/18` §2.3) | la postulación |
| 9 | la espera entre un rechazo y una postulación nueva de Partner | verticales | sin valor escrito | `V/18` §2.2 | el rechazo |
| 10 | la ventana de autorización de un alta o una sucesión | billing | 72 h con tarjeta, 7 días con pago manual | cuándo vence (`B/03` §3.4, `DEC-SUB-016`) | la suscripción, al abrir la ventana |
| 11 | el aviso previo de un aumento de precio, con sus dos contactos | billing | 60 días, a 30 y a 7 días | `DEC-MP-002`, `NUCLEO/07` §6 | el aumento anunciado |
| 12 | el aviso previo de una migración de un plan retirado, con sus dos contactos | billing | 60 días, ~~a 30 y a 7 días~~ y los contactos 30 y 7 días antes de la renovación de cada cliente (revisión del owner, casos vecinos, 2026-09-29, caso 21) | `B/10` §3.7 | la migración anunciada |
| 13 | la renovación por venir | billing | 5 y 1 días antes | `NUCLEO/07` §6 | la suscripción, en cada ciclo |
| 14 | el aviso de que una promo termina | billing | 7 días antes | `NUCLEO/07` §6 | el canje |
| 15 | lo mínimo que tiene que quedar del ciclo para ofrecer un cambio de plan | billing | 24 h | `B/12` §5.4 | la suscripción, en cada ciclo |

**Lo que no está en la lista, y por qué.** **(a) Los plazos que son del catálogo**: los días de
prueba, la gracia y los topes de pausa de un plan cuelgan de su versión y cambian publicando una
versión nueva (§1.4), no por esta acción. **(b) Ningún plazo técnico** (`L2-g`): los 15 minutos del
caché, las 26 horas del vigía del proceso diario, los 3 días de reintento de una mutación, las
esperas del corte y los 7 días de `S37` antes de la renovación; cada uno protege un invariante, y
cambiarlo sin saber cuál es la optimización peligrosa. **(c) Los que fija Mercado Pago o la ley**:
la ventana de reintentos del proveedor, los 10 días corridos del arrepentimiento y las 24 horas de
la Resolución 424/2020 (`B/22`).

**Cómo cambia uno sin adelantar una fecha ya anunciada** (`L2-h`). *«Cambiar un plazo»* publica
**una versión nueva de los plazos de su mitad**, inmutable, con quién, cuándo, el valor anterior y
el nuevo: **ese registro es el de cada cambio**, además de la auditoría de la acción. **Cada reloj
guarda la versión de plazos con la que arrancó** (la última columna de la tabla) y cuenta con esa,
así que un cambio vale para los relojes que arrancan después y **nunca adelanta una fecha ya
anunciada**. Un reloj que se reinicia arranca otra vez, y guarda la versión vigente en ese momento.

**Lo que el panel rechaza**, porque se contradice:

1. **archivar antes que borrar**: el plazo 1 menor que el 2;
2. **el `N` de `PB5`, en su peor caso en días (meses de 31), menor que el plazo 2**: es lo que era
   `G-R5-B` (`V/20` §2), con la cota atada al plazo de borrado y no a 6 meses literales;
3. **cada aviso antes del hecho que anuncia**: los avisos previos del 4 menores que el 1 y que la
   distancia entre el 1 y el 2; los contactos del 11 y del 12 menores que su aviso;
4. **el aviso de una migración o de un aumento nunca menor que el mínimo de `DEC-MP-002`**;
5. **la gracia menor que el ciclo más corto**, que es del catálogo y rechaza *«publicar una versión
   de plan»* (§1.4).

**Y el espacio entre el archivado y el borrado queda garantizado** (el ítem que estaba declarado
abierto en `V/03` §9, ⚠️ punto 7): el archivado escribe la fecha de borrado que anuncia, y `PB9` no
borra antes de esa fecha (`V/02` §2.5, `V/03` §9).

**Quién lo construye**: la tabla de plazos de cada mitad y la operación de cambiarlos, `V9` en
verticales y `B2` en billing; cada reloj guarda su versión en la unidad que lo construye; la
pantalla, `V8` y `B13` (`V/descomposicion.md` §2.11, `B/descomposicion.md` §2).

---

### 2.6 Registro

| entidad | qué guarda | restricciones |
|---|---|---|
| **`domain_event`** | qué pasó, sobre qué entidad, quién lo causó, cuándo, **qué campos cambiaron** — no una copia del contenido; **de los campos de contenido de una ficha, sólo el nombre** (cap. 08 §1.2; owner 2026-09-25, FASE 9 completa, decisión 8e) | append-only |
| **`outbox`** | destinatario, plantilla, estado (`pending`, `processing`, `sent`, `failed`, `retry`), id del proveedor, intentos (§44) | |

**`domain_event` guarda referencias y deltas, no copias del contenido**, y ésa es una decisión de
modelo con consecuencia directa en la retención — se explica en ~~§4~~ **`V/02` §4**, la retención
(este capítulo no tiene §4; FASE 9 completa, `C-10`).

---

## Lo que esta mitad NO cierra

- **Los tipos, los índices y el plan de migración** son de FASE 4 y FASE 7.

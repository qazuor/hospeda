---
title: "Corte del MVP · aplicación, dependencias ocultas y lo que vuelve al owner"
linear: HOS-1352
statusSource: linear
created: 2026-10-01
updated: 2026-10-01
status: CURRENT
fase: 10
---

# Corte del MVP · aplicación

Registro de la aplicación de los lotes Y a AE y AF a AO (`10-decisiones-del-owner.md`), previa a la
spec consolidada. Abreviaturas: `D` = `.specs/HOS-1352-billing-verticals-redesign/docs`,
`V` = `.specs/HOS-1353-verticales-capacidades-y-autorizacion`,
`B` = `.specs/HOS-1354-billing-cobro-y-proveedor`.

## 1. Qué se aplicó

- **AF a AO**, asentadas en `10-decisiones-del-owner.md`.
- **Y y AF**: los dos 📌 (sobre `DEC-ARCH-007` y sobre el momento 2 de `DEC-ARCH-016`) y las dos
  decisiones nuevas, `DEC-ARCH-017` (el MVP) y `DEC-METH-019` (la consolidación), en
  `01-decision-log.md`, con el resumen recontado por script: 146 decisiones, 127 funcionales y 19
  de metodología, 74 precisadas. La matriz no se tocó.
- **Z, AA, AB, AC, AD, AE**: la partición en `V/descomposicion.md` (§2, §2.10, §2.14, §3, §4, §5),
  `B/descomposicion.md` (§2, §2.6, §2.12, §3, §4, §5) y `D/16-fase-7-del-paraguas.md` (§4.6, con la
  lista de las 30 piezas, y §4.7, con el momento 2 contado sobre las piezas del corte y las fases
  posteriores). Las filas de las unidades partidas quedan como origen, con la marca, y las mitades
  van en filas propias.
- **`contar.py` y `aristas.py`** leen por encabezado, no por número de línea, y cuentan piezas. La
  lista de piezas es una sola: la tabla `| pieza | unidad | cuándo | fuente |` de `D/16` §4.6.

## 2. La pasada de dependencias ocultas (Z)

Pregunta, por cada mitad *a*: ¿depende de algo que quedó en una mitad *b* o en *«después»*? Se
recorrió la fila del §2 y el criterio del §4 de la unidad partida, y las filas de transiciones que
nombra. Se extendió a las piezas enteras del corte que tocan lo mismo, porque el defecto es el
mismo. **Verificado** = leído en la fuente citada; **inferido** = lo derivo y lo marco.

### 2.1 Sin dependencia oculta

- **`V8a`**: ninguna cláusula de la fila de `V8` ni de su criterio lee Partner fuera de la fila 22
  y el panel, que son `V8b` (verificado). Lo que lee de billing (`puedeCobrarle`, la acción 24) es la
  flecha inversa que `B/descomposicion.md` §2.6 declara *«no es una dependencia de construcción»*.
- **`V9a`**: el registro de los actos del dueño no lee nada de `V9b`; `V9b` lo lee a él
  (verificado contra la fila de `V9`). Hereda la flecha de `U2` sin encolar nada (inferido; lo dejé
  por regla y lo marqué en `V` §3).
- **`B9a`**: el piso del grant lee `políticaDePlan(v).vigente` (`V2`, fila 12) y el aviso de
  cobertura es de `B4`; la herramienta del 3b lee el catálogo que carga el 3a. Nada de `B9b`
  (verificado), salvo lo del §2.2, puntos 4 y 5.
- **`B13a`**: el criterio de `B13` no nombra addons (verificado). Depende además de `B6` —la parte
  de producción del checklist pide *«un checkout real, su devolución»*, `D/16` §4.7— y del espejo
  de `V8a` (el botón de suscribirse, `V/19` §4 fila 23). Las dos son del corte: no violan nada y no
  están dibujadas en el grafo (inferido).
- **`retenciónDetenida`** (de `B4`, sobre pausas que no existen hasta `B8b`): el caso que la de
  arranque no pasa se ejerce con una fila `PAUSED · CUSTOMER_REQUEST` sembrada en el juego de la
  real. Hay precedente en el mismo criterio de `B4`, que sembraba `vertical_discontinuation`
  porque la escribía una unidad posterior (`B` §4, fila `B4`). No pide decisión (inferido; cierra el
  punto 6 de *«lo que la propuesta no pudo verificar»*).

### 2.2 Con dependencia oculta (vuelven al owner)

1. **`B8a` y las bajas desde `GRACE_PERIOD` y `SUSPENDED`**. La propuesta fija `B8a` en `S11` y
   `S12`. Pero `S24` (baja desde `GRACE_PERIOD`, `DEC-SUB-014`) y `S23` (baja desde `SUSPENDED`)
   salen de estados que existen desde el corte, porque `B7` los produce (`S4`, `S6`), y hoy son de
   `B8b` (verificado, `B/docs/03-maquinas-de-estado.md`, filas `S23` y `S24`). → **AR**.
2. **El esquema que AD pone al corte no tiene pieza**: la migración estructural de `V7` (AB), el
   resto del esquema de `V7` (postulación, rol de socio, moderación de la presencia), la cola de
   cambios programados y las columnas de la sucesión (`B8b`; las leen `G-R1-A`, `G-R1-B` y
   `G-R1-D` desde el corte, `00-propuesta.md` §4.1 punto 5), las tablas de promos y cortesías
   (`B9b`) y las dos de `B12`. **Y el paso 3a carga los precios, los complementos y los códigos
   promocionales dentro de la migración del paso 3** (`D/16` §4.2, fila 3a), así que las tablas de
   promos tienen que existir ese día (verificado). → **AP**.
3. **El modelo de addons en `B4` llega tarde para `B5`**: `payment` apunta a *«suscripción o
   instancia de addon»* (`B/docs/02-modelo-de-datos.md`, fila `payment`), y `B5` va antes que `B4`
   (`B5 → B4`, `F-8V1C1-005`). La tabla de instancias tiene que existir antes de la migración de
   `B5`, o `B4` le agrega la columna después (verificado el FK; la salida es una elección). → **AP**,
   en el mismo mapa.
4. **Ramas de piezas del corte que invocan lo que sólo existe después** (verificado en cada fila):
   `B5` (`S36` corre la orfandad de los complementos, `R1-b`, el `RF1` que crea `S21`); `B7` (`S6` y
   `S7` sobre complementos, `R18-b`, `S32`); `B8a` (`S11` cancela en el mismo acto los complementos,
   `R1-a`, y el fin de servicio de una sucesora a crédito, `R17`); `B9a` (otorgar un *Free Forever*
   con `includesAddons` corre `S20`, de `B10`, y cierra el saldo de una cortesía diferida,
   `DEC-GRANT-013`, de `B9b`); `B6` y `B11` (las órdenes de un addon `UNA_VEZ` y el motivo 23); `B4`
   (`puedeCobrarle` cuenta suscripciones de complemento). Con las tablas vacías ninguna rama se
   ejerce en producción, pero si al corte no están, la fase posterior reescribe transiciones del
   corte, contra el 📌 de Y. → **AS**.
5. **La fuente `CORTESÍA` real**: la propuesta dice *«`B9a` (o `B4`)»* (`00-propuesta.md` §4.2), y
   `G13` exige que alguna la conteste de verdad al corte. → **AQ**.
6. **El mensaje del cambio de plan**: la elección de Z le promete a Juan que *«la pantalla le dice
   que todavía no se puede cambiar de plan»* (`00-propuesta.md` §6, Z). Ninguna fila lo construye, y
   cuando llegue `B8b` alguien lo tiene que sacar. → **AU**.
7. **El *«propio gate»* de una fase posterior** (📌 de Y): AE fija la rama y los gates por unidad,
   pero no qué condición tiene el PR de la fase a `staging`. → **AT**.

## 3. Lo que vuelve al owner (AP a AU)

> **Respondidas el 2026-10-01: las seis, la opción 1, la recomendada** (`10-decisiones-del-owner.md`,
> lote AP a AU). El análisis de abajo queda como estaba; su aplicación está en el §5.

En todas, **Juan** es un anfitrión con una cabaña en Colón que se suscribe al plan Básico de
Alojamiento la semana siguiente al corte.

### AP · Qué pieza del corte crea el esquema de lo que va después

AD pone todo el esquema al corte y AA pone el de addons en `B4`; el resto no tiene pieza (§2.2,
puntos 2 y 3).

1. **Cada tabla la crea la pieza del corte dueña de la tabla de la que cuelga**: el esquema de `V7`
   y su migración estructural, con los lectores de `tier` retirados, en `V6` (que ya hace la
   migración del paso 3 y retira lectores en el mismo cambio que borra columnas); la cola de
   cambios, las columnas de la sucesión y las dos tablas de `B12`, en `B3` (dueña de
   `subscription`); promos y cortesías, en `B9a`; addons en `B4` (AA), que le agrega a `payment` la
   columna de la instancia. **Recomendada.**
   - Costo: cinco piezas del corte crecen con tablas que no usan.
   - Riesgo: un mapa por tabla que se puede equivocar; se acota con el drift guard sobre la rama de
     cada fase, que falla si una fase trae una migración estructural.
2. **Una pieza nueva del paraguas, `U4`, que crea al corte todo el esquema de lo posterior** (y la
   migración de `V7`).
   - Costo: 31 piezas, 23 al corte.
   - Riesgo: es cortar por capa, lo que `V/descomposicion.md` §1 descarta: el primer error de
     modelado aparece cuando ya hay lógica encima.
3. **Partir también `V7`, `B10` y `B12`, con el esquema en su mitad *a***.
   - Costo: 33 piezas, 25 al corte; tres mitades *a* sin lógica.
   - Riesgo: bajo técnico; el árbol de Linear crece sin trabajo nuevo.

*Juan* no lo ve. Lo ve quien, en el mes cuatro, construye el retiro de planes: con cualquiera de
las tres no toca la base.

### AQ · Quién contesta la fuente `CORTESÍA` real al corte

1. **`B9a`, junto con la fuente `GRANT`**: las dos concesiones en una pieza. **Recomendada.**
   - Costo: `B9a` lee una tabla que no escribe hasta `B9b`.
   - Riesgo: bajo; es la forma de AA con la fuente `ADDON`.
2. **`B4`, junto con `SUSCRIPCIÓN` y `ADDON`**: todas las fuentes vacías en la pieza del contrato.
   - Costo: `B4` lee el modelo de cortesías, que es de concesiones.
   - Riesgo: bajo; parte la lógica de concesiones entre dos piezas.

*Juan* no lo nota: nadie tiene cortesía hasta `B9b`.

### AR · Las bajas desde `GRACE_PERIOD` y `SUSPENDED` en `B8a`

1. **`B8a` es `S11`, `S12`, `S23` y `S24`**: las cuatro bajas cuyo estado de origen existe al
   corte; `S22` (desde una pausa) sigue en `B8b`. **Recomendada.**
   - Costo: dos transiciones más en el corte.
   - Riesgo: bajo; ya están escritas en `B/03`.
2. **`B8a` es `S11` y `S12`, como dice la propuesta.**
   - Costo: ninguno ahora.
   - Riesgo: alto: quien está en grace o suspendido no se puede dar de baja hasta `B8b`, y el
     criterio de `B13a` (*«cancelar cuesta los mismos pasos o menos que suscribirse»*) no se cumple
     para él.

*Juan*: si su tarjeta rebota en el mes dos y decide irse, con la 1 se da de baja y el servicio
corta en el acto (`DEC-SUB-014`); con la 2 no puede, y su suscripción sigue hasta suspenderse sola.

### AS · Las ramas del corte que tocan lo que sólo existe después

§2.2, punto 4: `S36`, `S6`, `S7`, `S11`, el otorgamiento de un grant, las órdenes `UNA_VEZ` y
`puedeCobrarle` tienen ramas sobre complementos, cortesías diferidas o sucesiones.

1. **Al corte cada rama se implementa entera sobre el esquema vacío**, con las transiciones de
   `B10` que esas ramas llaman (`S20`, `S21`, `S32`, `S33`) en la pieza del corte que las llama, y
   probadas con filas sembradas; la fase posterior sólo agrega lo que crea filas (la venta, la
   cortesía, la sucesión). **Recomendada.**
   - Costo: el corte crece; parte de `B10` se adelanta, como ya pasó con su modelo (AA).
   - Riesgo: código sin uso real en producción hasta la fase, probado sólo con datos sembrados.
2. **Al corte las ramas no existen, y cada fase las agrega** en `S11`, `S6`, `S7`, `S36`… como
   excepción declarada al 📌 de Y.
   - Costo: corte más chico.
   - Riesgo: alto: la fase reescribe transiciones de dinero que ya están en producción, que es lo
     que Y prohibió.
3. **Las piezas del corte emiten un hecho y la fase lo consume al llegar.**
   - Costo: un mecanismo que el diseño no tiene.
   - Riesgo: alto: el diseño exige *«en el mismo acto»* (`R1-a`, `S21`), y un consumidor posterior
     lo rompe.

*Juan* no tiene destaque al corte. Con la 1, cuando `B10` llega, compra el destaque y después se
da de baja, `S11` cancela los dos cobros en el mismo acto con código que corre desde el corte; con
la 2, ese día `S11` cambia.

### AT · El gate propio de una fase posterior

1. **El momento 2 aplicado a la rama de la fase** (sus piezas en `Done`, `staging` mergeado y
   verde, `e2e-pr`, `codeql`, `lighthouse` y `a11y-sweep` en `success`, el merge lo decide el owner)
   **más el checklist de smoke del sistema nuevo extendido con lo de la fase**: la parte de
   `staging` antes del merge y la de producción como un 5c propio. **Recomendada.**
   - Costo: un smoke de producción por fase, con la tarjeta del owner.
   - Riesgo: bajo; es el mecanismo del corte, sin ensayo.
2. **Sólo el momento 2 aplicado a la rama de la fase.**
   - Costo: menor.
   - Riesgo: lo que el diseño declara que no se puede simular (el checkout real, los correos del
     proveedor) entra a producción sin observarse.

*Juan*: con la 1, el cambio de plan le llega probado en `staging` contra el sandbox y una vez en
producción con la tarjeta del owner.

### AU · Cómo se dice que todavía no se puede cambiar de plan

1. **`B13a` lo dice en Mi Suscripción** (*«todavía no se puede cambiar de plan: date de baja al fin
   del período y volvé a suscribirte»*) **y `B8b` lo saca en su rama**, como excepción declarada y
   acotada a ese texto. **Recomendada.**
   - Costo: una línea de i18n que vive una fase.
   - Riesgo: bajo.
2. **No hay mensaje: la opción no aparece hasta `B8b`.**
   - Costo: ninguno.
   - Riesgo: Juan no sabe por qué no puede, y escribe a soporte; contradice lo que Z le prometió.
3. **`B13a` lo muestra según exista o no la capacidad.**
   - Costo: un interruptor.
   - Riesgo: no viable: la rama no tiene interruptores (`D/16` §4.4).

*Juan*: con la 1, en el mes dos ve por qué no puede pasar a Premium y qué hacer; con la 2 no ve la
opción y no sabe si existe.

## 4. Lo que no se hizo

- El inventario y la redacción de la spec consolidada (es el paso siguiente).
- Linear: las diez mitades no tienen issue todavía (`DEC-ARCH-017`, implicación 3).
- Siguen abiertos los puntos 1, 2, 4 y 5 de *«lo que la propuesta no pudo verificar»*
  (`10-decisiones-del-owner.md`); el 3 lo cubre §2 de este archivo, y el 6, el §2.1.

## 5. La aplicación de AP a AU

(Owner, 2026-10-01: las seis, la 1.) Dónde quedó cada una:

- **AP**: `V6` lleva el esquema de `V7` y su migración estructural, con los lectores de `tier`
  retirados; `B3`, la cola de cambios, las columnas de la sucesión y las dos tablas de `B12`;
  `B9a`, promos y cortesías; `B4`, el modelo de addons y la columna de la instancia en `payment`.
  La lista, tabla por tabla, es la de `D/16` §4.6 (*«esquema del corte»*), y la mitigación —el
  drift guard sobre la rama de cada fase— está ahí y en el gate de AT.
- **AQ**: `B9a` contesta la fuente `CORTESÍA` real con la de `GRANT` (`B` §2, fila `B9a`, y §4).
- **AR**: `B8a` es `S11`, `S12`, `S23` y `S24`; `S22`, en `B8b` (`B` §2, §2.12 y §4).
- **AS**: las ramas se implementan enteras al corte y se prueban con filas sembradas (`B` §2.12);
  `S20` pasa a `B9a`. **`S21`, `S32` y `S33` no se pudieron ubicar**: ver AV.
- **AT**: el gate de cada fase posterior, en `D/16` §4.7 (*«Las fases posteriores»*).
- **AU**: el aviso en `B13a` y su retiro en `B8b` (`B` §2 y §4), declarado en `D/16` §4.7 como la
  única excepción a *«aditiva»*.
- **El log**: un 📌 sobre `DEC-ARCH-017` con AP a AU; las precisadas pasan de 74 a 75, recontado
  con script.
- **Los scripts**: `contar.py` verifica además la tabla de transiciones de `B` §2.12 contra las
  filas vivas de `B/docs/03` §3.2 y la tabla del esquema de `D/16` §4.6.

### AV · Dónde viven al corte `S21`, `S32`, `S33` y la orfandad que dispara a `S21`

> **Respondida el 2026-10-01: la 1, la recomendada** (`10-decisiones-del-owner.md`, lote AV). El
> análisis de abajo queda como estaba; su aplicación está en el §6.

AS manda cada transición a la pieza del corte que la llama. Las que llaman son: `S36`, de `B5`
(revocar corre la orfandad, `A5`, y su instancia en `CANCELLED` corre `S21`, `R1-b`); `S6` y `S7`,
de `B7` (`S32` y `S33` sobre la suspensión, `G2-2`, y `R18-b`); `S11`, de `B8a` (`R1-a`); y las
órdenes `UNA_VEZ` de `B6` y `B11`. **Todas leen la instancia de addon, y AP puso el modelo en `B4`,
que llega después de `B5` (`B5 → B4`, `F-8V1C1-005`) y no es dependencia de `B6`, `B7` ni `B11`.**
Además, `S21` sólo corre si su instancia llega a `CANCELLED`, y la orfandad que la lleva ahí
(`A5`, `B/16` §4.2 y §4.3) es de `B10`: AS no la nombra, pero sin ella `S21` no corre nunca
(verificado en las filas `S21`, `S32` y `S33` de `B/docs/03` §3.2 y en la fila `payment` de
`B/docs/02`).

1. **Las tablas del modelo de addons pasan de `B4` a `B3`**, que va antes de `B5`, y `payment` nace
   en `B5` con su columna de la instancia; la fuente `ADDON` y `G-R2-C` siguen en `B4`. `S21` y la
   orfandad (`A5`) van a `B5`, su primer llamador; `S32` y `S33`, a `B7`. Sin flechas nuevas.
   **Recomendada.**
   - Costo: `B3` crece; cambia un renglón de AP (addons, de `B4` a `B3`), y la columna de
     `payment` deja de ser un agregado posterior.
   - Riesgo: bajo; el grafo no cambia y nadie modifica una transición ajena.
2. **El modelo sigue en `B4`, y `B4` escribe `S21`, `S32`, `S33` y la orfandad**, enchufándolas en
   `S36`, que `B5` ya mergeó; flechas nuevas `B4 → B6`, `B4 → B7` y `B4 → B11` (`B8a` hereda por
   `B7`).
   - Costo: `B7` pasa a esperar a `B4`, que espera a `V4` y a `U2`: el camino crítico del corte se
     alarga.
   - Riesgo: medio; una pieza modifica una transición de otra ya mergeada.
3. **`B5` espera a `B4`.**
   - No viable: `B4` lee `cobrada` sobre los pagos de `B5`, y sería un ciclo.

*Juan* no lo ve: nadie tiene un addon al corte. Lo ve quien construye `B5`: con la 1 encuentra las
tablas y escribe la rama de `S36` entera; con la 2, `B5` sale sin esa rama y `B4` se la agrega
después.

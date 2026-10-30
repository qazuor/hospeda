# Abiertos de g1-decisiones (`01-decisiones-vigentes.md`)

Huecos que las fuentes congeladas en `f80c0f2715` no deciden y que el redactor no resolvió por su
cuenta. Sin letra: la asigna el orquestador.

## 1. Las cuatro decisiones `SUPERSEDED EN PARTE` no tienen adjudicación de su parte muerta

- **Qué falta**: qué frases de su texto se omiten. `adjudicacion.json` no tiene veredicto para
  `DEC-MIG-001`, `DEC-MIG-002`, `DEC-DATA-002` ni `DEC-MP-003` (el inventario las marca
  `SUPERSEDED_PARCIAL` y trazar las trata como vivas), así que su texto va entero, con la
  declaración de su propio campo *Estado* como única guía.
- **Afecta**: [DEC-MIG-001](../../01-decisiones-vigentes.md#dec-mig-001),
  [DEC-MIG-002](../../01-decisiones-vigentes.md#dec-mig-002),
  [DEC-DATA-002](../../01-decisiones-vigentes.md#dec-data-002),
  [DEC-MP-003](../../01-decisiones-vigentes.md#dec-mp-003), y las piezas dueñas de su AC (`CORTE`,
  `V6`, `B7`).
- **Por qué las fuentes no lo deciden**: el log dice qué cae en prosa, sin tachar
  (`01-decision-log.md:399`: *«Lo que se cae es el destino»*; `:2655`: se cae *«se transcriben a mano
  cuando el rediseño esté listo»*; `:3694`: *«se cae que el reloj corre durante la pausa y la
  desigualdad que la protegía»*; `:4676`: *«se cae el motivo `PROVIDER_DUNNING`»*), y
  `DEC-METH-019` punto 7 manda adjudicar sólo «las filas `MIXTO` y los 📌 que caen en prosa».
- **Pregunta propuesta**: ¿cómo se presenta lo que cayó de una decisión `SUPERSEDED EN PARTE`?
  1. **Adjudicarla como los 📌 `PARCIAL`** (un agente marca la parte muerta con cita y hash, y la
     consolidada la omite con «[…]» y una nota). Costo: cuatro veredictos más y una pasada de
     `trazar.py`. Riesgo: bajo; la parte que cae ya está escrita en cada *Estado*. **Recomendada.**
  2. Dejar el texto entero con la declaración del *Estado* arriba, como está hoy. Costo: cero.
     Riesgo: un agente que implementa lee *«se transcriben a mano»* o *«`PROVIDER_DUNNING`»* sin
     ver la línea del *Estado* y construye lo que ya no va.
  3. Mover cada una entera a `90-retirados.md` y dejar en la vigente sólo lo que sobrevive como
     texto nuevo. Costo: reescribir. Riesgo: es redactar diseño, que `DEC-METH-019` punto 8 prohíbe.
  - *Ejemplo*: Juan, anfitrión de una cabaña en Colón, se suscribe al Básico la semana siguiente al
    corte y pausa dos meses. Con la 2, quien implementa `V6` lee en `DEC-DATA-002` que el reloj de
    retención corre durante la pausa y archiva la ficha de Juan al día 90; con la 1, esa frase no
    está y manda `DEC-DATA-006` (la pausa detiene el reloj).

## 2. `DEC-ARCH-017#📌1` sigue diciendo que promos y cortesías las crea `B9a`

- **Qué falta**: un veredicto `PARCIAL` sobre el renglón *«promos y cortesías, `B9a`»* de AP.
- **Afecta**: [DEC-ARCH-017#📌1](../../01-decisiones-vigentes.md#dec-arch-017-p1) (dueña `B3`) y
  `B9a`.
- **Por qué las fuentes no lo deciden**: `adjudicacion.json` marca muerto sólo el renglón de addons
  de AP (por AV), pero el cuarto 📌 de la misma decisión dice que **BG** *«el esquema de promos y
  cortesías pasa de `B9a` a `B3` […] Precisa AP»* (`01-decision-log.md`, 📌 BC-BH de
  `DEC-ARCH-017`). El texto vigente del primer 📌 queda contradicho por el cuarto y no tiene marca.
- **Pregunta propuesta**: ¿se agrega ese renglón a la adjudicación del primer 📌?
  1. **Sí, como `PARCIAL`**: se omite *«promos y cortesías, `B9a`»* con nota que apunta al 📌 de BG.
     Costo: un veredicto. Riesgo: ninguno; BG lo dice a la letra. **Recomendada.**
  2. No: se deja y el lector cruza los dos 📌. Riesgo: quien implementa `B9a` crea tablas que ya
     creó `B3` y el drift guard rompe la rama.
  - *Ejemplo*: Juan canjea un código promocional en su alta; la redención cuelga de `subscription`,
    que crea `B3` al corte. Con la 2, `B9a` también intenta crear la tabla de redenciones.

## 3. Las decisiones «precisadas por otra decisión» no tienen su parte superada marcada

- **Qué falta**: qué parte de su texto dejó de valer. El resumen del log lista, como precisadas
  *«por otra decisión»* y sin `SUPERSEDED`: `DEC-SUB-019` por `DEC-MP-008`, `DEC-METH-006` por
  `DEC-METH-008` y `DEC-METH-013`, `DEC-MP-008` por `DEC-SUB-022`, `DEC-RF-007` por `DEC-RF-008`, y
  `DEC-ADDON-003` y `DEC-ADDON-004` por `DEC-ADDON-007` (`01-decision-log.md`, fila «Precisadas sin
  `SUPERSEDED`» del *Resumen*). Son `ACCEPTED` sin adjudicación, y van con su texto entero.
- **Afecta**: esas siete entradas de `01-decisiones-vigentes.md` y sus dueñas (`B7`, `B5`, `B9a`,
  entre otras; ver cada entrada).
- **Por qué las fuentes no lo deciden**: el *Estado* de cada una apunta a la otra, pero la
  adjudicación (`DEC-METH-019` punto 7) cubrió filas `MIXTO` y 📌, no decisiones.
- **Pregunta propuesta**: ¿se adjudican también estas siete?
  1. **Sí, con el mismo criterio que los 📌** (`VIVO` o `PARCIAL` con cita de la decisión que
     precisa). Costo: siete veredictos. Riesgo: bajo. **Recomendada.**
  2. No: el lector sigue el puntero del *Estado*. Riesgo: `DEC-SUB-019` sigue nombrando el motivo
     `PROVIDER_DUNNING` que `DEC-MP-008` sacó.
  - *Ejemplo*: el primer cobro mensual de Juan rebota y Mercado Pago pausa su preapproval por mora;
    con la 2, quien implementa `B7` puede leer en `DEC-SUB-019` un motivo de pausa que ya no existe.

# Abiertos del grupo g5 (U1, U2, U3, V1, V2, V3, V4)

Huecos que un agente necesita para implementar y que las fuentes congeladas en `f80c0f2715` no
deciden. Sin letra: la asigna el orquestador. Cada entrada dice qué falta, a qué afecta, por qué las
fuentes no lo deciden y una pregunta para el owner con opciones (la recomendada, marcada).

---

## 1. Las etiquetas `kind-*`/`area-*` de las piezas en Linear

- **Qué falta**: qué etiquetas llevan los issues de cada pieza. La plantilla AO pide la sección
  *«Labels de Linear»*.
- **Afecta**: las siete piezas del grupo (y, por extensión, las 30).
- **Por qué no lo deciden**: las fuentes fijan sólo la regla de smoke —*«Las etiquetas
  `status-needs-smoke-*` van sólo en `HOS-1352`, nunca en las unidades»* (`16-fase-7-del-paraguas.md`
  §4.7, momento 1)— y dónde vive cada issue (§4.6, *«Dónde vive»*; `V/descomposicion.md` §5). Ninguna
  dice `kind-*` ni `area-*`.
- **Pregunta**: ¿qué etiquetas llevan los issues de las piezas?
  1. **(recomendada)** `kind-spec` más las `area-*` que la fila de cada pieza toca (p. ej. `U1`:
     `area-billing`, `area-db`, `area-devops`), fijadas en la consolidada pieza por pieza. Costo: una
     pasada más sobre las 30. Riesgo: bajo.
  2. Sólo `kind-spec`, sin `area-*`. Costo: nulo. Riesgo: el tablero no filtra por área.
  3. Dejarlo a quien crea el árbol de Linear. Costo: nulo ahora. Riesgo: criterios distintos por
     persona.
- **Ejemplo**: Juan no ve las etiquetas; las ve quien filtra el tablero para saber qué pieza toca la
  base antes del corte.

## 2. El nombre de la tabla del outbox y el nombre neutro de la bitácora

- **Qué falta**: los dos nombres de tabla.
- **Afecta**: `U1` (renombra `billing_notification_log`) y `U2` (construye la cola y absorbe la
  bitácora).
- **Por qué no lo deciden**: `U1` *«renombra `billing_notification_log` a un nombre neutro»*
  (`16-fase-7-del-paraguas.md` §4.6, punto 4; `NUCLEO/07` §1.4, punto 2), sin decir cuál; el outbox
  *«se construye sobre el precedente del newsletter»* (`NUCLEO/07` §1.4), sin decir si reusa su tabla.
- **Pregunta**: ¿qué nombres?
  1. **(recomendada)** Los fija la FASE de implementación de `U1`/`U2` siguiendo la convención de
     nombres del repo, y se escriben en la consolidada al mergear `U1`. Costo: nulo. Riesgo: bajo, es
     un nombre.
  2. Fijarlos ahora el owner. Costo: una pregunta. Riesgo: ninguno.
- **Ejemplo**: el aviso de *«faltan 2 días»* del trial de Juan queda en la cola de `U2` y su intento en
  la bitácora renombrada; el nombre no cambia el comportamiento.

## 3. El plazo de vencimiento de `processing` y la frecuencia del envío

- **Qué falta**: cuánto dura un `processing` antes de volver a `pending`, y cada cuánto corre el
  proceso de envío.
- **Afecta**: `U2` (AC:U2:3).
- **Por qué no lo deciden**: `NUCLEO/07` §1.2 dice *«lleva quién la tomó y hasta cuándo; vencido ese
  plazo, vuelve a `pending`»*, sin el número; nada fija la frecuencia.
- **Pregunta**: ¿qué valores?
  1. **(recomendada)** Los fija la implementación de `U2` y se declaran en la consolidada; no son
     plazos de negocio de `NUCLEO/02` §1.5. Costo: nulo. Riesgo: bajo.
  2. Volverlos plazos configurables de la base. Costo: una fila y una validación. Riesgo: más
     superficie sin necesidad.
- **Ejemplo**: si el proceso que tomó el correo de bienvenida de Juan muere, el correo vuelve a la
  cola al vencer ese plazo.

## 4. A dónde se mueven las filas vivas del rol de dueño de comercio, sus permisos y la tabla de contactos

- **Qué falta**: el destino de las *«filas vivas»* que la limpieza mueve.
- **Afecta**: `U1` (AC:U1:3, la migración de datos).
- **Por qué no lo deciden**: el criterio dice *«el rol, los permisos y la tabla ya no existen y sus
  filas vivas se movieron»* (`V/descomposicion.md` §2.11, fila de la limpieza), sin decir a qué rol,
  permisos o tabla.
- **Pregunta**: ¿a dónde van?
  1. **(recomendada)** Las asignaciones del rol pasan al rol de anfitrión que ya existe (o se borran si
     la cuenta ya lo tiene) y las filas de la tabla de contactos de alta pasan a `alliance_leads`, que
     queda para los otros tipos (`V/descomposicion.md` §2.13, `V7`). Costo: una migración de datos.
     Riesgo: medio si hay filas con significado distinto.
  2. Se borran, sin mover nada. Costo: nulo. Riesgo: se pierden contactos vivos.
  3. Medir primero cuántas filas vivas hay y decidir con el dato. Costo: una consulta. Riesgo: ninguno.
- **Ejemplo**: si Juan tenía además el rol viejo de dueño de comercio por una ficha de Gastronomía, la
  opción 1 le deja sólo el rol que el sistema nuevo conoce.

## 5. La lista nominal de las diez variables que sólo usa el sistema viejo

- **Qué falta**: cuáles son las diez variables (y las cuatro de rate limit) que borra `U1`.
- **Afecta**: `U1` (AC:U1:8; sección *«Variables de entorno»*).
- **Por qué no lo deciden**: `16-fase-7-del-paraguas.md` §4.6, punto 4, cita `U1-021` sin listarlas;
  ese informe no está entre las fuentes inventariadas.
- **Pregunta**: ¿se trae la lista a la consolidada?
  1. **(recomendada)** Sí: se copia la lista de `U1-021` a la fila de `U1` con su cita. Costo: una
     lectura. Riesgo: ninguno.
  2. No: la arma el agente de `U1` desde el código. Costo: nulo. Riesgo: borrar una de más o de menos.
- **Ejemplo**: sin la lista, un agente podría borrar una variable que `B1` todavía necesita para
  Mercado Pago.

## 6. Cuáles son *«las tres tablas»* de `is_featured` y `featured_by_entitlement`

- **Qué falta**: el nombre de las tres tablas.
- **Afecta**: `U1` (AC:U1:8).
- **Por qué no lo deciden**: *«retira `is_featured` y `featured_by_entitlement` en las tres tablas»*
  (`16-fase-7-del-paraguas.md` §4.6, punto 4) no las nombra.
- **Pregunta**: ¿se nombran?
  1. **(recomendada)** Sí, las nombra quien aplica la consolidada desde el registro del lote 1 F de la
     FASE 5. Costo: una lectura. Riesgo: ninguno.
  2. Lo resuelve el agente de `U1` buscando las columnas en el esquema. Costo: nulo. Riesgo: bajo.
- **Ejemplo**: la ficha de la cabaña de Juan en Colón deja de estar destacada en la home con `U1`.

## 7. Las credenciales del script del corte y el monto del pago chico

- **Qué falta**: de dónde lee el script las credenciales del proveedor y de las dos bases, y el monto
  del pago chico del 4b.
- **Afecta**: `U3` (AC:U3:8, *«Variables de entorno»*).
- **Por qué no lo deciden**: el script *«no se despliega con ninguno de los dos sistemas»* y *«lo corre
  quien opera el corte»* (`16-fase-7-del-paraguas.md` §4.2, *«las herramientas del corte»*, punto 1);
  el pago es *«un pago chico con la tarjeta del owner»* (paso 4b), sin monto. El *«monto aprobado de
  antemano»* es del 5c, no del 4b.
- **Pregunta**: ¿cómo?
  1. **(recomendada)** Credenciales por variables de entorno de la sesión de quien opera el corte,
     nunca versionadas; el monto lo aprueba el owner antes del ensayo, como el del 5c. Costo: una línea
     en el runbook del corte. Riesgo: bajo.
  2. Un archivo local fuera del repositorio. Costo: igual. Riesgo: que quede en una copia.
- **Ejemplo**: el pago chico del 4b sale de la tarjeta del owner, no de la de Juan, y se devuelve en el
  mismo paso.

## 8. Qué pieza arma con `db:migrate` las bases de desarrollo, de integración y del e2e nocturno

- **Qué falta**: la pieza dueña del cambio del lote 2 C de la FASE 5.
- **Afecta**: `V1` (dueña de `DEC-ARCH-013#📌3` en el mapa de cobertura) y `V2`/`V6` («también»).
- **Por qué no lo deciden**: el 📌 dice *«Las bases de desarrollo, de tests de integración y del e2e
  nocturno se arman con `db:migrate`, como `e2e-pr`»* (`01-decision-log.md`, `DEC-ARCH-013`, 📌 de
  los lotes 1 C, 2 C y D, y 3 D) y `NUCLEO/02` §1.4 lo repite; ninguna fila de pieza lo asigna. El mapa
  de cobertura asigna el 📌 a `V1` por `G18`.
- **Pregunta**: ¿quién lo hace?
  1. **(recomendada)** `V1`, que trae la primera carga por migración (la tabla de claves) y sin ese
     cambio no llega a las bases de desarrollo y de tests. Costo: un cambio de scripts de la base.
     Riesgo: bajo.
  2. `U1`, con la limpieza. Costo: igual. Riesgo: contradice *«ningún código nuevo»* de `U1`.
  3. `V2`, con la carga del catálogo. Costo: igual. Riesgo: la tabla de claves de `V1` no llega antes.
- **Ejemplo**: sin el cambio, el test de integración que verifica la clave nueva del plan de Juan corre
  sobre una base sin la tabla de claves.

## 9. Dónde vive el script TypeScript que genera el SQL del catálogo y de la tabla de claves

- **Qué falta**: el lugar del script y del SQL generado.
- **Afecta**: `V1` (`G18`, AC:V1:4) y `V2` (AC:V2:8).
- **Por qué no lo deciden**: `V/20` §2, fila `G18`, y `NUCLEO/02` §1.4 dicen *«SQL generado por un
  script TypeScript, que se commitea»*, sin ubicación.
- **Pregunta**: ¿dónde?
  1. **(recomendada)** En el package de la base, junto a las migraciones, con el SQL commiteado en la
     migración que lo carga. Costo: nulo. Riesgo: bajo.
  2. En `scripts/`. Costo: nulo. Riesgo: lejos de la migración que lo usa.
- **Ejemplo**: agregar una clave para el plan de Juan regenera ese SQL; si no, `G18` lo marca.

## 10. Las rutas, permisos y códigos de error de las acciones 18 y 11

- **Qué falta**: la ruta de la API, el nombre del permiso (la 11 tiene *«permiso propio»*) y el código de
  error de cada rechazo de validación.
- **Afecta**: `V2` (acción 18, AC:V2:6 y AC:V2:7) y `V4` (acción 11, AC:V4:9).
- **Por qué no lo deciden**: `NUCLEO/08` §3 (filas 11 y 18) dice el acto, quién y la confirmación; no la
  ruta ni el código; `apps/api/docs/error-contract.md` fija el orden y la familia (403, 400, 404) pero no
  un código por causa.
- **Pregunta**: ¿se fijan en la consolidada?
  1. **(recomendada)** Se fijan al implementar, bajo el tier admin (`/api/v1/admin/*`) y el contrato de
     errores existente, y se escriben en la consolidada al mergear. Costo: nulo. Riesgo: bajo.
  2. Fijarlos ahora. Costo: una tanda de preguntas. Riesgo: ninguno.
- **Ejemplo**: si un admin intenta pasar el trial de Partner de 0 a 7 días, el panel le muestra el
  mensaje de esa causa con el código que se fije.

## 11. Dónde vive el caché del conjunto efectivo y cómo se observa una entrada sospechosa

- **Qué falta**: el almacenamiento del caché y la observabilidad de la marca *«sospechosa»*.
- **Afecta**: `V3` (AC:V3:6).
- **Por qué no lo deciden**: `V/02` §3 fija qué se cachea, cuándo se invalida y las tres reglas, pero
  no dónde ni cómo se mide.
- **Pregunta**: ¿dónde y cómo?
  1. **(recomendada)** En el almacenamiento de caché que la API ya usa, con un contador de entradas
     sospechosas en los logs estructurados. Costo: bajo. Riesgo: bajo.
  2. En memoria del proceso. Costo: nulo. Riesgo: varias instancias no comparten la invalidación.
- **Ejemplo**: si Juan pierde la cobertura y la invalidación falla, la próxima lectura ignora la
  entrada sospechosa y no le sigue otorgando lo que el contrato ya no emite.

## 12. Los mínimos de tipos de test del mapa de cobertura que no tienen una lectura en la pieza

- **Qué falta**: confirmar que cuatro mínimos de `cobertura.json` derivados del texto no se aplican.
- **Afecta**: `U1` (`GATE:M1`: *«smoke manual · staging»*), `V1`
  (`DEC-ARCH-006`: *«migración desde cero»* y *«sobre datos»*; `DEC-ENT-006`: *«migración sobre
  datos»*) y `V4` (`DEC-TEST-001#📌1`: *«migración desde cero»*).
- **Por qué no lo deciden**: los mínimos salen de palabras del texto (`tipos_derivados_del_texto`), y
  en estas piezas no hay un objeto que probar con ese tipo: el momento 1 se comprueba sobre el PR a la
  rama, no en `staging`; `V1` no tiene esquema del contrato ni datos previos de la clave de carrusel;
  `G13` corre sobre un build, no sobre una base.
- **Pregunta**: ¿se aceptan como no aplicables?
  1. **(recomendada)** Sí, declarados en este archivo, con los tests que sí tienen (guard estático,
     unitario, migración desde cero). Costo: nulo. Riesgo: bajo.
  2. No: escribir un test de esos tipos igual. Costo: tests sin objeto. Riesgo: tests que no pueden
     fallar.
- **Ejemplo**: un *«smoke en staging»* del momento 1 de `U1` no verificaría nada que el rollup del PR no
  verifique ya.

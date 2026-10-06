# HOS-1352 · Lote BY a CB para el owner (segunda vuelta del triage)

Fuentes en `17f9702675`, HEAD `a6900acce3`. Entradas: los abiertos de la pasada 2
(`_trabajo/abiertos/pasada2-*.md`), los de la pasada 1 que los redactores dejaron abiertos
(re-verificados uno por uno) y los errores de fuente de los informes de la pasada 2. Clasificación
completa en `triage.json` (lo arma `construir.py`, que sale 1 si queda un residuo sin corrección).
Grafo: `aristas_triage.py`, copia de `41-corte-del-mvp/aristas.py` con `EXTRA=` y detector de ciclos.
Base: 62 flechas, 0 violaciones, sin ciclo.

Ejemplo fijo: **Juan**, anfitrión de una cabaña en Colón, se suscribe al Básico la semana siguiente
al corte.

Cuatro preguntas. Todo lo demás es residuo, error de redacción o de herramienta, o dato operativo
con dueño y momento (ver el final).

---

## BY · Una pieza anterior que LEE una tabla que nace después

**Contexto.** La guarda de `S15` (`B3`) es *«ningún pago colgado sin resolver»*, y lee
`reconciliation_mark_payment`. Por BN esa tabla nace en `B5`, porque su FK apunta a `payment`. BN
dice dónde nace una tabla y que *«la rama que la escribe se completa ahí»*; BL dice qué hace una
pieza que *«llama»* a algo posterior. Ninguna habla de una **lectura**. La redacción aplicó BL a la
lectura y lo marcó inferido (`pasada2-g7.md`; `B3.md`, AC:B3:15). El predicado (f) de `G-R1-F`, de
`B3`, tiene el mismo problema.

1. **BL vale también para leer: `B3` escribe la guarda de `S15` (y el predicado (f) de `G-R1-F`)
   contra una interfaz interna; `B5` trae la implementación sobre su tabla y prueba el rechazo con
   filas sembradas, y ese criterio va al *«Lista cuando»* de `B5`.** Costo: una línea en la fila de
   `B5`. Riesgo: bajo; entre el merge de `B3` y el de `B5` no hay pagos colgados, porque nadie los
   escribe (`P1` es de `B5`). Grafo: sin flechas. **Recomendada**: es lo que la redacción ya escribió,
   sin una regla nueva.
2. `reconciliation_mark_payment` nace en `B3` sin la FK a `payment`, y `B5` se la agrega. Riesgo:
   contradice BN (*«nace con todas sus restricciones»*) y una migración de `B5` toca una tabla de `B3`.
3. `S15` pasa entera a `B5`. Riesgo: durante el intervalo `B3` abre marcas (`S14`) que nadie puede
   levantar. Dejarla en `B3` esperando a `B5` (`B5→B3`) da ciclo (verificado).

A *Juan* nadie le cuelga un pago antes de `B5`, porque el registro del dinero todavía no existe; desde
`B5`, si un cobro suyo queda colgado de una marca, la marca no se levanta hasta resolverlo.

---

## BZ · Por qué camino le llega el aumento a un cliente ya anclado (B12)

**Contexto.** BM dejó la acción 19 vedada hasta el momento 5. Desde ahí, sobre una versión con
clientes se publica una versión nueva para las altas nuevas, y *«el aviso y la mutación a los ya
anclados llegan con `B12`»* (📌 de `DEC-MP-002`, log:1462-1470). No dice por qué transición. Las
fuentes chocan: `DEC-MP-002` impl. 2 dice *«el precio vive en la suscripción»* (anterior a BM), y
`DEC-ARCH-001` y el 📌 de BM dicen que una versión con clientes no cambia de precio. `B/03` §3.2 no
tiene una transición de aumento: `S37` (mutar siete días antes de la fecha) y `S38` (cambiar la
versión en la fecha) son de la migración de un plan retirado, y `S30` muta por una promo
(`pasada2-g9.md`).

1. **El aumento a un anclado es una migración a la versión nueva, por `S37` y `S38`, con el motivo
   *«aumento»*: la fecha y los contactos son los del plazo 11 (no el 12), sin la cohorte
   `PARA_RESOLVER` (el ciclo es el mismo) y sin las reglas propias de la migración que no aplican a un
   aumento (la promo viva se conserva: el monto esperado ya la descuenta, `B/09`:185).** Costo:
   parametrizar `S37` y `S38` por motivo, con su test. Riesgo: bajo; reusa la mutación verificada,
   la cola y el registro de a quién se aplicó (`DEC-MP-002` impl. 3), y el cliente termina en la
   versión cuyo precio paga (`DEC-ARCH-001`). Grafo: sin flechas (`S38` es de `B8b`, que es ancestro
   de `B12`: `B8b→B9b→B10→B13b→B12`). **Recomendada.**
2. El anclado se queda en su versión y se le muta sólo el monto, con una transición nueva. Costo: una
   transición, su test y su relectura. Riesgo: el monto deja de ser el de su versión; rompe el
   pagador manual, cuya cuota sale de la versión (`B/10` §3.7).
3. El aumento no alcanza a los anclados. Riesgo: contradice la parte 2 de `DEC-MP-002` y su motivo
   (*«el owner quiere que el aumento alcance a todos»*).

Con el momento 5 ya cumplido, se sube el Básico. Con la 1, *Juan* recibe los tres avisos con su
fecha; siete días antes se le muta el monto sobre la misma autorización, y en la fecha pasa a la
versión nueva. Si tenía una promo viva, la sigue teniendo sobre el precio nuevo.

---

## CA · La suspensión y el Turista VIP: quién construye las dos superficies, y qué pasa al regularizar

**Contexto.** `V/15` §6.3 (l.497-509): el suspendido pierde lo que su plan le heredaba como turista,
con dos obligaciones. (1) El aviso de suspensión nombra lo que pierde como turista. (2) Si compra VIP
estando suspendido, la pantalla de compra le dice que *«al regularizar se le va a cancelar»* por
`DEC-ENT-004`. Ninguna fila de pieza las nombra; la pasada 2 las puso en `V3`, marcadas inferido
(`pasada2-g5.md`). Y la obligación (2) presupone algo que nadie construye: BP puso la cancelación
del VIP heredado sólo en `S2` (al contratar), pero regularizar es `S7` (`B7`), y ahí no hay cláusula.

1. **`B7` construye el aviso de suspensión que nombra lo que se pierde como turista (`S6` es suya y
   encola los avisos del grace y la suspensión) y una cláusula en `S7`, espejo de la de BP: si al
   regularizar el plan vuelve a heredar Turista VIP, cancela la suscripción de VIP sin reembolso y con
   el correo antes. `B13a` construye la advertencia en la pantalla de compra de VIP.** Costo: dos
   líneas en las filas, una cláusula y sus tests. Riesgo: bajo. La herencia la contesta `V3` por el
   contrato, como en BJ (integración, no flecha). Grafo: `B7→B13a` ya existe; sin flechas.
   **Recomendada**: cumple §6.3 a la letra y deja cada superficie con quien la emite.
2. Las dos superficies en `V3`. Riesgo: `V3` no tiene pantallas ni encola correos, y sigue sin
   construirse la cancelación al regularizar.
3. Las superficies como en la 1, sin la cláusula en `S7`. Riesgo: la pantalla promete una
   cancelación que no ocurre, y el plan se la vuelve a regalar mientras la paga.

Si el Básico de *Juan* heredara Turista VIP y Juan cayera en `SUSPENDED`, el aviso le diría que
también pierde el VIP. Si lo compra suspendido, la pantalla le avisa; y cuando regulariza, el VIP pago
se cancela porque el plan se lo vuelve a dar.

---

## CB · Dónde vive el caché del conjunto efectivo

**Contexto.** `V/02` §3 fija qué se cachea, que se invalida por evento y por `user` después del
commit, y que una invalidación fallida marca la entrada como sospechosa (AC:V3:6). No dice dónde vive
el caché. BS deja estos detalles al PR, pero excluye *«lo que cambia comportamiento»*, y acá cambia:
en un redeploy de Coolify conviven dos contenedores, y en varias instancias un caché en memoria no se
invalida por `user` en todas. El repo ya tiene Redis (`apps/api/src/utils/redis.ts`,
`HOSPEDA_REDIS_URL`).

1. **En el Redis que la API ya usa, con la invalidación por `user` del AC; si Redis no responde, se
   lee la resolución en vivo (el caché nunca decide sobre plata, `V/02` §3); y un contador de
   entradas sospechosas en los logs estructurados.** Costo: bajo. Riesgo: una dependencia más en el
   camino de lectura, cubierta por la lectura en vivo. Grafo: sin cambios. **Recomendada.**
2. En memoria del proceso. Riesgo: durante cada rollout, y con más de una instancia, una revocación
   invalidada en un contenedor sigue otorgando en el otro, contra AC:V3:6.
3. Sin caché: siempre en vivo. Costo: el de cada lectura. Riesgo: contradice `V/02` §3, que lo da
   por existente.

*Juan* deja de pagar y pierde la cobertura. Con la 1, la invalidación borra su entrada en Redis y
ningún contenedor le sigue otorgando lo que el contrato ya no emite.

---

## Lo que no va al owner

### Residuos de fuente (19 verificados; 2 de ellos parciales)

Se corrigen en la fuente, como AY, y piden otro SHA congelado y otra pasada de los scripts. El texto
exacto está en `triage.json` (campo `correccion`).

| id | dónde | qué | autoridad |
|---|---|---|---|
| EF2-g2-1 | `nucleo/02`:198 | dieciocho → diecinueve valores | BU |
| EF2-g2-2 | `nucleo/02`:195-196 | sumar el 19 (antes del merge de `B2`) | BU, BX |
| EF2-g4-1 | `B/spec.md`:249, :256-257 | catorce `UNKNOWN`; trece de billing | `contar-filas-de-la-matriz.py` |
| EF2-g4-2 | `B/spec.md`:262-280 | fuera `EX-57`/`EX-59`; entra `EX-54`; `RN-3` como nota | ídem |
| EF2-g4-3 | `V/spec.md`:452 | cuatro atributos, con la clase | `V/15`:567-570 |
| EF2-g4-4 | `V/20` §5 | numeración desde 7 (cosmético) | — |
| EF2-g6-1 | `V/18`:143-147, :222 | la migración de `partners` y `postulacion` son de `V6` | AB, AP |
| EF2-g6-4 | `V/02`:577-578 | la nota del log la resuelve BK | BK |
| EF2-g6-5 | `V/15`:425-426 | el paréntesis viejo: el log ya dice `PB6` | log:4197 |
| EF2-g6-6 | `V/22`:61 | «Tres piezas» con la 2 tachada (cosmético) | `DEC-DATA-005` |
| EF2-g6-8 | `V/21`:692, :698 | `V1` → `U1` | lote O-A |
| EF2-g5-1 | `V/desc`:622 | `V1`–`V5` → `V1`–`V3` | BR |
| EF2-g5-2 | `V/10`:39 | sale el encendido del trial de Partner | N7 |
| EF2-g8-1 | `B/12`:157 | «la sexta» → una de las once | C8 |
| EF2-g8-2 | `B/12`:980-983 | la fila es `S29`, de `B5` | `B/03`:179 |
| EF2-g8-3 | `B/12`:787 | DOS → TRES filas, con `S36` (parcial) | `B/03`:186 |
| EF2-g8-4 | `B/06`:266 | «nuestra capa» es el cobro viejo (parcial) | `DEC-MP-009` |
| EF2-g3-1 | `B/desc`:182 | coma colgada (cosmético) | — |
| EF2-x-2 | registro de BS (`10-decisiones`:144, log:8081-8088) | sumar los defaults de la opción 1 elegida | opción 1 de BS |

Dos reportes no se reproducen: `V/17`:50-54 tiene los tachados balanceados (cuatro delimitadores) y
`V/19` §4 fila 18 no nombra pieza, así que BL no la contradice.

### Errores de redacción o de herramienta

- **EF2-x-1, hallazgo propio:** nueve veredictos `PARCIAL` (los de BK y los cuatro del triage 1)
  tienen la nota *«Parte sin efecto … lo omitido está marcado «[…]»»*, pero el texto muerto sigue
  en `01-decisiones-vigentes.md`: `DEC-ARCH-017#📌1` (l.6398), `DEC-ARCH-014#📌7` (l.6130),
  `DEC-TRIAL-010#📌1` (l.553), `DEC-DATA-005#📌6` (l.4311), `DEC-MIG-001` (l.6602), `DEC-MIG-002`
  (l.6672, el riesgo), `DEC-MP-003` (l.2150), `DEC-METH-006` (l.9952) y `DEC-DATA-004` (l.4147).
  `MP:EX-46` sí está aplicado. `trazar.py` no lo ve, porque no compara la nota con el cuerpo.
- **Tipos de test de `CORTE` (AB-g4-1):** ya los arregló `cobertura.py` en `17f9702675`; queda la
  nota *«Inferido…»* de TEST:CORTE:18 (`30-el-corte`:1909-1911) y la línea de `pasada2-g4` que lo
  da por abierto.
- **Tipos deducidos en `V1`/`V4` (AB-g5-12):** `DEC-ARCH-006`, `DEC-ENT-006` y `DEC-TEST-001#📌1`
  siguen con tipos de migración leídos en su texto; sólo avisan (R18 ⚠). Exceptuarlos por lectura.
- **`TRANS:B:S10` (EF2-t-1):** sumar `B9b` en *«también»*, rol implementa (BO).
- **`G-R3` sin enlace (EF2-g6-3):** enlazar a `04-catalogos.md#val-g-r3`.
- **Resueltos por las fuentes o por una letra y todavía listados como abiertos:**
  - `S14` lee promos y cortesías por los motivos 12 y 24 (AB-g7-5).
  - «Compra» es la identidad sobre `addon_instance` (AB-g7-6).
  - `V1` arma con `db:migrate` las bases de desarrollo y de tests (AB-g5-8, el mapa).
  - El script del SQL lo ubica el PR (AB-g5-9, BS).
  - Los correos de `V7` van por `U2` (AB-g6-3, BR por transitividad: `U2→V4→V5→V7`).
  - `USER_IMPERSONATE` lo saca `V5` de la base, con el principio del lote 1 I (AB-g6-1, F5-AUT-023).

### Datos operativos con dueño y momento

- Plazos 3, 4, 7, 8 y 9: el owner, antes del merge de `V6`. Plazo 19: el owner, antes del merge de
  `B2` (BX).
- Monto del pago chico del 4b: el owner, antes del ensayo (BS, opción 1).
- La sección del checklist de smoke de cada fase: la escribe cada pieza posterior, con el formato de
  `B13a` (BS, opción 1).

---

## Lo que la redacción tiene que cambiar después del lote, por archivo

`C` = `spec-consolidada/`. Supone la opción recomendada en BY a CB.

- **`01-decisiones-vigentes.md`**: aplicar el «[…]» de los nueve veredictos de EF2-x-1; sumar al
  registro de BS los defaults de la opción 1 (EF2-x-2); registrar BY a CB.
- **`04-catalogos.md`**:
  - `TRANS:B:S10`: sumar `B9b` en *«también»*.
  - `TRANS:B:S14`: anotar que lee la cortesía diferida (motivo 12) y las promos vivas por el monto
    esperado (motivo 24).
  - `TRANS:B:S15`: la guarda va por interfaz y la implementa `B5` (BY).
  - `TRANS:B:S7`: la cláusula del VIP al regularizar (CA).
  - `TRANS:B:S37` y `S38`: el motivo *«aumento»* con el plazo 11 (BZ).
- **`02-nucleo.md` / `02-nucleo-modelo-y-maquinas.md`**: lo que copien de `nucleo/02` §1.5 (19
  plazos, el 19 entre los sin valor).
- **`03-contrato-de-cobertura.md`** (l.392), **`00-indice.md`** (l.1121) y **`30-el-corte.md`**
  (l.609, 610, 620, 1638, 1838): enlazar `G-R3`.
- **`30-el-corte.md`**: sacar la nota *«Inferido»* de TEST:CORTE:18.
- **`80-abiertos.md` §8**: fundir sólo lo vivo (BY a CB hasta que se contesten, y los operativos de
  arriba con su dueño y su momento); los demás abiertos de la pasada 1 van como cerrados, con su letra.
- **`10-corte/V1.md`**: sacar de *Abiertos* el `db:migrate` (ya tiene su AC, l.417) y la ubicación
  del script (BS).
- **`10-corte/V3.md`**: el caché según CB (Redis, lectura en vivo si falla, contador); sacar las dos
  superficies de §6.3 (CA).
- **`10-corte/V5.md`**: el carril de `USER_IMPERSONATE` (enum recreado y migración de datos de roles
  y overrides, en el PR que retira sus lectores); sacarlo de *Abiertos*.
- **`10-corte/U3.md`**: cerrar el monto del 4b (operativo: el owner, antes del ensayo).
- **`10-corte/B3.md`**: sacar de *Abiertos* lo de `S14` y la «compra», con su fuente; `S15` contra la
  interfaz (BY), ya no inferido.
- **`10-corte/B5.md`**: la implementación de la guarda de `S15` y del predicado (f) de `G-R1-F`, y su
  criterio en el *«Lista cuando»* (BY).
- **`10-corte/B7.md`**: el aviso de suspensión que nombra la pérdida como turista y la cláusula de
  `S7` (CA).
- **`10-corte/B13a.md`**: la advertencia en la compra de VIP del suspendido (CA).
- **`20-fase-2/B8b.md`**: `S38` con el motivo *«aumento»* (BZ); cerrar el checklist (BS).
- **`20-fase-2/B9b.md`**, **`20-fase-3/B10.md`** y **`20-fase-3/B13b.md`**: cerrar el checklist (BS).
- **`20-fase-3/B12.md`**: el camino del aumento (BZ), en su AC:B12:9, TEST:B12:10 y *Cron y outbox*;
  cerrar el checklist (BS).
- **`20-fase-4/V7.md`**: cerrar el outbox (BR por transitividad); dejar sólo los plazos 8 y 9 como
  operativos.
- **`_trabajo/`**: lectura de cobertura (`S10` con `B9b`; exceptuar los tres tipos de AB-g5-12);
  `pasada2-g4-corte-indice.md` da por abiertos los tipos de `CORTE`, ya cerrados.

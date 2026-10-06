# Pasada 3 · generados

> Generado por `scripts/pasada3.py` sobre el HEAD `eac01d9148`; fuentes `17f9702675` → `c7a3fac900`. Los archivos generados (01, 04, B4–B7) no se editan a mano: lo que les toca se arregla en su generador (`scripts/generadores/`).

| qué | cuántos |
|---|---|
| Ítems nuevos a definir (R1) | 0 |
| AC y tests nuevos (R7 · R7b · R18) | 0 |
| Ítems con contenido de fuente cambiado desde 17f9702675 | 8 |
| Citas sobre texto cambiado (reanclar.py, sin remapear) | 0 |
| Secciones R17 sin citar asignadas | 0 |
| Origen corrido (R6): el bloque cita una línea cuyo texto cambió | 0 |
| Lo que la redacción tiene que cambiar después del lote BY a CB | 2 |
| R17 cubierto | 0 |
| R17 parcial | 0 |
| R17 ausente | 0 |

## `01-decisiones-vigentes.md` *(generado por `scripts/generadores/g1/gen01.py`)*

### Ítems con contenido de fuente cambiado desde 17f9702675

- **define** *(archivo generado desde la fuente: ya regenerado sobre c7a3fac900)*: `DEC-MP-002` (ACCEPTED) — vieja `D/01-decision-log.md:1375` → nueva `D/01-decision-log.md:1375` — cambio: {+`S37` y `S38`, con el motivo *«aumento»***: la fecha y los contactos son los del plazo 11 (no el 12), sin la cohorte `PARA_RESOLVER` —el ciclo es el mismo— y conservando la promo viva, porque el monto esperado ya la descuenta (`B/09` §3). El cliente termina en la versión cuyo precio paga (`DEC-ARCH-001`), y la implicación 2, *«el precio vive en la suscripción»*, se lee así. Dónde: `B/03` §3.2 (`S37`, `S38`); `B/descomposicion.md` §2, §2.12 y §4 (`B12`); `41-corte-del-mvp/10-decisiones-del-owner.md`, BZ.+}
- **define** *(archivo generado desde la fuente: ya regenerado sobre c7a3fac900)*: `DEC-AUTH-001` (ACCEPTED) — vieja `D/01-decision-log.md:6618` → nueva `D/01-decision-log.md:6626` — cambio: {+invalida por `user`: **vive en el Redis que la API ya usa**, no en la memoria del proceso, porque en un redeploy conviven dos contenedores y con varias instancias una invalidación no alcanzaría a las otras; **si Redis no responde, se lee la resolución en vivo**; y un contador de entradas sospechosas va en los logs estructurados. Dónde: `V/02` §3.4; `V/descomposicion.md` §2 y §4 (`V3`); `41-corte-del-mvp/10-decisiones-del-owner.md`, CB.+}
- **define** *(archivo generado desde la fuente: ya regenerado sobre c7a3fac900)*: `DEC-ARCH-017` (ACCEPTED) — vieja `D/01-decision-log.md:7801` → nueva `D/01-decision-log.md:7815` — cambio: {+**BY**: **la regla de BL vale también para una lectura**. La guarda de `S15` (*«ningún pago colgado sin resolver»*) y el predicado (f) de `G-R1-F`, de `B3`, leen `reconciliation_mark_payment`, que por BN nace en `B5`: `B3` los escribe contra una interfaz interna, y `B5` trae la implementación sobre su tabla y prueba el rechazo con filas sembradas, con ese criterio en su *«Lista cuando»*. **CA**: `B7` construye el aviso de suspensión que nombra lo que la persona pierde como turista (`V/15` §6.3) y suma a `S7` **la cláusula espejo de la de `S2` (BP)**: si al regularizar el plan vuelve a hereda …(cortado)
- **define** *(archivo generado desde la fuente: ya regenerado sobre c7a3fac900)*: `DEC-METH-019` (ACCEPTED) — vieja `D/01-decision-log.md:7978` → nueva `D/01-decision-log.md:8004` — cambio: {+owner en el lote BK a BV, incluía estos defaults, y valen: **el monto del pago chico del 4b lo aprueba el owner antes del ensayo**, como el del 5c; **las credenciales van en variables de entorno de la sesión de quien opera, nunca versionadas**; **cada pieza posterior escribe la sección de su fase en el checklist de smoke, con el formato de `B13a`**; **las listas que viven en el código las saca el PR del código o del registro y las lista en su descripción**; y **los labels de Linear son `kind-spec` más las `area-*` de cada fila**. Dónde: `16-fase-7-del-paraguas.md` §4.7, momento 1; `41-corte- …(cortado)

### Lo que la redacción tiene que cambiar después del lote BY a CB

- **`01-decisiones-vigentes.md`**: aplicar el «[…]» de los nueve veredictos de EF2-x-1; sumar al
  registro de BS los defaults de la opción 1 (EF2-x-2); registrar BY a CB.

## `04-catalogos.md` *(generado por `scripts/generadores/g3/gen.py`)*

### Ítems con contenido de fuente cambiado desde 17f9702675

- **define** *(archivo generado desde la fuente: ya regenerado sobre c7a3fac900)*: `TRANS:B:S7` (VIVO) — vieja `B/03-maquinas-de-estado.md:157` → nueva `B/03-maquinas-de-estado.md:157` — cambio: [-I-A)-] … {+I-A); **y si al volver el plan comercial vuelve a heredar Turista VIP y el `user` paga una suscripción de Turista VIP, la cancela en el mismo acto, sin reembolso, con el correo antes** —el espejo de la cláusula de `S2`— (corte del MVP, owner 2026-10-02, CA; `DEC-ENT-004`, `V/15` §6.3; construye `B7`)+}
- **define** *(archivo generado desde la fuente: ya regenerado sobre c7a3fac900)*: `TRANS:B:S15` (VIVO) — vieja `B/03-maquinas-de-estado.md:165` → nueva `B/03-maquinas-de-estado.md:165` — cambio: [-levantada—-] … {+levantada—; **la guarda *«ningún pago colgado de esa marca sin resolver»* lee `reconciliation_mark_payment`, que nace en `B5` (BN): `B3` la escribe contra una interfaz interna, y `B5` trae su implementación y prueba el rechazo con filas sembradas** (corte del MVP, owner 2026-10-02, BY)+}
- **define** *(archivo generado desde la fuente: ya regenerado sobre c7a3fac900)*: `TRANS:B:S37` (VIVO) — vieja `B/03-maquinas-de-estado.md:187` → nueva `B/03-maquinas-de-estado.md:187` — cambio: [-**B12**-] … {+**B12**; **y la usa también un aumento de precio a un cliente anclado, con el motivo *«aumento»*: es una migración a la versión nueva, con la fecha y los contactos del plazo 11 (no el 12), sin la cohorte `PARA_RESOLVER` —el ciclo es el mismo— y conservando la promo viva, porque el monto esperado ya la descuenta (`B/09` §3)** (corte del MVP, owner 2026-10-02, BZ; `DEC-MP-002`, parte 2)+}
- **define** *(archivo generado desde la fuente: ya regenerado sobre c7a3fac900)*: `TRANS:B:S38` (MIXTO) — vieja `B/03-maquinas-de-estado.md:188` → nueva `B/03-maquinas-de-estado.md:188` — cambio: [-migración-] … {+migración; **y con el motivo *«aumento»* cambia la versión en la fecha de aplicación del plazo 11, sin la cohorte `PARA_RESOLVER` y con la promo viva conservada; la usa `B12` para el aumento como para la migración** (corte del MVP, owner 2026-10-02, BZ)+}

### Lo que la redacción tiene que cambiar después del lote BY a CB

- **`04-catalogos.md`**:
  - `TRANS:B:S10`: sumar `B9b` en *«también»*.
  - `TRANS:B:S14`: anotar que lee la cortesía diferida (motivo 12) y las promos vivas por el monto
    esperado (motivo 24).
  - `TRANS:B:S15`: la guarda va por interfaz y la implementa `B5` (BY).
  - `TRANS:B:S7`: la cláusula del VIP al regularizar (CA).
  - `TRANS:B:S37` y `S38`: el motivo *«aumento»* con el plazo 11 (BZ).

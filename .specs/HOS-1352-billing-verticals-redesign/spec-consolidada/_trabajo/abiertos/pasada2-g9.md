# Abiertos de la pasada 2 del grupo g9 (B8a, B8b, B9a, B9b, B10, B11, B12, B13a, B13b)

Huecos que las fuentes no deciden después del lote BK a BX. Ninguno se escribió como criterio en las
piezas: la sección *Abiertos* de la pieza apunta acá. Sin letra: la asigna el orquestador.

---

## Por qué camino llega el aumento a los clientes ya anclados

- **Qué falta**: el mecanismo con que `B12` aplica la parte 2 de `DEC-MP-002` a un cliente anclado a
  una versión con clientes. BM dice que la acción 19 sobre una versión con clientes **se rechaza y se
  publica una versión nueva**, que rige para las altas nuevas, y que *«el aviso y la mutación a los
  clientes ya anclados (la parte 2) llegan con `B12`»*. No dice si el cliente anclado **cambia de
  versión** (y entonces el camino es el de la migración: la acción 17, `S37` mutando el monto siete
  días antes y `S38` cambiando la versión en la fecha) o **se queda en la versión vieja con el monto
  mutado** (y entonces el monto de la suscripción deja de ser el de su versión).
- **Qué afecta**: `B12` (`AC:B12:9`, `TEST:B12:10`, su sección *Cron y outbox*); y, por la cola,
  `B8b` (`S38`) si el camino es el de la migración.
- **Por qué las fuentes no lo deciden**: `DEC-MP-002` (implicación 2: *«El precio vive en la
  suscripción, no sólo en el plan. Durante la ventana conviven dos precios para el mismo plan, y lo
  que se cobra es el de la suscripción»*) se escribió antes de `DEC-ARCH-001` y de BM; su segundo 📌
  (BM, `01-decision-log.md` línea 1463) dice que *«una versión con clientes no cambia de precio»*
  (`DEC-ARCH-001`) y manda la parte 2 a `B12` sin decir por qué transición. La fila de `B12`
  (`B/descomposicion.md:150`) y su criterio (`:1053`) dicen qué se cumple —*«anuncia el aumento con
  la fecha de cada uno y no cambia ningún monto antes de esa fecha»*— y no el camino. `B/03` §3.2 no
  tiene una transición de aumento: `S37` es sólo de la migración de un plan retirado, y `S30` muta
  por una promo.
- **Pregunta para el owner**:
  1. **El aumento sobre los anclados es una migración a la versión nueva, por el mismo camino de la
     acción 17**: `S37` con el plazo 11 en vez del 12, sin la cohorte `PARA_RESOLVER` (el ciclo es el
     mismo). Costo: parametrizar la migración por plazo y por motivo. Riesgo: la migración tiene
     reglas propias (pierde la promo, qué conservar) que en un aumento puro no aplican y habría que
     excluir. **Recomendada**: reusa la mutación verificada, la cola y el registro de a quién se
     aplicó, y respeta `DEC-ARCH-001` porque el cliente termina en la versión cuyo precio paga.
  2. **El anclado se queda en su versión y sólo se le muta el monto**, con una transición nueva de
     `03` §3.2. Costo: una transición, su test y su relectura. Riesgo: rompe *«el precio es el de la
     versión anclada»* para el pagador manual, cuya cuota sale de la versión (`B/10` §3.7).
  3. **El aumento no alcanza a los anclados** (sólo a las altas nuevas). Costo: un 📌 sobre
     `DEC-MP-002`. Riesgo: contradice la parte 2 y el motivo que el owner dejó escrito (*«el owner
     quiere que el aumento alcance a todos»*).
  - *Ejemplo*: Juan, anfitrión de una cabaña en Colón que se suscribió al Básico mensual la semana
    siguiente al corte; ya cumplido el momento 5 se sube el precio del Básico. Con la 1, Juan recibe
    los tres avisos con su fecha, siete días antes de esa fecha se le muta el monto sobre la misma
    autorización, y en la fecha pasa a la versión nueva; con la 2, sigue en la versión vieja pagando
    el monto nuevo.

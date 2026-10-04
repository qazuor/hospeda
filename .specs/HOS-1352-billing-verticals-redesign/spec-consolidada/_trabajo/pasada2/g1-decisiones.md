# Pasada 2 · g1-decisiones

> Generado por `scripts/pasada2.py` sobre el HEAD `9b40071800`; fuentes `f80c0f2715` → `17f9702675`. Los archivos generados (01, 04, B4–B7) no se editan a mano: lo que les toca se arregla en su generador (`scripts/generadores/`).

| qué | cuántos |
|---|---|
| Ítems nuevos a definir (R1) | 0 |
| AC y tests nuevos (R7 · R7b · R18) | 0 |
| Ítems con contenido de fuente cambiado desde f80c0f2715 | 5 |
| Citas sobre texto cambiado (reanclar.py, sin remapear) | 0 |
| Secciones R17 sin citar asignadas | 0 |
| R17 cubierto | 0 |
| R17 parcial | 0 |
| R17 ausente | 0 |

## `01-decisiones-vigentes.md` *(generado por `scripts/generadores/g1/gen01.py`)*

### Ítems con contenido de fuente cambiado desde f80c0f2715

- **define** *(archivo generado desde la fuente: ya regenerado sobre 17f9702675)*: `DEC-MP-002` (ACCEPTED) — vieja `D/01-decision-log.md:1375` → nueva `D/01-decision-log.md:1375` — cambio: {+aclaración del owner: *«en el momento del corte no se puede cambiar precio, quedan los que tenemos actualmente.. una vez la epica esta terminada, mergeada, deployada y smokeada y queda en produccion andando estable, ahi si, si algun dia queremos cambiar un precio, lo podemos cambiar»*)**: **los precios del corte son los vigentes hoy**: los carga el paso 3a y no se cambian durante el corte, y **ningún precio cambia hasta que el momento 5 del corte esté cumplido**. Desde ahí, la acción 19 aplica esta decisión así: sobre una versión de plan sin clientes fija el precio; sobre una con clientes se …(cortado)
- **define** *(archivo generado desde la fuente: ya regenerado sobre 17f9702675)*: `DEC-DATA-008` (ACCEPTED) — vieja `D/01-decision-log.md:7303` → nueva `D/01-decision-log.md:7318` — cambio: {+**BU**: la ventana `N` del resumen de conciliación de `DEC-OBS-001` (*«`N` es configuración (§9)»*) es **una clave más de la lista cerrada, la 19, en la tabla versionada de plazos de billing de `B2`**, que cambia la acción 22; su valor inicial lo fija el owner antes del merge de `B11`. **BV**: **la fecha límite de la Fase 1 (`V9b`) es el instante del corte más el plazo 1 menos el plazo 4, con la versión 1 de los plazos**; la Fase 1 se mergea a producción antes de esa fecha y su gate la verifica contra ese número. Como cada reloj guarda la versión con que arrancó, un cambio de plazo posterior …(cortado)
- **define** *(archivo generado desde la fuente: ya regenerado sobre 17f9702675)*: `DEC-ARCH-016` (ACCEPTED) — vieja `D/01-decision-log.md:7664` → nueva `D/01-decision-log.md:7695` — cambio: {+1)**, sobre el momento 3 (*«qué es un ensayo verde»*) y el paso 0: **el ensayo recorre la rama de aborto una vez, en `staging`, sobre la misma copia**: una falla provocada después del 1b, y se verifica restaurar el 2b, la imagen vieja, los inversos (b) y (c) y la regla del 0b puesta hasta el reintento (Q1); y **la medición de `EX-49` se registra con la etiqueta `prod`**: lee datos de producción sin mutar nada y es gate del corte real, aunque el paso 0 decía *«ninguna en producción»* (Q2). Dónde: `16-fase-7-del-paraguas.md` §4.2 (el paso 0 y la rama de aborto) y §4.7, momento 3; `41-corte-del …(cortado)
- **define** *(archivo generado desde la fuente: ya regenerado sobre 17f9702675)*: `DEC-ARCH-017` (ACCEPTED) — vieja `D/01-decision-log.md:7762` → nueva `D/01-decision-log.md:7801` — cambio: {+la 1)**, sobre lo que dejó el triage de los abiertos de la spec consolidada. **BL**: una pieza anterior que llama a algo que construye una posterior **escribe su rama entera y la llamada contra una interfaz interna, y la posterior trae la implementación sin tocar código anterior**; si lo llamado ya existe cuando llega la anterior, la anterior lo hace entero; y un criterio que necesita la implementación real va al *«Lista cuando»* de la posterior. Aplicada: `B5` y `B7` llaman a `S18`, `S31` y `S38` por interfaz y `B8b` la implementa; `B3` escribe la rama de sucesión de `S1` sin ruta y `B8b` a …(cortado)
- **define** *(archivo generado desde la fuente: ya regenerado sobre 17f9702675)*: `DEC-METH-019` (ACCEPTED) — vieja `D/01-decision-log.md:7896` → nueva `D/01-decision-log.md:7978` — cambio: {+1)**, sobre los puntos 7 y 8. **BK**:**el punto 7 (AI) se amplía a tres familias de texto `DEC-MIG-002`, `DEC-DATA-002` y `DEC-MP-003`), las precisadas *«por otra decisión»* de la fila del resumen (siete pares, con el *«cinco consumidores»* del cuerpo de `DEC-DATA-004`) y la fila `EX-46` de la matriz. Cada una lleva un veredicto `PARCIAL` con cita y hash, la consolidada omite lo muerto con «[…]» y su nota, y el owner revisa sólo lo que cambia el sentido de una regla, como en AI; el log y la matriz siguen sin editarse (implicaciones 1 y 4). **BS**: **los detalles que las fuentes dejan a la i …(cortado)

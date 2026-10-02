# Abiertos del grupo g2 (núcleo y contrato)

Huecos que encontró el grupo g2 al escribir `02-nucleo*.md` y `03-contrato-de-cobertura.md`. Sin
letra: las asigna el orquestador.

---

### La prosa sin ítem de inventario no cuenta para la red R17

**Qué falta**: el núcleo y el contrato tienen secciones que ningún ítem de inventario define: el
índice del núcleo, el glosario entero, el método del modelo de datos, las reglas de las máquinas, el
outbox, la auditoría fuera del catálogo de acciones y las 34 secciones vivas del contrato. Están
traídas enteras en `02-nucleo.md` (§1), `02-nucleo-glosario.md`, `02-nucleo-modelo-y-maquinas.md`,
`02-nucleo-outbox.md`, `02-nucleo-auditoria.md` y `03-contrato-de-cobertura.md` (§0 a §7.1), cada
sección con su línea `Origen:`. Pero esas líneas no están dentro de un bloque anclado, y `trazar.py`
sólo recoge para R17 los `Origen:` de bloques anclados. Por eso esas secciones dan «sección sin ninguna
línea citada» aunque estén en la spec. R5 prohíbe además anclar un `SEC`.

**Afecta**: R17 sobre `nucleo/00`, `01`, `02`, `03`, `07` y `08` (salvo las secciones con `INV`,
`ACC` o `PLAZO`) y sobre `12-contrato-de-cobertura.md`, unas 120 secciones `SEC`.

**Por qué las fuentes no lo deciden**: `spec-consolidada/scripts/trazar.py`, función `bloques` (sólo
recorre el cuerpo de cada `<a id>`) y regla R5 (un ancla que no es ítem ni US/AC/TEST es «inventada»).
Ni `DEC-METH-019` ni sus 📌 dicen cómo se cita la prosa que no es ítem.

**Pregunta al owner/orquestador**:

1. **Que R17 cuente toda línea `Origen:` de la spec, anclada o no.** Costo: un cambio de una línea en
   `bloques` (recoger `ORIGEN` sobre el archivo entero). Riesgo: bajo, porque R6 sigue mirando sólo
   los bloques de ítem. **Recomendada.**
2. Permitir anclas `sec-…` exentas de R5. Costo: unas 120 anclas artificiales. Riesgo: confundir
   prosa con ítems.
3. Dejar R17 en rojo para la prosa. Riesgo: la red deja de servir justo donde no hay ítems, que es
   donde más se pierde.

Ejemplo: el §4.1 del contrato dice qué contesta `puedeCobrarle` cuando Juan, anfitrión de una cabaña en
Colón que se suscribió al Básico la semana siguiente al corte, pide la baja de su cuenta. Ese § está en
la spec, y R17 lo reporta como perdido.

---

### Los valores de los cinco plazos sin valor escrito

**Qué falta**: el valor inicial de `PLAZO:3` (el `N` de `PB5`, archivado de un borrador), `PLAZO:4`
(los dos avisos previos de retención), `PLAZO:7` (el techo de días de prueba acumulados, por vertical),
`PLAZO:8` (la postulación de Partner atrasada) y `PLAZO:9` (la espera entre un rechazo y una postulación
nueva). Las fuentes deciden **cuándo** se fijan (antes del merge de `V6`) y que la migración estructural
del corte falla si alguno está vacío. No dicen **cuánto**.

**Afecta**: `PLAZO:3`, `PLAZO:4`, `PLAZO:7`, `PLAZO:8` y `PLAZO:9`, y por ellos `V6` (crea la versión 1
de los plazos de verticales, owner BD), `V4`, `V7`, `V9b` y la migración estructural del paso 3 del
corte.

**Por qué las fuentes no lo deciden**: `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:175`,
`:176`, `:179`, `:180` y `:181` dicen «sin valor escrito»; `:194` y el 📌5 de `DEC-DATA-008`
(`01-decision-log.md:7359`) fijan el momento; `41-corte-del-mvp/10-decisiones-del-owner.md:156` lo
deja en «Lo que la propuesta no pudo verificar (sigue abierto)», punto 2.

**Pregunta al owner**:

1. **Fijar los cinco valores ahora, en la spec consolidada, antes de que arranque `V6`.** Costo: una
   decisión del owner por plazo. Riesgo: bajo; se cambian después con la acción 22 sin adelantar fechas
   ya anunciadas. **Recomendada**: `V6` no puede cerrar su migración ni su e2e sin ellos.
2. Fijarlos en el PR de `V6`, como dicen las fuentes. Costo: nulo ahora. Riesgo: el PR de `V6` queda
   bloqueado esperando una decisión de producto.
3. Usar valores provisorios y corregirlos con la acción 22 antes del corte. Riesgo: un reloj arrancado
   con el valor provisorio conserva su versión y no se corrige.

Ejemplo: Juan deja un borrador de su segunda cabaña sin publicar. Sin `PLAZO:3`, `PB5` no tiene fecha
de archivado, y la migración del corte falla.

---

### No hay plantilla para los correos inmediatos a `SUPER_ADMIN`

**Qué falta**: la fila del catálogo de correos (outbox §6) para el correo inmediato a `SUPER_ADMIN`
cuando un `refund` de una revocación llega a `FAILED` por `RF5`. La auditoría dice que sale «su propio
correo, sin esperar la ventana», y el catálogo no tiene fila para él. Tampoco la tiene el correo
inmediato por `COBRO_DUPLICADO` (motivo 20), la otra mitad de la lista cerrada de la excepción.

**Afecta**: `02-nucleo-outbox.md` §6 y `02-nucleo-auditoria.md` §4.1, §4.2 y §6; `ACC:13`,
`TRANS:B:RF5` y `MOT:20`; la pieza dueña de `DEC-OBS-001`, que según `cobertura.json` es `B11`.

**Por qué las fuentes no lo deciden**: `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:518`
(«con qué plantilla sale ese correo inmediato: es del catálogo del cap. 07 §6, que no tiene fila para
él»). En el catálogo, `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:255-286`,
ninguna fila tiene a `SUPER_ADMIN` como destinatario.

**Pregunta al owner**:

1. **Agregar dos filas al catálogo**, *«reembolso de revocación fallido»* y *«cobro duplicado
   detectado»*: transaccionales y no suprimibles, con destinatario `SUPER_ADMIN` y envío al producirse
   el evento. Costo: dos filas y su plantilla. Riesgo: bajo. **Recomendada**: la lista cerrada de la
   excepción ya existe y sólo le falta el canal escrito.
2. Una sola fila genérica, *«evento grave»*, para toda la lista cerrada. Costo: menor. Riesgo: el texto
   no dice qué hacer en cada caso.
3. Dejarlo al implementador. Costo: nulo ahora. Riesgo: se implementa sin texto revisado, o no se
   implementa.

Ejemplo: a Juan le otorgan un grant que después se revoca, y el reembolso del período que pagaba falla
en el proveedor. Con la opción 1, `SUPER_ADMIN` recibe en el acto un correo que dice qué `refund`
falló, de quién y por cuánto.

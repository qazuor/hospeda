---
title: "FASE 8 vuelta 3 · C2 — liberación, coexistencia y migración"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 8
---

# FASE 8 vuelta 3 · C2 — liberación, coexistencia y migración

Ataqué el corte y la liberación: el orden completo del `16-fase-7-del-paraguas.md` §4.2 (pasos 0 a
6), la rama de aborto, el §4.3 (lo que no resuelve), el congelamiento de `staging` del §4.4, la
limpieza del principio del §4.6 y las herramientas del corte; las dos mitades del capítulo 21
(`V/21` y `B/21`), y de `B/09` sólo lo que toca el manifiesto de sondas. Recorrí cada paso
preguntando qué pasa si falla a la mitad o se corre dos veces, qué queda en producción entre uno y
otro, qué hace el proveedor mientras tanto y qué le queda a la cartera existente al día siguiente.
Contra el código actual verifiqué que ningún cron del sistema viejo crea un preapproval durante la
ventana del 1b al 3. Medí contra el HEAD `923b23586b` del worktree
`hospeda-spec-hos-1352-billing-redesign`.

Son **9 hallazgos**: **0 CRITICA, 4 ALTA, 4 MEDIA y 1 BAJA**. La idea más grave: el diseño cuida
mucho la rama de aborto hasta el 4b, pero hay dos restauraciones de la base y un redespliegue que
no respetan su propia regla. El backup del paso 6 se restaura con las altas del sistema nuevo ya
abiertas. La rama de aborto no cuenta los avisos que el receptor nuevo ya confirmó. Y después de
un aborto, `main` sigue teniendo el sistema nuevo adentro.

Regla de lectura: cada hallazgo se apoya en una cita textual copiada literal de una sola línea del
archivo, con su `archivo:línea` (rutas relativas a la raíz del worktree).

## CRITICA

Ninguno.

## ALTA

### F-8V3C2-001 — El backup del paso 6 se restaura encima de las altas que abrió el paso 5

**Qué se rompe.** El paso 5 abre las altas del sistema nuevo. El 5b y el 6 corren después, y si el
6 falla, se restaura su backup, que es la base entera tal como terminó el 5b. Todo lo que el sistema
nuevo escribió entre ese backup y la restauración se pierde: suscripciones, preapprovals vinculados,
pruebas arrancadas. Los preapprovals siguen vivos en el proveedor. Es justo lo que el paso 5 dice
que el orden evita («nunca restaura un backup encima de un preapproval vivo»), pero esa garantía
cubre sólo la rama de aborto, no la restauración del paso 6. Nada cierra las altas ni la ruta de
avisos durante el paso 6, y ningún detector lista las filas perdidas.

**El camino.**

1. El paso 5 abre las altas a las 14:00. Juan, un cliente nuevo, contrata a las 14:20. El sistema
   nuevo crea su `subscription` y el preapproval, con el `id` de la fila como
   `external_reference`, y Mercado Pago lo autoriza.
2. A las 14:10 se había tomado el backup del paso 6. A las 14:40 falla la reescritura de la tabla
   de migraciones y se restaura ese backup.
3. La fila de Juan ya no existe. En el proveedor, su preapproval sigue `authorized`.
4. Juan ve que no tiene suscripción ni cobertura, aunque autorizó el débito. Nadie le avisa.
5. Semanas después llega el primer cobro. El handler no encuentra la fila que nombra el
   `external_reference`, escribe una lápida de recepción, manda cancelar y propone devolver. Ése
   es el primer momento en que alguien del lado de Hospeda se entera.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:143`
  — "abrir las altas del sistema nuevo: se levanta la regla del borde que las tuvo cerradas desde el despliegue"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:143`
  — "así que la rama de aborto nunca restaura un backup encima de un preapproval vivo"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:145`
  — "Si algo falla, se restaura el backup de este paso, que deja la base igual a como terminó el 5b"

**Qué haría falta decidir o escribir.** Si el paso 6 corre con las altas y la ruta de avisos
cerradas en el borde, como el tramo del paso 3 al 5. Si no, qué hace la restauración con lo que el
sistema nuevo escribió entre el backup y la falla, y con qué se detecta.

### F-8V3C2-002 — La rama de aborto no cuenta los avisos que el receptor nuevo ya confirmó

**Qué se rompe.** El paso 4 abre la ruta de avisos, y la rama de aborto cubre hasta que termina el
4b. En cuanto se abre la ruta, llegan juntos todos los reintentos que el Worker rechazó con `500`
durante el cierre, incluidos los cobros en vuelo del 1b. El receptor nuevo los asienta sobre las
lápidas y los confirma, así que Mercado Pago deja de reintentarlos. Si después el 4b no termina (su
entrega IPN depende de un pago real), la rama de aborto restaura el backup del 2b: los `payment`
asentados desaparecen, y el viejo, redesplegado, nunca recibe esos eventos. El detector posterior
al corte no corre, porque el corte no terminó. La rama enumera lo que el corte cambió afuera de la
base y afirma que no hay nada más, pero un aviso confirmado es un efecto externo sin inverso.

**El camino.**

1. Juan es uno de los tres `trialing`. El 1b cancela su preapproval, pero su primer cobro ya estaba
   en vuelo, y Mercado Pago lo aprueba mientras la ruta está cerrada por el Worker.
2. El paso 4 escribe las lápidas y abre la ruta. Llega el reintento. El handler nuevo asienta el
   `payment` sobre la lápida de Juan, contesta `200`, y Mercado Pago no vuelve a mandarlo.
3. En el 4b, la entrega IPN del pago chico no aparece. El 4b no termina y se aborta.
4. Se restaura el backup del 2b: no queda ni la lápida ni el `payment`. Se redespliega la imagen
   vieja, que nunca vio ese cobro.
5. El guion del aborto le pide a Juan re-suscribirse por el link reactivado. Mercado Pago le cobra
   en el acto, sin trial. Juan pagó dos veces, y del lado de Hospeda no hay registro del primer
   cobro ni lista que lo nombre.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:140`
  — "abrir en el borde la ruta de avisos que cerró el paso 3"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:137`
  — "El paso 3 termina cuando el despliegue está sano, el 3b y el paso 4 verificados y la sonda de la entrega del 4b cancelada"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:141`
  — "Como la sonda de Webhooks, sin la entrega vista el 4b no termina"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:390`
  — "públicas, por la misma razón: lo revalida el 4c** (FASE 9 vuelta 2, `F-8V2C2-006`). Fuera de esas dos no hay"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:398`
  — "viejo anotó entre el backup y la restauración se pierde, y no importa: tampoco se conserva"

La frase de la línea 398 habla de lo que anotó el viejo. Lo que asentó el nuevo con la ruta
abierta no lo nombra nadie: `rg -n "confirm" .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md`
sólo devuelve las líneas 131, 135 y 161, y ninguna es de la rama de aborto.

**Qué haría falta decidir o escribir.** Si la rama de aborto, antes de restaurar, lista los
`payment` asentados por el receptor nuevo (el mismo recorrido del detector del día siguiente) y
los suma a la lista de llamadas. O si el 4b se reordena para que su verificación no pueda fallar
con la ruta ya abierta.

### F-8V3C2-003 — Después de un aborto, `main` todavía tiene el sistema nuevo, y el próximo despliegue lo vuelve a subir

**Qué se rompe.** El paso 3 es la promoción `staging → main`. La rama de aborto «vuelve a desplegar
la imagen vieja», pero no dice nada de la rama `main`, que después del paso 3 tiene el sistema
nuevo y la migración que borra las tablas viejas de billing. El §4.4 sigue permitiendo hotfixes
«rama desde `main`», y en Coolify todo redespliegue construye desde la rama. El primer despliegue
de `main` después del aborto (un hotfix, o una variable de entorno que pide redesplegar) sube el
sistema nuevo sobre la base vieja restaurada y corre sus migraciones. Eso borra las tablas del
sistema que está cobrando, sin orden de corte, sin lápidas y sin nadie mirando. Es la convivencia
que el diseño dice que no existe.

**El camino.**

1. El paso 3 falla con la imagen nueva ya desplegada. Se aborta: se restaura el 2b y se redespliega
   la imagen vieja.
2. Juan se re-suscribe por el link reactivado. El viejo le crea su fila y su preapproval vivo.
3. Una semana después hay un hotfix urgente: rama desde `main`, PR a `main`, despliegue.
4. `main` tiene el sistema nuevo desde la promoción del paso 3. El despliegue corre sus migraciones
   y borra `billing_*`, con la fila de Juan adentro.
5. Llega el cobro de Juan. El receptor nuevo no conoce su preapproval: lápida de recepción,
   cancelación y propuesta de devolver. La suscripción que Juan acababa de pagar desaparece.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:462`
  — "La promoción `staging → main` es parte del corte: es lo que despliega el paso 3."
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:393`
  — "3 alcanzó a reemplazar la imagen**: se vuelve a desplegar la imagen vieja, se reencienden su"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:463`
  — "Los arreglos urgentes van a `main` como hoy**: rama desde `main`, PR a `main` y, después, el"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:542`
  — "cambia**: corre `main`, con el sistema viejo, hasta el paso 3 del corte (§4.4), y la rama de aborto"

Silencio: `rg -n -i "revert" .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md`
sólo devuelve las líneas 87 y 412, y ninguna habla de revertir la promoción a `main`.

**Qué haría falta decidir o escribir.** Si la rama de aborto revierte en git la promoción del paso
3 (y con qué commit, para que el siguiente intento del corte pueda volver a promover), y si el
redespliegue de la imagen vieja se hace desde esa rama revertida o desde una imagen guardada.

### F-8V3C2-004 — «El trial lo compensa» no es verdad para el anual, y el recuento de anuales no vuelve al owner

**Qué se rompe.** El owner aceptó (`G1-4`) que lo pagado en el sistema viejo por un período que el
corte corta se pierde. La declaración lo acota con dos cosas: una medición del 2026-09-17 («todas
mensuales») y la frase de que el trial nuevo «suele cubrir esos días». Pero el sistema viejo vende
anuales (preapproval de 12 meses), `DEC-MIG-002` las sigue tomando hasta el 0b, y el paso 0 las
cuenta sólo para fechar la segunda corrida del detector, declarando que el recuento «no es
condición del corte». Un anual pagado días antes del corte pierde casi doce meses de plata, contra
un trial de días. Eso no es lo que el owner aceptó con los números a la vista, y el guion le dice a
Juan que el trial lo compensa.

**El camino.**

1. En octubre, con `DEC-MIG-002` vigente, Juan contrata el plan anual del sistema viejo y paga un
   año.
2. En noviembre, el paso 0 cuenta una anual viva. El número sólo fecha la segunda corrida del
   detector: no para el corte ni vuelve al owner.
3. El 1b cancela el preapproval de Juan. Su pago de doce meses queda en el sistema viejo, que no se
   conserva.
4. El owner le dice, según el guion, que lo pagado no se devuelve y que el trial lo compensa. Juan
   recibe una prueba de días a cambio de once meses pagados.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:471`
  — "pagó un ciclo el 25/11 y ve el corte el 05/12 pierde los días que le quedaban, y el addon que"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:473`
  — "al publicar su ficha estrena el trial entero de un cliente nuevo (`V/21` §2.4), que suele cubrir"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:257`
  — "que tenga vigentes se pierden con el corte, y **el trial que estrena lo compensa de hecho**."
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:131`
  — "El anual del sistema actual es un preapproval recurrente con `frequency: 12` y `frequency_type: months`"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:131`
  — "No es condición del corte**: dice cuándo cae la segunda corrida y no cambia qué cubre la regla"

**Qué haría falta decidir o escribir.** Si una anual viva el día del corte vuelve al owner antes
del 1b, con el monto a la vista, como el recuento de `L8`. Y si la declaración de `G1-4` y el
punto 3 del guion se reescriben sin «suele cubrir» ni «lo compensa» para el anual.

## MEDIA

### F-8V3C2-005 — Entre el control del paso 2 y la migración del paso 3, el viejo sigue aceptando fichas

**Qué se rompe.** El 0b cierra sólo los canales que crean cobros. El sistema viejo sigue aceptando
cuentas y fichas hasta que se apaga su contenedor, en el paso 3. Los tres recuentos que protegen la
migración (Gastronomía y Experiencia en cero, cero seudónimos repetidos por vertical, cuántos
dueños tienen más de una `L8`) se toman en el 0 y el 2, no en el 3. El diseño reconoce la ficha que
nace «entre los dos recuentos», pero no la que nace después del segundo. Esa ficha llega a la
migración sin control: un seudónimo repetido tira la migración (y eso dispara el aborto, con los
clientes re-suscribiéndose sin trial), y una ficha de Gastronomía no tiene clase en la tabla de
traducción.

**El camino.**

1. El paso 2 da cero en los tres recuentos.
2. Mientras se toma el backup del 2b, Juan (que ya tiene una ficha publicada) crea una segunda
   cuenta con su Gmail con puntos y publica una ficha de alojamiento en el sistema viejo, que sigue
   corriendo.
3. El paso 3 apaga el contenedor viejo y corre la migración. La segunda cuenta de Juan es `L8` y su
   seudónimo choca con el de la primera en `UNIQUE(seudónimo, vertical)`. La migración se cae.
4. Se aborta. Los tres clientes cancelados se re-suscriben y pagan en el acto, sin trial.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:132`
  — "rechaza toda ruta del viejo que cree o re-autorice un preapproval, o cree una `Preference` o un pago en el proveedor"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:135`
  — "el recuento de cuentas de la cartera que comparten seudónimo en la misma vertical tiene que dar cero"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:216`
  — "nazca entre los dos recuentos. `DEC-MIG-002` sigue tomando altas, así que el cero es una medición que vence y"

**Qué haría falta decidir o escribir.** Si el 0b también cierra la creación de cuentas y fichas en
el viejo, o si los tres recuentos se repiten con el contenedor viejo ya apagado, antes de la
migración.

### F-8V3C2-006 — Un hotfix con migración durante el congelamiento puede hacer que producción saltee migraciones del paraguas

**Qué se rompe.** El §4.4 deja pasar hotfixes a `main` durante el congelamiento, con back-merge a
`staging`. Si un hotfix trae una migración y se aplica en producción antes del paso 3, las
migraciones del paraguas que se generaron antes (la de `U1`, por ejemplo, que es del principio de
la épica) quedan con una fecha de journal anterior a la última aplicada. El `db:migrate` del repo
es `drizzle-kit migrate` (código actual, `packages/db/package.json:40`), y su migrador aplica sólo
lo que tiene fecha posterior a la última aplicada. En `staging`, con la épica ya adentro, el orden
de aplicación es el inverso, así que el ensayo sale verde y producción no. *(Lo del migrador lo
derivé de su comportamiento conocido y lo marco: no pude leerlo en el código instalado.)* El diseño
no dice nada sobre migraciones en los hotfixes del congelamiento.

**El camino.**

1. La épica entra a `staging`, con la migración de la limpieza de `U1` fechada meses antes.
2. Durante el congelamiento sale un hotfix con una migración: PR a `main`, se despliega en
   producción, back-merge a `staging`.
3. El ensayo del corte en `staging` aplica todo y sale verde.
4. En el paso 3, producción saltea las migraciones del paraguas más viejas que el hotfix. Si
   entre ellas está la que escribe la prueba del corte, la ficha de Juan nace `PUBLISHED` sin
   prueba, y el reconciliador de cobertura se la baja.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:465`
  — "frena la promoción, no los hotfix."
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:464`
  — "back-merge `main → staging`, que es la excepción de hotfix que el repo ya tiene. El congelamiento"

Silencio: `rg -n -i "hotfix" .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md`
devuelve las líneas 296, 464, 465 y 468, y ninguna habla de migraciones.

**Qué haría falta decidir o escribir.** Si los hotfixes del congelamiento pueden traer migraciones,
y si no pueden, qué guard lo impide. Si pueden, cómo se re-fechan las del paraguas al entrar a
`staging`, y qué verifica el paso 3 sobre la tabla de migraciones aplicadas.

### F-8V3C2-007 — El manifiesto del 1b no tiene dónde vivir, y lo necesitan cosas que corren después de archivar el script

**Qué se rompe.** El script del corte produce el manifiesto del 1b: los ids cancelados, el pagador
de cada uno y los registros de cobro abiertos con su `expire_date`. El script «se archiva terminado
el corte», borrándolo en un commit. De ese manifiesto dependen las lápidas del paso 4 (B11) y la
fecha de la segunda corrida del detector, que en un anual cae hasta un año después. El diseño no
dice dónde vive el manifiesto (¿versionado con el script, con `payer_email` adentro?), ni quién
conserva la fecha, ni quién se acuerda de correr la segunda corrida. Para el aviso del owner sí
hay un recordatorio escrito.

**El camino.**

1. El 1b corre y produce el manifiesto con el id de Juan, anual, cuyo registro abierto vence dentro
   de once meses.
2. Una semana después del corte, `scripts/cutover/` se borra en un commit, como está escrito.
3. Once meses después nadie corre la segunda corrida, o no se sabe qué fecha era, porque la fecha
   salía de la re-verificación y el diseño no dice dónde quedó. Un cobro posterior de Juan que no
   abrió su marca queda sin confirmar.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:302`
  — "opera el corte, y **se archiva terminado el corte**. **Vive versionado en el repositorio, en"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:526`
  — "y otra vez el día siguiente al último `expire_date` (`RC-7`) de los registros de cobro que la"

Silencio: `rg -n -i "el manifiesto (vive|queda|se guarda)|dónde vive el manifiesto" <alcance>` no
devuelve nada.

**Qué haría falta decidir o escribir.** Dónde se guarda el manifiesto del 1b (y si se versiona con
datos personales), cómo sobrevive al archivo del script, y quién agenda la segunda corrida.

### F-8V3C2-008 — El handler lee un manifiesto de sondas dentro de las carpetas del programa, y esas carpetas salen al cerrar HOS-1352

**Qué se rompe.** El handler nuevo consulta el manifiesto de sondas de `mp-probes/` antes de
cancelar un preapproval desconocido, y `B/09` dice que el despliegue lo lleva consigo. Ese
manifiesto vive en `docs/mp-probes/` dentro de la carpeta de HOS-1352. Las carpetas del programa
salen del repositorio al cerrar HOS-1352, y lo que se queda se nombra (el decision log y la
matriz), pero `mp-probes/` no está entre esas cosas. Si la carpeta sale mientras una sonda sigue
viva, el despliegue siguiente no lleva el manifiesto. Una de dos: el handler falla al leerlo, o
cancela la sonda y la medición se pierde.

**El camino.**

1. El día del corte, la sonda de Juan-owner (una medición de reciclado) queda viva y en el
   manifiesto.
2. Se cierra HOS-1352 y el commit de cierre saca las carpetas del programa.
3. Hay un despliegue. Llega el cobro mensual de la sonda. El handler no encuentra el manifiesto, y
   según cómo se implementó falla o cancela la sonda: la medición abierta se pierde.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:112`
  — "tienen una medición abierta —enumerados en el manifiesto versionado de `mp-probes/`, que el"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/06-proveedor.md:384`
  — "| **dónde viven** | `docs/mp-probes/`, versionadas, marcadas como no productivas"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:539`
  — "anterior). **Los informes históricos del programa no**: salen del repositorio al cerrar HOS-1352"

**Qué haría falta decidir o escribir.** Si el manifiesto de sondas sale de `.specs/` a un lugar que
el código posea antes del cierre, y qué hace el handler si no lo encuentra.

## BAJA

### F-8V3C2-009 — `B/21` sigue diciendo que el corte no escribe filas de `trial`, y desde C12 sí las escribe

**Qué se rompe.** Desde C12, la migración del paso 3 escribe una prueba activa por cada `(dueño,
vertical)` con una `L8`. `B/21` §2.5 y §4 siguen afirmando, sin tachar, que del lado de verticales
el corte no escribe filas de `trial`. Quien implemente B11 leyendo sólo `B/21` hereda un inventario
de escrituras del corte que ya no es el real.

**El camino.**

1. Un implementador de billing arma el inventario de filas que escribe el corte leyendo `B/21`.
2. Lee que verticales no escribe filas de `trial` y deja afuera la prueba de Juan del recuento de
   filas nuevas que verifica después del paso 3.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:174`
  — "de billing, pero son cortesías vigentes, no rastro; y del lado de verticales el corte ya no escribe"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:410`
  — "**Verticales no escribe filas de `trial`**: el corte trata a los clientes actuales como nuevos y"

**Qué haría falta decidir o escribir.** Tachar y reescribir los dos pasajes con la prueba activa de
C12 (`V/21` §2.4, *«la prueba gratis que escribe el corte»*).

## Ataques que intenté y el diseño resistió

- **Un cron del viejo que cree un preapproval entre el censo del 1b y el apagado del paso 3,
  fuera del borde**: en el código actual, `recoverCancelledPreapproval` (el único que acuña un
  preapproval nuevo ante un `cancelled`) sólo lo llama la ruta `checkout-retry`, que el criterio del
  0b cierra. Los crons (`apply-scheduled-plan-changes`, `propagate-plan-price-changes`) sólo
  modifican el monto de preapprovals que ya existen. Ninguno crea.
- **Un cobro en vuelo que el viejo registró en la ventana y cuya tabla borra el paso 3**: lo lista
  la primera corrida del detector (lote P-B), que no distingue entre un evento perdido y un cobro
  que registró el viejo.
- **El reintento de un aviso emitido durante el cierre, que va a otra URL**: la URL no cambia en
  ningún paso, y el Worker contesta `500`, que Mercado Pago reintenta (`WH-4`).
- **Correr dos veces las herramientas del 3b, el 4, el 4c y el 5b**: cada una declara que saltea
  lo que ya escribió, y el 4 aborta ante un choque que no es suyo, mientras la rama de aborto
  todavía cubre.
- **Que salga una sola épica**: `DEC-ARCH-007` y el §4.4 hacen que la unidad desplegable sea el
  paraguas, y la promoción `staging → main` es el paso 3.

## Fuera de mi vector

- **Sondas del manifiesto que cobran**: `B/09` las trata sin cancelar, pero el párrafo de las
  sondas del §4.2 dice que cuelgan de una lápida de recepción sin decir que el handler no cancela.
  Coinciden, pero habría que leerlos juntos. Le toca al vector de conciliación.

## Key Learnings

1. Toda restauración de backup en el corte tiene que chequearse contra la misma regla que protege
   la rama de aborto («nunca encima de un preapproval vivo»), incluida la del paso 6, que corre con
   las altas abiertas.
2. Un aviso que el receptor ya confirmó es un efecto externo sin inverso: Mercado Pago no lo vuelve
   a mandar. La lista de lo que el corte cambió afuera de la base tiene que incluirlo.
3. Revertir en producción es también revertir la rama: con Coolify construyendo desde `main`, el
   aborto sin revertir la promoción deja una convivencia latente.
4. Una declaración aceptada puede esconder un daño más grande si se acota con una medición que ya
   venció, como «todas mensuales» frente a un anual.

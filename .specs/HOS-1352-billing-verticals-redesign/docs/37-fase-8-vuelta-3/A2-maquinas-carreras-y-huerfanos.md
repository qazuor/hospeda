---
title: "FASE 8 vuelta 3 · A2 — máquinas, carreras y huérfanos"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 8
---

# FASE 8 vuelta 3 · A2 — máquinas, carreras y huérfanos

Recorrí las tres máquinas de verticales de `V/03` (trial `T1`–`T8`, publicación `PB1`–`PB13` y
postulación `PP1`–`PP3`), la presencia de Partner sin máquina (`V/18` §1.6), el reloj de
inactividad con sus hechos y sus lectores (`NUCLEO/01` §1.2, `V/02` §2.5 y §4), la pregunta
`retenciónDetenida` y el aviso de cobertura (`12-contrato…` §3 y §4.1), el reconciliador diario de
cobertura, los locks por `user + vertical`, la lista cerrada de lo que cuelga de una ficha en
`PURGED`, el vínculo de Partner (`V/02` §2.7) y la escritura de la prueba del corte (`V/21` §2.4
contra `16-fase-7…` §4.2). Crucé cada tabla contra los eventos que emiten el contrato y el
núcleo. Medí contra el HEAD `923b23586b` del worktree
`hospeda-spec-hos-1352-billing-redesign`.

Son **8 hallazgos**: **0 CRITICA, 2 ALTA, 4 MEDIA y 2 BAJA**. La idea más grave: la prueba gratis
que el corte escribe en el paso 3 necesita el plan de trial y sus días, que nacen recién en el
paso 3a; y el diseño supone una sola presencia de Partner por suscripción sin que nada impida que
un usuario tenga varias, así que un Gold paga una y enciende todas.

Regla de lectura: cada hallazgo se apoya en una cita textual copiada literal de una sola línea del
archivo, con su `archivo:línea` (rutas relativas a la raíz del worktree).

## CRITICA

Ninguno.

## ALTA

### F-8V3A2-001 — La prueba del corte se escribe antes de que exista el plan del que sale

**Qué se rompe.** La migración estructural del paso 3 escribe una fila de `trial` en
`TRIAL_ACTIVE` a cada dueño con una ficha `L8`, con el plan de trial derivado de la versión vigente
y vendible, las versiones vigentes al arrancar y un fin calculado con los días de prueba. Pero el
catálogo de producción (planes vendibles, plan de trial, pre-trial y piso con sus versiones) lo
carga el paso 3a, que corre **después** de la migración estructural. Y los días de prueba no son un
plazo de la versión 1 de plazos que el paso 3 sí crea antes: cuelgan de la versión de plan. En el
paso 3 no hay de dónde derivar ni el plan ni el fin. Un implementador hace fallar la migración y
aborta el corte; otro escribe la fila con referencias o fin vacíos, y una prueba sin fin no la
vence nunca `T3`: cobertura gratis y perpetua sobre toda la cartera.

**El camino.**

1. Juan tiene un alojamiento `ACTIVE` + `PUBLIC` el día del corte (clase `L8`).
2. Paso 3: la migración estructural le escribe su prueba activa, que arranca en ese instante.
3. Para escribirla tiene que leer la versión vigente y vendible de Alojamiento y los días de
   prueba de su plan de trial. Esas filas todavía no existen: las escribe el 3a.
4. Rama A: la escritura falla y el corte entra en la rama de aborto en el paso 3, con todo el
   operativo del día (cancelaciones del 1b ya hechas) a rehacer.
5. Rama B: el implementador deja nulos el plan y el fin para completarlos después, y ningún texto
   dice quién los completa. `T3` espera *«llega la fecha de fin»* y no llega nunca: Juan queda en
   `TRIAL_ACTIVE`, cubierto, con su ficha publicada, sin pagar jamás.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:137`
  — "y la prueba gratis activa de cada dueño con una ficha a la vista, que arranca en ese instante"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:138`
  — "por vertical, los planes vendibles, el de trial, el de pre-trial y el de piso con sus versiones"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:138`
  — "corren en el carril de datos del despliegue, después de la migración estructural y antes de que arranque el proceso nuevo"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:384`
  — "trial derivado de la versión vigente y vendible, las versiones vigentes al arrancar (el piso del"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:385`
  — "trinquete), inicio en el instante del corte y fin a los días de prueba de la vertical, y el"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:389`
  — "en la migración estructural del paso 3, una sola vez, como la"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/11-trial.md:393`
  — "los días de prueba cuelgan de la versión y no son un plazo de la lista del §1.5"

**Qué haría falta decidir o escribir.** En qué paso se escribe la prueba del corte: después del 3a
(con su propio control de *«una sola vez»* y su lugar admitido por los guards que enumeran los
escritores de `trial`), o si el catálogo sube a la migración estructural, como ya se hizo con la
versión 1 de los plazos. Y qué pasa si el paso que la escribe falla a mitad.

### F-8V3A2-002 — Un usuario puede tener varias presencias de Partner y una sola suscripción las enciende a todas

**Qué se rompe.** El diseño supone que Partner tiene una sola presencia por suscripción, y apoya en
eso el scope del addon que la agranda. Pero el modelo no lo hace cumplir: `partner.owner_user_id` es
una columna anulable sin unicidad, lo escribe el reclamo con la cuenta de la sesión, y la guarda de
`PP1` sólo impide una segunda `PENDIENTE` o una postulación dentro de la espera, no una segunda
aprobada. La lectura pública de la página y del carrusel pregunta por las claves del conjunto
efectivo, que se resuelve por `user + vertical`, y billing admite una sola principal viva por
`user + vertical`. Así que un Gold paga una suscripción y ve encendidas todas las páginas y todos
los lugares del carrusel de los partners que reclamó: se cobra de menos, sin nada que lo señale.

**El camino.**

1. Juan tiene dos negocios, A y B. Postula A con `a@juan.com` y B con `b@juan.com` (dos correos,
   así que la guarda de `PP1` no los relaciona).
2. El admin aprueba las dos (`PP2`): dos filas de `partner` con `owner_user_id` nulo.
3. Juan abre los dos links de reclamo con su misma sesión: las dos filas quedan con su `user_id`.
4. Juan contrata Gold una vez, que es la única principal que billing le deja tener en Partner.
5. La lectura de la página de A y la de B preguntan por *«página propia»* en el conjunto efectivo
   de Juan en Partner: las dos lo encuentran. El carrusel lista a los dos.
6. Juan paga un Gold y tiene dos. Un addon `VERTICAL_SUBSCRIPTION` de *«+10 fotos»* ya no
   identifica a cuál de las dos agranda.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/18-partner.md:76`
  — "presencia por suscripción, ese scope la identifica sin ambigüedad"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:582`
  — "`owner_user_id` es nulo hasta el reclamo y lo escribe sólo el acto de reclamar"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/18-partner.md:261`
  — "El reclamo exige sesión y vincula a la cuenta que reclama."
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:581`
  — "un índice único parcial sobre el correo en minúsculas donde el estado es `PENDIENTE`"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:835`
  — "es el alcance del cupo —la resolución de entitlements y limits es"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:156`
  — "a lo sumo UNA fila principal de origen viva por user + vertical"
- El código actual tampoco lo impide: `packages/db/src/schemas/partner/partner.dbschema.ts:229`
  declara `partners_ownerUserId_idx` como índice común, no único (código actual).
- El silencio, medido sobre el alcance:

  ```text
  rg -n -i "UNIQUE.*owner_user_id|owner_user_id.*unique|un solo partner|una presencia por usuario|un partner por (usuario|user|cuenta)" \
    $D/nucleo $V $B $D/12-contrato-de-cobertura.md $D/16-fase-7-del-paraguas.md
  (sin resultados)
  ```

**Qué haría falta decidir o escribir.** Si una cuenta puede ser dueña de más de un Partner. Si no,
qué lo impide (una unicidad sobre `owner_user_id` y qué contesta el reclamo cuando la cuenta ya
tiene uno). Si sí, cómo se cobra cada presencia, porque la suscripción es por `user + vertical`, y a
qué presencia apunta un addon de scope `VERTICAL_SUBSCRIPTION`.

## MEDIA

### F-8V3A2-003 — La moderación le cede el lugar de una ficha a otra, y el orden de vuelta deja de depender sólo del cupo

**Qué se rompe.** `MODERATED` no ocupa cupo. Cuando un admin modera una ficha publicada, el lugar
queda libre y la fila 2 del reconciliador diario de cobertura lo llena con la candidata que estaba
abajo por el excedente. Cuando el admin levanta la baja, `PB13` evalúa `PB3` sólo para esa ficha:
el cupo ya está lleno, así que queda en `UNPUBLISHED_BY_BILLING`, y ninguna fila la vuelve a
comparar con la que ocupó su lugar, porque el reconciliador sólo corre `PB3` cuando hay menos
publicadas que el cupo. El resultado depende de la historia de moderación y no del cupo, que es lo
que el criterio de *«cuáles vuelven»* declara garantizar.

**El camino.**

1. Juan tiene cupo 2: A publicada en enero, B en febrero, y C abajo por el excedente de un
   downgrade.
2. Un admin modera A por una foto (`PB10`). A deja de contar para el cupo.
3. Al día siguiente el reconciliador encuentra una publicada menos que el cupo y candidatas: corre
   `PB3` sobre C, que queda publicada.
4. Juan arregla la foto; el admin levanta la baja (`PB13`). `PB3` adentro encuentra el cupo lleno:
   A queda en `UNPUBLISHED_BY_BILLING`.
5. A, la más vieja y la que el criterio pondría primero, queda abajo mientras dure el cupo. Si
   nunca la hubieran moderado, estarían publicadas A y B.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:912`
  — "conjunto que queda publicado depende sólo del cupo y no del camino"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:929`
  — "`MODERATED` tampoco: no está en el `desde` de `PB3` ni"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:1163`
  — "menos fichas en `PUBLISHED` que el cupo, y candidatas en `UNPUBLISHED_BY_BILLING` o en `ARCHIVED`"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:494`
  — "si no, queda `UNPUBLISHED_BY_BILLING` y vuelve sola por `PB3` cuando la cobertura o el cupo vuelvan"

**Qué haría falta decidir o escribir.** Si una ficha moderada que venía de `PUBLISHED` reserva su
lugar, si `PB13` entra a la misma cola ordenada que `PB3` y `PB7` (y desplaza a la más reciente),
o si se acepta y se declara que la moderación puede reordenar lo que queda a la vista.

### F-8V3A2-004 — El pedido de arreglo cuelga de la ficha y no está en la lista cerrada de `PURGED`

**Qué se rompe.** `pedido_de_arreglo` es una tabla nueva que nombra una ficha. La lista de lo que
cuelga de `listing` y qué le pasa en `PURGED` se declara cerrada, con sus 40 tablas nombradas una
por una, y exige que toda tabla nueva entre en el mismo acto. El pedido no entró. Sólo lo cierra la
acción administrativa de moderar, así que tras un `PB12` (el dueño borra la ficha moderada con un
pedido abierto) o un `PB9`, el pedido queda abierto sobre una ficha que no existe, con su fecha
sugerida vencida para siempre en el listado de arreglos pendientes. Y si el admin lo cierra, el
correo de *«moderación levantada»* le dice al dueño a dónde volvió una ficha que se borró. Dos
implementaciones lo resuelven distinto: `G-R9` en rojo, o un tratamiento inventado.

**El camino.**

1. Un admin le abre a Juan un pedido de arreglo sobre la ficha A, y después la baja (`PB10`, el
   pedido sigue abierto).
2. Juan borra A (`PB12` desde `MODERATED`): el contenido se borra y A queda en `PURGED`.
3. Nada cierra el pedido: el listado de pendientes muestra un arreglo vencido sobre A.
4. El admin lo cierra para limpiar el listado: sale el correo de *«moderación levantada»*, que
   dice a dónde volvió la ficha.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:738`
  — "una tabla nueva que cuelgue de `listing` entra acá en el mismo acto, con"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:739`
  — "la columna de tablas nombra hoy las 40, una por una"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:431`
  — "Lo abre y lo cierra sólo la acción administrativa de moderar"
- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:259`
  — "Dice a dónde volvió la ficha y, si volvió a borrador, que publicarla es suyo."
- El silencio: `rg -n "pedido" .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md`
  da la línea 431 y otras dos que no son esta tabla; ninguna dentro de la lista de las líneas 726 a
  736.

**Qué haría falta decidir o escribir.** La fila del pedido en la lista cerrada: si `PURGED` lo
cierra en el mismo acto (y sin qué correo), si se conserva abierto o cerrado como registro, y
cómo lo ve el listado del panel.

### F-8V3A2-005 — El borrado externo de `PB9` y `PB12` no tiene orden ni reintento, y lo que falla queda sin fila que lo nombre

**Qué se rompe.** `PB9` y `PB12` borran las fotos también en el almacenamiento externo y revocan el
token de calendario en el proveedor. Por la regla 3 del núcleo esos efectos remotos no van dentro
de la transacción, y el diseño declara que ningún hecho de verticales tiene transporte durable.
Nada dice en qué orden van respecto del commit ni qué pasa si el almacenamiento o el proveedor
fallan. Si van después del commit, un fallo deja las fotos en el almacenamiento con sus filas de
medios ya borradas (el riesgo que el propio corte nombró al no partir el 5b en dos) y el token vivo
en el proveedor, sin nadie que lo reintente ni lo detecte. Si van antes, una transacción que no
confirma deja una ficha no borrada sin fotos.

**El camino.**

1. Juan borra su ficha A (`PB12`). La transacción confirma `PURGED` y borra `accommodation_media`.
2. La llamada al almacenamiento externo devuelve un error transitorio.
3. Ningún outbox ni reintento lo toma: las fotos de la casa de Juan siguen servidas por su URL, y
   ya no hay fila que las nombre para volver a borrarlas.
4. Lo mismo con el token de calendario si el proveedor está caído: sigue vivo del otro lado, que
   es lo que `G1-5` quería evitar.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:59`
  — "proveedor, el correo— nunca están dentro de esa transacción"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:708`
  — "«Fotos» incluye su copia en el almacenamiento externo."
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:734`
  — "se desconecta: su token se revoca en el proveedor y se borra"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:808`
  — "el outbox del núcleo es de correos, y ningún hecho de verticales"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:254`
  — "porque las fotos quedarían sin fila que las nombre."
- El silencio, medido sobre el alcance:

  ```text
  rg -n -i "fotos[^.]*(reintent|si falla|falla)|token[^.]*(reintent|si falla|falla)" \
    $D/nucleo $V $B $D/12-contrato-de-cobertura.md $D/16-fase-7-del-paraguas.md
  (sin resultados)
  ```

**Qué haría falta decidir o escribir.** El orden entre el commit de `PURGED` y los dos borrados
remotos, qué se guarda para poder reintentarlos (una lista de objetos pendientes, por ejemplo) y
quién detecta el que quedó colgado.

### F-8V3A2-006 — El hecho 5 lo escribe un recálculo sin lock, y `PB9` puede borrar antes de que llegue sin que se pierda ningún aviso

**Qué se rompe.** Sobre una ficha no publicada el hecho 5 lo escribe el recálculo que el aviso
despierta, sin transición y sin el lock por `user + vertical`. `PB9` relee todo dentro del lock,
pero el lock no lo ordena contra esa escritura. Una ficha archivada de un dueño cubierto tiene el
reloj hasta en 180 días, porque `PB9` lo reinicia recién al releer, y los avisos previos no le
salieron porque estaba cubierto. Si la cobertura cae y `PB9` corre en la ventana entre el commit de
billing y el recálculo, relee `cubierto` falso con el reloj viejo y borra. El ⚠️ del reconciliador
declara que adelantar un borrado *«necesita un aviso perdido»*; este camino no lo necesita, sólo
un consumidor atrasado. Es un borde de ventana, por eso MEDIA.

**El camino.**

1. Juan paga Básico y tiene la ficha A en `ARCHIVED` porque no le entra en el cupo. `PB9` la
   encontró cubierta hace 179 días y reinició el reloj; ningún aviso previo le salió.
2. La suscripción de Juan pasa a `SUSPENDED` por impago. Billing confirma y emite el aviso.
3. Antes de que el recálculo escriba el hecho 5 en A, corre el job de `PB9`: toma el lock, relee
   `cubierto` falso, `retenciónDetenida` no y el reloj en 180 días, y borra.
4. Juan regulariza a la semana: A está en `PURGED`, sin haber recibido nunca el aviso previo al
   borrado.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:58`
  — "sobre las que no estaban publicadas lo escribe el recálculo que el mismo aviso despierta"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:1231`
  — "`ARCHIVED` de un dueño cubierto puede tener hasta 180 días, porque `PB9` lo reinicia al"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:1217`
  — "y el único que puede adelantar un borrado"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:1218`
  — "—el punto 1— necesita un aviso perdido"
- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:255`
  — "Los dos previos releen la cobertura del `user + vertical` antes de salir, y no salen si está cubierto"
- El silencio sobre el lock del recálculo:

  ```text
  rg -n "recálculo[^.]*lock|lock[^.]*recálculo" \
    $V/docs/03-maquinas-de-estado.md $D/nucleo/01-glosario.md $V/docs/02-modelo-de-datos.md
  (sin resultados)
  ```

**Qué haría falta decidir o escribir.** Si el recálculo que escribe el hecho 5 toma el mismo lock
que `PB9`, o si `PB9`, además de releer `cubierto`, exige que el reloj sea posterior a la última
pérdida de cobertura. Y corregir la declaración del ⚠️ para que nombre el aviso atrasado.

## BAJA

### F-8V3A2-007 — Quedan cuentas de *«seis hechos»* después de que el 4 salió

**Qué se rompe.** La lista de hechos que reinician el reloj volvió a cinco con la revisión del
owner del 2026-09-28 (C8), y tres renglones siguen diciendo seis sin tachar.

**El camino.**

1. Quien implementa `G-R6-B` mitad *(a)* lee `NUCLEO/07` §2 y `V/02` §2.5 para armar la lista de
   escritores admitidos.
2. Encuentra *«seis hechos»* y busca el sexto que falta, o admite el 4 retirado como escritor.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:100`
  — "seis hechos del §1.2 del cap. 01 (el quinto, FASE 8 completa,"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:463`
  — "seis del cap. 01 §1.2 le pone el instante en que ocurrió, y la"

**Qué haría falta decidir o escribir.** Llevar esos renglones a *«cinco»*, como el resto.

### F-8V3A2-008 — Cuatro renglones describen salidas que la revisión del owner ya cambió

**Qué se rompe.** Texto vencido sin tachar: dos dicen que de `MODERATED` sólo sale `PB11`, hacia
`DRAFT` (desde C10 existe `PB13`); uno dice que `T1` exige que la vertical admita altas (salió con
C8); y el paso 3b del corte dice que las fichas de las dos cuentas del owner nacen
`UNPUBLISHED_BY_BILLING` (desde C12 nacen `PUBLISHED`).

**El camino.**

1. Quien construye el reconciliador lee que `MODERATED` queda afuera porque sólo la saca `PB11`,
   y no cuenta con `PB13`, que la devuelve a `UNPUBLISHED_BY_BILLING`, que sí está en su población.
2. Quien opera el 3b espera ver subir por `PB3` fichas que ya estaban publicadas.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:1135`
  — "final; `MODERATED`, porque ninguna transición del sistema la saca de ahí —sólo un admin, con"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/11-trial.md:82`
  — "`MODERATED`, y de ahí sólo un admin la saca, a `DRAFT` (`PB11`; cap. 03 §9; `F-8CA2-004`, owner"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:291`
  — "plan de trial tiene días > 0—, `T1` le suma que la vertical admita altas (abajo; FASE 8 completa,"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:139`
  — "sus fichas nacen `UNPUBLISHED_BY_BILLING` como todas y el grant las sube por `PB3`"

**Qué haría falta decidir o escribir.** Tachar o reescribir esos cuatro renglones con la regla
vigente.

## Ataques que intenté y el diseño resistió

- **`T1` contra `T8`, o `T6` contra `T8`, escribiendo dos filas de `trial`**: el lock único de la
  máquina de trial y la publicación los ordena, y el `UNIQUE` del seudónimo convierte el choque en
  la guarda leída tarde (`V/03` §2).
- **Un canje que revive un trial vencido con el job de `T3` atrasado**: `T4` exige además la fecha
  de fin sin pasar, así que contesta `RECHAZADA` (`V/03` §2).
- **La baja desde una pausa que deja el reloj arrancado el primer día de la pausa**:
  `retenciónDetenida` devuelve `pausaTerminadaEn`, y `S22`, `S13`, `S6`, el espejo, `S20` y `S21`
  escriben `fin_real` (`B/03`), así que los lectores cuentan desde el fin real.
- **`PB5` archivando un borrador que `PB1` acaba de publicar**: los dos toman el lock y `PB5` relee
  su `desde` (`V/03` §9).
- **Una moderación larga que termina en archivado y borrado inmediatos**: `PB11` y `PB13` escriben
  el hecho 6 y reinician el reloj.
- **`PB7` sin el evento de archivado para una ficha del corte**: ninguna ficha del corte nace
  `ARCHIVED` (`L3` nace `DRAFT`), así que todo `ARCHIVED` tiene su evento de `PB4` o `PB5`.
- **Dos postulaciones simultáneas del mismo correo**: el índice único parcial sobre `PENDIENTE` lo
  impide en la base (`V/02` §2.7).
- **Algo que intente salir de `PURGED` o de `TRIAL_CONVERTED`**: ninguna fila los tiene en su
  `desde`, `extenderTrial` exige `TRIAL_ACTIVE`, y `PB3`/`PB7` no toman `PURGED`.

## Fuera de mi vector

- **La conversión de la prueba de las dos cuentas del owner en el 3b**: `V/21` afirma que `T2`
  convierte en el acto, pero eso depende de que la herramienta de B9 emita el aviso y de que el
  proceso nuevo lo consuma durante el corte; si no, la prueba vence sola y la campaña de
  recuperación les escribe a cuentas con grant. Son cuentas del owner, declaradas inofensivas; le
  toca al vector del corte.

## Key Learnings

1. El orden de los pasos del corte (3 contra 3a) es un lugar donde una escritura del corte puede
   depender de datos que todavía no existen; vale revisar cada escritura del paso 3 contra lo que
   carga el 3a.
2. Una propiedad afirmada en prosa (*«una sola presencia por suscripción»*) sin restricción en el
   modelo es un hueco de cobro cuando la suscripción es por `user + vertical`.
3. Las filas que liberan cupo por decisión nuestra (`PB10`) interactúan con el reconciliador
   diario: el lugar que liberan lo ocupa otra ficha y la vuelta no reordena.
4. Toda tabla nueva que nombre una ficha tiene que entrar a la lista cerrada de `PURGED`; el pedido
   de arreglo (C10) no entró.
5. Los efectos remotos de las filas irreversibles necesitan un orden y un reintento declarados,
   porque el outbox del núcleo es sólo de correos.

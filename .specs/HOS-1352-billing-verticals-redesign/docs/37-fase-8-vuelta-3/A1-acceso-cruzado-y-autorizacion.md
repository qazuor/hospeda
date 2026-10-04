---
title: "FASE 8 vuelta 3 · A1 — acceso cruzado y autorización"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 8
---

# FASE 8 vuelta 3 · A1 — acceso cruzado y autorización

Ataqué la cadena de autorización entera del cap. 17 de verticales (los siete pasos, sus ocho
precisiones, actor y sujeto, las cinco reglas del §3.2, el guest y el sistema como actores, el
criterio del §3.5 y la no revocación de roles), el reclamo del vínculo de Partner (cap. 18 §2.4,
`V/02` §2.7 y la máquina de postulación del cap. 03 §11), el caché del conjunto efectivo y su
invalidación (`V/02` §3), el pliegue por ficha de los addons `LISTING` y la validación de su
objetivo (`12-contrato…` §2.7 y §4.1), la tabla de acciones administrativas y la baja de cuenta
manual con su seudonimización (`NUCLEO/08` §1.3 y §3, `V/02` §2.4), y lo que el corte cambia en
las respuestas (`V/21` §4). Medí contra el HEAD `923b23586b` del worktree del programa.

Son **6 hallazgos**: **1 CRITICA, 2 ALTA, 3 MEDIA y 0 BAJA**. La idea más grave: el reclamo de un
Partner confía en que la sesión de la cuenta que tiene el correo es de quien lee la casilla, y en
la cuenta que creó un ocupante esa suposición es falsa, así que el ocupante termina operando el
Partner de la dueña real, con la tarjeta de ella cobrando.

Regla de lectura: cada hallazgo se apoya en una cita textual copiada literal de una sola línea del
archivo, con su `archivo:línea` (rutas relativas a la raíz del worktree).

## CRITICA

### F-8V3A1-001 — El reclamo verifica la cuenta del ocupante y el ocupante sigue adentro

**Qué se rompe.** La regla 2 del cap. 18 §2.4 dice que, si la cuenta que reclama es la del correo
y no lo tiene verificado, el reclamo lo verifica, porque *«esa persona es la de la sesión»*. Pero
el mismo § describe al ocupante: una cuenta que otro creó con esa dirección. El paso 2 del cap. 17
deja operar a una cuenta con el correo sin verificar (su lista cerrada), así que el ocupante tiene
sesión en esa cuenta. La dueña real, para tener sesión en ella, no tiene otro camino que recuperar
el acceso a una cuenta que no creó, y nada del diseño cierra las sesiones ni las credenciales
previas de esa cuenta al verificarla ni al reclamar. El Partner queda en una cuenta con dos
personas adentro. Y en cuanto el reclamo verifica el correo, la regla 3 deja de aplicar (es sólo
para *«un correo nunca verificado»*), así que el ocupante puede cambiar el correo y dejarla afuera.
Es el ataque que el § dice cerrar, entrando por la puerta de la sesión en vez de la del correo.

**El camino.**

1. Pedro, que quiere quedarse con la presencia del Hotel de María, se registra en Hospeda con
   `reservas@hotelmaria.com`. No puede verificarlo, pero su sesión queda viva: el paso 2 le deja
   verificar o cambiar el correo y leer lo suyo.
2. María postula su hotel con ese correo. El admin aprueba (`PP2`) y, como el correo ya es de un
   usuario, le manda a esa casilla el aviso para reclamar.
3. María abre el link, que le pide sesión. Intenta registrarse y el correo ya está tomado; usa
   *«olvidé mi contraseña»* sobre `reservas@hotelmaria.com` y entra a la cuenta de Pedro.
4. Reclama. Por la regla 2 el reclamo verifica el correo y `owner_user_id` queda en esa cuenta.
5. María configura Gold y su tarjeta; Mercado Pago autoriza el débito.
6. Pedro, que nunca perdió su sesión, ve el Partner en su pantalla. Con el correo ya verificado la
   regla 3 no lo frena: se cambia el correo a uno suyo. María no puede volver a entrar.
7. Pedro edita la página de María y ve su billing; Mercado Pago le sigue cobrando a la tarjeta de
   María.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/18-partner.md:264`
  — "2. Si la cuenta que reclama es la de ese correo y no lo tiene verificado, el reclamo lo"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/18-partner.md:265`
  — "verifica: el link llega sólo a quien lee la casilla, y esa persona es la de la sesión. Si"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/18-partner.md:257`
  — "usuario podía ser una cuenta que otro creó con esa dirección sin poder verificarla: la dueña de la"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:122`
  — "Lo que el paso 2 deja pasar con el correo sin verificar es una lista cerrada: verificar el"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/18-partner.md:268`
  — "3. Un correo nunca verificado no se cambia llevándose vínculos. Una cuenta con un vínculo de"
- Silencio sobre cerrar sesiones o credenciales previas al recuperar la cuenta o al reclamar:
  `rg -n -i "sesi[oó]n(es)? (abiertas|activas|previas|del ocupante)|cierra las sesiones|revoca.{0,20}sesi|contraseña|restablec|olvid"`
  sobre `$D/nucleo $V $B $D/12-contrato-de-cobertura.md $D/16-fase-7-del-paraguas.md` no
  devuelve ninguna regla de autenticación (sólo usos de *«olvidar»* en otro sentido).
- `apps/api/src/lib/auth.ts:498` (código actual)
  — "Account linking: if a user already exists with a given email and"

  *(la vinculación de cuentas por correo con Google y Facebook está activa; es una segunda vía
  por la que el ocupante conserva una credencial en esa cuenta.)*

**Qué haría falta decidir o escribir.** Si el reclamo que verifica una cuenta ajena al reclamante
original tiene que cerrar toda sesión y credencial previa de esa cuenta (o si el reclamo sobre una
cuenta nunca verificada tiene que ir a soporte, como el cambio de correo de la regla 3), y si la
regla 3 tiene que valer también durante un tiempo después de la verificación por reclamo.

## ALTA

### F-8V3A1-002 — El link de reclamo no vence y nada impide reclamar un Partner ya reclamado

**Qué se rompe.** `owner_user_id` es *«nulo hasta el reclamo»* y *«lo escribe sólo el acto de
reclamar»*, pero ningún texto dice que el reclamo exija que siga nulo, ni que el link sea de un
solo uso, y la `APROBADA` *«no vence»*. El reclamo vincula a la cuenta de la sesión de quien abra
el link. Leído a la letra, cualquiera que lea el correo del aviso después (una casilla compartida
del negocio, un ex empleado, un reenvío) reclama otra vez y mueve el Partner a su cuenta, con su
contenido; la suscripción que paga la dueña queda en la cuenta de ella, cobrando sin página.

**El camino.**

1. María reclama su Partner desde su cuenta y lo configura Gold con su tarjeta.
2. Juan, ex recepcionista, sigue teniendo acceso a `info@hotelmaria.com`, donde está el aviso.
3. Meses después Juan abre el mismo link con su propia cuenta. Nada dice que el vínculo ya
   escrito lo rechace: el reclamo escribe `owner_user_id` con la cuenta de Juan.
4. La página pública pregunta por la clave del dueño actual, Juan, que no la tiene: 404. Mercado
   Pago le sigue cobrando Gold a María, cuyo Partner ya no es suyo.
5. Juan contrata Gold y publica la página de María, con el contenido que ella cargó.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:582`
  — "`owner_user_id` es nulo hasta el reclamo y lo escribe sólo el acto de reclamar"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/18-partner.md:261`
  — "1. El reclamo exige sesión y vincula a la cuenta que reclama. El link llega a la casilla, y"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:1296`
  — "que el rechazo se comunique. Una `APROBADA` que nadie reclama tampoco vence, y es inofensiva: la"
- Silencio sobre un solo uso o vínculo ya escrito:
  `rg -n -i "reclam" $S | rg -i "uso|vence|expira|nulo|ya reclamad|segunda|otra vez|token|link"`
  sólo devuelve la definición de la columna, el panel y las líneas de arriba.

**Qué haría falta decidir o escribir.** Si el reclamo sólo escribe sobre `owner_user_id` nulo (y
qué ve quien abre un link ya usado), y si el link de reclamo vence o se consume.

### F-8V3A1-003 — La precisión 7 prohíbe escribir en lo que cuelga de una ficha ajena, y eso incluye mensajes y reseñas

**Qué se rompe.** La precisión 7 hace de *«lo ajeno existe sólo en estado público»* una lista
cerrada (ficha `PUBLISHED`, presencia de Partner) y declara que toda escritura sobre lo ajeno
contesta *«no existe»*, contando como escritura *«todo lo que muta el recurso o algo que cuelga de
él»*. `V/02` §2.5 dice que de la ficha cuelgan las reseñas y las conversaciones. A la letra, un
turista no puede mandarle un mensaje ni dejarle una reseña a una ficha publicada ajena, y la fila
28 del cap. 19 le promete leer entera su conversación sobre una ficha `PURGED`, que para él no
existe. Dos implementadores lo resuelven distinto: uno rompe la consulta y las reseñas, el otro
exime esas superficies, que es exactamente la *«exención por superficie»* que el §3.5 prohíbe, y
por ahí un borrador o una archivada ajena vuelve a responder distinto de *«no existe»* (un mensaje
aceptado sobre un borrador confirma que el identificador existe).

**El camino.**

1. Juan, turista, abre la ficha publicada de María y le escribe una consulta.
2. La conversación cuelga de la ficha; escribirla muta algo que cuelga de un recurso cuyo dueño no
   es Juan. La precisión 7 contesta *«no existe»*.
3. El implementador que quiere que la consulta funcione agrega una exención para conversaciones
   que no mira el estado de la ficha.
4. Juan prueba identificadores de fichas en borrador de otros: la exención le acepta el mensaje
   sobre una ficha que el paso 4 declara inexistente, y así confirma cuáles existen y le escribe
   al dueño de una ficha que nadie publicó.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:205`
  — "misma respuesta de la precisión 1, sin una segunda. Es escritura todo lo que muta el recurso o"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:206`
  — "algo que cuelga de él: editar la ficha o su contenido, subir fotos, despublicarla, y comprar"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:193`
  — "sólo si está en un estado público, y la lista es cerrada: una ficha en `PUBLISHED`, y una"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:440`
  — "FAQ, reseñas, conversaciones— sigue colgando de la misma fila, y su lista cerrada está en el"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:75`
  — "y la conversación en sólo lectura: se ve entera y no admite mensajes nuevos"

**Qué haría falta decidir o escribir.** Si las conversaciones y reseñas son un recurso con dueño
propio (el turista) fuera de la precisión 7, o una escritura del turista sobre la ficha con su
propia regla de estado, y cuál es la respuesta sobre una ficha no pública.

## MEDIA

### F-8V3A1-004 — «Sin acceso» tras la baja no tiene dato, y el paso 2 ya no mira nada que lo sostenga

**Qué se rompe.** La acción 24 deja la cuenta seudonimizada *«sin acceso»*, pero el paso 2 del
cap. 17 quedó en una sola verificación (el correo sin verificar), y la razón con que se sacó
*«inhabilitado»* fue justamente que no tenía columna. *«Sin acceso»* repite ese defecto: no hay
columna, estado ni verificación de la cadena que lo lea. Las sesiones se cierran, pero la
vinculación con Google del código actual sobrevive a que se reemplace el correo, y con ella Juan
vuelve a entrar a la cuenta dada de baja, con sus roles intactos (el §4.1 no los revoca). Si el
correo seudonimizado queda verificado, pasa el paso 2 y contrata, con los avisos previos al cobro
yendo a una dirección falsa; si no, dos implementaciones dirán cosas distintas.

**El camino.**

1. Juan, que entraba con Google, pide la baja; soporte corre los tres pasos y la acción 24
   reemplaza su correo y cierra sus sesiones.
2. Días después Juan toca *«Entrar con Google»*. La cuenta de Google sigue vinculada a su fila de
   `user`, que no se borró: obtiene sesión.
3. El paso 1 lo autentica y el paso 2 sólo pregunta por el correo sin verificar. Nada pregunta si
   la cuenta está dada de baja.
4. Juan contrata un plan; el aviso previo al cobro sale hacia el correo seudonimizado.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:412`
  — "nombre, el correo y el teléfono reemplazados, las sesiones cerradas y sin acceso, y la fila de"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:51`
  — "escribiera, y un control sin dato es peor que ninguno porque cada implementación lo llena distinto."
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:608`
  — "Perder el acceso NUNCA revoca un rol. Ni la suspensión por impago, ni el vencimiento del"
- `apps/api/src/lib/auth.ts:471` (código actual)
  — "'HOSPEDA_GOOGLE_CLIENT_SECRET is required when HOSPEDA_GOOGLE_CLIENT_ID is set'"
- Silencio: `rg -n -i "google|oauth|sin acceso|banned"` sobre el alcance sólo devuelve la línea
  de arriba y la fila de la acción 24; ningún capítulo dice qué credenciales borra la baja ni qué
  paso rechaza a una cuenta dada de baja.

**Qué haría falta decidir o escribir.** Qué dato marca una cuenta dada de baja, qué paso de la
cadena lo lee, y si la baja borra las credenciales vinculadas (proveedores externos, contraseña).

### F-8V3A1-005 — El guest falla en el paso 1 y la postulación de Partner la escribe «alguien»

**Qué se rompe.** El paso 1 rechaza al guest salvo en una lectura pública, y el §3.5 dice que
toda operación corre la resolución, sin exentas. `PP1` es una escritura (crea una fila y la
guarda es una restricción de la base) que dispara *«alguien completa el formulario»*, y el
cap. 18 dice que el formulario es público. O la postulación exige cuenta (y la rama *«el correo no
corresponde a ningún usuario»* del §2.4 pierde a su población), o se la exime por superficie, que
es lo que el §3.5 prohíbe, y esa exención no tiene ni el paso 4 ni el límite de lo que puede
escribir un guest.

**El camino.**

1. Juan, sin cuenta, completa el formulario de postulación de Partner.
2. La resolución corre y el paso 1 lo rechaza: no es una lectura pública.
3. El implementador A lo deja así y el camino A del §17.3 sólo sirve a quien ya tiene cuenta. El
   implementador B exime la ruta, y la exención queda sin declarar ni vigilar por el guard del
   §3.5, que sólo mira el paso 5.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:71`
  — "El `Guest` es un actor (§3.3) y falla acá, salvo en una lectura de lo ajeno en estado público"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:552`
  — "Toda operación la corre, escriba o no. No hay operación exenta."
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:1290`
  — "alguien completa el formulario del §17.3"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/18-partner.md:217`
  — "El formulario es público y la guarda mira un correo que nadie probó: un tercero que carga la"

**Qué haría falta decidir o escribir.** Si `PP1` es la segunda excepción del paso 1 para el guest
(y con qué límites), o si postular exige cuenta.

### F-8V3A1-006 — «Sólo `SUPER_ADMIN`» es un rol, y quién asigna los permisos de las 24 acciones no es ninguna fila

**Qué se rompe.** Seis acciones de la tabla dicen *«sólo `SUPER_ADMIN`»*, mientras el §4.3 exige
que ninguna autorización decida sólo por rol y el paso 3 pregunta por permiso. Si se implementa
como permiso, nada dice quién lo puede asignar: asignar un permiso o un rol es una escritura que
no está en ninguna fila de `NUCLEO/08` §3, y la tabla dice que una escritura sin fila no se puede
ejecutar. O se vuelve imposible asignar los permisos nuevos, o se asignan por fuera de la tabla,
sin `actor ≠ sujeto` auditable ni `D11`. El código actual ya tiene overrides de permiso por
usuario que alcanzan a cualquier cuenta que no sea `SUPER_ADMIN`.

**El camino.**

1. Juan es `CLIENT_MANAGER`. Un `SUPER_ADMIN` le da por override el permiso de *«fijar el precio de
   un ciclo»*, que el diseño dice que es sólo de `SUPER_ADMIN`.
2. El paso 3 pregunta por el permiso y Juan lo tiene: fija precios, que es plata.
3. La asignación del permiso no dejó fila de acción administrativa: el resumen de `DEC-OBS-001`
   muestra a Juan fijando precios y a nadie dándole el poder de hacerlo.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:198`
  — "el monto de una `billing_option` de una versión de plan (`B/02` §2.1), sólo `SUPER_ADMIN`"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:635`
  — "ninguna autorización decide sólo por rol"
- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:219`
  — "esté nombrada en ninguna fila: una escritura sin fila no tiene permiso que pedir, no es capacidad"
- `apps/api/src/routes/user/admin/permissions.ts:83` (código actual)
  — "'Creates or updates a per-user permission override. Returns 400 when the target user is a SUPER_ADMIN (overrides are moot for a super).',"
- Silencio: `rg -n -i "override de permiso|permission override|PERMISSION_ASSIGN|asignar (un )?permiso|cambiar (el )?rol|USER_UPDATE_ROLES|user_permission"`
  sobre el alcance no devuelve nada.

**Qué haría falta decidir o escribir.** Si *«sólo `SUPER_ADMIN`»* es un permiso no asignable por
override, y si asignar un permiso de las 24 acciones (o un rol que lo trae) es una fila de la
tabla, con su auditoría.

## BAJA

Ninguno.

## Ataques que intenté y el diseño resistió

- **Operar en una vertical declarando otra**: la precisión 6 lee la vertical del recurso, la
  vuelve inmutable (`V/02` §2.5) y `G2` vigila las tres mitades.
- **Comprar un destaque para la ficha de otro**: la precisión 7 lo nombra como escritura sobre lo
  ajeno, y `A1` valida el objetivo contra el dueño que devuelve `ficha()` (`12-contrato…` §4.1).
- **Filtrar existencia por 403 vs 404**: la precisión 1 junta ajeno, archivado e inexistente, y la
  del Partner sin clave o moderado responde 404 (cap. 18 §1.6, `V/21` §4 cambia el 410).
- **Admin que es cliente operándose a sí mismo**: la regla 5 del §3.2 lo rechaza en el paso 3; la
  versión con dos cuentas está declarada con detector.
- **Staff con el conjunto entero por su rol**: el §4.3 retira el cargador y `G6` lo vigila.
- **Leer el billing de otra cuenta cambiando el sujeto del pedido**: la precisión 8 saca el sujeto
  de la sesión o del recurso.
- **Entitlement revocado vivo en el caché**: invalidación por `user` después del commit, entrada
  sospechosa si falla, red de 15 minutos y reconciliador diario (`V/02` §3.2).
- **Cambiar el correo nunca verificado para llevarse el Partner**: la regla 3 del cap. 18 §2.4 lo
  rechaza (lo que no cubre es el caso ya verificado por reclamo, F-8V3A1-001).

## Fuera de mi vector

- **Presencia de Partner servida desde el caché del borde hasta ~2 h tras perder la clave**: está
  declarada en el ⚠️ punto 4 del cap. 18 §1.6; no la reabro.

## Key Learnings

1. Una regla que dice «la persona de la sesión es la que leyó la casilla» sólo vale si la cuenta
   no tenía sesiones ni credenciales de otro antes de verificarse; el diseño habilita justo eso con
   la lista del paso 2.
2. Un vínculo que sólo escribe «el acto de reclamar» necesita decir que no pisa uno ya escrito.
3. Las listas cerradas de la precisión 7 alcanzan también a las escrituras de terceros legítimos
   (mensajes, reseñas) por la frase «algo que cuelga de él».
4. Sacar «inhabilitado» del paso 2 por falta de dato dejó sin lugar a otro estado sin dato: la
   cuenta dada de baja.

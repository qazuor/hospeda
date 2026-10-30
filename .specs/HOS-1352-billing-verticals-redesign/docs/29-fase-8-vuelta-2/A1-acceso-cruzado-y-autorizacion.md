---
title: "FASE 8 vuelta 2 · A1 — acceso cruzado y autorización"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 8
---

# FASE 8 vuelta 2 · A1 — acceso cruzado y autorización

Ataqué la cadena de autorización de `V/17` entera (los siete pasos, las siete precisiones,
actor y sujeto, las cinco reglas del actor administrativo, el actor sistema y el criterio de
§3.5), el catálogo de acciones administrativas de `NUCLEO/08` §3, la versión de piso de `V/02`
§2.1, el caché e invalidación de `V/02` §3, Partner (`V/18`, `V/02` §2.7, `V/03` §11), las
superficies (`V/19`, `B/19` §6), la compra de addons (`B/16` §2) y la traducción de fichas del
corte (`V/21` §2.4). Medí contra el HEAD `1cccd9119d` del worktree
`hospeda-spec-hos-1352-billing-redesign`.

Son **4 hallazgos**: **0 CRITICA, 3 ALTA, 1 MEDIA y 0 BAJA**. La idea más grave: el paso 4
distingue «sujeto» de «dueño» y la precisión 7 hace existir lo ajeno público sin acotarlo a
lecturas, así que una escritura con `actor = sujeto ≠ dueño` sobre una ficha `PUBLISHED` ajena
no tiene regla que la pare; y en el mismo eje, nadie escribe de dónde sale el sujeto ni qué
permiso autoriza una lectura con `actor ≠ sujeto`.

Regla de lectura: cada hallazgo se apoya en una cita textual copiada literal de una sola línea del
archivo, con su `archivo:línea` (rutas relativas a la raíz del worktree).

## CRITICA

Ninguno.

## ALTA

### F-8V2A1-001 — La precisión 7 hace existir la ficha ajena publicada también para escribirla

**Qué se rompe.** El paso 4 pregunta tres cosas —existe, acepta esto, es del sujeto— y la
precisión 7 agrega que, cuando el sujeto no es el dueño, el recurso existe si está en estado
público. La precisión se escribió para la lectura del turista, pero su texto no la acota a
lecturas, y para que esa lectura pase tiene que pisar la tercera pregunta («¿es del sujeto?»).
Un implementador que la aplica literal deja pasar cualquier operación de un usuario autenticado
sobre una ficha `PUBLISHED` ajena: el actor es él mismo, así que `actor = sujeto` y ninguna de
las cinco reglas del §3.2 dispara (todas se activan con `actor ≠ sujeto`); los pasos 5 a 7 se
evalúan sobre él y pasan si él paga su propio plan en esa vertical. Otro implementador lee el
«es del sujeto» como obligatorio y rompe la lectura pública. El diseño necesitó una acción
administrativa con permiso propio (la 15) para editar lo ajeno, lo que confirma que la
intención es que un usuario común no pueda; pero la cadena no lo dice para `actor = sujeto`, y
los casos de prueba de `V5` sólo cubren lo ajeno **no** publicado.

**El camino.**

1. Juan es host con plan pago en Alojamiento. María tiene su ficha de Alojamiento `PUBLISHED`.
2. Juan manda «editar ficha» (o subir fotos, o comprar un destaque `LISTING`) con el id de la
   ficha de María. Actor y sujeto son Juan.
3. Paso 1: autenticado. Paso 2: correo verificado. Paso 3: tiene el permiso de la familia
   «editar ficha», que usa para las suyas.
4. Paso 4 con la precisión 7: el sujeto (Juan) no es el dueño y la ficha está en `PUBLISHED`,
   que está en la lista cerrada, así que «existe»; `PUBLISHED` acepta edición.
5. Pasos 5 a 7 sobre Juan en Alojamiento (la vertical leída del recurso): tiene título, la
   clave y cupo. Pasa.
6. La descripción y las fotos de la ficha pública de María cambian. María no recibe aviso (el
   aviso de la fila 1 de `V/19` es de la acción 15, que no corrió) y el registro dice que Juan
   editó con `actor = sujeto`, sin motivo.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:74`
  — "¿existe, está en un estado que acepta esto, y es del sujeto?"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:74`
  — "Si el sujeto no es el dueño, el recurso existe sólo en estado público"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:186`
  — "Cuando el sujeto no es el dueño, el recurso existe"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:303`
  — "no se salta nunca. Lo que autoriza que `actor ≠ sujeto` es un permiso,"
- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:166`
  — "sin publicar, sin destacar y sin borrar, que siguen siendo del dueño o de sus filas"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:509`
  — "una ficha ajena en `DRAFT`, `ARCHIVED` o `MODERATED` contesta lo mismo que una inexistente"

El silencio: ninguna línea acota la precisión 7 a lecturas ni exige `sujeto = dueño` para
escribir.

```text
rg -n "escritura.*ajen|ajen.*escrit|sujeto.*dueño|dueño.*sujeto" \
  .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md
74:  la fila del paso 4
186: la precisión 7
364: la acción administrativa 15 (actor ≠ sujeto)
```

Ninguna de las tres acota la precisión 7 a lecturas ni pide `sujeto = dueño` para escribir.

**Qué haría falta decidir o escribir.** Si la precisión 7 vale sólo para operaciones que no
escriben (y entonces el paso 4, para una escritura, exige `sujeto = dueño` además de existir),
y qué contesta una escritura de un no dueño sobre lo ajeno público (¿«no existe» o «sin
permiso»?). Falta el caso de `V5` que lo pruebe sobre `PUBLISHED`, incluida la compra de un
addon `LISTING` cuyo objetivo es una ficha ajena.

### F-8V2A1-002 — Una lectura con `actor ≠ sujeto` no tiene permiso definido ni sujeto anclado

**Qué se rompe.** El §48 obliga a que el admin inspeccione usuarios, suscripciones, pagos,
cortesías y grants ajenos, y `V/19` le da la lectura de todo, de cualquiera, como actor
distinto del sujeto. La regla 1 del §3.2 dice que `actor ≠ sujeto` exige el permiso de «esa
acción concreta», pero las únicas acciones con permiso propio son las quince **escrituras** de
`NUCLEO/08` §3: ninguna inspección tiene fila ni permiso. Y en ninguna parte se escribe de
dónde sale el sujeto (de la sesión, del pedido, del recurso), como sí se escribió para la
vertical en la precisión 6. Con el paso 4 preguntando «¿es del sujeto?» y el §3.5 sacando del
paso 6 las lecturas «de lo propio» (propio del sujeto), un sujeto tomado del pedido más un
permiso de familia reutilizado —la única pieza disponible para «leer billing»— hace que
cualquier cuenta lea el billing ajeno. La otra salida disponible, habilitar por rol de staff,
la prohíbe el propio capítulo («ninguna autorización decide sólo por rol»). Dos
implementadores eligen distinto y uno de los dos abre el acceso.

**El camino.**

1. Juan es cliente de Alojamiento. Tiene el permiso de familia «leer mi billing».
2. Juan llama a la lectura de billing con `sujeto = María` (el campo existe en toda
   operación).
3. Paso 3: la regla 1 pide «el permiso de esa acción concreta», y para una lectura no hay
   ninguna; el implementador usa el de familia, que Juan tiene.
4. Paso 4: el billing de María es del sujeto María. Existe.
5. Por el §3.5 es una lectura de «lo propio» del sujeto: no pasa por el 5 ni por el 6.
6. Juan ve los pagos, la tarjeta enmascarada, las cortesías y el estado de María.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:290`
  — "El §48 exige que el admin inspeccione usuarios, suscripciones, pagos, cortesías y grants"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:309`
  — "`actor ≠ sujeto` exige un permiso de esa acción concreta"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:44`
  — "para leer; para escribir, sólo lo que nombra una fila de `NUCLEO/08` §3"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:299`
  — "Toda operación lleva dos identidades: quién la ejecuta (`actor`) y sobre quién recae"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:452`
  — "La excepción es cerrada: Mi Cuenta, su billing y sus fichas"
- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:42`
  — "lo hace un administrador sobre la cuenta de otro — aunque no mueva dinero ni cambie"

El silencio sobre de dónde sale el sujeto:

```text
rg -n "sesión" .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md
(sin resultados)
rg -n "sujeto" .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md \
  | rg -i "sesión|pedido|se lee|toma"
(sin resultados)
```

**Qué haría falta decidir o escribir.** De dónde sale el sujeto (la regla simétrica de la
precisión 6: para un no-admin, `sujeto = actor` siempre, y el pedido no lo decide), y qué
permiso concreto autoriza cada inspección del §48 con `actor ≠ sujeto` (¿una fila de lectura en
`NUCLEO/08` §3, un permiso por entidad?). Sin eso, el §3.5 «de lo propio» se lee relativo a un
sujeto que el atacante elige.

### F-8V2A1-003 — El reclamo de Partner vincula a la cuenta que tiene el correo, verificada o no

**Qué se rompe.** El §2.4 de `V/18` prueba que el postulante lee la casilla, pero vincula el
Partner al **usuario que ya tiene ese correo**, y ese usuario puede ser una cuenta con el
correo sin verificar creada por otro. El paso 2 deja a esa cuenta «cambiar el correo» sin
verificar el anterior. Resultado: la dueña de la casilla hace el reclamo y el Partner queda en
la cuenta del ocupante, que después se muda a su propio correo y se lo lleva.

**El camino.**

1. Juan registra una cuenta con `maria@negocio.com`. No la puede verificar, pero la cuenta
   existe con el correo sin verificar.
2. María se postula como Partner con `maria@negocio.com`. El admin aprueba (`PP2`): el correo
   «ya es de un usuario», así que se manda a esa dirección el aviso para reclamar.
3. María, que lee su casilla, hace click en «reclamar». Se escribe `owner_user_id` = el
   usuario de ese correo, que es la cuenta de Juan.
4. Juan, con el correo aún sin verificar, usa lo que el paso 2 le deja: cambiar el correo a
   `juan@x.com` y verificarlo.
5. El Partner aprobado de María —con el plan y el método que el admin le configure— es de la
   cuenta de Juan. María no puede reclamarlo de nuevo: `owner_user_id` ya no es nulo.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/18-partner.md:237`
  — "se le manda a esa dirección un aviso para que reclame el Partner"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:490`
  — "en la del correo que ya es de un usuario, el reclamo desde esa casilla"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/18-partner.md:239`
  — "La única prueba de que el postulante es dueño de la dirección es que pueda leerla"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:119`
  — "correo o cambiarlo; las lecturas de lo propio —Mi Cuenta, su billing y sus fichas"

El silencio sobre si la cuenta a vincular tiene que tener el correo verificado:

```text
rg -n "correo.*verific|verific.*correo" \
  .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/18-partner.md \
  .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md \
  .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md
(sin resultados)
```

**Qué haría falta decidir o escribir.** A qué cuenta vincula el reclamo cuando el usuario del
correo no lo verificó (¿el reclamo verifica ese correo, exige iniciar sesión en esa cuenta, o
se niega y trata la dirección como de nadie?), y si el cambio de correo sin verificar puede
llevarse un vínculo que se hizo por prueba sobre el correo viejo.

## MEDIA

### F-8V2A1-004 — La acción 15 evalúa los pasos 6 y 7 sobre un actor que no tiene conjunto

**Qué se rompe.** La regla 3 del §3.2 declara que las quince acciones son «capacidades del
actor», con los pasos 5 a 7 sobre el actor. Para las doce que mueven plata eso no cuenta nada
(otorgar no consume cupo). Para la 15 —crear en borrador a nombre del dueño, corregir,
restaurar contenido— sí: el contenido tiene limits (fotos, secciones). El actor admin no tiene
fuentes (ningún rol lo es) y resuelve contra la versión de piso, que no otorga ninguna
capacidad comercial ni cuota. Leído literal, el paso 6 rechaza toda edición del admin y la
acción 15 es inejecutable; leído como «el permiso ya es la capacidad», el paso 7 no mira el
cupo de nadie y el admin carga contenido por encima del plan de la dueña, que es exactamente
lo que la misma regla 3 dice que no puede pasar. Hay que adivinar cuál.

**El camino.**

1. María tiene plan con 10 fotos por ficha; su ficha tiene 10.
2. Soporte (cuenta `ana-admin`, con el permiso de la acción 15) restaura 25 fotos de un
   respaldo que María mandó por correo.
3. Lectura A: pasos 6 y 7 sobre Ana, piso de Alojamiento, sin la clave: «sin la capacidad», y
   soporte no puede hacer lo que la acción promete.
4. Lectura B: la acción es capacidad del actor y el cupo no se consulta: la ficha publicada de
   María muestra 25 fotos con un plan de 10, sin fila de cortesía y sin plata; el reconciliador
   de excedentes no corre porque ninguna fuente cambió.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:320`
  — "así que un administrador no puede hacerle a un cliente algo que el cliente no podría"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:322`
  — "capacidades del actor, no del sujeto — otorgar una cortesía no consulta si el cliente tiene"
- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:166`
  — "crearla en borrador a nombre de su dueño, corregirla, restaurar contenido"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:223`
  — "y pueda volver a contratar. Son tres cosas y la lista es cerrada:"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:517`
  — "el §3.2 regla 1, acción por acción, nunca un conjunto"

**Qué haría falta decidir o escribir.** Si la acción 15 es de la clase «capacidad del actor»
o si sus pasos 6 y 7 se evalúan sobre el sujeto (el dueño), como las transiciones de evento del
§3.4; es decir, si soporte puede dejar una ficha por encima del cupo de su dueño.

## BAJA

Ninguno.

## Ataques que intenté y el diseño resistió

- **Declarar otra vertical para usar el plan de una**: resiste. La precisión 6 lee la vertical
  del recurso (ficha, contenido, presencia de Partner, instancia de addon), la vuelve
  inmutable y la tercera mitad de `G2` falla si alguien la escribe.
- **Un rol de staff como fuente de capacidades**: resiste. `V/17` §4.3 retira el cargador que
  daba el conjunto entero a `SUPER_ADMIN`/`ADMIN`/`EDITOR`/`CLIENT_MANAGER`, y `G6` lo vigila.
- **Admin que es también cliente operándose a sí mismo**: resiste con la misma cuenta (regla 5,
  paso 3); con dos cuentas está declarado y tiene detector (`DEC-OBS-001`).
- **Actor sistema otorgando**: resiste. `V/17` §3.3 prohíbe al sistema las quince acciones y la
  clase del reloj lleva guard de «nunca otorga».
- **Entitlement que sobrevive a la revocación por caché**: resiste. `V/02` §3.2 invalida por
  `user` en todas sus verticales, borra después del commit, marca sospechosa si falla y pone
  una red de 15 minutos; la moderación de Partner se lee en vivo.
- **Guest leyendo o consumiendo lo medido**: resiste. Paso 1 lo rechaza salvo lectura pública y
  `V/15` §5.2 le niega por clase todo entitlement medido.
- **Enumerar ids por 403 vs 404**: resiste para vertical, ajeno no público y moderado: todo
  contesta «no existe» en el escalón de existencia.
- **Postular con el correo de un tercero sin cuenta**: resiste. La cuenta se crea y sólo la
  validación desde esa casilla escribe `owner_user_id` (`V/02` §2.7).
- **El corte dejando fichas visibles a quien no le corresponde**: resiste. La tabla de `V/21`
  §2.4 no hace nacer ninguna ficha en `PUBLISHED`, y las borradas nacen `PURGED`.

## Fuera de mi vector

- **Addon `LISTING` comprado sobre ficha ajena y la moderación**: la fila 24 de `V/19` le avisa
  a la dueña los destaques leídos de **sus** fuentes; un destaque pagado por otro sobre su ficha
  seguiría cobrándole a él sin aviso. Depende de cómo se cierre `F-8V2A1-001`; toca al vector
  de addons/cobro.

## Key Learnings

1. La precisión 7 introdujo una distinción «sujeto» vs «dueño» que el resto de la cadena no
   usa: las reglas de `actor ≠ sujeto` no ven el caso `actor = sujeto ≠ dueño`.
2. La precisión 6 ancló la vertical al recurso, pero nadie ancló el sujeto: el mismo patrón de
   «el pedido no decide» falta para quién es el sujeto.
3. El catálogo de `NUCLEO/08` §3 enumera sólo escrituras; las inspecciones del §48 no tienen
   permiso concreto, y la regla 1 exige uno.
4. Una prueba de posesión del correo protege el reclamo sólo si la cuenta vinculada también la
   tiene; el paso 2 deja cambiar un correo nunca verificado.
5. «Capacidad del actor» estaba pensado para otorgar plata; aplicada a la acción 15, que edita
   contenido con cupo, deja los pasos 6 y 7 sin sujeto útil.

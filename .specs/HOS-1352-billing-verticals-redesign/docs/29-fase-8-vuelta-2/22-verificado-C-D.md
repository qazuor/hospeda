---
title: "FASE 9 vuelta 2 · verificación de C y D (la costura y verticales)"
linear: HOS-1352
statusSource: linear
created: 2026-09-27
updated: 2026-09-27
status: CURRENT
fase: 9
---

# FASE 9 vuelta 2 · verificación de C y D (verificador B)

Verificación con el criterio de `DEC-METH-004` de los hallazgos de la tabla de
`16-aplicacion-decisiones-tardias.md` §6 cuyo **primer** grupo es C (`13-`) o D (`14-`), incluidos
los que después retocaron E (`15-`) o F (`16-`). Texto medido en el worktree
`hospeda-spec-hos-1352-billing-redesign`, HEAD `d421d1ddf1`, el 2026-09-27. Cada camino se
re-ejecutó sobre el texto de hoy; donde el diseño afirma algo del esquema actual, se midió
`packages/db/src/schemas`.

**El alcance, contado con script** (desde `29-fase-8-vuelta-2/`):

```text
python3 - <<'EOF'
import re
t=re.findall(r'(?m)^\| `(F-8V2[A-D]\d-\d{3})` \| (\w+) \|[^|]*\| ([^|]+?) \|',
   open('16-aplicacion-decisiones-tardias.md').read())
sel=[(i,r,g) for i,r,g in t if g.strip()[0] in 'CD']
print(len(t),len(sel))
EOF
# 56 25
```

Son **25**: R14 (`A1-001`, `A1-002`), R7 (`A1-003`, `A2-005`), R10 (`A1-004`, `D1-002`), R15
(`A2-001`, `A2-002`), R22 (`A2-003`, `A2-004`), R9 (`A2-006`, `A3-003`), R13 (`A2-007`,
`A3-006`), R12 (`A2-008`, `C1-003`, `C1-007`), R5 (`A3-001`, `C1-001`), R23 (`A3-004`), R11
(`B3-009`, `C1-004`), R16 (`C1-002`) y R26 (`C1-005`, `C1-006`). `C2-007` (R13) y `A3-005` (R24)
no entran: su primer grupo es E y F.

Decisiones del owner que fijan la salida esperada: `R5`, `R7`, `R7-b`, `R9`, `R9-b`, `R15`,
`R23`, `Q-FECHA`, `Q-ALTAS`, `Q-ACC16` y `R11-3b` (contra la recomendación: se ancla a
Alojamiento).

---

## 1. Resumen

**25 DEJA · 0 SIGUE · 0 DECLARADO · 0 OTRA.** Los trece racimos tienen su camino cortado. Tres
dominios no quedan enteros y salen **tres casos vecinos nuevos** (§3: una MEDIA y dos BAJA),
ninguno CRITICA. De los trece vecinos de `13-` y `14-`, **seis ya los cerró un registro
posterior** y siete siguen abiertos (§4).

| hallazgo | veredicto | línea que lo corta |
|---|---|---|
| `F-8V2A1-001` (R14) | DEJA | `$V/docs/17-autorizacion.md:74` «y sólo para una operación que no escribe: una escritura exige `sujeto = dueño`» |
| `F-8V2A1-002` (R14) | DEJA | `$V/docs/17-autorizacion.md:213` «`sujeto = actor`, siempre» |
| `F-8V2A1-003` (R7) | DEJA | `$V/docs/18-partner.md:262` «El reclamo exige sesión y vincula a la cuenta que reclama.» |
| `F-8V2A2-005` (R7) | DEJA | `$V/docs/02-modelo-de-datos.md:551` «un índice único parcial sobre el correo en minúsculas donde el estado es `PENDIENTE`» |
| `F-8V2A1-004` (R10) | DEJA | `$V/docs/17-autorizacion.md:364` «La decimoquinta, editar el contenido de una ficha ajena, no está en la excepción» |
| `F-8V2D1-002` (R10) | DEJA | `$D/nucleo/08-auditoria-y-observabilidad.md:166` «el aviso de la fila 26 del cap. 19 §4» |
| `F-8V2A2-001` (R15) | DEJA | `$V/docs/03-maquinas-de-estado.md:58` «o le volvió una ficha por `PB3` o `PB7` bajo un título que paga» |
| `F-8V2A2-002` (R15) | DEJA | `$V/docs/03-maquinas-de-estado.md:265` «El lock de la máquina de trial es el mismo lock por `user + vertical` que toma la publicación» |
| `F-8V2A2-003` (R22) | DEJA | `$V/docs/03-maquinas-de-estado.md:54` «y con la fecha de fin sin pasar» |
| `F-8V2A2-004` (R22) | DEJA | `$V/docs/03-maquinas-de-estado.md:876` «Las que no ocupan ni liberan cupo lo toman si comparten `desde` con una que lo toma» |
| `F-8V2A2-006` (R9) | DEJA | `$V/docs/02-modelo-de-datos.md:697` «se cierran, con un aviso al turista» |
| `F-8V2A3-003` (R9) | DEJA | `$V/docs/21-migracion.md:179` «Y el recuento se hace también antes del 1a, y si ahí ya aparece una fila el» |
| `F-8V2A2-007` (R13) | DEJA | `$V/docs/03-maquinas-de-estado.md:53` «y el reloj de retención tampoco es suyo» |
| `F-8V2A3-006` (R13) | DEJA | `$V/docs/21-migracion.md:265` «Lo tachado afirmaba que `PB2` corre» |
| `F-8V2A2-008` (R12) | DEJA | `$D/12-contrato-de-cobertura.md:924` «y `T6`, `T7` y `T8`» |
| `F-8V2C1-007` (R12) | DEJA | `$D/12-contrato-de-cobertura.md:907` «Todo acto que cambia una fuente emite» |
| `F-8V2C1-003` (R12) | DEJA | `$D/12-contrato-de-cobertura.md:920` «El anclaje faltaba» |
| `F-8V2A3-001` (R5) | DEJA | `$D/nucleo/01-glosario.md:57` «Lo ejecuta verticales: el reconciliador diario de cobertura» |
| `F-8V2C1-001` (R5) | DEJA | `$V/docs/03-maquinas-de-estado.md:1299` «Escribe el hecho 4 en cada ficha de la vertical» |
| `F-8V2A3-004` (R23) | DEJA | `$V/docs/02-modelo-de-datos.md:350` «La función es SHA-256 sin clave» |
| `F-8V2B3-009` (R11) | DEJA | `$D/16-fase-7-del-paraguas.md:130` «las dos `comp` que existen son del owner y de Alojamiento» |
| `F-8V2C1-004` (R11) | DEJA | `$D/12-contrato-de-cobertura.md:727` «la acepta sólo si `políticaDePlan(v).vigente` es verdadero, y si no rechaza el acto» |
| `F-8V2C1-002` (R16) | DEJA | `$B/docs/03-maquinas-de-estado.md:142` «después del commit de su escritura, y nunca dentro de su» |
| `F-8V2C1-005` (R26) | DEJA | `$D/12-contrato-de-cobertura.md:1428` «`G13` falla si un build destinado a» |
| `F-8V2C1-006` (R26) | DEJA | `$B/descomposicion.md:742` «pasa entero contra las dos, y su caso distintivo falla contra una constante» |

Notas de veredicto:

- `A2-006` DEJA en su camino (la alerta y la conversación de Juan tienen tratamiento), pero la
  lista cerrada que lo corta **no está completa contra el esquema**: le falta `posts` (`N-B-02`).
- `A2-001` DEJA con el intervalo del hallazgo (alta, y el primer cobro 30 minutos después). Si
  los dos avisos se procesan juntos, el orden entre `PB3` y `T8` no está escrito y el camino
  vuelve a llegar por otra puerta (`N-B-01`).
- `A2-004` DEJA para `PB8` y `PB9`. `PB10` sigue sin lock ni relectura de su `desde`, y es el
  vecino abierto de `14-` (§4).
- `A3-004` DEJA: el HMAC que rota y el dominio propio que junta dos casillas ya no llegan. Queda
  el residuo declarado de cambiar la lista de proveedores, y el vecino de Outlook de `16-` (§4).
- `B3-009` DEJA por la segunda salida que el propio hallazgo ofrecía (*afirmar que las dos son de
  Alojamiento*), que es la del owner en `R11-3b`.

---

## 2. Los racimos

### 2.1 R14 · la precisión 7 y el sujeto

**Camino de `A1-001` re-ejecutado.** Juan manda «editar ficha» con el id de la ficha publicada de
María. La operación no es de `actor ≠ sujeto`, así que el sujeto es Juan (precisión 8). En el
paso 4 Juan no es el dueño y la operación escribe: contesta «no existe», la misma respuesta de la
precisión 1. **El paso 4 del camino (*«existe; `PUBLISHED` acepta edición»*) ya no llega.**

**Camino de `A1-002`.** Juan llama a la lectura de su billing con `sujeto = María`. Esa lectura
no es de `actor ≠ sujeto`, así que el sujeto es Juan y el pedido no lo decide; si la usara como
inspección, necesitaría el permiso de inspección de esa entidad. **El paso 3 (*«usa el de
familia»*) ya no llega.**

| caso del dominio | dónde se contesta | ¿cubierto? |
|---|---|---|
| escritura sobre ficha ajena pública | `$V/docs/17-autorizacion.md:74` «y sólo para una operación que no escribe: una escritura exige `sujeto = dueño`» | sí |
| compra de un addon `LISTING` sobre ficha ajena | `$V/docs/17-autorizacion.md:204` «un addon de alcance `LISTING` con esa ficha de objetivo» | sí; y `A1` de `B/03` §8 la exige propia del comprador por `ficha(idDeFicha)` |
| de dónde sale el sujeto | `$V/docs/17-autorizacion.md:206` «El sujeto no viene del pedido: se lee de la sesión o del recurso» | sí |
| lectura con `actor ≠ sujeto` (inspecciones del §48) | `$V/docs/17-autorizacion.md:343` «Y una lectura con `actor ≠ sujeto` también exige el suyo» | sí |
| el permiso de inspección no es fila del catálogo de escrituras | `$V/docs/17-autorizacion.md:347` «tiene su permiso de inspección» | sí |

**Dominio cubierto: sí.**

### 2.2 R7 · la identidad de Partner

**Camino de `A1-003`.** Juan crea una cuenta con `maria@negocio.com` sin verificar. María reclama:
el link llega a su casilla y ella inicia sesión en **su** cuenta, que es la que queda en
`owner_user_id`. La cuenta de Juan no se toca. **El paso 3 (*«se escribe el usuario de ese
correo»*) ya no llega.**

**Camino de `A2-005`.** La segunda `PENDIENTE` del mismo correo la rechaza la base, y la espera
que arranca la postulación falsa la puede anular el admin. **Los pasos 4 (*«la espera
entera»*) y la doble `PENDIENTE` ya no llegan.**

| caso del dominio | dónde se contesta | ¿cubierto? |
|---|---|---|
| reclamo desde la cuenta del correo sin verificar | `$V/docs/18-partner.md:262` «El reclamo exige sesión y vincula a la cuenta que reclama.» | sí, y el reclamo lo verifica (regla 2) |
| la escritura de `owner_user_id` | `$V/docs/02-modelo-de-datos.md:552` «con sesión: escribe la cuenta de la sesión y no la que tiene la dirección» | sí |
| cambiar un correo nunca verificado con vínculo | `$V/docs/18-partner.md:269` «Un correo nunca verificado no se cambia llevándose vínculos.» | sí, y deriva a soporte (`R7-b`) |
| dos envíos simultáneos | `$V/docs/02-modelo-de-datos.md:551` «un índice único parcial sobre el correo en minúsculas donde el estado es `PENDIENTE`» | sí |
| la espera tras un rechazo falso | `$V/docs/18-partner.md:217` «Y el admin puede anular una espera» | sí |
| la guarda en la máquina | `$V/docs/03-maquinas-de-estado.md:1345` «que el admin no haya anulado» | sí |
| el camino B (alta directa) | no crea postulación ni vincula por correo | fuera del dominio |

**Dominio cubierto: sí.**

### 2.3 R10 · la acción administrativa 15

**Camino.** Soporte restaura 25 fotos a la ficha de María, que tiene un plan de 10. Los pasos 5 a
7 se evalúan sobre María: restaura hasta 10. María recibe la fila 26 y el correo. **Las dos
lecturas del camino (*«inejecutable»* o *«25 fotos sin cortesía»*) ya no llegan, y el aviso
existe.**

| caso del dominio | dónde se contesta | ¿cubierto? |
|---|---|---|
| la clase de la 15 | `$V/docs/17-autorizacion.md:365` «sus pasos 5 a 7 se evalúan sobre el sujeto, el dueño de la» | sí |
| el catálogo lo dice igual | `$D/nucleo/08-auditoria-y-observabilidad.md:184` «todas menos la decimoquinta, que se evalúa sobre el sujeto a propósito» | sí; recontado con la 16 de `Q-ACC16`: las de clase actor son quince en `V/17`, `nucleo/08` y `$V/spec.md` |
| la superficie del aviso | `$V/docs/19-superficies.md:73` «cuando soporte edita el contenido de su ficha» | sí |
| el correo | `$D/nucleo/07-outbox-y-notificaciones.md:242` «contenido de tu ficha editado por soporte» | sí |

**Dominio cubierto: sí.** Si la 15 lleva confirmación explícita sigue declarado en su fila, como
lo dejó la vuelta 1.

### 2.4 R15 · la cartera del corte y el lock de la máquina de trial

**Camino de `A2-001`.** Juan contrata por teléfono. `PB3` le sube la ficha bajo una
`SUSCRIPCIÓN` y su registro lo guarda. A los 30 minutos se acredita el primer cobro, `T8`
despierta y la guarda lee la vuelta: escribe la fila consumida. Ocho meses después cancela y
publica: `T1` encuentra la fila del hash y no dispara. **El paso 3 (*«`T8` no dispara»*) ya no
llega.**

**Camino de `A2-002`.** `PB1` y `T8` toman el mismo lock, así que pasan en orden, y en los dos
órdenes escribe una de las dos:

- `$V/docs/03-maquinas-de-estado.md:278` «Siempre escribe una de las dos.»

| caso del dominio | dónde se contesta | ¿cubierto? |
|---|---|---|
| vuelta por `PB3` antes del primer cobro | `$V/docs/03-maquinas-de-estado.md:58` «o le volvió una ficha por `PB3` o `PB7` bajo un título que paga» | sí |
| el aviso del alta perdido | `$V/docs/03-maquinas-de-estado.md:1264` «Lo mismo cuando lo que se pierde es el aviso» | DECLARADO en el ⚠️ del reconciliador |
| `PB1` contra `T8` | `$V/docs/03-maquinas-de-estado.md:276` «Si entra primero» | sí |
| **`PB3` contra `T8`, con los dos avisos juntos** | ninguna línea | **no**: `N-B-01` (§3) |

**Dominio cubierto: no del todo** (`N-B-01`).

### 2.5 R22 · el lock de verticales y la guarda de `T4`

**Camino de `A2-003`.** El miércoles Juan canjea *«+15 días»* con el trial vencido el lunes y `T3`
caído: la fecha de fin ya pasó y `T4` contesta `RECHAZADA`. **El paso 3 (*«`ACEPTADA`»*) ya no
llega.** El espejo en `V/11` §7 dice lo mismo.

**Camino de `A2-004`.** El 12/03 `PB9` y el `PB8` de Juan toman el mismo lock; `PB9` relee
estado, reloj y cobertura adentro, y si `PB8` ganó ya no ve `ARCHIVED`. **El paso 4 ya no
llega.**

| caso del dominio | dónde se contesta | ¿cubierto? |
|---|---|---|
| `PB8` y `PB9` contra `PB7` | `$V/docs/03-maquinas-de-estado.md:876` «Las que no ocupan ni liberan cupo lo toman si comparten `desde` con una que lo toma» | sí |
| `PB11` | `$V/docs/03-maquinas-de-estado.md:881` «`PB11` no lo toma» | sí: `PB12` no sale de `MODERATED`, así que nadie le disputa el `desde` |
| `PB12` desde `ARCHIVED` contra `PB9` | los dos llevan a `PURGED` | sin daño |
| `PB10` contra `PB3` y `PB9` | `$V/docs/03-maquinas-de-estado.md:871` «Las que liberan cupo no lo necesitan» | **no**: la justificación sólo mira el conteo, no el `desde` (vecino abierto de `14-`, §4) |

**Dominio cubierto: sí para lo que el hallazgo nombró**; `PB10` es el vecino que `14-` dejó y sigue.

### 2.6 R9 · `PURGED` y `listing`

**Camino de `A2-006`.** La ficha de Ana llega a `PURGED`: la alerta de Juan se cierra con aviso y
la conversación queda en sólo lectura con *«esta ficha ya no existe»*. **El paso 3 ya no llega.**

**Camino de `A3-003`.** El restaurante de Juan de octubre aparece en el recuento antes del 1a y
el corte no arranca; el del paso 2 es el segundo control. **El paso 3 (*«aplica la tabla sólo a
`accommodations`»*) ya no llega.**

**El dominio, re-medido con script** sobre `packages/db/src/schemas`: toda tabla con FK a
`accommodations`, `gastronomies` o `experiences` (con el `references(` en varias líneas) y toda
tabla con `entity_type`. Da **29 con FK** y **12 polimórficas**; la lista cubre todas menos
`posts` (fuera de lo que `14-` declaró: `revalidation_config` y `partner_logo_clicks`).

| caso del dominio | dónde se contesta | ¿cubierto? |
|---|---|---|
| `listing` son las tres tablas | `$V/docs/02-modelo-de-datos.md:403` «`listing` son las filas que ya existen, no una tabla nueva» | sí |
| gastronomía o experiencia en el recuento | `$D/16-fase-7-del-paraguas.md:124` «no arranca si el recuento de fichas de Gastronomía y de Experiencia» | sí, con espejo en `B/21` §1.3 |
| conversaciones | `$V/docs/02-modelo-de-datos.md:695` «se conservan en sólo lectura» | sí |
| alertas de precio | `$D/nucleo/07-outbox-y-notificaciones.md:243` «tu alerta de precio se cerró» | sí; la clase transaccional sigue sin decisión (§4) |
| la lista se declara cerrada | `$V/docs/02-modelo-de-datos.md:702` «La lista es cerrada» | sí |
| `posts.related_accommodation_id` | `packages/db/src/schemas/post/post.dbschema.ts:50` «relatedAccommodationId: uuid('related_accommodation_id').references(» | **no**: `N-B-02` (§3) |

**Dominio cubierto: no del todo** (`N-B-02`).

### 2.7 R13 · las dos de verticales

`T3` ya no arranca el reloj, y el paréntesis de `V/21` §2.4 quedó tachado con su razón. Un `rg`
de *«`T3` … reloj / `inactiva_desde`»* sobre `$V`, `$B` y el núcleo sólo encuentra la celda
corregida y la fila de V4 que la nombra; uno de *«`PB2` corre / escribe … corte»* no encuentra
otra frase viva. **Dominio cubierto: sí** (el tercer hallazgo del racimo, `C2-007`, es de E).

### 2.8 R12 · el censo de emisores

**Camino de `C1-003`.** El `SUPER_ADMIN` le ancla Gastronomía al grant de Juan: el anclaje cambia
una fuente y emite (la regla y la lista); `T2` dispara y el trial se convierte sin campaña de
recuperación. **El paso 2 (*«no se emite ningún aviso»*) ya no llega.** `A2-008` y `C1-007`: `T6`
a `T8` están en la lista y en el criterio de V4.

**El dominio es la regla, no la lista.** Recorrí los actos que la vuelta 2 agregó después del
censo: el espejo de `R18` y el cierre de complementos de `R18-b` son filas de `B/03` y emiten por
ellas; `vertical_discontinuation` no cambia el `hasta` de ninguna fuente (el trial activo guarda
su propia fecha de fin) y el día del fin de servicio lo cubre la regla de la fecha que vence;
`admite_altas`, anular una espera y la acción 16 no mueven fuentes, y los cortes de la 16 salen
por `S26`–`S28`. **Dominio cubierto: sí.**

### 2.9 R5 · el día del fin de servicio

**Camino de `C1-001` y `A3-001`.** La ficha archivada de Juan tiene `inactiva_desde` de hace 170
días. Llega el fin de servicio: la corrida del reconciliador escribe el hecho 4 con el instante
del fin de servicio sobre toda ficha de la vertical con una fecha anterior, y el hard delete cae
180 días después, como prometen los avisos. **El paso 3 (*«nadie escribe `inactiva_desde`»*) ya
no llega.**

| caso del dominio | dónde se contesta | ¿cubierto? |
|---|---|---|
| quién calcula la fecha y cómo cruza | `$D/12-contrato-de-cobertura.md:1113` «Es la única entrada de este § que pregunta verticales y contesta billing» | sí |
| dónde la guarda billing | `$B/docs/02-modelo-de-datos.md:32` «una fila por vertical discontinuada» | sí (`Q-FECHA`) |
| quién escribe `admite_altas` | `$B/docs/10-verticales-planes-billing-options.md:434` «Quién lee `admite_altas` en billing: `S1`» | sí: la escribe la mitad de verticales (`Q-ALTAS`); billing sólo la lee |
| `PB2`, hecho 4 e invalidación | `$V/docs/03-maquinas-de-estado.md:1299` «Escribe el hecho 4 en cada ficha de la vertical» | sí |
| **`PB9` el mismo día, antes de la corrida** | ninguna línea | **no**: `N-B-03` (§3) |

**Dominio cubierto: sí para el camino del hallazgo**; el borde del mismo día es `N-B-03`.

### 2.10 R23 · el seudónimo

**Camino de `A3-004`.** Se redeploya con otro secreto: no hay secreto, la función es SHA-256 sin
clave y no cambia nunca. Ana y María de `hotel.com`: el dominio no está en la lista y los correos
se comparan tal cual. **Los pasos 2 y 4 ya no llegan.** Queda declarado el cambio de la lista de
proveedores, y el vecino de Outlook (§4).

- `$V/docs/02-modelo-de-datos.md:347` «En los demás dominios el correo se compara tal cual»

**Dominio cubierto: sí**, salvo lo declarado.

### 2.11 R11 · el ancla de un grant

**Camino de `C1-004`.** La pantalla abierta desde antes de v3 manda v2: billing pregunta
`políticaDePlan(v2).vigente`, da falso y rechaza el acto. **El paso 2 (*«guarda v2»*) ya no
llega.** Vale para los tres actos que escriben un piso (otorgar, anclar y la herramienta del 3b).

**Camino de `B3-009`.** El texto del 3b volvió a *«de Alojamiento, en la vertical en que tenían
`comp`»*, y ahora dice por qué es coherente: las dos son de Alojamiento. Lo mismo en `B/21`:

- `$B/docs/21-migracion.md:140` «las dos `comp` que existen son del owner y de Alojamiento»

**Dominio cubierto: sí.**

### 2.12 R16 · el aviso después del commit

**Camino.** `P1` acredita el primer pago de Juan y emite después de su commit; la máquina de
trial relee `cobrada: sí` y `T2` dispara. **El paso 2 ya no llega.** Un `rg` de *«aviso … mismo
acto»* sin tachar sobre `$B`, `$V` y el núcleo no encuentra ningún emisor; el único *«mismo
acto»* de `P1` es el decremento de la promo, que es una escritura.

| caso del dominio | dónde se contesta | ¿cubierto? |
|---|---|---|
| la regla del censo | `$D/12-contrato-de-cobertura.md:893` «después del commit de su escritura y nunca dentro de su transacción» | sí |
| `P1` | `$B/docs/03-maquinas-de-estado.md:1796` «después de su commit, nunca dentro de su transacción» | sí |
| el criterio de `B4` | `$B/descomposicion.md:742` «el aviso sale después del commit» | sí |

**Dominio cubierto: sí.**

### 2.13 R26 · la de arranque y las dos

**Camino de `C1-005`.** `G13` mira el módulo del cableado que contesta por billing, no la
resolución del trial ni la de `BASE`: el primer build de producción no lo importa y no se pone
rojo, así que no hay excepción que agregar. **El paso 2 ya no llega.**

- `$D/12-contrato-de-cobertura.md:1426` «Es el cableado que contesta por billing»

**Camino de `C1-006`.** Los casos de las fuentes de billing van a un juego propio de la real, y el
único pasa entero contra las dos. **El paso 2 ya no llega.**

- `$D/12-contrato-de-cobertura.md:1399` «Los casos de las fuentes de billing no son del juego único»

**Dominio cubierto: sí.** La fila de `G13` en el catálogo de guards no repite el objeto (§5,
nota 2).

---

## 3. Casos vecinos nuevos

### `N-B-01` · MEDIA · `T8` puede evaluar antes de que `PB3` suba la ficha, y nada la vuelve a evaluar

**Vecino de qué.** R15 hizo que la vuelta por `PB3` cuente para `T8`, y ordenó `PB1` contra `T8`
con un lock, porque `PB1` evalúa `T6` adentro. `PB3` no evalúa nada de la máquina de trial: sólo
deja escrito en su registro que una `SUSCRIPCIÓN` cubría la vuelta, para que `T8` lo lea después.
Y el evento de `T8` ocurre una sola vez.

- `$V/docs/03-maquinas-de-estado.md:276` «Si entra primero»
- `$V/docs/03-maquinas-de-estado.md:1264` «Lo mismo cuando lo que se pierde es el aviso»

**Camino de Juan.**

1. Juan, de la cartera del corte, contrata por teléfono. La autorización y el primer cobro entran
   con segundos de diferencia.
2. Los dos avisos despiertan a sus consumidores. `T8` toma el lock primero: ve un título que
   convierte, busca una vuelta por `PB3` en el registro y no la encuentra. No dispara.
3. `PB3` toma el lock después y sube la ficha bajo la `SUSCRIPCIÓN`. No evalúa `T8`.
4. Juan queda pagando en `PRE_TRIAL` sin fila. Cancela meses después, publica sin cobertura y `T1`
   le da un trial entero: la puerta que R15 cerró.

No es el residuo declarado: ahí se pierde el aviso; acá los dos llegan y el orden lo elige la
implementación.

**Por qué MEDIA.** Regala un trial, no cobra de más, y exige un orden adverso. Sube a ALTA si en
el sistema nuevo el primer cobro entra junto con la autorización, porque entonces el orden
adverso es la mitad de los casos del camino principal de la cartera. **Toca plata: no.**
**Decisión del owner: no**, es mecanismo dentro de `R15`. **Arreglo de texto:** que `PB3` y `PB7`,
cuando suben una ficha bajo una `SUSCRIPCIÓN` que ya trae `cobrada: sí` sobre una persona en
`PRE_TRIAL`, evalúen `T8` dentro del mismo lock, como `PB1` evalúa `T6`. Es de V4 y V6.

### `N-B-02` · BAJA · `posts` cuelga de `accommodations` y no está en la lista cerrada de `PURGED`

**Vecino de qué.** La lista de R9 se declara cerrada y medida sobre el código actual, pero la
medición de `14-` contó 28 tablas con FK y hay 29: el `references(` de `posts` está partido en
dos líneas.

- `$V/docs/02-modelo-de-datos.md:687` «medida sobre las tres tablas de `listing`»
- `packages/db/src/schemas/post/post.dbschema.ts:50` «relatedAccommodationId: uuid('related_accommodation_id').references(»

**Camino de Juan.** Hospeda publica una nota del blog con la cabaña de Juan como alojamiento
relacionado. La ficha llega a `PURGED`. La FK es `onDelete: 'set null'`, pero `PURGED` no borra
la fila, así que la nota sigue apuntando a una ficha que para el turista no existe (precisión 7).
Cada implementador decide si la tarjeta desaparece, muestra un vacío o da error.

**Por qué BAJA.** No mueve plata ni datos de un tercero; es contenido editorial de Hospeda. Muestra
además que el vecino *«la lista cerrada no tiene guard»* de `14-` ya tiene un caso real (§4).
**Toca plata: no.** **Decisión del owner: no.** Arreglo de texto: una fila en *«lo que no es de la
ficha aunque la nombre»*, con `posts`, y la superficie tratándola como inexistente.

### `N-B-03` · BAJA · `PB9` puede correr el día del fin de servicio antes de la corrida que escribe el hecho 4

**Vecino de qué.** R5 le dio el hecho 4 a la corrida del reconciliador *«con la fecha
cumplida»*, que puede llegar hasta un día después del instante del fin de servicio. `PB9` relee
la cobertura (falsa ese día) y el reloj, y ninguna línea lo ordena contra esa corrida.

- `$V/docs/03-maquinas-de-estado.md:1290` «en su primera corrida»
- `$V/docs/03-maquinas-de-estado.md:578` «Relee la cobertura antes de borrar»

Buscado: `rg -n -i 'PB9.{0,120}(fin de servicio|finDeServicio)|…'` sobre `$V/docs`, el núcleo y
`B/10` no devuelve nada.

**Camino de Juan.** Su ficha archivada cumple el día 180 la misma mañana del fin de servicio.
El job de `PB9` corre antes que el reconciliador y la borra. Los tres avisos le decían que el
reloj arrancaba ahí.

**Por qué BAJA.** Una ventana de un día sobre las fichas cuyo día 180 cae justo en ella. **Toca
plata: no** (datos). **Decisión del owner: no.** Arreglo de texto: `PB9` no borra en una vertical
cuya `finDeServicio` ya pasó sobre una ficha con `inactiva_desde` anterior a esa fecha (el hecho
4 está pendiente), o la corrida del día corre antes que el job de `PB9`.

---

## 4. Los casos vecinos de `13-` y `14-`, hoy

| vecino | de | hoy | severidad | plata | pide |
|---|---|---|---|---|---|
| espejo del 3b en `D/16` y `B/21` | `13-` | **cerrado** por F (`R11-3b`) | n/a | n/a | n/a |
| *«primera corrida con la fecha cumplida»* pide recordar la anterior | `13-` | **abierto**; la invalidación repetida es barata y el hecho 4 es idempotente | BAJA | no | texto (o `N-B-03`) |
| frases de historia en `B/10` §4.3 (*«el acto recorría»*) | `13-` | abierto, leídas como historia; sin daño | BAJA | no | nada |
| cobro sobre la lápida de una sonda del manifiesto | `13-` | **cerrado** por B (R8): el handler consulta el manifiesto antes de cancelar | n/a | n/a | n/a |
| `T6`–`T8` emiten y la máquina de trial ya invalida | `13-` | abierto, dos caminos para lo mismo; sin daño | BAJA | no | nada |
| R27, revalidar las páginas | `14-` | **cerrado** por E: paso 4c de `D/16` §4.2 | n/a | n/a | n/a |
| recuento que detiene el corte en `D/16` y `B/21` §1.3 | `14-` | **cerrado** (espejos escritos, más `R9-b`) | n/a | n/a | n/a |
| `B/10` §4.1, retirar los vendibles | `14-` | **cerrado** por F (`R24`) | n/a | n/a | n/a |
| `PB10` contra `PB3` (y contra `PB9`) | `14-` | **abierto** | MEDIA | no | texto |
| `social_audit_log` guarda valores viejos y nuevos | `14-` | **cerrado por medición**: audita `social_post` y `social_post_target`, que no referencian fichas | n/a | n/a | n/a |
| `owner_promotions.accommodation_id` anulable | `14-` | **cerrado por lectura**: la lista dice *«las de esa ficha»*, y una sin ficha no cuelga | n/a | n/a | n/a |
| la lista cerrada no tiene guard | `14-` | **abierto**, y ya tiene un caso (`N-B-02`) | BAJA | no | **decisión** (pregunta 2) |
| `V/19` fila 23 y lo que lee `T8` | `14-` | abierto sin daño: `R15` no toca `T1` | BAJA | no | nada |

**`PB10` contra `PB3`, con el texto de hoy.** `PB10` sale de `DRAFT`, `PUBLISHED`,
`UNPUBLISHED_BY_BILLING` o `ARCHIVED`, y no toma el lock porque libera cupo. La justificación de
esa lista sólo mira el conteo. Si el admin modera una ficha mientras `PB3` la restituye, `PB3`
escribe `PUBLISHED` sobre lo que leyó antes. La regla 1 del núcleo (*«lo que no está, no pasa»*)
lo cortaría si la escritura compara el `desde`, pero el §9 le pidió a `PB8` y `PB9` que releyeran
el suyo justamente porque la lectura vieja no la corta: el texto obliga a adivinar. Arreglo:
extender la viñeta de `F-8V2A2-004` a `PB10` (o la regla general de verificar el `desde` en la
misma escritura). Sin decisión.

- `$V/docs/03-maquinas-de-estado.md:579` «| **PB10** | `DRAFT`, `PUBLISHED`, `UNPUBLISHED_BY_BILLING` o `ARCHIVED`»
- `$D/nucleo/03-maquinas-de-estado.md:35` «Un intento de»

**También siguen abiertas dos preguntas que tocan hallazgos de mi alcance** (no son vecinos de
`13-`/`14-`, pero `16-` las lista): la clase del correo de la alerta cerrada (`A2-006`, pregunta 4
de `14-`) y Outlook en la lista de `R23` (`A3-004`, vecino de `16-`).

- `$V/docs/02-modelo-de-datos.md:346` «Gmail y Outlook, y los que se midan»

### Preguntas para el owner

**Pregunta 1 · Outlook en la lista del seudónimo (`R23`).** La lista saca a la vez puntos y
`+alias` en Gmail y Outlook. No está medido que Outlook ignore los puntos; si no los ignora,
sacarlos junta dos casillas distintas.

1. **Medir en el paso 0 y separar las dos normalizaciones por proveedor** (puntos sólo donde se
   midió, `+alias` donde se midió). Costo: una medición y una columna más en la lista. Riesgo:
   ninguno. **Recomendada**: es lo que la frase *«y los que se midan»* ya pide.
2. Dejarlo como está. Costo: nada. Riesgo: falso positivo en Outlook.
3. Sacar Outlook hasta medirlo. Costo: nada. Riesgo: falso negativo (el `+alias` de Outlook da un
   trial nuevo).

*Juan*: `juan.perez@outlook.com` consumió su trial. Con la 2, su vecino `juanperez@outlook.com`,
otra persona, se queda sin trial. Con la 1, cada uno tiene el suyo si Outlook distingue los
puntos.

**Pregunta 2 · un guard para la lista cerrada de `PURGED`.** `N-B-02` muestra que la lista ya
nació incompleta.

1. **Un guard que recorra el esquema (FK a las tres tablas y `entity_type`) y falle si una tabla
   no tiene fila en `V/02` §4.1.** Costo: un guard más en `V/20` §2. Riesgo: ninguno.
   **Recomendada**: es la forma de `G-R6-B`, y la lista ya perdió una tabla.
2. Sin guard, con la lista corregida a mano. Costo: nada. Riesgo: la próxima tabla queda colgando
   de una ficha `PURGED` sin tratamiento.

*Juan*: alguien agrega el mes que viene `accommodation_reservations`; con la 1, el PR se pone
rojo hasta decir qué le pasa en `PURGED`; con la 2, la reserva de Juan sigue apuntando a una
ficha borrada.

**Pregunta 3 · la clase del correo de la alerta cerrada (`R9`).**

1. **Transaccional** (lo aplicado). Costo: nada. Riesgo: ninguno; el turista pidió el servicio.
   **Recomendada**.
2. Comercial. Riesgo: el opt-out lo suprime y el turista no se entera de que su alerta dejó de
   vigilar.

*Juan*: se dio de baja del marketing; con la 1 igual se entera de que su alerta sobre la cabaña
de Ana se cerró.

---

## 5. Texto vencido (BAJA, sin decisión)

1. **`B/10` §4.6 cita sin tachar una frase de `V/02` que ya cambió.** La cita dice que billing lee
   `admite_altas` y `fin_de_servicio`; en `V/02` §2.1 el `y fin_de_servicio` está tachado. La
   oración siguiente lo corrige, pero la cita quedó vieja.
   - `$B/docs/10-verticales-planes-billing-options.md:436` ««`admite_altas` y `fin_de_servicio` las lee billing»»
   - `$V/docs/02-modelo-de-datos.md:117` «~~y `fin_de_servicio` las~~ la»
2. **La fila de `G13` en el catálogo de guards no nombra el objeto.** El predicado sobre el módulo
   del cableado de billing está en el contrato §6.3 y en el criterio de V4, pero la fila que lee
   quien construye el guard sigue diciendo *«la implementación de arranque»*.
   - `$V/docs/20-testing.md:57` «la implementación de arranque de `cobertura()` llega a producción»

---

## Key Learnings

1. Un `rg` de `references(() => tabla.id` en una línea sólo cuenta las FK que el formateador dejó
   en una línea: `posts` tiene el `references(` partido y la lista *«medida»* lo perdió. La
   medición de esquema va con un regex que cruce saltos de línea.
2. Ordenar dos transiciones con un lock no alcanza cuando una de ellas no evalúa a la otra: `PB1`
   evalúa `T6` adentro, `PB3` no evalúa `T8`, y un evento que ocurre una vez pierde la carrera
   sin red (`N-B-01`).
3. Mudar un ejecutor a un job por calendario (*«su corrida del día»*) abre una ventana contra los
   otros jobs del mismo día que leen la misma columna; hay que ordenarlos o hacer que el segundo
   sepa que el primero está pendiente (`N-B-03`).
4. Una exención de lock justificada por el conteo (*«las que liberan cupo»*) no dice nada del
   `desde`: la misma pregunta que se contestó para `PB8` y `PB9` quedó abierta para `PB10`.
5. Seis de los trece vecinos de `13-` y `14-` los cerró un registro posterior; verificar el
   estado de un vecino contra el texto de hoy evita reportar como abierto lo ya aplicado.

---

> **Caducada en todo o en parte por la revisión del owner, 2026-09-28 (ver `30-revision-del-owner/14-` §4).** `N-B-01`: su arreglo era dentro de `R15`, que cae entera con `DEC-MIG-006` (C12, `L1-b`). Punto 39
> de [`14-aplicacion-transversal-y-lote.md`](../30-revision-del-owner/14-aplicacion-transversal-y-lote.md) §4.4.

# V8b · Superficies de Partner (Fase 4)

<a id="pieza-v8b"></a>
**[PIEZA:V8b](#pieza-v8b)** — pieza `V8b`, la mitad *b* de la unidad `V8`; **cuándo**: después, en
la **Fase 4** (con `V7`, a la que espera); **fuente**: Z (lista de piezas,
`16-fase-7-del-paraguas.md` §4.6; [DEC-ARCH-017](../01-decisiones-vigentes.md#dec-arch-017) punto 3).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:956

## Objetivo, alcance y fuera de alcance

**Objetivo.** Las superficies de Partner que la partición de `V8` dejó fuera del corte: lo que ve el
dueño de un Partner cuando su presencia deja de verse, el panel de postulaciones, las tres pantallas
del reclamo y la postulación, y la acción 25. **Es una pieza posterior, aditiva**: no reescribe filas
ni código del corte y no trae migración estructural ([GATE:FP](../30-el-corte.md#gate-fp)); la fila no tiene esquema propio
(`16-fase-7-del-paraguas.md` §4.6, nota bajo la tabla del esquema).

**Fase y gate.** Fase 4, con `V7`: `V8b` espera a `V7` ([GATE:FP.F4](../30-el-corte.md#gate-fp-f4)). Momento 1 por pieza
([GATE:M1](../30-el-corte.md#gate-m1)) y el gate propio de la fase: momento 2 sobre la rama de la fase ([GATE:FP.1](../30-el-corte.md#gate-fp-1)),
checklist de smoke extendido ([GATE:FP.2](../30-el-corte.md#gate-fp-2)) y drift guard en verde ([GATE:FP.3](../30-el-corte.md#gate-fp-3)).

<a id="fila-v8b"></a>
**FILA:V8b — Superficies de Partner** *(después)*. Qué deja funcionando:

1. **la fila 22 del `19` §4** —la presencia que dejó de verse o está moderada—;
2. **el panel de postulaciones** (corte del MVP, owner 2026-10-01, Z;
   `41-corte-del-mvp/00-propuesta.md` §1);
3. **las otras superficies de Partner que la partición dejaba sin mitad: las filas 32, 33 y 34 del
   `19` §4** (el reclamo de un Partner ya reclamado, el de un segundo Partner y la postulación con el
   correo sin verificar);
4. **la acción 25, *«vaciar la presencia de un Partner a pedido de su dueño»*** (corte del MVP, owner
   2026-10-01, Z: *«lo de Partner»*; §2.11 y §2.12).

**Capítulos**: `19` *(la fila 22 y el panel; y las filas 32, 33 y 34, Z)* · `08` §3 (núcleo) *(la
acción 25, Z)*. **Guards**: ninguno.
Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:70

**Alcance.** Lo de la fila, y la acción [ACC:25](../02-nucleo.md#acc-25), de la que es dueña. Toma de la unidad partida
[FILA:V8](../10-corte/V8a.md#fila-v8) y de su criterio [LISTA:V8](../10-corte/V8a.md#lista-v8) (que define `V8a`) sólo lo de Partner.

**Fuera de alcance**: el resto de `V8` (Mi Cuenta, las filas 20, 21, 23, 27, 28 y 29, las acciones 15,
23 y 24): `V8a` ([FILA:V8a](../10-corte/V8a.md#fila-v8a)); la máquina de la postulación, el reclamo y la acción que aprueba,
rechaza o anula la espera ([ACC:5](../02-nucleo.md#acc-5)): `V7` ([FILA:V7](V7.md#fila-v7)), sobre la que estas superficies se apoyan;
la marca de atrasada la decide el [PLAZO:8](../02-nucleo.md#plazo-8) (dueña `V7`) y el panel la muestra.

## Historias de usuario y criterios de aceptación

<a id="lista-v8b"></a>
**LISTA:V8b — «Lista cuando»**. *(Sin cláusula propia en las fuentes para la fila 22 y el panel: el
criterio de `V8` no los nombra; se derivan en esta spec desde `19` §4 fila 22 y `18`, con cita, por
la regla de `DEC-METH-019` (AL); corte del MVP, owner 2026-10-01, Z.)* La pieza está lista cuando:

1. *(derivada de `19` §4 fila 22 y `18` §1.6)* el dueño de un Partner cuya página o carrusel dejaron
   de mostrarlo ve en su Mi Cuenta que no se borró nada, que la presencia vuelve sola si recupera el
   plan que la otorga y que mientras tanto responde como inexistente; y, si la bajó un admin, que está
   moderada y el motivo;
2. *(derivada de `18` §2.3, §2.5 y `03` §11)* el panel de postulaciones muestra las `PENDIENTE` —las
   que pasaron el plazo, marcadas como atrasadas—, las `APROBADA` sin reclamar como un dato, y desde
   ahí se aprueba, se rechaza o se anula la espera;
3. **abrir un link ya usado con su secreto muestra la fila 32 y no dice a qué cuenta está vinculado, y
   con otro secreto contesta como un Partner que no existe**;
4. **reclamar un segundo Partner muestra la fila 33**;
5. **una cuenta con sesión y el correo sin verificar que postula recibe la fila 34 y no se crea
   ninguna postulación**;
6. **con un Partner, la 25 deja su presencia sin fotos, logo, secciones ni enlaces, en la base y en
   el almacenamiento externo, y su página responde 404** (§2.11, lote N-G) (corte del MVP, owner
   2026-10-01, Z: las cuatro últimas pasan de `V8a` a `V8b` por ser de Partner).
Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:721

### Historias de usuario

<a id="us-v8b-1"></a>
**US:V8b:1** — Como partner, quiero que Mi Cuenta me explique por qué mi página o mi carrusel dejaron
de verse y que no perdí nada, para saber cómo recuperarlo.
Actor: partner
Fuente: [FILA:V8b](#fila-v8b), [LISTA:V8b](#lista-v8b)

<a id="us-v8b-2"></a>
**US:V8b:2** — Como admin, quiero un panel de postulaciones con las pendientes, las atrasadas y las
aprobadas sin reclamar, para resolverlas sin que ninguna se rechace por omisión.
Actor: admin
Fuente: [FILA:V8b](#fila-v8b), [LISTA:V8b](#lista-v8b)

<a id="us-v8b-3"></a>
**US:V8b:3** — Como partner, quiero que el link de reclamo y la postulación me digan qué pasa cuando
el Partner ya tiene dueño, cuando ya tengo uno o cuando mi correo no está verificado, para saber qué
hacer.
Actor: partner
Fuente: [LISTA:V8b](#lista-v8b), [FILA:V8b](#fila-v8b)

<a id="us-v8b-4"></a>
**US:V8b:4** — Como admin, quiero vaciar la presencia de un Partner a pedido de su dueño, con motivo,
como parte de su baja de cuenta manual.
Actor: admin
Fuente: [ACC:25](../02-nucleo.md#acc-25), [LISTA:V8b](#lista-v8b)

### Criterios de aceptación

<a id="ac-v8b-1"></a>
**AC:V8b:1** — Fila 22: la presencia que dejó de verse.

- **Dado** un Gold que dejó de pagar, y otro Partner cuya presencia moderó un admin con motivo
- **Cuando** cada dueño abre su Mi Cuenta de Partner
- **Entonces** el primero ve que no se borró nada, que la presencia vuelve sola si recupera el plan
  que la otorga, y que mientras tanto responde como inexistente; el segundo ve además que está moderada
  y el motivo de la acción. *(Derivado de `19` §4 fila 22.)*
Fuente: [FILA:V8b](#fila-v8b), [LISTA:V8b](#lista-v8b)

<a id="ac-v8b-2"></a>
**AC:V8b:2** — El panel de postulaciones.

- **Dado** postulaciones `PENDIENTE` (una más vieja que el plazo de atrasada), `APROBADA` con y sin
  reclamo y `RECHAZADA`
- **Cuando** un admin con el permiso abre el panel
- **Entonces** ve las `PENDIENTE` con la atrasada marcada, las `APROBADA` sin reclamar leídas como
  `APROBADA` con el `partner` de `owner_user_id` nulo, y puede aprobar, rechazar o anular la espera
  (las acciones de `V7`); ninguna se resuelve sola. *(Derivado de `18` §2.3 y `03` §11.)*
Fuente: [LISTA:V8b](#lista-v8b), [FILA:V8b](#fila-v8b)

<a id="ac-v8b-3"></a>
**AC:V8b:3** — Fila 32: link de un Partner que ya tiene dueño.

- **Dado** un Partner ya reclamado
- **Cuando** alguien abre su link con el secreto correcto, y otro con un secreto equivocado o sin él
- **Entonces** el primero ve *«este Partner ya tiene dueño; si no fuiste vos, escribinos a soporte»*,
  sin vincular nada ni decir a qué cuenta está vinculado; el segundo ve la pantalla de un Partner que
  no existe.
Fuente: [LISTA:V8b](#lista-v8b)

<a id="ac-v8b-4"></a>
**AC:V8b:4** — Fila 33: reclamar un segundo Partner.

- **Dado** una cuenta que ya es dueña de un Partner
- **Cuando** reclama otro
- **Entonces** ve que una cuenta es dueña de un solo Partner, que el segundo negocio se reclama con
  otra cuenta y cómo contactar a soporte; el link no se gasta.
Fuente: [LISTA:V8b](#lista-v8b)

<a id="ac-v8b-5"></a>
**AC:V8b:5** — Fila 34: postular con sesión y el correo sin verificar.

- **Dado** una cuenta con sesión y el correo sin verificar
- **Cuando** postula un Partner
- **Entonces** ve que primero tiene que verificar el correo, con el botón que le reenvía la
  verificación, y no se crea ninguna postulación.
Fuente: [LISTA:V8b](#lista-v8b)

<a id="ac-v8b-6"></a>
**AC:V8b:6** — La acción 25: vaciar la presencia a pedido del dueño.

- **Dado** un Partner con fotos, logo, secciones y enlaces, y un admin con el permiso de la acción 25
- **Cuando** la ejecuta con motivo, después de confirmar
- **Entonces** la confirmación dice de qué Partner es, que su contenido se borra y que no vuelve; la
  presencia queda sin fotos, logo, secciones ni enlaces, en la base y en el almacenamiento externo; la
  fila de `partners` queda sin contenido; el cobro y la postulación no se tocan; su página responde
  `404`; y el acto queda registrado con actor, sujeto y motivo.
Fuente: [ACC:25](../02-nucleo.md#acc-25), [LISTA:V8b](#lista-v8b)

<a id="ac-v8b-7"></a>
**AC:V8b:7** — Salida: la pieza está lista.

- **Dado** la rama de la Fase 4 con `V7` y `V8b` mergeadas
- **Cuando** se corren los casos de [AC:V8b:1](#ac-v8b-1) a [AC:V8b:6](#ac-v8b-6)
- **Entonces** las seis cláusulas de su *«Lista cuando»* se cumplen y el drift guard de la rama de la
  fase sigue en verde.
Fuente: [LISTA:V8b](#lista-v8b), [FILA:V8b](#fila-v8b)

## Reglas

- **Ninguna superficie decide por sí misma**: lo que se oculta ya está rechazado por `V5` ([LISTA:V8](../10-corte/V8a.md#lista-v8)).
- **La presencia** responde como inexistente sin la clave o moderada (`18` §1.6); la fila 22 lo
  explica sólo a su dueño.
- **El reclamo** y sus reglas 4 y 5 (`18` §2.4; [DEC-AUTH-004](../01-decisiones-vigentes.md#dec-auth-004)) son de `V7`; acá están sus pantallas.
- **El paso 2 sobre `PP1` con sesión** ([DEC-AUTH-005#📌1](../01-decisiones-vigentes.md#dec-auth-005-p1)): la pantalla de la fila 34.
- **La acción 25** ([ACC:25](../02-nucleo.md#acc-25)): destructiva, capacidad del actor, no es moderar ni toca el cobro.

## Modelo de datos y migraciones

N/A — sin esquema propio (`16-fase-7-del-paraguas.md` §4.6, nota bajo la tabla del esquema) ni
migración: la acción 25 borra contenido de la tabla `partners` que ya existe, y los datos del panel
son los de `postulacion` y `partner`, que crea `V6` ([ESQ:2](../10-corte/V6.md#esq-2)).

## API

- **Protected**: Mi Cuenta de Partner con el estado de la fila 22 (sólo para su dueño); el reclamo
  devuelve el caso de las filas 32 y 33; la postulación con sesión sin verificar, el de la fila 34.
- **Admin**: el listado del panel de postulaciones; la acción 25, con permiso propio, motivo y
  confirmación.
- **Errores**: link con secreto equivocado → como un Partner que no existe (`404`).

## UI web y admin, e i18n

- **Web**: las filas 22, 32, 33 y 34 del `19` §4, con los textos que esas filas fijan (fila 32: *«este
  Partner ya tiene dueño; si no fuiste vos, escribinos a soporte»*).
- **Admin**: el panel de postulaciones y la confirmación de la acción 25.
- **i18n**: todo texto en `@repo/i18n` (es/en/pt).

## Cron y outbox

N/A — la fila no declara jobs ni correos; la marca de atrasada es una lectura del panel, no un job
(`18` §2.3).

## Variables de entorno

N/A — la fila no declara variables.

## Auditoría y observabilidad

La acción 25 deja registro con actor, sujeto y motivo (`NUCLEO/08` §1.2 y §3). Abrir el panel es un
admin leyendo datos ajenos: auditable (`NUCLEO/08` §1.1, criterio 3).

## Seguridad

La fila 32 se muestra sólo con el secreto correcto y nunca revela la cuenta vinculada; la fila 22 sólo
a su dueño: para todo otro la presencia no existe.

## Testing esperado

<a id="test-v8b-1"></a>
**TEST:V8b:1** — E2E web: Mi Cuenta de un Partner sin clave y de uno moderado muestra la fila 22 con y
sin el motivo.
Tipo: e2e web
Cubre: [AC:V8b:1](#ac-v8b-1)
Fuente: [FILA:V8b](#fila-v8b)

<a id="test-v8b-2"></a>
**TEST:V8b:2** — E2E admin: el panel lista pendientes, atrasada marcada y aprobadas sin reclamar, y
aprueba, rechaza y anula la espera.
Tipo: e2e admin
Cubre: [AC:V8b:2](#ac-v8b-2)
Fuente: [FILA:V8b](#fila-v8b)

<a id="test-v8b-3"></a>
**TEST:V8b:3** — Ruta API: link usado con el secreto correcto → fila 32 sin cuenta; con otro secreto
→ `404`.
Tipo: ruta API
Cubre: [AC:V8b:3](#ac-v8b-3)
Fuente: [LISTA:V8b](#lista-v8b)

<a id="test-v8b-4"></a>
**TEST:V8b:4** — E2E web: reclamar un segundo Partner muestra la fila 33 y el link sigue sin gastar.
Tipo: e2e web
Cubre: [AC:V8b:4](#ac-v8b-4)
Fuente: [LISTA:V8b](#lista-v8b)

<a id="test-v8b-5"></a>
**TEST:V8b:5** — Ruta API: postular con sesión y correo sin verificar → fila 34 y cero filas en
`postulacion`.
Tipo: ruta API
Cubre: [AC:V8b:5](#ac-v8b-5)
Fuente: [LISTA:V8b](#lista-v8b)

<a id="test-v8b-6"></a>
**TEST:V8b:6** — Integración: la acción 25 vacía la presencia en la base y en el almacenamiento
externo (fake), deja cobro y postulación intactos, registra actor, sujeto y motivo, y la página
responde `404`.
Tipo: integración con DB
Cubre: [AC:V8b:6](#ac-v8b-6)
Fuente: [ACC:25](../02-nucleo.md#acc-25)

<a id="test-v8b-7"></a>
**TEST:V8b:7** — E2E admin: la confirmación de la acción 25 nombra el Partner y dice que no vuelve.
Tipo: e2e admin
Cubre: [AC:V8b:6](#ac-v8b-6)
Fuente: [ACC:25](../02-nucleo.md#acc-25)

<a id="test-v8b-8"></a>
**TEST:V8b:8** — Drift guard sobre la rama de la Fase 4: ninguna migración estructural.
Tipo: guard estático
Cubre: [AC:V8b:7](#ac-v8b-7)
Fuente: [LISTA:V8b](#lista-v8b)
Mutación: agregar en la rama de la fase una migración estructural; el drift guard falla.

## Smoke y etiquetas

N/A como etiqueta de la pieza ([GATE:M1](../30-el-corte.md#gate-m1)): el smoke de estas superficies va en el checklist
extendido de la Fase 4 ([GATE:FP.2](../30-el-corte.md#gate-fp-2)), condición del gate de la fase.

## Dependencias, rollback y despliegue

- **Espera a**: `V8a` (`V8a → V8b`) y `V7` (`V/descomposicion.md` §3).
- **Fase**: 4 ([GATE:FP.F4](../30-el-corte.md#gate-fp-f4)), rama épica nueva que entra a `staging` entera ([GATE:FP](../30-el-corte.md#gate-fp)).
- **Despliegue**: momento 1 ([GATE:M1](../30-el-corte.md#gate-m1)) y el gate de la fase ([GATE:FP.1](../30-el-corte.md#gate-fp-1), [GATE:FP.2](../30-el-corte.md#gate-fp-2),
  [GATE:FP.3](../30-el-corte.md#gate-fp-3)).
- **Rollback**: aditiva y sin esquema; revertir la rama de la fase no toca nada del corte.

## Labels de Linear

- Issue: todavía no tiene; entra al árbol de Linear desde esta spec (`V/descomposicion.md` §5;
  [DEC-ARCH-017](../01-decisiones-vigentes.md#dec-arch-017), implicación 3).
- **Sin** etiqueta `status-needs-smoke-*` ([GATE:M1](../30-el-corte.md#gate-m1)).
- Las etiquetas son `kind-spec` más las `area-*` de la fila, y quedan escritas acá al mergear (owner
  [BS](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs), con sus defaults en
  [DEC-METH-019#📌5](../01-decisiones-vigentes.md#dec-meth-019-p5); `16-fase-7-del-paraguas.md` §4.7,
  momento 1); el PR de la pieza propone las `area-*` siguiendo lo escrito del repo.

## Abiertos

Ninguno: las cláusulas derivadas (1 y 2 de la *«Lista cuando»*) están marcadas como tales.

## Origen

- `V/descomposicion.md` §2, filas `V8` y `V8b` (l. 68 y 70); §3; §4, fila `V8b` (l. 721); §5.
- `V/docs/19-superficies.md` §4, filas 22, 32, 33 y 34 (l. 69, 79–81).
- `V/docs/18-partner.md` §1.6, §2.3, §2.4; `V/docs/03-maquinas-de-estado.md` §11.
- `NUCLEO/08` §3, acción 25 (l. 215).
- `16-fase-7-del-paraguas.md` §4.6 (l. 956, nota del esquema l. 994–997) y §4.7 (fases posteriores).

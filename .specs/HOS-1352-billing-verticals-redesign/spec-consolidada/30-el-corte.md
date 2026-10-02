# 30 · El corte

Los pasos del corte (`PASO:*`), la rama de aborto y el rollback, los gates de aceptación
(`GATE:*`) y el smoke del cobro nuevo, en su forma vigente: sin tachados y sin lo que salió. Lo que
salió está en [90-retirados.md](90-retirados.md) (el paso 4, por ejemplo). Al final, la pseudo-pieza
`CORTE` ([BE](01-decisiones-vigentes.md#own-41-corte-del-mvp-t7-be),
[DEC-METH-019#📌3](01-decisiones-vigentes.md#dec-meth-019-p3)): los `AC:CORTE:n` y
`TEST:CORTE:n` de los ítems cuya dueña en el contrato de cobertura es el corte, con tipo smoke
manual o guard estático.

Cómo se lee cada paso: **qué se hace**, **quién lo hace** y **por qué en ese lugar**, las tres
columnas de la tabla del §4.2 de `D/16`. Cuando un paso lo construye una pieza, el paso dice cuál,
y su AC vive en el archivo de esa pieza, no acá.

Lo que el sistema nuevo aporta al corte, por pieza: el script suelto del corte es de
[U3](10-corte/U3.md#pieza-u3) (pasos 1a, 1b, 2 y 4b); los dos `permanent_grant` del 3b, de
[B9a](10-corte/B9a.md#pieza-b9a); el estado de nacimiento, la escritura `C`, las cinco pruebas, la
tabla de paso, el 4c, el 5b y el 6, de [V6](10-corte/V6.md#pieza-v6); el checklist de smoke, de
[B13a](10-corte/B13a.md#pieza-b13a); el SQL del catálogo que la migración del paso 3 lleva, de
[V2](10-corte/V2.md#pieza-v2). La regla del borde no es código de ninguna épica: la aplica y la
verifica quien opera el corte.

## Los pasos del corte

<a id="paso-0"></a>

### Paso 0 · el ensayo, `EX-49` y el tope de purgas

**Qué**: desde la simplificación del corte, **tres cosas, y una sola lee producción, sin mutar
nada: el despliegue ensayado entero en `staging` y verde, la medición de la lista de proveedores
del seudónimo (`EX-49`) y la verificación del tope de purgas del borde** (FASE 5, owner
2026-09-30, simplificación del corte, D y E; S-16, S-33, S-34, S-35). **La medición de `EX-49` se
registra con la etiqueta `prod`**, porque lee la tabla de usuarios de producción y es gate del
corte real (corte del MVP, owner 2026-10-02, BQ Q2;
[DEC-ARCH-016#📌2](01-decisiones-vigentes.md#dec-arch-016-p2)).

- **El ensayo** (FASES 6 y 7, owner 2026-09-30, C y B; *«verde»*, lo derivado D-5, también
  aprobado): corre sobre **una copia de la base de producción restaurada en `staging`, con los
  correos reescritos a una casilla que no entrega y la lista real de las cinco cuentas**, y la copia
  se borra al terminar el ensayo; **arranca con la imagen vieja desplegada en `staging`**, porque si
  no, no se ensaya el apagado del viejo ni el acto de migrar; **lleva adentro la parte de `staging`
  del checklist de smoke del sistema nuevo**, que escribe `B13a` en `docs/billing/` (B; corte del
  MVP, owner 2026-10-01, Z); corre el script del corte de `U3`, ya mergeado (F); **recorre la rama
  de aborto una vez, sobre la misma copia** (corte del MVP, owner 2026-10-02, BQ Q1; abajo, *«La
  rama de aborto»*, en el [paso 2b](#paso-2b)); y **es verde cuando
  cada verificación que el §4.2 nombra pasó, en su orden, sin tocar nada a mano fuera de lo que el
  paso dice**: cualquier intervención no escrita lo vuelve rojo y se escribe antes del reintento
  ([GATE:M3](#gate-m3)). **El despliegue, ensayado en `staging` y verde.**
- **`EX-49`, la lista de proveedores del seudónimo del correo** (FASE 9 vuelta 2, verificación,
  owner 2026-09-28, `V2-j4`; `V/02` §2.2;
  [MP:EX-49](04-catalogos.md#mp-ex-49)): **la distribución de dominios de la tabla de usuarios de
  producción**, que es el único dato de cuota confiable (**la herramienta sólo cuenta dominios: no
  exporta ni guarda casillas**; `V2-w`), y **la prueba de unos 30 correos** de
  `29-fase-8-vuelta-2/25-lista-de-proveedores-del-seudonimo.md` §4, **con cuentas receptoras nuevas
  que crea el owner** en Outlook, Hotmail, Yahoo, Proton, iCloud y Gmail, cada una con una parte
  local con puntos, aleatoria e improbable, para que ninguna variante sea la casilla de un tercero.
  Por cada correo se anota la hora, el destinatario exacto, el Message-ID y el resultado: *llegó*,
  *rebote* con su código y su texto, o *nada a los 30 minutos*, revisado el spam. Un rebote a la
  variante sin puntos prueba que los puntos cuentan; que llegue, que los ignora; *nada* no prueba
  nada y se repite. Sondear por SMTP no sirve. **Con el resultado queda fija la lista que lleva el
  despliegue del paso 3**, porque la primera fila de `trial` la escribe el sistema nuevo y el
  seudónimo no se recalcula. **Y desde C12 es condición del corte** (revisión del owner,
  2026-09-28, C12): la primera fila de `trial` son **las cinco pruebas que la herramienta del corte
  de `V6`, que es del sistema nuevo, escribe después de la migración del paso 3, a las cuentas de la
  lista cerrada del owner** (FASE 5, lote de la aplicación, owner 2026-09-30, B; verificación,
  `VF5-01`; FASE 5, owner 2026-09-30, lote 2 D y simplificación del corte, A; S-12), así que **la
  lista tiene que estar cerrada y medida antes del corte, y sin medición el corte no avanza**. Lo
  que sigue vale para qué entra en la lista, no para si se mide: lo que la tabla de `V/02` §2.2 da
  como *«si la medición lo confirma»* entra sólo si lo confirma, y lo que la medición muestre fuera
  de la tabla vuelve al owner y, mientras no conteste, no se aplica; las dos son la lectura que no
  normaliza ante la duda. Es la fila `EX-49` de la matriz (`V2-y`).
- **El tope de purgas del plan del borde (Cloudflare)**: junto a `EX-49`, antes del 4c, se verifica
  cuál es, y que las 22 purgas por destino del 4c entran en él (`V2-t`). Es una lectura de la
  configuración del borde y no del proveedor de pagos, así que no lleva fila de matriz (`V2-z3`).

**Quién**: —.

**Por qué acá**: lo irreversible (paso 1) sólo arranca cuando lo que puede fallar (paso 3) ya se
probó (FASE 8 completa, `F-8CC2-004`). No hay mitad en producción: la rama de aborto ya no reactiva
planes, así que no hay nada que probar en producción (FASE 5, owner 2026-09-30, simplificación del
corte, D; S-16).

**Y el orden no se invierte, aunque el paso 1 sea irreversible.** La FASE 8 completa señaló
(`F-8CC2-004`) que lo irreversible va antes de lo que puede fallar. El remedio no es cancelar al
final, porque eso reabre la razón del [paso 1a](#paso-1a): **un cobro entre el despliegue y la
cancelación no deja asiento** (§4.1). El remedio es el **paso 0** y una rama de aborto declarada
([paso 2b](#paso-2b)).

Dueña del AC: la pseudo-pieza `CORTE` ([AC:CORTE:1](#ac-corte-1), [AC:CORTE:2](#ac-corte-2),
[AC:CORTE:19](#ac-corte-19)).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:146, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:425, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:430

<a id="paso-0b"></a>

### Paso 0b · bloquear toda escritura

**Qué**: **bloquear toda escritura: una sola regla en el borde (Cloudflare) rechaza todo lo que no
sea mirar, en el sitio viejo y en el nuevo, salvo la ruta de avisos de Mercado Pago, desde este paso
hasta el paso 5**, **o, si el corte se aborta, hasta el reintento** (FASE 5, lote de la aplicación,
owner 2026-09-30, A; elegida contra la recomendación; [rama de aborto](#paso-2b)), verificada con
una petición de escritura desde afuera que vuelve rechazada *(cómo se verifica lo derivó la fuente
y lo marca)* (FASE 5, owner 2026-09-30, simplificación del corte, B; S-25, S-26). No hay lista de
rutas ni espera antes del 1a (S-72). Juan puede ver su ficha, pero no loguearse ni editar esas
horas.

**Quién**: quien opera el corte.

**Por qué acá**: el censo del 1b sólo cuenta lo que existe al tomarlo; lo que el viejo venda
después no lo ve ningún paso (FASE 9 vuelta 1, `F-8V1C2-003`, `F-8V1B3-006`). **Y como nadie
escribe, nadie crea una cuenta ni una ficha en el medio**: un usuario durante el corte no se diseña
([DEC-MIG-007](01-decisiones-vigentes.md#dec-mig-007), punto 2). Una `Preference` abierta del viejo
es de una de las cinco cuentas, a quien el owner le pide no pagar nada en el viejo (S-43, S-72).
**Por qué el borde y no una bandera**: el viejo no tiene interruptor de checkout y agregarle código
a un sistema condenado es el argumento con que `12-contrato…` §5.3 descartó el adaptador. **Y la
regla del borde no es un interruptor** (revisión del owner, 2026-09-28, C2): es un acto operativo
del corte, fechado y verificado, fuera del código de los dos sistemas.

**La regla que bloquea toda escritura**, como herramienta del corte (punto 5 de *«las herramientas
del corte»*): del 0b al paso 5 (FASE 5, owner 2026-09-30, simplificación del corte, B; S-25) **y, si
se aborta, queda puesta hasta el reintento** (FASE 5, lote de la aplicación, owner 2026-09-30, A):
configuración de Cloudflare, no código de ninguna épica; la aplica y la verifica quien opera el
corte. La ruta de avisos queda abierta durante todo el corte, como única excepción de la regla
([DEC-ARCH-014#📌4](01-decisiones-vigentes.md#dec-arch-014-p4)). Durante la ventana del corte, del
0b al 5, no hay altas, ni en el sistema viejo ni en el nuevo
([DEC-MIG-002#📌1](01-decisiones-vigentes.md#dec-mig-002-p1)), y esto no suspende `DEC-MIG-002`
—su alcance es el rediseño, y el corte es su final—: por esos minutos nadie puede suscribirse, y el
owner avisa cuando él elija (owner 2026-09-26, FASE 9 vuelta 1, `G4-1`; revisión del owner,
2026-09-28, C12; FASE 5, simplificación del corte, S-52).

**No hay convivencia ni interruptores** (§1 de `D/16`): `coexistence` no existe, por decisión
(revisión del owner, 2026-09-28, C2): no hay convivencia entre el sistema viejo y el nuevo, ni
código para sostenerla; el nuevo se despliega entero de una vez, en el [paso 3](#paso-3). `feature
flags` no existen, por decisión (C2): ningún interruptor en el código de ninguno de los dos
sistemas. La regla del borde de los pasos 0b y 5 **y el apagado de los crons entre el paso 3 y el 5
con `HOSPEDA_CRON_ADAPTER`**, una variable de proceso que ya existe y no agrega código (FASE 5,
owner 2026-09-30, lote 3 E), **no son interruptores**: son actos operativos del corte, fechados y
verificados, y se quedan. Tampoco lo es `G13` (`V/20` §2), que impide que un build de producción
importe la implementación de arranque ([GUARD:G13](04-catalogos.md#guard-g13)).

Dueña del AC: la pseudo-pieza `CORTE` ([AC:CORTE:3](#ac-corte-3)).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:147, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:403, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:217, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:49, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:51, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:52

<a id="paso-1a"></a>

### Paso 1a · cancelar los `preapproval_plan` viejos

**Qué**: **cancelar los `preapproval_plan` viejos**, tomados, como los del 1b, **del proveedor**
—todo `preapproval_plan` de la cuenta que no esté `cancelled`— y no de `billing_mp_plan` (FASE 9
completa, `DB-3`). No se vencen `Preference` (FASE 5, owner 2026-09-30, simplificación del corte,
C; S-43).

**Quién**: **el script del corte**, con cada llamada verificada (revisión del owner, 2026-09-28,
L3-a), que construye [U3](10-corte/U3.md#pieza-u3).

**Por qué acá**: cierra los links públicos que siguen vendiendo; **es reversible** (sonda 50) y por
eso va primero. Cualquier ficha de Gastronomía o de Experiencia que no sea de las cinco se borra en
el paso 3 (S-07). El «NO cierra» de `B/09` sobre el pago de única vez es de producto y queda
(S-43, S-44).

**El punto de no retorno no desapareció: subió de escala** (§4.1). Decidir que **no se migra**
eliminó el punto de no retorno **por fila** y **dejó intacto el del programa**, que es el que
importa: **una autorización viva cobra DESPUÉS del despliegue que borró el código capaz de
reconocerla.** La persona paga, el dinero entra, y del lado de Hospeda **no queda ni servicio ni
asiento contable**: el sistema que sabía qué era ese identificador ya no existe, y el nuevo nunca lo
conoció. Son **tres** las que pueden hacerlo **según nuestra base** —las únicas con preapproval vivo
en ella—, y que sean pocas no cambia nada: **un cobro que entra sin asiento no es un problema de
escala.** **Y la base no las ve todas**: el 2026-09-24 el recorrido del proveedor encontró una
cuarta autorización viva que la base no conocía, por eso el censo del paso 1b sale del proveedor.

**Por qué no cancelar después de desplegar**, que es el orden intuitivo: el argumento de que el
código que sabe cancelar se iba con el despliegue **ya no vale** (revisión del owner, 2026-09-28,
C2 y L3-a): el script del corte no se va con ningún despliegue. **El orden se sostiene igual por la
otra razón, la del §4.1**: una autorización viva que cobra entre el despliegue y su cancelación
llega a un sistema que no la conoce y no deja asiento; cancelada antes, su cobro en vuelo lo
registra el viejo o lo recibe el receptor nuevo como desconocido (S-40).

Dueña del AC: [U3](10-corte/U3.md#pieza-u3).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:148, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:122, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:127, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:131, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:136, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:226

<a id="paso-1b"></a>

### Paso 1b · cancelar todos los preapprovals vivos

**Qué**: **cancelar TODOS los preapprovals vivos de la cuenta**, **incluidas las sondas salvo las
enumeradas abajo** (FASE 9 completa, `DB-1`), tomados del **recorrido sin filtro del proveedor** y
no de nuestra base. *«Vivo»* es **todo estado releído distinto de `cancelled`**: `pending`,
`authorized` y `paused` (FASE 9 completa, `DB-2`).

**Quién**: **el script del corte** (revisión del owner, 2026-09-28, L3-a), de
[U3](10-corte/U3.md#pieza-u3).

**Por qué acá**: **el script no depende de ninguno de los dos sistemas**: habla directo con el
proveedor, así que el despliegue del paso 3 no se lo lleva (revisión del owner, 2026-09-28, C2 y
L3-a). El censo sale del proveedor porque la base no ve las autorizaciones que nunca se vincularon
(`F-8CC2-002`, `F-8CB3-001`).

**Las sondas también se cancelan en el paso 1b**, salvo las que tengan una medición abierta el día
del corte, que se enumeran por id en un manifiesto versionado (declarado por `DEC-METH-015`, FASE 9
completa, `DB-1`). **El que lee el handler de producción antes de cancelar un preapproval
desconocido no puede vivir en `mp-probes/`** (FASE 9 vuelta 3, F-8V3C2-008): esa carpeta es de la
spec, está marcada no productiva y sale del repositorio al cerrar HOS-1352. **Vive en el código del
package del cobro, importado como módulo; si falta, no compila** (FASE 9 vuelta 3, owner
2026-09-30, lote V; `F-8V3B3-006`, `F-8V3C2-008`): versionado con él, así que cada despliegue lo
lleva, y no hay rama *«si no lo encuentra»*. Agregar o sacar una sonda es un cambio de código con su
despliegue. El de `mp-probes/` queda como registro de las mediciones. *(El lugar exacto del archivo
es de la FASE 5, como el nombre del package; la fuente lo derivó y lo marca.)* `B/09` §2.4 y `B/06`
§9 dicen lo mismo. **Causa**: toda sonda viva que cobre después del corte llega como desconocida.
Las enumeradas cobran la tarjeta del owner y caen **en una lápida de recepción**: no tienen lápida
del corte y su `external_reference` no nombra ninguna fila, así que la precondición de
re-vinculación no las re-vincula y el handler escribe al recibir el primer cobro una lápida de
recepción (`clase = LÁPIDA`; FASE 5, lote de la aplicación, owner 2026-09-30, I; `VF5-03`), de la
que cuelgan el `payment` y la marca `PAGO_TARDÍO_RECHAZADO`; los cobros siguientes se cuelgan de esa
misma marca, un solo caso por sonda (`B/09` §2.4, `B/21` §2.5; owner 2026-09-25, FASE 9 completa,
`2b`; owner 2026-09-26, `G3-2`).

**Por qué el censo sale del proveedor, y no es una hipótesis.** El 2026-09-24 el recorrido sin
filtro de los 108 preapprovals de la cuenta encontró una autorización viva, del propio owner, que
la base no conocía: `f6d89f71…`, creada desde el link del plan Basic, con un cobro de ARS 18.000
vencido esa misma noche. Se canceló antes de que cobrara (`25-fase-8-completa/00-hallazgos.md` §4).
Con el censo de la base, ese preapproval **sobrevivía al corte y cobraba**. Y los cinco planes
viejos seguían `active` con su link vendiendo, medido en el navegador.

**La ventana entre el paso 1 y el paso 3 es la parte incómoda, y se declara**: durante ese rato el
sistema viejo sigue corriendo con las suscripciones del censo canceladas. Si entra un cobro en vuelo
de una que la base conoce, lo registra el viejo; si es de una que sólo estaba en el proveedor, el
viejo no la reconoce y **le llega al receptor nuevo como un desconocido más: lápida de recepción,
cancelación y la marca que le pone delante al owner la devolución para que decida** (FASE 5, owner
2026-09-30, simplificación del corte, C; S-40, S-41, S-46). Sigue existiendo el lugar donde
anotarlo. Al revés, con el despliegue primero, ese mismo cobro cae en el vacío. *(Lo que el viejo
anote en esta ventana no se conserva después del corte: owner 2026-09-25, FASE 9 completa, `2a`;
`B/21` §4.)* **Y en esa ventana nadie escribe nada**: la regla del [0b](#paso-0b) bloquea toda
escritura, salvo los avisos de Mercado Pago, hasta el paso 5.

**Lo que la persona ve en la ventana** (declarado por `DEC-METH-015`, FASE 9 vuelta 1,
`F-8V1C2-010`): al cancelar el 1b, el viejo recibe cada cancelación y manda su correo de baja; no
se suprime: lo anticipa el aviso en persona del owner (revisión del owner, 2026-09-28, C12), y las
fichas no las baja. **Causa**: tocar el código viejo para silenciarlo cuesta más que decirlo, y no
mueve plata.

Dueña del AC: [U3](10-corte/U3.md#pieza-u3).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:149, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:163, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:175, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:178, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:202, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:211, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:334, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:336, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:338, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:418

<a id="paso-2"></a>

### Paso 2 · verificar: relectura por id y completitud del recorrido

**Qué**: **verificar releyendo cada uno por su id** y confirmar que quedó `cancelled`. **Y verificar
que el recorrido fue completo**: el conteo del recorrido tiene que igualar el `total` del paginado,
y **todo id conocido** —los de la base y los de los manifiestos de sonda— tiene que aparecer en él;
si no, el corte no avanza (owner 2026-09-25; FASE 9 completa, `2f`). **Desde la simplificación del
corte el paso 2 es esto y nada más: la relectura por id y la completitud del recorrido** (FASE 5,
owner 2026-09-30, simplificación del corte, E; S-31). Las cinco filas del seudónimo las escribe la
herramienta y se verifican a mano (S-36; lote 2 D).

**Quién**: ídem (el script del corte, de [U3](10-corte/U3.md#pieza-u3)).

**Por qué acá**: `D5` ya lo exige para toda mutación, y `RC-1` mide que leer por id es confiable
(FASE 9 vuelta 2, `F-8V2C2-007`: `RC-2` es el historial de pagos) — **buscar no** (`RC-1`). La
completitud del recorrido sin filtro no es fila de la matriz: este control la vuelve condición del
gate **para los ids conocidos**; una autorización desconocida que el recorrido omita no la ve ningún
control del corte (§4.3; FASE 9 vuelta 1, `F-8V1B3-005`; ver el [paso 2b](#paso-2b), *«lo que este
orden NO resuelve»*).

**El paso 2 es el gate, y es lo único que vuelve segura la secuencia**: si algún plan o preapproval
**no se pudo cancelar**, el corte **no avanza**. Es la misma forma que el programa ya usa en todas
partes —verificar releyendo en vez de creerle al código de estado— aplicada al único momento donde
no hay vuelta atrás. **El punto de no retorno tiene una ubicación declarada: está entre el paso 2 y
el paso 3** (§4.3).

Dueña del AC: [U3](10-corte/U3.md#pieza-u3).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:150, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:197, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:513

<a id="paso-2b"></a>

### Paso 2b · backup de la base

**Qué**: **backup de la base**.

**Quién**: —.

**Por qué acá**: es lo que restaura la rama de aborto si el paso 3 falla con algo ya escrito (owner
2026-09-25; FASE 9 completa, `2e`). **Y desde la simplificación del corte, abortar es eso y nada
más: restaurar este backup y volver a la imagen vieja, sin reabrir la venta** (FASE 5, owner
2026-09-30, simplificación del corte, D; S-15, S-22). También restaura las fichas que la migración
del paso 3 borró (S-02).

#### La rama de aborto

**Si algo falla después del paso 1b** —un preapproval que el paso 2 no ve `cancelled` después de
reintentar la cancelación, un recorrido que el control del paso 2 no da por completo, o el paso 3,
que desde la FASE 9 vuelta 2 incluye el 4b— (FASE 9 completa, `DB-4`):

**Desde la simplificación del corte, abortar es restaurar el backup del 2b y volver a la imagen
vieja, sin reabrir la venta**: las cinco cuentas esperan el reintento, y el owner les avisa (FASE 5,
owner 2026-09-30, simplificación del corte, D; S-15). Nadie reactiva planes ni se re-suscribe por
ningún link.

**Después de un aborto, la regla del 0b que bloquea toda escritura queda puesta hasta el
reintento**: la plataforma entera, las cinco cuentas incluidas, queda en sólo lectura mientras
tanto, sin lista de rutas; así el viejo no vuelve a vender por su checkout propio (FASE 5, lote de
la aplicación, owner 2026-09-30, A;
[DEC-MIG-002#📌3](01-decisiones-vigentes.md#dec-mig-002-p3),
[DEC-MIG-005#📌7](01-decisiones-vigentes.md#dec-mig-005-p7)). **Elegida contra la recomendación**:
la recomendada era levantar la regla general y bloquear, hasta el reintento, sólo las rutas de venta
del viejo, para no dejar el sitio en sólo lectura por un plazo que nadie fijó
(`38-fase-5/21-cruces.md` §5 A). El costo queda declarado y aceptado: si el reintento tarda días, la
plataforma entera queda en sólo lectura esos días.

**Y el ensayo del paso 0 la recorre una vez** (corte del MVP, owner 2026-10-02, BQ Q1;
[DEC-ARCH-016#📌2](01-decisiones-vigentes.md#dec-arch-016-p2)): en `staging`, sobre la misma copia,
con una falla provocada después del 1b, y verifica restaurar el 2b, redesplegar la imagen vieja, los
inversos (b) y (c) de abajo y la regla del 0b puesta hasta el reintento. Es la única red que ve esta
rama antes del día del corte.

El sistema viejo **sigue corriendo**: si el paso 3 —que termina con el despliegue sano, las cinco
pruebas escritas, el 3b verificado y la sonda del 4b cancelada (FASE 9 vuelta 2)— alcanzó a escribir
algo —la migración estructural, `inactiva_desde` y el estado de nacimiento, el borrado de las demás
fichas, las cinco pruebas, los dos grants (FASE 5: lote 1 J, lote 2 D, S-40)—, **se restaura el
backup del paso 2b**. **Lo que el backup no puede pisar es lo que el corte cambió afuera de la base, y
hasta el 4b son dos cosas, cada una con su inverso** (FASE 9 vuelta 2, `F-8V2A3-002`,
`F-8V2C2-001`; la de la ruta en el borde salió con el Worker: FASE 5, owner 2026-09-30,
simplificación del corte, C; S-24, S-45):

- **(b) la sonda de la entrega**, que no está en el manifiesto del 1b ni en la base restaurada:
  antes de restaurar se relee por su id y, si no está `cancelled`, se cancela y se verifica (FASE 9
  vuelta 1, `N-G4V-03`);
- **(c) el pago chico del 4b** (lote N-D), que ocupa el lugar de la URL de IPN, que ya no se apunta
  (verificación corta, 2026-09-29, lote O-B): si el 4b alcanzó a hacerlo y no a devolverlo, antes de
  restaurar se devuelve y se relee por id la devolución; su id y el de la devolución están en el
  manifiesto del corte. *(La fuente lo derivó y lo marca: es plata del owner que el corte movió
  afuera de la base, como la sonda de (b).)*

Los dos inversos son del script del corte de [U3](10-corte/U3.md#pieza-u3) (corte del MVP, owner
2026-10-01, BF). **Las fotos y los tokens de calendario de las fichas borradas no están en la lista
porque nada los toca antes del 5b**, que corre pasado el punto donde la rama deja de cubrir; **ni el
caché de páginas públicas, por la misma razón: lo revalida el 4c** (FASE 9 vuelta 2,
`F-8V2C2-006`). Fuera de esas dos no hay ninguno: la regla del 0b bloquea toda escritura hasta el
paso 5 y los crons del sistema nuevo siguen apagados (FASE 9 vuelta 1, `F-8V1A3-005`; owner
2026-09-26, `G4-1`; FASE 5, owner 2026-09-30, lote 3 E y simplificación del corte, B). Y el viejo
vuelve a correr sobre su propio esquema. **Si el paso 3 alcanzó a reemplazar la imagen**: se vuelve
a desplegar la imagen vieja, se reencienden su webhook y sus crons (lo inverso de `DB-5`) y se
verifican los dos, igual que su apagado (FASE 9 vuelta 1, `F-8V1C2-007`; owner 2026-09-25; FASE 9
completa, `2e`). Así el reintento del corte escribe `inactiva_desde` con **su** instante, y la regla
de *«una sola vez»* de la escritura `C` (`NUCLEO/01` §1.2) vale por corte que **termina**. Lo que el
viejo anotó entre el backup y la restauración se pierde, y no importa: tampoco se conserva después
de un corte que sale bien (`2a`).

#### El rollback del programa: pasado el paso 3, sólo hacia adelante

**El rollback es uno de los seis ítems huérfanos** de la FASE 7 del paraguas (§3 de `D/16`), y
quedó decidido en el §4.3 (FASE 9 vuelta 1, `F-8V1C2-015`). **Salvedad aceptada de antemano**: la
conclusión honesta podía ser **que no hay vuelta atrás**; reemplazar el sistema de cobro no es
revertir un deploy: si el corte se hizo y hay gente suscripta en el sistema nuevo, volver al viejo
significa **deshacer compromisos reales con un proveedor externo**. Saber dónde está el punto de no
retorno y decidir con eso a la vista es mucho mejor que **descubrirlo cruzándolo**. **Y ésa fue la
conclusión** (owner 2026-09-25; FASE 9 completa, `2c`): pasado el paso 3 del corte **sólo se arregla
hacia adelante** — *«no va a pasar»*. Antes del paso 3 lo que existe es la rama de aborto de arriba,
que restaura el backup. **Lo que este rollback NO es**: el rollback de las ocho filas de la cartera
actual, que desapareció con su sujeto cuando se decidió no migrar (los dos `21-migracion.md` §2). El
de acá es el del **programa**, y es de otro tamaño.

**Lo que este orden NO resuelve** (§4.3):

- **El punto de no retorno tiene una ubicación declarada: entre el paso 2 y el paso 3.** **Y la
  decisión está tomada: pasado el paso 3, sólo hacia adelante** (owner 2026-09-25; FASE 9 completa,
  `2c`). Un defecto grave después del paso 3 se arregla sobre el sistema nuevo; no se vuelve a la
  imagen vieja ni se cancela en masa lo que creó el sistema nuevo. **Lo que esto NO cierra**,
  declarado por `DEC-METH-015`: un defecto grave pasado el paso 3 se arregla bajo presión, con
  clientes cobrando en el sistema nuevo. **Causa**: la alternativa —rollback con cancelación
  masiva— cancela clientes nuevos cuyo trial el proveedor no repite (`HOS-1012`), y el owner la
  descartó.
- **Una autorización viva que el recorrido sin filtro no devuelve sobrevive al corte** (FASE 9
  vuelta 1, `F-8V1B3-005`; declarado por `DEC-METH-015`). **Causa**: el gate del paso 2 compara el
  recorrido contra sí mismo —su conteo contra el `total` del paginado— y contra ids conocidos, y la
  completitud del recorrido no está medida (`RC-1`); una fuente independiente sería mecanismo nuevo
  sobre una API que `R-MP-01` da por discontinuada. Se detecta en su primer cobro, que llega como
  desconocido: el handler le escribe una lápida de recepción y la marca `PAGO_TARDÍO_RECHAZADO` le
  propone a la persona devolverlo, con **SÍ** (`B/09` §2.4; owner 2026-09-26, `G3-2`).
- **La parte del corte sobre una `Preference` abierta del viejo sale** (S-44): quien la tenga es una
  de las cinco cuentas, a quien el owner le pide no pagar nada en el viejo. El «NO cierra» de `B/09`
  sobre el pago del addon de única vez es de producto y queda.
- **Un aviso de Mercado Pago emitido entre el apagado del viejo y el levantamiento de la imagen nueva
  puede perderse, y se declara y se acepta** (FASE 5, lote de la aplicación, owner 2026-09-30, C;
  [DEC-MIG-007](01-decisiones-vigentes.md#dec-mig-007), puntos 3 y 4). **Causa**: la ruta de avisos
  queda abierta en el borde pero en ese rato no la atiende ningún servidor, y el único código medido
  que Mercado Pago reintenta es el `500` (`WH-4`), que ya nadie garantiza. **Daño**: si un cobro de
  una de las tres cuentas con débito avisa justo ahí y no se reintenta, no llega al receptor nuevo
  ni le aparece al owner para decidir la devolución. **Por qué se acepta**: son minutos y tres
  cuentas que el owner conoce; si pasa, lo ve en su cuenta de Mercado Pago o se lo dice la persona.
  No se mide ni se agrega mecanismo.
- **Lo que no deshace una restauración: dos situaciones, declaradas por decisión del owner** (FASE
  9 vuelta 3, owner 2026-09-30, lote J, contra la recomendación; declarado por `DEC-METH-015`; salen
  la segunda y la cuarta, FASE 5, simplificación del corte, B y E; S-17, S-18). Las dos exigen una
  falla previa y el daño de cada una es de clase crítica. No se agrega ninguna regla.
  1. **Restaurar el backup del paso 6 deja preapprovals vivos sin fila** (`F-8V3C2-001`).
     **Causa**: el paso 5 abre las altas del sistema nuevo, y el 5b y el 6 corren después; si el 6
     falla, su backup devuelve la base a como terminó el 5b, y todo lo que el sistema nuevo escribió
     desde ese backup se pierde: suscripciones, preapprovals vinculados, pruebas arrancadas.
     **Daño**: el preapproval sigue `authorized` en el proveedor y su fila ya no existe; la persona
     autorizó el débito y no tiene suscripción ni cobertura, nadie le avisa, y del lado de Hospeda
     se enteran recién con el primer cobro, que el handler recibe como desconocido: lápida de
     recepción, cancelación y la propuesta de devolver.
  2. **Después de un aborto, `main` sigue con el sistema nuevo** (`F-8V3C2-003`). **Causa**: la
     promoción `staging → main` es el paso 3 (§4.4), y la rama de aborto redespliega la imagen vieja
     sin revertir esa promoción; los hotfixes siguen yendo a `main`, y en Coolify todo redespliegue
     construye desde la rama. **Daño**: el primer despliegue de `main` después del aborto (un
     hotfix, o una variable de entorno que pide redesplegar) sube el sistema nuevo sobre la base
     vieja restaurada y corre sus migraciones, que borran las tablas del viejo que está cobrando,
     sin orden de corte y sin nadie mirando.

  **Estas dos se releen antes del ensayo del corte en `staging`** (FASE 5, simplificación del corte,
  S-21; owner 2026-09-30, al cerrar la FASE 9 vuelta 3): quien escriba la herramienta del corte las
  vuelve a leer con el procedimiento ya escrito, y si alguna se puede cerrar con una regla que no
  agregue mecanismo, se le trae al owner antes de ensayar ([GATE:M3](#gate-m3)). Declararlas no las
  vuelve imposibles: el ensayo recorre la misma secuencia, y es la única red que las ve antes del día
  del corte.
- **El titular que sólo conoce el proveedor sale** (FASE 5, owner 2026-09-30, simplificación del
  corte, E; S-38; `DEC-MIG-007`, punto 3).

Dueña del AC: la pseudo-pieza `CORTE` ([AC:CORTE:4](#ac-corte-4), [AC:CORTE:5](#ac-corte-5)).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:151, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:432, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:440, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:446, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:467, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:485, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:487, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:492, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:95, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:101, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:110, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:114, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:512, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:516, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:524, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:549, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:554, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:564, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:573, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:589, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:608, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:622, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:455

<a id="paso-3"></a>

### Paso 3 · desplegar, en tres actos y con los crons apagados

**Qué**: **desplegar, en tres actos y con los crons apagados** (FASE 5, owner 2026-09-30, lote 3 E
y F; simplificación del corte, §10 punto 6;
[DEC-MIG-003#📌7](01-decisiones-vigentes.md#dec-mig-003-p7)):

1. **apagar el sistema viejo** —su contenedor, su webhook y sus crons, verificado (`DB-5`)—;
2. **migrar con `hops db-migrate --pull` sobre el mismo commit que la imagen nueva**, y **se exige
   la igualdad de commit**: si el checkout que migra no está en el commit de la imagen, no se migra;
3. **levantar la imagen nueva con `HOSPEDA_CRON_ADAPTER` apagado**, que apaga los crons del proceso
   entero, así que paran también los crons del resto de la plataforma, y se acepta; se prenden en el
   [paso 5](#paso-5).

Son dos actos, migrar y levantar, porque en este repositorio la imagen arranca sin migrar y quien
migra lee su propia copia del código en el servidor (`R5-21`, `38-fase-5/00-consolidado.md`); los
crons apagados son para que ninguno mande un correo o evalúe una ficha antes de confirmar el corte,
porque un correo no se deshace (`R5-20`). No se convive: el viejo se apaga antes de levantar el
nuevo ([DEC-MIG-001#📌1](01-decisiones-vigentes.md#dec-mig-001-p1)).

**La migración estructural escribe, en este orden**:

- **antes que nada, la versión 1 de los plazos de cada mitad, con los dieciocho valores**, que la
  escritura `C` y la prueba guardan: **la migración falla si alguno está vacío, y el owner fija los
  cinco sin valor escrito antes del merge de `V6`** (FASE 5, owner 2026-09-30, lote 3 D; S-78;
  verificación corta, 2026-09-29, lote N-H; `NUCLEO/02` §1.5; los tres nuevos, FASE 9 vuelta 3, lote
  K y `F-8V3B3-003`, con su valor fijado: 7, 7 y 180 días, lote R);
- **el catálogo de producción** —SQL generado por un script TypeScript y vigilado por un guard que
  lo regenera y compara (FASE 5, owner 2026-09-30, lote 2 D)—, la migración de datos única que antes
  corría en el 3a, de la que la prueba deriva su plan de trial, sus versiones vigentes y su fin
  (FASE 9 vuelta 3, owner 2026-09-30, lote C; `NUCLEO/02` §1.4): **si esa escritura falla a la mitad,
  falla la migración, el paso 3 no termina y el corte entra en la rama de aborto, que restaura el
  backup del 2b**, así que no queda un catálogo a medias;
- **las cinco fichas de la lista cerrada del owner, cada una con su estado de nacimiento
  (`PUBLISHED`, o lo que diga la lista) y su escritura `C`**;
- **y borra las filas de las fichas de todas las demás cuentas, sin conservar nada** (FASE 5, owner
  2026-09-30, lote 1 J y simplificación del corte, A; S-01, S-02, S-14);
- **y borra las columnas viejas del estado de la ficha, `lifecycle_state`, `visibility` y
  `moderation_state`** (lote 3 A), **y las tres que sobrevivieron a `U1`** (lote 3 B; S-09):
  **`owner_suspended`, `plan_restricted` y `billing_unpublished_at` llegan vivas a esta migración
  porque tienen lectores fuera del cobro, que `V6` retira en el mismo cambio que la migración que las
  borra** (§4.6).

**Y antes de borrar las filas de las demás fichas, la migración copia a una tabla de paso el id de
cada una, las rutas de sus fotos y su token de calendario**: es de donde el [5b](#paso-5b) saca qué
borrar, y el token no sale de la base (FASE 5, lote de la aplicación, owner 2026-09-30, D). **La
tabla de paso vive sólo en el SQL de esta migración, fuera del esquema de Drizzle**: ni `G-R9` ni el
control de drift la ven (FASE 5, lote de la aplicación, segunda tanda, owner 2026-09-30, P). **La
migración borra las filas de las fichas que no son de las cinco, y no toca lo de afuera de la base:
sus fotos en el almacenamiento externo y su token de calendario los borra el paso 5b, cuando ya no
hay aborto**, porque lo externo no lo restaura ningún backup (FASE 5, owner 2026-09-30, lote 1 J;
S-04).

**Después de migrar, la herramienta del corte de `V6` escribe las cinco pruebas con sus
seudónimos**, con la función de la aplicación, **y se verifican a mano** (FASE 5, owner 2026-09-30,
lote 2 D; S-12; la herramienta: FASE 5, lote de la aplicación, owner 2026-09-30, B): se resigna que
sea una sola operación atómica, porque son cinco filas. **La herramienta de `V6` es del sistema
nuevo, así que puede usar la función del seudónimo; el script suelto de `U3` sigue sin importar
código de ninguno de los dos sistemas** (FASE 5, lote de la aplicación, owner 2026-09-30, B). Las
cinco pruebas, el 5b y el 6 son las tres escrituras a mano del corte (el 5b, FASE 9 vuelta 2,
`F-8V2A3-002`; el 6, revisión del owner, 2026-09-28, C3; las pruebas, FASE 5, lote 2 D). **Las otras
dos las hace el sistema nuevo: el estado de nacimiento y `inactiva_desde` de las cinco fichas de la
lista y el borrado de las demás, en la migración del paso 3** (lote 1 J; S-01, S-02); **los dos
`permanent_grant`, en el 3b** (FASE 9 vuelta 1, R1, `F-8V1C2-012`). Los clientes actuales se siguen
tratando como nuevos, y su prueba arranca el día del corte. Las cinco pruebas escriben filas del
esquema nuevo, así que van después de desplegar — y por eso el paso 3 no es el final del corte,
aunque lo parezca.

**Y después de migrar, toda migración del journal de la imagen tiene que figurar en la tabla de
migraciones aplicadas de producción**, o el corte no sigue y entra la rama de aborto: es la defensa
contra un hotfix del congelamiento que trajo una migración (§4.4) y dejó detrás, por fecha, a las
del paraguas. *(Que el migrador de Drizzle saltee las más viejas no está leído, lo deriva
`F-8V3C2-006`; por eso va como verificación y no como premisa: FASE 9 vuelta 3, F-8V3C2-006.)*

**La ruta de avisos.** El apuntado de la URL y su sonda pasaron al paso 4b (FASE 9 vuelta 2,
`F-8V2B3-003`, `F-8V2C2-002`). **Y la ruta del receptor nuevo es la misma que la del viejo,
`/api/v1/webhooks/mercadopago`, con la marca `source_news=webhooks` en la URL de Webhooks y sin ella
en la de IPN, como hoy** (verificación corta, 2026-09-29, lote O-B; medido en hospeda2 el
2026-09-29, `apps/api/src/routes/webhooks/mercadopago/router.ts`, y `B/06` §7), **así que no hay URL
que apuntar**. **La ruta de avisos no se cierra: la regla del 0b la deja abierta** (FASE 5, owner
2026-09-30, simplificación del corte, C; S-45). **Un aviso de un débito viejo que llega al receptor
nuevo es un desconocido más**: lápida de recepción, cancelación y la marca que le pone delante al
owner la devolución para que decida (`B/09` §2.4; S-46). **Un aviso emitido entre el apagado del
viejo y el levantamiento de la imagen nueva, cuando la ruta no la atiende ningún servidor, se
declara y se acepta** (FASE 5, lote de la aplicación, owner 2026-09-30, C; `DEC-MIG-007`, puntos 3 y
4): son minutos y tres cuentas con débito que el owner conoce; si Mercado Pago no lo reintenta, el
owner lo ve en su cuenta de Mercado Pago o se lo dice la persona (§4.3; ver el [paso 2b](#paso-2b)).

**Durante el rollout del paso 3 el contenedor viejo no atiende el webhook ni corre crons**: se
apagan antes de desplegar y se verifica como parte del paso (declarado por `DEC-METH-015`, FASE 9
completa, `DB-5`). **Causa**: el handler viejo confirma como procesado el evento de un preapproval
que no conoce (`local_row_not_found`), y MercadoPago no reintenta. **Eso vale para los eventos de
estado; ante un cobro que no resuelve, el viejo responde 500 a propósito (HOS-276) y MercadoPago sí
reintenta**, igual que todo evento que llegó durante el rollout: esos reintentos le llegan al
handler nuevo **cuando levanta la imagen nueva, y le llegan como desconocidos**: lápida de recepción
y la marca que le pone delante al owner la devolución (FASE 5, owner 2026-09-30, simplificación del
corte, C; S-46). El rato sin nadie que atienda la ruta **se declara y se acepta**. Si no se apaga,
el cliente que contrata en esa ventana espera hasta el barrido diario.

**Quién**: —. La migración estructural y la herramienta que escribe las cinco pruebas son de
[V6](10-corte/V6.md#pieza-v6); el SQL del catálogo lo genera la pieza de
[V2](10-corte/V2.md#pieza-v2).

**Por qué acá**: recién acá, y sólo si el paso 2 cerró. **Despliega bajo la regla del 0b, que es una
sola para los dos sitios y no tiene lista de rutas** (FASE 5, owner 2026-09-30, simplificación del
corte, B; S-26). **El paso 3 termina cuando el despliegue está sano, las cinco pruebas escritas, el
3b verificado y la sonda de la entrega del 4b cancelada**: la rama de aborto cubre hasta ahí (FASE 9
vuelta 1, `F-8V1A3-005`; owner 2026-09-26, `G4-1`; con el 4b adentro desde la FASE 9 vuelta 2,
`F-8V2B3-003`; las pruebas, lote 2 D).

#### La rama hasta el corte: sin interruptores, `staging` congelado (§4.4)

(Revisión del owner, 2026-09-28, C2 y L3-b.) **No hay convivencia ni interruptores, así que el
sistema nuevo no puede estar en una rama que se promueve a producción sin ser el corte.** Un
interruptor era la única forma de tenerlo en `staging` y no activo en `main`, y C2 lo prohíbe. Por
eso:

1. **La épica entra a `staging` recién al final, lista para el corte.** Hasta entonces vive en la
   rama del paraguas (`DEC-ARCH-007`), y ahí se construye y se prueba.
2. **Desde que entra, `staging` queda congelado para `main` hasta el corte.** Ninguna promoción
   `staging → main` sale antes, porque arrastraría el sistema nuevo a producción sin el orden de
   este archivo. La promoción `staging → main` es parte del corte: es lo que despliega el paso 3
   ([DEC-ARCH-007#📌1](01-decisiones-vigentes.md#dec-arch-007-p1)).
3. **Los arreglos urgentes van a `main` como hoy**: rama desde `main`, PR a `main` y, después, el
   back-merge `main → staging`, que es la excepción de hotfix que el repo ya tiene. El congelamiento
   frena la promoción, no los hotfix. **Un hotfix puede traer una migración** (FASE 9 vuelta 3,
   F-8V3C2-006): se aplica en producción antes del paso 3 y, por fecha, puede quedar delante de
   migraciones del paraguas generadas antes, que el ensayo en `staging` aplica en el otro orden. Lo
   que lo cubre es la verificación del paso 3 sobre la tabla de migraciones aplicadas: no se prohíbe
   el hotfix, se verifica el resultado.
4. **El script del corte no pasa por ninguna de las dos ramas como parte de un despliegue**: no hace
   falta promoverlo antes, y por eso ya no hace falta la excepción de hotfix. **Está versionado en
   `scripts/cutover/`** (revisión del owner, casos vecinos, 2026-09-29, caso 3), pero ninguna imagen
   lo lleva: se corre desde una copia del repositorio, y se borra en un commit posterior al corte.
5. **La rama del paraguas se borra apenas se mergea a `staging`** (owner 2026-10-01, Q;
   `40-congelamiento-y-ci/10-decisiones-del-owner.md`): el guard de destino
   `check-umbrella-branch-target.sh` (`DEC-CI-001`/`DEC-ARCH-007`, condición corregida por P y por T,
   §4.6) cuenta sólo los commits propios de la épica, los que no están en `staging`: falla si HEAD
   trae un commit de la épica que no está ni en el destino ni en `staging`, así que, una vez mergeada
   la épica a `staging`, no falla la promoción `staging → main` del punto 2 (owner 2026-10-01,
   [T](01-decisiones-vigentes.md#own-40-congelamiento-y-ci-t1-t); residuo corregido el 2026-10-02). Q
   sigue valiendo para el PR final del paraguas: la rama se borra al mergear. (`D/16` §4.4 punto 5,
   `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:653`; `.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:2838-2844`)

**Con esto `rollout` queda cerrado en lo que hace a ramas** (revisión del owner, casos vecinos,
2026-09-29, caso 4): las ramas son este apartado, y el orden de despliegue son los pasos.
**Lo que esto cuesta, declarado**: mientras dure el congelamiento, lo demás de Hospeda que esté en
`staging` no sale a producción. **Causa**: sin interruptores no hay otra forma de tener el sistema
nuevo en `staging` sin llevarlo a `main` (C2), y el owner eligió esta forma (L3-b). **Por eso el
punto 1 importa**: cuanto más tarde entra la épica a `staging`, más corto es el congelamiento.

#### `qzpay`: congelado hasta el corte, archivado después (§4.5)

(Revisión del owner, 2026-09-28, N2.) **El cobro nuevo no usa `qzpay`**: se escribe en un package
compartido del monorepo (publicarlo en npm pediría reescribir sus dependencias internas: casos
vecinos, 2026-09-29, caso 30), y `qzpay` queda como referencia de lectura (`B/spec.md` §3.1; `G16`
falla si vuelve, [GUARD:G16](04-catalogos.md#guard-g16)). Pero **el sistema viejo corre con él
hasta el corte**, así que: (1) **desde ahora, `qzpay` se congela**: sólo entra lo que haga falta
para que el sistema viejo siga cobrando en producción; (2) **después del corte, se archiva**: el
script del corte no lo usa, así que no hay nada del corte que lo necesite; (3) **el cobro viejo sale
de la rama del paraguas al principio de la épica**, con sus dependencias de `qzpay`, en la limpieza
del principio (§4.6; verificación corta, 2026-09-29, lote N-A): el sistema que cobra hasta el corte
es el de `main`, que la rama no toca, y de `main` sale con el paso 3, que la reemplaza. Por eso `G16`
mira todo el repo (`B/20` §2).

Dueña del AC: la pseudo-pieza `CORTE` ([AC:CORTE:6](#ac-corte-6), [AC:CORTE:7](#ac-corte-7)), con
[V6](10-corte/V6.md#pieza-v6) y [V2](10-corte/V2.md#pieza-v2) como proveedoras.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:152, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:188, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:233, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:236, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:291, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:627, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:633, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:635, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:638, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:647, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:653, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:660, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:663, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:668, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:674

<a id="paso-3a"></a>

### Paso 3a · verificar el catálogo de producción

**Qué**: **el catálogo de producción**: **la migración de datos única del catálogo** (revisión del
owner, 2026-09-28, N1, `L1-e`: corre una vez, acá, y nunca más es fuente de nada; de ahí en adelante
sólo lo cambian las acciones administrativas del catálogo, `NUCLEO/02` §1.4): verticales con su
evento; por vertical, los planes vendibles, el de trial, el de pre-trial y el de piso con sus
versiones, **los precios, los complementos y los códigos promocionales vigentes** (la versión 1 de
los plazos la crea la migración estructural del paso 3, y acá sólo se verifica: verificación corta,
2026-09-29, lote N-H; `NUCLEO/02` §1.5). **Se cargan dentro de la migración estructural del
[paso 3](#paso-3), como los plazos, en SQL generado por un script TypeScript y vigilado por un guard
que lo regenera y compara; este paso sólo los verifica** (FASE 5, owner 2026-09-30, lote 2 D: la
prueba del corte, que los lee, la escribe después de migrar la herramienta del corte de `V6`, que es
del sistema nuevo: FASE 5, lote de la aplicación, owner 2026-09-30, B; verificación, `VF5-01`; FASE
9 vuelta 3, owner 2026-09-30, lote C: la prueba se escribía antes del catálogo que la define,
`F-8V3A2-001`, `F-8V3A3-001`). **Y antes del 3b se verifican contra la base de producción** las
condiciones de [G-R3](04-catalogos.md#val-g-r3) **y las demás validaciones del panel sobre el catálogo y los plazos**
(`NUCLEO/02` §1.4 y §1.5; [G-R3](04-catalogos.md#val-g-r3) pasó a ser una de ellas, revisión del owner, 2026-09-28, N1;
[VAL:G-R3](04-catalogos.md#val-g-r3)) y el espejo del enum de verticales: si no dan, el corte no
sigue (FASE 9 vuelta 1, `F-8V1A3-004`).

**Quién**: **la carga, la migración del paso 3; la verificación, quien opera el corte** (FASE 9
vuelta 3, lote C). La migración es de [V6](10-corte/V6.md#pieza-v6), el SQL del catálogo lo genera
[V2](10-corte/V2.md#pieza-v2), y el esquema de promos que el 3a verifica cargado lo crea
[B3](10-corte/B3.md#pieza-b3) (BG).

**Por qué acá**: el grant del 3b ancla un plan que tiene que existir, y un catálogo que no cumple
[G-R3](04-catalogos.md#val-g-r3) le deja al proceso nuevo una resolución sin fuente.

Dueña del AC: la pseudo-pieza `CORTE` ([AC:CORTE:8](#ac-corte-8)).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:153

<a id="paso-3b"></a>

### Paso 3b · los dos `permanent_grant` de las cortesías del owner

**Qué**: **escribir los dos `permanent_grant`** de las cortesías del owner (`B/21` §2.4),
**anclados al vendible de `rank` más alto de Alojamiento, en la vertical en que tenían `comp`** —a
la letra de `G1-3`: las dos `comp` que existen son del owner y de Alojamiento, y no va a otorgar otra
hasta terminar el programa (owner 2026-09-27, FASE 9 vuelta 2, `R11-3b`: se revierte la corrección
de la misma vuelta)—, **con la versión que elige quien opera el corte, aceptada sólo si
`políticaDePlan(v).vigente`** (owner 2026-09-26, `G1-3`; `12-contrato…` §2.8; FASE 9 vuelta 2,
`F-8V2C1-004`, `F-8V2B3-009`). **Correrla dos veces da lo mismo**: la herramienta saltea el
`permanent_grant` que ya escribió para ese beneficiario y esa vertical y no escribe un segundo (FASE
9 vuelta 2, verificación, caso 2 de `12-` §5, arreglo de texto).

**Quién**: el sistema **nuevo** —la herramienta de [B9a](10-corte/B9a.md#pieza-b9a) (corte del MVP,
owner 2026-10-01, Z)— (punto 3 de *«las herramientas del corte»*: **Grants** (paso 3b): **B9a**,
`B/21` §2.4).

**Por qué acá**: **dentro de lo que la rama de aborto cubre: sus fichas nacen `PUBLISHED` con la
prueba del corte, como las otras tres de la lista del owner, y el grant convierte esas dos pruebas**
(FASE 5, owner 2026-09-30, simplificación del corte, A; S-02, S-13); **por eso va después de que se
escribieron las cinco pruebas** (lote 2 D) (FASE 9 vuelta 3, F-8V3A2-008: desde C12 nada nace
`UNPUBLISHED_BY_BILLING`) (`V/21` §2.4, punto 3; FASE 9 completa, `DB-7`; FASE 9 vuelta 1,
`F-8V1C2-012`).

Dueña del AC: [B9a](10-corte/B9a.md#pieza-b9a).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:154, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:394

<a id="paso-4b"></a>

### Paso 4b · verificar con una entrega real que el receptor nuevo recibe

(El paso 4, las lápidas del corte y la apertura de la ruta, salió: ver
[PASO:4](90-retirados.md#paso-4).)

**Qué**: **verificar con una entrega real que el receptor nuevo recibe en su ruta de siempre, que la
regla del 0b deja abierta; sin apuntar nada, porque la URL no cambia** (FASE 5, owner 2026-09-30,
simplificación del corte, C; S-40, S-45, S-48; verificación corta, 2026-09-29, lote O-B) (el alta de
una sonda propia) (FASE 9 vuelta 1, R1, `F-8V1C2-008`; movido del paso 3 en la FASE 9 vuelta 2,
`F-8V2B3-003`).

- **La sonda se da de alta con una llamada directa a la API del proveedor desde la herramienta del
  corte, no por una ruta de la aplicación** —la regla del borde cierra las rutas de los dos sistemas,
  no la API del proveedor—, **y se cancela en el mismo paso, releída `cancelled`, apenas se vio su
  entrega**; su id va al manifiesto del corte (FASE 9 vuelta 1, `N-G4V-03`). **Su evento escribe una
  lápida de recepción con la marca `TRANSICIÓN_NO_DECLARADA`**, que es la evidencia de la entrega; la
  levanta por `S15` quien opera el corte, en este paso (`B/09` §2.4; FASE 9 vuelta 2, `F-8V2B3-004`).
- **Y el canal IPN, que queda activo, llega a la misma ruta, sin la marca de Webhooks, y tampoco se
  apunta**: se verifica en el mismo paso (`B/02` §2.7; mediciones del 2026-09-29, M-2; verificación
  corta, 2026-09-29, lote O-B). **Y se verifica con una entrega real de `payment`** (verificación
  corta, 2026-09-29, lote N-D): la sonda produce avisos de preapproval por Webhooks y ninguno por
  IPN, que entrega sólo `payment` (`B/06` §7), así que **la herramienta del corte hace un pago chico
  con la tarjeta del owner, mira que su entrega IPN quedó guardada en `provider_notification`**
  (`B/02` §2.7) **y lo devuelve**, con el reembolso releído por id. El pago sale directo por la API de
  pagos del proveedor, no como una orden, porque las órdenes no avisan por ningún canal (`EX-15`,
  `B/16` §1.4), y no por una ruta de la aplicación; su id y el de su devolución van al manifiesto del
  corte. Como la sonda de Webhooks, sin la entrega vista el 4b no termina.

**Quién**: quien opera el corte, con el script del corte de [U3](10-corte/U3.md#pieza-u3) (corte del
MVP, owner 2026-10-01, BF): **la sonda de Webhooks** —alta por una llamada directa a la API del
proveedor, cancelación y relectura `cancelled`—, **el pago chico** por la API de pagos con la
tarjeta del owner y **su devolución releída por id**, **la consulta de sólo lectura a
`provider_notification` de la base nueva** que mira que la entrega quedó guardada, **los ids de la
sonda, del pago y de su devolución en el manifiesto**, y **los inversos (b) y (c) de la rama de
aborto** ([paso 2b](#paso-2b)).

**Por qué acá**: **sin la entrega verificada, un cobro que llegue después del corte no lo recibe
nadie**: las preapprovals de producción no llevan `notification_url` propia. **Este paso no mueve
nada, sólo mira.** **El destino del reintento ya no es una pregunta**: la URL no cambia en ningún
momento del corte, así que el reintento va a la misma ruta que el aviso original, y `EX-46` queda sin
sujeto (verificación corta, 2026-09-29, lote O-B). **Un aviso en el rato entre el apagado del viejo y
el levantamiento de la imagen nueva se declara y se acepta** (FASE 5, lote de la aplicación, owner
2026-09-30, C).

Dueña del AC: [U3](10-corte/U3.md#pieza-u3).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:156, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:380

<a id="paso-4c"></a>

### Paso 4c · revalidar las páginas de las fichas borradas

**Qué**: **revalidar las páginas públicas de las fichas que la migración del paso 3 borró y que el
viejo servía, las tres colecciones y los 22 destinos. Corre siempre**: la J borra fichas que el viejo
mostraba, así que el paso siempre tiene sujeto (FASE 5, owner 2026-09-30, lote 1 J y simplificación
del corte, E; S-28). En el caché de páginas y en el borde, **verificado pidiendo desde afuera la
página de una ficha borrada** (FASE 9 vuelta 2, `F-8V2C2-006`).

- **Y los listados que muestran su tarjeta**: purga, una vez por tipo de ficha, la etiqueta de
  colección (`list-accom`, `list-gastro` y `list-exp`, `packages/cache-tags/src/vocabulary.ts:84`),
  que invalida en una sola purga todos los listados y el buscador de ese tipo y no gasta el tope de
  purgas del plan del borde, y la de la portada (sin destacados desde el lote 1 F de la FASE 5; *la
  purga de la portada la fuente la deriva y la marca*).
- **Y la página de cada destino, que lista sus alojamientos y el código invalida por su destino y no
  por una colección** (`packages/service-core/src/revalidation/entity-tag-mapper.ts:75`): **una purga
  por destino, 22**, con la etiqueta de la página de ese destino; ésas sí cuentan para el tope de
  purgas del borde (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-t`), y ese tope se verifica
  en el [paso 0](#paso-0) (`V2-z3`).
- **Verificado pidiendo desde afuera un listado que mostraba la tarjeta de una ficha borrada**, y la
  página de su destino (FASE 9 vuelta 2, verificación, `N-C-07`, arreglo de texto).

**Quién**: quien opera el corte, con la herramienta del corte de [V6](10-corte/V6.md#pieza-v6)
(punto 4 de *«las herramientas del corte»*: la revalidación de las páginas de las fichas que se
borraron, paso 4c, siempre: S-28; FASE 9 vuelta 2, `F-8V2C2-006`).

**Por qué acá**: el borrado de la migración es directo y **no es una transición, así que no programa
revalidación**: sin este paso la ficha que el corte borró se sigue viendo en su página y en el
buscador hasta que la detección de páginas viejas del código actual la alcance, a las 48 h
(`apps/api/src/cron/jobs/page-revalidation.job.ts:11`). **Va después del 4b**, cuando la rama de
aborto ya no cubre: revalidar antes y abortar dejaba páginas que dicen *«despublicada»* sobre fichas
que el backup restaura a la vista. Correrla dos veces da lo mismo.

Dueña del AC: [V6](10-corte/V6.md#pieza-v6).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:157, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:400

<a id="paso-5"></a>

### Paso 5 · levantar la regla del 0b y prender los crons

**Qué**: **levantar la regla del 0b y prender los crons** (`HOSPEDA_CRON_ADAPTER`), después de
verificado el 4b (FASE 5, owner 2026-09-30, lote 3 E y simplificación del corte, B; §10 punto 10).

**Quién**: quien opera el corte.

**Por qué acá**: es el fin del corte, **salvo el borrado del 5b** **y la foto del paso 6** (revisión
del owner, 2026-09-28, C3) **y el smoke de producción del 5c** (FASES 6 y 7, owner 2026-09-30, B).
Hasta acá el sistema nuevo no crea nada en el proveedor, así que la rama de aborto nunca restaura un
backup encima de un preapproval vivo (FASE 9 vuelta 1, `F-8V1A3-005`), **ni sus crons mandaron
nada**, porque se prenden acá (lote 3 E). **Eso vale para la rama de aborto y para nada más**: la
restauración del paso 6 corre con las altas abiertas desde este paso y sí puede restaurar encima de
un preapproval vivo, **y queda declarada** (ver el [paso 2b](#paso-2b), *«lo que no deshace una
restauración»*; FASE 9 vuelta 3, owner 2026-09-30, lote J; `F-8V3C2-001`; la segunda situación
salió: FASE 5, simplificación del corte, S-17).

Dueña del AC: la pseudo-pieza `CORTE` ([AC:CORTE:9](#ac-corte-9)).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:158

<a id="paso-5b"></a>

### Paso 5b · borrar las fotos y revocar los tokens de calendario

**Qué**: **borrar las fotos en el almacenamiento externo y revocar en el proveedor el token de
calendario de toda ficha que no es de las cinco**; la base ya la borró la migración del paso 3 (FASE
5, owner 2026-09-30, lote 1 J; S-04).

**Quién**: **una persona, con la herramienta del corte de [V6](10-corte/V6.md#pieza-v6)**, sobre las
fichas borradas que todavía tienen fotos o token; correrla dos veces no hace nada más (punto 4 de
*«las herramientas del corte»*: la tabla de paso y el borrado de las fotos y los tokens, **V6**; FASE
9 vuelta 2, `F-8V2A3-002`; S-04; FASE 5, lote de la aplicación, owner 2026-09-30, D).

**Por qué acá**: es lo único del corte que **destruye** algo afuera de la base —el apuntado del 4b y
su sonda se deshacen, esto no—, y por eso va cuando ya no hay aborto (FASE 9 vuelta 2,
`F-8V2A3-002`). En la migración del paso 3 dejaba, después de un aborto, fichas restaurables sin
fotos y con el calendario desconectado. **Entre el paso 3 y el 5b las fotos de las fichas borradas
quedan sin fila de ficha que las nombre**, **y el 5b saca la lista de lo que borra de la tabla de
paso que la migración del paso 3 llenó antes de borrar (id de cada ficha, rutas de sus fotos y token
de calendario): la recorre, borra y revoca, y al terminar borra la tabla**. **La tabla vive sólo en
el SQL de la migración del paso 3, fuera del esquema de Drizzle**, así que borrarla no deja el
esquema distinto de la base (FASE 5, lote de la aplicación, segunda tanda, owner 2026-09-30, P). Vive
en la base, así que ningún token de terceros sale de ella, y la cubre la restauración como a las
fichas: un aborto vuelve al backup del 2b, que es anterior a la tabla y tiene las fichas, y la
migración del reintento la vuelve a llenar (FASE 5, lote de la aplicación, owner 2026-09-30, D).

Dueña del AC: [V6](10-corte/V6.md#pieza-v6).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:159, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:395

<a id="paso-5c"></a>

### Paso 5c · el smoke de producción

**Qué**: **el smoke de producción del checklist del sistema nuevo** (FASES 6 y 7, owner 2026-09-30,
B): **con la tarjeta del owner y un monto aprobado de antemano**, un checkout real por la página de
la aplicación, su devolución, el correo que manda Mercado Pago, la caché del borde y los horarios de
los crons el primer día. Es la parte de producción del checklist que `B13a` (Z) escribe en
`docs/billing/` ([GATE:SMOKE](#gate-smoke)).

**Quién**: el owner.

**Por qué acá**: es lo que el diseño declara que no se puede simular (`B/20` §5.1, *«lo que queda
manual»*), y va después del 5 porque necesita las escrituras abiertas y los crons prendidos. Si algo
falla, el owner se entera antes que el primer cliente. *(La fuente lo derivó y lo marca: no es
condición de ningún paso, porque el corte terminó en el 5 y pasado el paso 3 sólo se arregla hacia
adelante, §4.3.)*

Dueña del AC: [B13a](10-corte/B13a.md#pieza-b13a).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:160

<a id="paso-6"></a>

### Paso 6 · la foto de la base y el reemplazo de las dos historias

**Qué**: **reemplazar la historia de migraciones de la base por una foto de la base tal como queda
después del corte, y lo mismo con las migraciones de datos del seed** (revisión del owner,
2026-09-28, C3, `L2-a`).

- En el repositorio, `packages/db/src/migrations/**` pasa a ser **una sola migración de partida**,
  generada de la base de producción ya cortada, y `packages/seed/src/data-migrations/**` queda
  vacío, **y en el mismo commit salen de la lista de pendientes de `G8` esas dos historias; un build
  destinado a producción después del corte falla si le queda una** (`V/20` §2; revisión del owner,
  casos vecinos, 2026-09-29, caso 8; [GUARD:G8](04-catalogos.md#guard-g8)), **y esa regla la enciende
  este mismo commit: el despliegue del paso 3 corre antes, con la lista llena, y no falla por ella**
  (caso F-B). **En la lista queda la tercera entrada, las carpetas del programa en `.specs/`, que la
  saca el commit del cierre de HOS-1352** (caso H-A).
- En producción, **la tabla de migraciones aplicadas y el ledger del seed se reescriben para
  anotarla como aplicada**, sin correr nada. **Ensayado antes en `staging`** con la misma secuencia,
  **y con un backup propio de las dos tablas y de la base**, tomado justo antes.
- **El carril de extras (`packages/db/src/migrations/extras/`) queda afuera del reemplazo** (FASE 9
  vuelta 3, F-8V3A3-003): guarda lo que Drizzle no expresa, entre eso el trigger que rechaza todo
  `DELETE` sobre `trial` (invariante 2) y el que rechaza una postulación durante la espera, y se
  re-aplica idempotente con `db:apply-extras` después de las migraciones (`CLAUDE.md` raíz, los tres
  carriles), así que no es historia.
- **La migración de partida la genera Drizzle**, que ve tablas, columnas, índices, claves foráneas y
  enums, y no triggers, funciones ni vistas materializadas: esos siguen en el carril de extras.
  **Lleva además, agregadas en la misma migración, las filas de referencia sin las cuales una base
  armada desde el repositorio no arranca**: la tabla de claves, el espejo del enum de verticales y la
  versión 1 de los plazos de cada mitad. **No lleva el catálogo de producción** (planes, precios,
  complementos, códigos): una base armada desde el repositorio usa los datos de demostración del seed
  (`NUCLEO/02` §1.4).
- **Antes de este paso la carga del catálogo vive en la migración estructural del paso 3, que es del
  carril de migraciones del repositorio**: desde que se mergea hasta que este paso la reemplaza por la
  foto, la corre toda base que aplique las migraciones, el ensayo del corte en `staging`, las bases de
  desarrollo y la de CI. En `staging` es lo que se ensaya; **en desarrollo y en CI corre igual, y el
  seed de demostración no carga catálogo donde ya hay uno**: deja el que la migración escribió, así
  que los dos no chocan (FASE 9 vuelta 3, owner 2026-09-30, lote AL). **Y desde la FASE 5 las bases
  de desarrollo, de tests de integración y del e2e nocturno se arman con `db:migrate`, como
  `e2e-pr`**, así que las filas de referencia tienen una sola fuente (FASE 5, owner 2026-09-30, lote 2
  C).
- La unidad que la corre es una sola, `V6`, dueña de la migración estructural; `V2` construye la
  pieza que genera el SQL del catálogo que esa migración lleva (FASE 5, owner 2026-09-30, lote 2 D: la
  migración no puede llamar código TypeScript).
- **Y el ensayo en `staging` compara** el esquema de una base armada desde el repositorio (partida
  más extras) con el de la base cortada, triggers, funciones y vistas incluidos: si difieren, el paso
  no sigue.

**Quién**: una persona, con la herramienta del corte de [V6](10-corte/V6.md#pieza-v6) (punto 6 de
*«las herramientas del corte»*: **V6**, que ya es dueña de la migración estructural del corte;
revisión del owner, 2026-09-28, C3, `L2-a`; se ensaya en `staging` antes del corte, con backup, y se
corre una vez).

**Por qué acá**: **va después del 5b**, cuando la rama de aborto ya no cubre: un aborto restaura el
backup del 2b, que tiene la historia vieja, y reemplazarla antes dejaba un backup y una historia que
no se corresponden. **Y va el mismo día**: la historia vieja nombra el agrupamiento viejo de
Gastronomía y Experiencia (`G8`, `V/20` §2) y el corte es el único momento en que la base se toca a
propósito. **El commit del repositorio y la reescritura de las dos tablas van juntos**: si un
despliegue corre las migraciones con la historia vieja contra las tablas ya reescritas, intenta
aplicar todo de nuevo; nadie corre migraciones entre los dos. **La migración única del catálogo
(desde el lote C, dentro de la del paso 3: FASE 9 vuelta 3, owner 2026-09-30) sale acá**, con las
demás: su contenido ya está en la foto. Las migraciones de datos del seed que usan el cobro viejo
salen antes, en `U1` (FASE 5, owner 2026-09-30, lote 1 C; §4.6). **Si algo falla, se restaura el
backup de este paso**, que deja la base igual a como terminó el 5b, **y pierde lo que el sistema
nuevo escribió desde ese backup, con las altas ya abiertas: declarado** (ver el [paso
2b](#paso-2b); FASE 9 vuelta 3, owner 2026-09-30, lote J).

Dueña del AC: [V6](10-corte/V6.md#pieza-v6).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:161, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:414

## Lo que no hace ningún sistema: el aviso a las cinco cuentas

**Y hay un quinto acto que no es del sistema: las llamadas.** **Las cinco fichas de la lista del
owner nacen `PUBLISHED` y su dueño amanece con una prueba gratis activa; las fichas de las demás
cuentas se borran** (FASE 5, owner 2026-09-30, lote 1 J y simplificación del corte, A; S-01, S-02).
Para quedarse después de la prueba, el dueño contrata, y `T2` la convierte. **El owner elige cuándo
avisa** (FASE 5, simplificación del corte, S-52). **Y lo da el owner en persona** (revisión del
owner, 2026-09-28, C12): **el sistema no manda ningún aviso del corte**, ni previo ni del día, ni el
viejo ni el nuevo, **salvo el correo de baja que el viejo manda al recibir cada cancelación del 1b,
que no se suprime y el owner anticipa** (revisión del owner, casos vecinos, 2026-09-29, caso 1). **Y
se le recuerda al owner cuando se acerque la fecha del corte**, porque sin ese aviso nadie más lo da.
**Va a las cinco cuentas de la lista** (`DEC-MIG-007`, punto 4; S-51). **Sale el guion del aviso**:
qué les dice el owner es suyo (FASE 5, owner 2026-09-30, simplificación del corte, E; S-50;
`DEC-MIG-007`, punto 4). **Sin correo del sistema** (revisión del owner, 2026-09-28, C12): el aviso
es el del owner en persona, y ningún sistema lo manda ni lo registra; que no queda constancia del
aviso lo cubre `DEC-MIG-007` (FASE 5, simplificación del corte, S-53). Esto no es un paso con ancla
propia en las fuentes: lo que tiene de ítem es [DEC-MIG-007](01-decisiones-vigentes.md#dec-mig-007),
puntos 3 y 4, que se define en `01-decisiones-vigentes.md`.

*(Fuente de este apartado: `D/16` §4.2, líneas 250 a 332; sin ancla, porque no es un ítem del
inventario.)*

## La cartera vieja y el trial: qué se migra y qué no

Los §1 a §3 de la mitad de billing del capítulo 21 (`B/21`) y el §2 de la de verticales (`V/21`),
en su forma vigente. Ninguna pieza los construye como tales: lo que piden lo ejecuta el corte (los
pasos 1a, 1b, 2b, 3 y 3b de arriba) y lo que queda vivo como mecanismo lo construyen
[B9a](10-corte/B9a.md#pieza-b9a) (los dos `permanent_grant` del [paso 3b](#paso-3b)) y
[B11](10-corte/B11.md#pieza-b11) (la regla de re-vinculación y la lápida de recepción). Cómo
amanecen las cinco cuentas de la lista (`V/21` §2.4) es de [V6](10-corte/V6.md#pieza-v6).

### El trial ya consumido (`V/21` §2, cierra `M-MIG-01`)

**La pregunta ya no tiene sujeto: NO SE MIGRA.** `M-MIG-01` preguntaba si alguien que consumió un
trial bajo reglas distintas —otro alcance, otra duración, otro disparador— arrastra el consumo al
modelo nuevo. **La pregunta se disuelve porque no se transcribe ninguna fila.**

> **El sistema nuevo no hereda una sola fila. Las ocho suscripciones vivas se cancelan, y quien
> tenga algo vivo se suscribe de nuevo.**

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:27, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:29, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:31, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:35

**Qué hizo posible la decisión, y no fue un criterio técnico.** Hasta que el owner aportó el dato,
nadie sabía **de quién eran las ocho**. Con eso:

| las ocho | quiénes son |
|---|---|
| **2 `comp`** | **del propio owner.** No hay un cliente real detrás de ninguna |
| **3 `abandoned`** | no tienen **nada vivo** que migrar: abandonaron el checkout. **Verificado también del lado del proveedor** el 2026-09-24 (`B/21` §2.4) |
| **3 `trialing`** | clientes reales, **y contactables** — el owner puede hablarles para que se resuscriban |

Las tres `trialing` son las **únicas** con preapproval vivo (medido: 3 de 3, y ninguna de las otras
cinco), y sobre ellas se apoyaba **todo lo pesado** de la migración: el punto de no retorno, el
orden forzado y la ausencia de rollback. **Con las ocho recuperables por teléfono, esa carga no
tiene sujeto.**

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:38, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:40, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:42, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:48

**Qué cuesta cada camino, y qué se pierde exactamente.**

| camino | costo |
|---|---|
| **migrar** | escribir una unidad de trabajo nueva, el orden forzado, el punto de no retorno **por fila**, y aceptar que el rollback no existe pasado cierto paso |
| **no migrar** | **tres llamadas** y dos cuentas propias |

**Qué se pierde, medido:**

- **La plata del sistema viejo**: hasta el 2026-09-17 no había un solo pago; desde el 2026-09-26
  los hay (`B/21` §1.3), y **no se conservan** — ni se transcriben ni se congelan las tablas viejas
  (owner 2026-09-25; FASE 9 completa, `CT-6` y `2a`; `B/21` §4).
- **El trial ya consumido de todo cliente actual se pierde, y a propósito**: el corte no siembra
  trials consumidos, así que quien tenía ficha o suscripción en el sistema viejo **puede estrenar el
  trial en el sistema nuevo** (owner 2026-09-25; FASE 9 completa, `2g`): *«A los clientes ya
  suscriptos les regalamos el trial de nuevo: los tomamos como clientes nuevos. Sólo les respetamos
  la ficha para que no la tengan que cargar de nuevo; la suscripción es como si recién
  arrancaran.»* Revierte la regla del 2026-09-25 de la FASE 8 completa, que sembraba una fila de
  `trial` ya consumida por cada dueño existente (*«el rastro de que ya fue cliente»*, retirado).

**El argumento de fondo no es de pereza**: se estaba construyendo una migración para **ocho filas
sin un solo pago, todas de gente a la que se puede llamar**. Diseñarla, revisarla, ejecutarla y
garantizar su rollback es desproporcionado frente a un mensaje. Y el beneficio extra es real: **el
sistema nuevo arranca sin una sola fila heredada** —sin transcripciones, sin estados viejos, sin
dudas sobre si algo quedó mal migrado—. Es el escenario más limpio posible, y **sólo está
disponible ahora**, mientras son ocho.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:53, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:55, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:60, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:63, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:71, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:79

**Sin condición de caducidad** (`V/21` §2.5). La condición que vigilaba el tamaño de la cartera
**sale entera** (FASE 5, simplificación del corte, S-56): la migración carga una lista cerrada de
cinco cuentas que fija el owner, así que el tamaño de la cartera ya no decide nada
([DEC-MIG-007](01-decisiones-vigentes.md#dec-mig-007), punto 3; lote A). El umbral de unas veinte
personas a llamar y el aviso que obligaba a volver a discutir la decisión si entraban registros
nuevos salen con ella.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:629, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:631

### La premisa del §56, medida (`B/21` §1, cierra `O-MIG-01`)

**La objeción.** El §56 razona: *«Como hay pocos customers actuales: si migrar automáticamente
agrega mucha complejidad/riesgo: preferir coordinación manual y nueva subscription»*. **La premisa
—*«hay pocos customers»*— es una afirmación sobre el estado real del sistema y el PDR no da el
número.** Toda la preferencia por la coordinación manual descansa ahí, y también el tamaño del
riesgo de `R-MIG-01`. `O-MIG-01` pedía **medirla, no heredarla**. Es el §61 aplicado al propio PDR.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:27, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:29, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:31, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:37

**Está medida, y la premisa es cierta por mucho.** Medición de producción del **2026-09-15**, sólo
lectura (`D/07-facts-inventory.md`), **re-verificada el 2026-09-17 a las 12:52 `-03`** con la
consulta 2 de ese documento, **sin un solo cambio**:

| dato | valor |
|---|---|
| **pagos registrados en toda la historia** | **0** |
| suscripciones vivas | 8, **todas mensuales** |
| con compromiso de cobro vivo | **3** (`trialing`, alojamiento) |
| cortesías sin vínculo con el proveedor | **2** (`comp`) |
| gastronomías · experiencias · partners | **0 · 0 · 0** |

**«Pocos customers» son tres compromisos de cobro y cero pagos cobrados en la historia del
sistema.** No hay historial de pagos que preservar, y tres de las cinco verticales no tienen un
solo dato: su rediseño no arrastra deuda de datos, sólo de código.
**[DEC-MIG-001](01-decisiones-vigentes.md#dec-mig-001) queda apoyada en una premisa verificada**, no
en una heredada. La objeción se cerró midiendo, que es la única forma en que se cierra una objeción
de este tipo.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:39, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:41, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:45, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:53, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:57

**Y caduca.** `S-METH-01`: esta medición vale mientras el hecho no cambie, y **este hecho cambia
solo** — el 2026-09-26 (`B/21` §3). **No se re-verifica: el tamaño de la cartera ya no decide
nada** (FASE 5, simplificación del corte, S-30). El corte conserva una lista cerrada de cuentas que
fija el owner cuando esté listo para el corte, cada una con su única ficha, y a esas cuentas les
avisa él por privado ([DEC-MIG-007](01-decisiones-vigentes.md#dec-mig-007); FASE 5, owner
2026-09-30, simplificación del corte, lote A).

**Y lo que seguía en este § sale entero** (FASE 5, owner 2026-09-30, simplificación del corte,
lotes A, C y E): la re-verificación de la cartera y la lista de a quién llamar (S-29), el recuento
de fichas de Gastronomía y Experiencia que detenía el corte (S-07), la población a avisar (S-51),
la lista de fichas `REJECTED` (S-06), la pasada de sólo lectura sobre el proveedor (S-37), el
titular que sólo conoce el proveedor (S-38) y la población y la segunda corrida del detector del
cobro sobre la lápida del corte (S-74), que ya no existe. Las cuentas que importan las conoce el
owner ([DEC-MIG-007](01-decisiones-vigentes.md#dec-mig-007), punto 3), y un cobro tardío de un
débito viejo entra por la lápida de recepción como cualquier desconocido (abajo).

> **Caducó el 2026-09-26** (FASE 9 completa, `CT-6`): ese día el sistema actual cobra el primer
> pago de su historia (la suscripción `ed00a8fd…`, compromiso 1 de la tabla de abajo). Desde
> entonces *«cero pagos»* y *«no hay débitos corriendo»* describen la medición del 2026-09-17, no
> el estado del sistema. Los pagos del sistema viejo no pasan al nuevo ni se conservan (`B/21` §4).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:60, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:62, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:69, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:137

### La cartera actual: no se migra, y lo que se conserva (`B/21` §2)

Los §2.1 a §2.3 de la mitad de billing se retiraron con la decisión de no migrar; los números §2.4
y §2.5 se conservan porque todo el diseño los cita así.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:144, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:146

**No se migra: se cancelan las ocho y quien tenga algo vivo se suscribe de nuevo** (`B/21` §2.4).

> **El sistema nuevo no hereda una sola fila.**

La opción no existía hasta que el owner dijo de quién eran las ocho: **dos son suyas** —sin
cliente real detrás, regenerables de cero— y **las tres `trialing` son clientes contactables**. Las
tres `abandoned` no tienen nada vivo — **verificado del lado del proveedor el 2026-09-24**,
recorriendo los 108 preapprovals de la cuenta: ninguna de esas tres altas llegó a crear uno (una de
esas personas volvió a suscribirse y es una de las tres `trialing`). La migración estaba bien
resuelta; lo que cambió es que **dejó de hacer falta**. El detalle del costo de cada camino y de qué
se pierde está arriba, en *«El trial ya consumido»*.

**Las dos cortesías se escriben como `permanent_grant`, exactamente como el *Free Forever* del
diseño nuevo**, sin nada especial — y se pueden **regenerar de cero** si conviene. Es el
instrumento del diseño nuevo para *«esta persona tiene esto sin pagar, indefinidamente»*, y
converge con el grant anclado al plan del cap. 02 §2.4: **no hace falta inventar nada para
cortesías heredadas, son el caso normal**.

**Qué plan anclan** (owner 2026-09-26, `G1-3`): **el vendible de `rank` más alto de Alojamiento
vigente el día del corte, en la vertical en que tenían `comp`** —a la letra de `G1-3`: las dos
`comp` que existen son del owner y de Alojamiento, y no va a otorgar otra hasta terminar el
programa (owner 2026-09-27, FASE 9 vuelta 2, `R11-3b`)—, **con la versión que elige quien opera el
corte, aceptada sólo si `políticaDePlan(v).vigente`** (`12-contrato…` §2.8; FASE 9 vuelta 2,
`F-8V2C1-004`, `F-8V2B3-009`). Son cuentas propias de demostración, y el grant lee la versión
vigente (`12-contrato…` §2.8), así que un cambio de catálogo posterior les llega solo. Si el owner
algún día quiere esas cuentas para probar un plan intermedio, se revoca el grant y se escribe otro:
no se diseña para eso. El plan tiene que existir antes del 3b, y por eso el catálogo de producción
**se carga en la migración estructural del [paso 3](#paso-3), antes de la prueba del corte, como
los plazos, y el [3a](#paso-3a) sólo lo verifica** (FASE 9 vuelta 3, owner 2026-09-30, lote C),
**como SQL generado por un script TypeScript que un guard regenera y compara** (FASE 5, owner
2026-09-30, lote 2 D).

**Y esas dos filas cruzan la frontera, así que la mitad de verticales las tiene que ver.** Un
`GRANT` con `hasta: NO_VENCE` es de clase `TÍTULO` (`12-contrato…` §2.4), de modo que las dos
cuentas amanecen con `cubierto` **verdadero**: no las alcanza `PB2` y, el día que publiquen algo, la
transición que dispara es `T6` y no `T1`. La verificación completa está en la mitad de verticales,
cap. 21 §2.4; **el orden quedó fijado en el procedimiento**: los grants son el
[paso 3b](#paso-3b) (FASE 9 completa, `DB-7`). Se dice acá porque **el efecto lo produce esta
escritura y se observa allá**.

**Con una precisión que no es de forma: un ANCLA por cada vertical de su scope, sobre UNA sola
fila de grant.** Un grant ancla **un plan por vertical** (`12-contrato…` §2.8, `B/02` §2.4), porque
un plan pertenece a una sola. Las dos formas equivocadas quedaron descartadas por escrito y conviene
nombrar las dos: escribir **un grant con un plan** para un scope de dos verticales es el defecto que
el contrato cerró —*«la segunda vertical resolvería sus capacidades leyendo el plan de la
primera»*—; y escribir **dos grants** de una vertical cada uno es el otro extremo, porque revocar
pasaría a ser dos actos en vez de uno. Lo que se multiplica es la fila de
`permanent_grant_vertical`, **nunca la concesión**. La escritura la construye
[B9a](10-corte/B9a.md#pieza-b9a).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:148, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:150, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:152, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:160, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:166, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:181, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:189

**Un cobro tardío de un débito viejo entra como cualquier desconocido** (`B/21` §2.5). **El corte
no escribe ninguna fila de rastro** (FASE 5, owner 2026-09-30, simplificación del corte, lote C;
S-40, S-41, S-42, S-76): no hay lápida del corte, ni su paso 4, ni su herramienta, ni ventana del
día del corte, ni detector posterior al corte (lo retirado está en [90-retirados.md](90-retirados.md));
y `clase = LÁPIDA` alcanza para reconocer una lápida, sin columna de origen (FASE 5, lote de la
aplicación, owner 2026-09-30, I). **Un cobro tardío de un preapproval del sistema viejo** —porque
la cancelación del 1b se aceptó y no se aplicó, o porque ya estaba en vuelo— **entra por la lápida
de recepción, como cualquier desconocido** (cap. 09 §2.4; owner 2026-09-26, `G3-2`): el handler la
escribe, manda cancelar el preapproval, cuelga el `payment` y abre `PAGO_TARDÍO_RECHAZADO`
([MOT:7](04-catalogos.md#mot-7)) con la propuesta de devolverlo, **y le aparece al owner marcado
para que decida la devolución**. Las únicas filas nuevas de billing que escribe el corte son los dos
`permanent_grant` del §2.4, que son cortesías vigentes y no rastro. La regla de re-vinculación
sigue (S-49).

**Por qué hace falta la regla de re-vinculación** (FASE 5, simplificación del corte, S-40 y S-49).
Los preapprovals vivos se cancelan en el proveedor y no queda rastro. **Cuáles son los saca el
recorrido sin filtro del proveedor, no nuestra base**, y antes se cancelan los `preapproval_plan`
viejos para cerrar sus links ([paso 1a](#paso-1a) y [paso 1b](#paso-1b)): el 2026-09-24 ese
recorrido encontró una autorización viva que la base no conocía, y los cinco planes viejos seguían
vendiendo. Si alguna emite un cobro después del corte —porque la cancelación se aceptó y no se
aplicó, o porque el cobro ya estaba en vuelo— **ese webhook llega como un preapproval
desconocido**, y el sistema nuevo tiene **un solo camino automático** para un desconocido:
re-vincularlo. Sin regla, el candidato más plausible del emparejamiento era **la suscripción nueva
de esa misma persona**, que acaba de contratar, y el cobro viejo se imputaba como pago del ciclo
nuevo: pagó dos veces y el sistema registraba una.

> **La regla de re-vinculación** (owner 2026-09-25; FASE 9 completa, `2b`; cierra `F-8CB3-008`):
> **un desconocido se re-vincula sólo si su `external_reference` nombra una fila nuestra que no
> tenga otro `provider_link` vivo. Todo otro desconocido abre la marca `requiere_conciliación`**
> —con motivo `TRANSICIÓN_NO_DECLARADA` ([MOT:6](04-catalogos.md#mot-6)), el mismo que escribe el
> cap. 09 §2.4—, y lo mira una persona. **Si lo que llega es un cobro aprobado, el motivo es
> `PAGO_TARDÍO_RECHAZADO`; y si el desconocido no nombra ninguna fila, la marca cuelga de una
> lápida de recepción** (`clase = LÁPIDA`; FASE 5, lote de la aplicación, owner 2026-09-30, I) que
> el handler escribe al recibirlo (cap. 09 §2.4; FASE 9 vuelta 1, `F-8V1B3-001`; owner 2026-09-26,
> `G3-2`). *«Otro `provider_link` vivo»* se lee *«la fila ya tiene su `provider_link`»* (`B/02`
> §2.2, `UNIQUE(subscription_id)`; FASE 9 vuelta 1, R12).

Cada preapproval del sistema nuevo nace con **el `id` de su fila de `subscription`** como
`external_reference` ([MP:PA-2](04-catalogos.md#mp-pa-2), `B/02` §2.2; FASE 9 vuelta 1, R12), así
que una huérfana legítima siempre nombra su fila; lo que venga del sistema viejo —**un cobro tardío
de un débito viejo o una sonda que siguió viva** (FASE 5, simplificación del corte, S-40)— no la
nombra y termina en una persona. **Ya no hay candidato plausible**: la suscripción nueva de la misma
persona tiene su propio `provider_link` vivo, así que no puede recibir el cobro viejo. La
precondición **está escrita en** el cap. 09 §2.4, que es donde vive la re-vinculación, con las
mismas palabras (FASE 9 completa; verificado contra ese § en la misma pasada). La construye
[B11](10-corte/B11.md#pieza-b11).

**La lápida de recepción no compite por el candado del §11**, porque `CANCELLED` no está entre los
estados vivos (cap. 02 §2.2; FASE 5, simplificación del corte, S-40). **La de recepción es la única
fila `CANCELLED` de todo el sistema que ninguna transición produce** (FASE 5, simplificación del
corte, S-40 y S-70; `clase = LÁPIDA` alcanza, FASE 5, lote de la aplicación, owner 2026-09-30, I),
y eso no es exclusivo del corte: cualquier escritura manual futura hereda el mismo agujero. Por eso
la exención del cap. 09 §3 quedó escrita como **criterio** —quién dejó al preapproval sin poder
cobrar— y no como enumeración de transiciones: una fila que no nace de ninguna transición no
aparece en ninguna enumeración de transiciones.

**La lápida de recepción no puede cancelar primero y escribir después** —cuando llega su
desconocido no hay nada cancelado, y el `payment` y la marca necesitan la fila en ese acto—, así
que **el handler la escribe y manda cancelar su preapproval en el mismo acto**, y lo que la hace
verdad es la salvedad 4 del cap. 09 §3: el barrido la relee, reintenta la cancelación y marca a los
3 días (cap. 09 §2.4; owner 2026-09-26, `X-1`; FASE 9 vuelta 1, `N-G1-02`, que señalaba justamente
eso: una lápida `CANCELLED` sobre un preapproval vivo que nadie cancelaba).

Lo que el § decía del cobro sobre la lápida del corte sale entero: el asiento sin marca del cobro
en vuelo (`G3-1`), la ventana del día del corte (`R2`) con `EX-48`, que ya no se mide, la posición
que la extendía y la advertencia que los acompañaba. Desde la FASE 5 ese cobro entra por la lápida
de recepción, como dice el principio de este apartado (FASE 5, simplificación del corte, lote C;
S-40, S-41, S-76).

**Qué deja de existir con esto, y no es que se resuelva: se elimina.** La migración dejaba afuera
las relaciones con trial, transcribía un trial y dejaba los compromisos sin vínculo, tenía un punto
de no retorno sin lado elegido, describía dos operaciones distintas en dos lugares, y **nadie la
ejecutaba**. Los cinco problemas **pierden sujeto**, y la unidad de trabajo que iba a escribirla no
se crea.

**Lo único que sobrevive es de otro tamaño**: el **rollback del PROGRAMA** —qué se hace si hay que
volver atrás el reemplazo entero del sistema de cobro—, que no es el rollback de ocho filas. **Y ya
está decidido: pasado el paso 3 del corte, sólo hacia adelante**; antes, la rama de aborto restaura
el backup (ver el [paso 2b](#paso-2b); owner 2026-09-25, FASE 9 completa, `2c` y `2e`). **Y tras un
aborto, la regla que bloquea toda escritura queda puesta hasta el reintento**: la plataforma
entera, las cinco cuentas incluidas, queda en sólo lectura mientras tanto, sin lista de rutas, así
que el sistema viejo no vuelve a vender (FASE 5, lote de la aplicación, owner 2026-09-30, A,
elegida contra la recomendación de levantar la regla general y bloquear sólo las rutas de venta del
viejo; [DEC-MIG-002#📌3](01-decisiones-vigentes.md#dec-mig-002-p3)).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:198, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:200, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:248, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:262, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:274, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:290, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:313, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:324, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:332, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:390, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:396

### El cobro durante el rediseño (`B/21` §3, cierra `R-MIG-01`)

**El hueco cambia de forma cuando se lo mide.** `R-MIG-01` lo planteaba así: *«si hay débitos
automáticos activos, siguen corriendo durante todo el programa»*, y lo llamaba **el riesgo
operativo más grande del programa**. **No hay débitos corriendo.** Cero pagos en la historia del
sistema *(medido el 2026-09-17; caduca el 2026-09-26 con el compromiso 1, ver arriba — FASE 9
completa, `CT-6`)*. Lo que hay son **tres compromisos que todavía no cobraron**, con fecha:

| compromiso | primer cobro |
|---|---|
| 1 | **2026-09-26** |
| 2 | 2026-11-25 |
| 3 | 2026-11-30 |

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:408, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:410, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:412, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:415, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:419

**Y entonces son tres problemas distintos, no uno.**

- **(a) Las ocho relaciones vivas.** No hay nada que parar ni que coexistir, y **tampoco nada que
  transcribir**: **no se migra ninguna** (`B/21` §2.4, arriba). Las tres `abandoned` no tienen nada
  vivo, las dos `comp` son del owner, y las tres `trialing` son clientes contactables que se
  resuscriben. Ninguna de las tres opciones que el hueco planteaba —coexistencia de dos motores,
  corte con migración asistida, congelamiento— hace falta para éstas.
- **(b) El 2026-09-26.** Esa fecha llega **durante FASE 2 o 3**, y la implementación está en FASE
  10 (§65). O sea que **ese primer cobro de la historia del sistema ocurre bajo el sistema ACTUAL,
  no bajo éste.** No es una pregunta de migración: es una operación que necesita a alguien
  mirándola el día que pase. El capítulo la registra con fecha para que no llegue por sorpresa.
- **(c) Las altas nuevas.** **Cerrado por el log**: se siguen tomando
  ([DEC-MIG-002](01-decisiones-vigentes.md#dec-mig-002)) y se resuelven como la cartera, sin
  transcribir ([DEC-MIG-003](01-decisiones-vigentes.md#dec-mig-003),
  [DEC-MIG-007](01-decisiones-vigentes.md#dec-mig-007), que superó a `DEC-MIG-004`: FASE 5,
  simplificación del corte, lote E) — abajo (FASE 9 completa, `C-9`).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:425, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:427, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:433, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:438

**Las altas nuevas se siguen tomando
([DEC-MIG-002](01-decisiones-vigentes.md#dec-mig-002)) y se resuelven como la cartera
([DEC-MIG-003](01-decisiones-vigentes.md#dec-mig-003),
[DEC-MIG-007](01-decisiones-vigentes.md#dec-mig-007)).** Qué pasa con quien se suscriba **mientras
dura el rediseño** es una decisión comercial, no técnica: congelar altas tiene costo de negocio, y
no congelarlas agranda la cohorte que después hay que transcribir a mano —que es precisamente lo
que hoy hace barata a la opción (a)—. Las tres opciones del hueco, con lo que cuesta cada una
**dado el número medido**:

| # | opción | costo | riesgo |
|---|---|---|---|
| 1 | **seguir tomando altas** en el sistema actual | ninguno comercial | **quien entra no se conserva, salvo que el owner lo sume a la lista cerrada del corte** (FASE 5, simplificación del corte, S-03 y S-56) |
| 2 | **congelar altas nuevas** hasta FASE 10 | comercial, y no es chico: tres verticales todavía no vendieron nada | cero cohorte nueva |
| 3 | **coexistencia de dos motores** | el más caro de construir | contamina la arquitectura nueva, que es lo que el §56 pide no hacer |

**No se completa en silencio** (§67). **Y ya no está abierta**: el owner eligió la opción 1
(`DEC-MIG-002`, se siguen tomando altas en el sistema actual), y `DEC-MIG-003` le sacó la mitad
cara —*«se transcriben a mano»*—: las altas nuevas **no se transcriben**, se cancelan en el corte
(FASE 9 completa, `C-9`).

**Y lo que entre al sistema viejo hasta el corte no se conserva, salvo que el owner lo sume a la
lista cerrada de cuentas**, que fija cuando esté listo para el corte, cada una con su única ficha;
si trae más de una, vuelve al owner. La ficha de quien no esté en la lista se borra en el corte
(`DEC-MIG-002`, precisada; `DEC-MIG-007`; FASE 5, owner 2026-09-30, lote 1 J y simplificación del
corte, lote A; S-03). **Sale el umbral de unas veinte personas con su condición de caducidad**
(S-56): el tamaño de la cartera ya no decide nada.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:443, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:448, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:452, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:454, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:460, .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:468

## Los gates de aceptación

(FASES 6 y 7, owner 2026-09-30, A a E, con lo derivado D-1 a D-5; `DEC-ARCH-016`;
`39-fases-6-y-7/00-propuesta.md` §2.) El PDR nombra los *acceptance gates* y no los define. En este
programa, **un gate de aceptación es el momento en que algo se da por bueno y el trabajo siguiente
puede apoyarse en él, con una condición que alguien de afuera puede comprobar**. Son cinco momentos,
y **«la rama» es `epic/HOS-1352-verticales-billing`**, que nace para recibir el PR de `U1` (D-1).
Más el gate propio de cada fase posterior (AT).

<a id="gate-m1"></a>

### Momento 1 · una unidad se da por terminada

Una de las **30 piezas** (corte del MVP, owner 2026-10-01, Z: una mitad *a* o *b* se da por
terminada como cualquier unidad) se da por terminada cuando (D-2) cumple las seis condiciones de
abajo ([GATE:M1.1](#gate-m1-1) a [GATE:M1.6](#gate-m1-6)).

**En Linear, la unidad pasa a `Done` al mergearse en la rama del paraguas**: es lo que `DEC-ARCH-007`
implicación 1 llama *«terminada»*, y la automatización nativa lo hace sola con el `[HOS-N]` del
título. **Las etiquetas `status-needs-smoke-*` van sólo en `HOS-1352`, nunca en las unidades**: si
no, 25 issues quedan meses en *In Review* con una etiqueta que nadie va a retirar (D-2).

**La rama** (§2 de `D/16`, *«el momento»*, cómo se lee desde las FASES 6 y 7: owner 2026-09-30, con
lo derivado D-1 y la letra F): **«la rama» es `epic/HOS-1352-verticales-billing`**, y nace para
recibir el PR de `U1`, que es el primer código (`DEC-ARCH-007` punto 1). **Nace de `staging` con el CI
ya encendido**: los cambios de `DEC-CI-001` entran antes, en un PR propio a `staging` (A). **Para
`U3`, el script del corte, «la fecha del §2» se lee como la de su diseño, que ya está escrito**; el
código lo construye `U3` como cualquier otra unidad, sobre la rama, y se mergea antes del ensayo del
corte (F). La estrategia de despliegue se escribe **antes de que nazca la rama**, porque después
se escribe con código adentro, que es la posición desde la cual una decisión de rollback deja de ser
una decisión y pasa a ser una descripción de lo que ya se hizo.

Dueña del AC: [U1](10-corte/U1.md#pieza-u1); el momento 1 se cumple pieza por pieza y las otras 29
lo implementan.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1031, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1033, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1050, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1026, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:72, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:74, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:81, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:84, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:87

<a id="gate-m1-1"></a>
**Momento 1, condición 1**: cumple el criterio de su fila en el §4 de su descomposición
(`V/descomposicion.md`, `B/descomposicion.md`) o, para `U1`, `U2` y `U3`, el de su fila del §4.6.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1035

<a id="gate-m1-2"></a>
**Momento 1, condición 2**: sus guards están escritos, enchufados en `pnpm check:guards` y en el job
`guards` de `ci.yml` (`C-5`, `15-fase-9/01-R6-resuelto.md`), y rotos a propósito contra el job.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1037

<a id="gate-m1-3"></a>
**Momento 1, condición 3**: no deja ningún escritor declarado sin implementar
([DEC-TEST-002](01-decisiones-vigentes.md#dec-test-002)).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1039

<a id="gate-m1-4"></a>
**Momento 1, condición 4**: **cada fila `UNKNOWN` de la matriz en la que se apoya tiene sus dos ramas
escritas y una prueba por rama contra el proveedor falso** (D;
[DEC-TEST-002#📌1](01-decisiones-vigentes.md#dec-test-002-p1)). La batería semanal (`B/20` §4.1) la
sigue midiendo, y cuando la fila cierra, la rama que no vale se borra. El §61 prohíbe *empezar* una
capability crítica con su fila `UNKNOWN`, y esto no lo cambia: dice qué hace falta para *terminar*
la unidad que se apoya en una. Las filas `UNKNOWN` están listadas en
[80-abiertos.md](80-abiertos.md).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1040

<a id="gate-m1-5"></a>
**Momento 1, condición 5**: sus e2e están adaptados en el mismo PR (`15-fase-9/01-R6-resuelto.md`).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1045

<a id="gate-m1-6"></a>
**Momento 1, condición 6**: su PR hacia la rama tiene `CI Pass` concluido en `SUCCESS` sobre el
rollup completo, **con el CI de la rama encendido antes de que la rama nazca** (A; §4.6), y pasó una
revisión de contexto fresco antes del merge.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1046

<a id="gate-m2"></a>

### Momento 2 · la rama se da por lista para entrar a `staging`

El PR final del paraguas a `staging` no se abre hasta que (D-3) se cumplen las tres condiciones de
abajo ([GATE:M2.1](#gate-m2-1) a [GATE:M2.3](#gate-m2-3)). El merge lo decide el owner, como todo
merge a `staging`. Desde ahí `staging` queda congelado para `main` hasta el corte (§4.4, ver el
[paso 3](#paso-3)).

Es lo que hace cumplir [DEC-ARCH-007](01-decisiones-vigentes.md#dec-arch-007): las dos épicas
llegan juntas a producción, y la unidad que llega a `staging` es el paraguas. Con
[DEC-ARCH-007#📌3](01-decisiones-vigentes.md#dec-arch-007-p3), *«juntas y terminadas»* quiere decir
el alcance del corte: las 22 piezas del corte que fija
[DEC-ARCH-017](01-decisiones-vigentes.md#dec-arch-017); las fases posteriores son del sistema nuevo,
aditivas, y cada una tiene su propio gate ([GATE:FP](#gate-fp)).

**La FASE 7 del paraguas quedó cerrada antes de que nazca la rama** (§5 de `D/16`; FASES 6 y 7,
owner 2026-09-30, A a F): **ninguno de los seis ítems huérfanos** queda sin contestar —`acceptance
gates` es esta sección; `staging`, los pasos y el congelamiento del [paso 3](#paso-3); `rollout`,
cerrado por las ramas y el orden de despliegue; `rollback`, decidido en el [paso 2b](#paso-2b); y
`coexistence` y `feature flags` no existen ([paso 0b](#paso-0b))—. **Una restricción que ya está
fijada y lo acota**: `DEC-ARCH-007` decidió que **las dos épicas llegan juntas**, así que la
estrategia no tiene que resolver *«cómo sale una sola»* — no existe ese caso, y la ausencia de una
tercera implementación del contrato de cobertura (`12-contrato-de-cobertura.md` §5.3) descansa en lo
mismo. **Por qué no alcanza con que cada épica escriba la suya y después se junten** (§1 de `D/16`):
es lo que produjo el hueco; **dos mitades que no despliegan no suman una estrategia de despliegue.**

Dueña del AC: la pseudo-pieza `CORTE` ([AC:CORTE:10](#ac-corte-10)).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1080, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1082, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1090, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1200, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1206, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1209, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:39, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:64

<a id="gate-m2-1"></a>
**Momento 2, condición 1**: **las 22 piezas del corte están en `Done`** (corte del MVP, owner
2026-10-01, Y; [DEC-ARCH-016#📌1](01-decisiones-vigentes.md#dec-arch-016-p1); la lista, en el §4.6 y
en [00-indice.md](00-indice.md)); las ocho posteriores no lo frenan.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1084

<a id="gate-m2-2"></a>
**Momento 2, condición 2**: `staging` está mergeado hacia la rama y la rama está verde en su último
`push`.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1086

<a id="gate-m2-3"></a>
**Momento 2, condición 3**: `e2e-pr`, `codeql`, y `lighthouse` y `a11y-sweep` por
`workflow_dispatch`, tienen conclusión `success` fechada después del último merge a la rama
(`15-fase-9/01-R6-resuelto.md`, chequeo 7).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1087

<a id="gate-m3"></a>

### Momento 3 · antes del ensayo del corte

El ensayo es el [paso 0](#paso-0) y corre en `staging`, con la épica ya adentro. Antes de
arrancarlo: `U3` está mergeada (F); se releyeron las dos situaciones que una restauración no deshace
(§4.3, en el [paso 2b](#paso-2b)); los plazos sin valor tienen el suyo desde el merge de `V6`
([paso 3](#paso-3)); y está la copia de la base de producción restaurada en `staging`, con los
correos reescritos a una casilla que no entrega y la lista real de las cinco (C).

**Qué es un ensayo verde** (D-5): arranca con la imagen vieja desplegada en `staging` y es verde
cuando **cada verificación de los pasos pasó, en su orden, sin tocar nada a mano fuera de lo que el
paso dice** —**incluida la rama de aborto, recorrida una vez sobre la misma copia** (corte del MVP,
owner 2026-10-02, BQ Q1; [DEC-ARCH-016#📌2](01-decisiones-vigentes.md#dec-arch-016-p2))—; cualquier
intervención no escrita lo vuelve rojo y se escribe antes del reintento. **La
parte de `staging` del checklist de smoke del sistema nuevo va adentro del ensayo** (B). Terminado
el ensayo, la copia se borra (C).

Dueña del AC: la pseudo-pieza `CORTE` ([AC:CORTE:1](#ac-corte-1)), con
[U3](10-corte/U3.md#pieza-u3) que la usa.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1093, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1095, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1101

<a id="gate-m4"></a>

### Momento 4 · antes del corte real

El paso 1 en producción es irreversible, y el punto de no retorno está entre el paso 2 y el paso 3.
No arranca sin **los ocho gates que dejó la simplificación del corte**
(`38-fase-5/20-simplificacion-del-corte.md` §13, *«Quedan 8»*): el ensayo, la lista del seudónimo, el
0b verificado, la relectura, la completitud, el journal, el 3a y el 4b (D-4), **con el ensayo
definido como en el momento 3 y el smoke de `staging` adentro** (B, C).

Dueña del AC: la pseudo-pieza `CORTE` ([AC:CORTE:12](#ac-corte-12)).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1107, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1109

<a id="gate-m5"></a>

### Momento 5 · el programa se da por aceptado

Después del paso 5, **el owner corre el smoke de producción del checklist nuevo** ([paso
5c](#paso-5c); B). **El programa se da por aceptado cuando el sistema nuevo acreditó su primer cobro
real de una cuenta que se suscribió después del corte, y el barrido diario corrió siete días seguidos
sin una divergencia sin explicar** (E). Esa observación retira la etiqueta `status-needs-smoke-prod`
de `HOS-1352` y dispara la tarea de cierre (sacar los informes del repositorio y reescribir el diseño
sin tachados; `spec.md`, *«Al cerrar HOS-1352»*). **Si nadie se suscribe, la espera se revisa a los 30
días** (E). El barrido diario es de [B11](10-corte/B11.md#pieza-b11) y el checklist, de
[B13a](10-corte/B13a.md#pieza-b13a). **Los precios, congelados hasta este momento**
([BM](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bm)): los del corte son los vigentes hoy, los
carga el paso 3a y **ningún precio cambia hasta que el momento 5 esté cumplido**; es una condición
operativa, no un control del código: la acción 19 existe desde `B2` y su uso queda vedado hasta acá.

Dueña del AC: la pseudo-pieza `CORTE` ([AC:CORTE:13](#ac-corte-13)).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1115, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1117, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1125

<a id="gate-fp"></a>

### Las fases posteriores

(Corte del MVP, owner 2026-10-01, Y y AE; [DEC-ARCH-017](01-decisiones-vigentes.md#dec-arch-017).)
Las ocho piezas que van después llegan en **fases posteriores, aditivas sobre el sistema nuevo**: no
reescriben filas ni código del corte, y no traen migración estructural (AD). **Cada fase posterior
viaja en una rama épica nueva** (`epic/**`, `DEC-CI-001`), con **los mismos gates por unidad** —el
momento 1, pieza por pieza—, y **entra a `staging` entera** (AE). Los momentos 3 a 5 son del corte y
no se repiten. **El gate propio de una fase posterior** (corte del MVP, owner 2026-10-01, AT, la 1)
son las tres condiciones de abajo ([GATE:FP.1](#gate-fp-1) a [GATE:FP.3](#gate-fp-3)).

Y una excepción declarada a *«aditiva»*, la única: **`B8b` saca de Mi Suscripción el aviso
*«todavía no se puede cambiar de plan…»* que `B13a` muestra al corte** (AU), y nada más que ese
texto.

**Las fases posteriores son cuatro, en este orden** (corte del MVP, owner 2026-10-01, AW, la 1),
cada una en su rama épica y con el gate de arriba: [GATE:FP.F1](#gate-fp-f1) a
[GATE:FP.F4](#gate-fp-f4). El orden lo fija AW; que la fase 4 pueda adelantarse a la 2 o a la 3 no
lo dice *(la fuente lo marca; ver [80-abiertos.md](80-abiertos.md))*.

Dueña del AC: la pseudo-pieza `CORTE` ([AC:CORTE:14](#ac-corte-14)).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1135, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1137, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1155, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1159, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1169

<a id="gate-fp-1"></a>
**Gate de fase, condición 1**: **el momento 2 aplicado a la rama de la fase**: sus piezas en `Done`;
`staging` mergeado hacia la rama y verde en su último `push`; `e2e-pr`, `codeql`, `lighthouse` y
`a11y-sweep` con conclusión `success` fechada después del último merge a la rama; y el merge lo decide
el owner.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1145

<a id="gate-fp-2"></a>
**Gate de fase, condición 2**: **el checklist de smoke del sistema nuevo, extendido con lo de la
fase**: la parte de `staging`, ejecutada antes del merge de la rama a `staging`, y la de producción,
como **un 5c propio** de la fase, con la tarjeta del owner y un monto aprobado de antemano, después de
que la fase llegue a producción. El checklist que se extiende es de
[B13a](10-corte/B13a.md#pieza-b13a) ([GATE:SMOKE](#gate-smoke)).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1148

<a id="gate-fp-3"></a>
**Gate de fase, condición 3**: **el drift guard sobre la rama de la fase, en verde**: ninguna
migración estructural (AP, §4.6). *(Que el drift guard entre como condición del gate lo derivó la
fuente de la mitigación de AP; lo marca.)* *(Cómo se enciende sobre la rama de la fase lo fija
[DEC-CI-001](01-decisiones-vigentes.md#dec-ci-001); la fuente lo marca como lo que falta escribir al
abrir la primera fase: `D/16-fase-7-del-paraguas.md:1019`, y va en [80-abiertos.md](80-abiertos.md)
§4.)*

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1152

<a id="gate-fp-f1"></a>
**Fase 1**: [V9b](20-fase-1/V9b.md#pieza-v9b). **Por qué en ese lugar**: tiene que estar mergeada
antes de la primera fecha en que un aviso de retención podría salir (AC), y `B10` la espera
(`V9b → B10`). Dueña del AC: [V9b](20-fase-1/V9b.md#pieza-v9b).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1164

<a id="gate-fp-f2"></a>
**Fase 2**: [B8b](20-fase-2/B8b.md#pieza-b8b) y [B9b](20-fase-2/B9b.md#pieza-b9b). **Por qué en ese
lugar**: `B9b` espera a `B8b` (la sucesión), y `B10` espera a `B9b`.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1165

<a id="gate-fp-f3"></a>
**Fase 3**: [B10](20-fase-3/B10.md#pieza-b10), [B13b](20-fase-3/B13b.md#pieza-b13b) y
[B12](20-fase-3/B12.md#pieza-b12). **Por qué en ese lugar**: `B10` espera a `V9b` y a `B9b`; `B13b`,
a `B10`; `B12`, a `B13b`.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1166

<a id="gate-fp-f4"></a>
**Fase 4**: [V7](20-fase-4/V7.md#pieza-v7) y [V8b](20-fase-4/V8b.md#pieza-v8b). **Por qué en ese
lugar**: `V8b` espera a `V7`; ninguna otra pieza posterior espera a `V7`.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1167

<a id="gate-smoke"></a>

### El smoke manual del cobro nuevo

(B; `F-8cC2-005`, que estaba abierto desde la FASE 8-bis-2.) **Un checklist nuevo, del sistema
nuevo, en dos partes**, que escribe `B13a` en `docs/billing/` —no en `.specs/`, que sale al cierre—
(el recorte del checklist viejo que hacía `B13` se retira por quedar sin sujeto: el viejo vive en
`staging` y gobierna al sistema viejo hasta el corte, y el nuevo lo reemplaza con el corte; FASES 6 y
7, lote de la aplicación, owner 2026-09-30, L): **la de `staging`**, que se ejecuta dentro del ensayo
([GATE:M3](#gate-m3)), y **la de producción**, el [paso 5c](#paso-5c). Cubre lo que el diseño declara
que no se puede simular: el checkout real, los correos del proveedor, el borde y los horarios. *(La
fuente lo derivó y lo marca: el nivel de producción de la regla vieja del `CLAUDE.md` —observar en
producción, antes de promover, algo que sólo existe después de promover— es insatisfacible para un
reemplazo, y el lote pone la parte de producción después del paso 5; su lugar lo toma el 5c.)* Las
etiquetas `status-needs-smoke-*` van sólo en `HOS-1352` ([GATE:M1](#gate-m1)).

Dueña del AC: [B13a](10-corte/B13a.md#pieza-b13a), que se lleva el checklist al corte.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1178, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1180

#### E2E: lo que hoy se hace a mano (`V/20` §5)

(FASES 6 y 7, owner 2026-09-30; lo derivado, D-2 y D-3;
[DEC-ARCH-016](01-decisiones-vigentes.md#dec-arch-016).) **Cada unidad adapta sus e2e en el mismo
PR**, como parte de su gate ([GATE:M1.5](#gate-m1-5)), y **el PR final de la épica no se abre sin
`e2e-pr`, `codeql` (FASES 6 y 7, verificación, 2026-09-30, F9), `lighthouse` y `a11y-sweep` con
`success` fechado después del último merge a la rama del paraguas** ([GATE:M2.3](#gate-m2-3)). El
smoke manual del sistema nuevo no es de la mitad de verticales: es el checklist de arriba, que
escribe `B13a` (`B/20` §5.1, punto 4). De la lista de lo que hoy se hace a mano, la fuente
conserva un solo punto, el 1: el **trial** completo —activación, campaña previa, vencimiento,
campaña de recuperación y conversión tardía—.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:371, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:373, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:380

## La pseudo-pieza `CORTE`: criterios de aceptación y tests

Por [BE](01-decisiones-vigentes.md#own-41-corte-del-mvp-t7-be): los ítems cuya dueña en el contrato
de cobertura es el corte —pasos, gates de los momentos y de las fases, y las decisiones que sólo el
corte ejecuta— llevan su AC acá, sin US, y sus tests son smoke manual (el ensayo en `staging`, el 5c
en producción) o guard estático. Son 34 ítems; cada AC cita los suyos en `Fuente:`.

<a id="ac-corte-1"></a>
**AC:CORTE:1** — el ensayo del corte es verde

- **Dado** que [U3](10-corte/U3.md#pieza-u3) está mergeada, los plazos sin valor tienen el suyo desde
  el merge de `V6`, y hay en `staging` una copia de la base de producción restaurada con los correos
  reescritos a una casilla que no entrega y la lista real de las cinco cuentas, con la imagen vieja
  desplegada
- **Cuando** quien opera el corte corre el ensayo, que es el paso 0, siguiendo los pasos del corte en
  su orden, con la parte de `staging` del checklist de smoke adentro
- **Entonces** el ensayo es verde sólo si cada verificación que los pasos nombran pasó, en su orden,
  sin tocar nada a mano fuera de lo que el paso dice; cualquier intervención no escrita lo vuelve rojo
  y se escribe antes del reintento; terminado el ensayo, la copia se borra

Fuente: [PASO:0](#paso-0), [GATE:M3](#gate-m3)

<a id="ac-corte-2"></a>
**AC:CORTE:2** — sin la lista del seudónimo medida y el tope de purgas verificado, el corte no avanza

- **Dado** el paso 0 del corte
- **Cuando** se mide `EX-49` (la distribución de dominios de la tabla de usuarios, contando sólo
  dominios, y la prueba de unos 30 correos sobre cuentas receptoras nuevas del owner) y se lee el
  tope de purgas del plan del borde
- **Entonces** la lista del seudónimo queda cerrada y medida antes del corte: lo que `V/02` §2.2 da
  en su tabla como *«si la medición lo confirma»* entra sólo si lo confirma, y lo que la medición
  muestre fuera de la tabla vuelve al owner y no se aplica mientras no conteste; si no hay medición,
  el corte no avanza; y el tope de purgas admite las 22 purgas por destino del 4c

Fuente: [PASO:0](#paso-0), [MP:EX-49](04-catalogos.md#mp-ex-49)

<a id="ac-corte-3"></a>
**AC:CORTE:3** — la regla del 0b bloquea toda escritura salvo los avisos de Mercado Pago

- **Dado** el corte en curso, entre el paso 0b y el paso 5 (o, si se abortó, hasta el reintento), y
  Juan, que tiene su ficha a la vista
- **Cuando** alguien, desde afuera, manda una petición que no es mirar, al sitio viejo o al nuevo
- **Entonces** el borde la rechaza, salvo la ruta de avisos de Mercado Pago, que queda abierta todo el
  corte; Juan puede ver su ficha pero no loguearse ni editar; nadie crea una cuenta ni una ficha en
  el medio, y no hay altas ni en el viejo ni en el nuevo; la regla es configuración del borde, no
  código de ninguna épica

Fuente: [PASO:0b](#paso-0b), [DEC-MIG-007](01-decisiones-vigentes.md#dec-mig-007), [DEC-MIG-002#📌1](01-decisiones-vigentes.md#dec-mig-002-p1), [DEC-ARCH-014#📌4](01-decisiones-vigentes.md#dec-arch-014-p4)

<a id="ac-corte-4"></a>
**AC:CORTE:4** — hay backup antes del paso 3

- **Dado** que el paso 2 cerró
- **Cuando** se va a desplegar el paso 3
- **Entonces** existe un backup de la base tomado en el paso 2b, que es lo que restaura la rama de
  aborto, incluidas las fichas que la migración del paso 3 borra

Fuente: [PASO:2b](#paso-2b)

<a id="ac-corte-5"></a>
**AC:CORTE:5** — abortar es restaurar el 2b y volver a la imagen vieja, con la regla del 0b puesta

- **Dado** que algo falla después del paso 1b: un preapproval que el paso 2 no ve `cancelled` después
  de reintentar, un recorrido que el paso 2 no da por completo, o el paso 3 con el 4b adentro
- **Cuando** se toma la rama de aborto
- **Entonces** antes de restaurar se relee la sonda del 4b y se cancela si no está `cancelled`, y si
  el pago chico del 4b no se devolvió se devuelve y se relee por id; se restaura el backup del 2b; si
  el paso 3 alcanzó a reemplazar la imagen, se redespliega la vieja y se reencienden y verifican su
  webhook y sus crons; nadie reactiva planes ni reabre la venta; y la regla del 0b queda puesta hasta
  el reintento, con la plataforma entera en sólo lectura

Fuente: [PASO:2b](#paso-2b), [DEC-MIG-002#📌3](01-decisiones-vigentes.md#dec-mig-002-p3), [DEC-MIG-005#📌7](01-decisiones-vigentes.md#dec-mig-005-p7)

<a id="ac-corte-6"></a>
**AC:CORTE:6** — el paso 3 despliega en tres actos, con los crons apagados y sin convivencia

- **Dado** que el paso 2 cerró y el backup del 2b está tomado
- **Cuando** se despliega el paso 3
- **Entonces** primero se apaga el sistema viejo —contenedor, webhook y crons— y se verifica; después
  se migra con `hops db-migrate --pull` sólo si el checkout que migra está en el mismo commit que la
  imagen nueva; y por último se levanta la imagen nueva con `HOSPEDA_CRON_ADAPTER` apagado; los dos
  sistemas no conviven en ningún momento

Fuente: [PASO:3](#paso-3), [DEC-MIG-003#📌7](01-decisiones-vigentes.md#dec-mig-003-p7), [DEC-MIG-001#📌1](01-decisiones-vigentes.md#dec-mig-001-p1)

<a id="ac-corte-7"></a>
**AC:CORTE:7** — el journal de la imagen está aplicado entero en producción

- **Dado** que el paso 3 migró
- **Cuando** se compara el journal de la imagen con la tabla de migraciones aplicadas de producción
- **Entonces** toda migración del journal figura como aplicada; si falta alguna, el corte no sigue y
  entra la rama de aborto

Fuente: [PASO:3](#paso-3)

<a id="ac-corte-8"></a>
**AC:CORTE:8** — el catálogo cargado cumple las validaciones antes del 3b

- **Dado** que la migración del paso 3 cargó el catálogo de producción y la versión 1 de los plazos
- **Cuando** quien opera el corte verifica, contra la base de producción, las condiciones de [G-R3](04-catalogos.md#val-g-r3),
  las demás validaciones del panel sobre el catálogo y los plazos, y el espejo del enum de verticales
- **Entonces** si alguna no da, el corte no sigue al 3b

Fuente: [PASO:3a](#paso-3a), [VAL:G-R3](04-catalogos.md#val-g-r3)

<a id="ac-corte-9"></a>
**AC:CORTE:9** — el paso 5 levanta la regla y prende los crons sólo con el 4b verificado

- **Dado** que el 4b verificó la entrega real de Webhooks y de IPN
- **Cuando** quien opera el corte ejecuta el paso 5
- **Entonces** levanta la regla del 0b y prende los crons (`HOSPEDA_CRON_ADAPTER`); antes de este paso
  el sistema nuevo no creó nada en el proveedor ni sus crons mandaron nada

Fuente: [PASO:5](#paso-5)

<a id="ac-corte-10"></a>
**AC:CORTE:10** — el PR final del paraguas a `staging` espera a las 22 piezas y a la rama en verde

- **Dado** la rama `epic/HOS-1352-verticales-billing`
- **Cuando** se quiere abrir el PR final del paraguas a `staging`
- **Entonces** no se abre hasta que las 22 piezas del corte están en `Done` (las ocho posteriores no
  lo frenan), `staging` está mergeado hacia la rama y la rama está verde en su último `push`, y
  `e2e-pr`, `codeql`, `lighthouse` y `a11y-sweep` tienen conclusión `success` fechada después del
  último merge a la rama; ninguna épica llega sola a `staging`, y el merge lo decide el owner

Fuente: [GATE:M2](#gate-m2), [GATE:M2.1](#gate-m2-1), [GATE:M2.2](#gate-m2-2), [GATE:M2.3](#gate-m2-3), [DEC-ARCH-007](01-decisiones-vigentes.md#dec-arch-007), [DEC-ARCH-007#📌3](01-decisiones-vigentes.md#dec-arch-007-p3), [DEC-ARCH-016#📌1](01-decisiones-vigentes.md#dec-arch-016-p1)

<a id="ac-corte-11"></a>
**AC:CORTE:11** — desde que la épica entra, `staging` queda congelado para `main` hasta el corte

- **Dado** que la épica entró a `staging`
- **Cuando** alguien intenta promover `staging → main` antes del paso 3
- **Entonces** la promoción no se hace ([DEC-ARCH-007#📌1](01-decisiones-vigentes.md#dec-arch-007-p1));
  los hotfix siguen yendo a `main` con su back-merge a `staging`. (El guard de destino no la frena
  desde T: los commits de la épica ya están en `staging`.)

Fuente: [DEC-ARCH-007#📌1](01-decisiones-vigentes.md#dec-arch-007-p1), [GATE:M2](#gate-m2)

<a id="ac-corte-12"></a>
**AC:CORTE:12** — el paso 1 en producción no arranca sin los ocho gates

- **Dado** el día del corte real en producción
- **Cuando** se va a ejecutar el paso 1
- **Entonces** no arranca sin los ocho gates: el ensayo verde (con el smoke de `staging` adentro), la
  lista del seudónimo, el 0b verificado, la relectura, la completitud, el journal, el 3a y el 4b

Fuente: [GATE:M4](#gate-m4), [PASO:0](#paso-0)

<a id="ac-corte-13"></a>
**AC:CORTE:13** — el programa se da por aceptado con un cobro real y siete días de barrido limpio

- **Dado** que el corte terminó en el paso 5 y el owner corrió el smoke de producción del 5c
- **Cuando** Juan, anfitrión de una cabaña en Colón, se suscribe al Básico la semana siguiente al
  corte y el sistema nuevo acredita su primer cobro real, y el barrido diario corre siete días
  seguidos sin una divergencia sin explicar
- **Entonces** el programa se da por aceptado: se retira la etiqueta `status-needs-smoke-prod` de
  `HOS-1352` y se dispara la tarea de cierre; si nadie se suscribe, la espera se revisa a los 30 días

Fuente: [GATE:M5](#gate-m5)

<a id="ac-corte-14"></a>
**AC:CORTE:14** — cada fase posterior entra a `staging` entera, en su rama, con su gate

- **Dado** una fase posterior con sus piezas
- **Cuando** su rama épica nueva (`epic/**`) se quiere mergear a `staging`
- **Entonces** cada pieza pasó el momento 1; se cumple el momento 2 aplicado a la rama de la fase
  (sus piezas en `Done`, `staging` mergeado hacia la rama y verde, `e2e-pr`, `codeql`, `lighthouse` y
  `a11y-sweep` en `success` después del último merge, y el merge lo decide el owner); la fase entra
  entera; y los momentos 3 a 5 no se repiten

Fuente: [GATE:FP](#gate-fp), [GATE:FP.1](#gate-fp-1), [DEC-ARCH-007#📌3](01-decisiones-vigentes.md#dec-arch-007-p3)

<a id="ac-corte-15"></a>
**AC:CORTE:15** — cada fase posterior ejecuta el checklist extendido en `staging` y su propio 5c

- **Dado** una fase posterior lista para entrar
- **Cuando** se ejecuta su gate
- **Entonces** la parte de `staging` del checklist de smoke, extendida con lo de la fase, se ejecuta
  antes del merge de la rama a `staging`, y la de producción corre como un 5c propio de la fase, con
  la tarjeta del owner y un monto aprobado de antemano, después de que la fase llegue a producción

Fuente: [GATE:FP.2](#gate-fp-2)

<a id="ac-corte-16"></a>
**AC:CORTE:16** — una fase posterior no trae migración estructural

- **Dado** la rama de una fase posterior
- **Cuando** corre el drift guard sobre ella
- **Entonces** está en verde: la fase no trae ninguna migración estructural, porque todo el esquema
  nació al corte

Fuente: [GATE:FP.3](#gate-fp-3), [AD](01-decisiones-vigentes.md#own-41-corte-del-mvp-t1-ad), [AP](01-decisiones-vigentes.md#own-41-corte-del-mvp-t3-ap)

<a id="ac-corte-17"></a>
**AC:CORTE:17** — las fases 2, 3 y 4 respetan el orden de AW

- **Dado** las cuatro fases posteriores
- **Cuando** se abren sus ramas y se mergean a `staging`
- **Entonces** la fase 2 lleva `B8b` y `B9b`, la fase 3 lleva `B10`, `B13b` y `B12`, y la fase 4
  lleva `V7` y `V8b`, cada una en su rama épica y con su gate, en el orden 1, 2, 3, 4

Fuente: [GATE:FP.F2](#gate-fp-f2), [GATE:FP.F3](#gate-fp-f3), [GATE:FP.F4](#gate-fp-f4), [AW](01-decisiones-vigentes.md#own-41-corte-del-mvp-t5-aw)

<a id="ac-corte-18"></a>
**AC:CORTE:18** — ninguna unidad se da por terminada con un escritor declarado sin implementar ni con
una fila `UNKNOWN` sin sus dos ramas

- **Dado** una pieza que se apoya en tablas que los capítulos declaran y en filas `UNKNOWN` de la
  matriz
- **Cuando** se la quiere dar por terminada (momento 1)
- **Entonces** no termina si deja un escritor declarado sin implementar, ni si alguna fila `UNKNOWN`
  en que se apoya no tiene sus dos ramas escritas y una prueba por rama contra el proveedor falso; es
  un criterio de terminación y no un guard

Fuente: [DEC-TEST-002](01-decisiones-vigentes.md#dec-test-002), [DEC-TEST-002#📌1](01-decisiones-vigentes.md#dec-test-002-p1), [GATE:M1.3](#gate-m1-3), [GATE:M1.4](#gate-m1-4)

<a id="ac-corte-19"></a>
**AC:CORTE:19** — el ensayo recorre la rama de aborto una vez, y `EX-49` se registra como `prod`

- **Dado** el ensayo del paso 0 en `staging`, sobre la copia de la base de producción restaurada con
  los correos reescritos y la lista real de las cinco cuentas, y la medición de `EX-49` antes del
  corte real
- **Cuando** en el ensayo se provoca una falla después del 1b, y se registra la medición de `EX-49`
- **Entonces** el ensayo recorre la rama de aborto una vez, sobre la misma copia, y verifica
  restaurar el 2b, redesplegar la imagen vieja, los inversos (b) y (c) y la regla del 0b puesta
  hasta el reintento; sin ese recorrido el ensayo no es verde; y la medición de `EX-49` se registra
  con la etiqueta `prod`, porque lee la tabla de usuarios de producción sin mutar nada y es gate del
  corte real

Fuente: [DEC-ARCH-016#📌2](01-decisiones-vigentes.md#dec-arch-016-p2), [PASO:0](#paso-0), [PASO:2b](#paso-2b), [GATE:M3](#gate-m3), [MP:EX-49](04-catalogos.md#mp-ex-49)

### Los tests de la pseudo-pieza `CORTE`

<a id="test-corte-1"></a>
**TEST:CORTE:1** — el ensayo completo en `staging`, verde según la definición de D-5.
Tipo: smoke manual
Etiqueta: staging
Cubre: [AC:CORTE:1](#ac-corte-1), [AC:CORTE:12](#ac-corte-12)
Fuente: [PASO:0](#paso-0), [GATE:M3](#gate-m3)

<a id="test-corte-2"></a>
**TEST:CORTE:2** — la medición de `EX-49` y la lectura del tope de purgas del borde, antes del corte
real.
Tipo: smoke manual
Etiqueta: prod
Cubre: [AC:CORTE:2](#ac-corte-2), [AC:CORTE:19](#ac-corte-19)
Fuente: [PASO:0](#paso-0), [MP:EX-49](04-catalogos.md#mp-ex-49), [DEC-ARCH-016#📌2](01-decisiones-vigentes.md#dec-arch-016-p2)

<a id="test-corte-3"></a>
**TEST:CORTE:3** — en el ensayo: con la regla del 0b puesta, una petición de escritura desde afuera
vuelve rechazada en los dos sitios, y un aviso de Mercado Pago llega a su ruta.
Tipo: smoke manual
Etiqueta: staging
Cubre: [AC:CORTE:3](#ac-corte-3)
Fuente: [PASO:0b](#paso-0b)

<a id="test-corte-4"></a>
**TEST:CORTE:4** — el día del corte: la misma verificación del 0b, en producción, antes del 1a.
Tipo: smoke manual
Etiqueta: prod
Cubre: [AC:CORTE:3](#ac-corte-3), [AC:CORTE:12](#ac-corte-12)
Fuente: [PASO:0b](#paso-0b), [GATE:M4](#gate-m4)

<a id="test-corte-5"></a>
**TEST:CORTE:5** — en el ensayo y el día del corte: el backup del 2b existe antes del paso 3 (AN: el
día del corte es producción, `D/16-fase-7-del-paraguas.md:151`).
Tipo: smoke manual
Etiqueta: staging, prod
Cubre: [AC:CORTE:4](#ac-corte-4)
Fuente: [PASO:2b](#paso-2b)

<a id="test-corte-6"></a>
**TEST:CORTE:6** — en el ensayo, una vez y sobre la misma copia: una falla provocada después del 1b,
y la rama de aborto recorrida con la secuencia escrita: inversos (b) y (c), restauración del 2b,
redespliegue de la imagen vieja con webhook y crons verificados, y la regla del 0b todavía puesta
hasta el reintento (BQ Q1).
Tipo: smoke manual
Etiqueta: staging
Cubre: [AC:CORTE:5](#ac-corte-5), [AC:CORTE:19](#ac-corte-19)
Fuente: [PASO:2b](#paso-2b), [DEC-MIG-005#📌7](01-decisiones-vigentes.md#dec-mig-005-p7), [DEC-ARCH-016#📌2](01-decisiones-vigentes.md#dec-arch-016-p2)

<a id="test-corte-7"></a>
**TEST:CORTE:7** — en el ensayo: los tres actos del paso 3 (apagado del viejo verificado, igualdad
de commit, imagen nueva con los crons apagados) y la comparación del journal con la tabla de
migraciones aplicadas.
Tipo: smoke manual
Etiqueta: staging
Cubre: [AC:CORTE:6](#ac-corte-6), [AC:CORTE:7](#ac-corte-7)
Fuente: [PASO:3](#paso-3)

<a id="test-corte-8"></a>
**TEST:CORTE:8** — el día del corte: los mismos tres actos y la verificación del journal en
producción.
Tipo: smoke manual
Etiqueta: prod
Cubre: [AC:CORTE:6](#ac-corte-6), [AC:CORTE:7](#ac-corte-7), [AC:CORTE:12](#ac-corte-12)
Fuente: [PASO:3](#paso-3), [GATE:M4](#gate-m4)

<a id="test-corte-9"></a>
**TEST:CORTE:9** — en el ensayo y el día del corte: la verificación del 3a contra la base (las
validaciones del panel, [G-R3](04-catalogos.md#val-g-r3) entre ellas, y el espejo del enum de verticales)
(AN: el 3a del corte real corre contra producción, `D/16-fase-7-del-paraguas.md:153`).
Tipo: smoke manual
Etiqueta: staging, prod
Cubre: [AC:CORTE:8](#ac-corte-8)
Fuente: [PASO:3a](#paso-3a)

<a id="test-corte-10"></a>
**TEST:CORTE:10** — el día del corte: el paso 5 se ejecuta sólo con el 4b verificado, y los crons
quedan prendidos.
Tipo: smoke manual
Etiqueta: prod
Cubre: [AC:CORTE:9](#ac-corte-9)
Fuente: [PASO:5](#paso-5)

<a id="test-corte-11"></a>
**TEST:CORTE:11** — antes de abrir el PR final del paraguas: las 22 piezas en `Done` en Linear, la
rama al día con `staging` y verde, y los cuatro workflows en `success` después del último merge.
Tipo: smoke manual
Etiqueta: staging
Cubre: [AC:CORTE:10](#ac-corte-10)
Fuente: [GATE:M2](#gate-m2), [GATE:M2.1](#gate-m2-1)

<a id="test-corte-12"></a>
**TEST:CORTE:12** — el guard de destino `check-umbrella-branch-target.sh` con la condición de T: falla
un PR cuyo HEAD trae un commit de la rama épica que no está ni en el destino ni en `staging`, y no
falla la promoción `staging → main` cuando los commits de la épica ya están en `staging`
(`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:2838-2844`).
Tipo: guard estático
Mutación: volver a la condición de P (contar todo commit de la épica que el destino no tiene) y ver que la promoción `staging → main` con la épica mergeada falla.
Cubre: [AC:CORTE:11](#ac-corte-11)
Fuente: [DEC-ARCH-007#📌1](01-decisiones-vigentes.md#dec-arch-007-p1)

<a id="test-corte-13"></a>
**TEST:CORTE:13** — el smoke de producción del 5c, el primer cobro real de una cuenta suscripta
después del corte y los siete días de barrido sin divergencia sin explicar.
Tipo: smoke manual
Etiqueta: prod
Cubre: [AC:CORTE:13](#ac-corte-13)
Fuente: [GATE:M5](#gate-m5)

<a id="test-corte-14"></a>
**TEST:CORTE:14** — por cada fase posterior, antes de su merge a `staging`: el momento 2 aplicado a
su rama y la parte de `staging` del checklist extendido.
Tipo: smoke manual
Etiqueta: staging
Cubre: [AC:CORTE:14](#ac-corte-14), [AC:CORTE:15](#ac-corte-15)
Fuente: [GATE:FP](#gate-fp), [GATE:FP.2](#gate-fp-2)

<a id="test-corte-15"></a>
**TEST:CORTE:15** — por cada fase posterior, después de llegar a producción: su 5c propio con la
tarjeta del owner y un monto aprobado de antemano.
Tipo: smoke manual
Etiqueta: prod
Cubre: [AC:CORTE:14](#ac-corte-14), [AC:CORTE:15](#ac-corte-15)
Fuente: [GATE:FP](#gate-fp), [GATE:FP.2](#gate-fp-2)

<a id="test-corte-16"></a>
**TEST:CORTE:16** — el drift guard sobre la rama de cada fase posterior.
Tipo: guard estático
Mutación: agregar a la rama de la fase una migración estructural y ver que el drift guard falla (es la mitigación de AP: falla si la fase trae una migración estructural).
Cubre: [AC:CORTE:16](#ac-corte-16)
Fuente: [GATE:FP.3](#gate-fp-3), [AP](01-decisiones-vigentes.md#own-41-corte-del-mvp-t3-ap)

<a id="test-corte-17"></a>
**TEST:CORTE:17** — al mergear la rama de cada fase a `staging`: la fase lleva exactamente sus piezas
(AW) y las piezas de las que dependen en el grafo ya entraron a `staging`. Cuándo se abre la rama no
lo fija la fuente, y si la fase 4 puede adelantarse a la 2 o a la 3 sigue abierto
([80-abiertos.md](80-abiertos.md) §4; `D/16-fase-7-del-paraguas.md:1162-1169`).
Tipo: smoke manual
Etiqueta: staging
Cubre: [AC:CORTE:17](#ac-corte-17)
Fuente: [GATE:FP.F2](#gate-fp-f2), [GATE:FP.F3](#gate-fp-f3), [GATE:FP.F4](#gate-fp-f4)

<a id="test-corte-18"></a>
**TEST:CORTE:18** — en la revisión previa al merge de cada pieza: ningún escritor declarado sin
implementar y cada fila `UNKNOWN` en que se apoya con sus dos ramas y una prueba por rama.
Tipo: smoke manual
Etiqueta: staging
Cubre: [AC:CORTE:18](#ac-corte-18)
Fuente: [DEC-TEST-002](01-decisiones-vigentes.md#dec-test-002), [DEC-TEST-002#📌1](01-decisiones-vigentes.md#dec-test-002-p1)

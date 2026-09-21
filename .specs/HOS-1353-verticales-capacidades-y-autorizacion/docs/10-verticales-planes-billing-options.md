---
title: Master Spec 10 — Verticales, planes y billing options
linear: HOS-1353
statusSource: linear
created: 2026-09-17
updated: 2026-09-20
status: CURRENT
fase: 2
capitulo: 10
cierra:
  - OD-ARCH-01
  - M-SUB-03
---

# 10 · Verticales, planes y billing options

Mitad **VERTICALES** del capítulo 10 del programa. La otra mitad vive en la otra épica.

Abre la Parte II. Acá empieza a describirse **comportamiento**, y la regla del índice rige desde
la primera línea: este capítulo **referencia** el núcleo y no redefine nada. Los nombres salen
del capítulo 01 (núcleo), las entidades y restricciones del 02, los estados del 03.

Lo que sí define es lo que ningún capítulo anterior podía definir: **qué diferencia
legítimamente a una vertical de otra, plan por plan**, y **qué pasa cuando algo del catálogo
deja de venderse** — un plan (`OD-ARCH-01`) o una vertical entera (`M-SUB-03`).

---

## 1. Las cinco verticales contra los ocho ítems del Eje 2

El capítulo 01 (núcleo) §4 fijó el criterio: el Eje 2 es una **lista cerrada de ocho ítems** y todo lo
demás es Eje 1. Eso es una regla; lo que sigue es su aplicación a las cinco verticales que hay
hoy (§6). La tabla no agrega ítems ni los interpreta: los instancia.

| # | ítem del Eje 2 | Turista | Alojamiento | Gastronomía | Experiencia | Partner |
|---|---|---|---|---|---|---|
| 1 | evento que activa el trial | pulsar *Empezar* (`DEC-TRIAL-006`) | publicar una ficha | publicar una ficha | publicar una ficha | **ninguno**: trial en cero días (`DEC-TRIAL-003`) |
| 2 | qué publica | nada | ficha | ficha | ficha | presencia de Partner, **sólo Gold** (§17.1) |
| 3 | sección de Mi Cuenta | sí | sí | sí | sí | sí |
| 4 | claves de entitlement y limit con sentido | subconjunto propio | subconjunto propio | subconjunto propio | subconjunto propio | subconjunto propio |
| 5 | camino de alta | self-service | self-service | self-service | self-service | **administrado**, dos caminos y no hay tercero (§17.3) |
| 6 | hereda Turista VIP | no aplica: es el origen | declarado en base (§16) | declarado en base | declarado en base | declarado en base |
| 7 | métodos de pago admitidos | declarado por plan | declarado por plan | declarado por plan | declarado por plan | declarado por plan; hoy Mercado Pago y manual (§17.2) |
| 8 | pricing propia | sí, Turista incluida (§47) | sí | sí | sí | sí |

> Nota: los ítems 7 (métodos de pago admitidos) y 8 (pricing propia) se desarrollan en la épica de
> billing.

### 1.1 Lo que la tabla hace visible

**Alojamiento, Gastronomía y Experiencia son idénticas en siete de los ocho ítems.** Difieren
únicamente en el ítem 4 — qué claves tienen sentido en cada una — y esa diferencia es
**configuración en base**, no comportamiento.

Esto no es una observación de estilo: es el §7 vuelto comprobable. Tres verticales que coinciden
en el evento de trial, en el recurso que publican, en el camino de alta, en la herencia, en los
métodos de pago y en la forma de su pricing **no pueden justificar una sola línea de código
separado**. El §5.2 describe exactamente el desenlace contrario —*«en vez de reutilizar
correctamente Alojamientos, aparecieron caminos separados»*— y la tabla es el instrumento que
permite responder «¿en qué ítem del Eje 2 se apoya esta bifurcación?» antes de escribirla.

Las dos que sí difieren de verdad son **Turista** (no publica nada, y es el origen de la herencia
en vez de su destino) y **Partner** (no tiene trial, no es self-service, y su presencia pública no
es una ficha). Las dos diferencias caen dentro de la lista cerrada, y ninguna de las dos habilita
un motor de billing propio.

### 1.2 Lo que NO está en la tabla, y por qué

**Los ciclos que ofrece un plan no son Eje 2.** El §19 pide soportar los cuatro y el capítulo 06
(épica de billing) los midió `VERIFIED` contra el proveedor; cuáles se ofrecen es **configuración
comercial de cada versión de plan** (cap. 02 §2.1, `UNIQUE(plan_version_id, ciclo)`). Un plan que
sólo venda anual es una fila de menos en `billing_option`, no una regla de su vertical.

Conviene decirlo porque es la confusión más fácil de cometer: *«Partner sólo hace anual»* suena a
comportamiento de vertical y es una decisión comercial de un plan, revocable sin deploy. Si se
modelara como Eje 2, cambiarla pediría un release.

**Tampoco están el grace, la pausa, el trial en días, ni los overrides del plan de trial.** Todos
son configuración por plan o por versión (`DEC-SUB-002`, `DEC-TRIAL-001`, `DEC-TRIAL-003`), y el
que sean configurables **por vertical** no los vuelve Eje 2: el Eje 2 es variación de
*comportamiento*, no de *valores*.

---

## 2. Qué se lee del catálogo, y desde dónde

El capítulo 02 fijó las entidades. Acá va la única regla de lectura que el resto de la Parte II
va a usar sin repetirla:

| quién pregunta | qué lee |
|---|---|
| **la pricing** (§47) y todo camino de alta | la **versión vigente** de cada plan de la vertical, **y sólo si es vendible** |
| **una fuente `SUSCRIPCIÓN`** | **su versión anclada**, sea vigente o no, sea vendible o no (`DEC-ARCH-001`) |
| **la derivación del plan de trial** (§10.3) | las versiones **vigentes y vendibles**, la de `rank` más alto y la más baja (`DEC-ARCH-002`) |
| **la comparación de tiers** (§27, §28) | los `rank` de las versiones **vigentes y vendibles** |
| **un grant permanente** (§35) | la **versión vigente** del plan que ancló **en esa vertical**, **sea vendible o no** (`12-contrato-de-cobertura.md` §2.8) |
| **una fuente `BASE`, y una fuente de trial en `PRE_TRIAL`** | la versión vigente de la de **piso** y la de **pre-trial** de la vertical, **no vendibles por construcción** (cap. 02 §2.1) |

Las cuatro primeras filas dicen lo mismo de cuatro formas: **el catálogo es lo que se puede comprar
hoy; la suscripción es lo que se compró.** Son dos preguntas distintas y ninguna de las cuatro las
mezcla.

De acá sale la corrección que este capítulo le pide al núcleo, y que va aplicada en el capítulo
02 en el mismo commit: **«vendible» sin «vigente» no alcanza.** Un plan tiene varias versiones y
la restricción `UNIQUE(vertical, rank) WHERE vendible` del capítulo 02 §2.1 deja que una versión
vieja siga ocupando un `rank` que el plan ya no usa. La restricción aplicable es
`UNIQUE(vertical, rank) WHERE vendible AND vigente`, y cada plan tiene **exactamente una** versión
vigente.

### 2.1 Las dos últimas filas son de la FASE 9, y una mezcla a propósito

El enunciado de arriba se escribió sobre cuatro lectores y **con seis deja de ser cierto**, así que
hay que decir cuál es el enunciado que sí los cubre — y no es un ablande: la mezcla del grant está
**medida**, y la rama «pura» es la que rompe.

**El grant lee *«la vigente»* como la pricing y *«vendible o no»* como una suscripción.** Leerlo
como la pricing —exigiéndole `vendible`— es el defecto, no la ortodoxia: retirar un plan se hace
publicando una versión **no vendible** (`D13`, `B/10` §3.2), así que el día que se retira Premium **todos los
*Free Forever* anclados a él se quedarían sin nada** (`12-contrato…` §2.8). Y las dos versiones no
vendibles de cada vertical —la de piso y la de pre-trial— son el caso extremo del mismo problema:
si la resolución les exigiera `vendible`, **nadie tendría nada**, nunca.

> **Una lectura que resuelve lo que ALGUIEN TIENE nunca exige `vendible`; una que resuelve lo que
> SE PUEDE COMPRAR siempre lo exige.** *«Vigente»* y *«vendible»* son dos preguntas y se piden por
> separado.

Con ese enunciado las **seis** filas quedan del lado correcto sin excepción: la pricing, la
derivación del plan de trial y la comparación de tiers **venden**, y piden las dos; la fuente
`SUSCRIPCIÓN`, el grant y las dos versiones no vendibles **resuelven lo que alguien tiene**, y
ninguna pide `vendible`. Lo que cambia entre esas tres últimas es sólo **cuál versión** toman: la
suscripción, la que ancló; el grant y las no vendibles, la vigente.

**Y la fila 2 dice «fuente» y no «suscripción viva» a propósito.** Lo que lee el catálogo acá es
**verticales**, y verticales no ve filas de suscripción: ve fuentes (`12-contrato…` §4, y los dos
sentidos de *«vivo»* en el cap. 01 (núcleo) §2.4). La referencia que transporta la fuente **es** la
versión anclada, así que la fila no cambia de contenido — cambia de vocabulario, para que el que
la implemente no salga a buscar un estado que no le llega.

**Y la mitad que sigue rigiendo igual**: ninguna lectura de catálogo resuelve **lo que se compró**.
La referencia de una fuente `ADDON` sale de la **instancia** y no del producto (`B/02` §2.4) por
exactamente esta regla, del otro lado del corte.

---

## Lo que este capítulo NO cierra

- **Qué claves de entitlement y de limit tiene cada vertical** (el ítem 4 de la tabla) es del
  capítulo 15 (épica de verticales): acá está que el subconjunto es por vertical, no cuál es.
- **La pricing como superficie** es del capítulo 19. Acá está qué lee, no cómo se ve.

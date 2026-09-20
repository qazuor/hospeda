---
title: "FASE 7 del paraguas — la estrategia de despliegue que ninguna épica tiene"
linear: HOS-1352
statusSource: linear
created: 2026-09-19
updated: 2026-09-20
status: CURRENT
fase: 7
---

# 16 · La FASE 7 del paraguas

> **Este documento es del paraguas, no de una épica**, igual que
> [`12-contrato-de-cobertura.md`](./12-contrato-de-cobertura.md). Y por la misma razón: lo que
> describe **no le pertenece a ninguna de las dos**.

**Está escrito qué tiene que contestar, quién lo escribe y para cuándo** — que es lo que faltaba, y
lo que hacía que seis de los diez ítems del §65 no fueran de nadie. **De su contenido hay un ítem
resuelto**, el orden del corte (§4); los otros cinco siguen pendientes.

---

## 1. El hueco, y por qué no se cerraba solo

`DEC-ARCH-007` partió la FASE 7 **por épica**. El problema es que **ninguna de las dos épicas
despliega**: la unidad que llega a `staging` es **el paraguas**, y el paraguas **no tenía fase que
se la escribiera**.

De los diez ítems que el §65 pide para la FASE 7, cuatro encontraron dónde vivir y **seis
quedaron huérfanos**:

| ítem del §65 | dónde vive hoy |
|---|---|
| implementation order · dependency graph | la `descomposicion.md` de cada épica |
| migration | los dos `21-migracion.md` — y desde la decisión de no migrar, **casi sin sujeto** |
| observability | `NUCLEO/08` |
| **rollout** | — |
| **coexistence** | — |
| **staging** | **el §4**, en lo que hace al orden del corte |
| **feature flags** | — |
| **rollback** | — |
| **acceptance gates** | — |

Cuatro de los seis tienen **cero apariciones en todo el diseño del programa**: `rollout`,
`coexistence`, `feature flags` y `rollback`.

**Por qué no alcanza con que cada épica escriba la suya y después se junten**: es lo que ya pasó y
es lo que produjo el hueco. **Dos mitades que no despliegan no suman una estrategia de
despliegue.**

---

## 2. El momento, y no es una preferencia

> **Se escribe ANTES de que nazca la rama del paraguas.**

La rama todavía no existe —`git ls-remote` devuelve cero— y el desarrollo arranca en días. Después
de que nazca, **la estrategia de despliegue se escribe con código adentro**, que es exactamente la
posición desde la cual una decisión de rollback deja de ser una decisión y pasa a ser una
descripción de lo que ya se hizo.

---

## 3. El rollback es un ítem de esta fase, no una tarea aparte

Están juntos a propósito: **el rollback es uno de los seis ítems huérfanos**. Decidir quién
escribe la FASE 7 del paraguas **es** decidir quién escribe el rollback; separarlos lo deja como
una tarea suelta que nadie toma — que es exactamente su estado hasta ahora, con **la palabra
«rollback» sin aparecer en un solo documento de diseño del programa**.

> ⚠️ **Salvedad aceptada de antemano, y es el resultado más valioso posible.** Puede que la
> conclusión honesta sea **que no hay vuelta atrás**. Reemplazar el sistema de cobro no es revertir
> un deploy: si el corte se hizo y hay gente suscripta en el sistema nuevo, volver al viejo
> significa **deshacer compromisos reales con un proveedor externo**.
>
> Si la respuesta es *«no se puede volver, y el punto de no retorno es éste»*, **eso no es un
> fracaso del documento**. Saber dónde está el punto de no retorno y decidir con eso a la vista es
> mucho mejor que **descubrirlo cruzándolo**.

**Lo que este rollback NO es**: el rollback de las ocho filas de la cartera actual. Ése
desapareció con su sujeto cuando se decidió no migrar (los dos `21-migracion.md` §2). El de acá es
el del **programa**, y es de otro tamaño.

---

## 4. El primer ítem escrito: el orden del corte

De los seis huérfanos, éste se escribe ahora porque **su ausencia tiene un costo concreto y
fechado**, no porque sea el más fácil.

### 4.1 El punto de no retorno no desapareció: subió de escala

Decidir que **no se migra** eliminó el punto de no retorno **por fila** —ya no hay ocho
transcripciones que puedan quedar a medias— y **dejó intacto el del programa**, que es el que
importa:

> **Una autorización viva cobra DESPUÉS del despliegue que borró el código capaz de reconocerla.**
> La persona paga, el dinero entra, y del lado de Hospeda **no queda ni servicio ni asiento
> contable**: el sistema que sabía qué era ese identificador ya no existe, y el nuevo nunca lo
> conoció.

Son **tres** las que pueden hacerlo —las únicas con preapproval vivo—, y el hecho de que sean pocas
no cambia nada: **un cobro que entra sin asiento no es un problema de escala.**

### 4.2 El orden, y no es una preferencia

| # | paso | quién lo hace | por qué en ese lugar |
|---|---|---|---|
| 1 | **cancelar los tres preapprovals en el proveedor** | el sistema **viejo**, que todavía corre | es el único que sabe hacerlo; después del despliegue ese código no existe |
| 2 | **verificar releyendo cada uno por su id** y confirmar que quedó `cancelled` | ídem | `D5` ya lo exige para toda mutación, y `RC-2` mide que leer por id es confiable — **buscar no** (`RC-1`) |
| 3 | **desplegar** | — | recién acá, y sólo si el paso 2 cerró |
| 4 | **sembrar las lápidas** del cap. 21 §2.5 con los ids cancelados | el sistema **nuevo** | la fila es del esquema nuevo: no puede existir antes del paso 3 |

**El paso 2 es el gate, y es lo único que vuelve segura la secuencia**: si alguno de los tres **no
se pudo cancelar**, el corte **no avanza**. Es la misma forma que el programa ya usa en todas
partes —verificar releyendo en vez de creerle al código de estado— aplicada al único momento donde
no hay vuelta atrás.

**La ventana entre el paso 1 y el paso 3 es la parte incómoda, y se declara**: durante ese rato el
sistema viejo sigue corriendo con tres suscripciones canceladas. Si entra un cobro en vuelo, **lo
registra el viejo**, que es exactamente lo que queremos — sigue existiendo el lugar donde anotarlo.
Al revés, con el despliegue primero, ese mismo cobro cae en el vacío.

**Por qué no cancelar después de desplegar**, que es el orden intuitivo: el código que sabe cancelar
esos preapprovals **se va con el despliegue**. Cancelarlos después exige hacerlo a mano contra la
API del proveedor, sin idempotencia, sin registro y sin nadie que verifique — y es el caso que este
§ existe para evitar.

### 4.3 Lo que este orden NO resuelve

**Qué pasa si el corte hay que revertirlo después del paso 3.** Eso es el rollback del programa,
es el §3, y sigue sin escribirse. Lo que este § agrega es que **el punto de no retorno ahora tiene
una ubicación declarada: está entre el paso 2 y el paso 3.**

---

## 5. Lo que este documento todavía no contesta

**Cinco de los seis ítems huérfanos**, uno por uno — el sexto, `staging`, quedó escrito en el §4 en
lo que hace al orden del corte. Ésa es la FASE 7 del paraguas y es trabajo pendiente, con fecha
límite dada por el §2: **antes de que nazca la rama**.

**Una restricción que ya está fijada y lo acota**: `DEC-ARCH-007` decidió que **las dos épicas
llegan juntas**, así que la estrategia no tiene que resolver *«cómo sale una sola»* — no existe
ese caso, y la ausencia de una tercera implementación del contrato de cobertura
([`12-contrato-de-cobertura.md`](./12-contrato-de-cobertura.md) §5.3) descansa en lo mismo.

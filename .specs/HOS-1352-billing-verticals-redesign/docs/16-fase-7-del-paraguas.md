---
title: "FASE 7 del paraguas — la estrategia de despliegue que ninguna épica tiene"
linear: HOS-1352
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 7
---

# 16 · La FASE 7 del paraguas

> **Este documento es del paraguas, no de una épica**, igual que
> [`12-contrato-de-cobertura.md`](./12-contrato-de-cobertura.md). Y por la misma razón: lo que
> describe **no le pertenece a ninguna de las dos**.

**Su contenido todavía no está escrito.** Lo que está escrito acá es **qué tiene que contestar,
quién lo escribe y para cuándo** — que es lo que faltaba, y lo que hacía que seis de los diez
ítems del §65 no fueran de nadie.

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
| **staging** | — |
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

## 4. Lo que este documento todavía no contesta

Los seis ítems huérfanos, uno por uno. Ésa es la FASE 7 del paraguas y es trabajo pendiente, con
fecha límite dada por el §2: **antes de que nazca la rama**.

**Una restricción que ya está fijada y lo acota**: `DEC-ARCH-007` decidió que **las dos épicas
llegan juntas**, así que la estrategia no tiene que resolver *«cómo sale una sola»* — no existe
ese caso, y la ausencia de una tercera implementación del contrato de cobertura
([`12-contrato-de-cobertura.md`](./12-contrato-de-cobertura.md) §5.3) descansa en lo mismo.

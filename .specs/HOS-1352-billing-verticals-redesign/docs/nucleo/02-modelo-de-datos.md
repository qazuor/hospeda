---
title: Master Spec 02 — Modelo de datos
linear: HOS-1352
statusSource: linear
created: 2026-09-17
updated: 2026-09-18
status: CURRENT
fase: 2
capitulo: 2
cierra:
  - C-ARCH-01
  - S-ARCH-01
  - M-ARCH-02
  - M-DATA-01
---

# 02 · Modelo de datos

La mitad de núcleo del capítulo 02 del programa: el método que rige para las dos épicas (qué sale de la base y qué no) y el registro de eventos. Las mitades de verticales y de billing viven en sus respectivas épicas.

Las entidades, sus relaciones y **las restricciones que hacen cumplir los invariantes**. No es
un DDL: no hay tipos ni índices acá, porque eso es decisión de implementación. Lo que sí hay es
qué guarda cada cosa, cómo se relaciona y **qué la base tiene que impedir por sí sola**.

Los nombres de estado salen del capítulo 01 (núcleo) y las transiciones del 03.

---

## 1. Qué sale de la base y qué no · cierra `C-ARCH-01` y `S-ARCH-01`

### 1.1 El §9 no se puede cumplir tal como está escrito

El §9 es terminante: toda configuración relevante sale *«SI O SI DE DATABASE»*, y prohíbe
*«archivos TS»*, *«constantes duplicadas»* y *«listas hardcodeadas»*. Entre lo que enumera están
**verticales**, **entitlements** y **limits**.

Y no se puede, por una razón que no es de comodidad: **no hay forma de evaluar una capacidad sin
nombrarla**. Cualquier control de acceso pregunta por *una* capacidad concreta, y ese nombre es
un literal en el código. Lo mismo con las verticales: el §13 exige que las operaciones lleven
contexto de vertical suficiente para impedir autorización cruzada, y eso sólo es verificable si
el conjunto de verticales se conoce al compilar.

El propio §9 lo admite a medias en su última línea —*«Código solamente debe contener
comportamiento/algoritmos que no representen configuración comercial»*— pero la frase anterior
es absoluta y se va a leer como absoluta. **Un principio que se va a violar en silencio es peor
que uno acotado**, y el silencio es exactamente lo que el §9 dice querer evitar.

### 1.2 La separación

Son dos cosas distintas y el §9 las trata como una:

| | **Catálogo de claves** | **Configuración comercial** |
|---|---|---|
| **qué es** | qué capacidades, qué límites y qué verticales **existen** | qué plan otorga qué clave, con qué valor, en qué vertical, a qué precio, con qué schedule |
| **dónde vive** | **en el código** | **en la base, sin excepción** |
| **por qué ahí** | el código tiene que poder nombrarlas, y el §13 exige verificarlas al compilar | es lo que cambia sin deploy, y es lo que el §9 viene a proteger |
| **quién lo cambia** | un desarrollador, en un release | un administrador, en cualquier momento |

**El catálogo no es una lista suelta: está verificado contra la base.** Un control automático
falla si una clave usada en código no existe en la base, **y también al revés** — si una clave
de la base no existe en el catálogo. Las dos direcciones, porque cada una es un defecto
distinto: la primera es un permiso que nunca se puede otorgar, la segunda es configuración que
nadie va a leer.

**Esto reescribe el invariante §64.15.** El PDR dice *«Toda configuración comercial viene de
DB»*; la forma aplicable es **«toda configuración comercial viene de la base; el catálogo de
claves es código verificado contra la base»**. Es un apartamiento acotado y declarado, no una
excepción abierta: **lo único que vive en código es el conjunto de nombres. Ningún valor, ningún
precio, ninguna asignación.**

### 1.3 Lo que queda del lado de la base, completo

Todo lo que el §9 enumera menos los tres nombres de arriba: planes, planes de trial, billing
options, precios, duración de trial, schedules de correo, qué entitlement da cada plan, qué
límite, herencia, ajustes de pausa, métodos de pago admitidos, políticas de promo, addons, y
cualquier regla comercial configurable.

---

### 2.6 Registro

| entidad | qué guarda | restricciones |
|---|---|---|
| **`domain_event`** | qué pasó, sobre qué entidad, quién lo causó, cuándo, **qué campos cambiaron** — no una copia del contenido | append-only |
| **`outbox`** | destinatario, plantilla, estado (`pending`, `processing`, `sent`, `failed`, `retry`), id del proveedor, intentos (§44) | |

**`domain_event` guarda referencias y deltas, no copias del contenido**, y ésa es una decisión de
modelo con consecuencia directa en la retención — se explica en §4.

---

## Lo que esta mitad NO cierra

- **Los tipos, los índices y el plan de migración** son de FASE 4 y FASE 7.

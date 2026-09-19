---
title: Master Spec 21 — Migración
linear: HOS-1353
statusSource: linear
created: 2026-09-17
updated: 2026-09-18
status: CURRENT
fase: 2
capitulo: 21
cierra:
  - M-MIG-01
  - O-MIG-01
  - R-MIG-01
---

# 21 · Migración

Mitad **VERTICALES** del capítulo 21 del programa. La otra mitad vive en la otra épica.

Este capítulo es corto por una razón que está medida: **no hay casi nada que migrar.**

Los tres huecos que cierra se contestan con el mismo número, y el número no se hereda del PDR:
se midió, y se re-midió al escribir este capítulo.

---

## 2. El trial ya consumido · cierra `M-MIG-01`

### 2.1 El problema, y por qué es más chico de lo que parece

Si alguien consumió un trial bajo reglas distintas —otro alcance, otra duración, otro
disparador— ¿arrastra el consumo al modelo nuevo, o el contador arranca limpio? El §10.1 fija el
alcance nuevo en `user + vertical` y el §64.1 no da período de gracia para el pasado.

Y hay evidencia medida de que las reglas viejas **sí** eran distintas: **las duraciones de trial
no son homogéneas** —una de 30 días y dos de 90— y en dos de las tres el fin de período cae
**antes** que el fin del trial.

### 2.2 No hay criterio de corte, porque no hay cohorte

**Son cinco relaciones y se transcriben una por una a mano** (`DEC-MIG-001`: cero código de
migración). Un criterio de corte es una generalización para una cohorte, y acá no hay cohorte:
hay cinco filas que caben en una pantalla.

Escribir un criterio que nadie va a reutilizar es exactamente lo que el §56 previene —*«no
contaminar la arquitectura nueva para salvar unas pocas relaciones legacy»*—.

### 2.3 La regla de transcripción: el estado se transcribe, no se reinterpreta

| situación de la persona | qué se escribe |
|---|---|
| su trial **sigue corriendo** | una fila de `trial` en `TRIAL_ACTIVE` **con la fecha de fin que ya tenía** |
| su trial **ya terminó** | una fila de `trial` consumida (`TRIAL_EXPIRED` o `TRIAL_CONVERTED`, según lo que haya pasado) |

Dos consecuencias, y las dos importan:

1. **Nadie pierde el trial que le estaban prestando, y nadie consigue uno nuevo.** Lo que se
   respeta es la fecha prometida, no la duración: escribir la fecha de fin hace que **la
   heterogeneidad de 30 y 90 días no haya que representarla en ningún lado**. El modelo nuevo
   saca los días del plan (`DEC-TRIAL-003`) y estas cinco filas ya tienen su fecha.
2. **El §64.1 se preserva sin código.** La fila existe, así que su sola existencia niega un trial
   nuevo (cap. 02 §2.2: `UNIQUE(user_id, vertical)` sin condición de estado). No hace falta una
   marca de «viene de antes».

---

## 4. Lo que NO se migra, y no es una omisión

- **Gastronomía, experiencia y partner**: cero filas. El rediseño de esas tres verticales no
  toca un solo dato existente.
- **`commerce`**: el §55 ordena eliminarlo de fuentes activas, con la excepción histórica del
  §55.1 —auditoría, historia de migraciones, entender datos legacy— **marcada inequívocamente**.
  Eso es trabajo de FASE 5 y de código, no de datos.

---

## Lo que este capítulo NO cierra

- **Cómo se ejecuta la transcripción de las cinco** —quién, cuándo, con qué verificación— es
  FASE 7: acá está qué se escribe, no el procedimiento.
- **La clasificación del código legacy** en reusar o reescribir tiene su propio gate
  (`DEC-METH-003`) y es FASE 5. No se anticipa acá ni implícitamente.

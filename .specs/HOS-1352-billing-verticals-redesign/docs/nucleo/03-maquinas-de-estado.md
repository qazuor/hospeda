---
title: Master Spec 03 — Las máquinas de estado
linear: HOS-1352
statusSource: linear
created: 2026-09-17
updated: 2026-09-18
status: CURRENT
fase: 2
capitulo: 3
cierra:
  - M-SUB-01
  - M-CONC-02
---

# 03 · Las máquinas de estado

La mitad de núcleo del capítulo 03 del programa: las seis reglas de lectura que valen para todas las máquinas. Las máquinas mismas viven en la épica de verticales (Trial, Publicación, Postulación de Partner) o en la de billing (Suscripción, Grace, Pausa, Pago, Pago manual, Addon, la regla de no-retroceso).

El §63 pide ocho explícitamente: Trial, Subscription, Payment, Manual Payment, Addon,
Publication, Grace y Pause, *«aunque finalmente no utilicemos librería de state machines»*. Acá
son **nueve**: la postulación de Partner (§11) se agregó al escribir el capítulo 18 (épica de
verticales), con su razón escrita.

Los nombres salen del capítulo 01 (núcleo) y **no se redefinen acá**. Lo que este capítulo agrega
son las **transiciones**: qué evento mueve de dónde a dónde, bajo qué condición, y con qué efecto.

---

## 1. Cómo se leen estas máquinas

Seis reglas que valen para todas. Están acá arriba porque son la diferencia entre una
máquina de estados y una convención.

1. **La tabla de transiciones es exhaustiva.** Lo que no está, no pasa. Un intento de
   transición que la tabla no declara **no se ejecuta**: se registra como evento de dominio y,
   si tocaba plata o estado, emite `RECONCILIATION_REQUIRED` (§22.1).
2. **El estado vive en una columna con dominio restringido.** El §63 pide máquinas explícitas;
   una columna que acepta cualquier cadena no tiene máquina, tiene una costumbre. El capítulo 02
   fija la restricción.
3. **Una transición es atómica junto con sus efectos locales.** Los efectos remotos —el
   proveedor, el correo— nunca están dentro de esa transacción: el §43 lo ordena para el correo
   (*«Si falla mail: acción de dominio permanece»*) y el capítulo 05 (épica de billing) lo desarrolla para el
   proveedor.
4. **Toda transición deja un evento de dominio** (§49), con quién la causó y qué la disparó.
5. **Ninguna máquina consulta el estado del proveedor para decidir.** Consulta el suyo. Lo que
   el proveedor dice entra siempre por §10, la regla de no-retroceso.
6. **Grace y Pause no son máquinas independientes**, y el §63 las nombra igual. Son sub-estados
   de Suscripción **con reloj propio y datos propios**, y se modelan aparte por eso: un estado
   sin reloj no puede vencer solo, y los dos vencen. Se describen en §4 y §5.

---

## Lo que esta mitad NO cierra

- **Las restricciones de base** que hacen cumplir estas máquinas son del capítulo 02.
- **Qué correo sale en cada transición** es del capítulo 07 (núcleo).
- **Los relojes**, como jobs concretos con su horario y su idempotencia, son de cada subdominio.

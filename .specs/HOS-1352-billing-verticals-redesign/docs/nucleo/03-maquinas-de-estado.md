---
title: Master Spec 03 — Las máquinas de estado
linear: HOS-1352
statusSource: linear
created: 2026-09-17
updated: 2026-09-19
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
   si tocaba plata o estado, **pone la marca `requiere_conciliación`** y emite el §22.1.
   **La marca no es un estado**, y ésa es la diferencia que la hace correcta: la fila conserva el
   estado que tenía, así que quien resuelve el caso no tiene que adivinar a dónde volver, y
   escribirla no es en sí misma una decisión destructiva automática — que es lo que el §22.1
   prohíbe.
2. **El estado vive en una columna con dominio restringido** —el §63 pide máquinas explícitas; una
   columna que acepta cualquier cadena no tiene máquina, tiene una costumbre, y el capítulo 02 fija
   la restricción— **y el estado inicial de una máquina cuya fila nace en su primera transición
   vive afuera de la columna.** Que viva afuera no lo vuelve la ausencia de un estado: **es un
   estado porque tiene reglas declaradas y una salida declarada, no porque tenga fila.** Es lo que
   la máquina de suscripción ya hace con su renglón `(sin fila)`, y lo que la de trial hace con
   `PRE_TRIAL`.
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

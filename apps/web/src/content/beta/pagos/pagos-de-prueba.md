---
title: Pagos de prueba (sandbox)
description: Cómo simular suscripciones de propietario y turista sin usar plata real, con tarjetas de prueba de MercadoPago.
order: 2
role: pagos
section: Empezar
---

# Pagos de prueba

Para testear suscripciones sin cobrar plata real, MercadoPago provee **tarjetas de prueba** que simulan pagos. Sirven tanto para **suscripciones de propietario** (Owner Basic / Pro / Premium, Complex Basic / Pro / Premium) como para **suscripciones de turista** (Plus, VIP). El plan Free de turista no requiere checkout.

> ⚠️ **La pantalla de pago no vive en el sitio público.** Al apretar "Suscribirme" el sistema te redirige a **MercadoPago Checkout Pro**. El pago corre en su plataforma; nosotros recibimos el resultado por webhook.
>
> ⚠️ **NO USES TU TARJETA REAL.** Hay 2 testers especiales (avisados por privado) que sí usan tarjeta real — mirá **[Pago real](/beta/pagos/pago-real/introduccion/)**. El resto **NO**.

## Tarjetas de prueba

Tarjetas oficiales de MercadoPago en modo de prueba (sandbox). **No cobran plata real.**

| Tipo | Número | CVV | Vencimiento |
| --- | --- | --- | --- |
| Mastercard | `5031 7557 3453 0604` | 123 | 11/30 |
| Visa | `4509 9535 6623 3704` | 123 | 11/30 |
| American Express | `3711 803032 57522` | 1234 | 11/30 |
| Mastercard Débito | `5287 3383 1025 3304` | 123 | 11/30 |
| Visa Débito | `4002 7686 9439 5619` | 123 | 11/30 |

## Cómo simular APROBADO, RECHAZADO o PENDIENTE

En MercadoPago test, **el resultado del pago lo controla el nombre del titular**. Misma tarjeta, cambia el nombre.

| Nombre del titular | Resultado simulado |
| --- | --- |
| `APRO` | **Aprobado** ✓ |
| `OTHE` | **Rechazado** por error general ✗ |
| `CONT` | **Pendiente** ⏳ |
| `FUND` | Rechazado por **fondos insuficientes** ✗ |
| `SECU` | Rechazado por **CVV inválido** ✗ |
| `EXPI` | Rechazado por **vencimiento inválido** ✗ |
| `CALL` | Rechazado, **llamar a autorizar** ✗ |
| `FORM` | Rechazado por **error de formulario** ✗ |

### Ejemplo

- **Aprobado**: Visa `4509...3704` + titular `APRO` + DNI `12345678` + CVV `123` + venc. `11/30`
- **Rechazado**: misma tarjeta + titular `OTHE`
- **Pendiente**: misma tarjeta + titular `CONT`

## Pasos para suscribirte (propietario o turista)

1. Menú principal → **"Precios"** (`/suscriptores/precios/`).
2. Elegí un plan y apretá el CTA para suscribirte.
3. **Te redirige a la pantalla de pago de MercadoPago**.
4. Completá los datos de la tarjeta de prueba (número + nombre del titular según el resultado que quieras simular).
5. Apretá pagar. MP te devuelve al sitio con el resultado.
6. Andá a **"Mi cuenta" → "Suscripción"** (`/mi-cuenta/suscripcion/`) y verificá si quedó activa.

## Probá también

- **Rechazado** (`OTHE`): ¿pantalla de error, mensaje claro, deja reintentar?
- **Pendiente** (`CONT`): ¿pantalla de "esperando confirmación"? ¿Qué pasa después?
- **Fondos insuficientes** (`FUND`) y **CVV inválido** (`SECU`): ¿mensajes claros?

## Códigos promocionales

> ⚠️ No hay campo de código promo en la pantalla de pago. Los códigos promo existen como herramienta administrativa pero la pantalla de pago actual es MercadoPago Checkout Pro. Si te pasamos un código y encontrás un campo donde aplicarlo, anotá dónde lo viste y reportalo. Si no aparece, no es error (bug) — es el estado actual.

## Ver tu suscripción

**"Mi cuenta" → "Suscripción"** (`/mi-cuenta/suscripcion/`). ¿Ves plan actual, próxima renovación, historial de pagos?

> ⚠️ **Métodos de pago guardados:** no podés guardar tarjetas para renovación automática. Cada renovación pide los datos de nuevo. Es esperado.

## Qué reportar

> 📋 **Reportá:**
>
> - Te quedaste sin saber qué hacer en algún paso
> - La redirección al pago de MP no funciona
> - Después de pagar no volvés bien al sitio
> - El monto en MP no coincide con el del plan
> - La suscripción no se activó después de pagar
> - El mensaje de error / pendiente no se entiende
>
> ⚠️ **Emails de pago:** en beta puede no llegarte email al pagar (config del servicio de email). No lo reportes salvo que te avisemos.

## Próximo paso

Si te avisamos por privado, **[Pago real — introducción](/beta/pagos/pago-real/introduccion/)**. Si no, ya está — pasá a **[Cómo reportar errores](/beta/reportar-bugs/como-reportar/)**.

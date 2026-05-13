---
title: Suscripción y pagos con tarjetas de prueba
description: Cómo suscribirte a un plan, las tarjetas de prueba de MercadoPago y los códigos para simular resultados.
order: 4
role: host
section: Gestión del host
---

# Suscripción y pagos

Para que tu alojamiento esté visible al público o tener más beneficios, vas a tener que suscribirte a un plan.

> ⚠️ **El checkout no vive en el sitio público.** Cuando elegís un plan y apretás "Suscribirme", el sistema te redirige a **MercadoPago Checkout Pro** (la URL del checkout es de MercadoPago, no nuestra). El pago se hace en su plataforma; nosotros recibimos el resultado por webhook.
>
> ⚠️ **NO USES TU TARJETA REAL.** Hay 2 testers especiales (avisados por privado) que sí usan tarjeta real (mirá [Pago real](/beta/pago-real/introduccion/)). El resto **NO**.

## Planes disponibles

Los planes de propietario que vas a ver listados son:

- **Basic** (Básico)
- **Professional**
- **Premium**

Pueden aparecer también planes adicionales como **Complex Basic / Complex Professional / Complex Premium** (para hosts con múltiples propiedades) o variantes como **Free / Plus / VIP**. Si ves algún plan con nombre que no entendés, anotá el nombre exacto y reportalo.

## Tarjetas de prueba

Estas son tarjetas oficiales de MercadoPago sandbox. **NO cobran plata real.**

| Tipo | Número | CVV | Vencimiento |
| --- | --- | --- | --- |
| Mastercard | `5031 7557 3453 0604` | 123 | 11/30 |
| Visa | `4509 9535 6623 3704` | 123 | 11/30 |
| American Express | `3711 803032 57522` | 1234 | 11/30 |
| Mastercard Débito | `5287 3383 1025 3304` | 123 | 11/30 |
| Visa Débito | `4002 7686 9439 5619` | 123 | 11/30 |

## Cómo simular APROBADO, RECHAZADO o PENDIENTE

En MercadoPago test, **el resultado del pago lo controla el nombre del titular** que pongas. Usás la misma tarjeta, cambiás el nombre del titular según qué quieras simular.

Poné en "Nombre del titular" alguno de estos códigos:

| Nombre del titular | Resultado simulado |
| --- | --- |
| `APRO` | Pago **aprobado** ✓ |
| `OTHE` | Pago **rechazado** por error general ✗ |
| `CONT` | Pago **pendiente** ⏳ |
| `FUND` | Pago rechazado por **fondos insuficientes** ✗ |
| `SECU` | Pago rechazado por **CVV inválido** ✗ |
| `EXPI` | Pago rechazado por **vencimiento inválido** ✗ |
| `CALL` | Pago rechazado, **llamar a autorizar** ✗ |
| `FORM` | Pago rechazado por **error de formulario** ✗ |

### Ejemplo

- **Aprobado**: Visa `4509...3704` + titular `APRO` + DNI `12345678` + CVV `123` + venc. `11/30`
- **Rechazado**: misma tarjeta + titular `OTHE`
- **Pendiente**: misma tarjeta + titular `CONT`

## Pasos para suscribirte

1. En el menú principal del sitio público, andá a **"Precios"** (link en la nav).
2. Llegás a la página de planes en `/suscriptores/precios/`.
3. Mirá las diferencias entre planes. Elegí uno y apretá el CTA para suscribirte.
4. **Te redirige al checkout de MercadoPago** (URL de MP, ya no nuestra).
5. Completá los datos de la tarjeta de prueba (número, nombre del titular según el resultado que quieras simular, vencimiento, CVV).
6. Apretá el botón de pagar en el checkout de MP.
7. MP te devuelve al sitio con el resultado.
8. Volvé a **"Mi cuenta" → "Suscripción"** (`/mi-cuenta/suscripcion/`) y verificá si la suscripción quedó activa.

## Probá también

- **Pago RECHAZADO** (titular `OTHE`) — ¿llegás a la pantalla de error? ¿el mensaje se entiende? ¿te deja reintentar?
- **Pago PENDIENTE** (titular `CONT`) — ¿llegás a la pantalla de "esperando confirmación"? ¿Qué pasa después?
- **Fondos insuficientes** (titular `FUND`) y **CVV inválido** (titular `SECU`) — verificá si los mensajes de error son claros.

## Códigos promocionales

> ⚠️ **No hay campo de código promocional en el checkout del sitio público.** Los promo codes existen como herramienta administrativa (los crea un admin desde el panel), pero el flujo de checkout actual es enteramente vía MercadoPago Checkout Pro — el código promo, si existe, lo aplicaría el admin antes/después, no el tester en el checkout.
>
> Si te pasamos un código promocional para usar y **encontrás un campo dónde aplicarlo en tu flujo de checkout**, anotá dónde lo viste y reportalo. Si no aparece nunca, no es un bug — es el estado actual.

## Ver tu suscripción

Andá a **"Mi cuenta" → "Suscripción"** (`/mi-cuenta/suscripcion/`).

- ¿Ves tu plan actual?
- ¿La fecha de próxima renovación?
- ¿Historial de pagos / facturas?

> ⚠️ **Métodos de pago guardados:** en este momento **no podés guardar tarjetas para renovación automática**. Cada renovación va a pedirte los datos de nuevo. Es esperado.

## Qué reportar

> 📋 **Reportá:**
>
> - Si en algún paso te quedaste sin saber qué hacer
> - Si el redirect al checkout de MP no funciona
> - Si después de pagar en MP no volvés correctamente al sitio
> - Si el monto en el checkout de MP no coincide con el del plan
> - Si después de pagar la suscripción no se activó en "Mi cuenta → Suscripción"
> - Si el mensaje de error / pendiente no se entiende
>
> ⚠️ **Sobre los emails de pago:** en este entorno de beta **podría no llegarte email** cuando pagás (depende de la configuración del servicio de email para staging). **No reportes "no me llegó el email del pago"** salvo que te avisemos lo contrario.

## Próximo paso

Si recibiste mensajes de turistas, andá a **[Mensajes recibidos como host](/beta/host/mensajes/)**.

---
title: Cosas que parecen error (bug) pero no lo son
description: Comportamientos esperados que no debés reportar — funcionalidades en desarrollo y limitaciones conocidas.
order: 5
role: reportar-bugs
section: Reportar bugs
---

# Cosas que parecen error (bug) pero no lo son

Esto es importante. Te lo decimos para que **no pierdas tiempo reportando estas cosas** (sabemos que están así).

## Editor de texto plano vs editor con formato

Cuando creás o editás la descripción de un alojamiento (como propietario o anfitrión (host)), el campo es **texto plano simple**, sin opciones de negrita / itálica / listas. **Eso es esperado.** El editor con formato está en desarrollo.

## Emails transaccionales en el beta

El código del sistema tiene **muchas plantillas de email** conectadas (registro, reset de contraseña, confirmación de pago, error de pago, mensaje nuevo en conversación, expiración de add-ons, recordatorio de fin de prueba, cancelación de suscripción, formulario de contacto, reporte de feedback, etc.).

**Pero en este entorno de beta** la configuración del servicio de email **puede estar reducida**. Si no recibís un email que esperabas:

- **No asumas que falta la funcionalidad** — el código lo tiene.
- **Reportalo igual** indicando qué acción hiciste y qué email esperabas.
- Nosotros verificamos en logs si se intentó enviar y por qué no llegó.

Los **emails que sí o sí deberían llegarte** (porque son críticos para usar el sitio) son:

1. **Verificación de email al registrarte** (sin esto no podés activar tu cuenta)
2. **Reseteo de contraseña** (sin esto no podés recuperar acceso)
3. **Verificación de mensajería para invitados** (sin esto no podés seguir conversaciones como invitado)

Si **alguno de estos 3** no te llega, es un error grave — reportalo con urgencia.

Para todo el resto (confirmación de pago, recordatorios, etc.), reportá si no llegan pero esperá nuestra confirmación antes de asumir que es error — puede ser config de entorno.

## Funcionalidades que todavía no están

Si una funcionalidad no existe pero sabemos que la queremos hacer, no es un error. Mirá la [lista de próximas funcionalidades](/beta/empezar/proximas-funcionalidades/) para ver qué viene.

¿Se te ocurre alguna funcionalidad que podría ser útil, interesante o atractiva tener? Propónela usando el **botón flotante azul** abajo a la derecha — el mismo que usás para reportar errores también sirve para sugerir ideas.

## Período de prueba de 14 días

Cuando te creás como propietario, te van a dar **14 días de prueba gratis** automáticamente. Después tenés que pagar. Esos 14 días son **esperados**, no es un error.

## Si ves alguna de estas medio funcionando

Reportala igual. Si está medio implementada y rompe algo, queremos saberlo. Pero si **no la encontrás** en el menú, es porque no está.

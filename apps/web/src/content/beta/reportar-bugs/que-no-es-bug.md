---
title: Cosas que parecen bug pero no lo son
description: Comportamientos esperados que no debés reportar — features en desarrollo y limitaciones conocidas.
order: 5
role: reportar-bugs
section: Reportar bugs
---

# Cosas que parecen bug pero no lo son

Esto es importante. Te lo decimos para que **no pierdas tiempo reportando estas cosas** (sabemos que están así).

## Editor de texto plano vs editor con formato

Cuando creás o editás la descripción de un alojamiento (como host), el campo es **texto plano simple**, sin opciones de negrita / itálica / listas. **Eso es esperado.** El editor con formato está en desarrollo.

## Emails transaccionales en el beta

El código del sistema tiene **muchas plantillas de email** conectadas (registro, reset de contraseña, confirmación de pago, error de pago, mensaje nuevo en conversación, expiración de add-ons, recordatorio de fin de prueba, cancelación de suscripción, formulario de contacto, reporte de feedback, etc.).

**Pero en este entorno de beta** la configuración del servicio de email **puede estar reducida**. Si no recibís un email que esperabas:

- **No asumas que falta el feature** — el código lo tiene.
- **Reportalo igual** indicando qué acción hiciste y qué email esperabas.
- Nosotros verificamos en logs si se intentó enviar y por qué no llegó.

Los **emails que sí o sí deberían llegarte** (porque son críticos para usar el sitio) son:

1. **Verificación de email al registrarte** (sin esto no podés activar tu cuenta)
2. **Reseteo de contraseña** (sin esto no podés recuperar acceso)
3. **Verificación de mensajería para invitados** (sin esto no podés seguir conversaciones como invitado)

Si **alguno de estos 3** no te llega, es un bug grave — reportalo con urgencia.

Para todo el resto (confirmación de pago, recordatorios, etc.), reportá si no llegan pero esperá nuestra confirmación antes de asumir que es bug — puede ser config de entorno.

## Features que todavía no están

Estas funcionalidades **están planeadas** pero llegan después del beta. **No las reportes** si no las encontrás:

### Funcionalidades de operación

- 📅 Calendario de disponibilidad
- 🔄 Sincronización con calendarios externos (Google Calendar, Airbnb, etc.)
- 🎥 Embed de video en la descripción del alojamiento
- 🛒 Add-ons comprables (featured listing, etc.) desde el dashboard del host
- 📊 Estadísticas del listing (vistas, clicks, favoritos)
- 🎫 Tickets para eventos (comprar entrada para un evento)
- 💬 WhatsApp Business integrado (chat del host adentro de la plataforma)
- 🔔 Notificaciones push del navegador
- 🔁 Renovación automática de suscripción (con tarjeta guardada)
- ⭐ Respuesta del host a reseñas públicas
- 💰 Promociones creadas por el host (descuentos temporales)

### Funcionalidades con IA (próximamente)

Esto se va a sumar **en breve, después de la primera ronda del beta**. Para que sepas hacia dónde va Hospeda:

- 🤖 **Búsqueda de alojamientos con IA en lenguaje natural.** Vas a poder escribir: *"busco una cabaña para 4 personas con pileta, cerca del río, en Concepción del Uruguay, para fin de semana largo de octubre"*. La IA entiende y trae los resultados.
- 📅 **Reserva directa desde la app.** Hoy contactás al propietario y arreglás por chat. En breve vas a poder **reservar y pagar directo** desde Hospeda.
- ❓ **Asistente IA en la página del alojamiento.** Vas a poder preguntar: *"¿el WiFi llega bien al fondo?", "¿se puede caminar a la playa?", "¿la cocina tiene horno?"* La IA responde leyendo la descripción y los datos.

Estas 3 funcionalidades **NO están en este beta v1**. Si las ves, avisanos porque algo está medio raro. Cuando las activemos vamos a hacer una **fase v2 del beta** específica para probarlas.

## Período de prueba de 14 días

Cuando te creás como host, te van a dar **14 días de prueba gratis** automáticamente. Después tenés que pagar. Esos 14 días son **esperados**, no es un bug.

## Si ves alguna de estas medio funcionando

Reportala igual. Si está medio implementada y rompe algo, queremos saberlo. Pero si **no la encontrás** en el menú, es porque no está.

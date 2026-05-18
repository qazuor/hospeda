---
title: Cosas que parecen error (bug) pero no lo son
description: Comportamientos esperados que no debés reportar.
order: 5
role: reportar-bugs
section: Reportar bugs
---

# Cosas que parecen error pero no lo son

Para que **no pierdas tiempo reportando** estas cosas (las conocemos).

## Editor de texto plano vs con formato

La descripción de un alojamiento es **texto plano**, sin negrita / itálica / listas. Esperado. El editor con formato está en desarrollo.

## Emails transaccionales en el beta

El sistema tiene muchas plantillas (registro, reset, confirmación de pago, mensajes, expiración de add-ons, etc.). **Pero en beta** la config del servicio de email **puede estar reducida**.

Si no recibís un email esperado:

- No asumas que falta la funcionalidad — el código la tiene.
- **Reportalo igual** indicando qué acción hiciste y qué esperabas.
- Verificamos en logs si se intentó enviar.

**Los 3 que sí o sí deberían llegar** (críticos para usar el sitio):

1. **Verificación al registrarte**
2. **Reseteo de contraseña**
3. **Verificación de mensajería para invitados**

Si **alguno de estos 3** no llega, es error grave — reportá con urgencia.

Para el resto, reportá si no llegan pero esperá nuestra confirmación antes de asumir que es error — puede ser config de entorno.

## Funcionalidades que todavía no están

Si algo no existe pero sabemos que lo queremos hacer, no es error. Mirá la [lista de próximas funcionalidades](/beta/empezar/proximas-funcionalidades/).

¿Se te ocurre alguna funcionalidad útil? Propónela con el botón flotante: también sirve para sugerir ideas.

## Período de prueba de 14 días

Como propietario te dan **14 días gratis** automáticos. Después tenés que pagar. Esperado.

## Si ves algo medio funcionando

Reportá igual. Si está medio implementado y rompe algo, queremos saberlo. Pero si **no la encontrás** en el menú, es porque no está.

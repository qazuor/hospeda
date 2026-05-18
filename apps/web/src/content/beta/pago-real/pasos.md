---
title: Pasos del pago real
description: Paso a paso para hacer el pago real, verificar la activación y solicitar el reembolso.
order: 2
role: pago-real
section: Pago real
---

# Pasos del pago real

## Paso 1 — Crear tu cuenta (igual que el resto)

1. Andá a **<https://staging.hospeda.com.ar>**.
2. Registrate como propietario o anfitrión (host) — mirá **[Bienvenida inicial (onboarding) como propietario](/beta/host/onboarding/)**.
3. Verificá tu email.

## Paso 2 — Crear un alojamiento de prueba

Seguí **[Crear tu primer alojamiento](/beta/host/crear-alojamiento/)**. Creá un alojamiento como cualquier otro tester. No hace falta que sea uno real, podés inventar datos.

## Paso 3 — Llegar al checkout

1. Andá a **"Suscriptores → Planes"** o desde tu panel de control (dashboard) "Suscribirme a un plan".
2. Elegí el plan que te asignamos (Basic / Pro / Premium).
3. Apretá **"Suscribirme"**.

## Paso 4 — Pagar con tu tarjeta real

1. Llegás al checkout.
2. **Verificá el monto** antes de apretar nada. Tomale captura.
3. Completá los datos de **TU TARJETA REAL** (la que usás normalmente):
   - Número de tarjeta
   - Nombre del titular
   - Vencimiento
   - CVV (los 3 números atrás)
4. Si te pide DNI / CUIT, completá el real.
5. Apretá **"Pagar"**.

> 📋 **Anotá la hora exacta** en que apretaste "Pagar". Lo necesitamos para correlacionar con los logs.

## Paso 5 — Pantalla de resultado

Después de apretar "Pagar" pueden pasar 3 cosas:

### a) Pago aprobado ✓

Te lleva a una pantalla que dice **"Pago confirmado"** / **"Suscripción activa"**.

> 📋 **Reportá:**
>
> - Captura de esa pantalla
> - Hora en que apareció la pantalla de confirmación (anotala con precisión — si tarda más de 30 segundos en aparecer, anotalo también)
> - Si el monto cobrado coincide con lo que viste en el checkout

### b) Pago pendiente ⏳

Te lleva a una pantalla intermedia indicando que el pago está procesándose. **Anotá el texto exacto que aparece** — lo necesitamos para verificar.

> 📋 **Reportá:**
>
> - Captura
> - Esperá. Volvé a entrar a tu cuenta unos minutos después. ¿Se confirmó?
> - Si pasa más de 1 hora pendiente, avisanos

### c) Pago rechazado ✗

Te lleva a una pantalla de error con algún motivo.

> 📋 **Reportá:**
>
> - Captura
> - El mensaje exacto que apareció
> - Si te dejó reintentar
> - Avisanos por WhatsApp porque algo raro pasó

## Paso 6 — Verificar la activación

1. Volvé a tu **panel de control** de propietario.
2. Andá a **"Mi cuenta → Mi suscripción"**.
3. ¿Aparece tu plan como **activa**?
4. ¿Te muestra la fecha de próxima renovación?
5. Mirá tu casilla de email. ¿Llegó algún email de confirmación de Hospeda? ¿De MercadoPago?

> 📋 **Reportá:**
>
> - Cualquier diferencia entre lo que pagaste y lo que aparece activado
> - Cualquier email que NO llegó (si esperabas confirmación y no llegó)
> - Si tu suscripción aparece pero los datos están raros

## Paso 7 — Probar las funcionalidades que el plan habilita

Ahora que tenés un plan pagado real, probá todo lo que ese plan te habilita:

- Si es Basic, las funcionalidades de Basic.
- Si es Pro, las funcionalidades Pro (más fotos, más amenidades, etc.).
- Si es Premium, las de Premium (todas las funcionalidades).

Comparalo con lo que prometía el plan en la página de planes. ¿Coincide?

> 📋 **Reportá:** cualquier funcionalidad que el plan promete y no funciona.

## Paso 8 — Cuando termines, avisanos

Cuando terminaste de probar (después de unos días, no apurés), escribinos por WhatsApp privado:

> "Listo, terminé. Procedan con el reembolso."

Decinos:

- Qué **método de reembolso** preferís (MercadoPago a la misma tarjeta, o transferencia)
- Si elegís transferencia: tu **CBU + nombre + DNI**

Procesamos el reembolso en **máximo 7 días**.

## Lo que sí o sí necesitamos que reportes

Independiente del resultado:

1. **Captura del checkout** antes de pagar
2. **Captura del resultado** del pago (aprobado / pendiente / rechazado)
3. **Hora exacta** del intento de pago
4. **Email del recibo de MercadoPago** (te lo manda MP a tu casilla, reenvialo a <qazuor@gmail.com> o subilo como adjunto al botón flotante)
5. **Cualquier diferencia** entre lo prometido en el plan y lo que efectivamente pasó

## Próximo paso

Mirá **[Qué puede salir mal](/beta/pago-real/que-puede-salir-mal/)** para saber qué hacer si algo se complica.

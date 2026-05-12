# Anexo: prueba de pago con plata real

> Este documento es **solo para los 2 testers** a los que les avisamos por privado que prueban el flujo de pago **con dinero real**. Si no te avisamos personalmente, **este anexo NO es para vos** — usá la guía principal con tarjetas de prueba.

---

## ¿Por qué te elegimos para esto?

Porque confiamos en vos. Los pagos con tarjetas de prueba (sandbox) cubren el 95% del flujo, pero hay un 5% que **solo se prueba con plata real** que pasa por MercadoPago en producción:

- La conciliación automática del pago real
- Los webhooks reales de MercadoPago avisándonos del pago
- La emisión real de factura
- La activación automática de la suscripción
- El email transaccional con datos reales

Por eso necesitamos a 2 personas que paguen **realmente** con su tarjeta y nos cuenten todo lo que pasó.

---

## Lo más importante: te devolvemos el dinero

**Garantía 100%.** Lo que pagues, te lo devolvemos. Tenés 2 opciones:

1. **Reembolso por MercadoPago** (devolvemos el cargo a la misma tarjeta).
2. **Transferencia bancaria** (te depositamos el monto a tu CBU).

Vos elegís cuál te queda más cómoda. El reembolso lo procesamos **dentro de los 7 días** desde que terminaste la prueba.

> Si por algún motivo el pago se traba, **avisanos inmediatamente** por WhatsApp privado a Leandro / 3442 453797 — <qazuor@gmail.com>. No esperes.

---

## Cuánto vas a pagar

Te asignamos uno de los 3 planes (Basic / Pro / Premium). **Te avisamos por privado cuál te toca y cuánto sale aproximadamente** antes de que vayas al checkout.

El monto exacto lo vas a ver en el **checkout**, antes de meter los datos de la tarjeta. **Verificalo y sacale captura antes de apretar "Pagar"**:

- Si el monto del checkout es similar al que te dijimos, dale para adelante.
- Si el monto es **muy distinto** al que te dijimos, **parate, no pagues** y avisanos por WhatsApp. Revisamos antes de avanzar.

**Vas a pagar UNA sola vez.** Después te reembolsamos todo. No vas a pagar 2 meses.

---

## Pasos exactos a seguir

### Paso 1 — Crear tu cuenta (igual que el resto)

1. Andá a **<https://staging.hospeda.com.ar>**.
2. Registrate como host (mirá la **sección B.1** en la [Guía del beta tester](https://www.notion.so/cheroga/GUIA-3599fb45673980a4877dd8603f950051)).
3. Verificá tu email.

### Paso 2 — Crear un alojamiento de prueba

Mirá la sección B.2 de la guía principal. Creá un alojamiento como cualquier otro tester. No hace falta que sea uno real, podés inventar datos.

### Paso 3 — Llegar al checkout

1. Andá a **"Suscriptores → Planes"** o desde tu dashboard "Suscribirme a un plan".
2. Elegí el plan que te asignamos (Basic / Pro / Premium).
3. Apretá **"Suscribirme"**.

### Paso 4 — Pagar con tu tarjeta real

1. Llegás al checkout.
2. **Verificá el monto** antes de apretar nada. Tomale captura.
3. Completá los datos de **TU TARJETA REAL** (la que usás normalmente):
   - Número de tarjeta
   - Nombre del titular
   - Vencimiento
   - CVV (los 3 números atrás)
4. Si te pide DNI / cuit, completá el real.
5. Apretá **"Pagar"**.

> 📋 **Anotá la hora exacta** en que apretaste "Pagar". Lo necesitamos para correlacionar con los logs.

### Paso 5 — Pantalla de resultado

Después de apretar "Pagar" pueden pasar 3 cosas:

#### a) Pago aprobado ✓

Te lleva a una pantalla que dice algo así como **"Pago confirmado"** / **"Suscripción activa"**.

> 📋 **Reportá:**
>
> - Sacale captura a esa pantalla
> - Anotá la hora en que apareció (debería ser pocos segundos después)
> - Mirá si el monto que cobraron coincide con lo que viste en el checkout

#### b) Pago pendiente ⏳

Te lleva a una pantalla que dice **"Tu pago está siendo procesado"** o similar.

> 📋 **Reportá:**
>
> - Captura
> - Esperá. Volvé a entrar a tu cuenta unos minutos después. ¿Se confirmó?
> - Si pasa más de 1 hora pendiente, avisanos

#### c) Pago rechazado ✗

Te lleva a una pantalla de error con algún motivo.

> 📋 **Reportá:**
>
> - Captura
> - El mensaje exacto que apareció
> - Si te dejó reintentar
> - Avisanos por WhatsApp porque algo raro pasó

### Paso 6 — Verificar la activación

1. Volvé a tu **dashboard** de host.
2. Andá a **"Mi cuenta → Mi suscripción"**.
3. ¿Aparece tu plan como **activa**?
4. ¿Te muestra la fecha de próxima renovación?
5. Mirá tu casilla de email. ¿Llegó algún email de confirmación de Hospeda? ¿De MercadoPago?

> 📋 **Reportá:**
>
> - Cualquier diferencia entre lo que pagaste y lo que aparece activado
> - Cualquier email que NO llegó (si esperabas confirmación y no llegó)
> - Si tu suscripción aparece pero los datos están raros

### Paso 7 — Probar las features que el plan habilita

Ahora que tenés un plan pagado real, probá todo lo que ese plan te habilita:

- Si es Basic, probá las features de Basic.
- Si es Pro, probá las features Pro (más fotos, más amenidades, etc.).
- Si es Premium, probá las de Premium (todas las features).

Comparalo con lo que prometía el plan en la página de planes. ¿Coincide?

> 📋 **Reportá:** cualquier feature que el plan promete y no funciona.

### Paso 8 — Cuando termines, avisanos

Cuando terminaste de probar (después de unos días, no apurés), escribinos por WhatsApp privado:

> "Listo, terminé. Procedan con el reembolso."

Decinos:

- Qué método de reembolso preferís (MercadoPago a la misma tarjeta, o transferencia)
- Si elegís transferencia: tu CBU + nombre + DNI

Procesamos el reembolso en máximo 7 días.

---

## Lo que sí o sí necesitamos que reportes

Independiente del resultado:

1. **Captura del checkout** antes de pagar (para verificar el monto que viste)
2. **Captura del resultado** del pago (aprobado / pendiente / rechazado)
3. **Hora exacta** del intento de pago
4. **Email del recibo de MercadoPago** (te lo manda MP a tu casilla, reenvialo a <qazuor@gmail.com> o subilo como adjunto al FAB)
5. **Cualquier diferencia** entre lo prometido en el plan y lo que efectivamente pasó

---

## Cosas que pueden salir mal (y qué hacer)

### "Mi tarjeta fue rechazada"

- Probá con otra tarjeta tuya si tenés (para descartar problema con la tarjeta puntual).
- Si rechaza con todas, reportalo. Puede ser un bug de la integración.
- Avisanos por WhatsApp.

### "Pagué pero la suscripción no se activó"

- Esto es **importante** que reportes con detalle. Dato del pago + dato de tu cuenta.
- Avisanos por WhatsApp directo, no solo por el FAB.
- No vuelvas a pagar.

### "Pagué dos veces sin querer"

- Avisanos **inmediatamente** por WhatsApp.
- Te reembolsamos las dos.

### "El monto que cobraron es distinto al que dije"

- Captura del checkout (lo que decía pagar).
- Captura del comprobante de MP (lo que efectivamente cobró).
- Avisanos.

### "Tengo miedo / dudas antes de pagar"

- Escribinos antes de apretar nada.
- Te explicamos por privado, sin apuro.

---

## Privacidad

- Los datos de tu tarjeta los maneja **MercadoPago**, no Hospeda. Nosotros nunca vemos tu número de tarjeta completo.
- El comprobante que recibís te llega de **MercadoPago** directamente.
- Tu información personal (nombre, DNI, email) sí queda registrada en Hospeda como cualquier suscripción.
- Si querés que después del beta **eliminemos completamente tu cuenta de prueba**, decinos y la borramos.

---

## Cierre

Sos uno de los 2 testers que están probando el corazón financiero del sistema. Tu reporte vale **muchísimo** porque sin esto no podemos lanzar con confianza.

Cualquier cosa, **directo a WhatsApp privado** con Leandro: 3442 453797 — <qazuor@gmail.com>.

Gracias enormes por bancar esto.

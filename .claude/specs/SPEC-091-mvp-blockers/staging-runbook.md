# SPEC-091 Checkout Flow — Staging Smoke Test Runbook

Este runbook documenta el procedimiento de smoke test para el flujo de checkout de suscripciones en staging. Segui los pasos en orden. Si algun paso falla, registralo y avisa antes de continuar con el siguiente escenario.

---

## 1. Preconditions checklist

Antes de arrancar con los escenarios, verifica que todo esto este listo en staging:

- [ ] MercadoPago sandbox app creada en [mercadopago.com.ar/developers](https://mercadopago.com.ar/developers)
- [ ] Credenciales sandbox configuradas en el env de staging:
  - `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN`
  - `HOSPEDA_MERCADO_PAGO_PUBLIC_KEY`
  - `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET`
- [ ] Webhook URL registrada en el dashboard de MP:

  ```text
  https://staging.hospeda.com.ar/api/v1/webhooks/mercadopago
  ```

- [ ] Planes de prueba seedeados en la base de datos:
  - `owner-basico`
  - `owner-pro`
  - `owner-premium`
  - `tourist-free`
  - `tourist-plus`
  - `tourist-vip`
- [ ] Cuenta de usuario de prueba con email verificado disponible

Si falta algo de la lista, pará acá y resolve antes de seguir. No tiene sentido correr los escenarios con el entorno a medio configurar.

---

## 2. Test Scenario 1 — Approved payment

El happy path. Pagamos con tarjeta aprobada y verificamos que la suscripcion quede activa end-to-end.

### Pasos

1. Login en:

   ```text
   https://staging.hospeda.com.ar/auth/signin
   ```

2. Navega a `/es/suscriptores/planes`
3. Verifica que cada card de plan renderice el boton "Contratar"
4. Click en "Contratar" en el plan `owner-pro`
5. Verifica el redirect a `mercadopago.com.ar` (pagina de checkout MP)
6. Paga con la tarjeta de prueba aprobada:

   ```text
   Numero: 5031 7557 3453 0604
   Vencimiento: 11/30
   CVV: 123
   Titular: APRO
   ```

7. Verifica el redirect a:

   ```text
   /es/suscriptores/checkout/success?collection_status=approved&...
   ```

8. Verifica que la pagina muestre:
   - Titulo: "¡Tu suscripción está activa!"
   - CTA: "Ir a mi cuenta"

### Verificación

- [ ] Existe una fila en `billing_webhook_events` con `status='processed'` para este evento
- [ ] Existe una fila en `billing_subscriptions`, activa, para el usuario de prueba
- [ ] `/mi-cuenta` muestra la nueva suscripcion

Query util para inspeccionar el webhook:

```sql
SELECT id, provider_event_id, status, created_at
FROM billing_webhook_events
ORDER BY created_at DESC
LIMIT 5;
```

---

## 3. Test Scenario 2 — Pending payment

Mismo flujo que el Scenario 1, pero usamos una tarjeta cuyo pago queda pendiente (simula el caso de pago en efectivo o transferencia que todavia no se acredito).

### Pasos

1. Repeti los pasos 1 al 5 del Scenario 1
2. En el checkout de MP, paga con la misma tarjeta pero cambiando el titular:

   ```text
   Numero: 5031 7557 3453 0604
   Vencimiento: 11/30
   CVV: 123
   Titular: CONT
   ```

3. Verifica el redirect a:

   ```text
   /es/suscriptores/checkout/pending
   ```

4. Verifica que la pagina muestre el mensaje "Tu pago está siendo procesado" con la explicacion de que puede tardar hasta 24hs
5. Verifica que haya un CTA "Verificar estado" que lleve a `/mi-cuenta`
6. Verifica que NO haya boton de reintento

### Verificación

- [ ] Pagina `/suscriptores/checkout/pending` renderiza sin crashes
- [ ] No aparece boton de reintento
- [ ] CTA "Verificar estado" apunta a `/mi-cuenta`
- [ ] La suscripcion queda en estado `pending` en `billing_subscriptions` (no `active`)

---

## 4. Test Scenario 3 — Rejected payment

Probamos todas las variantes de rechazo para confirmar que el mapeo de reason codes a mensajes i18n funciona.

### Pasos

Para cada uno de los titulares siguientes, repeti los pasos 1 al 5 del Scenario 1 y paga con:

```text
Numero: 5031 7557 3453 0604
Vencimiento: 11/30
CVV: 123
```

Variando unicamente el titular:

| Titular | Razon esperada | Key i18n esperada |
|---------|----------------|-------------------|
| `OTHE`  | Rechazo generico | (mensaje fallback generico) |
| `FUND`  | Fondos insuficientes | `reasonInsufficientFunds` |
| `CALL`  | Llamar al banco | `reasonCardDeclined` |
| `SECU`  | Codigo de seguridad invalido | `reasonInvalidData` |

Para cada variante:

1. Verifica el redirect a:

   ```text
   /es/suscriptores/checkout/failure
   ```

2. Verifica que el texto de la razon coincida con el esperado para esa variante
3. Verifica el CTA primario "Intentar de nuevo" con href a `/suscriptores/planes`
4. Verifica el CTA secundario "Contactar soporte" con href a `/contacto`

### Verificación

- [ ] Las 4 variantes muestran la razon correcta segun la key i18n esperada
- [ ] Retry CTA linka a `/suscriptores/planes`
- [ ] Support CTA linka a `/contacto`
- [ ] No hay datos sensibles del pago (numero de tarjeta, CVV, payment id) en el HTML renderizado

---

## 5. Test Scenario 4 — Webhook idempotency

Verificamos que replay de un mismo webhook no genere subscripciones o eventos duplicados.

### Pasos

1. Capturar un payload de webhook valido desde los logs de staging o desde el dashboard de MP (alguno generado en Scenario 1)
2. Extraer tambien el header `x-signature` correspondiente (se valida con `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET`)
3. Replay del payload 3 veces via curl:

   ```bash
   for i in 1 2 3; do
     curl -X POST https://staging.hospeda.com.ar/api/v1/webhooks/mercadopago \
       -H "Content-Type: application/json" \
       -H "x-signature: <signature>" \
       -H "x-request-id: <request-id>" \
       -d @webhook-payload.json \
       -w "\nHTTP %{http_code}\n"
   done
   ```

4. Verifica en la base:

   ```sql
   SELECT provider_event_id, status, COUNT(*) as count
   FROM billing_webhook_events
   WHERE provider_event_id = '<event-id-del-payload>'
   GROUP BY provider_event_id, status;
   ```

### Verificación

- [ ] Solo existe UNA fila en `billing_webhook_events` con ese `providerEventId` (count = 1)
- [ ] Las 3 respuestas devolvieron HTTP 200
- [ ] No se crearon suscripciones duplicadas en `billing_subscriptions` para el mismo usuario/plan

---

## 6. Test Scenario 5 — Unauthenticated checkout attempt

Verificamos que el checkout no se puede disparar sin sesion y que el flujo de login preserva el redirect.

### Pasos

1. Abri `/es/suscriptores/planes` en una ventana de incognito (sin sesion)
2. Click en "Contratar" en cualquier plan
3. Verifica el redirect a:

   ```text
   /auth/signin?redirect=/suscriptores/planes
   ```

4. Completa el sign in con el usuario de prueba
5. Verifica que despues del login te redirija de vuelta a `/suscriptores/planes`

### Verificación

- [ ] Click en "Contratar" sin sesion manda a `/auth/signin` con el query `?redirect=/suscriptores/planes`
- [ ] Post-login, el usuario vuelve a la pagina de planes y no a otra ruta
- [ ] No se dispara ningun POST al endpoint de checkout antes del login

---

## 7. Pre-Beta Real Transaction Checklist

Antes de habilitar el flujo para usuarios beta en produccion, tenes que correr UNA transaccion real con plata real para validar que todo el stack funciona con credenciales productivas. No saltees esto. Los bugs que solo aparecen en produccion son los peores.

### Preparacion

- [ ] Credenciales MP de produccion seteadas en el env productivo (distintas de las sandbox)
- [ ] Webhook URL en el dashboard de MP de produccion:

  ```text
  https://hospeda.com.ar/api/v1/webhooks/mercadopago
  ```

### Ejecucion

- [ ] Ejecutar una compra real del plan activo mas barato (por ejemplo, ARS $100)
- [ ] Verificar todo lo siguiente:
  - [ ] `PlanPurchaseButton` renderiza en produccion
  - [ ] Checkout de MP abre correctamente
  - [ ] Tarjeta real aprobada procesa el pago
  - [ ] Firma HMAC del webhook validada (revisar Sentry y logs sin errores de firma)
  - [ ] Idempotency key almacenada en `billing_webhook_events`
  - [ ] Suscripcion activada en la base (`billing_subscriptions.status='active'`)
  - [ ] Invoice / recibo enviado por email o registrado en la base
  - [ ] Pagina de success renderiza correctamente en produccion

### Post-ejecucion

- [ ] Reembolsar via dashboard de MP para recuperar los fondos
- [ ] Documentar el procedimiento de rollback (ver Seccion 8)
- [ ] Marcar la transaccion real en Engram para trazabilidad historica

---

## 8. Rollback / Troubleshooting

Si los webhooks empiezan a fallar en produccion, estos son los pasos de mitigacion:

### Activacion manual de suscripciones

Si un pago fue aprobado pero el webhook no activo la suscripcion, podes hacerlo manualmente desde:

```text
/admin/billing/subscriptions
```

### Revision de errores

- Revisar Sentry por errores del tag `webhook-signature-validation`
- Inspeccionar eventos fallidos en la base:

  ```sql
  SELECT id, provider_event_id, status, error_message, created_at
  FROM billing_webhook_events
  WHERE status = 'failed'
  ORDER BY created_at DESC;
  ```

### Replay de webhooks fallidos

Si existe una herramienta de replay en el admin, usala para reprocesar los eventos fallidos. Si no, se puede hacer manualmente con curl (ver Scenario 4). En ese caso, asegurate de que el `provider_event_id` no este ya procesado para evitar duplicados.

### Escalamiento

Si el problema persiste mas de 15 minutos o afecta a mas de un usuario, escalar a:

- Canal `#alerts-billing` en Slack
- On-call engineer del dia

---

**Fin del runbook.** Registra cualquier desviacion observada durante la ejecucion en el issue correspondiente y actualiza este documento si encontras pasos adicionales que valen la pena formalizar.

---
name: hospeda-email
description: Reglas para plantillas React Email, layouts, configuración y pruebas de correo de Hospeda.
triggers:
  - packages/email
  - email
  - React Email
  - plantilla de correo
  - password reset
  - verificación de email
---

# Hospeda Email

Usá este skill cuando cambies plantillas, layouts, remitentes, flujos de
verificación, reset de password o previews de correo.

## Reglas

- Reutilizá `BaseLayout` y las plantillas existentes.
- Mantené URLs, locale, branding y fallback de texto coherentes.
- No pongas API keys, tokens ni datos reales en previews o fixtures.
- Los enlaces de autenticación deben conservar expiración y propósito.
- Separá contenido de presentación y evitá HTML duplicado entre plantillas.
- Todo envío de notificaciones debe pasar por los transportes y contratos
  centralizados; no implementes un envío directo desde otra app o paquete.
- Los errores de proveedor deben conservar retry/backoff y un resultado
  observable sin registrar tokens, destinatarios completos ni payloads sensibles.

## Verificación

- Ejecutá tests de render y snapshots cuando existan.
- Revisá texto, enlaces, locale, responsive básico y estados faltantes.
- Validá que los flujos de verify/reset sigan invocando la plantilla correcta.

## Checklist

- [ ] Layout compartido y branding consistentes.
- [ ] Locale, placeholders y enlaces correctos.
- [ ] No se filtraron tokens o datos reales.
- [ ] Render y flujo de envío relevantes verificados.

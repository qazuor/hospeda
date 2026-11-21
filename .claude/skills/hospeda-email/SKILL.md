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

- Toda plantilla va dentro de `EmailLayout` de `@repo/email` (el único layout;
  `BaseLayout` y el layout de `@repo/notifications` ya no existen). Props:
  `previewText?`, `children`, `footerLink?: 'preferences' | 'none'` (default
  `'none'`).
- `footerLink="preferences"` sólo si el destinatario tiene cuenta Y la página
  de preferencias web controla ese correo de verdad (hoy ninguno: HOS-2519
  OQ-2). Nunca un href `{{placeholder}}`: nadie lo sustituye.
- Estilos inline y colores de `emailPalette` (`@repo/design-tokens`); nada de
  flexbox, grid, variables CSS, `oklch()`, fuentes web ni SVG.
- Renderizá con `renderEmailBodies` (HTML + texto); el envío es Brevo.
- Cada plantilla nueva lleva entrada y escenarios en el catálogo
  (`packages/notifications/src/catalog/`).
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

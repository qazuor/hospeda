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
  `previewText?`, `children`, `variant?: 'user' | 'staff'` (default `'user'`,
  HOS-2565) y `footerLink?: 'preferences' | 'none'` (default `'preferences'` en
  user, `'none'` en staff).
- Los correos internos pasan `variant="staff"`. Los lectores que pueden no tener
  cuenta (auth, conversación anónima, newsletter, alianza/aliado sin cuenta)
  pasan `footerLink="none"`; el set está congelado en
  `email-catalog-layout.test.ts`. Nunca un href `{{placeholder}}`.
- La ilustración y los artículos de ayuda del pie se declaran en
  `packages/notifications/src/catalog/layout-declarations.ts`, nunca en la
  plantilla. El link de cuenta (D16) sale de `VERTICAL_OWNS_PUBLICATIONS`: nunca
  compares un `VerticalEnum` en el layout.
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

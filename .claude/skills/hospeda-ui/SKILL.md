---
name: hospeda-ui
description: Reglas de componentes, iconos, tokens, accesibilidad y diseño compartido de Hospeda.
triggers:
  - packages/icons
  - UI shared
  - accesibilidad
  - design tokens
  - componentes visuales
---

# Hospeda UI

Usá este skill cuando cambies iconos, tokens, componentes compartidos,
accesibilidad o estilos que afectan varias apps.

## Reglas

- Reutilizá tokens y componentes existentes antes de agregar variantes.
- Elegí pesos y tamaños de iconos coherentes con el contexto.
- Botones icon-only requieren nombre accesible; decorativos deben marcarse como
  tales.
- Conservá focus visible, navegación por teclado y contraste.
- Cambios de tokens deben revisar web, admin y cualquier consumidor compartido.
- No mezcles reglas de diseño específicas de una app en el paquete compartido.

## Verificación

- Ejecutá tests del paquete y typecheck de consumidores relevantes.
- Revisá teclado, focus, contraste, responsive y dark mode cuando aplique.

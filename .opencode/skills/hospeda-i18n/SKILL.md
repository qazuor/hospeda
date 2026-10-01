---
name: hospeda-i18n
description: Reglas para traducciones, tipos generados, pluralización y formatos regionales de Hospeda.
triggers:
  - i18n
  - traducción
  - locale
  - traducciones
  - packages/i18n
---

# Hospeda i18n

Usá este skill cuando agregues o modifiques textos, locales, claves de
traducción, pluralización, fechas, números o tipos generados.

## Reglas

- Agregá claves en los locales soportados, no sólo en el idioma activo.
- Conservá la estructura, interpolaciones y pluralización de cada clave.
- Usá el API de `@repo/i18n` tanto en Astro como en React.
- No hardcodees texto visible nuevo en componentes o handlers.
- Generá tipos y ejecutá las validaciones después de cambiar traducciones.
- Separá copy de producto de mensajes técnicos y errores de API.
- `packages/i18n/src/types.ts` es un artefacto generado e ignorado por Git:
  nunca lo agregues manualmente ni lo uses como fuente de verdad.

## Verificación

- Ejecutá el generador de tipos y tests de locale.
- Revisá placeholders, pluralización y formato de fechas/números.
- Probá al menos el locale principal y uno alternativo.

## Checklist

- [ ] Todos los locales tienen la clave necesaria.
- [ ] Placeholders y pluralización coinciden.
- [ ] Tipos generados están actualizados.
- [ ] No hay texto visible hardcodeado nuevo.
- [ ] Tests de locale pasaron.
- [ ] El archivo generado quedó sin cambios versionables inesperados.

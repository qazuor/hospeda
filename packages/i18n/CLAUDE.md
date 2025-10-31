# CLAUDE.md - i18n Package

> **📚 Main Documentation**: For project-wide guidelines, workflows, and standards, see [CLAUDE.md](../../CLAUDE.md) in the project root.

This file provides guidance for working with the Internationalization package (`@repo/i18n`).

## Overview

Internationalization (i18n) utilities and translation management for supporting multiple languages across the Hospeda platform. Currently supports Spanish (es) and English (en).

## Key Commands

```bash
# Testing
pnpm test              # Run all tests
pnpm test:watch        # Watch mode

# Code Quality
pnpm typecheck         # TypeScript validation
pnpm lint              # Biome linting
pnpm format            # Format code
```

## Usage

### Basic Translation

```ts
import { t } from '@repo/i18n';

// Simple translation
const greeting = t('common.greeting');
// "Hola" (in Spanish) or "Hello" (in English)

// Translation with variables
const welcome = t('common.welcome', { name: 'Juan' });
// "Bienvenido, Juan" or "Welcome, Juan"
```

### Changing Locale

```ts
import { locale, setLocale } from '@repo/i18n';

// Get current locale
console.log(locale.get()); // 'es'

// Change locale
setLocale('en');

console.log(t('common.greeting')); // "Hello"
```

### Using in React

```tsx
import { useTranslation } from '@repo/i18n/react';

export function MyComponent() {
  const { t, locale, setLocale } = useTranslation();

  return (
    <div>
      <h1>{t('page.title')}</h1>
      <p>{t('page.description', { count: 5 })}</p>

      <button onClick={() => setLocale('en')}>English</button>
      <button onClick={() => setLocale('es')}>Español</button>
    </div>
  );
}
```

### Using in Astro

```astro
---
import { t } from '@repo/i18n';

const title = t('page.home.title');
const description = t('page.home.description');
---

<h1>{title}</h1>
<p>{description}</p>
```

## Translation Files

### Structure

```
locales/
├── es/
│   ├── common.json       # Common translations
│   ├── auth.json         # Authentication
│   ├── accommodations.json
│   ├── destinations.json
│   └── errors.json
└── en/
    ├── common.json
    ├── auth.json
    ├── accommodations.json
    ├── destinations.json
    └── errors.json
```

### Translation File Format

```json
// locales/es/common.json
{
  "greeting": "Hola",
  "welcome": "Bienvenido, {{name}}",
  "buttons": {
    "save": "Guardar",
    "cancel": "Cancelar",
    "delete": "Eliminar"
  },
  "messages": {
    "success": "Operación exitosa",
    "error": "Ocurrió un error"
  }
}
```

```json
// locales/en/common.json
{
  "greeting": "Hello",
  "welcome": "Welcome, {{name}}",
  "buttons": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete"
  },
  "messages": {
    "success": "Operation successful",
    "error": "An error occurred"
  }
}
```

## Key Patterns

### Nested Keys

```ts
// Access nested translation keys with dot notation
t('common.buttons.save'); // "Guardar"
t('auth.errors.invalidCredentials'); // "Credenciales inválidas"
```

### Pluralization

```json
{
  "items": {
    "zero": "No items",
    "one": "{{count}} item",
    "other": "{{count}} items"
  }
}
```

```ts
t('items', { count: 0 }); // "No items"
t('items', { count: 1 }); // "1 item"
t('items', { count: 5 }); // "5 items"
```

### Variables/Interpolation

```json
{
  "userGreeting": "Welcome back, {{name}}!",
  "itemsFound": "Found {{count}} {{type}} in {{city}}"
}
```

```ts
t('userGreeting', { name: 'María' });
// "Welcome back, María!"

t('itemsFound', { count: 10, type: 'hotels', city: 'Buenos Aires' });
// "Found 10 hotels in Buenos Aires"
```

### Dates and Numbers

```ts
import { formatDate, formatNumber, formatCurrency } from '@repo/i18n';

// Format date according to locale
formatDate(new Date(), 'es'); // "15 de enero de 2024"
formatDate(new Date(), 'en'); // "January 15, 2024"

// Format number
formatNumber(1234.56, 'es'); // "1.234,56"
formatNumber(1234.56, 'en'); // "1,234.56"

// Format currency
formatCurrency(1299.99, 'ARS', 'es'); // "$ 1.299,99"
formatCurrency(1299.99, 'USD', 'en'); // "$1,299.99"
```

## Type Safety

Generate TypeScript types from translations:

```bash
# Generate translation keys type
pnpm gen:i18n-types
```

This creates types for autocomplete:

```ts
// Auto-complete for translation keys
t('common.buttons.save'); // ✓ Type-safe
t('common.buttons.invalid'); // ✗ TypeScript error
```

## Best Practices

1. **Organize by feature** - separate translation files by domain
2. **Use consistent keys** - follow naming conventions
3. **Provide fallbacks** - always have English translations
4. **Avoid hardcoding text** - use translation keys everywhere
5. **Keep translations in sync** - ensure all keys exist in all locales
6. **Use variables** for dynamic content
7. **Test both locales** - ensure UI works in all languages
8. **Respect locale formats** - dates, numbers, currencies

## Common Translation Keys

```
common.* - Common UI elements
auth.* - Authentication/authorization
errors.* - Error messages
validation.* - Form validation
navigation.* - Navigation items
actions.* - Action buttons (save, edit, delete)
status.* - Status labels
```

## Integration Examples

### In Forms

```tsx
import { useTranslation } from '@repo/i18n/react';

export function LoginForm() {
  const { t } = useTranslation();

  return (
    <form>
      <label>{t('auth.email')}</label>
      <input type="email" placeholder={t('auth.emailPlaceholder')} />

      <label>{t('auth.password')}</label>
      <input type="password" />

      <button type="submit">{t('auth.login')}</button>
    </form>
  );
}
```

### In Error Messages

```ts
import { t } from '@repo/i18n';

if (!user) {
  throw new Error(t('errors.userNotFound'));
}

if (!hasPermission) {
  throw new Error(t('errors.forbidden'));
}
```

### Language Switcher Component

```tsx
import { useTranslation } from '@repo/i18n/react';

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <select value={locale} onChange={(e) => setLocale(e.target.value)}>
      <option value="es">Español</option>
      <option value="en">English</option>
    </select>
  );
}
```

## Supported Locales

- `es` - Spanish (default)
- `en` - English

## Key Dependencies

None - lightweight implementation using JSON files.

## Notes

- Default locale is Spanish (`es`)
- Locale preference stored in localStorage (client-side)
- Server-side rendering uses request headers or default locale
- Missing translations fall back to English

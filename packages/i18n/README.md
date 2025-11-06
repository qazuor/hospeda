# @repo/i18n

Internationalization (i18n) utilities and translation management for multi-language support across the Hospeda platform. Provides type-safe translations with React hooks and a simple API.

## Installation

This package is part of the Hospeda monorepo workspace. Add it as a dependency in your `package.json`:

```json
{
  "dependencies": {
    "@repo/i18n": "workspace:*"
  }
}
```

Then run:

```bash
pnpm install
```

## Supported Languages

Currently supports:

- **Spanish (es)** - Default locale

Future support planned for:

- English (en)
- Portuguese (pt)

## What's Included

- **Translation files** - JSON files for each locale and namespace
- **React hooks** - `useTranslations` for React components
- **Translation function** - `trans` object for direct access
- **Type definitions** - TypeScript types for translation keys
- **Configuration** - Locale and namespace configuration

## Quick Start

### Basic Usage (React)

```tsx
import { useTranslations } from '@repo/i18n';

export function WelcomeMessage() {
  const { t } = useTranslations();

  return (
    <div>
      <h1>{t('common.welcome')}</h1>
      <p>{t('common.description')}</p>
    </div>
  );
}
```

### With Parameters

```tsx
import { useTranslations } from '@repo/i18n';

export function UserGreeting({ name }: { name: string }) {
  const { t } = useTranslations();

  return (
    <h1>{t('common.greeting', { name })}</h1>
  );
}

// Translation: "Hola, {name}!"
// Output: "Hola, Juan!"
```

### Direct Access (Non-React)

```typescript
import { trans, defaultLocale } from '@repo/i18n';

const message = trans[defaultLocale]['common.welcome'];
console.log(message);  // "Bienvenido"
```

## Usage

### React Hook

The `useTranslations` hook provides a translation function:

```tsx
import { useTranslations } from '@repo/i18n';

export function MyComponent() {
  const { t, locale } = useTranslations();

  return (
    <div>
      <p>{t('home.hero.title')}</p>
      <p>Current locale: {locale}</p>
    </div>
  );
}
```

**Hook Returns:**

- `t(key, params?)` - Translation function
- `locale` - Current locale string

### Translation Keys

Translation keys use dot notation to access nested values:

```typescript
// Translation file: locales/es/common.json
{
  "nav": {
    "home": "Inicio",
    "about": "Acerca de",
    "contact": "Contacto"
  }
}

// Usage
t('common.nav.home')  // "Inicio"
t('common.nav.about')  // "Acerca de"
```

### String Interpolation

Use `{key}` or `{{key}}` syntax for dynamic values:

```json
{
  "welcome": "Bienvenido, {name}!",
  "itemCount": "Tienes {{count}} items en tu carrito"
}
```

```tsx
t('common.welcome', { name: 'María' })
// "Bienvenido, María!"

t('common.itemCount', { count: 5 })
// "Tienes 5 items en tu carrito"
```

### Multiple Parameters

```json
{
  "searchResults": "Encontramos {count} {type} en {city}"
}
```

```tsx
t('search.searchResults', {
  count: 10,
  type: 'alojamientos',
  city: 'Concepción del Uruguay'
})
// "Encontramos 10 alojamientos en Concepción del Uruguay"
```

## Translation Files

### Directory Structure

```
packages/i18n/src/locales/
└── es/
    ├── about.json
    ├── accommodations.json
    ├── admin-auth.json
    ├── admin-common.json
    ├── admin-dashboard.json
    ├── admin-menu.json
    ├── admin-nav.json
    ├── admin-pages.json
    ├── admin-tables.json
    ├── auth-ui.json
    ├── benefits.json
    ├── blog.json
    ├── common.json
    ├── contact.json
    ├── destination.json
    ├── error.json
    ├── event.json
    ├── fields.json
    ├── footer.json
    ├── home.json
    ├── nav.json
    ├── newsletter.json
    ├── privacy.json
    ├── search.json
    ├── terms.json
    └── ui.json
```

### Namespaces

Each JSON file represents a namespace:

- **common** - Common UI elements (buttons, labels, messages)
- **nav** - Navigation items
- **footer** - Footer content
- **home** - Homepage content
- **accommodations** - Accommodation-related content
- **auth-ui** - Authentication UI
- **error** - Error messages
- **fields** - Form field labels
- **ui** - Generic UI elements
- **admin-*** - Admin dashboard namespaces

### Translation File Format

```json
{
  "section": {
    "subsection": {
      "key": "Translation text",
      "anotherKey": "More text with {parameter}"
    }
  },
  "simple": "Simple translation"
}
```

**Example: `locales/es/common.json`**

```json
{
  "welcome": "Bienvenido",
  "greeting": "Hola, {name}!",
  "buttons": {
    "save": "Guardar",
    "cancel": "Cancelar",
    "delete": "Eliminar",
    "edit": "Editar"
  },
  "messages": {
    "success": "Operación exitosa",
    "error": "Ocurrió un error",
    "loading": "Cargando..."
  }
}
```

## Adding Translations

### Step 1: Add to Translation File

Edit the appropriate JSON file in `packages/i18n/src/locales/es/`:

```json
{
  "newFeature": {
    "title": "Nueva Funcionalidad",
    "description": "Descripción de la nueva funcionalidad"
  }
}
```

### Step 2: Use in Code

```tsx
import { useTranslations } from '@repo/i18n';

export function NewFeature() {
  const { t } = useTranslations();

  return (
    <div>
      <h2>{t('common.newFeature.title')}</h2>
      <p>{t('common.newFeature.description')}</p>
    </div>
  );
}
```

### Step 3: Generate Types (Optional)

Run type generation for autocomplete:

```bash
cd packages/i18n
pnpm generate-types
```

This creates TypeScript types for all translation keys, enabling IDE autocomplete.

## Adding a New Language

### Step 1: Add Locale

Edit `packages/i18n/src/config.ts`:

```typescript
export const locales = ['es', 'en'] as const;
```

### Step 2: Create Translation Files

Create directory and files:

```bash
mkdir -p packages/i18n/src/locales/en
```

Copy Spanish files and translate:

```bash
cp -r packages/i18n/src/locales/es/* packages/i18n/src/locales/en/
```

### Step 3: Import Translations

Edit `packages/i18n/src/config.ts` and add imports:

```typescript
// English translations
import aboutEn from './locales/en/about.json';
import commonEn from './locales/en/common.json';
// ... other imports

const rawTranslations = {
  es: { /* ... */ },
  en: {
    about: aboutEn,
    common: commonEn,
    // ... other namespaces
  }
};
```

### Step 4: Test

```tsx
const { t } = useTranslations('en');
console.log(t('common.welcome'));  // English translation
```

## Type Safety

Translation keys are type-checked when using TypeScript:

```tsx
import { useTranslations } from '@repo/i18n';
import type { TranslationKey } from '@repo/i18n';

export function TypedComponent() {
  const { t } = useTranslations();

  // ✅ Valid key - autocomplete works
  const title = t('home.hero.title');

  // ❌ Invalid key - TypeScript error
  const invalid = t('home.invalid.key');

  return <h1>{title}</h1>;
}
```

### Custom Type-Safe Wrapper

```typescript
import type { TranslationKey } from '@repo/i18n';
import { trans, defaultLocale } from '@repo/i18n';

export function typedTranslate(
  key: TranslationKey,
  params?: Record<string, unknown>
): string {
  const raw = trans[defaultLocale][key];

  if (!params) return raw;

  return Object.keys(params).reduce((acc, k) => {
    const v = params[k];
    return acc
      .replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      .replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
  }, raw);
}
```

## Common Patterns

### Conditional Translation

```tsx
import { useTranslations } from '@repo/i18n';

export function StatusBadge({ status }: { status: 'active' | 'inactive' }) {
  const { t } = useTranslations();

  const statusKey = status === 'active' ? 'ui.status.active' : 'ui.status.inactive';

  return (
    <span className={status === 'active' ? 'text-green-600' : 'text-gray-600'}>
      {t(statusKey)}
    </span>
  );
}
```

### Pluralization

```json
{
  "items": {
    "zero": "No hay items",
    "one": "{count} item",
    "other": "{count} items"
  }
}
```

```tsx
function getItemText(count: number): string {
  const { t } = useTranslations();

  if (count === 0) return t('common.items.zero');
  if (count === 1) return t('common.items.one', { count });
  return t('common.items.other', { count });
}
```

### Lists and Arrays

```json
{
  "features": [
    "Característica 1",
    "Característica 2",
    "Característica 3"
  ]
}
```

```tsx
// Note: Arrays are flattened to dot notation
t('home.features.0')  // "Característica 1"
t('home.features.1')  // "Característica 2"
```

### Date and Number Formatting

For locale-specific formatting, use browser APIs:

```tsx
import { useTranslations } from '@repo/i18n';

export function FormattedPrice({ amount }: { amount: number }) {
  const { locale } = useTranslations();

  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'ARS'
  }).format(amount);

  return <span>{formatted}</span>;
}
```

## Configuration

### Default Locale

```typescript
import { defaultLocale } from '@repo/i18n';

console.log(defaultLocale);  // 'es'
```

### Available Locales

```typescript
import { locales } from '@repo/i18n';

console.log(locales);  // ['es']
```

### Available Namespaces

```typescript
import { namespaces } from '@repo/i18n';

console.log(namespaces);
// ['common', 'nav', 'footer', 'accommodations', ...]
```

## Astro Integration

For Astro pages and components:

```astro
---
import { trans, defaultLocale } from '@repo/i18n';

const t = (key: string) => trans[defaultLocale][key];
const title = t('home.hero.title');
const description = t('home.hero.description');
---

<h1>{title}</h1>
<p>{description}</p>
```

## API Reference

### `useTranslations(locale?)`

React hook for translations.

**Parameters:**

- `locale?: string` - Locale to use (defaults to `defaultLocale`)

**Returns:**

- `t(key: TranslationKey, params?: Record<string, unknown>): string` - Translation function
- `locale: string` - Current locale

**Example:**

```tsx
const { t, locale } = useTranslations('es');
```

### `trans`

Object containing all translations by locale.

**Type:**

```typescript
const trans: Record<Locale, Record<string, string>>;
```

**Example:**

```typescript
import { trans } from '@repo/i18n';

const spanishWelcome = trans.es['common.welcome'];
```

### `defaultLocale`

Default locale constant.

**Value:** `'es'`

### `locales`

Array of supported locales.

**Value:** `['es']`

### `namespaces`

Array of available namespaces.

**Value:** `['common', 'nav', 'footer', ...]`

## Testing

### Mocking Translations

```tsx
import { render, screen } from '@testing-library/react';
import { useTranslations } from '@repo/i18n';

vi.mock('@repo/i18n', () => ({
  useTranslations: () => ({
    t: (key: string) => key,  // Return key as-is
    locale: 'es'
  })
}));

test('renders translated text', () => {
  const Component = () => {
    const { t } = useTranslations();
    return <h1>{t('common.welcome')}</h1>;
  };

  render(<Component />);
  expect(screen.getByText('common.welcome')).toBeInTheDocument();
});
```

### Testing with Real Translations

```tsx
import { trans, defaultLocale } from '@repo/i18n';

test('translation exists', () => {
  const welcome = trans[defaultLocale]['common.welcome'];
  expect(welcome).toBe('Bienvenido');
});
```

## Best Practices

### 1. Use Namespaces Wisely

Group related translations in the same namespace:

```
common.json - Shared across the app
home.json - Homepage specific
admin-*.json - Admin dashboard only
```

### 2. Keep Keys Descriptive

```json
// ✅ Good
{
  "hero": {
    "title": "...",
    "subtitle": "...",
    "cta": "..."
  }
}

// ❌ Bad
{
  "t1": "...",
  "text2": "...",
  "btn": "..."
}
```

### 3. Avoid Hardcoded Text

```tsx
// ❌ Bad
<button>Guardar</button>

// ✅ Good
<button>{t('common.buttons.save')}</button>
```

### 4. Use Parameters for Dynamic Content

```json
// ❌ Bad - separate translations for each case
{
  "welcomeJuan": "Bienvenido, Juan",
  "welcomeMaria": "Bienvenido, María"
}

// ✅ Good - one translation with parameter
{
  "welcome": "Bienvenido, {name}"
}
```

### 5. Maintain Consistency

Use consistent terminology across translations:

```json
{
  "buttons": {
    "save": "Guardar",    // Always "Guardar", not "Salvar"
    "cancel": "Cancelar",  // Always "Cancelar", not "Descartar"
    "delete": "Eliminar"   // Always "Eliminar", not "Borrar"
  }
}
```

## Troubleshooting

### Missing Translation Warning

If you see `[MISSING: key]`, the translation key doesn't exist:

1. Check spelling of the key
2. Verify the key exists in the JSON file
3. Restart dev server if you just added it

### Type Errors

If TypeScript complains about translation keys:

```bash
cd packages/i18n
pnpm generate-types
```

### Stale Translations

If changes to JSON files aren't reflected:

1. Restart dev server
2. Clear build cache: `pnpm clean`
3. Rebuild: `pnpm build`

## Dependencies

- **zod** (^4.0.8) - Schema validation
- **react** (^19.0.0) - Peer dependency for hooks

## Related Packages

- [@repo/auth-ui](../auth-ui) - Uses i18n for auth translations
- [@repo/utils](../utils) - Utility functions

## License

MIT

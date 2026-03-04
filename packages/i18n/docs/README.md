# @repo/i18n Documentation

## Overview

`@repo/i18n` is the shared internationalization package for the Hospeda platform. It provides type-safe translations, React hooks, formatting utilities, and pluralization support for all apps in the monorepo.

## Purpose

- **Single source of truth** for all user-facing text across web, admin, and API apps
- **Type-safe translation keys** with TypeScript autocompletion
- **Namespace-based organization** for maintainable translation files
- **Locale-aware formatting** for dates, numbers, and currencies

## Supported Locales

| Locale | Language | Intl Tag | Default Currency |
|--------|----------|----------|-----------------|
| `es` | Spanish (default) | `es-AR` | ARS |
| `en` | English | `en-US` | USD |
| `pt` | Portuguese | `pt-BR` | BRL |

## Package Structure

```
packages/i18n/
├── src/
│   ├── index.ts          # Public exports
│   ├── config.ts         # Locales, namespaces, translation loading
│   ├── types.ts          # TranslationKey types
│   ├── formatting.ts     # Date, number, currency formatting
│   ├── pluralization.ts  # CLDR-style _one/_other resolution
│   ├── hooks/
│   │   └── use-translations.ts  # React hook
│   └── locales/
│       ├── es/           # Spanish translations (34 JSON files)
│       ├── en/           # English translations (34 JSON files)
│       └── pt/           # Portuguese translations (34 JSON files)
└── docs/
    ├── README.md         # This file
    ├── quick-start.md    # Getting started
    └── guides/
        ├── adding-translations.md  # How to add new keys
        └── usage.md               # Detailed usage patterns
```

## Exports

### Core

| Export | Type | Description |
|--------|------|-------------|
| `trans` | `Record<Locale, Record<string, string>>` | Flattened translations object |
| `defaultLocale` | `'es'` | Default locale constant |
| `defaultIntlLocale` | `'es-AR'` | BCP 47 locale for Intl formatting |
| `locales` | `['es', 'en', 'pt']` | Supported locale array |
| `namespaces` | `Namespace[]` | Available translation namespaces |

### Hooks

| Export | Description |
|--------|-------------|
| `useTranslations(locale?)` | React hook returning `{ t, tPlural, locale }` |

### Formatting

| Export | Description |
|--------|-------------|
| `formatDate({ date, locale, options? })` | Locale-aware date formatting |
| `formatNumber({ value, locale, options? })` | Locale-aware number formatting |
| `formatCurrency({ value, locale, currency? })` | Currency formatting with locale defaults |
| `resolveDefaultCurrency(locale)` | Get default currency code for a locale |
| `toBcp47Locale(locale)` | Convert short locale to BCP 47 tag |

### Utilities

| Export | Description |
|--------|-------------|
| `pluralize({ t, key, count, params? })` | CLDR-style pluralization |

### Types

| Export | Description |
|--------|-------------|
| `Locale` | `'es' \| 'en' \| 'pt'` |
| `Namespace` | Union of all namespace strings |
| `TranslationKey` | Union of all valid translation keys |

## Namespaces

Translation files are organized by namespace. Each JSON file in `locales/{locale}/` is a namespace:

**App namespaces**: `common`, `nav`, `footer`, `home`, `accommodations`, `blog`, `contact`, `about`, `benefits`, `error`, `privacy`, `search`, `terms`, `ui`, `fields`, `newsletter`, `owners`, `review`, `account`, `billing`, `exchange-rate`

**Auth namespace**: `auth-ui`

**Admin namespaces**: `admin-auth`, `admin-billing`, `admin-common`, `admin-dashboard`, `admin-entities`, `admin-menu`, `admin-nav`, `admin-pages`, `admin-tables`, `admin-tabs`

## Documentation Index

| Document | Description |
|----------|-------------|
| [Quick Start](./quick-start.md) | Installation and basic usage |
| [Adding Translations](./guides/adding-translations.md) | How to add new translation keys |
| [Usage Patterns](./guides/usage.md) | Detailed usage in React, Astro, and server-side |

## Related Resources

- [Internationalization Guide](../../../docs/guides/internationalization.md)
- [@repo/auth-ui](../../auth-ui/docs/README.md) .. Uses i18n for auth translations

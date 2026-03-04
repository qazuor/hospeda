# Quick Start

## Installation

Add the package to your app's `package.json`:

```json
{
  "dependencies": {
    "@repo/i18n": "workspace:*"
  }
}
```

Then install:

```bash
pnpm install
```

## Basic Usage in React

```tsx
import { useTranslations } from '@repo/i18n';

export function WelcomeBanner() {
  const { t } = useTranslations();

  return (
    <div>
      <h1>{t('home.hero.title')}</h1>
      <p>{t('home.hero.subtitle')}</p>
    </div>
  );
}
```

## With a Specific Locale

```tsx
import { useTranslations } from '@repo/i18n';

export function WelcomeBanner({ locale }: { locale: string }) {
  const { t } = useTranslations(locale);

  return <h1>{t('home.hero.title')}</h1>;
}
```

## With Parameters

```tsx
const { t } = useTranslations();

// Translation: "Hola, {name}!"
t('common.greeting', { name: 'Maria' });
// Output: "Hola, Maria!"
```

## With Pluralization

```tsx
const { tPlural } = useTranslations();

// Translations: "review.list.totalReviews_one": "{count} resena"
//               "review.list.totalReviews_other": "{count} resenas"
tPlural('review.list.totalReviews', 1);  // "1 resena"
tPlural('review.list.totalReviews', 5);  // "5 resenas"
```

## In Astro Components

```astro
---
import { trans, defaultLocale } from '@repo/i18n';

const locale = Astro.params.lang || defaultLocale;
const translations = trans[locale as keyof typeof trans] || trans[defaultLocale];

const title = translations['home.hero.title'];
const description = translations['home.hero.subtitle'];
---

<h1>{title}</h1>
<p>{description}</p>
```

## Formatting Dates and Currency

```tsx
import { formatDate, formatCurrency } from '@repo/i18n';

// Date
formatDate({ date: new Date(), locale: 'es-AR' });
// "4 de marzo de 2026"

// Currency (auto-detects ARS for es-AR)
formatCurrency({ value: 1500, locale: 'es-AR' });
// "$ 1.500,00"

// Explicit currency
formatCurrency({ value: 29.99, locale: 'en-US', currency: 'USD' });
// "$29.99"
```

## Direct Translation Access (Server-Side)

```ts
import { trans, defaultLocale } from '@repo/i18n';

const welcome = trans[defaultLocale]['common.welcome'];
console.log(welcome); // "Bienvenido"
```

## Next Steps

- [Adding Translations](./guides/adding-translations.md) .. How to add new keys and namespaces
- [Usage Patterns](./guides/usage.md) .. Detailed patterns for all environments

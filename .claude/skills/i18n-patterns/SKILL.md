---
name: i18n-patterns
description: Internationalization and localization patterns. Use when adding multi-language support, RTL layouts, pluralization, or number/date formatting.
---

# i18n Patterns

## Purpose

Internationalization (i18n) and localization (l10n) patterns for web applications. Covers translation file structure, locale detection, pluralization, RTL support, number/date formatting, and framework-specific integration.

## Activation

Use this skill when the user asks about:

- Internationalization (i18n) setup
- Translation file structure
- Locale detection and switching
- Pluralization rules
- RTL (right-to-left) language support
- Number, date, and currency formatting
- i18n in React / Next.js

## Translation File Structure

### Namespace-Based Organization

```
locales/
├── en/
│   ├── common.json         # Shared across all pages
│   ├── auth.json           # Login, signup, password reset
│   ├── dashboard.json      # Dashboard page
│   ├── errors.json         # Error messages
│   └── validation.json     # Form validation messages
├── es/
│   ├── common.json
│   ├── auth.json
│   ├── dashboard.json
│   ├── errors.json
│   └── validation.json
├── ar/                      # Arabic (RTL)
│   ├── common.json
│   └── ...
└── ja/                      # Japanese
    ├── common.json
    └── ...
```

### Translation File Format

```json
// locales/en/common.json
{
  "app": {
    "name": "MyApp",
    "tagline": "Build something great"
  },
  "nav": {
    "home": "Home",
    "about": "About",
    "contact": "Contact",
    "login": "Log in",
    "logout": "Log out",
    "settings": "Settings"
  },
  "actions": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "confirm": "Confirm",
    "back": "Go back",
    "loadMore": "Load more"
  },
  "status": {
    "loading": "Loading...",
    "saving": "Saving...",
    "success": "Success!",
    "error": "Something went wrong"
  },
  "pagination": {
    "showing": "Showing {{from}} to {{to}} of {{total}} results",
    "page": "Page {{current}} of {{total}}"
  }
}
```

```json
// locales/en/auth.json
{
  "login": {
    "title": "Welcome back",
    "subtitle": "Sign in to your account",
    "email": "Email address",
    "password": "Password",
    "rememberMe": "Remember me",
    "forgotPassword": "Forgot your password?",
    "submit": "Sign in",
    "noAccount": "Don't have an account?",
    "signUp": "Create one"
  },
  "errors": {
    "invalidCredentials": "Invalid email or password",
    "accountLocked": "Account is locked. Try again in {{minutes}} minutes.",
    "tooManyAttempts": "Too many login attempts. Please try again later."
  }
}
```

```json
// locales/en/validation.json
{
  "required": "{{field}} is required",
  "email": "Please enter a valid email address",
  "minLength": "{{field}} must be at least {{min}} characters",
  "maxLength": "{{field}} must be at most {{max}} characters",
  "passwordMatch": "Passwords do not match",
  "invalidFormat": "Invalid format for {{field}}"
}
```

## Pluralization

### ICU Message Format (Recommended)

```json
{
  "items": "{count, plural, =0 {No items} one {1 item} other {# items}}",
  "notifications": "{count, plural, =0 {No new notifications} one {You have 1 new notification} other {You have # new notifications}}",
  "daysAgo": "{count, plural, =0 {Today} one {Yesterday} other {# days ago}}"
}
```

### Language-Specific Plural Rules

Different languages have different plural categories:

| Language | Categories | Example |
|----------|-----------|---------|
| English | one, other | 1 item, 2 items |
| French | one, other | 1 article, 2 articles (0 is "one") |
| Arabic | zero, one, two, few, many, other | Complex rules |
| Japanese | other | No pluralization |
| Russian | one, few, many, other | 1 item, 2-4 items, 5-20 items |
| Polish | one, few, many, other | Similar to Russian |

```json
// locales/ar/common.json (Arabic plural example)
{
  "items": "{count, plural, =0 {لا عناصر} one {عنصر واحد} two {عنصران} few {# عناصر} many {# عنصرًا} other {# عنصر}}"
}
```

## Locale Detection

### Detection Priority

1. URL parameter or path segment (`/en/about`, `?lang=en`)
2. Cookie (`NEXT_LOCALE`, `i18n_lang`)
3. `Accept-Language` header
4. User profile preference (if authenticated)
5. Default locale fallback

### Next.js Middleware Detection

```typescript
// middleware.ts
import { NextRequest, NextResponse } from "next/server";

const locales = ["en", "es", "fr", "de", "ja", "ar"];
const defaultLocale = "en";

function getLocale(request: NextRequest): string {
  // 1. Check cookie
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  if (cookieLocale && locales.includes(cookieLocale)) {
    return cookieLocale;
  }

  // 2. Check Accept-Language header
  const acceptLanguage = request.headers.get("accept-language");
  if (acceptLanguage) {
    const preferred = acceptLanguage
      .split(",")
      .map((lang) => lang.split(";")[0].trim().substring(0, 2))
      .find((lang) => locales.includes(lang));
    if (preferred) return preferred;
  }

  // 3. Default
  return defaultLocale;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if pathname already has a locale
  const hasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (hasLocale) return;

  // Redirect to locale-prefixed path
  const locale = getLocale(request);
  request.nextUrl.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|.*\\..*).*)"],
};
```

## RTL Support

### CSS Logical Properties

Use logical properties instead of directional ones:

```css
/* BAD: breaks in RTL */
.card {
  margin-left: 16px;
  padding-right: 8px;
  text-align: left;
  border-left: 2px solid blue;
}

/* GOOD: works in both LTR and RTL */
.card {
  margin-inline-start: 16px;
  padding-inline-end: 8px;
  text-align: start;
  border-inline-start: 2px solid blue;
}
```

### Logical Property Mapping

| Physical (LTR-only) | Logical (Bidirectional) |
|---|---|
| `margin-left` | `margin-inline-start` |
| `margin-right` | `margin-inline-end` |
| `padding-left` | `padding-inline-start` |
| `padding-right` | `padding-inline-end` |
| `border-left` | `border-inline-start` |
| `text-align: left` | `text-align: start` |
| `float: left` | `float: inline-start` |
| `left: 0` | `inset-inline-start: 0` |
| `width` | `inline-size` |
| `height` | `block-size` |

### HTML dir Attribute

```tsx
// Set document direction based on locale
function RootLayout({ locale, children }: { locale: string; children: React.ReactNode }) {
  const dir = ["ar", "he", "fa", "ur"].includes(locale) ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir}>
      <body>{children}</body>
    </html>
  );
}
```

### Tailwind CSS RTL

```html
<!-- Tailwind with RTL support -->
<div class="ml-4 rtl:mr-4 rtl:ml-0">
  <span class="text-left rtl:text-right">Content</span>
</div>

<!-- Or use logical utilities (Tailwind v3.3+) -->
<div class="ms-4">       <!-- margin-inline-start -->
  <span class="text-start">Content</span>
</div>
```

## Number, Date, and Currency Formatting

### Intl API (Built-in)

```typescript
// Number formatting
function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}
// formatNumber(1234567.89, "en-US")  -> "1,234,567.89"
// formatNumber(1234567.89, "de-DE")  -> "1.234.567,89"
// formatNumber(1234567.89, "ja-JP")  -> "1,234,567.89"

// Currency formatting
function formatCurrency(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount);
}
// formatCurrency(42.50, "USD", "en-US")  -> "$42.50"
// formatCurrency(42.50, "EUR", "de-DE")  -> "42,50 €"
// formatCurrency(42.50, "JPY", "ja-JP")  -> "￥43" (no decimals for JPY)

// Date formatting
function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
// formatDate(new Date("2024-07-15"), "en-US")  -> "July 15, 2024"
// formatDate(new Date("2024-07-15"), "de-DE")  -> "15. Juli 2024"
// formatDate(new Date("2024-07-15"), "ja-JP")  -> "2024年7月15日"

// Relative time
function formatRelativeTime(date: Date, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (Math.abs(diffDays) < 1) return rtf.format(0, "day");
  if (Math.abs(diffDays) < 30) return rtf.format(diffDays, "day");
  if (Math.abs(diffDays) < 365) return rtf.format(Math.round(diffDays / 30), "month");
  return rtf.format(Math.round(diffDays / 365), "year");
}
// formatRelativeTime(yesterday, "en")  -> "yesterday"
// formatRelativeTime(yesterday, "es")  -> "ayer"
```

### List Formatting

```typescript
function formatList(items: string[], locale: string, type: "conjunction" | "disjunction" = "conjunction"): string {
  return new Intl.ListFormat(locale, { style: "long", type }).format(items);
}
// formatList(["Alice", "Bob", "Charlie"], "en")  -> "Alice, Bob, and Charlie"
// formatList(["Alice", "Bob", "Charlie"], "es")  -> "Alice, Bob y Charlie"
// formatList(["Alice", "Bob"], "en", "disjunction")  -> "Alice or Bob"
```

## React / next-intl Integration

### Setup with next-intl

```typescript
// i18n.ts
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./locales/${locale}/common.json`)).default,
}));
```

### Using Translations in Components

```tsx
import { useTranslations } from "next-intl";

function LoginForm() {
  const t = useTranslations("auth.login");

  return (
    <form>
      <h1>{t("title")}</h1>
      <p>{t("subtitle")}</p>

      <label>{t("email")}</label>
      <input type="email" />

      <label>{t("password")}</label>
      <input type="password" />

      <button type="submit">{t("submit")}</button>

      {/* With interpolation */}
      <p>{t("noAccount")} <a href="/signup">{t("signUp")}</a></p>
    </form>
  );
}
```

### Rich Text and HTML in Translations

```json
{
  "welcome": "Welcome, <bold>{name}</bold>!",
  "terms": "By signing up, you agree to our <link>Terms of Service</link>."
}
```

```tsx
function Welcome({ name }: { name: string }) {
  const t = useTranslations();

  return (
    <p>
      {t.rich("welcome", {
        name,
        bold: (chunks) => <strong>{chunks}</strong>,
      })}
    </p>
  );
}
```

## Best Practices

1. **Use ICU message format** for pluralization and interpolation rather than custom syntax
2. **Never concatenate translated strings** - languages have different word orders (`t("welcome", { name })` not `t("welcome") + name`)
3. **Use namespaced keys** - `auth.login.title` not `loginTitle`
4. **Provide context for translators** - Short keys like "save" could mean noun or verb; add descriptions
5. **Use logical CSS properties** - `margin-inline-start` instead of `margin-left` for RTL support
6. **Format numbers and dates with Intl** - Never hardcode formats like `MM/DD/YYYY`
7. **Extract strings early** - Retrofitting i18n is much harder than starting with it
8. **Test with pseudo-localization** - Expand strings by 30-40% to catch UI overflow issues
9. **Support locale switching without reload** - Store preference in cookie, not just URL
10. **Keep translations flat when possible** - Deep nesting makes translator tools harder to use
11. **Handle missing translations gracefully** - Show the key or fallback locale, never crash
12. **Avoid gendered language** - "They" instead of "he/she", or use ICU `select` for languages that require it

# API Error Translation

This guide explains how to render a Hospeda API error in the user's locale using
`translateApiError` from `@repo/i18n`.

---

## 1. Priority Chain

When the API returns an error payload `{ code, reason?, message }`, the function
resolves the display string by walking this chain and returning the first hit:

| Priority | Source | Condition |
|----------|--------|-----------|
| 1 | `common.apiError.<reason>` | `error.reason` is present and has a translation |
| 2 | `common.apiError.<code>` | `error.code` is present and has a translation |
| 3 | `error.message` | Raw English string from the API |
| 4 | caller `fallback` | Pre-localized string passed by the caller |
| 5 | `common.apiError.GENERIC` | Last-resort generic message |

`reason` is a finer-grained discriminator some endpoints send alongside `code`
(e.g. `code: 'SERVICE_UNAVAILABLE'` + `reason: 'NEWSLETTER_NOT_CONFIGURED'`).
When present it takes precedence so the UI shows copy specific to the failure
mode rather than the generic 503 copy.

---

## 2. Calling `translateApiError`

### 2.1 React component — pass `t` from `useTranslations`

```tsx
import { translateApiError } from '@repo/i18n';
import { useTranslations } from '@repo/i18n';

export function SaveButton() {
    const { t } = useTranslations();

    async function handleSave() {
        const result = await saveAccommodation(data);
        if (!result.success) {
            const message = translateApiError({ error: result.error, t });
            setErrorMessage(message);
        }
    }

    return <button onClick={handleSave}>Guardar</button>;
}
```

`t` has the signature `(key, fallback?, params?) => string`. When a key is
missing, `t` returns the `fallback` or a `[MISSING: key]` sentinel, which the
priority chain treats as absent and falls through to the next level.

### 2.2 Non-React context — pass `locale` directly

Use this path in Astro server components, plain TypeScript utilities, or
anywhere outside a React tree.

```ts
import { translateApiError } from '@repo/i18n';

const message = translateApiError({ error: result.error, locale: 'es' });
```

`locale` must be one of `'es' | 'en' | 'pt'`. The function looks up the key
directly from the `trans` flat map without going through a React context.

### 2.3 Admin panel — use `translateAdminApiError`

The admin app (`apps/admin`) wraps `translateApiError` in a thin adapter because
the `useTranslations` hook from `@repo/i18n` exposes a `t` function with a
different signature: `(key, params?) => string` — with no `fallback` parameter.

```ts
// apps/admin/src/lib/errors/translate-api-error.ts (exported from @/lib/errors)
import { translateAdminApiError } from '@/lib/errors';
import { useTranslations } from '@/hooks/use-translations';

const { t } = useTranslations();
const message = translateAdminApiError({ error: result.error, t });
```

Do **not** call `translateApiError` directly from admin components — the `t`
signature mismatch causes the fallback parameter to be silently ignored.

---

## 3. Adding a New Error Code

When adding a value to `ServiceErrorCode` in `@repo/schemas`:

1. Add the enum value to `packages/schemas/src/enums/service-error-code.enum.ts`.

2. Add the translation key to all three locale files under the `apiError` object:

   ```jsonc
   // packages/i18n/src/locales/es/common.json
   {
     "apiError": {
       "YOUR_NEW_CODE": "Mensaje breve para el usuario."
     }
   }
   ```

   Do the same in `en/common.json` and `pt/common.json` with real localized copy
   (no `[MISSING:]` placeholders or English text in non-English locales).

3. Run the guard test to confirm coverage:

   ```bash
   pnpm --filter @repo/i18n test -- test/api-error-key-coverage.test.ts
   ```

   The guard (`packages/i18n/test/api-error-key-coverage.test.ts`) iterates
   every `ServiceErrorCode` value and asserts that `trans[locale]['common.apiError.<CODE>']`
   is a non-empty string in `es`, `en`, and `pt`. It fails with a clear list of
   missing locale/key pairs so you know exactly what to add.

   CI runs this test on every PR — a missing key blocks merge.

---

## 4. What NOT to Migrate

`translateApiError` is exclusively for structured Hospeda API error responses.
Do **not** use it for:

- **Native JS errors** (`TypeError`, `RangeError`, etc.) — these are programming
  errors, not user-facing API failures.
- **Internal cache / infrastructure errors** (Redis timeouts, CDN failures) — these
  should be logged and surfaced as `INTERNAL_ERROR` after mapping, not passed
  raw to the UI.
- **Logger calls** — `@repo/logger` is for structured server-side logging; error
  messages there should stay in English regardless of locale.
- **Zod validation errors** — use the `validation.*` namespace keys from
  `@repo/i18n` together with the Zod error map from `@repo/schemas`. Zod errors
  are field-level, not API-response-level.

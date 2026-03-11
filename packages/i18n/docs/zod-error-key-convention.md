# Zod Error Key Naming Convention

## Overview

Zod validation error messages in this project use i18n keys that follow a specific naming convention. Understanding the difference between **2-segment** and **3-segment** keys is important when adding or reviewing schemas.

## Key Formats

### 3-Segment Keys (entity-specific) — preferred

Format: `zodError.<entity>.<field>.<rule>`

Examples:

- `zodError.accommodation.name.min` — "name" field of the accommodation entity, minimum length rule
- `zodError.user.email.invalid` — "email" field of the user entity, format rule
- `zodError.amenity.slug.required` — "slug" field of the amenity entity, required rule

These keys are entity-specific and live in the appropriate namespace within `packages/i18n/src/locales/<locale>/validation.json`.

### 2-Segment Keys (generic/utility) — intentional shorthand

Format: `zodError.<namespace>.<rule>`

Examples:

- `zodError.dateRange.invalidRange` — generic date-range utility message
- `zodError.common.required` — generic required message (used across entities)

**These are intentional.** They represent messages that are not tied to a specific entity or field — typically shared utility validators, cross-cutting validation helpers, or base-schema rules that are reused by multiple entities.

> The `extract-zod-keys.ts` script will emit a warning for 2-segment keys. This is informational, not an error. The key is valid if it matches a translation in all 3 locale files.

## Rules

| Segment count | When to use |
|---|---|
| 2 segments | Generic/utility messages shared across multiple entities (`zodError.common.*`, `zodError.dateRange.*`) |
| 3+ segments | Entity-specific messages (`zodError.<entity>.<field>.<rule>`) |

## Adding New Keys

1. Choose the correct format (2 vs 3 segments) based on whether the message is entity-specific.
2. Add the key to the schema file with the `zodError.*` prefix.
3. Add translations to **all 3 locale files**: `es/validation.json`, `en/validation.json`, `pt/validation.json`.
4. Run `npx tsx scripts/extract-zod-keys.ts --verify` to confirm all keys have translations.

## Locale File Location

```
packages/i18n/src/locales/
├── es/validation.json  # Spanish (default)
├── en/validation.json  # English
└── pt/validation.json  # Portuguese
```

The structure within each file mirrors the key namespace hierarchy (dot-notation maps to nested JSON).

## Verification

The `extract-zod-keys.ts` script can verify that all keys in schemas have corresponding translations:

```bash
npx tsx scripts/extract-zod-keys.ts --verify
```

Exit code 0 means all keys are covered. Exit code 1 means there are missing translations.

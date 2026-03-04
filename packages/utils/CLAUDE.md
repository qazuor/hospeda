# CLAUDE.md - Utils Package

> Main docs: See [README.md](./README.md)
> Project docs: See [root CLAUDE.md](../../CLAUDE.md)

## Overview

Shared utility functions used across all packages and apps in the monorepo. Provides common helpers for arrays, strings, dates, currency, objects, and validation.

## Key Files

```
src/
├── index.ts        # Package entry point (re-exports all modules)
├── array.ts        # Array manipulation utilities
├── currency.ts     # Currency formatting (ARS, USD, BRL)
├── date.ts         # Date formatting and parsing
├── object.ts       # Object manipulation utilities
├── string.ts       # String formatting and transformation
└── validation.ts   # Common validation helpers
test/               # Test files mirroring src structure
```

## Usage

```typescript
import { formatCurrency, slugify, groupBy } from '@repo/utils';

const price = formatCurrency({ amount: 15000, currency: 'ARS' });
// "$15.000"

const slug = slugify({ text: 'Hotel del Rio' });
// "hotel-del-rio"

const grouped = groupBy({ items: accommodations, key: 'category' });
```

## Patterns

- All functions MUST follow the RO-RO pattern (Receive Object, Return Object)
- All exported functions MUST have comprehensive JSDoc documentation
- Functions must be pure.. no side effects
- Prefer immutability.. never mutate input arguments
- Each module file should stay under 500 lines
- Every function must have corresponding tests in `test/`
- Tree-shakeable.. keep modules independent of each other
- Currency defaults to ARS (Argentine Peso) for the Argentina market

## Related Documentation

- `docs/contributing/README.md` - Code standards and contribution guidelines

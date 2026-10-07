# @repo/billing-verticals-contract

The single place where verticals and billing talk to each other: neither imports the other outside this package.

It exports types only, no runtime values. V1 and B1 fill it.

## What is here

- **`Clock`** (B1, AC:B1:17): `{ now(): Date }`, the interface the production
  code of both halves reads the time through. No implementation lives here: the
  composition root of `apps/api` injects the system time, and tests inject the
  adjustable clock of `@repo/test-clock`.

## Boundaries

The contract imports nothing from either half (billing, payments, verticals)
nor from the database layer: `test/package-shape.test.ts` checks it.

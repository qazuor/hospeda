# @repo/test-clock

The shared test package with the adjustable clock: the `Clock` tests inject in
place of the system time (HOS-1352, unit B1, AC:B1:17).

```ts
import { createAdjustableClock } from '@repo/test-clock';

const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00Z') });
clock.now(); // 03:00, and it stays there
clock.advance({ ms: 40 * 60_000 }); // 03:40
clock.set({ at: new Date('2026-10-11T03:00:00Z') });
```

The `Clock` interface lives in `@repo/billing-verticals-contract`; the system
clock is injected by the composition root of `apps/api`.

## Test-only

A devDependency wherever it appears, and never imported by production code.
`test/never-in-production.test.ts` fails if any `package.json` declares it
outside `devDependencies`, or if any non-test source under `apps/*/src` or
`packages/*/src` imports it.

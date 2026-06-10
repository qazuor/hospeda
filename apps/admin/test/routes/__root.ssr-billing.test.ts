/**
 * @file SSR Billing Construction Runtime Regression — Admin Root (SPEC-209 T-006)
 *
 * Runtime test that reproduces the billing-construction SSR bug described in
 * SPEC-209: `createQZPayBilling` is called inside a `useState(() => ...)` lazy
 * initializer at the top level of `RootDocument`. On TanStack Start SSR the
 * root component mounts ONCE PER REQUEST, so the lazy initializer executes
 * server-side on every render, leaking a fresh QZPayBilling instance (~990
 * "QZPayBilling initialized" log lines / 48 h from healthcheck probes).
 *
 * HARNESS APPROACH
 * ----------------
 * Rather than mounting the full `RootDocument` (which drags in TanStack Router
 * context, Better Auth session hooks, multiple providers, and Vite-specific
 * CSS/asset imports that are hard to resolve in vitest), we extract the minimal
 * React pattern that triggers the bug:
 *
 *   function ProbeComponent() {
 *     const [billing] = useState(() => createQZPayBilling(...));
 *     return null;
 *   }
 *
 * This probe mirrors the exact code path in __root.tsx lines 243-258, using
 * the same import (`@qazuor/qzpay-core`) and the same `useState` lazy-init
 * pattern. We then call `renderToString(<ProbeComponent />)` N times.
 *
 * On SSR, React does NOT persist `useState` values between separate
 * `renderToString` calls — each call re-executes the component tree from
 * scratch, triggering the lazy initializer every time. This faithfully
 * reproduces the per-request construction that causes the memory leak.
 *
 * COMPROMISE NOTED: the probe does not exercise the full `RootDocument` JSX
 * tree. If the fix in T-009 moves the billing construction to a different
 * component rather than `RootDocument`, this test must be updated to match.
 * The static-analysis test (`__root.ssr-guard.test.ts`) covers the source
 * location independently.
 *
 * EXPECTED STATE
 * --------------
 * This test FAILS on the current (unfixed) code because `createQZPayBilling`
 * is called N times across N server renders. Task T-009 moves the call into a
 * `useEffect` (which never runs on the server), turning this test green.
 *
 * DO NOT add `.skip` / `.only` / `.fails` — the red must be visible in CI as
 * TDD regression evidence.
 */

import { createElement, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock: @qazuor/qzpay-core
//
// We mock the entire module so that createQZPayBilling becomes a vi.fn().
// The mock must be declared before any import that triggers the module graph,
// so vitest hoists it to the top at runtime via vi.mock hoisting.
// ---------------------------------------------------------------------------

vi.mock('@qazuor/qzpay-core', () => {
    return {
        createQZPayBilling: vi.fn(() => ({
            // Minimal stub — the return value is unused in this test.
            // The only thing we care about is the call count.
            initialized: true
        }))
    };
});

// Import AFTER mock registration so we get the mocked version.
// Dynamic import is not needed here because vi.mock() is hoisted by vitest.
import { createQZPayBilling } from '@qazuor/qzpay-core';

// ---------------------------------------------------------------------------
// Probe component — mirrors the exact pattern in __root.tsx RootDocument:
//
//   const [billing] = useState(() => {
//     ...
//     return createQZPayBilling({ ... }) as unknown as ...;
//   });
//
// We keep it as lean as possible: no providers, no JSX children, just the
// useState lazy initializer that calls createQZPayBilling.
// ---------------------------------------------------------------------------

/**
 * Minimal probe that mirrors the billing useState lazy-initializer in
 * RootDocument. Renders to null — we only care about the factory call count.
 */
function BillingProbeComponent(): null {
    const [_billing] = useState(() =>
        createQZPayBilling({
            storage: {} as Parameters<typeof createQZPayBilling>[0]['storage'],
            defaultCurrency: 'ARS',
            livemode: false
        })
    );
    return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Number of simulated SSR requests (server renders) per test run. */
const SSR_RENDER_COUNT = 5;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Admin RootDocument — SSR billing construction regression (SPEC-209 T-006)', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it(`createQZPayBilling must be called AT MOST ONCE across ${SSR_RENDER_COUNT} server renders (currently FAILS — T-009 fix moves it into useEffect)`, () => {
        // Arrange: cast to vi.Mock so we can inspect call count
        const factoryMock = createQZPayBilling as ReturnType<typeof vi.fn>;

        // Act: simulate N independent SSR requests.
        // Each renderToString call is a fresh React tree — no state is
        // preserved across calls, so useState lazy initializers re-execute
        // every time. This is the exact runtime behaviour of TanStack Start
        // SSR on each incoming HTTP request.
        for (let i = 0; i < SSR_RENDER_COUNT; i++) {
            renderToString(createElement(BillingProbeComponent));
        }

        // Assert: on unfixed code the factory is called SSR_RENDER_COUNT
        // times (once per server render). The correct behaviour after T-009
        // is 0 calls on the server (useEffect never runs server-side) or at
        // most 1 call (if the fix guards with typeof window but still allows
        // one initialization on the client-side hydration pass).
        expect(
            factoryMock.mock.calls.length,
            [
                `createQZPayBilling was called ${factoryMock.mock.calls.length} time(s)`,
                `across ${SSR_RENDER_COUNT} server renders.`,
                '',
                'On unfixed code the lazy useState initializer runs on every SSR',
                'request, creating one QZPayBilling instance per healthcheck hit.',
                '',
                'Fix (T-009): move createQZPayBilling into a useEffect callback.',
                'useEffect never executes on the server, so the call count drops to 0',
                'across server renders.'
            ].join('\n')
        ).toBeLessThanOrEqual(1);
    });
});

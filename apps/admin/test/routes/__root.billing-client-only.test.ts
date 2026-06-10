/**
 * @file Billing client-only lifecycle — Admin Root (SPEC-209 T-011)
 *
 * Post-fix integration test that pins the TWO-PHASE contract the T-009 fix
 * establishes for QZPayBilling construction in `apps/admin/src/routes/__root.tsx`:
 *
 *   1. SERVER (SSR): `createQZPayBilling` is called ZERO times. The fix moved
 *      the construction into a `useEffect`, which never runs during
 *      `renderToString`, so no billing instance is built per request. This is
 *      the property that stops the memory leak (~990 "QZPayBilling initialized"
 *      lines / 48 h previously, one per healthcheck SSR render).
 *   2. CLIENT (mount): `createQZPayBilling` is called EXACTLY ONCE. The
 *      `useEffect(() => ..., [])` runs a single time on mount, so the billing
 *      instance is still built client-side — the fix stops the SSR leak WITHOUT
 *      leaving billing perpetually null on the client.
 *
 * HARNESS APPROACH (same compromise as __root.ssr-billing.test.ts)
 * ---------------------------------------------------------------
 * Mounting the full `RootDocument` is impractical in vitest (it drags in
 * TanStack Router context, Better Auth session hooks, multiple providers, and
 * Vite-specific CSS/asset imports). We extract the minimal React pattern from
 * __root.tsx (the `useState(null)` + `useEffect(() => setBilling(createQZPayBilling(...)))`
 * shape) into a probe component, then exercise it through `renderToString`
 * (server) and `@testing-library/react`'s `render` (client, which flushes
 * effects inside `act`).
 *
 * This is a BEHAVIORAL contract test for the pattern. The source-coupling
 * regression guard — i.e. that __root.tsx itself still uses this pattern and
 * not an SSR-unsafe `useState(() => createQZPayBilling(...))` — lives in the
 * static-analysis test `__root.ssr-guard.test.ts` (T-007). The two together
 * cover both "the pattern behaves correctly" and "the real file uses the
 * pattern".
 */

import { render } from '@testing-library/react';
import { createElement, useEffect, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock: @qazuor/qzpay-core — turn createQZPayBilling into a counting spy.
// Declared before the import so vitest's vi.mock hoisting applies.
// ---------------------------------------------------------------------------

vi.mock('@qazuor/qzpay-core', () => {
    return {
        createQZPayBilling: vi.fn(() => ({ initialized: true }))
    };
});

import { createQZPayBilling } from '@qazuor/qzpay-core';

/**
 * Minimal probe mirroring the client-only billing pattern in RootDocument
 * (apps/admin/src/routes/__root.tsx, post SPEC-209 T-009): billing starts null
 * and is constructed inside a mount-only `useEffect`.
 */
function BillingProbeComponent(): null {
    const [_billing, setBilling] = useState<ReturnType<typeof createQZPayBilling> | null>(null);

    useEffect(() => {
        setBilling(
            createQZPayBilling({
                storage: {} as Parameters<typeof createQZPayBilling>[0]['storage'],
                defaultCurrency: 'ARS',
                livemode: false
            })
        );
    }, []);

    return null;
}

/** Number of simulated SSR requests (server renders) per test run. */
const SSR_RENDER_COUNT = 5;

describe('Admin RootDocument — billing client-only lifecycle (SPEC-209 T-011)', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it(`builds zero QZPayBilling instances across ${SSR_RENDER_COUNT} server renders`, () => {
        // Arrange
        const factoryMock = createQZPayBilling as ReturnType<typeof vi.fn>;

        // Act: simulate N independent SSR requests. renderToString does not run
        // effects, so the mount-only useEffect never fires server-side.
        for (let i = 0; i < SSR_RENDER_COUNT; i++) {
            renderToString(createElement(BillingProbeComponent));
        }

        // Assert: no billing construction on the server — the leak is gone.
        expect(factoryMock.mock.calls.length).toBe(0);
    });

    it('builds exactly one QZPayBilling instance on a client mount', () => {
        // Arrange
        const factoryMock = createQZPayBilling as ReturnType<typeof vi.fn>;

        // Act: render in jsdom. @testing-library/react wraps render in act(),
        // which flushes the mount effect, so the useEffect runs exactly once.
        render(createElement(BillingProbeComponent));

        // Assert: billing IS still constructed on the client — the fix stops the
        // SSR leak without leaving the client without a billing instance.
        expect(factoryMock.mock.calls.length).toBe(1);
    });
});

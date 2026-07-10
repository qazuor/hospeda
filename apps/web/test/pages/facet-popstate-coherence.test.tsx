/**
 * @file facet-popstate-coherence.test.tsx
 * @description HOS-96 T-025 — US-8/M-7: browser back/forward (popstate)
 * restores the exact filter state at each history entry, consistent with
 * URL-as-single-source (no stale in-memory selection survives a popstate
 * that contradicts the restored URL).
 *
 * TEST-INFRA DECISION (documented per the coordinator's explicit ask):
 * - A real Playwright e2e harness DOES exist at `apps/e2e` (grepped for
 *   `playwright`/`e2e` — `apps/e2e/playwright.config.ts`,
 *   `apps/e2e/tests/**\/*.spec.ts`), but it requires a full multi-service
 *   bring-up (seeded DB via `apps/e2e/seeds/e2e-seed.ts`, built+served web/
 *   api/admin, Mailpit, etc. — see `apps/e2e/support/build-and-preview.ts`).
 *   No dev server was running in this worktree (`curl localhost:4321`
 *   failed), and none of the existing `apps/e2e/tests/**` specs cover
 *   listing-filter back/forward today (grepped for `goBack`/`popstate`/
 *   `waitForURL` — the few hits are unrelated auth/compare flows). Spinning
 *   up that full harness is out of proportion for a TEST-ONLY task under
 *   resource-care constraints, so per the coordinator's own fallback
 *   instruction: **this file is the integration/unit-level proof, NOT a
 *   real browser e2e test. Flagging this explicitly — a real Playwright
 *   spec covering listing back/forward may still be worth adding
 *   separately before closeout, coordinator's call.**
 * - IMPORTANT architectural note that shapes what "the strongest available
 *   proof" actually is here: per this app's documented model (spec UX
 *   section, `web/CLAUDE.md`), each filter change on `alojamientos/`,
 *   `eventos/`, `publicaciones/` is a REAL server navigation (SSR
 *   re-render from the URL, not a client-side popstate handler) — unlike
 *   `destinos/`, which is the one page with client-side inline reconcile
 *   (T-023, out of scope, untouched). So there is no page-specific
 *   popstate LISTENER to unit-test on these three pages; the actual risk
 *   surface for "stale selection survives a popstate" is a MODULE-LEVEL
 *   mutable store that would leak state between two independently-rendered
 *   URLs. This file proves that risk does NOT exist, via three layers:
 *   (1) a source-level check that none of the filter/chip/sidebar helpers
 *   hold module-scope mutable state; (2) real `window.history`
 *   pushState/back/forward + `popstate` event mechanics in jsdom (verified
 *   working in this environment), re-deriving `readFacetActiveValues` fresh
 *   after each transition; (3) independent `FilterSidebar` mounts per URL
 *   (matching the real per-navigation fresh-render semantics), proving a
 *   later URL's selection can never leak into an earlier one.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { FilterGroup } from '@/components/shared/filters/FilterSidebar.client';
import { FilterSidebar } from '@/components/shared/filters/FilterSidebar.client';
import { readFacetActiveValues } from '@/lib/filters/read-facet-active-values';

// ---------------------------------------------------------------------------
// Browser API mocks (jsdom does not implement matchMedia)
// ---------------------------------------------------------------------------

beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn()
        })
    });
});

// ---------------------------------------------------------------------------
// Module mocks (mirrors test/components/FilterSidebar.test.tsx)
// ---------------------------------------------------------------------------

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/lib/cn', () => ({
    cn: (...classes: (string | undefined | false | null)[]) => classes.filter(Boolean).join(' ')
}));

vi.mock('@/components/shared/filters/FilterSidebar.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/shared/filters/filter-types/FilterGroupContent.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/shared/filters/filter-types/ToggleFilter.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/shared/filters/filter-types/StepperFilter.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/shared/filters/filter-types/StarsFilter.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/shared/filters/filter-types/DualRangeFilter.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/shared/filters/filter-types/SelectSearchFilter.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/shared/filters/filter-types/IconChipsFilter.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/shared/filters/components/FilterGroup.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/shared/filters/components/MobileDrawer.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/shared/filters/components/SortPopover.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/shared/filters/components/SectionHeader.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

const typesGroup: FilterGroup = {
    id: 'types',
    label: 'Tipo de Alojamiento',
    type: 'checkbox',
    options: [
        { value: 'HOTEL', label: 'HOTEL' },
        { value: 'CABIN', label: 'CABIN' }
    ]
};

/** Await a real `popstate` event fired by a `window.history` navigation. */
function waitForPopstate(trigger: () => void): Promise<void> {
    const promise = new Promise<void>((resolve) => {
        window.addEventListener('popstate', () => resolve(), { once: true });
    });
    trigger();
    return promise;
}

describe('T-025 layer 1 — no module-level mutable store in the filter chain (structural proof)', () => {
    const FILES = [
        'src/lib/filters/read-facet-active-values.ts',
        'src/lib/filters/toggle-multi-query-param.ts',
        'src/lib/filters/build-clear-facet-chip.ts',
        'src/lib/filters/facet-config.ts',
        'src/components/shared/filters/filter-reducer.ts',
        'src/components/shared/filters/FilterSidebar.client.tsx'
    ] as const;

    for (const file of FILES) {
        it(`${file} declares no module-scope mutable binding (no top-level "let", Map, or Set)`, () => {
            const src = readFileSync(resolve(__dirname, '../../', file), 'utf8');
            expect(src).not.toMatch(/^let\s/m);
            expect(src).not.toMatch(/^export let\s/m);
            expect(src).not.toMatch(/^const \w+\s*=\s*new (Map|Set)\(/m);
        });
    }

    it('FilterSidebar.client.tsx keeps ALL selection state inside useReducer (component-local, destroyed on unmount) — not a module-level cache', () => {
        const src = readFileSync(
            resolve(__dirname, '../../src/components/shared/filters/FilterSidebar.client.tsx'),
            'utf8'
        );
        expect(src).toContain('useReducer(');
        expect(src).toContain('initStateFromParams');
    });
});

describe('T-025 layer 2 — real window.history pushState/back/forward + popstate (jsdom)', () => {
    it('apply ?types=HOTEL, then ?types=HOTEL,CABIN, then Back -> readFacetActiveValues freshly re-derived from window.location.search matches the ONE-value state exactly', async () => {
        window.history.replaceState(null, '', '/es/alojamientos/?types=HOTEL');
        expect(
            readFacetActiveValues({
                searchParams: new URLSearchParams(window.location.search),
                paramKey: 'types'
            })
        ).toEqual(['HOTEL']);

        window.history.pushState(null, '', '/es/alojamientos/?types=HOTEL,CABIN');
        expect(
            readFacetActiveValues({
                searchParams: new URLSearchParams(window.location.search),
                paramKey: 'types'
            })
        ).toEqual(['HOTEL', 'CABIN']);

        await waitForPopstate(() => window.history.back());

        expect(window.location.search).toBe('?types=HOTEL');
        const afterBack = readFacetActiveValues({
            searchParams: new URLSearchParams(window.location.search),
            paramKey: 'types'
        });
        expect(afterBack).toEqual(['HOTEL']);
        // No stale CABIN survives — the exact regression this task guards.
        expect(afterBack.includes('CABIN')).toBe(false);
    });

    it('Forward from that same history -> readFacetActiveValues returns identically to the original ?types=HOTEL,CABIN state', async () => {
        // Continues the history stack built in the previous test (same jsdom
        // window/history instance across tests in this file, matching a real
        // single browser tab's session history).
        await waitForPopstate(() => window.history.forward());

        expect(window.location.search).toBe('?types=HOTEL,CABIN');
        expect(
            readFacetActiveValues({
                searchParams: new URLSearchParams(window.location.search),
                paramKey: 'types'
            })
        ).toEqual(['HOTEL', 'CABIN']);
    });
});

describe('T-025 layer 3 — a brand-new FilterSidebar mount at the popstate-restored URL shows the correct state, with zero leakage from the URL that was active a moment before', () => {
    it('mount at ?types=HOTEL,CABIN (both checked) -> unmount -> mount fresh at the popstate-restored ?types=HOTEL -> only HOTEL is checked, CABIN is NOT (no residual selection from the previous mount)', () => {
        const first = render(
            <FilterSidebar
                locale="es"
                filters={[typesGroup]}
                initialParams={{ types: 'HOTEL,CABIN' }}
            />
        );
        expect(screen.getAllByRole('button', { name: 'HOTEL' })[0]).toHaveAttribute(
            'aria-pressed',
            'true'
        );
        expect(screen.getAllByRole('button', { name: 'CABIN' })[0]).toHaveAttribute(
            'aria-pressed',
            'true'
        );
        first.unmount();

        // Simulate the popstate-restored URL: a brand-new page render (this
        // app's real model — server navigation, not a client patch) mounts a
        // brand-new FilterSidebar seeded only from the restored URL's params.
        window.history.replaceState(null, '', '/es/alojamientos/?types=HOTEL');
        const restoredActiveValues = readFacetActiveValues({
            searchParams: new URLSearchParams(window.location.search),
            paramKey: 'types'
        });
        render(
            <FilterSidebar
                locale="es"
                filters={[typesGroup]}
                initialParams={{ types: restoredActiveValues.join(',') }}
            />
        );

        expect(screen.getAllByRole('button', { name: 'HOTEL' })[0]).toHaveAttribute(
            'aria-pressed',
            'true'
        );
        expect(screen.getAllByRole('button', { name: 'CABIN' })[0]).toHaveAttribute(
            'aria-pressed',
            'false'
        );
    });
});

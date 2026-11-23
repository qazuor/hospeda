/**
 * @file dashboard-plan-names.test.ts
 * @description The general dashboard's plan names come from the catalog, not
 * from a hand-kept slug list (HOS-2473): every public vertical is read, each
 * listed plan is translated, and a failed vertical contributes nothing.
 */

import type { PublicPlanCatalogVertical } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    DASHBOARD_CATALOG_VERTICALS,
    readDashboardPlanNames
} from '../../../src/lib/account/dashboard-plan-names';
import type { FetchPlansResult, PublicPlanData } from '../../../src/lib/billing/fetch-plans';

const plan = (slug: string, name: string) => ({ slug, name }) as unknown as PublicPlanData;

/** Translator that knows one key and otherwise returns the catalog fallback. */
const t = (key: string, fallback?: string) =>
    key === 'billing.plan.fixture-pro.name' ? 'Pro traducido' : (fallback ?? key);

describe('readDashboardPlanNames', () => {
    it('reads every catalog vertical once', async () => {
        const fetchPlans = vi.fn(async (): Promise<FetchPlansResult> => ({ ok: true, plans: [] }));
        await readDashboardPlanNames({ t, fetchPlans });
        expect(fetchPlans.mock.calls.map(([input]) => input.vertical).sort()).toEqual(
            [...DASHBOARD_CATALOG_VERTICALS].sort()
        );
    });

    it('maps each catalog slug to its translated name, falling back to the catalog name', async () => {
        const catalog: Partial<Record<PublicPlanCatalogVertical, FetchPlansResult>> = {
            accommodation: { ok: true, plans: [plan('fixture-pro', 'Pro')] },
            venue: { ok: true, plans: [plan('fixture-venue', 'Local Plus')] },
            experience: { ok: false, error: 'HTTP 500' },
            tourist: { ok: true, plans: [] }
        };
        const names = await readDashboardPlanNames({
            t,
            fetchPlans: async ({ vertical }) => catalog[vertical] ?? { ok: true, plans: [] }
        });
        expect(names).toEqual({ 'fixture-pro': 'Pro traducido', 'fixture-venue': 'Local Plus' });
    });

    it('a slug the catalog does not list gets no name (the card falls back to the API name)', async () => {
        const names = await readDashboardPlanNames({
            t,
            fetchPlans: async () => ({ ok: true, plans: [plan('fixture-pro', 'Pro')] })
        });
        expect(names).not.toHaveProperty('owner-basico');
    });
});
